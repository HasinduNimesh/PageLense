// ─── Scraped Metrics ────────────────────────────────────────────────────────
export interface ScrapedMetrics {
  url: string;
  wordCount: number;
  headings: { h1: number; h2: number; h3: number };
  ctaCount: number;
  links: { internal: number; external: number };
  images: { total: number; missingAlt: number; missingAltPercent: number };
  meta: { title: string; description: string };
  pageText: string; // truncated sample for AI context
}

// ─── AI Output ──────────────────────────────────────────────────────────────
export type InsightStatus = "good" | "needs work" | "poor";
export type Priority = "High" | "Medium" | "Low";

export interface AIInsight {
  category:
    | "SEO structure"
    | "Messaging clarity"
    | "CTA usage"
    | "Content depth"
    | "Image accessibility"
    | "UX concerns";
  status: InsightStatus;
  detail: string;
}

export interface Recommendation {
  priority: Priority;
  title: string;
  reason: string;
}

export interface AIAnalysis {
  summary: string;
  insights: AIInsight[];
  recommendations: Recommendation[];
}

// ─── Full Audit Result ───────────────────────────────────────────────────────
export interface AuditResult {
  metrics: ScrapedMetrics;
  analysis: AIAnalysis;
  promptLog: PromptLog;
}

// ─── Prompt Log (required deliverable) ──────────────────────────────────────
export interface PromptLog {
  timestamp: string;
  url: string;
  systemPrompt: string;
  userPrompt: string;
  structuredInput: Record<string, unknown>;
  rawModelResponse: string;
  parsedOutput: AIAnalysis;
}
