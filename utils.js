// utils.js – NovaBot PRO
// ES Module
// ---------------------------------------
// أدوات مساعدة مشتركة بين Brain و Intent و Knowledge Engine

// تنظيف النص من الضوضاء والرموز
export function normalizeText(text = "") {
  return (text || "")
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .toLowerCase();
}

// استخراج نص آمن (لمنع انهيار النظام)
export function safeExtract(obj, key, fallback = "") {
  try {
    const val = obj?.[key];
    if (!val) return fallback;
    return normalizeText(val);
  } catch {
    return fallback;
  }
}

// حساب التشابه البسيط (النسبة)
export function computeSimilarity(a, b) {
  a = normalizeText(a);
  b = normalizeText(b);

  if (!a || !b) return 0;

  const setA = new Set(a.split(" "));
  const setB = new Set(b.split(" "));
  const intersection = new Set([...setA].filter(x => setB.has(x)));

  return intersection.size / Math.max(setA.size, setB.size);
}

// تنظيف HTML بشكل مبسط
export function cleanHTML(html = "") {
  return (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// دمج نصوص للبحث
export function mergeFields(...items) {
  return items
    .filter(Boolean)
    .map(x => normalizeText(x))
    .join(" ");
}

// ترتيب النتائج حسب قوة التطابق
export function sortByScore(arr) {
  return arr.sort((a, b) => b.score - a.score);
}
