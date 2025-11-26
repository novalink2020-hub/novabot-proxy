// ===========================================
// novaBrainSystem.js – NovaBrainSystem PRO
// دماغ نوفا بوت الهجين: (نوايا + معرفة + Gemini + ردود مؤتمتة + بطاقة المطوّر)
// By Mohammed Abu Snaina – NOVALINK.AI
// ===========================================

import { GoogleGenerativeAI } from "@google/generative-ai";

/* ================= إعدادات عامة ================= */

// مفتاح Gemini من متغيّرات البيئة على Render
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// هذا الـ JSON يكون ناتج دمج: sitemap + ملف Google Drive عبر generate-knowledge-v4.js
const KNOWLEDGE_JSON_URL = process.env.KNOWLEDGE_JSON_URL || "";

// عتبات التطابق مع قاعدة المعرفة
const STRONG_MATCH_THRESHOLD = 0.8; // تطابق قوي
const MEDIUM_MATCH_THRESHOLD = 0.65; // تطابق متوسط

// 🔹 الحد الأقصى لطول إجابة Gemini (توكنز وليس حروف)
// حسب طلبك: 200 توكن لكل إجابة – حتى في التوضيحات اللاحقة
const MAX_OUTPUT_TOKENS = 200;

// كاش للمعرفة
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

// تبسيط النص (حذف علامات وترتيب مسافات) لغايات المطابقة
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

/* =============== تحميل قاعدة المعرفة =============== */

// توحيد شكل عناصر المعرفة القادمة من knowledge.v4.json
function normalizeItem(item) {
  if (!item) return null;
  return {
    title: (item.title || "").trim(),
    url: (item.url || "").trim(),
    description: (item.description || "").trim(),
    excerpt: (item.excerpt || "").trim()
  };
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
    const cleaned = Array.isArray(json)
      ? json
          .map(normalizeItem)
          .filter((x) => x && x.title && x.url)
      : [];

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

// إيجاد أقرب تدوينة لسؤال المستخدم
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

    const score = common / Math.max(3, qTokens.size);
    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  return { score: bestScore, item: bestItem };
}

/* =============== ردود مؤتمتة عامة (روح نوفا لينك) =============== */

// 🔸 هذه الردود التحفيزية العامة – كما في النسخة السابقة (مع حرية تعديل الروابط لاحقًا)
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

// اختيار رد تحفيزي عشوائي
function getRandomGenericReply() {
  const idx = Math.floor(Math.random() * genericReplies.length);
  return genericReplies[idx];
}

// رد عند عدم وجود تطابق كافٍ مع المعرفة
function buildNoMatchReply() {
  return `
  يبدو أن سؤالك يفتح بابًا جديدًا لم نكتب عنه بعد في نوفا لينك،
  لكننا نُرحّب دائمًا بالأفكار الجديدة التي تُلهمنا لموضوعات قادمة.<br>
  شاركنا الزاوية التي تهمك أكثر، فربما تكون هي موضوع التدوينة التالية ✨<br>
  🔗 <a href="https://novalink-ai.com/about-us-althkaa-alastnaay" target="_blank" class="nova-link">تعرّف على أهداف نوفا لينك</a>`;
}

/* =============== ردود التطابق مع المعرفة =============== */

// تطابق قوي – نكتفي بتوجيه المستخدم للمقال المناسب
function buildStrongMatchReply(item) {
  const safeTitle = escapeHtml(item.title || "");
  const safeUrl = escapeAttr(item.url || "#");

  return `
  📌 يبدو أن سؤالك يلامس موضوعًا تناولناه في نوفا لينك بعنوان:<br>
  “${safeTitle}”.<br><br>
  هذه التدوينة كُتبت لتقدّم إجابة مركّزة حول هذا النوع من الأسئلة.<br>
  🔗 <a href="${safeUrl}" target="_blank" class="nova-link">اقرأ المقال على نوفا لينك</a>`;
}

// تطابق متوسط – يمكن استخدامه مع Gemini أو وحده
function buildMidMatchTemplateReply(item) {
  const safeTitle = escapeHtml(item.title || "");
  const safeUrl = escapeAttr(item.url || "#");

  return `
  سؤالك قريب من فكرة ناقشناها في نوفا لينك بعنوان:<br>
  “${safeTitle}”.<br><br>
  قد لا تكون الإجابة طبق الأصل عمّا في ذهنك، لكنها ستفتح لك زاوية تفكير أوسع حول الموضوع.<br>
  🔗 <a href="${safeUrl}" target="_blank" class="nova-link">اقرأ المقال</a>`;
}

// دمج إجابة Gemini مع رابط التدوينة
function wrapAiAnswerWithLink(aiText, item) {
  const safeUrl = escapeAttr(item.url || "#");
  const safeAi = escapeHtml(aiText).replace(/\n/g, "<br>");

  return `
  ${safeAi}<br><br>
  🔗 <a href="${safeUrl}" target="_blank" class="nova-link">
    تعمّق أكثر من خلال هذه التدوينة على نوفا لينك
  </a>`;
}

/* =============== إعداد Gemini =============== */

// تهيئة عميل Gemini فقط عند وجود المفتاح
let genAI = null;
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

// موديلات Google المدعومة (واجهات v1 الرسمية)
// ✅ حسب طلبك: لا نستخدم غيرها
const MODELS_TO_TRY = [
  "gemini-2.0-flash",
  "gemini-2.0-pro",
  "gemini-1.0-pro"
];

// بناء الـ Prompt المرسل إلى Gemini
function buildGeminiPrompt(userText, analysis, bestItem, isFollowup = false) {
  const lang = analysis.language === "en" ? "en" : "ar";
  const intentId = analysis.intentId || "explore";

  let base = "";

  // شرح للسؤال
  base += `User question / سؤال المستخدم:\n"${userText}"\n\n`;

  // تمرير جزء من المعرفة عند وجود تدوينة قريبة
  if (bestItem) {
    base += `Context from NovaLink blog (may be relevant):\n`;
    base += `Title: ${bestItem.title}\n`;
    if (bestItem.description) base += `Description: ${bestItem.description}\n`;
    if (bestItem.excerpt) base += `Excerpt: ${bestItem.excerpt}\n`;
    base += `Use this as supportive context. Do NOT just summarize it.\n\n`;
  }

  // معلومات تحليل النية واللغة
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

// استدعاء Gemini مع احترام الحد الأقصى 200 توكن
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

      // 🔒 ضمان نهاية لطيفة تكمل الإجابة ولا توحي أنها انقطعت
      const safeEnding =
        lang === "en"
          ? " If you’d like a deeper explanation on a specific part, just ask me to go deeper on it."
          : " وإذا احتجت توضيحًا أعمق في نقطة معيّنة، اطلب مني أن أتعمّق فيها أكثر.";

      // نتأكد ألا نكرر جملة النهاية لو النموذج أنتج شيئًا مشابهًا
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

// رد احتياطي لو فشل استدعاء Gemini
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
/**
 * سياسة واضحة:
 * - فقط intentId === "ai_business" يستدعي Gemini.
 * - أي intent آخر → ردود ثابتة، بدون تكلفة توكنز.
 */
function shouldUseAI(intentId) {
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
  return `نوفا لينك منفتحة على التعاونات المهنية الجادة المرتبطة بالذكاء الاصطناعي للأعمال وتطوير novaBrainSystem.js.<br><br>
يمكن أن يكون التعاون على شكل رعاية محتوى، ورش عمل، ندوات مشتركة، أو مشاريع رقمية تخدم روّاد الأعمال.<br><br>
يمكنك استخدام بطاقة التعاون الظاهرة أو مراسلتنا مباشرة:<br>
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

// تعريف نوفا لينك / القصة / الرؤية / الرسالة
function buildNovaLinkInfoReply() {
  return `نوفا لينك (NOVALINK Ai) هي مساحة عربية صُممت لتكون جسرًا بين روّاد الأعمال والذكاء الاصطناعي.<br><br>
بدأت الفكرة كرحلة فردية من عالم البنوك إلى عالم الذكاء الاصطناعي، وتحولت تدريجيًا إلى منصة تركّز على ثلاث محاور:<br>
1️⃣ تبسيط أدوات الذكاء الاصطناعي لروّاد الأعمال وأصحاب المشاريع الصغيرة والمتوسطة.<br>
2️⃣ تقديم محتوى عملي يمكن تطبيقه مباشرة في العمل، بعيدًا عن النظريات المعقدة.<br>
3️⃣ بناء مجتمع عربي يرى في الذكاء الاصطناعي "موظفًا ذكيًا" يضيف لقيمته، لا بديلًا عنه.<br><br>
🔗 <a href="https://novalink-ai.com/about-us-althkaa-alastnaay" target="_blank" class="nova-link">من نحن – نوفا لينك</a><br>
🔗 <a href="https://novalink-ai.com/rhlh-frdyh-fy-aalm-althkaa-alastnaay-hktha-bdat-nwfa-lynk" target="_blank" class="nova-link">رحلتي مع نوفا لينك</a>`;
}

// تعريف نوفا بوت نفسه
function buildNovaBotInfoReply() {
  return `🤖 نوفا بوت هو مساعد دردشة ذكي من منصة نوفا لينك،<br>
مهمته التركيز على كل ما يتقاطع بين الذكاء الاصطناعي وتطوير الأعمال والمشاريع.<br><br>
نوفا بوت لا يهدف للإجابة عن كل شيء في العالم، بل عن الأسئلة التي تساعدك على:<br>
- فهم أدوات الذكاء الاصطناعي وكيف توظّفها في مشروعك.<br>
- استكشاف أفكار لتطوير عملك وزيادة الإنتاجية.<br>
- التعرّف على محتوى نوفا لينك المناسب لسؤالك.<br><br>
كلما كان سؤالك مرتبطًا بالـ AI والبزنس، أصبح نوفا بوت أدق وأقرب لما تحتاجه فعلاً.`;
}

// ردود الوداع / المغادرة
function buildGoodbyeReply() {
  return `سعيد بهذه الجولة من الحوار معك 🌱<br>
أتمنّى أن تكون فكرة واحدة على الأقل قد فتحت لك زاوية جديدة للتفكير أو العمل.<br><br>
نوفا بوت سيبقى هنا عندما تعود… ومع كل زيارة، يمكن أن نضيف طبقة جديدة لمسارك مع الذكاء الاصطناعي والأعمال.`;
}

// كشف كلمات دالة على الوداع بدون تعديل ملف النوايا
function isGoodbyeMessage(text = "") {
  const t = (text || "").toLowerCase();
  const arabicBye = ["مع السلامة", "سلام", "أراك لاحقًا", "اشوفك", "اشوفكم", "الى اللقاء", "إلى اللقاء", "وداعا", "وداعًا", "خلص شكرا", "يكفي شكرا"];
  const englishBye = ["bye", "goodbye", "see you", "see ya", "see u", "thanks bye"];

  return (
    arabicBye.some((kw) => t.includes(kw)) ||
    englishBye.some((kw) => t.includes(kw))
  );
}

/* =============== بطاقة المطوّر – الكود السري 10406621 =============== */

// التحقق من تفعيل بطاقة المطوّر عبر الكلمة السرّية
function hasDeveloperCode(text = "") {
  return (text || "").includes("10406621");
}

// رد بطاقة المطوّر بالعربية
function buildDeveloperCardReplyAr() {
  return `👨‍💻 هذه لمحة عن الشخص الذي درّب نوفا بوت وبنى نوفا لينك:<br><br>
- صانع محتوى ومدوّن عربي انتقل من عالم البنوك إلى عالم الذكاء الاصطناعي للأعمال.<br>
- يبني نوفا لينك كمساحة عملية تساعد روّاد الأعمال على فهم الأدوات الذكية واستخدامها بخطوات واضحة.<br>
- يؤمن أن الذكاء الاصطناعي ليس تهديدًا للوظائف بقدر ما هو فرصة لإعادة تعريف دورنا في العمل.<br><br>
هذه البطاقة موجودة خصيصًا لمن يهتم بمن يقف خلف الكواليس، لا فقط بما يقدّمه البوت ✨`;
}

// رد بطاقة المطوّر بالإنجليزية
function buildDeveloperCardReplyEn() {
  return `👨‍💻 Here’s a quick snapshot of the person behind NovaBot and NovaLink:<br><br>
- An Arabic content creator and blogger who moved from the banking world into AI for business.<br>
- Building NovaLink as a practical space to help entrepreneurs use AI tools step by step, not just read about them.<br>
- Believes AI is less of a job threat and more of a chance to redefine our role and value at work.<br><br>
This card is for those who care about the human behind the system, not just the answers on the screen ✨`;
}

/* =============== واجهة الدماغ الرئيسية =============== */
/**
 * request متوقع أن يحتوي على:
 * {
 *   message,        // نص سؤال المستخدم
 *   intentId,       // نية المستخدم من novaIntentDetector
 *   confidence,
 *   language,       // "ar" أو "en"
 *   dialectHint,
 *   toneHint,
 *   suggestedCard   // اقتراح بطاقة من كاشف النوايا
 * }
 */
export async function novaBrainSystem(request = {}) {
  const userText = (request.message || request.userMessage || request.text || "").trim();
  const intentId = request.intentId || "explore";
  const language = request.language === "en" ? "en" : "ar";

  // لو لم يرسل المستخدم شيئًا واضحًا → رد تحفيزي عام
  if (!userText) {
    return {
      reply: getRandomGenericReply(),
      actionCard: null
    };
  }

  // ==============================
  // 0) بطاقة المطوّر (10406621)
  // ==============================
  if (hasDeveloperCode(userText)) {
    const reply =
      language === "en" ? buildDeveloperCardReplyEn() : buildDeveloperCardReplyAr();

    // ✅ الواجهة الأمامية ستتعامل مع "developer_identity" بإظهار بطاقة مصممة بنفس ستايل البطاقات الأخرى
    return {
      reply,
      actionCard: "developer_identity"
    };
  }

  // ==============================
  // 0.5) كشف الوداع / المغادرة (خارج ملف النوايا)
  // ==============================
  if (isGoodbyeMessage(userText)) {
    return {
      reply: buildGoodbyeReply(),
      actionCard: null
    };
  }

  // ==============================
  // 1) معالجة النوايا الثابتة أولاً
  // ==============================

  // ترحيب
  if (intentId === "greeting") {
    return {
      reply: buildGreetingReply(),
      actionCard: null
    };
  }

  // شكر / إيجابية
  if (intentId === "thanks_positive") {
    return {
      reply: buildThanksPositiveReply(),
      actionCard: request.suggestedCard || "subscribe"
    };
  }

  // مزاج سلبي
  if (intentId === "negative_mood") {
    return {
      reply: buildNegativeMoodReply(),
      actionCard: null
    };
  }

  // اشتراك / نشرة
  if (intentId === "subscribe_interest") {
    return {
      reply: buildSubscribeInterestReply(),
      actionCard: request.suggestedCard || "subscribe"
    };
  }

  // تعاون / شراكة
  if (intentId === "collaboration") {
    return {
      reply: buildCollaborationReply(),
      actionCard: request.suggestedCard || "collaboration"
    };
  }

  // استشارة / شراء خدمة
  if (intentId === "consulting_purchase") {
    return {
      reply: buildConsultingPurchaseReply(),
      actionCard: request.suggestedCard || "bot_lead"
    };
  }

  // تعريف نوفا لينك / نوفا بوت (info/story/services)
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

  // خارج نطاق الذكاء الاصطناعي والأعمال → رد تحفيزي من الردود العامة
  if (intentId === "out_of_scope") {
    return {
      reply: getRandomGenericReply(),
      actionCard: null
    };
  }

  // نوايا عشوائية أو "casual" → نعاملها كرسالة تحفيزية عامة
  if (intentId === "casual") {
    return {
      reply: getRandomGenericReply(),
      actionCard: null
    };
  }

  // ==============================
  // 2) نية الذكاء الاصطناعي وتطوير الأعمال ONLY
  // ==============================

  // قاعدة: فقط ai_business يستدعي Gemini
  if (intentId === "ai_business" && shouldUseAI(intentId)) {
    // 2-أ) فحص إن كانت الرسالة طلب متابعة / توضيح أعمق
    const lower = userText.toLowerCase();
    const followupAr = ["أكمل", "تابع", "وضّح أكثر", "وضح أكثر", "تفاصيل أكثر"];
    const followupEn = ["continue", "more", "explain", "details", "go deeper"];

    const isFollowup =
      followupAr.some((kw) => userText.includes(kw)) ||
      followupEn.some((kw) => lower.includes(kw));

    // 2-ب) تحميل المعرفة ومحاولة إيجاد أقرب تدوينة
    const kb = await loadKnowledgeBase();
    let bestMatch = { score: 0, item: null };

    if (kb.length) {
      bestMatch = findBestMatch(userText, kb);
    }

    const { score, item } = bestMatch;

    // 2-ج) إذا كان التطابق قويًا → رد مؤتمت مع رابط فقط (بدون Gemini)
    if (item && score >= STRONG_MATCH_THRESHOLD && !isFollowup) {
      const replyHtml = buildStrongMatchReply(item);
      return {
        reply: replyHtml,
        actionCard: request.suggestedCard || null
      };
    }

    // 2-د) تطابق متوسط → نحاول Gemini + رابط، أو قالب مؤتمت
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

    // 2-هـ) لا يوجد تطابق كافٍ أو لا توجد معرفة
    // → نحاول Gemini بدون ربط بمقال معيّن
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

  // ==============================
  // 3) أي شيء لم يتم التقاطه صراحةً
  //     → نتعامل معه كخارج النطاق
  // ==============================
  return {
    reply: getRandomGenericReply(),
    actionCard: null
  };
}
