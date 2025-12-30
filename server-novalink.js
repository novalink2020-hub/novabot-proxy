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
// Business Profile (Read-Only)
import NovaLinkBusinessProfile from "./businessProfiles/novalink.profile.js";


// -------------------------------------------
// Load Knowledge V5 on boot (SAFE / OPTIONAL)
// -------------------------------------------
const KNOWLEDGE_URL = process.env.KNOWLEDGE_V5_URL || "";

// نحاول تحميل المعرفة فقط إذا كان الدماغ يدعم ذلك فعلاً
(async () => {
  try {
    if (!KNOWLEDGE_URL) {
      console.log("ℹ️ KNOWLEDGE_V5_URL is not set — skipping knowledge preload.");
      return;
    }

    const loaderFn =
      (novaBrainSystem && typeof novaBrainSystem.loadKnowledgeFromURL === "function")
        ? novaBrainSystem.loadKnowledgeFromURL
        : null;

    if (!loaderFn) {
      console.log("ℹ️ novaBrainSystem.loadKnowledgeFromURL not found — skipping knowledge preload.");
      return;
    }

    console.log("📚 Loading Nova Knowledge V5...");
    await loaderFn.call(novaBrainSystem, KNOWLEDGE_URL);
    console.log("✅ Knowledge V5 loaded successfully!");
  } catch (err) {
    console.error("❌ Failed to load knowledge (non-fatal):", err);
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
  return envVal.split(",").map((v) => v.trim()).filter(Boolean);
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
  return origin && ALLOWED_ORIGINS.includes(origin);
}

// ============================================================
// Layer 2: Signed Session Token
// ============================================================
const SESSION_SECRET = process.env.NOVABOT_SESSION_SECRET || "";
const REQUIRE_SESSION = String(process.env.NOVABOT_REQUIRE_SESSION || "false") === "true";

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

const rateStore = new Map(); // key → timestamps[]
function firewallKey(origin, req) {
  // الأصل + UA يعطيك ثبات أفضل على الموبايل/متصفحات مختلفة
  const ua = String(req.headers["user-agent"] || "").slice(0, 80);
  return `${origin || "unknown"}|${ua}`;
}

function firewallCheck(key) {
  const now = Date.now();
  const bucket = rateStore.get(key) || [];
  const oneMinuteAgo = now - 60_000;

  const recent = bucket.filter((ts) => ts > oneMinuteAgo);
  recent.push(now);
  rateStore.set(key, recent);

  if (recent.length > RATE_LIMIT_PER_MIN) return false;

  const burst = recent.filter((ts) => ts > now - BURST_WINDOW_MS);
  if (burst.length > BURST_MAX) return false;

  return true;
}

// ============================================================
// Layer 4: Turnstile Proof
// ============================================================
const REQUIRE_TURNSTILE = String(process.env.NOVABOT_REQUIRE_TURNSTILE || "false") === "true";
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
// ============================================================
// Active Business Profile (Read-Only)
// ============================================================
const ACTIVE_BUSINESS_PROFILE = NovaLinkBusinessProfile;

// ============================================================
// Session Context Store (In-Memory) – Step 4A.1
// ============================================================
// key: session_id (X-NOVABOT-SESSION or fallback)
// value: last known conversation context
const sessionContextStore = new Map();

function getSessionKey(req) {
  return (
    String(req.headers["x-novabot-session"] || "").trim() ||
    "anonymous"
  );
}

function updateSessionContext(sessionKey, patch = {}) {
  const prev = sessionContextStore.get(sessionKey) || {};
  const next = {
    ...prev,
    ...patch,
    updated_at: Date.now()
  };
  sessionContextStore.set(sessionKey, next);
  return next;
}

function getSessionContext(sessionKey) {
  return sessionContextStore.get(sessionKey) || null;
}


const server = http.createServer(async (req, res) => {
  const origin = getRequestOrigin(req);

  // ============================================================
// Lead Enrichment Helper (Step 4A.4)
// ============================================================
function enrichLeadEvent(rawLead, sessionContext, businessProfile) {
  if (!sessionContext || !businessProfile) {
    return rawLead;
  }

  const intentId = sessionContext.last_intent;
  const intentMap = businessProfile.intent_sales_map || {};
  const fallback = businessProfile.defaults || {};

  const mapped = intentMap[intentId] || fallback;

  return {
    ...rawLead,

    business: businessProfile.profile_id,

    sales_context: {
      interest: mapped.interest_type_ar || null,
      stage: mapped.lead_stage_ar || null,
      temperature: mapped.lead_temperature_ar || null,
      intent: mapped.intent_ar || intentId || null
    },

    conversation_context: {
      last_message: sessionContext.last_user_message || null,
      confidence: sessionContext.confidence || null,
      topics: sessionContext.topics || []
    }
  };
}


  // ---------- Layer 1 ----------
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-NOVABOT-SESSION, X-NOVABOT-TS-TOKEN");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }
    // ---------- Lead Event (UI) ----------
  if (req.method === "POST" && req.url === "/lead-event") {
    let body = "";

    req.on("data", (chunk) => (body += chunk));

    req.on("end", () => {
      try {
        const data = JSON.parse(body || "{}");

        // Log منظم — جاهز للداشبورد / Sheets لاحقًا
const sessionKey =
  data?.conversation_context?.session_id ||
  getSessionKey(req);

const sessionContext = getSessionContext(sessionKey);

const enrichedLead = enrichLeadEvent(
  {
    event_type: data.event_type,
    action: data.action,
    card_id: data.card_id,
    contact: data.contact || {},
    user_context: data.user_context || {},
    meta: data.meta || {}
  },
  sessionContext,
  ACTIVE_BUSINESS_PROFILE
);

console.log("📥 [LEAD EVENT ENRICHED]", enrichedLead);

      } catch (e) {
        console.warn("⚠️ Lead event parse error");
      }

      // نعيد OK دائمًا — لا نكسر الواجهة
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true }));
    });

    return;
  }


  // ---------- GET /session ----------
  if (req.method === "GET" && req.url?.startsWith("/session")) {
    const token = issueSessionToken(origin || "");
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, token, ttl_ms: SESSION_TTL_MS }));
  }
  // ---------- Telemetry (Frontend Loader) ----------
  if (req.method === "POST" && req.url === "/telemetry") {
    let body = "";

    req.on("data", (chunk) => (body += chunk));

    req.on("end", () => {
      try {
        const data = JSON.parse(body || "{}");

        console.log("📡 [TELEMETRY]", {
          source: data.source || "unknown",
          stage: data.stage,
          status: data.status,
          ts: data.ts,
          extra: data.extra || null
        });
      } catch (e) {
        console.warn("⚠️ Telemetry parse error");
      }

      // نعيد 200 دائمًا — لا نكسر الواجهة أبدًا
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true }));
    });

    return;
  }
// ---------- Debug: Session Context ----------
if (req.method === "GET" && req.url?.startsWith("/debug/session")) {
  const key = getSessionKey(req);
  res.writeHead(200, { "Content-Type": "application/json" });
  return res.end(
    JSON.stringify({
      ok: true,
      session: key,
      context: getSessionContext(key)
    })
  );
}

  
  // ---------- Health ----------
  if (req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        ok: true,
        status: "running",
        time: Date.now(),
        require_turnstile: REQUIRE_TURNSTILE,
        require_session: REQUIRE_SESSION,
        allowed_origins: ALLOWED_ORIGINS
      })
    );
  }

  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
  }

  // ---------- Layer 2 ----------
  if (REQUIRE_SESSION) {
    const verdict = verifySessionToken(String(req.headers["x-novabot-session"] || ""), origin || "");
    if (!verdict.ok) {
      res.writeHead(401, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: "Unauthorized (invalid session)" }));
    }
  }

  // ---------- Body ----------
  let body = "";
  req.on("data", (chunk) => (body += chunk));

  req.on("end", async () => {
    try {
      const data = JSON.parse(body || "{}");
      const msg = (data.message || "").trim();
      const lang = detectLang(msg);

      if (!msg) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: "Empty message" }));
      }

      // ---------- Layer 3 ----------
      const fwKey = firewallKey(origin || "unknown", req);
      if (!firewallCheck(fwKey)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: true, reply: softReply(lang) }));
      }

      // ---------- Layer 4 ----------
      const tsToken = String(req.headers["x-novabot-ts-token"] || "");
      const ip = String(req.socket?.remoteAddress || "");
      const v = await verifyTurnstileToken(tsToken, ip);

      if (!v.ok) {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: true, reply: softSecurityReply(lang) }));
      }

      // ---------- Normal flow ----------
      const analysis = await detectNovaIntent(msg);
      console.log("🔍 [INTENT RAW OUTPUT]", analysis);

      // ---- Update Session Context (Intent / Topics) ----
const sessionKey = getSessionKey(req);

updateSessionContext(sessionKey, {
  business_profile_id: ACTIVE_BUSINESS_PROFILE.profile_id,
  language: lang,
  last_user_message: msg,
  last_intent: analysis?.intent || "غير_معروف",
  topics: analysis?.topics || [],
  confidence: analysis?.confidence || null
});

console.log("🧠 [SESSION CONTEXT UPDATED]", {
  session: sessionKey,
  business: ACTIVE_BUSINESS_PROFILE.profile_id,
  intent: analysis?.intent,
  topics: analysis?.topics
});


      const brainReply = await novaBrainSystem({ message: msg, ...analysis });

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          ok: true,
          reply: brainReply?.reply || "",
          actionCard: brainReply?.actionCard || null
        })
      );
    } catch (e) {
      console.error("🔥 Server error:", e);
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: "Server error" }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 NovaBot Secure Server running on port ${PORT}`);
});
