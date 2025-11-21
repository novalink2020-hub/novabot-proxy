// ===========================================
// NovaBot Mini Server v3 — Production Edition
// By Mohammed Abu Snaina – NOVALINK.AI
// ===========================================

import http from "http";

// وحدات الذكاء
import { detectNovaIntent } from "./novaIntentDetector.js";
import { novaBrainSystem } from "./novaBrainSystem.js";

// -------------------------------
//  إعدادات السيرفر
// -------------------------------
const PORT = process.env.PORT || 10000;

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // -------------------------------
  // Health Check (Render Ping)
  // -------------------------------
  if (req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        ok: true,
        status: "NovaBot Brain running",
        timestamp: Date.now()
      })
    );
  }

  // Preflight
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    return res.end();
  }

  // Only POST
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  // -------------------------------
  // قراءة جسم الرسالة
  // -------------------------------
  let body = "";
  req.on("data", (chunk) => (body += chunk));

  req.on("end", async () => {
    try {
      let data = null;

      try {
        data = JSON.parse(body || "{}");
      } catch (err) {
        console.error("❌ Invalid JSON received:", body);
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: "Invalid JSON" }));
      }

      const userMessage = (data.message || "").trim();

      if (!userMessage) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: "Empty message" }));
      }

      // -------------------------------
      // تحليل النية
      // -------------------------------
      const analysis = await detectNovaIntent(userMessage);

      // -------------------------------
      // الدماغ (مع كل المعلومات)
      // -------------------------------
      const brainReply = await novaBrainSystem({
        message: userMessage,
        ...analysis
      });

      // -------------------------------
      // الرد النهائي
      // -------------------------------
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          ok: true,
          reply: brainReply.reply,
          actionCard: brainReply.actionCard || null
        })
      );
    } catch (err) {
      console.error("🔥 Server Fatal Error:", err);
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
