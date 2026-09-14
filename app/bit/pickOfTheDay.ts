import { bitGames } from "./games";

/** One machine for everyone, for the length of a day in Japan.
 *
 *  A fresh random pick on every load cannot be done here: the page is
 *  rendered once on the server and again in the browser, the two would
 *  disagree, and the machine would have to be patched in after mount -
 *  visibly, on a slot that starts empty. Deriving it from the Tokyo date
 *  makes both renders agree, and lets the section say what it actually is.
 */
export function pickOfTheDay(now = new Date()) {
  // Fixed to Tokyo rather than the reader's clock, so a phone in another
  // timezone still matches the HTML it was served.
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number);
  const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
  return bitGames[dayNumber % bitGames.length];
}
