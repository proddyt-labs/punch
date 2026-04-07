import "dotenv/config";
import express from "express";
import cors from "cors";
import { prisma } from "./lib/prisma";
import authRoutes from "./routes/auth.routes";
import attendanceRoutes from "./routes/attendance.routes";
import dashboardRoutes from "./routes/dashboard.routes";

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

// --- Healthcheck ---
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
