/**
 * The card that gets shared: the glass as it was left, its name, and what went
 * into it, drawn as a picture rather than typed into a post.
 *
 * X will not take an image from a link, so there is nothing to be gained by
 * sending it words and hoping. Where the browser can hand a file to the share
 * sheet - every phone worth caring about here - the picture goes straight to
 * whatever the person picks. Where it cannot, the picture is saved and the
 * post is opened beside it.
 */
export type CardCube = { x: number; y: number; turn: number };
export type CardInput = {
  name: string;
  rows: string[];
  fill: number;
  deep: string;
  thin: string;
  cubes: CardCube[];
  fizz?: number;
};

const W = 1200;
const H = 630;
const PAPER = "#fefdfb";
const INK = "#262923";
const FONT = '"Yu Gothic", "Hiragino Kaku Gothic ProN", Arial, sans-serif';
const BAND: [number, string][] = [
  [0, "#ebe4d2"],
  [0.11, "#873205"],
  [0.29, "#fe941a"],
  [0.47, "#f6d605"],
  [0.67, "#7bb42c"],
  [0.87, "#8124af"],
  [1, "#ebe4d2"],
];

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: [number, number, number, number]) {
  c.beginPath();
  c.moveTo(x + r[0], y);
  c.lineTo(x + w - r[1], y);
  c.quadraticCurveTo(x + w, y, x + w, y + r[1]);
  c.lineTo(x + w, y + h - r[2]);
  c.quadraticCurveTo(x + w, y + h, x + w - r[2], y + h);
  c.lineTo(x + r[3], y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r[3]);
  c.lineTo(x, y + r[0]);
  c.quadraticCurveTo(x, y, x + r[0], y);
  c.closePath();
}

function glass(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
  deep: string,
  thin: string,
  cubes: CardCube[],
  fizz: number,
) {
  const wall = 9;
  c.save();
  // Clipped to the inside of the glass, not to the glass: the drink turns the
  // corner at the bottom the way the glass does, and stops short of the wall.
  const inner = { x: x + wall, y: y + wall, w: w - wall * 2, h: h - wall - 12 };
  roundRect(c, inner.x, inner.y, inner.w, inner.h, [4, 4, 22, 22]);
  c.clip();
  const level = inner.y + inner.h - fill;
  if (fill > 0) {
    const g = c.createLinearGradient(0, level, 0, inner.y + inner.h);
    g.addColorStop(0, thin);
    g.addColorStop(0.38, deep);
    g.addColorStop(1, deep);
    c.fillStyle = g;
    c.fillRect(inner.x, level, inner.w, inner.h - (level - inner.y));
    if (fizz > 0) {
      c.fillStyle = `rgba(255,255,255,${0.16 + fizz * 0.34})`;
      for (let i = 0; i < Math.round(fizz * 26) + 6; i++) {
        const bx = inner.x + 10 + ((i * 53) % (inner.w - 20));
        const by = level + 14 + ((i * 89) % Math.max(18, fill - 20));
        c.beginPath();
        c.arc(bx, by, 2 + ((i * 7) % 4), 0, Math.PI * 2);
        c.fill();
      }
    }
  }
  for (const cube of cubes) {
    const size = 44;
    const cx = inner.x + inner.w / 2 + cube.x * 1.35;
    const cy = level + cube.y * 1.35 - size * 0.38;
    c.save();
    c.translate(cx, cy + size / 2);
    c.rotate((cube.turn * Math.PI) / 180);
    c.fillStyle = "rgba(255,255,255,.82)";
    roundRect(c, -size / 2, -size / 2, size, size * 0.86, [11, 11, 11, 11]);
    c.fill();
    c.restore();
  }
  c.restore();

  // The glass itself, over the drink: a sheen across the body, a bright streak
  // down the left where the light stands, and the rim last of all.
  c.save();
  roundRect(c, x, y, w, h, [6, 6, 34, 34]);
  c.clip();
  const sheen = c.createLinearGradient(x, y, x + w, y + h);
  sheen.addColorStop(0, "rgba(255,255,255,.42)");
  sheen.addColorStop(0.38, "rgba(255,255,255,.04)");
  sheen.addColorStop(1, "rgba(214,220,208,.22)");
  c.fillStyle = sheen;
  c.fillRect(x, y, w, h);
  c.fillStyle = "rgba(255,255,255,.62)";
  roundRect(c, x + 22, y + 24, 9, h - 78, [5, 5, 5, 5]);
  c.fill();
  c.restore();

  c.strokeStyle = "#aeb4a7";
  c.lineWidth = 2;
  roundRect(c, x, y, w, h, [6, 6, 34, 34]);
  c.stroke();
}

export function drawMixPopCard({ name, rows, fill, deep, thin, cubes, fizz = 0 }: CardInput) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d");
  if (!c) return canvas;
  c.fillStyle = PAPER;
  c.fillRect(0, 0, W, H);

  // The same rainbow line the page wears, across the top of the card.
  const line = c.createLinearGradient(0, 0, W, 0);
  BAND.forEach(([at, colour]) => line.addColorStop(at, colour));
  c.fillStyle = line;
  c.fillRect(0, 0, W, 5);

  c.fillStyle = "#8b9182";
  c.font = `600 21px ${FONT}`;
  c.letterSpacing = "3px";
  c.fillText("MARUTIBIT / MIX POP", 92, 92);
  c.strokeStyle = "#e2e3da";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(92, 118);
  c.lineTo(W - 92, 118);
  c.stroke();

  glass(c, 116, 176, 236, 330, fill, deep, thin, cubes, fizz);

  c.letterSpacing = "0px";
  c.fillStyle = INK;
  c.font = `700 66px ${FONT}`;
  c.fillText(name, 430, 268);

  c.font = `400 27px ${FONT}`;
  c.fillStyle = "#5d6356";
  rows.forEach((row, i) => c.fillText(row, 430, 336 + i * 44));

  c.fillStyle = "#9aa092";
  c.font = `500 20px ${FONT}`;
  c.letterSpacing = "2px";
  c.fillText("YOUR ORIGINAL MIX", 430, 206);

  c.letterSpacing = "1px";
  c.font = `500 24px ${FONT}`;
  c.fillStyle = "#8b9182";
  c.fillText("好きなジュースを、好きなだけ。", 430, H - 96);
  c.strokeStyle = "#e2e3da";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(430, H - 74);
  c.lineTo(W - 92, H - 74);
  c.stroke();
  c.letterSpacing = "0px";
  return canvas;
}

export const cardFile = (canvas: HTMLCanvasElement) =>
  new Promise<File>((resolve) =>
    canvas.toBlob((blob) => resolve(new File([blob as Blob], "mixpop.png", { type: "image/png" })), "image/png"),
  );
