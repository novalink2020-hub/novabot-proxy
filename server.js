// =======================================================
// NovaProxy v2.4 — Business AI Edition
// Gemini 2.0 Flash → Pro fallback | ثم Automated Replies
// Intent + Tone + Dialect + Memory + Metrics + Reach + GitHub
// المطوّر: محمد أبو سنينة – NOVALINK.AI
// =======================================================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
// استخدم node-fetch@2 للحفاظ على require (CommonJS)
const fetch = require("node-fetch");

// =======================================================
// ⚙️ CONFIG
// =======================================================
const CONFIG = {
  BRAND_NAME: "نوفا لينك",
  USE_GEMINI_FIRST_BY_DEFAULT: true,
  ALLOWED_ORIGINS: [
    "https://novalink-ai.com",
    "https://www.novalink-ai.com"
  ],
  LOG_REQUESTS: true,
  LLM_MAX_TOKENS: 120, // أقصى طول للرد لتقليل التكاليف
  SMART_MARKETING: {
    ENABLED: true,
    MODE: "hybrid" // مستقبلاً: يمكن استخدامه لتغيير نبرة الرد
  },
  FEEDBACK: {
    ENABLED: true,
    GITHUB: {
      ENABLED: true,
      OWNER: "novalink2020-hub",
      REPO: "novabot-proxy",
      FEEDBACK_FILE: "feedback.csv", // CSV lead log
      METRICS_FILE: "metrics.json"   // intent conversion counters
    },
    REACH: {
      ENABLED: true,
      API_URL: "https://reach.hostinger.com/api/v1/subscribers",
      API_KEY: process.env.REACH_API_KEY || ""
    }
  }
};

// كلمات مفتاحية لتحديد إن كان السؤال ضمن مجال الذكاء الاصطناعي أم لا
const AI_KEYWORDS_AR = [
  "ذكاء اصطناعي","الذكاء الاصطناعي","ai","جيميني","جيمني",
  "شات جي بي تي","chatgpt","نماذج لغوية","نموذج لغوي","llm",
  "تعلم الآلة","التعلم الآلي","machine learning","deep learning",
  "شبكات عصبية","أدوات الذكاء الاصطناعي","روبوت دردشة","بوت دردشة",
  "اوتومات","أتمتة","توليد نص","توليد صور","مولد نصوص","نموذج توليدي"
];

const AI_KEYWORDS_EN = [
  "ai","artificial intelligence","gemini","gpt","chatgpt",
  "llm","large language model","machine learning","ml",
  "deep learning","neural network","neural networks",
  "ai tools","ai chatbot","automation","prompt","rag"
];

// =======================================================
// 🔐 KEYS
// =======================================================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const GITHUB_TOKEN  = process.env.GITHUB_TOKEN || "";

// =======================================================
// 🚀 APP
// =======================================================
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (CONFIG.ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"), false);
  }
}));

// =======================================================
// 🧠 Utilities
// =======================================================

// كشف لغة الرسالة (عربي/إنجليزي) بسيط
function detectLanguage(text = "") {
  const enOnly = /^[\s0-9a-zA-Z.,;:!?'"()@#%&*+\-_/\\|[\]{}<>]+$/;
  if (enOnly.test(text.trim())) return "en";
  return "ar";
}

// كشف لهجة عربية مبسّط
function detectDialect(arText) {
  const t = (arText || "").toLowerCase();
  const hasAny = (arr) => arr.some(w => t.includes(w));

  const gulf = ["وش", "ليه", "مرة", "واجد", "هاالشي", "يعطيك", "شلون"];
  const egy  = ["ازاي","كده","ليه","ماشي","عايز","دلوقتي","جامد"];
  const lev  = ["ليش","شو","هيك","كتير","لسا","هلق","تمام"];
  const magh = ["بزاف","علاش","ديما","برشا","تصاور","حاجة"];

  if (hasAny(gulf)) return "gulf";
  if (hasAny(egy))  return "egyptian";
  if (hasAny(lev))  return "levant";
  if (hasAny(magh)) return "maghrebi";
  return "msa"; // فصحى
}

// تحديد هل السؤال ضمن مجال الذكاء الاصطناعي أم لا
function isAIDomain(question = "") {
  const q = (question || "").toLowerCase();
  const hit = (arr) => arr.some(w => q.includes(w.toLowerCase()));
  return hit(AI_KEYWORDS_AR) || hit(AI_KEYWORDS_EN);
}

// كشف نية المستخدم موسّع
function analyzeIntent(question = "") {
  const q = (question || "").toLowerCase();
  const hit = (list) => list.some(w => q.includes(w));

  if (hit(["سعر","شراء","اشتراك","تكلفة","خدمة","طلب","باقة","عروض","buy","price","pricing","plan"])) 
    return "PURCHASE";

  if (hit(["تعلم","شرح","كيف","افهم","خطوات","أساسيات","مقال","تدوينة","learn","tutorial","guide","how to"]))
    return "LEARNING";

  if (hit(["تسويق","مبيعات","اعلان","ترويج","تحويل","براند","علامة","campaign","conversion","marketing","sales"]))
    return "MARKETING";

  if (hit(["تعاون","شراكة","رعاية","مشروع مشترك","اتفاق","تواصل معنا","partner","collaboration","sponsor","cooperate"]))
    return "COLLABORATION";

  if (hit(["نوفا لينك","من انتم","من أنتم","رؤيتكم","هدفكم","قصتكم","about novalink","who are you","your story"]))
    return "ABOUT";

  return "GENERAL";
}

// ذاكرة قصيرة: استخلص آخر 3 تبادلات user/assistant
function buildHistoryBlock(history = [], lang = "ar") {
  if (!Array.isArray(history) || !history.length) return "";
  const last = history.slice(-6); // 3 تبادلات
  const lines = last.map(h => {
    const role = h.role === "assistant"
      ? (lang === "en" ? "assistant" : "المساعد")
      : (lang === "en" ? "user" : "المستخدم");
    return `${role}: ${h.content || ""}`;
  }).join("\n");
  return lines ? `\n\n${lang === "en" ? "Recent chat history" : "تاريخ المحادثة الأخير"}:\n${lines}\n` : "";
}

// الردود المؤتمتة الستّة (fallback + non-AI domain)
function getAutomatedReply(intent, lang = "ar") {
  const isEN = lang === "en";

  // نطابق النية على 6 أنماط: تعلم، استكشاف، اجتماعي/عام، تجربة/تسويق، شراء، شراكة
  const key = intent || "GENERAL";

  if (isEN) {
    switch (key) {
      case "LEARNING":
        return "I’m NovaLink’s AI guide. I focus on AI tools and practical business use-cases. Ask me anything about AI, and I’ll keep it simple and clear.";
      case "ABOUT":
        return "NovaLink is an Arabic-first platform that helps individuals and businesses use AI tools in a practical way. We focus on education, tools, and real business use-cases.";
      case "MARKETING":
        return "NovaLink helps you use AI in marketing, content, and sales. You can explore our articles and services to see real examples of AI in business.";
      case "PURCHASE":
        return "I’m not a sales bot, but I can guide you to the right AI tool or service. If you want tailored help, our services page has clear options you can explore.";
      case "COLLABORATION":
        return "If you’re interested in collaboration or partnership, you can use the contact section on the website, or leave your email and a short note so our team can follow up.";
      default: // GENERAL
        return "I’m an AI assistant specialized in AI topics. Try asking me about AI tools, Gemini, ChatGPT, or how to use AI in your work.";
    }
  }

  // عربي
  switch (key) {
    case "LEARNING":
      return "أنا مساعد نوفا لينك المتخصص في الذكاء الاصطناعي. اسألني عن الأدوات، الأفكار، أو كيف تطبّق الذكاء الاصطناعي في شغلك وسأشرح لك ببساطة وخطوات عملية.";
    case "ABOUT":
      return "نوفا لينك منصة عربية تساعد الأفراد وأصحاب الأعمال على فهم واستخدام أدوات الذكاء الاصطناعي بشكل عملي، من خلال مقالات، شروحات وأفكار تطبيق حقيقية.";
    case "MARKETING":
      return "دور نوفا لينك هو ربطك بأفكار وأدوات ذكاء اصطناعي تساعدك في التسويق، صناعة المحتوى، والمبيعات. تصفّح مقالاتنا وخدماتنا لو حاب تشوف أمثلة واقعية.";
    case "PURCHASE":
      return "أنا لست بوت مبيعات مباشر، لكن أستطيع توجيهك للأداة أو الخدمة الأنسب. يمكنك زيارة صفحة الخدمات في نوفا لينك أو ترك بريدك لنراجع حالتك ونقترح عليك ما يناسبك.";
    case "COLLABORATION":
      return "يسعد نوفا لينك بأي شراكة أو تعاون جاد في مجال الذكاء الاصطناعي. يمكنك استخدام قسم تواصل معنا في الموقع أو ترك بريدك ورسالة قصيرة ليتم التواصل معك.";
    default: // GENERAL
      return "أنا بوت مخصص للحديث عن الذكاء الاصطناعي واستخداماته العملية. جرّب تسألني عن أداة، فكرة تطبيق، أو طريقة توظيف الذكاء الاصطناعي في عملك اليومي.";
  }
}

// CTA ديناميكي حسب النية + اللغة
function buildCTA(intent, lang = "ar") {
  if (lang === "en") {
    switch (intent) {
      case "PURCHASE":
        return {
          type: "purchase",
          text: "Need tailored help choosing the right AI solution? Visit our services page or leave your email.",
          url: "https://novalink-ai.com/services-khdmat-nwfa-lynk"
        };
      case "LEARNING":
        return {
          type: "learning",
          text: "Want practical AI articles in your inbox?",
          url: "https://novalink-ai.com/blog-adwat-althkaa-alastnaay-llaamal"
        };
      case "COLLABORATION":
        return {
          type: "collaboration",
          text: "Interested in collaborating with NovaLink?",
          url: "https://novalink-ai.com#contact"
        };
      case "MARKETING":
        return {
          type: "marketing",
          text: "Explore how AI can boost your marketing.",
          url: "https://novalink-ai.com/services-khdmat-nwfa-lynk"
        };
      case "ABOUT":
        return {
          type: "about",
          text: "Learn more about NovaLink’s story and vision.",
          url: "https://novalink-ai.com/about-us-althkaa-alastnaay"
        };
      default:
        return {
          type: "general",
          text: "You can subscribe to stay updated with NovaLink’s AI content.",
          url: "https://novalink-ai.com/ashtrk-alan"
        };
    }
  }

  // Arabic
  switch (intent) {
    case "PURCHASE":
      return {
        type: "purchase",
        text: "تبحث عن حل معين بالذكاء الاصطناعي؟ تصفّح صفحة الخدمات أو اترك بريدك لنتواصل معك.",
        url: "https://novalink-ai.com/services-khdmat-nwfa-lynk"
      };
    case "LEARNING":
      return {
        type: "learning",
        text: "تحب توصلك مقالات عملية عن الذكاء الاصطناعي؟",
        url: "https://novalink-ai.com/blog-adwat-althkaa-alastnaay-llaamal"
      };
    case "COLLABORATION":
      return {
        type: "collaboration",
        text: "لو عندك فكرة شراكة أو تعاون مع نوفا لينك، تقدر تبدأ من صفحة التواصل.",
        url: "https://novalink-ai.com#contact"
      };
    case "MARKETING":
      return {
        type: "marketing",
        text: "اطّلع على كيف نستخدم الذكاء الاصطناعي في التسويق وصناعة المحتوى عبر خدمات نوفا لينك.",
        url: "https://novalink-ai.com/services-khdmat-nwfa-lynk"
      };
    case "ABOUT":
      return {
        type: "about",
        text: "تعرّف أكثر على قصة نوفا لينك ورؤيتها في صفحة من نحن.",
        url: "https://novalink-ai.com/about-us-althkaa-alastnaay"
      };
    default:
      return {
        type: "general",
        text: "تقدر تشترك مع نوفا لينك بالبريد ليصلك كل جديد عن الذكاء الاصطناعي للأعمال.",
        url: "https://novalink-ai.com/ashtrk-alan"
      };
  }
}

// بناء البرومبت مع النية + اللهجة + التاريخ + اللغة + أولوية محتوى نوفا لينك
function buildPrompt(question, context, intent, lang, dialect, historyBlock) {
  const isEN = lang === "en";

  const toneMap = {
    PURCHASE: isEN
      ? "Use a consultative, professional tone focused on concrete solutions."
      : "استخدم نبرة استشارية مهنية وركّز على حلول عملية مناسبة.",
    LEARNING: isEN
      ? "Use a clear, step-by-step teaching tone."
      : "استخدم نبرة تعليمية واضحة على شكل خطوات بسيطة.",
    MARKETING: isEN
      ? "Use a motivational, results-oriented tone—light, not pushy."
      : "استخدم نبرة تحفيزية تركّز على النتائج، بخفة دون إلحاح بيعي.",
    COLLABORATION: isEN
      ? "Use a friendly, collaborative tone that invites partnership."
      : "استخدم نبرة ودودة ومتعاونة تشجّع على الشراكة.",
    ABOUT: isEN
      ? "Use a concise, informative tone about the brand."
      : "استخدم نبرة تعريفية موجزة وواضحة عن العلامة.",
    GENERAL: isEN
      ? "Use a neutral, helpful, and concise tone."
      : "استخدم نبرة محايدة، مفيدة، وموجزة."
  };

  const dialectNote = isEN
    ? "Answer in the same language as the user. If Arabic, use clean Modern Standard Arabic."
    : "أجب بنفس لغة المستخدم. إن كانت عربية فلتكن عربية فصحى سلسة، ويمكنك إضافة لمسة بسيطة من لهجته عند اللزوم دون مبالغة.";

  const langHeader = isEN
    ? `You are an AI assistant representing ${CONFIG.BRAND_NAME}, specialized in practical AI for business.`
    : `أنت مساعد ذكاء اصطناعي يمثل منصة ${CONFIG.BRAND_NAME} المتخصصة في الذكاء الاصطناعي للأعمال.`;

  const instruction = isEN
    ? `Write short, practical answers (max ~${CONFIG.LLM_MAX_TOKENS} tokens). Avoid deep technicalities unless requested. ${toneMap[intent || "GENERAL"] || ""}`
    : `اكتب إجابات قصيرة وعملية (لا تتجاوز تقريبًا ${CONFIG.LLM_MAX_TOKENS} توكن). تجنّب التفاصيل التقنية العميقة إلا عند الطلب. ${toneMap[intent || "GENERAL"] || ""}`;

  let ctx = "";
  if (context && context.title) {
    if (isEN) {
      ctx = `
From ${CONFIG.BRAND_NAME} content (priority source):
Title: ${context.title}
Description: ${context.description || ""}
Excerpt: ${context.excerpt || ""}

If this content is clearly related to the user's question, use it as the main source for your answer.
If it is not related, ignore it and answer from your general AI knowledge.`;
    } else {
      ctx = `
من محتوى ${CONFIG.BRAND_NAME} (مصدر أولوية للإجابة):
العنوان: ${context.title}
الوصف: ${context.description || ""}
مقتطف: ${context.excerpt || ""}

إذا كان هذا المحتوى مرتبطًا بوضوح بسؤال المستخدم، فليكن هو المصدر الأساسي للإجابة.
وإن لم يكن مرتبطًا، تجاهله وأجب من معرفتك العامة بالذكاء الاصطناعي.`;
    }
  }

  const qLabel = isEN ? "User question" : "سؤال المستخدم";
  const hist = historyBlock || "";

  return `${langHeader}
${instruction}
${dialectNote}
${ctx}

${qLabel}:
${question}
${hist}
${isEN ? "Now answer clearly and practically." : "الآن قدّم إجابة واضحة وعملية."}`;
}

// =======================================================
// 🤖 LLM Calls (Gemini 2.0 Flash → Pro → OpenAI) + Fallback
// =======================================================
async function callGemini(model, prompt) {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      maxOutputTokens: CONFIG.LLM_MAX_TOKENS,
      temperature: 0.5
    }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errTxt = await res.text().catch(() => "");
    throw new Error(`Gemini HTTP ${res.status} ${errTxt}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map(p => (p.text || "").trim()).join(" ").trim();
  return text || null;
}

async function callOpenAI(prompt) {
  if (!OPENAI_API_KEY) return null;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: `You are ${CONFIG.BRAND_NAME} assistant specialized in AI for business.` },
        { role: "user", content: prompt }
      ],
      temperature: 0.6,
      max_tokens: CONFIG.LLM_MAX_TOKENS
    })
  });

  if (!res.ok) {
    const errTxt = await res.text().catch(() => "");
    throw new Error(`OpenAI HTTP ${res.status} ${errTxt}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim() || null;
  return text;
}

// محرك القرار: من يجيب؟ Flash → Pro → OpenAI → fallback مؤتمت
async function askLLM(question, context, intent, lang, dialect, history) {
  const prompt = buildPrompt(
    question,
    context,
    intent,
    lang,
    dialect,
    buildHistoryBlock(history, lang)
  );

  // ترتيب المحركات
  const order = CONFIG.USE_GEMINI_FIRST_BY_DEFAULT
    ? ["flash", "pro", "openai"]
    : ["openai", "flash", "pro"];

  for (const who of order) {
    try {
      if (who === "flash") {
        const ans = await callGemini("gemini-2.0-flash", prompt);
        if (ans) return { provider: "gemini-flash", answer: ans };
      } else if (who === "pro") {
        const ans = await callGemini("gemini-2.0-pro", prompt);
        if (ans) return { provider: "gemini-pro", answer: ans };
      } else if (who === "openai") {
        const ans = await callOpenAI(prompt);
        if (ans) return { provider: "openai", answer: ans };
      }
    } catch (e) {
      console.warn(`${who} failed:`, e.message);
      continue;
    }
  }

  // لو وصلنا هنا: كل شيء فشل → سيُستخدم fallback مؤتمت خارجًا
  return { provider: null, answer: null };
}

// =======================================================
// 🗂️ GitHub helpers (feedback & metrics)
// =======================================================
async function ghGetFile(owner, repo, path) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const r = await fetch(url, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
  if (r.status === 404) return { exists: false, sha: null, content: "" };
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`GitHub GET failed: ${r.status} ${t}`);
  }
  const j = await r.json();
  const buff = Buffer.from(j.content || "", "base64").toString("utf-8");
  return { exists: true, sha: j.sha, content: buff };
}

async function ghPutFile(owner, repo, path, content, sha = undefined, message = "update") {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const body = {
    message,
    content: Buffer.from(content, "utf-8").toString("base64"),
    ...(sha ? { sha } : {})
  };
  const r = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`GitHub PUT failed: ${r.status} ${t}`);
  }
  return true;
}

// حدث تحويل (لرفع معدل التحويل لكل نية) — يُستدعى ضمن /api/feedback
async function bumpMetrics(intent) {
  const { OWNER, REPO, METRICS_FILE } = CONFIG.FEEDBACK.GITHUB;
  try {
    const cur = await ghGetFile(OWNER, REPO, METRICS_FILE);
    let obj = { conversions: {}, updated_at: new Date().toISOString() };
    if (cur.exists) {
      try { obj = JSON.parse(cur.content || "{}"); } catch (_) {}
    }
    const key = intent || "GENERAL";
    obj.conversions = obj.conversions || {};
    obj.conversions[key] = (obj.conversions[key] || 0) + 1;
    obj.updated_at = new Date().toISOString();
    await ghPutFile(OWNER, REPO, METRICS_FILE, JSON.stringify(obj, null, 2), cur.sha, "bump metrics");
  } catch (e) {
    console.warn("Metrics update failed:", e.message);
  }
}

// =======================================================
// 📬 API: Nova AI
// =======================================================
app.post("/api/nova-ai", async (req, res) => {
  try {
    const { question, context, history } = req.body || {};
    if (!question || typeof question !== "string") {
      return res.status(400).json({ ok: false, error: "no_question" });
    }

    const language = detectLanguage(question);       // "ar" | "en"
    const dialect  = language === "ar" ? detectDialect(question) : "n/a";
    const intent   = analyzeIntent(question);
    const inAIDomain = isAIDomain(question);

    if (CONFIG.LOG_REQUESTS) {
      console.log("🗨️ /api/nova-ai:", {
        q: question.slice(0, 60),
        lang: language,
        intent,
        inAIDomain,
        prefer: CONFIG.USE_GEMINI_FIRST_BY_DEFAULT ? "gemini-first" : "openai-first"
      });
    }

    let provider = null;
    let answer = null;

    // 1) لو السؤال خارج مجال الذكاء الاصطناعي → إجابة مؤتمتة مباشرة (بوت متخصص)
    if (!inAIDomain) {
      provider = "automated-non-ai";
      answer = getAutomatedReply(intent, language);
    } 
    // 2) لو السؤال ضمن مجال AI لكن لا يوجد مفتاح Gemini → لا نخاطر، نستخدم المؤتمت
    else if (!GEMINI_API_KEY) {
      provider = "automated-no-gemini-key";
      answer = getAutomatedReply(intent, language);
    } 
    // 3) سؤال ضمن AI + مفتاح متوفر → نحاول Gemini → ثم fallback مؤتمت لو فشل
    else {
      const llmResult = await askLLM(
        question,
        context,
        intent,
        language,
        dialect,
        Array.isArray(history) ? history : []
      );
      provider = llmResult.provider;
      answer = llmResult.answer;

      if (!answer) {
        provider = "automated-fallback";
        answer = getAutomatedReply(intent, language);
      }
    }

    const cta = buildCTA(intent, language);

    return res.json({
      ok: true,
      provider,
      intent,
      language,
      dialect,
      inAIDomain,
      answer,
      cta
    });
  } catch (err) {
    console.error("Proxy error:", err);

    // حتى في حالة فشل غير متوقع، نعيد رد مؤتمت محترم
    const fallbackAnswer = getAutomatedReply("GENERAL", "ar");
    return res.status(200).json({
      ok: true,
      provider: "automated-hard-fallback",
      intent: "GENERAL",
      language: "ar",
      dialect: "msa",
      inAIDomain: false,
      answer: fallbackAnswer,
      cta: buildCTA("GENERAL", "ar")
    });
  }
});

// =======================================================
// 📨 API: Feedback (GitHub + Reach) + Metrics bump
// =======================================================
app.post("/api/feedback", async (req, res) => {
  try {
    const { email, name, note, intent, dialect, language, lead_source, brand } = req.body || {};
    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "invalid_email" });
    }

    // 1) GitHub CSV append (create if not exists)
    if (CONFIG.FEEDBACK.ENABLED && CONFIG.FEEDBACK.GITHUB.ENABLED && GITHUB_TOKEN) {
      const { OWNER, REPO, FEEDBACK_FILE } = CONFIG.FEEDBACK.GITHUB;
      let cur;
      try {
        cur = await ghGetFile(OWNER, REPO, FEEDBACK_FILE);
      } catch (e) {
        console.error("GitHub read error:", e.message);
        return res.json({ ok: false, error: "feedback_failed" });
      }

      const row = [
        new Date().toISOString(),
        email,
        (name || "").replace(/,/g, " "),
        (note || "").replace(/,/g, " "),
        (intent || "GENERAL"),
        (dialect || ""),
        (language || ""),
        (lead_source || "NovaBot v2.4"),
        (brand || CONFIG.BRAND_NAME)
      ].join(",") + "\n";

      const nextContent = cur.exists
        ? (cur.content + row)
        : ("timestamp,email,name,note,intent,dialect,language,lead_source,brand\n" + row);

      try {
        await ghPutFile(OWNER, REPO, FEEDBACK_FILE, nextContent, cur.sha, "add feedback row");
      } catch (e) {
        console.error("GitHub write error:", e.message);
        return res.json({ ok: false, error: "feedback_failed" });
      }

      // 2) Metrics bump (conversion per intent)
      await bumpMetrics(intent || "GENERAL");
    }

    // 3) Reach push (optional)
    if (CONFIG.FEEDBACK.REACH.ENABLED && CONFIG.FEEDBACK.REACH.API_KEY) {
      try {
        await fetch(CONFIG.FEEDBACK.REACH.API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${CONFIG.FEEDBACK.REACH.API_KEY}`
          },
          body: JSON.stringify({
            email,
            name,
            note: note || "subscription-from-chat",
            tags: [intent || "GENERAL", "NovaBot", "Lead"],
            metadata: { dialect, language, brand: brand || CONFIG.BRAND_NAME }
          })
        });
      } catch (e) {
        console.warn("Reach push failed:", e.message);
        // نكمل دون فشل عام، طالما GitHub سجّل
      }
    }

    return res.json({ ok: true, message: "تم حفظ البريد بنجاح." });
  } catch (err) {
    console.error("Feedback Error:", err);
    res.json({ ok: false, error: "feedback_failed" });
  }
});

// اختبار مفاتيح Gemini سريع
app.get("/api/test/gemini", async (_req, res) => {
  if (!GEMINI_API_KEY) return res.json({ ok: false, message: "GEMINI_API_KEY missing" });
  try {
    const t = await callGemini("gemini-2.0-flash", "ping");
    return res.json({ ok: true, provider: "gemini-2.0-flash", answer: (t || "").slice(0, 60) });
  } catch (e) {
    return res.json({ ok: false, message: e.message || "Gemini failed" });
  }
});

// Health
app.get("/", (_req, res) => {
  res.send("✅ NovaProxy v2.4 Business AI Edition is running.");
});

// =======================================================
// 🟢 RUN
// =======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 NovaProxy v2.4 listening on port ${PORT}`);
});
