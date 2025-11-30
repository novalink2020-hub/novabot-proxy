// ===========================================
// novaBrainSystem.js – NovaBrainSystem PRO v3 (Flat Brain Stable)
// دماغ نوفا بوت الهجين: (نوايا + معرفة + Embeddings + Gemini)
// By Mohammed Abu Snaina – NOVALINK.AI
// ===========================================
console.log("🧠 NovaBrainSystem V5.1 loaded at", new Date().toISOString());
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
    "👋 سعيد بؤيتك مجددًا في نوفا لينك.<br>هل ترغب أن أساعدك اليوم في اكتشاف مقال جديد، أداة عملية، أو فكرة تلهمك للخطوة التالية؟",
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
  "يمكن",
  "أصبح",
  "ليس",
  "ليسوا",
  "أحد",
  "أية",
  "أي",
  "أيضًا",
  "أيضاً",
  "أيضا",
  "أنت",
  "أنتِ",
  "انا",
  "أنا",
  "أنتَ",
  "أنتي",
  "أنتيِ",
  "أنتِ",
  "انت",
  "انتي",
  "انتِ",
  "لدي",
  "عندي",
  "لدينا",
  "لديّ",
  "عنديّ",
  "بعض",
  "كل",
  "كلها",
  "كلهم",
  "له",
  "لها",
  "لهم",
  "لهن",
  "لنا",
  "علينا",
  "عنها",
  "عنه",
  "عنهما",
  "عليها",
  "عليه",
  "عليهم",
  "عليهن",
  "عليكما",
  "عليكم",
  "عليكن",
  "ذلك",
  "تلك",
  "هذا",
  "هذه",
  "هؤلاء",
  "اولئك",
  "أولئك",
  "هنا",
  "هناك",
  "أي",
  "اي",
  "أو",
  "او",
  "إما",
  "اما",
  "إذا",
  "اذا",
  "لكن",
  "لكنّ",
  "لكنَّ",
  "لأن",
  "لان",
  "لأنّ",
  "لأنَّ",
  "لانّ",
  "لانَّ",
  "حتى",
  "لو",
  "إن",
  "ان",
  "كلما",
  "كلّما",
  "كأن",
  "كأنّ",
  "كأنَّ",
  "كي",
  "لكي",
  "فلن",
  "لن",
  "لما",
  "لماذا",
  "لم",
  "لا",
  "ما",
  "ماذا",
  "منذ",
  "أثناء",
  "اثناء",
  "اثناء",
  "خلال",
  "بينما",
  "بين",
  "قبل",
  "بعد",
  "حيث",
  "حيثما",
  "متى",
  "أين",
  "اين",
  "أية",
  "أحد",
  "كل",
  "كلما",
  "او",
  "أو",
  "مع",
  "بسبب",
  "منذ",
  "فوق",
  "تحت",
  "أمام",
  "خلف",
  "وراء",
  "داخل",
  "خارج",
  "أحيانًا",
  "أحيانا",
  "أحياناً",
  "ليس",
  "كانت",
  "كان",
  "ستكون",
  "سيكون",
  "هم",
  "هن",
  "هما",
  "انت",
  "نحن",
  "انتم",
  "انتن",
  "أنا",
  "انا",
  "هو",
  "هي",
  "هم",
  "هن",
  "هذه",
  "هذا",
  "ذلك",
  "تلك",
  "إلى",
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

function clampTokens(value = 0, min = 0, max = 200) {
  return Math.max(min, Math.min(max, value));
}

function safeHTML(str = "") {
  return escapeHtml(str || "").replace(/\n/g, "<br>");
}

function buildPivotedAISnippet(aiRawText = "", language = "ar") {
  const plain = stripHtml(aiRawText || "").trim();
  const sentences = plain.split(/[.!؟?]/).map((s) => s.trim()).filter(Boolean);
  const head = sentences.slice(0, 2).join(". ");

  if (language === "en") {
    return (
      (head || "There are several general approaches.") +
      " But since NovaBot’s core mission is AI and business, I can guide you toward tools and ideas that elevate your workflow and productivity."
    );
  }

  return (
    (head || "هناك عدة طرق عامة يمكن التفكير بها.") +
    " وبما أن نوفا بوت وجد لمساعدتك في ربط الذكاء الاصطناعي بعملك ومهنتك، أستطيع أن أوجهك نحو أدوات وخطوات تعزز إنتاجيتك وتطور مشروعك."
  );
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
    knowledgeLoadedAt = now;

    console.log("✅ Knowledge loaded:", cleaned.length, "items");
    return cleaned;
  } catch (err) {
    console.error("⚠️ Failed to load knowledge:", err.message);
    return [];
  }
}

/* =============== Embeddings =============== */

async function ensureEmbeddingModel() {
  if (embedModel) return embedModel;
  if (!genAI) return null;

  try {
    // يفضل gemini-pro-embeddings لو متاح
    embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
    return embedModel;
  } catch (err) {
    console.warn("⚠️ Embedding model init failed:", err.message);
    embedModel = null;
    return null;
  }
}

async function embedText(text = "") {
  if (!text || text.length < 2) return null;

  const model = await ensureEmbeddingModel();
  if (!model) return null;

  try {
    const res = await model.embedContent(text);
    return res.embedding.values || null;
  } catch (err) {
    console.warn("⚠️ Embedding error:", err.message);
    return null;
  }
}

function cosineSimilarity(vecA = [], vecB = []) {
  if (!vecA.length || !vecB.length || vecA.length !== vecB.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/* =============== بناء الردود المؤتمتة =============== */

function buildStrongMatchReply(item) {
  const { title, url, summary } = item;

  return `
  <div class="nova-strong-match">
    <h3>🔍 هذا ما وجدته لك</h3>
    <p>${escapeHtml(summary || "").substring(0, 400)}...</p>
    <p><a class="nova-link" target="_blank" href="${escapeAttr(url)}">اقرأ التفاصيل: ${escapeHtml(
    title
  )}</a></p>
  </div>
  `;
}

function buildMidMatchTemplateReply(item) {
  const { title, url } = item;

  return `
  <div class="nova-mid-match">
    <h3>🧭 فكرة يمكن البناء عليها</h3>
    <p>هذا اقتراح مبدئي مرتبط بموضوع سؤالك، ويمكن تعميقه أكثر.</p>
    <p><a class="nova-link" target="_blank" href="${escapeAttr(url)}">اقرأ المقال: ${escapeHtml(
    title
  )}</a></p>
  </div>
  `;
}

function buildAutomatedFallbackReply() {
  return `
  <div class="nova-fallback">
    <h3>🤝 دعنا نقترب أكثر</h3>
    <p>أخبرني ما هو العنصر الأهم في سؤالك: هل تبحث عن أداة، خطة، أو مثال تطبيقي؟</p>
    <p>كلما زودتني بتفاصيل أكثر، كلما استطعت ربط الذكاء الاصطناعي بعملك بشكل أدق.</p>
  </div>
  `;
}

function buildGreetingReply(hasHistory = false) {
  if (hasHistory) return NOVABOT_TEXT_PACKAGE.welcomeReturning;
  return NOVABOT_TEXT_PACKAGE.welcomeFirst;
}

function buildThanksPositiveReply() {
  return randomFrom(NOVABOT_TEXT_PACKAGE.positiveReplies);
}

function buildNegativeMoodReply() {
  return randomFrom(NOVABOT_TEXT_PACKAGE.negativeReplies);
}

function buildSubscribeInterestReply() {
  return `
  <div class="nova-subscribe">
    <p>📩 تريد أن نتابع معك خطوة بخطوة؟ اشترك في قائمة نوفا لينك البريدية لتحصل على ملخصات وأدوات عملية مرتبطة بسؤالك.</p>
    <a class="nova-link" target="_blank" href="https://novalink-ai.com/ashtrk-alan">اشترك الآن</a>
  </div>
  `;
}

function buildCollaborationReply() {
  return `
  <div class="nova-collab">
    <p>🤝 هل تفكر في تعاون أو شراكة؟<br>يسعدنا الاستماع لفكرتك والعمل معًا على مشروع أو ورشة عمل أو إنتاج محتوى.</p>
    <a class="nova-link" target="_blank" href="https://novalink-ai.com/contact">تواصل معنا</a>
  </div>
  `;
}

function buildConsultingPurchaseReply() {
  return `
  <div class="nova-consult">
    <p>🎯 استشارة مركّزة مع نوفا لينك يمكن أن تختصر عليك وقتًا طويلًا في بناء منتجك أو مشروعك المعتمد على الذكاء الاصطناعي.</p>
    <a class="nova-link" target="_blank" href="https://novalink-ai.com/book-consultation">احجز استشارة</a>
  </div>
  `;
}

function buildNovaLinkInfoReply() {
  return NOVABOT_TEXT_PACKAGE.aboutNovaLink;
}

function buildNovaBotInfoReply() {
  return `
  <div class="nova-bot-info">
    <h3>🤖 من هو نوفا بوت؟</h3>
    <p>نوفا بوت هو مساعد ذكي بُني بخبرة عملية في الذكاء الاصطناعي لتطوير الأعمال بالعربية والإنجليزية.</p>
    <p>يركز على ربط الأفكار بالأدوات والخطوات العملية لتسريع مشروعك.</p>
  </div>
  `;
}

function buildDeveloperCardReplyAr() {
  return `
  <div class="nova-dev-card">
    <h3>🛠️ بطاقة المطوّر</h3>
    <p>الاسم: محمد أبو سنينة</p>
    <p>الدور: مطوّر ومؤسس نوفا لينك</p>
    <p>الرسالة: بناء أدوات ذكاء اصطناعي عربية عملية، تربطك بالنتائج لا بالضجة.</p>
  </div>
  `;
}

function buildDeveloperCardReplyEn() {
  return `
  <div class="nova-dev-card">
    <h3>🛠️ Developer Card</h3>
    <p>Name: Mohammed Abu Snaina</p>
    <p>Role: Founder of Novalink AI & NovaBot</p>
    <p>Mission: Build practical Arabic AI tools that drive results, not hype.</p>
  </div>
  `;
}

function buildGoodbyeReply() {
  return NOVABOT_TEXT_PACKAGE.goodbye;
}

function wrapAiAnswerWithLink(aiText = "", item) {
  const { title, url } = item || { title: "", url: "" };

  return `
  <div class="nova-ai-reply">
    <p>${safeHTML(aiText)}</p>
    <p><a class="nova-link" target="_blank" href="${escapeAttr(url)}">🔗 مصدر موثوق: ${escapeHtml(
    title
  )}</a></p>
  </div>
  `;
}

/* =============== كشف النوايا السياقية =============== */

function hasDeveloperCode(text = "") {
  const lower = text.toLowerCase();
  return lower.includes("novadev2024") || lower.includes("novabot-dev");
}

function isGoodbyeMessage(text = "") {
  const lower = text.toLowerCase();
  return lower.includes("bye") || lower.includes("مع السلامة") || lower.includes("وداعا");
}

/* =============== بحث في الذاكرة المفاهيمية =============== */

function findConceptMatches(userText = "", concepts = []) {
  if (!concepts || !concepts.length) return { matches: [], pronounFollow: false };

  const lower = normalizeText(userText);
  const tokens = tokenize(userText);

  const pronounFollow = ["هذا", "هذه", "هي", "هو", "this", "it"].some((p) => lower.includes(p));

  const matches = [];
  for (const concept of concepts) {
    if (!concept) continue;
    if (tokens.has(concept.toLowerCase())) {
      matches.push(concept);
    }
  }

  return { matches, pronounFollow };
}

/* =============== المعرفة + Gemini =============== */

function formatPrompt(userText, item = null, { language, dialectHint, topicTransition }) {
  if (language === "en") {
    const sys = `
You are NovaBot, an AI + business consultant. Language: English.
- Answer briefly, practical, and with a growth mindset.
- Avoid fluff. Provide actionable steps.
- If user asks AI/business topics, use consultative tone.
- Do NOT generate links unless provided.
- Keep it concise unless asked otherwise.
- dialectHint: ${dialectHint}. topicTransition: ${topicTransition}.`;

    const userPrompt = item
      ? `Context link: ${item.url}\nTitle: ${item.title}\nSummary: ${item.summary}\nUser: ${userText}`
      : `User: ${userText}`;
    return { system: sys, user: userPrompt };
  }

  const sys = `
أنت نوفا بوت، مساعد مختص في الذكاء الاصطناعي وتطوير الأعمال. اللغة: عربية واضحة وبسيطة.
- إجابات قصيرة، عملية، ونبرة استشارية.
- تجنب الحشو. قدم خطوات قابلة للتطبيق.
- لا تنشئ روابط جديدة. استخدم ما توفر لديك فقط.
- وضح الخطوات بترقيم عند الحاجة.
- dialectHint: ${dialectHint}. topicTransition: ${topicTransition}.`;

  const userPrompt = item
    ? `الرابط السياقي: ${item.url}\nالعنوان: ${item.title}\nالملخص: ${item.summary}\nالمستخدم: ${userText}`
    : `المستخدم: ${userText}`;
  return { system: sys, user: userPrompt };
}

async function callGemini(
  userText,
  { language = "ar", dialectHint = "msa", topicTransition = "same_topic" } = {},
  knowledgeItem = null,
  isFollowup = false,
  maxTokens = 200,
  sessionConcepts = []
) {
  if (!genAI) {
    console.log("⚠️ Gemini client not initialized (no API key).");
    return null;
  }

  const { system, user } = formatPrompt(userText, knowledgeItem, { language, dialectHint, topicTransition });

  // إضافة تصور للمفاهيم السابقة عند وجودها
  let conceptsHint = "";
  if (Array.isArray(sessionConcepts) && sessionConcepts.length) {
    conceptsHint = `\n\nPrevious concepts: ${sessionConcepts.slice(-5).join(", ")}`;
  }

  const prompt = [
    system,
    "----",
    user,
    conceptsHint,
    isFollowup ? "\n\nUser indicates a follow-up; go deeper concisely." : ""
  ]
    .filter(Boolean)
    .join("\n");

  for (const modelName of MODELS_TO_TRY) {
    try {
const model = genAI.getGenerativeModel({
  model: modelName,
  safetySettings: [
    {
      category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
      threshold: "HARM_BLOCK_NONE"
    },
    {
      category: "HARM_CATEGORY_HATE_SPEECH",
      threshold: "HARM_BLOCK_NONE"
    },
    {
      category: "HARM_CATEGORY_DANGEROUS_CONTENT",
      threshold: "HARM_BLOCK_NONE"
    },
    {
      category: "HARM_CATEGORY_HARASSMENT",
      threshold: "HARM_BLOCK_NONE"
    }
  ]
});


const result = await model.generateContent(prompt);
let text = await result.response.text();
      if (!text) continue;

      const lang = language || "ar";

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

function detectAISession(intentId, history = []) {
  if (intentId === "ai_business") return true;

  // البحث في آخر 3 رسائل فقط
  const last = Array.isArray(history) ? history.slice(-3) : [];

  return last.some(
    (m) =>
      m &&
      (m.intentId === "ai_business" ||
        m.effectiveIntentId === "ai_business" ||
        m.hasAI === true)
  );
}

async function findBestMatch(userText = "", knowledgeBase = []) {
  if (!userText || !knowledgeBase.length) {
    return { score: 0, item: null };
  }

  const query = normalizeText(stripHtml(userText));
  const tokens = tokenize(query);

  let bestScore = 0;
  let bestItem = null;

  for (const item of knowledgeBase) {
    if (!item) continue;

    const fields = [
      item.title || "",
      item.description || "",
      item.summary || "",
      item.excerpt || ""
    ].join(" ");

    const fieldTokens = tokenize(fields);

    let overlap = 0;
    for (const t of tokens) {
      if (fieldTokens.has(t)) overlap += 1;
    }

    const maxPossible = tokens.size || 1;
    const score = overlap / maxPossible;

    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  return { score: bestScore, item: bestItem };
}


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
  const isFollowUp = request.isFollowUp === true;
  const hasAIMomentum = request.hasAIMomentum === true;

  const sessionHistory = Array.isArray(request.recentMessages)
    ? request.recentMessages
    : Array.isArray(request.sessionHistory)
    ? request.sessionHistory
    : [];

  const isFirstMessage = !request.recentMessages || request.recentMessages.length === 0;

  const isAIQuestion = effectiveIntentId === "ai_business";
  const isAISession = detectAISession(effectiveIntentId, sessionHistory);
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
      actionCard,
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
    return finalizeResponse(getRandomGenericReply(), { matchType: "empty" });
  }

  // 0.1) بطاقة المطوّر
  if (hasDeveloperCode(userText)) {
    const reply =
      language === "en" ? buildDeveloperCardReplyEn() : buildDeveloperCardReplyAr();

    return finalizeResponse(reply, { actionCard: "developer_identity", matchType: "fixed" });
  }

  // 0.2) وداع
  if (isGoodbyeMessage(userText)) {
    return finalizeResponse(buildGoodbyeReply(), { resetConcepts: true, matchType: "goodbye" });
  }

  // 0.3) خارج النطاق دائمًا بدون AI
  if (originalIntentId === "out_of_scope") {
    if (allowGemini && (isFirstMessage || hasAIMomentum || isFollowUp)) {
      const microTokens = 80;
      const aiText = await callGemini(
        userText,
        { ...request, sessionTier, contextFollowing: request.contextFollowing, topicTransition },
        null,
        true,
        microTokens,
        sessionConcepts
      );

      if (aiText) {
        const steered = buildPivotedAISnippet(aiText, language);
        return finalizeResponse(safeHTML(steered), {
          usedAI: true,
          geminiUsed: true,
          matchType: "micro_ai_pivot",
          maxTokens: microTokens
        });
      }
    }

    return finalizeResponse(getRandomGenericReply(), { matchType: "out_of_scope" });
  }

  // 1) نوايا ثابتة (طالما لسنا مجبرين على AI)
  if (isFirstMessage && effectiveIntentId !== "ai_business" && allowGemini) {
    const microTokens = 80;
    const aiText = await callGemini(
      userText,
      { ...request, sessionTier, contextFollowing: request.contextFollowing, topicTransition },
      null,
      true,
      microTokens,
      sessionConcepts
    );

    if (aiText) {
      const steered = buildPivotedAISnippet(aiText, language);
      return finalizeResponse(safeHTML(steered), {
        usedAI: true,
        geminiUsed: true,
        matchType: "first_message_pivot",
        maxTokens: microTokens
      });
    }
  }

  if (!forceAI) {
    if (originalIntentId === "greeting") {
      return finalizeResponse(buildGreetingReply(sessionHistory.length > 0), { matchType: "fixed" });
    }

    if (originalIntentId === "thanks_positive") {
      return finalizeResponse(buildThanksPositiveReply(), {
        actionCard: request.suggestedCard || "subscribe",
        matchType: "fixed"
      });
    }

    if (originalIntentId === "negative_mood") {
      return finalizeResponse(buildNegativeMoodReply(), { matchType: "fixed" });
    }

    if (originalIntentId === "subscribe_interest") {
      return finalizeResponse(buildSubscribeInterestReply(), {
        actionCard: request.suggestedCard || "subscribe",
        matchType: "fixed"
      });
    }

    if (originalIntentId === "collaboration") {
      return finalizeResponse(buildCollaborationReply(), {
        actionCard: request.suggestedCard || "collaboration",
        matchType: "fixed"
      });
    }

    if (originalIntentId === "consulting_purchase") {
      return finalizeResponse(buildConsultingPurchaseReply(), {
        actionCard: request.suggestedCard || "bot_lead",
        matchType: "fixed"
      });
    }

    if (originalIntentId === "novalink_info") {
      return finalizeResponse(buildNovaLinkInfoReply(), { matchType: "fixed" });
    }

    if (originalIntentId === "novabot_info") {
      return finalizeResponse(buildNovaBotInfoReply(), { matchType: "fixed" });
    }

    if (originalIntentId === "out_of_scope" || originalIntentId === "casual") {
      if (!isAISession && !isAIQuestion) {
        return finalizeResponse(getRandomGenericReply(), { matchType: "out_of_scope" });
      }
      // لو الجلسة AI لكن النية casual سنسمح لـ Gemini لاحقًا
    }
  }

  // 2) تحميل المعرفة + أفضل تطابق (للمجالات ذات الصلة فقط)
  const allowKnowledge = effectiveIntentId === "ai_business" && allowGemini;
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
    const aiText =
      allowGemini && effectiveIntentId === "ai_business"
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
    if ((hasAIMomentum || isFollowUp) && allowGemini) {
      const microTokens = 80;
      const aiText = await callGemini(
        userText,
        { ...request, sessionTier, contextFollowing: request.contextFollowing, topicTransition },
        null,
        true,
        microTokens,
        sessionConcepts
      );

      if (aiText) {
        const steered = buildPivotedAISnippet(aiText, language);
        return finalizeResponse(safeHTML(steered), {
          usedAI: true,
          geminiUsed: true,
          matchType: "micro_ai_pivot",
          maxTokens: microTokens
        });
      }
    }

    return finalizeResponse(getRandomGenericReply(), { matchType: "out_of_scope" });
  }

  // كشف طلبات "أكمل / تابع / تعمق"
  const lower = userText.toLowerCase();
  const followupAr = [
    "وضح اكثر",
    "فسر اكثر",
    "اشرح اكثر",
    "كمل",
    "تابع",
    "زيدني",
    "احكي اكثر",
    "حكي اكثر",
    "طيب بعدين",
    "طيب شو بعدين",
    "طيب وبعدين",
    "خلينا نكمل",
    "نكمل"
  ];
  const followupEn = [
    "continue",
    "go on",
    "tell me more",
    "give me more",
    "more details",
    "more detail",
    "explain more",
    "explain further",
    "go deeper"
  ];

  const isFollowup =
    isFollowUp ||
    followupAr.some((kw) => lower.includes(kw)) ||
    followupEn.some((kw) => lower.includes(kw));

  // جدول maxTokens وفق السياسة + تكييف القوة
  let baseTokens = isAISession ? (isAIQuestion ? 200 : 100) : 0;
  if (!allowGemini) {
    baseTokens = 0;
  }
  let maxTokens = baseTokens;

  if (isFollowup && hasAIMomentum) {
    maxTokens = clampTokens(Math.max(maxTokens, 80), 60, 120);
  } else if (!isAISession && hasAIMomentum) {
    maxTokens = Math.max(maxTokens, 60);
  }

  if (baseTokens > 0) {
    if (sessionTier === "strong_ai") {
      maxTokens = Math.min(200, baseTokens + 60);
    } else if (sessionTier === "semi_ai") {
      maxTokens = Math.min(180, baseTokens + 30);
    }
    if (topicTransition === "soft_switch") {
      maxTokens = Math.max(80, Math.round(maxTokens * 0.8));
    }
    if (topicTransition === "hard_switch" && !request.contextFollowing) {
      maxTokens = Math.round(maxTokens * 0.6);
    }

    const wordCount = normalizeText(userText).split(" ").filter(Boolean).length;
    if (wordCount > 0 && wordCount <= 8) {
      maxTokens = Math.max(60, maxTokens - 40);
    }
  }

  if (isFollowup && hasAIMomentum) {
    maxTokens = clampTokens(maxTokens, 60, 120);
  } else if (!isAISession && hasAIMomentum) {
    maxTokens = Math.max(maxTokens, 60);
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
