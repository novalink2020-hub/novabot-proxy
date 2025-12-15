// ===========================================
// NovaBot Mini Server v1 – Secure Build
// Domain Locked + Intent → Brain → Response
// ===========================================

import http from "http";
import { URL } from "url";

// وحدات الذكاء
import { detectNovaIntent } from "./novaIntentDetector.js";
import { novaBrainSystem } from "./novaBrainSystem.js";

// ============================================================
// تحميل ملف المعرفة V5 عند تشغيل السيرفر
// ============================================================
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
// Domain Lock – Layer 1 (Critical Security Layer)
// ============================================================

function parseAllowedOrigins(envVal = "") {
  return envVal
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);
}

const ALLOWED_ORIGINS = parseAllowedOrigins(
  process.env.NOVABOT_ALLOWED_ORIGINS || ""
);

const BLOCK_UNKNOWN_ORIGIN =
  String(process.env.NOVABOT_BLOCK_UNKNOWN_ORIGIN || "true") === "true";

function getRequestOrigin(req) {
  // 1) Origin (أفضل)
  if (req.headers.origin) return req.headers.origin;

  // 2) Referer (fallback)
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
// إعدادات السيرفر
// ============================================================
const PORT = process.env.PORT || 10000;

const server = http.createServer(async (req, res) => {
  const origin = getRequestOrigin(req);

  // ============================================================
  // Domain Lock Check (قبل أي شيء)
  // ============================================================
  if (origin) {
    if (!isOriginAllowed(origin)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          ok: false,
          error: "Access denied (origin not allowed)"
        })
      );
    }

    // CORS فقط للدومين المسموح
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else if (BLOCK_UNKNOWN_ORIGIN) {
    // لا Origin ولا Referer → نمنع
    res.writeHead(403, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        ok: false,
        error: "Access denied (unknown origin)"
      })
    );
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ============================================================
  // Health Check (GET /)
  // ============================================================
  if (req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        ok: true,
        status: "NovaBot Brain running",
        knowledge_loaded: Boolean(novaBrainSystem.knowledgeLoaded),
        timestamp: Date.now()
      })
    );
  }

  // ============================================================
  // Preflight (CORS)
  // ============================================================
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  // ============================================================
  // API – POST only
  // ============================================================
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
  }

  // ============================================================
  // قراءة جسم الطلب
  // ============================================================
  let body = "";
  req.on("data", chunk => (body += chunk));

  req.on("end", async () => {
    try {
      const data = JSON.parse(body || "{}");
      const userMessage = (data.message || "").trim();

      if (!userMessage) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: "Empty message" }));
      }

      // 1) تحليل النية
      const analysis = await detectNovaIntent(userMessage);

      // 2) تمرير للدماغ
      const brainReply = await novaBrainSystem({
        message: userMessage,
        ...analysis
      });

      // 3) إرسال الرد
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          ok: true,
          reply: brainReply.reply,
          actionCard: brainReply.actionCard || null
        })
      );
    } catch (err) {
      console.error("🔥 Server Error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: "Server error" }));
    }
  });
});

// ============================================================
// تشغيل السيرفر
// ============================================================
server.listen(PORT, () => {
  console.log(`🚀 NovaBot Secure Server running on port ${PORT}`);
  console.log("🔒 Allowed origins:", ALLOWED_ORIGINS);
});
