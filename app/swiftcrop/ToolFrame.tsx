"use client";

import { useEffect, useRef } from "react";
import styles from "./SwiftCropPage.module.css";
import { correctEmbeddedViewport, type EmbedViewport } from "./embedViewport";

/** Beyond this the measurement is wrong, not the page. */
const MAX_HEIGHT = 20000;
/** Written into the height and tolerated when reading back, so a layout that
 *  rounds up does not leave one pixel of overflow - which is a scrollbar. */
const SLACK = 4;

type Props = {
  src: string;
  title: string;
  /** The element inside the app whose children are the actual content. */
  measureRoot?: string;
};

/**
 * The tool in a frame as tall as the tool, so the page scrolls and the frame
 * does not. Nothing inside the app is changed: its height is read from its own
 * document and written onto the iframe from out here.
 *
 * Reading it is the whole difficulty. `scrollHeight` cannot be used, because
 * the document's viewport is the iframe: once the frame is made taller, the
 * app's own `min-height: 100vh` grows to match, and the number never comes
 * back down - the frame would grow and never shrink again. What is measured
 * instead is the bottom of the last thing actually laid out inside the app's
 * container, which owes nothing to the height of the frame around it.
 *
 * If this never runs - no JavaScript, a cross-origin document, a container
 * that has been renamed - the CSS height stands and the frame scrolls the way
 * it used to. Worse to use, but it hides nothing.
 */
export function ToolFrame({ src, title, measureRoot = ".app-container" }: Props) {
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    let stop: (() => void) | undefined;

    const attach = () => {
      const doc = frame.contentDocument;
      const view = frame.contentWindow;
      if (!doc?.documentElement || !doc.body || !view) return;

      const measure = () => {
        const root = doc.querySelector(measureRoot) ?? doc.body;
        const offset = doc.documentElement.scrollTop;
        let bottom = 0;
        let counted = 0;
        for (const child of Array.from(root.children)) {
          const style = view.getComputedStyle(child);
          // Out of flow: a modal or a toast sits where it likes and is no part
          // of how tall the page is.
          if (style.display === "none" || style.position === "fixed") continue;
          bottom = Math.max(bottom, child.getBoundingClientRect().bottom + offset);
          counted += 1;
        }
        if (!counted) {
          return Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);
        }
        const rootStyle = view.getComputedStyle(root);
        const bodyStyle = view.getComputedStyle(doc.body);
        return Math.ceil(
          bottom +
            parseFloat(rootStyle.paddingBottom || "0") +
            parseFloat(rootStyle.marginBottom || "0") +
            parseFloat(bodyStyle.marginBottom || "0"),
        );
      };

      // While the frame does not scroll, the app's own fixed and sticky
      // elements have no window to hold on to. This lends them the reader's.
      let viewport: EmbedViewport | undefined;
      try {
        viewport = correctEmbeddedViewport(frame, doc);
      } catch {
        // The app still works; a toast lands in the wrong place.
      }

      let applied = 0;
      let climbs = 0;
      let busy = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const giveUp = () => {
        frame.style.height = "";
        stop?.();
        stop = undefined;
      };

      // Not requestAnimationFrame: a background tab or a hidden preview pane
      // never paints, so the callback never arrives and the frame stays at
      // whatever it happened to measure first.
      const schedule = () => {
        clearTimeout(timer);
        timer = setTimeout(fit, 60);
      };

      function fit() {
        if (busy) return;
        busy = true;
        try {
          const height = measure();
          if (height <= 0) return;
          const target = height + SLACK;
          if (Math.abs(target - applied) <= 2) return;
          if (target > applied) climbs += 1;
          else climbs = 0;
          if (target > MAX_HEIGHT || climbs > 40) return giveUp();
          applied = target;
          frame.style.height = `${target}px`;
          viewport?.update();
          // Resizing the frame reflows the document inside it, and that reflow
          // can change the height again - the settings column is capped at
          // `100vh`, so a taller frame lets it grow. Nothing out here is told
          // about that, so it is simply measured again.
          schedule();
        } finally {
          busy = false;
        }
      }

      fit();
      // The app changes height as it is used: images added, a panel opened, a
      // result appearing. So this keeps watching rather than measuring once.
      const resizes = new ResizeObserver(schedule);
      resizes.observe(doc.documentElement);
      resizes.observe(doc.body);
      const mutations = new MutationObserver(schedule);
      mutations.observe(doc.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
      });
      window.addEventListener("resize", schedule);
      stop = () => {
        clearTimeout(timer);
        resizes.disconnect();
        mutations.disconnect();
        window.removeEventListener("resize", schedule);
        viewport?.dispose();
      };
    };

    const onLoad = () => {
      stop?.();
      stop = undefined;
      try {
        attach();
      } catch {
        // Cross-origin, or the document went away mid-measure.
        frame.style.height = "";
      }
    };

    frame.addEventListener("load", onLoad);
    // Already loaded by the time this ran - a back-forward restore, say.
    if (frame.contentDocument?.readyState === "complete") onLoad();
    return () => {
      frame.removeEventListener("load", onLoad);
      stop?.();
    };
  }, [measureRoot]);

  return (
    <iframe
      ref={ref}
      className={styles.frame}
      src={src}
      title={title}
      loading="eager"
    />
  );
}
