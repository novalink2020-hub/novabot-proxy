// ===========================================
// novaBrain.js – NovaBrain Stable v1.0
// دماغ نوفا بوت (تنفيذ القرارات فقط)
// - نوايا ثابتة (بدون روابط)
// - معرفة (Strong / Medium Match) مع روابط للتدوينات فقط
// - استدعاء Gemini بدون روابط
// - Fallback بسيط بدون روابط
// By Mohammed Abu Snaina – NOVALINK Ai
// ===========================================

import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  loadKnowledgeBase,
  findBestMatch,
  thresholds,
} from "./knowledgeEngine.js";

/* ========== إعدادات عامة ========== */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

const MODELS_TO_TRY = [
  "gemini-2.0-flash",
  "gemini-2.0-pro",
  "gemini-1.0-pro",
];

let genAI = null;
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

/* ========== أدوات مساعدة للنص ========== */

function escapeHtml(str = "") {
  return str.replace(/[&<>"]/g, (c) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
    }[c] || c;
  });
}

function escapeAttr(str = "") {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

/* ========== كشف رسائل خاصة ========== */

// وداع
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
    "يكفي شكرا",
  ];
  const englishBye = ["bye", "goodbye", "see you", "see ya", "see u", "thanks bye"];

  return (
    arabicBye.some((kw) => t.includes(kw)) ||
    englishBye.some((kw) => t.includes(kw))
  );
}

// كود المطوّر السري
function hasDeveloperCode(text = "") {
  return (text || "").includes("10406621");
}

/* ========== ردود المطوّر ========== */

function buildDeveloperCardReplyAr() {
  return `✨ هذه بطاقة تعريف سريعة بالشخص الذي طوّر نوفا بوت ودرّبه… لمحة عن الإنسان خلف التقنية.<br>
👨‍💻 من يقف خلف نوفا بوت؟<br>
“محمد أبو سنينة—مطور عربي جمع بين العمل المصرفي والذكاء الاصطناعي للأعمال، ويبني نوفا لينك كمساحة عملية تساعد روّاد الأعمال على استخدام الأدوات الذكية بثقة ووضوح.”`;
}

function buildDeveloperCardReplyEn() {
  return `👨‍💻 Here’s a quick snapshot of the person behind NovaBot and NovaLink:<br><br>
- An Arabic creator who moved from banking into AI for business.<br>
- Building NovaLink as a practical space to help entrepreneurs use AI tools step by step.<br>
- Believes AI is a chance to upgrade our role at work, not just a threat to jobs.<br><br>
This card is for those who care about the human behind the system, not just the answers ✨`;
}

/* ========== ردود مؤتمتة عامة (بدون روابط) ========== */

// هذه هي الـ 6 ردود التحفيزية – بدون أي روابط داخل النص
const genericReplies = [
  `👋 أهلاً بك في نوفا لينك.<br>
نوفا بوت هنا ليكون شريكك في فهم أدوات الذكاء الاصطناعي وتطبيقها في مشروعك أو عملك خطوة بخطوة.`,

  `🌱 أحيانًا كل ما تحتاجه ليس إجابة جاهزة، بل دفعة صغيرة تكمل بها الطريق.<br>
فكّر بصوت عالٍ: ما التحدّي الأهم في عملك حاليًا؟ اكتب لي عنه، ولنبحث معًا عن زاوية ذكية لحلّه.`,

  `🚀 الذكاء الاصطناعي ليس رفاهية تقنية… بل فرق حقيقي في الوقت والنتائج لمن يحسن استخدامه.<br>
كل سؤال تكتبه هنا يمكن أن يتحوّل إلى فكرة عملية تخدم مشروعك.`,

  `✨ لا يوجد مشروع "صغير" عندما تُدار أدواته بذكاء.<br>
ابدأ بأبسط ما لديك، وسنحاول معًا تحويله إلى خطوة عملية مدروسة بدل أن يبقى فكرة في رأسك.`,

  `💡 كل رسالة تكتبها هنا هي جزء من بناء "نسخة أذكى" من طريقة عملك.<br>
لا تبحث عن الكمال… ابحث عن التقدّم المستمر، ولو بسطر واحد كل يوم.`,

  `قبل أن تغلق هذه النافذة… تذكّر أن ما يفرّق بين من يتفرّج على ثورة الذكاء الاصطناعي ومن يستفيد منها حقًا، هو قرار بسيط بالبدء والتجربة والالتزام بخطوات صغيرة متتابعة.`,
];

function getRandomGenericReply() {
  const idx = Math.floor(Math.random() * genericReplies.length);
  return genericReplies[idx];
}

/* ========== ردود ثابتة للنوايا (بدون روابط) ========== */

// ترحيب
function buildGreetingReply(language = "ar") {
  if (language === "en") {
    return `👋 Welcome to NovaLink.<br>
NovaBot is here to help you use AI practically in your work and projects. Start by telling me briefly about your idea or challenge, and we’ll build from there.`;
  }

  return `👋 أهلاً بك في نوفا لينك.<br>
نوفا بوت هنا ليساعدك في كل ما يخص الذكاء الاصطناعي وتطوير الأعمال والمشاريع الصغيرة والمتوسطة.<br>
ابدأ بسؤال واضح عن فكرتك أو مشروعك، ودعنا نبني عليه خطوة خطوة.`;
}

// شكر / إيجابية
function buildThanksPositiveReply() {
  return `سعيد أن الإجابة كانت مفيدة لك 🙌<br>
رسالتك هذه إشارة لطيفة أننا نمشي في الاتجاه الصحيح… ومع كل سؤال جديد يمكن أن نضيف طبقة أعمق لمسارك مع الذكاء الاصطناعي والأعمال.`;
}

// مزاج سلبي / إحباط
function buildNegativeMoodReply() {
  return `أقدّر شعورك تمامًا… كثير من المشاريع تتعثر قبل أن تلتقط طريقها الصحيح.<br><br>
حاول أن تحوّل هذا المزاج إلى سؤال عملي واحد: "ما الخطوة الصغيرة التالية التي أستطيع فعلها اليوم؟".<br>
اكتب لي عن مشروعك أو وضعك الحالي، وسأحاول مساعدتك بخطوات بسيطة قابلة للتنفيذ.`;
}

// اشتراك / نشرة
function buildSubscribeInterestReply() {
  return `يسعدني حماسك للاشتراك في نوفا لينك ✉️<br>
ستجد في الواجهة بطاقة مخصّصة للاشتراك، أضف فيها بريدك لتصلك خلاصة الأدوات والأفكار التي نختبرها ونجرّبها عمليًا في نوفا لينك.`;
}

// تعاون / شراكة
function buildCollaborationReply() {
  return `فكرة التعاون دائمًا محل ترحيب عندما تكون مرتبطة بالذكاء الاصطناعي للأعمال، أو تدريب، أو محتوى يخدم روّاد الأعمال والمهنيين.<br><br>
اذكر لي نوع التعاون الذي تفكر به، والفئة التي تستهدفها، وطبيعة المشروع أو المنصة التي تمثّلها، وسنحاول رسم شكل تعاون يخدم الطرفين بوضوح واحترام للوقت والجهد.`;
}

// استشارة / شراء خدمة
function buildConsultingPurchaseReply() {
  return `طلب استشارة أو خدمة متقدمة خطوة عملية جدًا 💼<br><br>
يمكننا مساعدتك في بناء بوت دردشة لعملك، أو تصميم مسار عمل بسيط لاستخدام أدوات الذكاء الاصطناعي في مشروعك، أو مراجعة فكرة مشروعك الرقمي من منظور عملي.<br>
استخدم بطاقة "بوت دردشة لعملك" أو بطاقة الاستشارة في الواجهة لتترك بياناتك، وسيتم التواصل معك بما يناسب وضعك الحالي.`;
}

// تعريف نوفا لينك
function buildNovaLinkInfoReply() {
  return `نوفا لينك (NOVALINK Ai) مساحة عربية تهدف إلى تحويل الذكاء الاصطناعي من مصطلح ضخم إلى أداة يومية تخدم عملك وحياتك المهنية.<br><br>
بدأت من تجربة شخصية في الانتقال من عالم البنوك إلى عالم الذكاء الاصطناعي، وتحولت إلى منصة تركّز على تبسيط الأدوات، ورفع الإنتاجية، ومرافقة روّاد الأعمال في رحلتهم الرقمية خطوة بخطوة.`;
}

// تعريف نوفا بوت
function buildNovaBotInfoReply() {
  return `🤖 نوفا بوت هو مساعد دردشة ذكي من نوفا لينك، دوره أن يختصر عليك وقت البحث والحيرة، ويحوّل أسئلتك إلى أفكار وخطوات عملية مرتبطة بالذكاء الاصطناعي وتطوير الأعمال.<br><br>
كلما كان سؤالك محددًا أكثر ومتصلاً بعملك أو مشروعك، أصبحت الإجابة أكثر فائدة وعمقًا.`;
}

// وداع
function buildGoodbyeReply() {
  return `سعيد بهذه الجولة من الحوار معك 🌱<br>
أتمنّى أن تكون فكرة واحدة على الأقل قد فتحت لك زاوية جديدة للتفكير أو التنفيذ.<br>
نوفا بوت سيبقى هنا عندما تعود… ومع كل مرة نكمل من حيث توقّفنا.`;
}

/* ========== ردود المعرفة (Strong / Medium) ========== */

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

/* ========== Fallback بسيط (بدون روابط / بدون HTML معقد) ========== */

function buildAutomatedFallbackReply() {
  const fallbackReplies = [
    "سؤالك يفتح زاوية جديدة لم نجهّز لها إجابة مباشرة الآن، لكنه يلهمنا لمحتوى قادم على نوفا لينك.",
    "لم أجد إجابة دقيقة جاهزة الآن، لكن يمكننا تضييق السؤال معًا لتصبح المساعدة أكثر تركيزًا.",
    "هذا النوع من الأسئلة يحتاج مساحة أوسع من رد واحد قصير، جرّب إعادة صياغته مع توضيح ما الذي يهمّك أكثر.",
    "لم أتمكّن من توليد إجابة موثوقة الآن، لكن يمكننا الرجوع إلى أقرب موضوع عملي يهمّ عملك أو مشروعك.",
  ];

  return fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
}

/* ========== استدعاء Gemini (بدون روابط) ========== */

function buildGeminiPrompt(userText, opts = {}) {
  const lang = opts.language === "en" ? "en" : "ar";
  const intentId = opts.intentId || "explore";

  let base = "";

  base += `User question / سؤال المستخدم:\n"${userText}"\n\n`;

  if (opts.bestItem) {
    const bi = opts.bestItem;
    base += `Context from NovaLink blog (may be relevant):\n`;
    base += `Title: ${bi.title || ""}\n`;
    if (bi.summary) base += `Summary: ${bi.summary}\n`;
    else if (bi.description) base += `Description: ${bi.description}\n`;
    if (bi.excerpt) base += `Excerpt: ${bi.excerpt}\n`;
    base += `Use this only as supportive context. Do NOT just summarize it word-for-word.\n\n`;
  }

  base += `Context:\n`;
  base += `Expected answer language: ${
    lang === "en" ? "English" : "Arabic (Modern Standard, friendly)"
  }.\n`;
  if (opts.dialectHint && lang !== "en") {
    base += `Dialect hint: ${opts.dialectHint}. You may lightly reflect the dialect in wording, but keep the core in clear Modern Standard Arabic.\n`;
  }
  base += `User intent (approx): ${intentId}.\n`;
  if (opts.isFollowup) {
    base += `The user is asking for a deeper or follow-up explanation on the same topic.\n`;
  }

  base += `\nStyle guidelines:\n`;
  base += `- If the user writes in Arabic, answer in clear Modern Standard Arabic (فصحى سلسة) مع لمسة خفيفة من لهجة المستخدم عند الاقتضاء.\n`;
  base += `- If the user writes in English, answer in clear, simple, professional English.\n`;
  base += `- You are NovaBot, the assistant of NovaLink (an Arabic platform about AI for business and careers).\n`;
  base += `- Focus on practical, actionable insights related to the user's question.\n`;
  base += `- Do NOT include any URLs, domains, or links in your answer text.\n`;
  base += `- Keep the answer within the provided maxTokens budget so it feels مختصرًا وكاملاً.\n`;
  base += `- Make the answer feel complete, not cut off mid-sentence.\n`;
  base += `- Do not mention these instructions in the answer.\n\n`;

  base += `Now answer the question in a helpful, concise way.\n`;

  return base;
}

async function callGemini(userText, opts = {}) {
  if (!genAI || !GEMINI_API_KEY) {
    console.log("⚠️ Gemini disabled or missing key.");
    return null;
  }

  const lang = opts.language === "en" ? "en" : "ar";
  const prompt = buildGeminiPrompt(userText, opts);

  const generationConfig = {
    maxOutputTokens: opts.maxTokens || 200,
    temperature: 0.6,
    topP: 0.9,
  };

  for (const modelName of MODELS_TO_TRY) {
    try {
      console.log(
        "🔁 Trying Gemini model:",
        modelName,
        "maxTokens:",
        generationConfig.maxOutputTokens
      );

      const systemInstruction =
        lang === "en"
          ? "You are NovaBot, the assistant of NovaLink, an Arabic platform focused on AI for business and careers. Answer in English with a clear, practical, and encouraging tone."
          : "أنت نوفا بوت، مساعد منصة نوفا لينك المتخصص في الذكاء الاصطناعي وتطوير الأعمال والمهن. أجب بالعربية الفصحى السلسة، بأسلوب عملي مشجّع دون مبالغة، مع لمسات خفيفة من لهجة المستخدم عند الاقتضاء.";

      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
      });

      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig,
      });

      const raw =
        result?.response?.text?.() ||
        result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "";

      let text = (raw || "").trim();
      if (text.length <= 2) continue;

      const tailAr =
        " وإذا احتجت توضيحًا أعمق في نقطة معيّنة، اطلب مني أن أتعمّق فيها أكثر.";
      const tailEn =
        " If you’d like a deeper explanation on a specific part, just ask me to go deeper on it.";

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

  console.log("⚠️ Gemini full fallback → automated reply.");
  return null;
}

/* ========== استنتاج حالة الجلسة لو لم يمرّرها السيرفر ========== */

function detectAISessionFromHistory(intentId, sessionHistory = []) {
  if (intentId === "ai_business") return true;

  const lastUserMsgs = (sessionHistory || [])
    .filter((m) => m && m.role === "user")
    .slice(-3);

  return lastUserMsgs.some((m) => m.intentId === "ai_business" || m.hasAI === true);
}

/* ===========================================
   الواجهة الرئيسية للدماغ
   request:
   - message: نص المستخدم
   - intentId: نية مكتشفة (من novaIntentDetector أو من الراوتر)
   - language: "ar" | "en"
   - forceAI: boolean
   - sessionType: "ai" | "non_ai" (اختياري – لو لم يُمرّر نشتقها من التاريخ)
   - suggestedCard: بطاقة مبدئية (لن تُستخدم في strong/medium match)
   - sessionHistory: آخر الرسائل (اختياري – للمتوافقة مع السيرفر القديم)
=========================================== */

export async function novaBrain(request = {}) {
  const userText = (request.message || "").trim();
  const intentId = request.intentId || "casual";
  const language = request.language === "en" ? "en" : "ar";
  const forceAI = request.forceAI === true;
  const suggestedCard = request.suggestedCard || null;

  const sessionHistory = Array.isArray(request.sessionHistory)
    ? request.sessionHistory
    : [];

  let isAISession =
    request.sessionType === "ai"
      ? true
      : request.sessionType === "non_ai"
      ? false
      : detectAISessionFromHistory(intentId, sessionHistory);

  const isAIQuestion = intentId === "ai_business" || forceAI;

  // لو forceAI مفعّل نعتبر الجلسة AI
  if (forceAI) {
    isAISession = true;
  }

  // 0) رسالة فارغة → رد تحفيزي
  if (!userText) {
    return {
      reply: getRandomGenericReply(),
      actionCard: null,
      usedAI: false,
    };
  }

  // 0.1) بطاقة المطوّر
  if (hasDeveloperCode(userText)) {
    const reply =
      language === "en"
        ? buildDeveloperCardReplyEn()
        : buildDeveloperCardReplyAr();

    return {
      reply,
      actionCard: "developer_identity",
      usedAI: false,
    };
  }

  // 0.2) وداع
  if (isGoodbyeMessage(userText)) {
    return {
      reply: buildGoodbyeReply(),
      actionCard: null,
      usedAI: false,
    };
  }

  /* ========== 1) نوايا ثابتة (بدون AI ولا معرفة طالما !forceAI) ========== */

  if (!forceAI) {
    if (intentId === "greeting") {
      return {
        reply: buildGreetingReply(language),
        actionCard: null,
        usedAI: false,
      };
    }

    if (intentId === "thanks_positive") {
      return {
        reply: buildThanksPositiveReply(),
        actionCard: "subscribe",
        usedAI: false,
      };
    }

    if (intentId === "negative_mood") {
      return {
        reply: buildNegativeMoodReply(),
        actionCard: null,
        usedAI: false,
      };
    }

    if (intentId === "subscribe_interest") {
      return {
        reply: buildSubscribeInterestReply(),
        actionCard: "subscribe",
        usedAI: false,
      };
    }

    if (intentId === "collaboration") {
      return {
        reply: buildCollaborationReply(),
        actionCard: "collaboration",
        usedAI: false,
      };
    }

    if (intentId === "consulting_purchase") {
      return {
        reply: buildConsultingPurchaseReply(),
        actionCard: "bot_lead",
        usedAI: false,
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
        usedAI: false,
      };
    }

    if (intentId === "novabot_info") {
      return {
        reply: buildNovaBotInfoReply(),
        actionCard: null,
        usedAI: false,
      };
    }

    if (intentId === "out_of_scope" || intentId === "casual") {
      // جلسة غير AI + سؤال غير AI → من الردود الستة التحفيزية فقط
      if (!isAISession && !isAIQuestion) {
        return {
          reply: getRandomGenericReply(),
          actionCard: null,
          usedAI: false,
        };
      }
      // غير ذلك نسمح للمنظومة تكمل للمعرفة / Gemini
    }
  }

  /* ========== 2) معرفة نوفا لينك (Strong / Medium) ========== */

  const kb = await loadKnowledgeBase();
  let bestMatch = { score: 0, item: null };

  if (kb.length) {
    bestMatch = await findBestMatch(userText, kb);
  }

  const { score, item } = bestMatch || { score: 0, item: null };

  // 2-أ) تطابق قوي → رد مؤتمت + رابط فقط (بدون Gemini / بدون بطاقة)
  if (item && score >= thresholds.STRONG) {
    const replyHtml = buildStrongMatchReply(item);
    return {
      reply: replyHtml,
      actionCard: null, // البطاقات لا تظهر في strong match
      usedAI: false,
    };
  }

  // 2-ب) تطابق متوسط → Gemini قصير + رابط (maxTokens = 100)
  if (item && score >= thresholds.MEDIUM) {
    const aiText = await callGemini(userText, {
      language,
      intentId,
      bestItem: item,
      maxTokens: 100,
    });

    if (aiText) {
      const replyHtml = wrapAiAnswerWithLink(aiText, item);
      return {
        reply: replyHtml,
        actionCard: null, // لا بطاقات في medium match
        usedAI: true,
      };
    } else {
      const replyHtml = buildMidMatchTemplateReply(item);
      return {
        reply: replyHtml,
        actionCard: null,
        usedAI: false,
      };
    }
  }

  /* ========== 3) لا تطابق قوي/متوسط → نقرر AI أو تحفيزي حسب الجلسة ========== */

  // حالة: جلسة غير AI + سؤال غير AI + لسنا مجبرين على AI → رد تحفيزي فقط
  if (!isAISession && !isAIQuestion && !forceAI) {
    return {
      reply: getRandomGenericReply(),
      actionCard: null,
      usedAI: false,
    };
  }

  // باقي الحالات: نستخدم Gemini مع جدول maxTokens

  const lower = userText.toLowerCase();
  const followupAr = [
    "أكمل",
    "تابع",
    "وضّح أكثر",
    "وضح أكثر",
    "تفاصيل أكثر",
    "تعمق فيها",
    "تعمق فيها اكثر",
    "اتعمق فيها اكثر",
  ];
  const followupEn = ["continue", "more", "explain", "details", "go deeper"];

  const isFollowup =
    followupAr.some((kw) => userText.includes(kw)) ||
    followupEn.some((kw) => lower.includes(kw));

  // جدول maxTokens:
  // - سؤال AI/أعمال + جلسة AI → 200
  // - سؤال غير AI + جلسة AI → 100
  // - سؤال غير AI + جلسة غير AI → 0 (عالجناه فوق بتحفيزي)
  let maxTokens = 100;

  if (isAIQuestion && isAISession) {
    maxTokens = 200;
  } else if (!isAIQuestion && isAISession) {
    maxTokens = 100;
  }

  const aiText = await callGemini(userText, {
    language,
    intentId,
    isFollowup,
    maxTokens,
  });

  if (aiText) {
    const safe = escapeHtml(aiText).replace(/\n/g, "<br>");
    return {
      reply: safe, // لا روابط هنا
      actionCard: forceAI ? null : suggestedCard,
      usedAI: true,
    };
  }

  // فشل Gemini بالكامل → fallback بدون روابط ولا HTML ثقيل
  const fallback = buildAutomatedFallbackReply();
  const safeFallback = escapeHtml(fallback);

  return {
    reply: safeFallback,
    actionCard: null,
    usedAI: false,
  };
}

// اختيارية: لتوافق الاسم القديم إن احتجت
export { novaBrain as novaBrainSystem };
