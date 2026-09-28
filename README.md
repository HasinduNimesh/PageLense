# Website Audit Tool

An AI-powered website audit tool built for EIGHT25MEDIA. Paste a URL, get real factual metrics and AI-generated insights — grounded in actual page data.

---

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/HasinduNimesh/PageLense
cd wpageLense
npm install

# 2. Set your environment variable
cp .env.example .env.local
# Add your Groq API key to .env.local

# 3. Run locally
npm run dev
# Open http://localhost:3000
```

### Get a free Groq API key
1. Go to https://console.groq.com/keys
2. Click "Create API Key" (free, no credit card)
3. Add to `.env.local`:

```env
GROQ_API_KEY=your_key_here
```

---

## Architecture Overview

```
User inputs URL
      │
      ▼
/app/page.tsx (React frontend)
      │  POST { url }
      ▼
/app/api/audit/route.ts (Next.js API Route — serverless)
      │
      ├─▶ lib/scraper.ts  ──── cheerio extracts factual metrics
      │         │
      │         └─▶ Returns: ScrapedMetrics (wordCount, headings, CTAs, links, images, meta)
      │
      └─▶ lib/ai.ts  ──────── openai/gpt-oss-120b via Groq analyzes metrics + page text
                │
                └─▶ Returns: AIAnalysis (insights, recommendations, summary)
                             + PromptLog (system prompt, user prompt, raw response)
```

**Key design decision:** Scraping and AI are completely separate modules. The AI layer never touches the raw HTML — it only sees structured metrics and a text excerpt. This means:
- AI insights are grounded in verifiable data
- The scraper can be swapped independently (e.g., Puppeteer for JS-heavy pages)
- Prompt inputs are fully auditable

---

## AI Design Decisions

### 1. Structured input, not raw HTML
Instead of sending raw HTML to the AI, we extract structured metrics first:
```
wordCount: 1284, headings: {h1:2, h2:6, h3:9}, ctaCount: 4...
```
This forces the AI to reason from verified facts rather than re-interpreting the page itself.

### 2. System prompt with evaluation benchmarks
The system prompt includes SEO benchmarks:
- H1 count: exactly 1 is ideal
- Meta title: 50–60 chars
- CTA density: 1 per 300–400 words

This grounds the AI's "good/needs work/poor" ratings in real standards, not guesswork.

### 3. Low temperature (0.3)
We use `temperature: 0.3` to minimize hallucination. Web audits need accuracy, not creativity.

### 4. Forced JSON output mode
We use Groq's `response_format: { type: "json_object" }` to force structured output, with a fallback JSON parser in case the model adds markdown fences.

### 5. Prompt logs included in API response
Every response includes the full prompt log (system prompt, user prompt, raw model output) — visible in the UI under "Prompt log / reasoning trace". This satisfies the assessment requirement and makes the AI layer transparent.

---

## Trade-offs

| Decision | Trade-off |
|---|---|
| openai/gpt-oss-120b (Groq) | High speed and excellent metric grounding via free tier, but subject to rate limits |
| cheerio (static scraper) | Fast and simple, but can't scrape JS-rendered content (use Puppeteer for SPAs) |
| Single page only | Intentional scope limit per assessment. Multi-page would need a queue system |
| Server-side scraping via API route | Avoids CORS issues. Vercel 30s timeout is a constraint for slow pages |
| Text excerpt capped at 20000 chars | Balance between context and token cost |

---

## Known Limitations

- **Subdomain links counted as external** — Links from `www.wikipedia.org` to `en.wikipedia.org` are counted as external since they have different hostnames. A future improvement would normalize subdomain comparisons (e.g., treat `*.example.com` as internal).

- **JavaScript-rendered content not captured** — Sites with heavy JavaScript rendering (SPAs, React apps with no SSR) may show lower word counts since cheerio only parses static HTML. Use Puppeteer/Playwright for these cases.

- **CTA detection is pattern-based** — The scraper uses regex patterns to identify marketing CTAs and exclude transactional buttons (Add to Cart, Checkout). This may over/under count on non-English sites or sites with unconventional button copy.

- **Rate limits on AI provider** — The Groq API has rate limits on the free tier. Heavy usage may hit token-per-minute limits, causing temporary failures.

---

## What I Would Improve With More Time

1. **Puppeteer/Playwright fallback** — for JS-heavy SPAs where cheerio returns minimal content
2. **Caching layer** — Redis cache for repeat URL audits (same URL within 1 hour returns cached result)
3. **Score card** — convert insights into a single 0–100 score with breakdown by category
4. **PDF export** — generate a downloadable audit report
5. **Side-by-side comparison** — audit two URLs and diff the metrics
6. **Scheduled audits** — weekly automated re-audits with trend tracking
7. **Lighthouse integration** — add Core Web Vitals (LCP, CLS, FID) from Google's Lighthouse API

---

## Prompt Logs

Every audit response includes a full `promptLog` object:
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "url": "https://example.com",
  "systemPrompt": "...",
  "userPrompt": "...",
  "structuredInput": { "wordCount": 1284, "headings": {...}, ... },
  "rawModelResponse": "{ \"summary\": \"...\", ... }",
  "parsedOutput": { "insights": [...], "recommendations": [...] }
}
```

These are also visible in the UI — click "Prompt log / reasoning trace" after an audit.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Scraping:** cheerio + native fetch
- **AI:** openai/gpt-oss-120b (via Groq API)
- **Deployment:** Vercel (free tier)
- **Styling:** Tailwind CSS
