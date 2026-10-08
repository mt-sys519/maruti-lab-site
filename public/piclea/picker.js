// The rainbow swatch at the end of every palette opens a colour picker right under it, as in Canva:
// a square for how vivid and how bright, a strip for the hue, and the colour code. Instead of the
// phone's own picker. It drives the swatch's hidden <input type="color"> with input/change events,
// so whatever listens to that input (texts, shapes, the background, several at once) just works.
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

function open(pal){
  const inp=()=>pal.querySelector('.custom input'); // looked up each time: a palette may be redrawn under us
  const el=document.createElement('div');el.className='cpk';
  el.innerHTML=`<div class="cpk-sv"><i></i></div><div class="cpk-hue"><i></i></div>
    <div class="cpk-row"><span class="cpk-sw"></span><input class="cpk-hex" maxlength="7" spellcheck="false" autocomplete="off" aria-label="カラーコード"></div>`;
  pal.after(el);
  const sv=el.querySelector('.cpk-sv'),hue=el.querySelector('.cpk-hue'),hex=el.querySelector('.cpk-hex'),sw=el.querySelector('.cpk-sw');
  let c=hex2hsv(inp()?.value||'#ffffff');
  const show=()=>{
    const x=hsv2hex(c);
    sv.style.background=`linear-gradient(to top,#000,rgba(0,0,0,0)),linear-gradient(to right,#fff,hsl(${c.h} 100% 50%))`;
    Object.assign(sv.firstChild.style,{left:c.s*100+'%',top:(1-c.v)*100+'%',background:x});
    Object.assign(hue.firstChild.style,{left:c.h/360*100+'%',background:`hsl(${c.h} 100% 50%)`});
    sw.style.background=x;if(document.activeElement!==hex)hex.value=x;
    return x;
  };
  const send=type=>{const i=inp();if(!i)return;i.value=show();i.dispatchEvent(new Event(type,{bubbles:true}))};
  const drag=(area,set)=>{
    area.addEventListener('pointerdown',e=>{
      e.preventDefault();try{area.setPointerCapture(e.pointerId)}catch{}
      const at=e=>{const r=area.getBoundingClientRect();set(clamp((e.clientX-r.left)/r.width),clamp((e.clientY-r.top)/r.height));send('input')};
      at(e);
      const mv=e=>at(e),up=()=>{area.removeEventListener('pointermove',mv);area.removeEventListener('pointerup',up);area.removeEventListener('pointercancel',up);send('change')};
      area.addEventListener('pointermove',mv);area.addEventListener('pointerup',up);area.addEventListener('pointercancel',up);
    });
  };
  drag(sv,(x,y)=>{c.s=x;c.v=1-y});
  drag(hue,x=>{c.h=Math.min(359.9,x*360);if(!c.s&&!c.v)c.v=1;if(!c.s)c.s=1}); // from white or black, a hue alone would show nothing
  hex.addEventListener('change',()=>{const v=hex.value.trim().replace(/^#?/,'#');if(/^#[0-9a-f]{6}$/i.test(v)){c=hex2hsv(v.toLowerCase());send('input');send('change')}else show()});
  hex.addEventListener('keydown',e=>{if(e.key==='Enter')hex.blur()});
  show();
}
// Capture, so the phone's own picker never opens; a second tap closes ours.
document.addEventListener('click',e=>{
  const sw=e.target.closest('.pal [data-c]');if(sw){const n=sw.closest('.pal').nextElementSibling;if(n?.classList.contains('cpk'))n.remove();return} // a ready colour: the picker is done
  const lab=e.target.closest('.pal .custom');if(!lab)return;
  e.preventDefault();e.stopPropagation();
  const pal=lab.closest('.pal'),cur=pal.nextElementSibling;
  if(cur?.classList.contains('cpk'))cur.remove();else open(pal);
},true);
})();
