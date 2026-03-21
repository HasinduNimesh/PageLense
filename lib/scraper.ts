import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { ScrapedMetrics } from "./types";

// Helper for timestamped logging
function log(step: string, message: string) {
  const timestamp = new Date().toISOString().split("T")[1].slice(0, 12);
  console.log(`[${timestamp}]    └─ SCRAPE/${step}: ${message}`);
}

// ─── CTA patterns — marketing/conversion actions ─────────────────────────────
const CTA_PATTERNS = [
  /get\s*started/i, /contact\s*us/i, /learn\s*more/i, /sign\s*up/i,
  /try\s*free/i, /request\s*demo/i, /book\s*a\s*call/i, /get\s*a\s*quote/i,
  /schedule/i, /download/i, /subscribe/i, /start\s*now/i, /see\s*how/i,
  /talk\s*to\s*us/i, /let['']s\s*talk/i, /get\s*in\s*touch/i,
  /free\s*trial/i, /view\s*demo/i, /watch\s*demo/i, /explore/i,
  /book\s*now/i, /get\s*access/i, /claim/i, /apply\s*now/i,
  // Agency/marketing site patterns
  /get\s*a\s*proposal/i, /work\s*with\s*us/i, /start\s*a\s*project/i,
  /view\s*our\s*work/i, /see\s*case\s*studies/i,
  /get\s*pricing/i, /view\s*pricing/i, /see\s*plans/i,
  /watch\s*video/i, /play\s*video/i, /see\s*results/i,
];

// ─── Non-marketing buttons to EXCLUDE from CTA count ─────────────────────────
// These are functional UI elements, not conversion-focused CTAs
const UI_BUTTON_EXCLUSIONS = [
  // Navigation & UI controls
  /menu/i, /close/i, /open/i, /toggle/i,
  /next/i, /previous/i, /prev/i, /back/i,
  /search/i, /filter/i, /sort\s*by/i,
  /share/i, /copy\s*link/i, /print/i,
  /load\s*more/i, /show\s*more/i,
  /^\s*>\s*$/, /^\s*<\s*$/, /^\s*×\s*$/,
  /^\s*\d+\s*$/,  // pagination numbers
  /^\s*$/,        // empty/icon-only buttons
  // Auth flows (not marketing conversion)
  /sign\s*in/i, /log\s*in/i, /login/i, /log\s*out/i, /logout/i,
  /register/i, /create\s*account/i,
  // E-commerce transaction buttons (if present)
  /add\s*to\s*cart/i, /add\s*to\s*bag/i, /add\s*to\s*basket/i,
  /buy\s*now/i, /purchase/i, /checkout/i, /place\s*order/i,
  /add\s*to\s*wishlist/i, /wishlist/i, /save\s*for\s*later/i,
  /compare/i, /notify\s*me/i, /apply\s*coupon/i,
  // Destructive/utility actions
  /remove/i, /delete/i, /cancel/i, /dismiss/i,
  // Cookie banners
  /accept\s*cookies/i, /reject\s*cookies/i, /cookie/i,
];

export async function scrapeUrl(url: string): Promise<ScrapedMetrics> {
  log("FETCH", `Connecting to ${new URL(url).hostname}...`);

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; WebAuditBot/1.0; +https://github.com/eight25media/web-audit-tool)",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    // No cache — always fresh
    cache: "no-store",
  });

  if (!response.ok) {
    log("FETCH", `❌ HTTP ${response.status} ${response.statusText}`);
    throw new Error(
      `Failed to fetch "${url}": HTTP ${response.status} ${response.statusText}`
    );
  }

  log("FETCH", `✓ Response received (${response.status})`);

  const html = await response.text();
  log("PARSE", `Parsing HTML (${(html.length / 1024).toFixed(1)}KB)...`);

  const $ = cheerio.load(html);

  // ── FIX 1: Count links BEFORE removing footer ─────────────────────────────
  // Previously footer was removed before counting, causing all external
  // social/partner links in footer to be missed. Fixed by counting first.
  const hostname = new URL(url).hostname;
  let internal = 0;
  let external = 0;

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";

    // FIX 1: Skip ALL non-navigational hrefs.
    // Previously only href === "#" was skipped — meaning href="#contact" or
    // href="javascript:void(0)" were counted as internal links.
    if (
      !href ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("javascript:") ||   // javascript:void(0) etc.
      href.startsWith("#")                 // ALL anchors: #, #section, #contact
    ) return;

    if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//")) {
      const linkHost = href.replace(/^\/\//, "https://");
      try {
        const parsed = new URL(linkHost);
        // Normalize: strip www. for accurate comparison
        const parsedHost = parsed.hostname.replace(/^www\./, "");
        const pageHost = hostname.replace(/^www\./, "");
        parsedHost === pageHost ? internal++ : external++;
      } catch {
        internal++;
      }
    } else {
      internal++;
    }
  });
  log("EXTRACT", `Links: ${internal} internal, ${external} external`);

  // ── Images — count before DOM cleanup ────────────────────────────────────
  const allImages = $("img");
  const totalImages = allImages.length;
  let missingAlt = 0;

  allImages.each((_, el) => {
    const alt = $(el).attr("alt");
    // FIX 2: Only flag images where alt attribute is completely MISSING.
    // Empty string alt="" is valid HTML — it explicitly marks a decorative
    // image for screen readers. Only undefined = error.
    if (alt === undefined) missingAlt++;
  });

  const missingAltPercent =
    totalImages > 0 ? Math.round((missingAlt / totalImages) * 100) : 0;
  log("EXTRACT", `Images: ${totalImages} total, ${missingAlt} missing alt (${missingAltPercent}%)`);

  // ── Meta Tags — read from head before any DOM changes ────────────────────
  const metaTitle =
    $("title").first().text().trim() ||
    $('meta[property="og:title"]').attr("content") ||
    "(not found)";

  const metaDescription =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    "(not found)";
  log("EXTRACT", `Meta: title=${metaTitle.length}chars, desc=${metaDescription.length}chars`);

  // ── Remove noise for clean word count ────────────────────────────────────
  $("script, style, noscript, header nav, footer").remove();
  log("PARSE", "Cleaned noise elements for text extraction");

  // ── FIX 3: Insert spaces between block elements before extracting text ───
  // Cheerio's .text() concatenates adjacent block elements without spaces.
  // e.g. <div>Hello</div><div>World</div> → "HelloWorld" (one word, not two).
  $("p, div, li, h1, h2, h3, h4, h5, h6, td, th, section, article").each((_, el) => {
    $(el).prepend(" ");
  });

  // ── Word Count ────────────────────────────────────────────────────────────
  const rawBodyText = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = rawBodyText.split(" ").filter((w) => w.length > 0).length;
  log("EXTRACT", `Word count: ${wordCount} words`);

  // ── Headings ─────────────────────────────────────────────────────────────
  const headings = {
    h1: $("h1").length,
    h2: $("h2").length,
    h3: $("h3").length,
  };
  log("EXTRACT", `Headings: H1=${headings.h1}, H2=${headings.h2}, H3=${headings.h3}`);

  // ── FIX 2: CTAs — only marketing CTAs, not e-commerce/UI buttons ─────────
  const ctaEls = new Set<Element>();

  // Explicit CTA-styled links (btn/cta class names)
  $(
    'a[class*="btn"], a[class*="cta"], a[class*="button"], [class*="cta-"], input[type="submit"]'
  ).each((_, el) => {
    const text = $(el).text().trim();
    if (!UI_BUTTON_EXCLUSIONS.some((p) => p.test(text))) {
      ctaEls.add(el);
    }
  });

  // Buttons — only if text matches a marketing CTA pattern
  $("button").each((_, el) => {
    const text = $(el).text().trim();
    const isExcluded = UI_BUTTON_EXCLUSIONS.some((p) => p.test(text));
    const isMarketingCTA = CTA_PATTERNS.some((p) => p.test(text));
    if (isMarketingCTA && !isExcluded && !ctaEls.has(el)) {
      ctaEls.add(el);
    }
  });

  // Links — only if text matches a marketing CTA pattern
  $("a").each((_, el) => {
    const text = $(el).text().trim();
    const isExcluded = UI_BUTTON_EXCLUSIONS.some((p) => p.test(text));
    const isMarketingCTA = CTA_PATTERNS.some((p) => p.test(text));
    if (isMarketingCTA && !isExcluded && !ctaEls.has(el)) {
      ctaEls.add(el);
    }
  });

  const ctaCount = ctaEls.size;
  log("EXTRACT", `CTAs found: ${ctaCount} marketing action links`);

  // ── FIX 4: Page text for AI — raised from 4000 to 20000 chars ────────────
  // 4000 chars was too aggressive — the AI never saw the bottom half of most
  // pages, making "Content Depth" insights inaccurate. 20000 chars (~5000
  // tokens) is well within modern model limits and gives the AI full context.
  const pageText = rawBodyText.substring(0, 20000);
  log("EXTRACT", `Text sample: ${pageText.length} chars prepared for AI`);

  return {
    url,
    wordCount,
    headings,
    ctaCount,
    links: { internal, external },
    images: { total: totalImages, missingAlt, missingAltPercent },
    meta: { title: metaTitle, description: metaDescription },
    pageText,
  };
}
