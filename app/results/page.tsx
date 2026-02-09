"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PDFDocument, StandardFonts } from "pdf-lib";

type ScorePart = {
  matched: number;
  total: number;
  ratio: number;
  weight: number;
};

type ScoreBreakdown = {
  requirements?: ScorePart;
  responsibilities?: ScorePart;
  preferred?: ScorePart;
  other?: ScorePart;
};

type Analysis = {
  matchScore?: number;
  summary?: string;
  gapAnalysis?: string[];
  improvements?: string[];
  keywordMatches?: string[];
  missingKeywords?: string[];
  bulletRewrites?: string[];
  atsNotes?: string[];
  compensationFit?: number | null;
  compensationNotes?: string[];
  overallScore?: number | null;
  scoreBreakdown?: ScoreBreakdown;
  raw?: string;
};

type Meta = {
  cvChars: number;
  jdChars: number;
  scoreBreakdown?: ScoreBreakdown;
  skillBuckets?: {
    keySkills?: string[];
    bonusSkills?: string[];
  };
};

type Payload = {
  analysis: Analysis;
  meta: Meta;
};

const STORAGE_KEY = "resume_analysis_payload";

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Languages: [
    "javascript",
    "typescript",
    "python",
    "java",
    "csharp",
    "cplusplus",
    "go",
    "golang",
    "ruby",
    "php",
    "swift",
    "kotlin",
    "scala",
    "rust",
    "sql"
  ],
  Frontend: [
    "react",
    "next",
    "vue",
    "angular",
    "svelte",
    "html",
    "css",
    "tailwind",
    "redux",
    "webpack",
    "vite",
    "storybook",
    "jquery"
  ],
  Backend: [
    "nodejs",
    "express",
    "nestjs",
    "django",
    "flask",
    "fastapi",
    "spring",
    "rails",
    "graphql",
    "rest",
    "grpc",
    "microservices",
    "api",
    "backend"
  ],
  "Cloud & DevOps": [
    "aws",
    "gcp",
    "azure",
    "docker",
    "kubernetes",
    "terraform",
    "ci",
    "cd",
    "github",
    "gitlab",
    "jenkins",
    "helm",
    "cloud",
    "devops"
  ],
  "Data & AI": [
    "postgres",
    "mysql",
    "mongodb",
    "redis",
    "elasticsearch",
    "kafka",
    "spark",
    "hadoop",
    "pandas",
    "numpy",
    "tensorflow",
    "pytorch",
    "ml",
    "ai",
    "llm",
    "vector",
    "snowflake"
  ],
  "Product & Leadership": [
    "stakeholder",
    "communication",
    "leadership",
    "mentoring",
    "roadmap",
    "agile",
    "scrum",
    "product",
    "design",
    "collaboration",
    "ownership",
    "strategy"
  ]
};

const CATEGORY_ORDER = [
  "Languages",
  "Frontend",
  "Backend",
  "Cloud & DevOps",
  "Data & AI",
  "Product & Leadership",
  "Other"
];

const cleanGap = (item: string) =>
  item.replace(/^Missing keyword:\s*/i, "").replace(/\.$/, "").trim();

const buildActionItems = (analysis: Analysis) => {
  const items: string[] = [];

  for (const improvement of analysis.improvements || []) {
    items.push(`Do: ${improvement}`);
  }

  for (const gap of (analysis.gapAnalysis || []).slice(0, 6)) {
    const keyword = cleanGap(gap);
    if (keyword) {
      items.push(`Add evidence for ${keyword} (project, metric, or tool).`);
    } else {
      items.push(`Close gap: ${gap}`);
    }
  }

  for (const rewrite of (analysis.bulletRewrites || []).slice(0, 3)) {
    items.push(`Rewrite a bullet: ${rewrite}`);
  }

  return Array.from(new Set(items)).slice(0, 8);
};

const formatCoverage = (part?: ScorePart) => {
  if (!part || part.total === 0) return "N/A";
  return `${Math.round(part.ratio * 100)}% (${part.matched}/${part.total})`;
};

const prettySkill = (skill: string) => {
  const map: Record<string, string> = {
    nodejs: "Node.js",
    csharp: "C#",
    cplusplus: "C++",
    dotnet: ".NET",
    aws: "AWS",
    gcp: "GCP",
    ai: "AI",
    ml: "ML",
    llm: "LLM"
  };

  if (map[skill]) return map[skill];
  if (skill.length <= 3) return skill.toUpperCase();
  return skill.charAt(0).toUpperCase() + skill.slice(1);
};

const buildCategoryMap = () => {
  const map = new Map<string, string>();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      map.set(keyword, category);
    }
  }
  return map;
};

const categorizeSkills = (skills: string[]) => {
  const map = buildCategoryMap();
  const buckets: Record<string, string[]> = {};
  for (const category of CATEGORY_ORDER) {
    buckets[category] = [];
  }

  for (const skill of skills) {
    const key = skill.toLowerCase();
    const category = map.get(key) || "Other";
    if (!buckets[category].includes(skill)) {
      buckets[category].push(skill);
    }
  }

  return buckets;
};

const buildMarkdown = (analysis: Analysis, meta?: Meta) => {
  const actionItems = buildActionItems(analysis);
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
    "## Score Breakdown",
    `Requirements coverage: ${formatCoverage(meta?.scoreBreakdown?.requirements)}`,
    `Responsibilities coverage: ${formatCoverage(
      meta?.scoreBreakdown?.responsibilities
    )}`,
    `Preferred coverage: ${formatCoverage(meta?.scoreBreakdown?.preferred)}`,
    "",
    "## Action Plan",
    ...actionItems.map((item) => `- ${item}`),
    "",
    "## Compensation Notes",
    ...(Array.isArray(analysis.compensationNotes)
      ? analysis.compensationNotes
      : []
    ).map((item) => `- ${item}`),
    "",
    "## Gap Analysis",
    ...(analysis.gapAnalysis || []).map((item) => `- ${item}`),
    "",
    "## Improvements",
    ...(analysis.improvements || []).map((item) => `- ${item}`),
    "",
    "## Keyword Matches",
    ...(analysis.keywordMatches || []).map((item) => `- ${item}`),
    "",
    "## Missing Keywords",
    ...(analysis.missingKeywords || []).map((item) => `- ${item}`),
    "",
    "## Bullet Rewrites",
    ...(analysis.bulletRewrites || []).map((item) => `- ${item}`),
    "",
    "## ATS Notes",
    ...(analysis.atsNotes || []).map((item) => `- ${item}`)
  ];

  return lines.filter(Boolean).join("\n");
};

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

  const actionItems = useMemo(
    () => (analysis ? buildActionItems(analysis) : []),
    [analysis]
  );

  const keySkills = meta?.skillBuckets?.keySkills || [];
  const bonusSkills = meta?.skillBuckets?.bonusSkills || [];

  const matchedSet = new Set(analysis?.keywordMatches || []);
  const missingSet = new Set(analysis?.missingKeywords || []);

  const matchingSkills = keySkills.filter((skill) => matchedSet.has(skill));
  const missingKeySkills = keySkills.filter((skill) => missingSet.has(skill));
  const bonusMatched = bonusSkills.filter((skill) => matchedSet.has(skill));
  const bonusMissing = bonusSkills.filter((skill) => missingSet.has(skill));

  const matchingByCategory = useMemo(
    () => categorizeSkills(matchingSkills),
    [matchingSkills]
  );
  const missingByCategory = useMemo(
    () => categorizeSkills(missingKeySkills),
    [missingKeySkills]
  );
  const bonusByCategory = useMemo(
    () => categorizeSkills([...bonusMatched, ...bonusMissing]),
    [bonusMatched, bonusMissing]
  );

  const rewriteSuggestions = useMemo(() => {
    if (!analysis) return [];
    const rewrites = analysis.bulletRewrites || [];
    if (rewrites.length > 0) return rewrites.slice(0, 5);
    return (analysis.improvements || []).slice(0, 5);
  }, [analysis]);

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
        <div className="mx-auto max-w-3xl rounded-3xl bg-white/80 p-8 text-center">
          <h1 className="font-display text-3xl">No analysis found</h1>
          <p className="mt-3 text-sm text-ink/60">{error}</p>
          <button
            onClick={handleReset}
            className="mt-6 rounded-full bg-ink px-5 py-2 text-sm text-white"
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
        <div className="mx-auto max-w-3xl rounded-3xl bg-white/80 p-8 text-center">
          <p className="text-sm text-ink/60">Loading your analysis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen px-6 pb-16 pt-12 sm:px-10">
      <div className="noise" />
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-xs uppercase tracking-[0.2em] text-ink">
              Resume Analyser · Results
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={downloadReport}
                className="rounded-full border border-ink/20 bg-white/80 px-4 py-2 text-xs"
              >
                Download MD
              </button>
              <button
                onClick={downloadReportPdf}
                className="rounded-full border border-ink/20 bg-white/80 px-4 py-2 text-xs"
              >
                Download PDF
              </button>
              <button
                onClick={handleReset}
                className="rounded-full bg-ink px-4 py-2 text-xs text-white"
              >
                New analysis
              </button>
            </div>
          </div>

          <div className="glass relative overflow-hidden rounded-3xl p-8">
            <div className="absolute -right-12 -top-10 h-40 w-40 rounded-full bg-aqua/60 blur-2xl" />
            <div className="absolute -bottom-12 left-10 h-36 w-36 rounded-full bg-berry/30 blur-2xl" />
            <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-3">
                <h1 className="font-display text-3xl sm:text-4xl">
                  Overall match
                </h1>
                <p className="text-sm text-ink/70">
                  A calibrated score based on requirements, responsibilities,
                  and preferred skills.
                </p>
                <div className="grid gap-3 text-xs text-ink/70">
                  <div className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2">
                    <span>Requirements coverage</span>
                    <span>{formatCoverage(meta?.scoreBreakdown?.requirements)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2">
                    <span>Responsibilities coverage</span>
                    <span>
                      {formatCoverage(meta?.scoreBreakdown?.responsibilities)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2">
                    <span>Preferred coverage</span>
                    <span>{formatCoverage(meta?.scoreBreakdown?.preferred)}</span>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="glow-card rounded-2xl p-4 text-center">
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/50">
                    Overall
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-ink">
                    {analysis.overallScore ?? analysis.matchScore ?? "--"}%
                  </p>
                </div>
                <div className="glow-card rounded-2xl p-4 text-center">
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/50">
                    Match
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-ink">
                    {analysis.matchScore ?? "--"}%
                  </p>
                </div>
                <div className="glow-card rounded-2xl p-4 text-center">
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/50">
                    Salary Fit
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-ink">
                    {analysis.compensationFit ?? "--"}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="mt-10 grid gap-8">
          <section className="grid gap-6 lg:grid-cols-3">
            <div className="glass rounded-3xl p-6">
              <h2 className="font-display text-xl">Matching skills</h2>
              <p className="text-xs text-ink/60">Core skills you already show.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {matchingSkills.length === 0 && (
                  <span className="text-xs text-ink/50">No matches yet.</span>
                )}
                {matchingSkills.slice(0, 20).map((skill) => (
                  <span
                    key={`match-${skill}`}
                    className="rounded-full bg-aqua/20 px-3 py-1 text-xs"
                  >
                    {prettySkill(skill)}
                  </span>
                ))}
              </div>
            </div>
            <div className="glass rounded-3xl p-6">
              <h2 className="font-display text-xl">Missing key skills</h2>
              <p className="text-xs text-ink/60">
                Prioritize these to raise your match score.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {missingKeySkills.length === 0 && (
                  <span className="text-xs text-ink/50">No gaps detected.</span>
                )}
                {missingKeySkills.slice(0, 20).map((skill) => (
                  <span
                    key={`missing-${skill}`}
                    className="rounded-full bg-coral/20 px-3 py-1 text-xs"
                  >
                    {prettySkill(skill)}
                  </span>
                ))}
              </div>
            </div>
            <div className="glass rounded-3xl p-6">
              <h2 className="font-display text-xl">Bonus skills</h2>
              <p className="text-xs text-ink/60">
                Nice‑to‑have skills that boost differentiation.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {bonusSkills.length === 0 && (
                  <span className="text-xs text-ink/50">No bonus skills found.</span>
                )}
                {bonusSkills.slice(0, 20).map((skill) => (
                  <span
                    key={`bonus-${skill}`}
                    className={`rounded-full px-3 py-1 text-xs ${
                      bonusMatched.includes(skill)
                        ? "bg-aqua/20"
                        : "bg-blush/70"
                    }`}
                  >
                    {prettySkill(skill)}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="glass rounded-3xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-2xl">Skill categories</h2>
              <span className="text-xs text-ink/60">
                5–6 focused buckets for clearer targeting.
              </span>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {CATEGORY_ORDER.map((category) => {
                const matched = matchingByCategory[category] || [];
                const missing = missingByCategory[category] || [];
                const bonus = bonusByCategory[category] || [];
                const totalCount = matched.length + missing.length + bonus.length;
                if (category === "Other" && totalCount === 0) return null;

                return (
                  <div
                    key={category}
                    className="rounded-2xl border border-ink/10 bg-white/80 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{category}</p>
                      <span className="text-xs text-ink/50">
                        {matched.length} matched · {missing.length} missing
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {matched.slice(0, 8).map((skill) => (
                        <span
                          key={`cat-match-${category}-${skill}`}
                          className="rounded-full bg-aqua/20 px-3 py-1 text-xs"
                        >
                          {prettySkill(skill)}
                        </span>
                      ))}
                      {missing.slice(0, 8).map((skill) => (
                        <span
                          key={`cat-miss-${category}-${skill}`}
                          className="rounded-full bg-coral/20 px-3 py-1 text-xs"
                        >
                          {prettySkill(skill)}
                        </span>
                      ))}
                      {bonus.slice(0, 6).map((skill) => (
                        <span
                          key={`cat-bonus-${category}-${skill}`}
                          className="rounded-full bg-blush/60 px-3 py-1 text-xs"
                        >
                          {prettySkill(skill)}
                        </span>
                      ))}
                      {totalCount === 0 && (
                        <span className="text-xs text-ink/50">
                          No skills detected in this category.
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="glass rounded-3xl p-6">
              <h2 className="font-display text-2xl">Action plan</h2>
              <p className="text-xs text-ink/60">
                Focus on these steps to raise your score quickly.
              </p>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-ink/70">
                {actionItems.length === 0 && (
                  <li>Run another analysis to get a full action list.</li>
                )}
                {actionItems.map((item, index) => (
                  <li key={`action-${index}`}>{item}</li>
                ))}
              </ol>
            </div>

            <div className="glass rounded-3xl p-6">
              <h2 className="font-display text-2xl">Rewrite recommendations</h2>
              <p className="text-xs text-ink/60">
                Direct bullet updates you can copy into the resume.
              </p>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-ink/70">
                {rewriteSuggestions.length === 0 && (
                  <li>No rewrite suggestions yet. Try again with more detail.</li>
                )}
                {rewriteSuggestions.map((item, index) => (
                  <li key={`rewrite-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="glass rounded-3xl p-6">
              <h2 className="font-display text-2xl">Other tips</h2>
              <p className="text-xs text-ink/60">
                ATS and recruiter tips that improve readability.
              </p>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-ink/70">
                {(analysis.atsNotes || []).length === 0 && (
                  <li>Keep sections clear with standard headings.</li>
                )}
                {(analysis.atsNotes || []).map((note, index) => (
                  <li key={`note-${index}`}>{note}</li>
                ))}
              </ul>
            </div>

            <div className="glass rounded-3xl p-6">
              <h2 className="font-display text-2xl">Compensation notes</h2>
              <p className="text-xs text-ink/60">
                Salary alignment insights based on the ranges provided.
              </p>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-ink/70">
                {(analysis.compensationNotes || []).length === 0 && (
                  <li>Add ranges to view salary fit insights.</li>
                )}
                {(analysis.compensationNotes || []).map((note, index) => (
                  <li key={`comp-${index}`}>{note}</li>
                ))}
              </ul>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
