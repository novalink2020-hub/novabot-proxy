// server.js — NovaLink Hybrid AI Proxy
// يعمل مع Gemini أولاً، ثم OpenAI احتياطياً، مع دعم Dotenv تلقائي.

import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// السماح فقط لدومين نوفا لينك
const allowedOrigins = [
  "https://novalink-ai.com",
  "https://www.novalink-ai.com"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"), false);
    }
  })
);

// مفاتيح البيئة
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// صياغة برومبت بنغمة نوفا لينك
function buildPrompt(question, context) {
  let base =
    "أنت مساعد عربي محترف يمثل منصة نوفا لينك المهتمة بالذكاء الاصطناعي للأعمال.\n" +
    "أجب بجمل قصيرة وواضحة وبأسلوب بشري عملي.\n" +
    "لا تذكر تفاصيل تقنية معقدة إلا عند طلب المستخدم.\n" +
    "تحدث كنصيحة من صديق خبير وليس كآلة.\n\n";

  if (context && context.title) {
    base += `🧠 من محتوى نوفا لينك:\n` +
            `العنوان: ${context.title}\n` +
            `الوصف: ${context.description || ""}\n` +
            `مقتطف: ${context.excerpt || ""}\n\n`;
  }

  base += `سؤال المستخدم:\n${question}\n\n`;
  base += "الآن أجب بالعربية الواضحة دون الإشارة لكونك نموذج ذكاء اصطناعي.";
  return base;
}

// Gemini
async function callGemini(question, context) {
  if (!GEMINI_API_KEY) return null;
  const prompt = buildPrompt(question, context);

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      })
    }
  );

  if (!res.ok) throw new Error("Gemini HTTP " + res.status);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
}

// OpenAI
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
        { role: "system", content: "أنت مساعد عربي يمثل نوفا لينك." },
        { role: "user", content: prompt }
      ],
      temperature: 0.6,
      max_tokens: 500
    })
  });

  if (!res.ok) throw new Error("OpenAI HTTP " + res.status);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || null;
}

// نقطة النهاية الرئيسية
app.post("/api/nova-ai", async (req, res) => {
  try {
    const { question, context, prefer } = req.body || {};
    if (!question) {
      return res.status(400).json({ ok: false, error: "no_question" });
    }

    let answer = null;
    const useGeminiFirst = prefer !== "openai-first";

    if (useGeminiFirst) {
      answer = await callGemini(question, context).catch(() => null);
      if (!answer) answer = await callOpenAI(question, context).catch(() => null);
    } else {
      answer = await callOpenAI(question, context).catch(() => null);
      if (!answer) answer = await callGemini(question, context).catch(() => null);
    }

    if (!answer) {
      return res.json({
        ok: false,
        error: "ai_failed",
        message: "تعذر توليد الإجابة حالياً."
      });
    }

    res.json({ ok: true, answer });
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// اختبار السيرفر
app.get("/", (req, res) => {
  res.send("✅ NovaLink Hybrid AI Proxy is running.");
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log("🚀 NovaLink Hybrid Proxy listening on port", PORT)
);
