import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

export interface AppUser {
  id: string;
  username: string;
  email: string;
  name: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AppUser;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET ?? "time-tracker-super-secret";

export function signToken(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
  } catch {
    return null;
  }
}

/**
 * Auth middleware — two modes:
 * 1. JWT Bearer token via Authorization header (own login)
 * 2. Authentik proxy headers (optional, for deploy)
 */
export const requireAuth: RequestHandler = async (req, res, next) => {
  // --- Mode 1: JWT Bearer token ---
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    const payload = verifyToken(token);
    if (!payload) return res.status(401).json({ error: "Invalid or expired token" });

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return res.status(401).json({ error: "User not found" });

    req.user = user;
    return next();
  }

  // --- Mode 2: Authentik proxy headers ---
  const username = req.headers["x-authentik-username"]?.toString().toLowerCase();
  if (username) {
    try {
      let user = await prisma.user.findUnique({ where: { username } });

      if (!user) {
        const email = req.headers["x-authentik-email"]?.toString() ?? `${username}@local`;
        const name = req.headers["x-authentik-name"]?.toString() ?? null;
        user = await prisma.user.create({ data: { username, email, name } });
      }

      req.user = user;
      return next();
    } catch (err) {
      console.error("Authentik auth middleware error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // --- No auth provided ---
  return res.status(401).json({ error: "Unauthorized" });
};

export function getCurrentUser(req: Express.Request): AppUser {
  if (!req.user) throw new Error("User not set on request");
  return req.user;
}
