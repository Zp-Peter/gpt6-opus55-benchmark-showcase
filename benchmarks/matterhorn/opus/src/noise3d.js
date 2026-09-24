// 可平铺的 3D “Perlin-Worley” 噪声体，用于体积云
export function makeCloudNoise(N = 64) {
  const hash = (i) => {
    i = Math.imul(i ^ (i >>> 16), 0x45d9f3b);
    i = Math.imul(i ^ (i >>> 16), 0x45d9f3b);
    return ((i ^ (i >>> 16)) >>> 0) / 4294967296;
  };
  const wrap = (a, m) => ((a % m) + m) % m;

  function worleyPts(f, seed) {
    const pts = new Float32Array(f * f * f * 3);
    for (let i = 0; i < f * f * f; i++) for (let k = 0; k < 3; k++) pts[i * 3 + k] = hash(i * 3 + k + seed * 7919);
    return pts;
  }
  function worley(x, y, z, f, pts) {
    const X = x * f, Y = y * f, Z = z * f;
    const cx = Math.floor(X), cy = Math.floor(Y), cz = Math.floor(Z);
    let md = 9;
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const gx = cx + dx, gy = cy + dy, gz = cz + dz;
      const id = (wrap(gz, f) * f + wrap(gy, f)) * f + wrap(gx, f);
      const px = gx + pts[id * 3] - X, py = gy + pts[id * 3 + 1] - Y, pz = gz + pts[id * 3 + 2] - Z;
      const d = px * px + py * py + pz * pz;
      if (d < md) md = d;
    }
    return 1 - Math.min(Math.sqrt(md), 1);
  }
  function valueNoise(x, y, z, f, seed) {
    const X = x * f, Y = y * f, Z = z * f;
    const ix = Math.floor(X), iy = Math.floor(Y), iz = Math.floor(Z);
    const fx = X - ix, fy = Y - iy, fz = Z - iz;
    const s = (t) => t * t * (3 - 2 * t);
    const ux = s(fx), uy = s(fy), uz = s(fz);
    const v = (a, b, c) => hash(((wrap(c, f) * f + wrap(b, f)) * f + wrap(a, f)) + seed * 104729);
    const l = (a, b, t) => a + (b - a) * t;
    return l(
      l(l(v(ix, iy, iz), v(ix + 1, iy, iz), ux), l(v(ix, iy + 1, iz), v(ix + 1, iy + 1, iz), ux), uy),
      l(l(v(ix, iy, iz + 1), v(ix + 1, iy, iz + 1), ux), l(v(ix, iy + 1, iz + 1), v(ix + 1, iy + 1, iz + 1), ux), uy),
      uz,
    );
  }

  const W = [worleyPts(3, 1), worleyPts(6, 2), worleyPts(12, 3)];
  const data = new Uint8Array(N * N * N);
  let i = 0;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, w = z / N;
    const wf = worley(u, v, w, 3, W[0]) * 0.625 + worley(u, v, w, 6, W[1]) * 0.25 + worley(u, v, w, 12, W[2]) * 0.125;
    const pf = valueNoise(u, v, w, 4, 1) * 0.5 + valueNoise(u, v, w, 8, 2) * 0.3 + valueNoise(u, v, w, 16, 3) * 0.2;
    // Perlin-Worley：用 worley 重映射 value 噪声，得到团块状又带絮边的结构
    let pw = (pf - (1 - wf)) / (1 - (1 - wf) + 1e-4);
    pw = Math.min(Math.max(pw, 0), 1);
    const val = Math.min(Math.max(0.55 * pw + 0.45 * wf, 0), 1);
    data[i++] = Math.round(val * 255);
  }
  return data;
}
