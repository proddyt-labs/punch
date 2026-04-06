import { Router } from "express";
import { requireAuth, getCurrentUser } from "../middleware/auth.middleware";

const router = Router();

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: getCurrentUser(req) });
});

export default router;
