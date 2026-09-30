// PICLEA core. One document (photo framing + up to a few text layers) and one drawing routine, draw(),
// used for the picker tiles, the large preview, the editor and the saved file alike, so all of them
// match. Coordinates are output pixels of the finished image.
(() => {
const {JA,EN,BYFAM,weightsOf,loadPhoto,loadFace,faceReady}=window.PICLEA;
const $=s=>document.querySelector(s);
const OUT_W=1080;
// iPhone and iPad save through the share sheet; Android and computers download (a computer's share
// dialog sends things to people, it does not save them). iPadOS reports itself as a Mac with touch.
const OS=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)?'ios':/Android/.test(navigator.userAgent)?'android':'pc';
function download(files,urls){files.forEach((f,i)=>setTimeout(()=>{const a=document.createElement('a');a.href=urls?.[i]||URL.createObjectURL(f);a.download=f.name;a.click()},i*350))}
const RATIOS=[['4:5',4/5],['1:1',1],['9:16',9/16],['元の比率',0]];
const PALETTE=['#ffffff','#4b3f3a','#1f1d1b','#f3e9dc','#e8c9c1','#b76e5a','#8f9e7e','#3c4f6b','#d4a94f','#a898b8'];
const GRADS=[['#eadfd6','#d6c2b3'],['#efdcd8','#d5b5ae'],['#e3e4d9','#c3c8b3'],['#e8e2dc','#c9c0b7'],['#e6e0e8','#c7bdcb'],['#f0e6da','#dcc7ae']];
const INK='#4b3f3a',SHADOW={on:true,color:'#28190f',a:.35,x:0,y:3,blur:30};
// Vertical writing: the font's own vertical forms when it has them, otherwise rotate or nudge.
const VFORM={'、':'︑','。':'︒','，':'︐','：':'︓','；':'︔','！':'︕','？':'︖','…':'︙','‥':'︰','—':'︱','―':'︱','–':'︲','（':'︵','）':'︶','(':'︵',')':'︶','｛':'︷','｝':'︸','〔':'︹','〕':'︺','【':'︻','】':'︼','《':'︽','》':'︾','〈':'︿','〉':'﹀','「':'﹁','」':'﹂','『':'﹃','』':'﹄','［':'﹇','］':'﹈'};
const ROTATE=/[ー－‐\-~〜～＝=｜|<>＜＞→←A-Za-z0-9]/, PUNCT=/[、。，．,.]/, SMALL=/[ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ]/;
// Line breaking: never start a line with closing marks or small kana, never end one with an opening mark.
const NOSTART=/^[、。，．,.)）」』】〕〉》！？!?ー〜～…‥・ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ]/, NOEND=/[（(「『【〔〈《]$/;

// A work is several pages (one photo each, same ratio for an Instagram carousel). The page being
// worked on lives in D; P.pages keeps plain copies and is brought up to date by syncCur().
const D={ratio:'4:5',W:OUT_W,H:Math.round(OUT_W*5/4),photo:{s:1,ox:0,oy:0},layers:[],sel:null,photoId:null};
const P={pages:[],cur:0};
const photos=new Map();
let uid=1;
const newId=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const cur=()=>photos.get(D.photoId);
const listeners={};
const emit=(n,d)=>(listeners[n]||[]).forEach(f=>f(d));
const on=(n,f)=>(listeners[n]??=[]).push(f);

const clone=o=>JSON.parse(JSON.stringify(o,(k,v)=>k.startsWith('_')?undefined:v));
const sel=()=>D.layers.find(l=>l.id===D.sel);
const isText=L=>!!L&&!L.type,isImg=L=>!!L&&L.type==='image',isShape=L=>!!L&&L.type==='shape';
// A line is a shape too: w is its length and h its thickness. 点線 is a row of round dots.
const isLine=L=>isShape(L)&&(L.kind==='line'||L.kind==='dots');
const bgOf=pg=>pg.bg||{type:'photo'},photoBg=pg=>bgOf(pg).type==='photo';
function syncCur(){P.pages[P.cur]=clone(D)}
function loadInto(pg){for(const k of Object.keys(D))delete D[k];Object.assign(D,clone(pg))}
function withPage(pg,fn){const keep=clone(D);loadInto(pg);try{return fn()}finally{loadInto(keep)}}
function goPage(i){syncCur();P.cur=i;loadInto(P.pages[i])}
const face=(L,ov)=>ov&&ov.id===L.id?{fam:ov.font[1],w:ov.font[4]}:{fam:L.fam,w:L.w};
const fontStr=(f,size)=>`${f.w} ${size}px ${f.fam}, sans-serif`;
const rgba=(hex,a)=>{const n=parseInt(hex.slice(1),16);return `rgba(${n>>16},${n>>8&255},${n&255},${a})`};

function newLayer(o){
  return Object.assign({id:uid++,text:'テキスト',fam:'"Zen Maru Gothic"',w:500,name:'Zen Maru Gothic',size:96,x:D.W/2,y:D.H/2,rot:0,
    color:INK,align:'center',ls:0,lh:1.45,vertical:false,opacity:1,wrap:.86,
    stroke:{on:false,color:INK,w:8},shadow:{...SHADOW,on:false},band:{on:false,shape:'rect',color:'#ffffff',a:.75,pad:30,r:0,line:{on:false,color:INK,w:3}}},o);
}

/* ---------- glyph support (for vertical forms) ---------- */
const probe=document.createElement('canvas');probe.width=probe.height=40;const pc=probe.getContext('2d',{willReadFrequently:true});
let glyphCache=new Map();
// A font has a character if drawing it with Adobe Blank (every glyph empty) as the only fallback leaves ink.
const blankReady=document.fonts.load('30px "Piclea Blank"').then(()=>{glyphCache=new Map()}).catch(()=>{});
function hasGlyph(f,ch){
  const key=f.fam+f.w+ch;if(glyphCache.has(key))return glyphCache.get(key);
  pc.clearRect(0,0,40,40);pc.font=`${f.w} 30px ${f.fam}, "Piclea Blank"`;pc.textBaseline='alphabetic';pc.textAlign='left';pc.fillText(ch,4,31);
  const d=pc.getImageData(0,0,40,40).data;let ink=false;for(let i=3;i<d.length;i+=4)if(d[i]>40){ink=true;break}
  glyphCache.set(key,ink);return ink;
}
document.fonts.addEventListener('loadingdone',()=>{glyphCache=new Map();wrapCache.clear();emit('fonts')});

/* ---------- wrapping ---------- */
const wrapCache=new Map();
function measure(c,t,sp){
  if(!sp)return c.measureText(t).width;
  const cs=[...t];return cs.reduce((s,ch)=>s+c.measureText(ch).width,0)+sp*Math.max(0,cs.length-1);
}
function greedy(p,max,m){
  if(!p)return [''];
  const toks=p.match(/[A-Za-z0-9À-ÿ'’.\-]+ ?| +|./gsu),lines=[];let cur='';
  for(const tok of toks){
    if(cur&&m(cur+tok.trimEnd())>max&&!NOSTART.test(tok)){
      let carry='';while(cur&&NOEND.test(cur)){carry=cur.slice(-1)+carry;cur=cur.slice(0,-1)}
      if(cur){lines.push(cur.trimEnd());cur=(carry+tok).trimStart()}else cur=carry+tok;
    }else cur+=tok;
  }
  lines.push(cur.trimEnd());return lines;
}
// Same number of lines as a greedy fill, but as even as possible (like text-wrap: balance).
function balance(p,max,m){
  const g=greedy(p,max,m);if(g.length<2)return g;
  let lo=0,hi=max;for(let i=0;i<14;i++){const mid=(lo+hi)/2;if(greedy(p,mid,m).length<=g.length)hi=mid;else lo=mid}
  return greedy(p,hi,m);
}
function wrapLines(c,L,f){
  const key=[f.fam,f.w,L.size,L.ls,L.wrap,L.vertical,D.W,D.H,L.text].join('|');
  if(wrapCache.has(key))return wrapCache.get(key);
  const sp=L.size*L.ls/100,paras=L.text.split('\n');
  let out=paras;
  if(L.wrap){
    const max=L.wrap*(L.vertical?D.H:D.W),adv=L.size+sp;
    const m=L.vertical?(s=>[...s].length*adv-sp):(s=>measure(c,s,sp));
    out=paras.flatMap(p=>balance(p,max,m));
  }
  if(wrapCache.size>800)wrapCache.clear();
  wrapCache.set(key,out);return out;
}

/* ---------- in-page dialog ---------- */
// ask('text',{ok}) resolves true/false; with {input:'default'} it resolves the typed text or null.
function ask(msg,{ok='OK',input=null,cancel=true}={}){
  return new Promise(res=>{
    const d=$('#askd'),inp=$('#askin');
    $('#askmsg').textContent=msg;$('#askok').textContent=ok;d.querySelector('button[data-askno]').style.display=cancel?'':'none';
    inp.hidden=input==null;if(input!=null)inp.value=input;
    d.hidden=false;if(input!=null)setTimeout(()=>{inp.focus();inp.select()},30);
    const done=v=>{d.hidden=true;d.onclick=null;inp.onkeydown=null;res(v)};
    d.onclick=e=>{if(e.target.closest('#askok'))done(input!=null?(inp.value.trim()||null):true);else if(e.target.closest('[data-askno]'))done(input!=null?null:false)};
    inp.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();done(inp.value.trim()||null)}};
  });
}

/* ---------- drawing ---------- */
function layout(c,L,f){
  c.font=fontStr(f,L.size);
  const s=L.size,sp=s*L.ls/100,lines=wrapLines(c,L,f);
  if(!L.vertical){
    const ws=lines.map(t=>measure(c,t,sp)),lh=s*L.lh;
    return {lines,ws,sp,lh,W:Math.max(s*.3,...ws),H:lh*lines.length};
  }
  const cw=s*L.lh,adv=s+sp,hs=lines.map(t=>Math.max(0,[...t].length*adv-sp));
  return {lines,hs,sp,cw,adv,W:cw*lines.length,H:Math.max(s,...hs)};
}
function glyphs(c,L,f,m,stroke){
  const put=(ch,x,y)=>stroke?c.strokeText(ch,x,y):c.fillText(ch,x,y);
  c.textBaseline='middle';
  if(!L.vertical){
    c.textAlign='left';
    m.lines.forEach((t,i)=>{
      const w=m.ws[i],y=-m.H/2+m.lh*(i+.5);
      let x=L.align==='left'?-m.W/2:L.align==='right'?m.W/2-w:-w/2;
      if(!m.sp){put(t,x,y);return}
      for(const ch of t){put(ch,x,y);x+=c.measureText(ch).width+m.sp}
    });
    return;
  }
  c.textAlign='center';const s=L.size;
  m.lines.forEach((t,i)=>{
    const x=m.W/2-m.cw*(i+.5),h=m.hs[i];
    let y=-m.H/2+(L.align==='center'?(m.H-h)/2:L.align==='right'?m.H-h:0)+s/2;
    for(const ch of t){
      const v=VFORM[ch];
      if(v&&hasGlyph(f,v))put(v,x,y);
      else if(ROTATE.test(ch)){c.save();c.translate(x,y);c.rotate(Math.PI/2);put(ch,0,0);c.restore()}
      else if(PUNCT.test(ch))put(ch,x+s*.5,y-s*.5);
      else if(SMALL.test(ch))put(ch,x+s*.1,y-s*.1);
      else put(ch,x,y);
      y+=m.adv;
    }
  });
}
// Frame around the text. Round shapes are sized so the text's box fits inside them.
function frameSize(L,m){
  const B=L.band,p=L.size*B.pad/100,sh=B.shape||'rect';
  if(sh==='circle'){const d=Math.hypot(m.W,m.H)+2*p;return {w:d,h:d}}
  if(sh==='ellipse')return {w:m.W*Math.SQRT2+2*p,h:m.H*Math.SQRT2+2*p};
  if(sh==='pill'){ // the round ends grow outward until the text box's corners sit inside them (two lines made them cut in)
    const hz=m.W>=m.H,lg=hz?m.W:m.H,sm=hz?m.H:m.W,r=sm/2+p,long=Math.max(lg+2*p,lg+2*r-2*Math.sqrt(r*r-sm*sm/4)+p/2);
    return hz?{w:long,h:sm+2*p}:{w:sm+2*p,h:long};
  }
  return {w:m.W+2*p,h:m.H+2*p};
}
function framePath(c,L,m){
  const sh=L.band.shape||'rect',f=frameSize(L,m);c.beginPath();
  if(sh==='circle'||sh==='ellipse')c.ellipse(0,0,f.w/2,f.h/2,0,0,Math.PI*2);
  else c.roundRect(-f.w/2,-f.h/2,f.w,f.h,sh==='pill'?Math.min(f.w,f.h)/2:Math.min(L.size*L.band.r/100,Math.min(f.w,f.h)/2));
}
function drawLayer(c,L,ov){
  const f=face(L,ov),s=L.size;
  c.save();c.translate(L.x,L.y);c.rotate(L.rot);
  const m=layout(c,L,f);
  if(L.band.on){
    c.save();
    if(L.band.glass){
      const sh=L.band.shape||'rect',f=frameSize(L,m),hx=f.w/2,hy=f.h/2;
      glassPaint(c,glassRead(c,hx,hy),sh==='circle'||sh==='ellipse'?sdEllipse(hx,hy):sdRect(hx,hy,sh==='pill'?Math.min(hx,hy):Math.min(L.size*L.band.r/100,hx,hy)),hx,hy,L.opacity);
      framePath(c,L,m);
    }
    else{framePath(c,L,m);c.globalAlpha=L.opacity*L.band.a;c.fillStyle=L.band.color;c.fill()}
    const ln=L.band.line;if(ln?.on){c.globalAlpha=L.opacity;c.lineWidth=s*ln.w/100;c.strokeStyle=ln.color;c.stroke()}
    c.restore();
  }
  const gm=L.glyph,GA=gm==='glass'&&glyphRead(c,L,m); // glass letters bend the picture as it was before their shadow
  c.globalAlpha=L.opacity;c.lineJoin='round';c.miterLimit=2;c.lineWidth=s*L.stroke.w/100*2;
  if(L.shadow.on){
    // Only the shadow: the letters go far off to the side and the offset brings their shadow back.
    // Drawn again for 濃さ over 100%, which deepens a wide soft shadow the way one pass cannot.
    const T=c.getTransform(),k=Math.hypot(T.a,T.b),far=3*(D.W+D.H),n=Math.ceil(L.shadow.a);
    c.save();c.translate(-far,0);
    c.shadowColor=rgba(L.shadow.color,Math.min(1,L.shadow.a/n));c.shadowBlur=s*L.shadow.blur/100*k;
    c.shadowOffsetX=s*L.shadow.x/100*k+far*T.a;c.shadowOffsetY=s*L.shadow.y/100*k+far*T.b;
    c.fillStyle=c.strokeStyle='#000';
    for(let i=0;i<n;i++){if(L.stroke.on)glyphs(c,L,f,m,true);glyphs(c,L,f,m,false)}
    c.restore();
  }
  if(L.stroke.on){c.strokeStyle=L.stroke.color;glyphs(c,L,f,m,true)}
  if(gm==='glass')glyphPaint(c,L,f,m,GA,false);
  else if(gm==='carve')glyphPaint(c,L,f,m,glyphRead(c,L,m),true);
  else{c.fillStyle=rgba(L.color,L.ca??1);glyphs(c,L,f,m,false)}
  c.restore();
  return m;
}
/* ---------- clear glass ---------- */
// No colour and no blur: what lies under the shape is bent at its rim (drawn in from just outside, the middle
// a touch larger) and lit along the bevel, strong top-left and weak bottom-right. Worked out pixel by pixel
// from the shape's signed distance and normal, since stacked resized copies left ripples on fine patterns.
// sd(x,y) in the layer's own units puts the distance (negative inside) and the outward normal in SD.
// The background is read first, then the shadow drawn, then the glass laid over only the inside.
// While a finger is moving something it is worked out on 2×2 blocks, then sharp again on letting go.
const SD=new Float64Array(3);let glassFast=false;
function sdRect(hx,hy,r){
  return (x,y)=>{
    const qx=Math.abs(x)-(hx-r),qy=Math.abs(y)-(hy-r),sx=x<0?-1:1,sy=y<0?-1:1;
    if(qx>0&&qy>0){const l=Math.sqrt(qx*qx+qy*qy);SD[0]=l-r;SD[1]=sx*qx/l;SD[2]=sy*qy/l}
    else if(qx>qy){SD[0]=qx-r;SD[1]=sx;SD[2]=0}else{SD[0]=qy-r;SD[1]=0;SD[2]=sy}
  };
}
function sdEllipse(a,b){
  return (x,y)=>{
    const u=x/a,v=y/b,nx=u/a,ny=v/b,k0=Math.sqrt(u*u+v*v),k1=Math.sqrt(nx*nx+ny*ny);
    if(!k1){SD[0]=-Math.min(a,b);SD[1]=0;SD[2]=-1;return}
    SD[0]=k0*(k0-1)/k1;SD[1]=nx/k1;SD[2]=ny/k1;
  };
}
function glassArea(c,hx,hy){ // the device pixels the glass covers, with the transform that maps them back
  const T=c.getTransform(),pts=[[-hx,-hy],[hx,-hy],[hx,hy],[-hx,hy]].map(([x,y])=>[T.a*x+T.c*y+T.e,T.b*x+T.d*y+T.f]);
  const cw=c.canvas.width,ch=c.canvas.height;
  const x0=Math.max(0,Math.floor(Math.min(...pts.map(p=>p[0])))-1),x1=Math.min(cw,Math.ceil(Math.max(...pts.map(p=>p[0])))+1);
  const y0=Math.max(0,Math.floor(Math.min(...pts.map(p=>p[1])))-1),y1=Math.min(ch,Math.ceil(Math.max(...pts.map(p=>p[1])))+1);
  return x1>x0&&y1>y0?{T,x0,y0,w:x1-x0,h:y1-y0}:null;
}
function glassRead(c,hx,hy){ // the picture under the glass, before its shadow falls on it
  const A=glassArea(c,hx,hy);if(!A)return null;
  const bev=Math.min(hx,hy)*.5,k=Math.hypot(A.T.a,A.T.b),m=Math.ceil(bev*k)+2;
  const cw=c.canvas.width,ch=c.canvas.height,sx=Math.max(0,A.x0-m),sy=Math.max(0,A.y0-m);
  A.src={x:sx,y:sy,w:Math.min(cw,A.x0+A.w+m)-sx,h:Math.min(ch,A.y0+A.h+m)-sy};
  A.bg=c.getImageData(sx,sy,A.src.w,A.src.h);return A;
}
function glassPaint(c,A,sd,hx,hy,alpha){
  if(!A)return;
  const {T,x0,y0,w,h,src}=A,k=Math.hypot(T.a,T.b),I=T.inverse(),
    Ta=T.a,Tb=T.b,Tc=T.c,Td=T.d,Te=T.e,Tf=T.f,Ia=I.a,Ib=I.b,Ic=I.c,Id=I.d,Ie=I.e,If=I.f,sx0=src.x+.5,sy0=src.y+.5,bev=Math.min(hx,hy)*.5,mag=.035;
  const out=c.getImageData(x0,y0,w,h),o=out.data,b=A.bg.data,bw=src.w,bh=src.h;
  const lx=-Math.SQRT1_2,ly=-Math.SQRT1_2; // light from the top left of the picture, however the glass is turned
  const st=glassFast?2:1,rimW=1.6*st;
  for(let j=0;j<h;j+=st)for(let i=0;i<w;i+=st){
    const X=x0+i+st/2,Y=y0+j+st/2,x=Ia*X+Ic*Y+Ie,y=Ib*X+Id*Y+If;
    sd(x,y);const d=SD[0],nx=SD[1],ny=SD[2],cov=Math.max(0,Math.min(1,(.5*st-d*k)/st));if(!cov)continue;
    const e=Math.max(0,1-Math.max(0,-d)/bev),e2=e*e; // 1 at the rim, 0 once past the bevel
    const disp=bev*.55*e2*e,qx=x*(1-mag)+nx*disp,qy=y*(1-mag)+ny*disp;
    let sx=Ta*qx+Tc*qy+Te-sx0,sy=Tb*qx+Td*qy+Tf-sy0;
    sx=Math.max(0,Math.min(bw-1.001,sx));sy=Math.max(0,Math.min(bh-1.001,sy));
    const ix=sx|0,iy=sy|0,fx=sx-ix,fy=sy-iy,p=(iy*bw+ix)*4,q=p+bw*4;
    const dnx=Ta*nx+Tc*ny,dny=Tb*nx+Td*ny,dl=Math.sqrt(dnx*dnx+dny*dny)||1,dot=(dnx*lx+dny*ly)/dl;
    const rim=Math.max(0,1-Math.max(0,-d)*k/rimW); // a hairline of light right on the edge
    const lit=Math.min(.9,(dot>0?.75*dot*dot:.3*dot*dot)*e2*e+rim*(dot>0?.55:.28)+.04);
    const a=cov*alpha,w00=(1-fx)*(1-fy),w10=fx*(1-fy),w01=(1-fx)*fy,w11=fx*fy;
    const r=b[p]*w00+b[p+4]*w10+b[q]*w01+b[q+4]*w11,g=b[p+1]*w00+b[p+5]*w10+b[q+1]*w01+b[q+5]*w11,bl=b[p+2]*w00+b[p+6]*w10+b[q+2]*w01+b[q+6]*w11;
    const R=r+(255-r)*lit,Gn=g+(255-g)*lit,B=bl+(255-bl)*lit;
    for(let jj=j,je=Math.min(h,j+st);jj<je;jj++)for(let ii=i,ie=Math.min(w,i+st);ii<ie;ii++){const n=(jj*w+ii)*4;o[n]+=(R-o[n])*a;o[n+1]+=(Gn-o[n+1])*a;o[n+2]+=(B-o[n+2])*a}
  }
  c.putImageData(out,x0,y0);
}
// Glass letters and letters cut into the picture. The letters are drawn as a white mask, blurred into a
// height (own box blur, Safari's canvas has no filter), and the height's slope bends what is under them
// and lights the rim: raised glass takes in the outside and shines top-left; a cut takes in the floor and
// is shaded on its top-left wall.
let MC=null;
function boxBlur(a,t,w,h,r){ // three passes each way; a is the input and result, t scratch
  const n=2*r+1;
  for(let pass=0;pass<3;pass++){
    for(let y=0;y<h;y++){const o=y*w;let s=0;for(let x=-r;x<=r;x++)s+=a[o+Math.min(w-1,Math.max(0,x))];
      for(let x=0;x<w;x++){t[o+x]=s/n;s+=a[o+Math.min(w-1,x+r+1)]-a[o+Math.max(0,x-r)]}}
    for(let x=0;x<w;x++){let s=0;for(let y=-r;y<=r;y++)s+=t[Math.min(h-1,Math.max(0,y))*w+x];
      for(let y=0;y<h;y++){a[y*w+x]=s/n;s+=t[Math.min(h-1,y+r+1)*w+x]-t[Math.max(0,y-r)*w+x]}}
  }
}
function glyphRead(c,L,m){
  const pad=L.size*.2,A=glassArea(c,m.W/2+pad,m.H/2+pad);if(!A)return null;
  A.bg=c.getImageData(A.x0,A.y0,A.w,A.h);return A;
}
function glyphPaint(c,L,f,m,A,carve){
  if(!A)return;
  const {T,x0,y0,w,h}=A,k=Math.hypot(T.a,T.b),N=w*h;
  MC??=document.createElement('canvas');MC.width=w;MC.height=h;
  const mc=MC.getContext('2d',{willReadFrequently:true});
  mc.setTransform(T.a,T.b,T.c,T.d,T.e-x0,T.f-y0);mc.font=fontStr(f,L.size);mc.fillStyle='#fff';glyphs(mc,L,f,m,false);
  const md=mc.getImageData(0,0,w,h).data,M=new Float32Array(N),H=new Float32Array(N),tmp=new Float32Array(N);
  for(let i=0;i<N;i++)M[i]=H[i]=md[i*4+3]/255;
  const r=Math.max(1,Math.round(L.size*k*(carve?.022:.04)));boxBlur(H,tmp,w,h,r);
  const out=c.getImageData(x0,y0,w,h),o=out.data,b=A.bg.data,sl=2.2*r,shift=carve?-.9*r:2.2*r;
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    const i=y*w+x,cov=M[i];if(!cov)continue;
    const sx=-(H[i+1]-H[i-1])*sl,sy=-(H[i+w]-H[i-w])*sl; // about -1..1, pointing out of the letter
    const px=Math.max(0,Math.min(w-1.001,x+sx*shift)),py=Math.max(0,Math.min(h-1.001,y+sy*shift));
    const ix=px|0,iy=py|0,fx=px-ix,fy=py-iy,p=(iy*w+ix)*4,q=p+w*4;
    const w00=(1-fx)*(1-fy),w10=fx*(1-fy),w01=(1-fx)*fy,w11=fx*fy;
    const dot=-(sx+sy)*Math.SQRT1_2,d2=Math.min(1,dot*dot); // > 0 where the rim faces the light
    let lit,dark;
    if(carve){lit=dot<0?.6*d2:0;dark=.16+(dot>0?.65*d2:0)}
    else{lit=Math.min(.9,(dot>0?.8:.3)*d2+.05);dark=0}
    const a=cov*L.opacity,n=i*4;
    for(let ch=0;ch<3;ch++){
      let v=b[p+ch]*w00+b[p+4+ch]*w10+b[q+ch]*w01+b[q+4+ch]*w11;
      v=v*(1-dark);v+=(255-v)*lit;o[n+ch]+=(v-o[n+ch])*a;
    }
  }
  c.putImageData(out,x0,y0);
}
const sameShadow=(c,x,y,blur,col,a,draw)=>{ // for shapes: stack passes the same way
  const n=Math.ceil(a);c.save();c.shadowColor=rgba(col,Math.min(1,a/n));c.shadowBlur=blur;c.shadowOffsetX=x;c.shadowOffsetY=y;for(let i=0;i<n;i++)draw();c.restore();
};
/* ---------- photo adjustments ---------- */
// Worked out on the pixels (Safari's canvas has no filter), cached per photo. While a slider moves,
// the small copy stands in for the full photo so it keeps up; letting go brings the full one back.
const ADJ=[['bright','明るさ'],['contrast','コントラスト'],['temp','色温度'],['tint','色合い'],['sat','彩度'],['fade','フェード']];
const plainAdj=a=>!a||ADJ.every(([k])=>!a[k]);
let adjLive=false;
function adjust(src,a){
  const k=Math.min(1,Math.sqrt(12e6/(src.width*src.height))),out=document.createElement('canvas');
  out.width=Math.round(src.width*k);out.height=Math.round(src.height*k);
  const c=out.getContext('2d',{willReadFrequently:true});c.drawImage(src,0,0,out.width,out.height);
  const im=c.getImageData(0,0,out.width,out.height),d=im.data;
  const t=(a.temp||0)/100,n=(a.tint||0)/100,b=(a.bright||0)/100,ct=(a.contrast||0)/100,f=(a.fade||0)/100,m=1+(a.sat||0)/100;
  // warm = more red, less blue; tint + = magenta (less green)
  const gain=[1+.16*t+.05*n,1+.03*t-.14*n,1-.2*t+.05*n],p=Math.pow(2,-.8*b),kc=1+.6*ct,lo=.22*f,hi=.06*f;
  const lut=gain.map(g=>{const u=new Float32Array(256);for(let v=0;v<256;v++){let x=Math.min(1,v/255*g);x=Math.pow(x,p);x=Math.max(0,Math.min(1,.5+(x-.5)*kc));u[v]=(lo+x*(1-lo-hi))*255}return u});
  const [R,Gc,B]=lut;
  for(let i=0;i<d.length;i+=4){
    let r=R[d[i]],g=Gc[d[i+1]],bl=B[d[i+2]];
    if(m!==1){const l=.299*r+.587*g+.114*bl;r=l+(r-l)*m;g=l+(g-l)*m;bl=l+(bl-l)*m}
    d[i]=r;d[i+1]=g;d[i+2]=bl;
  }
  c.putImageData(im,0,0);return out;
}
function adjusted(ph,src,a){
  if(plainAdj(a))return src;
  if(adjLive&&src===ph.img)src=ph.small;
  const key=(src===ph.img?'f':'s')+ADJ.map(([k])=>a[k]||0).join(','),m=ph._adj||(ph._adj=new Map());
  let out=m.get(key);
  if(out)m.delete(key);else out=adjust(src,a);
  m.set(key,out);while(m.size>6)m.delete(m.keys().next().value);
  return out;
}
// The background photo turns by quarter turns (r) plus a tilt (a, degrees). It is always scaled up just
// enough that no corner shows a gap, and the drag is held to what the turned photo can still cover.
function drawPhoto(c,src){
  const P=D.photo,q=(P.r||0)&1,iw=q?src.height:src.width,ih=q?src.width:src.height;
  const t=(P.a||0)*Math.PI/180,cs=Math.abs(Math.cos(t)),sn=Math.abs(Math.sin(t));
  const bw=D.W*cs+D.H*sn,bh=D.W*sn+D.H*cs,k=Math.max(bw/iw,bh/ih)*P.s;
  const co=Math.cos(t),si=Math.sin(t),mx=(iw*k-bw)/2,my=(ih*k-bh)/2;
  let dx=P.ox*co+P.oy*si,dy=-P.ox*si+P.oy*co;
  dx=Math.max(-mx,Math.min(mx,dx));dy=Math.max(-my,Math.min(my,dy));
  P.ox=dx*co-dy*si;P.oy=dx*si+dy*co;
  c.save();c.translate(D.W/2+P.ox,D.H/2+P.oy);c.rotate(((P.r||0)*90+(P.a||0))*Math.PI/180);
  c.drawImage(src,-src.width*k/2,-src.height*k/2,src.width*k,src.height*k);c.restore();
}
// Overlaid photo: cropped to its frame (square, rounded, circle, ellipse), with an optional rim and shadow.
function imgFrame(L){const ph=photos.get(L.photoId),ar=L.shape==='circle'?1:(L.ar||(ph?ph.img.width/ph.img.height:1));return {w:L.w,h:L.w/ar}}
function imgPath(c,L,f){
  c.beginPath();
  if(L.shape==='circle'||L.shape==='ellipse')c.ellipse(0,0,f.w/2,f.h/2,0,0,Math.PI*2);
  else c.roundRect(-f.w/2,-f.h/2,f.w,f.h,L.shape==='round'?Math.min(f.w,f.h)*L.r/100:0);
}
function drawImageLayer(c,L,thumb){
  const ph=photos.get(L.photoId),f=imgFrame(L);
  c.save();c.translate(L.x,L.y);c.rotate(L.rot);c.globalAlpha=L.opacity;
  const T=c.getTransform(),k=Math.hypot(T.a,T.b);
  if(L.shadow.on)sameShadow(c,L.w*L.shadow.x/100*k,L.w*L.shadow.y/100*k,L.w*L.shadow.blur/100*k,L.shadow.color,L.shadow.a,()=>{imgPath(c,L,f);c.fillStyle=L.border.on?L.border.color:'#fff';c.fill()});
  c.save();imgPath(c,L,f);c.clip();
  if(ph){const src=adjusted(ph,thumb?ph.small:ph.img,L.adj),sc=Math.max(f.w/src.width,f.h/src.height)*L.zs,dw=src.width*sc,dh=src.height*sc;c.drawImage(src,-dw/2+L.zx*(dw-f.w)/2,-dh/2+L.zy*(dh-f.h)/2,dw,dh)}
  else{ // an empty photo frame (from a 型): a plain card with a small picture mark
    c.fillStyle='#d8cfc4';c.fillRect(-f.w/2,-f.h/2,f.w,f.h);
    const s=Math.min(f.w,f.h)*.18;c.strokeStyle='rgba(255,255,255,.92)';c.lineWidth=s*.09;c.lineJoin=c.lineCap='round';
    c.beginPath();c.roundRect(-s,-s*.75,s*2,s*1.5,s*.25);c.stroke();
    c.beginPath();c.arc(-s*.4,-s*.25,s*.18,0,7);c.stroke();
    c.beginPath();c.moveTo(-s*.75,s*.5);c.lineTo(-s*.15,-s*.02);c.lineTo(s*.3,s*.38);c.lineTo(s*.52,s*.18);c.lineTo(s*.75,s*.5);c.stroke();
  }
  c.restore();
  if(L.border.on){imgPath(c,L,f);c.lineWidth=L.w*L.border.w/100*2;c.strokeStyle=L.border.color;c.stroke()}
  c.restore();
  return {W:f.w,H:f.h};
}
// A shape: rectangle, rounded or ellipse, of any width and height, to lay under words; or a line.
function shapePath(c,L){
  c.beginPath();
  if(L.kind==='dots'&&L.dstyle==='dash'){ // dashes about 3× the thickness, stretched a little so both ends are a dash
    const gs=L.h*((L.gap||250)/100-1),n=Math.max(1,Math.round((L.w+gs)/(L.h*3+gs))),d=Math.max(1,(L.w-(n-1)*gs)/n);
    for(let i=0;i<n;i++)c.rect(-L.w/2+i*(d+gs),-L.h/2,d,L.h);
  }
  else if(L.kind==='dots'){ // evenly spaced so that both ends land on a dot
    const r=L.h/2,len=Math.max(0,L.w-L.h),n=Math.max(1,Math.round(len/(L.h*(L.gap||250)/100)));
    for(let i=0;i<=n;i++){const x=-len/2+len*i/n;c.moveTo(x+r,0);c.arc(x,0,r,0,Math.PI*2)}
  }
  else if(L.kind==='line')c.rect(-L.w/2,-L.h/2,L.w,L.h);
  else if(L.kind==='ellipse')c.ellipse(0,0,L.w/2,L.h/2,0,0,Math.PI*2);
  else c.roundRect(-L.w/2,-L.h/2,L.w,L.h,L.kind==='round'?Math.min(L.w,L.h)/2*L.r/100:0);
}
function drawShape(c,L){
  c.save();c.translate(L.x,L.y);c.rotate(L.rot);c.globalAlpha=L.opacity;
  const T=c.getTransform(),k=Math.hypot(T.a,T.b),u=Math.min(L.w,L.h,400)/100; // shadow sizes follow the shape, up to a point
  const gl=L.glass&&!isLine(L),hx=L.w/2,hy=L.h/2,A=gl&&glassRead(c,hx,hy);
  if(L.shadow.on)sameShadow(c,L.shadow.x*u*k,L.shadow.y*u*k,L.shadow.blur*u*k,L.shadow.color,L.shadow.a,()=>{shapePath(c,L);c.fillStyle=gl?'#fff':rgba(L.color,Math.max(L.a,.01));c.fill()});
  if(gl)glassPaint(c,A,L.kind==='ellipse'?sdEllipse(hx,hy):sdRect(hx,hy,L.kind==='round'?Math.min(hx,hy)*L.r/100:0),hx,hy,L.opacity);
  else{shapePath(c,L);c.fillStyle=rgba(L.color,L.a);c.fill()}
  if(L.line.on&&!isLine(L)){c.lineWidth=L.line.w;c.strokeStyle=L.line.color;c.stroke()}
  c.restore();
  return {W:L.w,H:L.h};
}
// o: {ov:{id,font}, grad:index, thumb:bool, ui:'edit'|'mark', kk: output px per screen px}. Returns metrics per layer id.
function draw(c,o={}){
  glassFast=!!(o.ui&&(G.g||adjLive));
  c.clearRect(0,0,D.W,D.H);
  // The background is the photo, one colour, or a soft gradient. The photo stays kept while it is not shown.
  const bg=bgOf(D),ph=cur(),src=ph&&(o.thumb?ph.small:ph.img);
  if(bg.type==='color'){c.fillStyle=bg.color;c.fillRect(0,0,D.W,D.H)}
  else if(bg.type==='photo'&&src)drawPhoto(c,adjusted(ph,src,D.adj));
  else{const [a,b]=GRADS[(bg.type==='grad'?bg.grad:o.grad||0)%GRADS.length],gr=c.createLinearGradient(0,0,D.W*.36,D.H);gr.addColorStop(0,a);gr.addColorStop(1,b);c.fillStyle=gr;c.fillRect(0,0,D.W,D.H)}
  const M=new Map();for(const L of D.layers)M.set(L.id,isText(L)?drawLayer(c,L,o.ov):isShape(L)?drawShape(c,L):drawImageLayer(c,L,o.thumb));
  const L=sel(),kk=o.kk||1;
  if(o.ui==='edit'&&G.guides){
    c.save();c.strokeStyle='#c49a90';c.lineWidth=1.5*kk;
    if(G.guides.x!=null){c.beginPath();c.moveTo(G.guides.x,0);c.lineTo(G.guides.x,D.H);c.stroke()}
    if(G.guides.y!=null){c.beginPath();c.moveTo(0,G.guides.y);c.lineTo(D.W,G.guides.y);c.stroke()}
    c.restore();
  }
  if(o.ui&&L&&M.get(L.id)){
    // a thin white frame with a soft dark edge reads on light and dark photos alike
    const b=box(L,M,kk);
    c.save();c.translate(L.x,L.y);c.rotate(L.rot);
    c.lineWidth=3.5*kk;c.strokeStyle='rgba(40,25,15,.22)';c.strokeRect(-b.w/2,-b.h/2,b.w,b.h);
    c.lineWidth=1.5*kk;c.strokeStyle='#fff';c.strokeRect(-b.w/2,-b.h/2,b.w,b.h);c.restore();
    if(o.ui==='edit'){
      const h=handles(L,M,kk),dot=(x,y,r)=>{c.beginPath();c.arc(x,y,r,0,7);c.fill();c.stroke()};
      c.save();c.fillStyle='#fff';c.strokeStyle='rgba(40,25,15,.3)';c.lineWidth=kk;c.shadowColor='rgba(40,25,15,.3)';c.shadowBlur=4;
      for(const q of h.corners)dot(q.x,q.y,6.5*kk);
      for(const q of Object.values(h.edges)){c.beginPath();c.roundRect(q.x-4.5*kk,q.y-4.5*kk,9*kk,9*kk,2.5*kk);c.fill();c.stroke()}
      dot(h.rot.x,h.rot.y,13*kk);c.restore();
      rotIcon(c,h.rot.x,h.rot.y,kk);
    }
  }
  return M;
}
function rotIcon(c,x,y,kk){
  const r=5.5*kk,a0=-Math.PI*.15,a1=Math.PI*1.35,s=3.4*kk,t=a1+Math.PI/2,px=x+r*Math.cos(a1),py=y+r*Math.sin(a1);
  c.save();c.strokeStyle=c.fillStyle=INK;c.lineWidth=1.6*kk;c.lineCap='round';
  c.beginPath();c.arc(x,y,r,a0,a1);c.stroke();
  c.beginPath();c.moveTo(px+Math.cos(t)*s,py+Math.sin(t)*s);c.lineTo(px+Math.cos(t+2.2)*s,py+Math.sin(t+2.2)*s);c.lineTo(px+Math.cos(t-2.2)*s,py+Math.sin(t-2.2)*s);c.closePath();c.fill();
  c.restore();
}
// Shapes and photos carry their handles on their own edges (as in Canva), so a handle laid on a line puts
// the edge there; words keep a little air around them.
function box(L,M,kk){const m=M.get(L.id),f=isText(L)&&L.band.on?frameSize(L,m):{w:m.W,h:m.H},p=isText(L)?10*kk:0;return {w:f.w+2*p,h:f.h+2*p}}
// Any corner scales; the round handle under the frame rotates. All are pulled back inside the picture.
function handles(L,M,kk){
  const b=box(L,M,kk),cs=Math.cos(L.rot),sn=Math.sin(L.rot),m=12*kk;
  const at=(lx,ly)=>({x:Math.max(m,Math.min(D.W-m,L.x+lx*cs-ly*sn)),y:Math.max(m,Math.min(D.H-m,L.y+lx*sn+ly*cs))});
  const below=b.h/2+34*kk,room=L.y+below*cs+18*kk<D.H;
  // a shape also stretches one way from the middle of each side
  // a line only lengthens from its ends; its thickness is set in the panel
  const edges=isLine(L)?{r:at(b.w/2,0),l:at(-b.w/2,0)}:isShape(L)?{r:at(b.w/2,0),l:at(-b.w/2,0),b:at(0,b.h/2),t:at(0,-b.h/2)}:{};
  return {corners:isLine(L)?[]:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,j])=>at(i*b.w/2,j*b.h/2)),edges,rot:at(0,room?below:-below)};
}
function local(L,p){const dx=p.x-L.x,dy=p.y-L.y,c=Math.cos(-L.rot),s=Math.sin(-L.rot);return {x:dx*c-dy*s,y:dx*s+dy*c}}
function hitLayer(M,p,kk,only){
  for(let i=D.layers.length-1;i>=0;i--){const L=D.layers[i];if(!M.has(L.id)||(only&&!only(L)))continue;const b=box(L,M,kk),q=local(L,p),tol=8*kk;if(Math.abs(q.x)<=b.w/2+tol&&Math.abs(q.y)<=b.h/2+tol)return L}
  return null;
}
const loadText=L=>L.text+(L.vertical?Object.values(VFORM).join(''):'')||'あ';
function ensureFonts(ov){
  return Promise.all(D.layers.filter(isText).map(L=>{const f=face(L,ov);return loadFace(f.fam,f.w,loadText(L)).catch(()=>[])}));
}

/* ---------- photos and pages ---------- */
async function makePhoto(url,id=newId('p')){
  const im=new Image();im.src=url;await im.decode();
  const k=Math.min(1,720/Math.max(im.width,im.height)),sm=document.createElement('canvas');
  sm.width=Math.round(im.width*k);sm.height=Math.round(im.height*k);sm.getContext('2d').drawImage(im,0,0,sm.width,sm.height);
  photos.set(id,{url,img:im,small:sm});return id;
}
const anyPhoto=()=>!!D.photoId||P.pages.some(pg=>pg&&pg.photoId);
// worth keeping: it has a photo, or a plain or gradient background someone chose
const worthSaving=()=>anyPhoto()||!photoBg(D)||P.pages.some(pg=>pg&&!photoBg(pg));
async function setPhoto(url){
  const first=!anyPhoto();
  D.photoId=await makePhoto(url);D.photo={s:1,ox:0,oy:0};D.bg={type:'photo'};
  if(D.ratio==='元の比率')applyRatio('元の比率');
  // text written for the plain backdrop turns white with a soft shadow once a photo is behind it
  if(first)for(const L of D.layers)if(L.color===INK&&!L.stroke.on&&!L.band.on){L.color='#ffffff';L.shadow={...SHADOW}}
  commit();emit('photo',url);
}
// New pages start with the current page's design: a carousel usually carries the same look.
async function addPhotos(urls){
  syncCur();const design=clone(D);
  for(const url of urls){const id=await makePhoto(url);P.pages.push({...clone(design),layers:design.layers.filter(L=>!isImg(L)),photoId:id,photo:{s:1,ox:0,oy:0}})}
  commit();emit('pages');
}

/* ---------- history (the whole work, so page changes undo too) ---------- */
let hist=[],redo=[];
const snap=()=>{syncCur();return JSON.stringify(clone(P))};
function commit(){const s=snap();if(hist.at(-1)===s)return;hist.push(s);if(hist.length>80)hist.shift();redo=[];syncUndo();stripSoon();autosave()}
function restore(s){const o=JSON.parse(s);P.pages=o.pages;P.cur=o.cur;loadInto(P.pages[P.cur]);sizeCanvas();panel();refresh();syncUndo();renderStrip();emit('change')}
function undo(){if(hist.length<2)return;redo.push(hist.pop());restore(hist.at(-1))}
function redoIt(){if(!redo.length)return;const s=redo.pop();hist.push(s);restore(s)}
function syncUndo(){$('#eundo').disabled=hist.length<2;$('#eredo').disabled=!redo.length}

// The ratio belongs to the whole work: Instagram crops every image of a carousel to the first one's.
function applyRatio(name){
  syncCur();
  const first=photos.get(P.pages[0]?.photoId)||cur();
  const r=RATIOS.find(x=>x[0]===name)[1]||(first?first.img.width/first.img.height:.8);
  const W=OUT_W,H=Math.round(W/r);
  for(const pg of P.pages){const sx=W/pg.W,sy=H/pg.H;for(const L of pg.layers){L.x*=sx;L.y*=sy}Object.assign(pg,{ratio:name,W,H});pg.photo.ox=pg.photo.oy=0}
  loadInto(P.pages[P.cur]);wrapCache.clear();
}
function ensureAll(){syncCur();return Promise.all(P.pages.flatMap(pg=>pg.layers.filter(isText).map(L=>loadFace(L.fam,L.w,loadText(L)).catch(()=>[]))))}
// Names of the typefaces that could not be fetched (Google down, no signal); empty when all are here.
async function missingFaces(){
  syncCur();const ts=P.pages.flatMap(pg=>pg.layers.filter(isText));
  const ok=await Promise.all(ts.map(L=>faceReady(L.fam,L.w,loadText(L))));
  return [...new Set(ts.filter((L,i)=>!ok[i]).map(L=>L.name||L.fam.replace(/"/g,'')))];
}

/* =================== editor view =================== */
// The picture fills the screen. One bar at the bottom holds what can be done to the current selection
// (nothing, a text, or an overlaid photo); a tool opens a thin drawer just above it and the picture
// shrinks to stay whole. Tapping anywhere off the selection lets go of it.
const cv=$('#ecanvas'),ctx=cv.getContext('2d');
const G={ptrs:new Map(),g:null,guides:null,M:new Map()};
let tool=null,fontLang='ja',decoSub='stroke',textTimer;
const kE=()=>D.W/(cv.clientWidth||D.W); // output px per screen px
function sizeCanvas(){if(cv.width!==D.W)cv.width=D.W;if(cv.height!==D.H)cv.height=D.H}
let raf=0;
function paint(){if(!raf)raf=requestAnimationFrame(()=>{raf=0;if(!$('#editor').hidden){G.M=draw(ctx,{ui:tool==='bg'?null:'edit',kk:kE()});placeFloat();syncPos()}})}
function refresh(){paint();ensureFonts().then(paint)}
on('fonts',()=>paint());
new ResizeObserver(()=>paint()).observe($('#estage'));

function pt(e){const r=cv.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*D.W,y:(e.clientY-r.top)/r.height*D.H}}
function hitHandle(L,p){
  if(!L||!G.M.has(L.id))return null;
  const h=handles(L,G.M,kE()),near=q=>Math.hypot(p.x-q.x,p.y-q.y)<22*kE();
  if(near(h.rot))return 'rot';if(h.corners.some(near))return 'scale';
  const e=Object.entries(h.edges).find(([,q])=>Math.hypot(p.x-q.x,p.y-q.y)<18*kE());return e?'edge:'+e[0]:null;
}
// Dragging a side of a shape: the opposite side stays put.
function stretch(L,g,p){
  const dx=p.x-g.x0,dy=p.y-g.y0,cs=Math.cos(g.rot),sn=Math.sin(g.rot),q={x:dx*cs+dy*sn,y:-dx*sn+dy*cs};
  const horiz=g.e==='r'||g.e==='l',s=g.e==='r'||g.e==='b'?1:-1,old=horiz?g.w0:g.h0;
  const size=Math.max(6,s*(horiz?q.x:q.y)-g.pad+old/2),shift=s*(size-old)/2,sx=horiz?shift:0,sy=horiz?0:shift;
  if(horiz)L.w=size;else L.h=size;
  L.x=g.x0+sx*cs-sy*sn;L.y=g.y0+sx*sn+sy*cs;
  // the side being pulled stops on an edge or middle nearby (so a bar can butt up against a square)
  G.guides=null;if(Math.abs(g.rot)>1e-3)return;
  const T=targets(L),edge=horiz?L.x+s*L.w/2:L.y+s*L.h/2,hit=nearSide(edge,0,horiz?T.xs:T.ys,SNAP*kE());
  if(!hit||(horiz?L.w:L.h)+s*hit.d<6)return;
  if(horiz){L.w+=s*hit.d;L.x+=hit.d/2}else{L.h+=s*hit.d;L.y+=hit.d/2}
  G.guides=horiz?{x:hit.t,y:null}:{x:null,y:hit.t};
}
const two=()=>{const [a,b]=[...G.ptrs.values()];return {d:Math.hypot(a.x-b.x,a.y-b.y),a:Math.atan2(b.y-a.y,b.x-a.x)}};
const SZ=L=>isText(L)?'size':'w';
const clampSz=(L,v)=>isText(L)?Math.max(12,Math.min(900,v)):Math.max(isShape(L)?6:40,Math.min(3000,v));
// Grow or shrink by a ratio from where the gesture began; a shape keeps its proportions.
function scaleBy(L,g,r){L[SZ(L)]=clampSz(L,g.size*r);if(isShape(L))L.h=Math.max(6,g.h*L.w/g.size)}
function snapAngle(a){const d=Math.round(a/(Math.PI/2))*(Math.PI/2);return Math.abs(a-d)<.05?d:a}
function deselect(){D.sel=null;tool=null;panel();paint()}

cv.addEventListener('pointerdown',e=>{
  try{cv.setPointerCapture(e.pointerId)}catch{}const p=pt(e);G.ptrs.set(e.pointerId,p);
  const L=sel();
  if(G.ptrs.size===2){
    const t=two();
    if(tool==='bg')G.g={mode:'pzoom',t,s:D.photo.s};
    else if(L)G.g={mode:'pinch',t,size:L[SZ(L)],h:L.h,rot:L.rot};
    return;
  }
  if(tool==='bg'){if(photoBg(D))G.g={mode:'pan',p,ox:D.photo.ox,oy:D.photo.oy};return}
  const h=hitHandle(L,p);
  if(h==='scale'){G.g={mode:'scale',d:Math.max(1,Math.hypot(p.x-L.x,p.y-L.y)),size:L[SZ(L)],h:L.h,box:layerBox(L)};return}
  if(h&&h.startsWith('edge:')){G.g={mode:'edge',e:h.slice(5),x0:L.x,y0:L.y,w0:L.w,h0:L.h,rot:L.rot,pad:0};return}
  if(h==='rot'){G.g={mode:'rot',a:Math.atan2(p.y-L.y,p.x-L.x),rot:L.rot};return}
  const H=hitLayer(G.M,p,kE());
  if(H){const was=D.sel===H.id;D.sel=H.id;G.g={mode:'move',p,x:H.x,y:H.y,was,moved:false};if(!was)panel()}
  else{G.g=null;if(D.sel)deselect()}
  paint();
});
cv.addEventListener('pointermove',e=>{
  const g=G.g;if(!G.ptrs.has(e.pointerId)||!g)return;const p=pt(e);G.ptrs.set(e.pointerId,p);const L=sel();
  if(g.mode==='pan'){D.photo.ox=g.ox+p.x-g.p.x;D.photo.oy=g.oy+p.y-g.p.y}
  else if(g.mode==='pzoom'&&G.ptrs.size===2){D.photo.s=Math.max(1,Math.min(4,g.s*two().d/g.t.d))}
  else if(g.mode==='pinch'&&L&&G.ptrs.size===2){const t=two();scaleBy(L,g,t.d/g.t.d);L.rot=g.rot+t.a-g.t.a}
  else if(g.mode==='scale'&&L){scaleBy(L,g,Math.hypot(p.x-L.x,p.y-L.y)/g.d);snapScale(L,g)}
  else if(g.mode==='edge'&&L){stretch(L,g,p)}
  else if(g.mode==='rot'&&L){L.rot=snapAngle(g.rot+Math.atan2(p.y-L.y,p.x-L.x)-g.a)}
  else if(g.mode==='move'&&L){
    if(!g.moved&&Math.hypot(p.x-g.p.x,p.y-g.p.y)/kE()<4)return;g.moved=true;
    const r=snapBox(L,g.x+p.x-g.p.x,g.y+p.y-g.p.y,SNAP*kE());L.x=r.x;L.y=r.y;G.guides=r.guides;
  }
  paint();
});
// Snap the centre to the picture's centre lines and to other texts' centres; the pull is in screen pixels.
// Smart guides, as in Canva: the edges and the middle of what you drag stick to the picture's edges and
// middle and to every other layer's edges and middle, moving or stretching a side. A tilted layer only
// offers its middle.
const straight=L=>Math.abs(Math.sin(2*L.rot))<1e-3;
function lines(L,x=L.x,y=L.y){
  const b=layerBox(L),sw=Math.abs(Math.sin(L.rot))>.5,w=sw?b.h:b.w,h=sw?b.w:b.h;
  return straight(L)?{xs:[x-w/2,x,x+w/2],ys:[y-h/2,y,y+h/2]}:{xs:[x],ys:[y]};
}
function targets(L){
  const xs=[0,D.W/2,D.W],ys=[0,D.H/2,D.H];
  for(const o of D.layers)if(o!==L&&G.M.has(o.id)){const l=lines(o);xs.push(...l.xs);ys.push(...l.ys)}
  return {xs,ys};
}
const SNAP=8; // screen px, as in tldraw, Excalidraw and GIMP
// a side at `edge` whose handle is `out` further: how far the side must move to sit on the nearest line
function nearSide(edge,out,ts,thr){let best=null;for(const t of ts){const dist=Math.min(Math.abs(t-edge),Math.abs(t-edge-out));if(dist<thr&&(!best||dist<best.dist))best={dist,d:t-edge,t}}return best}
function nearest(vals,ts,thr){let best=null;for(const v of vals)for(const t of ts){const d=t-v;if(Math.abs(d)<thr&&(!best||Math.abs(d)<Math.abs(best.d)))best={d,t}}return best}
function snapBox(L,x,y,thr){
  const l=lines(L,x,y),T=targets(L),gx=nearest(l.xs,T.xs,thr),gy=nearest(l.ys,T.ys,thr);
  return {x:x+(gx?gx.d:0),y:y+(gy?gy.d:0),guides:{x:gx?.t??null,y:gy?.t??null}};
}
// Growing from a corner keeps the middle where it is; when a side comes near an edge or a middle, the
// size is set so that side lands on it exactly.
function snapScale(L,g){
  G.guides=null;if(!straight(L))return;
  const r=L[SZ(L)]/g.size,sw=Math.abs(Math.sin(L.rot))>.5,w=(sw?g.box.h:g.box.w)*r,h=(sw?g.box.w:g.box.h)*r,T=targets(L),thr=SNAP*kE(),pad=0;
  let best=null;
  for(const [c,half,ts,ax] of [[L.x,w/2,T.xs,'x'],[L.y,h/2,T.ys,'y']])for(const s of [-1,1]){
    const hit=nearSide(c+s*half,s*pad,ts,thr);if(!hit)continue;
    const k=Math.abs(hit.t-c)/half;if(k>.05&&(!best||hit.dist<best.d))best={d:hit.dist,k,t:hit.t,ax};
  }
  if(!best)return;
  const v=clampSz(L,L[SZ(L)]*best.k),k=v/L[SZ(L)];L[SZ(L)]=v;if(isShape(L))L.h=Math.max(6,L.h*k);
  G.guides=best.ax==='x'?{x:best.t,y:null}:{x:null,y:best.t};
}
function snapMove(L,x,y,thr){
  const guides={x:null,y:null},others=D.layers.filter(o=>o!==L);
  for(const c of [D.W/2,...others.map(o=>o.x)])if(Math.abs(x-c)<thr){x=c;guides.x=c;break}
  for(const c of [D.H/2,...others.map(o=>o.y)])if(Math.abs(y-c)<thr){y=c;guides.y=c;break}
  return {x,y,guides};
}
function endPtr(e){
  if(!G.ptrs.has(e.pointerId))return;G.ptrs.delete(e.pointerId);
  if(G.ptrs.size)return;
  const tap=G.g&&G.g.mode==='move'&&!G.g.moved,was=tap&&G.g.was,L=sel();
  G.g=null;G.guides=null;commit();paint();
  if(tap&&isImg(L)&&!L.photoId)$('#eimgswap').click(); // an empty frame: one tap to fill it
  else if(was&&isText(L))openText();                          // a second tap on a text: type
}
cv.addEventListener('pointerup',endPtr);cv.addEventListener('pointercancel',endPtr);
cv.addEventListener('wheel',e=>{
  e.preventDefault();const L=sel(),f=Math.exp(-e.deltaY/400);
  if(tool==='bg')D.photo.s=Math.max(1,Math.min(4,D.photo.s*f));else if(L)scaleBy(L,{size:L[SZ(L)],h:L.h},f);else return;
  paint();clearTimeout(textTimer);textTimer=setTimeout(commit,300);
},{passive:false});
// Off the picture (the grey around it): let go of the selection, or close the open tool.
$('#estage').addEventListener('pointerdown',e=>{
  if(e.target===cv||e.target.closest('#epill,#efloat'))return;
  if(D.sel)deselect();else if(tool){tool=null;panel();paint()}
});

/* ---------- bar and drawer ---------- */
const ic=d=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I={
  text:ic('<path d="M6 7V5.5h12V7M12 5.5v13M9.5 18.5h5"/>'),
  image:ic('<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.7"/><path d="M20.5 15.5l-4.8-4.6-8.7 8.6"/>'),
  bg:ic('<path d="M7 3.5v13.5h13.5"/><path d="M3.5 7H17v13.5"/>'),
  pages:ic('<rect x="8.5" y="3.5" width="12" height="14" rx="2.2"/><path d="M5 7.5v10.2A2.8 2.8 0 007.8 20.5h8.7"/>'),
  tpl:ic('<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M3.5 10.5h17M10.5 10.5v10"/>'),
  done:ic('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  edit:ic('<path d="M4.5 19.5h4l10-10-4-4-10 10z"/><path d="M13 7l4 4"/>'),
  font:ic('<path d="M3.5 18.5L8.5 5.5l5 13M5.4 14h6.2"/><circle cx="17.7" cy="15.6" r="2.9"/><path d="M20.6 12.2v6.3"/>'),
  deco:ic('<path d="M12 3.5l1.9 5.2 5.2 1.9-5.2 1.9-1.9 5.2-1.9-5.2-5.2-1.9 5.2-1.9z"/><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>'),
  layout:ic('<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>'),
  more:ic('<path d="M12 4.5l8 4-8 4-8-4z"/><path d="M4 12.5l8 4 8-4"/><path d="M4 16.5l8 4 8-4"/>'),
  shape:ic('<circle cx="9" cy="9" r="5.2"/><rect x="11" y="11" width="9.5" height="9.5" rx="2"/>'),
  adj:ic('<path d="M4 7h9M17.5 7h2.5M4 17h2.5M11 17h9"/><circle cx="15.2" cy="7" r="2.2"/><circle cx="8.8" cy="17" r="2.2"/>'),
  crop:ic('<path d="M12 3.5v17M3.5 12h17M9.3 6.2L12 3.5l2.7 2.7M9.3 17.8l2.7 2.7 2.7-2.7M6.2 9.3L3.5 12l2.7 2.7M17.8 9.3l2.7 2.7-2.7 2.7"/>'),
};
const colorIc=L=>`<i class="cdot" style="background:${L.color}"></i>`;
const BAR={
  none:()=>[['addtext','文字',I.text],['addimg','写真',I.image],['addshape','図形',I.shape],['bg','背景',I.bg],['adj','調整',I.adj],['pages','ページ',I.pages],['design','型',I.tpl]],
  text:L=>[['done','完了',I.done],['edit','編集',I.edit],['font','書体',I.font],['color','色',colorIc(L)],['deco','飾り',I.deco],['layout','配置',I.layout],['more','レイヤー',I.more]],
  shape:L=>[['done','完了',I.done],['scolor','色',colorIc(L)],['sform','形',I.shape],['sdeco',isLine(L)?'影':'線・影',I.deco],['more','レイヤー',I.more]],
  image:L=>[['done','完了',I.done],['swap',L.photoId?'差し替え':'はめる',I.image],['shape','形',I.shape],['crop','中の位置',I.crop],['adj','調整',I.adj],['deco','フチ・影',I.deco],['more','レイヤー',I.more]],
};
const ACT=new Set(['done','addtext','addimg','addshape','design','edit','swap']);

const get=(o,p)=>p.split('.').reduce((a,k)=>a[k],o);
const put=(o,p,v)=>{const ks=p.split('.'),last=ks.pop();ks.reduce((a,k)=>a[k],o)[last]=v};
const pct=v=>Math.round(v*100)+'%';
const f2=v=>(+v).toFixed(2);
const FMT={gap:v=>Math.round(v)+'%',zs:f2,zx:f2,zy:f2,'border.w':v=>(+v).toFixed(1),lh:f2,opacity:pct,'shadow.a':pct,ca:pct,'band.a':pct,wrap:v=>+v?pct(v):'なし','band.line.w':v=>(+v).toFixed(1)};
const fmt=k=>FMT[k]||(v=>Math.round(v));
// Sizes and spacing can also be typed: the number beside the slider is a field (tap it, type, done).
const NUM=new Set(['size','ls','lh','w','h']);
const slider=(label,key,min,max,step)=>{const v=get(sel(),key);return `<label class="erow"><span class="el">${label}</span><input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${v}">${NUM.has(key)
  ?`<input class="ev num" data-v="${key}" data-num="${key}" data-min="${min}" data-max="${max}" inputmode="decimal" enterkeyhint="done" value="${fmt(key)(v)}" aria-label="${label}の数値">`
  :`<span class="ev" data-v="${key}">${fmt(key)(v)}</span>`}</label>`};
// Where it sits, to the pixel: X/Y are the top-left of its box on the finished image, 角度 in degrees,
// and the arrows move it 1px a tap (held, it keeps going and speeds up).
function layerBox(L){
  if(isShape(L))return {w:L.w,h:L.h};if(isImg(L))return imgFrame(L);
  const m=G.M.get(L.id);if(!m)return {w:0,h:0};return L.band.on?frameSize(L,m):{w:m.W,h:m.H};
}
const posVals=L=>{const b=layerBox(L);return {x:Math.round(L.x-b.w/2),y:Math.round(L.y-b.h/2),rot:Math.round(((L.rot*180/Math.PI)%360+540)%360-180)}};
function posBlock(L){
  const v=posVals(L),f=(k,l,u='')=>`<label class="pf"><span>${l}</span><input class="num" data-pos="${k}" inputmode="decimal" enterkeyhint="done" value="${v[k]}" aria-label="${l}">${u}</label>`;
  return `<h5 class="esub">位置</h5><div class="epos"><div class="nudge">${[['u','↑',0,-1],['l','←',-1,0],['d','↓',0,1],['r','→',1,0]].map(([k,a,dx,dy])=>`<button class="nb nb-${k}" data-nudge="${dx},${dy}" aria-label="${a}">${a}</button>`).join('')}</div>
    <div class="pfs">${f('x','X')}${f('y','Y')}${f('rot','角度','°')}</div></div>`;
}
function syncPos(){
  const L=sel();if(!L)return;const v=posVals(L);
  bodyEl.querySelectorAll('[data-pos]').forEach(i=>{if(document.activeElement!==i)i.value=v[i.dataset.pos]});
}
const pal=key=>{const v=get(sel(),key);return `<div class="pal" data-k="${key}">${PALETTE.map(c=>`<button style="--c:${c}" data-c="${c}" class="${c===v?'on':''}" aria-label="${c}"></button>`).join('')}<label class="custom${PALETTE.includes(v)?'':' on'}" aria-label="ほかの色"><input type="color" data-k="${key}" value="${v}"></label></div>`};
const toggle=(key,label)=>`<h4>${label}<button class="tg${get(sel(),key)?' on':''}" data-tg="${key}" aria-label="${label}"></button></h4>`;
const segs=(key,opts)=>`<div class="eseg" data-set="${key}">${opts.map(([v,l])=>`<button data-v="${v}" class="${get(sel(),key)===v?'on':''}">${l}</button>`).join('')}</div>`;
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
const btns=list=>`<div class="ebtns">${list.map(([a,l,dark])=>`<button class="eb${dark?' dark':''}" data-act="${a}">${l}</button>`).join('')}</div>`;

// Only the weights the family really has; a family with one weight shows no row at all.
const WNAME={100:'Thin',200:'ExLight',300:'Light',400:'Regular',500:'Medium',600:'SemiBold',700:'Bold',800:'ExBold',900:'Black'};
// keep the chosen weight in view (Noto has nine; Black would sit off the right edge)
const showWeight=()=>{const r=bodyEl.querySelector('.wrow'),on=r?.querySelector('.on');if(on)r.scrollLeft=on.offsetLeft-r.clientWidth/2+on.clientWidth/2};
function weightRow(L){
  const f=BYFAM.get(L.fam),ws=f?weightsOf(f):[];if(ws.length<2)return '';
  const a=JA.includes(f)?'あ':'Aa';
  return `<h5 class="esub">太さ</h5><div class="wrow">${ws.map(w=>`<button class="wbtn${w===L.w?' on':''}" data-wt="${w}" aria-label="${WNAME[w]||w}"><span style='font-family:${L.fam},sans-serif;font-weight:${w}'>${a}</span><small>${WNAME[w]||w}</small></button>`).join('')}</div>`;
}
const DRAW={
  bg:()=>{
    const bg=bgOf(D);
    const body=bg.type==='color'?`<div class="pal" data-bgc>${PALETTE.map(c=>`<button style="--c:${c}" data-c="${c}" class="${c===bg.color?'on':''}" aria-label="${c}"></button>`).join('')}<label class="custom${PALETTE.includes(bg.color)?'':' on'}" aria-label="ほかの色"><input type="color" data-bgcolor value="${bg.color}"></label></div>`
      :bg.type==='grad'?`<div class="pal grads" data-bgg>${GRADS.map(([a,b],i)=>`<button style="--c:linear-gradient(160deg,${a},${b})" data-g="${i}" class="${i===bg.grad?'on':''}" aria-label="グラデーション${i+1}"></button>`).join('')}</div>`
      :`<label class="erow"><span class="el">拡大</span><input type="range" data-photo min="1" max="4" step=".01" value="${D.photo.s}"></label>
        <label class="erow"><span class="el">傾き</span><input type="range" data-ptilt min="-45" max="45" step=".5" value="${D.photo.a||0}"><span class="ev" data-v="ptilt">${D.photo.a||0}°</span></label>
        <div class="ebtns"><button class="eb" data-act="prot">90°回す</button><button class="eb${D.photoId?'':' dark'}" id="ephoto">${D.photoId?'背景の写真を変える':'背景の写真をはめる'}</button></div>
        <p class="enote">写真をドラッグで位置、2本指（パソコンはホイール）で拡大。</p>`;
    return `<div class="eseg wide" data-bgtype>${[['photo','写真'],['color','単色'],['grad','グラデーション']].map(([k,l])=>`<button data-v="${k}" class="${bg.type===k?'on':''}">${l}</button>`).join('')}</div>${body}
      <h5 class="esub">比率（全ページ共通）</h5><div class="eseg wide" data-ratio>${RATIOS.map(([n])=>`<button data-v="${n}" class="${D.ratio===n?'on':''}">${n}</button>`).join('')}</div>`;
  },
  scolor:L=>`${isLine(L)?'':toggle('glass','ガラス')}${L.glass&&!isLine(L)?'<p class="enote">色をつけない透明なガラス。下の写真が縁で曲がって見えます。</p>':pal('color')+slider('濃さ','a',0,1,.01)}`,
  sform:L=>`${segs('kind',[['rect','四角'],['round','角丸'],['ellipse','丸・だ円'],['line','線'],['dots','点線']])}
    ${L.kind==='dots'?(L.dstyle??='dot',`<div class="erow"><span class="el">種類</span>${segs('dstyle',[['dot','点'],['dash','線']])}</div>`):''}
    ${isLine(L)?slider('長さ','w',6,3000,1)+slider('太さ','h',1,80,.5)+(L.kind==='dots'?slider('間隔','gap',120,600,10):'')
      :slider('幅','w',6,3000,1)+slider('高さ','h',6,3000,1)+(L.kind==='round'?slider('角丸','r',0,100,1):'')}
    ${btns(isLine(L)?[['fullw','横幅いっぱい'],['center','真ん中へ']]:[['fullw','横幅いっぱい'],['fullh','縦いっぱい'],['center','真ん中へ']])}`,
  sdeco:L=>`${isLine(L)?'':`<div class="sec">${toggle('line.on','線')}${L.line.on?pal('line.color')+slider('太さ','line.w',1,40,.5):''}</div>`}
    <div class="sec">${toggle('shadow.on','影')}${L.shadow.on?pal('shadow.color')+slider('濃さ','shadow.a',.05,3,.01)+slider('ぼかし','shadow.blur',0,30,.5)+slider('ずれ','shadow.y',-10,10,.5):''}</div>`,
  pages:()=>`<div class="pstrip" id="pstrip"></div>
    ${btns([['pleft','← 前へ'],['pright','後ろへ →'],['pdel','このページを外す']])}`,
  font:L=>{
    const list=fontLang==='ja'?JA:EN;
    return `<div class="fhead"><div class="eseg" data-lang><button data-v="ja" class="${fontLang==='ja'?'on':''}">日本語</button><button data-v="en" class="${fontLang==='en'?'on':''}">English</button></div>
      <input class="fsearch" type="search" placeholder="書体名で探す" value="${esc(fontQ)}" enterkeyhint="search" aria-label="書体名で探す"></div>
      <p class="enote fnone" hidden>見つかりませんでした</p>
      <div class="fontrow">${list.map((f,i)=>`<button class="fbtn${f[1]===L.fam?' on':''}" data-f="${i}"><span style='font-family:${f[1]},sans-serif;font-weight:${f[4]}'>${f[0]}</span></button>`).join('')}</div>${weightRow(L)}`;
  },
  color:L=>(L.ca??=1,pal('color')+slider('濃さ','ca',0,1,.01)), // 濃さ is the letters' fill alone; レイヤー's 透明度 fades everything
  deco:L=>{
    if(!isText(L))return `<div class="sec">${toggle('border.on','フチ')}${L.border.on?pal('border.color')+slider('太さ','border.w',.5,10,.5):''}</div>
      <div class="sec">${toggle('shadow.on','影')}${L.shadow.on?slider('濃さ','shadow.a',.05,3,.01)+slider('ぼかし','shadow.blur',0,30,1)+slider('ずれ','shadow.y',-10,10,.5):''}</div>`;
    const sub={stroke:`<div class="sec">${toggle('stroke.on','縁取り')}${L.stroke.on?pal('stroke.color')+slider('太さ','stroke.w',1,30,.5):''}</div>`,
      shadow:`<div class="sec">${toggle('shadow.on','影')}${L.shadow.on?pal('shadow.color')+slider('濃さ','shadow.a',.05,3,.01)+slider('ぼかし','shadow.blur',0,100,1)+slider('横','shadow.x',-30,30,1)+slider('縦','shadow.y',-30,30,1):''}</div>`,
      band:`<div class="sec">${toggle('band.on','枠')}${L.band.on?segs('band.shape',[['rect','四角'],['pill','カプセル'],['circle','丸'],['ellipse','だ円']])+`<div class="subsec">${toggle('band.glass','ガラス')}</div>`+(L.band.glass?'':pal('band.color')+slider('濃さ','band.a',0,1,.01))+slider('余白','band.pad',0,120,1)+(L.band.shape==='rect'?slider('角丸','band.r',0,100,1):'')+
        `<div class="subsec">${toggle('band.line.on','枠の線')}${L.band.line.on?pal('band.line.color')+slider('太さ','band.line.w',.5,15,.5):''}</div>`:''}</div>`,
      glyph:`<div class="sec">${segs('glyph',[['none','なし'],['carve','彫り込み'],['glass','文字がガラス']])}<p class="enote">${L.glyph==='carve'?'文字の形に掘ったように見せます。ガラスの枠と合わせると、ガラスに彫った文字に。':L.glyph==='glass'?'文字そのものが透明なガラスになり、下の写真が曲がって見えます。':'文字をガラスにしたり、写真やガラスの枠に彫り込んだりできます。'}</p></div>`};
    L.glyph??='none';const on=k=>({stroke:L.stroke.on,shadow:L.shadow.on,band:L.band.on,glyph:L.glyph!=='none'})[k];
    return `<div class="eseg wide" data-deco>${[['stroke','縁取り'],['shadow','影'],['band','枠'],['glyph','ガラス']].map(([k,l])=>`<button data-v="${k}" class="${decoSub===k?'on':''}">${l}${on(k)?' <i class="lit"></i>':''}</button>`).join('')}</div>${sub[decoSub]}`;
  },
  layout:L=>`<div class="erow">${segs('align',[['left','左'],['center','中'],['right','右']])}${segs('vertical',[[false,'横書き'],[true,'縦書き']])}</div>
    ${slider('大きさ','size',12,600,1)}${slider('折り返し','wrap',0,1,.01)}${slider('文字間','ls',-10,80,1)}${slider('行間','lh',.8,2.6,.01)}${posBlock(L)}`,
  // レイヤー: what the whole layer does (copy, stacking order, delete, see-through), the same for words,
  // shapes and photos. A shape's 濃さ under 色 is its fill alone; 透明度 here fades fill, line and shadow together.
  more:L=>btns([['dup','複製'],['front','前へ'],['back','後ろへ'],['del','削除']])+slider('透明度','opacity',.1,1,.01)+(isText(L)?'':posBlock(L)),
  shape:L=>`${segs('shape',[['rect','四角'],['round','角丸'],['circle','丸'],['ellipse','だ円']])}
    ${L.shape!=='circle'?segs('ar',[[0,'元の形'],[1,'1:1'],[.8,'4:5'],[1.5,'3:2']]):''}
    ${slider('大きさ','w',40,2000,1)}${L.shape==='round'?slider('角丸','r',0,50,1):''}`,
  // with nothing selected it works on the background photo
  adj:L=>{
    if(!L&&!(photoBg(D)&&D.photoId))return `<p class="enote">背景が写真のときに使えます。重ねた写真は、写真をタップしてから「調整」で。</p>`;
    const a=(L||D).adj||{};
    return ADJ.map(([k,l])=>`<label class="erow wl"><span class="el">${l}</span><input type="range" data-adj="${k}" min="${k==='fade'?0:-100}" max="100" step="1" value="${a[k]||0}"><span class="ev" data-av="${k}">${a[k]||0}</span></label>`).join('')
      +btns([['adjreset','元に戻す'],...(!L&&P.pages.length>1?[['adjall','全ページの背景に当てる']]:[])]);
  },
  crop:()=>`${slider('拡大','zs',1,3,.01)}${slider('横','zx',-1,1,.01)}${slider('縦','zy',-1,1,.01)}`,
};

function addImage(photoId,i=0){
  const L={id:uid++,type:'image',photoId,x:D.W*(.5+.05*i),y:D.H*(.42+.05*i),w:D.W*.46,rot:0,shape:'round',r:5,ar:0,zs:1,zx:0,zy:0,opacity:1,
    border:{on:true,color:'#ffffff',w:2.5},shadow:{on:true,color:'#28190f',a:.28,x:0,y:1.5,blur:6}};
  D.layers.splice(D.layers.filter(x=>!isText(x)).length,0,L); // above other photos and shapes, under the texts
  D.sel=L.id;return L;
}
function addShape(){
  const L={id:uid++,type:'shape',kind:'rect',x:D.W/2,y:D.H/2,w:D.W,h:D.H*.2,rot:0,r:40,color:'#ffffff',a:.85,opacity:1,
    line:{on:false,color:INK,w:4},shadow:{on:false,color:'#28190f',a:.3,x:0,y:2,blur:8}};
  D.layers.splice(D.layers.filter(x=>!isText(x)).length,0,L); // under the texts, so words can sit on it
  D.sel=L.id;return L;
}
async function removeSelected(){
  const L=sel();if(!L)return;
  if(!await ask(isText(L)?'この文字を消しますか？':isShape(L)?'この図形を消しますか？':'この写真を消しますか？',{ok:'消す'}))return;
  removeLayer(L);tool=null;commit();panel();paint();
}
let fontIO,fontQ='';
// Narrow the font row by name (display name or family, so よもぎ and Yomogi both work) or category.
function filterFonts(){
  const list=fontLang==='ja'?JA:EN,q=fontQ.trim().toLowerCase().replace(/\s+/g,'');let n=0;
  const hit=f=>!q||[f[0],f[1],f[2]].some(x=>x.toLowerCase().replace(/[\s"]/g,'').includes(q));
  bodyEl.querySelectorAll('.fbtn').forEach(b=>{const h=hit(list[+b.dataset.f]);b.hidden=!h;n+=h});
  const none=bodyEl.querySelector('.fnone'),row=bodyEl.querySelector('.fontrow');if(!none)return;
  none.hidden=n>0;row.hidden=!n;
  // it may be on the other tab
  const other=(fontLang==='ja'?EN:JA).filter(hit).length;
  none.textContent=other?`${fontLang==='ja'?'English':'日本語'}のほうに${other}件あります`:'見つかりませんでした';
}
const bodyEl=$('#ebody');
function panel(){
  const L=sel(),items=BAR[!L?'none':isText(L)?'text':isShape(L)?'shape':'image'](L);
  if(L&&isText(L)){L.band.shape??='rect';L.band.line??={on:false,color:INK,w:3}}
  if(tool&&(ACT.has(tool)||!items.some(x=>x[0]===tool)))tool=null;
  $('#ebar').innerHTML=items.map(([k,l,svg])=>`<button data-tool="${k}" class="${tool===k?'on':''}${k==='done'?' done':''}">${svg}<span>${l}</span></button>`).join('');
  $('#edrawer').hidden=!tool;
  const top=bodyEl.scrollTop;
  bodyEl.innerHTML=tool?DRAW[tool](L):'';bodyEl.scrollTop=top;
  if(tool==='font'){
    const list=fontLang==='ja'?JA:EN,row=bodyEl.querySelector('.fontrow');
    fontIO?.disconnect();fontIO=new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting){fontIO.unobserve(x.target);const f=list[+x.target.dataset.f];loadFace(f[1],f[4],f[0]).then(()=>x.target.classList.add('ready'))}}),{root:row});
    row.querySelectorAll('.fbtn').forEach(x=>fontIO.observe(x));
    const on=row.querySelector('.fbtn.on');if(on)row.scrollLeft=on.offsetLeft-row.clientWidth/2+on.clientWidth/2;
  }
  if(tool==='font'){showWeight();filterFonts()}
  if(tool==='font')bodyEl.querySelectorAll('.wbtn').forEach(b=>loadFace(L.fam,+b.dataset.wt,b.firstChild.textContent).then(()=>b.classList.add('ready'),()=>{}));
  if(tool==='pages')renderStrip();
  renderPill();
}
function renderPill(){const n=P.pages.length||1,b=$('#epill');b.hidden=n<2||tool==='pages';b.textContent=`${P.cur+1} / ${n}`}
$('#epill').onclick=()=>{D.sel=null;tool='pages';panel();paint()};
$('#ebar').addEventListener('click',e=>{
  const b=e.target.closest('[data-tool]');if(!b)return;
  switch(b.dataset.tool){
    case 'done':deselect();return;
    case 'addtext':addLayer(null);commit();panel();refresh();openText(true);return;
    case 'addimg':$('#eimg').click();return;
    case 'addshape':addShape();tool='sform';commit();panel();paint();return;
    case 'design':openDesign();return;
    case 'edit':openText();return;
    case 'swap':$('#eimgswap').click();return;
  }
  tool=tool===b.dataset.tool?null:b.dataset.tool;panel();paint();
});
function addLayer(from){
  const base=isText(from)?from:(D.layers.filter(isText).at(-1)||{});
  const n=newLayer({text:'テキスト',fam:base.fam||'"Zen Maru Gothic"',w:base.w||500,name:base.name||'Zen Maru Gothic',color:base.color||INK,
    shadow:clone(base.shadow||{...SHADOW,on:false}),size:(base.size||96)*.6,vertical:!!base.vertical,y:D.H*[.5,.8,.2,.65,.35][D.layers.length%5]});
  D.layers.push(n);D.sel=n.id;return n;
}
function removeLayer(L){D.layers=D.layers.filter(x=>x!==L);if(D.sel===L.id)D.sel=null}
bodyEl.addEventListener('input',e=>{
  const L=sel(),t=e.target;
  if(t.classList.contains('fsearch')){fontQ=t.value;filterFonts();bodyEl.querySelector('.fontrow').scrollLeft=0;return}
  if(t.dataset.photo!=null){D.photo.s=+t.value;paint();return}
  if(t.dataset.ptilt!=null){D.photo.a=+t.value;bodyEl.querySelector('[data-v="ptilt"]').textContent=t.value+'°';paint();return}
  if(t.dataset.bgcolor!=null){D.bg={type:'color',color:t.value};t.parentElement.classList.add('on');paint();return}
  if(t.dataset.adj){(L||D).adj??={};(L||D).adj[t.dataset.adj]=+t.value;adjLive=true;bodyEl.querySelector(`[data-av="${t.dataset.adj}"]`).textContent=t.value;paint();return}
  if(!L||!t.dataset.k)return;
  put(L,t.dataset.k,t.type==='color'?t.value:+t.value);
  const v=bodyEl.querySelector(`[data-v="${t.dataset.k}"]`);if(v)v[v.tagName==='INPUT'?'value':'textContent']=fmt(t.dataset.k)(+t.value);
  if(t.type==='color'){t.closest('.pal').querySelectorAll('button').forEach(x=>x.classList.remove('on'));t.parentElement.classList.add('on');if(t.dataset.k==='color')$('#ebar .cdot')?.style.setProperty('background',t.value)}
  paint();
});
bodyEl.addEventListener('change',e=>{
  const t=e.target,L=sel();
  if(L&&t.dataset.num){ // a typed size or spacing: held to the slider's range
    let v=parseFloat(t.value.replace(/[^\d.\-]/g,''));const k=t.dataset.num;
    if(isNaN(v))v=get(L,k);v=Math.max(+t.dataset.min,Math.min(+t.dataset.max,v));put(L,k,v);
    t.value=fmt(k)(v);const r=bodyEl.querySelector(`input[type=range][data-k="${k}"]`);if(r)r.value=v;
    commit();refresh();return;
  }
  if(L&&t.dataset.pos){
    const v=parseFloat(t.value.replace(/[^\d.\-]/g,'')),b=layerBox(L);
    if(!isNaN(v)){if(t.dataset.pos==='x')L.x=v+b.w/2;else if(t.dataset.pos==='y')L.y=v+b.h/2;else L.rot=v*Math.PI/180}
    commit();paint();syncPos();return;
  }
  if(adjLive){adjLive=false;paint()}commit();
});
bodyEl.addEventListener('focusin',e=>{if(e.target.classList.contains('num'))setTimeout(()=>e.target.select(),0)});
bodyEl.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.classList.contains('num')){e.preventDefault();e.target.blur()}});
let nudgeT=0;
bodyEl.addEventListener('pointerdown',e=>{
  const b=e.target.closest('[data-nudge]'),L=sel();if(!b||!L)return;e.preventDefault();
  const [dx,dy]=b.dataset.nudge.split(',').map(Number);let n=0;
  const step=()=>{const k=n++<20?1:5;L.x+=dx*k;L.y+=dy*k;paint()};
  step();clearTimeout(nudgeT);
  const go=()=>{step();nudgeT=setTimeout(go,50)};nudgeT=setTimeout(go,400);
  const stop=()=>{clearTimeout(nudgeT);commit();removeEventListener('pointerup',stop);removeEventListener('pointercancel',stop)};
  addEventListener('pointerup',stop);addEventListener('pointercancel',stop);
});
bodyEl.addEventListener('click',e=>{
  const L=sel(),t=e.target.closest('button');if(!t)return;
  if(t.id==='ephoto'){$('#efile').click();return}
  if(t.closest('[data-pg]')||t.id==='padd'||t.closest('[data-pgdel]'))return; // the page strip has its own handler
  const act=t.dataset.act;
  if(act==='pleft'||act==='pright'){movePage(act==='pleft'?-1:1);return}
  if(act==='pdel'){removePage();return}
  if(act==='prot'){D.photo.r=((D.photo.r||0)+1)%4;commit();paint();return}
  if(act==='adjreset'){delete (L||D).adj;commit();panel();paint();return}
  if(act==='adjall'){syncCur();for(const pg of P.pages)pg.adj=clone(D.adj||{});commit();toast(`${P.pages.length}ページの背景を同じ調整にしました`);return}
  if(act==='dup'&&L){dupSel();return}
  if(act==='del'&&L){removeSelected();return}
  if(act==='front'&&L){const i=D.layers.indexOf(L);if(i<D.layers.length-1){D.layers.splice(i,1);D.layers.splice(i+1,0,L);commit();paint()}return}
  if(act==='back'&&L){const i=D.layers.indexOf(L);if(i>0){D.layers.splice(i,1);D.layers.splice(i-1,0,L);commit();paint()}return}
  if(t.closest('[data-bgtype]')){const v=t.dataset.v,old=bgOf(D);D.bg=v==='color'?{type:v,color:old.color||'#f3e9dc'}:v==='grad'?{type:v,grad:old.grad||0}:{type:'photo'};commit();panel();paint();return}
  if(t.closest('[data-bgc]')&&t.dataset.c){D.bg={type:'color',color:t.dataset.c};commit();panel();paint();return}
  if(t.closest('[data-bgg]')){D.bg={type:'grad',grad:+t.dataset.g};commit();panel();paint();return}
  if(L&&isShape(L)&&(act==='fullw'||act==='fullh'||act==='center')){
    if(act==='fullw')Object.assign(L,{w:D.W,x:D.W/2,rot:0});else if(act==='fullh')Object.assign(L,{h:D.H,y:D.H/2,rot:0});else Object.assign(L,{x:D.W/2,y:D.H/2});
    commit();panel();paint();return;
  }
  if(t.closest('[data-ratio]')){applyRatio(t.dataset.v);sizeCanvas();commit();panel();refresh();return}
  if(t.closest('[data-lang]')){fontLang=t.dataset.v;panel();return}
  if(t.closest('[data-deco]')){decoSub=t.dataset.v;panel();return}
  if(!L)return;
  if(t.dataset.tg){const k=t.dataset.tg;put(L,k,!get(L,k));commit();panel();refresh();return}
  const sg=t.closest('[data-set]');if(sg){const v=t.dataset.v;
    // turning a box into a line (or back) gives it a sensible thickness (or height) instead of the old one
    if(sg.dataset.set==='kind'&&isShape(L)){const was=isLine(L),to=v==='line'||v==='dots';if(to&&!was)L.h=Math.max(2,Math.round(D.W/120));else if(was&&!to)L.h=Math.round(L.w*.25);if(v==='dots'){L.gap??=250;L.dstyle??='dot'}}
    put(L,sg.dataset.set,v==='true'?true:v==='false'?false:/^-?\d+(\.\d+)?$/.test(v)?+v:v);commit();panel();refresh();return}
  const p=t.closest('.pal');if(p&&t.dataset.c){put(L,p.dataset.k,t.dataset.c);commit();panel();paint();return}
  if(t.dataset.f!=null){
    setFont(L,(fontLang==='ja'?JA:EN)[+t.dataset.f]);bodyEl.querySelectorAll('.fbtn').forEach(x=>x.classList.toggle('on',x===t));
    // swap only the weight row (a full redraw would blink the font buttons)
    bodyEl.querySelectorAll('.wrow,h5.esub').forEach(x=>x.remove());
    bodyEl.querySelector('.fontrow').insertAdjacentHTML('afterend',weightRow(L));showWeight();
    bodyEl.querySelectorAll('.wbtn').forEach(b=>loadFace(L.fam,+b.dataset.wt,b.firstChild.textContent).then(()=>b.classList.add('ready'),()=>{}));
    commit();refresh();return;
  }
  if(t.dataset.wt!=null){L.w=+t.dataset.wt;L.wPick=true;bodyEl.querySelectorAll('.wbtn').forEach(x=>x.classList.toggle('on',x===t));commit();refresh()}
});
// A weight picked by hand carries over to the next font when that font has it; otherwise its own default.
function setFont(L,f){Object.assign(L,{fam:f[1],w:L.wPick&&weightsOf(f).includes(L.w)?L.w:f[4],name:f[0]})}

/* ---------- typing: the words over the dimmed picture, which follows as you type ---------- */
function dupSel(){const L=sel();if(!L)return;const n=Object.assign(clone(L),{id:uid++,x:L.x+D.W*.04,y:L.y+D.W*.04});D.layers.push(n);D.sel=n.id;commit();panel();refresh()}

/* ---------- the little bar over the selection (like Canva's): the way in to typing is right there ---------- */
const flo=$('#efloat');
function placeFloat(){
  const L=sel(),busy=G.g&&(G.g.mode!=='move'||G.g.moved);
  if(!L||tool==='bg'||!tedit.hidden||busy||!G.M.has(L.id)){flo.hidden=true;return}
  const key=isText(L)?'t':isShape(L)?'s':L.photoId?'i':'e';
  if(flo.dataset.key!==key){
    flo.dataset.key=key;
    flo.innerHTML=(key==='t'?'<button data-fl="edit">編集</button>':key==='s'?'':`<button data-fl="swap">${key==='i'?'差し替え':'はめる'}</button>`)+'<button data-fl="dup">複製</button><button data-fl="del">削除</button>';
  }
  flo.hidden=false;
  const h=handles(L,G.M,kE()),xs=h.corners.map(q=>q.x),ys=h.corners.map(q=>q.y);
  const cr=cv.getBoundingClientRect(),sr=$('#estage').getBoundingClientRect(),k=cr.width/D.W,fw=flo.offsetWidth,fh=flo.offsetHeight;
  const top=cr.top-sr.top+Math.min(...ys)*k,bot=cr.top-sr.top+Math.max(...ys)*k,rotBelow=h.rot.y>(Math.min(...ys)+Math.max(...ys))/2;
  // on the side away from the rotate handle; if that side has no room, the other side past the handle
  let y=rotBelow?top-12-fh:bot+12;
  if(y<4)y=bot+(rotBelow?48:12);
  if(y+fh>sr.height-4)y=Math.max(4,top-(rotBelow?12:48)-fh);
  const x=Math.max(6,Math.min(sr.width-fw-6,cr.left-sr.left+(Math.min(...xs)+Math.max(...xs))/2*k-fw/2));
  flo.style.transform=`translate(${Math.round(x)}px,${Math.round(y)}px)`;
}
flo.addEventListener('click',e=>{
  const b=e.target.closest('[data-fl]');if(!b)return;
  ({edit:()=>openText(),swap:()=>$('#eimgswap').click(),dup:dupSel,del:removeSelected})[b.dataset.fl]();
});

const tedit=$('#etedit'),tarea=$('#etxt');
function openText(all){
  const L=sel();if(!isText(L))return;
  tarea.value=L.text;tedit.hidden=false;flo.hidden=true;tarea.focus();if(all)tarea.select();
}
function closeText(){if(tedit.hidden)return;tedit.hidden=true;tarea.blur();clearTimeout(textTimer);commit();panel();paint()}
tarea.addEventListener('input',()=>{const L=sel();if(!isText(L))return;L.text=tarea.value;refresh();clearTimeout(textTimer);textTimer=setTimeout(commit,600)});
$('#etdone').onclick=closeText;
tedit.addEventListener('pointerdown',e=>{if(e.target===tedit)closeText()});

/* ---------- page strip (inside the ページ drawer) ---------- */
const dprS=Math.min(2,devicePixelRatio||1);
function renderStrip(){
  syncCur();renderPill();const s=$('#pstrip');if(!s)return;
  s.innerHTML=P.pages.map((pg,i)=>`<button class="pg${i===P.cur?' on':''}" data-pg="${i}" aria-label="${i+1}枚目"><canvas></canvas><b>${i+1}</b>${i===P.cur&&P.pages.length>1?'<i class="pgx" data-pgdel aria-label="このページを消す">×</i>':''}</button>`).join('')+
    `<button class="pg add" id="padd" aria-label="写真を足す">＋</button>`;
  paintStrip();ensureAll().then(paintStrip);
  bodyEl.querySelector('[data-act=pleft]').disabled=P.cur===0;bodyEl.querySelector('[data-act=pright]').disabled=P.cur>=P.pages.length-1;bodyEl.querySelector('[data-act=pdel]').disabled=P.pages.length<2;
}
function paintStrip(){
  syncCur();
  document.querySelectorAll('#pstrip .pg canvas').forEach((c,i)=>{
    const pg=P.pages[i];if(!pg)return;const h=Math.round(64*dprS),w=Math.round(h*pg.W/pg.H);
    c.width=w;c.height=h;c.style.width=w/dprS+'px';c.style.height=h/dprS+'px';
    const x=c.getContext('2d');x.setTransform(w/pg.W,0,0,h/pg.H,0,0);withPage(pg,()=>draw(x,{thumb:true,grad:i}));
  });
}
let stripT=0;function stripSoon(){if($('#editor').hidden)return;clearTimeout(stripT);stripT=setTimeout(paintStrip,250)}
function switchPage(i){if(i===P.cur)return;goPage(i);sizeCanvas();panel();refresh();renderStrip()}
function movePage(d){
  syncCur();const j=P.cur+d;if(j<0||j>=P.pages.length)return;
  [P.pages[P.cur],P.pages[j]]=[P.pages[j],P.pages[P.cur]];P.cur=j;loadInto(P.pages[j]);designChanged();
}
bodyEl.addEventListener('click',e=>{
  if(!e.target.closest('#pstrip'))return;
  if(e.target.closest('[data-pgdel]')){removePage();return}
  const b=e.target.closest('button');if(!b)return;
  if(b.id==='padd'){$('#eadd').click();return}
  if(b.dataset.pg!=null)switchPage(+b.dataset.pg);
});
$('#eimg').addEventListener('change',async e=>{
  const fs=[...e.target.files];e.target.value='';if(!fs.length)return;
  try{const urls=await Promise.all(fs.map(loadPhoto));for(const [i,u] of urls.entries())addImage(await makePhoto(u),i);tool=null;commit();panel();refresh()}
  catch{toast('読み込めない画像がありました')}
});
$('#eimgswap').addEventListener('change',async e=>{
  const f=e.target.files[0];e.target.value='';const L=sel();if(!f||!isImg(L))return;
  try{L.photoId=await makePhoto(await loadPhoto(f));Object.assign(L,{zs:1,zx:0,zy:0});commit();panel();refresh()}catch{toast('この画像は読み込めませんでした')}
});
$('#eadd').addEventListener('change',async e=>{
  const fs=[...e.target.files];e.target.value='';if(!fs.length)return;
  try{await addPhotos(await Promise.all(fs.map(loadPhoto)));renderStrip();toast(`${fs.length}枚足しました。今のページのデザインが入っています`)}
  catch{toast('読み込めない画像がありました')}
});

/* ---------- design: everything but the photo ---------- */
const store={get(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}}};
// Stored relative to the picture size so a design fits any ratio.
// Positions relative to the picture; sizes relative to its width (a shape's height too, so it keeps its look).
function normL(L,W,H){
  const o={...clone(L),x:L.x/W,y:L.y/H};
  if(isText(L))o.size=L.size/W;else{o.w=L.w/W;if(isShape(L))o.h=L.h/W}
  return o;
}
function denormL(L,W,H){
  const o={...L,id:uid++,x:L.x*W,y:L.y*H};
  if(isText(L))o.size=L.size*W;else{o.w=L.w*W;if(isShape(L))o.h=L.h*W}
  return o;
}
const normDesign=()=>({v:1,layers:D.layers.filter(L=>!isImg(L)).map(L=>normL(L,D.W,D.H))});
function applyDesign(d){const ls=clone(d.layers).map(L=>denormL(L,D.W,D.H));D.layers=[...D.layers.filter(isImg),...ls];D.sel=null}
let toastT;function toast(msg){const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,2200)}
function openDesign(){renderDesign();$('#dsheet').hidden=false}
const tplMeta=t=>`${t.pages.length>1?t.pages.length+'枚組・':''}${t.slots?`写真${t.slots}枚`:'写真なし'}`;
async function renderDesign(){
  const clip=store.get('piclea.clip',null);
  $('#dpaste').disabled=!clip;$('#dall').disabled=P.pages.length<2;
  $('#pleft').disabled=P.cur===0;$('#pright').disabled=P.cur>=P.pages.length-1;$('#pdel').disabled=P.pages.length<2;
  $('#dpage').textContent=`この写真（${P.cur+1} / ${P.pages.length}枚目）`;
  $('#mysaveall').hidden=P.pages.length<2;$('#mysaveall').textContent=`${P.pages.length}枚組の型にする（表紙＋中ページ）`;
  const mine=await listDesigns().catch(()=>[]);
  $('#mylist').innerHTML=mine.length?mine.map(t=>`<div class="myrow"><img class="mythumb" src="${t.thumb}" alt=""><div class="mytxt"><b>${esc(t.name)}</b><small>${tplMeta(t)}</small></div><button class="eb" data-myapply="${t.id}">当てる</button><button class="myx" data-mydel="${t.id}" aria-label="消す">×</button></div>`).join('')
    :'<p class="enote">文字・飾り・重ねた写真の位置を、写真を抜いた「型」として取っておけます。重ねた写真は空の写真枠になり、使うときに写真をはめます。</p>';
}
async function removePage(){
  if(P.pages.length<2)return;
  if(!await ask(`${P.cur+1}枚目のページを消しますか？（元に戻すで戻せます）`,{ok:'消す'}))return;
  syncCur();P.pages.splice(P.cur,1);P.cur=Math.min(P.cur,P.pages.length-1);loadInto(P.pages[P.cur]);designChanged();
}
function designChanged(msg){commit();sizeCanvas();panel();refresh();renderStrip();emit('change');if(msg)toast(msg)}
$('#dsheet').addEventListener('click',async e=>{
  if(e.target.closest('[data-dclose]')){$('#dsheet').hidden=true;return}
  const b=e.target.closest('button');if(!b)return;
  switch(b.id){
    case 'dcopy':store.set('piclea.clip',normDesign());renderDesign();toast('デザインをコピーしました（写真以外）');return;
    case 'dpaste':{const c=store.get('piclea.clip',null);if(!c)return;applyDesign(c);designChanged('貼り付けました');renderDesign();return}
    case 'dall':{
      if(!await ask('ほかの写真の文字と飾りを、全部このページと同じにしますか？',{ok:'そろえる'}))return;
      syncCur();const d=normDesign();
      P.pages.forEach((pg,i)=>{if(i!==P.cur)withPage(pg,()=>{applyDesign(d);P.pages[i]=clone(D)})});
      loadInto(P.pages[P.cur]);designChanged(`${P.pages.length}枚ぜんぶ同じデザインにしました`);return;
    }
    case 'mysave':case 'mysaveall':{
      const n=(await listDesigns().catch(()=>[])).length;
      const name=await ask('型の名前',{ok:'型にする',input:`型 ${n+1}`});if(!name)return;
      try{await saveDesign(name.slice(0,30),b.id==='mysaveall');renderDesign();toast('型にしました。トップの「型から作る」で使えます')}
      catch(err){console.warn(err);toast('保存できませんでした')}
      return;
    }
    case 'pleft':case 'pright':{
      movePage(b.id==='pleft'?-1:1);renderDesign();return;
    }
    case 'pdel':await removePage();renderDesign();return;
  }
  if(b.dataset.myapply){const t=await getDesign(b.dataset.myapply);if(t){applyTemplate(t);designChanged(`「${t.name}」を当てました`)}return}
  if(b.dataset.mydel){const t=await getDesign(b.dataset.mydel);if(t&&await ask(`型「${t.name}」を消しますか？`,{ok:'消す'})){await deleteDesign(t.id);renderDesign()}}
});

/* ---------- 型: a whole work without its photos, kept in IndexedDB ---------- */
// Positions and sizes are relative to the picture so a 型 fits any ratio. Overlaid photos become empty
// frames that keep their shape; each page's background is a frame too. A 型 of several pages is a cover
// plus inside pages: when more photos come than it has pages, its last page repeats.
function normPage(pg){
  return {bg:clone(bgOf(pg)),layers:pg.layers.map(L=>!isImg(L)?normL(L,pg.W,pg.H)
    :(f=>({...normL(L,pg.W,pg.H),photoId:null,ar:f.w/f.h,zs:1,zx:0,zy:0}))(imgFrame(L)))};
}
function tplPage(tp,W,H,ratio){
  return {ratio,W,H,photo:{s:1,ox:0,oy:0},sel:null,photoId:null,bg:clone(tp.bg||{type:'photo'}),
    layers:clone(tp.layers).map(L=>isImg(L)?{...denormL(L,W,H),photoId:null}:denormL(L,W,H))};
}
const slotCount=pages=>pages.reduce((n,p)=>n+(photoBg(p)?1:0)+p.layers.filter(isImg).length,0);
const emptySlots=()=>{syncCur();return P.pages.reduce((n,pg)=>n+(pg.photoId||!photoBg(pg)?0:1)+pg.layers.filter(L=>isImg(L)&&!L.photoId).length,0)};
function pageThumb(pg,grad){
  const c=document.createElement('canvas'),h=260,w=Math.round(h*pg.W/pg.H);c.width=w;c.height=h;
  const x=c.getContext('2d');x.setTransform(w/pg.W,0,0,h/pg.H,0,0);withPage(pg,()=>draw(x,{thumb:true,grad}));return c.toDataURL('image/jpeg',.75);
}
async function saveDesign(name,all){
  await ensureAll();const pgs=all?P.pages:[P.pages[P.cur]];
  await DB.run('designs','readwrite',st=>st.put({id:newId('d'),name,updated:Date.now(),ratio:D.ratio,pages:pgs.map(normPage),thumb:pageThumb(pgs[0])}));
  emit('designs');
}
// マイデザイン used to live in localStorage (texts only); move them over once, drawing a sample for each.
let migrated=null;
function migrateDesigns(){
  return migrated??=(async()=>{
    let old=null;try{old=JSON.parse(localStorage.getItem('piclea.designs'))}catch{}
    if(!Array.isArray(old)||!old.length)return;
    for(const m of old){
      const pages=[{layers:m.d.layers}],pg=tplPage(pages[0],OUT_W,Math.round(OUT_W*5/4),'4:5');
      await Promise.all(pg.layers.filter(isText).map(L=>loadFace(L.fam,L.w,loadText(L)).catch(()=>[])));
      await DB.run('designs','readwrite',st=>st.put({id:'d'+m.id,name:m.name,updated:m.id,ratio:null,pages,thumb:pageThumb(pg)}));
    }
    localStorage.removeItem('piclea.designs');
  })().catch(err=>{console.warn(err);migrated=null});
}
async function listDesigns(){
  await migrateDesigns();
  const all=await DB.run('designs','readonly',st=>st.getAll());
  return (all||[]).sort((a,b)=>b.updated-a.updated).map(t=>({id:t.id,name:t.name,thumb:t.thumb,pages:t.pages,slots:slotCount(t.pages)}));
}
const getDesign=id=>DB.run('designs','readonly',st=>st.get(id));
async function deleteDesign(id){await DB.run('designs','readwrite',st=>st.delete(id));emit('designs')}
// A new work from a 型: the photos go in order, page by page, background first and then its frames.
async function fromTemplate(id,urls){
  const t=await getDesign(id);if(!t)throw new Error('missing');
  const ids=[];for(const u of urls)ids.push(await makePhoto(u));
  const r=RATIOS.find(x=>x[0]===t.ratio)||RATIOS[0],first=photos.get(ids[0]);
  const W=OUT_W,H=Math.round(W/(r[1]||(first?first.img.width/first.img.height:.8))),q=[...ids],pages=[];
  for(let i=0;i<t.pages.length||q.length;i++){
    const pg=tplPage(t.pages[Math.min(i,t.pages.length-1)],W,H,r[0]);
    if(photoBg(pg))pg.photoId=q.shift()??null;for(const L of pg.layers)if(isImg(L))L.photoId=q.shift()??null;
    pages.push(pg);
  }
  clearTimeout(saveT);savedPhotos=new Set();
  adopt({pages,cur:0},null);autosave();
  return emptySlots();
}
// On the page being edited: the 型's texts and frames replace the page's, the page's own overlaid photos
// fill the frames in order, and the background stays.
function applyTemplate(t){
  const pg=tplPage(t.pages[Math.min(P.cur,t.pages.length-1)],D.W,D.H,D.ratio);
  const old=D.layers.filter(L=>isImg(L)&&L.photoId);
  for(const L of pg.layers)if(isImg(L)){const o=old.shift();if(o)Object.assign(L,{photoId:o.photoId})}
  D.layers=[...old,...pg.layers];D.bg=pg.bg;D.sel=null;
}

/* ---------- works kept on this device (IndexedDB), plus a backup file ---------- */
const DB={
  db:null,
  open(){return this.db??=new Promise((res,rej)=>{
    const r=indexedDB.open('piclea',2);
    r.onupgradeneeded=()=>{const d=r.result;for(const [n,o] of [['works',{keyPath:'id'}],['photos'],['designs',{keyPath:'id'}]])if(!d.objectStoreNames.contains(n))d.createObjectStore(n,o)};
    r.onsuccess=()=>{const d=r.result;d.onversionchange=()=>d.close();res(d)};r.onerror=()=>rej(r.error);
  })},
  async run(store,mode,fn){const d=await this.open();return new Promise((res,rej)=>{const t=d.transaction(store,mode),req=fn(t.objectStore(store));t.oncomplete=()=>res(req?.result);t.onerror=t.onabort=()=>rej(t.error)})},
};
let workId=null,savedPhotos=new Set(),saveT=0,asked=false;
const usedPhotos=()=>[...new Set(P.pages.flatMap(pg=>[pg.photoId,...pg.layers.filter(isImg).map(L=>L.photoId)]).filter(Boolean))];
function autosave(){if(!worthSaving())return;clearTimeout(saveT);saveT=setTimeout(()=>saveWork().catch(err=>{console.warn(err);toast('端末に保存できませんでした')}),1200)}
const workThumb=()=>pageThumb(P.pages[0]);
async function saveWork(){
  syncCur();if(!P.pages.length)return;
  workId??=newId('w');
  const ids=usedPhotos();
  for(const id of ids){
    if(savedPhotos.has(id)||!photos.has(id))continue;
    const blob=await (await fetch(photos.get(id).url)).blob();
    await DB.run('photos','readwrite',st=>st.put(blob,id));savedPhotos.add(id);
  }
  const prev=await DB.run('works','readonly',st=>st.get(workId));
  const title=(P.pages[0].layers.find(isText)?.text||'').split('\n')[0].slice(0,24)||'無題';
  await DB.run('works','readwrite',st=>st.put({id:workId,title,updated:Date.now(),thumb:workThumb(),doc:clone(P),photos:ids}));
  for(const id of prev?.photos||[])if(!ids.includes(id)){await DB.run('photos','readwrite',st=>st.delete(id));savedPhotos.delete(id)}
  if(!asked){asked=true;navigator.storage?.persist?.().catch(()=>{})}
  emit('saved');
}
async function listWorks(){
  const all=await DB.run('works','readonly',st=>st.getAll());
  return (all||[]).sort((a,b)=>b.updated-a.updated).map(w=>({id:w.id,title:w.title,updated:w.updated,thumb:w.thumb,pages:w.doc.pages.length,current:w.id===workId}));
}
function adopt(doc,id){
  workId=id;P.pages=doc.pages;P.cur=Math.min(doc.cur||0,P.pages.length-1);loadInto(P.pages[P.cur]);
  uid=Math.max(uid,...P.pages.flatMap(pg=>pg.layers.map(L=>L.id+1)));
  wrapCache.clear();hist=[snap()];redo=[];syncUndo();emit('loaded');
}
async function openWork(id){
  clearTimeout(saveT);
  const w=await DB.run('works','readonly',st=>st.get(id));if(!w)throw new Error('missing');
  for(const pid of w.photos){
    if(!photos.has(pid)){const blob=await DB.run('photos','readonly',st=>st.get(pid));if(blob)await makePhoto(URL.createObjectURL(blob),pid)}
    savedPhotos.add(pid);
  }
  adopt(w.doc,id);
}
async function deleteWork(id){
  if(workId===id){clearTimeout(saveT);workId=null} // no pending autosave may bring it back
  const w=await DB.run('works','readonly',st=>st.get(id));
  await DB.run('works','readwrite',st=>st.delete(id));
  for(const pid of w?.photos||[]){await DB.run('photos','readwrite',st=>st.delete(pid));savedPhotos.delete(pid)}
  if(workId===id)workId=null;
}
function newWork(){
  clearTimeout(saveT);workId=null;savedPhotos=new Set();
  P.pages=[];P.cur=0;loadInto({ratio:'4:5',W:OUT_W,H:Math.round(OUT_W*5/4),photo:{s:1,ox:0,oy:0},layers:[],sel:null,photoId:null});
  hist=[];redo=[];syncUndo();emit('reset');
}
const toDataURL=b=>new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)});
// A backup is one JSON file holding the work and its photos; it goes to the Files app through the share sheet.
async function backupFile(){
  syncCur();
  const data={app:'piclea',v:1,id:workId,updated:Date.now(),doc:clone(P),photos:{}};
  for(const id of usedPhotos())data.photos[id]=await toDataURL(await (await fetch(photos.get(id).url)).blob());
  const title=(P.pages[0]?.layers[0]?.text||'').split('\n')[0].slice(0,12).replace(/[\\/:*?"<>|\s]/g,'')||'piclea';
  return new File([JSON.stringify(data)],`piclea-${title}-${new Date().toLocaleDateString('sv')}.json`,{type:'application/json'});
}
// The 型 alone: small, since there are no photos, only a sample picture each.
async function designsFile(){
  await migrateDesigns();
  const designs=await DB.run('designs','readonly',st=>st.getAll());
  return new File([JSON.stringify({app:'piclea',kind:'designs',v:2,designs})],`piclea-kata-${new Date().toLocaleDateString('sv')}.json`,{type:'application/json'});
}
/* ---------- everything in one ZIP ---------- */
// Photos go in as they are, one at a time, so dozens of works never sit in memory together; reading back
// takes only the table at the end and then slices out the photos that are actually needed.
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(buf){let c=~0;const b=new Uint8Array(buf);for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&255]^(c>>>8);return ~c>>>0}
// A stored photo never changes under its id, so its checksum is worked out once per session.
const crcOf=new Map();
async function zipFile(entries,name){
  const enc=new TextEncoder(),parts=[],cd=[];let off=0;
  for(const e of entries){
    const nm=enc.encode(e.name),blob=e.blob,size=blob.size;
    let crc=e.key&&crcOf.get(e.key);
    if(crc==null){crc=crc32(await blob.arrayBuffer());if(e.key)crcOf.set(e.key,crc)}
    const h=new DataView(new ArrayBuffer(30));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint16(8,0,true); // stored, UTF-8 names
    h.setUint16(12,0x21,true);h.setUint32(14,crc,true);h.setUint32(18,size,true);h.setUint32(22,size,true);h.setUint16(26,nm.length,true);
    parts.push(h.buffer,nm,blob);
    const c=new DataView(new ArrayBuffer(46));
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(14,0x21,true);
    c.setUint32(16,crc,true);c.setUint32(20,size,true);c.setUint32(24,size,true);c.setUint16(28,nm.length,true);c.setUint32(42,off,true);
    cd.push(c.buffer,nm);off+=30+nm.length+size;
  }
  const cdSize=cd.reduce((s,p)=>s+p.byteLength,0),end=new DataView(new ArrayBuffer(22));
  end.setUint32(0,0x06054b50,true);end.setUint16(8,entries.length,true);end.setUint16(10,entries.length,true);end.setUint32(12,cdSize,true);end.setUint32(16,off,true);
  return new File([...parts,...cd,end.buffer],name,{type:'application/zip'});
}
async function readZip(file){
  const u16=(v,i)=>v.getUint16(i,true),u32=(v,i)=>v.getUint32(i,true),dec=new TextDecoder();
  const tailAt=Math.max(0,file.size-65557),tail=new DataView(await file.slice(tailAt).arrayBuffer());
  let e=tail.byteLength-22;while(e>=0&&u32(tail,e)!==0x06054b50)e--;
  if(e<0)throw new Error('not a zip');
  const n=u16(tail,e+10),cdSize=u32(tail,e+12),cdOff=u32(tail,e+16),cd=new DataView(await file.slice(cdOff,cdOff+cdSize).arrayBuffer()),out=new Map();
  for(let i=0,p=0;i<n;i++){
    if(u32(cd,p)!==0x02014b50||u16(cd,p+10)!==0)throw new Error('unsupported zip'); // only what piclea writes: stored, not compressed
    const nl=u16(cd,p+28),name=dec.decode(new Uint8Array(cd.buffer,p+46,nl));
    out.set(name,{local:u32(cd,p+42),size:u32(cd,p+24)});p+=46+nl+u16(cd,p+30)+u16(cd,p+32);
  }
  const blob=async(name,type='')=>{
    const f=out.get(name);if(!f)return null;
    const h=new DataView(await file.slice(f.local,f.local+30).arrayBuffer()),at=f.local+30+u16(h,26)+u16(h,28);
    return file.slice(at,at+f.size,type);
  };
  return {blob};
}
const EXT={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/heic':'.heic','image/gif':'.gif'};
async function backupAll(){
  if(worthSaving())await saveWork(); // the open work goes in as it is now
  await migrateDesigns();
  const works=await DB.run('works','readonly',st=>st.getAll())||[],designs=await DB.run('designs','readonly',st=>st.getAll())||[];
  const entries=[],photoFiles={};
  for(const id of new Set(works.flatMap(w=>w.photos))){
    const b=await DB.run('photos','readonly',st=>st.get(id));if(!b)continue;
    photoFiles[id]={file:`photos/${id}${EXT[b.type]||''}`,type:b.type};entries.push({name:photoFiles[id].file,blob:b,key:id});
  }
  const manifest={app:'piclea',kind:'all',v:1,created:Date.now(),works,designs,photos:photoFiles};
  entries.unshift({name:'piclea.json',blob:new Blob([JSON.stringify(manifest)],{type:'application/json'})});
  return zipFile(entries,'piclea-backup.zip');
}
// A work or 型 already here and at least as new is left alone, so the same file can be read any number of times.
async function importAll(file){
  const z=await readZip(file),m=JSON.parse(await (await z.blob('piclea.json')).text());
  if(m.app!=='piclea'||m.kind!=='all')throw new Error('not piclea');
  const r={kind:'all',added:0,updated:0,same:0,designs:0};let reopen=false;
  for(const w of m.works||[]){
    const have=await DB.run('works','readonly',st=>st.get(w.id));
    if(have&&have.updated>=w.updated){r.same++;continue}
    for(const pid of w.photos){
      if(await DB.run('photos','readonly',st=>st.getKey(pid)))continue;
      const p=m.photos[pid],b=p&&await z.blob(p.file,p.type);
      if(b)await DB.run('photos','readwrite',st=>st.put(b,pid));
    }
    await DB.run('works','readwrite',st=>st.put(w));r[have?'updated':'added']++;
    if(w.id===workId)reopen=true;
  }
  for(const t of m.designs||[]){
    const have=await DB.run('designs','readonly',st=>st.get(t.id));
    if(!have||(have.updated||0)<(t.updated||0)){await DB.run('designs','readwrite',st=>st.put(t));r.designs++}
  }
  if(reopen){savedPhotos=new Set();await openWork(workId)} // the open work was older than the file's
  emit('designs');emit('saved');return r;
}
// One file picker reads every kind of backup. Returns 'all' with counts, 'designs' with a count, or 'work'.
async function importFile(file){
  const sig=new Uint8Array(await file.slice(0,4).arrayBuffer());
  if(sig[0]===0x50&&sig[1]===0x4b)return importAll(file); // "PK": the everything-backup
  const data=JSON.parse(await file.text());
  if(data.app==='piclea'&&data.kind==='designs'&&Array.isArray(data.designs)){
    const ok=data.designs.filter(t=>t&&t.id&&Array.isArray(t.pages)&&t.pages.length);
    for(const t of ok)await DB.run('designs','readwrite',st=>st.put(t)); // same id = the same 型, so it is replaced, not doubled
    emit('designs');return {kind:'designs',n:ok.length};
  }
  await importWork(data);return {kind:'work'};
}
async function importWork(data){
  if(data.app!=='piclea'||!data.doc?.pages)throw new Error('not piclea');
  const have=data.id&&await DB.run('works','readonly',st=>st.get(data.id));
  if(have&&have.updated>=data.updated){await openWork(data.id);return} // this device already has it, as new or newer
  const map={};
  for(const [old,url] of Object.entries(data.photos||{})){const blob=await (await fetch(url)).blob();map[old]=await makePhoto(URL.createObjectURL(blob))}
  for(const pg of data.doc.pages){pg.photoId=map[pg.photoId]??null;for(const L of pg.layers)if(isImg(L))L.photoId=map[L.photoId]??null}
  savedPhotos=new Set();adopt(data.doc,data.id||null);await saveWork();
}
// The first tap makes the file; the second, a fresh gesture, hands it over (iOS only opens the share sheet then).
// Elsewhere one tap makes it and downloads it.
// done(madeAt) runs once the file has really gone out (on iOS, only when the share sheet was not cancelled).
// iOS opens the share sheet only straight from a tap, so a file made after the tap needs a second one.
// prepare() makes it ahead (when 「つくったもの」 opens), so that one tap is enough.
function exportButton(b,make,done){
  const label=b.textContent;let file=null,madeAt=0,job=null,gen=0;
  const build=async()=>{
    const g=++gen;b.disabled=true;b.textContent='準備しています…';
    try{const f=await make();if(g!==gen)return false;file=f;madeAt=Date.now();return true}
    finally{if(g===gen){b.disabled=false;job=null}}
  };
  b.prepare=()=>{if(OS!=='ios')return;file=null;job=build().then(ok=>{if(ok)b.textContent=label},()=>{b.textContent=label})};
  b.onclick=async()=>{
    if(OS!=='ios'){
      b.disabled=true;b.textContent='準備しています…';
      try{const f=await make();madeAt=Date.now();download([f]);done?.(madeAt);toast(OS==='android'?'「ダウンロード」に保存しました':'ダウンロードフォルダに保存しました')}
      catch{toast('書き出せませんでした')}
      finally{b.disabled=false;b.textContent=label}
      return;
    }
    if(file){
      const at=madeAt;
      if(navigator.canShare?.({files:[file]}))navigator.share({files:[file]}).then(()=>done?.(at)).catch(()=>{});
      else{const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=file.name;a.click();done?.(at)}
      file=null;b.textContent=label;return;
    }
    if(job)return;
    job=build().then(ok=>{if(ok)b.textContent='「ファイル」に保存する（もう一度タップ）'},()=>{b.textContent=label;toast('書き出せませんでした')});
  };
}
exportButton($('#wexport'),backupFile);exportButton($('#texport'),designsFile);
// The everything-backup remembers when it last went out, so 「つくったもの」 can say what has changed since.
exportButton($('#wall'),backupAll,at=>{store.set('piclea.lastBackup',{at});emit('backedup')});
const lastBackup=()=>store.get('piclea.lastBackup',null),prepareBackup=()=>$('#wall').prepare();
on('saved',()=>{const t=$('#esaved');if(!t)return;t.textContent='保存しました';t.classList.add('on');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('on'),1600)});

/* ---------- open / close / save ---------- */
function openEditor(){
  D.sel=null;tool=null;tedit.hidden=true; // open on the whole picture, nothing picked
  sizeCanvas();$('#editor').hidden=false;document.body.style.overflow='hidden';panel();refresh();
}
function closeEditor(){$('#editor').hidden=true;document.body.style.overflow='';emit('closed')}
$('#eback').onclick=closeEditor;
$('#eundo').onclick=undo;$('#eredo').onclick=redoIt;
document.addEventListener('keydown',e=>{
  if($('#editor').hidden)return;
  const typing=/TEXTAREA|INPUT/.test(document.activeElement?.tagName);
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!typing){e.preventDefault();e.shiftKey?redoIt():undo()}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'&&!typing){e.preventDefault();redoIt()}
  else if((e.key==='Delete'||e.key==='Backspace')&&!typing&&sel()){e.preventDefault();removeSelected()}
  else if(e.key==='Escape'){if(!tedit.hidden)closeText();else if(sel())deselect()}
});
$('#efile').addEventListener('change',async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  try{await setPhoto(await loadPhoto(f));sizeCanvas();panel();refresh()}catch{toast('この画像は読み込めませんでした')}
});

// Saving: render off screen with no selection marks, show the result, then hand the file to the share
// sheet from a fresh tap (iOS only opens it on a direct user gesture).
let saved=null;
$('#esave').onclick=async()=>{
  const btn=$('#esave');btn.disabled=true;
  const slow=setTimeout(()=>toast('書体を読み込んでいます…'),800);
  try{
    const miss=await missingFaces();clearTimeout(slow);
    if(miss.length){await ask(`書体「${miss.join('」「')}」を読み込めませんでした。違う書体のまま保存しないよう、止めています。電波のよいところで、もう一度「保存」を押してください。`,{ok:'閉じる',cancel:false});return}
    syncCur();
    const stamp=new Date().toISOString().slice(0,19).replace(/\D/g,''),many=P.pages.length>1;
    const canvases=P.pages.map(pg=>withPage(pg,()=>{const off=document.createElement('canvas');off.width=D.W;off.height=D.H;draw(off.getContext('2d'));return off}));
    const blobs=await Promise.all(canvases.map(c=>new Promise(r=>c.toBlob(r,'image/jpeg',.92))));
    saved?.urls.forEach(u=>URL.revokeObjectURL(u));
    saved={files:blobs.map((b,i)=>new File([b],`piclea-${stamp}${many?'-'+String(i+1).padStart(2,'0'):''}.jpg`,{type:'image/jpeg'})),urls:blobs.map(b=>URL.createObjectURL(b))};
    $('#sprevs').innerHTML=saved.urls.map((u,i)=>`<img src="${u}" alt="${i+1}枚目">`).join('');
    $('#sprevs').classList.toggle('many',many);
    $('#ssize').textContent=`${many?P.pages.length+'枚・':''}${D.W} × ${D.H}`;
    const share=OS!=='pc'&&navigator.canShare?.({files:saved.files});
    $('#sshare').textContent=OS==='ios'&&share?(many?`${P.pages.length}枚まとめて保存・共有`:'写真に保存・共有'):many?`${P.pages.length}枚まとめて保存`:'画像を保存';
    $('#sshare2').hidden=!(OS==='android'&&share); // Android: saving and sending to Instagram are two different wishes
    $('#ssheet').hidden=false;
    const empty=emptySlots();if(empty)toast(`写真がはまっていない枠が${empty}つあります`);
  }finally{clearTimeout(slow);btn.disabled=false}
};
$('#sshare').onclick=()=>{
  if(!saved)return;
  if(OS==='ios'&&navigator.canShare?.({files:saved.files}))navigator.share({files:saved.files}).catch(()=>{});
  else{download(saved.files,saved.urls);toast(OS==='android'?'「ダウンロード」に保存しました':'ダウンロードフォルダに保存しました')}
};
$('#sshare2').onclick=()=>{if(saved&&navigator.canShare?.({files:saved.files}))navigator.share({files:saved.files}).catch(()=>{})};
document.querySelectorAll('[data-sclose]').forEach(x=>x.onclick=()=>$('#ssheet').hidden=true);
addEventListener('resize',()=>paint());

Object.assign(window.PICLEA,{app:{os:OS,D,INK,SHADOW,newLayer,addLayer,removeLayer,setFont,draw,ensureFonts,hitLayer,snapMove,setPhoto,commit,openEditor,on,
  hasPhoto:()=>!!cur(),hasGlyph,ask,toast,addPhotos,isText,isImg,PALETTE,switchPage,pageCount:()=>P.pages.length,pageIndex:()=>P.cur,listWorks,openWork,deleteWork,newWork,importFile,backupFile,backupAll,lastBackup,prepareBackup,sel,GRADS,listDesigns,getDesign,deleteDesign,fromTemplate,tplMeta}});
})();
