// ===========================================
// novaIntentDetector.js
// كاشف نوايا نوفا بوت (9 نوايا + out_of_scope)
// By Mohammed Abu Snaina – NOVALINK.AI
// ===========================================

/**
 * هذا الملف لا يستدعي Gemini مباشرة.
 * مهمته فقط:
 *  - قراءة سؤال المستخدم
 *  - تحديد النية (intentId)
 *  - اقتراح بطاقة (suggestedCard) عند الحاجة
 *  - إرجاع لغة المستخدم، لهجته التقريبية، ونبرة الكلام
 *
 * النوايا الحالية:
 *  - ai_business           → أسئلة الذكاء الاصطناعي + تطوير الأعمال (تشمل التعليق الصوتي)
 *  - learn_ai              → "أريد أن أتعلم الذكاء الاصطناعي" ومسارات التعلم
 *  - subscribe             → اهتمام بالنشرة البريدية / الاشتراك
 *  - collaboration         → تعاون وشراكات
 *  - consulting_purchase   → استشارة / شراء خدمة / بوت لموقعه
 *  - novalink_story        → من أنتم / قصة نوفا لينك / خدمات نوفا لينك
 *  - novabot_info          → ما هو نوفا بوت
 *  - casual                → تحيات / شكر / كلام خفيف
 *  - out_of_scope          → طقس / أكل / رياضة / مواضيع عامة بعيدة
 */

const ARABIC_LETTERS = /[\u0600-\u06FF]/;

// =======================
// أدوات مساعدة للنصوص
// =======================

function normalizeText(raw = "") {
  return raw
    .toLowerCase()
    .replace(/[\u064B-\u065F]/g, "") // إزالة الحركات
    .replace(/[.,!?؟،"“”()\-_:;«»[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text, list) {
  return list.some((kw) => text.includes(kw));
}

function detectLanguage(original) {
  return ARABIC_LETTERS.test(original) ? "ar" : "en";
}

function detectTone(text) {
  const positive = [
    "شكرا",
    "شكراً",
    "thanks",
    "thank you",
    "يسلمو",
    "يعطيك العافية",
    "ممتاز",
    "رائع",
    "جميل",
    "مفيد",
    "حلو"
  ];
  const negative = [
    "سيء",
    "سئ",
    "غلط",
    "خطأ",
    "مش مفيد",
    "ضعيف",
    "سيئ"
  ];

  if (hasAny(text, positive)) return "positive";
  if (hasAny(text, negative)) return "negative";
  return "neutral";
}

// =======================
// دوال تقييم النوايا
// =======================

function scoreCasual(text) {
  let s = 0;
  if (
    hasAny(text, [
      "مرحبا",
      "مرحبا ",
      "اهلا",
      "أهلا",
      "اهلاً",
      "السلام عليكم",
      "هاي",
      "هلا",
      "hi",
      "hello",
      "hey"
    ])
  ) {
    s += 2;
  }
  if (
    hasAny(text, [
      "شكرا",
      "شكراً",
      "thanks",
      "thank you",
      "thx",
      "يسلمو",
      "يعطيك العافية"
    ])
  ) {
    s += 2;
  }
  if (text.length <= 20) s += 0.5; // رسائل قصيرة جدًا → غالبًا تحية أو شكر
  return s;
}

/**
 * نية الذكاء الاصطناعي + تطوير الأعمال
 * تشمل:
 *  - أسئلة عن AI، أدواته، الإنتاجية، التسويق
 *  - التعليق الصوتي بالذكاء الاصطناعي (مُدمج هنا)
 */
function scoreAiBusiness(text) {
  let s = 0;

  const coreAi = [
    "ذكاء اصطناعي",
    "الذكاء الاصطناعي",
    "ai",
    "chatgpt",
    "شات جي بي تي",
    "نموذج لغوي",
    "نماذج لغوية",
    "llm",
    "agent",
    "agents",
    "وكلاء ذكيين",
    "autogpt"
  ];

  const business = [
    "مشروعي",
    "مشروع",
    "مشاريع",
    "بزنس",
    "بيزنس",
    "اعمالي",
    "أعمالي",
    "اعمال",
    "أعمال",
    "تسويق",
    "ماركتنج",
    "مبيعات",
    "مبيعاتي",
    "انشاء محتوى",
    "تسويق الكتروني",
    "اعلانات",
    "اعلان",
    "landing page",
    "فانل",
    "قمع مبيعات"
  ];

  const productivity = [
    "إنتاجية",
    "الانتاجية",
    "productivity",
    "أتمتة",
    "اتمتة",
    "automation",
    "workflow",
    "سير عمل",
    "روتين",
    "توفير وقت",
    "تقليل الجهد"
  ];

  // كلمات التعليق الصوتي + أدواته → هنا
  const voiceOver = [
    "تعليق صوتي",
    "التعليق الصوتي",
    "voice over",
    "voiceover",
    "voice-over",
    "تفريغ صوتي",
    "دبلجة",
    "دبلجه",
    "بودكاست",
    "بودكاستات",
    "قراءة نص",
    "نطق النص",
    "text to speech",
    "tts",
    "murf",
    "مرف",
    "elevenlabs",
    "eleven labs",
    "دارجات",
    "daryjat",
    "اصوات",
    "أصوات",
    "صوتيات"
  ];

  const tools = [
    "ادوات",
    "أدوات",
    "tool",
    "tools",
    "منصة",
    "منصات",
    "خدمة",
    "خدمات",
    "saas",
    "برمجيات",
    "برنامج"
  ];

  if (hasAny(text, coreAi)) s += 3;
  if (hasAny(text, business)) s += 2.5;
  if (hasAny(text, productivity)) s += 2;
  if (hasAny(text, tools)) s += 1.5;
  if (hasAny(text, voiceOver)) s += 2.5;

  // بعض العبارات الشائعة
  if (
    hasAny(text, [
      "طور مشروعي",
      "تطوير مشروعي",
      "طور عملي",
      "تطوير عملي",
      "استفيد من الذكاء الاصطناعي",
      "استخدم الذكاء الاصطناعي",
      "ادوات ذكاء اصطناعي",
      "أدوات ذكاء اصطناعي"
    ])
  ) {
    s += 2.5;
  }

  return s;
}

/**
 * نية تعلم الذكاء الاصطناعي
 */
function scoreLearnAi(text) {
  let s = 0;

  if (
    hasAny(text, [
      "تعلم",
      "اتعلم",
      "أتعلم",
      "مسار تعلم",
      "مسار تعلّم",
      "تعليم",
      "course",
      "كورس",
      "دورة",
      "دورات",
      "من الصفر",
      "ابدا من الصفر",
      "أبدأ من الصفر"
    ])
  ) {
    s += 1.5;
  }

  if (
    hasAny(text, [
      "تعلم الذكاء الاصطناعي",
      "اتعلم الذكاء الاصطناعي",
      "ادخل مجال الذكاء الاصطناعي",
      "أدخل مجال الذكاء الاصطناعي",
      "كيف ادخل مجال ai",
      "كيف ادخل مجال الذكاء الاصطناعي"
    ])
  ) {
    s += 3;
  }

  return s;
}

/**
 * نية الاشتراك في النشرة / البريد
 */
function scoreSubscribe(text) {
  let s = 0;
  if (
    hasAny(text, [
      "اشترك",
      "اشتراك",
      "النشرة",
      "نشرة بريدية",
      "newsletter",
      "subscribe",
      "بريدي",
      "بريدك",
      "ايميل",
      "email"
    ])
  ) {
    s += 3;
  }
  return s;
}

/**
 * نية التعاون والشراكات
 */
function scoreCollaboration(text) {
  let s = 0;
  if (
    hasAny(text, [
      "تعاون",
      "تعاون ",
      "شراكة",
      "شراكه",
      "partnership",
      "collaboration",
      "sponsor",
      "رعاية محتوى",
      "رعايه محتوى",
      "ورشة عمل",
      "ورش عمل",
      "ورشه عمل"
    ])
  ) {
    s += 3;
  }
  return s;
}

/**
 * نية الاستشارة / الشراء / بوت لمشروعه
 */
function scoreConsultingPurchase(text) {
  let s = 0;

  const priceWords = [
    "كم السعر",
    "كم التكلفة",
    "كم التكلفه",
    "كم يكلف",
    "بكم",
    "السعر",
    "التكلفة",
    "التكلفه",
    "price",
    "cost",
    "fee",
    "كم حقه",
    "كم حقها"
  ];

  const consultWords = [
    "استشارة",
    "استشاره",
    "consulting",
    "session",
    "جلسة",
    "جلسه",
    "جلسة استشارة",
    "جلسه استشاره",
    "استشارة مدفوعة",
    "استشاره مدفوعه"
  ];

  const botWords = [
    "بوت",
    "شات بوت",
    "chatbot",
    "بوت ذكاء اصطناعي",
    "بوت للعميل",
    "بوت لموقعي",
    "بوت على موقعي",
    "بوت على الموقع",
    "بوت لخدمة العملاء",
    "nova bot",
    "novabot",
    "نوفا بوت"
  ];

  if (hasAny(text, priceWords)) s += 3;
  if (hasAny(text, consultWords)) s += 3;
  if (hasAny(text, botWords)) s += 3;

  // عبارات قوية تدل على نية شراء / استشارة
  if (
    hasAny(text, [
      "اريد بوت",
      "بدي بوت",
      "اريد انشاء بوت",
      "اريد بوت ذكاء اصطناعي",
      "أريد بوت",
      "أريد شات بوت",
      "اريد استشارة",
      "أريد استشارة",
      "اريد جلسة",
      "أريد جلسة"
    ])
  ) {
    s += 2.5;
  }

  return s;
}

/**
 * نية قصة نوفا لينك / من أنتم / الخدمات
 */
function scoreNovaLinkStory(text) {
  let s = 0;

  if (
    hasAny(text, [
      "من انتم",
      "من أنتم",
      "من تكونون",
      "شو هي نوفا لينك",
      "ما هي نوفا لينك",
      "عن نوفا لينك",
      "novalink",
      "nova link",
      "novalink ai"
    ])
  ) {
    s += 3;
  }

  if (
    hasAny(text, [
      "قصة نوفا لينك",
      "قصتك",
      "قصتي",
      "رحلتك",
      "رحلتي",
      "كيف بدأت نوفا لينك",
      "كيف بدات نوفا لينك"
    ])
  ) {
    s += 3;
  }

  if (
    hasAny(text, [
      "خدمات نوفا لينك",
      "ما هي خدمات نوفا لينك",
      "شو خدمات نوفا لينك",
      "services novalink",
      "nova services"
    ])
  ) {
    s += 2;
  }

  return s;
}

/**
 * نية معلومات عن نوفا بوت نفسه
 */
function scoreNovaBotInfo(text) {
  let s = 0;
  if (hasAny(text, ["نوفا بوت", "nova bot", "novabot"])) {
    s += 3;
  }
  if (
    hasAny(text, [
      "ما هو نوفا بوت",
      "من هو نوفا بوت",
      "شو هو نوفا بوت",
      "تعرف عن نوفا بوت"
    ])
  ) {
    s += 2;
  }
  return s;
}

/**
 * نية out_of_scope: أكل / طقس / رياضة / أشياء عامة بعيدة
 */
function scoreOutOfScope(text) {
  let s = 0;

  const food = [
    "مقلوبة",
    "كبسة",
    "منسف",
    "بيتزا",
    "شاورما",
    "برجر",
    "كباب",
    "كعك",
    "حلويات",
    "طبخة",
    "اطباق",
    "اكل",
    "أكل",
    "وجبة",
    "وصفات",
    "وصفة"
  ];

  const weather = [
    "طقس",
    "الطقس",
    "weather",
    "درجة الحرارة",
    "حرارة",
    "حر",
    "برد",
    "ثلج",
    "مطر",
    "امطار",
    "أمطار"
  ];

  const sports = [
    "مباراة",
    "نتيجة مباراة",
    "برشلونة",
    "ريال مدريد",
    "كرة قدم",
    "كورة",
    "كورة قدم",
    "دوري",
    "رونالدو",
    "ميسي"
  ];

  if (hasAny(text, food)) s += 2;
  if (hasAny(text, weather)) s += 2;
  if (hasAny(text, sports)) s += 2;

  return s;
}

// =======================
// الدالة الرئيسية
// =======================

export async function detectNovaIntent(message = "") {
  const original = (message || "").trim();
  if (!original) {
    return {
      intentId: "casual",
      confidence: 0,
      language: "ar",
      dialectHint: "levant",
      toneHint: "neutral",
      suggestedCard: null
    };
  }

  const lang = detectLanguage(original);
  const text = normalizeText(original);
  const toneHint = detectTone(text);
  const dialectHint = lang === "ar" ? "levant" : null;

  // حساب السكور لكل نية
  const scores = {
    casual: scoreCasual(text),
    ai_business: scoreAiBusiness(text),
    learn_ai: scoreLearnAi(text),
    subscribe: scoreSubscribe(text),
    collaboration: scoreCollaboration(text),
    consulting_purchase: scoreConsultingPurchase(text),
    novalink_story: scoreNovaLinkStory(text),
    novabot_info: scoreNovaBotInfo(text),
    out_of_scope: scoreOutOfScope(text)
  };

  // منطق خاص للرسائل القصيرة جدًا (تحيات/شكر)
  if (scores.casual >= 2 && original.length <= 30) {
    return {
      intentId: "casual",
      confidence: 0.9,
      language: lang,
      dialectHint,
      toneHint,
      suggestedCard: null
    };
  }

  // اختيار أفضل نية (باستثناء out_of_scope مؤقتًا)
  const intentKeys = Object.keys(scores).filter(
    (k) => k !== "out_of_scope"
  );

  let bestIntent = "explore";
  let bestScore = 0;

  for (const key of intentKeys) {
    if (scores[key] > bestScore) {
      bestScore = scores[key];
      bestIntent = key;
    }
  }

  const outOfScopeScore = scores.out_of_scope;

  // إذا لا توجد نية قوية و out_of_scope عالي → نية خارج النطاق
  if (bestScore < 1 && outOfScopeScore >= 1.5) {
    return {
      intentId: "out_of_scope",
      confidence: 0.8,
      language: lang,
      dialectHint,
      toneHint,
      suggestedCard: null
    };
  }

  // إذا لا توجد نية واضحة إطلاقًا → explore عام
  if (bestScore < 1 && outOfScopeScore < 1.5) {
    return {
      intentId: "explore",
      confidence: 0.4,
      language: lang,
      dialectHint,
      toneHint,
      suggestedCard: null
    };
  }

  // تحويل أسماء النوايا الداخلية إلى intentId نهائي
  let intentId = bestIntent;
  let suggestedCard = null;

  switch (bestIntent) {
    case "ai_business":
      intentId = "ai_business";
      break;
    case "learn_ai":
      intentId = "learn";
      break;
    case "subscribe":
      intentId = "subscribe";
      suggestedCard = "subscribe";
      break;
    case "collaboration":
      intentId = "collaboration";
      suggestedCard = "collaboration";
      break;
    case "consulting_purchase":
      intentId = "consulting_purchase";
      // هذه النية مرتبطة ببطاقة bot_lead في الواجهة
      suggestedCard = "bot_lead";
      break;
    case "novalink_story":
      intentId = "novalink_story";
      break;
    case "novabot_info":
      intentId = "novabot_info";
      break;
    case "casual":
      intentId = "casual";
      break;
    default:
      intentId = "explore";
      break;
  }

  const confidence = Math.max(
    0.3,
    Math.min(1, bestScore / 4)
  );

  return {
    intentId,
    confidence,
    language: lang,
    dialectHint,
    toneHint,
    suggestedCard
  };
}
