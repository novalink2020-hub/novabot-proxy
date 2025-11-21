// ===========================================
// NovaBot Mini Server v1
// يعمل كجسر بسيط: واجهة → نوايا → دماغ → واجهة
// ===========================================

import http from "http";
import url from "url";

// استدعاء وحدات الذكاء
import { detectNovaIntent } from "./novaIntentDetector.js";
import { novaBrainSystem } from "./novaBrainSystem.js";

// -------------------------------
//  إعدادات السيرفر
// -------------------------------
const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  // إعداد الـ CORS للواجهة
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    return res.end();
  }

  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  // قراءة الـ JSON
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const data = JSON.parse(body || "{}");
      const userMessage = data.message || "";

      if (!userMessage.trim()) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Empty message" }));
      }

      // ===========================================
      // 1) تحليل اللغة + اللهجة + النية
      // ===========================================
      const analysis = await detectNovaIntent(userMessage);

      // ===========================================
      // 2) إرسال النص + التحليل إلى الدماغ الجديد
      // ===========================================
      const brainReply = await novaBrainSystem({
        userMessage,
        analysis
      });

      // brainReply يحتوي:
      // { reply, actionCard }

      // ===========================================
      // 3) إعادة الرد إلى الواجهة
      // ===========================================
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
