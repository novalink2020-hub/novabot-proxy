// ===========================================
// NovaBot Mini Server v1 – Secure Build
// Layer 1: Domain Lock (CORS Origin allowlist)
// Layer 2: Signed Session Token (short-lived)
// ===========================================

import http from "http";
import { URL } from "url";
import crypto from "crypto";

// وحدات الذكاء
import { detectNovaIntent } from "./novaIntentDetector.js";
import { novaBrainSystem } from "./novaBrainSystem.js";

// -------------------------------
// تحميل ملف المعرفة V5 عند تشغيل السيرفر
// -------------------------------
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
// Layer 1: Domain Lock
// ============================================================
function parseAllowedOrigins(envVal = "") {
  return envVal
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

const ALLOWED_ORIGINS = parseAllowedOrigins(process.env.NOVABOT_ALLOWED_ORIGINS || "");
const BLOCK_UNKNOWN_ORIGIN = String(process.env.NOVABOT_BLOCK_UNKNOWN_ORIGIN || "true") === "true";

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
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
}

// ============================================================
// Layer 2: Signed Session Token
// ============================================================
const SESSION_SECRET = process.env.NOVABOT_SESSION_SECRET || "";
const REQUIRE_SESSION = String(process.env.NOVABOT_REQUIRE_SESSION || "false") === "true";

// 10 دقائق صلاحية
const SESSION_TTL_MS = 10 * 60 * 1000;

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function signSessionPayload(payloadStr) {
  // HMAC-SHA256
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payloadStr).digest("base64");
  return sig.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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
  // payload: {o, iat, exp, n}
  const iat = Date.now();
  const exp = iat + SESSION_TTL_MS;
  const nonce = crypto.randomBytes(12).toString("hex");

  const payloadObj = { o: origin, iat, exp, n: nonce };
  const payloadStr = JSON.stringify(payloadObj);
  const payloadB64 = base64url(payloadStr);
  const sig = signSessionPayload(payloadB64);

  return `${payloadB64}.${sig}`;
}

function verifySessionToken(token, origin) {
  if (!SESSION_SECRET) return { ok: false, reason: "missing_secret" };
  if (!token || typeof token !== "string") return { ok: false, reason: "missing_token" };

  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "bad_format" };

  const [payloadB64, sig] = parts;
  const expectedSig = signSessionPayload(payloadB64);

  if (!timingSafeEqualStr(sig, expectedSig)) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload;
  try {
    const payloadJson = Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    payload = JSON.parse(payloadJson);
  } catch {
    return { ok: false, reason: "bad_payload" };
  }

  if (!payload || !payload.o || !payload.exp) return { ok: false, reason: "bad_payload_fields" };
  if (payload.o !== origin) return { ok: false, reason: "origin_mismatch" };
  if (Date.now() > Number(payload.exp)) return { ok: false, reason: "expired" };

  return { ok: true };
}

// ============================================================
// إعدادات السيرفر
// ============================================================
const PORT = process.env.PORT || 10000;

const server = http.createServer(async (req, res) => {
  const origin = getRequestOrigin(req);

  // ---------- Layer 1 gate ----------
  if (origin) {
    if (!isOriginAllowed(origin)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: "Access denied (origin not allowed)" }));
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else if (BLOCK_UNKNOWN_ORIGIN) {
    res.writeHead(403, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: false, error: "Access denied (unknown origin)" }));
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-NOVABOT-SESSION");
  res.setHeader("Cache-Control", "no-store");

  // ---------- Preflight ----------
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  // ---------- GET /session ----------
  if (req.method === "GET" && req.url && req.url.startsWith("/session")) {
    if (!SESSION_SECRET) {
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: "Server misconfigured (missing NOVABOT_SESSION_SECRET)" }));
    }

    const token = issueSessionToken(origin || "");
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, token, ttl_ms: SESSION_TTL_MS }));
  }

  // ---------- Health Check (GET /) ----------
  if (req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        ok: true,
        status: "NovaBot Brain running",
        knowledge_loaded: Boolean(novaBrainSystem.knowledgeLoaded),
        layer1_allowed_origins: ALLOWED_ORIGINS,
        layer2_require_session: REQUIRE_SESSION,
        timestamp: Date.now()
      })
    );
  }

  // ---------- POST only ----------
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
  }

  // ---------- Layer 2 gate (Session Token) ----------
  if (REQUIRE_SESSION) {
    const sessionToken = String(req.headers["x-novabot-session"] || "");
    const verdict = verifySessionToken(sessionToken, origin || "");
    if (!verdict.ok) {
      res.writeHead(401, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: "Unauthorized (invalid session)", reason: verdict.reason }));
    }
  }

  // ---------- قراءة الجسم ----------
  let body = "";
  req.on("data", (chunk) => (body += chunk));

  req.on("end", async () => {
    try {
      const data = JSON.parse(body || "{}");
      const userMessage = (data.message || "").trim();

      if (!userMessage) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: "Empty message" }));
      }

      // 1) Intent
      const analysis = await detectNovaIntent(userMessage);

      // 2) Brain
      const brainReply = await novaBrainSystem({
        message: userMessage,
        ...analysis
      });

      // 3) Response
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, reply: brainReply.reply, actionCard: brainReply.actionCard || null }));
    } catch (err) {
      console.error("🔥 Server Error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: "Server error" }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 NovaBot Secure Server running on port ${PORT}`);
  console.log("🔒 Allowed origins:", ALLOWED_ORIGINS);
  console.log("🧾 Require session:", REQUIRE_SESSION);
});
