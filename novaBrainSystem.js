// ===========================================
// novaBrainSystem.js
// دماغ نوفا بوت – دمج النيّات + المعرفة + Gemini
// By Mohammed Abu Snaina – NOVALINK.AI
// ===========================================

import { GoogleGenerativeAI } from "@google/generative-ai";

// -----------------------------
// إعداد مصادر المعرفة + الإعدادات
// -----------------------------
const KNOWLEDGE_JSON_URL =
  process.env.KNOWLEDGE_JSON_URL ||
  "https://drive.google.com/uc?export=download&id=1muVGP0uRQ0nAzvchiZcmVqXY3gXYvah0";

const SITEMAP_URL =
  process.env.SITEMAP_URL || "https://novalink-ai.com/sitemap.xml";

const KNOWLEDGE_TTL_MS = 12 * 60 * 60 * 1000; // 12 ساعة
const STRONG_MATCH_THRESHOLD = 0.8;
const MEDIUM_MATCH_THRESHOLD = 0.65;

// Gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// كاش للمعرفة في ذاكرة السيرفر
let knowledgeCache = {
  data: [],
  ts: 0
};

// -----------------------------
// أدوات نصية مشتركة
// -----------------------------
function normalizeText(str = "") {
  return str
    .toLowerCase()
    .replace(/[.,!?؟،"“”()\-_:;«»\[\]]/g, " ")
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

function similarityScore(query, item) {
  const qTokens = tokenize(query);
  if (!qTokens.size) return 0;

  const combined =
    (item.title || "") +
    " " +
    (item.description || "") +
    " " +
    (item.excerpt || "") +
    " " +
    (item.content || "");

  const tTokens = tokenize(combined);
  if (!tTokens.size) return 0;

  let common = 0;
  qTokens.forEach((t) => {
    if (tTokens.has(t)) common++;
  });

  return common / Math.max(3, qTokens.size);
}

function normalizeItem(raw) {
  if (!raw) return null;
  return {
    title: (raw.title || "").trim(),
    url: (raw.url || "").trim(),
    description: (raw.description || "").trim(),
    excerpt: (raw.excerpt || raw.firstParagraph || "").trim(),
    content: (raw.content || "").trim()
  };
}

// -----------------------------
// جلب المعرفة من JSON (Google Drive)
// -----------------------------
async function loadKnowledgeFromJson() {
  if (!KNOWLEDGE_JSON_URL) {
    throw new Error("KNOWLEDGE_JSON_URL is not set");
  }

  const res = await fetch(KNOWLEDGE_JSON_URL);
  if (!res.ok) {
    throw new Error("Knowledge JSON HTTP " + res.status);
  }

  const json = await res.json();
  if (!Array.isArray(json)) {
    throw new Error("Knowledge JSON is not an array");
  }

  const items = json.map(normalizeItem).filter((x) => x && x.title && x.url);
  return items;
}

// -----------------------------
// جلب المعرفة من Sitemap كخطة احتياطية
// -----------------------------
async function loadKnowledgeFromSitemap() {
  const res = await fetch(SITEMAP_URL);
  if (!res.ok) {
    throw new Error("Sitemap HTTP " + res.status);
  }

  const xml = await res.text();
  const locMatches = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)];
  const urls = locMatches.map((m) => m[1].trim()).filter(Boolean);

  const results = [];
  const maxPages = 30; // حد أقصى لعدم إرهاق السيرفر

  for (let i = 0; i < Math.min(urls.length, maxPages); i++) {
    const url = urls[i];
    try {
      const pageRes = await fetch(url);
      if (!pageRes.ok) continue;
      const html = await pageRes.text();

      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      const descMatch = html.match(
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i
      );
      const pMatch = html.match(/<p[^>]*>(.*?)<\/p>/i);

      const item = normalizeItem({
        title: titleMatch ? titleMatch[1] : "",
        url,
        description: descMatch ? descMatch[1] : "",
        excerpt: pMatch ? pMatch[1].replace(/<[^>]*>/g, "") : ""
      });

      if (item && item.title && item.url) {
        results.push(item);
      }
    } catch {
      // نتجاهل الصفحة التي تفشل
    }
  }

  return results;
}

// -----------------------------
// إدارة الكاش
// -----------------------------
async function getKnowledge() {
  const now = Date.now();
  if (knowledgeCache.data.length && now - knowledgeCache.ts < KNOWLEDGE_TTL_MS) {
    return knowledgeCache.data;
  }

  let data = [];
  try {
    data = await loadKnowledgeFromJson();
  } catch {
    try {
      data = await loadKnowledgeFromSitemap();
    } catch {
      data = [];
    }
  }

  knowledgeCache = { data, ts: Date.now() };
  return data;
}

function findBestKnowledgeMatch(question, knowledgeList) {
  if (!knowledgeList || !knowledgeList.length) {
    return { score: 0, item: null };
  }

  let bestItem = null;
  let bestScore = 0;

  for (const item of knowledgeList) {
    const score = similarityScore(question, item);
    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  return { score: bestScore, item: bestItem };
}

// -----------------------------
// كشف مشاعر بسيطة + "من نحن"
// -----------------------------
const greetingWords = [
  "مرحبا",
  "مرحبا بك",
  "مرحبا بكم",
  "اهلا",
  "أهلاً",
  "اهلاً",
  "السلام عليكم",
  "هاي",
  "هلا",
  "hi",
  "hello"
];

const positiveWords = [
  "شكرا",
  "شكراً",
  "شكرًا",
  "thanks",
  "ثانكس",
  "ممتاز",
  "رائع",
  "جميل",
  "مفيد",
  "افادني",
  "سهلت",
  "حلو"
];

const negativeWords = [
  "سيء",
  "سئ",
  "سيئ",
  "ضعيف",
  "محبط",
  "غير مفيد",
  "ما استفدت",
  "لم استفد",
  "غير واضح",
  "لا فائدة"
];

function isGreeting(text) {
  const norm = normalizeText(text);
  const first = norm.split(" ").slice(0, 6).join(" ");
  return greetingWords.some((w) => first.includes(normalizeText(w)));
}

function isPositive(text) {
  const norm = normalizeText(text);
  return positiveWords.some((w) => norm.includes(normalizeText(w)));
}

function isNegative(text) {
  const norm = normalizeText(text);
  return negativeWords.some((w) => norm.includes(normalizeText(w)));
}

function isAboutNovaLink(text) {
  const norm = normalizeText(text);
  return (
    norm.includes("نوفا لينك") ||
    norm.includes("من انتم") ||
    norm.includes("من أنتم") ||
    norm.includes("ما هي نوفا لينك") ||
    norm.includes("رؤيتكم") ||
    norm.includes("هدفكم") ||
    norm.includes("قصتكم")
  );
}

// -----------------------------
// ردود ثابتة من روح v4.8 (مبسّطة)
// -----------------------------
const genericReplies = [
  `👋 أهلاً بك في نوفا لينك، مساحة عربية تؤمن أن الذكاء الاصطناعي وُجد ليحرّر وقتك لا ليأخذ مكانك.`,
  `🌟 ربما تبحث عن بداية جديدة أو إلهام يعيد شغفك… نوفا لينك هنا لتربط فضولك بأدوات تصنع فرقًا حقيقيًا.`,
  `🤖 لا تحتاج أن تكون خبيرًا لتبدأ مع الذكاء الاصطناعي، فقط فضول صغير وخطوة عملية واضحة.`,
  `✨ أحيانًا لا تحتاج إلى إجابة طويلة، بل إلى زاوية تفكير جديدة… وهذا بالضبط ما نحاول بناؤه هنا.`,
  `🚀 الذكاء الاصطناعي لا ينتظر أحدًا، لكنه دائمًا يفتح الباب لمن يقرر أن يبدأ بخطوة بسيطة وواضحة.`
];

const positiveReplies = [
  `🎉 أشكرك على كلماتك اللطيفة، يسعدني أن يكون نوفا بوت جزءًا من رحلتك مع الذكاء الاصطناعي.`,
  `🙏 سعادتك بما تقدّمه نوفا لينك تعنيني فعلًا… استمر في طرح أسئلتك، فكل سؤال يساعدنا أن نطوّر ما نقدّمه.`
];

const negativeReplies = [
  `🤝 أقدّر صراحتك، ويبدو أن الإجابة لم تكن بالمستوى الذي تستحقه. جرّب أن توضّح ما الذي تبحث عنه أكثر، وسأعيد ترتيب الإجابة معك.`,
  `💬 من حقك تحصل على رد أوضح… أخبرني ما الجزء الذي لم يكن مفيدًا، لنحاول زاوية مختلفة وأكثر عملية.`
];

const aboutNova = {
  whoWeAre: `
🟠 من نحن – نوفا لينك  
نوفا لينك مساحة عربية تهتم بتبسيط الذكاء الاصطناعي للأعمال والمهارات،  
بعيدًا عن الضجيج، وبتركيز على التطبيقات التي تصنع فرقًا حقيقيًا في إنتاجيتك ومشاريعك.  
نوفا بوت هو المساعد الذكي الرسمي للمنصة، صُمم ليتحدث بهدوء ووضوح، ويقترح عليك ما يناسبك دون مبالغة.`,
  ourStory: `
🔵 قصة انطلاق نوفا لينك  
نوفا لينك بدأت من رحلة فردية للبحث عن معنى حقيقي للذكاء الاصطناعي في الحياة العملية،  
ثم تحوّلت لمشروع يشارك التجربة مع كل شخص يريد أن يتعلّم ويطبّق بدل أن يكتفي بالمشاهدة.  
هي قصة شغف وقرارات صغيرة تراكَمت حتى أصبحت مسارًا جديدًا بالكامل.`,
  mission: `
✨ هدف نوفا لينك  
رؤيتنا بسيطة لكنها عميقة: أن يصبح الذكاء الاصطناعي أداة متاحة لكل شخص جاد،  
ليستخدمه في تطوير عمله، مشروعه، أو حتى مساره المهني، خطوة واقعية بعد أخرى.`
};

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// -----------------------------
// بناء ردود المعرفة
// -----------------------------
function buildStrongMatchReply(item) {
  return (
    `💬 يبدو أن سؤالك يلامس موضوعًا تناولناه في نوفا لينك بعنوان:\n` +
    `“${item.title}” — مقالة كُتبت لتجيب على هذا النوع من الأسئلة بوضوح وعمق.\n` +
    `أنصحك بقراءتها، فغالبًا ستجد فيها ما تبحث عنه.\n` +
    `🔗 ${item.url}`
  );
}

function buildMediumMatchReply(item) {
  return (
    `💬 سؤالك قريب من فكرة ناقشناها في نوفا لينك بعنوان:\n` +
    `“${item.title}”.\n` +
    `قد لا تكون الإجابة طبق الأصل عمّا في ذهنك، لكنها ستفتح لك زاوية تفكير مفيدة حول الموضوع.\n` +
    `🔗 ${item.url}`
  );
}

function buildNoMatchReply() {
  return (
    `💬 سؤالك يفتح بابًا جديدًا لم نكتب عنه بشكل مباشر بعد في نوفا لينك،` +
    ` لكن هذا بالضبط النوع من الأسئلة الذي يلهمنا لموضوع تدوينة قادمة.\n` +
    `حاول أن توضّح الزاوية أكثر، وسأحاول أن أبني معك إجابة عملية قدر الإمكان.`
  );
}

// -----------------------------
// Gemini – استدعاء الذكاء الاصطناعي
// -----------------------------
let geminiClient = null;
function getGeminiClient() {
  if (!GEMINI_API_KEY) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  return geminiClient;
}

function buildSystemInstruction({ intentId, language, dialectHint, toneHint }) {
  const lang = language === "en" ? "en" : "ar";

  if (lang === "en") {
    return `
You are "NovaBot", the official assistant of NOVALINK.AI.
- Personality: calm, balanced, professional, slightly motivational, never over-hyped.
- Answer in clear, simple English.
- Focus on practical, business-oriented value when possible.
- Max length ~400 tokens. Prefer concise paragraphs, not walls of text.
- Do NOT include any links or URLs in your answer.
- If the user seems confused, reorganize the idea step by step.`;
  }

  // Arabic
  let tone = `
أنت "نوفا بوت"، المساعد الرسمي لمنصة نوفا لينك.
- شخصيتك: هادئة، متزنة، احترافية، وفيها جرعة تحفيز واقعية بدون مبالغة.
- أجب بالعربية الفصحى السلسة، ويمكنك إدخال كلمات خفيفة من لهجة المستخدم بشكل طبيعي إن لزم، بدون إفراط.
- ركّز على الوضوح والجانب العملي، لا تكتب إنشائيًا بدون فائدة.`;

  if (intentId === "improve_business" || intentId === "buy_service") {
    tone += `
- المستخدم غالبًا يفكّر في تطوير مشروعه أو الحصول على حل… قدّم خطوات عملية واضحة وقابلة للتنفيذ.`;
  } else if (intentId === "learn" || intentId === "explore") {
    tone += `
- المستخدم في حالة تعلّم أو استكشاف… نظّم الإجابة في نقاط أو مراحل، بدون إغراق في التفاصيل النظرية غير الضرورية.`;
  } else if (intentId === "collaboration") {
    tone += `
- اجعل الإجابة بروح مهنية منفتحة على التعاون، لكن بدون وعود مبالغ فيها.`;
  }

  tone += `
- لا تضف أي روابط أو عناوين URL في إجابتك.
- اجعل الإجابة في حدود تقريبية لا تتجاوز 400 توكن، كفقرات قصيرة مرتبة.`;

  return tone;
}

async function callGemini({ userMessage, intentId, language, dialectHint, toneHint }) {
  const client = getGeminiClient();
  if (!client) return null;

  try {
    const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });

    const systemInstruction = buildSystemInstruction({
      intentId,
      language,
      dialectHint,
      toneHint
    });

    const prompt =
      systemInstruction +
      "\n\n[رسالة المستخدم]\n" +
      userMessage +
      "\n\nأجب الآن وفق التعليمات السابقة.";

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 400,
        temperature: 0.7,
        topP: 0.9,
        topK: 32
      }
    });

    const text = result?.response?.text?.();
    if (!text || !text.trim()) return null;
    return text.trim();
  } catch (err) {
    console.error("🔥 Gemini error:", err);
    return null;
  }
}

// -----------------------------
// الدالة الرئيسية – دماغ نوفا
// context = { userMessage, analysis }
// analysis = { intentId, confidence, language, dialectHint, toneHint, suggestedCard }
// -----------------------------
export async function novaBrainSystem(context = {}) {
  const userMessage = (context.userMessage || "").toString().trim();
  const analysis = context.analysis || {};

  const intentId = analysis.intentId || "explore";
  const language = analysis.language || "ar";
  const dialectHint = analysis.dialectHint || null;
  const toneHint = analysis.toneHint || null;
  const suggestedCard = analysis.suggestedCard || null;

  let actionCard = null;

  if (!userMessage) {
    return {
      reply: randomItem(genericReplies),
      actionCard: null
    };
  }

  // 1) تحية / شكر / سلبية
  if (isPositive(userMessage)) {
    return {
      reply: randomItem(positiveReplies),
      actionCard: "subscribe" // ممكن اقتراح بطاقة اشتراك عند رضا المستخدم
    };
  }

  if (isNegative(userMessage)) {
    return {
      reply: randomItem(negativeReplies),
      actionCard: null
    };
  }

  if (isGreeting(userMessage)) {
    return {
      reply: randomItem(genericReplies),
      actionCard: null
    };
  }

  // 2) "من نحن" / تعريف نوفا لينك
  if (isAboutNovaLink(userMessage)) {
    const norm = normalizeText(userMessage);
    let reply = aboutNova.whoWeAre;

    if (norm.includes("قصة") || norm.includes("رحلة") || norm.includes("بدأت")) {
      reply = aboutNova.ourStory;
    } else if (norm.includes("رؤية") || norm.includes("هدف") || norm.includes("رسالة")) {
      reply = aboutNova.mission;
    }

    return {
      reply: reply.trim(),
      actionCard: "subscribe"
    };
  }

  // 3) تحميل المعرفة والبحث عن أفضل تطابق
  let knowledge = [];
  try {
    knowledge = await getKnowledge();
  } catch {
    knowledge = [];
  }

  const { score, item } = findBestKnowledgeMatch(userMessage, knowledge);

  // 4) تطابق قوي ≥ 0.80 → رد مؤتمت + رابط
  if (item && score >= STRONG_MATCH_THRESHOLD) {
    return {
      reply: buildStrongMatchReply(item),
      actionCard: suggestedCard || null
    };
  }

  // 5) تطابق متوسط ≥ 0.65 → رد مؤتمت + رابط
  if (item && score >= MEDIUM_MATCH_THRESHOLD) {
    return {
      reply: buildMediumMatchReply(item),
      actionCard: suggestedCard || null
    };
  }

  // 6) أقل من 0.65 → إجابة من واجهة الذكاء الاصطناعي فقط، بدون روابط
  const aiAnswer = await callGemini({
    userMessage,
    intentId,
    language,
    dialectHint,
    toneHint
  });

  if (aiAnswer) {
    // اختيار البطاقة بناءً على النية الثمانية
    if (intentId === "buy_service") {
      actionCard = "bot_lead";
    } else if (intentId === "collaboration") {
      actionCard = "collaboration";
    } else if (intentId === "subscribe") {
      actionCard = "subscribe";
    } else if (intentId === "improve_business") {
      actionCard = "business_subscribe";
    } else {
      actionCard = suggestedCard || null;
    }

    return {
      reply: aiAnswer,
      actionCard
    };
  }

  // 7) في حال فشل الذكاء الاصطناعي أيضًا → رد تحفيزي/افتراضي
  return {
    reply: buildNoMatchReply(),
    actionCard: null
  };
}
