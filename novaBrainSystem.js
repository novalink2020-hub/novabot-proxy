// ===========================================
// novaBrainSystem.js – NovaBrainSystem PRO (Embeddings Edition)
// دماغ نوفا بوت الهجين: (نوايا + معرفة + Gemini + Embeddings + ردود مؤتمتة + بطاقة المطوّر)
// By Mohammed Abu Snaina – NOVALINK.AI
// ===========================================

import { GoogleGenerativeAI } from "@google/generative-ai";

/* ================= إعدادات عامة ================= */

// مفتاح Gemini من متغيّرات البيئة على Render
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// هذا الـ JSON يكون ناتج دمج: sitemap + ملف Google Drive عبر generate-knowledge-v4.js
const KNOWLEDGE_JSON_URL = process.env.KNOWLEDGE_JSON_URL || "";

// 🔹 عتبات التطابق الجديدة (بعد اعتماد Embeddings)
const STRONG_MATCH_THRESHOLD = 0.55; // تطابق قوي
const MEDIUM_MATCH_THRESHOLD = 0.34; // تطابق متوسط

// 🔹 الحد الأقصى لطول إجابة Gemini (توكنز وليس حروف)
// حسب طلبك: 200 توكن لكل إجابة – حتى في التوضيحات اللاحقة
const MAX_OUTPUT_TOKENS = 200;

// كاش للمعرفة (في الذاكرة فقط – RAM)
let knowledgeCache = null;
let knowledgeLoadedAt = 0;
const KNOWLEDGE_TTL_MS = 12 * 60 * 60 * 1000; // 12 ساعة

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

// تبسيط النص (حذف علامات وترتيب مسافات) لغايات المطابقة النصية
function normalizeText(str = "") {
  return str
    .toLowerCase()
    .replace(/[.,!?؟،"“”()\-_:;«»]/g, " ")
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

/* =============== إعداد Gemini (نص + Embeddings) =============== */

// تهيئة عميل Gemini فقط عند وجود المفتاح
let genAI = null;
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

// موديلات Google المدعومة (واجهات v1 الرسمية) – للنص
// ✅ حسب طلبك: لا نستخدم غيرها للـ text generation
const MODELS_TO_TRY = [
  "gemini-2.0-flash",
  "gemini-2.0-pro",
  "gemini-1.0-pro"
];

// 🔹 موديل الـ Embeddings (لاسترجاع المعرفة بشكل دلالي)
// ملاحظة: الاسم الأحدث حاليًا "text-embedding-004" – يمكن تعديله لاحقًا إذا لزم
const EMBEDDING_MODEL_NAME = "text-embedding-004";

/**
 * الحصول على موديل الـ Embeddings
 */
function getEmbeddingModel() {
  if (!genAI || !GEMINI_API_KEY) return null;
  return genAI.getGenerativeModel({ model: EMBEDDING_MODEL_NAME });
}

/**
 * توليد Embedding لنص محدد
 * نستخدمه للـ:
 * - سؤال المستخدم
 * - كل عنصر في قاعدة المعرفة
 */
async function embedText(text = "") {
  if (!text.trim()) return null;
  const embeddingModel = getEmbeddingModel();
  if (!embeddingModel) return null;

  try {
    const res = await embeddingModel.embedContent({
      contents: [{ role: "user", parts: [{ text }] }]
    });

    const values =
      res?.embedding?.values ||
      res?.data?.[0]?.embedding?.values ||
      [];

    if (!Array.isArray(values) || !values.length) {
      return null;
    }

    return values;
  } catch (err) {
    console.warn("⚠️ embedText error:", err.message);
    return null;
  }
}

/**
 * حساب التشابه (Cosine Similarity) بين متجهين
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/* =============== تحميل قاعدة المعرفة + Embeddings =============== */

// توحيد شكل عناصر المعرفة القادمة من knowledge.v4.json
function normalizeItem(item) {
  if (!item) return null;

  return {
    title: (item.title || "").trim(),
    url: (item.url || "").trim(),
    description: (item.description || "").trim(),
    excerpt: (item.excerpt || "").trim(),
    summary: (item.summary || "").trim(),
    category: item.category || "general",
    keywords: Array.isArray(item.keywords) ? item.keywords : [],
    // حقول داخلية للدماغ:
    _embedding: null,   // سيتم تعبئتها لاحقًا
    _lexicalTokens: null // كاش لمجموعة الكلمات
  };
}

/**
 * تجهيز Embeddings لكل عنصر معرفة
 * - تُستدعى بعد تحميل JSON
 * - تخزّن المتجه داخل كل عنصر (RAM فقط)
 */
async function prepareKnowledgeEmbeddings(items = []) {
  if (!genAI || !GEMINI_API_KEY) {
    console.log("ℹ️ Gemini key not set – knowledge will use lexical matching only.");
    return items;
  }

  for (const item of items) {
    try {
      if (item._embedding && Array.isArray(item._embedding)) {
        continue; // تم حسابه سابقًا
      }

      // نجمع عنوان + وصف + ملخص + كلمات مفتاحية
      const combinedText = [
        item.title,
        item.description,
        item.summary,
        (item.keywords || []).join(" ")
      ]
        .filter(Boolean)
        .join("\n");

      const emb = await embedText(combinedText);
      if (emb) {
        item._embedding = emb;
      }
    } catch (err) {
      console.warn("⚠️ prepareKnowledgeEmbeddings item error:", err.message);
    }
  }

  return items;
}

// تحميل قاعدة المعرفة مع كاش 12 ساعة
async function loadKnowledgeBase() {
  if (!KNOWLEDGE_JSON_URL) {
    console.warn("⚠️ KNOWLEDGE_JSON_URL is not set.");
    return [];
  }

  const now = Date.now();
  if (knowledgeCache && now - knowledgeLoadedAt < KNOWLEDGE_TTL_MS) {
    return knowledgeCache;
  }

  try {
    const res = await fetch(KNOWLEDGE_JSON_URL);
    if (!res.ok) {
      throw new Error("Knowledge JSON HTTP " + res.status);
    }

    const json = await res.json();
    let cleaned = Array.isArray(json)
      ? json
          .map(normalizeItem)
          .filter((x) => x && x.title && x.url)
      : [];

    // تجهيز Embeddings (إن توفّر مفتاح Gemini)
    cleaned = await prepareKnowledgeEmbeddings(cleaned);

    knowledgeCache = cleaned;
    knowledgeLoadedAt = Date.now();

    console.log("✅ Knowledge loaded. Items:", cleaned.length);
    return cleaned;
  } catch (err) {
    console.error("❌ Failed to load knowledge JSON:", err);
    knowledgeCache = [];
    knowledgeLoadedAt = Date.now();
    return [];
  }
}

/**
 * إيجاد أقرب تدوينة لسؤال المستخدم
 * الآن يعتمد على:
 * - Embeddings (تشابه دلالي)
 * - + تطابق لغوي بسيط (Token overlap)
 * معًا ضمن Score واحد.
 */
async function findBestMatch(question, items) {
  if (!question || !items || !items.length) {
    return { score: 0, item: null };
  }

  const qNorm = normalizeText(question);
  if (!qNorm) return { score: 0, item: null };

  const qTokens = tokenize(question);

  // نحاول توليد Embedding للسؤال
  let questionEmbedding = null;
  if (genAI && GEMINI_API_KEY) {
    questionEmbedding = await embedText(question);
  }

  let bestItem = null;
  let bestScore = 0;

  for (const item of items) {
    // --- 1) تطابق لغوي بسيط (lexical)
    if (!item._lexicalTokens) {
      const combinedText =
        (item.title || "") +
        " " +
        (item.description || "") +
        " " +
        (item.summary || "") +
        " " +
        (item.excerpt || "");
      item._lexicalTokens = tokenize(combinedText);
    }

    let common = 0;
    qTokens.forEach((t) => {
      if (item._lexicalTokens.has(t)) common++;
    });

    const lexicalScore =
      common / Math.max(3, Math.max(qTokens.size, item._lexicalTokens.size || 1));

    // --- 2) تشابه Embeddings (semantic)
    let semanticScore = 0;
    if (questionEmbedding && item._embedding && item._embedding.length === questionEmbedding.length) {
      semanticScore = cosineSimilarity(questionEmbedding, item._embedding);
    }

    // --- 3) دمج النتيجتين
    // نعطي وزن أعلى للـ Embeddings لأنه أذكى (0.7) + 0.3 للـ lexical
    const combinedScore =
      semanticScore > 0
        ? (0.7 * semanticScore) + (0.3 * lexicalScore)
        : lexicalScore;

    if (combinedScore > bestScore) {
      bestScore = combinedScore;
      bestItem = item;
    }
  }

  return { score: bestScore, item: bestItem };
}

/* =============== ردود مؤتمتة عامة (روح نوفا لينك) =============== */

// 🔸 هذه الردود التحفيزية العامة – كما في النسخة السابقة
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
  يبدو أن سؤالك يفتح بابًا جديدًا لم نكتب عنه بعد في نوفا لينك،
  لكننا نُرحّب دائمًا بالأفكار الجديدة التي تُلهمنا لموضوعات قادمة.<br>
  شاركنا الزاوية التي تهمك أكثر، فربما تكون هي موضوع التدوينة التالية ✨<br>
  🔗 <a href="https://novalink-ai.com/about-us-althkaa-alastnaay" target="_blank" class="nova-link">تعرّف على أهداف نوفا لينك</a>`;
}

/* =============== ردود التطابق مع المعرفة =============== */

function buildStrongMatchReply(item) {
  const safeTitle = escapeHtml(item.title || "");
  const safeUrl = escapeAttr(item.url || "#");

  return `
  📌 يبدو أن سؤالك يلامس موضوعًا تناولناه في نوفا لينك بعنوان:<br>
  “${safeTitle}”.<br><br>
  هذه التدوينة كُتبت لتقدّم إجابة مركّزة حول هذا النوع من الأسئلة.<br>
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

/* =============== بناء الـ Prompt لـ Gemini =============== */

function buildGeminiPrompt(userText, analysis, bestItem, isFollowup = false) {
  const lang = analysis.language === "en" ? "en" : "ar";
  const intentId = analysis.intentId || "explore";

  let base = "";

  base += `User question / سؤال المستخدم:\n"${userText}"\n\n`;

  if (bestItem) {
    base += `Context from NovaLink blog (may be relevant):\n`;
    base += `Title: ${bestItem.title}\n`;
    if (bestItem.description) base += `Description: ${bestItem.description}\n`;
    if (bestItem.excerpt) base += `Excerpt: ${bestItem.excerpt}\n`;
    if (bestItem.summary) base += `Summary: ${bestItem.summary}\n`;
    base += `Use this as supportive context. Do NOT just summarize it.\n\n`;
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
    base += `The user is asking for more depth / a follow-up explanation on the same topic.\n`;
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

/* =============== استدعاء Gemini مع حد 200 توكن =============== */

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

      if (!text.includes("توضيحًا أعمق") && !text.toLowerCase().includes("deeper explanation")) {
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

function shouldUseAI(intentId) {
  // فقط ai_business يستدعي Gemini
  return intentId === "ai_business";
}

/* =============== ردود ثابتة مخصصة للنوايا =============== */

function buildGreetingReply() {
  return `👋 أهلاً بك في نوفا لينك.<br>
نوفا بوت هنا ليساعدك في كل ما يخص الذكاء الاصطناعي وتطوير الأعمال والمشاريع الصغيرة والمتوسطة.<br><br>
ابدأ بسؤال واضح عن فكرتك أو مشروعك، ودعنا نبني عليه خطوة خطوة.`;
}

function buildThanksPositiveReply() {
  return `سعيد أن الإجابة كانت مفيدة لك 🙌<br>
لو أحببت أن تصلك خلاصة الأفكار والأدوات التي نختبرها في نوفا لينك، فكّر بإضافة بريدك في النشرة.<br>
هكذا تتحول رسالة شكر اليوم إلى سلسلة أفكار تفيد مشروعك غدًا.`;
}

function buildNegativeMoodReply() {
  return `أقدّر شعورك تمامًا… كثير من المشاريع تتعثر قبل أن تلتقط طريقها الصحيح.<br><br>
حاول أن تحوّل هذا الإحباط إلى سؤال عملي واحد: "ما الخطوة الصغيرة التالية التي يمكنني فعلها اليوم؟".<br>
اكتب لي عن مشروعك أو وضعك الحالي، وسأحاول مساعدتك بخطوات عملية بسيطة.`;
}

function buildSubscribeInterestReply() {
  return `يسعدنا حماسك للاشتراك في نوفا لينك ✉️<br>
يمكنك إدخال بريدك في بطاقة الاشتراك أو زيارة صفحة النشرة:<br>
🔗 <a href="https://novalink-ai.com/ashtrk-alan" target="_blank" class="nova-link">اشترك في نوفا لينك</a><br>
ستصلك خلاصة أدوات وأفكار عملية عن الذكاء الاصطناعي وتطوير الأعمال.`;
}

function buildCollaborationReply() {
  return `نوفا لينك منفتحة على التعاونات المهنية الجادة المرتبطة بالذكاء الاصطناعي للأعمال وتطوير novaBrainSystem.js.<br><br>
يمكن أن يكون التعاون على شكل رعاية محتوى، ورش عمل، ندوات مشتركة، أو مشاريع رقمية تخدم روّاد الأعمال.<br><br>
يمكنك استخدام بطاقة التعاون الظاهرة أو مراسلتنا مباشرة:<br>
📧 contact@novalink-ai.com<br>
رجاءً اذكر نوع التعاون، الفئة المستهدفة، وأي تفاصيل إضافية تساعدنا على فهم فكرتك بسرعة.`;
}

function buildConsultingPurchaseReply() {
  return `طلب استشارة أو شراء خدمة من نوفا لينك خطوة عملية جدًا 💼<br><br>
يمكننا مساعدتك في بناء بوت دردشة مخصص لعملك، أو رسم مسار عمل ذكي لاستخدام أدوات الذكاء الاصطناعي في مشروعك.<br>
استخدم بطاقة "بوت دردشة لعملك" لحجز استشارة تعريفية قصيرة، وسيتم تجهيز بريد جاهز لتأكيد طلبك.<br><br>
أو راسلنا مباشرة:<br>
📧 contact@novalink-ai.com`;
}

function buildNovaLinkInfoReply() {
  return `نوفا لينك (NOVALINK Ai) هي مساحة عربية صُممت لتكون جسرًا بين روّاد الأعمال والذكاء الاصطناعي.<br><br>
بدأت الفكرة كرحلة فردية من عالم البنوك إلى عالم الذكاء الاصطناعي، وتحولت تدريجيًا إلى منصة تركّز على ثلاث محاور:<br>
1️⃣ تبسيط أدوات الذكاء الاصطناعي لروّاد الأعمال وأصحاب المشاريع الصغيرة والمتوسطة.<br>
2️⃣ تقديم محتوى عملي يمكن تطبيقه مباشرة في العمل، بعيدًا عن النظريات المعقدة.<br>
3️⃣ بناء مجتمع عربي يرى في الذكاء الاصطناعي "موظفًا ذكيًا" يضيف لقيمته، لا بديلًا عنه.<br><br>
🔗 <a href="https://novalink-ai.com/about-us-althkaa-alastnaay" target="_blank" class="nova-link">من نحن – نوفا لينك</a><br>
🔗 <a href="https://novalink-ai.com/rhlh-frdyh-fy-aalm-althkaa-alastnaay-hktha-bdat-nwfa-lynk" target="_blank" class="nova-link">رحلتي مع نوفا لينك</a>`;
}

function buildNovaBotInfoReply() {
  return `🤖 نوفا بوت هو مساعد دردشة ذكي من منصة نوفا لينك،<br>
مهمته التركيز على كل ما يتقاطع بين الذكاء الاصطناعي وتطوير الأعمال والمشاريع.<br><br>
نوفا بوت لا يهدف للإجابة عن كل شيء في العالم، بل عن الأسئلة التي تساعدك على:<br>
- فهم أدوات الذكاء الاصطناعي وكيف توظّفها في مشروعك.<br>
- استكشاف أفكار لتطوير عملك وزيادة الإنتاجية.<br>
- التعرّف على محتوى نوفا لينك المناسب لسؤالك.<br><br>
كلما كان سؤالك مرتبطًا بالـ AI والبزنس، أصبح نوفا بوت أدق وأقرب لما تحتاجه فعلاً.`;
}

function buildGoodbyeReply() {
  return `سعيد بهذه الجولة من الحوار معك 🌱<br>
أتمنّى أن تكون فكرة واحدة على الأقل قد فتحت لك زاوية جديدة للتفكير أو العمل.<br><br>
نوفا بوت سيبقى هنا عندما تعود… ومع كل زيارة، يمكن أن نضيف طبقة جديدة لمسارك مع الذكاء الاصطناعي والأعمال.`;
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
  return `هذه بطاقة تعريف سريعة بالشخص الذي طوّر نوفا بوت ودرّبه. لمحة مختصرة عن الإنسان خلف التقنية.<br><br>
👨‍💻 من يقف خلف نوفا بوت؟<br><br>
“محمد أبو سنينة—مطور عربي جمع خبرته بين العمل المصرفي والذكاء الاصطناعي.
يبني نوفا لينك كمساحة عملية تساعد روّاد الأعمال على استخدام الأدوات الذكية بثقة ووضوح.” ✨`;
}

function buildDeveloperCardReplyEn() {
  return `This is a short identity card for the person who built and trained NovaBot — a brief look at the human behind the technology.<br><br>
👨‍💻 Who Built NovaBot?<br><br>
“Mohammed Abu Sunaina — a developer who blended banking experience with artificial intelligence.
He is building NovaLink as a practical space that helps entrepreneurs use smart tools with clarity and confidence.” ✨`;
}

/* =============== واجهة الدماغ الرئيسية =============== */

export async function novaBrainSystem(request = {}) {
  const userText = (request.message || request.userMessage || request.text || "").trim();
  const intentId = request.intentId || "explore";
  const language = request.language === "en" ? "en" : "ar";

  if (!userText) {
    return {
      reply: getRandomGenericReply(),
      actionCard: null
    };
  }

  // 0) بطاقة المطوّر – الكود السري
  if (hasDeveloperCode(userText)) {
    const reply =
      language === "en" ? buildDeveloperCardReplyEn() : buildDeveloperCardReplyAr();

    return {
      reply,
      actionCard: "developer_identity"
    };
  }

  // 0.5) كشف الوداع / المغادرة
  if (isGoodbyeMessage(userText)) {
    return {
      reply: buildGoodbyeReply(),
      actionCard: null
    };
  }

  // 1) نوايا ثابتة
  if (intentId === "greeting") {
    return {
      reply: buildGreetingReply(),
      actionCard: null
    };
  }

  if (intentId === "thanks_positive") {
    return {
      reply: buildThanksPositiveReply(),
      actionCard: request.suggestedCard || "subscribe"
    };
  }

  if (intentId === "negative_mood") {
    return {
      reply: buildNegativeMoodReply(),
      actionCard: null
    };
  }

  if (intentId === "subscribe_interest") {
    return {
      reply: buildSubscribeInterestReply(),
      actionCard: request.suggestedCard || "subscribe"
    };
  }

  if (intentId === "collaboration") {
    return {
      reply: buildCollaborationReply(),
      actionCard: request.suggestedCard || "collaboration"
    };
  }

  if (intentId === "consulting_purchase") {
    return {
      reply: buildConsultingPurchaseReply(),
      actionCard: request.suggestedCard || "bot_lead"
    };
  }

  if (
    intentId === "novalink_info" ||
    intentId === "novalink_story" ||
    intentId === "novalink_services"
  ) {
    return {
      reply: buildNovaLinkInfoReply(),
      actionCard: null
    };
  }

  if (intentId === "novabot_info") {
    return {
      reply: buildNovaBotInfoReply(),
      actionCard: null
    };
  }

  if (intentId === "out_of_scope") {
    return {
      reply: getRandomGenericReply(),
      actionCard: null
    };
  }

  if (intentId === "casual") {
    return {
      reply: getRandomGenericReply(),
      actionCard: null
    };
  }

  // 2) نية الذكاء الاصطناعي وتطوير الأعمال ONLY
  if (intentId === "ai_business" && shouldUseAI(intentId)) {
    const lower = userText.toLowerCase();
    const followupAr = ["أكمل", "تابع", "وضّح أكثر", "وضح أكثر", "تفاصيل أكثر"];
    const followupEn = ["continue", "more", "explain", "details", "go deeper"];

    const isFollowup =
      followupAr.some((kw) => userText.includes(kw)) ||
      followupEn.some((kw) => lower.includes(kw));

    // تحميل المعرفة + أفضل تطابق (باستخدام Embeddings + lexical)
    const kb = await loadKnowledgeBase();
    let bestMatch = { score: 0, item: null };

    if (kb.length) {
      bestMatch = await findBestMatch(userText, kb);
    }

    const { score, item } = bestMatch;
    console.log("🔎 Best match score:", score.toFixed(3), "for intent:", intentId);

    // 2-ج) تطابق قوي → Link فقط
    if (item && score >= STRONG_MATCH_THRESHOLD && !isFollowup) {
      const replyHtml = buildStrongMatchReply(item);
      return {
        reply: replyHtml,
        actionCard: request.suggestedCard || null
      };
    }

    // 2-د) تطابق متوسط → Gemini + Link أو قالب
    if (item && score >= MEDIUM_MATCH_THRESHOLD && score < STRONG_MATCH_THRESHOLD) {
      let replyHtml;
      const aiText = await callGemini(userText, request, item, isFollowup);

      if (aiText) {
        replyHtml = wrapAiAnswerWithLink(aiText, item);
      } else {
        replyHtml = buildMidMatchTemplateReply(item);
      }

      return {
        reply: replyHtml,
        actionCard: request.suggestedCard || null
      };
    }

    // 2-هـ) لا يوجد تطابق كافٍ → Gemini فقط (بدون مقال)
    const aiText = await callGemini(userText, request, null, isFollowup);

    if (aiText) {
      const safe = escapeHtml(aiText).replace(/\n/g, "<br>");
      return {
        reply: safe,
        actionCard: request.suggestedCard || null
      };
    }

    // 2-و) فول باك داخل نطاق الأعمال/الذكاء الاصطناعي
    const fallback = buildNoMatchReply();
    return {
      reply: fallback,
      actionCard: request.suggestedCard || null
    };
  }

  // 3) أي شيء لم يتم التقاطه صراحةً → يعامل كخارج النطاق
  return {
    reply: getRandomGenericReply(),
    actionCard: null
  };
}
