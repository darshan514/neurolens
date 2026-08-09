// Spiral / straight-line / signature drawing analysis.
// The spiral is compared against an ideal Archimedean spiral; residual
// radial oscillation is FFT'd to recover tremor frequency & amplitude.

import { magnitudeSpectrum, dominantFrequency } from "./fft";
import type { DrawingFeatures } from "./types";

export interface DrawPoint {
  x: number;
  y: number;
  t: number; // ms
}

export function analyzeSpiral(points: DrawPoint[], canvasSize: number): DrawingFeatures {
  if (points.length < 20) {
    return {
      deviation: 0,
      smoothness: 0,
      speed: 0,
      tremorFreqHz: null,
      tremorAmplitude: null,
      stability: 0,
      strokes: 0,
    };
  }

  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;

  // --- radial distance vs ideal spiral
  // Ideal: r(θ) = r0 + k·θ. Fit k so the spiral spans the drawn radii.
  const radii = points.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return Math.sqrt(dx * dx + dy * dy);
  });
  const angles = points.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return Math.atan2(dy, dx);
  });
  // unwrap angles
  for (let i = 1; i < angles.length; i++) {
    let d = angles[i] - angles[i - 1];
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    angles[i] = angles[i - 1] + d;
  }
  const rMin = Math.min(...radii);
  const rMax = Math.max(...radii);
  const thetaSpan = Math.max(1e-6, Math.abs(angles[angles.length - 1] - angles[0]));
  const k = (rMax - rMin) / thetaSpan;
  let devSumSq = 0;
  for (let i = 0; i < points.length; i++) {
    const expected = rMin + k * (angles[i] - angles[0]);
    const d = radii[i] - expected;
    devSumSq += d * d;
  }
  const deviation = Math.sqrt(devSumSq / points.length);

  // --- smoothness via jerk (3rd derivative of position)
  const dx = points.slice(1).map((p, i) => p.x - points[i].x);
  const dy = points.slice(1).map((p, i) => p.y - points[i].y);
  const dt = points.slice(1).map((p, i) => Math.max(1, p.t - points[i].t));
  const vx = dx.map((d, i) => d / dt[i]);
  const vy = dy.map((d, i) => d / dt[i]);
  const ax = vx.slice(1).map((v, i) => (v - vx[i]) / ((dt[i + 1] + dt[i]) / 2));
  const ay = vy.slice(1).map((v, i) => (v - vy[i]) / ((dt[i + 1] + dt[i]) / 2));
  let jerkSum = 0;
  for (let i = 1; i < ax.length; i++) {
    const jx = (ax[i] - ax[i - 1]) / ((dt[i + 1] + dt[i]) / 2 || 1);
    const jy = (ay[i] - ay[i - 1]) / ((dt[i + 1] + dt[i]) / 2 || 1);
    jerkSum += Math.sqrt(jx * jx + jy * jy);
  }
  const smoothness = ax.length > 0 ? jerkSum / ax.length : 0;

  // --- speed & stability
  const speeds = points.slice(1).map((p, i) => Math.sqrt(dx[i] ** 2 + dy[i] ** 2) / dt[i]);
  const meanSpeed = speeds.reduce((s, v) => s + v, 0) / Math.max(1, speeds.length);
  const sdSpeed = Math.sqrt(
    speeds.reduce((s, v) => s + (v - meanSpeed) ** 2, 0) / Math.max(1, speeds.length)
  );
  const stability = meanSpeed > 0 ? sdSpeed / meanSpeed : 0;

  // --- tremor from residual radial oscillation
  const residual = radii.map((r, i) => r - (rMin + k * (angles[i] - angles[0])));
  const windowLen = Math.min(residual.length, 256);
  const seg = Float64Array.from(residual.slice(-windowLen));
  // detrend
  const mean = seg.reduce((s, v) => s + v, 0) / seg.length;
  for (let i = 0; i < seg.length; i++) seg[i] -= mean;
  const dtMs = points.length > 2 ? (points[points.length - 1].t - points[0].t) / points.length : 16;
  const rate = dtMs > 0 ? 1000 / dtMs : 60;
  const spec = magnitudeSpectrum(seg, rate);
  const dom = dominantFrequency(spec, rate, 3, 10);

  return {
    deviation: Math.round(deviation * 100) / 100,
    smoothness: Math.round(smoothness),
    speed: Math.round(meanSpeed),
    tremorFreqHz: dom ? Math.round(dom.freqHz * 10) / 10 : null,
    tremorAmplitude: dom ? Math.round(dom.amplitude * 100) / 100 : null,
    stability: Math.round(stability * 100) / 100,
    strokes: 1,
  };
}

/** Normalize a feature 0–100 (higher = healthier) using healthy-range mapping. */
export function linearScore(value: number, healthyLow: number, healthyHigh: number, worst: number): number {
  // Map [healthyLow, healthyHigh] -> 100, drifting toward `worst` -> 0.
  if (value >= healthyLow && value <= healthyHigh) return 100;
  const dist = value < healthyLow ? healthyLow - value : value - healthyHigh;
  const span = Math.max(1e-6, value < healthyLow ? healthyLow - worst : worst - healthyHigh);
  return Math.max(0, Math.min(100, 100 * (1 - dist / span)));
}
