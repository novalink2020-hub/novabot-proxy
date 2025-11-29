// ===========================================
// NovaBot Mini Server v7 – Session-Aware AI Router
// جسر بين الواجهة → النوايا → الدماغ → الرد
// مع ذاكرة لآخر المحادثات وقرار ذكي لاستدعاء Gemini
// ===========================================

import http from "http";

// وحدات الذكاء
import { detectNovaIntent } from "./novaIntentDetector.js";
import { novaBrainSystem, loadKnowledgeFromURL } from "./novaBrainSystem.js";

// -------------------------------
// إعداد ذاكرة الجلسات (Session Memory)
// -------------------------------
const sessionMemory = new Map();
const MAX_MEMORY_ENTRIES = 6; // مثلاً: 3 تبادلات (مستخدم + بوت)
const MEMORY_WINDOW = 3; // سنفحص آخر 3 رسائل فقط في قرار الـ AI

function getSessionId(req) {
  const xf = req.headers["x-forwarded-for"];
  if (xf) {
    return xf.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "anonymous";
}

function getSessionHistory(sessionId) {
  return sessionMemory.get(sessionId) || [];
}

function pushToHistory(sessionId, entry) {
  const arr = sessionMemory.get(sessionId) || [];
  arr.push({ ...entry, ts: Date.now() });

  if (arr.length > MAX_MEMORY_ENTRIES) {
    arr.splice(0, arr.length - MAX_MEMORY_ENTRIES);
  }

  sessionMemory.set(sessionId, arr);
}

// -------------------------------
// منطق قرار إجبار واجهة الذكاء الاصطناعي
// -------------------------------
function analyzeAIFlow(userMessage, analysis, history) {
  const text = (userMessage || "").toLowerCase();
  const trimmed = text.trim();

  const aiToolHints = [
    "شات جي بي تي",
    "chatgpt",
    "chat gpt",
    "gpt",
    "gemini",
    "جيميني",
    "bard",
    "claude",
    "copilot",
    "notion ai",
    "midjourney",
    "murf",
    "elevenlabs",
    "دريجات",
    "daryjat",
    "runway",
    "voice over",
    "تعليق صوتي",
    "نموذج لغوي",
    "llm"
  ];

  const questionStartersAr = [
    "ما ",
    "ماذا",
    "كيف",
    "لماذا",
    "هل ",
    "اشرح",
    "فسّر",
    "فسر",
    "عرف",
    "عرّف",
    "لخّص",
    "لخص"
  ];

  const questionStartersEn = [
    "what",
    "why",
    "how",
    "when",
    "where",
    "explain",
    "define",
    "give me",
    "help me",
    "i want to",
    "i need",
    "can you"
  ];

  if (aiToolHints.some((kw) => text.includes(kw))) {
    return true;
  }

  if (trimmed.endsWith("?")) {
    return true;
  }

  if (
    questionStartersAr.some((kw) => trimmed.startsWith(kw)) ||
    questionStartersEn.some((kw) => trimmed.startsWith(kw))
  ) {
    return true;
  }

  const last = [...history].slice(-MEMORY_WINDOW);
  const hasRecentAI = last.some((m) => m.hasAI === true);

  if (hasRecentAI) {
    const simpleThanks = ["شكرا", "شكراً", "thanks", "thank you"];
    const simpleBye = ["مع السلامة", "وداعا", "وداعًا", "bye", "goodbye"];
    const isSimpleEnd =
      simpleThanks.includes(trimmed) || simpleBye.includes(trimmed);

    if (!isSimpleEnd) {
      return true;
    }
  }

  return false;
}

// -------------------------------
// تحميل ملف المعرفة V5 عند تشغيل السيرفر
// -------------------------------
const KNOWLEDGE_URL =
  process.env.KNOWLEDGE_V5_URL || process.env.KNOWLEDGE_JSON_URL || "";

(async () => {
  if (!KNOWLEDGE_URL) {
    console.warn(
      "⚠️ KNOWLEDGE_V5_URL / KNOWLEDGE_JSON_URL is not set. NovaBot will rely on Gemini + automated replies only."
    );
    return;
  }

  try {
    console.log("📚 Loading Nova Knowledge from:", KNOWLEDGE_URL);
    const count = await loadKnowledgeFromURL(KNOWLEDGE_URL);
    console.log(`✅ Knowledge loaded successfully. Items: ${count}`);
  } catch (err) {
    console.error("❌ Failed to load knowledge:", err);
  }
})();

// -------------------------------
// إعدادات السيرفر
// -------------------------------
const PORT = process.env.PORT || 10000;

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        ok: true,
        status: "NovaBot Brain running",
        timestamp: Date.now()
      })
    );
  }

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    return res.end();
  }

  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));

  req.on("end", async () => {
    const sessionId = getSessionId(req);
    const history = getSessionHistory(sessionId);

    try {
      const data = JSON.parse(body || "{}");
      const userMessage = (data.message || "").trim();

      if (!userMessage) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Empty message" }));
      }

      const analysis = await detectNovaIntent(userMessage);

      const forceAI = analyzeAIFlow(userMessage, analysis, history);

      let effectiveIntentId = analysis.intentId;
      let effectiveSuggestedCard = analysis.suggestedCard || null;

      if (forceAI) {
        effectiveIntentId = "ai_business";
        effectiveSuggestedCard = null;
      }

      const brainReply = await novaBrainSystem({
        message: userMessage,
        ...analysis,
        intentId: effectiveIntentId,
        suggestedCard: effectiveSuggestedCard,
        forceAI,
        sessionHistory: history
      });

      pushToHistory(sessionId, {
        role: "user",
        text: userMessage,
        intentId: effectiveIntentId,
        hasAI: false
      });

      pushToHistory(sessionId, {
        role: "bot",
        text: brainReply.reply,
        intentId: effectiveIntentId,
        hasAI: brainReply.usedAI === true
      });

      res.writeHead(200, { "Content-Type": "application/json" });

      return res.end(
        JSON.stringify({
          ok: true,
          reply: brainReply.reply,
          actionCard: brainReply.actionCard || null
        })
      );
    } catch (err) {
      console.error("🔥 Server Error:", err);

      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: "Server error" }));
    }
  });
});

// -------------------------------
// تشغيل السيرفر
// -------------------------------
server.listen(PORT, () => {
  console.log(`🚀 NovaBot Mini Server running on port ${PORT}`);
});
