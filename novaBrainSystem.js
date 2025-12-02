import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

let knowledgeCache = null;
let knowledgeLoadedAt = 0;

function sanitizeText(text) {
  const value = typeof text === "string" ? text : "";
  const escaped = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  return escaped.replace(/\r?\n/g, "<br>");
}

function normalizeMessage(text) {
  if (!text) return "";
  return String(text).trim();
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function getStopwords() {
  return new Set([
    "the","and","a","an","of","for","to","in","on","at","is","are","was","were","it","this","that","with","as","by","or","from","be","been","have","has","had","do","does","did","but","if","then","so","we","you","i","they","them","their","our","us","he","she","his","her","my","me","your","yours","about","into","over","under","out","up","down","very","can","could","should","would","will","just","not","no","yes","than","too","also","there","here","when","what","who","which","how","why","where",
    "و","في","على","من","إلى","الى","عن","أن","إن","ما","لا","نعم","هذا","هذه","هو","هي","هم","هن","انت","أنت","أنا","لقد","كان","كانت","ذلك","هناك","هنا","كما","قد","أو","بل","ثم","لكن","مع","كل","أي","اي","أية","اين","أين","كيف","لماذا","ماذا","منذ","حتى","على","الى","كانوا"
  ]);
}

function loadTextPackages() {
  return {
    ar: {
      welcomeFirst: "أهلاً بك! أنا نوفابوت لمساعدتك في أفكار ونصائح الذكاء الاصطناعي للأعمال.",
      welcomeReturning: "مرحباً مجدداً! كيف يمكنني دعمك في الذكاء الاصطناعي والأعمال اليوم؟",
      thanks_positive: "شكراً لك! سعيد أنني أفدتك. هل تحتاج مساعدة إضافية في الذكاء الاصطناعي للأعمال؟",
      negative_mood: "أفهمك. وضّح ما الذي تحتاجه في الذكاء الاصطناعي للأعمال وسأحاول تبسيطه.",
      genericMotivation: [
        "استمر، المعرفة قوة. شاركني هدفك لنقدم لك دعماً عملياً.",
        "خطوة صغيرة نحو هدفك كافية اليوم. ماذا تريد تحقيقه؟",
        "ذكاءك ومعرفتك هما قوتك. أخبرني بمشكلتك لنجد لها حلاً.",
        "طريق النجاح يبدأ بفكرة واضحة. ما التحدي الذي تعمل عليه؟",
        "بإمكانك الإنجاز اليوم. حدد خطوة واحدة وسأساعدك فيها.",
        "استغل وقتك الآن. أخبرني بشيء واحد ترغب في تطويره."
      ],
      novaLinkInfo: "نوفالينك منصة تهتم بالذكاء الاصطناعي للأعمال، نقدم موارد وروابط موثوقة للمساعدة العملية.",
      novaBotInfo: "أنا نوفابوت، مساعدك للذكاء الاصطناعي والأعمال، أقدم لك نصائح وروابط موثوقة.",
      subscribeCard: "للانضمام للنشرة، شاركني بريدك الإلكتروني لنرسل آخر تحديثات الذكاء الاصطناعي للأعمال.",
      consultingCard: "لخدمة استشارية مدفوعة أو بناء حلول ذكاء اصطناعي، أخبرني باحتياجك وسأتواصل بالخطوات التالية.",
      collaborationCard: "للتعاون أو الشراكة، شاركني تفاصيلك وروابطك لنراجع الفرصة مع فريق نوفالينك.",
      goodbye: "سعيد بالمساعدة! إذا احتجتني مستقبلاً أنا هنا."
    },
    en: {
      welcomeFirst: "Hi there! I’m NovaBot here to help with AI for business ideas and next steps.",
      welcomeReturning: "Welcome back! How can I support your AI-for-business goals today?",
      thanks_positive: "Thanks! Glad to help. Want another AI-for-business tip?",
      negative_mood: "Got it. Tell me what you need in AI for business and I’ll simplify it.",
      genericMotivation: [
        "Keep going—knowledge is power. Share your goal for practical guidance.",
        "One small step today is enough. What do you want to achieve?",
        "Your insight is your strength. Tell me the problem and we’ll solve it.",
        "Success starts with a clear idea. What challenge are you working on?",
        "You can make progress now. Name one step and I’ll help.",
        "Use this moment. Tell me one thing you’d like to improve."
      ],
      novaLinkInfo: "NovaLink is a hub for AI-for-business resources with trusted links and practical help.",
      novaBotInfo: "I’m NovaBot, your AI-for-business guide with tips and trusted sources.",
      subscribeCard: "Share your email to join updates on AI-for-business resources.",
      consultingCard: "For paid consulting or building AI solutions, tell me your need and I’ll outline next steps.",
      collaborationCard: "For partnerships or sponsorships, share your details and links so the NovaLink team can review.",
      goodbye: "Glad to help! I’m here anytime you need."
    }
  };
}

function getTextPackage(language) {
  const packs = loadTextPackages();
  return language === "en" ? packs.en : packs.ar;
}

function normalizeKnowledgeItem(item) {
  const title = typeof item?.title === "string" ? item.title : "";
  const url = typeof item?.url === "string" ? item.url : "";
  const summary = typeof item?.summary === "string" ? item.summary : "";
  const keywords = Array.isArray(item?.keywords)
    ? item.keywords.filter(Boolean).map(String)
    : typeof item?.keywords === "string"
      ? item.keywords.split(/[,;]+/).map(v => v.trim()).filter(Boolean)
      : [];
  return { title, url, summary, keywords };
}

async function loadKnowledge() {
  const now = Date.now();
  if (knowledgeCache && now - knowledgeLoadedAt < 5 * 60 * 1000) {
    return knowledgeCache;
  }
  const url = process.env.KNOWLEDGE_V5_URL;
  if (!url) {
    knowledgeCache = [];
    return knowledgeCache;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) {
      knowledgeCache = [];
      return knowledgeCache;
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      knowledgeCache = [];
      return knowledgeCache;
    }
    knowledgeCache = data.map(normalizeKnowledgeItem);
    knowledgeLoadedAt = now;
    return knowledgeCache;
  } catch (err) {
    knowledgeCache = [];
    return knowledgeCache;
  }
}

function scoreKnowledge(messageTokens, itemTokens) {
  const setMsg = new Set(messageTokens);
  const setItem = new Set(itemTokens);
  let intersection = 0;
  let union = new Set();
  messageTokens.forEach(t => union.add(t));
  itemTokens.forEach(t => union.add(t));
  setMsg.forEach(t => {
    if (setItem.has(t)) intersection += 1;
  });
  if (union.size === 0) return 0;
  return intersection / union.size;
}

function prepareItemTokens(item) {
  const tokens = [];
  tokens.push(...tokenize(item.title));
  tokens.push(...tokenize(item.summary));
  item.keywords.forEach(k => tokens.push(...tokenize(k)));
  return tokens;
}

async function matchKnowledge(message) {
  const knowledge = await loadKnowledge();
  if (!knowledge.length) return { matchType: "none", item: null, score: 0 };
  const messageTokens = tokenize(message).filter(t => !getStopwords().has(t));
  let bestScore = 0;
  let bestItem = null;
  for (const item of knowledge) {
    const itemTokens = prepareItemTokens(item).filter(t => !getStopwords().has(t));
    const s = scoreKnowledge(messageTokens, itemTokens);
    if (s > bestScore) {
      bestScore = s;
      bestItem = item;
    }
  }
  if (bestScore >= 0.65) return { matchType: "strong", item: bestItem, score: bestScore };
  if (bestScore >= 0.4) return { matchType: "medium", item: bestItem, score: bestScore };
  return { matchType: "none", item: null, score: bestScore };
}

function getRandomMotivation(pkg) {
  const list = pkg.genericMotivation;
  if (!Array.isArray(list) || !list.length) return "";
  const idx = Math.floor(Math.random() * list.length);
  return list[idx];
}

function buildKnowledgeReply(item, language) {
  const base = language === "en" ? "Here’s a helpful NovaLink resource:" : "إليك مورد موثوق من نوفالينك:";
  return `${base}\n${item.title}\n${item.summary}\n${item.url}`;
}

function buildKnowledgeActionCard(item) {
  return `${item.title} | ${item.url}`;
}

function summarizeHistory(sessionHistory) {
  if (!Array.isArray(sessionHistory) || !sessionHistory.length) return "";
  const recent = sessionHistory.slice(-4);
  return recent
    .map(entry => `${entry.role}: ${normalizeMessage(entry.content)}`)
    .filter(Boolean)
    .join(" | ");
}

function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (!key) return null;
  try {
    return new GoogleGenerativeAI(key);
  } catch (err) {
    return null;
  }
}

function getSafetySettings() {
  return [
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }
  ];
}

async function callGemini(request, prompt, maxTokens, modeHint) {
  if (!request.allowGemini) return { ok: false, text: null, maxTokens: null };
  const client = getGeminiClient();
  if (!client) return { ok: false, text: null, maxTokens: null };
  const models = ["gemini-2.0-flash", "gemini-2.0-pro", "gemini-1.0-pro"];
  const safetySettings = getSafetySettings();
  const messages = [];
  const context = summarizeHistory(request.sessionHistory);
  if (context) {
    messages.push({ role: "user", parts: [{ text: `Context: ${context}` }] });
  }
  messages.push({ role: "user", parts: [{ text: prompt }] });
  for (const modelName of models) {
    try {
      const model = client.getGenerativeModel({ model: modelName, safetySettings });
      const response = await model.generateContent({ contents: messages, generationConfig: { maxOutputTokens: maxTokens } });
      const text = typeof response?.response?.text === "function" ? response.response.text() : response?.response?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return { ok: true, text, maxTokens, mode: modeHint || "ai" };
    } catch (err) {
      continue;
    }
  }
  return { ok: false, text: null, maxTokens: null };
}

function formatReply(text) {
  return sanitizeText(text);
}

function computeStrikes(sessionHistory, intentId) {
  if (intentId !== "out_of_scope") return 0;
  if (!Array.isArray(sessionHistory) || !sessionHistory.length) return 0;
  const stopwords = getStopwords();
  let strikes = 0;
  for (let i = sessionHistory.length - 1; i >= 0 && strikes < 3; i -= 1) {
    const entry = sessionHistory[i];
    if (entry?.role !== "user") continue;
    const tokens = tokenize(entry.content || "").filter(t => !stopwords.has(t));
    const hasAI = tokens.some(t => ["ai","ذكاء","الذكاء","gpt","bot","أعمال","business","تسويق","marketing","startup","automatio","automation","روبوت"].some(k => t.includes(k)));
    if (hasAI) break;
    strikes += 1;
  }
  return strikes;
}

function buildDeveloperCard(language) {
  return language === "en"
    ? "NovaBot developer channel confirmed. How can we assist with the build or review?"
    : "تم التحقق من هوية مطور نوفابوت. كيف يمكننا دعمك في التطوير أو المراجعة؟";
}

function extractConceptsFromText(text) {
  const tokens = tokenize(text);
  const stop = getStopwords();
  const filtered = tokens.filter(t => !stop.has(t));
  const phrases = [];
  for (let i = 0; i < filtered.length; i += 1) {
    for (let len = 2; len <= 4; len += 1) {
      if (i + len <= filtered.length) {
        const phrase = filtered.slice(i, i + len).join(" ");
        phrases.push(phrase);
      }
    }
  }
  return Array.from(new Set(phrases)).slice(0, 10);
}

function buildStaticResponse(pkg, key) {
  return pkg[key] || "";
}

function isFixedIntent(intent) {
  return [
    "greeting",
    "goodbye",
    "thanks_positive",
    "negative_mood",
    "novalink_info",
    "novabot_info",
    "subscribe_interest",
    "consulting_purchase",
    "collaboration",
    "developer_identity"
  ].includes(intent);
}

function isFirstSessionMessage(sessionHistory) {
  return !Array.isArray(sessionHistory) || sessionHistory.length === 0;
}

function buildMicroPivotPrompt(language) {
  return language === "en"
    ? "Give a concise pivot back to AI-for-business topics and invite the user to share their AI/business need."
    : "قدّم توجيهاً مختصراً للعودة لموضوع الذكاء الاصطناعي للأعمال واطلب من المستخدم توضيح احتياجه في هذا المجال.";
}

function buildAIRequestPrompt(request, pkg, knowledgeItem, mode) {
  const intro = request.language === "en"
    ? "You are NovaBot, an AI-for-business coach. Use a helpful, concise tone."
    : "أنت نوفابوت، مساعد للذكاء الاصطناعي في الأعمال. استخدم أسلوباً ودوداً ومختصراً.";
  const dialect = request.dialectHint && request.language === "ar" ? `اللهجة المفضلة: ${request.dialectHint}.` : "";
  const knowledgeHint = knowledgeItem ? `موارد موثوقة: ${knowledgeItem.title} - ${knowledgeItem.url}` : "";
  const modeHint = mode === "medium" ? "Keep it within 100 tokens and point to the resource." : "";
  const message = normalizeMessage(request.message);
  return `${intro} ${dialect} ${knowledgeHint} ${modeHint}\nالمستخدم: ${message}`;
}

async function handleAIResponse(request, pkg, knowledgeMatch, mode) {
  const prompt = buildAIRequestPrompt(request, pkg, knowledgeMatch?.item || null, mode);
  const maxTokens = mode === "micro" ? 80 : mode === "medium" ? 100 : 200;
  const ai = await callGemini(request, prompt, maxTokens, "ai");
  if (!ai.ok || !ai.text) return { ok: false };
  const reply = formatReply(ai.text);
  const concepts = extractConceptsFromText(ai.text);
  return {
    ok: true,
    reply,
    actionCard: knowledgeMatch?.item ? buildKnowledgeActionCard(knowledgeMatch.item) : null,
    matchType: knowledgeMatch?.matchType || null,
    usedAI: true,
    maxTokens,
    mode: "ai",
    extractedConcepts: concepts
  };
}

async function novaBrainSystem(request) {
  const language = request?.language === "en" ? "en" : "ar";
  const pkg = getTextPackage(language);
  const message = normalizeMessage(request?.message);
  const sessionHistory = Array.isArray(request?.sessionHistory) ? request.sessionHistory : [];
  const isFirst = isFirstSessionMessage(sessionHistory);
  const baseResponse = {
    ok: true,
    reply: "",
    actionCard: null,
    matchType: null,
    usedAI: false,
    maxTokens: null,
    mode: "knowledge",
    extractedConcepts: []
  };
  if (!message) {
    const welcome = isFirst ? pkg.welcomeFirst : pkg.welcomeReturning;
    return { ...baseResponse, reply: formatReply(welcome), mode: "motivation" };
  }
  switch (request?.originalIntentId) {
    case "greeting":
      return { ...baseResponse, reply: formatReply(isFirst ? pkg.welcomeFirst : pkg.welcomeReturning), mode: "motivation" };
    case "goodbye":
      return { ...baseResponse, reply: formatReply(pkg.goodbye), mode: "motivation" };
    case "thanks_positive":
      return { ...baseResponse, reply: formatReply(pkg.thanks_positive), mode: "motivation" };
    case "negative_mood":
      return { ...baseResponse, reply: formatReply(pkg.negative_mood), mode: "motivation" };
    case "novalink_info":
      return { ...baseResponse, reply: formatReply(pkg.novaLinkInfo), actionCard: null, mode: "knowledge" };
    case "novabot_info":
      return { ...baseResponse, reply: formatReply(pkg.novaBotInfo), actionCard: null, mode: "knowledge" };
    case "subscribe_interest":
      return { ...baseResponse, reply: formatReply(pkg.subscribeCard), actionCard: pkg.subscribeCard, mode: "knowledge" };
    case "consulting_purchase":
      return { ...baseResponse, reply: formatReply(pkg.consultingCard), actionCard: pkg.consultingCard, mode: "knowledge" };
    case "collaboration":
      return { ...baseResponse, reply: formatReply(pkg.collaborationCard), actionCard: pkg.collaborationCard, mode: "knowledge" };
    case "developer_identity":
      return { ...baseResponse, reply: formatReply(buildDeveloperCard(language)), actionCard: null, mode: "knowledge" };
    default:
      break;
  }
  let knowledgeMatch = { matchType: "none", item: null };
  let knowledgeAvailable = true;
  try {
    knowledgeMatch = await matchKnowledge(message);
  } catch (err) {
    knowledgeAvailable = false;
    knowledgeMatch = { matchType: "none", item: null };
  }
  if (request?.intentId === "ai_business") {
    if (isFirst && request.allowGemini && !isFixedIntent(request.originalIntentId)) {
      const ai = await handleAIResponse(request, pkg, knowledgeMatch, "micro");
      if (ai.ok) return ai;
    }
    if (knowledgeMatch.matchType === "strong" && knowledgeMatch.item) {
      const reply = formatReply(buildKnowledgeReply(knowledgeMatch.item, language));
      return { ...baseResponse, reply, actionCard: buildKnowledgeActionCard(knowledgeMatch.item), matchType: "strong", usedAI: false, mode: "knowledge" };
    }
    if (knowledgeMatch.matchType === "medium" && knowledgeMatch.item) {
      const ai = await handleAIResponse(request, pkg, knowledgeMatch, "medium");
      if (ai.ok) return ai;
      const reply = formatReply(buildKnowledgeReply(knowledgeMatch.item, language));
      return { ...baseResponse, reply, actionCard: buildKnowledgeActionCard(knowledgeMatch.item), matchType: "medium", usedAI: false, mode: "knowledge" };
    }
    const ai = await handleAIResponse(request, pkg, knowledgeMatch, "full");
    if (ai.ok) return ai;
    if (knowledgeMatch.matchType !== "none" && knowledgeMatch.item) {
      const reply = formatReply(buildKnowledgeReply(knowledgeMatch.item, language));
      return { ...baseResponse, reply, actionCard: buildKnowledgeActionCard(knowledgeMatch.item), matchType: knowledgeMatch.matchType, usedAI: false, mode: "knowledge" };
    }
    const fallback = getRandomMotivation(pkg) || pkg.welcomeFirst;
    return { ...baseResponse, reply: formatReply(fallback), mode: "motivation" };
  }
  if (request?.intentId === "out_of_scope") {
    const strikes = computeStrikes(sessionHistory, request.intentId);
    if (strikes >= 2) {
      const reply = formatReply(getRandomMotivation(pkg));
      return { ...baseResponse, reply, matchType: "none", usedAI: false, mode: "motivation" };
    }
    if (request.allowGemini) {
      const ai = await handleAIResponse(request, pkg, knowledgeMatch, "micro");
      if (ai.ok) return ai;
    }
    if (knowledgeMatch.matchType !== "none" && knowledgeMatch.item) {
      const reply = formatReply(buildKnowledgeReply(knowledgeMatch.item, language));
      return { ...baseResponse, reply, actionCard: buildKnowledgeActionCard(knowledgeMatch.item), matchType: knowledgeMatch.matchType, usedAI: false, mode: "knowledge" };
    }
    const reply = formatReply(getRandomMotivation(pkg));
    return { ...baseResponse, reply, usedAI: false, mode: "motivation" };
  }
  const fallbackReply = request.allowGemini ? null : getRandomMotivation(pkg);
  if (request.allowGemini) {
    const ai = await handleAIResponse(request, pkg, knowledgeMatch, isFirst ? "micro" : "full");
    if (ai.ok) return ai;
  }
  if (knowledgeAvailable && knowledgeMatch.matchType !== "none" && knowledgeMatch.item) {
    const reply = formatReply(buildKnowledgeReply(knowledgeMatch.item, language));
    return { ...baseResponse, reply, actionCard: buildKnowledgeActionCard(knowledgeMatch.item), matchType: knowledgeMatch.matchType, usedAI: false, mode: "knowledge" };
  }
  if (fallbackReply) {
    return { ...baseResponse, reply: formatReply(fallbackReply), usedAI: false, mode: "motivation" };
  }
  return { ...baseResponse, reply: formatReply("NovaBot is currently updating, but you can explore NovaLink articles meanwhile."), usedAI: false, mode: "fallback" };
}

export { novaBrainSystem };
export default novaBrainSystem;
