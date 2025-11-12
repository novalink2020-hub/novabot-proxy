// =======================================================
// NovaProxy v2.2 — Smart Behavior & Tone Adaptive Edition
// Gemini → (fallback) OpenAI | Intent + Tone + Dialect + Memory + Metrics
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
  SMART_MARKETING: {
    ENABLED: true,
    MODE: "hybrid" // "hybrid" = مزيج متوازن
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

// كشف نية المستخدم موسّع
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

// ذاكرة قصيرة: استخلص آخر 3 تبادلات user/assistant
function buildHistoryBlock(history = [], lang = "ar") {
  if (!Array.isArray(history) || !history.length) return "";
  const last = history.slice(-6); // 3 تبادلات
  const lines = last.map(h => {
    const role = h.role === "assistant" ? (lang === "en" ? "assistant" : "المساعد") : (lang === "en" ? "user" : "المستخدم");
    return `${role}: ${h.content || ""}`;
  }).join("\n");
  return lines ? `\n\n${lang === "en" ? "Recent chat history" : "تاريخ المحادثة الأخير"}:\n${lines}\n` : "";
}

// CTA ديناميكي حسب النية + اللغة
function buildCTA(intent, lang = "ar") {
  if (lang === "en") {
    switch (intent) {
      case "PURCHASE":
        return {
          type: "purchase",
          text: "Would you like tailored help choosing the right solution? Visit our Services or leave your email and our team will contact you.",
          url: "https://novalink-ai.com/services-khdmat-nwfa-lynk"
        };
      case "LEARNING":
        return {
          type: "learning",
          text: "Want practical AI articles delivered to your inbox? Share your email and we’ll send curated guides.",
          url: "https://novalink-ai.com/blog-adwat-althkaa-alastnaay-llaamal"
        };
      case "COLLABORATION":
        return {
          type: "collaboration",
          text: "We’re open to partnerships. Leave your email or use the contact section at the homepage footer.",
          url: "https://novalink-ai.com#contact"
        };
      case "MARKETING":
        return {
          type: "marketing",
          text: "Want a practical AI marketing starter kit? Enter your email and we’ll line up action steps.",
          url: "https://novalink-ai.com/services-khdmat-nwfa-lynk"
        };
      case "ABOUT":
        return {
          type: "about",
          text: "Learn more about NovaLink, or subscribe to receive our latest insights.",
          url: "https://novalink-ai.com/about-us-althkaa-alastnaay"
        };
      default:
        return {
          type: "general",
          text: "If you’d like, share your email to receive helpful updates and personalized assistance.",
          url: "https://novalink-ai.com/ashtrk-alan"
        };
    }
  }

  // Arabic
  switch (intent) {
    case "PURCHASE":
      return {
        type: "purchase",
        text: "هل ترغب بمساعدة مخصصة لاختيار الحل الأنسب؟ تفضّل بزيارة صفحة الخدمات أو اترك بريدك ليتواصل معك فريق نوفا لينك.",
        url: "https://novalink-ai.com/services-khdmat-nwfa-lynk"
      };
    case "LEARNING":
      return {
        type: "learning",
        text: "هل تودّ أن تصلك مقالات عملية في الذكاء الاصطناعي؟ ضع بريدك ونرسل لك ملخصات مركّزة.",
        url: "https://novalink-ai.com/blog-adwat-althkaa-alastnaay-llaamal"
      };
    case "COLLABORATION":
      return {
        type: "collaboration",
        text: "فريق نوفا لينك منفتح على الشراكات. أرسل بريدك أو استخدم قسم تواصل معنا أسفل الصفحة الرئيسية.",
        url: "https://novalink-ai.com#contact"
      };
    case "MARKETING":
      return {
        type: "marketing",
        text: "هل ترغب بدليل عملي للتسويق بالذكاء الاصطناعي؟ أدخل بريدك وسنرتّب لك الخطوات.",
        url: "https://novalink-ai.com/services-khdmat-nwfa-lynk"
      };
    case "ABOUT":
      return {
        type: "about",
        text: "تعرّف أكثر على نوفا لينك، أو اشترك ليصلك أحدث ما ننشره.",
        url: "https://novalink-ai.com/about-us-althkaa-alastnaay"
      };
    default:
      return {
        type: "general",
        text: "يسعدنا أن نرافقك خطوة بخطوة—اترك بريدك لتصلك تحديثات ونصائح عملية من نوفا لينك.",
        url: "https://novalink-ai.com/ashtrk-alan"
      };
  }
}

// بناء البرومبت مع النية + اللهجة + التاريخ + اللغة
function buildPrompt(question, context, intent, lang, dialect, historyBlock) {
  const isEN = lang === "en";

  const toneMap = {
    PURCHASE: isEN
      ? "Use a consultative, professional tone, focus on concrete solutions."
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
    ? "Answer in clear Modern Standard Arabic if the user is Arabic; otherwise answer in the user's language. If Arabic, you may sprinkle a natural, minimal hint of the user's dialect when appropriate (no exaggeration)."
    : "أجب بالعربية الفصحى السلسة، ويمكنك إدخال لمسة بسيطة وطبيعية من لهجة المستخدم عند اللزوم دون مبالغة.";

  const langHeader = isEN
    ? `You are an Arabic/English AI assistant representing ${CONFIG.BRAND_NAME} for AI & business growth.`
    : `أنت مساعد ذكاء اصطناعي يمثل منصة ${CONFIG.BRAND_NAME} للذكاء الاصطناعي وتطوير الأعمال.`;

  const instruction = isEN
    ? `Write short, practical answers. Avoid deep technicalities unless requested. ${toneMap[intent || "GENERAL"] || ""}`
    : `اكتب إجابات قصيرة وعملية. تجنّب التفاصيل التقنية العميقة إلا عند الطلب. ${toneMap[intent || "GENERAL"] || ""}`;

  let ctx = "";
  if (context && context.title) {
    ctx = isEN
      ? `\nFrom ${CONFIG.BRAND_NAME} content:\nTitle: ${context.title}\nDescription: ${context.description || ""}\nExcerpt: ${context.excerpt || ""}\n`
      : `\nمن محتوى ${CONFIG.BRAND_NAME}:\nالعنوان: ${context.title}\nالوصف: ${context.description || ""}\nمقتطف: ${context.excerpt || ""}\n`;
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
// 🤖 LLM Calls (Gemini with retry → OpenAI fallback)
// =======================================================
async function callGemini(model, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const body = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
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
  const text = data?.choices?.[0]?.message?.content?.trim() || null;
  return text;
}

async function askLLM(question, context, intent, lang, dialect, history) {
  const prompt = buildPrompt(
    question,
    context,
    intent,
    lang,
    dialect,
    buildHistoryBlock(history, lang)
  );

  const order = CONFIG.USE_GEMINI_FIRST_BY_DEFAULT
    ? ["gemini-2.5-flash", "gemini-1.5-flash", "openai"]
    : ["openai", "gemini-2.5-flash", "gemini-1.5-flash"];

  for (const who of order) {
    try {
      if (who.startsWith("gemini")) {
        if (!GEMINI_API_KEY) continue;
        const ans = await callGemini(who, prompt);
        if (ans) return { provider: who, answer: ans };
      } else if (who === "openai") {
        const ans = await callOpenAI(prompt);
        if (ans) return { provider: "openai", answer: ans };
      }
    } catch (e) {
      console.warn(`${who} failed:`, e.message);
      continue;
    }
  }
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

    if (CONFIG.LOG_REQUESTS) {
      console.log("🗨️ /api/nova-ai:", { q: question.slice(0, 60), prefer: CONFIG.USE_GEMINI_FIRST_BY_DEFAULT ? "gemini-first" : "openai-first" });
    }

    const { provider, answer } = await askLLM(
      question, context, intent, language, dialect, Array.isArray(history) ? history : []
    );

    if (!answer) {
      return res.json({ ok: false, error: "ai_failed", message: language === "en" ? "Failed to generate an answer at the moment." : "تعذر توليد الإجابة حالياً." });
    }

    const cta = buildCTA(intent, language);

    return res.json({
      ok: true,
      provider,
      intent,
      language,
      dialect,
      answer,
      cta // {type, text, url}
    });
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ ok: false, error: "server_error" });
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
        (lead_source || "NovaBot v4.8"),
        (brand || CONFIG.BRAND_NAME)
      ].join(",") + "\n";

      const nextContent = cur.exists ? (cur.content + row) : ("timestamp,email,name,note,intent,dialect,language,lead_source,brand\n" + row);

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
    const t = await callGemini("gemini-2.5-flash", "ping");
    return res.json({ ok: true, provider: "gemini-2.5-flash", answer: (t || "").slice(0, 60) });
  } catch {
    try {
      const t2 = await callGemini("gemini-1.5-flash", "ping");
      return res.json({ ok: true, provider: "gemini-1.5-flash", answer: (t2 || "").slice(0, 60) });
    } catch (e) {
      return res.json({ ok: false, message: e.message || "Gemini failed" });
    }
  }
});

// Health
app.get("/", (_req, res) => {
  res.send("✅ NovaProxy v2.2 is running.");
});

// =======================================================
// 🟢 RUN
// =======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 NovaProxy v2.2 listening on port ${PORT}`);
});
