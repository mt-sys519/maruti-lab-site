// All sounds are synthesized: a cheap, well-used arcade table.
const PRESET={
  // mallet on puck: unused, kin() plays it (kept for reference)
  mallet:{f:3050,click:6200,cg:.9,modes:[[1,.3,.11],[1.52,.15,.07],[2.31,.08,.045],[3.17,.04,.03]],body:900,bg:.06,bd:.02},
  // puck on the side rail: unused, rail() plays it (kept for reference)
  wall:{f:780,click:2400,cg:.8,modes:[[1,.26,.06],[1.71,.1,.035]],body:160,bg:.5,bd:.07},
  // goal post corner
  post:{f:1650,click:4200,cg:.9,modes:[[1,.22,.09],[2.4,.08,.04]],body:300,bg:.25,bd:.04},
  // puck hitting the back of the goal slot, heard through the cabinet
  back:{f:520,click:1500,cg:.6,modes:[[1,.2,.05]],body:110,bg:.6,bd:.09,inside:true},
};

// キン: mallet on puck, its modes taken from measurements of a real table's hits (frequencies only, nothing of the
// recording itself): a beating cluster at 3.6-3.8 kHz that lingers, and a shorter shimmer at 7-10 kHz.
// See strike(): tick = [highpass Hz, gain, decay s], modes = [Hz, time constant s, gain]
// Measured shape: the contact is broadband, then ~10 ms later everything sits ~20 dB under it; the 3.6 kHz
// cluster then fades slowly (-5 dB over 70 ms), the 7-10 kHz shimmer faster (-13 dB)
// (the measured balance left the ring ~34 dB under the tick overall: heard as just チッ, so the ring is raised;
// and kept short, since a ring that lingers reads as metal: plastic is dead after ~40 ms)
// By ear on top of that: the キン held back a little, a カン added (a mid ring at 1.4 / 2.2 kHz), and weight
// (thump = a short triangle falling [from Hz, to Hz, gain, decay s]): the measured recordings were thin
// because the arcade's noise buried everything low
const KIN={gain:1.8,tick:[3000,2.4,.006,6500],thump:[300,170,.3,.06],modes:[[3600,.016,3],[3690,.014,2.4],
  [3790,.013,1.8],[4250,.011,1.2],[6970,.007,.8],[7260,.007,.6],[8760,.008,1.8],[10430,.006,1.1],
  [1420,.02,6],[2230,.016,4.4]]};
// puck on the rail: measured off the same recording, the puck rings with the same modes whatever it hits;
// what the rail adds is more at 0.8-3 kHz, so here the カン and the weight lead and the キン is quieter
const WALL={gain:0.85,tick:[3000,3.6,.008,6000],thump:[230,130,.45,.08],modes:[[3600,.016,1.6],[3690,.014,1.3],
  [3790,.013,1],[4250,.011,.7],[6970,.007,.5],[7260,.007,.4],[8760,.008,1.2],[10430,.006,.8],
  [800,.008,2],[1250,.02,10],[1900,.016,7.6]]};
// recorded sounds, all cut from krb21's "air hockey smack" (CC0) and picked by ear, each played as it is at this
// gain: kin = sounds/kin1-3.wav (7.60 / 9.45 / 13.12 s), rail = rail.wav (4.87 s), corner = corner.wav
// (8.05 s), goal = goal.wav (5.93 s, 0.5 s with the drop). portwain's goals were tried and lost to it
// [gain, ±dB, ±pitch]: every play is a little louder or softer and a little higher or lower, so a run of rail
// hits doesn't sound like one sample. The rail sits ~3 dB under the mallet; the goal well over both
const REC={kin:[1,2,0.03],rail:[0.7,3,0.06],corner:[0.6,2,0.04],goal:[1.6,1,0.02]};
// a goal slower than v (table units/s) is soft: goal.wav from `from` s on (after its slam, ~70 ms), at gain x
// the hard goal's, a little softer still the slower it came
// (CPU goals measured 4-6.5; a soft one is a push or a slow drift in)
const SOFT_GOAL={v:2.5,from:0.075,gain:2};
// a high-Q bandpass passes only a sliver of a short burst, so the modes need some gain to be heard
const MODE_GAIN=3.5;

const midi=n=>440*Math.pow(2,(n-69)/12);
// BGM, written in 16th-note steps (0 = rest).
// groove: normal play. A quiet D-dorian vamp at 112 BPM, Dm7 for two bars then G7 for two:
// a soft kick, a short bass riff, offbeat chord blips and a vibraphone-ish hook now and then.
const GROOVE={
  bpm:112,bars:8,
  chords:[[62,65,69,72],[62,65,69,72],[55,59,62,65],[55,59,62,65]],
  bassRoot:[38,38,43,43],
  bass:{0:0,3:12,6:0,8:3,10:5,12:7,14:10},
  hook:[{0:81,6:84,10:81},{2:79,8:77},{0:79,6:83,10:79},{2:77,8:74},
        {0:81,6:84,10:86},{2:84,8:81},{0:79,6:83,10:86},{4:83,8:79,12:77}],
};
// fever: the MULTI PUCK round. Bright C major at 140 BPM, four on the floor,
// octave disco bass, offbeat chord stabs and a happy lead over C Am F G.
const FEVER={
  bpm:140,bars:8,
  chords:[[60,64,67],[57,60,64],[53,57,60],[55,59,62]],
  bassRoot:[36,33,29,31],
  lead:[
    72,0,76,0, 79,0,84,0, 83,0,79,0, 76,0,79,0,
    81,0,0,79, 0,76,0,0, 72,0,76,0, 79,0,0,0,
    77,0,81,0, 84,0,81,0, 77,0,81,0, 84,0,86,0,
    83,0,0,0, 79,0,0,0, 86,0,84,0, 83,0,81,0,
    72,0,76,0, 79,0,84,0, 83,0,79,0, 76,0,79,0,
    81,0,0,79, 0,76,0,0, 84,0,81,0, 79,0,0,0,
    77,0,81,0, 84,0,89,0, 88,0,86,0, 84,0,81,0,
    83,0,86,0, 91,0,0,0, 91,0,0,0, 79,81,83,86,
  ],
};

export class Sound{
  constructor(){this.ctx=null;this.on=true}

  unlock(){
    if(!this.ctx){
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return;
      this.ctx=new AC();
      this.build();
    }
    if(this.ctx.state!=='running')this.ctx.resume().catch(()=>{});
  }

  get ready(){return this.ctx&&this.ctx.state==='running'}

  setOn(on){
    this.on=on;
    if(this.master)this.master.gain.setTargetAtTime(on?0.9:0,this.ctx.currentTime,0.02);
  }

  build(){
    const c=this.ctx;
    this.master=c.createGain();this.master.gain.value=this.on?0.9:0;
    const comp=c.createDynamicsCompressor();
    comp.threshold.value=-12;comp.knee.value=8;comp.ratio.value=5;comp.attack.value=0.002;comp.release.value=0.12;
    this.master.connect(comp);comp.connect(c.destination);
    // plastic table coloring shared by every hit
    this.box=c.createBiquadFilter();this.box.type='peaking';
    this.box.frequency.value=950;this.box.Q.value=1.2;this.box.gain.value=4;
    this.box.connect(this.master);
    // muffled bus for things happening inside the cabinet
    this.inside=c.createBiquadFilter();this.inside.type='lowpass';
    this.inside.frequency.value=1600;this.inside.Q.value=2.5;
    this.inside.connect(this.master);
    const n=c.sampleRate*2,b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
    this.noiseBuf=b;
    // real puck hits, cut from krb21's "air hockey smack" (freesound #118604, CC0); kin() synthesizes until they load
    // and the rail, the goal corner and the goal from the same recording; each falls back to its synth until loaded
    this.kinBufs=[];this.railBufs=[];this.cornerBufs=[];this.goalBufs=[];
    for(const [n,to] of [['kin1',this.kinBufs],['kin2',this.kinBufs],['kin3',this.kinBufs],
      ['rail',this.railBufs],['corner',this.cornerBufs],['goal',this.goalBufs]]){
      fetch(new URL(`./sounds/${n}.wav`,import.meta.url)).then(r=>r.arrayBuffer()).then(a=>c.decodeAudioData(a))
        .then(d=>to.push(d)).catch(()=>{});
    }
    this.buildBlower();
    this.buildGlide();
  }

  pan(x){
    const c=this.ctx;
    if(c.createStereoPanner){const p=c.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,x));return p}
    return c.createGain();
  }
  noise(t,dur,dest){
    const s=this.ctx.createBufferSource();s.buffer=this.noiseBuf;s.connect(dest);
    s.start(t,Math.random()*1.5,dur);return s;
  }
  tone(type,f,t,dur,dest){
    const o=this.ctx.createOscillator();o.type=type;o.frequency.setValueAtTime(f,t);
    o.connect(dest);o.start(t);o.stop(t+dur+0.02);return o;
  }
  env(peak,t,decay,dest,attack=0.0015){
    const g=this.ctx.createGain();
    g.gain.setValueAtTime(0.0001,t);
    g.gain.linearRampToValueAtTime(Math.max(0.0002,peak),t+attack);
    g.gain.exponentialRampToValueAtTime(0.0001,t+attack+decay);
    g.connect(dest);return g;
  }

  // v: impact speed (table units/s), x: -0.5..0.5 across the table
  hit(v,x,kind='mallet'){
    if(!this.ready)return;
    const c=this.ctx,t=c.currentTime+0.003,P=PRESET[kind];
    const I=Math.min(1,Math.max(0.06,v/4.5));
    if(kind==='mallet'){this.kin(t,I,x);return}
    if(kind==='wall'&&this.railBufs.length){this.playRec(this.railBufs,REC.rail,I,t,x);return}
    if(kind==='wall'){this.rail(t,I,x);return}
    if(kind==='post'&&this.cornerBufs.length){this.playRec(this.cornerBufs,REC.corner,I,t,x);return}
    const out=this.pan(x*1.6);out.connect(P.inside?this.inside:this.box);
    const f0=P.f*(0.96+0.08*I)*(1+(Math.random()-0.5)*0.035);
    // カ: the click
    const bp=c.createBiquadFilter();bp.type='bandpass';bp.frequency.value=P.click;bp.Q.value=0.9;
    bp.connect(this.env(0.55*I*P.cg,t,0.008+0.006*I,out,0.0005));
    this.noise(t,0.03,bp);
    // コン: the ring of the plastic
    for(const [r,g,dec] of P.modes){
      this.tone('sine',f0*r,t,dec*1.6+0.05,this.env(g*I,t,dec*(0.75+0.5*I),out));
    }
    const o=this.tone('triangle',P.body,t,0.12,this.env(P.bg*I,t,P.bd,out));
    o.frequency.exponentialRampToValueAtTime(P.body*0.7,t+0.06);
  }

  // a struck plastic part: a 1.5 ms burst of noise sets a few resonant modes ringing (bandpass filters with
  // Q = π·f·τ, so each dies away with time constant τ), and the burst itself, highpassed, is the tick you hear
  // on contact. d nudges every mode's pitch so no two hits are the same
  strike(t,out,G,tick,modes,d=1){
    const c=this.ctx,ex=c.createGain();
    this.noise(t,0.01,this.env(G,t,0.0015,ex,0.0002));
    for(const [f,tau,g] of modes){
      const bp=c.createBiquadFilter();bp.type='bandpass';bp.frequency.value=f*d;bp.Q.value=Math.PI*f*d*tau;
      const k=c.createGain();k.gain.value=g*MODE_GAIN;ex.connect(bp);bp.connect(k);k.connect(out);
    }
    if(tick){
      // [highpass Hz, gain, decay s, lowpass Hz (optional)]
      const [fc,g,dec,lpf]=tick,hp=c.createBiquadFilter();hp.type='highpass';hp.frequency.value=fc;
      let to=hp;
      if(lpf){const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=lpf;hp.connect(lp);to=lp}
      to.connect(this.env(g*G,t,dec,out,0.0002));this.noise(t,dec+0.01,hp);
    }
  }

  // キン (see KIN) and the puck on the rail (see WALL)
  kin(t,I,x){if(this.kinBufs.length)this.kinSample(t,I,x);else this.hitWith(KIN,t,I,x)}
  kinSample(t,I,x){this.playRec(this.kinBufs,REC.kin,I,t,x)}
  // a recorded sound as it is (a compressor and filters on it made it worse than the source), at a gain that
  // follows the impact I (0..1) and wobbles by ±dB, played a touch faster or slower for the pitch
  // from: start that far into the recording, with a 5 ms fade in so the cut doesn't click
  playRec(bufs,[gain,db,pitch],I,t,x,from=0){
    const c=this.ctx,s=c.createBufferSource(),g=c.createGain(),out=this.pan(x*1.6),r=()=>Math.random()*2-1;
    s.buffer=bufs[Math.floor(Math.random()*bufs.length)];s.playbackRate.value=1+r()*pitch;
    const G=gain*I*Math.pow(10,r()*db/20);
    if(from){g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(G,t+0.005)}else g.gain.value=G;
    s.connect(g);g.connect(out);out.connect(this.master);s.start(t,from);
  }
  rail(t,I,x){this.hitWith(WALL,t,I,x)}
  hitWith(P,t,I,x){
    const out=this.pan(x*1.6);out.connect(this.master);
    this.strike(t,out,I*P.gain,P.tick,P.modes,1+(Math.random()-0.5)*0.03);
    const [f0,f1,g,dec]=P.thump,o=this.tone('triangle',f0,t,dec+0.03,this.env(g*I*P.gain,t,dec,out,0.001));
    o.frequency.exponentialRampToValueAtTime(f1,t+dec*0.8);
  }

  thud(t,g,x){
    const out=this.pan(x*1.6);out.connect(this.inside);
    const o=this.tone('sine',85,t,0.2,this.env(g,t,0.16,out));
    o.frequency.exponentialRampToValueAtTime(48,t+0.12);
    const lp=this.ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=420;
    lp.connect(this.env(g*0.5,t,0.05,out));
    this.noise(t,0.08,lp);
  }

  rattle(t,g){
    const bp=this.ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=1700+Math.random()*500;bp.Q.value=4;
    bp.connect(this.env(g,t,0.018,this.inside));
    this.noise(t,0.03,bp);
    this.tone('sine',620+Math.random()*260,t,0.05,this.env(g*0.6,t,0.03,this.inside));
  }

  buzzer(t,dur,f=196){
    const c=this.ctx,lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=2200;
    const g=c.createGain();
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.085,t+0.01);
    g.gain.setValueAtTime(0.085,t+dur);g.gain.linearRampToValueAtTime(0,t+dur+0.03);
    lp.connect(g);g.connect(this.master);
    this.tone('square',f,t,dur+0.05,lp);
    this.tone('square',f*1.012,t,dur+0.05,lp);
  }

  // ピピッ when the score display flips
  beep(){
    if(!this.ready)return;
    const t=this.ctx.currentTime+0.01;
    for(const dt of [0,0.09])this.tone('square',1568,t+dt,0.05,this.env(0.05,t+dt,0.045,this.master,0.002));
  }

  // カシャン: the puck crashing into the pocket. Shaped on measurements of a real table's goal (timings, ring
  // frequencies and decays only, nothing of the recording itself): a broadband crack, 57 ms later a second hit
  // with more hiss and a short ring, then two small clicks as it settles. Struck modes, not sine tones: pure
  // sines read as metal
  kashan(t,x){
    const out=this.pan(x*1.6);out.connect(this.master);
    const d=()=>1+(Math.random()-0.5)*0.02,G=0.32;
    // カ: the crack, a hiss that falls ~16 dB in 20 ms, strongest above 4 kHz, with a brief ring
    // (short τ = a wide filter that passes far more of the burst than KIN's, hence the small mode gains)
    this.strike(t,out,G,[2000,2.6,0.1],[[6180,.008,.15],[9345,.006,.12],[8830,.006,.12]],d());
    // シャン: the second hit, its hiss falling ~15 dB in 40 ms, ringing at 5.2 / 4.6 / 9.8 kHz
    this.strike(t+0.057,out,G,[2500,0.9,0.2],[[5210,.025,.18],[4570,.02,.12],[9820,.015,.12],[6310,.012,.09]],d());
    // settling: two small clicks
    this.strike(t+0.21,out,G,[3000,.5,0.02],[[7235,.006,.09],[6200,.006,.09],[3985,.006,.075]],d());
    this.strike(t+0.32,out,G,[3000,.6,0.02],[[6245,.006,.1],[5965,.006,.06]],d());
    // a little weight under the crack, the cabinet taking the knock
    const o=this.tone('triangle',180,t,0.08,this.env(0.1,t,0.04,out));
    o.frequency.exponentialRampToValueAtTime(110,t+0.05);
  }

  // v: the puck's speed as it went in. A hard one is the whole recorded goal (it already holds the drop); a soft
  // one never slams the back, so it plays only the drop that follows the slam in the same recording
  goal(x,v=9){
    if(!this.ready)return;
    const t=this.ctx.currentTime;
    if(this.goalBufs.length){
      if(v>=SOFT_GOAL.v)this.playRec(this.goalBufs,REC.goal,1,t+0.003,x);
      else this.playRec(this.goalBufs,REC.goal,SOFT_GOAL.gain*(0.6+0.4*v/SOFT_GOAL.v),t+0.003,x,SOFT_GOAL.from);
    }else{
      this.kashan(t+0.003,x);
      // rolling down the return chute
      let tt=t+0.38;
      for(let i=0;i<11;i++){tt+=0.075-i*0.004+Math.random()*0.02;this.rattle(tt,0.3-i*0.017)}
    }
    this.buzzer(t+0.25,0.5);
  }

  // a flat beep with a short release, the shape of an old score panel's buzzer chip
  blip(f,t,d,g,dest,type='square'){
    const c=this.ctx,o=c.createOscillator(),v=c.createGain();
    if(typeof type==='string')o.type=type;else o.setPeriodicWave(type);
    o.frequency.setValueAtTime(f,t);
    v.gain.setValueAtTime(0,t);v.gain.linearRampToValueAtTime(g,t+0.003);
    v.gain.setValueAtTime(g,t+Math.max(0.004,d-0.02));v.gain.linearRampToValueAtTime(0,t+d+0.01);
    o.connect(v);v.connect(dest);o.start(t);o.stop(t+d+0.03);
    return o;
  }

  // countdown: ピッ ピッ ピッ ピーン (i = 0..2, then 3 for the go)
  count(i){
    if(!this.ready)return;
    const t=this.ctx.currentTime+0.01;
    if(i<3){this.blip(880,t,0.08,0.07,this.master);return}
    this.blip(1760,t,0.42,0.06,this.master);
    this.blip(2637,t,0.42,0.035,this.master);
  }

  // MULTI PUCK: ピロピロピロ up three octaves, then the buzzer
  multiStart(){
    if(!this.ready)return;
    const t=this.ctx.currentTime+0.01,arp=[69,72,76,81];
    for(let i=0;i<14;i++)this.blip(midi(arp[i%4]+12*Math.floor(i/4)),t+i*0.035,0.03,0.045,this.master);
    this.buzzer(t+0.52,0.28,220);
  }

  pulseWave(duty){
    const n=48,re=new Float32Array(n),im=new Float32Array(n);
    for(let k=1;k<n;k++)re[k]=2*Math.sin(k*Math.PI*duty)/(k*Math.PI);
    return this.ctx.createPeriodicWave(re,im);
  }
  // play a song by name; switching songs crossfades, the same song keeps going
  bgmStart(name){
    if(!this.ready||this.bgm?.name===name)return;
    this.bgmStop();
    const c=this.ctx,bus=c.createGain(),song=name==='fever'?FEVER:GROOVE;
    bus.gain.setValueAtTime(0.0001,c.currentTime);bus.gain.setTargetAtTime(name==='fever'?0.55:0.34,c.currentTime,0.12);
    bus.connect(this.master);
    if(!this.pulse)this.pulse={q:this.pulseWave(0.25),e:this.pulseWave(0.125)};
    this.bgm={name,song,bus,step:0,next:c.currentTime+0.08};
    this.bgm.timer=setInterval(()=>this.bgmTick(),25);
  }
  bgmStop(){
    const b=this.bgm;if(!b)return;
    this.bgm=null;clearInterval(b.timer);
    const t=this.ctx.currentTime;
    b.bus.gain.cancelScheduledValues(t);b.bus.gain.setTargetAtTime(0.0001,t,0.1);
    setTimeout(()=>b.bus.disconnect(),1000);
  }
  bgmTick(){
    const b=this.bgm;if(!b)return;
    const c=this.ctx,dt=60/b.song.bpm/4,len=b.song.bars*16;
    while(b.next<c.currentTime+0.12){
      (b.name==='fever'?this.feverStep:this.grooveStep).call(this,b.step,b.next,dt,b.bus);
      b.step=(b.step+1)%len;b.next+=dt;
    }
  }
  kick(t,g,dest){const o=this.tone('sine',140,t,0.16,this.env(g,t,0.14,dest));o.frequency.exponentialRampToValueAtTime(45,t+0.1)}
  hat(t,g,dec,dest,f=7000){
    const hp=this.ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=f;
    hp.connect(this.env(g,t,dec,dest));this.noise(t,dec+0.02,hp);
  }
  clap(t,g,dest,f=1600){
    const bp=this.ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=f;bp.Q.value=0.8;
    bp.connect(this.env(g,t,0.09,dest));this.noise(t,0.12,bp);
  }
  lp(f,dest){const l=this.ctx.createBiquadFilter();l.type='lowpass';l.frequency.value=f;l.connect(dest);return l}
  // a soft vibraphone-ish ポン: sine plus a faint octave, slow decay
  bell(f,t,g,dest){
    this.tone('sine',f,t,0.7,this.env(g,t,0.6,dest,0.004));
    this.tone('sine',f*4,t,0.2,this.env(g*0.12,t,0.12,dest,0.002));
  }
  grooveStep(s,t,dt,bus){
    const G=GROOVE,i=s%16,bar=Math.floor(s/16),ch=bar%4;
    if(i===0||i===8||i===11)this.kick(t,i===11?0.16:0.26,bus);
    if(i===4||i===12)this.clap(t,0.05,bus,2600);
    if(i%2===0)this.hat(t,i%4===2?0.022:0.01,0.025,bus);
    const b=G.bass[i];
    if(b!==undefined)this.blip(midi(G.bassRoot[ch]+b),t,dt*1.4,0.08,this.lp(520,bus));
    // offbeat chord blips, short and low
    if(i===6||i===14)for(const n of G.chords[ch])this.blip(midi(n),t,dt*0.8,0.012,this.lp(1800,bus),this.pulse.q);
    const h=G.hook[bar][i];
    if(h)this.bell(midi(h),t,0.05,bus);
  }
  feverStep(s,t,dt,bus){
    const F=FEVER,i=s%16,bar=Math.floor(s/16),ch=bar%4;
    if(i%4===0)this.kick(t,0.42,bus);
    if(i===4||i===12)this.clap(t,0.16,bus);
    if(i%4===2)this.hat(t,0.05,0.07,bus,6000);
    if(i%2===0)this.blip(midi(F.bassRoot[ch]+(i%4===2?12:0)),t,dt*1.6,0.075,this.lp(800,bus));
    if(i===3||i===6||i===11||i===14)for(const n of F.chords[ch])this.blip(midi(n),t,dt*0.9,0.02,this.lp(3200,bus));
    const n=F.lead[s];
    if(n>0)this.blip(midi(n),t,dt*(F.lead[(s+1)%F.lead.length]===0?1.8:0.9),0.05,this.lp(5000,bus),this.pulse.e);
  }

  // the puck dropping out of the return slot
  puckOut(x){
    if(!this.ready)return;
    const t=this.ctx.currentTime+0.01;
    this.thud(t,0.5,x);
    this.hit(0.9,x,'back');
  }

  // チャリン + the blower spinning up
  coin(){
    if(!this.ready)return;
    const t=this.ctx.currentTime+0.01;
    for(const [dt,g] of [[0,.16],[0.07,.09]]){
      for(const f of [2350,3520,4700])this.tone('sine',f*(1+dt),t+dt,0.4,this.env(g,t+dt,0.32,this.master,0.001));
    }
    this.thud(t+0.28,0.25,0);
    this.blowerOn(true,0.45);
  }

  end(){
    if(!this.ready)return;
    this.buzzer(this.ctx.currentTime+0.05,0.9,174);
    this.blowerOn(false,1.1);
  }

  buildBlower(){
    const c=this.ctx;
    this.blower=c.createGain();this.blower.gain.value=0;this.blower.connect(this.master);
    const src=c.createBufferSource();src.buffer=this.noiseBuf;src.loop=true;
    this.blowLP=c.createBiquadFilter();this.blowLP.type='lowpass';this.blowLP.frequency.value=120;this.blowLP.Q.value=0.6;
    const ng=c.createGain();ng.gain.value=0.09;
    src.connect(this.blowLP).connect(ng).connect(this.blower);src.start();
    this.motor=c.createOscillator();this.motor.type='sawtooth';this.motor.frequency.value=25;
    const mlp=c.createBiquadFilter();mlp.type='lowpass';mlp.frequency.value=320;
    const mg=c.createGain();mg.gain.value=0.022;
    this.motor.connect(mlp).connect(mg).connect(this.blower);this.motor.start();
    // a slow wobble so the motor isn't a pure drone
    const lfo=c.createOscillator();lfo.frequency.value=0.7;
    const lg=c.createGain();lg.gain.value=1.2;
    lfo.connect(lg).connect(this.motor.frequency);lfo.start();
  }

  blowerOn(on,delay=0){
    if(!this.ctx)return;
    const t=this.ctx.currentTime+delay;
    for(const p of [this.blower.gain,this.blowLP.frequency,this.motor.frequency])p.cancelScheduledValues(t);
    this.blower.gain.setTargetAtTime(on?1:0,t,on?0.35:0.6);
    this.blowLP.frequency.setTargetAtTime(on?650:120,t,on?0.4:0.7);
    this.motor.frequency.setTargetAtTime(on?100:25,t,on?0.45:0.8);
  }

  buildGlide(){
    const c=this.ctx,s=c.createBufferSource();s.buffer=this.noiseBuf;s.loop=true;
    const bp=c.createBiquadFilter();bp.type='bandpass';bp.frequency.value=2600;bp.Q.value=0.6;
    this.glideG=c.createGain();this.glideG.gain.value=0;
    this.glideP=this.pan(0);
    s.connect(bp).connect(this.glideG).connect(this.glideP).connect(this.master);s.start();
  }

  // the faint hiss of the puck riding the air
  glide(speed,x){
    if(!this.ctx)return;
    const t=this.ctx.currentTime;
    this.glideG.gain.setTargetAtTime(Math.min(0.03,speed*0.005),t,0.05);
    if(this.glideP.pan)this.glideP.pan.setTargetAtTime(x*1.6,t,0.05);
  }
}
