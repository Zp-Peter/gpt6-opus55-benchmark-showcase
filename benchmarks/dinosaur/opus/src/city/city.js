// 城市装配：每个街区放哪些建筑、地块铺装、街道设施。
// 街区地块（人行道内侧）= 中心 ±26。rot：0 正面朝北(-z)，1 朝东(+x)，2 朝南(+z)，3 朝西(-x)。
import * as T from './buildingTypes.js';
import { placeVoxels, Destructible } from '../destruction/buildings.js';
import { BLOCK_C, ROAD_C, CITY } from './layout.js';

export const BUILDINGS = [
  // 西南街区（前排左）：踩踏目标 + 联排
  { name: 'shop', gen: () => T.cornerShop(), x0: -80, z0: 58, rot: 0, target: 'stomp' },
  { name: 'townhouseA', gen: () => T.townhouse({ w: 10, d: 16, floors: 2, brick: true, seed: 3, shutter: 0x2f5d7c }), x0: -110, z0: 58, rot: 0 },
  { name: 'townhouseB', gen: () => T.townhouse({ w: 14, d: 16, floors: 2, wall: 0xe9d7b5, seed: 4, shutter: 0x9b3b3b, roof: 0x4f5866, roof2: 0x3f4753 }), x0: -96, z0: 58, rot: 0 },
  { name: 'cottageSW', gen: () => T.cottage({ wall: 0xdfe8ef, roof: 0xb65d3e, roof2: 0x94472f, seed: 82 }), x0: -104, z0: 94, rot: 2 },
  { name: 'cottageSW2', gen: () => T.cottage({ wall: 0xf2dfb4, seed: 83, shutter: 0x3f6f5a }), x0: -80, z0: 94, rot: 2 },
  // 西街区：公寓朝南
  { name: 'aptWest', gen: () => T.apartment({ w: 22, d: 18, floors: 4, wall: 0xc9765a, base: 0x6a4a3c, awning: 0x9b3b3b, seed: 6 }), x0: -106, z0: -12, rot: 2 },
  { name: 'townhouseW1', gen: () => T.townhouse({ w: 14, d: 14, floors: 3, wall: 0xa9c3b0, seed: 7, shutter: 0x4d6a8a }), x0: -72, z0: -24, rot: 1 },
  { name: 'townhouseW2', gen: () => T.townhouse({ w: 12, d: 14, floors: 2, brick: true, wall: 0x9c5a44, seed: 8, roof: 0x4f5866, roof2: 0x3f4753 }), x0: -72, z0: -8, rot: 1 },
  // 中央街区：钟楼（地标）+ 东北角公寓（冲撞目标）
  { name: 'clockHall', gen: () => T.clockHall(), x0: -24, z0: 6, rot: 2 },
  { name: 'aptCenter', gen: () => T.apartment({ w: 20, d: 18, floors: 4, wall: 0xe0b35c, base: 0x7c4f3a, awning: 0x2f6f73, seed: 9 }), x0: 6, z0: -26, rot: 1 },
  // 南街区（前排中）：街角书店咖啡（甩尾目标）+ 公园
  { name: 'cafe', gen: () => T.cornerCafe(), x0: 4, z0: 58, rot: 0, target: 'tail' },
  // 东南街区：餐馆 + 小屋
  { name: 'diner', gen: () => T.diner(), x0: 66, z0: 60, rot: 0 },
  { name: 'cottageSE', gen: () => T.cottage({ wall: 0xf3e3e3, roof: 0x5a7d9a, roof2: 0x4a6a85, seed: 84, shutter: 0x9b3b3b }), x0: 62, z0: 92, rot: 2 },
  { name: 'cottageSE2', gen: () => T.cottage({ w: 12, wall: 0xe6efd9, seed: 85 }), x0: 82, z0: 94, rot: 2 },
  // 东街区：加油站 + 便利亭 + 仓库
  { name: 'gas', gen: () => T.gasStation(), x0: 60, z0: -4, rot: 0 },
  { name: 'kiosk', gen: () => T.kiosk(), x0: 64, z0: -22, rot: 0 },
  { name: 'warehouse', gen: () => T.warehouse({ w: 22, d: 28 }), x0: 82, z0: -22, rot: 1 },
  // 北街区：酒店 + 联排
  { name: 'hotel', gen: () => T.hotel({ floors: 7 }), x0: -24, z0: -80, rot: 2 },
  { name: 'townhouseN', gen: () => T.townhouse({ w: 14, d: 16, floors: 3, wall: 0xf0d9a8, seed: 12, shutter: 0x2f6f73 }), x0: 8, z0: -74, rot: 2 },
  // 西北街区：办公楼 + 小楼
  { name: 'officeNW', gen: () => T.officeTower({ w: 24, d: 22, floors: 9, glass: 0x3f6a7a, band: 0xe2ddd2, seed: 14 }), x0: -106, z0: -104, rot: 2 },
  { name: 'townhouseNW', gen: () => T.townhouse({ w: 14, d: 14, floors: 2, wall: 0xd8e0ea, seed: 15, shutter: 0x9b3b3b }), x0: -76, z0: -74, rot: 2 },
  // 东北街区：西南角公寓（冲撞目标，南立面朝向镜头）+ 最高的办公楼（背景）
  { name: 'aptNE', gen: () => T.apartment({ w: 22, d: 18, floors: 5, wall: 0x86b6b0, base: 0x3f5f66, trim: 0xf4ecdc, awning: 0xd8453a, rail: 0xf4ecdc, seed: 17 }), x0: 60, z0: -78, rot: 2, target: 'ram' },
  { name: 'officeNE', gen: () => T.officeTower({ w: 24, d: 24, floors: 12, glass: 0x34506e, band: 0xcfd6dc, pillar: 0x9fa9b3, seed: 16, antenna: 16 }), x0: 84, z0: -108, rot: 2 },
];

export const LOTS = [
  { kind: 'park', x0: -26, z0: 58, x1: 26, z1: 110 },
  { kind: 'path', x0: -24, z0: 84, x1: 4, z1: 88 },
  { kind: 'path', x0: -12, z0: 80, x1: -8, z1: 110 },
  { kind: 'plaza', x0: -26, z0: -26, x1: 26, z1: 26 },
  { kind: 'parking', x0: 92, z0: 58, x1: 110, z1: 90 },
  { kind: 'plaza', x0: 58, z0: -26, x1: 110, z1: 26 },
  { kind: 'plaza', x0: 58, z0: -110, x1: 82, z1: -58 },
  { kind: 'plaza', x0: -26, z0: -110, x1: 26, z1: -58 },
];

export function buildBuildings(sys) {
  let id = 1;
  for (const def of BUILDINGS) {
    const gen = def.gen();
    const vox = placeVoxels(gen, { x0: def.x0, z0: def.z0, rot: def.rot });
    sys.add(new Destructible(id++, def.name, vox, { target: def.target }));
  }
}

export function placeProps(P, sys) {
  // 与建筑（含遮阳篷、阳台等外挑）重叠的设施位置直接跳过
  const blocked = (x, z, m = 1.5) => sys.buildings.some((b) => x > b.box.min.x - m && x < b.box.max.x + m && z > b.box.min.z - m && z < b.box.max.z + m);
  // 路灯：沿人行道外缘，面向道路
  const walkIn = 27.2; // 街区中心到路灯的距离
  for (const bx of BLOCK_C) for (const bz of BLOCK_C) {
    for (const s of [-1, 1]) {
      // 朝南北道路的边
      for (const off of [-16, 12]) {
        if (!blocked(bx + off, bz + s * walkIn)) P.add('lamp', bx + off, bz + s * walkIn, s > 0 ? -Math.PI / 2 : Math.PI / 2);
        const lx = bx + s * walkIn, lz = bz + off;
        const nearRam = false;
        if (!blocked(lx, lz) && !nearRam) P.add('lamp', lx, lz, s > 0 ? 0 : Math.PI);
      }
    }
  }
  // 路口红绿灯
  for (const rx of ROAD_C) for (const rz of ROAD_C) {
    P.add('trafficLight', rx - 13.5, rz - 13.5, Math.PI / 2 * 0);
    P.add('trafficLight', rx + 13.5, rz + 13.5, Math.PI);
  }
  // 行道树（留出建筑门前）
  const treesAt = [
    // 南街区公园
    [-20, 64, 0], [-6, 64, 1], [-22, 78, 2], [-18, 100, 0], [0, 100, 1], [14, 96, 2], [20, 104, 0], [-2, 76, 1], [16, 84, 2], [-24, 92, 1],
    // 中央广场
    [-20, -20, 0], [-4, -20, 1], [-20, -6, 2], [0, 0, 0],
    // 西南后院
    [-94, 84, 1], [-60, 84, 2], [-62, 104, 0], [-110, 108, 1],
    // 东南
    [60, 84, 0], [98, 100, 1],
    // 东北广场（低矮）
    [62, -96, 2], [74, -94, 0], [60, -84, 1],
    // 北
    [18, -100, 0], [-2, -64, 1],
    // 西
    [-110, -22, 1], [-62, -18, 0],
    // 西北
    [-62, -100, 2], [-70, -106, 1],
  ];
  for (const [x, z, v] of treesAt) if (!blocked(x, z, 3)) P.add('tree', x, z, (v * 1.3) % 6.28, v);
  // 公园
  P.add('fountain', -10, 86, 0, 0, 1, { static: true });
  for (const [x, z, r] of [[-20, 86, Math.PI / 2], [0, 86, -Math.PI / 2], [-10, 96, Math.PI], [-10, 76, 0]]) P.add('bench', x, z, r);
  P.add('flowers', -16, 70, 0, 1); P.add('flowers', 2, 70, 0, 2); P.add('flowers', -4, 104, 0, 3);
  P.add('bin', -14, 80); P.add('bin', 4, 92);
  // 书店街角（甩尾会扫到）
  P.add('bench', 28.2, 82, -Math.PI / 2);
  P.add('bin', 28.2, 76); P.add('hydrant', 28, 62);
  P.add('sign', 28.3, 80, 0, 0);
  P.add('umbrellaTable', 27.5, 89, 0, 0); // 书店侧门外摆
  // 广场与街边
  for (const [x, z, r] of [[-12, -12, 0], [14, 8, Math.PI], [-16, 20, Math.PI / 2]]) P.add('bench', x, z, r);
  P.add('umbrellaTable', -8, -4, 0, 1); P.add('umbrellaTable', 6, 12, 0, 2); P.add('umbrellaTable', -2, 18, 0, 0);
  P.add('flowers', 18, 0, Math.PI / 2, 4); P.add('flowers', -22, 0, Math.PI / 2, 5);
  P.add('hedge', 70, 20, 0); P.add('hedge', 78, 20, 0); P.add('hedge', 100, 20, 0);
  P.add('bin', -83, 56.5); P.add('hydrant', -57.2, 62); P.add('bench', -57.5, 76, Math.PI / 2);
  P.add('sign', -56.5, 56.5, Math.PI, 1);
  P.add('bin', 56.5, -28); P.add('hydrant', 25.5, -20);
  P.add('flowers', -58, -10, Math.PI / 2, 6);
  for (const x of [-104, -96, -88]) P.add('flowers', x, 16, 0, x & 3);
  P.add('hedge', -104, 22, 0); P.add('hedge', -96, 22, 0); P.add('hedge', -88, 22, 0); P.add('bench', -80, 14, Math.PI / 2);
  // 停车场与路边车位上的车
  for (const [x, z, r, v] of [[101, 64, 0, 3], [101, 71, 0, 1], [101, 78, Math.PI, 5], [101, 85, 0, 0]]) P.add('car', x, z, r, v);
  P.add('car', 34.2, 70, -Math.PI / 2, 1, 0);
  P.add('car', -34.2, -70, -Math.PI / 2, 3, 0);
  P.add('car', -49.8, 20, Math.PI / 2, 5, 0);
  P.add('car', 49.8, -76, Math.PI / 2, 0, 0);
  // 城外：树丛、篱笆、广告牌
  const rows = [];
  for (let x = -400; x < -130; x += 17) rows.push([x, 16 + ((x * 7) % 9)], [x + 6, -20 - ((x * 3) % 7)], [x + 3, 94 + ((x * 5) % 7)], [x + 9, -70 - ((x * 11) % 13)], [x, 112], [x + 5, -104]);
  for (let x = 140; x < 400; x += 17) rows.push([x, 18 + ((x * 7) % 9)], [x + 6, -4 - ((x * 3) % 7)], [x + 3, 74 + ((x * 5) % 11)], [x + 9, -72 - ((x * 11) % 13)], [x, 104], [x + 5, -100 - ((x * 7) % 9)]);
  rows.forEach(([x, z], i) => P.add(i % 3 === 0 ? 'pine' : 'tree', x, z, i * 0.7, i % 3));
  for (let x = -200; x < -124; x += 6) P.add('fence', x, 57.5, 0);
  for (let x = 124; x < 220; x += 6) P.add('fence', x, -57.5, 0);
  P.add('billboard', -168, 20, 0);
  P.add('busStop', -196, 28, Math.PI, 0);
  P.add('sign', -128, 56.5, Math.PI, 2);
  P.add('sign', 128, -56.5, 0, 0);
  // 城区边缘的篱笆与花坛（前排）
  for (let x = -110; x < 110; x += 6) if (!ROAD_C.some((c) => Math.abs(x + 3 - c) < 16)) P.add('hedge', x + 3, CITY + 3, 0);
}
