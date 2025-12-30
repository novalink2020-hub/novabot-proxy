/**************************************************************
 * NovaLink Business Profile
 * ------------------------------------------------------------
 * يعرّف:
 * - اهتمامات NovaLink التجارية
 * - كيف تُترجم نوايا المستخدم إلى إشارات بيع
 * - بدون أي اعتماد على السيرفر أو الدماغ
 **************************************************************/

export const NovaLinkBusinessProfile = {
  meta: {
    business_id: "novalink",
    name: "NovaLink AI",
    default_language: "ar",
    version: "bp_v1"
  },

  /**
   * الاهتمامات التجارية الأساسية
   * هذه أعمدة الداشبورد لاحقًا
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
   * بطاقات الواجهة (UI Actions)
   * تحدد ما نطلبه من المستخدم
   */
  ui_actions: {
    subscribe: {
      required: ["email"],
      optional: ["name"]
    },

    bot_lead: {
      required: ["email_or_phone"],
      optional: ["name", "company"]
    },

    business_subscribe: {
      required: ["email"],
      optional: ["name", "company", "role"]
    },

    collaboration: {
      required: ["email_or_phone"],
      optional: ["name", "company"]
    }
  },

  /**
   * تحويل intent التقني → معنى تجاري
   * (أهم جزء في الملف)
   */
  intent_map: {
    consulting_purchase: {
      interest: "ai_service",
      stage: "قرار",
      temperature: "ساخن",
      suggested_card: "bot_lead"
    },

    ai_business: {
      interest: "business_subscription",
      stage: "بحث",
      temperature: "دافئ",
      suggested_card: null
    },

    subscribe_general: {
      interest: "knowledge_subscription",
      stage: "اهتمام",
      temperature: "دافئ",
      suggested_card: "subscribe"
    },

    collaboration_interest: {
      interest: "partnership",
      stage: "استكشاف",
      temperature: "دافئ",
      suggested_card: "collaboration"
    },

    out_of_scope: {
      interest: null,
      stage: "غير_مهتم",
      temperature: "بارد",
      suggested_card: null
    }
  },

  /**
   * القيم الافتراضية
   */
  fallback: {
    interest: "knowledge_subscription",
    stage: "غير_واضح",
    temperature: "بارد",
    suggested_card: null
  }
};

export default NovaLinkBusinessProfile;
