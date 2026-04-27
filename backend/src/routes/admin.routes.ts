import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

// ── Check ─────────────────────────────────────────────────
router.get("/check", requireAuth, requireAdmin, (_req, res) => {
  res.json({ isAdmin: true });
});

// ── Users ─────────────────────────────────────────────────

router.get("/users", requireAuth, requireAdmin, async (_req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      isAdmin: true,
      roles: true,
      groupId: true,
      group: { select: { id: true, name: true } },
    },
    orderBy: { username: "asc" },
  });
  res.json(users);
});

// Atualiza isAdmin, roles ou group de um usuário
router.patch("/users/:id", requireAuth, requireAdmin, async (req, res) => {
  const { isAdmin, roles, groupId } = req.body as {
    isAdmin?: boolean;
    roles?: string[];
    groupId?: string | null;
  };

  const data: {
    isAdmin?: boolean;
    roles?: string[];
    groupId?: string | null;
  } = {};

  if (isAdmin !== undefined) data.isAdmin = Boolean(isAdmin);
  if (roles !== undefined) data.roles = Array.isArray(roles) ? roles : [];
  if ("groupId" in req.body) data.groupId = groupId ?? null;

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data,
    select: {
      id: true,
      username: true,
      name: true,
      isAdmin: true,
      roles: true,
      groupId: true,
      group: { select: { id: true, name: true } },
    },
  });

  res.json(updated);
});

// ── Groups ────────────────────────────────────────────────

router.get("/groups", requireAuth, requireAdmin, async (_req, res) => {
  const groups = await prisma.group.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });
  res.json(groups);
});

router.post("/groups", requireAuth, requireAdmin, async (req, res) => {
  const { name, description } = req.body as { name?: string; description?: string };
  if (!name?.trim()) {
    return res.status(400).json({ error: "Nome do grupo é obrigatório" });
  }
  try {
    const group = await prisma.group.create({
      data: { name: name.trim(), description: description?.trim() ?? null },
    });
    res.status(201).json(group);
  } catch {
    res.status(409).json({ error: "Já existe um grupo com esse nome" });
  }
});

router.delete("/groups/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await prisma.group.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Grupo não encontrado" });
  }
});

// ── Attendance (todos os usuários) ────────────────────────

router.get("/attendance", requireAuth, requireAdmin, async (req, res) => {
  const { userId, groupId, from, to } = req.query;

  const where: {
    userId?: string;
    user?: { groupId?: string };
    timestamp?: { gte?: Date; lte?: Date };
  } = {};

  if (userId) where.userId = userId as string;
  else if (groupId) where.user = { groupId: groupId as string };

  if (from || to) {
    where.timestamp = {};
    if (from) where.timestamp.gte = new Date(from as string);
    if (to)   where.timestamp.lte = new Date(to as string);
  }

  const records = await prisma.attendanceRecord.findMany({
    where,
    include: {
      user: { select: { id: true, username: true, name: true } },
    },
    orderBy: { timestamp: "desc" },
    take: 1000,
  });

  res.json(records);
});

// ── Summary por usuário ───────────────────────────────────

router.get("/summary", requireAuth, requireAdmin, async (req, res) => {
  const { groupId, from, to } = req.query;

  const where: {
    user?: { groupId?: string };
    timestamp?: { gte?: Date; lte?: Date };
  } = {};

  if (groupId) where.user = { groupId: groupId as string };
  if (from || to) {
    where.timestamp = {};
    if (from) where.timestamp.gte = new Date(from as string);
    if (to)   where.timestamp.lte = new Date(to as string);
  }

  const records = await prisma.attendanceRecord.findMany({
    where,
    include: { user: { select: { id: true, username: true, name: true, group: { select: { id: true, name: true } } } } },
    orderBy: { timestamp: "asc" },
  });

  const byUser = new Map<string, typeof records>();
  for (const r of records) {
    if (!byUser.has(r.userId)) byUser.set(r.userId, []);
    byUser.get(r.userId)!.push(r);
  }

  const summary = [];
  for (const [, userRecords] of byUser) {
    const user = userRecords[0].user;
    let totalMs = 0;
    for (let i = 0; i < userRecords.length - 1; i++) {
      if (userRecords[i].type === "CLOCK_IN" && userRecords[i + 1].type === "CLOCK_OUT") {
        totalMs +=
          userRecords[i + 1].timestamp.getTime() -
          userRecords[i].timestamp.getTime();
      }
    }
    summary.push({
      user,
      totalHours: Math.round((totalMs / 3600000) * 100) / 100,
      clockIns:  userRecords.filter((r) => r.type === "CLOCK_IN").length,
      clockOuts: userRecords.filter((r) => r.type === "CLOCK_OUT").length,
    });
  }

  res.json(summary.sort((a, b) => b.totalHours - a.totalHours));
});

export default router;
