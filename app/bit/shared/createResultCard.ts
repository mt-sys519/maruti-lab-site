export type ResultCardData = {
  series: string;
  gameNumber: string;
  gameTitle: string;
  gameDescription: string;
  level: string;
  score: number;
  correct: string;
  time: string;
  url: string;
};

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

function drawMetric(ctx: CanvasRenderingContext2D, x: number, label: string, value: string) {
  ctx.fillStyle = "#68736e";
  ctx.font = '600 19px "Yu Gothic UI", sans-serif';
  ctx.fillText(label, x, 469);
  ctx.fillStyle = "#183d55";
  ctx.font = '700 35px "Yu Gothic UI", sans-serif';
  ctx.fillText(value, x, 518);
}

/** Creates the reusable MarutiBit result card shared by every game. */
export async function createResultCard(data: ResultCardData) {
  if (document.fonts?.ready) await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#e9e4d7";
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.strokeStyle = "rgba(24,61,85,.09)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= CARD_WIDTH; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CARD_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= CARD_HEIGHT; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CARD_WIDTH, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(21,33,29,.65)";
  ctx.lineWidth = 2;
  ctx.strokeRect(38, 38, CARD_WIDTH - 76, CARD_HEIGHT - 76);
  ctx.fillStyle = "#a94235";
  ctx.fillRect(38, 38, 12, CARD_HEIGHT - 76);

  ctx.fillStyle = "#52635c";
  ctx.font = '600 18px "Yu Gothic UI", sans-serif';
  ctx.letterSpacing = "3px";
  ctx.fillText(`${data.series.toUpperCase()} / ${data.gameNumber}`, 84, 91);

  ctx.fillStyle = "#183d55";
  ctx.font = '700 78px "Arial Narrow", "Yu Gothic UI", sans-serif';
  ctx.letterSpacing = "-2px";
  ctx.fillText(data.gameTitle, 80, 188);

  ctx.fillStyle = "#68736e";
  ctx.font = '600 18px "Yu Gothic UI", sans-serif';
  ctx.letterSpacing = "4px";
  ctx.fillText("SCORE", 82, 252);
  ctx.fillStyle = "#183d55";
  ctx.font = '600 150px "Arial Narrow", "Yu Gothic UI", sans-serif';
  ctx.letterSpacing = "-5px";
  ctx.fillText(data.score.toLocaleString(), 72, 401);

  ctx.strokeStyle = "rgba(21,33,29,.34)";
  ctx.beginPath();
  ctx.moveTo(650, 110);
  ctx.lineTo(650, 534);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(696, 431);
  ctx.lineTo(1110, 431);
  ctx.stroke();

  ctx.fillStyle = "#a94235";
  ctx.font = '700 19px "Yu Gothic UI", sans-serif';
  ctx.letterSpacing = "3px";
  ctx.fillText("RESULT", 698, 139);
  ctx.fillStyle = "#183d55";
  ctx.font = '600 64px "Yu Gothic UI", sans-serif';
  ctx.letterSpacing = "0px";
  ctx.fillText(data.level, 694, 222);

  ctx.fillStyle = "#52635c";
  ctx.font = '600 25px "Yu Gothic UI", sans-serif';
  ctx.letterSpacing = "1px";
  ctx.fillText(data.gameDescription, 696, 302);
  ctx.fillStyle = "#a94235";
  ctx.font = '700 17px "Yu Gothic UI", sans-serif';
  ctx.letterSpacing = "3px";
  ctx.fillText("10 QUESTIONS", 698, 345);

  drawMetric(ctx, 700, "CORRECT", data.correct);
  drawMetric(ctx, 900, "TIME", data.time);

  ctx.fillStyle = "#52635c";
  ctx.font = '500 17px "Yu Gothic UI", sans-serif';
  ctx.letterSpacing = "2px";
  ctx.fillText(data.url.replace(/^https?:\/\//, ""), 700, 579);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  return blob ? new File([blob], `marutibit-${data.gameTitle.toLowerCase()}-score.png`, { type: "image/png" }) : null;
}
