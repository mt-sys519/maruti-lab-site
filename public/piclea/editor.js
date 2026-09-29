// PICLEA editor. The photo and every text layer are drawn by one function, draw(), used both on
// screen and for the saved file, so what you see is what gets saved. Coordinates are output pixels.
(() => {
const {JA,EN,loadPhoto}=window.PICLEA;
const $=s=>document.querySelector(s);
const OUT_W=1080;
const RATIOS=[['4:5',4/5],['1:1',1],['9:16',9/16],['元の比率',0]];
const PALETTE=['#ffffff','#4b3f3a','#1f1d1b','#f3e9dc','#e8c9c1','#b76e5a','#8f9e7e','#3c4f6b','#d4a94f','#a898b8'];
const ROTATE=/[ー－―‐\-~〜～…‥（）()「」『』【】〔〕［］[\]｛｝{}＜＞<>《》〈〉→←＝=：:；;｜|A-Za-z0-9]/;
const PUNCT=/[、。，．,.]/, SMALL=/[ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ]/;

const cv=$('#ecanvas'),ctx=cv.getContext('2d');
let E=null,img=null,hist=[],redo=[],tab='文字',fontLang='ja',ptrs=new Map(),g=null,textTimer;

const clone=o=>JSON.parse(JSON.stringify(o,(k,v)=>k.startsWith('_')?undefined:v));
const sel=()=>E&&E.layers.find(l=>l.id===E.sel);
const fontOf=(L,size=L.size)=>`${L.w} ${size}px ${L.fam}, sans-serif`;
const k=()=>cv.clientWidth/E.W||1; // screen px per output px
const rgba=(hex,a)=>{const n=parseInt(hex.slice(1),16);return `rgba(${n>>16},${n>>8&255},${n&255},${a})`};
let uid=1;

function newLayer(o){
  return Object.assign({id:uid++,text:'テキスト',fam:'"Zen Maru Gothic"',w:500,name:'Zen Maru Gothic',size:96,x:E.W/2,y:E.H/2,rot:0,
    color:'#ffffff',align:'center',ls:0,lh:1.45,vertical:false,opacity:1,
    stroke:{on:false,color:'#4b3f3a',w:8},
    shadow:{on:false,color:'#28190f',a:.35,x:0,y:3,blur:30},
    band:{on:false,color:'#ffffff',a:.75,pad:30,r:0}},o);
}

/* ---------- layout and drawing ---------- */
function measure(c,t,sp){
  if(!sp)return c.measureText(t).width;
  const cs=[...t];return cs.reduce((s,ch)=>s+c.measureText(ch).width,0)+sp*Math.max(0,cs.length-1);
}
function layout(c,L){
  c.font=fontOf(L);
  const s=L.size,sp=s*L.ls/100,lines=L.text.split('\n');
  if(!L.vertical){
    const ws=lines.map(t=>measure(c,t,sp)),lh=s*L.lh;
    return {lines,ws,sp,lh,W:Math.max(s*.3,...ws),H:lh*lines.length};
  }
  const cw=s*L.lh,adv=s+sp,hs=lines.map(t=>Math.max(0,[...t].length*adv-sp));
  return {lines,hs,sp,cw,adv,W:cw*lines.length,H:Math.max(s,...hs)};
}
function glyphs(c,L,m,stroke){
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
      if(ROTATE.test(ch)){c.save();c.translate(x,y);c.rotate(Math.PI/2);put(ch,0,0);c.restore()}
      else if(PUNCT.test(ch))put(ch,x+s*.5,y-s*.5);
      else if(SMALL.test(ch))put(ch,x+s*.1,y-s*.1);
      else put(ch,x,y);
      y+=m.adv;
    }
  });
}
function drawLayer(c,L){
  c.save();c.translate(L.x,L.y);c.rotate(L.rot);
  const m=layout(c,L),s=L.size;
  if(L.band.on){
    const p=s*L.band.pad/100;
    c.save();c.globalAlpha=L.opacity*L.band.a;c.fillStyle=L.band.color;
    c.beginPath();c.roundRect(-m.W/2-p,-m.H/2-p,m.W+2*p,m.H+2*p,s*L.band.r/100);c.fill();c.restore();
  }
  c.globalAlpha=L.opacity;
  const shadow=on=>{
    if(on&&L.shadow.on){c.shadowColor=rgba(L.shadow.color,L.shadow.a);c.shadowBlur=s*L.shadow.blur/100;c.shadowOffsetX=s*L.shadow.x/100;c.shadowOffsetY=s*L.shadow.y/100}
    else{c.shadowColor='transparent';c.shadowBlur=c.shadowOffsetX=c.shadowOffsetY=0}
  };
  if(L.stroke.on){
    shadow(true);c.lineJoin='round';c.miterLimit=2;c.lineWidth=s*L.stroke.w/100*2;c.strokeStyle=L.stroke.color;glyphs(c,L,m,true);
    shadow(false);c.fillStyle=L.color;glyphs(c,L,m,false);
  }else{shadow(true);c.fillStyle=L.color;glyphs(c,L,m,false)}
  c.restore();
  return m;
}
function drawPhoto(c){
  const cover=Math.max(E.W/img.width,E.H/img.height)*E.photo.s,w=img.width*cover,h=img.height*cover;
  E.photo.ox=Math.max(-(w-E.W)/2,Math.min((w-E.W)/2,E.photo.ox));
  E.photo.oy=Math.max(-(h-E.H)/2,Math.min((h-E.H)/2,E.photo.oy));
  c.drawImage(img,(E.W-w)/2+E.photo.ox,(E.H-h)/2+E.photo.oy,w,h);
}
function draw(c,ui){
  c.clearRect(0,0,E.W,E.H);drawPhoto(c);
  for(const L of E.layers)L._m=drawLayer(c,L);
  if(!ui)return;
  const kk=1/k(),L=sel();
  c.save();c.strokeStyle='#c49a90';c.lineWidth=1.5*kk;
  if(g&&g.guideX!=null){c.beginPath();c.moveTo(g.guideX,0);c.lineTo(g.guideX,E.H);c.stroke()}
  if(g&&g.guideY!=null){c.beginPath();c.moveTo(0,g.guideY);c.lineTo(E.W,g.guideY);c.stroke()}
  c.restore();
  if(L&&L._m&&tab!=='写真'){
    const b=box(L);
    c.save();c.translate(L.x,L.y);c.rotate(L.rot);
    c.setLineDash([6*kk,5*kk]);c.lineWidth=1.5*kk;c.strokeStyle='rgba(255,255,255,.95)';c.strokeRect(-b.w/2,-b.h/2,b.w,b.h);
    c.lineDashOffset=6*kk;c.strokeStyle='rgba(75,63,58,.8)';c.strokeRect(-b.w/2,-b.h/2,b.w,b.h);c.setLineDash([]);
    c.beginPath();c.arc(b.w/2,b.h/2,13*kk,0,7);c.fillStyle='#fff';c.fill();c.strokeStyle='#4b3f3a';c.lineWidth=1.5*kk;c.stroke();
    c.beginPath();c.arc(b.w/2,b.h/2,5.5*kk,.4,5.4);c.stroke();
    c.restore();
  }
}
function box(L){const m=L._m,p=(L.band.on?L.size*L.band.pad/100:0)+10/k();return {w:m.W+2*p,h:m.H+2*p}}
let raf=0;
function paint(){if(!raf)raf=requestAnimationFrame(()=>{raf=0;if(E)draw(ctx,true)})}
async function ensureFonts(){await Promise.all(E.layers.map(L=>document.fonts.load(fontOf(L,32),L.text||'あ').catch(()=>{})))}
function refresh(){paint();ensureFonts().then(paint)}

/* ---------- history ---------- */
const snap=()=>JSON.stringify(clone({ratio:E.ratio,W:E.W,H:E.H,photo:E.photo,layers:E.layers}));
function commit(){const s=snap();if(hist.at(-1)===s)return;hist.push(s);if(hist.length>80)hist.shift();redo=[];syncUndo()}
function restore(s){const o=JSON.parse(s);Object.assign(E,o);if(!sel())E.sel=null;sizeCanvas();panel();refresh();syncUndo()}
function undo(){if(hist.length<2)return;redo.push(hist.pop());restore(hist.at(-1))}
function redoIt(){if(!redo.length)return;const s=redo.pop();hist.push(s);restore(s)}
function syncUndo(){$('#eundo').disabled=hist.length<2;$('#eredo').disabled=!redo.length}

/* ---------- canvas size and ratio ---------- */
function sizeCanvas(){cv.width=E.W;cv.height=E.H}
function setRatio(name){
  const r=RATIOS.find(x=>x[0]===name)[1]||img.width/img.height;
  const W=OUT_W,H=Math.round(W/r),sx=W/E.W,sy=H/E.H;
  for(const L of E.layers){L.x*=sx;L.y*=sy}
  Object.assign(E,{ratio:name,W,H});E.photo.ox=E.photo.oy=0;sizeCanvas();refresh();
}

/* ---------- pointer: move, pinch, handle, photo ---------- */
function pt(e){const r=cv.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*E.W,y:(e.clientY-r.top)/r.height*E.H}}
function local(L,p){const dx=p.x-L.x,dy=p.y-L.y,c=Math.cos(-L.rot),s=Math.sin(-L.rot);return {x:dx*c-dy*s,y:dx*s+dy*c}}
function hitLayer(p){for(let i=E.layers.length-1;i>=0;i--){const L=E.layers[i];if(!L._m)continue;const b=box(L),q=local(L,p),tol=6/k();if(Math.abs(q.x)<=b.w/2+tol&&Math.abs(q.y)<=b.h/2+tol)return L}return null}
function hitHandle(L,p){if(!L||!L._m)return false;const b=box(L),q=local(L,p);return Math.hypot(q.x-b.w/2,q.y-b.h/2)<22/k()}
const two=()=>{const [a,b]=[...ptrs.values()];return {d:Math.hypot(a.x-b.x,a.y-b.y),a:Math.atan2(b.y-a.y,b.x-a.x),cx:(a.x+b.x)/2,cy:(a.y+b.y)/2}};

cv.addEventListener('pointerdown',e=>{
  cv.setPointerCapture(e.pointerId);const p=pt(e);ptrs.set(e.pointerId,p);
  const L=sel();
  if(ptrs.size===2){
    const t=two();
    if(tab==='写真')g={mode:'pzoom',t,s:E.photo.s,ox:E.photo.ox,oy:E.photo.oy};
    else if(L)g={mode:'pinch',t,size:L.size,rot:L.rot};
    return;
  }
  if(tab==='写真'){g={mode:'pan',p,ox:E.photo.ox,oy:E.photo.oy};return}
  if(hitHandle(L,p)){g={mode:'handle',d:Math.hypot(p.x-L.x,p.y-L.y),a:Math.atan2(p.y-L.y,p.x-L.x),size:L.size,rot:L.rot};return}
  const H=hitLayer(p);
  if(H){const was=E.sel===H.id;E.sel=H.id;g={mode:'move',p,x:H.x,y:H.y,was,moved:false};if(!was)panel()}
  else{g=null;if(E.sel){E.sel=null;panel()}}
  paint();
});
cv.addEventListener('pointermove',e=>{
  if(!ptrs.has(e.pointerId)||!g)return;const p=pt(e);ptrs.set(e.pointerId,p);const L=sel();
  if(g.mode==='pan'){E.photo.ox=g.ox+p.x-g.p.x;E.photo.oy=g.oy+p.y-g.p.y}
  else if(g.mode==='pzoom'&&ptrs.size===2){const t=two();E.photo.s=Math.max(1,Math.min(4,g.s*t.d/g.t.d))}
  else if(g.mode==='pinch'&&L&&ptrs.size===2){const t=two();L.size=Math.max(12,Math.min(900,g.size*t.d/g.t.d));L.rot=g.rot+t.a-g.t.a}
  else if(g.mode==='handle'&&L){L.size=Math.max(12,Math.min(900,g.size*Math.hypot(p.x-L.x,p.y-L.y)/g.d));L.rot=snapAngle(g.rot+Math.atan2(p.y-L.y,p.x-L.x)-g.a)}
  else if(g.mode==='move'&&L){
    if(!g.moved&&Math.hypot(p.x-g.p.x,p.y-g.p.y)*k()<4)return;g.moved=true;
    let x=g.x+p.x-g.p.x,y=g.y+p.y-g.p.y;const thr=8/k();g.guideX=g.guideY=null;
    const xs=[E.W/2,...E.layers.filter(o=>o!==L).map(o=>o.x)],ys=[E.H/2,...E.layers.filter(o=>o!==L).map(o=>o.y)];
    for(const c of xs)if(Math.abs(x-c)<thr){x=c;g.guideX=c;break}
    for(const c of ys)if(Math.abs(y-c)<thr){y=c;g.guideY=c;break}
    L.x=x;L.y=y;
  }
  paint();
});
function snapAngle(a){const d=Math.round(a/(Math.PI/2))*(Math.PI/2);return Math.abs(a-d)<.05?d:a}
function endPtr(e){
  if(!ptrs.has(e.pointerId))return;ptrs.delete(e.pointerId);
  if(ptrs.size)return; // wait for the last finger
  const tap=g&&g.mode==='move'&&!g.moved&&g.was;
  g=null;commit();paint();
  if(tap){setTab('文字');setTimeout(()=>$('#etxt')?.focus(),50)}
}
cv.addEventListener('pointerup',endPtr);cv.addEventListener('pointercancel',endPtr);
cv.addEventListener('wheel',e=>{
  e.preventDefault();const L=sel(),f=Math.exp(-e.deltaY/400);
  if(tab==='写真')E.photo.s=Math.max(1,Math.min(4,E.photo.s*f));else if(L)L.size=Math.max(12,Math.min(900,L.size*f));else return;
  paint();clearTimeout(textTimer);textTimer=setTimeout(commit,300);
},{passive:false});

/* ---------- panel ---------- */
const TABS=['文字','書体','色','飾り','写真'];
$('#etabs').innerHTML=TABS.map(t=>`<button data-t="${t}">${t}</button>`).join('');
$('#etabs').addEventListener('click',e=>{const b=e.target.closest('button');if(b)setTab(b.dataset.t)});
function setTab(t){tab=t;[...$('#etabs').children].forEach(b=>b.classList.toggle('on',b.dataset.t===t));panel();paint()}

const get=(o,p)=>p.split('.').reduce((a,k)=>a[k],o);
const put=(o,p,v)=>{const ks=p.split('.'),last=ks.pop();ks.reduce((a,k)=>a[k],o)[last]=v};
const slider=(label,key,min,max,step,fmt=v=>v)=>{const L=sel(),v=get(L,key);return `<label class="erow"><span class="el">${label}</span><input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${v}"><span class="ev" data-v="${key}">${fmt(v)}</span></label>`};
const FMT={size:v=>Math.round(v),ls:v=>Math.round(v),lh:v=>(+v).toFixed(2),opacity:v=>Math.round(v*100)+'%','shadow.a':v=>Math.round(v*100)+'%','band.a':v=>Math.round(v*100)+'%'};
const pal=key=>{const L=sel(),v=get(L,key);return `<div class="pal" data-k="${key}">${PALETTE.map(c=>`<button style="--c:${c}" data-c="${c}" class="${c===v?'on':''}" aria-label="${c}"></button>`).join('')}<label class="custom${PALETTE.includes(v)?'':' on'}" aria-label="ほかの色"><input type="color" data-k="${key}" value="${v}"></label></div>`};
const toggle=(key,label)=>`<h4>${label}<button class="tg${get(sel(),key)?' on':''}" data-tg="${key}" aria-label="${label}"></button></h4>`;
const segs=(key,opts)=>`<div class="eseg" data-set="${key}">${opts.map(([v,l])=>`<button data-v="${v}" class="${get(sel(),key)===v?'on':''}">${l}</button>`).join('')}</div>`;

let fontIO;
function panel(){
  const L=sel(),b=$('#ebody');
  if(tab==='写真'){
    b.innerHTML=`<div class="eseg wide" data-ratio>${RATIOS.map(([n])=>`<button data-v="${n}" class="${E.ratio===n?'on':''}">${n}</button>`).join('')}</div>
      <p class="enote">写真をドラッグで位置、2本指（パソコンはホイール）で拡大できます。</p>
      <label class="erow"><span class="el">拡大</span><input type="range" data-photo min="1" max="4" step=".01" value="${E.photo.s}"></label>
      <div class="ebtns"><button class="eb" id="ephoto">写真を変える</button></div>`;
    return;
  }
  if(!L){
    b.innerHTML=`<p class="enote">文字をタップすると、ここで調整できます。</p><div class="ebtns"><button class="eb dark" data-act="add">＋ 文字を追加</button></div>`;
    return;
  }
  if(tab==='文字'){
    b.innerHTML=`<textarea class="etext" id="etxt" rows="2" aria-label="文字">${L.text.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</textarea>
      <div class="ebtns"><button class="eb" data-act="add">＋ 追加</button><button class="eb" data-act="dup">複製</button><button class="eb" data-act="front">前へ</button><button class="eb" data-act="back">後ろへ</button><button class="eb" data-act="del">削除</button></div>
      <div class="erow">${segs('align',[['left','左'],['center','中'],['right','右']])}${segs('vertical',[[false,'横書き'],[true,'縦書き']])}</div>
      ${slider('大きさ','size',12,600,1,FMT.size)}${slider('文字間','ls',-10,80,1,FMT.ls)}${slider('行間','lh',.8,2.6,.01,FMT.lh)}`;
  }else if(tab==='書体'){
    const list=fontLang==='ja'?JA:EN;
    b.innerHTML=`<div class="eseg" data-lang><button data-v="ja" class="${fontLang==='ja'?'on':''}">日本語</button><button data-v="en" class="${fontLang==='en'?'on':''}">English</button></div>
      <div class="fontgrid">${list.map((f,i)=>`<button class="fbtn${f[1]===L.fam?' on':''}" data-f="${i}"><span style='font-family:${f[1]},sans-serif;font-weight:${f[4]}'>${f[0]}</span></button>`).join('')}</div>`;
    fontIO?.disconnect();fontIO=new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting){fontIO.unobserve(x.target);const f=list[+x.target.dataset.f];document.fonts.load(`${f[4]} 16px ${f[1]}`,f[0]).then(()=>x.target.classList.add('ready'))}}),{root:b});
    b.querySelectorAll('.fbtn').forEach(x=>fontIO.observe(x));
  }else if(tab==='色'){
    b.innerHTML=`<div class="sec"><h4>文字の色</h4>${pal('color')}</div>${slider('透明度','opacity',.1,1,.01,FMT.opacity)}`;
  }else if(tab==='飾り'){
    b.innerHTML=`<div class="sec">${toggle('stroke.on','縁取り')}${L.stroke.on?pal('stroke.color')+slider('太さ','stroke.w',1,30,.5,v=>Math.round(v)):''}</div>
      <div class="sec">${toggle('shadow.on','影')}${L.shadow.on?pal('shadow.color')+slider('濃さ','shadow.a',.05,1,.01,FMT['shadow.a'])+slider('ぼかし','shadow.blur',0,100,1,v=>Math.round(v))+slider('横','shadow.x',-30,30,1,v=>v)+slider('縦','shadow.y',-30,30,1,v=>v):''}</div>
      <div class="sec">${toggle('band.on','文字の後ろの帯')}${L.band.on?pal('band.color')+slider('濃さ','band.a',.05,1,.01,FMT['band.a'])+slider('余白','band.pad',0,120,1,v=>Math.round(v))+slider('角丸','band.r',0,100,1,v=>Math.round(v)):''}</div>`;
  }
}
const b=$('#ebody');
b.addEventListener('input',e=>{
  const L=sel(),t=e.target;
  if(t.id==='etxt'){L.text=t.value;refresh();clearTimeout(textTimer);textTimer=setTimeout(commit,600);return}
  if(t.dataset.photo!=null){E.photo.s=+t.value;paint();return}
  if(!L||!t.dataset.k)return;
  put(L,t.dataset.k,t.type==='color'?t.value:+t.value);
  const v=b.querySelector(`[data-v="${t.dataset.k}"]`);if(v)v.textContent=(FMT[t.dataset.k]||(x=>Math.round(x)))(+t.value);
  if(t.type==='color'){const p=t.closest('.pal');p.querySelectorAll('button').forEach(x=>x.classList.remove('on'));t.parentElement.classList.add('on')}
  paint();
});
b.addEventListener('change',e=>{if(e.target.id!=='etxt')commit()});
b.addEventListener('click',e=>{
  const L=sel(),t=e.target.closest('button');if(!t)return;
  if(t.id==='ephoto'){$('#efile').click();return}
  const act=t.dataset.act;
  if(act==='add'){const base=L||{};const n=newLayer({text:'テキスト',fam:base.fam||'"Zen Maru Gothic"',w:base.w||500,name:base.name||'Zen Maru Gothic',color:base.color||'#ffffff',y:E.H*(L?.72:.5)});E.layers.push(n);E.sel=n.id;setTab('文字');commit();refresh();setTimeout(()=>{const a=$('#etxt');a?.focus();a?.select()},50);return}
  if(act==='dup'&&L){const n=Object.assign(clone(L),{id:uid++,x:L.x+E.W*.04,y:L.y+E.W*.04});E.layers.push(n);E.sel=n.id;commit();panel();refresh();return}
  if(act==='del'&&L){E.layers=E.layers.filter(x=>x!==L);E.sel=null;commit();panel();paint();return}
  if(act==='front'&&L){const i=E.layers.indexOf(L);if(i<E.layers.length-1){E.layers.splice(i,1);E.layers.splice(i+1,0,L);commit();paint()}return}
  if(act==='back'&&L){const i=E.layers.indexOf(L);if(i>0){E.layers.splice(i,1);E.layers.splice(i-1,0,L);commit();paint()}return}
  const r=t.closest('[data-ratio]');if(r){setRatio(t.dataset.v);commit();panel();return}
  const lg=t.closest('[data-lang]');if(lg){fontLang=t.dataset.v;panel();return}
  if(!L)return;
  if(t.dataset.tg){put(L,t.dataset.tg,!get(L,t.dataset.tg));commit();panel();paint();return}
  const sg=t.closest('[data-set]');if(sg){const key=sg.dataset.set;put(L,key,t.dataset.v==='true'?true:t.dataset.v==='false'?false:t.dataset.v);commit();panel();refresh();return}
  const p=t.closest('.pal');if(p&&t.dataset.c){put(L,p.dataset.k,t.dataset.c);commit();panel();paint();return}
  if(t.dataset.f!=null){const f=(fontLang==='ja'?JA:EN)[+t.dataset.f];Object.assign(L,{fam:f[1],w:f[4],name:f[0]});b.querySelectorAll('.fbtn').forEach(x=>x.classList.toggle('on',x===t));commit();refresh()}
});

/* ---------- open / close / save ---------- */
window.openEditor=async function(o){
  img=new Image();img.src=o.photo;await img.decode();
  E={ratio:'4:5',W:OUT_W,H:Math.round(OUT_W*5/4),photo:{s:1,ox:0,oy:0},layers:[],sel:null};
  const L=newLayer({text:o.text,fam:o.font[1],w:o.font[4],name:o.font[0],size:o.fsv*.003*OUT_W,x:o.tx*E.W,y:o.ty*E.H,vertical:o.vertical,
    color:o.light?'#ffffff':'#4b3f3a',shadow:{on:o.light,color:'#28190f',a:.35,x:0,y:3,blur:30}});
  E.layers.push(L);E.sel=L.id;hist=[];redo=[];
  sizeCanvas();$('#editor').hidden=false;document.body.style.overflow='hidden';setTab('文字');
  await ensureFonts();draw(ctx,true);commit();
};
function close(){$('#editor').hidden=true;document.body.style.overflow='';E=null}
$('#eback').onclick=()=>{if(hist.length>1&&!confirm('編集中の内容は消えます。書体の一覧に戻りますか？'))return;close()};
$('#eundo').onclick=undo;$('#eredo').onclick=redoIt;
document.addEventListener('keydown',e=>{
  if(!E||$('#editor').hidden)return;
  const typing=/TEXTAREA|INPUT/.test(document.activeElement?.tagName);
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!typing){e.preventDefault();e.shiftKey?redoIt():undo()}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'&&!typing){e.preventDefault();redoIt()}
  else if((e.key==='Delete'||e.key==='Backspace')&&!typing&&sel()){E.layers=E.layers.filter(x=>x!==sel());E.sel=null;commit();panel();paint()}
});
$('#efile').addEventListener('change',async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  try{const url=await loadPhoto(f);img=new Image();img.src=url;await img.decode();E.photo={s:1,ox:0,oy:0};if(E.ratio==='元の比率')setRatio('元の比率');commit();refresh();window.dispatchEvent(new CustomEvent('piclea:photo',{detail:url}))}
  catch{alert('この画像は読み込めませんでした')}
});

// Saving: render off screen with no selection marks, show the result, then hand the file to the share sheet
// from a fresh tap (iOS only opens it on a direct user gesture).
let saved=null;
$('#esave').onclick=async()=>{
  const btn=$('#esave');btn.disabled=true;
  try{
    await ensureFonts();
    const off=document.createElement('canvas');off.width=E.W;off.height=E.H;draw(off.getContext('2d'),false);
    const blob=await new Promise(r=>off.toBlob(r,'image/jpeg',.92));
    const name=`piclea-${new Date().toISOString().slice(0,19).replace(/\D/g,'')}.jpg`;
    if(saved)URL.revokeObjectURL(saved.url);
    saved={file:new File([blob],name,{type:'image/jpeg'}),url:URL.createObjectURL(blob)};
    $('#sprev').src=saved.url;$('#ssize').textContent=`${E.W} × ${E.H}`;
    const share=navigator.canShare?.({files:[saved.file]});
    $('#sshare').textContent=share?'写真に保存・共有':'画像をダウンロード';
    $('#ssheet').hidden=false;
  }finally{btn.disabled=false}
};
$('#sshare').onclick=()=>{
  if(!saved)return;
  if(navigator.canShare?.({files:[saved.file]}))navigator.share({files:[saved.file]}).catch(()=>{});
  else{const a=document.createElement('a');a.href=saved.url;a.download=saved.file.name;a.click()}
};
document.querySelectorAll('[data-sclose]').forEach(x=>x.onclick=()=>$('#ssheet').hidden=true);
addEventListener('resize',()=>E&&paint());
})();
