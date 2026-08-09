// Sensor analysis via the DeviceMotion API.
// Covers the Tremor test, Balance test and Walking (gait) test.

import { magnitudeSpectrum, dominantFrequency } from "./fft";
import type { TremorFeatures, BalanceFeatures, GaitFeatures } from "./types";

export interface MotionSample {
  t: number; // ms since start
  ax: number;
  ay: number;
  az: number;
  gx: number;
  gy: number;
  gz: number;
}

export function isMotionSupported(): boolean {
  return "DeviceMotionEvent" in window;
}

export async function requestMotionPermission(): Promise<boolean> {
  const dme = DeviceMotionEvent as unknown as {
    requestPermission?: () => Promise<string>;
  };
  if (typeof dme.requestPermission === "function") {
    try {
      const res = await dme.requestPermission();
      return res === "granted";
    } catch {
      return false;
    }
  }
  return true;
}

/** Collect motion samples for the given duration. */
export function collectMotion(
  durationMs: number,
  onSample?: (samples: MotionSample[], progress: number) => void
): Promise<MotionSample[]> {
  return new Promise((resolve) => {
    const samples: MotionSample[] = [];
    const start = performance.now();
    let last: number | null = null;
    const handler = (e: DeviceMotionEvent) => {
      const t = performance.now() - start;
      if (last !== null && t - last < 12) return; // cap ~80 Hz
      last = t;
      const ax = e.accelerationIncludingGravity?.x ?? 0;
      const ay = e.accelerationIncludingGravity?.y ?? 0;
      const az = e.accelerationIncludingGravity?.z ?? 0;
      const r = e.rotationRate;
      samples.push({
        t,
        ax,
        ay,
        az,
        gx: r?.alpha ?? 0,
        gy: r?.beta ?? 0,
        gz: r?.gamma ?? 0,
      });
      onSample?.(samples, Math.min(1, t / durationMs));
    };
    window.addEventListener("devicemotion", handler, true);
    const timer = setTimeout(() => {
      window.removeEventListener("devicemotion", handler, true);
      resolve(samples);
    }, durationMs);
    // keep timer alive
    void timer;
  });
}

function detrend(x: Float64Array): Float64Array {
  const mean = x.reduce((s, v) => s + v, 0) / Math.max(1, x.length);
  const out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = x[i] - mean;
  return out;
}

function magnitude3(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

/** Sample rate estimate from timestamps. */
function sampleRateOf(samples: MotionSample[]): number {
  if (samples.length < 2) return 60;
  const dt = (samples[samples.length - 1].t - samples[0].t) / (samples.length - 1);
  return dt > 0 ? 1000 / dt : 60;
}

/** Tremor: dominant frequency + amplitude in the 3–10 Hz band, RMS, stability. */
export function analyzeTremor(samples: MotionSample[]): TremorFeatures {
  const rate = sampleRateOf(samples);
  const magnitudes = new Float64Array(samples.length);
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    const m = magnitude3(samples[i].ax, samples[i].ay, samples[i].az);
    magnitudes[i] = m;
    sumSq += m * m;
  }
  const rms = Math.sqrt(sumSq / Math.max(1, samples.length));
  const det = detrend(magnitudes);
  const spec = magnitudeSpectrum(det, rate);
  const dom = dominantFrequency(spec, rate, 3, 10);

  // stability: lower variance in the band energy over time -> more consistent signal
  const half = Math.floor(samples.length / 2);
  const seg1 = det.subarray(0, half);
  const seg2 = det.subarray(half);
  const e1 = seg1.reduce((s, v) => s + v * v, 0) / Math.max(1, seg1.length);
  const e2 = seg2.reduce((s, v) => s + v * v, 0) / Math.max(1, seg2.length);
  const stability = Math.max(0, Math.min(100, 100 - (Math.abs(e1 - e2) / Math.max(e1 + e2, 1e-6)) * 200));

  return {
    tremorFreqHz: dom ? Math.round(dom.freqHz * 10) / 10 : null,
    tremorAmplitude: dom ? Math.round(dom.amplitude * 1000) / 1000 : null,
    rms: Math.round(rms * 1000) / 1000,
    stability: Math.round(stability),
  };
}

/** Balance: horizontal sway (std of ax/ay after detrend), path length, stability. */
export function analyzeBalance(samples: MotionSample[]): BalanceFeatures {
  if (samples.length < 10) {
    return { sway: 0.4, pathLength: 0, stability: 30 };
  }
  const axs = detrend(Float64Array.from(samples.map((s) => s.ax)));
  const ays = detrend(Float64Array.from(samples.map((s) => s.ay)));
  const sd = (arr: Float64Array) => {
    const m = arr.reduce((s, v) => s + v, 0) / arr.length;
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
  };
  const sway = Math.sqrt(sd(axs) ** 2 + sd(ays) ** 2);
  let path = 0;
  for (let i = 1; i < samples.length; i++) {
    const dt = (samples[i].t - samples[i - 1].t) / 1000;
    const v = Math.sqrt(
      ((samples[i].ax - samples[i - 1].ax) / Math.max(dt, 0.001)) ** 2 +
        ((samples[i].ay - samples[i - 1].ay) / Math.max(dt, 0.001)) ** 2
    );
    path += v * dt;
  }
  const stability = Math.max(0, Math.min(100, 100 - sway * 90));
  return {
    sway: Math.round(sway * 1000) / 1000,
    pathLength: Math.round(path * 100) / 100,
    stability: Math.round(stability),
  };
}

/** Gait: step detection via acceleration peaks, cadence, variability, stride estimate. */
export function analyzeGait(samples: MotionSample[], heightCm = 170): GaitFeatures {
  const magnitudes = new Float64Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    magnitudes[i] = magnitude3(samples[i].ax, samples[i].ay, samples[i].az);
  }
  const det = detrend(magnitudes);
  // smooth with 5-sample moving average
  const smooth = new Float64Array(det.length);
  for (let i = 0; i < det.length; i++) {
    let s = 0;
    let c = 0;
    for (let j = Math.max(0, i - 2); j <= Math.min(det.length - 1, i + 2); j++) {
      s += det[j];
      c++;
    }
    smooth[i] = s / c;
  }
  // threshold from std
  const sd = Math.sqrt(det.reduce((s, v) => s + v * v, 0) / det.length);
  const threshold = Math.max(sd * 0.9, 0.35);
  const minGapMs = 280;
  const stepTimes: number[] = [];
  let lastStep = -Infinity;
  for (let i = 1; i < smooth.length - 1; i++) {
    const t = samples[i].t;
    if (smooth[i] > threshold && smooth[i] >= smooth[i - 1] && smooth[i] > smooth[i + 1]) {
      if (t - lastStep >= minGapMs) {
        stepTimes.push(t);
        lastStep = t;
      }
    }
  }
  const durationSec = samples.length > 1 ? (samples[samples.length - 1].t - samples[0].t) / 1000 : 1;
  const nSteps = Math.max(0, stepTimes.length - 1);
  const cadence = durationSec > 0 ? (nSteps / durationSec) * 60 : 0;
  let stepVariability = 0;
  if (stepTimes.length > 3) {
    const intervals = stepTimes.slice(1).map((t, i) => t - stepTimes[i]);
    const mean = intervals.reduce((s, v) => s + v, 0) / intervals.length;
    const std = Math.sqrt(intervals.reduce((s, v) => s + (v - mean) ** 2, 0) / intervals.length);
    stepVariability = mean > 0 ? std / mean : 0;
  }
  // stride estimate heuristic: ~0.45 * height per step
  const strideEstimate = (0.45 * heightCm) / 100;
  return {
    cadence: Math.round(cadence),
    stepVariability: Math.round(stepVariability * 100) / 100,
    strideEstimate: Math.round(strideEstimate * 100) / 100,
    swingSymmetry: 1, // filled by user self-report; phone cannot measure arm swing
  };
}
