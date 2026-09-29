// PICLEA core. One document (photo framing + up to a few text layers) and one drawing routine, draw(),
// used for the picker tiles, the large preview, the editor and the saved file alike, so all of them
// match. Coordinates are output pixels of the finished image.
(() => {
const {JA,EN,loadPhoto,loadFace}=window.PICLEA;
const $=s=>document.querySelector(s);
const OUT_W=1080;
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
const isText=L=>L&&L.type!=='image';
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
function ask(msg,{ok='OK',input=null}={}){
  return new Promise(res=>{
    const d=$('#askd'),inp=$('#askin');
    $('#askmsg').textContent=msg;$('#askok').textContent=ok;
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
    c.save();framePath(c,L,m);
    c.globalAlpha=L.opacity*L.band.a;c.fillStyle=L.band.color;c.fill();
    const ln=L.band.line;if(ln?.on){c.globalAlpha=L.opacity;c.lineWidth=s*ln.w/100;c.strokeStyle=ln.color;c.stroke()}
    c.restore();
  }
  c.globalAlpha=L.opacity;
  // shadowBlur and offsets ignore the canvas transform, so scale them by hand for small previews
  const T=c.getTransform(),k=Math.hypot(T.a,T.b);
  const shadow=on=>{
    if(on&&L.shadow.on){c.shadowColor=rgba(L.shadow.color,L.shadow.a);c.shadowBlur=s*L.shadow.blur/100*k;c.shadowOffsetX=s*L.shadow.x/100*k;c.shadowOffsetY=s*L.shadow.y/100*k}
    else{c.shadowColor='transparent';c.shadowBlur=c.shadowOffsetX=c.shadowOffsetY=0}
  };
  if(L.stroke.on){
    shadow(true);c.lineJoin='round';c.miterLimit=2;c.lineWidth=s*L.stroke.w/100*2;c.strokeStyle=L.stroke.color;glyphs(c,L,f,m,true);
    shadow(false);c.fillStyle=L.color;glyphs(c,L,f,m,false);
  }else{shadow(true);c.fillStyle=L.color;glyphs(c,L,f,m,false)}
  c.restore();
  return m;
}
function drawPhoto(c,src){
  const cover=Math.max(D.W/src.width,D.H/src.height)*D.photo.s,w=src.width*cover,h=src.height*cover;
  D.photo.ox=Math.max(-(w-D.W)/2,Math.min((w-D.W)/2,D.photo.ox));
  D.photo.oy=Math.max(-(h-D.H)/2,Math.min((h-D.H)/2,D.photo.oy));
  c.drawImage(src,(D.W-w)/2+D.photo.ox,(D.H-h)/2+D.photo.oy,w,h);
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
  if(L.shadow.on){
    c.save();c.shadowColor=rgba(L.shadow.color,L.shadow.a);c.shadowBlur=L.w*L.shadow.blur/100*k;c.shadowOffsetX=L.w*L.shadow.x/100*k;c.shadowOffsetY=L.w*L.shadow.y/100*k;
    imgPath(c,L,f);c.fillStyle=L.border.on?L.border.color:'#fff';c.fill();c.restore();
  }
  c.save();imgPath(c,L,f);c.clip();
  if(ph){const src=thumb?ph.small:ph.img,sc=Math.max(f.w/src.width,f.h/src.height)*L.zs,dw=src.width*sc,dh=src.height*sc;c.drawImage(src,-dw/2+L.zx*(dw-f.w)/2,-dh/2+L.zy*(dh-f.h)/2,dw,dh)}
  else{c.fillStyle='#d8cfc4';c.fillRect(-f.w/2,-f.h/2,f.w,f.h)}
  c.restore();
  if(L.border.on){imgPath(c,L,f);c.lineWidth=L.w*L.border.w/100*2;c.strokeStyle=L.border.color;c.stroke()}
  c.restore();
  return {W:f.w,H:f.h};
}
// o: {ov:{id,font}, grad:index, thumb:bool, ui:'edit'|'mark', kk: output px per screen px}. Returns metrics per layer id.
function draw(c,o={}){
  c.clearRect(0,0,D.W,D.H);
  const ph=cur(),src=ph&&(o.thumb?ph.small:ph.img);
  if(src)drawPhoto(c,src);
  else{const [a,b]=GRADS[(o.grad||0)%GRADS.length],gr=c.createLinearGradient(0,0,D.W*.36,D.H);gr.addColorStop(0,a);gr.addColorStop(1,b);c.fillStyle=gr;c.fillRect(0,0,D.W,D.H)}
  const M=new Map();for(const L of D.layers)M.set(L.id,isText(L)?drawLayer(c,L,o.ov):drawImageLayer(c,L,o.thumb));
  const L=sel(),kk=o.kk||1;
  if(o.ui==='edit'&&G.guides){
    c.save();c.strokeStyle='#c49a90';c.lineWidth=1.5*kk;
    if(G.guides.x!=null){c.beginPath();c.moveTo(G.guides.x,0);c.lineTo(G.guides.x,D.H);c.stroke()}
    if(G.guides.y!=null){c.beginPath();c.moveTo(0,G.guides.y);c.lineTo(D.W,G.guides.y);c.stroke()}
    c.restore();
  }
  if(o.ui&&L&&M.get(L.id)){
    const b=box(L,M,kk);
    c.save();c.translate(L.x,L.y);c.rotate(L.rot);
    c.setLineDash([6*kk,5*kk]);c.lineWidth=1.5*kk;c.strokeStyle='rgba(255,255,255,.95)';c.strokeRect(-b.w/2,-b.h/2,b.w,b.h);
    c.lineDashOffset=6*kk;c.strokeStyle='rgba(75,63,58,.8)';c.strokeRect(-b.w/2,-b.h/2,b.w,b.h);c.restore();
    if(o.ui==='edit'){
      const h=handlePos(L,M,kk);
      c.save();c.beginPath();c.arc(h.x,h.y,13*kk,0,7);c.fillStyle='#fff';c.fill();c.strokeStyle=INK;c.lineWidth=1.5*kk;c.stroke();
      c.beginPath();c.arc(h.x,h.y,5.5*kk,.4,5.4);c.stroke();c.restore();
    }
  }
  return M;
}
function box(L,M,kk){const m=M.get(L.id),f=isText(L)&&L.band.on?frameSize(L,m):{w:m.W,h:m.H},p=10*kk;return {w:f.w+2*p,h:f.h+2*p}}
// The scale/rotate handle sits on the bottom-right corner, pulled back inside the picture if the corner is off it.
function handlePos(L,M,kk){
  const b=box(L,M,kk),cs=Math.cos(L.rot),sn=Math.sin(L.rot),m=18*kk;
  const x=L.x+b.w/2*cs-b.h/2*sn,y=L.y+b.w/2*sn+b.h/2*cs;
  return {x:Math.max(m,Math.min(D.W-m,x)),y:Math.max(m,Math.min(D.H-m,y))};
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
async function setPhoto(url){
  const first=!anyPhoto();
  D.photoId=await makePhoto(url);D.photo={s:1,ox:0,oy:0};
  if(D.ratio==='元の比率')applyRatio('元の比率');
  // text written for the plain backdrop turns white with a soft shadow once a photo is behind it
  if(first)for(const L of D.layers)if(L.color===INK&&!L.stroke.on&&!L.band.on){L.color='#ffffff';L.shadow={...SHADOW}}
  commit();emit('photo',url);
}
// New pages start with the current page's design: a carousel usually carries the same look.
async function addPhotos(urls){
  syncCur();const design=clone(D);
  for(const url of urls){const id=await makePhoto(url);P.pages.push({...clone(design),layers:design.layers.filter(isText),photoId:id,photo:{s:1,ox:0,oy:0}})}
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

/* =================== editor view =================== */
const cv=$('#ecanvas'),ctx=cv.getContext('2d');
const G={ptrs:new Map(),g:null,guides:null,M:new Map()};
let tab='文字',fontLang='ja',textTimer;
const kE=()=>D.W/(cv.clientWidth||D.W); // output px per screen px
function sizeCanvas(){if(cv.width!==D.W)cv.width=D.W;if(cv.height!==D.H)cv.height=D.H}
let raf=0;
function paint(){if(!raf)raf=requestAnimationFrame(()=>{raf=0;if(!$('#editor').hidden)G.M=draw(ctx,{ui:tab==='写真'?null:'edit',kk:kE()})})}
function refresh(){paint();ensureFonts().then(paint)}
on('fonts',()=>paint());

function pt(e){const r=cv.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*D.W,y:(e.clientY-r.top)/r.height*D.H}}
function hitHandle(L,p){if(!L||!G.M.has(L.id))return false;const h=handlePos(L,G.M,kE());return Math.hypot(p.x-h.x,p.y-h.y)<24*kE()}
const two=()=>{const [a,b]=[...G.ptrs.values()];return {d:Math.hypot(a.x-b.x,a.y-b.y),a:Math.atan2(b.y-a.y,b.x-a.x)}};
const SZ=L=>isText(L)?'size':'w';
const clampSz=(L,v)=>isText(L)?Math.max(12,Math.min(900,v)):Math.max(40,Math.min(3000,v));
function snapAngle(a){const d=Math.round(a/(Math.PI/2))*(Math.PI/2);return Math.abs(a-d)<.05?d:a}

cv.addEventListener('pointerdown',e=>{
  try{cv.setPointerCapture(e.pointerId)}catch{}const p=pt(e);G.ptrs.set(e.pointerId,p);
  const L=sel();
  if(G.ptrs.size===2){
    const t=two();
    if(tab==='写真')G.g={mode:'pzoom',t,s:D.photo.s};
    else if(L)G.g={mode:'pinch',t,size:L[SZ(L)],rot:L.rot};
    return;
  }
  if(tab==='写真'){G.g={mode:'pan',p,ox:D.photo.ox,oy:D.photo.oy};return}
  if(hitHandle(L,p)){const h=Math.hypot(p.x-L.x,p.y-L.y);G.g={mode:'handle',d:h,a:Math.atan2(p.y-L.y,p.x-L.x),size:L[SZ(L)],rot:L.rot};return}
  const H=hitLayer(G.M,p,kE());
  if(H){const was=D.sel===H.id;D.sel=H.id;G.g={mode:'move',p,x:H.x,y:H.y,was,moved:false};if(!was)panel()}
  else{G.g=null;if(D.sel){D.sel=null;panel()}}
  paint();
});
cv.addEventListener('pointermove',e=>{
  const g=G.g;if(!G.ptrs.has(e.pointerId)||!g)return;const p=pt(e);G.ptrs.set(e.pointerId,p);const L=sel();
  if(g.mode==='pan'){D.photo.ox=g.ox+p.x-g.p.x;D.photo.oy=g.oy+p.y-g.p.y}
  else if(g.mode==='pzoom'&&G.ptrs.size===2){D.photo.s=Math.max(1,Math.min(4,g.s*two().d/g.t.d))}
  else if(g.mode==='pinch'&&L&&G.ptrs.size===2){const t=two();L[SZ(L)]=clampSz(L,g.size*t.d/g.t.d);L.rot=g.rot+t.a-g.t.a}
  else if(g.mode==='handle'&&L){L[SZ(L)]=clampSz(L,g.size*Math.hypot(p.x-L.x,p.y-L.y)/g.d);L.rot=snapAngle(g.rot+Math.atan2(p.y-L.y,p.x-L.x)-g.a)}
  else if(g.mode==='move'&&L){
    if(!g.moved&&Math.hypot(p.x-g.p.x,p.y-g.p.y)/kE()<4)return;g.moved=true;
    const r=snapMove(L,g.x+p.x-g.p.x,g.y+p.y-g.p.y,8*kE());L.x=r.x;L.y=r.y;G.guides=r.guides;
  }
  paint();
});
// Snap the centre to the picture's centre lines and to other texts' centres; the pull is in screen pixels.
function snapMove(L,x,y,thr){
  const guides={x:null,y:null},others=D.layers.filter(o=>o!==L);
  for(const c of [D.W/2,...others.map(o=>o.x)])if(Math.abs(x-c)<thr){x=c;guides.x=c;break}
  for(const c of [D.H/2,...others.map(o=>o.y)])if(Math.abs(y-c)<thr){y=c;guides.y=c;break}
  return {x,y,guides};
}
function endPtr(e){
  if(!G.ptrs.has(e.pointerId))return;G.ptrs.delete(e.pointerId);
  if(G.ptrs.size)return;
  const tap=G.g&&G.g.mode==='move'&&!G.g.moved&&G.g.was;
  G.g=null;G.guides=null;commit();paint();
  if(tap&&isText(sel())){setTab('文字');setTimeout(()=>$('#etxt')?.focus(),50)}
}
cv.addEventListener('pointerup',endPtr);cv.addEventListener('pointercancel',endPtr);
cv.addEventListener('wheel',e=>{
  e.preventDefault();const L=sel(),f=Math.exp(-e.deltaY/400);
  if(tab==='写真')D.photo.s=Math.max(1,Math.min(4,D.photo.s*f));else if(L)L[SZ(L)]=clampSz(L,L[SZ(L)]*f);else return;
  paint();clearTimeout(textTimer);textTimer=setTimeout(commit,300);
},{passive:false});

/* ---------- panel ---------- */
const TABS=['文字','書体','色','飾り','写真'];
$('#etabs').innerHTML=TABS.map(t=>`<button data-t="${t}">${t}</button>`).join('');
$('#etabs').addEventListener('click',e=>{const b=e.target.closest('button');if(b)setTab(b.dataset.t)});
function setTab(t){tab=t;[...$('#etabs').children].forEach(b=>b.classList.toggle('on',b.dataset.t===t));panel();paint()}

const get=(o,p)=>p.split('.').reduce((a,k)=>a[k],o);
const put=(o,p,v)=>{const ks=p.split('.'),last=ks.pop();ks.reduce((a,k)=>a[k],o)[last]=v};
const pct=v=>Math.round(v*100)+'%';
const f2=v=>(+v).toFixed(2);
const FMT={zs:f2,zx:f2,zy:f2,'border.w':v=>(+v).toFixed(1),lh:f2,opacity:pct,'shadow.a':pct,'band.a':pct,wrap:v=>+v?pct(v):'なし','band.line.w':v=>(+v).toFixed(1)};
const fmt=k=>FMT[k]||(v=>Math.round(v));
const slider=(label,key,min,max,step)=>{const v=get(sel(),key);return `<label class="erow"><span class="el">${label}</span><input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${v}"><span class="ev" data-v="${key}">${fmt(key)(v)}</span></label>`};
const pal=key=>{const v=get(sel(),key);return `<div class="pal" data-k="${key}">${PALETTE.map(c=>`<button style="--c:${c}" data-c="${c}" class="${c===v?'on':''}" aria-label="${c}"></button>`).join('')}<label class="custom${PALETTE.includes(v)?'':' on'}" aria-label="ほかの色"><input type="color" data-k="${key}" value="${v}"></label></div>`};
const toggle=(key,label)=>`<h4>${label}<button class="tg${get(sel(),key)?' on':''}" data-tg="${key}" aria-label="${label}"></button></h4>`;
const segs=(key,opts)=>`<div class="eseg" data-set="${key}">${opts.map(([v,l])=>`<button data-v="${v}" class="${get(sel(),key)===v?'on':''}">${l}</button>`).join('')}</div>`;
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');

function imgPanel(L,b){
  b.innerHTML=`<div class="ihead"><b>重ねた写真</b><button class="eb dark" data-act="done">完了</button></div>
    <div class="ebtns"><button class="eb" data-act="dup">複製</button><button class="eb" data-act="front">前へ</button><button class="eb" data-act="back">後ろへ</button><button class="eb" data-act="swapimg">差し替え</button><button class="eb" data-act="del">削除</button></div>
    ${segs('shape',[['rect','四角'],['round','角丸'],['circle','丸'],['ellipse','だ円']])}
    ${L.shape!=='circle'?segs('ar',[[0,'元の形'],[1,'1:1'],[.8,'4:5'],[1.5,'3:2']]):''}
    ${slider('大きさ','w',40,2000,1)}${L.shape==='round'?slider('角丸','r',0,50,1):''}
    ${slider('中の拡大','zs',1,3,.01)}${slider('中の横','zx',-1,1,.01)}${slider('中の縦','zy',-1,1,.01)}
    <div class="sec">${toggle('border.on','フチ')}${L.border.on?pal('border.color')+slider('太さ','border.w',.5,10,.5):''}</div>
    <div class="sec">${toggle('shadow.on','影')}${L.shadow.on?slider('濃さ','shadow.a',.05,1,.01)+slider('ぼかし','shadow.blur',0,30,1)+slider('ずれ','shadow.y',-10,10,.5):''}</div>
    ${slider('透明度','opacity',.1,1,.01)}`;
}
function addImage(photoId,i=0){
  const L={id:uid++,type:'image',photoId,x:D.W*(.5+.05*i),y:D.H*(.42+.05*i),w:D.W*.46,rot:0,shape:'round',r:5,ar:0,zs:1,zx:0,zy:0,opacity:1,
    border:{on:true,color:'#ffffff',w:2.5},shadow:{on:true,color:'#28190f',a:.28,x:0,y:1.5,blur:6}};
  D.layers.splice(D.layers.filter(x=>!isText(x)).length,0,L); // above other photos, under the texts
  D.sel=L.id;return L;
}
async function removeSelected(){
  const L=sel();if(!L)return;
  if(!await ask(isText(L)?'この文字を消しますか？':'この写真を消しますか？',{ok:'消す'}))return;
  removeLayer(L);commit();panel();paint();
}
let fontIO;
function panel(){
  const L=sel(),b=$('#ebody');
  $('#etabs').hidden=!!L&&!isText(L);
  if(L&&!isText(L)){imgPanel(L,b);return}
  if(L){L.band.shape??='rect';L.band.line??={on:false,color:INK,w:3}}
  if(tab==='写真'){
    b.innerHTML=`<div class="eseg wide" data-ratio>${RATIOS.map(([n])=>`<button data-v="${n}" class="${D.ratio===n?'on':''}">${n}</button>`).join('')}</div>
      <p class="enote">写真をドラッグで位置、2本指（パソコンはホイール）で拡大できます。</p>
      <label class="erow"><span class="el">拡大</span><input type="range" data-photo min="1" max="4" step=".01" value="${D.photo.s}"></label>
      <div class="ebtns"><button class="eb" id="ephoto">背景の写真を変える</button><button class="eb dark" data-act="addimg">＋ 写真を重ねる</button></div>`;
    return;
  }
  if(!L){b.innerHTML=`<p class="enote">文字や重ねた写真をタップすると、ここで調整できます。</p><div class="ebtns"><button class="eb dark" data-act="add">＋ 文字を追加</button><button class="eb dark" data-act="addimg">＋ 写真を重ねる</button></div>`;return}
  if(tab==='文字'){
    b.innerHTML=`<textarea class="etext" id="etxt" rows="2" aria-label="文字">${esc(L.text)}</textarea>
      <div class="ebtns"><button class="eb" data-act="add">＋ 追加</button><button class="eb" data-act="dup">複製</button><button class="eb" data-act="front">前へ</button><button class="eb" data-act="back">後ろへ</button><button class="eb" data-act="del">削除</button><button class="eb" data-act="addimg">＋ 写真を重ねる</button></div>
      <div class="erow">${segs('align',[['left','左'],['center','中'],['right','右']])}${segs('vertical',[[false,'横書き'],[true,'縦書き']])}</div>
      ${slider('大きさ','size',12,600,1)}${slider('折り返し','wrap',0,1,.01)}${slider('文字間','ls',-10,80,1)}${slider('行間','lh',.8,2.6,.01)}`;
  }else if(tab==='書体'){
    const list=fontLang==='ja'?JA:EN;
    b.innerHTML=`<div class="eseg" data-lang><button data-v="ja" class="${fontLang==='ja'?'on':''}">日本語</button><button data-v="en" class="${fontLang==='en'?'on':''}">English</button></div>
      <div class="fontgrid">${list.map((f,i)=>`<button class="fbtn${f[1]===L.fam?' on':''}" data-f="${i}"><span style='font-family:${f[1]},sans-serif;font-weight:${f[4]}'>${f[0]}</span></button>`).join('')}</div>`;
    fontIO?.disconnect();fontIO=new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting){fontIO.unobserve(x.target);const f=list[+x.target.dataset.f];loadFace(f[1],f[4],f[0]).then(()=>x.target.classList.add('ready'))}}),{root:b});
    b.querySelectorAll('.fbtn').forEach(x=>fontIO.observe(x));
  }else if(tab==='色'){
    b.innerHTML=`<div class="sec"><h4>文字の色</h4>${pal('color')}</div>${slider('透明度','opacity',.1,1,.01)}`;
  }else if(tab==='飾り'){
    b.innerHTML=`<div class="sec">${toggle('stroke.on','縁取り')}${L.stroke.on?pal('stroke.color')+slider('太さ','stroke.w',1,30,.5):''}</div>
      <div class="sec">${toggle('shadow.on','影')}${L.shadow.on?pal('shadow.color')+slider('濃さ','shadow.a',.05,1,.01)+slider('ぼかし','shadow.blur',0,100,1)+slider('横','shadow.x',-30,30,1)+slider('縦','shadow.y',-30,30,1):''}</div>
      <div class="sec">${toggle('band.on','枠（四角・丸）')}${L.band.on?segs('band.shape',[['rect','四角'],['pill','カプセル'],['circle','丸'],['ellipse','だ円']])+pal('band.color')+slider('濃さ','band.a',0,1,.01)+slider('余白','band.pad',0,120,1)+(L.band.shape==='rect'?slider('角丸','band.r',0,100,1):'')+
        `<div class="subsec">${toggle('band.line.on','枠の線')}${L.band.line.on?pal('band.line.color')+slider('太さ','band.line.w',.5,15,.5):''}</div>`:''}</div>`;
  }
}
function addLayer(from){
  const base=isText(from)?from:(D.layers.filter(isText).at(-1)||{});
  const n=newLayer({text:'テキスト',fam:base.fam||'"Zen Maru Gothic"',w:base.w||500,name:base.name||'Zen Maru Gothic',color:base.color||INK,
    shadow:clone(base.shadow||{...SHADOW,on:false}),size:(base.size||96)*.6,vertical:!!base.vertical,y:D.H*[.5,.8,.2,.65,.35][D.layers.length%5]});
  D.layers.push(n);D.sel=n.id;return n;
}
function removeLayer(L){D.layers=D.layers.filter(x=>x!==L);if(D.sel===L.id)D.sel=D.layers.at(-1)?.id??null}
const bodyEl=$('#ebody');
bodyEl.addEventListener('input',e=>{
  const L=sel(),t=e.target;
  if(t.id==='etxt'){L.text=t.value;refresh();clearTimeout(textTimer);textTimer=setTimeout(commit,600);return}
  if(t.dataset.photo!=null){D.photo.s=+t.value;paint();return}
  if(!L||!t.dataset.k)return;
  put(L,t.dataset.k,t.type==='color'?t.value:+t.value);
  const v=bodyEl.querySelector(`[data-v="${t.dataset.k}"]`);if(v)v.textContent=fmt(t.dataset.k)(+t.value);
  if(t.type==='color'){t.closest('.pal').querySelectorAll('button').forEach(x=>x.classList.remove('on'));t.parentElement.classList.add('on')}
  paint();
});
bodyEl.addEventListener('change',e=>{if(e.target.id!=='etxt')commit()});
bodyEl.addEventListener('click',e=>{
  const L=sel(),t=e.target.closest('button');if(!t)return;
  if(t.id==='ephoto'){$('#efile').click();return}
  const act=t.dataset.act;
  if(act==='addimg'){$('#eimg').click();return}
  if(act==='done'){D.sel=null;panel();paint();return}
  if(act==='swapimg'){$('#eimgswap').click();return}
  if(act==='add'){addLayer(L);setTab('文字');commit();refresh();setTimeout(()=>{const a=$('#etxt');a?.focus();a?.select()},50);return}
  if(act==='dup'&&L){const n=Object.assign(clone(L),{id:uid++,x:L.x+D.W*.04,y:L.y+D.W*.04});D.layers.push(n);D.sel=n.id;commit();panel();refresh();return}
  if(act==='del'&&L){removeSelected();return}
  if(act==='front'&&L){const i=D.layers.indexOf(L);if(i<D.layers.length-1){D.layers.splice(i,1);D.layers.splice(i+1,0,L);commit();paint()}return}
  if(act==='back'&&L){const i=D.layers.indexOf(L);if(i>0){D.layers.splice(i,1);D.layers.splice(i-1,0,L);commit();paint()}return}
  if(t.closest('[data-ratio]')){applyRatio(t.dataset.v);sizeCanvas();commit();panel();refresh();return}
  if(t.closest('[data-lang]')){fontLang=t.dataset.v;panel();return}
  if(!L)return;
  if(t.dataset.tg){const k=t.dataset.tg,top=bodyEl.scrollTop;put(L,k,!get(L,k));commit();panel();bodyEl.scrollTop=top;refresh();return}
  const sg=t.closest('[data-set]');if(sg){const top=bodyEl.scrollTop,v=t.dataset.v;put(L,sg.dataset.set,v==='true'?true:v==='false'?false:/^-?\d+(\.\d+)?$/.test(v)?+v:v);commit();panel();bodyEl.scrollTop=top;refresh();return}
  const p=t.closest('.pal');if(p&&t.dataset.c){const top=bodyEl.scrollTop;put(L,p.dataset.k,t.dataset.c);commit();panel();bodyEl.scrollTop=top;paint();return}
  if(t.dataset.f!=null){setFont(L,(fontLang==='ja'?JA:EN)[+t.dataset.f]);bodyEl.querySelectorAll('.fbtn').forEach(x=>x.classList.toggle('on',x===t));commit();refresh()}
});
function setFont(L,f){Object.assign(L,{fam:f[1],w:f[4],name:f[0]})}

/* ---------- page strip ---------- */
const dprS=Math.min(2,devicePixelRatio||1);
function renderStrip(){
  syncCur();
  $('#pstrip').innerHTML=P.pages.map((pg,i)=>`<button class="pg${i===P.cur?' on':''}" data-pg="${i}" aria-label="${i+1}枚目"><canvas></canvas><b>${i+1}</b>${i===P.cur&&P.pages.length>1?'<i class="pgx" data-pgdel aria-label="このページを消す">×</i>':''}</button>`).join('')+
    `<button class="pg add" id="padd" aria-label="写真を足す">＋</button><button class="eb dark dbtn" id="dopen">デザイン</button>`;
  paintStrip();ensureAll().then(paintStrip);
}
function paintStrip(){
  syncCur();
  document.querySelectorAll('#pstrip .pg canvas').forEach((c,i)=>{
    const pg=P.pages[i];if(!pg)return;const h=Math.round(54*dprS),w=Math.round(h*pg.W/pg.H);
    c.width=w;c.height=h;c.style.width=w/dprS+'px';c.style.height=h/dprS+'px';
    const x=c.getContext('2d');x.setTransform(w/pg.W,0,0,h/pg.H,0,0);withPage(pg,()=>draw(x,{thumb:true,grad:i}));
  });
}
let stripT=0;function stripSoon(){if($('#editor').hidden)return;clearTimeout(stripT);stripT=setTimeout(paintStrip,250)}
function switchPage(i){if(i===P.cur)return;goPage(i);sizeCanvas();panel();refresh();renderStrip()}
$('#pstrip').addEventListener('click',e=>{
  if(e.target.closest('[data-pgdel]')){removePage();return}
  const b=e.target.closest('button');if(!b)return;
  if(b.id==='padd'){$('#eadd').click();return}
  if(b.id==='dopen'){openDesign();return}
  if(b.dataset.pg!=null)switchPage(+b.dataset.pg);
});
$('#eimg').addEventListener('change',async e=>{
  const fs=[...e.target.files];e.target.value='';if(!fs.length)return;
  try{const urls=await Promise.all(fs.map(loadPhoto));for(const [i,u] of urls.entries())addImage(await makePhoto(u),i);setTab('文字');commit();refresh()}
  catch{toast('読み込めない画像がありました')}
});
$('#eimgswap').addEventListener('change',async e=>{
  const f=e.target.files[0];e.target.value='';const L=sel();if(!f||!L||isText(L))return;
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
const normDesign=()=>({v:1,layers:clone(D.layers).filter(isText).map(L=>({...L,x:L.x/D.W,y:L.y/D.H,size:L.size/D.W}))});
function applyDesign(d){const texts=clone(d.layers).map(L=>({...L,id:uid++,x:L.x*D.W,y:L.y*D.H,size:L.size*D.W}));D.layers=[...D.layers.filter(L=>!isText(L)),...texts];D.sel=texts[0]?.id??null}
let toastT;function toast(msg){const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,2200)}
function openDesign(){renderDesign();$('#dsheet').hidden=false}
function renderDesign(){
  const clip=store.get('piclea.clip',null),mine=store.get('piclea.designs',[]);
  $('#dpaste').disabled=!clip;$('#dall').disabled=P.pages.length<2;
  $('#pleft').disabled=P.cur===0;$('#pright').disabled=P.cur>=P.pages.length-1;$('#pdel').disabled=P.pages.length<2;
  $('#dpage').textContent=`この写真（${P.cur+1} / ${P.pages.length}枚目）`;
  $('#mylist').innerHTML=mine.length?mine.map(m=>{const L=m.d.layers[0]||{};return `<div class="myrow"><div class="mytxt"><b>${esc(m.name)}</b><span style='font-family:${L.fam||'inherit'},sans-serif;font-weight:${L.w||400}'>${esc((L.text||'').split('\n')[0].slice(0,14))}</span></div><button class="eb" data-myapply="${m.id}">使う</button><button class="myx" data-mydel="${m.id}" aria-label="消す">×</button></div>`}).join('')
    :'<p class="enote">よく使う文字の並びや飾りを名前を付けて取っておけます。写真は含みません。</p>';
  for(const m of mine){const L=m.d.layers[0];if(L)loadFace(L.fam,L.w,L.text).catch(()=>{})}
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
  const mine=store.get('piclea.designs',[]);
  switch(b.id){
    case 'dcopy':store.set('piclea.clip',normDesign());renderDesign();toast('デザインをコピーしました（写真以外）');return;
    case 'dpaste':{const c=store.get('piclea.clip',null);if(!c)return;applyDesign(c);designChanged('貼り付けました');renderDesign();return}
    case 'dall':{
      if(!await ask('ほかの写真の文字と飾りを、全部このページと同じにしますか？',{ok:'そろえる'}))return;
      syncCur();const d=normDesign();
      P.pages.forEach((pg,i)=>{if(i!==P.cur)withPage(pg,()=>{applyDesign(d);P.pages[i]=clone(D)})});
      loadInto(P.pages[P.cur]);designChanged(`${P.pages.length}枚ぜんぶ同じデザインにしました`);return;
    }
    case 'mysave':{
      const name=await ask('マイデザインの名前',{ok:'取っておく',input:`マイデザイン ${mine.length+1}`});if(!name)return;
      mine.unshift({id:Date.now(),name:name.slice(0,30),d:normDesign()});
      if(!store.set('piclea.designs',mine))toast('保存できませんでした');else{renderDesign();toast('マイデザインに保存しました')}
      return;
    }
    case 'pleft':case 'pright':{
      syncCur();const j=P.cur+(b.id==='pleft'?-1:1);[P.pages[P.cur],P.pages[j]]=[P.pages[j],P.pages[P.cur]];P.cur=j;loadInto(P.pages[j]);
      designChanged();renderDesign();return;
    }
    case 'pdel':await removePage();renderDesign();return;
  }
  if(b.dataset.myapply){const m=mine.find(x=>x.id===+b.dataset.myapply);if(m){applyDesign(m.d);designChanged(`「${m.name}」を当てました`)}return}
  if(b.dataset.mydel){const m=mine.find(x=>x.id===+b.dataset.mydel);if(m&&await ask(`「${m.name}」を消しますか？`,{ok:'消す'})){store.set('piclea.designs',mine.filter(x=>x!==m));renderDesign()}}
});

/* ---------- works kept on this device (IndexedDB), plus a backup file ---------- */
const DB={
  db:null,
  open(){return this.db??=new Promise((res,rej)=>{const r=indexedDB.open('piclea',1);r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('works',{keyPath:'id'});d.createObjectStore('photos')};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})},
  async run(store,mode,fn){const d=await this.open();return new Promise((res,rej)=>{const t=d.transaction(store,mode),req=fn(t.objectStore(store));t.oncomplete=()=>res(req?.result);t.onerror=t.onabort=()=>rej(t.error)})},
};
let workId=null,savedPhotos=new Set(),saveT=0,asked=false;
const usedPhotos=()=>[...new Set(P.pages.flatMap(pg=>[pg.photoId,...pg.layers.filter(L=>!isText(L)).map(L=>L.photoId)]).filter(Boolean))];
function autosave(){if(!anyPhoto())return;clearTimeout(saveT);saveT=setTimeout(()=>saveWork().catch(err=>{console.warn(err);toast('端末に保存できませんでした')}),1200)}
function workThumb(){
  const pg=P.pages[0],c=document.createElement('canvas'),h=260,w=Math.round(h*pg.W/pg.H);c.width=w;c.height=h;
  const x=c.getContext('2d');x.setTransform(w/pg.W,0,0,h/pg.H,0,0);withPage(pg,()=>draw(x,{thumb:true}));return c.toDataURL('image/jpeg',.75);
}
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
  const data={app:'piclea',v:1,doc:clone(P),photos:{}};
  for(const id of usedPhotos())data.photos[id]=await toDataURL(await (await fetch(photos.get(id).url)).blob());
  const title=(P.pages[0]?.layers[0]?.text||'').split('\n')[0].slice(0,12).replace(/[\\/:*?"<>|\s]/g,'')||'piclea';
  return new File([JSON.stringify(data)],`piclea-${title}-${new Date().toISOString().slice(0,10)}.json`,{type:'application/json'});
}
async function importWork(file){
  const data=JSON.parse(await file.text());if(data.app!=='piclea'||!data.doc?.pages)throw new Error('not piclea');
  const map={};
  for(const [old,url] of Object.entries(data.photos||{})){const blob=await (await fetch(url)).blob();map[old]=await makePhoto(URL.createObjectURL(blob))}
  for(const pg of data.doc.pages){pg.photoId=map[pg.photoId]??null;for(const L of pg.layers)if(!isText(L))L.photoId=map[L.photoId]??null}
  savedPhotos=new Set();adopt(data.doc,null);await saveWork();
}
let backup=null;
$('#wexport').onclick=async()=>{
  const b=$('#wexport');
  if(backup){ // second tap: a fresh gesture, so iOS lets the share sheet open
    if(navigator.canShare?.({files:[backup]}))navigator.share({files:[backup]}).catch(()=>{});
    else{const a=document.createElement('a');a.href=URL.createObjectURL(backup);a.download=backup.name;a.click()}
    backup=null;b.textContent='バックアップをファイルに書き出す';return;
  }
  b.disabled=true;b.textContent='準備しています…';
  try{backup=await backupFile();b.textContent='「ファイル」に保存する（もう一度タップ）'}
  catch{b.textContent='バックアップをファイルに書き出す';toast('書き出せませんでした')}
  finally{b.disabled=false}
};
on('saved',()=>{const t=$('#esaved');if(!t)return;t.textContent='保存しました';t.classList.add('on');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('on'),1600)});

/* ---------- open / close / save ---------- */
function openEditor(){
  if(!D.sel)D.sel=D.layers.at(-1)?.id??null;
  sizeCanvas();$('#editor').hidden=false;document.body.style.overflow='hidden';setTab('文字');refresh();renderStrip();
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
  try{
    await ensureAll();syncCur();
    const stamp=new Date().toISOString().slice(0,19).replace(/\D/g,''),many=P.pages.length>1;
    const canvases=P.pages.map(pg=>withPage(pg,()=>{const off=document.createElement('canvas');off.width=D.W;off.height=D.H;draw(off.getContext('2d'));return off}));
    const blobs=await Promise.all(canvases.map(c=>new Promise(r=>c.toBlob(r,'image/jpeg',.92))));
    saved?.urls.forEach(u=>URL.revokeObjectURL(u));
    saved={files:blobs.map((b,i)=>new File([b],`piclea-${stamp}${many?'-'+String(i+1).padStart(2,'0'):''}.jpg`,{type:'image/jpeg'})),urls:blobs.map(b=>URL.createObjectURL(b))};
    $('#sprevs').innerHTML=saved.urls.map((u,i)=>`<img src="${u}" alt="${i+1}枚目">`).join('');
    $('#sprevs').classList.toggle('many',many);
    $('#ssize').textContent=`${many?P.pages.length+'枚・':''}${D.W} × ${D.H}`;
    $('#sshare').textContent=navigator.canShare?.({files:saved.files})?(many?`${P.pages.length}枚まとめて保存・共有`:'写真に保存・共有'):'画像をダウンロード';
    $('#ssheet').hidden=false;
  }finally{btn.disabled=false}
};
$('#sshare').onclick=()=>{
  if(!saved)return;
  if(navigator.canShare?.({files:saved.files}))navigator.share({files:saved.files}).catch(()=>{});
  else saved.files.forEach((f,i)=>{const a=document.createElement('a');a.href=saved.urls[i];a.download=f.name;a.click()});
};
document.querySelectorAll('[data-sclose]').forEach(x=>x.onclick=()=>$('#ssheet').hidden=true);
addEventListener('resize',()=>paint());

Object.assign(window.PICLEA,{app:{D,INK,SHADOW,newLayer,addLayer,removeLayer,setFont,draw,ensureFonts,hitLayer,snapMove,setPhoto,commit,openEditor,on,
  hasPhoto:()=>!!cur(),hasGlyph,ask,toast,addPhotos,isText,PALETTE,switchPage,pageCount:()=>P.pages.length,pageIndex:()=>P.cur,listWorks,openWork,deleteWork,newWork,importWork,backupFile,sel,GRADS}});
})();
