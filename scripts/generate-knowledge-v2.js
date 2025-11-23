// generate-knowledge.js
// Knowledge Generator – NOVALINK AI – CJS Version for GitHub Actions

const fetch = require("node-fetch");
const cheerio = require("cheerio");
const fs = require("fs");

// ================= الإعدادات الأساسية =================

const DOMAIN = "https://novalink-ai.com";
const SITEMAP_URL = `${DOMAIN}/sitemap.xml`;

// صفحات إضافية نضمن وجودها
const EXTRA_PAGES = [
  { url: DOMAIN + "/", category: "home" },
  { url: DOMAIN + "/services-khdmat-nwfa-lynk", category: "services" }
];

const OUTPUT_FILE = "./knowledge.v2.json";

// =============== دوال مساعدة ===============

function cleanText(str = "") {
  return str.replace(/\s+/g, " ").replace(/(&nbsp;)/g, " ").trim();
}

function extractCategory(url) {
  const u = new URL(url);
  const path = u.pathname;

  if (path === "/" || path === "") return "home";
  if (path.includes("services")) return "services";
  if (path.includes("about")) return "about";
  if (path.includes("rhlh-frdyh")) return "story";
  if (path.includes("blog")) return "blog";
  if (path.includes("policy") || path.includes("privacy")) return "legal";
  if (path.includes("terms")) return "legal";

  return "general";
}

function extractKeywordsFromTitle(title = "") {
  return cleanText(title)
    .split(" ")
    .filter(w => w.length >= 3)
    .slice(0, 8);
}

function mergeKeywords(...lists) {
  const set = new Set();
  lists.flat().forEach(k => {
    const val = cleanText(k).toLowerCase();
    if (val && val.length >= 3) set.add(val);
  });
  return Array.from(set);
}

// =============== استخراج بيانات صفحة ===============

async function scrapePage(url, forcedCategory = null) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    const rawTitle =
      $('meta[property="og:title"]').attr("content") ||
      $("title").text() ||
      $("h1").first().text();
    const title = cleanTex
