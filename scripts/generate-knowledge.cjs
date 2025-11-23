// NOVALINK – Knowledge Generator (CJS Version using AXIOS)
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

// ====== Settings ======
const DOMAIN = "https://novalink-ai.com";
const SITEMAP_URL = `${DOMAIN}/sitemap.xml`;

const EXTRA_PAGES = [
  { url: DOMAIN + "/", category: "home" },
  { url: DOMAIN + "/services-khdmat-nwfa-lynk", category: "services" }
];

const OUTPUT_FILE = "./knowledge.v2.json";

// ====== Helpers ======
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

// ====== Scrape a page ======
async function scrapePage(url, forcedCategory = null) {
  try {
    const res = await axios.get(url);
    const html = res.data;
    const $ = cheerio.load(html);

    const rawTitle =
      $('meta[property="og:title"]').attr("content") ||
      $("title").text() ||
      $("h1").first().text();

    const title = cleanText(rawTitle);

    let desc =
      $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") ||
      "";
    desc = cleanText(desc);

    let excerpt = "";
    $("p, h2, h3, li").each((_, el) => {
      if (excerpt) return;
      const txt = cleanText($(el).text() || "");
      if (txt.length >= 60) excerpt = txt;
    });

    const category = forcedCategory || extractCategory(url);

    return {
      title,
      url,
      description: desc || excerpt,
      excerpt,
      category,
      keywords: [category]
    };
  } catch (e) {
    console.log("Error loading:", url);
    return null;
  }
}

// ====== Load URLs ======
async function loadSitemapUrls() {
  const res = await axios.get(SITEMAP_URL);
  const xml = res.data;
  const urls = Array.from(xml.matchAll(/<loc>(.*?)<\/loc>/g)).map(m => m[1]);
  return Array.from(new Set(urls));
}

// ====== Build Knowledge ======
async function build() {
  console.log("🚀 Generating knowledge file...");

  const urls = await loadSitemapUrls();

  EXTRA_PAGES.forEach(p => { if (!urls.includes(p.url)) urls.push(p.url); });

  const items = [];
  for (const url of urls) {
    const custom = EXTRA_PAGES.find(p => p.url === url);
    const item = await scrapePage(url, custom?.category || null);
    if (item) items.push(item);
  }

  items.sort((a, b) => a.title.localeCompare(b.title, "ar"));
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(items, null, 2), "utf8");

  console.log("✔ knowledge.v2.json generated");
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
