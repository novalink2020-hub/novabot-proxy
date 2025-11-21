// ===========================================
// novaBrainSystem.js
// دماغ نوفا بوت الهجين: (نوايا + معرفة + Gemini + ردود مؤتمتة v4.8)
// By Mohammed Abu Snaina – NOVALINK.AI
// ===========================================

import { GoogleGenerativeAI } from "@google/generative-ai";

/* ================= إعدادات عامة ================= */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const KNOWLEDGE_JSON_URL = process.env.KNOWLEDGE_JSON_URL || "";

const STRONG_MATCH_THRESHOLD = 0.8;
const MEDIUM_MATCH_THRESHOLD = 0.65;

const MAX_OUTPUT_TOKENS = 400;

let knowledgeCache = null;
let knowledgeLoadedAt = 0;
const KNOWLEDGE_TTL_MS = 12 * 60 * 60 * 1000;

/* =====================================================
   أدوات مساعدة للنصوص
===================================================== */

function escapeHtml(str = "") {
  return str.replace(/[&<>"]/g, (c) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c;
  });
}

function escapeAttr(str = "") {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

function normalizeText(str = "") {
  return str
    .toLowerCase()
    .replace(/[.,!?؟،"“”()\-_:;«»]/g, " ")
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

/* =====================================================
   تحميل قاعدة المعرفة
===================================================== */

function normalizeItem(item) {
  if (!item) return null;
  return {
    title: (item.title || "").trim(),
    url: (item.url || "").trim(),
    description: (item.description || "").trim(),
    excerpt: (item.excerpt || "").trim()
  };
}

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
    if (!res.ok) throw new Error("Knowledge JSON HTTP " + res.status);

    const json = await res.json();
    const cleaned = Array.isArray(json)
      ? json.map(normalizeItem).filter((x) => x && x.title && x.url)
      : [];

    knowledgeCache = cleaned;
    knowledgeLoadedAt = now;

    console.log("📘 Knowledge loaded. Items:", cleaned.length);
    return cleaned;

  } catch (err) {
    console.error("❌ Failed to load knowledge JSON:", err);
    knowledgeCache = [];
    knowledgeLoadedAt = now;
    return [];
  }
}

function findBestMatch(question, items) {
  const qTokens = tokenize(question);
  if (!qTokens.size) return { score: 0, item: null };

  let bestScore = 0;
  let bestItem = null;

  for (const item of items) {
    const combined =
      (item.title || "") +
      " " +
      (item.description || "") +
      " " +
      (item.excerpt || "");

    const tTokens = tokenize(combined);
    let common = 0;

    qTokens.forEach((t) => {
      if (tTokens.has(t)) common++;
    });

    const score = common / Math.max(3, qTokens.size);

    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  return { score: bestScore, item: bestItem };
}

/* =====================================================
   الردود المؤتمتة — نسخة 4.8
===================================================== */

const genericReplies = [
  `👋 أهلاً بك في نوفا لينك، حيث نؤمن أن الذكاء الاصطناعي ليس تقنية فقط، بل رحلة لاكتشاف قدراتك من جديد.<br>
   ابدأ بخطوة بسيطة… وتذكّر أن كل فكرة صغيرة قد تصنع تحولًا كبيرًا.<br>
   🔗 <a href="https://novalink-ai.com/ashtrk-alan" target="_blank" class="nova-link">ابدأ من هنا</a>`,

  `🌟 ربما تبحث عن بداية جديدة أو إلهام يعيد شغفك.<br>
   أنصحك بقراءة قصتي في "رحلة فردية في عالم الذكاء الاصطناعي"، فهي تذكير بأن الشغف أقوى من التخصص.<br>
   🔗 <a href="https://novalink-ai.com/rhlh-frdyh-fy-aalm-althkaa-alastnaay-hktha-bdat-nwfa-lynk" target="_blank" class="nova-link">اقرأ القصة هنا</a>`,

  `🤖 لا تحتاج أن تكون خبيرًا لتبدأ مع الذكاء الاصطناعي، كل ما تحتاجه هو فضول صغير وخطوة جريئة.<br>
   نوفا لينك صُممت لتكون دليلك العملي خطوة بخطوة نحو استخدام الأدوات الذكية في حياتك وأعمالك.<br>
   🔗 <a href="https://novalink-ai.com/blog-adwat-althkaa-alastnaay-llaamal" target="_blank" class="nova-link">استكشف الأدوات</a>`,

  `✨ أحيانًا لا تحتاج إلى إجابة، بل إلى تذكير بسيط بأنك على الطريق الصحيح.<br>
   استمر… وتذكّر أن الذكاء الاصطناعي ليس بديلًا لك، بل امتداد لقدرتك على الإنجاز.<br>
   🔗 <a href="https://novalink-ai.com/about-us-althkaa-alastnaay" target="_blank" class="nova-link">تعرّف على رؤيتنا</a>`,

  `🚀 الذكاء الاصطناعي لا ينتظر أحدًا… لكنه دائمًا يفتح الباب لمن يطرق بثقة.<br>
   اكتشف كيف يمكن لأدوات بسيطة أن تختصر وقتك وتضاعف نتائجك.<br>
   🔗 <a href="https://novalink-ai.com/blog-adwat-althkaa-alastnaay-llaamal" target="_blank" class="nova-link">ابدأ رحلتك الآن</a>`,

  `🌙 قبل أن تغادر… تذكّر أن كل إنجاز يبدأ بسؤال بسيط ورغبة في التعلّم.<br>
   اسمح لنفسك أن تتقدّم خطوة كل يوم — فالعالم لا ينتظر، لكنه يكافئ من يواصل المسير بثبات وثقة.<br>
   🔗 <a href="https://novalink-ai.com/althkaa-alastnaay-yuayd-tshkyl-almstqbl-hl-wzyftk-fy-aman" target="_blank" class="nova-link">اقرأ ما يلهمك اليوم</a>`
];

function getRandomGenericReply() {
  return genericReplies[Math.floor(Math.random() * genericReplies.length)];
}

function buildNoMatchReply() {
  return `💬 يبدو أن سؤالك يفتح بابًا جديدًا لم نكتب عنه بعد في نوفا لينك،<br>
  لكننا نُرحّب دائمًا بالأفكار التي تُلهمنا لموضوعات قادمة.<br>
  شاركنا الزاوية التي تهمك… فقد تكون هي التدوينة التالية ✨<br>
  🔗 <a href="https://novalink-ai.com/about-us-althkaa-alastnaay" target="_blank" class="nova-link">عن نوفا لينك</a>`;
}

/* =====================================================
   ردود التطابق مع المعرفة
===================================================== */

function buildStrongMatchReply(item) {
  return (
    `💬 يبدو أن سؤالك يلامس موضوعًا تناولناه بعنوان:<br>` +
    `“${escapeHtml(item.title)}”.<br>` +
    `🔗 <a href="${escapeAttr(item.url)}" target="_blank" class="nova-link">اقرأ المقال</a>`
  );
}

function buildMidMatchTemplateReply(item) {
  return (
    `💬 سؤالك قريب من فكرة ناقشناها بعنوان:<br>` +
    `“${escapeHtml(item.title)}”.<br>` +
    `🔗 <a href="${escapeAttr(item.url)}" target="_blank" class="nova-link">فتح المقال</a>`
  );
}

function wrapAiAnswerWithLink(aiText, item) {
  const safeAi = escapeHtml(aiText).replace(/\n/g, "<br>");
  return (
    safeAi +
    `<br><br>🔗 <a href="${escapeAttr(item.url)}" target="_blank" class="nova-link">مقال ذو صلة</a>`
  );
}

/* =====================================================
   إعداد Gemini — الموديلات الجديدة الصحيحة
===================================================== */

let genAI = null;
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

// موديلات Google المدعومة
const MODELS_TO_TRY = [
  "gemini-2.0-flash",
  "gemini-2.0-pro",
  "gemini-1.0-pro"
];

function buildGeminiPrompt(userText, analysis, bestItem) {
  const lang = analysis.language === "en" ? "English" : "Arabic";

  let base = `السؤال:\n"${userText}"\n\n`;

  if (bestItem) {
    base += `مقال ذو صلة:\n`;
    base += `العنوان: ${bestItem.title}\n`;
    if (bestItem.description) base += `الوصف: ${bestItem.description}\n`;
    if (bestItem.excerpt) base += `مقتطف: ${bestItem.excerpt}\n`;
  }

  base += `\nاللغة المطلوبة: ${lang}.\n`;
  base += `قدّم إجابة قصيرة، عملية، ومنظّمة.\n`;

  return base;
}

async function callGemini(userText, analysis, bestItem = null) {
  if (!genAI || !GEMINI_API_KEY) {
    console.log("⚠️ Gemini disabled or missing key.");
    return null;
  }

  const prompt = buildGeminiPrompt(userText, analysis, bestItem);

  const generationConfig = {
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    temperature: 0.6,
    topP: 0.9
  };

  for (const modelName of MODELS_TO_TRY) {
    try {
      console.log("🔎 Trying Gemini model:", modelName);

      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction:
          "أنت نوفا بوت. أجب بجُمل قصيرة، وركّز على الفائدة العملية."
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

      const text =
        result?.response?.text?.() ||
        result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "";

      if (text.trim().length > 2) {
        console.log("✅ Gemini success:", modelName);
        return text.trim();
      }

    } catch (err) {
      console.log("🔥 Gemini error on", modelName, "→", err.message);
      continue;
    }
  }

  console.log("⚠️ Gemini full fallback → Automated reply.");
  return buildAutomatedFallbackReply(userText);
}

/* =====================================================
   منطق الرد النهائي
===================================================== */

function shouldUseAI(intentId) {
  if (!intentId) return true;
  if (intentId === "casual" || intentId === "subscribe" || intentId === "collaboration") {
    return false;
  }
  return true;
}

export async function novaBrainSystem(request = {}) {
  const userText =
    (request.message || request.userMessage || request.text || "").trim();

  const intentId = request.intentId || "explore";

  if (!userText) {
    return {
      reply: getRandomGenericReply(),
      actionCard: null
    };
  }

  const kb = await loadKnowledgeBase();
  const { score, item } = kb.length
    ? findBestMatch(userText, kb)
    : { score: 0, item: null };

  // تطابق قوي
  if (item && score >= STRONG_MATCH_THRESHOLD) {
    return {
      reply: buildStrongMatchReply(item),
      actionCard: request.suggestedCard || null
    };
  }

  // تطابق متوسط
  if (item && score >= MEDIUM_MATCH_THRESHOLD) {
    let replyHtml;

    if (shouldUseAI(intentId)) {
      const aiText = await callGemini(userText, request, item);
      replyHtml = aiText
        ? wrapAiAnswerWithLink(aiText, item)
        : buildMidMatchTemplateReply(item);
    } else {
      replyHtml = buildMidMatchTemplateReply(item);
    }

    return {
      reply: replyHtml,
      actionCard: request.suggestedCard || null
    };
  }

  // لا يوجد تطابق
  if (shouldUseAI(intentId)) {
    const aiText = await callGemini(userText, request, null);
    if (aiText) {
      return {
        reply: escapeHtml(aiText).replace(/\n/g, "<br>"),
        actionCard: request.suggestedCard || null
      };
    }
  }

  return {
    reply: getRandomGenericReply(),
    actionCard: request.suggestedCard || null
  };
}
