/**************************************************************
 * NovaBrainSystem PRO – Phase 1
 * نظام ذكاء نوفا بوت (مطابقة + بحث + تكامل مع المعرفة V4)
 * محمد – NOVALINK Ai – 2025
 **************************************************************/

const { cleanText, tokenize, escapeHtml, escapeAttr } = require("./utils");

/* ============================================================
   1. تطبيع عناصر ملف المعرفة knowledge.v4.json
   ============================================================ */
function normalizeItem(raw) {
  if (!raw) return null;

  const title = (raw.title || "").trim();
  const url = (raw.url || "").trim();
  const description = (raw.description || "").trim();
  const excerpt = (raw.excerpt || "").trim();
  const summary = (raw.summary || "").trim();
  const category = (raw.category || "general").trim() || "general";

  let keywords = [];
  if (Array.isArray(raw.keywords)) {
    keywords = raw.keywords
      .map((k) => String(k || "").trim())
      .filter((k) => k.length >= 2);
  }

  if (!title || !url) return null;

  return {
    title,
    url,
    description,
    excerpt,
    summary,
    category,
    keywords
  };
}

/* ============================================================
   2. محرك المطابقة الذكي – PRO Matching Engine
   ============================================================ */
function findBestMatch(question, items) {
  if (!question || !items || !items.length) {
    return { score: 0, item: null };
  }

  const qTokens = tokenize(question);
  if (!qTokens.size) return { score: 0, item: null };

  let bestItem = null;
  let bestScore = 0;

  for (const item of items) {
    const keywordsText = Array.isArray(item.keywords)
      ? item.keywords.join(" ")
      : "";

    const combined =
      (item.title || "") +
      " " +
      (item.description || "") +
      " " +
      (item.summary || "") +
      " " +
      (item.excerpt || "") +
      " " +
      keywordsText;

    const tTokens = tokenize(combined);
    if (!tTokens.size) continue;

    let common = 0;
    qTokens.forEach((t) => {
      if (tTokens.has(t)) common++;
    });

    const baseScore = common / Math.max(3, qTokens.size);

    // تعزيز تصنيفات مهمة
    const cat = item.category || "general";
    let boost = 1;

    if (cat === "blog" || cat === "services" || cat === "story" || cat === "about") {
      boost = 1.15;
    } else if (cat === "home") {
      boost = 1.05;
    } else if (cat === "legal") {
      boost = 0.7;
    }

    const score = baseScore * boost;

    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  return { score: bestScore, item: bestItem };
}

/* ============================================================
   3. رد التطابق القوي (Strong Match)
   ============================================================ */
function buildStrongMatchReply(item) {
  const safeTitle = escapeHtml(item.title || "");
  const safeUrl = escapeAttr(item.url || "#");
  const safeSummary = item.summary ? escapeHtml(item.summary) : "";

  let text = ` يبدو أن سؤالك يلامس موضوعًا تناولناه في نوفا لينك بعنوان:
“${safeTitle}”.
هذه التدوينة كُتبت لتقدّم إجابة مركّزة حول هذا النوع من الأسئلة.`;

  if (safeSummary) {
    text += `
<br><br>ملخّص سريع:
${safeSummary}`;
  }

  text += `
(${safeUrl})`;

  return text;
}

/* ============================================================
   4. رد التطابق المتوسط (Medium Match)
   ============================================================ */
function buildMidMatchTemplateReply(item) {
  const safeTitle = escapeHtml(item.title || "");
  const safeUrl = escapeAttr(item.url || "#");
  const safeSummary = item.summary ? escapeHtml(item.summary) : "";

  let text = ` سؤالك قريب من فكرة ناقشناها في نوفا لينك بعنوان:
“${safeTitle}”.
قد لا تكون الإجابة طبق الأصل، لكنها ستفتح لك زاوية تفكير أوسع حول الموضوع.`;

  if (safeSummary) {
    text += `
<br><br>لمحة سريعة:
${safeSummary}`;
  }

  text += `
(${safeUrl})`;

  return text;
}

/* ============================================================
   5. بناء سياق مخصّص لـ Gemini – Smart Prompt Builder
   ============================================================ */
function buildGeminiPrompt(originalQuestion, bestItem) {
  let base = `أنت NovaBot من نوفا لينك. أجب عن السؤال باحترافية عربية مبسطة.\n\n`;
  base += `السؤال:\n${originalQuestion}\n\n`;

  if (bestItem) {
    base += `هذه بيانات تدوينة لها صلة:\n`;
    base += `العنوان: ${bestItem.title}\n`;
    if (bestItem.description) base += `الوصف: ${bestItem.description}\n`;
    if (bestItem.summary) {
      base += `ملخّص ذكي: ${bestItem.summary}\n`;
    } else if (bestItem.excerpt) {
      base += `مقتطف: ${bestItem.excerpt}\n`;
    }
    base += `استخدمها كمرجع مساعد فقط.\n\n`;
  }

  base += `من فضلك قدّم إجابة واضحة مختصرة مفيدة.`;

  return base;
}

/**************************************************************
 * التصدير
 **************************************************************/
module.exports = {
  normalizeItem,
  findBestMatch,
  buildStrongMatchReply,
  buildMidMatchTemplateReply,
  buildGeminiPrompt
};
