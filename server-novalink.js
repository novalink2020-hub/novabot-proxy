// ===========================================
// NovaBot Mini Server v1 – Advanced Build
// جسر بين الواجهة → النوايا → الدماغ → الرد
// ===========================================

import http from "http";

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

// -------------------------------
//  إعدادات السيرفر
// -------------------------------
const PORT = process.env.PORT || 10000;

const server = http.createServer(async (req, res) => {
  // إعداد الـ CORS للواجهة
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // -------------------------------
  // Health Check (GET /)
  // -------------------------------
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

  // -------------------------------
  // Preflight (CORS)
  // -------------------------------
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    return res.end();
  }

  // -------------------------------
  // API must be POST only
  // -------------------------------
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  // -------------------------------
  // قراءة جسم الطلب
  // -------------------------------
  let body = "";
  req.on("data", (chunk) => (body += chunk));

  req.on("end", async () => {
    try {
      const data = JSON.parse(body || "{}");
      const userMessage = (data.message || "").trim();

      if (!userMessage) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Empty message" }));
      }

      // 1) تحليل النية + اللغة + اللهجة
      const analysis = await detectNovaIntent(userMessage);

      // 2) إرسال كل شيء للدماغ
      const brainReply = await novaBrainSystem({
        message: userMessage,
        ...analysis
      });

      // 3) إرسال الرد النهائي للواجهة
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

// -------------------------------
// تشغيل السيرفر
// -------------------------------
server.listen(PORT, () => {
  console.log(`🚀 NovaBot Mini Server running on port ${PORT}`);
});
