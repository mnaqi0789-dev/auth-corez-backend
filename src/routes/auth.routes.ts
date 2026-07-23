import { Router } from "express";
import { register } from "../modules/password-auth/register.controller";
import { login } from "../modules/password-auth/login.controller";
import { refresh } from "../modules/tokens/refresh.controller";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { userRepository } from "../db/repo/user.repository";
import { asyncHandler } from "../middleware/asyncHandler";
import { Response } from "express";

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

export default router;
