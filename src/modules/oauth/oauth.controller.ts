import { Request, Response } from "express";
import crypto from "crypto";
import {
  buildAuthUrl,
  exchangeCodeAndVerify,
} from "./providers/google.provider";
import { userRepository } from "../../db/repo/user.repository";
import { issueSession } from "../tokens/session.service";
import {
  ValidationError,
  UnauthorizedError,
  ConflictError,
} from "../../core/errors/AppError";
import { asyncHandler } from "../../middleware/asyncHandler";
import { logEvent } from "../../core/audit/auditLogger";
import { AuthenticatedRequest } from "../../middleware/requireAuth";
import prisma from "../../db/prisma";
import env from "../../config/env";

interface StateEntry {
  expiry: number;
  linkUserId?: string;
}

const stateStore = new Map<string, StateEntry>();
const STATE_TTL_MS = 10 * 60 * 1000;

export const googleRedirect = asyncHandler(
  async (_req: Request, res: Response) => {
    const state = crypto.randomBytes(16).toString("hex");
    stateStore.set(state, { expiry: Date.now() + STATE_TTL_MS });

    const url = buildAuthUrl(state);
    res.redirect(url);
  },
);

export const googleLinkRedirect = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const state = crypto.randomBytes(16).toString("hex");
    stateStore.set(state, {
      expiry: Date.now() + STATE_TTL_MS,
      linkUserId: req.user!.userId,
    });

    const url = buildAuthUrl(state);
    res.redirect(url);
  },
);

export const googleCallback = asyncHandler(
  async (req: Request, res: Response) => {
    const { code, state } = req.query;

    if (typeof state !== "string" || !stateStore.has(state)) {
      throw new ValidationError("Invalid or missing state parameter");
    }

    const entry = stateStore.get(state)!;
    stateStore.delete(state);

    if (Date.now() > entry.expiry) {
      throw new ValidationError("State parameter expired");
    }

    if (typeof code !== "string") {
      throw new ValidationError("Missing authorization code");
    }

    const profile = await exchangeCodeAndVerify(code);

    if (entry.linkUserId) {
      const existingLink = await prisma.oAuthAccount.findUnique({
        where: {
          provider_providerUserId: {
            provider: "google",
            providerUserId: profile.sub,
          },
        },
      });

      if (existingLink && existingLink.userId !== entry.linkUserId) {
        throw new ConflictError(
          "This Google account is already linked to a different user",
        );
      }

      if (!existingLink) {
        await prisma.oAuthAccount.create({
          data: {
            userId: entry.linkUserId,
            provider: "google",
            providerUserId: profile.sub,
          },
        });
        await logEvent("oauth_login", entry.linkUserId, req.ip ?? null, {
          provider: "google",
          linked: true,
        });
      }

      res.redirect(`${env.FRONTEND_URL}/dashboard?linked=google`);
      return;
    }

    const existingOAuthAccount = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: "google",
          providerUserId: profile.sub,
        },
      },
    });

    let userId: string;
    let wasSignup = false;

    if (existingOAuthAccount) {
      const linkedUser = await userRepository.findById(
        existingOAuthAccount.userId,
      );
      if (!linkedUser) {
        throw new UnauthorizedError("Linked account no longer exists");
      }
      userId = linkedUser.id;
    } else {
      const existingUser = await userRepository.findByEmail(profile.email);

      if (existingUser && profile.emailVerified) {
        await prisma.oAuthAccount.create({
          data: {
            userId: existingUser.id,
            provider: "google",
            providerUserId: profile.sub,
          },
        });
        userId = existingUser.id;
      } else if (existingUser && !profile.emailVerified) {
        throw new UnauthorizedError(
          "Email exists but is not verified with Google; cannot auto-link",
        );
      } else {
        const newUser = await userRepository.create({
          email: profile.email,
          passwordHash: null,
        });
        await prisma.oAuthAccount.create({
          data: {
            userId: newUser.id,
            provider: "google",
            providerUserId: profile.sub,
          },
        });
        userId = newUser.id;
        wasSignup = true;
      }
    }

    await logEvent(
      wasSignup ? "oauth_signup" : "oauth_login",
      userId,
      req.ip ?? null,
      { provider: "google" },
    );

    const { refreshToken } = await issueSession(userId, req);
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(`${env.FRONTEND_URL}/dashboard`);
  },
);
