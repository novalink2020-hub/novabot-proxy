// server-novalink.js
// الخادم الأساسي لدماغ نوفا بوت المخصّص لمدونة نوفا لينك
// متوافق مع واجهة NovaBot v6.9 عبر المسار: POST /api/nova-ai

"use strict";

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const NOVA_CONFIG = require("./nova-config");
const {
  analyzeUserMessage
} = require("./intent-detector");
const {
  findBestMatch,
  getKnowledgeStats,
  ensureKnowledgeLoaded
} = require("./knowledge-engine");
const {
  runAIProviders
} = require("./ai-providers");
const {
  getFallbackReply
} = require("./fallback-replies");

const app = express();
const PORT = process.env.PORT || 3000;

// إعدادات عامة
app.use(cors());
app.use(bodyParser.json({ limit: "1mb" }));

// ==============================
// Health Check بسيط
// ==============================
app.get("/api/health", async (req, res) => {
  try {
    await ensureKnowledgeLoaded();
    const stats = getKnowledgeStats();

    res.json({
      ok: true,
      service: "novabot-novalink",
      knowledge: stats,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: "health_check_failed",
      message: err.message
    });
  }
});

// ==============================
// الدالة المساعدة لقصّ التاريخ
// ==============================
function trimHistory(history = []) {
  const limit =
    NOVA_CONFIG.AI_ENGINE.SAFETY_LIMITS.MAX_HISTORY_MESSAGES || 12;
  if (!Array.isArray(history)) return [];
  if (history.length <= limit) return history;
  return history.slice(history.length - limit);
}

// ==============================
// توليد رد معرفي من مقال
// ==============================
function buildKnowledgeReply(article, language = "ar") {
  if (!article) return null;

  const title = article.title || "مقال من نوفا لينك";
  const url = article.url || NOVA_CONFIG.META.BASE_URL || "#";
  const desc = article.description || "";
