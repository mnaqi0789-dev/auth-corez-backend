import { Router } from "express";
import { register } from "../modules/password-auth/register.controller";
import { login } from "../modules/password-auth/login.controller";
import { refresh } from "../modules/tokens/refresh.controller";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { userRepository } from "../db/repo/user.repository";
import { asyncHandler } from "../middleware/asyncHandler";
import { Response } from "express";
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

router.post("/register", register);
router.post("/login", login);
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
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
