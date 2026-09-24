// 恐龙角色：分层骨骼 + 程序化步态。
// - 根运动（位置、朝向）来自编排；脚掌是“落地锁定”的：支撑脚在世界中不动，只有迈步时才移动。
// - 迈步由预测误差触发：脚当前位置与“落地时刻身体应在的位置”偏差过大才迈，且两脚不同时离地。
// - 腿部为两段 IK（大腿/小腿）+ 固定角度跖骨，膝盖朝前。
// - 尾巴为带刚度的质点链：行走时沿路径弯曲、转身时有滞后甩动。
import * as THREE from 'three';
import { meshVoxels } from '../voxel/voxels.js';
import { voxelMesh } from '../voxel/materials.js';
import * as M from './model.js';

const { L1, L2, L3 } = M.LEG;
const HIP = new THREE.Vector3(0, -3, 6);
const TAIL_BASE = new THREE.Vector3(-9.5, 1.5, 0);
const FOOT_LAT = 6.2;

function part(vox) { const m = voxelMesh(meshVoxels(vox, { jitter: 0.05, seed: 3 })); return m; }
const fwdOf = (h, out = new THREE.Vector3()) => out.set(Math.cos(h), 0, Math.sin(h));
const rightOf = (h, out = new THREE.Vector3()) => out.set(-Math.sin(h), 0, Math.cos(h));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _m = new THREE.Matrix4();

// 用基向量设置朝向：局部 +X → xAxis，局部 +Y → yAxis
function orient(obj, xAxis, yAxis) {
  const x = _a.copy(xAxis).normalize();
  const y = _b.copy(yAxis).addScaledVector(x, -yAxis.dot(x)).normalize();
  const z = _c.crossVectors(x, y);
  _m.makeBasis(x, y, z);
  obj.quaternion.setFromRotationMatrix(_m);
}

export class Dino {
  constructor(scene, hf) {
    this.hf = hf;
    this.root = new THREE.Group(); this.root.name = 'dino';
    scene.add(this.root);
    // 上半身层级
    this.pelvis = new THREE.Group(); this.pelvis.rotation.order = 'YZX';
    this.root.add(this.pelvis);
    this.pelvis.add(part(M.torso()));
    this.neck = new THREE.Group(); this.neck.position.set(15.5, 4.5, 0); this.pelvis.add(this.neck);
    this.neck.add(part(M.neck()));
    this.head = new THREE.Group(); this.head.position.set(8.5, 2.6, 0); this.neck.add(this.head);
    this.head.add(part(M.head()));
    this.jaw = new THREE.Group(); this.jaw.position.set(-1, 0, 0); this.head.add(this.jaw);
    this.jaw.add(part(M.jaw())); // 下颌体素生成时已平移到枢轴坐标
    this.arms = [-1, 1].map((s) => {
      const up = new THREE.Group(); up.position.set(12.5, -4.5, 5.2 * s); this.pelvis.add(up);
      up.add(part(M.upperArm()));
      const fo = new THREE.Group(); fo.position.set(0, -5, 0); up.add(fo); fo.add(part(M.foreArm()));
      return { up, fo, s };
    });
    // 腿（世界空间直接摆放）
    const thighV = M.thigh(), shinV = M.shin(), metaV = M.metatarsus(), footV = M.foot();
    this.legs = [-1, 1].map((side) => {
      const thigh = part(thighV), shin = part(shinV), meta = part(metaV), foot = part(footV);
      this.root.add(thigh, shin, meta, foot);
      const blob = new THREE.Mesh(new THREE.CircleGeometry(5.2, 20), blobMat());
      blob.rotation.x = -Math.PI / 2; blob.renderOrder = 1;
      this.root.add(blob);
      return { side, thigh, shin, meta, foot, blob };
    });
    // 尾巴
    this.tailMeshes = M.TAIL.lens.map((_, i) => { const m = part(M.tailSegment(i)); this.root.add(m); return m; });
    this.N = M.TAIL.lens.length;
    this.footfalls = [];
    this.reset(null);
  }

  reset(choreo) {
    this.choreo = choreo;
    this.t = 0;
    const r = choreo ? choreo.root(0) : { x: -300, z: 42, h: 0 };
    this.feet = this.legs.map((L) => {
      const p = this.idealFoot(r, L.side);
      return { side: L.side, pos: p, yaw: r.h, state: 'plant', landT: -1, swing: null, pitch: 0, phi: 1.13 };
    });
    this.lastLand = -1; this.lastLandSide = 1; this.bob = 0; this.sway = 0;
    this.pelvisY = 31.5;
    this.prevRoot = { ...r };
    this.yawRate = 0; this.speed = 0; this.curv = 0;
    // 尾巴质点
    this.trail = [];
    this.updatePelvis(r, 0, {});
    this.tail = []; this.tailPrev = [];
    const rest = this.tailRest(0);
    for (let i = 0; i <= this.N; i++) { this.tail.push(rest[i].clone()); this.tailPrev.push(rest[i].clone()); }
    this.colliders = [];
    this.prevCol = new Map();
    this.footfalls.length = 0;
    this.overstretch = 0;
    this.pose(0);
  }

  idealFoot(r, side, out = new THREE.Vector3()) {
    fwdOf(r.h, _d);
    out.set(r.x, 0, r.z).addScaledVector(_d, 1.5);
    rightOf(r.h, _d);
    out.addScaledVector(_d, side * FOOT_LAT);
    out.y = this.hf.at(out.x, out.z) + 2;
    return out;
  }

  // ── 每个模拟步 ──
  step(t, dt) {
    const C = this.choreo;
    this.t = t;
    const r = C.root(t);
    const P = C.params(t);
    // 速度与曲率（尾巴弯曲用）
    const dx = r.x - this.prevRoot.x, dz = r.z - this.prevRoot.z;
    const sp = Math.hypot(dx, dz) / dt;
    let dh = r.h - this.prevRoot.h;
    this.speed += (sp - this.speed) * Math.min(1, dt * 6);
    this.yawRate += (dh / dt - this.yawRate) * Math.min(1, dt * 8);
    const k = this.speed > 6 ? clamp(this.yawRate / this.speed, -0.04, 0.04) * 0.7 : 0;
    this.curv += (k - this.curv) * Math.min(1, dt * 3);
    this.prevRoot = { ...r };

    this.updateFeet(t, dt, r, P);
    this.updatePelvis(r, dt, P);
    this.updateTail(dt, P);
    this.pose(dt, P);
    this.updateColliders(dt);
  }

  updateFeet(t, dt, r, P) {
    const C = this.choreo;
    for (const f of this.feet) {
      const sc = C.footScript(f.side, t);
      if (sc) { // 编排控制（踩踏）
        if (f.state !== 'scripted') { f.state = 'scripted'; f.scriptFrom = f.pos.clone(); f.scriptYaw = f.yaw; }
        const was = f.pos.clone();
        sc.apply(f, this.hf);
        f.vel = f.pos.clone().sub(was).divideScalar(dt);
        if (sc.landed && !f.scriptLanded) { f.scriptLanded = true; this.land(f, t, 2.2); }
        continue;
      }
      if (f.state === 'scripted') { f.state = 'plant'; f.scriptLanded = false; f.landT = t; f.phi = 1.13; f.pitch = 0; }
      f.vel = null;
      if (f.state === 'swing') {
        const s = f.swing;
        const u = clamp((t - s.t0) / s.dur, 0, 1);
        const e = 0.5 - 0.5 * Math.cos(Math.PI * u);
        const was = f.pos.clone();
        f.pos.lerpVectors(s.from, s.to, e);
        f.pos.y = s.from.y + (s.to.y - s.from.y) * e + s.lift * Math.pow(Math.sin(Math.PI * u), 1.1);
        f.vel = f.pos.clone().sub(was).divideScalar(dt);
        f.yaw = s.fromYaw + (s.toYaw - s.fromYaw) * e;
        f.pitch = -0.55 * Math.sin(Math.PI * Math.min(1, u * 1.15));
        f.phi = 1.13 - 0.35 * Math.sin(Math.PI * u);
        if (u >= 1) { f.state = 'plant'; f.pos.copy(s.to); f.pitch = 0; f.phi = 1.13; this.land(f, t, s.dist / 10 + 0.5); }
      }
    }
    // 迈步决策
    if (this.feet.some((f) => f.state !== 'plant')) return;
    if (P.lockFeet > 0.5) return;
    const Ts = 0.5, ds = 0.12, lead = 0.37;
    let best = null, bestErr = 0;
    if (t - this.lastLand < ds) return; // 双脚支撑的短暂停留
    for (const f of this.feet) {
      const rt = C.root(t + Ts + lead);
      const target = this.idealFoot(rt, f.side, new THREE.Vector3());
      const err = Math.hypot(target.x - f.pos.x, target.z - f.pos.z) + Math.abs(angDiff(rt.h, f.yaw)) * 6;
      const bias = f.side === this.lastLandSide ? 0 : 2.5; // 交替优先
      if (err > 1.4 && err + bias > bestErr) { best = { f, target, rt }; bestErr = err + bias; }
    }
    if (!best) return;
    const { f, target, rt } = best;
    const dist = Math.hypot(target.x - f.pos.x, target.z - f.pos.z);
    const dur = clamp(0.34 + dist * 0.012, 0.36, 0.56) * (P.stepTime ?? 1);
    // 预测误差按实际摆动时长修正
    const rt2 = C.root(t + dur + lead);
    this.idealFoot(rt2, f.side, target);
    f.state = 'swing';
    f.swing = { from: f.pos.clone(), to: target.clone(), fromYaw: f.yaw, toYaw: f.yaw + angDiff(rt2.h, f.yaw), t0: t, dur, lift: clamp(2.2 + dist * 0.22, 2.5, 6.5), dist };
  }

  land(f, t, strength) {
    f.landT = t; this.lastLand = t; this.lastLandSide = f.side;
    this.footfalls.push({ t, side: f.side, pos: f.pos.clone(), strength });
  }

  updatePelvis(r, dt, P) {
    const t = this.t;
    // 下沉：落地后短暂压低；迈步中段略抬
    const since = t - this.lastLand;
    let bob = since >= 0 && since < 0.32 ? -1.1 * Math.sin(Math.PI * since / 0.32) : 0;
    const sw = this.feet.find((f) => f.state === 'swing');
    let sway = 0;
    if (sw) { const u = clamp((t - sw.swing.t0) / sw.swing.dur, 0, 1); bob += 0.55 * Math.sin(Math.PI * u); sway = -sw.side * 0.9 * Math.sin(Math.PI * u); }
    this.bob += (bob - this.bob) * Math.min(1, dt * 18 || 1);
    this.sway += (sway - this.sway) * Math.min(1, dt * 10 || 1);
    let y = 31.5 - (P.crouch ?? 0) + this.bob + (P.rise ?? 0);
    // 可达性：脚离得太远时降低骨盆
    const h = r.h + (P.twist ?? 0);
    for (const f of this.feet) {
      const hip = this.hipWorld(r, h, f.side, y, _a);
      const ank = this.ankleOf(f, _b);
      const hz = Math.hypot(hip.x - ank.x, hip.z - ank.z);
      const maxL = (L1 + L2) * 0.985;
      if (hz < maxL) { const need = ank.y + Math.sqrt(maxL * maxL - hz * hz) + 3; if (y > need) y = need; }
    }
    this.pelvisY = dt ? this.pelvisY + (y - this.pelvisY) * Math.min(1, dt * 20) : y;
    const lean = (P.lean ?? 0) + this.sway;
    rightOf(r.h, _d);
    this.pelvis.position.set(r.x + _d.x * lean, this.pelvisY, r.z + _d.z * lean);
    this.pelvis.rotation.set(-lean * 0.012 + (P.roll ?? 0), -h, -(0.06 + (P.pitch ?? 0)) + this.bob * 0.01);
    this.pelvis.updateMatrixWorld(true);
    this.curH = h;
  }
  hipWorld(r, h, side, y, out) {
    rightOf(h, _d); fwdOf(h, _c);
    return out.set(r.x, y + HIP.y, r.z).addScaledVector(_d, side * HIP.z).addScaledVector(_c, HIP.x);
  }
  ankleOf(f, out) {
    fwdOf(f.yaw, _c);
    return out.copy(f.pos).addScaledVector(_c, -L3 * Math.cos(f.phi)).setY(f.pos.y + L3 * Math.sin(f.phi));
  }

  tailRest(dt, P = {}) {
    const out = [];
    const base = TAIL_BASE.clone().applyMatrix4(this.pelvis.matrixWorld);
    out.push(base);
    const h = this.curH ?? 0;
    let yaw = h + Math.PI, pitch = -0.02 + (P.tailLift ?? 0);
    const wag = Math.sin(this.t * 2.2) * 0.03;
    let p = base.clone();
    // 记录尾根走过的路径：行走转弯时尾巴沿路径跟随，而不是整条横扫
    const follow = P.tailFollow ?? 1;
    const tr = this.trail;
    if (follow < 0.5) tr.length = 0;
    else if (!tr.length || tr[tr.length - 1].p.distanceTo(base) > 0.6) tr.push({ p: base.clone(), s: (tr.length ? tr[tr.length - 1].s + tr[tr.length - 1].p.distanceTo(base) : 0) });
    if (tr.length > 400) tr.splice(0, tr.length - 400);
    const sEnd = tr.length ? tr[tr.length - 1].s + tr[tr.length - 1].p.distanceTo(base) : 0;
    const sStart = tr.length ? tr[0].s : 0;
    let D = 0, j = tr.length - 1;
    for (let i = 0; i < this.N; i++) {
      yaw += -this.curv * M.TAIL.lens[i] * 1.0 + wag + (P.tailYaw ?? 0) / this.N;
      pitch -= 0.045;
      const L = M.TAIL.lens[i];
      D += L;
      p = p.clone().add(new THREE.Vector3(Math.cos(yaw) * Math.cos(pitch) * L, Math.sin(pitch) * L, Math.sin(yaw) * Math.cos(pitch) * L));
      // 路径上距尾根 D 处的点
      const target = sEnd - D;
      const w = follow * clamp((sEnd - sStart - D) / 8, 0, 1);
      if (w > 0) {
        while (j > 0 && tr[j].s > target) j--;
        const a = tr[j], b = tr[Math.min(tr.length - 1, j + 1)];
        const u = b.s > a.s ? clamp((target - a.s) / (b.s - a.s), 0, 1) : 0;
        const q = a.p.clone().lerp(b.p, u);
        p.x += (q.x - p.x) * w; p.z += (q.z - p.z) * w;
      }
      out.push(p);
    }
    return out;
  }
  updateTail(dt, P) {
    const rest = this.tailRest(dt, P);
    this.tail[0].copy(rest[0]); this.tailPrev[0].copy(rest[0]);
    const stiff = 0.075 * (P.tailStiff ?? 1);
    for (let i = 1; i <= this.N; i++) {
      const p = this.tail[i], q = this.tailPrev[i];
      const vx = (p.x - q.x) * 0.955, vy = (p.y - q.y) * 0.955, vz = (p.z - q.z) * 0.955;
      q.copy(p);
      const k = stiff * (1 - (i - 1) / this.N * 0.55);
      p.x += vx + (rest[i].x - p.x) * k;
      p.y += vy + (rest[i].y - p.y) * k - 4 * dt * dt;
      p.z += vz + (rest[i].z - p.z) * k;
    }
    for (let it = 0; it < 3; it++) for (let i = 1; i <= this.N; i++) {
      const a = this.tail[i - 1], b = this.tail[i];
      _a.subVectors(b, a); const len = _a.length() || 1;
      b.copy(a).addScaledVector(_a, M.TAIL.lens[i - 1] / len);
      const g = this.hf.at(b.x, b.z) + M.TAIL.rad[i - 1][1] + 0.3;
      if (b.y < g) b.y = g;
    }
  }

  pose(dt, P = {}) {
    // 颈、头、下颌、短臂
    const t = this.t;
    const bobLag = this.bob * 0.04;
    this.neck.rotation.z = 0.72 + (P.neck ?? 0) - bobLag;
    this.head.rotation.z = -0.68 + (P.head ?? 0) + bobLag * 1.6;
    // 转弯时头部先转向（领先于身体），尾巴随后跟随
    const look = (P.look ?? 0) + clamp((this.yawRate ?? 0) * 0.22, -0.32, 0.32);
    this.neck.rotation.y = -look * 0.5; this.head.rotation.y = -look * 0.5;
    this.head.rotation.x = (P.headRoll ?? 0);
    this.jaw.rotation.z = -(0.04 + (P.jaw ?? 0));
    for (const a of this.arms) {
      a.up.rotation.z = 0.5 + Math.sin(t * 3.1 + a.s) * 0.08 + (P.arms ?? 0);
      a.fo.rotation.z = 0.6 + Math.sin(t * 3.1 + a.s + 0.6) * 0.1;
    }
    this.pelvis.updateMatrixWorld(true);
    // 腿 IK
    const pm = this.pelvis.matrixWorld;
    const fwd = fwdOf(this.curH ?? 0, new THREE.Vector3());
    for (const L of this.legs) {
      const f = this.feet.find((ff) => ff.side === L.side);
      const hip = HIP.clone().setZ(HIP.z * L.side).applyMatrix4(pm);
      const ank = this.ankleOf(f, new THREE.Vector3());
      const toAnk = ank.clone().sub(hip);
      let d = toAnk.length();
      const dmax = L1 + L2 - 0.05;
      if (d > dmax) { if (d > dmax + 0.5) this.overstretch = (this.overstretch ?? 0) + 1; toAnk.multiplyScalar(dmax / d); d = dmax; }
      const dir = toAnk.clone().normalize();
      // 膝盖朝前；脚抬得越高，膝盖越往上抬（避免高抬腿时膝盖向侧面折）
      const lift = clamp((f.pos.y - 2 - this.hf.at(f.pos.x, f.pos.z)) / 6, 0, 2.5);
      const pole = fwdOf(f.yaw, new THREE.Vector3()).add(fwd).add(new THREE.Vector3(0, lift, 0)).normalize();
      const bend = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
      const cosA = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
      const sinA = Math.sqrt(1 - cosA * cosA);
      const knee = hip.clone().addScaledVector(dir, L1 * cosA).addScaledVector(bend, L1 * sinA);
      const ankle = hip.clone().add(toAnk);
      L.thigh.position.copy(hip);
      orient(L.thigh, bend, hip.clone().sub(knee));
      L.shin.position.copy(knee);
      orient(L.shin, bend, knee.clone().sub(ankle));
      L.meta.position.copy(ankle);
      const mdir = ankle.clone().sub(f.pos);
      const footF = fwdOf(f.yaw, new THREE.Vector3());
      orient(L.meta, footF, mdir);
      L.foot.position.copy(f.pos);
      L.foot.rotation.set(0, 0, 0); L.foot.rotation.order = 'YZX';
      L.foot.rotation.y = -f.yaw; L.foot.rotation.z = f.pitch;
      // 接触阴影
      const g = this.hf.at(f.pos.x, f.pos.z);
      const hgt = f.pos.y - 2 - g;
      L.blob.position.set(f.pos.x + footF.x * 2, g + 0.12, f.pos.z + footF.z * 2);
      const s = clamp(1 - hgt / 18, 0.25, 1);
      L.blob.scale.setScalar(0.7 + s * 0.4);
      L.blob.material.opacity = 0.42 * s;
      L.knee = knee; L.ankle = ankle; L.hip = hip;
    }
    // 尾段
    for (let i = 0; i < this.N; i++) {
      const a = this.tail[i], b = this.tail[i + 1], m = this.tailMeshes[i];
      m.position.copy(a);
      orient(m, _d.subVectors(a, b), new THREE.Vector3(0, 1, 0));
    }
  }

  // 碰撞球：带速度，用于接触破坏判定
  updateColliders(dt) {
    const list = [];
    const add = (name, kind, p, r) => list.push({ name, kind, p: p.clone(), r });
    for (const L of this.legs) {
      const f = this.feet.find((ff) => ff.side === L.side);
      const nm = L.side > 0 ? 'R' : 'L';
      const ff = fwdOf(f.yaw, new THREE.Vector3());
      add('foot' + nm, 'foot', f.pos.clone().addScaledVector(ff, 3).add(new THREE.Vector3(0, -0.6, 0)), 3.6);
      add('heel' + nm, 'foot', f.pos.clone().addScaledVector(ff, -1).add(new THREE.Vector3(0, 0.4, 0)), 2.6);
      add('ankle' + nm, 'leg', L.ankle, 2.6);
      add('shin' + nm, 'leg', L.knee.clone().lerp(L.ankle, 0.5), 2.8);
      add('knee' + nm, 'leg', L.knee, 2.8);
    }
    const pm = this.pelvis.matrixWorld;
    const loc = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(pm);
    add('hips', 'body', loc(-2, 0, 0), 8);
    add('belly', 'body', loc(7, -1, 0), 8.4);
    add('chest', 'body', loc(14, 1.5, 0), 6.6);
    this.head.updateMatrixWorld(true);
    const hm = this.head.matrixWorld;
    const hl = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(hm);
    add('neck', 'head', new THREE.Vector3(3, 1, 0).applyMatrix4(this.neck.matrixWorld), 5.2);
    add('skull', 'head', hl(3, 4, 0), 5.4);
    add('snout', 'head', hl(11, 3, 0), 4);
    add('jaw', 'head', new THREE.Vector3(8, -3.5, 0).applyMatrix4(this.jaw.matrixWorld), 3.4);
    for (let i = 0; i < this.N; i++) add('tail' + i, 'tail', this.tail[i].clone().lerp(this.tail[i + 1], 0.5), M.TAIL.rad[i][0] * 1.05 + 0.4);
    for (const c of list) {
      const prev = this.prevCol.get(c.name);
      c.v = prev && dt > 0 ? c.p.clone().sub(prev).divideScalar(dt) : new THREE.Vector3();
      if (c.kind === 'foot') { const f = this.feet[c.name.endsWith('R') ? 1 : 0]; if (f.vel) c.v.copy(f.vel); }
      this.prevCol.set(c.name, c.p.clone());
    }
    this.colliders = list;
  }
  headWorld() { this.head.updateMatrixWorld(true); return new THREE.Vector3(6, 4, 0).applyMatrix4(this.head.matrixWorld); }
}

export function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

let _blob = null;
function blobMat() {
  if (!_blob) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 4, 32, 32, 31);
    gr.addColorStop(0, 'rgba(0,0,0,0.9)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    _blob = new THREE.CanvasTexture(c);
  }
  return new THREE.MeshBasicMaterial({ map: _blob, transparent: true, depthWrite: false, opacity: 0.4, color: 0x1a1410 });
}
