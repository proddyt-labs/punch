import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";

// Bootstrap fallback (caso Gate não retorne roles ainda)
const ADMIN_USERNAMES = (process.env.ADMIN_USERNAMES ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const requireAdmin: RequestHandler = async (req, res, next) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // 1. Gate role admin (preferencial)
  if (req.user.isAdmin) {
    next();
    return;
  }

  // 2. Bootstrap por env var
  if (ADMIN_USERNAMES.includes(req.user.username)) {
    next();
    return;
  }

  // 3. Flag local no DB (legacy)
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isAdmin: true },
    });
    if (dbUser?.isAdmin) {
      next();
      return;
    }
  } catch {
    // fallthrough
  }

  res.status(403).json({ error: "Forbidden" });
};

export const requireGroupManager: RequestHandler = async (req, res, next) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (req.user.isAdmin) {
    next();
    return;
  }

  if (ADMIN_USERNAMES.includes(req.user.username)) {
    next();
    return;
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isAdmin: true, roles: true },
    });
    if (dbUser?.isAdmin || dbUser?.roles.includes("manager")) {
      next();
      return;
    }
  } catch {
    // fallthrough
  }

  res.status(403).json({ error: "Forbidden" });
};
