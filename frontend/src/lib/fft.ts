// Minimal radix-2 FFT used by tremor / spiral / voice analysis.
// Input is real-valued; returns magnitude spectrum.

export interface Spectrum {
  freqs: Float64Array; // Hz
  mags: Float64Array; // magnitude
  binWidth: number; // Hz per bin
}

/** Ensure power-of-two length. */
function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/** Iterative radix-2 FFT in place on real+imag arrays. */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  // bit reversal
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curR = 1,
        curI = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + len / 2] * curR - im[i + k + len / 2] * curI;
        const vi = re[i + k + len / 2] * curI + im[i + k + len / 2] * curR;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const nR = curR * wr - curI * wi;
        curI = curR * wi + curI * wr;
        curR = nR;
      }
    }
  }
}

/**
 * Compute the magnitude spectrum of a real signal.
 * @param samples input signal
 * @param sampleRate samples per second
 * @param taper optional fraction of window to taper (Hann), default 0.5
 */
export function magnitudeSpectrum(samples: Float64Array, sampleRate: number, taper = 0.5): Spectrum {
  const n = Math.min(nextPow2(samples.length), 1 << 16);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  void taper;
  for (let i = 0; i < n; i++) {
    const x = samples[i] ?? 0;
    // Hann window
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    re[i] = x * w;
  }
  fft(re, im);
  const mags = new Float64Array(n / 2);
  const freqs = new Float64Array(n / 2);
  const binWidth = sampleRate / n;
  for (let i = 0; i < n / 2; i++) {
    mags[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]) / (n / 2);
    freqs[i] = i * binWidth;
  }
  return { freqs, mags, binWidth };
}

/**
 * Find the dominant frequency within [minHz, maxHz].
 * Returns null if the band has negligible energy.
 */
export function dominantFrequency(
  spec: Spectrum,
  sampleRate: number,
  minHz: number,
  maxHz: number
): { freqHz: number; amplitude: number; bandEnergy: number; totalEnergy: number } | null {
  const lo = Math.max(1, Math.floor(minHz / spec.binWidth));
  const hi = Math.min(spec.mags.length - 1, Math.ceil(maxHz / spec.binWidth));
  if (hi <= lo) return null;
  let bestIdx = lo;
  let best = 0;
  let band = 0;
  let total = 0;
  for (let i = 1; i < spec.mags.length; i++) {
    total += spec.mags[i];
    if (i >= lo && i <= hi) {
      band += spec.mags[i];
      if (spec.mags[i] > best) {
        best = spec.mags[i];
        bestIdx = i;
      }
    }
  }
  if (band < total * 0.05) return null; // band is not dominant
  // parabolic interpolation for sub-bin precision
  const m = spec.mags[bestIdx];
  const left = spec.mags[bestIdx - 1] ?? 0;
  const right = spec.mags[bestIdx + 1] ?? 0;
  const denom = left - 2 * m + right;
  const offset = denom !== 0 ? (0.5 * (left - right)) / denom : 0;
  return {
    freqHz: (bestIdx + offset) * spec.binWidth,
    amplitude: m,
    bandEnergy: band,
    totalEnergy: total,
  };
}

/** Peak-finding helper: local maxima of the spectrum (used for formant-ish peaks). */
export function spectralPeaks(spec: Spectrum, count: number, minHz: number): number[] {
  const peaks: Array<{ idx: number; mag: number }> = [];
  for (let i = Math.max(1, Math.floor(minHz / spec.binWidth)); i < spec.mags.length - 1; i++) {
    if (spec.mags[i] > spec.mags[i - 1] && spec.mags[i] > spec.mags[i + 1]) {
      peaks.push({ idx: i, mag: spec.mags[i] });
    }
  }
  peaks.sort((a, b) => b.mag - a.mag);
  return peaks.slice(0, count).map((p) => p.idx * spec.binWidth);
}
