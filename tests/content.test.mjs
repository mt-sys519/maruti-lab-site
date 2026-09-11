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
  const missing = await (await render("/blog/this-slug-does-not-exist")).text();
  assert.match(missing, /記事が見つかりません/);
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
