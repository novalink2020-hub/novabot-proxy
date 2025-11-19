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
const PORT = process.env.PORT;

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
// TRIM HISTORY
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
// HYBRID REPLY
// ==============================
function buildHybridReply(article, aiAnswer, language = "ar") {
  const articleReply = buildKnowledgeReply(article, language);
  if (!articleReply) return aiAnswer;

  if (!aiAnswer) return articleReply;

  const sep = language === "en" ? "\n\n---\n\n" : "\n\n---\n\n";

  return `${aiAnswer.trim()}${sep}${articleReply}`;
}

// ==============================
// MAIN ENDPOINT — /api/nova-ai
// ==============================
app.post("/api/nova-ai", async (req, res) => {
  const body = req.body || {};

  const userMessage =
    body.message || body.question || body.prompt || "";
  const history = trimHistory(body.history || []);
  const isReturningUser = !!body.isReturningUser;
  const pageUrl = body.pageUrl || null;

  if (!userMessage || typeof userMessage !== "string") {
    const reply = getFallbackReply({
      intent: "WELCOME",
      sentiment: "NEUTRAL",
      isReturningUser,
      language: "ar"
    });

    return res.json({
      ok: true,
      reply,
      provider: "fallback",
      mode: "welcome"
    });
  }

  try {
    // 1) ANALYSIS
    const analysis = analyzeUserMessage(userMessage);
    const language = analysis.language;
    const intent = analysis.intent.label;
    const sentiment = analysis.sentiment.label;
    const isAIDomain = analysis.meta?.isAIDomain;

    // 2) KNOWLEDGE MATCHING
    const knowledge = await findBestMatch(userMessage);
    const article = knowledge.bestMatch;
    const score = knowledge.score;
    const thresholds = NOVA_CONFIG.KNOWLEDGE.MATCH_THRESHOLDS;

    let finalReply = "";
    let provider = "unknown";
    let mode = "unknown";

    const highMatch = article && score >= thresholds.HIGH;
    const midMatch = article && !highMatch && score >= thresholds.MEDIUM;

    // ================================
    // HIGH MATCH — ARTICLE ONLY
    // ================================
    if (highMatch) {
      if (language === "en") {
        // Hybrid لأن المقال عربي
        const ai = await runAIProviders(
          `Translate this article context into English and answer the user's question clearly.\n\nArticle Title: ${article.title}\nURL: ${article.url}\nExcerpt: ${article.text?.slice(0, 600)}\n\nUser Question: ${userMessage}`,
          "en"
        );

        if (ai && ai.answer) {
          finalReply = buildHybridReply(article, ai.answer, "en");
          provider = ai.provider;
          mode = "high_match_hybrid_en";
        } else {
          finalReply = buildKnowledgeReply(article, "en");
          provider = "knowledge";
          mode = "high_match_knowledge_en_fallback";
        }
      } else {
        finalReply = buildKnowledgeReply(article, "ar");
        provider = "knowledge";
        mode = "high_match_knowledge";
      }
    }

    // ================================
    // MEDIUM MATCH — HYBRID FOR AI TOPICS
    // ================================
    if (!finalReply && midMatch) {
      const educationalIntent =
        intent === "LEARNING" ||
        intent === "TOOLS_DISCOVERY";

      if (isAIDomain || educationalIntent) {
        const ai = await runAIProviders(
          `
السؤال:
${userMessage}

مقتطف من مقال قريب من الموضوع:
${article.text?.slice(0, 600) || ""}

أجب بإيجاز ووضوح ثم أضف اقتراح قراءة الرابط لو كان مناسبًا.
          `,
          language
        );

        if (ai && ai.answer) {
          finalReply = buildHybridReply(article, ai.answer, language);
          provider = ai.provider;
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
    // DIRECT AI (IF NECESSARY)
    // ================================
    const shouldUseAI =
      !finalReply &&
      (isAIDomain ||
        intent === "LEARNING" ||
        intent === "TOOLS_DISCOVERY" ||
        intent === "GENERIC");

    if (!finalReply && shouldUseAI) {
      const ai = await runAIProviders(userMessage, language);
      if (ai && ai.answer) {
        finalReply = ai.answer.trim();
        provider = ai.provider;
        mode = "direct_ai";
      }
    }

    // ================================
    // LEADS HANDLER (SERVICES / PARTNERSHIP / CONSULTATION)
    // ================================
    const leadIntents = ["SERVICES", "PARTNERSHIP", "CONSULTATION"];

    if (leadIntents.includes(intent)) {
      await handleNewLead({
        name: body.name || null,
        email: body.email || null,
        phone: body.phone || null,
        intent,
        message: userMessage,
        pageUrl
      });
    }

    // ================================
    // FALLBACK
    // ================================
    if (!finalReply) {
      finalReply = getFallbackReply({
        intent,
        sentiment,
        isReturningUser,
        language
      });

      provider = "fallback";
      mode = "fallback";
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
    console.error("[NovaBot] Unexpected Error:", err);

    const fallback = getFallbackReply({
      intent: "GENERIC",
      sentiment: "NEUTRAL",
      isReturningUser: false,
      language: "ar"
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
