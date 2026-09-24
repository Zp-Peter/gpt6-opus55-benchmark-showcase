// 轻量特效：小碎屑（实例化方块，受重力、落地弹跳、到时缩小回收）和体素尘团（膨胀后缓慢收缩消散）。
import * as THREE from 'three';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
const _col = new THREE.Color();

export class FX {
  constructor(scene, hf, rng) {
    this.hf = hf; this.rng = rng;
    const box = new THREE.BoxGeometry(1, 1, 1);
    this.maxDebris = 900;
    this.debrisMesh = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ roughness: 0.85 }), this.maxDebris);
    this.debrisMesh.castShadow = true; this.debrisMesh.receiveShadow = true;
    this.debrisMesh.frustumCulled = false;
    this.debrisMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.maxDebris * 3), 3);
    this.maxDust = 700;
    this.dustMesh = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ roughness: 1, color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }), this.maxDust);
    this.dustMesh.frustumCulled = false; this.dustMesh.receiveShadow = true;
    this.dustMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.maxDust * 3), 3);
    this.dustMesh.renderOrder = 2;
    scene.add(this.debrisMesh, this.dustMesh);
    this.reset();
  }
  reset() {
    this.debris = []; this.dusts = [];
    this.debrisCursor = 0; this.dustCursor = 0;
    this.flush();
  }
  // 小碎屑：颜色来自被破坏的块
  burst(p, colors, n, speed, vel) {
    const r = this.rng;
    for (let i = 0; i < n; i++) {
      const d = {
        p: new THREE.Vector3(p.x + (r() - 0.5) * 2, p.y + (r() - 0.5) * 2, p.z + (r() - 0.5) * 2),
        v: new THREE.Vector3((r() - 0.5) * speed, r() * speed * 0.8 + 2, (r() - 0.5) * speed),
        rot: new THREE.Vector3(r() * 6, r() * 6, r() * 6), spin: new THREE.Vector3((r() - 0.5) * 12, (r() - 0.5) * 12, (r() - 0.5) * 12),
        size: 0.45 + r() * 0.75, life: 5 + r() * 5, age: 0, col: colors[Math.floor(r() * colors.length)] ?? 0x999999, rest: false,
      };
      if (vel) d.v.addScaledVector(vel, 0.35);
      if (this.debris.length < this.maxDebris) this.debris.push(d);
      else { this.debris[this.debrisCursor] = d; this.debrisCursor = (this.debrisCursor + 1) % this.maxDebris; }
    }
  }
  // 尘团
  dust(p, n, scale = 1, opts = {}) {
    const r = this.rng;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, sp = (1.5 + r() * 4) * scale;
      const d = {
        p: new THREE.Vector3(p.x + Math.cos(a) * r() * 2 * scale, p.y + r() * 1.5, p.z + Math.sin(a) * r() * 2 * scale),
        v: new THREE.Vector3(Math.cos(a) * sp, 1 + r() * 2.5 * scale, Math.sin(a) * sp),
        size: 0, peak: (1.4 + r() * 1.8) * scale, life: (2.2 + r() * 2.6) * (opts.life ?? 1) * (0.8 + scale * 0.3), age: 0,
        tone: 0.78 + r() * 0.16, rot: r() * Math.PI,
      };
      if (this.dusts.length < this.maxDust) this.dusts.push(d);
      else { this.dusts[this.dustCursor] = d; this.dustCursor = (this.dustCursor + 1) % this.maxDust; }
    }
  }
  // 脚步落地的低矮尘圈
  footDust(p, strength = 1) {
    const r = this.rng;
    const n = Math.round(6 * strength);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.5;
      const d = {
        p: new THREE.Vector3(p.x + Math.cos(a) * 4, p.y + 0.4, p.z + Math.sin(a) * 4),
        v: new THREE.Vector3(Math.cos(a) * 5 * strength, 0.6 + r(), Math.sin(a) * 5 * strength),
        size: 0, peak: 0.9 + r() * 0.9 * strength, life: 1.1 + r() * 0.8, age: 0, tone: 0.82 + r() * 0.1, rot: r() * 3,
      };
      if (this.dusts.length < this.maxDust) this.dusts.push(d);
      else { this.dusts[this.dustCursor] = d; this.dustCursor = (this.dustCursor + 1) % this.maxDust; }
    }
  }
  step(dt) {
    const hf = this.hf;
    for (const d of this.debris) {
      d.age += dt;
      if (d.rest) continue;
      d.v.y -= 46 * dt;
      d.p.addScaledVector(d.v, dt);
      d.rot.addScaledVector(d.spin, dt);
      const g = hf.at(d.p.x, d.p.z) + d.size * 0.5;
      if (d.p.y < g) {
        d.p.y = g;
        if (d.v.y < -4) { d.v.y *= -0.3; d.v.x *= 0.6; d.v.z *= 0.6; d.spin.multiplyScalar(0.5); }
        else { d.v.set(0, 0, 0); d.rest = true; d.rot.set(0, d.rot.y, 0); }
      }
    }
    this.debris = this.debris.filter((d) => d.age < d.life + 1.2 && d.p.y > -60);
    this.debrisCursor = 0;
    for (const d of this.dusts) {
      d.age += dt;
      const drag = Math.exp(-2.4 * dt);
      d.v.x *= drag; d.v.z *= drag; d.v.y = d.v.y * drag + 0.5 * dt;
      d.p.addScaledVector(d.v, dt);
      const g = hf.at(d.p.x, d.p.z) + 0.3;
      if (d.p.y < g) d.p.y = g;
      const u = d.age / d.life;
      d.size = d.peak * (u < 0.15 ? u / 0.15 : Math.max(0, 1 - (u - 0.15) / 0.85) ** 0.8);
    }
    this.dusts = this.dusts.filter((d) => d.age < d.life);
    this.dustCursor = 0;
  }
  flush() {
    let i = 0;
    for (const d of this.debris) {
      const shrink = d.age > d.life ? Math.max(0, 1 - (d.age - d.life) / 1.2) : 1;
      _q.setFromEuler(_e.set(d.rot.x, d.rot.y, d.rot.z));
      _s.setScalar(d.size * shrink);
      _m.compose(d.p, _q, _s);
      this.debrisMesh.setMatrixAt(i, _m);
      this.debrisMesh.setColorAt(i, _col.setHex(d.col));
      i++;
    }
    this.debrisMesh.count = i;
    this.debrisMesh.instanceMatrix.needsUpdate = true;
    if (this.debrisMesh.instanceColor) this.debrisMesh.instanceColor.needsUpdate = true;
    i = 0;
    for (const d of this.dusts) {
      _q.setFromEuler(_e.set(0, d.rot, 0));
      _s.setScalar(d.size);
      _m.compose(d.p, _q, _s);
      this.dustMesh.setMatrixAt(i, _m);
      const t = d.tone;
      this.dustMesh.setColorAt(i, _col.setRGB(0.8 * t, 0.74 * t, 0.64 * t, THREE.SRGBColorSpace));
      i++;
    }
    this.dustMesh.count = i;
    this.dustMesh.instanceMatrix.needsUpdate = true;
    if (this.dustMesh.instanceColor) this.dustMesh.instanceColor.needsUpdate = true;
  }
  counts() { return { debris: this.debris.length, dust: this.dusts.length }; }
}
