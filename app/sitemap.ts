import type { MetadataRoute } from "next";

const siteUrl = "https://marutilab.com";

const indexablePaths = [
  "",
  "/clock",
  "/bit",
  "/bit/blank",
  "/bit/sequence",
  "/bit/input-rain",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return indexablePaths.map((path) => ({ url: `${siteUrl}${path}` }));
}
