===== novaIntentDetector.js =====
const ARABIC_REGEX = /[\u0600-\u06FF]/;

const DIALECT_KEYWORDS = {
  egyptian: ["إزاي", "ازاي", "دلوقتي", "أوي", "قوي", "كده", "جامد", "ليه", "عاوز"],
  gulf: ["شلون", "وش", "واجد", "زين", "حيل", "معليش", "ياخي", "وشو"],
  levant: ["شو", "هيك", "كتير", "هلق", "لسا", "تمام", "مو", "خلص"],
  maghreb: ["برشا", "بزاف", "توا", "ياسر", "بالزّاف", "هكة"],
};

const AI_KEYWORDS = [
  "ذكاء اصطناعي",
  "ذكاء",
  "ai",
  "gpt",
  "gemini",
  "نموذج",
  "prompt",
  "توليد",
  "model",
  "llm",
  "automation",
];

const BUSINESS_KEYWORDS = [
  "عمل",
  "مشروع",
  "تسويق",
  "محتوى",
  "ريادة",
  "freelance",
  "business",
  "startup",
  "side hustle",
];

const PRODUCTIVITY_KEYWORDS = ["إنتاجية", "مهام", "time", "workflow", "system", "تنظيم"];

const OUT_OF_SCOPE_KEYWORDS = [
  "سيارة",
  "سيارات",
  "أزياء",
  "موضة",
  "غناء",
  "أغنية",
  "رياضة",
  "كرة",
  "طبخ",
  "وصفة",
  "وصفات",
  "حب",
  "رومانسية",
  "مشاهير",
  "celebrity",
  "celebrities",
  "football",
  "nfl",
  "nba",
  "مباراة",
  "رحلة",
  "سفر",
  "travel",
  "طقس",
  "أخبار",
];

const GREETING_KEYWORDS = ["hi", "hello", "hey", "مرحبا", "اهلا", "أهلا", "السلام عليكم"];
const GOODBYE_KEYWORDS = ["bye", "goodbye", "مع السلامة", "الى اللقاء", "وداعًا", "وداعا"];
const THANKS_KEYWORDS = ["thank", "thx", "thanks", "شكرا", "شكرًا", "يعطيك العافية"];
const NEGATIVE_MOOD_KEYWORDS = ["محبط", "سيء", "زعلان", "غلط", "annoyed", "confused", "مش فاهم", "غاضب"];
const NOVALINK_KEYWORDS = ["novalink", "nova link", "mission", "رسالتكم", "رؤيتكم", "قصتكم", "about novalink"];
const NOVABOT_KEYWORDS = ["novabot", "nova bot", "who built", "كيف تعمل", "من بناك"];
const SUBSCRIBE_KEYWORDS = ["subscribe", "اشتراك", "newsletter", "متابعة", "updates", "تحديثات"];
const CONSULTING_KEYWORDS = ["consulting", "استشارة", "بناء بوت", "ساعدني في عملي", "خدمة مدفوعة", "تطوير بوت"];
const COLLAB_KEYWORDS = ["collaboration", "partnership", "sponsor", "sponsorship", "تعاون", "شراكة", "ورشة"];

function normalizeMessage(message) {
  return (message || "").trim();
}

function detectLanguage(message, languageHint) {
  if (languageHint === "ar" || languageHint === "en") return languageHint;
  const hasArabic = ARABIC_REGEX.test(message);
  if (!message) return "en";
  if (hasArabic) return "ar";
  const latinCount = (message.match(/[a-z]/gi) || []).length;
  const arabicCount = (message.match(ARABIC_REGEX) || []).length;
  if (arabicCount > latinCount) return "ar";
  return "en";
}

function scoreKeywordList(message, keywords) {
  const lower = message.toLowerCase();
  return keywords.reduce((score, keyword) => {
    const pattern = keyword.toLowerCase();
    return lower.includes(pattern) ? score + 1 : score;
  }, 0);
}

function detectDialect(message) {
  const scores = Object.fromEntries(Object.keys(DIALECT_KEYWORDS).map((dialect) => [dialect, 0]));
  Object.entries(DIALECT_KEYWORDS).forEach(([dialect, keywords]) => {
    scores[dialect] = scoreKeywordList(message, keywords);
  });
  const best = Object.entries(scores).reduce(
    (acc, [dialect, score]) => (score > acc.score ? { dialect, score } : acc),
    { dialect: "neutral", score: 0 }
  );
  return best.score > 0 ? best.dialect : "neutral";
}

function scoreAIKeywords(message) {
  return scoreKeywordList(message, AI_KEYWORDS);
}

function scoreBusinessKeywords(message) {
  return scoreKeywordList(message, BUSINESS_KEYWORDS) + scoreKeywordList(message, PRODUCTIVITY_KEYWORDS);
}

function scoreOutOfScope(message) {
  return scoreKeywordList(message, OUT_OF_SCOPE_KEYWORDS);
}

function isGreeting(message) {
  return scoreKeywordList(message, GREETING_KEYWORDS) > 0;
}

function isGoodbye(message) {
  return scoreKeywordList(message, GOODBYE_KEYWORDS) > 0;
}

function isThanks(message) {
  return scoreKeywordList(message, THANKS_KEYWORDS) > 0;
}

function isNegativeMood(message) {
  return scoreKeywordList(message, NEGATIVE_MOOD_KEYWORDS) > 0;
}

function isNovalinkInfo(message) {
  return scoreKeywordList(message, NOVALINK_KEYWORDS) > 0;
}

function isNovabotInfo(message) {
  return scoreKeywordList(message, NOVABOT_KEYWORDS) > 0;
}

function isSubscribeInterest(message) {
  return scoreKeywordList(message, SUBSCRIBE_KEYWORDS) > 0;
}

function isConsulting(message) {
  return scoreKeywordList(message, CONSULTING_KEYWORDS) > 0;
}

function isCollaboration(message) {
  return scoreKeywordList(message, COLLAB_KEYWORDS) > 0;
}

function detectIntent(message) {
  if (!message) return "greeting";
  if (message.includes("10406621")) return "developer_identity";
  if (isGreeting(message)) return "greeting";
  if (isGoodbye(message)) return "goodbye";
  if (isThanks(message)) return "thanks_positive";
  if (isNegativeMood(message)) return "negative_mood";
  if (isNovalinkInfo(message)) return "novalink_info";
  if (isNovabotInfo(message)) return "novabot_info";
  if (isSubscribeInterest(message)) return "subscribe_interest";
  if (isConsulting(message)) return "consulting_purchase";
  if (isCollaboration(message)) return "collaboration";

  const aiScore = scoreAIKeywords(message);
  const businessScore = scoreBusinessKeywords(message);
  const outScore = scoreOutOfScope(message);
  const totalAIBusiness = aiScore + businessScore;

  if (totalAIBusiness >= 2 || (aiScore >= 1 && businessScore >= 1) || aiScore >= 3) {
    return "ai_business";
  }
  if (outScore > 0 && totalAIBusiness === 0) {
    return "out_of_scope";
  }
  if (totalAIBusiness === 1) {
    return "ai_business";
  }
  return "out_of_scope";
}

function mapEffectiveIntent(originalIntentId, message) {
  const aiScore = scoreAIKeywords(message) + scoreBusinessKeywords(message);
  const outScore = scoreOutOfScope(message);
  if (originalIntentId !== "ai_business" && aiScore >= 2) return "ai_business";
  if (originalIntentId === "ai_business" && outScore > aiScore && aiScore === 0) return "out_of_scope";
  return originalIntentId;
}

function computeSessionTier(intentId, message) {
  if (["greeting", "goodbye", "thanks_positive", "negative_mood"].includes(intentId)) {
    return "non_ai";
  }
  const aiScore = scoreAIKeywords(message) + scoreBusinessKeywords(message);
  if (intentId === "ai_business" || aiScore >= 2) {
    return "strong_ai";
  }
  if (aiScore > 0) return "semi_ai";
  return "non_ai";
}

function computeHasAIMomentum(message) {
  const aiScore = scoreAIKeywords(message) + scoreBusinessKeywords(message);
  return aiScore >= 2;
}

function computeAllowGemini(intentId) {
  const disallowed = new Set([
    "greeting",
    "goodbye",
    "thanks_positive",
    "negative_mood",
    "novalink_info",
    "novabot_info",
    "developer_identity",
  ]);
  return !disallowed.has(intentId);
}

export function detectNovaIntent(input) {
  const normalizedMessage = normalizeMessage(input?.message);
  const language = detectLanguage(normalizedMessage, input?.languageHint);
  const dialectHint = language === "ar" ? detectDialect(normalizedMessage) : "neutral";

  const originalIntentId = detectIntent(normalizedMessage);
  const effectiveIntentId = mapEffectiveIntent(originalIntentId, normalizedMessage);
  const sessionTier = computeSessionTier(effectiveIntentId, normalizedMessage);
  const hasAIMomentum = computeHasAIMomentum(normalizedMessage);
  const allowGemini = computeAllowGemini(effectiveIntentId);

  return {
    originalIntentId,
    effectiveIntentId,
    sessionTier,
    hasAIMomentum,
    allowGemini,
    language,
    dialectHint,
  };
}

export default detectNovaIntent;
===== END novaIntentDetector.js =====
