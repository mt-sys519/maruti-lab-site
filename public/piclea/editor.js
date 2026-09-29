// PICLEA core. One document (photo framing + up to a few text layers) and one drawing routine, draw(),
// used for the picker tiles, the large preview, the editor and the saved file alike, so all of them
// match. Coordinates are output pixels of the finished image.
(() => {
const {JA,EN,loadPhoto}=window.PICLEA;
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

const D={ratio:'4:5',W:OUT_W,H:Math.round(OUT_W*5/4),photo:{s:1,ox:0,oy:0},layers:[],sel:null};
let img=null,small=null,uid=1;
const listeners={};
const emit=(n,d)=>(listeners[n]||[]).forEach(f=>f(d));
const on=(n,f)=>(listeners[n]??=[]).push(f);

const clone=o=>JSON.parse(JSON.stringify(o,(k,v)=>k.startsWith('_')?undefined:v));
const sel=()=>D.layers.find(l=>l.id===D.sel);
const face=(L,ov)=>ov&&ov.id===L.id?{fam:ov.font[1],w:ov.font[4]}:{fam:L.fam,w:L.w};
const fontStr=(f,size)=>`${f.w} ${size}px ${f.fam}, sans-serif`;
const rgba=(hex,a)=>{const n=parseInt(hex.slice(1),16);return `rgba(${n>>16},${n>>8&255},${n&255},${a})`};

function newLayer(o){
  return Object.assign({id:uid++,text:'テキスト',fam:'"Zen Maru Gothic"',w:500,name:'Zen Maru Gothic',size:96,x:D.W/2,y:D.H/2,rot:0,
    color:INK,align:'center',ls:0,lh:1.45,vertical:false,opacity:1,wrap:.86,
    stroke:{on:false,color:INK,w:8},shadow:{...SHADOW,on:false},band:{on:false,color:'#ffffff',a:.75,pad:30,r:0}},o);
}

/* ---------- glyph support (for vertical forms) ---------- */
const probe=document.createElement('canvas');probe.width=probe.height=40;const pc=probe.getContext('2d',{willReadFrequently:true});
let glyphCache=new Map();
function hasGlyph(f,ch){
  const key=f.fam+f.w+ch;if(glyphCache.has(key))return glyphCache.get(key);
  const ink=font=>{pc.clearRect(0,0,40,40);pc.font=font;pc.textBaseline='middle';pc.textAlign='center';pc.fillText(ch,20,20);const d=pc.getImageData(0,0,40,40).data;let h=0;for(let i=3;i<d.length;i+=4)h=(h*31+d[i])|0;return h};
  const r=ink(`${f.w} 30px ${f.fam}, sans-serif`)!==ink(`${f.w} 30px sans-serif`);
  glyphCache.set(key,r);return r;
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
function drawLayer(c,L,ov){
  const f=face(L,ov),s=L.size;
  c.save();c.translate(L.x,L.y);c.rotate(L.rot);
  const m=layout(c,L,f);
  if(L.band.on){
    const p=s*L.band.pad/100;
    c.save();c.globalAlpha=L.opacity*L.band.a;c.fillStyle=L.band.color;
    c.beginPath();c.roundRect(-m.W/2-p,-m.H/2-p,m.W+2*p,m.H+2*p,s*L.band.r/100);c.fill();c.restore();
  }
  c.globalAlpha=L.opacity;
  // shadowBlur and offsets ignore the canvas transform, so scale them by hand for small previews
  const k=c.getTransform().a;
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
// o: {ov:{id,font}, grad:index, thumb:bool, ui:'edit'|'mark', kk: output px per screen px}. Returns metrics per layer id.
function draw(c,o={}){
  c.clearRect(0,0,D.W,D.H);
  const src=o.thumb?small:img;
  if(src)drawPhoto(c,src);
  else{const [a,b]=GRADS[(o.grad||0)%GRADS.length],gr=c.createLinearGradient(0,0,D.W*.36,D.H);gr.addColorStop(0,a);gr.addColorStop(1,b);c.fillStyle=gr;c.fillRect(0,0,D.W,D.H)}
  const M=new Map();for(const L of D.layers)M.set(L.id,drawLayer(c,L,o.ov));
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
function box(L,M,kk){const m=M.get(L.id),p=(L.band.on?L.size*L.band.pad/100:0)+10*kk;return {w:m.W+2*p,h:m.H+2*p}}
// The scale/rotate handle sits on the bottom-right corner, pulled back inside the picture if the corner is off it.
function handlePos(L,M,kk){
  const b=box(L,M,kk),cs=Math.cos(L.rot),sn=Math.sin(L.rot),m=18*kk;
  const x=L.x+b.w/2*cs-b.h/2*sn,y=L.y+b.w/2*sn+b.h/2*cs;
  return {x:Math.max(m,Math.min(D.W-m,x)),y:Math.max(m,Math.min(D.H-m,y))};
}
function local(L,p){const dx=p.x-L.x,dy=p.y-L.y,c=Math.cos(-L.rot),s=Math.sin(-L.rot);return {x:dx*c-dy*s,y:dx*s+dy*c}}
function hitLayer(M,p,kk){
  for(let i=D.layers.length-1;i>=0;i--){const L=D.layers[i];if(!M.has(L.id))continue;const b=box(L,M,kk),q=local(L,p),tol=8*kk;if(Math.abs(q.x)<=b.w/2+tol&&Math.abs(q.y)<=b.h/2+tol)return L}
  return null;
}
const loadText=L=>L.text+(L.vertical?Object.values(VFORM).join(''):'')||'あ';
function ensureFonts(ov){
  return Promise.all(D.layers.map(L=>document.fonts.load(fontStr(face(L,ov),32),loadText(L)).catch(()=>[])));
}

/* ---------- photo ---------- */
async function setPhoto(url){
  const im=new Image();im.src=url;await im.decode();
  const first=!img;img=im;
  const k=Math.min(1,720/Math.max(im.width,im.height));small=document.createElement('canvas');
  small.width=Math.round(im.width*k);small.height=Math.round(im.height*k);small.getContext('2d').drawImage(im,0,0,small.width,small.height);
  D.photo={s:1,ox:0,oy:0};
  if(D.ratio==='元の比率')applyRatio('元の比率');
  // text written for the plain backdrop turns white with a soft shadow once a photo is behind it
  if(first)for(const L of D.layers)if(L.color===INK&&!L.stroke.on&&!L.band.on){L.color='#ffffff';L.shadow={...SHADOW}}
  commit();emit('photo',url);
}

/* ---------- history ---------- */
let hist=[],redo=[];
const snap=()=>JSON.stringify(clone({ratio:D.ratio,W:D.W,H:D.H,photo:D.photo,layers:D.layers,sel:D.sel}));
function commit(){const s=snap();if(hist.at(-1)===s)return;hist.push(s);if(hist.length>80)hist.shift();redo=[];syncUndo()}
function restore(s){const o=JSON.parse(s);Object.assign(D,o);sizeCanvas();panel();refresh();syncUndo();emit('change')}
function undo(){if(hist.length<2)return;redo.push(hist.pop());restore(hist.at(-1))}
function redoIt(){if(!redo.length)return;const s=redo.pop();hist.push(s);restore(s)}
function syncUndo(){$('#eundo').disabled=hist.length<2;$('#eredo').disabled=!redo.length}

function applyRatio(name){
  const r=RATIOS.find(x=>x[0]===name)[1]||(img?img.width/img.height:.8);
  const W=OUT_W,H=Math.round(W/r),sx=W/D.W,sy=H/D.H;
  for(const L of D.layers){L.x*=sx;L.y*=sy}
  Object.assign(D,{ratio:name,W,H});D.photo.ox=D.photo.oy=0;wrapCache.clear();
}

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
const clampSize=v=>Math.max(12,Math.min(900,v));
function snapAngle(a){const d=Math.round(a/(Math.PI/2))*(Math.PI/2);return Math.abs(a-d)<.05?d:a}

cv.addEventListener('pointerdown',e=>{
  try{cv.setPointerCapture(e.pointerId)}catch{}const p=pt(e);G.ptrs.set(e.pointerId,p);
  const L=sel();
  if(G.ptrs.size===2){
    const t=two();
    if(tab==='写真')G.g={mode:'pzoom',t,s:D.photo.s};
    else if(L)G.g={mode:'pinch',t,size:L.size,rot:L.rot};
    return;
  }
  if(tab==='写真'){G.g={mode:'pan',p,ox:D.photo.ox,oy:D.photo.oy};return}
  if(hitHandle(L,p)){const h=Math.hypot(p.x-L.x,p.y-L.y);G.g={mode:'handle',d:h,a:Math.atan2(p.y-L.y,p.x-L.x),size:L.size,rot:L.rot};return}
  const H=hitLayer(G.M,p,kE());
  if(H){const was=D.sel===H.id;D.sel=H.id;G.g={mode:'move',p,x:H.x,y:H.y,was,moved:false};if(!was)panel()}
  else{G.g=null;if(D.sel){D.sel=null;panel()}}
  paint();
});
cv.addEventListener('pointermove',e=>{
  const g=G.g;if(!G.ptrs.has(e.pointerId)||!g)return;const p=pt(e);G.ptrs.set(e.pointerId,p);const L=sel();
  if(g.mode==='pan'){D.photo.ox=g.ox+p.x-g.p.x;D.photo.oy=g.oy+p.y-g.p.y}
  else if(g.mode==='pzoom'&&G.ptrs.size===2){D.photo.s=Math.max(1,Math.min(4,g.s*two().d/g.t.d))}
  else if(g.mode==='pinch'&&L&&G.ptrs.size===2){const t=two();L.size=clampSize(g.size*t.d/g.t.d);L.rot=g.rot+t.a-g.t.a}
  else if(g.mode==='handle'&&L){L.size=clampSize(g.size*Math.hypot(p.x-L.x,p.y-L.y)/g.d);L.rot=snapAngle(g.rot+Math.atan2(p.y-L.y,p.x-L.x)-g.a)}
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
  if(tap){setTab('文字');setTimeout(()=>$('#etxt')?.focus(),50)}
}
cv.addEventListener('pointerup',endPtr);cv.addEventListener('pointercancel',endPtr);
cv.addEventListener('wheel',e=>{
  e.preventDefault();const L=sel(),f=Math.exp(-e.deltaY/400);
  if(tab==='写真')D.photo.s=Math.max(1,Math.min(4,D.photo.s*f));else if(L)L.size=clampSize(L.size*f);else return;
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
const FMT={lh:v=>(+v).toFixed(2),opacity:pct,'shadow.a':pct,'band.a':pct,wrap:v=>+v?pct(v):'なし'};
const fmt=k=>FMT[k]||(v=>Math.round(v));
const slider=(label,key,min,max,step)=>{const v=get(sel(),key);return `<label class="erow"><span class="el">${label}</span><input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${v}"><span class="ev" data-v="${key}">${fmt(key)(v)}</span></label>`};
const pal=key=>{const v=get(sel(),key);return `<div class="pal" data-k="${key}">${PALETTE.map(c=>`<button style="--c:${c}" data-c="${c}" class="${c===v?'on':''}" aria-label="${c}"></button>`).join('')}<label class="custom${PALETTE.includes(v)?'':' on'}" aria-label="ほかの色"><input type="color" data-k="${key}" value="${v}"></label></div>`};
const toggle=(key,label)=>`<h4>${label}<button class="tg${get(sel(),key)?' on':''}" data-tg="${key}" aria-label="${label}"></button></h4>`;
const segs=(key,opts)=>`<div class="eseg" data-set="${key}">${opts.map(([v,l])=>`<button data-v="${v}" class="${get(sel(),key)===v?'on':''}">${l}</button>`).join('')}</div>`;
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');

let fontIO;
function panel(){
  const L=sel(),b=$('#ebody');
  if(tab==='写真'){
    b.innerHTML=`<div class="eseg wide" data-ratio>${RATIOS.map(([n])=>`<button data-v="${n}" class="${D.ratio===n?'on':''}">${n}</button>`).join('')}</div>
      <p class="enote">写真をドラッグで位置、2本指（パソコンはホイール）で拡大できます。</p>
      <label class="erow"><span class="el">拡大</span><input type="range" data-photo min="1" max="4" step=".01" value="${D.photo.s}"></label>
      <div class="ebtns"><button class="eb" id="ephoto">写真を変える</button></div>`;
    return;
  }
  if(!L){b.innerHTML=`<p class="enote">文字をタップすると、ここで調整できます。</p><div class="ebtns"><button class="eb dark" data-act="add">＋ 文字を追加</button></div>`;return}
  if(tab==='文字'){
    b.innerHTML=`<textarea class="etext" id="etxt" rows="2" aria-label="文字">${esc(L.text)}</textarea>
      <div class="ebtns"><button class="eb" data-act="add">＋ 追加</button><button class="eb" data-act="dup">複製</button><button class="eb" data-act="front">前へ</button><button class="eb" data-act="back">後ろへ</button><button class="eb" data-act="del">削除</button></div>
      <div class="erow">${segs('align',[['left','左'],['center','中'],['right','右']])}${segs('vertical',[[false,'横書き'],[true,'縦書き']])}</div>
      ${slider('大きさ','size',12,600,1)}${slider('折り返し','wrap',0,1,.01)}${slider('文字間','ls',-10,80,1)}${slider('行間','lh',.8,2.6,.01)}`;
  }else if(tab==='書体'){
    const list=fontLang==='ja'?JA:EN;
    b.innerHTML=`<div class="eseg" data-lang><button data-v="ja" class="${fontLang==='ja'?'on':''}">日本語</button><button data-v="en" class="${fontLang==='en'?'on':''}">English</button></div>
      <div class="fontgrid">${list.map((f,i)=>`<button class="fbtn${f[1]===L.fam?' on':''}" data-f="${i}"><span style='font-family:${f[1]},sans-serif;font-weight:${f[4]}'>${f[0]}</span></button>`).join('')}</div>`;
    fontIO?.disconnect();fontIO=new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting){fontIO.unobserve(x.target);const f=list[+x.target.dataset.f];document.fonts.load(`${f[4]} 16px ${f[1]}`,f[0]).then(()=>x.target.classList.add('ready'))}}),{root:b});
    b.querySelectorAll('.fbtn').forEach(x=>fontIO.observe(x));
  }else if(tab==='色'){
    b.innerHTML=`<div class="sec"><h4>文字の色</h4>${pal('color')}</div>${slider('透明度','opacity',.1,1,.01)}`;
  }else if(tab==='飾り'){
    b.innerHTML=`<div class="sec">${toggle('stroke.on','縁取り')}${L.stroke.on?pal('stroke.color')+slider('太さ','stroke.w',1,30,.5):''}</div>
      <div class="sec">${toggle('shadow.on','影')}${L.shadow.on?pal('shadow.color')+slider('濃さ','shadow.a',.05,1,.01)+slider('ぼかし','shadow.blur',0,100,1)+slider('横','shadow.x',-30,30,1)+slider('縦','shadow.y',-30,30,1):''}</div>
      <div class="sec">${toggle('band.on','文字の後ろの帯')}${L.band.on?pal('band.color')+slider('濃さ','band.a',.05,1,.01)+slider('余白','band.pad',0,120,1)+slider('角丸','band.r',0,100,1):''}</div>`;
  }
}
function addLayer(from){
  const base=from||D.layers.at(-1)||{};
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
  if(act==='add'){addLayer(L);setTab('文字');commit();refresh();setTimeout(()=>{const a=$('#etxt');a?.focus();a?.select()},50);return}
  if(act==='dup'&&L){const n=Object.assign(clone(L),{id:uid++,x:L.x+D.W*.04,y:L.y+D.W*.04});D.layers.push(n);D.sel=n.id;commit();panel();refresh();return}
  if(act==='del'&&L){removeLayer(L);commit();panel();paint();return}
  if(act==='front'&&L){const i=D.layers.indexOf(L);if(i<D.layers.length-1){D.layers.splice(i,1);D.layers.splice(i+1,0,L);commit();paint()}return}
  if(act==='back'&&L){const i=D.layers.indexOf(L);if(i>0){D.layers.splice(i,1);D.layers.splice(i-1,0,L);commit();paint()}return}
  if(t.closest('[data-ratio]')){applyRatio(t.dataset.v);sizeCanvas();commit();panel();refresh();return}
  if(t.closest('[data-lang]')){fontLang=t.dataset.v;panel();return}
  if(!L)return;
  if(t.dataset.tg){put(L,t.dataset.tg,!get(L,t.dataset.tg));commit();panel();refresh();return}
  const sg=t.closest('[data-set]');if(sg){put(L,sg.dataset.set,t.dataset.v==='true'?true:t.dataset.v==='false'?false:t.dataset.v);commit();panel();refresh();return}
  const p=t.closest('.pal');if(p&&t.dataset.c){put(L,p.dataset.k,t.dataset.c);commit();panel();paint();return}
  if(t.dataset.f!=null){setFont(L,(fontLang==='ja'?JA:EN)[+t.dataset.f]);bodyEl.querySelectorAll('.fbtn').forEach(x=>x.classList.toggle('on',x===t));commit();refresh()}
});
function setFont(L,f){Object.assign(L,{fam:f[1],w:f[4],name:f[0]})}

/* ---------- open / close / save ---------- */
function openEditor(){
  if(!D.sel)D.sel=D.layers.at(-1)?.id??null;
  sizeCanvas();$('#editor').hidden=false;document.body.style.overflow='hidden';setTab('文字');refresh();
}
function closeEditor(){$('#editor').hidden=true;document.body.style.overflow='';emit('closed')}
$('#eback').onclick=closeEditor;
$('#eundo').onclick=undo;$('#eredo').onclick=redoIt;
document.addEventListener('keydown',e=>{
  if($('#editor').hidden)return;
  const typing=/TEXTAREA|INPUT/.test(document.activeElement?.tagName);
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!typing){e.preventDefault();e.shiftKey?redoIt():undo()}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'&&!typing){e.preventDefault();redoIt()}
  else if((e.key==='Delete'||e.key==='Backspace')&&!typing&&sel()){removeLayer(sel());commit();panel();paint()}
});
$('#efile').addEventListener('change',async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  try{await setPhoto(await loadPhoto(f));sizeCanvas();panel();refresh()}catch{alert('この画像は読み込めませんでした')}
});

// Saving: render off screen with no selection marks, show the result, then hand the file to the share
// sheet from a fresh tap (iOS only opens it on a direct user gesture).
let saved=null;
$('#esave').onclick=async()=>{
  const btn=$('#esave');btn.disabled=true;
  try{
    await ensureFonts();
    const off=document.createElement('canvas');off.width=D.W;off.height=D.H;draw(off.getContext('2d'));
    const blob=await new Promise(r=>off.toBlob(r,'image/jpeg',.92));
    const name=`piclea-${new Date().toISOString().slice(0,19).replace(/\D/g,'')}.jpg`;
    if(saved)URL.revokeObjectURL(saved.url);
    saved={file:new File([blob],name,{type:'image/jpeg'}),url:URL.createObjectURL(blob)};
    $('#sprev').src=saved.url;$('#ssize').textContent=`${D.W} × ${D.H}`;
    $('#sshare').textContent=navigator.canShare?.({files:[saved.file]})?'写真に保存・共有':'画像をダウンロード';
    $('#ssheet').hidden=false;
  }finally{btn.disabled=false}
};
$('#sshare').onclick=()=>{
  if(!saved)return;
  if(navigator.canShare?.({files:[saved.file]}))navigator.share({files:[saved.file]}).catch(()=>{});
  else{const a=document.createElement('a');a.href=saved.url;a.download=saved.file.name;a.click()}
};
document.querySelectorAll('[data-sclose]').forEach(x=>x.onclick=()=>$('#ssheet').hidden=true);
addEventListener('resize',()=>paint());

Object.assign(window.PICLEA,{app:{D,INK,SHADOW,newLayer,addLayer,removeLayer,setFont,draw,ensureFonts,hitLayer,snapMove,setPhoto,commit,openEditor,on,
  hasPhoto:()=>!!img,sel,GRADS}});
})();
