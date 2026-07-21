import { Router } from "express";
import { register } from "../modules/password-auth/register.controller";
import { login } from "../modules/password-auth/login.controller";

const router = Router();

router.post("/register", register);
router.post("/login", login);

export default router;
