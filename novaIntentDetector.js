export function detectNovaIntent(input) {
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

export default detectNovaIntent;
