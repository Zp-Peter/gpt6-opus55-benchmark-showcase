import * as THREE from 'three';
import {P,box,group,clamp,smooth,lerp} from './kit.js';

function limb(mesh,a,b,width,depth){const v=new THREE.Vector3(...a),w=new THREE.Vector3(...b);mesh.position.copy(v).add(w).multiplyScalar(.5);mesh.scale.set(width,v.distanceTo(w),depth);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),w.sub(v).normalize())}
function makeLeg(parent,side){const z=side*.77;const hip=box(parent,0,0,0,1,1,1,P.dinoDark);const shin=box(parent,0,0,0,1,1,1,P.dino);const knee=box(parent,0,0,0,.5,.55,.56,P.dino);const foot=group(parent);box(foot,.25,.13,0,.9,.25,.59,P.dinoDark);for(const zz of [-.22,0,.22]){box(foot,.7,.095,zz,.35,.17,.17,P.dino);box(foot,.91,.08,zz,.14,.1,.12,P.bone)}return {hip,shin,knee,foot,z,point:new THREE.Vector3()}}

export function createDinosaur(scene){
  const root=group(scene,-28,0,0);root.scale.setScalar(1.2);const torso=group(root,0,0,0);
  box(torso,-.1,3.1,0,2.65,1.75,1.55,P.dino);box(torso,-.1,3.55,0,2.25,.62,1.28,P.dinoLight);box(torso,.45,2.43,0,1.68,.57,1.32,P.belly);
  // Flat stepped back plates read as small voxels from the overhead camera.
  for(let i=0;i<8;i++){const x=-1.1+i*.34;box(torso,x,4.04+Math.sin(i/7*Math.PI)*.17,0,.23,.24,1.1-i*.025,i%2?P.dinoDark:P.dinoLight)}
  box(torso,1.12,3.48,0,.8,1.12,1.07,P.dino);box(torso,1.48,3.78,0,.72,1.12,.91,P.dinoLight);
  const headPivot=group(torso,1.53,4.04,0);box(headPivot,.47,.05,0,1.3,1.07,1.3,P.dino);box(headPivot,1.13,-.16,0,1.25,.59,1.17,P.dinoLight);box(headPivot,1.46,-.27,0,.62,.29,1.17,P.dino);box(headPivot,1.69,-.17,0,.13,.12,.96,P.dinoDark);
  const jaw=group(headPivot,.2,-.46,0);box(jaw,.99,-.12,0,1.8,.26,1.08,P.belly);box(jaw,1.24,-.24,0,1.13,.17,.95,P.dinoDark);for(const s of [-1,1]){
    box(headPivot,.52,.27,s*.66,.49,.3,.11,P.dinoDark);box(headPivot,.68,.27,s*.74,.21,.22,.1,P.yellow);box(headPivot,.7,.29,s*.8,.1,.1,.03,P.blueDark);
    box(headPivot,1.53,-.02,s*.59,.15,.1,.045,P.dinoDark);
    for(let i=0;i<5;i++){box(headPivot,.6+i*.24,-.48,s*.43,.085,.2,.09,P.bone);box(jaw,.63+i*.23,-.01,s*.42,.075,.14,.08,P.bone)}
    box(headPivot,1.38,-.04,s*.52,.16,.08,.035,P.dinoDark);
  }
  const arms=[];for(const s of [-1,1]){const a=group(torso,.82,3.2,s*.87);a.rotation.x=s*.12;box(a,.14,-.23,s*.02,.34,.61,.37,P.dinoDark);box(a,.33,-.55,s*.02,.43,.22,.29,P.dino);box(a,.53,-.68,s*.12,.25,.1,.09,P.bone);box(a,.51,-.68,-s*.08,.21,.1,.08,P.bone);arms.push(a)}
  const tail=[];let p=group(torso,-1.3,3.2,0);for(let i=0;i<6;i++){const len=[.93,.86,.78,.7,.62,.54][i],wide=[1.22,1.03,.84,.66,.49,.32][i];const seg=group(p,-(i===0?0:[.93,.86,.78,.7,.62][i-1]),i===0?0:-.075,0);box(seg,-len*.48,0,0,len,wide*.69,wide,P.dinoDark);box(seg,-len*.47,wide*.22,0,len*.89,.16,wide*.77,P.dino);tail.push({pivot:seg,len});p=seg}
  const legs=[makeLeg(root,-1),makeLeg(root,1)];
  const contact={left:new THREE.Vector3(),right:new THREE.Vector3(),head:new THREE.Vector3(),tail:new THREE.Vector3()};
  function update(t,pose){root.position.set(pose.x,0,pose.z);root.rotation.y=pose.yaw;const moving=pose.speed>.03;const gait=pose.distance/1.78;
    let bob=0;legs.forEach((leg,i)=>{const phase=((gait+i*.5)%1+1)%1;let footX,footY;if(phase<.62){footX=.46-phase/.62*.92;footY=0}else{const p=(phase-.62)/.38;footX=lerp(-.46,.46,smooth(p));footY=Math.sin(Math.PI*p)*.46}if(!moving){footX=i===0?-.33:.35;footY=0}
      if(pose.stomp>0&&i===0){footX=.34;footY=pose.stomp*.6}
      const footZ=leg.z;leg.foot.position.set(footX,footY,footZ);const hip=[-.55,2.62,footZ*.82];const ankle=[footX,footY+.24,footZ];const knee=[lerp(hip[0],ankle[0],.51)+.22,1.34+footY*.28,footZ];limb(leg.hip,hip,knee,.72,.7);limb(leg.shin,knee,ankle,.43,.44);leg.knee.position.set(...knee);leg.point.set(footX+.35,footY,footZ);root.localToWorld(leg.point);
    });
    bob=moving?Math.sin(gait*Math.PI*2)*.075:Math.sin(t*1.3)*.018;torso.position.y=bob-pose.crouch*.23;torso.rotation.z=pose.lean;headPivot.rotation.z=-pose.lean*.48+Math.sin(t*1.15)*.025;headPivot.rotation.y=pose.look||0;jaw.rotation.z=-pose.roar*.22;arms.forEach((a,i)=>a.rotation.z=Math.sin(gait*Math.PI*2+i*Math.PI)*.15-pose.lean*.4);
    tail.forEach((s,i)=>{s.pivot.rotation.y=(pose.tailSwing||0)*(1-i*.075)+Math.sin(t*1.3-i*.42)*.035;s.pivot.rotation.z=-.025+Math.sin(t*.9-i*.35)*.016});
    contact.left.copy(legs[0].point);contact.right.copy(legs[1].point);contact.head.set(3.15,3.6,0);torso.localToWorld(contact.head);contact.tail.set(-tail.at(-1).len,0,0);tail.at(-1).pivot.localToWorld(contact.tail);
  }
  return {root,update,contact,reset(){root.position.set(-28,0,0)}};
}
