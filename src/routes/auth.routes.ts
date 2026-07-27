import { Router } from "express";
import { register } from "../modules/password-auth/register.controller";
import { login } from "../modules/password-auth/login.controller";
import { refresh } from "../modules/tokens/refresh.controller";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { userRepository } from "../db/repo/user.repository";
import { verifyEmail } from "../modules/email-verification/verify-email.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  googleRedirect,
  googleCallback,
} from "../modules/oauth/oauth.controller";
import { Response } from "express";
import { rateLimiter } from "../middleware/rateLimiter";
import {
  listSessions,
  revokeSession,
  revokeAllSessions,
  logout,
} from "../modules/sessions/session.controller";
import {
  forgotPassword,
  resetPassword,
} from "../modules/password-reset/password-reset.controller";

const router = Router();

router.post("/register", rateLimiter(5, 15 * 60 * 1000), register);
router.post("/login", rateLimiter(5, 15 * 60 * 1000), login);
router.post("/refresh", refresh);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = await userRepository.findById(req.user!.userId);
    res
      .status(200)
      .json({ id: user?.id, email: user?.email, role: user?.role });
  }),
);

router.get("/sessions", requireAuth, listSessions);
router.delete("/sessions/:id", requireAuth, revokeSession);
router.post("/sessions/revoke-all", requireAuth, revokeAllSessions);
router.post("/logout", requireAuth, logout);
router.post("/forgot-password", rateLimiter(5, 15 * 60 * 1000), forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/verify-email/:token", verifyEmail);
router.get("/oauth/google", googleRedirect);
router.get("/oauth/google/callback", googleCallback);

export default router;
