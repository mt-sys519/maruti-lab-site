// The affiliate banners shown under the games and tools. The A8.net tags are used as A8 issues
// them (link, 120×60 banner and the 1×1 image that counts views), only split into fields.
// public/piclea/index.html carries its own copy of the Amazon banner, since it is a static page.

export type A8Banner = { name: string; href: string; img: string; pixel: string };

export const a8Banners: A8Banner[] = [
  { name: "Pixio", href: "https://px.a8.net/svt/ejp?a8mat=4BE68L+FWR4L6+XTI+15R4NL", img: "https://www25.a8.net/svt/bgt?aid=261001749962&wid=006&eno=01&mid=s00000004383007013000&mc=1", pixel: "https://www16.a8.net/0.gif?a8mat=4BE68L+FWR4L6+XTI+15R4NL" },
  { name: "e☆イヤホン", href: "https://px.a8.net/svt/ejp?a8mat=4BE68L+FLFW3E+55QO+C0IZL", img: "https://www23.a8.net/svt/bgt?aid=261001749943&wid=006&eno=01&mid=s00000024072002018000&mc=1", pixel: "https://www18.a8.net/0.gif?a8mat=4BE68L+FLFW3E+55QO+C0IZL" },
  { name: "GEO", href: "https://px.a8.net/svt/ejp?a8mat=4BE68L+FQ7CXM+4J34+5ZU29", img: "https://www22.a8.net/svt/bgt?aid=261001749951&wid=006&eno=01&mid=s00000021136001007000&mc=1", pixel: "https://www10.a8.net/0.gif?a8mat=4BE68L+FQ7CXM+4J34+5ZU29" },
  { name: "Audible", href: "https://px.a8.net/svt/ejp?a8mat=4BE68L+929O56+5TB0+5ZU29", img: "https://www29.a8.net/svt/bgt?aid=261001749548&wid=006&eno=01&mid=s00000027126001007000&mc=1", pixel: "https://www19.a8.net/0.gif?a8mat=4BE68L+929O56+5TB0+5ZU29" },
];

// A sale banner comes down by itself at the end of `until` (Japan time), so a finished sale is never left up.
// Two of Amazon's sizes: the wide strip on computers, the near-square one on phones (below 560px),
// where the strip's small lines would be too small to read.
type Pic = { src: string; width: number; height: number };
export type AmazonBanner = { href: string; wide: Pic; narrow: Pic; alt: string; until: string };

export const amazonBanner: AmazonBanner = {
  href: "https://link.amazon/B00H0sLsT",
  wide: { src: "/ads/amazon-prime-thanks-2026-wide.webp", width: 1029, height: 375 },
  narrow: { src: "/ads/amazon-prime-thanks-2026-square.webp", width: 600, height: 500 },
  alt: "Amazon プライム感謝祭 10/16（金）〜10/19（月）",
  until: "2026-10-19T23:59:59+09:00",
};
