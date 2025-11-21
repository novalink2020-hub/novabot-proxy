// ===========================================
// novaIntentDetector.js (v6.9 – Clean Pro Edition)
// نظام نوايا نوفا بوت – تحليلي، منهجي، يدعم 9 نوايا
// By Mohammed Abu Snaina – NOVALINK.AI
// ===========================================

export async function detectNovaIntent(message = "") {
  const text = message.toLowerCase().trim();

  // -------------------------------
  // ١) نية الترحيب
  // -------------------------------
  if (
    /^(hi|hello|مرحبا|هلو|اهلا|أهلاً|السلام عليكم)$/.test(text)
  ) {
    return {
      intentId: "greeting",
      confidence: 0.95,
      language: detectLang(text)
    };
  }

  // -------------------------------
  // ٢) نية الشكر / ردود إيجابية
  // -------------------------------
  if (
    /(شكرا|ممتاز|حلو|جميل|thank you|thanks|perfect|great|awesome)/.test(text)
  ) {
    return {
      intentId: "thanks",
      confidence: 0.95,
      language: detectLang(text)
    };
  }

  // -------------------------------
  // ٣) نية ردود سلبية
  // -------------------------------
  if (
    /(مش فاهم|سيء|ضعيف|مش صح|خطأ|غلط|not good|bad answer)/.test(text)
  ) {
    return {
      intentId: "negative_reaction",
      confidence: 0.9,
      language: detectLang(text)
    };
  }

  // -------------------------------
  // ٤) نية قصة نوفا لينك
  // -------------------------------
  if (
    /(من انتم|من أنتم|شو هي نوفا لينك|ما هي قصة نوفا لينك|novalink story|novalink ai story)/.test(
      text
    )
  ) {
    return {
      intentId: "novalink_story",
      confidence: 0.92,
      language: detectLang(text)
    };
  }

  // -------------------------------
  // ٥) نية خدمات نوفا لينك
  // -------------------------------
  if (
    /(خدمات نوفا لينك|service novalink|novalink services|شو بتقدم نوفا لينك)/.test(
      text
    )
  ) {
    return {
      intentId: "novalink_services",
      confidence: 0.9,
      language: detectLang(text)
    };
  }

  // -------------------------------
  // ٦) نية التعريف بنوفا بوت
  // -------------------------------
  if (
    /(ما هو نوفا بوت|من هو نوفا بوت|مين نوفا بوت|novabot|nova bot)/.test(text)
  ) {
    return {
      intentId: "novabot_intro",
      confidence: 0.9,
      language: detectLang(text)
    };
  }

  // -------------------------------
  // ٧) نية اشتراك
  // -------------------------------
  if (
    /(اشترك|subscribe|newsletter|نشرة|اضافة بريدي)/.test(text)
  ) {
    return {
      intentId: "subscribe",
      confidence: 0.9,
      suggestedCard: "subscribe_card",
      language: detectLang(text)
    };
  }

  // -------------------------------
  // ٨) نية التعاون والشراكات
  // -------------------------------
  if (
    /(تعاون|شراكة|sponsorship|collaboration|partnership)/.test(text)
  ) {
    return {
      intentId: "collaboration",
      confidence: 0.95,
      suggestedCard: "collaboration_card",
      language: detectLang(text)
    };
  }

  // -------------------------------
  // ٩) نية الاستشارة / الشراء (BOT LEAD)
  // -------------------------------
  if (
    /(استشارة|consulting|شراء|buy|خدمة|اريد بوت|اريد عمل بوت|اريد بوت لموقعي|تطوير بوت|انشاء بوت)/.test(
      text
    )
  ) {
    return {
      intentId: "consulting_purchase",
      confidence: 0.95,
      suggestedCard: "bot_lead_card",
      language: detectLang(text)
    };
  }

  // -------------------------------
  // 🔥 النية الأساسية: AI + تطوير أعمال
  // وتشمل: الذكاء الاصطناعي، تطوير مشاريع، أدوات AI،
  // التعليق الصوتي، توليد صوت، تحليل بيانات، محتوى AI…
  // -------------------------------
  if (
    /(
      ai|ذكاء|اصطناعي|
      تطوير مشروع|تطوير اعمالي|مشروعي|
      محتوى|content|كتابة|
      seo|marketing|تسويق|
      تحليل|data|تحليلات|
      chatgpt|gemini|llm|
      bot|chatbot|
      صوت|تعليق|voice|voiceover|tts|text to speech|تحويل نص|
      توليد صوت|ai voice|synthetic
    )/x.test(text)
  ) {
    return {
      intentId: "ai_business",
      confidence: 0.9,
      language: detectLang(text)
    };
  }

  // -------------------------------
  // ١٠) Out of Scope (الأكل – الطقس – اللعب – السياسة – الدراما…)
  // -------------------------------
  if (
    /(مقلوبة|طبخة|اكل|طعام|وصفة|طقس|weather|رياضة|كرة|football|مسلسل|اغنية|سياسة)/.test(
      text
    )
  ) {
    return {
      intentId: "out_of_scope",
      confidence: 1,
      language: detectLang(text)
    };
  }

  // -------------------------------
  //  Default: explore mode
  // -------------------------------
  return {
    intentId: "explore",
    confidence: 0.6,
    language: detectLang(text)
  };
}

// -------------------------------
//  كاشف اللغة بسيط وفعّال
// -------------------------------
function detectLang(t) {
  return /[أ-ي]/.test(t) ? "ar" : "en";
}
