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
// Several at once (as in Canva): MS holds their ids while D.sel stays empty. Layers that share a grp are a group:
// touching one takes them all, and a tap on one of them while they are held picks just that one to edit.
// addMode (選択を追加 on a phone, Shift on a computer) makes each tap add or take away.
let MS=[],addMode=false;
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
// A line is a shape too: w is its length and h its thickness. 点線 is a row of round dots; the arrows and
// 吹き出しの下 (a line with a V in the middle) are drawn with a pen of width h. 囲み are pen loops of width lw.
// RIBBON: pen strokes drawn as one tapered ribbon of thickness lw inside a w×h box (囲み and the 飾り lines).
const RIBBON=new Set(['scribble','scribble2','swirl','coil','wave']),DECO=new Set(['sparkle','flower','blob','heart','arch']);
const LINEISH=new Set(['line','dots','notch','arrow','arrowc','arrowl']),PENNED=new Set(['notch','arrow','arrowc','arrowl',...RIBBON]);
const NOGLASS=new Set(['notch','arrow','arrowc','arrowl','bubble','bubbler','cloud','spiky',...RIBBON,...DECO]);
const isLine=L=>isShape(L)&&LINEISH.has(L.kind);
const bgOf=pg=>pg.bg||{type:'photo'},photoBg=pg=>bgOf(pg).type==='photo';
function syncCur(){P.pages[P.cur]=clone(D)}
function loadInto(pg){for(const k of Object.keys(D))delete D[k];Object.assign(D,clone(pg))}
// Another page drawn in D's place for a moment. D gets its own objects back, not copies: anything still holding a
// layer (a delete waiting on its confirm, a photo being picked) must find the same object afterwards.
function withPage(pg,fn){const keep={...D};loadInto(pg);try{return fn()}finally{for(const k of Object.keys(D))delete D[k];Object.assign(D,keep)}}
function goPage(i){syncCur();P.cur=i;loadInto(P.pages[i]);MS=[];addMode=false}
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
      glassPaint(c,glassRead(c,hx,hy),sh==='circle'||sh==='ellipse'?sdEllipse(hx,hy):sdRect(hx,hy,sh==='pill'?Math.min(hx,hy):Math.min(L.size*L.band.r/100,hx,hy)),hx,hy,L.opacity,[L.band.color,L.band.gta]);
      framePath(c,L,m);
    }
    else{framePath(c,L,m);c.globalAlpha=L.opacity*L.band.a;c.fillStyle=L.band.color;c.fill()}
    const ln=L.band.line;if(ln?.on){c.globalAlpha=L.opacity;c.lineWidth=s*ln.w/100;c.strokeStyle=ln.color;c.stroke()}
    c.restore();
  }
  const gm=L.glyph,GA=(gm==='glass'||gm==='jelly')&&glyphRead(c,L,m); // glass and jelly bend the picture as it was before their shadow
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
  if(gm==='glass')glyphPaint(c,L,f,m,GA,'glass');
  else if(gm==='jelly')glyphPaint(c,L,f,m,GA,'jelly');
  else if(gm==='carve')glyphPaint(c,L,f,m,glyphRead(c,L,m),'carve');
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
// tint: [hex, amount] — the picture through the glass takes the colour like a filter; the light stays white.
function glassPaint(c,A,sd,hx,hy,alpha,tint){
  if(!A)return;
  const ta=tint?.[1]||0,tn=ta&&parseInt(tint[0].slice(1),16),f0=1-ta,fr=f0+ta*(tn>>16)/255,fg=f0+ta*(tn>>8&255)/255,fb=f0+ta*(tn&255)/255;
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
    const rt=ta?r*fr:r,gt=ta?g*fg:g,bt=ta?bl*fb:bl,R=rt+(255-rt)*lit,Gn=gt+(255-gt)*lit,B=bt+(255-bt)*lit;
    for(let jj=j,je=Math.min(h,j+st);jj<je;jj++)for(let ii=i,ie=Math.min(w,i+st);ii<ie;ii++){const n=(jj*w+ii)*4;o[n]+=(R-o[n])*a;o[n+1]+=(Gn-o[n+1])*a;o[n+2]+=(B-o[n+2])*a}
  }
  c.putImageData(out,x0,y0);
}
// Glass letters and letters cut into the picture. The letters are drawn as a white mask, blurred into a
// height (own box blur, Safari's canvas has no filter), and the height's slope bends what is under them
// and lights the rim: raised glass takes in the outside and shines top-left; a cut takes in the floor and
// is shaded on its top-left wall.
let MC=null;
// For jelly: the distance in from the edge (two-pass chamfer), turned into a round profile across each stroke
// whose radius is the thickest stroke's half width, then softened. Leaves the height in px in H; returns the radius.
// Rmax caps it: a shape running past the picture's edge has no edge in view, and its distances would never end.
function jellyDome(M,H,T,w,h,Rmax){
  const INF=1e9,D2=Math.SQRT2;
  for(let i=0;i<w*h;i++)T[i]=M[i]>.5?INF:0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!T[i])continue;let d=T[i];
    if(x>0)d=Math.min(d,T[i-1]+1);if(y>0){d=Math.min(d,T[i-w]+1);if(x>0)d=Math.min(d,T[i-w-1]+D2);if(x<w-1)d=Math.min(d,T[i-w+1]+D2)}T[i]=d}
  let R=1;
  for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;if(!T[i])continue;let d=T[i];
    if(x<w-1)d=Math.min(d,T[i+1]+1);if(y<h-1){d=Math.min(d,T[i+w]+1);if(x<w-1)d=Math.min(d,T[i+w+1]+D2);if(x>0)d=Math.min(d,T[i+w-1]+D2)}T[i]=d;if(d>R)R=d}
  R=Math.max(1,Math.min(R,Rmax));
  for(let i=0;i<w*h;i++){const u=1-Math.min(T[i],R)/R;H[i]=T[i]?R*Math.sqrt(1-u*u):0}
  boxBlur(H,T,w,h,Math.max(1,Math.round(R*.28))); // wide enough to melt the creases where strokes meet
  return R;
}
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
// Foil in a cut: the same slope lights a metal ramp (dark, mid, light) instead of the picture, with a slow sheen across.
const FOIL={gold:[[122,88,30],[201,162,74],[250,236,186]],silver:[[88,94,99],[182,188,192],[247,249,250]],rose:[[125,74,68],[210,156,142],[250,224,214]]};
function glyphPaint(c,L,f,m,A,mode){return maskPaint(c,L,A,mode,mc=>{mc.font=fontStr(f,L.size);glyphs(mc,L,f,m,false)})}
// mask(mc) draws the layer's shape in white on a context already set to the layer's transform
function maskPaint(c,L,A,mode,mask){
  if(!A)return;
  // While something is being dragged the work is done on a half-size grid (st=2) and written in 2×2 blocks.
  const {T,x0,y0}=A,W=A.w,Hh=A.h,st=glassFast?2:1,w=Math.ceil(W/st),h=Math.ceil(Hh/st),k=Math.hypot(T.a,T.b)/st,N=w*h;
  MC??=document.createElement('canvas');MC.width=w;MC.height=h;
  const mc=MC.getContext('2d',{willReadFrequently:true});
  mc.setTransform(T.a/st,T.b/st,T.c/st,T.d/st,(T.e-x0)/st,(T.f-y0)/st);mc.fillStyle='#fff';mask(mc);
  const md=mc.getImageData(0,0,w,h).data,M=new Float32Array(N),H=new Float32Array(N),tmp=new Float32Array(N);
  for(let i=0;i<N;i++)M[i]=H[i]=md[i*4+3]/255;
  let R=1;if(mode==='jelly')R=jellyDome(M,H,tmp,w,h,Math.max(2,(isShape(L)?Math.min(L.w,L.h)/2:L.size*.5)*k));
  const JD=Math.min(R,40*k)*.55; // how far jelly reaches for the picture, held back on big shapes
  const carve=mode==='carve',FC=carve&&FOIL[L.cfoil],foil=!!FC; // the cut's top-left wall is the dark one
  const JL=[-.45,-.55,.7].map((v,_,A)=>v/Math.hypot(...A)),JH=(()=>{const h=[JL[0],JL[1],JL[2]+1],l=Math.hypot(...h);return h.map(v=>v/l)})();
  const ta=mode==='glass'?L.gta||0:0,n0=parseInt(L.color.slice(1),16),TC=[n0>>16,n0>>8&255,n0&255],TV=[0,0,0];
  // jelly: how much each channel survives one unit of the way through (log), and the colour at full strength
  const LT=TC.map(v=>Math.log(Math.max(.03,v/255))),tm=Math.max(...TC,1),VIV=TC.map(v=>v*255/tm);
  const jelly=mode==='jelly',dp=L.gd??1,r=Math.max(1,Math.round((L.size||0)*k*(carve?.022:.04))); // 深さ steepens the slope (widening the bevel flattened thin strokes)
  if(mode!=='jelly')boxBlur(H,tmp,w,h,r);
  const out=c.getImageData(x0,y0,W,Hh),o=out.data,b=A.bg.data,VV=[0,0,0],sl=2.2*r,shift=carve?-.9*r:2.2*r;
  const put=(x,y,a)=>{ // one grid cell onto its st×st block of the picture
    for(let Y=y*st,ye=Math.min(Hh,Y+st);Y<ye;Y++)for(let X=x*st,xe=Math.min(W,X+st);X<xe;X++){const n=(Y*W+X)*4;o[n]+=(VV[0]-o[n])*a;o[n+1]+=(VV[1]-o[n+1])*a;o[n+2]+=(VV[2]-o[n+2])*a}
  };
  const toF=v=>(v+.5)*st-.5; // grid position to picture pixel
  // every cell, the outermost too (a shape running off the picture reaches its edge); neighbours are held inside
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x,cov=M[i];if(!cov)continue;
    const iL=x?i-1:i,iR=x<w-1?i+1:i,iU=y?i-w:i,iD=y<h-1?i+w:i;
    const sx=-(H[iR]-H[iL])*sl*dp,sy=-(H[iD]-H[iU])*sl*dp; // about -1..1, pointing out of the letter
    const px=Math.max(0,Math.min(W-1.001,toF(x+sx*shift))),py=Math.max(0,Math.min(Hh-1.001,toF(y+sy*shift)));
    const ix=px|0,iy=py|0,fx=px-ix,fy=py-iy,p=(iy*W+ix)*4,q=p+W*4;
    const w00=(1-fx)*(1-fy),w10=fx*(1-fy),w01=(1-fx)*fy,w11=fx*fy;
    const dot=-(sx+sy)*Math.SQRT1_2,d2=Math.min(1,dot*dot); // > 0 where the rim faces the light
    if(jelly){ // a pillow on every stroke: the picture through it dyed deeper the longer the way, a sharp wet highlight, a white lip, light gathering low inside
      const gx=Math.max(-3,Math.min(3,(H[iR]-H[iL])/2*dp)),gy=Math.max(-3,Math.min(3,(H[iD]-H[iU])/2*dp));
      const nl=Math.sqrt(gx*gx+gy*gy+1),Nx=-gx/nl,Ny=-gy/nl,Nz=1/nl,nh=Nx*JH[0]+Ny*JH[1]+Nz*JH[2];
      const hh=H[i]/R,ss=Math.max(0,Math.min(1,(nh-.94)/.035)),spec=ss*ss*(3-2*ss),sheen=Math.pow(Math.max(0,nh),12);
      const dif=Nx*JL[0]+Ny*JL[1]+Nz*JL[2],gl=Math.sqrt(gx*gx+gy*gy)||1,away=-(gx+gy)/gl*Math.SQRT1_2;
      const glow=Math.max(0,away)*4*hh*(1-hh)*(1-Nz*.35),rim=Math.pow(1-Nz,3)*(away<0?.75:.3);
      const path=(.3+2*hh+.8*(1-Nz))*(.4+.6*dp),fill=1-Math.exp(-2.2*hh),a=cov*L.opacity;
      const jx=Math.max(0,Math.min(W-1.001,toF(x-gx*JD))),jy=Math.max(0,Math.min(Hh-1.001,toF(y-gy*JD))),jx0=jx|0,jy0=jy|0,fx2=jx-jx0,fy2=jy-jy0,jp=(jy0*W+jx0)*4,jq=jp+W*4;
      for(let ch=0;ch<3;ch++)VV[ch]=(b[jp+ch]*(1-fx2)+b[jp+4+ch]*fx2)*(1-fy2)+(b[jq+ch]*(1-fx2)+b[jq+4+ch]*fx2)*fy2;
      const dim=.25*fill*(1-(VV[0]*.3+VV[1]*.59+VV[2]*.11)/255); // over a dark picture some light still scatters inside
      for(let ch=0;ch<3;ch++){
        let v=VV[ch]*Math.exp(path*LT[ch])+VIV[ch]*dim; // dyed by the way through (Beer–Lambert)
        v*=.9+.16*dif;                              // rounded body
        v+=(VIV[ch]+(255-VIV[ch])*.12-v)*Math.min(1,glow*1.3); // light gathering low in each stroke, in the full colour
        v+=(255-v)*Math.min(1,spec*.97+sheen*.16+rim); // wet highlight and the lip catching the light
        VV[ch]=v;
      }
      put(x,y,a);continue;
    }
    if(foil){ // tone 0..1 along the ramp, with a faint grain so it reads as metal rather than paint
      const sh=Math.cos((x+y)/(w+h)*7.2),g=((x*73856093^y*19349663)>>>0)%97/97-.5;
      const t=Math.max(0,Math.min(1,.46+.34*sh-.55*dot+.03*g)),[lo,hi]=t<.5?[FC[0],FC[1]]:[FC[1],FC[2]],u=t<.5?t*2:t*2-1;
      for(let ch=0;ch<3;ch++)VV[ch]=lo[ch]+(hi[ch]-lo[ch])*u;
      put(x,y,cov*L.opacity);continue;
    }
    let lit,dark;
    if(ta){ // tinted glass works as a filter: the picture through it takes the colour, the light on the rim stays white
      for(let ch=0;ch<3;ch++){const v=b[p+ch]*w00+b[p+4+ch]*w10+b[q+ch]*w01+b[q+4+ch]*w11;TV[ch]=v*(1-ta+ta*TC[ch]/255)}
    }
    if(carve){lit=dot<0?.6*d2:0;dark=.16+(dot>0?.65*d2:0)}
    else{lit=Math.min(.9,(dot>0?.8:.3)*d2+.05);dark=0}
    for(let ch=0;ch<3;ch++){
      let v=ta?TV[ch]:b[p+ch]*w00+b[p+4+ch]*w10+b[q+ch]*w01+b[q+4+ch]*w11;
      v=v*(1-dark);v+=(255-v)*lit;VV[ch]=v;
    }
    put(x,y,cov*L.opacity);
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
// そのまま (shape 'none'): the whole picture at its own proportions, nothing cut away, see-through parts kept.
// トリミング: L.crop = {l,t,r,b}, how much of each side of the picture is cut away (0..1 of its width or height).
// Dragging a side handle of a photo trims it there; the frame then takes the trimmed picture's proportions.
const cropOf=L=>L.crop||{l:0,t:0,r:0,b:0};
function cropAr(L,ph){const c=cropOf(L);return ph.img.width*(1-c.l-c.r)/(ph.img.height*(1-c.t-c.b))}
function cropRect(L,src){const c=cropOf(L);return [src.width*c.l,src.height*c.t,src.width*(1-c.l-c.r),src.height*(1-c.t-c.b)]}
function imgFrame(L){const ph=photos.get(L.photoId),ar=L.shape==='circle'?1:L.shape==='none'&&ph?cropAr(L,ph):(L.ar||(ph?(L.ir&1?1/cropAr(L,ph):cropAr(L,ph)):1));return {w:L.w,h:L.w/ar}}
// The photo can turn inside its frame, the frame staying as it is: quarter turns (L.ir) plus a tilt (L.ia, degrees),
// like the background photo. It is scaled to just cover the frame turned that way (times the zoom L.zs), and
// L.zx/L.zy (-1..1) slide it along its own sides as far as it still covers. Unturned, this is the plain cover fit.
const turned=L=>L.shape!=='none'&&!!((L.ir||0)%4||L.ia);
function innerView(L,f,sw,sh){
  const t=((L.ir||0)*90+(L.ia||0))*Math.PI/180,cs=Math.abs(Math.cos(t)),sn=Math.abs(Math.sin(t));
  const bw=f.w*cs+f.h*sn,bh=f.w*sn+f.h*cs,k=Math.max(bw/sw,bh/sh)*L.zs,mx=(sw*k-bw)/2,my=(sh*k-bh)/2;
  return {t,k,bw,bh,mx,my,ox:L.zx*mx,oy:L.zy*my};
}
function drawInner(c,L,f,src){const [sx,sy,sw,sh]=cropRect(L,src),v=innerView(L,f,sw,sh);c.rotate(v.t);c.drawImage(src,sx,sy,sw,sh,v.ox-sw*v.k/2,v.oy-sh*v.k/2,sw*v.k,sh*v.k)}
// The picture's outline in one colour, for a sticker-like rim and a shadow that follows the cut-out.
function silhouette(ph,src,col){
  const m=ph._sil||(ph._sil=new Map()),key=(src===ph.small?'s':'f')+col;let c=m.get(key);
  if(!c){c=document.createElement('canvas');c.width=src.width;c.height=src.height;const x=c.getContext('2d');x.drawImage(src,0,0);x.globalCompositeOperation='source-in';x.fillStyle=col;x.fillRect(0,0,c.width,c.height);
    m.set(key,c);while(m.size>4)m.delete(m.keys().next().value)}
  return c;
}
function drawCutout(c,L,ph,f,thumb){
  const src=adjusted(ph,thumb?ph.small:ph.img,L.adj),x=-f.w/2,y=-f.h/2,R=cropRect(L,src),put=(im,dx,dy)=>{const q=im===src?R:cropRect(L,im);c.drawImage(im,q[0],q[1],q[2],q[3],x+dx,y+dy,f.w,f.h)},rim=()=>{ // the rim: the outline stamped round a ring
    const r=L.w*L.border.w/100,s=silhouette(ph,thumb?ph.small:ph.img,L.border.color);
    for(let i=0;i<24;i++){const t=i/24*Math.PI*2;put(s,Math.cos(t)*r,Math.sin(t)*r)}
  };
  const T=c.getTransform(),k=Math.hypot(T.a,T.b);
  if(L.shadow.on)sameShadow(c,L.w*L.shadow.x/100*k,L.w*L.shadow.y/100*k,L.w*L.shadow.blur/100*k,L.shadow.color,L.shadow.a,()=>{if(L.border.on)rim();else put(silhouette(ph,thumb?ph.small:ph.img,'#000'),0,0)});
  if(L.border.on)rim();
  if(G.g?.mode==='icrop'&&G.g.L===L){const sc=f.w/R[2];c.save();c.globalAlpha*=.3;c.drawImage(src,x-R[0]*sc,y-R[1]*sc,src.width*sc,src.height*sc);c.restore()} // what is trimmed away, faint, while trimming
  put(src,0,0);
}
function imgPath(c,L,f){
  c.beginPath();
  if(L.shape==='circle'||L.shape==='ellipse')c.ellipse(0,0,f.w/2,f.h/2,0,0,Math.PI*2);
  else c.roundRect(-f.w/2,-f.h/2,f.w,f.h,L.shape==='round'?Math.min(f.w,f.h)*L.r/100:0);
}
function drawImageLayer(c,L,thumb){
  const ph=photos.get(L.photoId),f=imgFrame(L);
  c.save();c.translate(L.x,L.y);c.rotate(L.rot);c.globalAlpha=L.opacity;
  if(L.shape==='none'&&ph){drawCutout(c,L,ph,f,thumb);c.restore();return {W:f.w,H:f.h}}
  const T=c.getTransform(),k=Math.hypot(T.a,T.b);
  if(L.shadow.on)sameShadow(c,L.w*L.shadow.x/100*k,L.w*L.shadow.y/100*k,L.w*L.shadow.blur/100*k,L.shadow.color,L.shadow.a,()=>{imgPath(c,L,f);c.fillStyle=L.border.on?L.border.color:'#fff';c.fill()});
  if(ph&&G.g?.mode==='icrop'&&G.g.L===L){const src=thumb?ph.small:ph.img,[sx,sy,sw]=cropRect(L,src),sc=f.w/sw;c.save();c.globalAlpha*=.3;c.drawImage(src,-f.w/2-sx*sc,-f.h/2-sy*sc,src.width*sc,src.height*sc);c.restore()}
  if(ph&&G.g?.mode==='iframe'&&G.g.L===L){c.save();c.globalAlpha*=.3;drawInner(c,L,f,thumb?ph.small:ph.img);c.restore()} // the rest of the turned photo, faint
  c.save();imgPath(c,L,f);c.clip();
  if(ph)drawInner(c,L,f,adjusted(ph,thumb?ph.small:ph.img,L.adj));
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
// Hand-drawn wobble that stays put: the same layer always shakes the same way.
function rng(seed){let a=seed>>>0||1;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function wobbly(pts,amp,seed){ // soft low-frequency shake across a polyline
  const r=rng(seed),f=[r()*6,r()*6,1.3+r(),2.1+r()];
  return pts.map(([x,y],i)=>{const t=i/(pts.length-1||1);return [x,y+amp*(Math.sin(f[2]*t*Math.PI*2+f[0])*.6+Math.sin(f[3]*t*Math.PI*2+f[1])*.4)]});
}
function polyTo(c,pts){c.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0],pts[i][1])}
const notchSize=L=>{const nw=Math.min(L.w*.3,Math.max(L.h*6,L.w*.07));return [nw,nw*.55]};
const arrowHead=L=>Math.max(L.h*4.5,L.w*.1);
// How far a penned shape reaches round its middle (for its box, hit area and jelly).
function shapeExt(L){
  const w=L.w,h=L.h;
  if(L.kind==='notch')return {w:w+h,h:notchSize(L)[1]*1.9+h};
  if(L.kind==='arrow')return {w:w+h,h:arrowHead(L)*1.05+h*2};
  if(L.kind==='arrowc')return {w:w+h,h:w*.3+arrowHead(L)*.6+h*2};
  if(L.kind==='arrowl')return {w:w+h,h:w*.3+arrowHead(L)+h*2};
  if(RIBBON.has(L.kind))return {w:w+(L.lw||8)*2,h:h+(L.lw||8)*2};
  return {w,h};
}
// The pen paths. Arrows point right; turn the layer to aim them.
function penPath(c,L){
  const w=L.w,h=L.h,sd=L.seed||L.id||1;
  if(L.kind==='notch'){ // drawn by hand too: the run and the V shake a little, the V a touch lopsided
    const [nw,nd]=notchSize(L),y=-nd/2,r=rng(sd),vx=(r()-.5)*nw*.12,key=[[-w/2,y],[-nw/2,y],[vx,y+nd*(.95+r()*.1)],[nw/2,y],[w/2,y]],pts=[];
    for(let i=0;i<4;i++){const [ax,ay]=key[i],[bx,by]=key[i+1],n=Math.max(2,Math.round(Math.hypot(bx-ax,by-ay)/(w/60)));for(let j=i?1:0;j<=n;j++)pts.push([ax+(bx-ax)*j/n,ay+(by-ay)*j/n])}
    const lift=nd*.45,half=w/2; // both ends turn up a little, like a smile
    polyTo(c,wobbly(pts.map(([x,y])=>{const u=Math.max(0,(Math.abs(x)-nw/2)/(half-nw/2));return [x,y-lift*u*u]}),h*.15+w*.005,sd));return;
  }
  if(RIBBON.has(L.kind)){polyTo(c,ribbonPts(L));return}
  let pts=[];
  if(L.kind==='arrow'){for(let i=0;i<=24;i++)pts.push([-w/2+w*i/24,0]);pts=wobbly(pts,h*.12+w*.006,sd)}
  else if(L.kind==='arrowc'){ // an arc rising and coming down onto its point
    const lift=w*.3;for(let i=0;i<=40;i++){const t=i/40;pts.push([-w/2+w*t,lift*.5-lift*Math.sin(Math.PI*t*.85)])}pts=wobbly(pts,w*.01,sd);
  }
  else{ // arrowl: a straight run that curls once over itself in the middle, the loop crossing its own line
    const R=w*.14;for(let i=0;i<=320;i++){const t=i/320,u=Math.min(1,Math.max(0,(t-.42)/.16)),th=Math.PI*2*u*u*(3-2*u);pts.push([-w/2+w*t+R*Math.sin(th),R*Math.cos(th)-R+R])}
    pts=wobbly(pts,w*.006,sd);
  }
  polyTo(c,pts);
  const end=pts.at(-1),pv=pts[pts.length-4],ang=Math.atan2(end[1]-pv[1],end[0]-pv[0]),hl=arrowHead(L);
  for(const sg of [-1,1]){const a=ang+Math.PI+sg*.5;c.moveTo(end[0],end[1]);c.lineTo(end[0]+Math.cos(a)*hl,end[1]+Math.sin(a)*hl*(1+.1*sg))}
}
// A loop as a hand draws it: a little egg-shaped and tilted, starting inside and running out past where it
// began (丸囲み), or going round and round with the middle wandering (ぐりぐり).
// 飾り lines: a spiral from the middle out (うずまき), a run of loops like a phone cord (くるくる), a soft wave (なみなみ).
function ribbonPts(L){
  if(L.kind.startsWith('scribble'))return scribblePts(L);
  const w=L.w,h=L.h,pts=[];
  if(L.kind==='swirl'){const turns=2.6,n=360;for(let i=0;i<=n;i++){const t=i/n,a=-Math.PI/2+t*turns*Math.PI*2,k=.08+.92*t;pts.push([Math.cos(a)*w/2*k,Math.sin(a)*h/2*k])}}
  else if(L.kind==='coil'){ // a prolate cycloid: each turn loops back over itself
    const loops=5,n=420,b=w/loops*.42,a=(w-2*b)/(loops*Math.PI*2);
    for(let i=0;i<=n;i++){const th=i/n*loops*Math.PI*2;pts.push([-w/2+b+a*th-b*Math.sin(th),-h/2*Math.cos(th)*.9])}
  }
  else{const n=240;for(let i=0;i<=n;i++){const t=i/n;pts.push([-w/2+w*t,h/2*Math.sin(t*Math.PI*2*2.5)])}}
  return pts;
}
function scribblePts(L){
  const w=L.w,h=L.h,r=rng(L.seed||L.id||1),two=L.kind==='scribble2',turns=two?2.55+r()*.2:1.14+r()*.06,n=Math.round(120*turns);
  const tilt=(r()-.5)*.22,a0=-Math.PI*.6+(r()-.5)*.4,p1=r()*6,p2=r()*6,p3=r()*6,ct=Math.cos(tilt),st=Math.sin(tilt),pts=[];
  for(let i=0;i<=n;i++){
    const t=i/n,a=a0+t*turns*Math.PI*2;
    let k=1+.055*Math.sin(a+p1)+.035*Math.sin(2*a+p2); // egg-shaped, not an oval
    let cx=0,cy=0;
    if(two){k*=1+.07*Math.sin(t*turns*1.1+p3)-.05*t;cx=w*.035*Math.sin(t*Math.PI*2*.8+p1);cy=h*.04*Math.cos(t*Math.PI*2*.6+p2)}
    else k*=.94+.14*t*t*t; // starts inside, ends a little outside
    const x=Math.cos(a)*w/2*k+cx,y=Math.sin(a)*h/2*k+cy;pts.push([x*ct-y*st,x*st+y*ct]);
  }
  return pts;
}
// The pen presses in and lifts off: thin at both ends, a touch uneven on the way. Drawn as one filled ribbon.
function ribbon(c,pts,lw,seed){
  const n=pts.length,r=rng(seed),f=r()*6,L=[],R=[];
  for(let i=0;i<n;i++){
    const [px,py]=pts[Math.max(0,i-2)],[nx,ny]=pts[Math.min(n-1,i+2)],dx=nx-px,dy=ny-py,l=Math.hypot(dx,dy)||1,t=i/(n-1);
    const m=Math.max(.3,Math.min(1,t/.07)**.6*Math.min(1,(1-t)/.12)**.7)*(1+.12*Math.sin(t*9+f)),hw=lw*m/2;
    L.push([pts[i][0]-dy/l*hw,pts[i][1]+dx/l*hw]);R.push([pts[i][0]+dy/l*hw,pts[i][1]-dx/l*hw]);
  }
  polyTo(c,L.concat(R.reverse()));c.closePath();
  for(const i of [0,n-1]){const [x,y]=pts[i],rr=lw*.3/2;c.moveTo(x+rr,y);c.arc(x,y,rr,0,Math.PI*2)}
}
// Fill or pen, whichever the shape is: used for the shape itself, its shadow and its jelly mask.
function paintShape(c,L){
  if(RIBBON.has(L.kind)){c.beginPath();ribbon(c,ribbonPts(L),L.lw||8,(L.seed||L.id||1)+1);c.fill();return}
  if(PENNED.has(L.kind)){c.beginPath();penPath(c,L);c.lineWidth=L.h;c.lineCap=c.lineJoin='round';c.strokeStyle=c.fillStyle;c.stroke()}
  else{shapePath(c,L);c.fill()}
}
// 吹き出し are drawn by hand like the arrows: the outline is sampled, then pushed in and out a little along
// its normal by a slow wave, so a word inside still reads cleanly. The same layer always keeps its wobble.
const segPts=(o,[ax,ay],[bx,by],n)=>{for(let i=1;i<=n;i++)o.push([ax+(bx-ax)*i/n,ay+(by-ay)*i/n])};
const arcPts=(o,cx,cy,rx,ry,a0,a1,n)=>{for(let i=1;i<=n;i++){const a=a0+(a1-a0)*i/n;o.push([cx+Math.cos(a)*rx,cy+Math.sin(a)*ry])}};
const quadPts=(o,[ax,ay],[qx,qy],[bx,by],n)=>{for(let i=1;i<=n;i++){const t=i/n,u=1-t;o.push([u*u*ax+2*u*t*qx+t*t*bx,u*u*ay+2*u*t*qy+t*t*by])}};
function handDrawn(c,pts,amp,seed){
  const r=rng(seed),f=[3+r()*1.5,5+r()*2,r()*6,r()*6],n=pts.length;
  const out=pts.map(([x,y],i)=>{const [px,py]=pts[(i-4+n)%n],[nx,ny]=pts[(i+4)%n],dx=nx-px,dy=ny-py,l=Math.hypot(dx,dy)||1,t=i/n*Math.PI*2,d=amp*(Math.sin(f[0]*t+f[2])*.6+Math.sin(f[1]*t+f[3])*.4);return [x+dy/l*d,y-dx/l*d]});
  polyTo(c,out);c.closePath();
}
function bubblePath(c,L){
  const w=L.w,h=L.h,sd=L.seed||L.id||1,o=[],amp=Math.min(w,h)*.014;
  if(L.kind==='bubble'){ // an oval with a tail from its lower left, the tail's sides a little bowed
    const ry=h*.41,cy=-h*.09,rx=w/2,a1=Math.PI*.58,a2=Math.PI*.72,tip=[-w*.3,h/2];
    const p1=[Math.cos(a1)*rx,cy+Math.sin(a1)*ry],p2=[Math.cos(a2)*rx,cy+Math.sin(a2)*ry];
    o.push(p2);arcPts(o,0,cy,rx,ry,a2,a1+Math.PI*2,110);
    quadPts(o,p1,[(p1[0]+tip[0])/2+w*.02,(p1[1]+tip[1])/2],tip,10);quadPts(o,tip,[(tip[0]+p2[0])/2+w*.015,(tip[1]+p2[1])/2-h*.02],p2,10);o.pop();
  }
  else if(L.kind==='bubbler'){ // a rounded box with a tail from its lower edge
    const bh=h*.8,t=-h/2,b=t+bh,r=Math.min(w,bh)*.22,l=-w/2,rr=w/2,x1=-w*.26,x2=-w*.1,tip=[-w*.3,h/2],P=Math.PI;
    o.push([l+r,t]);segPts(o,[l+r,t],[rr-r,t],30);arcPts(o,rr-r,t+r,r,r,-P/2,0,8);segPts(o,[rr,t+r],[rr,b-r],16);arcPts(o,rr-r,b-r,r,r,0,P/2,8);
    segPts(o,[rr-r,b],[x2,b],22);quadPts(o,[x2,b],[(x2+tip[0])/2+w*.015,(b+tip[1])/2],tip,8);quadPts(o,tip,[(tip[0]+x1)/2,(b+tip[1])/2-h*.015],[x1,b],8);
    segPts(o,[x1,b],[l+r,b],10);arcPts(o,l+r,b-r,r,r,P/2,P,8);segPts(o,[l,b-r],[l,t+r],16);arcPts(o,l+r,t+r,r,r,P,P*1.5,8);o.pop();
  }
  else if(L.kind==='cloud'){ // puffs round an oval, one outline so a rim or jelly follows the bumps only
    const n=10,r=rng(sd),rx=w/2*.8,ry=h/2*.78,at=(a,k)=>[Math.cos(a)*rx*k,Math.sin(a)*ry*k],a0=r()*.6;
    o.push(at(a0,1));for(let i=1;i<=n;i++){const a=a0+i/n*Math.PI*2;quadPts(o,at(a-2*Math.PI/n,1),at(a-Math.PI/n,1.5+.12*r()),at(a,1),14)}o.pop();
  }
  else{ // spiky: a burst, points a little uneven
    const n=16,r=rng(sd),v=[];
    for(let i=0;i<n*2;i++){const a=i/(n*2)*Math.PI*2-Math.PI/2+(i%2?0:(r()-.5)*.06),k=i%2?.74+.06*r():1-.07*r();v.push([Math.cos(a)*w/2*k,Math.sin(a)*h/2*k])}
    o.push(v[0]);for(let i=0;i<v.length;i++)segPts(o,v[i],v[(i+1)%v.length],5);o.pop();
  }
  handDrawn(c,o,amp,sd);
}
// 飾り shapes, worked out as outlines in a w×h box so a line, jelly and the shadow all follow them.
function decoPath(c,L){
  const w=L.w,h=L.h,o=[],P=Math.PI;
  if(L.kind==='sparkle'){ // four points with the sides drawn in
    const tips=[[0,-h/2],[w/2,0],[0,h/2],[-w/2,0]],q=.07;o.push(tips[0]);
    for(let i=0;i<4;i++){const a=tips[i],b=tips[(i+1)%4];quadPts(o,a,[(a[0]+b[0])*q,(a[1]+b[1])*q],b,24)}o.pop();
  }
  else if(L.kind==='flower'){const n=5;for(let i=0;i<360;i++){const a=i/360*P*2,k=.5+.5*Math.pow(Math.abs(Math.cos(n*a/2)),.55);o.push([Math.sin(a)*w/2*k,-Math.cos(a)*h/2*k])}}
  else if(L.kind==='blob'){ // a soft shape that is never quite round; the seed keeps each one as it came
    const r=rng(L.seed||L.id||1),p=[r()*6,r()*6,r()*6],v=[];let m=0;
    for(let i=0;i<240;i++){const a=i/240*P*2,k=1+.13*Math.sin(2*a+p[0])+.09*Math.sin(3*a+p[1])+.05*Math.sin(5*a+p[2]);v.push([Math.cos(a)*k,Math.sin(a)*k]);m=Math.max(m,k)}
    for(const [x,y] of v)o.push([x/m*w/2,y/m*h/2]);
  }
  else if(L.kind==='heart'){for(let i=0;i<240;i++){const t=i/240*P*2,x=16*Math.sin(t)**3,y=-(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t));o.push([x/17*w/2,(y+2.5)/14.5*h/2])}}
  else{ // arch: a half circle on a box, the window shape
    const r=Math.min(w/2,h),top=-h/2+r;o.push([-w/2,h/2]);segPts(o,[-w/2,h/2],[-w/2,top],8);arcPts(o,0,top,w/2,r,P,P*2,60);segPts(o,[w/2,top],[w/2,h/2],8);
  }
  polyTo(c,o);c.closePath();
}
function shapePath(c,L){
  c.beginPath();
  if(DECO.has(L.kind)){decoPath(c,L);return}
  if(L.kind==='bubble'||L.kind==='bubbler'||L.kind==='cloud'||L.kind==='spiky'){bubblePath(c,L);return}
  if(PENNED.has(L.kind)){penPath(c,L);return}
  if(L.kind==='dots'&&L.dstyle==='dash'){ // dashes about 3× the thickness, stretched a little so both ends are a dash
    const gs=L.h*((L.gap||250)/100-1),n=Math.max(1,Math.round((L.w+gs)/(L.h*3+gs))),d=Math.max(1,(L.w-(n-1)*gs)/n);
    for(let i=0;i<n;i++)c.rect(-L.w/2+i*(d+gs),-L.h/2,d,L.h);
  }
  else if(L.kind==='dots'){ // evenly spaced so that both ends land on a dot
    const r=L.h/2,len=Math.max(0,L.w-L.h),n=Math.max(1,Math.round(len/(L.h*(L.gap||250)/100)));
    for(let i=0;i<=n;i++){const x=-len/2+len*i/n;c.moveTo(x+r,0);c.arc(x,0,r,0,Math.PI*2)}
  }
  else if(L.kind==='line')c.rect(-L.w/2,-L.h/2,L.w,L.h);
  else if(L.kind==='ellipse'||L.kind==='circle')c.ellipse(0,0,L.w/2,L.h/2,0,0,Math.PI*2);
  else c.roundRect(-L.w/2,-L.h/2,L.w,L.h,L.kind==='round'?Math.min(L.w,L.h)/2*L.r/100:0);
}
function drawShape(c,L){
  if(L.kind==='circle')L.h=L.w; // a circle keeps one size, whatever handle or slider moved
  c.save();c.translate(L.x,L.y);c.rotate(L.rot);c.globalAlpha=L.opacity;
  const T=c.getTransform(),k=Math.hypot(T.a,T.b),u=Math.min(L.w,L.h,400)/100; // shadow sizes follow the shape, up to a point
  const nf=L.nofill&&FILLABLE(L),mat=nf?'color':isLine(L)||NOGLASS.has(L.kind)?(L.mat==='jelly'?'jelly':'color'):L.mat||(L.glass?'glass':'color'),gl=mat==='glass',jl=mat==='jelly',hx=L.w/2,hy=L.h/2,ex=shapeExt(L);
  const A=gl?glassRead(c,hx,hy):jl?glassArea(c,ex.w/2+70,ex.h/2+70):null;if(jl&&A)A.bg=c.getImageData(A.x0,A.y0,A.w,A.h);
  if(L.shadow.on)sameShadow(c,L.shadow.x*u*k,L.shadow.y*u*k,L.shadow.blur*u*k,L.shadow.color,L.shadow.a,nf?()=>{shapePath(c,L);c.lineWidth=L.line.w;c.lineJoin='round';c.strokeStyle='#000';c.stroke()}:()=>{c.fillStyle=gl||jl?'#fff':rgba(L.color,Math.max(L.a,.01));paintShape(c,L)});
  if(gl)glassPaint(c,A,L.kind==='ellipse'||L.kind==='circle'?sdEllipse(hx,hy):sdRect(hx,hy,L.kind==='round'?Math.min(hx,hy)*L.r/100:0),hx,hy,L.opacity,[L.color,L.gta]);
  else if(jl)maskPaint(c,L,A,'jelly',mc=>paintShape(mc,L));
  else if(!nf){c.fillStyle=rgba(L.color,L.a);paintShape(c,L)}
  if(L.line.on&&!isLine(L)&&!PENNED.has(L.kind)){shapePath(c,L);c.lineWidth=L.line.w;c.lineJoin='round';c.strokeStyle=L.line.color;c.stroke()}
  c.restore();
  return {W:ex.w,H:ex.h};
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
  if(o.ui==='edit')drawMulti(c,M,kk);
  return M;
}
// What 色 changes when several are held: their words and shapes (a photo has no colour of its own).
const tinted=()=>msel().filter(L=>isText(L)||isShape(L));
const setTint=c=>{for(const L of tinted())L.color=c};
const mates=L=>L.grp?D.layers.filter(o=>o.grp===L.grp):[L];
const msel=()=>MS.length>1?D.layers.filter(L=>MS.includes(L.id)):[];
const multi=()=>msel().length>1;
const grouped=Ls=>Ls.length>1&&!!Ls[0].grp&&Ls.every(L=>L.grp===Ls[0].grp)&&mates(Ls[0]).length===Ls.length;
// The box round everything held, upright, in picture px.
function ubox(Ls,M=G.M,kk=kE()){
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const L of Ls){if(!M.has(L.id))continue;const b=box(L,M,kk),cs=Math.cos(L.rot),sn=Math.sin(L.rot);
    for(const [i,j] of [[-1,-1],[1,-1],[1,1],[-1,1]]){const x=L.x+i*b.w/2*cs-j*b.h/2*sn,y=L.y+i*b.w/2*sn+j*b.h/2*cs;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)}}
  return {x0,y0,x1,y1,w:x1-x0,h:y1-y0,cx:(x0+x1)/2,cy:(y0+y1)/2};
}
function mhandles(u,kk){
  const m=12*kk,at=(x,y)=>({x:Math.max(m,Math.min(D.W-m,x)),y:Math.max(m,Math.min(D.H-m,y))}),room=u.y1+52*kk<D.H;
  return {corners:[[u.x0,u.y0],[u.x1,u.y0],[u.x1,u.y1],[u.x0,u.y1]].map(([x,y])=>at(x,y)),rot:at(u.cx,room?u.y1+34*kk:u.y0-34*kk)};
}
function drawMulti(c,M,kk){
  if(G.g?.mode==='marq'){const a=G.g.p,b=G.g.q;c.save();c.fillStyle='rgba(196,154,144,.14)';c.strokeStyle='#c49a90';c.lineWidth=1.2*kk;c.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);c.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);c.restore()}
  const Ls=msel().filter(L=>M.has(L.id));if(Ls.length<2)return;
  c.save();c.setLineDash([4*kk,3*kk]);c.lineWidth=1.2*kk;c.strokeStyle='rgba(255,255,255,.95)';
  for(const L of Ls){const b=box(L,M,kk);c.save();c.translate(L.x,L.y);c.rotate(L.rot);c.strokeRect(-b.w/2,-b.h/2,b.w,b.h);c.restore()}
  c.setLineDash([]);const u=ubox(Ls,M,kk),h=mhandles(u,kk);
  c.lineWidth=3.5*kk;c.strokeStyle='rgba(40,25,15,.22)';c.strokeRect(u.x0,u.y0,u.w,u.h);c.lineWidth=1.5*kk;c.strokeStyle='#fff';c.strokeRect(u.x0,u.y0,u.w,u.h);
  const dot=(x,y,r)=>{c.beginPath();c.arc(x,y,r,0,7);c.fill();c.stroke()};
  c.fillStyle='#fff';c.strokeStyle='rgba(40,25,15,.3)';c.lineWidth=kk;c.shadowColor='rgba(40,25,15,.3)';c.shadowBlur=4;
  for(const q of h.corners)dot(q.x,q.y,6.5*kk);dot(h.rot.x,h.rot.y,13*kk);c.restore();rotIcon(c,h.rot.x,h.rot.y,kk);
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
  const edges=isLine(L)?{r:at(b.w/2,0),l:at(-b.w/2,0)}:(isShape(L)&&L.kind!=='circle')||(isImg(L)&&L.photoId&&L.shape!=='circle'&&tool==='crop')?{r:at(b.w/2,0),l:at(-b.w/2,0),b:at(0,b.h/2),t:at(0,-b.h/2)}:{};
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
  sm.width=Math.round(im.width*k);sm.height=Math.round(im.height*k);const sc=sm.getContext('2d',{willReadFrequently:true});sc.drawImage(im,0,0,sm.width,sm.height);
  // a picture with see-through parts (a cut-out PNG) goes in as it is, with no frame
  const a=sc.getImageData(0,0,sm.width,sm.height).data;let alpha=false;for(let i=3;i<a.length;i+=4)if(a[i]<250){alpha=true;break}
  photos.set(id,{url,img:im,small:sm,alpha});return id;
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
function restore(s){MS=[];addMode=false;const o=JSON.parse(s);P.pages=o.pages;P.cur=o.cur;loadInto(P.pages[P.cur]);sizeCanvas();panel();refresh();syncUndo();renderStrip();emit('change')}
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
// With トリミング open, the photo in its frame follows the finger (and two fingers or the wheel zoom it), the
// frame itself staying where it is; the sliders follow along.
const inside=L=>tool==='crop'&&isImg(L)&&!!L.photoId&&L.shape!=='none';
function panInside(L,g,p){
  const ph=photos.get(L.photoId);if(!ph)return;
  const f=imgFrame(L),[,,sw,sh]=cropRect(L,ph.img),v=innerView(L,f,sw,sh),rx=v.mx,ry=v.my;
  const a=L.rot+v.t,cs=Math.cos(a),sn=Math.sin(a),dx=p.x-g.p.x,dy=p.y-g.p.y,qx=dx*cs+dy*sn,qy=-dx*sn+dy*cs;
  if(rx>.5)L.zx=Math.max(-1,Math.min(1,g.zx+qx/rx));if(ry>.5)L.zy=Math.max(-1,Math.min(1,g.zy+qy/ry));
  syncInside(L);
}
function syncInside(L){for(const k of ['zs','zx','zy']){const r=bodyEl.querySelector(`input[type=range][data-k="${k}"]`),v=bodyEl.querySelector(`[data-v="${k}"]`);if(r)r.value=L[k];if(v)v.textContent=fmt(k)(L[k])}}
// Before trimming, what the frame shows now (its ratio, zoom and offset) becomes the trim itself, so nothing jumps.
function bakeView(L){
  const ph=photos.get(L.photoId);if(!ph)return;
  const f=imgFrame(L),iw=ph.img.width,ih=ph.img.height,[sx,sy,sw,sh]=cropRect(L,ph.img);
  if(L.shape!=='none'){
    const sc=Math.max(f.w/sw,f.h/sh)*L.zs,dw=sw*sc,dh=sh*sc,ox=-dw/2+L.zx*(dw-f.w)/2,oy=-dh/2+L.zy*(dh-f.h)/2;
    const x0=sx+(-f.w/2-ox)/sc,x1=sx+(f.w/2-ox)/sc,y0=sy+(-f.h/2-oy)/sc,y1=sy+(f.h/2-oy)/sc;
    L.crop={l:Math.max(0,x0/iw),r:Math.max(0,1-x1/iw),t:Math.max(0,y0/ih),b:Math.max(0,1-y1/ih)};
  }
  Object.assign(L,{ar:0,zs:1,zx:0,zy:0});
}
// Dragging a photo's side trims it there (or brings back what was trimmed); the opposite side stays put.
function cropDrag(L,g,p){
  const cs=Math.cos(g.rot),sn=Math.sin(g.rot),dx=p.x-g.p.x,dy=p.y-g.p.y,qx=dx*cs+dy*sn,qy=-dx*sn+dy*cs;
  const horiz=g.e==='r'||g.e==='l',s=g.e==='r'||g.e==='b'?1:-1,c={...g.crop},MIN=.04;
  if(horiz){
    const cw0=1-c.l-c.r,u=g.fw/cw0,k=g.e,o=k==='r'?'l':'r';
    c[k]=Math.max(0,Math.min(1-c[o]-MIN,c[k]-s*qx/u));
    const nw=u*(1-c.l-c.r),d=s*(nw-g.fw)/2;L.w=nw;L.x=g.x+d*cs;L.y=g.y+d*sn;
  }
  else{
    const ch0=1-c.t-c.b,u=g.fh/ch0,k=g.e,o=k==='b'?'t':'b';
    c[k]=Math.max(0,Math.min(1-c[o]-MIN,c[k]-s*qy/u));
    const nh=u*(1-c.t-c.b),d=s*(nh-g.fh)/2;L.x=g.x-d*sn;L.y=g.y+d*cs;
  }
  L.crop=c;
}
// A turned photo has nothing square to trim, so its side handles move the frame's side instead: the photo stays
// exactly where it is on the page, and the side stops where the photo would no longer cover the frame.
function frameStart(L,h,p){
  const ph=photos.get(L.photoId),f=imgFrame(L),[,,sw,sh]=cropRect(L,ph.img),v=innerView(L,f,sw,sh);
  const ct=Math.cos(v.t),st=Math.sin(v.t),cx=v.ox*ct-v.oy*st,cy=v.ox*st+v.oy*ct,cr=Math.cos(L.rot),sr=Math.sin(L.rot);
  L.ar=f.w/f.h;
  return {mode:'iframe',L,e:h,p,x:L.x,y:L.y,fw:f.w,fh:f.h,rot:L.rot,t:v.t,sw,sh,k:v.k,P:{x:L.x+cx*cr-cy*sr,y:L.y+cx*sr+cy*cr}};
}
function frameDrag(L,g,p){
  const cs=Math.cos(g.rot),sn=Math.sin(g.rot),dx=p.x-g.p.x,dy=p.y-g.p.y,qx=dx*cs+dy*sn,qy=-dx*sn+dy*cs;
  const horiz=g.e==='r'||g.e==='l',s=g.e==='r'||g.e==='b'?1:-1,want=s*(horiz?qx:qy);
  const fit=a=>{ // the frame with its side moved by a; null when the photo would no longer cover it
    const nw=horiz?Math.max(8,g.fw+a):g.fw,nh=horiz?g.fh:Math.max(8,g.fh+a),d=s*(horiz?nw-g.fw:nh-g.fh)/2;
    const x=horiz?g.x+d*cs:g.x-d*sn,y=horiz?g.y+d*sn:g.y+d*cs;
    const ex=g.P.x-x,ey=g.P.y-y,b=g.rot+g.t,cb=Math.cos(b),sb=Math.sin(b),ox=ex*cb+ey*sb,oy=-ex*sb+ey*cb;
    const v=innerView({...L,zs:1,zx:0,zy:0},{w:nw,h:nh},g.sw,g.sh),zs=g.k/v.k,mx=(g.sw*g.k-v.bw)/2,my=(g.sh*g.k-v.bh)/2,E=1e-6;
    if(zs<1-E||mx<-E||my<-E||Math.abs(ox)>mx+1e-3||Math.abs(oy)>my+1e-3)return null;
    return {w:nw,ar:nw/nh,x,y,zs,zx:mx>1e-3?Math.max(-1,Math.min(1,ox/mx)):0,zy:my>1e-3?Math.max(-1,Math.min(1,oy/my)):0};
  };
  let r=fit(want);
  if(!r){let lo=0,hi=want;r=fit(0);for(let i=0;i<24;i++){const m=(lo+hi)/2,q=fit(m);if(q){lo=m;r=q}else hi=m}}
  if(r)Object.assign(L,r);
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
// Level and upright pull the angle in; two fingers wobble more than the rotate handle, so they get a wider catch.
function snapAngle(a,tol=.05){const d=Math.round(a/(Math.PI/2))*(Math.PI/2);return Math.abs(a-d)<tol?d:a}
function deselect(){D.sel=null;MS=[];addMode=false;tool=null;panel();paint()}
// Where each held layer started, so a move, a resize or a turn works from there.
const states=()=>msel().map(L=>({L,x:L.x,y:L.y,rot:L.rot,size:L[SZ(L)],h:L.h}));
// Grow by r and turn by da round c, each layer keeping its place in the whole.
function applyT(g,r,da){
  const cs=Math.cos(da),sn=Math.sin(da);
  for(const s of g.st){const vx=(s.x-g.c.x)*r,vy=(s.y-g.c.y)*r,L=s.L;L.x=g.c.x+vx*cs-vy*sn;L.y=g.c.y+vx*sn+vy*cs;L.rot=s.rot+da;L[SZ(L)]=clampSz(L,s.size*r);if(isShape(L))L.h=Math.max(1,s.h*r)}
}
// A tap with 選択を追加 on (or Shift held) adds what was touched, with its group, or takes it away again.
function toggleIn(H){
  const base=MS.length>1?[...MS]:D.sel?mates(sel()).map(o=>o.id):[],ids=mates(H).map(o=>o.id),has=ids.every(id=>base.includes(id));
  const next=has?base.filter(id=>!ids.includes(id)):[...base,...ids.filter(id=>!base.includes(id))];
  if(next.length>1){MS=next;D.sel=null}else{MS=[];D.sel=next[0]??null}
}

cv.addEventListener('pointerdown',e=>{
  try{cv.setPointerCapture(e.pointerId)}catch{}const p=pt(e);G.ptrs.set(e.pointerId,p);
  const L=sel(),many=multi();
  if(G.ptrs.size===2){
    const t=two();
    if(tool==='bg')G.g={mode:'pzoom',t,s:D.photo.s};
    else if(many){const u=ubox(msel());G.g={mode:'mpinch',t,c:{x:u.cx,y:u.cy},st:states()}}
    else if(inside(L))G.g={mode:'izoom',t,zs:L.zs};
    else if(L)G.g={mode:'pinch',t,size:L[SZ(L)],h:L.h,rot:L.rot};
    return;
  }
  if(tool==='bg'){if(photoBg(D))G.g={mode:'pan',p,ox:D.photo.ox,oy:D.photo.oy};return}
  if(many){
    const u=ubox(msel()),mh=mhandles(u,kE()),near=q=>Math.hypot(p.x-q.x,p.y-q.y)<22*kE(),c={x:u.cx,y:u.cy};
    if(near(mh.rot)){G.g={mode:'mrot',c,a:Math.atan2(p.y-c.y,p.x-c.x),st:states()};return}
    if(mh.corners.some(near)){G.g={mode:'mscale',c,d:Math.max(1,Math.hypot(p.x-c.x,p.y-c.y)),st:states()};return}
  }
  else{
    const h=hitHandle(L,p);
    if(h==='scale'){G.g={mode:'scale',d:Math.max(1,Math.hypot(p.x-L.x,p.y-L.y)),size:L[SZ(L)],h:L.h,box:layerBox(L)};return}
    if(h&&h.startsWith('edge:')&&isImg(L)&&turned(L)&&L.photoId){G.g=frameStart(L,h.slice(5),p);return}
    if(h&&h.startsWith('edge:')&&isImg(L)){bakeView(L);const f=imgFrame(L);G.g={mode:'icrop',L,e:h.slice(5),p,x:L.x,y:L.y,fw:f.w,fh:f.h,rot:L.rot,crop:{...cropOf(L)}};return}
    if(h&&h.startsWith('edge:')){G.g={mode:'edge',e:h.slice(5),x0:L.x,y0:L.y,w0:L.w,h0:L.h,rot:L.rot,pad:0};return}
    if(h==='rot'){G.g={mode:'rot',a:Math.atan2(p.y-L.y,p.x-L.x),rot:L.rot};return}
    if(inside(L)&&hitLayer(G.M,p,kE(),o=>o===L)){G.g={mode:'ipan',p,zx:L.zx,zy:L.zy};return} // トリミング open: a drag slides the photo in its frame
  }
  const H=hitLayer(G.M,p,kE());
  if(H&&(addMode||e.shiftKey)){toggleIn(H);G.g=null;tool=null;panel();paint();return}
  if(!H&&many){const u=ubox(msel());if(p.x>=u.x0&&p.x<=u.x1&&p.y>=u.y0&&p.y<=u.y1){G.g={mode:'mmove',p,st:states(),u,tap:null,moved:false};return}} // the gaps inside the box drag the lot too
  if(H&&many&&MS.includes(H.id)){G.g={mode:'mmove',p,st:states(),u:ubox(msel()),tap:H.id,moved:false};paint();return}
  if(H&&mates(H).length>1){MS=mates(H).map(o=>o.id);D.sel=null;tool=null;G.g={mode:'mmove',p,st:states(),u:ubox(msel()),tap:null,moved:false};panel();paint();return}
  if(H){const was=D.sel===H.id;if(many)MS=[];D.sel=H.id;G.g={mode:'move',p,x:H.x,y:H.y,was,moved:false};if(!was||many)panel()}
  else if(e.pointerType==='mouse'){if(D.sel||MS.length)deselect();G.g={mode:'marq',p,q:p}} // a mouse drag on nothing draws a box round what to take
  else{G.g=null;if(D.sel||MS.length)deselect()}
  paint();
});
cv.addEventListener('pointermove',e=>{
  const g=G.g;if(!G.ptrs.has(e.pointerId)||!g)return;const p=pt(e);G.ptrs.set(e.pointerId,p);const L=sel();
  if(g.mode==='pan'){D.photo.ox=g.ox+p.x-g.p.x;D.photo.oy=g.oy+p.y-g.p.y}
  else if(g.mode==='pzoom'&&G.ptrs.size===2){D.photo.s=Math.max(1,Math.min(4,g.s*two().d/g.t.d))}
  else if(g.mode==='pinch'&&L&&G.ptrs.size===2){const t=two();scaleBy(L,g,t.d/g.t.d);L.rot=snapAngle(g.rot+t.a-g.t.a,.1)}
  else if(g.mode==='scale'&&L){scaleBy(L,g,Math.hypot(p.x-L.x,p.y-L.y)/g.d);snapScale(L,g)}
  else if(g.mode==='edge'&&L){stretch(L,g,p)}
  else if(g.mode==='icrop'&&L){cropDrag(L,g,p)}
  else if(g.mode==='iframe'&&L){frameDrag(L,g,p);syncInside(L)}
  else if(g.mode==='ipan'&&L)panInside(L,g,p);
  else if(g.mode==='izoom'&&L&&G.ptrs.size===2){L.zs=Math.max(1,Math.min(3,g.zs*two().d/g.t.d));syncInside(L)}
  else if(g.mode==='rot'&&L){L.rot=snapAngle(g.rot+Math.atan2(p.y-L.y,p.x-L.x)-g.a)}
  else if(g.mode==='marq')g.q=p;
  else if(g.mode==='mmove'){
    if(!g.moved&&Math.hypot(p.x-g.p.x,p.y-g.p.y)/kE()<4)return;g.moved=true;
    let dx=p.x-g.p.x,dy=p.y-g.p.y;const u=g.u,T=targets(new Set(g.st.map(s=>s.L))),thr=SNAP*kE();
    const gx=nearest([u.x0+dx,u.cx+dx,u.x1+dx],T.xs,thr),gy=nearest([u.y0+dy,u.cy+dy,u.y1+dy],T.ys,thr);
    dx+=gx?gx.d:0;dy+=gy?gy.d:0;for(const s of g.st){s.L.x=s.x+dx;s.L.y=s.y+dy}
    G.guides={x:gx?.t??null,y:gy?.t??null};
  }
  else if(g.mode==='mscale')applyT(g,Math.max(.05,Math.hypot(p.x-g.c.x,p.y-g.c.y)/g.d),0);
  else if(g.mode==='mrot')applyT(g,1,snapAngle(Math.atan2(p.y-g.c.y,p.x-g.c.x)-g.a));
  else if(g.mode==='mpinch'&&G.ptrs.size===2){const t=two();applyT(g,Math.max(.05,t.d/g.t.d),snapAngle(t.a-g.t.a,.1))}
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
function targets(L){ // L: the layer being moved, or a Set of them
  const xs=[0,D.W/2,D.W],ys=[0,D.H/2,D.H],ex=L instanceof Set?L:new Set([L]);
  for(const o of D.layers)if(!ex.has(o)&&G.M.has(o.id)){const l=lines(o);xs.push(...l.xs);ys.push(...l.ys)}
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
  const g=G.g;
  if(g?.mode==='marq'){ // everything whose middle is inside the box, with its group
    const x0=Math.min(g.p.x,g.q.x),x1=Math.max(g.p.x,g.q.x),y0=Math.min(g.p.y,g.q.y),y1=Math.max(g.p.y,g.q.y),ids=[];
    if((x1-x0)/kE()>4||(y1-y0)/kE()>4)for(const o of D.layers)if(G.M.has(o.id)&&o.x>=x0&&o.x<=x1&&o.y>=y0&&o.y<=y1)for(const m of mates(o))if(!ids.includes(m.id))ids.push(m.id);
    G.g=null;if(ids.length>1)MS=ids;else D.sel=ids[0]??null;panel();paint();return;
  }
  if(g?.mode==='icrop'||g?.mode==='iframe'){G.g=null;commit();panel();paint();return} // 「トリミングを戻す」 appears once something is trimmed
  if(g?.mode==='mmove'&&!g.moved&&g.tap!=null){MS=[];D.sel=g.tap;G.g=null;panel();paint();return} // a tap on one of them: that one alone
  const tap=G.g&&G.g.mode==='move'&&!G.g.moved,was=tap&&G.g.was,L=sel();
  G.g=null;G.guides=null;commit();paint();
  if(tap&&isImg(L)&&!L.photoId)$('#eimgswap').click(); // an empty frame: one tap to fill it
  else if(was&&isText(L))openText();                          // a second tap on a text: type
}
cv.addEventListener('pointerup',endPtr);cv.addEventListener('pointercancel',endPtr);
cv.addEventListener('wheel',e=>{
  e.preventDefault();const L=sel(),f=Math.exp(-e.deltaY/400);
  if(tool==='bg')D.photo.s=Math.max(1,Math.min(4,D.photo.s*f));else if(inside(L)){L.zs=Math.max(1,Math.min(3,L.zs*f));syncInside(L)}else if(L)scaleBy(L,{size:L[SZ(L)],h:L.h},f);else return;
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
  group:ic('<rect x="3.5" y="3.5" width="17" height="17" rx="2.5" stroke-dasharray="2.6 2.4"/><rect x="7" y="7" width="6.5" height="6.5" rx="1.2"/><rect x="11" y="11" width="6" height="6" rx="1.2"/>'),
  dup:ic('<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 00-1.5-1.5H6A1.5 1.5 0 004.5 6v8A1.5 1.5 0 006 15.5h2.5"/>'),
  del:ic('<path d="M5 7h14M10 7V5h4v2M7 7l1 12.5h8L17 7"/>'),
  crop:ic('<path d="M12 3.5v17M3.5 12h17M9.3 6.2L12 3.5l2.7 2.7M9.3 17.8l2.7 2.7 2.7-2.7M6.2 9.3L3.5 12l2.7 2.7M17.8 9.3l2.7 2.7-2.7 2.7"/>'),
};
const colorIc=L=>`<i class="cdot" style="background:${L.color}"></i>`;
const BAR={
  multi:()=>[['done','完了',I.done],...(tinted().length?[['mcolor','色',colorIc(tinted()[0])]]:[]),['mgroup',grouped(msel())?'グループ解除':'グループ化',I.group],['mdup','複製',I.dup],['mdel','削除',I.del]],
  none:()=>[['addtext','文字',I.text],['addimg','写真',I.image],['addshape','図形',I.shape],['bg','背景',I.bg],['adj','調整',I.adj],['pages','ページ',I.pages],['design','型',I.tpl]],
  text:L=>[['done','完了',I.done],['edit','編集',I.edit],['font','書体',I.font],['color','色',colorIc(L)],['deco','飾り',I.deco],['layout','配置',I.layout],['more','レイヤー',I.more]],
  shape:L=>[['done','完了',I.done],['scolor','色',colorIc(L)],['sform','形',I.shape],['sdeco',isLine(L)||PENNED.has(L.kind)?'影':'線・影',I.deco],['more','レイヤー',I.more]],
  image:L=>[['done','完了',I.done],['swap',L.photoId?'差し替え':'はめる',I.image],['shape','形',I.shape],['crop','トリミング',I.crop],['adj','調整',I.adj],['deco','フチ・影',I.deco],['more','レイヤー',I.more]],
};
const ACT=new Set(['done','addtext','addimg','addshape','design','edit','swap','mgroup','mdup','mdel']);

const get=(o,p)=>p.split('.').reduce((a,k)=>a[k],o);
const put=(o,p,v)=>{const ks=p.split('.'),last=ks.pop();ks.reduce((a,k)=>a[k],o)[last]=v};
const pct=v=>Math.round(v*100)+'%';
const f2=v=>(+v).toFixed(2);
const FMT={ia:v=>(+v)+'°',gap:v=>Math.round(v)+'%',zs:f2,zx:f2,zy:f2,'border.w':v=>(+v).toFixed(1),lh:f2,opacity:pct,'shadow.a':pct,ca:pct,gta:pct,'band.gta':pct,gd:pct,'band.a':pct,wrap:v=>+v?pct(v):'なし','band.line.w':v=>(+v).toFixed(1)};
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
  mcolor:()=>{const v=tinted()[0]?.color||'#ffffff';return `<div class="pal" data-mc>${PALETTE.map(c=>`<button style="--c:${c}" data-c="${c}" class="${c===v?'on':''}" aria-label="${c}"></button>`).join('')}<label class="custom${PALETTE.includes(v)?'':' on'}" aria-label="ほかの色"><input type="color" data-mcolor value="${v}"></label></div>
    <p class="enote">選んだ文字と図形の色を、まとめて同じ色にします。写真は変わりません。</p>`},
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
  scolor:L=>{
    // lines and dots are too thin for glass to show; jelly turns them into a gummy strip or a row of beads
    if((isLine(L)||NOGLASS.has(L.kind))&&L.mat!=='jelly')L.mat='color';
    // 中を塗らない: an outline only, drawn by 線 (turned on with it)
    const nfRow=FILLABLE(L)?`<div class="sec">${toggle('nofill','中を塗らない')}</div>`:'';
    if(L.nofill&&FILLABLE(L))return nfRow+'<p class="enote">枠の線だけになります。線の色と太さは「線・影」で変えられます。</p>';
    L.mat??=L.glass?'glass':'color';
    const body=L.mat==='glass'?(L.gta??=0,pal('color')+slider('色の濃さ','gta',0,1,.01)+'<p class="enote">下の写真が縁で曲がって見えるガラス。色の濃さ0%で透明、上げると色つきのガラスに。</p>')
      :L.mat==='jelly'?(L.gd??=1,pal('color')+slider('厚み','gd',.3,3,.05)+'<p class="enote">ぷるんとしたゼリー。真ん中ほど色が濃く、縁は透けて下の写真が大きく曲がって見えます。</p>')
      :pal('color')+slider('濃さ','a',0,1,.01);
    return `${nfRow}<div class="eseg wide" data-set="mat">${(isLine(L)||NOGLASS.has(L.kind)?[['color','色'],['jelly','ゼリー']]:[['color','色'],['glass','ガラス'],['jelly','ゼリー']]).map(([v,l])=>`<button data-v="${v}" class="${L.mat===v?'on':''}">${l}</button>`).join('')}</div>${body}`;
  },
  sform:L=>`${groupOf(L.kind).length>1?segs('kind',groupOf(L.kind)):''}
    ${L.kind==='dots'?(L.dstyle??='dot',`<div class="erow"><span class="el">種類</span>${segs('dstyle',[['dot','点'],['dash','線']])}</div>`):''}
    ${isLine(L)?slider('長さ','w',6,3000,1)+slider('太さ','h',1,80,.5)+(L.kind==='dots'?slider('間隔','gap',120,600,10):'')
      :RIBBON.has(L.kind)?slider('幅','w',6,3000,1)+slider('高さ','h',6,3000,1)+(L.lw??=8,slider('太さ','lw',1,80,.5))
      :L.kind==='circle'?slider('大きさ','w',6,3000,1):slider('幅','w',6,3000,1)+slider('高さ','h',6,3000,1)+(L.kind==='round'?slider('角丸','r',0,100,1):'')}
    ${btns(isLine(L)||L.kind==='circle'?[['fullw','横幅いっぱい'],['center','真ん中へ']]:[['fullw','横幅いっぱい'],['fullh','縦いっぱい'],['center','真ん中へ']])}`,
  sdeco:L=>`${isLine(L)||PENNED.has(L.kind)?'':`<div class="sec">${toggle('line.on','線')}${L.line.on?pal('line.color')+slider('太さ','line.w',1,40,.5):''}</div>`}
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
  // How the letters are filled: a colour (濃さ is the fill alone; レイヤー's 透明度 fades everything), glass, or a cut
  color:L=>{
    L.ca??=1;L.glyph??='none';
    const body=L.glyph==='jelly'?(L.gd??=1,pal('color')+slider('厚み','gd',.3,3,.05)+'<p class="enote">ぷるんとしたゼリーの文字。真ん中ほど色が濃く、縁は透けて下の写真が大きく曲がって見えます。</p>')
      :L.glyph==='glass'?(L.gta??=0,pal('color')+slider('色の濃さ','gta',0,1,.01)+(L.gd??=1,slider('深さ','gd',.3,3,.05))+'<p class="enote">文字そのものがガラスになり、下の写真が曲がって見えます。色の濃さ0%で透明、上げると色つきのガラスに。</p>')
      :L.glyph==='carve'?(L.cfoil??='none',`<div class="erow"><span class="el">箔</span>${segs('cfoil',[['none','なし'],['gold','金'],['silver','銀'],['rose','ローズ']])}</div>${(L.gd??=1,slider('深さ','gd',.3,3,.05))}<p class="enote">文字の形に彫ったように見せます。ガラスの枠と合わせるとガラスに彫った文字に、箔を選ぶと溝に箔を押したように。</p>`)
      :pal('color')+slider('濃さ','ca',0,1,.01);
    return `<div class="eseg wide" data-set="glyph">${[['none','色'],['glass','ガラス'],['carve','彫り込み'],['jelly','ゼリー']].map(([v,l])=>`<button data-v="${v}" class="${L.glyph===v?'on':''}">${l}</button>`).join('')}</div>${body}`;
  },
  deco:L=>{
    if(!isText(L))return `<div class="sec">${toggle('border.on','フチ')}${L.border.on?pal('border.color')+slider('太さ','border.w',.5,10,.5):''}</div>
      <div class="sec">${toggle('shadow.on','影')}${L.shadow.on?slider('濃さ','shadow.a',.05,3,.01)+slider('ぼかし','shadow.blur',0,30,1)+slider('ずれ','shadow.y',-10,10,.5):''}</div>`;
    const sub={stroke:`<div class="sec">${toggle('stroke.on','縁取り')}${L.stroke.on?pal('stroke.color')+slider('太さ','stroke.w',1,30,.5):''}</div>`,
      shadow:`<div class="sec">${toggle('shadow.on','影')}${L.shadow.on?pal('shadow.color')+slider('濃さ','shadow.a',.05,3,.01)+slider('ぼかし','shadow.blur',0,100,1)+slider('横','shadow.x',-30,30,1)+slider('縦','shadow.y',-30,30,1):''}</div>`,
      // 枠, its glass and its line are all in sight from the start; any of them turns the frame on
      band:`<div class="sec"><div class="tgrow">${toggle('band.on','枠')}${toggle('band.glass','ガラス')}${toggle('band.line.on','枠の線')}</div>${L.band.on?segs('band.shape',[['rect','四角'],['pill','カプセル'],['circle','丸'],['ellipse','だ円']])+(L.band.glass?(L.band.gta??=0,pal('band.color')+slider('色の濃さ','band.gta',0,1,.01)):pal('band.color')+slider('濃さ','band.a',0,1,.01))+slider('余白','band.pad',0,120,1)+(L.band.shape==='rect'?slider('角丸','band.r',0,100,1):'')+
        (L.band.line.on?`<h5 class="esub">枠の線</h5>${pal('band.line.color')+slider('太さ','band.line.w',.5,15,.5)}`:''):''}</div>`};
    const on=k=>({stroke:L.stroke.on,shadow:L.shadow.on,band:L.band.on})[k];
    return `<div class="eseg wide" data-deco>${[['stroke','縁取り'],['shadow','影'],['band','枠']].map(([k,l])=>`<button data-v="${k}" class="${decoSub===k?'on':''}">${l}${on(k)?' <i class="lit"></i>':''}</button>`).join('')}</div>${sub[decoSub]}`;
  },
  layout:L=>`<div class="erow">${segs('align',[['left','左'],['center','中'],['right','右']])}${segs('vertical',[[false,'横書き'],[true,'縦書き']])}</div>
    ${slider('大きさ','size',12,600,1)}${slider('折り返し','wrap',0,1,.01)}${slider('文字間','ls',-10,80,1)}${slider('行間','lh',.8,2.6,.01)}${posBlock(L)}`,
  // レイヤー: what the whole layer does (copy, stacking order, delete, see-through), the same for words,
  // shapes and photos. A shape's 濃さ under 色 is its fill alone; 透明度 here fades fill, line and shadow together.
  more:L=>btns([['dup','複製'],['front','前へ'],['back','後ろへ'],['del','削除']])+slider('透明度','opacity',.1,1,.01)+(isText(L)?'':posBlock(L)),
  shape:L=>`${segs('shape',[['none','そのまま'],['rect','四角'],['round','角丸'],['circle','丸'],['ellipse','だ円']])}
    ${L.shape==='none'?'<p class="enote">写真の形のまま、切り抜かずに置きます。透明な部分のある PNG は、透明なまま重なります。</p>':''}
    ${L.shape!=='circle'&&L.shape!=='none'?segs('ar',[[0,'元の形'],[1,'1:1'],[.8,'4:5'],[1.5,'3:2']]):''}
    ${slider('大きさ','w',40,2000,1)}${L.shape==='round'?slider('角丸','r',0,50,1):''}
`,
  // with nothing selected it works on the background photo
  adj:L=>{
    if(!L&&!(photoBg(D)&&D.photoId))return `<p class="enote">背景が写真のときに使えます。重ねた写真は、写真をタップしてから「調整」で。</p>`;
    const a=(L||D).adj||{};
    return ADJ.map(([k,l])=>`<label class="erow wl"><span class="el">${l}</span><input type="range" data-adj="${k}" min="${k==='fade'?0:-100}" max="100" step="1" value="${a[k]||0}"><span class="ev" data-av="${k}">${a[k]||0}</span></label>`).join('')
      +btns([['adjreset','元に戻す'],...(!L&&P.pages.length>1?[['adjall','全ページの背景に当てる']]:[])]);
  },
  // トリミング: the side handles trim, and the photo moves and zooms inside its frame by hand or by slider.
  crop:L=>`<p class="enote">${L.shape==='circle'?'':'写真の辺の四角を引くと、その辺から切れます。'}${L.shape==='none'?'':'写真を指で動かすと枠の中で位置が変わり、2本指で拡大できます。'}</p>${L.shape==='none'?'':slider('拡大','zs',1,3,.01)+slider('横','zx',-1,1,.01)+slider('縦','zy',-1,1,.01)+(L.ia??=0,slider('傾き','ia',-45,45,.5))}${(b=>b.length?btns(b):'')([...(L.shape==='none'?[]:[['irot','90°回す']]),...(L.crop?[['uncrop','トリミングを戻す']]:[])])}`,
};

function addImage(photoId,i=0){
  const cut=photos.get(photoId)?.alpha;
  const L={id:uid++,type:'image',photoId,x:D.W*(.5+.05*i),y:D.H*(.42+.05*i),w:D.W*.46,rot:0,shape:'round',r:5,ar:0,zs:1,zx:0,zy:0,opacity:1,
    border:{on:true,color:'#ffffff',w:2.5},shadow:{on:true,color:'#28190f',a:.28,x:0,y:1.5,blur:6}};
  if(cut){L.shape='none';L.border.on=false}
  D.layers.splice(D.layers.filter(x=>!isText(x)).length,0,L); // above other photos and shapes, under the texts
  D.sel=L.id;return L;
}
// A shape only changes 形 within its own group, so w and h keep their meaning (a box's height, a pen's width).
const SHAPES=[[['rect','四角'],['round','角丸'],['circle','丸'],['ellipse','だ円']],[['line','線'],['dots','点線']],[['notch','吹き出しの下']],
  [['bubble','丸'],['bubbler','角丸'],['cloud','もくもく'],['spiky','ギザギザ']],[['arrow','まっすぐ'],['arrowc','カーブ'],['arrowl','くるっと']],[['scribble','丸囲み'],['scribble2','ぐりぐり']],
  [['sparkle','きらきら'],['flower','お花'],['blob','ふにゃ'],['heart','ハート'],['arch','アーチ']],[['swirl','うずまき'],['coil','くるくる'],['wave','なみなみ']]];
const groupOf=k=>SHAPES.find(ks=>ks.some(([v])=>v===k))||SHAPES[0];
// The 図形 sheet is laid out by look instead: clean ones for bands and backings, hand-drawn ones for decoration.
const SHEET=[['基本',[['',SHAPES[0].concat(SHAPES[1])]]],['手書き',[['吹き出し',SHAPES[3].concat(SHAPES[2])],['矢印',SHAPES[4]],['囲み',SHAPES[5]]]],['飾り',[['かたち',SHAPES[6]],['線',SHAPES[7]]]]];
const FILLABLE=L=>isShape(L)&&!isLine(L)&&!PENNED.has(L.kind);
function shapeDefaults(kind){
  const W=D.W,rim={on:true,color:INK,w:5};
  return ({rect:{w:W,h:D.H*.2,a:.85},round:{w:W*.8,h:D.H*.2,a:.85},circle:{w:W*.4,h:W*.4,a:.85},ellipse:{w:W*.52,h:W*.35,a:.85},
    line:{w:W*.7,h:Math.max(2,Math.round(W/120)),a:1},dots:{w:W*.7,h:14,gap:250,dstyle:'dot',a:1},notch:{w:W*.7,h:6,a:1},
    arrow:{w:W*.4,h:10,a:1},arrowc:{w:W*.42,h:10,a:1},arrowl:{w:W*.46,h:10,a:1},
    bubble:{w:W*.52,h:W*.4,a:1,line:rim},bubbler:{w:W*.56,h:W*.37,a:1,line:rim},cloud:{w:W*.56,h:W*.39,a:1,line:rim},spiky:{w:W*.54,h:W*.41,a:1,line:rim},
    scribble:{w:W*.42,h:W*.3,lw:10,a:1},scribble2:{w:W*.4,h:W*.28,lw:8,a:1},
    sparkle:{w:W*.2,h:W*.26,a:1},flower:{w:W*.3,h:W*.3,a:1},blob:{w:W*.5,h:W*.38,a:.85},heart:{w:W*.3,h:W*.27,a:1},arch:{w:W*.4,h:W*.52,a:.85},
    swirl:{w:W*.28,h:W*.28,lw:9,a:1},coil:{w:W*.6,h:W*.12,lw:7,a:1},wave:{w:W*.6,h:W*.07,lw:8,a:1}})[kind]||{};
}
function addShape(kind='rect'){
  const L={id:uid++,type:'shape',kind,x:D.W/2,y:D.H/2,w:D.W,h:D.H*.2,rot:0,r:40,color:'#ffffff',a:.85,opacity:1,seed:1+Math.floor(Math.random()*1e9),
    line:{on:false,color:INK,w:4},shadow:{on:false,color:'#28190f',a:.3,x:0,y:2,blur:8},...clone(shapeDefaults(kind))};
  D.layers.splice(D.layers.filter(x=>!isText(x)).length,0,L); // under the texts, so words can sit on it
  D.sel=L.id;return L;
}
// 図形 opens a sheet of everything that can be laid on, drawn by the same code that draws them in the picture.
let shSheet=null;
function openShapes(){
  if(!shSheet){
    shSheet=document.createElement('div');shSheet.className='ssheet shsheet';shSheet.hidden=true;
    shSheet.innerHTML=`<div class="scrim" data-shclose></div><div class="scard glass shcard"><div class="shhead"><b>図形を置く</b><button class="pill soft" data-shclose>閉じる</button></div>${SHEET.map(([g,subs])=>`<h4 class="shsec">${g}</h4>${subs.map(([sub,ks])=>`${sub?`<h5 class="esub">${sub}</h5>`:''}<div class="shgrid">${ks.map(([k,l])=>`<button data-shk="${k}"><canvas width="112" height="112"></canvas><span>${l}</span></button>`).join('')}</div>`).join('')}`).join('')}</div>`;
    document.body.appendChild(shSheet);
    shSheet.addEventListener('click',e=>{
      if(e.target.closest('[data-shclose]')){shSheet.hidden=true;return}
      const b=e.target.closest('[data-shk]');if(!b)return;
      shSheet.hidden=true;addShape(b.dataset.shk);tool='sform';commit();panel();paint();
    });
    shSheet.querySelectorAll('[data-shk]').forEach(b=>{
      const cv2=b.querySelector('canvas'),x=cv2.getContext('2d'),kind=b.dataset.shk;
      const L={id:7,seed:7,type:'shape',kind,x:0,y:0,rot:0,r:40,opacity:1,color:'#fbf7f2',line:{on:false,color:INK,w:4},shadow:{on:false},...clone(shapeDefaults(kind))};
      if(PENNED.has(kind)||LINEISH.has(kind))L.color=INK;else{L.line={on:true,color:INK,w:0};L.a=1}
      L.h=kind==='line'||kind==='dots'?Math.max(L.h,L.w*.05):L.h;if(PENNED.has(kind)&&!RIBBON.has(kind))L.h=L.w*.035;if(RIBBON.has(kind))L.lw=L.w*.04;
      const ex=shapeExt(L),k=Math.min(88/ex.w,88/ex.h);if(L.line.on)L.line.w=2.4/k;
      x.setTransform(k,0,0,k,56,56);drawShape(x,L);
    });
  }
  shSheet.hidden=false;
}
function groupToggle(){
  const Ls=msel();if(Ls.length<2)return;
  if(grouped(Ls)){for(const L of Ls)delete L.grp;toast('グループを解除しました')}
  else{const id=newId('g');for(const L of Ls)L.grp=id;toast('グループにしました。1つをタップすると全部が選ばれます')}
  addMode=false;commit();panel();paint();
}
function dupMulti(){
  const Ls=msel();if(Ls.length<2)return;const gm=new Map(),ids=[];
  for(const L of Ls){const n=Object.assign(clone(L),{id:uid++,x:L.x+D.W*.04,y:L.y+D.W*.04});if(L.grp){if(!gm.has(L.grp))gm.set(L.grp,newId('g'));n.grp=gm.get(L.grp)}D.layers.push(n);ids.push(n.id)}
  MS=ids;addMode=false;commit();panel();refresh();
}
async function removeMulti(){
  const Ls=msel();if(Ls.length<2)return;
  if(!await ask(`選んだ${Ls.length}つを消しますか？`,{ok:'消す'}))return;
  const gone=new Set(Ls.map(L=>L.id));D.layers=D.layers.filter(L=>!gone.has(L.id));MS=[];addMode=false;tool=null;commit();panel();paint();
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
  const L=sel(),items=BAR[multi()?'multi':!L?'none':isText(L)?'text':isShape(L)?'shape':'image'](L);
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
    case 'addshape':openShapes();return;
    case 'design':openDesign();return;
    case 'edit':openText();return;
    case 'swap':$('#eimgswap').click();return;
    case 'mgroup':groupToggle();return;
    case 'mdup':dupMulti();return;
    case 'mdel':removeMulti();return;
  }
  tool=tool===b.dataset.tool?null:b.dataset.tool;panel();paint();
});
function addLayer(from){
  const base=isText(from)?from:(D.layers.filter(isText).at(-1)||{});
  const n=newLayer({text:'テキスト',fam:base.fam||'"Zen Maru Gothic"',w:base.w||500,name:base.name||'Zen Maru Gothic',color:base.color||INK,
    shadow:clone(base.shadow||{...SHADOW,on:false}),size:(base.size||96)*.6,vertical:!!base.vertical,y:D.H*[.5,.8,.2,.65,.35][D.layers.length%5]});
  D.layers.push(n);D.sel=n.id;return n;
}
function removeLayer(L){D.layers=D.layers.filter(x=>x.id!==L.id);if(D.sel===L.id)D.sel=null}
bodyEl.addEventListener('input',e=>{
  const L=sel(),t=e.target;
  if(t.classList.contains('fsearch')){fontQ=t.value;filterFonts();bodyEl.querySelector('.fontrow').scrollLeft=0;return}
  if(t.dataset.photo!=null){D.photo.s=+t.value;paint();return}
  if(t.dataset.ptilt!=null){D.photo.a=+t.value;bodyEl.querySelector('[data-v="ptilt"]').textContent=t.value+'°';paint();return}
  if(t.dataset.mcolor!=null){setTint(t.value);t.parentElement.classList.add('on');$('#ebar .cdot')?.style.setProperty('background',t.value);paint();return}
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
    showAlign(L);fadeAlign();commit();paint();syncPos();return;
  }
  if(adjLive){adjLive=false;paint()}commit();
});
bodyEl.addEventListener('focusin',e=>{if(e.target.classList.contains('num'))setTimeout(()=>e.target.select(),0)});
bodyEl.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.classList.contains('num')){e.preventDefault();e.target.blur()}});
// Nudging and typed X/Y never snap, but the same guide as a drag shows whenever an edge or the middle
// sits on another layer's or the picture's (to within half a pixel), and fades a moment after.
let alignT=0;
function showAlign(L){
  clearTimeout(alignT);if(!L){G.guides=null;return}
  const l=lines(L),T=targets(L),on=(vs,ts)=>{for(const v of vs)for(const t of ts)if(Math.abs(t-v)<.5)return t;return null};
  const x=on(l.xs,T.xs),y=on(l.ys,T.ys);G.guides=x==null&&y==null?null:{x,y};
}
const fadeAlign=()=>{clearTimeout(alignT);alignT=setTimeout(()=>{G.guides=null;paint()},900)};
let nudgeT=0;
bodyEl.addEventListener('pointerdown',e=>{
  const b=e.target.closest('[data-nudge]'),L=sel();if(!b||!L)return;e.preventDefault();
  const [dx,dy]=b.dataset.nudge.split(',').map(Number);let n=0;
  const step=()=>{const k=n++<20?1:5;L.x+=dx*k;L.y+=dy*k;showAlign(L);paint()};
  step();clearTimeout(nudgeT);
  const go=()=>{step();nudgeT=setTimeout(go,50)};nudgeT=setTimeout(go,400);
  const stop=()=>{clearTimeout(nudgeT);fadeAlign();commit();removeEventListener('pointerup',stop);removeEventListener('pointercancel',stop)};
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
  if(act==='irot'&&isImg(L)){L.ir=((L.ir||0)+1)%4;commit();paint();return}
  if(act==='uncrop'&&isImg(L)){delete L.crop;L.zs=1;L.zx=L.zy=0;commit();panel();paint();return}
  if(act==='dup'&&L){dupSel();return}
  if(act==='del'&&L){removeSelected();return}
  if(act==='front'&&L){const i=D.layers.indexOf(L);if(i<D.layers.length-1){D.layers.splice(i,1);D.layers.splice(i+1,0,L);commit();paint()}return}
  if(act==='back'&&L){const i=D.layers.indexOf(L);if(i>0){D.layers.splice(i,1);D.layers.splice(i-1,0,L);commit();paint()}return}
  if(t.closest('[data-bgtype]')){const v=t.dataset.v,old=bgOf(D);D.bg=v==='color'?{type:v,color:old.color||'#f3e9dc'}:v==='grad'?{type:v,grad:old.grad||0}:{type:'photo'};commit();panel();paint();return}
  if(t.closest('[data-mc]')&&t.dataset.c){setTint(t.dataset.c);commit();panel();paint();return}
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
  if(t.dataset.tg){const k=t.dataset.tg;put(L,k,!get(L,k));
    if(k==='nofill'&&L.nofill)L.line.on=true;
    if(isText(L)){if((k==='band.glass'||k==='band.line.on')&&get(L,k))L.band.on=true;if(k==='band.on'&&!L.band.on)L.band.glass=L.band.line.on=false}commit();panel();refresh();return}
  const sg=t.closest('[data-set]');if(sg){const v=t.dataset.v;
    // turning a box into a line (or back) gives it a sensible thickness (or height) instead of the old one
    if(sg.dataset.set==='kind'&&isShape(L)){const was=isLine(L),to=LINEISH.has(v);if(to&&!was)L.h=Math.max(2,Math.round(D.W/120));else if(was&&!to)L.h=Math.round(L.w*.25);if(v==='dots'){L.gap??=250;L.dstyle??='dot'}if(v==='circle')L.w=L.h=Math.round(Math.min(L.w,L.h))}
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
  const L=sel(),many=multi(),busy=G.g&&((G.g.mode!=='move'&&G.g.mode!=='mmove')||G.g.moved);
  if((!L&&!many)||tool==='bg'||!tedit.hidden||busy||(L&&!G.M.has(L.id))){flo.hidden=true;return}
  const key=many?(grouped(msel())?'mg':'m'):(isText(L)?'t':isShape(L)?'s':L.photoId?'i':'e')+(addMode?'+':'');
  if(flo.dataset.key!==key){
    flo.dataset.key=key;
    flo.innerHTML=many?`<button data-fl="group">${key==='mg'?'グループ解除':'グループ化'}</button><button data-fl="mdup">複製</button><button data-fl="mdel">削除</button>`
      :(key[0]==='t'?'<button data-fl="edit">編集</button>':key[0]==='s'?'':`<button data-fl="swap">${key[0]==='i'?'差し替え':'はめる'}</button>`)+`<button data-fl="dup">複製</button><button data-fl="del">削除</button><button data-fl="add"${addMode?' class="on"':''}>選択を追加</button>`;
  }
  flo.hidden=false;
  const h=many?mhandles(ubox(msel()),kE()):handles(L,G.M,kE()),xs=h.corners.map(q=>q.x),ys=h.corners.map(q=>q.y);
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
  ({edit:()=>openText(),swap:()=>$('#eimgswap').click(),dup:dupSel,del:removeSelected,group:groupToggle,mdup:dupMulti,mdel:removeMulti,
    add:()=>{addMode=!addMode;if(addMode)toast('ほかに選びたいものをタップしてください');placeFloat()}})[b.dataset.fl]();
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
  try{const urls=await Promise.all(fs.map(f=>loadPhoto(f,true)));for(const [i,u] of urls.entries())addImage(await makePhoto(u),i);tool=null;commit();panel();refresh()}
  catch{toast('読み込めない画像がありました')}
});
$('#eimgswap').addEventListener('change',async e=>{
  const f=e.target.files[0];e.target.value='';const L=sel();if(!f||!isImg(L))return;
  try{L.photoId=await makePhoto(await loadPhoto(f,true));Object.assign(L,{zs:1,zx:0,zy:0,ir:0,ia:0});delete L.crop;if(photos.get(L.photoId).alpha&&L.shape!=='none'){L.shape='none';L.border.on=false}commit();panel();refresh()}catch{toast('この画像は読み込めませんでした')}
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
    :(f=>({...normL(L,pg.W,pg.H),photoId:null,ar:f.w/f.h,zs:1,zx:0,zy:0,ir:0,ia:0,crop:null}))(imgFrame(L)))};
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
  else if((e.key==='Delete'||e.key==='Backspace')&&!typing&&multi()){e.preventDefault();removeMulti()}
  else if((e.key==='Delete'||e.key==='Backspace')&&!typing&&sel()){e.preventDefault();removeSelected()}
  else if(e.key==='Escape'){if(!tedit.hidden)closeText();else if(sel()||MS.length)deselect()}
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
