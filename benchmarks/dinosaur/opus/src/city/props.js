// 街道设施与植被：体素生成 → 按类型实例化渲染；被恐龙碰到时把该实例“摘出来”变成刚体倒下。
import * as THREE from 'three';
import { Voxels, MAT, meshVoxels, hash3, unkey } from '../voxel/voxels.js';
import { voxelMaterials } from '../voxel/materials.js';
import { C } from './kit.js';
import { Body } from '../destruction/physics.js';
import { sphereBox, sphereVoxels } from '../destruction/buildings.js';

// ── 体素生成器（原点在底面中心，+X 为“正面/伸出方向”）──
const GEN = {
  lamp() {
    const v = new Voxels();
    v.box(-1, 0, -1, 1, 1, 1, 0x3a3f45, MAT.METAL);
    v.box(0, 1, 0, 1, 15, 1, 0x4a5058, MAT.METAL);
    v.box(0, 14, 0, 3, 15, 1, 0x4a5058, MAT.METAL);
    v.box(2, 13, -1, 5, 14, 2, 0x4a5058, MAT.METAL);
    v.box(3, 12, 0, 4, 13, 1, 0xfff0c0, MAT.GLOW);
    return v;
  },
  tree(seed = 1) {
    const v = new Voxels();
    const th = 6 + Math.floor(hash3(seed, 1, 1) * 3);
    v.box(-1, 0, -1, 1, th, 1, (x, y) => (y % 3 === 0 ? 0x5a3d25 : 0x6e4b2e));
    const greens = [[0x4f8a3c, 0x62a147, 0x3f6f31], [0x5b9440, 0x76ad4c, 0x467a33], [0x6a9a3a, 0x86b44a, 0x527a2e]][seed % 3];
    const blobs = [[0, th + 4, 0, 4.6], [2, th + 2.5, 1, 3.4], [-2, th + 3, -1, 3.4], [0.5, th + 6.5, -0.5, 3.2], [-1, th + 2, 2, 2.8]];
    for (const [bx, by, bz, r] of blobs) {
      for (let x = Math.floor(bx - r); x <= bx + r; x++) for (let y = Math.floor(by - r); y <= by + r; y++) for (let z = Math.floor(bz - r); z <= bz + r; z++) {
        const d = (x + 0.5 - bx) ** 2 + (y + 0.5 - by) ** 2 + (z + 0.5 - bz) ** 2;
        if (d > r * r) continue;
        const h = hash3(x, y, z, seed);
        const top = y > by + r * 0.35;
        v.set(x, y, z, top ? (h < 0.5 ? greens[1] : greens[0]) : (h < 0.25 ? greens[2] : greens[0]));
      }
    }
    return v;
  },
  pine(seed = 1) {
    const v = new Voxels();
    v.box(-1, 0, -1, 1, 4, 1, 0x5a3d25);
    let y = 3;
    for (let r = 5; r >= 1; r--) {
      for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) if (x * x + z * z <= r * r + 1) for (let k = 0; k < 2; k++) v.set(x, y + k, z, hash3(x, y + k, z, seed) < 0.3 ? 0x2f5a35 : 0x3b6d3f);
      y += 2;
    }
    v.set(0, y, 0, 0x3b6d3f);
    return v;
  },
  bench() {
    const v = new Voxels();
    v.box(-3, 0, 0, -2, 2, 1, 0x3a3f45, MAT.METAL); v.box(2, 0, 0, 3, 2, 1, 0x3a3f45, MAT.METAL);
    v.box(-3, 2, -1, 3, 3, 1, (x) => (x % 2 ? 0x9a6a3e : 0x8a5d36));
    v.box(-3, 3, 1, 3, 5, 2, (x, y) => (y === 4 ? 0x9a6a3e : 0x8a5d36));
    return v;
  },
  bin() {
    const v = new Voxels();
    v.box(-1, 0, -1, 1, 3, 1, 0x3f7a4f); v.box(-1, 3, -1, 1, 4, 1, 0x2d5a3a);
    return v;
  },
  hydrant() {
    const v = new Voxels();
    v.box(0, 0, 0, 1, 3, 1, 0xd8433a); v.set(0, 3, 0, 0xb03028); v.set(-1, 1, 0, 0xd8433a); v.set(1, 1, 0, 0xd8433a);
    return v;
  },
  sign(seed = 0) {
    const v = new Voxels();
    v.box(0, 0, 0, 1, 9, 1, 0x9aa1a8, MAT.METAL);
    const col = [0x2f6bb3, 0xd23c32, 0x2f8a4f][seed % 3];
    v.box(0, 8, -2, 1, 12, 2, (x, y, z) => (y === 8 || y === 11 || z === -2 || z === 1 ? 0xf2f2f2 : col));
    v.box(-1, 9, -1, 0, 11, 1, col);
    return v;
  },
  trafficLight() {
    const v = new Voxels();
    v.box(0, 0, 0, 1, 13, 1, 0x3a3f45, MAT.METAL);
    v.box(0, 12, 0, 8, 13, 1, 0x3a3f45, MAT.METAL);
    v.box(6, 8, 0, 8, 12, 1, 0x23262a, MAT.METAL);
    v.set(6, 11, -1, 0xff4b3a, MAT.GLOW); v.set(6, 10, -1, 0x5a4a1a); v.set(6, 9, -1, 0x1e4a2a);
    v.set(7, 11, 1, 0x3a1a18); v.set(7, 10, 1, 0x5a4a1a); v.set(7, 9, 1, 0x57e07a, MAT.GLOW);
    return v;
  },
  busStop() {
    const v = new Voxels();
    v.box(-4, 0, 1, -3, 7, 2, C.metalDark, MAT.METAL); v.box(3, 0, 1, 4, 7, 2, C.metalDark, MAT.METAL);
    v.box(-4, 7, -2, 4, 8, 3, 0x2f6f73);
    v.box(-3, 1, 1, 3, 7, 2, 0x9ec4d6, MAT.GLASS);
    v.box(-3, 2, -1, 3, 3, 1, 0x8a5d36);
    v.box(4, 0, -2, 5, 9, -1, 0x9aa1a8, MAT.METAL); v.box(4, 9, -3, 5, 11, 0, 0x2f6bb3);
    return v;
  },
  fountain() {
    const v = new Voxels();
    for (let x = -7; x <= 7; x++) for (let z = -7; z <= 7; z++) {
      const d = x * x + z * z;
      if (d > 50) continue;
      if (d > 36) { v.set(x, 0, z, 0xcfc6b3); v.set(x, 1, z, 0xe0d8c6); }
      else v.set(x, 0, z, 0x5f9fc2, MAT.GLASS);
    }
    v.box(-1, 0, -1, 2, 5, 2, 0xd9d0bd);
    for (let x = -2; x <= 3; x++) for (let z = -2; z <= 3; z++) if ((x - 0.5) ** 2 + (z - 0.5) ** 2 < 8) v.set(x, 4, z, 0xd9d0bd);
    v.box(0, 5, 0, 1, 7, 1, 0x8fd0ef, MAT.GLASS);
    return v;
  },
  hedge() {
    const v = new Voxels();
    v.box(-3, 0, -1, 3, 3, 1, (x, y, z) => (hash3(x, y, z, 9) < 0.3 ? 0x3f6f31 : 0x4f8a3c));
    return v;
  },
  flowers(seed = 0) {
    const v = new Voxels();
    v.box(-3, 0, -2, 3, 1, 2, 0x6e4b2e);
    for (let x = -3; x < 3; x++) for (let z = -2; z < 2; z++) { const h = hash3(x, z, seed, 4); v.set(x, 1, z, h < 0.3 ? 0xe0506a : h < 0.5 ? 0xf2c14e : h < 0.7 ? 0xf3efe6 : 0x4f8a3c); }
    return v;
  },
  fence() {
    const v = new Voxels();
    for (let x = -3; x < 3; x++) { v.set(x, 2, 0, 0xe9e2d0); if (x % 3 === 0) { v.set(x, 0, 0, 0xe9e2d0); v.set(x, 1, 0, 0xe9e2d0); v.set(x, 3, 0, 0xe9e2d0); } }
    return v;
  },
  billboard() {
    const v = new Voxels();
    for (const px of [-6, 5]) v.box(px, 0, 0, px + 1, 10, 1, 0x6e4b2e);
    v.box(-9, 9, -1, 9, 19, 0, (x, y) => {
      if (y === 9 || y === 18 || x === -9 || x === 8) return 0xf3efe6;
      // 像素广告：蓝天 + 绿丘 + 太阳
      if ((x - 4) ** 2 + (y - 15.5) ** 2 < 4) return 0xf2c14e;
      if (y < 11 + Math.round(Math.sin(x * 0.5) * 1.5 + 1.5)) return 0x5b9440;
      return 0x7fb4dc;
    });
    return v;
  },
  car(seed = 0) { return carVoxels(seed); },
  umbrellaTable(seed = 0) {
    const v = new Voxels();
    v.box(0, 0, 0, 1, 6, 1, C.white);
    const col = [0xd8453a, 0x3a7bd8, 0xe2b13c][seed % 3];
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (a * a + b * b <= 5) v.set(a, 6, b, (a + b) % 2 ? col : C.white);
    v.box(-1, 2, -1, 2, 3, 2, 0x8a5d36);
    return v;
  },
};

export function carVoxels(seed = 0) {
  const v = new Voxels();
  const palette = [0xd9483b, 0x3b7dd8, 0xf2c14e, 0xe8e4da, 0x4f9a6a, 0x2f3a4a, 0xe07a3a][seed % 7];
  const taxi = seed % 7 === 2;
  // 车长 10（沿 +X），宽 5，底盘离地 1
  v.box(-5, 1, -2, 5, 3, 3, palette);
  v.box(-3, 3, -2, 3, 5, 3, (x, y, z) => ((z === -2 || z === 2 || x === -3 || x === 2) && y === 3 ? [0x2c4458, MAT.GLASS] : (y === 4 ? palette : [0x3a5570, MAT.GLASS])));
  v.box(-2, 5, -1, 2, 5, 2, palette);
  v.box(-3, 5, -2, 3, 6, 3, palette);
  if (taxi) v.box(-1, 6, 0, 1, 7, 1, 0xfff3c4, MAT.GLOW);
  for (const [x, z] of [[-4, -2], [3, -2], [-4, 2], [3, 2]]) { v.box(x, 0, z, x + 2, 2, z + 1, 0x1f2126); }
  v.set(5, 2, -2, 0xfff3c4, MAT.GLOW); v.set(5, 2, 2, 0xfff3c4, MAT.GLOW);
  v.set(-6, 2, -2, 0xd23c32, MAT.GLOW); v.set(-6, 2, 2, 0xd23c32, MAT.GLOW);
  v.box(5, 1, -1, 6, 2, 2, 0x8d9399, MAT.METAL);
  return v;
}

const geoCache = new Map();
const voxCache = new Map();
// 局部体素中心（与几何体同一原点），用于体素级接触判定
export function propVoxelCenters(type, variant = 0) {
  const key = type + ':' + variant;
  if (!voxCache.has(key)) {
    const vox = GEN[type](variant);
    const arr = [];
    for (const k of vox.map.keys()) { const [x, y, z] = unkey(k); arr.push(x, y + 0.5, z); }
    voxCache.set(key, new Float32Array(arr));
  }
  return voxCache.get(key);
}
export function propGeometry(type, variant = 0) {
  const key = type + ':' + variant;
  if (!geoCache.has(key)) {
    const vox = GEN[type](variant);
    const g = meshVoxels(vox, { jitter: 0.06, seed: variant + 5 });
    // 原点：底面中心（体素是 [0,1) 格，平移半格让 x/z 居中）
    g.translate(-0.5, 0, -0.5);
    g.computeBoundingBox();
    geoCache.set(key, g);
  }
  return geoCache.get(key);
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class Props {
  constructor(scene, physics, fx, rng) {
    this.scene = scene; this.physics = physics; this.fx = fx; this.rng = rng;
    this.items = []; this.groups = new Map(); this.loose = [];
  }
  add(type, x, z, rot = 0, variant = 0, y = 1, opts = {}) {
    this.items.push({ type, variant, x, z, rot, y, solid: opts.solid !== false, static: !!opts.static });
  }
  build() {
    // 按类型分组 → InstancedMesh
    for (const it of this.items) {
      const key = it.type + ':' + it.variant;
      if (!this.groups.has(key)) this.groups.set(key, []);
      it.index = this.groups.get(key).length;
      this.groups.get(key).push(it);
      it.geo = propGeometry(it.type, it.variant);
      _q.setFromAxisAngle(UP, it.rot);
      it.matrix = new THREE.Matrix4().compose(_p.set(it.x, it.y, it.z), _q, _s);
      it.box = it.geo.boundingBox.clone().applyMatrix4(it.matrix);
      const L = propVoxelCenters(it.type, it.variant);
      it.world = new Float32Array(L.length);
      for (let n = 0; n < L.length; n += 3) { _p.set(L[n], L[n + 1], L[n + 2]).applyMatrix4(it.matrix); it.world[n] = _p.x; it.world[n + 1] = _p.y; it.world[n + 2] = _p.z; }
    }
    this.meshes = new Map();
    for (const [key, list] of this.groups) {
      const im = new THREE.InstancedMesh(list[0].geo, voxelMaterials, list.length);
      im.castShadow = true; im.receiveShadow = true;
      list.forEach((it, i) => im.setMatrixAt(i, it.matrix));
      im.computeBoundingSphere();
      im.name = 'props:' + key;
      this.scene.add(im);
      this.meshes.set(key, im);
    }
  }
  reset() {
    for (const it of this.items) { it.knocked = false; }
    for (const [key, im] of this.meshes) { this.groups.get(key).forEach((it, i) => im.setMatrixAt(i, it.matrix)); im.instanceMatrix.needsUpdate = true; }
    for (const m of this.loose) m.removeFromParent();
    this.loose.length = 0;
  }
  contact(spheres, t, log) {
    for (const it of this.items) {
      if (it.knocked || it.static) continue;
      for (const s of spheres) {
        if (!sphereBox(s.p, s.r, it.box.min, it.box.max) || !sphereVoxels(s.p, s.r, it.world)) continue;
        this.knock(it, s, t);
        log && log.push({ t, prop: it.type, at: [+it.x.toFixed(1), +it.z.toFixed(1)], cause: s.kind + ':' + s.name });
        break;
      }
    }
  }
  knock(it, s, t) {
    it.knocked = true;
    const key = it.type + ':' + it.variant;
    const im = this.meshes.get(key);
    im.setMatrixAt(it.index, new THREE.Matrix4().makeScale(0, 0, 0));
    im.instanceMatrix.needsUpdate = true;
    // 以包围盒中心为质心的独立网格
    const bb = it.geo.boundingBox;
    const cen = bb.getCenter(new THREE.Vector3());
    const g = it.geo.clone(); g.translate(-cen.x, -cen.y, -cen.z);
    const mesh = new THREE.Mesh(g, voxelMaterials);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.quaternion.setFromAxisAngle(UP, it.rot);
    mesh.position.copy(cen).applyQuaternion(mesh.quaternion).add(_p.set(it.x, it.y, it.z));
    this.scene.add(mesh); this.loose.push(mesh);
    const half = bb.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    const pts = [];
    for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) pts.push(new THREE.Vector3(a * half.x, b * half.y, c * half.z));
    const body = new Body(mesh, { mass: half.x * half.y * half.z * 2 + 4, half, pts, kind: 'prop', payload: { colors: [0x777777] } });
    const r = this.rng;
    const hv = new THREE.Vector3(s.v.x, 0, s.v.z);
    const sp = hv.length();
    if (sp < 0.5) hv.set(mesh.position.x - s.p.x, 0, mesh.position.z - s.p.z);
    hv.normalize();
    body.v.copy(hv).multiplyScalar(Math.min(12, Math.max(5, sp * 0.4))).setY(2 + r() * 2);
    const axis = new THREE.Vector3().crossVectors(UP, hv).normalize();
    body.w.copy(axis).multiplyScalar(-(2.5 + r() * 2) * (half.y > 4 ? 1 : 1.6)).add(new THREE.Vector3(0, (r() - 0.5) * 3, 0));
    body.restitution = 0.2;
    body.onSleep = (bd) => { /* 设施不写回高度场，避免挡住后续碎块 */ };
    this.physics.add(body);
    this.fx.dust(new THREE.Vector3(it.x, it.y, it.z), 3, 0.8);
  }
}
