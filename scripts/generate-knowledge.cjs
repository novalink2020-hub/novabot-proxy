// NOVALINK – Knowledge Generator (CJS Version)
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
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

// ====== Scrape a page ======
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

    if (!excerpt) {
      const mainText =
        cleanText($("main").text() || "") ||
        cleanText($("body").text() || "");
      excerpt = mainText.substring(0, 200);
    }

    const category = forcedCategory || extractCategory(url);

    const keywords = mergeKeywords(
      extractKeywordsFromTitle(title),
      extractKeywordsFromTitle(desc),
      [category]
    );

    return { title, url, description: desc || excerpt, excerpt, category, keywords };
  } catch {
    return null;
  }
}

// ====== Load URLs ======
async function loadSitemapUrls() {
  const res = await fetch(SITEMAP_URL);
  const xml = await res.text();
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

  console.log("✔ knowledge.v2.json generated.");
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
