// ===========================================
// novaBrainSystem.js
// دماغ نوفا بوت الهجين: (نوايا + معرفة + Gemini + ردود مؤتمتة)
// By Mohammed Abu Snaina – NOVALINK.AI
// ===========================================

import { GoogleGenerativeAI } from "@google/generative-ai";

/* ================= إعدادات عامة ================= */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// هذا الـ JSON يكون ناتج دمج: sitemap + ملف Google Drive عبر generate-knowledge.js
const KNOWLEDGE_JSON_URL = process.env.KNOWLEDGE_JSON_URL || "";

// عتبات التطابق مع قاعدة المعرفة
const STRONG_MATCH_THRESHOLD = 0.8;  // تطابق قوي
const MEDIUM_MATCH_THRESHOLD = 0.65; // تطابق متوسط

// حد تقريبي لطول الإجابة من Gemini (توكنز وليس حروف)
const MAX_OUTPUT_TOKENS = 250;

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

// موديلات Google المدعومة (واجهات v1 الرسمية)
const MODELS_TO_TRY = [
  "gemini-2.0-flash",
  "gemini-2.0-pro",
  "gemini-1.0-pro"
];

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
  base += `- إذا كان المستخدم يكتب بالعربية فأجب بالعربية الفصحى السلسة، مع لمسة بسيطة من لهجته فقط إن لزم.\n`;
  base += `- إذا كان يكتب بالإنجليزية فأجب بإنجليزية واضحة وبسيطة.\n`;
  base += `- كن محترفًا، هادئًا، محفّزًا دون مبالغة أو وعود غير واقعية.\n`;
  base += `- ركّز على النقاط العملية القابلة للتطبيق في الأعمال والإنتاجية متى أمكن.\n`;
  base += `- لا تتجاوز تقريبًا ${MAX_OUTPUT_TOKENS} توكن (حوالي 150–180 كلمة)، واجعل الإجابة في 5–7 أسطر قصيرة.\n`;
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

  for (const modelName of MODELS_TO_TRY) {
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

/* =============== Fallback automated replies =============== */

function buildAutomatedFallbackReply(userText) {
  const fallbackReplies = [
    "💬 يبدو أن سؤالك يفتح بابًا جديدًا لم نكتب عنه بشكل مباشر في نوفا لينك، لكن هذا النوع من الأسئلة يلهمنا دائمًا لمحتوى جديد.",
    "✨ سؤالك يستحق مساحة أكبر مما تسمح به هذه اللحظة، وسنعود له لاحقًا في تدوينة مخصصة.",
    "🤖 يمكنني مساعدتك في أفكار ومقالات قريبة من سؤالك… جرّب إعادة صياغته للحصول على دقة أعلى.",
    "🔍 لم أجد إجابة دقيقة الآن، لكن يمكنني اقتراح أكثر مقالات نوفا لينك ارتباطًا بالموضوع."
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
نوفا بوت هنا ليساعدك في كل ما يخص الذكاء الاصطناعي وتطوير الأعمال والمشاريع الصغيرة والمتوسطة.<br>
ابدأ بسؤال واضح عن فكرتك أو مشروعك، ودعنا نبني عليه خطوة خطوة.`;
}

// شكر / إيجابية
function buildThanksPositiveReply() {
  return `🙏 سعيد أن الإجابة كانت مفيدة لك.<br>
لو أحببت أن تصلك خلاصة الأفكار والأدوات التي نختبرها في نوفا لينك، فكر بإضافة بريدك في النشرة.<br>
هكذا تتحول رسالة شكر اليوم إلى سلسلة أفكار تفيد مشروعك غدًا.`;
}

// مزاج سلبي / إحباط
function buildNegativeMoodReply() {
  return `💭 أقدّر شعورك تمامًا… كثير من المشاريع تتعثر قبل أن تلتقط طريقها الصحيح.<br>
حاول أن تحوّل هذا الإحباط إلى سؤال عملي واحد: "ما الخطوة الصغيرة التالية التي يمكنني فعلها اليوم؟".<br>
اكتب لي عن مشروعك أو وضعك الحالي، وسأحاول مساعدتك بخطوات عملية بسيطة.`;
}

// اشتراك / نشرة
function buildSubscribeInterestReply() {
  return `📧 يسعدنا حماسك للاشتراك في نوفا لينك.<br>
يمكنك إدخال بريدك في بطاقة الاشتراك أو زيارة صفحة النشرة:<br>
🔗 <a href="https://novalink-ai.com/ashtrk-alan" target="_blank" class="nova-link">اشترك في نوفا لينك</a><br>
ستصلك خلاصة أدوات وأفكار عملية عن الذكاء الاصطناعي وتطوير الأعمال.`;
}

// تعاون / شراكة
function buildCollaborationReply() {
  return `🤝 نوفا لينك منفتحة على التعاونات المهنية الجادة المرتبطة بالذكاء الاصطناعي للأعمال وتطوير المهارات.<br>
يمكن أن يكون التعاون على شكل رعاية محتوى، ورش عمل، ندوات مشتركة، أو مشاريع رقمية تخدم روّاد الأعمال.<br>
يمكنك استخدام البطاقة الظاهرة أو مراسلتنا مباشرة:<br>
📧 <a href="mailto:contact@novalink-ai.com" class="nova-link">contact@novalink-ai.com</a><br>
رجاءً اذكر نوع التعاون، الفئة المستهدفة، وأي تفاصيل إضافية تساعدنا على فهم فكرتك بسرعة.`;
}

// استشارة / شراء خدمة
function buildConsultingPurchaseReply() {
  return `📌 طلب استشارة أو شراء خدمة من نوفا لينك خطوة عملية جدًا.<br>
يمكننا مساعدتك في بناء بوت دردشة مخصص لعملك، أو رسم مسار عمل ذكي لاستخدام أدوات الذكاء الاصطناعي في مشروعك.<br>
استخدم البطاقة الظاهرة لحجز استشارة تعريفية قصيرة، وسيتم تجهيز بريد جاهز لتأكيد طلبك.<br>
أو راسلنا مباشرة:<br>
📧 <a href="mailto:contact@novalink-ai.com" class="nova-link">contact@novalink-ai.com</a>`;
}

// تعريف نوفا لينك / القصة / الرؤية / الرسالة
function buildNovaLinkInfoReply() {
  return `🌌 نوفا لينك (NOVALINK Ai) هي مساحة عربية صُممت لتكون جسرًا بين روّاد الأعمال والذكاء الاصطناعي.<br><br>
بدأت الفكرة كرحلة فردية من مجال البنوك إلى عالم الذكاء الاصطناعي، وتحولت تدريجيًا إلى منصة تركّز على ثلاث محاور:<br>
1️⃣ تبسيط أدوات الذكاء الاصطناعي لروّاد الأعمال وأصحاب المشاريع الصغيرة والمتوسطة.<br>
2️⃣ تقديم محتوى عملي يمكن تطبيقه مباشرة في العمل، بعيدًا عن النظريات المعقدة.<br>
3️⃣ بناء مجتمع عربي يرى في الذكاء الاصطناعي "موظفًا ذكيًا" يضيف لقيمته، لا بديلًا عنه.<br><br>
يمكنك التعرّف أكثر على الرؤية والقصة الكاملة:<br>
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

/* =============== واجهة الدماغ الرئيسية =============== */
/**
 * request متوقع أن يحتوي على:
 * {
 *   message,          // نص سؤال المستخدم
 *   intentId,
 *   confidence,
 *   language,         // "ar" أو "en"
 *   dialectHint,
 *   toneHint,
 *   suggestedCard
 * }
 */
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

  // خارج نطاق الذكاء الاصطناعي والأعمال → رد تحفيزي من الستة
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
  if (intentId === "ai_business" && shouldUseAI(intentId)) {
    // 2-أ) تحميل المعرفة ومحاولة إيجاد أقرب تدوينة
    const kb = await loadKnowledgeBase();
    let bestMatch = { score: 0, item: null };

    if (kb.length) {
      bestMatch = findBestMatch(userText, kb);
    }

    const { score, item } = bestMatch;

    // 2-ب) إذا كان التطابق قويًا → رد مؤتمت مع رابط فقط (بدون Gemini)
    if (item && score >= STRONG_MATCH_THRESHOLD) {
      const replyHtml = buildStrongMatchReply(item);
      return {
        reply: replyHtml,
        actionCard: request.suggestedCard || null
      };
    }

    // 2-ج) تطابق متوسط → نحاول Gemini + رابط، وإلا قالب مؤتمت
    if (item && score >= MEDIUM_MATCH_THRESHOLD && score < STRONG_MATCH_THRESHOLD) {
      let replyHtml;

      const aiText = await callGemini(userText, request, item);
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

    // 2-د) لا يوجد تطابق كافٍ أو لا توجد معرفة
    //      → نحاول Gemini بدون ربط بمقال معيّن
    const aiText = await callGemini(userText, request, null);
    if (aiText) {
      const safe = escapeHtml(aiText).replace(/\n/g, "<br>");
      return {
        reply: safe,
        actionCard: request.suggestedCard || null
      };
    }

    // 2-هـ) فول باك داخل نطاق الأعمال/الذكاء الاصطناعي
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
