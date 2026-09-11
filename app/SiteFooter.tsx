/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires a document navigation for local routes */

// One footer for the whole site. There used to be ten of these written by
// hand, no two alike: the front page carried eleven links, the CLOCK page
// four, and 4TRACK appeared in most of them while SwiftCrop, COLOR RE:FINE
// and CLOCK did not. Products belong under Works; the footer carries the
// sections of the site and the pages about the site itself.
const sections = [
  { href: "/", label: "Works" },
  { href: "/bit", label: "MarutiBit" },
  { href: "/blog", label: "LabNote" },
];
const site = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];
const legal = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/disclaimer", label: "Disclaimer" },
];
const external = [
  { href: "https://x.com/maruti_lab", label: "X / @maruti_lab" },
  { href: "https://note.com/a_tkms", label: "note" },
  { href: "https://buymeacoffee.com/marutilab", label: "Coffee" },
];

/**
 * @param extra links belonging to the page itself, shown with the site
 *   sections - COLOR RE:FINE's licence notice, for instance.
 */
export function SiteFooter({
  extra = [],
  className,
}: {
  extra?: { href: string; label: string }[];
  /** For pages that style their own footer, like 4TRACK's. */
  className?: string;
}) {
  return (
    <footer className={className}>
      <div className="footerBrand">Maruti Lab</div>
      <div className="footerLinks">
        {[...sections, ...extra].map((link) => (
          <a key={link.href} href={link.href}>{link.label}</a>
        ))}
        <span className="footerDivider" aria-hidden="true" />
        {site.map((link) => (
          <a key={link.href} href={link.href}>{link.label}</a>
        ))}
        {legal.map((link) => (
          <a key={link.href} href={link.href}>{link.label}</a>
        ))}
        <span className="footerDivider" aria-hidden="true" />
        {external.map((link) => (
          <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
            {link.label}
          </a>
        ))}
      </div>
      <small>© 2026 Maruti Lab</small>
    </footer>
  );
}
