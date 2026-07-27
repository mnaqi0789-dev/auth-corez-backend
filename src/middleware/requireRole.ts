import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./requireAuth";
import { ForbiddenError } from "../core/errors/AppError";

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError("Insufficient permissions");
    }
    next();
  };
}
