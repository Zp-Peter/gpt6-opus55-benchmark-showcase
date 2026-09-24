import * as THREE from 'three';
import './style.css';
import {buildCity} from './city.js';
import {createDinosaur} from './dinosaur.js';
import {createDestruction} from './destruction.js';
import {clamp,smooth,lerp} from './kit.js';

const TOTAL=60;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x25343b);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.45;document.querySelector('#scene').appendChild(renderer.domElement);
const camera=new THREE.OrthographicCamera(-21,21,11.8,-11.8,.1,160);camera.position.set(7,29,38);
scene.add(new THREE.HemisphereLight(0xe8f1e9,0x57615b,2.0));const sun=new THREE.DirectionalLight(0xffe5b4,3.0);sun.position.set(-10,24,15);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-32;sun.shadow.camera.right=32;sun.shadow.camera.top=25;sun.shadow.camera.bottom=-25;sun.shadow.bias=-.00035;sun.shadow.normalBias=.014;sun.shadow.radius=3;scene.add(sun);
const fill=new THREE.DirectionalLight(0xb6d6d2,.85);fill.position.set(15,8,-15);scene.add(fill);
const city=buildCity(scene);const dino=createDinosaur(scene);const destruction=createDestruction(scene,city);
const keys=[
  {t:0,x:-28,z:0,yaw:0},{t:5,x:-28,z:0,yaw:0},{t:15,x:-10,z:0,yaw:0},
  {t:16.8,x:-7.1,z:0,yaw:0},{t:20,x:-7.1,z:0,yaw:0},
  {t:27.4,x:-2.95,z:-1.6,yaw:.22},{t:28,x:-2.72,z:-1.7,yaw:.24},
  {t:29.2,x:-3.05,z:-1.65,yaw:.18},{t:30,x:-2.72,z:-1.6,yaw:.1},
  {t:35.5,x:11.7,z:.3,yaw:.12},{t:37,x:11.7,z:.3,yaw:.58},
  {t:39.5,x:11.7,z:.3,yaw:.58},{t:40.5,x:12.2,z:.3,yaw:.2},
  {t:52,x:29,z:.3,yaw:0},{t:60,x:29,z:.3,yaw:0},
];
const distances=[0];for(let i=1;i<keys.length;i++)distances.push(distances[i-1]+Math.hypot(keys[i].x-keys[i-1].x,keys[i].z-keys[i-1].z));
function poseAt(t){let i=0;while(i<keys.length-2&&t>keys[i+1].t)i++;const a=keys[i],b=keys[i+1],u=clamp((t-a.t)/(b.t-a.t),0,1);const x=lerp(a.x,b.x,u),z=lerp(a.z,b.z,u),yaw=lerp(a.yaw,b.yaw,smooth(u));const speed=Math.hypot(b.x-a.x,b.z-a.z)/(b.t-a.t);const distance=lerp(distances[i],distances[i+1],u);const stomp=t>=16.8&&t<18?Math.sin(Math.PI*(t-16.8)/1.2):0;const crouch=t>26.3&&t<28.5?Math.sin(Math.PI*(t-26.3)/2.2)*.8:0;const lean=t>27&&t<29.4?Math.sin(Math.PI*(t-27)/2.4)*-.14:0;const tailSwing=t>35.2&&t<38.5?Math.sin(Math.PI*(t-35.2)/3.3)*.075:0;const roar=t>11.5&&t<14.8?Math.sin(Math.PI*(t-11.5)/3.3):0;return {x,z,yaw,speed,distance,stomp,crouch,lean,tailSwing,roar,look:t>11&&t<15?-.11:0}}
let time=0,playing=true,last=performance.now();const ui={pause:document.querySelector('#pause'),replay:document.querySelector('#replay'),clock:document.querySelector('#clock'),progress:document.querySelector('#progress'),no:document.querySelector('#chapter-no'),title:document.querySelector('#chapter-title'),sub:document.querySelector('#chapter-sub')};
const chapters=[['01','平静的早晨','街道还像往常一样忙碌'],['02','陌生访客','从城外，慢慢走来'],['03','脚下的花店','第一声碎裂'],['04','撞向街角','砖墙与屋顶崩落'],['05','最后一甩','尾巴扫过另一条街'],['06','离开小城','脚步渐远'],['07','余波','城市留下了它的痕迹']];
function chapter(t){return t<5?0:t<16?1:t<22?2:t<32?3:t<40?4:t<52?5:6}
function updateUI(){const sec=Math.floor(time);ui.clock.textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')} / 01:00`;ui.progress.style.width=`${time/TOTAL*100}%`;const c=chapters[chapter(time)];ui.no.textContent=c[0];ui.title.textContent=c[1];ui.sub.textContent=c[2];ui.pause.innerHTML=playing?'❚❚ <span>暂停</span>':'▶ <span>继续</span>';ui.pause.disabled=time>=TOTAL;ui.pause.setAttribute('aria-label',playing?'暂停动画':'继续动画')}
function updateScene(){const pose=poseAt(time);dino.update(time,pose);city.update(time);destruction.update(time,dino.contact);const focusX=time<15?-.6:time<39?lerp(-.6,2.0,smooth((time-15)/24)):lerp(2,0,smooth((time-39)/13));const focusZ=time<30?-.2:time<52?lerp(-.2,.5,smooth((time-30)/22)):.5;camera.position.set(7+focusX,29,38+focusZ);camera.lookAt(focusX,0,focusZ);camera.zoom=1+(time<12?0:time<38?.06*smooth((time-12)/10):.06*(1-smooth((time-38)/14)));camera.updateProjectionMatrix();updateUI();renderer.render(scene,camera)}
function frame(now){const dt=Math.min((now-last)/1000,.05);last=now;if(playing){time=Math.min(TOTAL,time+dt);if(time>=TOTAL)playing=false}updateScene();requestAnimationFrame(frame)}
function resize(){const el=document.querySelector('#scene'),w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h);const aspect=w/h;const vertical=11.8;camera.left=-vertical*aspect;camera.right=vertical*aspect;camera.top=vertical;camera.bottom=-vertical;camera.updateProjectionMatrix()}
ui.pause.addEventListener('click',()=>{playing=!playing;last=performance.now();updateUI()});ui.replay.addEventListener('click',()=>{destruction.reset();time=0;playing=true;last=performance.now();updateScene()});window.addEventListener('resize',resize);resize();updateScene();requestAnimationFrame(frame);
// Read-only animation state for browser verification.
window.__littleCity=()=>({time,playing,damage:city.buildings.filter(b=>b.damaged).map(b=>b.damage),dinosaurX:dino.root.position.x});
