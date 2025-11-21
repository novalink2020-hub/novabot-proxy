// novaIntentDetector.js
// Simple rule-based intent + language/dialect detector for NovaBot (NOVALINK.AI)

const AR_LETTERS_REGEX = /[\u0600-\u06FF]/;

// =====================
// كشف اللغة
// =====================
export function detectLanguage(text) {
  const hasAr = AR_LETTERS_REGEX.test(text);
  const hasEn = /[a-zA-Z]/.test(text);

  if (hasAr && !hasEn) return "ar";
  if (hasEn && !hasAr) return "en";

  const arCount = (text.match(AR_LETTERS_REGEX) || []).length;
  const enCount = (text.match(/[a-zA-Z]/g) || []).length;

  if (arCount === 0 && enCount === 0) return "ar";
  return arCount >= enCount ? "ar" : "en";
}

// =====================
// كشف اللهجة العربية
// =====================
export function detectArabicDialect(text) {
  const t = text.replace(/\s+/g, " ").toLowerCase();

  if (/\b(يا عم|يا راجل|إزيك|ازيك|عامل ايه|مش كده|برضه)\b/.test(t)) return "masri";
  if (/\b(شلونك|شخبارك|يا رجال|ياخي|وش السالفة|الحين|هالحين)\b/.test(t)) return "gulf";
  if (/\b(شو|هيك|ليه لأ|كتير|هسا|لسا|إيمتى)\b/.test(t)) return "levant";
  if (/\b(بزاف|واش|برشا|تو|ديما|عفاك)\b/.test(t)) return "maghrebi";

  return null;
}

// =====================
// نبرة الرد
// =====================
function chooseTone(intentId) {
  switch (intentId) {
    case "learn":
    case "explore":
      return "friendly_explainer";
    case "improve_business":
    case "buy_service":
      return "business_coach";
    case "tools_discounts":
      return "deal_guide";
    case "collaboration":
      return "partner_mode";
    case "subscribe":
      return "soft_invite";
    case "casual":
    default:
      return "light_conversation";
  }
}

// =====================
// كشف النية
// =====================
export function detectNovaIntent(rawText, options = {}) {
  const text = (rawText || "").trim();
  const lower = text.toLowerCase();

  const language = detectLanguage(text);
  const dialectHint = language === "ar" ? detectArabicDialect(text) : null;

  // --- نوايا ---
  const greetingsAr = /(مرحبا|اهلاً|سلام|مساء الخير|صباح الخير|هلا)/i;
  const thanksAr = /(شكراً|مشكور|يسلمو|يعطيك العافية)/i;
  const greetingsEn = /\b(hi|hello|hey|good (morning|evening|afternoon))\b/i;
  const thanksEn = /\b(thanks|thank you|thx)\b/i;

  if (greetingsAr.test(text) || greetingsEn.test(lower) || thanksAr.test(text) || thanksEn.test(lower)) {
    return {
      intentId: "casual",
      confidence: 0.9,
      language,
      dialectHint,
      toneHint: chooseTone("casual"),
      suggestedCard: null
    };
  }

  const collabAr = /(تعاون|رعاية محتوى|شراكة|ندوة|ورشة|فعالية)/i;
  const collabEn = /\b(collaborat(e|ion)|sponsorship|partner(ship)?)\b/i;

  if (collabAr.test(text) || collabEn.test(lower)) {
    return {
      intentId: "collaboration",
      confidence: 0.9,
      language,
      dialectHint,
      toneHint: chooseTone("collaboration"),
      suggestedCard: "collaboration"
    };
  }

  const buyAr = /(بوت|شات بوت|سعر البوت|تكلفة الخدمة|كم سعر)/i;
  const buyEn = /\b(chatbot|ai bot|bot price|custom bot)\b/i;

  if (buyAr.test(text) || buyEn.test(lower)) {
    return {
      intentId: "buy_service",
      confidence: 0.9,
      language,
      dialectHint,
      toneHint: chooseTone("buy_service"),
      suggestedCard: "bot_lead"
    };
  }

  const improveBizAr = /(تطوير|زيادة المبيعات|مشروعي|متجر إلكتروني|خطة عمل|ماركتينج)/i;
  const improveBizEn = /\b(grow my business|increase sales|business strategy)\b/i;

  if (improveBizAr.test(text) || improveBizEn.test(lower)) {
    return {
      intentId: "improve_business",
      confidence: 0.85,
      language,
      dialectHint,
      toneHint: chooseTone("improve_business"),
      suggestedCard: "business_subscribe"
    };
  }

  const toolsAr = /(أدوات|بديل|بدائل|مقارنة أدوات)/i;
  const discountAr = /(خصم|كود خصم|كوبون|عرض خاص)/i;
  const toolsEn = /\b(ai tools?|alternatives?)\b/i;
  const discountEn = /\b(discount|coupon|deal|offer)\b/i;

  if (discountAr.test(text) || discountEn.test(lower) || toolsAr.test(text) || toolsEn.test(lower)) {
    return {
      intentId: "tools_discounts",
      confidence: 0.85,
      language,
      dialectHint,
      toneHint: chooseTone("tools_discounts"),
      suggestedCard: null
    };
  }

  const subscribeAr = /(اشترك|اشتراك|نشرة بريدية|newsletter)/i;
  const subscribeEn = /\b(subscribe|newsletter)\b/i;

  if (subscribeAr.test(text) || subscribeEn.test(lower)) {
    return {
      intentId: "subscribe",
      confidence: 0.9,
      language,
      dialectHint,
      toneHint: chooseTone("subscribe"),
      suggestedCard: "subscribe"
    };
  }

  const learnAr = /(اشرح|تعلم|ما هو الذكاء الاصطناعي|كيف يعمل)/i;
  const learnEn = /\b(what is ai|explain|learn about ai)\b/i;

  if (learnAr.test(text) || learnEn.test(lower)) {
    return {
      intentId: "learn",
      confidence: 0.8,
      language,
      dialectHint,
      toneHint: chooseTone("learn"),
      suggestedCard: null
    };
  }

  const exploreAr = /(دلني|اقتراحات|أفكار|أين أبدأ)/i;
  const exploreEn = /\b(where do i start|suggestions|ideas)\b/i;

  if (exploreAr.test(text) || exploreEn.test(lower)) {
    return {
      intentId: "explore",
      confidence: 0.75,
      language,
      dialectHint,
      toneHint: chooseTone("explore"),
      suggestedCard: null
    };
  }

  return {
    intentId: "explore",
    confidence: 0.5,
    language,
    dialectHint,
    toneHint: chooseTone("explore"),
    suggestedCard: null
  };
}
