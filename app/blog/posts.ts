import { marked } from "marked";

export type Post = {
  slug: string;
  title: string;
  /** Published, as a day. Never changes once a post is live. */
  date: string;
  /** The same date as written, keeping any time on it. Ordering only. */
  stamp: string;
  /** Last meaningful edit, if there has been one. Absent on untouched posts. */
  updated?: string;
  description: string;
  tags: string[];
  draft: boolean;
  html: string;
  minutes: number;
  /** Share card, written by scripts/capture-note-ogp.mjs. */
  image?: string;
  /** The page of the work the note is about (`work: /bit/paku`), if it is
   *  about one. The note ends on that work, and the work lists the note. */
  work?: string;
};

// Cloudflare Workers have no filesystem, so the articles are bundled at build
// time rather than read at request time. Writing a post means adding a file to
// content/posts/ and pushing - the deploy picks it up.
const files = import.meta.glob("../../content/posts/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

// Deliberately small: a key, a colon, a value, and [a, b] for lists. The point
// is that a post is a file you can write in GitHub's editor without a build
// step in your head.
function parseFrontMatter(source: string) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!match) return { data: {} as Record<string, string>, body: source };
  const data: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const at = line.indexOf(":");
    if (at === -1) continue;
    data[line.slice(0, at).trim()] = line
      .slice(at + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return { data, body: source.slice(match[0].length) };
}

const list = (value: string | undefined) =>
  (value ?? "")
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((tag) => tag.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);

marked.setOptions({ gfm: true, breaks: false });

function build(path: string, source: string): Post {
  const { data, body } = parseFrontMatter(source);
  const slug = data.slug || path.split("/").pop()!.replace(/\.md$/, "");
  const text = body.replace(/[#>*`_\-\[\]()!]/g, "");
  // `date:` may carry a time - 2026-09-15 21:30 - for a day that gets more
  // than one note. Everything shown or published uses the day; only the
  // ordering looks at the time.
  const stamp = (data.date || "").trim();
  const day = stamp.slice(0, 10);
  return {
    slug,
    title: data.title || slug,
    date: day,
    stamp,
    updated: data.updated && data.updated !== day ? data.updated : undefined,
    description:
      data.description ||
      text.replace(/\s+/g, " ").trim().slice(0, 110),
    tags: list(data.tags),
    draft: data.draft === "true",
    image: data.image || undefined,
    work: data.work || undefined,
    html: marked.parse(body) as string,
    // Japanese runs about 500 characters a minute; round up so a short note
    // never claims to take zero.
    minutes: Math.max(1, Math.round(text.replace(/\s/g, "").length / 500)),
  };
}

// Newest first. The comparator has to be able to say "these are the same":
// returning -1 for a tie, as this once did, is not an ordering at all, and two
// notes published on one day came out in whatever order fell out of it - which
// was their file names, backwards. Ties now keep the order they were read in,
// and a note that needs to sit above another from the same day says so with a
// time.
const all = Object.entries(files)
  .map(([path, source]) => build(path, source))
  .sort((a, b) => (a.stamp < b.stamp ? 1 : a.stamp > b.stamp ? -1 : 0));

/** Everything published, newest first. Drafts never reach the site. */
export const posts = all.filter((post) => !post.draft);
export const postBySlug = (slug: string) =>
  posts.find((post) => post.slug === slug);
export const allTags = [...new Set(posts.flatMap((post) => post.tags))];

/** The notes about one work, newest first - for the foot of that work's page. */
export const postsAbout = (href: string) =>
  posts.filter((post) => post.work === href);

/** What a search engine should treat as the age of the page. */
export const lastChanged = (post: Post) => post.updated || post.date;

// Paging is settled now rather than at a hundred posts, because the index is
// the one part of the note section whose URLs are not already fixed: /blog is
// page one and always will be, and the rest are /blog/page/2 onwards. A query
// string would have worked too, but a path is what Google treats as a page in
// its own right, and it cannot be dropped by a link that forgets it.
export const PER_PAGE = 20;
export const pageCount = Math.max(1, Math.ceil(posts.length / PER_PAGE));
export const postsOnPage = (page: number) =>
  posts.slice((page - 1) * PER_PAGE, page * PER_PAGE);
/** Page one lives at /blog, so /blog/page/1 is never a URL. */
export const pagePath = (page: number) => (page <= 1 ? "/blog" : `/blog/page/${page}`);

export const formatDate = (date: string) => {
  const [year, month, day] = date.split("-");
  return year && month && day ? `${year}.${month}.${day}` : date;
};
