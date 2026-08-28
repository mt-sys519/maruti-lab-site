class Vector {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  mult(n) { this.x *= n; this.y *= n; return this; }
  div(n) { this.x /= n; this.y /= n; return this; }
  mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
  normalize() { const m = this.mag(); if (m !== 0) this.div(m); return this; }
  limit(max) {
    const m2 = this.x * this.x + this.y * this.y;
    const max2 = max * max;
    if (m2 > max2 && m2 > 0) {
      const k = max / Math.sqrt(m2);
      this.x *= k;
      this.y *= k;
    }
    return this;
  }
  dist(v) { return Math.sqrt((this.x - v.x) ** 2 + (this.y - v.y) ** 2); }
  distSq(v) { const dx = this.x - v.x, dy = this.y - v.y; return dx * dx + dy * dy; }
  copy() { return new Vector(this.x, this.y); }
}



// Shared fish illustration rule: every filled fish silhouette uses the same
// outer rim width in NATURAL and CYBER. Internal anatomy / markings may remain finer.
const FISH_OUTLINE_WIDTH = 0.86;

// -----------------------------------------------------------------------------
// ECOLOGY / DEPTH SYSTEM (v94)
// 0 = behind background plants, 1 = between BG/MID, 2 = between MID/FG,
// 3 = in front of foreground plants, 4 = benthic surface layer.
// The visible size/alpha changes continuously; occlusion order changes only at a
// safe passage so fish do not appear to cut through dense plants.
const ECO_DEPTH_BANDS = [
  { id:"far",      scale:0.74, alpha:0.52, speed:0.82 },
  { id:"back",     scale:0.86, alpha:0.70, speed:0.90 },
  { id:"mid",      scale:1.00, alpha:0.88, speed:1.00 },
  { id:"front",    scale:1.16, alpha:1.00, speed:1.06 },
  { id:"benthic",  scale:1.00, alpha:1.00, speed:0.94 }
];

const ECOLOGY_PROFILES = {
  "neon-tetra":      { bands:[1,2,3], weights:[0.26,0.56,0.18], shift:[5200,9800],  shelter:0.44, open:0.70 },
  "glass-catfish":   { bands:[0,1,2], weights:[0.48,0.43,0.09], shift:[7600,13800], shelter:0.92, open:0.14 },
  "african-lampeye": { bands:[1,2,3], weights:[0.22,0.48,0.30], shift:[5000,9000],  shelter:0.40, open:0.64 },
  "rummynose-tetra": { bands:[1,2,3], weights:[0.16,0.60,0.24], shift:[4600,8500],  shelter:0.30, open:0.92 },
  "angelfish":       { bands:[0,1,2,3], weights:[0.18,0.34,0.38,0.10], shift:[7000,12500], shelter:0.74, open:0.38 },
  "guppy":           { bands:[1,2,3], weights:[0.12,0.43,0.45], shift:[4300,8200],  shelter:0.28, open:0.84 },
  "molly":           { bands:[1,2,3], weights:[0.16,0.55,0.29], shift:[5900,10800], shelter:0.30, open:0.72 },
  "betta":           { bands:[1,2,3], weights:[0.10,0.43,0.47], shift:[6500,11800], shelter:0.28, open:0.56 },
  "corydoras":       { bands:[4], weights:[1], shift:[999999,999999], shelter:0.20, open:0.86 },
  "shrimp":          { bands:[4], weights:[1], shift:[999999,999999], shelter:0.86, open:0.10 }
};

// Vertical water-column ecology is separate from visual front/back depth.
// ratio: 0 = surface, 1 = substrate.  Fish can move in Z without becoming
// bottom-dwellers in Y. hardMin/hardMax are safety bounds; softMin/softMax
// are the range the steering gently prefers. feedMax stops pelagic fish from
// diving to the substrate after food that has already sunk.
const WATER_COLUMN_PROFILES = {
  "african-lampeye": { center:0.16, softMin:0.06, softMax:0.30, hardMin:0.04, hardMax:0.40, pull:0.95, wander:0.05, feedMax:0.38 },
  "guppy":           { center:0.28, softMin:0.12, softMax:0.46, hardMin:0.07, hardMax:0.58, pull:0.62, wander:0.08, feedMax:0.58 },
  "betta":           { center:0.30, softMin:0.12, softMax:0.49, hardMin:0.07, hardMax:0.62, pull:0.58, wander:0.08, feedMax:0.60 },
  "molly":           { center:0.34, softMin:0.16, softMax:0.52, hardMin:0.09, hardMax:0.66, pull:0.58, wander:0.09, feedMax:0.66 },
  "glass-catfish":   { center:0.42, softMin:0.24, softMax:0.58, hardMin:0.14, hardMax:0.68, pull:0.72, wander:0.06, feedMax:0.68 },
  "neon-tetra":      { center:0.45, softMin:0.27, softMax:0.62, hardMin:0.16, hardMax:0.72, pull:0.66, wander:0.07, feedMax:0.70 },
  "rummynose-tetra": { center:0.48, softMin:0.29, softMax:0.64, hardMin:0.18, hardMax:0.74, pull:0.72, wander:0.06, feedMax:0.72 },
  // Angelfish can forage lower on occasion, but routine cruising remains mid-water.
  "angelfish":       { center:0.47, softMin:0.22, softMax:0.66, hardMin:0.11, hardMax:0.80, pull:0.60, wander:0.09, feedMax:0.78 }
};

function applyNaturalLineSoftness(ctx) {
  // PAKU: NATURAL only, unconditionally.
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  return true;
}

// 給餌オブジェクト。CYBERでは従来のデータパケット、NATURALでは薄いフレークとして描画する。
class DataPacket {
  constructor(x, y) {
    this.pos = new Vector(x, y);
    this.vel = new Vector((Math.random() - 0.5) * 0.5, 0.8 + Math.random() * 0.5);
    this.size = 3.7 + Math.random() * 3.7;
    this.char = Math.random() > 0.5 ? "1" : "0";
    this.color = "#ff007f";
    this.pulse = 0;
    this.flakeAngle = Math.random() * Math.PI * 2;
    this.flakeSpin = (Math.random() - 0.5) * 0.075;
    this.flakePhase = Math.random() * Math.PI * 2;
    this.flakeAspect = 0.55 + Math.random() * 0.45;
    this.flakeShape = [
      [0.95, -0.18],
      [0.34, -0.72 - Math.random() * 0.18],
      [-0.62 - Math.random() * 0.18, -0.48],
      [-0.92, 0.16 + Math.random() * 0.16],
      [-0.20, 0.72],
      [0.70 + Math.random() * 0.12, 0.42]
    ];
    const flakeColors = [
      [174, 95, 47],   // 赤茶
      [201, 137, 63],  // 黄土
      [126, 118, 58],  // オリーブ
      [194, 91, 63],   // 赤み
      [159, 133, 83]   // ベージュ
    ];
    this.flakeRgb = flakeColors[Math.floor(Math.random() * flakeColors.length)];
    this.settled = false;
    this.settledAt = 0;
    this.settledLifetimeMs = 20000;
  }
  update() {
    const aq = window.aquariumInstance;
    const isNatural = true; // PAKU: NATURAL only, unconditionally.
    if (isNatural && !this.settled) {
      // 薄いフレークが沈みながらゆっくり回転し、水中でわずかに横へ流れる。
      this.flakeAngle += this.flakeSpin;
      this.flakePhase += 0.055;
      this.vel.x += Math.sin(this.flakePhase) * 0.004;
      this.vel.x = Math.max(-0.42, Math.min(0.42, this.vel.x));
    }
    this.pos.add(this.vel);
    if (aq) {
      const scale = aq.scale || 1;
      const terrainY = aq.getTerrainHeight(this.pos.x);
      // 餌は底床表面で止まり、地形の下へ潜り込まない。
      const settleY = terrainY - Math.max(5 * scale, this.size * scale * 0.55);
      if (this.pos.y >= settleY) {
        this.pos.y = settleY;
        this.vel.y = 0;
        this.vel.x *= 0.72;
        if (Math.abs(this.vel.x) < 0.015) this.vel.x = 0;
        if (!this.settled) {
          this.settled = true;
          this.settledAt = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
        }
      }
    }
    this.pulse += 0.1;
  }
  draw(ctx) {
    const aq = window.aquariumInstance;
    const scale = aq ? aq.scale : 1.0;
    const isNatural = true; // PAKU: NATURAL only, unconditionally.
    ctx.save();

    if (isNatural) {
      // NATURAL: 発光させず、薄い不定形フレークとして描く。
      const w = this.size * scale * 0.78;
      const h = w * this.flakeAspect;
      const [r,g,b] = this.flakeRgb;
      ctx.translate(this.pos.x, this.pos.y);
      ctx.rotate(this.flakeAngle);
      ctx.fillStyle = `rgba(${r},${g},${b},0.86)`;
      ctx.strokeStyle = `rgba(${Math.max(0,r-48)},${Math.max(0,g-42)},${Math.max(0,b-34)},0.58)`;
      ctx.lineWidth = Math.max(0.45, 0.62 * scale);
      ctx.beginPath();
      this.flakeShape.forEach(([px,py], i) => {
        const x = px * w;
        const y = py * h;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // 表面の薄い色ムラ。輪郭を増やさずフレーク感だけ足す。
      ctx.fillStyle = `rgba(${Math.min(255,r+45)},${Math.min(255,g+38)},${Math.min(255,b+28)},0.24)`;
      ctx.beginPath();
      ctx.ellipse(w * 0.12, -h * 0.08, w * 0.34, h * 0.20, -0.25, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // CYBER: 従来のデータパケット表現を維持。
      ctx.shadowBlur = 10 * (aq?.glowScale || 1);
      ctx.shadowColor = this.color;
      ctx.fillStyle = this.color;
      ctx.font = `${this.size * scale}px monospace`;
      ctx.fillText(this.char, this.pos.x, this.pos.y);
      ctx.strokeStyle = "rgba(255, 0, 127, 0.4)";
      ctx.lineWidth = 1 * scale;
      ctx.strokeRect(this.pos.x - 4 * scale, this.pos.y - this.size * scale, this.size * scale + 2 * scale, this.size * scale + 2 * scale);
    }
    ctx.restore();
  }
}

// AIR particle: NATURALでは気泡、CYBERでは底から湧く破損データ断片。
class Bubble {
  constructor(x, y, scale = 1) {
    this.pos = new Vector(x, y);
    this.vel = new Vector((Math.random() - 0.5) * 0.28, -(0.48 + Math.random() * 0.92) * scale);
    this.radius = (1.2 + Math.random() * 4) * scale;
    this.alpha = 0.30 + Math.random() * 0.38;
    this.phase = Math.random() * Math.PI * 2;
    this.flicker = 0.76 + Math.random() * 0.24;

    // 読める「単語」ではなく、メモリ／通信／レジスタが壊れて漏れている断片。
    const fragments = [
      "0x7F", "0xA3", "0xE1", "FF", "A7", "C0", "01", "101", "1101",
      "R0", "R3", "AX", "RX", "TX", "PTR", "MEM", "CRC", "ACK", "NUL",
      "SYS", "ERR", "SYNC", "Δt", "λ7", "$AF", "#00", "@7E", "::", "//",
      "<>", "[]", "{}", "▓", "▒", "░", "▓▒", "▒░", "i++", "v[3]", "A[i]"
    ];
    this.char = fragments[(Math.random() * fragments.length) | 0];

    // ほぼシアン／緑。マゼンタは故障データとしてごく少量だけ混ぜる。
    const roll = Math.random();
    this.cyberRgb = roll < 0.58 ? "0,243,255" : (roll < 0.91 ? "57,255,20" : "255,0,127");
    this.cyberSize = (6.2 + Math.random() * 3.6) * scale;
    this.glitchSeed = Math.random() * 1000;
    this.tailGlyph = Math.random() > 0.5 ? "│" : "·";
    this.tailBit = Math.random() > 0.5 ? "0" : "1";
  }
  update() {
    this.phase += 0.052;
    this.pos.x += this.vel.x + Math.sin(this.phase * 0.9) * 0.045;
    this.pos.y += this.vel.y;
    this.alpha -= 0.00095;
  }
  draw(ctx) {
    const aq = window.aquariumInstance;
    const scale = aq ? aq.scale : 1.0;
    const isNatural = true; // PAKU: NATURAL only, unconditionally.
    ctx.save();
    if (isNatural) {
      ctx.strokeStyle = `rgba(64, 151, 177, ${Math.max(0, this.alpha * 0.72)})`;
      ctx.lineWidth = Math.max(0.7, 0.85 * scale);
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, this.radius * scale, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const pulse = 0.72 + Math.sin(this.phase * 3.4 + this.glitchSeed) * 0.18;
      const dropout = Math.sin(this.phase * 12.0 + this.glitchSeed) > 0.88 ? 0.22 : 1;
      // AIRは専用DOMレイヤーで魚より後ろにあるため、全魚との重なり判定は不要。
      // 旧実装の O(AIR粒子×魚数) 判定がCYBER側だけの大きなCPU負荷になっていた。
      const a = Math.max(0, Math.min(1, this.alpha * this.flicker * pulse * dropout));

      ctx.font = `${Math.max(6, this.cyberSize)}px "Share Tech Mono", "Courier New", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = `rgba(${this.cyberRgb},${a})`;
      // 背景データ片はblurを使わず、文字そのものの透明度で発光感を作る。
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.fillText(this.char, this.pos.x, this.pos.y);

      // 切れた縦データ列の残像。主文字よりかなり薄く、背景層に留める。
      if (a > 0.10) {
        const tailA = a * 0.17;
        ctx.font = `${Math.max(5, this.cyberSize * 0.72)}px "Share Tech Mono", "Courier New", monospace`;
        ctx.fillStyle = `rgba(${this.cyberRgb},${tailA})`;
        ctx.shadowBlur = 0;
        ctx.fillText(this.tailGlyph, this.pos.x, this.pos.y + 9 * scale);
        if (this.char.length <= 3) {
          ctx.fillStyle = `rgba(${this.cyberRgb},${tailA * 0.58})`;
          ctx.fillText(this.tailBit, this.pos.x, this.pos.y + 16 * scale);
        }
      }
    }
    ctx.restore();
  }
}

// 浮遊プランクトンクラス
class Plankton {
  constructor(w, h) {
    this.pos = new Vector(Math.random() * w, Math.random() * h);
    this.vel = new Vector((Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.15);
    this.size = 1 + Math.random() * 1.8;
    this.phase = Math.random() * 100;
    // PAKU: NATURAL only - was cyber cyan/neon-green with no themeMode check.
    this.color = Math.random() > 0.4 ? "rgba(150, 178, 172, 0.30)" : "rgba(168, 186, 160, 0.26)";
  }
  update(w, h, tempFactor) {
    this.phase += 0.008;
    this.pos.x += this.vel.x * tempFactor + Math.sin(this.phase) * 0.03;
    this.pos.y += this.vel.y * tempFactor + Math.cos(this.phase * 0.5) * 0.03;
    
    if (this.pos.x < 0) this.pos.x = w;
    if (this.pos.x > w) this.pos.x = 0;
    if (this.pos.y < 20) this.pos.y = h;
    if (this.pos.y > h) this.pos.y = 20;
  }
  draw(ctx) {
    const scale = window.aquariumInstance ? window.aquariumInstance.scale : 1.0;
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.size * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// コリドラス用の砂埃ダストパーティクル
class DustParticle {
  constructor(x, y, color) {
    this.pos = new Vector(x, y);
    this.vel = new Vector((Math.random() - 0.5) * 0.8, -0.3 - Math.random() * 0.7);
    this.size = 4 + Math.random() * 4;
    this.char = Math.random() > 0.5 ? "1" : "0";
    this.alpha = 0.9;
    this.color = color;
  }
  update() {
    this.pos.add(this.vel);
    this.alpha -= 0.025;
  }
  draw(ctx) {
    const scale = window.aquariumInstance ? window.aquariumInstance.scale : 1.0;
    ctx.save();
    // PAKU: NATURAL only. This drew a neon-green "0"/"1" GLYPH with no themeMode
    // check of any kind - so every corydoras foraging pass sent text characters
    // drifting up from the substrate, reading exactly like CYBER "AIR" bubbles.
    // Now a soft silt puff instead.
    ctx.fillStyle = `rgba(196, 180, 148, ${Math.max(0, this.alpha) * 0.55})`;
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, Math.max(0.6, this.size * scale * 0.30), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ソナー探知時のレーザー交差波紋
class ScanWave {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.radius = 1;
    this.maxRadius = 35;
    this.alpha = 1.0;
    this.color = color;
  }
  update() {
    this.radius += 1.4;
    this.alpha = 1 - (this.radius / this.maxRadius);
  }
  draw(ctx) {
    const scale = window.aquariumInstance ? window.aquariumInstance.scale : 1.0;
    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// 電脳熱帯魚クラス
class CyberFish {
  constructor(x, y, speciesData) {
    this.pos = new Vector(x, y);
    const angle = Math.random() * Math.PI * 2;
    this.vel = new Vector(Math.cos(angle), Math.sin(angle));
    this.acc = new Vector(0, 0);
    
    this.id = speciesData.id;
    this.name = speciesData.name;
    this.color = speciesData.color;
    this.variantHue = Math.floor(Math.random() * 360);
    this.variantPhase = Math.random() * Math.PI * 2;
    
    this.maxSpeed = 1.8;
    this.cruiseSpeed = 1.25;
    this.maxForce = 0.05;
    this.size = 12;
    
    this.history = [];
    this.historyMaxLength = 8;
    this.historySampleCounter = Math.floor(Math.random() * 2);
    this.phase = Math.random() * 100;
    // 左右の向きは回転角ではなくミラーで管理する。魚が背泳ぎしないための姿勢状態。
    this.facing = Math.random() < 0.5 ? -1 : 1;
    this.turnCooldown = 0;
    // 壁際でboids/境界補正が競合して左右反転を連打しないための退避状態。
    this.boundaryTurnCooldown = 0;
    this.boundaryEscapeDir = 0;
    this.bodyTilt = 0;
    this.waterColumnBias = (Math.random() - 0.5);

    // CYBER専用の一時エフェクト。実際の発火管理はCyberAquarium側で行う。
    this.cyberFx = null;

    // 給餌時の短い食いつきアクション。既存の餌接触判定でだけ発火し、探索コストは増やさない。
    this.feedAction = null;
    this.feedActionStartedAt = 0;
    this.feedActionDuration = 0;
    this.feedActionStrength = 0;
    this.feedAimY = 0;
    // 1粒食べた直後の食休み。遊泳は続けるが、次の餌は一定時間追わない。
    this.feedCooldownUntil = 0;
    // 食後の実移動シーケンス。描画変形ではなく、短時間だけ速度と向きを直接制御する。
    this.feedMotion = null;

    // 生態レイヤー。初期位置も魚種ごとの選好から選ぶ。
    const eco = ECOLOGY_PROFILES[this.id] || ECOLOGY_PROFILES["neon-tetra"];
    const pick = (() => {
      const r = Math.random();
      let acc = 0;
      for (let i = 0; i < eco.bands.length; i++) {
        acc += eco.weights[i] || 0;
        if (r <= acc) return eco.bands[i];
      }
      return eco.bands[eco.bands.length - 1];
    })();
    this.depthBandIndex = pick;
    this.depthTargetBandIndex = pick;
    this.depthLayer = ECO_DEPTH_BANDS[pick].id;
    this.depthScale = ECO_DEPTH_BANDS[pick].scale;
    this.depthAlpha = ECO_DEPTH_BANDS[pick].alpha;
    this.depthSpeed = ECO_DEPTH_BANDS[pick].speed;
    this.depthNextShiftAt = 0;
    this.depthPassageX = null;
    this.depthPassageY = null;
    this.depthCrossingZone = null;

    // コリドラスの腸呼吸ダッシュ。通常は砂層、数分に一度だけ水面へ上がる。
    this.coryAirState = this.id === "corydoras" ? "bottom" : null;
    this.coryAirTargetX = null;
    this.coryAirFacing = this.facing;
    this.coryAirVx = 0;
    this.coryAirPitch = 0.90;
    this.coryAirSnapUntil = 0;

    // シュリンプの逃避状態。通常のツムツムとは別に短い遊泳を許可する。
    this.shrimpEscapeUntil = 0;
    this.shrimpEscapeTarget = null;
    this.shrimpEscapeCooldownUntil = 0;

    this.configureSpecs();
    this.initVisualVariant();
  }

  initVisualVariant() {
    if (this.id === "molly") {
      const variants = [
        { id: "black", label: "BLACK", body: "rgba(3,6,8,0.96)", body2: "rgba(20,28,32,0.92)", edge: "#72e9ff", fin: "rgba(114,233,255,0.16)", eye: "#e8fdff", spot: null },
        { id: "platinum", label: "PLATINUM", body: "rgba(205,225,226,0.72)", body2: "rgba(240,252,250,0.58)", edge: "#d8ffff", fin: "rgba(216,255,255,0.18)", eye: "#f8ffff", spot: null },
        { id: "gold", label: "GOLD", body: "rgba(142,91,8,0.78)", body2: "rgba(245,178,28,0.48)", edge: "#ffd34d", fin: "rgba(255,211,77,0.18)", eye: "#fff5c4", spot: null },
        { id: "orange", label: "ORANGE", body: "rgba(142,48,8,0.82)", body2: "rgba(255,98,22,0.48)", edge: "#ff7a36", fin: "rgba(255,122,54,0.18)", eye: "#fff0d8", spot: null },
        { id: "dalmatian", label: "DALMATIAN", body: "rgba(208,220,214,0.72)", body2: "rgba(238,247,242,0.52)", edge: "#d8fff2", fin: "rgba(216,255,242,0.16)", eye: "#ffffff", spot: "#05080a" },
        { id: "gold-dust", label: "GOLD-DUST", body: "rgba(18,16,10,0.94)", body2: "rgba(178,111,18,0.48)", edge: "#ffbd3f", fin: "rgba(255,189,63,0.16)", eye: "#fff3c0", spot: "#ff9d20" }
      ];
      this.visualVariant = variants[Math.floor(Math.random() * variants.length)];
      this.color = this.visualVariant.edge;
      this.patternSeed = Math.random() * 1000;
    } else if (this.id === "angelfish") {
      // エンゼルは色数を抑え、縦長のシルエットと半透明の長い鰭で格を出す。
      const variants = [
        { id: "wild-silver", label: "WILD SILVER", pattern: "bars", body0: "rgba(18,24,28,0.96)", body1: "rgba(122,140,145,0.90)", body2: "rgba(224,231,226,0.84)", sheen: "rgba(220,250,246,0.42)", edge: "rgba(196,222,220,0.48)", fin: "rgba(150,179,181,0.075)", ray: "rgba(196,218,216,0.22)", mark: "rgba(5,8,10,0.82)", accent: null, iris: "#a96e35" },
        { id: "black-velvet", label: "BLACK VELVET", pattern: "velvet", body0: "rgba(2,3,5,0.995)", body1: "rgba(13,18,22,0.98)", body2: "rgba(54,66,70,0.84)", sheen: "rgba(112,155,161,0.25)", edge: "rgba(119,153,157,0.34)", fin: "rgba(72,91,96,0.085)", ray: "rgba(112,139,145,0.20)", mark: "rgba(0,0,0,0.0)", accent: null, iris: "#b47735" },
        { id: "platinum", label: "PLATINUM", pattern: "clean", body0: "rgba(110,124,127,0.90)", body1: "rgba(213,224,222,0.92)", body2: "rgba(248,247,237,0.90)", sheen: "rgba(255,255,244,0.48)", edge: "rgba(225,241,237,0.46)", fin: "rgba(216,230,226,0.075)", ray: "rgba(230,241,236,0.20)", mark: "rgba(76,88,90,0.16)", accent: null, iris: "#ad7137" },
        { id: "gold-koi", label: "GOLD KOI", pattern: "koi", body0: "rgba(73,58,34,0.94)", body1: "rgba(188,164,112,0.90)", body2: "rgba(242,225,176,0.88)", sheen: "rgba(255,240,194,0.44)", edge: "rgba(236,218,173,0.44)", fin: "rgba(224,205,162,0.075)", ray: "rgba(235,218,181,0.21)", mark: "rgba(17,15,13,0.70)", accent: "rgba(194,78,30,0.78)", iris: "#a75c2f" }
      ];
      this.visualVariant = variants[Math.floor(Math.random() * variants.length)];
      this.color = this.visualVariant.edge;
      this.patternSeed = Math.random() * 1000;
    } else if (this.id === "betta") {
      // 3匹だけでも個体差を楽しめるよう、実在の観賞ベタを連想する複数の色系統を用意。
      const variants = [
        // 最大3匹でまず見える3色は、色相が被らないように固定する。
        { id: "royal-blue", label: "ROYAL BLUE", body0: "#061525", body1: "#0e5fa3", body2: "#39d9ff", fin0: "rgba(7,43,91,0.30)", fin1: "rgba(28,114,225,0.30)", fin2: "rgba(68,229,255,0.20)", ray: "rgba(122,236,255,0.60)", eye: "#eafcff" },
        { id: "mustard-gas", label: "MUSTARD GAS", body0: "#061923", body1: "#0f6b82", body2: "#34d7dc", fin0: "rgba(72,50,4,0.28)", fin1: "rgba(226,163,19,0.34)", fin2: "rgba(255,224,89,0.20)", ray: "rgba(255,239,137,0.62)", eye: "#f4feff" },
        { id: "solid-red", label: "SOLID RED", body0: "#260003", body1: "#a9040a", body2: "#ff1c16", fin0: "rgba(92,0,3,0.52)", fin1: "rgba(216,5,10,0.48)", fin2: "rgba(255,45,30,0.34)", ray: "rgba(255,92,72,0.66)", eye: "#fff4ef" },
        // 既存のグラデーション系統も残す。個体数を増やした場合はこの続きが使われる。
        { id: "crimson", label: "CRIMSON", body0: "#21030a", body1: "#8d0e2e", body2: "#ff3d67", fin0: "rgba(83,0,24,0.32)", fin1: "rgba(219,16,67,0.31)", fin2: "rgba(255,91,121,0.18)", ray: "rgba(255,143,164,0.56)", eye: "#fff0f3" },
        { id: "black-orchid", label: "BLACK ORCHID", body0: "#030308", body1: "#141229", body2: "#4840a8", fin0: "rgba(3,3,9,0.42)", fin1: "rgba(28,20,74,0.34)", fin2: "rgba(72,105,255,0.18)", ray: "rgba(94,180,255,0.60)", eye: "#eaf7ff" },
        { id: "koi", label: "KOI", body0: "#402118", body1: "#e8e0ca", body2: "#ff7347", fin0: "rgba(238,220,189,0.24)", fin1: "rgba(255,91,55,0.26)", fin2: "rgba(66,161,207,0.16)", ray: "rgba(255,225,203,0.54)", eye: "#fff8ef" },
        { id: "galaxy", label: "GALAXY", body0: "#08051b", body1: "#55257d", body2: "#1dd8e8", fin0: "rgba(22,8,61,0.34)", fin1: "rgba(132,31,188,0.28)", fin2: "rgba(23,211,226,0.18)", ray: "rgba(148,230,255,0.60)", eye: "#f2fbff" }
      ];
      // 最大3匹なので、少なくとも最初の3匹は同じ色に重複しないよう順番に割り当てる。
      CyberFish._bettaVariantCursor = (CyberFish._bettaVariantCursor || 0);
      this.visualVariant = variants[CyberFish._bettaVariantCursor % variants.length];
      CyberFish._bettaVariantCursor += 1;
      this.color = this.visualVariant.body2;
      this.patternSeed = Math.random() * 1000;
    }
  }

  configureSpecs() {
    switch(this.id) {
      case "neon-tetra":
        this.maxSpeed = 2.65;
        this.cruiseSpeed = 1.90;
        this.maxForce = 0.08;
        // 約4cm級を基準サイズ（描画全長 約32px @ scale=1）
        this.size = 8;
        this.historyMaxLength = 9;
        break;
      case "glass-catfish":
        // トランスルーセント: 群れで同じ方向を向き、中層で泳ぎながら定位する。
        this.maxSpeed = 0.34;
        this.cruiseSpeed = 0.055;
        this.maxForce = 0.010;
        // ネオンより明確に長く見える細長い体型。
        this.size = 23.0;
        this.historyMaxLength = 2;
        break;
      case "african-lampeye":
        this.maxSpeed = 2.15;
        this.cruiseSpeed = 1.55;
        this.maxForce = 0.055;
        // 約4〜4.5cm級。ネオンよりわずかに大きい
        this.size = 10.9;
        this.historyMaxLength = 5;
        break;
      case "rummynose-tetra":
        this.maxSpeed = 2.60;
        this.cruiseSpeed = 2.05;
        this.maxForce = 0.07;
        // 約4〜5cm級
        this.size = 9.8;
        this.historyMaxLength = 8;
        break;
      case "angelfish":
        this.maxSpeed = 1.00;
        this.cruiseSpeed = 0.55;
        this.maxForce = 0.022;
        // 成魚は全長約15cm・体高20cm級。小型魚とは明確に別スケール
        this.size = 40;
        this.historyMaxLength = 3;
        break;
      case "guppy":
        this.maxSpeed = 2.10;
        this.cruiseSpeed = 1.45;
        this.maxForce = 0.08;
        // オスの大きな尾を含めて約5cm級として表示
        this.size = 11.8;
        this.historyMaxLength = 5;
        break;
      case "molly":
        this.maxSpeed = 1.35;
        this.cruiseSpeed = 0.88;
        this.maxForce = 0.035;
        // 現在の丸い体型はバルーンモーリーとして扱う。
        // 平均5cm前後を基準に、ネオン約4cmより少し大きい程度へ。
        this.size = 14.0;
        this.historyMaxLength = 4;
        break;
      case "betta":
        this.maxSpeed = 1.20;
        this.cruiseSpeed = 0.64;
        this.maxForce = 0.045;
        // 体長約6.5cm級。胴体を小型魚より明確に大きくし、尾びれ込みでは主役級の見かけ寸法。
        this.size = 18;
        this.historyMaxLength = 11;
        break;
      case "corydoras":
        // パンダコリ: 底床を群れで探り、短く移動しては止まる。
        this.maxSpeed = 1.55;
        this.cruiseSpeed = 0.62;
        this.maxForce = 0.072;
        this.size = 13.2;
        this.historyMaxLength = 3;
        this.coryState = "forage";
        this.coryTimer = 220 + Math.random() * 360;
        break;
      case "shrimp":
        // レッドビー: 泳ぎ回らず、藻面で長くツマツマする。
        this.maxSpeed = 0.12;
        this.cruiseSpeed = 0.025;
        this.maxForce = 0.012;
        this.size = 8.6;
        this.historyMaxLength = 0;
        this.shrimpState = "graze";
        this.shrimpTimer = 780 + Math.random() * 1320;
        this.shrimpDir = Math.random() < 0.5 ? -1 : 1;
        this.shrimpGrazeTarget = null;
        break;
    }
  }

  update(tempFactor, phFactor) {
    const scale = window.aquariumInstance ? window.aquariumInstance.scale : 1.0;
    if (this.boundaryTurnCooldown > 0) {
      this.boundaryTurnCooldown -= 1;
      if (this.boundaryEscapeDir) this.facing = this.boundaryEscapeDir;
    } else if (!(this.id === "betta" && this.boundaryEscapeDir)) {
      // Betta keeps its wall-retreat heading until it has physically cleared the glass.
      this.boundaryEscapeDir = 0;
    }

    // レッドビーシュリンプ: 前景カーペットを主な採餌面にし、魚が近づいた時だけ短く泳いで逃げる。
    if (this.id === "shrimp") {
      const aq = window.aquariumInstance;
      const now = aq?.lastTime || ((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now());

      // 逃避中は通常のツムツムAIを止める。後脚で弾くように短く泳ぎ、別の前景面へ着地する。
      if (this.shrimpEscapeUntil > now && this.shrimpEscapeTarget) {
        const dx = this.shrimpEscapeTarget.x - this.pos.x;
        const dy = this.shrimpEscapeTarget.y - this.pos.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        const burst = 1.45 * scale;
        this.vel.x += ((dx / d) * burst - this.vel.x) * 0.18;
        this.vel.y += ((dy / d) * burst - this.vel.y) * 0.18;
        this.vel.limit(1.9 * scale);
        this.pos.add(this.vel);
        this.acc.mult(0);
        if (Math.abs(this.vel.x) > 0.04) this.shrimpDir = this.vel.x < 0 ? -1 : 1;
        this.facing = this.shrimpDir;
        this.phase += 0.34;
        if (d < 7 * scale) this.shrimpEscapeUntil = now;
        this.checkBoundaries();
        return;
      }
      if (this.shrimpEscapeUntil && this.shrimpEscapeUntil <= now) {
        this.shrimpEscapeUntil = 0;
        this.shrimpEscapeTarget = null;
        this.shrimpState = "graze";
        this.shrimpTimer = 620 + Math.random() * 1050;
        this.shrimpGrazeTarget = aq ? aq.getShrimpGrazePoint(this.pos) : null;
        if (this.shrimpGrazeTarget) {
          const dx = this.shrimpGrazeTarget.x - this.pos.x;
          if (Math.abs(dx) > 2 * scale) this.shrimpDir = dx < 0 ? -1 : 1;
        }
        this.vel.mult(0.20);
      }

      if (aq && !this.shrimpGrazeTarget) {
        this.shrimpGrazeTarget = aq.getShrimpGrazePoint(this.pos);
        if (this.shrimpGrazeTarget) {
          this.pos.x = this.shrimpGrazeTarget.x;
          this.pos.y = this.shrimpGrazeTarget.y;
          this.vel.mult(0);
        }
      }

      this.shrimpTimer -= 1;
      if (this.shrimpTimer <= 0) {
        if (this.shrimpState === "graze") {
          this.shrimpState = "walk";
          this.shrimpTimer = 120 + Math.random() * 180;
          if (aq) {
            const next = aq.getShrimpGrazePoint(this.pos);
            if (next) {
              this.shrimpGrazeTarget = next;
              const dx = next.x - this.pos.x;
              if (Math.abs(dx) > 2 * scale) this.shrimpDir = dx < 0 ? -1 : 1;
            }
          }
        } else {
          this.shrimpState = "graze";
          this.shrimpTimer = 720 + Math.random() * 1500;
          this.vel.mult(0.18);
        }
      }

      if (this.shrimpGrazeTarget) {
        const dx = this.shrimpGrazeTarget.x - this.pos.x;
        const dy = this.shrimpGrazeTarget.y - this.pos.y;
        if (this.shrimpState === "walk") {
          const d = Math.max(1, Math.hypot(dx, dy));
          const walkSpeed = 0.070 * scale;
          this.vel.x += ((dx / d) * walkSpeed - this.vel.x) * 0.055;
          this.vel.y += ((dy / d) * walkSpeed - this.vel.y) * 0.055;
          if (d < 2.4 * scale) {
            this.shrimpState = "graze";
            this.shrimpTimer = 720 + Math.random() * 1500;
            this.vel.mult(0.12);
          }
        } else {
          this.vel.x += dx * 0.003;
          this.vel.y += dy * 0.003;
          this.vel.mult(0.72);
        }
      }

      this.pos.add(this.vel);
      this.acc.mult(0);
      this.facing = this.shrimpDir;
      this.checkBoundaries();
      this.phase += this.shrimpState === "graze" ? 0.105 : 0.035;
      return;
    }

    // パンダコリ: 通常は砂を探り、ときどき腸呼吸のため水面まで一気に上がって戻る。
    if (this.id === "corydoras") {
      const aq = window.aquariumInstance;
      const now = aq?.lastTime || ((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now());
      if (this.coryAirState && this.coryAirState !== "bottom" && aq) {
        const tank = aq.getTankBounds();
        // Lock direction and posture for the ascent. Corydoras make one clean dash
        // rather than steering back and forth on the way up.
        this.facing = this.coryAirFacing || this.facing || 1;
        const pitch = this.coryAirPitch || 0.90;
        const len = this.size * 1.55;
        const h = this.size * 0.68;
        // Mouth local position is taken from the actual cory vector drawing. After
        // pitch + facing transform, solve the body-centre Y so the mouth, not the
        // forehead/flank, touches the water surface.
        const mouthLocalX = len * 0.89;
        const mouthLocalY = h * 0.27;
        const mouthOffsetY = (-Math.sin(pitch) * mouthLocalX + Math.cos(pitch) * mouthLocalY) * this.depthScale * scale;
        const surfaceY = tank.top - mouthOffsetY;

        // Air-breathing bypasses the normal boundary routine, so keep the whole
        // rotated fish inside the glass here. Facing stays locked; only outward
        // horizontal drift is cancelled when the body reaches the side margin.
        const airHalfWidth = Math.hypot(len * 1.30, h * 1.48) * this.depthScale * scale;
        const minAirX = tank.left + airHalfWidth + 2 * scale;
        const maxAirX = tank.right - airHalfWidth - 2 * scale;
        const keepCoryInsideGlass = () => {
          if (minAirX >= maxAirX) {
            this.pos.x = (tank.left + tank.right) * 0.5;
            this.vel.x = 0;
            return;
          }
          if (this.pos.x < minAirX) {
            this.pos.x = minAirX;
            if (this.vel.x < 0) this.vel.x = 0;
          } else if (this.pos.x > maxAirX) {
            this.pos.x = maxAirX;
            if (this.vel.x > 0) this.vel.x = 0;
          }
        };

        if (this.coryAirState === "ascent") {
          const vx = this.coryAirVx || this.facing * 0.72 * scale;
          this.vel.x += (vx - this.vel.x) * 0.22;
          this.vel.y += (-3.15 * scale - this.vel.y) * 0.20;
          this.vel.limit(3.55 * scale);
          this.pos.add(this.vel);
          keepCoryInsideGlass();
          if (this.pos.y <= surfaceY) {
            this.pos.y = surfaceY;
            this.vel.x *= 0.42;
            this.vel.y = 0;
            this.coryAirState = "surface";
            // Inspiration is only ~0.06–0.07 s.
            this.coryAirSurfaceUntil = now + 58 + Math.random() * 16;
            if (window.cyberAudio?.playCorydorasAirGulp) window.cyberAudio.playCorydorasAirGulp();
          }
        } else if (this.coryAirState === "surface") {
          this.vel.x *= 0.22;
          this.vel.y = 0;
          this.pos.x += this.vel.x;
          this.pos.y = surfaceY;
          keepCoryInsideGlass();
          if (now >= (this.coryAirSurfaceUntil || 0)) {
            // Immediately after the gulp, make a short feeding-like downward snap.
            // The fish keeps the same left/right facing; it does not flip around.
            this.coryAirState = "snap";
            this.coryAirSnapUntil = now + 95 + Math.random() * 35;
            this.vel.x = this.facing * 0.48 * scale;
            this.vel.y = 2.75 * scale;
          }
        } else if (this.coryAirState === "snap") {
          this.vel.x += (this.facing * 0.62 * scale - this.vel.x) * 0.18;
          this.vel.y += (3.05 * scale - this.vel.y) * 0.24;
          this.vel.limit(3.25 * scale);
          this.pos.add(this.vel);
          keepCoryInsideGlass();
          if (now >= (this.coryAirSnapUntil || 0)) {
            this.coryAirState = "descent";
            this.coryAirDescentStartedAt = now;
          }
        } else if (this.coryAirState === "descent") {
          // First part of the return is a steep, decisive dive; only later does
          // the cory flatten back toward its normal bottom posture.
          const descentAge = now - (this.coryAirDescentStartedAt || now);
          const earlyDive = descentAge < 430;
          const targetVx = this.facing * (earlyDive ? 0.28 : 0.46) * scale;
          const targetVy = (earlyDive ? 3.05 : 2.55) * scale;
          this.vel.x += (targetVx - this.vel.x) * (earlyDive ? 0.14 : 0.08);
          this.vel.y += (targetVy - this.vel.y) * (earlyDive ? 0.18 : 0.10);
          this.vel.limit((earlyDive ? 3.30 : 2.95) * scale);
          this.pos.add(this.vel);
          keepCoryInsideGlass();
          const floorNow = aq.getTerrainHeight(this.pos.x) - Math.max(7.4 * scale, this.size * 0.55 * scale);
          if (this.pos.y >= floorNow) {
            this.pos.y = floorNow;
            this.vel.y = 0;
            this.vel.x *= 0.48;
            this.coryAirState = "bottom";
            this.coryState = "forage";
            this.coryTimer = 180 + Math.random() * 280;
            this.coryAirTargetX = null;
            this.coryAirVx = 0;
            this.coryAirDescentStartedAt = 0;
          }
        }
        this.acc.mult(0);
        this.phase += 0.18 + this.vel.mag() * 0.06;
        return;
      }

      this.coryTimer -= 1;
      if (this.coryTimer <= 0) {
        if (this.coryState === "forage") {
          this.coryState = "pause";
          this.coryTimer = 45 + Math.random() * 130;
        } else {
          this.coryState = "forage";
          this.coryTimer = 170 + Math.random() * 360;
          if (Math.random() < 0.34) this.facing *= -1;
        }
      }
    }

    // 魚の移動トレールは全魚種・全テーマで廃止。
    // 履歴座標も収集しない。

    // 捕食直後の短い実移動は通常AIより優先する。食いつき中はboidsの速度補正を通さない。
    const feedNow = window.aquariumInstance && window.aquariumInstance.lastTime
      ? window.aquariumInstance.lastTime
      : ((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now());
    if (this.feedMotion) {
      const feedMotionScale = window.aquariumInstance ? window.aquariumInstance.getMotionScale() : 1.0;
      if (this.updateFeedingMotion(feedNow, feedMotionScale)) {
        this.acc.mult(0);
        return;
      }
    }

    // 生態レイヤーを更新。安全な通路に入った時だけ水草の前後関係を切り替える。
    const aqDepth = window.aquariumInstance;
    if (aqDepth && typeof aqDepth.updateFishDepthBehavior === "function") {
      aqDepth.updateFishDepthBehavior(this, feedNow);
    }

    // 魚体の見かけ寸法が大きくなる全画面でも、体長/秒の感覚が極端に遅くならないよう
    // 移動倍率は緩やかに追従させる。種ごとの速度比は maxSpeed / cruiseSpeed で保持する。
    const motionScale = window.aquariumInstance ? window.aquariumInstance.getMotionScale() : 1.0;
    // 隠し連動: 消灯に近づくほど全魚が静かになる。種ごとの速度比は維持。
    const lightActivityScale = window.aquariumInstance ? window.aquariumInstance.getLightActivityScale() : 1.0;
    let actualMaxSpeed = this.maxSpeed * tempFactor * this.depthSpeed * motionScale * lightActivityScale;
    let targetCruise = this.cruiseSpeed * tempFactor * this.depthSpeed * motionScale * lightActivityScale;

    if (this.id === "corydoras" && this.coryState === "pause") {
      targetCruise *= 0.16;
      actualMaxSpeed *= 0.42;
      this.acc.mult(0.55);
    }

    if (this.id === "glass-catfish") {
      // 透明ナマズは群れで定位する。実移動は小さく、身体と尾は別途 phase で泳ぎ続ける。
      targetCruise = this.cruiseSpeed * this.depthSpeed * motionScale * lightActivityScale;
      actualMaxSpeed = Math.min(
        this.maxSpeed * this.depthSpeed * motionScale * lightActivityScale,
        targetCruise * 2.15
      );
      this.acc.mult(0.48);
    }

    this.vel.add(this.acc);

    // boids の力だけだと初速のまま全種が似た速度になるため、種ごとの巡航速度へ緩く収束させる。
    const speed = this.vel.mag();
    if (speed > 0.0001) {
      if (this.id === "glass-catfish") {
        if (speed > targetCruise * 1.35) this.vel.mult(0.925);
        else if (speed < targetCruise * 0.62) this.vel.mult(1.008);
      } else {
        if (speed < targetCruise * 0.88) this.vel.mult(1.018);
        else if (speed > targetCruise * 1.18) this.vel.mult(0.985);
      }
    } else {
      this.vel.x = this.facing * targetCruise * 0.12;
    }
    this.vel.limit(actualMaxSpeed);
    this.pos.add(this.vel);
    this.acc.mult(0);

    if (this.id === "angelfish") {
      if (this.boundaryTurnCooldown <= 0 && Math.abs(this.vel.x) > 0.11) {
        const desiredFacing = this.vel.x < 0 ? -1 : 1;
        if (desiredFacing === this.facing) {
          this.turnCooldown = Math.max(this.turnCooldown - 1, 0);
        } else if (this.turnCooldown <= 0) {
          this.facing = desiredFacing;
          this.turnCooldown = 26;
        }
      }
      if (Math.abs(this.vel.x) < 0.042) this.vel.x += this.facing * 0.0022;
    } else if (this.id !== "glass-catfish" && !this.boundaryEscapeDir && this.boundaryTurnCooldown <= 0 && Math.abs(this.vel.x) > 0.055) {
      this.facing = this.vel.x < 0 ? -1 : 1;
    }

    this.checkBoundaries();
    this.phase += this.id === "glass-catfish" ? 0.070 : (this.vel.mag() * 0.14 + 0.030);
  }

  getFeedCooldownMs() {
    const ranges = {
      "neon-tetra": [1400, 2200],
      "rummynose-tetra": [1400, 2200],
      "african-lampeye": [1500, 2300],
      "guppy": [1500, 2400],
      "glass-catfish": [2200, 3400],
      "betta": [2600, 4000],
      "molly": [1900, 3000],
      "corydoras": [1800, 2900],
      "angelfish": [2400, 3600],
      "shrimp": [2200, 3600]
    };
    const [min, max] = ranges[this.id] || [1600, 2600];
    return min + Math.random() * (max - min);
  }

  isFeedCoolingDown(now = ((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now())) {
    return now < (this.feedCooldownUntil || 0);
  }

  beginFeedCooldown(now = ((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now())) {
    this.feedCooldownUntil = now + this.getFeedCooldownMs();
  }

  isFeedingMotionActive(now = ((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now())) {
    if (!this.feedMotion) return false;
    const total = this.feedMotion.strikeMs + this.feedMotion.turnMs + this.feedMotion.coastMs;
    if (now - this.feedMotion.startedAt >= total) {
      // トランスルーセントだけは食後に群れの定位方向へ戻す。
      if (this.id === "glass-catfish" && window.aquariumInstance) {
        this.facing = window.aquariumInstance.glassCurrentDirection || this.feedMotion.preFacing || this.facing;
      }
      this.feedMotion = null;
      return false;
    }
    return true;
  }

  buildFeedingMotion(action, now, aimY) {
    const preFacing = this.facing || 1;
    const rnd = Math.random();
    let profile = null;

    // 種ごとの捕食モーション。ベタはゆっくり寄って一口、ヒレを崩さず抜ける。
    if (this.id === "neon-tetra") {
      profile = { kind:"dart-turn", strikeMs:82, turnMs:125, coastMs:285, strike:3.20, exit:2.40, reverse:true, y:0.48 };
    } else if (this.id === "rummynose-tetra") {
      profile = { kind:"dart-turn", strikeMs:76, turnMs:120, coastMs:320, strike:3.55, exit:2.75, reverse:true, y:0.56 };
    } else if (this.id === "african-lampeye") {
      profile = { kind:"surface-dart", strikeMs:86, turnMs:130, coastMs:300, strike:2.85, exit:2.10, reverse:rnd < 0.82, y:0.78 };
    } else if (this.id === "guppy") {
      profile = { kind:"peck-slip", strikeMs:72, turnMs:105, coastMs:255, strike:2.55, exit:1.62, reverse:rnd < 0.58, y:0.50 };
    } else if (this.id === "glass-catfish") {
      profile = { kind:"soft-slip", strikeMs:105, turnMs:135, coastMs:390, strike:0.29, exit:0.15, reverse:rnd < 0.38, y:0.30 };
    } else if (this.id === "betta") {
      profile = { kind:"betta-pounce", strikeMs:118, turnMs:185, coastMs:365, strike:1.48, exit:0.60, reverse:rnd < 0.34, y:0.38 };
    } else if (this.id === "molly") {
      profile = { kind:"molly-peck", strikeMs:102, turnMs:145, coastMs:270, strike:1.62, exit:0.74, reverse:rnd < 0.30, y:0.32 };
    } else if (this.id === "corydoras") {
      profile = { kind:"cory-root", strikeMs:125, turnMs:170, coastMs:255, strike:0.72, exit:0.34, reverse:false, y:0.18 };
    }
    if (!profile) return null;

    const exitFacing = profile.reverse ? -preFacing : preFacing;
    let exitY = Math.abs(aimY) > 0.18 ? -Math.sign(aimY) : (Math.random() < 0.5 ? -1 : 1);
    if (this.id === "african-lampeye") exitY = aimY > 0.05 ? -1 : (Math.random() < 0.65 ? 1 : -1);
    if (this.id === "corydoras") exitY = -0.18;

    return {
      ...profile,
      action,
      startedAt: now,
      preFacing,
      exitFacing,
      aimY,
      exitY
    };
  }

  updateFeedingMotion(now, motionScale = 1.0) {
    if (!this.isFeedingMotionActive(now)) return false;
    const m = this.feedMotion;
    const elapsed = now - m.startedAt;
    const strikeEnd = m.strikeMs;
    const turnEnd = strikeEnd + m.turnMs;
    const total = turnEnd + m.coastMs;
    const depthMotion = motionScale * (this.depthSpeed || 1);

    // 群泳・通常巡航の加速度をこの短時間だけ切る。
    this.acc.mult(0);

    if (elapsed < strikeEnd) {
      // 口を餌へ差し込む短い一撃。ここではまだ向きを変えない。
      const u = Math.max(0, Math.min(1, elapsed / Math.max(1, strikeEnd)));
      const punch = 0.78 + 0.22 * Math.sin(u * Math.PI);
      this.facing = m.preFacing;
      this.vel.x = m.preFacing * m.strike * depthMotion * punch;
      this.vel.y = m.aimY * m.strike * depthMotion * 0.34;
      this.phase += this.id === "glass-catfish" ? 0.18 : 0.42;
    } else if (elapsed < turnEnd) {
      // 食べた直後。尾を一発入れて逆方向／斜めへクイッと抜ける。
      const u = Math.max(0, Math.min(1, (elapsed - strikeEnd) / Math.max(1, m.turnMs)));
      this.facing = m.exitFacing;
      const kick = m.exit * depthMotion * (1.12 - 0.30 * u);
      this.vel.x = m.exitFacing * kick;
      this.vel.y = m.exitY * m.exit * depthMotion * m.y * (1.0 - 0.35 * u);
      this.phase += this.id === "glass-catfish" ? 0.22 : 0.70;
    } else {
      // 旋回後は惰性で減速。いきなり通常AIへ戻さない。
      const u = Math.max(0, Math.min(1, (elapsed - turnEnd) / Math.max(1, m.coastMs)));
      const ease = Math.pow(1 - u, 1.35);
      this.facing = m.exitFacing;
      const minCarry = this.id === "glass-catfish" ? 0.035 : this.cruiseSpeed * 0.32;
      const carry = minCarry + m.exit * depthMotion * 0.72 * ease;
      this.vel.x = m.exitFacing * carry;
      this.vel.y *= 0.90;
      this.phase += this.id === "glass-catfish" ? 0.08 : 0.16;
    }

    this.pos.add(this.vel);
    this.checkBoundaries();
    if (elapsed >= total - 1) this.isFeedingMotionActive(now + 2);
    return true;
  }

  triggerFeedingAction(targetPos = null) {
    const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    this.beginFeedCooldown(now);
    // エンゼルとシュリンプは今回アクション対象外。ただし食後クールダウンは共通。
    if (this.id === "angelfish" || this.id === "shrimp") return;

    const scale = window.aquariumInstance ? window.aquariumInstance.scale : 1.0;
    const dx = targetPos ? targetPos.x - this.pos.x : this.facing;
    const dy = targetPos ? targetPos.y - this.pos.y : 0;

    // 餌の位置が左右にはっきりしていれば、捕食直前の向きを口先側へ揃える。
    if (this.id !== "glass-catfish" && Math.abs(dx) > Math.max(2 * scale, this.size * 0.12 * scale)) {
      this.facing = dx < 0 ? -1 : 1;
    }

    const aimY = Math.max(-1, Math.min(1, dy / Math.max(1, this.size * scale * 1.4)));
    let action = "feed";
    if (["neon-tetra", "rummynose-tetra"].includes(this.id)) action = "dart-turn";
    else if (this.id === "african-lampeye") action = "surface-dart";
    else if (this.id === "guppy") action = "peck-slip";
    else if (this.id === "glass-catfish") action = "soft-slip";
    else if (this.id === "betta") action = "betta-pounce";
    else if (this.id === "molly") action = "molly-peck";
    else if (this.id === "corydoras") action = "cory-root";

    this.feedAction = action;
    this.feedActionStartedAt = now;
    this.feedActionStrength = 1.0;
    this.feedAimY = aimY;
    this.feedMotion = this.buildFeedingMotion(action, now, aimY);
    this.feedActionDuration = this.feedMotion
      ? this.feedMotion.strikeMs + this.feedMotion.turnMs + this.feedMotion.coastMs
      : 0;

    if (this.id === "corydoras") {
      this.coryState = "forage";
      this.coryTimer = Math.max(this.coryTimer || 0, 85);
    }
  }

  getFeedingVisual(now) {
    if (!this.feedMotion || !this.isFeedingMotionActive(now)) return null;
    const m = this.feedMotion;
    const elapsed = now - m.startedAt;
    const strikeEnd = m.strikeMs;
    const turnEnd = strikeEnd + m.turnMs;
    const uStrike = Math.max(0, Math.min(1, elapsed / Math.max(1, strikeEnd)));
    const uTurn = Math.max(0, Math.min(1, (elapsed - strikeEnd) / Math.max(1, m.turnMs)));

    // 実移動が主役。描画側は口を刺す瞬間と尾を返す瞬間の姿勢だけ補助する。
    let tilt = 0;
    let scaleX = 1;
    let scaleY = 1;
    if (elapsed < strikeEnd) {
      tilt = this.feedAimY * 0.055 * Math.sin(uStrike * Math.PI);
      scaleX = 1 + 0.018 * Math.sin(uStrike * Math.PI);
      scaleY = 1 - 0.010 * Math.sin(uStrike * Math.PI);
    } else if (elapsed < turnEnd) {
      const turnPulse = Math.sin(uTurn * Math.PI);
      tilt = m.exitY * 0.10 * turnPulse;
      if (this.id === "rummynose-tetra" || this.id === "neon-tetra") tilt *= 1.25;
      if (this.id === "betta") tilt *= 0.48;
      if (this.id === "corydoras") tilt = 0.12 * turnPulse;
    }

    return { forward: 0, down: this.id === "corydoras" ? 1.1 * Math.sin(Math.min(1, elapsed / Math.max(1, turnEnd)) * Math.PI) : 0, tilt, scaleX, scaleY };
  }

  applyForce(force) {
    this.acc.add(force);
  }

  checkBoundaries() {
    const width = window.aquariumCanvasWidth || 800;
    const height = window.aquariumCanvasHeight || 500;
    const aq = window.aquariumInstance;
    const scale = aq ? aq.scale : 1.0;
    const tank = aq ? aq.getTankBounds() : { left: 0, right: width, top: 0, bottom: height };
    const actualMaxSpeed = this.maxSpeed * this.depthSpeed;
    const actualMaxForce = this.maxForce;

    // 当たり判定はガラス底ではなく、現在位置の砂面を基準にする。
    const terrainY = aq ? aq.getTerrainHeight(this.pos.x) : height - 25;
    const extentFactor = ({
      "angelfish": 2.18,
      "betta": 1.08,
      "corydoras": 0.56,
      "shrimp": 0.50,
      "glass-catfish": 0.58,
      "african-lampeye": 0.63,
      "rummynose-tetra": 0.66,
      "guppy": 0.72,
      "molly": 0.72,
      "neon-tetra": 0.68
    })[this.id] || 0.72;
    const bodyBottomClearance = Math.max(4.5 * scale, this.size * this.depthScale * extentFactor * scale);
    const visualRadius = Math.max(7 * scale, this.size * scale * this.depthScale * 0.72);
    // Betta fins occupy far more horizontal space than the body center suggests.
    // Start the turn before the tail touches glass instead of correcting at the last pixels.
    const buffer = this.id === "betta"
      ? Math.max(58 * scale, this.size * this.depthScale * 3.15 * scale)
      : Math.max(12 * scale, visualRadius * 0.82);
    // PAKU: drawWaterSurface() paints the visible surface line at tank.top + 10*scale,
    // not at tank.top itself - keep the swim ceiling below that line so fish don't
    // read as poking out above the water.
    const surfaceMargin = 10 * scale;
    const minX = tank.left + visualRadius;
    const maxX = tank.right - visualRadius;
    const minY = tank.top + surfaceMargin + visualRadius;
    const maxY = Math.max(minY + 2 * scale, Math.min(tank.bottom - bodyBottomClearance, terrainY - bodyBottomClearance));
    const column = WATER_COLUMN_PROFILES[this.id];
    const waterSpanForBounds = Math.max(1, (terrainY - bodyBottomClearance) - (tank.top + surfaceMargin));
    const speciesMinY = column ? Math.max(minY, tank.top + surfaceMargin + waterSpanForBounds * column.hardMin) : minY;
    const speciesMaxY = column ? Math.min(maxY, tank.top + surfaceMargin + waterSpanForBounds * column.hardMax) : maxY;
    let desired = null;

    // 横壁に入ったら一度だけ内側へ向ける。ベタは長い鰭を含めて十分に
    // ガラスから離れるまで同じ向きを維持し、壁際で左右反転を繰り返さない。
    let hitDir = 0;
    if (this.id === "betta" && this.boundaryEscapeDir) {
      const clearMargin = buffer * 1.82;
      const cleared = this.boundaryEscapeDir > 0
        ? this.pos.x >= tank.left + clearMargin
        : this.pos.x <= tank.right - clearMargin;
      if (cleared) {
        this.boundaryEscapeDir = 0;
        this.boundaryTurnCooldown = 0;
      } else {
        hitDir = this.boundaryEscapeDir;
      }
    }
    if (!hitDir) {
      if (this.pos.x < tank.left + buffer) hitDir = 1;
      else if (this.pos.x > tank.right - buffer) hitDir = -1;
    }
    if (hitDir) {
      if (this.boundaryEscapeDir !== hitDir || this.boundaryTurnCooldown <= 0) {
        this.boundaryEscapeDir = hitDir;
        this.boundaryTurnCooldown = this.id === "angelfish" ? 54 : (this.id === "betta" ? 90 : 34);
      }
      const inwardFloor = this.id === "betta"
        ? Math.max(actualMaxSpeed * 0.58, this.cruiseSpeed * this.depthSpeed * 0.92)
        : Math.max(actualMaxSpeed * 0.38, this.cruiseSpeed * this.depthSpeed * 0.58);
      this.vel.x = hitDir * Math.max(inwardFloor, Math.abs(this.vel.x) * (this.id === "betta" ? 0.90 : 0.72));
      if (this.id === "betta") this.vel.y *= 0.58;
      this.facing = hitDir;
      if (this.id === "shrimp") this.shrimpDir = hitDir;
      if (this.id === "glass-catfish" && aq) aq.glassCurrentDirection = hitDir;
      desired = new Vector(hitDir * actualMaxSpeed, this.vel.y * (this.id === "betta" ? 0.12 : 0.45));
    } else if (this.boundaryTurnCooldown > 0 && this.boundaryEscapeDir) {
      this.applyForce(new Vector(this.boundaryEscapeDir * actualMaxForce * (this.id === "betta" ? 0.60 : 0.22), 0));
    }

    if (this.id === "corydoras") {
      const lift = Math.max(7.4 * scale, this.size * this.depthScale * 0.55 * scale);
      const noseSearch = this.coryState === "forage" ? Math.sin(this.phase * 0.72) * 1.15 * scale : 0;
      const targetY = terrainY - lift + noseSearch;
      const ceiling = terrainY - Math.max(28 * scale, lift * 3.0);
      if (this.pos.y < ceiling) desired = new Vector(this.vel.x, 0.9 * scale);
      else if (this.pos.y > terrainY - bodyBottomClearance) desired = new Vector(this.vel.x, -1.0 * scale);
      else if (!hitDir) desired = new Vector(this.vel.x, (targetY - this.pos.y) * 0.13);
    } else if (this.id === "shrimp") {
      // 活着物上にも居るため上側は従来通り。底床にいる場合だけ砂へ沈ませない。
      if (this.pos.y > terrainY - bodyBottomClearance) {
        this.pos.y = terrainY - bodyBottomClearance;
        this.vel.y = Math.min(0, this.vel.y);
      }
      if (this.pos.y < minY) {
        this.pos.y = minY;
        this.vel.y = Math.abs(this.vel.y);
      }
    } else {
      const upperGuard = column ? speciesMinY : tank.top + buffer;
      const lowerGuard = column ? speciesMaxY : terrainY - bodyBottomClearance - 6 * scale;
      if (this.pos.y < upperGuard) {
        desired = new Vector(this.vel.x, actualMaxSpeed);
      } else if (this.pos.y > lowerGuard) {
        desired = new Vector(this.vel.x, -actualMaxSpeed);
      }
    }

    if (desired !== null) {
      desired.normalize().mult(actualMaxSpeed);
      const steer = desired.sub(this.vel);
      steer.limit(actualMaxForce * 1.5);
      this.applyForce(steer);
    }

    // 最後の安全クランプ。特に下側は砂面より下へ中心座標を通さない。
    if (this.pos.x < minX) { this.pos.x = minX; this.vel.x = Math.abs(this.vel.x) * 0.72; this.facing = 1; }
    if (this.pos.x > maxX) { this.pos.x = maxX; this.vel.x = -Math.abs(this.vel.x) * 0.72; this.facing = -1; }
    const clampTopY = column ? speciesMinY : minY;
    const clampBottomY = column ? speciesMaxY : maxY;
    if (this.pos.y < clampTopY) { this.pos.y = clampTopY; this.vel.y = Math.abs(this.vel.y) * 0.65; }
    if (this.id !== "shrimp" && this.pos.y > clampBottomY) {
      this.pos.y = clampBottomY;
      this.vel.y = -Math.abs(this.vel.y) * 0.58;
    }
  }

  flock(fishes, packets, sameSpecies = null) {
    const scale = window.aquariumInstance ? window.aquariumInstance.scale : 1.0;

    // シュリンプは給餌パケットを追わず、藻をツマツマする底生行動を優先。
    if (this.id === "shrimp") {
      const sep = this.separate(sameSpecies || fishes, 1.65);
      sep.mult(0.34);
      this.applyForce(sep);
      return;
    }

    if (this.feedMotion && this.isFeedingMotionActive()) {
      // 食後0.4〜0.7秒だけは通常の群泳ステアリングを止め、捕食軌道を読めるようにする。
      return;
    }

    if (packets.length > 0 && !this.isFeedCoolingDown()) {
      let closestPacket = null;
      let closestDistSq = Infinity;
      packets.forEach(p => {
        const d2 = this.pos.distSq(p.pos);
        if (d2 < closestDistSq) {
          closestDistSq = d2;
          closestPacket = p;
        }
      });

      const senseRange = (this.id === "betta" ? 350 : (this.id === "corydoras" ? 220 : (this.id === "shrimp" ? 120 : 200))) * scale;
      
      if (closestPacket && closestDistSq < senseRange * senseRange) {
        const aqFood = window.aquariumInstance;
        const packetTerrainY = aqFood.getTerrainHeight(closestPacket.pos.x);
        const tankFood = aqFood.getTankBounds();
        const waterSpan = Math.max(1, packetTerrainY - tankFood.top);
        const packetRatio = (closestPacket.pos.y - tankFood.top) / waterSpan;
        const isBottomFood = closestPacket.settled || closestPacket.pos.y > packetTerrainY - 34 * scale;
        const column = WATER_COLUMN_PROFILES[this.id];
        const canPursue = this.id === "corydoras"
          ? isBottomFood
          : (this.id !== "shrimp" && !isBottomFood && (!column || packetRatio <= column.feedMax));
        if (canPursue) {
          const seekForce = this.seek(closestPacket.pos);
          seekForce.mult(this.id === "betta" ? 2.2 : (this.id === "corydoras" ? 1.55 : 1.3));
          this.applyForce(seekForce);
          return;
        }
      }
    }

    const school = sameSpecies || fishes;
    // トランスルーセントは密着はしないが、ひとつの群れとして佇む距離感にする。
    let sep = this.id === "glass-catfish" ? this.separate(school, 2.72) : this.separate(school);
    let ali = this.align(school);
    let coh = this.cohere(school, this.id === "glass-catfish" ? 132 : 80);

    if (this.id === "neon-tetra") {
      sep.mult(1.4); ali.mult(1.3); coh.mult(1.5);
    } else if (this.id === "glass-catfish") {
      // 群れは近くに保つが、boids の強い seek で泳ぎ回らないよう力は弱くする。
      sep.mult(0.62); ali.mult(0.24); coh.mult(0.20);
    } else if (this.id === "african-lampeye") {
      sep.mult(1.25); ali.mult(1.05); coh.mult(0.95);
    } else if (this.id === "rummynose-tetra") {
      sep.mult(1.2); ali.mult(1.85); coh.mult(1.85);
    } else if (this.id === "angelfish") {
      sep.mult(2.8); ali.mult(0.08); coh.mult(0.14);
    } else if (this.id === "guppy") {
      sep.mult(1.8); ali.mult(0.45); coh.mult(0.35);
    } else if (this.id === "molly") {
      sep.mult(1.65); ali.mult(0.60); coh.mult(0.45);
    } else if (this.id === "betta") {
      sep.mult(3.2); ali.mult(0.0); coh.mult(0.0);
      let threatDetected = false;
      fishes.forEach(other => {
        if (other !== this && this.pos.distSq(other.pos) < (70 * scale) ** 2) threatDetected = true;
      });
      if (threatDetected && Math.random() < 0.008) {
        window.triggerBettaFlare && window.triggerBettaFlare();
      }
    } else if (this.id === "corydoras") {
      // 群れとして同じ底面を使うが、密着せず各個体が砂面を探る。
      sep.mult(1.55); ali.mult(0.82); coh.mult(0.72);
    } else if (this.id === "shrimp") {
      sep.mult(0.22); ali.mult(0.0); coh.mult(0.0);
    }

    this.applyForce(sep);
    this.applyForce(ali);
    this.applyForce(coh);

    if (this.id === "glass-catfish" && school.length > 1) {
      // 群れ全体の中心へごく弱く戻す。一定距離内では何もしないので密集しすぎない。
      let cx = 0, cy = 0, n = 0;
      school.forEach(other => {
        if (other !== this) { cx += other.pos.x; cy += other.pos.y; n++; }
      });
      if (n > 0) {
        cx /= n; cy /= n;
        const dx = cx - this.pos.x, dy = cy - this.pos.y;
        const d = Math.hypot(dx, dy);
        const rest = 54 * scale;
        if (d > rest) {
          const pull = Math.min(this.maxForce * 0.38, (d - rest) * 0.000055);
          this.applyForce(new Vector((dx / d) * pull, (dy / d) * pull));
        }
      }
    }

    // 種ごとの水深。前後(Z)レイヤーとは独立して、普段使う水柱(Y)を保つ。
    // v97までの弱い一点吸引では底まで漂えてしまったため、好みの帯域を持たせる。
    const aq = window.aquariumInstance;
    const column = WATER_COLUMN_PROFILES[this.id];
    if (aq && column) {
      const tank = aq.getTankBounds();
      const floorY = aq.getTerrainHeight(this.pos.x) - 18 * scale;
      const span = Math.max(40 * scale, floorY - tank.top);
      const currentRatio = (this.pos.y - tank.top) / span;
      const bias = (this.waterColumnBias || 0) * column.wander;
      let targetRatio = Math.max(column.softMin, Math.min(column.softMax, column.center + bias));
      // Outside the preferred band, pull toward the nearest edge first instead of
      // snapping every individual to an identical horizontal line.
      if (currentRatio < column.softMin) targetRatio = column.softMin + 0.025;
      else if (currentRatio > column.softMax) targetRatio = column.softMax - 0.025;
      const targetY = tank.top + span * targetRatio;
      const dy = targetY - this.pos.y;
      if (Math.abs(dy) > 5 * scale) {
        const urgency = currentRatio < column.softMin || currentRatio > column.softMax ? 1.35 : 1.0;
        const fy = Math.max(-this.maxForce * column.pull * urgency, Math.min(this.maxForce * column.pull * urgency, dy * 0.0020));
        this.applyForce(new Vector(0, fy));
      }
    }

    // トランスルーセントは個体ごとに方向転換させず、群れで同じ流れに向かって定位する。
    if (this.id === "glass-catfish" && aq) {
      const dir = aq.glassCurrentDirection || 1;
      this.facing = dir;
      // 進行するためではなく、流れに向かってヒレを動かしながらその場に留まる。
      this.applyForce(new Vector(-this.vel.x * 0.010, -this.vel.y * 0.008));
    }

    // グッピーは密な群泳ではなく、個体ごとに小さく進路を変える。
    if (this.id === "guppy" && Math.random() < 0.035) {
      this.applyForce(new Vector((Math.random() - 0.5) * 0.045, (Math.random() - 0.5) * 0.035));
    }
    // 大型・単独魚は完全な直線巡航にならないよう、ごく弱い漂いを入れる。
    if ((this.id === "betta" || this.id === "molly") && !(this.id === "betta" && this.boundaryEscapeDir) && Math.random() < 0.012) {
      this.applyForce(new Vector((Math.random() - 0.5) * 0.018, (Math.random() - 0.5) * 0.014));
    }
  }

  seek(target) {
    const scale = window.aquariumInstance ? window.aquariumInstance.scale : 1.0;
    const desired = target.copy().sub(this.pos);
    desired.normalize().mult(this.maxSpeed * this.depthSpeed);
    const steer = desired.sub(this.vel);
    steer.limit(this.maxForce);
    return steer;
  }

  separate(fishes, separationFactor = 2.3) {
    const scale = window.aquariumInstance ? window.aquariumInstance.scale : 1.0;
    const desiredseparation = this.size * separationFactor * scale;
    let steer = new Vector(0, 0);
    let count = 0;
    const maxD2 = desiredseparation * desiredseparation;
    fishes.forEach(other => {
      const dx = this.pos.x - other.pos.x;
      const dy = this.pos.y - other.pos.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0 && d2 < maxD2) {
        const d = Math.sqrt(d2);
        let diff = new Vector(dx / d, dy / d).div(d);
        steer.add(diff);
        count++;
      }
    });
    if (count > 0) {
      steer.div(count);
    }
    if (steer.mag() > 0) {
      steer.normalize().mult(this.maxSpeed * this.depthSpeed).sub(this.vel).limit(this.maxForce * 1.5);
    }
    return steer;
  }

  align(fishes) {
    const scale = window.aquariumInstance ? window.aquariumInstance.scale : 1.0;
    const neighbordist = 80 * scale;
    let sum = new Vector(0, 0);
    let count = 0;
    const maxD2 = neighbordist * neighbordist;
    fishes.forEach(other => {
      const dx = this.pos.x - other.pos.x;
      const dy = this.pos.y - other.pos.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0 && d2 < maxD2) {
        sum.add(other.vel);
        count++;
      }
    });
    if (count > 0) {
      sum.div(count).normalize().mult(this.maxSpeed * this.depthSpeed);
      let steer = sum.sub(this.vel);
      steer.limit(this.maxForce);
      return steer;
    }
    return new Vector(0, 0);
  }

  cohere(fishes, neighborDistance = 80) {
    const scale = window.aquariumInstance ? window.aquariumInstance.scale : 1.0;
    const neighbordist = neighborDistance * scale;
    let sum = new Vector(0, 0);
    let count = 0;
    const maxD2 = neighbordist * neighbordist;
    fishes.forEach(other => {
      const dx = this.pos.x - other.pos.x;
      const dy = this.pos.y - other.pos.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0 && d2 < maxD2) {
        sum.add(other.pos);
        count++;
      }
    });
    if (count > 0) {
      sum.div(count);
      return this.seek(sum);
    }
    return new Vector(0, 0);
  }

  draw(ctx, phFactor, renderOptions = null) {
    let drawColor = this.color;
    const scale = window.aquariumInstance ? window.aquariumInstance.scale : 1.0;

    // 全魚種共通の描画基盤。魚種別デザインは必ずローカル座標(0,0)で描く。
    // ここが抜けると全個体がキャンバス原点に描かれて水槽表示が崩れる。
    ctx.save();
    const renderPos = renderOptions && renderOptions.renderPos ? renderOptions.renderPos : this.pos;
    ctx.translate(renderPos.x, renderPos.y);
    const aq = window.aquariumInstance;
    const isNaturalTheme = true; // PAKU: NATURAL only, unconditionally.
    if (isNaturalTheme) applyNaturalLineSoftness(ctx);
    const actionNow = aq && aq.lastTime ? aq.lastTime : ((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now());
    const feedVisual = this.getFeedingVisual(actionNow);

    if (this.id === "shrimp") {
      // レッドビーは上下回転させず、進行方向だけ左右反転。
      ctx.scale(this.facing || this.shrimpDir || 1, 1);
    } else {
      let targetTilt;
      let tiltEase = 0.14;
      if (this.id === "corydoras" && this.coryAirState && this.coryAirState !== "bottom") {
        // One stable nose-up posture on the way up. At the surface the mouth alone
        // touches; after the gulp there is one quick nose-down snap, then a gentler
        // return. Left/right facing remains locked for the whole breathing event.
        if (this.coryAirState === "ascent" || this.coryAirState === "surface") {
          targetTilt = -(this.coryAirPitch || 0.90) * this.facing; // ~52deg
          tiltEase = this.coryAirState === "ascent" ? 0.32 : 0.46;
        } else if (this.coryAirState === "snap") {
          targetTilt = 0.62 * this.facing; // ~35.5deg nose-down
          tiltEase = 0.66;
        } else {
          const aqNow = window.aquariumInstance?.lastTime || 0;
          const descentAge = aqNow - (this.coryAirDescentStartedAt || aqNow);
          targetTilt = (descentAge < 430 ? 0.56 : 0.22) * this.facing;
          tiltEase = descentAge < 430 ? 0.26 : 0.10;
        }
      } else {
        targetTilt = Math.max(-0.20, Math.min(0.20,
          Math.atan2(this.vel.y, Math.max(0.35, Math.abs(this.vel.x))) * 0.42 * this.facing
        ));
      }
      this.bodyTilt += (targetTilt - this.bodyTilt) * tiltEase;
      const feedingTilt = feedVisual ? feedVisual.tilt * this.facing : 0;
      ctx.rotate(this.bodyTilt + feedingTilt);
      ctx.scale(this.facing, 1);
      if (feedVisual) {
        ctx.translate(feedVisual.forward, feedVisual.down);
        ctx.scale(feedVisual.scaleX, feedVisual.scaleY);
      }
    }

    // NATURAL: depth never fades the whole animal. Species/body-part alpha is authored
    // inside each renderer (transparent fins, translucent bodies, glass catfish, shrimp).
    // CYBER keeps depth alpha as a deliberate synthetic-depth effect.
    ctx.globalAlpha = isNaturalTheme ? 1.0 : this.depthAlpha;
    ctx.scale(scale * this.depthScale, scale * this.depthScale);
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = drawColor;
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.lineWidth = 1.5;

    if (this.id === "neon-tetra") {
      // 新共通テイスト: 暗いボディを核に、実物の青線と赤い後半部だけを強く発光。
      const len = this.size * 1.82;
      const h = this.size * 0.62;
      const tail = Math.sin(this.phase * 1.55) * h * 0.20;

      // 半透明の尾びれ
      ctx.fillStyle = isNaturalTheme ? "rgba(178,211,214,0.28)" : "rgba(0,243,255,0.08)";
      ctx.strokeStyle = isNaturalTheme ? "rgba(126,166,171,0.58)" : "rgba(0,243,255,0.46)";
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(-len * 0.82, 0);
      ctx.lineTo(-len * 1.20, -h * 0.62 + tail);
      ctx.lineTo(-len * 1.08, tail * 0.18);
      ctx.lineTo(-len * 1.20, h * 0.62 + tail);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 丸みのあるカラシン体型
      ctx.fillStyle = isNaturalTheme ? "rgba(91,118,119,0.88)" : "rgba(4,11,17,0.90)";
      ctx.strokeStyle = isNaturalTheme ? "rgba(175,204,201,0.78)" : "rgba(145,238,255,0.62)";
      ctx.lineWidth = FISH_OUTLINE_WIDTH;
      ctx.beginPath();
      ctx.moveTo(len, -h * 0.06);
      ctx.quadraticCurveTo(len * 0.60, -h * 0.74, -len * 0.18, -h * 0.72);
      ctx.quadraticCurveTo(-len * 0.66, -h * 0.52, -len * 0.84, -h * 0.12);
      ctx.lineTo(-len * 0.84, h * 0.12);
      ctx.quadraticCurveTo(-len * 0.60, h * 0.58, -len * 0.06, h * 0.62);
      ctx.quadraticCurveTo(len * 0.62, h * 0.58, len, h * 0.06);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Species pattern is NOT part of the shared outer-rim grammar.
      // NATURAL keeps the v105 two-layer iridescent blue/red bands exactly;
      // CYBER uses the same pattern as a stronger emitter.
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(len * 0.72, -h * 0.14);
      ctx.quadraticCurveTo(0, -h * 0.30, -len * 0.72, -h * 0.08);
      if (isNaturalTheme) {
        ctx.strokeStyle = "rgba(0,243,255,0.34)";
        ctx.lineWidth = 3.0;
        ctx.stroke();
        ctx.strokeStyle = "#7df9ff";
        ctx.lineWidth = 1.05;
        ctx.stroke();
      } else {
        // CYBER: the blue band itself is a luminous organ. Keep the band width,
        // then add a compact real glow only to this species marking.
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "rgba(0,243,255,0.18)"; ctx.lineWidth = 4.4; ctx.stroke();
        ctx.strokeStyle = "rgba(0,243,255,0.72)"; ctx.lineWidth = 2.8; ctx.stroke();
        ctx.strokeStyle = "#f4ffff"; ctx.lineWidth = 1.18; ctx.stroke();
        ctx.restore();
      }

      ctx.beginPath();
      ctx.moveTo(-len * 0.02, h * 0.12);
      ctx.quadraticCurveTo(-len * 0.42, h * 0.28, -len * 0.78, h * 0.12);
      if (isNaturalTheme) {
        ctx.strokeStyle = "rgba(255,43,77,0.42)";
        ctx.lineWidth = 3.0;
        ctx.stroke();
        ctx.strokeStyle = "#ff3152";
        ctx.lineWidth = 1.0;
        ctx.stroke();
      } else {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "rgba(255,43,77,0.17)"; ctx.lineWidth = 4.0; ctx.stroke();
        ctx.strokeStyle = "rgba(255,43,77,0.70)"; ctx.lineWidth = 2.7; ctx.stroke();
        ctx.strokeStyle = "#ffe1e7"; ctx.lineWidth = 1.10; ctx.stroke();
        ctx.restore();
      }

      // 小さな透明フィンと眼
      ctx.strokeStyle = "rgba(180,245,255,0.34)";
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(-len * 0.06, -h * 0.60);
      ctx.lineTo(-len * 0.30, -h * 1.00);
      ctx.lineTo(-len * 0.44, -h * 0.55);
      ctx.moveTo(len * 0.08, h * 0.52);
      ctx.lineTo(-len * 0.16, h * 0.84);
      ctx.stroke();
      ctx.fillStyle = "#dffcff";
      ctx.beginPath();
      ctx.arc(len * 0.70, -h * 0.18, 0.95, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#081018";
      ctx.beginPath();
      ctx.arc(len * 0.73, -h * 0.18, 0.38, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.id === "glass-catfish") {
      // トランスルーセント: 透明な外装の中に、骨格と器官が静かに浮かぶ。
      const len = this.size * 1.78;
      const h = this.size * 0.39;
      const bodyWave = Math.sin(this.phase * 1.55) * h * 0.08;
      const tailWave = Math.sin(this.phase * 2.06 + 0.7) * h * 0.31;
      const glassBody = new Path2D();
      glassBody.moveTo(len, 0);
      glassBody.quadraticCurveTo(len * 0.38, -h * 0.96, -len * 0.58, -h * 0.56);
      glassBody.lineTo(-len * 0.90, -h * 0.18 + bodyWave);
      glassBody.lineTo(-len * 1.15, -h * 0.54 + tailWave);
      glassBody.lineTo(-len * 1.05, tailWave * 0.68);
      glassBody.lineTo(-len * 1.15, h * 0.54 + tailWave);
      glassBody.lineTo(-len * 0.90, h * 0.18 + bodyWave);
      glassBody.lineTo(-len * 0.58, h * 0.56);
      glassBody.quadraticCurveTo(len * 0.38, h * 0.96, len, 0);
      glassBody.closePath();
      if (isNaturalTheme) {
        const glassGrad = ctx.createLinearGradient(len * 0.6, -h, -len * 0.8, h);
        glassGrad.addColorStop(0.0, "rgba(232,250,255,0.08)");
        glassGrad.addColorStop(0.55, "rgba(188,244,255,0.03)");
        glassGrad.addColorStop(1.0, "rgba(188,244,255,0.06)");
        ctx.fillStyle = glassGrad;
      } else {
        ctx.fillStyle = "rgba(188,244,255,0.045)";
      }
      ctx.strokeStyle = "rgba(185,248,255,0.40)";
      ctx.lineWidth = FISH_OUTLINE_WIDTH;
      ctx.fill(glassBody);
      ctx.stroke(glassBody);

      // 骨格は体内へ完全にクリップ。
      ctx.save();
      ctx.clip(glassBody);
      ctx.strokeStyle = "rgba(233,252,255,0.76)";
      ctx.lineWidth = 0.92;
      ctx.beginPath();
      ctx.moveTo(len * 0.58, 0);
      ctx.quadraticCurveTo(-len * 0.16, -h * 0.04, -len * 0.88, 0);
      ctx.stroke();
      if (!isNaturalTheme) {
        // One additive state for all eight emitters. The core still pulses per point,
        // while the faint halo is batched into a single fill.
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = "rgba(84,244,255,0.12)";
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const x = len * 0.42 - i * (len * 1.18 / 7);
          ctx.moveTo(x + 2.15, 0); ctx.arc(x, 0, 2.15, 0, Math.PI * 2);
        }
        ctx.fill();
        for (let i = 0; i < 8; i++) {
          const x = len * 0.42 - i * (len * 1.18 / 7);
          const pulse = 0.58 + 0.36 * Math.sin(this.phase * 1.08 + i * 0.72);
          ctx.fillStyle = `rgba(207,255,255,${Math.min(1,pulse)})`;
          ctx.beginPath(); ctx.arc(x, 0, 0.82, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      } else {
        ctx.fillStyle = "rgba(157,190,195,0.34)";
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const x = len * 0.42 - i * (len * 1.18 / 7);
          ctx.moveTo(x + 0.76, 0); ctx.arc(x, 0, 0.76, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      // Rib geometry shares one path/stroke instead of eight independent strokes.
      ctx.strokeStyle = isNaturalTheme ? "rgba(139,169,174,0.24)" : "rgba(188,246,255,0.30)";
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const x = len * 0.42 - i * (len * 1.18 / 7);
        const ribH = h * (0.22 + (1 - i / 7) * 0.13);
        ctx.moveTo(x, -0.8); ctx.quadraticCurveTo(x - 1.1, -ribH * 0.48, x - 2.4, -ribH);
        ctx.moveTo(x, 0.8); ctx.quadraticCurveTo(x - 1.1, ribH * 0.48, x - 2.4, ribH);
      }
      ctx.stroke();
      ctx.fillStyle = "rgba(145,235,255,0.16)";
      ctx.beginPath(); ctx.ellipse(len * 0.16, -h * 0.02, len * 0.15, h * 0.18, -0.12, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // ヒゲは2本。
      ctx.strokeStyle = "rgba(185,248,255,0.50)";
      ctx.lineWidth = 0.52;
      ctx.beginPath();
      ctx.moveTo(len * 0.92, -h * 0.01);
      ctx.bezierCurveTo(len * 1.10, -h * 0.16, len * 1.28, -h * 0.24, len * 1.42, -h * 0.12);
      ctx.moveTo(len * 0.92, h * 0.06);
      ctx.bezierCurveTo(len * 1.12, h * 0.16, len * 1.30, h * 0.26, len * 1.44, h * 0.38);
      ctx.stroke();
      ctx.fillStyle = "rgba(225,252,255,0.90)";
      ctx.beginPath(); ctx.arc(len * 0.70, -h * 0.22, 1.0, 0, Math.PI * 2); ctx.fill();

    } else if (this.id === "african-lampeye") {
      // アフリカンランプアイ: メダカ系らしい体高を出し、尾柄だけを細く絞る。
      const len = this.size * 1.60;
      const h = this.size * 0.58;
      const tailWave = Math.sin(this.phase * 1.72 + 0.35) * h * 0.20;
      const finWave = Math.sin(this.phase * 1.18 + 1.10) * h * 0.085;
      const tailFill = isNaturalTheme ? "rgba(211,221,214,0.36)" : "rgba(90,183,212,0.10)";
      const tailEdge = isNaturalTheme ? "rgba(108,130,125,0.54)" : "rgba(105,190,220,0.46)";

      // 透明な尾びれ。胴体ではなく細い尾柄から開く。
      ctx.fillStyle = tailFill;
      ctx.strokeStyle = tailEdge;
      ctx.lineWidth = 0.70;
      ctx.beginPath();
      ctx.moveTo(-len * 0.79, -h * 0.12);
      ctx.quadraticCurveTo(-len * 0.98, -h * 0.33 + tailWave * 0.18, -len * 1.18, -h * 0.52 + tailWave);
      ctx.lineTo(-len * 1.06, tailWave * 0.22);
      ctx.lineTo(-len * 1.18, h * 0.52 + tailWave);
      ctx.quadraticCurveTo(-len * 0.98, h * 0.33 + tailWave * 0.18, -len * 0.79, h * 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 頭〜腹には厚みを持たせ、後半で尾柄へ絞る。
      const bodyGrad = ctx.createLinearGradient(0, -h, 0, h);
      if (isNaturalTheme) {
        bodyGrad.addColorStop(0.00, "rgba(118,132,123,0.76)");
        bodyGrad.addColorStop(0.34, "rgba(198,208,200,0.82)");
        bodyGrad.addColorStop(0.66, "rgba(232,237,231,0.72)");
        bodyGrad.addColorStop(1.00, "rgba(176,188,181,0.58)");
      } else {
        bodyGrad.addColorStop(0.00, "rgba(6,12,20,0.86)");
        bodyGrad.addColorStop(0.48, "rgba(25,58,72,0.52)");
        bodyGrad.addColorStop(1.00, "rgba(52,102,116,0.24)");
      }
      ctx.fillStyle = bodyGrad;
      ctx.strokeStyle = isNaturalTheme ? "rgba(107,123,118,0.72)" : "rgba(105,190,220,0.54)";
      ctx.lineWidth = 0.86;
      const lampeyeBody = new Path2D();
      lampeyeBody.moveTo(len * 0.98, -h * 0.02);
      lampeyeBody.quadraticCurveTo(len * 0.78, -h * 0.38, len * 0.40, -h * 0.47);
      lampeyeBody.quadraticCurveTo(-len * 0.10, -h * 0.52, -len * 0.54, -h * 0.32);
      lampeyeBody.quadraticCurveTo(-len * 0.70, -h * 0.23, -len * 0.80, -h * 0.10);
      lampeyeBody.lineTo(-len * 0.80, h * 0.10);
      lampeyeBody.quadraticCurveTo(-len * 0.67, h * 0.25, -len * 0.51, h * 0.31);
      lampeyeBody.quadraticCurveTo(-len * 0.05, h * 0.47, len * 0.40, h * 0.40);
      lampeyeBody.quadraticCurveTo(len * 0.78, h * 0.32, len * 0.98, h * 0.02);
      lampeyeBody.closePath();
      ctx.fill(lampeyeBody);
      ctx.stroke(lampeyeBody);

      // 側面の淡い青緑の光沢。
      ctx.save();
      ctx.clip(lampeyeBody);
      const sheen = ctx.createLinearGradient(len * 0.66, 0, -len * 0.62, 0);
      if (isNaturalTheme) {
        sheen.addColorStop(0.00, "rgba(110,205,197,0.05)");
        sheen.addColorStop(0.35, "rgba(86,190,187,0.20)");
        sheen.addColorStop(0.78, "rgba(109,196,184,0.12)");
        sheen.addColorStop(1.00, "rgba(109,196,184,0.02)");
      } else {
        sheen.addColorStop(0.00, "rgba(72,224,236,0.04)");
        sheen.addColorStop(0.45, "rgba(72,224,236,0.24)");
        sheen.addColorStop(1.00, "rgba(72,224,236,0.02)");
      }
      ctx.fillStyle = sheen;
      ctx.fillRect(-len * 0.72, -h * 0.09, len * 1.42, h * 0.24);

      // 鱗感は短い反射点だけ。線で刻まない。
      ctx.fillStyle = isNaturalTheme ? "rgba(245,249,240,0.20)" : "rgba(121,239,235,0.16)";
      for (let row = 0; row < 2; row++) {
        for (let i = 0; i < 5; i++) {
          const px = len * (0.34 - i * 0.18) + (row ? -len * 0.07 : 0);
          const py = h * (-0.08 + row * 0.18);
          ctx.beginPath();
          ctx.ellipse(px, py, 0.78, 0.34, -0.12, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // 背びれ・尻びれは小さすぎない三角形。透明膜は維持。
      ctx.fillStyle = isNaturalTheme ? "rgba(202,217,207,0.32)" : "rgba(105,190,220,0.10)";
      ctx.strokeStyle = tailEdge;
      ctx.lineWidth = 0.56;
      ctx.beginPath();
      ctx.moveTo(-len * 0.04, -h * 0.43);
      ctx.quadraticCurveTo(-len * 0.18, -h * 0.78 - finWave, -len * 0.36, -h * 0.39);
      ctx.lineTo(-len * 0.08, -h * 0.34);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-len * 0.04, h * 0.31);
      ctx.quadraticCurveTo(-len * 0.19, h * 0.62 + finWave, -len * 0.38, h * 0.30);
      ctx.lineTo(-len * 0.09, h * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(len * 0.27, h * 0.18);
      ctx.quadraticCurveTo(len * 0.06, h * 0.38 + finWave * 0.45, -len * 0.04, h * 0.22);
      ctx.stroke();

      const eyeX = len * 0.65, eyeY = -h * 0.14;
      if (isNaturalTheme) {
        ctx.fillStyle = "rgba(74,165,196,0.20)"; ctx.beginPath(); ctx.arc(eyeX, eyeY, 2.65, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(62,76,74,0.92)"; ctx.beginPath(); ctx.arc(eyeX, eyeY, 1.88, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#69bed8"; ctx.beginPath(); ctx.arc(eyeX, eyeY, 1.48, 0, Math.PI * 2); ctx.fill();
      } else {
        // CYBER lampeye: strongest species-specific emitter. Concentric additive
        // discs make real bloom without expensive shadowBlur.
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        // Keep the Lamp-eye bright, but remove the obvious outer halo ring.
        ctx.fillStyle = "rgba(120,241,255,0.24)"; ctx.beginPath(); ctx.arc(eyeX, eyeY, 2.9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(154,247,255,0.62)"; ctx.beginPath(); ctx.arc(eyeX, eyeY, 1.95, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.fillStyle = "rgba(3,7,12,0.98)"; ctx.beginPath(); ctx.arc(eyeX, eyeY, 1.88, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = "#d8ffff"; ctx.beginPath(); ctx.arc(eyeX, eyeY, 1.54, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = isNaturalTheme ? "#263c42" : "#071019"; ctx.beginPath(); ctx.arc(eyeX + 0.18, eyeY + 0.10, 0.54, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.94)"; ctx.beginPath(); ctx.arc(eyeX - 0.42, eyeY - 0.46, 0.26, 0, Math.PI * 2); ctx.fill();

    } else if (this.id === "rummynose-tetra") {
      const len = this.size * 1.92;
      const h = this.size * 0.59;
      const tailWave = Math.sin(this.phase * 1.78 + 0.62) * h * 0.20;

      // 透明な二叉尾をまず作り、その中へ模様を入れる。
      const tailPath = new Path2D();
      tailPath.moveTo(-len * 0.82, -h * 0.14);
      tailPath.quadraticCurveTo(-len * 0.98, -h * 0.34 + tailWave * 0.18, -len * 1.16, -h * 0.62 + tailWave);
      tailPath.lineTo(-len * 1.00, tailWave * 0.16);
      tailPath.lineTo(-len * 1.16, h * 0.62 + tailWave);
      tailPath.quadraticCurveTo(-len * 0.98, h * 0.34 + tailWave * 0.18, -len * 0.82, h * 0.14);
      tailPath.closePath();
      ctx.fillStyle = isNaturalTheme ? "rgba(244,246,242,0.62)" : "rgba(205,230,235,0.12)";
      ctx.strokeStyle = isNaturalTheme ? "rgba(142,154,150,0.68)" : "rgba(195,235,240,0.72)";
      ctx.lineWidth = 0.74;
      ctx.fill(tailPath);
      ctx.stroke(tailPath);
      ctx.save();
      ctx.clip(tailPath);
      const tailBase = -len * 0.98;
      const bands = [
        ["rgba(248,250,251,0.95)", -0.48, -0.18],
        ["rgba(18,20,24,0.95)", -0.26,  0.02],
        ["rgba(248,250,251,0.95)",  0.00,  0.24],
        ["rgba(18,20,24,0.95)",  0.24,  0.52],
      ];
      for (const [color, y0, y1] of bands) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(tailBase - 0.8, h * y0 + tailWave * 0.80);
        ctx.lineTo(tailBase + 2.8, h * (y0 - 0.06) + tailWave * 0.82);
        ctx.lineTo(tailBase + 9.2, h * (y1 - 0.10) + tailWave * 0.72);
        ctx.lineTo(tailBase + 6.4, h * (y1 + 0.02) + tailWave * 0.76);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      const bodyGrad = ctx.createLinearGradient(0, -h, 0, h);
      if (isNaturalTheme) {
        bodyGrad.addColorStop(0.00, "rgba(182,187,181,0.92)");
        bodyGrad.addColorStop(0.48, "rgba(241,242,234,0.96)");
        bodyGrad.addColorStop(1.00, "rgba(209,214,207,0.90)");
      } else {
        bodyGrad.addColorStop(0.00, "rgba(205,230,235,0.12)");
        bodyGrad.addColorStop(1.00, "rgba(205,230,235,0.06)");
      }
      ctx.fillStyle = bodyGrad;
      ctx.strokeStyle = isNaturalTheme ? "rgba(139,154,149,0.84)" : "rgba(195,235,240,0.72)";
      ctx.lineWidth = FISH_OUTLINE_WIDTH;
      ctx.beginPath();
      ctx.moveTo(len * 0.98, -h * 0.01);
      ctx.quadraticCurveTo(len * 0.34, -h * 0.82, -len * 0.50, -h * 0.36);
      ctx.quadraticCurveTo(-len * 0.74, -h * 0.24, -len * 0.84, -h * 0.06);
      ctx.lineTo(-len * 0.84, h * 0.06);
      ctx.quadraticCurveTo(-len * 0.74, h * 0.24, -len * 0.50, h * 0.36);
      ctx.quadraticCurveTo(len * 0.34, h * 0.82, len * 0.98, h * 0.01);
      ctx.closePath(); ctx.fill(); ctx.stroke();

      // 赤は頭の形に沿わせて、顔としてフィットさせる。
      const rummyHead = new Path2D();
      rummyHead.moveTo(len * 0.96, -h * 0.03);
      rummyHead.quadraticCurveTo(len * 0.88, -h * 0.38, len * 0.66, -h * 0.40);
      rummyHead.quadraticCurveTo(len * 0.49, -h * 0.30, len * 0.42, -h * 0.09);
      rummyHead.lineTo(len * 0.42, h * 0.09);
      rummyHead.quadraticCurveTo(len * 0.50, h * 0.32, len * 0.67, h * 0.40);
      rummyHead.quadraticCurveTo(len * 0.88, h * 0.36, len * 0.96, h * 0.03);
      rummyHead.closePath();
      ctx.fillStyle = "rgba(255,60,74,0.84)";
      ctx.fill(rummyHead);
      if (!isNaturalTheme) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "rgba(255,45,74,0.18)";
        ctx.lineWidth = 2.6;
        ctx.stroke(rummyHead);
        ctx.fillStyle = "rgba(255,44,72,0.42)";
        ctx.fill(rummyHead);
        ctx.fillStyle = "rgba(255,118,132,0.26)";
        ctx.fill(rummyHead);
        ctx.restore();
      }

      // Transparent dorsal / anal / pectoral / pelvic fins.
      const finFill = isNaturalTheme ? "rgba(244,247,244,0.30)" : "rgba(218,236,240,0.10)";
      const finStroke = isNaturalTheme ? "rgba(146,156,152,0.62)" : "rgba(194,233,240,0.44)";
      const rayStroke = isNaturalTheme ? "rgba(198,208,205,0.30)" : "rgba(214,246,250,0.18)";

      // Dorsal fin
      ctx.fillStyle = finFill; ctx.strokeStyle = finStroke; ctx.lineWidth = 0.62;
      ctx.beginPath();
      ctx.moveTo(-len * 0.08, -h * 0.42);
      ctx.quadraticCurveTo(-len * 0.16, -h * 0.98 - tailWave * 0.10, -len * 0.30, -h * 0.56);
      ctx.quadraticCurveTo(-len * 0.21, -h * 0.38, -len * 0.08, -h * 0.42);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = rayStroke; ctx.lineWidth = 0.36;
      ctx.beginPath();
      ctx.moveTo(-len * 0.10, -h * 0.43); ctx.lineTo(-len * 0.18, -h * 0.75);
      ctx.moveTo(-len * 0.16, -h * 0.46); ctx.lineTo(-len * 0.24, -h * 0.81);
      ctx.stroke();

      // Anal fin
      ctx.fillStyle = finFill; ctx.strokeStyle = finStroke; ctx.lineWidth = 0.62;
      ctx.beginPath();
      ctx.moveTo(-len * 0.08, h * 0.28);
      ctx.quadraticCurveTo(-len * 0.24, h * 0.82 + tailWave * 0.10, -len * 0.46, h * 0.44);
      ctx.quadraticCurveTo(-len * 0.28, h * 0.24, -len * 0.08, h * 0.28);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = rayStroke; ctx.lineWidth = 0.34;
      ctx.beginPath();
      ctx.moveTo(-len * 0.12, h * 0.30); ctx.lineTo(-len * 0.28, h * 0.58);
      ctx.moveTo(-len * 0.20, h * 0.31); ctx.lineTo(-len * 0.38, h * 0.55);
      ctx.stroke();

      // Pelvic fins
      ctx.fillStyle = isNaturalTheme ? "rgba(242,246,244,0.24)" : "rgba(218,236,240,0.08)";
      ctx.strokeStyle = finStroke; ctx.lineWidth = 0.48;
      ctx.beginPath();
      ctx.moveTo(len * 0.10, h * 0.18);
      ctx.quadraticCurveTo(len * 0.00, h * 0.46, -len * 0.10, h * 0.22);
      ctx.quadraticCurveTo(0, h * 0.14, len * 0.10, h * 0.18);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(len * 0.20, h * 0.15);
      ctx.quadraticCurveTo(len * 0.10, h * 0.42, 0, h * 0.18);
      ctx.quadraticCurveTo(len * 0.12, h * 0.11, len * 0.20, h * 0.15);
      ctx.closePath(); ctx.fill(); ctx.stroke();

      // Pectoral fin near operculum
      ctx.fillStyle = isNaturalTheme ? "rgba(242,246,244,0.22)" : "rgba(218,236,240,0.08)";
      ctx.strokeStyle = isNaturalTheme ? "rgba(150,160,156,0.52)" : "rgba(194,233,240,0.34)";
      ctx.lineWidth = 0.42;
      ctx.beginPath();
      ctx.moveTo(len * 0.44, h * 0.02);
      ctx.quadraticCurveTo(len * 0.26, h * 0.18 + tailWave * 0.03, len * 0.30, -h * 0.02);
      ctx.quadraticCurveTo(len * 0.38, -h * 0.06, len * 0.44, h * 0.02);
      ctx.closePath(); ctx.fill(); ctx.stroke();

      // soft lateral highlight
      ctx.fillStyle = isNaturalTheme ? "rgba(255,248,244,0.54)" : "rgba(255,255,255,0.14)";
      ctx.beginPath(); ctx.ellipse(len * 0.18, -h * 0.04, len * 0.34, h * 0.18, -0.08, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#0b1017";
      ctx.beginPath(); ctx.arc(len * 0.77, -h * 0.18, 0.95, 0, Math.PI * 2); ctx.fill();

    } else if (this.id === "guppy") {
      const len = this.size * 1.25;
      const h = this.size * 0.48;
      const tailHue = (this.variantHue + Math.sin(this.variantPhase) * 30 + 360) % 360;
      // グッピーは大きな尾膜がベタに近く「面」でしなる。ただしベタより速く軽い。
      const tailWave = Math.sin(this.phase * 0.72 + 0.18) * h * 0.24;
      const tailWave2 = Math.sin(this.phase * 0.53 + 1.42) * h * 0.36;
      const dorsalWave = Math.sin(this.phase * 0.78 + 0.92) * h * 0.16;
      ctx.fillStyle = isNaturalTheme ? "rgb(58,82,76)" : "rgba(8,16,20,0.76)";
      ctx.strokeStyle = isNaturalTheme ? "rgba(92,139,124,0.92)" : "rgba(100,255,220,0.78)";
      ctx.lineWidth = FISH_OUTLINE_WIDTH;
      ctx.beginPath();
      ctx.moveTo(len, 0);
      ctx.quadraticCurveTo(len * 0.18, -h, -len * 0.58, -h * 0.42);
      ctx.quadraticCurveTo(-len * 0.78, 0, -len * 0.58, h * 0.42);
      ctx.quadraticCurveTo(len * 0.18, h, len, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // 大きな扇形尾。外縁が跳ねすぎないよう、面と線を少し内側へ収める。
      ctx.fillStyle = `hsla(${tailHue}, ${isNaturalTheme ? 78 : 95}%, ${isNaturalTheme ? 54 : 62}%, ${isNaturalTheme ? 0.64 : 0.20})`;
      ctx.strokeStyle = `hsla(${tailHue}, ${isNaturalTheme ? 82 : 100}%, ${isNaturalTheme ? 48 : 66}%, ${isNaturalTheme ? 0.84 : 0.86})`;
      ctx.lineWidth = 0.84;
      ctx.beginPath();
      ctx.moveTo(-len * 0.55, -h * 0.08);
      ctx.bezierCurveTo(-len * 1.00, -h * 0.78 + tailWave * 0.12, -len * 1.36, -h * 1.34 + tailWave2 * 0.84, -len * 1.58, -h * 0.98 + tailWave * 0.72);
      ctx.quadraticCurveTo(-len * 1.44, -h * 0.30 + tailWave2 * 0.14, -len * 1.36, tailWave * 0.24);
      ctx.quadraticCurveTo(-len * 1.44, h * 0.30 + tailWave2 * 0.14, -len * 1.58, h * 0.98 + tailWave * 0.72);
      ctx.bezierCurveTo(-len * 1.36, h * 1.34 + tailWave2 * 0.84, -len * 1.00, h * 0.78 + tailWave * 0.12, -len * 0.55, h * 0.08);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // 鰭条も尾膜の内側に収める。
      ctx.strokeStyle = `hsla(${(tailHue + 110) % 360}, 100%, 72%, 0.62)`;
      ctx.lineWidth = 0.62;
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        const sy = (t - 0.5) * h * 0.16;
        const ey = (t - 0.5) * h * 1.84 + tailWave * (0.26 + 0.32 * Math.sin(t * Math.PI));
        const ex = -len * (1.34 + 0.16 * Math.sin(t * Math.PI));
        ctx.beginPath();
        ctx.moveTo(-len * 0.62, sy);
        ctx.quadraticCurveTo(-len * 1.00, ey * 0.54 + tailWave2 * 0.12, ex, ey);
        ctx.stroke();
      }
      // 背びれも尾と別位相で小さく揺らす。
      ctx.fillStyle = `hsla(${tailHue}, ${isNaturalTheme ? 76 : 95}%, ${isNaturalTheme ? 52 : 62}%, ${isNaturalTheme ? 0.52 : 0.16})`;
      ctx.strokeStyle = `hsla(${tailHue}, 90%, 62%, ${isNaturalTheme ? 0.72 : 0.62})`;
      ctx.lineWidth = 0.66;
      ctx.beginPath();
      ctx.moveTo(-len * 0.02, -h * 0.78);
      ctx.quadraticCurveTo(-len * 0.24, -h * 1.34 - dorsalWave, -len * 0.48, -h * 0.70);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = "rgba(220,255,245,0.92)";
      ctx.beginPath();
      ctx.arc(len * 0.62, -h * 0.24, 0.95, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.id === "molly") {
      // バルーンモーリー: 実在系統色を個体ごとに持たせ、短い胴と深い腹をさらに強調。
      let v = this.visualVariant || { id: "gold", body: "rgba(142,91,8,0.78)", body2: "rgba(245,178,28,0.48)", edge: "#ffd34d", fin: "rgba(255,211,77,0.18)", eye: "#fff5c4", spot: null };
      if (isNaturalTheme) {
        const naturalMolly = {
          "black":     { body:"#0a0d0d", body2:"#252d2c", edge:"#536764", fin:"rgba(38,48,46,0.82)", eye:"#e9eee7" },
          "platinum":  { body:"#c8cfca", body2:"#eef0e8", edge:"#9eaaa4", fin:"rgba(220,225,214,0.78)", eye:"#fafaf2" },
          "gold":      { body:"#a96d18", body2:"#e2ad3f", edge:"#c98e2d", fin:"rgba(222,169,65,0.78)", eye:"#fff0c7" },
          "orange":    { body:"#a94716", body2:"#e8752e", edge:"#c65c25", fin:"rgba(224,108,48,0.78)", eye:"#fff0dc" },
          "dalmatian": { body:"#d1d3c8", body2:"#f1f0e5", edge:"#a8ada5", fin:"rgba(224,225,214,0.78)", eye:"#ffffff", spot:"#151817" },
          "gold-dust": { body:"#171612", body2:"#a96b20", edge:"#bf812b", fin:"rgba(182,119,37,0.76)", eye:"#fff0c8", spot:"#d98522" }
        };
        v = { ...v, ...(naturalMolly[v.id] || naturalMolly.gold) };
      }
      const len = this.size * 0.94;
      const h = this.size * 1.02;
      const finWave = Math.sin(this.phase * 1.04) * h * 0.055;

      // 小さめで丸い扇形尾。
      ctx.fillStyle = v.fin;
      ctx.strokeStyle = v.edge;
      const mollyFinAlpha = isNaturalTheme ? 1.0 : 0.82;
      ctx.globalAlpha *= mollyFinAlpha;
      ctx.lineWidth = 1.05;
      ctx.beginPath();
      ctx.moveTo(-len * 0.78, -h * 0.15);
      ctx.quadraticCurveTo(-len * 1.20, -h * 0.58 + finWave, -len * 1.30, -h * 0.34 + finWave);
      ctx.lineTo(-len * 1.18, 0);
      ctx.lineTo(-len * 1.30, h * 0.34 + finWave);
      ctx.quadraticCurveTo(-len * 1.20, h * 0.58 + finWave, -len * 0.78, h * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha /= mollyFinAlpha;

      // バルーン体型。胴を短く、腹を大きく、頭は小さめに。
      const bodyGrad = ctx.createLinearGradient(-len, -h, len, h);
      bodyGrad.addColorStop(0, v.body);
      bodyGrad.addColorStop(0.58, v.body2);
      bodyGrad.addColorStop(1, v.body);
      ctx.fillStyle = bodyGrad;
      ctx.strokeStyle = v.edge;
      ctx.lineWidth = FISH_OUTLINE_WIDTH;
      ctx.beginPath();
      ctx.moveTo(len * 0.92, -h * 0.02);
      ctx.quadraticCurveTo(len * 0.58, -h * 0.62, -len * 0.06, -h * 0.82);
      ctx.quadraticCurveTo(-len * 0.62, -h * 0.78, -len * 0.82, -h * 0.25);
      ctx.quadraticCurveTo(-len * 0.88, h * 0.52, -len * 0.16, h * 0.98);
      ctx.quadraticCurveTo(len * 0.52, h * 0.92, len * 0.92, h * 0.08);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 系統ごとの模様。実物由来の特徴だけを記号化する。
      if (v.id === "dalmatian") {
        ctx.fillStyle = v.spot;
        const spots = [[-0.42,-0.34,0.13],[-0.18,0.22,0.10],[0.10,-0.48,0.09],[0.34,0.18,0.12],[-0.54,0.38,0.08]];
        for (const [sx, sy, sr] of spots) {
          ctx.beginPath(); ctx.arc(len*sx, h*sy, h*sr, 0, Math.PI*2); ctx.fill();
        }
      } else if (v.id === "gold-dust") {
        ctx.fillStyle = "rgba(255,157,32,0.56)";
        for (let i=0;i<6;i++) {
          const a = this.patternSeed + i*2.17;
          const sx = -0.45 + ((Math.sin(a)*0.5+0.5))*0.85;
          const sy = -0.52 + ((Math.cos(a*1.37)*0.5+0.5))*0.90;
          ctx.beginPath(); ctx.arc(len*sx, h*sy, 0.75 + (i%2)*0.35, 0, Math.PI*2); ctx.fill();
        }
      }

      // 小型の背びれ・胸びれ。
      ctx.fillStyle = v.fin;
      ctx.strokeStyle = v.edge;
      ctx.lineWidth = 0.88;
      ctx.beginPath();
      ctx.moveTo(len * 0.10, -h * 0.72);
      ctx.quadraticCurveTo(-len * 0.10, -h * 1.06, -len * 0.36, -h * 0.70);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(len * 0.30, h * 0.22);
      ctx.quadraticCurveTo(len * 0.02, h * 0.58 + finWave, -len * 0.12, h * 0.34);
      ctx.stroke();

      // 体側の細い回路ライン。色ではなく形を壊さない程度。
      ctx.strokeStyle = v.edge;
      ctx.globalAlpha *= 0.34;
      ctx.lineWidth = 0.72;
      ctx.beginPath();
      ctx.arc(-len * 0.05, h * 0.08, h * 0.43, -1.25, 1.18);
      ctx.stroke();
      ctx.globalAlpha /= 0.34;

      // 少し大きめの眼。
      ctx.fillStyle = v.eye;
      ctx.beginPath();
      ctx.arc(len * 0.60, -h * 0.22, 1.60, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#070b0d";
      ctx.beginPath();
      ctx.arc(len * 0.66, -h * 0.20, 0.70, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.90)";
      ctx.beginPath();
      ctx.arc(len * 0.89, -h * 0.02, 0.42, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.id === "angelfish") {
      // エンゼル: 派手さではなく、縦長の輪郭・長い鰭・静かな反射で格を出す。
      let v = this.visualVariant || {
        id: "wild-silver", pattern: "bars", body0: "rgba(18,24,28,0.96)", body1: "rgba(122,140,145,0.90)", body2: "rgba(224,231,226,0.84)",
        sheen: "rgba(220,250,246,0.42)", edge: "rgba(196,222,220,0.48)", fin: "rgba(150,179,181,0.075)", ray: "rgba(196,218,216,0.22)", mark: "rgba(5,8,10,0.82)", accent: null, iris: "#a96e35"
      };
      if (isNaturalTheme) {
        const naturalAngel = {
          "wild-silver": { body0:"rgba(92,99,96,0.99)", body1:"rgba(177,184,176,0.99)", body2:"rgba(235,236,222,0.99)", sheen:"rgba(255,255,239,0.64)", edge:"rgba(112,124,118,0.90)", fin:"rgba(189,197,185,0.62)", finTip:"rgba(182,190,179,0.30)", ray:"rgba(113,124,118,0.58)", mark:"rgba(18,20,19,0.90)" },
          "black-velvet":{ body0:"rgba(8,9,10,0.995)", body1:"rgba(28,31,32,0.99)", body2:"rgba(66,71,70,0.98)", sheen:"rgba(143,153,149,0.45)", edge:"rgba(83,92,89,0.88)", fin:"rgba(39,43,43,0.70)", finTip:"rgba(27,30,30,0.34)", ray:"rgba(102,111,108,0.58)" },
          "platinum":   { body0:"rgba(159,164,157,0.99)", body1:"rgba(225,228,217,0.99)", body2:"rgba(250,247,231,0.99)", sheen:"rgba(255,255,242,0.70)", edge:"rgba(170,179,171,0.90)", fin:"rgba(222,225,210,0.68)", finTip:"rgba(211,215,202,0.34)", ray:"rgba(157,166,159,0.56)" },
          "gold-koi":   { body0:"rgba(116,94,61,0.99)", body1:"rgba(211,183,121,0.99)", body2:"rgba(247,225,174,0.99)", sheen:"rgba(255,242,204,0.66)", edge:"rgba(177,149,100,0.90)", fin:"rgba(222,195,143,0.66)", finTip:"rgba(207,178,128,0.32)", ray:"rgba(153,127,87,0.56)", mark:"rgba(31,27,22,0.86)", accent:"rgba(190,76,32,0.90)" }
        };
        v = { ...v, ...(naturalAngel[v.id] || naturalAngel["wild-silver"]) };
      }
      const len = this.size * 1.10;
      const h = this.size * 1.04;
      const dorsalWave = Math.sin(this.phase * 0.22 + 0.35) * h * 0.045;
      const analWave = Math.sin(this.phase * 0.19 + 1.55) * h * 0.052;
      const tailWave = Math.sin(this.phase * 0.24 + 2.15) * h * 0.040;
      // 腹びれフィラメントは縦に伸縮させず、流れに遅れて横方向へしならせる。
      const filamentSwayA = Math.sin(this.phase * 0.34 + 0.90) * len * 0.18;
      const filamentSwayB = Math.sin(this.phase * 0.29 + 2.05) * len * 0.15;
      const filamentLiftA = Math.sin(this.phase * 0.23 + 0.35) * h * 0.055;
      const filamentLiftB = Math.sin(this.phase * 0.21 + 1.42) * h * 0.050;
      const filamentTrail = Math.min(len * 0.22, this.vel.mag() * len * 0.13);

      // 尾びれは体の後ろ。薄い膜と細い条だけにして、貼り付け感をなくす。
      const tailGrad = ctx.createLinearGradient(-len * 0.70, 0, -len * 1.24, 0);
      tailGrad.addColorStop(0, v.fin);
      tailGrad.addColorStop(1, isNaturalTheme ? (v.finTip || v.fin) : "rgba(0,0,0,0.01)");
      ctx.fillStyle = tailGrad;
      ctx.strokeStyle = v.edge;
      const angelTailAlpha = isNaturalTheme ? 1.0 : 0.72;
      ctx.globalAlpha *= angelTailAlpha;
      ctx.lineWidth = 0.58;
      ctx.beginPath();
      ctx.moveTo(-len * 0.70, -h * 0.22);
      ctx.bezierCurveTo(-len * 0.94, -h * 0.36, -len * 1.22, -h * 0.47 + tailWave, -len * 1.18, 0);
      ctx.bezierCurveTo(-len * 1.22, h * 0.47 + tailWave, -len * 0.94, h * 0.36, -len * 0.70, h * 0.22);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = v.ray;
      ctx.lineWidth = 0.42;
      for (const yy of [-0.18, -0.09, 0, 0.09, 0.18]) {
        ctx.beginPath(); ctx.moveTo(-len * 0.72, h * yy);
        ctx.quadraticCurveTo(-len * 0.98, h * yy * 1.30, -len * 1.15, h * yy * 1.65 + tailWave * 0.18); ctx.stroke();
      }
      ctx.globalAlpha /= angelTailAlpha;

      // 背びれ。細い付け根から高く立ち上げ、後ろへ流す。
      const dorsalGrad = ctx.createLinearGradient(0, -h * 0.40, 0, -h * 1.95);
      dorsalGrad.addColorStop(0, v.fin); dorsalGrad.addColorStop(1, isNaturalTheme ? (v.finTip || v.fin) : "rgba(0,0,0,0.015)");
      ctx.fillStyle = dorsalGrad; ctx.strokeStyle = v.edge;
      const angelDorsalAlpha = isNaturalTheme ? 1.0 : 0.76;
      ctx.globalAlpha *= angelDorsalAlpha; ctx.lineWidth = 0.62;
      ctx.beginPath();
      ctx.moveTo(len * 0.31, -h * 0.48);
      ctx.bezierCurveTo(len * 0.20, -h * 0.90, len * 0.02, -h * 1.72 - dorsalWave, -len * 0.12, -h * 1.92 - dorsalWave);
      ctx.bezierCurveTo(-len * 0.28, -h * 1.46, -len * 0.48, -h * 0.72, -len * 0.58, -h * 0.34);
      ctx.lineTo(-len * 0.42, -h * 0.18); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = v.ray; ctx.lineWidth = 0.43;
      for (let i = 0; i < 7; i++) {
        const t = i / 6, bx = len * (0.27 - 0.69 * t), by = -h * (0.48 - 0.16 * t);
        const tx = len * (0.11 - 0.29 * t), ty = -h * (0.98 + 0.88 * Math.sin(t * Math.PI * 0.82)) - dorsalWave * (0.25 + 0.45 * t);
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo((bx + tx) * 0.52, ty * 0.80, tx, ty); ctx.stroke();
      }
      ctx.globalAlpha /= angelDorsalAlpha;

      // 尻びれ。背びれよりわずかに遅れて垂れる。
      const analGrad = ctx.createLinearGradient(0, h * 0.40, 0, h * 1.88);
      analGrad.addColorStop(0, v.fin); analGrad.addColorStop(1, isNaturalTheme ? (v.finTip || v.fin) : "rgba(0,0,0,0.015)");
      ctx.fillStyle = analGrad; ctx.strokeStyle = v.edge;
      const angelAnalAlpha = isNaturalTheme ? 1.0 : 0.74;
      ctx.globalAlpha *= angelAnalAlpha; ctx.lineWidth = 0.62;
      ctx.beginPath();
      ctx.moveTo(len * 0.28, h * 0.47);
      ctx.bezierCurveTo(len * 0.16, h * 0.90, -len * 0.02, h * 1.66 + analWave, -len * 0.18, h * 1.86 + analWave);
      ctx.bezierCurveTo(-len * 0.34, h * 1.44, -len * 0.50, h * 0.72, -len * 0.60, h * 0.34);
      ctx.lineTo(-len * 0.43, h * 0.18); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = v.ray; ctx.lineWidth = 0.43;
      for (let i = 0; i < 7; i++) {
        const t = i / 6, bx = len * (0.25 - 0.70 * t), by = h * (0.47 - 0.16 * t);
        const tx = len * (0.08 - 0.31 * t), ty = h * (0.96 + 0.82 * Math.sin(t * Math.PI * 0.82)) + analWave * (0.25 + 0.45 * t);
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo((bx + tx) * 0.52, ty * 0.80, tx, ty); ctx.stroke();
      }
      ctx.globalAlpha /= angelAnalAlpha;

      // 本体。横幅を少し抑えた縦長ディスク。自発光は輪郭ではなく面の反射として出す。
      const bodyGrad = ctx.createRadialGradient(len * 0.22, -h * 0.20, h * 0.10, -len * 0.02, h * 0.02, h * 1.05);
      bodyGrad.addColorStop(0.00, v.body2); bodyGrad.addColorStop(0.28, v.body1); bodyGrad.addColorStop(0.70, v.body0); bodyGrad.addColorStop(1.00, isNaturalTheme ? v.body0 : "rgba(4,7,9,0.96)");
      ctx.fillStyle = bodyGrad; ctx.strokeStyle = v.edge; ctx.lineWidth = FISH_OUTLINE_WIDTH;
      const angelBodyPath = new Path2D();
      angelBodyPath.moveTo(len * 0.88, -h * 0.02);
      angelBodyPath.quadraticCurveTo(len * 0.53, -h * 0.56, len * 0.08, -h * 0.82);
      angelBodyPath.quadraticCurveTo(-len * 0.40, -h * 0.72, -len * 0.70, -h * 0.31);
      angelBodyPath.quadraticCurveTo(-len * 0.82, -h * 0.08, -len * 0.77, 0);
      angelBodyPath.quadraticCurveTo(-len * 0.82, h * 0.08, -len * 0.70, h * 0.31);
      angelBodyPath.quadraticCurveTo(-len * 0.40, h * 0.72, len * 0.08, h * 0.82);
      angelBodyPath.quadraticCurveTo(len * 0.53, h * 0.56, len * 0.88, h * 0.02);
      angelBodyPath.closePath();
      ctx.fill(angelBodyPath); ctx.stroke(angelBodyPath);

      // 模様は必ず胴体シルエット内へクリップする。ヒレや外周へはみ出させない。
      ctx.save();
      ctx.clip(angelBodyPath);
      if (v.pattern === "bars") {
        ctx.strokeStyle = v.mark; ctx.lineCap = "round";
        for (const [bx, lw, a] of [[-0.43, 3.2, 0.82], [-0.08, 2.6, 0.70], [0.31, 2.0, 0.58]]) {
          ctx.globalAlpha *= a; ctx.lineWidth = lw; ctx.beginPath();
          ctx.moveTo(len * bx, -h * (0.61 - Math.abs(bx) * 0.10));
          ctx.quadraticCurveTo(len * (bx - 0.03), 0, len * bx, h * (0.61 - Math.abs(bx) * 0.10)); ctx.stroke();
          ctx.globalAlpha /= a;
        }
      } else if (v.pattern === "koi") {
        ctx.fillStyle = v.accent; ctx.globalAlpha *= 0.82;
        ctx.beginPath(); ctx.ellipse(len * 0.45, -h * 0.30, len * 0.25, h * 0.20, -0.18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = v.mark; ctx.beginPath(); ctx.ellipse(-len * 0.28, h * 0.14, len * 0.15, h * 0.19, 0.24, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha /= 0.82;
      } else if (v.pattern === "velvet") {
        ctx.strokeStyle = v.sheen; ctx.globalAlpha *= 0.34; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.arc(len * 0.04, -h * 0.03, h * 0.49, -1.34, 0.96); ctx.stroke(); ctx.globalAlpha /= 0.34;
      }
      ctx.restore();

      // 体表の反射は一本だけ。
      ctx.strokeStyle = v.sheen; ctx.globalAlpha *= 0.62; ctx.lineWidth = 1.05;
      ctx.beginPath(); ctx.arc(len * 0.12, -h * 0.04, h * 0.47, -1.20, 0.74); ctx.stroke(); ctx.globalAlpha /= 0.62;

      // 長い腹びれ2本。根元は安定させ、中程から先端ほど水流に遅れてしなる。
      // 2本は別位相にして「針金が一緒に動く」印象を消す。
      ctx.strokeStyle = v.edge; ctx.globalAlpha *= 0.80; ctx.lineCap = "round"; ctx.lineWidth = 0.62;
      ctx.beginPath();
      ctx.moveTo(len * 0.24, h * 0.49);
      ctx.bezierCurveTo(
        len * 0.18 - filamentTrail * 0.10,
        h * 0.91,
        len * 0.02 - filamentTrail * 0.48 + filamentSwayA * 0.34,
        h * 1.53 + filamentLiftA * 0.30,
        -len * 0.07 - filamentTrail + filamentSwayA,
        h * 2.07 + filamentLiftA
      );
      ctx.moveTo(len * 0.08, h * 0.54);
      ctx.bezierCurveTo(
        len * 0.01 - filamentTrail * 0.08,
        h * 0.98,
        -len * 0.13 - filamentTrail * 0.43 + filamentSwayB * 0.32,
        h * 1.47 + filamentLiftB * 0.28,
        -len * 0.25 - filamentTrail * 0.88 + filamentSwayB,
        h * 1.94 + filamentLiftB
      );
      ctx.stroke(); ctx.globalAlpha /= 0.80;

      // 鰓蓋と眼は小さく、情報量を増やしすぎない。
      ctx.strokeStyle = v.edge; ctx.globalAlpha *= 0.32; ctx.lineWidth = 0.52;
      ctx.beginPath(); ctx.arc(len * 0.38, h * 0.02, h * 0.24, -1.22, 1.18); ctx.stroke(); ctx.globalAlpha /= 0.32;
      ctx.fillStyle = "rgba(232,221,197,0.76)"; ctx.beginPath(); ctx.arc(len * 0.53, -h * 0.13, 1.55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = v.iris; ctx.beginPath(); ctx.arc(len * 0.53, -h * 0.13, 1.05, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#050607"; ctx.beginPath(); ctx.arc(len * 0.57, -h * 0.12, 0.50, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.82)"; ctx.beginPath(); ctx.arc(len * 0.34, -h * 0.31, 0.22, 0, Math.PI * 2); ctx.fill();

    } else if (this.id === "discus") {
      const r = this.size;
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-r + 2, -r * 0.3);
      ctx.lineTo(-r - 6, -r * 0.5 - Math.sin(this.phase) * 2);
      ctx.lineTo(-r - 4, 0);
      ctx.lineTo(-r - 6, r * 0.5 + Math.sin(this.phase) * 2);
      ctx.lineTo(-r + 2, r * 0.3);
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = "rgba(0, 243, 255, 0.4)";
      ctx.lineWidth = 1;
      ctx.arc(0, 0, r * 0.7, -Math.PI * 0.6, Math.PI * 0.6);
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = "rgba(255, 170, 0, 0.6)";
      ctx.arc(-2, 0, r * 0.4, -Math.PI * 0.8, Math.PI * 0.8);
      ctx.stroke();

    } else if (this.id === "betta") {
      // BETTA — dedicated layered vector illustration.
      // No white sclera and no spoke-like fin lines: beauty comes from silhouette, membrane layers and color depth.
      let v = this.visualVariant || {
        id:"royal-blue", body0:"#061525", body1:"#0e5fa3", body2:"#39d9ff",
        fin0:"rgba(7,43,91,0.30)", fin1:"rgba(28,114,225,0.30)", fin2:"rgba(68,229,255,0.20)",
        ray:"rgba(122,236,255,0.60)", eye:"#071019"
      };
      const rgbaAlpha = (css, a) => {
        const m = css.match(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/);
        return m ? `rgba(${m[1]},${m[2]},${m[3]},${a})` : css;
      };
      const colorAlpha = (css, a) => {
        const rgba = css.match(/rgba?\(([^,]+),([^,]+),([^,\)]+)/);
        if (rgba) return `rgba(${rgba[1]},${rgba[2]},${rgba[3]},${a})`;
        const hex = css.match(/^#([0-9a-f]{6})$/i);
        if (hex) {
          const n = parseInt(hex[1], 16);
          return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
        }
        return css;
      };
      const cyberAccentMap = {
        "royal-blue":"#36f2ff",
        "mustard-gas":"#ffd84a",
        "solid-red":"#ff3348",
        "crimson":"#ff3b86",
        "black-orchid":"#9278ff",
        "koi":"#ff7a4d",
        "galaxy":"#66f4ff"
      };
      const cyberAccent = cyberAccentMap[v.id] || v.body2;
      const cyberPulse = 0.72 + 0.18 * Math.sin(this.phase * 0.34 + this.patternSeed * 0.01);
      const len = this.size * 1.58;
      const h = this.size * 0.68;
      const tailBaseX = -len * 0.55;
      const swimRatio = Math.max(0, Math.min(1, this.vel.mag() / Math.max(0.01, this.cruiseSpeed * this.depthSpeed)));

      // Root stays calm; free edges follow later, like thin wet fabric in water.
      const waveClock = this.phase * 0.245;
      const tailRoot = Math.sin(waveClock + 0.20) * h * 0.025;
      const tailMid  = Math.sin(waveClock - 0.62) * h * 0.105;
      const tailTip  = Math.sin(waveClock - 1.32) * h * 0.220;
      const dorsalRoot = Math.sin(this.phase * 0.225 + 0.60) * h * 0.020;
      const dorsalTip  = Math.sin(this.phase * 0.225 - 0.88) * h * 0.180;
      const analRoot = Math.sin(this.phase * 0.210 + 1.30) * h * 0.022;
      const analTip  = Math.sin(this.phase * 0.210 - 0.30) * h * 0.210;

      // ---------- CAUDAL / halfmoon veil ----------
      const tailOuterPts = [];
      const tailCount = 26;
      const tailSpread = 1.535 - swimRatio * 0.075;
      for (let i = 0; i < tailCount; i++) {
        const t = i / (tailCount - 1);
        const a = -tailSpread + t * tailSpread * 2;
        const free = Math.sin(t * Math.PI);
        const lag = tailRoot * (1 - free) + tailMid * (4 * t * (1 - t)) + tailTip * free;
        const travelling = Math.sin(waveClock - 1.15 + t * 2.55) * h * 0.075 * free;
        const frill = Math.sin(this.patternSeed * 0.013 + t * 15.0 + this.phase * 0.145) * h * 0.040 * (0.35 + free);
        const radial = 1.0 + 0.035 * Math.sin(this.patternSeed * 0.019 + t * 22.0);
        tailOuterPts.push({
          x: tailBaseX - len * 1.37 * Math.cos(a) * radial + Math.cos(waveClock - 0.8 + t * 2.2) * len * 0.010 * free,
          y: h * 1.68 * Math.sin(a) + lag + travelling + frill
        });
      }
      const tailPath = new Path2D();
      tailPath.moveTo(tailBaseX, -h * 0.27 + tailRoot);
      tailPath.bezierCurveTo(
        tailBaseX - len * 0.10, -h * 0.72 + tailMid * 0.35,
        tailOuterPts[0].x + len * 0.10, tailOuterPts[0].y,
        tailOuterPts[0].x, tailOuterPts[0].y
      );
      for (let i = 1; i < tailOuterPts.length; i++) {
        const p0 = tailOuterPts[i - 1], p1 = tailOuterPts[i];
        tailPath.quadraticCurveTo(p0.x, p0.y, (p0.x + p1.x) * 0.5, (p0.y + p1.y) * 0.5);
      }
      const tailLast = tailOuterPts[tailOuterPts.length - 1];
      tailPath.bezierCurveTo(
        tailLast.x + len * 0.08, tailLast.y,
        tailBaseX - len * 0.10, h * 0.72 + tailMid * 0.35,
        tailBaseX, h * 0.27 + tailRoot
      );
      tailPath.closePath();

      const tailMembrane = ctx.createRadialGradient(tailBaseX - len * 0.06, 0, this.size * 0.08, tailBaseX - len * 1.13, 0, len * 1.86);
      if (isNaturalTheme) {
        tailMembrane.addColorStop(0.00, rgbaAlpha(v.fin0, 0.94));
        tailMembrane.addColorStop(0.42, rgbaAlpha(v.fin1, 0.78));
        tailMembrane.addColorStop(0.78, rgbaAlpha(v.fin1, 0.52));
        tailMembrane.addColorStop(1.00, rgbaAlpha(v.fin2, 0.28));
      } else {
        tailMembrane.addColorStop(0.00, "rgba(2,6,12,0.52)");
        tailMembrane.addColorStop(0.34, colorAlpha(cyberAccent, 0.18));
        tailMembrane.addColorStop(0.74, colorAlpha(cyberAccent, 0.09));
        tailMembrane.addColorStop(1.00, colorAlpha(cyberAccent, 0.025));
      }
      ctx.fillStyle = tailMembrane;
      ctx.fill(tailPath);
      if (!isNaturalTheme) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = colorAlpha(cyberAccent, 0.16 * cyberPulse);
        ctx.lineWidth = 2.1;
        ctx.stroke(tailPath);
        ctx.fillStyle = colorAlpha(cyberAccent, 0.16 * cyberPulse);
        ctx.fill(tailPath);
        ctx.restore();
      }

      // Secondary translucent membrane layer gives depth without illustrative linework.
      ctx.save();
      ctx.clip(tailPath);
      const tailWash = ctx.createLinearGradient(tailBaseX - len * 0.15, -h * 1.70, tailBaseX - len * 1.25, h * 1.55);
      tailWash.addColorStop(0.00, "rgba(255,255,255,0.10)");
      tailWash.addColorStop(0.28, "rgba(255,255,255,0.02)");
      tailWash.addColorStop(0.58, rgbaAlpha(v.fin2, isNaturalTheme ? 0.12 : 0.08));
      tailWash.addColorStop(1.00, "rgba(0,0,0,0.07)");
      ctx.fillStyle = tailWash;
      ctx.fillRect(tailBaseX - len * 1.60, -h * 2.0, len * 2.2, h * 4.0);
      const tailBloom = ctx.createRadialGradient(tailBaseX - len * 0.50, -h * 0.42, this.size * 0.05, tailBaseX - len * 0.58, -h * 0.42, len * 0.88);
      tailBloom.addColorStop(0.00, rgbaAlpha(v.fin1, isNaturalTheme ? 0.18 : 0.15));
      tailBloom.addColorStop(1.00, "rgba(0,0,0,0)");
      ctx.fillStyle = tailBloom;
      ctx.fillRect(tailBaseX - len * 1.55, -h * 1.90, len * 2.0, h * 3.8);
      ctx.restore();
      if (isNaturalTheme) {
        ctx.strokeStyle = rgbaAlpha(v.fin1, 0.36);
        ctx.lineWidth = 0.48;
        ctx.stroke(tailPath);
      } else {
        ctx.strokeStyle = colorAlpha(cyberAccent, 0.18 * cyberPulse);
        ctx.lineWidth = 2.15;
        ctx.stroke(tailPath);
        ctx.strokeStyle = colorAlpha(cyberAccent, 0.92 * cyberPulse);
        ctx.lineWidth = 0.62;
        ctx.stroke(tailPath);
      }

      // ---------- DORSAL / tall swept fan ----------
      const dorsalPts = [];
      const dorsalCount = 15;
      for (let i = 0; i < dorsalCount; i++) {
        const t = i / (dorsalCount - 1);
        const x = len * (0.30 - t * 1.02);
        const rise = 0.47 + 1.30 * Math.sin(t * Math.PI * 0.92) + 0.12 * t;
        const lag = dorsalRoot * (1 - t) + dorsalTip * t;
        const travelling = Math.sin(this.phase * 0.225 - 0.95 + t * 2.65) * h * 0.070 * t;
        const frill = Math.sin(this.patternSeed * 0.009 + t * 11.4 + this.phase * 0.13) * h * 0.034 * t;
        dorsalPts.push({x, y: -h * rise + lag + travelling + frill});
      }
      const dorsalPath = new Path2D();
      dorsalPath.moveTo(len * 0.32, -h * 0.48 + dorsalRoot);
      for (let i = 0; i < dorsalPts.length; i++) {
        const p = dorsalPts[i];
        if (i === 0) dorsalPath.lineTo(p.x, p.y);
        else {
          const prev = dorsalPts[i - 1];
          dorsalPath.quadraticCurveTo(prev.x, prev.y, (prev.x + p.x) * 0.5, (prev.y + p.y) * 0.5);
        }
      }
      dorsalPath.lineTo(tailBaseX - len * 0.02, -h * 0.31 + dorsalRoot * 0.5);
      dorsalPath.bezierCurveTo(-len * 0.30, -h * 0.43, len * 0.04, -h * 0.50, len * 0.32, -h * 0.48 + dorsalRoot);
      dorsalPath.closePath();
      const dorsalMembrane = ctx.createLinearGradient(len * 0.20, -h * 0.40, -len * 0.38, -h * 1.92);
      if (isNaturalTheme) {
        dorsalMembrane.addColorStop(0.00, rgbaAlpha(v.fin0, 0.90));
        dorsalMembrane.addColorStop(0.52, rgbaAlpha(v.fin1, 0.70));
        dorsalMembrane.addColorStop(1.00, rgbaAlpha(v.fin2, 0.30));
      } else {
        dorsalMembrane.addColorStop(0.00, "rgba(2,6,12,0.48)");
        dorsalMembrane.addColorStop(0.52, colorAlpha(cyberAccent, 0.16));
        dorsalMembrane.addColorStop(1.00, colorAlpha(cyberAccent, 0.035));
      }
      ctx.fillStyle = dorsalMembrane;
      ctx.fill(dorsalPath);
      if (!isNaturalTheme) {
        ctx.save(); ctx.globalCompositeOperation="lighter";
        ctx.strokeStyle=colorAlpha(cyberAccent,0.15*cyberPulse); ctx.lineWidth=1.8; ctx.stroke(dorsalPath);
        ctx.fillStyle=colorAlpha(cyberAccent,0.15*cyberPulse); ctx.fill(dorsalPath);
        ctx.restore();
      }
      ctx.save(); ctx.clip(dorsalPath);
      const dorsalWash = ctx.createRadialGradient(-len * 0.05, -h * 0.70, this.size * 0.02, -len * 0.20, -h * 1.20, len * 0.90);
      dorsalWash.addColorStop(0.00, "rgba(255,255,255,0.09)");
      dorsalWash.addColorStop(1.00, "rgba(255,255,255,0)");
      ctx.fillStyle = dorsalWash;
      ctx.fillRect(-len * 0.85, -h * 2.1, len * 1.4, h * 1.9);
      ctx.restore();
      if (isNaturalTheme) {
        ctx.strokeStyle = rgbaAlpha(v.fin1, 0.32);
        ctx.lineWidth = 0.46;
        ctx.stroke(dorsalPath);
      } else {
        ctx.strokeStyle = colorAlpha(cyberAccent, 0.16 * cyberPulse);
        ctx.lineWidth = 1.80;
        ctx.stroke(dorsalPath);
        ctx.strokeStyle = colorAlpha(cyberAccent, 0.82 * cyberPulse);
        ctx.lineWidth = 0.54;
        ctx.stroke(dorsalPath);
      }

      // ---------- ANAL / long heavy curtain ----------
      const analPts = [];
      const analCount = 16;
      for (let i = 0; i < analCount; i++) {
        const t = i / (analCount - 1);
        const x = len * (0.49 - t * 1.18);
        const drop = 0.34 + 1.46 * Math.sin(t * Math.PI * 0.92) + 0.22 * t;
        const lag = analRoot * (1 - t) + analTip * t;
        const travelling = Math.sin(this.phase * 0.210 - 0.48 + t * 2.55) * h * 0.078 * t;
        const frill = Math.sin(this.patternSeed * 0.011 + t * 12.0 + this.phase * 0.14) * h * 0.038 * t;
        analPts.push({x, y: h * drop + lag + travelling + frill});
      }
      const analPath = new Path2D();
      analPath.moveTo(len * 0.50, h * 0.33 + analRoot);
      for (let i = 0; i < analPts.length; i++) {
        const p = analPts[i];
        if (i === 0) analPath.lineTo(p.x, p.y);
        else {
          const prev = analPts[i - 1];
          analPath.quadraticCurveTo(prev.x, prev.y, (prev.x + p.x) * 0.5, (prev.y + p.y) * 0.5);
        }
      }
      analPath.lineTo(tailBaseX - len * 0.02, h * 0.32 + analRoot * 0.5);
      analPath.bezierCurveTo(-len * 0.28, h * 0.44, len * 0.15, h * 0.44, len * 0.50, h * 0.33 + analRoot);
      analPath.closePath();
      const analMembrane = ctx.createLinearGradient(len * 0.32, h * 0.30, -len * 0.28, h * 2.08);
      if (isNaturalTheme) {
        analMembrane.addColorStop(0.00, rgbaAlpha(v.fin0, 0.92));
        analMembrane.addColorStop(0.52, rgbaAlpha(v.fin1, 0.74));
        analMembrane.addColorStop(1.00, rgbaAlpha(v.fin2, 0.34));
      } else {
        analMembrane.addColorStop(0.00, "rgba(2,6,12,0.50)");
        analMembrane.addColorStop(0.52, colorAlpha(cyberAccent, 0.17));
        analMembrane.addColorStop(1.00, colorAlpha(cyberAccent, 0.040));
      }
      ctx.fillStyle = analMembrane;
      ctx.fill(analPath);
      if (!isNaturalTheme) {
        ctx.save(); ctx.globalCompositeOperation="lighter";
        ctx.strokeStyle=colorAlpha(cyberAccent,0.16*cyberPulse); ctx.lineWidth=1.9; ctx.stroke(analPath);
        ctx.fillStyle=colorAlpha(cyberAccent,0.16*cyberPulse); ctx.fill(analPath);
        ctx.restore();
      }
      ctx.save(); ctx.clip(analPath);
      const analWash = ctx.createLinearGradient(len * 0.20, h * 0.48, -len * 0.45, h * 1.92);
      analWash.addColorStop(0.00, "rgba(255,255,255,0.07)");
      analWash.addColorStop(0.50, "rgba(255,255,255,0.01)");
      analWash.addColorStop(1.00, "rgba(0,0,0,0.08)");
      ctx.fillStyle = analWash;
      ctx.fillRect(-len * 0.85, h * 0.24, len * 1.5, h * 2.0);
      ctx.restore();
      if (isNaturalTheme) {
        ctx.strokeStyle = rgbaAlpha(v.fin1, 0.34);
        ctx.lineWidth = 0.48;
        ctx.stroke(analPath);
      } else {
        ctx.strokeStyle = colorAlpha(cyberAccent, 0.17 * cyberPulse);
        ctx.lineWidth = 1.90;
        ctx.stroke(analPath);
        ctx.strokeStyle = colorAlpha(cyberAccent, 0.86 * cyberPulse);
        ctx.lineWidth = 0.56;
        ctx.stroke(analPath);
      }

      // ---------- BODY / compact muscular core ----------
      const bodyGrad = ctx.createLinearGradient(len * 0.90, -h * 0.35, -len * 0.58, h * 0.38);
      if (isNaturalTheme) {
        bodyGrad.addColorStop(0.00, v.body2);
        bodyGrad.addColorStop(0.34, v.body1);
        bodyGrad.addColorStop(0.78, v.body0);
        bodyGrad.addColorStop(1.00, v.body0);
      } else {
        bodyGrad.addColorStop(0.00, colorAlpha(cyberAccent, 0.38));
        bodyGrad.addColorStop(0.22, "rgba(4,11,18,0.96)");
        bodyGrad.addColorStop(0.70, "rgba(2,6,12,0.92)");
        bodyGrad.addColorStop(1.00, colorAlpha(cyberAccent, 0.12));
      }
      ctx.fillStyle = bodyGrad;
      ctx.strokeStyle = isNaturalTheme ? rgbaAlpha(v.fin1, 0.34) : colorAlpha(cyberAccent, 0.92 * cyberPulse);
      ctx.lineWidth = FISH_OUTLINE_WIDTH;
      const bodyPath = new Path2D();
      bodyPath.moveTo(len * 0.92, -h * 0.04);
      bodyPath.bezierCurveTo(len * 0.88, -h * 0.32, len * 0.66, -h * 0.54, len * 0.31, -h * 0.62);
      bodyPath.bezierCurveTo(-len * 0.08, -h * 0.70, -len * 0.38, -h * 0.52, tailBaseX, -h * 0.20);
      bodyPath.lineTo(tailBaseX, h * 0.20);
      bodyPath.bezierCurveTo(-len * 0.39, h * 0.53, -len * 0.02, h * 0.64, len * 0.31, h * 0.59);
      bodyPath.bezierCurveTo(len * 0.65, h * 0.52, len * 0.87, h * 0.29, len * 0.93, h * 0.07);
      bodyPath.quadraticCurveTo(len * 0.96, 0, len * 0.92, -h * 0.04);
      bodyPath.closePath();
      ctx.fill(bodyPath); ctx.stroke(bodyPath);
      if (!isNaturalTheme) {
        ctx.strokeStyle = colorAlpha(cyberAccent, 0.16 * cyberPulse);
        ctx.lineWidth = 2.25;
        ctx.stroke(bodyPath);
        ctx.strokeStyle = colorAlpha(cyberAccent, 0.94 * cyberPulse);
        ctx.lineWidth = 0.62;
        ctx.stroke(bodyPath);
        ctx.save();
        ctx.clip(bodyPath);
        const cellAlpha = 0.20 + 0.10 * Math.sin(this.phase * 0.42 + this.patternSeed * 0.02);
        ctx.fillStyle = colorAlpha(cyberAccent, cellAlpha);
        const cells = [[0.42,-0.24,0.10,0.08],[0.18,0.12,0.12,0.07],[-0.08,-0.18,0.09,0.07],[-0.31,0.15,0.11,0.06]];
        for (const [cx,cy,cw,ch] of cells) ctx.fillRect(len * cx, h * cy, len * cw, h * ch);
        const coreGlow = ctx.createLinearGradient(len * 0.55, 0, -len * 0.42, 0);
        coreGlow.addColorStop(0.00, colorAlpha(cyberAccent, 0.08));
        coreGlow.addColorStop(0.50, colorAlpha(cyberAccent, 0.22));
        coreGlow.addColorStop(1.00, "rgba(0,0,0,0)");
        ctx.fillStyle = coreGlow;
        ctx.fillRect(-len * 0.48, -h * 0.16, len * 1.08, h * 0.32);
        ctx.restore();
      }

      // Body colour markings stay on the body only.
      ctx.save(); ctx.clip(bodyPath);
      if (v.id === "koi") {
        ctx.fillStyle = "rgba(255,86,52,0.68)";
        ctx.beginPath(); ctx.ellipse(len * 0.28, -h * 0.15, len * 0.22, h * 0.22, -0.24, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(32,92,128,0.42)";
        ctx.beginPath(); ctx.ellipse(-len * 0.23, h * 0.10, len * 0.17, h * 0.18, 0.28, 0, Math.PI * 2); ctx.fill();
      } else if (v.id === "galaxy") {
        ctx.fillStyle = "rgba(178,246,255,0.48)";
        for (let i = 0; i < 8; i++) {
          const px = len * (0.43 - i * 0.105);
          const py = h * Math.sin(this.patternSeed + i * 1.72) * 0.28;
          ctx.beginPath(); ctx.arc(px, py, 0.38 + (i % 2) * 0.10, 0, Math.PI * 2); ctx.fill();
        }
      }
      if (isNaturalTheme) {
        const bodySheen = ctx.createRadialGradient(len * 0.26, -h * 0.22, this.size * 0.03, len * 0.02, -h * 0.10, len * 0.90);
        bodySheen.addColorStop(0.00, "rgba(255,255,255,0.20)");
        bodySheen.addColorStop(0.36, "rgba(255,255,255,0.05)");
        bodySheen.addColorStop(1.00, "rgba(255,255,255,0)");
        ctx.fillStyle = bodySheen;
        ctx.fillRect(-len * 0.72, -h * 0.80, len * 1.75, h * 1.60);
      }
      ctx.restore();

      // Soft gill boundary only; no decorative white facial marks.
      ctx.strokeStyle = isNaturalTheme ? "rgba(255,255,255,0.13)" : colorAlpha(cyberAccent, 0.34 * cyberPulse);
      ctx.lineWidth = isNaturalTheme ? 0.38 : 0.52;
      ctx.beginPath(); ctx.arc(len * 0.39, -h * 0.01, h * 0.36, -1.17, 0.95); ctx.stroke();

      // Pelvic fins are narrow ribbons, not wires: draw translucent tapered membranes.
      const pelvicLagA = Math.sin(this.phase * 0.205 + 0.45) * h * 0.18;
      const pelvicLagB = Math.sin(this.phase * 0.190 + 1.55) * h * 0.20;
      const pelvicAPath = new Path2D();
      pelvicAPath.moveTo(len * 0.47, h * 0.31);
      pelvicAPath.bezierCurveTo(len * 0.40, h * 0.65, len * 0.25, h * 1.08, len * 0.03 + pelvicLagA, h * 1.54);
      pelvicAPath.bezierCurveTo(len * 0.08 + pelvicLagA, h * 1.40, len * 0.27, h * 0.85, len * 0.50, h * 0.34);
      pelvicAPath.closePath();
      const pelvicBPath = new Path2D();
      pelvicBPath.moveTo(len * 0.34, h * 0.35);
      pelvicBPath.bezierCurveTo(len * 0.28, h * 0.70, len * 0.12, h * 1.02, -len * 0.13 + pelvicLagB, h * 1.43);
      pelvicBPath.bezierCurveTo(-len * 0.07 + pelvicLagB, h * 1.31, len * 0.12, h * 0.82, len * 0.37, h * 0.38);
      pelvicBPath.closePath();
      ctx.fillStyle = isNaturalTheme ? rgbaAlpha(v.fin1, 0.62) : colorAlpha(cyberAccent, 0.46 * cyberPulse);
      ctx.fill(pelvicAPath); ctx.fill(pelvicBPath);

      // Pectoral fin: tiny transparent paddle moving quickly near the gill.
      const pectoral = Math.sin(this.phase * 2.65) * h * 0.17;
      ctx.fillStyle = isNaturalTheme ? "rgba(236,244,241,0.18)" : colorAlpha(cyberAccent, 0.26 * cyberPulse);
      ctx.beginPath();
      ctx.moveTo(len * 0.43, h * 0.04);
      ctx.bezierCurveTo(len * 0.29, h * 0.14 + pectoral, len * 0.13, h * 0.38 + pectoral * 0.40, len * 0.10, h * 0.48 + pectoral * 0.22);
      ctx.bezierCurveTo(len * 0.26, h * 0.33, len * 0.41, h * 0.20, len * 0.43, h * 0.04);
      ctx.closePath(); ctx.fill();

      // Betta eye: dark eye set directly in the head, with only a tiny reflected point — no white sclera.
      ctx.fillStyle = "#05070a";
      ctx.beginPath(); ctx.arc(len * 0.69, -h * 0.20, 1.20, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = isNaturalTheme ? "rgba(120,165,170,0.55)" : colorAlpha(cyberAccent, 0.92 * cyberPulse);
      ctx.beginPath(); ctx.arc(len * 0.74, -h * 0.25, 0.28, 0, Math.PI * 2); ctx.fill();

    } else if (this.id === "corydoras") {
      // パンダコリ: ずんぐりした装甲ナマズ体型、下向きの吻、眼帯・背部・尾柄の黒斑を明確にする。
      const len = this.size * 1.55;
      const h = this.size * 0.68;
      const whisk = Math.sin(this.phase * 1.9) * 1.05;
      const tailWave = Math.sin(this.phase * 1.42 + 0.45) * h * 0.18;
      const dorsalWave = Math.sin(this.phase * 0.88 + 1.20) * len * 0.050;
      const baseFill = isNaturalTheme ? "rgba(238,235,214,0.98)" : "rgba(202,232,226,0.26)";
      const baseEdge = isNaturalTheme ? "rgba(111,117,111,0.92)" : "rgba(216,247,255,0.88)";
      const patch = isNaturalTheme ? "rgba(28,31,29,0.95)" : "rgba(3,7,10,0.90)";

      // 透明感のある尾。尾柄の黒斑とは分ける。
      ctx.fillStyle = isNaturalTheme ? "rgba(225,226,207,0.66)" : "rgba(216,247,255,0.08)"; ctx.strokeStyle = baseEdge; ctx.lineWidth = 0.82;
      ctx.beginPath();
      ctx.moveTo(-len * 0.76, -h * 0.22);
      ctx.quadraticCurveTo(-len * 0.98, -h * 0.44 + tailWave*0.20, -len * 1.17, -h * 0.62 + tailWave);
      ctx.lineTo(-len * 1.07, tailWave*0.30);
      ctx.lineTo(-len * 1.17, h * 0.62 + tailWave);
      ctx.quadraticCurveTo(-len * 0.98, h * 0.44 + tailWave*0.20, -len * 0.76, h * 0.22);
      ctx.closePath(); ctx.fill(); ctx.stroke();

      // 背びれと胸びれは胴体の後ろへ。
      ctx.fillStyle = isNaturalTheme ? "rgba(211,214,198,0.78)" : "rgba(216,247,255,0.10)"; ctx.strokeStyle = baseEdge; ctx.lineWidth = 0.76;
      ctx.beginPath(); ctx.moveTo(len*0.12,-h*0.55); ctx.quadraticCurveTo(-len*0.01,-h*1.00,-len*0.12+dorsalWave,-h*1.40); ctx.lineTo(-len*0.38,-h*0.57); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(len*0.34,h*0.30); ctx.quadraticCurveTo(len*0.05,h*0.86,-len*0.27,h*0.72); ctx.quadraticCurveTo(-len*0.05,h*0.43,len*0.34,h*0.30); ctx.fill(); ctx.stroke();

      // 胴体パス。頭は丸く厚く、尾柄へ向かって絞る。腹面は底床に沿う。
      const coryBody = new Path2D();
      coryBody.moveTo(len * 0.98, h * 0.02);
      coryBody.quadraticCurveTo(len * 0.84, -h * 0.52, len * 0.38, -h * 0.70);
      coryBody.quadraticCurveTo(-len * 0.20, -h * 0.88, -len * 0.68, -h * 0.44);
      coryBody.quadraticCurveTo(-len * 0.83, -h * 0.28, -len * 0.80, h * 0.12);
      coryBody.quadraticCurveTo(-len * 0.45, h * 0.52, len * 0.18, h * 0.58);
      coryBody.quadraticCurveTo(len * 0.66, h * 0.56, len * 0.92, h * 0.27);
      coryBody.quadraticCurveTo(len * 1.04, h * 0.14, len * 0.98, h * 0.02); coryBody.closePath();
      const coryGrad = ctx.createLinearGradient(0,-h,0,h); coryGrad.addColorStop(0,isNaturalTheme?"rgba(218,216,196,0.98)":"rgba(177,215,210,0.22)"); coryGrad.addColorStop(0.55,baseFill); coryGrad.addColorStop(1,isNaturalTheme?"rgba(245,239,216,0.98)":"rgba(222,244,238,0.24)");
      ctx.fillStyle=coryGrad; ctx.strokeStyle=baseEdge; ctx.lineWidth=FISH_OUTLINE_WIDTH; ctx.fill(coryBody); ctx.stroke(coryBody);
      if (!isNaturalTheme) {
        // Panda white ground becomes the luminous material; black patches are drawn
        // afterwards and therefore stay dark instead of glowing as a whole fish.
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "rgba(218,252,255,0.16)";
        ctx.lineWidth = 2.1;
        ctx.stroke(coryBody);
        ctx.fillStyle = "rgba(218,252,255,0.20)";
        ctx.fill(coryBody);
        ctx.restore();
      }

      // 模様は胴体にクリップして、楕円が輪郭から飛び出す安っぽさを避ける。
      ctx.save(); ctx.clip(coryBody); ctx.fillStyle=patch;
      // 眼帯は丸い黒点ではなく、頭部を斜めに横切る不整形の帯。
      ctx.beginPath();
      ctx.moveTo(len*0.47,-h*0.46);
      ctx.quadraticCurveTo(len*0.66,-h*0.52,len*0.78,-h*0.30);
      ctx.quadraticCurveTo(len*0.84,-h*0.05,len*0.73,h*0.20);
      ctx.quadraticCurveTo(len*0.58,h*0.30,len*0.48,h*0.08);
      ctx.quadraticCurveTo(len*0.43,-h*0.18,len*0.47,-h*0.46);
      ctx.closePath(); ctx.fill();
      // 背びれ基部の黒斑。
      ctx.beginPath(); ctx.ellipse(-len*0.02,-h*0.52,len*0.23,h*0.25,-0.08,0,Math.PI*2); ctx.fill();
      // 尾柄斑。
      ctx.beginPath(); ctx.ellipse(-len*0.67,-h*0.02,len*0.16,h*0.43,0.02,0,Math.PI*2); ctx.fill();
      // 装甲板はシワに見えない程度の短い段差だけ。
      ctx.strokeStyle=isNaturalTheme?"rgba(118,125,117,0.16)":"rgba(202,240,235,0.12)"; ctx.lineWidth=0.38;
      for (let i=0;i<3;i++) {
        const x=len*(0.26-i*0.22);
        ctx.beginPath(); ctx.moveTo(x,-h*0.10); ctx.quadraticCurveTo(x-len*0.05,h*0.02,x-len*0.02,h*0.18); ctx.stroke();
      }
      ctx.restore();

      // 背びれ内の黒色は基部から上へ自然に続ける。
      ctx.fillStyle=patch; ctx.globalAlpha*=0.88; ctx.beginPath(); ctx.moveTo(len*0.07,-h*0.62); ctx.quadraticCurveTo(-len*0.03,-h*0.93,-len*0.10+dorsalWave*0.72,-h*1.28); ctx.lineTo(-len*0.22,-h*0.62); ctx.closePath(); ctx.fill(); ctx.globalAlpha/=0.88;

      // 眼帯の中に小さい実眼を置く。
      ctx.fillStyle=isNaturalTheme?"rgba(173,142,88,0.92)":"rgba(215,248,255,0.86)"; ctx.beginPath(); ctx.arc(len*0.69,-h*0.23,1.04,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#0a0d0c"; ctx.beginPath(); ctx.arc(len*0.72,-h*0.23,0.58,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="rgba(255,255,244,0.90)"; ctx.beginPath(); ctx.arc(len*0.67,-h*0.31,0.20,0,Math.PI*2); ctx.fill();

      // 下向きの口と3対の短いヒゲ。根元を一点に集めず吻の下側から広げる。
      ctx.strokeStyle=isNaturalTheme?"rgba(92,86,70,0.80)":"rgba(216,247,255,0.70)"; ctx.lineWidth=0.64; ctx.lineCap="round";
      ctx.beginPath();
      ctx.moveTo(len*0.91,h*0.20); ctx.quadraticCurveTo(len*1.13,h*0.30,len*1.27,h*0.38+whisk);
      ctx.moveTo(len*0.89,h*0.25); ctx.quadraticCurveTo(len*1.08,h*0.45,len*1.20,h*0.57-whisk*0.45);
      ctx.moveTo(len*0.84,h*0.29); ctx.quadraticCurveTo(len*0.98,h*0.58,len*1.04,h*0.70+whisk*0.32);
      ctx.stroke();
      ctx.strokeStyle=isNaturalTheme?"rgba(89,82,68,0.54)":"rgba(216,247,255,0.40)"; ctx.beginPath(); ctx.arc(len*0.89,h*0.27,1.7,0.18,2.05); ctx.stroke();

    } else if (this.id === "shrimp") {
      // レッドビーシュリンプ。NATURALは実在種の赤白、CYBERは同じ節構造を暗い半透明甲殻＋発光バンドへ変換する。
      const len = this.size * 1.12;
      const h = this.size * 0.61;
      const pick = Math.sin(this.phase * 4.5);

      if (isNaturalTheme) {
        const shellRed = "rgba(206,43,48,0.96)";
        const shellRed2 = "rgba(236,67,67,0.94)";
        const shellWhite = "rgba(245,239,226,0.96)";
        const shellEdge = "rgba(116,65,59,0.68)";
        const limb = "rgba(163,104,94,0.46)";

        ctx.fillStyle=shellWhite; ctx.strokeStyle=shellEdge; ctx.lineWidth=0.62;
        const tailX=-len*0.76;
        for (let i=-1;i<=1;i++) {
          ctx.beginPath(); ctx.moveTo(tailX,-h*0.06+i*h*0.04);
          ctx.quadraticCurveTo(-len*1.03,-h*(0.18-i*0.16),-len*1.18,-h*(0.12-i*0.28));
          ctx.quadraticCurveTo(-len*1.06,h*(0.02+i*0.13),tailX,h*0.10+i*h*0.03); ctx.closePath(); ctx.fill(); ctx.stroke();
        }

        const segColors=[shellWhite,shellRed2,shellWhite,shellRed,shellWhite,shellRed];
        for (let i=5;i>=0;i--) {
          const t=i/5;
          const x=-len*0.58 + i*len*0.20;
          const y=h*(0.08 + 0.10*Math.sin((1-t)*Math.PI));
          const rx=len*(0.17 - i*0.008);
          const ry=h*(0.48 - i*0.025);
          ctx.fillStyle=segColors[i]; ctx.strokeStyle=shellEdge; ctx.lineWidth=0.55;
          ctx.beginPath(); ctx.ellipse(x,y,rx,ry,-0.05+0.04*i,0,Math.PI*2); ctx.fill(); ctx.stroke();
          ctx.strokeStyle="rgba(255,255,245,0.22)"; ctx.beginPath(); ctx.arc(x-rx*0.10,y-ry*0.08,ry*0.72,-2.1,-0.55); ctx.stroke();
        }

        const headGrad=ctx.createLinearGradient(len*0.20,-h*0.52,len*0.88,h*0.35); headGrad.addColorStop(0,shellRed2); headGrad.addColorStop(1,shellRed);
        ctx.fillStyle=headGrad; ctx.strokeStyle=shellEdge; ctx.lineWidth=0.72;
        ctx.beginPath(); ctx.moveTo(len*0.86,-h*0.10);
        ctx.lineTo(len*1.08,-h*0.20); ctx.lineTo(len*0.91,-h*0.02);
        ctx.quadraticCurveTo(len*0.84,h*0.46,len*0.38,h*0.50);
        ctx.quadraticCurveTo(len*0.14,h*0.08,len*0.28,-h*0.48);
        ctx.quadraticCurveTo(len*0.62,-h*0.58,len*0.86,-h*0.10); ctx.closePath(); ctx.fill(); ctx.stroke();

        ctx.strokeStyle=shellWhite; ctx.lineWidth=h*0.30; ctx.lineCap="round"; ctx.beginPath(); ctx.moveTo(len*0.43,-h*0.31); ctx.lineTo(len*0.38,h*0.28); ctx.stroke();

        ctx.fillStyle="#13080a"; ctx.beginPath(); ctx.arc(len*0.75,-h*0.28,1.12,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="rgba(255,255,255,0.92)"; ctx.beginPath(); ctx.arc(len*0.80,-h*0.33,0.34,0,Math.PI*2); ctx.fill();

        ctx.strokeStyle="rgba(157,115,103,0.66)"; ctx.lineWidth=0.52; ctx.lineCap="round";
        ctx.beginPath(); ctx.moveTo(len*0.86,-h*0.12); ctx.bezierCurveTo(len*1.12,-h*0.55,len*1.43,-h*0.52,len*1.62,-h*0.20);
        ctx.moveTo(len*0.88,-h*0.02); ctx.bezierCurveTo(len*1.18,-h*0.12,len*1.40,h*0.02,len*1.55,h*0.24); ctx.stroke();

        ctx.strokeStyle=limb; ctx.lineWidth=0.48;
        for (let i=0;i<3;i++) {
          const bx=len*(0.34-i*0.18); const kick=(i===0&&this.shrimpState==="graze")?pick*1.0:0;
          ctx.beginPath(); ctx.moveTo(bx,h*0.32); ctx.quadraticCurveTo(bx-len*0.04,h*0.60,bx-len*0.14+kick,h*0.78); ctx.stroke();
        }

        if (this.shrimpState === "graze") {
          ctx.strokeStyle="rgba(177,115,104,0.72)"; ctx.lineWidth=0.62;
          for (let i=0;i<2;i++) {
            const bx=len*(0.56-i*0.11), reach=(1.4+i*0.34+pick*0.70);
            ctx.beginPath(); ctx.moveTo(bx,h*0.21); ctx.quadraticCurveTo(bx+0.5,h*0.46,bx+reach,h*(0.62+i*0.06)); ctx.stroke();
          }
        }
      } else {
        const pulse = 0.72 + 0.20 * Math.sin(this.phase * 0.38 + this.variantPhase);
        const shellDark = "rgba(3,8,13,0.78)";
        const shellDark2 = "rgba(8,13,18,0.56)";
        const redCore = `rgba(255,52,82,${0.34 + 0.18*pulse})`;
        const redEdge = `rgba(255,78,106,${0.78 + 0.16*pulse})`;
        const ice = `rgba(205,248,255,${0.72 + 0.18*pulse})`;
        const iceSoft = `rgba(145,235,255,${0.30 + 0.14*pulse})`;

        ctx.save();
        ctx.shadowColor = "rgba(255,55,88,0.72)";
        ctx.shadowBlur = 0;

        const tailX=-len*0.76;
        for (let i=-1;i<=1;i++) {
          ctx.fillStyle = "rgba(7,15,21,0.38)";
          ctx.strokeStyle = i===0 ? ice : redEdge;
          ctx.lineWidth = i===0 ? 0.62 : 0.54;
          ctx.beginPath(); ctx.moveTo(tailX,-h*0.06+i*h*0.04);
          ctx.quadraticCurveTo(-len*1.03,-h*(0.18-i*0.16),-len*1.18,-h*(0.12-i*0.28));
          ctx.quadraticCurveTo(-len*1.06,h*(0.02+i*0.13),tailX,h*0.10+i*h*0.03); ctx.closePath(); ctx.fill(); ctx.stroke();
        }

        for (let i=5;i>=0;i--) {
          const t=i/5;
          const x=-len*0.58 + i*len*0.20;
          const y=h*(0.08 + 0.10*Math.sin((1-t)*Math.PI));
          const rx=len*(0.17 - i*0.008);
          const ry=h*(0.48 - i*0.025);
          const whiteBand = i===0 || i===2 || i===4;
          // Flat dark shell material is much cheaper than six radial gradients per shrimp.
          // Colour identity comes from the luminous band edge / point and the final red emitter pass.
          ctx.fillStyle = whiteBand ? "rgba(13,22,28,0.66)" : "rgba(31,10,18,0.74)";
          ctx.strokeStyle=whiteBand ? ice : redEdge; ctx.lineWidth=0.58;
          ctx.beginPath(); ctx.ellipse(x,y,rx,ry,-0.05+0.04*i,0,Math.PI*2); ctx.fill(); ctx.stroke();

          ctx.fillStyle = whiteBand ? ice : redEdge;
          ctx.globalAlpha *= 0.78;
          ctx.beginPath(); ctx.arc(x-rx*0.18,y-ry*0.02,0.34 + (i%2)*0.08,0,Math.PI*2); ctx.fill();
          ctx.globalAlpha /= 0.78;
        }

        ctx.fillStyle="rgba(24,10,16,0.78)"; ctx.strokeStyle=redEdge; ctx.lineWidth=0.74;
        ctx.beginPath(); ctx.moveTo(len*0.86,-h*0.10);
        ctx.lineTo(len*1.08,-h*0.20); ctx.lineTo(len*0.91,-h*0.02);
        ctx.quadraticCurveTo(len*0.84,h*0.46,len*0.38,h*0.50);
        ctx.quadraticCurveTo(len*0.14,h*0.08,len*0.28,-h*0.48);
        ctx.quadraticCurveTo(len*0.62,-h*0.58,len*0.86,-h*0.10); ctx.closePath(); ctx.fill(); ctx.stroke();

        ctx.strokeStyle=ice; ctx.lineWidth=h*0.22; ctx.lineCap="round";
        ctx.beginPath(); ctx.moveTo(len*0.43,-h*0.31); ctx.lineTo(len*0.38,h*0.28); ctx.stroke();
        ctx.strokeStyle="rgba(255,255,255,0.24)"; ctx.lineWidth=h*0.07;
        ctx.beginPath(); ctx.moveTo(len*0.44,-h*0.27); ctx.lineTo(len*0.39,h*0.24); ctx.stroke();

        ctx.shadowColor="transparent"; ctx.shadowBlur=0;
        ctx.fillStyle="rgba(7,15,19,0.98)"; ctx.beginPath(); ctx.arc(len*0.75,-h*0.28,1.10,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=ice; ctx.beginPath(); ctx.arc(len*0.80,-h*0.33,0.42,0,Math.PI*2); ctx.fill();

        ctx.shadowBlur=0; ctx.lineWidth=0.50; ctx.lineCap="round";
        ctx.strokeStyle=iceSoft;
        ctx.beginPath(); ctx.moveTo(len*0.86,-h*0.12); ctx.bezierCurveTo(len*1.12,-h*0.55,len*1.43,-h*0.52,len*1.62,-h*0.20); ctx.stroke();
        ctx.strokeStyle=`rgba(255,74,103,${0.54+0.18*pulse})`;
        ctx.beginPath(); ctx.moveTo(len*0.88,-h*0.02); ctx.bezierCurveTo(len*1.18,-h*0.12,len*1.40,h*0.02,len*1.55,h*0.24); ctx.stroke();

        ctx.strokeStyle="rgba(149,233,244,0.34)"; ctx.lineWidth=0.46;
        for (let i=0;i<3;i++) {
          const bx=len*(0.34-i*0.18); const kick=(i===0&&this.shrimpState==="graze")?pick*1.0:0;
          ctx.beginPath(); ctx.moveTo(bx,h*0.32); ctx.quadraticCurveTo(bx-len*0.04,h*0.60,bx-len*0.14+kick,h*0.78); ctx.stroke();
        }
        if (this.shrimpState === "graze") {
          ctx.strokeStyle=ice; ctx.lineWidth=0.58;
          for (let i=0;i<2;i++) {
            const bx=len*(0.56-i*0.11), reach=(1.4+i*0.34+pick*0.70);
            ctx.beginPath(); ctx.moveTo(bx,h*0.21); ctx.quadraticCurveTo(bx+0.5,h*0.46,bx+reach,h*(0.62+i*0.06)); ctx.stroke();
          }
        }

        ctx.shadowBlur=0;
        for (let i=0;i<4;i++) {
          const x=-len*0.34+i*len*0.28;
          const y=h*(0.05+0.025*Math.sin(this.phase*0.8+i));
          ctx.fillStyle=i%2?ice:redEdge;
          ctx.globalAlpha*=0.58;
          ctx.fillRect(x-0.42,y-0.28,0.84,0.56);
          ctx.globalAlpha/=0.58;
        }

        // One compact glow operation for all red shell areas, even at 30 shrimp.
        // This avoids per-segment blur calls while making the red bands genuinely emit.
        let shrimpRedGlow = this._shrimpRedGlowPath;
        if (!shrimpRedGlow) {
          shrimpRedGlow = new Path2D();
          for (let i=5;i>=0;i--) {
            if (i===0 || i===2 || i===4) continue;
            const x=-len*0.58 + i*len*0.20;
            const y=h*(0.08 + 0.10*Math.sin((1-i/5)*Math.PI));
            const rx=len*(0.17 - i*0.008);
            const ry=h*(0.48 - i*0.025);
            shrimpRedGlow.ellipse(x,y,rx,ry,-0.05+0.04*i,0,Math.PI*2);
          }
          shrimpRedGlow.moveTo(len*0.86,-h*0.10);
          shrimpRedGlow.lineTo(len*1.08,-h*0.20); shrimpRedGlow.lineTo(len*0.91,-h*0.02);
          shrimpRedGlow.quadraticCurveTo(len*0.84,h*0.46,len*0.38,h*0.50);
          shrimpRedGlow.quadraticCurveTo(len*0.14,h*0.08,len*0.28,-h*0.48);
          shrimpRedGlow.quadraticCurveTo(len*0.62,-h*0.58,len*0.86,-h*0.10); shrimpRedGlow.closePath();
          this._shrimpRedGlowPath = shrimpRedGlow;
        }
        ctx.save();
        ctx.globalCompositeOperation="lighter";
        ctx.strokeStyle=`rgba(255,58,91,${0.12+0.08*pulse})`;
        ctx.lineWidth=1.6;
        ctx.stroke(shrimpRedGlow);
        ctx.fillStyle=`rgba(255,58,91,${0.20+0.12*pulse})`;
        ctx.fill(shrimpRedGlow);
        ctx.restore();
        ctx.restore();
      }

    }

    ctx.restore();

    // 魚の移動トレールは全魚種・NATURAL / CYBER 共通で廃止。
  }
}

// 軽量なSeed乱数。景観生成だけに使い、魚AIのランダム性とは分離する。
function landscapeRng(seed) {
  let a = (seed >>> 0) || 0x6d2b79f5;
  return function() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function landscapeHash(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// 電脳水草。1インスタンス=1株ではなく「群落」。本体は静的レイヤーへ焼き込み、
// 動的レイヤーでは葉先のごく一部だけを描く。
class CyberPlant {
  constructor(xRatio, speciesData, options = {}) {
    this.xRatio = xRatio;
    this.id = speciesData.id;
    this.name = speciesData.name;
    this.color = speciesData.color;
    this.anchorLift = options.anchorLift || 0;
    this.rotation = options.rotation || 0;
    this.clusterScale = options.clusterScale || 1;
    this.layoutKey = options.layoutKey || null;
    this.zone = options.zone || (this.id === "eleocharis-mini" ? "foreground" : (["vallisneria"].includes(this.id) ? "background" : "midground"));
    this.displayLabel = ({
      "eleocharis-mini":"ELEOCHARIS MINI", "vallisneria":"VALLISNERIA", "amazon-sword":"AMAZON SWORD"
    })[this.id] || this.name || this.id;
    this.layer = ({ "vallisneria": 0, "amazon-sword": 1, "eleocharis-mini": 3, "microsorum": 2, "anubias": 3, "java-moss": 4 })[this.id] ?? 2;
    this.seed = (options.seed >>> 0) || (Math.random() * 0xffffffff) >>> 0;
    this.rand = landscapeRng(this.seed);
    this.phase = this.rand() * Math.PI * 2;
    this.swaySpeed = 0.025 + this.rand() * 0.018;
    this.x = 0;
    this.y = 0;
    this.height = 80;
    this.spread = 70;
    this.parts = [];
    this.motionParts = [];
    this.setupGeometry();
  }

  r(min, max) { return min + this.rand() * (max - min); }

  setupGeometry() {
    this.parts = [];
    this.motionParts = [];

    if (this.id === "anubias") {
      this.height = this.r(52, 70);
      this.spread = this.r(62, 82);
      const count = 6 + Math.floor(this.rand() * 3);
      for (let i = 0; i < count; i++) {
        const leaf = {
          baseX: this.r(-this.spread * 0.34, this.spread * 0.34),
          angle: this.r(-0.75, 0.75),
          petiole: this.r(16, 30),
          length: this.r(20, 30),
          width: this.r(9, 14),
          tone: this.r(0, 1)
        };
        this.parts.push(leaf);
        if (i % 3 === 1) this.motionParts.push(leaf);
      }
    } else if (this.id === "microsorum") {
      this.height = this.r(112, 158);
      this.spread = this.r(72, 96);
      const count = 7 + Math.floor(this.rand() * 3);
      for (let i = 0; i < count; i++) {
        const leaf = {
          baseX: this.r(-this.spread * 0.34, this.spread * 0.34),
          lean: this.r(-0.55, 0.55),
          length: this.height * this.r(0.62, 1),
          width: this.r(8, 13),
          curl: this.r(-18, 18),
          phase: this.r(0, Math.PI * 2)
        };
        this.parts.push(leaf);
        if (i % 3 === 0) this.motionParts.push(leaf);
      }
    } else if (this.id === "eleocharis-mini") {
      this.height = this.r(30, 46);
      this.spread = this.r(54, 76);
      const count = 15 + Math.floor(this.rand() * 7);
      for (let i = 0; i < count; i++) {
        const blade = {
          baseX: this.r(-this.spread * 0.48, this.spread * 0.48),
          length: this.height * this.r(0.55, 1.0),
          bend: this.r(-7, 7),
          width: this.r(0.75, 1.35),
          phase: this.r(0, Math.PI * 2),
          tone: this.r(0, 1)
        };
        this.parts.push(blade);
        if (i % 5 === 0) this.motionParts.push(blade);
      }
    } else if (this.id === "vallisneria") {
      this.height = this.r(190, 265);
      this.spread = this.r(58, 82);
      const count = 7 + Math.floor(this.rand() * 4);
      for (let i = 0; i < count; i++) {
        const leaf = {
          baseX: this.r(-this.spread * 0.36, this.spread * 0.36),
          length: this.height * this.r(0.72, 1.05),
          width: this.r(2.2, 3.8),
          bend: this.r(-48, 48),
          phase: this.r(0, Math.PI * 2),
          tone: this.r(0, 1)
        };
        this.parts.push(leaf);
        if (i % 3 === 0) this.motionParts.push(leaf);
      }
    } else if (this.id === "java-moss") {
      this.height = this.r(28, 42);
      this.spread = this.r(64, 92);
      const count = 20 + Math.floor(this.rand() * 8);
      for (let i = 0; i < count; i++) {
        const x0 = this.r(-this.spread * 0.5, this.spread * 0.5);
        const y0 = this.r(-9, 0);
        const len = this.r(8, 18);
        const ang = -Math.PI * this.r(0.20, 0.80);
        const part = {
          x0, y0,
          x1: x0 + Math.cos(ang) * len * 0.58,
          y1: y0 + Math.sin(ang) * len * 0.58,
          x2: x0 + Math.cos(ang) * len,
          y2: y0 + Math.sin(ang) * len,
          branch: this.r(-6, 6),
          phase: this.r(0, Math.PI * 2)
        };
        this.parts.push(part);
        if (i % 7 === 0) this.motionParts.push(part);
      }
    } else if (this.id === "amazon-sword") {
      this.height = this.r(165, 225);
      this.spread = this.r(86, 118);
      const count = 7 + Math.floor(this.rand() * 3);
      for (let i = 0; i < count; i++) {
        const leaf = {
          lean: this.r(-0.76, 0.76),
          length: this.height * this.r(0.66, 1.02),
          width: this.r(14, 23),
          curl: this.r(-16, 16),
          phase: this.r(0, Math.PI * 2)
        };
        this.parts.push(leaf);
        if (i % 3 === 0) this.motionParts.push(leaf);
      }
    } else if (this.id === "ludwigia-super-red") {
      this.height = this.r(145, 205);
      this.spread = this.r(76, 108);
      const stems = 7 + Math.floor(this.rand() * 4);
      for (let i = 0; i < stems; i++) {
        const stem = {
          baseX: this.r(-this.spread * 0.44, this.spread * 0.44),
          length: this.height * this.r(0.72, 1.02),
          lean: this.r(-18, 18),
          nodes: 6 + Math.floor(this.rand() * 3),
          phase: this.r(0, Math.PI * 2),
          tone: this.r(0, 1)
        };
        this.parts.push(stem);
        if (i % 3 === 1) this.motionParts.push(stem);
      }
    }
  }

  updatePosition(w, h, terrainHeightFunc) {
    this.x = w * this.xRatio;
    const scale = window.aquariumInstance ? window.aquariumInstance.scale : 1.0;
    this.y = terrainHeightFunc(this.x) - this.anchorLift * scale - 0.5;
  }

  update() { this.phase += this.swaySpeed; }

  drawStatic(ctx) {
    // 再描画・リサイズでも同じ完成物になるようSeed乱数をリセット。
    this.rand = landscapeRng(this.seed);
    const scale = window.aquariumInstance ? window.aquariumInstance.scale : 1.0;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(scale * this.clusterScale, scale * this.clusterScale);
    ctx.rotate(this.rotation);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    applyNaturalLineSoftness(ctx);

    if (this.id === "anubias") {
      ctx.strokeStyle = "rgba(78,105,61,0.90)";
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.moveTo(-this.spread * 0.38, -3);
      ctx.bezierCurveTo(-this.spread * 0.12, -8, this.spread * 0.12, -1, this.spread * 0.38, -5);
      ctx.stroke();
      this.parts.forEach((leaf) => {
        ctx.save();
        ctx.translate(leaf.baseX, -4);
        ctx.rotate(leaf.angle);
        ctx.strokeStyle = "rgba(78,110,69,0.82)";
        ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -leaf.petiole); ctx.stroke();
        ctx.translate(0, -leaf.petiole);
        ctx.fillStyle = leaf.tone > 0.5 ? "rgba(23,74,50,0.90)" : "rgba(17,61,42,0.92)";
        ctx.strokeStyle = "rgba(70,151,105,0.70)";
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.ellipse(0, -leaf.length * 0.42, leaf.width, leaf.length * 0.54, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "rgba(117,210,147,0.34)";
        ctx.lineWidth = 0.55;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -leaf.length * 0.86); ctx.stroke();
        ctx.restore();
      });
    } else if (this.id === "microsorum") {
      ctx.strokeStyle = "rgba(72,100,58,0.88)";
      ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.moveTo(-this.spread * 0.38, -3); ctx.quadraticCurveTo(0, -8, this.spread * 0.38, -5); ctx.stroke();
      this.parts.forEach((leaf) => {
        ctx.save();
        ctx.translate(leaf.baseX, -5);
        ctx.rotate(leaf.lean * 0.48);
        const len = leaf.length, w = leaf.width;
        ctx.fillStyle = "rgba(17,66,48,0.84)";
        ctx.strokeStyle = "rgba(59,143,96,0.62)";
        ctx.lineWidth = 0.85;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-w * 0.66, -len * 0.26, -w * 0.82 + leaf.curl * 0.08, -len * 0.68, leaf.curl * 0.18, -len);
        ctx.bezierCurveTo(w * 0.82 + leaf.curl * 0.08, -len * 0.68, w * 0.66, -len * 0.26, 0, 0);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "rgba(111,201,139,0.25)";
        ctx.lineWidth = 0.55;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(leaf.curl * 0.08, -len * 0.52, leaf.curl * 0.18, -len); ctx.stroke();
        ctx.restore();
      });
    } else if (this.id === "eleocharis-mini") {
      this.parts.forEach((blade) => {
        const natural = true; // PAKU: NATURAL only, unconditionally.
        ctx.strokeStyle = natural
          ? (blade.tone > 0.5 ? "rgba(72,132,82,0.68)" : "rgba(59,116,73,0.64)")
          : (blade.tone > 0.5 ? "rgba(98,238,154,0.56)" : "rgba(62,211,130,0.50)");
        ctx.lineWidth = blade.width;
        ctx.beginPath();
        ctx.moveTo(blade.baseX, 0);
        ctx.quadraticCurveTo(blade.baseX + blade.bend * 0.32, -blade.length * 0.55, blade.baseX + blade.bend, -blade.length);
        ctx.stroke();
      });
    } else if (this.id === "vallisneria") {
      this.parts.forEach((leaf, i) => {
        const tipX = leaf.bend;
        ctx.strokeStyle = leaf.tone > 0.55 ? "rgba(31,123,86,0.78)" : "rgba(25,103,75,0.74)";
        ctx.lineWidth = leaf.width;
        ctx.beginPath();
        ctx.moveTo(leaf.baseX, -1);
        ctx.bezierCurveTo(leaf.baseX + tipX * 0.14, -leaf.length * 0.34, leaf.baseX + tipX * 0.72, -leaf.length * 0.76, leaf.baseX + tipX, -leaf.length);
        ctx.stroke();
        if (i % 3 === 0) {
          ctx.strokeStyle = "rgba(87,187,139,0.22)";
          ctx.lineWidth = 0.55;
          ctx.stroke();
        }
      });
    } else if (this.id === "java-moss") {
      ctx.strokeStyle = "rgba(74,145,65,0.78)";
      ctx.lineWidth = 0.95;
      this.parts.forEach((leaf) => {
        ctx.beginPath(); ctx.moveTo(leaf.x0, leaf.y0); ctx.lineTo(leaf.x1, leaf.y1); ctx.lineTo(leaf.x2, leaf.y2); ctx.stroke();
        const dx = leaf.x2 - leaf.x1, dy = leaf.y2 - leaf.y1, mag = Math.hypot(dx, dy) || 1;
        const px = -dy / mag, py = dx / mag;
        ctx.beginPath(); ctx.moveTo(leaf.x1, leaf.y1); ctx.lineTo(leaf.x1 + px * leaf.branch, leaf.y1 + py * leaf.branch - 3); ctx.stroke();
      });
    } else if (this.id === "amazon-sword") {
      this.parts.forEach((leaf) => {
        ctx.save();
        ctx.rotate(leaf.lean * 0.42);
        const len = leaf.length, w = leaf.width;
        ctx.fillStyle = "rgba(31,87,37,0.82)";
        ctx.strokeStyle = "rgba(83,152,73,0.66)";
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-w * 0.42, -len * 0.22, -w * 0.82 + leaf.curl * 0.05, -len * 0.62, leaf.curl * 0.12, -len);
        ctx.bezierCurveTo(w * 0.82 + leaf.curl * 0.05, -len * 0.62, w * 0.42, -len * 0.22, 0, 0);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "rgba(146,207,113,0.26)";
        ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(leaf.curl * 0.05, -len * 0.5, leaf.curl * 0.12, -len); ctx.stroke();
        ctx.restore();
      });
    } else if (this.id === "ludwigia-super-red") {
      this.parts.forEach((stem) => {
        const topX = stem.baseX + stem.lean;
        ctx.strokeStyle = "rgba(137,54,50,0.90)";
        ctx.lineWidth = 1.35;
        ctx.beginPath(); ctx.moveTo(stem.baseX, 0); ctx.quadraticCurveTo(stem.baseX + stem.lean * 0.28, -stem.length * 0.52, topX, -stem.length); ctx.stroke();
        for (let n = 1; n <= stem.nodes; n++) {
          const t = n / (stem.nodes + 1);
          const y = -stem.length * t;
          const x = stem.baseX + stem.lean * t * t;
          const upper = t > 0.62;
          const fill = upper ? "rgba(211,54,48,0.88)" : (stem.tone > 0.5 ? "rgba(139,50,57,0.86)" : "rgba(112,43,51,0.88)");
          const len = upper ? 10.5 : 9.2;
          const wid = upper ? 4.8 : 4.2;
          const side = n % 2 ? 1 : -1;
          ctx.save(); ctx.translate(x, y); ctx.rotate(side * 0.62 + stem.lean * 0.006);
          ctx.fillStyle = fill; ctx.strokeStyle = "rgba(235,91,72,0.38)"; ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.ellipse(side * len * 0.42, 0, len * 0.58, wid, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.restore();
        }
      });
    }
    ctx.restore();
  }

  // 低負荷の揺れ。静的本体の上へ葉先/茎先の信号だけを重ねる。
  drawMotion(ctx) {
    const scale = window.aquariumInstance ? window.aquariumInstance.scale : 1.0;
    const sway = Math.sin(this.phase) * 1.0;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(scale * this.clusterScale, scale * this.clusterScale);
    ctx.rotate(this.rotation);
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.72;

    if (this.id === "eleocharis-mini") {
      this.motionParts.forEach((blade) => {
        const s = Math.sin(this.phase + blade.phase) * 2.2;
        ctx.strokeStyle = "rgba(94,150,98,0.26)"; // PAKU: NATURAL only, unconditionally.
        ctx.lineWidth = Math.max(0.55, blade.width * 0.55);
        ctx.beginPath();
        ctx.moveTo(blade.baseX + blade.bend * 0.30, -blade.length * 0.56);
        ctx.quadraticCurveTo(blade.baseX + blade.bend * 0.68 + s * 0.18, -blade.length * 0.78, blade.baseX + blade.bend + s, -blade.length);
        ctx.stroke();
      });
    } else if (this.id === "vallisneria") {
      this.motionParts.forEach((leaf) => {
        const s = Math.sin(this.phase * 0.76 + leaf.phase) * 11;
        const tipX = leaf.bend + s;
        ctx.strokeStyle = "rgba(80,214,150,0.38)";
        ctx.lineWidth = Math.max(0.65, leaf.width * 0.45);
        ctx.beginPath();
        ctx.moveTo(leaf.baseX, -leaf.length * 0.52);
        ctx.quadraticCurveTo(leaf.baseX + tipX * 0.70, -leaf.length * 0.76, leaf.baseX + tipX, -leaf.length);
        ctx.stroke();
      });
    } else if (this.id === "microsorum" || this.id === "amazon-sword") {
      this.motionParts.forEach((leaf) => {
        const s = Math.sin(this.phase + leaf.phase) * 7;
        const len = leaf.length;
        ctx.save();
        if (this.id === "microsorum") {
          ctx.translate(leaf.baseX, -5);
          ctx.rotate(leaf.lean * 0.48);
        } else {
          ctx.rotate(leaf.lean * 0.42);
        }
        ctx.strokeStyle = this.id === "microsorum" ? "rgba(101,217,151,0.34)" : "rgba(151,219,112,0.31)";
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(0, -len * 0.56);
        ctx.quadraticCurveTo(s * 0.12, -len * 0.80, s * 0.28 + (leaf.curl || 0) * 0.10, -len);
        ctx.stroke();
        ctx.restore();
      });
    } else if (this.id === "anubias") {
      this.motionParts.forEach((leaf, i) => {
        const s = Math.sin(this.phase + i * 0.9) * 1.8;
        ctx.save();
        ctx.translate(leaf.baseX, -4);
        ctx.rotate(leaf.angle);
        ctx.strokeStyle = "rgba(122,222,153,0.30)";
        ctx.lineWidth = 0.65;
        ctx.beginPath();
        ctx.moveTo(0, -leaf.petiole - leaf.length * 0.28);
        ctx.lineTo(s, -leaf.petiole - leaf.length * 0.82);
        ctx.stroke();
        ctx.restore();
      });
    } else if (this.id === "java-moss") {
      this.motionParts.forEach((part) => {
        const s = Math.sin(this.phase + part.phase) * 1.2;
        ctx.strokeStyle = "rgba(121,205,85,0.34)";
        ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(part.x1, part.y1); ctx.lineTo(part.x2 + s, part.y2); ctx.stroke();
      });
    } else if (this.id === "ludwigia-super-red") {
      this.motionParts.forEach((stem) => {
        const s = Math.sin(this.phase + stem.phase) * 3.4;
        ctx.strokeStyle = "rgba(255,94,76,0.40)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(stem.baseX + stem.lean * 0.60, -stem.length * 0.60);
        ctx.quadraticCurveTo(stem.baseX + stem.lean * 0.82 + s * 0.3, -stem.length * 0.82, stem.baseX + stem.lean + s, -stem.length);
        ctx.stroke();
      });
    }
    ctx.restore();
  }
}


// 活着草は単体では置かず、流木＋植物が一体になった完成ユニットとして扱う。
// 大部分は静的レイヤーへ焼き込み、動的レイヤーでは葉先だけを軽く動かす。
class CyberEpiphyteWoodUnit {
  constructor(options = {}, density = {}) {
    this.type = options.type || "mixed";
    this.xRatio = options.xRatio ?? 0.32;
    this.unitScale = options.scale ?? 1.0;
    this.layoutKey = options.layoutKey || null;
    this.zone = options.zone || "midground";
    this.displayLabel = options.displayLabel || "EPIPHYTE WOOD";
    this.lean = options.lean ?? 1;
    this.seed = (options.seed >>> 0) || 1;
    this.rand = landscapeRng(this.seed);
    this.phase = this.rand() * Math.PI * 2;
    this.x = 0;
    this.y = 0;
    this.layer = 2;
    this.density = {
      anubias: Math.max(0, density.anubias || 0),
      microsorum: Math.max(0, density.microsorum || 0),
      "java-moss": Math.max(0, density["java-moss"] || 0)
    };
    this.grazePoints = [];
  }

  updatePosition(w, h, terrainHeightFunc) {
    this.x = w * this.xRatio;
    this.y = terrainHeightFunc(this.x) + 1;
    this.rebuildGrazePoints();
  }

  update() { this.phase += 0.022; }

  woodStroke(ctx, p0, c1, c2, p1, width, alpha = 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(31,20,14,0.99)";
    ctx.lineWidth = width + 5.2;
    ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.bezierCurveTo(c1[0],c1[1],c2[0],c2[1],p1[0],p1[1]); ctx.stroke();
    ctx.strokeStyle = "rgba(92,57,34,0.98)";
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.strokeStyle = "rgba(186,121,73,0.18)";
    ctx.lineWidth = Math.max(0.65, width * 0.10);
    ctx.beginPath(); ctx.moveTo(p0[0]+1.8,p0[1]-1.6); ctx.bezierCurveTo(c1[0]+1.3,c1[1]-1.6,c2[0]+1.0,c2[1]-1.2,p1[0]+0.8,p1[1]-0.9); ctx.stroke();
    ctx.restore();
  }

  drawWoodBody(ctx) {
    // 4種類とも「根株の質量」が先にあり、その先に幹・根が伸びる。
    const L = this.lean;
    ctx.save();
    ctx.scale(L, 1);

    if (this.type === "anubias") {
      ctx.fillStyle = "rgba(45,28,18,0.99)";
      ctx.beginPath(); ctx.ellipse(-12,-18,48,24,-0.10,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = "rgba(91,56,33,0.96)";
      ctx.beginPath(); ctx.ellipse(-7,-22,38,17,-0.08,0,Math.PI*2); ctx.fill();
      this.woodStroke(ctx, [-45,-16], [-12,-29], [38,-24], [88,-35], 15);
      this.woodStroke(ctx, [-26,-8], [-10,-2], [25,2], [62,0], 9, 0.94);
      this.woodStroke(ctx, [22,-24], [42,-48], [62,-53], [78,-68], 6.5, 0.92);
    } else if (this.type === "microsorum") {
      ctx.fillStyle = "rgba(42,26,18,0.99)";
      ctx.beginPath(); ctx.ellipse(-20,-18,42,26,-0.18,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = "rgba(94,58,34,0.97)";
      ctx.beginPath(); ctx.ellipse(-14,-24,32,19,-0.18,0,Math.PI*2); ctx.fill();
      this.woodStroke(ctx, [-32,-20], [-12,-46], [32,-83], [74,-126], 16);
      this.woodStroke(ctx, [-22,-10], [8,-2], [46,-11], [83,-23], 9, 0.94);
      this.woodStroke(ctx, [22,-64], [38,-78], [62,-82], [82,-95], 6.2, 0.90);
    } else if (this.type === "moss") {
      ctx.fillStyle = "rgba(44,28,19,0.99)";
      ctx.beginPath(); ctx.ellipse(-9,-16,46,22,-0.04,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = "rgba(93,57,34,0.97)";
      ctx.beginPath(); ctx.ellipse(-4,-20,36,15,-0.04,0,Math.PI*2); ctx.fill();
      this.woodStroke(ctx, [-54,-18], [-12,-34], [35,-31], [94,-43], 13.5);
      this.woodStroke(ctx, [-30,-8], [2,-1], [38,-2], [70,4], 7.5, 0.92);
      this.woodStroke(ctx, [30,-32], [48,-49], [62,-61], [72,-78], 5.6, 0.88);
    } else {
      // MIXED WOOD: 主役ユニット。横へ張る根株＋一本の斜め主幹。
      ctx.fillStyle = "rgba(40,25,17,0.99)";
      ctx.beginPath(); ctx.ellipse(-15,-19,58,31,-0.13,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = "rgba(92,57,34,0.97)";
      ctx.beginPath(); ctx.ellipse(-8,-24,44,22,-0.12,0,Math.PI*2); ctx.fill();
      this.woodStroke(ctx, [-48,-16], [-18,-33], [34,-31], [98,-48], 17);
      this.woodStroke(ctx, [-24,-21], [-8,-59], [25,-93], [58,-132], 14.5);
      this.woodStroke(ctx, [-37,-8], [-5,3], [35,1], [76,6], 8.5, 0.95);
      this.woodStroke(ctx, [28,-86], [50,-96], [72,-94], [94,-108], 6.5, 0.90);
      this.woodStroke(ctx, [42,-39], [64,-58], [81,-65], [96,-79], 5.8, 0.88);
    }

    // 木肌の節。少数だけで、線画っぽくしない。
    ctx.strokeStyle = "rgba(199,132,78,0.18)";
    ctx.lineWidth = 1.0;
    for (let i = 0; i < 3; i++) {
      const x = -18 + i * 29 + (this.rand() - 0.5) * 8;
      const y = -22 - i * 8;
      ctx.beginPath(); ctx.arc(x, y, 5 + i * 1.3, -0.5, 1.9); ctx.stroke();
    }
    ctx.restore();
  }

  drawAnubiasCluster(ctx, ax, ay, size = 1, countMul = 1) {
    const count = Math.max(3, Math.round(5 * countMul));
    for (let i = 0; i < count; i++) {
      const t = count <= 1 ? 0.5 : i / (count - 1);
      const angle = -0.90 + t * 1.78 + (this.rand()-0.5)*0.18;
      const pet = (18 + this.rand()*12) * size;
      const len = (19 + this.rand()*8) * size;
      const wid = (8.5 + this.rand()*3.8) * size;
      const bx = ax + (this.rand()-0.5)*22*size;
      const by = ay + (this.rand()-0.5)*5*size;
      ctx.save(); ctx.translate(bx, by); ctx.rotate(angle*0.50);
      ctx.strokeStyle = "rgba(71,101,64,0.88)"; ctx.lineWidth = 1.6*size;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-pet); ctx.stroke();
      ctx.translate(0,-pet);
      ctx.fillStyle = i%2 ? "rgba(18,65,43,0.96)" : "rgba(24,78,50,0.95)";
      ctx.strokeStyle = "rgba(65,139,92,0.72)"; ctx.lineWidth = 0.82*size;
      ctx.beginPath(); ctx.ellipse(0,-len*0.42,wid,len*0.55,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "rgba(116,202,139,0.28)"; ctx.lineWidth = 0.52*size;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-len*0.86); ctx.stroke();
      ctx.restore();
    }
  }

  drawMicrosorumFan(ctx, ax, ay, size = 1, countMul = 1) {
    const count = Math.max(4, Math.round(7 * countMul));
    for (let i = 0; i < count; i++) {
      const t = count <= 1 ? 0.5 : i/(count-1);
      const ang = (-0.72 + t*1.38) + (this.rand()-0.5)*0.16;
      const len = (66 + this.rand()*44) * size;
      const wid = (6.5 + this.rand()*4.2) * size;
      const curl = (this.rand()-0.5)*16*size;
      ctx.save(); ctx.translate(ax+(this.rand()-0.5)*18*size, ay); ctx.rotate(ang*0.42);
      ctx.fillStyle = "rgba(18,67,48,0.91)"; ctx.strokeStyle = "rgba(58,142,96,0.66)"; ctx.lineWidth = 0.8*size;
      ctx.beginPath(); ctx.moveTo(0,0);
      ctx.bezierCurveTo(-wid*0.70,-len*0.30,-wid*0.84+curl*0.06,-len*0.70,curl*0.16,-len);
      ctx.bezierCurveTo(wid*0.84+curl*0.06,-len*0.70,wid*0.70,-len*0.30,0,0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "rgba(105,199,137,0.26)"; ctx.lineWidth = 0.52*size;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(curl*0.07,-len*0.52,curl*0.16,-len); ctx.stroke();
      ctx.restore();
    }
  }

  drawMossPatch(ctx, ax, ay, width = 70, density = 1) {
    const count = Math.max(12, Math.round(24*density));
    ctx.strokeStyle = "rgba(74,145,66,0.82)";
    ctx.lineWidth = 0.9;
    for (let i = 0; i < count; i++) {
      const x0 = ax + (this.rand()-0.5)*width;
      const y0 = ay + (this.rand()-0.5)*7;
      const len = 7 + this.rand()*14;
      const ang = -Math.PI*(0.24 + this.rand()*0.58);
      const x1 = x0 + Math.cos(ang)*len*0.55;
      const y1 = y0 + Math.sin(ang)*len*0.55;
      const x2 = x0 + Math.cos(ang)*len;
      const y2 = y0 + Math.sin(ang)*len;
      ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      if (i%2===0) {
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x1+(this.rand()-0.5)*8,y1-3-this.rand()*4); ctx.stroke();
      }
    }
  }

  drawStatic(ctx) {
    const scale = window.aquariumInstance ? window.aquariumInstance.scale : 1.0;
    ctx.save(); ctx.translate(this.x,this.y); ctx.scale(scale*this.unitScale, scale*this.unitScale);
    applyNaturalLineSoftness(ctx);
    this.drawWoodBody(ctx);

    const a = this.density.anubias;
    const m = this.density.microsorum;
    const moss = this.density["java-moss"];
    if (this.type === "anubias") {
      if (a>0) { this.drawAnubiasCluster(ctx,-18,-29,1.02,a); this.drawAnubiasCluster(ctx,34,-35,0.82,a*0.82); }
    } else if (this.type === "microsorum") {
      if (m>0) { this.drawMicrosorumFan(ctx,-12,-28,1.02,m); this.drawMicrosorumFan(ctx,21,-54,0.72,m*0.80); }
    } else if (this.type === "moss") {
      if (moss>0) { this.drawMossPatch(ctx,5,-39,112,moss); this.drawMossPatch(ctx,50,-53,54,moss*0.82); }
    } else {
      if (m>0) this.drawMicrosorumFan(ctx,-13,-34,0.94,m*0.92);
      if (a>0) { this.drawAnubiasCluster(ctx,-31,-25,0.92,a*0.90); this.drawAnubiasCluster(ctx,35,-42,0.72,a*0.74); }
      if (moss>0) { this.drawMossPatch(ctx,42,-54,78,moss*0.86); this.drawMossPatch(ctx,68,-88,42,moss*0.70); }
    }
    ctx.restore();
  }

  drawMotion(ctx) {
    const scale = window.aquariumInstance ? window.aquariumInstance.scale : 1.0;
    const s = Math.sin(this.phase) * 3.4;
    ctx.save(); ctx.translate(this.x,this.y); ctx.scale(scale*this.unitScale, scale*this.unitScale);
    applyNaturalLineSoftness(ctx);
    ctx.lineCap="round";
    if (this.density.microsorum>0 && (this.type==="microsorum" || this.type==="mixed")) {
      ctx.strokeStyle="rgba(101,217,151,0.28)"; ctx.lineWidth=0.72;
      const ax=this.type==="mixed"?-13:-12, ay=this.type==="mixed"?-34:-28;
      for (let i=0;i<3;i++) { const dx=(i-1)*12; ctx.beginPath(); ctx.moveTo(ax+dx,ay-48); ctx.quadraticCurveTo(ax+dx+s*0.35,ay-72,ax+dx+s,ay-92-i*7); ctx.stroke(); }
    }
    if (this.density.anubias>0) {
      ctx.strokeStyle="rgba(124,218,153,0.22)"; ctx.lineWidth=0.62;
      const ax=this.type==="anubias"?-18:-31, ay=this.type==="anubias"?-29:-25;
      ctx.beginPath(); ctx.moveTo(ax,ay-25); ctx.quadraticCurveTo(ax+s*0.15,ay-34,ax+s*0.34,ay-42); ctx.stroke();
    }
    if (this.density["java-moss"]>0) {
      ctx.strokeStyle="rgba(121,205,85,0.26)"; ctx.lineWidth=0.65;
      const ax=this.type==="moss"?18:48, ay=this.type==="moss"?-46:-61;
      for(let i=0;i<4;i++){ ctx.beginPath(); ctx.moveTo(ax+i*7,ay); ctx.lineTo(ax+i*7+s*0.35,ay-10-i*2); ctx.stroke(); }
    }
    ctx.restore();
  }

  rebuildGrazePoints() {
    const scale = window.aquariumInstance ? window.aquariumInstance.scale : 1.0;
    const S = scale*this.unitScale;
    const L = this.lean;
    const pts=[];
    const add=(lx,ly,source,weight)=>pts.push({x:this.x+lx*S*L,y:this.y+ly*S,source,weight});
    if (this.density["java-moss"]>0) {
      if(this.type==="moss"){ add(0,-42,"java-moss",7); add(48,-53,"java-moss",7); }
      else { add(42,-58,"java-moss",6); add(70,-86,"java-moss",5); }
    }
    if (this.density.anubias>0) { add(-24,-43,"anubias",4); add(30,-48,"anubias",3); }
    if (this.density.microsorum>0) { add(-10,-68,"microsorum",3); add(18,-82,"microsorum",2); }
    // 木肌そのものにもバイオフィルムがある想定。
    add(0,-25,"driftwood",2);
    this.grazePoints=pts;
  }

  getGrazePoints(){ return this.grazePoints || []; }
}

// 自動生成される流木。一本の枝ではなく、根株から複数の太い根・幹が分岐する塊として生成する。
class CyberDriftwood {
  constructor(options = {}) {
    this.xRatio = options.xRatio ?? 0.5;
    this.size = options.size ?? 1;
    this.lean = options.lean ?? 1;
    this.seed = (options.seed >>> 0) || 1;
    this.rand = landscapeRng(this.seed);
    this.x = 0;
    this.y = 0;
    this.arms = [];
    this.surfaceRoots = [];
    this.setup();
  }

  r(min, max) { return min + this.rand() * (max - min); }

  setup() {
    // 根株そのものを大きく取り、そこから3〜5本の主根／幹が広がる。
    this.baseW = this.r(54, 78);
    this.baseH = this.r(24, 38);
    const armCount = 3 + Math.floor(this.rand() * 3);
    const fan = [];
    for (let i = 0; i < armCount; i++) {
      const t = armCount <= 1 ? 0.5 : i / (armCount - 1);
      fan.push(-0.95 + t * 1.90 + this.r(-0.15, 0.15));
    }
    fan.sort((a,b)=>a-b);
    for (let i = 0; i < armCount; i++) {
      const dir = fan[i];
      const dominant = i === Math.floor(armCount * 0.58);
      const length = dominant ? this.r(118, 168) : this.r(76, 132);
      const startX = this.r(-this.baseW * 0.22, this.baseW * 0.22);
      const startY = -this.r(3, this.baseH * 0.34);
      const endX = this.lean * (dir * length * this.r(0.42, 0.76)) + this.r(-18, 18);
      const endY = -length * this.r(0.56, 0.92);
      const bend = this.r(-0.24, 0.24);
      const points = [
        {x:startX, y:startY},
        {x:startX + endX * 0.28 + length * bend * 0.16, y:startY + endY * 0.28 + this.r(-10,8)},
        {x:startX + endX * 0.66 - length * bend * 0.12, y:startY + endY * 0.66 + this.r(-8,10)},
        {x:endX, y:endY}
      ];
      this.arms.push({
        points,
        w0: dominant ? this.r(13,18) : this.r(9,15),
        w1: dominant ? this.r(3.8,6.2) : this.r(2.8,5.0),
        twigSeed: (this.seed ^ Math.imul(i + 11, 0x45d9f3b)) >>> 0
      });
    }

    // 砂の上へ這う根。水槽底に刺さった棒に見せない。
    const rootCount = 5 + Math.floor(this.rand() * 3);
    for (let i = 0; i < rootCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.surfaceRoots.push({
        sx: this.r(-this.baseW * 0.25, this.baseW * 0.25),
        len: this.r(34, 78),
        side,
        curl: this.r(-12, 12),
        width: this.r(4.5, 9.0)
      });
    }
  }

  updatePosition(w, h, terrainHeightFunc) {
    this.x = w * this.xRatio;
    this.y = terrainHeightFunc(this.x) + 1;
  }

  drawSegmentedArm(ctx, arm) {
    const p = arm.points;
    const steps = 9;
    let prev = p[0];
    const pointAt = (t) => {
      const u = 1 - t;
      return {
        x: u*u*u*p[0].x + 3*u*u*t*p[1].x + 3*u*t*t*p[2].x + t*t*t*p[3].x,
        y: u*u*u*p[0].y + 3*u*u*t*p[1].y + 3*u*t*t*p[2].y + t*t*t*p[3].y
      };
    };
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const pt = pointAt(t);
      const w = arm.w0 * (1 - t) + arm.w1 * t;
      ctx.strokeStyle = "rgba(37,23,16,0.99)";
      ctx.lineWidth = w + 4.2;
      ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(pt.x, pt.y); ctx.stroke();
      ctx.strokeStyle = "rgba(92,57,34,0.97)";
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(pt.x, pt.y); ctx.stroke();
      ctx.strokeStyle = "rgba(177,113,66,0.22)";
      ctx.lineWidth = Math.max(0.55, w * 0.10);
      ctx.beginPath(); ctx.moveTo(prev.x + 1.2, prev.y - 1.0); ctx.lineTo(pt.x + 1.2, pt.y - 1.0); ctx.stroke();
      prev = pt;
    }

    // 主腕の途中から短い二次枝を少数だけ出す。細枝だらけにはしない。
    const rng = landscapeRng(arm.twigSeed);
    const twigCount = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < twigCount; i++) {
      const t = 0.50 + rng() * 0.32;
      const base = pointAt(t);
      const dir = rng() < 0.5 ? -1 : 1;
      const len = 18 + rng() * 35;
      const ex = base.x + dir * this.lean * len * (0.48 + rng() * 0.45);
      const ey = base.y - len * (0.38 + rng() * 0.48);
      ctx.strokeStyle = "rgba(45,28,19,0.98)";
      ctx.lineWidth = 4.8;
      ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.quadraticCurveTo((base.x+ex)*0.5, base.y - len*0.18, ex, ey); ctx.stroke();
      ctx.strokeStyle = "rgba(105,65,38,0.94)";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }

  draw(ctx) {
    const scale = window.aquariumInstance ? window.aquariumInstance.scale : 1.0;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(scale * this.size, scale * this.size);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    applyNaturalLineSoftness(ctx);

    // 砂面に広がる主根を先に描く。
    this.surfaceRoots.forEach((root) => {
      const ex = root.side * root.len;
      const ey = this.r ? 0 : 0;
      ctx.strokeStyle = "rgba(40,25,17,0.98)";
      ctx.lineWidth = root.width + 3.5;
      ctx.beginPath(); ctx.moveTo(root.sx, -1); ctx.quadraticCurveTo(ex * 0.50, -5 + root.curl * 0.18, ex, 1.5); ctx.stroke();
      ctx.strokeStyle = "rgba(96,59,34,0.96)";
      ctx.lineWidth = root.width;
      ctx.stroke();
    });

    // 根株の塊。複数の楕円を重ねて一本の棒感を消す。
    ctx.fillStyle = "rgba(42,27,19,0.99)";
    ctx.beginPath();
    ctx.ellipse(0, -this.baseH * 0.32, this.baseW * 0.55, this.baseH * 0.72, -0.08 * this.lean, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(92,57,35,0.96)";
    ctx.beginPath();
    ctx.ellipse(this.lean * this.baseW * 0.08, -this.baseH * 0.42, this.baseW * 0.43, this.baseH * 0.56, -0.10 * this.lean, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(179,117,71,0.20)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(this.lean * this.baseW * 0.05, -this.baseH * 0.42, this.baseW * 0.28, Math.PI*0.92, Math.PI*1.78);
    ctx.stroke();

    this.arms.forEach(arm => this.drawSegmentedArm(ctx, arm));
    ctx.restore();
  }
}

// 旧岩オブジェクト。現行景観では使用しない。
class CyberObstacle {
  constructor(xRatio, width, height, seed = 1) {
    this.xRatio = xRatio;
    this.width = width;
    this.height = height;
    this.seed = seed >>> 0;
    this.x = 0;
    this.y = 0;
  }
  updatePosition(w, h, terrainHeightFunc) {
    this.x = w * this.xRatio;
    this.y = terrainHeightFunc ? terrainHeightFunc(this.x) + 3 : h;
  }
  draw(ctx) {
    const scale = window.aquariumInstance ? window.aquariumInstance.scale : 1.0;
    const r = landscapeRng(this.seed || 1);
    const w = this.width, h = this.height;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "rgba(23,31,33,0.96)";
    ctx.strokeStyle = "rgba(82,105,103,0.42)";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(-w * 0.50, 0);
    ctx.quadraticCurveTo(-w * 0.46, -h * 0.66, -w * 0.12, -h * (0.92 + r() * 0.18));
    ctx.quadraticCurveTo(w * 0.24, -h * (0.90 + r() * 0.18), w * 0.48, -h * 0.20);
    ctx.quadraticCurveTo(w * 0.52, -h * 0.03, w * 0.42, 0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "rgba(118,145,139,0.16)";
    ctx.beginPath(); ctx.moveTo(-w * 0.18, -h * 0.78); ctx.quadraticCurveTo(0, -h * 0.45, w * 0.30, -h * 0.20); ctx.stroke();
    ctx.restore();
  }
}


// アクリウム全体の統括エンジン
class CyberAquarium {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d", { alpha: true });
    
    this.fishes = [];
    this.plants = [];
    this.obstacles = [];
    this.driftwoods = [];
    this.epiphyteUnits = [];
    this.landscapeSeed = (Math.random() * 0xffffffff) >>> 0;
    this.landscapePlan = null;
    this.packets = [];
    this.bubbles = [];
    this.planktons = [];
    this.dustParticles = [];
    this.scanWaves = [];

    // PromptTerm CLOCK由来のCYBER魚エフェクト。
    // 1匹ずつ短時間だけ発火させ、常時ノイズ化しない。
    this.cyberFishFxActive = null;
    this.cyberFishFxNextAt = 3200 + Math.random() * 4200;
    this.cyberFishFxCanvas = document.createElement("canvas");
    this.cyberFishFxCanvas.width = 384;
    this.cyberFishFxCanvas.height = 384;
    this.cyberFishFxCtx = this.cyberFishFxCanvas.getContext("2d", { alpha: true });
    
    // 環境制御変数
    this.lighting = 0.8;
    // PAKU: NATURAL only. This was "#00E5FF" (electric cyan) unconditionally - not
    // gated by themeMode at all - and gets screen-blended over the whole static
    // background/terrain layer, tinting it cyan regardless of theme.
    this.lightColor = "#FFF6E0";
    this.lightFlicker = 0.28; // 内部固定値。UIパラメータではない。
    this.lightDrop = 0;
    this.nextLightFlickerAt = 0;
    this.lightFlickerUntil = 0;
    this.lightFlickerSeed = Math.random() * 1000;
    this.lightPulse = 1.0;
    this.bubblerRate = 0.5;
    this.themeMode = (() => {
      try { return (localStorage.getItem("cyberAquariumTheme") || "dark") === "light" ? "light" : "dark"; }
      catch (_) { return "dark"; }
    })();

    // 描画キャッシュ。生態ロジックとは分離し、見た目の再計算だけを減らす。
    this.sortedPlants = [];
    this.terrainClipPath = null;
    this.lightLayerCanvas = null;
    this.lightLayerCtx = null;
    this.lightLayerKey = "";
    this.darkLayerEl = null;
    this.glowScale = 1.0;

    // 4K描画用レイヤー。解像度は落とさず、静的/低速描画をオフスクリーンへ分離する。
    this.pixelRatio = 1.0;
    this.dynamicPixelRatio = 1.0; // moving fish canvas may render slightly below native only at very high pixel counts
    this.staticLayerCanvas = null;
    this.staticLayerCtx = null;
    this.staticLayerDirty = true;
    // CYBER AIRを水草の奥へ通すため、水草本体だけを独立した静的レイヤーに分離する。
    this.staticPlantLayerCanvas = null;
    this.staticPlantLayerCtx = null;
    this.staticPlantLayerDirty = true;
    // v94: zoneごとの植物キャッシュをmain canvasへ合成し、魚を植物の前後へ挟み込む。
    this.plantZoneCanvases = { background:null, midground:null, foreground:null };
    this.plantZoneContexts = { background:null, midground:null, foreground:null };
    // Each botanical zone is cached only around its actual pixels, not as a full-tank bitmap.
    // This cuts the three per-frame plant drawImage transfers dramatically, especially at 4K.
    this.plantZoneBounds = { background:null, midground:null, foreground:null };
    this.plantZoneDirty = new Set(["background", "midground", "foreground"]);
    // v97: fullscreen/ResizeObserver can fire several times for one visual resize.
    // Coalesce those notifications and ignore identical dimensions so 4K plant caches are rebuilt once.
    this._resizeTimer = null;
    this._lastResizeWidth = 0;
    this._lastResizeHeight = 0;
    this._lastResizeDpr = 0;
    this._lastResizeFullscreen = false;
    // CYBERのデータ断片専用。背景より前、水草本体より後ろ。
    this.airLayerCanvas = null;
    this.airLayerCtx = null;
    this.airLayerPixelRatio = 1.0;
    this.lastCyberAirRender = 0;
    this.cyberAirRenderInterval = 1000 / 12; // AIR cache is background detail; fish remain 60fps.
    this.plantLayerCanvas = null;
    this.plantLayerCtx = null;
    this.plantLayerDirty = true;
    this.lastPlantLayerRender = 0;
    // 水草本体は静的焼き込み。動的レイヤーは葉先の信号だけ約6Hzで更新する。
    this.plantLayerInterval = 260;
    this.lastFlockUpdate = 0;
    this.flockInterval = 42; // 群泳判断は約24Hz。位置更新/描画はRAFごと。

    // 水景編集値は通常描画と分離して保持。編集モードOFF時の追加負荷はほぼゼロ。
    this.landscapeOverrides = this.loadLandscapeOverrides();

    // 生体・水草の表示構成。UIからON/OFFと個体数を変更できる。
    this.speciesConfig = this.createDefaultSpeciesConfig();

    // スケールファクター
    this.scale = 1.0;

    // 戦術スキャンモード変数
    this.scanModeActive = false;
    this.scanLaserY = 0;
    this.scanLaserDir = 1;
    this.scanAngle = 0;
    
    this.stats = {
      fps: 60,
      systemLoad: 12
    };

    this.lastTime = 0;
    this.frameCount = 0;
    this.fpsIntervalTime = 0;
    
    this.surfacePhase = 0;
    this.gravels = [];
    // 水槽内の穏やかな流れ方向。トランスルーセント群はこれに向かって定位する。
    this.glassCurrentDirection = Math.random() < 0.5 ? -1 : 1;
    // コリドラスの腸呼吸ダッシュは群れ全体で間欠的に発生させる。
    this.nextCoryAirDashAt = 45000 + Math.random() * 55000;

    // 初期描画サイズを同期的に確定。spawnPopulation()より前に必要。
    this.resizeCanvas();

    // windowリサイズ・フルスクリーンのレイアウト崩れ対策：ResizeObserverによる高精度監視
    this.resizeObserver = new ResizeObserver(() => {
      this.scheduleResize(70);
    });
    this.resizeObserver.observe(this.canvas.parentElement);
  }

  createDefaultSpeciesConfig() {
    // FAUNA defaults remain stable; v94 raises only the Red Bee Shrimp maximum to 30.
    const faunaDefaults = {
      "neon-tetra": 10,
      "glass-catfish": 6,
      "african-lampeye": 7,
      "rummynose-tetra": 8,
      "angelfish": 2,
      "guppy": 4,
      "molly": 3,
      "betta": 1,
      "corydoras": 6,
      "shrimp": 7
    };
    const faunaMax = {
      "neon-tetra": 30,
      "glass-catfish": 16,
      "african-lampeye": 24,
      "rummynose-tetra": 28,
      "angelfish": 6,
      "guppy": 18,
      "molly": 10,
      "betta": 3,
      "corydoras": 12,
      "shrimp": 30
    };

    // Curated plant defaults: enough structure to read as an aquascape,
    // while leaving the center sand open. Removed species stay absent from the selector.
    const floraDefaults = {
      hccuba: { enabled: true, count: 1 },
      montecarlo: { enabled: false, count: 0 },
      glossostigma: { enabled: false, count: 1 },
      "eleocharis-mini": { enabled: false, count: 1 },
      cryptoparva: { enabled: false, count: 1 },
      staurogyne: { enabled: false, count: 0 },
      lilaeopsis: { enabled: false, count: 0 },
      marsilea: { enabled: false, count: 1 },
      armini: { enabled: false, count: 0 },
      cryptowendtii: { enabled: false, count: 0 },
      anubias: { enabled: false, count: 0 },
      trident: { enabled: false, count: 2 },
      bolbitis: { enabled: false, count: 1 },
      echinodorus: { enabled: false, count: 1 },
      pogostemon: { enabled: false, count: 1 },
      rotala: { enabled: false, count: 1 },
      limnophila: { enabled: false, count: 0 },
      bacopa: { enabled: false, count: 0 },
      montevidensis: { enabled: false, count: 1 },
      myriophyllum: { enabled: false, count: 1 }
    };

    let savedV4 = {};
    let legacy = {};
    try { savedV4 = JSON.parse(localStorage.getItem("cyberAquariumSpeciesConfig_v4") || "{}"); } catch (_) {}
    // Migrate only FAUNA from the old stable key. Old plant IDs/layouts are deliberately ignored.
    try { legacy = JSON.parse(localStorage.getItem("cyberAquariumSpeciesConfig") || "{}"); } catch (_) {}

    const result = {};
    CYBER_SPECIES.forEach(sp => {
      if (sp.type === "fauna") {
        const defCount = faunaDefaults[sp.id] ?? 2;
        const max = faunaMax[sp.id] ?? 12;
        const savedEntry = savedV4[sp.id] || legacy[sp.id] || {};
        result[sp.id] = {
          enabled: savedEntry.enabled !== false,
          count: Math.max(1, Math.min(max, parseInt(savedEntry.count ?? defCount, 10) || defCount)),
          max
        };
        return;
      }

      const asset = (typeof window !== "undefined" && window.BotanicalEngine) ? window.BotanicalEngine.getAsset(sp.id) : null;
      const def = floraDefaults[sp.id] || { enabled: false, count: 1 };
      const savedEntry = savedV4[sp.id] || {};
      const max = asset?.placementStrategy === "scattered" ? (asset.maxCount || 4) : 1;
      result[sp.id] = {
        enabled: savedEntry.enabled !== undefined ? !!savedEntry.enabled : !!def.enabled,
        count: Math.max(1, Math.min(max, parseInt(savedEntry.count ?? def.count, 10) || def.count)),
        max
      };
    });
    return result;
  }

  saveSpeciesConfig() {
    try { localStorage.setItem("cyberAquariumSpeciesConfig_v4", JSON.stringify(this.speciesConfig)); }
    catch (_) {}
  }

  getSpeciesConfig(id) {
    return this.speciesConfig[id] || { enabled: true, count: 1, max: 12 };
  }

  createBotanicalLayoutPlan() {
    const plan = {};
    if (typeof window === "undefined" || !window.BotanicalEngine) return plan;
    const assets = window.BotanicalEngine.getPlantAssets ? window.BotanicalEngine.getPlantAssets() : window.BotanicalEngine.getAllAssets();
    const fallbackOffsets = [0.10, -0.10, 0.18, -0.18, 0.26, -0.26];

    assets.forEach(asset => {
      const strategy = asset.placementStrategy || "single";
      const d = asset.defaultLayout || {};
      if (strategy === "carpet") {
        const widthRatio = Number.isFinite(d.widthRatio) ? d.widthRatio : 0.24;
        const requestedX = Number.isFinite(d.xRatio) ? d.xRatio : 0.5;
        const entry = {
          strategy,
          xRatio: requestedX,
          widthRatio,
          density: Number.isFinite(d.density) ? d.density : 1.0
        };
        const bounds = this.getLandscapePlanXBounds(asset, entry);
        entry.xRatio = Math.max(bounds.min, Math.min(bounds.max, requestedX));
        plan[asset.id] = entry;
      } else if (strategy === "colony") {
        const widthRatio = Number.isFinite(d.widthRatio) ? d.widthRatio : 0.16;
        const requestedX = Number.isFinite(d.xRatio) ? d.xRatio : 0.5;
        const entry = {
          strategy,
          xRatio: requestedX,
          widthRatio,
          density: Number.isFinite(d.density) ? d.density : 1.0,
          // multiplier around the asset's own defaultScale (100% in UI)
          scale: 1.0
        };
        const bounds = this.getLandscapePlanXBounds(asset, entry);
        entry.xRatio = Math.max(bounds.min, Math.min(bounds.max, requestedX));
        plan[asset.id] = entry;
      } else if (strategy === "scattered") {
        const maxCount = Math.max(1, asset.maxCount || 4);
        const seeds = Array.isArray(d.instances) && d.instances.length ? d.instances : [{ xRatio: Number.isFinite(d.xRatio) ? d.xRatio : 0.5 }];
        const baseX = Number.isFinite(seeds[0]?.xRatio) ? seeds[0].xRatio : 0.5;
        const offsets = [0, -0.12, 0.12, -0.22, 0.22, -0.30, 0.30];
        const instances = [];
        for (let i = 0; i < maxCount; i++) {
          const xRatio = Math.max(0.035, Math.min(0.965, baseX + offsets[i % offsets.length]));
          const scale = i === 0 ? 1.0 : [0.94, 1.06, 0.90, 1.02][(i - 1) % 4];
          instances.push({ xRatio, scale });
        }
        plan[asset.id] = { strategy, instances };
      } else {
        plan[asset.id] = {
          strategy: "single",
          xRatio: Number.isFinite(d.xRatio) ? d.xRatio : 0.5,
          scale: 1.0
        };
      }
    });
    return plan;
  }

  getBotanicalXBounds(asset, scaleMultiplier = 1.0) {
    const tank = this.getTankBounds();
    if (!asset?.visibleBounds || !asset?.anchor) {
      return { min: 0.025, max: 0.975 };
    }
    const finalScale = Math.max(0.01, (asset.defaultScale || 1) * (scaleMultiplier || 1) * (this.scale || 1));
    const leftExtent = Math.max(0, asset.anchor.x - asset.visibleBounds.x) * finalScale;
    const rightExtent = Math.max(0, asset.visibleBounds.x + asset.visibleBounds.width - asset.anchor.x) * finalScale;
    const minX = tank.left + leftExtent;
    const maxX = tank.right - rightExtent;
    const denom = Math.max(1, this.drawWidth);
    if (maxX < minX) {
      const center = Math.max(0, Math.min(1, ((tank.left + tank.right) * 0.5) / denom));
      return { min: center, max: center };
    }
    return {
      min: Math.max(0, Math.min(1, minX / denom)),
      max: Math.max(0, Math.min(1, maxX / denom))
    };
  }

  clampBotanicalX(asset, xRatio, scaleMultiplier = 1.0) {
    const bounds = this.getBotanicalXBounds(asset, scaleMultiplier);
    return Math.max(bounds.min, Math.min(bounds.max, Math.max(0, Math.min(1, xRatio))));
  }


  getLandscapePlanXBounds(asset, plan, instanceScale = null) {
    if (!asset || !plan) return { min: 0.025, max: 0.975 };
    // Saved layout is loaded before resize() establishes the aquarium geometry.
    // Pixel-aware boundary checks are valid only after drawWidth/drawHeight exist.
    if (!Number.isFinite(this.drawWidth) || this.drawWidth <= 1 || !Number.isFinite(this.drawHeight) || this.drawHeight <= 1) {
      if (plan.strategy === "carpet" || plan.strategy === "colony") {
        const half = Math.max(0.025, Math.min(0.5, (plan.widthRatio || 0.1) * 0.5));
        return { min: half, max: 1 - half };
      }
      return { min: 0.025, max: 0.975 };
    }
    const tank = this.getTankBounds();
    const scale = this.scale || 1;
    if (plan.strategy === "single") {
      return this.getBotanicalXBounds(asset, plan.scale || 1);
    }
    if (plan.strategy === "scattered") {
      return this.getBotanicalXBounds(asset, instanceScale || 1);
    }
    if (plan.strategy === "carpet" || plan.strategy === "colony") {
      // WIDTH now means the complete visible field, including leaf tips and stem
      // curvature. BotanicalEngine insets the procedural roots by their true
      // horizontal excursion, so POSITION only needs to keep that visible field
      // inside the glass. For extremely narrow WIDTH, never allow less than one
      // plant's own natural horizontal reach.
      const requestedHalf = Math.max(
        plan.strategy === "carpet" ? 12 : 15,
        (plan.widthRatio || 0.1) * this.drawWidth * 0.5
      );
      const edgeInset = (window.BotanicalEngine?.getProceduralHorizontalInset)
        ? window.BotanicalEngine.getProceduralHorizontalInset(asset.id, this.scale || 1, plan.strategy === "colony" ? (plan.scale || 1) : 1.0)
        : 0;
      const visualHalf = Math.max(requestedHalf, edgeInset);
      const min = Math.max(0, Math.min(1, (tank.left + visualHalf) / Math.max(1, this.drawWidth)));
      const max = Math.max(0, Math.min(1, (tank.right - visualHalf) / Math.max(1, this.drawWidth)));
      if (max < min) {
        const center = ((tank.left + tank.right) * 0.5) / Math.max(1, this.drawWidth);
        return { min:center, max:center };
      }
      return { min, max };
    }
    return { min: 0.025, max: 0.975 };
  }

  clampLandscapeLayoutToTank() {
    if (!Number.isFinite(this.drawWidth) || this.drawWidth <= 1 || !Number.isFinite(this.drawHeight) || this.drawHeight <= 1) return;
    if (typeof window === "undefined" || !window.BotanicalEngine || !this.landscapeOverrides) return;
    const assets = window.BotanicalEngine.getPlantAssets ? window.BotanicalEngine.getPlantAssets() : window.BotanicalEngine.getAllAssets();
    for (const asset of assets) {
      const plan = this.landscapeOverrides[asset.id];
      if (!plan) continue;
      if (plan.strategy === "carpet" || plan.strategy === "colony") {
        const bounds = this.getLandscapePlanXBounds(asset, plan);
        if (Number.isFinite(plan.xRatio)) plan.xRatio = Math.max(bounds.min, Math.min(bounds.max, plan.xRatio));
      } else if (plan.strategy === "single") {
        if (Number.isFinite(plan.xRatio)) plan.xRatio = this.clampBotanicalX(asset, plan.xRatio, plan.scale || 1);
      } else if (plan.strategy === "scattered" && Array.isArray(plan.instances)) {
        for (const inst of plan.instances) {
          if (!inst || !Number.isFinite(inst.xRatio)) continue;
          inst.xRatio = this.clampBotanicalX(asset, inst.xRatio, inst.scale || 1);
        }
      }
    }
  }

  loadLandscapeOverrides() {
    const base = this.createBotanicalLayoutPlan();
    try {
      const raw = localStorage.getItem("cyberAquariumBotanicalLayout_v4");
      if (!raw) return base;
      const parsed = JSON.parse(raw);
      const saved = parsed && parsed.schemaVersion === 4 && parsed.plants && typeof parsed.plants === "object" ? parsed.plants : null;
      if (!saved) return base;

      Object.entries(base).forEach(([id, plan]) => {
        const p = saved[id];
        if (!p || p.strategy !== plan.strategy) return;
        // Respect the CURRENT asset limits when loading older saved layouts.
        // This matters when a species is rebalanced between versions (v96 lowers
        // Giant Hairgrass SIZE max); an old 160% value must not survive invisibly.
        const asset = (typeof window !== "undefined" && window.BotanicalEngine) ? window.BotanicalEngine.getAsset(id) : null;
        const assetDefault = Math.max(0.01, asset?.defaultScale || 1);
        const savedScaleMin = asset ? Math.max(0.35, (asset.minScale || assetDefault * 0.5) / assetDefault) : 0.4;
        const savedScaleMax = asset ? Math.min(2.0, (asset.maxScale || assetDefault * 1.6) / assetDefault) : 1.8;
        if (plan.strategy === "single") {
          if (Number.isFinite(p.xRatio)) plan.xRatio = Math.max(0.02, Math.min(0.98, p.xRatio));
          if (Number.isFinite(p.scale)) plan.scale = Math.max(savedScaleMin, Math.min(savedScaleMax, p.scale));
        } else if (plan.strategy === "carpet") {
          if (Number.isFinite(p.widthRatio)) plan.widthRatio = Math.max(0.05, Math.min(1.0, p.widthRatio));
          if (Number.isFinite(p.density)) plan.density = Math.max(0.3, Math.min(1.6, p.density));
          const requestedX = Number.isFinite(p.xRatio) ? p.xRatio : plan.xRatio;
          const bounds = this.getLandscapePlanXBounds(asset, plan);
          plan.xRatio = Math.max(bounds.min, Math.min(bounds.max, requestedX));
        } else if (plan.strategy === "colony") {
          if (Number.isFinite(p.widthRatio)) plan.widthRatio = Math.max(0.05, Math.min(1.0, p.widthRatio));
          if (Number.isFinite(p.density)) plan.density = Math.max(0.3, Math.min(1.6, p.density));
          if (Number.isFinite(p.scale)) plan.scale = Math.max(savedScaleMin, Math.min(savedScaleMax, p.scale));
          const requestedX = Number.isFinite(p.xRatio) ? p.xRatio : plan.xRatio;
          const bounds = this.getLandscapePlanXBounds(asset, plan);
          plan.xRatio = Math.max(bounds.min, Math.min(bounds.max, requestedX));
        } else if (plan.strategy === "scattered" && Array.isArray(p.instances)) {
          p.instances.forEach((inst, idx) => {
            if (!plan.instances[idx] || !inst) return;
            if (Number.isFinite(inst.xRatio)) plan.instances[idx].xRatio = Math.max(0.02, Math.min(0.98, inst.xRatio));
            if (Number.isFinite(inst.scale)) plan.instances[idx].scale = Math.max(savedScaleMin, Math.min(savedScaleMax, inst.scale));
          });
        }
      });
      return base;
    } catch (_) { return base; }
  }

  saveLandscapeOverrides() {
    try {
      localStorage.setItem("cyberAquariumBotanicalLayout_v4", JSON.stringify({ schemaVersion: 4, plants: this.landscapeOverrides || {} }));
    } catch (_) {}
  }

  getLandscapeOverride(key) {
    // Legacy v77 per-instance override API is intentionally disabled for the new botanical layout.
    return null;
  }

  getLandscapeEditableUnits() {
    const units = [];
    if (typeof window === "undefined" || !window.BotanicalEngine) return units;
    const assets = window.BotanicalEngine.getPlantAssets ? window.BotanicalEngine.getPlantAssets() : window.BotanicalEngine.getAllAssets();
    assets.forEach(asset => {
      const cfg = this.speciesConfig[asset.id];
      const plan = this.landscapeOverrides?.[asset.id];
      if (!cfg?.enabled || !plan) return;
      const sp = CYBER_SPECIES.find(item => item.id === asset.id);
      const displayName = (typeof NATURAL_SPECIES_NAMES !== "undefined" && NATURAL_SPECIES_NAMES[asset.id]) || sp?.scientificName || asset.id.toUpperCase();
      const controls = { ...(asset.controls || {}) };

      const minMul = Math.max(0.35, (asset.minScale || asset.defaultScale * 0.5) / Math.max(0.01, asset.defaultScale || 1));
      const maxMul = Math.min(2.0, (asset.maxScale || asset.defaultScale * 1.6) / Math.max(0.01, asset.defaultScale || 1));

      if (plan.strategy === "scattered") {
        const count = Math.max(1, Math.min(cfg.count || 1, plan.instances?.length || 1));
        for (let i = 0; i < count; i++) {
          const inst = plan.instances[i];
          if (!inst) continue;
          const xBounds = this.getBotanicalXBounds(asset, inst.scale || 1);
          const x = inst.xRatio * this.drawWidth;
          units.push({
            key: `scattered:${asset.id}:${i}`,
            speciesId: asset.id,
            strategy: "scattered",
            instanceIndex: i,
            zone: asset.zone,
            label: `${displayName} ${String(i + 1).padStart(2, "0")}`,
            controls,
            limits: { xMin:xBounds.min, xMax:xBounds.max, scaleMin:minMul, scaleMax:maxMul },
            xRatio: inst.xRatio,
            scale: inst.scale,
            x,
            y: this.getTerrainHeight(x)
          });
        }
        return;
      }

      let xMin = 0.025, xMax = 0.975;
      if (plan.strategy === "carpet" || plan.strategy === "colony") {
        const xBounds = this.getLandscapePlanXBounds(asset, plan);
        xMin = xBounds.min;
        xMax = xBounds.max;
      } else {
        const xBounds = this.getBotanicalXBounds(asset, plan.scale || 1);
        xMin = xBounds.min;
        xMax = xBounds.max;
      }
      const x = plan.xRatio * this.drawWidth;
      units.push({
        key: `${plan.strategy}:${asset.id}`,
        speciesId: asset.id,
        strategy: plan.strategy,
        zone: asset.zone,
        label: plan.strategy === "single" ? displayName : `${displayName} (${plan.strategy.toUpperCase()})`,
        controls,
        limits: { xMin, xMax, scaleMin:minMul, scaleMax:maxMul, widthMin:0.05, widthMax:1.0, densityMin:0.30, densityMax:1.60 },
        xRatio: plan.xRatio,
        scale: plan.scale,
        widthRatio: plan.widthRatio,
        density: plan.density,
        x,
        y: this.getTerrainHeight(x)
      });
    });

    const rank = { foreground: 0, midground: 1, background: 2 };
    return units.sort((a,b) => (rank[a.zone] ?? 1) - (rank[b.zone] ?? 1) || a.xRatio - b.xRatio);
  }

  updateLandscapeUnit(key, patch = {}, persist = true, refresh = true) {
    if (!key || !patch || typeof patch !== "object" || !window.BotanicalEngine) return null;
    const [strategy, speciesId, indexText] = key.split(":");
    const asset = window.BotanicalEngine.getAsset(speciesId);
    const plan = this.landscapeOverrides?.[speciesId];
    if (!asset || !plan || plan.strategy !== strategy) return null;

    const minMul = Math.max(0.35, (asset.minScale || asset.defaultScale * 0.5) / Math.max(0.01, asset.defaultScale || 1));
    const maxMul = Math.min(2.0, (asset.maxScale || asset.defaultScale * 1.6) / Math.max(0.01, asset.defaultScale || 1));

    if (strategy === "carpet" || strategy === "colony") {
      if (Number.isFinite(patch.widthRatio)) plan.widthRatio = Math.max(0.05, Math.min(1.0, patch.widthRatio));
      if (Number.isFinite(patch.density)) plan.density = Math.max(0.30, Math.min(1.60, patch.density));
      if (strategy === "colony" && Number.isFinite(patch.scale)) plan.scale = Math.max(minMul, Math.min(maxMul, patch.scale));
      const requestedX = Number.isFinite(patch.xRatio) ? patch.xRatio : plan.xRatio;
      const bounds = this.getLandscapePlanXBounds(asset, plan);
      plan.xRatio = Math.max(bounds.min, Math.min(bounds.max, requestedX));
    } else if (strategy === "single") {
      if (Number.isFinite(patch.scale)) plan.scale = Math.max(minMul, Math.min(maxMul, patch.scale));
      if (Number.isFinite(patch.xRatio)) plan.xRatio = this.clampBotanicalX(asset, patch.xRatio, plan.scale || 1);
    } else if (strategy === "scattered") {
      const idx = Number.parseInt(indexText, 10);
      if (!Number.isFinite(idx) || !plan.instances?.[idx]) return null;
      const inst = plan.instances[idx];
      if (Number.isFinite(patch.scale)) inst.scale = Math.max(minMul, Math.min(maxMul, patch.scale));
      if (Number.isFinite(patch.xRatio)) inst.xRatio = this.clampBotanicalX(asset, patch.xRatio, inst.scale || 1);
    }

    // During interactive editing, callers can defer the expensive vector/cache rebuild.
    // The layout data itself is updated immediately so handles/controls stay responsive.
    if (refresh) this.refreshPlantRenderCache(asset.zone || null);
    if (persist) this.saveLandscapeOverrides();
    if (strategy === "scattered") {
      const idx = Number.parseInt(indexText, 10);
      const inst = plan.instances?.[idx];
      if (!inst) return null;
      const bounds = this.getLandscapePlanXBounds(asset, plan, inst.scale || 1);
      return { key, speciesId, zone:asset.zone, xRatio:inst.xRatio, scale:inst.scale, x:inst.xRatio*this.drawWidth, y:this.getTerrainHeight(inst.xRatio*this.drawWidth), limits:{ xMin:bounds.min, xMax:bounds.max, scaleMin:minMul, scaleMax:maxMul } };
    }
    const bounds = this.getLandscapePlanXBounds(asset, plan);
    return { key, speciesId, zone:asset.zone, xRatio:plan.xRatio, scale:plan.scale, widthRatio:plan.widthRatio, density:plan.density, x:plan.xRatio*this.drawWidth, y:this.getTerrainHeight(plan.xRatio*this.drawWidth), limits:{ xMin:bounds.min, xMax:bounds.max, scaleMin:minMul, scaleMax:maxMul, widthMin:0.05, widthMax:1.0, densityMin:0.30, densityMax:1.60 } };
  }

  commitLandscapeEdit(key = null, persist = true) {
    // One expensive rebuild after a drag/slider gesture, never on every pointermove/input.
    // Rebuild only the botanical depth zone touched by the edit.
    let zone = null;
    if (key && window.BotanicalEngine) {
      const speciesId = String(key).split(":")[1];
      zone = window.BotanicalEngine.getAsset(speciesId)?.zone || null;
    }
    this.refreshPlantRenderCache(zone);
    this.fishes.forEach(f => { if (f.id === "shrimp") f.shrimpGrazeTarget = null; });
    if (persist) this.saveLandscapeOverrides();
  }

  resetLandscapeLayout() {
    this.landscapeOverrides = this.createBotanicalLayoutPlan();
    try { localStorage.removeItem("cyberAquariumBotanicalLayout_v4"); } catch (_) {}
    this.saveLandscapeOverrides();
    this.refreshPlantRenderCache();
    this.fishes.forEach(f => { if (f.id === "shrimp") f.shrimpGrazeTarget = null; });
    return this.getLandscapeEditableUnits();
  }

  createLandscapePlan() {
    // 初期景観は作品として成立する配置を固定し、Seedは木肌・葉形など微細差だけに使う。
    const seed = this.landscapeSeed >>> 0;
    const rng = landscapeRng(seed);
    const centers = {
      // FG: 中央のコリドラス用オープンサンドを残し、左右と素材際だけ低草。
      "eleocharis-mini": [0.085, 0.245, 0.895],
      // BG: 両端に高さを集め、中央を泳ぐ空間として抜く。
      "vallisneria": [0.055, 0.115, 0.885, 0.945],
      "amazon-sword": [0.825, 0.175]
    };
    const terrain = {
      phase1: this._landR(rng, 0, Math.PI*2),
      phase2: this._landR(rng, 0, Math.PI*2),
      wave1: this._landR(rng, 0.45, 0.85),
      wave2: this._landR(rng, 0.18, 0.42),
      focusLift: 0,
      focusWidth: 0.16,
      secondaryLift: 0,
      secondaryWidth: 0.16
    };
    this.landscapePlan = {
      seed,
      archetype: "curated-epiphyte-wood",
      focus: 0.31,
      secondary: 0.76,
      woodLean: 1,
      driftwoods: [],
      centers,
      rocks: [],
      terrain
    };
    return this.landscapePlan;
  }

  _landR(rng, min, max) { return min + rng() * (max - min); }

  getLandscapePlantSlot(id, index = 0) {
    if (!this.landscapePlan) this.createLandscapePlan();
    const plan = this.landscapePlan;
    const centers = plan.centers[id] || [0.5];
    const seed = (plan.seed ^ landscapeHash(id) ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
    const rng = landscapeRng(seed);
    const center = centers[index % centers.length];
    const jitter = 0.018;
    let xRatio = Math.max(0.035, Math.min(0.965, center + (rng()-0.5)*jitter*2));
    let clusterScale = 0.94 + rng()*0.10;
    if (id === "amazon-sword" && index > 0) clusterScale *= 0.72;
    if (id === "vallisneria") clusterScale *= 0.92;
    if (id === "eleocharis-mini") clusterScale *= 0.82;
    const layoutKey = `plant:${id}:${index}`;
    const override = this.getLandscapeOverride(layoutKey);
    if (override) {
      if (Number.isFinite(override.xRatio)) xRatio = Math.max(0.025, Math.min(0.975, override.xRatio));
      if (Number.isFinite(override.scale)) clusterScale = Math.max(0.52, Math.min(1.65, override.scale));
    }
    const zone = id === "eleocharis-mini" ? "foreground" : (["vallisneria"].includes(id) ? "background" : "midground");
    return { xRatio, anchorLift:0, rotation:(rng()-0.5)*0.04, clusterScale, seed, layoutKey, zone };
  }

  getEpiphyteDensity(id) {
    const cfg = this.getSpeciesConfig(id);
    if (!cfg.enabled) return 0;
    const count = Math.max(1, cfg.count || 1);
    return Math.min(1.24, 0.72 + Math.log2(count + 1) * 0.16);
  }

  rebuildEpiphyteUnits() {
    const a = this.getEpiphyteDensity("anubias");
    const m = this.getEpiphyteDensity("microsorum");
    const moss = this.getEpiphyteDensity("java-moss");
    const any = a > 0 || m > 0 || moss > 0;
    this.epiphyteUnits = [];
    if (!any) return;

    // 主役の完成流木。三種を均等に散らさず、根元・背面・枝先へ役割分担する。
    {
      const key = "wood:main";
      const ov = this.getLandscapeOverride(key) || {};
      this.epiphyteUnits.push(new CyberEpiphyteWoodUnit({
        type:"mixed", xRatio:Number.isFinite(ov.xRatio)?ov.xRatio:0.305, scale:Number.isFinite(ov.scale)?ov.scale:1.02, lean:1, seed:(this.landscapeSeed ^ 0x2468ace1)>>>0,
        layoutKey:key, zone:"midground", displayLabel:"MAIN EPIPHYTE WOOD"
      }, { anubias:a, microsorum:m, "java-moss":moss }));
    }

    // 右側は低く抑え、中央の砂場を塞がない。モス優先、なければアヌビアス／ミクロソリウム。
    let secondaryType = moss > 0 ? "moss" : (a > 0 ? "anubias" : "microsorum");
    {
      const key = "wood:secondary";
      const ov = this.getLandscapeOverride(key) || {};
      this.epiphyteUnits.push(new CyberEpiphyteWoodUnit({
        type:secondaryType, xRatio:Number.isFinite(ov.xRatio)?ov.xRatio:0.755, scale:Number.isFinite(ov.scale)?ov.scale:0.64, lean:-1, seed:(this.landscapeSeed ^ 0x13579bdf)>>>0,
        layoutKey:key, zone:"midground", displayLabel:"SECONDARY EPIPHYTE WOOD"
      }, {
      anubias: secondaryType === "anubias" ? a*0.82 : 0,
      microsorum: secondaryType === "microsorum" ? m*0.80 : 0,
      "java-moss": secondaryType === "moss" ? moss*0.88 : 0
      }));
    }

    const terrain=(x)=>this.getTerrainHeight(x);
    this.epiphyteUnits.forEach(u=>u.updatePosition(this.drawWidth,this.drawHeight,terrain));
  }

  spawnHardscape() {
    this.driftwoods = [];
    this.obstacles = [];
    this.epiphyteUnits = [];
  }

  setSpeciesEnabled(id, enabled) {
    if (!this.speciesConfig[id]) return;
    const cfg = this.speciesConfig[id];
    const previousEnabled = !!cfg.enabled;
    cfg.enabled = !!enabled;
    this.saveSpeciesConfig();
    this.syncSpeciesPopulation(id);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("aquarium-landscape-units-change", {
        detail: {
          action: "enabled",
          speciesId: id,
          enabled: cfg.enabled,
          previousEnabled,
          count: cfg.count
        }
      }));
    }
  }

  setSpeciesCount(id, count) {
    if (!this.speciesConfig[id]) return;
    const cfg = this.speciesConfig[id];
    const previousCount = cfg.count;
    cfg.count = Math.max(1, Math.min(cfg.max, parseInt(count, 10) || 1));
    this.saveSpeciesConfig();
    this.syncSpeciesPopulation(id);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("aquarium-landscape-units-change", {
        detail: {
          action: "count",
          speciesId: id,
          enabled: !!cfg.enabled,
          previousCount,
          count: cfg.count
        }
      }));
    }
  }

  getEcologyProfile(id) {
    return ECOLOGY_PROFILES[id] || ECOLOGY_PROFILES["neon-tetra"];
  }

  _pickWeightedBand(profile, allowed = null) {
    const bands = allowed && allowed.length ? allowed : profile.bands;
    let total = 0;
    const weighted = bands.map(b => {
      const idx = profile.bands.indexOf(b);
      const w = Math.max(0.001, profile.weights[idx] || 0.001);
      total += w;
      return [b, w];
    });
    let r = Math.random() * total;
    for (const [b,w] of weighted) {
      r -= w;
      if (r <= 0) return b;
    }
    return weighted[weighted.length - 1][0];
  }

  getDepthBoundaryZone(a, b) {
    const low = Math.min(a, b);
    if (low === 0) return "background";
    if (low === 1) return "midground";
    if (low === 2) return "foreground";
    return null;
  }

  getPlantBarrierAt(zone, x, pad = 0) {
    if (!window.BotanicalEngine) return { covered:false, topY:Infinity, source:null };
    const assets = window.BotanicalEngine.getPlantAssets ? window.BotanicalEngine.getPlantAssets() : window.BotanicalEngine.getAllAssets();
    let covered = false;
    let topY = Infinity;
    let source = null;
    const scale = this.scale || 1;
    const carpetHeights = {
      hccuba:18, montecarlo:25, glossostigma:28, "eleocharis-mini":68, lilaeopsis:96,
      staurogyne:72, cryptoparva:62, armini:78, marsilea:48
    };

    const hitSpan = (asset, centerX, halfWidth, plantScale = 1) => {
      if (x + pad < centerX - halfWidth || x - pad > centerX + halfWidth) return;
      covered = true;
      const terrain = this.getTerrainHeight(Math.max(0, Math.min(this.drawWidth, x)));
      let height;
      if (asset.zone === "foreground" && carpetHeights[asset.id]) {
        height = carpetHeights[asset.id] * scale * Math.max(0.72, plantScale);
      } else {
        height = Math.max(24 * scale, asset.visibleBounds.height * asset.defaultScale * plantScale * scale * 0.82);
      }
      const candidateTop = terrain - height;
      if (candidateTop < topY) {
        topY = candidateTop;
        source = asset.id;
      }
    };

    for (const asset of assets) {
      if (asset.zone !== zone) continue;
      const cfg = this.speciesConfig[asset.id];
      const plan = this.landscapeOverrides?.[asset.id];
      if (!cfg?.enabled || !plan) continue;

      if (plan.strategy === "carpet" || plan.strategy === "colony") {
        const centerX = (plan.xRatio ?? 0.5) * this.drawWidth;
        const half = Math.max(8 * scale, (plan.widthRatio ?? 0.1) * this.drawWidth * 0.5);
        hitSpan(asset, centerX, half, plan.scale || 1);
      } else if (plan.strategy === "scattered") {
        const count = Math.min(cfg.count || 1, plan.instances?.length || 0);
        for (let i=0;i<count;i++) {
          const inst = plan.instances[i];
          if (!inst) continue;
          const sc = inst.scale || 1;
          const half = Math.max(12 * scale, asset.visibleBounds.width * asset.defaultScale * sc * scale * 0.36);
          hitSpan(asset, inst.xRatio * this.drawWidth, half, sc);
        }
      } else {
        const sc = plan.scale || 1;
        const half = Math.max(16 * scale, asset.visibleBounds.width * asset.defaultScale * sc * scale * 0.38);
        hitSpan(asset, (plan.xRatio ?? 0.5) * this.drawWidth, half, sc);
      }
    }
    return { covered, topY, source };
  }

  findDepthPassage(zone, fish) {
    const tank = this.getTankBounds();
    const radius = Math.max(8 * this.scale, fish.size * fish.depthScale * this.scale * 0.55);
    const samples = 34;
    let bestGap = null;
    let bestGapScore = Infinity;
    let bestLowCanopy = null;
    for (let i=0;i<=samples;i++) {
      const x = tank.left + (tank.right - tank.left) * (i / samples);
      const barrier = this.getPlantBarrierAt(zone, x, radius * 0.55);
      if (!barrier.covered) {
        const score = Math.abs(x - fish.pos.x);
        if (score < bestGapScore) { bestGapScore = score; bestGap = { x, y:fish.pos.y, over:false }; }
      } else {
        const dist = Math.abs(x - fish.pos.x);
        if (!bestLowCanopy || barrier.topY > bestLowCanopy.topY + 0.5 ||
            (Math.abs(barrier.topY - bestLowCanopy.topY) <= 0.5 && dist < bestLowCanopy.dist)) {
          bestLowCanopy = { x, topY:barrier.topY, dist };
        }
      }
    }
    if (bestGap) return bestGap;
    if (bestLowCanopy) {
      return { x:bestLowCanopy.x, y:Math.max(tank.top + radius, bestLowCanopy.topY - radius * 0.85), over:true };
    }
    return { x:fish.pos.x, y:fish.pos.y, over:false };
  }

  findShelterX(zone, fish) {
    const tank = this.getTankBounds();
    const radius = Math.max(7*this.scale, fish.size * fish.depthScale * this.scale * 0.45);
    let best = null, bestScore = Infinity;
    const samples = 28;
    for (let i=0;i<=samples;i++) {
      const x = tank.left + (tank.right - tank.left) * (i/samples);
      const barrier = this.getPlantBarrierAt(zone, x, radius*0.35);
      // Fish must actually fit vertically behind the vegetation, not merely overlap its x range.
      if (!barrier.covered || fish.pos.y < barrier.topY + radius*0.15) continue;
      const score = Math.abs(x - fish.pos.x);
      if (score < bestScore) { bestScore = score; best = x; }
    }
    return best;
  }

  isDepthCrossingClear(fish, zone) {
    if (!zone) return true;
    const radius = Math.max(7 * this.scale, fish.size * fish.depthScale * this.scale * 0.52);
    const barrier = this.getPlantBarrierAt(zone, fish.pos.x, radius * 0.62);
    if (!barrier.covered) return true;
    return fish.pos.y + radius * 0.34 < barrier.topY;
  }

  updateFishDepthBehavior(fish, now) {
    const profile = this.getEcologyProfile(fish.id);
    if (!profile) return;

    if (fish.id === "corydoras" || fish.id === "shrimp") {
      fish.depthBandIndex = 4;
      fish.depthTargetBandIndex = 4;
      fish.depthLayer = "benthic";
      const b = ECO_DEPTH_BANDS[4];
      fish.depthScale += (b.scale - fish.depthScale) * 0.10;
      fish.depthAlpha += (b.alpha - fish.depthAlpha) * 0.10;
      fish.depthSpeed += (b.speed - fish.depthSpeed) * 0.10;
      return;
    }

    if (!fish.depthNextShiftAt) {
      fish.depthNextShiftAt = now + profile.shift[0] + Math.random() * (profile.shift[1] - profile.shift[0]);
    }

    if (fish.depthTargetBandIndex === fish.depthBandIndex && now >= fish.depthNextShiftAt) {
      const adjacent = profile.bands.filter(b => b !== fish.depthBandIndex && Math.abs(b - fish.depthBandIndex) <= 1);
      const pool = adjacent.length ? adjacent : profile.bands.filter(b => b !== fish.depthBandIndex);
      if (pool.length) fish.depthTargetBandIndex = this._pickWeightedBand(profile, pool);
      fish.depthNextShiftAt = now + profile.shift[0] + Math.random() * (profile.shift[1] - profile.shift[0]);
      fish.depthPassageX = null;
      fish.depthPassageY = null;
      fish.depthCrossingZone = this.getDepthBoundaryZone(fish.depthBandIndex, fish.depthTargetBandIndex);
    }

    if (fish.depthTargetBandIndex !== fish.depthBandIndex) {
      const zone = fish.depthCrossingZone || this.getDepthBoundaryZone(fish.depthBandIndex, fish.depthTargetBandIndex);
      if (this.isDepthCrossingClear(fish, zone)) {
        fish.depthBandIndex += Math.sign(fish.depthTargetBandIndex - fish.depthBandIndex);
        fish.depthLayer = ECO_DEPTH_BANDS[fish.depthBandIndex].id;
        fish.depthPassageX = null;
        fish.depthPassageY = null;
        fish.depthCrossingZone = fish.depthBandIndex === fish.depthTargetBandIndex ? null : this.getDepthBoundaryZone(fish.depthBandIndex, fish.depthTargetBandIndex);
      } else {
        if (!Number.isFinite(fish.depthPassageX) || !Number.isFinite(fish.depthPassageY)) {
          const passage = this.findDepthPassage(zone, fish);
          fish.depthPassageX = passage.x;
          fish.depthPassageY = passage.y;
        }
        const waypoint = new Vector(fish.depthPassageX, fish.depthPassageY);
        const steer = fish.seek(waypoint).mult(fish.id === "angelfish" ? 1.28 : 1.12);
        fish.applyForce(steer);
        if (Math.abs(fish.depthPassageX - fish.pos.x) < 16 * this.scale && Math.abs(fish.depthPassageY - fish.pos.y) < 16 * this.scale) {
          // Re-evaluate in case plant layout changed while the fish was travelling.
          fish.depthPassageX = null;
          fish.depthPassageY = null;
        }
      }
    }

    // 臆病な魚は奥側へ入った時、実際に葉で隠れる位置へゆっくり寄る。
    if (profile.shelter >= 0.68 && fish.depthTargetBandIndex === fish.depthBandIndex && fish.depthBandIndex <= 1) {
      if (!fish.nextShelterSeekAt || now >= fish.nextShelterSeekAt) {
        const zone = fish.depthBandIndex === 0 ? "background" : "midground";
        fish.shelterTargetX = this.findShelterX(zone, fish);
        fish.nextShelterSeekAt = now + 2600 + Math.random()*5200;
      }
      if (Number.isFinite(fish.shelterTargetX)) {
        const dx = fish.shelterTargetX - fish.pos.x;
        if (Math.abs(dx) > 14*this.scale) {
          const amount = fish.id === "glass-catfish" ? 0.34 : 0.20;
          fish.applyForce(new Vector(Math.sign(dx) * fish.maxForce * amount, 0));
        }
      }
    }

    const visual = ECO_DEPTH_BANDS[fish.depthBandIndex] || ECO_DEPTH_BANDS[2];
    fish.depthScale += (visual.scale - fish.depthScale) * 0.035;
    fish.depthAlpha += (visual.alpha - fish.depthAlpha) * 0.035;
    fish.depthSpeed += (visual.speed - fish.depthSpeed) * 0.035;
  }

  updateShrimpThreats(timestamp) {
    const shrimps = this.fishes.filter(f => f.id === "shrimp");
    if (!shrimps.length) return;
    const scale = this.scale || 1;
    const threats = this.fishes.filter(f => f.id !== "shrimp" && f.id !== "corydoras");
    for (const shrimp of shrimps) {
      if (timestamp < (shrimp.shrimpEscapeCooldownUntil || 0) || shrimp.shrimpEscapeUntil > timestamp) continue;
      let closest = null, bestSq = Infinity, reaction = 0;
      for (const fish of threats) {
        // A fish hidden behind background/midground vegetation should not scare a
        // foreground shrimp merely because its 2D projection overlaps.
        const zFactor = fish.depthBandIndex >= 3 ? 1.0 : (fish.depthBandIndex === 2 ? 0.58 : (fish.depthBandIndex === 1 ? 0.18 : 0));
        if (zFactor <= 0) continue;
        const weight = fish.id === "angelfish" ? 1.65 : (fish.id === "betta" ? 1.15 : (fish.size >= 14 ? 0.92 : 0.58));
        const d2 = shrimp.pos.distSq(fish.pos);
        const range = (fish.id === "angelfish" ? 118 : (fish.id === "betta" ? 76 : 58)) * scale * weight * zFactor;
        const rangeSq = range * range;
        if (d2 < rangeSq && d2 < bestSq) { closest = fish; bestSq = d2; reaction = weight * zFactor; }
      }
      if (!closest) continue;
      const away = shrimp.pos.x >= closest.pos.x ? 1 : -1;
      const desiredX = shrimp.pos.x + away * (48 + Math.random() * 72) * scale;
      const target = this.getShrimpGrazePoint({ x:desiredX, y:shrimp.pos.y }, true);
      shrimp.shrimpEscapeTarget = {
        x: Math.max(this.getTankBounds().left + 8*scale, Math.min(this.getTankBounds().right - 8*scale, target.x)),
        y: Math.max(this.getTankBounds().top + 12*scale, target.y - (8 + Math.random()*18) * scale)
      };
      shrimp.shrimpEscapeUntil = timestamp + 520 + Math.random() * 480 + reaction * 120;
      shrimp.shrimpEscapeCooldownUntil = timestamp + 2500 + Math.random() * 3600;
      shrimp.shrimpGrazeTarget = null;
      shrimp.shrimpState = "escape";
      shrimp.shrimpDir = away;
    }
  }

  updateCoryAirDash(timestamp) {
    if (timestamp < this.nextCoryAirDashAt) return;
    const corys = this.fishes.filter(f => f.id === "corydoras" && (!f.coryAirState || f.coryAirState === "bottom"));
    if (!corys.length) {
      this.nextCoryAirDashAt = timestamp + 45000;
      return;
    }
    const fish = corys[Math.floor(Math.random() * corys.length)];
    const tank = this.getTankBounds();
    fish.coryAirState = "ascent";
    // Keep the fish's current facing for the whole trip; choose a modest diagonal
    // drift in that same direction rather than steering toward a random X target.
    fish.coryAirFacing = fish.facing || (Math.random() < 0.5 ? -1 : 1);
    // If the current heading would immediately hit a side wall, choose the inward
    // direction once at take-off, then keep it locked for the entire breath cycle.
    const sideMargin = 140 * this.scale;
    if (fish.coryAirFacing < 0 && fish.pos.x < tank.left + sideMargin) fish.coryAirFacing = 1;
    if (fish.coryAirFacing > 0 && fish.pos.x > tank.right - sideMargin) fish.coryAirFacing = -1;
    fish.facing = fish.coryAirFacing;
    fish.coryAirPitch = 0.88 + Math.random() * 0.08;
    fish.coryAirVx = fish.coryAirFacing * (0.58 + Math.random() * 0.28) * this.scale;
    fish.coryAirTargetX = Math.max(tank.left + 18*this.scale, Math.min(tank.right - 18*this.scale, fish.pos.x + fish.coryAirFacing * (38 + Math.random()*52) * this.scale));
    fish.coryState = "forage";
    // 群れ全体では約1〜2.5分に1回。複数匹がいる水槽で「たまに見える」頻度。
    this.nextCoryAirDashAt = timestamp + 70000 + Math.random() * 85000;
  }

  getShrimpGrazePoint(referencePos = null, preferPlants = false) {
    const tank = this.getTankBounds();
    const scale = this.scale || 1;
    const candidates = [];
    const add = (x, y, source, weight = 1) => {
      for (let i = 0; i < weight; i++) candidates.push({ x, y, source });
    };

    if (typeof window !== "undefined" && window.BotanicalEngine) {
      const assets = window.BotanicalEngine.getPlantAssets ? window.BotanicalEngine.getPlantAssets() : window.BotanicalEngine.getAllAssets();
      const grazeWeight = {
        hccuba:10, glossostigma:9, montecarlo:7, "eleocharis-mini":5, lilaeopsis:4,
        staurogyne:4, cryptoparva:3, armini:3, marsilea:3
      };
      assets.forEach(asset => {
        const cfg = this.speciesConfig[asset.id];
        const plan = this.landscapeOverrides?.[asset.id];
        if (!cfg?.enabled || !plan) return;
        const baseWeight = grazeWeight[asset.id] || (asset.zone === "foreground" ? 2 : 1);
        if (plan.strategy === "scattered") {
          const count = Math.min(cfg.count || 1, plan.instances?.length || 0);
          for (let i = 0; i < count; i++) {
            const x = plan.instances[i].xRatio * this.drawWidth;
            add(x, this.getTerrainHeight(x) - 7 * scale, asset.id, baseWeight);
          }
        } else if (plan.strategy === "carpet" || plan.strategy === "colony") {
          // WIDTHの中から採餌点を作る。特にHC Cuba/Glossostigmaは広い絨毯全体を使う。
          const center = plan.xRatio * this.drawWidth;
          const half = Math.max(12*scale, (plan.widthRatio || 0.1) * this.drawWidth * 0.5);
          const sampleCount = Math.max(3, Math.min(9, Math.round(3 + (plan.widthRatio || 0.1) * 10)));
          for (let i=0;i<sampleCount;i++) {
            const t = sampleCount > 1 ? i/(sampleCount-1) : 0.5;
            const x = Math.max(tank.left+8*scale, Math.min(tank.right-8*scale, center - half + t*half*2));
            add(x, this.getTerrainHeight(x) - 7 * scale, asset.id, baseWeight);
          }
        } else {
          const x = plan.xRatio * this.drawWidth;
          add(x, this.getTerrainHeight(x) - 8 * scale, asset.id, baseWeight);
        }
      });
    }

    if (candidates.length && (preferPlants || Math.random() < 0.97)) {
      let pool = candidates;
      if (referencePos) {
        const near = candidates.filter(p => Math.abs(p.x - referencePos.x) < 190 * scale);
        if (near.length) pool = near;
      }
      const p = pool[Math.floor(Math.random() * pool.length)];
      const x = Math.max(tank.left + 8 * scale, Math.min(tank.right - 8 * scale, p.x + (Math.random() - 0.5) * 14 * scale));
      const floor = this.getTerrainHeight(x);
      const y = Math.max(tank.top + 10 * scale, Math.min(floor - 2 * scale, p.y + (Math.random() - 0.5) * 9 * scale));
      return { x, y, source: p.source };
    }

    const baseX = referencePos ? referencePos.x : tank.left + Math.random() * (tank.right - tank.left);
    const x = Math.max(tank.left + 10 * scale, Math.min(tank.right - 10 * scale, baseX + (Math.random() - 0.5) * 150 * scale));
    return { x, y: this.getTerrainHeight(x) - 4 * scale, source: "substrate" };
  }

  spawnFish(sp) {
    const tank = this.getTankBounds();
    const startDepth = {
      "african-lampeye": 0.16,
      "guppy": 0.28,
      "glass-catfish": 0.42,
      "rummynose-tetra": 0.48,
      "angelfish": 0.47,
      "molly": 0.34,
      "betta": 0.30,
      "neon-tetra": 0.45,
      "corydoras": 0.82,
      "shrimp": 0.88
    };
    let spawnX = tank.left + 28 * this.scale + Math.random() * Math.max(1, (tank.right - tank.left) - 56 * this.scale);
    // トランスルーセントは最初から散らさず、群れとしてまとまって配置する。
    if (sp.id === "glass-catfish") {
      const center = tank.left + (tank.right - tank.left) * 0.48;
      spawnX = center + (Math.random() - 0.5) * (tank.right - tank.left) * 0.16;
    }
    const floorY = this.getTerrainHeight(spawnX) - 20 * this.scale;
    const ratio = startDepth[sp.id] ?? 0.42;
    const jitter = (Math.random() - 0.5) * (sp.id === "glass-catfish" ? 0.08 : 0.18);
    let spawnY = tank.top + (floorY - tank.top) * Math.max(0.08, Math.min(0.82, ratio + jitter));
    if (sp.id === "corydoras") spawnY = this.getTerrainHeight(spawnX) - 8 * this.scale;
    if (sp.id === "shrimp") spawnY = this.getTerrainHeight(spawnX) - 5 * this.scale;
    const fish = new CyberFish(spawnX, spawnY, sp);
    // 初期生成の1フレーム目から底生生物を砂へ埋めない。
    if (sp.id === "corydoras") fish.pos.y = this.getTerrainHeight(spawnX) - Math.max(7.4 * this.scale, fish.size * fish.depthScale * 0.55 * this.scale);
    if (sp.id === "shrimp") fish.pos.y = this.getTerrainHeight(spawnX) - Math.max(4.5 * this.scale, fish.size * fish.depthScale * 0.50 * this.scale);
    if (sp.id === "glass-catfish") {
      fish.facing = this.glassCurrentDirection;
      fish.vel = new Vector(this.glassCurrentDirection * 0.08, (Math.random() - 0.5) * 0.025);
    }
    return fish;
  }

  spawnPlant(sp, index = 0) {
    if (["anubias","microsorum","java-moss"].includes(sp.id)) return null;
    const slot = this.getLandscapePlantSlot(sp.id, index);
    const plant = new CyberPlant(slot.xRatio, sp, slot);
    plant.updatePosition(this.drawWidth, this.drawHeight, (x) => this.getTerrainHeight(x));
    return plant;
  }

  syncSpeciesPopulation(id) {
    const sp = CYBER_SPECIES.find(item => item.id === id);
    if (!sp) return;
    const cfg = this.getSpeciesConfig(id);
    const target = cfg.enabled ? cfg.count : 0;

    if (sp.type === "fauna") {
      let current = this.fishes.filter(f => f.id === id).length;
      if (current > target) {
        let remove = current - target;
        this.fishes = this.fishes.filter(f => f.id !== id || remove-- <= 0);
      } else {
        while (current < target) {
          this.fishes.push(this.spawnFish(sp));
          current++;
        }
      }
    } else {
      this.refreshPlantRenderCache();
      this.fishes.forEach(f => { if (f.id === "shrimp") f.shrimpGrazeTarget = null; });
    }

    const asset = sp.type === "flora" && window.BotanicalEngine ? window.BotanicalEngine.getAsset(id) : null;
    const label = sp.type === "flora" && asset?.placementStrategy !== "scattered" ? (cfg.enabled ? "VISIBLE" : "HIDDEN") : (cfg.enabled ? `${target} NODE(S)` : "HIDDEN");
    this.logEvent("USER", `${sp.name}: ${label}`);
  }

  refreshPlantRenderCache(zone = null) {
    this.sortedPlants = this.plants.slice().sort((a, b) => a.layer - b.layer);
    // Plant edits do not change water/background/substrate, so do not invalidate staticLayer.
    this.staticPlantLayerDirty = true;
    this.plantLayerDirty = true;
    if (zone && this.plantZoneDirty) this.plantZoneDirty.add(zone);
    else if (this.plantZoneDirty) {
      this.plantZoneDirty.add("background");
      this.plantZoneDirty.add("midground");
      this.plantZoneDirty.add("foreground");
    }
  }

  rebuildTerrainClipPath() {
    if (typeof Path2D === "undefined") {
      this.terrainClipPath = null;
      return;
    }
    const tank = this.getTankBounds();
    const path = new Path2D();
    path.moveTo(tank.left, tank.top);
    path.lineTo(tank.right, tank.top);
    // 地形は静的なので、毎フレーム96点作る必要はない。
    const steps = 56;
    for (let i = steps; i >= 0; i--) {
      const x = tank.left + (tank.right - tank.left) * (i / steps);
      path.lineTo(x, this.getTerrainHeight(x));
    }
    path.closePath();
    this.terrainClipPath = path;
  }

  ensureLayerCanvas(kind) {
    const specs = {
      static: { canvas: "staticLayerCanvas", ctx: "staticLayerCtx", z: "0" },
      staticPlant: { canvas: "staticPlantLayerCanvas", ctx: "staticPlantLayerCtx", z: "1.5" },
      plant: { canvas: "plantLayerCanvas", ctx: "plantLayerCtx", z: "3" }
    };
    const spec = specs[kind] || specs.plant;
    const prop = spec.canvas;
    const ctxProp = spec.ctx;
    if (!this[prop]) {
      const layer = document.createElement("canvas");
      layer.className = `aquarium-render-layer aquarium-${kind}-layer`;
      layer.setAttribute("aria-hidden", "true");
      layer.style.position = "absolute";
      layer.style.inset = "0";
      layer.style.width = "100%";
      layer.style.height = "100%";
      layer.style.pointerEvents = "none";
      layer.style.zIndex = spec.z;
      this.canvas.parentElement.insertBefore(layer, this.canvas);
      this[prop] = layer;
      this[ctxProp] = layer.getContext("2d", { alpha: true });
    }
    const pw = Math.max(1, Math.round(this.drawWidth * this.pixelRatio));
    const ph = Math.max(1, Math.round(this.drawHeight * this.pixelRatio));
    if (this[prop].width !== pw || this[prop].height !== ph) {
      this[prop].width = pw;
      this[prop].height = ph;
      this[ctxProp].setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
      if (kind === "static") this.staticLayerDirty = true;
      else if (kind === "staticPlant") this.staticPlantLayerDirty = true;
      else this.plantLayerDirty = true;
    }
    return this[ctxProp];
  }

  ensureAirLayer() {
    if (!this.airLayerCanvas) {
      // AIR keeps its own LOW-resolution backing store and is composited as a plain
      // DOM layer. This avoids scaling/copying the AIR bitmap into the main fish
      // canvas every frame while also avoiding the old full-resolution AIR layer.
      this.airLayerCanvas = document.createElement("canvas");
      this.airLayerCanvas.className = "aquarium-render-layer aquarium-air-lowres-layer";
      this.airLayerCanvas.setAttribute("aria-hidden", "true");
      Object.assign(this.airLayerCanvas.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: "2"
      });
      this.canvas.parentElement.insertBefore(this.airLayerCanvas, this.canvas);
      this.airLayerCtx = this.airLayerCanvas.getContext("2d", { alpha: true });
    }
    this.airLayerCanvas.style.display = this.themeMode === "light" ? "none" : "block";
    // Data fragments are intentionally background-detail. Rasterize them below 1x and
    // let the main canvas upscale the completed cache; fish/plant resolution is untouched.
    const physicalPixels = this.drawWidth * this.drawHeight * Math.max(1, (this.pixelRatio || 1) ** 2);
    this.airLayerPixelRatio = physicalPixels > 3500000 ? 0.50 : 0.62;
    const pw = Math.max(1, Math.round(this.drawWidth * this.airLayerPixelRatio));
    const ph = Math.max(1, Math.round(this.drawHeight * this.airLayerPixelRatio));
    if (this.airLayerCanvas.width !== pw || this.airLayerCanvas.height !== ph) {
      this.airLayerCanvas.width = pw;
      this.airLayerCanvas.height = ph;
      this.airLayerCtx.setTransform(this.airLayerPixelRatio, 0, 0, this.airLayerPixelRatio, 0, 0);
      this.lastCyberAirRender = 0;
    }
    return this.airLayerCtx;
  }

  clearAirLayer() {
    if (!this.airLayerCtx || !this.airLayerCanvas) return;
    const ratio = this.airLayerPixelRatio || 1;
    this.airLayerCtx.save();
    this.airLayerCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.airLayerCtx.clearRect(0, 0, this.drawWidth, this.drawHeight);
    this.airLayerCtx.restore();
  }

  renderCyberAirLayer(timestamp = performance.now()) {
    // AIR is decorative. When the aquarium itself is under load, yield additional
    // main-thread/compositor time to fish motion instead of competing with it.
    const liveFps = Number(this.stats?.fps) || 60;
    const adaptiveInterval = liveFps < 32 ? (1000 / 4) : (liveFps < 48 ? (1000 / 6) : this.cyberAirRenderInterval);
    const interval = Math.max(this.cyberAirRenderInterval, adaptiveInterval);
    if (timestamp - this.lastCyberAirRender < interval) return;
    this.lastCyberAirRender = timestamp;
    const ctx = this.ensureAirLayer();
    const ratio = this.airLayerPixelRatio || 1;
    ctx.save();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, this.drawWidth, this.drawHeight);
    if (this.themeMode !== "light") {
      const tank = this.getTankBounds();
      ctx.beginPath();
      ctx.rect(tank.left, tank.top, tank.right - tank.left, tank.bottom - tank.top);
      ctx.clip();
      for (let i = 0; i < this.bubbles.length; i++) this.bubbles[i].draw(ctx);
    }
    ctx.restore();
  }

  drawCyberAirCache(ctx, timestamp = performance.now()) {
    // PAKU: NATURAL only - never renders the CYBER text-particle AIR layer.
    if (this.airLayerCanvas) this.airLayerCanvas.style.display = "none";
  }

  drawWaterBackground(ctx) {
    const w = this.drawWidth;
    const h = this.drawHeight;

    // PAKU: NATURAL only - the CYBER branch (dark static background fill) never runs.

    // NATURAL: flat blueではなく、上部の光・中層の透明感・底側の深みを一枚で作る。
    const water = ctx.createLinearGradient(0, 0, 0, h);
    water.addColorStop(0.00, "rgba(247,251,250,0.99)");
    water.addColorStop(0.20, "rgba(226,241,241,0.985)");
    water.addColorStop(0.58, "rgba(190,222,223,0.975)");
    water.addColorStop(1.00, "rgba(151,199,205,0.985)");
    ctx.fillStyle = water;
    ctx.fillRect(0, 0, w, h);

    // 水面近くの柔らかい反射。魚より後ろの静的レイヤーなので白く被らない。
    const surfaceGlow = ctx.createLinearGradient(0, 0, 0, Math.max(1, h * 0.24));
    surfaceGlow.addColorStop(0.00, "rgba(255,253,247,0.28)");
    surfaceGlow.addColorStop(0.34, "rgba(248,252,248,0.115)");
    surfaceGlow.addColorStop(1.00, "rgba(255,255,255,0)");
    ctx.fillStyle = surfaceGlow;
    ctx.fillRect(0, 0, w, h * 0.28);

    // 中央をわずかに抜き、左右と底へ行くほど水の厚みを感じるようにする。
    const depth = ctx.createRadialGradient(w * 0.50, h * 0.30, 0, w * 0.50, h * 0.38, Math.max(w, h) * 0.72);
    depth.addColorStop(0.00, "rgba(250,253,247,0.11)");
    depth.addColorStop(0.52, "rgba(171,216,214,0.018)");
    depth.addColorStop(1.00, "rgba(71,132,143,0.065)");
    ctx.fillStyle = depth;
    ctx.fillRect(0, 0, w, h);
  }

  rebuildStaticLayer() {
    const ctx = this.ensureLayerCanvas("static");
    if (!this.staticLayerDirty) return;
    ctx.save();
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.clearRect(0, 0, this.drawWidth, this.drawHeight);

    this.drawWaterBackground(ctx);
    this.drawTankCube(ctx, false);

    const tank = this.getTankBounds();
    ctx.save();
    ctx.beginPath();
    ctx.rect(tank.left, tank.top, tank.right - tank.left, tank.bottom - tank.top);
    ctx.clip();

    // 背景レイヤーには底床だけを焼く。水草本体はAIRより前の専用レイヤーへ分離。
    this.drawBottomTerrain(ctx);

    // 細粒砂の粒子を静的レイヤーへ焼き込む。
    this.gravels.forEach(g => {
      ctx.fillStyle = g.color;
      ctx.beginPath();
      ctx.ellipse(g.x, g.y, g.rx, g.ry, g.rot, 0, Math.PI * 2);
      ctx.fill();
    });

    // External light is part of the static world. Fish/plants remain above it,
    // while the dynamic dark layer can still flicker the environment cheaply.
    this.drawStaticOverheadLight(ctx);
    ctx.restore();
    ctx.restore();
    this.staticLayerDirty = false;
  }

  getPlantZoneRenderBounds(zone, activeAssets) {
    const tank = this.getTankBounds();
    const pad = Math.max(8, 14 * this.scale);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const include = (x0, y0, x1, y1) => {
      minX = Math.min(minX, x0); minY = Math.min(minY, y0);
      maxX = Math.max(maxX, x1); maxY = Math.max(maxY, y1);
    };
    const floorRange = (x0, x1) => {
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i <= 6; i++) {
        const x = x0 + (x1 - x0) * (i / 6);
        const y = this.getTerrainHeight(x);
        lo = Math.min(lo, y); hi = Math.max(hi, y);
      }
      return { lo, hi };
    };

    for (const asset of activeAssets) {
      const plan = this.landscapeOverrides?.[asset.id];
      if (!plan) continue;
      const vb = asset.visibleBounds || { x:0, y:0, width:asset.logicalWidth || 340, height:asset.logicalHeight || 260 };
      const anchor = asset.anchor || { x:(asset.logicalWidth || 340) * 0.5, y:(asset.logicalHeight || 260) - 25 };

      if (plan.strategy === 'carpet') {
        const center = plan.xRatio * this.drawWidth;
        const half = Math.max(12, (plan.widthRatio || 0.1) * this.drawWidth * 0.5);
        const x0 = Math.max(tank.left, center - half - pad);
        const x1 = Math.min(tank.right, center + half + pad);
        const floors = floorRange(x0, x1);
        const s = Math.max(0.35, this.scale * (asset.defaultScale || 1));
        // Carpet generators are much shorter than their specimen source canvases.
        const maxH = Math.min((asset.logicalHeight || 240) * s * 0.58, 125 * this.scale);
        include(x0, floors.lo - maxH - pad, x1, floors.hi + pad);
      } else if (plan.strategy === 'colony') {
        const center = plan.xRatio * this.drawWidth;
        const half = Math.max(15, (plan.widthRatio || 0.1) * this.drawWidth * 0.5);
        const s = Math.max(0.35, this.scale * (plan.scale || 1) * (asset.defaultScale || 1));
        const side = Math.max(pad, Math.min(90 * this.scale, vb.width * s * 0.24));
        const x0 = Math.max(tank.left, center - half - side);
        const x1 = Math.min(tank.right, center + half + side);
        const floors = floorRange(x0, x1);
        const maxH = Math.max(vb.height * s * 1.12, (asset.logicalHeight || 260) * s * 0.82);
        include(x0, floors.lo - maxH - pad, x1, floors.hi + pad);
      } else if (plan.strategy === 'scattered') {
        const cfg = this.speciesConfig[asset.id];
        const count = Math.max(1, Math.min(cfg?.count || 1, plan.instances?.length || 1));
        for (let i = 0; i < count; i++) {
          const inst = plan.instances?.[i]; if (!inst) continue;
          const groundX = inst.xRatio * this.drawWidth;
          const groundY = this.getTerrainHeight(groundX);
          const fs = this.scale * (inst.scale || 1) * (asset.defaultScale || 1);
          include(
            groundX + (vb.x - anchor.x) * fs - pad,
            groundY + (vb.y - anchor.y) * fs - pad,
            groundX + (vb.x + vb.width - anchor.x) * fs + pad,
            groundY + (vb.y + vb.height - anchor.y) * fs + pad
          );
        }
      } else {
        const groundX = plan.xRatio * this.drawWidth;
        const groundY = this.getTerrainHeight(groundX);
        const fs = this.scale * (plan.scale || 1) * (asset.defaultScale || 1);
        include(
          groundX + (vb.x - anchor.x) * fs - pad,
          groundY + (vb.y - anchor.y) * fs - pad,
          groundX + (vb.x + vb.width - anchor.x) * fs + pad,
          groundY + (vb.y + vb.height - anchor.y) * fs + pad
        );
      }
    }

    if (!Number.isFinite(minX)) return null;
    minX = Math.max(tank.left, Math.floor(minX));
    minY = Math.max(tank.top, Math.floor(minY));
    maxX = Math.min(tank.right, Math.ceil(maxX));
    maxY = Math.min(tank.bottom, Math.ceil(maxY));

    if (zone === "foreground") {
      // v114: foreground carpets/blades can lean or scatter beyond their nominal
      // procedural footprint. The v113 tight crop made that layer look clipped and
      // visually discontinuous. Keep the memory-saving vertical strip, but let the
      // foreground own the full tank width and a generous upper margin.
      minX = tank.left;
      maxX = tank.right;
      minY = Math.max(tank.top, Math.min(minY, tank.bottom - 260 * this.scale));
      maxY = tank.bottom;
    }

    return {
      x: minX, y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY)
    };
  }

  ensurePlantZoneCache(zone, bounds) {
    if (!bounds) return null;
    if (!this.plantZoneCanvases[zone]) {
      const canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      this.plantZoneCanvases[zone] = canvas;
      this.plantZoneContexts[zone] = canvas.getContext("2d", { alpha:true });
    }
    const canvas = this.plantZoneCanvases[zone];
    const ctx = this.plantZoneContexts[zone];
    const pw = Math.max(1, Math.ceil(bounds.width * this.pixelRatio));
    const ph = Math.max(1, Math.ceil(bounds.height * this.pixelRatio));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    this.plantZoneBounds[zone] = bounds;
    return ctx;
  }

  releasePlantZoneCache(zone) {
    const canvas = this.plantZoneCanvases[zone];
    if (!canvas) { this.plantZoneBounds[zone] = null; return; }
    // Shrink backing storage so an unused zone does not keep tens of MB allocated.
    canvas.width = 1;
    canvas.height = 1;
    this.plantZoneCanvases[zone] = null;
    this.plantZoneContexts[zone] = null;
    this.plantZoneBounds[zone] = null;
  }

  bakeCyberPlantGlow(zone) {
    // CYBER plant emission is generated only when the static plant cache changes.
    const canvas = this.plantZoneCanvases[zone];
    if (this.themeMode === "light" || !canvas || canvas.width <= 1 || canvas.height <= 1) return;

    const down = 0.34;
    const gw = Math.max(24, Math.round(canvas.width * down));
    const gh = Math.max(24, Math.round(canvas.height * down));
    // Reuse scratch canvases instead of allocating two bitmaps on every editor commit.
    if (!this._plantGlowSrc) {
      this._plantGlowSrc = document.createElement("canvas");
      this._plantGlowCanvas = document.createElement("canvas");
    }
    const src = this._plantGlowSrc;
    const glow = this._plantGlowCanvas;
    if (src.width !== gw || src.height !== gh) { src.width = gw; src.height = gh; }
    if (glow.width !== gw || glow.height !== gh) { glow.width = gw; glow.height = gh; }
    const sctx = src.getContext("2d", { alpha:true });
    const gctx = glow.getContext("2d", { alpha:true });
    sctx.setTransform(1,0,0,1,0,0); sctx.clearRect(0,0,gw,gh);
    sctx.drawImage(canvas, 0,0,canvas.width,canvas.height, 0,0,gw,gh);
    gctx.setTransform(1,0,0,1,0,0); gctx.clearRect(0,0,gw,gh);
    // Blur is calculated once at cache-build time, never in the animation loop.
    gctx.filter = "blur(4.0px) brightness(3.0) saturate(1.35)";
    // Depth cue: distant vegetation emits a smaller halo, while the foreground
    // keeps the strongest bloom. The plant surface itself remains the crisp core.
    gctx.globalAlpha = zone === "background" ? 0.42 : (zone === "midground" ? 0.58 : 0.76);
    gctx.drawImage(src,0,0);
    gctx.filter = "none";
    gctx.globalAlpha = 1;

    const ctx = this.plantZoneContexts[zone];
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.globalCompositeOperation = "destination-over";
    ctx.drawImage(glow,0,0,gw,gh,0,0,canvas.width,canvas.height);
    ctx.restore();
  }

  rebuildStaticPlantLayer() {
    if (!this.staticPlantLayerDirty) return;
    const allZones = ["background","midground","foreground"];
    const zones = this.plantZoneDirty?.size ? Array.from(this.plantZoneDirty) : allZones;
    const tank = this.getTankBounds();
    const assets = (this.terrainClipPath && typeof window !== "undefined" && window.BotanicalEngine)
      ? (window.BotanicalEngine.getPlantAssets ? window.BotanicalEngine.getPlantAssets() : window.BotanicalEngine.getAllAssets())
      : [];
    const terrainHeight = x => this.getTerrainHeight(x);

    for (const zone of zones) {
      const activeAssets = assets.filter(asset => {
        if (asset.zone !== zone) return false;
        const cfg = this.speciesConfig[asset.id];
        const plan = this.landscapeOverrides?.[asset.id];
        return !!(cfg?.enabled && plan);
      });

      if (!activeAssets.length) {
        this.releasePlantZoneCache(zone);
        continue;
      }

      const bounds = this.getPlantZoneRenderBounds(zone, activeAssets);
      const ctx = this.ensurePlantZoneCache(zone, bounds);
      if (!ctx || !bounds) continue;
      ctx.save();
      ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, -bounds.x * this.pixelRatio, -bounds.y * this.pixelRatio);
      ctx.clearRect(bounds.x, bounds.y, bounds.width, bounds.height);
      ctx.beginPath();
      ctx.rect(tank.left, tank.top, tank.right - tank.left, tank.bottom - tank.top);
      ctx.clip();
      if (this.terrainClipPath) ctx.clip(this.terrainClipPath);

      for (const asset of activeAssets) {
        const cfg = this.speciesConfig[asset.id];
        const plan = this.landscapeOverrides?.[asset.id];

        if (plan.strategy === "carpet") {
          window.BotanicalEngine.drawCarpet(ctx, asset.id, plan.xRatio, plan.widthRatio, plan.density, terrainHeight, this.drawWidth, this.scale, "light");
        } else if (plan.strategy === "colony") {
          window.BotanicalEngine.drawColony(ctx, asset.id, plan.xRatio, plan.widthRatio, plan.density, plan.scale || 1, terrainHeight, this.drawWidth, this.scale, "light");
        } else if (plan.strategy === "scattered") {
          const count = Math.max(1, Math.min(cfg.count || 1, plan.instances?.length || 1));
          for (let i=0;i<count;i++) {
            const inst = plan.instances[i];
            if (!inst) continue;
            const x = inst.xRatio * this.drawWidth;
            window.BotanicalEngine.drawAsset(ctx, asset.id, x, terrainHeight(x), this.scale * (inst.scale || 1), "light");
          }
        } else {
          const x = plan.xRatio * this.drawWidth;
          window.BotanicalEngine.drawAsset(ctx, asset.id, x, terrainHeight(x), this.scale * (plan.scale || 1), "light");
        }
      }

      // PAKU: NATURAL only - the CYBER glow/treatment pass never runs.
      ctx.restore();
    }

    if (this.staticPlantLayerCanvas) this.staticPlantLayerCanvas.style.display = "none";
    this.plantZoneDirty?.clear();
    this.staticPlantLayerDirty = false;
  }

  drawPlantZone(ctx, zone) {
    const canvas = this.plantZoneCanvases[zone];
    const bounds = this.plantZoneBounds[zone];
    if (!canvas || !bounds) return;
    ctx.save();
    if (this.themeMode !== "light") {
      // CYBER is emissive material, not one uniformly transparent sheet.
      // Preserve clear depth separation between botanical layers without filters.
      const zoneAlpha = zone === "background" ? 0.82 : (zone === "midground" ? 0.92 : 1.0);
      ctx.globalAlpha = zoneAlpha;
    }
    // Copy only the zone's occupied rectangle instead of a full-tank 4K bitmap.
    ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.restore();
  }

  renderPlantLayer(timestamp = performance.now()) {
    // Current BotanicalEngine plants are static zone caches. Avoid allocating/clearing
    // a fullscreen motion canvas when legacy CyberPlant/epiphyte arrays are empty.
    if (!this.plants.length && !this.epiphyteUnits.length) {
      if (this.plantLayerCanvas) this.plantLayerCanvas.style.display = "none";
      this.plantLayerDirty = false;
      return;
    }
    const ctx = this.ensureLayerCanvas("plant");
    this.plantLayerCanvas.style.display = "block";
    if (!this.plantLayerDirty && timestamp - this.lastPlantLayerRender < this.plantLayerInterval) return;
    this.lastPlantLayerRender = timestamp;
    this.plantLayerDirty = false;
    ctx.save();
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.clearRect(0, 0, this.drawWidth, this.drawHeight);
    const tank = this.getTankBounds();
    ctx.beginPath();
    ctx.rect(tank.left, tank.top, tank.right - tank.left, tank.bottom - tank.top);
    ctx.clip();
    if (this.terrainClipPath) ctx.clip(this.terrainClipPath);
    const plantList = this.sortedPlants.length === this.plants.length ? this.sortedPlants : this.plants;
    plantList.forEach(plant => plant.drawMotion(ctx));
    this.epiphyteUnits.forEach(unit => unit.drawMotion(ctx));
    ctx.restore();
  }

  invalidateLightCache() {
    // v113: external light is baked into the static background. Rebuild only
    // when colour/intensity/theme/geometry changes; never composite a full-size
    // mix-blend-mode canvas every animation frame.
    this.lightLayerKey = "";
    this.staticLayerDirty = true;
    if (this.lightLayerCanvas) this.lightLayerCanvas.style.display = "none";
  }

  drawStaticOverheadLight(ctx) {
    const tank = this.getTankBounds();
    const rgb = this.hexToRgb(this.lightColor);
    const base = Math.max(0, Math.min(1, this.lighting));
    const th = Math.max(1, tank.bottom - tank.top);

    ctx.save();
    // Screen is now resolved once inside the static bitmap, not by the browser
    // compositor against a continuously-redrawn canvas.
    ctx.globalCompositeOperation = "screen";
    const gradient = ctx.createLinearGradient(0, tank.top, 0, tank.bottom);
    gradient.addColorStop(0, `rgba(${rgb}, ${0.54 * base})`);
    gradient.addColorStop(0.22, `rgba(${rgb}, ${0.28 * base})`);
    gradient.addColorStop(0.58, `rgba(${rgb}, ${0.11 * base})`);
    gradient.addColorStop(0.86, `rgba(${rgb}, ${0.045 * base})`);
    gradient.addColorStop(1, `rgba(${rgb}, ${0.018 * base})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(tank.left, tank.top, tank.right - tank.left, th);

    const beamWidth = (tank.right - tank.left) * 0.28;
    for (let i = 0; i < 3; i++) {
      const cx = tank.left + (tank.right - tank.left) * (0.22 + i * 0.28);
      const beam = ctx.createRadialGradient(cx, tank.top + th * 0.10, beamWidth * 0.05, cx, tank.top + th * 0.10, beamWidth);
      beam.addColorStop(0, `rgba(${rgb},${0.060 * base})`);
      beam.addColorStop(0.38, `rgba(${rgb},${0.040 * base})`);
      beam.addColorStop(0.72, `rgba(${rgb},${0.018 * base})`);
      beam.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = beam;
      ctx.fillRect(cx - beamWidth, tank.top, beamWidth * 2, th);
    }
    ctx.restore();
  }

  setLightColor(hex) {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    this.lightColor = hex.toUpperCase();
    this.invalidateLightCache();
    try { localStorage.setItem("cyberAquariumLightColor", this.lightColor); } catch (_) {}
  }

  getEffectiveLighting() {
    return Math.max(0.02, Math.min(1.25, this.lighting * this.lightPulse));
  }

  updateLightFlicker(timestamp) {
    // PAKU: NATURAL only, unconditionally - the CYBER flicker/crackle never runs.
    this.lightPulse += (1 - this.lightPulse) * 0.45;
    this.lightFlickerUntil = 0;
    this.nextLightFlickerAt = timestamp + 12000;
  }

  ensureDarkLayer() {
    if (this.darkLayerEl) return this.darkLayerEl;
    const el = document.createElement("div");
    el.className = "aquarium-render-layer aquarium-dark-layer";
    el.setAttribute("aria-hidden", "true");
    el.style.position = "absolute";
    el.style.inset = "0";
    el.style.pointerEvents = "none";
    el.style.zIndex = "1";
    el.style.background = this.getThemePalette().darkOverlay;
    el.style.opacity = "0";
    el.style.willChange = "opacity";
    this.canvas.parentElement.appendChild(el);
    this.darkLayerEl = el;
    return el;
  }

  drawLightLevel(ctx) {
    // 4K全面fillRectを毎フレーム実行せず、DOMコンポジタのopacityだけ更新する。
    const apparentIntensity = Math.max(0.05, Math.min(1, this.lighting * this.lightPulse));
    const darkness = (1 - apparentIntensity) * 0.64;
    const opacity = darkness <= 0.001 ? "0" : darkness.toFixed(3);
    const el = this.ensureDarkLayer();
    // Avoid invalidating compositor style when the rounded value did not change.
    if (opacity !== this._lastDarkLayerOpacity) {
      el.style.opacity = opacity;
      this._lastDarkLayerOpacity = opacity;
    }
  }

  drawOverheadLight(ctx) {
    // Kept as a compatibility hook. Lighting is baked by rebuildStaticLayer().
  }

  scheduleResize(delay = 70) {
    if (this._resizeTimer) clearTimeout(this._resizeTimer);
    this._resizeTimer = setTimeout(() => {
      this._resizeTimer = null;
      this.resizeCanvas();
    }, Math.max(0, delay));
  }

  resizeCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    // ネイティブ解像度を維持。Windowsの表示スケール込みで物理4Kへ一致させる。
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const fullscreenNow = !!document.fullscreenElement;
    const sameGeometry = Math.abs(rect.width - this._lastResizeWidth) < 0.5
      && Math.abs(rect.height - this._lastResizeHeight) < 0.5
      && Math.abs(dpr - this._lastResizeDpr) < 0.001
      && fullscreenNow === this._lastResizeFullscreen;
    if (sameGeometry) return;

    this._lastResizeWidth = rect.width;
    this._lastResizeHeight = rect.height;
    this._lastResizeDpr = dpr;
    this._lastResizeFullscreen = fullscreenNow;

    const oldWidth = this.drawWidth || 0;
    const oldHeight = this.drawHeight || 0;
    const hadSize = oldWidth > 0 && oldHeight > 0;
    const ratioX = hadSize ? rect.width / oldWidth : 1;
    const ratioY = hadSize ? rect.height / oldHeight : 1;

    this.pixelRatio = dpr;
    // Static background / botanical caches stay at native DPR. Only the continuously
    // redrawn fauna canvas gets a conservative pixel-budget cap at very high resolution.
    // This preserves sharp plants/UI while preventing 4K fullscreen from clearing and
    // compositing 7–12+ million moving pixels every frame.
    const cssPixels = Math.max(1, rect.width * rect.height);
    const dynamicPixelBudget = 4600000;
    const budgetRatio = Math.sqrt(dynamicPixelBudget / cssPixels);
    this.dynamicPixelRatio = Math.max(0.74, Math.min(dpr, budgetRatio));
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dynamicPixelRatio));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dynamicPixelRatio));
    this.canvas.style.position = "relative";
    this.canvas.style.zIndex = "2";
    this.canvas.style.willChange = "auto";
    this.ctx.setTransform(this.dynamicPixelRatio, 0, 0, this.dynamicPixelRatio, 0, 0);

    this.drawWidth = rect.width;
    this.drawHeight = rect.height;
    const physicalPixels = rect.width * rect.height * dpr * dpr;
    this.glowScale = physicalPixels > 7000000 ? 0.30 : (physicalPixels > 3500000 ? 0.48 : 0.78);
    // Background-only CYBER AIR may update more slowly at high resolutions; fish remain 60fps.
    this.cyberAirRenderInterval = physicalPixels > 7000000 ? (1000 / 6) : (physicalPixels > 3500000 ? (1000 / 8) : (1000 / 12));
    window.aquariumCanvasWidth = rect.width;
    window.aquariumCanvasHeight = rect.height;

    const baseW = 850;
    const baseH = 480;
    this.scale = Math.min(rect.width / baseW, rect.height / baseH);
    this.scale = Math.max(0.6, Math.min(2.2, this.scale));
    // Geometry/scale changed: refresh cheap terrain lookup before any fish/plant clamping.
    this._tankBoundsCache = null;
    this.rebuildTerrainHeightCache();
    this.clampLandscapeLayoutToTank();

    // 全画面化／復帰では相対位置を維持し、旧座標の左上に生体を置き去りにしない。
    if (hadSize && (Math.abs(ratioX - 1) > 0.001 || Math.abs(ratioY - 1) > 0.001)) {
      const scalePos = (obj) => {
        if (!obj || !obj.pos) return;
        obj.pos.x *= ratioX;
        obj.pos.y *= ratioY;
      };
      this.fishes.forEach(f => {
        scalePos(f);
        if (Array.isArray(f.history)) {
          f.history.forEach(pos => { pos.x *= ratioX; pos.y *= ratioY; });
        }
      });
      this.packets.forEach(scalePos);
      this.bubbles.forEach(scalePos);
      this.planktons.forEach(scalePos);
      this.dustParticles.forEach(scalePos);
      this.scanWaves.forEach(w => { if (w) { w.x *= ratioX; w.y *= ratioY; } });
      this.scanLaserY *= ratioY;
    }

    const terrainForLayout = (x) => this.getTerrainHeight(x);
    this.driftwoods.forEach(w => w.updatePosition(this.drawWidth, this.drawHeight, terrainForLayout));
    this.obstacles.forEach(o => o.updatePosition(this.drawWidth, this.drawHeight, terrainForLayout));
    this.epiphyteUnits.forEach(u => u.updatePosition(this.drawWidth, this.drawHeight, terrainForLayout));
    this.plants.forEach(p => p.updatePosition(this.drawWidth, this.drawHeight, terrainForLayout));

    const tank = this.getTankBounds();
    this.fishes.forEach(f => {
      const r = Math.max(7 * this.scale, f.size * this.scale * f.depthScale * 0.72);
      f.pos.x = Math.max(tank.left + r, Math.min(tank.right - r, f.pos.x));
      const floor = this.getTerrainHeight(f.pos.x) - r;
      f.pos.y = Math.max(tank.top + r, Math.min(floor, f.pos.y));
    });

    this.setupGravels();
    this.rebuildTerrainClipPath();
    this.invalidateLightCache();
    this.refreshPlantRenderCache();
  }

  getMotionScale() {
    // 表示サイズに完全比例させると全画面で速すぎるため、体長/秒の感覚だけ緩やかに補正する。
    return Math.max(0.85, Math.min(1.48, 0.78 + this.scale * 0.30));
  }

  getLightActivityScale() {
    // LIGHT 100% = 現在の遊泳速度、LIGHT 0% = 70%。UIには出さない隠し連動。
    const n = Math.max(0, Math.min(1, Number(this.lighting) || 0));
    return 0.70 + n * 0.30;
  }

  setTheme(mode = "dark") {
    const normalized = mode === "light" ? "light" : "dark";
    if (this.themeMode === normalized) {
      this.updateHudMetrics();
      return;
    }
    this.themeMode = normalized;
    try { localStorage.setItem("cyberAquariumTheme", normalized); } catch (_) {}
    if (normalized === "light") {
      this.clearAirLayer();
      if (this.airLayerCanvas) this.airLayerCanvas.style.display = "none";
    } else {
      this.lastCyberAirRender = 0;
      if (this.airLayerCanvas) this.airLayerCanvas.style.display = "block";
    }
    this.setupGravels();
    this.staticLayerDirty = true;
    this.staticPlantLayerDirty = true;
    this.plantZoneDirty?.add("background");
    this.plantZoneDirty?.add("midground");
    this.plantZoneDirty?.add("foreground");
    this.plantLayerDirty = true;
    this.invalidateLightCache();
    if (this.darkLayerEl) {
      this.darkLayerEl.style.background = this.getThemePalette().darkOverlay;
    }
    this.updateHudMetrics();
  }

  getThemePalette() {
    // PAKU: NATURAL only, unconditionally - the CYBER palette never returns.
    return {
      staticBg: "rgba(218, 236, 236, 0.78)",
      tankGridFar: "rgba(78, 145, 155, 0.08)",
      tankGridNear: "rgba(78, 145, 155, 0.13)",
      surfaceMain: "rgba(104, 180, 188, 0.20)",
      surfaceRays: "rgba(118, 191, 196, 0.045)",
      terrainStroke: "rgba(53, 150, 103, 0.30)",
      terrainFill: "rgba(198, 214, 191, 0.94)",
      terrainGrid: "rgba(53, 150, 103, 0.12)",
      gravel: "rgba(59, 145, 94, 0.24)",
      darkOverlay: "rgb(12, 24, 32)"
    };
  }

  getTankBounds() {
    // Cache the immutable bounds object for the current geometry. This method is hot:
    // fish steering, food, shrimp, terrain and draw all query it many times per frame.
    const fullscreen = !!document.fullscreenElement;
    const cached = this._tankBoundsCache;
    if (cached && this._tankBoundsW === this.drawWidth && this._tankBoundsH === this.drawHeight
        && this._tankBoundsScale === this.scale && this._tankBoundsFullscreen === fullscreen) return cached;
    const inset = fullscreen ? 0 : Math.max(2, 3 * this.scale);
    const bounds = {
      left: inset,
      right: this.drawWidth - inset,
      top: inset,
      bottom: this.drawHeight - inset
    };
    this._tankBoundsCache = bounds;
    this._tankBoundsW = this.drawWidth;
    this._tankBoundsH = this.drawHeight;
    this._tankBoundsScale = this.scale;
    this._tankBoundsFullscreen = fullscreen;
    return bounds;
  }

  computeTerrainHeightRaw(x, b = this.getTankBounds()) {
    const w = Math.max(1, b.right - b.left);
    const scale = this.scale;
    const nx = Math.max(0, Math.min(1, (x - b.left) / w));
    const base = b.bottom - 14 * scale;
    const plan = this.landscapePlan;

    if (!plan || !plan.terrain) {
      return base - (Math.sin(nx * Math.PI * 2) * 4 + Math.cos(nx * Math.PI * 4 + 1.3) * 2.5) * scale;
    }

    const t = plan.terrain;
    const wave = Math.sin(nx * Math.PI * 2 + t.phase1) * t.wave1
      + Math.cos(nx * Math.PI * 4 + t.phase2) * t.wave2;
    const moundValue = (center, width, height) => {
      const d = Math.abs(nx - center) / Math.max(0.001, width);
      if (d >= 1) return 0;
      const q = 1 - d;
      return q * q * (3 - 2 * q) * height;
    };
    const relief = moundValue(plan.focus, t.focusWidth, t.focusLift)
      + moundValue(plan.secondary, t.secondaryWidth, t.secondaryLift);
    return base - (wave + relief) * scale;
  }

  rebuildTerrainHeightCache() {
    if (!this.drawWidth || !this.drawHeight) return;
    const b = this.getTankBounds();
    const count = Math.max(160, Math.min(1280, Math.ceil((b.right - b.left) / 2)));
    const values = new Float32Array(count + 1);
    for (let i = 0; i <= count; i++) {
      const x = b.left + (b.right - b.left) * (i / count);
      values[i] = this.computeTerrainHeightRaw(x, b);
    }
    this._terrainHeightCache = values;
    this._terrainHeightCacheLeft = b.left;
    this._terrainHeightCacheRight = b.right;
  }

  getTerrainHeight(x) {
    const values = this._terrainHeightCache;
    const left = this._terrainHeightCacheLeft;
    const right = this._terrainHeightCacheRight;
    if (!values || !Number.isFinite(left) || !Number.isFinite(right) || right <= left) {
      return this.computeTerrainHeightRaw(x);
    }
    const t = Math.max(0, Math.min(1, (x - left) / (right - left))) * (values.length - 1);
    const i = Math.floor(t);
    const f = t - i;
    const a = values[i];
    const b = values[Math.min(values.length - 1, i + 1)];
    return a + (b - a) * f;
  }

  setupGravels() {
    this.gravels = [];
    // コリドラスが探れる細粒砂。静的レイヤーへ焼くので数を増やしても毎フレーム負荷にならない。
    const count = Math.max(90, Math.min(230, Math.floor(this.drawWidth / 8)));
    const rng = landscapeRng((this.landscapeSeed ^ 0xd1b54a32) >>> 0);
    const light = true; // PAKU: NATURAL only, unconditionally.
    for (let i = 0; i < count; i++) {
      const x = rng() * this.drawWidth;
      const y = this.getTerrainHeight(x) + (1 + rng() * 10) * this.scale;
      const r = (0.28 + rng() * 0.62) * this.scale;
      this.gravels.push({
        x, y,
        rx: r * (1.1 + rng() * 1.7),
        ry: r * (0.45 + rng() * 0.45),
        rot: rng() * Math.PI,
        color: light
          ? `rgba(${207 + Math.floor(rng()*24)},${192 + Math.floor(rng()*22)},${156 + Math.floor(rng()*20)},${(0.14 + rng()*0.13).toFixed(3)})`
          : `rgba(${148 + Math.floor(rng()*30)},${128 + Math.floor(rng()*25)},${88 + Math.floor(rng()*20)},${(0.20 + rng()*0.16).toFixed(3)})`
      });
    }
  }

  spawnPopulation() {
    this.fishes = [];
    this.plants = [];
    this.obstacles = [];
    this.driftwoods = [];
    this.epiphyteUnits = [];
    this.planktons = [];
    this.landscapeSeed = (Math.random() * 0xffffffff) >>> 0;
    // Keep the v77 terrain plan untouched; Botanical placement is stored separately.
    this.createLandscapePlan();
    this.rebuildTerrainHeightCache();

    const w = this.drawWidth;
    const h = this.drawHeight;
    this.spawnHardscape(); // deliberately empty while wood is shelved

    const planktonCount = 0;
    for (let i = 0; i < planktonCount; i++) this.planktons.push(new Plankton(w, h));

    CYBER_SPECIES.forEach(sp => {
      const cfg = this.getSpeciesConfig(sp.id);
      if (!cfg.enabled || sp.type !== "fauna") return;
      for (let i = 0; i < cfg.count; i++) this.fishes.push(this.spawnFish(sp));
    });

    this.fishes.forEach(fish => {
      if (fish.id !== "shrimp") return;
      const target = this.getShrimpGrazePoint(fish.pos);
      fish.shrimpGrazeTarget = target;
      fish.pos.x = target.x;
      fish.pos.y = target.y;
      fish.vel.mult(0);
      fish.shrimpDir = Math.random() < 0.5 ? -1 : 1;
      fish.facing = fish.shrimpDir;
    });

    this.setupGravels();
    this.refreshPlantRenderCache();
    this.rebuildTerrainClipPath();
    this.invalidateLightCache();
  }

  feedData(x, y) {
    if (this.packets.length > 40) return;

    // 1クリックで数粒投入。全画面でも視認しやすくする。
    const count = Math.min(3, 41 - this.packets.length);
    for (let i = 0; i < count; i++) {
      const spread = 12 * this.scale;
      const tank = this.getTankBounds();
      const px = Math.max(tank.left + 5 * this.scale, Math.min(tank.right - 5 * this.scale, x + (Math.random() - 0.5) * spread));
      const py = Math.max(tank.top + 6 * this.scale, Math.min(tank.bottom - 8 * this.scale, y + Math.random() * 5 * this.scale));
      this.packets.push(new DataPacket(px, py));
    }
    
    if (window.cyberAudio) {
      window.cyberAudio.playFeed();
    }

    this.logEvent("UI", this.themeMode === "light" ? "給餌しました" : "FEED // DATA DROP");

    const feedAlert = document.getElementById("feed-alert");
    if (feedAlert) {
      feedAlert.style.display = "block";
      clearTimeout(this.feedAlertTimeout);
      this.feedAlertTimeout = setTimeout(() => {
        feedAlert.style.display = "none";
      }, 3000);
    }
  }

  setParam(name, value) {
    if (name === "lighting") {
      this.lighting = Math.max(0, Math.min(1, parseFloat(value)));
      this.invalidateLightCache();
      try { localStorage.setItem("cyberAquariumLighting", String(this.lighting)); } catch (_) {}
      if (window.cyberAudio) window.cyberAudio.updateLightParams(this.lighting);
      return;
    }
    if (name === "bubblerRate") {
      this.bubblerRate = Math.max(0, Math.min(1, parseFloat(value)));
      if (window.cyberAudio) window.cyberAudio.updateBubblerRate(this.bubblerRate);
      return;
    }
    if (Object.prototype.hasOwnProperty.call(this, name)) this[name] = parseFloat(value);
  }

  toggleScanMode() {
    this.scanModeActive = !this.scanModeActive;
    if (window.cyberAudio) {
      window.cyberAudio.setScanMode(this.scanModeActive);
    }

    const wrapper = this.canvas.parentElement;
    if (this.scanModeActive) {
      wrapper.classList.add("scan-active");
      this.logEvent("WARN", "TACTICAL SCAN PROTOCOL: ACTIVATED");
      this.scanLaserY = 30;
      this.scanLaserDir = 1;
    } else {
      wrapper.classList.remove("scan-active");
      this.logEvent("SYSTEM", "TACTICAL SCAN PROTOCOL: DEACTIVATED");
    }
    return this.scanModeActive;
  }

  update(timestamp) {
    this.frameCount++;
    if (timestamp - this.fpsIntervalTime >= 1000) {
      this.stats.fps = Math.round((this.frameCount * 1000) / (timestamp - this.fpsIntervalTime));
      this.frameCount = 0;
      this.fpsIntervalTime = timestamp;
      
      const scanModifier = this.scanModeActive ? 25 : 0;
      this.stats.systemLoad = Math.round(15 + Math.sin(timestamp * 0.001) * 3 + this.fishes.length * 2.2 + scanModifier);
      this.updateHudMetrics();
    }
    this.lastTime = timestamp;

    const tempFactor = 1.0;
    const phFactor = 1.0;
    const scale = this.scale;
    
    this.surfacePhase += 0.02 * tempFactor;
    this.scanAngle += 0.025;
    this.updateLightFlicker(timestamp);

    // 1. 気泡の更新
    const bubbleChance = 0.02 + this.bubblerRate * 0.12;
    const bubbleCap = 72; // PAKU: NATURAL only, unconditionally.
    if (this.bubbles.length < bubbleCap && Math.random() < bubbleChance) {
      const tank = this.getTankBounds();
      const bx = tank.left + Math.random() * (tank.right - tank.left);
      this.bubbles.push(new Bubble(bx, this.getTerrainHeight(bx) - 2 * scale, 1.0));
    }
    {
      const tank = this.getTankBounds();
      let write = 0;
      for (let i = 0; i < this.bubbles.length; i++) {
        const bubble = this.bubbles[i];
        bubble.update();
        if (bubble.pos.y > tank.top && bubble.alpha > 0 && bubble.pos.x >= tank.left && bubble.pos.x <= tank.right) {
          this.bubbles[write++] = bubble;
        }
      }
      this.bubbles.length = write;
    }

    // 2. プランクトンの更新
    this.planktons.forEach(p => p.update(this.drawWidth, this.drawHeight, tempFactor));

    // 3. 砂埃ダスト更新
    {
      let write = 0;
      for (let i = 0; i < this.dustParticles.length; i++) {
        const dust = this.dustParticles[i];
        dust.update();
        if (dust.alpha > 0) this.dustParticles[write++] = dust;
      }
      this.dustParticles.length = write;
    }

    // 4. パケットの更新
    this.packets.forEach(p => p.update());
    this.packets = this.packets.filter(p => {
      const terrainY = this.getTerrainHeight(p.pos.x);
      if (p.settled || p.pos.y >= terrainY - Math.max(5 * scale, p.size * scale * 0.55)) {
        const coryEater = this.fishes.find(f =>
          f.id === "corydoras" &&
          !f.isFeedCoolingDown(timestamp) &&
          f.pos.distSq(p.pos) < (25 * scale) ** 2
        );
        if (coryEater) {
          coryEater.triggerFeedingAction(p.pos);
          this.logEvent("SYS_CLEAN", "CORY-CLEANER.sys: メモリ空間ダストパケットを回収・消去");
          if (window.cyberAudio) window.cyberAudio.playEatPop(0.85);
          return false;
        }
        const now = timestamp || ((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now());
        if (p.settledAt && now - p.settledAt >= p.settledLifetimeMs) return false;
      }
      return true;
    });

    // 5. 魚の位置更新は毎フレーム。重い群泳判断だけ約30Hzに分離する。
    const doFlock = timestamp - this.lastFlockUpdate >= this.flockInterval;
    let speciesGroups = null;
    if (doFlock) {
      this.lastFlockUpdate = timestamp;
      speciesGroups = Object.create(null);
      for (const f of this.fishes) (speciesGroups[f.id] ||= []).push(f);
    }
    this.fishes.forEach(fish => {
      if (doFlock) fish.flock(this.fishes, this.packets, speciesGroups[fish.id]);
      fish.update(tempFactor, phFactor);

      if (fish.id === "corydoras" && fish.coryState === "forage") {
        const terrainY = this.getTerrainHeight(fish.pos.x);
        if (fish.pos.y >= terrainY - 9 * scale && Math.random() < 0.028) {
          this.dustParticles.push(new DustParticle(fish.pos.x, terrainY - 2 * scale, fish.color));
          if (Math.random() < 0.1 && window.cyberAudio) {
            window.cyberAudio.playCorydorasDig();
          }
        }
      }

      if (!fish.isFeedCoolingDown(timestamp)) {
        for (let pIdx = this.packets.length - 1; pIdx >= 0; pIdx--) {
          const p = this.packets[pIdx];
          const feedCatchRadius = (fish.size + p.size) * scale * (fish.id === "betta" ? 1.28 : 1.0);
          if (fish.pos.distSq(p.pos) < feedCatchRadius * feedCatchRadius) {
            fish.triggerFeedingAction(p.pos);
            this.packets.splice(pIdx, 1);
            if (window.cyberAudio) {
              window.cyberAudio.playEatPop(1);
            }
            const dataSize = Math.floor(p.size * 2);
            this.logEvent("DATA_SYNC", `${fish.name} がパケットを同期: ${dataSize}KB 完了`);
            break; // 1匹につき1粒。次は食休み後。
          }
        }
      }
    });

    // 生体同士の反応。脅威判定は群泳判定と同じ約30Hzで十分。
    if (doFlock) this.updateShrimpThreats(timestamp);
    this.updateCoryAirDash(timestamp);

    // 6. 水草本体は静的。葉先の小さな動的レイヤーだけ低頻度で更新する。
    if ((this.plants.length || this.epiphyteUnits.length) && timestamp - this.lastPlantLayerRender >= this.plantLayerInterval) {
      this.plants.forEach(plant => plant.update(0));
      this.epiphyteUnits.forEach(unit => unit.update());
      this.plantLayerDirty = true;
    }

    // 7. スキャン波紋の更新
    {
      let write = 0;
      for (let i = 0; i < this.scanWaves.length; i++) {
        const wave = this.scanWaves[i];
        wave.update();
        if (wave.alpha > 0) this.scanWaves[write++] = wave;
      }
      this.scanWaves.length = write;
    }

    // 8. レーザースイープ (スキャンモード)
    if (this.scanModeActive) {
      this.scanLaserY += this.scanLaserDir * 2.0 * scale;
      if (this.scanLaserY > this.drawHeight - 15 * scale) {
        this.scanLaserY = this.drawHeight - 15 * scale;
        this.scanLaserDir = -1;
      } else if (this.scanLaserY < 30 * scale) {
        this.scanLaserY = 30 * scale;
        this.scanLaserDir = 1;
      }

      this.fishes.forEach(f => {
        if (Math.abs(f.pos.y - this.scanLaserY) < 2.0 * scale) {
          this.scanWaves.push(new ScanWave(f.pos.x, f.pos.y, f.color));
          if (Math.random() < 0.1 && window.cyberAudio) {
            window.cyberAudio.playTick(1000, 0.01);
          }
        }
      });
    }
  }

  updateCyberFishFx(timestamp) {
    // PAKU: NATURAL only - the CYBER RAIN/GLITCH fish effect never starts.
    if (this.cyberFishFxActive?.fish) this.cyberFishFxActive.fish.cyberFx = null;
    this.cyberFishFxActive = null;
    this.cyberFishFxNextAt = timestamp + 2400 + Math.random() * 3600;
  }

  renderFishFxSnapshot(fish) {
    const canvas = this.cyberFishFxCanvas;
    const fx = this.cyberFishFxCtx;
    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.5;
    fx.setTransform(1, 0, 0, 1, 0, 0);
    fx.clearRect(0, 0, canvas.width, canvas.height);
    fish.draw(fx, 1.0, { renderPos: { x: cx, y: cy }, suppressTrail: true });
    return { canvas, cx, cy };
  }

  sampleCyberFishRain(fish) {
    const snap = this.renderFishFxSnapshot(fish);
    const fx = this.cyberFishFxCtx;
    const image = fx.getImageData(0, 0, snap.canvas.width, snap.canvas.height);
    const pts = [];
    const step = Math.max(3, Math.round(4 * this.scale));
    for (let y = 2; y < snap.canvas.height - 2; y += step) {
      for (let x = 2; x < snap.canvas.width - 2; x += step) {
        const alpha = image.data[(y * snap.canvas.width + x) * 4 + 3];
        if (alpha > 34) pts.push({ x: x - snap.cx, y: y - snap.cy });
      }
    }
    // CLOCK同様、輪郭を粒へ崩す。水槽では魚が小さいため最大64粒に抑える。
    for (let i = pts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    return pts.slice(0, 64).map((pt, index) => ({
      ...pt,
      glyph: String(Math.floor(Math.random() * 10)),
      drift: Math.sin((index + 1) * 2.17) * (5 + Math.random() * 5),
      fall: 44 + Math.random() * 52 + Math.max(0, pt.y) * 0.18,
      startLift: 50 + (index % 5) * 6 + Math.random() * 18,
      phase: Math.random() * Math.PI * 2
    }));
  }

  startCyberFishFx(fish, mode, timestamp) {
    const duration = mode === "RAIN" ? 820 : 390; // PromptTerm CLOCKと同じ基本尺。
    const active = {
      fish,
      mode,
      startAt: timestamp,
      endAt: timestamp + duration,
      seed: Math.random() * 1000,
      rain: mode === "RAIN" ? this.sampleCyberFishRain(fish) : null
    };
    fish.cyberFx = active;
    this.cyberFishFxActive = active;
    if (window.cyberAudio && typeof window.cyberAudio.playCyberFishFx === "function") {
      window.cyberAudio.playCyberFishFx(mode);
    }
  }

  drawCyberGlitchFish(ctx, fish, timestamp) {
    const fxState = fish.cyberFx;
    if (!fxState) { fish.draw(ctx, 1.0); return; }
    const t = Math.max(0, Math.min(1, (timestamp - fxState.startAt) / 390));
    const snap = this.renderFishFxSnapshot(fish);
    const w = snap.canvas.width, h = snap.canvas.height;
    const dx = fish.pos.x - snap.cx, dy = fish.pos.y - snap.cy;
    const stepPhase = Math.floor(t * 8);
    const pulse = stepPhase % 2 ? 1 : -1;

    ctx.save();
    // CLOCKのGLITCH同様、短いsteps感で横ズレと明度乱れを入れる。
    ctx.globalAlpha = 0.72 + 0.25 * Math.abs(Math.sin(t * Math.PI * 6));
    ctx.filter = `brightness(${1.0 + 0.50 * Math.abs(Math.sin(t * Math.PI * 8))})`;
    ctx.drawImage(snap.canvas, dx, dy);
    ctx.filter = "none";

    const sliceCount = 6;
    const sliceH = h / sliceCount;
    for (let i = 0; i < sliceCount; i++) {
      const sy = i * sliceH;
      const shift = pulse * (i % 2 ? 1 : -1) * (2.5 + (i % 3) * 1.8) * this.scale;
      ctx.globalAlpha = 0.50 + 0.30 * ((i + stepPhase) % 2);
      ctx.drawImage(snap.canvas, 0, sy, w, sliceH, dx + shift, dy + sy, w, sliceH);
    }

    // ごく短い色分離ゴースト。魚種の色を壊さないよう弱くする。
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.18;
    ctx.drawImage(snap.canvas, dx + 3.0 * this.scale * pulse, dy - 0.6 * this.scale);
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }

  drawCyberRainFish(ctx, fish, timestamp) {
    const fxState = fish.cyberFx;
    if (!fxState || !fxState.rain?.length) { fish.draw(ctx, 1.0); return; }
    const elapsed = timestamp - fxState.startAt;
    const total = 820;
    const t = Math.max(0, Math.min(1, elapsed / total));
    const points = fxState.rain;
    const color = fish.color || "#7ef23a";

    ctx.save();
    ctx.font = `${Math.max(6, 7.0 * this.scale)}px ui-monospace, SFMono-Regular, Consolas, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = color;
    ctx.shadowBlur = 4.5 * this.scale;

    if (t < 0.46) {
      const q = t / 0.46;
      // collapse: 元の魚を一瞬残し、その輪郭位置から粒子が下へ崩れる。
      if (q < 0.16) {
        ctx.globalAlpha = 1 - q * 4.5;
        fish.draw(ctx, 1.0);
      }
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const local = Math.max(0, Math.min(1, (q - (i % 9) * 0.012) / 0.86));
        const eased = 1 - Math.pow(1 - local, 2.25);
        const x = fish.pos.x + p.x + p.drift * eased * this.scale;
        const y = fish.pos.y + p.y + p.fall * eased * this.scale;
        ctx.globalAlpha = (1 - eased) * 0.95;
        ctx.fillStyle = color;
        ctx.fillText(p.glyph, x, y);
      }
    } else if (t < 0.88) {
      // rebuild: CLOCKの再構築と同じく上方から元の魚形状へ収束。
      const q = (t - 0.46) / 0.42;
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const delay = (i % 11) * 0.014;
        const local = Math.max(0, Math.min(1, (q - delay) / (1 - delay)));
        const eased = 1 - Math.pow(1 - local, 2.8);
        const startY = p.y - p.startLift * this.scale;
        const x = fish.pos.x + p.x + p.drift * (1 - eased) * 0.45 * this.scale;
        const y = fish.pos.y + startY + (p.y - startY) * eased;
        ctx.globalAlpha = 0.18 + eased * 0.82;
        ctx.fillStyle = color;
        ctx.fillText(p.glyph, x, y);
      }
    } else {
      // ignite: 最後だけ実体を短く点火させて通常描画へ戻す。
      const q = (t - 0.88) / 0.12;
      ctx.globalAlpha = 0.35 + 0.65 * q;
      ctx.filter = `brightness(${1.55 - q * 0.55}) blur(${(1 - q) * 0.6}px)`;
      fish.draw(ctx, 1.0);
      ctx.filter = "none";
    }
    ctx.restore();
  }

  getFishStyleContext(ctx, fish, cyber = false) {
    // v113: no Proxy in the hot fish-render path. Shared BODY outline width is
    // authored explicitly in each species renderer; fins/markings keep their own widths.
    // Species-specific CYBER emitters remain explicit additive passes.
    return ctx;
  }

  drawCyberFishWithFx(ctx, fish, timestamp) {
    // PAKU: NATURAL only, unconditionally - the CYBER RAIN/GLITCH fish draw never runs.
    fish.draw(this.getFishStyleContext(ctx, fish, false), 1.0);
  }

  drawFishBand(ctx, bandIndex, timestamp) {
    if (this.modeTransitionActive) return;
    for (const fish of this.fishes) {
      const band = Number.isFinite(fish.depthBandIndex) ? fish.depthBandIndex : 2;
      if (band !== bandIndex) continue;
      this.drawCyberFishWithFx(ctx, fish, timestamp);
      if (this.scanModeActive) this.drawTargetLockOn(ctx, fish);
    }
  }

  start() {
    if (this._running) return;
    this._running = true;

    // 高リフレッシュレート環境でもシミュレーション／描画は最大60fps。
    // requestAnimationFrame自体は維持し、60fpsを下回る環境では無理に補間しない。
    const frameInterval = 1000 / 60;
    let lastFrameTime = 0;

    const loop = (timestamp) => {
      if (!this._running) return;
      this._animationFrame = requestAnimationFrame(loop);

      if (!lastFrameTime) lastFrameTime = timestamp - frameInterval;
      const elapsed = timestamp - lastFrameTime;
      // 60Hzディスプレイの微小なタイムスタンプ誤差で隔フレーム化しないよう0.5msだけ許容。
      if (elapsed + 0.5 < frameInterval) return;

      lastFrameTime = timestamp - (elapsed % frameInterval);
      this.update(timestamp);
      this.draw(timestamp);
    };

    this._animationFrame = requestAnimationFrame(loop);
  }

  stop() {
    this._running = false;
    if (this._animationFrame) {
      cancelAnimationFrame(this._animationFrame);
      this._animationFrame = null;
    }
  }

  draw(timestamp = performance.now()) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.drawWidth, this.drawHeight);
    const scale = this.scale;
    const effectiveLighting = this.getEffectiveLighting();

    // 背景と水草本体は別DOM Canvas。CYBER AIRを水草より奥へ挟めるよう分離。
    this.rebuildStaticLayer();
    this.rebuildStaticPlantLayer();

    const tank = this.getTankBounds();
    ctx.save();
    ctx.beginPath();
    ctx.rect(tank.left, tank.top, tank.right - tank.left, tank.bottom - tank.top);
    ctx.clip();

    this.planktons.forEach(p => p.draw(ctx));

    // CYBER AIR is a low-resolution offscreen cache copied behind all plant/fish bands.
    // NATURAL bubbles remain in the foreground path below.
    this.drawCyberAirCache(ctx, timestamp);

    // CYBER時だけ、PromptTerm CLOCK由来のRAIN / GLITCHを一定間隔で1匹に発火。
    this.updateCyberFishFx(timestamp);

    // v94の実レイヤー合成。魚のz順を植物ゾーンの間へ実際に挟む。
    // 0 最奥魚 -> BG -> 1 奥魚 -> MID -> 2 中層魚 -> FG -> 3 手前魚 -> 4 底生。
    this.drawFishBand(ctx, 0, timestamp);
    this.drawPlantZone(ctx, "background");
    this.drawFishBand(ctx, 1, timestamp);
    this.drawPlantZone(ctx, "midground");
    this.drawFishBand(ctx, 2, timestamp);
    this.drawPlantZone(ctx, "foreground");

    // 底面イベントは前景草より手前。砂埃はコリドラスの足元、エビはカーペット表面に見える。
    this.dustParticles.forEach(d => d.draw(ctx));
    this.scanWaves.forEach(w => w.draw(ctx));
    this.bubbles.forEach(b => b.draw(ctx)); // PAKU: NATURAL only, unconditionally.
    this.packets.forEach(p => p.draw(ctx));
    this.drawFishBand(ctx, 3, timestamp);
    this.drawFishBand(ctx, 4, timestamp);

    // 旧CyberPlant/epiphyteの軽量モーション用。現行Botanical構成では通常空。
    this.renderPlantLayer(timestamp);

    // Dynamic flicker is only the cheap darkness overlay. External colour/light
    // is already baked into the static background cache.
    this.drawLightLevel(ctx);

    ctx.restore(); // tank clip
    this.drawTankCube(ctx, true);

    // スキャンレーザー線の描画
    if (this.scanModeActive) {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 0, 127, 0.65)";
      ctx.lineWidth = 1.5 * scale;
      ctx.shadowBlur = 10 * (window.aquariumInstance?.glowScale || 1);
      ctx.shadowColor = "rgba(255, 0, 127, 0.8)";
      
      ctx.beginPath();
      const tank = this.getTankBounds();
      ctx.moveTo(tank.left, this.scanLaserY);
      ctx.lineTo(tank.right, this.scanLaserY);
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 0, 127, 0.8)";
      ctx.font = `${8 * scale}px monospace`;
      ctx.fillText("TACTICAL SWEEPING...", 15 * scale, this.scanLaserY - 4 * scale);
      ctx.fillText("SYS_RADAR_SCAN", this.drawWidth - 90 * scale, this.scanLaserY + 10 * scale);
      ctx.restore();
    }
  }

  drawTankCube(ctx, foreground = false) {
    // v36: 背景グリッド／奥行きガイドは撤去。
    // 水槽の奥行きは照明・底床・水草だけで見せる。
    return;
  }

  // 水面メッシュの描画 (スケール連動)
  drawWaterSurface(ctx) {
    const scale = this.scale;
    ctx.save();
    const palette = this.getThemePalette();
    ctx.strokeStyle = palette.surfaceMain;
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    
    const tank = this.getTankBounds();
    const steps = 30;
    const stepWidth = (tank.right - tank.left) / steps;
    const surfaceY = tank.top + 10 * scale;
    
    ctx.moveTo(tank.left, surfaceY + Math.sin(this.surfacePhase) * 4 * scale);
    for (let i = 0; i <= steps; i++) {
      const x = tank.left + i * stepWidth;
      const y = surfaceY + Math.sin(this.surfacePhase + i * 0.45) * 5 * scale;
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.strokeStyle = palette.surfaceRays;
    for (let i = 1; i < steps; i += 4) {
      const x = tank.left + i * stepWidth;
      const y = surfaceY + Math.sin(this.surfacePhase + i * 0.45) * 5 * scale;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.sin(this.surfacePhase * 0.5) * 15 * scale, y + 70 * scale);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 細粒砂の底床。コリドラスの採餌面を広く残す。
  drawBottomTerrain(ctx) {
    const scale = this.scale;
    const light = true; // PAKU: NATURAL only, unconditionally - see themeMode note near class start.
    ctx.save();

    const w = this.drawWidth;
    const h = this.drawHeight;
    const steps = Math.max(48, Math.ceil(w / Math.max(18, 34 * scale)));
    const stepWidth = w / steps;

    const fill = ctx.createLinearGradient(0, h - 58 * scale, 0, h);
    if (light) {
      fill.addColorStop(0, "rgba(239,226,195,0.95)");
      fill.addColorStop(0.48, "rgba(221,205,171,0.975)");
      fill.addColorStop(1, "rgba(193,176,146,0.99)");
    } else {
      fill.addColorStop(0, "rgba(157,138,98,0.90)");
      fill.addColorStop(0.48, "rgba(112,96,68,0.96)");
      fill.addColorStop(1, "rgba(67,58,44,0.99)");
    }
    ctx.fillStyle = fill;
    ctx.strokeStyle = light ? "rgba(249,239,214,0.44)" : "rgba(196,170,116,0.34)";
    ctx.lineWidth = Math.max(0.65, 0.9 * scale);

    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i <= steps; i++) {
      const x = i * stepWidth;
      ctx.lineTo(x, this.getTerrainHeight(x));
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // SFターゲットロックオン表示 (スケール連動)
  drawTargetLockOn(ctx, fish) {
    const scale = this.scale;
    const size = fish.size * 1.6 * scale;
    const x = fish.pos.x;
    const y = fish.pos.y;

    ctx.save();
    ctx.strokeStyle = fish.color;
    ctx.lineWidth = 1;
    ctx.shadowBlur = 8 * (window.aquariumInstance?.glowScale || 1);
    ctx.shadowColor = fish.color;

    // 1. 回転レティクル
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.scanAngle);
    ctx.strokeRect(-size, -size, size * 2, size * 2);
    ctx.restore();

    // 2. 四隅のロックオンブラケット
    const bLen = 5 * scale;
    const bDist = size + 3 * scale;
    ctx.beginPath();
    // 左上
    ctx.moveTo(x - bDist, y - bDist + bLen); ctx.lineTo(x - bDist, y - bDist); ctx.lineTo(x - bDist + bLen, y - bDist);
    // 右上
    ctx.moveTo(x + bDist, y - bDist + bLen); ctx.lineTo(x + bDist, y - bDist); ctx.lineTo(x + bDist - bLen, y - bDist);
    // 左下
    ctx.moveTo(x - bDist, y + bDist - bLen); ctx.lineTo(x - bDist, y + bDist); ctx.lineTo(x - bDist + bLen, y + bDist);
    // 右下
    ctx.moveTo(x + bDist, y + bDist - bLen); ctx.lineTo(x + bDist, y + bDist); ctx.lineTo(x + bDist - bLen, y + bDist);
    ctx.stroke();

    // 3. ロックオンパラメータ窓
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(4, 7, 14, 0.85)";
    ctx.strokeStyle = "rgba(" + this.hexToRgb(fish.color) + ", 0.4)";
    ctx.lineWidth = 1;

    const infoWidth = 90 * scale;
    const infoHeight = 33 * scale;
    const infoX = x + size + 6 * scale;
    const infoY = y - 16 * scale;

    ctx.fillRect(infoX, infoY, infoWidth, infoHeight);
    ctx.strokeRect(infoX, infoY, infoWidth, infoHeight);

    ctx.fillStyle = fish.color;
    ctx.font = `${8 * scale}px monospace`;
    ctx.fillText(`ID: ${fish.name.split('.')[0]}`, infoX + 6 * scale, infoY + 9 * scale);
    ctx.fillText(`SPD: ${(fish.vel.mag() / scale).toFixed(2)}m/s`, infoX + 6 * scale, infoY + 18 * scale); // 速度表示もスケール補正
    ctx.fillText(`DEP: ${Math.round(y / scale)}m`, infoX + 6 * scale, infoY + 27 * scale);

    // 接続メッシュ線
    ctx.strokeStyle = "rgba(" + this.hexToRgb(fish.color) + ", 0.12)";
    ctx.lineWidth = 0.8;
    this.fishes.forEach(other => {
      if (other !== fish) {
        const d2 = fish.pos.distSq(other.pos);
        if (d2 < (100 * scale) ** 2) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(other.pos.x, other.pos.y);
          ctx.stroke();
        }
      }
    });

    ctx.restore();
  }

  hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) {
      hex = hex.split('').map(x => x + x).join('');
    }
    const num = parseInt(hex, 16);
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
  }

  updateHudMetrics() {
    const fpsElem = document.getElementById("hud-fps");
    const loadElem = document.getElementById("hud-load");
    const threadElem = document.getElementById("hud-threads");
    const label1 = document.getElementById("hud-left-label-1");
    const value1 = document.getElementById("hud-left-value-1");
    const label2 = document.getElementById("hud-left-label-2");
    const label3 = document.getElementById("hud-left-label-3");
    const renderLabel = document.getElementById("hud-render-label");

    if (fpsElem) fpsElem.innerText = `${this.stats.fps} FPS`;

    if (this.themeMode === "light") {
      if (label1) label1.innerText = "FISH:";
      if (value1) value1.innerText = `${this.fishes.length}`;
      if (label2) label2.innerText = "LIGHT:";
      if (threadElem) threadElem.innerText = `${Math.round(this.lighting * 100)}%`;
      if (label3) label3.innerText = "AIR:";
      if (loadElem) loadElem.innerText = `${Math.round(this.bubblerRate * 100)}%`;
      if (renderLabel) renderLabel.innerText = "FPS:";
    } else {
      if (label1) label1.innerText = "SYS_CORE_NODE:";
      if (value1) value1.innerText = "ONLINE";
      if (label2) label2.innerText = "NET_SYNC:";
      if (threadElem) threadElem.innerText = `${this.fishes.length} Nodes`;
      if (label3) label3.innerText = "SYS_LOAD:";
      if (loadElem) loadElem.innerText = `${this.stats.systemLoad}%`;
      if (renderLabel) renderLabel.innerText = "MAIN_RENDER:";
    }
  }

  logEvent(category, text) {
    const logBody = document.getElementById("log-body");
    if (!logBody) return;

    // 鑑賞画面では自動生態ログを表示しない。UI操作の短い通知だけ通す。
    if (category !== "UI") return;

    const logEntry = document.createElement("div");
    logEntry.className = "log-entry";
    const message = document.createElement("span");
    message.className = "message";
    message.textContent = String(text);
    logEntry.appendChild(message);

    logBody.appendChild(logEntry);
    while (logBody.children.length > 2) logBody.removeChild(logBody.firstChild);

    const dismiss = () => {
      if (!logEntry.isConnected) return;
      logEntry.classList.add("toast-exit");
      setTimeout(() => logEntry.remove(), 700);
    };
    setTimeout(dismiss, 2900);
  }
}

window.triggerBettaFlare = function() {
  // フレアリングは生態表現だけ。鑑賞中の自動ログは出さない。
};
