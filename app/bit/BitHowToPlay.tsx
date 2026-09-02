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
