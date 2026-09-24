// 可破坏建筑：体素按“带锯齿边界的楼层块”预切分；完好时用一整块网格（内部封闭面剔除），
// 第一次受损时换成分块网格。破坏只由接触触发：恐龙碰撞球与完好块 AABB 相交才会断裂。
import * as THREE from 'three';
import { Voxels, unkey, vkey, meshVoxels, hash3, colorOf } from '../voxel/voxels.js';
import { voxelMesh } from '../voxel/materials.js';
import { Body } from './physics.js';
import { FLOOR } from '../city/layout.js';

const CS = 6;           // 水平块尺寸
const CY = FLOOR;       // 垂直块尺寸 = 层高

export function placeVoxels(gen, { x0, z0, rot = 0, y0 = 1 }) {
  const out = new Voxels();
  out.merge(gen.vox, rot, 0, 0, 0);
  const b = out.bounds();
  // 以“墙体占地”对齐：用无外挑的 footprint 计算偏移
  const fw = rot % 2 ? gen.d : gen.w, fd = rot % 2 ? gen.w : gen.d;
  let fx0, fz0;
  switch (rot % 4) { case 0: fx0 = 0; fz0 = 0; break; case 1: fx0 = -gen.d; fz0 = 0; break; case 2: fx0 = -gen.w; fz0 = -gen.d; break; default: fx0 = 0; fz0 = -gen.w; }
  const res = new Voxels();
  res.merge(out, 0, x0 - fx0, y0, z0 - fz0);
  res.footprint = { x0, z0, x1: x0 + fw, z1: z0 + fd };
  return res;
}

export class Destructible {
  constructor(id, name, vox, opts = {}) {
    this.id = id; this.name = name; this.vox = vox; this.target = opts.target ?? null;
    this.group = new THREE.Group(); this.group.name = 'bld:' + name;
    const bb = vox.bounds();
    this.box = new THREE.Box3(new THREE.Vector3(...bb.min), new THREE.Vector3(...bb.max));
    this.origin = [vox.footprint.x0, 1, vox.footprint.z0];
    this.buildChunks();
    this.buildIntact();
    this.damaged = false; this.chunkMeshesBuilt = false;
    this.brokenCount = 0;
  }
  // 体素 → 块（锯齿边界让断口不规则）
  buildChunks() {
    const [ox, oy, oz] = this.origin;
    this.chunkOf = new Map();
    const chunks = new Map();
    for (const k of this.vox.map.keys()) {
      const [x, y, z] = unkey(k);
      const lx = x - ox, ly = y - oy, lz = z - oz;
      const jx = Math.floor(hash3(ly >> 1, lz >> 1, 3, this.id) * 3) - 1;
      const jz = Math.floor(hash3(lx >> 1, ly >> 1, 5, this.id) * 3) - 1;
      const i = Math.floor((lx + jx) / CS), kk = Math.floor((lz + jz) / CS), j = Math.max(0, Math.floor(ly / CY));
      const ck = `${i},${j},${kk}`;
      let c = chunks.get(ck);
      if (!c) { c = { key: ck, i, j, k: kk, keys: [], b: this, intact: true, mesh: null, body: null, min: new THREE.Vector3(1e9, 1e9, 1e9), max: new THREE.Vector3(-1e9, -1e9, -1e9) }; chunks.set(ck, c); }
      c.keys.push(k);
      this.chunkOf.set(k, c);
      c.min.x = Math.min(c.min.x, x); c.min.y = Math.min(c.min.y, y); c.min.z = Math.min(c.min.z, z);
      c.max.x = Math.max(c.max.x, x + 1); c.max.y = Math.max(c.max.y, y + 1); c.max.z = Math.max(c.max.z, z + 1);
    }
    this.chunks = [...chunks.values()];
    this.chunkMap = chunks;
    for (const c of this.chunks) {
      c.center = c.min.clone().add(c.max).multiplyScalar(0.5);
      c.pivot = [Math.round(c.center.x), Math.round(c.center.y), Math.round(c.center.z)];
      c.home = new THREE.Vector3(...c.pivot);
      // 颜色样本 + 支撑点（26 方向极值体素的外角）
      const cols = [];
      for (let n = 0; n < Math.min(12, c.keys.length); n++) cols.push(colorOf(this.vox.map.get(c.keys[Math.floor(hash3(n, 1, 2, this.id) * c.keys.length)])));
      c.colors = cols;
      c.pts = extremePoints(c.keys, c.pivot);
      c.local = new Float32Array(c.keys.length * 3);
      c.keys.forEach((k, n) => { const [x, y, z] = unkey(k); c.local[n * 3] = x + 0.5 - c.pivot[0]; c.local[n * 3 + 1] = y + 0.5 - c.pivot[1]; c.local[n * 3 + 2] = z + 0.5 - c.pivot[2]; });
      c.mass = c.keys.length;
      // 每个 (x,z) 竖列的顶面高度：碎块只会落在真实存在的体素顶上（空心室内不会“托住”碎块）
      c.colTop = new Map();
      for (const k of c.keys) { const [x, y, z] = unkey(k); const ck2 = x * 8192 + z; const top = y + 1; if (!(c.colTop.get(ck2) >= top)) c.colTop.set(ck2, top); }
      c.world = new Float32Array(c.local.length);
      for (let n = 0; n < c.local.length; n += 3) { c.world[n] = c.local[n] + c.pivot[0]; c.world[n + 1] = c.local[n + 1] + c.pivot[1]; c.world[n + 2] = c.local[n + 2] + c.pivot[2]; }
    }
  }
  buildIntact() {
    // 封闭室内空气视为实体 → 完好网格不生成看不见的室内面
    const enclosed = enclosedAir(this.vox, this.box);
    const map = this.vox.map;
    const g = meshVoxels(this.vox, { solid: (k) => map.has(k) || enclosed.has(k), aoSolid: (k) => map.has(k), seed: this.id });
    this.intactMesh = voxelMesh(g);
    this.group.add(this.intactMesh);
    this.intactFaces = g.index.count / 6;
  }
  ensureChunkMeshes() {
    if (this.chunkMeshesBuilt) return;
    const map = this.vox.map;
    for (const c of this.chunks) {
      const g = meshVoxels(this.vox, { keys: c.keys, solid: (nk) => this.chunkOf.get(nk) === c, aoSolid: (k) => map.has(k), pivot: c.pivot, seed: this.id });
      c.mesh = voxelMesh(g);
      c.mesh.position.copy(c.home);
      c.mesh.userData.chunk = c;
    }
    this.chunkMeshesBuilt = true;
  }
  toDamaged() {
    if (this.damaged) return;
    this.ensureChunkMeshes();
    this.intactMesh.visible = false;
    for (const c of this.chunks) this.group.add(c.mesh);
    this.damaged = true;
  }
  reset() {
    for (const c of this.chunks) {
      c.intact = true; c.body = null; c.fallT = null; c.cause = null;
      if (c.mesh) {
        c.mesh.removeFromParent();
        c.mesh.position.copy(c.home); c.mesh.quaternion.identity(); c.mesh.scale.set(1, 1, 1); c.mesh.visible = true;
      }
    }
    for (const ch of [...this.group.children]) if (ch !== this.intactMesh) ch.removeFromParent();
    this.intactMesh.visible = true;
    this.damaged = false; this.brokenCount = 0;
  }
  neighbor(c, di, dj, dk) { return this.chunkMap.get(`${c.i + di},${c.j + dj},${c.k + dk}`); }
  // 支撑分析：下方完好则稳定；否则需要至少两个“自身有下方支撑”的水平邻块才能悬挑
  unstableChunks() {
    const stable = new Set();
    const sorted = this.chunks.filter((c) => c.intact).sort((a, b) => a.j - b.j);
    let changed = true;
    const vert = (c) => c.j === 0 || stable.has(this.neighbor(c, 0, -1, 0));
    while (changed) {
      changed = false;
      for (const c of sorted) {
        if (stable.has(c)) continue;
        let ok = vert(c);
        if (!ok) {
          let n = 0;
          for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nb = this.neighbor(c, di, 0, dk); if (nb && stable.has(nb) && vert(nb)) n++; }
          ok = n >= 2;
        }
        if (ok) { stable.add(c); changed = true; }
      }
    }
    return sorted.filter((c) => !stable.has(c));
  }
}

function extremePoints(keys, pivot) {
  const dirs = [];
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) if (a || b || c) dirs.push([a, b, c]);
  const best = dirs.map(() => ({ s: -Infinity, p: null }));
  for (const k of keys) {
    const [x, y, z] = unkey(k);
    for (let d = 0; d < dirs.length; d++) {
      const [a, b, c] = dirs[d];
      const s = a * x + b * y + c * z;
      if (s > best[d].s) best[d] = { s, p: [x + (a > 0 ? 1 : a < 0 ? 0 : 0.5), y + (b > 0 ? 1 : b < 0 ? 0 : 0.5), z + (c > 0 ? 1 : c < 0 ? 0 : 0.5)] };
    }
  }
  const seen = new Set(), pts = [];
  for (const { p } of best) {
    if (!p) continue;
    const key = p.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    pts.push(new THREE.Vector3(p[0] - pivot[0], p[1] - pivot[1], p[2] - pivot[2]));
  }
  return pts;
}

function enclosedAir(vox, box) {
  const x0 = box.min.x - 1, y0 = box.min.y, z0 = box.min.z - 1, x1 = box.max.x + 1, y1 = box.max.y + 1, z1 = box.max.z + 1;
  const W = x1 - x0, H = y1 - y0, D = z1 - z0;
  const seen = new Uint8Array(W * H * D);
  const id = (x, y, z) => ((x - x0) * H + (y - y0)) * D + (z - z0);
  const stack = [];
  const push = (x, y, z) => {
    if (x < x0 || y < y0 || z < z0 || x >= x1 || y >= y1 || z >= z1) return;
    const i = id(x, y, z);
    if (seen[i]) return;
    if (vox.map.has(vkey(x, y, z))) { seen[i] = 2; return; }
    seen[i] = 1; stack.push(x, y, z);
  };
  for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) push(x, y1 - 1, z);
  for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) { push(x, y, z0); push(x, y, z1 - 1); }
  for (let z = z0; z < z1; z++) for (let y = y0; y < y1; y++) { push(x0, y, z); push(x1 - 1, y, z); }
  while (stack.length) {
    const z = stack.pop(), y = stack.pop(), x = stack.pop();
    push(x + 1, y, z); push(x - 1, y, z); push(x, y + 1, z); push(x, y - 1, z); push(x, y, z + 1); push(x, y, z - 1);
  }
  const out = new Set();
  for (let x = box.min.x; x < box.max.x; x++) for (let y = box.min.y; y < box.max.y; y++) for (let z = box.min.z; z < box.max.z; z++) {
    if (!seen[id(x, y, z)]) out.add(vkey(x, y, z));
  }
  return out;
}

// ── 系统：接触检测、断裂响应、失稳坍塌 ─────────────────────────
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _c = new THREE.Vector3();

export class DestructionSystem {
  constructor(scene, physics, fx, rng) {
    this.scene = scene; this.physics = physics; this.fx = fx; this.rng = rng;
    this.buildings = [];
    this.log = [];        // 断裂事件：{t, building, chunk, cause, p}
    this.pending = new Set();
    physics.extraGround = (x, y, z) => this.intactTopBelow(x, y, z);
  }
  add(b) { this.buildings.push(b); this.scene.add(b.group); return b; }
  reset() {
    for (const b of this.buildings) b.reset();
    this.log.length = 0; this.pending.clear();
  }
  intactTopBelow(x, y, z) {
    let h = -999;
    for (const b of this.buildings) {
      const bb = b.box;
      if (x < bb.min.x || x > bb.max.x || z < bb.min.z || z > bb.max.z || y < bb.min.y - 2) continue;
      const kx = Math.floor(x) * 8192 + Math.floor(z);
      for (const c of b.chunks) {
        if (!c.intact) continue;
        if (x < c.min.x || x >= c.max.x || z < c.min.z || z >= c.max.z || c.min.y > y + 1.2) continue;
        const top = c.colTop.get(kx);
        if (top !== undefined && top <= y + 1.2 && top > h) h = top;
      }
    }
    return h;
  }
  // 碰撞球 {name, kind, p, r, v}
  contact(spheres, t) {
    const hits = [];
    for (const b of this.buildings) {
      const bb = b.box;
      for (const s of spheres) {
        if (s.p.x + s.r < bb.min.x || s.p.x - s.r > bb.max.x || s.p.y + s.r < bb.min.y || s.p.y - s.r > bb.max.y || s.p.z + s.r < bb.min.z || s.p.z - s.r > bb.max.z) continue;
        for (const c of b.chunks) {
          if (!c.intact) continue;
          if (sphereBox(s.p, s.r, c.min, c.max) && sphereVoxels(s.p, s.r, c.world)) hits.push({ b, c, s });
        }
      }
    }
    const touched = new Set();
    for (const h of hits) {
      if (!h.c.intact) continue;
      this.breakChunk(h.c, h.s, t);
      touched.add(h.b);
    }
    for (const b of touched) this.settle(b, t);
    return hits.length;
  }
  breakChunk(c, s, t) {
    const b = c.b;
    b.toDamaged();
    c.intact = false; b.brokenCount++;
    const p = closestOnBox(s.p, c.min, c.max, new THREE.Vector3());
    this.log.push({ t, building: b.name, chunk: c.key, cause: s.kind + ':' + s.name, p: p.toArray().map((n) => +n.toFixed(1)), sp: s.p.toArray().map((n) => +n.toFixed(1)), r: s.r, v: s.v.toArray().map((n) => +n.toFixed(1)) });
    const rng = this.rng;
    const mesh = c.mesh;
    const body = new Body(mesh, { mass: c.mass, half: c.max.clone().sub(c.min).multiplyScalar(0.5), pts: c.pts, kind: 'chunk', payload: c });
    c.body = body;
    // 响应：踩踏=压碎向外摊开；撞击=沿冲击方向断开；甩尾=横向扫落
    const dir = _v.copy(c.center).sub(s.p); dir.y = 0; if (dir.lengthSq() < 1e-4) dir.set(rng() - 0.5, 0, rng() - 0.5); dir.normalize();
    if (s.kind === 'foot' && s.v.y < -6) {
      const under = Math.hypot(c.center.x - s.p.x, c.center.z - s.p.z) < s.r + 2.5;
      body.v.set(dir.x * (under ? 3 : 7), Math.min(s.v.y * (under ? 0.8 : 0.35), -4), dir.z * (under ? 3 : 7));
      _w.set(dir.z, 0, -dir.x).multiplyScalar(under ? 0.5 : 2.2 + rng());
      body.w.copy(_w);
      if (under) body.squash = 0.4;
      this.fx.burst(p, c.colors, 10, 7, s.v);
      this.fx.dust(p, 5, 1.2);
    } else if (s.kind === 'tail') {
      // 横向扫落：沿尾巴运动方向，速度封顶，碎块落在建筑旁边而不是飞出街区
      const sv = _c.copy(s.v); sv.y = 0; const sp = Math.min(22, sv.length() * 0.35); sv.normalize().multiplyScalar(sp);
      body.v.copy(sv).add(_w.set(0, 4 + rng() * 3, 0));
      body.w.set((rng() - 0.5) * 3, (rng() - 0.5) * 6, (rng() - 0.5) * 3);
      this.fx.burst(p, c.colors, 8, 9, s.v);
      this.fx.dust(p, 3, 1);
    } else if (s.kind === 'head' || s.kind === 'body') {
      // 撞击：沿冲撞方向推出，速度封顶，碎块落在楼前
      const push = _c.copy(s.v); push.y = 0; const sp = Math.min(14, push.length() * 0.45); push.normalize().multiplyScalar(sp);
      body.v.copy(push).addScaledVector(dir, 2).add(_w.set(0, 1 + rng() * 2, 0));
      body.w.set((rng() - 0.5) * 3, (rng() - 0.5) * 2, (rng() - 0.5) * 3);
      this.fx.burst(p, c.colors, 12, 10, s.v);
      this.fx.dust(p, 5, 1.4);
    } else {
      body.v.copy(s.v).multiplyScalar(0.6).addScaledVector(dir, 2);
      body.w.set((rng() - 0.5) * 2, (rng() - 0.5) * 2, (rng() - 0.5) * 2);
      this.fx.burst(p, c.colors, 5, 5, s.v);
    }
    this.attachBodyHooks(body);
    this.physics.add(body);
    this.invalidate(c.min, c.max);
  }
  attachBodyHooks(body) {
    body.onImpact = (bd, imp) => {
      if (imp > 9 && bd.age - (bd.lastDust ?? -9) > 0.4) {
        bd.lastDust = bd.age;
        const p = bd.obj.position.clone(); p.y = this.physics.hf.at(p.x, p.z) + 0.5;
        const cols = bd.payload.colors;
        this.fx.dust(p, Math.min(10, 2 + Math.floor(imp / 4) + (bd.kind === 'group' ? 6 : 0)), bd.kind === 'group' ? 2.2 : 1.1);
        if (imp > 14) this.fx.burst(p, cols, bd.kind === 'group' ? 14 : 4, 6, null);
        if (this.onImpact) this.onImpact(imp, bd.kind === 'group' ? 1 : 0.4);
      }
      if (bd.kind === 'group' && imp > 6) this.shatterGroup(bd);
    };
    body.onSleep = (bd) => this.stamp(bd);
  }
  // 某处结构断裂后：该区域高度场恢复为地面，区域内静止碎块重新唤醒落定（避免碎块停在已消失的支撑上）
  invalidate(min, max) {
    // 连锁：被唤醒的碎块自己的“印记”区域也要清掉，压在它上面的碎块一并唤醒
    const hf = this.physics.hf;
    const queue = [{ x0: min.x - 5, z0: min.z - 5, x1: max.x + 5, z1: max.z + 5 }];
    while (queue.length) {
      const r = queue.pop();
      hf.resetRegion(r.x0, r.z0, r.x1, r.z1);
      for (const b of this.physics.bodies) {
        if (b.removed || !b.stampBox) continue;
        const s = b.stampBox;
        if (s.x1 < r.x0 || s.x0 > r.x1 || s.z1 < r.z0 || s.z0 > r.z1) continue;
        b.sleeping = false; b.still = 0; b.age = Math.min(b.age, 10); b.stampBox = null;
        queue.push({ x0: s.x0 - 1, z0: s.z0 - 1, x1: s.x1 + 1, z1: s.z1 + 1 });
      }
    }
  }
  stamp(bd) {
    const hf = this.physics.hf;
    const members = bd.kind === 'group' ? bd.payload.chunks : [bd.payload];
    bd.obj.updateMatrixWorld(true);
    const sb = { x0: 1e9, z0: 1e9, x1: -1e9, z1: -1e9 };
    for (const c of members) {
      const m = c.mesh.matrixWorld;
      const e = m.elements;
      const L = c.local;
      for (let n = 0; n < L.length; n += 3) {
        const x = L[n], y = L[n + 1], z = L[n + 2];
        const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
        const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
        const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
        hf.raise(wx, wz, wy + 0.5 * Math.max(0.35, c.mesh.scale.y));
        if (wx < sb.x0) sb.x0 = wx; if (wx > sb.x1) sb.x1 = wx; if (wz < sb.z0) sb.z0 = wz; if (wz > sb.z1) sb.z1 = wz;
      }
    }
    bd.stampBox = sb;
  }
  // 失稳：连通的失稳块组成整体，短暂停顿后倾斜下坠
  settle(b, t) {
    const un = b.unstableChunks();
    if (!un.length) return;
    const set = new Set(un);
    const seen = new Set();
    for (const c0 of un) {
      if (seen.has(c0)) continue;
      const comp = []; const st = [c0]; seen.add(c0);
      while (st.length) {
        const c = st.pop(); comp.push(c);
        for (const [a, bb, cc] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
          const n = b.neighbor(c, a, bb, cc);
          if (n && set.has(n) && !seen.has(n)) { seen.add(n); st.push(n); }
        }
      }
      this.dropGroup(b, comp, t);
    }
  }
  dropGroup(b, comp, t) {
    const rng = this.rng;
    const cen = new THREE.Vector3(); let mass = 0;
    const min = new THREE.Vector3(1e9, 1e9, 1e9), max = new THREE.Vector3(-1e9, -1e9, -1e9);
    for (const c of comp) { cen.addScaledVector(c.center, c.mass); mass += c.mass; min.min(c.min); max.max(c.max); c.intact = false; b.brokenCount++; }
    cen.divideScalar(mass);
    this.invalidate(min, max);
    // 缺失支撑的方向
    const hole = new THREE.Vector3(); let nh = 0;
    for (const c of comp) { const below = b.neighbor(c, 0, -1, 0); if (below && !below.intact) { hole.add(below.center); nh++; } }
    const tilt = new THREE.Vector3();
    if (nh) { hole.divideScalar(nh); tilt.copy(hole).sub(cen); tilt.y = 0; }
    if (tilt.lengthSq() < 0.01) tilt.set(rng() - 0.5, 0, rng() - 0.5);
    tilt.normalize();
    for (const c of comp) this.log.push({ t, building: b.name, chunk: c.key, cause: 'collapse', p: c.center.toArray().map((n) => +n.toFixed(1)) });
    if (comp.length === 1) {
      const c = comp[0];
      const body = new Body(c.mesh, { mass: c.mass, half: c.max.clone().sub(c.min).multiplyScalar(0.5), pts: c.pts, kind: 'chunk', payload: c });
      body.delay = 0.08 + rng() * 0.25;
      body.w.set(tilt.z, 0, -tilt.x).multiplyScalar(-(0.8 + rng()));
      body.v.copy(tilt).multiplyScalar(1.5);
      c.body = body; this.attachBodyHooks(body); this.physics.add(body);
      return;
    }
    const pivot = new THREE.Object3D();
    pivot.position.copy(cen);
    b.group.add(pivot);
    const pts = [];
    for (const c of comp) {
      c.mesh.removeFromParent();
      pivot.add(c.mesh);
      c.mesh.position.copy(c.home).sub(cen);
      for (const p of c.pts) pts.push(p.clone().add(c.mesh.position));
    }
    const hull = reducePts(pts);
    const colors = comp.flatMap((c) => c.colors.slice(0, 3));
    const body = new Body(pivot, { mass, half: max.clone().sub(min).multiplyScalar(0.5), pts: hull, kind: 'group', payload: { chunks: comp, colors } });
    body.delay = 0.18 + rng() * 0.2;
    const axis = new THREE.Vector3(tilt.z, 0, -tilt.x);
    body.creak = (bd, dt) => { bd.obj.rotateOnWorldAxis(axis, -0.05 * dt); };
    body.w.copy(axis).multiplyScalar(-(0.7 + rng() * 0.5));
    body.v.copy(tilt).multiplyScalar(2.5);
    body.restitution = 0.05;
    this.attachBodyHooks(body);
    this.physics.add(body);
    this.fx.dust(new THREE.Vector3(cen.x, min.y, cen.z), 6, 1.6);
  }
  shatterGroup(gb) {
    if (gb.shattered) return;
    gb.shattered = true; gb.removed = true;
    const rng = this.rng;
    const pivot = gb.obj;
    pivot.updateMatrixWorld(true);
    const parent = pivot.parent;
    for (const c of gb.payload.chunks) {
      const m = c.mesh;
      const wp = new THREE.Vector3(), wq = new THREE.Quaternion(), ws = new THREE.Vector3();
      m.matrixWorld.decompose(wp, wq, ws);
      m.removeFromParent();
      parent.add(m);
      m.position.copy(wp); m.quaternion.copy(wq);
      const r = wp.clone().sub(pivot.position);
      const body = new Body(m, { mass: c.mass, half: c.max.clone().sub(c.min).multiplyScalar(0.5), pts: c.pts, kind: 'chunk', payload: c });
      body.v.copy(gb.w).cross(r).add(gb.v).multiplyScalar(0.6);
      body.v.x += (rng() - 0.5) * 5; body.v.z += (rng() - 0.5) * 5; body.v.y = Math.max(body.v.y, 0) + rng() * 3;
      body.w.set((rng() - 0.5) * 3, (rng() - 0.5) * 3, (rng() - 0.5) * 3).add(gb.w.clone().multiplyScalar(0.5));
      c.body = body; this.attachBodyHooks(body); this.physics.add(body);
    }
    pivot.removeFromParent();
    const p = pivot.position.clone(); p.y = this.physics.hf.at(p.x, p.z) + 1;
    this.fx.dust(p, 16, 2.6);
    if (this.onImpact) this.onImpact(20, 1.2);
  }
  stats() {
    return this.buildings.map((b) => ({ name: b.name, broken: b.brokenCount, total: b.chunks.length }));
  }
}

function reducePts(pts) {
  const dirs = [];
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) if (a || b || c) dirs.push(new THREE.Vector3(a, b, c));
  const out = new Set();
  for (const d of dirs) { let best = null, s = -Infinity; for (const p of pts) { const v = p.dot(d); if (v > s) { s = v; best = p; } } out.add(best); }
  return [...out];
}

// 体素级精确判定：球与块内任一体素（按半格外扩）相交
export function sphereVoxels(p, r, W) {
  const rr = (r + 0.5) * (r + 0.5);
  for (let n = 0; n < W.length; n += 3) {
    const dx = W[n] - p.x, dy = W[n + 1] - p.y, dz = W[n + 2] - p.z;
    if (dx * dx + dy * dy + dz * dz < rr) return true;
  }
  return false;
}
export function sphereBox(p, r, min, max) {
  const dx = Math.max(min.x - p.x, 0, p.x - max.x);
  const dy = Math.max(min.y - p.y, 0, p.y - max.y);
  const dz = Math.max(min.z - p.z, 0, p.z - max.z);
  return dx * dx + dy * dy + dz * dz < r * r;
}
function closestOnBox(p, min, max, out) {
  return out.set(Math.min(Math.max(p.x, min.x), max.x), Math.min(Math.max(p.y, min.y), max.y), Math.min(Math.max(p.z, min.z), max.z));
}
