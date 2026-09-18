import Image from "next/image";
import { TerraMark, TerraName } from "../TerraLogo";

/**
 * The share card, as a page, so a real browser can take its picture.
 *
 * It is drawn rather than composed: the same illustration the opening uses,
 * with the name written into the pale disc the illustration leaves empty - on
 * the real opening a globe turns in that circle, and a card cannot turn, so
 * the drawn globe of the logo stands in it instead. An SVG rasteriser would
 * have neither the page's fonts nor its colours, which is why every card on
 * this site is captured from Chrome.
 *
 * Not linked from anywhere, and noindex - it exists to be photographed.
 *
 *   npm run dev
 *   node scripts/hallo-terra-cards.mjs
 */
export const metadata = { robots: { index: false, follow: false } };

export default function CardPreview() {
  return (
    <div className="terraCard-shot terraCard-wide">
      <div className="terraCardArt">
        <Image src="/hallo-terra/intro.webp" alt="" fill priority sizes="1200px" style={{ objectFit: "cover" }} />
      </div>
      <div className="terraCardWords">
        <TerraMark size="lg" />
        <TerraName size="lg" />
        <p>世界の挨拶を、地図から。</p>
      </div>
    </div>
  );
}
