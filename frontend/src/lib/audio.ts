// In-browser voice & speech analysis (Web Audio API).
// Extracts acoustic biomarkers that map to the speech features a
// neurologist listens for: monotony, tremor, imprecise articulation,
// long pauses, slow rate, weak vocal energy.

import type { VoiceFeatures } from "./types";

const TARGET_RATE = 16000; // analysis sample rate
const FRAME_MS = 30;
const HOP_MS = 10;

export async function requestMic(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not support microphone access.");
  }
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
  });
}

export interface Recording {
  samples: Float64Array;
  sampleRate: number; // analysis rate (16 kHz)
  durationSec: number;
}

/**
 * Record for the given duration; returns raw samples + the analysis rate.
 * The MediaStream is stopped automatically.
 */
export async function recordAudio(durationMs: number, stream?: MediaStream): Promise<Recording> {
  const owned = stream ?? (await requestMic());
  const ctx = new AudioContext();
  try {
    const rec = new MediaRecorder(owned);
    const chunks: BlobPart[] = [];
    rec.start();
    await new Promise<void>((resolve) => {
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = () => resolve();
      setTimeout(() => rec.stop(), durationMs);
    });
    const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
    const buffer = await blob.arrayBuffer();
    const decoded = await ctx.decodeAudioData(buffer);
    // Mix channels to mono
    const mono = decoded.getChannelData(0);
    const out = new Float64Array(mono.length);
    for (let i = 0; i < mono.length; i++) out[i] = mono[i];
    return {
      samples: downsample(out, decoded.sampleRate, TARGET_RATE),
      sampleRate: TARGET_RATE,
      durationSec: out.length / decoded.sampleRate,
    };
  } finally {
    owned.getTracks().forEach((t) => t.stop());
    void ctx.close();
  }
}

function downsample(input: Float64Array, fromRate: number, toRate: number): Float64Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float64Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const frac = pos - i0;
    out[i] = input[i0] * (1 - frac) + (input[Math.min(i0 + 1, input.length - 1)] ?? 0) * frac;
  }
  return out;
}

interface Frame {
  rms: number;
  voiced: boolean;
  f0: number | null; // Hz
  acr: number; // normalized autocorrelation peak (voicing strength)
  energy: number;
}

function analyzeFrames(samples: Float64Array, sampleRate: number): Frame[] {
  const frameLen = Math.floor((FRAME_MS / 1000) * sampleRate);
  const hopLen = Math.floor((HOP_MS / 1000) * sampleRate);
  const frames: Frame[] = [];
  const rmsArr: number[] = [];

  for (let start = 0; start + frameLen <= samples.length; start += hopLen) {
    let sumSq = 0;
    for (let i = start; i < start + frameLen; i++) sumSq += samples[i] * samples[i];
    rmsArr.push(Math.sqrt(sumSq / frameLen));
  }
  // robust noise floor: 10th percentile of frame RMS
  const sorted = [...rmsArr].sort((a, b) => a - b);
  const noiseFloor = sorted[Math.floor(sorted.length * 0.1)] || 1e-6;
  const voicedThreshold = Math.max(noiseFloor * 3, 0.01);

  let idx = 0;
  for (let start = 0; start + frameLen <= samples.length; start += hopLen, idx++) {
    const frame = new Float64Array(frameLen);
    let sumSq = 0;
    for (let i = 0; i < frameLen; i++) {
      const v = samples[start + i];
      frame[i] = v;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / frameLen);
    const { f0, acr } = pitch(frame, sampleRate);
    const voiced = rms >= voicedThreshold && acr > 0.55;
    frames.push({ rms, voiced, f0, acr, energy: rms });
  }
  return frames;
}

/** Autocorrelation pitch detection with parabolic interpolation (YIN-flavored). */
function pitch(frame: Float64Array, sampleRate: number): { f0: number | null; acr: number } {
  const minLag = Math.floor(sampleRate / 400); // 400 Hz max
  const maxLag = Math.floor(sampleRate / 60); // 60 Hz min
  let energy = 0;
  for (let i = 0; i < frame.length; i++) energy += frame[i] * frame[i];
  if (energy < 1e-9) return { f0: null, acr: 0 };

  let bestLag = -1;
  let bestR = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let num = 0;
    let den = 0;
    for (let i = 0; i + lag < frame.length; i++) {
      num += frame[i] * frame[i + lag];
      den += frame[i] * frame[i];
    }
    const r = den > 0 ? num / den : 0;
    if (r > bestR) {
      bestR = r;
      bestLag = lag;
    }
  }
  if (bestLag <= 0) return { f0: null, acr: 0 };
  // parabolic interpolation
  const rPrev = bestLag > minLag ? autoCorr(frame, bestLag - 1) : 0;
  const rNext = bestLag < maxLag ? autoCorr(frame, bestLag + 1) : 0;
  const denom = rPrev - 2 * bestR + rNext;
  const offset = denom !== 0 ? (0.5 * (rPrev - rNext)) / denom : 0;
  const refinedLag = bestLag + Math.max(-1, Math.min(1, offset));
  return { f0: sampleRate / refinedLag, acr: bestR };
}

function autoCorr(frame: Float64Array, lag: number): number {
  let num = 0;
  let den = 0;
  for (let i = 0; i + lag < frame.length; i++) {
    num += frame[i] * frame[i + lag];
    den += frame[i] * frame[i];
  }
  return den > 0 ? num / den : 0;
}

/** Estimate speech-syllable rate from the energy envelope. */
function syllableRate(frames: Frame[], sampleRate: number): number {
  const energies = frames.map((f) => f.energy);
  // smooth with 3-frame moving average
  const smooth = energies.map((_, i) => {
    const a = energies[i - 1] ?? energies[i];
    const c = energies[i];
    const b = energies[i + 1] ?? c;
    return (a + c + b) / 3;
  });
  const meanE = smooth.reduce((s, e) => s + e, 0) / Math.max(1, smooth.length);
  const threshold = Math.max(meanE * 0.6, 1e-4);
  const minGapFrames = Math.floor((0.12 / 1000) * sampleRate / (HOP_MS / 1000));
  let peaks = 0;
  let sinceLast = Infinity;
  for (let i = 1; i < smooth.length - 1; i++) {
    if (smooth[i] > threshold && smooth[i] >= smooth[i - 1] && smooth[i] > smooth[i + 1]) {
      if (sinceLast >= minGapFrames) {
        peaks++;
        sinceLast = 0;
      }
    } else {
      sinceLast++;
    }
  }
  const durationSec = (frames.length * HOP_MS) / 1000;
  return durationSec > 0 ? peaks / durationSec : 0;
}

/**
 * Full voice-feature extraction from a recording.
 */
export function analyzeVoice(samples: Float64Array, sampleRate: number): VoiceFeatures {
  const frames = analyzeFrames(samples, sampleRate);
  const voicedFrames = frames.filter((f) => f.voiced);
  const f0s = voicedFrames.map((f) => f.f0 ?? 0).filter((v) => v > 50 && v < 400);

  // jitter / shimmer across consecutive voiced frames
  const periods: number[] = [];
  const amps: number[] = [];
  for (let i = 0; i < frames.length; i++) {
    const f0 = frames[i].f0;
    if (frames[i].voiced && f0) periods.push(1 / f0);
    if (frames[i].voiced) amps.push(frames[i].rms);
  }
  let jitter = 0;
  if (periods.length > 3) {
    const meanP = periods.reduce((s, p) => s + p, 0) / periods.length;
    let absDiff = 0;
    for (let i = 1; i < periods.length; i++) absDiff += Math.abs(periods[i] - periods[i - 1]);
    jitter = (absDiff / (periods.length - 1) / meanP) * 100;
  }
  let shimmer = 0;
  if (amps.length > 3) {
    const meanA = amps.reduce((s, a) => s + a, 0) / amps.length;
    let absDiff = 0;
    for (let i = 1; i < amps.length; i++) absDiff += Math.abs(amps[i] - amps[i - 1]);
    shimmer = (absDiff / (amps.length - 1) / meanA) * 100;
  }

  // HNR from mean voicing strength
  const acrMean = voicedFrames.reduce((s, f) => s + f.acr, 0) / Math.max(1, voicedFrames.length);
  const hnr = 10 * Math.log10(Math.max(acrMean, 0.001) / Math.max(1 - acrMean, 0.001));
  const hnrDb = Math.max(-5, Math.min(40, hnr));

  // pauses: unvoiced runs longer than 150 ms
  const pauseMinFrames = Math.floor(0.15 / (HOP_MS / 1000));
  let pauses = 0;
  let run = 0;
  for (let i = 0; i < frames.length; i++) {
    if (!frames[i].voiced) {
      run++;
      if (run === pauseMinFrames) pauses++;
    } else run = 0;
  }
  const durationMin = (frames.length * HOP_MS) / 60000;
  const pausesPerMin = durationMin > 0 ? pauses / durationMin : 0;

  const meanF0 =
    f0s.length > 0 ? f0s.reduce((s, v) => s + v, 0) / f0s.length : 0;
  const pitchVariation =
    f0s.length > 2
      ? Math.sqrt(f0s.reduce((s, v) => s + (v - meanF0) ** 2, 0) / f0s.length)
      : 0;

  const voicedRatio = frames.length > 0 ? voicedFrames.length / frames.length : 0;
  const energy = frames.reduce((s, f) => s + f.energy, 0) / Math.max(1, frames.length);
  const speechRate = syllableRate(frames, sampleRate);
  const quality = estimateQuality(samples, sampleRate);

  return {
    f0Hz: Math.round(meanF0),
    jitter: round2(jitter),
    shimmer: round2(shimmer),
    hnrDb: round2(hnrDb),
    energy: round2(energy),
    pausesPerMin: round2(pausesPerMin),
    speechRate: round2(speechRate),
    pitchVariation: Math.round(pitchVariation),
    voicedRatio: round2(voicedRatio),
    quality,
  };
}

/** SNR proxy: 10 * log10(voice energy / noise floor energy). */
export function estimateQuality(samples: Float64Array, sampleRate: number): number {
  const frameLen = Math.floor((FRAME_MS / 1000) * sampleRate);
  const hopLen = Math.floor((HOP_MS / 1000) * sampleRate);
  const rmsArr: number[] = [];
  for (let start = 0; start + frameLen <= samples.length; start += hopLen) {
    let sumSq = 0;
    for (let i = start; i < start + frameLen; i++) sumSq += samples[i] * samples[i];
    rmsArr.push(Math.sqrt(sumSq / frameLen));
  }
  if (rmsArr.length < 5) return 20;
  const sorted = [...rmsArr].sort((a, b) => a - b);
  const noise = sorted[Math.floor(sorted.length * 0.1)] || 1e-6;
  const peak = sorted[sorted.length - 1] || 1e-6;
  const snr = 10 * Math.log10((peak * peak) / (noise * noise));
  return Math.max(0, Math.min(100, Math.round(50 + (snr / 40) * 50)));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
