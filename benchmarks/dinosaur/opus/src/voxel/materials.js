import * as THREE from 'three';
import { decodeColorChunk } from './voxels.js';

// 体素网格共用的四种材质（与 MAT 下标一致）。
function tag(m) {
  m.onBeforeCompile = decodeColorChunk;
  m.customProgramCacheKey = () => 'voxel-sqrt-color';
  return m;
}

export const voxelMaterials = [
  tag(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.0 })),
  tag(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0.15, envMapIntensity: 1.25 })),
  tag(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.55, envMapIntensity: 1.0 })),
  tag(new THREE.MeshBasicMaterial({ vertexColors: true })),
];

export function voxelMesh(geometry, { shadow = true } = {}) {
  const mesh = new THREE.Mesh(geometry, voxelMaterials);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  return mesh;
}

// 地面/底座用的材质：在世界坐标上按 1 体素格做轻微明度颗粒，与体素模型的“像素”质感统一。
export function grainMaterial({ grain = 0.09, ...opts } = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, ...opts });
  const amount = grain;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uGrain = { value: amount };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGPos;\nvarying vec3 vGNrm;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vGPos = (modelMatrix * vec4(transformed,1.0)).xyz;\n vGNrm = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vGPos;
varying vec3 vGNrm;
uniform float uGrain;
float gHash(vec3 p){ p = fract(p*vec3(0.1031,0.1030,0.0973)); p += dot(p, p.yxz+33.33); return fract((p.x+p.y)*p.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
 vec3 gc = floor(vGPos - vGNrm*0.02 + 0.0001);
 float gh = gHash(gc);
 diffuseColor.rgb *= 1.0 + (gh - 0.5) * uGrain;`);
  };
  m.customProgramCacheKey = () => 'grain' + amount;
  return m;
}
