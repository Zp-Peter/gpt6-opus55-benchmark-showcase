// 受控的碎块刚体：只和“地面高度场 + 仍完好的建筑块顶面”碰撞。
// 不做通用的物体间碰撞；静止的碎块会写回高度场，后来的碎块会叠在上面，形成废墟堆。
import * as THREE from 'three';
import { PLINTH, baseHeight } from '../city/layout.js';

export class HeightField {
  constructor() {
    this.x0 = PLINTH.x0; this.z0 = PLINTH.z0;
    this.w = PLINTH.x1 - PLINTH.x0; this.d = PLINTH.z1 - PLINTH.z0;
    this.base = new Float32Array(this.w * this.d);
    for (let i = 0; i < this.w; i++) for (let j = 0; j < this.d; j++) this.base[i * this.d + j] = baseHeight(this.x0 + i + 0.5, this.z0 + j + 0.5);
    this.h = new Float32Array(this.base);
  }
  reset() { this.h.set(this.base); }
  idx(x, z) {
    const i = Math.floor(x - this.x0), j = Math.floor(z - this.z0);
    if (i < 0 || j < 0 || i >= this.w || j >= this.d) return -1;
    return i * this.d + j;
  }
  at(x, z) { const i = this.idx(x, z); return i < 0 ? -999 : this.h[i]; }
  baseAt(x, z) { const i = this.idx(x, z); return i < 0 ? -999 : this.base[i]; }
  raise(x, z, y) { const i = this.idx(x, z); if (i >= 0 && y > this.h[i]) this.h[i] = y; }
  resetRegion(x0, z0, x1, z1) {
    for (let x = Math.floor(x0); x <= Math.floor(x1); x++) for (let z = Math.floor(z0); z <= Math.floor(z1); z++) {
      const i = this.idx(x + 0.5, z + 0.5);
      if (i >= 0) this.h[i] = this.base[i];
    }
  }
  maxIn(x0, z0, x1, z1) {
    let m = -999;
    for (let x = Math.floor(x0); x <= Math.floor(x1); x++) for (let z = Math.floor(z0); z <= Math.floor(z1); z++) { const h = this.at(x + 0.5, z + 0.5); if (h > m) m = h; }
    return m;
  }
}

const _r = new THREE.Vector3(), _p = new THREE.Vector3(), _u = new THREE.Vector3(), _t = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Matrix3(), _q = new THREE.Quaternion();
const N = new THREE.Vector3(0, 1, 0);

export class Body {
  constructor(obj, { mass = 1, half = new THREE.Vector3(1, 1, 1), pts = [], kind = 'chunk', payload = null } = {}) {
    this.obj = obj; this.kind = kind; this.payload = payload;
    this.mass = mass; this.invMass = 1 / mass;
    const hx = half.x * 2, hy = half.y * 2, hz = half.z * 2;
    this.invI = new THREE.Vector3(12 / (mass * (hy * hy + hz * hz)), 12 / (mass * (hx * hx + hz * hz)), 12 / (mass * (hx * hx + hy * hy)));
    this.v = new THREE.Vector3(); this.w = new THREE.Vector3();
    this.pts = pts; this.sleeping = false; this.still = 0; this.age = 0; this.delay = 0;
    this.maxImpact = 0; this.onImpact = null; this.onSleep = null; this.contact = false;
    this.restitution = 0.12; this.friction = 0.65; this.squash = null;
  }
}

export class Physics {
  constructor(hf) {
    this.hf = hf; this.bodies = []; this.g = 46;
    this.extraGround = null; // (x,y,z)=>高度，用于完好建筑块
  }
  reset() { this.bodies.length = 0; }
  add(b) { this.bodies.push(b); return b; }
  groundAt(x, y, z) {
    let h = this.hf.at(x, z);
    if (this.extraGround) { const e = this.extraGround(x, y, z); if (e > h) h = e; }
    return h;
  }
  step(dt) {
    for (const b of this.bodies) {
      if (b.sleeping || b.removed) continue;
      b.age += dt;
      if (b.delay > 0) {
        b.delay -= dt;
        if (b.creak) b.creak(b, dt);
        continue;
      }
      if (b.squash) { // 踩扁：竖向缩放逐步压缩
        const s = b.obj.scale;
        s.y += (b.squash - s.y) * Math.min(1, dt * 14);
      }
      this.integrate(b, dt);
      this.collide(b, dt);
      const slow = b.v.lengthSq() < 0.5 && b.w.lengthSq() < 0.3;
      if (b.contact && slow) b.still += dt; else b.still = 0;
      if (b.still > 0.35 || b.age > 14) this.sleep(b);
      if (b.obj.position.y < -80) { b.removed = true; b.obj.visible = false; }
    }
  }
  integrate(b, dt) {
    b.v.y -= this.g * dt;
    b.w.multiplyScalar(0.996);
    b.obj.position.addScaledVector(b.v, dt);
    const q = b.obj.quaternion;
    _q.set(b.w.x * dt * 0.5, b.w.y * dt * 0.5, b.w.z * dt * 0.5, 0).multiply(q);
    q.set(q.x + _q.x, q.y + _q.y, q.z + _q.z, q.w + _q.w).normalize();
  }
  worldInvI(b) {
    // R diag(invI) R^T
    const m = new THREE.Matrix4().makeRotationFromQuaternion(b.obj.quaternion);
    const R = _m.setFromMatrix4(m);
    const e = R.elements;
    const I = b.invI;
    const out = new THREE.Matrix3();
    const o = out.elements;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      o[j * 3 + i] = e[0 * 3 + i] * I.x * e[0 * 3 + j] + e[1 * 3 + i] * I.y * e[1 * 3 + j] + e[2 * 3 + i] * I.z * e[2 * 3 + j];
    }
    return out;
  }
  collide(b, dt) {
    const pos = b.obj.position, q = b.obj.quaternion, sc = b.obj.scale;
    const contacts = [];
    let maxPen = 0;
    for (const pt of b.pts) {
      _r.set(pt.x * sc.x, pt.y * sc.y, pt.z * sc.z).applyQuaternion(q);
      _p.copy(pos).add(_r);
      const h = this.groundAt(_p.x, _p.y, _p.z);
      const pen = h - _p.y;
      if (pen > 0) { contacts.push(_r.clone()); if (pen > maxPen) maxPen = pen; }
    }
    b.contact = contacts.length > 0;
    if (!b.contact) return;
    const invIw = this.worldInvI(b);
    let impact = 0;
    for (let it = 0; it < 2; it++) {
      for (const r of contacts) {
        _u.copy(b.w).cross(r).add(b.v);
        const vn = _u.y;
        if (vn >= 0) continue;
        if (it === 0) impact = Math.max(impact, -vn);
        _a.copy(r).cross(N).applyMatrix3(invIw).cross(r);
        const kn = b.invMass + _a.y;
        const e = -vn > 3 ? b.restitution : 0;
        const jn = (-(1 + e) * vn) / kn / (it === 0 ? Math.max(1, contacts.length * 0.5) : 1);
        b.v.y += jn * b.invMass;
        _b.copy(r).cross(N).multiplyScalar(jn).applyMatrix3(invIw);
        b.w.add(_b);
        // 摩擦
        _u.copy(b.w).cross(r).add(b.v);
        _t.set(_u.x, 0, _u.z);
        const vt = _t.length();
        if (vt > 1e-4) {
          _t.divideScalar(vt);
          _a.copy(r).cross(_t).applyMatrix3(invIw).cross(r);
          const kt = b.invMass + _a.dot(_t);
          const jt = Math.min(vt / kt, b.friction * jn);
          b.v.addScaledVector(_t, -jt * b.invMass);
          _b.copy(r).cross(_t).multiplyScalar(-jt).applyMatrix3(invIw);
          b.w.add(_b);
        }
      }
    }
    pos.y += maxPen * 0.85;
    b.w.multiplyScalar(0.985);
    b.v.x *= 0.985; b.v.z *= 0.985;
    if (impact > b.maxImpact) b.maxImpact = impact;
    if (impact > 4 && b.onImpact) b.onImpact(b, impact);
  }
  sleep(b) {
    b.sleeping = true; b.v.set(0, 0, 0); b.w.set(0, 0, 0);
    if (b.onSleep) b.onSleep(b);
  }
}
