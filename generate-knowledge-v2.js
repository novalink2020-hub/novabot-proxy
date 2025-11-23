// generate-knowledge-v2.js
// V2 – مولّد knowledge.json محسّن لنوفا لينك

import fetch from "node-fetch";
import * as cheerio from "cheerio";
import fs from "fs";

// ================= الإعدادات الأساسية =================

const DOMAIN = "https://novalink-ai.com";
const SITEMAP_URL = `${DOMAIN}/sitemap.xml`;

// صفحات نريد ضمان وجودها حتى لو لم تظهر بشكل مثالي في السايت ماب
const EXTRA_PAGES = [
  {
    url: DOMAIN + "/",
    category: "home"
  },
  {
    url: DOMAIN + "/services-khdmat-nwfa-lynk",
    category: "services"
  }
];

const OUTPUT_FILE = "./knowledge.v2.json";

// =============== دوال مساعدة للنصوص ===============

function cleanText(str = "") {
  return str
    .replace(/\s+/g, " ")
    .replace(/(&nbsp;)/g, " ")
    .trim();
}

function extractCategory(url) {
  try {
    const u = new URL(url);
    const path = u.pathname;

    if (path === "/" || path === "") return "home";
    if (path.includes("services")) return "services";
    if (path.includes("about")) return "about";
    if (path.includes("rhlh-frdyh")) return "story";
    if (path.includes("blog")) return "blog";
    if (path.includes("policy") || path.includes("privacy")) return "legal";
    if (path.includes("terms")) return "legal";

    // تصنيف افتراضي
    return "general";
  } catch {
    return "general";
  }
}

function extractKeywordsFromTitle(title = "") {
  // تقسيم العنوان لكلمات عربية/إنجليزية مفيدة
  return cleanText(title)
    .split(" ")
    .filter(w => w.length >= 3)
    .slice(0, 8); // لا نريد قائمة ضخمة
}

function mergeKeywords(...lists) {
  const set = new Set();
  lists.flat().forEach(k => {
    const val = cleanText(k).toLowerCase();
    if (val && val.length >= 3) set.add(val);
  });
  return Array.from(set);
}

// =============== استخراج البيانات من صفحة واحدة ===============

async function scrapePage(url, forcedCategory = null) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("❌ فشل تحميل الصفحة:", url, res.status);
      return null;
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // ----- title -----
    const rawTitle =
      $('meta[property="og:title"]').attr("content") ||
      $("title").text() ||
      $("h1").first().text();

    const title = cleanText(rawTitle);

    // ----- description -----
    let desc =
      $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") ||
      "";

    desc = cleanText(desc);

    // ----- excerpt من أول فقرة حقيقية -----
    let excerpt = "";
    $("p, h2, h3, li").each((_, el) => {
      if (excerpt) return;
      const txt = cleanText($(el).text() || "");
      if (txt.length >= 60) {
        excerpt = txt;
      }
    });

    if (!excerpt) {
      // لو ما وجدنا فقرة واضحة، نأخذ أول 200 حرف من النص العام في <main> أو body
      const mainText =
        cleanText($("main").text() || "") ||
        cleanText($("body").text() || "");
      excerpt = mainText.substring(0, 220);
    }

    // ----- category -----
    const category = forcedCategory || extractCategory(url);

    // ----- keywords -----
    let metaKeywords = $('meta[name="keywords"]').attr("content") || "";
    const metaList = metaKeywords
      ? metaKeywords.split(",").map(k => cleanText(k))
      : [];

    const autoFromTitle = extractKeywordsFromTitle(title);
    const autoFromDesc = extractKeywordsFromTitle(desc);
    const categoryTags = [category];

    const keywords = mergeKeywords(metaList, autoFromTitle, autoFromDesc, categoryTags);

    // تجاهل الصفحات التي ليس لها عنوان واضح
    if (!title || title.length < 5) {
      console.warn("⚠️ تجاهل صفحة بدون عنوان واضح:", url);
      return null;
    }

    return {
      title,
      url,
      description: desc || excerpt, // لو الوصف فاضي نضع الاقتباس
      excerpt,
      category,
      keywords
    };
  } catch (e) {
    console.error("❌ خطأ أثناء قراءة الصفحة:", url, e.message);
    return null;
  }
}

// =============== قراءة السايت ماب ===============

async function loadSitemapUrls() {
  const res = await fetch(SITEMAP_URL);
  if (!res.ok) {
    throw new Error("فشل تحميل السايت ماب");
  }
  const xml = await res.text();

  const urls = Array.from(xml.matchAll(/<loc>(.*?)<\/loc>/g)).map(m => m[1]);

  // إزالة التكرار
  return Array.from(new Set(urls));
}

// =============== تجميع البيانات كاملة ===============

async function buildKnowledge() {
  console.log("🚀 بدء توليد knowledge.v2.json ...");

  const urls = await loadSitemapUrls();

  // نضمن إضافة EXTRA_PAGES حتى لو لم تكن ظاهرة
  EXTRA_PAGES.forEach(p => {
    if (!urls.includes(p.url)) urls.push(p.url);
  });

  console.log("🔍 عدد الصفحات في السايت ماب + الإضافية:", urls.length);

  const items = [];

  for (const url of urls) {
    // تحقق إذا كانت هذه الصفحة معرفة في EXTRA_PAGES لتحديد category يدويًا
    const custom = EXTRA_PAGES.find(p => p.url === url);
    const forcedCategory = custom?.category || null;

    const item = await scrapePage(url, forcedCategory);
    if (item) items.push(item);
  }

  // ترتيب العناصر: Home ثم About/Services ثم Blog، وفي الأخير الصفحات القانونية
  const orderWeight = (cat) => {
    switch (cat) {
      case "home":
        return 0;
      case "about":
      case "story":
      case "services":
        return 1;
      case "blog":
        return 2;
      case "general":
        return 3;
      case "legal":
        return 4;
      default:
        return 5;
    }
  };

  items.sort((a, b) => {
    const wa = orderWeight(a.category);
    const wb = orderWeight(b.category);
    if (wa !== wb) return wa - wb;
    return a.title.localeCompare(b.title, "ar");
  });

  // كتابة الملف
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(items, null, 2), "utf8");

  console.log("✅ تم إنشاء الملف:", OUTPUT_FILE);
  console.log("📦 إجمالي العناصر:", items.length);
}

// =============== تشغيل مباشر ===============

buildKnowledge().catch((err) => {
  console.error("❌ فشل التوليد:", err);
  process.exit(1);
});
