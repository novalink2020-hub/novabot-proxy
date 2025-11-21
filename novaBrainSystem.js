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
const MAX_OUTPUT_TOKENS = 400;

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

/* =============== ردود براند ثابتة (نوفا لينك / نوفا بوت) =============== */

const NOVALINK_STORY_REPLY = `
💡 نوفا لينك هي مدونة عربية مستقلة، وُلدت من رحلة شخصية للخروج من روتين الوظيفة إلى عالم الذكاء الاصطناعي للأعمال.<br><br>
فكرتها البسيطة:<br>
أن تُصبح "حلقة الوصل" بينك وبين الأدوات الذكية التي تختصر الوقت، وتزيد إنتاجيتك، وتفتح أمامك فرص دخل جديدة — بدون تعقيد تقني ولا مصطلحات مرعبة.<br><br>
في نوفا لينك ستجد:<br>
• مقالات عملية عن أدوات الذكاء الاصطناعي في الأعمال والمشاريع الصغيرة.<br>
• شروحات هادئة بعيدًا عن المبالغة والتهويل.<br>
• تركيز على التجارب الحقيقية وما يعمل فعلاً، لا ما يبدو لامعًا فقط.<br><br>
🔗 <a href="https://novalink-ai.com/rhlh-frdyh-fy-aalm-althkaa-alastnaay-hktha-bdat-nwfa-lynk" target="_blank" class="nova-link">اقرأ قصة نشأة نوفا لينك</a>
`;

const NOVALINK_SERVICES_REPLY = `
🧩 نوفا لينك بدأت كمدونة محتوى، لكنها تتطور تدريجيًا لتقدّم خدمات عملية حول الذكاء الاصطناعي للأعمال، مثل:<br><br>
• مساعدة أصحاب المشاريع على اختيار أدوات الذكاء الاصطناعي المناسبة لهم.<br>
• تصميم تجارب بوتات دردشة مخصّصة للمواقع الصغيرة والمتاجر الإلكترونية.<br>
• محتوى تعليمي وتطبيقي يركّز على "كيف تستخدم الأدوات" وليس "كيف تنبهر بها".<br><br>
تطوّر الخدمات يتم على مراحل، حسب احتياج الجمهور والتجارب الواقعية.<br><br>
🔗 <a href="https://novalink-ai.com/services-khdmat-nwfa-lynk" target="_blank" class="nova-link">تعرّف على خدمات نوفا لينك المتاحة حاليًا</a>
`;

const NOVABOT_INTRO_REPLY = `
🤖 نوفا بوت هو مساعد دردشة ذكي تابع لمنصة نوفا لينك.<br><br>
تم تصميمه ليقوم بثلاثة أدوار رئيسية:<br>
1) توجيهك نحو المقالات والموارد المناسبة من نوفا لينك.<br>
2) مساعدتك في فهم كيف يمكن للذكاء الاصطناعي أن يخدم مشروعك أو عملك اليوم.<br>
3) فتح باب الاستشارة أو التعاون عندما تشعر أن الوقت حان لخطوة عملية أكبر.<br><br>
نوفا بوت لا يقدّم نصائح قانونية أو طبية، ولا يَعِدك بالثراء السريع. هدفه أن يكون "زميل عمل ذكي" يدعم قرارك، لا أن يفكر عنك بالكامل.<br><br>
🔗 <a href="https://novalink-ai.com/about-us-althkaa-alastnaay" target="_blank" class="nova-link">تعرّف أكثر على رؤية نوفا لينك</a>
`;

const GREETING_REPLY = `
👋 أهلًا وسهلًا بك في نوفا لينك.<br>
أنا نوفا بوت… مساعدك الذكي لاكتشاف كيف يمكن للذكاء الاصطناعي أن يخدم فكرتك أو مشروعك خطوة بخطوة.<br>
ابدأ بسؤال بسيط عمّا تريد تطويره الآن، وسنُفكّره سويًا بشكل عملي وهادئ.
`;

const THANKS_REPLY = `
🙏 سعيد أن الإجابة أفادتك.<br>
لو أحببت أن تصلك خلاصة الأدوات والأفكار التي نختبرها في نوفا لينك، فكر بإضافة بريدك في النشرة.<br>
هكذا تتحول رسالة شكر واحدة اليوم إلى سلسلة أفكار تفيد مشروعك غدًا. ✨
`;

const NEGATIVE_REPLY = `
💬 أشكرك على صراحتك.<br>
يهمّ نوفا لينك أن تكون الإجابات واقعية ومفيدة قدر الإمكان، حتى لو لم تكن مثالية من أول مرة.<br>
جرّب أن توضّح ما الذي لم يكن واضحًا أو ما النتيجة التي تهدف لها، وسنحاول صياغة إجابة أقرب لما تحتاجه عمليًا.
`;

/* =============== إعداد Gemini — الموديلات الجديدة الصحيحة =============== */

let genAI = null;
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

// موديلات Google المدعومة (v1)
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
  base += `- إذا كان المستخدم يكتب بالعربية فأجب بالعربية الفصحى السلسة، مع نكهة بسيطة من لهجته فقط إن لزم.\n`;
  base += `- إذا كان يكتب بالإنجليزية فأجب بإنجليزية واضحة وبسيطة.\n`;
  base += `- كن محترفًا، هادئًا، محفّزًا دون مبالغة أو وعود غير واقعية.\n`;
  base += `- ركّز على النقاط العملية القابلة للتطبيق في الأعمال والإنتاجية متى أمكن.\n`;
  base += `- لا تتجاوز تقريبًا ${MAX_OUTPUT_TOKENS} توكن (حوالي 250–300 كلمة)، واجعل الإجابة مرتبة في فقرات قصيرة.\n`;
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

function shouldUseAI(intentId) {
  if (!intentId) return true;

  // نوايا لا تحتاج لاستدعاء Gemini إطلاقًا (قوالب ثابتة + توفير توكنز)
  if (
    intentId === "greeting" ||
    intentId === "thanks" ||
    intentId === "positive_reaction" ||
    intentId === "negative_reaction" ||
    intentId === "novalink_story" ||
    intentId === "novalink_services" ||
    intentId === "novabot_intro" ||
    intentId === "subscribe" ||
    intentId === "collaboration" ||
    intentId === "consulting_purchase" ||
    intentId === "out_of_scope"
  ) {
    return false;
  }

  return true;
}

/* =============== واجهة الدماغ الرئيسية =============== */

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

  // 0) نوايا براند ثابتة (بدون Gemini ولا قاعدة معرفة)
  if (intentId === "greeting") {
    return {
      reply: GREETING_REPLY,
      actionCard: request.suggestedCard || null
    };
  }

  if (intentId === "thanks" || intentId === "positive_reaction") {
    return {
      reply: THANKS_REPLY,
      actionCard: request.suggestedCard || null
    };
  }

  if (intentId === "negative_reaction") {
    return {
      reply: NEGATIVE_REPLY,
      actionCard: request.suggestedCard || null
    };
  }

  if (intentId === "novalink_story") {
    return {
      reply: NOVALINK_STORY_REPLY,
      actionCard: request.suggestedCard || null
    };
  }

  if (intentId === "novalink_services") {
    return {
      reply: NOVALINK_SERVICES_REPLY,
      actionCard: request.suggestedCard || null
    };
  }

  if (intentId === "novabot_intro") {
    return {
      reply: NOVABOT_INTRO_REPLY,
      actionCard: request.suggestedCard || null
    };
  }

  // 1) تحميل المعرفة
  const kb = await loadKnowledgeBase();
  let bestMatch = { score: 0, item: null };

  if (kb.length) {
    bestMatch = findBestMatch(userText, kb);
  }

  const { score, item } = bestMatch;

  // 2) تطابق قوي مع مقالة (> 80%) → رد مؤتمت فقط مع رابط
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
    intentId === "learn" ||
    intentId === "explore" ||
    intentId === "out_of_scope"
      ? getRandomGenericReply()
      : buildNoMatchReply();

  return {
    reply: fallback,
    actionCard: request.suggestedCard || null
  };
}
