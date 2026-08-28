"use client";

import { useCallback, useRef, useState } from "react";
import { FLICK_KEYS, type FlickDir, type FlickKeyDef } from "./inputRainFlickMap";

type ActiveState = { keyId: string; dir: FlickDir; startX: number; startY: number; chars: Partial<Record<FlickDir, string>> };

const FLICK_THRESHOLD = 22;
const DIRECTIONS: FlickDir[] = ["up", "left", "tap", "right", "down"];
// あ/い/う/え/お reading order - what a repeated plain tap (no flick) on the same
// key cycles through, mirroring old multi-tap phone input as a fallback for
// players who mash a key instead of flicking it.
const TAP_CYCLE_ORDER: FlickDir[] = ["tap", "left", "up", "right", "down"];

function resolveDir(dx: number, dy: number): FlickDir {
  if (Math.hypot(dx, dy) < FLICK_THRESHOLD) return "tap";
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (deg > -45 && deg <= 45) return "right";
  if (deg > 45 && deg <= 135) return "down";
  if (deg > 135 || deg <= -135) return "left";
  return "up";
}

type InputRainFlickPadProps = {
  onCommit: (char: string, replaceLast?: boolean) => void;
  onMutate: () => void;
  disabled?: boolean;
};

export function InputRainFlickPad({ onCommit, onMutate, disabled }: InputRainFlickPadProps) {
  const [active, setActive] = useState<ActiveState | null>(null);
  const activeRef = useRef<ActiveState | null>(null);
  // Tracks a still-open tap-cycle: which key it's on, and how far around its
  // あ/い/う/え/お order the last plain tap landed. Any flick, any other key, or
  // the mutate key ends it - only a repeated plain tap on the same key advances it.
  const lastTapRef = useRef<{ keyId: string; cycleIndex: number } | null>(null);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>, key: FlickKeyDef) => {
    if (disabled || key.kind !== "char") return;
    event.preventDefault();
    // Can throw (NotFoundError) if the pointer was already released by the time this
    // runs - e.g. a fast tap racing a pointercancel. Losing capture just means a finger
    // sliding off the button won't keep reporting to it, which is a harmless edge case;
    // an uncaught throw here would otherwise abort the whole gesture.
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Ignore. */ }
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

  // Resolve the final direction from the net displacement at release, not the last
  // pointermove sample: a fast, light tap can pick up a stray pointermove reading past
  // the threshold from touch-sensor jitter, which previously left the key "stuck" on a
  // flick direction that never actually happened, dropping the tap entirely.
  const finishPointer = useCallback((commit: boolean, event?: { clientX: number; clientY: number }) => {
    const state = activeRef.current;
    activeRef.current = null;
    setActive(null);
    if (!commit || !state) return;
    const rawDir = event ? resolveDir(event.clientX - state.startX, event.clientY - state.startY) : state.dir;
    const dir = state.chars[rawDir] ? rawDir : "tap";
    const char = state.chars[dir];
    if (!char) return;

    if (dir !== "tap") {
      // A flick is its own precise, one-shot gesture - it always inserts a new
      // character and never continues (or starts) a same-key tap cycle.
      lastTapRef.current = null;
      onCommit(char);
      return;
    }

    const cycle = TAP_CYCLE_ORDER.filter((candidate) => state.chars[candidate]);
    const last = lastTapRef.current;
    if (last && last.keyId === state.keyId && cycle.length > 1) {
      const cycleIndex = (last.cycleIndex + 1) % cycle.length;
      const nextChar = state.chars[cycle[cycleIndex]];
      lastTapRef.current = { keyId: state.keyId, cycleIndex };
      if (nextChar) onCommit(nextChar, true);
      return;
    }
    lastTapRef.current = { keyId: state.keyId, cycleIndex: 0 };
    onCommit(char);
  }, [onCommit]);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLButtonElement>) => finishPointer(true, event), [finishPointer]);
  const handlePointerCancel = useCallback(() => finishPointer(false), [finishPointer]);

  // The mutate key used a plain onClick, but a browser's native click-after-touch
  // synthesis silently drops the click if the finger drifts even a couple pixels during
  // contact (a far stricter tolerance than the char keys' own 22px threshold) - exactly
  // the kind of jitter fast typing produces. Driving it through the same pointer events
  // as the char keys removes that native heuristic from the equation.
  const handleMutatePointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    event.preventDefault();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Ignore. */ }
  }, [disabled]);

  const handleMutatePointerUp = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    event.preventDefault();
    // Mutating turns the last character into a variant outside the plain tap
    // cycle, so a same-key tap right after should start a fresh cycle, not
    // resume one keyed to the character mutate just replaced.
    lastTapRef.current = null;
    onMutate();
  }, [disabled, onMutate]);

  return (
    <div className="inputRainFlickPad" aria-label="かなフリックパッド">
      <div className="inputRainFlickGrid">
        {FLICK_KEYS.map((key) => (
          <button
            key={key.id}
            type="button"
            className={`inputRainFlickKey${key.kind === "mutate" ? " isMutate" : ""}`}
            disabled={disabled}
            onPointerDown={key.kind === "char" ? (event) => handlePointerDown(event, key) : handleMutatePointerDown}
            onPointerMove={key.kind === "char" ? handlePointerMove : undefined}
            onPointerUp={key.kind === "char" ? handlePointerUp : handleMutatePointerUp}
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
    </div>
  );
}
