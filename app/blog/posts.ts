import { marked } from "marked";

export type Post = {
  slug: string;
  title: string;
  date: string;
  description: string;
  tags: string[];
  draft: boolean;
  html: string;
  minutes: number;
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
  return {
    slug,
    title: data.title || slug,
    date: data.date || "",
    description:
      data.description ||
      text.replace(/\s+/g, " ").trim().slice(0, 110),
    tags: list(data.tags),
    draft: data.draft === "true",
    html: marked.parse(body) as string,
    // Japanese runs about 500 characters a minute; round up so a short note
    // never claims to take zero.
    minutes: Math.max(1, Math.round(text.replace(/\s/g, "").length / 500)),
  };
}

const all = Object.entries(files)
  .map(([path, source]) => build(path, source))
  .sort((a, b) => (a.date < b.date ? 1 : -1));

/** Everything published, newest first. Drafts never reach the site. */
export const posts = all.filter((post) => !post.draft);
export const postBySlug = (slug: string) =>
  posts.find((post) => post.slug === slug);
export const allTags = [...new Set(posts.flatMap((post) => post.tags))];

export const formatDate = (date: string) => {
  const [year, month, day] = date.split("-");
  return year && month && day ? `${year}.${month}.${day}` : date;
};
