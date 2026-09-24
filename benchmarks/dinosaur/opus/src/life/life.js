// 城市日常动态：路上行驶的车辆（感到震动后加速驶离城区）、屋顶上的鸟群（第一声脚步后惊飞）。
import * as THREE from 'three';
import { meshVoxels } from '../voxel/voxels.js';
import { voxelMesh } from '../voxel/materials.js';
import { carVoxels } from '../city/props.js';

const ALARM = 5.2; // 远处第一声脚步

// 路径：起点 + 一串转向指令，自动在转角处生成圆弧
function buildPath(pts, radius = 8) {
  const out = [];
  out.push(new THREE.Vector2(...pts[0]));
  for (let i = 1; i < pts.length - 1; i++) {
    const a = new THREE.Vector2(...pts[i - 1]), b = new THREE.Vector2(...pts[i]), c = new THREE.Vector2(...pts[i + 1]);
    const d1 = b.clone().sub(a).normalize(), d2 = c.clone().sub(b).normalize();
    const p1 = b.clone().addScaledVector(d1, -radius), p2 = b.clone().addScaledVector(d2, radius);
    out.push(p1);
    for (let k = 1; k < 8; k++) { const u = k / 8; const q = p1.clone().multiplyScalar((1 - u) ** 2).addScaledVector(b, 2 * u * (1 - u)).addScaledVector(p2, u * u); out.push(q); }
    out.push(p2);
  }
  out.push(new THREE.Vector2(...pts[pts.length - 1]));
  const cum = [0];
  for (let i = 1; i < out.length; i++) cum.push(cum[i - 1] + out[i].distanceTo(out[i - 1]));
  return { pts: out, cum, len: cum[cum.length - 1] };
}
function sample(path, s) {
  const { pts, cum } = path;
  s = Math.max(0, Math.min(path.len - 0.001, s));
  let i = 1; while (cum[i] < s) i++;
  const u = (s - cum[i - 1]) / (cum[i] - cum[i - 1]);
  const a = pts[i - 1], b = pts[i];
  return { x: a.x + (b.x - a.x) * u, z: a.y + (b.y - a.y) * u, h: Math.atan2(b.y - a.y, b.x - a.x) };
}

// 行驶距离：巡航 9 → 警觉后加速到 vmax
function distAt(t, delay, v0, vmax) {
  const tt = Math.max(0, t - delay);
  const t1 = Math.max(0, ALARM - delay);
  if (tt <= t1) return v0 * tt;
  const acc = 14, ta = (vmax - v0) / acc;
  const u = tt - t1;
  if (u < ta) return v0 * t1 + v0 * u + 0.5 * acc * u * u;
  return v0 * t1 + v0 * ta + 0.5 * acc * ta * ta + vmax * (u - ta);
}

const ROUTES = [
  { seed: 1, pts: [[-150, 48], [420, 48]], delay: 0, v0: 9, vmax: 24 },                       // 东行（与恐龙同一条路，提前逃走）
  { seed: 3, pts: [[120, -48], [-430, -48]], delay: 0, v0: 8, vmax: 22 },                     // 西行
  { seed: 4, pts: [[-36, 100], [-36, -36], [430, -36]], delay: 0, v0: 8, vmax: 22 },          // 北上后右转东行
  { seed: 0, pts: [[36, -96], [36, 48], [430, 48]], delay: 0.5, v0: 9, vmax: 24 },            // 南下后左转东行
  { seed: 6, pts: [[140, 36], [-36, 36], [-36, -48], [-430, -48]], delay: 0, v0: 9, vmax: 22 }, // 西行，遇恐龙前右转北上避开
  { seed: 5, pts: [[48, 100], [48, -36], [430, -36]], delay: 1.2, v0: 8, vmax: 22 },           // 北上后右转
];

export class Traffic {
  constructor(scene) {
    this.cars = ROUTES.map((r) => {
      const mesh = voxelMesh(meshVoxels(carVoxels(r.seed), { jitter: 0.05, seed: r.seed }));
      mesh.geometry.translate(-0.5, 0, -0.5);
      scene.add(mesh);
      return { r, path: buildPath(r.pts), mesh };
    });
    this.step(0);
  }
  step(t) {
    for (const c of this.cars) {
      const s = distAt(t, c.r.delay, c.r.v0, c.r.vmax);
      const p = sample(c.path, s);
      c.mesh.position.set(p.x, 0, p.z);
      c.mesh.rotation.y = -p.h;
      c.mesh.visible = s < c.path.len - 1 && Math.abs(p.x) < 400;
      c.pos = p;
    }
  }
  positions() { return this.cars.map((c) => ({ x: c.pos.x, z: c.pos.z, visible: c.mesh.visible })); }
}

// ── 鸟群 ──
export class Birds {
  constructor(scene) {
    const bodyG = new THREE.BoxGeometry(2, 1, 1);
    const wingG = new THREE.BoxGeometry(1.2, 0.3, 2.2); wingG.translate(0, 0, 1.1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.9 });
    const wmat = new THREE.MeshStandardMaterial({ color: 0x565b66, roughness: 0.9 });
    // 栖息点：中央公寓屋顶、书店屋顶、钟楼
    const perch = [[12, 42.5, -20], [14, 42.5, -18], [18, 42.5, -21], [21, 42.5, -16], [8, 27.5, 62], [11, 27.5, 60], [16, 27.5, 61], [-20, 18.5, 20], [-17, 18.5, 21]];
    this.birds = perch.map(([x, y, z], i) => {
      const g = new THREE.Group();
      const b = new THREE.Mesh(bodyG, mat); b.castShadow = true;
      const wl = new THREE.Mesh(wingG, wmat), wr = new THREE.Mesh(wingG, wmat); wr.scale.z = -1;
      g.add(b, wl, wr); scene.add(g);
      const a = 0.9 + (i % 4) * 0.15;
      return { g, wl, wr, home: new THREE.Vector3(x, y, z), dir: new THREE.Vector3(Math.cos(a), 0, -Math.sin(a) * 1.2).normalize(), delay: (i * 0.137) % 0.6, phase: i };
    });
    this.step(0);
  }
  step(t) {
    for (const b of this.birds) {
      const u = t - ALARM - 0.2 - b.delay;
      if (u <= 0) {
        b.g.position.copy(b.home);
        b.g.rotation.set(0, -Math.atan2(b.dir.z, b.dir.x), 0);
        const peck = Math.sin(t * 3 + b.phase) > 0.8 ? 0.3 : 0;
        b.g.children[0].rotation.z = -peck;
        b.wl.rotation.x = 0.1; b.wr.rotation.x = -0.1;
        b.g.visible = true;
        continue;
      }
      const sp = Math.min(26, 6 + u * 16);
      const dist = u * sp * 0.75;
      b.g.position.copy(b.home).addScaledVector(b.dir, dist);
      b.g.position.y += Math.min(60, u * 14) + Math.sin(u * 5 + b.phase) * 0.8;
      const flap = Math.sin(u * 22 + b.phase) * 0.9;
      b.wl.rotation.x = flap; b.wr.rotation.x = -flap;
      b.g.rotation.set(0, -Math.atan2(b.dir.z, b.dir.x), 0.25);
      b.g.visible = dist < 400;
    }
  }
}
