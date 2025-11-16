// =======================================================
// brainKnowledgeEngine.js
// محرك المعرفة لنوفا بوت v3 (وضع المدونة)
// =======================================================

const { NOVA_BRAIN_V3 } = require("./nova-brain.v3.config");

// نستخدم fetch المدمج في Node 18+ / بيئة Render
// بدون الحاجة إلى node-fetch

let knowledgeCache = {
  loaded: false,
  timestamp: 0,
  data: []
};

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 ساعة

// تنظيف عنصر المعرفة
function normalizeItem(item) {
  if (!item) return null;

  return {
    id: item.id || item.slug || item.url || "",
    title: (item.title || "").trim(),
    url: (item.url || "").trim(),
    description: (item.description || "").trim(),
    excerpt: (item.excerpt || "").trim()
  };
}

// تحويل نص لكلمات بسيطة
function textToTokens(text = "") {
  return (text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(t => t.length > 2);
}

// تحميل المعرفة من embedded fallback في config
async function loadEmbeddedFallback() {
  const cfg = (NOVA_BRAIN_V3.KNOWLEDGE || {}).EMBEDDED_FALLBACK;
  if (!cfg || !cfg.ENABLED) return [];

  const items = cfg.ITEMS || [];
  return items.map(normalizeItem).filter(Boolean);
}

// تحميل من Google Drive JSON
async function loadDriveJson() {
  const cfg = (NOVA_BRAIN_V3.KNOWLEDGE || {}).DRIVE_JSON;
  if (!cfg || !cfg.ENABLED || !cfg.URL) return [];

  try {
    const res = await fetch(cfg.URL);
    if (!res.ok) throw new Error("Drive JSON fetch failed");

    const json = await res.json();
    const items = Array.isArray(json) ? json : (json.items || []);

    return items
      .map(it =>
        normalizeItem({
          id: it.id || it.slug,
          title: it.title,
          url: it.url,
          description: it.description,
          excerpt: it.excerpt || it.content || ""
        })
      )
      .filter(Boolean);
  } catch (err) {
    console.error("[Knowledge] Drive JSON error:", err.message);
    return [];
  }
}

// تحميل من sitemap
async function loadFromSitemap() {
  const cfg = (NOVA_BRAIN_V3.KNOWLEDGE || {}).SITEMAP;
  if (!cfg || !cfg.ENABLED || !cfg.URL) return [];

  try {
    const res = await fetch(cfg.URL);
    if (!res.ok) throw new Error("Sitemap fetch failed");

    const xml = await res.text();
    const urlRegex = /<loc>(.*?)<\/loc>/g;
    const urls = [];
    let match;
    while ((match = urlRegex.exec(xml)) !== null) {
      urls.push(match[1].trim());
    }

    // لعدم الضغط على السيرفر، نكتفي هنا بتكوين عناصر بسيطة من URL فقط
    return urls.map(u =>
      normalizeItem({
        id: u,
        title: "",
        url: u,
        description: "",
        excerpt: ""
      })
    );
  } catch (err) {
    console.error("[Knowledge] Sitemap error:", err.message);
    return [];
  }
}

// تحميل المعرفة في الكاش
async function loadKnowledge(force = false) {
  const now = Date.now();

  if (
    !force &&
    knowledgeCache.loaded &&
    now - knowledgeCache.timestamp < CACHE_TTL_MS
  ) {
    return knowledgeCache.data;
  }

  const embedded = await loadEmbeddedFallback();
  const drive = await loadDriveJson();
  const sitemap = await loadFromSitemap();

  // دمج وإزالة التكرار حسب URL
  const map = new Map();
  [...embedded, ...drive, ...sitemap].forEach(item => {
    if (!item || !item.url) return;
    if (!map.has(item.url)) map.set(item.url, item);
  });

  const data = Array.from(map.values());

  knowledgeCache = {
    loaded: true,
    timestamp: now,
    data
  };

  console.log(
    `[Knowledge] Loaded ${data.length} items (embedded + drive + sitemap)`
  );

  return data;
}

// إيجاد أفضل تطابق مع السؤال
async function findBestMatch(question = "") {
  const qTokens = textToTokens(question);
  if (!qTokens.length) return { match: null, score: 0 };

  const data = await loadKnowledge(false);
  if (!data.length) return { match: null, score: 0 };

  let best = null;
  let bestScore = 0;

  for (const item of data) {
    const haystack = (
      (item.title || "") +
      " " +
      (item.description || "") +
      " " +
      (item.excerpt || "")
    ).toLowerCase();

    let hits = 0;
    let titleHits = 0;

    for (const token of qTokens) {
      if (haystack.includes(token)) {
        hits++;
        if ((item.title || "").toLowerCase().includes(token)) {
          titleHits++;
        }
      }
    }

    if (hits === 0) continue;

    let score = hits / qTokens.length;
    if (titleHits > 0) score += 0.3;

    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  const normalizedScore = Math.min(1, bestScore);

  return {
    match: best,
    score: normalizedScore
  };
}

function getCount() {
  return knowledgeCache.data.length;
}

module.exports = {
  loadKnowledge,
  findBestMatch,
  getCount
};
