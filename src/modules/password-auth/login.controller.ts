import { Request, Response } from "express";
import { z } from "zod";
import { userRepository } from "../../db/repo/user.repository";
import { comparePassword } from "./password.service";
import { issueSession } from "../tokens/session.service";
import { UnauthorizedError, ValidationError } from "../../core/errors/AppError";
import { asyncHandler } from "../../middleware/asyncHandler";
import env from "../../config/env";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export const login = asyncHandler(async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message ?? "Invalid input",
    );
  }

  const { email, password } = parsed.data;

  const user = await userRepository.findByEmail(email);
  if (!user || !user.passwordHash) {
    throw new UnauthorizedError("Invalid email or password");
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    const updated = await userRepository.incrementFailedLoginAttempts(user.id);
    if (updated.failedLoginAttempts >= MAX_ATTEMPTS) {
      await userRepository.lockAccountUntil(
        user.id,
        new Date(Date.now() + LOCK_DURATION_MS),
      );
    }
    throw new UnauthorizedError("Invalid email or password");
  }

  await userRepository.resetFailedLoginAttempts(user.id);

  const { accessToken, refreshToken } = await issueSession(user.id, req);

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    accessToken,
    user: { id: user.id, email: user.email, role: user.role },
  });
});
