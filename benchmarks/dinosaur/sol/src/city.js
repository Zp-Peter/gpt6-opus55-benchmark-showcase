import * as THREE from 'three';
import {P,box,group,instancedBoxes,seeded,mat,cube} from './kit.js';

function label(text,bg,fg='#fff4d7'){
  const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,256,64);x.fillStyle=fg;x.font='bold 34px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(text,128,33);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide});
}
function shopSign(parent,text,y,front,w,color){const g=new THREE.Mesh(new THREE.PlaneGeometry(w,.43),label(text,color));g.position.set(0,y,front);if(front<0)g.rotation.y=Math.PI;parent.add(g)}
function windows(parent,w,h,d,face,color=P.window){const items=[];const floors=Math.max(1,Math.floor((h-1.05)/.82));const cols=Math.max(2,Math.floor(w/.78));for(let row=0;row<floors;row++)for(let col=0;col<cols;col++){
  const x=-w/2+(col+.5)*w/cols;const y=1.15+row*.83;items.push([x,y,face*(d/2+.016),.35,.43,.035]);
}if(items.length)instancedBoxes(parent,items,color);
const sills=items.map(i=>[i[0],i[1]-.26,i[2]+face*.025,.44,.07,.09]);if(sills.length)instancedBoxes(parent,sills,P.cream);
}
function roofBits(g,w,h,d,kind){
  if(kind==='tower'){box(g,0,h+.22,0,w+.35,.45,d+.35,P.roof);box(g,0,h+.65,0,w*.6,.43,d*.6,P.cream);box(g,0,h+.95,0,w*.5,.2,d*.5,P.roofRed);box(g,0,h+1.2,0,.18,.32,.18,P.wood)}
  else if(kind==='house'){box(g,0,h+.25,0,w+.45,.5,d+.45,P.roofRed);for(let s of [-1,1])box(g,s*w*.26,h+.52,0,w*.48,.17,d+.42,P.roofRed)}
  else if(kind==='deco'){box(g,0,h+.12,0,w+.3,.25,d+.3,P.cream);box(g,0,h+.4,0,w*.58,.31,d*.6,P.sage);box(g,0,h+.67,0,w*.28,.22,d*.32,P.cream)}
  else{box(g,0,h+.14,0,w+.28,.29,d+.25,P.roof);box(g,w*.28,h+.48,-d*.22,.52,.4,.48,P.blueDark);box(g,w*.28,h+.72,-d*.22,.58,.07,.54,P.stone)}
}
function createBuilding(parent,def){
  const {x,z,w,d,h,kind,side,main,trim,sign,damage}=def;const root=group(parent,x,0,z);const intact=group(root);const face=-side;const front=face*(d/2+.025);
  box(intact,0,.13,0,w+.36,.26,d+.36,P.stone);
  box(intact,0,h/2+.25,0,w,h,d,main);
  if(kind==='tower'){box(intact,0,h*.58+.25,0,w*.75,h*.55,d*.75,main);box(intact,0,h+.27,0,w+.36,.28,d+.36,trim)}
  else if(kind==='house'){box(intact,0,.73,front+face*.2,w*.72,1.25,.42,trim);box(intact,-w*.35,h*.68,0,.25,h*.5,d+.15,trim)}
  else if(kind==='deco'){for(const s of [-1,1])box(intact,s*(w/2-.14),h/2+.3,front+face*.045,.28,h+.1,.22,trim);box(intact,0,h*.72,front+face*.06,w+.1,.11,.19,trim)}
  else if(kind==='cafe'||kind==='shop'){box(intact,0,1.12,front+face*.29,w+.4,.15,.73,trim);for(const s of [-1,1])box(intact,s*(w*.28),.74,front+face*.44,.09,.65,.09,P.wood)}
  else{box(intact,0,h*.49,front+face*.04,w+.14,.15,.12,trim)}
  roofBits(intact,w,h,d,kind);
  windows(intact,w,h,d,face,kind==='cafe'?P.lit:P.window);
  windows(intact,w,h,d,-face,P.window);
  const sideWindows=[];for(let y=1.25;y<h-.3;y+=.84)for(const zz of [-d*.23,d*.23])sideWindows.push([w/2+.025,y,zz,.04,.38,.33]);
  if(sideWindows.length)instancedBoxes(intact,sideWindows,P.window);
  for(const s of [-1,1]){box(intact,s*(w*.34),.67,front+face*.043,.42,.62,.04,P.window);box(intact,s*(w*.34),.31,front+face*.1,.48,.11,.12,trim)}
  box(intact,0,.61,front+face*.09,.54,.88,.11,P.wood);box(intact,.17,.65,front+face*.18,.055,.055,.04,P.yellow);
  if(sign)shopSign(intact,sign,kind==='shop'||kind==='cafe'?1.42:1.75,front+face*.73,w*.72,kind==='cafe'?'#725747':'#486e6c');
  if(kind==='house'){box(intact,w*.3,h*.52,front+face*.34,.67,.08,.46,P.roof);box(intact,w*.3,h*.51,front+face*.59,.05,.45,.05,P.wood)}
  if(kind==='deco'){for(let i=0;i<3;i++)box(intact,-w*.36+i*w*.36,h+.18,front+face*.19,.17,.36,.2,trim)}
  const ruin=group(root);ruin.visible=false;
  if(damage==='stomp'){
    box(ruin,0,.16,0,w+.35,.22,d+.35,P.stone);box(ruin,-w*.25,.46,-d*.12,w*.48,.43,d*.48,main);box(ruin,w*.3,.31,d*.16,w*.3,.22,d*.4,trim);box(ruin,0,.28,face*(d*.45),w*.7,.18,.24,P.roofRed);
  } else if(damage==='impact'){
    box(ruin,0,.13,0,w+.36,.26,d+.36,P.stone);box(ruin,-w*.18,1.33,-d*.17,w*.64,2.35,d*.72,main);box(ruin,w*.35,.96,d*.27,w*.25,1.6,d*.42,main);box(ruin,-w*.39,2.43,-d*.27,.25,.75,d*.45,trim);box(ruin,-w*.15,2.53,-d*.29,w*.45,.14,d*.48,P.stone);box(ruin,.42,.7,front+face*.1,.6,.72,.22,P.wood);
  } else if(damage==='tail'){
    box(ruin,0,.13,0,w+.36,.26,d+.36,P.stone);box(ruin,-w*.1,h/2+.25,0,w*.8,h,d*.78,main);box(ruin,-w*.32,h/2+.25,-face*d*.35,.3,h,d*.3,trim);box(ruin,0,h+.14,-face*d*.14,w*.82,.28,d*.7,P.roof);box(ruin,w*.35,1.15,0,w*.23,1.8,d*.65,main);box(ruin,-w*.24,1.6,front*.82,.39,.48,.08,P.window);
  }
  return {root,intact,ruin,def,damaged:false,contact:new THREE.Vector3(x,damage==='stomp'?.7:damage==='impact'?3.15:2.1,z+face*(d/2)),damage};
}
function tree(parent,x,z,scale=1){const g=group(parent,x,0,z);box(g,0,.34*scale,0,.24*scale,.68*scale,.24*scale,P.trunk);box(g,0,.89*scale,0,.95*scale,.73*scale,.94*scale,P.leaf);box(g,-.24*scale,1.12*scale,-.15*scale,.54*scale,.43*scale,.55*scale,P.green);box(g,.23*scale,.87*scale,.2*scale,.5*scale,.48*scale,.51*scale,P.grass);return g}
function car(parent,color,x,z,flip=1){const g=group(parent,x,.17,z);box(g,0,.19,0,1.17,.39,.59,color);box(g,-.06,.47,0,.61,.25,.53,P.cream);box(g,.32,.48,0,.21,.17,.54,P.window);for(const a of [-.35,.35])for(const b of [-.32,.32])box(g,a,.015,b,.21,.18,.08,P.blueDark);box(g,.6,.23,-.2,.04,.12,.12,P.lit);box(g,.6,.23,.2,.04,.12,.12,P.lit);g.rotation.y=flip<0?Math.PI:0;return g}
export function buildCity(scene){
  const city=group(scene);box(city,0,-.43,0,64,.85,25,P.wood);box(city,0,-.01,0,63.2,.08,24.2,P.stone);box(city,0,.035,0,62.6,.06,23.6,P.lawn);
  box(city,0,.09,0,62.6,.065,3.9,P.asphalt);box(city,0,.145,-2.35,62.6,.17,.83,P.stone);box(city,0,.145,2.35,62.6,.17,.83,P.stone);
  for(const rx of [-10.5,-3.5,3.5,10.5]){box(city,rx,.088,0,2.25,.07,20.6,P.asphalt);for(const z of [-2.01,2.01])for(let i=-1;i<=1;i++)box(city,rx+i*.44,.18,z,.25,.014,.39,P.cream)}
  const lane=[];for(let x=-30;x<31;x+=2.2)if(![-10.5,-3.5,3.5,10.5].some(v=>Math.abs(x-v)<1.9))lane.push([x,.13,0,.78,.014,.055]);instancedBoxes(city,lane,P.ochre);
  for(const x of [-15,-12,-8,-5,-1,2,6,9,13,16])for(const z of [-9.7,9.7])box(city,x,.078,z,1.1,.012,.2,P.grass);
  const defs=[
    {x:-14,z:-6.0,w:3.2,d:3.1,h:3.35,kind:'house',side:-1,main:P.brick,trim:P.cream,sign:'',damage:null},
    {x:-7,z:-2.85,w:3.0,d:2.1,h:2.0,kind:'shop',side:-1,main:P.ochre,trim:P.roofRed,sign:'花 店',damage:'stomp'},
    {x:0,z:-4.8,w:3.7,d:4.0,h:5.3,kind:'deco',side:-1,main:P.brick,trim:P.stone,sign:'',damage:'impact'},
    {x:7,z:-5.7,w:3.2,d:3.1,h:6.1,kind:'tower',side:-1,main:P.blue,trim:P.cream,sign:'',damage:null},
    {x:14,z:-5.5,w:3.45,d:3.3,h:3.9,kind:'house',side:-1,main:P.mint,trim:P.cream,sign:'',damage:null},
    {x:-14,z:5.6,w:3.2,d:3.2,h:4.15,kind:'deco',side:1,main:P.blue,trim:P.cream,sign:'',damage:null},
    {x:-7,z:5.5,w:3.2,d:3.3,h:3.4,kind:'cafe',side:1,main:P.mint,trim:P.roof,sign:'咖 啡',damage:null},
    {x:0,z:5.8,w:3.45,d:3.2,h:4.6,kind:'house',side:1,main:P.cream,trim:P.brickDark,sign:'',damage:null},
    {x:7,z:4.8,w:3.3,d:3.1,h:3.75,kind:'shop',side:1,main:P.brick,trim:P.ochre,sign:'杂 货',damage:'tail'},
    {x:14,z:5.5,w:3.4,d:3.4,h:5.3,kind:'deco',side:1,main:P.ochre,trim:P.cream,sign:'',damage:null},
  ];
  const buildings=defs.map(d=>createBuilding(city,d));
  // Stair-like rooftop equipment, benches and individually planted trees add model-shop scale.
  for(const [x,z] of [[-17,-2.8],[-11,-2.8],[-4.8,-2.8],[4.8,-2.8],[11,-2.8],[17,-2.8],[-17,2.8],[-11,2.8],[-4.8,2.8],[4.8,2.8],[11,2.8],[17,2.8]])tree(city,x,z,.75);
  for(const [x,z] of [[-17,-9.2],[-11,-9.2],[-4,-9.2],[4,-9.2],[11,-9.2],[17,-9.2],[-17,9.2],[-11,9.2],[-4,9.2],[4,9.2],[11,9.2],[17,9.2]])tree(city,x,z,.55);
  const lamps=[];for(const x of [-16,-12,-9,-5,-2,2,5,9,12,16])for(const s of [-1,1]){const l=group(city,x,0,s*2.72);box(l,0,.88,0,.08,1.76,.08,P.blueDark);box(l,.14,1.78,0,.37,.08,.09,P.blueDark);box(l,.29,1.67,0,.2,.2,.19,P.lit);lamps.push(l)}
  for(const x of [-12.8,-5.8,2.1,9.2,15.3]){const s=x>3?1:-1;box(city,x,.25,s*2.87,.36,.42,.3,P.blueDark);box(city,x,.49,s*2.87,.4,.06,.35,P.stone)}
  const cars=[car(city,P.roofRed,-15,-.63,1),car(city,P.yellow,9,.68,-1),car(city,P.blue,-1,-.65,1)];
  return {city,buildings,lamps,cars,update(t){cars[0].position.x=-15+Math.min(t,20)*1.45;cars[1].position.x=9-Math.min(t,17)*1.58;cars[2].position.x=-1+Math.min(t,16)*1.33;},reset(){for(const b of buildings){b.damaged=false;b.intact.visible=true;b.ruin.visible=false}lamps.forEach(l=>{l.rotation.set(0,0,0);l.position.y=0})}};
}
