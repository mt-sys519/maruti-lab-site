"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TerraIntro from "./TerraIntro";
import { TerraFrame } from "./TerraLogo";
import { KINDS, KIND_LABEL, REGISTER_LABEL, places, unpack, varieties, type Country, type World } from "./content";

/* The world is drawn once and shown three times, side by side. Miller is a
   cylindrical projection, so the drawing repeats exactly every world-width:
   pan far enough east and the copy on the right takes over, the offset is
   wound back by one width, and nobody can tell. That is the entire trick
   behind being able to circle the world forever, and it is the reason this
   map is not on an oval projection however much better those look. */

type Point = { x: number; y: number };
type View = { x: number; y: number; s: number };

const TAP_SLOP = 9; // px of travel still counted as a tap, not a drag
const FRICTION = 0.92;
const STOP = 0.02;

export default function TerraMap() {
  const [world, setWorld] = useState<World | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>("JPN");
  const [hover, setHover] = useState<Country | null>(null);
  const [pointer, setPointer] = useState<Point>({ x: 0, y: 0 });
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  // Which of the place's ways of speaking the card is showing.
  const [tongue, setTongue] = useState(0);
  // null until the browser has been asked; the server cannot know whether
  // this visitor has already been through the opening.
  const [intro, setIntro] = useState<boolean | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<SVGGElement>(null);
  const view = useRef<View>({ x: 0, y: 0, s: 1 });
  const limits = useRef({ min: 0.1, max: 4 });
  const glide = useRef<{ vx: number; vy: number; raf: number } | null>(null);
  // The finer coastlines, and which countries are currently wearing them.
  const detail = useRef<{ data: Record<string, string> | null; asking: boolean; on: Set<string>; timer: number }>({
    data: null,
    asking: false,
    on: new Set(),
    timer: 0,
  });
  // What is in the middle of the frame, in world coordinates, so that a window
  // resize or a phone turning on its side keeps looking at the same place.
  const middle = useRef({ x: 1000, y: 700 });
  const drift = useRef<{ raf: number } | null>(null);

  useEffect(() => {
    let live = true;
    // The number on the end is not decoration. The file's format changed once
    // already - coordinates became steps - and a browser holding yesterday's
    // copy while running today's code would unfold text that is not packed and
    // draw nonsense. Bump it whenever the shape of the file changes.
    fetch("/hallo-terra/world.json?v=2")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: World) => {
        // Unfolded once, here, rather than in every place that wants a shape.
        for (const country of data.countries) country.d = unpack(country.d);
        if (live) setWorld(data);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    // Every load, reload included. It was once a session, and once a session
    // means you cannot see the thing again without clearing site data.
    let show = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) show = false;
    if (window.location.hash === "#map") show = false;
    // On the next frame rather than now: the map gets to paint first, so the
    // opening covers a drawn map and the dive lands on something real.
    const frame = requestAnimationFrame(() => setIntro(show));
    return () => cancelAnimationFrame(frame);
  }, []);

  const closeIntro = useCallback(() => setIntro(false), []);

  const byIso = useMemo(() => {
    const map = new Map<string, Country>();
    world?.countries.forEach((c) => map.set(c.iso, c));
    return map;
  }, [world]);

  /* ---- the viewport ------------------------------------------------- */

  // `apply` runs before `dress` is declared and must not depend on it.
  const dressRef = useRef<(() => void) | null>(null);

  const apply = useCallback(() => {
    const layer = layerRef.current;
    if (!layer || !world) return;
    const v = view.current;
    const span = world.width * v.s;
    // Keep the offset inside one world-width so the copy at -1 and the copy at
    // +1 are always enough to cover the screen.
    v.x = ((v.x % span) + span) % span - span;
    const stage = stageRef.current;
    if (stage) {
      const height = world.height * v.s;
      const room = stage.clientHeight - height;
      v.y = room > 0 ? room / 2 : Math.min(0, Math.max(room, v.y));
    }
    layer.setAttribute("transform", `translate(${v.x} ${v.y}) scale(${v.s})`);
    // Only once the view stops: swapping coastlines mid-drag would be work
    // done sixty times a second and thrown away fifty-nine of them.
    window.clearTimeout(detail.current.timer);
    detail.current.timer = window.setTimeout(() => dressRef.current?.(), 180);
    if (stage) {
      middle.current = {
        x: (stage.clientWidth / 2 - v.x) / v.s,
        y: (stage.clientHeight / 2 - v.y) / v.s,
      };
    }
  }, [world]);

  /**
   * Lean in far enough and the countries on screen change their coastlines.
   *
   * The base map is 1:50m, which is what a whole world can be pushed around at
   * sixty frames a second. Close up it has no small islands to give, and the
   * whole world at 1:10m costs two and a half times the frame - so the fine
   * data is fetched once, the first time anybody zooms in, and worn only by
   * the countries actually on screen. Everything on screen wears it together,
   * because a detailed border against a coarse one leaves a gap of sea.
   */
  const dress = useCallback(() => {
    const stage = stageRef.current;
    const layer = layerRef.current;
    if (!stage || !layer || !world) return;
    const v = view.current;
    const state = detail.current;
    const wearing = state.on;

    const undress = () => {
      for (const iso of wearing) {
        const base = byIso.get(iso);
        if (base) layer.querySelectorAll(`[data-iso="${iso}"]`).forEach((node) => node.setAttribute("d", base.d));
      }
      wearing.clear();
    };

    if (v.s < limits.current.min * 2.5) {
      undress();
      return;
    }
    if (!state.data) {
      if (state.asking) return;
      state.asking = true;
      fetch("/hallo-terra/world-detail.json?v=2")
        .then((r) => r.json())
        .then((data: Record<string, string>) => {
          state.data = data;
          dressRef.current?.();
        })
        .catch(() => {
          /* the coarse coastline is still a coastline */
        })
        .finally(() => {
          state.asking = false;
        });
      return;
    }

    const span = world.width;
    const left = (0 - v.x) / v.s;
    const right = (stage.clientWidth - v.x) / v.s;
    const top = (0 - v.y) / v.s;
    const bottom = (stage.clientHeight - v.y) / v.s;
    const seen = new Set<string>();
    for (const country of world.countries) {
      const [x0, y0, x1, y1] = country.box;
      if (y1 < top || y0 > bottom) continue;
      // The world repeats, so a country can be on screen in any of three copies.
      const across = [0, -span, span].some((shift) => x1 + shift >= left && x0 + shift <= right);
      if (!across) continue;
      const fine = state.data[country.iso];
      if (!fine) continue;
      seen.add(country.iso);
      if (wearing.has(country.iso)) continue;
      const d = unpack(fine);
      layer.querySelectorAll(`[data-iso="${country.iso}"]`).forEach((node) => node.setAttribute("d", d));
      wearing.add(country.iso);
    }
    for (const iso of [...wearing]) {
      if (seen.has(iso)) continue;
      const base = byIso.get(iso);
      if (base) layer.querySelectorAll(`[data-iso="${iso}"]`).forEach((node) => node.setAttribute("d", base.d));
      wearing.delete(iso);
    }
  }, [byIso, world]);

  useEffect(() => {
    dressRef.current = dress;
  }, [dress]);

  const fit = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || !world) return;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    // Pulled all the way back, the world covers the frame both ways and no
    // further. Height alone is not enough: on a wide screen a world only as
    // tall as the frame is narrower than it, and the copy beside it comes into
    // view - two Japans on one screen. Covering the width instead means the
    // seam can still be panned through, but is never on screen twice at once.
    // Zoomed all the way in, a country the size of Portugal fills the frame.
    const min = Math.max(h / world.height, w / world.width);
    limits.current = { min, max: min * 9 };
    return min;
  }, [world]);

  const zoomTo = useCallback(
    (next: number, at?: Point) => {
      const stage = stageRef.current;
      if (!stage || !world) return;
      const v = view.current;
      const { min, max } = limits.current;
      const s = Math.min(max, Math.max(min, next));
      const cx = at ? at.x : stage.clientWidth / 2;
      const cy = at ? at.y : stage.clientHeight / 2;
      // Hold the point under the fingers still while the scale changes.
      v.x = cx - ((cx - v.x) / v.s) * s;
      v.y = cy - ((cy - v.y) / v.s) * s;
      v.s = s;
      apply();
    },
    [apply, world],
  );

  /* ---- where a country is, in the copy you are looking at ----------- */

  const centreOn = useCallback(
    (country: Country, smooth = true) => {
      const stage = stageRef.current;
      if (!stage || !world) return;
      const v = view.current;
      const span = world.width * v.s;
      const phone = stage.clientWidth < 860;
      // On a phone the card covers the bottom of the screen, so the country is
      // parked above it rather than dead centre.
      const targetX = stage.clientWidth / 2;
      const targetY = phone ? stage.clientHeight * 0.3 : stage.clientHeight / 2;
      let x = targetX - country.label[0] * v.s;
      const y = targetY - country.label[1] * v.s;
      // Of the three copies, take the one that is the shortest trip from here.
      while (x - v.x > span / 2) x -= span;
      while (v.x - x > span / 2) x += span;
      if (!smooth) {
        view.current = { ...v, x, y };
        apply();
        return;
      }
      if (drift.current) cancelAnimationFrame(drift.current.raf);
      const from = { x: v.x, y: v.y };
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / 420);
        const e = 1 - Math.pow(1 - t, 3);
        view.current.x = from.x + (x - from.x) * e;
        view.current.y = from.y + (y - from.y) * e;
        apply();
        if (t < 1) drift.current = { raf: requestAnimationFrame(step) };
      };
      drift.current = { raf: requestAnimationFrame(step) };
    },
    [apply, world],
  );

  /* ---- hit testing --------------------------------------------------- */

  // The three copies are <use> elements, and a click on one of those reports
  // the <use> rather than the country inside it. So the map never asks the
  // event what was hit: it converts the point into world coordinates, winds it
  // back into the one drawn copy, and asks the geometry itself.
  const at = useCallback(
    (clientX: number, clientY: number): Country | null => {
      const stage = stageRef.current;
      if (!stage || !world) return null;
      const rect = stage.getBoundingClientRect();
      const v = view.current;
      const wx = (((clientX - rect.left - v.x) / v.s) % world.width + world.width) % world.width;
      const wy = (clientY - rect.top - v.y) / v.s;
      const near = (reach: number, only: (c: Country) => boolean) => {
        const slack = reach / v.s; // a fingertip, in world units
        let found: Country | null = null;
        let best = slack * slack;
        for (const country of world.countries) {
          if (!only(country)) continue;
          const dx = wx - country.label[0];
          const dy = wy - country.label[1];
          const distance = dx * dx + dy * dy;
          if (distance < best) {
            best = distance;
            found = country;
          }
        }
        return found;
      };

      const fill = (country: Country, x: number, y: number) => {
        const node = layerRef.current?.querySelector<SVGPathElement>(`[data-iso="${country.iso}"]`);
        if (!node) return false;
        try {
          return node.isPointInFill(new DOMPoint(x, y));
        } catch {
          return false; // not implemented everywhere; the near-miss pass covers it
        }
      };

      let hit: Country | null = null;
      for (const country of world.countries) {
        const [x0, y0, x1, y1] = country.box;
        if (wx < x0 || wx > x1 || wy < y0 || wy > y1) continue;
        if (fill(country, wx, wy)) {
          hit = country;
          break;
        }
      }

      // A country the size of a full stop cannot be aimed at, so one that is
      // within a fingertip can take the tap instead - but only from a country
      // it sits inside. Monaco is drawn on top of France and has to be allowed
      // to steal from it; Liechtenstein merely borders Switzerland, and a tap
      // in Switzerland belongs to Switzerland.
      const tiny = near(9, (c) => c.small && c !== hit);
      if (tiny && (!hit || fill(hit, tiny.label[0], tiny.label[1]))) return tiny;

      return hit ?? near(13, () => true);
    },
    [world],
  );

  const choose = useCallback(
    (country: Country | null, move = true) => {
      if (!country) return;
      setSelected(country.iso);
      setTongue(0);
      setSheetOpen(true);
      if (move) centreOn(country);
    },
    [centreOn],
  );

  /* ---- gestures ------------------------------------------------------ */

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !world) return;

    const min = fit();
    if (min) {
      view.current.s = min * 1.15;
      const japan = byIso.get("JPN");
      if (japan) centreOn(japan, false);
      else apply();
    }

    const pointers = new Map<number, Point>();
    let drag: { id: number; x: number; y: number; ox: number; oy: number; moved: boolean; at: number } | null = null;
    let pinch: { distance: number; s: number; mid: Point } | null = null;
    let last: { x: number; y: number; t: number } | null = null;

    const stopGlide = () => {
      if (glide.current) cancelAnimationFrame(glide.current.raf);
      glide.current = null;
      if (drift.current) cancelAnimationFrame(drift.current.raf);
      drift.current = null;
    };

    const mid = (a: Point, b: Point): Point => {
      const rect = stage.getBoundingClientRect();
      return { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
    };

    const down = (e: PointerEvent) => {
      stopGlide();
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        stage.setPointerCapture(e.pointerId);
      } catch {
        /* capture is a convenience; a pointer it refuses still pans */
      }
      if (pointers.size === 1) {
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: view.current.x, oy: view.current.y, moved: false, at: performance.now() };
        last = { x: e.clientX, y: e.clientY, t: performance.now() };
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), s: view.current.s, mid: mid(a, b) };
        if (drag) drag.moved = true;
      }
    };

    const move = (e: PointerEvent) => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size >= 2 && pinch) {
        const [a, b] = [...pointers.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (Math.abs(distance - pinch.distance) > 2) {
          if (drag) drag.moved = true;
          zoomTo(pinch.s * (distance / pinch.distance), pinch.mid);
        }
        return;
      }
      if (drag && drag.id === e.pointerId) {
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) > TAP_SLOP) drag.moved = true;
        if (drag.moved) {
          view.current.x = drag.ox + dx;
          view.current.y = drag.oy + dy;
          apply();
          const now = performance.now();
          if (last && now > last.t) {
            glide.current = {
              vx: (e.clientX - last.x) / (now - last.t),
              vy: (e.clientY - last.y) / (now - last.t),
              raf: 0,
            };
          }
          last = { x: e.clientX, y: e.clientY, t: now };
        }
        return;
      }
      if (e.pointerType === "mouse") {
        setPointer({ x: e.clientX, y: e.clientY });
        setHover(at(e.clientX, e.clientY));
      }
    };

    const coast = () => {
      const g = glide.current;
      if (!g) return;
      g.vx *= FRICTION;
      g.vy *= FRICTION;
      view.current.x += g.vx * 16;
      view.current.y += g.vy * 16;
      apply();
      if (Math.hypot(g.vx, g.vy) < STOP) {
        glide.current = null;
        return;
      }
      g.raf = requestAnimationFrame(coast);
    };

    const up = (e: PointerEvent) => {
      // Distance is measured from where the finger went down as well as from
      // the moves along the way: a drag that reports no moves at all, which
      // automation and some pens do, must still not count as a tap.
      const travelled = drag ? Math.hypot(e.clientX - drag.x, e.clientY - drag.y) : 0;
      const tapped =
        drag && drag.id === e.pointerId && !drag.moved && travelled <= TAP_SLOP && performance.now() - drag.at < 700;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) {
        if (tapped) {
          glide.current = null;
          choose(at(e.clientX, e.clientY));
        } else if (glide.current && Math.hypot(glide.current.vx, glide.current.vy) > 0.15) {
          glide.current.raf = requestAnimationFrame(coast);
        } else {
          glide.current = null;
        }
        drag = null;
        last = null;
      } else {
        const [first] = [...pointers.entries()];
        drag = { id: first[0], x: first[1].x, y: first[1].y, ox: view.current.x, oy: view.current.y, moved: true, at: performance.now() };
      }
    };

    const cancel = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      pinch = null;
      drag = null;
      glide.current = null;
    };

    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      stopGlide();
      const rect = stage.getBoundingClientRect();
      const spot = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      zoomTo(view.current.s * (e.deltaY < 0 ? 1.12 : 0.89), spot);
    };

    // Safari on iOS zooms the whole page on a pinch unless it is told not to,
    // and a zoomed page cannot be panned back by the map.
    const noGesture = (e: Event) => e.preventDefault();
    const resize = () => {
      const was = { ...middle.current };
      const min = fit();
      const v = view.current;
      if (min) v.s = Math.min(limits.current.max, Math.max(min, v.s));
      // Put back whatever was in the middle before the frame changed shape,
      // rather than leaving the view wherever the old numbers left it.
      v.x = stage.clientWidth / 2 - was.x * v.s;
      v.y = stage.clientHeight / 2 - was.y * v.s;
      apply();
    };

    stage.addEventListener("pointerdown", down);
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", cancel);
    stage.addEventListener("pointerleave", () => setHover(null));
    stage.addEventListener("wheel", wheel, { passive: false });
    stage.addEventListener("gesturestart", noGesture);
    window.addEventListener("resize", resize);
    return () => {
      stopGlide();
      stage.removeEventListener("pointerdown", down);
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerup", up);
      stage.removeEventListener("pointercancel", cancel);
      stage.removeEventListener("wheel", wheel);
      stage.removeEventListener("gesturestart", noGesture);
      window.removeEventListener("resize", resize);
    };
  }, [apply, at, byIso, centreOn, choose, fit, world, zoomTo]);

  /* ---- selection paints itself, without redrawing 242 paths ---------- */

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.querySelectorAll(".on").forEach((node) => node.classList.remove("on"));
    if (selected) layer.querySelectorAll(`[data-iso="${selected}"]`).forEach((n) => n.classList.add("on"));
  }, [selected, world]);

  const country = selected ? byIso.get(selected) ?? null : null;
  const place = selected ? places[selected] : undefined;

  // Every link behind what the card is saying, in one list at the bottom
  // rather than scattered under each line.
  const sources = useMemo(() => {
    if (!place) return [];
    const all = [...(place.sources ?? [])];
    const ids = place.varieties.filter((id) => varieties[id]);
    const showing = ids[Math.min(tongue, ids.length - 1)];
    for (const expression of Object.values(varieties[showing]?.expressions ?? {})) {
      all.push(...(expression.sources ?? []));
    }
    return [...new Set(all.filter(Boolean))];
  }, [place, tongue]);

  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !world) return [];
    return world.countries
      .filter((c) => c.ja.toLowerCase().includes(q) || c.en.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, world]);

  const speak = (text: string, lang: string) => {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    speechSynthesis.speak(utterance);
  };

  return (
    <div className="terra">
      {intro && <TerraIntro onDone={closeIntro} />}
      <div className="terraStage" ref={stageRef}>
        {world ? (
          <svg className="terraSvg" aria-hidden="true">
            <g ref={layerRef}>
              <g id="terra-world">
                <rect className="terraSea" x="0" y="0" width={world.width} height={world.height} />
                {world.countries.map((c) => (
                  <path key={c.iso} data-iso={c.iso} className="terraCountry" d={c.d} />
                ))}
                {world.countries
                  .filter((c) => c.small)
                  .map((c) => (
                    <circle key={`dot-${c.iso}`} data-iso={c.iso} className="terraDot" cx={c.label[0]} cy={c.label[1]} r="4" />
                  ))}
              </g>
              <use href="#terra-world" x={-world.width} />
              <use href="#terra-world" x={world.width} />
            </g>
          </svg>
        ) : (
          <p className="terraLoading">{failed ? "地図を読み込めませんでした。" : "世界を広げています…"}</p>
        )}

        {hover && (
          <span className="terraTip" style={{ left: pointer.x, top: pointer.y }}>
            {hover.ja}
          </span>
        )}

        <div className="terraZoom">
          <button type="button" onClick={() => zoomTo(view.current.s * 1.35)} aria-label="拡大">
            <TerraFrame variant={0} />＋
          </button>
          <button type="button" onClick={() => zoomTo(view.current.s / 1.35)} aria-label="縮小">
            <TerraFrame variant={1} />−
          </button>
          <button
            type="button"
            className="terraReset"
            onClick={() => {
              const min = fit();
              if (min) zoomTo(min * 1.15);
              if (country) centreOn(country);
            }}
          >
            <TerraFrame variant={2} />
            RESET
          </button>
        </div>

        <div className="terraSearch">
          <TerraFrame variant={1} />
          <input
            type="search"
            value={query}
            placeholder="国や地域をさがす"
            aria-label="国や地域をさがす"
            onChange={(e) => setQuery(e.target.value)}
          />
          {found.length > 0 && (
            <ul>
              {found.map((c) => (
                <li key={c.iso}>
                  <button
                    type="button"
                    onClick={() => {
                      choose(c);
                      setQuery("");
                    }}
                  >
                    <span>{c.ja}</span>
                    <small>{c.en}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <aside className={`terraCard${sheetOpen ? " open" : ""}`} aria-live="polite">
        <button type="button" className="terraGrip" onClick={() => setSheetOpen((v) => !v)} aria-label={sheetOpen ? "閉じる" : "開く"}>
          <i />
        </button>
        {country ? (
          <div className="terraCardBody">
            {/* Its own outline beside its name: every place has one, it needs
                no picture finding or licensing, and it cannot flatter or
                caricature anybody. The frame is the portrait box worked out
                with the map data: the archipelago but not the far-flung
                speck, so Japan keeps Hokkaido and Chile loses Easter
                Island. */}
            <div className="terraHead">
              <div>
                <p className="terraEyebrow">{country.region || "PLACE"}</p>
                <h2>{country.ja}</h2>
                <p className="terraEn">
                  {country.en}
                  {place?.capital ? ` · 首都 ${place.capital}` : ""}
                </p>
              </div>
              {(() => {
                const [x0, y0, x1, y1] = country.crop ?? country.box;
                // Proportional, with no floor: a fixed margin of three units
                // is nothing round China and is most of the frame round
                // Tuvalu, which is how the small places ended up as specks.
                const pad = Math.max(0.2, (x1 - x0 + y1 - y0) * 0.1);
                return (
                  <svg
                    className="terraOutline"
                    viewBox={`${x0 - pad} ${y0 - pad} ${x1 - x0 + pad * 2} ${y1 - y0 + pad * 2}`}
                    aria-hidden="true"
                  >
                    <path d={country.d} vectorEffect="non-scaling-stroke" />
                  </svg>
                );
              })()}
            </div>

            {place ? (
              (() => {
                // A country is not a language. The card says "some of what is
                // said here", names the language every time, and lets the ones
                // with more than one be switched between - so a single entry
                // never reads as the whole of a country's speech.
                const ids = place.varieties.filter((id) => varieties[id]);
                const id = ids[Math.min(tongue, ids.length - 1)];
                const variety = varieties[id];
                if (!variety) return null;
                return (
                  <section className="terraVariety">
                    <p className="terraKind">この場所で紹介することば</p>
                    {ids.length > 1 && (
                      <div className="terraTongues">
                        {ids.map((each, i) => (
                          <button
                            key={each}
                            type="button"
                            className={i === Math.min(tongue, ids.length - 1) ? "on" : undefined}
                            onClick={() => setTongue(i)}
                          >
                            <TerraFrame variant={i} />
                            {varieties[each].name}
                          </button>
                        ))}
                      </div>
                    )}
                    {/* With the buttons above, the chosen one already says
                        the name; without them, this is where it is said. */}
                    {ids.length === 1 && <h3>{variety.name}</h3>}
                    {KINDS.map((kind) => {
                      const expression = variety.expressions[kind];
                      if (!expression) return null;
                      return (
                        <div className={`terraPhrase terraPhrase-${kind}`} key={kind}>
                          <p className="terraKind">{KIND_LABEL[kind]}</p>
                          <p className="terraText">{expression.text}</p>
                          <p className="terraReading">{expression.reading}</p>
                          {expression.pronunciationNote && (
                            <p className="terraSound">{expression.pronunciationNote}</p>
                          )}
                          <p className="terraMeaning">{expression.meaning}</p>
                          {(expression.register || expression.usage) && (
                            <p className="terraUse">
                              {expression.register && REGISTER_LABEL[expression.register] && (
                                <span className="terraRegister">{REGISTER_LABEL[expression.register]}</span>
                              )}
                              {expression.usage}
                            </p>
                          )}
                          <button
                            type="button"
                            className="terraSpeak"
                            onClick={() => speak(expression.audioText || expression.text, variety.speech)}
                          >
                            <TerraFrame variant={kind === "greeting" ? 0 : kind === "thanks" ? 1 : 2} />
                            音で聞く
                          </button>
                        </div>
                      );
                    })}
                  </section>
                );
              })()
            ) : (
              <p className="terraEmpty">この場所の挨拶はまだ書けていません。書けたところから増やしていきます。</p>
            )}

            {(place?.gesture || place?.culture) && (
              <div className="terraCulture">
                <p className="terraKind">仕草</p>
                {place.gesture && <p className="terraGesture">{place.gesture}</p>}
                {place.culture && <p>{place.culture}</p>}
                {place.note && <p className="terraNote">{place.note}</p>}
              </div>
            )}

            {sources.length > 0 && (
              <div className="terraSources">
                <p className="terraKind">出典</p>
                <ul>
                  {sources.map((url) => (
                    <li key={url}>
                      <a href={url} target="_blank" rel="noreferrer">
                        {url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="terraCardBody">
            <p className="terraEmpty">地図の国にふれると、その土地の挨拶が出ます。</p>
          </div>
        )}
      </aside>
    </div>
  );
}
