// 渲染器、灯光、背景与正交镜头（三分之四俯视的微缩模型视角）。
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const VIEW = { azimuth: THREE.MathUtils.degToRad(34), elevation: THREE.MathUtils.degToRad(33), W: 356, H: 200 };
const SUN_DIR = new THREE.Vector3(-0.52, 0.78, 0.36).normalize();

export function createStage(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = gradientTexture();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;

  const hemi = new THREE.HemisphereLight(0xd6e4ff, 0x8a7a5c, 1.25);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe4c2, 2.9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  sc.left = -240; sc.right = 240; sc.top = 200; sc.bottom = -200; sc.near = 10; sc.far = 900;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.35; sun.shadow.radius = 2.5;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xbcd0ff, 0.35);
  fill.position.set(300, 200, 260);
  scene.add(fill);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000);
  const cam = { target: new THREE.Vector3(0, 6, 0), zoom: 1, shake: 0, shakeT: 0, azimuth: VIEW.azimuth };

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    let vw, vh;
    if (aspect > VIEW.W / VIEW.H) { vh = VIEW.H; vw = vh * aspect; } else { vw = VIEW.W; vh = vw / aspect; }
    camera.left = -vw / 2; camera.right = vw / 2; camera.top = vh / 2; camera.bottom = -vh / 2;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  const dir = new THREE.Vector3();
  function updateCamera(simT) {
    dir.set(Math.sin(cam.azimuth) * Math.cos(VIEW.elevation), Math.sin(VIEW.elevation), Math.cos(cam.azimuth) * Math.cos(VIEW.elevation));
    const t = cam.target.clone();
    // 震动：只在关键撞击时短促出现
    if (cam.shake > 0.001) {
      const s = cam.shake;
      t.x += Math.sin(simT * 91.7) * s; t.y += Math.sin(simT * 77.3 + 1) * s * 0.6; t.z += Math.sin(simT * 83.1 + 2) * s;
    }
    camera.position.copy(t).addScaledVector(dir, 700);
    camera.lookAt(t);
    camera.zoom = cam.zoom;
    camera.updateProjectionMatrix();
    // 阴影相机跟随取景中心，并按纹素对齐避免闪烁
    const texel = (sc.right - sc.left) / sun.shadow.mapSize.x;
    const tx = Math.round(cam.target.x / texel) * texel, tz = Math.round(cam.target.z / texel) * texel;
    sun.target.position.set(tx, 0, tz);
    sun.position.set(tx, 0, tz).addScaledVector(SUN_DIR, 420);
  }
  return { renderer, scene, camera, cam, updateCamera, resize, sun };
}

function gradientTexture() {
  const c = document.createElement('canvas'); c.width = 16; c.height = 512;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#3b4a5b'); gr.addColorStop(0.55, '#27313d'); gr.addColorStop(1, '#161b22');
  g.fillStyle = gr; g.fillRect(0, 0, 16, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
