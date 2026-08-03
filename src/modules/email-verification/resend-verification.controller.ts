import { Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { userRepository } from "../../db/repo/user.repository";
import { hashToken } from "../tokens/hash.util";
import prisma from "../../db/prisma";
import { ValidationError } from "../../core/errors/AppError";
import { asyncHandler } from "../../middleware/asyncHandler";
import env from "../../config/env";

const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const resendSchema = z.object({
  email: z.string().email(),
});

export const resendVerification = asyncHandler(
  async (req: Request, res: Response) => {
    const parsed = resendSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues[0]?.message ?? "Invalid input",
      );
    }

    const { email } = parsed.data;
    const user = await userRepository.findByEmail(email);
    let devVerifyLink: string | undefined;

    if (user && !user.emailVerified) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashToken(rawToken);

      await prisma.token.create({
        data: {
          userId: user.id,
          tokenHash,
          type: "email_verification",
          expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
        },
      });

      console.log(`Email verification link: /verify-email/${rawToken}`);

      if (env.NODE_ENV !== "production") {
        devVerifyLink = `/verify-email/${rawToken}`;
      }
    }

    res.status(200).json({
      message:
        "If that email exists and is unverified, a new link has been sent",
      ...(devVerifyLink ? { devVerifyLink } : {}),
    });
  },
);
