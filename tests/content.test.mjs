import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

// The page module reads its posts through Vite's import.meta.glob, which only
// exists inside the bundler, so the test reads the same folder from disk and
// parses the front matter itself. That also keeps it from agreeing with a bug
// in the parser it is checking.
const postsDir = new URL("../content/posts/", import.meta.url);

async function readPosts() {
  const names = (await readdir(postsDir)).filter((name) => name.endsWith(".md"));
  return Promise.all(
    names.map(async (name) => {
      const source = await readFile(new URL(name, postsDir), "utf8");
      const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
      const data = {};
      for (const line of (match?.[1] ?? "").split(/\r?\n/)) {
        const at = line.indexOf(":");
        if (at !== -1) data[line.slice(0, at).trim()] = line.slice(at + 1).trim();
      }
      return { slug: name.replace(/\.md$/, ""), data, body: source.slice(match?.[0].length ?? 0) };
    }),
  );
}

async function render(path) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

const published = async () =>
  (await readPosts()).filter((post) => post.data.draft !== "true");

test("renders the notes index with every published post", async () => {
  const response = await render("/blog");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /LabNote/);
  for (const post of await published()) {
    assert.match(html, new RegExp(`href="/blog/${post.slug}"`));
    assert.ok(html.includes(post.data.title), `${post.slug} is missing its title`);
  }
});

test("renders a post as HTML rather than raw Markdown", async () => {
  const [post] = await published();
  if (!post) return;
  const response = await render(`/blog/${post.slug}`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(html.includes(post.data.title));
  assert.match(html, /class="postBody"/);
  const body = html.slice(html.indexOf('class="postBody"'));
  // A body still showing "## " never went through the renderer.
  assert.doesNotMatch(body.slice(0, 6000), />\s*##\s/);
  if (/^##\s/m.test(post.body)) assert.match(body.slice(0, 6000), /<h2/);
});

test("drafts stay off the site", async () => {
  const drafts = (await readPosts()).filter((post) => post.data.draft === "true");
  const html = await (await render("/blog")).text();
  for (const draft of drafts) {
    assert.doesNotMatch(html, new RegExp(`href="/blog/${draft.slug}"`));
  }
  const missing = await render("/blog/this-slug-does-not-exist");
  assert.equal(missing.status, 404);
});

test("every post carries the metadata the article page needs", async () => {
  for (const post of await readPosts()) {
    assert.match(
      post.data.date ?? "",
      /^\d{4}-\d{2}-\d{2}$/,
      `${post.slug} needs a date: YYYY-MM-DD`,
    );
    assert.ok(post.data.title?.trim(), `${post.slug} needs a title`);
    assert.equal(
      post.slug,
      encodeURIComponent(post.slug),
      `${post.slug} needs a URL-safe file name`,
    );
  }
});

test("the notes are reachable from the site's navigation", async () => {
  const html = await (await render("/")).text();
  assert.match(html, /href="\/blog"/);
});

// The download page carried the argument for the product but not a word about
// using it, which is the shape of page that fails an AdSense review.
test("the CLOCK page explains how the app is actually used", async () => {
  const html = await (await render("/clock")).text();
  assert.match(html, /使い方/);
  for (const control of ["CLOCK MODE", "COLOR", "EFFECT", "PIN", "INFO"]) {
    assert.ok(html.includes(control), `${control} is missing from the guide`);
  }
  assert.match(html, /GREEN/);
  assert.match(html, /CORRUPT/);
  assert.match(html, /Windows 10 \/ 11/);
});

// SwiftCrop moved in from its own domain. The page has to carry the tool and
// enough of its own writing to be worth landing on.
test("the SwiftCrop page embeds the tool and explains it", async () => {
  const response = await render("/swiftcrop");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /src="\/swiftcrop-app\/index\.html"/);
  assert.match(html, /使い方/);
  for (const heading of ["出力サイズ", "フォーマットと品質", "保存方法"]) {
    assert.ok(html.includes(heading), `${heading} is missing from the guide`);
  }
  // swiftcrop.jp redirects here now, so this is the copy search should see.
  assert.doesNotMatch(html, /content="noindex/);
  assert.doesNotMatch(html, /swiftcrop\.jp/);
});

test("the SwiftCrop FAQ came across whole", async () => {
  const html = await (await render("/swiftcrop/faq")).text();
  for (const q of [
    "SwiftCropは無料で使えますか？",
    "画像はサーバーへ送信・保存されますか？",
    "ZIP保存と個別保存の違いは？",
    "AIの自動タグ付けやモデル学習もできますか？",
  ]) {
    assert.ok(html.includes(q), `${q} is missing`);
  }
  assert.match(html, /FAQPage/);
  assert.doesNotMatch(html, /privacy\.html|contact\.html/);
});

// COLOR RE:FINE followed SwiftCrop in. Its model is 215MB in eleven parts, so
// the pieces and the licence notices matter as much as the page does.
test("the COLOR RE:FINE pages carry the tool, the help and the notices", async () => {
  const page = await (await render("/color-refine")).text();
  assert.match(page, /src="\/color-refine-app\/index\.html"/);
  assert.match(page, /215MB/);
  // color-refine.com redirects here now.
  assert.doesNotMatch(page, /content="noindex/);

  const help = await (await render("/color-refine/help")).text();
  for (const q of ["写真はサーバーへ送信されますか？", "2回目以降もダウンロードされますか？"]) {
    assert.ok(help.includes(q), `${q} is missing`);
  }

  // Apache 2.0 requires the notice to travel with the work.
  const licenses = await (await render("/color-refine/licenses")).text();
  assert.match(licenses, /DDColor/);
  assert.match(licenses, /ONNX Runtime Web/);
  assert.match(licenses, /Apache License 2\.0/);
  assert.match(licenses, /MIT License/);
});

test("every MarutiBit game has a screen photographed for the machine of the day", async () => {
  const games = await readFile(new URL("../app/bit/games.ts", import.meta.url), "utf8");
  const ids = [...games.matchAll(/\{ id: "([a-z-]+)"/g)].map((match) => match[1]);
  assert.ok(ids.length >= 8, "the catalog should have been parsed");
  const shots = await readdir(new URL("../public/games/shots/", import.meta.url));
  for (const id of ids) {
    // A new game added to the catalog without running
    // scripts/capture-game-shots.mjs would show a broken image on /bit on
    // whichever day the date happened to pick it.
    assert.ok(shots.includes(`${id}.webp`), `missing screen shot for ${id}`);
  }
});

// The note section is about to go from three articles to a hundred, and what
// is cheap to change now is expensive to change then. The URL a post answers
// on, the dates it reports and the way the index is paged are pinned here
// rather than left to be discovered at article ninety.
test("a post can be renamed without moving, and updated: stays honest", async () => {
  for (const post of await readPosts()) {
    // A post called page.md would sit under /blog/page/2's route.
    assert.notEqual(post.slug, "page", "page.md is a reserved file name");
    assert.notEqual(post.data.slug, "page", post.slug + " claims a reserved slug");
    if (post.data.updated === undefined) continue;
    assert.match(
      post.data.updated,
      /^\d{4}-\d{2}-\d{2}$/,
      post.slug + ": updated must be YYYY-MM-DD",
    );
    assert.ok(
      post.data.updated >= post.data.date,
      post.slug + ": updated is earlier than the date it was published",
    );
  }
});

test("an article says when it was published and when it last changed", async () => {
  for (const post of await published()) {
    const slug = post.data.slug || post.slug;
    const changed = post.data.updated || post.data.date;
    const html = await (await render(`/blog/${slug}`)).text();
    assert.match(html, /"@type":"BlogPosting"/, `${post.slug} carries no article schema`);
    assert.ok(
      html.includes(`"datePublished":"${post.data.date}"`),
      `${post.slug} reports the wrong publication date`,
    );
    // The whole point of updated: - an edited post that still announced its
    // publication date would be telling Google to ignore the edit.
    assert.ok(
      html.includes(`"dateModified":"${changed}"`),
      `${post.slug} reports the wrong modified date`,
    );
    assert.ok(
      html.includes(`<link rel="canonical" href="https://marutilab.com/blog/${slug}">`),
      `${post.slug} has no canonical URL`,
    );
  }
});

test("the sitemap reports the last change, not the first publication", async () => {
  const xml = await (await render("/sitemap.xml")).text();
  for (const post of await published()) {
    const slug = post.data.slug || post.slug;
    const changed = post.data.updated || post.data.date;
    assert.ok(
      xml.includes(`<loc>https://marutilab.com/blog/${slug}</loc><lastmod>${changed}</lastmod>`),
      `${post.slug} is missing or stale in the sitemap`,
    );
  }
});

test("pages of the index that do not exist answer with a real 404", async () => {
  // Page one is /blog and always will be; /blog/page/2 onwards is the rest.
  const first = await render("/blog");
  assert.equal(first.status, 200);
  assert.ok((await first.text()).includes('href="/blog/'));

  // A soft 404 - a page that answers 200 and merely asks not to be indexed -
  // is still a page to everything that reads the site. These are not pages.
  for (const path of ["/blog/page/999", "/blog/page/abc", "/blog/page/-3"]) {
    assert.equal((await render(path)).status, 404, `${path} should be a 404`);
  }
  // /blog/page/1 is the one exception: the page it names does exist.
  const one = await render("/blog/page/1");
  assert.ok(one.status === 301 || one.status === 308, "page 1 should redirect");
  assert.equal(one.headers.get("location"), "/blog");
});

// The application is in review, and the two tools came from domains that
// carried their own advertising. COLOR RE:FINE still loaded the AdSense script
// and drew an empty "ADVERTISEMENT" box above the fold months after the move.
test("the embedded tools serve no advertising of their own", async () => {
  for (const app of ["swiftcrop-app", "color-refine-app"]) {
    const html = await readFile(
      new URL(`../public/${app}/index.html`, import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(html, /googlesyndication|adsbygoogle/, `${app} loads AdSense`);
    assert.doesNotMatch(html, /ad-placeholder|ADVERTISEMENT/, `${app} shows an empty ad slot`);
  }
});

// Reading a note is the moment someone is most likely to want to say thanks,
// and for five articles the only way to do it was one word among eleven in
// the footer.
test("a note ends with a way to buy the coffee", async () => {
  const [post] = await published();
  if (!post) return;
  const html = await (await render(`/blog/${post.data.slug || post.slug}`)).text();
  assert.match(html, /class="supportSection"/, "the support band is missing");
  assert.match(html, /コーヒーを一杯/);
  assert.match(html, /href="https:\/\/buymeacoffee\.com\/marutilab"/);
});
