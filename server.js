// NovaProxy v1.6 Fusion – Hybrid AI Proxy + Smart Feedback Collector
// Developer: Mohammed Abu Snaina – NOVALINK.AI

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

// ======================= ⚙️ CONFIG =======================
const CONFIG = {
  BRAND_NAME: "نوفا لينك",
  USE_GEMINI_FIRST_BY_DEFAULT: true,
  ALLOWED_ORIGINS: [
    "https://novalink-ai.com",
    "https://www.novalink-ai.com"
  ],
  LOG_REQUESTS: true,
  GITHUB: {
    USERNAME: "novalink2020-hub",
    REPO: "novabot-proxy",
    FILE_PATH: "feedback.csv",
    BRANCH: "main"
  }
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

// =========================================================
const app = express();
app.use(express.json());

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (CONFIG.ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"), false);
    },
  })
);

// ============ بناء البرومبت ===================
function buildPrompt(question, context) {
  let base =
    `أنت مساعد عربي محترف يمثل منصة ${CONFIG.BRAND_NAME} المتخصصة في الذكاء الاصطناعي وتطوير الأعمال.\n` +
    `أجب بجمل قصيرة وواضحة وبأسلوب عملي يشبه استشارة صديق خبير.\n` +
    `لا تستخدم مصطلحات تقنية معقدة إلا إذا كان المستخدم يبدو متقدماً أو طلب ذلك.\n` +
    `تجنّب ذكر الأكواد البرمجية إلا إذا كان السؤال برمجي صريح.\n` +
    `لا تذكر أنك نموذج ذكاء اصطناعي أو أنك روبوت.\n\n`;

  if (context && context.title) {
    base +=
      `معلومات سياقية من محتوى ${CONFIG.BRAND_NAME}:\n` +
      `العنوان: ${context.title}\n` +
      `الوصف: ${context.description || ""}\n` +
      `مقتطف: ${context.excerpt || ""}\n\n`;
  }

  base += `سؤال المستخدم:\n${question}\n\n`;
  base +=
    "الآن قدّم إجابة عملية وواضحة بالعربية، مع نصائح قابلة للتنفيذ، دون تفاصيل تقنية زائدة.";
  return base;
}

// ============ Gemini =============
async function callGemini(question, context) {
  if (!GEMINI_API_KEY) return null;
  const prompt = buildPrompt(question, context);
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
    GEMINI_API_KEY;

  const body = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error("Gemini HTTP " + res.status);
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => (p.text || "").trim()).join(" ").trim();
  return text || null;
}

// ============ OpenAI =============
async function callOpenAI(question, context) {
  if (!OPENAI_API_KEY) return null;
  const prompt = buildPrompt(question, context);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + OPENAI_API_KEY,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: `أنت مساعد عربي يمثل ${CONFIG.BRAND_NAME}.` },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
      max_tokens: 500,
    }),
  });

  if (!res.ok) throw new Error("OpenAI HTTP " + res.status);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || null;
}

// ============ API الرئيسي =============
app.post("/api/nova-ai", async (req, res) => {
  try {
    const { question, context, prefer } = req.body || {};
    if (!question || typeof question !== "string")
      return res.status(400).json({ ok: false, error: "no_question" });

    if (CONFIG.LOG_REQUESTS)
      console.log("🗨️ New request:", question.slice(0, 70));

    let answer = null;
    const useGeminiFirst =
      prefer === "gemini-first"
        ? true
        : prefer === "openai-first"
        ? false
        : CONFIG.USE_GEMINI_FIRST_BY_DEFAULT;

    if (useGeminiFirst) {
      answer = await callGemini(question, context).catch(() => null);
      if (!answer) answer = await callOpenAI(question, context).catch(() => null);
    } else {
      answer = await callOpenAI(question, context).catch(() => null);
      if (!answer) answer = await callGemini(question, context).catch(() => null);
    }

    if (!answer)
      return res.json({ ok: false, error: "ai_failed", message: "تعذر توليد الإجابة حالياً." });

    res.json({ ok: true, answer });
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// ===============================================================
// 📩  مسار جديد: /api/feedback — لحفظ الإيميلات في GitHub
// ===============================================================
app.post("/api/feedback", async (req, res) => {
  try {
    const { email, name = "", note = "" } = req.body || {};
    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "invalid_email" });
    }

    const entry = `${new Date().toISOString()},${email},${name},${note}\n`;

    const fileUrl = `https://api.github.com/repos/${CONFIG.GITHUB.USERNAME}/${CONFIG.GITHUB.REPO}/contents/${CONFIG.GITHUB.FILE_PATH}`;
    const headers = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
    };

    // تحقق من وجود الملف الحالي
    let sha = null;
    let existingContent = "";
    const getRes = await fetch(fileUrl, { headers });
    if (getRes.ok) {
      const fileData = await getRes.json();
      sha = fileData.sha;
      existingContent = Buffer.from(fileData.content, "base64").toString("utf8");
    }

    const newContent = existingContent + entry;
    const encoded = Buffer.from(newContent, "utf8").toString("base64");

    const body = {
      message: `Add feedback entry for ${email}`,
      content: encoded,
      branch: CONFIG.GITHUB.BRANCH,
    };
    if (sha) body.sha = sha;

    const putRes = await fetch(fileUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      throw new Error("GitHub write error: " + errText);
    }

    console.log(`✅ Email stored: ${email}`);
    res.json({ ok: true, message: "تم حفظ البريد بنجاح في GitHub." });
  } catch (err) {
    console.error("⚠️ Feedback error:", err.message);
    res.status(500).json({ ok: false, error: "feedback_failed" });
  }
});

// ================== اختبار ==================
app.get("/", (req, res) => res.send("✅ NovaProxy v1.6 Fusion is running."));

// ================== تشغيل ==================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 NovaProxy Fusion running on port", PORT);
});
