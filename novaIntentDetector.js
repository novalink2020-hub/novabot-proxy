// ===========================================
// novaIntentDetector.js
// نظام بسيط لاكتشاف النوايا لنوفا بوت
// By Mohammed Abu Snaina – NOVALINK.AI
// ===========================================

/* ============ أدوات مساعدة للنصوص ============ */

function normalizeText(str = "") {
  return str
    .toLowerCase()
    .replace(/[.,!?؟،"“”()\-_:;«»]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(text, list) {
  return list.some((w) => text.includes(w));
}

function detectLanguage(raw) {
  if (!raw) return "ar";
  const hasArabic = /[\u0600-\u06FF]/.test(raw);
  if (hasArabic) return "ar";
  return "en";
}

function detectDialectHint(text) {
  if (!text) return null;
  // لهجة شامية تقريبية
  if (/[شس]و|هيك|كتير|ليش|زلمة|حابة|حلو كتير|مش/.test(text)) {
    return "levant";
  }
  // خليجي
  if (/وش|ليه|زود|واجد|هاشتاق|مره حلو/.test(text)) {
    return "gulf";
  }
  // مصري
  if (/ليه|إزاي|أوي|جامد|تمام أوي|مش قوي/.test(text)) {
    return "egypt";
  }
  return null;
}

function detectToneHint(text) {
  if (!text) return "neutral";
  const t = text;

  if (containsAny(t, ["شكرا", "شكرًا", "ممتاز", "رائع", "جميل", "حلو", "رهيب", "thank you", "thanks"])) {
    return "positive";
  }
  if (containsAny(t, ["محبط", "تعبان", "سيء", "سيئ", "متضايق", "ملل", "زهقان", "سيئة", "فاشل", "زعلان", "disappointed", "bad"])) {
    return "negative";
  }
  return "neutral";
}

/* ============ دالة كشف النوايا ============ */

export async function detectNovaIntent(userMessageRaw = "") {
  const raw = (userMessageRaw || "").trim();
  const normalized = normalizeText(raw);
  const language = detectLanguage(raw);
  const dialectHint = detectDialectHint(raw);
  const toneHint = detectToneHint(raw);

  let intentId = "unknown";
  let confidence = 0.4;
  let suggestedCard = null;

  // 1) تحيات
  if (
    containsAny(normalized, [
      "مرحبا",
      "مرحبا بك",
      "اهلا",
      "اهلاً",
      "السلام عليكم",
      "صباح الخير",
      "مساء الخير",
      "هاي",
      "هلا",
      "hello",
      "hi",
      "hey"
    ])
  ) {
    intentId = "greeting";
    confidence = 0.95;
  }

  // 2) شكر / كلمات إيجابية
  else if (
    containsAny(normalized, [
      "شكرا",
      "شكراً",
      "مشكور",
      "يسلمو",
      "ممتاز",
      "رائع",
      "جميل",
      "حلو",
      "سوبر",
      "top",
      "great",
      "awesome",
      "thanks",
      "thank you"
    ])
  ) {
    intentId = "thanks_positive";
    confidence = 0.95;
    suggestedCard = "subscribe"; // منطق تجاري: من ينبسط من البوت أقرب للاشتراك
  }

  // 3) شعور سلبي / إحباط
  else if (
    containsAny(normalized, [
      "محبط",
      "تعبان",
      "مالي خلق",
      "سيء",
      "سيئ",
      "سيئة",
      "مزعج",
      "فاشل",
      "زعلان",
      "ملان",
      "ملل",
      "زهقان",
      "depressed",
      "tired",
      "frustrated"
    ])
  ) {
    intentId = "negative_mood";
    confidence = 0.9;
    suggestedCard = "business_subscribe"; // نعرض عليه محتوى جاد يساعده يطوّر عمله
  }

  // 4) نية اشتراك في القائمة البريدية / النشرة
  else if (
    containsAny(normalized, [
      "اشترك",
      "اشتراك",
      "القائمة البريدية",
      "النشرة البريدية",
      "newsletter",
      "subscribe",
      "اشترك في",
      "سجل بريد",
      "سجّل بريد"
    ])
  ) {
    intentId = "subscribe";
    confidence = 0.95;
    suggestedCard = "subscribe";
  }

  // 5) تعاون / شراكة / رعاية محتوى
  else if (
    containsAny(normalized, [
      "تعاون",
      "شراكة",
      "برعاية",
      "sponsor",
      "sponsorship",
      "إعلان",
      "حملة",
      "collaboration",
      "partnership",
      "ورش عمل",
      "ورشة عمل",
      "co-create"
    ])
  ) {
    intentId = "collaboration";
    confidence = 0.95;
    suggestedCard = "collaboration";
  }

  // 6) Consulting / Purchase – استشارة، عرض سعر، شراء خدمات
  else if (
    containsAny(normalized, [
      "استشارة",
      "استشارات",
      "جلسة",
      "جلسة استشارية",
      "جلسة تطوير",
      "تطوير أعمال",
      "business coaching",
      "عرض سعر",
      "سعر الخدمة",
      "تكلفة",
      "كم السعر",
      "كم التكلفة",
      "buy",
      "purchase",
      "اشتري",
      "أشتري",
      "خدمة مدفوعة",
      "بوت لموقعي",
      "بوت لموقعي",
      "chatbot لموقعي",
      "عايز بوت",
      "اريد بوت",
      "أريد بوت"
    ])
  ) {
    intentId = "consulting";
    confidence = 0.97;
    suggestedCard = "bot_lead"; // بطاقة "بوت دردشة لعملك" لالتقاط lead فعلي
  }

  // 7) سؤال عن الذكاء الاصطناعي + الأعمال (المجال الأساسي)
  else {
    const aiKeywords = [
      "ذكاء اصطناعي",
      "الذكاء الاصطناعي",
      "ai",
      "chatgpt",
      "شات جي بي تي",
      "جيميني",
      "gemini",
      "نوفا بوت",
      "novabot",
      "نوفا لينك",
      "novalink",
      "أدوات",
      "ادوات",
      "أتمتة",
      "اوتومات",
      "اوتوميشن",
      "automation",
      "روبوت",
      "روبوت دردشة",
      "content ai",
      "توليد محتوى",
      "murf",
      "elevenlabs",
      "daryjat",
      "voice over",
      "تسجيل صوتي بالذكاء الاصطناعي"
    ];

    const businessKeywords = [
      "مشروع",
      "مشروعي",
      "بيزنس",
      "business",
      "تسويق",
      "ماركتنغ",
      "marketing",
      "مبيعات",
      "seals",
      "محتوى تسويقي",
      "brand",
      "براند",
      "ريادة",
      "ريادة أعمال",
      "startup",
      "ستارت اب",
      "إنتاجية",
      "productivity",
      "freelance",
      "فريلانسر",
      "خطة محتوى",
      "خطة تسويق"
    ];

    const isAiBusiness =
      containsAny(normalized, aiKeywords) || containsAny(normalized, businessKeywords);

    if (isAiBusiness) {
      intentId = "ai_business";
      confidence = 0.9;
      suggestedCard = null; // ممكن لاحقًا نربطها ببطاقات معينة لو حاب
    } else {
      intentId = "out_of_scope";
      confidence = 0.7;
      suggestedCard = null; // خارج نطاق نوفا لينك → رد تحفيزي فقط
    }
  }

  return {
    intentId,
    confidence,
    language,
    dialectHint,
    toneHint,
    suggestedCard
  };
}
