// knowledge-engine.js
// مسؤول عن تحميل ومعالجة ومعرفة نوفا لينك واختيار أفضل تطابق لسؤال المستخدم

"use strict";

const fetch = require("node-fetch");
const NOVA_CONFIG = require("./nova-config");

const KNOWLEDGE_CONFIG = NOVA_CONFIG.KNOWLEDGE || {};
const BASE_URL = NOVA_CONFIG.META.BASE_URL || "";

// الكاش الداخلي للمعرفة
const knowledgeCache = {
  loaded: false,
  lastLoadedAt: null,
  items: [] // كل عنصر: { id, title, url, description, text, tokens, source }
};

// ===============================
// أدوات مساعدة للنصوص والـ Tokens
// ===============================

function normalizeForSimilarity(str = "") {
  if (!str || typeof str !== "string") return "";
  // نحول إلى lowerCase ونزيل رموز كثيرة ونوحّد المسافات
  return str
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS_AR = [
  "من",
  "في",
  "على",
  "عن",
  "إلى",
  "الى",
  "أن",
  "إن",
  "ما",
  "ماذا",
  "كيف",
  "لماذا",
  "هذا",
  "هذه",
  "ذلك",
  "تلك",
  "هو",
  "هي",
  "كان",
  "كانت",
  "لقد",
  "قد",
  "أو",
  "او",
  "و",
  "ثم",
  "أي",
  "اي"
];

const STOPWORDS_EN = [
  "the",
  "is",
  "are",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "for",
  "in",
  "on",
  "with",
  "at",
  "by",
  "this",
  "that",
  "it",
  "as",
  "be",
  "was",
  "were"
];

function tokenize(str = "") {
  const normalized = normalizeForSimilarity(str);
  if (!normalized) return [];

  const tokens = normalized.split(" ");

  const filtered = tokens.filter((t) => {
    if (!t || t.length <= 1) return false;
    const isArabic = /[\u0600-\u06FF]/.test(t);
    const isLatin = /[a-zA-Z]/.test(t);

    if (isArabic && STOPWORDS_AR.includes(t)) return false;
    if (isLatin && STOPWORDS_EN.includes(t)) return false;

    return true;
  });

  return filtered;
}

/**
 * تشابه بسيط بين استعلام ومقال:
 * score = عدد الكلمات المشتركة / عدد كلمات الاستعلام (بعد التنقية)
 */
function computeSimilarity(queryTokens, docTokenSet) {
  if (!queryTokens.length || !docTokenSet || !docTokenSet.size) return 0;

  let intersection = 0;
  queryTokens.forEach((tok) => {
    if (docTokenSet.has(tok)) intersection++;
  });

  if (intersection === 0) return 0;

  const score = intersection / queryTokens.length;
  return score;
}

// ===============================
// تحميل المعرفة من المصادر
// ===============================

async function fetchJsonKnowledge() {
  const url = KNOWLEDGE_CONFIG.DRIVE_JSON_URL;
  if (!url) return [];

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("[knowledge-engine] فشل تحميل JSON:", res.status);
      return [];
    }

    const data = await res.json();
    let articles = [];

    // نحاول دعم شكلين: array مباشرة أو { articles: [...] }
    if (Array.isArray(data)) {
      articles = data;
    } else if (Array.isArray(data.articles)) {
      articles = data.articles;
    } else {
      console.warn("[knowledge-engine] صيغة JSON غير متوقعة.");
      return [];
    }

    const mapped = articles
      .map((item, idx) => {
        const title = item.title || item.name || "";
        const url = item.url || item.link || "";
        const description = item.description || item.summary || "";
        const content =
          item.content ||
          item.body ||
          item.excerpt ||
          item.firstParagraph ||
          "";

        const text = [title, description, content].join(" ");

        if (!title && !description && !content) return null;

        const tokens = tokenize(text);
        const tokenSet = new Set(tokens);

        return {
          id: `drive-${idx}`,
          title,
          url,
          description,
          text,
          tokens,
          tokenSet,
          source: "drive"
        };
      })
      .filter(Boolean);

    return mapped;
  } catch (err) {
    console.error("[knowledge-engine] خطأ أثناء تحميل JSON:", err.message);
    return [];
  }
}

async function fetchSitemapKnowledge() {
  const url = KNOWLEDGE_CONFIG.SITEMAP_URL;
  if (!url) return [];

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("[knowledge-engine] فشل تحميل sitemap:", res.status);
      return [];
    }

    const xml = await res.text();
    const locRegex = /<loc>([^<]+)<\/loc>/gi;
    const items = [];
    let match;
    let idx = 0;

    while ((match = locRegex.exec(xml)) !== null) {
      const loc = match[1].trim();
      if (!loc) continue;

      // نتجنب صفحات غير مفيدة إن أحببت (يمكن التوسع لاحقاً)
      const titleFromUrl = loc
        .replace(/^https?:\/\//, "")
        .replace(BASE_URL.replace(/^https?:\/\//, ""), "")
        .replace(/[-_/]+/g, " ")
        .replace(/\.[a-zA-Z]+$/, "")
        .trim();

      const title =
        titleFromUrl && titleFromUrl.length > 3
          ? titleFromUrl
          : "مقال من نوفا لينك";

      const text = `${title} ${loc}`;
      const tokens = tokenize(text);
      const tokenSet = new Set(tokens);

      items.push({
        id: `sitemap-${idx++}`,
        title,
        url: loc,
        description: "",
        text,
        tokens,
        tokenSet,
        source: "sitemap"
      });
    }

    return items;
  } catch (err) {
    console.error("[knowledge-engine] خطأ أثناء تحميل sitemap:", err.message);
    return [];
  }
}

function buildFallbackKnowledge() {
  const paragraphs = KNOWLEDGE_CONFIG.FALLBACK_PARAGRAPHS || [];
  const items = [];

  paragraphs.forEach((p, idx) => {
    if (!p || typeof p !== "string") return;

    const text = p;
    const tokens = tokenize(text);
    const tokenSet = new Set(tokens);

    items.push({
      id: `fallback-${idx}`,
      title: "محتوى تعريفي من نوفا لينك",
      url: BASE_URL || "",
      description: p.slice(0, 160),
      text,
      tokens,
      tokenSet,
      source: "fallback"
    });
  });

  return items;
}

// ===============================
// إدارة الكاش
// ===============================

async function loadKnowledgeIntoCache() {
  if (!KNOWLEDGE_CONFIG.ENABLED) {
    console.warn("[knowledge-engine] المعرفة معطّلة عبر الكونفج.");
    knowledgeCache.loaded = true;
    knowledgeCache.items = [];
    knowledgeCache.lastLoadedAt = new Date();
    return;
  }

  const allItems = [];

  const [jsonItems, sitemapItems] = await Promise.all([
    fetchJsonKnowledge(),
    fetchSitemapKnowledge()
  ]);

  if (Array.isArray(jsonItems) && jsonItems.length) {
    allItems.push(...jsonItems);
  }

  if (Array.isArray(sitemapItems) && sitemapItems.length) {
    allItems.push(...sitemapItems);
  }

  // fallback paragraphs دائمًا تُضاف كطبقة أخيرة
  const fallbackItems = buildFallbackKnowledge();
  if (fallbackItems.length) {
    allItems.push(...fallbackItems);
  }

  knowledgeCache.items = allItems;
  knowledgeCache.loaded = true;
  knowledgeCache.lastLoadedAt = new Date();

  console.log(
    `[knowledge-engine] تم تحميل المعرفة. عدد العناصر: ${knowledgeCache.items.length}`
  );
}

async function ensureKnowledgeLoaded() {
  if (knowledgeCache.loaded) return;

  await loadKnowledgeIntoCache();
}

async function refreshKnowledge() {
  knowledgeCache.loaded = false;
  knowledgeCache.items = [];
  await loadKnowledgeIntoCache();
}

// ===============================
// البحث عن أفضل تطابق
// ===============================

/**
 * البحث عن أفضل مقال/عنصر معرفي يطابق رسالة المستخدم
 * يرجع:
 * {
 *   bestMatch: { ...item } أو null,
 *   score: رقم بين 0 و 1,
 *   stats: { itemsCount, queryTokensCount }
 * }
 */
async function findBestMatch(userMessage) {
  await ensureKnowledgeLoaded();

  const items = knowledgeCache.items || [];
  if (!items.length) {
    return {
      bestMatch: null,
      score: 0,
      stats: {
        itemsCount: 0,
        queryTokensCount: 0
      }
    };
  }

  const queryTokens = tokenize(userMessage || "");
  if (!queryTokens.length) {
    return {
      bestMatch: null,
      score: 0,
      stats: {
        itemsCount: items.length,
        queryTokensCount: 0
      }
    };
  }

  let bestItem = null;
  let bestScore = 0;

  for (const item of items) {
    if (!item.tokenSet || !(item.tokenSet instanceof Set)) continue;
    const score = computeSimilarity(queryTokens, item.tokenSet);
    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  return {
    bestMatch: bestItem,
    score: bestScore,
    stats: {
      itemsCount: items.length,
      queryTokensCount: queryTokens.length
    }
  };
}

// ===============================
// دوال مساعدة للإحصائيات
// ===============================

function getKnowledgeStats() {
  return {
    loaded: knowledgeCache.loaded,
    lastLoadedAt: knowledgeCache.lastLoadedAt,
    itemsCount: knowledgeCache.items.length
  };
}

// ===============================
// التصدير
// ===============================

module.exports = {
  ensureKnowledgeLoaded,
  refreshKnowledge,
  findBestMatch,
  getKnowledgeStats
};
