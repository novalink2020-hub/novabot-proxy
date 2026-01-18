// ===========================================
// novaIntentDetector.js
// كشف نوايا نوفا بوت (ذكاء اصطناعي + تطوير أعمال + نوايا تعريفية)
// By Mohammed Abu Snaina – NOVALINK.AI
// ===========================================

/**
 * ملاحظات تصميم:
 * - فقط intent: "ai_business" يستدعي Gemini من novaBrainSystem.
 * - باقي النوايا تستخدم ردود ثابتة مؤتمتة (صفر تكلفة توكنز).
 * - أي موضوع خارج الذكاء الاصطناعي وتطوير الأعمال → out_of_scope → رد تحفيزي.
 * - دعم لهجات: شامية، مصرية، خليجية، مغاربية على مستوى التحليل فقط.
 */

const ARABIC_RANGE_RE = /[\u0600-\u06FF]/;

/* ================= أدوات مساعدة للنص ================= */

function normalize(str = "") {
  return str
    .toLowerCase()
    .replace(/[.,!?؟،"“”()\-_:\;«»[\]{}/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesKeyword(text, kw) {
  if (!text || !kw) return false;
  const t = ` ${text} `;
  const k = ` ${kw} `;
  return t.includes(k);
}

function containsAny(text, list) {
  if (!text) return false;
  for (const kw of list) {
    if (!kw) continue;
    if (includesKeyword(text, kw)) return true;
  }
  return false;
}

function scoreByKeywords(text, list) {
  if (!text) return 0;
  let score = 0;
  for (const kw of list) {
    if (!kw) continue;
    if (includesKeyword(text, kw)) score += 1;
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

/**
 * 1) نية الذكاء الاصطناعي وتطوير الأعمال
 *    (هي النية الوحيدة التي تستدعي Gemini)
 */
const AI_BUSINESS_KEYWORDS = [
  // عربي عام عن الذكاء الاصطناعي
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

  // أدوات / منصات ذكاء اصطناعي
  "شات جي بي تي",
  "chatgpt",
  "chat gpt",
  "chat-gpt",
  "gpt",
  "جي بي تي",
  "جيبت",
  "gemini",
  "جيميني",
  "bard",
  "openai",
  "أوبن إيه آي",
  "novabot",
  "نوفا بوت",
  "nova bot",

  // محتوى وتسويق
  "توليد المحتوى",
  "توليد نصوص",
  "كتابة محتوى",
  "كتابة اعلانية",
  "كتابة إعلانية",
  "كتابة مقالات",
  "محتوى سوشيال",
  "سوشيال ميديا",
  "محتوى ترويجي",
  "تحسين محركات البحث",
  "سيو",
  "seo",
  "ماركتنج",
  "marketing",
  "content",
  "copywriting",
  "copy writer",
    // Content plan / strategy (so "خطة محتوى تسويقي" is in-scope)
  "خطة محتوى",
  "خطة تسويق",
  "خطة تسويقية",
  "تسويقي",
  "تسويقية",
  "content plan",
  "content strategy",
  "حملات اعلانية",
  "حملات إعلانية",
  "اعلانات ممولة",
  "إعلانات ممولة",
  "إعلانات فيسبوك",
  "اعلانات فيسبوك",
  "فيسبوك ادز",
  "facebook ads",
  "instagram ads",
  "انستغرام ادز",

  // تعليق صوتي و TTS ضمن نفس النية
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

  // بزنس / مشاريع / متاجر / شركات
  "مشروعي",
  "مشروعي الخاص",
  "مشروع",
  "مشروع تجاري",
  "مشروع اونلاين",
  "مشروع أونلاين",
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
  "تسويق رقمي",
  "digital marketing",
  "مبيعات",
  "sales",
  "تطوير الاعمال",
  "تطوير الأعمال",
  "تطوير مشروعي",
  "تطوير شركتي",
  "تطوير الشركة",
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
  "توسيع شركتي",
  "زيادة التفاعل",
  "زيادة تفاعل المشتركين",
  "زيادة التفاعل على الصفحة",
  "صفحة تجارية",
  "حساب تجاري",
  "متجر الكتروني",
  "متجر إلكتروني",
  "متجر اونلاين",
  "متجر أونلاين",
  "ecommerce",
  "e-commerce",
  "شوبيفاي",
  "shopify",
  "ووكومرس",
  "woocommerce",

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
  "ai",
  "artificial intelligence",
  "machine learning",
  "deep learning",
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

/**
 * 1-bis) كلمات بزنس قوية (بدون ذكر AI صريح)
 * تستخدم للفصل بين "سيارات + ذكاء اصطناعي" (خارج النطاق)
 * و "مشروعي / متجري / شركتي / مبيعات" (داخل النطاق).
 */
const BUSINESS_ONLY_KEYWORDS = [
  "مشروعي",
  "مشروعي الخاص",
  "مشروع",
  "مشروع تجاري",
  "مشروع اونلاين",
  "مشروع أونلاين",
  "شركتي",
  "الشركة",
  "شركة",
  "بيزنس",
  "بزنس",
  "business",
  "startup",
  "ستارت اب",
  "ستارتاب",
  "متجر الكتروني",
  "متجر إلكتروني",
  "متجر اونلاين",
  "متجر أونلاين",
  "متجر",
  "متجري",
  "متجرى",
  "حساب تجاري",
  "صفحة تجارية",
  "منتج رقمي",
  "خدمة رقمية",
  "زيادة التفاعل",
  "زيادة تفاعل المشتركين",
  "زيادة المبيعات",
  "رفع المبيعات",
  "نمو المشروع",
  "نمو البزنس",
  "تسويق",
  "تسويق رقمي",
  "marketing",
  "مبيعات",
  "sales",
  "عمل حر",
  "freelance",
  "دخل إضافي",
  "دخل اضافي",
  "side hustle"
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
    // English negative feedback (common)
  "not helpful",
  "this is not helpful",
  "unhelpful",
  "useless",
  "bad answer",
  "not good",
  "doesn't help",
  "does not help",
  "wrong",
    // Arabic negative feedback (common)
  "ردك مش مفيد",
  "ردك غير مفيد",
  "غير مفيد",
  "مش مفيد",
  "مو مفيد",
  "سيء",
  "سيء جدا",
  "رد سيء",
  "كلام فاضي",
  "مش عاجبني",
  "مو عاجبني",
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
  "شريك",
  "اريد التعاون",
  "اريد شراكة",
  "تعاون مع نوفا لينك",
  "شراكة مع نوفا لينك",
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
  "بوت لمتجري",
  "chatbot لموقعي",
  "chatbot",
  "انشاء بوت دردشة",
  "انشاء بوت",
  "بوت ذكاء اصطناعي",
  "بوت ذكاء اصطناعى",
  "خدمة مدفوعة",
  "خدمة مدفوعه",
  "اريد شراء بوت ذكاء",
  "اريد شراء بوت ذكاء اصطناعي"
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
  "من انتي نوفا لينك",
  "من هي نوفا لينك",
  "شو هي نوفا لينك",
  "ما هي نوفا لينك",
  "ايش هي نوفا لينك",
  "حكيني عن نوفا لينك",
  "عن نوفا لينك",
  "تعريف نوفا لينك",
  "قصة نوفا لينك",
  "رحلة نوفا لينك",
  "كيف تأسست نوفا لينك",
  "كيف تاسست نوفا لينك",
  "كيف انطلقت نوفا لينك",
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
  "تعريف نوفا بوت",
  "ما هو نوفا بوت"
];
// كلمات قوية تدل أن السؤال "عن نوفا لينك نفسها" (وليس مجرد ذكرها كمصدر)
const NOVALINK_STRONG_CUES = [
  "من نحن",
  "من انتم",
  "من أنتم",
  "مين انتو",
  "مين انتم",
  "حكيني عن",
  "عن نوفا لينك",
  "تعريف",
  "قصة",
  "رحلة",
  "كيف تأسست",
  "كيف تاسست",
  "كيف انطلقت",
  "رؤية",
  "رسالة",
  "هدف",
  "mission",
  "vision",
  "about",
  "who are you",
  "what is novalink"
];

// عبارات تشير أن "نوفا لينك" مجرد مرجع/مصدر (وليس موضوع السؤال)
const NOVALINK_REFERENCE_ONLY_CUES = [
  "من وجهة نظر",
  "بحسب",
  "حسب",
  "على مدونة",
  "على موقع",
  "بناء على",
  "وفق",
  "as a",
  "from the perspective",
  "according to"
];

function hasNovaLinkName(cleanText = "") {
  return (
    includesKeyword(cleanText, "نوفا لينك") ||
    includesKeyword(cleanText, "novalink") ||
    includesKeyword(cleanText, "nova link") ||
    includesKeyword(cleanText, "novalink ai")
  );
}

function detectNovaLinkSubIntent(cleanText = "") {
  // priority: story -> mission -> vision -> about(default)
  if (containsAny(cleanText, ["قصة", "رحلة", "كيف تأسست", "كيف تاسست", "كيف انطلقت", "story"])) return "story";
  if (containsAny(cleanText, ["رسالة", "mission", "هدف"])) return "mission";
  if (containsAny(cleanText, ["رؤية", "vision"])) return "vision";
  return "about";
}

function isNovaLinkReferenceOnly(cleanText = "") {
  // إذا كانت الرسالة فيها "مرجع فقط" ولا تحتوي مؤشرات تعريف قوية → تعاملها كمرجع لا كنوايا novalink_info
  if (!hasNovaLinkName(cleanText)) return false;
  const isRef = containsAny(cleanText, NOVALINK_REFERENCE_ONLY_CUES);
  const isStrong = containsAny(cleanText, NOVALINK_STRONG_CUES);
  return isRef && !isStrong;
}

// 9) كلمات قويّة خارج النطاق (طبخ، جو، سيارات، موضة...)
//   إذا ظهرت بدون وجود كلمات بزنس → out_of_scope أكيد
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
  "اكل",
  "أكل",
  "مكرونة",
  "مكرونه",
  "معكرونة",
  "معكرونه",
  "سفرة",
  "مطبخ",
  "شيف",
  "طباخ",
  "طهي",
  "كيك",
  "معجنات",

  // طقس
  "طقس",
  "الطقس",
  "حالة الطقس",
  "درجة الحرارة",
  "حرارة",
  "تنبؤ",
  "احوال الطقس",
  "أحوال الطقس",
  "برد",
  "حر",
  "ثلج",
  "مطر",
  "امطار",
  "أمطار",
  "عاصفة",
  "عواصف",

  // سيارات
  "سيارة",
  "سيارات",
  "محرك",
  "محركات",
  "زيت محرك",
  "كراج",
  "كراجات",
  "مكانيكي",
  "ميكانيكي",
  "موتور",
  "جير",
  "gear",
  "سيارة كهربائية",
  "tesla",
  "تسلا",

  // موضة / عطور
  "عطر",
  "عطور",
  "برفيوم",
  "بيرفيوم",
  "موضة",
  "فاشون",
  "ازياء",
  "أزياء",
  "ملابس",
  "لبس",
  "fashion",
  "runway",
  "شانيل",
  "dior",
  "لوبوتان",
  "شنط",
  "حقائب",

  // سفر / سياحة
  "سفر",
  "سياحة",
  "سياحه",
  "رحلات",
  "رحلة",
  "تذاكر طيران",
  "طيران",
  "فيزا",
  "هجرة",
  "هجره",
  "اقامة",
  "إقامة",
  "تأشيرة",
  "تاشيرة",
  "تأشيره",
  "تاشيره",
  "فندق",
  "فنادق",
  "حجز فندق",
  "حجوزات",

  // رياضة
  "كرة",
  "كرة قدم",
  "مباراة",
  "ماتش",
  "بطولة",
  "رياضة",
  "رياضه",
  "تمرين",
  "جيم",
  "كمال اجسام",
  "كمال أجسام",
  "bodybuilding",

  // موسيقى / أفلام / ألعاب
  "موسيقى",
  "أغنية",
  "اغنية",
  "أغاني",
  "اغاني",
  "فيلم",
  "افلام",
  "أفلام",
  "مسلسل",
  "مسلسلات",
  "بلايستيشن",
  "ps5",
  "ps4",
  "اكس بوكس",
  "xbox",
  "نينتندو",
  "لعبة",
  "العاب",
  "ألعاب",

  // تعليم جامعي / امتحانات (خارج البزنس/AI)
  "جامعة",
  "جامعه",
  "امتحان",
  "امتحانات",
  "مدرسة",
  "مدرسه",
  "طلاب",
  "طالب",
  "معلم",
  "معلمة"
];

/* ============== الدالة الرئيسية ============== */

export async function detectNovaIntent(userMessage = "") {
  const original = (userMessage || "").trim();
  if (!original) {
return { intentId: "casual", intent: "casual", confidence: 0, language: "ar", dialectHint: "msa", toneHint: "neutral", suggestedCard: null, aiScore: 0, bizScore: 0 };

  }

  const language = detectLanguage(original);
  const clean = normalize(original);
  const dialectHint = language === "ar" ? detectDialect(clean) : "en";

  // =========================
  // 1) حساب السكور لكل نية
  // =========================
  const aiScore = scoreByKeywords(clean, AI_BUSINESS_KEYWORDS);
  const bizScore = scoreByKeywords(clean, BUSINESS_ONLY_KEYWORDS);
  const greetScore = scoreByKeywords(clean, GREETING_KEYWORDS);
  const thanksScore = scoreByKeywords(clean, THANKS_POSITIVE_KEYWORDS);
  const negativeScore = scoreByKeywords(clean, NEGATIVE_MOOD_KEYWORDS);
  const subscribeScore = scoreByKeywords(clean, SUBSCRIBE_KEYWORDS);
  const collabScore = scoreByKeywords(clean, COLLAB_KEYWORDS);
  const consultScore = scoreByKeywords(clean, CONSULTING_KEYWORDS);
  const novalinkScore = scoreByKeywords(clean, NOVALINK_INFO_KEYWORDS);
  const hardOutScope = scoreByKeywords(clean, HARD_OUT_OF_SCOPE_KEYWORDS);

const buildResult = (payload) => ({ ...payload, intent: payload?.intentId || null, aiScore, bizScore });

  // =========================
  // 2) كشف "خارج النطاق" بقوة
  //    أي موضوع طبخ/طقس/سيارات/موضة/طب... بدون بزنس
  // =========================
  if (hardOutScope > 0 && bizScore === 0) {
    return buildResult({
      intentId: "out_of_scope",
      confidence: 0.95,
      language,
      dialectHint,
      toneHint: "neutral",
      suggestedCard: null
    });
  }

  // =========================
  // 3) نوايا تعريف نوفا لينك / نوفا بوت بحتة
  // =========================
  // تعريف "مين أنتم؟" حتى لو لم يذكر اسم NovaLink صراحة
  const strongNovaGlobal = scoreByKeywords(clean, NOVALINK_STRONG_CUES);
  if (strongNovaGlobal > 0) {
    return buildResult({
      intentId: "novalink_info",
      sub_intent: detectNovaLinkSubIntent(clean),
      confidence: 0.9,
      language,
      dialectHint,
      toneHint: "neutral",
      suggestedCard: null
    });
  }

  // novalink_info فقط عندما يكون السؤال "عن نوفا لينك نفسها" (مش مجرد ذكرها كمصدر)
  if (hasNovaLinkName(clean) && !isNovaLinkReferenceOnly(clean)) {
    const strongNova = scoreByKeywords(clean, NOVALINK_STRONG_CUES);

    // إذا السؤال فيه مؤشرات تعريف قوية، أو لا يوجد سياق AI/Biz أصلاً → نوصلها لـ novalink_info
    if (strongNova > 0 || (aiScore === 0 && bizScore === 0)) {
      return buildResult({
        intentId: "novalink_info",
        sub_intent: detectNovaLinkSubIntent(clean),
        confidence: 0.9,
        language,
        dialectHint,
        toneHint: "neutral",
        suggestedCard: null
      });
    }
  }

  // =========================
  // 4) استشارة أو شراء خدمة
  // =========================
  if (consultScore > 0) {
    return buildResult({
      intentId: "consulting_purchase",
      confidence: 0.9,
      language,
      dialectHint,
      toneHint: "neutral",
      suggestedCard: "bot_lead"
    });
  }

  // =========================
  // 5) تعاون / شراكة
  // =========================
  if (collabScore > 0) {
    return buildResult({
      intentId: "collaboration",
      confidence: 0.9,
      language,
      dialectHint,
      toneHint: "neutral",
      suggestedCard: "collaboration"
    });
  }

   // =========================
  // 6) اشتراك / نشرة
  // =========================
  // شرط ذكي: "اشتراك" لا يعني دائمًا نوفا لينك (Spotify/Netflix/ChatGPT...)
  // لذلك:
  // - نستثني الخدمات الخارجية
  // - ونطلب إشارة صريحة لنوفا لينك أو النشرة/التحديثات
  if (subscribeScore > 0 && aiScore === 0 && bizScore === 0) {
    const externalSubscription =
      containsAny(clean, [
        "netflix",
        "نتفليكس",
        "spotify",
        "سبوتيفاي",
        "chatgpt",
        "شات جي بي تي",
        "openai",
        "يوتيوب",
        "youtube",
        "premium",
        "بريميوم"
      ]);

    const novalinkSubscriptionCue =
      hasNovaLinkName(clean) ||
      containsAny(clean, [
        "نشرة",
        "newsletter",
        "mailing list",
        "تابع التحديثات",
        "تحديثات",
        "email updates",
        "نشرة نوفا"
      ]);

    if (!externalSubscription && novalinkSubscriptionCue) {
      return buildResult({
        intentId: "subscribe_interest",
        confidence: 0.9,
        language,
        dialectHint,
        toneHint: "positive",
        suggestedCard: "subscribe"
      });
    }
  }

  // سلبية + سؤال AI/Biz → "احتواء + جواب" داخل ai_business (بدل negative_mood فقط)
  // مهم: لا نقترح business_subscribe في لحظة السلبية إطلاقًا
  if (negativeScore > 0 && (aiScore > 0 || bizScore > 0)) {
    let conf = 0.7;
    const combinedScore = aiScore + bizScore;
    if (combinedScore >= 4) conf = 0.95;
    else if (combinedScore >= 2) conf = 0.85;

    let suggestedCard = null;
    if (consultScore > 0) suggestedCard = "bot_lead";

    return buildResult({
      intentId: "ai_business",
      confidence: conf,
      language,
      dialectHint,
      toneHint: "negative",
      suggestedCard
    });
  }

  // =========================
  // 7) شكر / إيجابية
  // =========================
  if (thanksScore > 0 && aiScore === 0) {
    return buildResult({
      intentId: "thanks_positive",
      confidence: 0.9,
      language,
      dialectHint,
      toneHint: "positive",
      suggestedCard: "subscribe"
    });
  }

  // =========================
  // 8) مزاج سلبي / دعم معنوي
  // =========================
  if (negativeScore > 0 && aiScore === 0 && bizScore === 0) {
    return buildResult({
      intentId: "negative_mood",
      confidence: 0.9,
      language,
      dialectHint,
      toneHint: "negative",
      suggestedCard: null
    });
  }

  // =========================
  // 9) ترحيب خالص (بدون سياق آخر)
  // =========================
  if (greetScore > 0 && original.length <= 40 && aiScore === 0) {
    return buildResult({
      intentId: "greeting",
      confidence: 0.9,
      language,
      dialectHint,
      toneHint: "positive",
      suggestedCard: null
    });
  }

  // =========================
  // 10) استفسار عن نوفا لينك + AI معًا
  //      (مثلاً: ما هي نوفا لينك ولماذا أنشئت؟)
  // =========================
  // إذا ذُكرت نوفا لينك مع AI (مثل: "من وجهة نظر نوفا لينك") لا نحولها تلقائيًا لـ novalink_info
  // نتركها للـ ai_business، لكن نحافظ على إمكانية novalink_info إذا كانت مؤشرات التعريف قوية جدًا
  if (hasNovaLinkName(clean) && (aiScore > 0 || bizScore > 0) && !isNovaLinkReferenceOnly(clean)) {
    const strongNova = scoreByKeywords(clean, NOVALINK_STRONG_CUES);
    if (strongNova > 0) {
      return buildResult({
        intentId: "novalink_info",
        sub_intent: detectNovaLinkSubIntent(clean),
        confidence: 0.9,
        language,
        dialectHint,
        toneHint: "neutral",
        suggestedCard: null
      });
    }
  }

  // =========================
  // 11) نية الذكاء الاصطناعي وتطوير الأعمال (ONLY AI)
  // =========================
  if (aiScore > 0 || bizScore > 0) {
    let conf = 0.7;
    const combinedScore = aiScore + bizScore;
    if (combinedScore >= 4) conf = 0.95;
    else if (combinedScore >= 2) conf = 0.85;

let suggestedCard = null;
if (consultScore > 0) {
  suggestedCard = "bot_lead";
} else if (subscribeScore > 0) {
  // لا نقترح business_subscribe إلا إذا كان الاشتراك مرتبطًا بنوفا لينك صراحة
  const externalSubscription =
    containsAny(clean, [
      "netflix",
      "نتفليكس",
      "spotify",
      "سبوتيفاي",
      "chatgpt",
      "شات جي بي تي",
      "openai",
      "يوتيوب",
      "youtube",
      "premium",
      "بريميوم"
    ]);

  const novalinkSubscriptionCue =
    hasNovaLinkName(clean) ||
    containsAny(clean, [
      "نشرة",
      "newsletter",
      "mailing list",
      "تابع التحديثات",
      "تحديثات",
      "email updates",
      "نشرة نوفا"
    ]);

  if (!externalSubscription && novalinkSubscriptionCue) {
    suggestedCard = "business_subscribe";
  }
}

    return buildResult({
      intentId: "ai_business",
      confidence: conf,
      language,
      dialectHint,
      toneHint: "neutral",
      suggestedCard
    });
  }

  // =========================
  // 12) إذا لا يوجد أي تطابق واضح
  //      → تعامل كـ خارج النطاق
  // =========================
  return buildResult({
    intentId: "out_of_scope",
    confidence: 0.6,
    language,
    dialectHint,
    toneHint: "neutral",
    suggestedCard: null
  });
}
