type GamePauseOverlayProps = {
  active: boolean;
  onResume: () => void;
};

export function GamePauseOverlay({ active, onResume }: GamePauseOverlayProps) {
  if (!active) return null;

  return (
    <div className="bitPauseOverlay" role="dialog" aria-modal="true" aria-labelledby="bit-pause-title">
      <div className="bitPausePanel">
        <p>GAME SUSPENDED</p>
        <h2 id="bit-pause-title">PAUSED</h2>
        <span>BGMとタイマーを停止しています。</span>
        <button type="button" onClick={onResume}>続ける</button>
      </div>
    </div>
  );
}
