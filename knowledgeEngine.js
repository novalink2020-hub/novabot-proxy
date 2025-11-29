// ==========================================================
// knowledgeEngine.js – NovaLink Knowledge Engine (Stable v1.0)
// مسؤول عن:
// - تحميل ملف المعرفة v5
// - تنظيف العناصر
// - بناء embeddings
// - keyword routing
// - حساب التطابق (strong/medium/none)
// By Mohammed Abu Snaina – NOVALINK.AI
// ==========================================================

import { GoogleGenerativeAI } from "@google/generative-ai";

// ---------------------------------------------
// إعدادات
// ---------------------------------------------
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const KNOWLEDGE_URL =
  process.env.KNOWLEDGE_V5_URL ||
  process.env.KNOWLEDGE_JSON_URL ||
  "";

let genAI = null;
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

// كاش المعرفة
let knowledgeCache = null;
let knowledgeEmbeddings = null;
let lastLoadTime = 0;

const KNOWLEDGE_TTL = 12 * 60 * 60 * 1000; // 12 ساعة

// ---------------------------------------------
// أدوات مساعدة للنص
// ---------------------------------------------
function normalize(str = "") {
  return str
    .toLowerCase()
    .replace(/[.,!?؟،"“”()\-_:;«»[\]/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(str = "") {
  return new Set(normalize(str).split(" ").filter((w) => w.length >= 3));
}

// ---------------------------------------------
// تحميل ملف المعرفة
// ---------------------------------------------
async function loadKnowledge() {
  if (!KNOWLEDGE_URL) {
    console.warn("⚠️ No knowledge URL provided.");
    knowledgeCache = [];
    return [];
  }

  const now = Date.now();
  if (knowledgeCache && now - lastLoadTime < KNOWLEDGE_TTL) {
    return knowledgeCache;
  }

  try {
    const res = await fetch(KNOWLEDGE_URL);
    if (!res.ok) throw new Error("Failed knowledge fetch " + res.status);

    const json = await res.json();

    knowledgeCache = Array.isArray(json)
      ? json
          .map((item) => ({
            title: item.title?.trim() || "",
            url: item.url?.trim() || "",
            description: item.description?.trim() || "",
            excerpt: item.excerpt?.trim() || "",
            summary: item.summary?.trim() || "",
            category: item.category || "general",
            keywords: Array.isArray(item.keywords)
              ? item.keywords.map((k) => normalize(k))
              : []
          }))
          .filter((x) => x.title && x.url)
      : [];

    lastLoadTime = now;
    knowledgeEmbeddings = null;

    console.log("📚 Knowledge loaded:", knowledgeCache.length);
    return knowledgeCache;
  } catch (err) {
    console.error("❌ Knowledge load error:", err);
    knowledgeCache = [];
    return [];
  }
}

// ---------------------------------------------
// Embeddings
// ---------------------------------------------
async function getEmbedModel() {
  if (!genAI) return null;
  return genAI.getGenerativeModel({ model: "text-embedding-004" });
}

async function embed(text = "") {
  try {
    const model = await getEmbedModel();
    if (!model) return null;

    const clean = text.trim();
    if (!clean) return null;

    const result = await model.embedContent({
      content: { parts: [{ text: clean }] }
    });

    const v =
      result?.embedding?.values ||
      result?.data?.[0]?.embedding?.values ||
      [];

    if (!v.length) return null;

    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map((x) => x / norm);
  } catch {
    return null;
  }
}

async function ensureEmbeddings(items) {
  if (knowledgeEmbeddings && knowledgeEmbeddings.length === items.length) return;

  const model = await getEmbedModel();
  if (!model) {
    knowledgeEmbeddings = items.map(() => null);
    return;
  }

  console.log("🧠 Building embeddings for", items.length, "items...");

  const emb = [];
  for (const it of items) {
    const txt =
      it.title +
      " " +
      it.description +
      " " +
      it.summary +
      " " +
      it.excerpt;

    emb.push(await embed(txt));
  }

  knowledgeEmbeddings = emb;
}

// ---------------------------------------------
// Keyword Routing
// ---------------------------------------------
function keywordRoute(q, items) {
  const lower = normalize(q);

  // التعليق الصوتي
  if (lower.includes("تعليق صوتي") || lower.includes("voice over")) {
    return items.find((i) =>
      normalize(i.title).includes("murf")
    );
  }

  // Copy.ai
  if (lower.includes("copy ai") || lower.includes("copy.ai")) {
    return items.find((i) => normalize(i.title).includes("copy"));
  }

  // من نحن
  if (
    lower.includes("من نحن") ||
    lower.includes("نوفا لينك") ||
    lower.includes("about us")
  ) {
    return items.find((i) => normalize(i.title).includes("novalink"));
  }

  return null;
}

// ---------------------------------------------
// Cosine Similarity
// ---------------------------------------------
function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

// ---------------------------------------------
// البحث عن أفضل تطابق
// ---------------------------------------------
export async function findKnowledgeMatch(question = "") {
  const items = await loadKnowledge();
  if (!items.length) {
    return { type: "none", item: null };
  }

  const routed = keywordRoute(question, items);
  if (routed) {
    return { type: "strong", item: routed };
  }

  await ensureEmbeddings(items);
  const qTokens = tokenize(question);
  const qEmb = await embed(question);

  let best = null;
  let score = 0;

  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx];

    const txt =
      it.title +
      " " +
      it.description +
      " " +
      it.excerpt +
      " " +
      it.summary;

    const tTokens = tokenize(txt);
    if (!tTokens.size) continue;

    let common = 0;
    qTokens.forEach((t) => {
      if (tTokens.has(t)) common++;
    });

    const lexical = common / Math.max(qTokens.size, 1);

    let semantic = 0;
    if (qEmb && knowledgeEmbeddings[idx]) {
      semantic = cosine(qEmb, knowledgeEmbeddings[idx]);
    }

    const final = 0.6 * semantic + 0.4 * lexical;

    if (final > score) {
      score = final;
      best = it;
    }
  }

  if (!best) return { type: "none", item: null };

  if (score >= 0.65) return { type: "strong", item: best };
  if (score >= 0.4) return { type: "medium", item: best };

  return { type: "none", item: null };
}
