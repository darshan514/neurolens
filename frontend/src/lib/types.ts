// Shared domain types for NeuroLens AI.

export type TestId =
  | "voice"
  | "tap"
  | "spiral"
  | "tremor"
  | "walking"
  | "facial"
  | "balance"
  | "reaction"
  | "cognitive";

export type RiskLevel = "Low" | "Moderate" | "High";

/** 0–100, higher = healthier. */
export type Score = number;

// ---------------------------------------------------------------- features

export interface VoiceFeatures {
  /** Fundamental frequency, Hz (healthy conversational ~110–170 for M, 180–260 F). */
  f0Hz: number;
  /** Jitter (cycle-to-cycle pitch variation), % — healthy typically < 1.0%. */
  jitter: number;
  /** Shimmer (cycle-to-cycle amplitude variation), % — healthy typically < 3.5%. */
  shimmer: number;
  /** Harmonics-to-noise ratio, dB — healthy typically > 20 dB. */
  hnrDb: number;
  /** Mean energy of voiced speech, 0–1. */
  energy: number;
  /** Number of pauses > 150 ms per minute of speech. */
  pausesPerMin: number;
  /** Speaking rate proxy, syllables per second. */
  speechRate: number;
  /** Std-dev of f0 across voiced frames, Hz (monotone voice = low). */
  pitchVariation: number;
  /** Fraction of frames classified as voiced. */
  voicedRatio: number;
  /** 0–100 recording quality (SNR proxy). */
  quality: number;
}

export interface TapFeatures {
  /** Taps per second, healthy 4–7. */
  tapRate: number;
  /** Coefficient of variation of tap intervals. */
  variability: number;
  /** Fatigue index: last-third tap rate / first-third tap rate. */
  fatigueIndex: number;
  /** Consistency of tap force/speed, 0–1. */
  consistency: number;
  /** Dominant hand used. */
  hand: "dominant" | "non-dominant";
}

export interface DrawingFeatures {
  /** RMS deviation from ideal spiral, px. */
  deviation: number;
  /** Mean jerk (3rd derivative of position), px/s^3. */
  smoothness: number;
  /** Mean drawing speed, px/s. */
  speed: number;
  /** Dominant tremor frequency found in residual oscillation, Hz. */
  tremorFreqHz: number | null;
  /** Tremor amplitude, px. */
  tremorAmplitude: number | null;
  /** Std-dev of instantaneous speed / mean speed. */
  stability: number;
  /** Total strokes drawn. */
  strokes: number;
}

export interface TremorFeatures {
  /** Dominant frequency in 3–10 Hz band, Hz. */
  tremorFreqHz: number | null;
  /** RMS of acceleration in the tremor band, m/s^2. */
  tremorAmplitude: number | null;
  /** Total RMS of acceleration, m/s^2. */
  rms: number;
  /** 0–100 sensor quality. */
  stability: number;
}

export interface GaitFeatures {
  /** Steps per minute. */
  cadence: number;
  /** Coefficient of variation of step intervals. */
  stepVariability: number;
  /** Estimated stride length, m (height-based heuristic). */
  strideEstimate: number;
  /** User-reported arm-swing symmetry 0–1. */
  swingSymmetry: number;
}

export interface FacialFeatures {
  /** Blinks per minute. */
  blinkRate: number;
  /** Smile amplitude proxy, 0–1. */
  smileAmplitude: number;
  /** Motion rigidity: 1 - normalized motion variance, 0–1. */
  rigidity: number;
  /** Expression variability: motion entropy, 0–1. */
  expressiveness: number;
  /** 0–100 camera/lighting quality. */
  quality: number;
}

export interface BalanceFeatures {
  /** Std-dev of horizontal acceleration, m/s^2. */
  sway: number;
  /** Total sway path length, m. */
  pathLength: number;
  /** 0–100 sensor quality. */
  stability: number;
}

export interface ReactionFeatures {
  /** Mean reaction time, ms. */
  meanMs: number;
  /** Std-dev of reaction times, ms. */
  variability: number;
  /** Number of premature taps. */
  premature: number;
  /** Number of valid trials. */
  trials: number;
}

export interface CognitiveFeatures {
  /** 0–100 word recall accuracy. */
  memoryScore: number;
  /** 0–100 digit-span accuracy. */
  attentionScore: number;
  /** 0–100 executive (Stroop) accuracy. */
  executiveScore: number;
  /** Mean response time on executive task, ms. */
  responseMs: number;
}

// ---------------------------------------------------------------- results

export interface DomainResult {
  id: TestId;
  label: string;
  /** 0–100, higher = healthier. */
  score: Score;
  /** 0–100 confidence of this measurement. */
  confidence: number;
  /** Raw measured features (numbers/strings) for the explainability panel. */
  features: Record<string, number | string>;
  /** Feature keys flagged as outside the healthy range. */
  flags: string[];
  /** Plain-language notes. */
  notes: string[];
}

export interface ExamReport {
  id: string;
  dateISO: string;
  domains: DomainResult[];
  /** Fused overall score, 0–100. */
  overall: Score;
  risk: RiskLevel;
  /** 0–100 fusion confidence. */
  confidence: number;
  explanations: string[];
  recommendations: string[];
  /** Per-domain scores for radar/trends. */
  domainScores: Record<TestId, number>;
}

export interface TrendPoint {
  dateISO: string;
  label: string;
  overall: number;
  domainScores: Record<TestId, number>;
}

export interface Baseline {
  createdAt: string;
  domainScores: Record<TestId, number>;
  overall: number;
}

export interface MedicationLog {
  id: string;
  dateISO: string;
  taken: boolean;
  domainScores: Record<TestId, number>;
  note?: string;
}

export interface PatientSummary {
  id: string;
  name: string;
  age: number;
  sex: "M" | "F";
  lastSeen: string;
  overall: number;
  risk: RiskLevel;
  trend: number; // +/-
  adherence: number; // 0-100
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: "patient" | "doctor" | "caregiver";
  heightCm: number;
  preferredLanguage: string;
}

export const TEST_META: Record<
  TestId,
  { label: string; short: string; durationSec: number; icon: string; description: string }
> = {
  voice: {
    label: "Voice & Speech",
    short: "Voice",
    durationSec: 90,
    icon: "mic",
    description: "Sustained phonation, reading, diadochokinesis and free speech for prosody analysis.",
  },
  tap: {
    label: "Finger Tapping",
    short: "Tapping",
    durationSec: 30,
    icon: "hand",
    description: "Rapid alternating finger taps to measure speed, fatigue and variability.",
  },
  spiral: {
    label: "Spiral Drawing",
    short: "Spiral",
    durationSec: 45,
    icon: "pen",
    description: "Draw spirals on screen — a classic test for tremor and fine motor control.",
  },
  tremor: {
    label: "Tremor (Sensors)",
    short: "Tremor",
    durationSec: 30,
    icon: "vibrate",
    description: "Hold the phone still while accelerometer + gyroscope measure tremor frequency.",
  },
  walking: {
    label: "Walking & Gait",
    short: "Walking",
    durationSec: 60,
    icon: "walk",
    description: "Walk 20 steps with the phone to estimate cadence, stride and step variability.",
  },
  facial: {
    label: "Facial Mobility",
    short: "Facial",
    durationSec: 60,
    icon: "face",
    description: "Front camera captures blink rate, smile amplitude and facial expressiveness.",
  },
  balance: {
    label: "Balance",
    short: "Balance",
    durationSec: 30,
    icon: "balance",
    description: "Stand still holding the phone to measure sway and postural stability.",
  },
  reaction: {
    label: "Reaction Time",
    short: "Reaction",
    durationSec: 40,
    icon: "bolt",
    description: "Tap as fast as possible when the screen changes — 5 trials.",
  },
  cognitive: {
    label: "Cognitive Mini-Tests",
    short: "Cognition",
    durationSec: 150,
    icon: "brain",
    description: "Word recall, digit span and a Stroop-style attention exercise.",
  },
};

export const DOMAIN_LABELS: Record<TestId, string> = Object.fromEntries(
  Object.entries(TEST_META).map(([k, v]) => [k, v.label])
) as Record<TestId, string>;
