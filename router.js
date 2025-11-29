// ===========================================================
// router.js – NovaBot Smart Request Router v1.0
// الطبقة التي تنسّق بين: النوايا → الجلسة → الدماغ
// ===========================================================

import { detectNovaIntent } from "./novaIntentDetector.js";
import { novaBrainSystem } from "./novaBrainSystem.js";

// إعداد ذاكرة الجلسات
const sessionMemory = new Map();
const MAX_MEMORY_ENTRIES = 6; // 3 تبادلات (مستخدم+بوت)
const MEMORY_WINDOW = 3;

// استخراج sessionId من الـ IP أو الـ x-forwarded-for
function getSessionId(req) {
  const xf = req.headers["x-forwarded-for"];
  if (xf) return xf.split(",")[0].trim();
  return req.socket.remoteAddress || "anonymous";
}

// تاريخ الجلسة
function getSessionHistory(sessionId) {
  return sessionMemory.get(sessionId) || [];
}

function pushToHistory(sessionId, entry) {
  const arr = sessionMemory.get(sessionId) || [];
  arr.push({ ...entry, ts: Date.now() });

  if (arr.length > MAX_MEMORY_ENTRIES) {
    arr.splice(0, arr.length - MAX_MEMORY_ENTRIES);
  }
  sessionMemory.set(sessionId, arr);
}

// ========================
// منطق إجبار AI
// ========================
function shouldForceAI(userMessage, analysis, history) {
  const text = (userMessage || "").toLowerCase().trim();

  // 1) كلمات أدوات ذكاء اصطناعي
  const aiHints = [
    "chatgpt",
    "gpt",
    "gemini",
    "جيميني",
    "midjourney",
    "murf",
    "elevenlabs",
    "دريجات",
    "notion ai",
    "copilot",
    "llm",
    "تعليق صوتي",
    "voice over"
  ];

  if (aiHints.some((kw) => text.includes(kw))) return true;

  // 2) سؤال واضح ينتهي بـ ؟
  if (text.endsWith("?")) return true;

  // 3) يبدأ بكلمات سؤال عربية/إنجليزية
  const qAr = ["ما ", "ماذا", "كيف", "لماذا", "هل ", "اشرح", "فسّر", "عرف"];
  const qEn = ["what", "why", "how", "when", "where", "explain", "define", "help me"];

  if (qAr.some((kw) => text.startsWith(kw)) || qEn.some((kw) => text.startsWith(kw))) {
    return true;
  }

  // 4) سياق جلسة AI
  const last = [...history].slice(-MEMORY_WINDOW);
  const recentAI = last.some((m) => m.hasAI === true);

  if (recentAI) {
    const endings = ["شكرا", "شكراً", "thanks", "thank you", "bye"];
    if (!endings.includes(text)) return true;
  }

  return false;
}

// ===========================================================
// 🔥 الواجهة الرئيسية للراوتر
// ===========================================================
export async function routeNovaRequest(req, userMessage) {
  const sessionId = getSessionId(req);
  const history = getSessionHistory(sessionId);

  // 1) تحليل النية
  const analysis = await detectNovaIntent(userMessage);

  // 2) قرار إجبار AI
  const forceAI = shouldForceAI(userMessage, analysis, history);

  // 3) تعديل نية الطلب لو تم إجبار AI
  let effectiveIntentId = analysis.intentId;
  let effectiveSuggestedCard = analysis.suggestedCard || null;

  if (forceAI) {
    effectiveIntentId = "ai_business";
    effectiveSuggestedCard = null;
  }

  // 4) تمرير الطلب للدماغ
  const brainReply = await novaBrainSystem({
    message: userMessage,
    ...analysis,
    intentId: effectiveIntentId,
    suggestedCard: effectiveSuggestedCard,
    forceAI,
    sessionHistory: history
  });

  // 5) حفظ في الذاكرة: مستخدم + بوت
  pushToHistory(sessionId, {
    role: "user",
    text: userMessage,
    intentId: effectiveIntentId,
    hasAI: false
  });

  pushToHistory(sessionId, {
    role: "bot",
    text: brainReply.reply,
    intentId: effectiveIntentId,
    hasAI: brainReply.usedAI === true
  });

  // 6) إعادة الرد للـ server.js
  return {
    ok: true,
    reply: brainReply.reply,
    actionCard: brainReply.actionCard || null
  };
}
