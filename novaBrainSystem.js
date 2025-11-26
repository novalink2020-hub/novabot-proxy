// ======================================================================
// novaBrainSystem.js – NovaBrainSystem PRO v3 (Embeddings Edition)
// دماغ نوفا بوت المحترف – نوايا + معرفة + Embeddings + Gemini
// By Mohammed Abu Snaina – NOVALINK.AI
// ======================================================================

import { GoogleGenerativeAI } from "@google/generative-ai";

/* ============================================================
   1) بيئة التشغيل – مفاتيح Render
============================================================ */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const KNOWLEDGE_JSON_URL = process.env.KNOWLEDGE_JSON_URL || "";

/* ============================================================
   2) إعدادات التطابق
============================================================ */

// الحد الأدنى للتطابق الدلالي (Embeddings)
const SEMANTIC_STRONG = 0.55;
const SEMANTIC_MEDIUM = 0.34;

// إعدادات التحويل إلى توكنز
const MAX_OUTPUT_TOKENS = 200;

// موديلات Gemini المدعومة فقط (حسب طلبك)
const MODELS_TO_TRY = [
  "gemini-2.0-flash",
  "gemini-2.0-pro",
  "gemini-1.0-pro"
];

/* ============================================================
   3) تهيئة عميل Gemini
============================================================ */

let genAI = null;
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

/* ============================================================
   4) نظام الـ Embeddings – نسخة كاملة تعمل 100%
============================================================ */

/**
 * Google Embeddings API uses this format:
 * genAI.getGenerativeModel({ model: "text-embedding-004" })
 *     .embedContent({ content: { parts: [{ text: "..." }] } })
 */
async function embedText(text = "") {
  try {
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

    const result = await model.embedContent({
      content: {
        parts: [{ text }]
      }
    });

    return result?.embedding?.values || null;
  } catch (err) {
    console.error("⚠️ embedText error:", err);
    return null;
  }
}

/* ============================================================
   5) تحميل المعرفة + بناء Vector Store في الذاكرة
============================================================ */

let knowledge = [];
let vectorStore = [];
let knowledgeTimestamp = 0;
const KNOWLEDGE_TTL = 12 * 60 * 60 * 1000; // 12 ساعة

function normalizeItem(item) {
  return {
    title: (item.title || "").trim(),
    url: (item.url || "").trim(),
    description: (item.description || "").trim(),
    excerpt: (item.excerpt || "").trim(),
    summary: (item.summary || "").trim(),
    keywords: item.keywords || []
  };
}

// cosine similarity
function cosineSim(a, b) {
  let dot = 0,
    magA = 0,
    magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * (b[i] || 0);
    magA += a[i] * a[i];
    magB += (b[i] || 0) * (b[i] || 0);
  }

  return dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
}

async function loadKnowledge() {
  const now = Date.now();
  if (now - knowledgeTimestamp < KNOWLEDGE_TTL && knowledge.length) {
    return;
  }

  try {
    const res = await fetch(KNOWLEDGE_JSON_URL);
    const json = await res.json();

    knowledge = json.map(normalizeItem);

    // بناء الـ Embeddings لكل عنصر
    vectorStore = [];
    for (const item of knowledge) {
      const text = `${item.title}\n${item.description}\n${item.excerpt}\n${item.summary}\n${item.keywords.join(" ")}`;
      const vec = await embedText(text);

      if (vec) {
        vectorStore.push({
          item,
          vector: vec
        });
      }
    }

    knowledgeTimestamp = Date.now();
    console.log("✅ Knowledge loaded:", knowledge.length);
  } catch (err) {
    console.error("❌ Failed to load knowledge:", err);
  }
}

/* ============================================================
   6) البحث الدلالي Semantic + لفظي Lexical
============================================================ */

function lexicalScore(question, item) {
  // تبسيط سريع للغة العربية – مناسب للمحتوى القصير
  const clean = (t) =>
    t.toLowerCase().replace(/[.,!?؟،"“”()\-_:;«»]/g, " ").trim();

  const q = new Set(clean(question).split(" ").filter((w) => w.length >= 3));

  const combined =
    `${item.title} ${item.description} ${item.excerpt} ${item.summary} ${item.keywords.join(" ")}`.toLowerCase();

  let common = 0;
  q.forEach((w) => {
    if (combined.includes(w)) common++;
  });

  return common / Math.max(3, q.size);
}

async function semanticSearch(question) {
  const qVec = await embedText(question);
  if (!qVec) return { score: 0, item: null };

  let best = { score: 0, item: null };

  for (const entry of vectorStore) {
    const sem = cosineSim(qVec, entry.vector);
    const lex = lexicalScore(question, entry.item);

    // الدمج: semantic 80% + lexical 20%
    const finalScore = sem * 0.8 + lex * 0.2;

    if (finalScore > best.score) {
      best = { score: finalScore, item: entry.item };
    }
  }

  return best;
}

/* ============================================================
   7) نظام المخرجات – الروابط + القوالب + الردود
============================================================ */

function escapeHtml(str = "") {
  return str
    .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function strongMatchReply(item) {
  return `
📌 يبدو أن سؤالك يلامس موضوعًا تناولناه في نوفا لينك بعنوان:<br>
“${escapeHtml(item.title)}”.<br><br>
🔗 <a href="${item.url}" target="_blank" class="nova-link">اقرأ المقال على نوفا لينك</a>
`;
}

function mediumMatchReply(ai, item) {
  const safe = escapeHtml(ai).replace(/\n/g, "<br>");
  return `
${safe}<br><br>
🔗 <a href="${item.url}" target="_blank" class="nova-link">تعمّق أكثر من خلال هذه التدوينة</a>
`;
}

function noMatchReply() {
  return `
يبدو أن سؤالك يفتح بابًا جديدًا لم نكتب عنه بعد في نوفا لينك…<br>
شاركنا الزاوية التي تهمك أكثر وقد تكون هي موضوع التدوينة التالية ✨
`;
}

/* ============================================================
   8) استدعاء Gemini
============================================================ */

function buildPrompt(userText, item, lang) {
  let p = `User Question:\n${userText}\n\n`;

  if (item) {
    p += `Relevant Context:\n${item.title}\n${item.description}\n${item.excerpt}\n${item.summary}\n\n`;
  }

  p += `Answer in ${
    lang === "en" ? "English" : "Modern Standard Arabic"
  }, practical and concise.\n`;
  p += `Max tokens: ${MAX_OUTPUT_TOKENS}\n`;

  return p;
}

async function callGemini(userText, lang, item) {
  for (const modelName of MODELS_TO_TRY) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName
      });

      const prompt = buildPrompt(userText, item, lang);

      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          temperature: 0.6
        }
      });

      const out =
        result.response.text() ||
        result.response.candidates?.[0]?.content?.parts?.[0]?.text ||
        "";

      if (out.trim().length > 2) {
        return out.trim();
      }
    } catch (err) {
      console.log("⚠️ Gemini error:", modelName, err.message);
    }
  }
  return null;
}

/* ============================================================
   9) النظام الرئيسي — نواة نوفا برين
============================================================ */

export async function novaBrainSystem(req = {}) {
  const userText = (req.message || "").trim();
  const lang = req.language === "en" ? "en" : "ar";
  const intentId = req.intentId || "explore";

  if (!userText) {
    return { reply: noMatchReply(), actionCard: null };
  }

  // بطاقة المطوّر – 10406621
  if (userText.includes("10406621")) {
    return {
      reply:
        lang === "en"
          ? "👨‍💻 Developer identity card enabled."
          : "👨‍💻 تم تفعيل بطاقة المطوّر.",
      actionCard: "developer_identity"
    };
  }

  // نية الذكاء الاصطناعي فقط
  if (intentId !== "ai_business") {
    return { reply: noMatchReply(), actionCard: null };
  }

  await loadKnowledge();

  // البحث الدلالي
  const { score, item } = await semanticSearch(userText);

  console.log("🔎 Final score:", score);

  // تطابق قوي
  if (item && score >= SEMANTIC_STRONG) {
    return { reply: strongMatchReply(item), actionCard: null };
  }

  // تطابق متوسط → Gemini + رابط
  if (item && score >= SEMANTIC_MEDIUM) {
    const ai = await callGemini(userText, lang, item);
    if (ai) {
      return { reply: mediumMatchReply(ai, item), actionCard: null };
    }
  }

  // لا يوجد تطابق → Gemini بدون سياق
  const ai = await callGemini(userText, lang, null);
  if (ai) {
    return { reply: escapeHtml(ai).replace(/\n/g, "<br>"), actionCard: null };
  }

  return { reply: noMatchReply(), actionCard: null };
}
