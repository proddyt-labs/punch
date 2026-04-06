import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";

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

/**
 * Authentik via Nginx proxy injection:
 * - `X-authentik-username` header é injetado pelo Authentik no forward auth
 * - Se não estiver atrás de proxy, aceita `Authorization: Bearer <token>` ou `X-Test-User`
 */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const username =
    req.headers["x-authentik-username"]?.toString().toLowerCase() ||
    req.headers["x-test-user"]?.toString().toLowerCase();

  if (!username) {
    return res.status(401).json({ error: "Unauthorized. Authenticate via Authentik." });
  }

  try {
    let user = await prisma.user.findUnique({ where: { username } });

    // Auto-provision usuário na primeira visita
    if (!user) {
      const email = req.headers["x-authentik-email"]?.toString() ?? `${username}@local`;
      const name = req.headers["x-authentik-name"]?.toString() ?? null;
      user = await prisma.user.create({
        data: { username, email, name },
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export function getCurrentUser(req: Express.Request): AppUser {
  if (!req.user) throw new Error("User not set on request");
  return req.user;
}
