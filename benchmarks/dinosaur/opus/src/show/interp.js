// 单调三次 Hermite（PCHIP）：关键帧之间平滑、在停顿处不过冲。
export class Track {
  constructor(keys) { // keys: [[t, v], ...] 已按时间排序
    this.t = keys.map((k) => k[0]); this.v = keys.map((k) => k[1]);
    const n = this.t.length;
    const d = new Array(n).fill(0), m = new Array(n - 1);
    for (let i = 0; i < n - 1; i++) m[i] = (this.v[i + 1] - this.v[i]) / Math.max(1e-6, this.t[i + 1] - this.t[i]);
    for (let i = 1; i < n - 1; i++) {
      if (m[i - 1] * m[i] <= 0) d[i] = 0;
      else {
        const h0 = this.t[i] - this.t[i - 1], h1 = this.t[i + 1] - this.t[i];
        const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
        d[i] = (w1 + w2) / (w1 / m[i - 1] + w2 / m[i]);
      }
    }
    if (n > 1) { d[0] = 0; d[n - 1] = 0; }
    this.d = d;
  }
  at(x) {
    const T = this.t, V = this.v, n = T.length;
    if (n === 1 || x <= T[0]) return V[0];
    if (x >= T[n - 1]) return V[n - 1];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (T[mid] <= x) lo = mid; else hi = mid; }
    const h = T[hi] - T[lo], s = (x - T[lo]) / h;
    const s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * V[lo] + (s3 - 2 * s2 + s) * h * this.d[lo] + (-2 * s3 + 3 * s2) * V[hi] + (s3 - s2) * h * this.d[hi];
  }
}

// 参数轨道：[t, v] 关键帧，未指定处为 0
export function tracks(def) {
  const out = {};
  for (const [k, keys] of Object.entries(def)) out[k] = new Track(keys);
  return out;
}
