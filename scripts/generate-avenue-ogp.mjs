import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../public/games/rain-chime/room-lap.webp", import.meta.url));
const outputDirectory = fileURLToPath(new URL("../public/og/bit/", import.meta.url));

const escapeXml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function overlay(width, height, square = false) {
  const titleSize = square ? 76 : 91;
  const left = square ? 48 : 64;
  const titleY = square ? 470 : 424;
  const subtitle = "1996年、11番街。雨が音楽になるまで。";
  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#041017" stop-opacity="${square ? ".08" : ".16"}"/>
          <stop offset=".48" stop-color="#041017" stop-opacity=".02"/>
          <stop offset="1" stop-color="#02090e" stop-opacity=".94"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#shade)"/>
      <rect x="30" y="30" width="${width - 60}" height="${height - 60}" rx="4" fill="none" stroke="#b3c7c9" stroke-opacity=".48"/>
      <text x="${left}" y="74" fill="#d7e5e5" font-family="Arial, sans-serif" font-size="16" font-weight="700" letter-spacing="5">MARUTI BIT / GAME 007</text>
      <circle cx="${width - left}" cy="69" r="5" fill="#d3694e"/>
      <text x="${left}" y="${titleY}" fill="#f0f3ed" font-family="Georgia, serif" font-size="${titleSize}" font-weight="500" letter-spacing="5">AVENUE</text>
      <text x="${left}" y="${titleY + 50}" fill="#bed0d1" font-family="Yu Gothic, Meiryo, sans-serif" font-size="${square ? 19 : 23}" font-weight="500" letter-spacing="2">${escapeXml(subtitle)}</text>
      <text x="${left}" y="${height - 54}" fill="#d7e5e5" font-family="Arial, sans-serif" font-size="15" font-weight="700" letter-spacing="4">MARUTILAB.COM/BIT/AVENUE</text>
    </svg>
  `);
}

async function render(fileName, width, height, position) {
  const room = await sharp(source)
    .resize(width, height, { fit: "cover", position, kernel: sharp.kernel.nearest })
    .png()
    .toBuffer();
  await sharp(room)
    .composite([{ input: overlay(width, height, width === height) }])
    .png({ compressionLevel: 9, palette: true })
    .toFile(`${outputDirectory}/${fileName}`);
}

await mkdir(outputDirectory, { recursive: true });
await render("avenue.png", 1200, 630, "centre");
await render("avenue-square.png", 630, 630, "centre");
console.log("Generated AVENUE OGP images.");
