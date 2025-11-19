// ai-providers.js
// مسؤول عن سلسلة الذكاء الاصطناعي: Gemini → Cloudflare
// متوافق مع إعدادات nova-config.js

"use strict";

const fetch = require("node-fetch");
const NOVA_CONFIG = require("./nova-config");

// ===============
// PROMPT BUILDER
// ===============
function buildPrompt(userMessage, language = "ar") {
  const style = NOVA_CONFIG.META.STYLE_PROFILE;

  if (language === "en") {
    return `
You are NovaBot, the official AI assistant of NovaLink AI.

Persona:
${style.PERSONA_DESCRIPTION}

Writing Style:
${style.WRITING_STYLE}

Do not:
${style.DONT_DO}

User message:
${userMessage}

Respond in English, concise, max ${NOVA_CONFIG.AI_ENGINE.DEFAULTS.MAX_TOKENS} tokens.
    `.trim();
  }

  return `
أنت نوفا بوت، مساعد يمثل "مدونة نوفا لينك".

الشخصية:
${style.PERSONA_DESCRIPTION}

أسلوب الكتابة:
${style.WRITING_STYLE}

ممنوع:
${style.DONT_DO}

رسالة المستخدم:
${userMessage}

اكتب ردًا واضحًا مختصرًا (حد أقصى ${NOVA_CONFIG.AI_ENGINE.DEFAULTS.MAX_TOKENS} توكن).
  `.trim();
}

// ==========================
// GEMINI CALL
// ==========================
async function callGemini(promptText) {
  const provider = NOVA_CONFIG.AI_ENGINE.PROVIDERS.GEMINI;
  if (!provider.ENABLED) return null;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${provider.DEFAULT_MODEL}:generateContent?key=${apiKey}`;

    const body = {
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        maxOutputTokens: provider.MAX_TOKENS,
        temperature: NOVA_CONFIG.AI_ENGINE.DEFAULTS.TEMPERATURE,
        topP: NOVA_CONFIG.AI_ENGINE.DEFAULTS.TOP_P
      }
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) return null;

    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || null;

    if (!text) return null;

    return { provider: "gemini", answer: text.trim() };
  } catch (err) {
    console.error("[AI] Gemini Error:", err.message);
    return null;
  }
}

// ==========================
// CLOUDFLARE CALL
// ==========================
async function callCloudflare(promptText) {
  const provider = NOVA_CONFIG.AI_ENGINE.PROVIDERS.CLOUDFLARE;
  if (!provider.ENABLED) return null;

  const account = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_AI_API_KEY;
  if (!account || !token) return null;

  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${provider.DEFAULT_MODEL}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: "Return clear answer, max 300 tokens." },
          { role: "user", content: promptText }
        ],
        max_tokens: provider.MAX_TOKENS
      })
    });

    const data = await response.json();
    if (!data?.result?.response) return null;

    return { provider: "cloudflare", answer: data.result.response.trim() };
  } catch (err) {
    console.error("[AI] Cloudflare Error:", err.message);
    return null;
  }
}

// ==========================
// FAILOVER PIPELINE
// ==========================
async function runAIProviders(userMessage, language = "ar") {
  const prompt = buildPrompt(userMessage, language);

  // 1) Gemini
  const g = await callGemini(prompt);
  if (g) return g;

  // 2) Cloudflare
  const c = await callCloudflare(prompt);
  if (c) return c;

  // 3) No provider
  return null;
}

module.exports = {
  runAIProviders,
  callGemini,
  callCloudflare,
  buildPrompt
};
