type BitHowToPlayProps = {
  about: string;
  play: string;
  rules: string;
};

export function BitHowToPlay({ about, play, rules }: BitHowToPlayProps) {
  return (
    <section className="bitHowToPlay" aria-labelledby="bit-howtoplay-title">
      <h2 id="bit-howtoplay-title" className="srOnly">遊び方</h2>
      <div>
        <div className="bitHowToPlayHead">
          <h3>ABOUT</h3>
          <span className="bitHowToPlayIcon" aria-hidden="true">ℹ️</span>
        </div>
        <p>{about}</p>
      </div>
      <div>
        <div className="bitHowToPlayHead">
          <h3>PLAY</h3>
          <span className="bitHowToPlayIcon" aria-hidden="true">▶️</span>
        </div>
        <p>{play}</p>
      </div>
      <div>
        <div className="bitHowToPlayHead">
          <h3>RULES</h3>
          <span className="bitHowToPlayIcon" aria-hidden="true">📋</span>
        </div>
        <p>{rules}</p>
      </div>
    </section>
  );
}
