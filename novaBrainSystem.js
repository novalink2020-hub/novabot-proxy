// ===========================================
// novaBrainSystem.js
// دماغ نوفا بوت الهجين: (نوايا + معرفة + Gemini + ردود مؤتمتة)
// By Mohammed Abu Snaina – NOVALINK.AI
// ===========================================

import { GoogleGenerativeAI } from "@google/generative-ai";

/* ================= إعدادات عامة ================= */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const KNOWLEDGE_JSON_URL = process.env.KNOWLEDGE_JSON_URL || "";

// عتبات التطابق مع قاعدة المعرفة
const STRONG_MATCH_THRESHOLD = 0.8;  // تطابق قوي
const MEDIUM_MATCH_THRESHOLD = 0.65; // تطابق متوسط

// حد تقريبي لطول الإجابة من Gemini (توكنز)
const MAX_OUTPUT_TOKENS = 256; // تقليل استهلاك التوكنز

// حد نصّي إضافي (حماية) – تقريبًا 1400 حرف
const MAX_OUTPUT_CHARS = 1400;

// كاش للمعرفة
let knowledgeCache = null;
let knowledgeLoadedAt = 0;
const KNOWLEDGE_TTL_MS = 12 * 60 * 60 * 1000; // 12 ساعة

/* =============== أدوات مساعدة للنصوص =============== */

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

function truncateText(text = "", maxChars = MAX_OUTPUT_CHARS) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "…";
}

/* =============== تحميل قاعدة المعرفة =============== */

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
    if (!res.ok) {
      throw new Error("Knowledge JSON HTTP " + res.status);
    }
    const json = await res.json();
    const cleaned = Array.isArray(json)
      ? json.map(normalizeItem).filter((x) => x && x.title && x.url)
      : [];
    knowledgeCache = cleaned;
    knowledgeLoadedAt = Date.now();
    console.log("📘 Knowledge loaded. Items:", cleaned.length);
    return cleaned;
  } catch (err) {
    console.error("❌ Failed to load knowledge JSON:", err);
    knowledgeCache = [];
    knowledgeLoadedAt = Date.now();
    return [];
  }
}

function findBestMatch(question, items) {
  if (!question || !items || !items.length) {
    return { score: 0, item: null };
  }

  const qTokens = tokenize(question);
  if (!qTokens.size) return { score: 0, item: null };

  let bestItem = null;
  let bestScore = 0;

  for (const item of items) {
    const combined =
      (item.title || "") +
      " " +
      (item.description || "") +
      " " +
      (item.excerpt || "");

    const tTokens = tokenize(combined);
    if (!tTokens.size) continue;

    let common = 0;
    qTokens.forEach((t) => {
      if (tTokens.has(t)) common++;
    });

    // معيار بسيط: نسبة التداخل إلى حجم سؤال المستخدم
    const score = common / Math.max(3, qTokens.size);
    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  return { score: bestScore, item: bestItem };
}

/* =============== ردود مؤتمتة عامة (روح v4.8) =============== */

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
  const idx = Math.floor(Math.random() * genericReplies.length);
  return genericReplies[idx];
}

function buildNoMatchReply() {
  return `💬 يبدو أن سؤالك يفتح بابًا جديدًا لم نكتب عنه بعد في نوفا لينك،<br>
  لكننا نُرحّب دائمًا بالأفكار الجديدة التي تُلهمنا لموضوعات قادمة.<br>
  شاركنا الزاوية التي تهمك أكثر، فربما تكون هي موضوع التدوينة التالية ✨<br>
  🔗 <a href="https://novalink-ai.com/about-us-althkaa-alastnaay" target="_blank" class="nova-link">تعرّف على أهداف نوفا لينك</a>`;
}

/* =============== ردود مؤتمتة خاصة بالنوايا =============== */

// ترحيب
function buildGreetingReply() {
  return `👋 أهلاً وسهلاً بك في نوفا لينك!<br>
  أنا نوفا بوت، مساعدك الذكي لمساعدتك في فهم واستخدام أدوات الذكاء الاصطناعي في أعمالك وحياتك العملية.<br>
  يمكنك أن تسألني مثلاً:<br>
  • كيف أستخدم الذكاء الاصطناعي لتسويق مشروعي؟<br>
  • ما هي أفضل أدوات الذكاء الاصطناعي لكتابة المحتوى؟<br>
  • كيف أبدأ رحلتي مع الذكاء الاصطناعي من الصفر؟`;
}

// شكر / كلام إيجابي
function buildPositiveReply() {
  return `💛 يسعدني أنّ الرد كان مفيدًا لك!<br>
  هذا بالضبط هدف نوفا لينك: أن نحوّل الذكاء الاصطناعي من فكرة مبهمة إلى أداة عملية بين يديك.<br>
  إذا أحببت التجربة، فكر أن تجعل نوفا لينك جزءًا من روتينك الأسبوعي في تطوير عملك ومهاراتك.`;
}

// شكوى / كلام سلبي
function buildNegativeReply() {
  return `🙏 شكرًا على صراحتك…<br>
  أقدّر ملاحظتك، وهذا النوع من التغذية الراجعة يساعدنا على تحسين نوفا بوت ومحتوى نوفا لينك.<br>
  جرّب أن توضّح أكثر ما الذي كنت تتوقعه من الإجابة، وسأحاول أن أقدّم لك زاوية أكثر فائدة وواقعية.`;
}

// تعريف نوفا لينك: رؤية + رسالة + هدف
function buildAboutNovaLinkReply() {
  return `
  🛰️ ما هي نوفا لينك؟<br><br>
  نوفا لينك هي مدونة عربية متخصصة في الذكاء الاصطناعي للأعمال والإنتاجية،<br>
  وُلدت من تجربة شخصية حقيقية لشخص يعمل في مجال البنوك وخدمة العملاء، قرر أن يحوّل فضوله حول الذكاء الاصطناعي إلى مشروع يساعد الآخرين.<br><br>

  🎯 الرؤية:<br>
  أن تكون نوفا لينك "رابطك الذكي للمستقبل"؛ المكان الذي يترجِم عالم الذكاء الاصطناعي المعقد إلى خطوات بسيطة يمكن تطبيقها في مشروعك ووظيفتك وحياتك اليومية.<br><br>

  🧭 الرسالة:<br>
  تقديم محتوى عربي عملي، بعيد عن الضجيج، يركّز على:<br>
  • أدوات ذكاء اصطناعي حقيقية تستطيع خدمتك الآن.<br>
  • طرق استخدام هذه الأدوات في التسويق، المحتوى، خدمة العملاء، وتنظيم العمل.<br>
  • قصص وتجارب حقيقية تساعدك أن ترى نفسك داخل الصورة، لا على الهامش.<br><br>

  🎯 الهدف من نوفا لينك:<br>
  • مساعدة رواد الأعمال والموظفين والمهتمين بالتطوير الشخصي على استغلال الذكاء الاصطناعي في زيادة الإنتاجية وتقليل الهدر.<br>
  • بناء جسر بين "العربي الفضولي" و"أدوات الذكاء الاصطناعي" بلغة مفهومة وإنسانية.<br><br>

  📖 قصة النشأة باختصار:<br>
  بدأت نوفا لينك كرحلة فردية للبحث عن معنى جديد للعمل خارج الروتين اليومي،<br>
  ومن سؤال بسيط: "كيف يمكن للذكاء الاصطناعي أن يساعدني أنا أولاً؟" تحوّلت الفكرة إلى مشروع رقمي يشارك ما تم اكتشافه مع الآخرين خطوة بخطوة.<br><br>

  🔗 يمكنك التعرّف أكثر على القصة من هنا:<br>
  <a href="https://novalink-ai.com/rhlh-frdyh-fy-aalm-althkaa-alastnaay-hktha-bdat-nwfa-lynk" target="_blank" class="nova-link">رحلة فردية في عالم الذكاء الاصطناعي – هكذا بدأت نوفا لينك</a>
  `;
}

// يمكن فصل قصة النشأة لوحدها لو أحببت لاحقًا
function buildStoryOnlyReply() {
  return `
  📖 قصة نشأة نوفا لينك:<br><br>
  الفكرة بدأت من شخص يعمل في قطاع البنوك وخدمة العملاء، شعر أن العالم يتغيّر بسرعة مع صعود الذكاء الاصطناعي،<br>
  وأن البقاء متفرجًا يعني التأخر سنوات إلى الوراء.<br><br>

  بدأ التعلّم بشكل فردي، تجربة أداة بعد أداة، وفشل بعد فشل، إلى أن ظهرت بذرة نوفا لينك:<br>
  "لماذا لا أشارك ما أتعلمه مع غيري، بدل أن أبقيه حبيس الملاحظات؟".<br><br>

  من هنا جاءت المدونة، ثم نوفا بوت، ثم فكرة تحويل هذه الرحلة إلى مورد عربي مستمر<br>
  يساعد أي شخص عنده شغف بالتطوير، حتى لو لم يكن مبرمجًا أو خبير تقني.<br><br>

  🔗 تفاصيل أكثر في هذه التدوينة:<br>
  <a href="https://novalink-ai.com/rhlh-frdyh-fy-aalm-althkaa-alastnaay-hktha-bdat-nwfa-lynk" target="_blank" class="nova-link">رحلة فردية في عالم الذكاء الاصطناعي – هكذا بدأت نوفا لينك</a>
  `;
}

/* =============== ردود التطابق مع المعرفة =============== */

function buildStrongMatchReply(item) {
  const safeTitle = escapeHtml(item.title || "");
  const safeUrl = escapeAttr(item.url || "#");

  return (
    `💬 يبدو أن سؤالك يلامس موضوعًا تناولناه في نوفا لينك بعنوان:<br>` +
    `“${safeTitle}”.<br>` +
    `هذه التدوينة كُتبت لتقدّم إجابة مركّزة حول هذا النوع من الأسئلة.<br>` +
    `🔗 <a href="${safeUrl}" target="_blank" class="nova-link">اقرأ المقال على نوفا لينك</a>`
  );
}

function buildMidMatchTemplateReply(item) {
  const safeTitle = escapeHtml(item.title || "");
  const safeUrl = escapeAttr(item.url || "#");

  return (
    `💬 سؤالك قريب من فكرة ناقشناها في نوفا لينك بعنوان:<br>` +
    `“${safeTitle}”.<br>` +
    `قد لا تكون الإجابة طبق الأصل عمّا في ذهنك، لكنها ستفتح لك زاوية تفكير أوسع حول الموضوع.<br>` +
    `🔗 <a href="${safeUrl}" target="_blank" class="nova-link">اقرأ المقال</a>`
  );
}

function wrapAiAnswerWithLink(aiText, item) {
  const safeUrl = escapeAttr(item.url || "#");
  const safeAi = escapeHtml(aiText).replace(/\n/g, "<br>");

  return (
    safeAi +
    `<br><br>🔗 <a href="${safeUrl}" target="_blank" class="nova-link">تعمّق أكثر من خلال هذه التدوينة على نوفا لينك</a>`
  );
}

/* =============== إعداد Gemini =============== */

let genAI = null;
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

// الموديلات بناءً على توثيق v1 الحالي
const GEMINI_MODEL_PRIMARY = "gemini-1.5-flash";
const GEMINI_MODEL_FALLBACK = "gemini-1.5-pro";

function buildGeminiPrompt(userText, analysis, bestItem) {
  const lang = analysis.language === "en" ? "en" : "ar";
  const intentId = analysis.intentId || "explore";

  let base = "";

  base += `السؤال من المستخدم:\n"${userText}"\n\n`;

  if (bestItem) {
    base += `هذه بيانات تدوينة من موقع نوفا لينك لها صلة محتملة بالسؤال:\n`;
    base += `العنوان: ${bestItem.title}\n`;
    if (bestItem.description) base += `الوصف: ${bestItem.description}\n`;
    if (bestItem.excerpt) base += `مقتطف من بداية التدوينة: ${bestItem.excerpt}\n`;
    base += `استخدم هذه التدوينة كمرجع مساعد فقط، لا تكتفِ بتلخيصها.\n\n`;
  }

  base += `معلومات عن سياق المستخدم:\n`;
  base += `اللغة المتوقعة للإجابة: ${lang === "en" ? "English" : "Arabic (Modern Standard, friendly)"}.\n`;
  if (analysis.dialectHint && lang !== "en") {
    base += `اللهجة المحتملة: ${analysis.dialectHint}، يمكن إدخال كلمات بسيطة جدًا منها بشكل طبيعي بدون مبالغة.\n`;
  }
  base += `النية التقريبية للمستخدم (intent): ${intentId}.\n\n`;

  base += `تعليمات الأسلوب:\n`;
  base += `- إذا كان المستخدم يكتب بالعربية فأجب بالعربية الفصحى السلسة، مع نكهة بسيطة فقط عند الحاجة.\n`;
  base += `- إذا كان يكتب بالإنجليزية فأجب بإنجليزية واضحة وبسيطة.\n`;
  base += `- كن محترفًا، هادئًا، محفّزًا دون مبالغة أو وعود غير واقعية.\n`;
  base += `- ركّز على النقاط العملية القابلة للتطبيق في الأعمال والإنتاجية متى أمكن.\n`;
  base += `- لا تتجاوز تقريبًا ${MAX_OUTPUT_TOKENS} توكن، واجعل الإجابة مرتبة في فقرات قصيرة.\n`;
  base += `- لا تذكر هذه التعليمات في الإجابة.\n\n`;

  base += `الآن أجب عن سؤال المستخدم بشكل مباشر ومفيد.\n`;

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

  const modelsToTry = [GEMINI_MODEL_PRIMARY, GEMINI_MODEL_FALLBACK];

  for (const modelName of modelsToTry) {
    try {
      console.log("🔎 Trying Gemini model:", modelName);

      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction:
          "أنت نوفا بوت من منصة نوفا لينك. أجب بإيجاز، بأسلوب عربي فصيح عملي، وبلهجة المستخدم عند الحاجة."
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

      const rawText =
        result?.response?.text?.() ||
        result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "";

      const text = truncateText((rawText || "").trim());
      if (text.length > 2) {
        console.log("✅ Gemini success:", modelName);
        return text;
      }
    } catch (err) {
      console.log("🔥 Gemini error on", modelName, "→", err.message);
      continue;
    }
  }

  console.log("⚠️ Gemini full fallback → Automated reply.");
  return buildAutomatedFallbackReply(userText);
}

// =============================
//  Fallback automated replies
// =============================
function buildAutomatedFallbackReply(userText) {
  const fallbackReplies = [
    "💬 يبدو أن سؤالك يفتح بابًا جديدًا لم نكتب عنه بشكل مباشر في نوفا لينك، لكن هذا النوع من الأسئلة يلهمنا دائمًا لمحتوى جديد.",
    "✨ سؤالك يستحق مساحة أكبر مما تسمح به هذه اللحظة، وسنعود له لاحقًا في تدوينة مخصصة.",
    "🤖 يمكنني مساعدتك في أفكار ومقالات قريبة من سؤالك… جرّب إعادة صياغته للحصول على دقة أعلى.",
    "🔍 لم أجد إجابة دقيقة الآن، لكن يمكنني اقتراح أكثر مقالات نوفا لينك ارتباطًا بالموضوع."
  ];

  return fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
}

/* =============== منطق استخدام AI =============== */

function shouldUseAI(intentId) {
  if (!intentId) return true;

  // حالات لا نستخدم فيها Gemini إطلاقًا
  if (
    intentId === "casual" ||
    intentId === "subscribe" ||
    intentId === "collaboration" ||
    intentId === "greeting" ||
    intentId === "praise" ||
    intentId === "complaint" ||
    intentId === "about_novalink" ||
    intentId === "about_story" ||
    intentId === "out_of_scope"
  ) {
    return false;
  }

  return true;
}

/**
 * واجهة الدماغ الرئيسية
 */
export async function novaBrainSystem(request = {}) {
  const userText =
    (request.message || request.userMessage || request.text || "").trim();

  const intentId = request.intentId || "explore";
  const language = request.language || "ar";

  if (!userText) {
    return {
      reply: getRandomGenericReply(),
      actionCard: null
    };
  }

  // 0) نوايا خاصة تُعالَج بدون Gemini
  if (intentId === "greeting") {
    return {
      reply: buildGreetingReply(),
      actionCard: null
    };
  }

  if (intentId === "praise") {
    return {
      reply: buildPositiveReply(),
      actionCard: "subscribe" // تشجيع بسيط للاشتراك (بطاقة من الواجهة)
    };
  }

  if (intentId === "complaint") {
    return {
      reply: buildNegativeReply(),
      actionCard: null
    };
  }

  if (intentId === "about_novalink") {
    return {
      reply: buildAboutNovaLinkReply(),
      actionCard: null
    };
  }

  if (intentId === "about_story") {
    return {
      reply: buildStoryOnlyReply(),
      actionCard: null
    };
  }

  if (intentId === "subscribe") {
    // نترك البطاقة الذكية في الواجهة تقوم بدورها
    return {
      reply:
        "📧 يمكنك الاشتراك في قائمة نوفا لينك البريدية لتحصل على خلاصة عملية حول أدوات الذكاء الاصطناعي وتطبيقاتها في الأعمال.\nجرّب إدخال بريدك في البطاقة الظاهرة أسفل هذه الرسالة.",
      actionCard: "subscribe"
    };
  }

  if (intentId === "collaboration") {
    return {
      reply:
        "🤝 يسعد نوفا لينك استقبال أفكار التعاون والشراكات المهنية المرتبطة بالذكاء الاصطناعي للأعمال وتطوير المهارات.\nيمكنك استخدام بطاقة التعاون أسفل هذه الرسالة لإرسال تفاصيل فكرتك.",
      actionCard: "collaboration"
    };
  }

  // أسئلة خارج نطاق تخصص نوفا لينك → لا Gemini، فقط رد تحفيزي عام
  if (intentId === "out_of_scope") {
    return {
      reply: getRandomGenericReply(),
      actionCard: null
    };
  }

  // 1) تحميل المعرفة
  const kb = await loadKnowledgeBase();
  let bestMatch = { score: 0, item: null };

  if (kb.length) {
    bestMatch = findBestMatch(userText, kb);
  }

  const { score, item } = bestMatch;

  // 2) تطابق قوي مع مقالة (> 80%) → رد مؤتمت فقط مع رابط (بدون AI)
  if (item && score >= STRONG_MATCH_THRESHOLD) {
    const replyHtml = buildStrongMatchReply(item);
    return {
      reply: replyHtml,
      actionCard: request.suggestedCard || null
    };
  }

  // 3) تطابق متوسط (65%–80%) → نحاول Gemini + رابط، وإلا قالب مؤتمت مع رابط
  if (item && score >= MEDIUM_MATCH_THRESHOLD && score < STRONG_MATCH_THRESHOLD) {
    let replyHtml;

    if (shouldUseAI(intentId)) {
      const aiText = await callGemini(userText, request, item);
      if (aiText) {
        replyHtml = wrapAiAnswerWithLink(aiText, item);
      } else {
        replyHtml = buildMidMatchTemplateReply(item);
      }
    } else {
      replyHtml = buildMidMatchTemplateReply(item);
    }

    return {
      reply: replyHtml,
      actionCard: request.suggestedCard || null
    };
  }

  // 4) لا يوجد تطابق كافٍ أو لا توجد معرفة
  //    نحاول Gemini إذا مناسب، وإلا نلجأ للردود المؤتمتة المحفّزة
  if (shouldUseAI(intentId)) {
    const aiText = await callGemini(userText, request, null);
    if (aiText) {
      const safe = escapeHtml(aiText).replace(/\n/g, "<br>");
      return {
        reply: safe,
        actionCard: request.suggestedCard || null
      };
    }
  }

  // فول باك كامل → الردود المؤتمتة من روح v4.8
  const fallback =
    intentId === "learn" || intentId === "explore"
      ? getRandomGenericReply()
      : buildNoMatchReply();

  return {
    reply: fallback,
    actionCard: request.suggestedCard || null
  };
}
