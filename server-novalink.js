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
// ============================================================
// Geo + Privacy helpers (NO raw IP stored)
// ============================================================

function getClientIp(req) {
  const cf = req.headers["cf-connecting-ip"];
  const xff = req.headers["x-forwarded-for"];
  const xri = req.headers["x-real-ip"];

  if (cf) return String(cf).trim();
  if (xff) return String(xff).split(",")[0].trim();
  if (xri) return String(xri).trim();

  // last fallback
  return String(req.socket?.remoteAddress || "").trim();
}

function hashIp(ip) {
  if (!ip) return "";
  const salt = process.env.IP_HASH_SALT || "";
  if (!salt) return ""; // إذا لم تضع SALT لن نرسل hash (أفضل من تخزين شيء ضعيف)
  return crypto.createHash("sha256").update(ip + "|" + salt).digest("hex");
}

async function getGeo(req, ip) {
  // نبدأ بقيم افتراضية
  const out = { country: "", region: "", city: "" };

  // 1) Cloudflare country header (zero-cost)
  const cfCountry = req.headers["cf-ipcountry"];
  if (cfCountry && String(cfCountry).trim() && String(cfCountry).trim() !== "XX") {
    out.country = String(cfCountry).trim();
  }

  // 2) Optional: ipinfo for region/city (only if token exists)
  const token = process.env.IPINFO_TOKEN || "";
  if (!token || !ip) return out;

  try {
    const r = await fetch(
      `https://ipinfo.io/${encodeURIComponent(ip)}?token=${encodeURIComponent(token)}`
    );
    const j = await r.json().catch(() => ({}));

    // بعض الحالات ipinfo يرجع bogon للـ private/local IP
    if (j && j.bogon) return out;

    // عبّي region/city إن وجدت
    if (j?.region) out.region = String(j.region);
    if (j?.city) out.city = String(j.city);

    // إذا لم يأت country من Cloudflare، خذه من ipinfo
    if (!out.country && j?.country) out.country = String(j.country);

    return out;
  } catch {
    return out;
  }
}

function isHighIntent(rawIntentId) {
  return rawIntentId === "consulting_purchase" || rawIntentId === "collaboration";
}

function getEmailFromCtx(ctx) {
  const v = String(ctx?.email || ctx?.contact_email || "").trim().toLowerCase();
  return v;
}


// AI modules
import { detectNovaIntent } from "./novaIntentDetector.js";
import { novaBrainSystem } from "./novaBrainSystem.js";
// Business Profile (Read-Only)
import NovaLinkBusinessProfile, {
  normalizeIntentForSales
} from "./businessProfiles/novalink.profile.js";

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
      (novaBrainSystem &&
        typeof novaBrainSystem.loadKnowledgeFromURL === "function")
        ? novaBrainSystem.loadKnowledgeFromURL
        : null;

    if (!loaderFn) {
      console.log(
        "ℹ️ novaBrainSystem.loadKnowledgeFromURL not found — skipping knowledge preload."
      );
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

const ALLOWED_ORIGINS = parseAllowedOrigins(
  process.env.NOVABOT_ALLOWED_ORIGINS || ""
);
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

    const resp = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString()
      }
    );

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
// Google Sheets Webhook (Lead Store – Step GS-1)
// ============================================================
const GOOGLE_SHEETS_WEBHOOK =
  process.env.GOOGLE_SHEETS_WEBHOOK || "";

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
// ============================================================
// Public Session Id (Short) – for dashboard / sheets later
// ============================================================
// maps internal sessionKey (token/anonymous) => short id like S-1, S-2 ...
const sessionPublicIdStore = new Map();
let sessionPublicCounter = 0;

function getPublicSessionId(sessionKey) {
  if (!sessionKey) return "S-0";
  const existing = sessionPublicIdStore.get(sessionKey);
  if (existing) return existing;
  sessionPublicCounter += 1;
  const shortId = `S-${sessionPublicCounter}`;
  sessionPublicIdStore.set(sessionKey, shortId);
  return shortId;
}

function getSessionKey(req) {
  return String(req.headers["x-novabot-session"] || "").trim() || "anonymous";
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

// ============================================================
// Lead contact normalization (server-side, tolerant)
// ============================================================
function isProbablyEmail(v = "") {
  const s = String(v || "").trim();
  if (!s) return false;
  // basic but practical
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function isProbablyPhone(v = "") {
  const s = String(v || "").trim();
  if (!s) return false;
  // accept +, digits, spaces, dashes, parentheses; ensure enough digits
  const digits = s.replace(/[^\d]/g, "");
  if (digits.length < 7) return false;
  return /^[+\d][\d\s\-()]{6,}$/.test(s);
}
// ============================================================
// Send Lead to Google Sheets (non-blocking)
// ============================================================
async function sendLeadToGoogleSheets(payload) {
  if (!GOOGLE_SHEETS_WEBHOOK) return;

  try {
    await fetch(GOOGLE_SHEETS_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.warn("⚠️ Failed to send lead to Google Sheets");
  }
}

function extractContact(data) {
  const c = (data && data.contact) ? data.contact : {};
  const emailDirect = String(c.email || "").trim();
  const phoneDirect = String(c.phone || "").trim();
  const value = String(c.value || "").trim();

  const emailFromValue = !emailDirect && isProbablyEmail(value) ? value : "";
  const phoneFromValue = !phoneDirect && isProbablyPhone(value) ? value : "";

  return {
    email: emailDirect || emailFromValue || "",
    phone: phoneDirect || phoneFromValue || "",
    value: value || ""
  };
}

const server = http.createServer(async (req, res) => {
  const origin = getRequestOrigin(req);

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

    req.on("end", async () => {
      try {
        const data = JSON.parse(body || "{}");
        // Geo + ip_hash (privacy-safe)
const clientIp = getClientIp(req);
const ipHash = hashIp(clientIp);
const geo = await getGeo(req, clientIp);


        // ===============================
        // Step 5.1 — Bind Lead to Session
        // ===============================

        // 1) Session ID الداخلي (S-1, S-2...)
        let sessionKey = getSessionKey(req);
        if (
          sessionKey === "anonymous" &&
          typeof data?.conversation_context?.session_id === "string" &&
          data.conversation_context.session_id.trim() &&
          data.conversation_context.session_id.trim() !== "anonymous"
        ) {
          sessionKey = data.conversation_context.session_id.trim();
        }

        // normalize contact (handles contact.value for consultation)
        const contact = extractContact(data);

        // 2) تحديث Session Context ببيانات التواصل (Step 5.1.5)
        const contactPatch = {};

if (contact.email) {
  contactPatch.contact_email = contact.email;
  contactPatch.email = String(contact.email).trim().toLowerCase(); // مهم للترقية لاحقًا
}

// خزّن الصفحة الحالية (لتحديث الشيت لاحقًا بشكل أدق)
if (data?.user_context?.page_url) {
  contactPatch.page_url = data.user_context.page_url;
}

// خزّن geo/ip_hash في السياق (بدون IP خام)
contactPatch.country = geo.country || "";
contactPatch.region = geo.region || "";
contactPatch.city = geo.city || "";
contactPatch.ip_hash = ipHash || "";


        if (contact.phone) {
          contactPatch.contact_phone = contact.phone;
        }

        if (data?.card_id) {
          contactPatch.last_action_card = data.card_id;
        }

        // نحدّث الجلسة فورًا
        const sessionContext = updateSessionContext(sessionKey, contactPatch) || {};

        // 3) دمج بيانات الـ Lead مع السياق
        const isConsultationLead = data.action === "حجز_استشارة";
        const storedEmail = isConsultationLead
          ? (contact.email || contact.value || "")
          : (contact.email || "");
        const contactType = contact.email ? "email" : "phone";

        const leadWithContext = {
          session_id: getPublicSessionId(sessionKey),

          event_type: data.event_type,
          action: data.action,
          card_id: data.card_id,

          email: storedEmail,
          contact_type: contactType,
          page: data?.user_context?.page_url || "",
          device: data?.user_context?.device || "",
          language: data?.user_context?.language || "ar",

          // من Session Context (عربي بالكامل)
          intent: sessionContext.intent || "غير_محدد",
          stage: sessionContext.stage || "غير_واضح",
          temperature: sessionContext.temperature || "بارد",
          interest: sessionContext.interest || null,
          business_id: sessionContext.business_id || null,
          last_message: sessionContext.last_user_message || null,

          timestamp: data?.meta?.timestamp || Date.now()
        };

        // 4) Log موحّد — هذا هو الأساس للـ Google Sheets لاحقًا
        console.log("📥 [LEAD EVENT LINKED TO SESSION]", leadWithContext);
        // ============================================================
// Flush pending high-intent if it existed before email arrived
// ============================================================
try {
  const ctxNow = getSessionContext(sessionKey) || {};
  const emailNow = getEmailFromCtx(ctxNow);

  if (ctxNow.pending_lead_push === true && emailNow) {
    // أرسل تحديث ترقية الليد (سيصعد للصف 2 عبر Apps Script)
    sendLeadToGoogleSheets({
      session_id: getPublicSessionId(sessionKey),
      email: emailNow,
      page_url: String(ctxNow.page_url || leadWithContext.page || ""),
      intent: String(ctxNow.intent || leadWithContext.intent || ""),
      stage: String(ctxNow.stage || leadWithContext.stage || ""),
      temperature: String(ctxNow.temperature || leadWithContext.temperature || ""),
      interest: String(ctxNow.interest || leadWithContext.interest || ""),
      business: String(ctxNow.business_id || leadWithContext.business_id || ""),
      last_message: String(ctxNow.last_user_message || leadWithContext.last_message || ""),

      country: String(ctxNow.country || geo.country || ""),
      region: String(ctxNow.region || geo.region || ""),
      city: String(ctxNow.city || geo.city || ""),
      ip_hash: String(ctxNow.ip_hash || ipHash || "")
    });

    // امسح pending حتى لا تتكرر
    updateSessionContext(sessionKey, {
      pending_lead_push: false,
      pending_reason: ""
    });

    console.log("✅ [PENDING HIGH-INTENT FLUSHED TO SHEET]", { session: getPublicSessionId(sessionKey) });
  }
} catch {
  // لا نكسر الواجهة
}

        // Step GS-1: send only subscription leads to Google Sheets
if (
  leadWithContext.card_id === "subscribe" ||
  leadWithContext.card_id === "business_subscribe"
) {
sendLeadToGoogleSheets({
  session_id: leadWithContext.session_id,
  timestamp: new Date(leadWithContext.timestamp).toISOString(),

  email: leadWithContext.email,
  page_url: leadWithContext.page,

  intent: leadWithContext.intent,
  stage: leadWithContext.stage,
  temperature: leadWithContext.temperature,
  interest: leadWithContext.interest,
  business: leadWithContext.business_id,
  last_message: leadWithContext.last_message,

  // NEW: geo + ip_hash
  country: geo.country || "",
  region: geo.region || "",
  city: geo.city || "",
  ip_hash: ipHash || ""
});
}

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

    req.on("end", async () => {
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
    const verdict = verifySessionToken(
      String(req.headers["x-novabot-session"] || ""),
      origin || ""
    );
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

      // ============================================================
      // Step 4A.4 — Map Intent → Business Signals (Arabic)
      // ============================================================

      const sessionKey =
        getSessionKey(req) || data?.conversation_context?.session_id || "anonymous";
      const publicSessionId = getPublicSessionId(sessionKey);

      // Normalize sales fields using the official business profile map
      const sales = normalizeIntentForSales(ACTIVE_BUSINESS_PROFILE, analysis);
      
// Geo + ip_hash (privacy-safe) — used for sheet enrichment
const clientIp2 = getClientIp(req);
const ipHash2 = hashIp(clientIp2);
const geo2 = await getGeo(req, clientIp2);

      // Build a clean “session context” snapshot (Arabic)
      const ctx = updateSessionContext(sessionKey, {
        
        // IDs
        session_id: publicSessionId,
        business_id: sales.business_id,

        // Message + language
        language: lang,
        last_user_message: msg,

        // Raw + mapped intent
        raw_intent_id: sales.raw_intent_id,
        intent: sales.intent, // عربي
        stage: sales.stage, // عربي
        temperature: sales.temperature, // عربي
        interest: sales.interest, // interest id (مثل knowledge_subscription)

        // Optional helper
        suggested_card: sales.suggested_card || null,

        // Confidence
       confidence: analysis?.confidence || null,

// NEW: geo + privacy (no raw IP)
country: geo2.country || "",
region: geo2.region || "",
city: geo2.city || "",
ip_hash: ipHash2 || "",

// NEW: pending high-intent push control
pending_lead_push: false,
pending_reason: ""

      });

      console.log("🧠 [SESSION CONTEXT UPDATED]", {
        session: publicSessionId,
        business: sales.business_id,
        intent: sales.intent,
        stage: sales.stage,
        temperature: sales.temperature,
        interest: sales.interest
      });
// ============================================================
// High-intent lead upgrade → push to Google Sheets (SAFE)
// Rule: NEVER push without email (prevents session collision).
// If missing email, store pending and flush when email arrives via /lead-event.
// ============================================================
try {
  if (isHighIntent(sales.raw_intent_id)) {
    const emailNow = getEmailFromCtx(ctx);

    if (!emailNow) {
      // لا نرسل بدون email — نخزن pending
      updateSessionContext(sessionKey, {
        pending_lead_push: true,
        pending_reason: sales.raw_intent_id
      });

      console.log("🕒 [HIGH-INTENT PENDING — NO EMAIL YET]", {
        session: publicSessionId,
        reason: sales.raw_intent_id
      });
    } else {
      // Send upgrade now
      sendLeadToGoogleSheets({
        session_id: publicSessionId,
        email: emailNow,
        page_url: String(ctx.page_url || ""),
        intent: String(sales.intent || ctx.intent || ""),
        stage: String(sales.stage || ctx.stage || ""),
        temperature: String(sales.temperature || ctx.temperature || ""),
        interest: String(sales.interest || ctx.interest || ""),
        business: String(sales.business_id || ctx.business_id || ""),
        last_message: String(ctx.last_user_message || ""),

        country: String(ctx.country || ""),
        region: String(ctx.region || ""),
        city: String(ctx.city || ""),
        ip_hash: String(ctx.ip_hash || "")
      });

      // clear any pending, just in case
      updateSessionContext(sessionKey, {
        pending_lead_push: false,
        pending_reason: ""
      });

      console.log("📌 [HIGH-INTENT PUSHED TO SHEET]", {
        session: publicSessionId,
        intent: sales.raw_intent_id
      });
    }
  }
} catch {
  // لا نكسر الرد للمستخدم
}

      const brainReply = await novaBrainSystem({ message: msg, ...analysis });

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          ok: true,
          reply: brainReply?.reply || "",
          actionCard: brainReply?.actionCard || null,
          session_context: ctx
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
