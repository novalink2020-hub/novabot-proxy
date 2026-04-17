// ===========================================
// novaBrainSystem.js – NovaBrainSystem PRO v3 (Flat Brain Stable)
// دماغ نوفا بوت الهجين: (نوايا + معرفة + Embeddings + Gemini)
// By Mohammed Abu Snaina – NOVALINK.AI
// ===========================================

import { GoogleGenerativeAI } from "@google/generative-ai";

/* ================= إعدادات عامة ================= */

// مفتاح Gemini من متغيّرات البيئة
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// مصدر ملف المعرفة – نقرأ V5 أولاً، ثم نرجع لـ KNOWLEDGE_JSON_URL إن وجد
const DEFAULT_KNOWLEDGE_URL =
  process.env.KNOWLEDGE_V5_URL ||
  process.env.KNOWLEDGE_JSON_URL ||
  "";

// يمكن تغيير هذا الـ URL من السيرفر عبر loadKnowledgeFromURL
let knowledgeSourceURL = DEFAULT_KNOWLEDGE_URL;

// عتبات التطابق مع قاعدة المعرفة
const STRONG_MATCH_THRESHOLD = 0.65; // تطابق قوي
const MEDIUM_MATCH_THRESHOLD = 0.4; // تطابق متوسط

// حزمة النصوص الرسمية لنوفا بوت
const NOVABOT_TEXT_PACKAGE = {
  genericReplies: [
    "👋 أهلاً بك في نوفا لينك، حيث نؤمن أن الذكاء الاصطناعي ليس تقنية فقط، بل رحلة لاكتشاف قدراتك من جديد.<br>ابدأ بخطوة بسيطة… وتذكّر أن كل فكرة صغيرة قد تصنع تحولًا كبيرًا.<br>🔗 <a href=\"https://novalink-ai.com/ashtrk-alan\" target=\"_blank\" class=\"nova-link\">ابدأ من هنا</a>",
    "🌟 ربما تبحث عن بداية جديدة أو إلهام يعيد شغفك.<br>أنصحك بقراءة قصتي في \"رحلة فردية في عالم الذكاء الاصطناعي\"، فهي تذكير بأن الشغف أقوى من التخصص.<br>🔗 <a href=\"https://novalink-ai.com/rhlh-frdyh-fy-aalm-althkaa-alastnaay-hktha-bdat-nwfa-lynk\" target=\"_blank\" class=\"nova-link\">اقرأ القصة هنا</a>",
    "🤖 لا تحتاج أن تكون خبيرًا لتبدأ مع الذكاء الاصطناعي، كل ما تحتاجه هو فضول صغير وخطوة جريئة.<br>نوفا لينك صُممت لتكون دليلك العملي خطوة بخطوة نحو استخدام الأدوات الذكية في حياتك وأعمالك.<br>🔗 <a href=\"https://novalink-ai.com/blog-adwat-althkaa-alastnaay-llaamal\" target=\"_blank\" class=\"nova-link\">استكشف الأدوات</a>",
    "✨ أحيانًا لا تحتاج إلى إجابة، بل إلى تذكير بسيط بأنك على الطريق الصحيح.<br>استمر… وتذكّر أن الذكاء الاصطناعي ليس بديلًا لك، بل امتداد لقدرتك على الإنجاز.<br>🔗 <a href=\"https://novalink-ai.com/about-us-althkaa-alastnaay\" target=\"_blank\" class=\"nova-link\">تعرّف على رؤيتنا</a>",
    "🚀 الذكاء الاصطناعي لا ينتظر أحدًا… لكنه دائمًا يفتح الباب لمن يطرق بثقة.<br>اكتشف كيف يمكن لأدوات بسيطة أن تختصر وقتك وتضاعف نتائجك.<br>🔗 <a href=\"https://novalink-ai.com/blog-adwat-althkaa-alastnaay-llaamal\" target=\"_blank\" class=\"nova-link\">ابدأ رحلتك الآن</a>",
    "🌙 قبل أن تغادر… تذكّر أن كل إنجاز يبدأ بسؤال بسيط ورغبة في التعلّم.<br>اسمح لنفسك أن تتقدّم خطوة كل يوم — فالعالم لا ينتظر، لكنه يكافئ من يواصل المسير بثبات وثقة.<br>🔗 <a href=\"https://novalink-ai.com/althkaa-alastnaay-yuayd-tshkyl-almstqbl-hl-wzyftk-fy-aman\" target=\"_blank\" class=\"nova-link\">اقرأ ما يلهمك اليوم</a>"
  ],
  positiveReplies: [
    "🎉 أشكرك على كلماتك اللطيفة، يسعدني أن يكون نوفا بوت جزءًا من رحلتك.<br>استمر في طرح أسئلتك، فكل سؤال جديد هو خطوة أخرى نحو وضوح أكبر.",
    "🙏 سعادتك بما تقدّمه نوفا لينك تعني الكثير.<br>إذا كان هناك موضوع معيّن ترغب أن نتعمق فيه أكثر، فأنا هنا لأساعدك في استكشافه."
  ],
  negativeReplies: [
    "🤝 أقدّر صراحتك، ويبدو أن الإجابة لم تكن بالمستوى الذي تستحقه.<br>جرّب أن توضّح ما الذي تبحث عنه أكثر، وسأحاول أن أقدّم زاوية مختلفة تساعدك بشكل أفضل.",
    "💬 من حقك أن تحصل على إجابة مفيدة، وإذا شعرت أن الرد لم يكن كافيًا فهذا تنبيه جميل لنطوّر المحتوى أكثر.<br>أخبرني ما الذي لم تجده، لنبحث عنه معًا بخطوة أهدأ وأكثر دقة."
  ],
  welcomeFirst:
    "👋 أهلاً بك في نوفا لينك، مساحة صُمِّمت لترافقك في رحلتك مع الذكاء الاصطناعي خطوة بخطوة.<br>يمكنك أن تسأل، تستكشف، أو تبدأ من مقال يلهمك… القرار لك، وأنا هنا لأساعدك.",
  welcomeReturning:
    "👋 سعيد برؤيتك مجددًا في نوفا لينك.<br>هل ترغب أن أساعدك اليوم في اكتشاف مقال جديد، أداة عملية، أو فكرة تلهمك للخطوة التالية؟",
  noMatch:
    "💬 يبدو أن سؤالك يفتح بابًا جديدًا لم نكتب عنه بعد في نوفا لينك،<br>لكننا نُرحّب دائمًا بالأفكار الجديدة التي تُلهمنا للكتابة عنها مستقبلًا.<br>شاركنا رؤيتك أو تصوّرك حوله، فربما يكون موضوع التدوينة القادمة ✨<br>🔗 <a href=\"https://novalink-ai.com/about-us-althkaa-alastnaay\" target=\"_blank\" class=\"nova-link\">تعرّف على أهداف نوفا لينك</a>",
  aboutNovaLink:
    "🟠 <strong>من نحن</strong><br>👋 أهلاً بك في نوفا لينك، مساحة عربية تؤمن أن الذكاء الاصطناعي لم يُخلق ليبدلك، بل ليحرّرك من المكرّر لتُبدع فيما يليق بعقلك.<br><br>نحن نساعدك على تحويل الأدوات الذكية إلى نتائج حقيقية — في مشروعك، عملك، وحتى أفكارك.<br><br>🔗 <a href=\"https://novalink-ai.com/about-us-althkaa-alastnaay\" target=\"_blank\" class=\"nova-link\">تعرّف على رؤيتنا وكيف نعيد تعريف الذكاء الاصطناعي</a>",
  story:
    "🔵 <strong>رحلة نوفا لينك</strong><br>🌟 بدأت نوفا لينك كفكرة بسيطة أثناء رحلة شخصية لاكتشاف الذكاء الاصطناعي، ثم تحوّلت إلى مشروع حيّ يفتح الطريق لكل من يريد أن يتعلّم ويطبّق لا أن يكتفي بالمشاهدة.<br><br>إنها قصة شغف وجرأة… بدأت من فضول فردي، وتحولت إلى مجتمع من صانعي المستقبل.<br><br>🔗 <a href=\"https://novalink-ai.com/rhlh-frdyh-fy-aalm-althkaa-alastnaay-hktha-bdat-nwfa-lynk\" target=\"_blank\" class=\"nova-link\">اقرأ القصة الكاملة: هكذا بدأت نوفا لينك</a>",
  mission:
    "🟠 <strong>هدف نوفا لينك</strong><br>🚀 رؤيتنا في نوفا لينك بسيطة لكنها عميقة: أن يصبح الذكاء الاصطناعي أداة لكل إنسان، لا امتيازًا للنخبة التقنية.<br><br>نكتب، نجرّب، ونشاركك الأدوات التي تصنع فارقًا فعليًا في الإنتاجية وريادة الأعمال.<br><br>✨ هدفنا أن تكون أنت التغيير القادم، خطوة بخطوة، بثقة ومعرفة.<br><br>🔗 <a href=\"https://novalink-ai.com/blog-adwat-althkaa-alastnaay-llaamal\" target=\"_blank\" class=\"nova-link\">ابدأ رحلتك العملية</a>",
  vision:
    "🟣 <strong>رؤية نوفا لينك</strong><br>نطمح إلى مستقبل يصبح فيه الذكاء الاصطناعي ميزة يومية للجميع — يحرّرك من التكرار ويمنحك مساحة أكبر للإبداع واتخاذ القرار، لا للاستهلاك والتشتت.",
  goodbye:
    "سعيد بهذه الجولة من الحوار معك 🌱<br><br>أتمنّى أن تكون فكرة واحدة على الأقل قد فتحت لك زاوية جديدة للتفكير أو العمل.<br><br>نوفا بوت سيبقى هنا عندما تعود… ومع كل زيارة، يمكن أن نضيف طبقة جديدة لمسارك مع الذكاء الاصطناعي والأعمال.",
  // ===== English Pack (Automated Replies) =====
  genericReplies_en: [
    "👋 Welcome to NovaLink. We turn AI into practical outcomes for business and careers.<br>Start here: <a href=\"https://novalink-ai.com/ashtrk-alan\" target=\"_blank\" class=\"nova-link\">Begin</a>",
    "🚀 AI isn’t the goal — results are. Explore practical tools here:<br><a href=\"https://novalink-ai.com/blog-adwat-althkaa-alastnaay-llaamal\" target=\"_blank\" class=\"nova-link\">Explore tools</a>",
    "✨ One small improvement beats endless research. Tell me your goal and I’ll propose a simple plan."
  ],
  positiveReplies_en: [
    "🎉 Thanks — happy to help. Tell me what you’re trying to achieve and I’ll make it practical.",
    "🙏 Appreciate it. If you share your context (business + goal + time), I’ll give you a clear next step."
  ],
  negativeReplies_en: [
    "🤝 Fair point. Tell me what was missing, and I’ll answer in a clearer, more practical way.",
    "💬 You deserve a useful answer. Give me one detail (your goal), and I’ll tighten the reply."
  ],
  welcomeFirst_en:
    "👋 Welcome to NovaLink.<br>Ask anything about AI for business, content, or careers — and I’ll keep it practical.",
  welcomeReturning_en:
    "👋 Welcome back to NovaLink.<br>Want an article, a tool, or a quick plan for your next step?",
  noMatch_en:
    "💬 This is a fresh angle we haven’t covered yet in NovaLink.<br>Share what you want to achieve, and I’ll guide you with a practical direction.",
  aboutNovaLink_en:
    "🟠 <strong>About NovaLink</strong><br>NovaLink is an Arabic platform that helps you turn AI tools into real outcomes — for your business, work, and ideas.<br><br><a href=\"https://novalink-ai.com/about-us-althkaa-alastnaay\" target=\"_blank\" class=\"nova-link\">Learn more</a>",
  story_en:
    "🔵 <strong>NovaLink Story</strong><br>NovaLink started as a personal journey into AI, then became a practical platform for people who want to learn and apply — not just watch.<br><br><a href=\"https://novalink-ai.com/rhlh-frdyh-fy-aalm-althkaa-alastnaay-hktha-bdat-nwfa-lynk\" target=\"_blank\" class=\"nova-link\">Read the full story</a>",
  mission_en:
    "🟠 <strong>NovaLink Mission</strong><br>Make AI practical and accessible — not a privilege for tech elites. We test, simplify, and share what actually moves productivity and business forward.<br><br><a href=\"https://novalink-ai.com/blog-adwat-althkaa-alastnaay-llaamal\" target=\"_blank\" class=\"nova-link\">Start practical</a>",
  vision_en:
    "🟣 <strong>NovaLink Vision</strong><br>A future where AI becomes a daily advantage for everyone — helping people focus on creativity and decision-making, not repetitive tasks.",
  goodbye_en:
    "Glad we chatted 🌱<br><br>If even one idea helped, that’s a win.<br>NovaBot will be here when you’re back — and we’ll keep building step by step."  
};

function randomFrom(list = []) {
  if (!Array.isArray(list) || list.length === 0) return "";
  return list[Math.floor(Math.random() * list.length)];
}

const getRandomGenericReply = (lang = "ar") =>
  lang === "en"
    ? randomFrom(NOVABOT_TEXT_PACKAGE.genericReplies_en || [])
    : randomFrom(NOVABOT_TEXT_PACKAGE.genericReplies || []);

const ARABIC_STOPWORDS = new Set([
  "من",
  "في",
  "على",
  "الى",
  "إلى",
  "عن",
  "أن",
  "إن",
  "ما",
  "هذا",
  "هذه",
  "ذلك",
  "هو",
  "هي",
  "هم",
  "هن",
  "كما",
  "أو",
  "و",
  "يا",
  "مع",
  "ثم",
  "قد",
  "لقد",
  "كان",
  "كانت",
  "يكون",
  "لدي",
  "لدينا",
  "لكل",
  "أي",
  "اي",
  "أية",
  "اية",
  "كيف",
  "لماذا",
  "متى",
  "أين",
  "اين",
  "مازال",
  "ما زال",
  "ليست",
  "ليس",
  "لا",
  "لم",
  "لن",
  "هل",
  "او",
  "الى",
  "حتى",
  "بعد",
  "قبل",
  "بين",
  "كل",
  "أي",
  "أيضا",
  "ايضاً",
  "ايضا"
]);

const EN_STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "for",
  "to",
  "of",
  "in",
  "on",
  "with",
  "by",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "how",
  "what",
  "why",
  "where",
  "when",
  "which",
  "that",
  "this",
  "it",
  "its",
  "their",
  "they",
  "them",
  "our",
  "we",
  "you",
  "your",
  "as",
  "at",
  "from",
  "about",
  "into",
  "more",
  "less",
  "any",
  "some",
  "can",
  "could",
  "should",
  "would",
  "may",
  "might"
]);

// كاش للمعرفة + Embeddings
let knowledgeCache = null;
let knowledgeLoadedAt = 0;
const KNOWLEDGE_TTL_MS = 12 * 60 * 60 * 1000; // 12 ساعة

let knowledgeEmbeddings = null; // Array<float[] | null>
let embedModel = null;
let embeddingsDisabled = false;

// تهيئة عميل Gemini
let genAI = null;
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

// موديلات Gemini المسموح تجربتها
const MODELS_TO_TRY = [
  "gemini-2.0-flash",
  "gemini-2.0-pro",
  "gemini-1.0-pro"
];

// ============================================================
// 3-Strikes Policy (In-Memory) — Pivot back to AI Business
// Strike 1: Pivot AI قصير
// Strike 2: Pivot أقصر مع دفع للعودة
// Strike 3+: رد تحفيزي ثابت من الستة (genericReplies)
// ============================================================
const STRIKES_ENABLED = true;
const STRIKES_MAX = 3;

// sessionKey => { count:number, updatedAt:number }
const strikeStore = new Map();
function getBrainSessionKey(req = {}) {
  // نحاول نأخذ session_id (أفضل) أو أي مفتاح يرسله السيرفر لاحقًا
  const s =
    String(req.session_id || req.sessionId || req.session_key || req.sessionKey || "").trim();
  return s || "anonymous";
}

function isOutOfScopeIntent(intentId = "") {
  const id = String(intentId || "").trim();
  return id === "out_of_scope" || id === "casual";
}

function resetStrikes(sessionKey) {
  if (!sessionKey) return;
  strikeStore.set(sessionKey, { count: 0, updatedAt: Date.now() });
}

function bumpStrike(sessionKey) {
  const prev = strikeStore.get(sessionKey) || { count: 0, updatedAt: 0 };
  const next = { count: Math.min(prev.count + 1, STRIKES_MAX), updatedAt: Date.now() };
  strikeStore.set(sessionKey, next);
  return next.count;
}

// Pivot templates (fallback لو Gemini فشل/مغلق)
function buildPivot1Fallback() {
  return `🧭 سؤالك مفهوم، لكن نوفا بوت مُصمم أساسًا للذكاء الاصطناعي وتطوير الأعمال.<br>
إذا تحب، اكتب لي: <strong>مجالك</strong> + <strong>هدفك</strong> + <strong>وقتك المتاح</strong>… وأنا أعطيك خطة عملية مختصرة.`;
}

function buildPivot2Fallback() {
  return `🎯 خلّينا نرجع للشيء اللي يطلع لك “نتيجة” بسرعة.<br>
اكتب سطر واحد فقط: <strong>أنا أريد استخدام الذكاء الاصطناعي لـ…</strong> (مبيعات/محتوى/خدمة عملاء/إدارة وقت).`;
}

/* =============== أدوات مساعدة للنصوص =============== */

function escapeHtml(str = "") {
  return str.replace(/[&<>"]/g, (c) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;"
    }[c] || c;
  });
}

function escapeAttr(str = "") {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

function normalizeText(str = "") {
  return str
    .toLowerCase()
    .replace(/[.,!?؟،"“”()\-\_:;«»[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(html = "") {
  return (html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeForConcepts(text = "") {
  const cleaned = normalizeText(text);
  return cleaned.split(" ").filter(Boolean);
}

function isMeaningfulToken(token = "") {
  if (!token || token.length < 2) return false;
  const lower = token.toLowerCase();
  if (ARABIC_STOPWORDS.has(lower) || EN_STOPWORDS.has(lower)) return false;
  return /[a-z؀-ۿ]/i.test(lower);
}

function createConceptList(botReplyText = "") {
  const plain = stripHtml(botReplyText);
  const tokens = tokenizeForConcepts(plain).filter(isMeaningfulToken);
  if (!tokens.length) return [];

  const concepts = new Set();

  // توليد عبارات من 2-4 كلمات
  const maxLen = 4;
  for (let i = 0; i < tokens.length; i++) {
    for (let len = 2; len <= maxLen; len++) {
      if (i + len > tokens.length) continue;
      const phraseTokens = tokens.slice(i, i + len);
      if (phraseTokens.some((t) => !isMeaningfulToken(t))) continue;
      const phrase = phraseTokens.join(" ").trim();
      if (phrase.length < 4) continue;
      concepts.add(phrase);
    }
  }

  // إضافة المصطلحات المفردة ذات المعنى إن لم توجد ضمن العبارات
  tokens.forEach((t) => {
    if (isMeaningfulToken(t) && t.length >= 4) {
      concepts.add(t);
    }
  });

  return Array.from(concepts).slice(0, 10);
}

function tokenizeArray(values = []) {
  const out = new Set();
  for (const value of values) {
    const tokens = normalizeText(value).split(" ").filter((w) => w.length >= 2);
    tokens.forEach((t) => out.add(t));
  }
  return out;
}

function phraseIncludes(text = "", phrase = "") {
  const a = normalizeText(text);
  const b = normalizeText(phrase);
  if (!a || !b) return false;
  return a.includes(b);
}

function countPhraseHits(question = "", phrases = []) {
  let hits = 0;
  for (const phrase of phrases) {
    if (phraseIncludes(question, phrase)) hits++;
  }
  return hits;
}

function tokenize(str = "") {
  return new Set(
    normalizeText(str)
      .split(" ")
      .filter((w) => w.length >= 3)
  );
}

function extractContentDiscoveryTopic(question = "") {
  const original = `${question || ""}`.trim();
  const normalized = normalizeText(original);
  if (!normalized) return original;

  const prefixes = [
    "هل كتبت نوفا لينك عن",
    "هل كتبت novalink عن",
    "هل كتبت عن",
    "هل لدى نوفا لينك مقال عن",
    "هل لديكم مقال عن",
    "هل عندكم مقال عن",
    "هل لديكم تدوينة عن",
    "هل عندكم تدوينة عن",
    "هل تناولت نوفا لينك",
    "هل تناولتم",
    "هل نشرت نوفا لينك",
    "هل نشرتم",
    "هل تحدثت نوفا لينك عن",
    "هل تحدثتم عن"
  ];

  for (const prefix of prefixes) {
    if (normalized.startsWith(prefix)) {
      const extracted = normalized.slice(prefix.length).trim();
      if (extracted.length >= 4) return extracted;
    }
  }

  return normalized;
}
function shouldUseEnglishPreface(text = "") {
  return /[a-zA-Z]/.test(text);
}

/* =============== تحميل قاعدة المعرفة =============== */

function normalizeItem(item) {
  if (!item) return null;

  const normalizeStringArray = (value) =>
    Array.isArray(value)
      ? value.map((v) => `${v}`.trim()).filter(Boolean)
      : [];

  const normalizedKeywords = normalizeStringArray(item.keywords);
  const normalizedKeywordsExtended = normalizeStringArray(item.keywords_extended);
  const normalizedTopicKeywords = normalizeStringArray(item.topic_keywords);
  const normalizedEntities = normalizeStringArray(item.entities);
  const normalizedAliases = normalizeStringArray(item.aliases);
  const normalizedMisspellings = normalizeStringArray(item.misspellings);
  const normalizedFaqQueriesHuman = normalizeStringArray(item.faq_queries_human);

  return {
    title: (item.title || "").trim(),
    title_clean: (item.title_clean || item.title || "").trim(),
    url: (item.url || "").trim(),
    description: (item.description || "").trim(),
    excerpt: (item.excerpt || "").trim(),
    summary: (item.summary || "").trim(),
    embedding_text: (item.embedding_text || "").trim(),
    answer_scope: (item.answer_scope || "").trim(),
    category: (item.category || "general").trim(),
    subcategory: (item.subcategory || "").trim(),
    intent_hint: (item.intent_hint || "").trim(),
    keywords: normalizedKeywords,
    keywords_extended: normalizedKeywordsExtended,
    topic_keywords: normalizedTopicKeywords,
    entities: normalizedEntities,
    aliases: normalizedAliases,
    misspellings: normalizedMisspellings,
    faq_queries_human: normalizedFaqQueriesHuman
  };
}

async function loadKnowledgeBase() {
  if (!knowledgeSourceURL) {
    console.warn("⚠️ Knowledge URL is not set (KNOWLEDGE_V5_URL / KNOWLEDGE_JSON_URL).");
    return [];
  }

  const now = Date.now();
  if (knowledgeCache && now - knowledgeLoadedAt < KNOWLEDGE_TTL_MS) {
    return knowledgeCache;
  }

  try {
    const res = await fetch(knowledgeSourceURL);
    if (!res.ok) {
      throw new Error("Knowledge JSON HTTP " + res.status);
    }

    const json = await res.json();
    const cleaned = Array.isArray(json)
      ? json
          .map(normalizeItem)
          .filter((x) => x && x.title && x.url)
      : [];

    knowledgeCache = cleaned;
    knowledgeLoadedAt = Date.now();
    knowledgeEmbeddings = null; // نعيد بناء الـ Embeddings عند أول طلب

    console.log("✅ Knowledge loaded from", knowledgeSourceURL, "items:", cleaned.length);
    return cleaned;
  } catch (err) {
    console.error("❌ Failed to load knowledge JSON:", err);
    knowledgeCache = [];
    knowledgeLoadedAt = Date.now();
    knowledgeEmbeddings = null;
    return [];
  }
}

// دالة استدعاء من السيرفر لتحديث مصدر المعرفة
export async function loadKnowledgeFromURL(url) {
  if (url && typeof url === "string") {
    knowledgeSourceURL = url.trim();
  } else {
    knowledgeSourceURL = DEFAULT_KNOWLEDGE_URL;
  }
  knowledgeCache = null;
  knowledgeEmbeddings = null;
  const kb = await loadKnowledgeBase();
  return kb.length;
}

/* =============== Embeddings للمعرفة =============== */

async function ensureEmbedModel() {
  if (!genAI || !GEMINI_API_KEY) return null;
  if (!embedModel) {
    embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
  }
  return embedModel;
}

async function embedText(text = "") {
  if (embeddingsDisabled) return null;

  try {
    const model = await ensureEmbedModel();
    if (!model) return null;

    const clean = text.trim();
    if (!clean) return null;

    const result = await model.embedContent({
      content: { parts: [{ text: clean }] }
    });

    const values =
      result?.embedding?.values ||
      result?.data?.[0]?.embedding?.values ||
      [];

    if (!values.length) return null;

    const norm = Math.sqrt(values.reduce((s, v) => s + v * v, 0)) || 1;
    return values.map((v) => v / norm);
  } catch (err) {
    const msg = String(err?.message || "");

    if (
      msg.includes("404") ||
      msg.includes("not found") ||
      msg.includes("not supported")
    ) {
      embeddingsDisabled = true;
      console.warn("⚠️ Embeddings disabled: model unavailable for current API/version.");
      return null;
    }

    console.warn("⚠️ embedText error:", msg);
    return null;
  }
}

async function ensureKnowledgeEmbeddings(items) {
  if (!items || !items.length) {
    knowledgeEmbeddings = [];
    return;
  }
  if (knowledgeEmbeddings && knowledgeEmbeddings.length === items.length) {
    return;
  }

  console.log("🧠 Building knowledge embeddings for", items.length, "items...");
  const embeddings = [];
  for (const item of items) {
const baseText =
  item.embedding_text ||
  (
    (item.title || "") +
    ". " +
    (item.description || "") +
    " " +
    (item.summary || "") +
    " " +
    (item.excerpt || "")
  );
    const emb = await embedText(baseText);
    embeddings.push(emb);
  }
  knowledgeEmbeddings = embeddings;
}

/* =============== Keyword Routing =============== */

function keywordRoute(question = "", items = []) {
  const q = normalizeText(question);
  if (!q || !items.length) return null;

  const qTokens = new Set(
    q.split(" ").filter((t) => t && t.length >= 3 && !ARABIC_STOPWORDS.has(t) && !EN_STOPWORDS.has(t))
  );
  if (!qTokens.size) return null;

  const tokenOverlapScore = (phrase = "") => {
    const pTokens = Array.from(
      new Set(
        normalizeText(phrase)
          .split(" ")
          .filter((t) => t && t.length >= 3 && !ARABIC_STOPWORDS.has(t) && !EN_STOPWORDS.has(t))
      )
    );

    if (!pTokens.length) return 0;

    let overlap = 0;
    for (const token of pTokens) {
      if (qTokens.has(token)) overlap++;
    }

    if (!overlap) return 0;

    const ratio = overlap / pTokens.length;
    if (overlap >= 2) return ratio;
    if (pTokens.length === 1 && overlap === 1) return 0.9;
    return ratio >= 0.6 ? ratio : 0;
  };

  const scoreFieldGroup = (phrases = [], weight = 1) => {
    let best = 0;

    for (const rawPhrase of phrases) {
      const phrase = `${rawPhrase || ""}`.trim();
      if (!phrase) continue;

      const normalizedPhrase = normalizeText(phrase);
      if (!normalizedPhrase || normalizedPhrase.length < 3) continue;

      let score = 0;

      if (phraseIncludes(q, normalizedPhrase)) {
        score = 1.2;
      } else if (phraseIncludes(normalizedPhrase, q) && q.length >= 5) {
        score = 1.0;
      } else {
        score = tokenOverlapScore(normalizedPhrase);
      }

      if (score > best) best = score;
    }

    return best * weight;
  };

  let bestItem = null;
  let bestScore = 0;

  for (const item of items) {
    const titlePhrases = [item.title, item.title_clean];
    const entityPhrases = item.entities || [];
    const aliasPhrases = item.aliases || [];
    const misspellingPhrases = item.misspellings || [];
    const faqPhrases = item.faq_queries_human || [];
    const topicPhrases = item.topic_keywords || [];
    const keywordPhrases = item.keywords || [];
    const keywordExtendedPhrases = item.keywords_extended || [];

    const directAnchorScore =
      scoreFieldGroup(titlePhrases, 4.0) +
      scoreFieldGroup(entityPhrases, 3.2) +
      scoreFieldGroup(aliasPhrases, 2.8) +
      scoreFieldGroup(misspellingPhrases, 2.2) +
      scoreFieldGroup(faqPhrases, 2.4);

    const supportScore =
      scoreFieldGroup(topicPhrases, 1.2) +
      scoreFieldGroup(keywordPhrases, 0.9) +
      scoreFieldGroup(keywordExtendedPhrases, 0.7);

    // لا نسمح للمسار السريع أن يعمل إذا لم توجد مرساة مباشرة
    if (directAnchorScore <= 0) continue;

    const itemScore = directAnchorScore + Math.min(1.4, supportScore);

    if (itemScore > bestScore) {
      bestScore = itemScore;
      bestItem = item;
    }
  }

  // strong keyword routing فقط عندما تكون هناك أدلة مباشرة كافية
  if (!bestItem || bestScore < 2.6) return null;

  const routedScore = Math.min(0.975, 0.90 + Math.min(0.06, bestScore * 0.01));
  return { item: bestItem, score: routedScore };
}

/* =============== حساب التطابق مع المعرفة =============== */

function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
  }
  return dot;
}

async function findBestMatch(question, items) {
  if (!question || !items || !items.length) {
    return { score: 0, item: null };
  }

  const retrievalQuestion = extractContentDiscoveryTopic(question);
  const normalizedQuestion = normalizeText(retrievalQuestion);
  const qTokens = tokenize(retrievalQuestion);
  if (!qTokens.size) return { score: 0, item: null };

  // Keyword routing أولًا
  const routed = keywordRoute(retrievalQuestion, items);
  if (routed) {
    console.log("🎯 Keyword route hit →", routed.item.url);
    return routed;
  }

  await ensureKnowledgeEmbeddings(items);
  const qEmbedding = await embedText(retrievalQuestion);

  const genericQuestionTokens = new Set(
    [...qTokens].filter(
      (token) =>
        token.length <= 2 ||
        ARABIC_STOPWORDS.has(token) ||
        EN_STOPWORDS.has(token) ||
        [
          "ai",
          "artificial",
          "intelligence",
          "ذكاء",
          "الذكاء",
          "اصطناعي",
          "الاصطناعي",
          "أداة",
          "اداة",
          "أدوات",
          "ادوات",
          "business",
          "عمل",
          "الأعمال",
          "الاعمال",
          "شركة",
          "شركات",
          "productivity",
          "انتاجية",
          "إنتاجية"
        ].includes(token)
    )
  );

  let bestItem = null;
  let bestScore = 0;

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];

    const titleValue = item.title_clean || item.title || "";
    const entityPhrases = item.entities || [];
    const aliasPhrases = item.aliases || [];
    const misspellingPhrases = item.misspellings || [];
    const faqPhrases = item.faq_queries_human || [];
    const keywordPhrases = item.keywords || [];
    const keywordExtendedPhrases = item.keywords_extended || [];
    const topicPhrases = item.topic_keywords || [];

    const combined =
      (item.title || "") +
      " " +
      (item.title_clean || "") +
      " " +
      (item.description || "") +
      " " +
      (item.excerpt || "") +
      " " +
      (item.summary || "") +
      " " +
      (item.embedding_text || "") +
      " " +
      (item.answer_scope || "") +
      " " +
      entityPhrases.join(" ") +
      " " +
      aliasPhrases.join(" ") +
      " " +
      misspellingPhrases.join(" ") +
      " " +
      faqPhrases.join(" ") +
      " " +
      topicPhrases.join(" ") +
      " " +
      keywordPhrases.join(" ") +
      " " +
      keywordExtendedPhrases.join(" ");

    const tTokens = tokenize(combined);
    if (!tTokens.size) continue;

    let common = 0;
    let genericOverlap = 0;

    qTokens.forEach((t) => {
      if (tTokens.has(t)) {
        common++;
        if (genericQuestionTokens.has(t)) genericOverlap++;
      }
    });

    const lexicalScore = common / Math.max(qTokens.size, 3);
    const unionSize = qTokens.size + tTokens.size - common;
    const jaccard = unionSize > 0 ? common / unionSize : 0;

    const titleTokens = tokenize(titleValue);
    let titleCommon = 0;
    qTokens.forEach((t) => {
      if (titleTokens.has(t)) titleCommon++;
    });
    const titleScore =
      titleCommon / Math.max(Math.min(qTokens.size, titleTokens.size) || 1, 1);

    const entityHits = countPhraseHits(retrievalQuestion, entityPhrases);
    const aliasHits = countPhraseHits(retrievalQuestion, aliasPhrases);
    const misspellingHits = countPhraseHits(retrievalQuestion, misspellingPhrases);
    const faqHits = countPhraseHits(retrievalQuestion, faqPhrases);
    const topicHits = countPhraseHits(retrievalQuestion, topicPhrases);
    const keywordHits = countPhraseHits(retrievalQuestion, keywordPhrases);
    const keywordExtendedHits = countPhraseHits(retrievalQuestion, keywordExtendedPhrases);

    const exactTitleHit = phraseIncludes(retrievalQuestion, titleValue) ? 1 : 0;
    const titleContainsQuestion =
      normalizedQuestion && normalizeText(titleValue).includes(normalizedQuestion) ? 1 : 0;

    const keywordTokens = tokenizeArray(keywordPhrases);
    const topicKeywordTokens = tokenizeArray(topicPhrases);
    const keywordExtendedTokens = tokenizeArray(keywordExtendedPhrases);
    const aliasTokens = tokenizeArray(aliasPhrases);
    const entityTokens = tokenizeArray(entityPhrases);

    let keywordCommon = 0;
    qTokens.forEach((t) => {
      if (
        keywordTokens.has(t) ||
        topicKeywordTokens.has(t) ||
        keywordExtendedTokens.has(t) ||
        aliasTokens.has(t) ||
        entityTokens.has(t)
      ) {
        keywordCommon++;
      }
    });

    const keywordScore =
      keywordCommon /
      Math.max(
        qTokens.size,
        Math.min(
          (
            keywordTokens.size +
            topicKeywordTokens.size +
            keywordExtendedTokens.size +
            aliasTokens.size +
            entityTokens.size
          ) || 1,
          8
        )
      );

    let semantic = 0;
    if (qEmbedding && knowledgeEmbeddings && knowledgeEmbeddings[idx]) {
      semantic = cosineSimilarity(qEmbedding, knowledgeEmbeddings[idx]);
    }

    const exactEvidence =
      exactTitleHit +
      titleContainsQuestion +
      entityHits * 1.4 +
      aliasHits * 1.15 +
      misspellingHits * 1.1 +
      faqHits * 0.9;

    const topicEvidence = topicHits * 0.55 + keywordHits * 0.4 + keywordExtendedHits * 0.3;

    const genericPenalty =
      common > 0 ? Math.min(0.22, (genericOverlap / common) * 0.22) : 0;

    const weakEvidencePenalty =
      exactEvidence === 0 && topicEvidence > 0 && semantic < 0.56 ? 0.14 : 0;

    const weighted =
      0.17 * lexicalScore +
      0.08 * jaccard +
      0.22 * titleScore +
      0.16 * keywordScore +
      0.09 * semantic +
      Math.min(0.34, exactEvidence * 0.08) +
      Math.min(0.12, topicEvidence * 0.035) -
      genericPenalty -
      weakEvidencePenalty;

    const hasStrongEvidence =
      exactTitleHit > 0 ||
      titleContainsQuestion > 0 ||
      entityHits > 0 ||
      aliasHits > 0 ||
      misspellingHits > 0 ||
      faqHits > 0;

    const hasExactTopicAnchor =
      exactTitleHit > 0 ||
      titleContainsQuestion > 0 ||
      entityHits > 0 ||
      aliasHits > 0 ||
      faqHits > 0;

    const isGenericQuestion =
      exactEvidence === 0 &&
      (
        qTokens.size <= 4 ||
        (topicEvidence > 0 && titleScore < 0.34 && keywordScore < 0.42)
      );

    let finalScore = weighted;

    if (!hasStrongEvidence) {
      finalScore = Math.min(finalScore, 0.62);
    }

    if (!hasExactTopicAnchor && weighted < 0.78) {
      finalScore = Math.min(finalScore, 0.61);
    }

    if (isGenericQuestion && !hasExactTopicAnchor) {
      finalScore = Math.min(finalScore, 0.58);
    }

    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestItem = item;
    }
  }

  return { score: bestScore, item: bestItem };
}

/* =============== Intent helpers (بدون كشف نية داخلي) =============== */

function buildStrongMatchReply(item) {
  const safeTitle = escapeHtml(item.title || "");
  const safeUrl = escapeAttr(item.url || "#");

  return `
 السؤال الذي طرحته سبق أن تناولناه في نوفا لينك بعنوان:<br>
 “${safeTitle}”.<br><br>
 هذه التدوينة صُممت لتقدّم إجابة مركّزة يمكن تطبيقها في عملك مباشرة.<br>
 🔗 <a href="${safeUrl}" target="_blank" class="nova-link">اقرأ المقال على نوفا لينك</a>`;
}

function buildMidMatchTemplateReply(item) {
  const safeTitle = escapeHtml(item.title || "");
  const safeUrl = escapeAttr(item.url || "#");

  return `
 سؤالك قريب من فكرة ناقشناها في نوفا لينك بعنوان:<br>
 “${safeTitle}”.<br><br>
 قد لا تكون الإجابة طبق الأصل عمّا في ذهنك، لكنها ستفتح لك زاوية تفكير أوسع حول الموضوع.<br>
 🔗 <a href="${safeUrl}" target="_blank" class="nova-link">اقرأ المقال</a>`;
}

function wrapAiAnswerWithLink(aiText, item) {
  const safeUrl = escapeAttr(item.url || "#");
  const safeAi = escapeHtml(aiText).replace(/\n/g, "<br>");

  return `
 ${safeAi}<br><br>
 🔗 <a href="${safeUrl}" target="_blank" class="nova-link">
   تعمّق أكثر من خلال هذه التدوينة على نوفا لينك
 </a>`;
}

function buildAutomatedFallbackReply(lang = "ar") {
  return lang === "en"
    ? (NOVABOT_TEXT_PACKAGE.noMatch_en || "💬 Share your goal and I’ll guide you in a practical direction.")
    : NOVABOT_TEXT_PACKAGE.noMatch;
}

function buildGreetingReply(isReturning = false, lang = "ar") {
  if (lang === "en") {
    return isReturning
      ? NOVABOT_TEXT_PACKAGE.welcomeReturning_en
      : NOVABOT_TEXT_PACKAGE.welcomeFirst_en;
  }

  return isReturning
    ? NOVABOT_TEXT_PACKAGE.welcomeReturning
    : NOVABOT_TEXT_PACKAGE.welcomeFirst;
}


function buildThanksPositiveReply(lang = "ar") {
  return lang === "en"
    ? randomFrom(NOVABOT_TEXT_PACKAGE.positiveReplies_en || [])
    : randomFrom(NOVABOT_TEXT_PACKAGE.positiveReplies || []);
}
function buildNegativePreface(lang = "ar", dialectHint = "msa") {
  const d = String(dialectHint || "msa").toLowerCase();

  // Controlled dialect touch (very light)
  const dialectAr =
    d.includes("levant") ? "حقّك علينا. " :
    d.includes("egypt") ? "معاك حق. " :
    d.includes("gulf") ? "أبشر. " :
    d.includes("maghreb") ? "سمح لي. " :
    "";

  if (lang === "en") {
    return "You’re right to push back — let’s make this actually useful.";
  }
  return `${dialectAr}أفهمك تمامًا — خلّيني أعطيك جوابًا أوضح وعمليًا.`;
}

function buildNegativeMoodReply(lang = "ar") {
  return lang === "en"
    ? randomFrom(NOVABOT_TEXT_PACKAGE.negativeReplies_en || [])
    : randomFrom(NOVABOT_TEXT_PACKAGE.negativeReplies || []);
}

function buildSubscribeInterestReply(lang = "ar") {
  if (lang === "en") {
    return `📬 Love the momentum.<br>Get focused AI updates from NovaLink — calm, useful, no spam.`;
  }
  return `📬 يسعدني حماسك للمتابعة
بدل التشتت بين عشرات المصادر،
يمكنك أن تصلك الخلاصة مباشرة — بهدوء، وبدون إزعاج.`;
}

function buildBusinessSubscribeReply() {
  return `👨‍💻 كثير من روّاد الأعمال يشعرون أن الذكاء الاصطناعي “مهم”…
لكنهم لا يجدون وقتًا لتجربة كل أداة أو متابعة كل تحديث.
هنا نحاول اختصار الطريق، لا تعقيده.`;
}

function buildConsultingPurchaseReply(lang = "ar") {
  if (lang === "en") {
    return `💬 Most projects don’t fail because of the product — they fail because the next step is unclear.`;
  }
  return `💬 أغلب المشاريع لا تخسر بسبب ضعف المنتج،
الحل أحيانًا أبسط مما نتوقع.`;
}

function buildCollaborationReply(lang = "ar") {
  if (lang === "en") {
    return `🤝 If you’re thinking of a partnership or a serious collaboration idea, use the collaboration card — we’ll get back after review.`;
  }
  return `🤝 إن كنت تفكّر بتعاون، شراكة، أو فكرة مشتركة ذات قيمة حقيقية،
استخدم بطاقة التعاون في الواجهة، وسنعود إليك بعد مراجعة الفكرة.`;
}


function buildDeveloperIdentityReply(language = "ar") {
  // العربية هي الافتراضية دائمًا
  if (language !== "en") {
return `✨ من المهم أن تعرف من طوّر نوفا بوت و دربه، لا بدافع الفضول، بل لبناء الثقة.`;
  }

  // الإنجليزية فقط إذا فُرضت صراحة
  return `✨ It matters to know who built and trained NovaBot — not out of curiosity, but to build trust.`;
}

function buildNovaLinkInfoReply(subIntent = "", lang = "ar") {
  const s = String(subIntent || "").trim().toLowerCase();

  // English
  if (lang === "en") {
    if (s === "story") return NOVABOT_TEXT_PACKAGE.story_en;
    if (s === "mission") return NOVABOT_TEXT_PACKAGE.mission_en;
    if (s === "vision" || s === "vision_goal" || s === "goal") return NOVABOT_TEXT_PACKAGE.vision_en;
    return NOVABOT_TEXT_PACKAGE.aboutNovaLink_en;
  }

  // Arabic
  if (s === "story") return NOVABOT_TEXT_PACKAGE.story;
  if (s === "mission") return NOVABOT_TEXT_PACKAGE.mission;
  if (s === "vision" || s === "vision_goal" || s === "goal") return NOVABOT_TEXT_PACKAGE.vision;

  return NOVABOT_TEXT_PACKAGE.aboutNovaLink;
}


function buildNovaBotInfoReply() {
  return `🤖 نوفا بوت هو مساعد دردشة ذكي من منصة نوفا لينك، أقرب إلى "مستشار عملي" منه إلى روبوت أسئلة وأجوبة.<br><br>
 يركّز نوفا بوت على:<br>
 - مساعدتك على فهم أدوات الذكاء الاصطناعي واختيار ما يناسب مشروعك.<br>
 - اقتراح خطوات عملية لرفع الإنتاجية وتبسيط عملك اليومي.<br>
 - توجيهك إلى أكثر الأفكار والمفاهيم ارتباطًا بسؤالك، بدل إغراقك بتفاصيل لا تحتاجها الآن.<br><br>
 كلما كان سؤالك أوضح ومرتبطًا بعملك، كانت إجابته أدق وأكثر فائدة.`;
}

function buildGoodbyeReply(lang = "ar") {
  return lang === "en"
    ? NOVABOT_TEXT_PACKAGE.goodbye_en
    : NOVABOT_TEXT_PACKAGE.goodbye;
}

function isGoodbyeMessage(text = "") {
  const t = (text || "").toLowerCase();
  const arabicBye = [
    "مع السلامة",
    "سلام",
    "أراك لاحقًا",
    "اشوفك",
    "اشوفكم",
    "الى اللقاء",
    "إلى اللقاء",
    "وداعا",
    "وداعًا",
    "خلص شكرا",
    "يكفي شكرا"
  ];
  const englishBye = ["bye", "goodbye", "see you", "see ya", "see u", "thanks bye"];

  return (
    arabicBye.some((kw) => t.includes(kw)) ||
    englishBye.some((kw) => t.includes(kw))
  );
}

/* =============== بطاقة المطوّر – الكود السري 10406621 =============== */

function normalizeArabicDigits(str = "") {
  const map = {
    "٠": "0",
    "١": "1",
    "٢": "2",
    "٣": "3",
    "٤": "4",
    "٥": "5",
    "٦": "6",
    "٧": "7",
    "٨": "8",
    "٩": "9"
  };
  return str.replace(/[٠-٩]/g, d => map[d] || d);
}

function hasDeveloperCode(text = "") {
  const normalized = normalizeArabicDigits(text || "");
  return normalized.includes("10406621");
}



/* =============== استنتاج نوع الجلسة (AI Session) من التاريخ =============== */

function isSimpleClosing(text = "") {
  const t = (text || "").toLowerCase().trim();
  const simpleThanks = ["شكرا", "شكراً", "thanks", "thank you"];
  const simpleBye = ["مع السلامة", "وداعا", "وداعًا", "bye", "goodbye"];
  return simpleThanks.includes(t) || simpleBye.includes(t);
}

function detectAISession(currentIntentId, sessionHistory = []) {
  if (currentIntentId === "ai_business") return true;

  const lastUserMsgs = (sessionHistory || [])
    .filter((m) => m && m.role === "user")
    .slice(-3);

  return lastUserMsgs.some((m) => {
    if (!m || !m.text) return false;
    if (isSimpleClosing(m.text)) return false;
    const historicalIntent = m.effectiveIntentId || m.intentId || "";
    return historicalIntent === "ai_business" || m.hasAI === true;
  });
}

function countRecentAIReplies(sessionHistory = []) {
  const msgs = Array.isArray(sessionHistory) ? sessionHistory : [];

  return msgs
    .filter((m) => {
      if (!m) return false;
      if (m.role !== "assistant" && m.role !== "bot" && m.role !== "model") return false;
      if (m.geminiUsed === true || m.usedAI === true) return true;

      const mt = String(m.matchType || "").toLowerCase();
      return mt === "direct_ai" || mt === "medium_match" || mt.startsWith("pivot_");
    })
    .slice(-3).length;
}

/* =============== استدعاء Gemini =============== */

function buildGeminiPrompt(
  userText,
  analysis,
  bestItem,
  isFollowup = false,
  recentConcepts = []
) {
  const lang = analysis.language === "en" ? "en" : "ar";
  const intentId = analysis.intentId || "explore";

  let base = "";

  base += `User question / سؤال المستخدم:\n"${userText}"\n\n`;

  base += `Context / سياق:\n`;
  base += `- intentId: ${intentId}\n`;
  base += `- language: ${lang}\n`;
  base += `- dialectHint: ${analysis.dialectHint || "msa"}\n`;
  base += `- toneHint: ${analysis.toneHint || "neutral"}\n`;
  if (analysis.topicTransition) {
    base += `- topicTransition: ${analysis.topicTransition}\n`;
  }
  if (analysis.sessionTier) {
    base += `- sessionTier: ${analysis.sessionTier}\n`;
  }
  if (analysis.contextFollowing) {
    base += `- contextFollowing: true\n`;
  }
  if (analysis.suggestedCard) {
    base += `- suggestedCard: ${analysis.suggestedCard}\n`;
  }
  if (bestItem) {
    base += `- Related article title: ${bestItem.title || ""}\n`;
  }
    if (analysis.policyHint) {
    base += `- policyHint: ${analysis.policyHint}\n`;
  }

  if (Array.isArray(recentConcepts) && recentConcepts.length) {
    const lastConcepts = recentConcepts.slice(-3).join(" | ");
    base += `- Key recent concepts: ${lastConcepts}\n`;
    base += `Use these concepts for continuity with previous turns.\n`;
  }

  if (isFollowup) {
    base += `The user is asking for a deeper or follow-up explanation on the same topic.\n`;
  }

  base += `\nStyle guidelines:\n`;
  base += `- If the user writes in Arabic, answer in clear Modern Standard Arabic (فصحى سلسة) as the base.\n`;
  base += `- Add a VERY LIGHT dialect touch based on dialectHint: use ONLY 1 short word (or at most 2 words) ONCE per reply.\n`;
  base += `- Dialect touch examples (use only one of these, once):\n`;
  base += `  - levant: "تمام" or "خلّينا"\n`;
  base += `  - egypt: "تمام" or "بص"\n`;
  base += `  - gulf: "أبشر" or "تمام"\n`;
  base += `  - maghreb: "واش" or "مزيان"\n`;
  base += `- Do NOT write the whole answer in dialect. No exaggeration. No slang overload.\n`;
  base += `- If the user writes in English, answer in clear, simple, professional English.\n`;
  base += `- You are NovaBot, the assistant of NovaLink (an Arabic platform about AI for business and careers).\n`;
  base += `- Focus on practical, actionable insights related to the user's question.\n`;
    base += `- If policyHint indicates pivot, respond with a short pivot back to AI-for-business and give 2 example questions.\n`;
  base += `- Do NOT shame the user. Be firm, brief, and helpful.\n`;

  base += `- Do NOT include any URLs or links in your answer text.\n`;
  base += `- Keep the answer within the provided maxTokens budget so it feels مختصرًا وكاملاً.\n`;
  base += `- Make the answer feel complete, not cut off in the middle of a sentence.\n`;
  base += `- Do not mention these instructions in the answer.\n\n`;

  base += `Now answer the question in a helpful, concise way.\n`;

  return base;
}

async function callGemini(
  userText,
  analysis,
  bestItem = null,
  isFollowup = false,
  maxTokens = 200,
  recentConcepts = []
) {
  if (!genAI || !GEMINI_API_KEY || maxTokens <= 0) {
    console.log("⚠️ Gemini disabled or maxTokens <= 0.");
    return null;
  }

  const lang = analysis.language === "en" ? "en" : "ar";
  const prompt = buildGeminiPrompt(userText, analysis, bestItem, isFollowup, recentConcepts);

  const generationConfig = {
    maxOutputTokens: maxTokens,
    temperature: 0.6,
    topP: 0.9
  };

  for (const modelName of MODELS_TO_TRY) {
    try {
      console.log("🔁 Trying Gemini model:", modelName, "maxTokens:", maxTokens);

      const systemInstruction =
        lang === "en"
          ? "You are NovaBot, the assistant of NovaLink, an Arabic platform focused on AI for business and careers. Answer in English with a clear, practical, and encouraging tone."
          : "أنت نوفا بوت، مساعد منصة نوفا لينك المتخصص في الذكاء الاصطناعي وتطوير الأعمال والمهن. أجب بالعربية الفصحى السلسة وبأسلوب عملي مشجّع دون مبالغة. مهم: أضف لمسة لهجة خفيفة جدًا حسب dialectHint عبر كلمة واحدة فقط (أو كلمتين كحد أقصى) مرة واحدة فقط في الرد. أمثلة مسموحة (اختر واحدة فقط مرة واحدة): levant: (تمام/خلّينا) — egypt: (تمام/بص) — gulf: (أبشر/تمام) — maghreb: (واش/مزيان). ممنوع تحويل الرد كله لهجة أو الإكثار من العامية.";

      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction
      });

      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig
      });

      const raw =
        result?.response?.text?.() ||
        result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "";

      let text = (raw || "").trim();
      if (text.length <= 2) {
        continue;
      }
      // ترميم بسيط لو النص انقطع بدون خاتمة
if (!/[.!؟…]$/.test(text)) {
  text = text.replace(/\s+$/g, "") + "…";
}
            // منع مخاطبة بجنس (فهمتِ/فهمتَ) لأنها تسبب إحراج وتجربة غير مهنية
      text = text.replace(/\bفهمتِ\b/g, "فهمت");
      text = text.replace(/\bفهمتي\b/g, "فهمت");
      text = text.replace(/\bفهمتَ\b/g, "فهمت");

      const tailAr = " وإذا احتجت توضيحًا أعمق في نقطة معيّنة، اطلب مني أن أتعمّق فيها أكثر.";
      const tailEn = " If you’d like a deeper explanation on a specific part, just ask me to go deeper on it.";

      if (lang === "en" && !text.toLowerCase().includes("deeper explanation")) {
        text = text + tailEn;
      } else if (lang !== "en" && !text.includes("توضيحًا أعمق")) {
        text = text + tailAr;
      }

      console.log("✅ Gemini success:", modelName);
      return text;
    } catch (err) {
      console.log("⚠️ Gemini error on", modelName, "→", err.message);
      continue;
    }
  }

  console.log("⚠️ Gemini full fallback → Automated reply.");
  return null;
}

/* =============== المساعد الأساسي =============== */

export async function novaBrainSystem(request) {
  const userText = (request.message || "").trim();
  const originalIntentId = request.originalIntentId || request.intentId || "explore";
  const effectiveIntentId = request.intentId || originalIntentId;
  const language = request.language || "ar";
  const forceAI = request.forceAI === true;
  const sessionConcepts = Array.isArray(request.sessionConcepts)
    ? request.sessionConcepts
    : [];
  const sessionTier = request.sessionTier || "non_ai";
  const weightScore = request.weightScore || 0;
  const allowGemini = request.allowGemini !== false;
  const topicTransition = request.topicTransition || "same_topic";
    // UX Rule: إذا النبرة سلبية، لا نعرض بطاقة اشتراك الأعمال
  const toneHintLower = String(request.toneHint || "").toLowerCase();
  const suppressBusinessSubscribeCard = toneHintLower === "negative";

const safeActionCard = (card) => {
  const c = String(card || "").trim().toLowerCase();
  if (!c) return null;

  // أثناء السلبية: امنع أي بطاقة مرتبطة بالأعمال (مهما كان اسمها)
  if (suppressBusinessSubscribeCard && (c === "business_subscribe" || c.includes("business"))) {
    return null;
  }

  return card;
};

  const sessionHistory = Array.isArray(request.recentMessages)
    ? request.recentMessages
    : Array.isArray(request.sessionHistory)
    ? request.sessionHistory
    : [];

  const isAIQuestion = effectiveIntentId === "ai_business";
  const isAISession = detectAISession(effectiveIntentId, sessionHistory);
    // Session key for strike policy
  const brainSessionKey = getBrainSessionKey(request);

  // لو دخل المستخدم في نطاق AI الحقيقي، نصفر الضربات
  if (STRIKES_ENABLED && (effectiveIntentId === "ai_business" || originalIntentId === "ai_business")) {
    resetStrikes(brainSessionKey);
  }

  const finalizeResponse = (
    reply,
    {
      usedAI = false,
      actionCard = null,
      matchType = "none",
      maxTokens = 0,
      resetConcepts = false,
      geminiUsed = false
    } = {}
  ) => {
    const extractedConcepts = createConceptList(reply);
return {
  reply,
  actionCard: safeActionCard(actionCard),
  usedAI,
  geminiUsed,
  matchType,
  maxTokens,
  extractedConcepts,
  resetConcepts
};
  };

  // 0) رد ترحيبي إذا لا يوجد نص
  if (!userText) {
    return finalizeResponse(getRandomGenericReply(language), { matchType: "empty" });
  }

  // 0.1) بطاقة المطوّر
  if (hasDeveloperCode(userText)) {
    const langPref = shouldUseEnglishPreface(userText) ? "en" : "ar";

    return finalizeResponse(buildDeveloperIdentityReply(langPref), {
      actionCard: "developer_identity",
      matchType: "fixed"
    });
  }

  // 0.2) وداع
  if (isGoodbyeMessage(userText)) {
    return finalizeResponse(buildGoodbyeReply(language), { resetConcepts: true, matchType: "goodbye" });
  }

  // 0.3) خارج النطاق: لا نرجع فورًا إذا كانت سياسة 3 ضربات مفعّلة
  if (originalIntentId === "out_of_scope" && !STRIKES_ENABLED) {
    return finalizeResponse(getRandomGenericReply(language), { matchType: "out_of_scope" });
  }


  // 1) نوايا ثابتة (طالما لسنا مجبرين على AI)
  if (!forceAI) {
    if (originalIntentId === "greeting") {
return finalizeResponse(buildGreetingReply(sessionHistory.length > 0, language), { matchType: "fixed" });
    }

    if (originalIntentId === "thanks_positive") {
      return finalizeResponse(buildThanksPositiveReply(language), {
        actionCard: safeActionCard(request.suggestedCard || "subscribe"),
        matchType: "fixed"
      });
    }

if (originalIntentId === "negative_mood") {
  return finalizeResponse(buildNegativeMoodReply(language), {
    actionCard: safeActionCard(request.suggestedCard || null),
    matchType: "fixed"
  });
}

    if (originalIntentId === "subscribe_interest") {
      return finalizeResponse(buildSubscribeInterestReply(language), {
        actionCard: safeActionCard(request.suggestedCard || "subscribe"),
        matchType: "fixed"
      });
    }

    if (originalIntentId === "collaboration") {
      return finalizeResponse(buildCollaborationReply(language), {
        actionCard: safeActionCard(request.suggestedCard || "collaboration"),
        matchType: "fixed"
      });
    }

    if (originalIntentId === "consulting_purchase") {
      return finalizeResponse(buildConsultingPurchaseReply(language), {
        actionCard: safeActionCard(request.suggestedCard || "bot_lead"),
        matchType: "fixed"
      });
    }

    if (originalIntentId === "novalink_info") {
return finalizeResponse(
  buildNovaLinkInfoReply(request.sub_intent || request.subIntent || "", language),
  { matchType: "fixed" }
);
    }

    if (originalIntentId === "novabot_info") {
      return finalizeResponse(buildNovaBotInfoReply(), { matchType: "fixed" });
    }

        if (originalIntentId === "out_of_scope" || originalIntentId === "casual") {
      // 3-Strikes Policy: نحاول Pivot للذكاء الاصطناعي بدل “تجاهل”
      if (STRIKES_ENABLED && !isAISession && !isAIQuestion && !forceAI) {
        const strike = bumpStrike(brainSessionKey);

        // Strike 1: Pivot AI قصير
        if (strike === 1) {
          const ai = allowGemini
            ? await callGemini(
                userText,
                { ...request, policyHint: "pivot_short", intentId: "pivot" },
                null,
                false,
                70,
                sessionConcepts
              )
            : null;

          return finalizeResponse(
            ai ? escapeHtml(ai).replace(/\n/g, "<br>") : buildPivot1Fallback(),
            { matchType: "pivot_1", usedAI: !!ai, geminiUsed: !!ai, maxTokens: ai ? 70 : 0 }
          );
        }

        // Strike 2: Pivot أقصر مع دفع للعودة
        if (strike === 2) {
          const ai = allowGemini
            ? await callGemini(
                userText,
                { ...request, policyHint: "pivot_shorter", intentId: "pivot" },
                null,
                false,
                40,
                sessionConcepts
              )
            : null;

          return finalizeResponse(
            ai ? escapeHtml(ai).replace(/\n/g, "<br>") : buildPivot2Fallback(),
            { matchType: "pivot_2", usedAI: !!ai, geminiUsed: !!ai, maxTokens: ai ? 40 : 0 }
          );
        }

        // Strike 3+: رد تحفيزي ثابت من الستة (genericReplies)
        return finalizeResponse(getRandomGenericReply(language), { matchType: "pivot_3" });
      }

      // لو الجلسة AI أو سؤال AI، نكمل طبيعي
    }

  }

  // 2) تحميل المعرفة + أفضل تطابق (للمجالات ذات الصلة فقط)
    // AI-first: نسمح بالمعرفة طالما Gemini مسموح (عدد عناصر المعرفة قليل عندك، فالأثر مقبول)
  const allowKnowledge = allowGemini;

  let bestMatch = { score: 0, item: null };

  if (allowKnowledge) {
    const kb = await loadKnowledgeBase();
    if (kb.length) {
      bestMatch = await findBestMatch(userText, kb);
    }
  }

  const { score, item } = bestMatch;

  // 2-أ) تطابق قوي → رد مؤتمت + رابط فقط (بدون Gemini)
  if (item && score >= STRONG_MATCH_THRESHOLD) {
    const replyHtml = buildStrongMatchReply(item);
    return finalizeResponse(replyHtml, {
      actionCard: null,
      matchType: "strong_match",
      maxTokens: 0
    });
  }

  // 2-ب) تطابق متوسط → Gemini قصير + رابط (maxTokens = 100)
  if (item && score >= MEDIUM_MATCH_THRESHOLD) {
    const aiText =
      allowGemini && (effectiveIntentId === "ai_business" || isAISession || forceAI)
        ? await callGemini(

            userText,
            { ...request, sessionTier, contextFollowing: request.contextFollowing, topicTransition },
            item,
            false,
            100,
            sessionConcepts
          )
        : null;

    if (aiText) {
      const replyHtml = wrapAiAnswerWithLink(aiText, item);
      return finalizeResponse(replyHtml, {
        actionCard: safeActionCard(request.suggestedCard || null),
        usedAI: true,
        geminiUsed: true,
        matchType: "medium_match",
        maxTokens: 100
      });
    }

    const replyHtml = buildMidMatchTemplateReply(item);
    return finalizeResponse(replyHtml, {
actionCard: safeActionCard(request.suggestedCard || null),
      matchType: "medium_match",
      maxTokens: 0
    });
  }

  // 2-ج) لا تطابق قوي/متوسط → نقرر منطق الجلسة + نوع السؤال

  // جلسة غير AI + سؤال غير AI + بدون إجبار → من الردود التحفيزية
  if (!isAISession && !isAIQuestion && !forceAI) {
    return finalizeResponse(getRandomGenericReply(language), { matchType: "out_of_scope" });
  }

  // كشف طلبات "أكمل / تابع / تعمق"
  const lower = userText.toLowerCase();
  const followupAr = [
    "أكمل",
    "تابع",
    "وضّح أكثر",
    "وضح أكثر",
    "تفاصيل أكثر",
    "تعمق فيها",
    "تعمق فيها اكثر",
    "اتعمق فيها اكثر"
  ];
  const followupEn = ["continue", "more", "explain", "details", "go deeper"];

  const isFollowup =
    followupAr.some((kw) => userText.includes(kw)) ||
    followupEn.some((kw) => lower.includes(kw));

  // جدول maxTokens وفق السياسة + تكييف القوة
  const recentAICount = countRecentAIReplies(sessionHistory);

  let baseTokens = isAISession ? (isAIQuestion ? 200 : 100) : 0;
  if (!allowGemini) {
    baseTokens = 0;
  }

  // استعادة سلوك السقف المتناقص:
  // 0 = أول رد AI
  // 1 = ثاني رد AI
  // 2+ = fallback تحفيزي بدل Gemini
  if (recentAICount === 1) {
    baseTokens = Math.min(baseTokens, isAIQuestion ? 120 : 80);
  } else if (recentAICount >= 2) {
    baseTokens = 0;
  }

  let maxTokens = baseTokens;
  if (baseTokens > 0) {
    if (sessionTier === "strong_ai") {
      maxTokens = Math.min(maxTokens, baseTokens + 20);
    } else if (sessionTier === "semi_ai") {
      maxTokens = Math.min(maxTokens, baseTokens + 10);
    }

    if (topicTransition === "soft_switch") {
      maxTokens = Math.max(60, Math.round(maxTokens * 0.8));
    }
    if (topicTransition === "hard_switch" && !request.contextFollowing) {
      maxTokens = Math.round(maxTokens * 0.6);
    }

    const wordCount = normalizeText(userText).split(" ").filter(Boolean).length;
    if (wordCount > 0 && wordCount <= 8) {
      maxTokens = Math.max(50, maxTokens - 30);
    }
  }

  const aiText =
    allowGemini && maxTokens > 0
      ? await callGemini(
          userText,
          { ...request, sessionTier, contextFollowing: request.contextFollowing, topicTransition },
          null,
          isFollowup,
          maxTokens,
          sessionConcepts
        )
      : null;

if (aiText) {
  const safe = escapeHtml(aiText).replace(/\n/g, "<br>");
  const needsPreface = String(request.toneHint || "").toLowerCase() === "negative";
  const preface = needsPreface ? (buildNegativePreface(language, request.dialectHint) + "<br><br>") : "";
  return finalizeResponse(preface + safe, {
    actionCard: safeActionCard(request.suggestedCard || null),
    usedAI: true,
    geminiUsed: true,
    matchType: "direct_ai",
    maxTokens
  });
}


  // فشل Gemini بالكامل → fallback (بدون روابط)
  const fallback = buildAutomatedFallbackReply(language);

  return finalizeResponse(fallback, {
    actionCard: safeActionCard(request.suggestedCard || null),
    matchType: "fallback",
    maxTokens
  });
}
