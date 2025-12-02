export async function routeNovaBotRequest(httpRequest) {
  return {
    ok: true,
    reply: "Router placeholder loaded. NovaBot core modules not installed yet.",
    actionCard: null,
    matchType: null,
    usedAI: false,
    maxTokens: null,
    mode: "placeholder",
    extractedConcepts: []
  };
}

export default routeNovaBotRequest;
