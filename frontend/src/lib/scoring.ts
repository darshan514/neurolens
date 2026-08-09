// Domain scoring + multimodal fusion engine.
// Each biomarker maps to a 0–100 "health score" using known healthy
// reference ranges. Domains are fused with weights and the result is
// explained in plain language with confidence.

import type {
  BalanceFeatures,
  CognitiveFeatures,
  DomainResult,
  DrawingFeatures,
  ExamReport,
  FacialFeatures,
  GaitFeatures,
  ReactionFeatures,
  RiskLevel,
  Score,
  TapFeatures,
  TestId,
  TremorFeatures,
  VoiceFeatures,
} from "./types";
import { linearScore } from "./drawing";
import { round2 } from "./audio";

export const DOMAIN_WEIGHTS: Record<TestId, number> = {
  voice: 0.16,
  tap: 0.12,
  spiral: 0.12,
  tremor: 0.14,
  walking: 0.1,
  facial: 0.1,
  balance: 0.08,
  reaction: 0.08,
  cognitive: 0.1,
};

const pct = (v: number) => `${round2(v * 100)}%`;

// ------------------------------------------------------------------ voice

export function scoreVoice(f: VoiceFeatures): DomainResult {
  const parts = [
    linearScore(f.jitter, 0, 1.0, 5),
    linearScore(f.shimmer, 0, 3.5, 15),
    linearScore(f.hnrDb, 20, 30, 0),
    linearScore(f.pausesPerMin, 0, 6, 25),
    linearScore(f.speechRate, 3.5, 6, 0.8),
    linearScore(f.pitchVariation, 30, 90, 5),
  ];
  const score = Math.round(parts.reduce((s, v) => s + v, 0) / parts.length);
  const flags: string[] = [];
  const notes: string[] = [];
  if (f.jitter > 1.0) {
    flags.push("jitter");
    notes.push(`Jitter is ${pct(f.jitter)} (typical range < 1.0%) — mild cycle-to-cycle pitch instability.`);
  }
  if (f.shimmer > 3.5) {
    flags.push("shimmer");
    notes.push(`Shimmer is ${pct(f.shimmer)} (typical range < 3.5%) — mild amplitude instability.`);
  }
  if (f.hnrDb < 20) {
    flags.push("hnr");
    notes.push(`Harmonics-to-noise ratio is ${f.hnrDb} dB (typical > 20 dB) — slightly breathy voice.`);
  }
  if (f.pausesPerMin > 8) notes.push(`Longer-than-typical pauses (${f.pausesPerMin}/min).`);
  if (f.speechRate < 3) notes.push(`Speaking rate is reduced (${f.speechRate} syllables/s).`);
  if (f.pitchVariation < 20) notes.push("Pitch variation is low — speech may sound monotonous.");
  if (notes.length === 0) notes.push("Voice and speech features are within typical ranges.");
  return {
    id: "voice",
    label: "Voice & Speech",
    score,
    confidence: f.quality,
    features: {
      "Pitch (f0)": `${f.f0Hz} Hz`,
      Jitter: pct(f.jitter),
      Shimmer: pct(f.shimmer),
      "HNR": `${f.hnrDb} dB`,
      "Pauses/min": f.pausesPerMin,
      "Speech rate": `${f.speechRate} syl/s`,
      "Pitch variation": `${f.pitchVariation} Hz`,
      "Voiced ratio": pct(f.voicedRatio),
    },
    flags,
    notes,
  };
}

// ------------------------------------------------------------------- tap

export function scoreTap(f: TapFeatures): DomainResult {
  const score = Math.round(
    (linearScore(f.tapRate, 4, 7.5, 1) * 0.4 +
      linearScore(f.variability, 0, 0.15, 0.6) * 0.3 +
      linearScore(f.fatigueIndex, 0.85, 1.15, 0.4) * 0.2 +
      linearScore(f.consistency, 0.6, 1, 0) * 0.1)
  );
  const flags: string[] = [];
  const notes: string[] = [];
  if (f.tapRate < 3.5) {
    flags.push("rate");
    notes.push(`Tap rate is slow (${f.tapRate}/s; typical 4–7/s).`);
  }
  if (f.variability > 0.2) {
    flags.push("variability");
    notes.push(`Tap intervals are variable (CV ${pct(f.variability)}).`);
  }
  if (f.fatigueIndex < 0.75) {
    flags.push("fatigue");
    notes.push(`Speed declined ${pct(1 - f.fatigueIndex)} from the start to the end of the trial — fatigue effect.`);
  }
  if (notes.length === 0) notes.push("Finger tapping speed and rhythm are within typical ranges.");
  return {
    id: "tap",
    label: "Finger Dexterity",
    score,
    confidence: 85,
    features: {
      "Tap rate": `${f.tapRate}/s`,
      "Interval variability": pct(f.variability),
      "Fatigue index": round2(f.fatigueIndex),
      Consistency: pct(f.consistency),
      Hand: f.hand === "dominant" ? "Dominant" : "Non-dominant",
    },
    flags,
    notes,
  };
}

// ----------------------------------------------------------------- spiral

export function scoreSpiral(f: DrawingFeatures): DomainResult {
  const score = Math.round(
    (linearScore(f.deviation, 0, 4, 30) * 0.35 +
      linearScore(f.smoothness, 0, 40000, 400000) * 0.3 +
      linearScore(f.stability, 0, 0.5, 2) * 0.2 +
      (f.tremorAmplitude == null ? 80 : linearScore(f.tremorAmplitude, 0, 0.8, 8)) * 0.15)
  );
  const flags: string[] = [];
  const notes: string[] = [];
  if (f.deviation > 4) {
    flags.push("deviation");
    notes.push(`Spiral deviates ${f.deviation} px from the ideal shape.`);
  }
  if (f.smoothness > 60000) {
    flags.push("smoothness");
    notes.push("Drawing movements are less smooth (higher jerk).");
  }
  if (f.tremorFreqHz != null && f.tremorAmplitude != null) {
    notes.push(`Tremor-like oscillation detected at ${f.tremorFreqHz} Hz (amplitude ${f.tremorAmplitude} px).`);
  }
  if (notes.length === 0) notes.push("Drawing control is within typical ranges.");
  return {
    id: "spiral",
    label: "Drawing Stability",
    score,
    confidence: 80,
    features: {
      Deviation: `${f.deviation} px`,
      "Smoothness (jerk)": f.smoothness,
      Speed: `${f.speed} px/s`,
      "Tremor freq": f.tremorFreqHz != null ? `${f.tremorFreqHz} Hz` : "—",
      "Tremor amp": f.tremorAmplitude != null ? `${f.tremorAmplitude} px` : "—",
      Stability: round2(f.stability),
    },
    flags,
    notes,
  };
}

// ---------------------------------------------------------------- tremor

export function scoreTremor(f: TremorFeatures): DomainResult {
  let score: number;
  if (f.tremorFreqHz == null) {
    score = Math.round(linearScore(f.rms, 9.6, 10.2, 9.0) * 0.6 + f.stability * 0.4);
  } else {
    score = Math.round(
      (linearScore(f.tremorAmplitude ?? 1, 0, 0.2, 3) * 0.6 +
        linearScore(f.rms, 9.6, 10.2, 8.5) * 0.25 +
        f.stability * 0.15)
    );
  }
  const notes: string[] = [];
  if (f.tremorFreqHz != null) {
    notes.push(
      `Dominant oscillation at ${f.tremorFreqHz} Hz with amplitude ${f.tremorAmplitude} m/s². Rest tremor in Parkinson's is classically 4–6 Hz.`
    );
  } else {
    notes.push("No dominant oscillation found in the 3–10 Hz band.");
  }
  if (f.rms > 10.6) notes.push("Total acceleration is higher than expected — check that the phone was held still.");
  return {
    id: "tremor",
    label: "Tremor",
    score,
    confidence: f.stability,
    features: {
      "Tremor freq": f.tremorFreqHz != null ? `${f.tremorFreqHz} Hz` : "none",
      "Tremor amplitude": f.tremorAmplitude != null ? `${f.tremorAmplitude} m/s²` : "—",
      "Total RMS": `${f.rms} m/s²`,
      "Sensor stability": `${f.stability}%`,
    },
    flags: [],
    notes,
  };
}

// ---------------------------------------------------------------- gait

export function scoreGait(f: GaitFeatures): DomainResult {
  const score = Math.round(
    (linearScore(f.cadence, 90, 130, 40) * 0.5 +
      linearScore(f.stepVariability, 0, 0.12, 0.5) * 0.35 +
      linearScore(f.swingSymmetry, 0.8, 1, 0.3) * 0.15)
  );
  const notes: string[] = [];
  if (f.cadence < 80) notes.push(`Cadence is low (${f.cadence} steps/min; typical 90–130).`);
  if (f.stepVariability > 0.15) notes.push(`Step timing is variable (CV ${pct(f.stepVariability)}).`);
  if (notes.length === 0) notes.push("Gait cadence and step regularity are within typical ranges.");
  return {
    id: "walking",
    label: "Walking & Gait",
    score,
    confidence: 75,
    features: {
      Cadence: `${f.cadence} steps/min`,
      "Step variability": pct(f.stepVariability),
      "Stride est.": `${f.strideEstimate} m`,
      "Swing symmetry": pct(f.swingSymmetry),
    },
    flags: [],
    notes,
  };
}

// ---------------------------------------------------------------- facial

export function scoreFacial(f: FacialFeatures): DomainResult {
  const score = Math.round(
    (linearScore(f.blinkRate, 10, 25, 3) * 0.2 +
      linearScore(f.smileAmplitude, 0.3, 1, 0) * 0.3 +
      linearScore(f.rigidity, 0.4, 1, 0) * 0.3 +
      linearScore(f.expressiveness, 0.3, 1, 0) * 0.2)
  );
  const notes: string[] = [];
  if (f.blinkRate < 8) notes.push(`Blink rate is low (${f.blinkRate}/min; typical 10–25).`);
  if (f.rigidity > 0.7) notes.push("Facial movement is limited — possible reduced expressiveness (hypomimia).");
  if (f.smileAmplitude < 0.25) notes.push("Smile amplitude is reduced.");
  if (notes.length === 0) notes.push("Facial mobility appears within typical ranges.");
  return {
    id: "facial",
    label: "Facial Mobility",
    score,
    confidence: f.quality,
    features: {
      "Blink rate": `${f.blinkRate}/min`,
      "Smile amplitude": pct(f.smileAmplitude),
      Rigidity: pct(f.rigidity),
      Expressiveness: pct(f.expressiveness),
    },
    flags: [],
    notes,
  };
}

// --------------------------------------------------------------- balance

export function scoreBalance(f: BalanceFeatures): DomainResult {
  const score = Math.round(
    (linearScore(f.sway, 0, 0.12, 0.6) * 0.6 + linearScore(f.pathLength, 0, 2, 10) * 0.25 + f.stability * 0.15)
  );
  const notes: string[] = [];
  if (f.sway > 0.2) notes.push(`Postural sway is elevated (${f.sway} m/s²).`);
  if (notes.length === 0) notes.push("Postural stability appears within typical ranges.");
  return {
    id: "balance",
    label: "Balance",
    score,
    confidence: f.stability,
    features: {
      Sway: `${f.sway} m/s²`,
      "Path length": `${f.pathLength} m`,
      "Sensor stability": `${f.stability}%`,
    },
    flags: [],
    notes,
  };
}

// -------------------------------------------------------------- reaction

export function scoreReaction(f: ReactionFeatures): DomainResult {
  const score = Math.round(
    (linearScore(f.meanMs, 200, 380, 900) * 0.7 + linearScore(f.variability, 0, 60, 300) * 0.3)
  );
  const notes: string[] = [];
  if (f.meanMs > 420) notes.push(`Mean reaction time is ${f.meanMs} ms (typical 200–380 ms).`);
  if (f.variability > 80) notes.push("Reaction times are inconsistent across trials.");
  if (f.premature > 0) notes.push(`${f.premature} premature taps recorded — wait for the signal.`);
  if (notes.length === 0) notes.push("Reaction speed and consistency are within typical ranges.");
  return {
    id: "reaction",
    label: "Reaction Time",
    score,
    confidence: 90,
    features: {
      "Mean reaction": `${f.meanMs} ms`,
      Variability: `±${f.variability} ms`,
      Premature: f.premature,
      Trials: f.trials,
    },
    flags: [],
    notes,
  };
}

// ------------------------------------------------------------- cognitive

export function scoreCognitive(f: CognitiveFeatures): DomainResult {
  const score = Math.round(
    f.memoryScore * 0.35 + f.attentionScore * 0.3 + f.executiveScore * 0.25 + linearScore(f.responseMs, 800, 1600, 4000) * 0.1
  );
  const notes: string[] = [];
  if (f.memoryScore < 60) notes.push(`Word recall accuracy is ${f.memoryScore}%.`);
  if (f.attentionScore < 60) notes.push(`Digit-span accuracy is ${f.attentionScore}%.`);
  if (f.executiveScore < 60) notes.push(`Executive task accuracy is ${f.executiveScore}%.`);
  if (notes.length === 0) notes.push("Cognitive mini-test performance is within typical ranges.");
  return {
    id: "cognitive",
    label: "Cognition",
    score,
    confidence: 85,
    features: {
      "Word recall": `${f.memoryScore}%`,
      "Digit span": `${f.attentionScore}%`,
      "Executive": `${f.executiveScore}%`,
      "Response time": `${f.responseMs} ms`,
    },
    flags: [],
    notes,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function scoreDomain(id: TestId, features: any): DomainResult {
  switch (id) {
    case "voice":
      return scoreVoice(features as VoiceFeatures);
    case "tap":
      return scoreTap(features as TapFeatures);
    case "spiral":
      return scoreSpiral(features as DrawingFeatures);
    case "tremor":
      return scoreTremor(features as TremorFeatures);
    case "walking":
      return scoreGait(features as GaitFeatures);
    case "facial":
      return scoreFacial(features as FacialFeatures);
    case "balance":
      return scoreBalance(features as BalanceFeatures);
    case "reaction":
      return scoreReaction(features as ReactionFeatures);
    case "cognitive":
      return scoreCognitive(features as CognitiveFeatures);
    default:
      // unreachable for the TestId union; keeps exhaustive typing honest
      return scoreVoice(features as VoiceFeatures);
  }
}

// ------------------------------------------------------------------ fuse

export function fuseReport(domains: DomainResult[]): ExamReport {
  const present = domains.filter((d) => d.score > 0);
  let totalW = 0;
  let weighted = 0;
  let confW = 0;
  for (const d of present) {
    const w = DOMAIN_WEIGHTS[d.id];
    weighted += d.score * w;
    confW += d.confidence * w;
    totalW += w;
  }
  // boost for uncovered domains: fewer domains -> lower confidence, slight penalty
  const coverage = present.length / 9;
  const overall = Math.round(totalW > 0 ? weighted / totalW : 0);
  const baseConf = totalW > 0 ? confW / totalW : 0;
  const confidence = Math.round(baseConf * (0.55 + 0.45 * coverage));
  const risk: RiskLevel = overall >= 65 ? "Low" : overall >= 45 ? "Moderate" : "High";

  const explanations: string[] = [];
  for (const d of present) {
    if (d.score < 60) {
      const worst = [...d.notes].sort((a, b) => b.length - a.length)[0] ?? "";
      explanations.push(`${d.label}: ${worst}`);
    }
  }
  if (explanations.length === 0) {
    explanations.push("All measured biomarkers were within typical ranges for your profile.");
  }

  const recommendations: string[] = [];
  if (overall < 45) {
    recommendations.push(
      "Multiple biomarkers are outside typical ranges. Please discuss these results with a neurologist or movement-disorder specialist."
    );
  } else if (overall < 65) {
    recommendations.push(
      "A few biomarkers are borderline. Consider repeating this screening in 2–4 weeks and sharing results with your doctor."
    );
  } else {
    recommendations.push("No immediate concerns from this screening. Continue your regular monitoring schedule.");
  }
  const weakest = present.filter((d) => d.score < 65).sort((a, b) => a.score - b.score);
  if (weakest.length > 0) {
    recommendations.push(
      `Focus areas for your next session: ${weakest.slice(0, 3).map((d) => d.label).join(", ")}.`
    );
  }
  recommendations.push(
    "NeuroLens is a screening aid, not a diagnostic device. It cannot diagnose Parkinson's disease or any other condition."
  );

  const domainScores = {} as Record<TestId, number>;
  for (const d of present) domainScores[d.id] = d.score;

  return {
    id: `r_${Date.now()}`,
    dateISO: new Date().toISOString(),
    domains: present,
    overall,
    risk,
    confidence,
    explanations,
    recommendations,
    domainScores,
  };
}

export function riskColor(risk: RiskLevel): string {
  return risk === "Low" ? "#2dd4bf" : risk === "Moderate" ? "#fbbf24" : "#fb7185";
}

// ---------------------------------------------------------- adaptive exam

export interface FollowUp {
  id: TestId;
  reason: string;
  priority: "high" | "medium";
}

/**
 * Adaptive examination: decide follow-up tasks from completed results,
 * the way a neurologist would drill deeper on an abnormal finding.
 */
export function adaptiveFollowUps(domains: DomainResult[]): FollowUp[] {
  const byId = new Map(domains.map((d) => [d.id, d]));
  const follow: FollowUp[] = [];

  const voice = byId.get("voice");
  if (voice && voice.score < 55) {
    follow.push({
      id: "voice",
      reason: "Speech features were outside typical ranges — repeat with an additional reading task for a more stable estimate.",
      priority: "high",
    });
  } else if (voice && voice.confidence < 60) {
    follow.push({
      id: "voice",
      reason: "Recording quality was low (background noise) — a second recording will improve confidence.",
      priority: "medium",
    });
  }

  const spiral = byId.get("spiral");
  if (spiral && spiral.score < 55) {
    follow.push({
      id: "spiral",
      reason: "Drawing deviation/tremor was elevated — draw an additional spiral to confirm.",
      priority: "high",
    });
  }

  const tremor = byId.get("tremor");
  if (tremor && tremor.score < 55) {
    follow.push({
      id: "spiral",
      reason: "Sensor tremor was elevated — a spiral drawing provides a complementary handwriting tremor signal.",
      priority: "high",
    });
  }

  const tap = byId.get("tap");
  if (tap && tap.score < 55 && !byId.has("reaction")) {
    follow.push({
      id: "reaction",
      reason: "Finger dexterity was reduced — reaction time adds a complementary motor-latency measurement.",
      priority: "medium",
    });
  }

  const gait = byId.get("walking");
  if (gait && gait.score < 55 && !byId.has("balance")) {
    follow.push({
      id: "balance",
      reason: "Gait was affected — a balance assessment complements the mobility picture.",
      priority: "medium",
    });
  }

  // dedupe, keep first occurrence
  const seen = new Set<TestId>();
  return follow.filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)));
}
