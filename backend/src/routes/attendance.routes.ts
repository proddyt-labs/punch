import { Router } from "express";
import { requireAuth, getCurrentUser } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";

const router = Router();

function resolveTimestampInput(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") {
    return new Date();
  }

  if (typeof value !== "string") {
    return null;
  }

  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

// Status atual — último registro geral do usuário
router.get("/status", requireAuth, async (req, res) => {
  const { id: userId } = getCurrentUser(req);
  const lastRecord = await prisma.attendanceRecord.findFirst({
    where: { userId },
    orderBy: { timestamp: "desc" },
  });
  res.json({
    isWorking: lastRecord?.type === "CLOCK_IN",
    lastRecord: lastRecord ?? null,
  });
});

// Marca ponto de entrada
router.post("/clock-in", requireAuth, async (req, res) => {
  const { id: userId } = getCurrentUser(req);
  const timestamp = resolveTimestampInput(req.body?.timestamp);

  if (!timestamp) {
    return res.status(400).json({ error: "Invalid timestamp format" });
  }

  const record = await prisma.attendanceRecord.create({
    data: { userId, type: "CLOCK_IN", timestamp },
  });

  res.status(201).json(record);
});

// Marca ponto de saida
router.post("/clock-out", requireAuth, async (req, res) => {
  const { id: userId } = getCurrentUser(req);
  const timestamp = resolveTimestampInput(req.body?.timestamp);

  if (!timestamp) {
    return res.status(400).json({ error: "Invalid timestamp format" });
  }

  const record = await prisma.attendanceRecord.create({
    data: { userId, type: "CLOCK_OUT", timestamp },
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

// Deleta um registro do usuario autenticado
router.delete("/records/:id", requireAuth, async (req, res) => {
  const { id: userId } = getCurrentUser(req);
  const recordIdParam = req.params.id;
  const recordId = Array.isArray(recordIdParam) ? recordIdParam[0] : recordIdParam;

  if (!recordId) {
    return res.status(400).json({ error: "Record id is required" });
  }

  const record = await prisma.attendanceRecord.findUnique({
    where: { id: recordId },
  });

  if (!record) {
    return res.status(404).json({ error: "Record not found" });
  }

  if (record.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  await prisma.attendanceRecord.delete({
    where: { id: recordId },
  });

  res.status(204).send();
});

// Importação em massa (de CSV parseado no frontend)
router.post("/import", requireAuth, async (req, res) => {
  const { id: userId } = getCurrentUser(req);
  const { records: imported } = req.body as {
    records: { type: string; timestamp: string }[];
  };

  if (!Array.isArray(imported) || imported.length === 0) {
    return res.status(400).json({ error: "Nenhum registro fornecido" });
  }

  if (imported.length > 500) {
    return res.status(400).json({ error: "Máximo de 500 registros por importação" });
  }

  const data: { userId: string; type: "CLOCK_IN" | "CLOCK_OUT"; timestamp: Date }[] = [];
  for (const item of imported) {
    if (item.type !== "CLOCK_IN" && item.type !== "CLOCK_OUT") {
      return res.status(400).json({ error: `Tipo inválido: ${item.type}` });
    }
    const ts = new Date(item.timestamp);
    if (isNaN(ts.getTime())) {
      return res.status(400).json({ error: `Timestamp inválido: ${item.timestamp}` });
    }
    data.push({ userId, type: item.type, timestamp: ts });
  }

  const result = await prisma.attendanceRecord.createMany({ data });
  res.status(201).json({ imported: result.count });
});

// Edita o timestamp de um registro
router.patch("/records/:id", requireAuth, async (req, res) => {
  const { id: userId } = getCurrentUser(req);
  const recordIdParam = req.params.id;
  const recordId = Array.isArray(recordIdParam) ? recordIdParam[0] : recordIdParam;
  const { timestamp } = req.body;

  if (!recordId) {
    return res.status(400).json({ error: "Record id is required" });
  }

  if (!timestamp) {
    return res.status(400).json({ error: "Timestamp is required" });
  }

  const parsedTimestamp = new Date(timestamp);
  if (isNaN(parsedTimestamp.getTime())) {
    return res.status(400).json({ error: "Invalid timestamp format" });
  }

  const record = await prisma.attendanceRecord.findUnique({
    where: { id: recordId },
  });

  if (!record) {
    return res.status(404).json({ error: "Record not found" });
  }

  if (record.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const updated = await prisma.attendanceRecord.update({
    where: { id: recordId },
    data: { timestamp: parsedTimestamp },
  });

  res.json(updated);
});

export default router;
