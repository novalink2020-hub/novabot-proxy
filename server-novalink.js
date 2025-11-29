// ===========================================================
// NovaBot Mini Server PRO v1.0
// خادم بسيط يعتمد على router.js لاتخاذ كل القرارات
// ===========================================================

import http from "http";
import { routeNovaRequest } from "./router.js";

// -----------------------------
// إعدادات CORS
// -----------------------------
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type"
};

// -----------------------------
// تهيئة السيرفر
// -----------------------------
const PORT = process.env.PORT || 10000;

const server = http.createServer(async (req, res) => {
  // إضافة CORS
  Object.entries(CORS_HEADERS).forEach(([k, v]) => {
    res.setHeader(k, v);
  });

  // Health Check
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

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    return res.end();
  }

  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  // قراءة البودي
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

      // ندخل على الراوتر الذكي
      const replyObj = await routeNovaRequest(req, userMessage);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(replyObj));
    } catch (err) {
      console.error("🔥 Server Error:", err.message);

      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          ok: false,
          error: "Server error"
        })
      );
    }
  });
});

// تشغيل السيرفر
server.listen(PORT, () => {
  console.log(`🚀 NovaBot Mini Server PRO running on port ${PORT}`);
});
