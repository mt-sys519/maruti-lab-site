import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const outputDirectory = fileURLToPath(new URL("../public/og/", import.meta.url));

const svg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#332b20"/>
      <stop offset="0.56" stop-color="#1d1813"/>
      <stop offset="1" stop-color="#100d0a"/>
    </linearGradient>
    <pattern id="ticks" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M32 0H0V32" fill="none" stroke="#c4a06e" stroke-opacity=".045"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#background)"/>
  <rect width="1200" height="630" fill="url(#ticks)"/>
  <rect x="38" y="38" width="1124" height="554" rx="6" fill="none" stroke="#6d5c43"/>
  <path d="M38 110H1162M38 518H1162" stroke="#4a3f2e"/>
  <text x="74" y="82" fill="#c9a45c" font-family="Courier New, monospace" font-size="16" font-weight="700" letter-spacing="4">MARUTI LAB / BROWSER TOOL</text>

  <g transform="translate(75 160)">
    <g transform="translate(92 74) scale(88)">
      <rect x="-.78" y="-.48" width="1.55" height=".96" rx=".04" fill="#c4a06e"/>
      <rect x="-.65" y=".23" width="1.30" height=".15" fill="#16110e"/>
      <rect x="-.65" y="-.35" width="1.30" height=".50" fill="#0e0a08"/>
      <circle cx="-.26" cy="-.10" r=".15" fill="#e6d3b7"/><circle cx="-.26" cy="-.10" r=".05" fill="#0e0a08"/>
      <circle cx=".26" cy="-.10" r=".15" fill="#e6d3b7"/><circle cx=".26" cy="-.10" r=".09" fill="#0e0a08"/>
      <rect x="-.09" y="-.32" width=".19" height=".03" fill="#e6d3b7"/>
    </g>
    <text x="205" y="55" fill="#ecdfc3" font-family="Courier New, monospace" font-size="74" font-weight="900" letter-spacing="2">4TRACK</text>
    <text x="211" y="91" fill="#c9a45c" font-family="Courier New, monospace" font-size="23" font-weight="700" letter-spacing="6">CASSETTE SAMPLER</text>
  </g>

  <g transform="translate(75 336)">
    <rect width="1050" height="135" rx="4" fill="#171310" stroke="#4a3f2e"/>
    <path d="M0 34H1050M0 68H1050M0 102H1050" stroke="#4a3f2e"/>
    <path d="M0 0V135M150 0V135M300 0V135M450 0V135M600 0V135M750 0V135M900 0V135" stroke="#30291f"/>
    <g fill="none" stroke="#ff6b35" stroke-width="2">
      <path d="M165 16L181 12L197 23L213 8L229 25L245 16L261 18L277 11"/>
      <path d="M315 50L331 57L347 43L363 61L379 42L395 53L411 47L427 55"/>
    </g>
    <g fill="none" stroke="#7fae6f" stroke-width="2">
      <path d="M465 87L481 75L497 96L513 80L529 92L545 78L561 90L577 84"/>
      <path d="M615 118L631 111L647 124L663 106L679 122L695 110L711 116L727 109"/>
    </g>
    <rect x="145" y="5" width="142" height="25" rx="3" fill="#ff6b35" fill-opacity=".13" stroke="#ff6b35"/>
    <rect x="305" y="39" width="132" height="25" rx="3" fill="#c9a45c" fill-opacity=".1" stroke="#c9a45c"/>
    <rect x="455" y="73" width="132" height="25" rx="3" fill="#7fae6f" fill-opacity=".1" stroke="#7fae6f"/>
    <rect x="605" y="107" width="132" height="23" rx="3" fill="#7fae6f" fill-opacity=".1" stroke="#7fae6f"/>
  </g>

  <text x="75" y="559" fill="#b0a284" font-family="Yu Gothic, Meiryo, sans-serif" font-size="20" letter-spacing="2">音を切る、並べる、録る。ブラウザだけで使える4トラック・サンプラー。</text>
  <text x="1125" y="559" text-anchor="end" fill="#c9a45c" font-family="Courier New, monospace" font-size="15" font-weight="700" letter-spacing="3">MARUTILAB.COM/4TRACK</text>
</svg>`);

await mkdir(outputDirectory, { recursive: true });
await sharp(svg).png({ compressionLevel: 9 }).toFile(`${outputDirectory}/4track.png`);
console.log("Generated 4TRACK OGP image.");
