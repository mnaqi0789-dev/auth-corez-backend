import { Request, Response } from "express";
import crypto from "crypto";
import {
  buildAuthUrl,
  exchangeCodeAndVerify,
} from "./providers/google.provider";
import { userRepository } from "../../db/repo/user.repository";
import { issueSession } from "../tokens/session.service";
import { ValidationError, UnauthorizedError } from "../../core/errors/AppError";
import { asyncHandler } from "../../middleware/asyncHandler";
import { logEvent } from "../../core/audit/auditLogger";
import prisma from "../../db/prisma";
import env from "../../config/env";

const stateStore = new Map<string, number>();
const STATE_TTL_MS = 10 * 60 * 1000;

export const googleRedirect = asyncHandler(
  async (_req: Request, res: Response) => {
    const state = crypto.randomBytes(16).toString("hex");
    stateStore.set(state, Date.now() + STATE_TTL_MS);

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

    const expiry = stateStore.get(state)!;
    stateStore.delete(state);

    if (Date.now() > expiry) {
      throw new ValidationError("State parameter expired");
    }

    if (typeof code !== "string") {
      throw new ValidationError("Missing authorization code");
    }

    const profile = await exchangeCodeAndVerify(code);

    const existingOAuthAccount = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: "google",
          providerUserId: profile.sub,
        },
      },
    });

    let userId: string;
    let role: string;
    let wasSignup = false;

    if (existingOAuthAccount) {
      const linkedUser = await userRepository.findById(
        existingOAuthAccount.userId,
      );
      if (!linkedUser) {
        throw new UnauthorizedError("Linked account no longer exists");
      }
      userId = linkedUser.id;
      role = linkedUser.role;
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
        role = existingUser.role;
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
        role = newUser.role;
        wasSignup = true;
      }
    }

    await logEvent(
      wasSignup ? "oauth_signup" : "oauth_login",
      userId,
      req.ip ?? null,
      {
        provider: "google",
      },
    );

const { accessToken, refreshToken } = await issueSession(userId, req);
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({ accessToken });
  },
);
