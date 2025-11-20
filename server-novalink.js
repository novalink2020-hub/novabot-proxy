// server-novalink.js
// NovaBot – NovaLink AI Server
"use strict";

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const NOVA_CONFIG = require("./nova-config");
const { runAIProviders } = require("./ai-providers");
const {
  ensureKnowledgeLoaded,
  findBestMatch,
  getKnowledgeStats
} = require("./knowledge-engine");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Debug: Show server start
console.log("[NovaBot-NovaLink] Booting server...");

// ========================
// 🔍 مسار الفحص الجديد
// ========================
app.get("/api/vars", (req, res) => {
  res.json({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ? "FOUND" : "NOT FOUND",
    CF_AI_API_KEY: process.env.CF_AI_API_KEY ? "FOUND" : "NOT FOUND",
    CF_ACCOUNT_ID: process.env.CF_ACCOUNT_ID ? "FOUND" : "NOT FOUND",
    NODE_ENV: process.env.NODE_ENV || "undefined"
  });
});

// ========================
// Health Check
// ========================
app.get("/api/health", async (req, res) => {
  const stats = getKnowledgeStats();
  res.json({
    ok: true,
    service: "NovaBot-NovaLink",
    knowledge: stats,
    timestamp: new Date().toISOString()
  });
});

// ========================
// Main API – NovaBot brain
// ========================
app.post("/api/nova-ai", async (req, res) => {
  try {
    const userMessage =
      req.body?.message ||
      req.body?.question ||
      "";

    const history = Array.isArray(req.body?.history)
      ? req.body.history
      : [];

    const language = req.body?.locale === "en" ? "en" : "ar";

    // 1) ضمان تحميل المعرفة
    await ensureKnowledgeLoaded();

    // 2) أفضل مطابقة في المعرفة
    const knowledgeResult = await findBestMatch(userMessage);
    const bestMatch = knowledgeResult.bestMatch;
    const similarityScore = knowledgeResult.score;

    // 3) نحضر رد الذكاء الاصطناعي
    const aiResult = await runAIProviders(userMessage, language);

    // تجهيز الرد
    let finalReply = "";
    let actionCard = null;

    // --- قواعد الدمج ---
    if (bestMatch && similarityScore >= 0.25) {
      // رد قائم على المحتوى + AI
      finalReply += `🔗 مقالة قريبة من سؤالك من نوفا لينك:\n\n`;
      finalReply += `${bestMatch.title}\n\n`;
      finalReply += `رابط القراءة:\n${bestMatch.url}\n\n`;

      if (aiResult?.answer) {
        finalReply += `\n\n—\nإليك فكرة إضافية من نوفا بوت:\n${aiResult.answer}`;
      }
    } else {
      // لا يوجد تطابق – نعتمد على AI فقط
      finalReply =
        aiResult?.answer ||
        "لا أجد مقالًا مطابقًا… ولكن يمكنني التفكير معك بخط مبدئي نبني عليه.";
    }

    // تحليل مسار البطاقات
    const textLower = userMessage.toLowerCase();

    if (textLower.includes("اشترك") || textLower.includes("النشرة")) {
      actionCard = "subscribe";
    }
    if (textLower.includes("خدمة") || textLower.includes("خدمات")) {
      actionCard = "business_subscribe";
    }
    if (textLower.includes("بوت") || textLower.includes("دردشة")) {
      actionCard = "bot_lead";
    }
    if (textLower.includes("شراكة") || textLower.includes("تعاون")) {
      actionCard = "collaboration";
    }

    return res.json({
      ok: true,
      reply: finalReply,
      actionCard
    });
  } catch (err) {
    console.error("❌ Server Error:", err.message);
    return res.status(500).json({
      ok: false,
      reply: "حدث خطأ غير متوقع. سيتم التحقيق فيه."
    });
  }
});

// ========================
// Start Server
// ========================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(
    `[NovaBot-NovaLink] Server started on port ${PORT} — Ready at /api/nova-ai`
  );
});
