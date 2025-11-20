/* 
  NovaBrainSystem v1.0
  الذكاء الأساسي لنوفا بوت
  — لغة، لهجة، نوايا، نبرة رد، وبطاقات —
*/

export async function novaBrainSystem(input) {
  const {
    intentId,
    toneHint,
    language,
    dialectHint,
    suggestedCard
  } = input;

  let reply = "";
  let actionCard = null;

  // ===============================
  // 🧠 1) تحديد اللغة الأساسية
  // ===============================
  const isArabic = language === "ar";
  const isEnglish = language === "en";

  function T(ar, en) {
    return isArabic ? ar : en;
  }

  // ===============================
  // 🎨 2) نبرة شخصية نوفا بوت
  // ===============================
  const tone = {
    friendly: T(
      "بأسلوب لطيف لكن واضح…",
      "Friendly yet clear…"
    ),
    motivational: T(
      "دعنا نرتّب الفكرة معًا بصورة أبسط.",
      "Let's break this down clearly."
    ),
    expert: T(
      "سأقدّم لك إجابة احترافية ومباشرة:",
      "Here’s a precise, expert explanation:"
    ),
  };

  // ===============================
  // 🔥 3) نكهات لهجات بسيطة
  // (عربية فصحى + لمسة لهجة خفيفة)
  // ===============================
  function withDialect(text) {
    if (!dialectHint) return text;

    if (dialectHint === "levant") {
      return text.replace("سأساعدك", "رح أساعدك").replace("جاهز", "جاهز").replace("أظن", "أعتقد");
    }
    if (dialectHint === "gulf") {
      return text.replace("سأساعدك", "بعون الله أساعدك").replace("جاهز", "جاهز يا صديقي");
    }
    if (dialectHint === "egypt") {
      return text.replace("سأساعدك", "هساعدك").replace("جاهز", "جاهز").replace("جداً", "أوي");
    }

    return text;
  }

  // ===============================
  // 🎯 4) الردود حسب النوايا الثمانية
  // ===============================
  switch (intentId) {

    // --------------------------------------
    case "explore":
      reply = T(
        `${tone.friendly} يبدو أنك تريد الاستكشاف بشكل عام. اسألني عن الأدوات، الأفكار، تحسين إنتاجيتك… أي زاوية في الذكاء الاصطناعي حابب تفتحها، أنا موجود.`,
        `${tone.friendly} It seems you're exploring. Feel free to ask about tools, ideas, productivity, or anything AI-related.`
      );
      break;

    // --------------------------------------
    case "learn":
      reply = T(
        `${tone.expert} دعني أقدّم لك شرحًا بسيطًا وواضحًا. حدّد لي النقطة التي تريد فهمها… وسأرتّبها لك خطوة بخطوة.`,
        `${tone.expert} Tell me what you'd like to understand, and I'll walk you through it clearly.`
      );
      break;

    // --------------------------------------
    case "improve_business":
      reply = T(
        `${tone.motivational} تطوير الأعمال بالذكاء الاصطناعي أصبح أسهل من أي وقت. احكي لي عن نوع مشروعك، وأنا أقدّم لك خطوات واقعية قابلة للتطبيق.`,
        `${tone.motivational} Improving your business with AI is absolutely doable. Tell me what kind of project you have, and I'll give you real, practical steps.`
      );
      actionCard = "business_subscribe";
      break;

    // --------------------------------------
    case "buy_service":
      reply = T(
        `${tone.expert} تمام… يبدو أنك مهتم بخدمة جاهزة أو حل فعلي. اخبرني بنوع الخدمة اللي تفكر فيها (بوت دردشة – تطوير محتوى – تحسين عمليات – أتمتة)… وأنا أرتّب لك خيارات مناسبة.`,
        `${tone.expert} Great — sounds like you're looking for a real service or solution. Tell me what you're thinking of (chatbot, automation, content, optimization) and I'll guide you.`
      );
      actionCard = "bot_lead";
      break;

    // --------------------------------------
    case "tools_discounts":
      reply = T(
        `${tone.friendly} إذا كنت تبحث عن أفضل أدوات الذكاء الاصطناعي أو خصومات حقيقية… فأنا جاهز أوجّهك لأفضل الخيارات حسب استخدامك.`,
        `${tone.friendly} Looking for AI tools or real discounts? I can direct you to the best choices based on your use-case.`
      );
      break;

    // --------------------------------------
    case "collaboration":
      reply = T(
        `${tone.expert} جميل! التعاونات المهنية جزء كبير من رؤية نوفا لينك. احكي لي نوع الشراكة اللي تفكر فيها… وأنا أقدّم لك تصورًا أوليًا.`,
        `${tone.expert} Great! Professional collaborations are part of NovaLink’s vision. Tell me what kind of partnership you’re thinking about.`
      );
      actionCard = "collaboration";
      break;

    // --------------------------------------
    case "subscribe":
      reply = T(
        `${tone.friendly} إذا كنت مهتمًا بمتابعة أفكار الذكاء الاصطناعي وتطوير الأعمال… فالاشتراك سيسهّل عليك الوصول لأفضل المحتوى بدون بحث.`,
        `${tone.friendly} If you'd like to keep up with AI insights and business tips, subscribing will make it effortless.`
      );
      actionCard = "subscribe";
      break;

    // --------------------------------------
    case "casual":
      reply = T(
        `أهلاً بك! 😊 كيف أقدر أساعدك اليوم؟`,
        `Hello! 😊 How can I help you today?`
      );
      break;

    // --------------------------------------
    default:
      reply = T(
        `واضح إنّ عندك فكرة أو سؤال… فقط أعطني سطر واحد، وأنا أبدأ معك.`,
        `Seems like you have something in mind — tell me in one line and I'll take it from there.`
      );
  }

  // === تطبيق نكهة اللهجة إن وجدت ===
  reply = withDialect(reply);

  return {
    reply,
    actionCard
  };
}
