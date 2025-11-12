// =======================================================
// NovaProxy v2.1 LTS — Stable + Smart Marketing (Gemini → OpenAI)
// Works with NovaBot v4.6–v4.8
// Author: Mohammed Abu Snaina – NOVALINK.AI
// =======================================================

require("dotenv").config();
const express = require("express");
const cors = require("cors");

// ✅ fetch: استخدم المدمج في Node 18+، أو ارجع لـ node-fetch (CommonJS)
let fetchRef = global.fetch;
if (!fetchRef) {
  try {
    fetchRef = require("node-fetch");
  } catch (_) {
    console.warn("⚠️ 'node-fetch' غير مثبت. يوصى بإضافته احتياطياً: npm i node-fetch@2");
  }
}
const fetch = (...args) => fetchRef(...args);

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

  // 🧠 تسويق ذكي خفيف ومستقر
  SMART_MARKETING: {
    ENABLED: true,
    MODE: "hybrid" // توازن بين التوعوي والبيعي
  },

  // 📬 تجميع الإيميلات
  FEEDBACK: {
    ENABLED: true,
    GITHUB: {
      ENABLED: true,
      OWNER: "novalink2020-hub",
      REPO: "novabot-proxy",
      FILE_PATH: "feedback.csv" // سيُنشأ تلقائياً إن لم يوجد
    },
    REACH: {
      ENABLED: true, // عطلها لو ما عندك مفتاح
      API_URL: "https://reach.hostinger.com/api/v1/subscribers",
      API_KEY: process.env.REACH_API_KEY || ""
    }
  }
};

// =======================================================
// 🔐 ENV
// =======================================================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const GITHUB_TOKEN   = process.env.GITHUB_TOKEN   || "";

// طباعة حالة المفاتيح للمساعدة في التشخيص
console.log("🔍 Gemini Key:", GEMINI_API_KEY ? "✅ Loaded" : "❌ Missing");
console.log("🔍 OpenAI Key:", OPENAI_API_KEY ? "✅ Loaded" : "❌ Missing");
console.log("🔍 GitHub Token:", GITHUB_TOKEN ? "✅ Loaded" : "❌ Missing");
console.log("🔍 Reach Key:", (CONFIG.FEEDBACK.REACH.ENABLED && CONFIG.FEEDBACK.REACH.API_KEY) ? "✅ Loaded" : "—");

// =======================================================
// 🚀 APP
// =======================================================
const app = express();
app.use(express.json({ limit: "1mb" }));

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // يسمح لأدوات الاختبار
    if (CONFIG.ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"), false);
  }
}));

// =======================================================
// 🧠 Intent Analyzer (خيار خفيف لا يكسر الاستقرار)
// =======================================================
function analyzeIntent(q) {
  const t = (q || "").toLowerCase();
  if (/سعر|شراء|اشتراك|تكلفة|خدمة|طلب/.test(t)) return "PURCHASE";
  if (/تعلم|شرح|كيف|افهم|خطوات|أساسيات/.test(t)) return "LEARNING";
  if (/تسويق|مبيعات|اعلان|ترويج|تحويل/.test(t)) return "MARKETING";
  if (/تعاون|شراكة|رعاية|مشروع مشترك/.test(t)) return "COLLABORATION";
  if (/نوفا لينك|من أنتم|رؤيتكم|قصتكم/.test(t)) return "ABOUT";
  return "GENERAL";
}

// =======================================================
// 🧾 Prompt Builder (محافظ على روح v1 + حقن تسويقي لطيف)
// =======================================================
function buildPrompt(question, context, intent) {
  let p =
    `أنت مساعد عربي يمثل منصة ${CONFIG.BRAND_NAME} المتخصصة في الذكاء الاصطناعي وتطوير الأعمال.\n` +
    `أجب بجمل قصيرة وواضحة وبأسلوب عملي يشبه استشارة صديق خبير.\n` +
    `تجنب المصطلحات التقنية المفرطة إلا إذا طلبها المستخدم.\n` +
    `لا تذكر أنك نموذج ذكاء اصطناعي.\n`;

  if (CONFIG.SMART_MARKETING.ENABLED) {
    if (intent === "PURCHASE") {
      p += `قدّم حلاً عمليًا ومباشرًا، ويمكنك اقتراح خدمة أو باقة بشكل مهني وغير مُلح.\n`;
    } else if (intent === "LEARNING") {
      p += `اختم بخطوات بسيطة أو روابط تعلّم عملية.\n`;
    } else if (intent === "MARKETING") {
      p += `أبرز أثر الأدوات الذكية على النتائج التسويقية عندما يكون ذلك مناسبًا.\n`;
    } else if (intent === "COLLABORATION") {
      p += `اجعل النبرة تعاونية ومشجعة للتواصل.\n`;
    }
  }

  if (context && context.title) {
    p += `\nمن محتوى ${CONFIG.BRAND_NAME}:\n` +
         `العنوان: ${context.title}\n` +
         `الوصف: ${context.description || ""}\n` +
         `مقتطف: ${context.excerpt || ""}\n`;
  }

  p += `\nسؤال المستخدم:\n${question}\n\n`;
  p += `أجب بوضوح دون مبالغة تسويقية أو تفاصيل تقنية زائدة.`;
  return p;
}

// =======================================================
// 🤖 AI Calls (حافظ على أسلوب v1 في التبديل)
// =======================================================
async function callGemini(question, context, intent) {
  if (!GEMINI_API_KEY) return null;

  const prompt = buildPrompt(question, context, intent);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
    // مهلة معقولة لتفادي التعليق
    signal: AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("Gemini HTTP Error:", res.status, txt);
    return null;
  }

  const data = await res.json().catch(() => null);
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map(p => (p.text || "").trim()).join(" ").trim();
  return text || null;
}

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
        { role: "system", content: `أنت مساعد يمثل ${CONFIG.BRAND_NAME} وتقدّم إجابات عملية وبسيطة.` },
        { role: "user", content: prompt }
      ],
      temperature: 0.6,
      max_tokens: 500
    })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("OpenAI HTTP Error:", res.status, txt);
    return null;
  }

  const data = await res.json().catch(() => null);
  const text = data?.choices?.[0]?.message?.content?.trim() || null;
  return text || null;
}

// =======================================================
// 🛣️ /api/nova-ai — المستقر
// =======================================================
app.post("/api/nova-ai", async (req, res) => {
  try {
    const { question, context, prefer } = req.body || {};

    if (!question || typeof question !== "string") {
      return res.status(400).json({ ok: false, error: "no_question", message: "Missing 'question'." });
    }

    if (CONFIG.LOG_REQUESTS) {
      console.log("🗨️ /api/nova-ai:", {
        q: question.slice(0, 100),
        prefer: prefer || (CONFIG.USE_GEMINI_FIRST_BY_DEFAULT ? "gemini-first" : "openai-first")
      });
    }

    const intent = analyzeIntent(question);
    const useGeminiFirst =
      prefer === "gemini-first" ? true
      : prefer === "openai-first" ? false
      : CONFIG.USE_GEMINI_FIRST_BY_DEFAULT;

    let answer = null;
    if (useGeminiFirst) {
      answer = await callGemini(question, context, intent);
      if (!answer) answer = await callOpenAI(question, context, intent);
    } else {
      answer = await callOpenAI(question, context, intent);
      if (!answer) answer = await callGemini(question, context, intent);
    }

    if (!answer) {
      return res.json({ ok: false, error: "ai_failed", message: "تعذر توليد الإجابة حالياً." });
    }

    return res.json({ ok: true, intent, answer });
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

// =======================================================
// 📬 /api/feedback — GitHub + Reach (واحد أو كلاهما)
// =======================================================
async function upsertGithubFile({ owner, repo, path, line }) {
  const api = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;

  // 1) اجلب الملف لمعرفة sha إن وجد
  let sha;
  const getRes = await fetch(api, {
    headers: { Authorization: `token ${GITHUB_TOKEN}`, "User-Agent": "NovaProxy" }
  });
  if (getRes.status === 200) {
    const json = await getRes.json().catch(() => null);
    sha = json?.sha;
    const contentRaw = Buffer.from(json?.content || "", "base64").toString("utf8");
    // أضف السطر الجديد
    const newContent = contentRaw.endsWith("\n") ? contentRaw + line : contentRaw + "\n" + line;
    const putRes = await fetch(api, {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "NovaProxy"
      },
      body: JSON.stringify({
        message: "Append feedback row",
        content: Buffer.from(newContent, "utf8").toString("base64"),
        sha
      })
    });
    if (!putRes.ok) throw new Error("GitHub PUT failed: " + (await putRes.text()));
    return true;
  }

  if (getRes.status === 404) {
    // 2) أنشئ ملف جديد مع الهيدر + السطر
    const header = "timestamp,email,name,note\n";
    const content = header + line + "\n";
    const putRes = await fetch(api, {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "NovaProxy"
      },
      body: JSON.stringify({
        message: "Create feedback.csv",
        content: Buffer.from(content, "utf8").toString("base64")
      })
    });
    if (!putRes.ok) throw new Error("GitHub create failed: " + (await putRes.text()));
    return true;
  }

  throw new Error("GitHub GET failed: " + getRes.status + " " + (await getRes.text()));
}

app.post("/api/feedback", async (req, res) => {
  try {
    const { email, name, note } = req.body || {};
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "invalid_email" });
    }

    const ts = new Date().toISOString();
    const safe = (s) => (s || "").toString().replace(/[\n\r,]/g, " ").trim();
    const row = `${ts},${safe(email)},${safe(name)},${safe(note)}`;

    let ghOK = false, reachOK = false;

    // 1) GitHub
    if (CONFIG.FEEDBACK.ENABLED && CONFIG.FEEDBACK.GITHUB.ENABLED && GITHUB_TOKEN) {
      try {
        ghOK = await upsertGithubFile({
          owner: CONFIG.FEEDBACK.GITHUB.OWNER,
          repo:  CONFIG.FEEDBACK.GITHUB.REPO,
          path:  CONFIG.FEEDBACK.GITHUB.FILE_PATH,
          line:  row
        });
      } catch (e) {
        console.error("GitHub write error:", e.message);
      }
    }

    // 2) Reach
    if (CONFIG.FEEDBACK.ENABLED && CONFIG.FEEDBACK.REACH.ENABLED && CONFIG.FEEDBACK.REACH.API_KEY) {
      try {
        const r = await fetch(CONFIG.FEEDBACK.REACH.API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${CONFIG.FEEDBACK.REACH.API_KEY}`
          },
          body: JSON.stringify({ email, name, note })
        });
        reachOK = r.ok;
        if (!r.ok) {
          const t = await r.text().catch(() => "");
          console.error("Reach HTTP:", r.status, t);
        }
      } catch (e) {
        console.error("Reach error:", e.message);
      }
    }

    if (ghOK || reachOK) {
      return res.json({ ok: true, message: "تم حفظ البريد بنجاح." });
    }
    return res.json({ ok: false, error: "feedback_failed" });
  } catch (err) {
    console.error("Feedback Error:", err);
    return res.json({ ok: false, error: "feedback_failed" });
  }
});

// =======================================================
// 🧩 Health & Version
// =======================================================
app.get("/", (_, res) => res.send("✅ NovaProxy v2.1 LTS is running."));
app.get("/api/version", (_, res) => res.json({ ok: true, version: "2.1-lts" }));

// =======================================================
// 🟢 START
// =======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 NovaProxy v2.1 LTS listening on port ${PORT}`);
});
