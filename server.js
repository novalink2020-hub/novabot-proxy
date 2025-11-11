// NovaProxy v1.0 — Hybrid AI Proxy (Gemini → OpenAI)
// مصمم ليعمل مع NovaBot v4.6 أو أي بوت مشابه.
// المطوّر: محمد أبو سنينة – NOVALINK.AI

require("dotenv").config();
const express = require("express");
const cors = require("cors");

// ======================= ⚙️ CONFIG – إعدادات السيرفر =======================
// يمكنك تعديل هذا القسم فقط لكل عميل جديد دون لمس بقية الكود.

const CONFIG = {
  BRAND_NAME: "نوفا لينك", // اسم العلامة التجارية التي سيذكرها البوت في البرومبت
  USE_GEMINI_FIRST_BY_DEFAULT: true, // true: Gemini أولاً، false: OpenAI أولاً
  ALLOWED_ORIGINS: [
    "https://novalink-ai.com",
    "https://www.novalink-ai.com"
    // يمكنك إضافة دومينات عملائك هنا لاحقاً
  ],
  LOG_REQUESTS: true // true لطباعة بعض المعلومات في الـ Console للمراجعة
};

// مفاتيح API (لا تضعها في الكود، فقط في ملفات البيئة أو إعدادات Render)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

// ============================= إنشاء تطبيق Express =========================

const app = express();
app.use(express.json());

// CORS – السماح فقط للدومينات المحددة في CONFIG
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // يسمح لأدوات مثل Postman
      if (CONFIG.ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"), false);
    }
  })
);

// ====================== دالة بناء البرومبت لنوفا لينك ======================

function buildPrompt(question, context) {
  let base =
    `أنت مساعد عربي محترف يمثل منصة ${CONFIG.BRAND_NAME} المتخصصة في الذكاء الاصطناعي وتطوير الأعمال.\n` +
    `أجب بجمل قصيرة وواضحة وبأسلوب عملي يشبه استشارة صديق خبير.\n` +
    `لا تستخدم مصطلحات تقنية معقدة إلا إذا كان المستخدم يبدو متقدماً أو طلب ذلك.\n` +
    `تجنّب ذكر الأكواد البرمجية إلا إذا كان السؤال برمجي صريح.\n` +
    `لا تذكر أنك نموذج ذكاء اصطناعي أو أنك روبوت.\n\n`;

  if (context && context.title) {
    base +=
      `معلومات سياقية من محتوى ${CONFIG.BRAND_NAME} (يمكنك الاستفادة منها إن كانت مفيدة للسؤال):\n` +
      `العنوان: ${context.title}\n` +
      `الوصف: ${context.description || ""}\n` +
      `مقتطف: ${context.excerpt || ""}\n\n`;
  }

  base += `سؤال المستخدم:\n${question}\n\n`;
  base +=
    "الآن قدّم إجابة عملية وواضحة بالعربية، مع نصائح قابلة للتنفيذ، دون ذكر تفاصيل تقنية زائدة أو الإشارة إلى واجهات برمجة تطبيقات.";
  return base;
}

// =========================== استدعاء Gemini ===========================

async function callGemini(question, context) {
  if (!GEMINI_API_KEY) return null;

  const prompt = buildPrompt(question, context);

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
    GEMINI_API_KEY;

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ]
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    console.error("Gemini HTTP Error:", res.status, await res.text());
    throw new Error("Gemini HTTP " + res.status);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts
    .map((p) => (p.text || "").trim())
    .join(" ")
    .trim();

  return text || null;
}

// =========================== استدعاء OpenAI ===========================

async function callOpenAI(question, context) {
  if (!OPENAI_API_KEY) return null;

  const prompt = buildPrompt(question, context);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + OPENAI_API_KEY
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `أنت مساعد عربي يمثل علامة ${CONFIG.BRAND_NAME} وتقدّم إجابات عملية وبسيطة.`
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.6,
      max_tokens: 500
    })
  });

  if (!res.ok) {
    console.error("OpenAI HTTP Error:", res.status, await res.text());
    throw new Error("OpenAI HTTP " + res.status);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim() || null;
  return text;
}

// ======================= المسار الرئيسي: /api/nova-ai =======================

app.post("/api/nova-ai", async (req, res) => {
  try {
    const { question, context, prefer } = req.body || {};

    if (!question || typeof question !== "string") {
      return res
        .status(400)
        .json({ ok: false, error: "no_question", message: "Missing 'question'." });
    }

    if (CONFIG.LOG_REQUESTS) {
      console.log("🗨️ New request:", {
        question: question.slice(0, 80) + (question.length > 80 ? "..." : ""),
        hasContext: !!context
      });
    }

    let answer = null;

    // تحديد من نستخدم أولاً: Gemini أو OpenAI
    const useGeminiFirst =
      prefer === "gemini-first"
        ? true
        : prefer === "openai-first"
        ? false
        : CONFIG.USE_GEMINI_FIRST_BY_DEFAULT;

    if (useGeminiFirst) {
      try {
        answer = await callGemini(question, context);
      } catch (e) {
        console.warn("Gemini failed, trying OpenAI…", e.message);
      }
      if (!answer) {
        try {
          answer = await callOpenAI(question, context);
        } catch (e) {
          console.warn("OpenAI also failed:", e.message);
        }
      }
    } else {
      try {
        answer = await callOpenAI(question, context);
      } catch (e) {
        console.warn("OpenAI failed, trying Gemini…", e.message);
      }
      if (!answer) {
        try {
          answer = await callGemini(question, context);
        } catch (e) {
          console.warn("Gemini also failed:", e.message);
        }
      }
    }

    if (!answer) {
      return res.json({
        ok: false,
        error: "ai_failed",
        message: "تعذر توليد الإجابة حالياً من نماذج الذكاء الاصطناعي."
      });
    }

    res.json({
      ok: true,
      answer
    });
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// ================== مسار اختباري للتأكد أن السيرفر شغال ==================

app.get("/", (req, res) => {
  res.send("✅ Nova AI Proxy is running.");
});

// ============================= تشغيل السيرفر =============================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Nova AI Proxy listening on port", PORT);
});
