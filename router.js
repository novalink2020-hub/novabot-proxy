import { detectNovaIntent } from "./novaIntentDetector.js";
import { novaBrainSystem } from "./novaBrainSystem.js";

function normalizeMessage(input) {
  const raw = input ?? "";
  return String(raw).trim();
}

function deriveLanguageHint(headers) {
  const acceptLanguage = headers?.["accept-language"];
  if (!acceptLanguage) return null;
  const headerValue = Array.isArray(acceptLanguage) ? acceptLanguage[0] : acceptLanguage;
  if (typeof headerValue !== "string") return null;
  if (headerValue.toLowerCase().startsWith("ar")) return "ar";
  return "en";
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  const validMessages = history.filter((entry) => {
    const role = entry?.role;
    const content = entry?.content;
    return (
      (role === "user" || role === "assistant") &&
      typeof content === "string" &&
      content.trim().length > 0
    );
  });
  const result = [];
  let userCount = 0;
  for (let i = validMessages.length - 1; i >= 0; i -= 1) {
    const current = validMessages[i];
    result.unshift(current);
    if (current.role === "user") userCount += 1;
    if (result.length >= 8 && userCount >= 3) break;
  }
  return result;
}

function buildSafeIntentDefaults() {
  return {
    originalIntentId: "ai_business",
    effectiveIntentId: "ai_business",
    sessionTier: "semi_ai",
    hasAIMomentum: true,
    allowGemini: true,
    language: "ar",
    dialectHint: "neutral",
  };
}

function buildSafeResponseFallback() {
  return {
    ok: false,
    reply:
      "NovaBot encountered an unexpected issue. Please try again in a moment, or explore NovaLink articles directly.",
    actionCard: null,
    matchType: null,
    usedAI: false,
    maxTokens: null,
    mode: "fallback",
    extractedConcepts: [],
  };
}

export async function routeNovaBotRequest(httpRequest) {
  const rawMessage = httpRequest?.body?.message ?? "";
  const message = normalizeMessage(rawMessage);

  if (!message) {
    return {
      ok: true,
      reply: "NovaBot is ready. Please send a message so I can help you.",
      actionCard: null,
    };
  }

  const sessionHistory = normalizeHistory(httpRequest?.body?.history);
  const languageHint = deriveLanguageHint(httpRequest?.headers);

  let intentResult;
  try {
    intentResult = detectNovaIntent({
      message,
      languageHint: languageHint || undefined,
    });
  } catch (error) {
    console.error("detectNovaIntent failed", error);
    intentResult = buildSafeIntentDefaults();
  }

  const {
    originalIntentId,
    effectiveIntentId,
    sessionTier,
    hasAIMomentum,
    allowGemini,
    language,
    dialectHint,
  } = intentResult;

  const brainRequest = {
    message,
    originalIntentId,
    intentId: effectiveIntentId,
    sessionTier,
    hasAIMomentum,
    allowGemini,
    language,
    dialectHint,
    sessionHistory,
    sessionId: httpRequest?.body?.sessionId ?? null,
    channel: httpRequest?.body?.channel ?? "web",
    ip: httpRequest?.ip ?? null,
  };

  const userAgentHeader = httpRequest?.headers?.["user-agent"];
  if (userAgentHeader) {
    brainRequest.userAgent = Array.isArray(userAgentHeader)
      ? userAgentHeader[0]
      : userAgentHeader;
  }

  try {
    const brainResponse = await novaBrainSystem(brainRequest);

    return {
      ok: !!brainResponse?.ok,
      reply: typeof brainResponse?.reply === "string" ? brainResponse.reply : "",
      actionCard: brainResponse?.actionCard || null,
      matchType: brainResponse?.matchType || null,
      usedAI: !!brainResponse?.usedAI,
      maxTokens: typeof brainResponse?.maxTokens === "number" ? brainResponse.maxTokens : null,
      mode: brainResponse?.mode || null,
      extractedConcepts: Array.isArray(brainResponse?.extractedConcepts)
        ? brainResponse.extractedConcepts
        : [],
    };
  } catch (error) {
    console.error("novaBrainSystem failed", error);
    return buildSafeResponseFallback();
  }
}

export default routeNovaBotRequest;
