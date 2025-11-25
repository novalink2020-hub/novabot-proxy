// utils.js – NovaBot PRO – Unified Tools
// ---------------------------------------
// هذا الملف يجمع كل الدوال المطلوبة للنظام الجديد والقديم معًا

// تنظيف النصوص من الضوضاء والرموز
export function cleanText(text = "") {
  return (text || "")
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .toLowerCase();
}

// تصغير النص + إزالة HTML
export function cleanHTML(html = "") {
  return (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// تقسيم النص إلى كلمات بسيطة
export function tokenize(text = "") {
  return cleanText(text).split(" ").filter(Boolean);
}

// تهريب HTML لمنع الـ XSS أو كسر الردود
export function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// تهريب النص داخل الخصائص HTML attributes
export function escapeAttr(str = "") {
  return escapeHtml(str)
    .replace(/\n/g, " ")
    .replace(/\r/g, " ");
}

// استخراج آمن لقيمة (لمنع انهيار النظام)
export function safeExtract(obj, key, fallback = "") {
  try {
    const val = obj?.[key];
    if (!val) return fallback;
    return cleanText(val);
  } catch {
    return fallback;
  }
}

// حساب التشابه بين عبارتين
export function computeSimilarity(a, b) {
  const wordsA = tokenize(a);
  const wordsB = tokenize(b);

  if (!wordsA.length || !wordsB.length) return 0;

  const setA = new Set(wordsA);
  const setB = new Set(wordsB);

  const intersection = [...setA].filter(w => setB.has(w));

  return intersection.length / Math.max(setA.size, setB.size);
}

// دمج عدة نصوص للبحث
export function mergeFields(...fields) {
  return cleanText(fields.filter(Boolean).join(" "));
}

// ترتيب النتائج حسب أعلى Score
export function sortByScore(results) {
  return results.sort((a, b) => b.score - a.score);
}
