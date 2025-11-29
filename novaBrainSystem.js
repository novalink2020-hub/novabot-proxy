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
  goodbye:
    "سعيد بهذه الجولة من الحوار معك 🌱<br><br>أتمنّى أن تكون فكرة واحدة على الأقل قد فتحت لك زاوية جديدة للتفكير أو العمل.<br><br>نوفا بوت سيبقى هنا عندما تعود… ومع كل زيارة، يمكن أن نضيف طبقة جديدة لمسارك مع الذكاء الاصطناعي والأعمال."
};

function randomFrom(list = []) {
  if (!Array.isArray(list) || list.length === 0) return "";
  return list[Math.floor(Math.random() * list.length)];
}

const getRandomGenericReply = () => randomFrom(NOVABOT_TEXT_PACKAGE.genericReplies);

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

function tokenize(str = "") {
  return new Set(
    normalizeText(str)
      .split(" ")
      .filter((w) => w.length >= 3)
  );
}

/* =============== تحميل قاعدة المعرفة =============== */

function normalizeItem(item) {
  if (!item) return null;
  return {
    title: (item.title || "").trim(),
    url: (item.url || "").trim(),
    description: (item.description || "").trim(),
    excerpt: (item.excerpt || "").trim(),
    summary: (item.summary || "").trim(),
    category: (item.category || "general").trim(),
    keywords: Array.isArray(item.keywords)
      ? item.keywords.map((k) => normalizeText(k)).filter(Boolean)
      : []
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
    console.warn("⚠️ embedText error:", err.message);
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
      (item.title || "") +
      ". " +
      (item.description || "") +
      " " +
      (item.summary || "") +
      " " +
      (item.excerpt || "");
    const emb = await embedText(baseText);
    embeddings.push(emb);
  }
  knowledgeEmbeddings = embeddings;
}

/* =============== Keyword Routing =============== */

function keywordRoute(question = "", items = []) {
  const q = normalizeText(question);
  if (!q || !items.length) return null;

  const lowerTitle = (t) => normalizeText(t || "");
  const findByTitleIncludes = (needleList) =>
    items.find((it) =>
      needleList.some((n) => lowerTitle(it.title).includes(normalizeText(n)))
    );

  // Murf / ElevenLabs / Daryjat
  if (
    q.includes("التعليق الصوتي") ||
    q.includes("تعليق صوتي") ||
    q.includes("voice over")
  ) {
    const target =
      findByTitleIncludes(["murf", "murf.ai", "daryjat", "elevenlabs"]) || null;
    if (target) return { item: target, score: 0.98 };
  }

  // Copy.ai
  if (
    q.includes("copy.ai") ||
    q.includes("copy ai") ||
    q.includes("copyai") ||
    q.includes("كوبي")
  ) {
    const target = findByTitleIncludes(["copy.ai", "copy ai", "copyai"]);
    if (target) return { item: target, score: 0.97 };
  }

  // من نحن / نوفا لينك – لو فاتت النوايا
  if (
    q.includes("من نحن") ||
    q.includes("من انتم") ||
    q.includes("من أنتم") ||
    q.includes("ما هي نوفا لينك") ||
    q.includes("ما هي novalink")
  ) {
    const target = findByTitleIncludes(["من نحن", "about", "novalink"]);
    if (target) return { item: target, score: 0.95 };
  }

  return null;
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

  const qTokens = tokenize(question);
  if (!qTokens.size) return { score: 0, item: null };

  // Keyword routing أولًا
  const routed = keywordRoute(question, items);
  if (routed) {
    console.log("🎯 Keyword route hit →", routed.item.url);
    return routed;
  }

  await ensureKnowledgeEmbeddings(items);
  const qEmbedding = await embedText(question);
  const isShortQuery = qTokens.size <= 2;

  let bestItem = null;
  let bestScore = 0;

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];

    const combined =
      (item.title || "") +
      " " +
      (item.description || "") +
      " " +
      (item.excerpt || "") +
      " " +
      (item.summary || "");

    const tTokens = tokenize(combined);
    if (!tTokens.size) continue;

    let common = 0;
    qTokens.forEach((t) => {
      if (tTokens.has(t)) common++;
    });

    const lexicalScore =
      common / Math.max(qTokens.size, isShortQuery ? 1 : 3);

    const unionSize = qTokens.size + tTokens.size - common;
    const jaccard = unionSize > 0 ? common / unionSize : 0;

    const titleTokens = tokenize(item.title || "");
    let titleCommon = 0;
    qTokens.forEach((t) => {
      if (titleTokens.has(t)) titleCommon++;
    });
    const titleScore =
      titleCommon / Math.max(Math.min(qTokens.size, titleTokens.size) || 1, 1);

    const keywordTokens = new Set(item.keywords || []);
    let keywordCommon = 0;
    qTokens.forEach((t) => {
      if (keywordTokens.has(t)) keywordCommon++;
    });

    const keywordScore =
      keywordCommon /
      Math.max(qTokens.size, Math.min(keywordTokens.size || 1, 3));

    let semantic = 0;
    if (qEmbedding && knowledgeEmbeddings && knowledgeEmbeddings[idx]) {
      semantic = cosineSimilarity(qEmbedding, knowledgeEmbeddings[idx]);
    }

    const weighted =
      0.25 * lexicalScore +
      0.25 * jaccard +
      0.25 * titleScore +
      0.15 * keywordScore +
      0.10 * semantic;

    if (weighted > bestScore) {
      bestScore = weighted;
      bestItem = item;
    }
  }

  return { score: bestScore, item: bestItem };
}

/* =============== تعرّف اللغة واللهجة =============== */

function detectLanguage(text = "") {
  if (!text) return { language: "ar", dialectHint: "msa" };

  const arabicChars = /[\u0600-\u06FF]/;
  const hasArabic = arabicChars.test(text);
  if (!hasArabic) return { language: "en", dialectHint: "en" };

  const dialectHints = [
    ["msa", ["قال", "يمكنك", "أحب", "أود", "أنا"]],
    ["eg", ["عايز", "عاوزه", "عاوزه", "عاوزة", "إزيك", "كويس", "مش", "ليه"]],
    ["ma", ["بزاف", "وش", "واش", "كاين", "عافاك"]],
    ["sa", ["وش", "تكرم", "يعطيك العافية", "هلا"]],
    ["levant", ["شو", "ليش", "هيك", "كتير", "تمام"]]
  ];

  let best = "msa";
  for (const [dialect, hints] of dialectHints) {
    for (const h of hints) {
      if (text.includes(h)) {
        best = dialect;
        break;
      }
    }
    if (best === dialect) break;
  }

  return { language: "ar", dialectHint: best };
}

/* =============== Intent helpers (بدون كشف نية داخلي) =============== */

function buildStrongMatchReply(item) {
  const safeTitle = escapeHtml(item.title || "");
  const safeDesc = escapeHtml(item.description || item.summary || "");
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

/* =============== استخراج المفاهيم من ردود البوت =============== */

function splitSentences(text = "") {
  return (text || "")
    .replace(/\n+/g, " ")
    .split(/[.!؟?؛؛]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function tokenizeForConcepts(sentence = "") {
  const normalized = normalizeText(sentence);
  const words = normalized.split(" ").filter(Boolean);
  const filtered = [];
  for (const w of words) {
    if (w.length < 2) continue;
    if (ARABIC_STOPWORDS.has(w) || EN_STOPWORDS.has(w)) continue;
    filtered.push(w);
  }
  return filtered;
}

function buildNGrams(tokens = [], min = 2, max = 4) {
  const grams = [];
  for (let n = min; n <= max; n++) {
    for (let i = 0; i <= tokens.length - n; i++) {
      grams.push(tokens.slice(i, i + n).join(" "));
    }
  }
  return grams;
}

function createConceptList(botReplyText = "") {
  const sentences = splitSentences(botReplyText);
  const candidates = [];
  for (const s of sentences) {
    const tokens = tokenizeForConcepts(s);
    if (tokens.length < 2) continue;
    const grams = buildNGrams(tokens, 2, 4);
    candidates.push(...grams);
  }

  const dedup = [];
  for (const c of candidates) {
    if (!c) continue;
    if (!dedup.includes(c)) {
      dedup.push(c);
    }
  }

  return dedup.slice(0, 12);
}

/* =============== استدعاء Gemini =============== */

function buildGeminiPrompt(userText, analysis, bestItem, isFollowup = false, recentConcepts = []) {
  const lang = analysis.language === "en" ? "en" : "ar";
  const intentId = analysis.intentId || "explore";

  let base = "";

  base += `User question / سؤال المستخدم:\n"${userText}"\n\n`;

  base += `Context / سياق:\n`;
  base += `- intentId: ${intentId}\n`;
  base += `- language: ${lang}\n`;
  base += `- dialectHint: ${analysis.dialectHint || "msa"}\n`;
  base += `- toneHint: ${analysis.toneHint || "neutral"}\n`;
  base += `- contextFollowing: ${analysis.contextFollowing === true ? "yes" : "no"}\n`;
  if (analysis.suggestedCard) {
    base += `- suggestedCard: ${analysis.suggestedCard}\n`;
  }
  if (bestItem) {
    base += `- Related article title: ${bestItem.title || ""}\n`;
  }

  const conceptList = (recentConcepts || []).slice(-3).filter(Boolean);
  if (conceptList.length) {
    base += `- Key recent concepts: ${conceptList.join(" | ")}\n`;
    base += `Use these concepts for continuity and cohesion with previous turns.\n`;
  }

  if (isFollowup) {
    base += `The user is asking for a deeper or follow-up explanation on the same topic.\n`;
  }

  base += `\nStyle guidelines:\n`;
  base += `- If the user writes in Arabic, answer in clear Modern Standard Arabic (فصحى سلسة) مع لمسة خفيفة من لهجته عند الاقتضاء.\n`;
  base += `- If the user writes in English, answer in clear, simple, professional English.\n`;
  base += `- You are NovaBot, the assistant of NovaLink (an Arabic platform about AI for business and careers).\n`;
  base += `- Focus on practical, actionable insights related to the user's question.\n`;
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
          : "أنت نوفا بوت، مساعد منصة نوفا لينك المتخصص في الذكاء الاصطناعي وتطوير الأعمال والمهن. أجب بالعربية الفصحى السلسة، بأسلوب عملي مشجّع دون مبالغة، مع لمسات خفيفة من لهجة المستخدم عند الاقتضاء.";

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

/* =============== Fallback automated replies (بدون روابط) =============== */

function buildAutomatedFallbackReply() {
  return NOVABOT_TEXT_PACKAGE.noMatch;
}

/* =============== ردود ثابتة للنوايا (بدون روابط) =============== */

function buildGreetingReply(isReturning = false) {
  return isReturning
    ? NOVABOT_TEXT_PACKAGE.welcomeReturning
    : NOVABOT_TEXT_PACKAGE.welcomeFirst;
}

function buildThanksPositiveReply() {
  return randomFrom(NOVABOT_TEXT_PACKAGE.positiveReplies);
}

function buildNegativeMoodReply() {
  return randomFrom(NOVABOT_TEXT_PACKAGE.negativeReplies);
}

function buildSubscribeInterestReply() {
  return `يسعدني حماسك للمتابعة ✉️<br>
 يمكنك استخدام بطاقة الاشتراك الظاهرة في الواجهة لإضافة بريدك، لتصلك خلاصة أفكار وأدوات نوفا لينك المرتبطة بالذكاء الاصطناعي وتطوير الأعمال.<br>
 كل رسالة ستكون أقرب إلى "خلاصة عملية" منها إلى نشرة تقليدية.`;
}

function buildCollaborationReply() {
  return `نوفا لينك منفتحة على التعاونات المهنية الجادة المرتبطة بالذكاء الاصطناعي للأعمال وتطوير البوتات الذكية.<br><br>
 يمكن أن يكون التعاون على شكل رعاية محتوى، ورش عمل، ندوات مشتركة، أو مشاريع رقمية تخدم روّاد الأعمال.<br><br>
 استخدم بطاقة التعاون في الواجهة لترك تفاصيلك، وسنعود إليك بعد مراجعة الفكرة.`;
}

function buildConsultingPurchaseReply() {
  return `طلب استشارة أو بوت مخصص لعملك خطوة عملية جدًا 💼<br><br>
 يمكننا مساعدتك في بناء بوت دردشة مخصص لعملك، أو رسم مسار عمل ذكي لاستخدام أدوات الذكاء الاصطناعي في مشروعك.<br>
 استخدم بطاقة "بوت دردشة لعملك" لحجز جلسة تعريفية سريعة، وتوضيح نوع النشاط والجمهور وأهدافك من البوت.`;
}

function buildNovaLinkInfoReply() {
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

function buildGoodbyeReply() {
  return NOVABOT_TEXT_PACKAGE.goodbye;
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

function hasDeveloperCode(text = "") {
  return (text || "").includes("10406621");
}

function buildDeveloperCardReplyAr() {
  return `✨ لمحة سريعة عن الشخص الذي طوّر نوفا بوت ودرّبه…<br>
 👨‍💻 “محمد أبو سنينة” — مطوّر عربي جمع خبرته بين القطاع المصرفي والذكاء الاصطناعي.<br>
 ينظر إلى الذكاء الاصطناعي كفرصة لإعادة تعريف أدوارنا في العمل، وليس كخطر يهددها، ويبني نوفا لينك كمساحة عملية تساعد روّاد الأعمال على استخدام الأدوات الذكية بثقة ووضوح.`;
}

function buildDeveloperCardReplyEn() {
  return `👨‍💻 A quick snapshot of the person behind NovaBot and NovaLink:<br><br>
 - An Arabic creator who moved from the banking world into AI for business.<br>
 - Building NovaLink as a practical space to help entrepreneurs use AI tools step by step, not just read about them.<br>
 - Sees AI as a chance to redefine our role at work, not just a threat to it.<br><br>
 This card is for those who care about the human behind the system, not just the answers on the screen ✨`;
}

/* =============== المساعد الأساسي =============== */

export async function novaBrainSystem(request) {
  const userText = (request.message || "").trim();
  const originalIntentId = request.originalIntentId || request.intentId || "explore";
  const effectiveIntentId = request.intentId || originalIntentId;
  const language = request.language || "ar";
  const forceAI = request.forceAI === true;
  const sessionTier = request.sessionTier || "non_ai";
  const sessionConcepts = Array.isArray(request.sessionConcepts) ? request.sessionConcepts : [];

  const sessionHistory = Array.isArray(request.recentMessages)
    ? request.recentMessages
    : Array.isArray(request.sessionHistory)
    ? request.sessionHistory
    : [];

  const isAIQuestion = effectiveIntentId === "ai_business";
  const isAISession = detectAISession(effectiveIntentId, sessionHistory);

  // 0) رد ترحيبي إذا لا يوجد نص
  if (!userText) {
    return {
      reply: getRandomGenericReply(),
      actionCard: null,
      usedAI: false,
      extractedConcepts: [],
      resetConcepts: false,
      maxTokens: 0,
      geminiUsed: false
    };
  }

  // 0.1) بطاقة المطوّر
  if (hasDeveloperCode(userText)) {
    const reply =
      language === "en" ? buildDeveloperCardReplyEn() : buildDeveloperCardReplyAr();

    return {
      reply,
      actionCard: "developer_identity",
      usedAI: false,
      extractedConcepts: createConceptList(reply),
      resetConcepts: false,
      maxTokens: 0,
      geminiUsed: false
    };
  }

  // 0.2) وداع
  if (isGoodbyeMessage(userText)) {
    return {
      reply: buildGoodbyeReply(),
      actionCard: null,
      usedAI: false,
      extractedConcepts: createConceptList(NOVABOT_TEXT_PACKAGE.goodbye),
      resetConcepts: true,
      maxTokens: 0,
      geminiUsed: false
    };
  }

  // 0.3) خارج النطاق دائمًا بدون AI
  if (originalIntentId === "out_of_scope") {
    const reply = getRandomGenericReply();
    return {
      reply,
      actionCard: null,
      usedAI: false,
      extractedConcepts: createConceptList(reply),
      resetConcepts: false,
      maxTokens: 0,
      geminiUsed: false
    };
  }

  const isAIQuestionFlag = effectiveIntentId === "ai_business";
  const isAISessionFlag = detectAISession(effectiveIntentId, sessionHistory);

  const finalizeResponse = (
    reply,
    meta = {
      actionCard: null,
      usedAI: false,
      geminiUsed: false,
      matchType: "none",
      maxTokens: 0
    }
  ) => {
    const extracted = createConceptList(reply);
    return {
      reply,
      actionCard: meta.actionCard || null,
      usedAI: meta.usedAI || false,
      extractedConcepts: extracted,
      resetConcepts: false,
      geminiUsed: meta.geminiUsed || false,
      matchType: meta.matchType || "none",
      maxTokens: meta.maxTokens || 0
    };
  };

  // 1) نوايا ثابتة (طالما لسنا مجبرين على AI)
  if (!forceAI) {
    if (originalIntentId === "greeting") {
      const reply = buildGreetingReply(sessionHistory.length > 0);
      return finalizeResponse(reply);
    }

    if (originalIntentId === "thanks_positive") {
      const reply = buildThanksPositiveReply();
      return finalizeResponse(reply, { actionCard: request.suggestedCard || "subscribe" });
    }

    if (originalIntentId === "negative_mood") {
      const reply = buildNegativeMoodReply();
      return finalizeResponse(reply);
    }

    if (originalIntentId === "subscribe_interest") {
      const reply = buildSubscribeInterestReply();
      return finalizeResponse(reply, { actionCard: request.suggestedCard || "subscribe" });
    }

    if (originalIntentId === "collaboration") {
      const reply = buildCollaborationReply();
      return finalizeResponse(reply, {
        actionCard: request.suggestedCard || "collaboration"
      });
    }

    if (originalIntentId === "consulting_purchase") {
      const reply = buildConsultingPurchaseReply();
      return finalizeResponse(reply, { actionCard: request.suggestedCard || "bot_lead" });
    }

    if (originalIntentId === "novalink_info") {
      const reply = buildNovaLinkInfoReply();
      return finalizeResponse(reply);
    }

    if (originalIntentId === "novabot_info") {
      const reply = buildNovaBotInfoReply();
      return finalizeResponse(reply);
    }

    if (originalIntentId === "out_of_scope" || originalIntentId === "casual") {
      if (!isAISessionFlag && !isAIQuestionFlag) {
        return finalizeResponse(getRandomGenericReply());
      }
      // لو الجلسة AI لكن النية casual سنسمح لـ Gemini لاحقًا
    }
  }

  // 2) تحميل المعرفة + أفضل تطابق (للمجالات ذات الصلة فقط)
  const allowKnowledge = effectiveIntentId === "ai_business";
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
      actionCard: request.suggestedCard || null,
      matchType: "strong_match",
      maxTokens: 0
    });
  }

  // 2-ب) تطابق متوسط → Gemini قصير + رابط (maxTokens = 100)
  if (item && score >= MEDIUM_MATCH_THRESHOLD) {
    const aiText = await callGemini(
      userText,
      request,
      item,
      false,
      100,
      sessionConcepts
    );

    if (aiText) {
      const replyHtml = wrapAiAnswerWithLink(aiText, item);
      return finalizeResponse(replyHtml, {
        actionCard: request.suggestedCard || null,
        usedAI: true,
        geminiUsed: true,
        matchType: "medium_match",
        maxTokens: 100
      });
    }

    const replyHtml = buildMidMatchTemplateReply(item);
    return finalizeResponse(replyHtml, {
      actionCard: request.suggestedCard || null,
      matchType: "medium_match",
      maxTokens: 0
    });
  }

  // 2-ج) لا تطابق قوي/متوسط → نقرر منطق الجلسة + نوع السؤال

  // جلسة غير AI + سؤال غير AI + بدون إجبار → من الردود التحفيزية
  if (!isAISession && !isAIQuestion && !forceAI) {
    return finalizeResponse(getRandomGenericReply());
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
  const baseTokens = isAISession ? (isAIQuestion ? 200 : 100) : 0;
  let maxTokens = baseTokens;
  if (baseTokens > 0) {
    if (sessionTier === "strong_ai") {
      maxTokens = Math.min(200, baseTokens + 60);
    } else if (sessionTier === "semi_ai") {
      maxTokens = Math.min(180, baseTokens + 30);
    }
  }

  const aiText = await callGemini(
    userText,
    request,
    null,
    isFollowup,
    maxTokens,
    sessionConcepts
  );

  if (aiText) {
    const safe = escapeHtml(aiText).replace(/\n/g, "<br>");
    return finalizeResponse(safe, {
      actionCard: request.suggestedCard || null,
      usedAI: true,
      geminiUsed: true,
      matchType: "direct_ai",
      maxTokens
    });
  }

  // فشل Gemini بالكامل → fallback (بدون روابط)
  const fallback = buildAutomatedFallbackReply();

  return finalizeResponse(fallback, {
    actionCard: request.suggestedCard || null,
    matchType: "fallback",
    maxTokens
  });
}
