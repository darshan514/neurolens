// Data layer: local-first cache with cloud sync.
// Reads are synchronous from localStorage (instant UI); writes attempt
// the FastAPI backend and fall back to localStorage + an offline queue
// that flushes when connectivity returns.

import type {
  Baseline,
  ExamReport,
  MedicationLog,
  PatientSummary,
  TestId,
  TrendPoint,
} from "./types";
import { fuseReport, DOMAIN_WEIGHTS } from "./scoring";
import { apiRequest, isApiAvailable } from "./api";

const K_RESULTS = "nl_results";
const K_MEDS = "nl_meds";
const K_PROFILE = "nl_profile";
const K_PENDING = "nl_pending";

const ALL_IDS = Object.keys(DOMAIN_WEIGHTS) as TestId[];

// ------------------------------------------------------------- helpers

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// ----------------------------------------------------------- session store

interface PendingMutation {
  kind: "report";
  domains: ExamReport["domains"];
}

function queueMutation(m: PendingMutation): void {
  const q = readJSON<PendingMutation[]>(K_PENDING, []);
  q.push(m);
  localStorage.setItem(K_PENDING, JSON.stringify(q));
}

/** Attempt to push queued offline mutations to the backend. */
export async function flushPending(): Promise<number> {
  const q = readJSON<PendingMutation[]>(K_PENDING, []);
  if (q.length === 0 || !(await isApiAvailable())) return 0;
  let synced = 0;
  const remaining: PendingMutation[] = [];
  for (const m of q) {
    try {
      await pushReportToApi(m.domains);
      synced++;
    } catch {
      remaining.push(m);
    }
  }
  localStorage.setItem(K_PENDING, JSON.stringify(remaining));
  return synced;
}

async function pushReportToApi(domains: ExamReport["domains"]): Promise<ExamReport> {
  const session = await apiRequest<{ id: number }>("/exams/sessions", {
    method: "POST",
    body: { device: navigator.userAgent.slice(0, 60), offline: false },
    auth: true,
  });
  for (const d of domains) {
    await apiRequest(`/exams/sessions/${session.id}/results`, {
      method: "POST",
      body: {
        domain: d.id,
        score: d.score,
        confidence: d.confidence,
        features: d.features,
        flags: d.flags,
        notes: d.notes,
      },
      auth: true,
    });
  }
  const api = await apiRequest<{
    id: number;
    overall: number;
    risk: string;
    confidence: number;
    domain_scores: Record<string, number>;
    explanations: string[];
    recommendations: string[];
  }>(`/reports`, {
    method: "POST",
    body: { session_id: session.id },
    auth: true,
  });
  return {
    id: String(api.id),
    dateISO: new Date().toISOString(),
    domains,
    overall: api.overall,
    risk: api.risk as ExamReport["risk"],
    confidence: api.confidence,
    explanations: api.explanations,
    recommendations: api.recommendations,
    domainScores: api.domain_scores as Record<TestId, number>,
  };
}

export async function saveSessionDomains(domains: ExamReport["domains"]): Promise<ExamReport> {
  const local = fuseReport(domains);
  const all = readJSON<ExamReport[]>(K_RESULTS, []);
  all.push(local);
  localStorage.setItem(K_RESULTS, JSON.stringify(all));

  if (await isApiAvailable()) {
    try {
      return await pushReportToApi(domains);
    } catch (err) {
      console.warn("Report sync failed — queued for later:", err);
      queueMutation({ kind: "report", domains });
    }
  } else {
    queueMutation({ kind: "report", domains });
  }
  return local;
}

export function getLatestReport(): ExamReport | null {
  const all = readJSON<ExamReport[]>(K_RESULTS, []);
  return all.length > 0 ? all[all.length - 1] : null;
}

export function getHistory(): ExamReport[] {
  return readJSON<ExamReport[]>(K_RESULTS, []);
}

// ------------------------------------------------------------- seed data

function seededTrend(): TrendPoint[] {
  const today = new Date();
  const trend: TrendPoint[] = [];
  const drift: Partial<Record<TestId, number>> = {
    voice: -1.1,
    tap: -1.6,
    spiral: -1.4,
    tremor: -1.0,
    walking: -0.8,
    facial: -0.9,
    balance: -0.6,
    reaction: -0.5,
    cognitive: -0.4,
  };
  const base: Record<TestId, number> = {
    voice: 74,
    tap: 71,
    spiral: 73,
    tremor: 78,
    walking: 76,
    facial: 75,
    balance: 80,
    reaction: 77,
    cognitive: 82,
  };
  for (let w = 7; w >= 0; w--) {
    const d = new Date(today);
    d.setDate(d.getDate() - w * 7);
    const domainScores = {} as Record<TestId, number>;
    let overall = 0;
    for (const id of ALL_IDS) {
      const jitter = (Math.random() - 0.5) * 4;
      const v = Math.round(Math.max(20, Math.min(98, base[id] + (drift[id] ?? 0) * (7 - w) + jitter)));
      domainScores[id] = v;
      overall += v * DOMAIN_WEIGHTS[id];
    }
    trend.push({
      dateISO: d.toISOString(),
      label: `W${8 - w}`,
      overall: Math.round(overall),
      domainScores,
    });
  }
  return trend;
}

export function getTrend(): TrendPoint[] {
  return readJSON<TrendPoint[]>("nl_trend", seededTrend());
}

export function getBaseline(): Baseline {
  const trend = getTrend();
  const first = trend[0];
  if (!first) {
    return {
      createdAt: new Date().toISOString(),
      domainScores: {} as Record<TestId, number>,
      overall: 70,
    };
  }
  return { createdAt: first.dateISO, domainScores: first.domainScores, overall: first.overall };
}

export function getCurrentState(): { overall: number; domainScores: Record<TestId, number> } {
  const latest = getLatestReport();
  if (latest) return { overall: latest.overall, domainScores: latest.domainScores };
  const trend = getTrend();
  const last = trend[trend.length - 1];
  return { overall: last.overall, domainScores: last.domainScores };
}

// ------------------------------------------------------------- medication

export async function saveMedLog(log: MedicationLog): Promise<MedicationLog[]> {
  const all = readJSON<MedicationLog[]>(K_MEDS, []);
  all.push(log);
  localStorage.setItem(K_MEDS, JSON.stringify(all));
  if (await isApiAvailable()) {
    try {
      await apiRequest("/exams/medication", {
        method: "POST",
        body: { taken: log.taken, domain_scores: log.domainScores, note: log.note },
        auth: true,
      });
    } catch (err) {
      console.warn("Medication log sync failed:", err);
    }
  }
  return all;
}

export function getMedLogs(): MedicationLog[] {
  return readJSON<MedicationLog[]>(K_MEDS, []);
}

// -------------------------------------------------------------- profile

export interface Profile {
  heightCm: number;
  dominantHand: "R" | "L";
}

export function getProfile(): Profile {
  return readJSON<Profile>(K_PROFILE, { heightCm: 170, dominantHand: "R" });
}

export function saveProfile(p: Profile) {
  localStorage.setItem(K_PROFILE, JSON.stringify(p));
}

// ------------------------------------------------------------ doctor demo

export const DEMO_PATIENTS: PatientSummary[] = [
  { id: "p1", name: "Rajesh V.", age: 62, sex: "M", lastSeen: "3 days ago", overall: 51, risk: "Moderate", trend: -4, adherence: 88 },
  { id: "p2", name: "Meena S.", age: 58, sex: "F", lastSeen: "1 week ago", overall: 68, risk: "Low", trend: +2, adherence: 95 },
  { id: "p3", name: "Karthik R.", age: 70, sex: "M", lastSeen: "2 days ago", overall: 43, risk: "High", trend: -7, adherence: 71 },
  { id: "p4", name: "Lakshmi N.", age: 66, sex: "F", lastSeen: "2 weeks ago", overall: 59, risk: "Moderate", trend: -2, adherence: 82 },
  { id: "p5", name: "Arun P.", age: 55, sex: "M", lastSeen: "5 days ago", overall: 73, risk: "Low", trend: +1, adherence: 90 },
];

// flush queue when the app comes back online
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    void flushPending();
  });
}
