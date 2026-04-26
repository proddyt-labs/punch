import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";

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

const GATE_URL = process.env.GATE_URL ?? "http://localhost:3100";

export const requireAuth: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const resp = await fetch(`${GATE_URL}/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resp.ok) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    const info = (await resp.json()) as { sub: string; username: string; email?: string };

    // Fast path: find by Gate subject ID
    let user = await prisma.user.findUnique({ where: { gateId: info.sub } });

    // Migration path: existing user found by username → link gateId to preserve attendance records
    if (!user) {
      const existing = await prisma.user.findUnique({ where: { username: info.username } });
      if (existing) {
        user = await prisma.user.update({
          where: { id: existing.id },
          data: { gateId: info.sub },
        });
      }
    }

    // New user via Gate
    if (!user) {
      user = await prisma.user.create({
        data: {
          username: info.username,
          email: info.email ?? `${info.username}@gate.internal`,
          gateId: info.sub,
        },
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Gate auth error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export function getCurrentUser(req: Express.Request): AppUser {
  if (!req.user) throw new Error("User not set on request");
  return req.user;
}
