const DURATION = 60;
const keys = [
  // time, x, z, heading. The entire route stays on supported ground.
  [0, -48, 0, 0],
  [5, -48, 0, 0],
  [14, -8, 0, 0],
  [16, -7, 0, 0],
  [20, -7, 0, 0],
  [24, 0.15, 0, 0],
  [25, 0.15, 0, 0],
  [26.3, 1.25, 0, 0],
  [28, 1, 0, 0],
  [33, 6, -1, -0.15],
  [34.8, 6, -1, 0.2],
  [36.6, 6, -1, -0.4],
  [38.5, 6, -1, -0.4],
  [40, 7, -0.8, 0],
  [52, 51, 0, 0],
  [60, 70, 0, 0]
];
const sat = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => {
  x = sat(x);
  return x * x * (3 - 2 * x);
};
function poseAt(t) {
  let j = 1;
  while (j < keys.length - 1 && t > keys[j][0]) j++;
  const a = keys[j - 1], b = keys[j], u = ease((t - a[0]) / (b[0] - a[0]));
  let distance = 0;
  for (let k = 1; k < j; k++) distance += Math.hypot(keys[k][1] - keys[k - 1][1], keys[k][2] - keys[k - 1][2]);
  distance += Math.hypot(b[1] - a[1], b[2] - a[2]) * u;
  return { x: a[1] + (b[1] - a[1]) * u, z: a[2] + (b[2] - a[2]) * u, yaw: a[3] + (b[3] - a[3]) * u, distance };
}
function pulse(t, a, b, c, d) {
  return ease((t - a) / (b - a)) * (1 - ease((t - c) / (d - c)));
}
function chapter(t) {
  return t < 5 ? "01 / \u5348\u540E\uFF0C\u4E00\u5207\u5982\u5E38" : t < 15 ? "02 / \u6709\u4E00\u4F4D\u4E0D\u901F\u4E4B\u5BA2" : t < 22 ? "03 / \u8857\u89D2\u7684\u7B2C\u4E00\u58F0\u5DE8\u54CD" : t < 31 ? "04 / \u7816\u5899\u6321\u4E0D\u4F4F\u5B83" : t < 40 ? "05 / \u5C0F\u5FC3\uFF0C\u5C3E\u5DF4\uFF01" : t < 52 ? "06 / \u5927\u8BBF\u5BA2\u7EE7\u7EED\u8D76\u8DEF" : "07 / \u5F53\u8857\u9053\u91CD\u65B0\u5B89\u9759";
}
export {
  DURATION,
  chapter,
  ease,
  keys,
  poseAt,
  pulse
};
