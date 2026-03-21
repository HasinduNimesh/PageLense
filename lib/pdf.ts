import { AuditResult, InsightStatus, Priority } from "./types";

// ─── Color palette matching PageLense UI ─────────────────────────────────────
const COLORS = {
  black:      [15, 15, 15]   as [number, number, number],
  white:      [255, 255, 255] as [number, number, number],
  peach:      [201, 132, 106] as [number, number, number],
  bgLight:    [253, 248, 245] as [number, number, number],
  border:     [226, 213, 207] as [number, number, number],
  muted:      [168, 152, 144] as [number, number, number],
  textSecond: [122, 110, 104] as [number, number, number],
  good:       [59, 109, 17]   as [number, number, number],
  goodBg:     [234, 243, 222] as [number, number, number],
  warn:       [133, 79, 11]   as [number, number, number],
  warnBg:     [250, 238, 218] as [number, number, number],
  poor:       [163, 45, 45]   as [number, number, number],
  poorBg:     [252, 235, 235] as [number, number, number],
  highBg:     [252, 235, 235] as [number, number, number],
  medBg:      [250, 238, 218] as [number, number, number],
  lowBg:      [234, 243, 222] as [number, number, number],
};

const statusColor = (status: InsightStatus): [number, number, number] => {
  if (status === "good") return COLORS.good;
  if (status === "needs work") return COLORS.warn;
  return COLORS.poor;
};

const statusBg = (status: InsightStatus): [number, number, number] => {
  if (status === "good") return COLORS.goodBg;
  if (status === "needs work") return COLORS.warnBg;
  return COLORS.poorBg;
};

const priorityColor = (p: Priority): [number, number, number] => {
  if (p === "High") return COLORS.poor;
  if (p === "Medium") return COLORS.warn;
  return COLORS.good;
};

const priorityBg = (p: Priority): [number, number, number] => {
  if (p === "High") return COLORS.highBg;
  if (p === "Medium") return COLORS.medBg;
  return COLORS.lowBg;
};

// ─── Main generator ───────────────────────────────────────────────────────────
export async function generatePDFReport(result: AuditResult): Promise<void> {
  // Dynamically import jsPDF to avoid SSR issues
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();   // 595
  const H = doc.internal.pageSize.getHeight();  // 842
  const MARGIN = 40;
  const CONTENT_W = W - MARGIN * 2;

  const { metrics: m, analysis: a } = result;

  let y = MARGIN;

  // ─── Load logo image ───────────────────────────────────────────────────────
  let logoDataUrl: string | null = null;
  try {
    const response = await fetch("/pagelense_black.png");
    const blob = await response.blob();
    logoDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    console.warn("Could not load logo, using text fallback");
  }

  // ─── Load Cabinet Grotesk fonts ────────────────────────────────────────────
  try {
    // Load Regular weight
    const regularRes = await fetch("/fonts/CabinetGrotesk-Regular.ttf");
    const regularBlob = await regularRes.blob();
    const regularBase64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]); // Remove data:... prefix
      };
      reader.readAsDataURL(regularBlob);
    });

    // Load Bold weight
    const boldRes = await fetch("/fonts/CabinetGrotesk-Bold.ttf");
    const boldBlob = await boldRes.blob();
    const boldBase64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.readAsDataURL(boldBlob);
    });

    // Add fonts to jsPDF
    doc.addFileToVFS("CabinetGrotesk-Regular.ttf", regularBase64);
    doc.addFont("CabinetGrotesk-Regular.ttf", "CabinetGrotesk", "normal");

    doc.addFileToVFS("CabinetGrotesk-Bold.ttf", boldBase64);
    doc.addFont("CabinetGrotesk-Bold.ttf", "CabinetGrotesk", "bold");

    // Set as default font
    doc.setFont("CabinetGrotesk", "normal");
  } catch {
    console.warn("Could not load Cabinet Grotesk font, using Helvetica fallback");
  }

  // ─── Helper functions ──────────────────────────────────────────────────────
  const newPageIfNeeded = (needed: number) => {
    if (y + needed > H - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const sectionLabel = (text: string) => {
    newPageIfNeeded(30);
    doc.setFontSize(8);
    doc.setFont("CabinetGrotesk", "normal");
    doc.setTextColor(...COLORS.muted);
    doc.text(text.toUpperCase(), MARGIN, y);
    y += 16;
  };

  const divider = () => {
    newPageIfNeeded(16);
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y, W - MARGIN, y);
    y += 12;
  };

  const wrapText = (text: string, maxWidth: number, fontSize: number): string[] => {
    doc.setFontSize(fontSize);
    return doc.splitTextToSize(text, maxWidth);
  };

  // ─── HEADER ───────────────────────────────────────────────────────────────
  // Background strip
  doc.setFillColor(...COLORS.bgLight);
  doc.rect(0, 0, W, 80, "F");

  // Dot texture (decorative)
  doc.setFillColor(...COLORS.peach);
  for (let xi = 0; xi < W; xi += 10) {
    for (let yi = 0; yi < 80; yi += 10) {
      doc.circle(xi, yi, 0.8, "F");
    }
  }

  // Logo - use PNG image or fallback to text
  doc.setFillColor(...COLORS.white);
  doc.rect(MARGIN - 8, 16, 220, 40, "F");

  if (logoDataUrl) {
    // Add PNG logo image (original is 1125x151, maintain aspect ratio)
    // 1125:151 = ~7.45:1 aspect ratio
    const logoW = 180;
    const logoH = logoW * (151 / 1125); // ~24
    doc.addImage(logoDataUrl, "PNG", MARGIN, 24, logoW, logoH);
  } else {
    // Fallback to text if image fails to load
    doc.setFontSize(22);
    doc.setFont("CabinetGrotesk", "bold");
    doc.setTextColor(...COLORS.black);
    doc.text("PageLense", MARGIN, 44);
    doc.setFillColor(...COLORS.peach);
    doc.circle(MARGIN + 95, 40, 3, "F");
  }

  // Generated date
  doc.setFontSize(8);
  doc.setFont("CabinetGrotesk", "normal");
  doc.setTextColor(...COLORS.textSecond);
  doc.text(`Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, W - MARGIN, 44, { align: "right" });

  y = 96;

  // ─── URL + SCORE BANNER ───────────────────────────────────────────────────
  doc.setFillColor(...COLORS.bgLight);
  doc.roundedRect(MARGIN, y, CONTENT_W, 56, 8, 8, "F");
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.5);
  doc.roundedRect(MARGIN, y, CONTENT_W, 56, 8, 8, "S");

  // URL
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text("TARGET URL", MARGIN + 14, y + 16);
  doc.setFontSize(11);
  doc.setFont("CabinetGrotesk", "bold");
  doc.setTextColor(...COLORS.peach);
  doc.text(m.url, MARGIN + 14, y + 32);

  // Score badge
  const score = a.insights.reduce((acc, i) => acc + (i.status === "good" ? 20 : i.status === "needs work" ? 10 : 0), 0);
  const scoreColor = score >= 70 ? COLORS.good : score >= 40 ? COLORS.warn : COLORS.poor;
  doc.setFontSize(8);
  doc.setFont("CabinetGrotesk", "normal");
  doc.setTextColor(...COLORS.muted);
  doc.text("OVERALL SCORE", W - MARGIN - 80, y + 16);
  doc.setFontSize(26);
  doc.setFont("CabinetGrotesk", "bold");
  doc.setTextColor(...scoreColor);
  doc.text(`${score}`, W - MARGIN - 80, y + 40);
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.muted);
  doc.text("/100", W - MARGIN - 40, y + 40);

  y += 72;

  // ─── AI SUMMARY ───────────────────────────────────────────────────────────
  sectionLabel("AI summary");
  const summaryLines = wrapText(a.summary, CONTENT_W - 28, 10);
  const summaryH = summaryLines.length * 14 + 20;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(MARGIN, y, CONTENT_W, summaryH, 6, 6, "F");
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(MARGIN, y, CONTENT_W, summaryH, 6, 6, "S");
  doc.setFontSize(10);
  doc.setFont("CabinetGrotesk", "normal");
  doc.setTextColor(...COLORS.textSecond);
  doc.text(summaryLines, MARGIN + 14, y + 14);
  y += summaryH + 16;

  // ─── FACTUAL METRICS ──────────────────────────────────────────────────────
  sectionLabel("Factual metrics");

  const metrics = [
    { label: "Word count",     value: m.wordCount.toLocaleString(), sub: "words" },
    { label: "H1 / H2 / H3",  value: `${m.headings.h1} / ${m.headings.h2} / ${m.headings.h3}`, sub: "headings" },
    { label: "CTAs",           value: String(m.ctaCount), sub: "action links" },
    { label: "Internal links", value: String(m.links.internal), sub: "links" },
    { label: "External links", value: String(m.links.external), sub: "links" },
    { label: "Images",         value: String(m.images.total), sub: "total" },
    { label: "Missing alt",    value: `${m.images.missingAltPercent}%`, sub: `${m.images.missingAlt} of ${m.images.total}` },
    { label: "Meta title",     value: `${m.meta.title.length} chars`, sub: "ideal: 50-60" },
  ];

  const CARD_W = (CONTENT_W - 12) / 4;
  const CARD_H = 56;

  metrics.forEach((metric, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const cx = MARGIN + col * (CARD_W + 4);
    const cy = y + row * (CARD_H + 6);

    if (i === 0) newPageIfNeeded(CARD_H * 2 + 20);

    doc.setFillColor(...COLORS.bgLight);
    doc.roundedRect(cx, cy, CARD_W, CARD_H, 6, 6, "F");
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(cx, cy, CARD_W, CARD_H, 6, 6, "S");

    doc.setFontSize(8);
    doc.setFont("CabinetGrotesk", "normal");
    doc.setTextColor(...COLORS.muted);
    doc.text(metric.label, cx + 10, cy + 14);

    doc.setFontSize(16);
    doc.setFont("CabinetGrotesk", "bold");
    doc.setTextColor(...COLORS.black);
    doc.text(metric.value, cx + 10, cy + 34);

    doc.setFontSize(8);
    doc.setFont("CabinetGrotesk", "normal");
    doc.setTextColor(...COLORS.muted);
    doc.text(metric.sub, cx + 10, cy + 47);
  });

  y += Math.ceil(metrics.length / 4) * (CARD_H + 6) + 8;

  // Meta tags box
  newPageIfNeeded(80);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(MARGIN, y, CONTENT_W, 72, 6, 6, "F");
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(MARGIN, y, CONTENT_W, 72, 6, 6, "S");

  doc.setFontSize(8);
  doc.setFont("CabinetGrotesk", "normal");
  doc.setTextColor(...COLORS.muted);
  doc.text("META TITLE", MARGIN + 14, y + 14);
  doc.setFontSize(9);
  doc.setFont("CabinetGrotesk", "bold");
  doc.setTextColor(...COLORS.black);
  const titleLines = wrapText(m.meta.title, CONTENT_W - 120, 9);
  doc.text(titleLines[0] || "(not found)", MARGIN + 14, y + 26);

  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.5);
  doc.line(MARGIN + 14, y + 36, W - MARGIN - 14, y + 36);

  doc.setFontSize(8);
  doc.setFont("CabinetGrotesk", "normal");
  doc.setTextColor(...COLORS.muted);
  doc.text("META DESCRIPTION", MARGIN + 14, y + 48);
  doc.setFontSize(9);
  doc.setFont("CabinetGrotesk", "bold");
  doc.setTextColor(...COLORS.black);
  const descLines = wrapText(m.meta.description, CONTENT_W - 28, 9);
  doc.text(descLines[0] || "(not found)", MARGIN + 14, y + 60);

  y += 86;
  divider();

  // ─── AI INSIGHTS ──────────────────────────────────────────────────────────
  sectionLabel("AI insights");

  const INS_W = (CONTENT_W - 8) / 2;

  a.insights.forEach((insight, i) => {
    const col = i % 2;
    const isLeft = col === 0;

    if (isLeft) newPageIfNeeded(90);

    const ix = MARGIN + col * (INS_W + 8);
    const iy = isLeft ? y : y;

    const detailLines = wrapText(insight.detail, INS_W - 28, 9);
    const cardH = Math.max(76, detailLines.length * 12 + 44);

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(ix, iy, INS_W, cardH, 6, 6, "F");
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(ix, iy, INS_W, cardH, 6, 6, "S");

    // Status badge
    const badgeW = insight.status === "needs work" ? 60 : 36;
    doc.setFillColor(...statusBg(insight.status));
    doc.roundedRect(ix + INS_W - badgeW - 10, iy + 10, badgeW, 16, 4, 4, "F");
    doc.setFontSize(7);
    doc.setFont("CabinetGrotesk", "bold");
    doc.setTextColor(...statusColor(insight.status));
    doc.text(insight.status, ix + INS_W - badgeW - 10 + badgeW / 2, iy + 21, { align: "center" });

    // Category title
    doc.setFontSize(10);
    doc.setFont("CabinetGrotesk", "bold");
    doc.setTextColor(...COLORS.black);
    doc.text(insight.category, ix + 10, iy + 22);

    // Detail text
    doc.setFontSize(9);
    doc.setFont("CabinetGrotesk", "normal");
    doc.setTextColor(...COLORS.textSecond);
    doc.text(detailLines, ix + 10, iy + 38);

    if (col === 1 || i === a.insights.length - 1) {
      y += cardH + 8;
    }
  });

  divider();

  // ─── RECOMMENDATIONS ──────────────────────────────────────────────────────
  sectionLabel("Prioritized recommendations");

  a.recommendations.forEach((rec, i) => {
    const reasonLines = wrapText(rec.reason, CONTENT_W - 100, 9);
    const recH = Math.max(52, reasonLines.length * 12 + 32);

    newPageIfNeeded(recH + 8);

    doc.setFillColor(i % 2 === 0 ? COLORS.bgLight[0] : 255, i % 2 === 0 ? COLORS.bgLight[1] : 255, i % 2 === 0 ? COLORS.bgLight[2] : 255);
    doc.roundedRect(MARGIN, y, CONTENT_W, recH, 6, 6, "F");
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(MARGIN, y, CONTENT_W, recH, 6, 6, "S");

    // Priority badge
    const pW = rec.priority === "Medium" ? 46 : 36;
    doc.setFillColor(...priorityBg(rec.priority));
    doc.roundedRect(MARGIN + 10, y + recH / 2 - 9, pW, 18, 4, 4, "F");
    doc.setFontSize(7);
    doc.setFont("CabinetGrotesk", "bold");
    doc.setTextColor(...priorityColor(rec.priority));
    doc.text(rec.priority, MARGIN + 10 + pW / 2, y + recH / 2 + 2, { align: "center" });

    // Number
    doc.setFontSize(9);
    doc.setFont("CabinetGrotesk", "bold");
    doc.setTextColor(...COLORS.muted);
    doc.text(`${i + 1}`, MARGIN + pW + 18, y + 18);

    // Title
    doc.setFontSize(11);
    doc.setFont("CabinetGrotesk", "bold");
    doc.setTextColor(...COLORS.black);
    doc.text(rec.title, MARGIN + pW + 30, y + 18);

    // Reason
    doc.setFontSize(9);
    doc.setFont("CabinetGrotesk", "normal");
    doc.setTextColor(...COLORS.textSecond);
    doc.text(reasonLines, MARGIN + pW + 30, y + 32);

    y += recH + 6;
  });

  // ─── FOOTER ───────────────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setFont("CabinetGrotesk", "normal");
    doc.setTextColor(...COLORS.muted);
    doc.text(`PageLense — AI Website Audit`, MARGIN, H - 20);

    // Add "Developed by" text and clickable link
    const builtByText = "Developed by ";
    const linkText = "Hasindu Nimesh";
    const builtByWidth = doc.getTextWidth(builtByText);
    const linkWidth = doc.getTextWidth(linkText);
    const totalWidth = builtByWidth + linkWidth;
    const startX = (W - totalWidth) / 2;

    doc.text(builtByText, startX, H - 20);
    doc.setTextColor(...COLORS.peach);
    doc.textWithLink(linkText, startX + builtByWidth, H - 20, { url: "https://hasindu.me" });
    doc.setTextColor(...COLORS.muted);

    doc.text(`Page ${p} of ${totalPages}`, W - MARGIN, H - 20, { align: "right" });
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, H - 30, W - MARGIN, H - 30);
  }

  // ─── Save ──────────────────────────────────────────────────────────────────
  const filename = `pagelense-audit-${new URL(m.url).hostname}-${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(filename);
}
