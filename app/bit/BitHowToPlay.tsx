import type { ReactNode } from "react";

type BitHowToPlayProps = {
  about: string;
  play: string;
  rules: string;
  icon?: ReactNode;
};

export function BitHowToPlay({ about, play, rules, icon }: BitHowToPlayProps) {
  return (
    <section className="bitHowToPlay" aria-labelledby="bit-howtoplay-title">
      <h2 id="bit-howtoplay-title" className="srOnly">遊び方</h2>
      {icon && <span className="bitHowToPlayIcon" aria-hidden="true">{icon}</span>}
      <div>
        <h3>ABOUT</h3>
        <p>{about}</p>
      </div>
      <div>
        <h3>PLAY</h3>
        <p>{play}</p>
      </div>
      <div>
        <h3>RULES</h3>
        <p>{rules}</p>
      </div>
    </section>
  );
}
