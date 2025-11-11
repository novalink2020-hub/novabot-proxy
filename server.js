// ============================================================================
// NovaProxy v1.5 Simplified — Hybrid AI Proxy + Email Collector
// يعمل مع NovaBot v4.7 / v4.8
// المطوّر: محمد أبو سنينة – NOVALINK.AI
// ============================================================================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");

// ======================= ⚙️ CONFIG – إعدادات السيرفر =======================

const CONFIG = {
  BRAND_NAME: "نوفا لينك",
  USE_GEMINI_FIRST_BY_DEFAULT: true,
  ALLOWED_ORIGINS: [
    "https://novalink-ai.com",
    "https://www.novalink-ai.com"
  ],
  LOG_REQUESTS: true
};

// مفاتيح واجهات الذكاء الاصطناعي (يتم وضعها في Render Environment)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

// ============================= إنشاء تطبيق Express =========================

const app = express();
app.use(express.json());

// CORS – السماح فقط لدومينات نوفا لينك
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
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
    `أنت مساعد عربي يمثل منصة ${CONFIG.BRAND_NAME} المتخصصة في الذكاء الاصطناعي وتطوير الأعمال.\n` +
    `أجب بجمل قصيرة وواضحة وبأسلوب عملي يشبه استشارة صديق خبير.\n` +
    `تجنب المصطلحات التقنية المعقدة ولا تذكر أنك روبوت.\n\n`;

  if (context && context.title) {
    base +=
      `معلومات من محتوى ${CONFIG.BRAND_NAME}:\n` +
      `العنوان: ${context.title}\n` +
      `الوصف: ${context.description || ""}\n` +
      `مقتطف: ${context.excerpt || ""}\n\n`;
  }

  base += `سؤال المستخدم:\n${question}\n\n`;
  base +=
    "قدّم إجابة عملية وواضحة بالعربية الفصحى، بأسلوب واقعي ومهني يشجع المستخدم على التطبيق أو اتخاذ القرار.";
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
    contents: [{ role: "user", parts: [{ text: prompt }] }]
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    console.error("Gemini HTTP Error:", res.status);
    throw new Error("Gemini HTTP " + res.status);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p) => (p.text || "").trim())
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
    console.error("OpenAI HTTP Error:", res.status);
    throw new Error("OpenAI HTTP " + res.status);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || null;
}

// ======================= المسار الرئيسي: /api/nova-ai =======================

app.post("/api/nova-ai", async (req, res) => {
  try {
    const { question, context, prefer } = req.body || {};
    if (!question || typeof question !== "string") {
      return res.status(400).json({ ok: false, error: "no_question" });
    }

    if (CONFIG.LOG_REQUESTS) {
      console.log("🗨️ سؤال جديد:", question.slice(0, 70) + "...");
    }

    let answer = null;
    const useGeminiFirst =
      prefer === "gemini-first"
        ? true
        : prefer === "openai-first"
        ? false
        : CONFIG.USE_GEMINI_FIRST_BY_DEFAULT;

    if (useGeminiFirst) {
      try {
        answer = await callGemini(question, context);
      } catch {
        console.warn("⚠️ Gemini فشل — الانتقال إلى OpenAI");
      }
      if (!answer) {
        try {
          answer = await callOpenAI(question, context);
        } catch {
          console.warn("⚠️ OpenAI أيضًا فشل");
        }
      }
    } else {
      try {
        answer = await callOpenAI(question, context);
      } catch {
        console.warn("⚠️ OpenAI فشل — الانتقال إلى Gemini");
      }
      if (!answer) {
        try {
          answer = await callGemini(question, context);
        } catch {
          console.warn("⚠️ Gemini أيضًا فشل");
        }
      }
    }

    if (!answer) {
      return res.json({
        ok: false,
        message: "تعذر توليد الإجابة حالياً."
      });
    }

    res.json({ ok: true, answer });
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// ============================ 📩 Feedback API ============================
// يجمع الإيميلات من المستخدمين داخل الدردشة ويخزنها في feedback.csv

app.post("/api/feedback", async (req, res) => {
  try {
    const { email, name, intent } = req.body || {};
    if (!email) return res.status(400).json({ ok: false, error: "missing_email" });

    const timestamp = new Date().toISOString();
    const safeName = name || "N/A";
    const safeIntent = intent || "unspecified";
    const line = `${timestamp},${safeName},${email},${safeIntent}\n`;

    fs.appendFileSync("feedback.csv", line, "utf8");
    console.log("📥 Email saved:", { email, intent });

    return res.json({ ok: true, message: "Email stored successfully." });
  } catch (err) {
    console.error("⚠️ Feedback error:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// ================== اختبار التشغيل ==================

app.get("/", (req, res) => {
  res.send("✅ Nova AI Proxy + Email Collector is running.");
});

// ============================= تشغيل السيرفر =============================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 NovaProxy v1.5 running on port", PORT);
});
