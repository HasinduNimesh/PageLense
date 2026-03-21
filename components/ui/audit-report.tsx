"use client"

import {
  BarChart3,
  Search,
  Image as ImageIcon,
  Link as LinkIcon,
  Type,
  Heading,
  MousePointerClick,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Lightbulb,
  ChevronDown,
  FileText,
  Sparkles,
  TrendingUp,
  ExternalLink,
  Download
} from "lucide-react"
import { useState } from "react"
import { AuditResult, InsightStatus, Priority } from "@/lib/types"
import { generatePDFReport } from "@/lib/pdf"

interface AuditReportProps {
  result: AuditResult
}

function getStatusIcon(status: InsightStatus) {
  switch (status) {
    case "good":
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
    case "needs work":
      return <AlertTriangle className="w-4 h-4 text-amber-500" />
    case "poor":
      return <XCircle className="w-4 h-4 text-red-500" />
    default:
      return <AlertTriangle className="w-4 h-4 text-amber-500" />
  }
}

function getStatusStyle(status: InsightStatus) {
  switch (status) {
    case "good":
      return "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
    case "needs work":
      return "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
    case "poor":
      return "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
    default:
      return "bg-muted border-border text-muted-foreground"
  }
}

function getPriorityStyle(priority: Priority) {
  switch (priority) {
    case "High":
      return {
        bar: "bg-gradient-to-b from-red-500 to-red-600",
        badge: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
        dot: "bg-red-500"
      }
    case "Medium":
      return {
        bar: "bg-gradient-to-b from-amber-500 to-amber-600",
        badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
        dot: "bg-amber-500"
      }
    case "Low":
      return {
        bar: "bg-gradient-to-b from-blue-500 to-blue-600",
        badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
        dot: "bg-blue-500"
      }
    default:
      return {
        bar: "bg-gradient-to-b from-gray-400 to-gray-500",
        badge: "bg-muted text-muted-foreground border border-border",
        dot: "bg-gray-500"
      }
  }
}

function getScoreColor(score: number) {
  if (score >= 80) return "text-emerald-500"
  if (score >= 60) return "text-amber-500"
  return "text-red-500"
}

function getScoreGradient(score: number) {
  if (score >= 80) return "from-emerald-500/20 to-emerald-500/5"
  if (score >= 60) return "from-amber-500/20 to-amber-500/5"
  return "from-red-500/20 to-red-500/5"
}

export function AuditReport({ result }: AuditReportProps) {
  const [showPromptLog, setShowPromptLog] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const { metrics, analysis, promptLog } = result

  // Calculate a simple score based on insights
  const statusScores = { good: 20, "needs work": 10, poor: 0 }
  const totalScore = analysis.insights.reduce(
    (acc, insight) => acc + (statusScores[insight.status] || 0),
    0
  )

  const handleDownloadPDF = async () => {
    setIsDownloading(true)
    try {
      await generatePDFReport(result)
    } catch (err) {
      console.error("PDF generation failed:", err)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto mt-10 animate-in fade-in slide-in-from-bottom-8 duration-700">

      {/* Score Header Card */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 md:p-8 mb-8">
        <div className={`absolute inset-0 bg-gradient-to-br ${getScoreGradient(totalScore)} pointer-events-none`} />

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${getScoreGradient(totalScore)} border border-border flex items-center justify-center`}>
              <TrendingUp className={`w-8 h-8 ${getScoreColor(totalScore)}`} />
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Overall Score</div>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-bold font-heading ${getScoreColor(totalScore)}`}>{totalScore}</span>
                <span className="text-lg text-muted-foreground font-heading">/100</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 bg-background/60 backdrop-blur-sm rounded-full px-4 py-2 border border-border">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-sm text-muted-foreground">Analysis complete</span>
            </div>

            <button
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className={`w-4 h-4 ${isDownloading ? 'animate-pulse' : ''}`} />
              <span>{isDownloading ? 'Generating...' : 'Download Report'}</span>
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="relative mt-6 pt-6 border-t border-border">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{analysis.summary}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN: Factual Metrics */}
        <div className="lg:col-span-4 space-y-6">

          {/* Metrics Section */}
          <div className="rounded-3xl border border-border bg-card p-6 overflow-hidden">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-base font-semibold font-heading">Page Metrics</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Word Count */}
              <div className="group relative rounded-2xl bg-muted/50 p-4 border border-transparent hover:border-border hover:bg-muted transition-all">
                <Type className="w-5 h-5 text-muted-foreground mb-3 group-hover:text-primary transition-colors" />
                <div className="text-2xl font-bold tracking-tight font-heading">{metrics.wordCount.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">Words</div>
              </div>

              {/* CTAs */}
              <div className="group relative rounded-2xl bg-muted/50 p-4 border border-transparent hover:border-border hover:bg-muted transition-all">
                <MousePointerClick className="w-5 h-5 text-muted-foreground mb-3 group-hover:text-primary transition-colors" />
                <div className="text-2xl font-bold tracking-tight font-heading">{metrics.ctaCount}</div>
                <div className="text-xs text-muted-foreground mt-1">Primary CTAs</div>
              </div>

              {/* Links */}
              <div className="group relative rounded-2xl bg-muted/50 p-4 border border-transparent hover:border-border hover:bg-muted transition-all">
                <LinkIcon className="w-5 h-5 text-muted-foreground mb-3 group-hover:text-primary transition-colors" />
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold tracking-tight font-heading">{metrics.links.internal}</span>
                  <span className="text-sm text-muted-foreground">/ {metrics.links.external}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Int / Ext Links</div>
              </div>

              {/* Images */}
              <div className="group relative rounded-2xl bg-muted/50 p-4 border border-transparent hover:border-border hover:bg-muted transition-all">
                <ImageIcon className="w-5 h-5 text-muted-foreground mb-3 group-hover:text-primary transition-colors" />
                <div className="text-2xl font-bold tracking-tight font-heading">{metrics.images.total}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Images
                  {metrics.images.missingAltPercent > 0 && (
                    <span className="text-amber-500 ml-1">({metrics.images.missingAltPercent}% no alt)</span>
                  )}
                </div>
              </div>

              {/* Headings - Full width */}
              <div className="col-span-2 group relative rounded-2xl bg-muted/50 p-4 border border-transparent hover:border-border hover:bg-muted transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Heading className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-xs text-muted-foreground">Headings</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <span className="text-lg font-bold block font-heading">{metrics.headings.h1}</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">H1</span>
                    </div>
                    <div className="text-center">
                      <span className="text-lg font-bold block font-heading">{metrics.headings.h2}</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">H2</span>
                    </div>
                    <div className="text-center">
                      <span className="text-lg font-bold block font-heading">{metrics.headings.h3}</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">H3</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Meta Data Card */}
          <div className="rounded-3xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="text-base font-semibold font-heading">Meta Information</h3>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl bg-muted/50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    metrics.meta.title.length >= 50 && metrics.meta.title.length <= 60
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}>
                    {metrics.meta.title.length} chars
                  </span>
                </div>
                <p className="text-sm font-medium break-words">{metrics.meta.title}</p>
              </div>

              <div className="rounded-xl bg-muted/50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    metrics.meta.description.length >= 150 && metrics.meta.description.length <= 160
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}>
                    {metrics.meta.description.length} chars
                  </span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3 break-words">{metrics.meta.description}</p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: AI Insights */}
        <div className="lg:col-span-8 space-y-6">

          {/* AI Insights Section */}
          <div className="rounded-3xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Search className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-semibold font-heading">AI Insights</h3>
                <p className="text-xs text-muted-foreground">{analysis.insights.length} areas analyzed</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {analysis.insights.map((insight, idx) => (
                <div
                  key={idx}
                  className="group relative rounded-2xl bg-muted/30 p-4 border border-transparent hover:border-border hover:bg-muted/50 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 shrink-0 h-8 w-8 rounded-lg flex items-center justify-center border ${getStatusStyle(insight.status)}`}>
                      {getStatusIcon(insight.status)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-sm mb-1 font-heading group-hover:text-primary transition-colors">
                        {insight.category}
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {insight.detail}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations Section */}
          <div className="rounded-3xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Lightbulb className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold font-heading">Recommendations</h3>
                <p className="text-xs text-muted-foreground">Prioritized action items</p>
              </div>
            </div>

            <div className="space-y-3">
              {analysis.recommendations.map((rec, idx) => {
                const style = getPriorityStyle(rec.priority)
                return (
                  <div
                    key={idx}
                    className="group relative flex items-start gap-4 p-4 rounded-2xl bg-muted/30 border border-transparent hover:border-border hover:bg-muted/50 transition-all overflow-hidden"
                  >
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${style.bar} rounded-l-2xl`} />
                    <div className="flex items-center gap-3 shrink-0">
                      <div className={`h-2 w-2 rounded-full ${style.dot}`} />
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${style.badge}`}>
                        {rec.priority}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-sm mb-1 font-heading group-hover:text-primary transition-colors">{rec.title}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">{rec.reason}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Prompt Log Section */}
      <div className="mt-8 mb-16">
        <button
          onClick={() => setShowPromptLog(!showPromptLog)}
          className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-full border border-border bg-card px-4 py-2 hover:bg-muted"
        >
          <FileText className="w-4 h-4" />
          <span>Prompt log / reasoning trace</span>
          <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showPromptLog ? 'rotate-180' : ''}`} />
        </button>

        {showPromptLog && (
          <div className="mt-4 rounded-3xl border border-border bg-card p-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="space-y-4">
              <div className="rounded-2xl bg-muted/50 p-4">
                <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Timestamp</div>
                <code className="text-xs font-mono">{promptLog.timestamp}</code>
              </div>

              <div className="rounded-2xl bg-muted/50 p-4">
                <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">System Prompt</div>
                <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto text-muted-foreground">{promptLog.systemPrompt}</pre>
              </div>

              <div className="rounded-2xl bg-muted/50 p-4">
                <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">User Prompt</div>
                <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto text-muted-foreground">{promptLog.userPrompt}</pre>
              </div>

              <div className="rounded-2xl bg-muted/50 p-4">
                <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Structured Input (Metrics Snapshot)</div>
                <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto text-muted-foreground">{JSON.stringify(promptLog.structuredInput, null, 2)}</pre>
              </div>

              <div className="rounded-2xl bg-muted/50 p-4">
                <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Raw Model Response</div>
                <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto text-muted-foreground">{promptLog.rawModelResponse}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
