// =====================================================
// knowledgeEngine.js – NovaBot Stable Knowledge Engine
// مسؤول عن:
// - تحميل ملف المعرفة V5
// - تنظيف العناصر
// - حساب الـ embeddings
// - Keyword Routing
// - Similarity Search
// By Mohammed Abu Snaina – NOVALINK Ai
// =====================================================

import { GoogleGenerativeAI } from "@google/generative-ai";

// ==========================
// إعدادات عامة
// ==========================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const KNOWLEDGE_URL =
  process.env.KNOWLEDGE_V5_URL ||
  process.env.KNOWLEDGE_JSON_URL ||
  "";

const KNOWLEDGE_TTL_MS = 12 * 60 * 60 * 1000; // 12 ساعة
const STRONG_MATCH_THRESHOLD = 0.65;
const MEDIUM_MATCH_THRESHOLD = 0.4;

// ==========================
// متغيرات داخلية
// ==========================
let knowledgeCache = null;
let knowledgeLoadedAt = 0;
let knowledgeEmbeddings = null;
let embedModel = null;

// ==========================
// Gemini Client
// ==========================
let genAI = null;
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

// ==========================
// أدوات مساعدة بسيطة
// ==========================
function normalizeText(str = "") {
  return str
    .toLowerCase()
    .replace(/[.,!?؟،"“”()\-_:;«»[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(str = "") {
  return new Set(
    normalizeText(str)
      .split(" ")
      .filter((w) => w.length >= 3)
  );
}

export function cosineSimilarity(A, B) {
  if (!A || !B || A.length !== B.length) return 0;
  let dot = 0;
  for (let i = 0; i < A.length; i++) dot += A[i] * B[i];
  return dot;
}

// ==========================
// تطبيع عنصر معرفي واحد
// ==========================
function normalizeItem(item) {
  if (!item) return null;
  return {
    title: (item.title || "").trim(),
    url: (item.url || "").trim(),
    description: (item.description || "").trim(),
    excerpt: (item.excerpt || "").trim(),
    summary: (item.summary || "").trim(),
    category: (item.category || "general").trim(),
    keywords: Array.isArray(item.keywords)
      ? item.keywords.map((k) => normalizeText(k)).filter(Boolean)
      : [],
  };
}

// ==========================
// تحميل المعرفة مع كاش 12 ساعة
// ==========================
export async function loadKnowledgeBase() {
  if (!KNOWLEDGE_URL) {
    console.warn("⚠️ No KNOWLEDGE URL set.");
    return [];
  }

  const now = Date.now();
  if (knowledgeCache && now - knowledgeLoadedAt < KNOWLEDGE_TTL_MS) {
    return knowledgeCache;
  }

  try {
    const res = await fetch(KNOWLEDGE_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);

    const json = await res.json();
    const cleaned = Array.isArray(json)
      ? json.map(normalizeItem).filter((x) => x && x.url && x.title)
      : [];

    knowledgeCache = cleaned;
    knowledgeLoadedAt = now;
    knowledgeEmbeddings = null; // rebuild when needed

    console.log("✅ Knowledge loaded. Items:", cleaned.length);
    return cleaned;
  } catch (err) {
    console.error("❌ Knowledge load error:", err);
    knowledgeCache = [];
    knowledgeLoadedAt = now;
    knowledgeEmbeddings = null;
    return [];
  }
}

// ==========================
// Embeddings
// ==========================
async function ensureEmbedModel() {
  if (!genAI) return null;
  if (!embedModel) {
    embedModel = genAI.getGenerativeModel({
      model: "text-embedding-004",
    });
  }
  return embedModel;
}

async function embedText(text = "") {
  try {
    const model = await ensureEmbedModel();
    if (!model) return null;

    const clean = text.trim();
    if (!clean) return null;

    const r = await model.embedContent({
      content: { parts: [{ text: clean }] },
    });

    const values =
      r?.embedding?.values ||
      r?.data?.[0]?.embedding?.values ||
      [];

    if (!values.length) return null;

    // تطبيع
    const norm = Math.sqrt(values.reduce((s, v) => s + v * v, 0)) || 1;
    return values.map((v) => v / norm);
  } catch (err) {
    console.warn("⚠️ embedText error:", err.message);
    return null;
  }
}

export async function ensureKnowledgeEmbeddings(items) {
  if (!items || !items.length) {
    knowledgeEmbeddings = [];
    return;
  }
  if (knowledgeEmbeddings && knowledgeEmbeddings.length === items.length) {
    return;
  }

  console.log("🧠 Building embeddings for", items.length, "items...");
  const EMBEDS = [];

  for (let it of items) {
    const combined =
      (it.title || "") +
      ". " +
      (it.description || "") +
      " " +
      (it.summary || "") +
      " " +
      (it.excerpt || "");
    const emb = await embedText(combined);
    EMBEDS.push(emb);
  }

  knowledgeEmbeddings = EMBEDS;
}

// ==========================
// Keyword Routing
// ==========================
export function keywordRoute(question, items) {
  const q = normalizeText(question);

  const findByTitle = (keywords) =>
    items.find((it) =>
      keywords.some((k) => normalizeText(it.title).includes(normalizeText(k)))
    );

  if (q.includes("تعليق صوتي") || q.includes("voice over")) {
    const t = findByTitle(["murf", "elevenlabs", "daryjat"]);
    if (t) return { item: t, score: 0.98 };
  }

  if (q.includes("copy ai") || q.includes("copy.ai") || q.includes("كوبي")) {
    const t = findByTitle(["copy"]);
    if (t) return { item: t, score: 0.97 };
  }

  if (q.includes("من نحن") || q.includes("about")) {
    const t = findByTitle(["about", "نوفا"]);
    if (t) return { item: t, score: 0.95 };
  }

  return null;
}

// ==========================
// Similarity Search
// ==========================
export async function findBestMatch(question, items) {
  if (!question || !items || !items.length) {
    return { score: 0, item: null };
  }

  const routed = keywordRoute(question, items);
  if (routed) return routed;

  await ensureKnowledgeEmbeddings(items);
  const qEmb = await embedText(question);

  const qTokens = tokenize(question);
  let best = { score: 0, item: null };

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const titleTokens = tokenize(it.title);
    const contentTokens = new Set([
      ...titleTokens,
      ...tokenize(it.summary),
      ...tokenize(it.description),
    ]);

    let common = 0;
    qTokens.forEach((t) => contentTokens.has(t) && common++);

    const lexical = common / Math.max(qTokens.size, 1);

    let semantic = 0;
    if (qEmb && knowledgeEmbeddings[i]) {
      semantic = cosineSimilarity(qEmb, knowledgeEmbeddings[i]);
    }

    const finalScore = 0.6 * semantic + 0.4 * lexical;

    if (finalScore > best.score) {
      best = { score: finalScore, item: it };
    }
  }

  return best;
}

// ==========================
// Export Thresholds
// ==========================
export const thresholds = {
  STRONG: STRONG_MATCH_THRESHOLD,
  MEDIUM: MEDIUM_MATCH_THRESHOLD,
};
