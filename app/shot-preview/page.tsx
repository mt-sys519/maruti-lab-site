import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { AngleGame } from "../bit/AngleGame";
import { BlankGame } from "../bit/BlankGame";
import { InputRainGame } from "../bit/InputRainGame";
import { LiltOrbGame } from "../bit/LiltOrbGame";
import { NeonBreakGame } from "../bit/NeonBreakGame";
import { PakuGame } from "../bit/PakuGame";
import { RainChimeGame } from "../bit/RainChimeGame";
import { SequenceGame } from "../bit/SequenceGame";
import { bitGames } from "../bit/games";
import styles from "./shotPreview.module.css";

// One game on its own, filling the window, so headless Chrome can photograph
// it without the header, the series nav and the how-to-play underneath it.
// The shots go beside the machine of the day on /bit. Same approach as
// /og-preview: Chrome captures the viewport, so the thing being captured is
// positioned at the origin and the window is sized to it.
//
//   npm run dev
//   node scripts/capture-game-shots.mjs          (all of them)
//   node scripts/capture-game-shots.mjs paku     (just one)
//
// noindex, and linked from nowhere.
export const metadata: Metadata = {
  title: "Game shot preview",
  robots: { index: false, follow: false },
};

const games = {
  angle: AngleGame,
  blank: BlankGame,
  sequence: SequenceGame,
  "input-rain": InputRainGame,
  paku: PakuGame,
  liltorb: LiltOrbGame,
  avenue: RainChimeGame,
  neonbreak: NeonBreakGame,
} as const;

export default function ShotPreviewPage({ searchParams }: { searchParams?: Record<string, string> }) {
  const id = (searchParams?.game ?? "angle") as keyof typeof games;
  const Game = games[id] ?? AngleGame;
  const color = bitGames.find((game) => game.id === id)?.color ?? "#FF7A5C";

  return (
    <main className={`bitPage ${styles.stage}`} style={{ "--pkg-color": color } as CSSProperties}>
      <Game />
    </main>
  );
}
