/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires a document navigation for local routes */
import { bitGames, retroGames } from "../bit/games";
import { BitRetro } from "../bit/BitRetro";
import { GameUnit } from "../bit/GameUnit";
import { postsAbout } from "./posts";

// The two ends of one link between a note and the work it is about, set by a
// single `work:` line in the note's front matter.

/** The close of a note: the work itself, to go and play. A RETRO cartridge
 *  gets the series block it has on /bit; a mini game gets its machine. A work
 *  that is neither draws nothing - the note's own text links to it. */
export function NoteWork({ href }: { href?: string }) {
  if (!href) return null;
  const cart = retroGames.find((game) => game.href === href);
  if (cart) return <BitRetro id={cart.id} />;
  const game = bitGames.find((one) => one.href === href);
  if (!game) return null;
  return (
    <section className="noteWork" aria-labelledby="note-work-title">
      <GameUnit game={game} card className="noteWorkUnit" aria-hidden="true" tabIndex={-1} />
      <div className="noteWorkCopy">
        <p className="eyebrow">THIS NOTE&apos;S WORK</p>
        <h2 id="note-work-title">{game.name}</h2>
        <p>{game.description}</p>
        <a className="refinedLink" href={game.href}>
          <span>{game.name}で遊ぶ</span>
        </a>
      </div>
    </section>
  );
}

/** The foot of a work's page: the notes written about it. Nothing is drawn
 *  until one exists, so a page can carry it before its note is written. */
export function WorkNotes({ href, className }: { href: string; className?: string }) {
  const notes = postsAbout(href);
  if (notes.length === 0) return null;
  return (
    <nav className={["workNotes", className ?? ""].filter(Boolean).join(" ")} aria-label="この作品について書いた記事">
      <p className="workNotesHead">LABNOTE / この作品の話</p>
      <ul>
        {notes.map((note) => (
          <li key={note.slug}>
            <a href={`/blog/${note.slug}`}>{note.title}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
