// Online play's connection. The room (room/room.js, a WebSocket) brings two players together and carries the
// WebRTC handshake; the match then runs peer to peer over two data channels: 'r' (reliable, in order: the events
// that must arrive, serve, goal, handing the puck over) and 'u' (unreliable, newest wins: where the mallet and the
// puck are, every frame). Pairs that can't connect directly within a few seconds fall back to the room's relay,
// where everything goes through the WebSocket (in order, at half the rate).
//
// on: {state(text), ready(role, how), msg(obj), left(why)}
const ICE=[{urls:['stun:stun.cloudflare.com:3478','stun:stun.l.google.com:19302']}];
const WAIT_P2P=6000,RELAY_GAP=33;

export class Net{
  constructor(url,on,{relayOnly=false}={}){
    this.on=on;this.role=-1;this.how=null;this.dead=false;this.relayOnly=relayOnly;
    this.q=0;this.lastQ=-1;this.lastRelay=0;
    this.ws=new WebSocket(url);
    this.ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}this.room(m)};
    this.ws.onclose=()=>this.end('closed');
    this.ws.onerror=()=>this.end('error');
  }
  wsSend(o){if(this.ws.readyState===1)this.ws.send(JSON.stringify(o))}
  room(m){
    if(m.t==='role'){this.role=m.role;this.on.state?.(m.role===0?'waiting':'joining')}
    else if(m.t==='full')this.end('full');
    else if(m.t==='deny')this.end('busy');
    else if(m.t==='peer'){
      if(!m.on){this.end('left');return}
      this.on.state?.('connecting');
      if(this.role===0){
        if(this.relayOnly)this.toRelay();
        else{this.offer();this.timer=setTimeout(()=>{if(!this.how)this.toRelay()},WAIT_P2P)}
      }
    }
    else if(m.t==='sdp')this.sdp(m.d);
    else if(m.t==='ice'){if(this.pc&&m.d)this.pc.addIceCandidate(m.d).catch(()=>{})}
    else if(m.t==='relay'){if(!this.how)this.open('relay')}
    else if(m.t==='g')this.take(m.d);
  }
  toRelay(){this.wsSend({t:'relay'});this.open('relay')}
  peer(){
    const pc=this.pc=new RTCPeerConnection({iceServers:ICE});
    pc.onicecandidate=e=>{if(e.candidate)this.wsSend({t:'ice',d:e.candidate})};
    pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed'&&this.how==='p2p')this.end('lost')};
    return pc;
  }
  wire(ch){
    ch.onopen=()=>{if(this.r?.readyState==='open'&&this.u?.readyState==='open'&&!this.how)this.open('p2p')};
    ch.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}this.take(m)};
    ch.onclose=()=>{if(this.how==='p2p')this.end('lost')};
  }
  async offer(){
    try{
      const pc=this.peer();
      this.r=pc.createDataChannel('r');this.u=pc.createDataChannel('u',{ordered:false,maxRetransmits:0});
      this.wire(this.r);this.wire(this.u);
      await pc.setLocalDescription(await pc.createOffer());
      this.wsSend({t:'sdp',d:pc.localDescription});
    }catch{this.toRelay()}
  }
  async sdp(d){
    try{
      if(d.type==='offer'){
        const pc=this.peer();
        pc.ondatachannel=e=>{this[e.channel.label==='r'?'r':'u']=e.channel;this.wire(e.channel);if(e.channel.readyState==='open')e.channel.onopen()};
        await pc.setRemoteDescription(d);
        await pc.setLocalDescription(await pc.createAnswer());
        this.wsSend({t:'sdp',d:pc.localDescription});
      }else await this.pc.setRemoteDescription(d);
    }catch{}
  }
  open(how){
    if(this.how||this.dead)return;
    this.how=how;clearTimeout(this.timer);
    if(how==='relay'&&this.pc){try{this.pc.close()}catch{}this.pc=null}
    this.on.ready?.(this.role,how);
  }
  take(m){
    if(this.dead)return;
    // the unreliable channel's messages are numbered: one that comes in late is dropped
    if(m.q!==undefined){if(m.q<=this.lastQ)return;this.lastQ=m.q}
    this.on.msg?.(m);
  }
  // an event: must arrive, in order
  send(o){
    if(this.how==='p2p'){try{this.r.send(JSON.stringify(o))}catch{}}
    else if(this.how==='relay')this.wsSend({t:'g',d:o});
  }
  // a frame's positions: only the newest matters
  stream(o){
    o.q=++this.q;
    if(this.how==='p2p'){try{this.u.send(JSON.stringify(o))}catch{}}
    else if(this.how==='relay'){
      const t=performance.now();if(t-this.lastRelay<RELAY_GAP)return;
      this.lastRelay=t;this.wsSend({t:'g',d:o});
    }
  }
  end(why){
    if(this.dead)return;
    this.dead=true;clearTimeout(this.timer);
    try{this.pc?.close()}catch{}try{this.ws.close()}catch{}
    this.on.left?.(why);
  }
  // leaving on purpose: nothing is reported back
  close(){this.on={};this.end('bye')}
}
