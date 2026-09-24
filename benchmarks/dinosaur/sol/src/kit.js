import * as THREE from 'three';

export const P = {
  grass:0x8b9d75, lawn:0x718963, asphalt:0x45545a, roadEdge:0x77817b, stone:0xd1c7aa,
  cream:0xe5d8b6, brick:0xb87762, brickDark:0x8d564e, mint:0x8db2a0, sage:0x637d72,
  blue:0x7091a2, blueDark:0x476373, ochre:0xd9ab6d, yellow:0xf1cc83,
  roof:0x596b68, roofRed:0x965c54, window:0x4b6872, lit:0xf2c884,
  wood:0x775b4d, green:0x668665, leaf:0x769668, trunk:0x6f6554,
  dino:0x4d7759, dinoLight:0x83a872, dinoDark:0x304f43, belly:0xc5b98a, bone:0xf0dfb7,
};
const materialCache=new Map();
export function mat(color,extra={}){const key=`${color}:${extra.emissive||0}`;if(!materialCache.has(key))materialCache.set(key,new THREE.MeshStandardMaterial({color,roughness:.92,metalness:0,flatShading:true,...extra}));return materialCache.get(key)}
export const cube=new THREE.BoxGeometry(1,1,1);
export function box(parent,x,y,z,w,h,d,color,opts={}){const m=new THREE.Mesh(cube,mat(color,opts));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
export function group(parent,x=0,y=0,z=0){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g}
export function seeded(n){let v=n>>>0;return()=>{v=(1664525*v+1013904223)>>>0;return v/4294967296}}
export function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
export function smooth(v){v=clamp(v,0,1);return v*v*(3-2*v)}
export function lerp(a,b,t){return a+(b-a)*t}
export function between(parent,a,b,width,depth,color){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b);const mesh=box(parent,0,0,0,width,1,depth,color);mesh.position.copy(va).add(vb).multiplyScalar(.5);mesh.scale.y=va.distanceTo(vb);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),vb.sub(va).normalize());return mesh}
export function instancedBoxes(parent,items,color){const mesh=new THREE.InstancedMesh(cube,mat(color),items.length);const temp=new THREE.Object3D();items.forEach((v,i)=>{temp.position.set(v[0],v[1],v[2]);temp.scale.set(v[3],v[4],v[5]);temp.updateMatrix();mesh.setMatrixAt(i,temp.matrix)});mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
