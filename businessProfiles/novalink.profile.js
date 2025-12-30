/**************************************************************
 * NovaLink Business Profile (NovaBot)
 * File: /businessProfiles/novalink.profile.js
 *
 * Purpose:
 * - فصل منطق البيع/الاهتمامات/تطبيع النوايا خارج السيرفر
 * - جاهز للتوسع Multi-tenant لاحقًا
 **************************************************************/

export const NovaLinkBusinessProfile = {
  meta: {
    business_id: "novalink",
    name: "NovaLink AI",
    default_language: "ar",
    version: "bp_v1"
  },

  /**
   * أعمدة الداشبورد (Core Interests)
   */
  interests: {
    knowledge_subscription: {
      label: "اشتراك معرفي",
      description: "التعلم عن الذكاء الاصطناعي وتطبيقاته في الأعمال",
      primary_card: "subscribe",
      priority: 1
    },

    ai_service: {
      label: "خدمة ذكاء اصطناعي",
      description: "طلب نوفا بوت أو حلول ذكية للأعمال",
      primary_card: "bot_lead",
      priority: 2
    },

    business_subscription: {
      label: "اشتراك أعمال",
      description: "خدمات ومحتوى مخصص لرواد الأعمال",
      primary_card: "business_subscribe",
      priority: 3
    },

    partnership: {
      label: "تعاون وشراكة",
      description: "شراكات استراتيجية ومحتوى مشترك",
      primary_card: "collaboration",
      priority: 4
    }
  },

  /**
   * UI Actions (Cards) + حقول الاتصال المطلوبة
   */
  ui_actions: {
    subscribe: { required: ["email"], optional: ["name"] },
    bot_lead: { required: ["email_or_phone"], optional: ["name", "company"] },
    business_subscribe: { required: ["email"], optional: ["name", "company", "role"] },
    collaboration: { required: ["email_or_phone"], optional: ["name", "company"] }
  },

  /**
   * IntentId → Sales Fields
   * لازم تطابق novaIntentDetector.js حرفيًا
   */
  intent_sales_map: {
    // detector: greeting
    greeting: {
      intent: "ترحيب",
      interest: "knowledge_subscription",
      stage: "اهتمام",
      temperature: "بارد",
      suggested_card: null
    },

    // detector: ai_business
    ai_business: {
      intent: "اهتمام_ذكاء_اصطناعي_للأعمال",
      interest: "business_subscription",
      stage: "بحث",
      temperature: "دافئ",
      suggested_card: null
    },

    // detector: subscribe_interest
    subscribe_interest: {
      intent: "اهتمام_بالاشتراك",
      interest: "knowledge_subscription",
      stage: "اهتمام",
      temperature: "دافئ",
      suggested_card: "subscribe"
    },

    // detector: consulting_purchase
    consulting_purchase: {
      intent: "طلب_استشارة",
      interest: "ai_service",
      stage: "قرار",
      temperature: "ساخن",
      suggested_card: "bot_lead"
    },

    // detector: collaboration
    collaboration: {
      intent: "تعاون_وشراكة",
      interest: "partnership",
      stage: "استكشاف",
      temperature: "دافئ",
      suggested_card: "collaboration"
    },

    // detector: novalink_info
    novalink_info: {
      intent: "تعريف_نوفا_لينك",
      interest: "knowledge_subscription",
      stage: "اهتمام",
      temperature: "دافئ",
      suggested_card: null
    },

    // detector: thanks_positive
    thanks_positive: {
      intent: "ايجابية",
      interest: "knowledge_subscription",
      stage: "اهتمام",
      temperature: "دافئ",
      suggested_card: "subscribe"
    },

    // detector: negative_mood
    negative_mood: {
      intent: "مزاج_سلبي",
      interest: "knowledge_subscription",
      stage: "غير_واضح",
      temperature: "بارد",
      suggested_card: null
    },

    // detector: out_of_scope
    out_of_scope: {
      intent: "خارج_النطاق",
      interest: null,
      stage: "غير_مهتم",
      temperature: "بارد",
      suggested_card: null
    },

    // detector: casual (عند رسالة فاضية/غير واضحة)
    casual: {
      intent: "عابر",
      interest: "knowledge_subscription",
      stage: "غير_واضح",
      temperature: "بارد",
      suggested_card: null
    }
  },

  defaults: {
    intent: "غير_محدد",
    interest: "knowledge_subscription",
    stage: "غير_واضح",
    temperature: "بارد",
    suggested_card: null
  }
};

/**
 * Helper: يطبع Sales Fields من analysis.intentId
 */
export function normalizeIntentForSales(profile, analysis) {
  const intentId = analysis?.intentId || analysis?.intent || null;
  const map = profile?.intent_sales_map || {};
  const fallback = profile?.defaults || {};

  const row = intentId && map[intentId] ? map[intentId] : null;

  return {
    business_id: profile?.meta?.business_id || null,
    raw_intent_id: intentId,
    intent: row?.intent ?? fallback.intent,
    interest: row?.interest ?? fallback.interest,
    stage: row?.stage ?? fallback.stage,
    temperature: row?.temperature ?? fallback.temperature,
    suggested_card: row?.suggested_card ?? fallback.suggested_card
  };
}

export default NovaLinkBusinessProfile;
