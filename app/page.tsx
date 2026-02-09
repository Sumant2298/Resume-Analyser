"use client";

import { useMemo, useState } from "react";
import { PDFDocument, StandardFonts } from "pdf-lib";

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
  raw?: string;
};

type Meta = {
  cvChars: number;
  jdChars: number;
};

type InputMode = "file" | "text";

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
    "## Action Plan",
    ...actionItems.map((item) => `- ${item}`),
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

export default function Home() {
  const [cvMode, setCvMode] = useState<InputMode>("file");
  const [jdMode, setJdMode] = useState<InputMode>("text");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [cvText, setCvText] = useState("");
  const [jdText, setJdText] = useState("");
  const [cvSalaryMin, setCvSalaryMin] = useState("");
  const [cvSalaryMax, setCvSalaryMax] = useState("");
  const [jdSalaryMin, setJdSalaryMin] = useState("");
  const [jdSalaryMax, setJdSalaryMax] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actionItems = useMemo(
    () => (analysis ? buildActionItems(analysis) : []),
    [analysis]
  );

  const priorityFixes = useMemo(() => {
    if (!analysis) return [];
    const gaps = (analysis.gapAnalysis || []).map((item) => cleanGap(item));
    const missing = analysis.missingKeywords || [];
    return Array.from(new Set([...gaps, ...missing]))
      .filter(Boolean)
      .slice(0, 6);
  }, [analysis]);

  const handleAnalyze = async () => {
    setError(null);
    setAnalysis(null);
    setMeta(null);

    if (cvMode === "file" && !cvFile) {
      setError("Please upload a resume file.");
      return;
    }
    if (cvMode === "text" && !cvText.trim()) {
      setError("Please paste your resume text.");
      return;
    }
    if (jdMode === "file" && !jdFile) {
      setError("Please upload a JD file.");
      return;
    }
    if (jdMode === "text" && !jdText.trim()) {
      setError("Please paste the JD text.");
      return;
    }

    const formData = new FormData();
    if (cvMode === "file" && cvFile) formData.append("cvFile", cvFile);
    if (cvMode === "text") formData.append("cvText", cvText);
    if (jdMode === "file" && jdFile) formData.append("jdFile", jdFile);
    if (jdMode === "text") formData.append("jdText", jdText);
    if (cvSalaryMin) formData.append("cvSalaryMin", cvSalaryMin);
    if (cvSalaryMax) formData.append("cvSalaryMax", cvSalaryMax);
    if (jdSalaryMin) formData.append("jdSalaryMin", jdSalaryMin);
    if (jdSalaryMax) formData.append("jdSalaryMax", jdSalaryMax);

    try {
      setLoading(true);
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error || "Analysis failed.");
      } else {
        setAnalysis(data.analysis);
        setMeta(data.meta);

      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

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

  const downloadInput = (text: string, filename: string) => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative min-h-screen px-6 pb-16 pt-12 sm:px-10">
      <div className="noise" />
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-xs uppercase tracking-[0.2em] text-ink">
              Resume Analyser · ATS‑aware insights
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-ink/10 bg-white/80 px-4 py-2 text-xs text-ink/70">
                No login required
              </div>
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <h1 className="font-display text-4xl font-semibold leading-tight text-ink sm:text-5xl">
                Turn your resume into a job‑ready action plan.
              </h1>
              <p className="max-w-xl text-lg text-ink/70">
                Upload or paste your resume and JD to get a match score, salary
                fit, and an action‑oriented checklist. Unlimited analyses with
                no login required.
              </p>
              <div className="flex flex-wrap gap-3 text-sm text-ink/70">
                <span className="tag rounded-full px-3 py-1">PDF · DOCX · Text</span>
                <span className="tag rounded-full px-3 py-1">Action plan</span>
                <span className="tag rounded-full px-3 py-1">Salary fit</span>
                <span className="tag rounded-full px-3 py-1">ATS‑ready tips</span>
              </div>
            </div>
            <div className="glass relative overflow-hidden rounded-3xl p-6">
              <div className="absolute -right-12 -top-10 h-36 w-36 rounded-full bg-aqua/60 blur-2xl" />
              <div className="absolute -bottom-10 left-10 h-32 w-32 rounded-full bg-coral/60 blur-2xl" />
              <div className="relative space-y-4">
                <h2 className="font-display text-2xl">What you get</h2>
                <p className="text-sm text-ink/70">
                  A prioritized action plan, rewrite suggestions, and ATS‑ready
                  guidance. Files are processed in memory only.
                </p>
                <div className="grid gap-3 text-sm">
                  <div className="rounded-2xl bg-white/80 p-4">
                    <p className="font-semibold">Scoreboard</p>
                    <p className="text-ink/70">Overall fit + salary alignment.</p>
                  </div>
                  <div className="rounded-2xl bg-white/80 p-4">
                    <p className="font-semibold">Action checklist</p>
                    <p className="text-ink/70">Exactly what to fix next.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="mt-12 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="glass rounded-3xl p-6 sm:p-8">
            <h2 className="font-display text-2xl">Inputs</h2>
            <p className="text-sm text-ink/60">
              Upload a file or paste text for both your resume and the JD.
            </p>

            <div className="mt-6 grid gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Resume (Step 1)</h3>
                  <div className="flex gap-2 text-xs">
                    <button
                      onClick={() => setCvMode("file")}
                      className={`rounded-full px-3 py-1 ${
                        cvMode === "file"
                          ? "bg-ink text-white"
                          : "border border-ink/20 text-ink"
                      }`}
                    >
                      Upload
                    </button>
                    <button
                      onClick={() => setCvMode("text")}
                      className={`rounded-full px-3 py-1 ${
                        cvMode === "text"
                          ? "bg-ink text-white"
                          : "border border-ink/20 text-ink"
                      }`}
                    >
                      Paste
                    </button>
                  </div>
                </div>

                {cvMode === "file" ? (
                  <div className="rounded-2xl border border-dashed border-ink/20 bg-white/60 p-4">
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={(event) => setCvFile(event.target.files?.[0] || null)}
                    />
                    {cvFile && (
                      <p className="mt-2 text-xs text-ink/60">{cvFile.name}</p>
                    )}
                  </div>
                ) : (
                  <textarea
                    value={cvText}
                    onChange={(event) => setCvText(event.target.value)}
                    placeholder="Paste resume content here..."
                    rows={6}
                    className="w-full rounded-2xl border border-ink/10 bg-white/80 p-3 text-sm"
                  />
                )}

                {cvMode === "file" && cvFile && (
                  <button
                    onClick={() => downloadFile(cvFile)}
                    className="text-xs underline text-ink/70"
                  >
                    Download resume file
                  </button>
                )}
                {cvMode === "text" && cvText.trim() && (
                  <button
                    onClick={() => downloadInput(cvText, "resume-text.txt")}
                    className="text-xs underline text-ink/70"
                  >
                    Download resume text
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Job Description (Step 2)</h3>
                  <div className="flex gap-2 text-xs">
                    <button
                      onClick={() => setJdMode("file")}
                      className={`rounded-full px-3 py-1 ${
                        jdMode === "file"
                          ? "bg-ink text-white"
                          : "border border-ink/20 text-ink"
                      }`}
                    >
                      Upload
                    </button>
                    <button
                      onClick={() => setJdMode("text")}
                      className={`rounded-full px-3 py-1 ${
                        jdMode === "text"
                          ? "bg-ink text-white"
                          : "border border-ink/20 text-ink"
                      }`}
                    >
                      Paste
                    </button>
                  </div>
                </div>

                {jdMode === "file" ? (
                  <div className="rounded-2xl border border-dashed border-ink/20 bg-white/60 p-4">
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={(event) => setJdFile(event.target.files?.[0] || null)}
                    />
                    {jdFile && (
                      <p className="mt-2 text-xs text-ink/60">{jdFile.name}</p>
                    )}
                  </div>
                ) : (
                  <textarea
                    value={jdText}
                    onChange={(event) => setJdText(event.target.value)}
                    placeholder="Paste job description here..."
                    rows={6}
                    className="w-full rounded-2xl border border-ink/10 bg-white/80 p-3 text-sm"
                  />
                )}

                {jdMode === "file" && jdFile && (
                  <button
                    onClick={() => downloadFile(jdFile)}
                    className="text-xs underline text-ink/70"
                  >
                    Download JD file
                  </button>
                )}
                {jdMode === "text" && jdText.trim() && (
                  <button
                    onClick={() => downloadInput(jdText, "jd-text.txt")}
                    className="text-xs underline text-ink/70"
                  >
                    Download JD text
                  </button>
                )}
              </div>
            </div>

            <div className="mt-6 rounded-3xl bg-white/70 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-semibold">Compensation (optional)</h3>
                <span className="text-xs text-ink/60">Annual USD</span>
              </div>
              <p className="text-xs text-ink/60">
                Add ranges to compute a salary‑fit score. Leave empty if not
                applicable.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-ink/10 bg-white/80 p-4">
                  <p className="text-sm font-semibold">Candidate expectations</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input
                      type="number"
                      min="0"
                      value={cvSalaryMin}
                      onChange={(event) => setCvSalaryMin(event.target.value)}
                      placeholder="Min (e.g. 80000)"
                      className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      min="0"
                      value={cvSalaryMax}
                      onChange={(event) => setCvSalaryMax(event.target.value)}
                      placeholder="Max (e.g. 110000)"
                      className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="rounded-2xl border border-ink/10 bg-white/80 p-4">
                  <p className="text-sm font-semibold">Role range</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input
                      type="number"
                      min="0"
                      value={jdSalaryMin}
                      onChange={(event) => setJdSalaryMin(event.target.value)}
                      placeholder="Min (e.g. 90000)"
                      className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      min="0"
                      value={jdSalaryMax}
                      onChange={(event) => setJdSalaryMax(event.target.value)}
                      placeholder="Max (e.g. 120000)"
                      className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl bg-coral/20 p-3 text-sm text-ink">
                {error}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="rounded-full bg-gradient-to-r from-midnight to-berry px-6 py-3 text-sm text-white shadow-lg shadow-berry/20 disabled:opacity-60"
              >
                {loading ? "Analyzing..." : "Analyze Resume"}
              </button>
              {analysis && (
                <>
                  <button
                    onClick={downloadReport}
                    className="rounded-full border border-ink/20 px-4 py-2 text-xs"
                  >
                    Download report (MD)
                  </button>
                  <button
                    onClick={downloadReportPdf}
                    className="rounded-full border border-ink/20 px-4 py-2 text-xs"
                  >
                    Download report (PDF)
                  </button>
                </>
              )}
            </div>
          </section>

          <section className="glass rounded-3xl p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-2xl">Analysis</h2>
              <div className="flex flex-wrap gap-2">
                {analysis?.overallScore !== undefined &&
                  analysis?.overallScore !== null && (
                    <span className="rounded-full bg-ink text-white px-3 py-1 text-sm">
                      Overall {analysis.overallScore}%
                    </span>
                  )}
                {analysis?.matchScore !== undefined && (
                  <span className="rounded-full bg-aqua/30 px-3 py-1 text-sm">
                    Match {analysis.matchScore}%
                  </span>
                )}
                {analysis?.compensationFit !== undefined &&
                  analysis?.compensationFit !== null && (
                    <span className="rounded-full bg-berry/10 px-3 py-1 text-sm">
                      Salary fit {analysis.compensationFit}%
                    </span>
                )}
              </div>
            </div>
            <p className="text-sm text-ink/60">
              Structured output with an action‑first plan.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="glow-card rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-ink/50">
                  Overall
                </p>
                <p className="mt-2 text-2xl font-semibold text-ink">
                  {analysis?.overallScore ?? "--"}%
                </p>
              </div>
              <div className="glow-card rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-ink/50">
                  Match
                </p>
                <p className="mt-2 text-2xl font-semibold text-ink">
                  {analysis?.matchScore ?? "--"}%
                </p>
              </div>
              <div className="glow-card rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-ink/50">
                  Salary Fit
                </p>
                <p className="mt-2 text-2xl font-semibold text-ink">
                  {analysis?.compensationFit ?? "--"}%
                </p>
              </div>
            </div>

            {!analysis && (
              <div className="mt-6 rounded-2xl border border-dashed border-ink/20 p-6 text-sm text-ink/60">
                Your results will appear here after analysis.
              </div>
            )}

            {analysis && (
              <div className="mt-6 grid gap-6 text-sm text-ink/80">
                {analysis.summary && (
                  <div>
                    <h3 className="text-base font-semibold">Summary</h3>
                    <p className="text-ink/70">{analysis.summary}</p>
                  </div>
                )}

                {actionItems.length > 0 && (
                  <div>
                    <h3 className="text-base font-semibold">Action Plan</h3>
                    <ol className="mt-2 list-decimal space-y-2 pl-5 text-ink/70">
                      {actionItems.map((item, index) => (
                        <li key={`action-${index}`}>{item}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {priorityFixes.length > 0 && (
                  <div>
                    <h3 className="text-base font-semibold">Priority Fixes</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {priorityFixes.map((item, index) => (
                        <span
                          key={`priority-${index}`}
                          className="rounded-full bg-blush/60 px-3 py-1 text-xs"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(analysis.compensationNotes) &&
                  analysis.compensationNotes.length > 0 && (
                    <div>
                      <h3 className="text-base font-semibold">Compensation Notes</h3>
                      <ul className="mt-2 list-disc space-y-2 pl-5 text-ink/70">
                        {analysis.compensationNotes.map((item, index) => (
                          <li key={`comp-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                <div>
                  <h3 className="text-base font-semibold">Gap Analysis</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(analysis.gapAnalysis || []).map((item, index) => (
                      <span
                        key={`gap-${index}`}
                        className="rounded-full bg-berry/10 px-3 py-1 text-xs"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-semibold">Improvements</h3>
                  <ul className="mt-2 list-disc space-y-2 pl-5 text-ink/70">
                    {(analysis.improvements || []).map((item, index) => (
                      <li key={`imp-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-base font-semibold">Keyword Coverage</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(analysis.keywordMatches || []).slice(0, 12).map((item, index) => (
                      <span
                        key={`match-${index}`}
                        className="rounded-full bg-aqua/20 px-3 py-1 text-xs"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-semibold">Missing Keywords</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(analysis.missingKeywords || []).slice(0, 12).map((item, index) => (
                      <span
                        key={`miss-${index}`}
                        className="rounded-full bg-coral/20 px-3 py-1 text-xs"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                {(analysis.bulletRewrites || []).length > 0 && (
                  <div>
                    <h3 className="text-base font-semibold">Bullet Rewrites</h3>
                    <ul className="mt-2 list-disc space-y-2 pl-5 text-ink/70">
                      {(analysis.bulletRewrites || []).map((item, index) => (
                        <li key={`bullet-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {(analysis.atsNotes || []).length > 0 && (
                  <div>
                    <h3 className="text-base font-semibold">ATS Notes</h3>
                    <ul className="mt-2 list-disc space-y-2 pl-5 text-ink/70">
                      {(analysis.atsNotes || []).map((item, index) => (
                        <li key={`ats-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.raw && (
                  <div>
                    <h3 className="text-base font-semibold">Raw Output</h3>
                    <pre className="mt-2 max-h-40 overflow-auto rounded-2xl bg-white/70 p-3 text-xs">
                      {analysis.raw}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
