import * as THREE from 'three';
import {P,box,group,seeded,mat,clamp} from './kit.js';

const colors=[P.brick,P.cream,P.stone,P.roof,P.ochre,P.blueDark];
export function createDestruction(scene,city){
  const effects=group(scene);const active=[];const dust=[];const random=seeded(4128);const dustMat=new THREE.MeshBasicMaterial({color:0xc9bfa8,transparent:true,opacity:.36,depthWrite:false});
  const events=[{time:18,type:'stomp',building:city.buildings[1],part:'left',radius:1.6},{time:28,type:'impact',building:city.buildings[2],part:'head',radius:2.15},{time:37,type:'tail',building:city.buildings[8],part:'tail',radius:2.3}];
  function emit(e,at){const amount=e.type==='stomp'?16:e.type==='impact'?25:19;const from=e.building.contact;const isImpact=e.type==='impact';for(let i=0;i<amount;i++){
    const big=i<6;const size=big?.28+random()*.31:.07+random()*.18;const c=i%5===0?P.roofRed:colors[Math.floor(random()*colors.length)];const mesh=box(effects,from.x,Math.max(.2,from.y),from.z,size*(big?1.9:1),size,size*(big?1.4:1),c);const dir=e.type==='stomp'?(random()-.5)*2:e.type==='impact'?1.0:-(.3+random());const vx=dir*(1.1+random()*2.5);const vz=(random()-.5)*(e.type==='tail'?5:3)+(e.type==='impact'?1.8:e.type==='tail'?2.0:0);const vy=(big?2.0:2.5)+random()*2;active.push({mesh,origin:from.clone().add(new THREE.Vector3((random()-.5)*.7,(random()-.5)*.4,(random()-.5)*.5)),vx,vy,vz,spin:(random()-.5)*5,start:e.time,fade:!big,size});
  }
  for(let i=0;i<12;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),dustMat.clone());m.scale.setScalar(.35+random()*.42);m.position.copy(from);effects.add(m);dust.push({m,start:e.time,origin:from.clone(),vx:(random()-.5)*2.7,vz:(random()-.5)*2.3,delay:random()*.3})}
  }
  function update(t,contacts){for(const e of events){if(!e.building.damaged&&t>=e.time){const point=contacts[e.part];const target=e.building.contact;const distance=point.distanceTo(target);if(distance<=e.radius){e.building.damaged=true;e.building.intact.visible=false;e.building.ruin.visible=true;emit(e,point)}else if(t>e.time+.32){console.warn(`Missed ${e.type} contact: ${distance.toFixed(2)}`);e.building.damaged=true}}}
    for(const f of active){const age=Math.max(0,t-f.start);const airborne=clamp(age,0,3);const y=f.origin.y+f.vy*airborne-5.1*airborne*airborne;f.mesh.position.set(f.origin.x+f.vx*Math.min(age,1.45),Math.max(f.size*.5+.13,y),f.origin.z+f.vz*Math.min(age,1.45));f.mesh.rotation.set(age*f.spin*.6,age*f.spin,age*f.spin*.3);if(f.fade&&age>3.2)f.mesh.visible=false}
    for(const f of dust){const age=t-f.start-f.delay;f.m.visible=age>0&&age<2.6;if(f.m.visible){f.m.position.set(f.origin.x+f.vx*age,f.origin.y+.25+age*.58,f.origin.z+f.vz*age);f.m.material.opacity=.3*(1-age/2.6);f.m.scale.setScalar(.3+age*.64)}}
  }
  function reset(){for(const f of active)effects.remove(f.mesh);for(const f of dust){effects.remove(f.m);f.m.geometry.dispose();f.m.material.dispose()}active.length=0;dust.length=0;city.reset()}
  return {update,reset,events};
}
