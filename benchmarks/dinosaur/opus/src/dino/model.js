// 体素霸王龙：各部件单独生成，局部坐标 +X 向前、+Y 向上、+Z 向右。
import { Voxels, hash3 } from '../voxel/voxels.js';

export const DC = {
  body: 0x5f7d40, back: 0x46602f, stripe: 0x344a21, belly: 0xd3c592, bellyShade: 0xb9aa78,
  ridge: 0x7b5634, eye: 0xf6c63d, pupil: 0x15110b, brow: 0x3b5226, teeth: 0xf6f0de, mouth: 0x7c2a2d,
  tongue: 0xb9544f, claw: 0xebe1c4, nostril: 0x243020, spot: 0x789a52, toe: 0x4a6334, cheek: 0x6c8a49,
};

// 分段线性插值表
export function tbl(t, x) {
  if (x <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (x <= t[i][0]) { const [x0, a] = t[i - 1], [x1, b] = t[i]; return a + (b - a) * (x - x0) / (x1 - x0); }
  return t[t.length - 1][1];
}

function skinColor(x, y, z, ny, seed, o = {}) {
  if (ny > 0.62) return (o.stripes && ((x + 200) % 6) < 2) ? DC.stripe : DC.back;
  if (o.stripes && ny > 0.25 && ((x + 200) % 6) < 2) return DC.stripe;
  if (ny < -0.5) return DC.belly;
  if (ny < -0.3) return DC.bellyShade;
  if (hash3(x, y, z, seed) < 0.07) return DC.spot;
  return DC.body;
}

// 沿 x 放样的椭圆截面体
function loftX(v, x0, x1, yc, ry, rz, color, o = {}) {
  const ymax = 20, zmax = 12;
  for (let x = x0; x < x1; x++) {
    const cy = tbl(yc, x + 0.5), a = tbl(ry, x + 0.5), b = tbl(rz, x + 0.5);
    for (let y = Math.floor(cy - a) - 1; y <= Math.ceil(cy + a) + 1 && y < ymax + cy; y++) for (let z = -zmax; z < zmax; z++) {
      const ny = (y + 0.5 - cy) / a, nz = (z + 0.5) / b;
      const p = o.pow ?? 2;
      if (Math.abs(ny) ** p + Math.abs(nz) ** p > 1) continue;
      v.set(x, y, z, color(x, y, z, ny, nz));
    }
  }
}
// 沿 -y 放样（腿骨）
function loftY(v, y0, y1, xc, rx, rz, color) {
  for (let y = y0; y > y1; y--) {
    const yy = y - 0.5;
    const cx = tbl(xc, yy), a = tbl(rx, yy), b = tbl(rz, yy);
    for (let x = Math.floor(cx - a) - 1; x <= Math.ceil(cx + a) + 1; x++) for (let z = -8; z < 8; z++) {
      const nx = (x + 0.5 - cx) / a, nz = (z + 0.5) / b;
      if (nx * nx + nz * nz > 1) continue;
      v.set(x, y - 1, z, color(x, y - 1, z, nx, nz));
    }
  }
}

export function torso() {
  const v = new Voxels();
  loftX(v, -11, 19,
    [[-11, 2], [-4, 0.5], [2, 0], [9, 0], [14, 2.8], [19, 6.2]],
    [[-11, 5.4], [-5, 7.8], [2, 9.2], [9, 9.8], [14, 8.4], [19, 6.0]],
    [[-11, 4.4], [-5, 6.2], [2, 7.1], [9, 7.3], [14, 6.1], [19, 4.8]],
    (x, y, z, ny) => skinColor(x, y, z, ny, 101, { stripes: x < 13 }));
  addRidge(v, -11, 19, 2);
  return v;
}

export function neck() {
  const v = new Voxels();
  loftX(v, -2, 10, [[-2, -0.5], [10, 2.5]], [[-2, 6.2], [10, 4.8]], [[-2, 5.2], [10, 4.1]],
    (x, y, z, ny) => (ny < -0.35 ? DC.belly : skinColor(x, y, z, ny, 103, {})));
  addRidge(v, -2, 10, 2);
  return v;
}

function addRidge(v, x0, x1, every) {
  for (let x = x0; x < x1; x += every) {
    let top = -99;
    for (let y = -20; y < 30; y++) if (v.has(x, y, 0)) top = y;
    if (top > -99) { v.set(x, top + 1, 0, DC.ridge); v.set(x, top + 1, -1, DC.ridge); }
  }
}

// 头骨（上颌）：盒状超椭圆截面，y=0 是嘴线
export function head() {
  const v = new Voxels();
  const H = [[-3, 8], [2, 9], [7, 8], [12, 6.2], [16.5, 4.5]];
  const W = [[-3, 5.2], [2, 5.4], [7, 4.4], [12, 3.6], [16.5, 3]];
  for (let x = -3; x < 17; x++) {
    const h = tbl(H, x + 0.5), w = tbl(W, x + 0.5);
    for (let y = 0; y < Math.ceil(h); y++) for (let z = -7; z < 7; z++) {
      const ny = (y + 0.5 - h / 2) / (h / 2), nz = (z + 0.5) / w;
      if (ny ** 4 + nz ** 4 > 1) continue;
      let c = ny > 0.55 ? DC.back : ny < -0.4 ? DC.cheek : DC.body;
      if (hash3(x, y, z, 105) < 0.06 && ny > 0) c = DC.spot;
      if (y === 0 && Math.abs(z + 0.5) < w - 1.2 && x > -1) c = DC.mouth; // 口腔上颚（张嘴时可见）
      v.set(x, y, z, c);
    }
  }
  // 眼睛 + 眉骨（左右各一）
  for (const side of [-1, 1]) {
    const zs = (x, y) => { let e = 0; for (let z = 0; z < 8; z++) { const zz = side > 0 ? z : -z - 1; if (v.has(x, y, zz)) e = zz; } return e; };
    for (const [x, y] of [[3, 5], [4, 5], [3, 6], [4, 6]]) v.set(x, y, zs(x, y), DC.eye);
    v.set(4, 6, zs(4, 6), DC.pupil); v.set(4, 5, zs(4, 5), DC.pupil);
    for (let x = 2; x <= 6; x++) { const z = zs(x, 7); v.set(x, 7, z + side, DC.brow); v.set(x, 8, z, DC.brow); }
    // 鼻孔
    v.set(15, 3, side > 0 ? 1 : -2, DC.nostril);
    // 上排牙：沿外缘，偶数 x
    for (let x = 1; x < 16; x += 2) { const w = tbl(W, x + 0.5); const z = side > 0 ? Math.floor(w - 1.2) : -Math.floor(w - 1.2) - 1; v.set(x, -1, z, DC.teeth); }
  }
  // 头顶粗糙鳞突
  for (let x = -2; x < 8; x += 3) { v.set(x, 9, -1, DC.ridge); v.set(x, 9, 0, DC.ridge); }
  return v;
}

// 下颌：以头部坐标生成后平移到枢轴（头部 x=-1, y=0）
export function jaw() {
  const v = new Voxels();
  const W = [[-2, 4.8], [7, 3.9], [15.5, 2.8]];
  const B = [[-2, -6.5], [7, -5.2], [15.5, -3.6]];
  for (let x = -2; x < 16; x++) {
    const w = tbl(W, x + 0.5), bot = tbl(B, x + 0.5);
    for (let y = Math.floor(bot); y < -1; y++) for (let z = -6; z < 6; z++) {
      const nz = (z + 0.5) / w;
      const ny = (y + 0.5 - (bot - 1) / 2) / ((-1 - bot) / 2 + 0.01);
      if (nz ** 4 + Math.min(1, Math.abs(ny)) ** 4 > 1.05) continue;
      let c = y <= bot + 0.5 ? DC.belly : DC.body;
      if (y === -2 && Math.abs(z + 0.5) < w - 1.2) c = (x > 2 && x < 11 && (z === 0 || z === -1)) ? DC.tongue : DC.mouth;
      v.set(x, y, z, c);
    }
    if (x % 2 === 0 && x > 0 && x < 15) for (const side of [-1, 1]) { const z = side > 0 ? Math.floor(w - 1.2) : -Math.floor(w - 1.2) - 1; v.set(x, -1, z, DC.teeth); }
  }
  const out = new Voxels(); out.merge(v, 0, 1, 0, 0);
  return out;
}

export function upperArm() {
  const v = new Voxels();
  v.box(-1, -5, -1, 1, 1, 1, (x, y) => (y < -3 ? DC.belly : DC.body));
  return v;
}
export function foreArm() {
  const v = new Voxels();
  v.box(0, -1, -1, 4, 1, 1, DC.body);
  v.set(4, -1, -1, DC.claw); v.set(4, -1, 0, DC.claw); v.set(5, -2, -1, DC.claw); v.set(5, -2, 0, DC.claw);
  return v;
}

export const LEG = { L1: 15, L2: 15, L3: 9 };

export function thigh() {
  const v = new Voxels();
  // 鸡腿形：上粗下细，后缘深色
  loftY(v, 3, -16, [[3, 0.2], [-4, 1.4], [-15, 0.6]], [[3, 5.0], [-3, 6.3], [-9, 4.5], [-16, 2.7]], [[3, 4.0], [-4, 4.3], [-16, 2.5]],
    (x, y, z, nx) => (hash3(x, y, z, 107) < 0.06 ? DC.spot : nx < -0.45 ? DC.back : (nx > 0.6 && y < -9 ? DC.bellyShade : DC.body)));
  return v;
}
export function shin() {
  const v = new Voxels();
  loftY(v, 2, -15, [[2, -0.6], [-4, -1.1], [-15, 0]], [[2, 3.0], [-4, 3.3], [-15, 1.9]], [[2, 2.5], [-15, 1.8]],
    (x, y, z, nx) => (hash3(x, y, z, 109) < 0.07 ? DC.spot : nx < -0.4 ? DC.back : ((y + 40) % 4 === 0 ? DC.toe : DC.body)));
  return v;
}
export function metatarsus() {
  const v = new Voxels();
  loftY(v, 1, -9, [[1, 0], [-9, 0]], [[1, 2.0], [-9, 1.7]], [[1, 1.9], [-9, 1.6]], (x, y, z) => ((y + 20) % 3 === 0 ? 0x3d5429 : DC.toe));
  return v;
}
// 脚掌：枢轴在跖球中心（离地 2），三趾前伸 + 爪
export function foot() {
  const v = new Voxels();
  v.box(-3, -2, -2, 2, 0, 2, DC.toe);
  const toe = (ang, len) => {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (let t = 0; t <= len; t += 0.5) {
      const x = Math.round(1 + ca * t), z = Math.round(sa * t);
      for (const dz of [-1, 0]) { v.set(x, -2, z + dz, DC.toe); if (t < len - 1.5) v.set(x, -1, z + dz, DC.toe); }
    }
    const tx = Math.round(1 + ca * (len + 1)), tz = Math.round(sa * (len + 1));
    v.set(tx, -2, tz, DC.claw); v.set(tx, -2, tz - 1, DC.claw); v.set(tx, -1, tz - 1, DC.claw);
  };
  toe(0, 6.5); toe(0.5, 5); toe(-0.5, 5);
  v.set(-4, -2, 0, DC.claw); // 后趾
  return v;
}

export const TAIL = {
  lens: [7, 7, 6.5, 6, 5.5, 5, 5],
  rad: [[5.4, 4.6], [4.6, 3.8], [3.8, 3.1], [3.1, 2.5], [2.5, 1.9], [1.9, 1.4], [1.4, 0.9]],
};
// 尾段：从枢轴沿 -X 延伸，截面逐渐变细
export function tailSegment(i) {
  const v = new Voxels();
  const L = TAIL.lens[i], [ra, rb] = TAIL.rad[i];
  const ra2 = TAIL.rad[i][0] * 1.1, rb2 = TAIL.rad[i][1] * 1.1;
  loftX(v, -Math.ceil(L) - 1, 1,
    [[-L - 1, 0], [1, 0]],
    [[-L - 1, rb2], [1, ra2]],
    [[-L - 1, rb * 0.95], [1, ra * 0.95]],
    (x, y, z, ny) => skinColor(x - i * 7, y, z, ny, 111 + i, { stripes: true }));
  addRidge(v, -Math.ceil(L), 1, 2);
  return v;
}
