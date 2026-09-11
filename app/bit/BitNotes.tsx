import type { ReactNode } from "react";

// A second, quieter block under BitHowToPlay. The three HOW TO PLAY cards say
// what to do; this says what you are looking at once you are doing it - the
// kind of thing a toy with no score still has plenty of, but that nobody would
// ever discover by playing. Deliberately lighter than the cards above it: no
// oversized numerals, thinner rules, smaller shadow.
export type BitNoteEntry = {
  label: string;
  name: string;
  meta?: string;
  body: ReactNode;
};

type BitNotesProps = {
  title: string;
  lead?: ReactNode;
  entries: BitNoteEntry[];
  footnote?: ReactNode;
};

export function BitNotes({ title, lead, entries, footnote }: BitNotesProps) {
  return (
    <section className="bitNotes" aria-labelledby="bit-notes-title">
      <div className="bitNotesHead">
        <h2 id="bit-notes-title">{title}</h2>
        {lead && <p className="bitNotesLead">{lead}</p>}
      </div>
      <div className="bitNotesGrid">
        {entries.map((entry) => (
          <article className="bitNotesCard" key={entry.name}>
            <p className="bitNotesLabel">{entry.label}</p>
            <h3>{entry.name}</h3>
            {entry.meta && <p className="bitNotesMeta">{entry.meta}</p>}
            <p className="bitNotesBody">{entry.body}</p>
          </article>
        ))}
      </div>
      {footnote && <p className="bitNotesFootnote">{footnote}</p>}
    </section>
  );
}
