/** Cleaning a recording made on the phone: cut the silence at both ends, even out the loudness. Pure (numbers in, numbers out): tested. */

const db = (x: number): number => 20 * Math.log10(Math.max(x, 1e-9));
const fromDb = (d: number): number => Math.pow(10, d / 20);

/**
 * Cuts the silence at the start and at the end, leaving a short breath (40 ms before, 120 ms after).
 * A "sound" is a 10 ms stretch whose peak is above the threshold; null when there is none at all.
 */
export function trimSilence(samples: Float32Array, rate: number, thresholdDb = -45, padStartMs = 40, padEndMs = 120): Float32Array | null {
  const win = Math.max(1, Math.round(rate * 0.01));
  const limit = fromDb(thresholdDb);
  const loud = (i: number): boolean => {
    let peak = 0;
    for (let k = i; k < Math.min(samples.length, i + win); k++) peak = Math.max(peak, Math.abs(samples[k]));
    return peak > limit;
  };
  let first = -1;
  let last = -1;
  for (let i = 0; i < samples.length; i += win) {
    if (loud(i)) {
      if (first < 0) first = i;
      last = Math.min(samples.length, i + win);
    }
  }
  if (first < 0) return null;
  const a = Math.max(0, first - Math.round((rate * padStartMs) / 1000));
  const b = Math.min(samples.length, last + Math.round((rate * padEndMs) / 1000));
  return samples.slice(a, b);
}

/** Evens out the loudness: the RMS goes to the target (about -18 dBFS), but never so far that the peak passes -1.5 dBFS. A fade of 5 ms at both ends stops clicks. */
export function normalize(samples: Float32Array, rate: number, targetRmsDb = -18, peakDb = -1.5): Float32Array {
  let sum = 0;
  let peak = 0;
  for (const s of samples) {
    sum += s * s;
    peak = Math.max(peak, Math.abs(s));
  }
  if (!samples.length || peak === 0) return samples;
  const rms = Math.sqrt(sum / samples.length);
  const gain = Math.min(fromDb(targetRmsDb) / rms, fromDb(peakDb) / peak);
  const out = new Float32Array(samples.length);
  const fade = Math.min(Math.round(rate * 0.005), Math.floor(samples.length / 2));
  for (let i = 0; i < samples.length; i++) {
    let g = gain;
    if (i < fade) g *= i / fade;
    else if (i >= samples.length - fade) g *= (samples.length - 1 - i) / fade;
    out[i] = samples[i] * g;
  }
  return out;
}

/** Trim, then normalise; null when the recording is silence. */
export function cleanRecording(samples: Float32Array, rate: number): Float32Array | null {
  const t = trimSilence(samples, rate);
  return t ? normalize(t, rate) : null;
}

export const levelDb = (samples: Float32Array): number => {
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  return db(peak);
};

/** Float samples to 16-bit (what the mp3 encoder takes). */
export function toInt16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767)));
  return out;
}
