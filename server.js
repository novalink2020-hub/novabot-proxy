// =======================================================
// NovaProxy v2.0 — Smart Marketing Edition (Gemini → OpenAI)
// مصمم ليعمل مع NovaBot v4.8 أو أي واجهة دردشة ذكية مماثلة
// المطوّر: محمد أبو سنينة – NOVALINK.AI
// =======================================================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

// =======================================================
// ⚙️ CONFIG – قسم الإعدادات (يمكنك تعديله حسب العميل أو المشروع)
// =======================================================

const CONFIG = {
  BRAND_NAME: "نوفا لينك", // اسم العلامة التجارية الذي سيظهر في البرومبت
  USE_GEMINI_FIRST_BY_DEFAULT: true, // true: Gemini أولاً – false: OpenAI أولاً
  ALLOWED_ORIGINS: [
    "https://novalink-ai.com",
    "https://www.novalink-ai.com"
  ],
  LOG_REQUESTS: true,

  // ⚙️ إعدادات التسويق الذكي
  SMART_MARKETING: {
    ENABLED: true, // تفعيل التحليل التسويقي والسلوكي
    MODE: "hybrid", // "hybrid" = مزيج متوازن بين توعوي وبيعي
  },

  // ⚙️ إعدادات تخزين الإيميلات والفيدباك
  FEEDBACK: {
    ENABLED: true,
    GITHUB: {
      ENABLED: true,
      FILE_PATH: "feedback.csv", // اسم الملف الذي سيُخزن في GitHub
      REPO: "novabot-proxy",
      OWNER: "novalink2020-hub"
    },
    REACH: {
      ENABLED: true, // تفعيل الإرسال إلى Reach
      API_URL: "https://reach.hostinger.com/api/v1/subscribers", // لاحقًا يمكن تغييره
      API_KEY: process.env.REACH_API_KEY || "" // ضع مفتاح Reach هنا لاحقًا
    }
  }
};

// =======================================================
// 🔐 مفاتيح البيئة
// =======================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

console.log("🔍 Gemini Key Status:", GEMINI_API_KEY ? "✅ Loaded" : "❌ Missing");
console.log("🔍 OpenAI Key Status:", OPENAI_API_KEY ? "✅ Loaded" : "❌ Missing");

// =======================================================
// 🚀 إعداد السيرفر
// =======================================================

const app = express();
app.use(express.json());
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (CONFIG.ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"), false);
  }
}));

// =======================================================
// 🧠 وحدة تحليل نية المستخدم التسويقية
// =======================================================

function analyzeIntent(question) {
  const text = question.toLowerCase();

  if (text.match(/سعر|شراء|اشتراك|تكلفة|خدمة|طلب/)) return "PURCHASE";
  if (text.match(/تعلم|شرح|كيف|افهم|خطوات|أساسيات/)) return "LEARNING";
  if (text.match(/تسويق|مبيعات|اعلان|ترويج|تحويل/)) return "MARKETING";
  if (text.match(/تعاون|شراكة|رعاية|مشروع مشترك/)) return "COLLABORATION";
  if (text.match(/نوفا لينك|من أنتم|رؤيتكم|قصتكم/)) return "ABOUT";

  return "GENERAL";
}

// =======================================================
// 💬 بناء البرومبت الذكي (تسويقي + تعليمي + متوازن)
// =======================================================

function buildPrompt(question, context, intent) {
  let prompt = `أنت مساعد عربي يمثل منصة ${CONFIG.BRAND_NAME} المتخصصة في الذكاء الاصطناعي وتطوير الأعمال.\n`;
  prompt += `أجب بجمل قصيرة وواضحة وبأسلوب عملي.\n`;
  prompt += `تحدث كخبير ودود يقدم نصائح عملية واقعية.\n`;

  // موازنة أسلوب التسويق حسب نية المستخدم
  if (CONFIG.SMART_MARKETING.ENABLED) {
    if (intent === "PURCHASE") {
      prompt += `عند تقديم الإجابة، اربطها بخدمة أو حل عملي يمكن أن تقدمه المنصة دون إلحاح مباشر.\n`;
    } else if (intent === "LEARNING") {
      prompt += `اجعل الإجابة تعليمية بسيطة، واختتم باقتراح زيارة المدونة لزيادة الفهم.\n`;
    } else if (intent === "MARKETING") {
      prompt += `أضف جملة خفيفة عن أهمية استخدام أدوات ${CONFIG.BRAND_NAME} في تحقيق نتائج تسويقية أفضل.\n`;
    } else if (intent === "COLLABORATION") {
      prompt += `اجعل نبرة الحديث تعاونية ومشجعة على التواصل مع المنصة.\n`;
    }
  }

  if (context && context.title) {
    prompt += `من محتوى ${CONFIG.BRAND_NAME}:\nالعنوان: ${context.title}\nالوصف: ${context.description || ""}\nمقتطف: ${context.excerpt || ""}\n\n`;
  }

  prompt += `سؤال المستخدم:\n${question}\n\n`;
  prompt += `الآن أجب بأسلوب عملي واقعي دون مبالغة تسويقية أو تعقيد تقني.`;
  return prompt;
}

// =======================================================
// 🤖 دوال استدعاء Gemini و OpenAI
// =======================================================

async function callGemini(question, context, intent) {
  if (!GEMINI_API_KEY) return null;

  const prompt = buildPrompt(question, context, intent);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] })
  });

  if (!res.ok) throw new Error("Gemini HTTP " + res.status);
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map(p => p.text || "").join(" ").trim() || null;
}

const data = await res.json();

async function callOpenAI(question, context, intent) {
  if (!OPENAI_API_KEY) return null;

  const prompt = buildPrompt(question, context, intent);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + OPENAI_API_KEY
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: `أنت مساعد يمثل منصة ${CONFIG.BRAND_NAME}.` },
        { role: "user", content: prompt }
      ],
      temperature: 0.6,
      max_tokens: 120
    })
  });

  if (!res.ok) throw new Error("OpenAI HTTP " + res.status);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || null;
}

// =======================================================
// 📬 نقطة النهاية: الذكاء الاصطناعي
// =======================================================

app.post("/api/nova-ai", async (req, res) => {
  try {
    const { question, context } = req.body || {};
    if (!question) return res.status(400).json({ ok: false, error: "no_question" });

    const intent = analyzeIntent(question);
    let answer = null;

    if (CONFIG.USE_GEMINI_FIRST_BY_DEFAULT) {
      answer = await callGemini(question, context, intent).catch(() => null);
      if (!answer) answer = await callOpenAI(question, context, intent).catch(() => null);
    } else {
      answer = await callOpenAI(question, context, intent).catch(() => null);
      if (!answer) answer = await callGemini(question, context, intent).catch(() => null);
    }

    if (!answer)
      return res.json({ ok: false, error: "ai_failed", message: "تعذر توليد الإجابة حالياً." });

    res.json({ ok: true, intent, answer });
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// =======================================================
// 📨 نقطة النهاية: Feedback (GitHub + Reach)
// =======================================================

app.post("/api/feedback", async (req, res) => {
  try {
    const { email, name, note } = req.body;
    if (!email || !email.includes("@"))
      return res.status(400).json({ ok: false, error: "invalid_email" });

    // ===== 1️⃣ حفظ في GitHub =====
    if (CONFIG.FEEDBACK.GITHUB.ENABLED && GITHUB_TOKEN) {
      const repo = CONFIG.FEEDBACK.GITHUB.REPO;
      const owner = CONFIG.FEEDBACK.GITHUB.OWNER;
      const filePath = CONFIG.FEEDBACK.GITHUB.FILE_PATH;

      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
      const content = Buffer.from(`${new Date().toISOString()},${email},${name || ""},${note || ""}\n`).toString("base64");

      const check = await fetch(apiUrl, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }
      });
      const file = await check.json();
      const sha = file.sha || undefined;

      await fetch(apiUrl, {
        method: "PUT",
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "Add new feedback",
          content,
          sha
        })
      });
    }

    // ===== 2️⃣ إرسال إلى Reach =====
    if (CONFIG.FEEDBACK.REACH.ENABLED && CONFIG.FEEDBACK.REACH.API_KEY) {
      await fetch(CONFIG.FEEDBACK.REACH.API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CONFIG.FEEDBACK.REACH.API_KEY}`
        },
        body: JSON.stringify({ email, name, note })
      });
    }

    res.json({ ok: true, message: "تم حفظ البريد بنجاح في GitHub وReach." });
  } catch (err) {
    console.error("Feedback Error:", err);
    res.json({ ok: false, error: "feedback_failed" });
  }
});

// =======================================================
// 🧩 فحص التشغيل
// =======================================================

app.get("/", (req, res) => {
  res.send("✅ NovaProxy Smart Marketing Edition is running successfully.");
});

// =======================================================
// 🟢 تشغيل السيرفر
// =======================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 NovaProxy v2.0 listening on port ${PORT}`));
