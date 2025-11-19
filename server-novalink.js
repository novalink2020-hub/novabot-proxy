// server-novalink.js
// الخادم الأساسي لدماغ نوفا بوت — نسخة مخصصة لموقع نوفا لينك فقط

"use strict";

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const NOVA_CONFIG = require("./nova-config");
const { analyzeUserMessage } = require("./intent-detector");
const {
  findBestMatch,
  ensureKnowledgeLoaded,
  getKnowledgeStats
} = require("./knowledge-engine");
const { runAIProviders } = require("./ai-providers");
const { getFallbackReply } = require("./fallback-replies");
const { handleNewLead } = require("./leads-handler");

const app = express();
// Render يحدد المنفذ عبر متغير PORT
const PORT = process.env.PORT || 3000;

// ==============================
// MIDDLEWARES
// ==============================
app.use(cors());
app.use(bodyParser.json({ limit: "1mb" }));

// ==============================
// HEALTH CHECK
// ==============================
app.get("/api/health", async (req, res) => {
  try {
    await ensureKnowledgeLoaded();
    const stats = getKnowledgeStats();

    return res.json({
      ok: true,
      service: "NovaBot-NovaLink",
      knowledge: stats,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

// ==============================
// TRIM HISTORY HELPER
// ==============================
function trimHistory(history = []) {
  const limit = NOVA_CONFIG.AI_ENGINE.SAFETY_LIMITS.MAX_HISTORY_MESSAGES || 12;
  if (!Array.isArray(history)) return [];
  return history.slice(-limit);
}

// ==============================
// KNOWLEDGE REPLY
// ==============================
function buildKnowledgeReply(article, language = "ar") {
  if (!article) return null;

  const title = article.title || "مقال من نوفا لينك";
  const url = article.url || NOVA_CONFIG.META.BASE_URL;
  const desc = article.description || "";
  const snippet = article.text ? article.text.slice(0, 350) : "";

  if (language === "en") {
    return `
Here is a related article from NovaLink AI:

**${title}**
${desc ? desc + "\n\n" : ""}

Read more:
${url}
    `.trim();
  }

  return `
🔗 مقالة قريبة من سؤالك:

${title}
${desc ? "\n" + desc : ""}

${snippet ? "\nمقتطف:\n" + snippet + "..." : ""}

رابط القراءة:
${url}
  `.trim();
}

// ==============================
// HYBRID REPLY (AI + ARTICLE)
// ==============================
function buildHybridReply(article, aiAnswer, language = "ar") {
  const articleReply = buildKnowledgeReply(article, language);
  if (!articleReply && !aiAnswer) return "";
  if (!articleReply) return aiAnswer.trim();
  if (!aiAnswer) return articleReply;

  const separator = "\n\n---\n\n";
  return `${aiAnswer.trim()}${separator}${articleReply}`;
}

// ==============================
// MAIN ENDPOINT — /api/nova-ai
// ==============================
app.post("/api/nova-ai", async (req, res) => {
  const body = req.body || {};

  const userMessage =
    body.message || body.question || body.prompt || "";
  const history = trimHistory(body.history || body.messages || []);
  const isReturningUser = !!body.isReturningUser;
  const pageUrl = body.pageUrl || body.url || null;

  if (!userMessage || typeof userMessage !== "string") {
    const reply = getFallbackReply({
      intent: "WELCOME",
      sentiment: "NEUTRAL",
      isReturningUser,
      language: NOVA_CONFIG.META.PRIMARY_LANGUAGE || "ar"
    });

    return res.json({
      ok: true,
      reply,
      provider: "fallback",
      mode: "welcome_empty_message",
      meta: {
        usedFallback: true
      }
    });
  }

  try {
    // 1) تحليل الرسالة
    const analysis = analyzeUserMessage(userMessage);
    const language = analysis.language || "ar";
    const intent = analysis.intent.label || "GENERIC";
    const sentiment = analysis.sentiment.label || "NEUTRAL";
    const isAIDomain = !!analysis.meta?.isAIDomain;

    // 2) معرفة من نوفا لينك
    const knowledge = await findBestMatch(userMessage);
    const article = knowledge.bestMatch;
    const score = knowledge.score || 0;
    const thresholds = NOVA_CONFIG.KNOWLEDGE.MATCH_THRESHOLDS;

    let finalReply = "";
    let provider = "unknown";
    let mode = "unknown";

    const highMatch = article && score >= (thresholds.HIGH || 0.78);
    const midMatch =
      article && !highMatch && score >= (thresholds.MEDIUM || 0.6);

    // ================================
    // HIGH MATCH — ARTICLE / HYBRID
    // ================================
    if (highMatch) {
      if (language === "en") {
        const aiResult = await runAIProviders(
          `Use the following article context to answer the user in English.\n\nTitle: ${article.title}\nURL: ${article.url}\nExcerpt:\n${article.text?.slice(
            0,
            800
          )}\n\nUser question:\n${userMessage}`,
          "en"
        );

        if (aiResult && aiResult.answer) {
          finalReply = buildHybridReply(article, aiResult.answer, "en");
          provider =
            aiResult.provider === "gemini"
              ? "ai-gemini-hybrid"
              : "ai-cloudflare-hybrid";
          mode = "high_match_hybrid_en";
        } else {
          finalReply = buildKnowledgeReply(article, "en");
          provider = "knowledge";
          mode = "high_match_knowledge_en_fallback_ai";
        }
      } else {
        finalReply = buildKnowledgeReply(article, "ar");
        provider = "knowledge";
        mode = "high_match_knowledge_ar";
      }
    }

    // ================================
    // MEDIUM MATCH — HYBRID WHEN AI TOPIC
    // ================================
    if (!finalReply && midMatch) {
      const isEducationalIntent =
        intent === "LEARNING" || intent === "TOOLS_DISCOVERY";

      if (isAIDomain || isEducationalIntent) {
        const aiResult = await runAIProviders(
          `
السؤال:
${userMessage}

مقتطف من مقال قريب من الموضوع:
${article.text ? article.text.slice(0, 800) : ""}

استخدم هذا المقتطف لبناء إجابة عملية مختصرة، ثم إن كان مناسبًا، شجّع المستخدم على قراءة المقال.
          `.trim(),
          language
        );

        if (aiResult && aiResult.answer) {
          finalReply = buildHybridReply(article, aiResult.answer, language);
          provider =
            aiResult.provider === "gemini"
              ? "ai-gemini-hybrid"
              : "ai-cloudflare-hybrid";
          mode = "medium_match_hybrid";
        } else {
          finalReply = buildKnowledgeReply(article, language);
          provider = "knowledge";
          mode = "medium_match_knowledge_fallback_ai";
        }
      } else {
        finalReply = buildKnowledgeReply(article, language);
        provider = "knowledge";
        mode = "medium_match_knowledge";
      }
    }

    // ================================
    // DIRECT AI (NO/LOW MATCH)
    // ================================
    const shouldUseAI =
      !finalReply &&
      (isAIDomain ||
        intent === "LEARNING" ||
        intent === "TOOLS_DISCOVERY" ||
        intent === "GENERIC");

    if (!finalReply && shouldUseAI) {
      const aiResult = await runAIProviders(userMessage, language);
      if (aiResult && aiResult.answer) {
        finalReply = aiResult.answer.trim();
        provider =
          aiResult.provider === "gemini"
            ? "ai-gemini"
            : "ai-cloudflare";
        mode = "direct_ai";
      }
    }

    // ================================
    // LEADS (SERVICES / PARTNERSHIP / CONSULTATION)
    // ================================
    const leadIntents = ["SERVICES", "PARTNERSHIP", "CONSULTATION"];

    if (leadIntents.includes(intent)) {
      // لا يمنع الرد من الخروج؛ يعمل في الخلفية
      handleNewLead({
        name: body.name || null,
        email: body.email || null,
        phone: body.phone || null,
        intent,
        message: userMessage,
        pageUrl
      }).catch((err) => {
        console.error("[NovaBot] Lead handling error:", err.message);
      });
    }

    // ================================
    // FALLBACK — لو لم يوجد رد حتى الآن
    // ================================
    if (!finalReply) {
      finalReply = getFallbackReply({
        intent,
        sentiment,
        isReturningUser,
        language
      });

      provider = "fallback";
      mode = "fallback_only";
    }

    // CTA خفيف للاشتراك في الحالات التعليمية
    if (
      provider !== "fallback" &&
      (intent === "LEARNING" || intent === "TOOLS_DISCOVERY")
    ) {
      if (Math.random() < 0.3) {
        const subNudge =
          NOVA_CONFIG.RESPONSES.SUBSCRIBE_NUDGE &&
          NOVA_CONFIG.RESPONSES.SUBSCRIBE_NUDGE[0];
        if (subNudge) {
          if (language === "en") {
            finalReply += `\n\n---\n${subNudge}`;
          } else {
            finalReply += `\n\n📩 ${subNudge}`;
          }
        }
      }
    }

    return res.json({
      ok: true,
      reply: finalReply,
      provider,
      mode,
      meta: {
        language,
        intent,
        sentiment,
        isAIDomain,
        knowledgeScore: score,
        hasArticle: !!article,
        pageUrl
      }
    });
  } catch (err) {
    console.error("[NovaBot-NovaLink] Unexpected Error:", err);

    const fallback = getFallbackReply({
      intent: "GENERIC",
      sentiment: "NEUTRAL",
      isReturningUser: false,
      language: NOVA_CONFIG.META.PRIMARY_LANGUAGE || "ar"
    });

    return res.status(500).json({
      ok: false,
      reply: fallback,
      provider: "fallback",
      mode: "server_error",
      error: err.message
    });
  }
});

// ==============================
// RUN SERVER
// ==============================
app.listen(PORT, () => {
  console.log(
    `[NovaBot-NovaLink] Server started on port ${PORT} — Ready at /api/nova-ai`
  );
});

module.exports = app;
