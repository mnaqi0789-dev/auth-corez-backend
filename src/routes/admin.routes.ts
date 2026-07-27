import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import {
  listUsers,
  getUserById,
  listAuditEvents,
} from "../modules/admin/admin.controller";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/users", listUsers);
router.get("/users/:id", getUserById);
router.get("/audit-events", listAuditEvents);

export default router;
