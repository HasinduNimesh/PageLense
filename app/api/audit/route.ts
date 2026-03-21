import { NextRequest, NextResponse } from "next/server";
import { scrapeUrl } from "@/lib/scraper";
import { analyzeWithAI } from "@/lib/ai";
import { AuditResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60; // Allow up to 60s for slow pages + AI

// Helper for timestamped logging
function log(step: string, message: string, data?: unknown) {
  const timestamp = new Date().toISOString().split("T")[1].slice(0, 12);
  console.log(`[${timestamp}] 🔍 ${step}: ${message}`);
  if (data) {
    console.log(`           └─ ${JSON.stringify(data)}`);
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log("\n" + "═".repeat(60));
    log("AUDIT", "🚀 New audit request received");

    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      log("VALIDATION", "❌ Invalid URL - empty or not a string");
      return NextResponse.json(
        { error: "A valid URL string is required." },
        { status: 400 }
      );
    }

    // Auto-prefix https:// if missing (Fix Test 1.2)
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
      normalizedUrl = "https://" + normalizedUrl;
      log("VALIDATION", `Added https:// prefix → ${normalizedUrl}`);
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(normalizedUrl);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Invalid protocol");
      }
      log("VALIDATION", `✅ URL validated: ${parsedUrl.hostname}`);
    } catch {
      log("VALIDATION", `❌ Invalid URL format: ${normalizedUrl}`);
      return NextResponse.json(
        { error: "Invalid URL format. Please include https://" },
        { status: 400 }
      );
    }

    // Step 1: Scrape factual metrics
    console.log("\n" + "─".repeat(40));
    log("SCRAPER", `📥 Fetching page content from ${parsedUrl.hostname}...`);
    const scrapeStart = Date.now();

    const metrics = await scrapeUrl(parsedUrl.toString());

    const scrapeTime = Date.now() - scrapeStart;
    log("SCRAPER", `✅ Page scraped in ${scrapeTime}ms`, {
      wordCount: metrics.wordCount,
      headings: metrics.headings,
      ctaCount: metrics.ctaCount,
      images: metrics.images.total,
      links: metrics.links.internal + metrics.links.external,
    });

    // Step 2: Analyze with AI
    console.log("\n" + "─".repeat(40));
    log("AI", "🤖 Sending metrics to Groq (Llama 3.3 70B)...");
    const aiStart = Date.now();

    const { analysis, log: promptLog } = await analyzeWithAI(metrics);

    const aiTime = Date.now() - aiStart;
    log("AI", `✅ AI analysis complete in ${aiTime}ms`, {
      insightsCount: analysis.insights.length,
      recommendationsCount: analysis.recommendations.length,
    });

    // Step 3: Return full audit result
    const result: AuditResult = {
      metrics,
      analysis,
      promptLog,
    };

    const totalTime = Date.now() - startTime;
    console.log("\n" + "─".repeat(40));
    log("COMPLETE", `🎉 Audit finished in ${totalTime}ms`);
    console.log("═".repeat(60) + "\n");

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`\n❌ AUDIT ERROR after ${totalTime}ms:`, error);
    console.log("═".repeat(60) + "\n");

    const rawMessage =
      error instanceof Error ? error.message : "An unexpected error occurred";
    const raw = rawMessage.toLowerCase();

    // Return user-friendly error messages based on error type

    // Non-existent domain or DNS failure
    if (raw.includes("enotfound") || raw.includes("getaddrinfo") ||
        (raw.includes("fetch failed") && !raw.includes("http"))) {
      return NextResponse.json(
        { error: "Could not reach this website. The domain may not exist or DNS lookup failed." },
        { status: 502 }
      );
    }

    // Connection refused
    if (raw.includes("econnrefused")) {
      return NextResponse.json(
        { error: "Connection refused. The server may be down or not accepting connections." },
        { status: 502 }
      );
    }

    // Timeout
    if (raw.includes("etimedout") || raw.includes("timeout")) {
      return NextResponse.json(
        { error: "Request timed out. The website took too long to respond." },
        { status: 504 }
      );
    }

    // SSL/TLS errors
    if (raw.includes("ssl") || raw.includes("certificate") || raw.includes("cert_")) {
      return NextResponse.json(
        { error: "SSL certificate error. The website may have an invalid or expired certificate." },
        { status: 502 }
      );
    }

    // HTTP errors (from scraper)
    if (rawMessage.includes("Failed to fetch")) {
      return NextResponse.json(
        { error: `Could not access the website. ${rawMessage}` },
        { status: 502 }
      );
    }

    // API key missing
    if (rawMessage.includes("GROQ_API_KEY")) {
      return NextResponse.json(
        { error: "Server configuration error: API key not set" },
        { status: 500 }
      );
    }

    // Groq API errors
    if (rawMessage.includes("Groq API error")) {
      return NextResponse.json(
        { error: `AI analysis failed: ${rawMessage}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ error: rawMessage }, { status: 500 });
  }
}
