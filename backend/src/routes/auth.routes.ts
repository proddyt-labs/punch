import { Router } from "express";
import { requireAuth, getCurrentUser } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: getCurrentUser(req) });
});

// Exchanges Gate OAuth2 authorization code for access_token.
// Keeps GATE_CLIENT_SECRET on the backend — never sent to the browser.
router.post("/callback", async (req, res) => {
  const { code, redirectUri } = req.body as { code?: string; redirectUri?: string };

  if (!code) {
    res.status(400).json({ error: "Code required" });
    return;
  }

  const GATE_URL = process.env.GATE_URL ?? "http://localhost:3100";
  const CLIENT_ID = process.env.GATE_CLIENT_ID ?? "punch";
  const CLIENT_SECRET = process.env.GATE_CLIENT_SECRET ?? "";

  try {
    const resp = await fetch(`${GATE_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    });

    const data = (await resp.json()) as { access_token?: string; error?: string };

    if (!resp.ok) {
      res.status(400).json({ error: data.error ?? "Token exchange failed" });
      return;
    }

    res.json({ access_token: data.access_token });
  } catch (err) {
    console.error("Token exchange error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
