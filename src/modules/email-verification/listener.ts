import crypto from "crypto";
import { eventBus } from "../../core/events/eventBus";
import { hashToken } from "../tokens/hash.util";
import prisma from "../../db/prisma";

const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

eventBus.on("user.registered", async ({ userId }: { userId: string }) => {
  try {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);

    await prisma.token.create({
      data: {
        userId,
        tokenHash,
        type: "email_verification",
        expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
      },
    });

    console.log(`Email verification link: /verify-email/${rawToken}`);
  } catch (err) {
    console.error("Failed to create email verification token", err);
  }
});
