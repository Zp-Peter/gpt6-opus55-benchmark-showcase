import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import * as GEO from './geo.js';
import * as SH from './shaders.js';
import { makeCloudNoise } from './noise3d.js';

const $ = (s) => document.querySelector(s);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const loadText = (t, p) => { $('#load-text').textContent = t; if (p != null) $('#load-bar i').style.width = `${Math.round(p * 100)}%`; };

// ---------------------------------------------------------------- renderer
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
if (!renderer.extensions.has('EXT_color_buffer_float')) throw new Error('需要 WebGL2 + EXT_color_buffer_float');
renderer.extensions.get('OES_texture_float_linear');
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.45;
let pixelRatio = Math.min(window.devicePixelRatio, 1);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 180000);

// ---------------------------------------------------------------- LOD 层级
// core：马特洪峰本体；riffel：利菲尔湖周边；mid：采尔马特地区；far：远景阿尔卑斯
const FAR_HALF = 60000, FAR_MESH = 512;
const MID_HALF = 48 * (2 * FAR_HALF / FAR_MESH), MID_MESH = 1280; // 与远景网格对齐
const MID_CELL = (2 * MID_HALF) / MID_MESH;
const snap = (v) => Math.round((v + MID_HALF) / (4 * MID_CELL)) * 4 * MID_CELL - MID_HALF; // 对齐到 4 格，便于多级步长挖洞
const [lakeX, lakeZ] = GEO.toWorld(GEO.LAKE.x, GEO.LAKE.y);
const LEVELS = [
  { name: 'core', cx: 0, cz: 0, half: 148 * MID_CELL, tex: 2048, mesh: 1024, sh: 1536, ao: 1024, aoRange: 2500 },
  { name: 'riffel', cx: snap(lakeX + 60), cz: snap(lakeZ), half: 36 * MID_CELL, tex: 512, mesh: 256, sh: 512, ao: 512, aoRange: 2500 },
  { name: 'mid', cx: 0, cz: 0, half: MID_HALF, tex: 2048, mesh: MID_MESH, sh: 1024, ao: 1024, aoRange: 2500 },
  { name: 'far', cx: 0, cz: 0, half: FAR_HALF, tex: 1024, mesh: FAR_MESH, sh: 512, ao: 512, aoRange: 9000 },
];
const PARENT = { core: 'mid', riffel: 'mid', mid: 'far', far: null };
const INNER = { core: [], riffel: [], mid: ['core', 'riffel'], far: ['mid'] };
const byName = Object.fromEntries(LEVELS.map((l) => [l.name, l]));

function rtOf(size, type = THREE.FloatType) {
  return new THREE.WebGLRenderTarget(size, size, {
    type, format: THREE.RGBAFormat, depthBuffer: false, generateMipmaps: false,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
  });
}

// ---------------------------------------------------------------- 全屏 pass
const passScene = new THREE.Scene();
const passCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const passQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
passQuad.frustumCulled = false;
passScene.add(passQuad);
function runPass(mat, rt, tile) {
  passQuad.material = mat;
  if (tile) { rt.scissor.set(tile.x, tile.y, tile.w, tile.h); rt.scissorTest = true; } else rt.scissorTest = false;
  renderer.setRenderTarget(rt);
  renderer.render(passScene, passCam);
  renderer.setRenderTarget(null);
  rt.scissorTest = false;
}
const passMat = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: SH.FULLSCREEN_VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, toneMapped: false });

// ---------------------------------------------------------------- 共享 uniforms
const U = {
  uH0: { value: null }, uH1: { value: null }, uH2: { value: null }, uH3: { value: null },
  uL0: { value: new THREE.Vector3() }, uL1: { value: new THREE.Vector3() }, uL2: { value: new THREE.Vector3() }, uL3: { value: new THREE.Vector3() },
  uSky: { value: null }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunE: { value: new THREE.Vector3(10, 10, 10) },
  uHaze: { value: 1.0 }, uTime: { value: 0 }, uSnow: { value: 0.32 }, uDebug: { value: 0 },
};
LEVELS.forEach((L, i) => U[`uL${i}`].value.set(L.cx, L.cz, L.half));

// ---------------------------------------------------------------- 状态
const state = {
  hour: 8.3, snow: 0.32, cloud: 0.55, haze: 1.0, exposure: 0.45, labels: true, orbit: false,
  sunDirty: true, lastSun: 0, frame: 0, fps: 0, ready: false, genMs: 0,
};

// ---------------------------------------------------------------- 太阳 / 大气
const DEG = Math.PI / 180;
function sunDirection(localHour, doy = 265) {
  const lat = 45.976 * DEG;
  const decl = -23.44 * DEG * Math.cos((2 * Math.PI / 365) * (doy + 10));
  const solar = localHour - 1.37; // CEST → 真太阳时（经度 7.66°E，秋分附近的时差）
  const H = (solar - 12) * 15 * DEG;
  const up = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(H);
  const east = -Math.cos(decl) * Math.sin(H);
  const north = Math.cos(lat) * Math.sin(decl) - Math.sin(lat) * Math.cos(decl) * Math.cos(H);
  return new THREE.Vector3(east, up, -north).normalize();
}
const RE = 6371e3, RA = 6471e3, KR = [5.5e-6, 13.0e-6, 22.4e-6];
function sunTransmittance(dir, obsH, mie) {
  const r0 = [0, RE + obsH, 0];
  const hit = (sr) => {
    const b = 2 * (r0[1] * dir.y), c = r0[1] * r0[1] - sr * sr, d = b * b - 4 * c;
    if (d < 0) return null;
    return [(-b - Math.sqrt(d)) / 2, (-b + Math.sqrt(d)) / 2];
  };
  const g = hit(RE);
  if (g && g[0] > 0) return [0, 0, 0];
  const len = hit(RA)[1];
  const n = 64, ds = len / n;
  let odR = 0, odM = 0;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) * ds;
    const x = dir.x * t, y = r0[1] + dir.y * t, z = dir.z * t;
    const h = Math.hypot(x, y, z) - RE;
    odR += Math.exp(-h / 8000) * ds; odM += Math.exp(-h / 1200) * ds;
  }
  return KR.map((k) => Math.exp(-(k * odR + mie * 1.1 * odM)));
}

const skyRT = new THREE.WebGLRenderTarget(256, 96, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping });
U.uSky.value = skyRT.texture;
const skyLutMat = passMat(SH.SKYLUT_FS, { uSunDir: U.uSunDir, uMie: { value: 21e-6 }, uObsH: { value: 2600 } });

// ---------------------------------------------------------------- 地形网格（带裙边与内层挖洞，多级步长索引）
function gridPositions(M) {
  const n = M + 3;
  const pos = new Float32Array(n * n * 3);
  let k = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const ci = Math.min(Math.max(i - 1, 0), M), cj = Math.min(Math.max(j - 1, 0), M);
    pos[k++] = ci / M; pos[k++] = cj / M; pos[k++] = (i === 0 || j === 0 || i === n - 1 || j === n - 1) ? 1 : 0;
  }
  return new THREE.BufferAttribute(pos, 3);
}
// 步长 s 的索引：外圈裙边 + 每 s 格取一个顶点；洞口边界按 4 对齐，所以各步长都能精确挖洞
function gridIndex(M, holes, s) {
  const n = M + 3;
  const E = [0];
  for (let c = 0; c <= M; c += s) E.push(c + 1);
  if (E[E.length - 1] !== M + 1) E.push(M + 1);
  E.push(M + 2);
  const idx = [];
  for (let b = 0; b < E.length - 1; b++) for (let a = 0; a < E.length - 1; a++) {
    const i0 = E[a], i1 = E[a + 1], j0 = E[b], j1 = E[b + 1];
    const c0 = i0 - 1, c1 = i1 - 1, r0 = j0 - 1, r1 = j1 - 1;
    if (holes.some((h) => c0 >= h[0] && c1 <= h[1] && r0 >= h[2] && r1 <= h[3])) continue;
    const va = j0 * n + i0, vb = j0 * n + i1, vc = j1 * n + i0, vd = j1 * n + i1;
    idx.push(va, vc, vb, vb, vc, vd);
  }
  return new THREE.BufferAttribute(new Uint32Array(idx), 1);
}

// ---------------------------------------------------------------- 生成
const heightMat = passMat(SH.HEIGHT_FS, { uLvl: { value: new THREE.Vector3() }, uMinCell: { value: 10 } });
const copyMat = passMat(SH.COPY_FS, { uSrc: { value: null } });
const derivMat = passMat(SH.DERIV_FS, { uHOwn: { value: null }, uLvl: { value: new THREE.Vector3() }, uRes: { value: 1024 } });
const deriv2Mat = passMat(SH.DERIV2_FS, { uHOwn: derivMat.uniforms.uHOwn, uLvl: derivMat.uniforms.uLvl, uRes: derivMat.uniforms.uRes });
const aoMat = passMat(SH.AO_FS, { ...U, uLvl: { value: new THREE.Vector3() }, uRes: { value: 1024 }, uRange: { value: 1000 } });
const shadowMat = passMat(SH.SHADOW_FS, { ...U, uLvl: { value: new THREE.Vector3() }, uRes: { value: 1024 } });

async function generateHeights() {
  let done = 0;
  const total = LEVELS.reduce((s, L) => s + (L.tex >= 2048 ? 16 : L.tex >= 1024 ? 4 : 1), 0);
  for (const [i, L] of LEVELS.entries()) {
    L.hRT = rtOf(L.tex);
    U[`uH${i}`].value = L.hRT.texture;
    heightMat.uniforms.uLvl.value.set(L.cx, L.cz, L.half);
    heightMat.uniforms.uMinCell.value = 3.2 * (2 * L.half / L.tex);
    const tiles = L.tex >= 2048 ? 4 : L.tex >= 1024 ? 2 : 1;
    const ts = L.tex / tiles;
    for (let ty = 0; ty < tiles; ty++) for (let tx = 0; tx < tiles; tx++) {
      runPass(heightMat, L.hRT, tiles > 1 ? { x: tx * ts, y: ty * ts, w: ts, h: ts } : null);
      done++;
      loadText(`生成地形高度场 · ${L.name} (${L.tex}²)`, 0.05 + 0.6 * (done / total));
      await nextFrame();
    }
  }
}

// CPU 端的高度副本（用于相机防穿地、标注遮挡、测试）
async function readbackHeights() {
  for (const L of LEVELS) {
    const size = Math.min(L.tex, L.name === 'far' ? 1024 : 512);
    const rt = rtOf(size);
    copyMat.uniforms.uSrc.value = L.hRT.texture;
    runPass(copyMat, rt);
    const buf = new Float32Array(size * size * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
    const h = new Float32Array(size * size);
    for (let i = 0; i < size * size; i++) h[i] = buf[i * 4];
    L.cpu = { size, h };
    rt.dispose();
  }
}
function sampleLevel(L, x, z) {
  const { size, h } = L.cpu;
  const fx = ((x - L.cx) / (2 * L.half) + 0.5) * size - 0.5;
  const fz = ((z - L.cz) / (2 * L.half) + 0.5) * size - 0.5;
  const ix = Math.max(0, Math.min(size - 2, Math.floor(fx))), iz = Math.max(0, Math.min(size - 2, Math.floor(fz)));
  const tx = Math.max(0, Math.min(1, fx - ix)), tz = Math.max(0, Math.min(1, fz - iz));
  const a = h[iz * size + ix], b = h[iz * size + ix + 1], c = h[(iz + 1) * size + ix], d = h[(iz + 1) * size + ix + 1];
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}
function heightAt(x, z) {
  for (const L of LEVELS) {
    if (!L.cpu) continue;
    if (Math.max(Math.abs(x - L.cx), Math.abs(z - L.cz)) < L.half * 0.995 || L.name === 'far') return sampleLevel(L, x, z);
  }
  return 0;
}

function computeDerivs() {
  for (const L of LEVELS) {
    L.dRT = rtOf(L.tex, THREE.HalfFloatType);
    L.d2RT = rtOf(L.tex, THREE.HalfFloatType);
    derivMat.uniforms.uHOwn.value = L.hRT.texture;
    derivMat.uniforms.uLvl.value.set(L.cx, L.cz, L.half);
    derivMat.uniforms.uRes.value = L.tex;
    runPass(derivMat, L.dRT);
    runPass(deriv2Mat, L.d2RT);
  }
}

async function computeAO() {
  for (const L of LEVELS) {
    L.aoRT = rtOf(L.ao, THREE.UnsignedByteType);
    aoMat.uniforms.uLvl.value.set(L.cx, L.cz, L.half);
    aoMat.uniforms.uRes.value = L.ao;
    aoMat.uniforms.uRange.value = L.aoRange;
    runPass(aoMat, L.aoRT);
    loadText(`环境光遮蔽 · ${L.name}`, 0.7 + 0.1 * LEVELS.indexOf(L) / LEVELS.length);
    await nextFrame();
  }
}

function updateSun() {
  const dir = sunDirection(state.hour);
  U.uSunDir.value.copy(dir);
  const mie = 21e-6 * state.haze;
  skyLutMat.uniforms.uMie.value = mie;
  const T = sunTransmittance(dir, 3800, mie);
  const I = 22 * 0.55;
  U.uSunE.value.set(T[0] * I, T[1] * I, T[2] * I);
  runPass(skyLutMat, skyRT);
  for (const L of LEVELS) {
    if (!L.shRT) L.shRT = rtOf(L.sh, THREE.UnsignedByteType);
    shadowMat.uniforms.uLvl.value.set(L.cx, L.cz, L.half);
    shadowMat.uniforms.uRes.value = L.sh;
    runPass(shadowMat, L.shRT);
    if (L.mat) L.mat.uniforms.uSh.value = L.shRT.texture;
  }
  state.sunDirty = false;
  state.lastSun = performance.now();
}

// ---------------------------------------------------------------- 场景对象
let sky, lake, lakeFar, clouds = [];
function buildTerrain() {
  LEVELS.forEach((L, li) => {
    const holes = INNER[L.name].map((n) => {
      const I = byName[n];
      const c = (v, cc) => Math.round(((v - cc) / (2 * L.half) + 0.5) * L.mesh);
      return [c(I.cx - I.half, L.cx), c(I.cx + I.half, L.cx), c(I.cz - I.half, L.cz), c(I.cz + I.half, L.cz)];
    });
    const par = PARENT[L.name] ? byName[PARENT[L.name]] : null;
    const mat = new THREE.ShaderMaterial({
      vertexShader: SH.TERRAIN_VS,
      fragmentShader: SH.TERRAIN_FS,
      uniforms: {
        ...U,
        uHOwn: { value: L.hRT.texture }, uAO: { value: L.aoRT.texture }, uDeriv: { value: L.dRT.texture }, uDeriv2: { value: L.d2RT.texture }, uSh: { value: L.shRT?.texture ?? null },
        uLvl: { value: new THREE.Vector3(L.cx, L.cz, L.half) }, uRes: { value: L.tex },
        uDetail: { value: L.name === 'far' ? 0 : 1 }, uFar: { value: L.name === 'far' ? 1 : 0 },
        uInnerA: { value: new THREE.Vector3(0, 0, -1) }, uInnerB: { value: new THREE.Vector3(0, 0, -1) },
        uHParent: { value: par ? par.hRT.texture : L.hRT.texture }, uLParent: { value: par ? new THREE.Vector3(par.cx, par.cz, par.half) : new THREE.Vector3(0, 0, -1) },
        uMesh: { value: L.mesh },
      },
    });
    L.mat = mat;
    const posAttr = gridPositions(L.mesh);
    L.geoms = [1, 2, 4].map((st) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', posAttr);
      g.setIndex(gridIndex(L.mesh, holes, st));
      return g;
    });
    L.stride = 0;
    const mesh = new THREE.Mesh(L.geoms[0], mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = li;
    mesh.name = `terrain-${L.name}`;
    scene.add(mesh);
    L.meshObj = mesh;
  });
}

function buildSky() {
  const mat = new THREE.ShaderMaterial({
    vertexShader: SH.SKY_VS, fragmentShader: SH.SKY_FS, side: THREE.BackSide, depthWrite: false, depthTest: true,
    uniforms: { ...U, uCirrus: { value: 0.6 } },
  });
  sky = new THREE.Mesh(new THREE.SphereGeometry(150000, 64, 32), mat);
  sky.frustumCulled = false;
  sky.renderOrder = 10; // 最后画不透明物体：只着色真正露出的天空像素
  scene.add(sky);
}

function buildLake() {
  lake = new Reflector(new THREE.CircleGeometry(215, 72), {
    shader: SH.LAKE_SHADER, textureWidth: 1024, textureHeight: 1024, clipBias: 0.0, multisample: 4,
  });
  Object.assign(lake.material.uniforms, { uSky: U.uSky, uSunDir: U.uSunDir, uSunE: U.uSunE, uHaze: U.uHaze, uTime: U.uTime });
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(lakeX, GEO.LAKE.h, lakeZ);
  lake.renderOrder = 5;
  scene.add(lake);
  lakeFar = new THREE.Mesh(lake.geometry, new THREE.ShaderMaterial({
    vertexShader: SH.CLOUD_VS, fragmentShader: SH.LAKE_FAR_FS, uniforms: { uSky: U.uSky, uSunDir: U.uSunDir, uSunE: U.uSunE, uHaze: U.uHaze, uTime: U.uTime },
  }));
  lakeFar.rotation.x = -Math.PI / 2;
  lakeFar.position.copy(lake.position);
  lakeFar.renderOrder = 5;
  scene.add(lakeFar);
}

function buildClouds() {
  const N = 64;
  const tex = new THREE.Data3DTexture(makeCloudNoise(N), N, N, N);
  tex.format = THREE.RedFormat; tex.type = THREE.UnsignedByteType;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  const brg = 100 * DEG; // 风吹向东偏南，旗云拖在峰顶东侧背风面
  const wind = new THREE.Vector3(Math.sin(brg), 0, -Math.cos(brg));
  const cover = { value: state.cloud };
  const make = (kind, min, max, seed) => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: SH.CLOUD_VS, fragmentShader: SH.CLOUD_FS, transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: {
        ...U, uNoise: { value: tex }, uBMin: { value: min.clone() }, uBMax: { value: max.clone() },
        uKind: { value: kind }, uCover: cover, uWind: { value: wind }, uSeed: { value: new THREE.Vector3(...seed) },
      },
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    box.position.copy(min).add(max).multiplyScalar(0.5);
    box.scale.copy(max).sub(min);
    box.renderOrder = 20;
    box.userData = { min, max };
    scene.add(box);
    clouds.push(box);
  };
  // 旗云包围盒
  const pts = [];
  for (const s of [-150, 2300]) for (const c of [-750, 750]) pts.push([wind.x * s - wind.z * c, wind.z * s + wind.x * c]);
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  make(0, new THREE.Vector3(Math.min(...xs), 3700, Math.min(...zs)), new THREE.Vector3(Math.max(...xs), 4500, Math.max(...zs)), [0.1, 0.3, 0.7]);
  // 远处积云
  const cu = [
    [15500, 5600, 3400, 1500, 900, 1500], [-5600, 5400, -8200, 1300, 800, 1300], [-4200, 5000, 11500, 1800, 900, 1800],
    [10500, 5200, -15000, 1600, 850, 1600], [24000, 5900, -8000, 2200, 1000, 2200], [-15000, 5500, 3000, 1800, 900, 1800],
    [2500, 5300, 18000, 1700, 900, 1700],
  ];
  cu.forEach(([x, y, z, hx, hy, hz], i) => make(1, new THREE.Vector3(x - hx, y - hy, z - hz), new THREE.Vector3(x + hx, y + hy, z + hz), [i * 0.37, i * 0.61, i * 0.13]));
  clouds.cover = cover;
}

// 按相机到各层的最近距离选择网格步长：让三角形投影 ≳ 2 像素，避免亚像素三角形的过度着色
const tmpBox = new THREE.Box3(), tmpP = new THREE.Vector3();
function chooseStrides() {
  const H = renderer.domElement.height;
  const k = (H / 2) / Math.tan((camera.fov * DEG) / 2);
  for (const L of LEVELS) {
    tmpBox.min.set(L.cx - L.half, 1500, L.cz - L.half);
    tmpBox.max.set(L.cx + L.half, 4600, L.cz + L.half);
    const d = Math.max(1, tmpBox.distanceToPoint(camera.position));
    const px = ((2 * L.half) / L.mesh) / d * k;
    const st = px > 1.6 ? 0 : px > 0.8 ? 1 : 2;
    if (st !== L.stride) { L.stride = st; L.meshObj.geometry = L.geoms[st]; }
  }
}

// ---------------------------------------------------------------- 标注
const labelEls = [];
function buildLabels() {
  const host = $('#labels');
  for (const l of GEO.LABELS) {
    const [x, z] = GEO.toWorld(l.x, l.y);
    const el = document.createElement('div');
    el.className = 'label' + (l.main ? ' main' : '') + (l.town ? ' town' : '') + (l.hut ? ' hut' : '');
    el.innerHTML = `<b>${l.name}</b><span>${l.h.toLocaleString('en-US')} m</span>`;
    host.appendChild(el);
    labelEls.push({ el, pos: new THREE.Vector3(x, 0, z), l, visible: false });
  }
}
function placeLabels() {
  labelEls.forEach((L) => { L.pos.y = Math.max(heightAt(L.pos.x, L.pos.z), L.l.town ? 0 : 0) + (L.l.town ? 40 : 25); });
}
const tmpV = new THREE.Vector3();
function occluded(p) {
  const o = camera.position;
  const d = tmpV.copy(p).sub(o);
  const len = d.length();
  d.divideScalar(len);
  for (let i = 1; i < 72; i++) {
    const t = len * (i / 72) ** 1.3;
    if (t > len - 60) break;
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
    if (y < heightAt(x, z) - 4) return true;
  }
  return false;
}
function updateLabels(checkOcc) {
  const w = window.innerWidth, h = window.innerHeight;
  for (const L of labelEls) {
    const dist = camera.position.distanceTo(L.pos);
    if (checkOcc) L.occ = occluded(L.pos);
    tmpV.copy(L.pos).project(camera);
    const on = state.labels && tmpV.z < 1 && Math.abs(tmpV.x) < 1.05 && Math.abs(tmpV.y) < 1.05 && !L.occ && dist < 40000 && dist > 450;
    L.el.style.opacity = on ? 1 : 0;
    if (on) L.el.style.transform = `translate(${((tmpV.x + 1) / 2) * w}px, ${((1 - tmpV.y) / 2) * h}px)`;
  }
}

// ---------------------------------------------------------------- 相机
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.maxDistance = 40000;
controls.minDistance = 20;
controls.maxPolarAngle = Math.PI * 0.94;
controls.zoomSpeed = 1.1;
controls.rotateSpeed = 0.55;
let tween = null;
function setView(name, instant = false) {
  const v = GEO.VIEWS[name];
  if (!v) return;
  const to = { pos: new THREE.Vector3(...v.pos), target: new THREE.Vector3(...v.target), fov: v.fov };
  document.querySelectorAll('#views button').forEach((b) => b.classList.toggle('on', b.dataset.view === name));
  state.view = name;
  if (instant) {
    camera.position.copy(to.pos); controls.target.copy(to.target); camera.fov = to.fov; camera.updateProjectionMatrix();
    controls.update();
    tween = null;
    state.forceOcc = true;
    return;
  }
  tween = { t0: performance.now(), dur: 2600, from: { pos: camera.position.clone(), target: controls.target.clone(), fov: camera.fov }, to };
}
function updateTween(now) {
  if (!tween) return;
  let k = Math.min(1, (now - tween.t0) / tween.dur);
  const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
  const { from, to } = tween;
  camera.position.lerpVectors(from.pos, to.pos, e);
  // 过渡时抬高，避免穿山
  const lift = Math.sin(Math.PI * e) * Math.min(3500, from.pos.distanceTo(to.pos) * 0.25);
  camera.position.y += lift;
  controls.target.lerpVectors(from.target, to.target, e);
  camera.fov = from.fov + (to.fov - from.fov) * e;
  camera.updateProjectionMatrix();
  if (k >= 1) tween = null;
}
function clampCamera() {
  const g = heightAt(camera.position.x, camera.position.z);
  if (camera.position.y < g + 1.7) camera.position.y = g + 1.7;
  const agl = camera.position.y - g;
  const near = Math.min(40, Math.max(0.5, agl * 0.45));
  if (Math.abs(near - camera.near) > 0.05 * camera.near) { camera.near = near; camera.updateProjectionMatrix(); }
  return agl;
}

// ---------------------------------------------------------------- UI
function fmtHour(h) { const m = Math.round(h * 60); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
function bindUI() {
  const bind = (id, key, fn) => {
    const el = $(id);
    el.value = state[key];
    const out = el.parentElement.querySelector('output');
    const show = () => { if (out) out.textContent = key === 'hour' ? fmtHour(state.hour) : Math.round(state[key] * 100) + '%'; };
    el.addEventListener('input', () => { state[key] = +el.value; show(); fn?.(); });
    show();
  };
  bind('#t-hour', 'hour', () => { state.sunDirty = true; });
  bind('#t-snow', 'snow', () => { U.uSnow.value = state.snow; });
  bind('#t-cloud', 'cloud', () => { clouds.cover.value = state.cloud; clouds.forEach((c) => (c.visible = state.cloud > 0.02)); });
  bind('#t-haze', 'haze', () => { U.uHaze.value = state.haze; state.sunDirty = true; });
  bind('#t-exp', 'exposure', () => { renderer.toneMappingExposure = state.exposure; });
  $('#c-labels').addEventListener('change', (e) => { state.labels = e.target.checked; });
  $('#c-orbit').addEventListener('change', (e) => { state.orbit = e.target.checked; controls.autoRotate = state.orbit; controls.autoRotateSpeed = 0.35; });
  document.querySelectorAll('#times button').forEach((b) => b.addEventListener('click', () => {
    state.hour = +b.dataset.h; $('#t-hour').value = state.hour; $('#t-hour').dispatchEvent(new Event('input'));
  }));
  const vbox = $('#views');
  for (const [k, v] of Object.entries(GEO.VIEWS)) {
    const b = document.createElement('button');
    b.textContent = v.label; b.dataset.view = k;
    b.addEventListener('click', () => setView(k));
    vbox.appendChild(b);
  }
  $('#q-sel').addEventListener('change', (e) => {
    auto.on = e.target.value === 'auto';
    if (!auto.on) { pixelRatio = +e.target.value; renderer.setPixelRatio(pixelRatio); onResize(); }
  });
  $('#q-sel').value = 'auto';
  $('#panel-toggle').addEventListener('click', () => document.body.classList.toggle('panel-hidden'));
  if (window.innerWidth < 720) document.body.classList.add('panel-hidden'); // 手机默认收起面板
  controls.addEventListener('start', () => { tween = null; });
}
// 自适应分辨率：“自动”画质下根据帧率在 0.75 ~ min(DPR,1.5) 之间调整
const auto = { on: true, low: 0, high: 0 };
function adaptResolution() {
  if (!auto.on || tween) return;
  const maxR = Math.min(window.devicePixelRatio, 1.5);
  if (state.fps < 38) { auto.low++; auto.high = 0; } else if (state.fps > 56) { auto.high++; auto.low = 0; } else { auto.low = auto.high = 0; }
  let r = pixelRatio;
  if (auto.low >= 3 && r > 0.75) r = Math.max(0.75, r - 0.25);
  if (auto.high >= 6 && r < maxR) r = Math.min(maxR, r + 0.25);
  if (r !== pixelRatio) { pixelRatio = r; renderer.setPixelRatio(r); onResize(); auto.low = auto.high = 0; }
}
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

// ---------------------------------------------------------------- 主循环
const clock = { last: performance.now(), acc: 0, n: 0 };
function frame(now) {
  const dt = Math.min(0.1, (now - clock.last) / 1000);
  clock.last = now;
  clock.acc += dt; clock.n++;
  if (clock.acc > 0.5) { state.fps = clock.n / clock.acc; clock.acc = 0; clock.n = 0; adaptResolution(); }
  U.uTime.value += dt;
  updateTween(now);
  controls.update();
  const agl = clampCamera();
  if (state.sunDirty && now - state.lastSun > 70) updateSun();
  sky.position.copy(camera.position);
  for (const c of clouds) {
    const { min, max } = c.userData, p = camera.position, m = 5;
    const inside = p.x > min.x - m && p.x < max.x + m && p.y > min.y - m && p.y < max.y + m && p.z > min.z - m && p.z < max.z + m;
    c.material.side = inside ? THREE.BackSide : THREE.FrontSide;
    c.material.depthTest = !inside;
  }
  lake.visible = camera.position.distanceTo(lake.position) < 7000;
  lakeFar.visible = !lake.visible;
  chooseStrides();
  renderer.render(scene, camera);
  state.frame++;
  updateLabels(state.frame % 12 === 0 || state.forceOcc || !!tween);
  state.forceOcc = false;
  if (state.frame % 10 === 0) {
    const p = camera.position;
    const d = Math.hypot(p.x, p.z);
    const brg = (Math.atan2(p.x, -p.z) / DEG + 360) % 360;
    const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
    $('#hud').textContent = `海拔 ${Math.round(p.y).toLocaleString('en-US')} m · 离地 ${Math.round(agl)} m · 位于峰顶${dirs[Math.round(brg / 45) % 8]} ${(d / 1000).toFixed(1)} km · ${state.fps.toFixed(0)} fps`;
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- 启动
async function main() {
  const t0 = performance.now();
  loadText('编译着色器…', 0.02);
  await nextFrame();
  await generateHeights();
  loadText('读取高度数据…', 0.66);
  await nextFrame();
  await readbackHeights();
  computeDerivs();
  await computeAO();
  loadText('计算日照与天空…', 0.85);
  await nextFrame();
  updateSun();
  buildTerrain();
  buildSky();
  buildLake();
  loadText('生成体积云噪声…', 0.9);
  await nextFrame();
  buildClouds();
  buildLabels();
  placeLabels();
  bindUI();
  const params = new URLSearchParams(location.search);
  if (params.has('t')) { state.hour = +params.get('t'); $('#t-hour').value = state.hour; $('#t-hour').dispatchEvent(new Event('input')); }
  setView(params.get('view') ?? 'riffelsee', true);
  loadText('预热渲染…', 0.97);
  renderer.compile(scene, camera);
  await nextFrame();
  state.genMs = performance.now() - t0;
  state.ready = true;
  document.body.classList.add('ready');
  requestAnimationFrame(frame);
}

// 调试 / 测试接口
window.__mh = {
  state, GEO, LEVELS: () => LEVELS.map((L) => ({ name: L.name, cx: L.cx, cz: L.cz, half: L.half, tex: L.tex, mesh: L.mesh })),
  heightAt, heightGeo: (xkm, ykm) => heightAt(...GEO.toWorld(xkm, ykm)),
  setView, setHour: (h) => { state.hour = h; $('#t-hour').value = h; $('#t-hour').dispatchEvent(new Event('input')); updateSun(); },
  setCloud: (v) => { $('#t-cloud').value = v; $('#t-cloud').dispatchEvent(new Event('input')); },
  setSnow: (v) => { $('#t-snow').value = v; $('#t-snow').dispatchEvent(new Event('input')); },
  camera, controls, renderer, scene, U,
  sunDir: () => U.uSunDir.value.toArray(), sunE: () => U.uSunE.value.toArray(),
  info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, fps: state.fps, genMs: state.genMs, pixelRatio, strides: LEVELS.map((L) => [1, 2, 4][L.stride]) }),
  setAuto: (v) => { auto.on = v; },
  settle: async (n = 3) => { for (let i = 0; i < n; i++) await nextFrame(); },
};

main().catch((e) => {
  console.error(e);
  loadText('初始化失败：' + e.message);
  document.body.classList.add('failed');
});
