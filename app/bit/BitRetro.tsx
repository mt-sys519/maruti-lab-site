import { newestRelease, retroGames } from "./games";
import { RetroCart } from "./retro/RetroCart";

// The RETRO series on the MarutiBit page: its own world (the dark bar, cream stock with a
// halftone, the handheld's type), set in right under the hero. The newest cartridge is
// the one shown; the rest of the series waits on the shelf beside it as blank cartridges.
// The same block closes a LabNote about a cartridge (given its id) and sits under the
// home page's hero, so the series is visible from the front door too.
// Styles are in retro/retro.css, under .rtBit.
export function BitRetro({ id }: { id?: string } = {}) {
  const game = retroGames.find((cart) => cart.id === id) ?? retroGames[0];
  return (
    <section className="rtPage rtBit" id="bit-retro" lang="ja" aria-labelledby="bit-retro-title">
      <div className="rtBitBar">
        <p className="rtBitBrand">
          MARUTI BIT <b>RETRO</b>
        </p>
        <p className="rtBitNote">上下とボタン2つで遊ぶ、携帯機のシリーズ</p>
      </div>
      <div className="rtBitBody">
        <a className="rtBitCart" href={game.href} aria-label={`${game.name}で遊ぶ`}>
          <RetroCart label={game.label} alt={`${game.name} のカートリッジ`} />
        </a>
        <div className="rtBitInfo">
          <p className="rtBitSerial">
            {game.serial}
            {game.id === newestRelease && <span>NEW</span>}
          </p>
          <h2 id="bit-retro-title">{game.name}</h2>
          <p className="rtBitKind">{game.kind}</p>
          <p className="rtBitText">{game.description}</p>
          <a className="rtBitPlay" href={game.href}>
            PLAY ▶
          </a>
        </div>
        <div className="rtBitShelf" aria-hidden="true">
          <RetroCart soon="COMING SOON" />
          <RetroCart soon="COMING SOON" />
        </div>
      </div>
    </section>
  );
}
