import type { CSSProperties } from "react";
import type { BitGameId } from "./games";
import { bitGames as games } from "./games";

type BitSeriesNavProps = { active: BitGameId };

export function BitSeriesNav({ active }: BitSeriesNavProps) {
  return (
    <nav className="bitSeriesNav" aria-label="ゲームを選ぶ">
      {games.map((game) => (
        <a
          key={game.id}
          className={active === game.id ? "isActive" : undefined}
          href={game.href}
          style={{ "--pkg-color": game.color } as CSSProperties}
        >
          <small>{game.number}</small>{game.name}
        </a>
      ))}
    </nav>
  );
}
