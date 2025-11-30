router.js
// ===========================================================
// router.js – NovaBot Smart Request Router v2.0
// الطبقة التي تنسّق بين: النوايا → الجلسة → الدماغ + ذاكرة المفاهيم (CKM) + Topic Switch Layer (V5)
// ===========================================================

console.log("🛣️ Router V5.1 loaded at", new Date().toISOString());
import { detectNovaIntent } from "./novaIntentDetector.js";
import { novaBrainSystem } from "./novaBrainSystem.js";

// إعداد ذاكرة الجلسات (تاريخ + مفاهيم)
const sessionMemory = new Map();
const MAX_HISTORY_ENTRIES = 6; // 3 تبادلات (مستخدم+بوت)
const MAX_CONCEPTS = 10;
const MEMORY_WINDOW = 3;
const SOFT_SWITCH_CONCEPT_CLAMP = 5;

// استخراج sessionId من الـ IP أو الـ x-forwarded-for
function getSessionId(req) {
  const xf = req.headers["x-forwarded-for"];
  if (xf) return xf.split(",")[0].trim();
  return req.socket.remoteAddress || "anonymous";
}

function getSession(sessionId) {
  const existing = sessionMemory.get(sessionId);
  if (existing) return existing;
  const fresh = { history: [], concepts: [] };
  sessionMemory.set(sessionId, fresh);
  return fresh;
}

function saveSession(sessionId, session) {
  session.history = (session.history || []).slice(-MAX_HISTORY_ENTRIES);
  session.concepts = (session.concepts || []).slice(-MAX_CONCEPTS);
  sessionMemory.set(sessionId, session);
}

// تاريخ الجلسة
function getSessionHistory(sessionId) {
  const session = getSession(sessionId);
  return session.history || [];
}

function pushToHistory(sessionId, entry) {
  const session = getSession(sessionId);
  const arr = session.history || [];
  arr.push({ ...entry, ts: Date.now() });

  if (arr.length > MAX_HISTORY_ENTRIES) {
    arr.splice(0, arr.length - MAX_HISTORY_ENTRIES);
  }

  session.history = arr;
  saveSession(sessionId, session);
}

function updateConceptMemory(sessionId, concepts = []) {
  const session = getSession(sessionId);
  const normalized = concepts
    .map((c) => (c || "").trim())
    .filter((c) => c.length >= 2);

  const merged = [...(session.concepts || []), ...normalized];
  const dedup = [];
  for (const c of merged) {
    if (!c) continue;
    if (!dedup.includes(c)) {
      dedup.push(c);
    }
  }

  session.concepts = dedup.slice(-MAX_CONCEPTS);
  saveSession(sessionId, session);
  return session.concepts;
}

function resetConceptMemory(sessionId) {
  const session = getSession(sessionId);
  session.concepts = [];
  saveSession(sessionId, session);
}

function classifyTopicTransition(
  session,
  userMessage = "",
  analysis = {},
  history = [],
  { isFollowUp = false, hasAIMomentum = false } = {}
) {
  if (!session || (!session.history?.length && !(session.concepts || []).length)) {
    return "same_topic";
  }

  if (isFollowUp && hasAIMomentum) {
    return "same_topic";
  }

  const matchesConcept = messageMatchesConcepts(userMessage, session.concepts || []);
  const pronounFollow = hasPronounFollow(userMessage || "") && (session.concepts || []).length > 0;

  const lastUser = [...(history || [])]
    .filter((m) => m && m.role === "user")
    .slice(-1)[0];
  const lastIntent = lastUser?.effectiveIntentId || lastUser?.intentId || null;

  const aiBizScore = (analysis.aiScore || 0) + (analysis.bizScore || 0);

  if (matchesConcept || pronounFollow) return "same_topic";
  if (analysis.intentId === "out_of_scope" || aiBizScore === 0) return "hard_switch";

  if (lastIntent && lastIntent !== "ai_business" && analysis.intentId === "ai_business") {
    return "hard_switch"; // إعادة دخول إلى AI بعد خروج كامل
  }

  if (lastIntent && lastIntent === "ai_business" && analysis.intentId !== "ai_business") {
    return "hard_switch";
  }

  return "soft_switch";
}

// ========================
// منطق إجبار AI
// ========================
function shouldForceAI(userMessage, analysis, history, { isFollowUp = false, hasAIMomentum = false } = {}) {
  const text = (userMessage || "").toLowerCase().trim();

  // لا نقوم بالإجبار في النوايا الثابتة أو خارج النطاق
  const safeIntents = new Set([
    "out_of_scope",
    "greeting",
    "thanks_positive",
    "negative_mood",
    "subscribe_interest",
    "collaboration",
    "consulting_purchase",
    "novalink_info",
    "novabot_info",
    "novalink_story",
    "novalink_services"
  ]);

  if (safeIntents.has(analysis.intentId)) return false;

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

  if (isFollowUp && hasAIMomentum) return true;

  return false;
}

function messageMatchesConcepts(text = "", concepts = []) {
  const lower = text.toLowerCase();
  return concepts.some((concept) => lower.includes(concept.toLowerCase()));
}

function hasPronounFollow(text = "") {
  const pronouns = [
    "هذا",
    "هذه",
    "هي",
    "هو",
    "كيف نبدأ",
    "كيف نطوره",
    "كيف نطورها",
    "طيب كيف",
    "كيف نبدأ؟",
    "كيف نبدأ ?",
    "how do we start",
    "how to start",
    "how do we improve it",
    "how to improve it",
    "how do we develop it"
  ];
  const lower = text.toLowerCase();
  return pronouns.some((p) => lower.includes(p.toLowerCase()));
}

function isQuestionLike(text = "") {
  const lower = text.toLowerCase().trim();
  if (!lower) return false;

  if (lower.endsWith("?") || lower.endsWith("؟")) return true;

  const qAr = ["ما ", "ماذا", "كيف", "لماذا", "هل ", "اشرح", "فسّر", "عرف", "ايش", "شو", "ليش"];
  const qEn = ["what", "why", "how", "when", "where", "explain", "define", "help", "can you", "could you"];

  if (qAr.some((kw) => lower.startsWith(kw)) || qEn.some((kw) => lower.startsWith(kw))) {
    return true;
  }

  return false;
}

// ===========================================================
// 🔥 الواجهة الرئيسية للراوتر
// ===========================================================
export async function routeNovaRequest(req, userMessage) {
  const sessionId = getSessionId(req);
  const session = getSession(sessionId);
  const history = session.history || [];
  const hasUserHistory = history.some((m) => m && m.role === "user");

  // 1) تحليل النية
  const analysis = await detectNovaIntent(userMessage);
  const originalIntentId = analysis.intentId;

  const isFollowUp =
    (analysis.followupScore || 0) > 0 || hasPronounFollow(userMessage || "");

  const lastTurns = [...history].slice(-MEMORY_WINDOW);
  const hasAIMomentum = lastTurns.some(
    (m) =>
      m &&
      (m.hasAI === true || m.intentId === "ai_business" || m.effectiveIntentId === "ai_business")
  );

  const topicTransition = classifyTopicTransition(session, userMessage, analysis, history, {
    isFollowUp,
    hasAIMomentum
  });

  // 2) قرار إجبار AI
  const startForceAI =
    !hasUserHistory &&
    !new Set([
      "out_of_scope",
      "greeting",
      "thanks_positive",
      "negative_mood",
      "subscribe_interest",
      "collaboration",
      "consulting_purchase",
      "novalink_info",
      "novabot_info"
    ]).has(originalIntentId) &&
    ((analysis.aiScore || 0) + (analysis.bizScore || 0) > 0 || isQuestionLike(userMessage || ""));

  const forceAI =
    startForceAI || shouldForceAI(userMessage, analysis, history, { isFollowUp, hasAIMomentum });

  // 3) تعديل نية الطلب لو تم إجبار AI
  let effectiveIntentId = analysis.intentId;
  let effectiveSuggestedCard = analysis.suggestedCard || null;
  let allowGemini = true;

  if (originalIntentId === "out_of_scope" && !hasAIMomentum && !isFollowUp) {
    allowGemini = false;
  }

  if (topicTransition === "hard_switch" && analysis.intentId !== "ai_business") {
    allowGemini = false;
  }

  if (forceAI) {
    effectiveIntentId = "ai_business";
    effectiveSuggestedCard = null;
  }

  // 3.1) تعزيز الذاكرة السياقية (CKM) + Topic Switch Layer
  let workingAiScore = analysis.aiScore || 0;
  let workingBizScore = analysis.bizScore || 0;
  let contextFollowing = false;

  if (topicTransition === "same_topic") {
    workingAiScore += 2;
    contextFollowing = true;
  } else if (topicTransition === "soft_switch") {
    workingAiScore = Math.max(0, Math.round(workingAiScore * 0.7));
    session.concepts = (session.concepts || []).slice(-SOFT_SWITCH_CONCEPT_CLAMP);
    saveSession(sessionId, session);
  } else if (topicTransition === "hard_switch") {
    workingAiScore = effectiveIntentId === "ai_business" ? workingAiScore : 0;
    session.concepts = [];
    saveSession(sessionId, session);
  }

  if (messageMatchesConcepts(userMessage || "", session.concepts || [])) {
    workingAiScore += 3;
    contextFollowing = true;
  }

  const pronounFollow =
    hasPronounFollow(userMessage || "") && (session.concepts || []).length > 0;
  if (pronounFollow) {
    workingAiScore += 4;
    effectiveIntentId = "ai_business";
    contextFollowing = true;
  }

  if (forceAI) workingAiScore += 2;

  if (hasAIMomentum) workingAiScore += 2;
  if (isFollowUp && hasAIMomentum) workingAiScore += 3;

  const weightScore = workingAiScore + workingBizScore;

  // 3.2) تحديد مستوى الجلسة (sessionTier)
  let sessionTier = "non_ai";
  if (weightScore >= 7 || (contextFollowing && effectiveIntentId === "ai_business")) {
    sessionTier = "strong_ai";
  } else if (weightScore >= 4) {
    sessionTier = "semi_ai";
  }

  if (hasAIMomentum && sessionTier === "non_ai") {
    sessionTier = "semi_ai";
  }

  // 4) تمرير الطلب للدماغ
  const brainReply = await novaBrainSystem({
    message: userMessage,
    ...analysis,
    originalIntentId,
    intentId: effectiveIntentId,
    suggestedCard: effectiveSuggestedCard,
    forceAI,
    recentMessages: history,
    sessionConcepts: session.concepts || [],
    sessionTier,
    contextFollowing,
    weightScore,
    allowGemini,
    topicTransition,
    isFollowUp,
    hasAIMomentum
  });

  // 5) حفظ في الذاكرة: مستخدم + بوت
  const turnUsedAI = brainReply.usedAI === true;
  const userHasAIIntent = originalIntentId === "ai_business";

  pushToHistory(sessionId, {
    role: "user",
    text: userMessage,
    intentId: originalIntentId,
    effectiveIntentId,
    hasAI: userHasAIIntent
  });

  pushToHistory(sessionId, {
    role: "bot",
    text: brainReply.reply,
    intentId: effectiveIntentId,
    hasAI: turnUsedAI
  });

  // 6) تحديث ذاكرة المفاهيم
  if (brainReply.resetConcepts) {
    resetConceptMemory(sessionId);
  } else if (Array.isArray(brainReply.extractedConcepts) && brainReply.extractedConcepts.length) {
    updateConceptMemory(sessionId, brainReply.extractedConcepts);
  }

  const updatedConcepts = getSession(sessionId).concepts || [];

  console.log("[CKM] concepts extracted:", brainReply.extractedConcepts || []);
  console.log("[CKM] session concepts:", updatedConcepts);
  console.log(
    "[CKM] weight:",
    weightScore,
    "aiScore:",
    analysis.aiScore || 0,
    "sessionTier:",
    sessionTier,
    "maxTokens:",
    brainReply.maxTokens,
    "gemini:",
    brainReply.geminiUsed,
    "match:",
    brainReply.matchType || "none",
    "topicTransition:",
    topicTransition,
    "allowGemini:",
    allowGemini
  );

  // 7) إعادة الرد للـ server.js
  return {
    ok: true,
    reply: brainReply.reply,
    actionCard: brainReply.actionCard || null
  };
}
