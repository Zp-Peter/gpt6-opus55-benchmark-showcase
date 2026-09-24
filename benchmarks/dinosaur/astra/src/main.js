import { T, box, C } from "./common.js";
import { makeCity, makeTargets } from "./city.js";
import { makeDinosaur } from "./dinosaur.js";
import { makeDestruction } from "./destruction.js";
import { DURATION, chapter } from "./timeline.js";
const stage = document.querySelector("#stage");
let renderer;
try {
  renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
} catch (error) {
  document.querySelector("#error").hidden = false;
  document.querySelector("#error").textContent = "\u6B64\u6D4F\u89C8\u5668\u65E0\u6CD5\u542F\u52A8 WebGL\uFF0C\u8BF7\u5728\u652F\u6301\u786C\u4EF6\u52A0\u901F\u7684 Chrome\u3001Edge \u6216 Safari \u4E2D\u6253\u5F00\u3002";
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
stage.appendChild(renderer.domElement);
const scene = new T.Scene();
scene.background = new T.Color(14999248);
scene.fog = new T.Fog(14999248, 105, 190);
const camera = new T.OrthographicCamera(-25, 25, 16, -16, 0.1, 220);
scene.add(new T.HemisphereLight(15986139, 8557955, 2));
const sun = new T.DirectionalLight(16769452, 3.4);
sun.position.set(-18, 32, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 32, bottom: -32, near: 1, far: 90 });
sun.shadow.normalBias = 0.035;
sun.shadow.bias = -15e-5;
scene.add(sun);
const fill = new T.DirectionalLight(14215142, 0.7);
fill.position.set(15, 12, -20);
scene.add(fill);
box(scene, 0, -1.16, 0, 240, 0.3, 180, 14999248);
const city = makeCity(scene), targets = makeTargets(scene), dino = makeDinosaur(scene), damage = makeDestruction(scene, targets);
let time = 0, paused = false, last = performance.now(), frameTimes = [], run = 1;
const pauseButton = document.querySelector("#pause");
function sync() {
  document.querySelector("#pauseLabel").textContent = paused ? "\u7EE7\u7EED" : "\u6682\u505C";
  document.querySelector("#pauseIcon").textContent = paused ? "\u25B7" : "\u2161";
  pauseButton.setAttribute("aria-label", paused ? "\u7EE7\u7EED\u52A8\u753B" : "\u6682\u505C\u52A8\u753B");
  pauseButton.setAttribute("aria-pressed", String(paused));
}
pauseButton.addEventListener("click", () => {
  if (time >= DURATION) return;
  paused = !paused;
  sync();
});
document.querySelector("#replay").addEventListener("click", () => {
  time = 0;
  paused = false;
  last = performance.now();
  damage.reset();
  run++;
  sync();
  renderState();
});
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && e.target === document.body) {
    e.preventDefault();
    pauseButton.click();
  }
});
document.addEventListener("visibilitychange", () => {
  last = performance.now();
});
function resize() {
  let w = innerWidth, h = innerHeight, aspect = w / h;
  const height = Math.max(32, 50 / aspect);
  camera.left = -height * aspect / 2;
  camera.right = height * aspect / 2;
  camera.top = height / 2;
  camera.bottom = -height / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener("resize", resize);
resize();
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
function renderState() {
  document.querySelector("header").style.opacity = time < 6 ? 1 : time < 9 ? 1 - (time - 6) / 3 : time < 52 ? 0 : Math.min(1, (time - 52) / 3);
  city.update(time);
  dino.update(time);
  damage.update(time, dino.contacts());
  let drift = reduce ? 0 : Math.sin(Math.min(time, 52) / 60 * Math.PI) * 0.8;
  let shake = 0;
  if (!reduce) for (let e of damage.events) {
    let a = time - e.time;
    if (a >= 0 && a < 0.4) shake += Math.sin(a * 60) * 0.045 * (1 - a / 0.4);
  }
  camera.position.set(28 + drift + shake, 29, 38 + shake);
  camera.lookAt(0, 1.4, 0);
  document.querySelector("#time").textContent = "00:" + String(Math.floor(time)).padStart(2, "0");
  if (time === 60) document.querySelector("#time").textContent = "01:00";
  document.querySelector("#progress").style.width = time / 60 * 100 + "%";
  document.querySelector("#chapter").textContent = chapter(time);
  renderer.render(scene, camera);
}
function frame(now) {
  let dt = (now - last) / 1e3;
  last = now;
  if (!paused && !document.hidden && time < 60) {
    const end = Math.min(60, time + Math.min(dt, 0.1));
    while (time < end) {
      time = Math.min(end, time + 1 / 60);
      dino.update(time);
      damage.update(time, dino.contacts());
    }
    if (time >= 60) {
      paused = true;
      sync();
      document.querySelector("#pauseLabel").textContent = "\u5DF2\u7ED3\u675F";
    }
  }
  frameTimes.push(dt * 1e3);
  if (frameTimes.length > 300) frameTimes.shift();
  renderState();
  requestAnimationFrame(frame);
}
window.demo = { snapshot: () => ({ time, paused, run, events: damage.events, states: targets.map((t) => ({ id: t.id, state: t.state })), debris: damage.debrisCount, dust: damage.activeDust, minRubbleY: damage.settledMinY, dinoX: dino.root.position.x, dinoVisible: dino.root.visible, objects: countObjects(), drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, medianFrameMs: [...frameTimes].sort((a, b) => a - b)[Math.floor(frameTimes.length / 2)], feet: dino.footPositions().map((p) => p.toArray()) }) };
function countObjects() {
  let n = 0;
  scene.traverse(() => n++);
  return n;
}
renderState();
requestAnimationFrame(frame);
