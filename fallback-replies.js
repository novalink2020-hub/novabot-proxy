// fallback-replies.js
// نظام الردود المؤتمتة (Fallback Replies)
// يعتمد على RESPONSES من nova-config.js
// ويضمن ردّ محترف وملهم بنفس روح نوفا لينك حتى عند فشل جميع مزودي الذكاء الاصطناعي.

"use strict";

const NOVA_CONFIG = require("./nova-config");

/**
 * دالة مساعدة: اختيار عنصر عشوائي آمن من مصفوفة
 */
function pickRandom(arr) {
  if (!arr || !Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * جلب الرد المناسب بناء على:
 * - intent
 * - sentiment (positive/negative/neutral)
 * - هل المستخدم يعود للمرة الثانية؟
 * - fallback إذا لم يوجد أي شيء
 */
function getFallbackReply({
  intent = "GENERIC",
  sentiment = "NEUTRAL",
  isReturningUser = false,
  language = "ar"
}) {
  const RESP = NOVA_CONFIG.RESPONSES;

  // =========================
  // 1) رد ترحيب أول مرّة / عودة
  // =========================
  if (intent === "WELCOME" || intent === "FIRST_TIME") {
    const reply = pickRandom(RESP.WELCOME_FIRST);
    return wrapWithTone(reply, language);
  }
  if (intent === "RETURNING_USER") {
    const reply = pickRandom(RESP.WELCOME_RETURNING);
    return wrapWithTone(reply, language);
  }

  // =========================
  // 2) شكر → ردود إيجابية
  // =========================
  if (sentiment === "POSITIVE") {
    const reply = pickRandom(RESP.POSITIVE);
    return wrapWithTone(reply, language);
  }

  // =========================
  // 3) نقد → ردود سلبية
  // =========================
  if (sentiment === "NEGATIVE") {
    const reply = pickRandom(RESP.NEGATIVE);
    return wrapWithTone(reply, language);
  }

  // =========================
  // 4) نية معرفة "من نحن"
  // =========================
  if (intent === "ABOUT") {
    const reply = pickRandom(RESP.ABOUT_NOVALINK);
    return wrapWithTone(reply, language);
  }

  // =========================
  // 5) طلب خدمة (نوفا بوت)
  // =========================
  if (intent === "SERVICES") {
    const reply = pickRandom(RESP.LEAD_SERVICE);
    return wrapWithTone(reply, language);
  }

  // =========================
  // 6) شراكة أو تعاون
  // =========================
  if (intent === "PARTNERSHIP") {
    const reply = pickRandom(RESP.LEAD_PARTNERSHIP);
    return wrapWithTone(reply, language);
  }

  // =========================
  // 7) استشارة
  // =========================
  if (intent === "CONSULTATION") {
    const reply =
      "يسعدني مساعدتك في رأي أو تحليل يناسب مشروعك. أخبرني باختصار بفكرة مشروعك أو هدفك، وسأقدم لك رؤية عملية بخطوات واضحة.";
    return wrapWithTone(reply, language);
  }

  // =========================
  // 8) دعم فني
  // =========================
  if (intent === "SUPPORT") {
    const reply =
      "يبدو أنك تواجه مشكلة… أخبرني بالتفاصيل وسأحاول إرشادك إلى الحل الأنسب خطوة بخطوة.";
    return wrapWithTone(reply, language);
  }

  // =========================
  // 9) لا يوجد أي تطابق واضح
  // =========================
  const noMatch = pickRandom(RESP.NO_MATCH);
  if (noMatch) return wrapWithTone(noMatch, language);

  // =========================
  // 10) الرد العام الافتراضي الأخير (GENERIC)
  // =========================
  const generic = pickRandom(RESP.GENERIC);
  return wrapWithTone(generic, language);
}

/**
 * تغليف الرد بحيث يلتزم بش
