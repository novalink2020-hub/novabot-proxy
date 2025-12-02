export async function novaBrainSystem(request) {
  return {
    ok: true,
    reply: "Brain placeholder active. NovaBot core intelligence not installed yet.",
    actionCard: null,
    matchType: null,
    usedAI: false,
    maxTokens: null,
    mode: "placeholder",
    extractedConcepts: []
  };
}

export default novaBrainSystem;
