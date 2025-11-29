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

const HEALTH_PATHS = new Set(["/", "/health", "/status"]);
const MAX_BODY_SIZE = 1_000_000; // ~1MB safety limit

const normalizePath = (rawPath = "") => {
  const [pathOnly] = rawPath.split("?");
  if (!pathOnly) return "/";

  if (pathOnly === "/") return "/";

  const trimmed = pathOnly.replace(/\/+$/, "");
  return trimmed || "/";
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
  if (req.method === "GET" || req.method === "HEAD") {
    const pathOnly = normalizePath(req.url || "");

    if (pathOnly === "/favicon.ico") {
      res.writeHead(204);
      return res.end();
    }

    if (HEALTH_PATHS.has(pathOnly)) {
      res.writeHead(200, { "Content-Type": "application/json" });
      const payload = {
        ok: true,
        status: "NovaBot Brain running",
        timestamp: Date.now()
      };
      return res.end(req.method === "HEAD" ? undefined : JSON.stringify(payload));
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Not found" }));
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
  const chunks = [];
  let totalBytes = 0;
  let tooLarge = false;

  req.on("data", (chunk) => {
    if (tooLarge) return;

    totalBytes += chunk.length;
    if (totalBytes > MAX_BODY_SIZE) {
      tooLarge = true;
      res.writeHead(413, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Payload too large" }));
      req.destroy();
      return;
    }

    chunks.push(chunk);
  });

  req.on("end", async () => {
    if (tooLarge) return;

    let data;

    try {
      const body = Buffer.concat(chunks).toString() || "{}";
      data = JSON.parse(body);
    } catch (parseErr) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Invalid JSON" }));
    }

    try {
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
