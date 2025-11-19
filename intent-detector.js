// intent-detector.js
// وحدة تحليل نية المستخدم + اللغة + المجال لمشروع نوفا لينك / نوفا بوت

"use strict";

const NOVA_CONFIG = require("./nova-config");

/**
 * تبسيط النص:
 * - تحويل إلى lowerCase
 * - إزالة مسافات زائدة
 */
function normalizeText(text = "") {
  if (!text || typeof text !== "string") return "";
  return text.trim().toLowerCase();
}

/**
 * كشف اللغة بشكل بسيط:
 * - لو يحتوي على حروف عربية → ar
 * - لو حروف لاتينية فقط تقريبًا → en
 * - غير ذلك → اللغة الأساسية من الكونفج
 */
function detectLanguage(message) {
  const text = message || "";
  const hasArabic = /[\u0600-\u06FF]/.test(text);
  const hasLatin = /[a-zA-Z]/.test(text);

  if (hasArabic && !hasLatin) return "ar";
  if (!hasArabic && hasLatin) return "en";

  return NOVA_CONFIG.META.PRIMARY_LANGUAGE || "ar";
}

/**
 * كشف بسيط للمجال:
 * هل الكلام غالبًا عن الذكاء الاصطناعي والأعمال أم لا؟
 */
function detectDomainFlags(message) {
  const text = normalizeText(message);

  const groups = NOVA_CONFIG.DOMAIN_KEYWORDS || {};
  const hits = {
    AI_CORE: [],
    AI_BRANDS: [],
    AI_TOOLS_BUSINESS: [],
    BUSINESS_CONTEXT: []
  };

  let totalHits = 0;

  for (const groupName of Object.keys(hits)) {
    const list = Array.isArray(groups[groupName]) ? groups[groupName] : [];
    list.forEach((kw) => {
      const normalizedKw = normalizeText(kw);
      if (!normalizedKw) return;
      if (text.includes(normalizedKw)) {
        hits[groupName].push(kw);
        totalHits++;
      }
    });
  }

  const isAIDomain = totalHits > 0;

  return {
    isAIDomain,
    hits,
    totalHits
  };
}

/**
 * حساب "درجة تطابق" بدائية بين النية والكلمات المفتاحية:
 * عدد الكلمات المطابقة / عدد الكلمات في قائمة النية (بحد أدنى)
 */
function computeIntentScore(text, keywords) {
  if (!keywords || keywords.length === 0) return 0;
  const normalized = normalizeText(text);

  let hitCount = 0;
  keywords.forEach((kw) => {
    const normKw = normalizeText(kw);
    if (!normKw) return;
    if (normalized.includes(normKw)) hitCount++;
  });

  if (hitCount === 0) return 0;

  const base = Math.max(keywords.length, 5);
  return hitCount / base;
}

/**
 * كشف النية:
 * 1) قواعد يدوية عالية الأولوية (SERVICES / PARTNERSHIP / CONSULTATION / SUBSCRIBE)
 * 2) ثم fallback على NOVA_CONFIG.INTENTS
 */
function detectIntent(message, language) {
  const text = message || "";
  const normalized = normalizeText(text);

  const hasAny = (arr) =>
    arr.some((kw) => normalized.includes(normalizeText(kw)));

  // 1) شراكات / تعاون
  if (
    hasAny([
      "شراكة",
      "شراكه",
      "تعاون",
      "تعاوُن",
      "partner",
      "partnership",
      "collaboration",
      "collaborate",
      "sponsor",
      "sponsorship",
      "رعاية",
      "رعايه"
    ])
  ) {
    return {
      label: "PARTNERSHIP",
      description: "نية تتعلق بالتعاون أو الشراكات مع نوفا لينك",
      score: 1
    };
  }

  // 2) بوت دردشة / استشارة حول بوت / مشروع
  const botWords = [
    "بوت دردشة",
    "شات بوت",
    "شاتبوت",
    "روبوت محادثة",
    "روبوت دردشة",
    "chatbot",
    "chat bot",
    "ai bot",
    "مساعد ذكي",
    "مساعد آلي"
  ];
  const consultWords = [
    "استشارة",
    "استشاره",
    "جلسة",
    "جلسه",
    "call",
    "zoom",
    "اجتماع",
    "meeting"
  ];
  const projectWords = [
    "مشروعي",
    "مشروع",
    "موقعي",
    "موقع",
    "عملي",
    "البزنس",
    "متجري",
    "متجر"
  ];

  const hasBot = hasAny(botWords);
  const hasConsult = hasAny(consultWords);
  const hasProject = hasAny(projectWords);

  if (hasBot || (hasConsult && hasProject)) {
    return {
      label: "CONSULTATION",
      description: "طلب استشارة أو بناء بوت ذكاء اصطناعي لموقع أو مشروع",
      score: 1
    };
  }

  // 3) خدمات / باقات / أسعار
  if (
    hasAny([
      "خدمات نوفا لينك",
      "خدماتكم",
      "خدمات",
      "الباقات",
      "الباقه",
      "باقات",
      "باقة",
      "الأسعار",
      "الاسعار",
      "سعر الخدمة",
      "سعر الخدمه",
      "سعر",
      "pricing",
      "plans",
      "services",
      "packages"
    ])
  ) {
    return {
      label: "SERVICES",
      description: "نية مرتبطة بمعرفة خدمات أو باقات نوفا لينك",
      score: 1
    };
  }

  // 4) اشتراك بالنشرة / القائمة البريدية
  if (
    hasAny([
      "النشرة البريدية",
      "النشره البريديه",
      "النشرة",
      "النشره",
      "قائمة البريدية",
      "القائمه البريديه",
      "القائمة البريدية",
      "newsletter",
      "subscribe",
      "اشترك",
      "اشتراك",
      "الاشتراك"
    ])
  ) {
    return {
      label: "LEARNING",
      description: "نية مرتبطة بمتابعة المحتوى أو النشرة البريدية لنوفا لينك",
      score: 0.9
    };
  }

  // 5) fallback على NOVA_CONFIG.INTENTS
  const intentsConfig = NOVA_CONFIG.INTENTS || {};
  let bestIntent = {
    label: "GENERIC",
    description: intentsConfig.GENERIC?.DESCRIPTION || "نية عامة",
    score: 0
  };

  for (const intentKey of Object.keys(intentsConfig)) {
    const intentDef = intentsConfig[intentKey];
    if (!intentDef || !Array.isArray(intentDef.KEYWORDS)) continue;

    const score = computeIntentScore(text, intentDef.KEYWORDS);

    if (score > bestIntent.score) {
      bestIntent = {
        label: intentDef.LABEL || intentKey,
        description: intentDef.DESCRIPTION || "",
        score
      };
    }
  }

  if (bestIntent.score < 0.15) {
    const generic = intentsConfig.GENERIC || {};
    return {
      label: generic.LABEL || "GENERIC",
      description: generic.DESCRIPTION || "نية عامة",
      score: 0
    };
  }

  return bestIntent;
}

/**
 * تقدير بسيط للمشاعر
 */
function detectSentiment(message) {
  const text = normalizeText(message);
  const intentsConfig = NOVA_CONFIG.INTENTS || {};

  const positiveDef = intentsConfig.FEEDBACK_POSITIVE;
  const negativeDef = intentsConfig.FEEDBACK_NEGATIVE;

  let posScore = 0;
  let negScore = 0;

  if (positiveDef && Array.isArray(positiveDef.KEYWORDS)) {
    posScore = computeIntentScore(text, positiveDef.KEYWORDS);
  }
  if (negativeDef && Array.isArray(negativeDef.KEYWORDS)) {
    negScore = computeIntentScore(text, negativeDef.KEYWORDS);
  }

  if (posScore === 0 && negScore === 0) {
    return {
      label: "NEUTRAL",
      score: 0
    };
  }

  if (posScore >= negScore) {
    return {
      label: "POSITIVE",
      score: posScore
    };
  }

  return {
    label: "NEGATIVE",
    score: negScore
  };
}

/**
 * واجهة تحليل موحّدة
 */
function analyzeUserMessage(message) {
  const lang = detectLanguage(message);
  const domain = detectDomainFlags(message);
  const intent = detectIntent(message, lang);
  const sentiment = detectSentiment(message);

  return {
    language: lang,
    intent,
    sentiment,
    domain,
    meta: {
      isAIDomain: domain.isAIDomain,
      totalDomainHits: domain.totalHits,
      rawTextLength: (message || "").length
    }
  };
}

module.exports = {
  detectLanguage,
  detectDomainFlags,
  detectIntent,
  detectSentiment,
  analyzeUserMessage
};
