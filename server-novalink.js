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
  const snippet = article.text
    ? article.text.slice(0, 400)
    : "";

  // في الوضع الحالي محتوى المدونة عربي،
  // لو المستخدم إنجليزي نضيف سطر إرشادي بسيط بالإنجليزية.
  if (language === "en") {
    return (
      `Here is a relevant article from NovaLink AI:\n\n` +
      `**${title}**\n` +
      (desc ? `${desc}\n\n` : "") +
      `Read it here:\n${url}`
    ).trim();
  }

  // رد عربي
  return `
🔗 مقالة من نوفا لينك قريبة من سؤالك:

${title}
${desc ? "\n" + desc : ""}

${snippet ? "\nمقتطف:\n" + snippet + "..." : ""}

رابط القراءة الكاملة:
${url}
  `.trim();
}

// ==============================
// دمج مقال + رد LLM في إجابة واحدة
// ==============================
function buildHybridReply(article, aiAnswer, language = "ar") {
  const baseKnowledge = article
    ? buildKnowledgeReply(article, language)
    : "";

  if (!aiAnswer && baseKnowledge) return baseKnowledge;
  if (aiAnswer && !baseKnowledge) return aiAnswer.trim();
  if (!aiAnswer && !baseKnowledge) return "";

  if (language === "en") {
    return `
${aiAnswer.trim()}

---

${baseKnowledge}
    `.trim();
  }

  // عربي
  return `
${aiAnswer.trim()}

---

${baseKnowledge}
  `.trim();
}

// ==============================
// المسار الرئيسي: /api/nova-ai
// ==============================
app.post("/api/nova-ai", async (req, res) => {
  const body = req.body || {};

  // نحاول دعم أكثر من اسم للحقل من أجل التوافق:
  const userMessage =
    body.message ||
    body.question ||
    body.prompt ||
    "";

  const clientHistory = trimHistory(body.history || body.messages || []);
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
    // 1) تحليل الرسالة (لغة + نية + مشاعر + مجال)
    const analysis = analyzeUserMessage(userMessage);
    const language = analysis.language || "ar";
    const intentLabel = analysis.intent.label || "GENERIC";
    const sentimentLabel = analysis.sentiment.label || "NEUTRAL";
    const isAIDomain = !!analysis.meta?.isAIDomain;

    // 2) محاولة إيجاد أفضل مقال مطابق
    const knowledgeResult = await findBestMatch(userMessage);
    const article = knowledgeResult.bestMatch;
    const knowledgeScore = knowledgeResult.score || 0;
    const thresholds = NOVA_CONFIG.KNOWLEDGE.MATCH_THRESHOLDS;

    let finalReply = "";
    let provider = "unknown";
    let mode = "unknown";

    // =============================
    // منطق القرار الأساسي
    // =============================

    // حالة 1: تطابق قوي جدًا مع مقال (HIGH)
    const isHighMatch =
      article && knowledgeScore >= (thresholds.HIGH || 0.78);

    // حالة 2: تطابق متوسط (MEDIUM)
    const isMediumMatch =
      article &&
      !isHighMatch &&
      knowledgeScore >= (thresholds.MEDIUM || 0.6);

    // أ) لو تطابق قوي مع مقال:
    //    - لو اللغة عربية → نستخدم المقال مباشرة
    //    - لو اللغة إنجليزية → نستخدم Hybrid (LLM + مقال) حتى لا نقدّم نص عربي خالص
    if (isHighMatch) {
      if (language === "en") {
        const aiResult = await runAIProviders(
          `Use the following article summary to answer the user in English:\n\nTitle: ${article.title}\nURL: ${article.url}\n\nContent snippet:\n${article.text?.slice(
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

    // ب) تطابق متوسط مع مقال:
    //    - في مجال الذكاء الاصطناعي أو نية تعليم/أدوات → Hybrid
    if (!finalReply && isMediumMatch) {
      const isLearningIntent =
        intentLabel === "LEARNING" ||
        intentLabel === "TOOLS_DISCOVERY";

      if (isAIDomain || isLearningIntent) {
        const aiResult = await runAIProviders(
          `
السؤال:
${userMessage}

ملخص من مقال قريب من الموضوع:
العنوان: ${article.title}
الرابط: ${article.url}
المحتوى (مقتطف):
${article.text ? article.text.slice(0, 800) : ""}

استخدم هذه المعلومات لتقديم إجابة مختصرة وواضحة، ثم لو كان مناسبًا، شجّع القارئ على زيارة الرابط للمزيد.
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
        // تطابق متوسط لكن ليس بالضرورة AI → يمكن رد معرفي فقط
        finalReply = buildKnowledgeReply(article, language);
        provider = "knowledge";
        mode = "medium_match_knowledge";
      }
    }

    // ج) لا يوجد تطابق قوي/متوسط أو نريد استخدام LLM مباشرة:
    const isEducational =
      intentLabel === "LEARNING" ||
      intentLabel === "TOOLS_DISCOVERY";

    const shouldUseAI =
      !finalReply &&
      (isAIDomain ||
        isEducational ||
        intentLabel === "GENERIC");

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

    // د) لو لا يوجد رد حتى الآن → نستخدم الردود المؤتمتة
    if (!finalReply) {
      const fallback = getFallbackReply({
        intent: intentLabel,
        sentiment: sentimentLabel,
        isReturningUser,
        language
      });

      finalReply = fallback || "حدث شيء غير متوقع… لنحاول من زاوية أخرى.";
      provider = "fallback";
      mode = "fallback_only";
    }

    // هـ) احتمال إضافة نداء للاشتراك بشكل خفيف (للنوايا التعليمية فقط)
    if (
      provider !== "fallback" &&
      (intentLabel === "LEARNING" ||
        intentLabel === "TOOLS_DISCOVERY")
    ) {
      // نضيف CTA بسيط أحياناً بدون إزعاج (احتمال 30%)
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

    // الرد النهائي
    return res.json({
      ok: true,
      reply: finalReply,
      provider,
      mode,
      meta: {
        language,
        intent: intentLabel,
        sentiment: sentimentLabel,
        isAIDomain,
        knowledgeScore,
        hasArticle: !!article,
        pageUrl,
        usedFallback: provider === "fallback"
      }
    });
  } catch (err) {
    console.error("[server-novalink] خطأ غير متوقع:", err);

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
// تشغيل السيرفر
// ==============================
app.listen(PORT, () => {
  console.log(
    `[NovaBot-NovaLink] الخادم يعمل على المنفذ ${PORT} - جاهز لاستقبال /api/nova-ai`
  );
});

module.exports = app;
