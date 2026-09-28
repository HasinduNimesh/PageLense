import { ScrapedMetrics, AIAnalysis, PromptLog } from "./types";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b";

// Helper for timestamped logging
function log(step: string, message: string) {
  const timestamp = new Date().toISOString().split("T")[1].slice(0, 12);
  console.log(`[${timestamp}]    └─ AI/${step}: ${message}`);
}

// ─── System Prompt ────────────────────────────────────────────────────────────
// This is the core of our AI design — it grounds the model in real data,
// forces specific references to metrics, and demands structured JSON output.
const SYSTEM_PROMPT = `You are a senior web marketing analyst specializing in SEO, conversion rate optimization, content strategy, and UX for B2B marketing websites.

You will receive factual metrics extracted from a real webpage plus a sample of its text. Your task is to analyze this data and return structured insights.

STRICT RULES:
1. Every insight MUST cite specific numbers from the provided metrics — no generic statements
2. Prioritize findings by business impact (conversion, SEO, accessibility)
3. Recommendations must be immediately actionable
4. Return ONLY valid JSON — no markdown fences, no preamble, no commentary

EVALUATION BENCHMARKS to guide your analysis:
- H1 count: exactly 1 is ideal; 0 or 2+ is a problem
- Word count: 800–2000 is good for most marketing pages; under 300 is thin content
- CTA density: 1 CTA per 300–400 words is healthy
- Missing alt text: any % above 0 is a problem for SEO and accessibility
- Meta title: 50–60 characters is ideal; missing or too long/short is a flag
- Meta description: 120–160 characters is ideal

OUTPUT — return exactly this JSON shape:
{
  "summary": "2-sentence overall assessment referencing specific metric findings",
  "insights": [
    {
      "category": "SEO structure",
      "status": "good" | "needs work" | "poor",
      "detail": "specific analysis referencing actual numbers"
    },
    {
      "category": "Messaging clarity",
      "status": "good" | "needs work" | "poor",
      "detail": "specific analysis referencing actual numbers"
    },
    {
      "category": "CTA usage",
      "status": "good" | "needs work" | "poor",
      "detail": "specific analysis referencing actual numbers"
    },
    {
      "category": "Content depth",
      "status": "good" | "needs work" | "poor",
      "detail": "specific analysis referencing actual numbers"
    },
    {
      "category": "Image accessibility",
      "status": "good" | "needs work" | "poor",
      "detail": "specific analysis referencing actual numbers"
    }
  ],
  "recommendations": [
    {
      "priority": "High" | "Medium" | "Low",
      "title": "short action title (under 8 words)",
      "reason": "specific reasoning tied to the metrics provided"
    }
  ]
}

Return 3–5 recommendations, ordered from highest to lowest priority.`;

// ─── User Prompt Builder ──────────────────────────────────────────────────────
function buildUserPrompt(metrics: ScrapedMetrics): string {
  const ctaPerWord =
    metrics.wordCount > 0
      ? ((metrics.ctaCount / metrics.wordCount) * 300).toFixed(2)
      : "0";

  const metaTitleLen = metrics.meta.title.length;
  const metaDescLen = metrics.meta.description.length;

  return `Please analyze the following webpage audit data:

━━━ FACTUAL METRICS ━━━
URL: ${metrics.url}
Word count: ${metrics.wordCount} words
Headings: H1=${metrics.headings.h1}, H2=${metrics.headings.h2}, H3=${metrics.headings.h3}
CTAs (buttons + action links): ${metrics.ctaCount} (≈${ctaPerWord} CTAs per 300 words)
Links: ${metrics.links.internal} internal, ${metrics.links.external} external
Images: ${metrics.images.total} total, ${metrics.images.missingAlt} missing alt text (${metrics.images.missingAltPercent}%)
Meta title: "${metrics.meta.title}" [${metaTitleLen} chars]
Meta description: "${metrics.meta.description}" [${metaDescLen} chars]

━━━ PAGE TEXT SAMPLE (first 4000 chars) ━━━
${metrics.pageText}

Analyze the above and return structured JSON as specified.`;
}

// ─── Main AI Call ─────────────────────────────────────────────────────────────
export async function analyzeWithAI(
  metrics: ScrapedMetrics
): Promise<{ analysis: AIAnalysis; log: PromptLog }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    log("CONFIG", "❌ GROQ_API_KEY not found in environment");
    throw new Error(
      "GROQ_API_KEY is not set. Add it to your .env.local file."
    );
  }

  log("PREPARE", `Building prompt for ${metrics.url}`);
  const userPrompt = buildUserPrompt(metrics);
  log("PREPARE", `Prompt built: ${userPrompt.length} chars`);

  // Structured input we send to the model (logged for transparency)
  const structuredInput = {
    model: GROQ_MODEL,
    temperature: 0.3, // Lower = more grounded, less hallucination
    maxOutputTokens: 1500,
    metricsSnapshot: {
      url: metrics.url,
      wordCount: metrics.wordCount,
      headings: metrics.headings,
      ctaCount: metrics.ctaCount,
      links: metrics.links,
      images: metrics.images,
      meta: metrics.meta,
    },
  };

  const requestBody = {
    model: GROQ_MODEL,
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
    temperature: 0.3,
    max_tokens: 1500,
    response_format: { type: "json_object" },
  };

  log("REQUEST", `Sending to Groq API (model: ${GROQ_MODEL})...`);

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    log("REQUEST", `❌ Groq API error: ${response.status}`);
    throw new Error(`Groq API error ${response.status}: ${errorBody}`);
  }

  log("REQUEST", `✓ Response received from Groq`);

  const data = await response.json();
  const rawText: string = data.choices?.[0]?.message?.content || "";

  if (!rawText) {
    log("PARSE", "❌ Empty response from model");
    throw new Error("Empty response from Groq API");
  }

  log("PARSE", `Raw response: ${rawText.length} chars`);

  // Strip markdown fences if somehow present
  const cleaned = rawText.replace(/```json|```/g, "").trim();
  let analysis: AIAnalysis;

  try {
    analysis = JSON.parse(cleaned);
    log("PARSE", `✓ JSON parsed successfully`);
    log("PARSE", `Summary: "${analysis.summary.substring(0, 60)}..."`);
  } catch {
    log("PARSE", `❌ Failed to parse JSON response`);
    throw new Error(`Failed to parse Groq response as JSON: ${cleaned}`);
  }

  // Build the prompt log (required deliverable per assessment)
  const promptLog: PromptLog = {
    timestamp: new Date().toISOString(),
    url: metrics.url,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    structuredInput,
    rawModelResponse: rawText,
    parsedOutput: analysis,
  };

  return { analysis, log: promptLog };
}

// Export the system prompt for transparency in the UI
export { SYSTEM_PROMPT };
