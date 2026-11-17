import * as THREE from 'three';
import {R,HX,HZ,STEP,POCKETS,SEGS,makeBall,copyBalls,strike,step,anyMoving,simulate,rack9,rack8,freeSpot} from './physics.js';
import {Sound} from './audio.js';
import {Net} from './net.js';

const Q=new URLSearchParams(location.search),DEBUG=Q.has('debug');
const sound=new Sound();
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const $=id=>document.getElementById(id);
// a finger (the aim dial below the table) or a mouse (the cue follows the pointer before the button goes down)
const TOUCH=matchMedia('(pointer: coarse)').matches;
document.body.classList.toggle('touch',TOUCH);
// how big the pieces over the table are: a phone's size up to 560 px on the short side, then growing to 1.25x
function fitUI(){document.documentElement.style.setProperty('--k',Math.min(1.25,Math.max(1,Math.min(innerWidth,innerHeight)/560)).toFixed(3))}
fitUI();addEventListener('resize',fitUI);
// the notch and the home bar: inside the site's iframe env(safe-area-inset-*) reads 0, so in full screen the top
// row sat under the notch while the site's exit button (outside the frame) sat below it (2026-11-18). Framed, take
// the page's own insets, less how far the frame is from that edge (--it / --ib in style.css)
function fitInsets(){
  const f=window.frameElement;if(!f)return;
  try{
    const pd=parent.document;let p=pd.getElementById('bl-insets');
    if(!p){
      p=pd.createElement('div');p.id='bl-insets';
      p.style.cssText='position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;'+
        'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
      pd.body.appendChild(p);
    }
    const cs=parent.getComputedStyle(p),r=f.getBoundingClientRect();
    const t=Math.max(0,parseFloat(cs.paddingTop)-r.top),b=Math.max(0,parseFloat(cs.paddingBottom)-(parent.innerHeight-r.bottom));
    const s=document.documentElement.style;s.setProperty('--it',t+'px');s.setProperty('--ib',b+'px');
  }catch{}
}
fitInsets();addEventListener('resize',fitInsets);
try{if(window.frameElement){parent.addEventListener('resize',fitInsets);parent.addEventListener('scroll',fitInsets,{passive:true});parent.document.addEventListener('fullscreenchange',fitInsets)}}catch{}

// the table's build (metres): cushion depth to the rail, the wooden rail's width, heights over the cloth
const RAIL=0.05,WOOD=0.115,CUSH_H=0.041,RAIL_H=0.046;
// the pocket's leather lining sits this far inside the hole cut in the wood: just inside, on the same curve
// (at 0.5 mm the wood flickered through it)
const LINE=0.002;
const CLOTH=0x1b5288;

// ---------- scene ----------
const canvas=$('view');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x0b0c10);
const camera=new THREE.PerspectiveCamera(42,1,0.02,30);

// the room the glossy balls and lacquered rails mirror: dark, with the lamp's long glowing shade over the table
function roomEnv(){
  const pm=new THREE.PMREMGenerator(renderer),env=new THREE.Scene();
  env.background=new THREE.Color(0x0e0f13);
  const lamp=new THREE.Mesh(new THREE.PlaneGeometry(1.6,0.3),new THREE.MeshBasicMaterial({color:new THREE.Color(3.2,3,2.8),side:THREE.DoubleSide}));
  lamp.position.set(0,1.0,0);lamp.rotation.x=Math.PI/2;env.add(lamp);
  const wall=new THREE.Mesh(new THREE.PlaneGeometry(8,3),new THREE.MeshBasicMaterial({color:new THREE.Color(0.10,0.085,0.07),side:THREE.DoubleSide}));
  wall.position.set(0,0.5,-3);env.add(wall);
  const t=pm.fromScene(env,0.03).texture;pm.dispose();return t;
}
scene.environment=roomEnv();scene.environmentIntensity=0.55;

// a pool lamp: three shades in a row over the table, a pool of light with dark round it
scene.add(new THREE.HemisphereLight(0xfff6e8,0x1a1c24,0.25));
for(const x of [-0.66,0,0.66]){
  const s=new THREE.SpotLight(0xfff1dc,2.2,0,0.95,0.8,2);
  s.position.set(x,1.05,0);s.target.position.set(x,0,0);scene.add(s,s.target);
}
// the shadows: straight down, as the shades throw them
const sun=new THREE.DirectionalLight(0xfff4e6,0.55);
sun.position.set(0.05,3,0.08);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-1.35,right:1.35,top:0.85,bottom:-0.85,near:1,far:5});
sun.shadow.bias=-0.0004;sun.shadow.radius=3;
scene.add(sun);

function canvasTex(w,h,draw,repeat){
  const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();
  if(repeat){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...repeat)}
  return t;
}
// the cloth: worsted, a fine even grain, nearly no sheen
const clothTex=canvasTex(256,256,(g,w,h)=>{
  const c=new THREE.Color(CLOTH);
  g.fillStyle='#'+c.getHexString();g.fillRect(0,0,w,h);
  const img=g.getImageData(0,0,w,h),d=img.data;
  for(let i=0;i<d.length;i+=4){const n=(Math.random()-0.5)*14;d[i]+=n;d[i+1]+=n;d[i+2]+=n}
  g.putImageData(img,0,0);
},[14,7]);
const clothMat=new THREE.MeshStandardMaterial({map:clothTex,roughness:0.93,metalness:0,envMapIntensity:0.3});
const cushMat=new THREE.MeshStandardMaterial({map:clothTex,roughness:0.9,metalness:0,envMapIntensity:0.3});
// the rails: a dark reddish hardwood under a lacquer
const woodTex=canvasTex(1024,256,(g,w,h)=>{
  g.fillStyle='#4a2414';g.fillRect(0,0,w,h);
  for(let y=0;y<h;y++){
    const v=Math.sin(y*0.21+Math.sin(y*0.031)*4)*0.5+Math.sin(y*0.83)*0.2+(Math.random()-0.5)*0.25;
    g.fillStyle=v>0?`rgba(120,58,28,${v*0.35})`:`rgba(20,8,4,${-v*0.45})`;g.fillRect(0,y,w,1);
  }
  for(let i=0;i<70;i++){
    g.strokeStyle=`rgba(18,6,2,${0.08+Math.random()*0.12})`;g.lineWidth=0.6+Math.random();
    const y0=Math.random()*h;g.beginPath();g.moveTo(0,y0);
    for(let x=0;x<=w;x+=32)g.lineTo(x,y0+Math.sin(x*0.004+i)*6+Math.sin(x*0.02+i*3)*1.5);
    g.stroke();
  }
},[1.2,4]);
woodTex.rotation=0;
const woodMat=new THREE.MeshPhysicalMaterial({map:woodTex,roughness:0.55,clearcoat:0.35,clearcoatRoughness:0.32,envMapIntensity:0.5});
const bodyMat=new THREE.MeshStandardMaterial({color:0x1f0f08,roughness:0.6});
const leatherMat=new THREE.MeshStandardMaterial({color:0x080707,roughness:0.95,envMapIntensity:0.15,side:THREE.DoubleSide});
const pearlMat=new THREE.MeshStandardMaterial({color:0xf1ece0,roughness:0.25,metalness:0.1});

// shapes drawn in the table's plan (x, z) and laid flat: a Shape's y is -z
const flat=(geo,y)=>{geo.rotateX(-Math.PI/2);geo.translate(0,y,0);return geo};
// the cloth bed, with the six pocket holes (it runs on under the rails, far enough that every hole is inside it:
// a hole crossing the edge left the bed whole, cloth across the pockets)
{
  const E=HX+RAIL+WOOD-0.01,F=HZ+RAIL+WOOD-0.01;
  const s=new THREE.Shape([new THREE.Vector2(-E,-F),new THREE.Vector2(E,-F),new THREE.Vector2(E,F),new THREE.Vector2(-E,F)]);
  for(const p of POCKETS){const h=new THREE.Path();h.absarc(p.x,-p.z,p.r,0,Math.PI*2,true);s.holes.push(h)}
  const bed=new THREE.Mesh(flat(new THREE.ShapeGeometry(s,24),0),clothMat);
  bed.receiveShadow=true;scene.add(bed);
}
// the cushions: one block per rail run, nose to the jaws' ends (physics' SEGS come in threes: run, jaw, jaw)
// A jaw runs on into the rail past the pocket's hole: the block stops at the hole's edge (where the jaw meets the
// circle, then round the circle to the rail's back line), so no cushion hangs over the hole
function jawEnd(nx,nz,ex,ez){
  const p=POCKETS.reduce((a,q)=>Math.hypot(q.x-ex,q.z-ez)<Math.hypot(a.x-ex,a.z-ez)?q:a);
  const r=p.r;
  if(Math.hypot(ex-p.x,ez-p.z)>=r)return [[ex,ez]];
  // along the jaw from the nose: the first point on the circle
  const dx=ex-nx,dz=ez-nz,fx=nx-p.x,fz=nz-p.z,A=dx*dx+dz*dz,B=2*(fx*dx+fz*dz),C=fx*fx+fz*fz-r*r;
  const t=(-B-Math.sqrt(Math.max(0,B*B-4*A*C)))/(2*A),jx=nx+dx*t,jz=nz+dz*t;
  // the rail's back line (through the jaw's end, along x or z): where the circle crosses it on the jaw's side
  let cx,cz;
  if(Math.abs(Math.abs(ez)-(HZ+RAIL))<1e-4){cz=ez;const h=Math.sqrt(Math.max(0,r*r-(cz-p.z)**2));cx=p.x+(jx<p.x?-h:h)}
  else{cx=ex;const h=Math.sqrt(Math.max(0,r*r-(cx-p.x)**2));cz=p.z+(jz<p.z?-h:h)}
  // round the circle from the jaw's point to the back line
  const a0=Math.atan2(jz-p.z,jx-p.x),a1=Math.atan2(cz-p.z,cx-p.x),da=wrap(a1-a0),out=[];
  for(let k=0;k<=8;k++){const a=a0+da*k/8;out.push([p.x+Math.cos(a)*r,p.z+Math.sin(a)*r])}
  return out;
}
for(let i=0;i<SEGS.length;i+=3){
  const run=SEGS[i],ja=SEGS[i+1],jb=SEGS[i+2];
  const pts=[[run.ax,run.az],[run.bx,run.bz],...jawEnd(jb.ax,jb.az,jb.bx,jb.bz),...jawEnd(ja.ax,ja.az,ja.bx,ja.bz).reverse()];
  const s=new THREE.Shape(pts.map(([x,z])=>new THREE.Vector2(x,-z)));
  const g=flat(new THREE.ExtrudeGeometry(s,{depth:CUSH_H,bevelEnabled:false}),0);
  // a cushion's section: the top falls toward the nose (37 mm, above the balls' centres) and the face under the
  // nose is cut back, so the nose overhangs the cloth as a real rubber does
  const nx=-run.dz,nz=run.dx; // into the rail (the run's left)
  const sgn=Math.sign(((ja.bx+jb.bx)/2-run.ax)*nx+((ja.bz+jb.bz)/2-run.az)*nz)||1;
  const pos=g.attributes.position;
  for(let k=0;k<pos.count;k++){
    let x=pos.getX(k),y=pos.getY(k),z=pos.getZ(k);
    const d=Math.max(0,((x-run.ax)*nx+(z-run.az)*nz)*sgn),t=y/CUSH_H;
    const top=0.037+(CUSH_H-0.037)*Math.min(1,d/0.045);
    // (only along the run itself: at its ends the cut pushed the jaws' foot out over the pocket's hole)
    const along=(x-run.ax)*run.dx+(z-run.az)*run.dz,inRun=along>0.004&&along<run.l-0.004;
    const cut=inRun?0.011*(1-t)*Math.max(0,1-d/0.02):0;
    x+=nx*sgn*cut;z+=nz*sgn*cut;y=t*top;
    pos.setXYZ(k,x,y,z);
  }
  g.computeVertexNormals();
  const m=new THREE.Mesh(g,cushMat);m.castShadow=false;m.receiveShadow=true;scene.add(m);
}
// the wooden rail: a frame whose inside edge runs along the cushions' backs and round the pocket holes
{
  const E=HX+RAIL,F=HZ+RAIL,OE=E+WOOD,OF=F+WOOD,rr=0.045;
  // two pieces: the inner part, cut straight down round the pockets so the wood meets the holes' leather exactly
  // (a bevel there pushed the wood's face up to 10 mm into the hole, off the hole's curve), and an outer band
  // whose bevel rounds the rail's outside edge. They meet on a line BAND in from the outside, flush on top
  const BAND=0.03,IE=OE-BAND,IF=OF-BAND,BV=0.008;
  const inner=new THREE.Shape([new THREE.Vector2(-IE,-IF),new THREE.Vector2(IE,-IF),new THREE.Vector2(IE,IF),new THREE.Vector2(-IE,IF)]);
  // the inside: the cushions' back line, and round each pocket the pocket's own circle, drawn as an arc (pushing
  // the line's points out onto the circle left the side pockets' backs as chords, the wood 5 mm into the hole)
  const pts=[],N=1200,P=2*(2*E+2*F);
  let inside=null,enter=0;
  const ang=(p,x,z)=>Math.atan2(z-p.z,x-p.x);
  for(let i=0;i<=N;i++){
    // (starting half a metre along the first long side, away from every pocket)
    let d=((i%N)/N*P+0.5)%P,x,z;
    if(d<2*E){x=-E+d;z=-F}else if((d-=2*E)<2*F){x=E;z=-F+d}else if((d-=2*F)<2*E){x=E-d;z=F}else{d-=2*E;x=-E;z=F-d}
    const p=POCKETS.find(q=>Math.hypot(x-q.x,z-q.z)<q.r)||null;
    if(p!==inside){
      if(inside){
        // leaving a circle: its arc from where the line went in to here, round the outside of the table
        const q=inside,a0=enter,a1=ang(q,x,z),out=Math.atan2(q.z,q.x);
        let da=wrap(a1-a0);
        if(Math.cos(wrap(a0+da/2-out))<0)da-=Math.sign(da)*2*Math.PI;
        for(let k=0;k<=32;k++){const t=a0+da*k/32;pts.push(new THREE.Vector2(q.x+Math.cos(t)*q.r,-(q.z+Math.sin(t)*q.r)))}
      }
      if(p)enter=ang(p,x,z);
      inside=p;
    }
    if(!p&&i<N)pts.push(new THREE.Vector2(x,-z));
  }
  inner.holes.push(new THREE.Path(pts.reverse()));
  const gi=new THREE.ExtrudeGeometry(inner,{depth:RAIL_H+0.125,bevelEnabled:false});
  const mi=new THREE.Mesh(flat(gi,-0.125),woodMat);mi.receiveShadow=true;mi.castShadow=true;scene.add(mi);
  // the band: drawn BV inside the outside line (its bevel grows the wall back out to it); its hole is the inner
  // part's outline, where the bevel's rounding falls inside the inner part and doesn't show
  const band=new THREE.Shape();
  const o=OE-BV,q=OF-BV,rb=rr-BV;
  band.moveTo(-o+rb,-q);band.lineTo(o-rb,-q);band.quadraticCurveTo(o,-q,o,-q+rb);
  band.lineTo(o,q-rb);band.quadraticCurveTo(o,q,o-rb,q);band.lineTo(-o+rb,q);
  band.quadraticCurveTo(-o,q,-o,q-rb);band.lineTo(-o,-q+rb);band.quadraticCurveTo(-o,-q,-o+rb,-q);
  band.holes.push(new THREE.Path([new THREE.Vector2(-IE,-IF),new THREE.Vector2(-IE,IF),new THREE.Vector2(IE,IF),new THREE.Vector2(IE,-IF)]));
  const gb=new THREE.ExtrudeGeometry(band,{depth:RAIL_H+0.125-0.02,bevelEnabled:true,bevelThickness:0.01,bevelSize:BV,bevelSegments:4,curveSegments:12});
  const mb=new THREE.Mesh(flat(gb,-0.115),woodMat);mb.receiveShadow=true;mb.castShadow=true;scene.add(mb);
  // under it, the body and its skirt (below the pocket cups: its top showed through the holes)
  const body=new THREE.Mesh(new THREE.BoxGeometry(2*OE-0.04,0.2,2*OF-0.04),bodyMat);body.position.y=-0.235;scene.add(body);
  // sights: pearl diamonds along the rails, at every eighth of the length and every quarter of the width
  const dg=new THREE.CircleGeometry(0.0065,4);dg.scale(1.6,1,1);
  const sight=(x,z,rot)=>{const m=new THREE.Mesh(dg,pearlMat);m.rotation.x=-Math.PI/2;m.rotation.z=rot;m.position.set(x,RAIL_H+0.0012,z);scene.add(m)};
  const mid=WOOD/2+RAIL;
  for(let i=1;i<8;i++)if(i!==4)for(const s of [-1,1])sight(-HX+i*HX/4,s*(HZ+mid),0);
  for(let j=1;j<4;j++)for(const s of [-1,1])sight(s*(HX+mid),-HZ+j*HZ/2,Math.PI/2);
  // pocket cups: leather, open at the top
  for(const p of POCKETS){
    const cup=new THREE.Mesh(new THREE.CylinderGeometry(p.r,p.r-0.008,0.1,32,1,true),leatherMat);
    cup.position.set(p.x,-0.05,p.z);scene.add(cup);
    // above the cloth the hole's back is lined in leather too (the wood's cut face showed in it), only round the
    // back: the side facing the table is the mouth
    const ox=p.corner?p.sx:0,oz=p.sz,half=p.corner?2.0:1.45;
    const liner=new THREE.Mesh(new THREE.CylinderGeometry(p.r-LINE,p.r-LINE,RAIL_H+0.002,32,1,true,Math.atan2(ox,oz)-half,2*half),leatherMat);
    liner.position.set(p.x,(RAIL_H+0.002)/2-0.0005,p.z);scene.add(liner);
    const bot=new THREE.Mesh(new THREE.CircleGeometry(p.r,32),new THREE.MeshBasicMaterial({color:0x050404}));bot.rotation.x=-Math.PI/2;bot.position.set(p.x,-0.09,p.z);scene.add(bot);
  }
}

// ---------- balls ----------
const BALL_COL={1:'#f2c230',2:'#2150b8',3:'#d42a24',4:'#5a2c8c',5:'#f07222',6:'#1d7f45',7:'#7b1c1f',8:'#141414',9:'#f2c230',
  10:'#2150b8',11:'#d42a24',12:'#5a2c8c',13:'#f07222',14:'#1d7f45',15:'#7b1c1f'};
const IVORY='#f4f0e4';
function ballTex(n){
  return canvasTex(512,256,(g,w,h)=>{
    if(n===0){g.fillStyle=IVORY;g.fillRect(0,0,w,h);return}
    const col=BALL_COL[n];
    if(n>8){g.fillStyle=IVORY;g.fillRect(0,0,w,h);g.fillStyle=col;g.fillRect(0,h*0.29,w,h*0.42)}
    else{g.fillStyle=col;g.fillRect(0,0,w,h)}
    // the number's circle: about half the ball's width, as on a real set, the figure filling most of it
    for(const u of [0.25,0.75]){
      const x=u*w,y=h/2;
      g.fillStyle=IVORY;g.beginPath();g.ellipse(x,y,36,38,0,0,Math.PI*2);g.fill();
      g.fillStyle='#16130f';g.font='bold 44px "Helvetica Neue",Arial,sans-serif';g.textAlign='center';g.textBaseline='middle';
      g.fillText(String(n),x,y+1.5);
      if(n===6||n===9){g.fillRect(x-10,y+22,20,3.5)}
    }
  });
}
const ballGeo=new THREE.SphereGeometry(R,40,28);
const meshes={};
const NBALLS=15;   // meshes for every ball either game racks (9-ball uses 0-9)
for(let n=0;n<=NBALLS;n++){
  const m=new THREE.Mesh(ballGeo,new THREE.MeshPhysicalMaterial({map:ballTex(n),roughness:0.14,clearcoat:1,clearcoatRoughness:0.035,envMapIntensity:1.1}));
  m.castShadow=true;m.receiveShadow=false;
  // a random turn, so the numbers don't all face the same way
  m.quaternion.setFromEuler(new THREE.Euler(Math.random()*6,Math.random()*6,Math.random()*6));
  scene.add(m);meshes[n]=m;
}

// ---------- the cue ----------
const cue=new THREE.Group();
{
  // along +y from the tip (0) to the butt (1.47 m), tapering from 6.5 mm to 15 mm radius
  const part=(y0,y1,r0,r1,mat)=>{const g=new THREE.CylinderGeometry(r1,r0,y1-y0,24);g.translate(0,(y0+y1)/2,0);const m=new THREE.Mesh(g,mat);m.castShadow=true;cue.add(m)};
  const rAt=y=>0.0065+(0.0148-0.0065)*Math.min(1,y/1.47)**1.3;
  part(0,0.012,rAt(0),rAt(0.012),new THREE.MeshStandardMaterial({color:0x2c5fb8,roughness:0.9}));
  part(0.012,0.034,rAt(0.012),rAt(0.034),new THREE.MeshStandardMaterial({color:0xf3efe4,roughness:0.3}));
  part(0.034,0.74,rAt(0.034),rAt(0.74),new THREE.MeshPhysicalMaterial({color:0xe2c9a0,roughness:0.35,clearcoat:0.6}));
  part(0.74,0.76,rAt(0.74),rAt(0.76),new THREE.MeshStandardMaterial({color:0x111111,roughness:0.3,metalness:0.5}));
  part(0.76,1.02,rAt(0.76),rAt(1.02),new THREE.MeshPhysicalMaterial({color:0x3a1a0c,roughness:0.35,clearcoat:0.8}));
  part(1.02,1.3,rAt(1.02),rAt(1.3),new THREE.MeshStandardMaterial({color:0x141414,roughness:0.85}));
  part(1.3,1.47,rAt(1.3),rAt(1.47),new THREE.MeshPhysicalMaterial({color:0x3a1a0c,roughness:0.35,clearcoat:0.8}));
}
const cueHold=new THREE.Group();cueHold.add(cue);scene.add(cueHold);cueHold.visible=false;


// how steeply the cue must rise to clear the rail and any ball behind the cue ball. The cue's line runs through
// the ball's centre (raised with top or bottom spin), and drawing back slides it along that line, so the whole
// length the cue can occupy (with the full draw) is checked against the wood, the cushions and the balls under
// it: a ball frozen to a rail and shot away from it needs the cue at ~45 deg, as on a real table
const CUE_LEN=1.47,CUE_MIN=0.087,CUE_MAX=1.3,CLEAR=0.004;
const cueR=s=>0.0065+(0.0148-0.0065)*Math.min(1,s/CUE_LEN)**1.3;
function cueRise(th){
  const c=ballN(0),bx=-Math.cos(th),bz=-Math.sin(th),y0=R+G.spinY*R*0.5;
  const OE=HX+RAIL+WOOD+0.01,OF=HZ+RAIL+WOOD+0.01,far=R+pullDist(1)+CUE_LEN;
  let need=Math.tan(CUE_MIN);
  for(let d=R+0.001;d<=far;d+=0.005){
    const px=c.x+bx*d,pz=c.z+bz*d;
    // past the table's outside edge nothing is under the cue
    if(Math.abs(px)>OE||Math.abs(pz)>OF)break;
    const r=cueR(Math.max(0,d-R-pullDist(1)))*1.15;
    let h=0;
    if(Math.abs(px)>HX-0.002||Math.abs(pz)>HZ-0.002)h=RAIL_H+0.003;
    for(const b of G.balls){
      if(!b.on||b.n===0)continue;
      const q=Math.hypot(b.x-px,b.z-pz)-r;
      if(q<R)h=Math.max(h,R+Math.sqrt(R*R-Math.max(0,q)**2));
    }
    if(h>0)need=Math.max(need,(h+CLEAR+r-y0)/d);
  }
  return clamp(Math.atan(need),CUE_MIN,CUE_MAX);
}
let rise=CUE_MIN;

// ---------- the aiming guide (taken out, then asked back the same day) ----------
const guideMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.8,depthWrite:false});
const guideMat2=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.45,depthWrite:false});
function ribbon(mat,w=0.0035){const g=new THREE.PlaneGeometry(1,w);g.rotateX(-Math.PI/2);g.translate(0.5,0,0);const m=new THREE.Mesh(g,mat);m.renderOrder=2;scene.add(m);return m}
const gMain=ribbon(guideMat),gObj=ribbon(guideMat),gCue=ribbon(guideMat2),gBounce=ribbon(guideMat2);
const gRing=new THREE.Mesh(new THREE.RingGeometry(R-0.0028,R,48).rotateX(-Math.PI/2),guideMat);gRing.renderOrder=2;scene.add(gRing);
function setRibbon(m,x,z,dx,dz,len){m.visible=len>0.002;m.position.set(x,0.0015,z);m.rotation.y=-Math.atan2(dz,dx);m.scale.x=len}
function hideGuide(){for(const m of [gMain,gObj,gCue,gBounce,gRing])m.visible=false}
hideGuide();
// where the shot along th first meets a ball or a cushion
function trace(th){
  const c=ballN(0),dx=Math.cos(th),dz=Math.sin(th);
  let best=1e9,hit=null;
  for(const b of G.balls){
    if(!b.on||b.n===0)continue;
    const ox=b.x-c.x,oz=b.z-c.z,along=ox*dx+oz*dz;if(along<=0)continue;
    const off2=ox*ox+oz*oz-along*along,r2=4*R*R;if(off2>=r2)continue;
    const t=along-Math.sqrt(r2-off2);if(t<best){best=t;hit=b}
  }
  // the cushions, as the box the ball's centre stays in
  const lim=(p,d,L)=>d>0?(L-R-p)/d:d<0?(-L+R-p)/d:1e9;
  const tx=lim(c.x,dx,HX),tz=lim(c.z,dz,HZ),tw=Math.min(tx,tz);
  if(tw<best)return {t:tw,ball:null,wall:tx<tz?'x':'z'};
  return {t:best,ball:hit};
}
// how far the object ball's line and the cue ball's line reach: VS CPU by level, else NORMAL's
const GUIDE_LEN=[[0.55,0.3],[0.4,0.22],[0.18,0.1]];
// how far a ball's centre can go from (x,z) along (dx,dz) before a cushion: the lines stop there (the object
// ball's line ran on through the cushion and off the table, 2026-11-18)
const toWall=(x,z,dx,dz)=>Math.max(0,Math.min(dx>0?(HX-R-x)/dx:dx<0?(-HX+R-x)/dx:1e9,dz>0?(HZ-R-z)/dz:dz<0?(-HZ+R-z)/dz:1e9));
function drawGuide(th){
  const c=ballN(0),dx=Math.cos(th),dz=Math.sin(th),tr=trace(th);
  const gx=c.x+dx*tr.t,gz=c.z+dz*tr.t;
  setRibbon(gMain,c.x+dx*R,c.z+dz*R,dx,dz,Math.max(0,tr.t-2*R+0.003));
  gRing.visible=true;gRing.position.set(gx,0.0016,gz);
  const [lo,lc]=G.vs==='cpu'?GUIDE_LEN[G.level]:GUIDE_LEN[1];
  if(tr.ball){
    const nx=tr.ball.x-gx,nz=tr.ball.z-gz,nl=Math.hypot(nx,nz),ux=nx/nl,uz=nz/nl;
    const cosA=dx*ux+dz*uz;
    setRibbon(gObj,tr.ball.x+ux*R,tr.ball.z+uz*R,ux,uz,Math.min(lo*Math.max(0.25,cosA),toWall(tr.ball.x,tr.ball.z,ux,uz)));
    const tx=dx-cosA*ux,tz=dz-cosA*uz,tl=Math.hypot(tx,tz);
    if(tl>0.02)setRibbon(gCue,gx+tx/tl*R,gz+tz/tl*R,tx/tl,tz/tl,Math.min(lc*tl,toWall(gx,gz,tx/tl,tz/tl)));else gCue.visible=false;
    gBounce.visible=false;
  }else{
    gObj.visible=gCue.visible=false;
    const bx=tr.wall==='x'?-dx:dx,bz=tr.wall==='z'?-dz:dz;
    setRibbon(gBounce,gx+bx*R,gz+bz*R,bx,bz,Math.min(lc,toWall(gx,gz,bx,bz)));
  }
}

// ---------- camera ----------
// 'aim': behind the cue ball, looking along the shot. 'top': straight down on the whole table
let view='aim',camLock=null;
const cam={pos:new THREE.Vector3(-2.4,1.2,0),look:new THREE.Vector3(),up:new THREE.Vector3(0,1,0)};
const camT={pos:new THREE.Vector3(),look:new THREE.Vector3(),up:new THREE.Vector3(0,1,0)};
let aspect=1;
function fit(){
  const w=innerWidth,h=innerHeight;aspect=w/h;
  renderer.setSize(w,h,false);camera.aspect=aspect;
  camera.fov=aspect<0.8?56:aspect<1.2?48:40;camera.updateProjectionMatrix();
}
addEventListener('resize',fit);fit();
function topTarget(){
  const t=Math.tan(camera.fov*Math.PI/360),W=HX+RAIL+WOOD+0.04,D=HZ+RAIL+WOOD+0.04;
  const port=aspect<1;
  // the long axis along the screen's long side, the HUD's strips kept clear
  const a=port?D:W,b=port?W:D;
  const H=Math.max(b/(t*0.86),a/(t*aspect));
  camT.pos.set(0,H,0.0001);camT.look.set(0,0,0);
  if(port)camT.up.set(1,0,0);else camT.up.set(0,0,-1);
}
function aimTarget(cx,cz,th){
  const dx=Math.cos(th),dz=Math.sin(th),port=aspect<1;
  const back=port?1.05:0.9,hgt=port?0.62:0.44,ahead=port?0.75:0.6;
  // a cue ball near a rail puts the camera out over the wood: it climbs, so the rail doesn't cover the ball
  const px=cx-dx*back,pz=cz-dz*back,over=Math.max(0,Math.abs(px)-(HX-0.1),Math.abs(pz)-(HZ-0.1));
  // and over a raised cue (it would run past the lens)
  const overCue=R+back*Math.tan(rise)+0.18;
  camT.pos.set(px,Math.max(hgt+over*0.9,Math.min(overCue,1.7)),pz);camT.look.set(cx+dx*ahead,0,cz+dz*ahead);camT.up.set(0,1,0);
}
// after the strike: high behind the shot, the whole table in view (found by trying distances against the
// table's outer corners, with the scoreboard's strip kept clear)
const fitCam=new THREE.PerspectiveCamera();
function watchTarget(th){
  const pitch=0.98,dx=Math.cos(th),dz=Math.sin(th);
  const dir=new THREE.Vector3(-dx*Math.cos(pitch),Math.sin(pitch),-dz*Math.cos(pitch));
  const E=HX+RAIL+WOOD,F=HZ+RAIL+WOOD,corners=[];
  for(const x of [-E,E])for(const z of [-F,F])corners.push(new THREE.Vector3(x,0.05,z));
  // the table's middle, nudged a little along the shot (where the balls are heading)
  const look=new THREE.Vector3(dx*0.08,0,dz*0.08);
  fitCam.fov=camera.fov;fitCam.aspect=camera.aspect;fitCam.near=0.02;fitCam.far=30;fitCam.updateProjectionMatrix();
  let lo=0.3,hi=10;const v=new THREE.Vector3();
  for(let k=0;k<22;k++){
    const mid=(lo+hi)/2;
    fitCam.position.copy(look).addScaledVector(dir,mid);fitCam.up.set(0,1,0);fitCam.lookAt(look);fitCam.updateMatrixWorld();
    const ok=corners.every(p=>{v.copy(p).project(fitCam);return Math.abs(v.x)<0.94&&v.y>-0.94&&v.y<0.8});
    if(ok)hi=mid;else lo=mid;
  }
  camT.pos.copy(look).addScaledVector(dir,hi);camT.look.copy(look);camT.up.set(0,1,0);
}
function camStep(dt,rate=7){
  const k=1-Math.exp(-dt*rate);
  cam.pos.lerp(camT.pos,k);cam.look.lerp(camT.look,k);cam.up.lerp(camT.up,k).normalize();
  camera.position.copy(cam.pos);camera.up.copy(cam.up);camera.lookAt(cam.look);
}

// ---------- game state ----------
const G={
  mode:'menu',          // 'menu' | 'play' | 'over'
  vs:'cpu',level:1,race:1,racks:[0,0],
  balls:[],turn:0,phase:'idle', // 'aim' | 'place' | 'roll' | 'cpu' | 'wait'
  inHand:false,kitchen:false,breakShot:false,
  aim:0,power:0,spinX:0,spinY:0,
  shot:null,drops:[],
  shots:0,fouls:0,       // SOLO: one player clears the rack, counting the shots
  game:'9',              // '9' | '8'
  group:[null,null],     // 8-ball: each player's group, 'S' (solids 1-7) or 'T' (stripes 9-15); null while open
  why:'',                // 8-ball: how the last rack was lost on the 8, for the result card
  // online: each side counts its players from itself (0 is this device, 1 the other), so "turn", "group" and
  // "racks" mean the same thing on both screens once flipped. The racks come from a shared seed; every finished
  // shot is numbered (shotNo), and after a dropped connection the side further on is the truth
  seed:null,rackNo:0,shotNo:0,lastWin:0,
};
const ONLINE=()=>G.vs==='online';
const human=()=>(G.vs!=='cpu'&&!ONLINE())||G.turn===0;
const ballN=n=>G.balls.find(b=>b.n===n);
const lowest=()=>Math.min(...G.balls.filter(b=>b.on&&b.n>0).map(b=>b.n));
const EIGHT=()=>G.game==='8';
// the same seed gives the same rack (mulberry32)
const seeded=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const rack=()=>{const r=ONLINE()&&G.seed!==null?seeded(G.seed+G.rackNo*7919):Math.random;return EIGHT()?rack8(r):rack9(r)};
const winBall=()=>EIGHT()?8:9;
// 8-ball (2026-11-17, from an agreed mock-up): no called pockets. The table is open after the break; the first
// ball pocketed legally after it gives its shooter that group. Clear your group, then the 8 wins; the 8 down
// before that, or on a foul, loses. An 8 on the break is spotted again. Every other foul: ball in hand anywhere.
// SOLO: any ball but the 8, the 8 last; an early 8 is spotted again as a foul
const inGroup=(n,g)=>g==='S'?n>=1&&n<=7:g==='T'?n>=9&&n<=15:n>0&&n!==8;
// the balls this player may hit first
function targets(p=G.turn,balls=G.balls){
  if(!EIGHT())return [Math.min(...balls.filter(b=>b.on&&b.n>0).map(b=>b.n))];
  const g=G.vs==='solo'?null:G.group[p];
  const left=balls.filter(b=>b.on&&inGroup(b.n,g)).map(b=>b.n);
  return left.length?left:[8];
}
// the ball the cue first points at on a turn: the lowest (9-ball), or the nearest it may hit (8-ball)
function aimBall(){
  const c=ballN(0),tg=targets();
  return tg.map(ballN).filter(Boolean).sort((a,b)=>Math.hypot(a.x-c.x,a.z-c.z)-Math.hypot(b.x-c.x,b.z-c.z))[0];
}
const NAMES=()=>G.vs==='cpu'?['YOU','CPU']:ONLINE()?['YOU','RIVAL']:G.vs==='solo'?['YOU','SHOTS '+G.shots]:['P1','P2'];

function syncMeshes(){
  for(let n=0;n<=NBALLS;n++){
    const b=ballN(n),m=meshes[n];
    m.visible=!!b&&b.on;
    if(b&&b.on)m.position.set(b.x,R,b.z);
  }
}

// ---------- HUD ----------
const banner=$('banner');let bannerT=0;
function say(text,sub='',sec=1.4,foul=false){
  banner.innerHTML='';banner.append(text);
  if(sub){const s=document.createElement('small');s.textContent=sub;banner.append(s)}
  banner.className='banner show'+(foul?' foul':'');bannerT=sec;
}
function drawBallIcon(c,n){
  const g=c.getContext('2d'),w=c.width,r=w/2-2;g.clearRect(0,0,w,w);
  if(!n)return;
  g.save();g.beginPath();g.arc(w/2,w/2,r,0,Math.PI*2);g.clip();
  g.fillStyle=n>8?IVORY:BALL_COL[n];g.fillRect(0,0,w,w);
  if(n>8){g.fillStyle=BALL_COL[n];g.fillRect(0,w*0.24,w,w*0.52)}
  g.fillStyle=IVORY;g.beginPath();g.arc(w/2,w/2,r*0.52,0,Math.PI*2);g.fill();
  g.fillStyle='#16130f';g.font=`bold ${Math.round(r*0.72)}px "Helvetica Neue",Arial,sans-serif`;g.textAlign='center';g.textBaseline='middle';
  g.fillText(String(n),w/2,w/2+1);
  const sh=g.createRadialGradient(w*0.36,w*0.32,1,w/2,w/2,r*1.1);sh.addColorStop(0,'rgba(255,255,255,.35)');sh.addColorStop(0.5,'rgba(255,255,255,0)');sh.addColorStop(1,'rgba(0,0,0,.35)');
  g.fillStyle=sh;g.fillRect(0,0,w,w);g.restore();
}
function hud(){
  const names=NAMES();
  for(const i of [0,1]){
    const el=$('name'+i);el.textContent=names[i];
    if(G.race>1&&G.vs!=='solo'){const s=document.createElement('small');s.textContent=G.racks[i];el.append(s)}
    $('pl'+i).classList.toggle('turn',G.vs==='solo'||G.turn===i);
  }
  // BALL ON: 9-ball, the lowest ball; 8-ball, the shooter's group by name (OPEN until it's decided), or the 8
  const tg=G.balls.length?targets():[0],word=EIGHT()&&tg[0]!==8?(G.vs==='solo'?'OPEN':{S:'SOLIDS',T:'STRIPES'}[G.group[G.turn]]||'OPEN'):'';
  $('ballon').style.display=word?'none':'';$('ontx').style.display=word?'':'none';$('ontx').textContent=word;
  if(!word)drawBallIcon($('ballon'),tg[0]);
  // 8-ball against someone: each player's seven under their name, dimmed once down
  const rows=EIGHT()&&G.vs!=='solo';
  $('board').classList.toggle('eight',rows);
  for(const i of [0,1]){
    const mb=$('mb'+i),g=rows?G.group[i]:null,key=g?g+G.balls.map(b=>b.on?1:0).join(''):'';
    if(mb.dataset.key===key)continue;
    mb.dataset.key=key;mb.innerHTML='';
    if(!g)continue;
    for(let n=g==='S'?1:9,k=0;k<7;k++,n++){
      const s=document.createElement('span'),col=BALL_COL[n];
      s.style.background=g==='S'?col:`linear-gradient(${IVORY} 0 27%,${col} 27% 73%,${IVORY} 73%)`;
      if(!ballN(n)?.on)s.className='gone';
      mb.append(s);
    }
  }
  const mine=human()&&(G.phase==='aim'||G.phase==='place');
  $('spin').hidden=!mine||G.phase==='place';
  $('move').hidden=!(mine&&G.inHand);
  const mv=$('move');mv.lastChild.textContent=G.phase==='place'?'SET':'MOVE';
  // online, the other's turn: the line under the table says so
  // (the how-to line: only until the match's first shot, and while placing the ball in hand)
  const hint=$('hint'),theirs=ONLINE()&&G.phase==='remote';hint.hidden=!(theirs||(mine&&(G.phase==='place'||G.shots===0)));
  hint.textContent=theirs?'相手が狙っています':G.phase==='place'?(G.kitchen?'手玉をドラッグ。ヘッドラインの手前に置けます':'手玉をドラッグして、好きな所に置けます')
    :TOUCH?'ダイヤルで向き、引いて離すと撞く':'右ドラッグで向き、左で引いて離すと撞く';
  $('aimdial').hidden=!(TOUCH&&mine&&G.phase==='aim');
}

// ---------- flow ----------
function startMatch(vs,breaker=0){
  G.vs=vs;G.racks=[0,0];G.mode='play';G.shots=0;G.fouls=0;G.rackNo=0;G.shotNo=0;sQueue={};endMsgs={};G.waitEnd=false;
  $('menu').classList.add('hidden');$('result').classList.add('hidden');
  for(const id of ['hud','pause','viewbtn'])$(id).hidden=false;
  sound.bgmStart();
  newRack(breaker);
}
function newRack(breaker){
  G.rackNo++;
  G.balls=rack();G.turn=breaker;G.breakShot=true;G.inHand=true;G.kitchen=true;G.drops=[];
  G.group=[null,null];G.why='';
  G.spinX=G.spinY=0;setSpinDot();
  const c=ballN(0);c.x=-HX/2-0.02;c.z=0;
  syncMeshes();
  G.aim=0;
  startTurn();
  say('BREAK',G.vs==='solo'?(EIGHT()?'少ない打数で、最後に8番を落とそう':'少ない打数で、9番まで取り切ろう'):G.vs==='cpu'?(G.turn===0?'あなたのブレイク':'CPUのブレイク')
    // online: the one who joined by the link learns here what the room's maker picked
    :ONLINE()?(EIGHT()?'8-BALL':'9-BALL')+' · '+(G.race>1?'RACE TO '+G.race:'1 RACK')+'　'+(G.turn===0?'あなたのブレイク':'相手のブレイク')
    :NAMES()[G.turn]+' のブレイク',ONLINE()?2.2:1.4);
}
function startTurn(){
  const c=ballN(0),t=aimBall();
  if(!G.breakShot&&t)G.aim=Math.atan2(t.z-c.z,t.x-c.x);
  G.power=0;
  // a free ball opens from above with the cue ball already in hand: starting in the aiming view with only a MOVE
  // button, nobody saw that the ball could be moved (2026-11-17). Not on the break, whose ball is already placed
  if(human()&&G.inHand&&!G.kitchen){G.phase='place';G.prevView=view;setView('top')}
  else if(human()){G.phase='aim'}
  else if(ONLINE()){G.phase='remote';setTimeout(pump,0)}
  else{G.phase='cpu';setTimeout(cpuTurn,700)}
  hud();
}
function shoot(th,power,sx,sy){
  const c=ballN(0);
  const speed=0.25+Math.pow(power,1.35)*7.6;
  // online: the other side plays the same strike from the same balls
  if(ONLINE()&&human())netSend({t:'s',n:G.shotNo,th,p:power,sx,sy,b:pack(G.balls)});
  G.shot={n:G.shotNo,th,ev:[],t:0,targets:targets(),first:null,rail:false,pots:[],seen:0,speed,start:copyBalls(G.balls),
    // what the replay needs to play the shot again: the physics is deterministic, so the start and the strike are
    // the whole tape (plus how the balls were turned, for the picture)
    strike:{th,speed,side:sx*0.5,height:sy*0.5},quats:Object.fromEntries(Object.entries(meshes).map(([n,m])=>[n,m.quaternion.clone()]))};
  strike(c,th,speed,sx*0.5,sy*0.5);
  sound.cue(speed,0);
  G.phase='roll';G.inHand=false;G.shots++;
  
  hud();
}
// the cue moves in to the ball, and only then is the ball struck
let stroke=null;
function release(th,power,sx,sy){
  stroke={t:0,th,power,sx,sy,from:pullDist(power)};
  G.phase='stroke';hud();
}
const pullDist=p=>0.012+p*0.22;

function endShot(){
  if(ONLINE()&&!onlineEnd())return;
  G.shotNo++;
  if(EIGHT()){endShot8();return}
  const s=G.shot,cueGone=!ballN(0).on,nine=s.pots.includes(9);
  let foul='';
  if(cueGone)foul='手玉がポケットに落ちた';
  else if(s.first===null)foul='どの玉にも当たらなかった';
  else if(s.first!==s.targets[0])foul=`最初に当てたのが ${s.targets[0]} 番じゃなかった`;
  else if(!s.rail&&!s.pots.length&&!G.breakShot)foul='当てたあと、どの玉もクッションに届かなかった';
  G.breakShot=false;
  if(nine&&!foul){
    const me=G.turn;
    startReplay(()=>{if(G.vs==='solo'){G.phase='wait';say('CLEAR!',G.shots+' 打で取り切り',2);setTimeout(()=>finish(0),2200)}else winRack(me)});
    return;
  }
  if(nine&&foul)respot(9);
  if(cueGone)cueBack();
  syncMeshes();
  afterShot(foul,s.pots.filter(n=>n!==0).length>0);
}
const cueBack=()=>{const c=ballN(0);c.on=true;const sp=freeNear(-HX/2,0);c.x=sp[0];c.z=sp[1];c.vx=c.vz=c.wx=c.wy=c.wz=0;c.moving=false};
const who=p=>G.vs==='cpu'?(p===0?'あなた':'CPU'):ONLINE()?(p===0?'あなた':'相手'):NAMES()[p];
// 8-ball's end of a shot (the rules are by EIGHT, above)
function endShot8(){
  const s=G.shot,me=G.turn,tg=s.targets,cueGone=!ballN(0).on,pots=s.pots.filter(n=>n>0),wasBreak=G.breakShot;
  const g=G.vs==='solo'?null:G.group[me];
  let foul='';
  if(cueGone)foul='手玉がポケットに落ちた';
  else if(!wasBreak){
    if(s.first===null)foul='どの玉にも当たらなかった';
    else if(!tg.includes(s.first))foul=tg[0]===8?'最初に8番に当てなかった':s.first===8?'最初に8番に当ててしまった':'最初に相手の組の玉に当てた';
    else if(!s.rail&&!pots.length)foul='当てたあと、どの玉もクッションに届かなかった';
  }
  G.breakShot=false;
  if(pots.includes(8)&&!wasBreak){
    const legal=!foul&&tg[0]===8;
    if(legal){
      startReplay(()=>{if(G.vs==='solo'){G.phase='wait';say('CLEAR!',G.shots+' 打で取り切り',2);setTimeout(()=>finish(0),2200)}else winRack(me)});
      return;
    }
    if(G.vs!=='solo'){
      const why=tg[0]!==8?'組の玉が残っているうちに、'+who(me)+'が8番を落とした'
        :who(me)+(cueGone?'が8番と一緒に手玉を落とした':'が8番を落としたショットでファウルした');
      if(cueGone)cueBack();
      syncMeshes();
      winRack(1-me,why);
      return;
    }
    // alone: the 8 too early goes back on the spot, as a foul
    if(!foul)foul='8番を最後より先に落とした';
  }
  if(pots.includes(8))respot(8);
  if(cueGone)cueBack();
  syncMeshes();
  // the open table: the first ball in legally (not on the break) gives its shooter that group
  if(!foul&&!wasBreak&&G.vs!=='solo'&&!g){
    const first=pots.find(n=>n!==8);
    if(first){
      const mine=first<8?'S':'T';G.group[me]=mine;G.group[1-me]=mine==='S'?'T':'S';
      const nm=mine==='S'?'ソリッド（1〜7）':'ストライプ（9〜15）',other=mine==='S'?'ストライプ（9〜15）':'ソリッド（1〜7）';
      say((G.vs==='cpu'?(me===0?'YOU':'CPU'):NAMES()[me])+': '+(mine==='S'?'SOLIDS':'STRIPES'),
        (G.vs==='cpu'||ONLINE())&&me===1?'あなたは'+other:nm+'が'+who(me)+'の組',1.8);
    }
  }
  const mineIn=wasBreak?pots.length>0:pots.some(n=>inGroup(n,G.vs==='solo'?null:G.group[me]));
  afterShot(foul,mineIn);
}
// a foul gives the other player (or, alone, yourself) the cue ball in hand; a ball of your own in keeps you at
// the table; anything else passes the turn
function afterShot(foul,again){
  if(foul&&G.vs==='solo'){
    // alone: a foul only costs the shot, and the cue ball goes where you like
    G.fouls++;G.inHand=true;G.kitchen=false;
    say('FOUL',foul+'。手玉を好きな所に置けます',2.2,true);
  }else if(foul){
    // name who gets the ball in hand: "the other side's" read as the CPU's even when the CPU had fouled
    G.turn=1-G.turn;G.inHand=true;G.kitchen=false;
    say('FOUL',foul+'。'+who(G.turn)+'のフリーボール',2.2,true);
  }else if(again||G.vs==='solo'){
    // pocketed something legally (or alone): shoot again
  }else{
    G.turn=1-G.turn;
    if(G.vs==='two')say(NAMES()[G.turn]+' TURN','',1.1);
  }
  startTurn();
}
function respot(n){
  const b=ballN(n);b.on=true;b.vx=b.vz=b.wx=b.wy=b.wz=0;b.moving=false;
  const sp=freeNear(HX/2,0);b.x=sp[0];b.z=sp[1];
}
// the nearest free spot, going back along the long string
function freeNear(x,z){
  for(let i=0;i<200;i++){const xx=x+(i%2?-1:1)*Math.ceil(i/2)*0.01;if(freeSpot(G.balls,xx,z,-1))return [xx,z]}
  return [x,z];
}
// why: the rack was lost on the 8 (8-ball), said instead of the winning shout
function winRack(p,why=''){
  G.racks[p]++;G.phase='wait';G.why=why;hud();
  const done=G.racks[p]>=G.race,res=G.vs==='cpu'?(p===0?'あなたの勝ち':'CPUの勝ち'):NAMES()[p]+' の勝ち';
  if(why)say('FOUL',why+'。'+res,2.6,true);
  else say(EIGHT()?'8-BALL!':'9-BALL!',res,2);
  setTimeout(()=>{if(done)finish(p);else newRack(p)},why?2800:2200);
}
function finish(who){
  G.mode='over';G.phase='idle';cueHold.visible=false;
  if(G.vs==='solo'){
    $('result-title').textContent='CLEAR';
    $('result-mode').textContent=(EIGHT()?'8-BALL':'9-BALL')+' · SOLO · FOUL '+G.fouls;
    $('result-score').textContent=G.shots+(G.shots===1?' SHOT':' SHOTS');
  }else{
    G.lastWin=who;
    $('result-title').textContent=G.vs==='cpu'||ONLINE()?(who===0?'YOU WIN':'YOU LOSE'):NAMES()[who]+' WINS';
    $('result-mode').textContent=(EIGHT()?'8-BALL · ':'9-BALL · ')+(G.vs==='cpu'?['EASY','NORMAL','HARD'][G.level]+' · ':ONLINE()?'ONLINE · ':'LOCAL · ')+(G.race>1?'RACE TO '+G.race:'1 RACK');
    $('result-score').textContent=G.racks[0]+' - '+G.racks[1];
  }
  // 8-ball keeps a line for how a rack lost on the 8 ended (empty otherwise), so the card is one shape all game
  $('result-why').hidden=!EIGHT()||G.vs==='solo';$('result-why').textContent=G.vs==='solo'?'':G.why;
  $('result').classList.remove('hidden');
  for(const id of ['spin','move','hint','aimdial'])$(id).hidden=true;
}

// ---------- the CPU ----------
const CPU_ERR=[{a:1.5,v:0.16,pick:0.5},{a:0.45,v:0.07,pick:0},{a:0.12,v:0.03,pick:0}];
const PLAN_H=1/400;
// how a shot from these balls turns out: legal?, what went in, where the cue ball ends
function judge(start,th,speed,sx=0,sy=0){
  const bs=copyBalls(start),tg=targets(G.turn,start);
  strike(bs[0],th,speed,sx,sy);
  const ev=simulate(bs,PLAN_H,10);
  let first=null,rail=false;const pots=[];
  for(const e of ev){
    if(e.t==='hit'&&first===null&&(e.a===0||e.b===0))first=e.a===0?e.b:e.a;
    else if(e.t==='cush'&&first!==null)rail=true;
    else if(e.t==='pocket')pots.push(e.a);
  }
  const foul=pots.includes(0)||!tg.includes(first)||(!rail&&!pots.length);
  return {foul,pots,bs,tg};
}
function clearPath(ax,az,bx,bz,skip){
  const dx=bx-ax,dz=bz-az,l=Math.hypot(dx,dz);
  for(const b of G.balls){
    if(!b.on||skip.includes(b.n))continue;
    let t=((b.x-ax)*dx+(b.z-az)*dz)/(l*l);t=clamp(t,0,1);
    if(Math.hypot(ax+dx*t-b.x,az+dz*t-b.z)<2*R-0.002)return false;
  }
  return true;
}
function score(r){
  const obj=r.pots.filter(n=>n>0);
  // 8-ball: the 8 in wins only once the group is gone; before that (or on a foul) it loses the rack
  if(EIGHT()&&obj.includes(8))return !r.foul&&r.tg[0]===8?1000:-2000;
  if(r.foul)return -100+obj.length;
  if(!EIGHT()&&obj.includes(9))return 1000;
  const mine=EIGHT()?obj.filter(n=>r.tg.includes(n)):obj;
  let s=mine.length*100;
  if(!mine.length)return s;
  // where the cue ball ends: near the next ball, not on a rail
  const c=r.bs[0];
  const nxt=EIGHT()?r.bs.filter(b=>b.on&&r.tg.includes(b.n)).sort((a,b)=>Math.hypot(a.x-c.x,a.z-c.z)-Math.hypot(b.x-c.x,b.z-c.z))[0]||r.bs.find(b=>b.on&&b.n===8)
    :r.bs.filter(b=>b.on&&b.n>0).sort((a,b)=>a.n-b.n)[0];
  if(nxt){const d=Math.hypot(c.x-nxt.x,c.z-nxt.z);s+=30-Math.abs(d-0.5)*30}
  if(Math.abs(c.x)>HX-0.08||Math.abs(c.z)>HZ-0.08)s-=12;
  return s;
}
function cpuPlan(){
  const start=copyBalls(G.balls),c=ballN(0);
  // the break: full power at the rack's apex (the 1 in 9-ball; whichever ball is there in 8-ball)
  if(G.breakShot){
    const a=G.balls.filter(b=>b.on&&b.n>0).sort((p,q)=>p.x-q.x)[0];
    return {th:wrap(Math.atan2(a.z-c.z,a.x-c.x)+(Math.random()-0.5)*0.004),speed:7.8,sx:0,sy:0};
  }
  const t=aimBall();let cands=[];
  for(const n of targets()){
    const o=ballN(n);
    for(const p of POCKETS){
      const ux=p.ax-o.x,uz=p.az-o.z,l=Math.hypot(ux,uz);
      const gx=o.x-ux/l*2*R,gz=o.z-uz/l*2*R,cx=gx-c.x,cz=gz-c.z,cl=Math.hypot(cx,cz);
      const cut=(cx*ux+cz*uz)/(cl*l);if(cut<0.22)continue;
      if(!clearPath(c.x,c.z,gx,gz,[0,o.n])||!clearPath(o.x,o.z,p.ax,p.az,[o.n]))continue;
      cands.push({th:Math.atan2(cz,cx),cut,l,cl});
    }
  }
  // 8-ball can offer dozens: only the likeliest (straighter, shorter) are tried in the physics
  cands=cands.sort((a,b)=>(b.cut*2-b.l-b.cl*0.5)-(a.cut*2-a.l-a.cl*0.5)).slice(0,8);
  let best=null;
  for(const k of cands){
    for(const sp of [0.9,1.4,2.0,2.8,3.8,5]){
      for(const sy of [0,0.3,-0.3]){
        const r=judge(start,k.th,sp,0,sy*0.5),sc=score(r)+k.cut*10-(sp>4?5:0);
        if(!best||sc>best.sc)best={th:k.th,speed:sp,sx:0,sy,sc,r};
      }
    }
  }
  // nothing straightforward goes in: look round for any shot that is legal (and pots something if it can)
  if(!best||best.sc<50){
    const base=Math.atan2(t.z-c.z,t.x-c.x);
    const tries=[];
    for(let i=-12;i<=12;i++)tries.push(base+i*0.012);
    for(let i=0;i<72;i++)tries.push(i*Math.PI/36);
    for(const th of tries)for(const sp of [1.6,3.2]){
      const r=judge(start,th,sp),sc=score(r);
      if(!best||sc>best.sc)best={th,speed:sp,sx:0,sy:0,sc,r};
    }
  }
  return best;
}
function cpuPlace(){
  // ball in hand: put the cue ball where a ball it may hit goes straight in to a pocket, a little way back
  const c=ballN(0);
  let best=null;
  for(const n of targets())for(const p of POCKETS){
    const t=ballN(n);
    const ux=p.ax-t.x,uz=p.az-t.z,l=Math.hypot(ux,uz);
    for(const back of [0.25,0.4,0.6]){
      const x=t.x-ux/l*(2*R+back),z=t.z-uz/l*(2*R+back);
      if(G.kitchen&&x>-HX/2)continue;
      if(!freeSpot(G.balls,x,z,0))continue;
      if(!clearPath(t.x,t.z,p.ax,p.az,[t.n])||!clearPath(x,z,t.x,t.z,[0,t.n]))continue;
      const sc=-l-Math.abs(back-0.4);
      if(!best||sc>best.sc)best={x,z,sc};
    }
  }
  if(best){c.x=best.x;c.z=best.z;syncMeshes()}
}
let cpuAnim=null;
function cpuTurn(){
  if(G.mode!=='play'||G.phase!=='cpu')return;
  if(G.inHand&&!G.breakShot)cpuPlace();
  const plan=cpuPlan(),E=CPU_ERR[G.level];
  let th=plan.th+(Math.random()-0.5)*2*E.a*Math.PI/180;
  let speed=plan.speed*(1+(Math.random()-0.5)*2*E.v);
  if(Math.random()<E.pick)th+=(Math.random()-0.5)*0.05;
  const power=Math.pow(clamp((speed-0.25)/7.6,0,1),1/1.35);
  // turn the cue to the shot, draw it back, strike
  cpuAnim={t:0,from:G.aim,th,power,sx:plan.sx,sy:plan.sy};G.rsx=plan.sx;G.rsy=plan.sy;
}

// ---------- the replay: the shot that won the rack, played again ----------
// (asked for 2026-11-17, after AIR HOCKEY's PRO STAGE replay; the passes as the user laid them out the same day.)
// 1: the whole table from behind the shot, 1x.
// 2: a low camera behind the pocket the 9 went into, from just before the 9 is struck: very slow (1/5) as it's hit,
//    faster and faster, 1x by the time it reaches the pocket.
// 3: short, right by the pocket: only the 9 going in, at 0.3x.
// (The first try slowed down as the 9 came in, after 1x: "the other way round is better".)
// Nothing is recorded but the shot's start and strike: the physics plays it again exactly. A pass that starts
// part-way runs the physics silently up to its start. Every hit is heard again at its moment, unaltered. A tap
// skips it.
let replay=null;
const REPLAY_PASSES=3;
function startReplay(done){
  const s=G.shot;
  // (not for a shot played only to catch up with the other side: see pump)
  if(!s?.strike||s.fast){done();return}
  // a look ahead: when the 9 is first struck, and when and where it drops
  const look=copyBalls(s.start);strike(look[0],s.strike.th,s.strike.speed,s.strike.side,s.strike.height);
  const ev=simulate(look,STEP,14),nine=ev.find(e=>e.t==='pocket'&&e.a===winBall());
  if(!nine){done();return}
  const hit=ev.find(e=>e.t==='hit'&&(e.a===winBall()||e.b===winBall()));
  replay={done,nine,hit:hit?hit.time:0};
  G.phase='replay';hideGuide();cueHold.visible=false;
  for(const id of ['spin','move','hint','gauge','aimdial'])$(id).hidden=true;
  $('replay').hidden=false;
  replayPass(0);
}
// where the 9 came in from (a unit vector pointing into the pocket)
function nineWay(){
  const r=replay,p=POCKETS[r.nine.p],v=Math.hypot(r.nine.vx,r.nine.vz);
  let ux=v>0.05?r.nine.vx/v:p.x-r.nine.x,uz=v>0.05?r.nine.vz/v:p.z-r.nine.z;const ul=Math.hypot(ux,uz)||1;
  return [ux/ul,uz/ul,p];
}
function replayPass(k){
  const s=G.shot,r=replay,d=r.nine.time;
  Object.assign(r,{pass:k,t:0,acc:0,ev:[],seen:0,drops:[]});
  r.from=k===0?0:k===1?Math.max(0,r.hit-0.12):Math.max(0,d-0.45);
  r.end=k===0?d+0.9:k===1?d+0.5:d+0.65;
  r.balls=copyBalls(s.start);
  strike(r.balls[0],s.strike.th,s.strike.speed,s.strike.side,s.strike.height);
  for(let n=0;n<=NBALLS;n++)meshes[n].quaternion.copy(s.quats[n]);
  // a pass that starts part-way: the physics runs silently up to it (the balls turning as they go)
  while(r.t<r.from){
    step(r.balls,STEP,null,r.t);r.t+=STEP;
    for(const b of r.balls){
      if(!b.on||!b.moving)continue;
      const w=Math.hypot(b.wx,b.wy,b.wz);
      if(w>1e-4){vTmp.set(b.wx/w,b.wy/w,b.wz/w);qTmp.setFromAxisAngle(vTmp,w*STEP);meshes[b.n].quaternion.premultiply(qTmp)}
    }
  }
  for(let n=0;n<=NBALLS;n++){const b=r.balls.find(b=>b.n===n);meshes[n].visible=!!b&&b.on}
  const [ux,uz,p]=nineWay();
  if(k===0)watchTarget(s.strike.th);
  else if(k===1){
    // behind the pocket, low, a little to one side, looking back up the 9's way in
    const a=0.35,cx=ux*Math.cos(a)-uz*Math.sin(a),cz=ux*Math.sin(a)+uz*Math.cos(a);
    camT.pos.set(p.x+cx*0.3,0.17,p.z+cz*0.3);camT.look.set(p.x-ux*0.42,0.0,p.z-uz*0.42);camT.up.set(0,1,0);
  }else{
    // close, over the cloth, behind and beside the 9 as it goes in: the hole in front of the lens (from beside
    // the pocket, low over the rail, the wood filled the picture)
    let sx=-uz,sz=ux;
    const over=(x,z)=>Math.abs(x)<HX-0.03&&Math.abs(z)<HZ-0.03;
    if(!over(p.x-ux*0.28+sx*0.1,p.z-uz*0.28+sz*0.1)){sx=-sx;sz=-sz}
    camT.pos.set(p.x-ux*0.28+sx*0.1,0.11,p.z-uz*0.28+sz*0.1);camT.look.set(p.x+ux*0.01,-0.01,p.z+uz*0.01);camT.up.set(0,1,0);
  }
  cam.pos.copy(camT.pos);cam.look.copy(camT.look);cam.up.copy(camT.up);
  if(r.from===0)sound.cue(s.strike.speed,0);
}
function replayRate(t){
  const r=replay,d=r.nine.time;
  if(r.pass===0)return 1;
  if(r.pass===1){
    // 1/5 as the 9 is hit, then faster and faster: 1x as it reaches the pocket
    const t0=r.hit,t1=Math.max(t0+0.35,d-0.1),k=clamp((t-t0)/(t1-t0),0,1);
    return 0.2+0.8*k*k;
  }
  // the 9 going in, at 0.3x; back to 1x once it's down
  if(t<d+0.35)return 0.3;
  return 0.3+0.7*clamp((t-(d+0.35))/0.15,0,1);
}
function replayStep(dt){
  const r=replay;
  r.acc+=dt*replayRate(r.t);
  while(r.acc>=STEP){step(r.balls,STEP,r.ev,r.t);r.t+=STEP;r.acc-=STEP}
  for(;r.seen<r.ev.length;r.seen++){
    const e=r.ev[r.seen],pan=clamp(e.x/HX,-1,1)*0.6;
    if(e.t==='hit')sound.ball(e.v,pan);
    else if(e.t==='cush')sound.cushion(e.v,pan);
    else if(e.t==='pocket')r.drops.push(newDrop(e,r.balls,pan));
  }
  r.drops=r.drops.filter(d=>dropStep(d,dt*replayRate(r.t)));
  if(r.t>=r.end){if(r.pass<REPLAY_PASSES-1)replayPass(r.pass+1);else endReplay()}
}
function endReplay(){
  const r=replay;if(!r)return;
  replay=null;$('replay').hidden=true;
  syncMeshes();G.phase='wait';
  r.done();
}

// ---------- input ----------
let drag=null;
// how much a finger's sideways move turns the shot, by how fast it moves (radians per CSS pixel): slow, a
// thirtieth of a degree a pixel, for the last touch on a cut; fast, ~0.4 deg a pixel, to swing round. The pull's
// own angle turned it ~0.3 deg a pixel at any speed: far too coarse to aim with (2026-11-17)
const TURN_FINE=0.0006,TURN_FAST=0.007,TURN_V0=150,TURN_V1=1800;
const turnRate=v=>TURN_FINE+(TURN_FAST-TURN_FINE)*clamp((v-TURN_V0)/(TURN_V1-TURN_V0),0,1)**1.6;
function screenAngle(vx,vy){return Math.atan2(-vy,vx)}
canvas.addEventListener('pointerdown',e=>{
  sound.unlock();
  if(e.pointerType==='mouse'&&e.button!==0)return;
  if(G.phase==='replay'){endReplay();return}
  if(G.mode!=='play'||!human())return;
  if(G.phase==='aim'){
    drag={id:e.pointerId,sx:e.clientX,sy:e.clientY,on:false,phi:0,power:0,ts:e.timeStamp,v:0};
    try{canvas.setPointerCapture(e.pointerId)}catch{}
  }else if(G.phase==='place'){
    const p=tablePoint(e),c=ballN(0);
    if(p)drag={id:e.pointerId,place:true,ox:c.x-p.x,oz:c.z-p.z};
    try{canvas.setPointerCapture(e.pointerId)}catch{}
  }
});
canvas.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id)return;
  if(drag.place){
    const p=tablePoint(e);if(!p)return;
    let x=clamp(p.x+drag.ox,-HX+R,HX-R),z=clamp(p.z+drag.oz,-HZ+R,HZ-R);
    if(G.kitchen)x=Math.min(x,-HX/2);
    if(freeSpot(G.balls,x,z,0)){const c=ballN(0);c.x=x;c.z=z;syncMeshes()}
    return;
  }
  const vx=drag.sx-e.clientX,vy=drag.sy-e.clientY,len=Math.hypot(vx,vy);
  const phi=screenAngle(vx,vy);
  if(!drag.on){
    if(len<12)return;
    drag.on=true;drag.phi=phi;
    // seen from above, the shot goes where the pull points (as a slingshot); from behind the ball it starts
    // where the cue already points, and the pull only turns it from there
    // (not with a mouse: its cue was already aimed with the right button, see 'aiming before the pull' below)
    if(view==='top'&&e.pointerType!=='mouse'){
      camera.updateMatrixWorld();
      const r=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),u=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
      const wx=vx*r.x-vy*u.x,wz=vx*r.z-vy*u.z;
      G.aim=Math.atan2(wz,wx);
    }
  }else{
    // the finger's move across the pull turns the shot, finely when it moves slowly
    const side=wrap(phi-drag.phi)*Math.max(len,1),dt=Math.max(1,e.timeStamp-drag.ts)/1000;
    drag.v+=(Math.abs(side)/dt-drag.v)*Math.min(1,dt*12);
    G.aim=wrap(G.aim-Math.sign(side)*Math.abs(side)*turnRate(drag.v));
    drag.phi=phi;drag.ts=e.timeStamp;
  }
  // back near where the finger went down: the shot is called off (the gauge stops and empties)
  drag.near=len<12;
});
// ---- aiming before the pull (2026-11-18: "turning before pulling is so hard") ----
// which way a move to the right on the screen turns the shot: toward the camera's right
function screenSign(){
  camera.updateMatrixWorld();
  const r=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);
  return Math.sign(-Math.sin(G.aim)*r.x+Math.cos(G.aim)*r.z)||1;
}
// a sideways move of dx pixels at speed v (px/s): finely when slow, as the pull's own sideways turn
const turnBy=(dx,v)=>{G.aim=wrap(G.aim+dx*turnRate(v)*screenSign())};
// PC: the right button held down turns the cue (seen from above it points at the pointer; from behind the ball a
// sideways move turns it, finely when slow). Just moving the mouse does nothing: following it with no button down
// turned the cue on the way to every button (2026-11-18). The wheel and the arrow keys still turn it finely
let rdrag=null;
canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType!=='mouse'||e.button!==2||G.mode!=='play'||!human()||G.phase!=='aim')return;
  rdrag={id:e.pointerId,x:e.clientX,t:e.timeStamp,v:0};
  try{canvas.setPointerCapture(e.pointerId)}catch{}
  rightAim(e);
});
function rightAim(e){
  if(view==='top'){
    const p=tablePoint(e),c=ballN(0);
    if(p&&Math.hypot(p.x-c.x,p.z-c.z)>R)G.aim=Math.atan2(p.z-c.z,p.x-c.x);
    return;
  }
  const dx=e.clientX-rdrag.x,dt=Math.max(1,e.timeStamp-rdrag.t)/1000;
  rdrag.v+=(Math.abs(dx)/dt-rdrag.v)*Math.min(1,dt*12);
  turnBy(dx,rdrag.v);
  rdrag.x=e.clientX;rdrag.t=e.timeStamp;
}
canvas.addEventListener('pointermove',e=>{if(rdrag&&e.pointerId===rdrag.id&&G.phase==='aim')rightAim(e)});
canvas.addEventListener('pointerup',e=>{if(rdrag&&e.button===2)rdrag=null});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
// touch: the dial under the table. Rubbing it sideways turns the cue before any pull, slowly for the last touch
const dial=$('aimdial');let dialDrag=null;
dial.addEventListener('pointerdown',e=>{
  sound.unlock();
  if(G.mode!=='play'||!human()||G.phase!=='aim')return;
  dialDrag={id:e.pointerId,x:e.clientX,t:e.timeStamp,v:0,shift:0};
  try{dial.setPointerCapture(e.pointerId)}catch{}
});
dial.addEventListener('pointermove',e=>{
  const d=dialDrag;if(!d||e.pointerId!==d.id||G.phase!=='aim')return;
  const dx=e.clientX-d.x,dt=Math.max(1,e.timeStamp-d.t)/1000;
  d.v+=(Math.abs(dx)/dt-d.v)*Math.min(1,dt*12);
  turnBy(dx,d.v);
  // the dial's ticks slide with the finger
  d.shift+=dx;dial.style.backgroundPositionX=d.shift+'px';
  d.x=e.clientX;d.t=e.timeStamp;
});
for(const ev of ['pointerup','pointercancel'])dial.addEventListener(ev,()=>{dialDrag=null});
function endDrag(e){
  if(!drag||e.pointerId!==drag.id)return;
  const d=drag;drag=null;
  if(d.place)return;
  if(d.on&&!d.near)release(G.aim,Math.max(0.02,G.power),G.spinX,G.spinY);
  G.power=0;
}
// the power (Monster Strike's way, 2026-11-17): while the cue is pulled the gauge runs up and down by itself,
// and letting go strikes with whatever it shows. How far the finger pulls only aims; it never sets the power
const GAUGE_UP=1.1;
function gaugeStep(dt){
  if(!drag||!drag.on||drag.place)return;
  if(drag.near){drag.t=0;G.power=0;return}
  drag.t=(drag.t||0)+dt;
  const ph=(drag.t/GAUGE_UP)%2;
  G.power=ph<1?ph:2-ph;
}
canvas.addEventListener('pointerup',endDrag);
canvas.addEventListener('pointercancel',e=>{if(drag&&e.pointerId===drag.id){drag=null;G.power=0}});
// fine turns on a PC: the wheel and the arrow keys
canvas.addEventListener('wheel',e=>{if(G.phase==='aim'&&human()){G.aim=wrap(G.aim+Math.sign(e.deltaY)*(e.shiftKey?0.006:0.0006));e.preventDefault()}},{passive:false});
addEventListener('keydown',e=>{
  if(G.phase!=='aim'||!human())return;
  const k=e.shiftKey?0.01:0.0006;
  if(e.key==='ArrowLeft'){G.aim=wrap(G.aim-k);e.preventDefault()}
  if(e.key==='ArrowRight'){G.aim=wrap(G.aim+k);e.preventDefault()}
});
const ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-R);
function tablePoint(e){
  const v=new THREE.Vector2(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);
  ray.setFromCamera(v,camera);const p=new THREE.Vector3();
  return ray.ray.intersectPlane(plane,p)?p:null;
}

// the hit point. The small cue ball (bottom left) shows it where it really is on the face, and a tap opens the
// big one to set it. spinX/Y run -1..1 over the half of the radius a tip may strike (past it: a miscue)
const face=$('spinface'),dot=$('spindot'),big=$('hpball'),bigDot=$('hpdot'),spinName=$('spinname');
const SPIN_NAME=()=>{
  const v=G.spinY>0.3?'押し':G.spinY<-0.3?'引き':'',h=G.spinX>0.3?'右':G.spinX<-0.3?'左':'';
  return v&&h?v+'・'+h:v||(h?h+'ひねり':'センター');
};
function setSpinDot(){
  const r=(face.clientWidth||62)/4,R2=(big.clientWidth||200)/4;
  dot.style.transform=`translate(${G.spinX*r}px,${-G.spinY*r}px)`;
  bigDot.style.transform=`translate(${G.spinX*R2}px,${-G.spinY*R2}px)`;
  spinName.textContent=SPIN_NAME();
}
function spinAt(e){
  const b=big.getBoundingClientRect(),r=b.width/4;
  let x=(e.clientX-b.left-b.width/2)/r,y=-(e.clientY-b.top-b.height/2)/r;
  const l=Math.hypot(x,y);if(l>1){x/=l;y/=l}
  if(l<0.1){x=y=0}
  G.spinX=x;G.spinY=y;setSpinDot();
}
const hp=$('hitpoint');
face.addEventListener('click',()=>{sound.unlock();if(G.phase!=='aim'||!human())return;hp.classList.remove('hidden');setSpinDot()});
let spinDrag=null;
big.addEventListener('pointerdown',e=>{spinDrag=e.pointerId;try{big.setPointerCapture(e.pointerId)}catch{}spinAt(e)});
big.addEventListener('pointermove',e=>{if(spinDrag===e.pointerId)spinAt(e)});
big.addEventListener('pointerup',()=>spinDrag=null);
$('hp-center').addEventListener('click',()=>{G.spinX=G.spinY=0;setSpinDot()});
$('hp-ok').addEventListener('click',()=>hp.classList.add('hidden'));

$('move').addEventListener('click',()=>{
  sound.unlock();
  if(G.phase==='aim'&&G.inHand){G.phase='place';G.prevView=view;setView('top')}
  else if(G.phase==='place'){G.phase='aim';setView(G.prevView||'aim')}
  hud();
});
function setView(v){view=v;for(const b of $('viewbtn').children)b.classList.toggle('on',b.dataset.v===(v==='top'?'top':'aim'))}
$('viewbtn').addEventListener('click',e=>{const b=e.target.closest('button');sound.unlock();if(!b||G.phase==='place')return;setView(b.dataset.v)});
$('sound').addEventListener('click',()=>{sound.unlock();sound.setOn(!sound.on);paintSound()});
function paintSound(){const b=$('sound');b.setAttribute('aria-pressed',sound.on);b.textContent=sound.on?'♪ ON':'♪ OFF'}
paintSound();

// ---------- menu ----------
const menu=$('menu');
function goScreen(name){for(const p of menu.querySelectorAll('.panel'))p.hidden=p.dataset.screen!==name}
menu.addEventListener('click',e=>{
  sound.unlock();
  const go=e.target.closest('[data-go]');if(go){goScreen(go.dataset.go);if(go.dataset.go==='online')resetOnline();return}
  const seg=e.target.closest('.seg button');
  if(seg){
    const box=seg.parentElement;for(const b of box.children)b.classList.toggle('on',b===seg);
    const note=box.parentElement.querySelector(`[data-note-of="${box.dataset.pick}"]`);if(note&&seg.dataset.note)note.textContent=seg.dataset.note;
    // the game: the table behind the menu is racked for it at once
    if(box.dataset.pick==='game'&&G.game!==seg.dataset.v){G.game=seg.dataset.v;G.balls=rack();syncMeshes()}
    return;
  }
  const st=e.target.closest('[data-start]');
  if(st){
    const panel=st.closest('.panel');
    const pick=k=>+panel.querySelector(`[data-pick="${k}"] .on`)?.dataset.v;
    if(st.dataset.start==='cpu')G.level=pick('level');
    G.race=pick('race')||1;
    startMatch(st.dataset.start);
  }
});
function toMenu(){
  // leaving an online match by hand: the other is told, and the room is left
  leaveOnline();
  sound.bgmStop();G.mode='menu';G.phase='idle';G.vs='cpu';drag=null;cpuAnim=null;stroke=null;cueHold.visible=false;
  for(const id of ['hud','pause','viewbtn','spin','move','hint','gauge','aimdial'])$(id).hidden=true;
  $('result').classList.add('hidden');$('pausemenu').classList.add('hidden');$('cut').classList.add('hidden');
  menu.classList.remove('hidden');goScreen('top');
  G.balls=rack();syncMeshes();setView('aim');
}
// online the match can't be held for one side: the card (to leave by) opens over a table that plays on
let paused=false;
$('pause').addEventListener('click',()=>{if(!ONLINE()){paused=true;sound.bgmStop()}$('pausemenu').classList.remove('hidden')});
$('resume').addEventListener('click',()=>{sound.unlock();if(paused){paused=false;sound.bgmStart()}$('pausemenu').classList.add('hidden')});
$('pause-menu').addEventListener('click',()=>{paused=false;toMenu()});
$('again').addEventListener('click',()=>{if(ONLINE())onlineAgain();else startMatch(G.vs)});
$('result-menu').addEventListener('click',toMenu);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&G.mode==='play'&&!ONLINE()){paused=true;sound.bgmStop();$('pausemenu').classList.remove('hidden')}});

// ---------- online ----------
// AIR HOCKEY's way (net.js, copied from it): a room by its code brings two together, the match runs peer to peer.
// BILLIARDS has no room server of its own: AIR HOCKEY's only passes messages between two sockets, so it serves both,
// the codes keeping the rooms apart. Turn-based, so little goes across: the shooter's aim and gauge while aiming
// ('a', newest wins), the strike with the balls it starts from ('s'), and how the shot ended ('e': first ball hit,
// rail, pots and where everything stopped). The shooter's ending is the truth: the other side plays the same shot
// in its own physics for the picture, then takes the shooter's result before the rules are applied on both sides
const pageUrl=()=>{try{return new URL(top.location.href)}catch{return new URL(location.href)}};
const ROOM_CODE=Q.get('room')||pageUrl().searchParams.get('room')||'';
const ROOM_SERVER=Q.get('roomserver')||'wss://airhockey-room.mt-kiryu.workers.dev';
const ON_HINT='部屋を作って、URLを相手に送ると始まります。部屋を作った人がブレイク',ON_SENT='このURLを開いた人が相手になります',ON_EMPTY='相手はまだいません';
const ON_STATE={waiting:'相手を待っています…',joining:'相手を待っています…',connecting:'つないでいます…'};
const ON_WHY={bye:'相手が退出しました',full:'この部屋は満員です',busy:'いまは混んでいて、つなげませんでした',left:'相手との接続が切れました',lost:'相手との接続が切れました',closed:'部屋につながりませんでした',error:'部屋につながりませんでした'};
const CUT_TRY='相手とのつながりが切れました。台はこのまま残っています。つなぎ直しています…',CUT_GONE='つながりませんでした。RECONNECT で入り直せます';
// a phone hands the link to its share sheet (LINE and the rest); elsewhere the button copies it
const CAN_SHARE=!!navigator.share&&navigator.maxTouchPoints>0,ON_COPY=CAN_SHARE?'SEND LINK':'COPY LINK';
const ICO_SHARE='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 12.5V2.5M6.3 6 10 2.3 13.7 6"/><path d="M6.5 8.5H5A1.5 1.5 0 0 0 3.5 10v6A1.5 1.5 0 0 0 5 17.5h10a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 15 8.5h-1.5"/></svg>',
  ICO_COPY='<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1.8"/><path d="M13 4.5v-.2A1.3 1.3 0 0 0 11.7 3H4.3A1.3 1.3 0 0 0 3 4.3v7.4A1.3 1.3 0 0 0 4.3 13h.2"/></svg>';
const onState=$('on-state'),onMake=$('on-make'),onCopy=$('on-copy'),onUrl=$('on-url'),onSeat=$('on-seat'),onOp=$('on-op'),onRe=$('on-re');
let net=null,roomCode='',roomTries=0,roomTimer=0,matchNo=0,seed0=0,lastAim=0,byeSeen=false;
const ROOM_TRIES=6;
const pack=bs=>bs.map(b=>[b.n,b.x,b.z,b.on?1:0]);
function unpack(a){
  for(const [n,x,z,on] of a){const b=ballN(n);if(!b)continue;Object.assign(b,{x,z,on:!!on,vx:0,vz:0,wx:0,wy:0,wz:0,moving:false})}
  syncMeshes();
}
const netSend=o=>{if(net&&net.how)net.send(o)};
function copyLabel(t){onCopy.innerHTML=(CAN_SHARE?ICO_SHARE:ICO_COPY)+'<span></span>';onCopy.lastChild.textContent=t}
function resetOnline(){
  if(roomCode&&net)return;
  roomCode='';roomTries=0;clearTimeout(roomTimer);
  $('on-game').textContent=(EIGHT()?'8-BALL':'9-BALL')+' · RACE';$('on-race').hidden=false;
  onRe.hidden=true;onMake.hidden=false;onCopy.hidden=true;onUrl.hidden=true;copyLabel(ON_COPY);
  onState.textContent=ON_HINT;onSeat.textContent=ON_EMPTY;onOp.classList.remove('in');
}
// the room's link, shown without the scheme, the room's code picked out
function showLink(code){
  const u=pageUrl();u.searchParams.set('room',code);
  const shown=u.href.replace(/^https?:\/\//,''),at=shown.lastIndexOf(code),b=document.createElement('b'),pre=document.createElement('span');
  pre.textContent=shown.slice(0,at);b.textContent=code;onUrl.replaceChildren(pre,b);onUrl.dataset.link=u.href;
  onUrl.hidden=false;onCopy.hidden=false;onMake.hidden=true;
}
// leaving by hand: said over the match's own channel first (a peer-to-peer channel that closes reaches the other
// as a lost connection before the room's own goodbye does), then the room is left
function leaveOnline(){clearTimeout(roomTimer);if(net){const n=net;net=null;if(n.how)n.send({t:'bye'});setTimeout(()=>n.close(),150)}roomCode='';G.seed=null}
function joinRoom(code){
  clearTimeout(roomTimer);roomCode=code;byeSeen=false;
  if(net){const n=net;net=null;n.on={};n.end('bye')}
  const me=net=new Net(`${ROOM_SERVER}/room/${code}`,{
    state:s=>{onSeat.textContent=ON_STATE[s]||'';onOp.classList.toggle('in',s==='connecting');if(!onUrl.hidden)onState.textContent=s!=='connecting'?ON_SENT:''},
    joined:()=>{roomTries=0},
    ready:role=>{
      // back after a dropped connection: the two compare where they are, and the one further on is the truth
      if(G.mode!=='menu'&&ONLINE()){netSend({t:'sync',st:snapshot()});$('cut').classList.add('hidden');return}
      // the one who made the room starts the match, with its game and race
      if(role===0){
        const race=+$('on-race').querySelector('.on').dataset.v||1,seed=crypto.getRandomValues(new Uint32Array(1))[0]>>>1;
        netSend({t:'start',game:G.game,race,seed});beginOnline(G.game,race,seed,0);
      }
    },
    msg:netMsg,
    left:why=>{
      if(net!==me)return;
      net=null;
      // during a match: the table stays, and the room is joined again (a few tries, then by hand)
      if(ONLINE()&&G.mode!=='menu'){
        const cut=$('cut');cut.classList.remove('hidden');$('pausemenu').classList.add('hidden');drag=null;
        if(why==='bye'||byeSeen){$('cut-note').textContent=ON_WHY.bye;$('cut-re').hidden=true;roomCode='';return}
        $('cut-re').hidden=false;
        if(roomTries<ROOM_TRIES){$('cut-note').textContent=CUT_TRY;if(!document.hidden)roomTimer=setTimeout(()=>joinRoom(code),Math.min(5000,600+1000*roomTries++))}
        else $('cut-note').textContent=CUT_GONE;
        return;
      }
      // waiting for the other: a phone that went to another app to send the link drops its socket; join again
      if(roomCode&&['closed','error','full'].includes(why)&&roomTries<ROOM_TRIES){
        if(!document.hidden)roomTimer=setTimeout(()=>joinRoom(code),Math.min(5000,400+1000*roomTries++));
        return;
      }
      roomCode='';resetOnline();onState.textContent=ON_WHY[why]||ON_WHY.lost;
    },
  },{relayOnly:Q.has('relay')});
}
function beginOnline(game,race,seed,breaker){
  G.game=game;G.race=race;seed0=seed;matchNo=0;G.seed=seed;
  for(const b of document.querySelectorAll('[data-pick="game"] button'))b.classList.toggle('on',b.dataset.v===game);
  startMatch('online',breaker);
}
// REMATCH: either side may press it, and both start the same match: its seed comes from the first one's, and
// the last match's loser breaks. Pressed on both sides, the second one's message finds the match already on
function onlineAgain(){
  if(!net?.how){$('cut').classList.remove('hidden');$('cut-note').textContent=CUT_GONE;$('cut-re').hidden=false;return}
  netSend({t:'again',k:matchNo+1});startAgain(matchNo+1);
}
function startAgain(k){
  if(k<=matchNo)return;
  matchNo=k;G.seed=(seed0+k*104729)>>>0;
  startMatch('online',1-G.lastWin);
}
function snapshot(){
  return {n:G.shotNo,b:pack(G.balls),turn:G.turn,group:G.group,racks:G.racks,breakShot:G.breakShot,inHand:G.inHand,kitchen:G.kitchen,rackNo:G.rackNo,matchNo,mode:G.mode};
}
// the other side is further on: take its table, every "me" and "them" swapped
function adopt(st){
  if(replay){replay=null;$('replay').hidden=true}
  stroke=null;drag=null;G.drops=[];
  G.shotNo=st.n;G.turn=1-st.turn;G.group=[st.group[1],st.group[0]];G.racks=[st.racks[1],st.racks[0]];
  Object.assign(G,{breakShot:st.breakShot,inHand:st.inHand,kitchen:st.kitchen,rackNo:st.rackNo});
  unpack(st.b);
}
// what the other side sends is checked before anything is done with it: a message of the wrong shape, a number
// that isn't one, a ball off the table or one that doesn't exist, is dropped (a tampered page can't break this
// one, or start a match over a match). The room's own limits (AIR HOCKEY's room worker: connections per minute
// from one address, message size and rate per socket) stand in front of this; BILLIARDS sends far less than they
// allow (the aim ~16 a second, a strike or an ending ~1 kB)
const num=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
// (a pocketed ball keeps where it went down, past the cushions: the bounds reach the pockets)
const ballsOk=a=>Array.isArray(a)&&a.length>=1&&a.length<=16&&a.every(e=>Array.isArray(e)&&e.length===4&&Number.isInteger(e[0])&&e[0]>=0&&e[0]<=15
  &&num(e[1],-HX-0.2,HX+0.2)&&num(e[2],-HZ-0.2,HZ+0.2)&&(e[3]===0||e[3]===1))&&new Set(a.map(e=>e[0])).size===a.length;
const potsOk=a=>Array.isArray(a)&&a.length<=16&&a.every(n=>Number.isInteger(n)&&n>=0&&n<=15);
function msgOk(m){
  if(!m||typeof m!=='object')return false;
  switch(m.t){
    case 'bye':case 'need':return true;
    case 'start':return G.mode==='menu'&&(m.game==='8'||m.game==='9')&&(m.race===1||m.race===3)&&Number.isInteger(m.seed)&&m.seed>=0;
    case 'again':return Number.isInteger(m.k)&&m.k===matchNo+1&&G.mode!=='menu';
    case 'a':return num(m.a,-10,10)&&num(m.p,0,1)&&num(m.sx,-1,1)&&num(m.sy,-1,1)&&num(m.x,-HX,HX)&&num(m.z,-HZ,HZ);
    // a strike only on the other's turn
    // shots numbered from this one on (this side may be behind, a page in the background by many, never ahead)
    case 's':return Number.isInteger(m.n)&&m.n>=G.shotNo&&m.n<=G.shotNo+64&&num(m.th,-10,10)&&num(m.p,0,1)&&num(m.sx,-1,1)&&num(m.sy,-1,1)&&ballsOk(m.b);
    case 'e':return Number.isInteger(m.n)&&m.n>=G.shotNo&&m.n<=G.shotNo+64&&(m.first===null||(Number.isInteger(m.first)&&m.first>=0&&m.first<=15))&&typeof m.rail==='boolean'&&potsOk(m.pots)&&ballsOk(m.b);
    case 'sync':{
      const s=m.st;
      return !!s&&Number.isInteger(s.n)&&s.n>=0&&ballsOk(s.b)&&(s.turn===0||s.turn===1)&&Array.isArray(s.group)&&s.group.length===2
        &&s.group.every(g=>g===null||g==='S'||g==='T')&&Array.isArray(s.racks)&&s.racks.length===2&&s.racks.every(r=>Number.isInteger(r)&&r>=0&&r<=3)
        &&typeof s.breakShot==='boolean'&&typeof s.inHand==='boolean'&&typeof s.kitchen==='boolean'&&Number.isInteger(s.rackNo)&&Number.isInteger(s.matchNo);
    }
  }
  return false;
}
function netMsg(m){
  if(!msgOk(m))return;
  if(m.t==='bye'){byeSeen=true;return}
  if(m.t==='need'){if(G.mode==='play')netSend({t:'sync',st:snapshot()});return}
  if(m.t==='start'){beginOnline(m.game,m.race,m.seed,1);return}
  if(m.t==='again'){startAgain(m.k);return}
  if(m.t==='sync'){
    $('cut').classList.add('hidden');
    if(m.st.matchNo!==matchNo||G.mode!=='play')return;
    if(m.st.n>G.shotNo){adopt(m.st);sQueue={};endMsgs={};G.waitEnd=false;startTurn()}
    else if(m.st.n===G.shotNo&&G.phase!=='replay'&&G.phase!=='roll'&&G.phase!=='wait')startTurn();
    return;
  }
  if(G.mode!=='play')return;
  // the other is aiming: its cue, its gauge and (with the ball in hand) where it puts the cue ball
  if(m.t==='a'&&G.phase==='remote'){
    G.aim=m.a;G.power=m.p;G.rsx=m.sx;G.rsy=m.sy;
    const c=ballN(0);if(c&&(c.x!==m.x||c.z!==m.z)){c.x=m.x;c.z=m.z;syncMeshes()}
    return;
  }
  // the other's strikes and endings, by shot number. This side may be behind: its own playing of a shot runs a
  // little after the shooter's, and a page in the background plays nothing at all (its frames stop) while the
  // other goes on shooting. So they wait in order, and pump() plays them as this side gets to each one
  if(m.t==='s'){sQueue[m.n]=m;pump();return}
  if(m.t==='e'){
    endMsgs[m.n]=m;
    if(G.waitEnd&&m.n===G.shotNo){G.waitEnd=false;endShot()}
    else{pump();setTimeout(()=>{if(endMsgs[m.n]===m&&G.shot?.n===m.n&&G.phase==='roll'){acc=0;G.drops=[];G.phase='wait';endShot()}},1500)}
  }
}
let sQueue={},endMsgs={};
// the next of the other's shots, if this side has got to it. Behind (more of them waiting, or the page hidden): no
// stroke and no rolling to watch, the shot's ending is taken as soon as it is in, and its replay is skipped
function pump(){
  if(!ONLINE()||G.mode!=='play')return;
  const behind=n=>document.hidden||!!sQueue[n+1];
  if(G.phase==='roll'&&G.shot&&endMsgs[G.shot.n]&&(G.shot.fast||behind(G.shot.n))){acc=0;G.drops=[];G.phase='wait';endShot();return}
  if(G.phase!=='remote')return;
  const m=sQueue[G.shotNo];if(!m)return;
  delete sQueue[G.shotNo];
  unpack(m.b);G.rsx=m.sx;G.rsy=m.sy;G.aim=m.th;G.power=m.p;
  if(behind(m.n)||endMsgs[m.n]){shoot(m.th,m.p,m.sx,m.sy);G.shot.fast=true;pump()}
  else release(m.th,m.p,m.sx,m.sy);
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)pump()});
// at the end of an online shot: the shooter sends how it ended; the other waits for that, then takes it
function onlineEnd(){
  const s=G.shot;
  if(human()){netSend({t:'e',n:s.n,first:s.first,rail:s.rail,pots:s.pots,b:pack(G.balls)});return true}
  const m=endMsgs[s.n];
  // (an ending that never comes, whatever the reason: after a while this side asks for the other's whole table)
  if(!m){G.waitEnd=true;const n=s.n;setTimeout(()=>{if(G.waitEnd&&G.shot?.n===n)netSend({t:'need'})},5000);return false}
  delete endMsgs[s.n];
  s.first=m.first;s.rail=m.rail;s.pots=m.pots;unpack(m.b);
  for(const d of G.drops)meshes[d.n].visible=false;G.drops=[];
  return true;
}
// while this side aims, the other sees it: a few times a second, newest wins
function streamAim(now){
  if(!ONLINE()||!net?.how||G.mode!=='play'||!human()||!['aim','place','stroke'].includes(G.phase)||now-lastAim<60)return;
  lastAim=now;const c=ballN(0);
  net.stream({t:'a',a:G.aim,p:G.power,sx:G.spinX,sy:G.spinY,x:c.x,z:c.z});
}
onMake.addEventListener('click',()=>{
  sound.unlock();
  const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',code=Array.from(crypto.getRandomValues(new Uint8Array(6)),v=>A[v%A.length]).join('');
  showLink(code);onState.textContent=ON_SENT;
  joinRoom(code);
});
onRe.addEventListener('click',()=>{sound.unlock();roomTries=0;if(roomCode)joinRoom(roomCode)});
$('cut-re').addEventListener('click',()=>{sound.unlock();roomTries=0;$('cut-note').textContent=CUT_TRY;if(roomCode)joinRoom(roomCode)});
$('cut-menu').addEventListener('click',toMenu);
onCopy.addEventListener('click',async()=>{
  const url=onUrl.dataset.link;
  if(CAN_SHARE){
    try{await navigator.share({title:'BILLIARDS',url});return}
    catch(e){if(e?.name==='AbortError')return}
  }
  try{await navigator.clipboard.writeText(url);copyLabel('COPIED')}catch{onState.textContent='上のURLを長押しでコピーしてください'}
});
$('on-back').addEventListener('click',()=>{leaveOnline();resetOnline();goScreen('top')});
// back from another app: if the room's socket went meanwhile, join again at once
function rejoinRoom(){
  if(document.hidden||!roomCode||(net&&!net.dead))return;
  roomTries=0;joinRoom(roomCode);
}
document.addEventListener('visibilitychange',rejoinRoom);
addEventListener('pageshow',rejoinRoom);addEventListener('online',rejoinRoom);
// opened by a room's link: straight into that room
if(/^[A-Z0-9]{4,8}$/.test(ROOM_CODE)){
  goScreen('online');resetOnline();
  $('on-game').textContent='ゲームとRACEは、部屋を作った人が決めます';$('on-race').hidden=true;
  onMake.hidden=true;onState.textContent='';onSeat.textContent=ON_STATE.connecting;
  joinRoom(ROOM_CODE);
}else copyLabel(ON_COPY);

// ---------- frame ----------
let last=performance.now(),acc=0;
const qTmp=new THREE.Quaternion(),vTmp=new THREE.Vector3();
function frame(now){
  const dt=Math.min(0.05,(now-last)/1000);last=now;
  if(!paused)update(dt);
  streamAim(now);
  render(dt);
}
function update(dt){
  gaugeStep(dt);
  if(G.phase==='replay'&&replay)replayStep(dt);
  if(bannerT>0){bannerT-=dt;if(bannerT<=0)banner.classList.remove('show')}
  // the CPU lines up, draws back and strikes
  if(cpuAnim&&G.phase==='cpu'){
    const a=cpuAnim;a.t+=dt;
    const k=clamp(a.t/0.9,0,1),e=k*k*(3-2*k);
    G.aim=wrap(a.from+wrap(a.th-a.from)*e);
    G.power=a.t<1.1?0:clamp((a.t-1.1)/0.7,0,1)*a.power;
    if(a.t>2.1){cpuAnim=null;G.aim=a.th;release(a.th,a.power,a.sx,a.sy);}
  }
  if(stroke){
    stroke.t+=dt;
    if(stroke.t>=0.07){const s=stroke;stroke=null;shoot(s.th,s.power,s.sx,s.sy)}
  }
  if(G.phase==='roll'){
    const s=G.shot;acc+=dt;
    while(acc>=STEP){
      step(G.balls,STEP,s.ev,s.t);s.t+=STEP;acc-=STEP;
    }
    for(;s.seen<s.ev.length;s.seen++){
      const e=s.ev[s.seen],pan=clamp(e.x/HX,-1,1)*0.6;
      if(e.t==='hit'){
        if(s.first===null&&(e.a===0||e.b===0))s.first=e.a===0?e.b:e.a;
        sound.ball(e.v,pan);
      }else if(e.t==='cush'){
        if(s.first!==null)s.rail=true;
        sound.cushion(e.v,pan);
      }else if(e.t==='pocket'){
        s.pots.push(e.a);
        G.drops.push(newDrop(e,G.balls,pan));
      }
    }
    if(!anyMoving(G.balls)&&!G.drops.length){acc=0;G.phase='wait';setTimeout(endShot,250)}
  }else acc=0;
  // a pocketed ball drops into its cup
  G.drops=G.drops.filter(d=>dropStep(d,dt));
}
// a ball over a hole falls (2026-11-17: it used to slide to the hole's middle and sink, its spin stopped dead,
// which a slowed replay gave away). It goes on with the speed and spin it had, gravity pulls it down, the lip rolls
// it in while it still hangs on the edge, and the leather wall and bottom stop it
const DROP_G=9.81,CUP_FLOOR=-0.09;
// The pocket's sound is heard when the falling ball first meets the pocket (its back, the leather or the cup's
// floor), not when its centre crosses the hole's edge: in the slowed replay that came well before the ball was
// seen to go in (2026-11-18). A slowed drop meets it later, so the sound waits with it
function newDrop(e,balls,pan=0){
  const b=balls.find(q=>q.n===e.a),p=POCKETS[e.p];
  return {n:e.a,p,t:0,x:e.x,z:e.z,y:R,vx:e.vx,vz:e.vz,vy:0,wx:b?.wx||0,wy:b?.wy||0,wz:b?.wz||0,snd:{v:e.v,pan}};
}
function dropSound(d){if(d.snd){sound.pocket(d.snd.v,d.snd.pan);d.snd=null}}
function dropStep(d,dt){
  const m=meshes[d.n],p=d.p;
  // (steps short enough that a fast ball moves no more than ~4 mm in one, or it goes through the pocket's back)
  const N=Math.max(4,Math.ceil(Math.hypot(d.vx,d.vz)*dt/0.004));
  for(let h=dt/N,i=0;i<N;i++){
    d.t+=h;
    d.vy-=DROP_G*h;
    const ox=d.x-p.x,oz=d.z-p.z,dist=Math.hypot(ox,oz)||1e-6,lim=p.r-R,nx=ox/dist,nz=oz/dist;
    if(dist>lim){
      const vn=d.vx*nx+d.vz*nz;
      if(vn>0||d.y<=-R*0.5){
        // going on out, at any height, it meets the pocket's back (the rail's face above the hole, the leather
        // below), and below the lip the leather all round: eased back inside (a snap showed as a jerk in slow
        // motion), giving up most of its push. Only the leather used to stop it, so a ball that came in hard
        // crossed the hole before it had fallen that far and flew out over the rail (2026-11-18)
        const k=dist+(lim-dist)*0.35;d.x=p.x+nx*k;d.z=p.z+nz*k;
        if(vn>0){d.vx-=vn*nx*1.3;d.vz-=vn*nz*1.3;d.vx*=0.7;d.vz*=0.7;dropSound(d)}
      }else{
        // still on the lip and not heading out: the edge under it tips it in toward the middle
        const a=DROP_G*1.4*Math.min(1,(dist-lim)/R);
        d.vx-=nx*a*h;d.vz-=nz*a*h;
      }
    }
    d.x+=d.vx*h;d.z+=d.vz*h;d.y+=d.vy*h;
    if(d.y<CUP_FLOOR+R){dropSound(d);d.y=CUP_FLOOR+R;d.vy=-d.vy*0.25;d.vx*=0.6;d.vz*=0.6}
  }
  m.visible=true;m.position.set(d.x,d.y,d.z);
  const w=Math.hypot(d.wx,d.wy,d.wz);
  if(w>1e-4){vTmp.set(d.wx/w,d.wy/w,d.wz/w);qTmp.setFromAxisAngle(vTmp,w*dt);m.quaternion.premultiply(qTmp)}
  // deep in the cup and settled: out of sight
  if(d.t>0.9||(d.y<CUP_FLOOR+R+0.002&&d.t>0.5)){dropSound(d);m.visible=false;return false}
  return true;
}
function render(dt){
  // the balls: positions, and their turning from the physics' spin
  for(const b of replay?replay.balls:G.balls){
    if(!b.on)continue;
    const m=meshes[b.n];m.position.set(b.x,R,b.z);
    const w=Math.hypot(b.wx,b.wy,b.wz);
    // (a slowed replay turns the balls slower too)
    if(w>1e-4&&(G.phase==='roll'||replay)){
      vTmp.set(b.wx/w,b.wy/w,b.wz/w);qTmp.setFromAxisAngle(vTmp,w*dt*(replay?replayRate(replay.t):1));m.quaternion.premultiply(qTmp);
    }
  }
  const c=ballN(0),aiming=G.mode==='play'&&(G.phase==='aim'||G.phase==='cpu'||G.phase==='remote'||G.phase==='stroke');
  // the camera
  if(replay){/* the replay holds its own camera */}
  else if(view==='top'||G.mode!=='play')topTarget();
  else if(c&&(aiming||G.phase==='place'))aimTarget(c.x,c.z,G.aim);
  else if(G.phase==='roll'||G.phase==='wait')watchTarget(G.shot?.th??G.aim);
  if(G.mode==='menu'){camT.pos.set(-2.2,1.25,1.5);camT.look.set(0.15,0,0);camT.up.set(0,1,0)}
  // ?debug: hold the camera somewhere (__bl.lock)
  if(camLock){camT.pos.set(...camLock[0]);camT.look.set(...camLock[1]);camT.up.set(0,1,0)}
  camStep(dt,G.mode==='menu'?2:drag?14:G.phase==='roll'?3.2:6);
  // the cue: behind the ball, drawn back with the power, raised a little
  cueHold.visible=aiming&&!!c;
  if(cueHold.visible){
    const th=G.aim,pull=stroke?stroke.from*(1-clamp(stroke.t/0.07,0,1))-0.004:pullDist(G.power);
    cueHold.position.set(c.x,R,c.z);
    cueHold.rotation.set(0,-th,0);
    // the cue lies along -x of the holder (the lathe's +y turned to point back), raised as far as it must be
    rise+=(cueRise(th)-rise)*Math.min(1,dt*18);
    cue.rotation.set(0,0,Math.PI/2-rise);
    // the tip meets the face where the spin was set, and draws back along the cue's own line
    // (the CPU's or the online rival's own tip position while it is their shot)
    const sX=human()?G.spinX:G.rsx||0,sY=human()?G.spinY:G.rsy||0;
    cue.position.set(-(R+pull)*Math.cos(rise),sY*R*0.5+(R+pull)*Math.sin(rise),sX*R*0.5);
  }
  // the guide
  if(G.mode==='play'&&human()&&G.phase==='aim'&&c)drawGuide(G.aim);else hideGuide();
  // the gauge
  const showG=G.mode==='play'&&(drag?.on||((G.phase==='cpu'||G.phase==='remote')&&G.power>0));
  $('gauge').hidden=!showG;
  if(showG){$('gfill').style.height=(G.power*100).toFixed(1)+'%';$('gpct').textContent=Math.round(G.power*100)}
  renderer.render(scene,camera);
}

// the menu's table: a fresh rack under the lamp
G.balls=rack();syncMeshes();
renderer.setAnimationLoop(frame);

if(DEBUG)window.__bl={replayState:()=>replay&&{pass:replay.pass,t:replay.t,nine:replay.nine.time,hit:replay.hit},lock:(p,l)=>{camLock=p?[p,l]:null},G,ballN,camera,cam,camT,setView,shoot,simulate,cpuPlan,meshes,scene,sound,
  frame:t=>frame(t),get view(){return view},get net(){return net}};
