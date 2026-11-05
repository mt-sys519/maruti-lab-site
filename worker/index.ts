/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const response = await handler.fetch(request, env, ctx);
    if (url.pathname === "/bit/airhockey") return withResultCard(response, url.searchParams.get("r"));
    return response;
  },
};

// AIR HOCKEY's shared results (/bit/airhockey?r=pro-legend-win) are the same
// page with its result's card (public/og/bit/airhockey, made by
// scripts/generate-airhockey-result-og.mjs) in place of the page's own picture,
// so X shows the card under the post. No page of its own per result: the
// canonical URL stays /bit/airhockey.
interface MetaElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  remove(): void;
}

const AIRHOCKEY_RESULT =/^(arcade-(easy|normal|hard)|pro-(elite|champion|legend))-(win|lose)$|^2p-(blue|yellow)$/;

function withResultCard(response: Response, slug: string | null): Response {
  if (!slug || !AIRHOCKEY_RESULT.test(slug) || !response.headers.get("content-type")?.includes("text/html")) return response;
  const card = `https://marutilab.com/og/bit/airhockey/${slug}.jpg`;
  // the page also offers a square picture after the wide one; its four tags go,
  // so the card is the only picture
  let dropSquare = 0;
  return new HTMLRewriter()
    .on('meta[property^="og:image"]', {
      element(el: MetaElement) {
        const property = el.getAttribute("property");
        const content = el.getAttribute("content") ?? "";
        if (property === "og:image" && content.endsWith("/og/bit/airhockey-square.png")) dropSquare = 4;
        if (dropSquare > 0) {
          dropSquare--;
          el.remove();
          return;
        }
        if (property === "og:image") el.setAttribute("content", card);
      },
    })
    .on('meta[name="twitter:image"]', {
      element(el: MetaElement) {
        el.setAttribute("content", card);
      },
    })
    .transform(response);
}

export default worker;
