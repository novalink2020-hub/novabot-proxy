// ai-providers.js
// مسؤول عن استدعاء سلسلة مزودي الذكاء الاصطناعي (Gemini → Cloudflare)
// بنبرة وشخصية نوفا بوت كما هي معرّفة في nova-config.js

"use strict";

const fetch = require("node-fetch");
const NOVA_CONFIG = require("./nova-config");

// ===============
// أدوات مساعدة
// ===============

/**
 * تجهيز برومبت موحّد يعتمد على:
 * - لغة المستخدم
 * - شخصية ونبرة نوفا بوت
 * - محتوى المستخدم
 */
function buildPrompt(userMessage, language = "ar") {
  const style = NOVA_CONFIG.META.STYLE_PROFILE;

  // لو الرسالة إنجليزية نخاطب بالإنجليزية
  if (language === "en") {
    return `
You are NovaBot, an AI assistant representing "NovaLink AI".

Persona:
${style.PERSONA_DESCRIPTION}

Writing Style:
${style.WRITING_STYLE}

Restrictions / Don't Do:
${style.DONT_DO}

User Message:
${userMessage}

Respond in clear, concise English (max 300 tokens).
`;
  }

  // افتراضي: العربي
  return `
أنت نوفا بوت، مساعد ذكي يمثل "مدونة نوفا لينك".

الشخصية:
${style.PERSONA_DESCRIPTION}

أسلوب الكتابة:
${style.WRITING_STYLE}

ممنوع:
${style.DONT_DO}

رسالة المستخدم:
${userMessage}

اكتب ردًا واضحًا ومختصرًا وبأقصى 300 توكن.
  `.trim();
}

// =====================================
// 1) استدعــــاء Gemini
// =====================================

async function callGemini(promptText) {
  const provider = NOVA_CONFIG.AI_ENGINE.PROVIDERS.GEMINI;
  if (!provider.ENABLED) return null;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[AI] لا يوجد GEMINI_API_KEY في البيئة.");
    return null;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${provider.DEFAULT_MODEL}:generateContent?key=${apiKey}`;

    const body = {
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        maxOutputTokens: provider.MAX_TOKENS || 300,
        temperature: NOVA_CONFIG.AI_ENGINE.DEFAULTS.TEMPERATURE || 0.6,
        topP: NOVA_CONFIG.AI_ENGINE.DEFAULTS.TOP_P || 0.9
      }
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      console.warn("[AI] فشل Gemini:", res.status, await res.text());
      return null;
    }

    const data = await res.json();

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      data?.candidates?.[0]?.output_text ||
      null;

    if (!text) {
      console.warn("[AI] Gemini أعاد ردًا فارغًا");
      return null;
    }

    return {
      provider: "gemini",
      answer: text.trim()
    };
  } catch (err) {
    console.error("[AI] خطأ في استدعاء Gemini:", err.message);
    return null;
