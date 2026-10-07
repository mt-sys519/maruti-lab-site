(() => {
'use strict';
const $=id=>document.getElementById(id), TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), lerp=(a,b,t)=>a+(b-a)*t;
const canvas=$('game'),ctx=canvas.getContext('2d',{alpha:false});
const boot=$('boot'),hud=$('hud'),video=$('webcam');
let W=1280,H=720,DPR=1;
function resize(){DPR=Math.min(devicePixelRatio||1,1.35);W=innerWidth;H=innerHeight;canvas.width=Math.floor(W*DPR);canvas.height=Math.floor(H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0)}
addEventListener('resize',resize);resize();

// ---------- AUDIO ----------
// v31 sound design: full replacement of the v21-v30 synth layer.
// One musical clock owns the soundtrack bed and the tonal tails of reward voices
// (hit notes, HMD designations, frame breaks). Rez is a visual reference only:
// nothing on screen pulses, sweeps or steps with the music; the frame rolls on its
// wheels with no stride. Physical feedback (gun report, impacts, damage, landings) is
// immediate so the frame never feels late.
const BPM=126,BEAT=60/BPM,STEP=BEAT/4,BAR=BEAT*4;
// D minor colour: Dm9 / Bbmaj9 / Gm9 / Asus(b7). Every tonal SFX picks from the active chord.
const CHORDS=[[0,3,7,10,14],[-4,0,3,7,10],[-7,-4,0,3,7],[-5,0,2,7,10]];
const ROOT=62,BASS_PAT=[1,0,0,1,0,0,1,0,1,0,0,1,0,0,1,0];
const midiHz=m=>440*Math.pow(2,(m-69)/12);
let ac=null,audioOut=null,master=null,sfxBus=null,musicBus=null,musicDuck=null,reverbIn=null,delayIn=null,crushIn=null,noiseWhite=null,noisePink=null,audioT0=0,voices=0,hullIn=null,hullCrushIn=null,sfxExt=0;
const bed={},music={step:0,next:0,intensity:0,target:0,menu:true,hitIdx:0,hitT:-9,hitGrid:-1,moteGrid:-1,moteIdx:0,flowGrid:-1};
const volume=$('volume'),musicVol=$('musicVol'),mouseSens=$('mouseSens');
function musicLevel(){return clamp(+musicVol.value/100,0,1)*.5}
function softClipCurve(k){const n=2048,c=new Float32Array(n),norm=Math.tanh(k);for(let i=0;i<n;i++){const x=i/(n-1)*2-1;c[i]=Math.tanh(k*x)/norm}return c}
function makeNoise(seconds,pink){
  const n=Math.floor(ac.sampleRate*seconds),buf=ac.createBuffer(1,n,ac.sampleRate),d=buf.getChannelData(0);
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
  for(let i=0;i<n;i++){const w=Math.random()*2-1;if(!pink){d[i]=w;continue}
    b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;
    d[i]=(b0+b1+b2+b3+b4+b5+b6+w*.5362)*.11;b6=w*.115926}
  return buf;
}
function makeImpulse(seconds,decay){
  const n=Math.floor(ac.sampleRate*seconds),buf=ac.createBuffer(2,n,ac.sampleRate);
  for(let ch=0;ch<2;ch++){const d=buf.getChannelData(ch);let y=0;for(let i=0;i<n;i++){const t=i/n,k=.85-.7*t;y+=((Math.random()*2-1)-y)*k;d[i]=y*Math.pow(1-t,decay)*(i<ac.sampleRate*.012?i/(ac.sampleRate*.012):1)}}
  return buf;
}
function ensureAudio(){
  if(ac){if(ac.state==='suspended')ac.resume();return}
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  try{
    ac=new AC({latencyHint:'interactive'});
    master=ac.createGain();master.gain.value=+volume.value/100;
    // Mastering chain: sub cleanup, low-mid de-mud, a little air, glue compression, safety limiter.
    const sub=ac.createBiquadFilter();sub.type='highpass';sub.frequency.value=38;sub.Q.value=.7;
    const mud=ac.createBiquadFilter();mud.type='peaking';mud.frequency.value=280;mud.Q.value=.9;mud.gain.value=-2.5;
    const air=ac.createBiquadFilter();air.type='highshelf';air.frequency.value=8500;air.gain.value=1.5;
    const glue=ac.createDynamicsCompressor();glue.threshold.value=-18;glue.knee.value=10;glue.ratio.value=2.4;glue.attack.value=.008;glue.release.value=.2;
    const limiter=ac.createDynamicsCompressor();limiter.threshold.value=-2.5;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.001;limiter.release.value=.08;
    audioOut=ac.createGain();master.connect(sub).connect(mud).connect(air).connect(glue).connect(limiter).connect(audioOut).connect(ac.destination);
    sfxBus=ac.createGain();sfxBus.gain.value=.92;sfxBus.connect(master);
    musicDuck=ac.createGain();musicDuck.gain.value=1;musicDuck.connect(master);
    musicBus=ac.createGain();musicBus.gain.value=musicLevel();musicBus.connect(musicDuck);
    // Shared soft clip for impacts: weight without raw digital clipping.
    crushIn=ac.createWaveShaper();crushIn.curve=softClipCurve(2.6);crushIn.oversample='2x';const crushOut=ac.createGain();crushOut.gain.value=.62;crushIn.connect(crushOut).connect(sfxBus);
    // The Moon has no air: what happens outside reaches AOI through the frame's legs and hull, so it loses its
    // top and gains a thump (lowpass + low bump). Her own guns, the HMD and the frame's own noises stay clear.
    const hull=(dest)=>{const lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1100;lp.Q.value=.6;const th=ac.createBiquadFilter();th.type='peaking';th.frequency.value=95;th.Q.value=.8;th.gain.value=4;lp.connect(th).connect(dest);return lp};
    hullIn=hull(sfxBus);hullCrushIn=hull(crushIn);
    // Space: generated hall impulse + tempo-locked dotted-eighth ping-pong delay.
    const conv=ac.createConvolver();conv.buffer=makeImpulse(2.8,3.1);reverbIn=ac.createGain();const revOut=ac.createGain();revOut.gain.value=.5;reverbIn.connect(conv).connect(revOut).connect(master);
    delayIn=ac.createGain();const dl=ac.createDelay(2),dr=ac.createDelay(2),fb=ac.createGain(),fb2=ac.createGain(),dtone=ac.createBiquadFilter(),merge=ac.createChannelMerger(2),dOut=ac.createGain();
    dl.delayTime.value=dr.delayTime.value=BEAT*.75;fb.gain.value=.42;fb2.gain.value=.42;dtone.type='lowpass';dtone.frequency.value=3400;dOut.gain.value=.34;
    delayIn.connect(dtone).connect(dl);dl.connect(fb).connect(dr);dr.connect(fb2).connect(dl);dl.connect(merge,0,0);dr.connect(merge,0,1);merge.connect(dOut).connect(master);
    noiseWhite=makeNoise(2,false);noisePink=makeNoise(3,true);
    buildBed();
    audioT0=ac.currentTime+.06;music.step=0;music.next=audioT0;
    if(document.addEventListener)document.addEventListener('visibilitychange',()=>{if(!ac)return;if(document.hidden)ac.suspend();else if(playing)ac.resume()});
  }catch(e){console.warn(e);ac=null}
}
function busOut(node,o){
  let out=node;
  if(o.pan&&ac.createStereoPanner){const p=ac.createStereoPanner();p.pan.value=clamp(o.pan,-1,1);node.connect(p);out=p}
  const ext=sfxExt>0&&!o.bus&&hullIn;
  out.connect(ext?(o.crush?hullCrushIn:hullIn):o.crush?crushIn:(o.bus||sfxBus));
  if(o.rev>0){const s=ac.createGain();s.gain.value=ext?o.rev*.5:o.rev;out.connect(s).connect(reverbIn)}
  if(o.dly>0&&!ext){const s=ac.createGain();s.gain.value=o.dly;out.connect(s).connect(delayIn)}
}
function voiceOK(pri=1){return !!ac&&ac.state==='running'&&(voices<84||pri>1&&voices<128)}
let sfxTrim=1;
function shapeEnv(g,t,o){const a=o.a??.003,hold=o.hold||0,d=o.d??.2;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(Math.max(.00001,o.g*sfxTrim),t+a);g.gain.setTargetAtTime(0,t+a+hold,d/5);return t+a+hold+d*1.25}
// Oscillator voice. f->f2 glide, optional filter sweep, pan, reverb/delay sends.
function tone(o){
  if(!voiceOK(o.pri))return;
  const t=Math.max(ac.currentTime,o.t??ac.currentTime),src=ac.createOscillator(),g=ac.createGain();
  src.type=o.type||'sine';src.frequency.setValueAtTime(Math.max(20,o.f),t);
  if(o.f2)src.frequency.exponentialRampToValueAtTime(Math.max(20,o.f2),t+(o.glide??o.d??.2));
  if(o.detune)src.detune.value=o.detune;
  let node=src;
  if(o.lp){const f=ac.createBiquadFilter();f.type=o.ft||'lowpass';f.Q.value=o.q??.7;f.frequency.setValueAtTime(o.lp,t);if(o.lp2)f.frequency.exponentialRampToValueAtTime(o.lp2,t+(o.fd??o.d??.2));node.connect(f);node=f}
  node.connect(g);busOut(g,o);const end=shapeEnv(g,t,o);
  voices++;src.onended=()=>{voices--;g.disconnect()};src.start(t);src.stop(end);
}
// Filtered noise voice. bp/lp/hp may sweep to bp2/lp2.
function burst(o){
  if(!voiceOK(o.pri))return;
  const t=Math.max(ac.currentTime,o.t??ac.currentTime),src=ac.createBufferSource(),g=ac.createGain(),buf=o.pink?noisePink:noiseWhite;
  src.buffer=buf;src.loop=true;if(o.rate)src.playbackRate.value=o.rate;
  let node=src;
  const filt=(type,f,f2,q)=>{const b=ac.createBiquadFilter();b.type=type;b.Q.value=q;b.frequency.setValueAtTime(f,t);if(f2)b.frequency.exponentialRampToValueAtTime(f2,t+(o.fd??o.d??.2));node.connect(b);node=b};
  if(o.hp)filt('highpass',o.hp,o.hp2,.7);
  if(o.bp)filt('bandpass',o.bp,o.bp2,o.q??1);
  if(o.lp)filt('lowpass',o.lp,o.lp2,.6);
  node.connect(g);busOut(g,o);const end=shapeEnv(g,t,o);
  voices++;src.onended=()=>{voices--;g.disconnect()};src.start(t,Math.random()*(buf.duration-.3));src.stop(end);
}
function buildBed(){
  const loop=buf=>{const s=ac.createBufferSource();s.buffer=buf;s.loop=true;s.start();return s};
  const lfo=(rate,depth,target)=>{const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=rate;g.gain.value=depth;o.connect(g).connect(target);o.start();return o};
  // Reactor: tuned to the soundtrack root so the idle frame never fights the music.
  bed.hum=ac.createGain();bed.hum.gain.value=0;const humF=ac.createBiquadFilter();humF.type='lowpass';humF.frequency.value=520;humF.Q.value=.4;humF.connect(bed.hum).connect(sfxBus);
  const trem=ac.createGain();trem.gain.value=.75;trem.connect(humF);lfo(.55,.22,trem.gain);
  for(const [f,type,g] of [[midiHz(38),'triangle',.9],[midiHz(45),'sine',.45],[midiHz(50),'sawtooth',.07]]){const o=ac.createOscillator(),og=ac.createGain();o.type=type;o.frequency.value=f;og.gain.value=g;o.connect(og).connect(trem);o.start()}
  // Locomotion rumble: pink noise opened by speed.
  bed.drive=ac.createGain();bed.drive.gain.value=0;bed.driveF=ac.createBiquadFilter();bed.driveF.type='lowpass';bed.driveF.frequency.value=140;bed.driveF.Q.value=1.1;
  loop(noisePink).connect(bed.driveF).connect(bed.drive).connect(sfxBus);
  // Gimbal / yaw servo whine: only audible while the chassis or gun is actually slewing.
  bed.servo=ac.createGain();bed.servo.gain.value=0;bed.servoF=ac.createBiquadFilter();bed.servoF.type='bandpass';bed.servoF.Q.value=4.5;bed.servoF.frequency.value=900;bed.servoF.connect(bed.servo).connect(sfxBus);
  bed.servoO=[0,7].map(cents=>{const o=ac.createOscillator();o.type='sawtooth';o.frequency.value=180;o.detune.value=cents;const g=ac.createGain();g.gain.value=.5;o.connect(g).connect(bed.servoF);o.start();return o});
  // Airflow: rises with the square of speed and opens during BURST.
  bed.wind=ac.createGain();bed.wind.gain.value=0;bed.windF=ac.createBiquadFilter();bed.windF.type='bandpass';bed.windF.Q.value=.55;bed.windF.frequency.value=900;
  loop(noiseWhite).connect(bed.windF).connect(bed.wind).connect(sfxBus);
  // Wheel motors (the frame's feet roll, after the key art): a hub-motor whine that rises with ground speed
  // while BURST and its glide are on the wheels, and spins down when the frame is back on its feet.
  bed.motor=ac.createGain();bed.motor.gain.value=0;bed.motorF=ac.createBiquadFilter();bed.motorF.type='bandpass';bed.motorF.Q.value=3.2;bed.motorF.frequency.value=900;bed.motorF.connect(bed.motor).connect(sfxBus);
  // Tyre scrub: rubber dragged sideways when the frame changes direction or turns while it rolls.
  bed.scrub=ac.createGain();bed.scrub.gain.value=0;bed.scrubF=ac.createBiquadFilter();bed.scrubF.type='bandpass';bed.scrubF.Q.value=2.2;bed.scrubF.frequency.value=1700;
  loop(noiseWhite).connect(bed.scrubF).connect(bed.scrub).connect(sfxBus);
  bed.motorO=[['square',0,.35],['sawtooth',-1200,.5]].map(([type,cents,g0])=>{const o=ac.createOscillator();o.type=type;o.frequency.value=220;o.detune.value=cents;const g=ac.createGain();g.gain.value=g0;o.connect(g).connect(bed.motorF);o.start();return o});
}
function updateEngine(speed,boosting,syncing=false,turnRate=0,gimbalLoad=0,rolling=false,scrub=0){
  if(!ac||!bed.hum)return;
  const t=ac.currentTime,on=playing&&player.alive?1:0,v=clamp(speed/62,0,1.2),turn=clamp(Math.abs(turnRate)/.92,0,1),gim=clamp(Math.abs(gimbalLoad)/.55,0,1);
  bed.hum.gain.setTargetAtTime(on*(.022+v*.010+(boosting?.014:0)+(syncing?.008:0)),t,.15);
  bed.drive.gain.setTargetAtTime(on*(v*.12+(boosting?.10:0)),t,.08);
  bed.driveF.frequency.setTargetAtTime(110+speed*6+(boosting?320:0),t,.08);
  bed.servo.gain.setTargetAtTime(on*(turn*.022+gim*.016),t,.05);
  const sf=150+turn*170+gim*140;for(const o of bed.servoO)o.frequency.setTargetAtTime(sf,t,.07);bed.servoF.frequency.setTargetAtTime(sf*4.2,t,.07);
  bed.wind.gain.setTargetAtTime(on*Math.min(.085,v*v*.05+(boosting?.05:0)),t,.10);
  bed.windF.frequency.setTargetAtTime(700+speed*32+(boosting?1100:0),t,.12);
  if(bed.scrub){bed.scrub.gain.setTargetAtTime(on*(rolling?Math.min(.07,scrub*.07):0),t,.04);bed.scrubF.frequency.setTargetAtTime(1500+scrub*700,t,.05)}
  if(bed.motor){bed.motor.gain.setTargetAtTime(on*(rolling?(boosting?.06:.018+Math.min(1,v)*.05):0),t,rolling?.05:.22);
    const mf=rolling?240+speed*15:140;for(const o of bed.motorO)o.frequency.setTargetAtTime(mf,t,rolling?.06:.35);bed.motorF.frequency.setTargetAtTime(mf*2.6,t,.08)}
}
// Music clock ------------------------------------------------------------------
function chordAt(step){return CHORDS[Math.floor(step/32)%CHORDS.length]}
function nextGrid(stepsPer=1,lead=.012){const k=Math.ceil((ac.currentTime+lead-audioT0)/(STEP*stepsPer))*stepsPer;return{t:audioT0+k*STEP,step:k}}
function musicClock(){return ac&&ac.state==='running'?ac.currentTime-(ac.outputLatency||ac.baseLatency||0)-audioT0:gameTime}
function beatInfo(){const b=musicClock()/BEAT,f=b-Math.floor(b),bar=b/4,bf=bar-Math.floor(bar);return{b,f,pulse:Math.exp(-f*5.5),bar:bf,barPulse:Math.exp(-bf*3.4),barIndex:Math.floor(bar)}}
function audioTick(dt){
  if(!ac||ac.state!=='running')return;
  music.intensity=lerp(music.intensity,music.target,1-Math.exp(-1.6*dt));
  if(music.menu!==music.duckMenu){music.duckMenu=music.menu;musicDuck.gain.cancelScheduledValues(ac.currentTime);musicDuck.gain.setTargetAtTime(music.menu?.42:1,ac.currentTime,.4)}
  if(music.next<ac.currentTime-.03){music.step=Math.ceil((ac.currentTime-audioT0)/STEP);music.next=audioT0+music.step*STEP}
  const ahead=ac.currentTime+.13;while(music.next<ahead){scheduleStep(music.step,music.next);music.step++;music.next+=STEP}
}
function scheduleStep(s,t){
  const I=music.intensity,inBar=s%16,ch=chordAt(s),M=musicBus;
  if(s%32===0)for(let i=0;i<4;i++)for(const cents of [-7,7])tone({t,f:midiHz(ROOT-12+ch[i]),type:'sawtooth',detune:cents,a:.9,hold:BAR*2-.9,d:1.8,g:.0105,lp:900+I*900,q:.4,bus:M,rev:.45,pri:2});
  if(music.menu)return;
  if(s%32===0)tone({t,f:midiHz(ROOT-24+ch[0]),type:'sine',a:.6,hold:BAR*2-.6,d:1.2,g:.05,bus:M,pri:2});
  if(I>.16&&inBar%4===0){const k=inBar===0?1:.85;tone({t,f:150,f2:44,glide:.11,d:.34,g:.36*k,bus:M,pri:2});burst({t,hp:2500,d:.012,g:.045*k,bus:M,pri:2})}
  if(I>.38&&inBar%4===2)burst({t,hp:7200,d:.045,g:.050,pan:.18,bus:M});
  if(I>.68&&inBar%2===1)burst({t,hp:8200,d:.025,g:.018+.012*(inBar%4===3),pan:-.22,bus:M});
  if(I>.55&&(inBar===4||inBar===12))for(let k=0;k<3;k++)burst({t:t+k*.011,bp:1500,q:1.1,d:k===2?.16:.03,g:.065,bus:M,rev:.18});
  if(I>.30&&BASS_PAT[inBar]){const f=midiHz(ROOT-24+ch[0]+(inBar===14?7:0));tone({t,f,type:'sawtooth',d:.2,g:.075,lp:1100+I*500,lp2:170,fd:.14,q:3,bus:M});tone({t,f:f/2,d:.18,g:.07,bus:M})}
  if(player.syncTime>0||I>.92){const n=ch[(s*3)%ch.length]+12*((s>>2)%2);tone({t,f:midiHz(ROOT+n),type:'triangle',d:.13,g:.028,bus:M,dly:.30,pan:(s%2?.35:-.35)})}
}
function spatial(x,z){return{pan:worldPan(x,z),g:clamp(1.15-Math.hypot(x-player.x,z-player.z)/115,.22,1)}}
function duckMusic(depth=.5,recover=.45){if(!ac)return;const t=ac.currentTime,g=musicDuck.gain;g.cancelScheduledValues(t);g.setValueAtTime(g.value,t);g.linearRampToValueAtTime(depth,t+.02);g.setTargetAtTime(music.menu?.42:1,t+.05,recover/3)}
// Per-class frame-break voice. boom: [from Hz, to Hz, glide s, gain]; blast: [lowpass Hz, length s, gain];
// snap: [band Hz, Q, gain]; ring: struck-metal partials [Hz, gain, decay s] bending down by `bend`;
// groan: [from Hz, to Hz, length s, gain] of the structure folding; cook: secondary explosions.
const KILL_VOICE={
  SCOUT:{boom:[190,64,.22,.38],blast:[4200,.38,.26],snap:[4200,5,.16],glass:8,ring:[[2140,.016,.5],[3420,.012,.42],[5810,.008,.3]],bend:.9,groan:null,cook:0},
  LANCER:{boom:[150,50,.32,.52],blast:[2800,.55,.34],snap:[1300,3,.2],glass:6,ring:[[410,.03,.8],[1130,.02,.65],[2380,.012,.5]],bend:.82,groan:[180,70,.6,.018],cook:0},
  TITAN:{boom:[90,42,.75,.7],blast:[1500,1.15,.46],snap:[520,1.4,.2],glass:4,ring:[[150,.035,1.6],[410,.026,1.3],[1030,.014,1]],bend:.74,groan:[100,48,1.6,.036],cook:5},
  KITE:{boom:[170,58,.28,.42],blast:[3600,.5,.3],snap:[3000,4,.18],glass:7,ring:[[1500,.018,.6],[2650,.012,.5],[4400,.008,.36]],bend:.86,groan:null,cook:0},
  HEAVY:{boom:[110,42,.55,.62],blast:[1800,.9,.4],snap:[700,1.6,.18],glass:4,ring:[[190,.03,1.2],[505,.022,1],[1270,.012,.8]],bend:.78,groan:[120,55,1.1,.03],cook:3}
};
const sfx={
  // 30mm: transient click, cracking report, chest thump, short tail. Immediate, never quantised.
  fire(linked=false){if(!ac)return;const r=.96+Math.random()*.08;
    burst({hp:3200,d:.014,g:.20,pri:2});burst({bp:2400*r,bp2:900,q:.9,d:.075,g:.25,pri:2});
    tone({f:170*r,f2:50,glide:.07,d:.15,g:.34,crush:true,pri:2});burst({pink:true,lp:1100,lp2:260,d:.24,g:.06,rev:.06});
    tone({f:96*r,type:'square',d:.035,g:.018,lp:700,t:ac.currentTime+.035});
    if(linked){const ch=chordAt(music.step);tone({f:midiHz(ROOT+24+ch[Math.floor(Math.random()*ch.length)]),type:'triangle',d:.06,g:.014,dly:.12})}},
  // Hit: tight metallic tick now, then an ascending chord note on the next 16th (Rez).
  hit(pan=0){if(!ac)return;burst({bp:3400,q:2.4,d:.03,g:.055,hp:1200,pan});
    const now=ac.currentTime;if(now-music.hitT>.85)music.hitIdx=0;music.hitT=now;
    const g=nextGrid(1);if(g.step===music.hitGrid)return;music.hitGrid=g.step;
    const ch=chordAt(g.step),i=music.hitIdx++%(ch.length*2),f=midiHz(ROOT+ch[i%ch.length]+12*Math.floor(i/ch.length));
    tone({t:g.t,f,type:'triangle',d:.17,g:.05,dly:.16,rev:.08,pan:pan*.6});tone({t:g.t,f:f*2,d:.07,g:.016,pan:pan*.6})},
  // Frame break: physical crunch + glass shatter immediately, quantised chord stab and run.
  // The physical layer is the machine's own (KILL_VOICE): VANE's thin blade snaps and rings high,
  // PIKE's lance cracks and its armour clangs, BASTION booms, groans and cooks off its rounds.
  kill(pan=0,type='LANCER'){if(!ac)return;const now=ac.currentTime,K=KILL_VOICE[type]||KILL_VOICE.LANCER,sp=()=>clamp(pan+(Math.random()-.5)*.9,-1,1);
    tone({f:K.boom[0],f2:K.boom[1],glide:K.boom[2],d:K.boom[2]*1.8,g:K.boom[3],crush:true,pri:3});burst({pink:true,lp:K.blast[0],lp2:180,fd:K.blast[1]*.75,d:K.blast[1],g:K.blast[2],crush:true,pri:3,pan:pan*.5});
    burst({bp:K.snap[0],q:K.snap[1],d:.03,g:K.snap[2],pan,pri:3});tone({f:K.snap[0]*.18,type:'square',d:.03,g:K.snap[2]*.3,lp:K.snap[0],pan,pri:3});
    for(let i=0;i<K.glass;i++)burst({t:now+Math.random()*.14,bp:2600+Math.random()*5200,q:7,d:.05+Math.random()*.16,g:.035+Math.random()*.03,pan:sp(),rev:.2,pri:2});
    // Struck metal: inharmonic partials that bend down as the structure gives way.
    for(const [f,g,d] of K.ring)tone({t:now+.01,f:f*(.96+Math.random()*.08),f2:f*K.bend,glide:d,d,g,rev:.4,pan:pan*.5,pri:2});
    if(K.groan)tone({t:now+.08,f:K.groan[0],f2:K.groan[1],glide:K.groan[2],type:'sawtooth',a:.06,d:K.groan[2],g:K.groan[3],lp:700,lp2:220,fd:K.groan[2],q:4,pan:pan*.6,rev:.25,pri:2});
    // Secondary explosions: stored rounds / cells cooking off after the break.
    for(let i=0;i<K.cook;i++){const t=now+.16+i*.17+Math.random()*.14,p=sp();tone({t,f:120,f2:46,glide:.2,d:.32,g:.2,crush:true,pan:p,pri:2});burst({t,pink:true,lp:2400,lp2:300,fd:.25,d:.3,g:.12,crush:true,pan:p,rev:.15,pri:2});burst({t,hp:3000,d:.02,g:.05,pan:p,pri:2})}
    const g=nextGrid(2),ch=chordAt(g.step);
    for(let i=0;i<4;i++)tone({t:g.t,f:midiHz(ROOT+ch[i]),type:'sawtooth',d:.55,g:.026,lp:4200,lp2:520,fd:.4,dly:.32,rev:.35,pri:3});
    tone({t:g.t,f:midiHz(ROOT-24+ch[0]),f2:midiHz(ROOT-36+ch[0]),glide:.3,d:.45,g:.20,pri:3});
    for(let i=0;i<5;i++)tone({t:g.t+STEP*(i+1)*.5,f:midiHz(ROOT+12+ch[i%ch.length]+(i>=ch.length?12:0)),type:'triangle',d:.12,g:.03,dly:.25,pan:(i%2?.4:-.4),pri:2});
    duckMusic(.55,.5)},
  // A broken component hitting the deck: thud for its mass, a clang pitched by its size, grit.
  // Thin glow parts land as a glassy tick instead.
  debrisLand(pan=0,g=1,size=1,mat='armor',speed=6){if(!ac)return;const k=clamp(speed/9,.3,1)*g,r=.94+Math.random()*.12,f0=clamp(900/(.6+size*1.6),140,1200)*r;
    if(mat==='glow'){burst({bp:5200*r,q:6,d:.05,g:.05*k,pan});tone({f:3100*r,d:.18,g:.012*k,pan,rev:.2});return}
    tone({f:clamp(150-size*25,62,140)*r,f2:46,glide:.08,d:.18,g:.22*k,crush:true,pan});burst({bp:f0*2.2,q:1.4,d:.05,g:.07*k,pan});
    const metal=mat==='armor'?1:.45;for(const [m,gg] of [[1,.03],[2.76,.018],[5.4,.009]])tone({f:f0*m,d:.12+size*.12,g:gg*k*metal,pan,rev:.15});
    burst({t:ac.currentTime+.03,hp:2600,d:.09,g:.02*k,pan})},
  // A component burning down into shards: short electric fizz and crackle.
  debrisBurn(pan=0,g=1){if(!ac)return;const now=ac.currentTime;burst({hp:3800,lp:9000,d:.16,g:.035*g,pan,rev:.2});for(let i=0;i<3;i++)burst({t:now+Math.random()*.12,bp:1800+Math.random()*3000,q:9,d:.02,g:.04*g,pan})},
  explode(pan=0,gain=1){if(!ac)return;tone({f:120,f2:46,glide:.3,d:.5,g:.42*gain,crush:true,pri:2});burst({pink:true,lp:2200,lp2:200,fd:.4,d:.5,g:.26*gain,crush:true,pan});
    for(let i=0;i<3;i++)burst({t:ac.currentTime+Math.random()*.08,bp:3000+Math.random()*3000,q:6,d:.08,g:.03*gain,pan,rev:.15})},
  snipe(){if(!ac)return;const r=.97+Math.random()*.06;
    burst({hp:4200,d:.012,g:.26,pri:3});burst({bp:1900*r,bp2:600,q:.8,d:.12,g:.32,pri:3});
    tone({f:120*r,f2:38,glide:.16,d:.32,g:.5,crush:true,pri:3});burst({pink:true,lp:1600,lp2:200,fd:.9,d:1.1,g:.09,rev:.35,dly:.12});
    burst({t:ac.currentTime+.28,bp:3200,q:5,d:.035,g:.05});burst({t:ac.currentTime+.5,bp:2400,q:4,d:.05,g:.05})},
  // BURST on the ground is the wheels: the hub motors scream up while the tyres spin and squeal, then bite.
  boost(){if(!ac)return;const now=ac.currentTime;
    tone({type:'sawtooth',f:180,f2:760,glide:.22,a:.01,d:.42,g:.05,lp:2400,pri:3});tone({type:'square',f:90,f2:380,glide:.22,a:.01,d:.38,g:.03,lp:1400});
    burst({bp:2300,bp2:1700,fd:.3,q:6,a:.01,d:.34,g:.13,pri:3});burst({bp:3100,bp2:2400,fd:.25,q:9,a:.02,d:.26,g:.06});
    burst({lp:420,lp2:180,fd:.3,d:.36,g:.2})},
  bite(){if(!ac)return;tone({f:88,f2:44,glide:.12,d:.24,g:.36,crush:true,pri:3});burst({pink:true,lp:1600,lp2:300,fd:.25,d:.3,g:.18})},
  // BURST in the air is the backpack: a jet that keeps pushing.
  jet(){if(!ac)return;tone({f:92,f2:50,glide:.2,d:.34,g:.3,crush:true,pri:3});
    burst({bp:520,bp2:2900,fd:.22,q:.8,a:.02,d:.6,g:.26,pri:3});burst({pink:true,lp:5200,lp2:700,fd:.6,a:.03,d:.75,g:.14,rev:.15});burst({hp:3000,a:.05,hold:.2,d:.35,g:.05})},
  // A tyre crossing a deck joint: a small low knock with a click.
  joint(k=1,pan=0){if(!ac)return;tone({f:64+Math.random()*10,f2:40,glide:.06,d:.09,g:.13*k,crush:true,pan});burst({bp:1300+Math.random()*500,q:2.5,d:.025,g:.04*k,pan})},
  damage(){if(!ac)return;const now=ac.currentTime;tone({f:110,f2:48,glide:.25,d:.3,g:.48,crush:true,pri:3});burst({pink:true,lp:2600,lp2:380,d:.28,g:.36,crush:true,pri:3});
    tone({f:880,type:'square',d:.09,g:.020,lp:2400,pri:2});tone({t:now+.11,f:660,type:'square',d:.10,g:.018,lp:2200,pri:2});tone({f:2350,d:.45,g:.006});duckMusic(.38,.6)},
  impact(){if(!ac)return;tone({f:96,f2:44,glide:.28,d:.38,g:.46,crush:true,pri:3});burst({pink:true,lp:800,d:.24,g:.2});for(const [f,g] of [[182,.022],[497,.016],[973,.010]])tone({f,d:.45,g,rev:.2})},
  missile(){if(!ac)return;tone({f:84,f2:52,d:.2,g:.24,crush:true});burst({hp:2000,d:.02,g:.08});burst({bp:700,bp2:3600,fd:.45,q:1.1,d:.55,g:.16,rev:.2,pan:-.25});tone({f:420,f2:1250,glide:.35,type:'sawtooth',d:.35,g:.012,lp:2200})},
  lock(){if(!ac)return;tone({f:1760,type:'square',d:.03,g:.02,lp:3200});tone({t:ac.currentTime+.035,f:2350,d:.04,g:.02})},
  designate(count=0){if(!ac)return;const g=nextGrid(1),ch=chordAt(g.step),n=ROOT+12+ch[count%ch.length];
    tone({t:g.t,f:midiHz(n+12),f2:midiHz(n+19),glide:.03,d:.08,g:.04,rev:.2,dly:.25});tone({t:g.t+STEP*.5,f:midiHz(n+7),type:'triangle',d:.14,g:.03,dly:.25})},
  scan(){if(!ac)return;const g=nextGrid(1),ch=chordAt(g.step);tone({t:g.t,f:midiHz(ROOT+24+ch[2]),d:.07,g:.022,dly:.2});tone({t:g.t+.045,f:midiHz(ROOT+24+ch[4%ch.length]),d:.09,g:.018,dly:.2})},
  enemyDash(e){if(!ac)return;const s=spatial(e.x,e.z);burst({bp:1300,bp2:380,fd:.22,q:1.2,d:.26,g:.10*s.g,pan:s.pan})},
  lancerCue(e){if(!ac)return;const s=spatial(e.x,e.z),now=ac.currentTime;tone({f:660,type:'sawtooth',d:.08,g:.035*s.g,lp:1900,pan:s.pan,rev:.15,pri:2});tone({t:now+.10,f:988,type:'sawtooth',d:.12,g:.035*s.g,lp:2200,pan:s.pan,rev:.15,pri:2})},
  hostile(e){if(!ac)return;const s=spatial(e.x,e.z),scout=e.type==='SCOUT';
    tone({f:scout?1900:1400,f2:scout?520:320,glide:.12,type:'sawtooth',d:.15,g:.045*s.g,lp:2800,pan:s.pan,rev:.1});tone({f:scout?900:700,f2:200,type:'square',d:.08,g:.016*s.g,lp:1800,pan:s.pan})},
  heavyCharge(e,dur=.62){if(!ac)return;const s=spatial(e.x,e.z);
    tone({f:110,f2:470,glide:dur,type:'sawtooth',a:dur*.85,d:.08,g:.045*s.g,lp:380,lp2:2600,fd:dur,pan:s.pan,pri:3});tone({f:220,f2:940,glide:dur,a:dur*.85,d:.06,g:.018*s.g,pan:s.pan,pri:3})},
  // Visor glass: a sharp crack with glassy partials. Alarm: two-tone, own period (never the music grid).
  // Arm short-circuit: a crackle and a fizz (sparks from the damaged arm).
  sputter(){if(!ac)return;const now=ac.currentTime;for(let i=0;i<4;i++)burst({t:now+Math.random()*.12,bp:2500+Math.random()*4000,q:6,d:.02+Math.random()*.03,g:.03,pan:.45});burst({hp:4500,d:.12,g:.012,pan:.45})},
  alarm(){if(!ac)return;const now=ac.currentTime;tone({f:932,type:'square',d:.16,g:.016,lp:2600,pri:3});tone({t:now+.19,f:698,type:'square',d:.2,g:.016,lp:2400,pri:3})},
  errChirp(){if(!ac)return;const now=ac.currentTime;for(let i=0;i<3;i++)tone({t:now+i*.045,f:1800+Math.random()*900,type:'square',d:.025,g:.006,lp:4000})},
  // MAUL: chest thump + tube whoosh + backblast hiss; the blast is a long low boom with crackle.
  maul(){if(!ac)return;tone({f:110,f2:42,glide:.18,d:.42,g:.5,crush:true,pri:3});burst({hp:1800,d:.03,g:.18,pri:3});burst({bp:500,bp2:2600,fd:.35,q:.7,d:.6,g:.2,rev:.15,pri:3});burst({pink:true,lp:3200,lp2:500,fd:.5,d:.7,g:.12,rev:.2,pan:-.2});duckMusic(.62,.35)},
  maulBlast(pan=0,g=1){if(!ac)return;const now=ac.currentTime;tone({f:115,f2:42,glide:.5,d:.85,g:.6*g,crush:true,pri:3});burst({pink:true,lp:2800,lp2:200,fd:.6,d:.9,g:.4*g,crush:true,pan,pri:3});burst({hp:2400,d:.05,g:.12*g,pan,pri:3});
    for(let i=0;i<6;i++)burst({t:now+.05+Math.random()*.35,bp:1200+Math.random()*3500,q:5,d:.03+Math.random()*.06,g:.04*g,pan:clamp(pan+(Math.random()-.5)*.6,-1,1),rev:.2,pri:2});duckMusic(.5,.6)},
  // FLAIL: a deep wide boom with a rattle of shot, then the pump racking twice.
  flail(){if(!ac)return;const now=ac.currentTime;tone({f:82,f2:36,glide:.2,d:.42,g:.55,crush:true,pri:3});burst({hp:900,d:.05,g:.3,pri:3});burst({bp:1400,bp2:380,fd:.3,q:.6,d:.45,g:.24,rev:.2,pri:3});
    burst({pink:true,lp:2600,lp2:300,fd:.6,d:.8,g:.1,rev:.3});for(const t of [.34,.46])burst({t:now+t,bp:2300,q:3.5,d:.045,g:.09});tone({t:now+.34,f:170,f2:110,glide:.05,d:.07,g:.08,crush:true});duckMusic(.7,.3)},
  // BARDICHE: a heavy blade cutting air, then a chop with a metal ring when it lands.
  axe(){if(!ac)return;burst({bp:240,bp2:1300,fd:.2,q:.8,a:.06,d:.34,g:.26,pan:.15});burst({lp:300,lp2:90,fd:.3,a:.04,d:.32,g:.2});tone({f:70,f2:44,glide:.25,d:.3,g:.18,crush:true})},
  axeWind(){if(!ac)return;tone({type:'sawtooth',f:90,f2:150,glide:.3,a:.08,d:.34,g:.035,lp:900});burst({lp:500,lp2:200,fd:.3,a:.1,d:.3,g:.05})},
  axeHit(pan=0){if(!ac)return;tone({f:72,f2:30,glide:.2,d:.5,g:.6,crush:true,pri:3,pan});burst({pink:true,lp:900,lp2:120,fd:.5,d:.6,g:.16,rev:.25,pan});burst({hp:1600,d:.03,g:.2,pri:3,pan});
    for(const [f,g] of [[540,.05],[1310,.03],[2780,.016]])tone({f:f*(.97+Math.random()*.06),d:.55,g,rev:.25,pan,pri:2});burst({bp:900,bp2:300,fd:.25,q:.8,d:.3,g:.14,pan})},
  swap(){if(!ac)return;const now=ac.currentTime;tone({f:420,type:'square',d:.03,g:.012,lp:1800});burst({t:now+.12,bp:1600,q:3,d:.05,g:.05});tone({t:now+.25,f:150,f2:90,glide:.06,d:.09,g:.09,crush:true});burst({t:now+.25,bp:2600,q:4,d:.04,g:.04})},
  jump(){if(!ac)return;tone({f:90,f2:150,glide:.12,d:.2,g:.22,crush:true});burst({bp:600,bp2:2200,fd:.2,q:.8,d:.3,g:.12,rev:.1});burst({hp:3000,d:.05,g:.04})},
  land(k=1){if(!ac)return;tone({f:96,f2:40,glide:.14,d:.36,g:.42*k,crush:true,pri:3});burst({pink:true,lp:900,d:.25,g:.16*k});burst({bp:2300,q:3,d:.05,g:.05*k});burst({t:ac.currentTime+.07,hp:4200,d:.2,g:.016*k})},
  // ATLAS: twin cannon report, deeper and longer than BASTION's, and a heavy footfall you hear coming.
  titanFire(e){if(!ac)return;const s=spatial(e.x,e.z);tone({f:120,f2:44,glide:.35,d:.55,g:.4*s.g,crush:true,pri:3});burst({pink:true,lp:1800,lp2:240,fd:.4,d:.5,g:.2*s.g,pan:s.pan,pri:3});burst({bp:650,bp2:160,q:1,d:.45,g:.12*s.g,pan:s.pan,rev:.2});tone({t:ac.currentTime+.09,f:110,f2:46,glide:.3,d:.4,g:.3*s.g,crush:true,pri:3})},
  titanStep(e){if(!ac)return;const s=spatial(e.x,e.z),r=.94+Math.random()*.1;tone({f:72*r,f2:44,glide:.12,d:.32,g:.34*s.g,crush:true,pan:s.pan,pri:2});burst({pink:true,lp:520,d:.25,g:.1*s.g,pan:s.pan});tone({f:240*r,type:'square',d:.04,g:.01*s.g,lp:900,pan:s.pan});burst({t:ac.currentTime+.08,hp:3200,d:.18,g:.012*s.g,pan:s.pan})},
  heavyFire(e){if(!ac)return;const s=spatial(e.x,e.z);tone({f:160,f2:54,glide:.25,d:.36,g:.34*s.g,crush:true,pri:3});burst({bp:800,bp2:200,q:1.2,d:.32,g:.14*s.g,pan:s.pan});tone({f:420,f2:90,type:'sawtooth',d:.26,g:.04*s.g,lp:1600,pan:s.pan,rev:.15})},
  contact(e){if(!ac)return;const pan=e?spatial(e.x,e.z).pan:0;tone({f:1320,d:.32,g:.026,dly:.35,rev:.3,pan});tone({f:1980,d:.18,g:.010,pan})},
  stagger(pan=0){if(!ac)return;for(const [f,g] of [[420,.05],[1163,.026],[2271,.013],[3390,.007]])tone({f:f*(.98+Math.random()*.04),d:.5,g,rev:.25,pan,pri:2});burst({bp:3000,q:2,d:.05,g:.06,pan})},
  sync(){if(!ac)return;burst({hp:300,lp:600,lp2:9000,fd:.7,a:.55,d:.35,g:.10,rev:.3,pri:3});const g=nextGrid(4),ch=chordAt(g.step);
    for(const n of ch)for(const c of [-9,9])tone({t:g.t,f:midiHz(ROOT+n),type:'sawtooth',detune:c,a:.02,d:1.5,g:.012,lp:5200,lp2:900,fd:1.2,rev:.55,dly:.25,pri:3});
    tone({t:g.t,f:86,f2:43,glide:.65,d:.85,g:.32,crush:true,pri:3})},
  flow(){if(!ac)return;const g=nextGrid(1);if(g.step===music.flowGrid)return;music.flowGrid=g.step;const ch=chordAt(g.step);tone({t:g.t,f:midiHz(ROOT+24+ch[1]),type:'triangle',d:.1,g:.03,dly:.2})},
  evade(){if(!ac)return;burst({bp:2600,bp2:700,q:1.4,d:.18,g:.07});const g=nextGrid(1),ch=chordAt(g.step);tone({t:g.t,f:midiHz(ROOT+12+ch[0]),type:'triangle',d:.12,g:.03,dly:.25});tone({t:g.t+STEP,f:midiHz(ROOT+12+ch[2]),type:'triangle',d:.16,g:.03,dly:.25})},
  nearMiss(pan=0){if(!ac)return;burst({bp:2800,bp2:620,fd:.13,q:1.6,d:.15,g:.075,pan})},
  inbound(){if(!ac)return;tone({f:1046,type:'triangle',d:.06,g:.045});tone({t:ac.currentTime+.075,f:1046,type:'triangle',d:.06,g:.035})},
  overheat(){if(!ac)return;const now=ac.currentTime;for(let i=0;i<3;i++)tone({t:now+i*.13,f:i%2?392:523,type:'square',d:.10,g:.026,lp:1800,pri:3});burst({hp:1400,lp:7000,a:.02,hold:.5,d:.6,g:.11,pri:3})},
  vented(){if(!ac)return;tone({f:1175,type:'triangle',d:.06,g:.035});tone({t:ac.currentTime+.065,f:1760,type:'triangle',d:.08,g:.03})},
  mote(){if(!ac)return;const g=nextGrid(1);if(g.step===music.moteGrid)return;music.moteGrid=g.step;const ch=chordAt(g.step),i=music.moteIdx++%ch.length;tone({t:g.t,f:midiHz(ROOT+24+ch[i]),d:.07,g:.016,dly:.22,pan:(i%2?.3:-.3)})},
  clear(){if(!ac)return;const g=nextGrid(4),ch=chordAt(g.step);for(let i=0;i<8;i++)tone({t:g.t+i*STEP,f:midiHz(ROOT+ch[i%ch.length]+12*Math.floor(i/ch.length)),type:'triangle',d:.3,g:.035,dly:.3,rev:.3,pri:3});
    for(const n of ch)tone({t:g.t,f:midiHz(ROOT+n),type:'sawtooth',a:.3,d:2.4,g:.012,lp:2400,rev:.6,pri:3})},
  down(){if(!ac)return;tone({f:240,f2:38,glide:1.4,type:'sawtooth',d:1.6,g:.07,lp:2200,lp2:140,fd:1.4,pri:3});tone({f:96,f2:42,glide:.8,d:1.0,g:.4,crush:true,pri:3});duckMusic(.1,2.5)},
  chip(pan=0){if(!ac)return;for(const [f,g] of [[610,.05],[1490,.03],[2870,.016]])tone({f:f*(.95+Math.random()*.1),d:.28,g,pan,rev:.2,pri:2});burst({bp:4200,q:2.5,d:.06,g:.08,pan});burst({t:ac.currentTime+.07,bp:2600,q:3,d:.05,g:.04,pan})},
  ui(){if(!ac)return;tone({f:1500,d:.03,g:.018})}
};
// Sounds made outside the frame go through the hull (busOut reads sfxExt while they build their voices).
for(const k of ['kill','debrisLand','debrisBurn','explode','enemyDash','lancerCue','hostile','heavyCharge','maulBlast','titanFire','titanStep','heavyFire']){const f=sfx[k];sfx[k]=function(...a){sfxExt++;try{return f.apply(this,a)}finally{sfxExt--}}}
// Loudness calibration, measured at the limiter output with the music muted (tests/audio tour):
// gun report sits around -7 dBFS peak, threat cues -9..-12, reward/HMD tones -12..-16,
// so danger and confirmation read through sustained cannon fire.
const SFX_TRIM={chip:1.6,fire:.68,hit:2.8,lock:2.8,designate:2.5,scan:2.8,enemyDash:2.4,lancerCue:2.8,hostile:3,heavyCharge:4,contact:2.8,stagger:2.5,flow:2.2,evade:3,nearMiss:2.7,inbound:2.5,overheat:1.25,vented:2.8,mote:1.8,clear:2.5};
for(const [k,v] of Object.entries(SFX_TRIM)){const f=sfx[k];sfx[k]=(...args)=>{const prev=sfxTrim;sfxTrim=v;try{return f(...args)}finally{sfxTrim=prev}}}
volume.addEventListener('input',()=>{if(master)master.gain.setTargetAtTime(+volume.value/100,ac.currentTime,.03);$('volout').textContent=volume.value+'%'});$('volout').textContent=volume.value+'%';
musicVol.addEventListener('input',()=>{if(musicBus)musicBus.gain.setTargetAtTime(musicLevel(),ac.currentTime,.05);$('musicout').textContent=musicVol.value+'%'});$('musicout').textContent=musicVol.value+'%';

// ---------- WORLD ----------
// CAMERA_Y is the eye height: standing EYE_Y plus the jump height, refreshed every update, so drawing,
// hit volumes, enemy aim and lines of sight all follow the frame into the air.
const EYE_Y=3.25, WORLD=155;let CAMERA_Y=EYE_Y;
const player={x:0,z:86,yaw:0,torso:0,pitch:0,aimYawTarget:0,aimPitchTarget:0,camPitch:0,vx:0,vz:0,hp:100,boost:100,heat:0,boostTime:0,boostCool:0,regenDelay:0,shake:0,roll:0,alive:true,missiles:6,missileCd:0,combo:0,comboT:0,fovKick:0,gunKick:0,barrel:1,killPulse:0,flow:0,syncTime:0,syncChain:0,inertiaRoll:0,inertiaPitch:0,suspV:0,prevVx:0,prevVz:0,hitDir:0,hitDirT:0,impactCd:0,glideTime:0,boostTrailClock:0,yawVelocity:0,px:0,pz:86,vent:false,absorb:0,lastStepBeat:0,jy:0,jvy:0,jumpCd:0};
const buildings=[],enemies=[],playerBolts=[],enemyBolts=[],missiles=[],rockets=[],particles=[],shards=[],waves=[],debris=[],lights=[],keys=new Set(),mouseButtons=new Set();
const wheelKnock=[];let playing=false,last=performance.now(),gameTime=0,lastFire=-Infinity,boostLatch=false,missionClear=false,lastLockedId=0,lastSightLinkId=0,lastDesignatedId=0,visualContact=null,hitStop=0,inboundCooldown=0,missionTime=0;
const stats={shots:0,hits:0,kills:0,maxChain:0,damage:0,designations:0};
const combat={primaryId:0,pressureId:0,primaryHold:0,pressureHold:0,primaryGate:0,pressureGate:0,nextWake:Infinity};
let seed=17;function hash(n){const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x)}
function addBuilding(x,z,w,d,h,type=0){buildings.push({x,z,w,d,h,type,seed:seed++})}
// Sparse, readable combat space: broad avenues with solid perimeter structures.
const blocks=[
// v29: an asymmetric transfer district, not a mirrored test arena. The central spine remains clear.
[-50,-100,30,26,30,2],[54,-88,26,34,22,3],[-69,-58,34,22,41,0],[75,-48,24,34,19,1],
[-78,-10,28,44,25,3],[77,8,32,30,37,0],[-64,48,34,24,22,1],[69,60,28,34,33,2],
[-48,99,30,26,35,0],[49,105,36,20,18,3],[-118,-76,34,46,42,2],[119,-64,28,50,29,1],
[-121,12,32,44,28,0],[116,24,34,46,39,3],[-112,101,34,36,34,1],[121,96,30,40,25,2],
[-29,-34,13,18,13,2],[27,31,16,13,15,1]
];
// SECTOR 02, SKYDECK: an elevated landing deck. The same deck becomes a runway; low hangars and cargo
// stacks give cover, one control mast stands off the strip, and the rest is open sky for the KITE
// flights that are its main threat. No pylons, gantries or foundry plant out here.
const SKY_BLOCKS=[
[-54,-62,36,28,14,3],[58,-92,32,30,12,3],[-62,44,26,22,10,3],[64,30,10,10,34,1],
[-33,-10,8,6,5,3],[36,66,10,6,6,3],[31,-32,8,8,5,3],[-30,104,10,6,6,3],[-36,-118,12,8,7,3],
[-112,-24,30,40,16,2],[112,-112,30,36,14,2],[-108,92,34,30,12,3],[110,102,30,30,15,2]
];
// SECTOR 03, FREIGHT TUNNEL: an underground freight line, closed at both ends. A 22 m ceiling (room
// for ATLAS), concrete walls 84 m apart, two rows of pillars for cover off the centre lane, a few
// containers and barriers on it, ceiling lamps every 20 m. Walls, ends and pillars are solid (type 4,
// plain concrete); the ceiling and its beams are drawn by drawTunnel and stop shots at TUNNEL.ceil.
const TUNNEL={hw:42,len:150,ceil:22};
const TUNNEL_BLOCKS=(()=>{const out=[],{hw,len,ceil}=TUNNEL;
  for(let z=-len;z<len;z+=30)for(const s of [-1,1])out.push([s*(hw+4),z+15,8,30,ceil,4]);
  for(const s of [-1,1])out.push([0,s*(len+4),2*hw+16,8,ceil,4]);
  for(let z=-128;z<=128;z+=32)for(const s of [-1,1])out.push([s*28,z,3.6,3.6,ceil,4]);
  out.push([-12,44,5.6,12,5.2,4],[13,-8,12,5.6,5.2,4],[-14,-52,5.6,12,5.2,4],[8,-92,12,5.6,5.2,4],[0,14,10,1.4,1.8,4],[-4,-122,10,1.4,1.8,4]);
  return out})();
const SECTORS={1:{tag:'SECTOR 01',name:'TRANSFER DISTRICT',blocks},2:{tag:'SECTOR 02',name:'FREIGHT TUNNEL',blocks:TUNNEL_BLOCKS},3:{tag:'SECTOR 03',name:'SKYDECK',blocks:SKY_BLOCKS}};
const LAST_SECTOR=3;
// The sortie is the three sectors in a row; clearing the last one ends it (OPERATION COMPLETE), and each
// sector's clear time is kept for that final result. Starting SECTOR 01 again starts a new run.
const campaign={};function finalClear(){return mode==='sortie'&&stage===LAST_SECTOR}
let stage=1,builtStage=0;
function buildSector(n){if(builtStage===n)return;builtStage=n;buildings.length=0;lights.length=0;seed=17;for(const b of SECTORS[n].blocks)addBuilding(...b);
  if(n===1)for(let z=-120;z<=120;z+=30)for(const x of [-23,23])lights.push({x,z,y:5.2})}
buildSector(1);
// ENDURANCE: no sector to clean. Reinforcements keep arriving out of view until the frame is lost;
// every 6 breaks raise the threat level (one more hostile on the field, tougher, harder-hitting, more
// BASTIONs). The hull never repairs, so the run ends when the damage adds up.
let mode='sortie';
const endure={level:1,spawnT:0,nextId:100,best:null};
try{endure.best=JSON.parse(localStorage.getItem('hf.endure.best')||'null')}catch{}
function setMode(m){mode=m==='endurance'?'endurance':'sortie';if(mode==='endurance')stage=1;reset()}
const ATLAS_CHANCE=.16;
function enduranceTarget(){return Math.min(6,2+endure.level)}
function makeEnemy(x,z,type,id,i,k=1,dk=1){
    const cfg=type==='KITE'?{hp:60,speed:26,desired:92,fire:5.2,dash:false,scale:1,damage:6}:type==='TITAN'?{hp:1100,speed:3.4,desired:70,fire:3.6,dash:false,scale:2,damage:10}:type==='SCOUT'?{hp:68,speed:9.0,desired:29,fire:1.25,dash:true,scale:.88,damage:5}:type==='HEAVY'?{hp:165,speed:3.7,desired:48,fire:1.35,dash:false,scale:1.18,damage:10}:{hp:105,speed:6.1,desired:38,fire:1.30,dash:true,scale:1,damage:7};
    const p=[x,z];cfg.hp=Math.round(cfg.hp*k);cfg.damage=Math.round(cfg.damage*dk);
    return {x:p[0],z:p[1],type,heavy:type==='HEAVY'||type==='TITAN',maxHp:cfg.hp,hp:cfg.hp,alive:true,id,dmgK:dk,yaw:0,phase:i*1.77,last:-i*.4,speed:cfg.speed,desired:cfg.desired,fireRate:cfg.fire,dashCap:cfg.dash,scale:cfg.scale,damage:cfg.damage,flash:0,muzzle:0,stun:0,dashCd:1.3+hash(i+8)*2.2,dashT:0,dashVX:0,dashVZ:0,lean:0,strafe:i%2?1:-1,marked:i<2?1.6:0,markLatch:false,focus:0,designated:0,awake:i<2,wakeT:0,charge:0,firePending:false,stagger:0,breakFlash:0,vx:0,vz:0,lungeCd:1.4+hash(i+22)*1.8,lungeWindup:0,lungeVX:0,lungeVZ:0,trail:[],trailTick:0,px:p[0],pz:p[1],flankSide:p[0]>=0?1:-1,recoverT:0,nextAttack:.95+i*.32,lastAttack:-i*.4,blockedT:0,dashPuffTime:0,attackKind:'',committedAim:null,chargeDuration:.62}}
function spawn(){
  enemies.length=0;
  const layout=[[0,38,'HEAVY'],[25,65,'SCOUT'],[-38,8,'LANCER'],[42,-18,'SCOUT'],[0,-62,'HEAVY'],[-44,-82,'LANCER']];
  if(mode!=='endurance'&&stage===3){
    // SKYDECK: a few machines on the deck, and the KITE flights circling high over it.
    const deck=[[0,-24,'HEAVY'],[-34,18,'SCOUT'],[36,-56,'SCOUT']];deck.forEach((p,i)=>enemies.push(makeEnemy(p[0],p[1],p[2],i+1,i)));
    for(let i=0;i<5;i++)enemies.push(makeKite(i,deck.length+i+1));return}
  if(mode!=='endurance'&&stage===2){
    // FREIGHT TUNNEL: walkers only. PIKEs and BASTIONs between the pillars, two ATLAS side by side at the far end.
    [[14,24,'LANCER'],[-18,-20,'HEAVY'],[20,-62,'HEAVY'],[-16,-84,'LANCER'],[-13,-112,'TITAN'],[13,-112,'TITAN']].forEach((p,i)=>enemies.push(makeEnemy(p[0],p[1],p[2],i+1,i)));return}
  (mode==='endurance'?layout.slice(0,3):layout).forEach((p,i)=>enemies.push(makeEnemy(p[0],p[1],p[2],i+1,i)));
}
// A KITE starts on its orbit, already flying: the sky over SKYDECK is never empty. Attack runs begin a
// few seconds in, one aircraft at a time.
function makeKite(i,id){const ang=i/5*TAU+.35,R=78+hash(i+3)*30,alt=24+hash(i+7)*14,e=makeEnemy(Math.sin(ang)*R,-Math.cos(ang)*R-10,'KITE',id,i);
  Object.assign(e,{y:alt,alt,orbitDir:i%2?1:-1,awake:true,wakeT:0,marked:0,nextAttack:4.5+i*2.4,lastAttack:0,fly:{mode:'orbit',ang,t:0,fired:0,second:0}});e.yaw=ang+e.orbitDir*Math.PI/2;return e}

// Reinforcement: a point 70-125 m away that is clear of structures, preferring one outside the
// head's view so the hostile arrives instead of popping in.
function enduranceSpawn(){
  // From threat level 3 an ATLAS sometimes joins the reinforcements, never two at once.
  const L=endure.level,heavy=Math.min(.4,.12+.04*L),r=Math.random(),titan=L>=3&&!enemies.some(e=>e.alive&&e.type==='TITAN')&&Math.random()<ATLAS_CHANCE,
    type=titan?'TITAN':r<heavy?'HEAVY':r<heavy+(1-heavy)*.45?'LANCER':'SCOUT';
  // From threat level 2 KITE flights join too, up to one fewer than the level and never more than three.
  if(!titan&&L>=2&&enemies.filter(e=>e.alive&&e.type==='KITE').length<Math.min(3,L-1)&&Math.random()<KITE_CHANCE)return enduranceKite(L);
  const viewYaw=player.yaw+headYaw*Math.PI/180;let pick=null,fallback=null;
  for(let t=0;t<60&&!pick;t++){const a=Math.random()*TAU,d=titan?85+Math.random()*40:70+Math.random()*55,x=clamp(player.x+Math.sin(a)*d,-WORLD+8,WORLD-8),z=clamp(player.z-Math.cos(a)*d,-WORLD+8,WORLD-8);
    if(collide(x,z,titan?6:4)||enemies.some(e=>e.alive&&Math.hypot(e.x-x,e.z-z)<14))continue;const dd=Math.hypot(x-player.x,z-player.z);if(dd<60)continue;
    if(Math.abs(angleDiff(Math.atan2(x-player.x,-(z-player.z)),viewYaw))>.9)pick={x,z};else fallback=fallback||{x,z}}
  const at=pick||fallback;if(!at)return null;
  const k=Math.min(1.8,1+.1*(L-1)),dk=Math.min(1.5,1+.06*(L-1)),e=makeEnemy(at.x,at.z,type,endure.nextId++,enemies.length,k,dk);e.awake=false;e.marked=0;e.nextAttack=gameTime+1.6;e.lastAttack=gameTime;
  enemies.push(e);wakeEnemy(e,'NEW CONTACT');if(titan){plog('Warning',`-Heavy walker inbound. ${etag(e)}`);pilotGlance(e,1.2,2)}return e}
const KITE_CHANCE=.24;
function enduranceKite(L){const viewYaw=player.yaw+headYaw*Math.PI/180,a=viewYaw+Math.PI*(.6+Math.random()*.8),k=Math.min(1.8,1+.1*(L-1)),dk=Math.min(1.5,1+.06*(L-1)),e=makeKite(0,endure.nextId++),R=e.desired+10;
  e.x=clamp(player.x+Math.sin(a)*R,-WORLD+8,WORLD-8);e.z=clamp(player.z-Math.cos(a)*R,-WORLD+8,WORLD-8);e.px=e.x;e.pz=e.z;e.fly.ang=a;e.yaw=a+e.orbitDir*Math.PI/2;
  e.maxHp=e.hp=Math.round(e.hp*k);e.damage=Math.round(e.damage*dk);e.dmgK=dk;e.nextAttack=gameTime+3+Math.random()*2;e.lastAttack=gameTime;
  enemies.push(e);plog('Warning',`-Air contact inbound. ${etag(e)}`);sfx.contact(e);return e}
function updateEndurance(dt){
  if(mode!=='endurance'||!player.alive)return;
  const L=1+Math.floor(stats.kills/6);if(L>endure.level){endure.level=L;plog('Warning',`-Threat level ${L}. More hostiles inbound.`)}
  // Broken hostiles leave the roster once their wreck has burned out.
  for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];if(!e.alive&&gameTime-(e.deadAt??gameTime)>6)enemies.splice(i,1)}
  endure.spawnT-=dt;const alive=enemies.filter(e=>e.alive).length;
  if(alive<enduranceTarget()&&endure.spawnT<=0){if(enduranceSpawn())endure.spawnT=alive+1<enduranceTarget()?1.2:Math.max(1.4,4.2-endure.level*.35);else endure.spawnT=.5}
}
function reset(){if(mode==='endurance')stage=1;if(mode==='sortie'&&stage===1)for(const k in campaign)delete campaign[k];buildSector(stage);Object.assign(player,{x:0,z:86,yaw:0,torso:0,pitch:0,aimYawTarget:0,aimPitchTarget:0,camPitch:0,vx:0,vz:0,hp:100,boost:100,heat:0,boostTime:0,boostCool:0,regenDelay:0,shake:0,roll:0,alive:true,missiles:6,missileCd:0,combo:0,comboT:0,fovKick:0,gunKick:0,barrel:1,killPulse:0,flow:0,syncTime:0,syncChain:0,inertiaRoll:0,inertiaPitch:0,suspV:0,prevVx:0,prevVz:0,hitDir:0,hitDirT:0,impactCd:0,glideTime:0,boostTrailClock:0,yawVelocity:0,px:0,pz:86,vent:false,absorb:0,lastStepBeat:0,jy:0,jvy:0,jumpCd:0,weapon:'HALBERD',rockets:MAUL.mag,rocketRegen:0,rocketCd:0,snipeT:-9,pumpT:-9,scope:0,scopeOn:false,swing:null,dashSpin:0,dashJet:null,dashDir:null,dashSlide:false,airDashed:false,scrub:0,jointZ:null,jointX:null});wheelKnock.length=0;cockpit.axeTrail=[];rockets.length=0;cockpit.shown='HALBERD';cockpit.swapT=cockpit.swapK=cockpit.maulKick=0;playerBolts.length=enemyBolts.length=missiles.length=particles.length=shards.length=waves.length=debris.length=0;Object.assign(stats,{shots:0,hits:0,kills:0,maxChain:0,damage:0,designations:0});missionTime=0;killWaves.length=0;syncMix=0;cockpit.cracks.length=0;visorFX.errors.length=0;visorFX.glitch=visorFX.glitchK=0;visorFX.sparks.length=0;visorFX.smoke.length=0;visorFX.blocks.length=0;visorFX.flash=null;cockpit.jolt=0;cockpit.raise=0;showResult(null);missionClear=false;gameTime=0;lastLockedId=0;lastSightLinkId=0;lastDesignatedId=0;visualContact=null;hitStop=0;inboundCooldown=0;lastFire=-Infinity;keys.clear();mouseButtons.clear();boostLatch=false;Object.assign(combat,{primaryId:0,pressureId:0,primaryHold:0,pressureHold:0,primaryGate:0,pressureGate:0,nextWake:Infinity,airGate:0});spawn();pilot.entries.length=0;plogSeen.clear();Object.assign(pilot,{scroll:0,expr:'calm',prev:null,mix:1,hold:0,holdPrio:0,banner:null,cut:null,critLatch:false});endure.level=1;endure.spawnT=2.5;endure.nextId=100;if(playing)hmdBoot=performance.now();else bootPending=true;plog('System','-Combat mode activate.');plog('System','-Sensor reconstruction.');plog('Info',mode==='endurance'?'-Endurance. Break until the frame fails.':stage===2?'-Sector 02: Freight tunnel. Walkers inbound.':stage===3?'-Sector 03: Skydeck. Flights overhead.':'-Sector: Vector Foundry 07.');if(secondArms().length)plog('System',`-Second arm${secondArms().length>1?'s':''}: ${secondArms().map(w=>w+(w==='ARBALEST'?' [scope]':'')).join(' / ')}.`)}
spawn();
function forward(y){return{x:Math.sin(y),z:-Math.cos(y)}}function right(y){return{x:Math.cos(y),z:Math.sin(y)}}
function angleDiff(a,b){let d=a-b;while(d>Math.PI)d-=TAU;while(d<-Math.PI)d+=TAU;return d}
function worldPan(x,z){const a=angleDiff(Math.atan2(x-player.x,-(z-player.z)),player.yaw+headYaw*Math.PI/180);return clamp(Math.sin(a)*.82,-.82,.82)}
function collide(x,z,r=1.2){if(Math.abs(x)>WORLD||Math.abs(z)>WORLD)return true;for(const b of buildings)if(Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r)return true;return false}
function movePlayer(dx,dz){let hit=false;const dist=Math.hypot(dx,dz),steps=Math.max(1,Math.ceil(dist/.55)),sx=dx/steps,sz=dz/steps;for(let i=0;i<steps;i++){const nx=player.x+sx,nz=player.z+sz;if(!collide(nx,player.z,1.25))player.x=nx;else{player.vx=0;hit=true}if(!collide(player.x,nz,1.25))player.z=nz;else{player.vz=0;hit=true}}return hit}
// Ray-vs-hostile: the main hit cylinder, plus ATLAS's two legs. Returns the earliest t or null.
function enemyHitT(e,x0,y0,z0,x1,y1,z1,pad=0){const R=RIGS[e.type],H=R.hit;let t=sweepCylinder(x0,y0,z0,x1,y1,z1,e,H.r+pad,H.cy+eY(e),H.hh+pad);
  if(R.legHit){const L=R.legHit,r=right(e.yaw);for(const s of [-1,1]){const u=sweepCylinder(x0,y0,z0,x1,y1,z1,{x:e.x+r.x*L.off*s,z:e.z+r.z*L.off*s},L.r+pad,L.cy,L.hh);if(u!==null&&(t===null||u<t))t=u}}return t}
// Height to aim / look at: ATLAS's hull is ~10 m up, everyone else ~3 m.
// ATLAS fights from ~70 m and is tall, so locks, designation and the attack director reach a little further.
function reach(e){return e.type==='TITAN'?1.15:1}
function aimY(e){return e.type==='TITAN'?RIGS.TITAN.hit.cy:e.type==='KITE'?eY(e)+RIGS.KITE.hit.cy:3.0}
// Flying machines carry their height in e.y (the root of the rig); everything on the deck has none.
function eY(e){return e.y||0}
// Line-of-sight height from a hostile toward the frame.
function losY(e){return e.type==='TITAN'?aimY(e):3.15+eY(e)}
function moveEnemy(e,dx,dz){const dist=Math.hypot(dx,dz),steps=Math.max(1,Math.ceil(dist/.45)),sx=dx/steps,sz=dz/steps,r=RIGS[e.type]?.wall??1.35;for(let i=0;i<steps;i++){const nx=e.x+sx,nz=e.z+sz;if(!collide(nx,e.z,r))e.x=nx;else e.dashT=0;if(!collide(e.x,nz,r))e.z=nz;else e.dashT=0}}
function enemyDash(e,dx,dz,dist){if(!e.dashCap||e.dashCd>0||e.dashT>0||dist<16||dist>82)return;const side=e.strafe*(hash(e.id+Math.floor(gameTime*3))>.18?1:-1),tx=dz/dist*side,tz=-dx/dist*side,base=e.type==='SCOUT'?34:25,jitter=e.type==='SCOUT'?9:6;e.dashVX=tx*(base+hash(e.id+11)*jitter);e.dashVZ=tz*(base+hash(e.id+17)*jitter);e.dashT=e.type==='SCOUT'?.19:.16;e.dashCd=(e.type==='SCOUT'?1.45:2.35)+hash(e.id+Math.floor(gameTime))*(e.type==='SCOUT'?1.25:2.0);e.strafe*=-1;e.lean=side;sfx.enemyDash(e);puff(e.x,.15,e.z,e.type==='SCOUT'?12:8,'#ff7466',e.type==='SCOUT'?6:4.5)}
function segmentAABBTime(x0,y0,z0,x1,y1,z1,b){
  let t0=0,t1=1;const mins=[b.x-b.w/2,0,b.z-b.d/2],maxs=[b.x+b.w/2,b.h,b.z+b.d/2],a=[x0,y0,z0],d=[x1-x0,y1-y0,z1-z0];
  for(let i=0;i<3;i++){
    if(Math.abs(d[i])<1e-8){if(a[i]<mins[i]||a[i]>maxs[i])return null;continue}
    let q0=(mins[i]-a[i])/d[i],q1=(maxs[i]-a[i])/d[i];if(q0>q1)[q0,q1]=[q1,q0];
    t0=Math.max(t0,q0);t1=Math.min(t1,q1);if(t0>t1)return null;
  }
  return t0;
}
function segmentAABB(...args){return segmentAABBTime(...args)!==null}
const TUNNEL_ROOF={x:0,z:0,w:2*TUNNEL.hw,d:2*TUNNEL.len,h:TUNNEL.ceil+3,type:4,roof:true};
function worldImpact(x0,y0,z0,x1,y1,z1){
  let result=null;for(const b of buildings){const t=segmentAABBTime(x0,y0,z0,x1,y1,z1,b);if(t!==null&&(!result||t<result.t))result={t,b}}
  // FREIGHT TUNNEL: the ceiling stops whatever climbs through it.
  if(stage===2&&y1>TUNNEL.ceil&&y0<=TUNNEL.ceil){const t=(TUNNEL.ceil-y0)/(y1-y0);if(!result||t<result.t)result={t,b:TUNNEL_ROOF}}
  return result;
}
function segmentHitsWorld(...args){return worldImpact(...args)?.b||null}
// Intersect a swept bolt with the target's moving upright cylinder.
function sweepCylinder(x0,y0,z0,x1,y1,z1,target,radius,centerY,halfHeight){
  const tx0=target.px??target.x,tz0=target.pz??target.z;
  const rx=x0-tx0,rz=z0-tz0,dx=x1-x0-(target.x-tx0),dz=z1-z0-(target.z-tz0);
  const a=dx*dx+dz*dz,b=2*(rx*dx+rz*dz),c=rx*rx+rz*rz-radius*radius;
  let enter=0,exit=1;
  if(a<1e-10){if(c>0)return null}else{
    const discriminant=b*b-4*a*c;if(discriminant<0)return null;
    const root=Math.sqrt(discriminant);enter=Math.max(enter,(-b-root)/(2*a));exit=Math.min(exit,(-b+root)/(2*a));
  }
  const dy=y1-y0;
  if(Math.abs(dy)<1e-8){if(Math.abs(y0-centerY)>halfHeight)return null}else{
    let lo=(centerY-halfHeight-y0)/dy,hi=(centerY+halfHeight-y0)/dy;if(lo>hi)[lo,hi]=[hi,lo];
    enter=Math.max(enter,lo);exit=Math.min(exit,hi);
  }
  return enter<=exit?enter:null;
}
function placeImpact(b,x1,y1,z1,t){b.x=lerp(b.x,x1,t);b.y=lerp(b.y,y1,t);b.z=lerp(b.z,z1,t)}
function closestPlayerPass(b){
  const rx=b.px-player.px,rz=b.pz-player.pz,dx=b.x-b.px-(player.x-player.px),dz=b.z-b.pz-(player.z-player.pz);
  const t=clamp(-(rx*dx+rz*dz)/(dx*dx+dz*dz||1),0,1);
  return {d:Math.hypot(rx+dx*t,rz+dz*t),y:lerp(b.py,b.y,t)};
}
function inputDir(){let sx=0,sz=0;if(keys.has('KeyW'))sz++;if(keys.has('KeyS'))sz--;if(keys.has('KeyD'))sx++;if(keys.has('KeyA'))sx--;const n=Math.hypot(sx,sz)||1;sx/=n;sz/=n;const f=forward(player.yaw),r=right(player.yaw);return{x:r.x*sx+f.x*sz,z:r.z*sx+f.z*sz,sx,sz}}
// Transient text now lives in the PILOT LINK log (see plog); the DOM keeps only clock / HMD loss / result.
function hitMark(pan=0){player.hitMarkT=.09;player.shake=Math.max(player.shake,.12);sfx.hit(pan)}
function flash(id,ms=70){const e=$(id);e.classList.add('on');setTimeout(()=>e.classList.remove('on'),ms)}
function addFlow(n,label=''){if(!player.alive||missionClear)return;player.flow=clamp(player.flow+n,0,100);if(n>=12)sfx.flow();if(player.flow>=100&&player.syncTime<=0){waves.push({x:player.x,y:.06,z:player.z,color:'#ffd16f',size:60,life:.9,max:.9,kind:'ground'});player.flow=0;player.syncTime=4.5;player.syncChain=0;player.boost=Math.min(100,player.boost+28);player.heat=Math.max(0,player.heat-28);player.fovKick=Math.max(player.fovKick,.62);sfx.sync();plog('Sync','Vector flow. Sync drive.');pilotBanner('!SYNC DRIVE!','- 同期駆動 -','#ffe08a',1.3);pilotReact('cheer',1.6,2);say('SYNC')}}
function puff(x,y,z,count=8,color='#4fbfa0',power=4){for(let i=0;i<count;i++)particles.push({x,y,z,px:x,py:y,pz:z,vx:(Math.random()-.5)*power,vy:.5+Math.random()*power,vz:(Math.random()-.5)*power,life:.25+Math.random()*.45,max:.7,color,size:.18+Math.random()*.45})}
// v31 emissive feedback primitives. Everything here is drawn additively and picked up by the bloom pass.
const rgbCache=new Map();function rgba(hex,a){let c=rgbCache.get(hex);if(!c){const n=parseInt(hex.slice(1),16);c=`${n>>16},${n>>8&255},${n&255}`;rgbCache.set(hex,c)}return`rgba(${c},${clamp(a,0,1).toFixed(3)})`}
function sparks(x,y,z,count,color,power=9,hot='#fff6dc'){for(let i=0;i<count;i++){const a=Math.random()*TAU,b=Math.random()*2-1,c=Math.sqrt(1-b*b),s=power*(.3+Math.random()*.7);particles.push({x,y,z,px:x,py:y,pz:z,vx:Math.cos(a)*c*s,vy:b*s*.8+power*.22,vz:Math.sin(a)*c*s,life:.16+Math.random()*.34,max:.5,color,hot,size:.22+Math.random()*.32,g:15})}}
function shockwave(x,y,z,color,size=8,life=.5,kind='sphere'){waves.push({x,y,z,color,size,life,max:life,kind})}
function lightBurst(x,y,z,color,size=9,life=.28){waves.push({x,y,z,color,size,life,max:life,kind:'light'})}
function explode(x,y,z,big=false,sound=true){sparks(x,y,z,big?46:26,'#ffb35c',big?16:11);shockwave(x,y,z,'#ffd08a',big?9:6,.42);shockwave(x,.06,z,'#ff9a62',big?14:9,.6,'ground');lightBurst(x,y,z,'#ffb070',big?12:8,.3);if(sound){const s=spatial(x,z);sfx.explode(s.pan,s.g)}}
// Frame break (v32): the machine first comes apart into its real components (wings, lance,
// barrel, legs, armour) which tumble as rigid bodies, glowing hot. Each component then burns
// down into edge shards, and the shards dissolve into data motes absorbed by the frame.
let debrisUid=0,threeWorldFrame=false;
function spawnDebris(e,part,kick=1,life=null){
  const pose=enemyPose(e),p=pose.parts[part],c=[0,0,0];for(const v of p.wv){c[0]+=v[0]/p.wv.length;c[1]+=v[1]/p.wv.length;c[2]+=v[2]/p.wv.length}
  const center=enemyCenter(e),ox=c[0]-center.x,oy=c[1]-center.y,oz=c[2]-center.z,on=Math.hypot(ox,oy,oz)||1,size=Math.max(...p.P.verts.map(v=>vlen(vsub(v,p.P.center))));
  const sp=(3+Math.random()*7)*kick/(.7+size*.5);
  debris.push({P:p.P,rel:p.wv.map(v=>vsub(v,c)),c,R0:p.X.R,D:[1,0,0,0,1,0,0,0,1],vx:ox/on*sp+(e.vx||0)*.4+(Math.random()-.5)*3,vy:2.5+Math.random()*5*kick+oy/on*sp*.4,vz:oz/on*sp+(e.vz||0)*.4+(Math.random()-.5)*3,
    w:[(Math.random()-.5)*9/(.4+size),(Math.random()-.5)*9/(.4+size),(Math.random()-.5)*9/(.4+size)],age:0,life:life??(.42+Math.random()*.45+size*.12),type:e.type,size,mat:p.P.mat,lands:0,uid:++debrisUid});
}
function shatterEnemy(e){const pose=enemyPose(e);pose.parts.forEach((p,i)=>{if(!e.lost?.[i])spawnDebris(e,i,1)})}
function debrisVerts(d){return d.rel.map(v=>{const q=M3.ap(d.D,v);return[q[0]+d.c[0],q[1]+d.c[1],q[2]+d.c[2]]})}
// Debris sounds are capped so a full frame break (a dozen components) never becomes a wall of clanks.
// Landing clanks and burn-down fizzes have separate budgets, so the many burning parts never starve the clanks.
const debrisSfx={land:{t:-9,n:0,max:4},burn:{t:-9,n:0,max:2}};
function debrisSound(kind,x,z,fn){const c=debrisSfx[kind];if(gameTime-c.t>.12){c.t=gameTime;c.n=0}if(c.n>=c.max)return;c.n++;const s=spatial(x,z);fn(s.pan,s.g)}
function burnDebris(d){
  debrisSound('burn',d.c[0],d.c[2],(pan,g)=>sfx.debrisBurn(pan,g*clamp(d.size,.4,1)));
  const wv=debrisVerts(d),col=CLASS_STYLE[d.type]?.edge||'#ff6359',edges=d.P.edges.filter(E=>E.crease>.25).map(E=>({E,l:vlen(vsub(wv[E.a],wv[E.b]))})).sort((a,b)=>b.l-a.l).slice(0,d.P.mat==='glow'?2:6);
  for(const {E,l} of edges){const A=wv[E.a],B=wv[E.b];if(l<.08)continue;
    shards.push({x:(A[0]+B[0])/2,y:(A[1]+B[1])/2,z:(A[2]+B[2])/2,hx:(B[0]-A[0])/2,hy:(B[1]-A[1])/2,hz:(B[2]-A[2])/2,vx:d.vx*.5+(Math.random()-.5)*4,vy:d.vy*.4+1+Math.random()*3,vz:d.vz*.5+(Math.random()-.5)*4,
      spinY:(Math.random()-.5)*12,spinX:(Math.random()-.5)*9,age:0,life:.32+Math.random()*.4,color:col,width:l>1.2?2.0:l>.5?1.5:1.0})}
}
// Armour chipping: as wear passes thresholds a real armour plate breaks off and the frame beneath shows.
function chipArmor(e){
  const wear=1-e.hp/e.maxHp,level=wear>.8?3:wear>.55?2:wear>.3?1:0;
  while((e.lostN||0)<level){const pose=enemyPose(e),cands=pose.parts.filter(p=>p.P.chip&&!e.lost?.[p.i]);if(!cands.length)break;
    const p=cands[Math.floor(Math.random()*cands.length)];spawnDebris(e,p.i,.6,.7);(e.lost||(e.lost={}))[p.i]=true;e.lostN=(e.lostN||0)+1;
    const c=p.wv[0];sparks(c[0],c[1],c[2],10,CLASS_STYLE[e.type].glow,7);sfx.chip(worldPan(e.x,e.z))}
}
function shardEnds(s){let hx=s.hx,hy=s.hy,hz=s.hz;const ay=s.spinY*s.age,ax=s.spinX*s.age,cy=Math.cos(ay),sy=Math.sin(ay),cx=Math.cos(ax),sx=Math.sin(ax);const rx=hx*cy-hz*sy,rz=hx*sy+hz*cy;hx=rx;hz=rz;const ry=hy*cx-hz*sx;hz=hy*sx+hz*cx;hy=ry;return[s.x-hx,s.y-hy,s.z-hz,s.x+hx,s.y+hy,s.z+hz]}
function dissolveShard(s){const p=shardEnds(s),n=s.width>1.5?3:2;for(let i=0;i<n;i++){const t=n>1?i/(n-1):.5,x=lerp(p[0],p[3],t),y=lerp(p[1],p[4],t),z=lerp(p[2],p[5],t);particles.push({kind:'mote',x,y,z,px:x,py:y,pz:z,vx:s.vx*.25+(Math.random()-.5)*3.5,vy:.6+Math.random()*2.4,vz:s.vz*.25+(Math.random()-.5)*3.5,life:2.6,max:2.6,age:0,home:.18+Math.random()*.55,color:s.color,size:1})}}
function absorbMote(){player.absorb=Math.min(1,player.absorb+.03);sfx.mote()}
// JUMP (Space): a heavy hop, ~3 m up and ~1.1 s in the air. Steering is weak in the air; BURST still
// works. Hostile shots aimed before the jump pass underneath. Landing drops the frame on its spring.
const JUMP={v:10,g:11,air:.35}; // lunar: a higher, slower arc (apex ~4.5 m, ~1.8 s in the air)
function doJump(){if(!playing||!player.alive||missionClear||player.jy>0||player.jvy>0||player.jumpCd>0)return;player.jvy=JUMP.v;player.jy=.001;cockpit.heaveV+=1.2;player.shake=Math.max(player.shake,.18);sfx.jump();
  for(let i=0;i<14;i++)particles.push({x:player.x+(Math.random()-.5)*2.4,y:.1,z:player.z+(Math.random()-.5)*2.4,px:player.x,py:.1,pz:player.z,vx:(Math.random()-.5)*7,vy:.4+Math.random()*1.4,vz:(Math.random()-.5)*7,life:.3+Math.random()*.3,max:.6,color:i%3?'#c8b89d':'#ffb35c',size:.3+Math.random()*.6})}
function updateJump(dt){player.jumpCd=Math.max(0,player.jumpCd-dt);
  if(player.jy>0||player.jvy>0){player.jvy-=JUMP.g*dt;player.jy+=player.jvy*dt;
    if(player.jy<=0){const k=clamp(-player.jvy/JUMP.v,.3,1.4);player.airDashed=false;player.jy=0;player.jvy=0;player.jumpCd=.2;cockpit.heaveV-=3.2*k;player.shake=Math.max(player.shake,.35*k);sfx.land(k);shockwave(player.x,.06,player.z,'#c8b89d',5*k,.45,'ground');
      for(let i=0;i<16;i++)particles.push({x:player.x+(Math.random()-.5)*3,y:.1,z:player.z+(Math.random()-.5)*3,px:player.x,py:.1,pz:player.z,vx:(Math.random()-.5)*9*k,vy:.3+Math.random(),vz:(Math.random()-.5)*9*k,life:.3+Math.random()*.35,max:.65,color:'#c8b89d',size:.3+Math.random()*.7})}}
  CAMERA_Y=EYE_Y+player.jy}
// BURST. On the ground it is the wheels: 0.06 s of wheelspin (the frame squats, the tyres scream), then they
// bite and throw the frame; a sideways burst slides a little at the end. In the air it is the backpack: one
// push per jump, a little softer but held longer, a lift, more boost, the old jet sound.
const DASH={spin:.06,cost:24,air:34};
function doBoost(){const d=inputDir();if(!playing||missionClear||(Math.abs(d.sx)+Math.abs(d.sz))<.1||player.boostCool>0||!player.alive)return;const air=player.jy>0;
  if(air?(player.airDashed||player.boost<DASH.air):player.boost<DASH.cost)return;player.boost-=air?DASH.air:DASH.cost;player.boostCool=.18;player.regenDelay=.75;player.glideTime=0;player.boostTrailClock=0;player.roll=clamp(-d.sx*.065,-.065,.065);
  const side=Math.abs(d.sx)>.4,power=side?52:60;
  if(air){player.airDashed=true;player.dashSpin=0;player.boostTime=.36;player.dashSlide=false;player.vx=d.x*power*.78;player.vz=d.z*power*.78;player.jvy=Math.max(player.jvy,2.6);player.fovKick=.8;player.shake=.55;player.dashJet=[d.x*power*.78,d.z*power*.78];
    for(let i=0;i<16;i++)particles.push({x:player.x-d.x*1.5+(Math.random()-.5)*1.4,y:CAMERA_Y+.4+Math.random()*.6,z:player.z-d.z*1.5+(Math.random()-.5)*1.4,px:player.x,py:CAMERA_Y,pz:player.z,vx:-d.x*(8+Math.random()*8)+(Math.random()-.5)*3,vy:-1-Math.random()*3,vz:-d.z*(8+Math.random()*8)+(Math.random()-.5)*3,life:.25+Math.random()*.3,max:.55,color:i%3?'#8fd8ff':'#e8f6ff',size:.3+Math.random()*.7,g:0});
    flash('boostVignette',220);sfx.jet();return}
  player.dashJet=null;player.dashSpin=DASH.spin;player.boostTime=DASH.spin+.23;player.dashDir=[d.x*power,d.z*power];player.dashSlide=side;player.shake=.35;cockpit.heaveV-=1.4;
  for(let i=0;i<14;i++)particles.push({x:player.x+(Math.random()-.5)*2.6,y:.12,z:player.z+(Math.random()-.5)*2.6,px:player.x,py:.1,pz:player.z,vx:-d.x*(3+Math.random()*7)+(Math.random()-.5)*5,vy:.3+Math.random()*1.2,vz:-d.z*(3+Math.random()*7)+(Math.random()-.5)*5,life:.2+Math.random()*.25,max:.45,color:i%3?'#c8b89d':'#8a8478',size:.3+Math.random()*.7});
  sfx.boost()}
// The wheels bite at the end of the spin: the frame is thrown, the ground ring goes out.
function dashBite(){const D=player.dashDir;if(!D)return;player.vx=D[0];player.vz=D[1];player.fovKick=1;player.shake=.8;cockpit.heaveV+=2.2;const l=Math.hypot(D[0],D[1])||1,dx=D[0]/l,dz=D[1]/l;
  for(let i=0;i<20;i++)particles.push({x:player.x-dx*(1+Math.random()*2)+(Math.random()-.5)*2,y:.25+Math.random()*.6,z:player.z-dz*(1+Math.random()*2)+(Math.random()-.5)*2,px:player.x,py:.2,pz:player.z,vx:-dx*(2+Math.random()*8)+(Math.random()-.5)*4,vy:Math.random()*2,vz:-dz*(2+Math.random()*8)+(Math.random()-.5)*4,life:.3+Math.random()*.35,max:.65,color:'#5fe8c4',size:.2+Math.random()*.8});
  waves.push({x:player.x,y:.06,z:player.z,color:'#67ffd1',size:11,life:.38,max:.38,kind:'ground'});flash('boostVignette',180);sfx.bite()}

// ---------- MAUL (bazooka) ----------
// The arm's second weapon: one rocket per click (holding the button does not repeat), slow and heavy,
// splash damage and a big stagger. Four rounds, one regrows every 7 s; an ATLAS break returns two.
// Switch with the mouse wheel, 1 / 2 or X; the arm drops, swaps and comes back up (no firing meanwhile).
const MAUL={mag:4,regen:7,cd:.9,speed:64,direct:150,splash:95,radius:8,stagger:70};
// ARBALEST: a bolt-action rifle for SKYDECK's long sky. Armed means scoped: the view narrows 2.6x onto the
// gun's line and the head stops steering it. One click, one round, ~1 s to cycle the bolt.
const ARBALEST={cycle:1.05,speed:430,damage:120,zoom:2.6};
// FLAIL: a pump-action scatter cannon for SECTOR 01's dashing VANEs. One click, nine pellets in a wide cone,
// full damage inside ~15 m falling to a third by ~45 m and gone by ~65 m; the spread forgives a chassis that
// is still turning toward what the head is tracking. ~0.6 s to rack the next shell.
const FLAIL={cycle:.62,pellets:9,cone:.085,speed:170,life:.4,damage:22,near:15,far:45};
// Each sector issues one second arm next to HALBERD: FLAIL in SECTOR 01, ARBALEST in SKYDECK, MAUL in the
// FREIGHT TUNNEL. ENDURANCE carries everything: both second arms share slot 2 (press 2 again for the other,
// the way a slot holds more than one item in CS).
function secondArms(){return mode==='endurance'?['MAUL','ARBALEST','FLAIL']:stage===2?['MAUL']:stage>=3?['ARBALEST']:['FLAIL']}
function secondArm(){return secondArms()[0]||null}
// BARDICHE: the melee axe (the big blade in Edge of Tomorrow), carried everywhere on key 3. Keys are slots
// by kind: 1 HALBERD, 2 the sector's second arm (nothing where none is issued), 3 BARDICHE.
// LMB swings, and it is heavy, swung the way a person swings an axe: a slow heave up over the right shoulder
// (the servos strain), a beat at the top, a diagonal cut that accelerates down across the front, a
// follow-through to the lower left and a long recovery. The frame slows
// while it swings and the view is dragged with the blade. The swing lunges the frame at a hostile ahead
// within LUNGE m; the cut hits what is in its arc out to REACH m (past the hull), bites with a long
// hit-stop and staggers. V swings it from any weapon with no swap and goes back after.
const BARDICHE={wind:.3,hold:.06,cut:.17,over:.12,rec:.5,reach:8,arc:1.6,damage:75,stagger:45,lunge:12,knock:2};
function carried(){return['HALBERD',...secondArms(),'BARDICHE']}
function nextSecond(){const A=secondArms(),i=A.indexOf(player.weapon);return i>=0?A[(i+1)%A.length]:A.includes(player.lastSecond)?player.lastSecond:A[0]||null}
let wheelT=0;
function switchWeapon(w){const C=carried();if(w==='second')w=nextSecond();if(w==='other')w=C[(C.indexOf(player.weapon)+1)%C.length];if(!w||!C.includes(w))return;if(!playing||!player.alive||w===player.weapon||cockpit.swapT>0||player.swing)return;player.weapon=w;player.scopeOn=false;if(secondArms().includes(w))player.lastSecond=w;cockpit.swapT=.5;sfx.swap();plog('System',w==='MAUL'?`-MAUL armed [rocket x${player.rockets}].`:w==='ARBALEST'?'-ARBALEST armed [scope].':w==='FLAIL'?'-FLAIL armed [scatter].':w==='BARDICHE'?'-BARDICHE armed [blade].':'-HALBERD armed [30mm].')}
function swingAxe(quick=false){if(!playing||!player.alive||missionClear||player.swing||cockpit.swapT>0)return;
  if(player.weapon!=='BARDICHE'){if(!quick)return;player.swing={t:0,ret:player.weapon,hit:false,cut:false};player.weapon='BARDICHE';cockpit.shown='BARDICHE'}
  else player.swing={t:0,ret:null,hit:false,cut:false}}
function swingEnd(){const B=BARDICHE;return B.wind+B.hold+B.cut+B.over+B.rec}
function updateSwing(dt){const S=player.swing;if(!S)return;S.t+=dt;const B=BARDICHE,ay=player.yaw+player.torso,cut0=B.wind+B.hold;
  if(!S.strain){S.strain=true;sfx.axeWind()}
  if(!S.lunged){S.lunged=true;
    // Lunge from the start of the wind-up: close on the nearest hostile ahead within LUNGE m that is low
    // enough to hit, so the cut lands on it.
    let best=null,bd=B.lunge;for(const e of enemies){if(!e.alive||eY(e)>8)continue;const dx=e.x-player.x,dz=e.z-player.z,d=Math.hypot(dx,dz)-RIGS[e.type].hit.r;
      if(d<bd&&d>B.reach*.55&&Math.abs(angleDiff(Math.atan2(dx,-dz),ay))<.55&&!segmentHitsWorld(player.x,2,player.z,e.x,2,e.z)){bd=d;best=e}}
    // The step is held from the middle of the heave to the bite, so the frame carries its weight into the cut.
    if(best){const dx=best.x-player.x,dz=best.z-player.z,l=Math.hypot(dx,dz)||1,T=cut0+B.cut*.6-B.wind*.5,v=clamp((bd-B.reach*.5)/T,0,40);S.lunge=[dx/l*v,dz/l*v]}}
  if(S.lunge&&S.t>=B.wind*.5&&S.t<cut0+B.cut*.6){player.vx=S.lunge[0];player.vz=S.lunge[1];if(!S.stepped){S.stepped=true;player.fovKick=Math.max(player.fovKick,.4);player.shake=Math.max(player.shake,.3)}}
  if(!S.cut&&S.t>=cut0){S.cut=true;sfx.axe();cockpit.heaveV-=1.6}
  if(!S.hit&&S.t>=cut0+B.cut*.6){S.hit=true;let any=false,pan=0;
    for(const e of enemies){if(!e.alive||eY(e)>7.5)continue;const dx=e.x-player.x,dz=e.z-player.z,l=Math.hypot(dx,dz)||1,R=RIGS[e.type].hit.r;
      if(l-R>B.reach||Math.abs(angleDiff(Math.atan2(dx,-dz),ay))>B.arc/2&&l>R+2||segmentHitsWorld(player.x,2,player.z,e.x,2,e.z))continue;
      if(!e.awake)wakeEnemy(e,'IMPACT CONTACT');any=true;pan=worldPan(e.x,e.z);const hx=e.x-dx/l*R,hz=e.z-dz/l*R,hy=Math.min(CAMERA_Y,RIGS[e.type].hit.cy+eY(e));
      e.hp-=B.damage;e.flash=.24;e.hitPoint={x:hx,y:hy,z:hz};e.hitT=.2;sparks(hx,hy,hz,22,'#e8f4ff',14,'#ffffff');sparks(hx,hy,hz,10,'#6fa8ff',9);
      if(e.type!=='TITAN')moveEnemy(e,dx/l*B.knock,dz/l*B.knock);
      if(e.hp>0){chipArmor(e);staggerEnemy(e,B.stagger)}else killEnemy(e,'BARDICHE')}
    if(any){hitStop=Math.max(hitStop,.13);player.shake=Math.max(player.shake,.95);player.hitMarkT=.14;cockpit.heaveV-=3.4;sfx.axeHit(pan)}}
  if(S.t>=swingEnd()){if(S.ret&&player.alive)player.weapon=S.ret;player.swing=null}}
// The blade drags the view: a little to the right as it is heaved back, hard to the left through the cut.
function axeSway(){const S=player.swing,B=BARDICHE;if(!S)return 0;const t=S.t,c0=B.wind+B.hold,c1=c0+B.cut+B.over,sm=u=>u*u*(3-2*u);
  if(t<c0)return .035*sm(clamp(t/B.wind,0,1));if(t<c1){const u=(t-c0)/(c1-c0);return lerp(.035,-.06,sm(clamp(u*1.4,0,1)))}return -.06*(1-sm(clamp((t-c1)/B.rec,0,1)))}
// The scope is the pilot's call: ARBALEST comes up unscoped, RMB (or F / a middle click) puts the eye to the scope
// and takes it away again. Switching away drops it.
function toggleScope(){if(!playing||!player.alive||missionClear||player.weapon!=='ARBALEST'||cockpit.swapT>0)return;player.scopeOn=!player.scopeOn;sfx.ui()}
function fireFlail(){if(gameTime-(player.pumpT??-9)<FLAIL.cycle)return;player.pumpT=gameTime;const a=aimVector(),r=right(player.yaw+player.torso),
    M=cockpit.muzzle&&Math.hypot(cockpit.muzzle[0]-player.x,cockpit.muzzle[2]-player.z)<5?cockpit.muzzle:[player.x+r.x*.72+a.x*.6,CAMERA_Y-.3,player.z+r.z*.72+a.z*.6],shot={hit:false},up=[-a.x*a.y,1-a.y*a.y,-a.z*a.y];
  stats.shots+=FLAIL.pellets;
  for(let i=0;i<FLAIL.pellets;i++){const ang=i/FLAIL.pellets*TAU+Math.random()*.5,rad=FLAIL.cone*Math.sqrt(i?(.25+.75*Math.random()):0),cx=Math.cos(ang)*rad,cy=Math.sin(ang)*rad,
      dx=a.x+r.x*cx+up[0]*cy,dy=a.y+up[1]*cy,dz=a.z+r.z*cx+up[2]*cy,l=Math.hypot(dx,dy,dz)||1,sp=FLAIL.speed*(.92+Math.random()*.16);
    playerBolts.push({x:M[0],y:M[1],z:M[2],px:M[0]-dx/l,py:M[1]-dy/l,pz:M[2]-dz/l,vx:dx/l*sp,vy:dy/l*sp,vz:dz/l*sp,life:FLAIL.life,damage:FLAIL.damage,syncId:0,pellet:true,ox:M[0],oz:M[2],shot})}
  player.shake=Math.max(player.shake,.6);player.gunKick=1.5;player.fovKick=Math.max(player.fovKick,.3);flash('muzzleFlash',90);sfx.flail();
  for(let i=0;i<10;i++)particles.push({x:M[0]+a.x*.4,y:M[1]+a.y*.4,z:M[2]+a.z*.4,px:M[0],py:M[1],pz:M[2],vx:a.x*(8+Math.random()*10)+(Math.random()-.5)*6,vy:a.y*8+(Math.random()-.5)*4,vz:a.z*(8+Math.random()*10)+(Math.random()-.5)*6,life:.12+Math.random()*.12,max:.24,color:i%2?'#ffd88a':'#fff4d6',size:.3+Math.random()*.4,g:0})}
function fireArbalest(){if(gameTime-(player.snipeT??-9)<ARBALEST.cycle)return;player.snipeT=gameTime;stats.shots++;
  const a=aimVector(),M=cockpit.muzzle&&Math.hypot(cockpit.muzzle[0]-player.x,cockpit.muzzle[2]-player.z)<6?cockpit.muzzle:null,r=right(player.yaw+player.torso),
    x=M?M[0]:player.x+r.x*.72+a.x*.6,y=M?M[1]:CAMERA_Y-.28,z=M?M[2]:player.z+r.z*.72+a.z*.6,sp=ARBALEST.speed;
  playerBolts.push({x,y,z,px:x-a.x*6,py:y-a.y*6,pz:z-a.z*6,vx:a.x*sp,vy:a.y*sp,vz:a.z*sp,life:.9,damage:ARBALEST.damage,syncId:0,snipe:true});
  player.shake=Math.max(player.shake,.55);player.gunKick=1.6;player.fovKick=Math.max(player.fovKick,.25);flash('muzzleFlash',80);sfx.snipe()}
function fireMaul(){if(player.rocketCd>0)return;if(player.rockets<=0){if(gameTime-(fireMaul.warnT??-9)>.8){fireMaul.warnT=gameTime;plog('Caution','MAUL empty. Reloading.',3)}return}
  player.rockets--;player.rocketCd=MAUL.cd;stats.shots++;const a=aimVector(),M=cockpit.muzzle&&Math.hypot(cockpit.muzzle[0]-player.x,cockpit.muzzle[2]-player.z)<5?cockpit.muzzle:[player.x+a.x*1.5,CAMERA_Y-.3,player.z+a.z*1.5];
  rockets.push({x:M[0],y:M[1],z:M[2],vx:a.x*MAUL.speed,vy:a.y*MAUL.speed,vz:a.z*MAUL.speed,life:3,trail:0,hist:[]});
  player.gunKick=1;cockpit.maulKick=1;player.shake=Math.max(player.shake,.7);player.fovKick=Math.max(player.fovKick,.25);flash('muzzleFlash',90);sfx.maul();
  for(let i=0;i<12;i++){const k=Math.random();particles.push({x:M[0]-a.x*(3.4+k*2),y:M[1]-a.y*3.4,z:M[2]-a.z*(3.4+k*2),px:M[0],py:M[1],pz:M[2],vx:-a.x*(6+Math.random()*8)+(Math.random()-.5)*4,vy:.5+Math.random()*2,vz:-a.z*(6+Math.random()*8)+(Math.random()-.5)*4,life:.25+Math.random()*.3,max:.55,color:i%3?'#ffb35c':'#e8f2ee',size:.4+Math.random()*.5,g:0})}}
function maulBlast(x,y,z,direct){
  explode(x,y,z,true,false);shockwave(x,y,z,'#ffe2a8',MAUL.radius*1.2,.5);shockwave(x,.06,z,'#ffb35c',MAUL.radius*1.6,.7,'ground');lightBurst(x,y,z,'#ffd6a0',18,.4);const s=spatial(x,z);sfx.maulBlast(s.pan,s.g);
  let hit=false;for(const e of enemies){if(!e.alive)continue;const H=RIGS[e.type].hit,dh=Math.max(0,Math.hypot(e.x-x,e.z-z)-H.r),dv=Math.max(0,Math.abs(y-H.cy-eY(e))-H.hh),d=Math.hypot(dh,dv),dir=e===direct;if(!dir&&d>MAUL.radius)continue;
    const k=dir?1:1-d/MAUL.radius;if(!e.awake)wakeEnemy(e,'IMPACT CONTACT');e.hp-=dir?MAUL.direct:MAUL.splash*k;e.flash=.2;e.hitPoint={x,y,z};e.hitT=.16;stats.hits++;hit=true;
    if(e.hp>0)chipArmor(e);staggerEnemy(e,MAUL.stagger*k);if(e.hp<=0){if(e.type==='TITAN')player.rockets=Math.min(MAUL.mag,player.rockets+2);killEnemy(e,'MAUL')}}
  if(hit)hitMark(s.pan);const pd=Math.hypot(player.x-x,player.z-z);if(pd<14)player.shake=Math.max(player.shake,.6*(1-pd/14))}
function updateRockets(dt){
  player.rocketCd=Math.max(0,player.rocketCd-dt);if(player.rockets<MAUL.mag){player.rocketRegen+=dt;if(player.rocketRegen>=MAUL.regen){player.rocketRegen=0;player.rockets++}}else player.rocketRegen=0;
  for(const r of rockets){r.life-=dt;r.trail-=dt;r.hist.push({x:r.x,y:r.y,z:r.z});if(r.hist.length>14)r.hist.shift();r.vy-=1.6*dt;
    const nx=r.x+r.vx*dt,ny=r.y+r.vy*dt,nz=r.z+r.vz*dt;let impact=worldImpact(r.x,r.y,r.z,nx,ny,nz);
    for(const e of enemies){if(!e.alive)continue;const t=enemyHitT(e,r.x,r.y,r.z,nx,ny,nz,.2);if(t!==null&&(!impact||t<impact.t))impact={t,e}}
    if(!impact&&ny<.15)impact={t:clamp((r.y-.15)/((r.y-ny)||1),0,1)};
    if(impact){placeImpact(r,nx,ny,nz,impact.t);r.life=0;maulBlast(r.x,Math.max(.3,r.y),r.z,impact.e||null);continue}
    r.x=nx;r.y=ny;r.z=nz;if(r.life<=0){maulBlast(r.x,r.y,r.z,null);continue}
    if(r.trail<=0){r.trail=.018;particles.push({x:r.x,y:r.y,z:r.z,px:r.x,py:r.y,pz:r.z,vx:(Math.random()-.5)*1.2,vy:.4,vz:(Math.random()-.5)*1.2,life:.32,max:.32,color:'#ffb35c',hot:'#fff2cf',size:.45,g:0});
      particles.push({x:r.x,y:r.y,z:r.z,px:r.x,py:r.y,pz:r.z,vx:(Math.random()-.5)*.8,vy:.6+Math.random()*.6,vz:(Math.random()-.5)*.8,life:.7,max:.7,color:'#6f7f7b',size:.7,g:0})}}
  for(let i=rockets.length-1;i>=0;i--)if(rockets[i].life<=0)rockets.splice(i,1)}
function aimVector(){const y=player.yaw+player.torso,p=player.pitch,cp=Math.cos(p);return{x:Math.sin(y)*cp,y:Math.sin(p),z:-Math.cos(y)*cp}}
function fire(fresh=false){if(!playing||!player.alive||missionClear||cockpit.swapT>0)return;if(player.weapon==='BARDICHE'){if(fresh)swingAxe();return}if(player.weapon==='MAUL'){if(fresh)fireMaul();return}if(player.weapon==='ARBALEST'){if(fresh)fireArbalest();return}if(player.weapon==='FLAIL'){if(fresh)fireFlail();return}const now=gameTime;if(now-lastFire<.092)return;if(player.vent){if(now-(fire.warnT??-9)>.6){fire.warnT=now;plog('Caution','HALBERD venting.',3)}return}lastFire=now;stats.shots++;const linked=getSightLink();player.heat=Math.min(100,player.heat+(linked?(player.syncTime>0?5.5:7.6):(player.syncTime>0?8.2:9.5)));const a=aimVector(),r=right(player.yaw+player.torso),M=cockpit.muzzle&&Math.hypot(cockpit.muzzle[0]-player.x,cockpit.muzzle[2]-player.z)<5?cockpit.muzzle:null,muzzleX=M?M[0]:player.x+r.x*.72+a.x*.35,muzzleZ=M?M[2]:player.z+r.z*.72+a.z*.35,muzzleY=M?M[1]:CAMERA_Y-.28;const spread=(Math.random()-.5)*(linked?.0022:.0045),rs=right(player.yaw+player.torso);const speed=linked?(player.syncTime>0?112:102):(player.syncTime>0?98:92);playerBolts.push({x:muzzleX,y:muzzleY,z:muzzleZ,px:muzzleX-a.x*1.8,py:muzzleY-a.y*1.8,pz:muzzleZ-a.z*1.8,vx:(a.x+rs.x*spread)*speed,vy:a.y*speed,vz:(a.z+rs.z*spread)*speed,life:1.9,damage:linked?(player.syncTime>0?29:25):20,syncId:linked?.e.id||0});player.shake=Math.max(player.shake,linked?.34:.30);player.gunKick=1;flash('muzzleFlash',55);sfx.fire(!!linked);if(player.heat>=100){player.vent=true;sfx.overheat();plog('Warning','HALBERD overheat. Venting.');pilotReact('grit',.8,1);say('OVERHEAT')}}
function getLock(maxAngle=.18){const ay=player.yaw+player.torso,ap=player.pitch;let best=null,bestScore=maxAngle;for(const e of enemies){if(!e.alive)continue;const dx=e.x-player.x,dz=e.z-player.z,dist=Math.hypot(dx,dz);if(dist>130||segmentHitsWorld(player.x,CAMERA_Y,player.z,e.x,aimY(e),e.z))continue;const ey=Math.atan2(dx,-dz),ep=Math.atan2(aimY(e)+.2-CAMERA_Y,dist),score=Math.hypot(angleDiff(ey,ay),ep-ap);if(score<bestScore){bestScore=score;best={e,dist,score}}}return best}
function getHmdLock(){const e=enemies.find(x=>x.id===lastDesignatedId&&x.alive&&x.designated>0);if(!e)return null;const dist=Math.hypot(e.x-player.x,e.z-player.z);if(dist>135||segmentHitsWorld(player.x,CAMERA_Y,player.z,e.x,aimY(e),e.z))return null;return{e,dist,score:0,hmd:true}}
function getSightLink(maxAngle=.105){const h=getHmdLock();if(!h)return null;const e=h.e,ay=player.yaw+player.torso,ap=player.pitch,dx=e.x-player.x,dz=e.z-player.z,dist=Math.hypot(dx,dz)||1,ey=Math.atan2(dx,-dz),ep=Math.atan2(aimY(e)-CAMERA_Y,dist),score=Math.hypot(angleDiff(ey,ay),ep-ap);return score<maxAngle?{e,dist,score}:null}
function wakeEnemy(e,label='CONTACT'){if(!e||!e.alive||e.awake)return;e.awake=true;e.wakeT=.62;e.marked=Math.max(e.marked||0,1.8);e.flash=.18;sfx.contact(e);plog('Caution',`-${label==='HMD HANDOFF'?'Handoff contact':'Hostile contact'}. ${etag(e)}`);pilotGlance(e,.8,1);sayContact(e);shockwave(e.x,.06,e.z,'#ff7667',9,.62,'ground')}
function wakeNearestCold(){let best=null,bd=1e9;for(const e of enemies){if(!e.alive||e.awake)continue;const d=Math.hypot(e.x-player.x,e.z-player.z);if(d<bd){bd=d;best=e}}if(best)wakeEnemy(best,'NEW CONTACT')}
function tryHmdHandoff(excludeId=0){const viewYaw=player.yaw+headYaw*Math.PI/180;let best=null,bestA=.30;for(const e of enemies){if(!e.alive||e.id===excludeId)continue;const dx=e.x-player.x,dz=e.z-player.z,dist=Math.hypot(dx,dz);if(dist>120||segmentHitsWorld(player.x,CAMERA_Y,player.z,e.x,aimY(e),e.z))continue;const a=Math.abs(angleDiff(Math.atan2(dx,-dz),viewYaw));if(a<bestA){bestA=a;best=e}}if(!best)return;best.focus=Math.max(best.focus||0,.17);best.marked=Math.max(best.marked||0,1.4);if(!best.awake)wakeEnemy(best,'HMD HANDOFF');plog('Link',`-HMD handoff. ${etag(best)}`)}
function enemyShoot(e,aim=null){const shots=e.type==='SCOUT'||e.type==='TITAN'?2:1,muzzles=enemyMuzzles(e);for(let n=0;n<shots;n++){const m=muzzles[n%muzzles.length],lead=e.type==='SCOUT'?.06:e.heavy?.18:.11,tx=(aim?.x??(player.x+player.vx*lead))-m[0],tz=(aim?.z??(player.z+player.vz*lead))-m[2],td=Math.hypot(tx,tz)||1,spread=(Math.random()-.5)*(e.heavy?.014:e.type==='SCOUT'?.05:.034),sp=e.type==='TITAN'?46:e.heavy?42:e.type==='SCOUT'?39:35;enemyBolts.push({x:m[0],y:m[1],z:m[2],px:m[0],py:m[1],pz:m[2],vx:(tx/td+spread)*sp,vy:((CAMERA_Y-m[1])/td)*sp,vz:(tz/td+spread)*sp,life:3.0,damage:e.type==='SCOUT'?Math.round(4*(e.dmgK||1)):e.damage,type:e.type,heavy:!!e.heavy,big:e.type==='TITAN',near:false,threatened:false,evadeCandidate:false})}e.muzzle=.11;if(e.anim){e.anim.recoil=1;e.anim.recoilSide=-(e.anim.recoilSide||1)}if(e.type==='TITAN')sfx.titanFire(e);else if(e.heavy)sfx.heavyFire(e);else sfx.hostile(e)}
function staggerEnemy(e,power=20){
  e.stagger=(e.stagger||0)+power;
  const threshold=e.type==='TITAN'?200:e.heavy?72:e.type==='SCOUT'?36:48;
  if(e.stagger<threshold)return;
  const brokeCharge=e.heavy&&e.firePending,brokeLance=e.type==='LANCER'&&e.attackKind==='LANCE';
  e.stagger=0;if(e.anim){e.anim.stag=1;e.anim.stagDir=Math.random()<.5?-1:1}e.stun=Math.max(e.stun,e.type==='TITAN'?.32:e.heavy?.48:.62);e.recoverT=Math.max(e.recoverT,e.type==='TITAN'?1.1:e.heavy?.90:.75);
  e.breakFlash=.52;e.dashT=0;e.lungeWindup=0;e.firePending=false;e.charge=0;e.attackKind='';e.committedAim=null;e.flash=.22;
  e.nextAttack=Math.max(e.nextAttack,gameTime+e.recoverT+.45);
  if(brokeCharge)addFlow(14,'CHARGE BREAK');if(brokeLance)addFlow(14,'LANCE BREAK');
  player.shake=Math.max(player.shake,.42);sfx.stagger(worldPan(e.x,e.z));
  plog('Info',`-${brokeCharge?'Charge break':brokeLance?'Lance break':'Stagger'}. ${etag(e)}`);if(brokeCharge||brokeLance)say('STAGGER');
  shockwave(e.x,2.7+eY(e),e.z,'#ffe28c',5.5,.42);sparks(e.x,2.7+eY(e),e.z,14,'#ffe28c',10);
}
function killEnemy(e,weapon='CANNON'){if(!e.alive)return;const wasDesignated=e.designated>0;e.alive=false;e.deadAt=gameTime;e.firePending=false;e.charge=0;e.lungeWindup=0;e.dashT=0;e.attackKind="";{const col=CLASS_STYLE[e.type].edge,cy=RIGS[e.type].hit.cy+eY(e),s=spatial(e.x,e.z);shatterEnemy(e);killWaves.push({x:e.x,z:e.z,t:gameTime});sparks(e.x,cy,e.z,44,col,16);sparks(e.x,cy,e.z,18,'#fff1d8',22);shockwave(e.x,cy,e.z,'#fff1d8',8,.36);shockwave(e.x,cy,e.z,col,15,.8);if(eY(e)<4)shockwave(e.x,.06,e.z,col,20,1.0,'ground');lightBurst(e.x,cy,e.z,'#ffd6b0',17,.36);sfx.kill(s.pan,e.type);if(e.type==='TITAN'){for(const y of [cy+4,cy-4,cy*.55,cy*.25])explode(e.x+(Math.random()-.5)*3,y,e.z+(Math.random()-.5)*3,true,false);shockwave(e.x,cy,e.z,'#ffd6b0',24,1.1);shockwave(e.x,.06,e.z,'#ff3a4a',42,1.4,'ground');player.shake=Math.max(player.shake,1.2)}}stats.kills++;hitStop=.055;const syncKill=player.syncTime>0;if(syncKill){player.syncChain++;player.syncTime=Math.min(5.4,player.syncTime+.42);player.fovKick=Math.max(player.fovKick,.62);}const refund=player.combo>0?22:18;player.boost=Math.min(100,player.boost+refund);player.heat=Math.max(0,player.heat-20);let reload=0;player.combo++;player.comboT=2.8;player.killPulse=1;player.fovKick=Math.max(player.fovKick,.42);player.shake=Math.max(player.shake,.52);stats.maxChain=Math.max(stats.maxChain,player.combo);addFlow(wasDesignated?26:12,wasDesignated?'DESIGNATE BREAK':'FRAME BREAK');plog(syncKill?'Sync':wasDesignated?'Link':'Info',`-${etag(e)} broken.${syncKill?` Sync x${player.syncChain}.`:player.combo>1?` Chain ${player.combo}.`:''}${reload?' MSSL +1.':''}`);pilotReact(player.combo>=3||syncKill?'laugh':'smug',player.combo>=3?1.4:1.0,2);{const left=mode==='endurance'?9:enemies.filter(x=>x.alive).length;if(left===1)say('LAST_ONE');else if(left>1){if(syncKill)say('SYNC_BREAK');else if(wasDesignated)say('DESIGNATE_BREAK');else if(player.combo>=3)say('CHAIN');else say('KILL',.6)}}if(lastDesignatedId===e.id)lastDesignatedId=0;if(wasDesignated)tryHmdHandoff(e.id);if(mode!=='endurance'&&enemies.every(x=>!x.alive)){missionClear=true;sfx.clear();const fin=finalClear();if(mode==='sortie')campaign[stage]={time:missionTime,kills:stats.kills};plog('System',fin?'All sectors clean. Operation complete.':'Sector clean.');pilotCut('clear');say('CLEAR');setTimeout(()=>{if(missionClear)showResult(fin?'OPERATION COMPLETE':'SECTOR CLEAN')},650)}else combat.nextWake=Math.min(combat.nextWake,gameTime+.45)}

// ---------- HEAD TRACKING ----------
let manualHead=0,headYaw=0,headTarget=0,headEnabled=false,headFound=false,baseline=null,rawYaw=0,headPitch=0,headPitchTarget=0,basePitch=null,rawPitch=0,stream=null,headWorker=null,lastFace=0,lastVT=-1;
let headBusy=false,headGeneration=0,headSampleTime=-Infinity,headRequestTime=0,headInferenceMs=0;
const HEAD_FRESH_MS=250;
// The head is mainly left / right. Up / down only nudges the view (degrees, after the dead zone, capped):
// you sit in front of a screen and cannot look up at it, so height is the mouse's job. View only, never the aim.
const HEAD_PITCH_GAIN=.5,HEAD_PITCH_MAX=5;
const gain=$('gain'),dead=$('dead'),smooth=$('smooth');
// Human neck, not a turret: a critically damped spring (slow start, fast middle, soft stop, no
// overshoot) with a ~450 deg/s cap. SMOOTH sets the stiffness (0.13 -> 60 deg in ~0.3 s). Sub-stepped so
// the response is the same at any frame rate.
let headVel=0;
function setHeadTarget(target,dt){const w=2.15/Math.max(.03,+smooth.value),n=Math.max(1,Math.ceil(dt*240)),h=dt/n;
  for(let i=0;i<n;i++){headVel+=(w*w*(target-headYaw)-2*w*headVel)*h;headVel=clamp(headVel,-450,450);headYaw+=headVel*h}}
function headPoseFresh(now=performance.now()){return !headEnabled||(headFound&&now-headSampleTime<=HEAD_FRESH_MS)}
function centerHead(){baseline=headPoseFresh()&&headFound?rawYaw:null;basePitch=baseline===null?null:rawPitch;headPitchTarget=0;headPitch=0;manualHead=0;headTarget=0;headYaw=0;headVel=0;plog('System','Head centered.');say('HEAD_CENTER')}
function acceptHeadPose(data){
  if(data.timestamp<headSampleTime)return;
  headFound=!!data.found;
  headInferenceMs=data.inferenceMs||0;
  if(!data.found)return;
  headSampleTime=data.timestamp;rawYaw=data.yaw;rawPitch=data.pitch||0;
  if(baseline===null)baseline=rawYaw;if(basePitch===null)basePitch=rawPitch;
  const d=angleDiff(rawYaw*Math.PI/180,baseline*Math.PI/180)*180/Math.PI;
  headTarget=clamp(Math.sign(d)*Math.max(0,Math.abs(d)-(+dead.value))*(+gain.value),-60,60);
  const dp=rawPitch-basePitch;
  headPitchTarget=clamp(Math.sign(dp)*Math.max(0,Math.abs(dp)-(+dead.value))*HEAD_PITCH_GAIN,-HEAD_PITCH_MAX,HEAD_PITCH_MAX);
}
// The CAMERA button on the menu: a lamp (off / loading / on / failed) and a line under it that says, in
// Japanese, what the camera is for or why it did not start.
const CAM_NOTE={off:'顔の向きで周りを見ます。映像は端末の外に出ません。',loading:'顔認識を読み込み中…（初回は数秒かかります）',on:'顔を正面に向けて C を押すと、そこが正面になります。',
  busy:'ほかのアプリ（会議アプリやカメラの付属ソフトなど）がカメラを使っています。閉じてからもう一度押してください。',
  denied:'カメラが許可されていません。アドレスバーのカメラのアイコンと、Windows の設定 → プライバシー → カメラを確認してください。',
  none:'カメラが見つかりません。つながっているか確認してください。',load:'顔認識を読み込めませんでした。通信を確認して、もう一度押してください。',
  browser:'このブラウザでは使えません。Chrome か Edge で開いてください。',lost:'カメラが止まりました。もう一度押すと再開します。'};
function camUI(state,note){const b=$('head');for(const k of ['on','loading','fail'])b.classList.toggle(k,k===state);$('headLabel').textContent=state==='on'?'CAMERA : ON':state==='loading'?'CAMERA : …':'CAMERA : OFF';$('camNote').textContent=CAM_NOTE[note||state]||CAM_NOTE.off}
function camError(error){const n=error?.name||'';return n==='NotReadableError'||n==='TrackStartError'||n==='AbortError'?'busy':n==='NotAllowedError'||n==='SecurityError'||n==='PermissionDeniedError'?'denied':n==='NotFoundError'||n==='OverconstrainedError'||n==='DevicesNotFoundError'?'none':/ImageBitmap unavailable/.test(error?.message||'')?'browser':'load'}
async function toggleHead(){
  if(headEnabled){disableHead();return}
  const btn=$('head'),generation=++headGeneration;
  btn.disabled=true;$('status').textContent='LOADING HEAD TRACKER…';camUI('loading');
  try{
    if(!window.Worker||!window.createImageBitmap)throw new Error('Worker / ImageBitmap unavailable');
    const worker=new Worker(((typeof window!=='undefined'&&window.HF_ASSET_BASE)||'')+'head-tracker.worker.js');headWorker=worker;
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('Tracker initialization timeout')),30000);
      worker.onerror=event=>{clearTimeout(timeout);reject(new Error(event.message||'Tracker Worker failed'));if(headEnabled)disableHead('HEAD FAILED / Q-E MANUAL TEST')};
      worker.onmessage=({data})=>{
        if(generation!==headGeneration)return;
        if(data.type==='ready'){clearTimeout(timeout);resolve();return}
        if(data.type==='error'){clearTimeout(timeout);reject(new Error(data.message));if(headEnabled){disableHead('HEAD FAILED / Q-E MANUAL TEST');plog('Caution','Head tracker off.')}return}
        if(data.type==='pose'){headBusy=false;if(headEnabled)acceptHeadPose(data)}
      };
      worker.postMessage({type:'init'});
    });
    if(generation!==headGeneration)return;
    stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},frameRate:{ideal:30,max:30},facingMode:'user'},audio:false});
    video.srcObject=stream;await video.play();
    headEnabled=true;baseline=null;headFound=false;headSampleTime=-Infinity;headBusy=false;lastFace=0;lastVT=-1;
    camUI('on');$('status').textContent='HEAD ACTIVE / LOOK FORWARD + PRESS C';
  }catch(error){console.error(error);if(generation!==headGeneration)return;disableHead('HEAD FAILED / Q-E MANUAL TEST',camError(error));plog('Caution','Head tracker off.')}
  finally{btn.disabled=false}
}
function disableHead(status='HEAD OFF / Q-E MANUAL TEST',why=null){
  headGeneration++;headEnabled=false;headFound=false;headBusy=false;
  headWorker?.terminate();headWorker=null;
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
  video.srcObject=null;manualHead=headYaw;headTarget=headYaw;headPitchTarget=0;
  camUI(why?'fail':'off',why||(/FAILED|TIMEOUT/.test(status)?'lost':'off'));$('status').textContent=status;
}
async function captureHeadFrame(now){
  if(!headEnabled||!headWorker||headBusy||video.readyState<2||now-lastFace<1000/30||video.currentTime===lastVT)return;
  const worker=headWorker,generation=headGeneration;
  headBusy=true;headRequestTime=now;lastFace=now;lastVT=video.currentTime;
  try{
    const height=Math.max(1,Math.round(320*(video.videoHeight||480)/(video.videoWidth||640)));
    const bitmap=await createImageBitmap(video,{resizeWidth:320,resizeHeight:height,resizeQuality:'low'});
    if(!headEnabled||generation!==headGeneration){bitmap.close();return}
    worker.postMessage({type:'frame',bitmap,timestamp:now},[bitmap]);
  }catch(error){if(generation===headGeneration){console.error(error);disableHead('HEAD FAILED / Q-E MANUAL TEST')}}
}
function updateHead(now,dt){
  if(headEnabled){
    if(headBusy&&now-headRequestTime>10000){disableHead('HEAD TIMEOUT / Q-E MANUAL TEST');return}
    // The camera keeps reading on the menu (C still centres), but the paused view holds still.
    captureHeadFrame(now);if(!playing)return;
    // Filtering runs at display frequency, even between camera samples.
    // Hold the current view on loss; stale poses cannot create designations.
    if(headPoseFresh(now))setHeadTarget(headTarget,dt);
  }else{
    headPitchTarget=0;
    // Manual test: Q / E is a glance — the head snaps toward that side like a person looking, and comes
    // back to centre on release. The spring above gives it the human ease-in / ease-out.
    const q=keys.has('KeyQ'),e=keys.has('KeyE');manualHead=q&&!e?-55:e&&!q?55:0;
    setHeadTarget(manualHead,dt);
  }
  // Same stiffness as the yaw spring, without its overshoot: a few degrees do not need one.
  if(!headEnabled||headPoseFresh(now))headPitch+=(headPitchTarget-headPitch)*(1-Math.exp(-dt*2.15/Math.max(.03,+smooth.value)));
}

// ---------- PROJECTION ----------
let renderFocal=W*.88,worldGlow=1,NEAR_Z=.45;
const viewTransform={dx:0,dy:0,roll:0};
function screenPoint(p){if(!p)return null;const x=p.x-W/2,y=p.y-H/2,c=Math.cos(viewTransform.roll),s=Math.sin(viewTransform.roll);return{x:W/2+x*c-y*s+viewTransform.dx,y:H/2+x*s+y*c+viewTransform.dy}}
// The view basis is cached per yaw / pitch: project() runs ~20k times a frame and used to allocate
// forward() / right() and call sin / cos / tan every time.
const VB={yaw:NaN,s:0,c:1,pitch:NaN,tan:0};
function viewBasis(viewYaw,viewPitch){if(viewYaw!==VB.yaw){VB.yaw=viewYaw;VB.s=Math.sin(viewYaw);VB.c=Math.cos(viewYaw)}if(viewPitch!==VB.pitch){VB.pitch=viewPitch;VB.tan=Math.tan(viewPitch)}return VB}
function project(wx,wy,wz,viewYaw,viewPitch){const B=viewBasis(viewYaw,viewPitch),dx=wx-player.x,dz=wz-player.z,cx=dx*B.c+dz*B.s,cz=dx*B.s-dz*B.c;if(cz<NEAR_Z)return null;const scale=renderFocal/cz,horizon=H*.49+B.tan*renderFocal;return{x:W/2+cx*scale,y:horizon-(wy-CAMERA_Y)*scale,f:scale,depth:cz}}
function projectSegment(x0,y0,z0,x1,y1,z1,viewYaw,viewPitch){
  const B=viewBasis(viewYaw,viewPitch),near=.451;
  const d0=(x0-player.x)*B.s-(z0-player.z)*B.c,d1=(x1-player.x)*B.s-(z1-player.z)*B.c;
  if(d0<near&&d1<near)return null;
  if(d0<near){const t=(near-d0)/(d1-d0);x0=lerp(x0,x1,t);y0=lerp(y0,y1,t);z0=lerp(z0,z1,t)}
  else if(d1<near){const t=(near-d1)/(d0-d1);x1=lerp(x1,x0,t);y1=lerp(y1,y0,t);z1=lerp(z1,z0,t)}
  return [project(x0,y0,z0,viewYaw,viewPitch),project(x1,y1,z1,viewYaw,viewPitch)];
}
function horizonY(p){return H*.49+Math.tan(p)*renderFocal}
function poly(points,fill,stroke=null,lw=1){if(points.some(p=>!p))return;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke()}}
// WebGL renderer (three-cel.js), world: while worldRec is set (HF_THREE active), the world primitives below are
// recorded instead of drawn and handed to WebGL with the hostiles in one depth-tested pass.
// boxes / cyls: solids; lines: flat array [x0,y0,z0,x1,y1,z1,r,g,b,a,width,ink] per segment.
let worldRec=null;
function threeWorldOn(){const T=typeof window!=='undefined'&&window.HF_THREE;return !!(T&&T.active&&T.world)}
const rgbOf=c=>c.split(',').map(Number);
// HMD boot (sector start and redeploy): AOGANE has no canopy, and what AOI sees of the plant is the HMD's
// sensor reconstruction. At the start it is not built yet: only the camera image (sky, Earth, regolith) is
// there, and a scan ring runs out from the frame drawing the plant as it passes, its front edges lit bright.
// bootR is the ring's radius while the world is recorded, 1e9 otherwise. Controls stay live throughout.
// A reset on the menu waits for DEPLOY to boot (bootPending).
let hmdBoot=-1e9,bootR=1e9,bootPending=false;const BOOT_S=1.6,BOOT_R=260;
function bootK(x,z){if(bootR>=1e8)return 1;const d=Math.hypot(x-player.x,z-player.z);return d>bootR?0:d>bootR-12?2.6:1}
function bootFrame(){const t=(performance.now()-hmdBoot)/1000/BOOT_S;bootR=!worldRec||t>=1||t<0?1e9:6+(BOOT_R-6)*(1-(1-t)*(1-t))}
function bootRing(){if(bootR>=1e8)return;const k=1-bootR/BOOT_R;for(let i=0;i<72;i++){const a0=i/72*TAU,a1=(i+1)/72*TAU;
  recWSeg(player.x+Math.sin(a0)*bootR,.08,player.z-Math.cos(a0)*bootR,player.x+Math.sin(a1)*bootR,.08,player.z-Math.cos(a1)*bootR,'130,255,222',.9*(.35+.65*k),2.4,true,6);
  recWSeg(player.x+Math.sin(a0)*bootR*.94,.08,player.z-Math.cos(a0)*bootR*.94,player.x+Math.sin(a1)*bootR*.94,.08,player.z-Math.cos(a1)*bootR*.94,'130,255,222',.25*k,1.2,true)}}
// dots: [x,y,z,r,g,b,a,worldRadius,minPx,maxPx] for beacons and lamps (additive, screen-size clamped)
function recDot(x,y,z,color,alpha,radius,minPx,maxPx){if(!bootK(x,z))return;const c=rgbOf(color);worldRec.dots.push(x,y,z,c[0],c[1],c[2],alpha*ctx.globalAlpha,radius,minPx,maxPx)}
function recCurve(fn,n,color,alpha,width,ink=0){let p=fn(0);for(let i=1;i<=n;i++){const q=fn(i/n);recLine(p[0],p[1],p[2],q[0],q[1],q[2],color,alpha,width,ink);p=q}}
function recLine(x0,y0,z0,x1,y1,z1,color,alpha,width,ink=0){const k=bootK((x0+x1)/2,(z0+z1)/2);if(!k)return;if(!ink)alpha=Math.min(1,alpha*k);const c=rgbOf(color);worldRec.lines.push(x0,y0,z0,x1,y1,z1,c[0],c[1],c[2],alpha*ctx.globalAlpha,width,ink)}
// The rest of the frame in the same pass: sky, ground and the overlay effects. Each Canvas path keeps
// its code; while worldRec is set it records the same strokes instead, with their depth, so walls hide
// what stands behind them. Colours are '#rgb', '#rrggbb', 'r,g,b' or 'rgb(a)(...)'.
const colCache=new Map();
function colRGB(c){let v=colCache.get(c);if(v)return v;let m;
  if(c[0]==='#'){const h=c.length<6?c.slice(1,4).split('').map(x=>x+x).join(''):c.slice(1,7),n=parseInt(h,16);v=[n>>16,n>>8&255,n&255,1]}
  else if((m=/rgba?\(([^)]*)\)/.exec(c))){const p=m[1].split(',').map(Number);v=[p[0],p[1],p[2],p[3]??1]}
  else{const p=c.split(',').map(Number);v=[p[0],p[1],p[2],p[3]??1]}
  if(colCache.size>4000)colCache.clear();colCache.set(c,v);return v}
// screen-space segment between projected points (x, y, depth): [x0,y0,d0,0, x1,y1,d1,0, r,g,b,a, width,dashOn,dashOff,blur]
function recSeg(a,b,color,alpha,width,add=true,dash=null,blur=0){if(!a||!b||alpha<=.003||Math.min(a.depth,b.depth)>bootR)return;const c=colRGB(color);(add?worldRec.segsA:worldRec.segsN).push(a.x,a.y,a.depth,0,b.x,b.y,b.depth,0,c[0],c[1],c[2],alpha*c[3],width,dash?dash[0]:0,dash?dash[1]:0,blur)}
// world-space segment (clipped at the near plane on the GPU), same layout with mode 1
function recWSeg(x0,y0,z0,x1,y1,z1,color,alpha,width,add=true,blur=0){if(alpha<=.003)return;const bk=bootK((x0+x1)/2,(z0+z1)/2);if(!bk)return;alpha=Math.min(1,alpha*bk);const c=colRGB(color);(add?worldRec.segsA:worldRec.segsN).push(x0,y0,z0,1,x1,y1,z1,1,c[0],c[1],c[2],alpha*c[3],width,0,0,blur)}
// disc / ring / ellipse at a projected point: [x,y,d,0, radius,ringWidth(0 = filled),aspect,soft, r,g,b,a]; soft 1 = the radial light falloff
function recDisc(p,r,color,alpha,add=true,ring=0,aspect=1,soft=0){if(!p||alpha<=.003||r<=0||p.depth>bootR)return;const c=colRGB(color);(soft?worldRec.glows:add?worldRec.discsA:worldRec.discsN).push(p.x,p.y,p.depth,0,r,ring,aspect,soft,c[0],c[1],c[2],alpha*c[3])}
// flat ground quad (world corners in order): [x,y,z]*4, r,g,b,a
function recQuad(x0,z0,x1,z1,y,color,alpha){if(!bootK((x0+x1)/2,(z0+z1)/2))return;const c=colRGB(color);worldRec.quads.push(x0,y,z0,x1,y,z0,x1,y,z1,x0,y,z1,c[0],c[1],c[2],alpha*c[3])}
// Line batching: between beginLines() and endLines() world lines are collected per style (alpha
// rounded to 1/100) and stroked once per style instead of once per segment. Use it only around
// runs of lines with nothing else drawn in between.
let lineBatch=null;
function beginLines(){lineBatch=new Map()}
function endLines(){const B=lineBatch;lineBatch=null;if(!B||!B.size)return;ctx.save();
  for(const L of B.values()){ctx.strokeStyle=L.style;ctx.lineWidth=L.w;if(L.blur){ctx.shadowBlur=L.blur;ctx.shadowColor=L.sc}else ctx.shadowBlur=0;ctx.beginPath();const q=L.s;for(let i=0;i<q.length;i+=4){ctx.moveTo(q[i],q[i+1]);ctx.lineTo(q[i+2],q[i+3])}ctx.stroke()}
  ctx.restore()}
function worldLine3D(x0,y0,z0,x1,y1,z1,viewYaw,viewPitch,color='103,255,209',alpha=.18,width=.8,blur=0){
  if(worldRec){recLine(x0,y0,z0,x1,y1,z1,wc(color),Math.min(1,alpha*worldGlow),width);return true}
  const p=projectSegment(x0,y0,z0,x1,y1,z1,viewYaw,viewPitch);if(!p||!p[0]||!p[1])return false;
  color=wc(color);
  if(lineBatch){const a=Math.round(Math.min(1,alpha*worldGlow)*100)/100,k=color+'|'+a+'|'+width+'|'+blur;let L=lineBatch.get(k);if(!L)lineBatch.set(k,L={style:`rgba(${color},${a})`,w:width,blur,sc:`rgba(${color},.65)`,s:[]});L.s.push(p[0].x,p[0].y,p[1].x,p[1].y);return true}ctx.save();ctx.strokeStyle=`rgba(${color},${Math.min(1,alpha*worldGlow)})`;ctx.lineWidth=width;if(blur){ctx.shadowBlur=blur;ctx.shadowColor=`rgba(${color},.65)`}
  ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);ctx.lineTo(p[1].x,p[1].y);ctx.stroke();ctx.restore();return true;
}
// World structures share the frame's cel language: flat lit / shadow / top tones (kept dark so the
// pale characters read first), a heavy ink contour, back faces culled, and thin cyan accent edges.
// Night palette, shared by the Canvas and WebGL renderers. Unlit surfaces are dim teal-grey, not black:
// silhouettes and depth read without a lamp, and the neon still carries the frame.
// Earthshine: the night side of the Moon is lit by Earth, a cool blue-grey rather than the old teal (lamps stay cyan).
const WORLD_CEL={top:[64,80,98],lit:[44,57,72],shade:[24,32,43],ink:'#010404'};
// SECTOR 01 is on the Moon: a black sky (no air to light it), and the last stop is what far solids fade into,
// the dark grey of regolith out past the lamps rather than an air haze. WebGL adds stars, Earth and the regolith.
const NIGHT={sky:['#020308','#03050b','#05070d','#15181e'],ground:'#0b1514'};
// SKYDECK flies under a pre-dawn sky: deep blue, lighter toward the horizon, so a KITE reads against it.
const SKYDECK_SKY=NIGHT.sky; // the deck is on the Moon too: black sky, stars and Earth (WebGL)
// FREIGHT TUNNEL has no sky: this is only what far concrete fades into, a dark haze down the tube.
const TUNNEL_SKY=['#06090a','#080c0d','#0b1011','#0e1415'];
function skyStops(){return stage===2?TUNNEL_SKY:stage===3?SKYDECK_SKY:NIGHT.sky}
function celRGB(c){const t=syncMix,L=(c[0]+c[1]+c[2])/3;return`rgb(${lerp(c[0],L*2.1+10,t)|0},${lerp(c[1],L*1.45+4,t)|0},${lerp(c[2],L*.45,t)|0})`}
const worldInk=()=>clamp(H/720*2.4,1.6,4.5);
function celFaces(faces,edgeAlpha,edgeColor){
  if(!faces.length)return;ctx.lineJoin='round';ctx.fillStyle=ctx.strokeStyle=WORLD_CEL.ink;ctx.lineWidth=worldInk();ctx.beginPath();
  for(const [q] of faces){ctx.moveTo(q[0].x,q[0].y);for(let k=1;k<q.length;k++)ctx.lineTo(q[k].x,q[k].y);ctx.closePath()}ctx.fill();ctx.stroke();
  for(const [q,tone] of faces){ctx.fillStyle=celRGB(WORLD_CEL[tone]);ctx.beginPath();ctx.moveTo(q[0].x,q[0].y);for(let k=1;k<q.length;k++)ctx.lineTo(q[k].x,q[k].y);ctx.closePath();ctx.fill()}
  if(edgeAlpha>0){ctx.strokeStyle=`rgba(${wc(edgeColor)},${edgeAlpha})`;ctx.lineWidth=.72;ctx.beginPath();for(const [q] of faces){ctx.moveTo(q[0].x,q[0].y);for(let k=1;k<q.length;k++)ctx.lineTo(q[k].x,q[k].y);ctx.closePath()}ctx.stroke()}}
// boxPlain: bare concrete (tunnel walls, pillars, ceiling): panel seams and the hazard skirt, no windows
// and no roof rail.
let boxPlain=false;
function worldBox3D(cx,cz,w,d,y0,y1,viewYaw,viewPitch,fill='rgba(1,8,9,.96)',edgeAlpha=.12,edgeColor='91,240,204'){
  if(worldRec){const bk=bootK(cx,cz);if(!bk)return;if(bk>1)edgeAlpha=Math.max(edgeAlpha,.85);worldRec.boxes.push({cx,cz,w,d,y0,y1,edgeAlpha,edge:rgbOf(wc(edgeColor)),alpha:ctx.globalAlpha,plain:boxPlain});return}
  const xa=cx-w/2,xb=cx+w/2,za=cz-d/2,zb=cz+d/2;
  const lo=[project(xa,y0,za,viewYaw,viewPitch),project(xb,y0,za,viewYaw,viewPitch),project(xb,y0,zb,viewYaw,viewPitch),project(xa,y0,zb,viewYaw,viewPitch)];
  const hi=[project(xa,y1,za,viewYaw,viewPitch),project(xb,y1,za,viewYaw,viewPitch),project(xb,y1,zb,viewYaw,viewPitch),project(xa,y1,zb,viewYaw,viewPitch)];
  if(lo.every(v=>!v)&&hi.every(v=>!v))return;
  const ex=player.x,ez=player.z,faces=[],add=(q,tone,vis)=>{if(vis&&q.every(Boolean))faces.push([q,tone])};
  add([lo[0],lo[1],hi[1],hi[0]],'shade',ez<za);add([lo[1],lo[2],hi[2],hi[1]],'shade',ex>xb);add([lo[2],lo[3],hi[3],hi[2]],'lit',ez>zb);add([lo[3],lo[0],hi[0],hi[3]],'lit',ex<xa);
  add(hi,'top',CAMERA_Y>y1);add(lo,'shade',CAMERA_Y<y0);
  ctx.save();ctx.globalAlpha=1;celFaces(faces,edgeAlpha,edgeColor);
  // Illustration detail on near, large faces only: panel seams, window rows, hazard skirt, roof rail.
  const dist=Math.hypot(cx-player.x,cz-player.z),Hm=y1-y0;
  if(Hm>1.5&&w*d>6){const LW=[[xa,za],[xb,za],[xb,zb],[xa,zb]],vis=[ez<za,ex>xb,ez>zb,ex<xa],seed=Math.floor(cx*7.13+cz*3.71+y0*11);
    for(let i=0;i<4;i++){if(!vis[i])continue;const A=LW[i],B=LW[(i+1)%4],Wm=Math.hypot(B[0]-A[0],B[1]-A[1]);if(Wm<1.5)continue;
      // The face is a plane: camera-space x / depth are linear in u and height in v, so a point is two
      // multiply-adds and a divide (no project() call). Quads are written straight into flat arrays.
      const VBf=viewBasis(viewYaw,viewPitch),F=renderFocal,hor=H*.49+VBf.tan*F,ax0=A[0]-player.x,az0=A[1]-player.z,ux=B[0]-A[0],uz=B[1]-A[1],
        cxA=ax0*VBf.c+az0*VBf.s,czA=ax0*VBf.s-az0*VBf.c,cxU=ux*VBf.c+uz*VBf.s,czU=ux*VBf.s-uz*VBf.c,cy0=y0-CAMERA_Y,
        P=(u,v)=>{const cz=czA+u*czU;if(cz<NEAR_Z)return null;const k=F/cz;return{x:W/2+(cxA+u*cxU)*k,y:hor-(cy0+Hm*v)*k}},
        seg=(a,b)=>{if(a&&b){ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y)}};
      {const c0=P(0,0),c1=P(1,1);if(!c0||!c1||Math.hypot(c1.x-c0.x,c1.y-c0.y)<70)continue}
      // Quads of one colour go into one path and are filled once (windows: lit / dark, skirt: yellow).
      const qs=new Map(),quad=(u0,u1,v0,v1,col)=>{const z0=czA+u0*czU,z1=czA+u1*czU;if(z0<NEAR_Z||z1<NEAR_Z)return;const k0=F/z0,k1=F/z1,x0=W/2+(cxA+u0*cxU)*k0,x1=W/2+(cxA+u1*cxU)*k1,b0=cy0+Hm*v0,b1=cy0+Hm*v1;
          let L=qs.get(col);if(!L)qs.set(col,L=[]);L.push(x0,hor-b0*k0,x1,hor-b0*k1,x1,hor-b1*k1,x0,hor-b1*k0)},
        fillQuads=()=>{for(const [col,L] of qs){ctx.fillStyle=col;ctx.beginPath();for(let i=0;i<L.length;i+=8){ctx.moveTo(L[i],L[i+1]);ctx.lineTo(L[i+2],L[i+3]);ctx.lineTo(L[i+4],L[i+5]);ctx.lineTo(L[i+6],L[i+7]);ctx.closePath()}ctx.fill()}qs.clear()};
      ctx.globalAlpha=.55;ctx.strokeStyle=WORLD_CEL.ink;ctx.lineWidth=.9;ctx.beginPath();
      for(let k=1;k*3.2<Hm;k++)seg(P(0,k*3.2/Hm),P(1,k*3.2/Hm));for(let k=1;k*6<Wm;k++)seg(P(k*6/Wm,0),P(k*6/Wm,1));ctx.stroke();
      if(Hm>5&&hash(seed+i)>.4&&!boxPlain){let n=0;ctx.globalAlpha=.8;for(let v=1.6;v<Hm-1&&n<48;v+=3.2)for(let u=1.4;u<Wm-1&&n<48;u+=2.4,n++){const lit=hash(seed+i*31+n*7)>.62;quad((u-.45)/Wm,(u+.45)/Wm,(v-.5)/Hm,(v+.5)/Hm,lit?'rgba(150,240,226,.55)':'rgba(2,8,10,.85)')}fillQuads()}
      if(y0<.1&&Hm>2){const n=Math.max(2,Math.round(Wm/1.1)),hb=Math.min(1,.9/Hm);ctx.globalAlpha=.85;for(let k=0;k<n;k+=2)quad(k/n,(k+1)/n,0,hb,'#d9b443');fillQuads();ctx.globalAlpha=.9;ctx.strokeStyle=WORLD_CEL.ink;ctx.lineWidth=1;ctx.beginPath();seg(P(0,hb),P(1,hb));ctx.stroke()}
      if(Hm>4&&CAMERA_Y<y1&&!boxPlain){const R2=(u,dy)=>project(lerp(A[0],B[0],u),y1+dy,lerp(A[1],B[1],u),viewYaw,viewPitch);ctx.globalAlpha=.8;ctx.strokeStyle=WORLD_CEL.ink;ctx.lineWidth=1.2;ctx.beginPath();seg(R2(0,1.1),R2(1,1.1));seg(R2(0,.55),R2(1,.55));for(let k=0;k<=Math.ceil(Wm/2);k++){const u=Math.min(1,k*2/Wm);seg(R2(u,0),R2(u,1.1))}ctx.stroke()}}}
  ctx.restore();
}
function worldRingXY(cx,cy,cz,rx,ry,viewYaw,viewPitch,alpha=.20,color='103,255,209',width=1,phase=0,segments=42){
  if(worldRec){const c=wc(color),a=Math.min(1,alpha*worldGlow);for(let i=0;i<segments;i++){const a0=phase+i/segments*TAU,a1=phase+(i+1)/segments*TAU;recLine(cx+Math.cos(a0)*rx,cy+Math.sin(a0)*ry,cz,cx+Math.cos(a1)*rx,cy+Math.sin(a1)*ry,cz,c,a,width)}return}
  color=wc(color);let prev=null;ctx.save();ctx.strokeStyle=`rgba(${color},${Math.min(1,alpha*worldGlow)})`;ctx.lineWidth=width;ctx.shadowBlur=alpha>.22?8:3;ctx.shadowColor=`rgba(${color},.65)`;
  ctx.beginPath();let any=false;
  for(let i=0;i<=segments;i++){const a=phase+i/segments*TAU,p=project(cx+Math.cos(a)*rx,cy+Math.sin(a)*ry,cz,viewYaw,viewPitch);if(p){if(prev)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);any=true}prev=p}
  if(any)ctx.stroke();ctx.restore();
}
// SKYDECK ends at sunrise: the sun climbs to the left horizon as the deck's hostiles break and clears it with the
// last one (0 = below, 1 = just up). Eased per frame so a kill brightens the deck over a second or two.
let sunK=0;
function sunTarget(){if(stage!==3)return 0;let n=0,a=0;for(const e of enemies){n++;if(e.alive)a++}return n?1-a/n:0}
function drawSky(viewYaw,pitch){
  {const t=sunTarget();sunK=stage===3?sunK+(t-sunK)*.025:0}
  if(worldRec){const hy=horizonY(pitch);worldRec.sky={hy,glowY0:hy-H*.12-H*.1*syncMix,glowY1:hy+H*.16,glowA:.06+.13*syncMix,glowCol:rgbOf(wc('35,151,118')),stops:skyStops().map(colRGB),ground:colRGB(NIGHT.ground),moon:stage===2?0:1,sun:sunK,yaw:viewYaw,foc:renderFocal,camY:CAMERA_Y,px:player.x,pz:player.z,cel:[WORLD_CEL.top,WORLD_CEL.lit,WORLD_CEL.shade]};return}
  const hy=horizonY(pitch),g=ctx.createLinearGradient(0,0,0,H);
  {const S=skyStops();g.addColorStop(0,S[0]);g.addColorStop(.42,S[1]);g.addColorStop(.70,S[2]);g.addColorStop(1,S[3])};
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  if(stage!==2)return; // no air on the Moon to carry a glow along the horizon
  // A very low, physical foundry glow on the horizon. It is not a HUD effect.
  const glow=ctx.createLinearGradient(0,hy-H*.12-H*.1*syncMix,0,hy+H*.16);glow.addColorStop(0,'rgba(29,112,91,0)');glow.addColorStop(.58,`rgba(${wc('35,151,118')},${(.06+.13*syncMix).toFixed(3)})`);glow.addColorStop(1,'rgba(21,79,66,0)');ctx.fillStyle=glow;ctx.fillRect(0,hy-H*.12,W,H*.28);
  ctx.save();ctx.strokeStyle='rgba(99,255,211,.065)';ctx.lineWidth=1;ctx.shadowBlur=5;ctx.shadowColor='#55ffd0';ctx.beginPath();ctx.moveTo(0,hy);ctx.lineTo(W,hy);ctx.stroke();ctx.restore();
}
function drawDistantDistrict(viewYaw,viewPitch){
  // v30: the Foundry is a megastructure, not a street bordered by boxes. Multiple vertical layers,
  // silhouettes and operating infrastructure establish scale before the combat lane is read.
  ctx.save();
  const skyline=[
    [-154,-236,42,54,0,72,.050],[-112,-246,28,38,0,42,.045],[-76,-238,52,44,0,62,.052],[-28,-252,56,62,0,50,.042],
    [34,-248,48,46,0,36,.038],[79,-240,38,44,0,67,.055],[124,-228,48,54,0,84,.062],[162,-214,34,44,0,54,.045]
  ];
  for(const [x,z,w,d,y0,y1,a] of skyline)worldBox3D(x,z,w,d,y0,y1,viewYaw,viewPitch,'rgba(1,7,8,.97)',a);

  // LEFT LANDMARK: vector relay crown. The rotating inner ring makes the city feel operational.
  worldBox3D(-84,-192,17,17,0,61,viewYaw,viewPitch,'rgba(1,7,8,.985)',.15);
  worldLine3D(-84,61,-192,-84,82,-192,viewYaw,viewPitch,'103,255,209',.30,1,7);
  worldRingXY(-84,70,-192,13,13,viewYaw,viewPitch,.22,'103,255,209',1.05,0,48);
  worldRingXY(-84,70,-192,8.2,8.2,viewYaw,viewPitch,.32,'129,255,221',1.15,gameTime*.18,32);
  for(let i=0;i<4;i++){const a=gameTime*.18+i*TAU/4;worldLine3D(-84+Math.cos(a)*8.2,70+Math.sin(a)*8.2,-192,-84+Math.cos(a)*12.6,70+Math.sin(a)*12.6,-192,viewYaw,viewPitch,'112,245,210',.18,.7)}

  // RIGHT LANDMARK: a forked thermal tower so left/right orientation remains readable during head turns.
  worldBox3D(108,-206,24,20,0,54,viewYaw,viewPitch,'rgba(1,8,9,.985)',.12);
  for(const x of [101,115]){
    worldBox3D(x,-207,7,8,46,82,viewYaw,viewPitch,'rgba(1,7,8,.98)',.12);
    for(const y of [57,68,79])worldRingXY(x,y,-207,4.2,1.7,viewYaw,viewPitch,.16,'98,236,202',.8,0,24);
  }
  worldLine3D(101,73,-207,115,73,-207,viewYaw,viewPitch,'103,255,209',.17,.8);

  // A stacked transfer deck spans the background and a second service deck sits higher and farther back.
  for(const [z,y,w,a] of [[-174,31,8,.14],[-218,49,5,.08]]){
    if(worldRec){recLine(-168,y,z,168,y,z,'1,8,9',.96,w,1);recLine(-168,y,z,168,y,z,'103,255,209',a,.8);continue}
    const seg=projectSegment(-168,y,z,168,y,z,viewYaw,viewPitch);if(seg&&seg[0]&&seg[1]){ctx.strokeStyle='rgba(1,8,9,.96)';ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(seg[0].x,seg[0].y);ctx.lineTo(seg[1].x,seg[1].y);ctx.stroke();ctx.strokeStyle=`rgba(103,255,209,${a})`;ctx.lineWidth=.8;ctx.stroke()}
  }
  // Vertical hanging supports make the far deck read as enormous architecture rather than a screen line.
  beginLines();for(const x of [-144,-96,-48,0,48,96,144]){worldLine3D(x,31,-174,x,0,-174,viewYaw,viewPitch,'87,222,190',.055,.55);worldLine3D(x,49,-218,x,28,-218,viewYaw,viewPitch,'87,222,190',.035,.5)}endLines();

  // Moving carrier pods on the far deck. Their tiny motion is deliberately slow: industrial scale, not traffic noise.
  for(let i=0;i<5;i++){const span=300,x=-150+((gameTime*5.5+i*63)%span);worldBox3D(x,-173,7.5,3.2,30,34.2,viewYaw,viewPitch,'rgba(4,18,16,.96)',.18);worldLine3D(x-2.5,32.2,-171.2,x+2.5,32.2,-171.2,viewYaw,viewPitch,'138,255,222',.34,.8,4)}

  // Exhaust / process stacks: repeated thin towers create vertical scale without filling the center with noise.
  for(const [x,z,h] of [[-142,-204,46],[-130,-212,59],[142,-194,51],[154,-205,66],[-45,-226,34],[52,-230,42]]){
    worldBox3D(x,z,5.6,5.6,0,h,viewYaw,viewPitch,'rgba(1,7,8,.98)',.075);
    for(const y of [h*.38,h*.67,h*.90])worldRingXY(x,y,z,3.2,1.15,viewYaw,viewPitch,.08,'89,222,190',.65,0,18);
  }

  // Foundry throat: a huge asymmetric processing gate at the end of the district. Its silhouette is
  // deliberately rectilinear/angled so it cannot be mistaken for HMD symbology.
  const gateZ=-242,gx=18,gL=gx-38,gR=gx+38;
  worldBox3D(gL,gateZ,10,16,0,58,viewYaw,viewPitch,'rgba(1,7,8,.99)',.11);
  worldBox3D(gR,gateZ,13,19,0,68,viewYaw,viewPitch,'rgba(1,7,8,.99)',.13);
  worldBox3D(gx,gateZ,70,15,48,57,viewYaw,viewPitch,'rgba(1,7,8,.99)',.12);
  worldLine3D(gL,52,gateZ,gx-14,57,gateZ,viewYaw,viewPitch,'103,255,209',.11,.75);
  worldLine3D(gR,62,gateZ,gx+14,57,gateZ,viewYaw,viewPitch,'103,255,209',.13,.82);
  worldLine3D(gx-14,57,gateZ,gx+14,57,gateZ,viewYaw,viewPitch,'123,255,217',.17,.88,4);
  // Slow vertical freight elevators make the scale readable even when the player is stationary.
  const liftY=8+((gameTime*3.2)%38);worldBox3D(gR-1.8,gateZ-1,7.8,6.5,liftY,liftY+5.8,viewYaw,viewPitch,'rgba(3,16,14,.98)',.21);
  worldLine3D(gR-5,liftY+2.9,gateZ-4.3,gR+1.6,liftY+2.9,gateZ-4.3,viewYaw,viewPitch,'139,255,222',.34,.82,4);
  ctx.restore();
}
function drawGround(viewYaw,viewPitch){
  if(worldRec){recordGround();return}
  const hy=horizonY(viewPitch);ctx.fillStyle=NIGHT.ground;ctx.fillRect(0,hy,W,H-hy);
  ctx.save();ctx.beginPath();ctx.rect(0,hy,W,H-hy);ctx.clip();ctx.lineCap='round';
  const line=(x0,z0,x1,z1,alpha=.16,width=1,y=.015,color='83,255,202')=>{const p=projectSegment(x0,y,z0,x1,y,z1,viewYaw,viewPitch);if(!p||!p[0]||!p[1])return;ctx.strokeStyle=`rgba(${wc(color)},${alpha})`;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);ctx.lineTo(p[1].x,p[1].y);ctx.stroke()};
  const slab=(x0,z0,x1,z1,fill,y=.008)=>{const p=[project(x0,y,z0,viewYaw,viewPitch),project(x1,y,z0,viewYaw,viewPitch),project(x1,y,z1,viewYaw,viewPitch),project(x0,y,z1,viewYaw,viewPitch)];if(p.every(Boolean))poly(p,fill)};
  // Main lane is now a layered industrial trench: central combat deck + recessed transfer gutters + outer service plates.
  for(let z=-150;z<150;z+=12){const near=clamp(1-Math.abs((z+6)-player.z)/190,.24,1);slab(-17.5,z,17.5,z+12,`rgba(7,24,21,${.36*near})`);slab(-29,z,-19.5,z+12,`rgba(1,8,8,${.72*near})`);slab(19.5,z,29,z+12,`rgba(1,8,8,${.72*near})`);slab(-38,z,-30,z+12,`rgba(4,15,14,${.22*near})`);slab(30,z,38,z+12,`rgba(4,15,14,${.22*near})`)}
  // Recess lips and embedded conduits create physical depth at speed.
  for(const x of [-29,-19.5,19.5,29])line(x,-150,x,150,.16,1.0,.045);
  for(const x of [-17.5,17.5])line(x,-150,x,150,.42,1.5,.055);
  for(const x of [-2.6,2.6])line(x,-150,x,150,.2,.85,.055,'152,221,204');
  for(let z=-144;z<=144;z+=24){line(-150,z,-38,z,.020,.5);line(38,z,150,z,.020,.5);line(-17.5,z,17.5,z,.085,.68,.025,'128,218,196')}
  // Service plates and access hatches add local scale but fade with distance.
  const z0=Math.max(-145,Math.floor((player.z-90)/12)*12),z1=Math.min(145,player.z+92);
  for(let z=z0;z<=z1;z+=12){const fade=clamp(1-Math.abs(z-player.z)/105,.10,1);for(const side of [-1,1]){slab(side*10.8-1.2,z+1.8,side*10.8+1.2,z+4.8,`rgba(72,161,140,${.055*fade})`,.062);line(side*10.8-1.2,z+1.8,side*10.8+1.2,z+1.8,.07*fade,.5,.064)}}
  // Energy/data carriers run through the recessed gutters, not painted on the roadway.
  for(const side of [-1,1])for(let i=0;i<6;i++){const span=270,z=((gameTime*(16+side*1.1)+i*47+135)%span)-135,p0=project(side*24.2,.080,z,viewYaw,viewPitch),p1=project(side*24.2,.080,z-5.6,viewYaw,viewPitch);if(p0&&p1){ctx.strokeStyle='rgba(119,255,217,.34)';ctx.shadowBlur=7;ctx.shadowColor='#55ffd0';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(p1.x,p1.y);ctx.stroke();ctx.shadowBlur=0}}
  // Cel deck: flat concrete tone, ink panel joints, painted dashed white lanes and yellow lip lines.
  {const zA=Math.floor((player.z-80)/6)*6,zB=player.z+80,P=(x,z)=>project(x,.02,z,viewYaw,viewPitch),seg=(x0,z0,x1,z1)=>{const p=projectSegment(x0,.03,z0,x1,.03,z1,viewYaw,viewPitch);if(p&&p[0]&&p[1]){ctx.moveTo(p[0].x,p[0].y);ctx.lineTo(p[1].x,p[1].y)}};
    for(let z=zA;z<zB;z+=6){const q=[P(-17.5,z),P(17.5,z),P(17.5,z+6),P(-17.5,z+6)];if(q.every(Boolean)){const f=clamp(1-Math.abs(z+3-player.z)/80,0,1);ctx.globalAlpha=.85*f;ctx.fillStyle=celRGB(Math.floor(z/6)%2?[24,36,38]:[27,40,42]);ctx.beginPath();q.forEach((t,i)=>i?ctx.lineTo(t.x,t.y):ctx.moveTo(t.x,t.y));ctx.closePath();ctx.fill()}}
    ctx.globalAlpha=.75;ctx.strokeStyle=WORLD_CEL.ink;ctx.lineWidth=1.2;ctx.beginPath();for(let z=zA;z<zB;z+=6)seg(-17.5,z,17.5,z);for(let x=-17.5;x<=17.5;x+=5.83)seg(x,zA,x,zB);ctx.stroke();
    ctx.globalAlpha=.6;ctx.strokeStyle='#dfe9e4';ctx.lineWidth=2.4;ctx.beginPath();for(const x of [-8.75,8.75])for(let z=Math.floor(zA/8)*8;z<zB;z+=8)seg(x,z,x,z+4);ctx.stroke();
    ctx.globalAlpha=.75;ctx.strokeStyle='#d9b443';ctx.lineWidth=2.6;ctx.beginPath();for(const x of [-16.9,16.9])seg(x,zA,x,zB);ctx.stroke();ctx.globalAlpha=1}
  // Segmented center fiducials only; no decorative full stripe.
  for(let z=Math.floor((player.z-105)/18)*18;z<player.z+105;z+=18){const a=project(-.48,.066,z,viewYaw,viewPitch),b=project(.48,.066,z+4.6,viewYaw,viewPitch);if(a&&b){const fade=clamp(1-Math.abs(z-player.z)/118,.14,1);ctx.strokeStyle=`rgba(194,235,223,${.11*fade})`;ctx.lineWidth=.85;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}}
  ctx.restore();
}
// drawGround for the WebGL pass, in the same order: the deck tiles (alpha .85) are laid over the
// gutters, conduits and hatches as on Canvas, so the ground has two layers of quads and lines.
function recordGround(){
  const R=worldRec,N=R.segsN,Q=R.quads;R.segsN=R.ground1;R.quads=R.groundQ1;
  const line=(x0,z0,x1,z1,alpha=.16,width=1,y=.015,color='83,255,202')=>recWSeg(x0,y,z0,x1,y,z1,wc(color),alpha,width,false);
  const slab=(x0,z0,x1,z1,fill,y=.008)=>recQuad(x0,z0,x1,z1,y,fill,1);
  for(let z=-150;z<150;z+=12){const near=clamp(1-Math.abs((z+6)-player.z)/190,.24,1);slab(-17.5,z,17.5,z+12,`rgba(7,24,21,${.36*near})`);slab(-29,z,-19.5,z+12,`rgba(1,8,8,${.72*near})`);slab(19.5,z,29,z+12,`rgba(1,8,8,${.72*near})`);slab(-38,z,-30,z+12,`rgba(4,15,14,${.22*near})`);slab(30,z,38,z+12,`rgba(4,15,14,${.22*near})`)}
  for(const x of [-29,-19.5,19.5,29])line(x,-150,x,150,.16,1.0,.045);
  for(const x of [-17.5,17.5])line(x,-150,x,150,.42,1.5,.055);
  for(const x of [-2.6,2.6])line(x,-150,x,150,.2,.85,.055,'152,221,204');
  for(let z=-144;z<=144;z+=24){line(-150,z,-38,z,.020,.5);line(38,z,150,z,.020,.5);line(-17.5,z,17.5,z,.085,.68,.025,'128,218,196')}
  const z0=Math.max(-145,Math.floor((player.z-90)/12)*12),z1=Math.min(145,player.z+92);
  for(let z=z0;z<=z1;z+=12){const fade=clamp(1-Math.abs(z-player.z)/105,.10,1);for(const side of [-1,1]){slab(side*10.8-1.2,z+1.8,side*10.8+1.2,z+4.8,`rgba(72,161,140,${.055*fade})`,.062);line(side*10.8-1.2,z+1.8,side*10.8+1.2,z+1.8,.07*fade,.5,.064)}}
  for(const side of [-1,1])for(let i=0;i<6;i++){const span=270,z=((gameTime*(16+side*1.1)+i*47+135)%span)-135;recWSeg(side*24.2,.08,z,side*24.2,.08,z-5.6,'119,255,217',.34,1.2,false,7)}
  R.segsN=R.ground2;R.quads=R.groundQ2;
  const zA=Math.floor((player.z-80)/6)*6,zB=player.z+80,seg=(x0,z0,x1,z1,col,a,w)=>recWSeg(x0,.03,z0,x1,.03,z1,col,a,w,false);
  for(let z=zA;z<zB;z+=6){const f=clamp(1-Math.abs(z+3-player.z)/80,0,1);if(f>0)recQuad(-17.5,z,17.5,z+6,.02,celRGB(Math.floor(z/6)%2?[24,36,38]:[27,40,42]),.85*f)}
  for(let z=zA;z<zB;z+=6)seg(-17.5,z,17.5,z,WORLD_CEL.ink,.75,1.2);for(let x=-17.5;x<=17.5;x+=5.83)seg(x,zA,x,zB,WORLD_CEL.ink,.75,1.2);
  for(const x of [-8.75,8.75])for(let z=Math.floor(zA/8)*8;z<zB;z+=8)seg(x,z,x,z+4,'#dfe9e4',.6,2.4);
  for(const x of [-16.9,16.9])seg(x,zA,x,zB,'#d9b443',.75,2.6);
  for(let z=Math.floor((player.z-105)/18)*18;z<player.z+105;z+=18){const fade=clamp(1-Math.abs(z-player.z)/118,.14,1);recWSeg(-.48,.066,z,.48,.066,z+4.6,'194,235,223',.11*fade,.85,false)}
  R.segsN=N;R.quads=Q;
}
// ---------- FACILITIES (v32) ------------------------------------------------------
// The 18 collision envelopes are unchanged (gameplay), but what stands inside them is now
// working plant instead of composite boxes: cooling towers (ruled hyperboloid lattice),
// process stacks, substations and foundry blocks. Light rules: dark mass first, edges
// second; the bar wave and kill waves travel through the plant; SYNC turns it gold.
const killWaves=[];
function plantGlow(x,z,depth){
  let k=.18;
  for(const w of killWaves){const age=gameTime-w.t;if(age<0||age>1.6)continue;const d=Math.hypot(x-w.x,z-w.z);k+=Math.exp(-Math.pow((d-age*75)/11,2))*2.2*(1-age/1.6)}
  return 1+k;
}
function vCyl(cx,cz,r0,r1,y0,y1,viewYaw,viewPitch,o){
  if(worldRec){if(!bootK(cx,cz))return true;const c=wc(o.color||'91,255,207'),g=o.glow??1;worldRec.cyls.push({cx,cz,r0,r1,y0,y1,alpha:o.alpha??1});
    const ring=(r,y,a)=>{for(let i=0;i<24;i++){const t0=i/24*TAU,t1=(i+1)/24*TAU;recLine(cx+Math.cos(t0)*r,y,cz+Math.sin(t0)*r,cx+Math.cos(t1)*r,y,cz+Math.sin(t1)*r,c,a,.8)}};
    if(o.edge){ring(r1,y1,Math.min(1,o.edge*1.2*g));for(const y of o.bands||[])ring(lerp(r0,r1,(y-y0)/(y1-y0)),y,Math.min(1,o.edge*.55*g))}return true}
  // Vertical cylinder / cone: dark body from the view-dependent tangent silhouette, then edges.
  const n=o.n||24,ex=player.x,ez=player.z,base=Math.atan2(cz-ez,cx-ex),t1=base+Math.PI/2,t2=base-Math.PI/2,ring=(r,y,a0,a1,m)=>{const pts=[];for(let i=0;i<=m;i++){const a=a0+(a1-a0)*i/m;pts.push(project(cx+Math.cos(a)*r,y,cz+Math.sin(a)*r,viewYaw,viewPitch))}return pts};
  const near=ring(r0,y0,t1,t1+Math.PI,n/2),far=ring(r1,y1,t2,t2+Math.PI,n/2),topNear=ring(r1,y1,t1,t1+Math.PI,n/2);
  const body=[...near,...far];if(body.some(p=>!p))return false;
  ctx.globalAlpha=o.alpha;const faces=[[body,'shade']],lx=KEY_LIGHT[0],lz=KEY_LIGHT[2],lowL=[],upL=[];
  for(let i=0;i<=n/2;i++){const a=t1+Math.PI*i/(n/2);if(Math.cos(a)*lx+Math.sin(a)*lz>0){lowL.push(project(cx+Math.cos(a)*r0,y0,cz+Math.sin(a)*r0,viewYaw,viewPitch));upL.push(project(cx+Math.cos(a)*r1,y1,cz+Math.sin(a)*r1,viewYaw,viewPitch))}}
  if(lowL.length>1)faces.push([[...lowL,...upL.reverse()],'lit']);
  if(CAMERA_Y>y1){const cap=ring(r1,y1,0,TAU,n);faces.push([cap,'top'])}
  celFaces(faces.filter(f=>f[0].every(Boolean)),0);
  const E=(pts,a,w=.8)=>{ctx.strokeStyle=`rgba(${wc(o.color||'91,255,207')},${Math.min(1,a*o.glow)})`;ctx.lineWidth=w;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke()};
  E([...far,...topNear.slice().reverse(),far[0]],o.edge*1.2,.9);E(near,o.edge*.7);E([near[0],far[far.length-1]],o.edge,.8);E([near[near.length-1],far[0]],o.edge,.8);
  for(const y of o.bands||[]){const r=lerp(r0,r1,(y-y0)/(y1-y0)),b=ring(r,y,t1,t1+Math.PI,n/2);if(b.every(Boolean))E(b,o.edge*.55,.6)}
  return true;
}
function drawCoolingTower(b,vy,vp,o){
  const R=Math.min(b.w,b.d)*.46,h=b.h*1.25,cx=b.x,cz=b.z,N=30,phi=1.05,rTop=R*.78;
  vCyl(cx,cz,R,rTop,0,h,vy,vp,{...o,edge:.0,fill:'rgba(1,6,7,.62)'});
  // Two families of straight members whose twist forms the hyperboloid waist; far members dimmer.
  const eyeA=Math.atan2(player.z-cz,player.x-cx);ctx.lineWidth=.6;
  // The tower is a solid shell (it hides what is behind it, so it must look like it does): the one frustum
  // is replaced by eight that follow the hyperboloid just inside its straight members, which stay on top.
  if(worldRec){const c1=wc('91,255,207'),c2=wc('120,255,220'),c3=wc('150,255,230'),body=worldRec.cyls.pop(),rad=t=>Math.sqrt(((1-t)*R)**2+(t*rTop)**2+2*(1-t)*t*R*rTop*Math.cos(phi))*.95;
    if(body)for(let i=0;i<8;i++){const t0=i/8,t1=(i+1)/8;worldRec.cyls.push({...body,r0:rad(t0),r1:rad(t1),y0:h*t0,y1:h*t1})}
    for(const fam of [1,-1])for(let i=0;i<N;i++){const a=i/N*TAU,a2=a+fam*phi;recLine(cx+Math.cos(a)*R,0,cz+Math.sin(a)*R,cx+Math.cos(a2)*rTop,h,cz+Math.sin(a2)*rTop,c1,Math.min(1,.17*o.glow),.6)}
    for(const [y,r,a] of [[0,R,.25],[h*.62,R*Math.cos(phi/2)*.98,.22],[h,rTop,.45]])for(let i=0;i<40;i++){const t0=i/40*TAU,t1=(i+1)/40*TAU;recLine(cx+Math.cos(t0)*r,y,cz+Math.sin(t0)*r,cx+Math.cos(t1)*r,y,cz+Math.sin(t1)*r,c2,Math.min(1,a*o.glow),y===h?1.2:.8)}
    for(let k=0;k<3;k++){const t=(gameTime*.12+k/3)%1,y=h+t*14,r=rTop*(1+t*.5);for(let i=0;i<24;i++){const t0=i/24*TAU,t1=(i+1)/24*TAU;recLine(cx+Math.cos(t0)*r,y,cz+Math.sin(t0)*r,cx+Math.cos(t1)*r,y,cz+Math.sin(t1)*r,c3,(1-t)*.08*o.glow,.8)}}
    return}
  for(const fam of [1,-1])for(let i=0;i<N;i++){const a=i/N*TAU,a2=a+fam*phi,mid=(a+a2)/2,front=Math.cos(mid-eyeA)>0;
    const p=projectSegment(cx+Math.cos(a)*R,0,cz+Math.sin(a)*R,cx+Math.cos(a2)*rTop,h,cz+Math.sin(a2)*rTop,vy,vp);if(!p||!p[0]||!p[1])continue;
    ctx.strokeStyle=`rgba(${wc('91,255,207')},${Math.min(1,(front?.17:.05)*o.glow)})`;ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);ctx.lineTo(p[1].x,p[1].y);ctx.stroke()}
  for(const [y,r,a] of [[0,R,.25],[h*.62,R*Math.cos(phi/2)*.98,.22],[h,rTop,.45]]){let prev=null;ctx.strokeStyle=`rgba(${wc('120,255,220')},${Math.min(1,a*o.glow)})`;ctx.lineWidth=y===h?1.2:.8;ctx.beginPath();
    for(let i=0;i<=40;i++){const t=i/40*TAU,q=project(cx+Math.cos(t)*r,y,cz+Math.sin(t)*r,vy,vp);if(q&&prev){ctx.moveTo(prev.x,prev.y);ctx.lineTo(q.x,q.y)}prev=q}ctx.stroke()}
  // Exhaust: slow rising heat rings above the lip.
  for(let k=0;k<3;k++){const t=(gameTime*.12+k/3)%1,y=h+t*14,r=rTop*(1+t*.5);let prev=null;ctx.strokeStyle=`rgba(${wc('150,255,230')},${(1-t)*.08*o.glow})`;ctx.beginPath();for(let i=0;i<=24;i++){const a=i/24*TAU,q=project(cx+Math.cos(a)*r,y,cz+Math.sin(a)*r,vy,vp);if(q&&prev){ctx.moveTo(prev.x,prev.y);ctx.lineTo(q.x,q.y)}prev=q}ctx.stroke()}
}
function drawProcessStacks(b,vy,vp,o){
  const along=b.w>b.d,r=Math.min(b.w,b.d)*.22,off=(along?b.w:b.d)*.24,h=b.h,c=[[-1],[1]].map(([s])=>along?[b.x+s*off,b.z]:[b.x,b.z+s*off]);
  worldBox3D(b.x,b.z,b.w*.9,b.d*.9,0,h*.12,vy,vp,'rgba(1,7,8,.96)',.1*o.glow,wc('91,240,204'));
  const order=c.map(p=>({p,d:Math.hypot(p[0]-player.x,p[1]-player.z)})).sort((a,b)=>b.d-a.d);
  for(const {p} of order){vCyl(p[0],p[1],r,r*.86,0,h,vy,vp,{...o,edge:.16,bands:[h*.25,h*.5,h*.75,h*.92]});
    if(worldRec){recDot(p[0],h+.6,p[1],'255,74,58',Math.sin(gameTime*3.2+p[0])>.2?.9:.15,.25,1,4);continue}
    const top=project(p[0],h+.6,p[1],vy,vp);if(top){const on=Math.sin(gameTime*3.2+p[0])>.2;ctx.globalAlpha=on?.9:.15;ctx.fillStyle='#ff4a3a';ctx.beginPath();ctx.arc(top.x,top.y,clamp(top.f*.25,1,4),0,TAU);ctx.fill();ctx.globalAlpha=o.alpha}}
  for(const y of [h*.38,h*.7]){const a=c[0],z=c[1];worldLine3D(a[0],y,a[1],z[0],y,z[1],vy,vp,'91,240,204',.2*o.glow,1.4);worldLine3D(a[0],y+1.2,a[1],z[0],y+1.2,z[1],vy,vp,'91,240,204',.1*o.glow,.7)}
}
function drawSubstation(b,vy,vp,o){
  const W2=b.w/2,D2=b.d/2,h=Math.min(b.h,24);
  worldBox3D(b.x,b.z,b.w*.92,b.d*.92,0,1.2,vy,vp,'rgba(1,7,8,.96)',.08*o.glow,wc('91,240,204'));
  // Transformer bank with radiator fins.
  for(const s of [-1,1]){const tx=b.x+s*W2*.45,tz=b.z-D2*.25;worldBox3D(tx,tz,b.w*.26,b.d*.28,1.2,h*.34,vy,vp,'rgba(1,8,9,.97)',.16*o.glow,wc('91,240,204'));
    for(let k=-2;k<=2;k++)worldLine3D(tx+k*b.w*.045,1.6,tz+b.d*.15,tx+k*b.w*.045,h*.3,tz+b.d*.15,vy,vp,'91,240,204',.07*o.glow,.6)}
  // Insulator stacks and the busbar portal.
  const portalZ=b.z+D2*.3,cols=[-.36,-.12,.12,.36];
  for(const k of cols){const x=b.x+k*b.w;worldLine3D(x,1.2,portalZ,x,h*.8,portalZ,vy,vp,'91,240,204',.2*o.glow,1.1);
    for(let j=0;j<6;j++){const y=h*.42+j*1.1;worldLine3D(x-.6,y,portalZ,x+.6,y,portalZ,vy,vp,'140,255,225',.14*o.glow,.7)}}
  worldLine3D(b.x-b.w*.42,h*.8,portalZ,b.x+b.w*.42,h*.8,portalZ,vy,vp,'91,240,204',.25*o.glow,1.3);
  worldLine3D(b.x-b.w*.42,h*.74,portalZ,b.x+b.w*.42,h*.74,portalZ,vy,vp,'91,240,204',.12*o.glow,.8);
  // Occasional discharge on its own per-block timer: a short jagged arc between two insulators.
  const arcPh=(gameTime/(2.3+(b.seed%5)*.37)+hash(b.seed))%1,arcN=Math.floor(gameTime/(2.3+(b.seed%5)*.37)+hash(b.seed));if(arcPh<.06&&worldRec){const x0=b.x+cols[1]*b.w,x1=b.x+cols[2]*b.w,y=h*.74;recCurve(t=>[lerp(x0,x1,t),y-Math.sin(t*Math.PI)*1.5+(t>0&&t<1?(hash(Math.round(t*8)+b.seed+arcN)-.5)*1.2:0),portalZ],8,wc('200,255,245'),(1-arcPh/.06)*.9,1.2)}
  else if(arcPh<.06){const x0=b.x+cols[1]*b.w,x1=b.x+cols[2]*b.w,y=h*.74;let prev=project(x0,y,portalZ,vy,vp);ctx.strokeStyle=`rgba(${wc('200,255,245')},${(1-arcPh/.06)*.9})`;ctx.lineWidth=1.2;ctx.beginPath();
    for(let i=1;i<=8;i++){const t=i/8,q=project(lerp(x0,x1,t),y-Math.sin(t*Math.PI)*1.5+(hash(i+b.seed+arcN)-.5)*1.2,portalZ,vy,vp);if(q&&prev){ctx.moveTo(prev.x,prev.y);ctx.lineTo(q.x,q.y)}prev=q}ctx.stroke()}
}
function drawFoundryBlock(b,vy,vp,o){
  const h=b.h;
  worldBox3D(b.x,b.z,b.w,b.d*.94,0,h*.55,vy,vp,'rgba(1,7,8,.97)',.13*o.glow,wc('91,240,204'));
  worldBox3D(b.x-b.w*.12,b.z,b.w*.68,b.d*.7,h*.55,h*.86,vy,vp,'rgba(1,7,8,.97)',.15*o.glow,wc('91,240,204'));
  worldBox3D(b.x+b.w*.28,b.z-b.d*.18,b.w*.16,b.d*.2,h*.55,h*1.18,vy,vp,'rgba(1,7,8,.98)',.17*o.glow,wc('91,240,204'));
  // Roof crane rails and a travelling crane bridge.
  const ry=h*.86+.2;for(const s of [-1,1])worldLine3D(b.x-b.w*.46,ry,b.z+s*b.d*.33,b.x+b.w*.3,ry,b.z+s*b.d*.33,vy,vp,'91,240,204',.18*o.glow,.9);
  const cxp=b.x-b.w*.4+((gameTime*1.6+b.seed*7)%(b.w*.66));worldBox3D(cxp,b.z,1.6,b.d*.7,ry,ry+1.4,vy,vp,'rgba(2,12,11,.98)',.22*o.glow,wc('120,255,220'));
  worldLine3D(cxp,ry,b.z,cxp,h*.62,b.z,vy,vp,'140,255,225',.18*o.glow,.6);
  // Furnace mouth: white-cyan plasma (amber/red stay reserved for weapon and hostiles).
  const face=b.z+(player.z>b.z?1:-1)*b.d*.47;
  if(worldRec){const c=wc('190,250,255'),a=Math.min(1,(.22+.1*Math.sin(gameTime*2+b.seed))*o.glow),fz=b.z+(player.z>b.z?1:-1)*(b.d*.47+.05);for(let k=0;k<=6;k++){const y=lerp(1,h*.3,k/6);recLine(b.x-b.w*.2,y,fz,b.x+b.w*.05,y,fz,c,a,1)}}
  else{const m=[project(b.x-b.w*.2,1,face,vy,vp),project(b.x+b.w*.05,1,face,vy,vp),project(b.x+b.w*.05,h*.3,face,vy,vp),project(b.x-b.w*.2,h*.3,face,vy,vp)];
  if(m.every(Boolean)){ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle=`rgba(${wc('190,250,255')},${Math.min(1,(.22+.1*Math.sin(gameTime*2+b.seed))*o.glow)})`;ctx.lineWidth=1;ctx.beginPath();for(let k=0;k<=6;k++){const t=k/6;ctx.moveTo(lerp(m[0].x,m[3].x,t),lerp(m[0].y,m[3].y,t));ctx.lineTo(lerp(m[1].x,m[2].x,t),lerp(m[1].y,m[2].y,t))}ctx.stroke();ctx.restore()}}
  // Conveyor out of the block toward the spine, with moving carriers.
  const sx=b.x>0?-1:1,x0=b.x+sx*b.w*.5,x1=x0+sx*9;worldLine3D(x0,4,b.z,x1,4,b.z,vy,vp,'91,240,204',.16*o.glow,1);worldLine3D(x0,3.2,b.z,x1,3.2,b.z,vy,vp,'91,240,204',.08*o.glow,.6);
  for(let k=0;k<3;k++){const t=((gameTime*.3+k/3+b.seed*.1)%1),x=lerp(x0,x1,t);worldBox3D(x,b.z,1.1,1.1,4,4.9,vy,vp,'rgba(2,12,11,.98)',.2*o.glow,wc('120,255,220'))}
}
function drawBuilding(b,viewYaw,viewPitch){
  const c=project(b.x,b.h*.5,b.z,viewYaw,viewPitch),depth=c?.depth??Math.hypot(b.x-player.x,b.z-player.z);
  if(!c&&!project(b.x+b.w/2,0,b.z,viewYaw,viewPitch)&&!project(b.x-b.w/2,0,b.z,viewYaw,viewPitch)&&!project(b.x,0,b.z+b.d/2,viewYaw,viewPitch)&&!project(b.x,0,b.z-b.d/2,viewYaw,viewPitch))return;
  const motion=clamp(Math.hypot(player.vx,player.vz)/48+Math.abs(player.yawVelocity)*.58,0,1),alpha=clamp(1-(depth-60)/220,.22,1)*(1-.15*motion);
  const o={alpha,glow:plantGlow(b.x,b.z,depth),edge:.16};
  ctx.save();ctx.globalAlpha=alpha;ctx.shadowBlur=0;ctx.lineCap='round';
  if(b.type===4){boxPlain=true;worldBox3D(b.x,b.z,b.w,b.d,0,b.h,viewYaw,viewPitch,'rgba(1,8,9,.97)',.07);boxPlain=false}
  else if(b.type===0)drawCoolingTower(b,viewYaw,viewPitch,o);else if(b.type===1)drawProcessStacks(b,viewYaw,viewPitch,o);else if(b.type===2)drawSubstation(b,viewYaw,viewPitch,o);else drawFoundryBlock(b,viewYaw,viewPitch,o);
  ctx.restore();
}
// SKYDECK: runway edge lights (white, amber along the far third of the strip),
// threshold bars at both ends, a lead-in of approach lights running in from the far end, two marked
// landing pads off the strip and a red beacon on the control mast.
// The deck stands high over the city, so nothing tall is near: the far skyline is a low ring of
// silhouettes ~300 m out with a scatter of lights, and the sky does the rest.
const SKY_RING=(()=>{const out=[];for(let i=0;i<30;i++){const a=i/30*TAU+hash(i+40)*.12,r=285+hash(i+41)*45;out.push([Math.sin(a)*r,-Math.cos(a)*r,10+hash(i+42)*16,8+hash(i+43)*14,4+hash(i+44)*18])}return out})();
const SKY_LIGHTS=(()=>{const out=[];for(let i=0;i<70;i++){const a=hash(i+90)*TAU,r=280+hash(i+91)*60;out.push([Math.sin(a)*r,1+hash(i+92)*16,-Math.cos(a)*r,hash(i+93)<.25])}return out})();
function drawSkydeck(viewYaw,viewPitch){
  for(const [x,z,w,d,h] of SKY_RING)worldBox3D(x,z,w,d,0,h,viewYaw,viewPitch,'rgba(6,12,20,.96)',.06,'120,160,210');
  const dot=(x,y,z,color,alpha,r,maxPx=3.4)=>{if(worldRec){recDot(x,y,z,color,alpha,r,1,maxPx);return}const p=project(x,y,z,viewYaw,viewPitch);if(!p||p.depth>380)return;
    ctx.globalAlpha=alpha;ctx.fillStyle=`rgb(${color})`;ctx.beginPath();ctx.arc(p.x,p.y,clamp(r/p.depth*renderFocal*.9,1,maxPx),0,TAU);ctx.fill()};
  ctx.save();ctx.shadowBlur=6;ctx.shadowColor='#ffe7b0';
  for(const [x,y,z,warm] of SKY_LIGHTS)dot(x,y,z,warm?'255,200,140':'170,210,255',.4,.9,1.6);
  for(let z=-144;z<=144;z+=12)for(const side of [-1,1]){const far=z<-48;dot(side*19.2,.18,z,far?'255,196,104':'236,244,240',.62,.22)}
  for(const z of [-150,150])for(let x=-16;x<=16;x+=2.6)dot(x,.18,z,z<0?'126,255,170':'255,120,96',.55,.2);
  {const run=((gameTime*1.1)%1);for(let i=0;i<7;i++){const z=-158-i*9,on=Math.abs(i/7-(1-run))<.08;dot(0,.4,z,'255,255,255',on?.95:.18,on?.34:.18,on?4.4:2)}}
  ctx.shadowBlur=0;ctx.restore();
  for(const [cx,cz] of [[-40,8],[42,-130]]){const n=36;for(let i=0;i<n;i++){const a0=i/n*TAU,a1=(i+1)/n*TAU;worldLine3D(cx+Math.cos(a0)*8,.07,cz+Math.sin(a0)*8,cx+Math.cos(a1)*8,.07,cz+Math.sin(a1)*8,viewYaw,viewPitch,'236,214,140',.42,1.2)}
    worldLine3D(cx-2.4,.07,cz-3,cx-2.4,.07,cz+3,viewYaw,viewPitch,'236,214,140',.5,1.4);worldLine3D(cx+2.4,.07,cz-3,cx+2.4,.07,cz+3,viewYaw,viewPitch,'236,214,140',.5,1.4);worldLine3D(cx-2.4,.07,cz,cx+2.4,.07,cz,viewYaw,viewPitch,'236,214,140',.5,1.4)}
  if(Math.floor(gameTime*1.3)%2===0){ctx.save();ctx.shadowBlur=10;ctx.shadowColor='#ff4a3a';dot(64,35.2,30,'255,86,70',.9,.45,5);ctx.restore()}
}
// FREIGHT TUNNEL: the ceiling in 20 m bays with a cross beam between them, a lamp strip over each lane
// in every bay, a cable tray and green emergency lights along both walls, and a shut blast door with
// hazard chevrons and a red beacon on each end wall. Far concrete fades into TUNNEL_SKY like the
// facilities do, so the tube reads long.
function drawTunnel(viewYaw,viewPitch){
  const {hw,len,ceil}=TUNNEL,fade=(x,z)=>clamp(1-(Math.hypot(x-player.x,z-player.z)-60)/220,.22,1);
  ctx.save();boxPlain=true;
  for(let z=-len;z<len;z+=20){ctx.globalAlpha=fade(0,z+10);worldBox3D(0,z+10,2*hw+16,20,ceil,ceil+3,viewYaw,viewPitch,'rgba(1,8,9,.97)',.05);
    if(z>-len)worldBox3D(0,z,2*hw,1.2,ceil-1.4,ceil,viewYaw,viewPitch,'rgba(1,8,9,.97)',.06)}
  boxPlain=false;
  const dot=(x,y,z,color,alpha,r,maxPx=3.4)=>{if(worldRec){recDot(x,y,z,color,alpha,r,1,maxPx);return}const p=project(x,y,z,viewYaw,viewPitch);if(!p||p.depth>320)return;
    const a=ctx.globalAlpha;ctx.globalAlpha=alpha*a;ctx.fillStyle=`rgb(${color})`;ctx.beginPath();ctx.arc(p.x,p.y,clamp(r/p.depth*renderFocal*.9,1,maxPx),0,TAU);ctx.fill();ctx.globalAlpha=a};
  for(let z=-len+10;z<len;z+=20)for(const x of [-12,12]){ctx.globalAlpha=fade(x,z);
    worldBox3D(x,z,1.6,6.4,ceil-.7,ceil,viewYaw,viewPitch,'rgba(1,8,9,.97)',0);
    worldLine3D(x-.45,ceil-.75,z-2.9,x-.45,ceil-.75,z+2.9,viewYaw,viewPitch,'226,242,236',.95,2.6,8);worldLine3D(x+.45,ceil-.75,z-2.9,x+.45,ceil-.75,z+2.9,viewYaw,viewPitch,'226,242,236',.95,2.6,8)}
  ctx.globalAlpha=1;
  for(const s of [-1,1]){const x=s*(hw-.15);
    for(const y of [9,9.7])worldLine3D(x,y,-len,x,y,len,viewYaw,viewPitch,'91,240,204',.12,1);
    for(let z=-len+12;z<len;z+=24){ctx.globalAlpha=fade(x,z);dot(x,2.6,z,'110,255,150',.75,.2,3)}ctx.globalAlpha=1}
  for(const e of [-1,1]){const z=e*(len-.1),hz='217,180,67';
    for(const [x0,y0,x1,y1] of [[-18,0,-18,16],[18,0,18,16],[-18,16,18,16],[0,0,0,16]])worldLine3D(x0,y0,z,x1,y1,z,viewYaw,viewPitch,'150,190,184',.35,1.6);
    for(let k=-17;k<=15;k+=4)worldLine3D(k,0,z,k+2,1.6,z,viewYaw,viewPitch,hz,.7,2.2);
    for(let k=-17;k<=15;k+=4)worldLine3D(k,14.4,z,k+2,16,z,viewYaw,viewPitch,hz,.55,2);
    ctx.globalAlpha=fade(0,z);if(Math.floor(gameTime*1.2+e*.5)%2===0)dot(0,18,z,'255,86,70',.9,.45,5);ctx.globalAlpha=1}
  ctx.restore();
}
// Power trunk line: lattice pylons along the spine, cables carrying steady pulses toward the gate.
const PYLONS=(()=>{const out=[];for(let z=128;z>=-136;z-=38)for(const s of [-1,1]){const x=s*33;if(!collide(x,z,3))out.push({x,z,s})}return out})();
function drawTrunkLine(vy,vp){
  ctx.save();ctx.lineCap='round';const H1=24,arm=5.5;
  for(const p of PYLONS){const d=Math.hypot(p.x-player.x,p.z-player.z);if(d>230)continue;const a=clamp(1-(d-40)/200,.15,1);
    beginLines();for(const [dx,dz] of [[-1.6,-1.6],[1.6,-1.6],[1.6,1.6],[-1.6,1.6]])worldLine3D(p.x+dx,0,p.z+dz,p.x+dx*.25,H1,p.z+dz*.25,vy,vp,'91,240,204',.3*a,1);
    for(let k=1;k<5;k++){const y=k*H1/5,w=1.6*(1-y/H1*.75);worldLine3D(p.x-w,y,p.z-w,p.x+w,y,p.z+w,vy,vp,'91,240,204',.14*a,.6);worldLine3D(p.x+w,y,p.z-w,p.x-w,y,p.z+w,vy,vp,'91,240,204',.14*a,.6)}
    worldLine3D(p.x-arm,H1*.82,p.z,p.x+arm,H1*.82,p.z,vy,vp,'91,240,204',.34*a,1.3);worldLine3D(p.x-arm*.7,H1,p.z,p.x+arm*.7,H1,p.z,vy,vp,'91,240,204',.26*a,1);endLines();
    if(worldRec){recDot(p.x,H1+1.2,p.z,'255,74,58',Math.sin(gameTime*2.4+p.z*.1)>0?.85*a:.2*a,.25,1,3.5);continue}
    const top=project(p.x,H1+1.2,p.z,vy,vp);if(top){ctx.globalAlpha=Math.sin(gameTime*2.4+p.z*.1)>0?.85*a:.2*a;ctx.fillStyle='#ff4a3a';ctx.beginPath();ctx.arc(top.x,top.y,clamp(top.f*.25,1,3.5),0,TAU);ctx.fill();ctx.globalAlpha=1}}
  // Catenary cables between consecutive pylons on each side + travelling pulses (steady, toward -z).
  for(const s of [-1,1]){const row=PYLONS.filter(p=>p.s===s);for(let i=1;i<row.length;i++){const A=row[i-1],B=row[i];if(Math.min(Math.hypot(A.x-player.x,A.z-player.z),Math.hypot(B.x-player.x,B.z-player.z))>230)continue;
    if(worldRec){for(const [ox,oy] of [[-5.5,H1*.82],[5.5,H1*.82],[0,H1]]){const at=t=>[A.x+ox,oy-Math.sin(t*Math.PI)*3.2,lerp(A.z,B.z,t)];recCurve(at,12,wc('91,240,204'),.22,.8);
      const t=(gameTime*.55+ox*.07)%1,p0=at(Math.max(0,t-.08)),p1=at(t);recLine(p0[0],p0[1],p0[2],p1[0],p1[1],p1[2],wc('170,255,235'),.75*(1-t*.6),2.2)}continue}
    for(const [ox,oy] of [[-5.5,H1*.82],[5.5,H1*.82],[0,H1]]){let prev=null;ctx.strokeStyle=`rgba(${wc('91,240,204')},.22)`;ctx.lineWidth=.8;ctx.beginPath();
      for(let k=0;k<=12;k++){const t=k/12,q=project(A.x+ox,oy-Math.sin(t*Math.PI)*3.2,lerp(A.z,B.z,t),vy,vp);if(q&&prev){ctx.moveTo(prev.x,prev.y);ctx.lineTo(q.x,q.y)}prev=q}ctx.stroke();
      const t=(gameTime*.55+ox*.07)%1,q=project(A.x+ox,oy-Math.sin(t*Math.PI)*3.2,lerp(A.z,B.z,t),vy,vp),q2=project(A.x+ox,oy-Math.sin(Math.max(0,t-.08)*Math.PI)*3.2,lerp(A.z,B.z,Math.max(0,t-.08)),vy,vp);
      if(q&&q2){ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle=`rgba(${wc('170,255,235')},${.75*(1-t*.6)})`;ctx.lineWidth=2.2;ctx.beginPath();ctx.moveTo(q2.x,q2.y);ctx.lineTo(q.x,q.y);ctx.stroke();ctx.restore()}}}}
  ctx.restore();
}
// SYNC world state: world vectors lerp toward gold. Cached per (colour, quantised mix).
let syncMix=0;const wcCache=new Map();
function wc(rgb){const q=Math.round(syncMix*20);if(!q)return rgb;const key=rgb+'|'+q;let v=wcCache.get(key);if(!v){const c=rgb.split(',').map(Number),g=[255,212,120],m=q/20;v=c.map((x,i)=>Math.round(lerp(x,g[i],m*.85))).join(',');wcCache.set(key,v)}return v}
// ---------- MECH MODELS (v32) ----------------------------------------------------
// Hostiles are articulated machines: armour parts hang on bones, bones are posed every
// frame from the AI state (gait, bank, windup, brace, recoil, stagger). Rendering is
// faces + lines: lit dark armour planes are painter-sorted with back-face culling, and
// each drawn face strokes its own silhouette / crease edges, so near armour hides far
// lines (hidden-line vector look). Line widths stay in screen pixels (Battlezone);
// close range gains weight from face area and panel lines instead of thicker strokes.
const M3={
  mul(A,B){return[A[0]*B[0]+A[1]*B[3]+A[2]*B[6],A[0]*B[1]+A[1]*B[4]+A[2]*B[7],A[0]*B[2]+A[1]*B[5]+A[2]*B[8],A[3]*B[0]+A[4]*B[3]+A[5]*B[6],A[3]*B[1]+A[4]*B[4]+A[5]*B[7],A[3]*B[2]+A[4]*B[5]+A[5]*B[8],A[6]*B[0]+A[7]*B[3]+A[8]*B[6],A[6]*B[1]+A[7]*B[4]+A[8]*B[7],A[6]*B[2]+A[7]*B[5]+A[8]*B[8]]},
  // local rotation order: yaw (Y) * pitch (X, +pitch lifts +z toward +y) * roll (Z)
  rot(pitch,yaw,roll){const cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch),cz=Math.cos(roll),sz=Math.sin(roll);
    return M3.mul(M3.mul([cy,0,sy,0,1,0,-sy,0,cy],[1,0,0,0,cx,sx,0,-sx,cx]),[cz,-sz,0,sz,cz,0,0,0,1])},
  ap(R,v){return[R[0]*v[0]+R[1]*v[1]+R[2]*v[2],R[3]*v[0]+R[4]*v[1]+R[5]*v[2],R[6]*v[0]+R[7]*v[1]+R[8]*v[2]]}
};
// Bone transform = {R: 3x3, t: [x,y,z]}; world = parent.R*local + parent.t
function xfMul(P,L){return{R:M3.mul(P.R,L.R),t:[P.R[0]*L.t[0]+P.R[1]*L.t[1]+P.R[2]*L.t[2]+P.t[0],P.R[3]*L.t[0]+P.R[4]*L.t[1]+P.R[5]*L.t[2]+P.t[1],P.R[6]*L.t[0]+P.R[7]*L.t[1]+P.R[8]*L.t[2]+P.t[2]]}}
function xfPoint(X,v){const R=X.R;return[R[0]*v[0]+R[1]*v[1]+R[2]*v[2]+X.t[0],R[3]*v[0]+R[4]*v[1]+R[5]*v[2]+X.t[1],R[6]*v[0]+R[7]*v[1]+R[8]*v[2]+X.t[2]]}
const vsub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],vcross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],vlen=a=>Math.hypot(a[0],a[1],a[2]);
// --- procedural part builders (bone-local) ---
// A part is a closed convex solid. Faces are re-oriented outward from the centroid, edges carry
// their two faces and a crease value so the renderer can tell silhouettes from creases.
function makePart(verts,faces,o={}){
  const c=[0,0,0];for(const v of verts){c[0]+=v[0]/verts.length;c[1]+=v[1]/verts.length;c[2]+=v[2]/verts.length}
  const F=[];for(let idx of faces){
        // Newell normal is robust for quads with a nearly-degenerate corner.
    let n=[0,0,0];for(let i=0;i<idx.length;i++){const p=verts[idx[i]],q=verts[idx[(i+1)%idx.length]];n[0]+=(p[1]-q[1])*(p[2]+q[2]);n[1]+=(p[2]-q[2])*(p[0]+q[0]);n[2]+=(p[0]-q[0])*(p[1]+q[1])}
    const area=vlen(n)/2;if(area<1e-5)continue;n=[n[0]/(2*area),n[1]/(2*area),n[2]/(2*area)];
    const fc=[0,0,0];for(const i of idx){fc[0]+=verts[i][0]/idx.length;fc[1]+=verts[i][1]/idx.length;fc[2]+=verts[i][2]/idx.length}
    if(n[0]*(fc[0]-c[0])+n[1]*(fc[1]-c[1])+n[2]*(fc[2]-c[2])<0){idx=idx.slice().reverse();n=[-n[0],-n[1],-n[2]]}
    F.push({idx,n,area,lines:o.lines&&area>(o.lineArea??.12)?o.lines:0,edges:[]});
  }
  const E=[],map=new Map();
  F.forEach((f,fi)=>{for(let i=0;i<f.idx.length;i++){const a=f.idx[i],b=f.idx[(i+1)%f.idx.length],k=a<b?a+'_'+b:b+'_'+a;let e=map.get(k);if(!e){e={a,b,f0:fi,f1:-1,crease:1};map.set(k,e);E.push(e)}else e.f1=fi;f.edges.push(E.indexOf(e))}});
  for(const e of E)if(e.f1>=0){const n0=F[e.f0].n,n1=F[e.f1].n;e.crease=1-(n0[0]*n1[0]+n0[1]*n1[1]+n0[2]*n1[2])}
  const size=Math.max(...verts.map(v=>vlen(vsub(v,c))));
  return{verts,faces:F,edges:E,center:c,size,mat:o.mat||'armor',bone:o.bone,chip:!!o.chip,name:o.name||'',glow:o.glow||null};
}
const HEXA_FACES=[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
// 8 corners: bottom 0(-x,-z) 1(+x,-z) 2(+x,+z) 3(-x,+z), top 4..7 in the same order.
function hexa(c,o){return makePart(c.map(p=>p.slice()),HEXA_FACES,o)}
function box(cx,cy,cz,w,h,d,o){const x0=cx-w/2,x1=cx+w/2,y0=cy-h/2,y1=cy+h/2,z0=cz-d/2,z1=cz+d/2;return hexa([[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]],o)}
// Square-section beam from A to B (tapering wa -> wb); 'up' picks the section orientation.
function beam(A,B,wa,wb,o,up=[0,0,1]){
  const u=vsub(B,A),L=vlen(u),ux=[u[0]/L,u[1]/L,u[2]/L];let v=vcross(ux,up);if(vlen(v)<1e-4)v=vcross(ux,[1,0,0]);const vl=vlen(v);v=[v[0]/vl,v[1]/vl,v[2]/vl];const w=vcross(ux,v);
  const ring=(P,s)=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>[P[0]+(v[0]*a+w[0]*b)*s/2,P[1]+(v[1]*a+w[1]*b)*s/2,P[2]+(v[2]*a+w[2]*b)*s/2]);
  return makePart([...ring(A,wa),...ring(B,wb)],HEXA_FACES,o);
}
// n-gon prism / cone along an axis.
function cyl(cx,cy,cz,r,len,axis,n,o,r2=r){
  const V=[];for(const [s,rr] of [[-.5,r],[.5,r2]])for(let i=0;i<n;i++){const a=i/n*TAU+Math.PI/n,p=Math.cos(a)*rr,q=Math.sin(a)*rr,l=s*len;
    V.push(axis==='z'?[cx+p,cy+q,cz+l]:axis==='x'?[cx+l,cy+p,cz+q]:[cx+p,cy+l,cz+q])}
  const F=[[...Array(n).keys()],[...Array(n).keys()].map(i=>n+i)];for(let i=0;i<n;i++)F.push([i,(i+1)%n,n+(i+1)%n,n+i]);
  return makePart(V,F,o);
}
function mirrorPart(p,bone){return makePart(p.verts.map(v=>[-v[0],v[1],v[2]]),p.faces.map(f=>f.idx),{mat:p.mat,bone,lines:p.faces.reduce((m,f)=>Math.max(m,f.lines),0),chip:p.chip,name:p.name,glow:p.glow})}

// --- class definitions -----------------------------------------------------------
// Silhouette contract (readable without labels, from any side):
//   SCOUT  VANE    : a horizontal blade      — very wide, thin, hovering, sensor eye centred
//   LANCER PIKE    : a diagonal spear        — tall, asymmetric (lance right, shield fin left)
//   HEAVY  BASTION : a low trapezoid + gun   — four splayed legs, long barrel, rear radiator
const CLASS_STYLE={
  SCOUT:{edge:'#ff4f86',core:'#ffd6e4',accent:'#ff7aa6',glow:'#ffa8c8',armor:[54,24,50],dark:[20,9,20],metal:[40,30,46]},
  LANCER:{edge:'#ff5a4e',core:'#ffd9d0',accent:'#ff8064',glow:'#ffbc96',armor:[62,24,22],dark:[22,9,9],metal:[46,34,34]},
  HEAVY:{edge:'#ff9a62',core:'#ffe6cf',accent:'#ffb070',glow:'#ffd58e',armor:[62,42,28],dark:[22,15,10],metal:[48,40,34]},
  TITAN:{edge:'#ff3a4a',core:'#ffe0d8',accent:'#ff6a52',glow:'#ffb48a',armor:[46,40,46],dark:[16,13,16],metal:[40,36,40]},
  KITE:{edge:'#c27bff',core:'#efdcff',accent:'#d6a2ff',glow:'#e2c4ff',armor:[44,28,58],dark:[16,10,22],metal:[38,32,46]}
};
// Hostiles use the same cel language as HALBERD / KESTREL, each class in its own hue.
CLASS_STYLE.SCOUT.toon={ink:'#12040c',trace:'#ff4f86',armor:[[214,98,152],[100,36,72]],dark:[[92,50,88],[40,18,38]],metal:[[172,136,164],[80,58,80]],accent:[[255,156,196],[150,60,104]]};
// KITE is lilac: light enough to stand off SKYDECK's deep-blue sky, and away from the warm deck classes.
// Seen mostly from below, so the shadow tones are kept light too.
CLASS_STYLE.KITE.toon={ink:'#0b0612',trace:'#c27bff',armor:[[214,182,242],[150,116,190]],dark:[[120,92,146],[70,50,92]],metal:[[190,176,204],[120,108,140]],accent:[[236,200,255],[170,120,220]]};
CLASS_STYLE.LANCER.toon={ink:'#120403',trace:'#ff5a4e',armor:[[222,96,80],[108,36,32]],dark:[[98,46,42],[42,16,14]],metal:[[178,140,132],[86,60,56]],accent:[[255,166,124],[150,70,50]]};
// ATLAS is gunmetal with crimson trim: a value step away from the saturated small classes, so the big
// machine reads as a different weight class at a glance.
CLASS_STYLE.TITAN.toon={ink:'#0c0607',trace:'#ff3a4a',armor:[[168,158,166],[78,70,80]],dark:[[86,74,82],[34,28,34]],metal:[[150,140,146],[70,62,68]],accent:[[255,98,82],[146,34,30]]};
CLASS_STYLE.HEAVY.toon={ink:'#120904',trace:'#ff9a62',armor:[[228,152,88],[114,66,30]],dark:[[102,74,50],[44,30,18]],metal:[[182,162,138],[88,74,60]],accent:[[255,204,124],[150,100,40]]};
// def.scale builds a rig at a multiple of its authored size (bones, parts, muzzles; pose offsets in enemyPose).
function scalePart(p,k){p.verts=p.verts.map(v=>[v[0]*k,v[1]*k,v[2]*k]);p.center=p.center.map(c=>c*k);p.size*=k;for(const f of p.faces)f.area*=k*k;return p}
function buildRig(def){
  const sc=def.scale||1;if(sc!==1)def={...def,bones:def.bones.map(([n,par,r])=>[n,par,r.map(c=>c*sc)]),muzzles:def.muzzles.map(([b,v])=>[b,v.map(c=>c*sc)])};
  const parts=[];for(const p of def.parts(...[]))parts.push(sc!==1?scalePart(p,sc):p);
  const order=def.bones.map(b=>b[0]),index=Object.fromEntries(order.map((n,i)=>[n,i]));
  return{...def,boneIndex:index,parts,partsByBone:order.map(n=>parts.filter(p=>p.bone===n))};
}
const RIGS={
  // KITE: a thruster gunship, ~5 m across its pods. Root at its height (e.y); the hull banks into turns and
  // pitches with the climb.
  KITE:buildRig({type:'KITE',name:'KITE',height:1.4,body:3.4,wall:2.0,hit:{r:3.1,cy:0,hh:.9},gaitRate:1,
    bones:[['root',null,[0,0,0]],['body','root',[0,0,0]],['wingL','body',[-.55,0,-.2]],['wingR','body',[.55,0,-.2]],['tail','body',[0,.1,-1.7]],['gun','body',[0,-.38,.9]]],
    muzzles:[['gun',[0,0,1.15]]],
    parts(){
      const P=[],B=(bone,p)=>{p.bone=bone;P.push(p);return p};
      B('body',hexa([[-.55,-.3,-1.9],[.55,-.3,-1.9],[.22,-.2,2.3],[-.22,-.2,2.3],[-.45,.28,-1.7],[.45,.28,-1.7],[.14,.12,2.0],[-.14,.12,2.0]],{lines:2,name:'hull'}));
      B('body',hexa([[-.38,-.48,-1.3],[.38,-.48,-1.3],[.16,-.36,1.5],[-.16,-.36,1.5],[-.5,-.3,-1.5],[.5,-.3,-1.5],[.2,-.22,1.8],[-.2,-.22,1.8]],{mat:'dark'}));
      B('body',box(0,.3,-.2,.12,.06,2.4,{mat:'accent'}));
      B('body',cyl(0,-.02,2.28,.17,.08,'z',10,{mat:'glow',glow:'eye'}));
      for(const s of [-1,1]){B('body',cyl(s*.62,-.12,-1.15,.24,1.5,'z',8,{mat:'metal',name:'nacelle'}));B('body',cyl(s*.62,-.12,-1.95,.18,.06,'z',8,{mat:'glow',glow:'thrust'}))}
      // No air on the Moon, so no wings: short pylons carry a thruster pod each side, nozzles firing down, and the
      // tail fins give way to an attitude-thruster block. The span stays ~5 m so it still reads at range.
      const wing=[];
      wing.push(hexa([[-2.1,-.05,-.75],[0,-.06,-.6],[0,-.06,.4],[-2.1,-.05,.15],[-2.1,.05,-.73],[0,.07,-.58],[0,.07,.38],[-2.1,.05,.13]],{lines:3,lineArea:.2,name:'pylon'}));
      wing.push(beam([0,.02,-.1],[-2.2,.02,-.3],.12,.07,{mat:'accent'},[0,1,0]));
      wing.push(cyl(-2.45,0,-.3,.4,1.6,'z',10,{mat:'metal',name:'pod'}));
      wing.push(cyl(-2.45,-.52,-.3,.34,.42,'y',10,{mat:'dark',name:'nozzle'},.22));
      wing.push(cyl(-2.45,-.75,-.3,.28,.04,'y',10,{mat:'glow',glow:'thrust'}));
      wing.push(box(-2.45,.42,-.3,.14,.1,.5,{mat:'glow',glow:'tip'}));
      wing.push(box(-1.2,-.16,-.2,.22,.18,.7,{mat:'dark',chip:true}));
      for(const p of wing){B('wingL',p);P.push(mirrorPart(p,'wingR'))}
      B('tail',box(0,.05,-.1,.62,.22,.5,{mat:'dark',name:'rcs'}));for(const s of [-1,1])B('tail',box(s*.34,.05,-.36,.1,.1,.04,{mat:'glow',glow:'thrust'}));
      B('gun',cyl(0,0,.5,.1,1.2,'z',8,{mat:'metal',name:'cannon'}));B('gun',box(0,.08,0,.32,.2,.5,{mat:'dark'}));
      return P;
    },
    pose(e,A){const t=gameTime+e.phase,st=A.stag,sw=Math.sin(t*23)*st;
      return{body:{p:[0,Math.sin(t*1.4)*.12,0],r:[(A.climb||0)*.55+sw*.2,0,-A.bank*.75+sw*.25]},
        wingL:{r:[0,0,-.04+Math.sin(t*2.3)*.02]},wingR:{r:[0,0,.04-Math.sin(t*2.3)*.02]},tail:{r:[0,A.bank*.15,0]},gun:{r:[-A.prep*.2,0,0]}}}
  }),
  SCOUT:buildRig({type:'SCOUT',name:'VANE',height:3.4,body:2.4,wall:2.0,hit:{r:2.35,cy:2.45,hh:1.0},gaitRate:.9,
    bones:[['root',null,[0,0,0]],['body','root',[0,2.45,0]],['head','body',[0,.34,.78]],['wingL','body',[-.62,.03,-.05]],['wingR','body',[.62,.03,-.05]],['tail','body',[0,.2,-1.15]],['clawL','body',[-.32,-.46,.55]],['clawR','body',[.32,-.46,.55]],['mast','body',[0,.3,-.55]]],
    muzzles:[['wingL',[-3.26,-.08,.42]],['wingR',[3.26,-.08,.42]]],
    parts(){
      const P=[],B=(bone,p)=>{p.bone=bone;P.push(p);return p};
      B('body',hexa([[-.62,-.22,-1.05],[.62,-.22,-1.05],[.36,-.18,1.25],[-.36,-.18,1.25],[-.42,.26,-.9],[.42,.26,-.9],[.2,.16,1.02],[-.2,.16,1.02]],{lines:2,name:'hull'}));
      B('body',hexa([[-.3,-.52,-.6],[.3,-.52,-.6],[.12,-.44,.9],[-.12,-.44,.9],[-.52,-.22,-.82],[.52,-.22,-.82],[.3,-.2,1.1],[-.3,-.2,1.1]],{mat:'dark'}));
      B('body',box(0,.3,-.12,.13,.07,1.65,{mat:'accent'}));
      for(const s of [-1,1]){
        B('body',cyl(s*.33,.02,-1.12,.17,.46,'z',8,{mat:'metal'}));
        B('body',cyl(s*.33,.02,-1.37,.12,.04,'z',8,{mat:'glow',glow:'thrust'}));
        B('body',box(s*.56,-.42,.18,.34,.22,.82,{mat:'dark',chip:true}));
        B('body',box(s*.56,-.55,.18,.24,.03,.6,{mat:'glow',glow:'hover'}));
      }
      B('head',cyl(0,0,0,.36,.74,'z',10,{mat:'metal',name:'sensor'},.29));
      B('head',cyl(0,0,.4,.31,.07,'z',12,{mat:'dark'}));B('head',cyl(0,0,.44,.16,.04,'z',10,{mat:'glow',glow:'eye'}));
      for(const s of [-1,1])B('head',box(s*.36,.02,.18,.07,.34,.42,{mat:'accent'}));
      B('head',box(0,.32,-.06,.52,.1,.72,{mat:'armor',chip:true}));
      const wing=[];
      wing.push(hexa([[-3.3,-.05,-.95],[0,-.08,-.82],[0,-.08,.64],[-3.3,-.05,-.36],[-3.3,.03,-.92],[0,.09,-.8],[0,.09,.6],[-3.3,.03,-.39]],{lines:3,lineArea:.2,name:'wing'}));
      wing.push(beam([0,.0,.66],[-3.3,.0,-.33],.11,.07,{mat:'accent'},[0,1,0]));
      wing.push(hexa([[-3.41,-.7,-.78],[-3.33,-.7,-.78],[-3.33,-.7,-.42],[-3.41,-.7,-.42],[-3.41,.78,-.74],[-3.33,.78,-.74],[-3.33,.78,-.2],[-3.41,.78,-.2]],{mat:'armor',chip:true,name:'winglet'}));
      wing.push(box(-3.37,.28,-.22,.1,.9,.06,{mat:'glow',glow:'tip'}));
      wing.push(hexa([[-2.45,-.3,-1.0],[-.15,-.34,-.92],[-.15,-.34,-.45],[-2.45,-.3,-.66],[-2.45,-.25,-.98],[-.15,-.27,-.9],[-.15,-.27,-.47],[-2.45,-.25,-.68]],{mat:'dark',name:'flap'}));
      wing.push(beam([-1.3,-.07,-.6],[-1.3,-.3,-.75],.06,.06,{mat:'metal'}));
      wing.push(cyl(-3.24,-.08,-.02,.07,.82,'z',6,{mat:'metal'}));
      wing.push(box(-1.72,-.11,-.16,.24,.15,.72,{mat:'dark',chip:true}));
      for(const p of wing){B('wingL',p);P.push(mirrorPart(p,'wingR'))}
      B('tail',hexa([[-.05,0,-.62],[.05,0,-.62],[.05,0,.5],[-.05,0,.5],[-.03,.88,-1.04],[.03,.88,-1.04],[.03,.88,-.56],[-.03,.88,-.56]],{name:'fin'}));
      B('tail',box(0,.9,-.8,.07,.06,.4,{mat:'glow',glow:'tip'}));
      B('mast',beam([0,0,0],[0,.75,-.25],.07,.04,{mat:'metal'}));B('mast',box(0,.78,-.27,.3,.05,.12,{mat:'accent'}));
      for(const s of ['L','R']){const k=s==='L'?-1:1;
        B('claw'+s,beam([0,0,0],[k*.12,-.42,.28],.13,.1,{mat:'metal'}));B('claw'+s,beam([k*.12,-.42,.28],[k*.05,-.56,.78],.1,.06,{mat:'armor',name:'claw'}));
        B('claw'+s,hexa([[k*.05-.05,-.62,.72],[k*.05+.05,-.62,.72],[k*.03+.01,-.52,1.02],[k*.03-.01,-.52,1.02],[k*.05-.05,-.5,.72],[k*.05+.05,-.5,.72],[k*.03+.01,-.48,1.0],[k*.03-.01,-.48,1.0]],{mat:'accent'}))}
      return P;
    },
    pose(e,A){
      const t=gameTime+e.phase,bob=Math.sin(t*2.1)*.12,dash=A.dash,prep=A.prep,st=A.stag,sw=Math.sin(t*23)*st;
      return{
        body:{p:[0,bob-.3*st,0],r:[-A.fwd*.16-dash*.2+sw*.2,st*.5*A.stagDir,-A.bank*.34+sw*.25]},
        head:{r:[.08*Math.sin(t*.7)-.1*prep,.38*Math.sin(t*.9)*(1-prep)*(1-dash),0]},
        wingL:{r:[0,-dash*.48+prep*.2,-.1-A.bank*.06+prep*.12+st*.2]},
        wingR:{r:[0,dash*.48-prep*.2,.1-A.bank*.06-prep*.12-st*.2]},
        tail:{r:[-dash*.3,A.bank*.25,0]},
        clawL:{r:[-.25+prep*.85-dash*.5,-.12*prep,-.25*prep]},clawR:{r:[-.25+prep*.85-dash*.5,.12*prep,.25*prep]},
        mast:{r:[-dash*.6,Math.sin(t*1.3)*.4,0]}
      };
    }
  }),
  LANCER:buildRig({type:'LANCER',name:'PIKE',height:4.5,body:1.75,wall:1.4,hit:{r:1.55,cy:2.3,hh:2.05},gaitRate:1.15,
    bones:[['root',null,[0,0,0]],['pelvis','root',[0,2.05,0]],['torso','pelvis',[0,.28,0]],['head','torso',[0,.64,.86]],['armR','torso',[.74,.52,.16]],['lance','armR',[.2,-.26,.1]],['armL','torso',[-.8,.42,.05]],
      ['finL','torso',[-.33,.62,-.52]],['finR','torso',[.33,.62,-.52]],['pack','torso',[0,.45,-.62]],['thighL','pelvis',[-.42,-.08,0]],['shinL','thighL',[0,-1.0,.42]],['footL','shinL',[0,-1.02,-.42]],['thighR','pelvis',[.42,-.08,0]],['shinR','thighR',[0,-1.0,.42]],['footR','shinR',[0,-1.02,-.42]]],
    muzzles:[['lance',[0,0,4.95]]],
    parts(){
      const P=[],B=(bone,p)=>{p.bone=bone;P.push(p);return p};
      B('pelvis',box(0,0,0,.86,.42,.62,{mat:'dark'}));
      for(const s of [-1,1])B('pelvis',hexa([[s*.4-.06,-.42,-.3],[s*.4+.06,-.42,-.3],[s*.4+.06,-.42,.32],[s*.4-.06,-.42,.32],[s*.44-.05,.16,-.34],[s*.44+.05,.16,-.34],[s*.44+.05,.16,.36],[s*.44-.05,.16,.36]].map(v=>[v[0]+s*.08*(v[1]<0?1:0),v[1],v[2]]),{chip:true}));
      B('torso',hexa([[-.5,-.1,-.45],[.5,-.1,-.45],[.42,-.1,.56],[-.42,-.1,.56],[-.7,.76,-.52],[.7,.76,-.52],[.52,.86,.64],[-.52,.86,.64]],{lines:2,name:'chest'}));
      B('torso',box(0,.76,.56,.3,.22,.52,{mat:'dark'}));
      B('torso',box(0,.9,-.16,.18,.12,1.05,{mat:'accent'}));
      B('torso',box(0,.36,.58,.32,.2,.05,{mat:'glow',glow:'core'}));
      B('head',hexa([[-.2,-.14,-.36],[.2,-.14,-.36],[.05,-.06,.98],[-.05,-.06,.98],[-.16,.2,-.42],[.16,.2,-.42],[.03,.04,.92],[-.03,.04,.92]],{name:'head'}));
      B('head',box(0,.03,.46,.36,.05,.38,{mat:'glow',glow:'eye'}));
      B('head',hexa([[-.03,.18,-.4],[.03,.18,-.4],[.03,.12,.3],[-.03,.12,.3],[-.02,.46,-.78],[.02,.46,-.78],[.02,.22,-.1],[-.02,.22,-.1]],{mat:'accent'}));
      B('armR',hexa([[-.18,-.2,-.42],[.42,-.2,-.42],[.42,-.2,.42],[-.18,-.2,.42],[-.12,.28,-.36],[.34,.34,-.3],[.34,.3,.38],[-.12,.24,.36]],{lines:1,chip:true,name:'pauldron'}));
      B('armR',box(.14,-.36,.04,.2,.36,.26,{mat:'dark'}));
      B('lance',cyl(0,0,.9,.085,4.2,'z',6,{mat:'metal',name:'shaft'}));
      B('lance',cyl(0,0,-.05,.27,.13,'z',8,{mat:'armor'}));
      B('lance',box(0,0,-1.36,.19,.19,.42,{mat:'dark'}));
      B('lance',hexa([[-.035,-.22,3.0],[.035,-.22,3.0],[.008,-.02,4.95],[-.008,-.02,4.95],[-.035,.22,3.0],[.035,.22,3.0],[.008,.02,4.95],[-.008,.02,4.95]],{mat:'accent',name:'blade'}));
      B('lance',box(0,0,3.95,.025,.07,1.7,{mat:'glow',glow:'blade'}));
      B('armL',hexa([[-.1,-1.1,-.36],[.04,-1.1,-.36],[.04,-1.1,.5],[-.1,-1.1,.5],[-.12,.9,-.56],[.02,.9,-.56],[.02,.9,.46],[-.12,.9,.46]],{lines:3,lineArea:.3,name:'shield'}));
      B('armL',hexa([[-.12,.9,-.56],[.02,.9,-.56],[.02,.9,.46],[-.12,.9,.46],[-.07,1.62,-.88],[.0,1.62,-.88],[.0,1.62,-.46],[-.07,1.62,-.46]],{chip:true}));
      B('armL',beam([-.05,-1.1,.52],[-.05,.9,.48],.06,.06,{mat:'accent'},[1,0,0]));
      B('armL',box(.14,.18,.0,.22,.4,.3,{mat:'dark'}));
      for(const [bn,s] of [['finL',-1],['finR',1]]){
        B(bn,hexa([[-.04,0,-.16],[.04,0,-.16],[.04,0,.26],[-.04,0,.26],[-.03,1.28,-.38],[.03,1.28,-.38],[.03,1.28,-.16],[-.03,1.28,-.16]],{name:'fin'}));
        B(bn,box(-s*.05,.62,.02,.04,.82,.13,{mat:'glow',glow:'vent'}));
      }
      B('pack',hexa([[-.42,-.4,-.3],[.42,-.4,-.3],[.42,-.4,.22],[-.42,-.4,.22],[-.34,.3,-.42],[.34,.3,-.42],[.34,.3,.2],[-.34,.3,.2]],{lines:1,name:'pack'}));
      for(const s of [-1,1]){B('pack',cyl(s*.2,-.25,-.42,.13,.38,'z',8,{mat:'metal'}));B('pack',cyl(s*.2,-.25,-.62,.09,.03,'z',8,{mat:'glow',glow:'thrust'}))}
      B('torso',hexa([[-.56,.2,.52],[.56,.2,.52],[.5,.2,.7],[-.5,.2,.7],[-.62,.72,.6],[.62,.72,.6],[.54,.78,.76],[-.54,.78,.76]],{chip:true,lines:1}));
      for(const s of ['L','R']){const k=s==='L'?-1:1;
        B('thigh'+s,cyl(0,0,0,.2,.5,'x',8,{mat:'metal'}));
        B('thigh'+s,hexa([[-.2,-.75,.42],[.2,-.75,.42],[.2,-.75,.56],[-.2,-.75,.56],[-.24,.0,.12],[.24,.0,.12],[.24,.0,.3],[-.24,.0,.3]],{chip:true}));
        B('thigh'+s,beam([0,.05,0],[0,-1.0,.42],.44,.27,{lines:1,name:'thigh'}));
        B('shin'+s,beam([0,0,0],[0,-1.02,-.42],.24,.16,{mat:'metal'}));
        B('shin'+s,hexa([[-.15,-.1,-.05],[.15,-.1,-.05],[.13,-.05,.3],[-.13,-.05,.3],[-.12,.18,-.1],[.12,.18,-.1],[.1,.16,.22],[-.1,.16,.22]],{chip:true}));
        B('foot'+s,hexa([[-.19,-.05,-.26],[.19,-.05,-.26],[.12,-.05,.58],[-.12,-.05,.58],[-.13,.1,-.2],[.13,.1,-.2],[.06,.05,.42],[-.06,.05,.42]],{mat:'dark'}));
      }
      return P;
    },
    pose(e,A){
      const g=e.gait||0,mv=clamp(A.speed/6,0,1),prep=A.prep,lunge=A.dash,st=A.stag,t=gameTime+e.phase,sw=Math.sin(t*19)*st;
      const lean=-.32-prep*.62-lunge*.48+st*.35,crouch=prep*.42-lunge*.1,leg=s=>{const ph=g+(s>0?Math.PI:0),sw2=Math.sin(ph)*.46*mv,lift=Math.max(0,-Math.cos(ph))*.55*mv;
        return{thigh:{r:[sw2+crouch*.95-lunge*.25,0,0]},shin:{r:[-lift-crouch*1.7+lunge*.2,0,0]},foot:{r:[-(sw2-lift)*.5+crouch*.7,0,0]}}};
      const L=leg(-1),R=leg(1);
      return{
        pelvis:{p:[0,-crouch+Math.abs(Math.sin(g))*.06*mv-st*.18,lunge*.2],r:[0,0,sw*.15]},
        torso:{r:[lean,st*.35*A.stagDir+sw*.1,-A.bank*.2]},pack:{r:[lunge*.4-prep*.2,0,0]},
        head:{r:[-lean*.62,0,0]},
        armR:{p:[0,0,-prep*.38+lunge*.55],r:[-lean-.38*(1-prep)*(1-lunge)+st*.6,-.1*(1-prep)+.06*prep,0]},
        armL:{r:[-lean*.35+.1,.12*prep,-.12-prep*.18]},
        finL:{r:[1.05-prep*.85-lunge*.6,0,-.22*prep]},finR:{r:[1.05-prep*.85-lunge*.6,0,.22*prep]},
        thighL:L.thigh,shinL:L.shin,footL:L.foot,thighR:R.thigh,shinR:R.shin,footR:R.foot
      };
    }
  }),
  // TITAN "ATLAS": a 15 m reverse-joint biped carrying a twin-cannon turret (authored at 7.4 m, built at
  // scale 2). Identity in the big shape: stilt legs, a blocky hull, two long barrels on a turret that
  // tracks the frame on its own. Weight: slow stride, the hull drops and sways on every footfall.
  // Hit volumes: the hull and each leg (legHit).
  TITAN:buildRig({type:'TITAN',name:'ATLAS',heavy:true,scale:2,height:14.8,body:3,wall:4,hit:{r:3.2,cy:10.4,hh:2.9},legHit:{off:2.3,r:1,cy:4.3,hh:4.3},gaitRate:.21,
    bones:[['root',null,[0,0,0]],['pelvis','root',[0,4.19,0]],['hull','pelvis',[0,.55,0]],['turret','hull',[0,1.02,-.15]],['gunL','turret',[-1.0,.3,.55]],['gunR','turret',[1.0,.3,.55]],['rad','hull',[0,.2,-1.55]],
      ['thighL','pelvis',[-1.15,-.1,0]],['shinL','thighL',[0,-1.95,-.95]],['footL','shinL',[0,-1.92,.92]],['thighR','pelvis',[1.15,-.1,0]],['shinR','thighR',[0,-1.95,-.95]],['footR','shinR',[0,-1.92,.92]]],
    muzzles:[['gunL',[0,0,4.7]],['gunR',[0,0,4.7]]],
    parts(){
      const P=[],B=(bone,p)=>{p.bone=bone;P.push(p);return p};
      B('pelvis',box(0,0,0,1.9,.62,1.2,{mat:'dark'}));
      for(const s of [-1,1])B('pelvis',cyl(s*1.15,-.1,0,.46,.5,'x',10,{mat:'metal'}));
      B('hull',hexa([[-1.35,-.45,-1.45],[1.35,-.45,-1.45],[1.2,-.45,1.55],[-1.2,-.45,1.55],[-1.2,.95,-1.3],[1.2,.95,-1.3],[.95,.82,1.2],[-.95,.82,1.2]],{lines:3,lineArea:.5,name:'hull'}));
      B('hull',hexa([[-.95,-.2,1.5],[.95,-.2,1.5],[.7,-.1,2.05],[-.7,-.1,2.05],[-.9,.62,1.25],[.9,.62,1.25],[.62,.5,1.82],[-.62,.5,1.82]],{lines:1,chip:true,name:'cab'}));
      B('hull',box(0,.32,1.98,1.0,.12,.05,{mat:'glow',glow:'eye'}));
      for(const s of [-1,1]){B('hull',hexa([[s*1.38-.08,-.5,-1.2],[s*1.38+.08,-.5,-1.2],[s*1.38+.08,-.5,1.3],[s*1.38-.08,-.5,1.3],[s*1.3-.07,.7,-1.1],[s*1.3+.07,.7,-1.1],[s*1.3+.07,.7,1.0],[s*1.3-.07,.7,1.0]],{lines:2,chip:true,name:'flank'}))}
      B('hull',box(0,.98,-.4,.36,.06,1.9,{mat:'accent'}));
      B('turret',hexa([[-1.45,0,-1.15],[1.45,0,-1.15],[1.3,0,1.05],[-1.3,0,1.05],[-1.15,.72,-1.0],[1.15,.72,-1.0],[.95,.66,.8],[-.95,.66,.8]],{lines:2,name:'turret'}));
      B('turret',beam([.55,.66,-.6],[.62,1.6,-.85],.1,.08,{mat:'metal'}));B('turret',box(.62,1.62,-.85,.5,.12,.14,{mat:'accent'}));B('turret',box(.62,1.62,-.76,.36,.06,.06,{mat:'glow',glow:'eye'}));
      for(const [bn,s] of [['gunL',-1],['gunR',1]]){
        B(bn,box(0,0,.1,.7,.62,.9,{chip:true,name:'mantlet'}));
        B(bn,cyl(0,0,1.25,.3,1.4,'z',10,{mat:'dark'}));
        B(bn,cyl(0,0,3.05,.19,3.2,'z',10,{mat:'metal',name:'barrel'}));
        for(const z of [2.0,3.4])B(bn,cyl(0,0,z,.23,.08,'z',10,{mat:'dark'}));
        B(bn,box(0,0,4.5,.5,.42,.42,{mat:'dark',name:'brake'}));
        B(bn,cyl(0,0,4.7,.16,.04,'z',10,{mat:'glow',glow:'muzzle'}));
        B(bn,cyl(s*.48,-.08,-.1,.26,.6,'z',10,{mat:'metal'}));
      }
      for(const x of [-.8,-.4,0,.4,.8])B('rad',box(x,0,0,.08,.9,.55,{mat:'dark'}));
      B('rad',box(0,0,-.15,1.9,.6,.04,{mat:'glow',glow:'heat'}));
      for(const s of ['L','R']){const k=s==='L'?-1:1;
        // The thigh is structure and never chips; the plate on its front is what breaks off.
        B('thigh'+s,beam([0,.1,.1],[0,-1.95,-.95],.72,.5,{lines:1,name:'thigh'}));
        B('thigh'+s,hexa([[-.42,-.29,.31],[.42,-.29,.31],[.42,-.34,.42],[-.42,-.34,.42],[-.32,-1.59,-.43],[.32,-1.59,-.43],[.32,-1.64,-.32],[-.32,-1.64,-.32]],{chip:true,name:'thighplate'}));
        B('thigh'+s,beam([k*.42,-.3,.15],[k*.42,-1.6,-.6],.12,.1,{mat:'metal'},[1,0,0]));
        B('shin'+s,cyl(0,0,0,.42,.8,'x',10,{mat:'metal'}));
        B('shin'+s,beam([0,0,0],[0,-1.92,.92],.5,.36,{mat:'armor',lines:1,name:'shin'}));
        B('shin'+s,hexa([[-.3,-.2,-.1],[.3,-.2,-.1],[.26,-.1,.45],[-.26,-.1,.45],[-.24,.32,-.2],[.24,.32,-.2],[.2,.3,.3],[-.2,.3,.3]],{chip:true}));
        B('foot'+s,hexa([[-.55,-.22,-.6],[.55,-.22,-.6],[.45,-.22,.8],[-.45,-.22,.8],[-.4,.12,-.45],[.4,.12,-.45],[.3,.06,.55],[-.3,.06,.55]],{mat:'dark'}));
        for(const dx of [-.36,0,.36])B('foot'+s,hexa([[dx-.09,-.22,.75],[dx+.09,-.22,.75],[dx+.05,-.22,1.3],[dx-.05,-.22,1.3],[dx-.09,-.06,.7],[dx+.09,-.06,.7],[dx+.04,-.14,1.24],[dx-.04,-.14,1.24]],{mat:'accent'}));
      }
      return P;
    },
    pose(e,A){
      const g=e.gait||0,mv=clamp(A.speed/2.4,0,1),brace=A.prep,rec=A.recoil,st=A.stag,t=gameTime+e.phase,sw=Math.sin(t*12)*st;
      // Reverse-joint legs: crouching folds the thigh back and the shin forward; the foot stays flat.
      const leg=s=>{const ph=g+(s>0?Math.PI:0),swing=Math.sin(ph)*.3*mv,lift=Math.max(0,-Math.cos(ph))*.38*mv,crouch=brace*.32+st*.12;
        return{thigh:{r:[-swing-crouch-lift*.5,0,0]},shin:{r:[crouch*1.9+lift*1.2,0,0]},foot:{r:[swing-crouch*1.9+crouch-lift*.7,0,0]}}};
      const L=leg(-1),R=leg(1),bob=Math.abs(Math.sin(g))*.1*mv,plant=Math.exp(-(((g%Math.PI)+Math.PI)%Math.PI)*4.5)*mv,side=Math.floor(g/Math.PI)%2?1:-1;
      return{pelvis:{p:[0,-brace*.55-st*.3+bob-plant*.22,-rec*.25],r:[sw*.05+plant*.025,0,Math.sin(g)*.05*mv+side*plant*.03+sw*.08]},
        hull:{r:[rec*.06-brace*.08-A.fwd*.05+plant*.045,st*.18*A.stagDir,-side*plant*.02]},
        turret:{r:[0,A.turret||0,0]},
        gunL:{p:[0,0,-rec*.8*(A.recoilSide<0?1:.4)],r:[-brace*.06,0,0]},gunR:{p:[0,0,-rec*.8*(A.recoilSide>0?1:.4)],r:[-brace*.06,0,0]},
        rad:{r:[-brace*.35,0,0]},
        thighL:L.thigh,shinL:L.shin,footL:L.foot,thighR:R.thigh,shinR:R.shin,footR:R.foot};
    }
  }),
  HEAVY:buildRig({type:'HEAVY',name:'BASTION',heavy:true,height:3.4,body:3.0,wall:2.6,hit:{r:2.6,cy:1.9,hh:1.65},gaitRate:.55,
    bones:[['root',null,[0,0,0]],['hull','root',[0,1.72,0]],['turret','hull',[0,.62,-.15]],['gun','turret',[0,.3,.72]],['rad','hull',[0,.22,-1.86]],['mast','turret',[-.45,.55,-.6]],
      ...[['FL',-1,1.15],['FR',1,1.15],['RL',-1,-1.2],['RR',1,-1.2]].flatMap(([n,s,z])=>[['hip'+n,'hull',[s*1.28,-.06,z]],['knee'+n,'hip'+n,[s*1.25,.55,0]]])],
    muzzles:[['gun',[0,0,4.32]]],
    parts(){
      const P=[],B=(bone,p)=>{p.bone=bone;P.push(p);return p};
      B('hull',hexa([[-1.45,-.45,-1.9],[1.45,-.45,-1.9],[1.3,-.45,1.75],[-1.3,-.45,1.75],[-1.2,.36,-1.76],[1.2,.36,-1.76],[1.0,.36,.92],[-1.0,.36,.92]],{lines:3,lineArea:.5,name:'hull'}));
      B('hull',hexa([[-1.0,-.78,-1.42],[1.0,-.78,-1.42],[.9,-.78,1.3],[-.9,-.78,1.3],[-1.32,-.45,-1.75],[1.32,-.45,-1.75],[1.2,-.45,1.6],[-1.2,-.45,1.6]],{mat:'dark'}));
      for(const s of [-1,1]){B('hull',hexa([[s*1.5-.07,-.55,-1.6],[s*1.5+.07,-.55,-1.6],[s*1.5+.07,-.55,1.45],[s*1.5-.07,-.55,1.45],[s*1.42-.06,.25,-1.5],[s*1.42+.06,.25,-1.5],[s*1.42+.06,.25,1.2],[s*1.42-.06,.25,1.2]],{lines:2,chip:true,name:'skirt'}))}
      B('hull',hexa([[-1.0,-.12,1.25],[1.0,-.12,1.25],[.9,-.12,1.5],[-.9,-.12,1.5],[-.95,.22,1.0],[.95,.22,1.0],[.85,.22,1.24],[-.85,.22,1.24]],{mat:'dark'}));
      for(const [x,y,z] of [[-.42,.05,1.37],[.42,.05,1.37],[0,.08,1.39]])B('hull',box(x,y,z,x?.22:.12,.07,.05,{mat:'glow',glow:'eye'}));
      B('hull',hexa([[-1.15,-.82,1.55],[1.15,-.82,1.55],[.95,-.92,2.15],[-.95,-.92,2.15],[-1.25,-.42,1.65],[1.25,-.42,1.65],[1.0,-.6,2.18],[-1.0,-.6,2.18]],{lines:2,chip:true,name:'ram'}));
      for(const s of [-1,1]){B('hull',cyl(s*.75,.75,-1.45,.17,.8,'y',8,{mat:'metal'}));B('hull',cyl(s*.75,1.17,-1.45,.12,.04,'y',8,{mat:'glow',glow:'heat'}))}
      B('hull',box(0,.38,-.55,.32,.05,2.0,{mat:'accent'}));
      B('turret',hexa([[-.96,0,-1.0],[.96,0,-1.0],[.86,0,1.0],[-.86,0,1.0],[-.76,.6,-.9],[.76,.6,-.9],[.6,.55,.66],[-.6,.55,.66]],{lines:2,name:'turret'}));
      for(const s of [-1,1]){B('turret',box(s*1.08,.34,-.2,.36,.46,1.02,{mat:'dark',chip:true}));B('turret',box(s*1.08,.34,.32,.26,.32,.03,{mat:'accent'}))}
      B('gun',box(0,0,.06,.82,.56,.46,{name:'mantlet'}));
      B('gun',cyl(0,0,.95,.28,1.25,'z',8,{mat:'dark'}));
      B('gun',cyl(0,0,2.15,.17,3.6,'z',8,{mat:'metal',name:'barrel'}));
      B('gun',box(0,0,4.08,.52,.3,.42,{mat:'dark'}));
      B('gun',cyl(0,0,4.31,.15,.04,'z',8,{mat:'glow',glow:'muzzle'}));
      for(const x of [-.72,-.36,0,.36,.72])B('rad',box(x,0,0,.07,.72,.5,{mat:'dark'}));
      B('mast',beam([0,0,0],[0,.48,-.1],.08,.05,{mat:'metal'}));B('mast',box(0,.5,-.1,.42,.1,.1,{mat:'accent'}));B('mast',box(0,.5,.0,.3,.05,.06,{mat:'glow',glow:'eye'}));
      B('rad',box(0,0,.12,1.66,.52,.04,{mat:'glow',glow:'heat'}));
      for(const n of ['FL','FR','RL','RR']){const s=n[1]==='L'?-1:1;
        B('hip'+n,cyl(0,0,0,.34,.72,'z',8,{mat:'dark'}));
        B('hip'+n,beam([0,.06,0],[s*1.25,.6,0],.58,.44,{lines:1,name:'thigh'},[0,0,1]));
        B('hip'+n,beam([s*.25,-.22,0],[s*1.1,.2,0],.12,.1,{mat:'metal'},[0,0,1]));
        B('knee'+n,cyl(0,0,0,.33,.66,'z',8,{mat:'metal'}));
        B('knee'+n,hexa([[s*.05-.32,-.2,-.38],[s*.05+.32,-.2,-.38],[s*.05+.32,-.2,.42],[s*.05-.32,-.2,.42],[-.26,.38,-.3],[.26,.38,-.3],[.26,.38,.36],[-.26,.38,.36]],{chip:true}));
        B('knee'+n,beam([0,0,0],[s*.42,-2.08,0],.4,.26,{mat:'armor',lines:1,name:'shin'},[0,0,1]));
        B('knee'+n,beam([s*.16,-.2,.24],[s*.36,-1.7,.18],.08,.07,{mat:'metal'},[1,0,0]));
        B('knee'+n,hexa([[s*.42-.36,-2.24,-.4],[s*.42+.36,-2.24,-.4],[s*.42+.36,-2.24,.44],[s*.42-.36,-2.24,.44],[s*.42-.24,-2.04,-.3],[s*.42+.24,-2.04,-.3],[s*.42+.24,-2.04,.3],[s*.42-.24,-2.04,.3]],{mat:'dark'}));
        for(const dz of [-.3,.05,.4])B('knee'+n,hexa([[s*.42-.07,-2.25,dz],[s*.42+.07,-2.25,dz],[s*.42+.04,-2.25,dz+.5],[s*.42-.04,-2.25,dz+.5],[s*.42-.07,-2.14,dz],[s*.42+.07,-2.14,dz],[s*.42+.03,-2.2,dz+.46],[s*.42-.03,-2.2,dz+.46]],{mat:'accent'}));
      }
      return P;
    },
    pose(e,A){
      const g=e.gait||0,mv=clamp(A.speed/3.5,0,1),brace=A.prep,rec=A.recoil,st=A.stag,t=gameTime+e.phase,sw=Math.sin(t*15)*st;
      const out={hull:{p:[0,-brace*.42-st*.25+Math.abs(Math.sin(g))*.05*mv,-rec*.22],r:[rec*.07+sw*.08-A.fwd*.04,st*.2*A.stagDir,Math.sin(g)*.035*mv+sw*.1]},
        turret:{r:[0,Math.sin(t*.6)*.05*(1-brace),0]},mast:{r:[0,Math.sin(t*.8)*.6,0]},gun:{p:[0,0,brace*.32-rec*.72],r:[brace*.04-rec*.08,0,0]},rad:{r:[-brace*.3,0,0]}};
      for(const [n,ph] of [['FL',0],['RR',0],['FR',Math.PI],['RL',Math.PI]]){const s=n[1]==='L'?-1:1,step=Math.sin(g+ph)*.2*mv,lift=Math.max(0,Math.cos(g+ph))*.22*mv+brace*.24+st*.12;
        out['hip'+n]={r:[0,step*(n[0]==='F'?1:-1),s*lift]};out['knee'+n]={r:[0,0,-s*lift*1.05]}}
      return out;
    }
  })
};
// ATLAS turret yaw sign: maps a bearing to the turret bone's y rotation (checked by a test).
const TITAN_TURRET_SIGN=1;
function titanStep(e){const d=Math.hypot(e.x-player.x,e.z-player.z),o=RIGS.TITAN.legHit.off*(e.stepHalf%2?1:-1);sfx.titanStep(e);if(d<90){const k=1-d/90;player.shake=Math.max(player.shake,.42*k);cockpit.heaveV-=.7*k}
  const fx=e.x+right(e.yaw).x*o,fz=e.z+right(e.yaw).z*o;shockwave(fx,.06,fz,'#ff6a52',6,.55,'ground');for(let i=0;i<10;i++)particles.push({x:fx+(Math.random()-.5)*3,y:.2,z:fz+(Math.random()-.5)*3,px:fx,py:.1,pz:fz,vx:(Math.random()-.5)*6,vy:.8+Math.random()*2,vz:(Math.random()-.5)*6,life:.5+Math.random()*.5,max:1,color:'#c8b89d',size:.5+Math.random()*.8})}
// Smoothed animation drivers, updated from AI state in updateEnemies.
function updateEnemyAnim(e,dt){
  const A=e.anim||(e.anim={bank:0,fwd:0,prep:0,dash:0,recoil:0,stag:0,stagDir:1,speed:0});
  const f=forward(e.yaw),r=right(e.yaw),vf=(e.vx||0)*f.x+(e.vz||0)*f.z,vs=(e.vx||0)*r.x+(e.vz||0)*r.z,sp=Math.hypot(e.vx||0,e.vz||0);
  const k=(rate)=>1-Math.exp(-rate*dt);
  A.speed=lerp(A.speed,sp,k(6));A.bank=lerp(A.bank,e.type==='KITE'?clamp(e.turn||0,-1,1):clamp(vs/14,-1,1),k(5));A.fwd=lerp(A.fwd,clamp(vf/12,-1,1),k(5));
  if(e.type==='KITE')A.climb=lerp(A.climb||0,clamp(e.climbK||0,-1,1),k(4));
  const prep=e.type==='LANCER'?(e.lungeWindup>0?1-clamp(e.lungeWindup/.42,0,1):0):e.charge>0?1-clamp(e.charge/(e.chargeDuration||.62),0,1):0;
  A.prep=lerp(A.prep,prep,k(prep>A.prep?14:5));A.dash=lerp(A.dash,e.dashT>0?1:0,k(e.dashT>0?18:6));
  A.recoil=Math.max(0,A.recoil-dt*2.8);A.stag=Math.max(0,A.stag-dt*1.7);
  if(e.type==='TITAN'){const want=clamp(angleDiff(Math.atan2(player.x-e.x,-(player.z-e.z)),e.yaw),-.9,.9)*TITAN_TURRET_SIGN;A.turret=lerp(A.turret||0,want,k(2.2));
    const half=Math.floor((e.gait||0)/Math.PI);if(e.awake&&e.alive&&A.speed>.4&&half!==e.stepHalf&&e.stepHalf!=null)titanStep(e);e.stepHalf=half}
  e.gait=(e.gait||0)+dt*(A.speed*(RIGS[e.type]?.gaitRate||1));
}
// Pose: bone transforms + world vertices for every part. Cached per render frame.
let poseFrame=0;
function enemyPose(e){
  const key=poseFrame+'|'+gameTime+'|'+e.x+'|'+eY(e)+'|'+e.z+'|'+e.yaw+'|'+(e.lostN||0);if(e._poseKey===key&&e._pose)return e._pose;
  const rig=RIGS[e.type]||RIGS.LANCER,A=e.anim||(updateEnemyAnim(e,0),e.anim),pz=rig.pose(e,A);
  const fwd=forward(e.yaw),rt=right(e.yaw),root={R:[rt.x,0,fwd.x,0,1,0,rt.z,0,fwd.z],t:[e.x,eY(e),e.z]};
  const X={};for(const [name,parent,rest] of rig.bones){const q=pz[name]||{},p=q.p?(rig.scale?q.p.map(c=>c*rig.scale):q.p):[0,0,0],r=q.r||[0,0,0];const local={R:M3.rot(r[0],r[1],r[2]),t:[rest[0]+p[0],rest[1]+p[1],rest[2]+p[2]]};X[name]=parent?xfMul(X[parent],local):xfMul(root,local)}
  const parts=rig.parts.map((P,i)=>{const B=X[P.bone];return{P,i,X:B,wv:P.verts.map(v=>xfPoint(B,v))}});
  e._pose={rig,X,parts};e._poseKey=key;return e._pose;
}
function enemyMuzzles(e){const pose=enemyPose(e);return pose.rig.muzzles.map(([b,v])=>xfPoint(pose.X[b],v))}
function enemyCenter(e){const rig=RIGS[e.type]||RIGS.LANCER;return{x:e.x,y:rig.hit.cy+eY(e),z:e.z}}
function enemyScreenBox(e,viewYaw,viewPitch){
  const pose=enemyPose(e);let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,dsum=0,n=0;
  for(const p of pose.parts){if(e.lost?.[p.i])continue;for(const v of p.wv){const q=project(v[0],v[1],v[2],viewYaw,viewPitch);if(!q)continue;x0=Math.min(x0,q.x);x1=Math.max(x1,q.x);y0=Math.min(y0,q.y);y1=Math.max(y1,q.y);dsum+=q.depth;n++}}
  return n?{x0,x1,y0,y1,depth:dsum/n,n}:null;
}
function randomEnemyPoint(e){const pose=enemyPose(e),p=pose.parts[Math.floor(Math.random()*pose.parts.length)],v=p.wv[Math.floor(Math.random()*p.wv.length)];return{x:v[0],y:v[1],z:v[2]}}

// --- face renderer -------------------------------------------------------------------
const KEY_LIGHT=(()=>{const v=[-.35,.86,.38],l=vlen(v);return v.map(x=>x/l)})();
function shadeRGB(base,lam,face,rim,tint,hot){
  const k=.22+.86*lam+.24*face;let r=base[0]*k+tint[0]*.14*rim,g=base[1]*k+tint[1]*.14*rim,b=base[2]*k+tint[2]*.14*rim;
  if(hot>0){r=lerp(r,255,hot);g=lerp(g,236,hot);b=lerp(b,210,hot)}
  return`rgb(${r|0},${g|0},${b|0})`;
}
const hexRGB=hex=>{const n=parseInt(hex.slice(1),16);return[n>>16,n>>8&255,n&255]};
// insts: [{P, wv:[world verts], R:3x3 for normals, hot, hidden}]
// Screen polygons of matte (cel) surfaces this frame; applyBloom blacks them out of the glow source.
const bloomMask=[];
// Manga screentone for cel shadows (screen-space dots, like printed tone).
let tonePat=null;function screentone(){if(tonePat!==null)return tonePat;const c=makeCanvas();if(!c||!ctx.createPattern)return tonePat=0;c.width=c.height=4;const g=c.getContext('2d');g.fillStyle='#000';g.beginPath();g.arc(1,1,.9,0,TAU);g.fill();g.beginPath();g.arc(3,3,.9,0,TAU);g.fill();return tonePat=ctx.createPattern(c,'repeat')||0}
function renderMeshInstances(insts,viewYaw,viewPitch,o){
  const eye=[player.x,CAMERA_Y,player.z],faces=[];
  for(const I of insts){
    if(I.hidden)continue;const P=I.P;I.pv=I.wv.map(v=>project(v[0],v[1],v[2],viewYaw,viewPitch));
    I.front=new Array(P.faces.length).fill(false);I.order=new Array(P.faces.length).fill(-1);I.wn=new Array(P.faces.length);
    P.faces.forEach((F,fi)=>{
      if(o.revealY!=null&&F.idx.every(i=>I.wv[i][1]>o.revealY))return;
      const n=M3.ap(I.R,F.n);I.wn[fi]=n;let cx=0,cy=0,cz=0,ok=true,depth=0;
      for(const i of F.idx){const v=I.wv[i];cx+=v[0];cy+=v[1];cz+=v[2];const q=I.pv[i];if(!q){ok=false;break}depth+=q.depth}
      if(!ok)return;const m=F.idx.length;cx/=m;cy/=m;cz/=m;
      const vx=cx-eye[0],vy=cy-eye[1],vz=cz-eye[2],dot=n[0]*vx+n[1]*vy+n[2]*vz;if(dot>=0)return;
      const vl=Math.hypot(vx,vy,vz)||1;I.front[fi]=true;faces.push({I,fi,F,n,depth:depth/m,facing:-dot/vl,c:[cx,cy,cz]});
    });
  }
  faces.sort((a,b)=>b.depth-a.depth);faces.forEach((f,k)=>f.I.order[f.fi]=k);
  const S0=o.style,silW=o.silW,crW=o.crW,alpha=o.alpha,halo=[],inked=new Set();
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.shadowBlur=0;
  for(let k=0;k<faces.length;k++){
    const f=faces[k],I=f.I,P=I.P,F=f.F,pts=F.idx.map(i=>I.pv[i]),S=I.style||S0,edgeRGB=S.edgeRGB||(S.edgeRGB=hexRGB(S.edge));
    if(S.toon&&P.mat!=='glow'){const T=S.toon;
      // Heavy ink contour: the first time a cel group appears in painter order, lay its whole silhouette
      // down in ink with a wide stroke; the faces then cover the inside, leaving the outer contour.
      if(!inked.has(T)){inked.add(T);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=alpha;ctx.fillStyle=ctx.strokeStyle=T.ink;ctx.lineWidth=o.inkW||5;ctx.beginPath();
        for(const g of faces){if((g.I.style||S0).toon!==T||g.I.P.mat==='glow')continue;const q=g.F.idx.map(i=>g.I.pv[i]);ctx.moveTo(q[0].x,q[0].y);for(let i=1;i<q.length;i++)ctx.lineTo(q[i].x,q[i].y);ctx.closePath()}
        ctx.fill();ctx.stroke()}
      bloomMask.push(pts);
      const lam=Math.max(0,f.n[0]*KEY_LIGHT[0]+f.n[1]*KEY_LIGHT[1]+f.n[2]*KEY_LIGHT[2]),tone=(T[P.mat]||T.armor)[lam+.25*f.facing>.5?0:1],hot=Math.max(I.hot||0,o.hitPoint&&Math.hypot(f.c[0]-o.hitPoint.x,f.c[1]-o.hitPoint.y,f.c[2]-o.hitPoint.z)<1.3?o.hitT:0);
      ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);ctx.closePath();
      ctx.globalCompositeOperation='source-over';ctx.globalAlpha=alpha*(o.fillAlpha??1);ctx.fillStyle=hot>0?`rgb(${lerp(tone[0],255,hot)|0},${lerp(tone[1],240,hot)|0},${lerp(tone[2],215,hot)|0})`:`rgb(${tone[0]},${tone[1]},${tone[2]})`;ctx.fill();
      if(T.tone&&tone===(T[P.mat]||T.armor)[1]){const pat=screentone();if(pat){ctx.globalAlpha=alpha*.3;ctx.fillStyle=pat;ctx.fill()}}
      if(F.lines&&pts.length===4){ctx.globalAlpha=alpha*.45;ctx.strokeStyle=T.ink;ctx.lineWidth=Math.max(.8,crW);ctx.beginPath();for(let j=1;j<=F.lines;j++){const t=j/(F.lines+1);ctx.moveTo(lerp(pts[0].x,pts[3].x,t),lerp(pts[0].y,pts[3].y,t));ctx.lineTo(lerp(pts[1].x,pts[2].x,t),lerp(pts[1].y,pts[2].y,t))}ctx.stroke()}
      ctx.beginPath();let any=false;for(const ei of F.edges){const E=P.edges[ei],other=E.f0===f.fi?E.f1:E.f0,a=I.pv[E.a],b=I.pv[E.b];if(!a||!b)continue;const oFront=other>=0&&I.front[other];
        if(!oFront||(E.crease>.25&&I.order[other]<k)){ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);any=true}}
      if(any){ctx.globalAlpha=alpha*.95;ctx.strokeStyle=T.ink;ctx.lineWidth=Math.max(1.2,(o.inkW||5)*.34);ctx.stroke();if(P.mat==='accent'||P.size>.9){ctx.globalCompositeOperation='lighter';ctx.globalAlpha=alpha*.28;ctx.strokeStyle=T.trace;ctx.lineWidth=.9;ctx.stroke();ctx.globalCompositeOperation='source-over'}}
      continue}
    ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);ctx.closePath();
    const hot=Math.max(I.hot||0,o.hitPoint&&Math.hypot(f.c[0]-o.hitPoint.x,f.c[1]-o.hitPoint.y,f.c[2]-o.hitPoint.z)<1.3?o.hitT:0);
    if(P.mat==='glow'){
      const gi=(o.glow?.[P.glow]??1)*(I.glowK??1);ctx.globalCompositeOperation='lighter';ctx.globalAlpha=alpha*clamp(.12+.42*gi,0,.75);ctx.fillStyle=S.glow;ctx.fill();
      ctx.globalAlpha=alpha*clamp(.35+.65*gi,0,1);ctx.strokeStyle=S.core;ctx.lineWidth=crW*1.2;ctx.stroke();ctx.globalCompositeOperation='source-over';continue;
    }
    const lam=Math.max(0,f.n[0]*KEY_LIGHT[0]+f.n[1]*KEY_LIGHT[1]+f.n[2]*KEY_LIGHT[2]),rim=Math.pow(1-f.facing,2.2);
    const base=P.mat==='dark'?S.darkRGB:P.mat==='metal'?S.metalRGB:P.mat==='accent'?S.accentRGB:S.armorRGB;
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=alpha*(o.fillAlpha??1);ctx.fillStyle=shadeRGB(base,lam,f.facing,rim,edgeRGB,hot);ctx.fill();
    // FOTONICA-style panel lines: more lines read on lit planes, they vanish on dark ones.
    if(F.lines&&o.detail&&pts.length===4){ctx.globalAlpha=alpha*(.05+.17*lam);ctx.strokeStyle=S.edge;ctx.lineWidth=.6;ctx.beginPath();
      for(let j=1;j<=F.lines;j++){const t=j/(F.lines+1);ctx.moveTo(lerp(pts[0].x,pts[3].x,t),lerp(pts[0].y,pts[3].y,t));ctx.lineTo(lerp(pts[1].x,pts[2].x,t),lerp(pts[1].y,pts[2].y,t))}ctx.stroke()}
    // Edges: silhouette (neighbour is back-facing) and creases (neighbour already drawn).
    ctx.beginPath();let sil=false;const cr=new Path2DShim();
    for(const ei of F.edges){const E=P.edges[ei],other=E.f0===f.fi?E.f1:E.f0,a=I.pv[E.a],b=I.pv[E.b];if(!a||!b)continue;
      const oFront=other>=0&&I.front[other];
      if(!oFront){ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);sil=true;if(o.halo&&(P.mat==='accent'||hot>0||P.size>1.2))halo.push(a.x,a.y,b.x,b.y)}
      else if(E.crease>.1&&I.order[other]<k&&o.creases)cr.add(a,b,E.crease)}
    const hotEdge=hot>0?S.core:P.mat==='accent'?S.accent:S.edge;
    const major=P.size>.9||P.mat==='accent'||hot>0;
    if(sil){ctx.globalAlpha=alpha*(major?1:.62);ctx.strokeStyle=hotEdge;ctx.lineWidth=major?silW:silW*.75;ctx.stroke()}
    if(cr.n){ctx.beginPath();cr.trace();ctx.globalAlpha=alpha*(major?.38:.24);ctx.strokeStyle=hotEdge;ctx.lineWidth=crW;ctx.stroke()}
  }
  if(halo.length&&o.halo){ctx.globalCompositeOperation='lighter';ctx.beginPath();for(let i=0;i<halo.length;i+=4){ctx.moveTo(halo[i],halo[i+1]);ctx.lineTo(halo[i+2],halo[i+3])}
    ctx.globalAlpha=alpha*o.halo;ctx.strokeStyle=S0.edge;ctx.lineWidth=silW*3.4;ctx.stroke();ctx.globalAlpha=alpha*.5*o.halo;ctx.strokeStyle=S0.core;ctx.lineWidth=Math.max(.5,silW*.4);ctx.stroke()}
  ctx.restore();
  return faces.length;
}
function Path2DShim(){this.s=[];this.n=0}
Path2DShim.prototype.add=function(a,b){this.s.push(a.x,a.y,b.x,b.y);this.n++};
Path2DShim.prototype.trace=function(){for(let i=0;i<this.s.length;i+=4){ctx.moveTo(this.s[i],this.s[i+1]);ctx.lineTo(this.s[i+2],this.s[i+3])}};
for(const [type,S] of Object.entries(CLASS_STYLE)){S.armorRGB=S.armor;S.darkRGB=S.dark;S.metalRGB=S.metal;S.accentRGB=hexRGB(S.accent).map(v=>v*.42)}

function drawEnemy(e,viewYaw,viewPitch){
  const pose=enemyPose(e),rig=pose.rig,S=CLASS_STYLE[e.type]||CLASS_STYLE.LANCER,A=e.anim;
  const c=project(e.x,rig.hit.cy+eY(e),e.z,viewYaw,viewPitch);if(!c)return;
  const depth=c.depth,near=clamp((60-depth)/48,0,1),far=clamp((depth-70)/90,0,1),hot=e.flash>0?clamp(e.flash/.1,0,1)*.85:0;
  const reveal=e.wakeT>0?1-e.wakeT/.62:1,revealY=reveal<1?reveal*(rig.height+.4):null,pulse=.5+.5*Math.sin(gameTime*2.1+e.phase);
  // A dormant hostile is solid like any other (a see-through one read as standing behind a wall); it is
  // asleep because its lights are out: eyes, vents and thrusters at a tenth.
  const sleep=e.awake?1:.1,glow={eye:.75+.25*pulse+A.prep*.6,tip:.55+.3*pulse+A.prep*.8+A.dash*.6,thrust:.35+A.dash*1.3+A.speed*.04+A.prep*.3,hover:.55+.2*Math.sin(gameTime*9+e.phase),core:.6+.4*pulse,blade:A.prep*1.2+A.dash,vent:A.prep*1.3+A.dash*.8,heat:.35+A.prep*.9+A.recoil*.8,muzzle:A.prep*1.3+A.recoil};if(sleep<1)for(const k in glow)glow[k]*=sleep;
  const insts=pose.parts.map(p=>({P:p.P,wv:p.wv,R:p.X.R,hidden:e.lost?.[p.i]}));
  // WebGL: hostiles are batched and drawn after the sorted pass (buildings occlude them through depth);
  // the ground contact and the hostile effects are recorded into the same pass.
  if(threeEnemy(e)){enemyBatch.push({e,insts,S,hot,glow,ghost:0,revealY});drawEnemyGround(e,viewYaw,viewPitch);enemyFXQueue.push(e);return}
  renderMeshInstances(insts,viewYaw,viewPitch,{style:S,inkW:2+near*3.2,alpha:1-far*.35,silW:1.35+near*.95,crW:.8+near*.35,halo:e.awake?.07+.05*pulse+.25*hot:0,detail:depth<75,creases:depth<110,glow,revealY,hitPoint:e.hitPoint,hitT:e.hitT>0?clamp(e.hitT/.12,0,1):0,fillAlpha:1});
  drawEnemyFX(e,viewYaw,viewPitch);drawEnemyGround(e,viewYaw,viewPitch)
}
// Keep WebGL-drawn matte surfaces out of the bloom source, as renderMeshInstances does: front faces only
// (back faces wind the other way and would punch holes in the nonzero-filled mask).
function maskInstsFromBloom(insts,viewYaw,viewPitch){const ex=player.x,ey=CAMERA_Y,ez=player.z;
  for(const I of insts){if(I.P.mat==='glow'||I.hidden)continue;const R=I.R;for(const F of I.P.faces){const n=F.n,nx=R[0]*n[0]+R[1]*n[1]+R[2]*n[2],ny=R[3]*n[0]+R[4]*n[1]+R[5]*n[2],nz=R[6]*n[0]+R[7]*n[1]+R[8]*n[2],v0=I.wv[F.idx[0]];
    if(nx*(v0[0]-ex)+ny*(v0[1]-ey)+nz*(v0[2]-ez)>=0)continue;const q=F.idx.map(i=>{const v=I.wv[i];return project(v[0],v[1],v[2],viewYaw,viewPitch)});if(q.every(Boolean))bloomMask.push(q)}}}
const enemyBatch=[],enemyFXQueue=[];
function threeEnemy(e){const T3=typeof window!=='undefined'&&window.HF_THREE;if(!(T3&&T3.active))return false;if(T3.world)return true;return !!(T3.enemies!==false&&e.awake&&!(e.wakeT>0))}
function flushThreeEnemies(viewYaw,viewPitch){
  if(!enemyBatch.length&&!worldRec)return;const T3=window.HF_THREE,insts=[];
  for(const B of enemyBatch){const e=B.e,hitT=e.hitT>0?clamp(e.hitT/.12,0,1):0;B.insts.forEach((I,i)=>{if(I.hidden)return;insts.push({P:I.P,wv:I.wv,R:I.R,style:B.S,key:'e'+e.type+e.id+':'+i,hot:B.hot,ghost:B.ghost,revealY:B.revealY,glowK:I.P.mat==='glow'?(B.glow[I.P.glow]??1):1,hitPos:hitT>0&&e.hitPoint?[e.hitPoint.x,e.hitPoint.y,e.hitPoint.z]:null,hitT})})}
  // with the world in WebGL the hostile effects (reveal, afterimages, muzzles) go into the same pass
  if(worldRec){for(const e of enemyFXQueue)drawEnemyFX(e,viewYaw,viewPitch);enemyFXQueue.length=0}
  const W3=worldRec;worldRec=null;
  // with the world in WebGL, broken components join the same depth pass (they tumble behind buildings too)
  if(W3)for(const d of debris){const k=d.age/d.life;insts.push({P:d.P,wv:debrisVerts(d),R:M3.mul(d.D,d.R0),style:CLASS_STYLE[d.type],key:'ed'+d.uid,hot:Math.max(0,1-d.age/.22)*.9,glowK:1-k})}
  const ok=T3.draw({layer:'enemies',bloom:fxHigh,insts,world:W3,occluders:W3?null:buildings,syncMix,viewYaw,viewPitch,W,H,DPR,focal:renderFocal,camY:CAMERA_Y,px:player.x,pz:player.z,near:NEAR_Z,light:KEY_LIGHT,inkW:clamp(H/720*3,2,6)});
  if(ok){ctx.save();ctx.globalAlpha=1;ctx.drawImage(T3.canvas,0,0,W,H);ctx.restore();threeWorldFrame=!!W3;if(!W3)maskInstsFromBloom(insts,viewYaw,viewPitch)}
  else for(const B of enemyBatch)renderMeshInstances(B.insts,viewYaw,viewPitch,{style:B.S,inkW:3,alpha:1,silW:1.6,crW:.9,halo:.08,detail:true,creases:true,glow:B.glow});
  for(const e of enemyFXQueue)drawEnemyFX(e,viewYaw,viewPitch);enemyBatch.length=0;enemyFXQueue.length=0}
function drawEnemyFX(e,viewYaw,viewPitch){
  const pose=enemyPose(e),rig=pose.rig,S=CLASS_STYLE[e.type]||CLASS_STYLE.LANCER,A=e.anim,reveal=e.wakeT>0?1-e.wakeT/.62:1,revealY=reveal<1?reveal*(rig.height+.4):null;
  if(worldRec){recordEnemyFX(e,pose,rig,S,A,revealY,viewYaw,viewPitch);return}
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
  if(revealY!=null){const rr=(rig.type==='SCOUT'?3.6:rig.type==='TITAN'?7:rig.heavy?3.2:1.8);let prev=null;ctx.strokeStyle='#ffffff';ctx.lineWidth=1.2;ctx.globalAlpha=.85;ctx.beginPath();
    for(let i=0;i<=36;i++){const a=i/36*TAU,q=project(e.x+Math.cos(a)*rr,revealY,e.z+Math.sin(a)*rr,viewYaw,viewPitch);if(q&&prev){ctx.moveTo(prev.x,prev.y);ctx.lineTo(q.x,q.y)}prev=q}ctx.stroke();ctx.globalAlpha=.3;ctx.strokeStyle=S.edge;ctx.lineWidth=5;ctx.stroke()}
  // Speed is carried by the machine: afterimages of the signature parts during dash / lunge.
  if(A.dash>.2&&e.px!=null){const dx=e.x-e.px,dz=e.z-e.pz,len=Math.hypot(dx,dz);if(len>1e-3){const ux=dx/len,uz=dz/len,names=rig.type==='SCOUT'?['wing','winglet']:rig.type==='LANCER'?['blade','shield','fin']:['barrel','turret'];
    for(const p of pose.parts){if(!names.includes(p.P.name))continue;for(let g=1;g<=3;g++){const off=g*1.1*A.dash;const pts=p.wv.map(v=>project(v[0]-ux*off,v[1],v[2]-uz*off,viewYaw,viewPitch));if(pts.some(q=>!q))continue;
      ctx.globalAlpha=.22*A.dash/g;ctx.strokeStyle=S.edge;ctx.lineWidth=1;ctx.beginPath();for(const E of p.P.edges){if(E.crease<.3)continue;ctx.moveTo(pts[E.a].x,pts[E.a].y);ctx.lineTo(pts[E.b].x,pts[E.b].y)}ctx.stroke()}}}}
  // Muzzle charge / flash at the real muzzles.
  const charge=rig.heavy&&e.charge>0?1-clamp(e.charge/(e.chargeDuration||.62),0,1):rig.type==='SCOUT'&&e.charge>0?1-clamp(e.charge/(e.chargeDuration||.24),0,1):0;
  if(charge>0||e.muzzle>0){for(const m of enemyMuzzles(e)){const q=project(m[0],m[1],m[2],viewYaw,viewPitch);if(!q)continue;const r=clamp(.5*q.f,3,46);
    if(charge>0){ctx.globalAlpha=.25+.55*charge;ctx.strokeStyle=S.glow;ctx.lineWidth=1.4;for(let k=0;k<2;k++){ctx.beginPath();ctx.arc(q.x,q.y,r*(1.6-charge*.9)+k*6,0,TAU);ctx.stroke()}ctx.fillStyle=S.glow;ctx.globalAlpha=.2+.6*charge;ctx.beginPath();ctx.arc(q.x,q.y,r*.35*(.4+charge),0,TAU);ctx.fill()}
    if(e.muzzle>0){ctx.globalAlpha=.5;ctx.fillStyle=S.glow;ctx.beginPath();ctx.arc(q.x,q.y,r*.9,0,TAU);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle='#fff8ee';ctx.beginPath();ctx.arc(q.x,q.y,r*.35,0,TAU);ctx.fill()}}}
  if(e.breakFlash>0){const b=enemyScreenBox(e,viewYaw,viewPitch);if(b){ctx.globalAlpha=clamp(e.breakFlash*1.6,0,.9);ctx.strokeStyle='#ffe59a';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc((b.x0+b.x1)/2,(b.y0+b.y1)/2,Math.max(b.x1-b.x0,b.y1-b.y0)*(.42+(1-e.breakFlash)*.3)+12,0,TAU);ctx.stroke()}}
  ctx.restore();
}
function drawEnemyGround(e,viewYaw,viewPitch){
  if(eY(e)>22)return;
  const rig=RIGS[e.type]||RIGS.LANCER,S=CLASS_STYLE[e.type]||CLASS_STYLE.LANCER,c=project(e.x,rig.hit.cy+eY(e),e.z,viewYaw,viewPitch);if(!c)return;const depth=c.depth,near=clamp((60-depth)/48,0,1);
  // Ground contact: a physical shadow + contact ring only for acquired or close machines.
  const ring=project(e.x,.04,e.z,viewYaw,viewPitch),edgeP=project(e.x+right(e.yaw).x*rig.body,.04,e.z+right(e.yaw).z*rig.body,viewYaw,viewPitch);
  if(ring&&edgeP&&worldRec){const rr=clamp(Math.hypot(edgeP.x-ring.x,edgeP.y-ring.y),5,Math.max(W,H)*.42),under={x:ring.x,y:ring.y,depth:ring.depth+rig.body};
    // pushed back by the body radius so the whole machine stands on its shadow, not in it
    if(depth<70)recDisc({x:ring.x,y:ring.y+1,depth:under.depth},rr,'#000',(e.awake?1:.3)*(.12+.18*near),false,0,Math.max(2.5,rr*.2)/rr);
    if(e.marked>0||e.designated>0||depth<30){const des=e.designated>0;recDisc(under,rr,des?'#67ffd1':S.edge,des?.24:.12,false,.8,Math.max(2,rr*.2)/rr)}
    return}
  if(ring&&edgeP){const rr=clamp(Math.hypot(edgeP.x-ring.x,edgeP.y-ring.y),5,Math.max(W,H)*.42);ctx.save();
    if(depth<70){ctx.globalAlpha=(e.awake?1:.3)*(.12+.18*near);ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(ring.x,ring.y+1,rr,Math.max(2.5,rr*.2),0,0,TAU);ctx.fill()}
    if(e.marked>0||e.designated>0||depth<30){const des=e.designated>0;ctx.globalAlpha=des?.24:.12;ctx.strokeStyle=des?'#67ffd1':S.edge;ctx.lineWidth=.8;ctx.beginPath();ctx.ellipse(ring.x,ring.y,rr,Math.max(2,rr*.2),0,0,TAU);ctx.stroke()}
    ctx.restore()}
}
function drawStreetLights(viewYaw,viewPitch){
  // Lane beacons are infrastructure markers, not a repeated lamp-post fence.
  const marks=[118,82,43,4,-39,-78,-116];
  ctx.save();ctx.lineCap='round';
  for(let k=0;k<marks.length;k++)for(const side of [-1,1]){
    const z=marks[k],x=side*(k%2?17.2:16.4),b=project(x,0,z,viewYaw,viewPitch),t=project(x,side>0?3.8:4.5,z,viewYaw,viewPitch);if(!b||!t||t.depth>132)continue;
    if(worldRec){const a=clamp(1-(t.depth-35)/120,.10,.34),ty=side>0?3.8:4.5;recLine(x,0,z,x,ty,z,'87,255,207',a,.85);recLine(x,ty,z,x-side*1.4,ty-.25,z,'87,255,207',a*.72,.85);recDot(x,ty,z,'176,255,232',Math.min(.58,a*1.7),.28,1,3.2);continue}
    const a=clamp(1-(t.depth-35)/120,.10,.34);ctx.strokeStyle=`rgba(87,255,207,${a})`;ctx.lineWidth=.85;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(t.x,t.y);ctx.stroke();
    const arm=project(x-side*1.4,(side>0?3.8:4.5)-.25,z,viewYaw,viewPitch);if(arm){ctx.strokeStyle=`rgba(87,255,207,${a*.72})`;ctx.beginPath();ctx.moveTo(t.x,t.y);ctx.lineTo(arm.x,arm.y);ctx.stroke()}
    ctx.shadowBlur=7;ctx.shadowColor='#67ffd1';ctx.fillStyle=`rgba(176,255,232,${Math.min(.58,a*1.7)})`;ctx.beginPath();ctx.arc(t.x,t.y,clamp(5/t.depth*18,1.0,3.2),0,TAU);ctx.fill();ctx.shadowBlur=0;
  }
  ctx.restore();
}
// ---- the overlay effects recorded for the WebGL pass (same shapes as the Canvas paths below) ----
const atDepth=(p,depth)=>({x:p.x,y:p.y,depth});
function recordEnemyFX(e,pose,rig,S,A,revealY,viewYaw,viewPitch){
  if(revealY!=null){const rr=(rig.type==='SCOUT'?3.6:rig.type==='TITAN'?7:rig.heavy?3.2:1.8);
    for(let i=0;i<36;i++){const a0=i/36*TAU,a1=(i+1)/36*TAU,x0=e.x+Math.cos(a0)*rr,z0=e.z+Math.sin(a0)*rr,x1=e.x+Math.cos(a1)*rr,z1=e.z+Math.sin(a1)*rr;recWSeg(x0,revealY,z0,x1,revealY,z1,S.edge,.3,5);recWSeg(x0,revealY,z0,x1,revealY,z1,'#ffffff',.85,1.2)}}
  if(A.dash>.2&&e.px!=null){const dx=e.x-e.px,dz=e.z-e.pz,len=Math.hypot(dx,dz);if(len>1e-3){const ux=dx/len,uz=dz/len,names=rig.type==='SCOUT'?['wing','winglet']:rig.type==='LANCER'?['blade','shield','fin']:['barrel','turret'];
    for(const p of pose.parts){if(!names.includes(p.P.name))continue;for(let g=1;g<=3;g++){const off=g*1.1*A.dash;for(const E of p.P.edges){if(E.crease<.3)continue;const a=p.wv[E.a],b=p.wv[E.b];recWSeg(a[0]-ux*off,a[1],a[2]-uz*off,b[0]-ux*off,b[1],b[2]-uz*off,S.edge,.22*A.dash/g,1)}}}}}
  const charge=rig.heavy&&e.charge>0?1-clamp(e.charge/(e.chargeDuration||.62),0,1):rig.type==='SCOUT'&&e.charge>0?1-clamp(e.charge/(e.chargeDuration||.24),0,1):0;
  // muzzle light is drawn a little in front of the muzzle so the barrel end does not cut it
  if(charge>0||e.muzzle>0){for(const m of enemyMuzzles(e)){const q=project(m[0],m[1],m[2],viewYaw,viewPitch);if(!q)continue;const r=clamp(.5*q.f,3,46),f=atDepth(q,Math.max(NEAR_Z,q.depth-.4));
    if(charge>0){for(let k=0;k<2;k++)recDisc(f,r*(1.6-charge*.9)+k*6,S.glow,.25+.55*charge,true,1.4);recDisc(f,r*.35*(.4+charge),S.glow,.2+.6*charge)}
    if(e.muzzle>0){recDisc(f,r*.9,S.glow,.5);recDisc(f,r*.35,'#fff8ee',1)}}}
  if(e.breakFlash>0){const b=enemyScreenBox(e,viewYaw,viewPitch),c=project(e.x,rig.hit.cy+eY(e),e.z,viewYaw,viewPitch);if(b&&c)recDisc({x:(b.x0+b.x1)/2,y:(b.y0+b.y1)/2,depth:Math.max(NEAR_Z,c.depth-rig.body)},Math.max(b.x1-b.x0,b.y1-b.y0)*(.42+(1-e.breakFlash)*.3)+12,'#ffe59a',clamp(e.breakFlash*1.6,0,.9),true,1.6)}
}
function recordBolts(viewYaw,viewPitch){
  for(const b of playerBolts){const a=project(b.px,b.py,b.pz,viewYaw,viewPitch),p=project(b.x,b.y,b.z,viewYaw,viewPitch);if(!a||!p)continue;
    const tail=clamp(34/p.depth*24,10,58),dx=p.x-a.x,dy=p.y-a.y,len=Math.hypot(dx,dy)||1,t={x:p.x-dx/len*tail,y:p.y-dy/len*tail,depth:a.depth},linked=!!b.syncId,col=linked?'#67ffd1':'#ffb347',w=clamp((linked?14:12)/p.depth*18,2.6,linked?8:7.5);
    recSeg(t,p,col,.18,w*2.3);recSeg(t,p,col,.85,w);recSeg(t,p,linked?'#e6fff7':'#fff6dc',1,Math.max(1.2,w*.36));recDisc(p,clamp((linked?8:7)/p.depth*18,1.6,6),'#ffffff',1)}
  for(const b of enemyBolts){const a=project(b.px,b.py,b.pz,viewYaw,viewPitch),p=project(b.x,b.y,b.z,viewYaw,viewPitch);if(!a||!p)continue;
    const heavy=b.heavy,col=b.big?'#ff3a4a':heavy?'#ff8a4a':'#ff4b3a',r=clamp((b.big?.9:heavy?.55:.38)*p.f,2.2,b.big?34:heavy?26:18),t={x:p.x-(p.x-a.x)*3,y:p.y-(p.y-a.y)*3,depth:a.depth};
    recSeg(t,p,col,.35,r*1.3);recSeg(t,p,'#ffb09a',.9,r*.45);recDisc(p,r*1.9,col,.22);recDisc(p,r*.75,col,.95);recDisc(p,r*.36,'#fff1ea',.95)}
  // exhaust ribbon from the flight history: segment alpha aK*k, width clamp(wk*f)*(w0+(1-w0)*k), hot colour past hotK
  const trail=(m,col,hotCol,hotK,aK,wk,wmin,wmax,w0,r,haloK,haloCol,haloA)=>{const pts=m.hist.map(h=>project(h.x,h.y,h.z,viewYaw,viewPitch));pts.push(project(m.x,m.y,m.z,viewYaw,viewPitch));
    for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];if(!a||!b)continue;const k=i/pts.length;recSeg(a,b,k>hotK?hotCol:col,aK*k,clamp(wk*b.f,wmin,wmax)*(w0+(1-w0)*k))}
    const p=pts[pts.length-1];if(!p)return;const R=r(p);recDisc(p,R*haloK,haloCol,haloA);recDisc(p,R,'#fffbe8',1)};
  for(const m of missiles)trail(m,'#ffc75a','#fff2c4',.8,.55,.32,1,9,.4,p=>clamp(16/p.depth*9,2,8),2.6,'#ffd56b',.3);
  for(const m of rockets)trail(m,'#ff9a4a','#fff2cf',.75,.6,.5,1.5,14,.35,p=>clamp(24/p.depth*9,2.5,12),2.8,'#ffb35c',.35);
}
function recordParticles(viewYaw,viewPitch){
  for(const p of particles){const q=project(p.x,p.y,p.z,viewYaw,viewPitch);if(!q)continue;const a=clamp(p.life/(p.max||1),0,1);
    if(p.kind==='mote'){const homing=p.age>p.home,tail=project(p.x-p.vx*.025,p.y-p.vy*.025,p.z-p.vz*.025,viewYaw,viewPitch),r=clamp(.085*q.f,1.1,3.4),ma=Math.min(1,a*2.4),col=homing?'#7dffdc':p.color;
      if(tail&&Math.abs(tail.x-q.x)+Math.abs(tail.y-q.y)<140)recSeg(tail,q,col,ma,r);else recSeg({x:q.x-.6,y:q.y,depth:q.depth},q,col,ma,r);
      recDisc(q,r*.45,'#f2fffb',ma);continue}
    if(p.ring){recDisc(q,p.size*q.f*(1-a*.4),p.color,a,true,1.4);continue}
    const tail=project(p.x-p.vx*.04,p.y-p.vy*.04,p.z-p.vz*.04,viewYaw,viewPitch),s=clamp(p.size*q.f*.42,1,14),w=clamp(s*.42,.9,3.6);
    let A,B;if(tail&&Math.abs(tail.x-q.x)+Math.abs(tail.y-q.y)<220&&Math.abs(tail.x-q.x)+Math.abs(tail.y-q.y)>s*.5){A=tail;B=q}else{A={x:q.x-s*.7,y:q.y+s*.3,depth:q.depth};B={x:q.x+s*.7,y:q.y-s*.3,depth:q.depth}}
    recSeg(A,B,p.color,a,w);if(p.hot&&a>.45)recSeg(A,B,p.hot,a,w*.42)}
}
function recordShards(viewYaw,viewPitch){
  for(const s of shards){const e=shardEnds(s),q=projectSegment(e[0],e[1],e[2],e[3],e[4],e[5],viewYaw,viewPitch);if(!q||!q[0]||!q[1])continue;
    const k=s.age/s.life,hot=clamp(1-s.age/.14,0,1),fade=1-clamp((k-.6)/.4,0,1)*.65,len=Math.hypot(q[1].x-q[0].x,q[1].y-q[0].y),w=s.width*clamp(q[0].f/36,.5,2.2);
    let dash=null;if(k>.45){const g=(k-.45)/.55;dash=[Math.max(.8,len*.2*(1-g)+.8),len*.06+g*len*.3+1]}
    recSeg(q[0],q[1],s.color,.26*fade,w*3.4,true,dash);recSeg(q[0],q[1],hot>0?'#fff6ea':s.color,.95*fade,w,true,dash);recSeg(q[0],q[1],'#ffffff',(.55+.45*hot)*fade,Math.max(.6,w*.34),true,dash)}
}
function recordWaves(viewYaw,viewPitch){
  for(const w of waves){const a=clamp(w.life/w.max,0,1),k=1-a,ease=1-Math.pow(1-k,3);
    if(w.kind==='light'){const q=project(w.x,w.y,w.z,viewYaw,viewPitch);if(!q)continue;const r=Math.min(Math.max(W,H),w.size*q.f*(.55+.6*k));if(r<3)continue;recDisc(q,r,w.color,.62*a,true,0,1,1);continue}
    if(w.kind==='ground'){const r=Math.max(.3,w.size*ease);for(let i=0;i<48;i++){const t0=i/48*TAU,t1=(i+1)/48*TAU,x0=w.x+Math.cos(t0)*r,z0=w.z+Math.sin(t0)*r,x1=w.x+Math.cos(t1)*r,z1=w.z+Math.sin(t1)*r;recWSeg(x0,w.y,z0,x1,w.y,z1,w.color,.30*a,5*a+1);recWSeg(x0,w.y,z0,x1,w.y,z1,'#ffffff',.85*a,.9)}continue}
    const q=project(w.x,w.y,w.z,viewYaw,viewPitch);if(!q)continue;const r=w.size*q.f*ease;if(r<1)continue;
    recDisc(q,r,w.color,.32*a,true,3+7*a);recDisc(q,r,'#ffffff',.9*a,true,1+a)}
}
function recordVectorEcho(e,viewYaw,viewPitch){
  if(!e.trail||e.trail.length<2||(e.marked<=0&&e.designated<=0))return;const des=e.designated>0;
  for(let i=1;i<e.trail.length;i++){const a=e.trail[i-1],b=e.trail[i],pa=project(a.x,a.y??2.7,a.z,viewYaw,viewPitch),pb=project(b.x,b.y??2.7,b.z,viewYaw,viewPitch);if(!pa||!pb)continue;const life=clamp(Math.min(a.life,b.life)/.65,0,1);recSeg(pa,pb,des?'#67ffd1':'#ff7466',.10+.24*life,1,false,[4,6],des?8:4)}
}
function recordGroundRush(viewYaw,viewPitch){
  const speed=Math.hypot(player.vx,player.vz);if(speed<9)return;const mag=clamp((speed-8)/48,0,1),vl=speed||1,ux=player.vx/vl,uz=player.vz/vl,len=2.5+mag*8.5,gx0=Math.floor((player.x-62)/8)*8,gz0=Math.floor((player.z-62)/8)*8;
  for(let gx=gx0;gx<=player.x+62;gx+=8)for(let gz=gz0;gz<=player.z+62;gz+=8){if(hash(gx*.17+gz*.31)<.58)continue;const dist=Math.hypot(gx-player.x,gz-player.z);if(dist<5||dist>66)continue;recWSeg(gx,.06,gz,gx-ux*len,.06,gz-uz*len,'103,255,209',(1-dist/72)*(.08+.34*mag),.7+1.1*mag,false)}
}
function drawBolts(viewYaw,viewPitch){
  if(worldRec){recordBolts(viewYaw,viewPitch);return}
  ctx.save();ctx.lineCap='round';ctx.globalCompositeOperation='lighter';ctx.shadowBlur=0;
  // Player 30mm: amber tracer, cyan when SIGHT LINKed. Three passes = neon tube (halo, body, white-hot core).
  for(const b of playerBolts){const a=project(b.px,b.py,b.pz,viewYaw,viewPitch),p=project(b.x,b.y,b.z,viewYaw,viewPitch);if(!a||!p)continue;
    const tail=clamp(34/p.depth*24,10,58),dx=p.x-a.x,dy=p.y-a.y,len=Math.hypot(dx,dy)||1,tx=p.x-dx/len*tail,ty=p.y-dy/len*tail,linked=!!b.syncId,col=linked?'#67ffd1':'#ffb347',w=clamp((linked?14:12)/p.depth*18,2.6,linked?8:7.5);
    ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(p.x,p.y);
    ctx.globalAlpha=.18;ctx.strokeStyle=col;ctx.lineWidth=w*2.3;ctx.stroke();
    ctx.globalAlpha=.85;ctx.lineWidth=w;ctx.stroke();
    ctx.globalAlpha=1;ctx.strokeStyle=linked?'#e6fff7':'#fff6dc';ctx.lineWidth=Math.max(1.2,w*.36);ctx.stroke();
    ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(p.x,p.y,clamp((linked?8:7)/p.depth*18,1.6,6),0,TAU);ctx.fill()}
  // Hostile shots: hot red/orange orbs with a short wake; readable as danger against cyan architecture.
  for(const b of enemyBolts){const a=project(b.px,b.py,b.pz,viewYaw,viewPitch),p=project(b.x,b.y,b.z,viewYaw,viewPitch);if(!a||!p)continue;
    const heavy=b.heavy,col=b.big?'#ff3a4a':heavy?'#ff8a4a':'#ff4b3a',r=clamp((b.big?.9:heavy?.55:.38)*p.f,2.2,b.big?34:heavy?26:18),dx=p.x-a.x,dy=p.y-a.y;
    ctx.beginPath();ctx.moveTo(p.x-dx*3,p.y-dy*3);ctx.lineTo(p.x,p.y);ctx.globalAlpha=.35;ctx.strokeStyle=col;ctx.lineWidth=r*1.3;ctx.stroke();ctx.globalAlpha=.9;ctx.lineWidth=r*.45;ctx.strokeStyle='#ffb09a';ctx.stroke();
    ctx.globalAlpha=.22;ctx.fillStyle=col;ctx.beginPath();ctx.arc(p.x,p.y,r*1.9,0,TAU);ctx.fill();
    ctx.globalAlpha=.95;ctx.beginPath();ctx.arc(p.x,p.y,r*.75,0,TAU);ctx.fill();ctx.fillStyle='#fff1ea';ctx.beginPath();ctx.arc(p.x,p.y,r*.36,0,TAU);ctx.fill()}
  // Missiles: amber exhaust ribbon from real flight history + flare head.
  for(const m of missiles){const pts=m.hist.map(h=>project(h.x,h.y,h.z,viewYaw,viewPitch));pts.push(project(m.x,m.y,m.z,viewYaw,viewPitch));
    for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];if(!a||!b)continue;const k=i/pts.length;ctx.globalAlpha=.55*k;ctx.strokeStyle=k>.8?'#fff2c4':'#ffc75a';ctx.lineWidth=clamp(.32*b.f,1,9)*(.4+.6*k);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
    const p=pts[pts.length-1];if(!p)continue;const r=clamp(16/p.depth*9,2,8);ctx.globalAlpha=.3;ctx.fillStyle='#ffd56b';ctx.beginPath();ctx.arc(p.x,p.y,r*2.6,0,TAU);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle='#fffbe8';ctx.beginPath();ctx.arc(p.x,p.y,r,0,TAU);ctx.fill()}
  // MAUL rockets: a fat flame trail and a white-hot motor.
  for(const m of rockets){const pts=m.hist.map(h=>project(h.x,h.y,h.z,viewYaw,viewPitch));pts.push(project(m.x,m.y,m.z,viewYaw,viewPitch));ctx.beginPath();
    for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];if(!a||!b)continue;const k=i/pts.length;ctx.globalAlpha=.6*k;ctx.strokeStyle=k>.75?'#fff2cf':'#ff9a4a';ctx.lineWidth=clamp(.5*b.f,1.5,14)*(.35+.65*k);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
    const p=pts[pts.length-1];if(!p)continue;const r=clamp(24/p.depth*9,2.5,12);ctx.globalAlpha=.35;ctx.fillStyle='#ffb35c';ctx.beginPath();ctx.arc(p.x,p.y,r*2.8,0,TAU);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle='#fffbe8';ctx.beginPath();ctx.arc(p.x,p.y,r,0,TAU);ctx.fill()}
  ctx.restore()
}
// Particles are additive ('lighter'), so draw order does not matter: strokes are grouped by colour,
// alpha (1/16 steps) and width (1/4 px steps) and each group is stroked once. Was one stroke each.
function drawParticles(viewYaw,viewPitch){
  if(worldRec){recordParticles(viewYaw,viewPitch);return}
  const G=new Map(),Q=new Map(),seg=(col,a,w,x0,y0,x1,y1)=>{if(a<=.004)return;a=Math.round(a*16)/16;w=Math.round(w*4)/4;const k=col+'|'+a+'|'+w;let L=G.get(k);if(!L)G.set(k,L={col,a,w,s:[]});L.s.push(x0,y0,x1,y1)};
  ctx.save();ctx.lineCap='round';ctx.globalCompositeOperation='lighter';ctx.shadowBlur=0;
  for(const p of particles){const q=project(p.x,p.y,p.z,viewYaw,viewPitch);if(!q)continue;const a=clamp(p.life/(p.max||1),0,1);
    if(p.kind==='mote'){
      // Tails are velocity-based (fixed 25 ms of travel) so streak length does not depend on frame rate.
      const homing=p.age>p.home,tail=project(p.x-p.vx*.025,p.y-p.vy*.025,p.z-p.vz*.025,viewYaw,viewPitch),r=clamp(.085*q.f,1.1,3.4),ma=Math.min(1,a*2.4);
      if(tail&&Math.abs(tail.x-q.x)+Math.abs(tail.y-q.y)<140)seg(homing?'#7dffdc':p.color,ma,r,tail.x,tail.y,q.x,q.y);else seg(homing?'#7dffdc':p.color,ma,r,q.x-.6,q.y,q.x,q.y);
      const qa=Math.round(ma*16)/16;if(qa>0){let R=Q.get(qa);if(!R)Q.set(qa,R=[]);R.push(q.x-r*.4,q.y-r*.4,r*.8)}continue}
    if(p.ring){ctx.globalAlpha=a;ctx.strokeStyle=p.color;ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(q.x,q.y,p.size*q.f*(1-a*.4),0,TAU);ctx.stroke();continue}
    const tail=project(p.x-p.vx*.04,p.y-p.vy*.04,p.z-p.vz*.04,viewYaw,viewPitch),s=clamp(p.size*q.f*.42,1,14),w=clamp(s*.42,.9,3.6);
    let x0,y0,x1,y1;if(tail&&Math.abs(tail.x-q.x)+Math.abs(tail.y-q.y)<220&&Math.abs(tail.x-q.x)+Math.abs(tail.y-q.y)>s*.5){x0=tail.x;y0=tail.y;x1=q.x;y1=q.y}else{x0=q.x-s*.7;y0=q.y+s*.3;x1=q.x+s*.7;y1=q.y-s*.3}
    seg(p.color,a,w,x0,y0,x1,y1);if(p.hot&&a>.45)seg(p.hot,a,w*.42,x0,y0,x1,y1);
  }
  for(const L of G.values()){ctx.globalAlpha=L.a;ctx.strokeStyle=L.col;ctx.lineWidth=L.w;ctx.beginPath();const v=L.s;for(let i=0;i<v.length;i+=4){ctx.moveTo(v[i],v[i+1]);ctx.lineTo(v[i+2],v[i+3])}ctx.stroke()}
  ctx.fillStyle='#f2fffb';for(const [qa,R] of Q){ctx.globalAlpha=qa;ctx.beginPath();for(let i=0;i<R.length;i+=3)ctx.rect(R[i],R[i+1],R[i+2],R[i+2]);ctx.fill()}
  ctx.restore()
}
function drawShards(viewYaw,viewPitch){
  if(worldRec){recordShards(viewYaw,viewPitch);return}
  if(!shards.length)return;ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';ctx.shadowBlur=0;
  for(const s of shards){
    const e=shardEnds(s),q=projectSegment(e[0],e[1],e[2],e[3],e[4],e[5],viewYaw,viewPitch);if(!q||!q[0]||!q[1])continue;
    const k=s.age/s.life,hot=clamp(1-s.age/.14,0,1),fade=1-clamp((k-.6)/.4,0,1)*.65,len=Math.hypot(q[1].x-q[0].x,q[1].y-q[0].y),w=s.width*clamp(q[0].f/36,.5,2.2);
    // Burn-down: the last half of a shard's life breaks it into an increasingly sparse dotted line.
    if(k>.45){const g=(k-.45)/.55;ctx.setLineDash([Math.max(.8,len*.2*(1-g)+.8),len*.06+g*len*.3+1])}else ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(q[0].x,q[0].y);ctx.lineTo(q[1].x,q[1].y);
    ctx.globalAlpha=.26*fade;ctx.strokeStyle=s.color;ctx.lineWidth=w*3.4;ctx.stroke();
    ctx.globalAlpha=.95*fade;ctx.strokeStyle=hot>0?'#fff6ea':s.color;ctx.lineWidth=w;ctx.stroke();
    ctx.globalAlpha=(.55+.45*hot)*fade;ctx.strokeStyle='#ffffff';ctx.lineWidth=Math.max(.6,w*.34);ctx.stroke();
  }
  ctx.setLineDash([]);ctx.restore();
}
function drawDebris(viewYaw,viewPitch){
  if(!debris.length||threeWorldFrame)return;const list=debris.map(d=>({d,dist:Math.hypot(d.c[0]-player.x,d.c[2]-player.z)})).sort((a,b)=>b.dist-a.dist);
  for(const {d} of list){const k=d.age/d.life,hot=Math.max(0,1-d.age/.22)*.9;
    renderMeshInstances([{P:d.P,wv:debrisVerts(d),R:M3.mul(d.D,d.R0),hot,glowK:1-k}],viewYaw,viewPitch,{style:CLASS_STYLE[d.type],alpha:1-k*.3,silW:1.5,crW:.8,halo:.12+.4*(1-k),detail:false,creases:true,glow:{}})}
}
function drawWaves(viewYaw,viewPitch){
  if(worldRec){recordWaves(viewYaw,viewPitch);return}
  if(!waves.length)return;ctx.save();ctx.globalCompositeOperation='lighter';ctx.shadowBlur=0;
  for(const w of waves){const a=clamp(w.life/w.max,0,1),k=1-a,ease=1-Math.pow(1-k,3);
    if(w.kind==='light'){const q=project(w.x,w.y,w.z,viewYaw,viewPitch);if(!q)continue;const r=Math.min(Math.max(W,H),w.size*q.f*(.55+.6*k));if(r<3)continue;
      const g=ctx.createRadialGradient(q.x,q.y,0,q.x,q.y,r);g.addColorStop(0,rgba(w.color,.62*a));g.addColorStop(.28,rgba(w.color,.22*a));g.addColorStop(1,rgba(w.color,0));ctx.globalAlpha=1;ctx.fillStyle=g;ctx.fillRect(q.x-r,q.y-r,r*2,r*2);continue}
    if(w.kind==='ground'){const r=Math.max(.3,w.size*ease);let started=false;ctx.beginPath();for(let i=0;i<=48;i++){const t=i/48*TAU,p=project(w.x+Math.cos(t)*r,w.y,w.z+Math.sin(t)*r,viewYaw,viewPitch);if(!p){started=false;continue}if(!started){ctx.moveTo(p.x,p.y);started=true}else ctx.lineTo(p.x,p.y)}
      ctx.globalAlpha=.30*a;ctx.strokeStyle=w.color;ctx.lineWidth=5*a+1;ctx.stroke();ctx.globalAlpha=.85*a;ctx.strokeStyle='#ffffff';ctx.lineWidth=.9;ctx.stroke();continue}
    const q=project(w.x,w.y,w.z,viewYaw,viewPitch);if(!q)continue;const r=w.size*q.f*ease;if(r<1)continue;
    ctx.globalAlpha=.32*a;ctx.strokeStyle=w.color;ctx.lineWidth=3+7*a;ctx.beginPath();ctx.arc(q.x,q.y,r,0,TAU);ctx.stroke();
    ctx.globalAlpha=.9*a;ctx.strokeStyle='#ffffff';ctx.lineWidth=1+a;ctx.stroke();
  }
  ctx.restore();
}
function drawVectorEcho(e,viewYaw,viewPitch){
  if(worldRec){recordVectorEcho(e,viewYaw,viewPitch);return}
  if(!e.trail||e.trail.length<2||(e.marked<=0&&e.designated<=0))return;
  ctx.save();ctx.setLineDash([4,6]);ctx.lineCap='round';ctx.shadowBlur=e.designated>0?8:4;ctx.shadowColor=e.designated>0?'#55ffd0':'#ff6359';
  for(let i=1;i<e.trail.length;i++){const a=e.trail[i-1],b=e.trail[i],pa=project(a.x,a.y??2.7,a.z,viewYaw,viewPitch),pb=project(b.x,b.y??2.7,b.z,viewYaw,viewPitch);if(!pa||!pb)continue;const life=clamp(Math.min(a.life,b.life)/.65,0,1);ctx.globalAlpha=.10+.24*life;ctx.strokeStyle=e.designated>0?'#67ffd1':'#ff7466';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);ctx.stroke()}
  ctx.setLineDash([]);ctx.globalAlpha=1;ctx.restore();
}
function threatMetric(b){const rx=b.x-player.x,rz=b.z-player.z,rvx=b.vx-player.vx,rvz=b.vz-player.vz,v2=rvx*rvx+rvz*rvz||1,t=clamp(-(rx*rvx+rz*rvz)/v2,0,.78),cx=rx+rvx*t,cz=rz+rvz*t;return{t,d:Math.hypot(cx,cz)}}
function drawThreatLanes(viewYaw,viewPitch){
  ctx.save();ctx.setLineDash([6,7]);for(const b of enemyBolts){const q=threatMetric(b);if(q.t<=.03||q.d>5.8||b.life<q.t||segmentHitsWorld(b.x,b.y,b.z,b.x+b.vx*q.t,b.y+b.vy*q.t,b.z+b.vz*q.t))continue;const a=project(b.x,b.y,b.z,viewYaw,viewPitch),p=project(b.x+b.vx*q.t,b.y+b.vy*q.t,b.z+b.vz*q.t,viewYaw,viewPitch);if(!a||!p)continue;const danger=1-clamp(q.d/5.8,0,1);ctx.globalAlpha=.18+.34*danger;ctx.strokeStyle=b.heavy?'#ffb06a':'#ff7466';ctx.shadowBlur=8+8*danger;ctx.shadowColor='#ff6359';ctx.lineWidth=1+danger;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.globalAlpha=.35+.45*danger;ctx.fillStyle='#ff927b';ctx.beginPath();ctx.arc(p.x,p.y,3+4*danger,0,TAU);ctx.stroke()};ctx.setLineDash([]);ctx.globalAlpha=1;ctx.restore();
}
function drawGroundRush(viewYaw,viewPitch){
  if(worldRec){recordGroundRush(viewYaw,viewPitch);return}
  const speed=Math.hypot(player.vx,player.vz);if(speed<9)return;const mag=clamp((speed-8)/48,0,1),vl=Math.hypot(player.vx,player.vz)||1,ux=player.vx/vl,uz=player.vz/vl,len=2.5+mag*8.5;
  ctx.save();ctx.lineCap='round';const gx0=Math.floor((player.x-62)/8)*8,gz0=Math.floor((player.z-62)/8)*8;
  for(let gx=gx0;gx<=player.x+62;gx+=8)for(let gz=gz0;gz<=player.z+62;gz+=8){if(hash(gx*.17+gz*.31)<.58)continue;const dx=gx-player.x,dz=gz-player.z,dist=Math.hypot(dx,dz);if(dist<5||dist>66)continue;const a=project(gx,.06,gz,viewYaw,viewPitch),b=project(gx-ux*len,.06,gz-uz*len,viewYaw,viewPitch);if(!a||!b)continue;const alpha=(1-dist/72)*(.08+.34*mag);ctx.strokeStyle=`rgba(103,255,209,${alpha})`;ctx.lineWidth=.7+1.1*mag;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
  ctx.restore()
}
function drawSpeedFX(speed){if(player.boostTime<=0&&speed<22&&player.syncTime<=0)return;const k=clamp((speed-15)/25+(player.boostTime>0?.7:0)+(player.syncTime>0?.22:0),0,1);ctx.save();ctx.globalAlpha=.12+.22*k;ctx.strokeStyle='#e8f2ee';ctx.lineWidth=1;for(let i=0;i<34;i++){const a=i*2.399+gameTime*.2,r0=Math.min(W,H)*(.14+hash(i)*.28),len=(15+hash(i+9)*70)*k,cx=W/2+Math.cos(a)*r0,cy=H/2+Math.sin(a)*r0*.62;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a)*len,cy+Math.sin(a)*len*.62);ctx.stroke()}ctx.restore()}
// ---------- COCKPIT (v32) ---------------------------------------------------------
// AOGANE's pilot capsule sits in the chassis; the HMD head unit turns inside it.
// Everything here is real geometry in the chassis frame (x right, y up, z forward, metres
// from the eye) rendered with the same face+line renderer as the hostiles, so a head turn
// produces genuine parallax: near struts slide past far ones, the head pivots on a neck.
// Instruments are parts of the machine:
//   30mm arm (right)   — follows the MOUSE gimbal; recoil, barrel heat, vent louvers + steam
//   missile pod (left) — slews with the HEAD / HMD; loaded cells glow amber
//   boost tubes        — liquid-light level = BOOST; flash white on BURST
//   integrity lamps    — top beam, one per 10% frame; red flicker when hit, dark when lost
//   SYNC core          — dash rotor: spins with FLOW, turns gold in SYNC DRIVE
//   radar scope        — tilted CRT on the left console
//   canopy rim         — lights red toward threats; glass cracks toward hits
const CP_STYLE={edge:'#46d2ae',core:'#c8fff0',accent:'#ffd16f',glow:'#8fffe0',armor:[13,25,26],dark:[4,9,10],metal:[19,29,31]};
const GUN_STYLE={edge:'#ffb347',core:'#fff0c8',accent:'#ffd16f',glow:'#ffcf7a',armor:[34,25,13],dark:[11,8,4],metal:[28,24,18]};
// Weapons are drawn like characters, not instruments: flat two-tone cel fill, heavy ink contour, ink creases
// and a thin role-coloured trace (amber = mouse gun, cyan = head pod). [lit, shadow] per material.
// The guns follow the key art (AOI beside her frame): a gunmetal body, steel parts, blue light, so they
// belong to the white / black / blue arm that holds them. The amber trace still says "mouse".
GUN_STYLE.toon={tone:true,ink:'#05070a',trace:'#ffc75a',armor:[[104,110,122],[40,43,52]],dark:[[54,57,66],[20,21,26]],metal:[[170,176,186],[76,80,92]],accent:[[120,170,255],[44,76,170]]};
const POD_STYLE={...CP_STYLE,toon:{tone:true,ink:'#040a09',trace:'#8fffe0',armor:[[190,232,218],[78,118,108]],dark:[[108,140,132],[40,58,54]],metal:[[160,190,182],[70,92,88]],accent:[[150,255,226],[60,130,110]]}};
// The capsule itself: darker slate cel than the world so it frames the view, teal trace on the big members.
CP_STYLE.toon={ink:'#050807',trace:'#46d2ae',tone:true,armor:[[158,174,166],[78,92,88]],dark:[[74,84,82],[36,42,42]],metal:[[186,192,184],[96,104,100]],accent:[[236,196,84],[140,104,30]]};
// The frame's own forearm (concept sheet: white armour, black joints, blue light) holding HALBERD.
const ARM_STYLE={...CP_STYLE,glow:'#6fa8ff',core:'#d8e6ff',toon:{tone:true,ink:'#05070a',trace:'#4f8cff',armor:[[222,226,230],[118,124,134]],dark:[[58,62,70],[22,24,30]],metal:[[150,156,166],[70,74,84]],accent:[[120,170,255],[44,76,170]]}};
// Hydraulic cylinders on the arm are brass, as on the concept sheet.
const ARM_BRASS={...ARM_STYLE,toon:{...ARM_STYLE.toon,metal:[[220,178,104],[112,80,36]],trace:'#ffc75a'}};
// Wear: the arm's white armour dulls under 66% and is scorched under 33% (brass darkens with it).
const ARM_WORN={...ARM_STYLE,toon:{...ARM_STYLE.toon,armor:[[184,182,180],[92,92,98]],metal:[[128,128,134],[60,60,66]]}};
const ARM_SCORCH={...ARM_STYLE,toon:{...ARM_STYLE.toon,armor:[[132,124,118],[58,52,52]],metal:[[96,92,92],[44,40,42]],trace:'#ff6a3a'}};
const BRASS_WORN={...ARM_BRASS,toon:{...ARM_BRASS.toon,metal:[[176,140,84],[86,62,30]]}},BRASS_SCORCH={...ARM_BRASS,toon:{...ARM_BRASS.toon,metal:[[120,92,58],[54,40,24]]}};
function wornStyle(st){const w=armWear();if(!w)return st;if(st===ARM_STYLE)return w===1?ARM_WORN:ARM_SCORCH;if(st===ARM_BRASS)return w===1?BRASS_WORN:BRASS_SCORCH;return st}
for(const S of [CP_STYLE,GUN_STYLE,POD_STYLE,ARM_STYLE,ARM_BRASS,ARM_WORN,ARM_SCORCH,BRASS_WORN,BRASS_SCORCH]){S.armorRGB=S.armor;S.darkRGB=S.dark;S.metalRGB=S.metal;S.accentRGB=hexRGB(S.accent).map(v=>v*.42)}
const COCKPIT=(()=>{
  const P=[],B=(bone,p,style=CP_STYLE)=>{p.bone=bone;p.style=style;P.push(p);return p};
  // Canopy: asymmetric — the gun side sill is cut low so the 30mm arm stays in view.
  B('frame',hexa([[-1.0,-.95,.52],[.42,-.95,.52],[.5,-.95,1.08],[-1.32,-.95,1.08],[-1.0,-.31,.52],[.42,-.31,.52],[.5,-.235,1.08],[-1.32,-.235,1.08]],{lines:3,lineArea:.3,name:'dash'}));
  B('frame',hexa([[.42,-.95,.52],[1.05,-.95,.52],[1.35,-.95,1.08],[.5,-.95,1.08],[.42,-.45,.52],[1.05,-.45,.52],[1.35,-.42,1.08],[.5,-.36,1.08]],{lines:2,name:'sill'}));
  for(const s of [-1,1]){
    B('frame',beam([s*.66,-.25,1.07],[s*.43,.27,1.01],.135,.11,{lines:1,lineArea:.01,name:'pillar'},[0,0,1]));
    B('frame',beam([s*.72,-.3,.98],[s*.48,.32,.93],.06,.05,{mat:'dark'},[0,0,1]));
    for(let k=0;k<5;k++){const t=.12+k*.19;B('frame',box(lerp(s*.6,s*.41,t),lerp(-.22,.25,t),lerp(1.005,.955,t),.014,.014,.006,{mat:'dark'}))}
    B('frame',beam([s*1.45,-.55,.3],[s*1.08,.42,.42],.12,.1,{name:'bpillar'},[0,0,1]));
    B('frame',cyl(s*.98,-.36,.78,.028,.55,'z',6,{mat:'dark',name:'cable'}));B('frame',cyl(s*1.03,-.37,.76,.02,.5,'z',6,{mat:'accent'}));
    B('frame',beam([s*.46,.33,.97],[s*1.1,.44,.42],.06,.06,{mat:'dark'},[0,1,0]));
    B('frame',cyl(s*.585,-.13,1.04,.016,.2,'y',8,{mat:'metal',name:'tube'}));
    B('frame',beam([s*.88,-.5,.8],[s*.6,-.25,1.0],.05,.04,{mat:'metal',name:'piston'},[0,0,1]));
  }
  B('frame',hexa([[-.48,.255,.93],[.48,.255,.93],[.44,.255,1.02],[-.44,.255,1.02],[-.5,.5,.9],[.5,.5,.9],[.46,.48,1.0],[-.46,.48,1.0]],{name:'beam'}));
  B('frame',box(0,.25,.95,.07,.02,.035,{mat:'dark'}));
  B('frame',box(0,.237,.905,.98,.042,.03,{mat:'metal',name:'beamLip'}));
  for(const x of [-.3,-.1,.1,.3])B('frame',box(x,.38,.895,.12,.035,.01,{mat:'dark'}));
  // Dash lip with hazard stripes, centre console, grab handle on the gun-side pillar.
  B('frame',box(-.42,-.218,1.05,1.74,.032,.07,{mat:'metal',name:'lip'}));
  B('frame',hexa([[-.12,-.42,.62],[.22,-.42,.62],[.24,-.42,.86],[-.14,-.42,.86],[-.1,-.3,.64],[.2,-.3,.64],[.22,-.27,.84],[-.12,-.27,.84]],{lines:2,lineArea:.01,name:'console'}));
  for(let k=0;k<3;k++)B('frame',box(-.06+k*.1,-.268,.8,.05,.012,.035,{mat:'accent'}));
  B('frame',beam([.53,-.06,.99],[.47,.13,.965],.03,.03,{mat:'metal',name:'grip'},[0,0,1]));
  B('frame',hexa([[-.6,-.31,.8],[-.32,-.31,.8],[-.32,-.24,.96],[-.6,-.24,.96],[-.6,-.2,.84],[-.32,-.2,.84],[-.32,-.175,.95],[-.6,-.175,.95]],{name:'scopeHood'}));
  // 30mm gun arm: mount arm on the chassis, gimbal head, receiver, shroud, barrel, brake, louvers, feed.
  // Hand on the fore-grip under the receiver; the gauntlet runs out of frame toward the lower right.
  // Hand (concept sheet): black glove frame, white armoured back with a blue line, a steel knuckle
  // guard, four two-joint fingers curled up around the shroud and a thumb laid along it.
  B('gun',box(.03,-.2,1.1,.15,.13,.24,{mat:'dark',name:'fist'}),ARM_STYLE);
  B('gun',hexa([[.1,-.31,.97],[.18,-.31,.97],[.18,-.31,1.25],[.1,-.31,1.25],[.1,-.07,.99],[.17,-.09,.99],[.17,-.09,1.23],[.1,-.07,1.23]],{lines:1,lineArea:.01,name:'handback'}),ARM_STYLE);
  B('gun',box(.183,-.2,1.11,.008,.022,.2,{mat:'glow',glow:'hmd'}),ARM_STYLE);
  B('gun',box(.06,-.075,1.11,.13,.04,.27,{mat:'metal',name:'knuckle'}),ARM_STYLE);
  for(let k=0;k<4;k++){const z=1.0+k*.074;B('gun',box(-.045,-.255,z,.08,.055,.058,{mat:'dark'}),ARM_STYLE);B('gun',box(-.105,-.19,z,.05,.085,.056,{mat:'armor'}),ARM_STYLE);B('gun',box(-.13,-.12,z+.004,.035,.06,.05,{mat:'dark'}),ARM_STYLE)}
  B('gun',beam([.07,-.13,.96],[-.02,-.07,1.0],.06,.05,{mat:'dark',name:'thumb'},[1,0,0]),ARM_STYLE);
  // The forearm and upper arm are not rigid on the gun: see armIK() — shoulder fixed on the chassis,
  // wrist on the grip, elbow solved every frame, so aiming bends the arm instead of swinging it.
  // HALBERD 30mm: chunky receiver with a top sight block, side feed drum and a fat heat shroud —
  // a silhouette that reads at a glance, like a character's weapon.
  B('gun',cyl(0,0,0,.12,.22,'x',8,{mat:'dark'}),GUN_STYLE);
  B('gun',hexa([[-.14,-.13,-.24],[.14,-.13,-.24],[.14,-.13,.52],[-.14,-.13,.52],[-.12,.11,-.21],[.12,.11,-.21],[.1,.095,.48],[-.1,.095,.48]],{lines:2,lineArea:.03,name:'receiver'}),GUN_STYLE);
  B('gun',box(0,.15,.1,.09,.07,.26,{mat:'metal',name:'sight'}),GUN_STYLE);
  B('gun',box(0,.2,.2,.05,.035,.05,{mat:'accent'}),GUN_STYLE);
  B('gun',beam([-.15,-.13,-.16],[-.27,-.4,-.5],.08,.06,{mat:'metal',name:'grip'},[1,0,0]),GUN_STYLE);
  B('louverL',box(-.065,0,0,.12,.014,.34,{mat:'armor'}),GUN_STYLE);B('louverR',box(.065,0,0,.12,.014,.34,{mat:'armor'}),GUN_STYLE);
  B('barrel',cyl(0,0,1.0,.115,.95,'z',8,{mat:'armor',name:'shroud',lines:1,lineArea:.01}),GUN_STYLE);
  for(const z of [.6,1.4])B('barrel',cyl(0,0,z,.122,.05,'z',8,{mat:'dark'}),GUN_STYLE);
  B('barrel',cyl(0,0,1.65,.058,2.2,'z',8,{mat:'metal',name:'barrel'}),GUN_STYLE);
  B('barrel',box(0,0,2.82,.22,.2,.26,{mat:'dark',name:'brake'}),GUN_STYLE);
  B('barrel',box(0,0,2.82,.24,.03,.08,{mat:'armor'}),GUN_STYLE);
  for(const q of P)if(q.style===GUN_STYLE)q.weapon='HALBERD';
  // ARBALEST: a long slim barrel with a fluted shroud, a big top scope, a box magazine and a heavy brake.
  {const A=(bone,q)=>{B(bone,q,GUN_STYLE).weapon='ARBALEST'};
    A('gun',hexa([[-.11,-.12,-.3],[.11,-.12,-.3],[.11,-.12,.7],[-.11,-.12,.7],[-.1,.09,-.28],[.1,.09,-.28],[.09,.08,.68],[-.09,.08,.68]],{lines:2,lineArea:.03,name:'receiver'}));
    A('gun',cyl(0,.0,1.45,.075,1.6,'z',8,{mat:'armor',name:'shroud',lines:1,lineArea:.01}));
    A('gun',cyl(0,.0,2.9,.045,1.4,'z',8,{mat:'metal',name:'barrel'}));
    A('gun',box(0,0,3.62,.16,.13,.22,{mat:'dark',name:'brake'}));A('gun',box(0,0,3.62,.18,.03,.06,{mat:'accent'}));
    A('gun',cyl(0,.24,.35,.085,.95,'z',10,{mat:'dark',name:'scope'}));A('gun',cyl(0,.24,.84,.1,.08,'z',10,{mat:'metal'}));A('gun',cyl(0,.24,-.13,.095,.07,'z',10,{mat:'metal'}));
    A('gun',cyl(0,.24,.89,.06,.02,'z',10,{mat:'glow',glow:'hmd'}));
    for(const z of [.1,.55])A('gun',box(0,.14,z,.05,.1,.06,{mat:'metal'}));
    A('gun',box(0,-.26,.32,.1,.26,.2,{mat:'dark',name:'mag'}));
    A('gun',beam([-.12,-.12,-.18],[-.24,-.4,-.48],.08,.06,{mat:'metal',name:'grip'},[1,0,0]));
    A('gun',box(.13,.02,.18,.06,.05,.16,{mat:'accent',name:'bolt'}))}
  // MAUL rocket launcher: one fat tube over the same fist, flared muzzle, rear venturi, side optic.
  // Held on the gun bone so the arm IK, raise / drop acting and aim gimbal all carry over.
  {const M=(bone,q)=>{B(bone,q,GUN_STYLE).weapon='MAUL'};
    M('gun',cyl(0,.1,1.7,.165,2.7,'z',10,{mat:'armor',name:'tube',lines:1,lineArea:.01}));
    for(const z of [.75,2.2])M('gun',cyl(0,.1,z,.178,.07,'z',10,{mat:'dark'}));
    M('gun',cyl(0,.1,3.08,.215,.16,'z',10,{mat:'dark',name:'bell'}));
    M('gun',cyl(0,.1,3.14,.09,.06,'z',8,{mat:'accent'}));
    M('gun',cyl(0,.1,.32,.2,.16,'z',10,{mat:'dark',name:'venturi'}));
    M('gun',box(-.21,.22,1.2,.1,.13,.32,{mat:'metal',name:'optic'}));M('gun',box(-.21,.23,1.38,.07,.07,.02,{mat:'accent'}));
    M('gun',box(0,-.1,.62,.08,.09,.14,{mat:'dark'}));
    M('gun',beam([0,-.08,.58],[0,-.32,.48],.07,.05,{mat:'metal',name:'grip'},[1,0,0]));
    M('gun',hexa([[.16,.0,.8],[.21,.0,.8],[.21,.0,1.7],[.16,.0,1.7],[.16,.2,.85],[.2,.2,.85],[.2,.2,1.65],[.16,.2,1.65]],{mat:'armor',name:'plate'}))}
  // FLAIL: a short, fat over-and-under scatter cannon: a boxy receiver, two wide barrels, a pump fore-end
  // the fist rides on, a flared choke, a shell tube under the barrels and a blue light on the side.
  {const A=(bone,q)=>{B(bone,q,GUN_STYLE).weapon='FLAIL'};
    A('gun',hexa([[-.15,-.15,-.26],[.15,-.15,-.26],[.15,-.15,.5],[-.15,-.15,.5],[-.13,.13,-.23],[.13,.13,-.23],[.12,.12,.46],[-.12,.12,.46]],{lines:2,lineArea:.03,name:'receiver'}));
    for(const y of [.05,-.09])A('gun',cyl(0,y,1.25,.085,1.5,'z',10,{mat:'armor',name:'barrel',lines:1,lineArea:.01}));
    A('gun',box(0,-.02,2.02,.22,.32,.16,{mat:'dark',name:'choke'}));A('gun',box(0,-.02,2.11,.24,.06,.04,{mat:'accent'}));
    A('gun',box(0,-.17,1.05,.2,.13,.62,{mat:'metal',name:'pump'}));for(const z of [.82,.95,1.08,1.21])A('gun',box(0,-.235,z,.21,.015,.05,{mat:'dark'}));
    A('gun',cyl(0,-.2,1.6,.05,.75,'z',8,{mat:'dark',name:'tube'}));
    A('gun',box(0,.17,.12,.06,.06,.3,{mat:'metal',name:'sight'}));A('gun',box(.155,.0,.15,.012,.03,.5,{mat:'glow',glow:'hmd'}));
    A('gun',beam([-.13,-.13,-.16],[-.25,-.4,-.48],.08,.06,{mat:'metal',name:'grip'},[1,0,0]))}
  // BARDICHE: a long dark haft through the same fist and a broad steel blade on the left (the cutting side
  // of a right-to-left swing), lying flat so the pilot sees its face; a blue light along the edge, a back
  // spike, a top spike and a pommel.
  {const A=(bone,q)=>{B(bone,q,GUN_STYLE).weapon='BARDICHE'};
    A('gun',cyl(.03,-.2,1.55,.055,2.9,'z',8,{mat:'dark',name:'haft'}));
    for(const z of [.45,1.95,2.35])A('gun',cyl(.03,-.2,z,.07,.06,'z',8,{mat:'metal'}));
    A('gun',box(.03,-.2,.08,.13,.13,.14,{mat:'metal',name:'pommel'}));
    A('gun',hexa([[-.95,-.23,2.0],[-.02,-.235,2.4],[-.02,-.235,3.0],[-.95,-.23,3.35],[-.95,-.17,2.0],[-.02,-.165,2.4],[-.02,-.165,3.0],[-.95,-.17,3.35]],{mat:'metal',name:'blade',lines:1,lineArea:.01}));
    A('gun',box(-.95,-.2,2.675,.03,.075,1.36,{mat:'glow',glow:'hmd'}));
    A('gun',box(-.1,-.2,2.7,.18,.11,.68,{mat:'dark',name:'socket'}));
    A('gun',hexa([[.06,-.225,2.55],[.38,-.215,2.66],[.38,-.215,2.74],[.06,-.225,2.85],[.06,-.175,2.55],[.38,-.185,2.66],[.38,-.185,2.74],[.06,-.175,2.85]],{mat:'armor',name:'spike'}));
    A('gun',cyl(.03,-.2,3.2,.032,.36,'z',6,{mat:'metal'}))}
  return P;
})();
const CP_BONES=[['frame',null,[0,0,0]],['gun','frame',[.86,-.35,1.25]],['louverL','gun',[-.05,.09,.12]],['louverR','gun',[.05,.09,.12]],['barrel','gun',[0,0,0]],['pod','frame',[-1.1,-.46,2.35]]];
function mixHex(a,b,t){const A=hexRGB(a),B=hexRGB(b);return'#'+A.map((v,i)=>Math.round(lerp(v,B[i],t)).toString(16).padStart(2,'0')).join('')}
let syncStyleCache={q:-1,s:null};
function syncStyle(){const q=Math.round(syncMix*16);if(syncStyleCache.q!==q){const t=q/16,s={...CP_STYLE,edge:mixHex(CP_STYLE.edge,'#ffc75a',t),core:mixHex(CP_STYLE.core,'#fff3d0',t),glow:mixHex(CP_STYLE.glow,'#ffd16f',t)};s.edgeRGB=null;syncStyleCache={q,s}}return syncStyleCache.s}
const cockpit={shown:'HALBERD',swapT:0,swapK:0,maulKick:0,heave:0,heaveV:0,stepRoll:0,ventK:0,raise:0,podKick:0,flashW:0,bob:0,jolt:0,joltX:0,joltY:0,podYaw:0,podPitch:0,coreSpin:0,cracks:[],rimHit:0,rimHitDir:0,muzzle:null,prevStep:0};
function cockpitPose(){
  const C=cockpit,speed=Math.hypot(player.vx,player.vz),boost=player.boostTime>0?1:0,h=headYaw*Math.PI/180;
  // Neck pivot: the eye sits 12 cm in front of the pivot, so turning the head translates it -> parallax.
  const neck=.12,eye=[Math.sin(h)*neck,0,(Math.cos(h)-1)*neck];
  const twist=clamp(player.yawVelocity*.035,-.03,.03),load=clamp(speed/62+boost*.4,0,1);
  const jx=C.jolt*C.joltX,jy=C.jolt*C.joltY;
  const road=player.jy<=0?Math.sin(gameTime*31)*Math.sin(gameTime*17.3)*.0012*clamp(speed/20,0,1.4):0,frame={p:[-eye[0]+jx*.03,-eye[1]+C.heave*.22+boost*.012+jy*.02+road,-eye[2]-boost*.02],r:[C.heave*.1+player.inertiaPitch*.4-boost*.01,twist,player.inertiaRoll*.3+jx*.02+C.stepRoll]};
  // Weapon acting: the arm swings up into view at sortie and drops when the frame is lost; venting tips the
  // receiver down and outboard (louvers open), each shot kicks the whole arm, not just the barrel.
  const vent=C.ventK,rs=Math.max(1-C.raise,C.swapK*.8),ease=rs*rs*(3-2*rs),kick=player.gunKick,mk=C.maulKick;
  const gun={p:[ease*.08,-ease*.55-vent*.025,-ease*.25-kick*.035-mk*.14],r:[player.pitch-vent*.1+kick*.025-ease*.55+mk*.09,player.torso,vent*.17+ease*.4]},barrel={p:[0,0,-.24*kick]};
  if(C.shown==='BARDICHE'){const k=axePose();for(let i=0;i<3;i++){gun.p[i]+=k[i];gun.r[i]+=k[3+i]}}
  C.podYaw=lerp(C.podYaw,clamp(h,-.75,.75),.12);const podKick=C.podKick;C.podPitch=lerp(C.podPitch,player.camPitch*.6,.1);
  const pod={p:[0,-ease*.3,-podKick*.09],r:[C.podPitch-ease*.4+podKick*.05,C.podYaw*.9,0]};
  return{frame,gun,barrel,pod,louverL:{r:[0,0,vent*.9+boost*.3]},louverR:{r:[0,0,-vent*.9-boost*.3]},load};
}
// BARDICHE acting, added to the gun bone (its origin is the fist): held raised and canted at rest. The
// swing is a person's diagonal chop: the fist comes up and in beside the helmet with the haft laid back over
// the right shoulder and the edge facing forward, then the cut comes over and down across the front to the
// lower left, the arm reaching out through the hit, and the recovery brings it back.
const AXE_REST=[.04,.02,0,.28,.12,.35],AXE_WIND=[-.62,.24,-.12,1.3,.3,.9],AXE_TOP=[-.66,.28,-.16,1.42,.34,.95],AXE_CUT=[-.45,-.08,.3,.12,-.4,.85],AXE_OVER=[-.85,-.5,.1,-.75,-.95,.8];
function axePose(){const S=player.swing,B=BARDICHE,mix=(a,b,t)=>a.map((v,i)=>lerp(v,b[i],t)),sm=u=>u*u*(3-2*u);if(!S)return AXE_REST;let t=S.t;
  if(t<B.wind)return mix(AXE_REST,AXE_WIND,sm(t/B.wind));t-=B.wind;
  if(t<B.hold)return mix(AXE_WIND,AXE_TOP,t/B.hold);t-=B.hold;
  // the cut starts slow and accelerates, and is in front at the bite (60% into the cut, see updateSwing):
  // the blade's weight, not a flick; then it carries on down to the left and slows
  const bite=B.cut*.6;if(t<bite){const u=t/bite;return mix(AXE_TOP,AXE_CUT,u*u*u*.6+u*u*.4)}t-=bite;
  const fol=B.cut-bite+B.over;if(t<fol){const u=t/fol;return mix(AXE_CUT,AXE_OVER,1-(1-u)*(1-u))}t-=fol;
  return mix(AXE_OVER,AXE_REST,sm(clamp(t/B.rec,0,1)))}
function cockpitXf(pz){
  const fwd=forward(player.yaw),rt=right(player.yaw),root={R:[rt.x,0,fwd.x,0,1,0,rt.z,0,fwd.z],t:[player.x,CAMERA_Y,player.z]},X={};
  for(const [n,parent,rest] of CP_BONES){const q=pz[n]||{},p=q.p||[0,0,0],r=q.r||[0,0,0];X[n]=xfMul(parent?X[parent]:root,{R:M3.rot(r[0],r[1],r[2]),t:[rest[0]+p[0],rest[1]+p[1],rest[2]+p[2]]})}
  return X;
}
function cockpitHit(dirWorld,dmg){
  const C=cockpit,rel=angleDiff(dirWorld,player.yaw);C.jolt=1;C.joltX=-Math.sin(rel);C.joltY=(Math.random()-.5)*2;C.rimHit=1;C.rimHitDir=rel;
  feedHit(dirWorld,dmg);
  visorFX.glitch=Math.max(visorFX.glitch,.2+clamp(dmg/40,0,.15));visorFX.glitchK=Math.max(visorFX.glitchK,clamp(dmg/10,.45,1.2)*(player.hp<30?1.3:1));
}
function updateCockpit(dt){
  const C=cockpit;{const up=playing&&player.alive;C.raise=up?Math.min(1,C.raise+dt/.55):playing?Math.max(0,C.raise-dt/.9):0}C.podKick=Math.max(0,C.podKick-dt*5);C.maulKick=Math.max(0,C.maulKick-dt*3.2);
  // Weapon swap: the arm drops, the weapon changes at the bottom of the arc, then it comes back up.
  if(C.swapT>0){C.swapT=Math.max(0,C.swapT-dt);if(C.swapT<=.25)C.shown=player.weapon;C.swapK=Math.sin(Math.PI*(1-C.swapT/.5))}else{C.swapK=0;C.shown=player.weapon}C.ventK+=((player.vent?1:0)-C.ventK)*(1-Math.exp(-dt*7));C.flashW=Math.max(0,C.flashW-dt*3.2);C.bob=Math.max(0,C.bob-dt*5);C.jolt=Math.max(0,C.jolt-dt*4.5);C.rimHit=Math.max(0,C.rimHit-dt*2.2);
  // Capsule weight: landings and nearby ATLAS steps drop it onto a damped spring and it settles.
  // Strength and stride spacing vary per step so the motion never reads as a beat (user rejected beat-sync).
  C.heaveV+=(-140*C.heave-15*C.heaveV)*dt;C.heave+=C.heaveV*dt;C.stepRoll*=Math.exp(-dt*5);
  C.coreSpin+=dt*(1.2+player.flow*.06+(player.syncTime>0?9:0));
}
// Threat bearings (relative to view) and their urgency, for the canopy rim.
function cockpitThreats(viewYaw){
  const out=[];
  for(const e of enemies){if(!e.alive||!e.awake)continue;const dx=e.x-player.x,dz=e.z-player.z,dist=Math.hypot(dx,dz),rel=angleDiff(Math.atan2(dx,-dz),viewYaw);
    let k=0;if(e.firePending||e.lungeWindup>0)k=1;else if(e.marked>0&&dist<60)k=.35;else if(dist<26)k=.45;if(k<=0)continue;out.push({rel,k:k*(Math.abs(rel)>.45?1:.5),charge:e.firePending||e.lungeWindup>0})}
  for(const b of enemyBolts){const q=threatMetric(b);if(q.t>.04&&q.t<.6&&q.d<4.2){const rel=angleDiff(Math.atan2(b.x-player.x,-(b.z-player.z)),viewYaw);out.push({rel,k:.9,charge:true})}}
  if(cockpit.rimHit>0)out.push({rel:angleDiff(player.yaw+cockpit.rimHitDir,viewYaw),k:cockpit.rimHit*1.4,hit:true});
  return out;
}
// Two-bone IK for the gun arm. Shoulder is fixed in the chassis frame, the wrist rides on HALBERD's
// fore-grip; the elbow is solved in the plane of a down-and-outboard pole, so aiming left / right /
// up / down bends the elbow and swings the forearm from it.
const ARM_IK={shoulder:[.55,-.55,.0],wrist:[.03,-.25,.97],L1:1.32,L2:1.32,pole:[.7,-1,-.15]};
// Arm armour in bone space: z runs along the bone (0 = shoulder / elbow end), +y is the bend side
// (down-outboard), -y the top the pilot sees. Layered like the concept sheet: black frame core, white
// plates stepped over it, grey side armour, brass hydraulics under the bone, blue light lines.
const ARM_PARTS=(()=>{const U=[],F=[],A=(L,p,st)=>{if(st)p.armStyle=st;L.push(p)},Lu=1.32,Lf=1.32;
  // upper arm
  A(U,hexa([[-.21,-.17,.12],[.21,-.17,.12],[.18,-.17,1.05],[-.18,-.17,1.05],[-.19,-.28,.16],[.19,-.28,.16],[.16,-.26,1.0],[-.16,-.26,1.0]],{lines:2,lineArea:.02,name:'upperPlate'}));
  for(const x of [-1,1])A(U,hexa([[x*.17,-.15,.22],[x*.23,-.15,.22],[x*.23,-.15,.98],[x*.17,-.15,.98],[x*.17,.1,.25],[x*.22,.1,.25],[x*.22,.1,.95],[x*.17,.1,.95]],{mat:'metal'}));
  A(U,box(0,-.285,.6,.05,.014,.62,{mat:'glow',glow:'hmd'}));
  A(U,cyl(0,.2,.42,.065,.52,'z',8,{mat:'metal'}),ARM_BRASS);A(U,cyl(0,.2,.88,.034,.5,'z',8,{mat:'metal'}));
  A(U,cyl(0,0,Lu,.23,.46,'x',12,{mat:'dark'}));
  // elbow actuator + forearm gauntlet. The pilot sees the forearm from above and behind, so the top
  // carries the detail: three overlapping white plates (scales) with black frame showing between them,
  // twin brass rams with steel rods on top, blue light slits on the plate edges, a white elbow cop.
  const plate=(z0,z1,y0,h,w0,w1,o)=>{const b=.025;return hexa([[-w0,y0,z0],[w0,y0,z0],[w1,y0,z1],[-w1,y0,z1],[-w0+b,y0-h,z0+b*1.6],[w0-b,y0-h,z0+b*1.6],[w1-b,y0-h,z1-b],[-w1+b,y0-h,z1-b]],o)};
  A(F,cyl(0,0,0,.25,.5,'x',12,{mat:'dark',name:'elbow'}));
  for(const x of [-1,1]){A(F,cyl(x*.265,0,0,.2,.05,'x',12,{mat:'armor'}));A(F,cyl(x*.295,0,0,.12,.016,'x',10,{mat:'glow',glow:'hmd'}))}
  A(F,plate(-.2,.12,-.14,.1,.2,.22,{name:'elbowCop',lines:1,lineArea:.01}));
  A(F,box(0,.02,.66,.24,.3,1.12,{mat:'dark'}));
  A(F,plate(.16,.52,-.17,.07,.22,.21,{name:'gauntlet',lines:1,lineArea:.01}));
  A(F,plate(.47,.84,-.21,.07,.21,.2,{lines:1,lineArea:.01}));
  A(F,plate(.79,1.12,-.25,.07,.2,.18,{chip:true,lines:1,lineArea:.01,name:'wristPlate'}));
  for(const [z0,z1,y] of [[.22,.46,-.245],[.53,.78,-.285],[.85,1.06,-.325]])for(const x of [-1,1])A(F,box(x*.165,y,(z0+z1)/2,.018,.012,z1-z0,{mat:'glow',glow:'hmd'}));
  A(F,box(0,-.288,.66,.07,.012,.12,{mat:'glow',glow:'hmd'}));
  for(const x of [-1,1]){A(F,cyl(x*.12,-.2,.27,.045,.42,'z',8,{mat:'metal'}),ARM_BRASS);A(F,cyl(x*.12,-.2,.62,.024,.4,'z',8,{mat:'metal'}));A(F,box(x*.12,-.2,.05,.08,.08,.06,{mat:'dark'}))}
  for(const x of [-1,1]){A(F,hexa([[x*.22,-.15,.24],[x*.27,-.15,.24],[x*.27,-.15,1.1],[x*.22,-.15,1.1],[x*.22,.14,.3],[x*.26,.14,.3],[x*.26,.14,1.04],[x*.22,.14,1.04]],{mat:'metal',lines:1,lineArea:.01}));for(const z of [.4,.7,1.0])A(F,box(x*.272,-.02,z,.006,.05,.04,{mat:'dark'}))}
  A(F,cyl(0,.22,.55,.055,.6,'z',8,{mat:'metal'}),ARM_BRASS);A(F,cyl(0,.22,1.0,.03,.4,'z',8,{mat:'metal'}));
  A(F,cyl(0,0,Lf-.03,.2,.1,'z',10,{mat:'dark'}));A(F,cyl(0,0,Lf-.09,.215,.03,'z',10,{mat:'metal'}));
  return{U,F}})();
function armIK(X){
  const S=xfPoint(X.frame,ARM_IK.shoulder),Wr=xfPoint(X.gun,ARM_IK.wrist),F=X.frame.R,pole0=ARM_IK.pole,pole=[F[0]*pole0[0]+F[1]*pole0[1]+F[2]*pole0[2],F[3]*pole0[0]+F[4]*pole0[1]+F[5]*pole0[2],F[6]*pole0[0]+F[7]*pole0[1]+F[8]*pole0[2]];
  const D=vsub(Wr,S),d=clamp(vlen(D),.05,ARM_IK.L1+ARM_IK.L2-1e-3),u=D.map(v=>v/(vlen(D)||1)),a=(ARM_IK.L1*ARM_IK.L1-ARM_IK.L2*ARM_IK.L2+d*d)/(2*d),h=Math.sqrt(Math.max(0,ARM_IK.L1*ARM_IK.L1-a*a));
  const pd=pole[0]*u[0]+pole[1]*u[1]+pole[2]*u[2];let n=[pole[0]-u[0]*pd,pole[1]-u[1]*pd,pole[2]-u[2]*pd];const nl=vlen(n)||1;n=n.map(v=>v/nl);
  const E=[S[0]+u[0]*a+n[0]*h,S[1]+u[1]*a+n[1]*h,S[2]+u[2]*a+n[2]*h];
  const fd=vsub(Wr,E),fl=vlen(fd)||1,fu=fd.map(v=>v/fl),side=vcross(fu,n),off=(P,k,m)=>[P[0]+n[0]*k+side[0]*m,P[1]+n[1]*k+side[1]*m,P[2]+n[2]*k+side[2]*m];
  const I=[1,0,0,0,1,0,0,0,1],mk=(A,B,wa,wb,o)=>{const P=beam(A,B,wa,wb,o,n);return{P,R:I,wv:P.verts,style:ARM_STYLE}};
  // Bone frames: Z along the bone, Y the bend side (pole, made perpendicular), X = Y x Z.
  const place=(O,Z,list)=>{const pd2=n[0]*Z[0]+n[1]*Z[1]+n[2]*Z[2];let Y=[n[0]-Z[0]*pd2,n[1]-Z[1]*pd2,n[2]-Z[2]*pd2];const yl=vlen(Y)||1;Y=Y.map(v=>v/yl);const X=vcross(Y,Z),R=[X[0],Y[0],Z[0],X[1],Y[1],Z[1],X[2],Y[2],Z[2]];
    return list.map(P=>({P,R,style:wornStyle(P.armStyle||ARM_STYLE),wv:P.verts.map(v=>[O[0]+X[0]*v[0]+Y[0]*v[1]+Z[0]*v[2],O[1]+X[1]*v[0]+Y[1]*v[1]+Z[1]*v[2],O[2]+X[2]*v[0]+Y[2]*v[1]+Z[2]*v[2]])}))};
  const uz=vsub(E,S),ul=vlen(uz)||1;cockpit.elbowW=E;cockpit.foreW=[(E[0]+Wr[0])/2,(E[1]+Wr[1])/2,(E[2]+Wr[2])/2];
  const ik0=mk(S,E,.22,.22,{mat:'dark'}),ik1=mk(E,Wr,.2,.17,{mat:'dark'});ik0.P.dyn='ik0';ik1.P.dyn='ik1';
  return[ik0,ik1,...place(S,uz.map(v=>v/ul),ARM_PARTS.U),...place(E,fu,ARM_PARTS.F)];
}
function drawCockpit(speed,viewYaw,viewPitch){
  const C=cockpit,pz=cockpitPose(),X=cockpitXf(pz);
  // SYNC DRIVE re-lights the frame itself: the capsule's edges go gold with the world.
  const cps=syncMix>.02?syncStyle():CP_STYLE;
  // Helmet view (Iron Man style): the frame/capsule geometry is not drawn; only HALBERD with its forearm
  // mount and the KESTREL pod remain in view. The machine itself is a concept sheet, not on screen.
  const insts=COCKPIT.filter(P=>P.style===ARM_STYLE||P.style===GUN_STYLE&&P.weapon===C.shown).map(P=>({P,R:X[P.bone].R,wv:P.verts.map(v=>xfPoint(X[P.bone],v)),style:P.style===CP_STYLE?cps:wornStyle(P.style),hot:P.style.toon?C.flashW:0}));insts.push(...armIK(X));
  const tubeGlow=player.boostTime>0?1:.25+player.boost/100*.4;
  NEAR_Z=.04;
  // WebGL: when window.HF_THREE is active, the arm and the held weapon are rendered by WebGL into its own
  // canvas and composited here, at the same point in the draw order (so shake / roll and the HMD layers
  // stay as they are).
  const T3=typeof window!=='undefined'&&window.HF_THREE;
  if(T3&&T3.active&&T3.draw({insts,viewYaw,viewPitch,W,H,DPR,focal:renderFocal,camY:CAMERA_Y,px:player.x,pz:player.z,near:NEAR_Z,light:KEY_LIGHT,inkW:clamp(H/720*5.5,3.5,10)})){
    ctx.drawImage(T3.canvas,0,0,W,H);if(!threeWorldFrame)maskInstsFromBloom(insts,viewYaw,viewPitch)}
  else renderMeshInstances(insts,viewYaw,viewPitch,{style:CP_STYLE,alpha:1,silW:1.6,crW:.85,halo:.05,detail:true,creases:true,glow:{hmd:.7},cockpit:true,inkW:clamp(H/720*5.5,3.5,10)});
  const P3=(bone,v)=>{const w=xfPoint(X[bone],v);return project(w[0],w[1],w[2],viewYaw,viewPitch)};
  // Stencilled weapon names on the receiver side and the pod flank (affine-mapped bitmap text).
  if(C.shown==='MAUL')stencil(P3,'gun','MAUL',[-.17,.17,2.3],[-.17,.17,1.6],[-.17,.04,2.3],'#c9d0da');
  else if(C.shown==='FLAIL')stencil(P3,'gun','FLAIL',[-.102,-.12,1.32],[-.102,-.12,.86],[-.102,-.215,1.32],'#c9d0da');
  else if(C.shown==='BARDICHE')stencil(P3,'gun','BARDICHE',[-.86,-.163,2.84],[-.2,-.163,2.84],[-.86,-.163,2.56],'#c9d0da');
  else if(C.shown==='ARBALEST')stencil(P3,'gun','ARBALEST',[-.08,.05,2.15],[-.08,.05,.85],[-.08,-.03,2.15],'#c9d0da');
  else stencil(P3,'barrel','HALBERD',[-.05,.103,1.32],[-.05,.103,.7],[-.1,.052,1.32],'#c9d0da');
  ctx.save();ctx.lineCap='round';ctx.shadowBlur=0;ctx.globalCompositeOperation='lighter';
  // Gun: heat bar along the receiver, glowing barrel, vent steam.
  if(C.shown==='FLAIL'){if(player.gunKick>.25){const m=P3('gun',[0,-.02,2.2]);if(m){const r=clamp(m.f*.3,8,90)*player.gunKick;ctx.globalAlpha=.6*player.gunKick;ctx.fillStyle='#ffc75a';ctx.beginPath();ctx.arc(m.x,m.y,r,0,TAU);ctx.fill();ctx.globalAlpha=player.gunKick;ctx.fillStyle='#fffbe8';ctx.beginPath();ctx.arc(m.x,m.y,r*.4,0,TAU);ctx.fill()}}}
  else if(C.shown==='BARDICHE'){}
  else if(C.shown==='MAUL'){if(C.maulKick>.3){const m=P3('gun',[0,.1,3.25]),b=P3('gun',[0,.1,.1]);for(const [q,k] of [[m,1],[b,.7]]){if(!q)continue;const r=clamp(q.f*.32,8,90)*C.maulKick*k;ctx.globalAlpha=.6*C.maulKick;ctx.fillStyle='#ffb35c';ctx.beginPath();ctx.arc(q.x,q.y,r,0,TAU);ctx.fill();ctx.globalAlpha=C.maulKick;ctx.fillStyle='#fffbe8';ctx.beginPath();ctx.arc(q.x,q.y,r*.35,0,TAU);ctx.fill()}}}
  else{const heat=player.heat/100,a=P3('gun',[-.16,.02,-.25]),b=P3('gun',[-.16,.02,-.25+.75*heat]);if(a&&b&&heat>.02){ctx.globalAlpha=.9;ctx.strokeStyle=player.vent?'#ff5a36':heat>.7?'#ff8a3a':'#ffc75a';ctx.lineWidth=clamp(a.f*.025,2,6);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
    const hk=clamp((player.heat-45)/55,0,1);if(hk>0||player.vent){const p0=P3('barrel',[0,0,.6]),p1=P3('barrel',[0,0,2.7]);if(p0&&p1){ctx.globalAlpha=player.vent?.55+.25*Math.sin(gameTime*22):.6*hk;ctx.strokeStyle=player.vent?'#ff4a2a':'#ff7a3a';ctx.lineWidth=clamp(p0.f*.1,2,14);ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(p1.x,p1.y);ctx.stroke()}}
    if(player.vent){for(let i=0;i<10;i++){const k=(gameTime*1.6+i/10)%1,q=P3('gun',[(i%2?.07:-.07),.13+k*.42,.05+(i%5)*.08]);if(!q)continue;ctx.globalAlpha=(1-k)*.18;ctx.strokeStyle='#e6fff8';ctx.lineWidth=clamp(q.f*.012,1,4)*(1+k);ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.quadraticCurveTo(q.x+Math.sin(gameTime*5+i)*10,q.y-12,q.x+Math.sin(gameTime*3+i)*6,q.y-28*(.5+k));ctx.stroke()}}
    if(player.gunKick>.25){const m=P3('barrel',[0,0,2.95]);if(m){const r=clamp(m.f*.18,6,60)*player.gunKick;ctx.globalAlpha=.6*player.gunKick;ctx.fillStyle=getSightLink()?'#8fffe0':'#ffc75a';ctx.beginPath();ctx.arc(m.x,m.y,r,0,TAU);ctx.fill();ctx.globalAlpha=player.gunKick;ctx.fillStyle='#fffbe8';ctx.beginPath();ctx.arc(m.x,m.y,r*.35,0,TAU);ctx.fill()}}}
  ctx.restore();
  NEAR_Z=.45;
  drawVisor(viewYaw);
  // Gun muzzle in world space for the cannon (bolts leave the real barrel).
  {const f=C.foreW,q=f&&project(f[0],f[1],f[2],viewYaw,viewPitch);visorFX.armPt=q&&q.x>-60&&q.x<W+60&&q.y>-60&&q.y<H+60?{x:clamp(q.x/W,.04,.94),y:clamp(q.y/H,.05,.86)}:{x:.88,y:.86}}
  // BARDICHE: the edge's sweep leaves a short blue-white smear through the cut.
  {const S=player.swing,T=C.axeTrail||(C.axeTrail=[]);if(C.shown==='BARDICHE'&&S&&S.t>=BARDICHE.wind+BARDICHE.hold+BARDICHE.cut*.2&&S.t<=BARDICHE.wind+BARDICHE.hold+BARDICHE.cut+BARDICHE.over*.6)T.push({a:xfPoint(X.gun,[-.95,-.2,2.0]),b:xfPoint(X.gun,[-.95,-.2,3.35]),t:gameTime});
    while(T.length&&(gameTime-T[0].t>.11||!S))T.shift();
    if(T.length>1){ctx.save();ctx.globalCompositeOperation='lighter';for(let i=1;i<T.length;i++){const A=T[i-1],Bq=T[i],q=[A.a,Bq.a,Bq.b,A.b].map(v=>project(v[0],v[1],v[2],viewYaw,viewPitch));if(q.some(v=>!v))continue;
      const k=1-(gameTime-Bq.t)/.11;ctx.globalAlpha=.32*k;ctx.fillStyle='#bcd8ff';ctx.beginPath();q.forEach((v,j)=>j?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.closePath();ctx.fill();
      ctx.globalAlpha=.85*k;ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(q[2].x,q[2].y);ctx.lineTo(q[3].x,q[3].y);ctx.stroke()}ctx.restore()}}
  C.muzzle=C.shown==='FLAIL'?xfPoint(X.gun,[0,-.02,2.15]):C.shown==='BARDICHE'?xfPoint(X.gun,[-.5,-.2,2.7]):C.shown==='MAUL'?xfPoint(X.gun,[0,.1,3.2]):C.shown==='ARBALEST'?xfPoint(X.gun,[0,0,3.75]):xfPoint(X.barrel,[0,0,2.95]);
}
// Yellow/ink hazard stripes laid along a strip of the capsule (a->b length, a->c width).
function hazard(P3,a,b,c,n){ctx.save();for(let i=0;i<n;i++){const t0=i/n,t1=(i+.5)/n,k=.5/n,q=[[t0,0],[t1,0],[t1+k,1],[t0+k,1]].map(([t,w])=>P3('frame',[lerp(a[0],b[0],t)+(c[0]-a[0])*w,lerp(a[1],b[1],t)+(c[1]-a[1])*w,lerp(a[2],b[2],t)+(c[2]-a[2])*w]));if(q.some(v=>!v))continue;ctx.globalAlpha=.9;ctx.fillStyle='#e8c34a';ctx.beginPath();q.forEach((p,j)=>j?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill()}ctx.restore()}
function stencil(P3,bone,text,o3,x3,y3,col){const c=pxLine(text,col);if(!c)return;const o=P3(bone,o3),ex=P3(bone,x3),ey=P3(bone,y3);if(!o||!ex||!ey)return;
  const tw=(c.width-2),th=16,ax=(ex.x-o.x)/tw,ay=(ex.y-o.y)/tw,bx=(ey.x-o.x)/th,by=(ey.y-o.y)/th;if(ax*by-ay*bx<=0)return;
  ctx.save();ctx.transform(ax,ay,bx,by,o.x,o.y);ctx.globalAlpha=.78;ctx.imageSmoothingEnabled=true;ctx.drawImage(c,0,0);ctx.restore()}
function drawRadarScope(P3){
  const o=P3('frame',[-.46,-.188,.895]),ax=P3('frame',[-.36,-.188,.895]),ay=P3('frame',[-.46,-.205,.842]);if(!o||!ax||!ay)return;
  // Affine map of the scope plane: unit circle -> projected ellipse on the console.
  ctx.save();ctx.transform(ax.x-o.x,ax.y-o.y,ay.x-o.x,ay.y-o.y,o.x,o.y);
  const s=1/Math.max(1,Math.hypot(ax.x-o.x,ax.y-o.y));ctx.lineWidth=s*1.1;ctx.globalCompositeOperation='lighter';
  ctx.fillStyle='rgba(2,14,12,.9)';ctx.globalCompositeOperation='source-over';ctx.beginPath();ctx.arc(0,0,1,0,TAU);ctx.fill();ctx.globalCompositeOperation='lighter';
  ctx.strokeStyle='rgba(103,255,209,.35)';for(const r of [.33,.66,1]){ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.stroke()}
  const h=headYaw*Math.PI/180,g=player.torso;ctx.fillStyle='rgba(103,255,209,.12)';ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,.95,-Math.PI/2+h-.2,-Math.PI/2+h+.2);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(255,199,90,.8)';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.sin(g)*.85,-Math.cos(g)*.85);ctx.stroke();
  const sweep=(gameTime*2.2)%TAU;ctx.strokeStyle='rgba(103,255,209,.5)';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(sweep),Math.sin(sweep));ctx.stroke();
  const range=110,cy=Math.cos(-player.yaw),sy=Math.sin(-player.yaw);
  for(const e of enemies){if(!e.alive)continue;const dx=e.x-player.x,dz=e.z-player.z,d=Math.hypot(dx,dz);if(d>range||(e.marked<=0&&e.designated<=0&&d>30))continue;
    const x=(dx*cy-dz*sy)/range,y=(dx*sy+dz*cy)/range,r=e.type==='TITAN'?.1:e.heavy?.07:.05;ctx.fillStyle=e.designated>0?'#8fffe0':CLASS_STYLE[e.type].edge;ctx.globalAlpha=.9;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill()}
  ctx.restore();
}
// Helmet visor: soft dark rim of the helmet, faint glass streaks that drift against head turns, threat
// light bleeding in from the rim toward each threat. The visor itself never breaks (the frame is hit, not the pilot).
function drawVisor(viewYaw){
  const C=cockpit,cx=W/2,cy=H*.5;ctx.save();
  const g=ctx.createRadialGradient(cx,cy,Math.min(W,H)*.42,cx,cy,Math.hypot(W,H)*.56);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.72,'rgba(2,6,8,.55)');g.addColorStop(1,'rgba(1,3,4,.96)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.globalCompositeOperation='lighter';const sh=-headYaw*2.2;
  for(const [x0,y0,x1,y1,a] of [[.08,.1,.22,.32,.05],[.12,.08,.24,.26,.03],[.8,.62,.9,.84,.035]]){ctx.globalAlpha=a*(1+player.absorb*2);ctx.strokeStyle='#d8fff4';ctx.lineWidth=W*.012;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x0*W+sh,y0*H);ctx.lineTo(x1*W+sh,y1*H);ctx.stroke()}
  for(const t of cockpitThreats(viewYaw)){const back=Math.abs(t.rel)>Math.PI/2,ex=cx+clamp(Math.sin(t.rel)*1.6,-1,1)*W*.52,ey=back?H*.98:cy-H*.08,r=Math.min(W,H)*(.22+.18*t.k),pulse=t.charge?.65+.35*Math.sin(gameTime*26):1,q=ctx.createRadialGradient(ex,ey,0,ex,ey,r);
    q.addColorStop(0,t.hit?'rgba(255,210,196,.55)':'rgba(255,74,58,.5)');q.addColorStop(1,'rgba(255,40,30,0)');ctx.globalAlpha=clamp(t.k*pulse*.8,0,1);ctx.fillStyle=q;ctx.beginPath();ctx.arc(ex,ey,r,0,TAU);ctx.fill()}
  ctx.restore();
}

// ARBALEST scope: everything outside one round field goes dark, hairline crosshair with stadia ticks,
// the range under the crosshair and the bolt cycling along the rim. HMD type, warm off-white.
function drawScope(viewYaw,viewPitch){const k=player.scope||0;if(k<.02)return;
  const cx=W/2,cy=H*.49,R=Math.min(W,H)*.44*(1.25-.25*k),ink='rgba(232,228,212,';
  ctx.save();ctx.globalAlpha=Math.min(1,k*1.4);ctx.fillStyle='rgba(2,4,5,.97)';ctx.beginPath();ctx.rect(0,0,W,H);ctx.arc(cx,cy,R,0,TAU,true);ctx.fill('evenodd');
  const g=ctx.createRadialGradient(cx,cy,R*.82,cx,cy,R);g.addColorStop(0,'rgba(2,4,5,0)');g.addColorStop(1,'rgba(2,4,5,.85)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,R,0,TAU);ctx.fill();
  ctx.strokeStyle=ink+'.55)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(cx,cy,R-1,0,TAU);ctx.stroke();
  ctx.strokeStyle=ink+'.8)';ctx.beginPath();for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ctx.moveTo(cx+dx*R*.06,cy+dy*R*.06);ctx.lineTo(cx+dx*R*.98,cy+dy*R*.98)}ctx.stroke();
  ctx.lineWidth=2;ctx.beginPath();for(const [dx,dy] of [[1,0],[-1,0],[0,1]]){ctx.moveTo(cx+dx*R*.55,cy+dy*R*.55);ctx.lineTo(cx+dx*R*.98,cy+dy*R*.98)}ctx.stroke();
  ctx.lineWidth=1;ctx.beginPath();for(let i=1;i<=4;i++){const t=R*.1*i;ctx.moveTo(cx-5,cy+t);ctx.lineTo(cx+5,cy+t);ctx.moveTo(cx+t,cy-4);ctx.lineTo(cx+t,cy+4);ctx.moveTo(cx-t,cy-4);ctx.lineTo(cx-t,cy+4)}ctx.stroke();
  ctx.fillStyle=ink+'.9)';ctx.fillRect(cx-1,cy-1,2,2);
  const s=Math.max(1.2,H/720*1.5),lock=getLock(.04),cyc=clamp((gameTime-(player.snipeT??-9))/ARBALEST.cycle,0,1);
  hudText(lock?`RANGE ${Math.round(lock.dist)} M  //  ${etag(lock.e)}`:'RANGE ---',cx+R*.08,cy+R*.62,6*s,lock?'#e2dfcc':'rgba(226,223,204,.55)',0,.28);
  hudText(`ARBALEST  x${ARBALEST.zoom.toFixed(1)}`,cx-R*.08,cy+R*.62,6*s,'rgba(226,223,204,.55)',1,.28);
  ctx.strokeStyle=cyc<1?'rgba(216,180,108,.8)':ink+'.7)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,R-6,Math.PI*.62,Math.PI*.62+Math.PI*.76*cyc);ctx.stroke();
  hudText(cyc<1?'CYCLING':'READY',cx,cy+R*.86,5.4*s,cyc<1?'#d8b46c':'#e2dfcc',.5,.3);
  ctx.restore()}
function drawGunSight(viewYaw,viewPitch){
  const a=aimVector(),p=project(player.x+a.x*85,CAMERA_Y+a.y*85,player.z+a.z*85,viewYaw,viewPitch);
  const linked=getSightLink(),lock=getLock(.24),heat=player.heat/100;
  ctx.save();ctx.lineCap='round';
  if(!p||p.x<20||p.x>W-20||p.y<20||p.y>H-20){ // gun is pointing outside the HMD view: a witness tick on the canopy edge
    const side=Math.sign(angleDiff(player.yaw+player.torso,viewYaw))||1;ctx.strokeStyle='#ffc75a';ctx.globalAlpha=.8;ctx.lineWidth=2;const x=side>0?W-40:40,y=H*.49;ctx.beginPath();ctx.moveTo(x-side*10,y-8);ctx.lineTo(x,y);ctx.lineTo(x-side*10,y+8);ctx.stroke();ctx.restore();return}
  const maul=cockpit.shown==='MAUL',r=maul?26:20,gap=maul?.55:.3+(linked?0:.25);
  // With the head tracked the view moves under the gun, so the sight wanders across the screen: a dark halo keeps it
  // readable over lit walls and blasts, and four outer ticks give the eye something to find from the corner of the view.
  ctx.strokeStyle='rgba(0,0,0,.6)';ctx.lineWidth=5;ctx.beginPath();ctx.arc(p.x,p.y,r,0,TAU);for(let i=0;i<4;i++){const c=Math.cos(i*Math.PI/2),s=Math.sin(i*Math.PI/2);ctx.moveTo(p.x+c*(r+5),p.y+s*(r+5));ctx.lineTo(p.x+c*(r+13),p.y+s*(r+13))}ctx.stroke();
  ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(p.x-3.5,p.y-3.5,7,7);ctx.globalCompositeOperation='lighter';
  ctx.strokeStyle=linked?'#8fffe0':'#ffc75a';ctx.globalAlpha=.9;ctx.lineWidth=2.2;ctx.beginPath();for(let i=0;i<4;i++){const c=Math.cos(i*Math.PI/2),s=Math.sin(i*Math.PI/2);ctx.moveTo(p.x+c*(r+5),p.y+s*(r+5));ctx.lineTo(p.x+c*(r+13),p.y+s*(r+13))}ctx.stroke();
  // Broken ring: gap = dispersion; the ring fills red with barrel heat.
  for(let i=0;i<4;i++){const a0=i*Math.PI/2+Math.PI/4+gap/2,a1=a0+Math.PI/2-gap,hot=!maul&&heat>(i+1)/4.2;ctx.strokeStyle=maul?(i<player.rockets?'#ffe7b0':'#6a5130'):player.vent?'#ff4a2a':hot?'#ff8a3a':linked?'#8fffe0':'#ffc75a';ctx.globalAlpha=!maul&&player.vent?.5+.4*Math.sin(gameTime*22):.9;ctx.lineWidth=2.4;ctx.beginPath();ctx.arc(p.x,p.y,r,a0,a1);ctx.stroke()}
  ctx.fillStyle='#fff3d0';ctx.globalAlpha=1;ctx.fillRect(p.x-2,p.y-2,4,4);
  if(player.hitMarkT>0){const k=player.hitMarkT/.09,d=r+4+6*(1-k);ctx.strokeStyle='#ffffff';ctx.globalAlpha=k;ctx.lineWidth=2;ctx.beginPath();for(const [sx,sy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){ctx.moveTo(p.x+sx*d*.55,p.y+sy*d*.55);ctx.lineTo(p.x+sx*d,p.y+sy*d)}ctx.stroke()}
  if(player.vent){ctx.font='9px Consolas';ctx.textAlign='center';ctx.fillStyle='#ff6a48';ctx.fillText('VENT',p.x,p.y+r+14)}
  // Gun lock: amber brackets snap onto the target's real box.
  if(lock&&lock.score<.085){const b=enemyScreenBox(lock.e,viewYaw,viewPitch);if(b){const pad=8,x0=b.x0-pad,x1=b.x1+pad,y0=b.y0-pad,y1=b.y1+pad,c=clamp(Math.min(x1-x0,y1-y0)*.2,7,18);
    ctx.strokeStyle='#ffc75a';ctx.globalAlpha=.85;ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x0,y0+c);ctx.lineTo(x0,y0);ctx.lineTo(x0+c,y0);ctx.moveTo(x1-c,y0);ctx.lineTo(x1,y0);ctx.lineTo(x1,y0+c);ctx.moveTo(x0,y1-c);ctx.lineTo(x0,y1);ctx.lineTo(x0+c,y1);ctx.moveTo(x1-c,y1);ctx.lineTo(x1,y1);ctx.lineTo(x1,y1-c);ctx.stroke();
    // Armour state as five ticks under the bracket, range as one small figure.
    const hp=clamp(lock.e.hp/lock.e.maxHp,0,1);for(let i=0;i<5;i++){ctx.globalAlpha=hp>i/5?.85:.15;ctx.fillRect(x0+i*8,y1+5,6,2)}ctx.globalAlpha=.7;ctx.font='9px Consolas';ctx.textAlign='right';ctx.fillStyle='#ffc75a';ctx.fillText(Math.round(lock.dist)+'',x1,y1+12)}}
  ctx.restore();
}
function getVisualTarget(viewYaw,maxAngle=.13){
  let best=null,bestA=maxAngle;
  for(const e of enemies){if(!e.alive)continue;const dx=e.x-player.x,dz=e.z-player.z,dist=Math.hypot(dx,dz);if(dist>125||segmentHitsWorld(player.x,CAMERA_Y,player.z,e.x,aimY(e),e.z))continue;const a=Math.abs(angleDiff(Math.atan2(dx,-dz),viewYaw));if(a<bestA){bestA=a;best=e}}
  return best;
}
function updateVisualDesignation(dt){
  const viewYaw=player.yaw+headYaw*Math.PI/180,target=headPoseFresh()?getVisualTarget(viewYaw):null;
  visualContact=target;
  for(const e of enemies){
    if(!e.alive)continue;
    if(e!==target)e.focus=Math.max(0,(e.focus||0)-dt*1.8);
    e.designated=Math.max(0,(e.designated||0)-dt);
    if(e.designated>0)e.marked=Math.max(e.marked,e.designated);
    if(e.designated<=0&&lastDesignatedId===e.id)lastDesignatedId=0;
  }
  if(!target)return;
  target.focus=Math.min(.38,(target.focus||0)+dt);target.marked=Math.max(target.marked,.65);
  if(target.focus>=.30){
    target.designated=4.8;target.marked=4.8;lastDesignatedId=target.id;
    if(!target.awake)wakeEnemy(target,'VISUAL CONTACT');
    if(!target.markLatch){target.markLatch=true;sfx.designate(stats.designations++);addFlow(18,'HMD DESIGNATE');plog('Link',`-HMD designate. ${etag(target)}`);pilotGlance(target,.9,1);say('DESIGNATE')}
  }
}
function drawScanCue(e,viewYaw,viewPitch){
  if(!e)return;const bx=enemyScreenBox(e,viewYaw,viewPitch);if(!bx)return;
  const xs=[bx.x0,bx.x1],ys=[bx.y0,bx.y1],depth=bx.depth;
  const designated=e.designated>0,progress=clamp((e.focus||0)/.30,0,1),pad=clamp(18-depth*.06,8,18);
  let x0=Math.min(...xs)-pad,x1=Math.max(...xs)+pad,y0=Math.min(...ys)-pad,y1=Math.max(...ys)+pad;
  const minW=42,minH=42,cx=(x0+x1)/2,cy=(y0+y1)/2;if(x1-x0<minW){x0=cx-minW/2;x1=cx+minW/2}if(y1-y0<minH){y0=cy-minH/2;y1=cy+minH/2}
  const w=x1-x0,h=y1-y0,c=clamp(Math.min(w,h)*.22,9,23),pulse=.72+.28*Math.sin(gameTime*10);
  ctx.save();ctx.strokeStyle=designated?'rgba(103,255,209,.92)':'rgba(103,255,209,.68)';ctx.fillStyle='rgba(143,255,224,.86)';ctx.shadowColor='#55ffd0';ctx.shadowBlur=designated?10:6;ctx.lineWidth=designated?1.35:1.0;
  // HMD acquisition hugs the actual projected machine instead of adding another generic target circle.
  ctx.globalAlpha=designated?.94:.72;ctx.beginPath();
  ctx.moveTo(x0+c,y0);ctx.lineTo(x0,y0);ctx.lineTo(x0,y0+c);ctx.moveTo(x1-c,y0);ctx.lineTo(x1,y0);ctx.lineTo(x1,y0+c);
  ctx.moveTo(x0,y1-c);ctx.lineTo(x0,y1);ctx.lineTo(x0+c,y1);ctx.moveTo(x1,y1-c);ctx.lineTo(x1,y1);ctx.lineTo(x1-c,y1);ctx.stroke();
  // Acquisition rail: progress is spatially attached to the contact, while the center HMD remains quiet.
  const railY=y0-7,railW=w*.58,railX=cx-railW/2;ctx.globalAlpha=.30;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(railX,railY);ctx.lineTo(railX+railW,railY);ctx.stroke();ctx.globalAlpha=.95;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(railX,railY);ctx.lineTo(railX+railW*(designated?1:progress),railY);ctx.stroke();
  if(!designated&&progress>0){const sweep=y0+h*progress;ctx.globalAlpha=.14+.12*pulse;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x0+4,sweep);ctx.lineTo(x1-4,sweep);ctx.stroke()}
  ctx.globalAlpha=.82;ctx.shadowBlur=4;ctx.font='8px Consolas';ctx.textAlign='left';ctx.fillText(designated?'HMD DES':'HMD ACQ',x0,y1+13);ctx.textAlign='right';ctx.fillText(designated?`${e.designated.toFixed(1)}s`:`${Math.round(progress*100)}%`,x1,y1+13)
  ctx.restore();
}
function drawLeadCue(viewYaw,viewPitch){const lock=getLock(.42);if(!lock||lock.e.marked<=0||!lock.e.awake)return;const e=lock.e,leadT=clamp(lock.dist/92,.08,1.15),lx=e.x+(e.vx||0)*leadT,lz=e.z+(e.vz||0)*leadT,p=project(lx,3.0,lz,viewYaw,viewPitch),q=project(e.x,3.0+eY(e),e.z,viewYaw,viewPitch);if(!p||!q)return;ctx.save();ctx.strokeStyle='rgba(255,209,111,.68)';ctx.fillStyle='rgba(255,225,153,.82)';ctx.shadowBlur=8;ctx.shadowColor='#ffd16f';ctx.lineWidth=1;ctx.setLineDash([4,5]);ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.setLineDash([]);const r=7;ctx.beginPath();ctx.moveTo(p.x,p.y-r);ctx.lineTo(p.x+r,p.y);ctx.lineTo(p.x,p.y+r);ctx.lineTo(p.x-r,p.y);ctx.closePath();ctx.stroke();ctx.font='8px Consolas';ctx.textAlign='center';ctx.fillText('LEAD',p.x,p.y-12);ctx.restore()}
function drawHmdBoresight(){
  const cx=W/2,cy=H*.49,target=visualContact,progress=target?clamp((target.focus||0)/.30,0,1):0;
  ctx.save();ctx.translate(cx,cy);ctx.strokeStyle='rgba(103,255,209,.38)';ctx.fillStyle='rgba(126,255,218,.62)';ctx.shadowBlur=4;ctx.shadowColor='#67ffd1';ctx.lineWidth=1;
  // The head layer is only a datum. Acquisition progress lives on the contact itself.
  const r=11,g=5,bright=.38+.34*progress;ctx.globalAlpha=bright;ctx.beginPath();ctx.moveTo(-r-g,-r);ctx.lineTo(-r,-r);ctx.lineTo(-r,-r-g);ctx.moveTo(r+g,-r);ctx.lineTo(r,-r);ctx.lineTo(r,-r-g);ctx.moveTo(-r-g,r);ctx.lineTo(-r,r);ctx.lineTo(-r,r+g);ctx.moveTo(r+g,r);ctx.lineTo(r,r);ctx.lineTo(r,r+g);ctx.stroke();
  ctx.globalAlpha=.50;ctx.fillRect(-1,-1,2,2);ctx.restore();
}
function truss(ax,az,bx,bz,y0,y1,depth,viewYaw,viewPitch,a=.16,bays=12){
  // Two Warren-truss faces + deck plate: a real load path instead of a slab.
  const L=Math.hypot(bx-ax,bz-az),ux=(bx-ax)/L,uz=(bz-az)/L,nx=-uz*depth/2,nz=ux*depth/2;
  const deck=[project(ax-nx,y1,az-nz,viewYaw,viewPitch),project(bx-nx,y1,bz-nz,viewYaw,viewPitch),project(bx+nx,y1,bz+nz,viewYaw,viewPitch),project(ax+nx,y1,az+nz,viewYaw,viewPitch)];
  if(deck.every(Boolean)){ctx.save();ctx.globalAlpha=.9;poly(deck,'rgba(1,7,8,.9)');ctx.restore()}
  beginLines();for(const s of [-1,1]){const ox=nx*s,oz=nz*s;
    worldLine3D(ax+ox,y1,az+oz,bx+ox,y1,bz+oz,viewYaw,viewPitch,'93,235,202',a*1.4,1.1);worldLine3D(ax+ox,y0,az+oz,bx+ox,y0,bz+oz,viewYaw,viewPitch,'93,235,202',a,.9);
    for(let i=0;i<bays;i++){const t0=i/bays,t1=(i+1)/bays,tm=(t0+t1)/2,x0=lerp(ax,bx,t0)+ox,z0=lerp(az,bz,t0)+oz,xm=lerp(ax,bx,tm)+ox,zm=lerp(az,bz,tm)+oz,x1=lerp(ax,bx,t1)+ox,z1=lerp(az,bz,t1)+oz;
      worldLine3D(x0,y0,z0,xm,y1,zm,viewYaw,viewPitch,'93,235,202',a*.7,.6);worldLine3D(xm,y1,zm,x1,y0,z1,viewYaw,viewPitch,'93,235,202',a*.7,.6)}}endLines();
}
function drawGantries(viewYaw,viewPitch){
  // v30: transfer portals are architectural machines, not three floating bars.
  const beam=(x0,y0,z0,x1,y1,z1,a=.18,w=1,color='93,235,202',blur=0)=>worldLine3D(x0,y0,z0,x1,y1,z1,viewYaw,viewPitch,color,a,w,blur);
  const portal=(z,height=12.5,width=35,phase=0)=>{
    const x0=-width,x1=width,top=height;
    // heavy deck silhouette
    if(worldRec){recLine(x0,top,z,x1,top,z,'1,8,9',.96,10,1);recLine(x0,top,z,x1,top,z,'103,255,209',.24,1)}
    const d=worldRec?null:projectSegment(x0,top,z,x1,top,z,viewYaw,viewPitch);if(d&&d[0]&&d[1]){ctx.save();ctx.strokeStyle='rgba(1,8,9,.96)';ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(d[0].x,d[0].y);ctx.lineTo(d[1].x,d[1].y);ctx.stroke();ctx.strokeStyle='rgba(103,255,209,.24)';ctx.lineWidth=1;ctx.stroke();ctx.restore()}
    // double piers and diagonal truss
    for(const side of [-1,1]){
      const x=side*width;beam(x,0,z,x,top,z,.18,1.2);beam(x-side*3.8,0,z,x-side*3.8,top,z,.075,.7);beam(x,0,z,x-side*10,top,z,.075,.7);
      beam(x-side*3.8,top*.44,z,x-side*12,top*.90,z,.055,.55);
    }
    for(let i=0;i<6;i++){const a=i/6,xa=x0+8+a*(width*2-16),xb=xa+(i%2?9:-9);beam(xa,top,z,xb,top-4.6,z,.055,.55)}
    // underslung rail and animated carrier
    beam(-width+6,top-2.2,z-1.1,width-6,top-2.2,z-1.1,.16,1.05,'128,255,220',4);
    const track=width*2-16,carrierX=-width+8+((gameTime*7+phase)%track);
    worldBox3D(carrierX,z-1.1,7.2,3.4,top-4.9,top-2.0,viewYaw,viewPitch,'rgba(2,14,13,.985)',.23);
    beam(carrierX-2.4,top-3.4,z-2.9,carrierX+2.4,top-3.4,z-2.9,.38,.9,'145,255,224',5);
  };
  ctx.save();
  // One massive high deck and one offset longitudinal deck establish a real upper city layer.
  truss(-56,-46,56,-46,23.5,29,9,viewYaw,viewPitch,.17,14);
  for(const x of [-52,-26,0,26,52]){beam(x,22,-46,x,29,-46,.075,.62);beam(x-4,24,-42,x+4,29,-42,.045,.5)}
  beam(-48,27,-49,48,27,-49,.22,1.0,'123,255,217',4);
  truss(-50,-106,-50,130,15.5,20,8,viewYaw,viewPitch,.13,26);
  for(let z=-104;z<=116;z+=44){beam(-54,0,z,-54,16,z,.055,.55);beam(-46,0,z,-46,16,z,.055,.55);beam(-54,16,z,-46,20,z,.045,.5)}
  // maintenance carrier under the high deck
  const deckCarrier=-48+((gameTime*8.5+96)%96);worldBox3D(deckCarrier,-45,8,4,20.2,23.8,viewYaw,viewPitch,'rgba(2,15,13,.99)',.20);beam(deckCarrier-2.8,21.9,-47,deckCarrier+2.8,21.9,-47,.36,.9,'145,255,224',5);

  portal(58,11.8,36,6);portal(-18,14.2,39,22);portal(-96,17.2,42,39);

  // Longitudinal service viaducts give the district a second navigational layer above ground.
  for(const side of [-1,1]){
    const x=side*42;
    beam(x,7.0,-148,x,7.0,148,.13,1.1);beam(x+side*3.8,7.0,-148,x+side*3.8,7.0,148,.055,.65);
    for(let z=-132;z<=132;z+=30){beam(x,0,z,x,7,z,.10,.75);beam(x,7,z,x+side*3.8,7,z,.075,.65);beam(x,0,z,x+side*3.8,7,z,.045,.5)}
    // slow maintenance pods on side viaducts
    for(let i=0;i<2;i++){
      const span=272,z=-136+((gameTime*(side<0?5.2:4.6)+i*137+136)%span);
      worldBox3D(x,z,5.8,8.5,5.2,8.6,viewYaw,viewPitch,'rgba(2,13,12,.985)',.16);
      beam(x-side*2.0,6.7,z-2.5,x-side*2.0,6.7,z+2.5,.27,.75,'126,255,219',4);
    }
  }

  // Cross-district high pipes / energy bus. They deliberately do not line up with every portal.
  for(const [z,y] of [[24,23],[-64,26]]){
    for(const off of [-1.5,1.5])beam(-112,y+off*.12,z+off,112,y+off*.12,z+off,.095,.9,'77,214,181');
    for(const x of [-92,-46,0,46,92]){beam(x,y-7,z,x,y,z,.055,.55);beam(x-4,y,z,x+4,y,z,.07,.55)}
  }
  ctx.restore();
}
function drawFoundryMachines(viewYaw,viewPitch){
  // Large process hardware sits outside the combat spine. It is readable at oblique head angles
  // and supplies the scale that v29 lacked.
  const pipe=(pts,a=.10,w=1,color='80,222,190')=>{for(let i=1;i<pts.length;i++)worldLine3D(...pts[i-1],...pts[i],viewYaw,viewPitch,color,a,w)};
  ctx.save();
  // Left exchanger bank: stacked rings and manifolds.
  for(const [cx,cz,h] of [[-101,-42,28],[-109,-67,35],[-100,-92,24]]){
    worldBox3D(cx,cz,12,12,0,h,viewYaw,viewPitch,'rgba(1,8,8,.985)',.105);
    for(const y of [h*.28,h*.52,h*.78])worldRingXY(cx,y,cz,7.2,2.2,viewYaw,viewPitch,.095,'92,232,198',.75,0,24);
  }
  pipe([[ -101,20,-42],[-92,20,-42],[-92,14,-67],[-109,14,-67]],.11,1.2);
  pipe([[ -109,27,-67],[-118,27,-67],[-118,19,-92],[-100,19,-92]],.075,.8);

  // Right power-switch yard: low, broad machinery with one tall bus tower.
  worldBox3D(100,-30,28,19,0,10,viewYaw,viewPitch,'rgba(1,8,8,.985)',.10);
  worldBox3D(112,-50,16,18,0,22,viewYaw,viewPitch,'rgba(1,8,8,.985)',.11);
  worldBox3D(97,-74,10,10,0,42,viewYaw,viewPitch,'rgba(1,8,8,.985)',.13);
  for(const y of [13,24,35])worldLine3D(92,y,-74,102,y,-74,viewYaw,viewPitch,'104,245,208',.12,.75)
  pipe([[112,16,-50],[124,16,-50],[124,10,-30],[114,10,-30]],.09,1.0);

  // Suspended cable bundles. They use long broken arcs between real support points.
  const cable=(x0,z0,x1,z1,y=18,sag=5,a=.050)=>{
    if(worldRec){recCurve(t=>[lerp(x0,x1,t),y-sag*Math.sin(t*Math.PI),lerp(z0,z1,t)],10,'93,226,194',a,.55)}
    let prev=null;if(!worldRec)for(let i=0;i<=10;i++){const t=i/10,x=lerp(x0,x1,t),z=lerp(z0,z1,t),yy=y-sag*Math.sin(t*Math.PI),p=project(x,yy,z,viewYaw,viewPitch);if(p&&prev){ctx.strokeStyle=`rgba(93,226,194,${a})`;ctx.lineWidth=.55;ctx.beginPath();ctx.moveTo(prev.x,prev.y);ctx.lineTo(p.x,p.y);ctx.stroke()}prev=p}
  };
  cable(-82,18,-42,-18,19,4.5,.055);cable(85,5,45,-22,20,4,.050);cable(-94,-75,-43,-96,24,5,.040);cable(96,-76,49,-100,27,6,.040);
  ctx.restore();
}

function enemyOccluded(e){return !!segmentHitsWorld(player.x,CAMERA_Y,player.z,e.x,aimY(e),e.z)}
function drawOccludedContact(e,viewYaw,viewPitch){if(e.marked<=0&&e.designated<=0)return;const p=project(e.x,3.0+eY(e),e.z,viewYaw,viewPitch);if(!p||p.x<-50||p.x>W+50||p.y<-50||p.y>H+50)return;ctx.save();const des=e.designated>0,r=des?18:13;ctx.translate(p.x,p.y);ctx.rotate(Math.PI/4);ctx.strokeStyle=des?'rgba(103,255,209,.62)':'rgba(255,99,89,.30)';ctx.shadowBlur=des?10:5;ctx.shadowColor=des?'#55ffd0':'#ff6359';ctx.setLineDash([4,5]);ctx.lineWidth=1;ctx.strokeRect(-r,-r,r*2,r*2);ctx.setLineDash([]);ctx.rotate(-Math.PI/4);ctx.font='8px Consolas';ctx.textAlign='center';ctx.fillStyle=des?'rgba(143,255,224,.78)':'rgba(255,126,111,.48)';ctx.fillText('OCCLUDED',0,-r-9);ctx.restore()}
function drawLancerCommit(viewYaw,viewPitch){
  ctx.save();ctx.setLineDash([5,7]);for(const e of enemies){if(!e.alive||e.type!=='LANCER'||e.lungeWindup<=0||enemyOccluded(e))continue;const len=.32,start=project(e.x,.08,e.z,viewYaw,viewPitch),end=project(e.x+e.lungeVX*len,.08,e.z+e.lungeVZ*len,viewYaw,viewPitch);if(!start||!end)continue;const k=1-clamp(e.lungeWindup/.42,0,1),pulse=.45+.55*Math.sin(gameTime*24);ctx.globalAlpha=.16+.30*k;ctx.strokeStyle='#ff956b';ctx.shadowBlur=6+7*pulse;ctx.shadowColor='#ff6f59';ctx.lineWidth=1.15;ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.lineTo(end.x,end.y);ctx.stroke();const dx=end.x-start.x,dy=end.y-start.y,l=Math.hypot(dx,dy)||1,nx=-dy/l,ny=dx/l;ctx.beginPath();ctx.moveTo(end.x+nx*8,end.y+ny*8);ctx.lineTo(end.x,end.y);ctx.lineTo(end.x-nx*8,end.y-ny*8);ctx.stroke();}ctx.setLineDash([]);ctx.globalAlpha=1;ctx.restore();
}
function drawHeavyAimLines(viewYaw,viewPitch){
  ctx.save();ctx.setLineDash([6,8]);
  for(const e of enemies){
    if(!e.alive||!e.heavy||e.charge<=0||!e.awake||enemyOccluded(e))continue;
    const committed=e.charge<=.18,aim=committed?e.committedAim:{x:player.x+player.vx*.18,z:player.z+player.vz*.18};
    if(!aim)continue;
    const p=projectSegment(e.x,3.15+eY(e),e.z,aim.x,CAMERA_Y,aim.z,viewYaw,viewPitch);if(!p||!p[0]||!p[1])continue;
    const c=1-clamp(e.charge/.62,0,1);ctx.globalAlpha=.18+.30*c;ctx.strokeStyle=committed?'#ff9a62':'#ff7862';
    ctx.shadowBlur=8;ctx.shadowColor=committed?'#ff6e4f':'#ff6359';ctx.lineWidth=committed?1.5:1;
    ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);ctx.lineTo(p[1].x,p[1].y);ctx.stroke();
  }
  ctx.restore();
}
function drawSightLinkCue(viewYaw,viewPitch){
  const linked=getSightLink();if(!linked)return;const e=linked.e,bx=enemyScreenBox(e,viewYaw,viewPitch);if(!bx)return;
  const xs=[bx.x0,bx.x1],ys=[bx.y0,bx.y1],x0=Math.min(...xs)-8,x1=Math.max(...xs)+8,cy=(Math.min(...ys)+Math.max(...ys))/2;
  ctx.save();ctx.strokeStyle='rgba(255,209,111,.88)';ctx.fillStyle='rgba(255,226,155,.82)';ctx.shadowBlur=8;ctx.shadowColor='#ffd16f';ctx.lineWidth=1.4;
  // LINK is a gun/HMD relationship, not a second target frame. Keep only two weapon-side witnesses.
  const l=14,g=5;ctx.beginPath();ctx.moveTo(x0-g-l,cy);ctx.lineTo(x0-g,cy);ctx.moveTo(x0-g,cy-5);ctx.lineTo(x0-g,cy+5);ctx.moveTo(x1+g,cy);ctx.lineTo(x1+g+l,cy);ctx.moveTo(x1+g,cy-5);ctx.lineTo(x1+g,cy+5);ctx.stroke();
  ctx.shadowBlur=3;ctx.font='7px Consolas';ctx.textAlign='left';ctx.fillText('LINK',x1+g+l+4,cy+3);ctx.restore();
}
function drawKillPulse(){if(player.killPulse<=0)return;const k=1-player.killPulse,rr=Math.min(W,H)*(.08+k*.36),a=player.killPulse;ctx.save();ctx.strokeStyle=`rgba(255,220,135,${.48*a})`;ctx.shadowBlur=18;ctx.shadowColor='#ffd16f';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(W/2,H*.49,rr,0,TAU);ctx.stroke();ctx.globalAlpha=.16*a;ctx.fillStyle='#fff0b5';ctx.fillRect(0,H*.49-1,W,2);ctx.restore()}
function drawWorld(viewYaw,viewPitch){worldRec=threeWorldOn()?{boxes:[],cyls:[],lines:[],dots:[],segsN:[],segsA:[],discsN:[],discsA:[],glows:[],quads:[],ground1:[],ground2:[],groundQ1:[],groundQ2:[],sky:null}:null;threeWorldFrame=false;bootFrame();drawSky(viewYaw,viewPitch);drawGround(viewYaw,viewPitch);bootRing();if(stage===3)drawSkydeck(viewYaw,viewPitch);else if(stage===2)drawTunnel(viewYaw,viewPitch);else drawDistantDistrict(viewYaw,viewPitch);if(stage===1){drawTrunkLine(viewYaw,viewPitch);drawFoundryMachines(viewYaw,viewPitch);drawGantries(viewYaw,viewPitch);drawStreetLights(viewYaw,viewPitch)}for(const e of enemies)if(e.alive)drawVectorEcho(e,viewYaw,viewPitch);const draw=[];for(const b of buildings){const dx=b.x-player.x,dz=b.z-player.z;draw.push({d:dx*dx+dz*dz,t:0,o:b})}for(const e of enemies)if(e.alive){const dx=e.x-player.x,dz=e.z-player.z;draw.push({d:dx*dx+dz*dz,t:1,o:e})}draw.sort((a,b)=>b.d-a.d);for(const x of draw){if(!x.t)drawBuilding(x.o,viewYaw,viewPitch);else if(bootK(x.o.x,x.o.z)&&(!enemyOccluded(x.o)||threeEnemy(x.o)))drawEnemy(x.o,viewYaw,viewPitch)}bootR=1e9;if(worldRec){drawBolts(viewYaw,viewPitch);drawWaves(viewYaw,viewPitch);drawShards(viewYaw,viewPitch);drawParticles(viewYaw,viewPitch);drawGroundRush(viewYaw,viewPitch)}flushThreeEnemies(viewYaw,viewPitch);for(const e of enemies)if(e.alive&&enemyOccluded(e))drawOccludedContact(e,viewYaw,viewPitch);drawLancerCommit(viewYaw,viewPitch);drawHeavyAimLines(viewYaw,viewPitch);drawThreatLanes(viewYaw,viewPitch);if(!threeWorldFrame){drawBolts(viewYaw,viewPitch);drawWaves(viewYaw,viewPitch);drawDebris(viewYaw,viewPitch);drawShards(viewYaw,viewPitch);drawParticles(viewYaw,viewPitch);drawGroundRush(viewYaw,viewPitch)}drawSpeedFX(Math.hypot(player.vx,player.vz));drawScanCue(visualContact,viewYaw,viewPitch);drawLeadCue(viewYaw,viewPitch);drawSightLinkCue(viewYaw,viewPitch);drawKillPulse();if((player.scope||0)<.6){drawCockpit(Math.hypot(player.vx,player.vz),viewYaw,viewPitch);drawGunSight(viewYaw,viewPitch)}else cockpit.muzzle=null;drawHmdBoresight();drawScope(viewYaw,viewPitch)}

// One primary attack and one light pressure attack may commit at a time.
function updateCombatDirector(){
  if(combat.nextWake<=gameTime){combat.nextWake=Infinity;wakeNearestCold()}
  const eligible=e=>e.alive&&e.awake&&e.type!=='KITE'&&Math.hypot(e.x-player.x,e.z-player.z)<115*reach(e);
  const primary=enemies.find(e=>e.id===combat.primaryId),pressure=enemies.find(e=>e.id===combat.pressureId);
  const committed=e=>e&&(e.firePending||e.lungeWindup>0||e.attackKind==='LANCE'&&e.dashT>0||e.recoverT>0);
  if(!primary||!primary.alive||(!committed(primary)&&(!eligible(primary)||gameTime>=combat.primaryHold||primary.blockedT>1.6))){
    let pool=enemies.filter(e=>eligible(e)&&e.type!=='SCOUT'&&e.blockedT<1.6);
    if(!pool.length)pool=enemies.filter(e=>eligible(e)&&e.blockedT<1.6);
    pool.sort((a,b)=>(gameTime-b.lastAttack)*5-Math.hypot(b.x-player.x,b.z-player.z)*.02-((gameTime-a.lastAttack)*5-Math.hypot(a.x-player.x,a.z-player.z)*.02));
    combat.primaryId=pool[0]?.id||0;combat.primaryHold=gameTime+2.6;
  }
  if(!pressure||!pressure.alive||pressure.id===combat.primaryId||(!committed(pressure)&&(!eligible(pressure)||gameTime>=combat.pressureHold||pressure.blockedT>1.6))){
    const pool=enemies.filter(e=>eligible(e)&&e.type==='SCOUT'&&e.id!==combat.primaryId&&e.blockedT<1.6);
    pool.sort((a,b)=>a.lastAttack-b.lastAttack);
    combat.pressureId=pool[0]?.id||0;combat.pressureHold=gameTime+2.4;
  }
}
// KITE flight. ORBIT: a wide circle high over the frame (radius ~80-110 m, 24-38 m up, so it sits
// 12-25 deg above the horizon, never overhead for long). DIVE: one aircraft at a time turns in, drops to
// ~13 m and fires two rounds when it is inside ~65 m with a clear line. CLIMB: it carries on over the
// frame and climbs away, then rejoins the circle. It steers like an aircraft: a capped turn rate, banking.
function updateKite(e,dt){
  if(e.alt==null)e.alt=Math.max(8,eY(e));if(!e.orbitDir)e.orbitDir=1;
  const F=e.fly||(e.fly={mode:'orbit',ang:Math.atan2(e.x-player.x,-(e.z-player.z)),t:0,fired:0,second:0}),dx=player.x-e.x,dz=player.z-e.z,hd=Math.hypot(dx,dz)||1,quiet=!player.alive||missionClear;
  let tx,ty,tz;
  if(F.mode==='orbit'){
    F.ang+=e.orbitDir*(e.speed/e.desired)*dt;const R=e.desired+Math.sin(gameTime*.3+e.phase)*12;tx=player.x+Math.sin(F.ang)*R;tz=player.z-Math.cos(F.ang)*R;ty=e.alt;
    const diving=enemies.some(o=>o!==e&&o.alive&&o.fly&&o.fly.mode==='dive');
    if(!quiet&&gameTime>=e.nextAttack&&gameTime>=(combat.airGate||0)&&!diving&&hd<150){F.mode='dive';F.t=0;F.fired=0;e.lastAttack=gameTime;e.marked=Math.max(e.marked,2.2);sfx.contact(e);plog('Caution',`-Attack run. ${etag(e)}`)}
  }
  if(F.mode==='dive'){
    tx=player.x+player.vx*.5;tz=player.z+player.vz*.5;ty=13;F.t+=dt;
    if(!quiet&&!F.fired&&hd<65&&e.y<26&&!segmentHitsWorld(e.x,e.y,e.z,player.x,CAMERA_Y,player.z)){enemyShoot(e,{x:player.x+player.vx*.12,z:player.z+player.vz*.12});F.fired=1;F.second=.24}
    if(F.second>0){F.second-=dt;if(F.second<=0&&!quiet)enemyShoot(e)}
    if(hd<14||F.t>7.5||quiet){F.mode='climb';F.t=0}
  }
  if(F.mode==='climb'){
    const h=forward(e.yaw);tx=e.x+h.x*80;tz=e.z+h.z*80;ty=e.alt+6;F.t+=dt;
    if(F.t>3.4){F.mode='orbit';F.ang=Math.atan2(e.x-player.x,-(e.z-player.z));e.nextAttack=gameTime+e.fireRate+hash(e.id+Math.floor(gameTime))*2.5;combat.airGate=gameTime+1.4}
  }
  const want=Math.atan2(tx-e.x,-(tz-e.z)),rate=F.mode==='dive'?1.15:.85,turn=clamp(angleDiff(want,e.yaw),-rate*dt,rate*dt);
  e.yaw+=turn;e.turn=lerp(e.turn||0,clamp(turn/Math.max(dt,1e-4)/rate,-1,1),1-Math.exp(-4*dt));
  const sp=e.speed*(F.mode==='dive'?1.3:1),f=forward(e.yaw),vy=clamp((ty-e.y)*.9,-15,10);
  e.x+=f.x*sp*dt;e.z+=f.z*sp*dt;e.y=Math.max(8,e.y+vy*dt);e.climbK=vy/Math.max(sp,1);e.vx=f.x*sp;e.vz=f.z*sp;
  updateEnemyAnim(e,dt);
  if((e.marked>0||e.designated>0)&&e.trailTick<=0){e.trailTick=.075;e.trail.push({x:e.x,y:2.7+eY(e),z:e.z,life:.65});if(e.trail.length>9)e.trail.shift()}
}
function finishEnemyAttack(e){
  e.recoverT=e.type==='TITAN'?1.4:e.heavy?.85:e.type==='LANCER'?.75:.38;
  e.nextAttack=gameTime+e.fireRate+hash(e.id+Math.floor(gameTime))*.35;
  e.attackKind='';e.committedAim=null;e.firePending=false;e.charge=0;
  if(e.id===combat.primaryId)combat.primaryGate=gameTime+.28;
  if(e.id===combat.pressureId)combat.pressureGate=gameTime+.65;
}
function updateEnemies(dt){
  for(const e of enemies){
    e.px=e.x;e.pz=e.z;
    for(const name of ['flash','muzzle','stun','dashCd','lungeCd','marked','wakeT','breakFlash','recoverT','hitT'])e[name]=Math.max(0,(e[name]||0)-dt);
    e.stagger=Math.max(0,(e.stagger||0)-18*dt);
    e.lean=lerp(e.lean,0,1-Math.exp(-7*dt));e.trailTick-=dt;
    for(const t of e.trail)t.life-=dt;e.trail=e.trail.filter(t=>t.life>0);
    if(e.marked<=0&&e.designated<=0)e.markLatch=false;
    if(!e.alive)continue;
    const wear=1-e.hp/e.maxHp;if(wear>.42&&Math.random()<dt*wear*7){const w=randomEnemyPoint(e);sparks(w.x,w.y,w.z,3+Math.floor(wear*5),wear>.7?'#ffd58a':CLASS_STYLE[e.type].edge,5)}
    const dist=Math.hypot(e.x-player.x,e.z-player.z),los=!segmentHitsWorld(e.x,losY(e),e.z,player.x,CAMERA_Y,player.z);
    e.blockedT=los?0:e.blockedT+dt;
    if(!e.awake&&dist<36&&los)wakeEnemy(e,'PROXIMITY CONTACT');
  }
  updateCombatDirector();updateEndurance(dt);
  for(const e of enemies){
    if(!e.alive){e.vx=e.vz=0;continue}
    if(e.type==='KITE'){updateKite(e,dt);continue}
    const dx=player.x-e.x,dz=player.z-e.z,dist=Math.hypot(dx,dz)||1,los=!segmentHitsWorld(e.x,losY(e),e.z,player.x,CAMERA_Y,player.z);
    e.yaw=Math.atan2(dx,-dz);
    if(!player.alive||missionClear||!e.awake||e.wakeT>0||e.stun>0){e.vx=e.vz=0;continue}
    if(e.recoverT>0){e.vx=e.vz=0;continue}
    if(e.lungeWindup>0){
      e.lungeWindup=Math.max(0,e.lungeWindup-dt);e.vx=e.vz=0;e.lean=-e.strafe*.18;
      if(e.lungeWindup<=0){e.dashVX=e.lungeVX;e.dashVZ=e.lungeVZ;e.dashT=.30;e.dashPuffTime=0;sfx.enemyDash(e)}
      continue;
    }
    if(e.firePending){
      const before=e.charge;e.charge=Math.max(0,e.charge-dt);e.vx=e.vz=0;
      if(e.heavy&&before>.18&&e.charge<=.18)e.committedAim={x:player.x+player.vx*.18,z:player.z+player.vz*.18};
      if(e.charge<=0){
        const aim=e.committedAim;
        if(aim&&!segmentHitsWorld(e.x,3.15+eY(e),e.z,aim.x,CAMERA_Y,aim.z))enemyShoot(e,aim);
        finishEnemyAttack(e);
      }
      continue;
    }
    if(e.dashT>0){
      const step=Math.min(dt,e.dashT);e.dashT=Math.max(0,e.dashT-dt);moveEnemy(e,e.dashVX*step,e.dashVZ*step);
      e.dashPuffTime-=dt;if(e.dashPuffTime<=0){e.dashPuffTime+=1/30;puff(e.x,.12,e.z,1,'#c35b50',2)}
      if(e.dashT<=0&&e.attackKind==='LANCE'){
        const aim=e.committedAim;if(aim&&!segmentHitsWorld(e.x,3.15+eY(e),e.z,aim.x,CAMERA_Y,aim.z))enemyShoot(e,aim);
        finishEnemyAttack(e);
      }
    }else{
      let mx,mz;
      if(e.type==='SCOUT'){
        const bearing=player.yaw+e.flankSide*.82,radius=e.desired+Math.sin(gameTime*.55+e.phase)*4;
        const tx=player.x+Math.sin(bearing)*radius,tz=player.z-Math.cos(bearing)*radius;
        mx=tx-e.x;mz=tz-e.z;const n=Math.hypot(mx,mz);if(n>1){mx/=n;mz/=n}else{mx=0;mz=0}
      }else{
        const desired=e.desired+Math.sin(gameTime*.55+e.phase)*5,radial=clamp((dist-desired)/18,-1,1),side=e.strafe*(los?.32:.45);
        mx=dx/dist*radial+dz/dist*side;mz=dz/dist*radial-dx/dist*side;
        const n=Math.hypot(mx,mz)||1;mx/=n;mz/=n;
      }
      moveEnemy(e,mx*e.speed*dt,mz*e.speed*dt);
      const primary=e.id===combat.primaryId,pressure=e.id===combat.pressureId;
      const gate=primary?combat.primaryGate:combat.pressureGate;
      if((primary||pressure)&&los&&dist<(e.type==='TITAN'?110:96)&&gameTime>=e.nextAttack&&gameTime>=gate){
        e.lastAttack=gameTime;
        if(e.type==='LANCER'&&dist>16&&dist<70){
          const ux=dx/dist,uz=dz/dist,sx=uz*e.strafe,sz=-ux*e.strafe;
          e.lungeVX=(sx*.70+ux*.50)*34;e.lungeVZ=(sz*.70+uz*.50)*34;e.lungeWindup=.42;e.attackKind='LANCE';e.dashCd=1.2;
          e.committedAim={x:player.x+player.vx*.12,z:player.z+player.vz*.12};sfx.lancerCue(e);
          plog('Caution',`-Lance commit. ${etag(e)}`);say('LANCE');
        }else{
          e.chargeDuration=e.type==='TITAN'?.95:e.heavy?.62:.24;e.charge=e.chargeDuration;e.firePending=true;e.attackKind='SHOT';
          e.committedAim={x:player.x+player.vx*.06,z:player.z+player.vz*.06};
          if(e.heavy){sfx.heavyCharge(e,e.chargeDuration);say('HEAVY_CHARGE')}else{e.marked=Math.max(e.marked,1.8);sfx.contact(e)}
        }
      }else if(e.type==='SCOUT'&&los&&e.dashCd<=0&&dist<24){enemyDash(e,dx,dz,dist)}
    }
    const k=1-Math.exp(-36*dt);e.vx=lerp(e.vx||0,(e.x-e.px)/dt,k);e.vz=lerp(e.vz||0,(e.z-e.pz)/dt,k);
    updateEnemyAnim(e,dt);
    if((e.marked>0||e.designated>0)&&e.trailTick<=0){e.trailTick=.075;e.trail.push({x:e.x,y:2.7+eY(e),z:e.z,life:.65});if(e.trail.length>9)e.trail.shift()}
  }
}

// ---------- UPDATE ----------
function downPlayer(){player.alive=false;plog('Warning','Frame lost.');pilotCut('down');say('DOWN');player.vx=player.vz=0;player.boostTime=player.glideTime=0;mouseButtons.clear();sfx.down();lightBurst(player.x,CAMERA_Y-1,player.z,'#ff6359',14,.6);setTimeout(()=>{if(!player.alive)showResult('FRAME DOWN')},700)}
function fmtTime(t){return String(Math.floor(t/60)).padStart(2,'0')+':'+String(Math.floor(t%60)).padStart(2,'0')}
function showResult(title){const r=$('result');if(!r)return;if(!title){r.classList.add('hidden');return}
  const acc=stats.shots?Math.round(stats.hits/stats.shots*100):0,down=/^FRAME DOWN/.test(title);let rows,sector;
  if(mode==='endurance'){const b=endure.best,rec=!b||stats.kills>b.kills||stats.kills===b.kills&&missionTime>b.time;
    if(rec&&down){endure.best={kills:stats.kills,time:missionTime,level:endure.level};try{localStorage.setItem('hf.endure.best',JSON.stringify(endure.best))}catch{}}
    sector='ENDURANCE';
    rows=[['BREAK',stats.kills+(rec&&down?'<em>NEW RECORD</em>':'')],['TIME',fmtTime(missionTime)],['THREAT LEVEL',endure.level],['ACCURACY',acc+'%'],['MAX CHAIN',stats.maxChain],
      ['BEST',endure.best?endure.best.kills+' / '+fmtTime(endure.best.time):'-']]}
  else if(title==='OPERATION COMPLETE'){sector='ALL SECTORS CLEAR';const C=[1,2,3].map(n=>campaign[n]);
    rows=[...C.map((c,i)=>[SECTORS[i+1].tag+' '+SECTORS[i+1].name,c?fmtTime(c.time):'-']),['TOTAL TIME',C.every(Boolean)?fmtTime(C.reduce((t,c)=>t+c.time,0)):'-'],['TOTAL BREAK',C.reduce((n,c)=>n+(c?c.kills:0),0)]]}
  else{sector=SECTORS[stage].tag+' '+SECTORS[stage].name;
    rows=[['TIME',fmtTime(missionTime)],['BREAK',stats.kills+' / '+enemies.length],['ACCURACY',acc+'%'],['MAX CHAIN',stats.maxChain],['HMD DESIGNATIONS',stats.designations],['DAMAGE TAKEN',Math.round(stats.damage)]]}
  $('resultSector').textContent=sector;$('resultTitle').textContent=title;
  // Choices are buttons: the pointer lock is released so the cursor can pick one (Enter / R / ESC still work).
  const next=mode==='sortie'&&!down&&stage<LAST_SECTOR;const fin=title==='OPERATION COMPLETE';$('resultKeys').innerHTML=fin?'<button class="go" data-act="restart">FROM SECTOR 01</button><button data-act="menu">MENU</button>':(next?'<button class="go" data-act="next">NEXT SECTOR</button>':'')+'<button data-act="again">REDEPLOY</button><button data-act="menu">MENU</button>';r.classList.toggle('final',fin);
  if(typeof document!=='undefined'&&document.pointerLockElement)document.exitPointerLock?.();
  // Rebuilt every time, so the rows run their arrival again.
  $('resultStats').innerHTML=rows.map(([k,v],i)=>`<div style="--i:${i}"><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  r.classList.toggle('down',down);r.classList.add('hidden');void r.offsetWidth;r.classList.remove('hidden')}
// Bodies are solid: the frame cannot walk through hostiles and hostiles do not stack.
// A BURST into a hostile is a shoulder check: it staggers the target instead of clipping through it.
function resolveBodies(){
  for(const e of enemies){if(!e.alive||eY(e)>3)continue;const dx=player.x-e.x,dz=player.z-e.z,d=Math.hypot(dx,dz),min=1.3+RIGS[e.type].body;
    if(d>=min||d<1e-4)continue;const nx=dx/d,nz=dz/d,vn=player.vx*nx+player.vz*nz;movePlayer(nx*(min-d),nz*(min-d));
    if(vn<0){player.vx-=nx*vn;player.vz-=nz*vn;if(vn<-17&&player.impactCd<=0&&player.alive){player.impactCd=.35;player.shake=Math.max(player.shake,.75);player.fovKick=Math.max(player.fovKick,.3);sfx.impact();if(!e.awake)wakeEnemy(e,'CONTACT');staggerEnemy(e,40);sparks(e.x-nx*1.2,2.0,e.z-nz*1.2,18,'#ffe28c',10);plog('Info',`-Shoulder check. ${etag(e)}`);say('RAM')}}}
  for(let i=0;i<enemies.length;i++){const a=enemies[i];if(!a.alive||eY(a)>3)continue;for(let j=i+1;j<enemies.length;j++){const b=enemies[j];if(!b.alive||eY(b)>3)continue;
    const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),min=(RIGS[a.type].body+RIGS[b.type].body)*.8;if(d>=min||d<1e-4)continue;const p=(min-d)/2;moveEnemy(a,-dx/d*p,-dz/d*p);moveEnemy(b,dx/d*p,dz/d*p)}}
}
function update(dt){
  if(!(dt>0))return; // a zero-length frame would divide 0/0 in velocity estimates
  if(mouseButtons.has(0))fire();
  player.boostCool=Math.max(0,player.boostCool-dt);player.impactCd=Math.max(0,player.impactCd-dt);inboundCooldown=Math.max(0,inboundCooldown-dt);player.hitDirT=Math.max(0,player.hitDirT-dt);player.regenDelay=Math.max(0,player.regenDelay-dt);player.missileCd=Math.max(0,player.missileCd-dt);const hadSync=player.syncTime>0;player.syncTime=Math.max(0,player.syncTime-dt);if(hadSync&&player.syncTime<=0)player.syncChain=0;player.heat=Math.max(0,player.heat-(player.vent?58:player.syncTime>0?42:27)*dt);if(player.vent&&player.heat<=32){player.vent=false;sfx.vented();cockpit.flashW=.55;plog('Info','HALBERD cooled. Weapons free.');say('COOLED')}player.absorb=Math.max(0,player.absorb-dt*1.6);syncMix=lerp(syncMix,player.syncTime>0?1:0,1-Math.exp(-(player.syncTime>0?5:2.2)*dt));while(killWaves.length&&gameTime-killWaves[0].t>1.7)killWaves.shift();if(player.alive&&!missionClear)missionTime+=dt;if(player.regenDelay<=0)player.boost=Math.min(100,player.boost+(player.syncTime>0?32:20)*dt);if(player.syncTime<=0)player.flow=Math.max(0,player.flow-dt*1.8);player.fovKick*=Math.exp(-7*dt);player.gunKick*=Math.exp(-18*dt);player.shake*=Math.exp(-8*dt);player.roll*=Math.exp(-6*dt);player.killPulse=Math.max(0,player.killPulse-dt*2.8);player.hitMarkT=Math.max(0,(player.hitMarkT||0)-dt);if(player.comboT>0){player.comboT-=dt;if(player.comboT<=0)player.combo=0}
  player.px=player.x;player.pz=player.z;
  updateJump(dt);
  const d=inputDir();let speed=Math.hypot(player.vx,player.vz);
  const boostedThisStep=player.boostTime>0,airborne=player.jy>0;
  if(player.alive&&!missionClear&&!boostedThisStep){
    const moving=Math.abs(d.sx)+Math.abs(d.sz)>.05;
    const targetSpeed=(d.sz<-.25?13.5:Math.abs(d.sx)>.35?16.5:19.5)*(player.syncTime>0?1.12:1)*(player.swing?.45:1);
    const braking=moving&&speed>1&&(player.vx*d.x+player.vz*d.z)/speed<-.25;
    // Motor torque: strong off the line, tapering toward top speed (braking and coasting unchanged).
    const accel=moving&&!braking&&speed<targetSpeed,rate=braking?10.5:player.glideTime>0?(moving?3.8:3.2):accel?clamp(13*(1-.75*speed/targetSpeed),3.2,13):moving?8.5:7.0;
    const k=1-Math.exp(-rate*(airborne?JUMP.air:1)*dt);player.vx=lerp(player.vx,d.x*targetSpeed,k);player.vz=lerp(player.vz,d.z*targetSpeed,k);
    player.glideTime=Math.max(0,player.glideTime-dt);
  }
  if(boostedThisStep){
    if(player.dashSpin>0){player.dashSpin-=dt;if(player.dashSpin<=0){player.dashSpin=0;dashBite()}}
    if(player.dashJet){player.vx=player.dashJet[0];player.vz=player.dashJet[1]}
    player.boostTime=Math.max(0,player.boostTime-dt);
    if(player.boostTime===0){player.glideTime=player.dashSlide?.4:.24;player.dashJet=null}
    player.boostTrailClock-=dt;
    while(player.boostTrailClock<=0){
      player.boostTrailClock+=1/60;
      for(let i=0;i<3;i++)particles.push({x:player.x+(Math.random()-.5)*1.7,y:.15,z:player.z+(Math.random()-.5)*1.7,px:player.x,py:.1,pz:player.z,vx:-player.vx*.16+(Math.random()-.5)*3,vy:.3+Math.random(),vz:-player.vz*.16+(Math.random()-.5)*3,life:.18+Math.random()*.18,max:.36,color:'#c8b89d',size:.2+Math.random()*.65});
    }
  }
  speed=Math.hypot(player.vx,player.vz);
  const max=player.syncTime>0?69:62;if(speed>max){player.vx*=max/speed;player.vz*=max/speed;speed=max}
  const hitWall=movePlayer(player.vx*dt,player.vz*dt);resolveBodies();
  if(hitWall&&(boostedThisStep||player.glideTime>0)&&player.impactCd<=0){
    player.boostTime=0;player.glideTime=0;player.impactCd=.28;player.shake=Math.max(player.shake,1.05);player.fovKick=Math.max(player.fovKick,.34);
    player.hp=Math.max(0,player.hp-3);player.vx*=-.12;player.vz*=-.12;player.hitDir=player.yaw;player.hitDirT=.34;
    flash('damageFlash',80);cockpitHit(player.yaw,3);sfx.impact();plog('Caution','Frame impact.',2);pilotReact('grit',.7,2);if(player.hp<=0)downPlayer();
  }
  const ax=(player.vx-player.prevVx)/Math.max(dt,.001),az=(player.vz-player.prevVz)/Math.max(dt,.001),rf=right(player.yaw),ff=forward(player.yaw);
  const latA=ax*rf.x+az*rf.z,fwdA=ax*ff.x+az*ff.z;
  player.inertiaRoll=lerp(player.inertiaRoll,clamp(-latA*.00135,-.045,.045),1-Math.exp(-9*dt));
  // Suspension: the nose dips when braking and squats back on throttle, on a spring with a little rebound.
  {const target=clamp(-fwdA*.0008,-.03,.03);player.suspV+=(90*(target-player.inertiaPitch)-11*player.suspV)*dt;player.inertiaPitch+=player.suspV*dt}player.prevVx=player.vx;player.prevVz=player.vz;
  // Mouse commands the weapon gimbal. Chassis catches up slowly; camera does not snap to the mouse.
  player.aimYawTarget=clamp(player.aimYawTarget,-.62,.62);player.aimPitchTarget=clamp(player.aimPitchTarget,-.46,.56);
  const yawStep=(player.syncTime>0?3.10:2.65)*dt,yd=player.aimYawTarget-player.torso;player.torso+=clamp(yd,-yawStep,yawStep);
  const pitchStep=(player.syncTime>0?3.20:2.80)*dt,pd=player.aimPitchTarget-player.pitch;player.pitch+=clamp(pd,-pitchStep,pitchStep);
  const soft=.24,desiredTurn=Math.abs(player.aimYawTarget)>soft?clamp(Math.sign(player.aimYawTarget)*(Math.abs(player.aimYawTarget)-soft)*2.35,-.92,.92):0;
  const angularAccel=Math.abs(desiredTurn)>Math.abs(player.yawVelocity)?2.6:4.2;player.yawVelocity+=clamp(desiredTurn-player.yawVelocity,-angularAccel*dt,angularAccel*dt);
  const turn=player.yawVelocity*dt;player.yaw+=turn;player.aimYawTarget-=turn;player.torso-=turn;
  player.torso=clamp(player.torso,-.58,.58);player.pitch=clamp(player.pitch,-.46,.56);
  {const want=player.alive&&!missionClear&&player.scopeOn&&cockpit.shown==='ARBALEST'&&cockpit.swapT<=0?1:0;player.scope=(player.scope||0)+(want-(player.scope||0))*(1-Math.exp(-(want?10:14)*dt));if(player.scope<.002)player.scope=0}
  // The view follows a third of the gun's pitch, and more once the gun is raised past ~10 deg, so a KITE
  // high in the sky stays on screen while the gun is on it. Height is the mouse's job, not the head's.
  player.camPitch=lerp(player.camPitch,player.pitch*.34+Math.max(0,player.pitch-.18)*.55,1-Math.exp(-5.5*dt));
  // The frame rolls on the wheels at its feet (key art): no footfalls, no stride. Its weight is in the
  // suspension instead (the spring pitch below, the lean in turns) and in the landing after a jump.
  // Deck joints: the deck is laid in 6 m x 5.83 m panels. Each time the wheels cross a joint the front
  // pair knocks and the rear pair follows a wheelbase later (2.4 m), with a small jolt. The spacing comes
  // from the speed, so it never settles into a beat.
  if(player.jy<=0&&speed>2.5&&player.alive){const jz=Math.floor(player.z/6),jx=Math.floor((player.x+17.5)/5.83);
    if(player.jointZ!=null&&(jz!==player.jointZ||jx!==player.jointX)){const k=clamp(speed/30,.35,1.3);sfx.joint(k);cockpit.heaveV-=.35*k;wheelKnock.push(gameTime+2.4/speed)}
    player.jointZ=jz;player.jointX=jx}else{player.jointZ=player.jointX=null}
  for(let i=wheelKnock.length-1;i>=0;i--)if(gameTime>=wheelKnock[i]){wheelKnock.splice(i,1);const k=clamp(speed/30,.35,1.3)*.8;sfx.joint(k);cockpit.heaveV-=.25*k}
  // Scrub: sideways acceleration of the velocity (a change of direction) plus the chassis turning while it rolls.
  {const ax=(player.vx-player.prevVx)/Math.max(dt,1e-3),az=(player.vz-player.prevVz)/Math.max(dt,1e-3),l=speed||1,lat=Math.abs(ax*(-player.vz/l)+az*(player.vx/l));
    player.scrub=lerp(player.scrub||0,speed>3&&player.boostTime<=0?clamp(lat/55+Math.abs(player.yawVelocity)*speed/40,0,1):0,1-Math.exp(-dt*12))}
  updateEngine(speed,player.boostTime>0,player.syncTime>0,player.yawVelocity,player.aimYawTarget-player.torso,player.jy<=0&&(speed>.55||player.boostTime>0||player.glideTime>0),player.scrub);
  {let awakeN=0,committed=false;for(const e of enemies)if(e.alive&&e.awake){awakeN++;if(e.firePending||e.lungeWindup>0)committed=true}music.target=!player.alive?0:missionClear?.1:clamp(.2+awakeN*.16+(committed?.12:0)+(player.syncTime>0?.6:0),0,1)}
  updateCockpit(dt);
  updateVisualDesignation(dt);
  updateEnemies(dt);
  // player cannon bolts
  for(const b of playerBolts){
    b.px=b.x;b.py=b.y;b.pz=b.z;
    const nx=b.x+b.vx*dt,ny=b.y+b.vy*dt,nz=b.z+b.vz*dt;
    b.life-=dt;let impact=worldImpact(b.x,b.y,b.z,nx,ny,nz);
    for(const e of enemies){
      if(!e.alive)continue;
      const t=enemyHitT(e,b.x,b.y,b.z,nx,ny,nz);
      if(t!==null&&(!impact||t<impact.t))impact={t,e};
    }
    if(!impact){b.x=nx;b.y=ny;b.z=nz;continue}
    placeImpact(b,nx,ny,nz,impact.t);b.life=0;
    if(impact.b){sparks(b.x,b.y,b.z,7,'#8fffe0',6,'#e8fff8');shockwave(b.x,b.y,b.z,'#8fffe0',1.2,.18);continue}
    const e=impact.e;if(!e.awake)wakeEnemy(e,'IMPACT CONTACT');
    // FLAIL pellets lose their bite with the distance they have flown; one hit mark per shell.
    const dmg=b.pellet?b.damage*clamp(1-(Math.hypot(b.x-b.ox,b.z-b.oz)-FLAIL.near)/(FLAIL.far-FLAIL.near)*.67,.33,1):b.damage;
    e.hp-=dmg;e.flash=.10;e.hitPoint={x:b.x,y:b.y,z:b.z};e.hitT=.12;if(e.hp>0)chipArmor(e);
    const syncHit=b.syncId===e.id;stats.hits++;staggerEnemy(e,dmg+(syncHit?9:0));if(!b.shot||!b.shot.hit){if(b.shot)b.shot.hit=true;hitMark(worldPan(e.x,e.z))}
    sparks(b.x,b.y,b.z,syncHit?16:11,syncHit?'#ffe08a':'#ffc467',syncHit?11:8.5);sparks(b.x,b.y,b.z,4,CLASS_STYLE[e.type].edge,6);shockwave(b.x,b.y,b.z,syncHit?'#ffe08a':'#ffd7a0',syncHit?2.2:1.5,.16);
    if(syncHit){player.heat=Math.max(0,player.heat-1.5);addFlow(player.syncTime>0?4:8);e.breakFlash=Math.max(e.breakFlash,.16)}
    if(e.hp<=0)killEnemy(e,syncHit?'SIGHT LINK':b.pellet?'FLAIL':'CANNON');
  }
  for(let i=playerBolts.length-1;i>=0;i--)if(playerBolts[i].life<=0||Math.abs(playerBolts[i].x)>WORLD*1.4||Math.abs(playerBolts[i].z)>WORLD*1.4)playerBolts.splice(i,1);
  // missiles
  for(const m of missiles){
    m.life-=dt;m.trail-=dt;m.hist.push({x:m.x,y:m.y,z:m.z});if(m.hist.length>22)m.hist.shift();
    if(!m.target?.alive&&!m.retargeted){m.retargeted=true;let best=null,bd=48;for(const e of enemies){if(!e.alive||!e.awake)continue;const d=Math.hypot(e.x-m.x,e.z-m.z);if(d<bd&&(e.x-m.x)*m.vx+(e.z-m.z)*m.vz>0){bd=d;best=e}}if(best)m.target=best}
    if(m.target?.alive){const dx=m.target.x-m.x,dy=RIGS[m.target.type].hit.cy+eY(m.target)-m.y,dz=m.target.z-m.z,dist=Math.hypot(dx,dy,dz)||1,k=1-Math.exp(-5*dt);m.vx=lerp(m.vx,dx/dist*48,k);m.vy=lerp(m.vy,dy/dist*48,k);m.vz=lerp(m.vz,dz/dist*48,k)}
    const nx=m.x+m.vx*dt,ny=m.y+m.vy*dt,nz=m.z+m.vz*dt;
    let impact=worldImpact(m.x,m.y,m.z,nx,ny,nz);
    if(m.target?.alive){const t=enemyHitT(m.target,m.x,m.y,m.z,nx,ny,nz,.35);if(t!==null&&(!impact||t<impact.t))impact={t,e:m.target}}
    if(impact){
      placeImpact(m,nx,ny,nz,impact.t);m.life=0;
      if(impact.e){const e=impact.e;if(!e.awake)wakeEnemy(e,'IMPACT CONTACT');e.hp-=62;e.flash=.18;e.hitPoint={x:m.x,y:m.y,z:m.z};e.hitT=.14;if(e.hp>0)chipArmor(e);staggerEnemy(e,54);explode(e.x,2.8+eY(e),e.z,false);if(e.hp<=0)killEnemy(e,'MISSILE')}
      else explode(m.x,m.y,m.z,false);
    }else{m.x=nx;m.y=ny;m.z=nz}
    if(m.life>0&&m.trail<=0){m.trail=.03;particles.push({x:m.x,y:m.y,z:m.z,px:m.x,py:m.y,pz:m.z,vx:(Math.random()-.5)*1.5,vy:.3,vz:(Math.random()-.5)*1.5,life:.28,max:.28,color:'#ffd16f',size:.3,g:0})}
  }
  for(let i=missiles.length-1;i>=0;i--)if(missiles[i].life<=0)missiles.splice(i,1);
  updateRockets(dt);updateSwing(dt);
  // hostile bolts
  for(const b of enemyBolts){
    b.px=b.x;b.py=b.y;b.pz=b.z;
    const q=threatMetric(b);if(q.t>.025&&q.d<1.8&&b.life>q.t)b.threatened=true;
    const nx=b.x+b.vx*dt,ny=b.y+b.vy*dt,nz=b.z+b.vz*dt;
    let impact=worldImpact(b.x,b.y,b.z,nx,ny,nz);
    const t=player.alive?sweepCylinder(b.x,b.y,b.z,nx,ny,nz,player,1.55,CAMERA_Y,1.55):null;
    if(t!==null&&(!impact||t<impact.t))impact={t,player:true};
    b.life-=dt;
    if(impact){
      placeImpact(b,nx,ny,nz,impact.t);b.life=0;b.evadeCandidate=false;
      if(impact.b){sparks(b.x,b.y,b.z,6,'#ff7a5c',5);continue}
      player.hp=Math.max(0,player.hp-(b.damage||7));player.hitDir=Math.atan2(b.px-player.x,-(b.pz-player.z));player.hitDirT=.72;
      stats.damage+=b.damage||7;cockpitHit(Math.atan2(b.px-player.x,-(b.pz-player.z)),b.damage||7);flash('damageFlash',125);sfx.damage();player.shake=.72;
      if(player.hp<30)plog('Warning','Frame integrity critical.',5);pilotReact(player.hp<30?'shout':'grit',.9,3);if(player.hp>0){if(player.hp<30&&!pilot.critLatch){pilot.critLatch=true;pilotBanner('!FRAME CRITICAL!','- 装甲危険域 -','#ff7a5c',1.6);say('CRITICAL')}else say('HIT')}if(player.hp<=0)downPlayer();
      continue;
    }
    b.x=nx;b.y=ny;b.z=nz;
    const pass=closestPlayerPass(b),nearD=Math.hypot(b.x-player.x,b.z-player.z);
    if(!b.near&&pass.d<5.2&&Math.abs(pass.y-CAMERA_Y)<2.8){
      b.near=true;player.shake=Math.max(player.shake,.10);sfx.nearMiss(worldPan(b.x,b.z));
      b.evadeCandidate=b.threatened&&(boostedThisStep||player.glideTime>0||player.jy>.6);
    }
    const receding=(b.x-player.x)*(b.vx-player.vx)+(b.z-player.z)*(b.vz-player.vz)>0;
    if(b.evadeCandidate&&nearD>5.2&&receding&&b.life>0&&player.alive){
      b.evadeCandidate=false;player.boost=Math.min(100,player.boost+8);addFlow(15,'VECTOR EVADE');plog('Info','-Vector evade. Boost +8.');pilotReact('smile',.8,1);say('EVADE');sfx.evade();
    }
  }
  let inbound=false;for(const b of enemyBolts){const q=threatMetric(b);if(q.t>.04&&q.t<.60&&q.d<4.2&&b.life>q.t&&!segmentHitsWorld(b.x,b.y,b.z,b.x+b.vx*q.t,b.y+b.vy*q.t,b.z+b.vz*q.t)){inbound=true;break}}if(inbound&&inboundCooldown<=0){inboundCooldown=.58;plog('Caution','Inbound vector.',6);say('INBOUND');sfx.inbound()}for(let i=enemyBolts.length-1;i>=0;i--)if(enemyBolts[i].life<=0)enemyBolts.splice(i,1);
  updateEffects(dt);
}
function updateEffects(dt){
  for(const p of particles){
    p.px=p.x;p.py=p.y;p.pz=p.z;
    if(p.kind==='mote'){
      // Data motes drift, then home into the frame and are absorbed (Rez-style collection).
      p.age+=dt;const drag=Math.exp(-2.4*dt);p.vx*=drag;p.vy*=drag;p.vz*=drag;
      if(p.age>p.home&&player.alive){const dx=player.x-p.x,dy=CAMERA_Y-1.15-p.y,dz=player.z-p.z,d=Math.hypot(dx,dy,dz)||1,sp=26+(p.age-p.home)*70,k=1-Math.exp(-6*dt);
        p.vx=lerp(p.vx,dx/d*sp,k);p.vy=lerp(p.vy,dy/d*sp,k);p.vz=lerp(p.vz,dz/d*sp,k);if(d<2.4){p.life=0;absorbMote();continue}}
      else p.vy+=.5*dt;
    }else p.vy-=(p.g??8)*dt;
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.life-=dt;
    if(p.y<.03&&p.kind!=='mote'&&!p.ring){p.y=.03;p.vy*=-.32;p.vx*=.55;p.vz*=.55}
  }
  for(let i=particles.length-1;i>=0;i--)if(particles[i].life<=0)particles.splice(i,1);
  if(particles.length>2600)particles.splice(0,particles.length-2600);
  for(const d of debris){d.age+=dt;d.vy-=6*dt;d.c[0]+=d.vx*dt;d.c[1]+=d.vy*dt;d.c[2]+=d.vz*dt;if(d.c[1]<.25){if(d.vy<-2.5&&d.lands<2){d.lands++;debrisSound('land',d.c[0],d.c[2],(pan,g)=>sfx.debrisLand(pan,g,d.size,d.mat,-d.vy))}d.c[1]=.25;d.vy*=-.35;d.vx*=.6;d.vz*=.6;d.w=d.w.map(v=>v*.6)}d.D=M3.mul(M3.rot(d.w[0]*dt,d.w[1]*dt,d.w[2]*dt),d.D);if(d.age>=d.life)burnDebris(d)}
  for(let i=debris.length-1;i>=0;i--)if(debris[i].age>=debris[i].life)debris.splice(i,1);
  for(const s of shards){s.age+=dt;const drag=Math.exp(-1.2*dt);s.vx*=drag;s.vz*=drag;s.vy-=6*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.z+=s.vz*dt;if(s.y<.06){s.y=.06;s.vy*=-.3;s.vx*=.5;s.vz*=.5;s.spinX*=.4;s.spinY*=.4}if(s.age>=s.life)dissolveShard(s)}
  for(let i=shards.length-1;i>=0;i--)if(shards[i].age>=shards[i].life)shards.splice(i,1);
  for(const w of waves)w.life-=dt;for(let i=waves.length-1;i>=0;i--)if(waves[i].life<=0)waves.splice(i,1);
}

function updateHud(viewYaw,viewPitch){
  // v32: the machine carries its own status (cockpit instruments); the DOM keeps only time,
  // HMD loss and transient messages. Audio cues for LINK / LOCK are raised here.
  hud.style.setProperty?.('--absorb',player.absorb.toFixed(3));
  $('missionClock').textContent=mode==='endurance'?`${fmtTime(missionTime)}  //  BREAK ${stats.kills}  //  LV ${endure.level}`:fmtTime(missionTime);{const fresh=headPoseFresh(),lost=playing&&headEnabled&&!fresh;if(!headEnabled)updateHud.seen=false;else if(fresh)updateHud.seen=true;$('headstat').textContent=lost?'HMD LOST // HOLD':'';if(lost&&!updateHud.lost&&updateHud.seen){plog('Caution','HMD lost. Hold.',4);say('HMD_LOST')}updateHud.lost=lost}
  const sightLink=getSightLink();if(sightLink&&lastSightLinkId!==sightLink.e.id){lastSightLinkId=sightLink.e.id;sfx.scan()}else if(!sightLink)lastSightLinkId=0;
  const gunLock=getLock(.24);if(gunLock&&gunLock.score<.085){if(lastLockedId!==gunLock.e.id){lastLockedId=gunLock.e.id;sfx.lock()}}else lastLockedId=0;
}
// ---------- PILOT LINK ----------
// HMD strip after 最終回収SQUAD: FRAME | LOG | ARM along the bottom of the view, with the pilot AOI's
// eyes living behind the log text. It is head-fixed (the pilot's HMD), so it stays readable when
// the head turns; the cockpit instruments remain as the machine's own gauges. Nothing here follows
// the music clock: every change is driven by a game event or by the frame's state.
// Log glyphs: GNU Unifont 8x16 ASCII bitmaps (SIL OFL 1.1 / GPL-2+ with font embedding exception).
const UNIFONT_HEX='000000000000000000000000000000000000000008080808080808000808000000002222222200000000000000000000000000001212127e24247e484848000000000000083e4948380e09493e08000000000000314a4a340808162929460000000000001c222214182945424639000000000808080800000000000000000000000000040808101010101010080804000000002010100808080808081010200000000000000008492a1c2a49080000000000000000000808087f080808000000000000000000000000000000180808100000000000000000003c000000000000000000000000000000000000181800000000000002020408081010204040000000000000182442464a52624224180000000000000818280808080808083e0000000000003c4242020c102040407e0000000000003c4242021c020242423c000000000000040c142444447e0404040000000000007e4040407c020202423c0000000000001c2040407c424242423c0000000000007e0202040404080808080000000000003c4242423c424242423c0000000000003c4242423e02020204380000000000000000181800000018180000000000000000001818000000180808100000000000000204081020100804020000000000000000007e0000007e0000000000000000004020100804081020400000000000003c4242020408080008080000000000001c224a565252524e201e00000000000018242442427e424242420000000000007c4242427c424242427c0000000000003c42424040404042423c000000000000784442424242424244780000000000007e4040407c404040407e0000000000007e4040407c40404040400000000000003c424240404e4242463a000000000000424242427e42424242420000000000003e08080808080808083e0000000000001f040404040404444438000000000000424448506060504844420000000000004040404040404040407e000000000000424266665a5a4242424200000000000042626252524a4a4646420000000000003c42424242424242423c0000000000007c4242427c40404040400000000000003c4242424242425a663c0300000000007c4242427c48444442420000000000003c424240300c0242423c0000000000007f0808080808080808080000000000004242424242424242423c00000000000041414122222214140808000000000000424242425a5a6666424200000000000042422424181824244242000000000000414122221408080808080000000000007e02020408102040407e00000000000e080808080808080808080e0000000000404020101008080402020000000000701010101010101010101070000000182442000000000000000000000000000000000000000000000000007f00002010080000000000000000000000000000000000003c42023e4242463a00000000004040405c6242424242625c00000000000000003c4240404040423c00000000000202023a4642424242463a00000000000000003c42427e4040423c00000000000c1010107c10101010101000000000000000023a44444438203c42423c0000004040405c624242424242420000000000080800180808080808083e00000000000404000c04040404040404483000000040404044485060504844420000000000180808080808080808083e0000000000000000764949494949494900000000000000005c6242424242424200000000000000003c4242424242423c00000000000000005c6242424242625c40400000000000003a4642424242463a02020000000000005c6242404040404000000000000000003c4240300c02423c0000000000001010107c10101010100c0000000000000000424242424242463a00000000000000004242422424241818000000000000000041494949494949360000000000000000424224181824424200000000000000004242424242261a02023c0000000000007e0204081020407e00000000000c10100808102010080810100c000008080808080808080808080808080000003008081010080408101008083000000031494600000000000000000000';
const PILOT_EXPR=['calm','closed','shout','cheer','smug','laugh','smile','grit','glance'];
const PILOT_BASE=(typeof window!=='undefined'&&window.HF_ASSET_BASE)||'';
const pilotImg={};
if(typeof Image!=='undefined')for(const k of [...PILOT_EXPR,'bust_shout','bust_cheer']){const im=new Image();im.decoding='async';im.src=PILOT_BASE+'assets/pilot/aoi_'+k+'.webp';pilotImg[k]=im}
const pilotReady=k=>{const im=pilotImg[k];return !!(im&&im.complete&&im.naturalWidth)};
// Per-expression framing on the 1280x760 plate (pupils at 520/760, y 300): x/y in eye-distance units from the eye midpoint, z = zoom.
const PILOT_FRAME={calm:{x:0,y:0,z:1},shout:{x:0,y:.4,z:.45},cheer:{x:0,y:.2,z:.75},smug:{x:.2,y:.02,z:1.1},laugh:{x:0,y:.3,z:.62},smile:{x:0,y:.05,z:1},grit:{x:-.12,y:-.05,z:1.2},glance:{x:.22,y:-.02,z:1.14},closed:{x:0,y:0,z:1}};
const PILOT_TAG={AOI:'#a9c9de',Info:'#cfd2c4',System:'#cfd2c4',Caution:'#d8b46c',Warning:'#e47c62',Link:'#8ed8c4',Sync:'#e6d08e'};
const pilot={blinkT:3,blinking:0,glanceDir:1,entries:[],scroll:0,expr:'calm',prev:null,mix:1,fr:{x:0,y:0,z:1},hold:0,holdExpr:'calm',holdPrio:0,banner:null,cut:null,lostT:0,clearT:0,lagX:0,lastHead:0,boot:0,critLatch:false,wasPlaying:false};
// cool: a repeating status line (inbound, venting, critical) is not re-logged within this many seconds.
const plogSeen=new Map();
function plog(tag,text,cool=0){const last=pilot.entries[pilot.entries.length-1];
  if(last&&last.tag===tag&&last.text===text&&gameTime-last.t<2.5){last.t=gameTime;return}
  if(cool>0){const seen=plogSeen.get(text);if(seen!==undefined&&gameTime-seen<cool&&gameTime>=seen)return;plogSeen.set(text,gameTime)}
  pilot.entries.push({tag,text,t:gameTime});if(pilot.entries.length>16)pilot.entries.splice(0,pilot.entries.length-16);pilot.scroll=Math.min(3,pilot.scroll+1)}
function pilotReact(expr,dur,prio=1){if(pilot.hold>0&&prio<pilot.holdPrio)return;pilot.holdExpr=expr;pilot.hold=dur;pilot.holdPrio=prio}
// Side-eye toward a hostile: the plate looks to screen-right, so it is mirrored for targets on the left of the view.
function pilotGlance(e,dur=.9,prio=1){if(pilot.hold>0&&prio<pilot.holdPrio)return;const a=angleDiff(Math.atan2(e.x-player.x,-(e.z-player.z)),player.yaw+headYaw*Math.PI/180);pilot.glanceDir=a<0?-1:1;pilotReact('glance',dur,prio)}
function pilotBanner(en,jp,color='#dcfff4',dur=1.5){pilot.banner={en,jp,color,t:0,dur}}
function pilotCut(kind){pilot.cut={kind,t:0}}
const etag=e=>(RIGS[e.type]?.name||e.type)+' '+String(e.id).padStart(2,'0');
// The full-screen cut-in carries the big reaction (shout on DOWN, cheer on CLEAR); the LOG never repeats
// it: on DOWN its feed drops (drawLinkLost), on CLEAR AOI closes her eyes, relieved.
function pilotTarget(){
  if(!player.alive)return pilot.expr;
  if(missionClear)return 'closed';
  if(pilot.hold>0)return pilot.holdExpr;
  if(player.hp<30)return 'grit';
  if(player.syncTime>0)return 'cheer';
  return pilot.blinking>0?'closed':'calm';
}
function updatePilot(dt){
  if(!playing){pilot.boot=0;return}
  pilot.hold=Math.max(0,pilot.hold-dt);if(pilot.hold<=0)pilot.holdPrio=0;
  // Blink: only from the resting face, on its own random timer (never on the music).
  pilot.blinking=Math.max(0,pilot.blinking-dt);pilot.blinkT-=dt;if(pilot.blinkT<=0){pilot.blinkT=2.6+Math.random()*3.8;if(pilot.expr==='calm'&&pilot.mix>=1)pilot.blinking=.13}
  const want=pilotTarget(),blinky=player.alive&&!missionClear,quick=blinky&&(want==='closed'||(pilot.expr==='closed'&&pilot.hold<=0));if(want!==pilot.expr&&(pilot.mix>.6||quick)){pilot.prev=pilot.expr;pilot.expr=want;pilot.mix=0}
  pilot.mix=Math.min(1,pilot.mix+dt/(quick?.05:.26));
  // Framing is part of the acting: SIGHT LINK pushes in on the aiming eye, danger crowds the frame.
  const base0=PILOT_FRAME[pilot.expr]||PILOT_FRAME.calm,base=pilot.expr==='glance'?{...base0,x:base0.x*pilot.glanceDir}:base0,link=player.alive&&!missionClear&&pilot.hold<=0&&getSightLink();
  const tgt=link?{x:.5,y:-.04,z:1.5}:base,k=1-Math.exp(-dt*5.5);
  pilot.fr.x+=(tgt.x-pilot.fr.x)*k;pilot.fr.y+=(tgt.y-pilot.fr.y)*k;pilot.fr.z+=(tgt.z-pilot.fr.z)*k;
  pilot.scroll*=Math.exp(-dt*13);if(pilot.scroll<.01)pilot.scroll=0;
  const hv=dt>0?(headYaw-pilot.lastHead)/dt:0;pilot.lastHead=headYaw;pilot.lagX+=(clamp(-hv*.12,-12,12)-pilot.lagX)*(1-Math.exp(-dt*9));
  pilot.boot=playing?Math.min(1,pilot.boot+dt/.45):0;
  if(player.hp<30&&player.alive&&!pilot.critLatch){pilot.critLatch=true;pilotBanner('!FRAME CRITICAL!','- 装甲危険域 -','#ff7a5c',1.6)}else if(player.hp>=30)pilot.critLatch=false;
  if(pilot.banner){pilot.banner.t+=dt;if(pilot.banner.t>pilot.banner.dur)pilot.banner=null}
  if(pilot.cut)pilot.cut.t+=dt;
  pilot.lostT=player.alive?0:pilot.lostT+dt;pilot.clearT=missionClear&&player.alive?pilot.clearT+dt:0;
}
// Bitmap text: each distinct string is rasterised once into a small canvas (1 font pixel = 1 canvas
// pixel, with a dark drop shadow) and blitted with smoothing off.
const pxCache=new Map();
function pxLine(str,color,bold=false){const key=str+'|'+color+'|'+bold;let c=pxCache.get(key);if(c!==undefined)return c;
  c=makeCanvas();if(!c){pxCache.set(key,null);return null}
  if(/[^\x20-\x7e]/.test(str)){const g=c.getContext('2d'),font='15px "MS Gothic","Osaka-Mono","Noto Sans Mono CJK JP","Noto Sans CJK JP",monospace';g.font=font;c.width=Math.ceil(g.measureText(str).width)+2;c.height=18;
    g.font=font;g.textBaseline='top';g.fillStyle='rgb(0,10,12)';g.fillText(str,1,2);g.fillStyle=color;g.fillText(str,0,1);const img=g.getImageData(0,0,c.width,c.height),d=img.data;for(let i=3;i<d.length;i+=4)d[i]=d[i]>96?255:0;g.putImageData(img,0,0);
    if(pxCache.size>260)pxCache.clear();pxCache.set(key,c);return c}
  const n=str.length;c.width=n*8+2;c.height=18;const g=c.getContext('2d'),img=g.createImageData(c.width,c.height),d=img.data;
  const rgb=[parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16)];
  const put=(x,y,r,gg,b,a)=>{const i=(y*c.width+x)*4;if(d[i+3]>=a)return;d[i]=r;d[i+1]=gg;d[i+2]=b;d[i+3]=a};
  for(const pass of [0,1])for(let i=0;i<n;i++){let code=str.charCodeAt(i);if(code<32||code>126)code=63;const o=(code-32)*32;
    for(let y=0;y<16;y++){let v=parseInt(UNIFONT_HEX.substr(o+y*2,2),16);if(bold)v|=v>>1;if(!v)continue;
      for(let x=0;x<8;x++)if(v>>(7-x)&1){if(pass===0)put(i*8+x+1,y+1,0,10,12,200);else put(i*8+x,y,rgb[0],rgb[1],rgb[2],255)}}}
  g.putImageData(img,0,0);if(pxCache.size>260)pxCache.clear();pxCache.set(key,c);return c}
function pxTextRaw(str,x,y,s,color){const c=pxLine(str,color,false);if(!c)return;ctx.imageSmoothingEnabled=false;ctx.drawImage(c,Math.round(x),Math.round(y),c.width*s,c.height*s);ctx.imageSmoothingEnabled=true}
// HMD type after NieR:Automata's interface: a light sans with wide tracking for labels, hairline rules,
// small square markers, warm off-white on a faint veil. Bahnschrift on Windows, DIN Alternate on macOS;
// Japanese falls back per glyph to Yu Gothic UI / Hiragino.
const HUD={ink:'#e2dfcc',dim:'rgba(226,223,204,.58)',line:'rgba(226,223,204,.5)',faint:'rgba(226,223,204,.16)',veil:'rgba(5,9,9,.5)',warn:'#e47c62',caution:'#d8b46c',teal:'#8ed8c4',sync:'#e6d08e'};
const HUD_FONT='"Bahnschrift","DIN Alternate","Segoe UI","Helvetica Neue","Yu Gothic UI","Hiragino Sans","Noto Sans JP",sans-serif';
const HUD_LS=typeof CanvasRenderingContext2D!=='undefined'&&'letterSpacing' in CanvasRenderingContext2D.prototype;
// Draws str with its top at y; align 0 left / .5 centre / 1 right; track in em. Returns the width.
function hudText(str,x,y,size,color,align=0,track=0,weight=400){
  ctx.font=`${weight} ${Math.max(6,size).toFixed(1)}px ${HUD_FONT}`;ctx.textBaseline='top';const ls=HUD_LS?track*size:0;if(HUD_LS)ctx.letterSpacing=ls.toFixed(2)+'px';
  const m=ctx.measureText(str),w=(m?m.width:str.length*size*.55)-ls,X=Math.round(x-w*align);
  ctx.fillStyle='rgba(0,6,8,.55)';ctx.fillText(str,X+1,Math.round(y)+1);ctx.fillStyle=color;ctx.fillText(str,X,Math.round(y));if(HUD_LS)ctx.letterSpacing='0px';return w}
// Fits str into maxW at this size, ending in an ellipsis when it has to cut.
function hudFit(str,maxW,size){ctx.font=`400 ${size.toFixed(1)}px ${HUD_FONT}`;const m=ctx.measureText(str);if(!m||m.width<=maxW)return str;let o=str;while(o.length>1){o=o.slice(0,-1);const q=ctx.measureText(o+'…');if(!q||q.width<=maxW)break}return o+'…'}
// Panel: a faint veil, a hairline rule on top with short ticks down at both ends, the label above it
// behind a small square.
function hudPanel(x,y,w,h,label,s,col=HUD.line){
  ctx.fillStyle=HUD.veil;ctx.fillRect(x,y,w,h);const t=Math.max(1,Math.round(s*.6));ctx.fillStyle=col;
  ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),t);ctx.fillRect(Math.round(x),Math.round(y),t,Math.round(4*s));ctx.fillRect(Math.round(x+w)-t,Math.round(y),t,Math.round(4*s));
  ctx.fillRect(Math.round(x),Math.round(y+h)-t,Math.round(10*s),t);ctx.fillRect(Math.round(x+w-10*s),Math.round(y+h)-t,Math.round(10*s),t);
  if(label){const c=col===HUD.line?HUD.ink:col;ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y-8*s),Math.round(3*s),Math.round(3*s));hudText(label,x+6*s,y-10.5*s,5.2*s,c,0,.32)}}
// The face layer is composited into its own canvas and only re-rendered when the expression,
// crossfade, framing, head offset or grade actually changes; a steady frame is a single blit.
const faceLayer={c:null,key:''};
function drawPilotFace(x,y,w,h,s){
  const f=pilot.fr,danger=player.alive&&player.hp<30,jit=danger?Math.floor(gameTime*14):0,grade=player.syncTime>0?1:danger?2:0;
  const key=[pilot.glanceDir,pilot.expr,pilot.prev,pilot.mix.toFixed(2),f.x.toFixed(3),f.y.toFixed(3),f.z.toFixed(3),Math.round(headYaw*2),jit,grade,Math.round(w),Math.round(h),DPR,pilotReady(pilot.expr),pilotReady(pilot.prev||pilot.expr)].join('|');
  if(!faceLayer.c)faceLayer.c=makeCanvas();const L=faceLayer.c;if(!L)return;
  if(key!==faceLayer.key){faceLayer.key=key;const cw=Math.max(1,Math.round(w*DPR)),ch=Math.max(1,Math.round(h*DPR));if(L.width!==cw||L.height!==ch){L.width=cw;L.height=ch}
    const g=L.getContext('2d');g.setTransform(DPR,0,0,DPR,0,0);g.clearRect(0,0,w,h);
    const jr=k=>danger?(hash(jit*7+k)-.5):0,jx=jr(1)*2.4*s,jy=jr(2)*1.6*s;
    const draw=(k,a,dx)=>{if(!pilotReady(k)||a<=.01)return;const sc=w*1.62/960*f.z,px=640+f.x*240-headYaw*1.3,py=300+f.y*240;
      g.globalAlpha=a;const X=w*.5-px*sc+dx+jx,Y=h*.46-py*sc+jy;if(k==='glance'&&pilot.glanceDir<0){g.save();g.translate(X+640*sc,0);g.scale(-1,1);g.drawImage(pilotImg[k],-640*sc,Y,1280*sc,760*sc);g.restore()}else g.drawImage(pilotImg[k],X,Y,1280*sc,760*sc)};
    const m=pilot.mix,ghost=(1-m)*7*s;if(pilot.prev&&m<1)draw(pilot.prev,(1-m)*.86,ghost);draw(pilot.expr,(pilot.prev?m:1)*.86,-ghost);g.globalAlpha=1;
    // HMD grade: pull saturation down, sink it under a veil (teal / SYNC gold / danger red), then scanlines.
    g.globalCompositeOperation='saturation';g.fillStyle='rgba(128,128,128,.55)';g.fillRect(0,0,w,h);
    g.globalCompositeOperation='source-atop';g.fillStyle=grade===1?'rgba(40,30,4,.30)':grade===2?'rgba(40,6,4,.30)':'rgba(2,22,24,.36)';g.fillRect(0,0,w,h);
    g.fillStyle='rgba(0,0,0,.16)';const step=Math.max(2,Math.round(3*s/2));for(let yy=0;yy<h;yy+=step)g.fillRect(0,yy,w,1);g.globalCompositeOperation='source-over'}
  if(!player.alive){drawLinkLost(L,x,y,w,h,s);return}
  if(missionClear){drawLinkComplete(L,x,y,w,h,s);return}
  ctx.drawImage(L,x,y,w,h)}
// The frame is down, so PILOT LINK goes with it: the last frames of AOI's feed tear into bands and
// static, fold to a bright line (a set switching off), and the LOG is left on a dead panel with SIGNAL LOST
// (AOI is aboard, so it reads as no response from the pilot, not a lost remote link).
function drawLinkLost(L,x,y,w,h,s){
  const t=pilot.lostT,seed=Math.floor(gameTime*30);
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.fillStyle='rgba(0,5,7,.92)';ctx.fillRect(x,y,w,h);
  const snow=(n,a0,a1,len)=>{for(let i=0;i<n;i++){ctx.globalAlpha=a0+a1*hash(seed+i*3);ctx.fillStyle=hash(seed*7+i)>.35?HUD.ink:HUD.warn;ctx.fillRect(x+hash(seed+i*5)*w,y+hash(seed+i*11)*h,(1+hash(i*13+seed)*len)*s,s)}};
  if(t<.6){
    const k=t<.32?1:Math.max(0,1-(t-.32)/.28),hh=Math.max(1.5*s,h*k*k),cy=y+h*.5,bands=7,tear=Math.min(1,t/.32)*.85+.15;
    for(let i=0;i<bands;i++){const d=(hash(seed*13+i)-.5)*w*.22*tear;ctx.globalAlpha=.92;ctx.drawImage(L,0,i/bands*L.height,L.width,L.height/bands,x+d,cy-hh/2+i/bands*hh,w,hh/bands+1)}
    if(k<1){ctx.globalAlpha=(1-k)*.95;ctx.fillStyle='#e8fff7';ctx.fillRect(x+w*.5*(1-Math.max(k,.15)),cy-s,w*Math.max(k,.15),2*s)}
    snow(46,.25,.45,22);
  }else{
    snow(12,.08,.14,6);
    const on=Math.floor((t-.6)*2.4)%2===0?1:.6;ctx.globalAlpha=.62*on;
    hudText('SIGNAL LOST',x+w-12*s,y+h*.5-13*s,10*s,HUD.warn,1,.36,300);ctx.globalAlpha=.5*on;hudText('NO RESPONSE FROM PILOT',x+w-12*s,y+h*.5+4*s,5.2*s,HUD.warn,1,.3);
  }
  ctx.restore()}
// The sector is clean: AOI closes her eyes, the feed fades out (her face is already up in the cut-in),
// the log entries go with it, and MISSION COMPLETE takes the whole LOG: a bright bar crosses the panel
// and leaves the words behind it, their tracking pulls in and a glow settles. The rest is one small line.
// Same place FRAME DOWN leaves SIGNAL LOST.
function drawLinkComplete(L,x,y,w,h,s){
  const fin=finalClear(),t=pilot.clearT,f=clamp((t-.5)/.6,0,1),u=t-1.05;
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
  if(f<1){ctx.globalAlpha=1-f;ctx.drawImage(L,x,y,w,h)}
  ctx.globalAlpha=f;ctx.fillStyle='rgba(0,5,7,.92)';ctx.fillRect(x,y,w,h);
  if(u>0){
    const sw=clamp(u/.3,0,1),e=1-Math.pow(1-sw,3),k=1-Math.pow(1-clamp(u/.7,0,1),3),glow=Math.max(0,1-u/1.1),size=20*s,cx=x+w/2,cy=y+h*.42;
    ctx.save();ctx.beginPath();ctx.rect(x,y,w*e,h);ctx.clip();ctx.globalAlpha=1;
    ctx.shadowColor='rgba(255,246,218,.9)';ctx.shadowBlur=glow*18*s;
    hudText(fin?'OPERATION COMPLETE':'MISSION COMPLETE',cx,cy-size*.5,fin?size*.88:size,'#f3efdf',.5,.42-.12*k,300);ctx.restore();
    const rule=w*.62*k;ctx.globalAlpha=.55;ctx.fillStyle=HUD.ink;ctx.fillRect(cx-rule/2,cy+size*.62,rule,Math.max(1,.6*s));
    if(u<.55){ctx.globalAlpha=sw<1?1:1-(u-.3)/.25;ctx.fillStyle='#fffbe8';ctx.shadowColor='rgba(255,246,218,.9)';ctx.shadowBlur=10*s;ctx.fillRect(x+w*e-2*s,y+3*s,2.2*s,h-6*s);ctx.shadowBlur=0}
    const a2=clamp((u-.5)/.45,0,1);if(a2>0){ctx.globalAlpha=.62*a2;hudText(fin?'ALL SECTORS CLEAR':`ALL HOSTILES BROKEN  //  TIME ${fmtTime(missionTime)}`,cx,cy+size*.62+6*s,5.2*s,HUD.ink,.5,.3)}
  }
  ctx.restore()}
function drawPilotLink(){
  if(!playing)return;
  const b=pilot.boot;if(b<=0)return;
  // type scale: never below ~11 px body / 8 px labels, so a small window keeps a readable strip
  const sv=H*DPR/1080*2.4,s=Math.max(1.45,Math.max(1,sv>=2?Math.round(sv):Math.round(sv*2)/2)/DPR),lh=12.5*s,pad=6*s,fs=7.8*s,cap=5.6*s;
  const logW=Math.min(W*.5,330*s),logH=lh*4+pad*2,sideW=Math.max(70*s,logW*.24),sideH=logH,gap=10*s;
  const total=sideW*2+logW+gap*2,ox=W/2-total/2+pilot.lagX+(Math.random()-.5)*player.shake*4,by=H-16*s-(1-b)*24*s+(Math.random()-.5)*player.shake*3;
  ctx.save();ctx.globalAlpha=b;
  const ly=by-logH,lx=ox+sideW+gap,sy=by-sideH;
  // LOG with AOI behind the text: one entry per line, the tag in small caps in its own column.
  hudPanel(lx,ly,logW,logH,'LOG',s);drawPilotFace(lx+1,ly+1,logW-2,logH-2,s);ctx.globalAlpha=b;
  // On SECTOR CLEAN the entries fade with AOI's feed and leave the panel to MISSION COMPLETE.
  const clr=missionClear&&player.alive?clamp((pilot.clearT-.5)/.6,0,1):0;
  ctx.save();ctx.beginPath();ctx.rect(lx,ly+pad*.5,logW,logH-pad);ctx.clip();const tagW=50*s,textW=logW-pad*2-tagW,E=clr<1?pilot.entries:[];
  for(let i=0;i<E.length;i++){const row=i-(E.length-4)+pilot.scroll;if(row<-1||row>4)continue;const e=E[i],age=gameTime-e.t,y=ly+pad+row*lh;
    ctx.globalAlpha=b*clamp(age/.12,0,1)*(row<0?.5:1)*(1-clr);const col=PILOT_TAG[e.tag]||HUD.ink;
    ctx.fillStyle=col;ctx.fillRect(Math.round(lx+pad),Math.round(y+lh*.5-1.5*s),Math.round(2.5*s),Math.round(2.5*s));
    hudText(e.tag.toUpperCase(),lx+pad+6*s,y+(lh-cap)*.5-.5*s,cap,col,0,.2);hudText(hudFit(e.text.replace(/^-\s*/,''),textW,fs),lx+pad+tagW,y+(lh-fs)*.5-.5*s,fs,HUD.ink)}
  ctx.restore();ctx.globalAlpha=b;
  // FRAME: hull as four thin cells with its percentage, boost along the bottom edge.
  const danger=player.alive&&player.hp<30,blink=Math.floor(gameTime*3)%2===0,fx=ox,hp=clamp(player.hp/100,0,1),hc=danger?HUD.warn:HUD.ink;
  hudPanel(fx,sy,sideW,sideH,'FRAME',s,danger?HUD.warn:undefined);
  {const x0=fx+pad,x1=fx+sideW-pad,cw=(x1-x0-3*s*3)/4;
    hudText('HULL',x0,sy+pad,cap,HUD.dim,0,.2);hudText(String(Math.round(player.hp)),x1,sy+pad-3*s,11*s,hc,1,.02,300);
    const yb=sy+pad+14*s;for(let i=0;i<4;i++){const f=clamp(hp*4-i,0,1),x=x0+i*(cw+3*s);ctx.fillStyle=HUD.faint;ctx.fillRect(x,yb,cw,2*s);if(f>0){ctx.fillStyle=hc;ctx.fillRect(x,yb,cw*f,2*s)}}
    const yB=sy+sideH-3*s;ctx.fillStyle=HUD.faint;ctx.fillRect(x0,yB,x1-x0,1*s);ctx.fillStyle=player.boostTime>0?'#ffffff':HUD.teal;ctx.fillRect(x0,yB,(x1-x0)*clamp(player.boost/100,0,1),1*s);
    if(danger&&blink)hudText('DANGER',fx+sideW,sy-14*s,cap,HUD.warn,1,.3)}
  // FLOW / SYNC as a hairline along the LOG's top edge.
  {const fl=player.syncTime>0?1:clamp(player.flow/100,0,1);ctx.fillStyle=player.syncTime>0?HUD.sync:'rgba(230,208,142,.7)';ctx.fillRect(lx,ly-2*s,logW*fl,1.5*s)}
  // ARM: weapon name, barrel heat (or MAUL rounds), VENT / RELOAD.
  const ax=lx+logW+gap,heat=clamp(player.heat/100,0,1);hudPanel(ax,sy,sideW,sideH,'ARM',s);
  {const x0=ax+pad,x1=ax+sideW-pad,maul=cockpit.shown==='MAUL',arb=cockpit.shown==='ARBALEST',axe=cockpit.shown==='BARDICHE',fl=cockpit.shown==='FLAIL';hudText(maul?'MAUL':arb?'ARBALEST':axe?'BARDICHE':fl?'FLAIL':'HALBERD',x0,sy+pad,fs,HUD.caution,0,.16);
    const gy=sy+sideH-pad-4*s;
    if(fl){const cyc=clamp((gameTime-(player.pumpT??-9))/FLAIL.cycle,0,1);ctx.fillStyle=HUD.faint;ctx.fillRect(x0,gy,x1-x0,2*s);ctx.fillStyle=cyc<1?'rgba(216,180,108,.6)':HUD.ink;ctx.fillRect(x0,gy,(x1-x0)*cyc,2*s);hudText(cyc<1?'PUMP':'READY',x0,gy-cap-5*s,cap,cyc<1?HUD.caution:HUD.dim,0,.2)}
    else if(axe){const S=player.swing,f=S?clamp(S.t/swingEnd(),0,1):1;ctx.fillStyle=HUD.faint;ctx.fillRect(x0,gy,x1-x0,2*s);ctx.fillStyle=S?'rgba(216,180,108,.6)':HUD.ink;ctx.fillRect(x0,gy,(x1-x0)*f,2*s);hudText(S?'SWING':'READY',x0,gy-cap-5*s,cap,S?HUD.caution:HUD.dim,0,.2)}
    else if(arb){const cyc=clamp((gameTime-(player.snipeT??-9))/ARBALEST.cycle,0,1);ctx.fillStyle=HUD.faint;ctx.fillRect(x0,gy,x1-x0,2*s);ctx.fillStyle=cyc<1?'rgba(216,180,108,.6)':HUD.ink;ctx.fillRect(x0,gy,(x1-x0)*cyc,2*s);hudText(cyc<1?'CYCLING':'READY',x0,gy-cap-5*s,cap,cyc<1?HUD.caution:HUD.dim,0,.2)}
    else if(maul){const n=MAUL.mag,cw=(x1-x0-2*s*(n-1))/n;for(let i=0;i<n;i++){const x=x0+i*(cw+2*s),f=i<player.rockets?1:i===player.rockets?player.rocketRegen/MAUL.regen:0;ctx.fillStyle=HUD.faint;ctx.fillRect(x,gy,cw,2*s);if(f>0){ctx.fillStyle=f<1?'rgba(216,180,108,.5)':HUD.caution;ctx.fillRect(x,gy,cw*f,2*s)}}
      hudText(player.rockets?'ROUNDS '+player.rockets:'RELOAD',x0,gy-cap-5*s,cap,player.rockets?HUD.dim:HUD.warn,0,.2)}
    else{const hot=player.vent;ctx.fillStyle=HUD.faint;ctx.fillRect(x0,gy,x1-x0,2*s);ctx.fillStyle=hot?(blink?HUD.warn:'rgba(228,124,98,.4)'):heat>.7?'#e09a62':HUD.ink;ctx.fillRect(x0,gy,(x1-x0)*heat,2*s);
      hudText(hot?'VENT':'HEAT',x0,gy-cap-5*s,cap,hot?HUD.warn:HUD.dim,0,.2);hudText(String(Math.round(heat*100)),x1,gy-cap-5*s,cap,hot?HUD.warn:HUD.dim,1,.1)}}
  drawSonar(ox-gap-logH*.5,by-logH*.5,logH*.5,s);
  ctx.restore();
  drawPilotBanner(s);
}
// SONAR: chassis-up scope at the strip's left end. A ping ring sweeps outward on its own period
// (never the music); each hostile shows where the ring last found it, flares, and settles dim until the
// next pass refreshes it (a hostile the ring stops finding drops off after 1.5 periods).
// The HMD-designated hostile is tracked live. The head's view wedge (cyan) and the gun bearing
// (amber) show the control split. Hostiles beyond range sit on the rim as bearing ticks.
const SONAR={range:90,period:2.0,last:0,blips:new Map()};
function sonarPoint(x,z){const dx=x-player.x,dz=z-player.z,c=Math.cos(-player.yaw),n=Math.sin(-player.yaw);return{x:(dx*c-dz*n)/SONAR.range,y:(dx*n+dz*c)/SONAR.range}}
function updateSonar(){const ph=(gameTime%SONAR.period)/SONAR.period,r1=ph*1.15,r0=ph<SONAR.last?-1:SONAR.last*1.15;SONAR.last=ph;
  for(const [id] of SONAR.blips)if(!enemies.some(e=>e.id===id&&e.alive))SONAR.blips.delete(id);
  for(const e of enemies){if(!e.alive)continue;const p=sonarPoint(e.x,e.z),d=Math.hypot(p.x,p.y);if(d>r0&&d<=r1)SONAR.blips.set(e.id,{x:p.x,y:p.y,t:gameTime,type:e.type})}
  return r1}
function drawSonar(cx,cy,R,s){
  const ring=updateSonar(),B=clamp(pilot.boot,0,1),col=HUD.line,px=Math.max(2,Math.round(3*s));ctx.save();
  ctx.fillStyle=HUD.veil;ctx.beginPath();ctx.arc(cx,cy,R,0,TAU);ctx.fill();
  ctx.fillStyle=HUD.ink;ctx.fillRect(Math.round(cx-R),Math.round(cy-R-8*s),Math.round(3*s),Math.round(3*s));hudText('SONAR',cx-R+6*s,cy-R-10.5*s,5.2*s,HUD.ink,0,.32);
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,R,0,TAU);ctx.clip();
  const h=headYaw*Math.PI/180;ctx.fillStyle='rgba(103,255,209,.13)';ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,R,-Math.PI/2+h-.36,-Math.PI/2+h+.36);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(220,255,244,.16)';ctx.lineWidth=Math.max(1,s*.75);for(const k of [1/3,2/3]){ctx.beginPath();ctx.arc(cx,cy,R*k,0,TAU);ctx.stroke()}
  if(ring<1){ctx.globalAlpha=B*(.5*(1-ring));ctx.strokeStyle='#67ffd1';ctx.lineWidth=Math.max(1,s);ctx.beginPath();ctx.arc(cx,cy,R*ring,0,TAU);ctx.stroke();ctx.globalAlpha=B}
  const g=player.torso;ctx.strokeStyle='rgba(255,199,90,.85)';ctx.lineWidth=Math.max(1,s);ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.sin(g)*R*.9,cy-Math.cos(g)*R*.9);ctx.stroke();
  for(const b of SONAR.blips.values()){const age=(gameTime-b.t)/SONAR.period;if(age>1.5)continue;const a=Math.max(.4,1-age*.75);ctx.globalAlpha=B*(a);ctx.fillStyle=CLASS_STYLE[b.type].edge;const k=b.type==='TITAN'?2.2:b.type==='HEAVY'?1.5:1;ctx.fillRect(Math.round(cx+b.x*R-px*k/2),Math.round(cy+b.y*R-px*k/2),Math.ceil(px*k),Math.ceil(px*k))}
  ctx.globalAlpha=B*(1);
  for(const e of enemies){if(!e.alive)continue;const p=sonarPoint(e.x,e.z),d=Math.hypot(p.x,p.y);
    if(d>1){if(d>2.2)continue;const ux=p.x/d,uy=p.y/d;ctx.globalAlpha=B*(.75);ctx.strokeStyle=CLASS_STYLE[e.type].edge;ctx.lineWidth=Math.max(1,s*1.5);ctx.beginPath();ctx.moveTo(cx+ux*R*.86,cy+uy*R*.86);ctx.lineTo(cx+ux*R*.98,cy+uy*R*.98);ctx.stroke();continue}
    if(e.designated>0){const x=cx+p.x*R,y=cy+p.y*R,q=px*1.6;ctx.globalAlpha=B*(1);ctx.fillStyle='#8fffe0';ctx.fillRect(Math.round(x-px/2),Math.round(y-px/2),px,px);ctx.strokeStyle='#8fffe0';ctx.lineWidth=Math.max(1,s*.75);ctx.strokeRect(Math.round(x-q)+.5,Math.round(y-q)+.5,Math.round(q*2),Math.round(q*2))}}
  ctx.restore();
  ctx.fillStyle=HUD.ink;ctx.beginPath();ctx.moveTo(cx,cy-px*1.4);ctx.lineTo(cx+px,cy+px);ctx.lineTo(cx-px,cy+px);ctx.closePath();ctx.fill();
  ctx.strokeStyle=col;ctx.lineWidth=Math.max(1,s*.6);ctx.beginPath();ctx.arc(cx,cy,R,0,TAU);ctx.stroke();
  ctx.restore()}
// ---------- VISOR DAMAGE ----------
// The pilot is not hit, the frame is: nothing breaks the visor. The outside view is the frame's sensor
// feed on the HMD, so a hit shakes the feed (signal tear) and throws sparks in from the side that was hit
// (the hull right under the sensors). The machine shows its own damage: the arm armour dulls and scorches
// with wear, sputters sparks under 60%, and under 30% smokes and sparks continuously. Under 30% the
// sensors are failing: patches of the feed stay broken (mosaic, static, dead band, colour split) on top of
// the alarm, red pulse, recurring tears and error readouts. Timers are its own, never the music.
const visorFX={glitch:0,glitchK:0,nextGlitch:0,errors:[],nextErr:0,alarmT:0,pulse:0,sparks:[],smoke:[],blocks:[],flash:null,armPt:null,nextSputter:0,smokeT:0,tmp:null};
const VISOR_ALARM=1.13;
const VISOR_ERRORS=['ERR 0x3F HYD PRESS LOW','ACTUATOR L2 FAULT','COOLANT LEAK // BAY 3','SENSOR DESYNC','ARMOR BREACH 04','SERVO STALL // R-KNEE','PWR BUS 2 OFFLINE','GYRO DRIFT +3.1','ERR 0xC0 FCS RESET','HULL INTEGRITY < 30','REACTOR TEMP HIGH','HMD BUS ERROR'];
function feedHit(dirWorld,dmg){
  const V=visorFX,rel=angleDiff(dirWorld,player.yaw+headYaw*Math.PI/180),sx=Math.sin(rel),back=Math.abs(rel)>Math.PI/2;
  // Entry point on the frame edge: sides for side hits, the bottom (hull under the sensors) for front / rear.
  const side=Math.abs(sx)>.5,x=side?(sx>0?.99:.01):clamp(.5+sx*.6+(Math.random()-.5)*.2,.08,.92),y=side?.5+Math.random()*.4:(back?.99:.97);
  V.flash={x,y,t:0,k:clamp(dmg/10,.6,1.4)};const n=Math.round(16+dmg*1.6);
  for(let i=0;i<n;i++){const ang=Math.atan2(.48-y,.5-x)+(Math.random()-.5)*1.5,sp=.5+Math.random()*1.3;V.sparks.push({x,y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp-.25,life:.25+Math.random()*.45,max:.7,w:1+Math.random()*1.8,col:Math.random()<.3?'#fff4d6':Math.random()<.6?'#ffd27a':'#ff8a3a'})}
  // a moment of dropped feed somewhere, and under 30% damage that stays
  V.blocks.push(feedBlock(.35));if(player.hp<30&&V.blocks.filter(b=>!b.life).length<6&&Math.random()<.75)V.blocks.push(feedBlock(0))}
function feedBlock(life){
  let x,y,w,h,t=0;do{w=.07+Math.random()*.16;h=.035+Math.random()*.1;x=.02+Math.random()*(.96-w);y=.04+Math.random()*(.7-h);t++}while(t<20&&x<.68&&x+w>.32&&y<.62&&y+h>.3);
  const kinds=['mosaic','static','dead','split'];return{x,y,w,h,kind:kinds[Math.floor(Math.random()*kinds.length)],life,t:0,seed:Math.random()*1000}}
function armWear(){const hp=player.hp;return hp>66?0:hp>33?1:2}
function updateVisorFX(dt){
  const V=visorFX,danger=playing&&player.alive&&player.hp<30;V.glitch=Math.max(0,V.glitch-dt);if(V.glitch<=0)V.glitchK=0;V.pulse=Math.max(0,V.pulse-dt*2.4);
  for(const p of V.sparks){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=1.6*dt;p.vx*=1-dt*1.5}V.sparks=V.sparks.filter(p=>p.life>0);
  for(const m of V.smoke){m.life-=dt;m.x+=m.vx*dt;m.y+=m.vy*dt;m.r+=m.gr*dt;m.vx*=1-dt*.4}V.smoke=V.smoke.filter(m=>m.life>0);
  if(V.flash){V.flash.t+=dt;if(V.flash.t>.18)V.flash=null}
  for(const b of V.blocks)b.t+=dt;V.blocks=V.blocks.filter(b=>b.life?b.t<b.life:danger);
  // The damaged arm: sputters under 60%, smokes and sparks under 30%.
  const A=V.armPt;if(playing&&player.alive&&A&&player.hp<60&&dt>0){
    if(gameTime>=V.nextSputter){V.nextSputter=gameTime+(danger?.35+Math.random()*.8:1.8+Math.random()*2.5);const n=danger?10:6;for(let i=0;i<n;i++){const a=-Math.PI/2+(Math.random()-.5)*2.4,sp=.25+Math.random()*.7;V.sparks.push({x:A.x+(Math.random()-.5)*.03,y:A.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:.2+Math.random()*.35,max:.55,w:.8+Math.random()*1.2,col:Math.random()<.4?'#bfe0ff':'#ffd27a'})}if(Math.random()<.6)sfx.sputter()}
    if(danger){V.smokeT-=dt;while(V.smokeT<=0){V.smokeT+=.07;V.smoke.push({x:A.x+(Math.random()-.5)*.04,y:A.y,vx:-.04-Math.random()*.06,vy:-.12-Math.random()*.1,r:.03,gr:.07+Math.random()*.05,life:1.6+Math.random()*1.2,max:2.8,dark:Math.random()<.3})}}}

  for(const e of V.errors)e.t+=dt;V.errors=V.errors.filter(e=>e.t<e.life);
  if(!danger){V.alarmT=0;V.errors.length=0;return}
  if(V.blocks.filter(b=>!b.life).length<2)V.blocks.push(feedBlock(0));
  V.alarmT-=dt;if(V.alarmT<=0){V.alarmT=VISOR_ALARM;V.pulse=1;sfx.alarm()}
  if(gameTime>=V.nextGlitch){V.nextGlitch=gameTime+.45+Math.random()*1.7;V.glitch=Math.max(V.glitch,.07+Math.random()*.16);V.glitchK=Math.max(V.glitchK,.45+Math.random()*.4)}
  // Readouts sit around the edge of the visor (never over the centre or each other).
  if(gameTime>=V.nextErr&&V.errors.length<4){V.nextErr=gameTime+.3+Math.random()*.9;const text=VISOR_ERRORS[Math.floor(Math.random()*VISOR_ERRORS.length)],w=(text.length*8+16)*errScale()/Math.max(1,W),h=30*errScale()/Math.max(1,H);
    for(let t=0;t<24;t++){const x=.03+Math.random()*(.94-w),y=.08+Math.random()*.52;if(x<.66&&x+w>.3&&y<.62&&y+h>.3)continue;if(V.errors.some(e=>x<e.x+e.w+.01&&x+w>e.x-.01&&y<e.y+e.h+.01&&y+h>e.y-.01))continue;
      V.errors.push({text,x,y,w,h,t:0,life:1.1+Math.random()*1.8});if(Math.random()<.5)sfx.errChirp();break}}}
function errScale(){return Math.max(1,Math.round(H/900))}
// Danger layer + signal tear, drawn last so the HMD readouts tear with the world.
function drawFeedDamage(){
  const V=visorFX;if(!V.blocks.length&&!V.sparks.length&&!V.smoke.length&&!V.flash)return;ctx.save();ctx.setTransform(1,0,0,1,0,0);const cw=canvas.width,ch=canvas.height;
  for(const b of V.blocks){if(!b.life&&Math.random()<.08)continue;const x=Math.round(b.x*cw),y=Math.round(b.y*ch),w=Math.round(b.w*cw),h=Math.round(b.h*ch);if(w<4||h<4)continue;const a=b.life?Math.min(1,(b.life-b.t)/.1):1;ctx.globalAlpha=a;
    if(b.kind==='mosaic'){if(!V.tmp)V.tmp=makeCanvas();const T=V.tmp;if(T){const q=Math.max(6,Math.round(ch/70)),tw=Math.max(1,Math.round(w/q)),th=Math.max(1,Math.round(h/q));if(T.width<tw)T.width=tw;if(T.height<th)T.height=th;const g=T.getContext('2d');g.imageSmoothingEnabled=true;g.clearRect(0,0,tw,th);g.drawImage(canvas,x,y,w,h,0,0,tw,th);ctx.imageSmoothingEnabled=false;ctx.drawImage(T,0,0,tw,th,x,y,w,h);ctx.imageSmoothingEnabled=true}}
    else if(b.kind==='static'){ctx.fillStyle='rgba(10,14,16,.55)';ctx.fillRect(x,y,w,h);const n=Math.round(w*h/90);for(let i=0;i<n;i++){const v=Math.random()*200|0;ctx.fillStyle=`rgb(${v},${v},${v})`;ctx.fillRect(x+Math.random()*w,y+Math.random()*h,2,1+Math.random()*2)}}
    else if(b.kind==='dead'){ctx.fillStyle='#020405';ctx.fillRect(x,y,w,h);ctx.fillStyle='rgba(220,255,244,.35)';for(let r=0;r<3;r++)ctx.fillRect(x,y+((b.seed*(r+1)+gameTime*40)%h),w,1)}
    else{ctx.globalCompositeOperation='lighter';ctx.globalAlpha=a*.5;ctx.drawImage(canvas,x,y,w,h,x+Math.round(ch/120),y,w,h);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=a*.3;ctx.fillStyle='rgba(255,40,60,1)';ctx.fillRect(x,y,w,h)}
}
  ctx.globalAlpha=1;
  for(const m of V.smoke){const k=m.life/m.max,R=m.r*ch,x=m.x*cw,y=m.y*ch,g=ctx.createRadialGradient(x,y,0,x,y,R);g.addColorStop(0,m.dark?`rgba(30,30,34,${(.45*k).toFixed(3)})`:`rgba(150,152,156,${(.32*k).toFixed(3)})`);g.addColorStop(1,'rgba(20,20,24,0)');ctx.fillStyle=g;ctx.fillRect(x-R,y-R,R*2,R*2)}
  ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
  if(V.flash){const f=V.flash,a=1-f.t/.18,x=f.x*cw,y=f.y*ch,R=Math.min(cw,ch)*.28*f.k,g=ctx.createRadialGradient(x,y,0,x,y,R);g.addColorStop(0,`rgba(255,236,190,${(.75*a).toFixed(3)})`);g.addColorStop(.4,`rgba(255,150,60,${(.3*a).toFixed(3)})`);g.addColorStop(1,'rgba(255,80,20,0)');ctx.fillStyle=g;ctx.fillRect(x-R,y-R,R*2,R*2)}
  const k=ch/720;for(const p of V.sparks){const a=Math.min(1,p.life/(p.max*.5));ctx.globalAlpha=a;ctx.strokeStyle=p.col;ctx.lineWidth=p.w*k;ctx.beginPath();ctx.moveTo(p.x*cw,p.y*ch);ctx.lineTo((p.x-p.vx*.035)*cw,(p.y-p.vy*.035)*ch);ctx.stroke()}
  ctx.restore()}
function drawSignalFX(){
  const V=visorFX,danger=playing&&player.alive&&player.hp<30,cw=canvas.width,ch=canvas.height;ctx.save();ctx.setTransform(1,0,0,1,0,0);
  if(danger){const k=.5+.5*V.pulse,g=ctx.createRadialGradient(cw/2,ch/2,Math.min(cw,ch)*.3,cw/2,ch/2,Math.hypot(cw,ch)*.55);g.addColorStop(0,'rgba(255,20,10,0)');g.addColorStop(1,`rgba(255,24,12,${(.22+.3*k).toFixed(3)})`);ctx.fillStyle=g;ctx.fillRect(0,0,cw,ch);
    // static: sparse bright pixels and a slow rolling bar
    ctx.globalCompositeOperation='lighter';ctx.fillStyle='rgba(255,90,70,.35)';const n=40+Math.floor(80*k);for(let i=0;i<n;i++)ctx.fillRect(Math.random()*cw,Math.random()*ch,1+Math.random()*3,1);
    const bar=((gameTime*.37)%1)*ch;ctx.fillStyle='rgba(255,60,40,.05)';ctx.fillRect(0,bar,cw,ch*.06);ctx.globalCompositeOperation='source-over';
    // error readouts around the visor
    const s=errScale()*DPR;for(const e of V.errors){const on=e.t<.3?Math.floor(e.t*20)%2===0:e.life-e.t<.25?Math.floor(e.t*24)%2===0:Math.random()>.04;if(!on)continue;
      const x=e.x*cw,y=e.y*ch,w=e.w*cw,h=e.h*ch;ctx.fillStyle='rgba(30,0,0,.55)';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#ff4a3a';ctx.lineWidth=s;ctx.strokeRect(Math.round(x)+.5,Math.round(y)+.5,Math.round(w),Math.round(h));
      ctx.fillStyle='#ff4a3a';ctx.fillRect(x,y,4*s,h);pxTextRaw(e.text,x+8*s,y+5*s,s,'#ffb0a0')}}
  if(V.glitch>0){const K=V.glitchK*Math.min(1,V.glitch/.08),n=4+Math.floor(K*8);
    for(let i=0;i<n;i++){const y=Math.random()*ch,h=(3+Math.random()*34)*ch/720,dx=(Math.random()-.5)*K*70*ch/720;ctx.drawImage(canvas,0,y,cw,h,dx,y,cw,h)}
    ctx.globalCompositeOperation='lighter';for(let i=0;i<3;i++){const y=Math.random()*ch;ctx.fillStyle=i%2?'rgba(60,255,230,.10)':'rgba(255,40,40,.14)';ctx.fillRect(0,y,cw,(1+Math.random()*4)*ch/720)}
    // red / cyan split of the whole frame, offset sideways
    ctx.globalAlpha=.22*K;ctx.drawImage(canvas,-6*K*ch/720,0);ctx.globalAlpha=.16*K;ctx.drawImage(canvas,6*K*ch/720,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over'}
  ctx.restore()}
function drawPilotBanner(s){const bn=pilot.banner;if(!bn)return;const a=clamp(bn.t/.12,0,1)*clamp((bn.dur-bn.t)/.3,0,1);if(a<=0)return;
  const h=34*s,y=H*.6-h/2,w=Math.min(W*.6,360*s),x=W/2-w/2;ctx.save();ctx.globalAlpha=a;
  ctx.fillStyle='rgba(5,9,9,.55)';ctx.fillRect(x,y,w,h);ctx.fillStyle=bn.color;const t=Math.max(1,Math.round(s*.6));ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),t);ctx.fillRect(Math.round(x),Math.round(y+h)-t,Math.round(w),t);
  ctx.fillRect(Math.round(x),Math.round(y),t,Math.round(5*s));ctx.fillRect(Math.round(x+w)-t,Math.round(y+h-5*s),t,Math.round(5*s));
  hudText(bn.en.replace(/!/g,'').trim(),W/2,y+6*s,8.5*s,bn.color,.5,.42);hudText(bn.jp,W/2,y+h-12*s,6*s,HUD.dim,.5,.2);ctx.restore()}
// Full-screen cut-in for FRAME LOST / SECTOR CLEAN: AOI's bust slides in behind the result panel.
const cutCache={};
function cutPlate(kind){if(cutCache[kind])return cutCache[kind];const k=kind==='down'?'bust_shout':'bust_cheer';if(!pilotReady(k))return null;const c=makeCanvas();if(!c)return null;c.width=640;c.height=720;const g=c.getContext('2d');
  g.drawImage(pilotImg[k],0,0);g.globalCompositeOperation='source-atop';g.fillStyle=kind==='down'?'rgba(255,60,40,.26)':'rgba(70,255,220,.10)';g.fillRect(0,0,640,720);
  g.globalCompositeOperation='destination-in';const fade=g.createLinearGradient(0,0,0,720);fade.addColorStop(0,'rgba(0,0,0,1)');fade.addColorStop(.72,'rgba(0,0,0,1)');fade.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=fade;g.fillRect(0,0,640,720);
  // The plate is cut close round the head, and in the cheer AOI's raised fist meets its left edge: a hard
  // edge left a sliver of hand standing in the air. The left edge dissolves instead (the right one is off screen).
  const side=g.createLinearGradient(0,0,110,0);side.addColorStop(0,'rgba(0,0,0,0)');side.addColorStop(1,'rgba(0,0,0,1)');g.fillStyle=side;g.fillRect(0,0,640,720);return cutCache[kind]=c}
// The plate's top edge stays above the screen (rotation and bob included): AOI's source art ends at her
// crown, so a visible top edge would cut her hair flat.
function drawPilotCut(){const c=pilot.cut;if(!c)return;const plate=cutPlate(c.kind);if(!plate)return;
  const t=c.t,e=1-Math.pow(1-clamp(t/.45,0,1),3),a=clamp(t/.2,0,1),h=H*.92,w=h*640/720,x=W-w*.92+(1-e)*w*.5,y=-H*.035+(c.kind==='down'?Math.sin(t*2)*4:0);
  ctx.save();ctx.globalAlpha=a*.9;ctx.translate(x+w/2,y+h/2);ctx.rotate((c.kind==='down'?-.05:.03)*(1-e*.4));ctx.drawImage(plate,-w/2,-h/2,w,h);ctx.restore()}
// ---------- AOI VOICE ----------
// Drop-in voice: design/AOI_VOICE_SCRIPT.md + assets/voice/aoi_lines.csv define every line (id, event,
// priority, cooldown, face, text). Any assets/voice/aoi_<id>.(wav|ogg|mp3|webm) that exists is played
// for its event; missing files are simply silent. Lines play the moment the event happens (never on
// the music grid), through a radio band-pass, with the music ducked, AOI's face held for the clip
// and a Japanese subtitle line in the LOG.
const vox={lines:[],byEvent:{},raw:{},buf:{},cool:{},lastId:{},cur:null,curPrio:-1,curEnd:0,lastEnd:-9,decoding:false,pending:null,ready:false};
const VOX_BASE=PILOT_BASE+'assets/voice/';
function voxParseCSV(t){const rows=[];let row=[],cell='',q=false;for(let i=0;i<t.length;i++){const c=t[i];
    if(q){if(c==='"'){if(t[i+1]==='"'){cell+='"';i++}else q=false}else cell+=c}
    else if(c==='"')q=true;else if(c===','){row.push(cell);cell=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&t[i+1]==='\n')i++;row.push(cell);cell='';if(row.length>1)rows.push(row);row=[]}else cell+=c}
  if(cell||row.length){row.push(cell);if(row.length>1)rows.push(row)}return rows}
function voxSetLines(csvText){const rows=voxParseCSV(csvText.replace(/^﻿/,''));const head=rows.shift()||[],ix=k=>head.indexOf(k);vox.lines.length=0;vox.byEvent={};
  for(const r of rows){const L={id:r[ix('id')],event:r[ix('event')],prio:+r[ix('priority')]||0,cool:+r[ix('cooldown_s')]||0,face:(r[ix('face')]||'').split('→').pop().trim(),text:r[ix('text')]||''};if(!L.id||!L.event)continue;vox.lines.push(L);(vox.byEvent[L.event]=vox.byEvent[L.event]||[]).push(L)}}
// Load the script and whatever audio files exist. A directory listing (launch.py serves one) avoids
// probing every id; without it each id is probed once per extension.
async function voxLoad(){if(typeof fetch==='undefined')return;
  try{const r=await fetch(VOX_BASE+'aoi_lines.csv',{cache:'no-store'});if(!r.ok)return;voxSetLines(await r.text())}catch{return}
  let names=null;try{const r=await fetch(VOX_BASE,{cache:'no-store'});if(r.ok){const html=await r.text();names=[...html.matchAll(/href="([^"]+)"/g)].map(m=>decodeURIComponent(m[1]))}}catch{}
  const exts=['wav','ogg','mp3','webm'];
  await Promise.all(vox.lines.map(async L=>{let file=null;if(names){for(const e of exts)if(names.includes(`aoi_${L.id}.${e}`)){file=`aoi_${L.id}.${e}`;break}if(!file)return}
    for(const e of file?[null]:exts){const f=file||`aoi_${L.id}.${e}`;try{const r=await fetch(VOX_BASE+f);if(r.ok){vox.raw[L.id]=await r.arrayBuffer();return}}catch{}}}));
  vox.ready=true}
if(typeof window!=='undefined'&&typeof fetch!=='undefined')voxLoad();
// Decode once the AudioContext exists (it needs a user gesture), then run any line that was waiting.
function voxTick(){if(!ac||!vox.ready)return;
  if(!vox.decoding){const ids=Object.keys(vox.raw);if(ids.length){vox.decoding=true;Promise.all(ids.map(id=>{const b=vox.raw[id];delete vox.raw[id];return ac.decodeAudioData(b).then(buf=>{vox.buf[id]=buf}).catch(()=>{})})).then(()=>{vox.decoding=false})}}
  if(vox.pending&&!vox.decoding){const p=vox.pending;if(performance.now()-p.t>2500)vox.pending=null;else if(say(p.event,p.chance,true))vox.pending=null}
  if(vox.cur&&ac.currentTime>=vox.curEnd){vox.cur=null;vox.curPrio=-1}}
function voxDuck(dur){const t=ac.currentTime,g=musicDuck.gain;g.cancelScheduledValues(t);g.setValueAtTime(g.value,t);g.linearRampToValueAtTime(.5,t+.06);g.setValueAtTime(.5,t+dur);g.setTargetAtTime(music.menu?.42:1,t+dur,.18)}
// say(event): returns true if a line started. chance < 1 thins frequent events (single kills).
function say(event,chance=1,fromQueue=false){
  if(!ac||!musicDuck)return false;const all=vox.byEvent[event];if(!all)return false;const have=all.filter(L=>vox.buf[L.id]);
  if(!have.length){if(!fromQueue&&(vox.decoding||!vox.ready)&&all[0].prio>=2)vox.pending={event,chance,t:performance.now()};return false}
  const now=ac.currentTime,P=have[0].prio;if(now<(vox.cool[event]||0))return false;if(chance<1&&Math.random()>chance)return false;
  const busy=vox.cur&&now<vox.curEnd;
  if(busy&&!(P>=3||(P===2&&vox.curPrio<=1)))return false;if(!busy&&P===0&&now-vox.lastEnd<3)return false;
  const pool=have.length>1?have.filter(L=>L.id!==vox.lastId[event]):have,L=pool[Math.floor(Math.random()*pool.length)],buf=vox.buf[L.id];
  if(busy&&vox.cur){try{vox.cur.stop()}catch{}}
  // Radio voice: band-limit, presence lift, light saturation, squelch ticks at both ends.
  const src=ac.createBufferSource();src.buffer=buf;const hp=ac.createBiquadFilter();hp.type='highpass';hp.frequency.value=260;const pk=ac.createBiquadFilter();pk.type='peaking';pk.frequency.value=1900;pk.Q.value=.8;pk.gain.value=4;
  const lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.value=4200;const sh=ac.createWaveShaper();sh.curve=softClipCurve(1.6);const g=ac.createGain();g.gain.value=.95;
  src.connect(hp).connect(pk).connect(lp).connect(sh).connect(g).connect(master);src.start(now+.03);
  const dur=buf.duration+.03;burst({t:now,hp:2600,lp:7000,d:.035,g:.03,pri:3});burst({t:now+dur,hp:2600,lp:7000,d:.05,g:.025,pri:3});
  vox.cur=src;vox.curPrio=P;vox.curEnd=now+dur;vox.lastEnd=now+dur;vox.lastId[event]=L.id;vox.cool[event]=now+L.cool;voxDuck(dur);
  if(L.face&&PILOT_EXPR.includes(L.face))pilotReact(L.face,Math.max(.8,dur+.2),Math.max(1,P));
  if(L.text)plog('AOI',L.text);
  return true}
// Contact lines: the class-specific callout when one exists, otherwise the generic one.
function sayContact(e){if(!(Math.random()<.6&&say('CONTACT_'+(RIGS[e.type]?.name||e.type))))say('CONTACT')}
// ---------- GLOW ----------
// Bloom: the frame is thresholded, downsampled twice and added back. All emissive work above
// (additive neon strokes, shards, motes, shock rings) is authored to feed this pass.
const makeCanvas=()=>document.createElement?document.createElement('canvas'):null;
const bloomA=makeCanvas(),bloomB=makeCanvas(),bA=bloomA?.getContext('2d'),bB=bloomB?.getContext('2d');
let fxHigh=true;try{fxHigh=localStorage.getItem('hf.fx')!=='low'}catch{}
const filterOK=!!bA&&(()=>{try{bA.filter='blur(2px)';const ok=bA.filter==='blur(2px)';bA.filter='none';return ok}catch{return false}})();
function applyBloom(){
  if(!bA||!bB||!fxHigh||threeWorldFrame)return; // the WebGL world pass blooms on the GPU
  const cw=canvas.width,ch=canvas.height,aw=Math.max(2,cw>>2),ah=Math.max(2,ch>>2),bw=Math.max(2,aw>>1),bh=Math.max(2,ah>>1);
  if(bloomA.width!==aw||bloomA.height!==ah){bloomA.width=aw;bloomA.height=ah;bloomB.width=bw;bloomB.height=bh}
  bA.globalCompositeOperation='copy';bA.filter=filterOK?'brightness(1.1) contrast(2.3) blur(1.2px)':'none';bA.drawImage(canvas,0,0,aw,ah);
  if(bloomMask.length){const k=aw/cw*DPR,V=viewTransform;bA.save();bA.globalCompositeOperation='source-over';bA.filter='none';bA.setTransform(k,0,0,k,0,0);bA.translate(V.dx||0,V.dy||0);bA.translate(W/2,H/2);bA.rotate(V.roll||0);bA.translate(-W/2,-H/2);bA.fillStyle=bA.strokeStyle='#000';bA.lineWidth=1.5;bA.lineJoin='round';bA.lineWidth=1.5/k;bA.beginPath();for(const q of bloomMask){bA.moveTo(q[0].x,q[0].y);for(let i=1;i<q.length;i++)bA.lineTo(q[i].x,q[i].y);bA.closePath()}bA.fill();bA.stroke();bA.restore()}
  bB.globalCompositeOperation='copy';bB.filter=filterOK?'blur(2.4px)':'none';bB.drawImage(bloomA,0,0,bw,bh);
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='lighter';ctx.imageSmoothingEnabled=true;
  ctx.globalAlpha=filterOK?.80:.30;ctx.drawImage(bloomA,0,0,cw,ch);ctx.globalAlpha=filterOK?.70:.26;ctx.drawImage(bloomB,0,0,cw,ch);ctx.restore();
}
function setFx(high){fxHigh=high;try{localStorage.setItem('hf.fx',high?'high':'low')}catch{}$('fx').textContent=high?'GLOW : HIGH':'GLOW : LOW'}
function render(){poseFrame++;bloomMask.length=0;worldGlow=1+syncMix*.6;const head=headYaw*Math.PI/180,sc=player.scope||0,viewYaw=lerp(player.yaw+head,player.yaw+player.torso,sc)+axeSway(),viewPitch=lerp(player.camPitch+player.inertiaPitch+headPitch*Math.PI/180,player.pitch,sc);renderFocal=W*(.88-.12*player.fovKick-.08*(player.boostTime>0?1:0))*(1+(ARBALEST.zoom-1)*sc);ctx.save();const shake=player.shake,dx=(Math.random()-.5)*shake*10,dy=(Math.random()-.5)*shake*7;Object.assign(viewTransform,{dx,dy,roll:player.roll+player.inertiaRoll-axeSway()*.5});ctx.translate(dx,dy);ctx.translate(W/2,H/2);ctx.rotate(viewTransform.roll);ctx.translate(-W/2,-H/2);drawWorld(viewYaw,viewPitch);ctx.restore();applyBloom();drawFeedDamage();drawPilotCut();drawPilotLink();drawSignalFX();updateHud(viewYaw,viewPitch)}
const perf={avg:16.7,t:0,auto:!new URLSearchParams(location.search).has('noautofx')};
// A single exception must never stop the frame loop (that is a hard freeze): the frame is dropped, the
// canvas state reset, and the error goes to the console, window.__hfErrors and once per message to the LOG.
const frameErrors=new Map();
function reportFrameError(err){const msg=String(err&&err.message||err);console.error(err);try{(window.__hfErrors=window.__hfErrors||[]).push({t:gameTime,msg,stack:String(err&&err.stack||'')})}catch{}
  try{ctx.restore();ctx.restore()}catch{}try{ctx.setTransform(DPR,0,0,DPR,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.filter='none';ctx.shadowBlur=0}catch{}lineBatch=null;
  if(!frameErrors.has(msg)){frameErrors.set(msg,1);try{plog('Warning','-ERR '+msg.slice(0,36))}catch{}}}
function loop(now){try{const raw=now-last,dt=clamp(raw/1000,0,.05);last=now;if(playing&&fxHigh&&perf.auto&&raw<200){perf.avg=lerp(perf.avg,raw,.02);perf.t+=dt;if(perf.t>3&&perf.avg>26){fxHigh=false;$('fx').textContent='GLOW : LOW (AUTO)';plog('System','Glow auto low.')}}else perf.t=0;updateHead(now,dt);music.menu=!playing;audioTick(dt);if(playing){if(hitStop>0)hitStop=Math.max(0,hitStop-dt);else{gameTime+=dt;update(dt)}}updatePilot(dt);updateVisorFX(playing&&hitStop<=0?dt:0);voxTick();if(canvas.width>0&&canvas.height>0)render()}catch(err){reportFrameError(err)}requestAnimationFrame(loop)}
requestAnimationFrame(loop);

// ---------- CONTROLS ----------
// The next sector is a fresh sortie: the frame is repaired and rearmed, and its figures start again.
function nextSector(){stage=Math.min(LAST_SECTOR,stage+1);reset();say('SORTIE')}
function startGame(lock=true){
  ensureAudio();playing=true;if(bootPending){bootPending=false;hmdBoot=performance.now()}boot.classList.add('hidden');hud.classList.remove('hidden');canvas.focus?.();
  if(lock){
    const failed=()=>{pause();$('status').textContent='POINTER LOCK UNAVAILABLE / OPEN IN CHROME OR EDGE'};
    try{if(canvas.requestPointerLock){const pending=canvas.requestPointerLock();pending?.catch(failed)}else failed()}
    catch{failed()}
  }
  if(playing){if(!say('SORTIE'))vox.pending={event:'SORTIE',chance:1,t:performance.now()};plog('System','-Armament online [HALBERD 30mm].');plog('Info','Track with the head. The frame turns slow.');pilotReact('closed',.75,1)}
}
$('resultKeys').addEventListener('click',e=>{const a=e.target?.closest?.('button')?.dataset?.act;if(!a||!playing)return;sfx.ui();if(a==='menu'){pause();return}
  if(a==='next')nextSector();else if(a==='restart'){stage=1;reset();say('SORTIE')}else{reset();say('REDEPLOY')}canvas.focus?.();try{canvas.requestPointerLock?.()?.catch?.(()=>{})}catch{}});
$('play').addEventListener('click',()=>{if(mode!=='sortie')setMode('sortie');startGame(true)});
$('endure').addEventListener('click',()=>{if(mode!=='endurance')setMode('endurance');startGame(true)});
if(endure.best)$('status').textContent=`READY / ENDURANCE BEST ${endure.best.kills} BREAK ${fmtTime(endure.best.time)}`;
function clearInput(){keys.clear();mouseButtons.clear();boostLatch=false}
function pause(){playing=false;clearInput();boot.classList.remove('hidden');hud.classList.add('hidden');updateEngine(0,false)}
document.addEventListener('pointerlockchange',()=>{if(playing&&player.alive&&!missionClear&&document.pointerLockElement!==canvas&&!new URLSearchParams(location.search).has('demo'))pause()});
document.addEventListener('mousemove',e=>{if(!playing||(!new URLSearchParams(location.search).has('demo')&&document.pointerLockElement!==canvas)||!player.alive)return;const ms=+mouseSens.value/(1+(ARBALEST.zoom-1)*(player.scope||0));player.aimYawTarget+=e.movementX*.00135*ms;player.aimPitchTarget-=e.movementY*.00125*ms});
document.addEventListener('mousedown',e=>{mouseButtons.add(e.button);if(e.button===0)fire(true);if(e.button===1||e.button===2){e.preventDefault?.();toggleScope()}});document.addEventListener('mouseup',e=>mouseButtons.delete(e.button));document.addEventListener('contextmenu',e=>e.preventDefault());
// One wheel gesture = one swap (touchpads send a burst of wheel events).
document.addEventListener('wheel',e=>{if(!playing||Math.abs(e.deltaY)<1)return;const now=performance.now();if(now-wheelT<350)return;wheelT=now;switchWeapon('other')},{passive:true});
document.addEventListener('keydown',e=>{if(e.code==='Escape'){if(playing){pause();document.exitPointerLock?.()}return}if(!playing&&e.code!=='KeyC'&&e.code!=='KeyR')return;keys.add(e.code);if(e.code==='Space'){e.preventDefault?.();if(!e.repeat)doJump()}if((e.code==='ShiftLeft'||e.code==='ShiftRight')&&!boostLatch){boostLatch=true;doBoost()}if(e.code==='KeyC'&&!e.repeat)centerHead();if(!e.repeat&&(e.code==='Digit1'||e.code==='Digit2'||e.code==='Digit3'))switchWeapon(e.code==='Digit1'?'HALBERD':e.code==='Digit2'?'second':'BARDICHE');if(e.code==='KeyV'&&!e.repeat)swingAxe(true);if(e.code==='KeyF'&&!e.repeat)toggleScope();if(e.code==='KeyX'&&!e.repeat)switchWeapon('other');if(e.code==='KeyR'&&!e.repeat&&(!player.alive||missionClear)){reset();say('REDEPLOY')}if((e.code==='Enter'||e.code==='NumpadEnter')&&!e.repeat&&missionClear&&player.alive&&mode==='sortie'&&stage<LAST_SECTOR)nextSector()});
document.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='ShiftLeft'||e.code==='ShiftRight')boostLatch=false});
$('head').addEventListener('click',toggleHead);$('fx').addEventListener('click',()=>{setFx(!fxHigh);sfx.ui()});setFx(fxHigh);$('reset').addEventListener('click',()=>{stage=1;reset();$('status').textContent='MISSION RESET'});$('full').addEventListener('click',async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch{$('status').textContent='FULLSCREEN ERROR'}});
function bind(inp,out,suffix,digits){const f=()=>out.textContent=(+inp.value).toFixed(digits)+suffix;inp.addEventListener('input',f);f()}bind(mouseSens,$('sensout'),'×',2);bind(gain,$('gainout'),'×',2);bind(dead,$('deadout'),'°',1);bind(smooth,$('smoothout'),'',2);
addEventListener('blur',()=>{clearInput();if(playing)pause()});
addEventListener('beforeunload',()=>{if(stream)stream.getTracks().forEach(t=>t.stop());headWorker?.terminate()});
reset();
if(new URLSearchParams(location.search).has('demo'))setTimeout(()=>startGame(false),80);
})();
