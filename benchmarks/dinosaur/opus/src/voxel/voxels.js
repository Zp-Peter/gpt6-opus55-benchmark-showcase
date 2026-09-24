// 稀疏体素存储 + 面剔除网格化（顶点 AO + 逐体素明度抖动）。
// 世界单位 = 1 体素。所有城市、恐龙、车辆、碎块都用同一尺度。
import * as THREE from 'three';

export const MAT = { MATTE: 0, GLASS: 1, METAL: 2, GLOW: 3 };

const OFF = 2048;
const SPAN = 4096;
const SY = SPAN;          // y 步长
const SX = SPAN * SPAN;   // x 步长
export const vkey = (x, y, z) => (x + OFF) * SX + (y + OFF) * SY + (z + OFF);
export function unkey(k) {
  const z = (k % SPAN) - OFF;
  const r = (k - (z + OFF)) / SPAN;
  const y = (r % SPAN) - OFF;
  const x = (r - (y + OFF)) / SPAN - OFF;
  return [x, y, z];
}
const MATK = 16777216; // 2^24

export class Voxels {
  constructor() { this.map = new Map(); }
  set(x, y, z, col, mat = 0) { this.map.set(vkey(x, y, z), col + mat * MATK); }
  get(x, y, z) { return this.map.get(vkey(x, y, z)); }
  has(x, y, z) { return this.map.has(vkey(x, y, z)); }
  del(x, y, z) { this.map.delete(vkey(x, y, z)); }
  get size() { return this.map.size; }
  // [x0,x1) × [y0,y1) × [z0,z1)；col 可以是函数 (x,y,z)=>颜色|null
  box(x0, y0, z0, x1, y1, z1, col, mat = 0) {
    for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) {
      const c = typeof col === 'function' ? col(x, y, z) : col;
      if (c === null || c === undefined) continue;
      if (Array.isArray(c)) this.set(x, y, z, c[0], c[1]);
      else this.set(x, y, z, c, mat);
    }
  }
  clear(x0, y0, z0, x1, y1, z1) {
    for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) this.del(x, y, z);
  }
  // 把另一组体素按 90° 倍数旋转后平移并入
  merge(src, rot = 0, ox = 0, oy = 0, oz = 0) {
    for (const [k, v] of src.map) {
      const [x, y, z] = unkey(k);
      const [rx, rz] = rot90(x, z, rot);
      this.map.set(vkey(rx + ox, y + oy, rz + oz), v);
    }
    return this;
  }
  bounds() {
    let a = [Infinity, Infinity, Infinity], b = [-Infinity, -Infinity, -Infinity];
    for (const k of this.map.keys()) {
      const p = unkey(k);
      for (let i = 0; i < 3; i++) { if (p[i] < a[i]) a[i] = p[i]; if (p[i] + 1 > b[i]) b[i] = p[i] + 1; }
    }
    return { min: a, max: b };
  }
}

// 体素坐标绕 y 轴旋转 rot×90°（保持占据格而不是格点）
export function rot90(x, z, rot) {
  switch (((rot % 4) + 4) % 4) {
    case 0: return [x, z];
    case 1: return [-z - 1, x];
    case 2: return [-x - 1, -z - 1];
    default: return [z, -x - 1];
  }
}

export function colorOf(v) { return v % MATK; }
export function matOf(v) { return Math.floor(v / MATK); }

// ── 网格化 ─────────────────────────────────────────────
const FACES = [
  { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1], o: [1, 0, 0] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], o: [0, 0, 0] },
  { n: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0], o: [0, 1, 0] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], o: [0, 0, 0] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], o: [0, 0, 1] },
  { n: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0], o: [0, 0, 0] },
];
const dk = (d) => d[0] * SX + d[1] * SY + d[2];
for (const f of FACES) { f.nk = dk(f.n); f.uk = dk(f.u); f.vk = dk(f.v); }
const AO_LEVEL = [0.5, 0.66, 0.82, 1.0];

export function hash3(x, y, z, s = 0) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const _c = new THREE.Color();
const linCache = new Map();
function linear(hex) {
  let c = linCache.get(hex);
  if (!c) { _c.setHex(hex); c = [_c.r, _c.g, _c.b]; linCache.set(hex, c); }
  return c;
}

/**
 * @param {Voxels} vox
 * @param {object} o
 *   keys: 仅网格化这些键（默认全部）
 *   solid(k): 邻格是否遮挡该面（默认：存在即遮挡）
 *   aoSolid(k): AO 采样用的占据判断（默认同 solid）
 *   pivot: [x,y,z] 网格原点（体素坐标）
 */
export function meshVoxels(vox, o = {}) {
  const map = vox.map;
  const keys = o.keys ?? map.keys();
  const solid = o.solid ?? ((k) => map.has(k));
  const aoSolid = o.aoSolid ?? solid;
  const px = o.pivot?.[0] ?? 0, py = o.pivot?.[1] ?? 0, pz = o.pivot?.[2] ?? 0;
  const jit = o.jitter ?? 0.07;
  const seed = o.seed ?? 7;
  const buckets = [[], [], [], []]; // 每种材质一个 {pos,nrm,col}
  const pos = [[], [], [], []], nrm = [[], [], [], []], col = [[], [], [], []], idx = [[], [], [], []];
  const ao = [0, 0, 0, 0];
  for (const k of keys) {
    const val = map.get(k);
    if (val === undefined) continue;
    const [x, y, z] = unkey(k);
    const m = matOf(val);
    const base = linear(colorOf(val));
    const j = 1 + (hash3(x, y, z, seed) - 0.5) * 2 * jit;
    for (let fi = 0; fi < 6; fi++) {
      const f = FACES[fi];
      const nk = k + f.nk;
      if (solid(nk, k)) continue;
      // 四角 AO
      for (let c = 0; c < 4; c++) {
        const a = c === 1 || c === 2 ? 1 : 0;
        const b = c >= 2 ? 1 : 0;
        const du = a ? f.uk : -f.uk;
        const dv = b ? f.vk : -f.vk;
        const s1 = aoSolid(nk + du) ? 1 : 0;
        const s2 = aoSolid(nk + dv) ? 1 : 0;
        const cc = aoSolid(nk + du + dv) ? 1 : 0;
        ao[c] = s1 && s2 ? 0 : 3 - (s1 + s2 + cc);
      }
      const P = pos[m], N = nrm[m], C = col[m], I = idx[m];
      const vi = P.length / 3;
      for (let c = 0; c < 4; c++) {
        const a = c === 1 || c === 2 ? 1 : 0;
        const b = c >= 2 ? 1 : 0;
        P.push(
          x + f.o[0] + a * f.u[0] + b * f.v[0] - px,
          y + f.o[1] + a * f.u[1] + b * f.v[1] - py,
          z + f.o[2] + a * f.u[2] + b * f.v[2] - pz,
        );
        N.push(f.n[0], f.n[1], f.n[2]);
        const l = m === MAT.GLOW ? 1 : AO_LEVEL[ao[c]];
        C.push(base[0] * j * l, base[1] * j * l, base[2] * j * l);
      }
      if (ao[0] + ao[2] > ao[1] + ao[3]) I.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
      else I.push(vi + 1, vi + 2, vi + 3, vi + 1, vi + 3, vi);
    }
  }
  // 合并成一个带 group 的几何体
  let nv = 0, ni = 0;
  for (let m = 0; m < 4; m++) { nv += pos[m].length / 3; ni += idx[m].length; }
  const P = new Float32Array(nv * 3), N = new Int8Array(nv * 3), C = new Uint8Array(nv * 3);
  const I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const g = new THREE.BufferGeometry();
  let vo = 0, io = 0;
  for (let m = 0; m < 4; m++) {
    const pm = pos[m], cm = col[m], nm = nrm[m], im = idx[m];
    P.set(pm, vo * 3);
    for (let i = 0; i < nm.length; i++) N[vo * 3 + i] = nm[i] * 127;
    for (let i = 0; i < cm.length; i++) C[vo * 3 + i] = Math.max(0, Math.min(255, Math.round(Math.sqrt(Math.min(1, cm[i])) * 255)));
    for (let i = 0; i < im.length; i++) I[io + i] = im[i] + vo;
    if (im.length) g.addGroup(io, im.length, m);
    vo += pm.length / 3; io += im.length;
  }
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3, true));
  g.setAttribute('color', new THREE.BufferAttribute(C, 3, true));
  g.setIndex(new THREE.BufferAttribute(I, 1));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

// 颜色以 Uint8 存储时用 sqrt 做了近似感知编码，材质里用 onBeforeCompile 平方还原成线性。
export function decodeColorChunk(shader) {
  shader.vertexShader = shader.vertexShader.replace(
    '#include <color_vertex>',
    '#include <color_vertex>\n#ifdef USE_COLOR\n vColor.rgb *= vColor.rgb;\n#endif',
  );
}
