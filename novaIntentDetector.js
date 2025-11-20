// novaIntentDetector.js
// Simple rule-based intent + language/dialect detector for NovaBot (NOVALINK.AI)
// By Mohammed Abu Snaina – can be extended later to use Gemini classifications.

const AR_LETTERS_REGEX = /[\u0600-\u06FF]/;

/**
 * كشف اللغة الأساسية للنص
 */
function detectLanguage(text) {
  const hasAr = AR_LETTERS_REGEX.test(text);
  const hasEn = /[a-zA-Z]/.test(text);

  if (hasAr && !hasEn) return "ar";
  if (hasEn && !hasAr) return "en";

  // لو خليط، نعتمد على الأغلب
  const arCount = (text.match(AR_LETTERS_REGEX) || []).length;
  const enCount = (text.match(/[a-zA-Z]/g) || []).length;

  if (arCount === 0 && enCount === 0) return "ar"; // افتراضي
  return arCount >= enCount ? "ar" : "en";
}

/**
 * محاولة بسيطة للتعرّف على اللهجة العربية
 * فقط لإضافة نكهة خفيفة، بدون مبالغة
 */
function detectArabicDialect(text) {
  const t = text.replace(/\s+/g, " ").toLowerCase();

  // مصري
  if (/\b(?:يا عم|يا راجل|إزيك|ازيك|عامل ايه|عامل ايه|مش كده|برضه)\b/.test(t)) {
    return "masri";
  }

  // خليجي
  if (/\b(?:شلونك|شخبارك|يا رجال|ياخي|وش السالفة|هالحين|الحين|زود)\b/.test(t)) {
    return "gulf";
  }

  // شامي (لبناني/سوري/أردني/فلسطيني)
  if (/\b(?:شو|هيك|ليه لأ|ماشي حاله|كتير|هسا|لسا|لسّه|إيمتى)\b/.test(t)) {
    return "levant";
  }

  // مغربي/جزائري/تونسي – نكتفي بكلمات بسيطة
  if (/\b(?:بزاف|واش|برشا|تو|ديما|صبَح|عفاك)\b/.test(t)) {
    return "maghrebi";
  }

  return null;
}

/**
 * نبرة شخصية نوفا بوت:
 * - always: محترف، متزن، محفّز، بدون مبالغة
 * - toneHint هنا فقط لموازنة درجة "التحفيز"
 */
function chooseTone(intentId) {
  switch (intentId) {
    case "learn":
    case "explore":
      return "friendly_explainer"; // شرح هادئ + تشجيع بسيط
    case "improve_business":
    case "buy_service":
      return "business_coach"; // احترافي + تحفيز عملي
    case "tools_discounts":
      return "deal_guide"; // واضح + مباشر + بدون مبالغة
    case "collaboration":
      return "partner_mode"; // رسمي دافئ
    case "subscribe":
      return "soft_invite"; // دعوة لطيفة بدون ضغط
    case "casual":
    default:
      return "light_conversation"; // خفيف لكن محترم
  }
}

/**
 * كشف النية الأساسية من الرسالة
 * يرجع:
 * {
 *   intentId,
 *   confidence,
 *   language,
 *   dialectHint,
 *   toneHint,
 *   suggestedCard
 * }
 */
function detectNovaIntent(rawText, options = {}) {
  const text = (rawText || "").trim();
  const lower = text.toLowerCase();

  const language = detectLanguage(text);
  const dialectHint = language === "ar" ? detectArabicDialect(text) : null;

  // ========= 1) حالات التحية / الكلام العابر =========
  const greetingsAr = /(مرحبا|مرحَباً|اهلاً|أهلاً|سلام|مساء الخير|صباح الخير|هلا|أهلا وسهلا)/i;
  const thanksAr = /(شكراً|شكرًا|مشكور|يسلمو|يعطيك العافية|تسلم)/i;
  const greetingsEn = /\b(hi|hello|hey|good (morning|evening|afternoon)|what's up|whats up)\b/i;
  const thanksEn = /\b(thanks|thank you|thx|appreciate it)\b/i;

  if (greetingsAr.test(text) || greetingsEn.test(text) || thanksAr.test(text) || thanksEn.test(text)) {
    return {
      intentId: "casual",
      confidence: 0.9,
      language,
      dialectHint,
      toneHint: chooseTone("casual"),
      suggestedCard: null
    };
  }

  // ========= 2) نية التعاون / الشراكات =========
  const collabAr = /(تعاون|رعاية محتوى|شراكة|شريك|ندوة|ورشة عمل|ورشة|محاضرة|افنت|فعالية|حدث)/i;
  const collabEn = /\b(collaborat(e|ion)|sponsorship|partner(ship)?|joint project|webinar|workshop)\b/i;

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

  // ========= 3) نية شراء خدمة / طلب بوت دردشة =========
  const buyAr = /(أريد(?:.*بوت|.*شات)|عايز بوت|احتاج بوت|ابغى بوت|أبغى بوت|بدي بوت|كم سعر البوت|سعر الخدمة|تكلفة البوت|تكلفة الخدمة|بكم البوت)/i;
  const buyEn = /\b(chatbot|ai bot|build a bot|pricing for bot|bot price|custom bot)\b/i;

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

  // ========= 4) نية تطوير الأعمال (استشارات / تحسين مشروع) =========
  const improveBizAr = /(طوّر|تطوير|تنمية|زيادة المبيعات|ارفع مبيعاتي|أحوّل شغلي|مشروعي|البيزنس|متجر إلكتروني|استراتيجية|خطة عمل|حملة تسويق|ماركتينج|إعلان ممول)/i;
  const improveBizEn = /\b(grow my business|increase sales|improve conversion|business strategy|marketing plan|scale my (store|business))\b/i;

  if (improveBizAr.test(text) || improveBizEn.test(lower)) {
    return {
      intentId: "improve_business",
      confidence: 0.85,
      language,
      dialectHint,
      toneHint: chooseTone("improve_business"),
      suggestedCard: "business_subscribe" // بطاقة تطوير الأعمال / الاشتراك للأعمال
    };
  }

  // ========= 5) أدوات + خصومات =========
  const toolsAr = /(أدوات ذكاء اصطناعي|أدوات للذكاء الاصطناعي|أفضل أدوات|ادوات ai|بديل|بدائل|مقارنة أدوات|أداة تساعدني)/i;
  const discountAr = /(خصم|كوبون|كوبونات|بروموكود|promo code|كود خصم|عرض خاص|صفقة)/i;
  const toolsEn = /\b(ai tools?|tool for|alternatives? to|compare tools?)\b/i;
  const discountEn = /\b(discount|coupon|promo code|deal|offer)\b/i;

  if (discountAr.test(text) || discountEn.test(lower) || toolsAr.test(text) || toolsEn.test(lower)) {
    return {
      intentId: "tools_discounts",
      confidence: 0.85,
      language,
      dialectHint,
      toneHint: chooseTone("tools_discounts"),
      suggestedCard: null // نوجّه المستخدم لصفحة الخصومات في الرد نفسه
    };
  }

  // ========= 6) نية الاشتراك بالبريد / النشرة =========
  const subscribeAr = /(اشترك|اشتراك|أريد الاشتراك|رسال(?:ات|ة) بريدية|نشرة بريدية|newsletter|قائمة البريد)/i;
  const subscribeEn = /\b(subscribe|newsletter|email list|join your list|mailing list)\b/i;

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

  // ========= 7) تعلّم / أسئلة معرفية بحتة =========
  const learnAr = /(اشرح|شرح|ما هو الذكاء الاصطناعي|ما هو الذكاء الإصطناعي|ما هو ai|كيف يعمل|أريد أن أفهم|فهم الموضوع|تعلم|تعليم|أبغى أتعلم|بدي اتعلم|كيف أبدأ في الذكاء الاصطناعي)/i;
  const learnEn = /\b(what is (ai|artificial intelligence)|explain|how does .* work|learn about ai|understand this)\b/i;

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

  // ========= 8) استكشاف عام (explore) =========
  const exploreAr = /(أين أبدأ|من أين أبدأ|دلّني|أرشدني|اقتراحات|أفكار|خطوات أولى|أول خطوة|ما هي الخيارات|ما المتاح)/i;
  const exploreEn = /\b(where do i start|how to start|give me ideas|suggestions|first steps|options do i have)\b/i;

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

  // ========= افتراضي: لو ولا واحدة من فوق انطبقت =========
  return {
    intentId: "explore",
    confidence: 0.5,
    language,
    dialectHint,
    toneHint: chooseTone("explore"),
    suggestedCard: null
  };
}

module.exports = {
  detectNovaIntent,
  detectLanguage,
  detectArabicDialect
};
