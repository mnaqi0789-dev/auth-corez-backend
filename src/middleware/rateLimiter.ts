import { Request, Response, NextFunction } from "express";

interface WindowEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, WindowEntry>();

export function rateLimiter(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();

    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= maxRequests) {
      return res
        .status(429)
        .json({ error: "Too many requests, try again later" });
    }

    entry.count += 1;
    next();
  };
}
