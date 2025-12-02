function normalizeMessage(raw) {
  const text = (raw ?? "").toString();
  return text.trim();
}
function countArabicChars(text) {
  const matches = text.match(/[\u0600-\u06FF]/g);
  return matches ? matches.length : 0;
}
function countLatinChars(text) {
  const matches = text.match(/[A-Za-z]/g);
  return matches ? matches.length : 0;
}
function detectLanguage(message, languageHint) {
  const arabicCount = countArabicChars(message);
  const latinCount = countLatinChars(message);
  if (arabicCount > latinCount) return "ar";
  if (latinCount > arabicCount) return "en";
  if (Math.abs(arabicCount - latinCount) <= 1 && (languageHint === "ar" || languageHint === "en")) return languageHint;
  return arabicCount > 0 ? "ar" : "en";
}
function detectDialect(message) {
  const keywords = {
    egyptian: ["ازاي","إزاي","دلوقتي","اوي","قوي","كده","جامد","ليه","عاوز"],
    gulf: ["شلون","وش","واجد","زين","حيل","معليش","ياخي","وشو"],
    levant: ["شو","هيك","كتير","هلق","هلأ","لسا","لسّه","تمام","مو","خلص"],
    maghreb: ["برشا","بزاف","توا","ياسر","بالزاف","هكة","هك","mazal"]
  };
  const text = message.toLowerCase();
  let best = "neutral";
  let bestScore = 0;
  for (const key of Object.keys(keywords)) {
    let score = 0;
    for (const kw of keywords[key]) {
      const needle = kw.toLowerCase();
      let index = text.indexOf(needle);
      while (index !== -1) {
        score += 1;
        index = text.indexOf(needle, index + needle.length);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = key;
    }
  }
  return bestScore === 0 ? "neutral" : best;
}
function scoreKeywords(message) {
  const aiKeywords = ["ذكاء اصطناعي","الذكاء الاصطناعي","ذكاء","ai","gpt","شات جي بي تي","chatgpt","gemini","llm","نموذج لغوي","prompt","برومبت","أتمتة","automation","روبوت","bot","شات بوت"];
  const businessKeywords = ["عمل","أعمال","مشروع","بيزنس","ريادة","ريادة أعمال","freelance","فريلانسر","تسويق","marketing","محتوى","content","startup","ستارت أب","side hustle","إنتاجية","productivity","تنظيم","system","workflow","مهام","وظيفة","وظائف","career","job"];
  const text = message.toLowerCase();
  let aiScore = 0;
  let bizScore = 0;
  for (const kw of aiKeywords) {
    const needle = kw.toLowerCase();
    let index = text.indexOf(needle);
    while (index !== -1) {
      aiScore += 1;
      index = text.indexOf(needle, index + needle.length);
    }
  }
  for (const kw of businessKeywords) {
    const needle = kw.toLowerCase();
    let index = text.indexOf(needle);
    while (index !== -1) {
      bizScore += 1;
      index = text.indexOf(needle, index + needle.length);
    }
  }
  return { aiScore, bizScore };
}
function classifyOriginalIntent(message) {
  const lower = message.toLowerCase();
  if (lower.includes("10406621")) return "developer_identity";
  const greetingList = ["hi","hello","hey","السلام عليكم","مرحبا","اهلا","أهلاً","هلا","صباح الخير","مساء الخير"];
  for (const word of greetingList) if (lower.includes(word.toLowerCase())) return "greeting";
  const goodbyeList = ["bye","goodbye","مع السلامة","إلى اللقاء","اشوفك","أشوفك","يلا سلام"];
  for (const word of goodbyeList) if (lower.includes(word.toLowerCase())) return "goodbye";
  const thanksList = ["شكرا","شكرًا","thx","thanks","thank you","يعطيك العافية","مشكور","ممتاز","رائع","great","awesome"];
  for (const word of thanksList) if (lower.includes(word.toLowerCase())) return "thanks_positive";
  const negativeList = ["مش فاهم","غير واضح","محبط","سيء","غلط","annoyed","confused","bad answer","مش مفيد"];
  for (const word of negativeList) if (lower.includes(word.toLowerCase())) return "negative_mood";
  const novalinkTriggers = ["novalink","about nova","about novalink","ما هي novalink","ما هي نوفالينك","ايش novalink","إيش novalink"];
  for (const word of novalinkTriggers) if (lower.includes(word.toLowerCase())) return "novalink_info";
  const novabotTriggers = ["novabot","nova bot","عن البوت","كيف تعمل","من بناك","who built you"];
  for (const word of novabotTriggers) if (lower.includes(word.toLowerCase())) return "novabot_info";
  const subscribeTriggers = ["subscribe","newsletter","اشترك","اشتراك","قائمة بريدية","أريد الاشتراك"];
  for (const word of subscribeTriggers) if (lower.includes(word.toLowerCase())) return "subscribe_interest";
  const consultingTriggers = ["استشارة","consulting","paid","مدفوعة","build a bot","خدمة مدفوعة","تطبيق الذكاء الاصطناعي"];
  for (const word of consultingTriggers) if (lower.includes(word.toLowerCase())) return "consulting_purchase";
  const collaborationTriggers = ["شراكة","تعاون","partner","sponsor","sponsorship"];
  for (const word of collaborationTriggers) if (lower.includes(word.toLowerCase())) return "collaboration";
  const goodbyeVariants = ["farewell","see you","catch you later"];
  for (const word of goodbyeVariants) if (lower.includes(word.toLowerCase())) return "goodbye";
  const greetingVariants = ["greetings","good morning","good evening"];
  for (const word of greetingVariants) if (lower.includes(word.toLowerCase())) return "greeting";
  const thankVariants = ["appreciate","grateful"];
  for (const word of thankVariants) if (lower.includes(word.toLowerCase())) return "thanks_positive";
  return "ai_business";
}
function deriveEffectiveIntent(originalIntentId, aiScore, bizScore, message) {
  if (originalIntentId === "developer_identity") return "developer_identity";
  const totalScore = aiScore + bizScore;
  const lower = message.toLowerCase();
  const offTopic = ["football","soccer","كرة","طبخ","cooking","fashion","celebrity","celeb","سياسة","politics","رياضة","رياضه","movies","أفلام","ألعاب","games","relationship","علاقة"];
  if (totalScore === 0) {
    for (const word of offTopic) if (lower.includes(word.toLowerCase())) return "out_of_scope";
  }
  if (totalScore >= 1) return "ai_business";
  return originalIntentId;
}
function deriveSessionTier(effectiveIntentId) {
  if (effectiveIntentId === "greeting" || effectiveIntentId === "goodbye" || effectiveIntentId === "thanks_positive") return "non_ai";
  if (effectiveIntentId === "novalink_info" || effectiveIntentId === "novabot_info" || effectiveIntentId === "subscribe_interest" || effectiveIntentId === "collaboration" || effectiveIntentId === "consulting_purchase") return "semi_ai";
  return "strong_ai";
}
function computeHasAIMomentum(effectiveIntentId, aiScore, bizScore) {
  if (effectiveIntentId === "ai_business") return true;
  return aiScore + bizScore >= 1;
}
function computeAllowGemini(effectiveIntentId) {
  if (effectiveIntentId === "greeting" || effectiveIntentId === "goodbye" || effectiveIntentId === "thanks_positive" || effectiveIntentId === "negative_mood" || effectiveIntentId === "novalink_info" || effectiveIntentId === "novabot_info" || effectiveIntentId === "developer_identity") return false;
  return true;
}
export function detectNovaIntent(input) {
  const normalized = normalizeMessage(input && input.message);
  const treatedMessage = normalized === "" ? "hello" : normalized;
  const language = detectLanguage(treatedMessage, input && input.languageHint);
  const dialectHint = language === "ar" ? detectDialect(treatedMessage) : "neutral";
  const { aiScore, bizScore } = scoreKeywords(treatedMessage);
  const originalIntentId = classifyOriginalIntent(treatedMessage);
  const effectiveIntentId = deriveEffectiveIntent(originalIntentId, aiScore, bizScore, treatedMessage);
  const sessionTier = deriveSessionTier(effectiveIntentId);
  const hasAIMomentum = computeHasAIMomentum(effectiveIntentId, aiScore, bizScore);
  const allowGemini = computeAllowGemini(effectiveIntentId);
  return { originalIntentId, effectiveIntentId, sessionTier, hasAIMomentum, allowGemini, language, dialectHint };
}
export default detectNovaIntent;
