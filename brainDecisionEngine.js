// =======================================================
// brainDecisionEngine.js
// عقل اتخاذ القرار – AI أم Knowledge أم Fallback
// =======================================================

const { NOVA_BRAIN_V3 } = require("./nova-brain.v3.config");
const Fallback = require("./brainFallback");
const Knowledge = require("./brainKnowledgeEngine");

// نستخدم fetch المدمج في Node 18+
async function callGemini(model, prompt) {
  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) {
    throw new Error("Gemini key missing");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`;

  const body = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ]
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini HTTP ${res.status}: ${text}`);
  }

  const json = await res.json();
  const candidates = json.candidates || [];
  const content = candidates[0]?.content?.parts?.[0]?.text || "";

  return content.trim();
}

// بناء Prompt ذكي لـ Gemini في سياق المدونة
function buildBlogPrompt(ctx, article) {
  const meta = NOVA_BRAIN_V3.META || {};
  const brandName = meta.BRAND_NAME_AR || "نوفا لينك";

  const articleContext = article
    ? `عنوان المقال: ${article.title || ""}\nالرابط: ${article.url || ""}\nملخص: ${
        article.description || article.excerpt || ""
      }\n\n`
    : "";

  return `
${brandName} هي منصة عربية متخصصة في تبسيط الذكاء الاصطناعي للأعمال والمهنيين.

مهمتك الآن:
- فهم سؤال المستخدم.
- استخدام سياق المقال (إن وجد) لإعطاء إجابة عملية ومركزة.
- الكتابة بأسلوب ${brandName}: مشجع، عملي، واحترامي، بدون مبالغة أو وعود وهمية.
- تجنب اللغة التسويقية الفارغة، وركز على القيمة والفهم الواضح.

سؤال المستخدم:
"${ctx.question}"

سياق المقال (إن وجد):
${articleContext}

قدّم إجابة:
- واضحة
- مقسمة لفقرات قصيرة
- إن احتجت، يمكنك ذكر أن التفاصيل الكاملة موجودة في المقال المتعلق على مدونة ${brandName}.
`.trim();
}

// الدالة الموحّدة التي يستدعيها السيرفر
async function decideResponseFlow(context) {
  const {
    question,
    intent,
    lang,
    isAIDomain,
    businessType = "blog"
  } = context;

  const aiCfg = NOVA_BRAIN_V3.AI_ENGINE || {};
  const useLLM =
    aiCfg.ENABLED &&
    (!aiCfg.ONLY_AI_DOMAIN_USES_LLM || !!isAIDomain);

  const model = aiCfg.MODEL || "gemini-2.0-flash";
  const mode = (businessType || "blog").toLowerCase();

  // في هذه المرحلة نركز على وضع "blog"
  const isBlogMode = mode === "blog";

  // 1) محاولة استرجاع مقال مناسب
  let bestMatch = { match: null, score: 0 };
  try {
    bestMatch = await Knowledge.findBestMatch(question);
  } catch (err) {
    console.error("[Decision] Knowledge error:", err.message);
  }

  const match = bestMatch.match;
  const score = bestMatch.score || 0;

  // thresholds تقريبية:
  const HIGH = 0.7;
  const MED = 0.45;

  // ------------------------------
  // A) Knowledge Only (Blog Mode)
  // ------------------------------
  if (isBlogMode && match && score >= HIGH) {
    const answer = `
✅ يبدو أن سؤالك مرتبط بمحتوى تم تغطيته بالفعل في مدونة نوفا لينك.<br><br>
<strong>${match.title || "مقال ذو صلة"}</strong><br>
${match.excerpt || match.description || ""}<br><br>
🔗 يمكنك قراءة التفاصيل كاملة من هنا:<br>
<a href="${match.url}" target="_blank" class="nova-link">انتقل إلى المقال على مدونة نوفا لينك</a>
    `.trim();

    return {
      ok: true,
      provider: "knowledge",
      answer
    };
  }

  // ------------------------------
  // B) Knowledge + AI (Boosted)
  // ------------------------------
  if (isBlogMode && match && score >= MED && useLLM) {
    try {
      const prompt = buildBlogPrompt(context, match);
      const aiAnswer = await callGemini(model, prompt);

      const extraLink = match.url
        ? `<br><br>🔗 للمزيد من التفاصيل العملية، راجع هذا المقال:<br>
<a href="${match.url}" target="_blank" class="nova-link">${match.title ||
            "مقال ذو صلة على مدونة نوفا لينك"}</a>`
        : "";

      const answer = `${aiAnswer}${extraLink}`;

      return {
        ok: true,
        provider: "knowledge+ai",
        answer
      };
    } catch (err) {
      console.error("[Decision] Gemini (knowledge+ai) error:", err.message);
      // في حال فشل Gemini نرجع لفلّباك أدناه
    }
  }

  // ------------------------------
  // C) AI Only (عند عدم وجود معرفة كافية)
  // ------------------------------
  if (useLLM && isAIDomain) {
    try {
      const prompt = buildBlogPrompt(context, null);
      const aiAnswer = await callGemini(model, prompt);

      return {
        ok: true,
        provider: "ai",
        answer: aiAnswer
      };
    } catch (err) {
      console.error("[Decision] Gemini (ai only) error:", err.message);
      // نستمر إلى fallback
    }
  }

  // ------------------------------
  // D) Fallback مؤتمت
  // ------------------------------
  const fb = Fallback.automatedFallbackReply(intent, lang || "ar");

  return {
    ok: true,
    provider: "fallback",
    answer: fb
  };
}

// دالة بسيطة لاختبار Gemini يدويًا إن احتجت
async function testGemini(text) {
  const prompt = `اختبر فقط الرد باللغة العربية على النص التالي:\n\n${text}`;
  return callGemini("gemini-2.0-flash", prompt);
}

module.exports = {
  decideResponseFlow,
  testGemini
};
