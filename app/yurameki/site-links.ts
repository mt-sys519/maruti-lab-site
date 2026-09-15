/**
 * YURAMEKI read this from NEXT_PUBLIC_BUY_ME_A_COFFEE_URL, which was set in
 * the project it came from and is set nowhere here - no .env, no vars in
 * wrangler.jsonc - so it arrived as "" and the three places that use it fell
 * back to saying the support page was coming soon. It has existed the whole
 * time: the rest of the site writes the same address out in seven places.
 *
 * The Formspree endpoint that sat beside it is gone with it. Contact is the
 * lab's own ContactForm now, which carries its own address, and nothing had
 * imported this one since the move.
 */
export const supportUrl = "https://buymeacoffee.com/marutilab";
