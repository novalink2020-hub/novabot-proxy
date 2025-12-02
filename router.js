import { detectNovaIntent } from "./novaIntentDetector.js";
import { novaBrainSystem } from "./novaBrainSystem.js";

function normalizeMessage(httpRequest) {
  try {
    const raw = httpRequest?.body?.message;
    if (raw === undefined || raw === null) return "";
    const text = String(raw).trim();
    return typeof text === "string" ? text : "";
  } catch (_) {
    return "";
  }
}

function normalizeHistory(httpRequest) {
  const history = Array.isArray(httpRequest?.body?.history)
    ? httpRequest.body.history
    : [];

  const sanitized = [];

  for (const entry of history) {
    if (!entry || typeof entry !== "object") continue;
    if (entry.role !== "user" && entry.role !== "assistant") continue;
    if (typeof entry.content !== "string") continue;
    sanitized.push({ role: entry.role, content: entry.content });
  }

  return sanitized.length > 8 ? sanitized.slice(-8) : sanitized;
}

function deriveLanguageHint(httpRequest) {
  try {
    const headerValue = httpRequest?.headers?.["accept-language"];
    const primary = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    if (typeof primary === "string" && primary.toLowerCase().startsWith("ar")) {
      return "ar";
    }
  } catch (_) {}

  return "en";
}

function defaultIntentData() {
  return {
    originalIntentId: "ai_business",
    effectiveIntentId: "ai_business",
    sessionTier: "strong_ai",
    hasAIMomentum: true,
    allowGemini: true,
    language: "ar",
    dialectHint: "neutral"
  };
}

function safeEmptyResponse() {
  return {
    ok: true,
    reply: "NovaBot is ready. Please send a message so I can help you.",
    actionCard: null,
    matchType: null,
    usedAI: false,
    maxTokens: null,
    mode: null,
    extractedConcepts: []
  };
}

function brainFailureResponse() {
  return {
    ok: false,
    reply:
      "NovaBot encountered an unexpected issue. Please try again in a moment, or explore NovaLink articles directly.",
    actionCard: null,
    matchType: null,
    usedAI: false,
    maxTokens: null,
    mode: "fallback",
    extractedConcepts: []
  };
}

function normalizeOutput(brainResponse) {
  return {
    ok: !!brainResponse.ok,
    reply: typeof brainResponse.reply === "string" ? brainResponse.reply : "",
    actionCard: brainResponse.actionCard || null,
    matchType: brainResponse.matchType || null,
    usedAI: !!brainResponse.usedAI,
    maxTokens:
      typeof brainResponse.maxTokens === "number"
        ? brainResponse.maxTokens
        : null,
    mode: brainResponse.mode || null,
    extractedConcepts: Array.isArray(brainResponse.extractedConcepts)
      ? brainResponse.extractedConcepts
      : []
  };
}

export async function routeNovaBotRequest(httpRequest) {
  let message = normalizeMessage(httpRequest);

  // Stronger empty message protection
  if (typeof message !== "string" || message.length === 0) {
    return safeEmptyResponse();
  }

  const sessionHistory = normalizeHistory(httpRequest);
  const languageHint = deriveLanguageHint(httpRequest);

  let intentData;
  try {
    intentData = detectNovaIntent({ message, languageHint });
  } catch (_) {
    intentData = defaultIntentData();
  }

  const brainRequest = {
    message,
    originalIntentId: intentData.originalIntentId,
    intentId: intentData.effectiveIntentId,
    sessionTier: intentData.sessionTier,
    hasAIMomentum: intentData.hasAIMomentum,
    allowGemini: intentData.allowGemini,
    language: intentData.language,
    dialectHint: intentData.dialectHint,
    sessionHistory,
    sessionId: httpRequest?.body?.sessionId || null,
    channel: httpRequest?.body?.channel || "web",
    ip: httpRequest?.ip || null,
    userAgent: httpRequest?.headers?.["user-agent"] || null
  };

  let brainResponse;
  try {
    brainResponse = await novaBrainSystem(brainRequest);
  } catch (_) {
    return brainFailureResponse();
  }

  return normalizeOutput(brainResponse);
}

export default routeNovaBotRequest;
