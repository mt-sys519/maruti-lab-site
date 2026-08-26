/**
 * Imperative DOM particle effects for INPUT RAIN's falling prompt glyphs, inspired by
 * PromptTerm CLOCK's digit-transition rain (sample points, spawn short-lived glyphs,
 * animate them with the Web Animations API). Scoped to the prompt's own glyphs only —
 * this is not a full-screen background rain.
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

function spawnParticle(layer: HTMLElement, x: number, y: number, extraClass: string) {
  const span = document.createElement("span");
  span.className = `inputRainParticle ${extraClass}`;
  span.textContent = randomGlyph();
  span.style.left = `${x}px`;
  span.style.top = `${y}px`;
  layer.appendChild(span);
  return span;
}

/** Bursts each glyph into a few falling/drifting noise particles that fade out. */
export function spawnDissolve(layer: HTMLElement | null, glyphEls: NodeListOf<Element> | Element[], variant: "accept" | "miss") {
  if (!layer || prefersReducedMotion()) return;
  const layerRect = layer.getBoundingClientRect();
  const perGlyph = glyphEls.length > 14 ? 1 : 2;
  const glyphClass = variant === "miss" ? "isMiss" : "isAccept";
  Array.from(glyphEls).forEach((glyphEl, index) => {
    const rect = glyphEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2 - layerRect.left;
    const cy = rect.top + rect.height / 2 - layerRect.top;
    for (let i = 0; i < perGlyph; i += 1) {
      const particle = spawnParticle(layer, cx, cy, glyphClass);
      const drift = (Math.random() - 0.5) * 50;
      const fall = 64 + Math.random() * 96;
      const rotate = (Math.random() - 0.5) * 46;
      const delay = index * 12 + Math.random() * 40;
      const duration = 420 + Math.random() * 240;
      const animation = particle.animate(
        [
          { transform: "translate(-50%,-50%) translate(0,0) rotate(0deg)", opacity: 1 },
          { offset: 0.16, opacity: 0.95 },
          { transform: `translate(-50%,-50%) translate(${drift}px,${fall}px) rotate(${rotate}deg)`, opacity: 0 },
        ],
        { duration, delay, easing: "cubic-bezier(.22,.6,.3,1)", fill: "forwards" },
      );
      animation.onfinish = () => particle.remove();
    }
  });
}

/** Drops a couple of noise particles into each glyph's position as it first appears. */
export function spawnMaterialize(layer: HTMLElement | null, glyphEls: NodeListOf<Element> | Element[]) {
  if (!layer || prefersReducedMotion()) return;
  const layerRect = layer.getBoundingClientRect();
  const perGlyph = glyphEls.length > 14 ? 1 : 2;
  Array.from(glyphEls).forEach((glyphEl, index) => {
    const rect = glyphEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2 - layerRect.left;
    const cy = rect.top + rect.height / 2 - layerRect.top;
    for (let i = 0; i < perGlyph; i += 1) {
      const startY = cy - 46 - Math.random() * 54;
      const startX = cx + (Math.random() - 0.5) * 22;
      const particle = spawnParticle(layer, startX, startY, "isForm");
      const delay = index * 14 + Math.random() * 40;
      const duration = 300 + Math.random() * 170;
      const animation = particle.animate(
        [
          { transform: "translate(-50%,-50%) translate(0,0)", opacity: 0 },
          { offset: 0.2, opacity: 0.9 },
          { offset: 0.86, opacity: 0.6 },
          { transform: `translate(-50%,-50%) translate(${cx - startX}px,${cy - startY}px)`, opacity: 0 },
        ],
        { duration, delay, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" },
      );
      animation.onfinish = () => particle.remove();
    }
  });
}
