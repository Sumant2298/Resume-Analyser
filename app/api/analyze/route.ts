import pdf from "pdf-parse";
import mammoth from "mammoth";

export const runtime = "nodejs";

const MAX_FILE_MB = 6;
const MAX_CHARS = 12000;

type SalaryRange = { min: number; max: number } | null;
type ScoreInput = number | null | undefined;

type ScorePart = {
  matched: number;
  total: number;
  ratio: number;
  weight: number;
};

type ScoreBreakdown = {
  requirements: ScorePart;
  responsibilities: ScorePart;
  preferred: ScorePart;
  other: ScorePart;
};

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "your",
  "you",
  "our",
  "are",
  "will",
  "can",
  "able",
  "ability",
  "work",
  "works",
  "working",
  "role",
  "responsible",
  "responsibilities",
  "requirements",
  "qualification",
  "qualifications",
  "skills",
  "skill",
  "years",
  "year",
  "experience",
  "including",
  "strong",
  "good",
  "great",
  "excellent",
  "knowledge",
  "understanding",
  "proficient",
  "preferred",
  "plus",
  "bonus",
  "day",
  "team",
  "teams",
  "collaborate",
  "collaboration",
  "develop",
  "design",
  "build",
  "building",
  "deliver",
  "delivery",
  "ensure",
  "using",
  "use",
  "used",
  "within",
  "across",
  "multiple",
  "ability",
  "self",
  "starter",
  "must",
  "nice"
]);

function normalizeWeight(value: number, fallback: number) {
  if (!Number.isFinite(value) || value <= 0 || value >= 1) return fallback;
  return value;
}

function computeOverallScore(
  matchScore: ScoreInput,
  compensationFit: ScoreInput
) {
  if (typeof matchScore !== "number") return null;
  if (compensationFit === null || compensationFit === undefined) return matchScore;

  const skillWeight = normalizeWeight(
    Number(process.env.SKILL_WEIGHT ?? "0.8"),
    0.8
  );
  const compWeight = 1 - skillWeight;

  return Math.round(matchScore * skillWeight + compensationFit * compWeight);
}

function parseSalary(input: FormDataEntryValue | null) {
  if (!input) return null;
  const raw = String(input).replace(/[^0-9.]/g, "");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function normalizeRange(min: number | null, max: number | null): SalaryRange {
  if (min === null && max === null) return null;
  const minValue = min ?? max;
  const maxValue = max ?? min;
  if (minValue === null || maxValue === null) return null;
  const low = Math.min(minValue, maxValue);
  const high = Math.max(minValue, maxValue);
  return { min: low, max: high };
}

function computeCompensationFit(
  candidate: SalaryRange,
  role: SalaryRange
): { score: number | null; notes: string[] } {
  if (!candidate || !role) {
    return {
      score: null,
      notes: ["Compensation info missing for one or both inputs."]
    };
  }

  const span = Math.max(1, role.max - role.min);
  const overlap = Math.max(
    0,
    Math.min(candidate.max, role.max) - Math.max(candidate.min, role.min)
  );

  let score = 0;
  if (overlap > 0) {
    score = Math.round((overlap / span) * 100);
  } else {
    const gap =
      candidate.min > role.max
        ? candidate.min - role.max
        : role.min - candidate.max;
    score = Math.max(0, Math.round(100 - (gap / span) * 100));
  }

  const notes: string[] = [];
  if (overlap > 0) {
    notes.push("Salary expectations overlap with the JD range.");
  } else {
    notes.push("Salary expectations do not overlap with the JD range.");
  }
  if (candidate.min > role.max) {
    notes.push("Candidate expectations sit above the role's stated range.");
  }
  if (candidate.max < role.min) {
    notes.push("Candidate expectations sit below the role's stated range.");
  }

  return { score: Math.max(0, Math.min(100, score)), notes };
}


function getExtension(name: string) {
  const parts = name.split(".");
  if (parts.length < 2) return "";
  return parts[parts.length - 1].toLowerCase();
}

async function extractTextFromFile(file: File) {
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    throw new Error(`File too large. Max ${MAX_FILE_MB}MB.`);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = getExtension(file.name);
  const type = file.type;

  if (type === "application/pdf" || ext === "pdf") {
    const parsed = await pdf(buffer);
    return parsed.text || "";
  }

  if (
    type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) {
    const parsed = await mammoth.extractRawText({ buffer });
    return parsed.value || "";
  }

  if (type.startsWith("text/") || ext === "txt") {
    return buffer.toString("utf-8");
  }

  throw new Error("Unsupported file type. Use PDF, DOCX, or TXT.");
}

function clampText(input: string) {
  const trimmed = input.replace(/\s+/g, " ").trim();
  if (trimmed.length <= MAX_CHARS) return trimmed;
  return trimmed.slice(0, MAX_CHARS) + "...";
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeTech(text: string) {
  return text
    .replace(/c\+\+/gi, "cplusplus")
    .replace(/c#/gi, "csharp")
    .replace(/\.net/gi, "dotnet")
    .replace(/node\.js/gi, "nodejs")
    .replace(/react\.js/gi, "react");
}

function tokenize(text: string) {
  return normalizeTech(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

function splitJDSections(jdText: string) {
  const sections = {
    requirements: "",
    responsibilities: "",
    preferred: "",
    other: ""
  };

  const reqPattern =
    /\b(requirements|qualifications|must have|what you bring|skills)\b/i;
  const respPattern =
    /\b(responsibilities|what you'll do|what you will do|role|day[- ]to[- ]day)\b/i;
  const prefPattern = /\b(nice to have|preferred|bonus|plus|good to have)\b/i;

  let current: keyof typeof sections = "other";
  const lines = jdText.split(/\n+/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (reqPattern.test(trimmed)) {
      current = "requirements";
      continue;
    }
    if (respPattern.test(trimmed)) {
      current = "responsibilities";
      continue;
    }
    if (prefPattern.test(trimmed)) {
      current = "preferred";
      continue;
    }
    sections[current] += ` ${trimmed}`;
  }

  return sections;
}

function coverageScore(sectionText: string, cvTokens: Set<string>) {
  const tokens = Array.from(new Set(tokenize(sectionText)));
  if (tokens.length === 0) {
    return { matched: 0, total: 0, ratio: 0 };
  }
  const matched = tokens.reduce(
    (count, token) => (cvTokens.has(token) ? count + 1 : count),
    0
  );
  return { matched, total: tokens.length, ratio: matched / tokens.length };
}

function computeMatchScore(cvText: string, jdText: string) {
  const cvTokens = new Set(tokenize(cvText));
  const sections = splitJDSections(jdText);

  const reqScore = coverageScore(sections.requirements, cvTokens);
  const respScore = coverageScore(sections.responsibilities, cvTokens);
  const prefScore = coverageScore(sections.preferred, cvTokens);
  const otherScore = coverageScore(sections.other, cvTokens);

  const weights = {
    requirements: 0.6,
    responsibilities: 0.25,
    preferred: 0.15,
    other: 0.1
  };

  const breakdown: ScoreBreakdown = {
    requirements: { ...reqScore, weight: weights.requirements },
    responsibilities: { ...respScore, weight: weights.responsibilities },
    preferred: { ...prefScore, weight: weights.preferred },
    other: { ...otherScore, weight: weights.other }
  };

  const activeParts = Object.entries(breakdown).filter(
    ([, value]) => value.total > 0
  );

  if (activeParts.length === 0) {
    const fallback = coverageScore(jdText, cvTokens);
    return {
      score: Math.round(fallback.ratio * 100),
      breakdown: {
        requirements: { ...fallback, weight: 1 },
        responsibilities: { matched: 0, total: 0, ratio: 0, weight: 0 },
        preferred: { matched: 0, total: 0, ratio: 0, weight: 0 },
        other: { matched: 0, total: 0, ratio: 0, weight: 0 }
      }
    };
  }

  const weightSum = activeParts.reduce((sum, [, value]) => sum + value.weight, 0);
  const weightedScore = activeParts.reduce((sum, [, value]) => {
    const adjustedWeight = weightSum > 0 ? value.weight / weightSum : 0;
    return sum + value.ratio * adjustedWeight;
  }, 0);

  return {
    score: Math.round(weightedScore * 100),
    breakdown
  };
}

function extractKeywordStats(jdText: string, cvText: string) {
  const jdTokens = tokenize(jdText);
  const cvTokens = new Set(tokenize(cvText));
  const freq = new Map<string, number>();

  for (const token of jdTokens) {
    freq.set(token, (freq.get(token) || 0) + 1);
  }

  const sortedTokens = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([token]) => token);

  const keywordMatches: string[] = [];
  const missingKeywords: string[] = [];

  for (const token of sortedTokens) {
    if (cvTokens.has(token)) {
      keywordMatches.push(token);
    } else {
      missingKeywords.push(token);
    }
  }

  return {
    keywordMatches: keywordMatches.slice(0, 30),
    missingKeywords: missingKeywords.slice(0, 30)
  };
}

function heuristicAnalysis(cvText: string, jdText: string) {
  const { score, breakdown } = computeMatchScore(cvText, jdText);
  const keywords = extractKeywordStats(jdText, cvText);

  return {
    matchScore: score,
    scoreBreakdown: breakdown,
    summary:
      "Heuristic analysis (no LLM key found). Configure GROQ_API_KEY for deeper insights.",
    gapAnalysis: keywords.missingKeywords
      .slice(0, 10)
      .map((word) => `Missing keyword: ${word}`),
    improvements: [
      "Add missing role-specific keywords from the job description.",
      "Quantify impact in bullet points (metrics, outcomes, scale).",
      "Align your summary with the role's core responsibilities."
    ],
    keywordMatches: keywords.keywordMatches,
    missingKeywords: keywords.missingKeywords,
    bulletRewrites: [],
    atsNotes: [
      "Use standard section headings (Experience, Skills, Education).",
      "Avoid tables or complex formatting in the resume file."
    ]
  };
}

async function analyzeWithLLM(
  cvText: string,
  jdText: string,
  salaryContext: string
) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return heuristicAnalysis(cvText, jdText);
  }

  const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

  const systemPrompt =
    "You are a senior recruiter and ATS specialist. Return ONLY valid JSON with this schema: " +
    "{ summary: string, gapAnalysis: string[], improvements: string[], " +
    "keywordMatches: string[], missingKeywords: string[], bulletRewrites: string[], atsNotes: string[], " +
    "compensationFit: number | null, compensationNotes: string[] }." +
    "Do NOT compute a match score; it is computed separately. " +
    "Write improvements as action-oriented imperatives (start with a verb). " +
    "Gap analysis should be short phrases. Bullet rewrites must be concise, impact-focused.";

  const userPrompt = `RESUME:\n"""\n${cvText}\n"""\n\nJOB DESCRIPTION:\n"""\n${jdText}\n"""\n\nSALARY CONTEXT:\n${salaryContext}`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`LLM error: ${message}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || "";
  const parsed = safeJsonParse(text);

  if (parsed) return parsed;

  return {
    matchScore: 0,
    summary: "Unable to parse LLM response. See raw output.",
    gapAnalysis: [],
    improvements: [],
    keywordMatches: [],
    missingKeywords: [],
    bulletRewrites: [],
    atsNotes: [],
    raw: text
  };
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const cvTextInput = (formData.get("cvText") as string | null) || "";
    const jdTextInput = (formData.get("jdText") as string | null) || "";

    const cvSalaryMin = parseSalary(formData.get("cvSalaryMin"));
    const cvSalaryMax = parseSalary(formData.get("cvSalaryMax"));
    const jdSalaryMin = parseSalary(formData.get("jdSalaryMin"));
    const jdSalaryMax = parseSalary(formData.get("jdSalaryMax"));

    const cvFile = formData.get("cvFile") as File | null;
    const jdFile = formData.get("jdFile") as File | null;

    const cvText = cvTextInput.trim()
      ? clampText(cvTextInput)
      : cvFile
      ? clampText(await extractTextFromFile(cvFile))
      : "";

    const jdText = jdTextInput.trim()
      ? clampText(jdTextInput)
      : jdFile
      ? clampText(await extractTextFromFile(jdFile))
      : "";

    if (!cvText || !jdText) {
      return Response.json(
        { error: "Please provide both a resume and a Job Description." },
        { status: 400 }
      );
    }

    const candidateRange = normalizeRange(cvSalaryMin, cvSalaryMax);
    const roleRange = normalizeRange(jdSalaryMin, jdSalaryMax);
    const compensation = computeCompensationFit(candidateRange, roleRange);

    const salaryContextParts = [
      `Candidate expected range: ${
        candidateRange ? `$${candidateRange.min} - $${candidateRange.max}` : "not provided"
      }`,
      `Role range: ${
        roleRange ? `$${roleRange.min} - $${roleRange.max}` : "not provided"
      }`
    ];

    const analysis = await analyzeWithLLM(
      cvText,
      jdText,
      salaryContextParts.join("\n")
    );

    const match = computeMatchScore(cvText, jdText);
    const keywordStats = extractKeywordStats(jdText, cvText);

    analysis.matchScore = match.score;
    analysis.scoreBreakdown = match.breakdown;

    if (!Array.isArray(analysis.keywordMatches) || analysis.keywordMatches.length === 0) {
      analysis.keywordMatches = keywordStats.keywordMatches;
    }
    if (!Array.isArray(analysis.missingKeywords) || analysis.missingKeywords.length === 0) {
      analysis.missingKeywords = keywordStats.missingKeywords;
    }

    if (analysis.compensationFit === undefined || analysis.compensationFit === null) {
      analysis.compensationFit = compensation.score;
    }
    const existingNotes = Array.isArray(analysis.compensationNotes)
      ? analysis.compensationNotes
      : [];
    if (existingNotes.length === 0) {
      analysis.compensationNotes = compensation.notes;
    }

    analysis.overallScore = computeOverallScore(
      analysis.matchScore,
      analysis.compensationFit
    );

    return Response.json({
      analysis,
      meta: {
        cvChars: cvText.length,
        jdChars: jdText.length,
        scoreBreakdown: match.breakdown
      }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
