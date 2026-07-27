import { Response } from "express";
import { userRepository } from "../../db/repo/user.repository";
import { sessionRepository } from "../../db/repo/session.repository";
import { auditEventRepository } from "../../db/repo/audit.repository";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AuthenticatedRequest } from "../../middleware/requireAuth";
import { NotFoundError, ValidationError } from "../../core/errors/AppError";

function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(query.page ?? "1"), 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(String(query.limit ?? "20"), 10) || 20),
  );
  return { page, limit };
}

export const listUsers = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit } = parsePagination(req.query);
    const { users, total } = await userRepository.findAllPaginated(page, limit);

    res.status(200).json({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        emailVerified: u.emailVerified,
        lockedUntil: u.lockedUntil,
        createdAt: u.createdAt,
      })),
      page,
      limit,
      total,
    });
  },
);

export const getUserById = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    if (typeof id !== "string") {
      throw new ValidationError("Invalid user id");
    }

    const user = await userRepository.findById(id);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const sessions = await sessionRepository.findAllByUserId(id);
    const { events } = await auditEventRepository.findPaginated(1, 20, id);

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        lockedUntil: user.lockedUntil,
        failedLoginAttempts: user.failedLoginAttempts,
        createdAt: user.createdAt,
      },
      sessions: sessions.map((s) => ({
        id: s.id,
        userAgent: s.userAgent,
        ipAddress: s.ipAddress,
        revoked: s.revoked,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      })),
      recentEvents: events,
    });
  },
);

export const listAuditEvents = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit } = parsePagination(req.query);
    const userId =
      typeof req.query.userId === "string" ? req.query.userId : undefined;
    const { events, total } = await auditEventRepository.findPaginated(
      page,
      limit,
      userId,
    );

    res.status(200).json({ events, page, limit, total });
  },
);
