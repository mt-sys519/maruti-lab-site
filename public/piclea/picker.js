// PICLEA's own colour picker, the same on every phone: a square for how vivid and how bright, a strip for the
// hue and the colour code. The phone's own picker never opens (the colour input is hidden). Under the main
// colour of a thing (a text's or shape's colour, several at once, the background) it is always open; under the
// others (rim, band, shadow…) the rainbow swatch opens it. Colours made here are remembered (マイカラー) and sit
// after the ready ones in every palette.
// It drives the palette's hidden <input type="color" class="cval"> with input/change events, so whatever
// listens to that input just works.
(()=>{
const hex2hsv=h=>{
  const n=parseInt(h.slice(1),16),r=(n>>16&255)/255,g=(n>>8&255)/255,b=(n&255)/255,mx=Math.max(r,g,b),d=mx-Math.min(r,g,b);
  let H=0;if(d)H=mx===r?((g-b)/d+6)%6:mx===g?(b-r)/d+2:(r-g)/d+4;
  return {h:H*60,s:mx?d/mx:0,v:mx};
};
const hsv2hex=({h,s,v})=>{
  const f=k=>{const t=(k+h/60)%6;return v-v*s*Math.max(0,Math.min(t,4-t,1))};
  return '#'+[f(5),f(3),f(1)].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('');
};
const clamp=x=>Math.max(0,Math.min(1,x));

/* マイカラー: kept in this browser only, newest first */
const KEY='piclea.myColors',MAX=10;
let mine=(()=>{try{const a=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(a)?a.filter(c=>/^#[0-9a-f]{6}$/.test(c)).slice(0,MAX):[]}catch{return []}})();
const keep=()=>{try{localStorage.setItem(KEY,JSON.stringify(mine))}catch{}};
const ready=pal=>new Set([...pal.querySelectorAll('[data-c]:not(.mine)')].map(b=>b.dataset.c.toLowerCase()));
const main=pal=>pal.dataset.k==='color'||pal.matches('[data-mc],[data-bgc],#cpal');
function dress(pal){
  pal.querySelectorAll('.mine,.pal-gap,.custom').forEach(x=>x.remove());
  const rs=ready(pal),v=pal.querySelector('.cval').value.toLowerCase(),list=mine.filter(c=>!rs.has(c));
  let h=list.length?'<i class="pal-gap"></i>'+list.map(c=>`<button class="mine${c===v?' on':''}" style="--c:${c}" data-c="${c}" aria-label="マイカラー ${c}"></button>`).join(''):'';
  if(!main(pal))h+=`<button class="custom${pal.nextElementSibling?.classList.contains('cpk')?' on':''}" aria-label="ほかの色を選ぶ"></button>`;
  pal.insertAdjacentHTML('beforeend',h);
}
// one picker's colour goes into マイカラー once, however many times it is dragged about
function remember(el,x){
  if(ready(el.previousElementSibling).has(x))return;
  mine=[x,...mine.filter(c=>c!==x&&c!==el._kept)].slice(0,MAX);el._kept=x;keep();
  document.querySelectorAll('.pal').forEach(p=>{if(p.querySelector('.cval'))dress(p)});
}

function open(pal){
  const inp=()=>pal.querySelector('.cval'); // looked up each time: a palette may be redrawn under us
  const el=document.createElement('div');el.className='cpk';
  el.innerHTML=`<div class="cpk-sv"><i></i></div><div class="cpk-row"><div class="cpk-hue"><i></i></div><input class="cpk-hex" maxlength="7" spellcheck="false" autocomplete="off" aria-label="カラーコード"></div>`;
  pal.after(el);
  const sv=el.querySelector('.cpk-sv'),hue=el.querySelector('.cpk-hue'),hex=el.querySelector('.cpk-hex');
  let c=hex2hsv(inp()?.value||'#ffffff'),busy=false;
  const show=()=>{
    const x=hsv2hex(c);
    sv.style.background=`linear-gradient(to top,#000,rgba(0,0,0,0)),linear-gradient(to right,#fff,hsl(${c.h} 100% 50%))`;
    Object.assign(sv.firstChild.style,{left:c.s*100+'%',top:(1-c.v)*100+'%',background:x});
    Object.assign(hue.firstChild.style,{left:c.h/360*100+'%',background:`hsl(${c.h} 100% 50%)`});
    if(document.activeElement!==hex)hex.value=x;
    return x;
  };
  const send=type=>{const i=inp();if(!i)return;const x=show();i.value=x;i.dispatchEvent(new Event(type,{bubbles:true}));if(type==='change')remember(el,x)};
  const drag=(area,set)=>{
    area.addEventListener('pointerdown',e=>{
      e.preventDefault();busy=true;try{area.setPointerCapture(e.pointerId)}catch{}
      const at=e=>{const r=area.getBoundingClientRect();set(clamp((e.clientX-r.left)/r.width),clamp((e.clientY-r.top)/r.height));send('input')};
      at(e);
      const mv=e=>at(e),up=()=>{area.removeEventListener('pointermove',mv);area.removeEventListener('pointerup',up);area.removeEventListener('pointercancel',up);busy=false;send('change')};
      area.addEventListener('pointermove',mv);area.addEventListener('pointerup',up);area.addEventListener('pointercancel',up);
    });
  };
  drag(sv,(x,y)=>{c.s=x;c.v=1-y});
  drag(hue,x=>{c.h=Math.min(359.9,x*360);if(!c.s&&!c.v)c.v=1;if(!c.s)c.s=1}); // from white or black, a hue alone would show nothing
  hex.addEventListener('change',()=>{const v=hex.value.trim().replace(/^#?/,'#');if(/^#[0-9a-f]{6}$/i.test(v)){c=hex2hsv(v.toLowerCase());send('input');send('change')}else show()});
  hex.addEventListener('keydown',e=>{if(e.key==='Enter')hex.blur()});
  el._sync=()=>{const i=inp();if(!busy&&i&&i.value.toLowerCase()!==hsv2hex(c)){c=hex2hsv(i.value.toLowerCase());show()}};
  show();return el;
}

// Palettes come and go as the panels redraw: dress each new one, open the picker under a main colour,
// and keep an open picker in step when a ready colour is tapped.
function settle(pal){
  if(!pal.querySelector('.cval'))return;
  const k=pal.nextElementSibling?.classList.contains('cpk')?pal.nextElementSibling:null;
  if(k)k._sync();else if(main(pal))open(pal);
  dress(pal);
}
const ours=n=>n.nodeType!==1||n.matches('.mine,.pal-gap,.custom,.cpk');
new MutationObserver(ms=>{
  const pals=new Set();
  for(const m of ms)for(const n of m.addedNodes){
    if(ours(n))continue;
    if(n.matches('.pal'))pals.add(n);else n.querySelectorAll('.pal').forEach(p=>pals.add(p));
    const p=n.closest('.pal');if(p)pals.add(p);
  }
  pals.forEach(settle);
}).observe(document.body,{childList:true,subtree:true});
document.querySelectorAll('.pal').forEach(settle);

document.addEventListener('click',e=>{
  const sw=e.target.closest('.pal [data-c]');
  if(sw){const p=sw.closest('.pal'),n=p.nextElementSibling;if(n?.classList.contains('cpk')&&!main(p)){n.remove();dress(p)}return} // a ready colour: a side picker is done
  const b=e.target.closest('.pal .custom');if(!b)return;
  const pal=b.closest('.pal'),cur=pal.nextElementSibling;
  if(cur?.classList.contains('cpk'))cur.remove();else open(pal).scrollIntoView({block:'nearest',behavior:'smooth'});
  dress(pal);
});
})();
