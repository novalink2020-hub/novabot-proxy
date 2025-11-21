// ===========================================
// novaIntentDetector.js (Final v6.9 Production)
// نوايا نوفا بوت — ذكاء اصطناعي + أعمال + تعريف + تعاون + شراء + اشتراك + انطباعات
// ===========================================

/* ---------------------------
   1) كلمات مفتاحية للنوايا
--------------------------- */

// الذكاء الاصطناعي + تطوير الأعمال
const AI_BUSINESS = [
  "ذكاء", "الذكاء الاصطناعي", "ذكاء اصطناعي", "ai", "أداة", "أدوات",
  "أدوات ذكاء", "أدوات الذكاء", "محتوى", "إنشاء محتوى", "كتابة محتوى",
  "تطوير", "أطور", "مشروعي", "تطوير مشروع", "تطوير أعمال", "تحسين",
  "إنتاجية", "رفع الإنتاجية", "أتمتة", "workflow", "خطة", "استراتيجية",
  "تسويق", "ادارة أعمال", "تحسين سير العمل", "business", "content",
  "strategy", "startup", "scale", "machine learning", "neural",
  "voiceover", "تعليق صوتي", "murf", "elevenlabs", "daryjat",
  "text to speech", "tts", "صوت", "كتابة", "seo", "marketing",
  "bot", "chatbot", "llm"
];

// تعريف نوفا لينك
const NOVALINK_INFO = [
  "نوفا لينك", "ما هي نوفا لينك", "من هي نوفا لينك",
  "رؤية", "رسالة", "هدف", "قصة", "كيف بدأت", "تعريفكم",
  "من انتم", "عنكم", "منصة نوفا", "novalink"
];

// تعريف نوفا بوت
const NOVABOT_INFO = [
  "نوفا بوت", "ما هو نوفا بوت", "بوت نوفا", "nova bot",
  "novabot", "بوت", "مساعد", "chatbot", "bot info"
];

// التعاون والشراكات
const COLLABORATION = [
  "شراكة", "تعاون", "رعاية", "sponsor", "collaboration",
  "work together", "مشروع مشترك", "cooperate", "partnership"
];

// الاستشارة / الشراء
const CONSULTING_PURCHASE = [
  "اريد بوت", "اريد شراء", "اريد خدمة", "شراء", "سعر",
  "كم التكلفة", "استشارة", "consultation", "price", "cost",
  "purchase", "chat bot", "خدمة", "بوت لموقعي", "حجز",
  "اريد ضم", "اريد مساعد", "اريد تطوير"
];

// الاشتراك بالنشرة
const SUBSCRIBE = [
  "اشترك", "اشتراك", "subscribe", "newsletter",
  "سجلني", "قائمة بريدية", "اريد نشرة"
];

// كلمات إيجابية
const POSITIVE = [
  "شكرا", "ممتاز", "رائع", "تمام", "great", "thanks", "perfect", "amazing"
];

// كلمات سلبية
const NEGATIVE = [
  "سيء", "مش مضبوط", "مش شغال", "مش راضي", "bad", "error", "not working"
];

// خارج النطاق (Out Of Scope)
const OUT_OF_SCOPE = [
  "طقس", "الطقس", "اكل", "طبخة", "مقلوبة", "وصفة",
  "رياضة", "مباراة", "لاعب", "فيلم", "مسلسل", "اغنية",
  "توقعات", "ابراج", "حيوان", "قط", "كلب",
  "سفر", "طيران", "فندق", "رقم", "شارع"
];

/* ---------------------------
   2) Helpers
--------------------------- */

function normalize(text = "") {
  return text
    .toLowerCase()
    .replace(/[.,!?؟،"“”\-_:;()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(text, list) {
  return list.some((word) => text.includes(word.toLowerCase()));
}

/* ---------------------------
   3) Language Detection
--------------------------- */
function detectLanguage(text = "") {
  const ar = /[\u0600-\u06FF]/;
  return ar.test(text) ? "ar" : "en";
}

function detectDialect(text = "") {
  const t = normalize(text);
  if (t.includes("شو") || t.includes("هيك") || t.includes("ليش")) return "levant";
  if (t.includes("شلون") || t.includes("هالحين")) return "gulf";
  return "msa";
}

/* ---------------------------
   4) Intent Detection Core
--------------------------- */

export function detectNovaIntent(message = "") {
  const text = normalize(message);

  // 1) Out of scope → فورا
  if (containsAny(text, OUT_OF_SCOPE)) {
    return {
      intentId: "out_of_scope",
      confidence: 0.95,
      language: detectLanguage(message),
      dialectHint: detectDialect(message)
    };
  }

  // 2) Positive
  if (containsAny(text, POSITIVE)) {
    return {
      intentId: "positive",
      confidence: 0.9,
      language: detectLanguage(message),
      dialectHint: detectDialect(message)
    };
  }

  // 3) Negative
  if (containsAny(text, NEGATIVE)) {
    return {
      intentId: "negative",
      confidence: 0.9,
      language: detectLanguage(message),
      dialectHint: detectDialect(message)
    };
  }

  // 4) Subscription
  if (containsAny(text, SUBSCRIBE)) {
    return {
      intentId: "subscribe",
      confidence: 0.92,
      language: detectLanguage(message),
      dialectHint: detectDialect(message)
    };
  }

  // 5) Collaboration / Partnership
  if (containsAny(text, COLLABORATION)) {
    return {
      intentId: "collaboration",
      confidence: 0.92,
      language: detectLanguage(message),
      dialectHint: detectDialect(message)
    };
  }

  // 6) Consulting / Purchase
  if (containsAny(text, CONSULTING_PURCHASE)) {
    return {
      intentId: "consult_purchase",
      confidence: 0.94,
      language: detectLanguage(message),
      dialectHint: detectDialect(message)
    };
  }

  // 7) NovaLink Info
  if (containsAny(text, NOVALINK_INFO)) {
    return {
      intentId: "novalink_info",
      confidence: 0.93,
      language: detectLanguage(message),
      dialectHint: detectDialect(message)
    };
  }

  // 8) NovaBot Info
  if (containsAny(text, NOVABOT_INFO)) {
    return {
      intentId: "novabot_info",
      confidence: 0.93,
      language: detectLanguage(message),
      dialectHint: detectDialect(message)
    };
  }

  // 9) AI / Business (أهم نية)
  if (containsAny(text, AI_BUSINESS)) {
    return {
      intentId: "ai_business",
      confidence: 0.96,
      language: detectLanguage(message),
      dialectHint: detectDialect(message)
    };
  }

  // 10) Default → explore
  return {
    intentId: "explore",
    confidence: 0.5,
    language: detectLanguage(message),
    dialectHint: detectDialect(message)
  };
}
