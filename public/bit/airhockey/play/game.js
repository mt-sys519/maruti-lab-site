import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/addons/loaders/GLTFLoader.js';
import {Sound} from './audio.js';

// Table units: x across (-HW..HW), z along (-HL = CPU end, +HL = player end).
const HW=0.5,HL=1.0,GW=0.16,PR=0.049,MR=0.056;
const DAMP=0.08,WALL_E=0.86,HIT_E=0.88,MAX_PUCK=11,ME_SPEED=18,STEP=1/480;
// points to win: 7, or 15 with MULTI PUCK rounds
let win=7;
// counter: how near (table units) a fast incoming puck gets before the mallet steps forward and hits it back
// instead of only blocking; smash: the share of its strikes swung at smashSpeed (MAX_PUCK is 11)
const LEVELS=[
  // EASY: blocks, taps it back, never smashes
  {speed:2.0,strike:2.6,reaction:0.18,aimErr:0.16,bank:0},
  // NORMAL: now and then a smash, but it waits for the puck
  {speed:3.3,strike:3.8,reaction:0.11,aimErr:0.08,bank:0.2,smash:0.12,smashSpeed:6.5},
  // HARD: meant to be hard to beat - quick to read, counters fast shots, smashes often and near the limit
  {speed:5.0,strike:5.4,reaction:0.05,aimErr:0.03,bank:0.45,counter:0.45,smash:0.4,smashSpeed:10},
  // watching only (CPU against CPU): HARD's shots, a slower guard so the points come
  {speed:3.6,strike:4.6,reaction:0.10,aimErr:0.04,bank:0.4,counter:0.5,smash:0.3,smashSpeed:9},
];
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
// ?v=b: the real-machine structure (center overhead score, wide one-piece rail, tapered cabinet) in our own plain red
const V_B=new URLSearchParams(location.search).get('v')==='b';
// two players on one device (the 2P button), seen flat from above
let twoP=false;

const sound=new Sound();

// ---------- scene ----------
const canvas=document.getElementById('view');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x0b0d12);
const camera=new THREE.PerspectiveCamera(38,1,0.05,50);

// (with the table and field baked, these lights fall only on the mallets and pucks: a softer sky keeps their
// colours from reading louder than the baked table's)
scene.add(new THREE.HemisphereLight(0xfdfbf4,0x2a2c38,V_B?1.1:1.5));
const sun=new THREE.DirectionalLight(0xffffff,1.7);sun.position.set(0.4,3,1.4);scene.add(sun);
// low fills so the cabinet sides and rails catch some light
const fillFront=new THREE.DirectionalLight(0xfff4e8,0.7);fillFront.position.set(0.3,0.5,3);scene.add(fillFront);
const fillSide=new THREE.DirectionalLight(0xe8f0ff,0.45);fillSide.position.set(-3,0.6,0.5);scene.add(fillSide);
// arcade ceiling: long fluorescent tubes the glossy rail, bolts and pucks can catch a highlight from.
// They must match blender/table.py's tubes (x, height, size): a reflection set elsewhere than the baked light
// read as misaligned
const TUBES={x:[-0.9,0,0.9],y:2.35,w:0.12,l:3.2};
// the red paint's gloss: seen straight down (2P) it mirrors the ceiling head-on and the red washed out to pink
// (even 0.2 lifted the red's green and blue into a dull brownish red)
const PAINT_GLOSS={flat:0},paintMats=[];
// the bake is kept a little under (so the red never clips in it, which turned the rail tops pink) and brought
// up here, where nothing clips: a rail top then shows about its own red
// (1.25 left the whole table dark; at 1.9 a rail top is a little over its own red, still well short of clipping)
const BAKE_GAIN=1.9;
let envTex=null;
if(V_B){
  const pm=new THREE.PMREMGenerator(renderer),env=new THREE.Scene();
  // a dim room under a lit ceiling (the same ceiling Blender lights the table with), so an up-facing chrome or
  // glossy face mirrors light, not black
  // (brighter than ~0.8 and the glossy playfield mirrors it as a white wash)
  env.background=new THREE.Color(0x1c1d22);
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(3,4),new THREE.MeshBasicMaterial({color:new THREE.Color(0.8,0.8,0.8),side:THREE.DoubleSide}));
  panel.position.set(0,2.4,0.4);panel.rotation.x=Math.PI/2;env.add(panel);
  // the same three tubes Blender lights the table with (TUBES), so the reflections sit over the baked light
  for(const x of TUBES.x){
    const m=new THREE.Mesh(new THREE.PlaneGeometry(TUBES.w,TUBES.l),new THREE.MeshBasicMaterial({color:new THREE.Color(5,5,5)}));
    m.position.set(x,TUBES.y,0);m.rotation.x=Math.PI/2;env.add(m);
  }
  envTex=pm.fromScene(env,0.02).texture;
  scene.environment=envTex;scene.environmentIntensity=0.5;
}

function canvasTex(w,h,draw){
  const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t;
}

const surfaceTex=canvasTex(512,1024,(g,W,H)=>{
  const px=W/(2*HW);
  g.fillStyle='#eceee6';g.fillRect(0,0,W,H);
  g.fillStyle='rgba(90,100,105,.38)';
  for(let y=12;y<H;y+=16)for(let x=12;x<W;x+=16){g.beginPath();g.arc(x,y,1.5,0,7);g.fill()}
  if(V_B){
    // only red and a soft grey on the field, and the one logo across the center line
    g.strokeStyle='rgba(120,124,130,.35)';g.lineWidth=3;
    for(const y of [H*0.25,H*0.75]){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke()}
    g.strokeStyle='#c8231c';g.lineWidth=5;
    // the logo is ~147 px wide; the line stops ~12 px (about a cap height) short of it on each side
    g.beginPath();g.moveTo(0,H/2);g.lineTo(W/2-86,H/2);g.moveTo(W/2+86,H/2);g.lineTo(W,H/2);g.stroke();
    g.lineWidth=3;
    g.beginPath();g.arc(W/2,0,GW*1.5*px,0,Math.PI);g.stroke();
    g.beginPath();g.arc(W/2,H,GW*1.5*px,Math.PI,2*Math.PI);g.stroke();
    g.fillStyle='#c8231c';g.font='800 17px "Helvetica Neue",Arial,sans-serif';g.textAlign='center';g.textBaseline='middle';
    g.letterSpacing='3px';g.fillText('AIR HOCKEY',W/2+1.5,H/2);
    return;
  }
  g.strokeStyle='rgba(42,88,201,.5)';g.lineWidth=3;
  for(const y of [H*0.25,H*0.75]){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke()}
  g.strokeStyle='#d8312b';g.lineWidth=6;
  g.beginPath();g.moveTo(0,H/2);g.lineTo(W,H/2);g.stroke();
  g.strokeStyle='#2a58c9';g.lineWidth=5;
  g.beginPath();g.arc(W/2,H/2,0.13*px,0,7);g.stroke();
  g.beginPath();g.arc(W/2,0,GW*1.5*px,0,Math.PI);g.stroke();
  g.beginPath();g.arc(W/2,H,GW*1.5*px,Math.PI,2*Math.PI);g.stroke();
});
// ?v=b goal: a low slot SLOT tall at the foot of the end rail
const SLOT=0.024;
const surface=new THREE.Mesh(new THREE.PlaneGeometry(2*HW,2*HL),
  new THREE.MeshStandardMaterial({map:surfaceTex,roughness:0.32,metalness:0}));
surface.rotation.x=-Math.PI/2;scene.add(surface);

// side rails are RT deep; the ends are END deep so the goal pocket has room for the drop
const RH=0.056,RT=V_B?0.085:0.06,END=0.1;
const railMat=new THREE.MeshStandardMaterial({color:0x23262e,roughness:0.5,metalness:0.25});
const frameMat=new THREE.MeshStandardMaterial({color:0x1d2027,roughness:0.32,metalness:0.55});
const rubberMat=new THREE.MeshStandardMaterial({color:0x0c0c0e,roughness:0.85});
const chromeMat=new THREE.MeshStandardMaterial({color:0xc9ced6,roughness:0.25,metalness:0.85});
const blackMat=new THREE.MeshBasicMaterial({color:0x050506});
const moldMat=new THREE.MeshStandardMaterial({color:0x121316,roughness:0.55});
function box(w,h,d,mat,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);scene.add(m);return m}
function cyl(r,h,mat,x,y,z,along){
  const m=new THREE.Mesh(new THREE.CapsuleGeometry(r,h,4,12),mat);m.position.set(x,y,z);
  if(along==='x')m.rotation.z=Math.PI/2;else if(along==='z')m.rotation.x=Math.PI/2;
  scene.add(m);return m;
}

// goal pocket: the rail opens full height into a black pocket, framed in chrome like the real machine
// the playfield runs on into the opening, then drops away into a black hole
const pocketTex=canvasTex(128,128,(g,W,H)=>{
  g.fillStyle='#000';g.fillRect(0,0,W,H);
  const lip=H*0.14;
  g.fillStyle='#e4e6de';g.fillRect(0,H-lip,W,lip);
  g.fillStyle='rgba(90,100,105,.38)';
  for(let y=H-lip+6;y<H;y+=10)for(let x=6;x<W;x+=10){g.beginPath();g.arc(x,y,1.2,0,7);g.fill()}
  const r=g.createLinearGradient(0,H-lip,0,H-lip+10);
  r.addColorStop(0,'rgba(0,0,0,.55)');r.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=r;g.fillRect(0,H-lip,W,10);
});

if(!V_B){
// rails: an extruded profile (upright inner face, rounded top, sloped outer face) in dark anodized metal,
// a black rubber bumper on the inside and a chrome strip along the top
function railGeo(depth,len){
  const s=new THREE.Shape();
  s.moveTo(0,0);s.lineTo(0,RH-0.014);s.quadraticCurveTo(0,RH,0.014,RH);
  s.lineTo(depth-0.024,RH);s.quadraticCurveTo(depth,RH,depth,RH-0.022);s.lineTo(depth,0);s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:len,bevelEnabled:false,curveSegments:8});
  g.translate(0,0,-len/2);return g;
}
function railTrim(group,depth,len){
  const bump=new THREE.Mesh(new THREE.BoxGeometry(0.005,0.026,len),rubberMat);bump.position.set(-0.0025,0.016,0);
  const strip=new THREE.Mesh(new THREE.BoxGeometry((depth-0.04)*0.55,0.004,len),chromeMat);strip.position.set(0.014+(depth-0.04)/2,RH+0.001,0);
  group.add(bump,strip);
}
function rail(depth,len,x,z,alongX,flip){
  const grp=new THREE.Group();
  grp.add(new THREE.Mesh(railGeo(depth,len),frameMat));railTrim(grp,depth,len);
  grp.position.set(x,0,z);
  // local +x is outward from the playfield, local z runs along the rail
  if(alongX)grp.rotation.y=flip?Math.PI/2:-Math.PI/2;
  else if(flip)grp.rotation.y=Math.PI;
  scene.add(grp);return grp;
}
for(const s of [-1,1]){
  rail(RT,2*(HL+END),s*HW,0,false,s<0);
  for(const k of [-1,1])rail(END,HW-GW,k*(GW+HW)/2,s*HL,true,s<0);
  // chrome jambs either side of the opening
  for(const k of [-1,1])box(0.01,RH+0.004,END,chromeMat,k*(GW+0.005),(RH+0.004)/2,s*(HL+END/2));
  // pocket: the playfield's lip, then the black drop, a black back wall and a chrome bar along its top
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(2*GW,END),new THREE.MeshBasicMaterial({map:pocketTex}));
  floor.rotation.x=-Math.PI/2;if(s>0)floor.rotation.z=Math.PI;
  floor.position.set(0,0.0006,s*(HL+END/2));scene.add(floor);
  box(2*GW,RH,0.008,blackMat,0,RH/2,s*(HL+END-0.004));
  box(2*GW+0.02,0.01,0.01,chromeMat,0,RH+0.001,s*(HL+END-0.004));
}

// cabinet: red laminate apron with arcade stripes, chrome edge band, black T-molding and corner caps
const CW=2*HW+2*RT+0.04,CL=2*HL+2*END+0.04,AH=0.18;
function stripes(g,W,H){
  const r=g.createLinearGradient(0,0,0,H);
  r.addColorStop(0,'#b8261f');r.addColorStop(1,'#7d1715');
  g.fillStyle=r;g.fillRect(0,0,W,H);
  for(const [y0,y1,c] of [[0.6,0.68,'#f2c230'],[0.71,0.76,'#f07b23'],[0.79,0.815,'#f6e7c8']]){
    g.fillStyle=c;g.fillRect(0,H*y0,W,H*(y1-y0));
  }
  // a little wear along the top edge
  g.fillStyle='rgba(0,0,0,.18)';g.fillRect(0,0,W,H*0.04);
}
const sideTex=canvasTex(2048,180,(g,W,H)=>{
  stripes(g,W,H);
  g.save();g.translate(W*0.07,H*0.47);g.transform(1,0,-0.22,1,0,0);
  g.font='900 70px "Arial Black",Impact,Arial,sans-serif';g.textBaseline='alphabetic';
  g.fillStyle='rgba(0,0,0,.35)';g.fillText('AIR HOCKEY',5,5);
  g.fillStyle='#fff6e6';g.fillText('AIR HOCKEY',0,0);
  g.restore();
});
const endTex=canvasTex(1024,180,(g,W,H)=>{
  stripes(g,W,H);
  // coin door
  const dw=W*0.3,dx=(W-dw)/2,dy=H*0.12,dh=H*0.76;
  g.fillStyle='#9ea4ad';g.fillRect(dx-6,dy-6,dw+12,dh+12);
  g.fillStyle='#16171a';g.fillRect(dx,dy,dw,dh);
  for(const cx of [dx+dw*0.3,dx+dw*0.7]){
    g.fillStyle='#ff9a2a';g.shadowColor='#ff7a1a';g.shadowBlur=14;
    g.fillRect(cx-9,dy+dh*0.22,18,dh*0.34);g.shadowBlur=0;
    g.fillStyle='#000';g.fillRect(cx-2,dy+dh*0.25,4,dh*0.28);
  }
  g.fillStyle='#cfcfcf';g.font='700 15px Arial,sans-serif';g.textAlign='center';
  g.fillText('INSERT COIN',W/2,dy+dh*0.82);
});
const lam=t=>new THREE.MeshPhysicalMaterial({map:t,roughness:0.5,clearcoat:0.7,clearcoatRoughness:0.25});
const topMat=new THREE.MeshStandardMaterial({color:0x8f1d1c,roughness:0.5});
const apron=new THREE.Mesh(new THREE.BoxGeometry(CW,AH,CL),[lam(sideTex),lam(sideTex),topMat,moldMat,lam(endTex),lam(endTex)]);
apron.position.set(0,-AH/2-0.001,0);scene.add(apron);
// chrome band round the top edge, black molding along the bottom
for(const s of [-1,1]){
  box(0.006,0.02,CL,chromeMat,s*(CW/2+0.003),-0.011,0);
  box(CW,0.02,0.006,chromeMat,0,-0.011,s*(CL/2+0.003));
  cyl(0.009,CL,moldMat,s*CW/2,-AH+0.004,0,'z');
  cyl(0.009,CW,moldMat,0,-AH+0.004,s*CL/2,'x');
}
for(const sx of [-1,1])for(const sz of [-1,1]){
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(0.024,0.024,AH+0.012,20),moldMat);
  cap.position.set(sx*CW/2,-AH/2,sz*CL/2);scene.add(cap);
}
// legs
for(const sx of [-1,1])for(const sz of [-1,1])box(0.06,0.6,0.06,moldMat,sx*(CW/2-0.08),-AH-0.3,sz*(CL/2-0.12));
for(const sz of [-1,1])box(CW-0.16,0.04,0.04,moldMat,0,-AH-0.48,sz*(CL/2-0.12));
}

// scoreboard over the far end
const SEG={0:'abcdef',1:'bc',2:'abged',3:'abgcd',4:'fgbc',5:'afgcd',6:'afgedc',7:'abc',8:'abcdefg',9:'abcdfg'};
const scoreCanvas=document.createElement('canvas');scoreCanvas.width=512;scoreCanvas.height=160;
const scoreTex=new THREE.CanvasTexture(scoreCanvas);scoreTex.colorSpace=THREE.SRGBColorSpace;
function digit(g,n,x,y,w,h,on){
  const t=w*0.17,v=h/2-1.5*t;
  const R={a:[x+t,y,w-2*t,t],b:[x+w-t,y+t,t,v],c:[x+w-t,y+h/2+t/2,t,v],d:[x+t,y+h-t,w-2*t,t],
    e:[x,y+h/2+t/2,t,v],f:[x,y+t,t,v],g:[x+t,y+h/2-t/2,w-2*t,t]};
  for(const k in R){
    const lit=on&&n>=0&&SEG[n].includes(k);
    g.fillStyle=lit?'#ff3424':'#1d0807';g.shadowColor='#ff2a1a';g.shadowBlur=lit?16:0;
    g.fillRect(...R[k]);
  }
  g.shadowBlur=0;
}
// a 7-segment digit as LEDs under the playfield: soft red light, the unlit segments a faint ghost
function fieldDigit(g,n,x,y,w,h,on){
  const t=w*0.2,v=h/2-1.5*t,r=t/2;
  const R={a:[x+t,y,w-2*t,t],b:[x+w-t,y+t,t,v],c:[x+w-t,y+h/2+t/2,t,v],d:[x+t,y+h-t,w-2*t,t],
    e:[x,y+h/2+t/2,t,v],f:[x,y+t,t,v],g:[x+t,y+h/2-t/2,w-2*t,t]};
  for(const k in R){
    const lit=on&&SEG[n].includes(k),[sx,sy,sw,sh]=R[k];
    g.fillStyle=lit?'#ff2a1c':'rgba(255,42,28,.07)';g.shadowColor='rgba(255,40,24,.9)';g.shadowBlur=lit?28:0;
    g.beginPath();g.roundRect(sx+2,sy+2,sw-4,sh-4,r);g.fill();
  }
  g.shadowBlur=0;
}
function drawScore(a,b,hide=-1){
  const g=scoreCanvas.getContext('2d');
  g.fillStyle='#060607';g.fillRect(0,0,512,160);
  g.fillStyle='#6d6d72';g.font='600 20px Helvetica,Arial,sans-serif';g.textAlign='center';
  g.fillText('YOU',140,30);g.fillText('CPU',372,30);
  if(win>9){
    // two digits a side, the tens left dark under 10
    for(const [v,x0,i] of [[a,82,0],[b,314,1]]){
      digit(g,v>=10?Math.floor(v/10):-1,x0,44,52,100,hide!==i);digit(g,v%10,x0+64,44,52,100,hide!==i);
    }
  }else{digit(g,a,110,44,60,100,hide!==0);digit(g,b,342,44,60,100,hide!==1)}
  g.fillStyle='#2a2a2e';g.fillRect(251,86,10,10);g.fillRect(251,112,10,10);
  scoreTex.needsUpdate=true;
  fieldScore?.draw(a,b,hide);
}
// ?v=b: no board overhead; after each goal the score glows up through the playfield, each side in its own half
let fieldScore=null;
drawScore(0,0);
if(!V_B){
  const board=new THREE.Group();board.position.set(0,0.25,-HL-END-0.06);board.rotation.x=-0.38;scene.add(board);
  board.add(new THREE.Mesh(new THREE.BoxGeometry(0.64,0.22,0.04),railMat));
  const face=new THREE.Mesh(new THREE.PlaneGeometry(0.6,0.1875),new THREE.MeshBasicMaterial({map:scoreTex}));
  face.position.z=0.021;board.add(face);
  for(const s of [-1,1]){
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.008,0.9,10),chromeMat);
    pole.position.set(s*0.3,-0.2,-HL-END-0.07);scene.add(pole);
  }
}

// ---------- casing B ----------
// the cabinet top is exactly the rail's outline, so nothing sticks out round the rail
const CAB={w:2*(HW+RT),l:2*(HL+END),r:0.11+0.006,h:0.3,taper:0.86};
let gate=null,endBoard=null;
if(V_B){
  const railRed=new THREE.MeshStandardMaterial({color:0xc8231c,roughness:0.34,metalness:0.05});
  const cabRed=new THREE.MeshStandardMaterial({color:0x9e1a15,roughness:0.55});
  const graphite=new THREE.MeshStandardMaterial({color:0x1b1c20,roughness:0.45,metalness:0.25});
  const BV=0.006,ND=END-0.022;

  // one continuous rail: wide flat top, big rounded outer corners, notched for the goals
  const OW=2*(HW+RT)-2*BV,OL=2*(HL+END)-2*BV,OR=0.11;
  const ring=new THREE.Shape();
  {
    const x=-OW/2,y=-OL/2,w=OW,h=OL,r=OR;
    ring.moveTo(x+r,y);ring.lineTo(x+w-r,y);ring.quadraticCurveTo(x+w,y,x+w,y+r);
    ring.lineTo(x+w,y+h-r);ring.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ring.lineTo(x+r,y+h);ring.quadraticCurveTo(x,y+h,x,y+h-r);
    ring.lineTo(x,y+r);ring.quadraticCurveTo(x,y,x+r,y);
  }
  // the bevel shrinks the hole, so cut it a bevel wider
  const hw=HW+BV,hl=HL+BV,hole=new THREE.Path();
  hole.moveTo(-hw,-hl);hole.lineTo(hw,-hl);hole.lineTo(hw,hl);hole.lineTo(-hw,hl);hole.lineTo(-hw,-hl);
  ring.holes.push(hole);
  const ringGeo=new THREE.ExtrudeGeometry(ring,{depth:RH-2*BV,bevelEnabled:true,bevelThickness:BV,bevelSize:BV,bevelSegments:3,curveSegments:16});
  ringGeo.rotateX(-Math.PI/2);
  const rails=new THREE.Mesh(ringGeo,railRed);rails.position.y=BV;scene.add(rails);

  // small steel bolt heads along the rail top
  const boltGeo=new THREE.CylinderGeometry(0.0065,0.0065,0.003,14);
  const bolt=(x,z)=>{const b=new THREE.Mesh(boltGeo,chromeMat);b.position.set(x,RH+0.0015,z);scene.add(b)};
  for(const s of [-1,1]){
    for(let z=-HL+0.1;z<=HL-0.1+1e-6;z+=(2*HL-0.2)/8)bolt(s*(HW+RT/2),z);
    for(const x of [-0.4,-0.27,0.27,0.4])bolt(x,s*(HL+END*0.55));
  }

  // goal: a low slot at the foot of the end rail, black inside, and over it a steel strip bent round the rail's
  // edge (inner face and top), the goal's width, so it reads from either end
  const pitMat=new THREE.MeshBasicMaterial({color:0x000000});
  const trim=new THREE.Shape();
  {
    // (u, y): u outward from the playfield's edge
    const t=0.0035,ri=BV,ro=BV+t,cu=ri,cy=RH-ri;
    trim.moveTo(-t,SLOT);
    for(let i=0;i<=6;i++){const a=Math.PI-Math.PI/2*i/6;trim.lineTo(cu+ro*Math.cos(a),cy+ro*Math.sin(a))}
    trim.lineTo(0.034,RH+t);trim.lineTo(0.034,RH);
    for(let i=0;i<=6;i++){const a=Math.PI/2+Math.PI/2*i/6;trim.lineTo(cu+ri*Math.cos(a),cy+ri*Math.sin(a))}
    trim.lineTo(0,SLOT);
  }
  for(const s of [-1,1]){
    const m=new THREE.Mesh(new THREE.BoxGeometry(2*GW,SLOT,0.04),pitMat);m.position.set(0,SLOT/2,s*(HL+0.018));scene.add(m);
    const g=new THREE.ExtrudeGeometry(trim,{depth:2*GW,bevelEnabled:false});g.translate(0,0,-GW);g.rotateY(-s*Math.PI/2);
    const pl=new THREE.Mesh(g,chromeMat);pl.position.z=s*HL;scene.add(pl);
  }

  // cabinet: plain red, a rounded rectangle under the rail that narrows toward the floor
  {
    const n=160,o=new THREE.Shape(),x=-CAB.w/2,y=-CAB.l/2,w=CAB.w,h=CAB.l,r=CAB.r;
    o.moveTo(x+r,y);o.lineTo(x+w-r,y);o.quadraticCurveTo(x+w,y,x+w,y+r);
    o.lineTo(x+w,y+h-r);o.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    o.lineTo(x+r,y+h);o.quadraticCurveTo(x,y+h,x,y+h-r);
    o.lineTo(x,y+r);o.quadraticCurveTo(x,y,x+r,y);
    const ring=o.getSpacedPoints(n).slice(0,n),pos=[],idx=[];
    for(const p of ring)pos.push(p.x,0,p.y);
    for(const p of ring)pos.push(p.x*CAB.taper,-CAB.h,p.y*CAB.taper);
    for(let i=0;i<n;i++){const j=(i+1)%n;idx.push(i,j,i+n,j,j+n,i+n)}
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
    const cab=new THREE.Mesh(g,cabRed);cab.position.y=-0.001;scene.add(cab);
  }
  // legs with steel feet
  const legGeo=new THREE.CylinderGeometry(0.06,0.042,0.5,4,1);legGeo.rotateY(Math.PI/4);
  for(const sx of [-1,1])for(const sz of [-1,1]){
    const x=sx*(CAB.w/2*CAB.taper-0.08),z=sz*(CAB.l/2*CAB.taper-0.12);
    const leg=new THREE.Mesh(legGeo,graphite);leg.position.set(x,-CAB.h-0.25,z);scene.add(leg);
    const foot=new THREE.Mesh(new THREE.CylinderGeometry(0.032,0.036,0.02,20),chromeMat);foot.position.set(x,-CAB.h-0.51,z);scene.add(foot);
  }

  // landscape: scoreboard on a thin black gate over the center line, readable from both ends
  gate=new THREE.Group();scene.add(gate);
  const gx=CAB.w/2+0.016,top=0.64;
  for(const s of [-1,1]){
    const post=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,top+0.2,14),graphite);
    post.position.set(s*gx,(top-0.2)/2,0);gate.add(post);
  }
  const beam=new THREE.Mesh(new THREE.BoxGeometry(2*gx+0.024,0.024,0.024),graphite);beam.position.y=top;gate.add(beam);
  const sb=new THREE.Mesh(new THREE.BoxGeometry(0.62,0.19,0.07),graphite);sb.position.y=top-0.11;gate.add(sb);
  for(const s of [-1,1]){
    const f=new THREE.Mesh(new THREE.PlaneGeometry(0.58,0.17),new THREE.MeshBasicMaterial({map:scoreTex}));
    f.position.z=s*0.036;if(s<0)f.rotation.y=Math.PI;sb.add(f);
  }
  // portrait: seen from above the gate would sit on the field, so the board stands at the far end instead
  endBoard=new THREE.Group();scene.add(endBoard);
  const eb=new THREE.Group();eb.position.set(0,0.25,-CAB.l/2-0.05);eb.rotation.x=-0.38;endBoard.add(eb);
  eb.add(new THREE.Mesh(new THREE.BoxGeometry(0.64,0.22,0.04),graphite));
  const ef=new THREE.Mesh(new THREE.PlaneGeometry(0.6,0.1875),new THREE.MeshBasicMaterial({map:scoreTex}));
  ef.position.z=0.021;eb.add(ef);
  for(const s of [-1,1]){
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.9,14),graphite);
    pole.position.set(s*0.3,-0.2,-CAB.l/2-0.06);endBoard.add(pole);
  }

  // the Blender-built casing (blender/table.py) replaces all of the above once it loads; until then, or if it
  // fails, the code-built one stands in. The digit faces stay the game's own planes.
  // the score, lit from under the playfield: one LED panel per half, dark in play, lit for a moment after each goal
  fieldScore={
    sides:[0,1].map(i=>{
      const c=document.createElement('canvas');c.width=512;c.height=512;
      const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=renderer.capabilities.getMaxAnisotropy();
      const m=new THREE.Mesh(new THREE.PlaneGeometry(2*HW,HL),new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:0,depthWrite:false}));
      m.rotation.x=-Math.PI/2;m.position.set(0,0.0004,i===0?HL/2:-HL/2);scene.add(m);
      return {c,tex,m,show:0};
    }),
    draw(a,b,hide){
      [a,b].forEach((v,i)=>{
        const S=this.sides[i],g=S.c.getContext('2d'),on=hide!==i;
        g.clearRect(0,0,512,512);
        // both read upright from the player's end, a little toward the center line;
        // in 2P the far half turns round to read upright for player 2
        const turn=twoP&&i===1;
        g.save();if(turn){g.translate(256,256);g.rotate(Math.PI);g.translate(-256,-256)}
        const cy=i===0||turn?0.42*512:0.58*512,w=112,h=220,gap=34;
        const ds=v>=10?[Math.floor(v/10),v%10]:[v];
        const x0=256-(ds.length*w+(ds.length-1)*gap)/2;
        ds.forEach((d,k)=>fieldDigit(g,d,x0+k*(w+gap),cy-h/2,w,h,on));
        g.restore();
        S.tex.needsUpdate=true;
      });
    },
  };
  fieldScore.draw(0,0);
  // the chrome's own room to mirror: a dim ceiling lined with bright tubes, light grey walls with a bright band
  // at eye height, a dark floor. Nothing in it is black where a trim's top or its field-side edge looks, so the
  // metal can be a sharp mirror (stronger than the red paint's gloss, as metal should be) without black patches
  const chromeEnv=(()=>{
    const pm=new THREE.PMREMGenerator(renderer),room=new THREE.Scene();
    room.background=new THREE.Color(0.42,0.43,0.46);
    const flat=(w,d,c,y)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({color:new THREE.Color(c,c,c),side:THREE.DoubleSide}));
      m.position.y=y;m.rotation.x=Math.PI/2;room.add(m);return m};
    // (with only the three tubes most of a trim mirrors the ceiling between them: at 0.3 it read dark grey)
    flat(12,12,0.75,2.4);flat(12,12,0.08,-1.2);
    for(const x of TUBES.x)flat(TUBES.w,TUBES.l,6,TUBES.y).position.x=x;
    const band=new THREE.Mesh(new THREE.CylinderGeometry(5,5,0.5,48,1,true),
      new THREE.MeshBasicMaterial({color:new THREE.Color(1.8,1.8,1.8),side:THREE.BackSide}));
    band.position.y=0.6;room.add(band);
    return pm.fromScene(room,0.01).texture;
  })();
  const proxyMats=[railRed,cabRed,graphite,chromeMat,pitMat,blackMat];
  if(!location.search.includes('proxy')){
    new GLTFLoader().load('models/table.glb',gltf=>{
      for(const m of proxyMats)m.visible=false;
      // the atlas already holds the table lit by Blender's ceiling (bake.py: albedo x light), so it is shown as
      // it is (emissive) and the scene's lights add only gloss and reflections. Chrome keeps its baked silver
      // as colour so its reflections stay silver
      gltf.scene.traverse(o=>{
        if(!o.isMesh||!o.material.map)return;
        const m=o.material;
        // chrome (goal trims, bolts, feet): a polished metal mirroring chromeEnv. Not the bake (its tiny islands in
        // the atlas bled in blotches), not the room's env (its dark walls turned the field-side edge grey and the
        // top white), not a matcap (a painted gloss that never moves, weaker than the red paint's)
        if(/chrome/.test(o.name)){
          o.material=new THREE.MeshStandardMaterial({color:0xe6e9ee,metalness:1,roughness:0.12,envMap:chromeEnv,envMapIntensity:1});
          return;
        }
        m.emissiveMap=m.map;m.emissive.set(0xffffff);m.emissiveIntensity=BAKE_GAIN;m.color.set(0x000000);
        // the red paint is glossy: the ceiling tubes run along the rail tops as thin white lines
        if(/paint/.test(o.name)){m.roughness=0.1;m.envMap=envTex;m.envMapIntensity=twoP?PAINT_GLOSS.flat:1;paintMats.push(m)}
        m.needsUpdate=true;
      });
      for(const node of [...gltf.scene.children]){
        const part=node.name.split(/[|_]/)[0];
        (part==='gate'?gate:part==='endboard'?endBoard:scene).attach(node);
      }
    },undefined,e=>console.warn('table.glb:',e));
    // the playfield under the same lamps as the table: Blender's light on it (rail shadows and all) multiplied
    // into the field's canvas, shown as it is like the table; only a faint gloss comes from the scene
    new THREE.ImageLoader().load('models/field-light.png',img=>{
      const src=surfaceTex.image,c=document.createElement('canvas');c.width=src.width;c.height=src.height;
      const g=c.getContext('2d');g.drawImage(src,0,0);g.globalCompositeOperation='multiply';g.drawImage(img,0,0,c.width,c.height);
      const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();
      // (lit in real time the field used to read a touch brighter than its own colour; 1.06 keeps that)
      const m=surface.material;m.emissiveMap=t;m.emissive.set(0xffffff);m.emissiveIntensity=1.06;m.color.set(0x000000);
      m.envMap=envTex;m.envMapIntensity=0.25;m.needsUpdate=true;
    });
  }
}

// blob shadows
const shadowTex=canvasTex(128,128,(g)=>{
  const r=g.createRadialGradient(64,64,0,64,64,64);
  r.addColorStop(0,'rgba(0,0,0,.42)');r.addColorStop(0.55,'rgba(0,0,0,.25)');r.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=r;g.fillRect(0,0,128,128);
});
function blob(size){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(size,size),
    new THREE.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false}));
  m.rotation.x=-Math.PI/2;scene.add(m);return m;
}

// mallets: a disc and a short flat-topped knob
const malletGeo=new THREE.LatheGeometry([
  [0,0],[MR-0.004,0],[MR,0.004],[MR,0.016],[MR-0.004,0.02],[MR*0.46,0.02],[MR*0.46,0.054],[MR*0.43,0.058],[0,0.058],
].map(([x,y])=>new THREE.Vector2(x,y)),56);
function malletMesh(color){
  // glossy moulded plastic under the same three ceiling tubes as the table (a clear coat mirrors them)
  const m=new THREE.Mesh(malletGeo,new THREE.MeshPhysicalMaterial({color,roughness:0.45,clearcoat:0.7,clearcoatRoughness:0.08,
    envMap:envTex,envMapIntensity:1}));
  scene.add(m);return m;
}
const meMesh=malletMesh(0x2d63d8),cpuMesh=malletMesh(0xf0b72a);
const meShadow=blob(MR*2.8),cpuShadow=blob(MR*2.8);
// puck: glossy red polycarbonate, chamfered edge and a shallow ring pressed into the top
const PH=0.013,PUCK_RED=new THREE.Color(0xd8261f);
const puckGeo=new THREE.LatheGeometry([
  [0,0],[PR-0.003,0],[PR,0.003],[PR,PH-0.003],[PR-0.003,PH],[PR*0.8,PH],[PR*0.77,PH-0.0018],[PR*0.7,PH-0.0018],[PR*0.67,PH],[0,PH],
].map(([x,y])=>new THREE.Vector2(x,y)),64);
// up to three pucks for MULTI PUCK; pucks[0] is the one used in normal play
const pucks=[0,1,2].map(()=>{
  const mesh=new THREE.Mesh(puckGeo,new THREE.MeshPhysicalMaterial({color:0xd8261f,roughness:0.32,clearcoat:0.8,clearcoatRoughness:0.08,
    envMap:envTex,envMapIntensity:1}));
  mesh.visible=false;scene.add(mesh);
  return {x:0,z:0,vx:0,vz:0,y:0,tilt:0,shade:1,live:false,visible:false,anim:null,mesh,shadow:blob(PR*2.8),hist:[]};
});
const puck=pucks[0];
puck.visible=true;

// ---------- camera fit ----------
const fitPts=[
  [-HW-RT,0,HL+END],[HW+RT,0,HL+END],[-HW-RT,0,-HL-END],[HW+RT,0,-HL-END],
  [-HW-RT,-0.07,HL+END],[HW+RT,-0.07,HL+END],
].map(p=>new THREE.Vector3(...p));
// the scoreboard's top corners: over the center (gate) or at the far end
const gatePts=[[-0.31,0.65,0],[0.31,0.65,0]].map(p=>new THREE.Vector3(...p));
const endPts=[[-0.33,0.36,-HL-END-0.03],[0.33,0.36,-HL-END-0.03]].map(p=>new THREE.Vector3(...p));
const EYE={h:0.75,back:0.35,look:-0.15};
const camBase=new THREE.Vector3();
// 2P on one device: the table seen straight down, flat, its length along the screen's long side.
// Portrait: player 1 (+z) at the bottom. Landscape: player 1 on the right, player 2 on the left
const flat=new THREE.OrthographicCamera(-1,1,1,-1,0.1,10);
function fitFlat(w,h){
  const land=w>h,m=1.03,A=w/h,ax=(HW+RT)*m,az=(HL+END)*m;
  let hw=land?az:ax,hh=land?ax:az;
  if(hw/hh<A)hw=hh*A;else hh=hw/A;
  Object.assign(flat,{left:-hw,right:hw,top:hh,bottom:-hh});
  // looking down -y: up (0,0,-1) puts +x to the right; up (1,0,0) puts +z to the right
  flat.position.set(0,3,0);flat.up.set(land?1:0,0,land?0:-1);flat.lookAt(0,0,0);
  flat.updateProjectionMatrix();flat.updateMatrixWorld();
  document.body.classList.toggle('land',land);
}
// 2P: the pause button sits on the left rail at the center line - off the playfield, in neither player's half,
// in reach of both. Placed from the flat camera, so it follows the table in portrait and landscape alike
function placePause(){
  const b=document.getElementById('pause');
  if(!twoP){b.style.left=b.style.top='';return}
  const v=new THREE.Vector3(-(HW+RT/2),0.06,0).project(flat);
  b.style.left=`${(v.x+1)/2*innerWidth}px`;b.style.top=`${(1-v.y)/2*innerHeight}px`;
}
let redraw=true;
function fit(){
  redraw=true;
  const w=innerWidth,h=innerHeight;
  renderer.setSize(w,h,false);
  fitFlat(w,h);
  camera.aspect=w/h;camera.clearViewOffset();
  const portrait=h>w;
  if(gate){gate.visible=false;endBoard.visible=false}
  const pts=V_B?fitPts:[...fitPts,...endPts];
  // a tall phone plays best from high above, almost a top view
  camera.fov=38;
  const elev=1.13,target=new THREE.Vector3(0,0,0.05);
  const dir=new THREE.Vector3(0,Math.sin(elev),Math.cos(elev));
  const place=d=>{camera.position.copy(target).addScaledVector(dir,d);camera.lookAt(target);
    camera.updateProjectionMatrix();camera.updateMatrixWorld()};
  const bounds=()=>{let x0=9,x1=-9,y0=9,y1=-9;
    for(const p of pts){if(!portrait&&p.y<0)continue;const v=p.clone().project(camera);x0=Math.min(x0,v.x);x1=Math.max(x1,v.x);y0=Math.min(y0,v.y);y1=Math.max(y1,v.y)}
    return {x0,x1,y0,y1}};
  const fits=b=>b.x1-b.x0<1.9&&b.y1-b.y0<1.86;
  if(portrait){
    let lo=0.5,hi=30;
    for(let i=0;i<32;i++){const d=(lo+hi)/2;place(d);if(fits(bounds()))hi=d;else lo=d}
    place(hi);
  }else{
    // a person's eyes: ~75cm above the table, a step back from the near rail; widen the lens until it all fits
    camera.position.set(0,EYE.h,HL+END+EYE.back);camera.lookAt(0,0,EYE.look);
    let lo=20,hi=110;
    for(let i=0;i<32;i++){camera.fov=(lo+hi)/2;camera.updateProjectionMatrix();camera.updateMatrixWorld();
      if(fits(bounds()))hi=camera.fov;else lo=camera.fov}
    camera.fov=hi;camera.updateProjectionMatrix();
  }
  const b=bounds(),cy=(b.y0+b.y1)/2;
  camera.setViewOffset(w,h,0,-cy*h/2,w,h);
  camBase.copy(camera.position);
  placePause();
}
addEventListener('resize',fit);fit();

// ---------- state ----------
const me={x:0,z:HL-0.2,vx:0,vz:0,tx:0,tz:HL-0.2,sx:0,sz:HL-0.2,maxV:0};
const cpu={x:0,z:-HL+0.2,vx:0,vz:0,tx:0,tz:-HL+0.2,maxV:3};
let level=1,mode='menu',score=[0,0],gameTime=0,timers=[];
// multi: the MULTI PUCK round in play; nextMulti: the total score that brings the next one
let multi=false,nextMulti=6;
const after=(sec,fn)=>timers.push({t:gameTime+sec,fn});
const livePucks=()=>pucks.filter(p=>p.live);

// ---------- physics ----------
const lastSnd={};
function snd(key,v,x,kind){
  if(v<0.12)return;
  const t=performance.now();if(t-(lastSnd[key]||0)<45)return;lastSnd[key]=t;
  sound.hit(v,x,kind);
}
function capPuck(p){
  const s=Math.hypot(p.vx,p.vz);
  if(s>MAX_PUCK){p.vx*=MAX_PUCK/s;p.vz*=MAX_PUCK/s}
}
function moveMallet(m,maxV,h,zMin,zMax){
  const tx=clamp(m.sx??m.tx,-HW+MR,HW-MR),tz=clamp(m.sz??m.tz,zMin,zMax);
  let dx=tx-m.x,dz=tz-m.z;const d=Math.hypot(dx,dz),lim=maxV*h;
  if(d>lim){dx*=lim/d;dz*=lim/d}
  m.vx=dx/h;m.vz=dz/h;m.x+=dx;m.z+=dz;
}
function collideMallet(m,who,p){
  const dx=p.x-m.x,dz=p.z-m.z,d=Math.hypot(dx,dz),min=PR+MR;
  if(d>=min)return;
  const nx=d>1e-6?dx/d:0,nz=d>1e-6?dz/d:(who===0?-1:1);
  p.x=m.x+nx*min;p.z=m.z+nz*min;
  const vn=(p.vx-m.vx)*nx+(p.vz-m.vz)*nz;
  if(vn<0){
    // a gentle touch nudges the puck; only a real swing gets the full bounce
    const e=0.35+(HIT_E-0.35)*clamp(-vn/3,0,1);
    p.vx-=(1+e)*vn*nx;p.vz-=(1+e)*vn*nz;capPuck(p);
    const t=performance.now();
    if(!pinned(p)&&-vn>=0.12&&t-(lastSnd['m'+who]||0)>=45){
      lastSnd['m'+who]=t;sound.hit(-vn,p.x,'mallet');
    }
    if(who===0&&-vn>0.8&&navigator.vibrate&&navigator.userActivation?.hasBeenActive)navigator.vibrate(Math.round(6+Math.min(1,-vn/5)*10));
  }
}
function separate(m,zMin,zMax,p){
  const dx=p.x-m.x,dz=p.z-m.z,d=Math.hypot(dx,dz),min=PR+MR;
  if(d<min&&d>1e-6){
    m.x=clamp(p.x-dx/d*min,-HW+MR,HW-MR);m.z=clamp(p.z-dz/d*min,zMin,zMax);
  }
}
// a puck a mallet holds pressed into the rail is pinned: the two shove it back and forth every step, which
// rattled out a hit every 45 ms. A pinned puck is silent until it has been free for a moment
const pinned=p=>gameTime-(p.pinT??-1)<0.12;
function collidePoint(p,px,pz){
  const dx=p.x-px,dz=p.z-pz,d=Math.hypot(dx,dz);
  if(d>=PR||d<1e-6)return;
  const nx=dx/d,nz=dz/d;p.x=px+nx*PR;p.z=pz+nz*PR;
  const vn=p.vx*nx+p.vz*nz;
  if(vn<0){if(!pinned(p))snd('post',-vn,p.x,'post');p.vx-=(1+WALL_E)*vn*nx;p.vz-=(1+WALL_E)*vn*nz}
}
// pucks knock each other like billiard balls
function collidePucks(a,b){
  const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),min=2*PR;
  if(d>=min||d<1e-6)return;
  const nx=dx/d,nz=dz/d,push=(min-d)/2;
  a.x-=nx*push;a.z-=nz*push;b.x+=nx*push;b.z+=nz*push;
  const vn=(b.vx-a.vx)*nx+(b.vz-a.vz)*nz;
  if(vn<0){
    const j=-(1+0.9)*vn/2;
    a.vx-=j*nx;a.vz-=j*nz;b.vx+=j*nx;b.vz+=j*nz;
    snd('pp',-vn,(a.x+b.x)/2,'post');
  }
}
// the air never lets a slow puck settle: a gentle push whose direction wanders, fading out as the puck speeds up
const DRIFT=0.05,DRIFT_V=0.6,DRIFT_TURN=2.2;
function stepPuck(p,h){
  const k=Math.exp(-DAMP*h);p.vx*=k;p.vz*=k;
  if(Math.abs(p.z)<HL){
    p.wa=(p.wa??Math.random()*7)+(Math.random()-0.5)*DRIFT_TURN*Math.sqrt(h)*3.46;
    const a=DRIFT*clamp(1-Math.hypot(p.vx,p.vz)/DRIFT_V,0,1)*h;
    p.vx+=Math.cos(p.wa)*a;p.vz+=Math.sin(p.wa)*a;
  }
  p.x+=p.vx*h;p.z+=p.vz*h;
  railPuck(p);
  // a goal once the whole puck is past the lip, stopped right there: the slot is only END deep, and a puck
  // let run on (it used to go to HL+1.2·PR and a step beyond) showed its edge outside the cabinet
  const gz=HL+PR;
  if(Math.abs(p.z)>gz){p.z=Math.sign(p.z)*gz;goal(p.z<0?0:1,p)}
}
// the rails and the goal posts. Run after the puck moves, and again after a mallet has pushed it out: a mallet
// pressing a puck into a corner used to push it straight through the rail into the frame
function railPuck(p){
  const x0=p.x,z0=p.z,q=pinned(p);
  // in the slot only through the mouth: a puck a mallet shoved past the end rail beside the mouth (pressed into
  // a corner) is put back by the rail, not taken into the slot (which made it a goal)
  const inMouth=Math.abs(p.x)<GW,beyond=Math.abs(p.z)>HL&&inMouth;
  if(beyond){
    // inside the goal slot
    const lim=GW-PR;
    if(Math.abs(p.x)>lim){p.x=Math.sign(p.x)*lim;p.vx*=-0.5}
  }else{
    if(p.x<-HW+PR){p.x=-HW+PR;if(p.vx<0){if(!q)snd('wall',-p.vx,p.x,'wall');p.vx*=-WALL_E}}
    if(p.x>HW-PR){p.x=HW-PR;if(p.vx>0){if(!q)snd('wall',p.vx,p.x,'wall');p.vx*=-WALL_E}}
    if(!inMouth)for(const s of [-1,1]){
      if(s*p.z>HL-PR){p.z=s*(HL-PR);
        if(s*p.vz>0){if(!q)snd('wall',Math.abs(p.vz),p.x,'wall');p.vz*=-WALL_E}}
    }
  }
  for(const s of [-1,1])for(const px of [-GW,GW])collidePoint(p,px,s*HL);
  return p.x!==x0||p.z!==z0;
}
function physics(h){
  moveMallet(me,me.maxV,h,MR,HL-MR);
  moveMallet(cpu,cpu.maxV,h,-HL+MR,-MR);
  if(mode!=='play')return;
  const live=livePucks();
  // move the pucks first, then resolve any overlap with a mallet by moving the PUCK out and bouncing it.
  // (Checking before the move let a puck sink into a resting mallet; separate() then shoved the mallet back,
  // and the mallet's spring back to the hand hit the puck again: a still mallet sent it off up to 1.4x faster.)
  for(const p of live)if(p.live)stepPuck(p,h);
  for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++)collidePucks(live[i],live[j]);
  for(const p of live)if(p.live){collideMallet(me,0,p);collideMallet(cpu,1,p);if(railPuck(p))p.pinT=gameTime}
  // only a puck pinned against the rail is left overlapping: then the mallet gives way
  for(const p of live)if(p.live){separate(me,MR,HL-MR,p);separate(cpu,-HL+MR,-MR,p)}
}

// ---------- CPU ----------
const ai={phase:'guard',t:0,aimX:0,sx:0,sz:0,target:null};
function perceived(p,delay){
  const t=gameTime-delay,h=p.hist;
  for(let i=h.length-1;i>=0;i--)if(h[i].t<=t)return h[i];
  return h[0]||p;
}
function predictX(p,zLine){
  if(Math.abs(p.vz)<1e-3)return p.x;
  const t=(zLine-p.z)/p.vz;if(t<0)return p.x;
  const lo=-HW+PR,span=2*(HW-PR);
  let u=(p.x+p.vx*t-lo)%(2*span);if(u<0)u+=2*span;if(u>span)u=2*span-u;
  return lo+u;
}
function pickAim(L){
  let x=(Math.random()*2-1)*(GW-0.04)+(Math.random()+Math.random()-1)*L.aimErr*2;
  if(Math.random()<L.bank){const s=Math.random()<0.5?-1:1;x=s*2*(HW-PR)-x}
  return x;
}
// with several pucks the CPU minds the one that threatens its goal most
function threat(p){
  let s=-p.z;
  if(p.vz<0)s+=-p.vz*0.6;
  if(p.z<0)s+=1;
  return s;
}
// the AI plays from the far end; for the near end (the ?demo match) it sees the table flipped (flip = -1)
function aiStep(m,ai,flip,dt){
  const L=LEVELS[level],home=-HL+0.2,cpu={x:m.x,z:flip*m.z};
  let tx=0,tz=home,spd=L.speed*0.8;
  const live=livePucks();
  if(mode==='play'&&live.length){
    const view=p=>({x:p.x,z:flip*p.z,vx:p.vx,vz:flip*p.vz});
    const target=live.reduce((a,b)=>threat(view(b))>threat(view(a))?b:a);
    if(target!==ai.target){ai.target=target;if(ai.phase!=='strike')ai.phase='guard'}
    const p=view(perceived(target,L.reaction));
    ai.t-=dt;
    if(ai.phase==='strike'&&(ai.t<=0||p.z>0.02)){ai.phase='recover';ai.t=0.3}
    if(ai.phase==='recover'&&ai.t<=0)ai.phase='guard';
    if(ai.phase==='strike'){tx=ai.sx;tz=ai.sz;spd=ai.smash?L.smashSpeed:L.strike}
    else if(ai.phase==='recover'){tx=cpu.x*0.5;tz=home}
    else if(p.z>=0){
      ai.phase='guard';
      tx=p.vz<0?predictX(p,home)*0.8:p.x*0.35;
    }else if(p.vz<-1.4&&p.z>cpu.z){
      // coming fast: get in the way
      ai.phase='guard';tx=predictX(p,cpu.z);tz=home;spd=L.speed;
      // the watching level hits back instead of only blocking: close enough, it steps into the puck's path at full swing
      if(L.counter&&p.z-cpu.z<L.counter){const meet=home+0.14;tx=predictX(p,meet);tz=meet+0.1;spd=L.strike}
    }else{
      if(ai.phase!=='approach'){ai.phase='approach';ai.t=1.5;ai.aimX=pickAim(L)}
      let dx=ai.aimX-p.x,dz=HL-p.z;const dl=Math.hypot(dx,dz);dx/=dl;dz/=dl;
      const back=PR+MR+0.03,bx=p.x-dx*back,bz=Math.max(-HL+MR,p.z-dz*back);
      spd=L.speed;
      if(cpu.z>p.z-(PR+MR)*0.5){
        // the mallet is on the wrong side: go round the puck
        let side=Math.sign(cpu.x-p.x)||1;
        if(Math.abs(p.x+side*(PR+MR+0.07))>HW-MR)side=-side;
        tx=p.x+side*(PR+MR+0.07);tz=p.z-(PR+MR+0.06);
      }else{
        tx=bx;tz=bz;
        if(Math.hypot(cpu.x-bx,cpu.z-bz)<0.035||ai.t<=0){
          ai.phase='strike';ai.t=0.22;ai.sx=p.x+dx*0.22;ai.sz=p.z+dz*0.22;ai.smash=Math.random()<(L.smash??0);
        }
      }
    }
  }
  m.tx=tx;m.tz=flip*tz;m.maxV=spd;
}
// ?demo or the menu's watch button: CPU against CPU, the near mallet played by a second AI; the match
// restarts by itself until the quit button is held
let DEMO=new URLSearchParams(location.search).has('demo');
const aiMe={phase:'guard',t:0,aimX:0,sx:0,sz:0,target:null};

// ---------- game flow ----------
const bannerEls=[document.getElementById('banner'),document.getElementById('banner2')];
// text2: what player 2 reads, when it differs (2P only)
function banner(text,sec=0.6,big=false,text2=text){
  bannerEls.forEach((el,i)=>{
    el.textContent=i?text2:text;el.classList.toggle('big',big);
    el.classList.remove('show');void el.offsetWidth;el.classList.add('show');
  });
  clearTimeout(banner.t);banner.t=setTimeout(()=>bannerEls.forEach(el=>el.classList.remove('show')),sec*1000);
}
function placeMallets(){
  Object.assign(me,{x:0,z:HL-0.2,tx:0,tz:HL-0.2,sx:0,sz:HL-0.2,vx:0,vz:0});
  Object.assign(cpu,{x:0,z:-HL+0.2,tx:0,tz:-HL+0.2,vx:0,vz:0});
  // in 2P the far mallet follows a hand too (followHand); the CPU drives its target directly
  if(twoP)Object.assign(cpu,{sx:0,sz:-HL+0.2});else{delete cpu.sx;delete cpu.sz}
}
function putPuck(p,x,z,vx=0,vz=0){
  Object.assign(p,{x,z,vx,vz,y:0.06,tilt:0,shade:1,live:true,visible:true,anim:{kind:'out',t:0}});
  p.hist.length=0;
}
function serve(side){
  // the puck comes back on the side that conceded
  putPuck(puck,0,side===0?0.42:-0.42);
  ai.phase='guard';aiMe.phase='guard';
  sound.puckOut(0);
  mode='play';
}
// MULTI PUCK: two pucks (three once someone reaches 10) dropped on the center line, nudged toward both sides
function serveMulti(){
  const n=Math.max(score[0],score[1])>=10?3:2;
  multi=true;mode='goal';
  banner(`MULTI PUCK ×${n}`,1.4);
  sound.multiStart();
  after(1.1,()=>{
    const xs=n===3?[-0.3,0,0.3]:[-0.22,0.22];
    xs.forEach((x,i)=>putPuck(pucks[i],x,0,(Math.random()-0.5)*0.4,(i%2?1:-1)*(0.45+Math.random()*0.2)));
    ai.phase='guard';aiMe.phase='guard';
    sound.puckOut(0);sound.bgmStart('fever');
    mode='play';
  });
}
function goal(scorer,p){
  const s=scorer===0?-1:1;
  p.live=false;
  p.anim={kind:'drop',t:0,s};
  sound.goal(p.x,Math.hypot(p.vx,p.vz));
  score[scorer]++;
  // the new number blinks in
  after(0.55,()=>{drawScore(score[0],score[1]);sound.beep();if(fieldScore)for(const S of fieldScore.sides)S.show=2.2});
  for(let i=0;i<4;i++){
    after(0.75+i*0.2,()=>drawScore(score[0],score[1],scorer));
    after(0.85+i*0.2,()=>drawScore(score[0],score[1]));
  }
  const over=score[scorer]>=win;
  if(over){
    // the match is decided: everything else on the table stops where it is
    for(const q of livePucks()){q.live=false;q.visible=false}
  }
  if(livePucks().length)return;
  mode='goal';
  if(multi){multi=false;sound.bgmStart('groove')}
  after(1.7,()=>{
    if(over)finish();
    else if(win>9&&score[0]+score[1]>=nextMulti){nextMulti+=6;serveMulti()}
    else serve(scorer===0?1:0);
  });
}
function finish(){
  mode='over';for(const p of pucks)p.visible=false;
  sound.bgmStop();sound.end();
  pauseBtn.hidden=true;
  if(DEMO&&!twoP){after(3,()=>startGame(level));return}
  const won=score[0]>score[1];quitBtn.hidden=true;
  // 2P: each player is told face to face first, then the shared card
  if(twoP)banner(won?'WIN':'LOSE',2.2,true,won?'LOSE':'WIN');
  after(twoP?2.4:0.9,()=>{
    document.getElementById('result-title').textContent=twoP?(won?'BLUE WINS':'YELLOW WINS'):won?'YOU WIN':'YOU LOSE';
    document.getElementById('result-score').textContent=`${score[0]} - ${score[1]}`;
    document.getElementById('back').textContent=twoP?'メニューへ':'難易度を選ぶ';
    document.getElementById('title').hidden=twoP;
    document.getElementById('result').classList.remove('hidden');
  });
}
function startGame(lv,two=false){
  sound.unlock();
  twoP=two;document.body.classList.toggle('two',two);quitBtn.hidden=!DEMO;
  setPaused(false);pauseBtn.hidden=false;placePause();
  for(const m of paintMats)m.envMapIntensity=two?PAINT_GLOSS.flat:1;
  fingers.clear();owner[0]=owner[1]=null;
  level=lv;score=[0,0];timers=[];multi=false;nextMulti=6;drawScore(0,0);
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('result').classList.add('hidden');
  placeMallets();
  for(const p of pucks){p.live=false;p.visible=false;p.anim=null}
  mode='goal';
  sound.bgmStop();sound.coin();
  // ピッ・ピッ・ピッ・ピーン
  ['3','2','1'].forEach((n,i)=>after(0.9+i*0.42,()=>{banner(n,0.36,true);sound.count(i)}));
  after(0.9+3*0.42,()=>{banner('GO!',0.5,true);sound.count(3);sound.bgmStart('groove');serve(0)});
}

let pickedWin=7;
for(const b of document.querySelectorAll('#menu [data-win]'))b.addEventListener('click',()=>{
  pickedWin=+b.dataset.win;
  for(const o of document.querySelectorAll('#menu [data-win]'))o.classList.toggle('on',o===b);
});
for(const b of document.querySelectorAll('#menu [data-level]'))b.addEventListener('click',()=>{win=pickedWin;startGame(+b.dataset.level)});
document.getElementById('again').addEventListener('click',()=>startGame(level,twoP));
document.getElementById('back').addEventListener('click',()=>{
  document.getElementById('result').classList.add('hidden');
  document.getElementById('menu').classList.remove('hidden');
  mode='menu';twoP=false;document.body.classList.remove('two');quitBtn.hidden=true;
});
// watching: hold the quit button 0.8 s to end it and go back to the menu
const quitBtn=document.getElementById('quit');
function toMenu(){
  setPaused(false);pauseBtn.hidden=true;
  timers=[];mode='menu';sound.bgmStop();DEMO=false;
  for(const p of pucks){p.live=false;p.visible=false;p.anim=null}
  twoP=false;document.body.classList.remove('two');quitBtn.hidden=true;quitBtn.classList.remove('hold');
  document.getElementById('result').classList.add('hidden');
  document.getElementById('menu').classList.remove('hidden');
}
quitBtn.addEventListener('pointerdown',e=>{
  try{quitBtn.setPointerCapture(e.pointerId)}catch{}
  quitBtn.classList.add('hold');clearTimeout(quitBtn.t);quitBtn.t=setTimeout(toMenu,800);
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])quitBtn.addEventListener(type,()=>{
  clearTimeout(quitBtn.t);quitBtn.classList.remove('hold');
});
quitBtn.addEventListener('contextmenu',e=>e.preventDefault());
// 2P needs two fingers at once: elsewhere the button stays in the menu, greyed out
if(navigator.maxTouchPoints<2){
  document.getElementById('vs').disabled=true;
  document.getElementById('vs-hint').textContent='2人対戦はスマホ・タブレットで遊べます';
}
document.getElementById('vs').addEventListener('click',()=>{win=pickedWin;startGame(1,true)});
// both sides at the watching level: NORMAL's rallies were too tame, HARD's guard let almost nothing in
document.getElementById('watch').addEventListener('click',()=>{DEMO=true;win=pickedWin;startGame(3)});
// pause (every mode; in 2P a small button on the rail, placed by placePause). The audio context is suspended with it, so the music,
// the blower and the glide all stop where they are
let paused=false;
const pauseBtn=document.getElementById('pause'),pauseMenu=document.getElementById('pausemenu');
function setPaused(on){
  paused=on;pauseMenu.classList.toggle('hidden',!on);pauseBtn.style.visibility=on?'hidden':'';
  if(on){if(sound.ctx)sound.ctx.suspend().catch(()=>{})}else if(sound.ctx)sound.unlock();
}
pauseBtn.addEventListener('click',()=>setPaused(true));
document.getElementById('resume').addEventListener('click',()=>setPaused(false));
document.getElementById('pause-menu').addEventListener('click',toMenu);
document.getElementById('title').addEventListener('click',toMenu);
const canPause=()=>!pauseBtn.hidden&&!paused;
addEventListener('keydown',e=>{
  if(e.key==='Escape'||e.key==='p'||e.key==='P'){if(paused)setPaused(false);else if(canPause())setPaused(true)}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&canPause())setPaused(true)});
const soundBtn=document.getElementById('sound');
soundBtn.addEventListener('click',()=>{
  sound.unlock();sound.setOn(!sound.on);
  soundBtn.setAttribute('aria-pressed',sound.on);soundBtn.textContent=sound.on?'♪ ON':'♪ OFF';
});

// audio needs a gesture to start, and to come back after the tab was hidden or restored from bfcache
// (not while paused: the pause holds the audio until "つづける")
const wake=()=>{if(!paused)sound.unlock()};
addEventListener('pointerup',wake);
addEventListener('touchend',wake);
// an iPhone that slept comes back with a context that runs silent: the next gesture makes a new one
const IOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
let hiddenAt=0;
document.addEventListener('visibilitychange',()=>{
  if(!sound.ctx)return;
  if(document.hidden){hiddenAt=performance.now();sound.ctx.suspend();return}
  if(IOS&&performance.now()-hiddenAt>500)sound.stale=true;
  else if(!paused)sound.ctx.resume().catch(()=>{});
});
addEventListener('pageshow',e=>{if(e.persisted&&sound.ctx)sound.ctx.resume().catch(()=>{})});

// ---------- input ----------
const ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-0.02);
const ndc=new THREE.Vector2(),hit=new THREE.Vector3();
let touching=false;
function tablePoint(e){
  const r=canvas.getBoundingClientRect();
  ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
  ray.setFromCamera(ndc,twoP?flat:camera);
  return ray.ray.intersectPlane(plane,hit)?{x:hit.x,z:hit.z}:null;
}
// by touch the mallet keeps the offset it had from the finger when the finger came down: put a finger on the
// mallet and it moves right under it; put it anywhere else (off the table, below it) and the mallet stays where
// it is and then moves as the finger moves, so it never has to hide under the finger. Touch is captured, so the
// finger keeps steering past the table's edge and the window's. A mouse pointer is small: it sits on the mallet
const grab={x:0,z:0};
function aim(e){
  if(DEMO)return;
  const p=tablePoint(e);if(!p)return;
  const off=e.pointerType==='mouse'?{x:0,z:0}:grab;
  me.tx=p.x+off.x;me.tz=p.z+off.z;
}
function takeHold(e){
  const p=tablePoint(e);if(p){grab.x=me.x-p.x;grab.z=me.z-p.z}
}
// 2P: every finger belongs to the half it first touched. Each half's mallet follows one finger, the first down;
// any more on that half (a third finger, a palm, a friend's hand) are only remembered, and when the leading
// finger lifts the most recent of them takes over. A finger that slides over the center line keeps its mallet
const fingers=new Map(),owner=[null,null],mallets=[me,cpu];
function steer(id){
  const f=fingers.get(id);
  for(const s of [0,1])if(owner[s]===id){mallets[s].tx=f.x+f.ox;mallets[s].tz=f.z+f.oz}
}
// a finger that takes a mallet keeps its offset from it, as in 1P (the mallet is where the hand left it)
function hold(id,s){
  const f=fingers.get(id),m=mallets[s];owner[s]=id;
  f.ox=m.x-f.x;f.oz=m.z-f.z;
}
function release(id){
  const f=fingers.get(id);if(!f)return;
  fingers.delete(id);
  if(owner[f.side]!==id)return;
  let next=null;
  for(const [k,g] of fingers)if(g.side===f.side&&(next===null||g.t>fingers.get(next).t))next=k;
  owner[f.side]=null;
  if(next!==null){hold(next,f.side);steer(next)}
}
canvas.addEventListener('pointerdown',e=>{
  // (throws if the pointer is already gone, e.g. a very quick tap)
  try{canvas.setPointerCapture(e.pointerId)}catch{}
  if(twoP){
    const p=tablePoint(e);if(!p)return;
    const side=p.z>=0?0:1;
    fingers.set(e.pointerId,{...p,side,t:performance.now(),ox:0,oz:0});
    if(owner[side]===null)hold(e.pointerId,side);
    steer(e.pointerId);return;
  }
  touching=true;if(e.pointerType!=='mouse')takeHold(e);aim(e);
});
canvas.addEventListener('pointermove',e=>{
  if(twoP){
    const f=fingers.get(e.pointerId);if(!f)return;
    const p=tablePoint(e);if(p){f.x=p.x;f.z=p.z;steer(e.pointerId)}
    return;
  }
  if(e.pointerType==='mouse'||touching)aim(e);
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{
  if(twoP)release(e.pointerId);else touching=false;
});
// Safari: no pinch zoom (gesture*), no double-tap zoom, no scroll or rubber-band, no long-press callout.
// Only touches on the table are held back, so the menu buttons still get their clicks
for(const type of ['touchstart','touchmove'])document.addEventListener(type,e=>{if(e.target===canvas)e.preventDefault()},{passive:false});
for(const type of ['gesturestart','gesturechange','gestureend'])document.addEventListener(type,e=>e.preventDefault());
canvas.addEventListener('contextmenu',e=>e.preventDefault());

if(location.search.includes('debug'))window.__ah={scene,renderer,THREE,puck,pucks,me,cpu,goal,camera,serveMulti,sound,get score(){return score},get win(){return win}};

// ---------- loop ----------
function animPuck(p,dt){
  const a=p.anim;if(!a)return;
  a.t+=dt;
  if(a.kind==='drop'){
    if(V_B){
      // ガコン: it stays where it stopped, all the way in the slot, and is gone (pulling it to a fixed depth
      // here moved it back toward the field once the goal stopped it deeper: it looked like a bounce).
      // No camera shake on a goal: the cabinet seemed to wobble
      if(a.t>0.14){p.visible=false;p.anim=null}
      return;
    }
    // ガコン: slam into the back of the pocket, tip over the edge and fall away into the dark
    const back=a.s*(HL+END-0.022-PR-0.002);
    if(a.t<0.06){p.z+=(back-p.z)*Math.min(1,dt*35)}
    else{
      const tt=a.t-0.06;
      p.z=back-a.s*Math.min(0.01,tt*0.1);
      p.y=-0.004-3.5*tt*tt;
      p.tilt=a.s*Math.min(1,tt/0.1)*1.05;
      p.shade=clamp(1+p.y/0.13,0.04,1);
      if(p.y<-0.2||!V_B&&a.t>0.3){p.visible=false;p.anim=null;p.tilt=0;p.shade=1}
    }
  }else{
    const k=Math.min(1,a.t/0.14);p.y=0.06*(1-k)*(1-k);
    if(k>=1){p.y=0;p.anim=null}
  }
}
// the mallet follows the hand at the hand's own speed: it covers this frame's gap in one frame, no faster
function followHand(m,zMin,zMax,dt){
  // (it used to ease toward the hand over 25 ms, which read as the mallet trailing the finger)
  m.sx=m.tx;m.sz=m.tz;
  m.maxV=Math.min(ME_SPEED,Math.hypot(clamp(m.sx,-HW+MR,HW-MR)-m.x,clamp(m.sz,zMin,zMax)-m.z)/Math.max(dt,1/240));
}
let last=performance.now(),acc=0;
function frame(now){
  // paused: the table holds still (time, timers, physics and AI all wait), so it is drawn again only when the
  // window changes size (which clears the canvas)
  if(paused){last=now;if(redraw){renderer.render(scene,twoP?flat:camera);redraw=false}requestAnimationFrame(frame);return}
  const dt=Math.min(0.05,(now-last)/1000);last=now;gameTime+=dt;
  const due=timers.filter(t=>t.t<=gameTime);
  if(due.length){timers=timers.filter(t=>t.t>gameTime);due.forEach(t=>t.fn())}

  for(const p of pucks){
    p.hist.push({t:gameTime,x:p.x,z:p.z,vx:p.vx,vz:p.vz});
    while(p.hist.length&&p.hist[0].t<gameTime-1)p.hist.shift();
  }
  if(twoP)followHand(cpu,-HL+MR,-MR,dt);else aiStep(cpu,ai,1,dt);
  if(DEMO&&!twoP){aiStep(me,aiMe,-1,dt);me.sx=me.tx;me.sz=me.tz}
  else followHand(me,MR,HL-MR,dt);
  acc+=dt;
  while(acc>=STEP){physics(STEP);acc-=STEP}

  let fastest=null,top=0;
  for(const p of pucks){
    animPuck(p,dt);
    const v=p.live&&mode==='play'?Math.hypot(p.vx,p.vz):0;
    if(v>top){top=v;fastest=p}
    p.mesh.visible=p.visible;
    p.mesh.position.set(p.x,0.0006+p.y,p.z);
    p.mesh.rotation.x=p.tilt||0;
    p.mesh.material.color.copy(PUCK_RED).multiplyScalar(p.shade??1);
    p.shadow.position.set(p.x+0.004,0.0008,p.z+0.003);
    p.shadow.visible=p.visible&&p.y>=0;
  }
  sound.glide(top,fastest?fastest.x:0);

  meMesh.position.set(me.x,0,me.z);cpuMesh.position.set(cpu.x,0,cpu.z);
  meShadow.position.set(me.x+0.006,0.0008,me.z+0.004);cpuShadow.position.set(cpu.x+0.006,0.0008,cpu.z+0.004);
  camera.position.copy(camBase);
  // the score only rises through the playfield after a goal: both numbers, held, then fading out
  if(fieldScore)for(const S of fieldScore.sides){S.show=Math.max(0,S.show-dt);S.m.material.opacity=0.85*clamp(S.show/0.7,0,1)}

  renderer.render(scene,twoP?flat:camera);
  if(mode==='play')pace(dt);
  requestAnimationFrame(frame);
}
// a phone that can't keep up at full resolution: frames running long through play (under 45 fps for over a
// second; each late frame is the mallet that much behind the finger) draw the table at fewer pixels, 2 -> 1.5 -> 1 times the CSS size, never back up. Nothing else changes,
// and a device that keeps up never gets here
let slowFor=0,paceWait=2;
function pace(dt){
  if((paceWait-=dt)>0)return;
  slowFor=dt>1/45?slowFor+dt:Math.max(0,slowFor-dt);
  const pr=renderer.getPixelRatio();
  if(slowFor>1.2&&pr>1){renderer.setPixelRatio(pr>1.5?1.5:1);fit();slowFor=0;paceWait=2}
}
requestAnimationFrame(frame);
