import { Router } from "express";
import { requireAuth, getCurrentUser } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";

const router = Router();

function parseLocalDate(dateStr: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

router.get("/overview", requireAuth, async (req, res) => {
  const { id: userId } = getCurrentUser(req);

  const dateParamRaw = req.query.date;
  const dateParam = Array.isArray(dateParamRaw) ? dateParamRaw[0] : dateParamRaw;

  const now = new Date();
  const selectedDay = dateParam ? parseLocalDate(String(dateParam)) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!selectedDay) {
    return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
  }

  const startOfDay = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate());
  const endOfDay = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate(), 23, 59, 59, 999);
  const isToday =
    startOfDay.getFullYear() === now.getFullYear() &&
    startOfDay.getMonth() === now.getMonth() &&
    startOfDay.getDate() === now.getDate();
  const referenceNow = isToday ? now : endOfDay;

  const records = await prisma.attendanceRecord.findMany({
    where: {
      userId,
      timestamp: { gte: startOfDay, lte: endOfDay },
    },
    orderBy: { timestamp: "asc" },
  });

  const clockIns = records.filter((r) => r.type === "CLOCK_IN");
  const clockOuts = records.filter((r) => r.type === "CLOCK_OUT");

  const lastClockIn = clockIns.length ? clockIns[clockIns.length - 1] : null;
  const lastClockOut = clockOuts.length ? clockOuts[clockOuts.length - 1] : null;

  // Calcula horas trabalhadas aproximadas
  let workedHours: number | null = null;

  if (lastClockIn && lastClockOut) {
    // Par completo: diff entre os ultimos
    workedHours = (lastClockOut.timestamp.getTime() - lastClockIn.timestamp.getTime()) / 3600000;
  } else if (lastClockIn && !lastClockOut) {
    // So tem clock-in: conta ate o fim do dia selecionado (ou agora, se for hoje)
    workedHours = (referenceNow.getTime() - lastClockIn.timestamp.getTime()) / 3600000;
  }

  // Se tem multiplos pares, soma todos
  if (clockIns.length > 1 || clockOuts.length > 1) {
    let totalMs = 0;
    const allEvents = [...records].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    for (let i = 0; i < allEvents.length - 1; i++) {
      if (allEvents[i].type === "CLOCK_IN" && allEvents[i + 1].type === "CLOCK_OUT") {
        totalMs += allEvents[i + 1].timestamp.getTime() - allEvents[i].timestamp.getTime();
      }
    }

    // Se ultimo evento e um CLOCK_IN sem par, soma ate agora
    const lastEvent = allEvents[allEvents.length - 1];
    if (lastEvent && lastEvent.type === "CLOCK_IN") {
      totalMs += referenceNow.getTime() - lastEvent.timestamp.getTime();
    }

    workedHours = totalMs / 3600000;
  }

  res.json({
    today: startOfDay,
    lastClockIn,
    lastClockOut,
    clockInCount: clockIns.length,
    clockOutCount: clockOuts.length,
    workedHours: workedHours !== null ? Math.round(workedHours * 100) / 100 : null,
  });
});

export default router;
