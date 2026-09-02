import type { ReactNode } from "react";

type BitHowToPlayProps = {
  aboutLead: ReactNode;
  aboutSub?: ReactNode;
  playLead: ReactNode;
  playSub?: ReactNode;
  rulesLead: ReactNode;
  rulesSub?: ReactNode;
  chips?: string[];
};

export function BitHowToPlay({ aboutLead, aboutSub, playLead, playSub, rulesLead, rulesSub, chips }: BitHowToPlayProps) {
  return (
    <section className="bitHowToPlay" aria-labelledby="bit-howtoplay-title">
      <h2 id="bit-howtoplay-title" className="srOnly">遊び方</h2>
      <div className="bitHowToPlayGrid">
        <article className="bitHowToPlayCard">
          <span className="bitHowToPlayNum" aria-hidden="true">01</span>
          <div className="bitHowToPlayHead">
            <h3>ABOUT</h3>
            <span className="bitHowToPlayIcon" aria-hidden="true">ℹ️</span>
          </div>
          <p className="bitHowToPlayLead">{aboutLead}</p>
          {aboutSub && <p className="bitHowToPlaySub">{aboutSub}</p>}
        </article>
        <article className="bitHowToPlayCard">
          <span className="bitHowToPlayNum" aria-hidden="true">02</span>
          <div className="bitHowToPlayHead">
            <h3>PLAY</h3>
            <span className="bitHowToPlayIcon" aria-hidden="true">▶️</span>
          </div>
          <p className="bitHowToPlayLead">{playLead}</p>
          {playSub && <p className="bitHowToPlaySub">{playSub}</p>}
        </article>
        <article className="bitHowToPlayCard">
          <span className="bitHowToPlayNum" aria-hidden="true">03</span>
          <div className="bitHowToPlayHead">
            <h3>RULES</h3>
            <span className="bitHowToPlayIcon" aria-hidden="true">📋</span>
          </div>
          <p className="bitHowToPlayLead">{rulesLead}</p>
          {rulesSub && <p className="bitHowToPlaySub">{rulesSub}</p>}
        </article>
      </div>
      {chips && chips.length > 0 && (
        <div className="bitHowToPlayChips">
          {chips.map((chip) => <span key={chip}>{chip}</span>)}
        </div>
      )}
    </section>
  );
}
