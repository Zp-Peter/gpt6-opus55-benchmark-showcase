import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import terrain from './terrain-data.js';

async function main(){
const $=s=>document.querySelector(s);
const status=$('#status');
const scene=new THREE.Scene();
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
renderer.domElement.setAttribute('aria-label','马特洪峰三维模型。拖动旋转，滚轮缩放；也可使用底部视角按钮。');
renderer.domElement.tabIndex=0;
$('#scene').append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(37,innerWidth/innerHeight,10,65000);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.07;controls.enablePan=false;
controls.minDistance=2400;controls.maxDistance=12500;
controls.minPolarAngle=.15;controls.maxPolarAngle=Math.PI*.485;
controls.rotateSpeed=.55;controls.zoomSpeed=.7;controls.autoRotateSpeed=.3;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let dirty=true,transition=null,ready=false,labels=true,lightMode='day',snowAmount=.12;
const focus=new THREE.Vector3(0,1280,0);
const views={classic:[3100,1500,-4400],north:[-1000,2450,-6200],east:[6200,2600,100],aerial:[3500,8500,-3800]};
camera.position.fromArray(views.classic);controls.target.copy(focus);controls.update();
const hemi=new THREE.HemisphereLight(0xc8e1ff,0x555042,2.2);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffefd9,2.5);sun.position.set(-3500,7000,-6000);scene.add(sun);
scene.fog=new THREE.FogExp2(0x8196aa,.000026);
const skyUniforms={top:{value:new THREE.Color('#163f65')},bottom:{value:new THREE.Color('#91adc3')},warm:{value:0}};
const sky=new THREE.Mesh(new THREE.SphereGeometry(50000,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:skyUniforms,vertexShader:`varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vP;uniform vec3 top;uniform vec3 bottom;uniform float warm;void main(){vec3 d=normalize(vP);float h=pow(max(d.y,0.),.52);vec3 col=mix(bottom,top,h);float haze=pow(max(0.,1.-abs(d.y-.035)*6.),8.)*.06;col+=haze;gl_FragColor=vec4(col,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')}));scene.add(sky);
const aerial=await new THREE.TextureLoader().loadAsync(terrain.aerial);
aerial.colorSpace=THREE.SRGBColorSpace;aerial.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
const shared={uSnow:{value:snowAmount},uContour:{value:0}};
const materials=[];const model=new THREE.Group();model.name='Matterhorn — swisstopo terrain';scene.add(model);
const noiseGLSL=`float hash3(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);}`;
function makeMaterial(core){
 const mat=new THREE.MeshStandardMaterial({map:core?aerial:null,color:core?0xffffff:0x777e81,roughness:1,metalness:0});
 mat.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,shared);
  shader.vertexShader='varying vec3 vTerrain;varying vec3 vSlope;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTerrain=position;vSlope=normal;');
  shader.fragmentShader='varying vec3 vTerrain;varying vec3 vSlope;uniform float uSnow;uniform float uContour;\n'+noiseGLSL+'\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  float n=noise3(vTerrain*.017)*.6+noise3(vTerrain*.09)*.3+noise3(vTerrain*.4)*.1;
  float slope=normalize(vSlope).y;
  float altitude=vTerrain.y+2500.;
  float strata=sin(vTerrain.y*.12+noise3(vTerrain*.022)*5.+vTerrain.x*.025)*.5+.5;
  ${core?'diffuseColor.rgb *= .90+ n*.23;':'diffuseColor.rgb=mix(vec3(.17,.19,.18),vec3(.42,.43,.42),n);float oldSnow=smoothstep(3000.,3600.,altitude)*smoothstep(.42,.8,slope+n*.2);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.76,.83,.89),oldSnow);'}
  float snowline=mix(4400.,2300.,uSnow);
  float accumulation=smoothstep(snowline-220.,snowline+200.,altitude+n*180.)*smoothstep(.35,.76,slope+n*.3+uSnow*.22);
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.83,.90,.97)*( .94+.06*n),accumulation);
  float contours=1.-smoothstep(0.,max(fwidth(vTerrain.y)*1.2,1.1),abs(mod(altitude+50.,100.)-50.));
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.68,.48,.20),contours*uContour*.65);
  `);
  mat.userData.shader=shader;
 };
 mat.customProgramCacheKey=()=>core?'aerial-terrain':'distant-terrain';materials.push(mat);return mat;
}
let summit=new THREE.Vector3(0,1978,0),maxHeight=-Infinity,totalTriangles=0;
for(const patch of terrain.patches){
 const raw=Uint8Array.from(atob(patch.heights),c=>c.charCodeAt(0));const heights=new Uint16Array(raw.buffer);
 const geo=new THREE.PlaneGeometry(patch.width,patch.depth,patch.nx-1,patch.ny-1);geo.rotateX(-Math.PI/2);
 const pos=geo.attributes.position;
 for(let i=0;i<pos.count;i++){
  const col=i%patch.nx,row=Math.floor(i/patch.nx);
  const x=patch.x0+col*patch.width/(patch.nx-1),z=patch.z0+row*patch.depth/(patch.ny-1),y=heights[i]/10-2500;
  pos.setXYZ(i,x,y,z);
  if(patch.name==='core'&&y>maxHeight){maxHeight=y;summit.set(x,y,z);}
 }
 geo.computeVertexNormals();geo.computeBoundingSphere();
 const mesh=new THREE.Mesh(geo,makeMaterial(patch.name==='core'));mesh.name=patch.name;model.add(mesh);totalTriangles+=geo.index.count/3;
}
const peakMarker=$('#peak');
const pin=new THREE.Vector3();
function updateMarker(){pin.copy(summit).add(new THREE.Vector3(0,35,0)).project(camera);peakMarker.style.left=`${(pin.x*.5+.5)*innerWidth}px`;peakMarker.style.top=`${(-pin.y*.5+.5)*innerHeight}px`;peakMarker.hidden=!labels||pin.z>1||pin.x<-1||pin.x>1||pin.y<-1||pin.y>1;}
function setView(name,animate=true){
 const target=new THREE.Vector3().fromArray(views[name]);if(innerWidth<700)target.multiplyScalar(1.16);
 controls.autoRotate=false;$('#rotate').setAttribute('aria-pressed','false');$('#rotate').classList.remove('active');
 document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('selected',b.dataset.view===name);b.setAttribute('aria-pressed',String(b.dataset.view===name));});
 if(animate&&!reduced.matches)transition={start:performance.now(),from:camera.position.clone(),to:target};else{camera.position.copy(target);controls.target.copy(focus);controls.update();}
 dirty=true;
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
function setLight(mode){lightMode=mode;document.querySelectorAll('[data-light]').forEach(b=>{b.classList.toggle('selected',b.dataset.light===mode);b.setAttribute('aria-pressed',String(b.dataset.light===mode));});
 if(mode==='golden'){sun.color.set('#ffb974');sun.intensity=3.2;sun.position.set(-8000,2600,-3200);hemi.intensity=1.7;hemi.color.set('#a6c3ed');skyUniforms.top.value.set('#343e58');skyUniforms.bottom.value.set('#d9b9a2');scene.fog.color.set('#9c969d');renderer.toneMappingExposure=1.0;}
 else{sun.color.set('#ffefd9');sun.intensity=2.5;sun.position.set(-3500,7000,-6000);hemi.intensity=2.2;hemi.color.set('#c8e1ff');skyUniforms.top.value.set('#163f65');skyUniforms.bottom.value.set('#91adc3');scene.fog.color.set('#8196aa');renderer.toneMappingExposure=1.05;}
 dirty=true;
}
document.querySelectorAll('[data-light]').forEach(b=>b.onclick=()=>setLight(b.dataset.light));
$('#snow').oninput=e=>{snowAmount=Number(e.target.value)/100;shared.uSnow.value=snowAmount;$('#snow-value').textContent=e.target.value+'%';dirty=true;};
$('#fog').oninput=e=>{scene.fog.density=Number(e.target.value)*.000001;$('#fog-value').textContent=e.target.value+'%';dirty=true;};
$('#rotate').onclick=()=>{transition=null;controls.autoRotate=!controls.autoRotate;$('#rotate').setAttribute('aria-pressed',String(controls.autoRotate));$('#rotate').classList.toggle('active',controls.autoRotate);dirty=true;};
$('#labels').onclick=()=>{labels=!labels;$('#labels').setAttribute('aria-pressed',String(labels));$('#labels').classList.toggle('active',labels);dirty=true;};
$('#contours').onclick=()=>{shared.uContour.value=1-shared.uContour.value;$('#contours').setAttribute('aria-pressed',String(!!shared.uContour.value));$('#contours').classList.toggle('active',!!shared.uContour.value);dirty=true;};
$('#reset').onclick=()=>setView('classic');
$('#zoom-in').onclick=()=>zoom(.85);$('#zoom-out').onclick=()=>zoom(1.18);
function zoom(factor){transition=null;camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);controls.update();dirty=true;}
renderer.domElement.addEventListener('keydown',e=>{
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','=','r','R'].includes(e.key)){e.preventDefault();transition=null;const offset=camera.position.clone().sub(controls.target),sph=new THREE.Spherical().setFromVector3(offset);
 if(e.key==='ArrowLeft')sph.theta-=.09;if(e.key==='ArrowRight')sph.theta+=.09;if(e.key==='ArrowUp')sph.phi-=.06;if(e.key==='ArrowDown')sph.phi+=.06;
 sph.phi=THREE.MathUtils.clamp(sph.phi,controls.minPolarAngle,controls.maxPolarAngle);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sph));
 if(['+','='].includes(e.key))zoom(.9);if(e.key==='-')zoom(1.1);if(e.key.toLowerCase()==='r')setView('classic');controls.update();dirty=true;
 }});
controls.addEventListener('change',()=>{dirty=true;});controls.addEventListener('start',()=>{transition=null;});
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),15000);}
$('#capture').onclick=()=>{renderer.render(scene,camera);renderer.domElement.toBlob(blob=>{if(blob)download(blob,'Matterhorn.png');},'image/png');};
$('#export').onclick=async()=>{
 const b=$('#export');b.disabled=true;b.textContent='正在导出…';status.textContent='正在准备三维模型';
 try{
  const exportModel=new THREE.Group();exportModel.name='Matterhorn LV95 / units metres / datum 2500 m';
  const core=model.children[0];exportModel.add(new THREE.Mesh(core.geometry,new THREE.MeshStandardMaterial({map:aerial,roughness:1})));
  exportModel.userData={source:'© swisstopo; swissALTI3D 2024, SWISSIMAGE; Mapzen fallback',originLV95:[2617050,1091650,2500],units:'metres',renderGrid:8,notes:'Original aerial texture; artistic snow and lighting excluded.'};
  const buffer=await new GLTFExporter().parseAsync(exportModel,{binary:true,maxTextureSize:3072});download(new Blob([buffer],{type:'model/gltf-binary'}),'Matterhorn.glb');exportModel.children[0].material.dispose();status.textContent='三维模型已导出';
 }catch(e){console.error(e);status.textContent='导出失败，请重试';}finally{b.disabled=false;b.textContent='导出模型 ↗';}
};
$('#info').onclick=()=>$('#about').showModal();$('#close-about').onclick=()=>$('#about').close();$('#about').addEventListener('click',e=>{if(e.target===$('#about'))$('#about').close();});
$('#panel-toggle').onclick=()=>{const open=$('#settings').classList.toggle('open');$('#panel-toggle').setAttribute('aria-expanded',String(open));};
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);dirty=true;});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();$('#loading').hidden=false;$('#loading').textContent='图形连接已暂停，请刷新页面重试。';});
let last=performance.now(),frames=0;
function frame(now){requestAnimationFrame(frame);if(document.hidden){last=now;return;}const delta=Math.min((now-last)/1000,.05);last=now;
 if(transition){let t=Math.min((now-transition.start)/1300,1);t=t*t*(3-2*t);camera.position.lerpVectors(transition.from,transition.to,t);controls.target.copy(focus);if(t>=1)transition=null;dirty=true;}
 controls.update(delta);
 if(dirty||controls.autoRotate){sky.position.copy(camera.position);renderer.render(scene,camera);updateMarker();$('#compass-needle').style.transform=`rotate(${controls.getAzimuthalAngle()*180/Math.PI}deg)`;dirty=false;frames++;}
}
setView('classic',false);requestAnimationFrame(frame);ready=true;$('#loading').hidden=true;status.textContent='实景地形 · 可自由探索';
window.matterhorn={getState:()=>({ready,triangles:totalTriangles,coreVertices:model.children[0].geometry.attributes.position.count,summit:summit.toArray(),camera:camera.position.toArray(),snow:snowAmount,light:lightMode,autoRotate:controls.autoRotate,frames,drawCalls:renderer.info.render.calls,webgl:renderer.capabilities.isWebGL2})};

}
main().catch(e=>{console.error(e);const el=document.querySelector("#loading");el.hidden=false;el.textContent="无法启动三维场景，请使用支持 WebGL 2 的浏览器。";});
