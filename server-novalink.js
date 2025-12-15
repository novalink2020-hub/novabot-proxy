// ===========================================
// NovaBot Mini Server – Secure Build
// Layers:
// 1) Domain Lock (CORS Origin allowlist)
// 2) Signed Session Token (short-lived)
// 3) Brain Firewall (Rate + Burst Protection)
// 4) Turnstile Proof (anti-abuse / watermark)
// ===========================================

import http from "http";
import { URL } from "url";
import crypto from "crypto";

// AI modules
import { detectNovaIntent } from "./novaIntentDetector.js";
import { novaBrainSystem } from "./novaBrainSystem.js";

// -------------------------------------------
// Load Knowledge V5 on boot
// -------------------------------------------
const KNOWLEDGE_URL = process.env.KNOWLEDGE_V5_URL;

(async () => {
  try {
    console.log("📚 Loading Nova Knowledge V5...");
    await novaBrainSystem.loadKnowledgeFromURL(KNOWLEDGE_URL);
    console.log("✅ Knowledge V5 loaded successfully!");
  } catch (err) {
    console.error("❌ Failed to load knowledge:", err);
  }
})();

// ============================================================
// Small utils
// ============================================================
function detectLang(text = "") {
  return /[A-Za-z]/.test(text) ? "en" : "ar";
}

function softReply(lang) {
  return lang === "en"
    ? "Let’s take a breath… and continue in a moment 🙂"
    : "دعنا نأخذ نفسًا… وأكمل بعد لحظة 🙂";
}

function softSecurityReply(lang) {
  return lang === "en"
    ? "Quick security check… please try again in a moment 🙂"
    : "تحقق أمني سريع… جرّب مرة أخرى بعد لحظة 🙂";
}

// ============================================================
// Layer 1: Domain Lock
// ============================================================
function parseAllowedOrigins(envVal = "") {
  return envVal.split(",").map(v => v.trim()).filter(Boolean);
}

const ALLOWED_ORIGINS = parseAllowedOrigins(process.env.NOVABOT_ALLOWED_ORIGINS || "");
const BLOCK_UNKNOWN_ORIGIN =
  String(process.env.NOVABOT_BLOCK_UNKNOWN_ORIGIN || "true") === "true";

function getRequestOrigin(req) {
  if (req.headers.origin) return req.headers.origin;

  const ref = req.headers.referer;
  if (ref) {
    try {
      return new URL(ref).origin;
    } catch {
      return "";
    }
  }
  return "";
}

function isOriginAllowed(origin) {
  return origin && ALLOWED_ORIGINS.includes(origin);
}

// ============================================================
// Layer 2: Signed Session Token
// ============================================================
const SESSION_SECRET = process.env.NOVABOT_SESSION_SECRET || "";
const REQUIRE_SESSION =
  String(process.env.NOVABOT_REQUIRE_SESSION || "false") === "true";

const SESSION_TTL_MS = 10 * 60 * 1000;

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function sign(payload) {
  return crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function timingSafeEqualStr(a, b) {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function issueSessionToken(origin) {
  const iat = Date.now();
  const exp = iat + SESSION_TTL_MS;
  const nonce = crypto.randomBytes(12).toString("hex");
  const payload = base64url(JSON.stringify({ o: origin, iat, exp, n: nonce }));
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

function verifySessionToken(token, origin) {
  if (!SESSION_SECRET || !token) return { ok: false };
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false };

  const [payload, sig] = parts;
  if (!timingSafeEqualStr(sig, sign(payload))) return { ok: false };

  try {
    const data = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    );
    if (data.o !== origin) return { ok: false };
    if (Date.now() > data.exp) return { ok: false };
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

// ============================================================
// Layer 3: Brain Firewall (Rate + Burst)
// ============================================================
const RATE_LIMIT_PER_MIN = Number(process.env.NOVABOT_RATE_LIMIT_PER_MIN || 30);
const BURST_WINDOW_MS = Number(process.env.NOVABOT_BURST_WINDOW_MS || 3000);
const BURST_MAX = Number(process.env.NOVABOT_BURST_MAX || 5);

const rateStore = new Map(); // origin → timestamps[]

function firewallCheck(origin) {
  const now = Date.now();
  const bucket = rateStore.get(origin) || [];
  const oneMinuteAgo = now - 60_000;

  const recent = bucket.filter(ts => ts > oneMinuteAgo);
  recent.push(now);
  rateStore.set(origin, recent);

  if (recent.length > RATE_LIMIT_PER_MIN) return false;

  const burst = recent.filter(ts => ts > now - BURST_WINDOW_MS);
  if (burst.length > BURST_MAX) return false;

  return true;
}

// ============================================================
// Layer 4: Turnstile Proof
// ============================================================
const REQUIRE_TURNSTILE =
  String(process.env.NOVABOT_REQUIRE_TURNSTILE || "false") === "true";
const TURNSTILE_SECRET = process.env.NOVABOT_TURNSTILE_SECRET || "";

async function verifyTurnstileToken(token, ip = "") {
  if (!REQUIRE_TURNSTILE) return { ok: true, skipped: true };
  if (!TURNSTILE_SECRET) return { ok: false, reason: "missing_secret" };
  if (!token) return { ok: false, reason: "missing_token" };

  try {
    const form = new URLSearchParams();
    form.set("secret", TURNSTILE_SECRET);
    form.set("response", token);
    if (ip) form.set("remoteip", ip);

    const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString()
    });

    const data = await resp.json().catch(() => ({}));
    if (data && data.success) return { ok: true };
    return { ok: false, reason: "not_verified", details: data };
  } catch {
    return { ok: false, reason: "verify_failed" };
  }
}

// ============================================================
// Server
// ============================================================
const PORT = process.env.PORT || 10000;

const server = http.createServer(async (req, res) => {
  const origin = getRequestOrigin(req);

  // ---------- Layer 1 ----------
  if (origin) {
    if (!isOriginAllowed(origin)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false }));
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else if (BLOCK_UNKNOWN_ORIGIN) {
    res.writeHead(403, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: false }));
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-NOVABOT-SESSION, X-NOVABOT-TS-TOKEN"
  );
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  // ---------- GET /session ----------
  if (req.method === "GET" && req.url?.startsWith("/session")) {
    const token = issueSessionToken(origin || "");
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, token, ttl_ms: SESSION_TTL_MS }));
  }

  // ---------- Health ----------
  if (req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, status: "running", time: Date.now() }));
  }

  if (req.method !== "POST") {
    res.writeHead(405);
    return res.end();
  }

  // ---------- Layer 2 ----------
  if (REQUIRE_SESSION) {
    const verdict = verifySessionToken(
      String(req.headers["x-novabot-session"] || ""),
      origin || ""
    );
    if (!verdict.ok) {
      res.writeHead(401, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false }));
    }
  }

  let body = "";
  req.on("data", chunk => (body += chunk));

  req.on("end", async () => {
    try {
      const data = JSON.parse(body || "{}");
      const msg = (data.message || "").trim();
      const lang = detectLang(msg);

      if (!msg) {
        res.writeHead(400);
        return res.end(JSON.stringify({ ok: false }));
      }

      // ---------- Layer 3 ----------
      if (!firewallCheck(origin || "unknown")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: true, reply: softReply(lang) }));
      }

      // ---------- Layer 4 ----------
      // token arrives in header for cleanliness (not in body)
      const tsToken = String(req.headers["x-novabot-ts-token"] || "");
      const ip = (req.socket?.remoteAddress || "").toString();

      const v = await verifyTurnstileToken(tsToken, ip);
      if (!v.ok) {
        // هدوء… لا نصرخ ولا نُرجع 429
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: true, reply: softSecurityReply(lang) }));
      }

      // ---------- Normal flow ----------
      const analysis = await detectNovaIntent(msg);
      const brainReply = await novaBrainSystem({ message: msg, ...analysis });

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          ok: true,
          reply: brainReply.reply,
          actionCard: brainReply.actionCard || null
        })
      );
    } catch (e) {
      console.error("🔥 Server error:", e);
      res.writeHead(500);
      return res.end(JSON.stringify({ ok: false }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 NovaBot Secure Server running on port ${PORT}`);
});
