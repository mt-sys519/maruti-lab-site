/**
 * Imperative DOM particle effects for INPUT RAIN's falling prompt glyphs, inspired by
 * PromptTerm CLOCK's digit-transition rain (sample points across the glyph, spawn
 * short-lived noise glyphs, animate them with the Web Animations API). Scoped to the
 * prompt's own glyphs only — this is not a full-screen background rain.
 */

const NOISE_GLYPHS = ["ﾊ", "ﾐ", "ﾋ", "ｳ", "ｼ", "ﾅ", "ﾓ", "ﾆ", "ｻ", "ﾜ", "ﾂ", "ｵ", "ﾘ", "ｱ", "ﾎ", "ﾃ", "ﾏ", "ｹ", "ﾒ", "ｴ", "ｶ", "ｷ", "ﾑ", "ﾕ", "ﾗ", "ｾ", "ﾈ", "ｽ", "ﾀ", "ﾇ", "ﾍ", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

function randomGlyph() {
  return NOISE_GLYPHS[Math.floor(Math.random() * NOISE_GLYPHS.length)];
}

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function spawnParticle(layer: HTMLElement, x: number, y: number, extraClass: string, size: number) {
  const span = document.createElement("span");
  span.className = `inputRainParticle ${extraClass}`;
  span.textContent = randomGlyph();
  span.style.left = `${x}px`;
  span.style.top = `${y}px`;
  span.style.fontSize = `${size}px`;
  layer.appendChild(span);
  return span;
}

/** A point sampled somewhere across a glyph's own footprint, not just its center. */
function samplePointInGlyph(rect: DOMRect, layerRect: DOMRect) {
  const x = rect.left + rect.width * (0.22 + Math.random() * 0.56) - layerRect.left;
  const y = rect.top + rect.height * (0.2 + Math.random() * 0.6) - layerRect.top;
  return { x, y };
}

/** Shatters each glyph into a cascade of falling/drifting noise particles sampled across its shape. */
export function spawnDissolve(layer: HTMLElement | null, glyphEls: NodeListOf<Element> | Element[], variant: "accept" | "miss") {
  if (!layer || prefersReducedMotion()) return;
  const layerRect = layer.getBoundingClientRect();
  const perGlyph = glyphEls.length > 12 ? 4 : 6;
  const glyphClass = variant === "miss" ? "isMiss" : "isAccept";
  Array.from(glyphEls).forEach((glyphEl, index) => {
    const rect = glyphEl.getBoundingClientRect();
    for (let i = 0; i < perGlyph; i += 1) {
      const { x, y } = samplePointInGlyph(rect, layerRect);
      const size = 13 + Math.random() * 8;
      const particle = spawnParticle(layer, x, y, glyphClass, size);
      const drift = (Math.random() - 0.5) * 64;
      const fall = 90 + Math.random() * 150;
      const rotate = (Math.random() - 0.5) * 60;
      const delay = index * 16 + i * 22 + Math.random() * 50;
      const duration = 480 + Math.random() * 320;
      const animation = particle.animate(
        [
          { transform: "translate(-50%,-50%) translate(0,0) rotate(0deg) scale(1)", opacity: 1, filter: "brightness(2.2)" },
          { offset: 0.14, opacity: 1, filter: "brightness(1.4)" },
          { offset: 0.6, opacity: 0.85 },
          { transform: `translate(-50%,-50%) translate(${drift}px,${fall}px) rotate(${rotate}deg) scale(.72)`, opacity: 0, filter: "brightness(.7)" },
        ],
        { duration, delay, easing: "cubic-bezier(.22,.6,.3,1)", fill: "forwards" },
      );
      animation.onfinish = () => particle.remove();
    }
  });
}

/** Rains a cascade of noise particles down into each glyph's shape as it first appears. */
export function spawnMaterialize(layer: HTMLElement | null, glyphEls: NodeListOf<Element> | Element[]) {
  if (!layer || prefersReducedMotion()) return;
  const layerRect = layer.getBoundingClientRect();
  const perGlyph = glyphEls.length > 12 ? 3 : 5;
  Array.from(glyphEls).forEach((glyphEl, index) => {
    const rect = glyphEl.getBoundingClientRect();
    for (let i = 0; i < perGlyph; i += 1) {
      const { x: targetX, y: targetY } = samplePointInGlyph(rect, layerRect);
      const startY = targetY - 70 - Math.random() * 90;
      const startX = targetX + (Math.random() - 0.5) * 30;
      const size = 12 + Math.random() * 7;
      const particle = spawnParticle(layer, startX, startY, "isForm", size);
      const delay = index * 18 + i * 20 + Math.random() * 50;
      const duration = 340 + Math.random() * 210;
      const animation = particle.animate(
        [
          { transform: "translate(-50%,-50%) translate(0,0)", opacity: 0 },
          { offset: 0.18, opacity: 1 },
          { offset: 0.82, opacity: 0.75 },
          { transform: `translate(-50%,-50%) translate(${targetX - startX}px,${targetY - startY}px)`, opacity: 0 },
        ],
        { duration, delay, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" },
      );
      animation.onfinish = () => particle.remove();
    }
  });
}
