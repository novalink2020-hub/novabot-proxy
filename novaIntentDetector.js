import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const KNOWLEDGE_URL = process.env.KNOWLEDGE_V5_URL || "";

const STRONG_MATCH_THRESHOLD = 0.65;
const MEDIUM_MATCH_THRESHOLD = 0.4;

let genAI = null;
if (GEMINI_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_KEY);
}

const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_ONLY_HIGH" },
];

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
    knowledgeCache = Array.isArray(items) ? items.map(normalizeKnowledgeItem).filter(Boolean) : [];
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
  const languageNote = language === "ar"
    ? "أجب بالعربية الفصحى الواضحة مع نبرة هادئة ومحفزة. أضف 1-3 كلمات خفيفة من اللهجة المناسبة عند الملاءمة."
    : "Respond in warm, clear English with a calm, practical, action-oriented tone.";
  const dialectNote = language === "ar" ? `اللهجة المفضلة: ${dialectHint}.` : "";
  return [
    "You are NovaBot, NovaLink’s AI Business Coach for AI, business, and productivity.",
    "Bilingual (Arabic/English) with light dialect awareness for Arabic.",
    languageNote,
    dialectNote,
    "Keep replies concise; avoid long paragraphs.",
    "Provide clear steps, options, or angles that motivate action.",
    "Stay strictly within AI, business, productivity, or career guidance.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function callGemini({ language, dialectHint, systemRole, userPrompt, maxTokens, sessionConcepts, mode }) {
  if (!genAI) throw new Error("Gemini unavailable");
  const modelNames = ["gemini-2.0-flash", "gemini-2.0-pro", "gemini-1.0-pro"];
  let lastError = null;
  for (const name of modelNames) {
    try {
      const model = genAI.getGenerativeModel({ model: name, safetySettings: SAFETY_SETTINGS });
      const systemInstruction = buildSystemPrompt({ language, dialectHint });
      const promptParts = [
        systemInstruction,
        systemRole || "",
        sessionConcepts && sessionConcepts.length > 0 ? `Session concepts: ${sessionConcepts.join(", ")}` : "",
        userPrompt,
      ]
        .filter(Boolean)
        .join("\n\n");
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: promptParts }]}],
        generationConfig: { maxOutputTokens: maxTokens || 150 },
      });
      const text = result?.response?.text();
      if (!text) throw new Error("Empty Gemini response");
      return text.trim();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Gemini failed");
}

function stripHTML(text) {
  return (text || "").replace(/<[^>]*>/g, " ").trim();
}

function extractConceptsFromReply(text, language) {
  const clean = stripHTML(text);
  const tokens = tokenize(clean).filter((token) => (language === "ar" ? !STOPWORDS_AR.has(token) : !STOPWORDS_EN.has(token)));
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

function chooseGenericMotivation(language) {
  const list = NOVABOT_TEXT_PACKAGE.genericReplies[language] || NOVABOT_TEXT_PACKAGE.genericReplies.en;
  return list[Math.floor(Math.random() * list.length)] || "";
}

function buildKnowledgeReply(item, language) {
  const summary = item.summary || item.description || item.excerpt || item.title;
  const linkLine = item.url ? `\n\n${item.url}` : "";
  if (language === "ar") {
    return `${summary}\nانقر للاطلاع أكثر:${linkLine ? " " : ""}${linkLine}`.trim();
  }
  return `${summary}\nCheck the article:${linkLine ? " " : ""}${linkLine}`.trim();
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

function buildSalesCard(intentId) {
  switch (intentId) {
    case "subscribe_interest":
      return "business_subscribe";
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

function buildUpdateMode(language) {
  return language === "ar"
    ? "NovaBot حالياً في وضع التحديث، لكن يمكنك الاستفادة من مقالات NovaLink وخططها العملية."
    : "NovaBot is currently in update mode, but you can still benefit from NovaLink articles and playbooks.";
}

function handleFixedIntent(intentId, language) {
  switch (intentId) {
    case "greeting":
    case "welcomeFirst":
      return pickText("welcomeFirst", language);
    case "welcomeReturning":
      return pickText("welcomeReturning", language);
    case "thanks_positive":
      return pickText("positiveReplies", language);
    case "negative_mood":
      return pickText("negativeReplies", language);
    case "novalink_info":
    case "novabot_info":
    case "aboutNovaLink":
      return pickText("aboutNovaLink", language);
    case "story":
      return pickText("story", language);
    case "mission":
      return pickText("mission", language);
    case "noMatch":
      return pickText("noMatch", language);
    case "goodbye":
      return pickText("goodbye", language);
    default:
      return null;
  }
}

function isOutOfScopeMessage(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  const outKeywords = [
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
  return outKeywords.some((word) => lower.includes(word));
}

function computeOOStrike(intentId, sessionHistory) {
  if (intentId !== "out_of_scope") return 0;
  const lastUserMessages = (sessionHistory || []).filter((m) => m.role === "user").slice(-3);
  let strikes = 0;
  for (const msg of lastUserMessages) {
    if (isOutOfScopeMessage(msg.content || "")) strikes += 1;
  }
  return strikes;
}

function isFirstTurn(sessionHistory) {
  return !sessionHistory || sessionHistory.length === 0;
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
        maxTokens: null,
      };
    }
    const maxTokens = oosStrike === 1 ? 60 : 80;
    const pivotPrompt = language === "ar"
      ? "اعطني رداً موجزاً يعيد توجيه الحديث إلى الذكاء الاصطناعي للأعمال أو الإنتاجية مع نبرة داعمة."
      : "Give a concise line that pivots back to AI for business or productivity with a supportive tone.";
    const userPrompt = `${message}\n\n${pivotPrompt}`;
    const reply = await callGemini({
      language,
      dialectHint,
      systemRole: "Out-of-scope pivot back to AI/business context.",
      userPrompt,
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
      oosStrike,
      maxTokens,
    };
  }

  if (intentId === "ai_business") {
    const firstTurn = isFirstTurn(request.sessionHistory);
    if (firstTurn) {
      const maxTokens = 70;
      const prompt = language === "ar"
        ? `السؤال: ${message}\nرد موجز ودود يربط بالسياق: الذكاء الاصطناعي للأعمال أو الإنتاجية أو المهارات. قدم زاوية عملية وخطوة تالية.`
        : `User: ${message}\nReply briefly with a friendly, practical angle that links to AI for business, productivity, or skills. Offer a next step.`;
      const reply = await callGemini({
        language,
        dialectHint,
        systemRole: "First-turn helpful pivot with NovaLink orientation.",
        userPrompt: prompt,
        maxTokens,
        sessionConcepts,
        mode: "first_turn",
      });
      return {
        ok: true,
        reply,
        actionCard: null,
        usedAI: true,
        mode: "ai",
        oosStrike,
        maxTokens,
      };
    }

    const knowledgeMatch = findBestMatch(message, knowledgeItems || []);
    if (knowledgeMatch.matchType === "strong" && knowledgeMatch.item) {
      return {
        ok: true,
        reply: buildKnowledgeReply(knowledgeMatch.item, language),
        actionCard: null,
        usedAI: false,
        mode: "knowledge",
        matchType: "strong",
        oosStrike,
        maxTokens: null,
      };
    }

    if (knowledgeMatch.matchType === "medium" && knowledgeMatch.item) {
      const maxTokens = 100;
      const knowledgeContext = `${knowledgeMatch.item.title}\n${knowledgeMatch.item.summary || knowledgeMatch.item.description}`;
      const prompt = language === "ar"
        ? `استفد من المعرفة التالية لتقديم رد عملي: ${knowledgeContext}\n\nالسؤال: ${message}`
        : `Use this knowledge to respond concisely: ${knowledgeContext}\n\nUser: ${message}`;
      const aiReply = await callGemini({
        language,
        dialectHint,
        systemRole: "Use provided NovaLink knowledge concisely.",
        userPrompt: prompt,
        maxTokens,
        sessionConcepts,
        mode: "knowledge",
      });
      return {
        ok: true,
        reply: buildKnowledgeWrappedReply(knowledgeMatch.item, aiReply, language),
        actionCard: null,
        usedAI: true,
        mode: "knowledge",
        matchType: "medium",
        oosStrike,
        maxTokens,
      };
    }

    const maxTokens = 180;
    const prompt = language === "ar"
      ? `السؤال: ${message}\nأعطِ إجابة مختصرة (150-200 كلمة) مع خطوات أو أفكار تطبيقية للذكاء الاصطناعي في الأعمال أو الإنتاجية.`
      : `User: ${message}\nProvide a concise (150-200 tokens) answer with actionable AI-for-business or productivity steps.`;
    const aiReply = await callGemini({
      language,
      dialectHint,
      systemRole: "Core AI business coaching reply.",
      userPrompt: prompt,
      maxTokens,
      sessionConcepts,
      mode: "ai_business",
    });
    return {
      ok: true,
      reply: aiReply,
      actionCard: null,
      usedAI: true,
      mode: "ai",
      matchType: "none",
      oosStrike,
      maxTokens,
    };
  }

  return null;
}

export async function novaBrainSystem(request) {
  const safeResponse = {
    ok: true,
    reply: pickText("noMatch", request?.language || "en"),
    actionCard: null,
    usedAI: false,
    mode: "fallback",
  };

  try {
    const language = request.language === "ar" ? "ar" : "en";
    const dialectHint = request.dialectHint || "neutral";
    const intentId = request.intentId;
    const allowGemini = Boolean(request.allowGemini);
    const sessionHistory = Array.isArray(request.sessionHistory) ? request.sessionHistory : [];

    const knowledgeItems = await loadKnowledge();

    const fixedReply = handleFixedIntent(intentId, language);
    if (fixedReply) {
      const extractedConcepts = extractConceptsFromReply(fixedReply, language);
      return {
        ok: true,
        reply: fixedReply,
        actionCard: null,
        usedAI: false,
        mode: "motivation",
        extractedConcepts,
        oosStrike: 0,
        matchType: null,
        maxTokens: null,
      };
    }

    if (["subscribe_interest", "consulting_purchase", "collaboration", "developer_identity"].includes(intentId)) {
      const response = buildSalesResponse(intentId, language);
      response.extractedConcepts = extractConceptsFromReply(response.reply, language);
      response.oosStrike = 0;
      response.matchType = null;
      response.maxTokens = null;
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
      const fallbackReply = chooseGenericMotivation(language) || buildUpdateMode(language);
      return {
        ok: true,
        reply: fallbackReply,
        actionCard: null,
        usedAI: false,
        mode: "fallback",
        matchType: knowledgeMatch.matchType,
        extractedConcepts: extractConceptsFromReply(fallbackReply, language),
        oosStrike,
        maxTokens: null,
      };
    }

    try {
      const aiReply = await buildAIReply({ request: { ...request, language, dialectHint }, knowledgeItems });
      if (aiReply) {
        aiReply.extractedConcepts = extractConceptsFromReply(aiReply.reply, language);
        aiReply.oosStrike = computeOOStrike(intentId, sessionHistory);
        if (!aiReply.matchType) aiReply.matchType = aiReply.matchType || null;
        return aiReply;
      }
    } catch (error) {
      console.error("AI reply failed", error);
    }

    const knowledgeMatch = findBestMatch(request.message, knowledgeItems || []);
    const knowledgeFallback = buildFallbackFromKnowledge(knowledgeMatch, language);
    if (knowledgeFallback) {
      knowledgeFallback.extractedConcepts = extractConceptsFromReply(knowledgeFallback.reply, language);
      knowledgeFallback.oosStrike = oosStrike;
      return knowledgeFallback;
    }

    const fallbackReply = chooseGenericMotivation(language) || buildUpdateMode(language);
    return {
      ok: true,
      reply: fallbackReply,
      actionCard: null,
      usedAI: false,
      mode: "fallback",
      matchType: knowledgeMatch.matchType,
      extractedConcepts: extractConceptsFromReply(fallbackReply, language),
      oosStrike,
      maxTokens: null,
    };
  } catch (error) {
    console.error("novaBrainSystem fatal", error);
    return safeResponse;
  }
}

export default novaBrainSystem;
