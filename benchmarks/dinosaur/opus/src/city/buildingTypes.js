// 各类建筑的体素生成器。返回 { vox, w, d, h }，局部坐标正面朝 -z。
import { Voxels, MAT } from '../voxel/voxels.js';
import { Kit, C, brick, banded, shade } from './kit.js';
import { FLOOR } from './layout.js';

const FH = FLOOR;

// ── 街角小店（踩踏目标）：单层高店面 + 假立面招牌 + 条纹遮阳篷 ──
export function cornerShop(o = {}) {
  const w = o.w ?? 20, d = o.d ?? 14, v = new Voxels(), k = new Kit(v, w, d, 11);
  const wall = o.wall ?? 0x86c3a9, H = 10;
  const wallF = (x, y) => (y === 0 ? 0x5b6a62 : (y % 4 === 3 && (x % 2 === 0) ? shade(wall, 0.94) : wall));
  k.shell(H, wallF, { slabs: [] });
  k.roofFlat(H, { parapet: 1, wallCol: wallF, coping: 0xe9e2d0 });
  const f = k.face('front');
  k.storefront(f, 1, w - 1, 7, { bay: 6, door: 8, goods: 0xe6a24a, frame: 0xf4efe4 });
  k.awning(f, 1, w - 1, 7, 3, 0xd8453a);
  // 假立面：正面墙继续升高成招牌墙
  for (let s = 0; s < w; s++) for (let y = H + 1; y < H + 7; y++) k.put(f, s, y, 0, y === H + 6 ? 0xe9e2d0 : wallF(s, y));
  k.sign(f, 3, H - 1, 'SHOP', { board: 0x2f4858, ink: 0xffe7a3, k: 1, frame: 0xe9e2d0 });
  // 侧面小窗、背面门和空调
  const L = k.face('left'), R = k.face('right'), B = k.face('back');
  for (const s of [4, 9]) { k.window(L, s, 3, 2, 3, { sillCol: 0xe9e2d0 }); k.window(R, s, 3, 2, 3, { sillCol: 0xe9e2d0 }); }
  k.rect(B, 13, 15, 1, 6, 0, C.door);
  k.acUnit(3, H + 1, 7);
  k.v.box(14, H + 1, 8, 15, H + 4, 9, C.metal, MAT.METAL);
  return { vox: v, w, d, h: H + 7 };
}

// ── 联排小楼：坡屋顶、百叶窗、花箱、门廊 ──
export function townhouse(o = {}) {
  const w = o.w ?? 12, d = o.d ?? 16, floors = o.floors ?? 3, v = new Voxels(), k = new Kit(v, w, d, o.seed ?? 3);
  const H = floors * FH;
  const wallF = o.brick ? brick(o.wall ?? 0xb0553f, 0xd9c8b4) : (x, y) => (y === 0 ? shade(o.wall ?? 0xe8dcc2, 0.8) : o.wall ?? 0xe8dcc2);
  const slabs = Array.from({ length: floors - 1 }, (_, i) => (i + 1) * FH);
  k.shell(H, wallF, { slabs });
  const f = k.face('front');
  // 门 + 台阶 + 门檐
  const door = Math.floor(w / 2) - 1;
  k.rect(f, door, door + 2, 1, 6, -1, o.doorCol ?? 0x2f5d7c);
  k.clearRect(f, door, door + 2, 1, 6, 0);
  k.rect(f, door - 1, door + 3, 0, 1, 1, 0xa8a196);
  k.rect(f, door - 1, door + 3, 6, 7, 1, o.trim ?? C.white);
  const shutter = o.shutter ?? 0x3f6f5a;
  for (let fl = 0; fl < floors; fl++) {
    const y0 = fl * FH + 2;
    const xs = fl === 0 ? [2, w - 4] : Kit.spread(w, 2, 2, 2);
    for (const s of xs) k.window(f, s, y0 + (fl === 0 ? 0 : 0), 2, 4, { shutter, flowers: fl > 0 && k.rnd(s, fl) < 0.6, curtain: k.rnd(s, fl, 2) < 0.4 });
    for (const face of ['back', 'left', 'right']) {
      const F = k.face(face);
      for (const s of Kit.spread(F.len, 2, 4, 3)) if (k.rnd(s, fl, face.length) < 0.8) k.window(F, s, y0, 2, 4, { curtain: true });
    }
    if (fl > 0) k.rect(f, 0, w, fl * FH, fl * FH + 1, 0, o.trim ?? C.white); // 层间腰线
  }
  const roofA = o.roof ?? C.terracotta, roofB = o.roof2 ?? C.terracottaDark;
  // 屋檐下墙体封顶
  for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) if (x === 0 || z === 0 || x === w - 1 || z === d - 1) v.set(x, H, z, o.trim ?? C.white);
  const top = k.gableRoof(H + 1, roofA, roofB, wallF, { chimneyAt: o.chimney === false ? null : [w - 4, Math.floor(d / 2) + 1] });
  // 老虎窗
  if (o.dormer) {
    const dz = 2, dx = Math.floor(w / 2) - 2;
    v.box(dx, H + 1, dz, dx + 4, H + 5, dz + 3, o.trim ?? C.white);
    v.box(dx + 1, H + 2, dz - 0, dx + 3, H + 4, dz + 1, C.glass, MAT.GLASS);
    v.box(dx - 1, H + 5, dz - 1, dx + 5, H + 6, dz + 3, roofA);
  }
  return { vox: v, w, d, h: top + 2 };
}

// ── 中层公寓（冲撞目标）：底商 + 阳台 + 檐口 + 屋顶水箱 ──
export function apartment(o = {}) {
  const w = o.w ?? 22, d = o.d ?? 20, floors = o.floors ?? 5, v = new Voxels(), k = new Kit(v, w, d, o.seed ?? 5);
  const H = floors * FH;
  const base = o.wall ?? 0xd6a45a, trim = o.trim ?? 0xf2e8d5;
  const wallF = (x, y) => (y < FH ? (o.base ?? 0x8f5a44) : (y % FH === 0 ? trim : base));
  const slabs = Array.from({ length: floors - 1 }, (_, i) => (i + 1) * FH);
  k.shell(H, wallF, { slabs });
  k.roofFlat(H, { parapet: 2, wallCol: (x, y) => base, coping: trim, cornice: true });
  const f = k.face('front');
  k.storefront(f, 1, w - 1, FH - 1, { bay: 7, goods: 0xb86f3c, lit: true });
  k.awning(f, 2, w - 2, FH - 1, 3, o.awning ?? 0x2f6f73, 0xf4efe4);
  for (let fl = 1; fl < floors; fl++) {
    const y0 = fl * FH;
    const xs = Kit.spread(w, 4, 3, 2);
    xs.forEach((s, i) => {
      if (i % 2 === 0) k.balcony(f, s, y0, 4, 2, { plant: k.rnd(s, fl) < 0.5, rail: o.rail ?? trim });
      else k.window(f, s, y0 + 2, 4, 4, { curtain: k.rnd(s, fl) < 0.5, lit: k.rnd(s, fl, 3) < 0.12 });
    });
    for (const face of ['back', 'left', 'right']) {
      const F = k.face(face);
      for (const s of Kit.spread(F.len, 3, 3, 2)) {
        k.window(F, s, y0 + 2, 3, 4, { curtain: k.rnd(s, fl, face.length) < 0.5, lit: k.rnd(s, fl, 7) < 0.08 });
        if (k.rnd(s, fl, 11) < 0.25) { const [x, , z] = F.at(s, y0 + 1, 1); v.box(x, y0, z, x + 1, y0 + 2, z + 1, C.metal, MAT.METAL); }
      }
    }
  }
  if (o.tank !== false) k.waterTank(w - 6, H + 1, d - 6, 3, 5);
  k.bulkhead(3, H + 1, d - 8, 5, 5, 5);
  k.acUnit(Math.floor(w / 2) - 2, H + 1, 3);
  return { vox: v, w, d, h: H + 14 };
}

// ── 玻璃幕墙办公楼：横向窗带 + 竖梃 + 退台 + 天线 ──
export function officeTower(o = {}) {
  const w = o.w ?? 24, d = o.d ?? 24, floors = o.floors ?? 10, v = new Voxels(), k = new Kit(v, w, d, o.seed ?? 9);
  const band = o.band ?? 0xd9d4ca, glass = o.glass ?? 0x3f5f7a, pillar = o.pillar ?? 0xb9b3a7;
  const setback = o.setback ?? 2;
  const topFloors = 2;
  const Hlow = (floors - topFloors) * FH;
  const slabs = Array.from({ length: floors - topFloors - 1 }, (_, i) => (i + 1) * FH);
  k.shell(Hlow, (x, y, z) => {
    const edge = (x === 0 || x === w - 1) && (z === 0 || z === d - 1);
    if (edge) return pillar;
    const ly = y % FH;
    if (y < FH) return ly === FH - 1 ? band : null;
    if (ly <= 1) return band;
    const s = x === 0 || x === w - 1 ? z : x;
    if (s % 3 === 0) return [C.metalDark, MAT.METAL];
    return [ly === FH - 1 ? (o.glassHi ?? 0x86a6c2) : glass, MAT.GLASS];
  }, { slabs });
  // 大堂：退进的玻璃 + 立柱 + 雨棚
  for (let x = 1; x < w - 1; x++) for (let z = 1; z < d - 1; z++) if (x <= 2 || z <= 2 || x >= w - 3 || z >= d - 3) for (let y = 1; y < FH - 1; y++) {
    const onRing = x === 2 || z === 2 || x === w - 3 || z === d - 3;
    if (onRing) v.set(x, y, z, y >= FH - 3 ? 0x86a6c2 : glass, MAT.GLASS);
  }
  for (let x = 0; x < w; x += 4) { v.box(x, 0, 0, x + 1, FH - 1, 1, pillar); v.box(x, 0, d - 1, x + 1, FH - 1, d, pillar); }
  for (let z = 0; z < d; z += 4) { v.box(0, 0, z, 1, FH - 1, z + 1, pillar); v.box(w - 1, 0, z, w, FH - 1, z + 1, pillar); }
  const f = k.face('front');
  k.rect(f, Math.floor(w / 2) - 4, Math.floor(w / 2) + 4, FH - 1, FH, 1, C.metalDark, MAT.METAL);
  k.rect(f, Math.floor(w / 2) - 4, Math.floor(w / 2) + 4, FH - 1, FH, 2, C.metalDark, MAT.METAL);
  // 退台顶部两层
  const sb = setback, w2 = w - sb * 2, d2 = d - sb * 2;
  const v2 = new Voxels(), k2 = new Kit(v2, w2, d2, 13);
  const H2 = topFloors * FH;
  k2.shell(H2, (x, y, z) => {
    const edge = (x === 0 || x === w2 - 1) && (z === 0 || z === d2 - 1);
    if (edge) return band;
    const ly = y % FH;
    if (ly <= 1) return band;
    const s = x === 0 || x === w2 - 1 ? z : x;
    if (s % 2 === 0) return [C.metalDark, MAT.METAL];
    return [glass, MAT.GLASS];
  }, { slabs: [FH] });
  k2.roofFlat(H2, { parapet: 2, col: C.roof, coping: band, wallCol: band });
  v.merge(v2, 0, sb, Hlow, sb);
  // 退台平台
  for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) if (x < sb || z < sb || x >= w - sb || z >= d - sb) {
    v.set(x, Hlow, z, x === 0 || z === 0 || x === w - 1 || z === d - 1 ? band : C.gravel);
    if (x === 0 || z === 0 || x === w - 1 || z === d - 1) v.set(x, Hlow + 1, z, pillar);
  }
  const Htop = Hlow + H2;
  k.acUnit(sb + 3, Htop + 1, sb + 3);
  k.acUnit(sb + 9, Htop + 1, sb + 3, 1);
  k.antenna(Math.floor(w / 2), Htop + 1, Math.floor(d / 2) + 2, o.antenna ?? 12);
  return { vox: v, w, d, h: Htop + (o.antenna ?? 12) + 2 };
}

// ── 钟楼市政厅：两层石材基座 + 中央钟楼 + 铜绿尖顶 ──
export function clockHall(o = {}) {
  const w = o.w ?? 24, d = o.d ?? 18, v = new Voxels(), k = new Kit(v, w, d, 21);
  const stone = 0xd9cfba, stoneD = 0xbfb39b, H = 2 * FH;
  const wallF = (x, y) => (y === 0 || y === FH ? stoneD : ((x + Math.floor(y / 2)) % 5 === 0 && y % 2 === 0 ? shade(stone, 0.95) : stone));
  k.shell(H, wallF, { slabs: [FH] });
  k.roofFlat(H, { parapet: 1, wallCol: wallF, coping: stoneD, cornice: true });
  const f = k.face('front');
  // 拱窗
  for (const fl of [0, 1]) for (const s of Kit.spread(w, 2, 3, 2)) {
    if (fl === 0 && Math.abs(s + 1 - w / 2) < 3) continue;
    k.window(f, s, fl * FH + 2, 2, 4, { sill: true, lintel: stoneD });
  }
  // 正门 + 台阶 + 柱廊
  const door = Math.floor(w / 2) - 2;
  k.rect(f, door, door + 4, 1, 7, -1, C.woodDark); k.clearRect(f, door, door + 4, 1, 7, 0);
  for (let i = 0; i < 2; i++) k.rect(f, door - 3 + i, door + 7 - i, i, i + 1, 2 - i, stoneD);
  for (const s of [door - 2, door + 5]) k.rect(f, s, s + 1, 1, 8, 2, 0xefe8d8);
  k.rect(f, door - 3, door + 7, 8, 9, 2, stoneD); k.rect(f, door - 3, door + 7, 8, 9, 1, stoneD);
  for (const face of ['left', 'right', 'back']) { const F = k.face(face); for (const fl of [0, 1]) for (const s of Kit.spread(F.len, 2, 3, 2)) k.window(F, s, fl * FH + 2, 2, 4, { lintel: stoneD }); }
  // 钟楼
  const tw = 8, tx = Math.floor(w / 2) - 4, tz = 4, T0 = H + 1, TH = 26;
  for (let y = T0; y < T0 + TH; y++) for (let x = tx; x < tx + tw; x++) for (let z = tz; z < tz + tw; z++) {
    const shell = x === tx || x === tx + tw - 1 || z === tz || z === tz + tw - 1;
    if (!shell) continue;
    const corner = (x === tx || x === tx + tw - 1) && (z === tz || z === tz + tw - 1);
    let c = corner ? stoneD : stone;
    if (y > T0 + TH - 6 && !corner && y < T0 + TH - 1 && (x === tx + 3 || x === tx + 4 || z === tz + 3 || z === tz + 4)) continue; // 钟楼开口
    if ((y - T0) % 8 === 0) c = stoneD;
    v.set(x, y, z, c);
  }
  // 两面钟盘（正面、右侧面）
  const cy = T0 + 13;
  const clockFace = (put) => {
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
      const r2 = a * a + b * b;
      if (r2 > 11) continue;
      put(a, b, r2 > 7 ? 0x3a3a3a : 0xf6f1e3);
    }
    for (let i = 1; i <= 2; i++) put(0, i, 0x1e1e1e);
    for (let i = 1; i <= 2; i++) put(i, 0, 0x1e1e1e);
    put(0, 0, 0xc9a24a);
  };
  clockFace((a, b, c) => v.set(tx + 4 + a, cy + b, tz - 1, c));
  clockFace((a, b, c) => v.set(tx + tw, cy + b, tz + 4 - a, c));
  // 尖顶
  const copper = 0x5f9a86, copperD = 0x4c7f6e;
  let r = 0;
  for (let y = T0 + TH; r <= tw / 2 + 1; y++, r++) {
    for (let x = tx - 1 + r; x < tx + tw + 1 - r; x++) for (let z = tz - 1 + r; z < tz + tw + 1 - r; z++) {
      const edge = x === tx - 1 + r || x === tx + tw - r || z === tz - 1 + r || z === tz + tw - r;
      if (edge) v.set(x, y, z, r % 2 ? copperD : copper);
    }
  }
  const tipY = T0 + TH + r;
  for (let y = tipY - 1; y < tipY + 4; y++) v.set(tx + 3, y, tz + 3, 0xc9a24a, MAT.METAL);
  return { vox: v, w, d, h: tipY + 4 };
}

// ── 餐车式小餐馆：倒角、金属腰线、屋顶霓虹招牌 ──
export function diner(o = {}) {
  const w = o.w ?? 24, d = o.d ?? 14, v = new Voxels(), k = new Kit(v, w, d, 31);
  const H = 10;
  const wallF = (x, y) => (y === 0 ? 0x3d3d44 : y === 3 || y === 4 ? [0xc7ced4, MAT.METAL] : y >= H - 2 ? 0xd94f4f : 0xf3eee4);
  k.shell(H, wallF, { slabs: [] });
  k.roofFlat(H, { parapet: 1, wallCol: wallF, coping: 0xd94f4f });
  const f = k.face('front');
  for (const s of Kit.spread(w, 3, 1, 2)) k.window(f, s, 5, 3, 3, { sill: false });
  k.rect(f, 10, 13, 1, 8, -1, 0x9a3b3b); k.clearRect(f, 10, 13, 1, 8, 0);
  for (const face of ['left', 'right']) { const F = k.face(face); for (const s of Kit.spread(F.len, 3, 1, 2)) k.window(F, s, 5, 3, 3, { sill: false }); }
  // 倒角
  for (const [x, z] of [[0, 0], [w - 1, 0], [0, d - 1], [w - 1, d - 1]]) for (let y = 0; y <= H + 1; y++) v.del(x, y, z);
  // 屋顶霓虹招牌
  const sx = 3, sz = Math.floor(d / 2);
  for (const px of [sx + 2, sx + 16]) v.box(px, H + 1, sz, px + 1, H + 6, sz + 1, C.metalDark, MAT.METAL);
  const board = new Kit(v, w, d, 1);
  const F = { len: 30, at: (s, y, kk) => [sx + s, H + 5 + y, sz - kk] };
  for (let s = 0; s < 21; s++) for (let y = 0; y < 7; y++) v.set(sx + s, H + 5 + y, sz, 0x2a2233);
  board.sign(F, 1, 1, 'DINER', { board: 0x2a2233, ink: 0xff6fa8, inkMat: MAT.GLOW, k: 1, pad: 0 });
  for (let s = -1; s <= 21; s++) { v.set(sx + s, H + 4, sz - 1, 0x6fe3ff, MAT.GLOW); v.set(sx + s, H + 12, sz - 1, 0x6fe3ff, MAT.GLOW); }
  k.acUnit(w - 7, H + 1, d - 5);
  return { vox: v, w, d, h: H + 14 };
}

// ── 加油站罩棚 + 便利亭 ──
export function gasStation(o = {}) {
  const w = o.w ?? 22, d = o.d ?? 20, v = new Voxels(), k = new Kit(v, w, d, 41);
  const CH = 13;
  for (const [x, z] of [[4, 4], [w - 5, 4], [4, d - 5], [w - 5, d - 5]]) v.box(x, 0, z, x + 2, CH, z + 2, 0xe8e4dc);
  for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) {
    const edge = x === 0 || z === 0 || x === w - 1 || z === d - 1;
    v.set(x, CH, z, edge ? 0xd23c32 : 0xf1efe9);
    v.set(x, CH + 1, z, edge ? 0xd23c32 : 0xdedad2);
    if (edge) v.set(x, CH + 2, z, (x + z) % 6 < 3 ? 0xffffff : 0xd23c32);
  }
  for (let x = 2; x < w - 2; x += 5) for (let z = 3; z < d - 3; z += 5) v.set(x, CH - 1, z, 0xfff3c4, MAT.GLOW);
  // 加油岛
  for (const px of [7, w - 9]) {
    v.box(px, 0, 6, px + 2, 1, d - 6, 0xb8b2a8);
    for (const pz of [7, d - 9]) { v.box(px, 1, pz, px + 2, 5, pz + 2, 0xd23c32); v.box(px, 3, pz - 0, px + 2, 4, pz + 1, 0x2b2f36); }
  }
  return { vox: v, w, d, h: CH + 3 };
}

export function kiosk(o = {}) {
  const w = o.w ?? 12, d = o.d ?? 9, v = new Voxels(), k = new Kit(v, w, d, 43);
  const H = 9;
  k.shell(H, (x, y) => (y === 0 ? 0x444444 : y >= H - 2 ? (o.band ?? 0xd23c32) : 0xf1efe9), { slabs: [] });
  k.roofFlat(H, { parapet: 1, wallCol: 0xf1efe9, coping: o.band ?? 0xd23c32 });
  const f = k.face('front');
  k.storefront(f, 1, w - 1, H - 2, { bay: 5, lit: true, goods: 0x6aa0d8 });
  k.acUnit(2, H + 1, 3);
  return { vox: v, w, d, h: H + 5 };
}

// ── 锯齿屋顶砖砌仓库 ──
export function warehouse(o = {}) {
  const w = o.w ?? 24, d = o.d ?? 30, v = new Voxels(), k = new Kit(v, w, d, 51);
  const H = 16;
  const wallF = brick(o.wall ?? 0x9c4a36, 0xc9b9a3);
  k.shell(H, wallF, { slabs: [] });
  const f = k.face('front');
  // 卷帘门
  for (const s of [3, 13]) { k.clearRect(f, s, s + 7, 1, 10, 0); k.rect(f, s, s + 7, 1, 10, -1, (ss, y) => (y % 2 ? 0x9aa3a8 : 0x828a90)); k.rect(f, s - 1, s + 8, 10, 11, 0, 0x5b5f64); }
  k.rect(f, 2, w - 2, 0, 1, 1, 0x7c7a75); k.rect(f, 2, w - 2, 0, 1, 2, 0x7c7a75);
  for (const s of Kit.spread(w, 2, 2, 2)) k.window(f, s, 12, 2, 3, { sill: false });
  for (const face of ['left', 'right']) { const F = k.face(face); for (const s of Kit.spread(F.len, 3, 3, 2)) k.window(F, s, 9, 3, 4, { sill: false, lintel: 0xc9b9a3 }); }
  // 锯齿屋顶（沿 z 排列，玻璃面朝 -z）
  const tooth = 6;
  for (let z0 = 0; z0 < d; z0 += tooth) {
    for (let i = 0; i < tooth; i++) {
      const z = z0 + i; if (z >= d) break;
      const hy = H + Math.floor((tooth - 1 - i) * 0.9);
      for (let x = 0; x < w; x++) {
        v.set(x, hy, z, i % 2 ? 0x6b6f75 : 0x5d6168);
        if (i === 0) for (let y = H; y < hy; y++) { if (x === 0 || x === w - 1) v.set(x, y, z, wallF(x, y, z)); else v.set(x, y, z, 0x8fb3c9, MAT.GLASS); }
        if (x === 0 || x === w - 1) for (let y = H; y < hy; y++) v.set(x, y, z, wallF(x, y, z));
      }
    }
  }
  return { vox: v, w, d, h: H + 8 };
}

// ── 街角书店咖啡（甩尾目标）：两面店招、屋顶露台与阳伞 ──
export function cornerCafe(o = {}) {
  const w = o.w ?? 22, d = o.d ?? 20, floors = 3, v = new Voxels(), k = new Kit(v, w, d, 61);
  const H = floors * FH, base = o.wall ?? 0x4f8a8d, trim = 0xf1e6cf;
  const wallF = (x, y) => (y < FH ? 0x365f62 : y % FH === 0 ? trim : base);
  k.shell(H, wallF, { slabs: [FH, 2 * FH] });
  k.roofFlat(H, { parapet: 2, wallCol: (x, y) => trim, coping: trim, cornice: true });
  const f = k.face('front'), R = k.face('right');
  k.storefront(f, 1, w - 1, FH - 1, { bay: 5, goods: 0xa8643a, lit: true });
  k.storefront(R, 1, d - 1, FH - 1, { bay: 5, goods: 0xd2a24c, door: 4 });
  k.awning(f, 1, w - 1, FH - 1, 3, 0xe2b13c, 0x2f3f4f);
  k.awning(R, 1, d - 1, FH - 1, 3, 0xe2b13c, 0x2f3f4f);
  k.sign(f, 2, FH + 1, 'BOOKS', { board: 0x1f2d3a, ink: 0xf6d27a, k: 1 });
  for (let fl = 1; fl < floors; fl++) for (const [face, F] of [['front', f], ['right', R], ['left', k.face('left')], ['back', k.face('back')]]) {
    const xs = Kit.spread(F.len, 3, 2, 2);
    for (const s of xs) {
      if (fl === 1 && face === 'front' && s < 20) continue; // 招牌位置
      k.window(F, s, fl * FH + 2, 3, 4, { flowers: face !== 'back' && k.rnd(s, fl) < 0.5, curtain: k.rnd(s, fl, 4) < 0.5 });
    }
  }
  // 屋顶露台：木地板、花箱、阳伞
  for (let x = 2; x < w - 2; x++) for (let z = 2; z < d - 2; z++) v.set(x, H + 1, z, (x % 2) ? 0xa57a4f : 0x94693f);
  for (let x = 2; x < w - 2; x++) { v.set(x, H + 2, 2, C.woodDark); v.set(x, H + 3, 2, (x % 3) ? C.green : 0xe0506a); }
  const umbrella = (cx, cz, col) => {
    for (let y = H + 2; y < H + 7; y++) v.set(cx, y, cz, C.white);
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (a * a + b * b <= 5) v.set(cx + a, H + 7, cz + b, (a + b) % 2 ? col : C.white);
    v.set(cx, H + 8, cz, col);
    v.box(cx - 1, H + 2, cz + 2, cx + 2, H + 3, cz + 3, C.wood);
  };
  umbrella(6, 8, 0xd8453a); umbrella(14, 12, 0x3a7bd8); umbrella(8, 15, 0xe2b13c);
  k.bulkhead(w - 7, H + 1, d - 7, 4, 4, 5, trim);
  return { vox: v, w, d, h: H + 10 };
}

// ── 酒店：砖墙、竖向霓虹招牌、屋顶字牌 ──
export function hotel(o = {}) {
  const w = o.w ?? 26, d = o.d ?? 20, floors = o.floors ?? 7, v = new Voxels(), k = new Kit(v, w, d, 71);
  const H = floors * FH;
  const wallF = (x, y) => (y < FH ? 0xcfc6b4 : brick(0xa8543f, 0xd5c3ab)(x, y, 0));
  const slabs = Array.from({ length: floors - 1 }, (_, i) => (i + 1) * FH);
  k.shell(H, wallF, { slabs });
  k.roofFlat(H, { parapet: 2, wallCol: (x, y) => 0xcfc6b4, coping: 0xe8e0d0, cornice: true });
  const f = k.face('front');
  k.storefront(f, 2, w - 2, FH - 1, { bay: 6, lit: true, goods: 0x9b3b3b, frame: 0x2f2f33 });
  k.rect(f, 6, w - 6, FH - 1, FH, 1, 0x2f2f33); k.rect(f, 6, w - 6, FH - 1, FH, 2, 0x2f2f33); k.rect(f, 6, w - 6, FH - 1, FH, 3, 0x2f2f33);
  for (let fl = 1; fl < floors; fl++) for (const face of ['front', 'back', 'left', 'right']) {
    const F = k.face(face);
    for (const s of Kit.spread(F.len, 2, 2, 2)) k.window(F, s, fl * FH + 2, 2, 4, { curtain: k.rnd(s, fl, face.length) < 0.6, lit: k.rnd(s, fl, 13) < 0.1, lintel: 0xe8e0d0 });
  }
  // 屋顶字牌 HOTEL
  const sx = 3, sz = Math.floor(d / 2);
  for (const px of [sx + 2, sx + 17]) v.box(px, H + 1, sz, px + 1, H + 5, sz + 1, C.metalDark, MAT.METAL);
  // 酒店正面朝向相机一侧（旋转后），字从局部 -z 面读
  const F = { len: 30, at: (s, y, kk) => [sx + 20 - s, H + 4 + y, sz - kk] };
  new Kit(v, w, d, 2).sign(F, 0, 0, 'HOTEL', { board: 0x22262e, ink: 0xffc857, inkMat: MAT.GLOW, k: 0, pad: 1 });
  k.bulkhead(w - 8, H + 1, d - 7, 5, 5, 5, 0xcfc6b4);
  return { vox: v, w, d, h: H + 13 };
}

// ── 小别墅（街区背面填充） ──
export function cottage(o = {}) {
  const w = o.w ?? 14, d = o.d ?? 12, v = new Voxels(), k = new Kit(v, w, d, o.seed ?? 81);
  const H = FH;
  const wall = o.wall ?? 0xf0e6d2;
  k.shell(H, (x, y) => (y === 0 ? shade(wall, 0.75) : wall), { slabs: [] });
  const f = k.face('front');
  const door = 3;
  k.rect(f, door, door + 2, 1, 6, -1, o.door ?? 0x9b3b3b); k.clearRect(f, door, door + 2, 1, 6, 0);
  k.window(f, 8, 2, 3, 3, { shutter: o.shutter ?? 0x4d7aa0, flowers: true });
  for (const face of ['left', 'right', 'back']) { const F = k.face(face); for (const s of Kit.spread(F.len, 2, 4, 3)) k.window(F, s, 2, 2, 3, {}); }
  for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) if (x === 0 || z === 0 || x === w - 1 || z === d - 1) v.set(x, H, z, wall);
  const top = k.gableRoof(H + 1, o.roof ?? C.slate, o.roof2 ?? C.slateDark, wall, { chimneyAt: [2, Math.floor(d / 2)] });
  return { vox: v, w, d, h: top + 2 };
}
