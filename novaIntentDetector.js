// ===========================================
// novaIntentDetector.js
// كاشف النوايا + اللغة + نطاق السؤال (داخل/خارج مجال نوفا لينك)
// By Mohammed Abu Snaina – NOVALINK.AI
// ===========================================
// ============= أدوات نصية بسيطة =============
function normalize(text = "") {
  return text
    .toLowerCase()
    .replace(/[.,!?؟،"“”()\-_:;«»]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(text, keywords = []) {
  return keywords.some((k) => text.includes(k.toLowerCase()));
}

function detectLanguage(raw = "") {
  const hasArabic = /[\u0600-\u06FF]/.test(raw);
  if (hasArabic) return "ar";
  return "en";
}

// ============= قواعد النوايا =============
export async function detectNovaIntent(userMessage = "") {
  const raw = (userMessage || "").trim();
  const lang = detectLanguage(raw);
  const text = normalize(raw);

  // احتمال لهجة (تقريبية فقط)
  const dialectHint = lang === "ar" ? "levant" : null;

  // -------- 1) تحيات --------
  const greetingAr = [
    "مرحبا",
    "أهلا",
    "اهلا",
    "السلام عليكم",
    "مساء الخير",
    "صباح الخير",
    "هاي",
    "هلا",
    "مرحبا نوفا",
    "هلا نوفا",
    "كيفك",
    "كيف الحال",
    "كيف حالك"
  ];
  const greetingEn = [
    "hi",
    "hello",
    "hey",
    "good morning",
    "good evening",
    "good night",
    "hi nova",
    "hello nova"
  ];

  if (
    (lang === "ar" && containsAny(text, greetingAr)) ||
    (lang === "en" && containsAny(text, greetingEn))
  ) {
    return {
      intentId: "greeting",
      confidence: 0.95,
      language: lang,
      dialectHint,
      toneHint: "positive"
    };
  }

  // -------- 2) كلمات شكر / مدح (إيجابي) --------
  const positiveAr = [
    "شكرا",
    "شكرًا",
    "شكراً",
    "شكرا لك",
    "يعطيك العافية",
    "يعطيك العافيه",
    "ممتاز",
    "رائع",
    "جميل",
    "حلو",
    "ابداع",
    "خطير",
    "افدتني",
    "فدتني",
    "مفيد جدا",
    "مفيد جداً"
  ];
  const positiveEn = [
    "thank you",
    "thanks",
    "great",
    "awesome",
    "perfect",
    "very helpful",
    "useful",
    "you helped me"
  ];

  if (
    (lang === "ar" && containsAny(text, positiveAr)) ||
    (lang === "en" && containsAny(text, positiveEn))
  ) {
    return {
      intentId: "praise",
      confidence: 0.9,
      language: lang,
      dialectHint,
      toneHint: "positive"
    };
  }

  // -------- 3) كلمات سلبية / إحباط --------
  const negativeAr = [
    "سيء",
    "سئ",
    "مش مفيد",
    "ما فادني",
    "غير مفيد",
    "غلط",
    "خطأ",
    "مش حلو",
    "محبط",
    "سيئة",
    "فاشل",
    "ضعيف",
    "ردك سيء",
    "ردك سئ"
  ];
  const negativeEn = [
    "bad",
    "not helpful",
    "useless",
    "wrong answer",
    "you are wrong",
    "disappointing",
    "terrible"
  ];

  if (
    (lang === "ar" && containsAny(text, negativeAr)) ||
    (lang === "en" && containsAny(text, negativeEn))
  ) {
    return {
      intentId: "complaint",
      confidence: 0.9,
      language: lang,
      dialectHint,
      toneHint: "negative"
    };
  }

  // -------- 4) عن نوفا لينك / عن نوفا بوت / الرؤية والرسالة --------
  const aboutNovaAr = [
    "ما هي نوفا لينك",
    "عن نوفا لينك",
    "تعريف نوفا لينك",
    "تعرف عن نوفا لينك",
    "من هي نوفا لينك",
    "مدونة نوفا لينك",
    "رؤيتكم",
    "رؤيتك",
    "رسالتكم",
    "رسالتك",
    "هدف نوفا لينك",
    "ما هو هدف نوفا لينك",
    "قصتك مع نوفا لينك",
    "قصة نوفا لينك",
    "ليش عملت نوفا لينك",
    "كيف بدأت نوفا لينك",
    "نوفا لينك ايش هي",
    "مين ورا نوفا لينك",
    "نوفا بوت ايش هو",
    "تعريف نوفا بوت",
    "من هو نوفا بوت"
  ];
  const aboutNovaEn = [
    "what is novalink",
    "about novalink",
    "about nova link",
    "what is nova bot",
    "about novabot",
    "your story with novalink"
  ];

  if (
    (lang === "ar" && containsAny(text, aboutNovaAr)) ||
    (lang === "en" && containsAny(text, aboutNovaEn))
  ) {
    return {
      intentId: "about_novalink",
      confidence: 0.95,
      language: lang,
      dialectHint,
      toneHint: "neutral"
    };
  }

  // -------- 5) اشتراك / قائمة بريدية --------
  const subscribeAr = [
    "اريد الاشتراك",
    "اريد اشترك",
    "اشترك",
    "اشتراك",
    "الاشتراك في نوفا لينك",
    "newsletter",
    "القائمة البريدية"
  ];
  const subscribeEn = ["subscribe", "newsletter", "mailing list"];

  if (
    (lang === "ar" && containsAny(text, subscribeAr)) ||
    (lang === "en" && containsAny(text, subscribeEn))
  ) {
    return {
      intentId: "subscribe",
      confidence: 0.9,
      language: lang,
      dialectHint,
      toneHint: "positive"
    };
  }

  // -------- 6) تعاون / شراكة --------
  const collabAr = [
    "شراكة",
    "تعاون",
    "رعاية محتوى",
    "رعاية",
    "سبونسور",
    "ورشة عمل",
    "ورش عمل",
    "تدريب",
    "شراكة مع نوفا لينك",
    "تعاون مع نوفا لينك"
  ];
  const collabEn = ["collaboration", "partnership", "sponsorship", "sponsor"];

  if (
    (lang === "ar" && containsAny(text, collabAr)) ||
    (lang === "en" && containsAny(text, collabEn))
  ) {
    return {
      intentId: "collaboration",
      confidence: 0.9,
      language: lang,
      dialectHint,
      toneHint: "neutral"
    };
  }

  // -------- 7) كلمات تدل أن المستخدم صاحب مشروع / أعمال --------
  const businessHints = [
    "مشروعي",
    "مشروعي الخاص",
    "مشروع",
    "بيزنس",
    "اعمالي",
    "أعمالي",
    "تجارة",
    "متجر",
    "متجري",
    "عملي",
    "العمل الحر",
    "freelance",
    "business",
    "startup",
    "ريادة اعمال",
    "ريادة أعمال",
    "شركة",
    "شركتي"
  ];

  const aiHints = [
    "ذكاء اصطناعي",
    "الذكاء الاصطناعي",
    "ai",
    "chatgpt",
    "جي بي تي",
    "gpt",
    "نوفا بوت",
    "novabot",
    "ادوات ذكاء",
    "ادوات الذكاء",
    "ادوات الذكاء الاصطناعي",
    "توليد محتوى",
    "محتوى بالذكاء الاصطناعي",
    "gpt",
    "gemini"
  ];

  const contentHints = [
    "محتوى",
    "تسويق",
    "اعلان",
    "إعلان",
    "اعلانات",
    "حملة اعلانية",
    "سوشيال ميديا",
    "instagram",
    "tiktok",
    "reels",
    "فيديوهات قصيرة",
    "blog",
    "مدونة",
    "مقالات",
    "كتابة"
  ];

  const isBusinessRelated =
    containsAny(text, businessHints) ||
    containsAny(text, aiHints) ||
    containsAny(text, contentHints);

  // -------- 8) أسئلة خارج النطاق (طقس، طعام، رياضة، أفلام...) --------
  const outOfScopeKeywords = [
    "الطقس",
    "الجو",
    "درجة الحرارة",
    "امطار",
    "مطر",
    "ثلج",
    "ريال مدريد",
    "برشلونة",
    "كرة القدم",
    "مباراة",
    "طبخ",
    "وصفة",
    "اكل",
    "أكل",
    "أكلات",
    "رجيم",
    "دايت",
    "فيلم",
    "افلام",
    "مسلسل",
    "مسلسلات",
    "ممثل",
    "فنان",
    "اغنية",
    "أغنية",
    "سفر",
    "سياحة",
    "فنادق",
    "فندق"
  ];

  const isOutOfScope = containsAny(text, outOfScopeKeywords);

  if (isOutOfScope && !isBusinessRelated) {
    // سؤال واضح أنه خارج نطاق نوفا لينك
    return {
      intentId: "out_of_scope",
      confidence: 0.9,
      language: lang,
      dialectHint,
      toneHint: "neutral"
    };
  }

  // -------- 9) افتراضي: استكشاف / تعلّم داخل نطاق الأعمال أو AI --------
  if (isBusinessRelated) {
    return {
      intentId: "learn",
      confidence: 0.75,
      language: lang,
      dialectHint,
      toneHint: "neutral"
    };
  }

  // -------- 10) في المنطقة الرمادية → تعامل كاستكشاف عام --------
  return {
    intentId: "explore",
    confidence: 0.5,
    language: lang,
    dialectHint,
    toneHint: "neutral"
  };
}
