import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const outputDir = path.resolve("public/og/bit");
await fs.mkdir(outputDir, { recursive: true });

const palette = {
  paper: "#e9e4d7",
  ink: "#172d38",
  muted: "#617078",
  line: "#98a6a4",
  accent: "#d05c42",
  dark: "#0d1c22",
};

const escapeXml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function grid() {
  return `<defs>
    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M32 0H0V32" fill="none" stroke="${palette.ink}" stroke-opacity=".075" stroke-width="1"/>
    </pattern>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="18" flood-color="#172d38" flood-opacity=".14"/>
    </filter>
  </defs>`;
}

function shell({ serial, title, subtitle, visual }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    ${grid()}
    <rect width="1200" height="630" fill="${palette.paper}"/>
    <rect width="1200" height="630" fill="url(#grid)"/>
    <rect x="38" y="38" width="1124" height="554" rx="5" fill="none" stroke="${palette.ink}" stroke-opacity=".62"/>
    <path d="M38 104H1162M38 530H1162" stroke="${palette.ink}" stroke-opacity=".32"/>
    <text x="76" y="80" fill="${palette.ink}" font-family="Arial, sans-serif" font-size="16" font-weight="700" letter-spacing="4">MARUTI BIT / ${escapeXml(serial)}</text>
    <circle cx="1124" cy="72" r="5" fill="${palette.accent}"/>
    <text x="76" y="225" fill="${palette.ink}" font-family="Georgia, 'Times New Roman', serif" font-size="76" letter-spacing="3">${escapeXml(title)}</text>
    <text x="80" y="277" fill="${palette.muted}" font-family="'Yu Gothic UI', 'Noto Sans JP', sans-serif" font-size="23" letter-spacing="2">${escapeXml(subtitle)}</text>
    ${visual}
    <text x="76" y="566" fill="${palette.ink}" font-family="Arial, sans-serif" font-size="15" font-weight="700" letter-spacing="4">MARUTILAB.COM/BIT</text>
    <text x="1124" y="566" text-anchor="end" fill="${palette.muted}" font-family="Arial, sans-serif" font-size="14" letter-spacing="2">THINK / SEE / PLAY</text>
  </svg>`;
}

const cards = [
  ["01", "ANGLE", "△  ?°"],
  ["02", "BLANK", "12 + □ = 20"],
  ["03", "SEQUENCE", "3  6  12  ?"],
  ["04", "INPUT RAIN", "INPUT_"],
];

const hubVisual = `<g transform="translate(660 146)" filter="url(#shadow)">
  ${cards.map(([number, name, mark], index) => {
    const x = (index % 2) * 225;
    const y = Math.floor(index / 2) * 154;
    const dark = index === 3;
    return `<g transform="translate(${x} ${y})">
      <rect width="205" height="134" rx="3" fill="${dark ? palette.dark : "#f4f0e7"}" stroke="${palette.ink}" stroke-opacity=".7"/>
      <text x="16" y="26" fill="${dark ? "#9eb8a8" : palette.muted}" font-family="Arial, sans-serif" font-size="12" letter-spacing="2">${number}</text>
      <text x="16" y="58" fill="${dark ? "#d9f0de" : palette.ink}" font-family="Georgia, serif" font-size="22" letter-spacing="1.5">${name}</text>
      <text x="16" y="103" fill="${dark ? "#73d698" : palette.accent}" font-family="Arial, sans-serif" font-size="19" letter-spacing="1">${mark}</text>
    </g>`;
  }).join("")}
</g>`;

const angleVisual = `<g transform="translate(755 140)" filter="url(#shadow)">
  <rect width="330" height="330" rx="4" fill="#f4f0e7" stroke="${palette.ink}" stroke-opacity=".7"/>
  <path d="M55 270 165 62 282 270Z" fill="none" stroke="${palette.ink}" stroke-width="4"/>
  <path d="M70 270a35 35 0 0 1 18-31" fill="none" stroke="${palette.accent}" stroke-width="4"/>
  <text x="88" y="240" fill="${palette.accent}" font-family="Georgia, serif" font-size="28">?</text>
  <text x="165" y="114" text-anchor="middle" fill="${palette.muted}" font-family="Arial, sans-serif" font-size="21">48°</text>
  <text x="255" y="247" text-anchor="middle" fill="${palette.muted}" font-family="Arial, sans-serif" font-size="21">72°</text>
</g>`;

const blankVisual = `<g transform="translate(690 190)" filter="url(#shadow)">
  <rect width="410" height="215" rx="4" fill="#f4f0e7" stroke="${palette.ink}" stroke-opacity=".7"/>
  <text x="205" y="126" text-anchor="middle" fill="${palette.ink}" font-family="Georgia, serif" font-size="55" letter-spacing="5">12 +</text>
  <rect x="247" y="75" width="62" height="62" fill="none" stroke="${palette.accent}" stroke-width="4"/>
  <text x="322" y="126" fill="${palette.ink}" font-family="Georgia, serif" font-size="55">= 20</text>
</g>`;

const sequenceVisual = `<g transform="translate(660 183)" filter="url(#shadow)">
  <rect width="455" height="230" rx="4" fill="#f4f0e7" stroke="${palette.ink}" stroke-opacity=".7"/>
  <path d="M64 152H388" stroke="${palette.line}" stroke-width="2" stroke-dasharray="5 8"/>
  ${["3", "6", "12", "?"].map((value, i) => `<g transform="translate(${82 + i * 98} 118)">
    <circle r="36" fill="${i === 3 ? palette.accent : palette.paper}" stroke="${palette.ink}" stroke-width="2"/>
    <text y="11" text-anchor="middle" fill="${i === 3 ? "#fff" : palette.ink}" font-family="Georgia, serif" font-size="31">${value}</text>
  </g>`).join("")}
</g>`;

const rainVisual = `<g transform="translate(650 154)" filter="url(#shadow)">
  <rect width="475" height="300" rx="4" fill="${palette.dark}" stroke="#547267"/>
  <path d="M0 48H475" stroke="#547267" stroke-opacity=".55"/>
  <circle cx="22" cy="24" r="4" fill="#78d499"/><circle cx="39" cy="24" r="4" fill="#d6a44f"/><circle cx="56" cy="24" r="4" fill="#bd6657"/>
  <text x="34" y="99" fill="#779188" font-family="Consolas, monospace" font-size="16" letter-spacing="2">PROMPTTERM / INPUT CHANNEL</text>
  <text x="34" y="173" fill="#d9f0de" font-family="Consolas, monospace" font-size="43" letter-spacing="5">SIGNAL_</text>
  <rect x="262" y="137" width="4" height="43" fill="#73d698"/>
  <g fill="#73d698" opacity=".42" font-family="Consolas, monospace" font-size="15">
    <text x="340" y="90">R</text><text x="372" y="118">A</text><text x="404" y="151">I</text><text x="436" y="197">N</text>
    <text x="328" y="218">T</text><text x="360" y="247">Y</text><text x="392" y="272">P</text>
  </g>
</g>`;

const images = [
  ["index.png", shell({ serial: "SERIES INDEX", title: "Maruti Bit", subtitle: "短い時間で、考える。見抜く。打ち込む。", visual: hubVisual })],
  ["angle.png", shell({ serial: "GAME 001", title: "ANGLE", subtitle: "三角形の角度を求める、全5問。", visual: angleVisual })],
  ["blank.png", shell({ serial: "GAME 002", title: "BLANK", subtitle: "式の空欄を見抜く、全5問。", visual: blankVisual })],
  ["sequence.png", shell({ serial: "GAME 003", title: "SEQUENCE", subtitle: "数の並びに隠れた規則を見抜く、全5問。", visual: sequenceVisual })],
  ["input-rain.png", shell({ serial: "GAME 004", title: "INPUT RAIN", subtitle: "降る文字列を打ち返すタイピングゲーム。", visual: rainVisual })],
];

for (const [filename, svg] of images) {
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(path.join(outputDir, filename));
}

console.log(`Generated ${images.length} Maruti Bit OGP images in ${outputDir}`);
