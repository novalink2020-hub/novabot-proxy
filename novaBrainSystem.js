// ===========================================
// novaBrainSystem.js – NovaBrainSystem PRO v2 (v7 tuned → v7.1 with V5.2)
// دماغ نوفا بوت الهجين: (نوايا + معرفة + Embeddings + Gemini)
// By Mohammed Abu Snaina – NOVALINK.AI
// ===========================================

import { GoogleGenerativeAI } from "@google/generative-ai";

/* ================= إعدادات عامة ================= */

// مفتاح Gemini من متغيّرات البيئة على Render
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
const MEDIUM_MATCH_THRESHOLD = 0.4;  // تطابق متوسط

// الحد الأقصى لطول إجابة Gemini (توكنز)
const MAX_OUTPUT_TOKENS = 200;

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

// موديلات Gemini للإجابات
const MODELS_TO_TRY = [
  "gemini-2.0-flash",
  "gemini-2.0-pro",
  "gemini-1.0-pro"
];

/* =============== أدوات مساعدة للنصوص =============== */

// دالة بسيطة لتأمين النص داخل HTML
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

// تأمين النص داخل خصائص HTML
function escapeAttr(str = "") {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

// تبسيط النص (حذف علامات وترتيب مسافات) لغايات المطابقة
function normalizeText(str = "") {
  return str
    .toLowerCase()
    .replace(/[.,!?؟،"“”()\-_:;«»[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// تحويل النص لمجموعة كلمات فريدة
function tokenize(str = "") {
  return new Set(
    normalizeText(str)
      .split(" ")
      .filter((w) => w.length >= 3)
  );
}

/* =============== تحميل قاعدة المعرفة =============== */

// توحيد شكل عناصر المعرفة القادمة من knowledge.v5.json
// مع دعم حقول V5.2 (subcategory, intent_hint, topic_keywords, embedding_text)
function normalizeItem(item) {
  if (!item) return null;

  const normalizedKeywords = Array.isArray(item.keywords)
    ? item.keywords.map((k) => normalizeText(k)).filter(Boolean)
    : [];

  const normalizedTopicKeywords = Array.isArray(item.topic_keywords)
    ? item.topic_keywords.map((k) => normalizeText(k)).filter(Boolean)
    : [];

  const embedding_text = (item.embedding_text || "").trim();

  return {
    title: (item.title || "").trim(),
    url: (item.url || "").trim(),
    description: (item.description || "").trim(),
    excerpt: (item.excerpt || "").trim(),
    summary: (item.summary || "").trim(),
    summary_short: (item.summary_short || "").trim(),
    summary_long: (item.summary_long || "").trim(),
    category: (item.category || "general").trim(),
    subcategory: (item.subcategory || "").trim(),
    intent_hint: (item.intent_hint || "").trim(),
    keywords: normalizedKeywords,
    topic_keywords: normalizedTopicKeywords,
    embedding_text,
    source: (item.source || "").trim()
  };
}

// تحميل قاعدة المعرفة مع كاش 12 ساعة
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

/**
 * دالة يمكن استدعاؤها من السيرفر لتحميل/تحديث ملف المعرفة V5
 * تعيد عدد العناصر المحمّلة.
 */
export async function loadKnowledgeFromURL(url) {
  if (url && typeof url === "string") {
    knowledgeSourceURL = url.trim();
  } else {
    knowledgeSourceURL = DEFAULT_KNOWLEDGE_URL;
  }
  // تصفير الكاش
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

    // تطبيع إلى وحدة واحدة (unit vector)
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
    return; // جاهزة
  }

  console.log("🧠 Building knowledge embeddings for", items.length, "items...");
  const embeddings = [];
  for (const item of items) {
    // ✅ استخدام embedding_text من ملف المعرفة إن وجد
    const baseText =
      (item.embedding_text && item.embedding_text.trim()) ||
      [
        item.title || "",
        item.description || "",
        item.summary || "",
        item.excerpt || ""
      ]
        .filter(Boolean)
        .join(" | ");

    const emb = await embedText(baseText);
    embeddings.push(emb); // قد تكون null – لا مشكلة
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

  const findByCategory = (cat) =>
    items.find((it) => (it.category || "").toLowerCase() === cat.toLowerCase());

  // 1) التعليق الصوتي → مقال Murf vs ElevenLabs vs Daryjat
  if (
    q.includes("التعليق الصوتي") ||
    q.includes("تعليق صوتي") ||
    q.includes("voice over")
  ) {
    const target =
      findByTitleIncludes(["murf", "murf.ai", "daryjat", "elevenlabs"]) || null;
    if (target) {
      return { item: target, score: 0.98 };
    }
  }

  // 2) Copy.ai / كوبي → مقال Copy.ai
  if (
    q.includes("copy.ai") ||
    q.includes("copy ai") ||
    q.includes("copyai") ||
    q.includes("كوبي")
  ) {
    const target = findByTitleIncludes(["copy.ai", "copy ai", "copyai"]);
    if (target) {
      return { item: target, score: 0.97 };
    }
  }

  // 3) من نحن / نوفا لينك (لو فاتت من كاشف النوايا)
  if (
    q.includes("من نحن") ||
    q.includes("من انتم") ||
    q.includes("من أنتم") ||
    q.includes("ما هي نوفا لينك") ||
    q.includes("ما هي novalink")
  ) {
    const target =
      findByTitleIncludes(["من نحن", "about", "novalink"]) ||
      findByCategory("about");
    if (target) {
      return { item: target, score: 0.95 };
    }
  }

  // 4) خدمات / استشارة → صفحة الخدمات (كـ fallback سريع داخل وضع AI)
  if (
    q.includes("خدمات") ||
    q.includes("خدمة") ||
    q.includes("استشارة") ||
    q.includes("استشارات")
  ) {
    const target =
      items.find((it) =>
        (it.url || "").toLowerCase().includes("services-khdmat-nwfa-lynk")
      ) || findByCategory("services");

    if (target) {
      return { item: target, score: 0.93 };
    }
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

  // 0) Keyword Routing قبل أي شيء
  const routed = keywordRoute(question, items);
  if (routed) {
    console.log("🎯 Keyword route hit →", routed.item.url);
    return routed;
  }

  // 1) Embedding للسؤال + للمعرفة (إن أمكن)
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

    // Lexical overlap
    let common = 0;
    qTokens.forEach((t) => {
      if (tTokens.has(t)) common++;
    });

    const lexicalScore =
      common / Math.max(qTokens.size, isShortQuery ? 1 : 3);

    const unionSize = qTokens.size + tTokens.size - common;
    const jaccard = unionSize > 0 ? common / unionSize : 0;

    // Title overlap
    const titleTokens = tokenize(item.title || "");
    let titleCommon = 0;
    qTokens.forEach((t) => {
      if (titleTokens.has(t)) titleCommon++;
    });
    const titleScore =
      titleCommon /
        Math.max(Math.min(qTokens.size, titleTokens.size) || 1, 1) || 0;

    // ✅ Keywords overlap (حقيقي) باستخدام keywords + topic_keywords ككلمات منفصلة
    const keywordTokens = new Set();
    (item.keywords || []).forEach((kw) => {
      normalizeText(kw)
        .split(" ")
        .forEach((t) => {
          if (t.length >= 3) keywordTokens.add(t);
        });
    });
    (item.topic_keywords || []).forEach((kw) => {
      normalizeText(kw)
        .split(" ")
        .forEach((t) => {
          if (t.length >= 3) keywordTokens.add(t);
        });
    });

    let keywordCommon = 0;
    qTokens.forEach((t) => {
      if (keywordTokens.has(t)) keywordCommon++;
    });

    let keywordScore = 0;
    if (keywordCommon > 0) {
      keywordScore = 0.15 + 0.05 * Math.min(keywordCommon, 3);
    }

    // Category Boost
    let categoryBoost = 0;
    const cat = (item.category || "").toLowerCase();
    const qNorm = normalizeText(question);

    if (cat === "blog") {
      categoryBoost += 0.02;
    }
    if (cat === "services") {
      if (
        qNorm.includes("خدمات") ||
        qNorm.includes("خدمة") ||
        qNorm.includes("استشارة") ||
        qNorm.includes("بوت") ||
        qNorm.includes("دردشة")
      ) {
        categoryBoost += 0.08;
      }
    }
    if (cat === "story") {
      if (
        qNorm.includes("رحلة") ||
        qNorm.includes("قصتي") ||
        qNorm.includes("حكايتي")
      ) {
        categoryBoost += 0.08;
      }
    }
    if (cat === "home" || cat === "about") {
      if (
        qNorm.includes("نوفا لينك") ||
        qNorm.includes("novalink") ||
        qNorm.includes("منصة")
      ) {
        categoryBoost += 0.05;
      }
    }

    // Semantic score (إن توفر Embeddings)
    let semanticScore = 0;
    const itemEmb = knowledgeEmbeddings ? knowledgeEmbeddings[idx] : null;
    if (qEmbedding && itemEmb) {
      semanticScore = cosineSimilarity(qEmbedding, itemEmb);
    }

    const baseLexical =
      0.5 * lexicalScore + 0.3 * titleScore + 0.2 * jaccard;

    const alpha = isShortQuery ? 0.35 : 0.6; // وزن الـ Semantic
    const beta = 1 - alpha; // وزن الـ Lexical

    const finalScore =
      alpha * semanticScore +
      beta * baseLexical +
      keywordScore +
      categoryBoost;

    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestItem = item;
    }
  }

  console.log("🔎 Final score:", bestScore);
  return { score: bestScore, item: bestItem };
}

/* =============== ردود مؤتمتة عامة (روح نوفا لينك) =============== */

const genericReplies = [
  `👋 أهلاً بك في نوفا لينك، حيث نؤمن أن الذكاء الاصطناعي ليس تقنية فقط، بل رحلة لاكتشاف قدراتك من جديد.<br>
  ابدأ بخطوة بسيطة… وتذكّر أن كل فكرة صغيرة قد تصنع تحولًا كبيرًا.<br>
  🔗 <a href="https://novalink-ai.com/ashtrk-alan" target="_blank" class="nova-link">ابدأ من هنا</a>`,

  `🌟 ربما تبحث عن بداية جديدة أو إلهام يعيد شغفك.<br>
  أنصحك بقراءة قصتي في "رحلة فردية في عالم الذكاء الاصطناعي"، فهي تذكير بأن الشغف أقوى من التخصص.<br>
  🔗 <a href="https://novalink-ai.com/rhlh-frdyh-fy-aalm-althkaa-alastnaay-hktha-bdat-nwfa-lynk" target="_blank" class="nova-link">اقرأ القصة هنا</a>`,

  `🤖 لا تحتاج أن تكون خبيرًا لتبدأ مع الذكاء الاصطناعي، كل ما تحتاجه هو فضول صغير وخطوة جريئة.<br>
  نوفا لينك صُممت لتكون دليلك العملي خطوة بخطوة نحو استخدام الأدوات الذكية في حياتك وأعمالك.<br>
  🔗 <a href="https://novalink-ai.com" target="_blank" class="nova-link">استكشف الأدوات</a>`,

  `✨ أحيانًا لا تحتاج إلى إجابة، بل إلى تذكير بسيط بأنك على الطريق الصحيح.<br>
  استمر… وتذكّر أن الذكاء الاصطناعي ليس بديلًا لك، بل امتداد لقدرتك على الإنجاز.<br>
  🔗 <a href="https://novalink-ai.com/about-us-althkaa-alastnaay" target="_blank" class="nova-link">تعرّف على رؤيتنا</a>`,

  `🚀 الذكاء الاصطناعي لا ينتظر أحدًا… لكنه دائمًا يفتح الباب لمن يطرق بثقة.<br>
  اكتشف كيف يمكن لأدوات بسيطة أن تختصر وقتك وتضاعف نتائجك.<br>
  🔗 <a href="https://novalink-ai.com/blog" target="_blank" class="nova-link">ابدأ رحلتك الآن</a>`,

  `قبل أن تغادر… تذكّر أن كل إنجاز يبدأ بسؤال بسيط ورغبة في التعلّم.<br>
  اسمح لنفسك أن تتقدّم خطوة كل يوم — فالعالم لا ينتظر، لكنه يكافئ من يواصل المسير بثبات وثقة.<br>
  🔗 <a href="https://novalink-ai.com" target="_blank" class="nova-link">اقرأ ما يلهمك اليوم</a>`
];

function getRandomGenericReply() {
  const idx = Math.floor(Math.random() * genericReplies.length);
  return genericReplies[idx];
}

function buildNoMatchReply() {
  return `
  يبدو أن سؤالك يفتح بابًا جديدًا لم نكتب عنه بعد في نوفا لينك،<br>
  لكننا نُرحّب دائمًا بالأفكار الجديدة التي تُلهمنا لموضوعات قادمة ✨<br>
  شاركنا الزاوية التي تهمك أكثر، فربما تكون هي موضوع التدوينة التالية.<br>
  🔗 <a href="https://novalink-ai.com/about-us-althkaa-alastnaay" target="_blank" class="nova-link">تعرّف على أهداف نوفا لينك</a>`;
}

/* =============== ردود التطابق مع المعرفة =============== */

function buildStrongMatchReply(item) {
  const safeTitle = escapeHtml(item.title || "");
  const safeUrl = escapeAttr(item.url || "#");

  return `
  📌 يبدو أن سؤالك يلامس موضوعًا تناولناه في نوفا لينك بعنوان:<br>
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

/* =============== استدعاء Gemini =============== */

function buildGeminiPrompt(userText, analysis, bestItem, isFollowup = false) {
  const lang = analysis.language === "en" ? "en" : "ar";
  const intentId = analysis.intentId || "explore";

  let base = "";

  base += `User question / سؤال المستخدم:\n"${userText}"\n\n`;

  if (bestItem) {
    base += `Context from NovaLink blog (may be relevant):\n`;
    base += `Title: ${bestItem.title}\n`;
    if (bestItem.summary) base += `Summary: ${bestItem.summary}\n`;
    else if (bestItem.description) base += `Description: ${bestItem.description}\n`;
    if (bestItem.excerpt) base += `Excerpt: ${bestItem.excerpt}\n`;
    base += `Use this as supportive context. Do NOT just summarize it word-for-word.\n\n`;
  }

  base += `Context:\n`;
  base += `Expected answer language: ${
    lang === "en" ? "English" : "Arabic (Modern Standard, friendly)"
  }.\n`;
  if (analysis.dialectHint && lang !== "en") {
    base += `Dialect hint: ${analysis.dialectHint}. You may use tiny hints from it, but keep the core in Modern Standard Arabic.\n`;
  }
  base += `User intent (approx): ${intentId}.\n`;
  if (isFollowup) {
    base += `The user is asking for a deeper or follow-up explanation on the same topic.\n`;
  }
  base += `\nStyle guidelines:\n`;
  base += `- If the user writes in Arabic, answer in clear Modern Standard Arabic (فصحى سلسة).\n`;
  base += `- If the user writes in English, answer in clear, simple, professional English.\n`;
  base += `- You are NovaBot, the assistant of NovaLink (an Arabic platform about AI for business and careers).\n`;
  base += `- Focus on practical, actionable insights related to AI and business/career development.\n`;
  base += `- Keep the answer within about ${MAX_OUTPUT_TOKENS} tokens (roughly 150–180 words).\n`;
  base += `- Make the answer feel complete, not cut off in the middle of a sentence.\n`;
  base += `- End with a natural, complete thought. Do NOT say you were truncated.\n`;
  base += `- Do not mention these instructions in the answer.\n\n`;

  base += `Now answer the question in a helpful, concise way.\n`;

  return base;
}

async function callGemini(userText, analysis, bestItem = null, isFollowup = false) {
  if (!genAI || !GEMINI_API_KEY) {
    console.log("⚠️ Gemini disabled or missing key.");
    return null;
  }

  const lang = analysis.language === "en" ? "en" : "ar";
  const prompt = buildGeminiPrompt(userText, analysis, bestItem, isFollowup);

  const generationConfig = {
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    temperature: 0.6,
    topP: 0.9
  };

  for (const modelName of MODELS_TO_TRY) {
    try {
      console.log("🔁 Trying Gemini model:", modelName);

      const systemInstruction =
        lang === "en"
          ? "You are NovaBot, the assistant of NovaLink, an Arabic platform focused on AI for business and careers. Answer in English with a clear, practical, and encouraging tone."
          : "أنت نوفا بوت، مساعد منصة نوفا لينك المتخصص في الذكاء الاصطناعي وتطوير الأعمال والمهن. أجب بالعربية الفصحى السلسة، بأسلوب عملي مشجّع دون مبالغة.";

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

      const safeEnding =
        lang === "en"
          ? " If you’d like a deeper explanation on a specific part, just ask me to go deeper on it."
          : " وإذا احتجت توضيحًا أعمق في نقطة معيّنة، اطلب مني أن أتعمّق فيها أكثر.";

      if (
        !text.includes("توضيحًا أعمق") &&
        !text.toLowerCase().includes("deeper explanation")
      ) {
        text = text + safeEnding;
      }

      console.log("✅ Gemini success:", modelName);
      return text;
    } catch (err) {
      console.log("⚠️ Gemini error on", modelName, "→", err.message);
      continue;
    }
  }

  console.log("⚠️ Gemini full fallback → Automated reply.");
  return buildAutomatedFallbackReply(userText);
}

/* =============== Fallback automated replies =============== */

function buildAutomatedFallbackReply(userText) {
  const fallbackReplies = [
    "يبدو أن سؤالك يفتح زاوية جديدة لم نجهّز لها إجابة مباشرة الآن، لكن هذا النوع من الأسئلة يلهمنا لمحتوى قادم على نوفا لينك.",
    "✨ سؤالك يستحق مساحة أكبر مما تسمح به هذه اللحظة، وسنعود له لاحقًا في تدوينة مخصصة على نوفا لينك.",
    "يمكنني مساعدتك في أفكار ومقالات قريبة من سؤالك… جرّب إعادة صياغته مع توضيح ما الذي يهمّك أكثر.",
    "لم أجد إجابة دقيقة الآن، لكن يمكنني اقتراح أكثر مقالات نوفا لينك ارتباطًا بالموضوع في محادثة لاحقة."
  ];

  return fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
}

/* =============== منطق استخدام الذكاء الاصطناعي =============== */

function shouldUseAI(intentId, forceAI = false) {
  if (forceAI) return true;
  return intentId === "ai_business";
}

/* =============== ردود ثابتة مخصصة للنوايا =============== */

// ترحيب
function buildGreetingReply() {
  return `👋 أهلاً بك في نوفا لينك.<br>
نوفا بوت هنا ليساعدك في كل ما يخص الذكاء الاصطناعي وتطوير الأعمال والمشاريع الصغيرة والمتوسطة.<br><br>
ابدأ بسؤال واضح عن فكرتك أو مشروعك، ودعنا نبني عليه خطوة خطوة.`;
}

// شكر / إيجابية
function buildThanksPositiveReply() {
  return `سعيد أن الإجابة كانت مفيدة لك 🙌<br>
لو أحببت أن تصلك خلاصة الأفكار والأدوات التي نختبرها في نوفا لينك، فكّر بإضافة بريدك في النشرة.<br>
هكذا تتحول رسالة شكر اليوم إلى سلسلة أفكار تفيد مشروعك غدًا.`;
}

// مزاج سلبي / إحباط
function buildNegativeMoodReply() {
  return `أقدّر شعورك تمامًا… كثير من المشاريع تتعثر قبل أن تلتقط طريقها الصحيح.<br><br>
حاول أن تحوّل هذا الإحباط إلى سؤال عملي واحد: "ما الخطوة الصغيرة التالية التي يمكنني فعلها اليوم؟".<br>
اكتب لي عن مشروعك أو وضعك الحالي، وسأحاول مساعدتك بخطوات عملية بسيطة.`;
}

// اشتراك / نشرة
function buildSubscribeInterestReply() {
  return `يسعدنا حماسك للاشتراك في نوفا لينك ✉️<br>
يمكنك إدخال بريدك في بطاقة الاشتراك أو زيارة صفحة النشرة:<br>
🔗 <a href="https://novalink-ai.com/ashtrk-alan" target="_blank" class="nova-link">اشترك في نوفا لينك</a><br>
ستصلك خلاصة أدوات وأفكار عملية عن الذكاء الاصطناعي وتطوير الأعمال.`;
}

// تعاون / شراكة
function buildCollaborationReply() {
  return `نوفا لينك منفتحة على التعاونات المهنية الجادة المرتبطة بالذكاء الاصطناعي للأعمال وتطوير البوتات الذكية.<br><br>
يمكن أن يكون التعاون على شكل رعاية محتوى، ورش عمل، ندوات مشتركة، أو مشاريع رقمية تخدم روّاد الأعمال.<br><br>
يمكنك استخدام بطاقة التعاون أو مراسلتنا مباشرة:<br>
📧 contact@novalink-ai.com<br>
رجاءً اذكر نوع التعاون، الفئة المستهدفة، وأي تفاصيل إضافية تساعدنا على فهم فكرتك بسرعة.`;
}

// استشارة / شراء خدمة
function buildConsultingPurchaseReply() {
  return `طلب استشارة أو شراء خدمة من نوفا لينك خطوة عملية جدًا 💼<br><br>
يمكننا مساعدتك في بناء بوت دردشة مخصص لعملك، أو رسم مسار عمل ذكي لاستخدام أدوات الذكاء الاصطناعي في مشروعك.<br>
استخدم بطاقة "بوت دردشة لعملك" لحجز استشارة تعريفية قصيرة، وسيتم تجهيز بريد جاهز لتأكيد طلبك.<br><br>
أو راسلنا مباشرة:<br>
📧 contact@novalink-ai.com`;
}

// تعريف نوفا لينك / القصة / الرؤية / الرسالة – تسويقي خفيف
function buildNovaLinkInfoReply() {
  return `نوفا لينك (NOVALINK Ai) مساحة عربية مصمّمة لروّاد الأعمال والأشخاص الذين يريدون تحويل الذكاء الاصطناعي من "ترند" إلى أداة عمل يومية.<br><br>
الفكرة بدأت من انتقال صاحب نوفا لينك من عالم البنوك إلى عالم الذكاء الاصطناعي، ومع كل تجربة ودرس عملي تحوّلت إلى منصة تركّز على ثلاثة محاور:<br>
1️⃣ تبسيط أدوات الذكاء الاصطناعي بلغة مفهومة وتطبيقات عملية.<br>
2️⃣ مساعدة أصحاب المشاريع على رفع الإنتاجية، لا زيادة التعقيد.<br>
3️⃣ بناء مجتمع عربي يرى في الذكاء الاصطناعي "شريك عمل ذكي" يدعم قراراته ولا يستبدله.<br><br>
🔗 <a href="https://novalink-ai.com/about-us-althkaa-alastnaay" target="_blank" class="nova-link">تعرّف أكثر على نوفا لينك</a><br>
🔗 <a href="https://novalink-ai.com/rhlh-frdyh-fy-aalm-althkaa-alastnaay-hktha-bdat-nwfa-lynk" target="_blank" class="nova-link">اقرأ رحلة التأسيس</a>`;
}

// تعريف نوفا بوت نفسه – تسويقي خفيف موجه لتجربة العميل
function buildNovaBotInfoReply() {
  return `🤖 نوفا بوت هو مساعد دردشة ذكي من منصة نوفا لينك، صُمّم ليكون أقرب إلى "مستشار عملي" منه إلى روبوت أسئلة وأجوبة.<br><br>
نوفا بوت يركّز على ثلاث مسارات رئيسية:<br>
- مساعدتك على فهم أدوات الذكاء الاصطناعي واختيار ما يناسب مشروعك.<br>
- اقتراح أفكار وخطوات عملية لرفع الإنتاجية وتبسيط العمل اليومي.<br>
- توجيهك نحو محتوى نوفا لينك الأكثر ارتباطًا بسؤالك، بدل إغراقك بروابط عشوائية.<br><br>
كلما كان سؤالك مرتبطًا بالذكاء الاصطناعي أو تطوير الأعمال، أصبح نوفا بوت أدق وأكثر فائدة لك على المدى الطويل.`;
}

// وداع
function buildGoodbyeReply() {
  return `سعيد بهذه الجولة من الحوار معك 🌱<br>
أتمنّى أن تكون فكرة واحدة على الأقل قد فتحت لك زاوية جديدة للتفكير أو العمل.<br><br>
نوفا بوت سيبقى هنا عندما تعود… ومع كل زيارة، يمكن أن نضيف طبقة جديدة لمسارك مع الذكاء الاصطناعي والأعمال.`;
}

// كشف كلمات دالة على الوداع
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
  return `👨‍💻 هذه لمحة عن الشخص الذي درّب نوفا بوت وبنى نوفا لينك:<br><br>
- صانع محتوى ومدوّن عربي انتقل من عالم البنوك إلى عالم الذكاء الاصطناعي للأعمال.<br>
- يبني نوفا لينك كمساحة عملية تساعد روّاد الأعمال على فهم الأدوات الذكية واستخدامها بخطوات واضحة.<br>
- يؤمن أن الذكاء الاصطناعي ليس تهديدًا للوظائف بقدر ما هو فرصة لإعادة تعريف دورنا في العمل.<br><br>
هذه البطاقة موجودة خصيصًا لمن يهتم بمن يقف خلف الكواليس، لا فقط بما يقدّمه البوت ✨`;
}

function buildDeveloperCardReplyEn() {
  return `👨‍💻 Here’s a quick snapshot of the person behind NovaBot and NovaLink:<br><br>
- An Arabic content creator and blogger who moved from the banking world into AI for business.<br>
- Building NovaLink as a practical space to help entrepreneurs use AI tools step by step, not just read about them.<br>
- Believes AI is less of a job threat and more of a chance to redefine our role and value at work.<br><br>
This card is for those who care about the human behind the system, not just the answers on the screen ✨`;
}

/* =============== واجهة الدماغ الرئيسية =============== */

export async function novaBrainSystem(request = {}) {
  const userText = (request.message || request.userMessage || request.text || "").trim();
  const intentId = request.intentId || "explore";
  const language = request.language === "en" ? "en" : "ar";
  const forceAI = request.forceAI === true;

  // 0) رسالة فارغة → رد تحفيزي
  if (!userText) {
    return {
      reply: getRandomGenericReply(),
      actionCard: null,
      usedAI: false
    };
  }

  // 0.1) بطاقة المطوّر
  if (hasDeveloperCode(userText)) {
    const reply =
      language === "en" ? buildDeveloperCardReplyEn() : buildDeveloperCardReplyAr();

    return {
      reply,
      actionCard: "developer_identity",
      usedAI: false
    };
  }

  // 0.2) وداع
  if (isGoodbyeMessage(userText)) {
    return {
      reply: buildGoodbyeReply(),
      actionCard: null,
      usedAI: false
    };
  }

  // 1) نوايا ثابتة (من novaIntentDetector) – إذا لم نكن نُجبر الذكاء الاصطناعي

  if (!forceAI) {
    if (intentId === "greeting") {
      return {
        reply: buildGreetingReply(),
        actionCard: null,
        usedAI: false
      };
    }

    if (intentId === "thanks_positive") {
      return {
        reply: buildThanksPositiveReply(),
        actionCard: request.suggestedCard || "subscribe",
        usedAI: false
      };
    }

    if (intentId === "negative_mood") {
      return {
        reply: buildNegativeMoodReply(),
        actionCard: null,
        usedAI: false
      };
    }

    if (intentId === "subscribe_interest") {
      return {
        reply: buildSubscribeInterestReply(),
        actionCard: request.suggestedCard || "subscribe",
        usedAI: false
      };
    }

    if (intentId === "collaboration") {
      return {
        reply: buildCollaborationReply(),
        actionCard: request.suggestedCard || "collaboration",
        usedAI: false
      };
    }

    if (intentId === "consulting_purchase") {
      return {
        reply: buildConsultingPurchaseReply(),
        actionCard: request.suggestedCard || "bot_lead",
        usedAI: false
      };
    }

    if (
      intentId === "novalink_info" ||
      intentId === "novalink_story" ||
      intentId === "novalink_services"
    ) {
      return {
        reply: buildNovaLinkInfoReply(),
        actionCard: null,
        usedAI: false
      };
    }

    if (intentId === "novabot_info") {
      return {
        reply: buildNovaBotInfoReply(),
        actionCard: null,
        usedAI: false
      };
    }

    if (intentId === "out_of_scope") {
      return {
        reply: getRandomGenericReply(),
        actionCard: null,
        usedAI: false
      };
    }

    if (intentId === "casual") {
      return {
        reply: getRandomGenericReply(),
        actionCard: null,
        usedAI: false
      };
    }
  }

  // 2) نية الذكاء الاصطناعي وتطوير الأعمال ONLY (أو تم إجبار AI من السيرفر)

  if (shouldUseAI(intentId, forceAI)) {
    const lower = userText.toLowerCase();
    const followupAr = ["أكمل", "تابع", "وضّح أكثر", "وضح أكثر", "تفاصيل أكثر"];
    const followupEn = ["continue", "more", "explain", "details", "go deeper"];

    const isFollowup =
      followupAr.some((kw) => userText.includes(kw)) ||
      followupEn.some((kw) => lower.includes(kw));

    const kb = await loadKnowledgeBase();
    let bestMatch = { score: 0, item: null };

    if (kb.length) {
      bestMatch = await findBestMatch(userText, kb);
    }

    const { score, item } = bestMatch;

    // 2-ج) تطابق قوي → رابط فقط
    if (item && score >= STRONG_MATCH_THRESHOLD && !isFollowup) {
      const replyHtml = buildStrongMatchReply(item);
      return {
        reply: replyHtml,
        actionCard: request.suggestedCard || null,
        usedAI: false
      };
    }

    // 2-د) تطابق متوسط → Gemini + رابط أو قالب متوسط
    if (item && score >= MEDIUM_MATCH_THRESHOLD && score < STRONG_MATCH_THRESHOLD) {
      let replyHtml;
      const aiText = await callGemini(userText, request, item, isFollowup);

      if (aiText) {
        replyHtml = wrapAiAnswerWithLink(aiText, item);
        return {
          reply: replyHtml,
          actionCard: request.suggestedCard || null,
          usedAI: true
        };
      } else {
        replyHtml = buildMidMatchTemplateReply(item);
        return {
          reply: replyHtml,
          actionCard: request.suggestedCard || null,
          usedAI: false
        };
      }
    }

    // 2-هـ) لا يوجد تطابق كافٍ → Gemini بدون مقال
    const aiText = await callGemini(userText, request, null, isFollowup);

    if (aiText) {
      const safe = escapeHtml(aiText).replace(/\n/g, "<br>");
      return {
        reply: safe,
        actionCard: request.suggestedCard || null,
        usedAI: true
      };
    }

    const fallback = buildNoMatchReply();
    return {
      reply: fallback,
      actionCard: request.suggestedCard || null,
      usedAI: false
    };
  }

  // 3) أي شيء غير ملتقط → رد تحفيزي عام
  return {
    reply: getRandomGenericReply(),
    actionCard: null,
    usedAI: false
  };
}
