import * as T from "../vendor/three.module.min.js";
const C = { cream: 15127463, ivory: 16116170, terra: 12150346, red: 11096383, teal: 4684919, dark: 3230536, glass: 3626075, blue: 7838103, ochre: 13212498, green: 6522714, leaf: 8627308, road: 6648945, pavement: 12237744, metal: 4611416 };
const mats = /* @__PURE__ */ new Map();
const geo = new T.BoxGeometry(1, 1, 1);
function material(color) {
  if (!mats.has(color)) mats.set(color, new T.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0 }));
  return mats.get(color);
}
function box(g, x, y, z, w, h, d, c, rz = 0) {
  const m = new T.Mesh(geo, material(c));
  m.position.set(x, y, z);
  m.scale.set(w, h, d);
  m.rotation.z = rz;
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}
function group(g, x = 0, y = 0, z = 0) {
  let a = new T.Group();
  a.position.set(x, y, z);
  g.add(a);
  return a;
}
function bake(g) {
  g.updateMatrixWorld(true);
  const inv = g.matrixWorld.clone().invert(), buckets = /* @__PURE__ */ new Map(), old = [];
  g.traverse((o) => {
    if (o.isMesh && !o.isInstancedMesh && o.geometry === geo) {
      let a = buckets.get(o.material);
      if (!a) {
        a = [];
        buckets.set(o.material, a);
      }
      a.push(new T.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      old.push(o);
    }
  });
  old.forEach((o) => o.removeFromParent());
  for (const [mat, ms] of buckets) {
    let mesh = new T.InstancedMesh(geo, mat, ms.length);
    ms.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  return g;
}
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (v) => {
  v = clamp(v);
  return v * v * (3 - 2 * v);
};
const mix = (a, b, t) => a + (b - a) * t;
function rng(seed) {
  return () => {
    seed |= 0;
    seed = seed + 1831565813 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function label(g, text, x, y, z, w, color = "#eadbb9", bg = "#355c56") {
  let canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  let ctx = canvas.getContext("2d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = color;
  ctx.font = "bold 65px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 66);
  let tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  let m = new T.Mesh(new T.PlaneGeometry(w, w / 4), new T.MeshStandardMaterial({ map: tex, roughness: 1 }));
  m.position.set(x, y, z);
  g.add(m);
  return m;
}
export {
  C,
  T,
  bake,
  box,
  clamp,
  geo,
  group,
  label,
  material,
  mix,
  rng,
  smooth
};
