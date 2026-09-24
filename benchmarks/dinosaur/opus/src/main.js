// 入口：装配场景与各系统，按固定步长推进统一时间轴（恐龙、镜头、破坏、特效、车辆共用）。
import * as THREE from 'three';
import { createStage } from './stage.js';
import { buildGround } from './city/ground.js';
import { buildBuildings, placeProps, LOTS } from './city/city.js';
import { Props } from './city/props.js';
import { HeightField, Physics } from './destruction/physics.js';
import { DestructionSystem } from './destruction/buildings.js';
import { FX } from './fx/particles.js';
import { Dino } from './dino/dino.js';
import { choreo, DURATION, CUES, PHASES, STOMP } from './show/choreography.js';
import { Traffic, Birds } from './life/life.js';
import { Audio } from './audio.js';

const SIM_DT = 1 / 120;

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const stage = createStage(document.getElementById('stage'));
const { renderer, scene, camera, cam, updateCamera } = stage;

// 随机数：可重置，保证每次重播相同
let rngState = mulberry32(20260922);
const rng = () => rngState();

const hf = new HeightField();
const physics = new Physics(hf);
const fx = new FX(scene, hf, rng);
const sys = new DestructionSystem(scene, physics, fx, rng);
const props = new Props(scene, physics, fx, rng);
const audio = new Audio();

const t0 = performance.now();
scene.add(buildGround(LOTS));
buildBuildings(sys);
placeProps(props, sys);
props.build();
const traffic = new Traffic(scene);
const birds = new Birds(scene);
const dino = new Dino(scene, hf);
dino.reset(choreo);
const buildMs = performance.now() - t0;

// ── 时间轴状态 ──
const S = { t: 0, acc: 0, playing: true, ended: false, cue: 0, shake: 0, propLog: [], footfalls: 0, frames: 0, stepMs: 0 };
// 动作质量指标（自动化验证用）：支撑脚滑动、双脚同时离地、转身角速度、落脚离地误差
const newMetrics = () => ({ slip: 0, bothSwing: 0, maxYawRate: 0, maxYawRateWalk: 0, landErr: 0, steps: 0, prev: null });
let MET = newMetrics();

sys.onImpact = (imp, w) => {
  if (imp > 12) S.shake = Math.max(S.shake, Math.min(0.5, 0.12 * w * imp / 12));
  audio.crash(Math.min(1.4, 0.4 + w * imp / 25));
};

function resetAll() {
  rngState = mulberry32(20260922);
  hf.reset(); physics.reset(); sys.reset(); props.reset(); fx.reset();
  dino.reset(choreo);
  traffic.step(0); birds.step(0);
  Object.assign(S, { t: 0, acc: 0, ended: false, cue: 0, shake: 0, footfalls: 0 });
  MET = newMetrics();
  S.propLog = [];
  camFollow(0, true);
  document.getElementById('endcard').classList.add('hidden');
}

function stepSim() {
  const ts = performance.now();
  S.t += SIM_DT;
  const t = S.t;
  traffic.step(t); birds.step(t);
  const r0 = choreo.root(t - SIM_DT);
  dino.step(t, SIM_DT);
  // 指标
  const r1 = choreo.root(t);
  const yr = Math.abs(r1.h - r0.h) / SIM_DT;
  MET.maxYawRate = Math.max(MET.maxYawRate, yr);
  if (t < 33.3 || t > 36.7) MET.maxYawRateWalk = Math.max(MET.maxYawRateWalk, yr);
  if (MET.prev) dino.feet.forEach((f, i) => {
    const p = MET.prev[i];
    if (f.state === 'plant' && p.state === 'plant') MET.slip = Math.max(MET.slip, f.pos.distanceTo(p.pos));
  });
  if (dino.feet.every((f) => f.state === 'swing')) MET.bothSwing++;
  MET.prev = dino.feet.map((f) => ({ state: f.state, pos: f.pos.clone() }));
  // 落脚：尘圈、闷响；只有重踩才带镜头震动
  while (dino.footfalls.length) {
    const f = dino.footfalls.shift();
    S.footfalls++;
    MET.steps++;
    MET.landErr = Math.max(MET.landErr, Math.abs(f.pos.y - 2 - hf.at(f.pos.x, f.pos.z)) * (f.strength > 2 ? 0 : 1));
    const g = hf.at(f.pos.x, f.pos.z);
    fx.footDust(new THREE.Vector3(f.pos.x, g, f.pos.z), Math.min(1.6, f.strength));
    const onScreen = project(f.pos);
    audio.thud(Math.min(1.5, f.strength) * (onScreen.inside ? 1 : 0.5), onScreen.x);
    if (f.strength > 2) S.shake = Math.max(S.shake, 0.7);
  }
  sys.contact(dino.colliders, t);
  props.contact(dino.colliders, t, S.propLog);
  physics.step(SIM_DT);
  fx.step(SIM_DT);
  while (S.cue < CUES.length && CUES[S.cue].t <= t) {
    const c = CUES[S.cue++];
    if (c.type === 'roar') audio.roar(1.9, 1);
    else if (c.type === 'roar2') { audio.roar(1.1, 1.25); S.shake = Math.max(S.shake, 0.6); }
    else if (c.type === 'grunt') { audio.roar(0.7, 1.4); audio.whoosh(); }
  }
  S.shake *= Math.exp(-SIM_DT * 7);
  if (t >= DURATION) S.ended = true;
  S.stepMs = performance.now() - ts;
}

const _p = new THREE.Vector3();
function project(p) { _p.copy(p).project(camera); return { x: _p.x, y: _p.y, inside: Math.abs(_p.x) < 1 && Math.abs(_p.y) < 1 }; }

function camFollow(dt, snap = false) {
  const c = choreo.camera(S.t);
  const tgt = new THREE.Vector3(c.x, 6, c.z);
  const az = THREE.MathUtils.degToRad(c.az);
  if (snap) { cam.target.copy(tgt); cam.zoom = c.zoom; cam.azimuth = az; }
  else { const k = 1 - Math.exp(-dt * 4); cam.target.lerp(tgt, k); cam.zoom += (c.zoom - cam.zoom) * k; cam.azimuth += (az - cam.azimuth) * k; }
  cam.shake = S.shake;
}

// ── UI ──
const $ = (id) => document.getElementById(id);
const btnPlay = $('btnPlay'), btnMute = $('btnMute');
function setPlaying(p) {
  S.playing = p; S.acc = 0;
  btnPlay.textContent = p ? '❚❚' : '▶';
  audio.suspend(!p);
}
btnPlay.onclick = () => { if (S.ended) { resetAll(); setPlaying(true); } else setPlaying(!S.playing); };
$('btnReplay').onclick = () => { resetAll(); setPlaying(true); };
btnMute.onclick = () => { audio.setMuted(!audio.muted); btnMute.textContent = audio.muted ? '🔇' : '🔊'; };
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); btnPlay.click(); }
  if (e.code === 'KeyR') $('btnReplay').click();
  if (e.code === 'KeyM') btnMute.click();
});
for (const ph of PHASES) { const i = document.createElement('i'); i.style.left = (ph.t / DURATION * 100) + '%'; i.title = ph.name; $('marks').appendChild(i); }
let idleTimer = 0;
window.addEventListener('pointermove', () => { $('hud').classList.remove('idle'); idleTimer = 0; });

// ── 主循环 ──
let last = performance.now();
let fpsAcc = 0, fpsN = 0; S.fps = 0;
// 调试：?maxfps=12 人为限制帧率，用于验证低帧率下播放速度不变
const MAXFPS = +(new URLSearchParams(location.search).get('maxfps') ?? 0);
function frame(now) {
  if (MAXFPS && now - last < 1000 / MAXFPS - 1) { requestAnimationFrame(frame); return; }
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (S.playing && !S.ended && !S.manual) {
    S.acc += dt;
    let n = 0;
    while (S.acc >= SIM_DT && n < 24) { stepSim(); S.acc -= SIM_DT; n++; if (S.ended) break; }
    if (S.ended) { S.acc = 0; $('endcard').classList.remove('hidden'); btnPlay.textContent = '▶'; }
  }
  if (S.playing || S.manual) camFollow(dt);
  render();
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 1) { S.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  idleTimer += dt; if (idleTimer > 3) $('hud').classList.add('idle');
  requestAnimationFrame(frame);
}
function render() {
  fx.flush();
  if (S.camOverride) {
    const o = S.camOverride;
    camera.position.set(o.x + 0.469 * 700, o.y + 0.545 * 700, o.z + 0.695 * 700);
    camera.lookAt(o.x, o.y, o.z); camera.zoom = o.zoom; camera.updateProjectionMatrix();
  } else updateCamera(S.t);
  renderer.render(scene, camera);
  S.frames++;
  $('progFill').style.width = (S.t / DURATION * 100).toFixed(2) + '%';
  $('time').textContent = S.t.toFixed(1) + 's';
}

camFollow(0, true);
render();
$('loading').classList.add('done');
$('hud').classList.remove('hidden');
requestAnimationFrame(frame);

// ── 调试 / 自动化验证接口 ──
function dinoScreenBox() {
  // 恐龙各部件世界包围盒分别投影到屏幕（NDC）后取并集
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  dino.root.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  dino.root.traverse((o) => {
    if (!o.isMesh || !o.visible || o.material.transparent) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox;
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
      v.set(x, y, z).applyMatrix4(o.matrixWorld).project(camera);
      if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x; if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
    }
  });
  return { minX, maxX, minY, maxY };
}
window.__dc = {
  S, sys, dino, props, physics, fx, hf, choreo, camera, scene, renderer, STOMP, buildMs,
  advance(sec) { S.manual = true; const n = Math.round(sec / SIM_DT); for (let i = 0; i < n && !S.ended; i++) stepSim(); camFollow(1, true); render(); return S.t; },
  auto() { S.manual = false; },
  inspect(zoom, x, y, z) { S.camOverride = zoom ? { zoom, x, y, z } : null; render(); },
  pause() { setPlaying(false); }, resume() { setPlaying(true); }, replay() { resetAll(); setPlaying(true); },
  dinoScreen: dinoScreenBox,
  // 废墟支撑检查：每个静止碎块最低点下方是否真有东西（地面 / 其他碎块 / 仍直立的体素）
  audioState() { return { muted: audio.muted, ctx: audio.ctx ? audio.ctx.state : 'none' }; },
  metrics() { const { prev, ...m } = MET; return { ...m, overstretch: dino.overstretch }; },
  restCheck() {
    const cells = new Map(); // cell -> [[h, bodyIdx], ...] 取前两名
    const bodies = physics.bodies.filter((b) => !b.removed && b.sleeping);
    const stamps = bodies.map((b, bi) => {
      const out = new Map();
      const members = b.kind === 'group' ? b.payload.chunks : b.kind === 'chunk' ? [b.payload] : [];
      b.obj.updateMatrixWorld(true);
      for (const c of members) {
        const e = c.mesh.matrixWorld.elements, L = c.local;
        for (let n = 0; n < L.length; n += 3) {
          const x = L[n], y = L[n + 1], z = L[n + 2];
          const wx = e[0] * x + e[4] * y + e[8] * z + e[12], wy = e[1] * x + e[5] * y + e[9] * z + e[13], wz = e[2] * x + e[6] * y + e[10] * z + e[14];
          const k = Math.floor(wx) * 8192 + Math.floor(wz);
          const top = wy + 0.5 * Math.max(0.35, c.mesh.scale.y);
          if (!(out.get(k) >= top)) out.set(k, top);
        }
      }
      for (const [k, h] of out) { const l = cells.get(k) ?? []; l.push([h, bi]); cells.set(k, l); }
      return out;
    });
    const bad = [];
    bodies.forEach((b, bi) => {
      const p = b.obj.position, q = b.obj.quaternion, sc = b.obj.scale;
      const W = b.pts.map((pt) => pt.clone().multiply(sc).applyQuaternion(q).add(p));
      const minY = Math.min(...W.map((w) => w.y));
      // 任一点与支撑（地面 / 其他碎块 / 直立体素）的最小间隙
      let gap = Infinity;
      for (const w of W) {
        let h = hf.baseAt(w.x, w.z);
        const l = cells.get(Math.floor(w.x) * 8192 + Math.floor(w.z));
        if (l) for (const [hh, o] of l) if (o !== bi && hh <= w.y + 1.2 && hh > h) h = hh;
        const e = sys.intactTopBelow(w.x, w.y, w.z); if (e > h) h = e;
        if (w.y - h < gap) gap = w.y - h;
      }
      if (gap > 1.2) bad.push({ kind: b.kind, gap: +gap.toFixed(2), minY: +minY.toFixed(1), at: p.toArray().map((v) => +v.toFixed(1)) });
    });
    let below = 0;
    for (const b of physics.bodies) { if (b.removed) continue; const p = b.obj.position; for (const pt of b.pts) { const w = pt.clone().multiply(b.obj.scale).applyQuaternion(b.obj.quaternion).add(p); if (w.y < hf.baseAt(w.x, w.z) - 0.8) { below++; break; } } }
    return { sleeping: bodies.length, floating: bad, belowGround: below };
  },
  state() {
    const r = choreo.root(S.t);
    return {
      t: +S.t.toFixed(3), playing: S.playing, ended: S.ended, phase: choreo.phase(S.t).name,
      root: r, feet: dino.feet.map((f) => ({ side: f.side, state: f.state, pos: f.pos.toArray().map((n) => +n.toFixed(2)) })),
      damaged: sys.stats().filter((b) => b.broken > 0), bodies: physics.bodies.length, awake: physics.bodies.filter((b) => !b.sleeping && !b.removed).length,
      fx: fx.counts(), props: S.propLog.length, footfalls: S.footfalls, loose: props.loose.length,
      draws: renderer.info.render.calls, tris: renderer.info.render.triangles, fps: +S.fps.toFixed(1), stepMs: +S.stepMs.toFixed(2),
    };
  },
};
