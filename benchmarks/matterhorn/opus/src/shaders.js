import { MH_RIDGES, MH_FACE_CONCAVITY, RIDGES, VALLEYS, LAKE } from './geo.js';

const f = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(+v.toFixed(4)));
const v2 = (a, b) => `vec2(${f(a)},${f(b)})`;
const v3 = (a, b, c) => `vec3(${f(a)},${f(b)},${f(c)})`;
const v4 = (a, b, c, d) => `vec4(${f(a)},${f(b)},${f(c)},${f(d)})`;

// ---------- 由地理数据生成 GLSL 常量 ----------
function geoGLSL() {
  const rad = (d) => (d * Math.PI) / 180;
  const ru = MH_RIDGES.map((r) => v2(Math.sin(rad(r.bearing)), Math.cos(rad(r.bearing))));
  const rb = MH_RIDGES.map((r) => f(rad(r.bearing)));
  const rm = MH_RIDGES.map((r) => f(r.m));
  const prof = MH_RIDGES.flatMap((r) => r.prof.map(([d, h]) => v2(d, h)));
  const segA = [], segB = [];
  for (const line of RIDGES) for (let i = 0; i < line.length - 1; i++) {
    const [a, b] = [line[i], line[i + 1]];
    segA.push(v3(a[0] * 1000, a[1] * 1000, a[2]));
    segB.push(v3(b[0] * 1000, b[1] * 1000, b[2]));
  }
  const va = [], vb = [];
  for (const v of VALLEYS) for (let i = 0; i < v.pts.length - 1; i++) {
    const [a, b] = [v.pts[i], v.pts[i + 1]];
    const n = v.pts.length;
    const wAt = (k) => v.pts[k][3] ?? v.w * (v.glacier && k === n - 1 ? 0.45 : 1);
    va.push(v4(a[0] * 1000, a[1] * 1000, a[2], wAt(i) * (v.glacier ? -1 : 1)));
    vb.push(v4(b[0] * 1000, b[1] * 1000, b[2], wAt(i + 1)));
  }
  return /* glsl */`
const vec2 MH_U[4] = vec2[4](${ru.join(',')});
const float MH_B[4] = float[4](${rb.join(',')});
const float MH_M[4] = float[4](${rm.join(',')});
const float MH_C[4] = float[4](${MH_FACE_CONCAVITY.map(f).join(',')});
const vec2 MH_P[40] = vec2[40](${prof.join(',')});
#define NRS ${segA.length}
const vec3 RS_A[NRS] = vec3[NRS](${segA.join(',')});
const vec3 RS_B[NRS] = vec3[NRS](${segB.join(',')});
#define NVS ${va.length}
const vec4 VS_A[NVS] = vec4[NVS](${va.join(',')});
const vec4 VS_B[NVS] = vec4[NVS](${vb.join(',')});
const vec2 LAKE_C = ${v2(LAKE.x * 1000, LAKE.y * 1000)};
const vec3 LAKE_P = ${v3(LAKE.h, LAKE.ax, LAKE.ay)};
const float LAKE_FLAT = ${f(LAKE.flat)};
`;
}

// ---------- 噪声 ----------
export const NOISE = /* glsl */`
#define PI 3.14159265359
uint pcg(uint v){ uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float hashi(ivec2 i){ return float(pcg(uint(i.x + 1048576) + pcg(uint(i.y + 1048576)))) * (1.0/4294967296.0); }
vec2 hashi2(ivec2 i){ uint h = pcg(uint(i.x + 1048576) + pcg(uint(i.y + 1048576))); return vec2(float(h), float(pcg(h))) * (1.0/4294967296.0); }
float hash3i(ivec3 i){ return float(pcg(uint(i.x + 1048576) + pcg(uint(i.y + 1048576) + pcg(uint(i.z + 1048576))))) * (1.0/4294967296.0); }
float hash12(vec2 p){ return hashi(ivec2(floor(p))); }

// 梯度噪声（Perlin 型）+ 解析导数：返回 (n, dn/dx, dn/dy)，n ≈ [-1,1]
// 注意：不要用值噪声——五次插值在格点处形成平台，会出现方格和轴向直线伪影
vec2 grad2(ivec2 z){ float a = hashi(z)*6.2831853; return vec2(cos(a), sin(a)); }
vec3 noised(vec2 x){
  vec2 fl = floor(x); ivec2 i = ivec2(fl); vec2 f = x - fl;
  vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0);
  vec2 du = 30.0*f*f*(f*(f-2.0)+1.0);
  vec2 ga = grad2(i), gb = grad2(i+ivec2(1,0)), gc = grad2(i+ivec2(0,1)), gd = grad2(i+ivec2(1,1));
  float va = dot(ga, f), vb = dot(gb, f - vec2(1.0, 0.0)), vc = dot(gc, f - vec2(0.0, 1.0)), vd = dot(gd, f - vec2(1.0, 1.0));
  float v = va + u.x*(vb - va) + u.y*(vc - va) + u.x*u.y*(va - vb - vc + vd);
  vec2 d = ga + u.x*(gb - ga) + u.y*(gc - ga) + u.x*u.y*(ga - gb - gc + gd) + du*(u.yx*(va - vb - vc + vd) + vec2(vb, vc) - va);
  return vec3(v, d) * 1.45;
}
float noise(vec2 x){ return noised(x).x; }
const mat2 ROT = mat2(0.8, -0.6, 0.6, 0.8);
float fbm(vec2 p, int oct){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 10; i++){ if (i >= oct) break; s += a*noise(p); p = ROT*p*2.03 + vec2(17.13, -9.71); a *= 0.5; }
  return s;
}
float ridged(vec2 p, int oct){
  float s = 0.0, a = 0.5, w = 1.0, nrm = 0.0;
  for (int i = 0; i < 10; i++){
    if (i >= oct) break;
    float n = 1.0 - abs(noise(p)); n *= n; n *= w; w = clamp(n*1.8, 0.0, 1.0);
    s += a*n; nrm += a; p = ROT*p*2.07 + vec2(-5.3, 11.7); a *= 0.5;
  }
  return s / nrm;
}
// 3D 值噪声 + 导数（iq）
vec4 noised3(vec3 x){
  vec3 fl = floor(x); ivec3 i = ivec3(fl); vec3 w = x - fl;
  vec3 u = w*w*w*(w*(w*6.0-15.0)+10.0);
  vec3 du = 30.0*w*w*(w*(w-2.0)+1.0);
  float a = hash3i(i), b = hash3i(i+ivec3(1,0,0)), c = hash3i(i+ivec3(0,1,0)), d = hash3i(i+ivec3(1,1,0));
  float e = hash3i(i+ivec3(0,0,1)), f1 = hash3i(i+ivec3(1,0,1)), g = hash3i(i+ivec3(0,1,1)), h = hash3i(i+ivec3(1,1,1));
  float k0 = a, k1 = b-a, k2 = c-a, k3 = e-a, k4 = a-b-c+d, k5 = a-c-e+g, k6 = a-b-e+f1, k7 = -a+b+c-d+e-f1-g+h;
  return vec4(-1.0 + 2.0*(k0 + k1*u.x + k2*u.y + k3*u.z + k4*u.x*u.y + k5*u.y*u.z + k6*u.z*u.x + k7*u.x*u.y*u.z),
    2.0*du*vec3(k1 + k4*u.y + k6*u.z + k7*u.y*u.z, k2 + k5*u.z + k4*u.x + k7*u.z*u.x, k3 + k6*u.x + k5*u.y + k7*u.x*u.y));
}
float smax(float a, float b, float k){ float h = max(k - abs(a-b), 0.0)/k; return max(a,b) + h*h*k*0.25; }
float smin(float a, float b, float k){ float h = max(k - abs(a-b), 0.0)/k; return min(a,b) - h*h*k*0.25; }
`;

// ---------- 分层高度图采样（所有需要地形高度的着色器共用） ----------
export const HEIGHT_SAMPLER = /* glsl */`
uniform sampler2D uH0; uniform sampler2D uH1; uniform sampler2D uH2; uniform sampler2D uH3;
uniform vec3 uL0; uniform vec3 uL1; uniform vec3 uL2; uniform vec3 uL3; // (cx, cz, half)
vec2 lvlUV(vec2 xz, vec3 L){ return (xz - L.xy) / (2.0*L.z) + 0.5; }
bool inL(vec2 xz, vec3 L, float m){ vec2 d = abs(xz - L.xy); return max(d.x, d.y) < L.z*m; }
float hAt(vec2 xz){
  if (inL(xz, uL0, 0.999)) return texture(uH0, lvlUV(xz, uL0)).r;
  if (inL(xz, uL1, 0.999)) return texture(uH1, lvlUV(xz, uL1)).r;
  if (inL(xz, uL2, 0.999)) return texture(uH2, lvlUV(xz, uL2)).r;
  return texture(uH3, clamp(lvlUV(xz, uL3), 0.0, 1.0)).r;
}
`;

export const FULLSCREEN_VS = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// ---------- 高度场生成 ----------
export const HEIGHT_FS = /* glsl */`
precision highp float;
${NOISE}
${geoGLSL()}
uniform vec3 uLvl;       // cx, cz, half
uniform float uMinCell;  // 小于该尺度的细节不生成（防混叠）
varying vec2 vUv;

float profAt(int k, float t){
  int o = k*10;
  for (int i = 1; i < 10; i++){
    vec2 a = MH_P[o+i-1], b = MH_P[o+i];
    if (t <= b.x) return mix(a.y, b.y, clamp((t - a.x)/(b.x - a.x), 0.0, 1.0));
  }
  return MH_P[o+9].y;
}

// 马特洪峰本体：四脊金字塔，壁面由相邻山脊剖面按等落差线插值
float matterhorn(vec2 p){
  // 峰顶短脊：意大利峰(西) → 瑞士峰(东)
  vec2 A = vec2(-78.0, -18.0);
  vec2 pa = p - A, ba = -A;
  float ts = clamp(dot(pa, ba)/dot(ba, ba), 0.0, 1.0);
  vec2 q = p - (A + ba*ts);
  float topAdj = mix(-2.0, 0.0, ts);
  // 顶部略向东北倾（从采尔马特看到的“歪头”）
  float r0 = length(q);
  q -= vec2(26.0, 14.0) * exp(-r0/260.0);
  float br = atan(q.x, q.y); if (br < 0.0) br += 2.0*PI;
  int k = 3;
  if (br >= MH_B[0] && br < MH_B[1]) k = 0;
  else if (br >= MH_B[1] && br < MH_B[2]) k = 1;
  else if (br >= MH_B[2] && br < MH_B[3]) k = 2;
  int k2 = (k + 1) % 4;
  vec2 a = MH_U[k] / MH_M[k], b = MH_U[k2] / MH_M[k2];
  float det = a.x*b.y - a.y*b.x;
  float al = (q.x*b.y - q.y*b.x) / det;
  float be = (a.x*q.y - a.y*q.x) / det;
  float d = max(al + be, 0.0);
  float s = clamp(be / max(al + be, 1e-3), 0.0, 1.0);
  float h = mix(profAt(k, d / MH_M[k]), profAt(k2, d / MH_M[k2]), s);
  h -= MH_C[k] * 4.0*s*(1.0 - s) * d / (1.0 + d/1100.0);
  // 壁面起伏：保留山脊，壁面中部加入大尺度鼓包与凹槽
  float fw = smoothstep(0.0, 0.25, s) * smoothstep(1.0, 0.75, s) * smoothstep(80.0, 500.0, d);
  h += fw * (95.0*fbm(q/650.0 + float(k)*3.1, 3) + 35.0*noise(q/210.0));
  h += smoothstep(0.0, 0.15, s) * smoothstep(1.0, 0.85, s) * smoothstep(500.0, 1400.0, d) * 170.0*fbm(q/1500.0 + 9.0 + float(k), 3);
  return h + topAdj;
}

float ridgeSide(float d){ return 1500.0*(1.0 - exp(-d/1500.0)) + 0.16*d; }

float ridgesField(vec2 p){
  float nv = noise(p/1300.0 + vec2(4.1, 7.3));
  float ns = 1.0 + 0.33*nv;
  float best = -1e4;
  for (int i = 0; i < NRS; i++){
    vec3 a = RS_A[i], b = RS_B[i];
    vec2 pa = p - a.xy, ba = b.xy - a.xy;
    float t = clamp(dot(pa, ba)/dot(ba, ba), 0.0, 1.0);
    float d = length(pa - ba*t);
    float crest = mix(a.z, b.z, t);
    best = max(best, crest - ridgeSide(d*ns));
  }
  return best + 60.0*noise(p/700.0);
}

float baseField(vec2 p){
  float r = ridged(p/9000.0 + vec2(3.7, 1.3), 6);
  float h = 1750.0 + 2100.0*r;
  float dm = length(p - vec2(700.0, 200.0));
  float plateau = 2580.0 + 200.0*fbm(p/1900.0, 4);
  return mix(plateau, h, smoothstep(1200.0, 4000.0, dm));
}

vec2 gFlow = vec2(1.0, 0.0);
float carveField(vec2 p, out float glac, out float gentle){
  float best = 1e5; glac = 0.0; gentle = 1e5;
  float gBest = 0.0;
  for (int i = 0; i < NVS; i++){
    vec4 a = VS_A[i], b = VS_B[i];
    vec2 pa = p - a.xy, ba = b.xy - a.xy;
    float t = clamp(dot(pa, ba)/dot(ba, ba), 0.0, 1.0);
    float d = length(pa - ba*t);
    float w = mix(abs(a.w), b.w, t);
    float fl = mix(a.z, b.z, t);
    float q = max(d - w, 0.0);
    float dw = min(d/w, 1.0);
    float h = fl + q*q/(q + 300.0)*1.5 + 30.0*dw*dw - (a.w < 0.0 ? 22.0*(1.0 - dw*dw) : 0.0);
    best = min(best, h);
    gentle = min(gentle, fl + q*q/(q + 700.0)*0.62 + 30.0*min(d/w, 1.0));
    float isG = a.w < 0.0 ? 1.0 : 0.0;
    float gi = isG * (1.0 - smoothstep(w*0.75, w*1.35, d)) * smoothstep(2080.0, 2260.0, fl);
    if (gi > gBest){ gBest = gi; gFlow = normalize(ba); }
    glac = max(glac, gi);
  }
  return best;
}

// 未加侵蚀的大尺度地形
float macro(vec2 p, out float glac){
  // 域扭曲：让谷地蜿蜒、山脊弯折，去掉折线造成的直边
  vec2 w1 = vec2(fbm(p/3200.0, 3), fbm(p/3200.0 + vec2(7.3, 1.1), 3));
  vec2 w2 = vec2(noise(p/900.0 + 3.0), noise(p/900.0 + vec2(1.7, 9.2)));
  vec2 pw = p + w1*420.0 + w2*90.0;
  float cg;
  float c = carveField(pw, glac, cg);
  float h = smin(baseField(pw), cg, 350.0);       // 谷坡：缓，切入基底山体
  h = smax(h, ridgesField(pw), 260.0);
  h = smin(h, c, 220.0);                          // 谷底：陡，切穿山脊
  // 马特洪峰在谷地切削之后叠加：冰川只包围山脚，不会啃掉金字塔
  float rp = length(p);
  vec2 pm = p + vec2(fbm(p/900.0 + 5.0, 3), fbm(p/900.0 + 8.0, 3))*(40.0*smoothstep(150.0, 900.0, rp) + 260.0*smoothstep(900.0, 2800.0, rp));
  h = smax(h, matterhorn(pm), 140.0);
  glac *= smoothstep(160.0, 20.0, h - c);
  return h;
}

// 侵蚀噪声（沿坡向的冲沟 + 分叉）
vec3 erosionCell(vec2 p, vec2 dir){
  vec2 fl = floor(p); ivec2 ip = ivec2(fl); vec2 fp = p - fl;
  vec3 va = vec3(0.0); float wt = 0.0;
  for (int i = -2; i <= 1; i++) for (int j = -2; j <= 1; j++){
    vec2 o = vec2(i, j);
    vec2 hh = hashi2(ip - ivec2(i, j)) * 0.5;
    vec2 pp = fp + o - hh;
    float d = dot(pp, pp);
    float w = exp(-d*2.0);
    wt += w;
    float mag = dot(pp, dir);
    va += vec3(cos(mag*2.0*PI), -sin(mag*2.0*PI)*dir) * w;
  }
  return va / wt;
}

void main(){
  vec2 xz = uLvl.xy + (vUv*2.0 - 1.0)*uLvl.z;
  vec2 p = vec2(xz.x, -xz.y);          // (东, 北)
  float glac, g1, g2;
  float B = macro(p, glac);
  vec2 flow = gFlow;
  float e = 6.0;
  vec2 grad = vec2(macro(p + vec2(e, 0.0), g1) - B, macro(p + vec2(0.0, e), g2) - B) / e;
  float slope = length(grad);

  // 侵蚀冲沟
  vec2 dir = vec2(grad.y, -grad.x) / max(slope, 1e-4) * min(slope, 1.15);
  vec3 er = vec3(0.0);
  float a = 0.5, fr = 1.0, cell = 640.0;
  for (int i = 0; i < 8; i++){
    if (cell < max(uMinCell, 34.0)) break;
    er += erosionCell(p/cell, dir + er.zy*vec2(1.0, -1.0)*1.1) * a * vec3(1.0, fr, fr);
    a *= 0.46; fr *= 2.0; cell *= 0.5;
  }
  float erAmp = 135.0 * smoothstep(0.06, 0.5, slope) * min(slope, 1.0) * (1.0 - 0.85*glac);
  float ex = er.x;
  float steepCap = smoothstep(2.4, 1.3, slope) * smoothstep(40.0, 450.0, length(p));   // 极陡处与峰顶附近减弱
  ex = sign(ex)*pow(abs(ex), 0.8);   // 让肋脊更尖、冲沟更深
  float H = B + ex * erAmp * steepCap;

  // 岩壁碎裂细节
  float rock = smoothstep(0.55, 1.0, slope) * (1.0 - glac) * smoothstep(30.0, 250.0, length(p));
  if (uMinCell < 60.0) H += 13.0*(ridged(p/120.0 + 3.1, uMinCell < 12.0 ? 4 : 2) - 0.45) * rock;
  if (uMinCell < 12.0) H += 3.5*fbm(p/18.0, 3) * rock;

  // 片麻岩层理：厚度不均、断续分布的水平岩阶（积雪会留在阶面上）
  if (uMinCell < 30.0){
    float T = 30.0;
    float warp = 1.6*fbm(p/520.0 + 2.0, 3) + 0.5*noise(p/90.0);
    float hs = H/T + warp;
    float fz = fract(hs);
    float stepped = floor(hs) + smoothstep(0.1, 0.9, fz*fz*(3.0 - 2.0*fz));
    float tm = smoothstep(0.0, 0.45, fbm(p/260.0 + 7.0, 3));
    H += (stepped - hs) * T * 0.22 * tm * smoothstep(0.75, 1.2, slope) * smoothstep(3000.0, 3400.0, H) * steepCap;
  }

  // 利菲尔湖台地与湖盆
  vec2 lq = p - LAKE_C;
  float ld = length(lq);
  float flatW = 1.0 - smoothstep(LAKE_FLAT*0.8, LAKE_FLAT*2.4, ld);
  float lvl = LAKE_P.x + 8.0 + 4.0*noise(p/60.0) + 3.0*noise(p/17.0);
  H = mix(H, lvl, flatW);
  float le = length(vec2(lq.x/LAKE_P.y, lq.y/LAKE_P.z));
  float bowl = LAKE_P.x - 7.0 + 17.0*le*le + 2.0*noise(p/25.0);
  H = smin(H, bowl, 5.0);

  gl_FragColor = vec4(H, glac, slope, atan(flow.y, flow.x));
}
`;

// ---------- 下采样（CPU 读回用） ----------
export const COPY_FS = /* glsl */`
uniform sampler2D uSrc; varying vec2 vUv;
void main(){ gl_FragColor = texture(uSrc, vUv); }
`;

// ---------- 天空 LUT（Nishita 单次散射） ----------
export const ATMOS = /* glsl */`
const float RE = 6371e3, RA = 6471e3;
const vec3 K_RLH = vec3(5.5e-6, 13.0e-6, 22.4e-6);
vec2 rsi(vec3 r0, vec3 rd, float sr){
  float a = dot(rd, rd), b = 2.0*dot(rd, r0), c = dot(r0, r0) - sr*sr;
  float d = b*b - 4.0*a*c;
  if (d < 0.0) return vec2(1e5, -1e5);
  return vec2((-b - sqrt(d))/(2.0*a), (-b + sqrt(d))/(2.0*a));
}
vec3 atmosphere(vec3 r, vec3 r0, vec3 pSun, float iSun, float kMie){
  const int IS = 20; const int JS = 6;
  float shR = 8e3, shM = 1.2e3, g = 0.76;
  vec2 p = rsi(r0, r, RA);
  if (p.x > p.y) return vec3(0.0);
  vec2 pg = rsi(r0, r, RE);
  if (pg.x > 0.0) p.y = min(p.y, pg.x);
  p.x = max(p.x, 0.0);
  float iStep = (p.y - p.x) / float(IS);
  float iT = p.x;
  vec3 tR = vec3(0.0), tM = vec3(0.0);
  float odR = 0.0, odM = 0.0;
  float mu = dot(r, pSun), mumu = mu*mu, gg = g*g;
  float pR = 3.0/(16.0*PI)*(1.0 + mumu);
  float pM = 3.0/(8.0*PI)*((1.0 - gg)*(mumu + 1.0))/(pow(1.0 + gg - 2.0*mu*g, 1.5)*(2.0 + gg));
  for (int i = 0; i < IS; i++){
    vec3 ip = r0 + r*(iT + iStep*0.5);
    float ih = length(ip) - RE;
    float sR = exp(-ih/shR)*iStep, sM = exp(-ih/shM)*iStep;
    odR += sR; odM += sM;
    vec2 sg = rsi(ip, pSun, RE);
    if (sg.x < 0.0 || sg.x > sg.y){
      float jStep = rsi(ip, pSun, RA).y / float(JS);
      float jT = 0.0, jR = 0.0, jM = 0.0;
      for (int j = 0; j < JS; j++){
        vec3 jp = ip + pSun*(jT + jStep*0.5);
        float jh = length(jp) - RE;
        jR += exp(-jh/shR)*jStep; jM += exp(-jh/shM)*jStep;
        jT += jStep;
      }
      vec3 att = exp(-(kMie*1.1*(odM + jM) + K_RLH*(odR + jR)));
      tR += sR*att; tM += sM*att;
    }
    iT += iStep;
  }
  return iSun*(pR*K_RLH*tR + pM*kMie*tM);
}
`;

export const SKYLUT_FS = /* glsl */`
precision highp float;
#define PI 3.14159265359
${ATMOS}
uniform vec3 uSunDir; uniform float uMie; uniform float uObsH;
varying vec2 vUv;
void main(){
  float az = (vUv.x - 0.5)*2.0*PI;
  float el = vUv.y*vUv.y*PI*0.5;
  vec3 d = vec3(cos(el)*cos(az), sin(el), cos(el)*sin(az));
  vec3 c = atmosphere(d, vec3(0.0, RE + uObsH, 0.0), uSunDir, 22.0, uMie);
  gl_FragColor = vec4(c, 1.0);
}
`;

export const SKY_COMMON = /* glsl */`
uniform sampler2D uSky; uniform vec3 uSunDir; uniform vec3 uSunE; uniform float uHaze; uniform float uTime;
vec3 skyLUT(vec3 d){
  float az = atan(d.z, d.x);
  float el = asin(clamp(d.y, 0.0, 1.0));
  return texture(uSky, vec2(az/(2.0*PI) + 0.5, sqrt(el/(PI*0.5)))).rgb;
}
float expInt(float h0, float h1, float H){
  float a = exp(-h0/H), b = exp(-h1/H), dh = h1 - h0;
  return abs(dh) < 1.0 ? a : H*(a - b)/dh;
}
// 空气透视：返回 (透过率 T，内散射颜色)
vec3 aerial(vec3 col, vec3 wp, float fade){
  vec3 dv = wp - cameraPosition; float D = length(dv); vec3 dir = dv / max(D, 1e-3);
  float odR = D*expInt(cameraPosition.y, wp.y, 8000.0);
  float odM = D*expInt(cameraPosition.y, wp.y, 1200.0);
  vec3 T = exp(-(vec3(5.8e-6, 13.5e-6, 33.1e-6)*odR*1.05 + vec3(2.1e-5)*1.1*odM*uHaze));
  vec3 fog = skyLUT(normalize(vec3(dir.x, max(dir.y, 0.0) + 0.015, dir.z)));
  T *= fade;
  return col*T + fog*(1.0 - T);
}
`;

// ---------- 地形材质 ----------
export const TERRAIN_VS = /* glsl */`
precision highp float;
uniform sampler2D uHOwn; uniform sampler2D uHParent;
uniform vec3 uLvl; uniform vec3 uLParent; uniform float uMesh;
varying vec3 vW;
void main(){
  vec2 xz = uLvl.xy + (position.xy*2.0 - 1.0)*uLvl.z;
  float h = texture(uHOwn, position.xy).r;
  // 边缘过渡带：高度渐变到父层，保证与外层网格无缝
  if (uLParent.z > 0.0){
    vec2 gu = min(position.xy, 1.0 - position.xy) * uMesh;
    float ef = 1.0 - smoothstep(0.0, 12.0, min(gu.x, gu.y));
    if (ef > 0.0) h = mix(h, texture(uHParent, (xz - uLParent.xy)/(2.0*uLParent.z) + 0.5).r, ef);
  }
  h -= position.z*max(40.0, uLvl.z*0.006);
  vW = vec3(xz.x, h, xz.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
}
`;

export const TERRAIN_FS = /* glsl */`
precision highp float;
${NOISE}
${SKY_COMMON}
uniform sampler2D uHOwn; uniform sampler2D uAO; uniform sampler2D uSh; uniform sampler2D uDeriv; uniform sampler2D uDeriv2;
uniform vec3 uLvl; uniform float uRes; uniform float uDetail;
uniform vec3 uInnerA; uniform vec3 uInnerB;
uniform float uSnow; uniform float uFar; uniform float uDebug;
varying vec3 vW;

bool insideSq(vec2 xz, vec3 s){ if (s.z <= 0.0) return false; vec2 d = abs(xz - s.xy); return max(d.x, d.y) < s.z; }

void main(){
  if (insideSq(vW.xz, uInnerA) || insideSq(vW.xz, uInnerB)) discard;
  vec2 uv = (vW.xz - uLvl.xy)/(2.0*uLvl.z) + 0.5;
  float cell = 2.0*uLvl.z/uRes;
  float e = 1.0/uRes;
  vec4 hs = texture(uHOwn, uv);
  float glac = hs.g;
  float hl = texture(uHOwn, uv - vec2(e, 0.0)).r, hr = texture(uHOwn, uv + vec2(e, 0.0)).r;
  float hd = texture(uHOwn, uv - vec2(0.0, e)).r, hu = texture(uHOwn, uv + vec2(0.0, e)).r;
  vec3 N = normalize(vec3(hl - hr, 2.0*cell, hd - hu));
  // 固定世界尺度的法线与曲率（加载时预计算），保证各 LOD 层做出一致的积雪/岩石判断
  vec4 dv = texture(uDeriv, uv);
  vec3 Nm = vec3(dv.x, sqrt(max(1.0 - dv.x*dv.x - dv.y*dv.y, 0.0)), dv.y);
  vec3 Nc = vec3(dv.z, sqrt(max(1.0 - dv.z*dv.z - dv.w*dv.w, 0.0)), dv.w);
  float concave = texture(uDeriv2, uv).r;
  vec3 Vv = cameraPosition - vW; float dist = length(Vv); vec3 V = Vv/dist;
  float alt = vW.y;

  // 程序化岩石微细节（法线扰动）
  float df = uDetail * clamp(1.0 - dist/3000.0, 0.0, 1.0);
  vec3 Nd = N;
  float nFine = 0.0;
  if (df > 0.0){
    vec4 n1 = noised3(vW*(1.0/26.0));
    vec4 n2 = noised3(vW*(1.0/8.0) + 13.1);
    vec3 g = n1.yzw*0.55 + n2.yzw*0.45;
    if (dist < 700.0){ vec4 n3 = noised3(vW*(1.0/2.2) + 7.7); g += n3.yzw*0.4*(1.0 - dist/700.0); nFine = n3.x; }
    nFine += n2.x*0.6;
    if (dist < 90.0){ vec4 n4 = noised3(vW*2.2 + 1.3); vec4 n5 = noised3(vW*6.0 - 4.1); g += (n4.yzw*0.25 + n5.yzw*0.12)*(1.0 - dist/90.0); nFine += 0.3*n4.x; }
    Nd = normalize(N - df*0.5*(g - N*dot(g, N)));
  }

  // ---------- 反照率（按海拔/掩码分支，只在需要的地方计算噪声） ----------
  vec2 p = vW.xz;
  float nA = dist < 20000.0 ? fbm(p/70.0, 2)*smoothstep(20000.0, 9000.0, dist) : 0.0;
  float nB = fbm(p/420.0 + 3.3, 2);
  float steepR = smoothstep(0.75, 0.45, Nc.y);
  float band = noise(vec2(alt/9.0 + 2.2*noise(p/380.0), 0.37)) * steepR;
  vec3 rock = mix(vec3(0.19, 0.18, 0.165), vec3(0.30, 0.265, 0.225), 0.5 + 0.5*band + 0.25*nB);
  rock = mix(rock, vec3(0.16, 0.155, 0.155), smoothstep(0.05, 0.5, nA)*0.55);
  rock *= mix(vec3(0.93, 1.0, 0.99), vec3(1.07, 0.97, 0.86), smoothstep(3200.0, 3900.0, alt + 150.0*nB)); // 上部偏褐的片麻岩
  // 陡壁上改用 3D 噪声，避免俯视投影在竖直面上拉成“帘子”
  float nR = dist > 6000.0 ? 0.0 : steepR > 0.3 ? mix(noise(p/8.0), noised3(vW/8.0).x, steepR) : noise(p/8.0);
  rock *= 0.9 + 0.2*nR;
  vec3 scree = vec3(0.30, 0.285, 0.27) * (0.82 + 0.3*nR);
  float screeM = smoothstep(0.62, 0.8, Nc.y) * smoothstep(1800.0, 2300.0, alt) * (0.5 + 0.5*smoothstep(-0.3, 0.3, nA));
  float near = dist < 600.0 ? 1.0 - dist/600.0 : 0.0;
  float m1 = 0.0, m2 = 0.0;
  if (near > 0.0){ m1 = noised3(vW/1.7 + 11.0).x; m2 = noised3(vW/0.6 - 3.0).x; rock *= 1.0 + near*(0.25*m1 + 0.15*m2); }
  vec3 alb = mix(rock, scree, screeM*0.75);

  if (alt < 3000.0){
    float veg = smoothstep(2950.0, 2500.0, alt + 220.0*nA) * smoothstep(0.62, 0.8, mix(Nm.y, Nc.y, 0.5));
    if (veg > 0.0){
      // 高山草甸：草色斑块 + 枯黄草 + 裸石 + 碎石
      vec3 grass = mix(vec3(0.11, 0.13, 0.055), vec3(0.24, 0.21, 0.12), 0.5 + 0.5*noise(p/55.0)*smoothstep(30000.0, 8000.0, dist) + 0.3*nB);
      float gm = dist < 14000.0 ? fbm(p/38.0 + 4.0, 2)*smoothstep(14000.0, 6000.0, dist) : 0.0;
      grass = mix(grass, vec3(0.20, 0.17, 0.10), smoothstep(-0.2, 0.4, gm)*0.55);
      if (dist < 4000.0){
        float boulders = smoothstep(0.42, 0.62, noise(p/14.0 + 2.0) + 0.35*noise(p/4.5));
        grass = mix(grass, vec3(0.31, 0.30, 0.28)*(0.85 + 0.3*nR), boulders*smoothstep(4000.0, 800.0, dist)*0.8);
      }
      grass = mix(grass, scree, smoothstep(0.1, 0.5, noise(p/160.0 - 2.0)*0.6)*0.5);
      grass *= 1.0 + near*(0.25*m2 + 0.15*m1);
      if (dist < 90.0){
        float k = 1.0 - dist/90.0;
        float blade = noised3(vW*4.0).x, stone = smoothstep(0.35, 0.55, noised3(vW*0.9 + 7.0).x);
        grass *= 1.0 + k*0.35*blade;
        grass = mix(grass, vec3(0.33, 0.32, 0.30)*(0.8 + 0.3*blade), stone*k*0.8);
      }
      alb = mix(alb, grass, veg);
      if (alt < 2250.0){
        float forest = smoothstep(2230.0, 2030.0, alt + 120.0*nA) * smoothstep(0.62, 0.78, Nm.y) * smoothstep(-0.15, 0.25, fbm(p/140.0, 3));
        alb = mix(alb, vec3(0.045, 0.07, 0.04) * (0.9 + (dist < 2500.0 ? 0.3*noise(p/6.0) : 0.0)), forest);
      }
    }
  }

  // 冰川：粒雪线以上为雪，以下为冰；冰舌末端覆盖碎石
  float firn = smoothstep(2900.0, 3150.0, alt + 120.0*nB);
  float glacM = smoothstep(0.25, 0.7, glac) * smoothstep(0.86, 0.95, Nc.y);
  if (glacM > 0.0 && firn < 1.0){
    vec3 ice = mix(vec3(0.36, 0.42, 0.46), vec3(0.52, 0.57, 0.60), 0.5 + 0.5*noise(p/30.0));
    // 顺冰流方向的中碛条带（世界坐标 Z 向南，流向角在 (东,北) 坐标下）
    vec2 fdir = vec2(cos(hs.a), -sin(hs.a));
    float cf = dot(p, vec2(-fdir.y, fdir.x)), af = dot(p, fdir);
    float mor = smoothstep(0.55, 0.8, abs(noise(vec2(cf/70.0, af/900.0) + 3.0)) + 0.25*noise(vec2(cf/18.0, af/200.0)));
    ice = mix(ice, vec3(0.20, 0.19, 0.18), mor*0.9);
    // 横向裂隙：垂直于流向，冰面坡度越大越密
    float crevM = smoothstep(0.985, 0.95, Nc.y) * smoothstep(0.2, 0.5, noise(p/260.0 + 5.0));
    float crev = smoothstep(0.8, 0.97, abs(sin(af/11.0 + 2.5*noise(vec2(cf/120.0, af/60.0)))));
    ice = mix(ice, vec3(0.06, 0.1, 0.14), crev*crevM*0.8*smoothstep(9000.0, 3000.0, dist));
    ice = mix(ice, vec3(0.30, 0.28, 0.26), smoothstep(0.35, 0.6, noise(p/90.0 + 9.0))*0.6);
    float debris = smoothstep(2650.0, 2350.0, alt + 80.0*nA);
    ice = mix(ice, vec3(0.27, 0.255, 0.24)*(0.85 + 0.3*nR), debris*0.85);
    alb = mix(alb, ice, glacM*(1.0 - firn));
  }

  // 积雪：海拔 × 坡度 × 朝向（北坡更多）× 噪声
  float snowLine = mix(3650.0, 2350.0, uSnow);
  float snow = 0.0;
  if (alt > snowLine - 700.0){
    float hiF = smoothstep(snowLine - 350.0, snowLine + 250.0, alt + 220.0*nB);
    float northF = max(0.0, -Nc.z)*0.10 - max(0.0, Nc.z)*0.05;
    float slopeMix = mix(Nc.y, Nm.y, 0.65) + (0.03 + 0.06*near)*nFine + 0.05*nA + northF + 0.04*m1*near;
    float flatF = smoothstep(0.68 - 0.16*uSnow, 0.84 - 0.12*uSnow, slopeMix);
    // 陡壁上：雪积在冲沟（凹处）与小台阶
    float couloir = smoothstep(0.05, 0.45, concave + 0.15*nFine) * smoothstep(0.2, 0.5, Nm.y + 0.25*uSnow) * (0.45 + 0.55*uSnow);
    snow = clamp(hiF*max(flatF, couloir), 0.0, 1.0);
  }
  snow = max(snow, glacM*firn);
  snow = max(snow, smoothstep(3200.0, 3500.0, alt)*smoothstep(0.88, 0.95, Nc.y)); // 高海拔缓坡：粒雪盆
  vec3 snowC = vec3(0.90, 0.93, 0.97);
  alb = mix(alb, snowC, snow);
  vec3 Ns = normalize(mix(Nd, N, snow*0.6));

  // ---------- 光照 ----------
  float ao = texture(uAO, uv).r;
  float sh = texture(uSh, uv).r;
  vec3 L = uSunDir;
  float ndl = max(dot(Ns, L), 0.0) * smoothstep(-0.08, 0.06, dot(N, L));
  vec3 skyUp = skyLUT(vec3(0.0, 1.0, 0.0));
  vec3 skyHz = skyLUT(normalize(vec3(Ns.x, 0.05, Ns.z) + 1e-4));
  vec3 Esky = PI * mix(skyHz, skyUp, 0.5 + 0.5*Ns.y) * (0.55 + 0.45*Ns.y);
  vec3 Ebounce = (0.5 - 0.5*Ns.y) * 0.5 * (uSunE*max(L.y, 0.0)*0.6 + PI*skyUp);
  vec3 col = alb/PI * (uSunE*ndl*sh + (Esky + Ebounce)*ao);
  // 雪面：轻微前向高光
  vec3 Hh = normalize(L + V);
  col += snow * uSunE * sh * pow(max(dot(Ns, Hh), 0.0), 40.0) * 0.035 * ndl;

  if (uDebug > 0.5){
    vec3 dc = uDebug < 1.5 ? alb : uDebug < 2.5 ? vec3(ao) : uDebug < 3.5 ? vec3(sh) : uDebug < 4.5 ? N*0.5 + 0.5 : uDebug < 5.5 ? vec3(glac, snow, 0.0) : uDebug < 6.5 ? vec3(0.5 + 0.5*noise(p/30.0)) : vec3(fract(hs.r/10.0), glacM, firn);
    gl_FragColor = vec4(dc, 1.0);
    return;
  }
  float fade = uFar > 0.5 ? 1.0 - smoothstep(42000.0, 58000.0, dist) : 1.0;
  col = aerial(col, vW, fade);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// ---------- 预计算：固定世界尺度的法线与曲率 ----------
export const DERIV_FS = /* glsl */`
precision highp float;
uniform sampler2D uHOwn; uniform vec3 uLvl; uniform float uRes;
varying vec2 vUv;
void main(){
  vec2 uv = vUv;
  float cell = 2.0*uLvl.z/uRes;
  float h0 = texture(uHOwn, uv).r;
  vec2 o12 = vec2(max(12.0, cell)/(2.0*uLvl.z), 0.0), o36 = vec2(36.0/(2.0*uLvl.z), 0.0);
  float m12l = texture(uHOwn, uv - o12.xy).r, m12r = texture(uHOwn, uv + o12.xy).r, m12d = texture(uHOwn, uv - o12.yx).r, m12u = texture(uHOwn, uv + o12.yx).r;
  float m36l = texture(uHOwn, uv - o36.xy).r, m36r = texture(uHOwn, uv + o36.xy).r, m36d = texture(uHOwn, uv - o36.yx).r, m36u = texture(uHOwn, uv + o36.yx).r;
  float s12 = o12.x*2.0*uLvl.z, s36 = 36.0;
  vec3 Nm = normalize(vec3(m12l - m12r, 2.0*s12, m12d - m12u));
  vec3 Nc = normalize(vec3(m36l - m36r, 2.0*s36, m36d - m36u));
  float lapA = (m12l + m12r + m12d + m12u - 4.0*h0) / (s12*s12);
  float lapB = (m36l + m36r + m36d + m36u - 4.0*h0) / (s36*s36);
  float concave = clamp(lapA*s12*0.9 + lapB*s36*1.2, -1.0, 1.0);
  gl_FragColor = vec4(Nm.x, Nm.z, Nc.x, Nc.z);
}
`;
export const DERIV2_FS = /* glsl */`
precision highp float;
uniform sampler2D uHOwn; uniform vec3 uLvl; uniform float uRes;
varying vec2 vUv;
void main(){
  vec2 uv = vUv;
  float cell = 2.0*uLvl.z/uRes;
  float h0 = texture(uHOwn, uv).r;
  vec2 o12 = vec2(max(12.0, cell)/(2.0*uLvl.z), 0.0), o36 = vec2(36.0/(2.0*uLvl.z), 0.0);
  float s12 = o12.x*2.0*uLvl.z, s36 = 36.0;
  float lapA = (texture(uHOwn, uv - o12.xy).r + texture(uHOwn, uv + o12.xy).r + texture(uHOwn, uv - o12.yx).r + texture(uHOwn, uv + o12.yx).r - 4.0*h0) / (s12*s12);
  float lapB = (texture(uHOwn, uv - o36.xy).r + texture(uHOwn, uv + o36.xy).r + texture(uHOwn, uv - o36.yx).r + texture(uHOwn, uv + o36.yx).r - 4.0*h0) / (s36*s36);
  gl_FragColor = vec4(clamp(lapA*s12*0.9 + lapB*s36*1.2, -1.0, 1.0), 0.0, 0.0, 1.0);
}
`;

// ---------- 阴影（高度场光线步进，软阴影） ----------
export const SHADOW_FS = /* glsl */`
precision highp float;
${HEIGHT_SAMPLER}
uniform vec3 uLvl; uniform float uRes; uniform vec3 uSunDir;
varying vec2 vUv;
void main(){
  vec2 xz = uLvl.xy + (vUv*2.0 - 1.0)*uLvl.z;
  float cell = 2.0*uLvl.z/uRes;
  vec3 L = uSunDir;
  float h0 = hAt(xz);
  // 地球曲率：地平线下沉角
  float dip = sqrt(2.0*max(h0, 0.0)/6371000.0);
  if (L.y < -dip - 0.004){ gl_FragColor = vec4(0.0); return; }
  vec3 p0 = vec3(xz.x, h0 + 0.8*cell + 1.5, xz.y);
  float minA = 1.0;
  float t = cell*1.2;
  for (int i = 0; i < 128; i++){
    vec3 q = p0 + L*t;
    float th = hAt(q.xz) - t*t/(2.0*6371000.0);
    minA = min(minA, (q.y - th)/t);
    if (minA < -0.02) break;
    if (q.y > 4800.0 && L.y > 0.0) break;
    t += max(cell*0.7, t*0.045);
    if (t > 90000.0) break;
  }
  float s = smoothstep(-0.0065, 0.0085, minA);
  gl_FragColor = vec4(s, 0.0, 0.0, 1.0);
}
`;

// ---------- 环境光遮蔽（地平线法） ----------
export const AO_FS = /* glsl */`
precision highp float;
${HEIGHT_SAMPLER}
uniform vec3 uLvl; uniform float uRes; uniform float uRange;
varying vec2 vUv;
float h12(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)))*43758.5453); }
void main(){
  vec2 xz = uLvl.xy + (vUv*2.0 - 1.0)*uLvl.z;
  float cell = 2.0*uLvl.z/uRes;
  float h0 = hAt(xz) + 0.5;
  float vis = 0.0;
  float jit = h12(vUv*913.0);
  for (int d = 0; d < 12; d++){
    float a = (float(d) + jit)*(2.0*3.14159265/12.0);
    vec2 dir = vec2(cos(a), sin(a));
    float mt = 0.0;
    float t = cell*1.1;
    for (int i = 0; i < 16; i++){
      mt = max(mt, (hAt(xz + dir*t) - h0)/t);
      t *= 1.5;
      if (t > uRange) break;
    }
    vis += 1.0 - mt/sqrt(1.0 + mt*mt);
  }
  vis /= 12.0;
  gl_FragColor = vec4(pow(vis, 1.3), 0.0, 0.0, 1.0);
}
`;

// ---------- 天空 ----------
export const SKY_VS = /* glsl */`
varying vec3 vW;
void main(){ vec4 w = modelMatrix*vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; gl_Position.z = gl_Position.w*0.99999; }
`;
export const SKY_FS = /* glsl */`
precision highp float;
${NOISE}
${SKY_COMMON}
uniform float uCirrus;
varying vec3 vW;
void main(){
  vec3 d = normalize(vW - cameraPosition);
  vec3 dd = vec3(d.x, max(d.y, 0.0), d.z);
  vec3 col = skyLUT(normalize(dd + vec3(0.0, 1e-4, 0.0)));
  // 卷云：9 km 高的薄层
  if (d.y > 0.01 && uCirrus > 0.0){
    float t = (9500.0 - cameraPosition.y)/d.y;
    vec2 cp = (cameraPosition.xz + d.xz*t)/1.0 + vec2(uTime*6.0, uTime*1.5);
    vec2 q = cp*vec2(1.0/5200.0, 1.0/1900.0);
    q = ROT*q;
    float c = fbm(q + 0.6*vec2(fbm(q*1.7, 4), fbm(q*1.7 + 5.2, 4)), 6);
    c = smoothstep(0.02, 0.45, c) * smoothstep(0.01, 0.12, d.y) * uCirrus;
    float mu = dot(d, uSunDir);
    vec3 cl = uSunE*(0.035 + 0.25*pow(max(mu, 0.0), 12.0)) + skyLUT(vec3(0.0, 1.0, 0.0))*1.3;
    col = mix(col, cl, c*0.55);
  }
  // 太阳盘
  float mu = dot(d, uSunDir);
  col += uSunE * 60.0 * smoothstep(0.999985, 0.999993, mu);
  if (d.y < 0.0) col *= mix(1.0, 0.6, smoothstep(0.0, -0.2, d.y));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// ---------- 体积云（旗云 + 积云） ----------
export const CLOUD_VS = /* glsl */`
varying vec3 vW;
void main(){ vec4 w = modelMatrix*vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }
`;
export const CLOUD_FS = /* glsl */`
precision highp float;
precision highp sampler3D;
${NOISE}
${SKY_COMMON}
${HEIGHT_SAMPLER}
uniform sampler3D uNoise;
uniform vec3 uBMin; uniform vec3 uBMax;
uniform float uKind;     // 0 旗云  1 积云
uniform float uCover;
uniform vec3 uWind;      // 水平风向（单位向量）
uniform vec3 uSeed;
varying vec3 vW;

vec2 boxHit(vec3 ro, vec3 rd){
  vec3 inv = 1.0/rd;
  vec3 t0 = (uBMin - ro)*inv, t1 = (uBMax - ro)*inv;
  vec3 a = min(t0, t1), b = max(t0, t1);
  return vec2(max(max(a.x, a.y), a.z), min(min(b.x, b.y), b.z));
}
float shapeF(vec3 p){
  if (uKind < 0.5){
    // 旗云：附着在峰顶背风面，顺风拉长变宽
    vec2 rel = p.xz - vec2(0.0, 0.0);
    float s = dot(rel, uWind.xz);
    float c = dot(rel, vec2(-uWind.z, uWind.x));
    float fs = clamp(s/2100.0, 0.0, 1.0);
    float width = 150.0 + 560.0*sqrt(fs);
    float top = 4460.0 - 40.0*fs;
    float bot = 4120.0 - 420.0*fs;
    float r = abs(c)/width;
    float vy = (p.y - bot)/(top - bot);
    float sh = (1.0 - r*r) * smoothstep(0.0, 0.35, vy) * (1.0 - smoothstep(0.6, 1.0, vy));
    sh *= smoothstep(-120.0, 60.0, s) * (1.0 - smoothstep(0.4, 1.0, fs)) * (1.15 - 0.5*fs);
    return clamp(sh, 0.0, 1.0);
  } else {
    vec3 cen = (uBMin + uBMax)*0.5, hs = (uBMax - uBMin)*0.5;
    vec3 q = (p - cen)/hs;
    // 积云：平底、上部隆起的花椰菜形
    float r = length(q.xz);
    float top = 0.95 - 0.9*r*r;
    float sh = smoothstep(-0.92, -0.7, q.y) * smoothstep(top + 0.05, top - 0.35, q.y) * smoothstep(1.0, 0.6, r);
    return clamp(sh, 0.0, 1.0);
  }
}
float dens(vec3 p){
  float sh = shapeF(p);
  if (sh <= 0.0) return 0.0;
  vec3 w = uWind*uTime*9.0;
  vec3 pn = p - w;
  if (uKind < 0.5){
    // 旗云：沿风向拉伸噪声 → 顺风的丝缕
    vec2 rel = p.xz;
    float s = dot(rel, uWind.xz), c = dot(rel, vec2(-uWind.z, uWind.x));
    pn = vec3(s*0.33 - uTime*14.0, p.y, c);
  }
  float n = texture(uNoise, pn/(uKind < 0.5 ? 1100.0 : 2600.0) + uSeed).r;
  float d;
  if (uKind < 0.5){
    d = clamp(sh*(0.7 + 1.1*uCover) - (1.0 - n)*0.95, 0.0, 1.0);
  } else {
    float cov = sh*(0.15 + 0.8*uCover);
    d = clamp((n - (1.0 - cov))/max(cov, 0.05), 0.0, 1.0);
  }
  if (d <= 0.0) return 0.0;
  float dn = texture(uNoise, (uKind < 0.5 ? pn : p - w*1.6)/(uKind < 0.5 ? 260.0 : 650.0) + uSeed*3.1).r;
  d = clamp(d - (1.0 - dn)*0.45*(1.0 - d), 0.0, 1.0);
  return d;
}
float hgp(float mu, float g){ float gg = g*g; return (1.0 - gg)/(4.0*PI*pow(1.0 + gg - 2.0*g*mu, 1.5)); }
void main(){
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vW - ro);
  vec2 th = boxHit(ro, rd);
  float t0 = max(th.x, 0.0), t1 = th.y;
  if (t1 <= t0) discard;
  const int STEPS = 56;
  float dt = (t1 - t0)/float(STEPS);
  float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)))*43758.5453);
  float t = t0 + dt*jit;
  float T = 1.0; vec3 acc = vec3(0.0); float dsum = 0.0, wsum = 0.0;
  float mu = dot(rd, uSunDir);
  float ph = mix(hgp(mu, 0.75), hgp(mu, -0.25), 0.3);
  vec3 amb = skyLUT(vec3(0.0, 1.0, 0.0))*PI*0.9;
  const float SIG = 0.010;
  for (int i = 0; i < STEPS; i++){
    vec3 p = ro + rd*t;
    if (p.y < hAt(p.xz)) break;
    float d = dens(p);
    if (d > 0.003){
      float od = 0.0; float ls = 55.0;
      for (int j = 0; j < 5; j++){ od += dens(p + uSunDir*ls*(float(j) + 0.5))*ls; ls *= 1.35; }
      float Tl = exp(-od*SIG) + 0.25*exp(-od*SIG*0.25);
      float powder = 1.0 - exp(-d*SIG*2.0*120.0);
      vec3 S = uSunE*Tl*ph*mix(0.6, 1.0, powder)*1.4 + amb*(0.35 + 0.35*shapeF(p));
      float dT = exp(-d*SIG*dt);
      acc += T*S*(1.0 - dT);
      dsum += t*T*(1.0 - dT); wsum += T*(1.0 - dT);
      T *= dT;
      if (T < 0.02) break;
    }
    t += dt;
  }
  float alpha = 1.0 - T;
  if (alpha < 0.002) discard;
  vec3 wp = ro + rd*(dsum/max(wsum, 1e-4));
  vec3 c = aerial(acc/alpha, wp, 1.0);
  gl_FragColor = vec4(c*alpha, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// ---------- 远处湖面（无反射渲染，只取天空色） ----------
export const LAKE_FAR_FS = /* glsl */`
precision highp float;
${NOISE}
${SKY_COMMON}
varying vec3 vW;
void main(){
  vec3 V = normalize(cameraPosition - vW);
  float F = 0.02 + 0.98*pow(1.0 - clamp(V.y, 0.0, 1.0), 5.0);
  vec3 R = reflect(-V, vec3(0.0, 1.0, 0.0));
  vec3 col = mix(vec3(0.012, 0.03, 0.035)*PI*skyLUT(vec3(0.0, 1.0, 0.0)), skyLUT(R), clamp(F + 0.3, 0.0, 1.0));
  col = aerial(col, vW, 1.0);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// ---------- 湖面（Reflector 自定义着色器） ----------
export const LAKE_SHADER = {
  name: 'LakeShader',
  uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null } },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vUvR; varying vec3 vW;
    void main(){ vUvR = textureMatrix*vec4(position, 1.0); vec4 w = modelMatrix*vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }
  `,
  fragmentShader: /* glsl */`
    precision highp float;
    ${NOISE}
    ${SKY_COMMON}
    uniform vec3 color; uniform sampler2D tDiffuse;
    varying vec4 vUvR; varying vec3 vW;
    void main(){
      vec2 q = vW.xz;
      vec3 n1 = noised(q*0.35 + vec2(uTime*0.25, uTime*0.1));
      vec3 n2 = noised(q*1.3 - vec2(uTime*0.4, -uTime*0.3));
      vec2 rip = (n1.yz*0.6 + n2.yz*0.25)*0.0022;
      vec4 uv = vUvR; uv.xy += rip*uv.w;
      vec3 refl = texture2DProj(tDiffuse, uv).rgb;
      vec3 V = normalize(cameraPosition - vW);
      float F = 0.02 + 0.98*pow(1.0 - clamp(V.y, 0.0, 1.0), 5.0);
      vec3 water = vec3(0.012, 0.03, 0.035)*PI*skyLUT(vec3(0.0, 1.0, 0.0));
      vec3 col = mix(water, refl, clamp(F + 0.25, 0.0, 0.97));
      col = aerial(col, vW, 1.0);
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
};
