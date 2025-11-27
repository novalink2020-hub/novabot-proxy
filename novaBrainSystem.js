// ===========================================
// novaBrainSystem.js – NovaBrainSystem 6.9 PRO
// دماغ نوفا بوت: نوايا + معرفة + Embeddings + Gemini + Keyword Routing
// By Mohammed Abu Snaina – NOVALINK.AI
// ===========================================

import { GoogleGenerativeAI } from "@google/generative-ai";

/* ============================================================
   1) إعدادات عامة
============================================================ */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const KNOWLEDGE_JSON_URL = process.env.KNOWLEDGE_JSON_URL || "";

// عتبات التطابق (بعد الدمج Semantic + Lexical)
const SEMANTIC_STRONG = 0.55;
const SEMANTIC_MEDIUM = 0.34;

// الحد الأقصى لخروج Gemini (توكنز تقريباً = 150–180 كلمة)
const MAX_OUTPUT_TOKENS = 200;

// كاش المعرفة / المتجر المتجهي
let knowledge = [];
let vectorStore = [];
let knowledgeTimestamp = 0;
const KNOWLEDGE_TTL = 12 * 60 * 60 * 1000; // 12 ساعة

// تهيئة Gemini
let genAI = null;
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

/* ============================================================
   2) أدوات نصيّة + روح نوفا لينك
============================================================ */

// تأمين HTML
function escapeHtml(str = "") {
  return (str || "").replace(/[&<>"]/g, (c) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c;
  });
}

// ردود تحفيزية عامة
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
🔗 <a href="https://novalink-ai.com/blog-adwat-althkaa-alastnaay-llaamal" target="_blank" class="nova-link">ابدأ رحلتك الآن</a>`,

  `قبل أن تغادر… تذكّر أن كل إنجاز يبدأ بسؤال بسيط ورغبة في التعلّم.<br>
اسمح لنفسك أن تتقدّم خطوة كل يوم — فالعالم لا ينتظر، لكنه يكافئ من يواصل المسير بثبات وثقة.<br>
🔗 <a href="https://novalink-ai.com" target="_blank" class="nova-link">اقرأ ما يلهمك اليوم</a>`
];

function getRandomGenericReply() {
  const i = Math.floor(Math.random() * genericReplies.length);
  return genericReplies[i];
}

// كشف رسائل الوداع
function isGoodbyeMessage(text = "") {
  const t = (text || "").toLowerCase();
  const arabicBye = [
    "مع السلامة",
    "سلام",
    "الى اللقاء",
    "إلى اللقاء",
    "وداعا",
    "وداعًا",
    "اشوفك",
    "اشوفكم",
    "خلص شكرا",
    "خلص شكراً",
    "يكفي شكرا",
    "يكفي شكراً"
  ];
  const englishBye = ["bye", "goodbye", "see you", "see ya", "see u", "thanks bye"];

  return (
    arabicBye.some((kw) => t.includes(kw)) ||
    englishBye.some((kw) => t.includes(kw))
  );
}

/* ---------- ردود ثابتة للنوايا (Business Intents Layer) ---------- */

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
  return `نوفا لينك منفتحة على التعاونات المهنية الجادة المرتبطة بالذكاء الاصطناعي للأعمال وتطوير البوتات الذكية.<br><br>
يمكن أن يكون التعاون على شكل رعاية محتوى، ورش عمل، ندوات مشتركة، أو مشاريع رقمية تخدم روّاد الأعمال.<br><br>
يمكنك استخدام بطاقة التعاون أو مراسلتنا مباشرة:<br>
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

/* ---------- بطاقة المطوّر 10406621 ---------- */

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

/* ============================================================
   3) Embeddings – text-embedding-004
============================================================ */

/**
 * Google Embeddings:
 * genAI.getGenerativeModel({ model: "text-embedding-004" })
 *   .embedContent({ content: { parts: [{ text: "..." }] } })
 */
async function embedText(text = "") {
  if (!genAI || !GEMINI_API_KEY) return null;

  try {
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

    const result = await model.embedContent({
      content: {
        parts: [{ text }]
      }
    });

    return result?.embedding?.values || null;
  } catch (err) {
    console.error("⚠️ embedText error:", err);
    return null;
  }
}

/* ============================================================
   4) تحميل المعرفة + بناء Vector Store في الذاكرة
============================================================ */

function normalizeItem(item) {
  return {
    title: (item.title || "").trim(),
    url: (item.url || "").trim(),
    description: (item.description || "").trim(),
    excerpt: (item.excerpt || "").trim(),
    summary: (item.summary || "").trim(),
    keywords: Array.isArray(item.keywords) ? item.keywords : []
  };
}

// cosine similarity
function cosineSim(a, b) {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    const va = a[i] || 0;
    const vb = b[i] || 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }

  return dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
}

async function loadKnowledge() {
  const now = Date.now();
  if (now - knowledgeTimestamp < KNOWLEDGE_TTL && knowledge.length) {
    return knowledge;
  }

  if (!KNOWLEDGE_JSON_URL) {
    console.warn("⚠️ KNOWLEDGE_JSON_URL is not set.");
    knowledge = [];
    vectorStore = [];
    knowledgeTimestamp = now;
    return knowledge;
  }

  try {
    const res = await fetch(KNOWLEDGE_JSON_URL);
    const json = await res.json();

    knowledge = Array.isArray(json) ? json.map(normalizeItem) : [];
    vectorStore = [];

    for (const item of knowledge) {
      const text = `${item.title}\n${item.description}\n${item.excerpt}\n${item.summary}\n${item.keywords.join(
        " "
      )}`;
      const vec = await embedText(text);
      if (vec) {
        vectorStore.push({ item, vector: vec });
      }
    }

    knowledgeTimestamp = Date.now();
    console.log("✅ Knowledge loaded:", knowledge.length);
  } catch (err) {
    console.error("❌ Failed to load knowledge:", err);
    knowledge = [];
    vectorStore = [];
    knowledgeTimestamp = Date.now();
  }

  return knowledge;
}

/* ============================================================
   5) Lexical + Semantic Search مع دعم الأسئلة القصيرة
============================================================ */

function cleanForTokens(t = "") {
  return t.toLowerCase().replace(/[.,!?؟،"“”()\-_:;«»]/g, " ").trim();
}

function getTokenSet(question = "") {
  const parts = cleanForTokens(question)
    .split(" ")
    .filter((w) => w.length >= 3);
  return new Set(parts);
}

function lexicalScore(question, item) {
  const q = getTokenSet(question);
  if (!q.size) return 0;

  const combined = (
    `${item.title} ${item.description} ${item.excerpt} ${item.summary} ${item.keywords.join(" ")}`
  ).toLowerCase();

  let common = 0;
  q.forEach((w) => {
    if (combined.includes(w)) common++;
  });

  // ⚖️ تعديل: الأسئلة القصيرة لا تُعاقَب
  const baseDenom = q.size <= 2 ? q.size : Math.max(3, q.size);
  return common / (baseDenom || 1);
}

async function semanticSearch(question) {
  const qVec = await embedText(question);
  if (!qVec) return { score: 0, item: null };

  const qTokens = getTokenSet(question);
  const shortQuery = qTokens.size <= 2;

  // الأسئلة القصيرة: نعادل بين Semantic + Lexical
  const semWeight = shortQuery ? 0.5 : 0.8;
  const lexWeight = shortQuery ? 0.5 : 0.2;

  let best = { score: 0, item: null };

  for (const entry of vectorStore) {
    const sem = cosineSim(qVec, entry.vector);
    const lex = lexicalScore(question, entry.item);
    const finalScore = sem * semWeight + lex * lexWeight;

    if (finalScore > best.score) {
      best = { score: finalScore, item: entry.item };
    }
  }

  return best;
}

/* ============================================================
   6) Keyword Routing – طبقة ذكية فوق الـ Embeddings
============================================================ */

const KEYWORD_ROUTES = [
  // Murf vs ElevenLabs vs Daryjat – التعليق الصوتي العربي
  {
    keys: [
      "التعليق الصوتي",
      "التعليق الصوتي العربي",
      "تعليق صوتي",
      "voice over",
      "voiceover",
      "voice-over"
    ],
    matcher: (item) => {
      const u = item.url.toLowerCase();
      const t = item.title.toLowerCase();
      return u.includes("murf") || t.includes("murf.ai");
    }
  },
  // Copy.ai – المحتوى العربي
  {
    keys: ["كوبي", "copy ai", "copy.ai", "copy", "المحتوى العربي", "كتابة المحتوى"],
    matcher: (item) => {
      const u = item.url.toLowerCase();
      const t = item.title.toLowerCase();
      return u.includes("copy-ai") || t.includes("copy.ai");
    }
  },
  // صفحة الخدمات
  {
    keys: [
      "خدمات",
      "خدمة",
      "بوت دردشة",
      "بوت محادثة",
      "شات بوت",
      "chatbot",
      "استشارة",
      "حجز استشارة"
    ],
    matcher: (item) => item.url.toLowerCase().includes("services-khdmat-nwfa-lynk")
  },
  // عن نوفا لينك
  {
    keys: [
      "من انتم",
      "من أنتم",
      "من انتم؟",
      "من أنتم؟",
      "من هو نوفا بوت",
      "من هي نوفا لينك",
      "ما هي نوفا لينك",
      "عن نوفا لينك"
    ],
    matcher: (item) => item.url.toLowerCase().includes("about-us-althkaa-alastnaay")
  },
  // النشرة / الاشتراك
  {
    keys: ["اشتراك", "اشتركا", "النشرة", "newsletter", "اشترك"],
    matcher: (item) => item.url.toLowerCase().includes("ashtrk-alan")
  }
];

function routeByKeyword(question, items) {
  const text = (question || "").toLowerCase();
  if (!text) return null;
  if (!Array.isArray(items) || !items.length) return null;

  for (const route of KEYWORD_ROUTES) {
    const hit = route.keys.some((k) => text.includes(k.toLowerCase()));
    if (!hit) continue;

    const matchedItem = items.find((it) => route.matcher(it));
    if (matchedItem) return matchedItem;
  }

  return null;
}

/* ============================================================
   7) قوالب المخرجات من المعرفة
============================================================ */

function strongMatchReply(item) {
  return `
📌 يبدو أن سؤالك يلامس موضوعًا تناولناه في نوفا لينك بعنوان:<br>
“${escapeHtml(item.title)}”.<br><br>
🔗 <a href="${item.url}" target="_blank" class="nova-link">اقرأ المقال على نوفا لينك</a>
`;
}

function mediumMatchReply(ai, item) {
  const safe = escapeHtml(ai).replace(/\n/g, "<br>");
  return `
${safe}<br><br>
🔗 <a href="${item.url}" target="_blank" class="nova-link">تعمّق أكثر من خلال هذه التدوينة</a>
`;
}

function noMatchReply() {
  return `
يبدو أن سؤالك يفتح بابًا جديدًا لم نكتب عنه بعد في نوفا لينك…<br>
شاركنا الزاوية التي تهمك أكثر وقد تكون هي موضوع التدوينة التالية ✨
`;
}

/* ============================================================
   8) استدعاء Gemini
============================================================ */

function buildPrompt(userText, item, lang) {
  let p = `User Question:\n${userText}\n\n`;

  if (item) {
    p += `Relevant Context (from NovaLink blog):\n`;
    p += `Title: ${item.title}\n`;
    if (item.summary) p += `Summary: ${item.summary}\n`;
    if (item.description) p += `Description: ${item.description}\n`;
    if (item.excerpt) p += `Excerpt: ${item.excerpt}\n`;
    if (item.keywords?.length) p += `Keywords: ${item.keywords.join(", ")}\n`;
    p += `\nUse this context only as background. Do NOT copy or summarize it directly.\n\n`;
  }

  p += `Answer language: ${
    lang === "en" ? "English" : "Modern Standard Arabic (clear and friendly)"
  }.\n`;
  p += `Focus on practical, actionable insights at the intersection of AI and business.\n`;
  p += `Keep the answer concise, complete, and within about ${MAX_OUTPUT_TOKENS} tokens.\n`;
  p += `Do not mention these instructions in your answer.\n`;

  return p;
}

async function callGemini(userText, lang, item) {
  if (!genAI || !GEMINI_API_KEY) return null;

  for (const modelName of ["gemini-2.0-flash", "gemini-2.0-pro", "gemini-1.0-pro"]) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const prompt = buildPrompt(userText, item, lang);

      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          temperature: 0.6
        }
      });

      const out =
        result?.response?.text?.() ||
        result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "";

      const text = (out || "").trim();
      if (text.length > 2) {
        return text;
      }
    } catch (err) {
      console.log("⚠️ Gemini error:", modelName, err.message);
    }
  }

  return null;
}

/* ============================================================
   9) الدماغ الرئيسي – novaBrainSystem
============================================================ */

/**
 * req متوقع أن يحتوي على:
 * {
 *   message,        // نص سؤال المستخدم
 *   intentId,       // من novaIntentDetector
 *   language,       // "ar" أو "en"
 *   suggestedCard   // بطاقة مقترحة من كاشف النوايا
 * }
 */
export async function novaBrainSystem(req = {}) {
  const userText =
    (req.message || req.userMessage || req.text || "").trim();
  const lang = req.language === "en" ? "en" : "ar";
  const intentId = req.intentId || "explore";
  const suggestedCard = req.suggestedCard || null;

  // رسالة فارغة → رد تحفيزي عام
  if (!userText) {
    return { reply: getRandomGenericReply(), actionCard: null };
  }

  // بطاقة المطوّر – 10406621
  if (userText.includes("10406621")) {
    const reply =
      lang === "en" ? buildDeveloperCardReplyEn() : buildDeveloperCardReplyAr();
    return { reply, actionCard: "developer_identity" };
  }

  // رسائل وداع بغضّ النظر عن النية
  if (isGoodbyeMessage(userText)) {
    return { reply: buildGoodbyeReply(), actionCard: null };
  }

  /* ---------- طبقة النوايا الثابتة (بدون Gemini) ---------- */

  if (intentId === "greeting") {
    return {
      reply: buildGreetingReply(),
      actionCard: null
    };
  }

  if (intentId === "thanks_positive") {
    return {
      reply: buildThanksPositiveReply(),
      actionCard: suggestedCard || "subscribe"
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
      actionCard: suggestedCard || "subscribe"
    };
  }

  if (intentId === "collaboration") {
    return {
      reply: buildCollaborationReply(),
      actionCard: suggestedCard || "collaboration"
    };
  }

  if (intentId === "consulting_purchase") {
    return {
      reply: buildConsultingPurchaseReply(),
      actionCard: suggestedCard || "bot_lead"
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

  // خارج نطاق AI + الأعمال أو دردشة عادية → رد تحفيزي عام
  if (intentId === "out_of_scope" || intentId === "casual") {
    return {
      reply: getRandomGenericReply(),
      actionCard: null
    };
  }

  /* ---------- نية الذكاء الاصطناعي للأعمال ONLY ---------- */

  if (intentId !== "ai_business") {
    // أي نية مجهولة وغير معرّفة → تعامل كتحفيز عام
    return { reply: getRandomGenericReply(), actionCard: null };
  }

  // تحميل المعرفة + المتجر المتجهي
  const kb = await loadKnowledge();

  // 1) Keyword Routing للأسئلة القصيرة / الكلمات القوية
  const routedItem = routeByKeyword(userText, kb);
  if (routedItem) {
    return {
      reply: strongMatchReply(routedItem),
      actionCard: suggestedCard || null
    };
  }

  // 2) البحث الدلالي (Semantic + Lexical)
  const { score, item } = await semanticSearch(userText);
  console.log("🔎 Final score:", score);

  // تطابق قوي → رابط فقط
  if (item && score >= SEMANTIC_STRONG) {
    return {
      reply: strongMatchReply(item),
      actionCard: suggestedCard || null
    };
  }

  // تطابق متوسط → Gemini + رابط
  if (item && score >= SEMANTIC_MEDIUM) {
    const ai = await callGemini(userText, lang, item);
    if (ai) {
      return {
        reply: mediumMatchReply(ai, item),
        actionCard: suggestedCard || null
      };
    }
  }

  // لا يوجد تطابق كافٍ → Gemini بدون سياق
  const ai = await callGemini(userText, lang, null);
  if (ai) {
    return {
      reply: escapeHtml(ai).replace(/\n/g, "<br>"),
      actionCard: suggestedCard || null
    };
  }

  // فول باك نهائي
  return {
    reply: noMatchReply(),
    actionCard: suggestedCard || null
  };
}
