"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type InputMode = "file" | "text";

export default function Home() {
  const router = useRouter();
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setError(null);

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
        localStorage.setItem("resume_analysis_payload", JSON.stringify(data));
        router.push("/results");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen px-6 pb-16 pt-12 sm:px-10">
      <div className="noise" />
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-xs uppercase tracking-[0.2em] text-ink">
              Resume Analyser · Action‑first insights
            </div>
            <div className="rounded-full border border-ink/10 bg-white/80 px-4 py-2 text-xs text-ink/70">
              Unlimited analyses · No login
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <h1 className="font-display text-4xl font-semibold leading-tight text-ink sm:text-5xl">
                Build a resume that lands interviews — fast.
              </h1>
              <p className="max-w-xl text-lg text-ink/70">
                Upload your resume and job description, then receive a clear
                action plan, skill breakdown, and rewrite guidance.
              </p>
              <div className="flex flex-wrap gap-3 text-sm text-ink/70">
                <span className="tag rounded-full px-3 py-1">PDF · DOCX · Text</span>
                <span className="tag rounded-full px-3 py-1">Skill gaps</span>
                <span className="tag rounded-full px-3 py-1">Rewrite playbook</span>
                <span className="tag rounded-full px-3 py-1">Salary fit</span>
              </div>
            </div>
            <div className="glass relative overflow-hidden rounded-3xl p-6">
              <div className="absolute -right-12 -top-10 h-36 w-36 rounded-full bg-aqua/60 blur-2xl" />
              <div className="absolute -bottom-10 left-10 h-32 w-32 rounded-full bg-coral/60 blur-2xl" />
              <div className="relative space-y-4">
                <h2 className="font-display text-2xl">Your 3‑step flow</h2>
                <div className="grid gap-3 text-sm">
                  <div className="rounded-2xl bg-white/80 p-4">
                    <p className="font-semibold">Step 1 — Add resume</p>
                    <p className="text-ink/70">Upload or paste your latest CV.</p>
                  </div>
                  <div className="rounded-2xl bg-white/80 p-4">
                    <p className="font-semibold">Step 2 — Add JD</p>
                    <p className="text-ink/70">Paste the job description.</p>
                  </div>
                  <div className="rounded-2xl bg-white/80 p-4">
                    <p className="font-semibold">Step 3 — Get the plan</p>
                    <p className="text-ink/70">Action items, skills, rewrites.</p>
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
              <span className="text-xs text-ink/60">
                Results open in a dedicated analysis view.
              </span>
            </div>
          </section>

          <section className="glass rounded-3xl p-6 sm:p-8">
            <h2 className="font-display text-2xl">What you’ll get</h2>
            <p className="text-sm text-ink/60">
              A clean, multi‑section results page designed for action.
            </p>
            <div className="mt-6 grid gap-4">
              <div className="rounded-2xl bg-white/80 p-4">
                <p className="font-semibold">Overall match scoreboard</p>
                <p className="text-sm text-ink/70">
                  See an accurate match percentage with category coverage.
                </p>
              </div>
              <div className="rounded-2xl bg-white/80 p-4">
                <p className="font-semibold">Skill map</p>
                <p className="text-sm text-ink/70">
                  Skills are categorized into focused buckets with gaps called
                  out.
                </p>
              </div>
              <div className="rounded-2xl bg-white/80 p-4">
                <p className="font-semibold">Rewrite guidance</p>
                <p className="text-sm text-ink/70">
                  Actionable rewrites and bullet upgrades you can apply fast.
                </p>
              </div>
              <div className="rounded-2xl bg-white/80 p-4">
                <p className="font-semibold">Bonus tips</p>
                <p className="text-sm text-ink/70">
                  ATS notes and extra advice tailored to the JD.
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
