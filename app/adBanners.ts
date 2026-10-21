// The affiliate banners shown under the games and tools. The A8.net tags are used as A8 issues
// them (link, 120×60 banner and the 1×1 image that counts views), only split into fields.

export type A8Banner = { name: string; href: string; img: string; pixel: string };

export const a8Banners: A8Banner[] = [
  { name: "Pixio", href: "https://px.a8.net/svt/ejp?a8mat=4BE68L+FWR4L6+XTI+15R4NL", img: "https://www25.a8.net/svt/bgt?aid=261001749962&wid=006&eno=01&mid=s00000004383007013000&mc=1", pixel: "https://www16.a8.net/0.gif?a8mat=4BE68L+FWR4L6+XTI+15R4NL" },
  { name: "e☆イヤホン", href: "https://px.a8.net/svt/ejp?a8mat=4BE68L+FLFW3E+55QO+C0IZL", img: "https://www23.a8.net/svt/bgt?aid=261001749943&wid=006&eno=01&mid=s00000024072002018000&mc=1", pixel: "https://www18.a8.net/0.gif?a8mat=4BE68L+FLFW3E+55QO+C0IZL" },
  { name: "GEO", href: "https://px.a8.net/svt/ejp?a8mat=4BE68L+FQ7CXM+4J34+5ZU29", img: "https://www22.a8.net/svt/bgt?aid=261001749951&wid=006&eno=01&mid=s00000021136001007000&mc=1", pixel: "https://www10.a8.net/0.gif?a8mat=4BE68L+FQ7CXM+4J34+5ZU29" },
  { name: "Audible", href: "https://px.a8.net/svt/ejp?a8mat=4BE68L+929O56+5TB0+5ZU29", img: "https://www29.a8.net/svt/bgt?aid=261001749548&wid=006&eno=01&mid=s00000027126001007000&mc=1", pixel: "https://www19.a8.net/0.gif?a8mat=4BE68L+929O56+5TB0+5ZU29" },
];

// The Rakuten widget (もしもアフィリエイト) is framed from public/ads/rakuten.html, which holds
// the tag. Its two sizes: the wide one where it fits in the 640px slot, the near-square one on
// narrower screens. public/piclea/index.html frames the same file.
export const rakutenWidget = {
  src: "/ads/rakuten.html",
  wide: { s: "600x200", width: 600, height: 200 },
  narrow: { s: "300x250", width: 300, height: 250 },
  /** Below this width the wide one would overflow the slot. */
  narrowQuery: "(max-width: 639px)",
};
