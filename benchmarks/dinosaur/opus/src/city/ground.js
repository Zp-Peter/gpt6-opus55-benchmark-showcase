// 展示底座与地面：胡桃木底座、黄铜收边、道路、路缘石、人行道砖、标线、斑马线、停车位、城外田地。
import * as THREE from 'three';
import { grainMaterial } from '../voxel/materials.js';
import { BLOCK_C, ROAD_C, ROAD, CITY, PLINTH, WALK } from './layout.js';

class BoxBatch {
  constructor() { this.P = []; this.N = []; this.C = []; }
  // 仅生成需要的面：faces 位掩码 +x -x +y -y +z -z
  box(x0, y0, z0, x1, y1, z1, hex, faces = 0b111111) {
    const c = new THREE.Color(hex);
    const quads = [
      [[1, 0, 0], [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]]],
      [[-1, 0, 0], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]]],
      [[0, 1, 0], [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]]],
      [[0, -1, 0], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]],
      [[0, 0, 1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]],
      [[0, 0, -1], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]]],
    ];
    quads.forEach(([n, vs], i) => {
      if (!(faces & (1 << (5 - i)))) return;
      const tri = [vs[0], vs[1], vs[2], vs[0], vs[2], vs[3]];
      for (const v of tri) { this.P.push(...v); this.N.push(...n); this.C.push(c.r, c.g, c.b); }
    });
  }
  top(x0, z0, x1, z1, y, hex) { this.box(x0, y - 0.01, z0, x1, y, z1, hex, 0b001000); }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    return g;
  }
}

export const G = {
  asphalt: 0x44474d, asphaltLight: 0x4c4f55, mark: 0xe9e4d4, yellow: 0xe0b44a, curb: 0x9a958c,
  walk: 0xc4bdb0, walkB: 0xb8b1a3, grass: 0x78a24f, grassB: 0x6b9446, soil: 0x8a6a48, plaza: 0xd7cdb8, plazaB: 0xcbc0a8,
  walnut: 0x5b3b27, walnutD: 0x442b1c, brass: 0xc9a45a, park: 0x6f9b48,
};

export function buildGround(lots) {
  const B = new BoxBatch();
  const { x0, x1, z0, z1 } = PLINTH;
  // 底座（顶面在 y=-1，上面铺地表）
  B.box(x0, -14, z0, x1, -1, z1, G.walnut, 0b110111);
  B.box(x0 - 0.6, -3.2, z0 - 0.6, x1 + 0.6, -2.2, z1 + 0.6, G.brass, 0b110011);
  B.box(x0 - 1.2, -16, z0 - 1.2, x1 + 1.2, -14, z1 + 1.2, G.walnutD, 0b111011);
  // 城外草地：按道路分成若干整块（侧面可见），顶面铺 6×6 草格 / 田垄
  const regions = [];
  for (const [za, zb] of [[z0, -54], [-30, 30], [54, z1]]) { regions.push([x0, za, -CITY, zb]); regions.push([CITY, za, x1, zb]); }
  regions.push([-CITY, z0, CITY, -CITY - 6]); regions.push([-CITY, CITY + 6, CITY, z1]);
  regions.push([-CITY, -CITY - 6, -54, -CITY]); regions.push([-30, -CITY - 6, 30, -CITY]); regions.push([54, -CITY - 6, CITY, -CITY]);
  regions.push([-CITY, CITY, -54, CITY + 6]); regions.push([-30, CITY, 30, CITY + 6]); regions.push([54, CITY, CITY, CITY + 6]);
  for (const [a, b, c, d] of regions) {
    B.box(a, -1, b, c, 0.99, d, 0x6a5a3e, 0b110111);
    for (let x = a; x < c; x += 6) for (let z = b; z < d; z += 6) {
      const field = Math.abs(x) > 160 && ((z > 62 && z < 118) || (z < -62 && z > -118));
      if (field) {
        for (let k = 0; k < 6; k += 2) B.top(x, z + k, Math.min(c, x + 6), Math.min(d, z + k + 2), 1, ((z + k) / 2) & 1 ? 0x93b152 : 0x9d7e52);
      } else {
        B.top(x, z, Math.min(c, x + 6), Math.min(d, z + 6), 1, ((x + z) / 6) & 1 ? G.grass : G.grassB);
      }
    }
  }
  // 道路：横向贯通、纵向城内
  for (const c of ROAD_C) {
    B.box(x0, -1, c - ROAD / 2, x1, 0, c + ROAD / 2, G.asphalt, 0b001000);
    B.box(c - ROAD / 2, -1, -CITY, c + ROAD / 2, 0, CITY, G.asphalt, 0b001000);
  }
  // 城区外缘（纵向道路尽头的收口人行道）
  for (const c of ROAD_C) for (const s of [-1, 1]) {
    const zz = s * CITY;
    B.box(c - ROAD / 2, -1, s > 0 ? zz : zz - 6, c + ROAD / 2, 1, s > 0 ? zz + 6 : zz, G.walkB);
  }
  // 街区：人行道环 + 路缘石 + 地块
  for (const bx of BLOCK_C) for (const bz of BLOCK_C) {
    const bx0 = bx - 30, bx1 = bx + 30, bz0 = bz - 30, bz1 = bz + 30;
    B.box(bx0, -1, bz0, bx1, 0.6, bz1, G.curb, 0b110011);
    // 人行道砖：2×2 交错
    for (let x = bx0; x < bx1; x += 2) for (let z = bz0; z < bz1; z += 2) {
      const inLot = x >= bx0 + WALK && x < bx1 - WALK && z >= bz0 + WALK && z < bz1 - WALK;
      if (inLot) continue;
      const edge = x === bx0 || z === bz0 || x === bx1 - 2 || z === bz1 - 2;
      B.top(x, z, x + 2, z + 2, 1, edge ? G.curb : (((x + z) / 2) & 1) ? G.walk : G.walkB);
    }
    B.box(bx0, 0.6, bz0, bx1, 1, bz1, G.curb, 0b110011);
  }
  // 地块表面：未单独指定的街区地块铺草坪/庭院
  const all = [...lots];
  for (const bx of BLOCK_C) for (const bz of BLOCK_C) {
    const r = { x0: bx - 26, z0: bz - 26, x1: bx + 26, z1: bz + 26 };
    if (!lots.some((L) => L.kind !== 'path' && L.x0 <= r.x0 && L.x1 >= r.x1 && L.z0 <= r.z0 && L.z1 >= r.z1)) all.unshift({ kind: 'yard', ...r });
  }
  for (const L of all) {
    const { x0: a, z0: b, x1: c, z1: d } = L;
    const yy = L.kind === 'yard' ? 1 : L.kind === 'path' ? 1.06 : 1.03;
    if (L.kind === 'park') {
      for (let x = a; x < c; x += 2) for (let z = b; z < d; z += 2) B.top(x, z, x + 2, z + 2, yy, (((x + z) / 2) & 1) ? G.park : G.grassB);
    } else if (L.kind === 'parking') {
      B.top(a, b, c, d, yy, 0x55585d);
      for (let z = b + 2; z < d - 2; z += 7) B.box(a + 1, yy, z, a + 9, yy + 0.06, z + 0.6, G.mark, 0b001000);
    } else if (L.kind === 'plaza') {
      for (let x = a; x < c; x += 3) for (let z = b; z < d; z += 3) B.top(x, z, Math.min(c, x + 3), Math.min(d, z + 3), yy, (((x + z) / 3) & 1) ? G.plaza : G.plazaB);
    } else if (L.kind === 'path') {
      for (let x = a; x < c; x += 2) for (let z = b; z < d; z += 2) B.top(x, z, x + 2, z + 2, yy, (((x + z) / 2) & 1) ? 0xd8c7a2 : 0xcdbb95);
    } else {
      for (let x = a; x < c; x += 4) for (let z = b; z < d; z += 4) B.top(x, z, Math.min(c, x + 4), Math.min(d, z + 4), yy, (((x + z) / 4) & 1) ? G.grass : G.grassB);
    }
  }
  // 标线
  const mk = (xa, za, xb, zb, col = G.mark) => B.box(xa, 0, za, xb, 0.08, zb, col, 0b001000);
  for (const c of ROAD_C) {
    // 横向道路中线（虚线），路口处断开
    for (let x = x0 + 2; x < x1 - 4; x += 8) {
      if (ROAD_C.some((rc) => Math.abs(x + 2 - rc) < ROAD / 2 + 4)) continue;
      mk(x, c - 0.5, x + 4, c + 0.5);
    }
    for (let z = -CITY + 2; z < CITY - 4; z += 8) {
      if (ROAD_C.some((rc) => Math.abs(z + 2 - rc) < ROAD / 2 + 4)) continue;
      mk(c - 0.5, z, c + 0.5, z + 4);
    }
    // 斑马线
    for (const rc of ROAD_C) {
      for (const s of [-1, 1]) {
        const e = rc + s * (ROAD / 2 + 2.5);
        for (let k = -ROAD / 2 + 1; k < ROAD / 2 - 1; k += 2.5) {
          mk(e - 2, c + k, e + 2, c + k + 1.4);       // 横向路上的斑马线（跨 z）
          mk(c + k, e - 2, c + k + 1.4, e + 2);       // 纵向路
        }
      }
    }
    // 停车位（纵向道路靠边）
    for (const s of [-1, 1]) for (let z = -CITY + 20; z < CITY - 20; z += 9) {
      if (ROAD_C.some((rc) => Math.abs(z - rc) < ROAD / 2 + 8)) continue;
      mk(c + s * (ROAD / 2 - 4.5), z, c + s * (ROAD / 2 - 0.5), z + 0.5);
    }
  }
  const mesh = new THREE.Mesh(B.geometry(), grainMaterial({ grain: 0.1 }));
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return mesh;
}
