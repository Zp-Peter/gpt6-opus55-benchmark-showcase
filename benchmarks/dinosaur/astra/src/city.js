import { T, C, box, group, bake, label, rng } from "./common.js";
function windows(g, w, d, h) {
  for (let y = 1.55; y < h - 0.35; y += 1.05) {
    for (let x = -w / 2 + 0.5; x < w / 2 - 0.15; x += 0.8) {
      box(g, x, y, d / 2 + 0.02, 0.45, 0.61, 0.08, C.ivory);
      box(g, x, y + 0.03, d / 2 + 0.07, 0.32, 0.46, 0.07, C.glass);
      box(g, x, y - 0.32, d / 2 + 0.14, 0.55, 0.09, 0.25, C.cream);
    }
    for (let z = -d / 2 + 0.5; z < d / 2 - 0.1; z += 0.85) {
      box(g, w / 2 + 0.04, y, z, 0.08, 0.58, 0.46, C.ivory);
      box(g, w / 2 + 0.09, y + 0.02, z, 0.07, 0.44, 0.32, C.glass);
    }
  }
}
function building(g, x, z, w, d, h, color, type, name) {
  let a = group(g, x, 0.19, z);
  box(a, 0, 0.13, 0, w + 0.28, 0.26, d + 0.28, C.dark);
  box(a, 0, h / 2 + 0.25, 0, w, h, d, color);
  for (let y = 1.02; y < h; y += 1.05) box(a, 0, y, 0, w + 0.12, 0.13, d + 0.12, C.cream);
  windows(a, w, d, h);
  box(a, 0, 0.67, d / 2 + 0.06, 0.6, 1.1, 0.13, C.dark);
  box(a, 0.15, 0.65, d / 2 + 0.15, 0.04, 0.22, 0.08, C.ochre);
  box(a, 0, h + 0.26, 0, w + 0.28, 0.2, d + 0.28, C.ivory);
  box(a, 0, h + 0.4, 0, w - 0.25, 0.15, d - 0.25, C.dark);
  if (type === "gable") {
    for (let i = 0; i < 6; i++) box(a, 0, h + 0.5 + i * 0.16, 0, w + 0.45 - i * 0.35, 0.18, d + 0.38, C.red);
    box(a, -w * 0.27, h + 1.35, -d * 0.24, 0.35, 0.9, 0.42, C.terra);
  } else if (type === "tower") {
    box(a, -0.25, h + 0.8, -0.2, w * 0.65, 0.7, d * 0.64, color);
    box(a, -0.25, h + 1.2, -0.2, w * 0.7, 0.14, d * 0.7, C.cream);
    box(a, 0.35, h + 1.85, -0.25, 0.13, 1.3, 0.13, C.metal);
    box(a, 0.35, h + 2.45, -0.25, 0.5, 0.1, 0.12, C.metal);
  } else if (type === "water") {
    for (let x2 of [-0.5, 0.5]) for (let z2 of [-0.4, 0.4]) box(a, x2, h + 0.8, z2, 0.09, 0.75, 0.09, C.metal);
    box(a, 0, h + 1.2, 0, 1.25, 0.85, 1.1, C.ochre);
    box(a, 0, h + 1.65, 0, 1.35, 0.13, 1.2, C.red);
    box(a, -w * 0.34, h + 0.8, d * 0.2, 0.1, 1.1, 0.1, C.metal);
  } else {
    box(a, -0.55, h + 0.65, -0.35, 0.8, 0.45, 0.65, C.pavement);
    for (let i = 0; i < 4; i++) box(a, -0.82 + i * 0.18, h + 0.9, -0.35, 0.07, 0.03, 0.52, C.metal);
    box(a, 0.7, h + 0.6, -0.3, 0.7, 0.25, 0.9, C.blue);
  }
  if (type === "shop" || type === "gable") {
    for (let i = 0; i < Math.round(w / 0.35); i++) box(a, -w / 2 + 0.17 + i * 0.35, 1.17, d / 2 + 0.37, 0.35, 0.15, 0.82, i % 2 ? C.ivory : C.terra);
    box(a, -w * 0.29, 0.64, d / 2 + 0.07, 0.68, 0.72, 0.12, C.glass);
    box(a, w * 0.29, 0.64, d / 2 + 0.07, 0.68, 0.72, 0.12, C.glass);
    label(a, name, 0, 1.6, d / 2 + 0.085, w * 0.78);
  }
  if (type === "water") {
    for (let y = 2; y < h; y += 1.1) {
      box(a, 0, y, d / 2 + 0.4, w * 0.68, 0.12, 0.65, C.cream);
      box(a, 0, y + 0.25, d / 2 + 0.69, w * 0.7, 0.35, 0.06, C.metal);
      for (let x2 = -w * 0.32; x2 < w * 0.34; x2 += 0.33) box(a, x2, y + 0.25, d / 2 + 0.7, 0.04, 0.4, 0.05, C.ivory);
    }
  }
  return a;
}
function tree(g, x, z, s = 1) {
  let a = group(g, x, 0.2, z);
  box(a, 0, 0.5 * s, 0, 0.22 * s, 1 * s, 0.22 * s, 7822403);
  box(a, 0, 1.35 * s, 0, 1.05 * s, 0.8 * s, 0.95 * s, C.green);
  box(a, 0.1, 1.95 * s, 0, 0.8 * s, 0.45 * s, 0.75 * s, C.leaf);
  box(a, -0.42, 1.2 * s, 0.15, 0.5 * s, 0.5 * s, 0.65 * s, 7246430);
  box(a, 0.39, 1.43 * s, -0.12, 0.45 * s, 0.6 * s, 0.65 * s, 7904356);
  box(a, 0, 0.07, 0, 0.72, 0.14, 0.72, 9739903);
}
function lamp(g, x, z) {
  box(g, x, 1.25, z, 0.09, 2.5, 0.09, C.metal);
  box(g, x + 0.25, 2.48, z, 0.6, 0.09, 0.09, C.metal);
  box(g, x + 0.47, 2.38, z, 0.32, 0.13, 0.21, C.cream);
  box(g, x, 0.18, z, 0.24, 0.36, 0.24, C.metal);
}
function makeCity(scene) {
  let stat = group(scene);
  box(stat, 0, -0.51, 0, 33, 1, 27, 7176565);
  box(stat, 0, -0.05, 0, 33.25, 0.2, 27.25, 13158063);
  box(stat, 0, -0.85, 0, 32, 0.3, 26, 4217680);
  box(stat, 0, -0.18, 0, 150, 0.4, 4.6, 7701370);
  box(stat, 0, 0.025, 0, 150, 0.07, 4.4, C.road);
  for (let z of [-4, 4]) box(stat, 0, 0.025, z, 32.9, 0.06, 2.7, C.road);
  for (let z of [-12.8, 12.8]) box(stat, 0, 0.025, z, 32.6, 0.06, 1.25, C.road);
  for (let x of [-15.55, 15.55]) box(stat, x, 0.025, 0, 1.65, 0.06, 26.5, C.road);
  for (let x of [-5.7, 5.7]) box(stat, x, 0.025, 0, 2.7, 0.06, 26.8, C.road);
  for (let z of [-9, 0, 9]) for (let x of [-11, 0, 11]) {
    if (z === 0) continue;
    box(stat, x, 0.13, z, 7.5, 0.22, z === 0 ? 4.1 : 6.5, C.pavement);
    for (let xx = -3.5; xx < 3.7; xx += 0.5) {
      box(stat, x + xx, 0.26, z + (z === 0 ? 2.02 : 3.22), 0.43, 0.12, 0.16, C.ivory);
      box(stat, x + xx, 0.26, z - (z === 0 ? 2.02 : 3.22), 0.43, 0.12, 0.16, C.ivory);
    }
  }
  for (let x = -65; x < 66; x += 1.8) {
    if (Math.abs(Math.abs(x) - 5.7) < 1.4) continue;
    box(stat, x, 0.071, 0, 0.85, 0.016, 0.07, C.cream);
  }
  for (let x of [-5.7, 5.7]) for (let z of [-4, 4]) {
    for (let i = -2; i <= 2; i++) {
      box(stat, x + i * 0.32, 0.072, z + 1.7, 0.19, 0.015, 0.64, C.ivory);
      box(stat, x + i * 0.32, 0.072, z - 1.7, 0.19, 0.015, 0.64, C.ivory);
    }
  }
  building(stat, -12, -10.3, 3.7, 3.2, 4.3, C.teal, "water", "");
  building(stat, -8.4, -10.3, 2.5, 2.8, 2.3, C.ochre, "gable", "BAKERY");
  building(stat, -1.8, -9.5, 3.1, 3, 5.4, C.terra, "tower", "");
  building(stat, 2, -9.5, 2.7, 3, 3.1, C.cream, "water", "");
  building(stat, 9, -10.5, 3.1, 3.4, 6.1, C.blue, "tower", "");
  building(stat, 12.6, -10.4, 2.6, 3, 3.2, C.ochre, "gable", "");
  building(stat, -11, -6.8, 4.6, 2.2, 2.2, C.cream, "shop", "CORNER CAFE");
  building(stat, 11, -6.8, 4.8, 2.2, 2.5, C.teal, "shop", "RECORDS");
  building(stat, -12, 8.7, 3, 3.4, 2.6, C.terra, "gable", "FLORIST");
  building(stat, -8.5, 9.3, 2.6, 2.8, 3.2, C.cream, "water", "");
  building(stat, 0, 9.3, 4.8, 3.1, 2.1, C.ochre, "shop", "SUNNY MARKET");
  building(stat, 10, 9, 4.2, 3.5, 3.4, C.cream, "gable", "ATELIER");
  for (let [x, z, s] of [[-14.6, -7.3, 0.8], [-7.9, -7, 0.7], [-3.5, -6.2, 0.75], [14.4, -7, 0.8], [-14, 5.8, 0.9], [-7.8, 6, 0.7], [3.5, 7, 0.85], [7.8, 6, 1], [13, 7, 0.8], [-2.8, 7, 0.65], [14, 11, 0.9]]) tree(stat, x, z, s);
  for (let [x, z] of [[-15, 2.6], [-7.7, -2.6], [-3.6, 5.5], [7.6, 2.6], [14, -2.6], [7.6, -5.6], [-14, 5.5]]) lamp(stat, x, z);
  for (let [x, z] of [[-13, 2.6], [-3.5, 6.5], [8, 6.2], [12, -5.8]]) {
    box(stat, x, 0.48, z, 1, 0.13, 0.4, 9463878);
    for (let dx of [-0.38, 0.38]) box(stat, x + dx, 0.25, z, 0.08, 0.5, 0.32, C.metal);
    box(stat, x, 0.75, z - 0.2, 1, 0.35, 0.08, 9463878);
    box(stat, x + 1, 0.4, z, 0.35, 0.65, 0.35, C.teal);
  }
  for (let x = 8; x < 14; x += 1.3) {
    box(stat, x, 0.27, 11.9, 0.06, 0.02, 1.3, C.ivory);
    box(stat, x + 0.5, 0.27, 12.5, 1, 0.02, 0.06, C.ivory);
  }
  let rand = rng(56);
  for (let i = 0; i < 60; i++) {
    let x = -3 + rand() * 5, z = 6 + rand() * 0.65;
    box(stat, x, 0.35, z, 0.14, 0.2, 0.14, [C.terra, C.ochre, C.ivory][i % 3]);
  }
  for (let i = 0; i < 7; i++) box(stat, -2.8 + i * 0.8, 0.265, 8, 0.5, 0.025, 0.5, 13947067);
  label(stat, "SMALL HOURS", 0, -0.51, 13.52, 8, "#e4d9b6", "#506a5e").scale.y = 0.3;
  bake(stat);
  const cars = [];
  for (let i = 0; i < 5; i++) {
    let c = group(scene);
    box(c, 0, 0.36, 0, 1.35, 0.36, 0.68, [C.terra, C.ochre, C.teal, C.ivory, C.blue][i]);
    box(c, -0.1, 0.68, 0, 0.69, 0.36, 0.6, C.glass);
    box(c, -0.1, 0.88, 0, 0.78, 0.09, 0.66, [C.terra, C.ochre, C.teal, C.ivory, C.blue][i]);
    for (let x of [-0.42, 0.43]) for (let z of [-0.35, 0.35]) {
      box(c, x, 0.23, z, 0.27, 0.3, 0.16, C.dark);
      box(c, x, 0.23, z * 1.2, 0.12, 0.14, 0.025, C.pavement);
    }
    for (let z of [-0.22, 0.22]) box(c, 0.69, 0.39, z, 0.05, 0.1, 0.14, C.ivory);
    bake(c);
    cars.push(c);
  }
  return { cars, update(t) {
    cars.forEach((c, i) => {
      if (i > 2) {
        c.position.set(9.95 + (i - 3) * 1.3, 0.23, 11.8);
        c.rotation.y = Math.PI / 2;
        return;
      }
      let d = (t * (0.65 + i * 0.07) + i * 37) % 113.4;
      let x, z, yaw;
      if (d < 31.1) {
        x = -15.55 + d;
        z = -12.8;
        yaw = 0;
      } else if (d < 56.7) {
        x = 15.55;
        z = -12.8 + d - 31.1;
        yaw = -Math.PI / 2;
      } else if (d < 87.8) {
        x = 15.55 - (d - 56.7);
        z = 12.8;
        yaw = Math.PI;
      } else {
        x = -15.55;
        z = 12.8 - (d - 87.8);
        yaw = Math.PI / 2;
      }
      c.position.set(x, 0.03, z);
      c.rotation.y = yaw;
    });
  } };
}
function makeTargets(scene) {
  const specs = [{ id: "stomp", x: -6.05, z: 1.13, w: 1.8, d: 1.65, h: 1.35, color: C.teal }, { id: "ram", x: 5.2, z: 1.05, w: 3.1, d: 3, h: 4.5, color: C.terra }, { id: "tail", x: 1, z: -4.8, w: 3.5, d: 2.2, h: 3.25, color: C.ochre }];
  const targets = specs.map((s) => {
    let root2 = group(scene, s.x, 0.13, s.z), parts = [];
    box(root2, 0, 0.12, 0, s.w + 0.18, 0.24, s.d + 0.18, C.dark);
    const cols = s.id === "stomp" ? 2 : 3, levels = s.id === "stomp" ? 1 : 3;
    for (let col = 0; col < cols; col++) for (let level = 0; level < levels; level++) {
      let pw = s.w / cols, ph = s.h / levels;
      let p = group(root2, -s.w / 2 + pw * (col + 0.5), 0.24 + ph * (level + 0.5), 0);
      box(p, 0, 0, 0, pw - 0.02, ph - 0.03, s.d, s.color);
      for (let face of [-1, 1]) {
        box(p, 0, 0, face * (s.d / 2 + 0.035), pw * 0.62, ph * 0.57, 0.08, C.ivory);
        box(p, 0, 0.02, face * (s.d / 2 + 0.09), pw * 0.45, ph * 0.43, 0.08, C.glass);
      }
      box(p, 0, -ph / 2 + 0.08, 0, pw, 0.14, s.d + 0.12, C.cream);
      if (level === levels - 1) {
        box(p, 0, ph / 2 + 0.06, 0, pw + 0.05, 0.18, s.d + 0.25, C.ivory);
        box(p, 0, ph / 2 + 0.2, 0, pw - 0.13, 0.14, s.d - 0.1, C.dark);
      }
      bake(p);
      parts.push({ mesh: p, col, level, size: new T.Vector3(pw, ph, s.d), origin: p.position.clone(), rotation: p.rotation.clone() });
    }
    if (s.id === "stomp") {
      let p = parts[0].mesh;
      box(p, 0, 0.45, s.d / 2 + 0.3, 0.9, 0.12, 0.6, C.terra);
      label(p, "NEWS", 0.35, 0.2, s.d / 2 + 0.13, 1.3);
    }
    return { ...s, root: root2, parts, state: "intact", at: null, bounds: new T.Box3(new T.Vector3(s.x - s.w / 2, 0.3, s.z - s.d / 2), new T.Vector3(s.x + s.w / 2, s.h + 0.6, s.z + s.d / 2)) };
  });
  const root = group(scene, -0.8, 0.09, -3.4), pole = group(root);
  box(pole, 0, 1.25, 0, 0.12, 2.5, 0.12, C.metal);
  box(pole, 0.27, 2.5, 0, 0.66, 0.12, 0.12, C.metal);
  box(pole, 0.52, 2.4, 0, 0.3, 0.14, 0.24, C.cream);
  box(pole, 0, 0.15, 0, 0.3, 0.3, 0.3, C.metal);
  bake(pole);
  targets.push({ id: "fixture", attack: "tail", color: C.metal, root, parts: [{ mesh: pole, col: 0, level: 0, size: new T.Vector3(0.8, 2.6, 0.3), origin: pole.position.clone(), rotation: pole.rotation.clone() }], state: "intact", at: null, bounds: new T.Box3(new T.Vector3(-0.95, 0.15, -3.56), new T.Vector3(-0.18, 2.7, -3.24)) });
  return targets;
}
export {
  makeCity,
  makeTargets
};
