import { T, C, box, group, bake, clamp, smooth, mix } from "./common.js";
import { poseAt, pulse } from "./timeline.js";
const skin = 5404508, light = 7443563, shade = 3956298, belly = 11581323, spine = 3561286;
function link(g, a, b, width, depth, color) {
  let m = box(g, 0, 0, 0, width, 1, depth, color);
  return { mesh: m, set(p, q) {
    m.position.copy(p).add(q).multiplyScalar(0.5);
    m.scale.y = p.distanceTo(q);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), q.clone().sub(p).normalize());
  } };
}
function makeDinosaur(scene) {
  const root = group(scene), body = group(root), torso = group(body, 0, 3.65, 0);
  box(torso, -0.3, 0, 0, 2.6, 2, 1.65, skin);
  box(torso, -0.65, 0.25, 0, 2, 2.15, 1.5, skin);
  box(torso, 0.6, 0.4, 0, 1.25, 1.65, 1.38, light);
  box(torso, 0.55, -0.7, 0, 1.3, 0.65, 1.25, belly);
  box(torso, -0.4, -0.92, 0, 1.25, 0.34, 1.3, belly);
  box(torso, -1.45, -0.2, 0, 0.65, 1.25, 1.35, shade);
  for (let side of [-1, 1]) {
    for (let i = 0; i < 7; i++) box(torso, -1.1 + i % 4 * 0.48, -0.1 + Math.floor(i / 4) * 0.55, side * 0.835, 0.22, 0.24, 0.07, i % 2 ? light : shade);
    box(torso, -0.5, 0.82, side * 0.78, 0.6, 0.18, 0.13, light);
  }
  for (let i = 0; i < 6; i++) box(torso, -1.35 + i * 0.42, 1.08, 0, 0.28, 0.23, 0.4, spine);
  bake(torso);
  const neck = group(body, 1, 4.15, 0);
  box(neck, 0.13, 0.32, 0, 0.95, 1.7, 1.12, skin, -0.28);
  box(neck, 0.45, 0.32, 0, 0.42, 1.43, 0.9, belly, -0.28);
  box(neck, 0.45, 1.05, 0, 1.16, 0.7, 1.2, light);
  bake(neck);
  const head = group(body, 1.55, 5.37, 0);
  box(head, 0.55, 0.2, 0, 1.9, 1.05, 1.42, skin);
  box(head, 1.38, 0.02, 0, 0.9, 0.75, 1.2, light);
  box(head, 1.8, -0.08, 0, 0.22, 0.45, 1.05, skin);
  box(head, 0.45, 0.71, 0, 1.5, 0.23, 1.35, light);
  box(head, 1.3, 0.45, 0, 0.9, 0.14, 1.13, light);
  for (let s of [-1, 1]) {
    box(head, 0.19, 0.38, s * 0.75, 0.53, 0.38, 0.13, shade);
    box(head, 0.31, 0.39, s * 0.83, 0.27, 0.25, 0.045, 15187552);
    box(head, 0.38, 0.4, s * 0.86, 0.09, 0.22, 0.025, 1845797);
    box(head, 0.19, 0.65, s * 0.8, 0.63, 0.15, 0.19, shade);
    box(head, 1.56, 0.19, s * 0.615, 0.16, 0.13, 0.04, shade);
    box(head, 0.83, -0.31, s * 0.69, 1.65, 0.12, 0.06, 2570800);
    for (let i = 0; i < 6; i++) box(head, 0.45 + i * 0.23, -0.42, s * 0.55, 0.13, 0.23, 0.14, C.ivory);
  }
  bake(head);
  const jaw = group(head, 0.1, -0.35, 0);
  box(jaw, 0.82, -0.25, 0, 1.85, 0.35, 1.03, skin);
  box(jaw, 0.72, -0.43, 0, 1.5, 0.13, 0.85, belly);
  box(jaw, 0.86, -0.06, 0, 1.5, 0.09, 0.77, 9002062);
  for (let s of [-1, 1]) for (let i = 0; i < 5; i++) box(jaw, 0.45 + i * 0.24, 0.015, s * 0.45, 0.12, 0.17, 0.13, C.ivory);
  bake(jaw);
  for (let s of [-1, 1]) {
    let a = group(body, 0.65, 3.75, s * 0.83);
    box(a, 0.2, -0.18, s * 0.12, 0.7, 0.34, 0.34, skin, -0.6);
    box(a, 0.58, -0.4, s * 0.17, 0.4, 0.2, 0.24, light);
    for (let i = 0; i < 2; i++) box(a, 0.78, -0.45, s * (0.1 + i * 0.18), 0.26, 0.1, 0.1, C.ivory);
    bake(a);
  }
  let tails = [], parent = body;
  for (let i = 0; i < 8; i++) {
    let a = group(parent, i === 0 ? -1.25 : -0.79, i === 0 ? 3.6 : 0, 0), size = 1.12 - i * 0.125;
    box(a, -0.43, 0, 0, 0.94, size, size, i % 2 ? skin : shade);
    box(a, -0.43, -size * 0.39, 0, 0.9, size * 0.19, size * 0.8, belly);
    box(a, -0.43, size * 0.53, 0, 0.25, 0.16, size * 0.35, spine);
    bake(a);
    tails.push(a);
    parent = a;
  }
  let legs = [];
  for (let s of [-1, 1]) {
    let a = group(root);
    let thigh = link(a, null, null, 1.12, 1.08, skin), shin = link(a, null, null, 0.56, 0.64, light), foot = group(a);
    box(foot, 0.18, 0.12, 0, 1.2, 0.28, 0.69, skin);
    box(foot, -0.12, 0.32, 0, 0.57, 0.3, 0.6, light);
    for (let i = -1; i <= 1; i++) {
      box(foot, 0.67, 0.1, i * 0.24, 0.41, 0.19, 0.19, shade);
      box(foot, 0.88, 0.1, i * 0.24, 0.18, 0.13, 0.17, C.ivory);
    }
    bake(foot);
    legs.push({ s, thigh, shin, foot });
  }
  let worldContact = new T.Vector3(), tailPoints = [];
  function update(t) {
    let p = poseAt(t), step = p.distance / 3.4;
    root.position.set(p.x, 0.02, p.z);
    root.rotation.y = p.yaw;
    let stomp = pulse(t, 16, 17.7, 18.1, 18.8), ram = pulse(t, 24.1, 25.2, 26.5, 28), sweep = pulse(t, 34.5, 36.7, 37.2, 39.3);
    let bob = Math.sin(step * Math.PI * 4) * 0.075;
    body.position.y = bob - 0.22 * ram;
    torso.rotation.z = -0.1 * ram;
    head.rotation.z = -0.14 * ram + 0.04 * Math.sin(t * 1.4);
    jaw.rotation.z = -0.3 * pulse(t, 13.9, 14.8, 15.4, 16.2) - 0.18 * ram;
    neck.rotation.z = -0.08 * ram;
    legs.forEach(({ s, thigh, shin, foot }, i) => {
      let phase = ((step + i * 0.5) % 1 + 1) % 1, fx, fy;
      if (phase < 0.65) {
        fx = 1.1 - phase / 0.65 * 2.2;
        fy = 0.08;
      } else {
        let u = (phase - 0.65) / 0.35;
        fx = mix(-1.1, 1.1, smooth(u));
        fy = 0.08 + Math.sin(u * Math.PI) * 0.64;
      }
      if (t >= 16 && t <= 20 && s === 1) {
        fx = mix(fx, 0.93, pulse(t, 16, 17, 19, 20));
        fy += 2.1 * stomp;
      }
      let fz = s * 0.98, turn = (-0.15 - p.yaw) * pulse(t, 33, 33.2, 38.5, 40);
      let tx = fx * Math.cos(turn) + fz * Math.sin(turn);
      fz = fz * Math.cos(turn) - fx * Math.sin(turn);
      fx = tx;
      foot.rotation.y = turn;
      let ankle = new T.Vector3(fx, 0.35 + fy, fz), hip = new T.Vector3(-0.45, 3.22 + bob, s * 0.77), delta = ankle.clone().sub(hip), dist = delta.length(), mid = hip.clone().add(ankle).multiplyScalar(0.5), bend = Math.sqrt(Math.max(0.04, 1.8 * 1.8 - dist * dist / 4)), perp = new T.Vector3(-delta.y, delta.x, 0).normalize();
      let knee = mid.addScaledVector(perp, bend);
      thigh.set(hip, knee);
      shin.set(knee, ankle);
      foot.position.set(fx, fy, fz);
      foot.rotation.z = phase > 0.65 ? -0.16 * Math.sin((phase - 0.65) / 0.35 * Math.PI) : 0;
    });
    tails.forEach((a, i) => {
      a.rotation.y = (i === 0 ? -0.82 * sweep + 0.2 * pulse(t, 33.4, 34.3, 34.5, 35.3) : -0.035 * sweep) + 0.025 * Math.sin(t * 2 - i * 0.6);
      a.rotation.z = (i === 0 ? 0.04 : 0.035) + 0.02 * Math.sin(step * 6 - i * 0.55);
    });
    root.updateMatrixWorld(true);
    tailPoints = tails.map((a) => a.localToWorld(new T.Vector3(-0.6, 0, 0)));
    return p;
  }
  return { root, update, contacts() {
    return { stomp: legs[1].foot.localToWorld(new T.Vector3(0.25, -0.02, 0)), ram: head.localToWorld(new T.Vector3(1.91, -0.25, 0)), tail: tailPoints.map((v) => v.clone()) };
  }, footPositions() {
    return legs.map((l) => l.foot.getWorldPosition(new T.Vector3()));
  } };
}
export {
  makeDinosaur
};
