// ===========================================
// novaIntentDetector.js
// كشف نوايا نوفا بوت (ذكاء اصطناعي + تطوير أعمال + نوايا تعريفية)
// By Mohammed Abu Snaina – NOVALINK.AI
// ===========================================

/**
 * ملاحظات تصميم:
 * - فقط intent: "ai_business" يستدعي Gemini من novaBrainSystem.
 * - باقي النوايا تستخدم ردود ثابتة مؤتمتة (صفر تكلفة توكنز).
 * - أي موضوع خارج الذكاء الاصطناعي والأعمال → out_of_scope → رد تحفيزي.
 * - دعم لهجات: شامية، مصرية، خليجية، مغاربية على مستوى التحليل فقط.
 */

const ARABIC_RANGE_RE = /[\u0600-\u06FF]/;

/* ================= أدوات مساعدة للنص ================= */

function normalize(str = "") {
  return str
    .toLowerCase()
    .replace(/[.,!?؟،"“”()\-_:;«»[\]{}/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(text, list) {
  if (!text) return false;
  for (const kw of list) {
    if (!kw) continue;
    if (text.includes(kw)) return true;
  }
  return false;
}

function scoreByKeywords(text, list) {
  if (!text) return 0;
  let score = 0;
  for (const kw of list) {
    if (!kw) continue;
    if (text.includes(kw)) score += 1;
  }
  return score;
}

/* ============== كشف اللغة واللهجة ============== */

function detectLanguage(originalText = "") {
  if (!originalText) return "ar";
  return ARABIC_RANGE_RE.test(originalText) ? "ar" : "en";
}

function detectDialect(cleanText = "") {
  // شامية
  const levantWords = [
    "شو",
    "ليش",
    "لهيك",
    "هيك",
    "لسا",
    "لسه",
    "هسا",
    "سلامات",
    "تمام عليك",
    "بدي",
    "بدك",
    "كتير",
    "عنجد",
    "مو هيك",
    "مو كثير",
    "لساتني",
    "لساتك"
  ];

  // خليجية
  const gulfWords = [
    "وايد",
    "واجد",
    "زود",
    "مره",
    "مرة حلو",
    "حيل",
    "شلون",
    "شو رايك",
    "يا رجال",
    "توه",
    "توني",
    "سوي",
    "سويت",
    "دوم",
    "مقهور"
  ];

  // مصرية
  const egyptWords = [
    "ازاي",
    "ازاى",
    "ليه",
    "فين",
    "كويس",
    "تمام اوي",
    "اوي",
    "خالص",
    "لسه",
    "دلوقتي",
    "دلوقتى",
    "عايز",
    "عاوزه",
    "عايزة",
    "جامد",
    "بجد",
    "تحفه",
    "تحفة"
  ];

  // مغاربية
  const maghrebWords = [
    "بزاف",
    "بزّاف",
    "واش",
    "شنو",
    "شحال",
    "باغي",
    "بغيت",
    "دابا",
    "هكا",
    "هكاك",
    "برشا"
  ];

  if (containsAny(cleanText, levantWords)) return "levant";
  if (containsAny(cleanText, gulfWords)) return "gulf";
  if (containsAny(cleanText, egyptWords)) return "egypt";
  if (containsAny(cleanText, maghrebWords)) return "maghreb";

  return "msa"; // فصحى / عام عربي عام
}

/* ============== مجموعات الكلمات المفتاحية للنوايا ============== */

// 1) نية الذكاء الاصطناعي وتطوير الأعمال (ONLY ONE that uses AI)
const AI_BUSINESS_KEYWORDS = [
  // عربي عام
  "ذكاء اصطناعي",
  "الذكاء الاصطناعي",
  "ذكاء إصطناعي",
  "ذكاء صناعي",
  "ذكاء صنعي",
  "تعلم آلي",
  "تعلم آلى",
  "تعلم عميق",
  "نموذج لغوي",
  "نماذج لغوية",
  "نموذج لغة",
  "برومبت",
  "برومبتات",
  "بـرومبت",
  "اوتوماتيشن",
  "أتمتة",
  "أتمتة",
  "اتمتة",
  "تشات بوت",
  "شات بوت",
  "روبوت دردشة",
  "مساعد ذكي",
  "وكيل ذكي",
  "عميل ذكي",

  // أدوات / منصات
  "شات جي بي تي",
  "chatgpt",
  "chat-gpt",
  "gpt",
  "جي بي تي",
  "جيبت",
  "gemini",
  "جيميني",
  "bard",
  "openai",
  "اوپن اي",
  "أوبن إيه آي",
  "novabot",
  "نوفا بوت",
  "nova bot",
  "نوفا لينك",
  "novalink",
  "novalink ai",

  // محتوى وتسويق
  "توليد المحتوى",
  "توليد نصوص",
  "كتابة محتوى",
  "كتابة اعلانية",
  "كتابة إعلانية",
  "كتابة مقالات",
  "content",
  "copywriting",
  "copy writer",
  "محتوى سوشيال",
  "سوشيال ميديا",
  "محتوى ترويجي",
  "تحسين محركات البحث",
  "سيو",
  "seo",
  "martech",

  // تعليق صوتي و TTS (ضمن النية نفسها)
  "تعليق صوتي",
  "voice over",
  "voice-over",
  "tts",
  "text to speech",
  "نص الى كلام",
  "نص إلى كلام",
  "تحويل النص إلى صوت",
  "صوت بالذكاء الاصطناعي",
  "اصوات اصطناعية",
  "أصوات اصطناعية",
  "murf",
  "elevenlabs",
  "دريجات",
  "daryjat",

  // أعمال / بزنس
  "مشروعي",
  "مشروعي الخاص",
  "مشروع",
  "البزنس",
  "بزنس",
  "business",
  "startup",
  "ستارت اب",
  "ستارتاب",
  "ريادة اعمال",
  "ريادة أعمال",
  "رائد اعمال",
  "رائد أعمال",
  "تسويق",
  "ماركتنج",
  "marketing",
  "مبيعات",
  "sales",
  "تطوير الاعمال",
  "تطوير الأعمال",
  "ادارة الوقت",
  "إدارة الوقت",
  "انتاجية",
  "الإنتاجية",
  "productivity",
  "نمو المشروع",
  "نمو البزنس",
  "زيادة العملاء",
  "جذب عملاء",
  "توسيع مشروعي",
  "نمو الأعمال",

  // أوتوماتيشن ومسارات عمل
  "workflow",
  "workflows",
  "automation",
  "automations",
  "ربط الادوات",
  "ربط الأدوات",
  "تكامل الادوات",
  "تكامل الأدوات",
  "zapier",
  "make.com",
  "integromat",

  // فلوس / دخل إضافي مرتبط بأدوات رقمية
  "دخل اضافي",
  "دخل إضافي",
  "side hustle",
  "دخل جانبي",
  "مشروع جانبي",
  "عمل حر",
  "freelance",
  "freelancing",
  "دروب شيبنج",
  "دروبشيبينج",
  "تسويق بالعمولة",
  "افلييت",
  "affiliate",
  "affiliate marketing",

  // مصطلحات تقنية عامة مرتبطة بالـ AI
  "rag",
  "retrieval augmented generation",
  "embeddings",
  "فيكتور",
  "vector search",
  "llm",
  "large language model",
  "agents",
  "ai agent",
  "agentic",
  "fine tuning",
  "تدريب نموذج",
  "تخصيص نموذج"
];

// 2) ترحيب
const GREETING_KEYWORDS = [
  "مرحبا",
  "مرحباا",
  "اهلا",
  "أهلا",
  "اهلاً",
  "أهلاً",
  "السلام عليكم",
  "هاي",
  "هلا",
  "هلا والله",
  "هلو",
  "hi",
  "hello",
  "hey",
  "good morning",
  "good evening",
  "مساء الخير",
  "صباح الخير"
];

// 3) شكر / إيجابية
const THANKS_POSITIVE_KEYWORDS = [
  "شكرا",
  "شكراً",
  "شكرن",
  "ثانكس",
  "يعطيك العافية",
  "يعطيكو العافية",
  "يسلموا",
  "تسلم",
  "ممتاز",
  "رائع",
  "حلو",
  "جميل",
  "perfect",
  "thanks",
  "thank you",
  "great",
  "awesome",
  "useful",
  "افدتني",
  "فدتني",
  "افدتني كثير",
  "مفيد جدا",
  "مفيد جدًا"
];

// 4) مزاج سلبي / إحباط
const NEGATIVE_MOOD_KEYWORDS = [
  "محبط",
  "محبطة",
  "تعبان",
  "تعبانة",
  "زهقان",
  "زهقانه",
  "زعلان",
  "زعلانه",
  "فاشل",
  "حاس حالي فاشل",
  "حاسة حالي فاشلة",
  "يائس",
  "يائسة",
  "احبطت",
  "تعيس",
  "مكتئب",
  "محبط جدا",
  "مدايق",
  "متضايق",
  "مش نافع",
  "مش نافع معي",
  "مش راضي",
  "مش راضية",
  "failed",
  "depressed"
];

// 5) اشتراك / نشرة
const SUBSCRIBE_KEYWORDS = [
  "اشترك",
  "اشتراك",
  "النشرة",
  "نشرة نوفا",
  "newsletter",
  "mailing list",
  "subscribe",
  "تابع التحديثات",
  "بريدك",
  "بريدي",
  "ايميل",
  "إيميل",
  "email updates"
];

// 6) تعاون / شراكة
const COLLAB_KEYWORDS = [
  "تعاون",
  "شراكة",
  "نعمل مع بعض",
  "رعاية محتوى",
  "رعايه محتوى",
  "sponsorship",
  "sponsor",
  "collaboration",
  "partnership",
  "work together",
  "مشروع مشترك",
  "co-host",
  "ندوة مشتركة",
  "ورشة عمل",
  "ورش عمل",
  "افلييت",
  "affiliate deal",
  "affiliate program"
];

// 7) استشارة / شراء خدمة
const CONSULTING_KEYWORDS = [
  "استشارة",
  "استشاره",
  "جلسة استشارة",
  "جلسة استشاره",
  "consulting",
  "consultation",
  "كم السعر",
  "كم التكلفة",
  "كم تكلف",
  "بكم",
  "سعر الخدمة",
  "cost",
  "price",
  "fees",
  "اريد شراء",
  "بدي اشتري",
  "اريد بوت",
  "اريد بوت ذكاء",
  "بدي بوت",
  "بوت لموقعي",
  "بوت لموقعى",
  "chatbot لموقعي",
  "chatbot",
  "انشاء بوت دردشة",
  "انشاء بوت",
  "بوت ذكاء اصطناعي",
  "بوت ذكاء اصطناعى",
  "خدمة مدفوعة",
  "خدمة مدفوعه"
];

// 8) نوفا لينك / نوفا بوت – قصة، رؤية، رسالة، من أنتم؟
const NOVALINK_INFO_KEYWORDS = [
  "نوفا لينك",
  "novalink",
  "novalink ai",
  "nova link",
  "موقع نوفا لينك",
  "من انتم",
  "من أنتم",
  "مين انتو",
  "مين انتم",
  "من انت",
  "من انت؟",
  "شو هي نوفا لينك",
  "ما هي نوفا لينك",
  "ايش هي نوفا لينك",
  "حكيني عن نوفا لينك",
  "عن نوفا لينك",
  "تعريف نوفا لينك",
  "قصة نوفا لينك",
  "رحلة نوفا لينك",
  "رؤية نوفا لينك",
  "رسالة نوفا لينك",
  "هدف نوفا لينك",
  "vision novalink",
  "mission novalink",
  "nova mission",
  "nova vision",
  "من هو نوفا بوت",
  "من هو nova bot",
  "شو هو نوفا بوت",
  "ايش هو نوفا بوت",
  "تعريف نوفا بوت"
];

// 9) كلمات قويّة خارج النطاق (طبخ، جو، سيارات، موضة...)
//   إذا ظهرت *بدون* وجود كلمات AI/Business → out_of_scope أكيد
const HARD_OUT_OF_SCOPE_KEYWORDS = [
  // أكل / وصفات
  "مقلوبة",
  "كبسة",
  "كبسه",
  "منسف",
  "محشي",
  "بيتزا",
  "شاورما",
  "برجر",
  "شوربة",
  "طبخة",
  "طبخ",
  "وصفة",
  "وصفات",
  "كيك",
  "حلويات",

  // طقس
  "طقس",
  "الطقس",
  "درجة الحرارة",
  "درجات الحرارة",
  "weather",
  "جو اليوم",
  "الجو اليوم",
  "امطار",
  "ثلج",

  // سيارات
  "سيارة",
  "سيارات",
  "تويوتا",
  "مرسيدس",
  "bmw",
  "بي ام",
  "هوندا",
  "كيا",
  "هيونداي",
  "تأمين سيارة",

  // موضة / ملابس
  "موضة",
  "فساتين",
  "فستان",
  "احذية",
  "أحذية",
  "بنطلون",
  "تيشيرت",
  "قميص",
  "لبس",
  "ملابس",
  "makeup",
  "ميكب",
  "مكياج",

  // رياضة
  "كرة قدم",
  "مباراة",
  "ماتش",
  "ريال مدريد",
  "برشلونة",
  "ميسي",
  "رونالدو",
  "دوري",
  "رياضة",

  // سفر
  "سفر",
  "رحلة",
  "تذكرة طيران",
  "flight",
  "hotel",
  "حجز فندق",
  "فيزا",
  "تأشيرة",

  // صحة / طب
  "دواء",
  "دوائ",
  "مرض",
  "امراض",
  "طبيب",
  "دكتور",
  "علاج",
  "تحاليل",

  // أشياء عامة أخرى
  "مدرسة",
  "جامعة",
  "امتحان",
  "امتحانات",
  "العاب",
  "بلايستيشن",
  "ps5",
  "افلام",
  "مسلسلات",
  "اغاني",
  "أغاني",
  "فيلم",
  "مسلسل"
];

/* ============== الدالة الرئيسية ============== */

export async function detectNovaIntent(userMessage = "") {
  const original = (userMessage || "").trim();
  if (!original) {
    return {
      intentId: "casual",
      confidence: 0,
      language: "ar",
      dialectHint: "msa",
      toneHint: "neutral",
      suggestedCard: null
    };
  }

  const language = detectLanguage(original);
  const clean = normalize(original);
  const dialectHint = language === "ar" ? detectDialect(clean) : "en";

  // =========================
  // 1) حساب السكور لكل نية
  // =========================
  const aiScore = scoreByKeywords(clean, AI_BUSINESS_KEYWORDS);
  const greetScore = scoreByKeywords(clean, GREETING_KEYWORDS);
  const thanksScore = scoreByKeywords(clean, THANKS_POSITIVE_KEYWORDS);
  const negativeScore = scoreByKeywords(clean, NEGATIVE_MOOD_KEYWORDS);
  const subscribeScore = scoreByKeywords(clean, SUBSCRIBE_KEYWORDS);
  const collabScore = scoreByKeywords(clean, COLLAB_KEYWORDS);
  const consultScore = scoreByKeywords(clean, CONSULTING_KEYWORDS);
  const novalinkScore = scoreByKeywords(clean, NOVALINK_INFO_KEYWORDS);
  const hardOutScope = scoreByKeywords(clean, HARD_OUT_OF_SCOPE_KEYWORDS);

  // =========================
  // 2) كشف "خارج النطاق" بقوة
  // =========================
  if (hardOutScope > 0 && aiScore === 0) {
    return {
      intentId: "out_of_scope",
      confidence: 0.95,
      language,
      dialectHint,
      toneHint: "neutral",
      suggestedCard: null
    };
  }

  // =========================
  // 3) نوايا تعريف نوفا لينك / نوفا بوت
  // =========================
  if (novalinkScore > 0 && aiScore === 0) {
    return {
      intentId: "novalink_info",
      confidence: 0.9,
      language,
      dialectHint,
      toneHint: "neutral",
      suggestedCard: null
    };
  }

  // =========================
  // 4) استشارة أو شراء خدمة
  //    (خاصة بنوفا بوت / خدمات نوفا لينك)
  // =========================
  if (consultScore > 0) {
    return {
      intentId: "consulting_purchase",
      confidence: 0.9,
      language,
      dialectHint,
      toneHint: "neutral",
      suggestedCard: "bot_lead"
    };
  }

  // =========================
  // 5) تعاون / شراكة
  // =========================
  if (collabScore > 0) {
    return {
      intentId: "collaboration",
      confidence: 0.9,
      language,
      dialectHint,
      toneHint: "neutral",
      suggestedCard: "collaboration"
    };
  }

  // =========================
  // 6) اشتراك / نشرة
  // =========================
  if (subscribeScore > 0) {
    return {
      intentId: "subscribe_interest",
      confidence: 0.9,
      language,
      dialectHint,
      toneHint: "positive",
      suggestedCard: "subscribe"
    };
  }

  // =========================
  // 7) شكر / إيجابية
  // =========================
  if (thanksScore > 0 && aiScore === 0) {
    return {
      intentId: "thanks_positive",
      confidence: 0.9,
      language,
      dialectHint,
      toneHint: "positive",
      suggestedCard: "subscribe"
    };
  }

  // =========================
  // 8) مزاج سلبي / دعم معنوي
  // =========================
  if (negativeScore > 0 && aiScore === 0) {
    return {
      intentId: "negative_mood",
      confidence: 0.9,
      language,
      dialectHint,
      toneHint: "negative",
      suggestedCard: null
    };
  }

  // =========================
  // 9) ترحيب خالص (بدون سياق آخر)
  // =========================
  if (greetScore > 0 && original.length <= 40 && aiScore === 0) {
    return {
      intentId: "greeting",
      confidence: 0.9,
      language,
      dialectHint,
      toneHint: "positive",
      suggestedCard: null
    };
  }

  // =========================
  // 10) استفسار عن نوفا لينك + AI معًا
  //     (مثلاً: ما هي نوفا لينك ولماذا أنشئت؟)
  // =========================
  if (novalinkScore > 0 && aiScore > 0) {
    return {
      intentId: "novalink_info",
      confidence: 0.9,
      language,
      dialectHint,
      toneHint: "neutral",
      suggestedCard: null
    };
  }

  // =========================
  // 11) نية الذكاء الاصطناعي وتطوير الأعمال (ONLY AI)
  // =========================
  if (aiScore > 0) {
    let conf = 0.7;
    if (aiScore >= 4) conf = 0.95;
    else if (aiScore >= 2) conf = 0.85;

    // اختيار بطاقة مناسبة داخل نطاق الأعمال
    let suggestedCard = null;
    if (consultScore > 0) {
      suggestedCard = "bot_lead";
    } else if (subscribeScore > 0) {
      suggestedCard = "business_subscribe";
    }

    return {
      intentId: "ai_business",
      confidence: conf,
      language,
      dialectHint,
      toneHint: "neutral",
      suggestedCard
    };
  }

  // =========================
  // 12) إذا لا يوجد أي تطابق واضح
  //     → تعامل كـ خارج النطاق
  // =========================
  return {
    intentId: "out_of_scope",
    confidence: 0.6,
    language,
    dialectHint,
    toneHint: "neutral",
    suggestedCard: null
  };
}
