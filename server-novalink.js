import express from "express";
import cors from "cors";
import { routeNovaBotRequest } from "./router.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "NovaBot Brain System",
    version: "v7.0",
    message: "NovaBot is running."
  });
});

app.post("/novabot", async (req, res) => {
  try {
    const response = await routeNovaBotRequest(req);
    res.json(response);
  } catch (err) {
    res.json({
      ok: false,
      reply:
        "NovaBot encountered an unexpected issue. Please try again shortly.",
      actionCard: null,
      matchType: null,
      usedAI: false,
      maxTokens: null,
      mode: "fallback",
      extractedConcepts: []
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 NovaBot Mini Server running on port ${PORT}`);
});
