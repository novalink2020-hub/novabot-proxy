// ======================================================
// router.js – NovaBot AI Decision Router (Stable v1.0)
// مسؤول عن:
// - اتخاذ قرار AI vs Non-AI
// - حساب maxTokens
// - منع الروابط في غير محلها
// - إدارة البطاقات
// - تهيئة الطلب النهائي للدماغ
// By Mohammed Abu Snaina – NOVALINK.AI
// ======================================================

import { detectNovaIntent } from "./novaIntentDetector.js";
import { findKnowledgeMatch } from "./knowledgeEngine.js";

// ------------------------------------------------------
// 🧠 Session Memory Helpers
// (سيستخدمه السيرفر فقط للتمرير)
// ------------------------------------------------------

export function detectAISession(intentId, recentMsgs = []) {
  if (intentId === "ai_business") return true;

  const lastUserMsgs = recentMsgs
    .filter((m) => m && m.role === "user")
    .slice(-3);

  return lastUserMsgs.some((m) => m.intentId === "ai_business");
}

// ------------------------------------------------------
// 🔥 forceAI (إجبار الذكاء الاصطناعي)
// ------------------------------------------------------

function computeForceAI(message, analysis, history) {
  const text = (message || "").toLowerCase().trim();

  // 1) أي سؤال ينتهي بـ ؟
  if (text.endsWith("?")) return true;

  // 2) كلمات AI + أدوات شهيرة
  const aiWords = [
    "ذكاء", "ai", "gpt", "chatgpt", "gemini", "تعليق صوتي",
    "voice", "نموذج لغوي", "llm", "محتوى", "تسويق", "seo"
  ];
  if (aiWords.some((w) => text.includes(w))) return true;

  // 3) starters (كيف / ما / why / how)
  const startersAr = ["ما ", "ماذا", "كيف", "لماذا", "اشرح", "عرف", "فسر"];
  const startersEn = ["what", "why", "how", "when", "explain", "define"];
  if (startersAr.some((s) => text.startsWith(s))) return true;
  if (startersEn.some((s) => text.startsWith(s))) return true;

  // 4) استمرار جلسة AI
  const last = [...history].slice(-3);
  if (last.some((m) => m.hasAI)) return true;

  return false;
}

// ------------------------------------------------------
// 🎯 maxTokens Table (القواعد الرسمية)
// ------------------------------------------------------

function getMaxTokens(isAIQuestion, isAISession, matchType) {
  // strong match
  if (matchType === "strong") return 0;

  // medium match
  if (matchType === "medium") return 100;

  // سؤال AI في جلسة AI
  if (isAIQuestion && isAISession) return 200;

  // سؤال غير AI في جلسة AI
  if (!isAIQuestion && isAISession) return 100;

  // جلسة غير AI → بدون AI
  return 0;
}

// ------------------------------------------------------
// 🎛️ كيف نحدد allowedLinks؟
// ------------------------------------------------------

function determineAllowedLinks(matchType, isAIResponse) {
  // الروابط فقط في strong + medium
  if (matchType === "strong" || matchType === "medium") return true;

  // ممنوع الروابط في AI pure
  if (isAIResponse) return false;

  // ممنوع الروابط في النوايا الثابتة أو التحفيز
  return false;
}

// ------------------------------------------------------
// 🟦 إدارة البطاقات الخمسة
// ------------------------------------------------------

function resolveActionCard(intentId, suggestedCard, matchType, forceAI) {
  // ممنوع أثناء forceAI
  if (forceAI) return null;

  // ممنوع أثناء strong/medium
  if (matchType === "strong" || matchType === "medium") return null;

  // أولوية البطاقات
  const order = [
    "developer_identity",
    "consulting_purchase",
    "collaboration",
    "subscribe",
    "bot_lead"
  ];

  // suggestedCard لها أولوية فقط لو ضمن القائمة
  if (suggestedCard && order.includes(suggestedCard)) return suggestedCard;

  // intent → card mapping
  const map = {
    consulting_purchase: "bot_lead",
    collaboration: "collaboration",
    subscribe_interest: "subscribe"
  };

  if (map[intentId]) return map[intentId];

  return null;
}

// ------------------------------------------------------
// 🧭 تابع رئيسي — router()
// ------------------------------------------------------

export async function router({ message, history = [] }) {
  // 1) تحليل النوايا
  const analysis = await detectNovaIntent(message);
  let intentId = analysis.intentId;
  let suggestedCard = analysis.suggestedCard;

  // 2) قرار هل نجبر AI
  const forceAI = computeForceAI(message, analysis, history);

  if (forceAI) {
    intentId = "ai_business";
    suggestedCard = null;
  }

  // 3) تحديد نوع الجلسة actuelle
  const isAISession = detectAISession(intentId, history);
  const isAIQuestion = intentId === "ai_business";

  // 4) البحث عن أفضل تطابق في المعرفة
  const { type: matchType, item } = await findKnowledgeMatch(message);

  // 5) تحديد maxTokens
  const maxTokens = getMaxTokens(isAIQuestion, isAISession, matchType);

  // 6) تحديد السماح بالروابط
  const allowLinks = determineAllowedLinks(matchType, maxTokens > 0);

  // 7) بطاقة الأكشن
  const actionCard = resolveActionCard(intentId, suggestedCard, matchType, forceAI);

  // 8) بناء الطلب النهائي للدماغ
  return {
    cleanRequest: {
      message,
      language: analysis.language,
      dialectHint: analysis.dialectHint,
      intentId,
      forceAI,
      isAIQuestion,
      isAISession,
      matchType,
      bestItem: item,
      maxTokens,
      allowLinks,
      actionCard
    }
  };
}
