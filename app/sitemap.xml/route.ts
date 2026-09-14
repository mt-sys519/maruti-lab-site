import { lastChanged, pageCount, pagePath, posts } from "../blog/posts";

// The sitemap used to be a hand-maintained file in public/. Notes are added by
// dropping a Markdown file into content/posts/, and an article Google never
// hears about is an article that did not need writing, so the list is built
// from the same source the pages are.
const pages = [
  "/",
  "/clock",
  "/4track",
  "/swiftcrop",
  "/swiftcrop/faq",
  "/color-refine",
  "/color-refine/help",
  "/color-refine/licenses",
  "/bit",
  "/bit/angle",
  "/bit/blank",
  "/bit/sequence",
  "/bit/input-rain",
  "/bit/paku",
  "/bit/liltorb",
  "/bit/avenue",
  "/bit/neonbreak",
  "/blog",
  "/about",
  "/privacy",
  "/disclaimer",
  "/contact",
  "/terms",
];

export function GET() {
  const entries = [
    ...pages.map((path) => `  <url><loc>https://marutilab.com${path}</loc></url>`),
    // Page one is already in the list above as /blog.
    ...Array.from({ length: pageCount - 1 }, (_, i) => pagePath(i + 2)).map(
      (path) => `  <url><loc>https://marutilab.com${path}</loc></url>`,
    ),
    ...posts.map(
      (post) =>
        // lastmod is when the page last changed, not when it first appeared -
        // an edited post that still reported its publication date would be
        // telling Google to ignore the edit.
        `  <url><loc>https://marutilab.com/blog/${post.slug}</loc><lastmod>${lastChanged(post)}</lastmod></url>`,
    ),
  ];
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`,
    {
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    },
  );
}
