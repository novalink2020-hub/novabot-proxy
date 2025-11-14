// =======================================================
// NovaProxy v2.3 — Cloudflare Worker Edition
// Gemini via Worker → (fallback) OpenAI
// نوفا لينك — محمد أبو سنينة
// =======================================================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
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
  SMART_MARKETING: {
    ENABLED: true,
    MODE: "hybrid"
  },
  FEEDBACK: {
    ENABLED: true,
    GITHUB: {
      ENABLED: true,
      OWNER: "novalink2020-hub",
      REPO: "novabot-proxy",
      FEEDBACK_FILE: "feedback.csv",
      METRICS_FILE: "metrics.json"
    },
    REACH: {
      ENABLED: true,
      API_URL: "https://reach.hostinger.com/api/v1/subscribers",
      API_KEY: process.env.REACH_API_KEY || ""
    }
  }
};

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

function detectLanguage(text = "") {
  const enOnly = /^[\s0-9a-zA-Z.,;:!?'"()@#%&*+\-_/\\|[\]{}<>]+$/;
  return enOnly.test(text.trim()) ? "en" : "ar";
}

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
  return "msa";
}

function analyzeIntent(question = "") {
  const q = (question || "").toLowerCase();
  const hit = (list) => list.some(w => q.includes(w));

  if (hit(["سعر","شراء","اشتراك","تكلفة","خدمة","طلب","باقة","عروض"])) return "PURCHASE";
  if (hit(["تعلم","شرح","كيف","افهم","خطوات","أساسيات","مقال","تدوينة"])) return "LEARNING";
  if (hit(["تسويق","مبيعات","اعلان","ترويج","تحويل","براند","علامة"])) return "MARKETING";
  if (hit(["تعاون","شراكة","رعاية","مشروع مشترك","اتفاق","تواصل معنا"])) return "COLLABORATION";
  if (hit(["نوفا لينك","من انتم","من أنتم","رؤيتكم","هدفكم","قصتكم"])) return "ABOUT";
  return "GENERAL";
}

function buildHistoryBlock(history = [], lang = "ar") {
  if (!Array.isArray(history) || !history.length) return "";
  const last = history.slice(-6);
  const lines = last.map(h => {
    const role = h.role === "assistant"
      ? (lang === "en" ? "assistant" : "المساعد")
      : (lang === "en" ? "user" : "المستخدم");
    return `${role}: ${h.content || ""}`;
  }).join("\n");
  return `\n\n${lang === "en" ? "Recent chat history" : "تاريخ المحادثة الأخير"}:\n${lines}\n`;
}

function buildCTA(intent, lang = "ar") {
  if (lang === "en") {
    switch (intent) {
      case "PURCHASE":
        return {
          type: "purchase",
          text: "Would you like tailored help choosing the right solution? Visit our Services or leave your email.",
          url: "https://novalink-ai.com/services-khdmat-nwfa-lynk"
        };
      case "LEARNING":
        return {
          type: "learning",
          text: "Want practical AI articles? Share your email.",
          url: "https://novalink-ai.com/blog-adwat-althkaa-alastnaay-llaamal"
        };
      case "COLLABORATION":
        return {
          type: "collaboration",
          text: "We’re open to partnerships—contact us.",
          url: "https://novalink-ai.com#contact"
        };
      case "MARKETING":
        return {
          type: "marketing",
          text: "Want an AI marketing guide? Enter your email.",
          url: "https://novalink-ai.com/services-khdmat-nwfa-lynk"
        };
      case "ABOUT":
        return {
          type: "about",
          text: "Learn more about NovaLink on our About page.",
          url: "https://novalink-ai.com/about-us-althkaa-alastnaay"
        };
      default:
        return {
          type: "general",
          text: "Subscribe for updates.",
          url: "https://novalink-ai.com/ashtrk-alan"
        };
    }
  }

  switch (intent) {
    case "PURCHASE":
      return {
        type: "purchase",
        text: "هل ترغب بمساعدة في اختيار الحل الأنسب؟",
        url: "https://novalink-ai.com/services-khdmat-nwfa-lynk"
      };
    case "LEARNING":
      return {
        type: "learning",
        text: "هل تودّ مقالات عملية عن الذكاء الاصطناعي؟",
        url: "https://novalink-ai.com/blog-adwat-althkaa-alastnaay-llaamal"
      };
    case "COLLABORATION":
      return {
        type: "collaboration",
        text: "فريق نوفا لينك منفتح على التعاون.",
        url: "https://novalink-ai.com#contact"
      };
    case "MARKETING":
      return {
        type: "marketing",
        text: "هل ترغب بدليل عملي للتسويق بالذكاء الاصطناعي؟",
        url: "https://novalink-ai.com/services-khdmat-nwfa-lynk"
      };
    case "ABOUT":
      return {
        type: "about",
        text: "تعرّف أكثر على نوفا لينك.",
        url: "https://novalink-ai.com/about-us-althkaa-alastnaay"
      };
    default:
      return {
        type: "general",
        text: "يسعدنا أن نرافقك خطوة بخطوة.",
        url: "https://novalink-ai.com/ashtrk-alan"
      };
  }
}

function buildPrompt(question, context, intent, lang, dialect, historyBlock) {
  const isEN = lang === "en";

  const toneMap = {
    PURCHASE: isEN ? "Use a consultative tone." : "استخدم نبرة استشارية.",
    LEARNING: isEN ? "Use a teaching tone." : "استخدم نبرة تعليمية.",
    MARKETING: isEN ? "Use a motivational tone." : "استخدم نبرة تحفيزية.",
    COLLABORATION: isEN ? "Use a friendly tone." : "استخدم نبرة ودودة.",
    ABOUT: isEN ? "Use an informative tone." : "استخدم نبرة تعريفية.",
    GENERAL: isEN ? "Use a concise tone." : "استخدم نبرة مختصرة."
  };

  const dialectNote = isEN
    ? "If Arabic, answer in standard Arabic with light dialect hints."
    : "أجب بالعربية الفصحى مع لمسة لهجة بسيطة إن لزم.";

  const langHeader = isEN
    ? `You are an AI assistant of ${CONFIG.BRAND_NAME}.`
    : `أنت مساعد ذكاء اصطناعي يمثل ${CONFIG.BRAND_NAME}.`;

  const instruction = isEN
    ? `Write short answers. ${toneMap[intent] || ""}`
    : `اكتب إجابات قصيرة. ${toneMap[intent] || ""}`;

  let ctx = "";
  if (context && context.title) {
    ctx = isEN
      ? `From ${CONFIG.BRAND_NAME}:\n${context.title}\n${context.description || ""}`
      : `من ${CONFIG.BRAND_NAME}:\n${context.title}\n${context.description || ""}`;
  }

  return `${langHeader}
${instruction}
${dialectNote}
${ctx}

${isEN ? "User question:" : "سؤال المستخدم:"}
${question}

${historyBlock}

${isEN ? "Answer clearly:" : "قدّم إجابة واضحة:"}`;
}

// =======================================================
// 🤖 LLM Calls (Cloudflare Worker → Gemini)
// =======================================================

async function callGemini(model, prompt) {
  const url = "https://novalinksecuregeminiproxy.novalink2020.workers.dev";

  const body = { question: prompt };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errTxt = await res.text().catch(() => "");
    throw new Error(`Worker HTTP ${res.status} ${errTxt}`);
  }

  const data = await res.json();
  const text = data?.answer || null;

  return text;
}

// fallback OpenAI
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
        { role: "system", content: `You are ${CONFIG.BRAND_NAME} assistant.` },
        { role: "user", content: prompt }
      ],
      temperature: 0.6,
      max_tokens: 300
    })
  });

  if (!res.ok) {
    const errTxt = await res.text().catch(() => "");
    throw new Error(`OpenAI HTTP ${res.status} ${errTxt}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || null;
}

// =======================================================
// Ask LLM unified
// =======================================================
async function askLLM(question, context, intent, language, dialect, history) {
  const prompt = buildPrompt(
    question,
    context,
    intent,
    language,
    dialect,
    buildHistoryBlock(history, language)
  );

  // نستخدم Worker دائماً أولاً
  const order = ["worker", "openai"];

  for (const who of order) {
    try {
      if (who === "worker") {
        const ans = await callGemini("gemini-2.0-flash", prompt);
        if (ans) return { provider: "worker", answer: ans };
      }

      if (who === "openai") {
        const ans = await callOpenAI(prompt);
        if (ans) return { provider: "openai", answer: ans };
      }

    } catch (err) {
      console.warn(`${who} failed:`, err.message);
      continue;
    }
  }

  return { provider: null, answer: null };
}

// =======================================================
// 📬 API: Nova AI
// =======================================================
app.post("/api/nova-ai", async (req, res) => {
  try {
    const { question, context, history } = req.body || {};

    if (!question) {
      return res.json({ ok: false, error: "no_question" });
    }

    const language = detectLanguage(question);
    const dialect  = language === "ar" ? detectDialect(question) : "n/a";
    const intent   = analyzeIntent(question);

    const { provider, answer } = await askLLM(
      question,
      context,
      intent,
      language,
      dialect,
      Array.isArray(history) ? history : []
    );

    if (!answer) {
      return res.json({ ok: false, error: "ai_failed", message: "تعذّر توليد الإجابة حالياً." });
    }

    const cta = buildCTA(intent, language);

    res.json({
      ok: true,
      provider,
      intent,
      language,
      dialect,
      answer,
      cta
    });

  } catch (err) {
    console.error("Main error:", err);
    res.json({ ok: false, error: "server_error" });
  }
});

// =======================================================
// Health & Test
// =======================================================
app.get("/", (_req, res) => {
  res.send("✅ NovaProxy v2.3 Cloudflare Worker Edition is running.");
});

app.get("/api/test/gemini", async (_req, res) => {
  try {
    const t = await callGemini("gemini-2.0-flash", "ping");
    return res.json({ ok: true, provider: "worker", answer: t });
  } catch (err) {
    return res.json({ ok: false, error: err.message });
  }
});

// =======================================================
// RUN
// =======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 NovaProxy v2.3 listening on port ${PORT}`)
);
