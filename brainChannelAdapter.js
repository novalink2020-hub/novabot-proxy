// =======================================================
// brainChannelAdapter.js
// تكييف الرسالة حسب قناة الإرسال (Web / WhatsApp / Facebook...)
// =======================================================

function adaptMessageToChannel(response, channel = "web") {
  if (!response || typeof response.answer !== "string") {
    return {
      ok: false,
      provider: response?.provider || "unknown",
      answer: "حدث خلل غير متوقع في تهيئة الرد."
    };
  }

  let msg = response.answer;

  if (channel === "whatsapp") {
    msg = msg
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .trim();
  }

  if (channel === "facebook") {
    msg = msg.replace(/<[^>]+>/g, "").trim();
  }

  return {
    ok: true,
    provider: response.provider || "nova-brain",
    answer: msg
  };
}

module.exports = { adaptMessageToChannel };
