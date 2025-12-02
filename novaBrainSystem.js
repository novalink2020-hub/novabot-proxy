import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

let knowledgeCache = null;
let knowledgeLoadedAt = 0;

function sanitizeText(text) {
  const value = typeof text === "string" ? text : "";
  return value.replace(/\r?\n/g, "<br>");
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
    "و","في","على","من","إلى","الى","عن","أن","إن","ما","لا","نعم","هذا","هذه","هو","هي","هم","هن","انت","أنت","أنا","لقد","كان","كانت","ذلك","هناك","هنا","كما","قد","أو","بل","ثم","لكن","مع","كل","أي","اي","أية","اين","أين","كيف","لماذا","ماذا","منذ","حتى","كانوا"
  ]);
}

function loadTextPackages() {
  return {
    ar: {
      welcomeFirst:
        "👋 أهلاً بك في نوفا لينك، مساحة صُمِّمت لترافقك في رحلتك مع الذكاء الاصطناعي خطوة بخطوة.<br>يمكنك أن تسأل، تستكشف، أو تبدأ من مقال يلهمك… القرار لك، وأنا هنا لأساعدك.",

      welcomeReturning:
        "👋 سعيد برؤيتك مجددًا في نوفا لينك.<br>هل ترغب أن أساعدك اليوم في اكتشاف مقال جديد، أداة عملية، أو فكرة تلهمك للخطوة التالية؟",

      thanks_positive: [
        "🎉 أشكرك على كلماتك اللطيفة، يسعدني أن يكون نوفا بوت جزءًا من رحلتك.<br>استمر في طرح أسئلتك، فكل سؤال جديد هو خطوة أخرى نحو وضوح أكبر.",
        "🙏 سعادتك بما تقدّمه نوفا لينك تعني الكثير.<br>إذا كان هناك موضوع معيّن ترغب أن نتعمق فيه أكثر، فأنا هنا لأساعدك في استكشافه."
      ],

      negative_mood: [
        "🤝 أقدّر صراحتك، ويبدو أن الإجابة لم تكن بالمستوى الذي تستحقه.<br>جرّب أن توضّح ما الذي تبحث عنه أكثر، وسأحاول أن أقدّم زاوية مختلفة تساعدك بشكل أفضل.",
        "💬 من حقك أن تحصل على إجابة مفيدة، وإذا شعرت أن الرد لم يكن كافيًا فهذا تنبيه جميل لنطوّر المحتوى أكثر.<br>أخبرني ما الذي لم تجده، لنبحث عنه معًا بخطوة أهدأ وأكثر دقة."
      ],

      genericMotivation: [
        "👋 أهلاً بك في نوفا لينك، حيث نؤمن أن الذكاء الاصطناعي ليس تقنية فقط، بل رحلة لاكتشاف قدراتك من جديد.<br>ابدأ بخطوة بسيطة… وتذكّر أن كل فكرة صغيرة قد تصنع تحولًا كبيرًا.<br><br><a href=\"https://novalink-ai.com/ashtrk-alan\" target=\"_blank\" class=\"nova-link\">ابدأ رحلتك هنا</a>",
        "🌟 ربما تبحث عن بداية جديدة أو إلهام يعيد شغفك.<br>أنصحك بقراءة قصتي في \"رحلة فردية في عالم الذكاء الاصطناعي\"، فهي تذكير بأن الشغف أقوى من التخصص.<br><br><a href=\"https://novalink-ai.com/rhlh-frdyh-fy-aalm-althkaa-alastnaay-hktha-bdat-nwfa-lynk\" target=\"_blank\" class=\"nova-link\">اقرأ المقال كاملاً</a>",
        "🤖 لا تحتاج أن تكون خبيرًا لتبدأ مع الذكاء الاصطناعي، كل ما تحتاجه هو فضول صغير وخطوة جريئة.<br>نوفا لينك صُممت لتكون دليلك العملي خطوة بخطوة نحو استخدام الأدوات الذكية في حياتك وأعمالك.<br><br><a href=\"https://novalink-ai.com/blog-adwat-althkaa-alastnaay-llaamal\" target=\"_blank\" class=\"nova-link\">اكتشف التفاصيل</a>",
        "✨ أحيانًا لا تحتاج إلى إجابة، بل إلى تذكير بسيط بأنك على الطريق الصحيح.<br>استمر… وتذكّر أن الذكاء الاصطناعي ليس بديلًا لك، بل امتداد لقدرتك على الإنجاز.<br><br><a href=\"https://novalink-ai.com/about-us-althkaa-alastnaay\" target=\"_blank\" class=\"nova-link\">تعرّف على نوفا لينك</a>",
        "🚀 الذكاء الاصطناعي لا ينتظر أحدًا… لكنه دائمًا يفتح الباب لمن يطرق بثقة.<br>اكتشف كيف يمكن لأدوات بسيطة أن تختصر وقتك وتضاعف نتائجك.<br><br><a href=\"https://novalink-ai.com/blog-adwat-althkaa-alastnaay-llaamal\" target=\"_blank\" class=\"nova-link\">اقرأ المقال كاملاً</a>",
        "🌙 قبل أن تغادر… تذكّر أن كل إنجاز يبدأ بسؤال بسيط ورغبة في التعلّم.<br>اسمح لنفسك أن تتقدّم خطوة كل يوم — فالعالم لا ينتظر، لكنه يكافئ من يواصل المسير بثبات وثقة.<br><br><a href=\"https://novalink-ai.com/althkaa-alastnaay-yuayd-tshkyl-almstqbl-hl-wzyftk-fy-aman\" target=\"_blank\" class=\"nova-link\">ابدأ رحلتك هنا</a>"
      ],

      novaLinkInfo:
        "🟠 <strong>من نحن</strong><br>👋 أهلاً بك في نوفا لينك، مساحة عربية تؤمن أن الذكاء الاصطناعي لم يُخلق ليبدلك، بل ليحرّرك من المكرّر لتُبدع فيما يليق بعقلك.<br><br>نحن نساعدك على تحويل الأدوات الذكية إلى نتائج حقيقية — في مشروعك، عملك، وحتى أفكارك.<br><br><a href=\"https://novalink-ai.com/about-us-althkaa-alastnaay\" target=\"_blank\" class=\"nova-link\">تعرّف على نوفا لينك</a>",

      novaStory:
        "🔵 <strong>رحلة نوفا لينك</strong><br>🌟 بدأت نوفا لينك كفكرة بسيطة أثناء رحلة شخصية لاكتشاف الذكاء الاصطناعي، ثم تحوّلت إلى مشروع حيّ يفتح الطريق لكل من يريد أن يتعلّم ويطبّق لا أن يكتفي بالمشاهدة.<br><br>إنها قصة شغف وجرأة… بدأت من فضول فردي، وتحولت إلى مجتمع من صانعي المستقبل.<br><br><a href=\"https://novalink-ai.com/rhlh-frdyh-fy-aalm-althkaa-alastnaay-hktha-bdat-nwfa-lynk\" target=\"_blank\" class=\"nova-link\">اقرأ المقال كاملاً</a>",

      novaMission:
        "🟠 <strong>هدف نوفا لينك</strong><br>🚀 رؤيتنا في نوفا لينك بسيطة لكنها عميقة: أن يصبح الذكاء الاصطناعي أداة لكل إنسان، لا امتيازًا للنخبة التقنية.<br><br>نكتب، نجرّب، ونشاركك الأدوات التي تصنع فارقًا فعليًا في الإنتاجية وريادة الأعمال.<br><br>✨ هدفنا أن تكون أنت التغيير القادم، خطوة بخطوة، بثقة ومعرفة.<br><br><a href=\"https://novalink-ai.com/blog-adwat-althkaa-alastnaay-llaamal\" target=\"_blank\" class=\"nova-link\">ابدأ رحلتك هنا</a>",

      subscriptionPrompt:
        "📩 يسعدني أنك وجدت الفائدة من نوفا لينك.<br>إذا أحببت، اترك بريدك الإلكتروني لتصلك أحدث المقالات والتحديثات حول الذكاء الاصطناعي وتطوير الأعمال:",

      goodbye:
        "سعيد بهذه الجولة من الحوار معك 🌱 أتمنّى أن تكون فكرة واحدة على الأقل قد فتحت لك زاوية جديدة للتفكير أو العمل.<br><br>نوفا بوت سيبقى هنا عندما تعود… ومع كل زيارة، يمكن أن نضيف طبقة جديدة لمسارك مع الذكاء الاصطناعي والأعمال."
    },

    en: {
      welcomeFirst:
        "Hi there! Welcome to NovaLink — your space to explore AI for business, step by step.",

      welcomeReturning:
        "Welcome back to NovaLink! Ready to discover a new article, a practical tool, or an idea for your next step?",

      thanks_positive: [
        "Thanks for the kind words! Glad NovaBot is part of your journey.",
        "Your appreciation means a lot. If you want us to go deeper into a topic, I’m here to help."
      ],

      negative_mood: [
        "I appreciate the honesty — it seems the answer wasn’t what you deserved. Tell me more so I can help better.",
        "You deserve a clear, useful answer. Tell me what was missing, and we’ll fix it together."
      ],

      genericMotivation: [
        "NovaLink believes AI isn’t just technology — it’s a journey to rediscover your capabilities.<br><br><a href=\"https://novalink-ai.com/ashtrk-alan\" target=\"_blank\" class=\"nova-link\">Begin Your Journey</a>",
        "Maybe you're seeking fresh inspiration. Reading the personal AI journey behind NovaLink might help you reconnect with your own story.<br><br><a href=\"https://novalink-ai.com/rhlh-frdyh-fy-aalm-althkaa-alastnaay-hktha-bdat-nwfa-lynk\" target=\"_blank\" class=\"nova-link\">Read Full Article</a>",
        "You don't need to be an expert to begin — just curiosity and one small, intentional step.<br><br><a href=\"https://novalink-ai.com/blog-adwat-althkaa-alastnaay-llaamal\" target=\"_blank\" class=\"nova-link\">Explore Details</a>",
        "Sometimes all you need is a reminder that you're still on the right track — even if the path feels unclear.<br><br><a href=\"https://novalink-ai.com/about-us-althkaa-alastnaay\" target=\"_blank\" class=\"nova-link\">Discover NovaLink</a>",
        "AI rewards those who move with courage and clarity. Simple tools can save hours and open new doors.<br><br><a href=\"https://novalink-ai.com/blog-adwat-althkaa-alastnaay-llaamal\" target=\"_blank\" class=\"nova-link\">Read Full Article</a>",
        "Before you disconnect… remember that every meaningful change starts with a small question and a willingness to learn.<br><br><a href=\"https://novalink-ai.com/althkaa-alastnaay-yuayd-tshkyl-almstqbl-hl-wzyftk-fy-aman\" target=\"_blank\" class=\"nova-link\">Begin Your Journey</a>"
      ],

      novaLinkInfo:
        "NovaLink is an Arabic platform focused on turning AI tools into practical results in your projects, work, and ideas.<br><br><a href=\"https://novalink-ai.com/about-us-althkaa-alastnaay\" target=\"_blank\" class=\"nova-link\">Discover NovaLink</a>",

      novaStory:
        "NovaLink started as a personal journey to explore AI, then grew into a living project that opens the door for anyone who wants to learn and apply — not just watch from a distance.<br><br><a href=\"https://novalink-ai.com/rhlh-frdyh-fy-aalm-althkaa-alastnaay-hktha-bdat-nwfa-lynk\" target=\"_blank\" class=\"nova-link\">Read Full Article</a>",

      novaMission:
        "Our mission at NovaLink is simple but deep: make AI an accessible tool for every person, not just technical elites. We write, experiment, and share the tools that create real impact in productivity and entrepreneurship.<br><br><a href=\"https://novalink-ai.com/blog-adwat-althkaa-alastnaay-llaamal\" target=\"_blank\" class=\"nova-link\">Explore Details</a>",

      subscriptionPrompt:
        "Glad you found value in NovaLink. Share your email to receive practical AI updates and business-focused insights:",

      goodbye:
        "I’m glad we had this conversation 🌱<br>I hope at least one idea opened a new angle for your work or thinking.<br><br>NovaBot will be here when you return — and with each visit, we can add a fresh layer to your AI-for-business journey."
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
  const union = new Set();
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
  const stop = getStopwords();
  const messageTokens = tokenize(message).filter(t => !stop.has(t));
  let bestScore = 0;
  let bestItem = null;
  for (const item of knowledge) {
    const itemTokens = prepareItemTokens(item).filter(t => !stop.has(t));
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
  if (!item) return "";
  if (language === "en") {
    return (
      "💬 Your question seems related to a topic we covered in NovaLink under the title:<br>" +
      "“" + item.title + "”.<br>" +
      (item.summary ? item.summary + "<br><br>" : "<br>") +
      "<a href=\"" + item.url + "\" target=\"_blank\" class=\"nova-link\">Read Full Article</a>"
    );
  }
  return (
    "💬 يبدو أن سؤالك يلامس موضوعًا تناولناه في نوفا لينك بعنوان:<br>" +
    "“" + item.title + "”.<br>" +
    (item.summary ? item.summary + "<br><br>" : "<br>") +
    "<a href=\"" + item.url + "\" target=\"_blank\" class=\"nova-link\">اقرأ المقال كاملاً</a>"
  );
}

function buildKnowledgeActionCard(item) {
  return item ? item.title + " | " + item.url : null;
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
  const key =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY;
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
      const response = await model.generateContent({
        contents: messages,
        generationConfig: { maxOutputTokens: maxTokens }
      });
      const text =
        typeof response?.response?.text === "function"
          ? response.response.text()
          : response?.response?.candidates?.[0]?.content?.parts?.[0]?.text;
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
    const hasAI = tokens.some(t =>
      ["ai","ذكاء","الذكاء","gpt","bot","أعمال","business","تسويق","marketing","startup","automatio","automation","روبوت"].some(k => t.includes(k))
    );
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

function pickRandomOrString(value) {
  if (Array.isArray(value) && value.length) {
    const idx = Math.floor(Math.random() * value.length);
    return value[idx];
  }
  if (typeof value === "string") return value;
  return "";
}

function buildAIRequestPrompt(request, pkg, knowledgeItem, mode) {
  const intro =
    request.language === "en"
      ? "You are NovaBot, an AI-for-business coach. Use a helpful, calm, and concise tone."
      : "أنت نوفابوت، مساعد للذكاء الاصطناعي في الأعمال. استخدم أسلوباً هادئاً، مشجعاً، ومختصراً.";
  const dialect =
    request.dialectHint && request.language === "ar"
      ? `اللهجة المفضلة: ${request.dialectHint}.`
      : "";
  const knowledgeHint = knowledgeItem
    ? `موارد موثوقة من نوفا لينك: ${knowledgeItem.title} - ${knowledgeItem.url}`
    : "";
  const modeHint =
    mode === "medium"
      ? "Keep it within about 100 tokens and gently point the user to the linked resource."
      : "";
  const message = normalizeMessage(request.message);
  if (request.language === "en") {
    return `${intro} ${knowledgeHint} ${modeHint}\nUser message: ${message}`;
  }
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
      return {
        ...baseResponse,
        reply: formatReply(isFirst ? pkg.welcomeFirst : pkg.welcomeReturning),
        mode: "motivation"
      };
    case "goodbye":
      return {
        ...baseResponse,
        reply: formatReply(pkg.goodbye),
        mode: "motivation"
      };
    case "thanks_positive":
      return {
        ...baseResponse,
        reply: formatReply(pickRandomOrString(pkg.thanks_positive)),
        mode: "motivation"
      };
    case "negative_mood":
      return {
        ...baseResponse,
        reply: formatReply(pickRandomOrString(pkg.negative_mood)),
        mode: "motivation"
      };
    case "novalink_info":
      return {
        ...baseResponse,
        reply: formatReply(pkg.novaLinkInfo),
        actionCard: null,
        mode: "knowledge"
      };
    case "novabot_info":
      return {
        ...baseResponse,
        reply: formatReply(
          language === "en"
            ? "I’m NovaBot, the official AI assistant of NovaLink. I help you connect AI tools with real-world business use-cases in a calm, practical way."
            : "أنا نوفابوت، المساعد الذكي الرسمي لمنصة نوفا لينك. أساعدك على توصيل أدوات الذكاء الاصطناعي بتطبيقات عملية في مشروعك أو عملك بأسلوب هادئ وواضح."
        ),
        actionCard: null,
        mode: "knowledge"
      };
    case "subscribe_interest":
      return {
        ...baseResponse,
        reply: formatReply(pkg.subscriptionPrompt),
        actionCard: pkg.subscriptionPrompt,
        mode: "knowledge"
      };
    case "consulting_purchase":
      return {
        ...baseResponse,
        reply: formatReply(
          language === "en"
            ? "For paid consulting or building custom AI workflows and chatbots, share a brief about your project (industry, goal, and current tools), and we’ll outline the next practical steps for you."
            : "للاستشارات المدفوعة أو بناء حلول مخصّصة مثل بوتات الذكاء الاصطناعي وتدفقات العمل الذكية، شاركني نبذة عن مشروعك (المجال، الهدف، والأدوات الحالية)، وسأقترح لك الخطوات العملية التالية."
        ),
        actionCard: null,
        mode: "knowledge"
      };
    case "collaboration":
      return {
        ...baseResponse,
        reply: formatReply(
          language === "en"
            ? "For partnerships, sponsorships, or content collaborations with NovaLink, please share your idea, links, and what you’d like to achieve so the team can review it properly."
            : "للتعاون، الرعايات، أو الشراكات في المحتوى مع نوفا لينك، شاركني فكرتك وروابطك وما تطمح لتحقيقه، ليتمكن فريق نوفا لينك من مراجعتها بشكل مهني."
        ),
        actionCard: null,
        mode: "knowledge"
      };
    case "developer_identity":
      return {
        ...baseResponse,
        reply: formatReply(buildDeveloperCard(language)),
        actionCard: null,
        mode: "knowledge"
      };
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
      return {
        ...baseResponse,
        reply,
        actionCard: buildKnowledgeActionCard(knowledgeMatch.item),
        matchType: "strong",
        usedAI: false,
        mode: "knowledge"
      };
    }

    if (knowledgeMatch.matchType === "medium" && knowledgeMatch.item) {
      const ai = await handleAIResponse(request, pkg, knowledgeMatch, "medium");
      if (ai.ok) return ai;
      const reply = formatReply(buildKnowledgeReply(knowledgeMatch.item, language));
      return {
        ...baseResponse,
        reply,
        actionCard: buildKnowledgeActionCard(knowledgeMatch.item),
        matchType: "medium",
        usedAI: false,
        mode: "knowledge"
      };
    }

    const ai = await handleAIResponse(request, pkg, knowledgeMatch, "full");
    if (ai.ok) return ai;

    if (knowledgeMatch.matchType !== "none" && knowledgeMatch.item) {
      const reply = formatReply(buildKnowledgeReply(knowledgeMatch.item, language));
      return {
        ...baseResponse,
        reply,
        actionCard: buildKnowledgeActionCard(knowledgeMatch.item),
        matchType: knowledgeMatch.matchType,
        usedAI: false,
        mode: "knowledge"
      };
    }

    const fallback = getRandomMotivation(pkg) || pkg.welcomeFirst;
    return { ...baseResponse, reply: formatReply(fallback), mode: "motivation" };
  }

  if (request?.intentId === "out_of_scope") {
    const strikes = computeStrikes(sessionHistory, request.intentId);
    if (strikes >= 2) {
      const reply = formatReply(getRandomMotivation(pkg));
      return {
        ...baseResponse,
        reply,
        matchType: "none",
        usedAI: false,
        mode: "motivation"
      };
    }

    if (request.allowGemini) {
      const ai = await handleAIResponse(request, pkg, knowledgeMatch, "micro");
      if (ai.ok) return ai;
    }

    if (knowledgeMatch.matchType !== "none" && knowledgeMatch.item) {
      const reply = formatReply(buildKnowledgeReply(knowledgeMatch.item, language));
      return {
        ...baseResponse,
        reply,
        actionCard: buildKnowledgeActionCard(knowledgeMatch.item),
        matchType: knowledgeMatch.matchType,
        usedAI: false,
        mode: "knowledge"
      };
    }

    const reply = formatReply(getRandomMotivation(pkg));
    return {
      ...baseResponse,
      reply,
      usedAI: false,
      mode: "motivation"
    };
  }

  const fallbackReply = request.allowGemini ? null : getRandomMotivation(pkg);

  if (request.allowGemini) {
    const ai = await handleAIResponse(
      request,
      pkg,
      knowledgeMatch,
      isFirst ? "micro" : "full"
    );
    if (ai.ok) return ai;
  }

  if (knowledgeAvailable && knowledgeMatch.matchType !== "none" && knowledgeMatch.item) {
    const reply = formatReply(buildKnowledgeReply(knowledgeMatch.item, language));
    return {
      ...baseResponse,
      reply,
      actionCard: buildKnowledgeActionCard(knowledgeMatch.item),
      matchType: knowledgeMatch.matchType,
      usedAI: false,
      mode: "knowledge"
    };
  }

  if (fallbackReply) {
    return {
      ...baseResponse,
      reply: formatReply(fallbackReply),
      usedAI: false,
      mode: "motivation"
    };
  }

  return {
    ...baseResponse,
    reply: formatReply(
      language === "en"
        ? "NovaBot is currently updating, but you can explore NovaLink articles meanwhile."
        : "نوفا بوت يقوم ببعض التحديثات في الخلفية الآن، لكن يمكنك في هذه الأثناء استكشاف مقالات نوفا لينك واختيار ما يلهمك للخطوة التالية."
    ),
    usedAI: false,
    mode: "fallback"
  };
}

export { novaBrainSystem };
export default novaBrainSystem;
