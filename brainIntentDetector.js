// =======================================================
// brainIntentDetector.js
// كاشف اللغة + اللهجة + النية + AI domain
// =======================================================

const { NOVA_BRAIN_V3 } = require("./nova-brain.v3.config");

// تحديد اللغة (عربي / إنجليزي) بناءً على الحروف
function detectLanguage(text = "") {
  const enOnly = /^[0-9a-zA-Z\s.,;:!?'"()@#%&*\-_/\\]+$/;
  return enOnly.test(text || "") ? "en" : "ar";
}

// محاولة بسيطة لكشف اللهجة (تقريبية لكن مفيدة للسياق)
function detectDialect(text = "") {
  const t = (text || "").toLowerCase();

  const gulf = ["وش", "ليه", "هاالشي", "مره", "واجد", "شلون", "يعطيك"];
  const egy = ["ازاي", "كده", "ليه", "عايز", "دلوقتي", "جامد"];
  const lev = ["ليش", "شو", "هيك", "كتير", "لسا", "هلق"];
  const magh = ["بزاف", "واش", "علاش", "دير", "بغيت", "برشا"];

  const hit = arr => arr.some(w => t.includes(w));

  if (hit(gulf)) return "gulf";
  if (hit(egy)) return "egyptian";
  if (hit(lev)) return "levant";
  if (hit(magh)) return "maghreb";
  return "msa"; // فصحى تقريبًا
}

// كشف النية بالاعتماد على INTENTS داخل config
function detectIntent(text = "") {
  const t = (text || "").toLowerCase();
  const intentsCfg = (NOVA_BRAIN_V3.INTENTS || {});

  let best = { intent: "GENERAL", score: 0 };

  for (const [intentKey, intentDef] of Object.entries(intentsCfg)) {
    const keywords = [
      ...((intentDef.AR || [])),
      ...((intentDef.EN || []))
    ].map(w => (w || "").toLowerCase());

    let score = 0;
    for (const kw of keywords) {
      if (!kw) continue;
      if (t.includes(kw)) score++;
    }

    if (score > 0 && score >= best.score) {
      best = { intent: intentKey, score };
    }
  }

  return best.intent || "GENERAL";
}

// كشف هل السؤال ضمن مجال الذكاء الاصطناعي / مجال تخصص نوفا لينك
function isAIDomain(text = "") {
  const t = (text || "").toLowerCase();
  const cfg = (NOVA_BRAIN_V3.DOMAIN_KEYWORDS || {});

  const ar = (cfg.AI_AR || []).map(w => (w || "").toLowerCase());
  const en = (cfg.AI_EN || []).map(w => (w || "").toLowerCase());

  const hit = arr => arr.some(w => w && t.includes(w));
  return hit(ar) || hit(en);
}

// alias باسم متوافق مع server-v3
function detectAIDomain(text = "") {
  return isAIDomain(text);
}

module.exports = {
  detectLanguage,
  detectDialect,
  detectIntent,
  isAIDomain,
  detectAIDomain
};
