"use client"

import { ArrowRight, ArrowLeft, Loader2, Search, AlertCircle, Moon, Sun } from "lucide-react"
import { useState, Suspense, lazy, useEffect, useRef } from "react"
import Image from "next/image"
import { AuditReport } from "./audit-report"
import { AuditResult } from "@/lib/types"
import { useTheme } from "@/components/theme-provider"

const Dithering = lazy(() =>
  import("@paper-design/shaders-react").then((mod) => ({ default: mod.Dithering }))
)

// Audit steps for the progress indicator - matches backend process
const AUDIT_STEPS = [
  { id: "connect", label: "Connecting to website", activeLabel: "Connecting to server...", detail: "Establishing HTTPS connection" },
  { id: "fetch", label: "Downloading page HTML", activeLabel: "Downloading HTML...", detail: "Fetching page content" },
  { id: "parse", label: "Parsing DOM structure", activeLabel: "Parsing HTML...", detail: "Loading into DOM parser" },
  { id: "extract", label: "Extracting metrics", activeLabel: "Extracting metrics...", detail: "Words, headings, CTAs, links, images" },
  { id: "meta", label: "Reading meta tags", activeLabel: "Reading meta...", detail: "Title, description, OG tags" },
  { id: "prepare", label: "Building AI prompt", activeLabel: "Preparing analysis...", detail: "Formatting data for AI" },
  { id: "ai", label: "AI analyzing content", activeLabel: "AI analyzing...", detail: "Groq API → openai/gpt-oss-120b" },
  { id: "complete", label: "Generating report", activeLabel: "Building report...", detail: "Structuring insights & recommendations" },
]

export function CTASection() {
  const { theme, toggleTheme, mounted } = useTheme()
  const [isHovered, setIsHovered] = useState(false)
  const [isStarted, setIsStarted] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [url, setUrl] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (stepIntervalRef.current) {
        clearInterval(stepIntervalRef.current)
      }
    }
  }, [])

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url) return

    let targetUrl = url.trim()
    const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,})([\/\w \.-]*)*\/?$/i;
    
    if (!urlPattern.test(targetUrl) && !targetUrl.includes("localhost")) {
      setError("Please enter a valid website URL (e.g., example.com)")
      return;
    }

    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = "https://" + targetUrl
    }

    setError(null)
    setAuditResult(null)
    setIsVerifying(true)

    try {
      const verifyRes = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      })
      const verifyData = await verifyRes.json()
      
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || "Failed to reach website")
      }
    } catch (err) {
      setIsVerifying(false)
      setError(err instanceof Error ? err.message : "Website does not exist or is unreachable")
      return;
    }

    setIsVerifying(false)
    setIsAnalyzing(true)
    setCurrentStep(0)

    // Animate through steps while waiting for API
    stepIntervalRef.current = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < AUDIT_STEPS.length - 1) return prev + 1
        return prev
      })
    }, 800)

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze URL")
      }

      setAuditResult(data)
      setShowReport(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setIsAnalyzing(false)
      if (stepIntervalRef.current) {
        clearInterval(stepIntervalRef.current)
        stepIntervalRef.current = null
      }
    }
  }

  const handleNewAudit = () => {
    setShowReport(false)
    setAuditResult(null)
    setUrl("")
    setIsStarted(false)
    setError(null)
    setCurrentStep(0)
  }

  return (
    <section className="py-6 w-full flex flex-col items-center px-4 md:px-6">
      {/* Header with Logo and Theme Toggle */}
      <header className="w-full max-w-7xl flex items-center justify-between mb-6">
        <div className="flex items-center h-8">
          {mounted && (
            <Image
              src={theme === "dark" ? "/pagelense_white.png" : "/pagelense_black.png"}
              alt="PageLense"
              width={140}
              height={36}
              className="h-8 w-auto"
              priority
            />
          )}
        </div>
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-full border border-border bg-card hover:bg-muted transition-colors"
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          {mounted && (theme === "dark" ? (
            <Sun className="w-5 h-5 text-foreground" />
          ) : (
            <Moon className="w-5 h-5 text-foreground" />
          ))}
          {!mounted && <div className="w-5 h-5" />}
        </button>
      </header>

      <div
        className={`w-full relative transition-all duration-700 ${showReport ? 'max-w-7xl' : 'max-w-7xl'}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className={`relative overflow-hidden rounded-[48px] border border-border bg-card shadow-sm flex flex-col items-center justify-center transition-all duration-700 ease-in-out ${showReport ? 'min-h-37.5 p-8' : 'min-h-150'}`}>
          <Suspense fallback={<div className="absolute inset-0 bg-muted/20" />}>
            <div className={`absolute inset-0 z-0 pointer-events-none opacity-40 dark:opacity-30 mix-blend-multiply dark:mix-blend-screen transition-opacity duration-1000 ${showReport ? 'opacity-10' : ''}`}>
              <Dithering
                colorBack="#00000000"
                colorFront="#EC4E02"
                shape="warp"
                type="4x4"
                speed={isHovered || isAnalyzing ? 0.6 : 0.2}
                className="size-full"
                minPixelRatio={1}
              />
            </div>
          </Suspense>

          {!showReport && (
            <div className="relative z-10 px-6 w-full max-w-4xl mx-auto text-center flex flex-col items-center">

              <div className={`transition-all duration-700 ease-in-out flex flex-col items-center ${isStarted ? 'opacity-0 -translate-y-8 pointer-events-none absolute' : 'opacity-100 translate-y-0 relative'}`}>
                {/* Headline */}
                <h2 className="font-heading text-5xl md:text-7xl lg:text-7xl font-bold tracking-tight text-foreground mb-8 leading-[1.05]">
                  Evaluate performance, <br />
                  <span className="text-foreground/80 font-medium">instantly.</span>
                </h2>

                {/* Description */}
                <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mb-12 leading-relaxed">
                  Extract key metrics and use AI to generate structured insights and recommendations for your marketing websites.
                </p>

                {/* Button */}
                <button
                  onClick={() => setIsStarted(true)}
                  className="group relative inline-flex h-14 items-center justify-center gap-3 overflow-hidden rounded-full bg-primary px-12 text-base font-medium text-primary-foreground transition-all duration-300 hover:bg-primary/90 hover:scale-105 active:scale-95 hover:ring-4 hover:ring-primary/20"
                >
                  <span className="relative z-10">Start Audit</span>
                  <ArrowRight className="h-5 w-5 relative z-10 transition-transform duration-300 group-hover:translate-x-1" />
                </button>
              </div>

              {/* URL Input */}
              <div className={`w-full max-w-2xl transition-all duration-700 ease-in-out flex flex-col items-center
                ${isStarted && !isAnalyzing ? 'opacity-100 translate-y-0 relative delay-300' :
                  isAnalyzing ? 'opacity-100 -translate-y-8 relative' :
                    'opacity-0 translate-y-8 pointer-events-none absolute'}`}>

                {/* Back button */}
                {!isAnalyzing && !isVerifying && (
                  <button
                    onClick={() => setIsStarted(false)}
                    className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                )}

                <form onSubmit={handleAnalyze} className="relative group rounded-full w-full bg-background/80 backdrop-blur-md overflow-hidden before:absolute before:w-16 before:h-16 before:content[''] before:right-0 before:bg-primary/30 before:rounded-full before:blur-xl before:[box-shadow:-60px_20px_10px_10px_rgba(236,78,2,0.15)] dark:before:[box-shadow:-60px_20px_10px_10px_rgba(236,78,2,0.15)] border border-border shadow-xl z-20">
                  <div className="flex items-center w-full px-2 py-2">
                    <div className="pl-4 pr-2 text-muted-foreground">
                      <Search className="w-5 h-5" />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="https://example.com"
                      className="peer relative flex-1 text-foreground bg-transparent ring-0 outline-none text-base placeholder-muted-foreground block w-full py-3"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      disabled={isAnalyzing || isVerifying}
                    />
                    <button
                      type="submit"
                      disabled={isAnalyzing || isVerifying}
                      className="ml-2 mr-1 shrink-0 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-full hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-80 flex items-center gap-2 relative z-30"
                    >
                      {isAnalyzing || isVerifying ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="hidden sm:inline">
                            {isVerifying ? "Verifying..." : "Scanning..."}
                          </span>
                        </>
                      ) : (
                        <>
                          Analyze
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Error Message */}
                {error && (
                  <div className="mt-4 flex items-center gap-2 text-red-500 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 w-full">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              {/* Progress Steps during analysis */}
              <div className={`w-full max-w-2xl mt-6 transition-all duration-700 ease-in-out z-10
                ${isAnalyzing ? 'opacity-100 translate-y-0 relative' :
                  'opacity-0 translate-y-8 absolute pointer-events-none'}`}>
                <div className="bg-background/80 backdrop-blur-md rounded-2xl border border-border p-5">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Backend Process</span>
                  </div>
                  <div className="space-y-2">
                    {AUDIT_STEPS.map((step, idx) => (
                      <div
                        key={step.id}
                        className={`flex items-center gap-3 py-1.5 transition-all duration-300 ${idx <= currentStep ? 'opacity-100' : 'opacity-30'}`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all shrink-0 ${idx < currentStep
                            ? 'bg-emerald-500 text-white scale-90'
                            : idx === currentStep
                              ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                          {idx < currentStep ? '✓' : idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm ${idx === currentStep ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                            {idx === currentStep ? step.activeLabel : step.label}
                          </div>
                          {idx === currentStep && (
                            <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                              {step.detail}
                            </div>
                          )}
                        </div>
                        {idx === currentStep && (
                          <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                        )}
                        {idx < currentStep && (
                          <span className="text-xs text-emerald-500 font-medium shrink-0">Done</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Collapsed Header when showing report */}
          {showReport && (
            <div className="relative z-10 w-full flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary">
                  <Search className="w-5 h-5 shrink-0" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Target URL</div>
                  <div className="font-semibold truncate max-w-[150px] sm:max-w-xs md:max-w-md">{auditResult?.metrics.url}</div>
                </div>
              </div>
              <button
                onClick={handleNewAudit}
                className="shrink-0 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border border-border rounded-full px-4 py-2 hover:bg-muted"
              >
                New Audit
              </button>
            </div>
          )}

        </div>

        {/* Dynamic Report Section */}
        {showReport && auditResult && (
          <AuditReport result={auditResult} />
        )}
      </div>
    </section>
  )
}
