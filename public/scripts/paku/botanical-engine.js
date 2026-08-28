/**
 * BOTANICAL ENGINE FOR CYBER-AQUARIUM
 * Normalization, Hi-DPI Offscreen Texture Caching, VisibleBounds & Anchor Engine
 */

(function(global) {
  'use strict';

  // Seeded Random for Deterministic & Organic Plant Generation
  let ACTIVE_SEED_SALT = 0;
  let ACTIVE_SOURCE_WINDOW = null;
  function sourceRootAllowed(x) {
    return !ACTIVE_SOURCE_WINDOW || (x >= ACTIVE_SOURCE_WINDOW.minX && x <= ACTIVE_SOURCE_WINDOW.maxX);
  }
  class PRNG {
    constructor(seed = 123456) {
      this.m = 0x80000000;
      this.a = 1103515245;
      this.c = 12345;
      const saltedSeed = ((seed || 123456) ^ (ACTIVE_SEED_SALT >>> 0)) >>> 0;
      this.state = saltedSeed || 1;
    }
    next() {
      this.state = (this.a * this.state + this.c) % this.m;
      return this.state / (this.m - 1);
    }
    range(min, max) {
      return min + this.next() * (max - min);
    }
    rangeInt(min, max) {
      return Math.floor(this.range(min, max + 1));
    }
  }

  // Pure Botanical Renderers (Render directly onto transparent canvas without background)
  const Renderers = {
    // -------------------------------------------------------------
    // HARDSCAPE
    // -------------------------------------------------------------
    branchwood(ctx, w, h) {
      const rng = new PRNG(8831);
      ctx.save();
      const baseY = h - 28;

      function drawGnarlyLimb(nodes, depthLevel = 1) {
        if (nodes.length < 2) return;
        const pts = [];
        for (let i = 0; i < nodes.length; i++) {
          const curr = nodes[i];
          if (i === 0) {
            pts.push({ x: curr.x, y: curr.y, w: curr.w, knot: curr.knot });
          } else {
            const prev = nodes[i - 1];
            const steps = Math.max(3, Math.floor(Math.hypot(curr.x - prev.x, curr.y - prev.y) / 14));
            for (let s = 1; s <= steps; s++) {
              const t = s / steps;
              const ix = prev.x + (curr.x - prev.x) * t + (rng.next() - 0.5) * (curr.knot ? 3.5 : 1.2);
              const iy = prev.y + (curr.y - prev.y) * t + (rng.next() - 0.5) * (curr.knot ? 3.5 : 1.2);
              let iw = prev.w + (curr.w - prev.w) * t;
              if (curr.knot && s === Math.floor(steps * 0.5)) iw *= 1.35;
              pts.push({ x: ix, y: iy, w: Math.max(1.0, iw), knot: (s === Math.floor(steps * 0.5) && curr.knot) });
            }
          }
        }

        const lefts = [];
        const rights = [];
        for (let i = 0; i < pts.length; i++) {
          let nx = 0, ny = 0;
          if (i === 0) {
            nx = -(pts[1].y - pts[0].y); ny = pts[1].x - pts[0].x;
          } else if (i === pts.length - 1) {
            nx = -(pts[i].y - pts[i - 1].y); ny = pts[i].x - pts[i - 1].x;
          } else {
            nx = -(pts[i + 1].y - pts[i - 1].y); ny = pts[i + 1].x - pts[i - 1].x;
          }
          const len = Math.hypot(nx, ny) || 1;
          nx /= len; ny /= len;
          const hw = pts[i].w * 0.5;
          lefts.push({ x: pts[i].x + nx * hw, y: pts[i].y + ny * hw });
          rights.push({ x: pts[i].x - nx * hw, y: pts[i].y - ny * hw });
        }

        ctx.beginPath();
        ctx.moveTo(lefts[0].x, lefts[0].y);
        for (let p of lefts) ctx.lineTo(p.x, p.y);
        for (let j = rights.length - 1; j >= 0; j--) ctx.lineTo(rights[j].x, rights[j].y);
        ctx.closePath();

        const grad = ctx.createLinearGradient(nodes[0].x, nodes[0].y, nodes[nodes.length - 1].x, nodes[nodes.length - 1].y);
        if (depthLevel === 0) {
          grad.addColorStop(0, '#1c1510');
          grad.addColorStop(1, '#110c08');
          ctx.fillStyle = grad;
          ctx.fill();
        } else if (depthLevel === 1) {
          grad.addColorStop(0, '#59412f');
          grad.addColorStop(0.4, '#7a5d45');
          grad.addColorStop(0.8, '#473424');
          grad.addColorStop(1, '#2b1e15');
          ctx.fillStyle = grad;
          ctx.fill();

          ctx.strokeStyle = '#18100a';
          ctx.lineWidth = Math.max(1.0, pts[pts.length - 1].w * 0.35);
          ctx.beginPath();
          for (let i = 0; i < rights.length; i++) {
            if (i === 0) ctx.moveTo(rights[i].x, rights[i].y); else ctx.lineTo(rights[i].x, rights[i].y);
          }
          ctx.stroke();

          ctx.strokeStyle = '#b89c7f';
          ctx.lineWidth = Math.max(0.6, pts[pts.length - 1].w * 0.22);
          ctx.beginPath();
          for (let i = 0; i < lefts.length; i++) {
            if (i === 0) ctx.moveTo(lefts[i].x, lefts[i].y); else ctx.lineTo(lefts[i].x, lefts[i].y);
          }
          ctx.stroke();
        } else {
          grad.addColorStop(0, '#70543d');
          grad.addColorStop(0.3, '#9c7c5f');
          grad.addColorStop(0.7, '#5e432e');
          grad.addColorStop(1, '#3b291c');
          ctx.fillStyle = grad;
          ctx.fill();

          ctx.strokeStyle = '#1a110b';
          ctx.lineWidth = Math.max(1.2, pts[pts.length - 1].w * 0.4);
          ctx.beginPath();
          for (let i = 0; i < rights.length; i++) {
            if (i === 0) ctx.moveTo(rights[i].x, rights[i].y); else ctx.lineTo(rights[i].x, rights[i].y);
          }
          ctx.stroke();

          ctx.strokeStyle = '#d6bfa8';
          ctx.lineWidth = Math.max(0.8, pts[pts.length - 1].w * 0.25);
          ctx.beginPath();
          for (let i = 0; i < lefts.length; i++) {
            if (i === 0) ctx.moveTo(lefts[i].x, lefts[i].y); else ctx.lineTo(lefts[i].x, lefts[i].y);
          }
          ctx.stroke();
        }

        pts.forEach((p, idx) => {
          if (p.knot && idx > 2 && idx < pts.length - 2 && depthLevel >= 1) {
            ctx.save();
            ctx.fillStyle = '#140c07';
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, p.w * 0.35, p.w * 0.2, 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#9c7a5d';
            ctx.lineWidth = 0.8;
            ctx.stroke();
            ctx.restore();
          }
        });

        const lastNode = nodes[nodes.length - 1];
        if (lastNode.brokenEnd && depthLevel >= 1) {
          const lastPt = pts[pts.length - 1];
          ctx.save();
          ctx.fillStyle = '#c7b095';
          ctx.beginPath();
          ctx.ellipse(lastPt.x, lastPt.y, lastPt.w * 0.6, lastPt.w * 0.35, 0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#291b12';
          ctx.lineWidth = 0.8;
          ctx.stroke();
          ctx.restore();
        }
      }

      // Background limbs
      drawGnarlyLimb([
        { x: 210, y: baseY + 6, w: 14 },
        { x: 180, y: 220, w: 10 },
        { x: 140, y: 175, w: 7 },
        { x: 85, y: 140, w: 3, brokenEnd: true }
      ], 0);

      drawGnarlyLimb([
        { x: 310, y: 190, w: 12 },
        { x: 380, y: 160, w: 8, knot: true },
        { x: 440, y: 135, w: 4 },
        { x: 495, y: 125, w: 1.5 }
      ], 0);

      // Main Primary Trunk
      drawGnarlyLimb([
        { x: 145, y: baseY + 12, w: 22 },
        { x: 175, y: 235, w: 20 },
        { x: 215, y: 195, w: 25, knot: true },
        { x: 255, y: 168, w: 19 },
        { x: 315, y: 142, w: 15 },
        { x: 375, y: 120, w: 12, knot: true },
        { x: 440, y: 102, w: 8 },
        { x: 505, y: 92, w: 4 },
        { x: 545, y: 88, w: 2.2 }
      ], 2);

      drawGnarlyLimb([
        { x: 195, y: baseY + 10, w: 16 },
        { x: 208, y: 225, w: 18 },
        { x: 215, y: 195, w: 22 }
      ], 1);

      // Ascending Counter-Spire
      drawGnarlyLimb([
        { x: 218, y: 190, w: 15 },
        { x: 212, y: 145, w: 11, knot: true },
        { x: 198, y: 105, w: 8 },
        { x: 185, y: 75, w: 5, knot: true },
        { x: 192, y: 45, w: 2.5, brokenEnd: true }
      ], 2);

      drawGnarlyLimb([
        { x: 205, y: 125, w: 5 },
        { x: 175, y: 110, w: 3 },
        { x: 155, y: 102, w: 1.2 }
      ], 1);

      // Foreground Crossing Root
      drawGnarlyLimb([
        { x: 250, y: 172, w: 14 },
        { x: 285, y: 195, w: 12, knot: true },
        { x: 330, y: 230, w: 10 },
        { x: 370, y: 260, w: 6 },
        { x: 395, y: baseY + 10, w: 3.5, brokenEnd: true }
      ], 2);

      drawGnarlyLimb([
        { x: 285, y: 195, w: 8 },
        { x: 295, y: 215, w: 5, brokenEnd: true }
      ], 2);

      drawGnarlyLimb([
        { x: 385, y: 118, w: 6 },
        { x: 420, y: 88, w: 4 },
        { x: 450, y: 72, w: 2.0 },
        { x: 470, y: 65, w: 1.0 }
      ], 1);

      drawGnarlyLimb([
        { x: 445, y: 101, w: 4.5 },
        { x: 475, y: 115, w: 2.8 },
        { x: 505, y: 122, w: 1.2 }
      ], 1);

      // Ambient Occlusion
      ctx.fillStyle = 'rgba(10, 6, 4, 0.6)';
      ctx.beginPath();
      ctx.ellipse(252, 172, 12, 7, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(216, 192, 14, 8, -0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    },

    epiphytewood(ctx, w, h) {
      const rng = new PRNG(7712);
      const baseY = h - 28;

      ctx.save();
      const woodGrad = ctx.createLinearGradient(120, 100, 480, baseY + 8);
      woodGrad.addColorStop(0, '#4a382a');
      woodGrad.addColorStop(0.5, '#2e2117');
      woodGrad.addColorStop(1, '#18110b');

      ctx.fillStyle = woodGrad;
      ctx.beginPath();
      ctx.moveTo(140, baseY + 8);
      ctx.bezierCurveTo(160, 220, 190, 160, 240, 140);
      ctx.bezierCurveTo(280, 125, 340, 135, 390, 165);
      ctx.bezierCurveTo(430, 190, 470, 210, 495, baseY + 8);
      ctx.lineTo(460, baseY + 13);
      ctx.bezierCurveTo(420, 230, 370, 200, 320, 190);
      ctx.bezierCurveTo(270, 180, 210, 220, 165, baseY + 13);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#120d09';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(210, 175); ctx.bezierCurveTo(250, 160, 290, 155, 345, 170);
      ctx.moveTo(260, 185); ctx.bezierCurveTo(300, 175, 350, 180, 390, 205);
      ctx.stroke();

      ctx.strokeStyle = '#7c624d';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(180, 170); ctx.bezierCurveTo(230, 138, 300, 132, 380, 158);
      ctx.stroke();

      function drawAnubiasLeaf(cx, cy, length, angle, isYoung = false) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        const wL = length * 0.46;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-wL * 0.6, -length * 0.35, -wL, -length * 0.7, 0, -length);
        ctx.bezierCurveTo(wL, -length * 0.7, wL * 0.6, -length * 0.35, 0, 0);
        ctx.closePath();

        const leafGrad = ctx.createLinearGradient(0, 0, 0, -length);
        if (isYoung) {
          leafGrad.addColorStop(0, '#2d5e1e');
          leafGrad.addColorStop(0.5, '#4e992b');
          leafGrad.addColorStop(1, '#78c73e');
        } else {
          leafGrad.addColorStop(0, '#132b10');
          leafGrad.addColorStop(0.5, '#1e4219');
          leafGrad.addColorStop(1, '#2f6327');
        }
        ctx.fillStyle = leafGrad;
        ctx.fill();

        ctx.strokeStyle = isYoung ? '#8ee04a' : '#3d7a31';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -length * 0.95); ctx.stroke();

        ctx.strokeStyle = isYoung ? 'rgba(142, 224, 74, 0.4)' : 'rgba(61, 122, 49, 0.4)';
        ctx.lineWidth = 0.6;
        for (let i = 0.2; i <= 0.8; i += 0.15) {
          const yPos = -length * i;
          ctx.beginPath();
          ctx.moveTo(0, yPos); ctx.lineTo(-wL * 0.45 * (1 - i * 0.5), yPos - length * 0.08);
          ctx.moveTo(0, yPos); ctx.lineTo(wL * 0.45 * (1 - i * 0.5), yPos - length * 0.08);
          ctx.stroke();
        }

        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.ellipse(-wL * 0.2, -length * 0.55, wL * 0.2, length * 0.25, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      function drawTridentFrond(bx, by, len, angle) {
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(angle);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-4, -len * 0.4, 0, -len * 0.5);
        ctx.strokeStyle = '#183818'; ctx.lineWidth = 1.5; ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, -len * 0.5);
        ctx.bezierCurveTo(-5, -len * 0.7, -4, -len * 0.9, 0, -len);
        ctx.bezierCurveTo(4, -len * 0.9, 5, -len * 0.7, 0, -len * 0.5);
        ctx.fillStyle = '#265426'; ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-1, -len * 0.55);
        ctx.bezierCurveTo(-10, -len * 0.62, -18, -len * 0.7, -22, -len * 0.78);
        ctx.bezierCurveTo(-16, -len * 0.75, -8, -len * 0.65, 0, -len * 0.62);
        ctx.fillStyle = '#2d632d'; ctx.fill();

        ctx.beginPath();
        ctx.moveTo(1, -len * 0.58);
        ctx.bezierCurveTo(10, -len * 0.65, 18, -len * 0.73, 20, -len * 0.82);
        ctx.bezierCurveTo(15, -len * 0.78, 8, -len * 0.68, 0, -len * 0.65);
        ctx.fillStyle = '#347334'; ctx.fill();

        ctx.strokeStyle = '#529e52'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(0, -len * 0.5); ctx.lineTo(0, -len * 0.95); ctx.stroke();
        ctx.restore();
      }

      function drawBolbitisFrond(bx, by, len, angle) {
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(angle);
        ctx.strokeStyle = '#0e2b19'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(8, -len * 0.4, -5, -len * 0.7, 0, -len); ctx.stroke();

        const pinnaeCount = 9;
        for (let i = 2; i < pinnaeCount; i++) {
          const t = i / pinnaeCount;
          const py = -len * t;
          const px = (t < 0.5 ? 8 : -5) * Math.sin(t * Math.PI);
          const pLen = (1 - t * 0.6) * 22;

          ctx.fillStyle = 'rgba(18, 64, 38, 0.85)';
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.bezierCurveTo(px - pLen * 0.6, py - 4, px - pLen, py - 2, px - pLen * 0.9, py + 3);
          ctx.bezierCurveTo(px - pLen * 0.5, py + 2, px - 2, py + 1, px, py);
          ctx.fill();

          ctx.fillStyle = 'rgba(28, 89, 53, 0.85)';
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.bezierCurveTo(px + pLen * 0.6, py - 4, px + pLen, py - 2, px + pLen * 0.9, py + 3);
          ctx.bezierCurveTo(px + pLen * 0.5, py + 2, px + 2, py + 1, px, py);
          ctx.fill();
        }
        ctx.restore();
      }

      function drawMossPatch(cx, cy, radius, count = 28) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.fillStyle = '#0f2413';
        ctx.beginPath();
        ctx.ellipse(0, 0, radius, radius * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        for (let i = 0; i < count; i++) {
          const ang = (i / count) * Math.PI * 2 + rng.range(-0.2, 0.2);
          const dist = rng.range(radius * 0.2, radius * 0.9);
          const fx = Math.cos(ang) * dist;
          const fy = Math.sin(ang) * (dist * 0.6);
          const fLen = rng.range(8, 16);

          ctx.strokeStyle = rng.next() > 0.4 ? '#3e8235' : '#5db34d';
          ctx.lineWidth = 1.0;
          ctx.beginPath(); ctx.moveTo(fx, fy);
          const fEndAng = ang + rng.range(-0.6, 0.6);
          ctx.lineTo(fx + Math.cos(fEndAng) * fLen, fy + Math.sin(fEndAng) * fLen);
          ctx.stroke();

          ctx.fillStyle = '#7dd968';
          ctx.beginPath();
          ctx.arc(fx + Math.cos(fEndAng) * fLen, fy + Math.sin(fEndAng) * fLen, 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      drawBolbitisFrond(240, 150, 110, -0.35);
      drawBolbitisFrond(260, 145, 125, -0.15);
      drawBolbitisFrond(280, 140, 95, 0.2);

      drawTridentFrond(210, 160, 85, -0.65);
      drawTridentFrond(190, 175, 75, -0.85);
      drawTridentFrond(225, 155, 95, -0.45);

      drawMossPatch(230, 180, 22, 35);
      drawMossPatch(340, 165, 28, 45);
      drawMossPatch(400, 185, 20, 30);
      drawMossPatch(170, 210, 18, 25);

      ctx.strokeStyle = '#2b471c';
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(270, 205); ctx.bezierCurveTo(295, 185, 335, 175, 375, 185); ctx.stroke();

      drawAnubiasLeaf(280, 200, 32, -1.2, false);
      drawAnubiasLeaf(295, 192, 36, -0.7, false);
      drawAnubiasLeaf(315, 183, 30, -0.3, true);
      drawAnubiasLeaf(335, 178, 38, 0.1, false);
      drawAnubiasLeaf(355, 180, 34, 0.6, false);
      drawAnubiasLeaf(370, 188, 28, 1.1, false);

      drawAnubiasLeaf(245, 195, 20, -1.4, false);
      drawAnubiasLeaf(255, 190, 22, -0.8, true);
      drawAnubiasLeaf(265, 192, 24, -0.2, false);

      ctx.restore();
    },

    // -------------------------------------------------------------
    // FOREGROUND (10 SPECIES)
    // -------------------------------------------------------------
    hccuba(ctx, w, h) {
      const rng = new PRNG(1101);
      const baseY = h - 28;
      for (let layer = 0; layer < 4; layer++) {
        const count = 280;
        for (let i = 0; i < count; i++) {
          const x = rng.range(15, w - 15);
          const y = baseY - layer * 7 + rng.range(-6, 6);
          const r = rng.range(1.6, 2.8);
          ctx.beginPath();
          ctx.ellipse(x, y, r, r * 0.75, rng.range(-0.6, 0.6), 0, Math.PI * 2);
          if (layer === 0) ctx.fillStyle = '#1b3b14';
          else if (layer === 1) ctx.fillStyle = '#2f631f';
          else if (layer === 2) ctx.fillStyle = '#4c9931';
          else ctx.fillStyle = rng.next() > 0.4 ? '#78cc4b' : '#9be36b';
          ctx.fill();
          ctx.strokeStyle = '#183810'; ctx.lineWidth = 0.3; ctx.stroke();
        }
      }
    },

    montecarlo(ctx, w, h) {
      const rng = new PRNG(2202);
      const baseY = h - 28;
      for (let layer = 0; layer < 4; layer++) {
        const count = 95;
        for (let i = 0; i < count; i++) {
          const x = rng.range(18, w - 18);
          const y = baseY - layer * 8 + rng.range(-5, 5);
          const r = rng.range(4.5, 7.5);
          ctx.beginPath();
          ctx.ellipse(x, y, r, r * 0.8, rng.range(-0.4, 0.4), 0, Math.PI * 2);
          if (layer === 0) ctx.fillStyle = '#173617';
          else if (layer === 1) ctx.fillStyle = '#2b5e29';
          else if (layer === 2) ctx.fillStyle = '#438a3d';
          else ctx.fillStyle = rng.next() > 0.3 ? '#68b85c' : '#88d977';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'; ctx.lineWidth = 0.6;
          ctx.beginPath(); ctx.moveTo(x - r * 0.5, y); ctx.lineTo(x + r * 0.5, y); ctx.stroke();
        }
      }
    },

    glossostigma(ctx, w, h) {
      const rng = new PRNG(3303);
      const baseY = h - 26;
      ctx.strokeStyle = '#295420'; ctx.lineWidth = 1.4;
      for (let r = 0; r < 6; r++) {
        ctx.beginPath();
        let rx = rng.range(20, 50);
        let ry = baseY + rng.range(-4, 2);
        ctx.moveTo(rx, ry);
        while (rx < w - 30) {
          rx += rng.range(25, 45);
          ry = baseY + rng.range(-6, 3);
          ctx.lineTo(rx, ry);
        }
        ctx.stroke();
      }

      for (let i = 0; i < 70; i++) {
        const x = rng.range(20, w - 20);
        const y = baseY + rng.range(-8, 4);
        const stalkLen = rng.range(10, 18);
        ctx.save();
        ctx.translate(x, y);

        ctx.strokeStyle = '#38732c'; ctx.lineWidth = 1.0;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-4, -stalkLen * 0.5, -6, -stalkLen); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(-6, -stalkLen, 4.0, 7.0, -0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#59a840'; ctx.fill();
        ctx.strokeStyle = '#244d18'; ctx.lineWidth = 0.5; ctx.stroke();

        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(4, -stalkLen * 0.5, 6, -stalkLen); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(6, -stalkLen, 4.0, 7.0, 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#6bc24e'; ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    },

    eleocharismini(ctx, w, h) {
      const rng = new PRNG(4404);
      const baseY = h - 25;
      const bladeCount = 550;
      for (let i = 0; i < bladeCount; i++) {
        const x = rng.range(15, w - 15);
        const y = baseY + rng.range(-3, 5);
        const height = rng.range(25, 65);
        const curve = rng.range(-14, 14);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + curve * 0.4, y - height * 0.55, x + curve, y - height);
        const depth = y - baseY;
        if (depth > 2) ctx.strokeStyle = '#1e3d1c';
        else if (height > 48) ctx.strokeStyle = rng.next() > 0.5 ? '#5cb347' : '#7ed966';
        else ctx.strokeStyle = '#3a782e';
        ctx.lineWidth = rng.range(0.6, 1.2);
        ctx.stroke();
      }
    },

    cryptoparva(ctx, w, h) {
      const rng = new PRNG(5505);
      const clusters = [ {x: 80, y: h-26}, {x: 150, y: h-24}, {x: 220, y: h-27}, {x: 280, y: h-25} ];
      clusters.forEach(cl => {
        const leafCount = 14;
        for (let i = 0; i < leafCount; i++) {
          const ang = (i / leafCount) * Math.PI * 1.8 - 0.9;
          const stalk = rng.range(12, 22);
          const bladeL = rng.range(18, 30);
          const bladeW = rng.range(3.5, 5.2);
          ctx.save();
          ctx.translate(cl.x, cl.y);
          ctx.rotate(ang + rng.range(-0.15, 0.15));

          ctx.strokeStyle = '#21361b'; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -stalk); ctx.stroke();

          ctx.translate(0, -stalk);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(-bladeW, -bladeL * 0.4, -bladeW * 0.8, -bladeL * 0.8, 0, -bladeL);
          ctx.bezierCurveTo(bladeW * 0.8, -bladeL * 0.8, bladeW, -bladeL * 0.4, 0, 0);
          ctx.closePath();

          const grad = ctx.createLinearGradient(0, 0, 0, -bladeL);
          grad.addColorStop(0, '#1c3316'); grad.addColorStop(0.5, '#2f5424'); grad.addColorStop(1, '#487d3a');
          ctx.fillStyle = grad; ctx.fill();
          ctx.strokeStyle = '#182b13'; ctx.lineWidth = 0.6; ctx.stroke();

          ctx.strokeStyle = '#5a9948';
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -bladeL * 0.9); ctx.stroke();
          ctx.restore();
        }
      });
    },

    staurogyne(ctx, w, h) {
      const rng = new PRNG(6606);
      const stems = [ {x: 85, h: 48}, {x: 140, h: 65}, {x: 195, h: 58}, {x: 255, h: 62}, {x: 300, h: 45} ];
      stems.forEach(st => {
        if (!sourceRootAllowed(st.x)) return;
        const baseY = h - 25;
        ctx.strokeStyle = '#2d5423'; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(st.x, baseY); ctx.lineTo(st.x + rng.range(-4, 4), baseY - st.h); ctx.stroke();

        const tiers = 5;
        for (let t = 1; t <= tiers; t++) {
          const ty = baseY - (st.h * (t / tiers));
          const size = 12 + t * 2.2;
          const isTop = (t === tiers);

          ctx.save();
          ctx.translate(st.x, ty); ctx.rotate(-0.5 - t * 0.1);
          ctx.beginPath(); ctx.ellipse(-size * 0.5, 0, size * 0.55, size * 0.32, 0, 0, Math.PI * 2);
          ctx.fillStyle = isTop ? '#6ec74a' : '#3d7a2c'; ctx.fill();
          ctx.strokeStyle = '#204715'; ctx.lineWidth = 0.7; ctx.stroke();
          ctx.restore();

          ctx.save();
          ctx.translate(st.x, ty); ctx.rotate(0.5 + t * 0.1);
          ctx.beginPath(); ctx.ellipse(size * 0.5, 0, size * 0.55, size * 0.32, 0, 0, Math.PI * 2);
          ctx.fillStyle = isTop ? '#7cd654' : '#478c33'; ctx.fill();
          ctx.strokeStyle = '#204715'; ctx.lineWidth = 0.7; ctx.stroke();
          ctx.restore();
        }
      });
    },

    lilaeopsis(ctx, w, h) {
      const rng = new PRNG(7707);
      const baseY = h - 25;
      for (let i = 0; i < 180; i++) {
        const x = rng.range(20, w - 20);
        const height = rng.range(45, 95);
        const curve = rng.range(-18, 18);
        const width = rng.range(2.0, 3.8);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x - width * 0.5, baseY);
        ctx.quadraticCurveTo(x + curve * 0.5 - width * 0.3, baseY - height * 0.5, x + curve, baseY - height);
        ctx.quadraticCurveTo(x + curve * 0.5 + width * 0.3, baseY - height * 0.5, x + width * 0.5, baseY);
        ctx.closePath();

        const grad = ctx.createLinearGradient(x, baseY, x + curve, baseY - height);
        grad.addColorStop(0, '#1c3d18'); grad.addColorStop(0.6, '#39782f'); grad.addColorStop(1, '#65bd51');
        ctx.fillStyle = grad; ctx.fill();
        ctx.strokeStyle = '#152e12'; ctx.lineWidth = 0.5; ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; ctx.lineWidth = 0.5;
        for (let s = 0.2; s <= 0.8; s += 0.2) {
          const sy = baseY - height * s;
          const sx = x + curve * s;
          ctx.beginPath(); ctx.moveTo(sx - width * 0.3, sy); ctx.lineTo(sx + width * 0.3, sy); ctx.stroke();
        }
        ctx.restore();
      }
    },

    marsilea(ctx, w, h) {
      const rng = new PRNG(8808);
      const baseY = h - 25;
      for (let i = 0; i < 45; i++) {
        const x = rng.range(25, w - 25);
        const y = baseY + rng.range(-4, 3);
        const stemH = rng.range(25, 55);
        const curve = rng.range(-12, 12);
        const lobes = rng.next() > 0.4 ? 4 : 2;

        ctx.strokeStyle = '#326629'; ctx.lineWidth = 1.0;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + curve * 0.5, y - stemH * 0.5, x + curve, y - stemH); ctx.stroke();

        const topX = x + curve;
        const topY = y - stemH;
        const lobeR = rng.range(5.0, 7.5);

        for (let l = 0; l < lobes; l++) {
          const ang = (l / lobes) * Math.PI * 2 + 0.3;
          ctx.save();
          ctx.translate(topX, topY); ctx.rotate(ang);
          ctx.beginPath(); ctx.ellipse(lobeR * 0.7, 0, lobeR * 0.75, lobeR * 0.55, 0, 0, Math.PI * 2);
          ctx.fillStyle = (l % 2 === 0) ? '#5cb344' : '#72cc58'; ctx.fill();
          ctx.strokeStyle = '#224a1a'; ctx.lineWidth = 0.5; ctx.stroke();
          ctx.restore();
        }
      }
    },

    armini(ctx, w, h) {
      const rng = new PRNG(9909);
      const clusters = [ {x: 95, h: 55}, {x: 170, h: 70}, {x: 245, h: 60} ];
      clusters.forEach(cl => {
        const baseY = h - 25;
        ctx.strokeStyle = '#61111e'; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(cl.x, baseY); ctx.lineTo(cl.x, baseY - cl.h); ctx.stroke();

        for (let t = 1; t <= 6; t++) {
          const ty = baseY - (cl.h * (t / 6));
          const size = 16 + t * 2.5;

          [-1, 1].forEach(side => {
            ctx.save();
            ctx.translate(cl.x, ty); ctx.rotate(side * (0.6 + rng.range(-0.15, 0.15)));
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(side * size * 0.4, -size * 0.3, side * size * 0.9, -size * 0.2, side * size, 0);
            ctx.bezierCurveTo(side * size * 0.9, size * 0.2, side * size * 0.4, size * 0.3, 0, 0);
            ctx.closePath();

            const leafGrad = ctx.createLinearGradient(0, 0, side * size, 0);
            leafGrad.addColorStop(0, '#54101d'); leafGrad.addColorStop(0.5, '#991c33'); leafGrad.addColorStop(1, '#d93657');
            ctx.fillStyle = leafGrad; ctx.fill();

            ctx.strokeStyle = '#ff7593'; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(side * size * 0.9, 0); ctx.stroke();
            ctx.restore();
          });
        }
      });
    },

    mossdome(ctx, w, h) {
      const rng = new PRNG(1010);
      const cx = w * 0.5;
      const cy = h - 25;
      const rx = 100;
      const ry = 80;

      ctx.save();
      const coreGrad = ctx.createRadialGradient(cx, cy - 20, 10, cx, cy - 20, rx);
      coreGrad.addColorStop(0, '#0c1a0e');
      coreGrad.addColorStop(0.7, '#132e18');
      coreGrad.addColorStop(1, 'rgba(19, 46, 24, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 10, rx, ry, 0, Math.PI, Math.PI * 2);
      ctx.fill();

      for (let layer = 0; layer < 5; layer++) {
        const radiusScale = 0.3 + layer * 0.17;
        const count = 75 + layer * 35;
        for (let i = 0; i < count; i++) {
          const ang = Math.PI + (i / count) * Math.PI + rng.range(-0.1, 0.1);
          const dist = rng.range(rx * (radiusScale - 0.1), rx * radiusScale);
          const px = cx + Math.cos(ang) * dist;
          const py = cy + Math.sin(ang) * (dist * (ry / rx));
          const frondLen = rng.range(10, 22);
          const frondAng = ang + rng.range(-0.4, 0.4);

          ctx.strokeStyle = (layer < 2) ? '#1f4722' : (layer < 4 ? '#3b7d34' : '#5db849');
          ctx.lineWidth = (layer < 3) ? 1.4 : 1.0;
          ctx.beginPath(); ctx.moveTo(px, py);
          const endX = px + Math.cos(frondAng) * frondLen;
          const endY = py + Math.sin(frondAng) * frondLen;
          ctx.lineTo(endX, endY); ctx.stroke();

          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(px + (endX - px)*0.5, py + (endY - py)*0.5);
          ctx.lineTo(px + (endX - px)*0.5 + Math.cos(frondAng + 0.6) * 6, py + (endY - py)*0.5 + Math.sin(frondAng + 0.6) * 6);
          ctx.stroke();

          if (layer >= 3) {
            ctx.fillStyle = '#82e667';
            ctx.beginPath(); ctx.arc(endX, endY, 1.0, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
      ctx.restore();
    },

    // -------------------------------------------------------------
    // MIDGROUND (8 SPECIES)
    // -------------------------------------------------------------
    cryptowendtii(ctx, w, h) {
      const rng = new PRNG(1212);
      const cx = w * 0.5;
      const cy = h - 25;
      const leafCount = 22;

      for (let i = 0; i < leafCount; i++) {
        const ang = (i / leafCount) * Math.PI * 1.5 - 0.75 * Math.PI + rng.range(-0.2, 0.2);
        const stalkL = rng.range(30, 55);
        const bladeL = rng.range(50, 85);
        const bladeW = rng.range(12, 18);

        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(ang);
        ctx.strokeStyle = '#261a14'; ctx.lineWidth = 2.0;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-5, -stalkL * 0.5, 0, -stalkL); ctx.stroke();

        ctx.translate(0, -stalkL);
        ctx.beginPath(); ctx.moveTo(0, 0);
        const steps = 10;
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          const wave = Math.sin(t * Math.PI * 4) * 2.5;
          ctx.lineTo((-bladeW * Math.sin(t * Math.PI)) + wave, -bladeL * t);
        }
        for (let s = steps; s >= 0; s--) {
          const t = s / steps;
          const wave = Math.cos(t * Math.PI * 4) * 2.5;
          ctx.lineTo((bladeW * Math.sin(t * Math.PI)) + wave, -bladeL * t);
        }
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, 0, 0, -bladeL);
        grad.addColorStop(0, '#241c15'); grad.addColorStop(0.4, '#4d3824'); grad.addColorStop(0.8, '#6b4c2a'); grad.addColorStop(1, '#856138');
        ctx.fillStyle = grad; ctx.fill();

        ctx.strokeStyle = 'rgba(20, 14, 9, 0.45)'; ctx.lineWidth = 1.0;
        for (let v = 0.2; v <= 0.8; v += 0.15) {
          ctx.beginPath(); ctx.moveTo(-bladeW * 0.6, -bladeL * v); ctx.lineTo(bladeW * 0.6, -bladeL * v - 4); ctx.stroke();
        }

        ctx.strokeStyle = '#ad8450'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -bladeL * 0.95); ctx.stroke();
        ctx.restore();
      }
    },

    anubias(ctx, w, h) {
      const rng = new PRNG(1313);
      const cx = w * 0.5;
      const cy = h - 25;

      ctx.strokeStyle = '#1f3815'; ctx.lineWidth = 6.0;
      ctx.beginPath();
      ctx.moveTo(cx - 50, cy - 8);
      ctx.bezierCurveTo(cx - 20, cy - 18, cx + 20, cy - 14, cx + 55, cy - 5);
      ctx.stroke();

      const leafCount = 18;
      for (let i = 0; i < leafCount; i++) {
        const rx = cx - 45 + (i / leafCount) * 90 + rng.range(-5, 5);
        const ry = cy - 12 + rng.range(-4, 4);
        const ang = ((i - leafCount * 0.5) / leafCount) * 2.2 + rng.range(-0.2, 0.2);
        const stalkL = rng.range(25, 45);
        const bladeL = rng.range(38, 56);
        const isYoung = (i >= leafCount - 4);

        ctx.save();
        ctx.translate(rx, ry); ctx.rotate(ang);
        ctx.strokeStyle = isYoung ? '#3c7a28' : '#1b3812'; ctx.lineWidth = 2.0;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -stalkL); ctx.stroke();

        ctx.translate(0, -stalkL);
        const wL = bladeL * 0.45;
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-wL * 0.7, -bladeL * 0.35, -wL, -bladeL * 0.75, 0, -bladeL);
        ctx.bezierCurveTo(wL, -bladeL * 0.75, wL * 0.7, -bladeL * 0.35, 0, 0);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, 0, 0, -bladeL);
        if (isYoung) {
          grad.addColorStop(0, '#2e691d'); grad.addColorStop(0.6, '#56b334'); grad.addColorStop(1, '#7ee64e');
        } else {
          grad.addColorStop(0, '#10290e'); grad.addColorStop(0.5, '#194515'); grad.addColorStop(1, '#2c6924');
        }
        ctx.fillStyle = grad; ctx.fill();

        ctx.strokeStyle = isYoung ? '#8eee5c' : '#3d8731'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -bladeL * 0.95); ctx.stroke();
        ctx.restore();
      }
    },

    trident(ctx, w, h) {
      const rng = new PRNG(1414);
      const cx = w * 0.5;
      const cy = h - 25;

      for (let i = 0; i < 28; i++) {
        const ang = ((i - 14) / 14) * 1.3 + rng.range(-0.15, 0.15);
        const len = rng.range(90, 145);
        ctx.save();
        ctx.translate(cx + rng.range(-20, 20), cy); ctx.rotate(ang);

        ctx.strokeStyle = '#122e15'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-5, -len * 0.4, 0, -len * 0.45); ctx.stroke();

        ctx.translate(0, -len * 0.45);
        const remL = len * 0.55;

        ctx.fillStyle = '#225e27';
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-6, -remL * 0.4, -5, -remL * 0.8, 0, -remL);
        ctx.bezierCurveTo(5, -remL * 0.8, 6, -remL * 0.4, 0, 0);
        ctx.fill();

        ctx.fillStyle = '#297330';
        ctx.beginPath(); ctx.moveTo(-2, -remL * 0.1);
        ctx.bezierCurveTo(-15, -remL * 0.35, -28, -remL * 0.55, -34, -remL * 0.7);
        ctx.bezierCurveTo(-24, -remL * 0.6, -10, -remL * 0.4, -1, -remL * 0.25);
        ctx.fill();

        ctx.fillStyle = '#348c3c';
        ctx.beginPath(); ctx.moveTo(2, -remL * 0.15);
        ctx.bezierCurveTo(15, -remL * 0.4, 28, -remL * 0.6, 32, -remL * 0.75);
        ctx.bezierCurveTo(24, -remL * 0.65, 10, -remL * 0.45, 1, -remL * 0.3);
        ctx.fill();

        ctx.strokeStyle = '#5ec268'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -remL * 0.95); ctx.stroke();
        ctx.restore();
      }
    },

    bolbitis(ctx, w, h) {
      const rng = new PRNG(1515);
      const cx = w * 0.5;
      const cy = h - 25;

      for (let f = 0; f < 16; f++) {
        const ang = ((f - 8) / 8) * 1.1 + rng.range(-0.15, 0.15);
        const len = rng.range(120, 180);
        ctx.save();
        ctx.translate(cx + rng.range(-25, 25), cy); ctx.rotate(ang);

        ctx.strokeStyle = '#092414'; ctx.lineWidth = 2.0;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(10, -len * 0.35, -8, -len * 0.7, 0, -len); ctx.stroke();

        const pCount = 14;
        for (let p = 3; p < pCount; p++) {
          const t = p / pCount;
          const py = -len * t;
          const px = (t < 0.5 ? 10 : -8) * Math.sin(t * Math.PI);
          const pLen = (1 - t * 0.55) * 32;

          [-1, 1].forEach(dir => {
            ctx.fillStyle = (dir === -1) ? 'rgba(16, 54, 32, 0.88)' : 'rgba(25, 82, 49, 0.88)';
            ctx.beginPath(); ctx.moveTo(px, py);
            ctx.bezierCurveTo(px + dir * pLen * 0.5, py - 6, px + dir * pLen, py - 3, px + dir * pLen * 0.9, py + 5);
            ctx.bezierCurveTo(px + dir * pLen * 0.5, py + 4, px + dir * 2, py + 2, px, py);
            ctx.fill();

            ctx.strokeStyle = 'rgba(74, 179, 117, 0.4)'; ctx.lineWidth = 0.6; ctx.stroke();
          });
        }
        ctx.restore();
      }
    },

    bucephalandra(ctx, w, h) {
      const rng = new PRNG(1616);
      const cx = w * 0.5;
      const cy = h - 25;
      const leafCount = 15;

      for (let i = 0; i < leafCount; i++) {
        const ang = ((i - 7.5) / 7.5) * 1.5 + rng.range(-0.2, 0.2);
        const stalkL = rng.range(20, 35);
        const bladeL = rng.range(40, 60);
        const bladeW = rng.range(9, 14);

        ctx.save();
        ctx.translate(cx + rng.range(-15, 15), cy); ctx.rotate(ang);

        ctx.strokeStyle = '#421a22'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -stalkL); ctx.stroke();

        ctx.translate(0, -stalkL);
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-bladeW * 0.8, -bladeL * 0.3, -bladeW * 1.1, -bladeL * 0.7, 0, -bladeL);
        ctx.bezierCurveTo(bladeW * 1.1, -bladeL * 0.7, bladeW * 0.8, -bladeL * 0.3, 0, 0);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, 0, 0, -bladeL);
        grad.addColorStop(0, '#12211e'); grad.addColorStop(0.5, '#1e3b36'); grad.addColorStop(0.85, '#2e5950'); grad.addColorStop(1, '#424d38');
        ctx.fillStyle = grad; ctx.fill();

        ctx.fillStyle = 'rgba(105, 196, 185, 0.18)';
        ctx.beginPath(); ctx.ellipse(-bladeW * 0.2, -bladeL * 0.5, bladeW * 0.3, bladeL * 0.3, -0.2, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = 'rgba(230, 248, 245, 0.75)';
        for (let d = 0; d < 12; d++) {
          const dx = rng.range(-bladeW * 0.6, bladeW * 0.6);
          const dy = rng.range(-bladeL * 0.85, -bladeL * 0.15);
          ctx.beginPath(); ctx.arc(dx, dy, 0.7, 0, Math.PI * 2); ctx.fill();
        }

        ctx.strokeStyle = '#572b35'; ctx.lineWidth = 1.0;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -bladeL * 0.95); ctx.stroke();
        ctx.restore();
      }
    },

    echinodorus(ctx, w, h) {
      const rng = new PRNG(1717);
      const cx = w * 0.5;
      const cy = h - 25;
      const leafCount = 14;

      for (let i = 0; i < leafCount; i++) {
        const ang = ((i - 7) / 7) * 1.2 + rng.range(-0.15, 0.15);
        const stalkL = rng.range(35, 65);
        const bladeL = rng.range(90, 140);
        const bladeW = rng.range(22, 34);

        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(ang);

        ctx.strokeStyle = '#27521e'; ctx.lineWidth = 2.8;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -stalkL); ctx.stroke();

        ctx.translate(0, -stalkL);
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-bladeW, -bladeL * 0.35, -bladeW * 0.9, -bladeL * 0.75, 0, -bladeL);
        ctx.bezierCurveTo(bladeW * 0.9, -bladeL * 0.75, bladeW, -bladeL * 0.35, 0, 0);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, 0, 0, -bladeL);
        grad.addColorStop(0, '#1c4217'); grad.addColorStop(0.5, '#35782c'); grad.addColorStop(1, '#56b347');
        ctx.fillStyle = grad; ctx.fill();

        ctx.strokeStyle = '#85e070'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -bladeL * 0.98); ctx.stroke();

        ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(133, 224, 112, 0.55)';
        [-1, 1].forEach(side => {
          ctx.beginPath(); ctx.moveTo(0, 0);
          ctx.bezierCurveTo(side * bladeW * 0.5, -bladeL * 0.35, side * bladeW * 0.45, -bladeL * 0.75, 0, -bladeL * 0.95);
          ctx.stroke();
        });
        ctx.restore();
      }
    },

    hydrocotyle(ctx, w, h) {
      const rng = new PRNG(1818);
      const cx = w * 0.5;
      const cy = h - 25;

      for (let layer = 0; layer < 5; layer++) {
        const count = 35 + layer * 15;
        const spreadX = 80 + layer * 15;
        const spreadY = 20 + layer * 22;

        for (let i = 0; i < count; i++) {
          const lx = cx + rng.range(-spreadX, spreadX);
          const ly = cy - spreadY + rng.range(-12, 12);
          const size = rng.range(8, 14);

          ctx.strokeStyle = '#2b5722'; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(lx, ly + size * 0.8); ctx.lineTo(lx, ly); ctx.stroke();

          ctx.save();
          ctx.translate(lx, ly); ctx.rotate(rng.range(-0.4, 0.4));

          for (let l = 0; l < 3; l++) {
            const lAng = (l / 3) * Math.PI * 1.6 - 0.8 * Math.PI;
            ctx.save(); ctx.rotate(lAng);
            ctx.beginPath(); ctx.ellipse(0, -size * 0.55, size * 0.42, size * 0.45, 0, 0, Math.PI * 2);
            ctx.fillStyle = (layer < 2) ? '#285e1f' : (layer < 4 ? '#4a9937' : '#75d957'); ctx.fill();
            ctx.strokeStyle = '#1a4214'; ctx.lineWidth = 0.4; ctx.stroke();
            ctx.restore();
          }
          ctx.restore();
        }
      }
    },

    pogostemon(ctx, w, h) {
      const rng = new PRNG(1919);
      const clusters = [ {x: 100, scale: 0.85}, {x: 170, scale: 1.1}, {x: 240, scale: 0.9} ];
      clusters.forEach(cl => {
        const cy = h - 25;
        const leafCount = 18;

        for (let i = 0; i < leafCount; i++) {
          const ang = (i / leafCount) * Math.PI * 1.6 - 0.8 * Math.PI + rng.range(-0.15, 0.15);
          const len = rng.range(38, 58) * cl.scale;
          const wL = rng.range(7, 11) * cl.scale;

          ctx.save();
          ctx.translate(cl.x, cy); ctx.rotate(ang);

          ctx.beginPath(); ctx.moveTo(0, 0);
          const ruffles = 8;
          for (let r = 1; r <= ruffles; r++) {
            const t = r / ruffles;
            const wave = Math.sin(t * Math.PI * 6) * 3.0;
            ctx.lineTo(-wL * Math.sin(t * Math.PI) + wave, -len * t);
          }
          for (let r = ruffles; r >= 0; r--) {
            const t = r / ruffles;
            const wave = Math.cos(t * Math.PI * 6) * 3.0;
            ctx.lineTo(wL * Math.sin(t * Math.PI) + wave, -len * t);
          }
          ctx.closePath();

          const grad = ctx.createLinearGradient(0, 0, 0, -len);
          grad.addColorStop(0, '#26591f'); grad.addColorStop(0.5, '#4fa63a'); grad.addColorStop(1, '#86e866');
          ctx.fillStyle = grad; ctx.fill();

          ctx.strokeStyle = '#1e4718'; ctx.lineWidth = 0.7; ctx.stroke();

          ctx.strokeStyle = '#b2fa96'; ctx.lineWidth = 1.0;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -len * 0.92); ctx.stroke();
          ctx.restore();
        }
      });
    },

    // -------------------------------------------------------------
    // BACKGROUND (8 SPECIES)
    // -------------------------------------------------------------
    vallisneria(ctx, w, h) {
      const rng = new PRNG(2020);
      const cx = w * 0.5;
      const cy = h - 25;
      const bladeCount = 18;

      for (let i = 0; i < bladeCount; i++) {
        const bx = cx - 70 + (i / bladeCount) * 140 + rng.range(-8, 8);
        const len = rng.range(210, 260);
        const curve1 = rng.range(-35, 35);
        const curve2 = rng.range(20, 75);
        const bWidth = rng.range(6.0, 9.5);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(bx - bWidth * 0.5, cy);
        ctx.bezierCurveTo(bx + curve1, cy - len * 0.4, bx + curve2, cy - len * 0.75, bx + curve2 + 30, cy - len);
        ctx.bezierCurveTo(bx + curve2 + 30 + bWidth, cy - len, bx + curve2 + bWidth, cy - len * 0.75, bx + bWidth * 0.5, cy);
        ctx.closePath();

        const grad = ctx.createLinearGradient(bx, cy, bx + curve2, cy - len);
        grad.addColorStop(0, '#153617'); grad.addColorStop(0.5, '#2e692f'); grad.addColorStop(1, '#5db35e');
        ctx.fillStyle = grad; ctx.fill();

        ctx.strokeStyle = 'rgba(164, 240, 166, 0.4)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(bx, cy);
        ctx.bezierCurveTo(bx + curve1 + bWidth * 0.5, cy - len * 0.4, bx + curve2 + bWidth * 0.5, cy - len * 0.75, bx + curve2 + 30 + bWidth * 0.5, cy - len);
        ctx.stroke();
        ctx.restore();
      }
    },

    hygrophila(ctx, w, h) {
      const rng = new PRNG(2121);
      const stems = [ {x: 80, h: 190}, {x: 135, h: 235}, {x: 185, h: 245}, {x: 240, h: 220}, {x: 285, h: 180} ];
      stems.forEach(st => {
        if (!sourceRootAllowed(st.x)) return;
        const cy = h - 25;
        ctx.strokeStyle = '#224a1b'; ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.moveTo(st.x, cy); ctx.lineTo(st.x + rng.range(-6, 6), cy - st.h); ctx.stroke();

        const tiers = 8;
        for (let t = 1; t <= tiers; t++) {
          const ty = cy - (st.h * (t / tiers));
          const size = 22 + t * 2.8;
          const isTop = (t >= tiers - 1);

          [-1, 1].forEach(side => {
            ctx.save();
            ctx.translate(st.x, ty); ctx.rotate(side * (0.7 + rng.range(-0.1, 0.1)));

            ctx.beginPath(); ctx.moveTo(0, 0);
            ctx.bezierCurveTo(side * size * 0.4, -size * 0.25, side * size * 0.8, -size * 0.15, side * size, 0);
            ctx.bezierCurveTo(side * size * 0.8, size * 0.15, side * size * 0.4, size * 0.25, 0, 0);
            ctx.closePath();

            const grad = ctx.createLinearGradient(0, 0, side * size, 0);
            if (isTop) {
              grad.addColorStop(0, '#3f872b'); grad.addColorStop(1, '#8de66e');
            } else {
              grad.addColorStop(0, '#1c4217'); grad.addColorStop(1, '#458c38');
            }
            ctx.fillStyle = grad; ctx.fill();
            ctx.strokeStyle = '#183813'; ctx.lineWidth = 0.6; ctx.stroke();
            ctx.restore();
          });
        }
      });
    },

    rotala(ctx, w, h) {
      const rng = new PRNG(2222);
      const stemCount = 38;
      const cy = h - 25;

      for (let i = 0; i < stemCount; i++) {
        const sx = 40 + (i / stemCount) * (w - 80) + rng.range(-6, 6);
        if (!sourceRootAllowed(sx)) continue;
        const sH = rng.range(160, 245);
        const sCurve = rng.range(-20, 20);

        ctx.strokeStyle = '#47291a'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(sx, cy); ctx.quadraticCurveTo(sx + sCurve * 0.5, cy - sH * 0.5, sx + sCurve, cy - sH); ctx.stroke();

        const nodeCount = 16;
        for (let n = 1; n <= nodeCount; n++) {
          const t = n / nodeCount;
          const ny = cy - sH * t;
          const nx = sx + sCurve * (t * t);
          const leafL = 10 + t * 4;

          let leafColor;
          if (t < 0.4) leafColor = '#3a6627';
          else if (t < 0.75) leafColor = '#c46927';
          else leafColor = '#e8385a';

          [-1, 1].forEach(side => {
            ctx.save();
            ctx.translate(nx, ny); ctx.rotate(side * (0.65 + rng.range(-0.1, 0.1)));
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(side * leafL, -2); ctx.lineTo(side * (leafL * 0.8), 2); ctx.closePath();
            ctx.fillStyle = leafColor; ctx.fill();
            ctx.restore();
          });
        }
      }
    },

    ludwigia(ctx, w, h) {
      const rng = new PRNG(2323);
      const stems = [ {x: 80, h: 180}, {x: 135, h: 220}, {x: 185, h: 235}, {x: 235, h: 210}, {x: 285, h: 175} ];
      const cy = h - 25;

      stems.forEach(st => {
        if (!sourceRootAllowed(st.x)) return;
        ctx.strokeStyle = '#4a0d18'; ctx.lineWidth = 3.0;
        ctx.beginPath(); ctx.moveTo(st.x, cy); ctx.lineTo(st.x, cy - st.h); ctx.stroke();

        const tiers = 8;
        for (let t = 1; t <= tiers; t++) {
          const ty = cy - (st.h * (t / tiers));
          const size = 18 + t * 3.2;

          [-1, 1].forEach(side => {
            ctx.save();
            ctx.translate(st.x, ty); ctx.rotate(side * 0.65);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(side * size * 0.5, -size * 0.35);
            ctx.lineTo(side * size, 0);
            ctx.lineTo(side * size * 0.5, size * 0.35);
            ctx.closePath();

            const grad = ctx.createLinearGradient(0, 0, side * size, 0);
            grad.addColorStop(0, '#540f1c'); grad.addColorStop(0.5, '#9e1930'); grad.addColorStop(1, '#e3294c');
            ctx.fillStyle = grad; ctx.fill();

            ctx.strokeStyle = '#ff8299'; ctx.lineWidth = 1.0;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(side * size * 0.95, 0); ctx.stroke();
            ctx.restore();
          });
        }
      });
    },

    limnophila(ctx, w, h) {
      const rng = new PRNG(2424);
      const stems = [ {x: 90, h: 200}, {x: 155, h: 240}, {x: 215, h: 230}, {x: 275, h: 195} ];
      const cy = h - 25;

      stems.forEach(st => {
        if (!sourceRootAllowed(st.x)) return;
        ctx.strokeStyle = '#2d5e23'; ctx.lineWidth = 2.0;
        ctx.beginPath(); ctx.moveTo(st.x, cy); ctx.lineTo(st.x, cy - st.h); ctx.stroke();

        const whorls = 9;
        for (let wI = 1; wI <= whorls; wI++) {
          const wy = cy - (st.h * (wI / whorls));
          const wRadius = 16 + wI * 2.2;
          const rayCount = 16;

          for (let r = 0; r < rayCount; r++) {
            const ang = (r / rayCount) * Math.PI * 2;
            const rx = st.x + Math.cos(ang) * wRadius;
            const ry = wy + Math.sin(ang) * (wRadius * 0.4);

            ctx.strokeStyle = (wI >= whorls - 2) ? '#86e660' : '#459930';
            ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(st.x, wy); ctx.lineTo(rx, ry); ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx + Math.cos(ang + 0.4) * 4, ry + Math.sin(ang + 0.4) * 4);
            ctx.stroke();
          }
        }
      });
    },

    bacopa(ctx, w, h) {
      const rng = new PRNG(2525);
      const stems = [ {x: 85, h: 185}, {x: 145, h: 235}, {x: 205, h: 225}, {x: 265, h: 195} ];
      const cy = h - 25;

      stems.forEach(st => {
        if (!sourceRootAllowed(st.x)) return;
        ctx.strokeStyle = '#39702a'; ctx.lineWidth = 3.6;
        ctx.beginPath(); ctx.moveTo(st.x, cy); ctx.lineTo(st.x + rng.range(-4, 4), cy - st.h); ctx.stroke();

        const tiers = 7;
        for (let t = 1; t <= tiers; t++) {
          const ty = cy - (st.h * (t / tiers));
          const size = 18 + t * 2.0;

          [-1, 1].forEach(side => {
            ctx.save();
            ctx.translate(st.x, ty); ctx.rotate(side * 0.7);
            ctx.beginPath(); ctx.ellipse(side * size * 0.55, 0, size * 0.55, size * 0.4, 0, 0, Math.PI * 2);
            ctx.fillStyle = (t >= tiers - 1) ? '#86de59' : '#4d9933'; ctx.fill();
            ctx.strokeStyle = '#265418'; ctx.lineWidth = 0.8; ctx.stroke();
            ctx.restore();
          });
        }
      });
    },

    montevidensis(ctx, w, h) {
      const rng = new PRNG(2626);
      const cy = h - 25;
      const bladeCount = 128; // v96: giant hairgrass preview/source asset was unnecessarily expensive

      for (let i = 0; i < bladeCount; i++) {
        const x = rng.range(25, w - 25);
        if (!sourceRootAllowed(x)) continue;
        const sH = rng.range(170, 255);
        const curve = rng.range(-35, 35);

        ctx.beginPath(); ctx.moveTo(x, cy);
        ctx.quadraticCurveTo(x + curve * 0.4, cy - sH * 0.6, x + curve, cy - sH);
        if (sH > 220) ctx.strokeStyle = rng.next() > 0.4 ? '#68cc4e' : '#8ef073';
        else ctx.strokeStyle = '#327327';
        ctx.lineWidth = rng.range(0.8, 1.4);
        ctx.stroke();
      }
    },

    myriophyllum(ctx, w, h) {
      const rng = new PRNG(2727);
      const stems = [ {x: 90, h: 195}, {x: 150, h: 240}, {x: 210, h: 230}, {x: 270, h: 185} ];
      const cy = h - 25;

      stems.forEach(st => {
        if (!sourceRootAllowed(st.x)) return;
        ctx.strokeStyle = '#2b5722'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(st.x, cy); ctx.lineTo(st.x, cy - st.h); ctx.stroke();

        const tiers = 22;
        for (let t = 1; t <= tiers; t++) {
          const ty = cy - (st.h * (t / tiers));
          const wL = 16 + (t / tiers) * 8;

          [-1, 1].forEach(side => {
            const ang = side * 0.7;
            ctx.save();
            ctx.translate(st.x, ty); ctx.rotate(ang);
            ctx.strokeStyle = (t > tiers - 4) ? '#92f071' : '#4fa834'; ctx.lineWidth = 0.6;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(side * wL, 0);
            for (let f = 2; f <= wL; f += 3) {
              ctx.moveTo(side * f, 0); ctx.lineTo(side * f, -4);
              ctx.moveTo(side * f, 0); ctx.lineTo(side * f, 4);
            }
            ctx.stroke();
            ctx.restore();
          });
        }
      });
    }
  };

  // Specimen Metadata Registry with Placement Strategies & Capability Controls
  const REMOVED_PLANT_IDS = new Set(["montecarlo","cryptowendtii","staurogyne","lilaeopsis","armini","anubias","limnophila","bacopa"]);

  const ASSET_DEFINITIONS = [
    // -------------------------------------------------------------
    // LARGE ROSETTE (SINGLE)
    // -------------------------------------------------------------
    {
      id: "echinodorus", renderer: "echinodorus", logicalWidth: 340, logicalHeight: 260, zone: "midground",
      placementStrategy: "single",
      controls: { position: true, scale: true, coverage: false, density: false },
      defaultLayout: { xRatio: 0.80, scale: 1.05 },
      defaultScale: 1.05, minScale: 0.6, maxScale: 1.6
    },

    // -------------------------------------------------------------
    // CARPET (前景草 - 被覆範囲・密度管理)
    // -------------------------------------------------------------
    {
      id: "hccuba", renderer: "hccuba", logicalWidth: 340, logicalHeight: 240, zone: "foreground", rootInset: 28,
      placementStrategy: "carpet",
      controls: { position: true, scale: false, coverage: true, density: true },
      defaultLayout: { xRatio: 0.20, widthRatio: 0.30, density: 1.0 },
      defaultScale: 0.75, minScale: 0.5, maxScale: 1.2
    },
    {
      id: "montecarlo", renderer: "montecarlo", logicalWidth: 340, logicalHeight: 240, zone: "foreground", rootInset: 28,
      placementStrategy: "carpet",
      controls: { position: true, scale: false, coverage: true, density: true },
      defaultLayout: { xRatio: 0.32, widthRatio: 0.30, density: 1.0 },
      defaultScale: 0.80, minScale: 0.5, maxScale: 1.2
    },
    {
      id: "glossostigma", renderer: "glossostigma", logicalWidth: 340, logicalHeight: 240, zone: "foreground", rootInset: 26,
      placementStrategy: "carpet",
      controls: { position: true, scale: false, coverage: true, density: true },
      defaultLayout: { xRatio: 0.62, widthRatio: 0.28, density: 1.0 },
      defaultScale: 0.75, minScale: 0.5, maxScale: 1.2
    },
    {
      id: "eleocharis-mini", renderer: "eleocharismini", logicalWidth: 340, logicalHeight: 240, zone: "foreground",
      placementStrategy: "carpet",
      controls: { position: true, scale: false, coverage: true, density: true },
      defaultLayout: { xRatio: 0.16, widthRatio: 0.28, density: 1.0 },
      defaultScale: 0.85, minScale: 0.5, maxScale: 1.3
    },
    {
      id: "lilaeopsis", renderer: "lilaeopsis", logicalWidth: 340, logicalHeight: 240, zone: "foreground",
      placementStrategy: "carpet",
      controls: { position: true, scale: false, coverage: true, density: true },
      defaultLayout: { xRatio: 0.24, widthRatio: 0.26, density: 1.0 },
      defaultScale: 0.85, minScale: 0.5, maxScale: 1.3
    },

    // -------------------------------------------------------------
    // COLONY (群落草・有茎草・後景草・中景茂み)
    // -------------------------------------------------------------
    {
      id: "montevidensis", renderer: "montevidensis", logicalWidth: 340, logicalHeight: 280, zone: "background",
      placementStrategy: "colony",
      controls: { position: true, scale: true, coverage: true, density: true },
      defaultLayout: { xRatio: 0.94, widthRatio: 0.14, density: 1.0, scale: 1.0 },
      // Giant hairgrass is already a tall background plant. 160% made it tower
      // unrealistically and multiplied the amount of expensive long-curve coverage.
      defaultScale: 1.00, minScale: 0.6, maxScale: 1.25
    },
    {
      id: "rotala", renderer: "rotala", logicalWidth: 340, logicalHeight: 280, zone: "background",
      placementStrategy: "colony",
      controls: { position: true, scale: true, coverage: true, density: true },
      defaultLayout: { xRatio: 0.66, widthRatio: 0.18, density: 1.0, scale: 1.0 },
      defaultScale: 1.00, minScale: 0.6, maxScale: 1.5
    },
    {
      id: "limnophila", renderer: "limnophila", logicalWidth: 340, logicalHeight: 280, zone: "background",
      placementStrategy: "colony",
      controls: { position: true, scale: true, coverage: true, density: true },
      defaultLayout: { xRatio: 0.84, widthRatio: 0.16, density: 1.0, scale: 0.95 },
      defaultScale: 0.95, minScale: 0.6, maxScale: 1.5
    },
    {
      id: "bacopa", renderer: "bacopa", logicalWidth: 340, logicalHeight: 280, zone: "background",
      placementStrategy: "colony",
      controls: { position: true, scale: true, coverage: true, density: true },
      defaultLayout: { xRatio: 0.90, widthRatio: 0.15, density: 1.0, scale: 0.95 },
      defaultScale: 0.95, minScale: 0.6, maxScale: 1.5
    },
    {
      id: "myriophyllum", renderer: "myriophyllum", logicalWidth: 340, logicalHeight: 280, zone: "background",
      placementStrategy: "colony",
      controls: { position: true, scale: true, coverage: true, density: true },
      defaultLayout: { xRatio: 0.96, widthRatio: 0.14, density: 1.0, scale: 0.95 },
      defaultScale: 0.95, minScale: 0.6, maxScale: 1.5
    },
    {
      id: "staurogyne", renderer: "staurogyne", logicalWidth: 340, logicalHeight: 240, zone: "foreground",
      placementStrategy: "colony",
      controls: { position: true, scale: true, coverage: true, density: true },
      defaultLayout: { xRatio: 0.86, widthRatio: 0.16, density: 1.0, scale: 0.80 },
      defaultScale: 0.80, minScale: 0.4, maxScale: 1.4
    },
    {
      id: "cryptowendtii", renderer: "cryptowendtii", logicalWidth: 340, logicalHeight: 260, zone: "midground",
      placementStrategy: "colony",
      controls: { position: true, scale: true, coverage: true, density: true },
      defaultLayout: { xRatio: 0.28, widthRatio: 0.18, density: 1.0, scale: 0.95 },
      defaultScale: 0.95, minScale: 0.5, maxScale: 1.5
    },
    {
      id: "pogostemon", renderer: "pogostemon", logicalWidth: 340, logicalHeight: 260, zone: "midground",
      placementStrategy: "colony",
      controls: { position: true, scale: true, coverage: true, density: true },
      defaultLayout: { xRatio: 0.18, widthRatio: 0.16, density: 1.0, scale: 0.85 },
      defaultScale: 0.85, minScale: 0.5, maxScale: 1.4
    },

    // -------------------------------------------------------------
    // SCATTERED (点在・マルチインスタンス株)
    // -------------------------------------------------------------
    {
      id: "anubias", renderer: "anubias", logicalWidth: 340, logicalHeight: 260, zone: "midground",
      placementStrategy: "scattered", maxCount: 4,
      controls: { position: true, scale: true, coverage: false, density: false },
      defaultLayout: { instances: [{ xRatio: 0.33, scale: 0.90 }, { xRatio: 0.44, scale: 0.85 }] },
      defaultScale: 0.90, minScale: 0.5, maxScale: 1.5
    },
    {
      id: "trident", renderer: "trident", logicalWidth: 340, logicalHeight: 260, zone: "midground",
      placementStrategy: "scattered", maxCount: 4,
      controls: { position: true, scale: true, coverage: false, density: false },
      defaultLayout: { instances: [{ xRatio: 0.48, scale: 0.90 }, { xRatio: 0.54, scale: 0.85 }] },
      defaultScale: 0.90, minScale: 0.5, maxScale: 1.5
    },
    {
      id: "bolbitis", renderer: "bolbitis", logicalWidth: 340, logicalHeight: 260, zone: "midground",
      placementStrategy: "scattered", maxCount: 3,
      controls: { position: true, scale: true, coverage: false, density: false },
      defaultLayout: { instances: [{ xRatio: 0.58, scale: 0.95 }] },
      defaultScale: 0.95, minScale: 0.5, maxScale: 1.5
    },
    {
      id: "cryptoparva", renderer: "cryptoparva", logicalWidth: 340, logicalHeight: 240, zone: "foreground",
      placementStrategy: "scattered", maxCount: 4,
      controls: { position: true, scale: true, coverage: false, density: false },
      defaultLayout: { instances: [{ xRatio: 0.78, scale: 0.75 }] },
      defaultScale: 0.75, minScale: 0.4, maxScale: 1.3
    },
    {
      id: "armini", renderer: "armini", logicalWidth: 340, logicalHeight: 240, zone: "foreground",
      placementStrategy: "scattered", maxCount: 3,
      controls: { position: true, scale: true, coverage: false, density: false },
      defaultLayout: { instances: [{ xRatio: 0.74, scale: 0.80 }] },
      defaultScale: 0.80, minScale: 0.4, maxScale: 1.4
    },
    {
      id: "marsilea", renderer: "marsilea", logicalWidth: 340, logicalHeight: 240, zone: "foreground",
      placementStrategy: "scattered", maxCount: 4,
      controls: { position: true, scale: true, coverage: false, density: false },
      defaultLayout: { instances: [{ xRatio: 0.44, scale: 0.75 }] },
      defaultScale: 0.75, minScale: 0.4, maxScale: 1.3
    }
  ];

  class BotanicalEngine {
    constructor() {
      this.assets = new Map();
      this.isInitialized = false;
      // Cached specimen canvases are metadata/preview only. Final aquarium drawing is vector-direct.
      this.dpr = 1;
      this._styledContextCache = new WeakMap();
      this._themeColorCache = new Map();
    }

    _parseCssColor(css) {
      if (typeof css !== 'string') return null;
      const value = css.trim().toLowerCase();
      if (!value || value === 'transparent') return null;
      let m = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
      if (m) {
        let h = m[1];
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        return { r:parseInt(h.slice(0,2),16), g:parseInt(h.slice(2,4),16), b:parseInt(h.slice(4,6),16), a:1 };
      }
      m = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
      if (!m) return null;
      return { r:+m[1], g:+m[2], b:+m[3], a:m[4] == null ? 1 : +m[4] };
    }

    _rgbToHsl(r,g,b) {
      r/=255; g/=255; b/=255;
      const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
      let h=0, s=0, l=(max+min)/2;
      if (d) {
        s=d/(1-Math.abs(2*l-1));
        if (max===r) h=60*(((g-b)/d)%6);
        else if (max===g) h=60*((b-r)/d+2);
        else h=60*((r-g)/d+4);
        if (h<0) h+=360;
      }
      return {h,s,l};
    }

    _hslToRgb(h,s,l) {
      h=((h%360)+360)%360; s=Math.max(0,Math.min(1,s)); l=Math.max(0,Math.min(1,l));
      const c=(1-Math.abs(2*l-1))*s, x=c*(1-Math.abs((h/60)%2-1)), m=l-c/2;
      let r=0,g=0,b=0;
      if(h<60){r=c;g=x;} else if(h<120){r=x;g=c;} else if(h<180){g=c;b=x;}
      else if(h<240){g=x;b=c;} else if(h<300){r=x;b=c;} else {r=c;b=x;}
      return {r:Math.round((r+m)*255),g:Math.round((g+m)*255),b:Math.round((b+m)*255)};
    }

    _themeColor(css, themeMode, role='fill') {
      if (typeof css !== 'string') return css;
      const cacheKey = themeMode + '|' + role + '|' + css;
      const cached = this._themeColorCache.get(cacheKey);
      if (cached !== undefined) return cached;
      const c=this._parseCssColor(css);
      if (!c) { this._themeColorCache.set(cacheKey, css); return css; }
      const src=this._rgbToHsl(c.r,c.g,c.b);
      let h=src.h, s=src.s, l=src.l, a=c.a;

      if (themeMode === 'light') {
        /*
         * NATURAL palette: "Chiikawa anime" is a COLOR reference only.
         * Keep the renderer geometry and species hue intact.  The goal is clean,
         * cheerful animation color: bright local colour, coloured shadows instead
         * of near-black, and no grey/white wash over the plant.
         */
        const isGreen = h >= 55 && h <= 175;
        const isWarmPlant = h < 55 || h > 320;

        if (isGreen) {
          // Keep yellow-green / green / blue-green differences, but pull muddy
          // source greens into a clean animation range.
          h = Math.max(78, Math.min(148, h * 0.90 + 12));
          s = Math.max(0.46, Math.min(0.72, 0.48 + s * 0.30));
        } else if (isWarmPlant) {
          // Red/pink plants remain visibly red rather than becoming beige.
          h = h > 320 ? h : Math.max(2, h * 0.82);
          s = Math.max(0.52, Math.min(0.76, 0.48 + s * 0.34));
        } else {
          s = Math.max(0.40, Math.min(0.68, 0.42 + s * 0.30));
        }

        // Preserve original light/dark modelling, but lift the floor strongly.
        // Structural strokes are coloured shadows, not black outlines.
        if (role === 'stroke') {
          l = Math.max(0.30, Math.min(0.58, 0.22 + l * 0.58));
          a = Math.min(0.92, a);
        } else {
          l = Math.max(0.39, Math.min(0.76, 0.27 + l * 0.66));
          a = Math.min(0.99, a);
        }
      } else {
        /*
         * CYBER palette: not a cyan filter over NATURAL.  Preserve the source
         * luminance structure while changing the material palette itself.
         * Greens spread through teal -> cyan; warm/red foliage becomes magenta.
         */
        const warm = h < 60 || h > 315;
        const green = h >= 60 && h <= 175;

        if (warm) {
          // Red foliage / warm accents: electric magenta-pink.
          h = h > 315 ? 322 + (h - 315) * 0.12 : 326 - h * 0.08;
          s = role === 'stroke' ? 0.92 : 0.84;
        } else if (green) {
          // Keep variation between yellow-green and deep green instead of
          // flattening every plant to one cyan.
          const t = Math.max(0, Math.min(1, (h - 60) / 115));
          h = 154 + t * 34; // mint/teal -> cyan
          s = role === 'stroke' ? 0.90 : 0.78 + 0.10 * (1 - t);
        } else {
          h = 192 + (h - 175) * 0.08;
          s = role === 'stroke' ? 0.88 : 0.80;
        }

        if (role === 'stroke') {
          // Structural lines are bright emissive cores. They should read as light,
          // not as nearly transparent wireframe.
          l = Math.max(0.64, Math.min(0.90, 0.54 + l * 0.38));
          const srcA = Math.max(0, Math.min(1, a));
          a = 0.76 + Math.sqrt(srcA) * 0.20;   // ~0.76..0.96
        } else {
          // v114: CYBER foliage keeps a luminous surface with real visual mass.
          // Glow is separate; lowering the material alpha itself made every zone
          // collapse into the same transparent sheet and destroyed depth cues.
          l = Math.max(0.50, Math.min(0.78, 0.40 + l * 0.46));
          const srcA = Math.max(0, Math.min(1, a));
          a = 0.66 + Math.sqrt(srcA) * 0.24;   // ~0.66..0.90
        }
      }

      const rgb=this._hslToRgb(h,s,l);
      const result = `rgba(${rgb.r},${rgb.g},${rgb.b},${Math.max(0,Math.min(1,a)).toFixed(3)})`;
      this._themeColorCache.set(cacheKey, result);
      return result;
    }

    _styledContext(ctx, themeMode='dark') {
      if (!ctx || ctx.__botanicalStyledMode === themeMode) return ctx;
      let byMode=this._styledContextCache.get(ctx);
      if (!byMode) { byMode={}; this._styledContextCache.set(ctx,byMode); }
      if (byMode[themeMode]) return byMode[themeMode];
      const engine=this;
      let pathWasFilled=false;
      const boundMethods = new Map();
      const proxy=new Proxy(ctx,{
        get(target,prop){
          if(prop==='__botanicalStyledMode') return themeMode;
          if(prop==='beginPath'){
            if(!boundMethods.has(prop)) boundMethods.set(prop,function(){ pathWasFilled=false; return target.beginPath(); });
            return boundMethods.get(prop);
          }
          if(prop==='fill'){
            if(!boundMethods.has(prop)) boundMethods.set(prop,function(arg,rule){
              let out;
              if (themeMode === 'light') {
                // Preserve the small coloured cast shadow but avoid blur per leaf.
                // blur(0.75) across hundreds/thousands of vector fills dominated editor commits.
                const prevShadowColor=target.shadowColor, prevShadowBlur=target.shadowBlur;
                const prevShadowOffsetX=target.shadowOffsetX, prevShadowOffsetY=target.shadowOffsetY;
                target.shadowColor='rgba(34,66,45,0.28)';
                target.shadowBlur=0.75;
                target.shadowOffsetX=0.35;
                target.shadowOffsetY=1.05;
                if(arguments.length===0) out=target.fill();
                else if(arguments.length===1) out=target.fill(arg);
                else out=target.fill(arg,rule);
                target.shadowColor=prevShadowColor; target.shadowBlur=prevShadowBlur;
                target.shadowOffsetX=prevShadowOffsetX; target.shadowOffsetY=prevShadowOffsetY;
              } else {
                if(arguments.length===0) out=target.fill();
                else if(arguments.length===1) out=target.fill(arg);
                else out=target.fill(arg,rule);
              }
              pathWasFilled=true;
              return out;
            });
            return boundMethods.get(prop);
          }
          if(prop==='stroke'){
            if(!boundMethods.has(prop)) boundMethods.set(prop,function(arg){
              if(pathWasFilled){ pathWasFilled=false; return; }
              return arguments.length ? target.stroke(arg) : target.stroke();
            });
            return boundMethods.get(prop);
          }
          if(prop==='createLinearGradient' || prop==='createRadialGradient'){
            if(!boundMethods.has(prop)) boundMethods.set(prop,function(){
              const grad=target[prop](...arguments);
              const add=grad.addColorStop.bind(grad);
              grad.addColorStop=(offset,color)=>add(offset,engine._themeColor(color,themeMode,'fill'));
              return grad;
            });
            return boundMethods.get(prop);
          }
          const value=Reflect.get(target,prop,target);
          if(typeof value!=='function') return value;
          if(!boundMethods.has(prop)) boundMethods.set(prop,value.bind(target));
          return boundMethods.get(prop);
        },
        set(target,prop,value){
          if(prop==='fillStyle' && typeof value==='string') value=engine._themeColor(value,themeMode,'fill');
          else if(prop==='strokeStyle' && typeof value==='string') value=engine._themeColor(value,themeMode,'stroke');
          else if(prop==='shadowColor' && typeof value==='string') value=engine._themeColor(value,themeMode,'stroke');
          return Reflect.set(target,prop,value,target);
        }
      });
      byMode[themeMode]=proxy;
      return proxy;
    }

    init() {
      if (this.isInitialized) return;
      
      ASSET_DEFINITIONS.forEach(def => {
        const renderFn = Renderers[def.renderer];
        if (!renderFn) return;

        // 1. Render NATURAL preview/metadata texture with the same palette used in-tank.
        const naturalCanvas = document.createElement('canvas');
        naturalCanvas.width = Math.round(def.logicalWidth * this.dpr);
        naturalCanvas.height = Math.round(def.logicalHeight * this.dpr);
        const naturalRawCtx = naturalCanvas.getContext('2d', { alpha: true });
        naturalRawCtx.scale(this.dpr, this.dpr);
        const naturalCtx = this._styledContext(naturalRawCtx, 'light');
        renderFn(naturalCtx, def.logicalWidth, def.logicalHeight);

        // 2. Automated Pixel Scanning for VisibleBounds and Root Anchor
        const imgData = naturalCtx.getImageData(0, 0, naturalCanvas.width, naturalCanvas.height);
        const pixels = imgData.data;
        let minX = naturalCanvas.width, maxX = 0, minY = naturalCanvas.height, maxY = 0;
        let bottomPixelSumX = 0, bottomPixelCount = 0;

        for (let y = 0; y < naturalCanvas.height; y++) {
          for (let x = 0; x < naturalCanvas.width; x++) {
            const alpha = pixels[(y * naturalCanvas.width + x) * 4 + 3];
            if (alpha > 12) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        // Logical visible bounds
        const visibleBounds = {
          x: Math.max(0, minX / this.dpr),
          y: Math.max(0, minY / this.dpr),
          width: Math.max(1, (maxX - minX) / this.dpr),
          height: Math.max(1, (maxY - minY) / this.dpr)
        };

        // Grounding anchor is NOT derived from the lowest visible pixel.
        // Fronds, runners and moss tips can extend below the true planting point.
        // Each renderer is authored around a known root/base line (h - rootInset).
        const anchorX = Number.isFinite(def.anchorX) ? def.anchorX : def.logicalWidth * 0.5;
        const rootInset = Number.isFinite(def.rootInset) ? def.rootInset : 25;
        const anchorY = def.logicalHeight - rootInset;

        // 3. Render CYBER preview/metadata texture from the renderer itself.
        // No NATURAL recolour overlay and no scan lines: the material palette is authored
        // by _themeColor(), exactly like the final vector render in the aquarium.
        const cyberCanvas = document.createElement('canvas');
        cyberCanvas.width = naturalCanvas.width;
        cyberCanvas.height = naturalCanvas.height;
        const cyberRawCtx = cyberCanvas.getContext('2d', { alpha: true });
        cyberRawCtx.scale(this.dpr, this.dpr);
        const cyberCtx = this._styledContext(cyberRawCtx, 'dark');
        renderFn(cyberCtx, def.logicalWidth, def.logicalHeight);
        this.applyCyberTreatment(cyberRawCtx, cyberCanvas.width, cyberCanvas.height);

        this.assets.set(def.id, {
          ...def,
          visibleBounds,
          anchor: { x: anchorX, y: anchorY },
          naturalCanvas,
          cyberCanvas
        });
      });

      this.isInitialized = true;
    }

    getAsset(id) {
      if (!this.isInitialized) this.init();
      if (REMOVED_PLANT_IDS.has(id)) return null;
      return this.assets.get(id) || null;
    }

    getAllAssets() {
      if (!this.isInitialized) this.init();
      return Array.from(this.assets.values()).filter(asset => !REMOVED_PLANT_IDS.has(asset.id));
    }

    getPlantAssets() {
      return this.getAllAssets().filter(asset => asset.zone !== "hardscape");
    }

    /**
     * Draw one asset directly as vectors into the aquarium's Hi-DPI layer.
     * No intermediate bitmap is enlarged, so large scale / fullscreen stays sharp.
     */
    drawAsset(ctx, id, groundX, groundY, scaleFactor = 1.0, themeMode = 'dark', variantSeed = 0) {
      const asset = this.getAsset(id);
      if (!asset) return;
      const renderFn = Renderers[asset.renderer];
      if (!renderFn) return;
      ctx = this._styledContext(ctx, themeMode);

      const finalScale = scaleFactor * asset.defaultScale;
      ctx.save();
      ctx.translate(groundX, groundY);
      ctx.scale(finalScale, finalScale);
      ctx.translate(-asset.anchor.x, -asset.anchor.y);
      const prevSalt = ACTIVE_SEED_SALT;
      ACTIVE_SEED_SALT = variantSeed >>> 0;
      renderFn(ctx, asset.logicalWidth, asset.logicalHeight);
      ACTIVE_SEED_SALT = prevSalt;
      ctx.restore();
    }

    getProceduralHorizontalInset(id, logicalScale = 1.0, scaleFactor = 1.0) {
      const asset = this.getAsset(id);
      if (!asset) return 0;
      const s = Math.max(0.35, logicalScale * scaleFactor * (asset.defaultScale || 1));
      // Maximum horizontal excursion beyond a procedural root. These values come
      // directly from each renderer's curve/leaf geometry, not a guessed zone margin.
      const exact = {
        hccuba: 3.2,
        montecarlo: 8.2,
        glossostigma: 17.5,
        'eleocharis-mini': 15.0,
        lilaeopsis: 21.0,
        rotala: 34.0,
        montevidensis: 36.5,
        myriophyllum: 24.0,
        limnophila: 30.0,
        bacopa: 22.0
      };
      if (Number.isFinite(exact[id])) return exact[id] * s;
      // Complete clump/specimen colonies (e.g. Pogostemon) need their authored
      // visible bounds around the root anchor. Colony clumps vary up to 1.09x.
      const vb = asset.visibleBounds;
      const anchor = asset.anchor;
      if (vb && anchor) {
        const left = Math.max(0, anchor.x - vb.x);
        const right = Math.max(0, vb.x + vb.width - anchor.x);
        const clumpBoost = asset.placementStrategy === 'colony' ? 1.09 : 1.0;
        return Math.max(left, right) * s * clumpBoost;
      }
      return 0;
    }

    /**
     * Continuous procedural carpet. WIDTH changes the actual generated planting area;
     * it does not repeat/copy a finished 340px specimen tile.
     * Every leaf/blade is grounded against the aquarium terrain independently.
     */
    drawCarpet(ctx, id, centerX, widthRatio, density = 1.0, terrainHeightFunc, tankWidth, logicalScale = 1.0, themeMode = 'dark') {
      const asset = this.getAsset(id);
      if (!asset) return;
      ctx = this._styledContext(ctx, themeMode);

      const centerPx = centerX * tankWidth;
      const halfW = Math.max(12, widthRatio * tankWidth * 0.5);
      const s = Math.max(0.35, logicalScale * asset.defaultScale);
      const edgeInset = this.getProceduralHorizontalInset(id, logicalScale, 1.0);
      const rootHalf = Math.max(0, halfW - edgeInset);
      const startX = Math.max(0, centerPx - rootHalf);
      const endX = Math.min(tankWidth, centerPx + rootHalf);
      const span = Math.max(1, endX - startX);
      const d = Math.max(0.25, Math.min(2.2, density || 1));
      // WIDTH describes the complete visible field. Keep population tied to that
      // requested visual width even though roots are inset to keep leaf tips inside it.
      const widthFactor = Math.max(1, halfW * 2) / 340;
      const rng = new PRNG((0x61c88647 ^ id.split('').reduce((h,c)=>Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261)) >>> 0);
      const randX = () => rng.range(startX, endX);
      const gy = x => terrainHeightFunc(x);

      ctx.save();
      if (id === 'hccuba') {
        for (let layer = 0; layer < 4; layer++) {
          const count = Math.max(30, Math.round(280 * widthFactor * d));
          for (let i = 0; i < count; i++) {
            const x = randX();
            const y = gy(x) - layer * 7 * s + rng.range(-6, 6) * s;
            const r = rng.range(1.6, 2.8) * s;
            ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.75, rng.range(-0.6,0.6), 0, Math.PI*2);
            ctx.fillStyle = layer===0 ? '#1b3b14' : layer===1 ? '#2f631f' : layer===2 ? '#4c9931' : (rng.next()>0.4 ? '#78cc4b' : '#9be36b');
            ctx.fill(); ctx.strokeStyle='#183810'; ctx.lineWidth=Math.max(0.25,0.3*s); ctx.stroke();
          }
        }
      } else if (id === 'montecarlo') {
        for (let layer = 0; layer < 4; layer++) {
          const count = Math.max(16, Math.round(95 * widthFactor * d));
          for (let i=0;i<count;i++) {
            const x=randX(); const y=gy(x)-layer*8*s+rng.range(-5,5)*s; const r=rng.range(4.5,7.5)*s;
            ctx.beginPath(); ctx.ellipse(x,y,r,r*0.8,rng.range(-0.4,0.4),0,Math.PI*2);
            ctx.fillStyle=layer===0?'#173617':layer===1?'#2b5e29':layer===2?'#438a3d':(rng.next()>0.3?'#68b85c':'#88d977'); ctx.fill();
            ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineWidth=Math.max(0.35,0.6*s); ctx.beginPath(); ctx.moveTo(x-r*0.5,y); ctx.lineTo(x+r*0.5,y); ctx.stroke();
          }
        }
      } else if (id === 'glossostigma') {
        const runners=Math.max(2,Math.round(6*d));
        for(let r=0;r<runners;r++){
          let x=startX+rng.range(0,Math.min(35,span*0.12));
          ctx.beginPath(); ctx.moveTo(x,gy(x)+rng.range(-4,2)*s);
          while(x<endX){ x+=rng.range(25,45)*s; const xx=Math.min(x,endX); ctx.lineTo(xx,gy(xx)+rng.range(-6,3)*s); }
          ctx.strokeStyle='#295420'; ctx.lineWidth=Math.max(0.7,1.4*s); ctx.stroke();
        }
        const count=Math.max(12,Math.round(70*widthFactor*d));
        for(let i=0;i<count;i++){
          const x=randX(), base=gy(x)+rng.range(-5,3)*s, stalk=rng.range(10,18)*s, curve=rng.range(-6,6)*s;
          for(const side of [-1,1]){
            const tx=x+side*6*s+curve, ty=base-stalk;
            ctx.strokeStyle='#38732c'; ctx.lineWidth=Math.max(0.5,1*s); ctx.beginPath(); ctx.moveTo(x,base); ctx.quadraticCurveTo(x+side*4*s,base-stalk*.5,tx,ty); ctx.stroke();
            ctx.beginPath(); ctx.ellipse(tx,ty,4*s,7*s,side*.4,0,Math.PI*2); ctx.fillStyle=side<0?'#59a840':'#6bc24e'; ctx.fill(); ctx.strokeStyle='#244d18'; ctx.lineWidth=Math.max(0.3,.5*s); ctx.stroke();
          }
        }
      } else if (id === 'eleocharis-mini') {
        const count=Math.max(60,Math.round(550*widthFactor*d));
        for(let i=0;i<count;i++){
          const x=randX(), base=gy(x)+rng.range(-3,3)*s, h=rng.range(25,65)*s, curve=rng.range(-14,14)*s;
          ctx.beginPath(); ctx.moveTo(x,base); ctx.quadraticCurveTo(x+curve*.4,base-h*.55,x+curve,base-h);
          ctx.strokeStyle=h>48*s?(rng.next()>.5?'#5cb347':'#7ed966'):'#3a782e'; ctx.lineWidth=rng.range(.6,1.2)*s; ctx.stroke();
        }
      } else if (id === 'lilaeopsis') {
        const count=Math.max(24,Math.round(180*widthFactor*d));
        for(let i=0;i<count;i++){
          const x=randX(), base=gy(x), h=rng.range(45,95)*s, curve=rng.range(-18,18)*s, wid=rng.range(2,3.8)*s;
          ctx.beginPath(); ctx.moveTo(x-wid*.5,base); ctx.quadraticCurveTo(x+curve*.5-wid*.3,base-h*.5,x+curve,base-h); ctx.quadraticCurveTo(x+curve*.5+wid*.3,base-h*.5,x+wid*.5,base); ctx.closePath();
          const grad=ctx.createLinearGradient(x,base,x+curve,base-h); grad.addColorStop(0,'#1c3d18'); grad.addColorStop(.6,'#39782f'); grad.addColorStop(1,'#65bd51'); ctx.fillStyle=grad; ctx.fill(); ctx.strokeStyle='#152e12'; ctx.lineWidth=Math.max(.3,.5*s); ctx.stroke();
        }
      } else {
        // Safe fallback for any future carpet asset.
        this.drawAsset(ctx,id,centerPx,terrainHeightFunc(centerPx),logicalScale,themeMode,0);
      }
      ctx.restore();
    }

    /**
     * Continuous colony field. For stem/grass species WIDTH controls a planting
     * region and individual stem bands are sampled from the renderer, instead of
     * cloning a complete finished specimen side-by-side.
     */
    drawColony(ctx, id, centerX, widthRatio, density = 1.0, scaleFactor = 1.0, terrainHeightFunc, tankWidth, logicalScale = 1.0, themeMode = 'dark') {
      const asset = this.getAsset(id);
      if (!asset) return;
      const renderFn = Renderers[asset.renderer];
      if (!renderFn) return;
      ctx = this._styledContext(ctx, themeMode);

      const centerPx = centerX * tankWidth;
      const colonyWidthPx = Math.max(30, widthRatio * tankWidth);
      const halfW = colonyWidthPx * 0.5;
      const d = Math.max(0.35, Math.min(2.0, density || 1));
      const s = Math.max(0.35, logicalScale * scaleFactor * asset.defaultScale);
      const edgeInset = this.getProceduralHorizontalInset(id, logicalScale, scaleFactor);
      const rootHalf = Math.max(0, halfW - edgeInset);
      const startX = Math.max(0, centerPx - rootHalf);
      const endX = Math.min(tankWidth, centerPx + rootHalf);
      const span = Math.max(1, endX - startX);

      // Rosette/clump species stay as complete plants. They are not stem fields.
      const clumpSpecies = new Set(['cryptowendtii', 'pogostemon']);
      if (clumpSpecies.has(id)) {
        const count = Math.max(1, Math.min(4, Math.round((span / Math.max(90, asset.visibleBounds.width * s * 0.55)) * d)));
        for (let i = 0; i < count; i++) {
          const t = count > 1 ? i / (count - 1) : 0.5;
          const x = startX + t * span + ((((i * 19) % 9) - 4) / 4) * Math.min(16, span / Math.max(3, count) * 0.22);
          const sc = (logicalScale * scaleFactor) * (0.88 + ((i * 11) % 7) * 0.035);
          this.drawAsset(ctx, id, x, terrainHeightFunc(x), sc, themeMode, (i + 1) * 0x85ebca6b);
        }
        return;
      }

      // Ambulia keeps the slimmer v90 treatment.
      // Sample authored stems by their ROOT position only. The leaf/stem geometry itself
      // is never clipped, so the narrow silhouette is retained without cut-off leaves.
      if (id === 'limnophila') {
        const targetSpacing = Math.max(24, 52 * logicalScale / Math.sqrt(d));
        const slotCount = Math.max(2, Math.min(18, Math.ceil(span / targetSpacing) + 1));
        const vb = asset.visibleBounds;
        const sourceBands = 5;
        const sourceBandWidth = Math.max(1, vb.width / sourceBands);

        for (let i = 0; i < slotCount; i++) {
          const t = slotCount > 1 ? i / (slotCount - 1) : 0.5;
          const jitter = ((((i * 23) % 13) - 6) / 6) * Math.min(14, span / Math.max(3, slotCount) * 0.25);
          const x = Math.max(startX, Math.min(endX, startX + t * span + jitter));
          const band = ((i * 3 + Math.floor(i / 3) * 2) % sourceBands);
          const sampleX = vb.x + ((band + 0.5) / sourceBands) * vb.width;
          const localScale = s * (0.88 + ((i * 7) % 6) * 0.035);
          const groundY = terrainHeightFunc(x);

          ctx.save();
          ctx.translate(x, groundY);
          ctx.scale(localScale, localScale);
          ctx.translate(-sampleX, -asset.anchor.y);
          const prevSalt = ACTIVE_SEED_SALT;
          const prevWindow = ACTIVE_SOURCE_WINDOW;
          ACTIVE_SEED_SALT = ((i + 1) * 0x9e3779b1) >>> 0;
          ACTIVE_SOURCE_WINDOW = {
            minX: sampleX - sourceBandWidth * 0.58,
            maxX: sampleX + sourceBandWidth * 0.58
          };
          renderFn(ctx, asset.logicalWidth, asset.logicalHeight);
          ACTIVE_SOURCE_WINDOW = prevWindow;
          ACTIVE_SEED_SALT = prevSalt;
          ctx.restore();
        }
        return;
      }

      // Background stem plants are generated directly across the requested WIDTH.
      // Do not slice/clip a finished 340px specimen and do not clone the whole specimen.
      // The default WIDTH reproduces each species' authored stem count; WIDTH/DENSITY
      // change the number of roots, while SCALE changes the size of each individual plant.
      const profiles = {
        'montevidensis':      { defaultWidth: 0.14, count: 64,  maxCount: 120, seed: 2626 }, // v96: cap long quadratic blades
        'rotala':             { defaultWidth: 0.18, count: 38,  seed: 2222 },
        'limnophila':         { defaultWidth: 0.16, count: 4,   seed: 2424 },
        'bacopa':             { defaultWidth: 0.15, count: 4,   seed: 2525 },
        'myriophyllum':       { defaultWidth: 0.14, count: 4,   seed: 2727 }
      };
      const profile = profiles[id];
      if (!profile) {
        this.drawAsset(ctx, id, centerPx, terrainHeightFunc(centerPx), logicalScale * scaleFactor, themeMode, 0);
        return;
      }

      const sizeMul = Math.max(0.55, Math.min(1.8, scaleFactor || 1));
      let count;
      if (profile.maxCount) {
        // A hard cap used to make wide Giant Hairgrass hit 120 stems before
        // DENSITY reached 100%, so the upper half of the slider appeared dead.
        // Reserve the full cap for DENSITY=160% and let WIDTH mostly change spacing.
        const widthGrowth = Math.pow(Math.max(0.20, widthRatio / profile.defaultWidth), 0.55);
        const baseAt100 = Math.min(profile.maxCount / 1.60, (profile.count * widthGrowth) / sizeMul);
        count = Math.max(2, Math.min(profile.maxCount, Math.round(baseAt100 * d)));
      } else {
        count = Math.max(2, Math.round(profile.count * (widthRatio / profile.defaultWidth) * d / sizeMul));
      }
      const rng = new PRNG(profile.seed);
      const posRng = new PRNG((profile.seed ^ 0x6d2b79f5) >>> 0);
      const rootX = (i) => {
        if (count <= 1) return centerPx;
        const t = i / (count - 1);
        const cell = span / Math.max(1, count - 1);
        // End roots stay on the WIDTH edges; only interior roots get small organic jitter.
        const jitter = (i === 0 || i === count - 1) ? 0 : posRng.range(-0.22, 0.22) * cell;
        return Math.max(startX, Math.min(endX, startX + t * span + jitter));
      };
      const moundHeight = (t, minH, maxH) => {
        const edge = Math.abs(t * 2 - 1);
        return (maxH - (maxH - minH) * Math.pow(edge, 0.72) + rng.range(-9, 9)) * s;
      };
      const interpolateProfile = (values, t) => {
        if (!values.length) return 200 * s;
        const at = Math.max(0, Math.min(values.length - 1, t * (values.length - 1)));
        const lo = Math.floor(at), hi = Math.min(values.length - 1, lo + 1), f = at - lo;
        return (values[lo] + (values[hi] - values[lo]) * f) * s;
      };

      ctx.save();

      if (id === 'rotala') {
        for (let i = 0; i < count; i++) {
          const x = rootX(i);
          const tRoot = count > 1 ? i / (count - 1) : 0.5;
          const base = terrainHeightFunc(x);
          rng.range(-6, 6);
          const h = rng.range(160, 245) * s;
          const curve = rng.range(-20, 20) * s;
          ctx.strokeStyle = '#47291a'; ctx.lineWidth = Math.max(0.7, 1.4 * s);
          ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x + curve * 0.5, base - h * 0.5, x + curve, base - h); ctx.stroke();
          const nodes = 16;
          for (let n = 1; n <= nodes; n++) {
            const t = n / nodes;
            const y = base - h * t;
            const nx = x + curve * (t * t);
            const leafL = (10 + t * 4) * s;
            const leafColor = t < 0.4 ? '#3a6627' : (t < 0.75 ? '#c46927' : '#e8385a');
            for (const side of [-1, 1]) {
              ctx.save(); ctx.translate(nx, y); ctx.rotate(side * (0.65 + rng.range(-0.1, 0.1)));
              ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(side * leafL, -2 * s); ctx.lineTo(side * leafL * 0.8, 2 * s); ctx.closePath();
              ctx.fillStyle = leafColor; ctx.fill(); ctx.restore();
            }
          }
        }
      } else if (id === 'hygrophila') {
        for (let i = 0; i < count; i++) {
          const x = rootX(i), tRoot = count > 1 ? i / (count - 1) : 0.5, base = terrainHeightFunc(x);
          const h = interpolateProfile([190,235,245,220,180], tRoot), topX = x + rng.range(-6, 6) * s;
          ctx.strokeStyle = '#224a1b'; ctx.lineWidth = Math.max(1.2, 3.2 * s);
          ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(topX, base - h); ctx.stroke();
          const tiers = 8;
          for (let n = 1; n <= tiers; n++) {
            const t = n / tiers, y = base - h * t, nx = x + (topX - x) * t, size = (22 + n * 2.8) * s;
            for (const side of [-1, 1]) {
              ctx.save(); ctx.translate(nx, y); ctx.rotate(side * (0.7 + rng.range(-0.1, 0.1)));
              ctx.beginPath(); ctx.moveTo(0, 0);
              ctx.bezierCurveTo(side * size * 0.4, -size * 0.25, side * size * 0.8, -size * 0.15, side * size, 0);
              ctx.bezierCurveTo(side * size * 0.8, size * 0.15, side * size * 0.4, size * 0.25, 0, 0); ctx.closePath();
              const grad = ctx.createLinearGradient(0, 0, side * size, 0);
              if (n >= tiers - 1) { grad.addColorStop(0, '#3f872b'); grad.addColorStop(1, '#8de66e'); }
              else { grad.addColorStop(0, '#1c4217'); grad.addColorStop(1, '#458c38'); }
              ctx.fillStyle = grad; ctx.fill(); ctx.strokeStyle = '#183813'; ctx.lineWidth = Math.max(0.35, 0.6 * s); ctx.stroke(); ctx.restore();
            }
          }
        }
      } else if (id === 'ludwigia-super-red') {
        for (let i = 0; i < count; i++) {
          const x = rootX(i), tRoot = count > 1 ? i / (count - 1) : 0.5, base = terrainHeightFunc(x);
          const h = interpolateProfile([180,220,235,210,175], tRoot);
          ctx.strokeStyle = '#4a0d18'; ctx.lineWidth = Math.max(1.1, 3.0 * s);
          ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, base - h); ctx.stroke();
          const tiers = 8;
          for (let n = 1; n <= tiers; n++) {
            const y = base - h * (n / tiers), size = (18 + n * 3.2) * s;
            for (const side of [-1, 1]) {
              ctx.save(); ctx.translate(x, y); ctx.rotate(side * 0.65);
              ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(side * size * 0.5, -size * 0.35); ctx.lineTo(side * size, 0); ctx.lineTo(side * size * 0.5, size * 0.35); ctx.closePath();
              const grad = ctx.createLinearGradient(0, 0, side * size, 0); grad.addColorStop(0, '#540f1c'); grad.addColorStop(0.5, '#9e1930'); grad.addColorStop(1, '#e3294c');
              ctx.fillStyle = grad; ctx.fill(); ctx.strokeStyle = '#ff8299'; ctx.lineWidth = Math.max(0.45, 1.0 * s); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(side * size * 0.95, 0); ctx.stroke(); ctx.restore();
            }
          }
        }
      } else if (id === 'limnophila') {
        for (let i = 0; i < count; i++) {
          const x = rootX(i), tRoot = count > 1 ? i / (count - 1) : 0.5, base = terrainHeightFunc(x), h = interpolateProfile([200,240,230,195], tRoot);
          ctx.strokeStyle = '#2d5e23'; ctx.lineWidth = Math.max(0.8, 2.0 * s); ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, base - h); ctx.stroke();
          const whorls = 9;
          for (let n = 1; n <= whorls; n++) {
            const y = base - h * (n / whorls), radius = (16 + n * 2.2) * s;
            for (let r = 0; r < 16; r++) {
              const a = (r / 16) * Math.PI * 2, rx = x + Math.cos(a) * radius, ry = y + Math.sin(a) * radius * 0.4;
              ctx.strokeStyle = n >= whorls - 2 ? '#86e660' : '#459930'; ctx.lineWidth = Math.max(0.35, 0.8 * s);
              ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(rx, ry); ctx.stroke(); ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + Math.cos(a + 0.4) * 4 * s, ry + Math.sin(a + 0.4) * 4 * s); ctx.stroke();
            }
          }
        }
      } else if (id === 'bacopa') {
        for (let i = 0; i < count; i++) {
          const x = rootX(i), tRoot = count > 1 ? i / (count - 1) : 0.5, base = terrainHeightFunc(x), h = interpolateProfile([185,235,225,195], tRoot), topX = x + rng.range(-4, 4) * s;
          ctx.strokeStyle = '#39702a'; ctx.lineWidth = Math.max(1.2, 3.6 * s); ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(topX, base - h); ctx.stroke();
          const tiers = 7;
          for (let n = 1; n <= tiers; n++) {
            const t = n / tiers, y = base - h * t, nx = x + (topX - x) * t, size = (18 + n * 2.0) * s;
            for (const side of [-1, 1]) {
              ctx.save(); ctx.translate(nx, y); ctx.rotate(side * 0.7); ctx.beginPath(); ctx.ellipse(side * size * 0.55, 0, size * 0.55, size * 0.4, 0, 0, Math.PI * 2);
              ctx.fillStyle = n >= tiers - 1 ? '#86de59' : '#4d9933'; ctx.fill(); ctx.strokeStyle = '#265418'; ctx.lineWidth = Math.max(0.35, 0.8 * s); ctx.stroke(); ctx.restore();
            }
          }
        }
      } else if (id === 'myriophyllum') {
        for (let i = 0; i < count; i++) {
          const x = rootX(i), tRoot = count > 1 ? i / (count - 1) : 0.5, base = terrainHeightFunc(x), h = interpolateProfile([195,240,230,185], tRoot);
          ctx.strokeStyle = '#2b5722'; ctx.lineWidth = Math.max(0.7, 1.8 * s); ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, base - h); ctx.stroke();
          const tiers = 22;
          for (let n = 1; n <= tiers; n++) {
            const y = base - h * (n / tiers), wl = (16 + (n / tiers) * 8) * s;
            for (const side of [-1, 1]) {
              const a = side * 0.7; ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.strokeStyle = n > tiers - 4 ? '#92f071' : '#4fa834'; ctx.lineWidth = Math.max(0.3, 0.6 * s);
              ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(side * wl, 0);
              for (let f = 2; f <= (16 + (n / tiers) * 8); f += 3) { const fx = side * f * s; ctx.moveTo(fx, 0); ctx.lineTo(fx - side * 3 * s, -4 * s); ctx.moveTo(fx, 0); ctx.lineTo(fx - side * 3 * s, 4 * s); }
              ctx.stroke(); ctx.restore();
            }
          }
        }
      } else if (id === 'montevidensis') {
        // PAKU: a single accent tuft reads as loose/airborne strands when each blade
        // gets the full +-35 curve independently. Tighter curve range keeps blades
        // growing mostly straight up, like a planted clump rather than a scattered bundle.
        for (let i = 0; i < count; i++) {
          const x = rootX(i), base = terrainHeightFunc(x); rng.range(25, 315); const h = rng.range(170, 255) * s, curve = rng.range(-10, 10) * s;
          ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x + curve * 0.4, base - h * 0.6, x + curve, base - h);
          ctx.strokeStyle = h > 220 * s ? (rng.next() > 0.4 ? '#68cc4e' : '#8ef073') : '#327327'; ctx.lineWidth = Math.max(0.45, rng.range(0.8, 1.4) * s); ctx.stroke();
        }
      }

      ctx.restore();
    }

    /** CYBER material finish: palette is already authored by the styled context. */
    applyCyberTreatment(ctx, width, height) {
      // Very small internal lift only.  This must read as self-emission from the
      // existing leaf/stem surface, not as a cyan colour filter laid over it.
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      const grad = ctx.createLinearGradient(0,0,0,height);
      grad.addColorStop(0,'rgba(232,255,255,0.240)');
      grad.addColorStop(0.48,'rgba(108,255,239,0.145)');
      grad.addColorStop(1,'rgba(82,220,255,0.175)');
      ctx.fillStyle=grad;
      ctx.fillRect(0,0,width,height);
      ctx.restore();
    }

  }

  global.BotanicalEngine = new BotanicalEngine();

})(typeof window !== 'undefined' ? window : this);
