// 城市布局常量（世界单位 = 体素）。
// 3×3 街区，街区 60 宽（含 4 宽人行道），道路 24 宽。
// 横向道路 z=±42 贯穿整个底座（恐龙从西侧 z=+42 进入，从东侧 z=-42 离开）；
// 纵向道路 x=±42 只在城内。
export const BLOCK = 60;
export const ROAD = 24;
export const WALK = 4;           // 人行道宽
export const BLOCK_C = [-84, 0, 84];
export const ROAD_C = [-42, 42];
export const CITY = 114;         // 城区外沿
export const PLINTH = { x0: -420, x1: 420, z0: -126, z1: 126, top: 0, depth: 16 };
export const FLOOR = 8;          // 层高
export const CURB = 1;           // 人行道 / 地块高出路面 1 体素

export function onRoad(x, z) {
  for (const c of ROAD_C) {
    if (Math.abs(z - c) < ROAD / 2) return true; // 横向道路贯通
    if (Math.abs(x - c) < ROAD / 2 && Math.abs(z) < CITY) return true;
  }
  return false;
}

// 静态地面高度（不含废墟）
export function baseHeight(x, z) {
  if (x < PLINTH.x0 || x > PLINTH.x1 || z < PLINTH.z0 || z > PLINTH.z1) return -999;
  return onRoad(x, z) ? 0 : CURB;
}

export function blockRect(ix, iz) {
  const cx = BLOCK_C[ix], cz = BLOCK_C[iz];
  return { x0: cx - BLOCK / 2, x1: cx + BLOCK / 2, z0: cz - BLOCK / 2, z1: cz + BLOCK / 2, cx, cz };
}
