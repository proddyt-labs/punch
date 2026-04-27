import "dotenv/config";
import express from "express";
import cors from "cors";
import { prisma } from "./lib/prisma";
import authRoutes from "./routes/auth.routes";
import attendanceRoutes from "./routes/attendance.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import adminRoutes from "./routes/admin.routes";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Avoid browser/proxy caching for API responses (prevents 304 on dynamic endpoints).
app.set("etag", false);
app.use(cors());
app.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use(express.json());

// --- Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin", adminRoutes);

// --- Internal widget endpoints (Gate only, no public access) ---
app.get("/internal/widget", async (req, res) => {
  const gateId = req.query.gateId as string;
  if (!gateId) { res.status(400).json({ error: "gateId required" }); return; }
  const user = await prisma.user.findUnique({ where: { gateId } });
  if (!user) { res.json({ status: "unknown" }); return; }
  const last = await prisma.attendanceRecord.findFirst({
    where: { userId: user.id },
    orderBy: { timestamp: "desc" },
  });
  res.json({
    status: last?.type === "CLOCK_IN" ? "in" : "out",
    since: last?.timestamp ?? null,
  });
});

app.post("/internal/widget/action", async (req, res) => {
  const gateId = req.query.gateId as string;
  const { action } = req.body as { action?: string };
  if (!gateId) { res.status(400).json({ error: "gateId required" }); return; }
  if (action !== "clock-in" && action !== "clock-out") {
    res.status(400).json({ error: "action must be clock-in or clock-out" }); return;
  }
  const user = await prisma.user.findUnique({ where: { gateId } });
  if (!user) { res.status(404).json({ error: "user_not_found" }); return; }
  const type = action === "clock-in" ? "CLOCK_IN" : "CLOCK_OUT";
  await prisma.attendanceRecord.create({ data: { userId: user.id, type, timestamp: new Date() } });
  const last = await prisma.attendanceRecord.findFirst({
    where: { userId: user.id },
    orderBy: { timestamp: "desc" },
  });
  res.json({ status: last?.type === "CLOCK_IN" ? "in" : "out", since: last?.timestamp ?? null });
});

// --- Healthcheck ---
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
