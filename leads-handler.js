// leads-handler.js
// نظام جمع العملاء المحتملين (Leads) لنوفا لينك
// - تخزين JSON على GitHub
// - إرسال بريد فوري إلى contact@novalink-ai.com
// - مهيأ للعمل مع server-novalink.js

"use strict";

const fetch = require("node-fetch");
const nodemailer = require("nodemailer");
const NOVA_CONFIG = require("./nova-config");

// ===============================
// 1) إعداد GitHub
// ===============================
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // يجب وضعه في Render
const GITHUB_REPO = "novalink2020-hub";        // اسم الريبو
const GITHUB_OWNER = "novalink2020";           // حسابك على GitHub
const GITHUB_FILE_PATH = "database/leads.json"; // مكان حفظ الملف

// ===============================
// 2) إعداد SMTP لإرسال الإيميلات
// ===============================
const SMTP_TRANSPORT = nodemailer.createTransport({
  host: "smtp.zoho.com",
  port: 465,
  secure: true,
  auth: {
    user: "contact@novalink-ai.com",
    pass: process.env.CONTACT_EMAIL_PASS // تضعه في Render
  }
});

// ===============================
// جلب ملف leads.json من GitHub
// ===============================
async function fetchLeadsFile() {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json"
      }
    });

    if (res.status === 404) {
      return { exists: false, sha: null, leads: [] };
    }

    if (!res.ok) {
      console.warn("[Leads] فشل جلب ملف GitHub:", res.status);
      return { exists: false, sha: null, leads: [] };
    }

    const json = await res.json();
    const content = Buffer.from(json.content, "base64").toString("utf-8");
    const leads = JSON.parse(content);

    return { exists: true, sha: json.sha, leads: leads || [] };
  } catch (err) {
    console.error("[Leads] خطأ جلب GitHub:", err.message);
    return { exists: false, sha: null, leads: [] };
  }
}

// ===============================
// حفظ ملف leads.json في GitHub
// ===============================
async function saveLeadsFile(leads, sha) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;

  const contentString = JSON.stringify(leads, null, 2);
  const encoded = Buffer.from(contentString).toString("base64");

  const body = {
    message: "Update leads.json (NovaBot Lead Captured)",
    content: encoded,
    sha: sha || undefined
  };

  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      console.error("[Leads] فشل حفظ GitHub:", res.status, await res.text());
      return false;
    }

    return true;
  } catch (err) {
    console.error("[Leads] خطأ حفظ GitHub:", err.message);
    return false;
  }
}

// ===============================
// إرسال البريد إلى contact@novalink-ai.com
// ===============================
async function sendLeadEmail(leadData) {
  const subject = `🔥 Lead جديد عبر نوفا بوت — ${leadData.intent}`;
  const text = `
وصل طلب Lead جديد عبر نوفا لينك / نوفا بوت:

الاسم: ${leadData.name || "غير مذكور"}
الإيميل: ${leadData.email || "غير موجود"}
الهاتف: ${leadData.phone || "غير موجود"}
النية: ${leadData.intent}
الرسالة:
${leadData.message}

-------------------------------------
Time: ${new Date().toISOString()}
Source: NovaBot / NovaLink
URL: ${leadData.pageUrl || "غير متوفر"}
`;

  try {
    await SMTP_TRANSPORT.sendMail({
      from: "NovaLink AI <contact@novalink-ai.com>",
      to: "contact@novalink-ai.com",
      subject,
      text
    });

    return true;
  } catch (err) {
    console.error("[Leads] فشل إرسال الإيميل:", err.message);
    return false;
  }
}

// ===============================
// المعالج الأساسي للـ Lead
// ===============================
async function handleNewLead({
  name,
  email,
  phone,
  intent,
  message,
  pageUrl
}) {
  // 1) صياغة كائن Lead مرتب
  const lead = {
    id: `lead_${Date.now()}`,
    name: name || null,
    email: email || null,
    phone: phone || null,
    intent: intent || "UNKNOWN",
    message: message || "",
    pageUrl: pageUrl || null,
    timestamp: new Date().toISOString()
  };

  // 2) جلب الملف الحالي
  const file = await fetchLeadsFile();
  const leads = file.leads || [];

  // 3) إضافة الـ Lead
  leads.push(lead);

  // 4) حفظه في GitHub
  const saved = await saveLeadsFile(leads, file.sha);
  if (!saved) {
    console.warn("[Leads] فشل حفظ Lead في GitHub.");
  }

  // 5) إرسال إيميل تنبيه
  const mailed = await sendLeadEmail(lead);
  if (!mailed) {
    console.warn("[Leads] فشل إرسال الإيميل للـ Lead.");
  }

  return {
    ok: true,
    savedToGitHub: saved,
    emailSent: mailed,
    lead
  };
}

module.exports = {
  handleNewLead
};
