// Billiards physics, pure (no Three.js, no DOM): the game, the CPU's look-ahead and node tests all run this.
// Units: metres, seconds. x along the table (-HX head end .. +HX foot end), z across (-HZ..HZ), y up.
// A 7-foot table (a bar box): playing field 1.981 x 0.991 m between the cushion noses, balls 57.15 mm (2026-11-17:
// on the 9-foot table, 2.54 x 1.27 m, the balls looked small on a phone).
// A ball slides (the cloth's friction turns its slide into roll), rolls (a little rolling resistance), and
// spins about the vertical (side spin, which the cloth wears down and the cushions use). Ball-ball contacts are
// equal-mass, near elastic, and leave the spin alone: a stun-hit cue ball stops and its spin then draws or
// follows it, as on a real table.

export const R=0.028575,HX=0.9905,HZ=0.49525;
const G=9.81,MU_S=0.2,MU_R=0.011,SPIN_DECEL=9,E_BALL=0.94,E_CUSH=0.76,MU_CUSH=0.14;
export const STEP=1/800;

// the pockets: corner mouths ~116 mm between the cushion noses, side mouths ~130 mm (WPA). Jaws turn into the
// rail at 142 deg (corners) and 104 deg (sides) to the cushion face, so a pocket narrows to its throat
const CM=0.082,SM=0.065,RAIL=0.05;
export const POCKETS=[];
export const SEGS=[];
{
  const seg=(ax,az,bx,bz)=>{
    const dx=bx-ax,dz=bz-az,l=Math.hypot(dx,dz);
    SEGS.push({ax,az,bx,bz,dx:dx/l,dz:dz/l,l});
  };
  // a jaw from a nose point (px,pz), turned phi from the cushion face going away from the pocket (fx,fz),
  // into the rail (outward normal ox,oz)
  const jaw=(px,pz,fx,fz,ox,oz,phi)=>{
    const c=Math.cos(phi),s=Math.sin(phi);
    const dx=fx*c+ox*s,dz=fz*c+oz*s;
    // as long as it takes to reach the rail's depth
    const len=RAIL/Math.max(0.2,dx*ox+dz*oz);
    seg(px,pz,px+dx*len,pz+dz*len);
  };
  const C=142*Math.PI/180,S=104*Math.PI/180;
  for(const sz of [-1,1]){
    // long rails: corner to side pocket, both halves
    for(const sx of [-1,1]){
      const a=[sx*(HX-CM),sz*HZ],b=[sx*SM,sz*HZ];
      seg(a[0],a[1],b[0],b[1]);
      jaw(a[0],a[1],-sx,0,0,sz,C);
      jaw(b[0],b[1],sx,0,0,sz,S);
    }
  }
  for(const sx of [-1,1]){
    // short rails
    const a=[sx*HX,-(HZ-CM)],b=[sx*HX,HZ-CM];
    seg(a[0],a[1],b[0],b[1]);
    jaw(a[0],a[1],0,1,sx,0,C);
    jaw(b[0],b[1],0,-1,sx,0,C);
  }
  // where a ball drops (the pocket's centre, for the picture and for the drop), and the mouth's middle (aim point)
  for(const sx of [-1,1])for(const sz of [-1,1])
    POCKETS.push({x:sx*(HX+0.035),z:sz*(HZ+0.035),r:0.064,ax:sx*(HX-CM/2+0.004),az:sz*(HZ-CM/2+0.004),corner:true,sx,sz});
  for(const sz of [-1,1])
    POCKETS.push({x:0,z:sz*(HZ+0.05),r:0.064,ax:0,az:sz*(HZ+0.004),corner:false,sx:0,sz});
}

// is the ball's centre over a pocket's hole? Then nothing holds it up: it drops. The hole is the one drawn (the
// game cuts the cloth and the wood on these circles), so a ball goes in exactly when it looks over the hole
// (2026-11-17: a "throat line" rule left a ball sitting with its centre over the drawn hole). Each hole sits back
// behind its mouth, far enough that a ball running along a rail past a side pocket keeps its centre off it
function pocketOf(b){
  const i=POCKETS.findIndex(p=>Math.hypot(b.x-p.x,b.z-p.z)<p.r);
  if(i>=0)return i;
  // (a ball that somehow got out past the rails goes to the nearest pocket)
  if(Math.abs(b.x)>HX+0.12||Math.abs(b.z)>HZ+0.12)return POCKETS.reduce((best,p,i)=>Math.hypot(p.x-b.x,p.z-b.z)<Math.hypot(POCKETS[best].x-b.x,POCKETS[best].z-b.z)?i:best,0);
  return -1;
}

export function makeBall(n,x,z){return {n,x,z,vx:0,vz:0,wx:0,wy:0,wz:0,on:true,moving:false}}
export function copyBalls(bs){return bs.map(b=>({...b}))}

// the cue strikes the cue ball: dir (radians, in the x-z plane), speed (m/s), tip offset on the ball's face
// (side: right +, height: top +, each a share of R, kept inside half the radius)
export function strike(b,dir,speed,side=0,height=0){
  const dx=Math.cos(dir),dz=Math.sin(dir);
  const k=5*speed/(2*R);
  b.vx=dx*speed;b.vz=dz*speed;
  // top/bottom: spin about the horizontal axis across the shot (rolling at 0.4 R)
  b.wx=k*height*dz;b.wz=-k*height*dx;
  // side: right english turns the ball clockwise seen from above
  b.wy=-k*side;
  b.moving=true;
}

// one step for every ball; events go to ev (array of {t:'hit'|'cush'|'pocket', ...}), time: the shot's clock
export function step(balls,h,ev,time){
  for(const b of balls){
    if(!b.on||!b.moving)continue;
    // the slip of the ball's contact with the cloth
    const ux=b.vx+R*b.wz,uz=b.vz-R*b.wx,us=Math.hypot(ux,uz);
    if(us>1e-4){
      const dv=MU_S*G*h;
      if(us<3.5*dv){
        // the slide ends within this step: it rolls from here on
        b.vx-=ux*2/7;b.vz-=uz*2/7;
        b.wx=b.vz/R;b.wz=-b.vx/R;
      }else{
        const nx=ux/us,nz=uz/us;
        b.vx-=dv*nx;b.vz-=dv*nz;
        b.wx+=2.5*dv*nz/R;b.wz-=2.5*dv*nx/R;
      }
    }else{
      const v=Math.hypot(b.vx,b.vz),dv=MU_R*G*h;
      if(v<=dv){b.vx=b.vz=0}else{b.vx-=b.vx/v*dv;b.vz-=b.vz/v*dv}
      b.wx=b.vz/R;b.wz=-b.vx/R;
    }
    if(b.wy){const d=SPIN_DECEL*h;b.wy=Math.abs(b.wy)<=d?0:b.wy-Math.sign(b.wy)*d}
    b.x+=b.vx*h;b.z+=b.vz*h;
    if(Math.abs(b.vx)+Math.abs(b.vz)<1e-5&&Math.abs(b.wx)+Math.abs(b.wz)<1e-3&&Math.abs(b.wy)<0.05){
      b.vx=b.vz=b.wx=b.wz=b.wy=0;b.moving=false;
    }
  }
  // balls against balls (twice over, so a frozen rack passes the break's push through)
  for(let pass=0;pass<2;pass++){
    for(let i=0;i<balls.length;i++){
      const a=balls[i];if(!a.on)continue;
      for(let j=i+1;j<balls.length;j++){
        const b=balls[j];if(!b.on||(!a.moving&&!b.moving))continue;
        const dx=b.x-a.x,dz=b.z-a.z,d2=dx*dx+dz*dz;
        if(d2>=4*R*R||d2===0)continue;
        const d=Math.sqrt(d2),nx=dx/d,nz=dz/d;
        const vn=(a.vx-b.vx)*nx+(a.vz-b.vz)*nz;
        // pull apart
        const push=(2*R-d)/2;
        a.x-=nx*push;a.z-=nz*push;b.x+=nx*push;b.z+=nz*push;
        if(vn<=0)continue;
        const j2=vn*(1+E_BALL)/2;
        a.vx-=j2*nx;a.vz-=j2*nz;b.vx+=j2*nx;b.vz+=j2*nz;
        a.moving=b.moving=true;
        ev?.push({t:'hit',a:a.n,b:b.n,v:vn,x:(a.x+b.x)/2,z:(a.z+b.z)/2,time});
      }
    }
  }
  // cushions and jaws
  for(const b of balls){
    if(!b.on||!b.moving)continue;
    // nowhere near a rail: nothing to check
    if(Math.abs(b.x)<HX-R-0.002&&Math.abs(b.z)<HZ-R-0.002)continue;
    for(const s of SEGS){
      let t=(b.x-s.ax)*s.dx+(b.z-s.az)*s.dz;t=t<0?0:t>s.l?s.l:t;
      const cx=s.ax+s.dx*t,cz=s.az+s.dz*t;
      const ox=b.x-cx,oz=b.z-cz,d2=ox*ox+oz*oz;
      if(d2>=R*R||d2===0)continue;
      const d=Math.sqrt(d2),nx=ox/d,nz=oz/d;
      b.x=cx+nx*R;b.z=cz+nz*R;
      const vn=b.vx*nx+b.vz*nz;
      if(vn>=0)continue;
      // tangential slip of the contact point (the ball's spin about the vertical drags it along the rail)
      const tx=-nz,tz=nx;
      const vt=b.vx*tx+b.vz*tz,slip=vt+b.wy*R;
      const imp=Math.min(MU_CUSH*(1+E_CUSH)*-vn,Math.abs(slip)*2/7)*Math.sign(slip);
      b.vx+=-(1+E_CUSH)*vn*nx-imp*tx;
      b.vz+=-(1+E_CUSH)*vn*nz-imp*tz;
      b.wy*=0.55;
      // the roll that carried it into the rail is mostly spent on the rail
      const rn=(R*b.wz)*nx+(-R*b.wx)*nz;
      b.wz-=0.6*rn*nx/R;b.wx+=0.6*rn*nz/R;
      ev?.push({t:'cush',a:b.n,v:-vn,x:b.x,z:b.z,time});
    }
  }
  // over a hole: it drops (also a ball that came to rest in this very step: it must not stay sitting over a hole)
  for(const b of balls){
    if(!b.on)continue;
    const p=pocketOf(b);
    if(p>=0){
      b.on=false;b.moving=false;
      ev?.push({t:'pocket',a:b.n,p,v:Math.hypot(b.vx,b.vz),vx:b.vx,vz:b.vz,x:b.x,z:b.z,time});
    }
  }
}

export function anyMoving(balls){return balls.some(b=>b.on&&b.moving)}

// run a shot to its end (for the CPU's look-ahead and for tests). Returns the events
export function simulate(balls,h=STEP,maxT=14){
  const ev=[];let t=0;
  while(anyMoving(balls)&&t<maxT){step(balls,h,ev,t);t+=h}
  return ev;
}

// the 9-ball rack: 1 at the apex on the foot spot, 9 in the middle, the rest anywhere
export function rack9(rand=Math.random){
  const fx=HX/2,gap=2*R+0.0002,rowX=gap*Math.sqrt(3)/2;
  const spots=[];
  [1,2,3,2,1].forEach((n,i)=>{for(let k=0;k<n;k++)spots.push([fx+i*rowX,(k-(n-1)/2)*gap])});
  const rest=[2,3,4,5,6,7,8];
  for(let i=rest.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[rest[i],rest[j]]=[rest[j],rest[i]]}
  const balls=[makeBall(0,-HX/2,0)];
  let r=0;
  spots.forEach((s,i)=>{const n=i===0?1:i===4?9:rest[r++];balls.push(makeBall(n,s[0],s[1]))});
  return balls;
}

// the 8-ball rack: fifteen in a triangle, its apex on the foot spot, the 8 in the middle of the third row, a solid
// and a stripe in the two back corners, the rest anywhere
export function rack8(rand=Math.random){
  const fx=HX/2,gap=2*R+0.0002,rowX=gap*Math.sqrt(3)/2;
  const spots=[];
  [1,2,3,4,5].forEach((n,i)=>{for(let k=0;k<n;k++)spots.push([fx+i*rowX,(k-(n-1)/2)*gap])});
  const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
  const solids=shuffle([1,2,3,4,5,6,7]),stripes=shuffle([9,10,11,12,13,14,15]);
  const corners=rand()<0.5?[solids.pop(),stripes.pop()]:[stripes.pop(),solids.pop()];
  const rest=shuffle([...solids,...stripes]);
  const balls=[makeBall(0,-HX/2,0)];
  let r=0;
  spots.forEach((s,i)=>{const n=i===4?8:i===10?corners[0]:i===14?corners[1]:rest[r++];balls.push(makeBall(n,s[0],s[1]))});
  return balls;
}

// is this spot free for a ball (inside the cushions, off every other ball)?
export function freeSpot(balls,x,z,skip=0){
  if(Math.abs(x)>HX-R||Math.abs(z)>HZ-R)return false;
  return balls.every(b=>!b.on||b.n===skip||Math.hypot(b.x-x,b.z-z)>=2*R+0.001);
}
