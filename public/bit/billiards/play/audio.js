// Billiards' sounds. The table's sounds are real recordings (Freesound, CC0, see README), each hit a single cut of
// a recording played exactly as recorded, only at a gain: no filters, no pitch shifts beyond a small wobble.
// The recordings stay whole in sounds/ and a cut is an offset and a length into one (CUTS).
// Until they load, a short synthesized knock stands in.

const FILES={
  rail:'sounds/42364_450724-hq.mp3',        // Freesound #42364 "pool-ball-bounce-off-rail.wav" (picked by ear 2026-11-18)
  strike:'sounds/763603_15688677-hq.mp3',   // ChloePieterse "Pool Ball Strike"
  clack:'sounds/539854_12029332-hq.mp3',    // Za-Games "billiard ball clack"
  sink:'sounds/763601_15688677-hq.mp3',     // ChloePieterse "Pool Ball Sinking"
  hits:'sounds/62331_791247-hq.mp3',        // bsumusictech "Pool balls.wav"
  clatter:'sounds/763602_15688677-hq.mp3',  // ChloePieterse's clatter (the rack at START, 2026-11-18)
};
// [file, start s, length s, gain]: picked by ear and by the waveform (sounds-src/cuts.md)
// (onsets found from the waveform's 5 ms peaks: each cut starts 10 ms before its hit and ends before the next sound)
export const CUTS={
  cue:[['strike',0.26,0.17],['strike',1.82,0.16],['strike',3.565,0.17]],
  ball:[['hits',2.295,0.2],['hits',7.245,0.13],['hits',13.47,0.22],['hits',16.19,0.18],['hits',21.345,0.17],['hits',27.525,0.1,1.05],
    ['clack',0,0.24,0.9]],
  pocket:[['sink',0.81,0.58],['sink',2.5,0.8],['sink',3.81,0.9],['sink',11.265,0.85],['sink',18.475,0.75],['sink',25.865,0.75]],
  // the one hit in the rail recording (the others' rail-less recordings were all "none of these")
  cushion:[['rail',0.355,0.3]],
  // the balls gathered into the rack: the recording's first burst (found from the waveform, not yet by ear)
  rack:[['clatter',0.47,0.9]],
};
// the menus' sounds are the table's own (2026-11-18, "the old games' manners: a sound for every button"):
// choosing, a light click of two balls; deciding, the cue's strike; going back, a ball into the cushion
const UI={select:[CUTS.ball[6],0.2],decide:[CUTS.cue[1],0.42],back:[CUTS.cushion[0],0.4]};

// ---------- BGM: a jazz bar's trio, written in code (as AIR HOCKEY's songs are) ----------
// Medium swing at 104 BPM in F, a 16-bar loop. Each bar is 12 triplet-eighths: a swung pair of eighths is the
// steps 0 and 2 of a beat. An upright bass walks in quarters, an electric piano comps (Charleston and its kin)
// and plays a sparse tune, brushes and a ride keep time.
const midi=n=>440*Math.pow(2,(n-69)/12);
const PC={C:0,Db:1,D:2,Eb:3,E:4,F:5,Gb:6,G:7,Ab:8,A:9,Bb:10,B:11};
// rootless voicings (intervals over the root)
const VOICE={maj7:[4,7,11,14],m7:[3,7,10,14],'7':[4,9,10,14],'7b9':[4,9,10,13]};
// chord tones the bass may walk on (beats 2 and 3)
const WALK={maj7:[4,7,9],m7:[3,7,5],'7':[4,7,9],'7b9':[4,7,10]};
// [root, kind] for the bar, or for each half of it
const FORM=[
  [['F','maj7']],[['D','7b9']],[['G','m7']],[['C','7']],
  [['A','m7']],[['D','7']],[['G','m7']],[['C','7']],
  [['C','m7']],[['F','7']],[['Bb','maj7']],[['Bb','m7'],['Eb','7']],
  [['A','m7']],[['D','7b9']],[['G','m7']],[['C','7']],
];
// the piano's rhythm, bar by bar in turn: [step, length in steps]
const COMP=[[[0,4],[5,2]],[[5,3],[11,1]],[[0,3],[8,2]],[[2,2],[5,3],[11,1]]];
// the tune: {step: note} per bar
const TUNE=[
  {3:69,5:72,6:76,9:74},{0:72,6:69,9:66},{0:67},{5:70,6:69,9:67,11:64},
  {0:72,3:76,5:79},{0:78,6:76,9:72},{0:74,5:70,6:69,9:67},{0:64,11:65},
  {0:67,3:70,5:75,9:74},{0:75,6:72,9:69},{0:74,6:69,9:70},{0:73,6:70,9:67},
  {0:72,5:76,9:74},{0:72,6:69,9:66},{0:67,5:70,9:74},{0:76,6:72,9:70,11:69},
];
const BPM=104;

export class Sound{
  constructor(){
    this.ctx=null;this.on=true;this.bufs={};this.loading=false;
    try{this.on=localStorage.getItem('bl-sound')!=='0'}catch{}
  }
  // only from a user's tap (iOS gives the right to play sound to touchend / pointerup / click)
  unlock(){
    if(!this.ctx){
      const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
      this.ctx=new C();
      this.out=this.ctx.createGain();this.out.gain.value=this.on?1:0;this.out.connect(this.ctx.destination);
      this.load();
    }
    if(this.ctx.state!=='running')this.ctx.resume().catch(()=>{});
  }
  setOn(on){
    this.on=on;try{localStorage.setItem('bl-sound',on?'1':'0')}catch{}
    if(this.out)this.out.gain.setTargetAtTime(on?1:0,this.ctx.currentTime,0.02);
  }
  async load(){
    if(this.loading)return;this.loading=true;
    await Promise.all(Object.entries(FILES).map(async([k,u])=>{
      try{const r=await fetch(u);this.bufs[k]=await this.ctx.decodeAudioData(await r.arrayBuffer())}catch{}
    }));
  }
  ready(){return this.ctx&&this.ctx.state==='running'}
  // a cut, at gain g; pan -1..1
  cut(list,g,pan=0){
    const c=list[(Math.random()*list.length)|0];
    if(!c)return false;
    const buf=this.bufs[c[0]];if(!buf)return false;
    const t=this.ctx.currentTime,src=this.ctx.createBufferSource();
    src.buffer=buf;src.playbackRate.value=1+(Math.random()-0.5)*0.06;
    const gn=this.ctx.createGain(),lv=g*(c[3]??1)*(1+(Math.random()-0.5)*0.2);
    // only a 15 ms fade at the cut's end, so it doesn't stop on a click
    gn.gain.setValueAtTime(lv,t);gn.gain.setValueAtTime(lv,t+c[2]-0.015);gn.gain.linearRampToValueAtTime(0,t+c[2]);
    let node=gn;
    if(this.ctx.createStereoPanner){const p=this.ctx.createStereoPanner();p.pan.value=pan;gn.connect(p);node=p}
    src.connect(gn);node.connect(this.out);
    src.start(t,c[1],c[2]);
    return true;
  }
  // stand-in knock: a short tone with a click, ringing like a phenolic ball (freq Hz, decay s)
  knock(g,freq,decay,pan=0,noise=0.5){
    const ctx=this.ctx,t=ctx.currentTime;
    const o=ctx.createOscillator(),og=ctx.createGain();
    o.frequency.value=freq*(1+(Math.random()-0.5)*0.04);
    og.gain.setValueAtTime(g,t);og.gain.exponentialRampToValueAtTime(0.0005,t+decay);
    o.connect(og);
    const len=Math.ceil(ctx.sampleRate*0.012),nb=ctx.createBuffer(1,len,ctx.sampleRate),d=nb.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len)**3;
    const n=ctx.createBufferSource();n.buffer=nb;const ng=ctx.createGain();ng.gain.value=g*noise;n.connect(ng);
    let dst=this.out;
    if(ctx.createStereoPanner){const p=ctx.createStereoPanner();p.pan.value=pan;p.connect(this.out);dst=p}
    og.connect(dst);ng.connect(dst);
    o.start(t);o.stop(t+decay+0.02);n.start(t);
  }
  // v: the impact's speed in m/s
  ball(v,pan){
    if(!this.ready())return;
    const g=Math.min(1,0.08+v/3.2)**1.2;
    if(!this.cut(CUTS.ball,g,pan))this.knock(g*0.5,2650,0.05,pan,0.9);
  }
  cue(v,pan){
    if(!this.ready())return;
    const g=Math.min(1,0.2+v/7);
    if(!this.cut(CUTS.cue,g,pan))this.knock(g*0.35,1400,0.04,pan,1.2);
  }
  cushion(v,pan){
    if(!this.ready())return;
    // (the synthesized knock that stood in was a tenth of a ball's click and went unheard: "クッション聞こえない")
    const g=Math.min(1,v/2.5)**1.1;
    if(g<0.03)return;
    if(!this.cut(CUTS.cushion,g,pan))this.knock(g*0.5,180,0.07,pan,0.25);
  }
  pocket(v,pan){
    if(!this.ready())return;
    const g=Math.min(1,0.4+v/3);
    if(!this.cut(CUTS.pocket,g,pan))this.knock(g*0.4,220,0.18,pan,0.4);
  }

  // ---- the game's manners (2026-11-18): buttons, the rack, jingles in the trio's own voices ----
  ui(kind){if(!this.ready())return;const [c,g]=UI[kind];this.cut([c],g)}
  rack(){if(!this.ready())return;this.cut(CUTS.rack,0.7)}
  // the result's numbers, set down like a ball
  tick(){if(!this.ready())return;this.cut([CUTS.ball[6]],0.35)}
  noise(){
    if(!this.noiseBuf){
      const c=this.ctx,n=c.createBuffer(1,c.sampleRate,c.sampleRate),d=n.getChannelData(0);
      for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
      this.noiseBuf=n;
    }
    return this.noiseBuf;
  }
  // a short phrase on its own bus, a little over the BGM
  jingle(play,lv=0.42){
    if(!this.ready())return;
    const c=this.ctx,bus=c.createGain();bus.gain.value=lv;bus.connect(this.out);
    this.noise();play(c.currentTime+0.03,bus);
    setTimeout(()=>bus.disconnect(),4500);
  }
  chord(notes,t,dur,g,bus){for(const n of notes)this.epiano(midi(n),t,dur,g,bus)}
  // BREAK: a swung pickup up to F6/9, the bass and the ride on the landing
  breakJingle(){this.jingle((t,b)=>{
    const e=60/BPM/3;
    this.epiano(midi(72),t,e*2,0.07,b);this.epiano(midi(74),t+e*2,e,0.07,b);this.epiano(midi(77),t+e*3,e*2,0.08,b);
    this.chord([69,74,79],t+e*5,e*6,0.06,b);this.bass(midi(41),t+e*5,e*6,0.34,b);this.ride(t+e*5,0.035,b);
  })}
  // your turn: two soft notes
  turnChime(){this.jingle((t,b)=>{this.epiano(midi(81),t,0.12,0.05,b);this.epiano(midi(77),t+0.15,0.3,0.05,b)},0.38)}
  // 9-BALL! / 8-BALL!: a run up into Fmaj9
  potJingle(){this.jingle((t,b)=>{
    const e=60/BPM/3;
    [72,76,79,81].forEach((n,i)=>this.epiano(midi(n),t+i*e,e,0.07,b));
    this.chord([69,76,79,84],t+e*4,e*8,0.06,b);this.bass(midi(41),t+e*4,e*8,0.34,b);this.ride(t+e*4,0.04,b);
  })}
  // FOUL: two tritones stepping down a half tone, low
  foulJingle(){this.jingle((t,b)=>{
    this.chord([56,62],t,0.16,0.07,b);this.bass(midi(42),t,0.16,0.3,b);
    this.chord([55,61],t+0.24,0.4,0.07,b);this.bass(midi(41),t+0.24,0.4,0.32,b);
  })}
  // the match won: ii - V - I, the last chord held
  winJingle(){this.jingle((t,b)=>{
    const q=60/BPM;
    this.chord([65,70,74],t,q*0.6,0.06,b);this.bass(midi(43),t,q*0.6,0.32,b);
    this.chord([64,70,76],t+q*0.75,q*0.6,0.06,b);this.bass(midi(36),t+q*0.75,q*0.6,0.32,b);
    this.chord([64,67,69,74],t+q*1.5,q*3,0.06,b);this.epiano(midi(81),t+q*1.5,q*3,0.08,b,1.6);
    this.bass(midi(41),t+q*1.5,q*3,0.36,b);this.ride(t+q*1.5,0.045,b);
  })}
  // lost: a line sliding down to F minor
  loseJingle(){this.jingle((t,b)=>{
    [69,68,67,66].forEach((n,i)=>this.epiano(midi(n),t+i*0.22,0.2,0.07,b));
    this.chord([56,60,67],t+0.9,1.3,0.06,b);this.bass(midi(41),t+0.9,1.3,0.32,b);
  })}
  // ---- the BGM ----
  bgmStart(){
    if(!this.ctx||this.bgm)return;
    const c=this.ctx,bus=c.createGain();
    bus.gain.setValueAtTime(0.0001,c.currentTime);bus.gain.setTargetAtTime(0.3,c.currentTime,0.4);
    bus.connect(this.out);
    if(!this.noiseBuf){
      const n=c.createBuffer(1,c.sampleRate,c.sampleRate),d=n.getChannelData(0);
      for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
      this.noiseBuf=n;
    }
    this.bgm={bus,step:0,next:c.currentTime+0.15};
    this.bgm.timer=setInterval(()=>this.bgmTick(),25);
  }
  bgmStop(){
    const b=this.bgm;if(!b)return;
    this.bgm=null;clearInterval(b.timer);
    const t=this.ctx.currentTime;b.bus.gain.cancelScheduledValues(t);b.bus.gain.setTargetAtTime(0.0001,t,0.15);
    setTimeout(()=>b.bus.disconnect(),1200);
  }
  bgmTick(){
    const b=this.bgm;if(!b)return;
    const c=this.ctx,dt=60/BPM/3,len=FORM.length*12;
    // a context still waking up (iOS) is waited for, not raced
    if(c.state!=='running'){b.next=c.currentTime+0.15;return}
    while(b.next<c.currentTime+0.15){this.jazzStep(b.step,b.next,dt,b.bus);b.step=(b.step+1)%len;b.next+=dt}
  }
  chordAt(bar,step){const f=FORM[bar];return f[f.length>1&&step>=6?1:0]}
  jazzStep(s,t,dt,bus){
    const bar=Math.floor(s/12),i=s%12,beat=i/3;
    const [root,kind]=this.chordAt(bar,i),rp=PC[root];
    // the bass walks: the root on 1 (and on 3 under a second chord), chord tones on 2 and 3, a half step into
    // the next bar's root on 4
    if(i%3===0){
      let n;
      if(beat===0||(FORM[bar].length>1&&beat===2))n=rp;
      else if(beat===3){const [nr]=this.chordAt((bar+1)%FORM.length,0);n=PC[nr]+(bar%2?1:-1)}
      else n=rp+WALK[kind][(beat+bar)%3];
      let m=36+((n%12)+12)%12;if(m>45)m-=12;
      this.bass(midi(m),t,dt*3*0.95,beat===0?0.32:0.26,bus);
    }
    // the piano comps, its voicing kept round middle C
    for(const [st,l] of COMP[bar%4])if(st===i){
      const vc=VOICE[kind];let base=rp+48;
      while(base+vc[0]<53)base+=12;while(base+vc[0]>62)base-=12;
      for(const v of vc)this.epiano(midi(base+v),t,dt*l,0.045,bus);
    }
    const tn=TUNE[bar][i];
    if(tn)this.epiano(midi(tn),t,dt*4,0.08,bus,1.6);
    // the ride: ding, ding-da, ding, ding-da; the hi-hat's foot and a brush tap on 2 and 4
    if(i===0||i===3||i===5||i===6||i===9||i===11)this.ride(t,i===5||i===11?0.02:0.032,bus);
    if(i===3||i===9){this.chick(t,0.03,bus);this.brush(t,0.05,bus)}
    // a brush swirling through each beat, very low
    if(i%3===0)this.swirl(t,dt*3,0.012,bus);
  }
  noiseSrc(t,dur){const n=this.ctx.createBufferSource();n.buffer=this.noiseBuf;n.start(t,Math.random()*0.5,dur);return n}
  // an upright bass: a round fundamental, a little second harmonic, the pluck's brightness falling away fast
  bass(f,t,dur,g,dest){
    const c=this.ctx,v=c.createGain(),lp=c.createBiquadFilter();
    lp.type='lowpass';lp.frequency.setValueAtTime(900,t);lp.frequency.exponentialRampToValueAtTime(280,t+0.25);
    v.gain.setValueAtTime(0.0001,t);v.gain.exponentialRampToValueAtTime(g,t+0.012);v.gain.exponentialRampToValueAtTime(g*0.35,t+0.18);
    v.gain.exponentialRampToValueAtTime(0.0001,t+dur+0.12);
    lp.connect(v);v.connect(dest);
    for(const [type,mul,lv] of [['triangle',1,1],['sine',2,0.25]]){
      const o=c.createOscillator(),og=c.createGain();o.type=type;o.frequency.value=f*mul;og.gain.value=lv;
      o.connect(og);og.connect(lp);o.start(t);o.stop(t+dur+0.15);
    }
  }
  // an electric piano: a sine with a decaying sine modulator (the tine's bark) and a long soft body
  epiano(f,t,dur,g,dest,ring=1){
    const c=this.ctx,car=c.createOscillator(),mod=c.createOscillator(),mg=c.createGain(),v=c.createGain();
    car.frequency.value=f;mod.frequency.value=f;
    mg.gain.setValueAtTime(f*1.6,t);mg.gain.exponentialRampToValueAtTime(f*0.05,t+0.35);
    mod.connect(mg);mg.connect(car.frequency);
    const hold=Math.max(dur,0.12),end=t+hold+0.5*ring;
    v.gain.setValueAtTime(0.0001,t);v.gain.exponentialRampToValueAtTime(g,t+0.006);
    v.gain.exponentialRampToValueAtTime(g*0.4,t+0.3);v.gain.exponentialRampToValueAtTime(g*0.25,t+hold+0.3);
    v.gain.exponentialRampToValueAtTime(0.0001,end+0.3);
    car.connect(v);v.connect(dest);
    car.start(t);mod.start(t);car.stop(end+0.35);mod.stop(end+0.35);
  }
  // the ride: metallic partials through a high pass, and a little noise for the stick
  ride(t,g,dest){
    const c=this.ctx,hp=c.createBiquadFilter(),v=c.createGain();
    hp.type='highpass';hp.frequency.value=5200;
    v.gain.setValueAtTime(g,t);v.gain.exponentialRampToValueAtTime(0.0001,t+0.9);
    hp.connect(v);v.connect(dest);
    for(const fr of [3215,4102,5179,6020,7414,8551]){
      const o=c.createOscillator(),og=c.createGain();o.type='square';o.frequency.value=fr;og.gain.value=0.16;
      o.connect(og);og.connect(hp);o.start(t);o.stop(t+0.95);
    }
    const n=this.noiseSrc(t,0.05),ng=c.createGain();
    ng.gain.setValueAtTime(0.6,t);ng.gain.exponentialRampToValueAtTime(0.001,t+0.04);n.connect(ng);ng.connect(hp);
  }
  chick(t,g,dest){
    const c=this.ctx,bp=c.createBiquadFilter(),v=c.createGain();bp.type='bandpass';bp.frequency.value=8000;bp.Q.value=1.2;
    v.gain.setValueAtTime(g,t);v.gain.exponentialRampToValueAtTime(0.0001,t+0.05);
    bp.connect(v);v.connect(dest);this.noiseSrc(t,0.06).connect(bp);
  }
  brush(t,g,dest){
    const c=this.ctx,bp=c.createBiquadFilter(),v=c.createGain();bp.type='bandpass';bp.frequency.value=3200;bp.Q.value=0.7;
    v.gain.setValueAtTime(0.0001,t);v.gain.exponentialRampToValueAtTime(g,t+0.008);v.gain.exponentialRampToValueAtTime(0.0001,t+0.16);
    bp.connect(v);v.connect(dest);this.noiseSrc(t,0.18).connect(bp);
  }
  swirl(t,dur,g,dest){
    const c=this.ctx,bp=c.createBiquadFilter(),v=c.createGain();bp.type='bandpass';bp.Q.value=0.9;
    bp.frequency.setValueAtTime(2200,t);bp.frequency.linearRampToValueAtTime(3600,t+dur);
    v.gain.setValueAtTime(0.0001,t);v.gain.linearRampToValueAtTime(g,t+dur*0.5);v.gain.linearRampToValueAtTime(0.0001,t+dur);
    bp.connect(v);v.connect(dest);this.noiseSrc(t,dur).connect(bp);
  }
}
