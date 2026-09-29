import type { Metadata } from "next";
import type { ReactNode } from "react";

// Everything under /color-refine wears the tool's own tab icon (the colour wheel, from the tool's own site)
// rather than the lab's bottle, which the root layout gives every other page.
export const metadata: Metadata = {
  icons: {
    icon: [
      { url: "/color-refine-app/icons/favicon.svg", type: "image/svg+xml" },
      { url: "/color-refine-app/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/color-refine-app/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function ColorRefineLayout({ children }: { children: ReactNode }) {
  return children;
}
