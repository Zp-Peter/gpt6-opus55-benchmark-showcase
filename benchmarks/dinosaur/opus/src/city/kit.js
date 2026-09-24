// 体素建筑构件工具：立面（窗、阳台、店面、遮阳篷、招牌）、屋顶（女儿墙、水箱、空调、坡屋顶）。
// 局部坐标：x∈[0,w) z∈[0,d) y 从 0（地块表面）向上；“正面”朝 -z。
import { MAT, hash3 } from '../voxel/voxels.js';

export const C = {
  glass: 0x3b5570, glassHi: 0x7d9db6, glassDark: 0x243447, curtain: 0xd9c49a, lit: 0xffd98a,
  frame: 0xf1ece0, sill: 0xe6dfcf, roof: 0x5d6068, roofLight: 0x7b7e84, gravel: 0x8a8a86,
  coping: 0xcfc8b8, metal: 0xa9b0b6, metalDark: 0x6d747b, dark: 0x2c2f35, door: 0x6b4630,
  wood: 0x8a5d3b, woodDark: 0x5e3e27, terracotta: 0xb65d3e, terracottaDark: 0x94472f,
  slate: 0x4f5866, slateDark: 0x3f4753, green: 0x5f9444, greenDark: 0x3f6a31, white: 0xf3efe6,
};

export const FACE = {
  // s 从观看者的左向右递增（保证招牌文字不镜像）
  front: (w, d) => ({ len: w, at: (s, y, k) => [w - 1 - s, y, -k] }),
  back: (w, d) => ({ len: w, at: (s, y, k) => [s, y, d - 1 + k] }),
  left: (w, d) => ({ len: d, at: (s, y, k) => [-k, y, s] }),
  right: (w, d) => ({ len: d, at: (s, y, k) => [w - 1 + k, y, d - 1 - s] }),
};

export class Kit {
  constructor(v, w, d, seed = 1) { this.v = v; this.w = w; this.d = d; this.seed = seed; }
  face(name) { return FACE[name](this.w, this.d); }
  rnd(a, b = 0, c = 0) { return hash3(a, b, c, this.seed); }
  put(f, s, y, k, col, mat = 0) { const [x, yy, z] = f.at(s, y, k); this.v.set(x, yy, z, col, mat); }
  del(f, s, y, k) { const [x, yy, z] = f.at(s, y, k); this.v.del(x, yy, z); }
  rect(f, s0, s1, y0, y1, k, col, mat = 0) {
    for (let s = s0; s < s1; s++) for (let y = y0; y < y1; y++) {
      const c = typeof col === 'function' ? col(s, y) : col;
      if (c == null) continue;
      if (Array.isArray(c)) this.put(f, s, y, k, c[0], c[1]); else this.put(f, s, y, k, c, mat);
    }
  }
  clearRect(f, s0, s1, y0, y1, k) { for (let s = s0; s < s1; s++) for (let y = y0; y < y1; y++) this.del(f, s, y, k); }

  // 外墙（1 体素厚）+ 楼板
  shell(h, wallCol, { slabs = [], inner = 0x9a8f80, slabCol = 0x8d8a84 } = {}) {
    const { w, d, v } = this;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) { setc(v, x, y, 0, pick(wallCol, x, y, 0)); setc(v, x, y, d - 1, pick(wallCol, x, y, d - 1)); }
      for (let z = 1; z < d - 1; z++) { setc(v, 0, y, z, pick(wallCol, 0, y, z)); setc(v, w - 1, y, z, pick(wallCol, w - 1, y, z)); }
    }
    for (const sy of [0, ...slabs]) for (let x = 1; x < w - 1; x++) for (let z = 1; z < d - 1; z++) v.set(x, sy, z, sy === 0 ? 0x77736c : slabCol);
    // 内墙面颜色：让破口看到的室内偏暗、与外墙区分
    this.innerCol = inner;
  }
  // 屋顶板 + 女儿墙 + 压顶
  roofFlat(h, { parapet = 2, col = C.roof, coping = C.coping, wallCol, cornice = false } = {}) {
    const { w, d, v } = this;
    for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) v.set(x, h, z, (x + z) % 7 === 0 ? C.roofLight : col);
    for (let y = h + 1; y <= h + parapet; y++) {
      const top = y === h + parapet;
      for (let x = 0; x < w; x++) { setc(v, x, y, 0, top ? coping : pick(wallCol, x, y, 0)); setc(v, x, y, d - 1, top ? coping : pick(wallCol, x, y, d - 1)); }
      for (let z = 1; z < d - 1; z++) { setc(v, 0, y, z, top ? coping : pick(wallCol, 0, y, z)); setc(v, w - 1, y, z, top ? coping : pick(wallCol, w - 1, y, z)); }
    }
    if (cornice) {
      const y = h;
      for (let x = -1; x <= w; x++) { v.set(x, y, -1, coping); v.set(x, y, d, coping); }
      for (let z = 0; z < d; z++) { v.set(-1, y, z, coping); v.set(w, y, z, coping); }
    }
  }
  // 均匀排布：返回每个开口起点 s
  static spread(len, ww, gap, margin) {
    const n = Math.max(0, Math.floor((len - 2 * margin + gap) / (ww + gap)));
    const tot = n * (ww + gap) - gap;
    const s0 = Math.floor((len - tot) / 2);
    return Array.from({ length: n }, (_, i) => s0 + i * (ww + gap));
  }
  // 凹入式窗：玻璃在墙内侧 1 格，外侧留洞，窗台外凸
  window(f, s0, y0, ww, wh, o = {}) {
    const style = o.style ?? 'plain';
    const lit = o.lit ?? false;
    const curtain = o.curtain ?? false;
    for (let s = s0; s < s0 + ww; s++) for (let y = y0; y < y0 + wh; y++) {
      this.del(f, s, y, 0);
      let c = y === y0 + wh - 1 ? C.glassHi : (curtain && y >= y0 + wh - 2 ? C.curtain : C.glass);
      if (lit && y < y0 + wh - 1) { this.put(f, s, y, -1, C.lit, MAT.GLOW); continue; }
      if (ww >= 3 && s === s0 + (ww >> 1) && style !== 'shop') c = o.mullion ?? C.frame, this.put(f, s, y, 0, c);
      else this.put(f, s, y, -1, c, c === C.curtain ? MAT.MATTE : MAT.GLASS);
    }
    if (o.sill !== false) for (let s = s0 - (o.wideSill ? 1 : 0); s < s0 + ww + (o.wideSill ? 1 : 0); s++) this.put(f, s, y0 - 1, 1, o.sillCol ?? C.sill);
    if (o.lintel) for (let s = s0 - 1; s < s0 + ww + 1; s++) this.put(f, s, y0 + wh, 0, o.lintel);
    if (o.shutter) for (let y = y0; y < y0 + wh; y++) { this.put(f, s0 - 1, y, 0, o.shutter); this.put(f, s0 + ww, y, 0, o.shutter); }
    if (o.flowers) {
      for (let s = s0; s < s0 + ww; s++) {
        this.put(f, s, y0 - 1, 1, C.woodDark);
        const r = this.rnd(s, y0, 5);
        this.put(f, s, y0, 1, r < 0.35 ? 0xe0506a : r < 0.6 ? 0xf2c14e : C.green);
      }
    }
  }
  // 阳台：楼板外挑 + 栏杆 + 落地玻璃门
  balcony(f, s0, y0, ww, depth = 2, o = {}) {
    const rail = o.rail ?? C.white;
    for (let s = s0 - 1; s < s0 + ww + 1; s++) {
      for (let k = 1; k <= depth; k++) this.put(f, s, y0, k, o.slab ?? 0xd8d2c4);
      this.put(f, s, y0 + 1, depth, rail, o.railMat ?? 0);
      if ((s - s0) % 2 === 0) this.put(f, s, y0 + 2, depth, rail, o.railMat ?? 0);
    }
    for (let k = 1; k < depth; k++) { this.put(f, s0 - 1, y0 + 1, k, rail); this.put(f, s0 + ww, y0 + 1, k, rail); this.put(f, s0 - 1, y0 + 2, k, rail); this.put(f, s0 + ww, y0 + 2, k, rail); }
    for (let s = s0; s < s0 + ww; s++) for (let y = y0 + 1; y < y0 + 6; y++) {
      this.del(f, s, y, 0);
      this.put(f, s, y, -1, y === y0 + 5 ? C.glassHi : C.glass, MAT.GLASS);
    }
    if (o.plant) { this.put(f, s0 - 0, y0 + 1, 1, C.woodDark); this.put(f, s0, y0 + 2, 1, C.green); }
  }
  // 店面：大玻璃 + 门 + 基座
  storefront(f, s0, s1, h, o = {}) {
    const doorAt = o.door ?? Math.floor((s0 + s1) / 2) - 1;
    for (let s = s0; s < s1; s++) {
      const col = (s - s0) % (o.bay ?? 6) === 0 && s !== s0;
      for (let y = 0; y < h; y++) {
        if (y === 0) { this.put(f, s, 0, 0, o.base ?? 0x4a4642); continue; }
        this.del(f, s, y, 0);
        if (col || y === h - 1) { this.put(f, s, y, 0, o.frame ?? C.frame, o.frameMat ?? 0); continue; }
        const isDoor = s >= doorAt && s < doorAt + 2;
        if (isDoor) this.put(f, s, y, -1, y >= h - 2 ? C.glassHi : (o.doorCol ?? C.door), y >= h - 2 ? MAT.GLASS : 0);
        else if (o.lit && y < h - 2 && this.rnd(s, y, 9) < 0.5) this.put(f, s, y, -1, C.lit, MAT.GLOW);
        else this.put(f, s, y, -1, y >= h - 2 ? C.glassHi : C.glass, MAT.GLASS);
        // 橱窗里的货架/桌椅
        if (!isDoor && y === 1 && (s % 3) !== 0) this.put(f, s, y, -2, o.goods ?? 0xc98b4f);
      }
    }
  }
  // 斜挑的条纹遮阳篷
  awning(f, s0, s1, y, depth, colA, colB = C.white) {
    for (let s = s0; s < s1; s++) {
      const c = Math.floor((s - s0) / 2) % 2 === 0 ? colA : colB;
      for (let k = 1; k <= depth; k++) this.put(f, s, y - Math.floor((k - 1) / 1.6), k, c);
      this.put(f, s, y - Math.floor((depth - 1) / 1.6) - 1, depth, c); // 垂边
    }
  }
  // 招牌：底板 + 像素字
  sign(f, s0, y0, text, o = {}) {
    const wText = text.length * 4 - 1;
    const pad = o.pad ?? 1;
    const W = wText + pad * 2, H = 5 + pad * 2;
    const k = o.k ?? 1;
    for (let s = 0; s < W; s++) for (let y = 0; y < H; y++) this.put(f, s0 + s, y0 + y, k, o.board ?? 0x2d3a4a);
    if (o.frame) for (let s = -1; s <= W; s++) { this.put(f, s0 + s, y0 - 1, k, o.frame, o.frameMat ?? 0); this.put(f, s0 + s, y0 + H, k, o.frame, o.frameMat ?? 0); }
    drawText(text, (x, y) => this.put(f, s0 + pad + x, y0 + pad + y, k + (o.raise ? 1 : 0), o.ink ?? 0xf6e7b0, o.inkMat ?? MAT.MATTE));
    return W;
  }
  // 屋顶设备
  acUnit(x, y, z, rot = 0) {
    const v = this.v;
    const [w, d] = rot ? [3, 4] : [4, 3];
    v.box(x, y, z, x + w, y + 3, z + d, (xx, yy, zz) => (yy === y + 2 && xx > x && xx < x + w - 1 && zz > z && zz < z + d - 1 ? C.dark : C.metal), MAT.METAL);
  }
  waterTank(cx, y, cz, r = 3, h = 6) {
    const v = this.v;
    for (const [dx, dz] of [[-r + 1, -r + 1], [r - 1, -r + 1], [-r + 1, r - 1], [r - 1, r - 1]]) v.box(cx + dx, y, cz + dz, cx + dx + 1, y + 3, cz + dz + 1, C.metalDark, MAT.METAL);
    for (let yy = y + 3; yy < y + 3 + h; yy++) for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) {
      if (x * x + z * z > r * r + 1) continue;
      v.set(cx + x, yy, cz + z, (yy - y) % 3 === 0 ? C.woodDark : C.wood);
    }
    for (let x = -r + 1; x <= r - 1; x++) for (let z = -r + 1; z <= r - 1; z++) if (x * x + z * z <= (r - 1) * (r - 1) + 1) v.set(cx + x, y + 3 + h, cz + z, C.slateDark);
    v.set(cx, y + 4 + h, cz, C.slateDark);
  }
  bulkhead(x, y, z, w = 5, d = 5, h = 6, col = 0xbdb5a5) {
    this.v.box(x, y, z, x + w, y + h, z + d, col);
    this.v.box(x - 0, y + h, z - 0, x + w, y + h + 1, z + d, C.roof);
    this.v.box(x + 1, y, z - 1 + 1, x + 3, y + 4, z + 1, C.door); // 门
  }
  antenna(x, y, z, h = 10) {
    for (let i = 0; i < h; i++) this.v.set(x, y + i, z, C.metal, MAT.METAL);
    this.v.set(x - 1, y + Math.floor(h * 0.6), z, C.metal, MAT.METAL); this.v.set(x + 1, y + Math.floor(h * 0.6), z, C.metal, MAT.METAL);
    this.v.set(x, y + h, z, 0xff4a3a, MAT.GLOW);
  }
  // 沿 x 方向屋脊的双坡屋顶（体素阶梯）
  gableRoof(y0, colA, colB, wallCol, { overhang = 1, chimneyAt = null } = {}) {
    const { w, d, v } = this;
    let i = 0;
    while (true) {
      const z0 = -overhang + i, z1 = d + overhang - i;
      if (z1 - z0 <= 0) break;
      const y = y0 + i;
      for (let x = -overhang; x < w + overhang; x++) {
        for (let z = z0; z < z1; z++) {
          const edge = z === z0 || z === z1 - 1 || z1 - z0 <= 2;
          if (edge) v.set(x, y, z, i % 2 === 0 ? colA : colB);
          else if (x === 0 || x === w - 1) setc(v, x, y, z, pick(wallCol, x, y, z)); // 山墙
        }
      }
      i++;
    }
    const top = y0 + i;
    if (chimneyAt) {
      const [cx, cz] = chimneyAt;
      for (let y = y0; y < top + 2; y++) for (let x = cx; x < cx + 2; x++) for (let z = cz; z < cz + 2; z++) v.set(x, y, z, y === top + 1 ? C.dark : 0x9b5a45);
    }
    return top;
  }
}

function pick(col, x, y, z) { return typeof col === 'function' ? col(x, y, z) : col; }
// 写入一个颜色描述：数字 / [颜色, 材质] / null(跳过)
function setc(v, x, y, z, c) {
  if (c == null) return;
  if (Array.isArray(c)) v.set(x, y, z, c[0], c[1]); else v.set(x, y, z, c);
}

// 砖墙：砖行错缝 + 轻微深浅
export function brick(base, mortar) {
  return (x, y, z) => {
    const row = y % 3 === 2;
    if (row) return mortar;
    const off = Math.floor(y / 3) % 2 ? 2 : 0;
    return ((x + z + off) % 4 === 0) ? shade(base, 0.9) : base;
  };
}
export function banded(base, band, every = 8, at = 0) {
  return (x, y) => (y % every === at ? band : base);
}
export function shade(hex, f) {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * f));
  const b = Math.min(255, Math.round((hex & 255) * f));
  return (r << 16) | (g << 8) | b;
}

// 3×5 像素字
const FONT = {
  A: ['010', '101', '111', '101', '101'], B: ['110', '101', '110', '101', '110'], C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'], E: ['111', '100', '110', '100', '111'], F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'], H: ['101', '101', '111', '101', '101'], I: ['111', '010', '010', '010', '111'],
  K: ['101', '110', '100', '110', '101'], L: ['100', '100', '100', '100', '111'], M: ['101', '111', '111', '101', '101'],
  N: ['110', '101', '101', '101', '101'], O: ['010', '101', '101', '101', '010'], P: ['110', '101', '110', '100', '100'],
  R: ['110', '101', '110', '101', '101'], S: ['011', '100', '010', '001', '110'], T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '011'], Y: ['101', '101', '010', '010', '010'], 2: ['110', '001', '010', '100', '111'],
  4: ['101', '101', '111', '001', '001'], ' ': ['000', '000', '000', '000', '000'], '&': ['010', '101', '010', '101', '011'],
};
export function drawText(text, plot) {
  let cx = 0;
  for (const ch of text) {
    const g = FONT[ch] ?? FONT[' '];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (g[r][c] === '1') plot(cx + c, 4 - r);
    cx += 4;
  }
}
