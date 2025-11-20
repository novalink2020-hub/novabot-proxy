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
@@ -51,14 +50,28 @@
});

// ==============================
// TRIM HISTORY HELPER
// HELPERS
// ==============================
function trimHistory(history = []) {
const limit = NOVA_CONFIG.AI_ENGINE.SAFETY_LIMITS.MAX_HISTORY_MESSAGES || 12;
if (!Array.isArray(history)) return [];
return history.slice(-limit);
}

function isSubscribeLikeMessage(text) {
  if (!text || typeof text !== "string") return false;
  const t = text.toLowerCase();
  return (
    t.includes("اشتراك") ||
    t.includes("النشرة") ||
    t.includes("النشره") ||
    t.includes("القائمة البريدية") ||
    t.includes("القائمه البريديه") ||
    t.includes("newsletter") ||
    t.includes("subscribe")
  );
}

// ==============================
// KNOWLEDGE REPLY (HTML-FRIENDLY)
// ==============================
@@ -122,7 +135,6 @@
const isReturningUser = !!body.isReturningUser;
const pageUrl = body.pageUrl || body.url || null;

  // حالة فتح الشات بدون رسالة أولى (نترك الرد للذكاء أو fallback ترحيبي)
if (!userMessage || typeof userMessage !== "string" || !userMessage.trim()) {
const reply = getFallbackReply({
intent: "WELCOME",
@@ -143,6 +155,8 @@
});
}

  const subscribeLike = isSubscribeLikeMessage(userMessage);

try {
// 1) تحليل الرسالة
const analysis = analyzeUserMessage(userMessage);
@@ -160,7 +174,7 @@
let finalReply = "";
let provider = "unknown";
let mode = "unknown";
    let actionCard = null; // سيتم تعبئتها لاحقًا بناءً على النية
    let actionCard = null;

const highMatch = article && score >= (thresholds.HIGH || 0.78);
const midMatch =
@@ -282,7 +296,6 @@
const leadIntents = ["SERVICES", "PARTNERSHIP", "CONSULTATION"];

if (leadIntents.includes(intent)) {
      // حفظ الليد في الخلفية
handleNewLead({
name: body.name || null,
email: body.email || null,
@@ -294,13 +307,12 @@
console.error("[NovaBot] Lead handling error:", err.message);
});

      // ربط النية بنوع البطاقة
if (intent === "SERVICES") {
        actionCard = "business_subscribe"; // بطاقة الخدمات
        actionCard = "business_subscribe";
} else if (intent === "PARTNERSHIP") {
        actionCard = "collaboration"; // بطاقة التعاون
        actionCard = "collaboration";
} else if (intent === "CONSULTATION") {
        actionCard = "bot_lead"; // بطاقة بوت لمشروعه
        actionCard = "bot_lead";
}
}

@@ -320,76 +332,70 @@
}

// ================================
    // CTA للاشتراك (بطاقة اشتراك + نَص NUDGE)
    // CTA للاشتراك (بطاقة + نَص خفيف)
// ================================
const isEducationalIntent =
intent === "LEARNING" || intent === "TOOLS_DISCOVERY";

    if (
      provider !== "fallback" &&
      isEducationalIntent &&
      !actionCard // لم تُحدد بطاقة مسبقًا
    ) {
      // 1) بطاقة اشتراك
    if ((isEducationalIntent || subscribeLike) && !actionCard) {
actionCard = "subscribe";

      // 2) نَص خفيف في نهاية الرد
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

return res.json({
ok: true,
reply: finalReply,
provider,
mode,
actionCard: actionCard || null,
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
actionCard: null,
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
