import type { InputRainGenre } from "./inputRainPrompts";

/**
 * The rain behind INPUT RAIN's falling prompt, drawn on one canvas per lane. Its strength
 * follows the player's own typing (pulse() per correct key, decaying when the hands stop),
 * so a fast run literally brings the downpour. The bottom band is a water surface: rain
 * lands there as small ripples, and while the prompt nears the bottom the ripples gather
 * under it in the genre's warning colour.
 *
 * Colours live here rather than in CSS because canvas can't read the skin's variables.
 */

type Streak = { x: number; y: number; vy: number; vx: number; len: number; alpha: number; width: number };
type Ripple = { x: number; y: number; r: number; max: number; life: number; age: number; color: string; flat: number; width: number };
type Bead = { x: number; y: number; r: number; vy: number; alpha: number; slide: number };

type SkyStyle = {
  rain: string;
  ripple: string;
  danger: string;
  /** Horizontal drift per unit of fall — the slant of the rain. */
  slant: number;
  speed: [number, number];
  length: [number, number];
  width: [number, number];
  alpha: [number, number];
  /** Streaks spawned per second at full strength. */
  rate: number;
  /** Water drops clinging to the glass (the window skins). */
  beads: number;
  surface: string;
};

const styles: Record<InputRainGenre, SkyStyle> = {
  daily: {
    rain: "214,226,246", ripple: "214,226,246", danger: "255,178,120", slant: -0.1,
    speed: [620, 900], length: [16, 34], width: [0.8, 1.3], alpha: [0.18, 0.42], rate: 150, beads: 46, surface: "120,140,180",
  },
  business: {
    rain: "176,198,226", ripple: "176,198,226", danger: "255,112,112", slant: 0,
    speed: [900, 1250], length: [22, 44], width: [0.6, 1], alpha: [0.14, 0.34], rate: 170, beads: 22, surface: "90,110,150",
  },
  yoji: {
    rain: "34,28,24", ripple: "34,28,24", danger: "192,57,43", slant: 0.3,
    speed: [780, 1080], length: [42, 96], width: [0.6, 1.1], alpha: [0.16, 0.36], rate: 120, beads: 0, surface: "34,28,24",
  },
  terminal: {
    rain: "134,241,90", ripple: "134,241,90", danger: "255,122,92", slant: 0,
    speed: [480, 760], length: [6, 14], width: [1, 1], alpha: [0.12, 0.3], rate: 120, beads: 0, surface: "134,241,90",
  },
};

const SURFACE_HEIGHT = 46;
const IDLE_STRENGTH = 0.16;
const ENERGY_DECAY_SECONDS = 1.3;

function between([min, max]: [number, number]) {
  return min + Math.random() * (max - min);
}

export type SkyDanger = { x: number; progress: number } | null;

export class InputRainSky {
  private context: CanvasRenderingContext2D | null;
  private width = 0;
  private height = 0;
  private ratio = 1;
  private style: SkyStyle;
  private streaks: Streak[] = [];
  private ripples: Ripple[] = [];
  private beads: Bead[] = [];
  private energy = 0;
  private energyScale = 3.4;
  private idle = IDLE_STRENGTH;
  private frame = 0;
  private last = 0;
  private dangerClock = 0;
  private running = false;
  private paused = false;
  private reduced = false;
  private observer: ResizeObserver | null = null;
  private dangerSource: (() => SkyDanger) | null = null;

  constructor(private canvas: HTMLCanvasElement, genre: InputRainGenre) {
    this.context = canvas.getContext("2d");
    this.style = styles[genre];
    try { this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* Motion stays on. */ }
    this.resize();
    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(canvas);
    }
    this.seedBeads();
  }

  setGenre(genre: InputRainGenre) {
    this.style = styles[genre];
    this.streaks = [];
    this.ripples = [];
    this.seedBeads();
  }

  /** Flick input runs at roughly half the keystroke rate of a keyboard, so it saturates sooner. */
  setInputScale(scale: number) {
    this.energyScale = scale;
  }

  setIdle(strength: number) {
    this.idle = strength;
  }

  setDangerSource(source: (() => SkyDanger) | null) {
    this.dangerSource = source;
  }

  setPaused(paused: boolean) {
    this.paused = paused;
  }

  /** One correct keystroke's worth of rain. */
  pulse(amount = 1) {
    this.energy += amount;
  }

  /** Cuts the downpour back after a miss, without silencing it outright. */
  damp() {
    this.energy *= 0.45;
  }

  strength() {
    return this.idle + (1 - this.idle) * (1 - Math.exp(-this.energy / this.energyScale));
  }

  /** Rings out from where a prompt was just typed away. */
  splash(x: number, y: number) {
    if (this.reduced) return;
    const color = this.style.ripple;
    for (let index = 0; index < 3; index += 1) {
      this.ripples.push({ x, y, r: 4, max: 70 + index * 38, life: 0.7 + index * 0.18, age: -index * 0.07, color, flat: 0.34, width: 1.4 - index * 0.3 });
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (!this.paused) this.step(dt);
      this.draw();
      this.frame = window.requestAnimationFrame(loop);
    };
    this.frame = window.requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    window.cancelAnimationFrame(this.frame);
  }

  destroy() {
    this.stop();
    this.observer?.disconnect();
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.ratio = Math.min(2, window.devicePixelRatio || 1);
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.width * this.ratio);
    this.canvas.height = Math.round(this.height * this.ratio);
    this.seedBeads();
  }

  private seedBeads() {
    this.beads = [];
    const count = this.reduced ? 0 : this.style.beads;
    for (let index = 0; index < count; index += 1) this.beads.push(this.newBead(Math.random() * this.height));
  }

  private newBead(y: number): Bead {
    return { x: Math.random() * this.width, y, r: 0.8 + Math.random() ** 2 * 3.2, vy: 0, alpha: 0.18 + Math.random() * 0.32, slide: 0 };
  }

  private step(dt: number) {
    const style = this.style;
    this.energy *= Math.exp(-dt / ENERGY_DECAY_SECONDS);
    const strength = this.strength();
    const surfaceTop = this.height - SURFACE_HEIGHT;

    if (!this.reduced) {
      let spawn = style.rate * strength * strength * dt * Math.max(0.75, this.width / 700);
      while (spawn > 0) {
        if (spawn < 1 && Math.random() > spawn) break;
        spawn -= 1;
        const vy = between(style.speed) * (0.85 + strength * 0.3);
        this.streaks.push({
          x: Math.random() * (this.width + Math.abs(style.slant) * this.height) - Math.max(0, style.slant) * this.height,
          y: -between(style.length),
          vy,
          vx: vy * style.slant,
          len: between(style.length),
          alpha: between(style.alpha) * (0.6 + strength * 0.5),
          width: between(style.width),
        });
      }
    }

    const landed: Streak[] = [];
    this.streaks = this.streaks.filter((streak) => {
      streak.x += streak.vx * dt;
      streak.y += streak.vy * dt;
      // Rain lands somewhere across the surface band, not on one hard line, so it reads as depth.
      const landAt = surfaceTop + ((streak.x * 7.31) % 1 + 1) % 1 * (SURFACE_HEIGHT - 8) + 6;
      if (streak.y >= landAt) {
        landed.push(streak);
        return false;
      }
      return true;
    });
    for (const streak of landed) {
      if (Math.random() < 0.55) {
        const y = Math.min(this.height - 4, streak.y);
        const depth = (y - surfaceTop) / SURFACE_HEIGHT;
        this.ripples.push({ x: streak.x, y, r: 1, max: 6 + depth * 14 + Math.random() * 6, life: 0.55 + Math.random() * 0.3, age: 0, color: style.ripple, flat: 0.24, width: 0.8 });
      }
    }

    const danger = this.dangerSource?.() ?? null;
    if (danger && danger.progress > 0.55) {
      const heat = (danger.progress - 0.55) / 0.45;
      this.dangerClock += dt * (2 + heat * 9);
      while (this.dangerClock >= 1) {
        this.dangerClock -= 1;
        const spread = 40 + heat * 80;
        this.ripples.push({
          x: danger.x + (Math.random() - 0.5) * spread,
          y: surfaceTop + 10 + Math.random() * (SURFACE_HEIGHT - 16),
          r: 2,
          max: 22 + heat * 46 + Math.random() * 12,
          life: 0.8 + heat * 0.4,
          age: 0,
          color: style.danger,
          flat: 0.26,
          width: 1.1 + heat * 0.8,
        });
      }
    } else {
      this.dangerClock = 0;
    }

    this.ripples = this.ripples.filter((ripple) => {
      ripple.age += dt;
      if (ripple.age < 0) return true;
      const t = ripple.age / ripple.life;
      ripple.r = 1 + (ripple.max - 1) * (1 - (1 - Math.min(1, t)) ** 2);
      return t < 1;
    });
    if (this.ripples.length > 220) this.ripples.splice(0, this.ripples.length - 220);

    for (const bead of this.beads) {
      if (bead.slide <= 0 && bead.r > 2.4 && Math.random() < dt * 0.05 * (0.4 + strength)) bead.slide = 1;
      if (bead.slide > 0) {
        bead.vy = Math.min(120, bead.vy + dt * 260);
        bead.y += bead.vy * dt;
        bead.x += Math.sin(bead.y * 0.08) * 0.15;
        if (bead.y > this.height + 6) Object.assign(bead, this.newBead(-4));
      }
    }
    // Heavier rain keeps landing fresh drops on the glass.
    if (this.beads.length && Math.random() < dt * strength * 3) {
      const target = this.beads[Math.floor(Math.random() * this.beads.length)];
      if (target.slide <= 0) Object.assign(target, this.newBead(Math.random() * this.height));
    }
  }

  private draw() {
    const context = this.context;
    if (!context) return;
    const style = this.style;
    context.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    context.clearRect(0, 0, this.width, this.height);
    const surfaceTop = this.height - SURFACE_HEIGHT;

    const danger = this.dangerSource?.() ?? null;
    const heat = danger && danger.progress > 0.55 ? (danger.progress - 0.55) / 0.45 : 0;
    const water = context.createLinearGradient(0, surfaceTop, 0, this.height);
    water.addColorStop(0, `rgba(${style.surface},0)`);
    water.addColorStop(1, `rgba(${style.surface},${0.07 + this.strength() * 0.05})`);
    context.fillStyle = water;
    context.fillRect(0, surfaceTop, this.width, SURFACE_HEIGHT);
    if (heat > 0 && danger) {
      const glow = context.createRadialGradient(danger.x, this.height, 0, danger.x, this.height, 120 + heat * 160);
      glow.addColorStop(0, `rgba(${style.danger},${0.16 + heat * 0.34})`);
      glow.addColorStop(1, `rgba(${style.danger},0)`);
      context.fillStyle = glow;
      context.fillRect(0, surfaceTop - 20, this.width, SURFACE_HEIGHT + 20);
    }
    context.strokeStyle = `rgba(${style.surface},${0.16 + heat * 0.2})`;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, surfaceTop + 0.5);
    context.lineTo(this.width, surfaceTop + 0.5);
    context.stroke();

    context.lineCap = "round";
    for (const streak of this.streaks) {
      const tailX = streak.x - (streak.vx / streak.vy) * streak.len;
      const gradient = context.createLinearGradient(tailX, streak.y - streak.len, streak.x, streak.y);
      gradient.addColorStop(0, `rgba(${style.rain},0)`);
      gradient.addColorStop(1, `rgba(${style.rain},${streak.alpha})`);
      context.strokeStyle = gradient;
      context.lineWidth = streak.width;
      context.beginPath();
      context.moveTo(tailX, streak.y - streak.len);
      context.lineTo(streak.x, streak.y);
      context.stroke();
    }

    for (const ripple of this.ripples) {
      if (ripple.age < 0) continue;
      const t = Math.min(1, ripple.age / ripple.life);
      context.strokeStyle = `rgba(${ripple.color},${(1 - t) * 0.55})`;
      context.lineWidth = ripple.width;
      context.beginPath();
      context.ellipse(ripple.x, ripple.y, ripple.r, ripple.r * ripple.flat, 0, 0, Math.PI * 2);
      context.stroke();
    }

    for (const bead of this.beads) {
      if (bead.y > surfaceTop) continue;
      if (bead.slide > 0) {
        context.strokeStyle = `rgba(${style.rain},${bead.alpha * 0.25})`;
        context.lineWidth = bead.r * 0.7;
        context.beginPath();
        context.moveTo(bead.x, Math.max(0, bead.y - 40));
        context.lineTo(bead.x, bead.y);
        context.stroke();
      }
      context.fillStyle = `rgba(${style.rain},${bead.alpha * 0.32})`;
      context.beginPath();
      context.arc(bead.x, bead.y, bead.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = `rgba(255,255,255,${bead.alpha * 0.9})`;
      context.beginPath();
      context.arc(bead.x - bead.r * 0.35, bead.y - bead.r * 0.35, Math.max(0.5, bead.r * 0.28), 0, Math.PI * 2);
      context.fill();
    }
  }
}
