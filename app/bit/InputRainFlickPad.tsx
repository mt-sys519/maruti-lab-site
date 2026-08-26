"use client";

import { useCallback, useRef, useState } from "react";
import { FLICK_KEYS, type FlickDir, type FlickKeyDef } from "./inputRainFlickMap";

type ActiveState = { keyId: string; dir: FlickDir; startX: number; startY: number; chars: Partial<Record<FlickDir, string>> };

const FLICK_THRESHOLD = 22;
const DIRECTIONS: FlickDir[] = ["up", "left", "tap", "right", "down"];

function resolveDir(dx: number, dy: number): FlickDir {
  if (Math.hypot(dx, dy) < FLICK_THRESHOLD) return "tap";
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (deg > -45 && deg <= 45) return "right";
  if (deg > 45 && deg <= 135) return "down";
  if (deg > 135 || deg <= -135) return "left";
  return "up";
}

type InputRainFlickPadProps = {
  onCommit: (char: string) => void;
  onDelete: () => void;
  onMutate: () => void;
  disabled?: boolean;
};

export function InputRainFlickPad({ onCommit, onDelete, onMutate, disabled }: InputRainFlickPadProps) {
  const [active, setActive] = useState<ActiveState | null>(null);
  const activeRef = useRef<ActiveState | null>(null);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>, key: FlickKeyDef) => {
    if (disabled || key.kind !== "char") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const state: ActiveState = { keyId: key.id, dir: "tap", startX: event.clientX, startY: event.clientY, chars: key.chars };
    activeRef.current = state;
    setActive(state);
  }, [disabled]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const state = activeRef.current;
    if (!state) return;
    const rawDir = resolveDir(event.clientX - state.startX, event.clientY - state.startY);
    const dir = state.chars[rawDir] ? rawDir : "tap";
    if (dir !== state.dir) {
      const next = { ...state, dir };
      activeRef.current = next;
      setActive(next);
    }
  }, []);

  const finishPointer = useCallback((commit: boolean) => {
    const state = activeRef.current;
    activeRef.current = null;
    setActive(null);
    if (!commit || !state) return;
    const char = state.chars[state.dir];
    if (char) onCommit(char);
  }, [onCommit]);

  const handlePointerUp = useCallback(() => finishPointer(true), [finishPointer]);
  const handlePointerCancel = useCallback(() => finishPointer(false), [finishPointer]);

  return (
    <div className="inputRainFlickPad" aria-label="かなフリックパッド">
      <div className="inputRainFlickGrid">
        {FLICK_KEYS.map((key) => (
          <button
            key={key.id}
            type="button"
            className={`inputRainFlickKey${key.kind === "mutate" ? " isMutate" : ""}`}
            disabled={disabled}
            onClick={key.kind === "mutate" ? onMutate : undefined}
            onPointerDown={key.kind === "char" ? (event) => handlePointerDown(event, key) : undefined}
            onPointerMove={key.kind === "char" ? handlePointerMove : undefined}
            onPointerUp={key.kind === "char" ? handlePointerUp : undefined}
            onPointerCancel={key.kind === "char" ? handlePointerCancel : undefined}
          >
            <span className="inputRainFlickKeyMain">{key.kind === "char" ? key.chars.tap : key.label}</span>
            {key.kind === "char" && (
              <span className="inputRainFlickHint">
                {(["up", "right", "down", "left"] as const).map((dir) => key.chars[dir] ? <i key={dir} className={`is-${dir}`}>{key.chars[dir]}</i> : null)}
              </span>
            )}
            {key.kind === "char" && active?.keyId === key.id && (
              <div className="inputRainFlickPopup">
                {DIRECTIONS.map((dir) => (
                  key.chars[dir] ? (
                    <span key={dir} className={`inputRainFlickCandidate is-${dir}${active.dir === dir ? " isActive" : ""}`}>
                      {key.chars[dir]}
                    </span>
                  ) : <span key={dir} className={`inputRainFlickCandidate is-${dir} isEmpty`} />
                ))}
              </div>
            )}
          </button>
        ))}
      </div>
      <button type="button" className="inputRainFlickDelete" disabled={disabled} onClick={onDelete} aria-label="1文字削除">⌫</button>
    </div>
  );
}
