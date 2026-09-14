/**
 * Corrections that apply only while SwiftCrop is embedded.
 *
 * The frame is as tall as the app, so the app's document never scrolls and
 * `position: fixed` inside it anchors to the whole document rather than to the
 * screen: the save toast lands at the bottom of a two-thousand pixel page, a
 * modal centres itself a screen and a half away, and the settings column's
 * `position: sticky` never engages, because the box it would stick to is not
 * the box that scrolls any more.
 *
 * None of that is wrong in the app - on its own domain the document is the
 * window and all three behave. So nothing here is a change to SwiftCrop: the
 * stylesheet below is injected into the frame from outside, and it only tells
 * those three where the reader's window currently is. The app's own files are
 * untouched, and opening /swiftcrop-app/index.html directly gets the original
 * behaviour.
 *
 * `--embed-top` is how far down the app's document the visible window starts,
 * and `--embed-height` how much of it is on screen. The parent keeps both
 * current as the page scrolls.
 */

const STYLE_ID = "maruti-embed-viewport";

const CSS = `
:root{--embed-top:0px;--embed-height:100vh;--embed-window:100vh;--embed-panel-shift:0px}
/* Anchored to the reader's window rather than to the foot of the document. */
.toast{position:absolute!important;bottom:auto!important;
  top:calc(var(--embed-top) + var(--embed-height) - 62px)!important}
/* Covers, and centres its contents in, the part of the app on screen. */
.modal-backdrop,.additional-drop-overlay{position:absolute!important;
  top:var(--embed-top)!important;left:0!important;right:0!important;
  bottom:auto!important;height:var(--embed-height)!important}
/* Sticky cannot work in a frame that never scrolls, so the column is moved
   down by hand instead. It stays in flow, so the grid is unaffected. */
.control-panel{position:static!important;
  max-height:calc(var(--embed-window) - 32px)!important;
  transform:translateY(var(--embed-panel-shift))}
@media(max-width:920px){
  /* One column: the settings are above the work area and scroll with it. */
  .control-panel{transform:none!important;max-height:none!important}
}
`;

/** Layout position in document coordinates - unaffected by any transform. */
function documentTop(element: HTMLElement) {
  let top = 0;
  let node: HTMLElement | null = element;
  while (node) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return top;
}

export type EmbedViewport = { update: () => void; dispose: () => void };

export function correctEmbeddedViewport(
  frame: HTMLIFrameElement,
  doc: Document,
): EmbedViewport | undefined {
  if (!doc.documentElement || !doc.head) return undefined;

  let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    doc.head.appendChild(style);
  }

  const root = doc.documentElement;

  const update = () => {
    const rect = frame.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    // Where the window sits over the frame, in the frame's own coordinates.
    const top = Math.min(Math.max(-rect.top, 0), Math.max(rect.height, 0));
    const bottom = Math.min(rect.height, top + windowHeight - Math.max(rect.top, 0));
    const height = Math.max(0, bottom - top);
    root.style.setProperty("--embed-top", `${Math.round(top)}px`);
    root.style.setProperty("--embed-height", `${Math.round(height)}px`);
    // The settings column is capped against the whole window, not the sliver
    // of frame on screen: cap it against the sliver and it would resize while
    // the page scrolls, changing the height of the frame under it.
    root.style.setProperty("--embed-window", `${windowHeight}px`);

    const panel = doc.querySelector<HTMLElement>(".control-panel");
    const area = doc.querySelector<HTMLElement>(".main-layout");
    if (!panel || !area) return;
    if (panel.offsetParent === null) {
      root.style.setProperty("--embed-panel-shift", "0px");
      return;
    }
    // Stacked on a phone: the settings belong above the work area, not
    // following the window down it.
    const view = doc.defaultView ?? window;
    if (view.getComputedStyle(area).gridTemplateColumns.split(" ").length < 2) {
      root.style.setProperty("--embed-panel-shift", "0px");
      return;
    }
    const panelTop = documentTop(panel);
    // How far it can go before its foot leaves the column it belongs to.
    const room = documentTop(area) + area.offsetHeight - (panelTop + panel.offsetHeight);
    const wanted = top + 16 - panelTop;
    const shift = Math.max(0, Math.min(room, wanted));
    root.style.setProperty("--embed-panel-shift", `${Math.round(shift)}px`);
  };

  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);

  return {
    update,
    dispose() {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      style?.remove();
      root.style.removeProperty("--embed-top");
      root.style.removeProperty("--embed-height");
      root.style.removeProperty("--embed-window");
      root.style.removeProperty("--embed-panel-shift");
    },
  };
}
