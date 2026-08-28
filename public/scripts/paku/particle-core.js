(() => {
  "use strict";

  const PARTICLE_COUNT = 310;
  const BASE_SEED = 0xCA1407;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const clamp01 = v => Math.max(0, Math.min(1, v));

  class ParticleOrb {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: true });
      this.dpr = 1;
      this.width = 1;
      this.height = 1;
      this.radius = 1;
      this.last = performance.now();
      this.lastRender = 0;
      this.renderInterval = 1000 / 30; // ヘッダー装飾は30fpsで十分。水槽本体の描画時間を優先する。
      this.running = true;
      this.rand = mulberry32(BASE_SEED);
      this.particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => this.makeParticle(i));
      this.resize = this.resize.bind(this);
      this.frame = this.frame.bind(this);
      this.resizeObserver = new ResizeObserver(this.resize);
      this.resizeObserver.observe(canvas);
      document.addEventListener("visibilitychange", () => {
        this.running = !document.hidden;
        if (this.running) {
          this.last = performance.now();
          requestAnimationFrame(this.frame);
        }
      });
      this.resize();
      requestAnimationFrame(this.frame);
    }

    makeParticle(i) {
      const core = this.rand() < 0.34;
      const r = core
        ? Math.pow(this.rand(), 0.78) * 0.72
        : 0.28 + Math.pow(this.rand(), 0.42) * 0.72;
      return {
        index: i,
        core,
        r,
        theta: this.rand() * Math.PI * 2,
        phi: Math.asin(this.rand() * 2 - 1) * (0.70 + this.rand() * 0.27),
        spin: (0.11 + this.rand() * 0.22) * (core ? 1.18 : 1),
        drift: (this.rand() - 0.5) * 0.065,
        radialSpeed: 0.26 + this.rand() * 0.48,
        radialAmp: (core ? 0.16 : 0.08) + this.rand() * 0.055,
        size: 0.20 + this.rand() * 0.88,
        phase: this.rand() * Math.PI * 2,
        pulse: 0.65 + this.rand() * 1.55,
        band: this.rand(),
        spark: this.rand() < 0.10,
        cluster: this.rand(),
        lastX: null,
        lastY: null
      };
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.width = Math.max(1, rect.width);
      this.height = Math.max(1, rect.height);
      const pw = Math.max(1, Math.round(this.width * this.dpr));
      const ph = Math.max(1, Math.round(this.height * this.dpr));
      if (this.canvas.width !== pw || this.canvas.height !== ph) {
        this.canvas.width = pw;
        this.canvas.height = ph;
      }
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.radius = Math.min(this.width * 0.42, this.height * 0.455);
    }

    frame(now) {
      if (!this.running) return;
      requestAnimationFrame(this.frame);
      if (this.lastRender && now - this.lastRender < this.renderInterval) return;
      const dt = Math.min(0.050, Math.max(0.001, (now - this.last) / 1000));
      this.last = now;
      this.lastRender = now;
      this.draw(now * 0.001, dt);
    }

    draw(time, dt) {
      const ctx = this.ctx;
      const natural = document.body.classList.contains("theme-light");
      const cx = this.width * 0.50;
      const cy = this.height * 0.49;
      const R = this.radius;

      ctx.clearRect(0, 0, this.width, this.height);

      // Almost no explicit sphere. The particle volume itself should define the object.
      const haze = ctx.createRadialGradient(cx - R * 0.08, cy - R * 0.10, 0, cx, cy, R * 1.02);
      if (natural) {
        haze.addColorStop(0.00, "rgba(246,253,255,0.145)");
        haze.addColorStop(0.46, "rgba(135,207,232,0.060)");
        haze.addColorStop(1.00, "rgba(72,154,190,0.00)");
      } else {
        haze.addColorStop(0.00, "rgba(2,12,18,0.28)");
        haze.addColorStop(0.58, "rgba(0,5,9,0.12)");
        haze.addColorStop(1.00, "rgba(0,0,0,0.00)");
      }
      ctx.fillStyle = haze;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.02, 0, Math.PI * 2);
      ctx.fill();

      // The whole field slowly precesses, while two moving density wells compress the cloud.
      const rotY = time * 0.20;
      const rotX = -0.36 + Math.sin(time * 0.13) * 0.10;
      const rotZ = Math.sin(time * 0.10) * 0.18;
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      const cosZ = Math.cos(rotZ), sinZ = Math.sin(rotZ);
      const hotA = time * 0.29;
      const hotB = -time * 0.21 + 2.35;
      const projected = [];

      for (const p of this.particles) {
        p.theta += p.spin * dt * (0.60 + p.r * 0.92);
        p.phi += p.drift * dt + Math.sin(time * 0.25 + p.phase) * 0.00032;
        p.phi = Math.max(-1.34, Math.min(1.34, p.phi));

        // Moving density wells. This compresses angles instead of merely changing brightness,
        // so clumps genuinely form and drift around the sphere.
        const well = p.cluster < 0.58 ? hotA : hotB;
        const compression = p.core ? 0.30 : 0.20;
        const theta = p.theta - Math.sin(p.theta - well) * compression;
        const phiWell = Math.sin(well * 0.73 + p.cluster * 4.0) * 0.34;
        const phi = p.phi - Math.sin(p.phi - phiWell) * (p.core ? 0.18 : 0.10);

        // A reversible in/out spiral; no particle ever simply orbits on a shell.
        const radialBreath = Math.sin(time * p.radialSpeed + p.phase) * p.radialAmp;
        const innerPulse = p.core ? Math.sin(time * 0.78 + p.phase * 0.7) * 0.08 : 0;
        const rr = Math.max(0.055, p.r * (0.92 + radialBreath) + innerPulse);
        const lat = phi + Math.sin(theta * 1.55 + p.phase) * 0.105 * (1 - rr);
        const ring = Math.cos(lat);

        let x = rr * ring * Math.cos(theta);
        let y = rr * Math.sin(lat);
        let z = rr * ring * Math.sin(theta);

        // Inner particles are twisted more strongly, creating the "sucked into the core" feel.
        const twist = (1 - rr) * 1.18 + 0.12 * Math.sin(time * 0.62 + p.phase);
        const ct = Math.cos(twist), st = Math.sin(twist);
        const tx = x * ct - y * st;
        const ty = x * st + y * ct;
        x = tx;
        y = ty;

        // A second tilt makes the flow read as a 3-D knot rather than a flat disc.
        const xz = x * cosY - z * sinY;
        const zz = x * sinY + z * cosY;
        const yz = y * cosX - zz * sinX;
        const zz2 = y * sinX + zz * cosX;
        const xx2 = xz * cosZ - yz * sinZ;
        const yy2 = xz * sinZ + yz * cosZ;

        const perspective = 0.76 + (zz2 + 1) * 0.16;
        const sx = cx + xx2 * R * perspective;
        const sy = cy + yy2 * R * perspective;
        const depth = clamp01((zz2 + 1) * 0.5);
        const centerFactor = clamp01(1 - Math.hypot(xx2, yy2) * 0.68);
        const clump = 0.72 + 0.28 * Math.max(0, Math.cos(theta - well));

        projected.push({ p, sx, sy, depth, centerFactor, clump });
      }

      projected.sort((a, b) => a.depth - b.depth);

      ctx.save();
      ctx.globalCompositeOperation = natural ? "source-over" : "lighter";
      for (const q of projected) {
        const { p, sx, sy, depth, centerFactor, clump } = q;
        const front = 0.18 + depth * 0.82;
        const flicker = p.spark ? (0.52 + 0.48 * Math.max(0, Math.sin(time * 3.3 + p.phase))) : 1;
        const pulse = 0.86 + 0.14 * Math.sin(time * p.pulse + p.phase);
        const alpha = front * flicker * pulse * clump * (natural ? 0.78 : 0.96);
        const pr = p.size * (0.56 + depth * 1.10) * (0.90 + centerFactor * 0.18);

        let rgb;
        if (natural) {
          rgb = p.band < 0.42 ? [116, 194, 224] : (p.band < 0.78 ? [205, 237, 247] : [255, 255, 255]);
        } else {
          rgb = p.band < 0.40 ? [60, 221, 255] : (p.band < 0.74 ? [174, 247, 255] : [255, 255, 255]);
        }

        // Only the brightest/front particles leave tiny motion hints.
        if (p.lastX !== null && p.spark && depth > 0.62) {
          ctx.shadowBlur = 0;
          ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha * (natural ? 0.12 : 0.22)})`;
          ctx.lineWidth = Math.max(0.35, pr * 0.44);
          ctx.beginPath();
          ctx.moveTo(p.lastX, p.lastY);
          ctx.lineTo(sx, sy);
          ctx.stroke();
        }

        p.lastX = sx;
        p.lastY = sy;

        if (!natural && (p.spark || depth > 0.80)) {
          ctx.shadowColor = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.66 * alpha})`;
          ctx.shadowBlur = p.spark ? 4.2 : 2.2;
        } else {
          ctx.shadowColor = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.26 * alpha})`;
          ctx.shadowBlur = natural ? 1.8 : 1.1;
        }

        ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, pr, 0, Math.PI * 2);
        ctx.fill();

        // A small halo on a minority of foreground particles adds depth without drawing a rim.
        if ((p.spark || p.band > 0.91) && depth > 0.66) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha * 0.10})`;
          ctx.beginPath();
          ctx.arc(sx, sy, pr * 2.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // Very faint internal flow wisps. They never define the sphere edge.
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      for (let i = 0; i < 2; i++) {
        const a = time * (0.15 + i * 0.035) + i * 2.4;
        const x = cx + Math.cos(a * 0.8) * R * 0.08;
        const y = cy + Math.sin(a * 1.1) * R * 0.12;
        ctx.strokeStyle = natural
          ? `rgba(166,221,239,${0.034 - i * 0.006})`
          : `rgba(99,235,255,${0.052 - i * 0.010})`;
        ctx.lineWidth = 0.55;
        ctx.beginPath();
        ctx.ellipse(x, y, R * (0.63 - i * 0.06), R * (0.18 + i * 0.03), a * 0.28, 0.10 * Math.PI, 1.48 * Math.PI);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("particle-orb-canvas");
    if (canvas) new ParticleOrb(canvas);
  });
})();
