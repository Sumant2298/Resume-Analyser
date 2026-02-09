"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PDFDocument, StandardFonts } from "pdf-lib";

type Analysis = {
  matchScore?: number;
  summary?: string;
  gapAnalysis?: string[];
  improvements?: string[];
  suggestions?: string[];
  bulletRewrites?: string[];
  atsNotes?: string[];
  compensationFit?: number | null;
  compensationNotes?: string[];
  overallScore?: number | null;
  keyCategories?: string[];
  matchedCategories?: string[];
  missingCategories?: string[];
  bonusCategories?: string[];
  keywordMatches?: string[];
  missingKeywords?: string[];
  raw?: string;
};

type Meta = {
  cvChars: number;
  jdChars: number;
};

type Payload = {
  analysis: Analysis;
  meta: Meta;
};

const STORAGE_KEY = "resume_analysis_payload";

const formatCategory = (category: string) =>
  category
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getMatchLabel = (score: number) => {
  if (score >= 80) return "Good Match";
  if (score >= 60) return "Moderate Match";
  if (score >= 40) return "Partial Match";
  return "Low Match";
};

const buildMarkdown = (analysis: Analysis, meta?: Meta) => {
  const lines = [
    "# Resume Analyser Report",
    "",
    `Overall Score: ${
      analysis.overallScore === null || analysis.overallScore === undefined
        ? "N/A"
        : `${analysis.overallScore}%`
    }`,
    `Match Score: ${analysis.matchScore ?? "N/A"}%`,
    `Compensation Fit: ${
      analysis.compensationFit === null || analysis.compensationFit === undefined
        ? "N/A"
        : `${analysis.compensationFit}%`
    }`,
    analysis.summary ? `Summary: ${analysis.summary}` : "",
    "",
    meta ? `Resume chars: ${meta.cvChars} | JD chars: ${meta.jdChars}` : "",
    "",
    "## Key Skill Categories",
    ...(analysis.keyCategories || []).map((item) => `- ${item}`),
    "",
    "## Matched Categories",
    ...(analysis.matchedCategories || []).map((item) => `- ${item}`),
    "",
    "## Missing Categories",
    ...(analysis.missingCategories || []).map((item) => `- ${item}`),
    "",
    "## Bonus Categories",
    ...(analysis.bonusCategories || []).map((item) => `- ${item}`),
    "",
    "## Improvement Suggestions",
    ...(analysis.suggestions || analysis.improvements || []).map(
      (item) => `- ${item}`
    ),
    "",
    "## Bullet Rewrites",
    ...(analysis.bulletRewrites || []).map((item) => `- ${item}`),
    "",
    "## ATS Notes",
    ...(analysis.atsNotes || []).map((item) => `- ${item}`)
  ];

  return lines.filter(Boolean).join("\n");
};

const MatchCircle = ({ score }: { score: number }) => {
  return (
    <div className="flex h-44 w-44 flex-col items-center justify-center rounded-full bg-[#FFF6BF] shadow-inner">
      <p className="text-4xl font-semibold text-amber-700">{score}%</p>
      <p className="mt-1 text-sm font-semibold text-amber-700">
        {getMatchLabel(score)}
      </p>
    </div>
  );
};

const StatCard = ({
  value,
  label,
  accent,
  icon,
  muted
}: {
  value: string;
  label: string;
  accent: string;
  icon: JSX.Element;
  muted?: boolean;
}) => (
  <div className={`rounded-2xl ${accent} px-6 py-5 text-center`}>
    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow">
      {icon}
    </div>
    <p
      className={`text-2xl font-semibold ${
        muted ? "text-slate-400" : "text-slate-900"
      }`}
    >
      {value}
    </p>
    <p className="text-xs text-slate-600">{label}</p>
  </div>
);

const Chip = ({ label, tone }: { label: string; tone: string }) => (
  <span className={`rounded-full px-3 py-1 text-xs font-medium ${tone}`}>
    {label}
  </span>
);

const TargetIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 text-blue-600" fill="none">
    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
);

const BriefcaseIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 text-purple-600" fill="none">
    <path
      d="M9 7V6a3 3 0 0 1 6 0v1"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <rect
      x="4"
      y="7"
      width="16"
      height="12"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M4 12h16"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const BookIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 text-indigo-600" fill="none">
    <path
      d="M5 5.5C5 4.1 6.1 3 7.5 3H20v16H7.5C6.1 19 5 17.9 5 16.5V5.5Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M5 6h11"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const BadgeIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 text-emerald-600" fill="none">
    <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
    <path
      d="M8.5 13.5 7 21l5-3 5 3-1.5-7.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function ResultsPage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setError("No analysis data found. Start a new analysis.");
      return;
    }

    try {
      const payload = JSON.parse(stored) as Payload;
      setAnalysis(payload.analysis);
      setMeta(payload.meta);
    } catch {
      setError("Unable to read analysis data. Please run a new analysis.");
    }
  }, []);

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    router.push("/");
  };

  const keyCategories = analysis?.keyCategories || [];
  const matchedCategories = analysis?.matchedCategories || [];
  const missingCategories = analysis?.missingCategories || [];
  const bonusCategories = analysis?.bonusCategories || [];
  const keywordMatches = analysis?.keywordMatches || [];
  const missingKeywords = analysis?.missingKeywords || [];

  const suggestions = useMemo(() => {
    if (!analysis) return [];
    return analysis.suggestions?.length
      ? analysis.suggestions
      : analysis.improvements || [];
  }, [analysis]);

  const matchScore = Math.max(0, Math.min(100, analysis?.matchScore ?? 0));
  const keywordTotal = keywordMatches.length + missingKeywords.length;
  const keywordScore =
    keywordTotal > 0
      ? Math.round((keywordMatches.length / keywordTotal) * 100)
      : null;

  const strengths = useMemo(() => {
    if (matchedCategories.length === 0) return ["No strong skill alignment yet."];
    return [
      `Strong skill alignment with ${matchedCategories
        .slice(0, 3)
        .map(formatCategory)
        .join(", ")}.`,
      `Matched ${matchedCategories.length} of ${keyCategories.length} key categories.`
    ];
  }, [matchedCategories, keyCategories.length]);

  const improvements = useMemo(() => {
    if (missingCategories.length === 0) {
      return ["Minor areas for improvement."];
    }
    return [
      `Missing ${missingCategories.length} key categories: ${missingCategories
        .slice(0, 3)
        .map(formatCategory)
        .join(", ")}.`
    ];
  }, [missingCategories]);

  const downloadReport = () => {
    if (!analysis) return;
    const content = buildMarkdown(analysis, meta || undefined);
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "resume-analysis-report.md";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadReportPdf = async () => {
    if (!analysis) return;
    const content = buildMarkdown(analysis, meta || undefined);
    const pdfDoc = await PDFDocument.create();
    const pageSize: [number, number] = [612, 792];
    let page = pdfDoc.addPage(pageSize);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 11;
    const lineHeight = 16;
    const margin = 48;
    const maxWidth = page.getWidth() - margin * 2;

    const wrapText = (text: string) => {
      const lines: string[] = [];
      for (const paragraph of text.split("\n")) {
        if (!paragraph.trim()) {
          lines.push("");
          continue;
        }
        let line = "";
        for (const word of paragraph.split(" ")) {
          const testLine = line ? `${line} ${word}` : word;
          const width = font.widthOfTextAtSize(testLine, fontSize);
          if (width > maxWidth) {
            if (line) lines.push(line);
            line = word;
          } else {
            line = testLine;
          }
        }
        if (line) lines.push(line);
      }
      return lines;
    };

    const lines = wrapText(content);
    let y = page.getHeight() - margin;

    for (const line of lines) {
      if (y < margin + lineHeight) {
        page = pdfDoc.addPage(pageSize);
        y = page.getHeight() - margin;
      }

      if (line) {
        page.drawText(line, { x: margin, y, size: fontSize, font });
      }

      y -= line ? lineHeight : lineHeight * 0.7;
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([new Uint8Array(pdfBytes)], {
      type: "application/pdf"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "resume-analysis-report.pdf";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <div className="min-h-screen px-6 pb-16 pt-16 sm:px-10">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 text-center shadow-lg">
          <h1 className="font-display text-3xl">No analysis found</h1>
          <p className="mt-3 text-sm text-slate-600">{error}</p>
          <button
            onClick={handleReset}
            className="mt-6 rounded-full bg-blue-600 px-5 py-2 text-sm text-white"
          >
            Start a new analysis
          </button>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen px-6 pb-16 pt-16 sm:px-10">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 text-center shadow-lg">
          <p className="text-sm text-slate-600">Loading your analysis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 pb-16 pt-12 sm:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <section className="soft-card px-8 py-10">
          <div className="text-center">
            <h1 className="font-display text-3xl font-semibold text-slate-900">
              Analysis Complete
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Here&apos;s how well your CV matches the job description
            </p>
          </div>

          <div className="mt-8 flex justify-center">
            <MatchCircle score={matchScore} />
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <StatCard
              value={`${matchScore}%`}
              label="Skills Match"
              accent="bg-blue-50"
              icon={<TargetIcon />}
            />
            <StatCard
              value="--"
              label="Experience"
              accent="bg-purple-50"
              icon={<BriefcaseIcon />}
              muted
            />
            <StatCard
              value={keywordScore === null ? "--" : `${keywordScore}%`}
              label="Keywords"
              accent="bg-indigo-50"
              icon={<BookIcon />}
              muted={keywordScore === null}
            />
            <StatCard
              value="--"
              label="Education"
              accent="bg-emerald-50"
              icon={<BadgeIcon />}
              muted
            />
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="soft-card p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                ✓
              </span>
              <h2 className="text-xl font-semibold text-slate-900">Strengths</h2>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              {strengths.map((item, index) => (
                <li key={`strength-${index}`} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="soft-card p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                ⚠
              </span>
              <h2 className="text-xl font-semibold text-slate-900">
                Areas for Improvement
              </h2>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              {improvements.map((item, index) => (
                <li key={`improve-${index}`} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                    !
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="soft-card p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                ✓
              </span>
              <h2 className="text-xl font-semibold text-slate-900">
                Matched Skills ({matchedCategories.length})
              </h2>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {matchedCategories.length === 0 && (
                <p className="text-sm text-slate-500">
                  No matching skills detected.
                </p>
              )}
              {matchedCategories.map((category) => (
                <Chip
                  key={`match-${category}`}
                  label={formatCategory(category)}
                  tone="bg-emerald-100 text-emerald-700"
                />
              ))}
            </div>
          </div>
          <div className="soft-card p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                ✕
              </span>
              <h2 className="text-xl font-semibold text-slate-900">
                Missing Skills ({missingCategories.length})
              </h2>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {missingCategories.length === 0 && (
                <p className="text-sm text-slate-500">
                  No missing skills — great job!
                </p>
              )}
              {missingCategories.map((category) => (
                <Chip
                  key={`missing-${category}`}
                  label={formatCategory(category)}
                  tone="bg-rose-100 text-rose-700"
                />
              ))}
            </div>
          </div>
        </section>

        <section className="soft-card p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              +
            </span>
            <h2 className="text-xl font-semibold text-slate-900">
              Bonus Skills ({bonusCategories.length})
            </h2>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {bonusCategories.length === 0 && (
              <p className="text-sm text-slate-500">
                No bonus skills detected yet.
              </p>
            )}
            {bonusCategories.map((category) => (
              <Chip
                key={`bonus-${category}`}
                label={formatCategory(category)}
                tone="bg-sky-100 text-sky-700"
              />
            ))}
          </div>
        </section>

        <section className="soft-card p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              🧳
            </span>
            <h2 className="text-xl font-semibold text-slate-900">
              Experience Analysis
            </h2>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Required Experience</p>
              <p className="text-sm font-semibold text-slate-900">Not specified</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Your Experience</p>
              <p className="text-sm font-semibold text-slate-900">Not specified</p>
            </div>
          </div>
          <div
            className={`mt-4 rounded-2xl p-4 text-sm ${
              missingCategories.length === 0
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {missingCategories.length === 0
              ? "Your experience meets the job requirements"
              : "Highlight projects that cover the missing categories"}
          </div>
        </section>

        <section className="rounded-3xl bg-[#2F5BFF] px-6 py-5 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
              💡
            </span>
            <h2 className="text-xl font-semibold">Recommendations</h2>
          </div>
          <div className="mt-4 space-y-3">
            {suggestions.length === 0 && (
              <div className="rounded-2xl bg-white/15 px-4 py-3 text-sm">
                No recommendations yet. Run another analysis.
              </div>
            )}
            {suggestions.map((item, index) => (
              <div
                key={`recommend-${index}`}
                className="rounded-2xl bg-white/15 px-4 py-3 text-sm"
              >
                {index + 1}. {item}
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-wrap justify-center gap-3">
          <button
            onClick={downloadReport}
            className="rounded-full border border-slate-200 bg-white px-6 py-2 text-sm text-slate-700"
          >
            Download Markdown
          </button>
          <button
            onClick={downloadReportPdf}
            className="rounded-full border border-slate-200 bg-white px-6 py-2 text-sm text-slate-700"
          >
            Download PDF
          </button>
          <button
            onClick={handleReset}
            className="rounded-full bg-blue-600 px-6 py-2 text-sm text-white"
          >
            Analyze Another CV
          </button>
        </section>
      </div>
    </div>
  );
}
