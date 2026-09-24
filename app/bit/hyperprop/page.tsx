import type { Metadata } from "next";
import { HyperPropRetro } from "./HyperPropRetro";
import "../hyperProp.css";
import "../retro/retro.css";

const title = "MarutiBit — HYPER PROP（人力飛行ゲーム）";
const description = "高台から機体を抱えて走り、飛び乗って、漕いで湖を越える。ペダルを連打する人力飛行ゲーム。無料、登録不要。";

// On test while it is played on real phones: kept out of search, the sitemap and
// every shelf and nav (it is not in games.ts yet), so only the address reaches it.
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/bit/hyperprop" },
  robots: { index: false, follow: false },
};

// The first RETRO cartridge. The page is the series' own world rather than MarutiBit's:
// see app/bit/retro/retro.css.
export default function HyperPropPage() {
  return (
    <>
      {/* The RETRO faces - Press Start 2P for Latin, DotGothic16 for Japanese and for the
          handheld's labels and sub display. They load on this route and nowhere else. */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DotGothic16&family=Press+Start+2P&display=swap" />
      <HyperPropRetro />
    </>
  );
}
