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

// Every icon below reuses the exact path/text data from the real hub-card
// icon (GameVisual in app/bit/BitHub.tsx / its CSS), just rendered at a
// chosen scale via an SVG transform, rather than an unrelated illustration
// invented separately per OGP image the way these used to be.
function angleIcon(scale) {
  return `<g transform="scale(${scale}) translate(-52 -40)">
    <path d="M12 66 L92 66 L60 14 Z" fill="none" stroke="${palette.ink}" stroke-width="${(1.8 / scale).toFixed(2)}"/>
    <path d="M34 66 A22 22 0 0 0 27 50" fill="none" stroke="${palette.accent}" stroke-width="${(2 / scale).toFixed(2)}"/>
    <text x="43" y="58" text-anchor="middle" fill="${palette.accent}" font-family="'Yu Gothic UI', sans-serif" font-weight="700" font-size="15">?</text>
  </g>`;
}
function blankIcon(scale) {
  return `<g transform="scale(${scale})" font-family="Georgia, serif">
    <text x="-46" y="6" text-anchor="middle" dominant-baseline="middle" fill="${palette.ink}" font-size="18">8</text>
    <text x="-28" y="6" text-anchor="middle" dominant-baseline="middle" fill="${palette.line}" font-size="16">＋</text>
    <rect x="-14" y="-11" width="22" height="22" rx="3" fill="none" stroke="${palette.accent}" stroke-width="1.6" stroke-dasharray="3 2.4"/>
    <text x="-3" y="6" text-anchor="middle" dominant-baseline="middle" fill="${palette.accent}" font-family="'Yu Gothic UI', sans-serif" font-size="13" font-weight="700">?</text>
    <text x="20" y="6" text-anchor="middle" dominant-baseline="middle" fill="${palette.line}" font-size="16">＝</text>
    <text x="42" y="6" text-anchor="middle" dominant-baseline="middle" fill="${palette.ink}" font-size="18">13</text>
  </g>`;
}
function sequenceIcon(scale) {
  return `<g transform="scale(${scale})" font-family="Georgia, serif" font-size="18">
    <text x="-48" y="6" text-anchor="middle" fill="${palette.ink}">2</text>
    <text x="-22" y="6" text-anchor="middle" fill="${palette.ink}">4</text>
    <text x="4" y="6" text-anchor="middle" fill="${palette.ink}">8</text>
    <rect x="20" y="-11" width="22" height="22" rx="3" fill="none" stroke="${palette.accent}" stroke-width="1.6" stroke-dasharray="3 2.4"/>
    <text x="31" y="6" text-anchor="middle" fill="${palette.accent}" font-family="'Yu Gothic UI', sans-serif" font-size="13" font-weight="700">?</text>
  </g>`;
}
function rainIcon(scale) {
  return `<g transform="scale(${scale}) translate(-60 -38)">
    <rect x="0" y="0" width="120" height="76" fill="#07100b" stroke="#86f15a" stroke-width="${(1 / scale).toFixed(2)}"/>
    <text x="12" y="18" fill="#86f15a" opacity=".55" font-family="Consolas, monospace" font-size="9">PT&gt;</text>
    <text x="60" y="42" text-anchor="middle" fill="#86f15a" font-family="Consolas, monospace" font-size="17" letter-spacing="1">INPUT</text>
    <text x="60" y="63" text-anchor="middle" fill="#86f15a" opacity=".48" font-family="Consolas, monospace" font-size="17" letter-spacing="1">RAIN</text>
  </g>`;
}
function pakuIcon(scale) {
  return `<g transform="scale(${scale}) translate(-12 -12)">
    <path d="M3.5 12 C7 7.5 12 6.7 16.2 9.2 L21 6.6 L19.4 12 L21 17.4 L16.2 14.8 C12 17.3 7 16.5 3.5 12 Z" fill="none" stroke="#24586a" stroke-width="${(1.1 / scale).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="8.1" cy="11" r="1" fill="#24586a"/>
  </g>`;
}

const angleVisual = `<g transform="translate(755 140)" filter="url(#shadow)">
  <rect width="330" height="330" rx="4" fill="#f4f0e7" stroke="${palette.ink}" stroke-opacity=".7"/>
  <g transform="translate(165 165)">${angleIcon(3.6)}</g>
</g>`;

const blankVisual = `<g transform="translate(755 140)" filter="url(#shadow)">
  <rect width="330" height="330" rx="4" fill="#f4f0e7" stroke="${palette.ink}" stroke-opacity=".7"/>
  <g transform="translate(165 165)">${blankIcon(2.6)}</g>
</g>`;

const sequenceVisual = `<g transform="translate(755 140)" filter="url(#shadow)">
  <rect width="330" height="330" rx="4" fill="#f4f0e7" stroke="${palette.ink}" stroke-opacity=".7"/>
  <g transform="translate(165 165)">${sequenceIcon(2.6)}</g>
</g>`;

const rainVisual = `<g transform="translate(755 140)" filter="url(#shadow)">
  <g transform="translate(165 165)">${rainIcon(2.9)}</g>
</g>`;

const pakuVisual = `<g transform="translate(755 140)" filter="url(#shadow)">
  <rect width="330" height="330" rx="4" fill="#d7e8e7" stroke="${palette.ink}" stroke-opacity=".7"/>
  <g transform="translate(165 165)">${pakuIcon(11)}</g>
</g>`;

// Mirrors the actual /bit hub card icon exactly (see GameVisual's "liltorb"
// case in app/bit/BitHub.tsx: a ring + 4 particle dots), just scaled up,
// rather than an unrelated illustration invented separately for the OGP.
function liltOrbIcon(scale) {
  return `<g transform="scale(${scale}) translate(-50 -50)">
    <circle cx="50" cy="50" r="34" fill="none" stroke="#4a6a72" stroke-width="${(1.4 / scale).toFixed(2)}"/>
    <circle cx="38" cy="42" r="2.6" fill="#8ef2ff"/>
    <circle cx="59" cy="35" r="1.9" fill="#8ef2ff"/>
    <circle cx="61" cy="59" r="2.3" fill="#8ef2ff"/>
    <circle cx="42" cy="62" r="1.7" fill="#8ef2ff"/>
  </g>`;
}

const liltOrbVisual = `<g transform="translate(755 140)" filter="url(#shadow)">
  <rect width="330" height="330" rx="4" fill="${palette.dark}" stroke="#3a5058"/>
  <g transform="translate(165 165)">${liltOrbIcon(3.4)}</g>
  <text x="24" y="312" fill="#7fa3ad" font-family="Arial, sans-serif" font-size="13" font-weight="700" letter-spacing="3">TOUCH TO GATHER</text>
</g>`;

// Square variant: some unfurlers (Slack/Discord/LINE) prefer or fall back to
// a 1:1 og:image rather than the 1200x630 default. `theme` matches whatever
// the real hub card actually uses (light cream for most, dark terminal for
// INPUT RAIN/LILT ORB) so the icon's own colors stay legible.
function squareShell({ serial, title, subtitle, visual, theme = "dark" }) {
  const light = theme === "light";
  const bg = light ? palette.paper : palette.dark;
  const frame = light ? palette.ink : "#3a5058";
  const label = light ? palette.muted : "#9db4bb";
  const titleColor = light ? palette.ink : "#eef6f7";
  const subtitleColor = light ? palette.muted : "#8ea6ac";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="630" height="630" viewBox="0 0 630 630">
    ${grid()}
    <rect width="630" height="630" fill="${bg}"/>
    <rect width="630" height="630" fill="url(#grid)"/>
    <rect x="24" y="24" width="582" height="582" rx="5" fill="none" stroke="${frame}" stroke-opacity="${light ? ".62" : "1"}"/>
    <text x="48" y="60" fill="${label}" font-family="Arial, sans-serif" font-size="13" font-weight="700" letter-spacing="3">MARUTI BIT / ${escapeXml(serial)}</text>
    <circle cx="582" cy="52" r="4" fill="${palette.accent}"/>
    ${visual}
    <text x="48" y="524" fill="${titleColor}" font-family="Georgia, 'Times New Roman', serif" font-size="46" letter-spacing="2">${escapeXml(title)}</text>
    <text x="50" y="560" fill="${subtitleColor}" font-family="'Yu Gothic UI', 'Noto Sans JP', sans-serif" font-size="16" letter-spacing="1">${escapeXml(subtitle)}</text>
  </svg>`;
}

const liltOrbSquareVisual = `<g transform="translate(315 250)" filter="url(#shadow)">${liltOrbIcon(6.2)}</g>`;
const angleSquareVisual = `<g transform="translate(315 240)" filter="url(#shadow)">${angleIcon(6.6)}</g>`;
const blankSquareVisual = `<g transform="translate(315 230)" filter="url(#shadow)">${blankIcon(4.8)}</g>`;
const sequenceSquareVisual = `<g transform="translate(315 230)" filter="url(#shadow)">${sequenceIcon(4.8)}</g>`;
const rainSquareVisual = `<g transform="translate(315 270)" filter="url(#shadow)">${rainIcon(4.2)}</g>`;
const pakuSquareVisual = `<g transform="translate(315 250)" filter="url(#shadow)">${pakuIcon(20)}</g>`;

const images = [
  ["index.png", shell({ serial: "SERIES INDEX", title: "Maruti Bit", subtitle: "短い時間で、考える。見抜く。打ち込む。", visual: hubVisual })],
  ["angle.png", shell({ serial: "GAME 001", title: "ANGLE", subtitle: "三角形の角度を求める、全5問。", visual: angleVisual })],
  ["angle-square.png", squareShell({ serial: "GAME 001", title: "ANGLE", subtitle: "三角形の角度を求める、全5問。", visual: angleSquareVisual, theme: "light" })],
  ["blank.png", shell({ serial: "GAME 002", title: "BLANK", subtitle: "式の空欄を見抜く、全5問。", visual: blankVisual })],
  ["blank-square.png", squareShell({ serial: "GAME 002", title: "BLANK", subtitle: "式の空欄を見抜く、全5問。", visual: blankSquareVisual, theme: "light" })],
  ["sequence.png", shell({ serial: "GAME 003", title: "SEQUENCE", subtitle: "数の並びに隠れた規則を見抜く、全5問。", visual: sequenceVisual })],
  ["sequence-square.png", squareShell({ serial: "GAME 003", title: "SEQUENCE", subtitle: "数の並びに隠れた規則を見抜く、全5問。", visual: sequenceSquareVisual, theme: "light" })],
  ["input-rain.png", shell({ serial: "GAME 004", title: "INPUT RAIN", subtitle: "降る文字列を打ち返すタイピングゲーム。", visual: rainVisual })],
  ["input-rain-square.png", squareShell({ serial: "GAME 004", title: "INPUT RAIN", subtitle: "降る文字列を打ち返すタイピングゲーム。", visual: rainSquareVisual, theme: "dark" })],
  ["paku.png", shell({ serial: "GAME 005", title: "PAKU", subtitle: "水槽の熱帯魚に、タップで餌をあげる。", visual: pakuVisual })],
  ["paku-square.png", squareShell({ serial: "GAME 005", title: "PAKU", subtitle: "水槽の熱帯魚に、タップで餌をあげる。", visual: pakuSquareVisual, theme: "light" })],
  ["liltorb.png", shell({ serial: "GAME 006", title: "LILT ORB", subtitle: "触れると粒子が集まる、癒しと刺激の球体トイ。", visual: liltOrbVisual })],
  ["liltorb-square.png", squareShell({ serial: "GAME 006", title: "LILT ORB", subtitle: "触れると粒子が集まる、癒しと刺激の球体トイ。", visual: liltOrbSquareVisual, theme: "dark" })],
];

for (const [filename, svg] of images) {
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(path.join(outputDir, filename));
}

console.log(`Generated ${images.length} Maruti Bit OGP images in ${outputDir}`);
