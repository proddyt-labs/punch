import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";
import { requireAuth, getCurrentUser, signToken } from "../middleware/auth.middleware";

const router = Router();

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: getCurrentUser(req) });
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username: username.toLowerCase() }, { email: username.toLowerCase() }],
    },
  });

  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = signToken(user.id);
  res.json({ token, user: { id: user.id, username: user.username, email: user.email, name: user.name } });
});

router.post("/register", async (req, res) => {
  const { username, email, name, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ username: username.toLowerCase() }, ...(email ? [{ email: email.toLowerCase() }] : [])],
    },
  });

  if (existing) {
    return res.status(409).json({ error: "Username or email already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      username: username.toLowerCase(),
      email: email?.toLowerCase() ?? "",
      name: name ?? null,
      passwordHash,
    },
  });

  const token = signToken(user.id);
  res.status(201).json({ token, user: { id: user.id, username: user.username, email: user.email, name: user.name } });
});

export default router;
