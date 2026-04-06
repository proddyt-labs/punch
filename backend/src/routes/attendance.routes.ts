import { Router } from "express";
import { requireAuth, getCurrentUser } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";

const router = Router();

// Marca ponto de entrada
router.post("/clock-in", requireAuth, async (req, res) => {
  const { id: userId } = getCurrentUser(req);

  const record = await prisma.attendanceRecord.create({
    data: { userId, type: "CLOCK_IN" },
  });

  res.status(201).json(record);
});

// Marca ponto de saida
router.post("/clock-out", requireAuth, async (req, res) => {
  const { id: userId } = getCurrentUser(req);

  const record = await prisma.attendanceRecord.create({
    data: { userId, type: "CLOCK_OUT" },
  });

  res.status(201).json(record);
});

// Historico entre datas
router.get("/history", requireAuth, async (req, res) => {
  const { id: userId } = getCurrentUser(req);
  const { from, to } = req.query;

  const where: { userId: string; timestamp: { gte?: Date; lte?: Date } } = {
    userId,
    timestamp: {},
  };

  if (from) where.timestamp.gte = new Date(from as string);
  if (to) where.timestamp.lte = new Date(to as string);

  const records = await prisma.attendanceRecord.findMany({
    where,
    orderBy: { timestamp: "desc" },
  });

  res.json(records);
});

export default router;
