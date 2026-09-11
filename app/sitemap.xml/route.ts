import { posts } from "../blog/posts";

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
    ...posts.map(
      (post) =>
        `  <url><loc>https://marutilab.com/blog/${post.slug}</loc><lastmod>${post.date}</lastmod></url>`,
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
