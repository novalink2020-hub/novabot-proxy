import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const KNOWLEDGE_URL = process.env.KNOWLEDGE_V5_URL || "";

let genAI = null;
if (GEMINI_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_KEY);
}

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

const STRONG_MATCH_THRESHOLD = 0.65;
const MEDIUM_MATCH_THRESHOLD = 0.4;

const AI_KEYWORDS = [
  "ذكاء اصطناعي",
  "ذكاء",
  "ai",
  "gpt",
  "gemini",
  "نموذج",
  "prompt",
  "توليد",
  "model",
  "llm",
  "automation",
];

const BUSINESS_KEYWORDS = [
  "عمل",
  "مشروع",
  "تسويق",
  "محتوى",
  "ريادة",
  "freelance",
  "business",
  "startup",
  "side hustle",
  "workflow",
  "productivity",
  "إنتاجية",
];

const OUT_OF_SCOPE_KEYWORDS = [
  "سيارة",
  "سيارات",
  "أزياء",
  "موضة",
  "غناء",
  "أغنية",
  "رياضة",
  "كرة",
  "طبخ",
  "وصفة",
  "وصفات",
  "حب",
  "رومانسية",
  "مشاهير",
  "celebrity",
  "celebrities",
  "football",
  "nfl",
  "nba",
  "مباراة",
  "رحلة",
  "سفر",
  "travel",
  "طقس",
  "أخبار",
];

const STOPWORDS_EN = new Set([
  "the",
  "and",
  "or",
  "in",
  "on",
  "at",
  "to",
  "for",
  "a",
  "an",
  "of",
  "is",
  "it",
  "that",
  "this",
  "with",
  "by",
  "from",
  "as",
  "are",
  "was",
  "were",
  "be",
  "can",
  "could",
  "should",
  "would",
  "about",
  "into",
  "than",
  "then",
  "so",
  "if",
  "but",
]);

const STOPWORDS_AR = new Set([
  "في",
  "من",
  "على",
  "إلى",
  "الى",
  "عن",
  "أن",
  "إن",
  "ما",
  "لا",
  "لم",
  "لن",
  "هذا",
  "هذه",
  "ذلك",
  "تلك",
  "هناك",
  "هو",
  "هي",
  "هم",
  "هن",
  "كان",
  "كانت",
  "كانت",
  "كون",
  "قد",
  "كل",
  "أي",
  "أو",
  "و",
  "يا",
  "مع",
  "مثل",
]);

const NOVABOT_TEXT_PACKAGE = {
  welcomeFirst: {
    en: "Hey! I’m NovaBot, NovaLink’s AI Business Coach. What are you building or learning right now?",
    ar: "أهلاً! أنا NovaBot من NovaLink، مدرب أعمال بالذكاء الاصطناعي. ما المشروع أو المهارة التي تركز عليها الآن؟",
  },
  welcomeReturning: {
    en: "Welcome back! What’s the next AI step you want to move forward?",
    ar: "مرحباً بعودتك! ما الخطوة التالية التي تريد دفعها في عملك مع الذكاء الاصطناعي؟",
  },
  genericReplies: {
    en: [
      "Let’s channel that energy into something that moves your work forward—what’s one AI angle you’re curious about?",
      "I’m here to help you turn ideas into action. What’s a business or productivity goal you want to upgrade with AI?",
      "Small pivots create big results. Tell me a workflow or project you’d like to streamline.",
      "Imagine a quick win this week—where could AI save you time or unlock new revenue?",
      "Let’s refocus on what matters: your work, your systems, and your growth with AI.",
      "Ready to make progress? Pick one area—content, automation, or a new service—and let’s craft an AI plan.",
    ],
    ar: [
      "خلينا نحول الطاقة هذه لشيء يطور شغلك—ما الزاوية أو الفكرة في الذكاء الاصطناعي اللي حاب تستكشفها؟",
      "أنا هنا لأحول الأفكار لأفعال. ما هدف العمل أو الإنتاجية اللي حاب تعززه بالذكاء الاصطناعي؟",
      "تغييرات بسيطة تصنع نتائج كبيرة. شاركني مهمة أو مشروع وتبغى تبسطه بالذكاء الاصطناعي.",
      "تخيل فوز سريع هذا الأسبوع—وين ممكن الذكاء الاصطناعي يوفر لك وقت أو يفتح دخل جديد؟",
      "خلينا نرجع للتركيز: شغلك، أنظمتك، ونموك مع الذكاء الاصطناعي.",
      "جاهز نتقدم؟ اختر مجال واحد—المحتوى، الأتمتة، أو خدمة جديدة—ونبني خطة ذكاء اصطناعي.",
    ],
  },
  positiveReplies: {
    en: "Glad it helped! What’s the next piece you want to move forward?",
    ar: "سعيد إنها فادتك! ما الخطوة التالية التي تريد العمل عليها؟",
  },
  negativeReplies: {
    en: "I hear you. Tell me a bit more about what feels off, and we’ll adjust together.",
    ar: "متفهم إحساسك. شاركني ما الذي يضايقك وسنعدل معاً.",
  },
  aboutNovaLink: {
    en: "NovaLink builds AI systems, playbooks, and training to help people and teams work smarter. Explore our guides and services anytime.",
    ar: "NovaLink تبني أنظمة وخطط وتدريب بالذكاء الاصطناعي لتساعد الأفراد والفرق على العمل بذكاء أكبر. استكشف أدلتنا وخدماتنا في أي وقت.",
  },
  story: {
    en: "NovaLink started as a small lab focused on AI for real business outcomes. We experiment, document, and share what works so you can ship faster.",
    ar: "بدأت NovaLink كمختبر صغير يركز على الذكاء الاصطناعي لنتائج عملية في الأعمال. نجرب ونوثق ونشارك ما ينجح لتنفذ أسرع.",
  },
  mission: {
    en: "Our mission is to make AI practical for builders, professionals, and teams—helping you design systems, automate workflows, and grow your career.",
    ar: "مهمتنا جعل الذكاء الاصطناعي عملياً للرواد والمهنيين والفرق—لنساعدك في تصميم الأنظمة وأتمتة المهام وتنمية مسارك المهني.",
  },
  noMatch: {
    en: "We haven’t published something specific on that yet, but here’s our vision: practical AI, clear systems, and tangible momentum for your work.",
    ar: "لم ننشر محتوى محدد حول هذا بعد، لكن رؤيتنا: ذكاء اصطناعي عملي، أنظمة واضحة، وزخم ملموس لعملك.",
  },
  goodbye: {
    en: "Talk soon—keep building!",
    ar: "إلى لقاء قريب—واصل البناء!",
  },
};

let knowledgeCache = null;
let knowledgeLoaded = false;

function normalizeKnowledgeItem(raw) {
  if (!raw) return null;
  return {
    title: raw.title || "",
    url: raw.url || raw.link || "",
    description: raw.description || "",
    excerpt: raw.excerpt || "",
    summary: raw.summary || raw.excerpt || raw.description || "",
    category: raw.category || "",
    keywords: Array.isArray(raw.keywords) ? raw.keywords : [],
  };
}

async function loadKnowledge() {
  if (knowledgeLoaded && knowledgeCache) return knowledgeCache;
  if (!KNOWLEDGE_URL) {
    knowledgeLoaded = true;
    knowledgeCache = [];
    return knowledgeCache;
  }
  try {
    const response = await fetch(KNOWLEDGE_URL);
    if (!response.ok) throw new Error(`Knowledge fetch failed: ${response.status}`);
    const data = await response.json();
    const items = Array.isArray(data) ? data : data?.items;
    if (!Array.isArray(items)) {
      knowledgeLoaded = true;
      knowledgeCache = [];
      return knowledgeCache;
    }
    knowledgeCache = items.map(normalizeKnowledgeItem).filter(Boolean);
    knowledgeLoaded = true;
    return knowledgeCache;
  } catch (error) {
    console.error("loadKnowledge error", error);
    knowledgeLoaded = true;
    knowledgeCache = [];
    return knowledgeCache;
  }
}

function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function computeMatchScore(userTokens, item) {
  const fields = [item.title, item.description, item.summary, item.category, ...(item.keywords || [])]
    .join(" ")
    .toLowerCase();
  const fieldTokens = tokenize(fields);
  if (fieldTokens.length === 0) return 0;
  const uniqueFields = new Set(fieldTokens);
  const overlap = userTokens.reduce((acc, token) => acc + (uniqueFields.has(token) ? 1 : 0), 0);
  return overlap / Math.max(uniqueFields.size, userTokens.length, 1);
}

function findBestMatch(userText, items) {
  if (!userText || !Array.isArray(items) || items.length === 0) {
    return { item: null, score: 0, matchType: "none" };
  }
  const userTokens = tokenize(userText);
  let bestItem = null;
  let bestScore = 0;
  for (const item of items) {
    const score = computeMatchScore(userTokens, item);
    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }
  if (bestScore >= STRONG_MATCH_THRESHOLD) return { item: bestItem, score: bestScore, matchType: "strong" };
  if (bestScore >= MEDIUM_MATCH_THRESHOLD) return { item: bestItem, score: bestScore, matchType: "medium" };
  return { item: bestItem, score: bestScore, matchType: "none" };
}

function buildSystemPrompt({ language, dialectHint }) {
  const dialectNote = language === "ar" ? `أضف 1-3 كلمات خفيفة بلهجة ${dialectHint} فقط إن كانت مناسبة.` : "";
  const languageNote = language === "ar"
    ? "أجب بالفصحى الواضحة، محافظة على نبرة مهنية هادئة ومحفزة، بدون عامية ثقيلة."
    : "Respond in warm, clear English with a calm, practical coaching tone.";
  return [
    "You are NovaBot, NovaLink’s AI Business Coach.",
    "Bilingual (Arabic/English) with light dialect awareness.",
    "Tone: calm, encouraging, practical, action-oriented.",
    languageNote,
    dialectNote,
    "Keep replies concise, avoid long paragraphs, and focus on next steps.",
    "Always stay within AI, business, productivity, and career guidance.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function callGemini({ language, dialectHint, systemRole, userPrompt, maxTokens, sessionConcepts, mode }) {
  if (!genAI) throw new Error("Gemini unavailable");
  const modelNames = ["gemini-2.0-flash", "gemini-2.0-pro", "gemini-1.0-pro"];
  let modelInstance = null;
  let lastError = null;
  for (const name of modelNames) {
    try {
      modelInstance = genAI.getGenerativeModel({ model: name, safetySettings: SAFETY_SETTINGS });
      const systemInstruction = buildSystemPrompt({ language, dialectHint });
      const parts = [
        systemInstruction,
        systemRole || "",
        sessionConcepts && sessionConcepts.length > 0
          ? `Session concepts: ${sessionConcepts.join(", ")}`
          : "",
        userPrompt,
      ]
        .filter(Boolean)
        .join("\n\n");

      const result = await modelInstance.generateContent({
        contents: [{ role: "user", parts: [{ text: parts }]}],
        generationConfig: { maxOutputTokens: maxTokens || 150 },
      });
      const text = result?.response?.text();
      if (!text) throw new Error("Empty Gemini response");
      return text.trim();
    } catch (error) {
      lastError = error;
      continue;
    }
  }
  throw lastError || new Error("Gemini failed");
}

function stripHTML(text) {
  return (text || "").replace(/<[^>]*>/g, " ").trim();
}

function extractConceptsFromReply(text, language) {
  const clean = stripHTML(text);
  const tokens = tokenize(clean).filter((token) => {
    if (language === "ar") return !STOPWORDS_AR.has(token);
    return !STOPWORDS_EN.has(token);
  });
  const concepts = new Set();
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.length > 3) concepts.add(token);
    const phrase2 = tokens.slice(i, i + 2).join(" ");
    const phrase3 = tokens.slice(i, i + 3).join(" ");
    const phrase4 = tokens.slice(i, i + 4).join(" ");
    if (phrase2.split(" ").length === 2) concepts.add(phrase2);
    if (phrase3.split(" ").length === 3) concepts.add(phrase3);
    if (phrase4.split(" ").length === 4) concepts.add(phrase4);
    if (concepts.size >= 10) break;
  }
  return Array.from(concepts).slice(0, 10);
}

function pickText(key, language) {
  const value = NOVABOT_TEXT_PACKAGE[key];
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[language] || value.en || "";
}

function buildKnowledgeReply(item, language) {
  const summary = item.summary || item.description || item.excerpt || item.title;
  const linkLine = item.url ? `\n\n${item.url}` : "";
  if (language === "ar") {
    return `${summary}\nانقر للاطلاع أكثر: ${linkLine || ""}`.trim();
  }
  return `${summary}\nCheck the article: ${linkLine || ""}`.trim();
}

function buildKnowledgeWrappedReply(item, aiReply, language) {
  const intro = language === "ar" ? "وجدت مادة مفيدة من NovaLink:" : "I found a helpful NovaLink resource:";
  const linkLine = item.url ? `\n${item.url}` : "";
  return `${intro}\n${item.title}\n${aiReply}${linkLine}`.trim();
}

function buildSalesReply(intentId, language) {
  switch (intentId) {
    case "subscribe_interest":
      return language === "ar"
        ? "يمكنك الاشتراك لتصلك تحديثات ونصائح عملية عن الذكاء الاصطناعي للأعمال."
        : "You can subscribe to get practical AI-for-business updates and playbooks.";
    case "consulting_purchase":
      return language === "ar"
        ? "فريق NovaLink يبني حلول وبوتات ذكاء اصطناعي لعملك. أخبرني بمجالك لنقترح الخطوة التالية."
        : "NovaLink builds AI solutions and bots for your business. Tell me about your domain and we’ll suggest the next step.";
    case "collaboration":
      return language === "ar"
        ? "متحمسون للشراكات وورش العمل. شاركني الفكرة أو الجمهور المستهدف."
        : "We’re open to collaborations and workshops. Share the idea or audience you have in mind.";
    case "developer_identity":
      return language === "ar"
        ? "تم بناء NovaBot بواسطة فريق NovaLink. إليك بطاقة التعريف بالمطور."
        : "NovaBot is built by the NovaLink team. Here’s the developer identity card.";
    default:
      return "";
  }
}

function isOutOfScopeMessage(text) {
  const lower = (text || "").toLowerCase();
  const outScore = OUT_OF_SCOPE_KEYWORDS.reduce((acc, word) => (lower.includes(word.toLowerCase()) ? acc + 1 : acc), 0);
  const aiScore = AI_KEYWORDS.reduce((acc, word) => (lower.includes(word.toLowerCase()) ? acc + 1 : acc), 0);
  const bizScore = BUSINESS_KEYWORDS.reduce((acc, word) => (lower.includes(word.toLowerCase()) ? acc + 1 : acc), 0);
  return outScore > 0 && aiScore + bizScore === 0;
}

function computeOOStrike(intentId, sessionHistory) {
  if (intentId !== "out_of_scope") return 0;
  const lastUsers = (sessionHistory || [])
    .filter((m) => m.role === "user")
    .slice(-3);
  let count = 0;
  for (const msg of lastUsers) {
    if (isOutOfScopeMessage(msg.content || "")) count += 1;
  }
  return count;
}

function chooseGenericMotivation(language) {
  const list = NOVABOT_TEXT_PACKAGE.genericReplies[language] || NOVABOT_TEXT_PACKAGE.genericReplies.en;
  return list[Math.floor(Math.random() * list.length)] || "";
}

function isFirstTurn(sessionHistory) {
  return !sessionHistory || sessionHistory.length === 0;
}

async function buildAIReply({ request, knowledgeItems }) {
  const { message, intentId, language, dialectHint, sessionConcepts } = request;
  const oosStrike = computeOOStrike(intentId, request.sessionHistory);

  if (intentId === "out_of_scope") {
    if (oosStrike >= 2) {
      return {
        ok: true,
        reply: chooseGenericMotivation(language),
        actionCard: null,
        usedAI: false,
        mode: "motivation",
        oosStrike,
      };
    }
    try {
      const maxTokens = oosStrike === 1 ? 60 : 80;
      const pivotPrompt = language === "ar"
        ? "اعطني جملة قصيرة توجه الحديث نحو الذكاء الاصطناعي للأعمال أو الإنتاجية، مع لمسة تشجيعية."
        : "Give a concise line that pivots back to AI for business or productivity, with a supportive tone.";
      const reply = await callGemini({
        language,
        dialectHint,
        systemRole: "Short pivot back to AI/business domain.",
        userPrompt: `${message}\n\n${pivotPrompt}`,
        maxTokens,
        sessionConcepts,
        mode: "oos_pivot",
      });
      return {
        ok: true,
        reply,
        actionCard: null,
        usedAI: true,
        mode: "ai",
        maxTokens,
        oosStrike,
      };
    } catch (error) {
      console.error("oos pivot failed", error);
      return {
        ok: true,
        reply: chooseGenericMotivation(language),
        actionCard: null,
        usedAI: false,
        mode: "fallback",
        oosStrike,
      };
    }
  }

  if (intentId === "ai_business") {
    const firstTurn = isFirstTurn(request.sessionHistory);
    if (firstTurn) {
      try {
        const maxTokens = 80;
        const prompt = language === "ar"
          ? `السؤال: ${message}\nرد موجز ودود يربط بالسياق: الذكاء الاصطناعي للأعمال، الإنتاجية، أو المهارات. قدم زاوية عملية وخطوة تالية.`
          : `User: ${message}\nReply briefly with a friendly, practical angle that links to AI for business, productivity, or skills. Offer a next step.`;
        const reply = await callGemini({
          language,
          dialectHint,
          systemRole: "First-turn pivot with helpful angle.",
          userPrompt: prompt,
          maxTokens,
          sessionConcepts,
          mode: "first_turn",
        });
        return { ok: true, reply, actionCard: null, usedAI: true, mode: "ai", maxTokens, oosStrike };
      } catch (error) {
        console.error("first-turn AI failed", error);
        return {
          ok: true,
          reply: chooseGenericMotivation(language),
          actionCard: null,
          usedAI: false,
          mode: "fallback",
          oosStrike,
        };
      }
    }

    const knowledgeMatch = findBestMatch(message, knowledgeItems || []);
    if (knowledgeMatch.matchType === "strong" && knowledgeMatch.item) {
      return {
        ok: true,
        reply: buildKnowledgeReply(knowledgeMatch.item, language),
        actionCard: null,
        usedAI: false,
        matchType: "strong",
        mode: "knowledge",
        oosStrike,
      };
    }

    if (knowledgeMatch.matchType === "medium" && knowledgeMatch.item) {
      try {
        const maxTokens = 100;
        const knowledgeContext = language === "ar"
          ? `مقال مرتبط: ${knowledgeMatch.item.title}\n${knowledgeMatch.item.summary}`
          : `Related article: ${knowledgeMatch.item.title}\n${knowledgeMatch.item.summary}`;
        const prompt = `${knowledgeContext}\n\nسؤال المستخدم / User question: ${message}`;
        const aiReply = await callGemini({
          language,
          dialectHint,
          systemRole: "Use knowledge context and keep concise.",
          userPrompt: prompt,
          maxTokens,
          sessionConcepts,
          mode: "knowledge_medium",
        });
        return {
          ok: true,
          reply: buildKnowledgeWrappedReply(knowledgeMatch.item, aiReply, language),
          actionCard: null,
          usedAI: true,
          matchType: "medium",
          mode: "knowledge",
          maxTokens,
          oosStrike,
        };
      } catch (error) {
        console.error("medium knowledge AI failed", error);
      }
    }

    try {
      const maxTokens = 200;
      const prompt = language === "ar"
        ? `السؤال: ${message}\nقدّم إجابة عملية مختصرة مع خطوات أو أفكار قابلة للتنفيذ في الذكاء الاصطناعي للأعمال أو الإنتاجية أو المهارات.`
        : `Question: ${message}\nProvide a concise, practical answer with actionable steps for AI in business, productivity, or skills.`;
      const reply = await callGemini({
        language,
        dialectHint,
        systemRole: "AI-first practical guidance.",
        userPrompt: prompt,
        maxTokens,
        sessionConcepts,
        mode: "ai",
      });
      return { ok: true, reply, actionCard: null, usedAI: true, mode: "ai", maxTokens, matchType: knowledgeMatch.matchType || "none", oosStrike };
    } catch (error) {
      console.error("ai_business AI failed", error);
      if (knowledgeMatch.item) {
        return {
          ok: true,
          reply: buildKnowledgeReply(knowledgeMatch.item, language),
          actionCard: null,
          usedAI: false,
          mode: "fallback",
          matchType: knowledgeMatch.matchType,
          oosStrike,
        };
      }
      return {
        ok: true,
        reply: chooseGenericMotivation(language),
        actionCard: null,
        usedAI: false,
        mode: "fallback",
        matchType: "none",
        oosStrike,
      };
    }
  }

  return null;
}

function handleFixedIntent(intentId, language) {
  const mapping = {
    greeting: "welcomeFirst",
    welcomeFirst: "welcomeFirst",
    welcomeReturning: "welcomeReturning",
    thanks_positive: "positiveReplies",
    negative_mood: "negativeReplies",
    novalink_info: "aboutNovaLink",
    novabot_info: "aboutNovaLink",
    aboutNovaLink: "aboutNovaLink",
    story: "story",
    mission: "mission",
    noMatch: "noMatch",
    goodbye: "goodbye",
  };
  const key = mapping[intentId];
  if (!key) return null;
  return pickText(key, language);
}

function buildSalesCard(intentId) {
  switch (intentId) {
    case "subscribe_interest":
      return "subscribe";
    case "consulting_purchase":
      return "bot_lead";
    case "collaboration":
      return "collaboration";
    case "developer_identity":
      return "developer_identity";
    default:
      return null;
  }
}

function buildSalesResponse(intentId, language) {
  const actionCard = intentId === "subscribe_interest" ? "subscribe" : buildSalesCard(intentId);
  return {
    ok: true,
    reply: buildSalesReply(intentId, language),
    actionCard,
    usedAI: false,
    mode: "motivation",
  };
}

function buildFallbackFromKnowledge(knowledgeMatch, language) {
  if (knowledgeMatch.item && knowledgeMatch.matchType !== "none") {
    return {
      ok: true,
      reply: buildKnowledgeReply(knowledgeMatch.item, language),
      actionCard: null,
      usedAI: false,
      mode: "fallback",
      matchType: knowledgeMatch.matchType,
    };
  }
  return null;
}

function buildUpdateMode(language) {
  return language === "ar"
    ? "NovaBot حالياً في وضع التحديث، لكن يمكنك الاستفادة من مقالات NovaLink وخططها العملية."
    : "NovaBot is currently in update mode, but you can still benefit from NovaLink articles and playbooks.";
}

export async function novaBrainSystem(request) {
  const safeResponse = {
    ok: true,
    reply: pickText("noMatch", request.language || "en"),
    actionCard: null,
    usedAI: false,
    mode: "fallback",
  };

  try {
    const language = request.language === "ar" ? "ar" : "en";
    const dialectHint = request.dialectHint || "neutral";
    const intentId = request.intentId;
    const allowGemini = !!request.allowGemini;
    const sessionHistory = Array.isArray(request.sessionHistory) ? request.sessionHistory : [];
    const knowledgeItems = await loadKnowledge();

    const fixedReply = handleFixedIntent(intentId, language);
    if (fixedReply) {
      const replyText = fixedReply;
      const concepts = extractConceptsFromReply(replyText, language);
      return { ok: true, reply: replyText, actionCard: null, usedAI: false, mode: "motivation", extractedConcepts: concepts, oosStrike: 0 };
    }

    if (["subscribe_interest", "consulting_purchase", "collaboration", "developer_identity"].includes(intentId)) {
      const response = buildSalesResponse(intentId, language);
      response.extractedConcepts = extractConceptsFromReply(response.reply, language);
      response.oosStrike = intentId === "out_of_scope" ? computeOOStrike(intentId, sessionHistory) : 0;
      return response;
    }

    const oosStrike = computeOOStrike(intentId, sessionHistory);

    if (!allowGemini || !genAI) {
      const knowledgeMatch = findBestMatch(request.message, knowledgeItems || []);
      const knowledgeFallback = buildFallbackFromKnowledge(knowledgeMatch, language);
      if (knowledgeFallback) {
        knowledgeFallback.extractedConcepts = extractConceptsFromReply(knowledgeFallback.reply, language);
        knowledgeFallback.oosStrike = oosStrike;
        return knowledgeFallback;
      }
      const replyText = chooseGenericMotivation(language) || buildUpdateMode(language);
      return {
        ok: true,
        reply: replyText,
        actionCard: null,
        usedAI: false,
        mode: "fallback",
        matchType: knowledgeMatch.matchType,
        extractedConcepts: extractConceptsFromReply(replyText, language),
        oosStrike,
      };
    }

    const aiReply = await buildAIReply({ request, knowledgeItems });
    if (aiReply) {
      aiReply.extractedConcepts = extractConceptsFromReply(aiReply.reply, language);
      return aiReply;
    }

    const knowledgeMatch = findBestMatch(request.message, knowledgeItems || []);
    const knowledgeFallback = buildFallbackFromKnowledge(knowledgeMatch, language);
    if (knowledgeFallback) {
      knowledgeFallback.extractedConcepts = extractConceptsFromReply(knowledgeFallback.reply, language);
      knowledgeFallback.oosStrike = oosStrike;
      return knowledgeFallback;
    }

    const replyText = chooseGenericMotivation(language) || buildUpdateMode(language);
    return {
      ok: true,
      reply: replyText,
      actionCard: null,
      usedAI: false,
      mode: "fallback",
      matchType: knowledgeMatch.matchType,
      extractedConcepts: extractConceptsFromReply(replyText, language),
      oosStrike,
    };
  } catch (error) {
    console.error("novaBrainSystem fatal", error);
    return safeResponse;
  }
}

export default novaBrainSystem;
