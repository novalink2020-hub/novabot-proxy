// =======================================================
// server-v3.js — NovaBot v3 Core Server
// Primary AI Processor (Render)
// المطور: محمد أبو سنينة – NOVALINK.AI
// =======================================================

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const { NOVA_BRAIN_V3 } = require("./nova-brain.v3.config");
const {
  detectIntent,
  detectAIDomain,
  detectLanguage,
  detectDialect
} = require("./brainIntentDetector");
const { decideResponseFlow } = require("./brainDecisionEngine");
const { adaptMessageToChannel } = require("./brainChannelAdapter");

// -------------------------------------------------------
// إعداد Express
// -------------------------------------------------------
const app = express();
app.use(express.json({ limit: "1mb" }));

// CORS – السماح فقط لمصادر محددة
const webChannel =
  (NOVA_BRAIN_V3.CHANNELS && NOVA_BRAIN_V3.CHANNELS.WEB) || {};
const networkCfg = NOVA_BRAIN_V3.NETWORK || {};

const allowedOrigins =
  networkCfg.ALLOWED_ORIGINS ||
  webChannel.ALLOWED_ORIGINS ||
  [];

app.use(
  cors({
    origin: function (origin, callback) {
      // طلبات بدون Origin (مثلاً Postman) – نسمح بها
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn("[CORS] Blocked origin:", origin);
      return callback(new Error("Not allowed by CORS"));
    }
  })
);

// -------------------------------------------------------
// مسار الذكاء الاصطناعي الأساسي
// -------------------------------------------------------
app.post("/api/nova-ai", async (req, res) => {
  try {
    const body = req.body || {};
    const question =
      (body.message || body.question || "").toString().trim();

    if (!question) {
      return res.status(400).json({
        ok: false,
        reply: "يبدو أن الرسالة فارغة، جرّب أن تكتب سؤالك مرة أخرى."
      });
    }

    const history = Array.isArray(body.history) ? body.history : [];
    const channel = (body.channel || "web").toLowerCase();
    const businessType =
      body.businessType ||
      (NOVA_BRAIN_V3.PROFILE && NOVA_BRAIN_V3.PROFILE.BUSINESS_TYPE) ||
      "blog";
    const locale = body.locale || "ar";

    const lang = detectLanguage(question);
    const dialect = detectDialect(question);
    const intent = detectIntent(question);
    const isAIDomain = detectAIDomain(question);

    const context = {
      question,
      history,
      intent,
      lang,
      dialect,
      isAIDomain,
      businessType,
      channel,
      locale,
      meta: body.meta || {}
    };

    const decision = await decideResponseFlow(context);

    const adapted = adaptMessageToChannel(decision, channel);

    return res.json({
      ok: adapted.ok,
      reply: adapted.answer
    });
  } catch (err) {
    console.error("[/api/nova-ai] error:", err);

    return res.status(500).json({
      ok: false,
      reply:
        "حدث خطأ غير متوقع أثناء معالجة طلبك في نوفا بوت. جرّب بعد لحظات، وإن استمر الخلل يمكنك التواصل مع فريق نوفا لينك."
    });
  }
});

// -------------------------------------------------------
// Health Check
// -------------------------------------------------------
app.get("/", (_req, res) => {
  res.send("NovaBot v3 server running ✔");
});

// -------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`NovaBot v3 running on port ${PORT}`)
);
