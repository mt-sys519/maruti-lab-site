// A writing desk for the notes, run with `npm run write`.
//
// It is a plain Node server, not a route in the site: it never ships, so there
// is nothing to put a password on. It reads and writes the same Markdown files
// the site builds from, so the articles stay in git.
import { createServer } from "node:http";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { extname, join } from "node:path";
import { marked } from "marked";

const root = fileURLToPath(new URL("..", import.meta.url));
const postsDir = join(root, "content", "posts");
const imagesDir = join(root, "public", "blog");
const PORT = Number(process.env.PORT || 4455);

marked.setOptions({ gfm: true, breaks: false });

// toISOString() is UTC, which writes yesterday's date all evening in Japan.
const today = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const safeSlug = (value) =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

function parse(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  const data = {};
  for (const line of (match?.[1] ?? "").split(/\r?\n/)) {
    const at = line.indexOf(":");
    if (at !== -1) data[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return { data, body: source.slice(match?.[0].length ?? 0) };
}

async function listPosts() {
  await mkdir(postsDir, { recursive: true });
  const names = (await readdir(postsDir)).filter((n) => n.endsWith(".md"));
  const posts = await Promise.all(
    names.map(async (name) => {
      const { data, body } = parse(await readFile(join(postsDir, name), "utf8"));
      return {
        slug: name.replace(/\.md$/, ""),
        title: data.title || name,
        date: data.date || "",
        // Stored as [a, b]; the field edits the bare list, and savePost puts
        // the brackets back. Handing over the raw value doubled them.
        tags: (data.tags || "").replace(/^\[|\]$/g, ""),
        description: data.description || "",
        draft: data.draft === "true",
        body,
      };
    }),
  );
  return posts.sort((a, b) => (a.date < b.date ? 1 : -1));
}

async function savePost(post) {
  const slug = safeSlug(post.slug);
  if (!slug) throw new Error("ファイル名（slug）を入れてください");
  await mkdir(postsDir, { recursive: true });
  const front = [
    "---",
    `title: ${post.title || slug}`,
    `date: ${post.date || today()}`,
    post.description ? `description: ${post.description}` : null,
    post.tags ? `tags: [${post.tags}]` : null,
    post.draft ? "draft: true" : null,
    "---",
    "",
  ]
    .filter((line) => line !== null)
    .join("\n");
  const file = join(postsDir, `${slug}.md`);
  await writeFile(file, `${front}${post.body.replace(/\r\n/g, "\n").trim()}\n`, "utf8");
  return { slug, file };
}

const json = (res, body, status = 200) => {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(page);
    }
    if (req.method === "GET" && url.pathname === "/api/posts") {
      return json(res, await listPosts());
    }
    if (req.method === "POST" && url.pathname === "/api/save") {
      const post = JSON.parse((await readBody(req)).toString("utf8"));
      return json(res, await savePost(post));
    }
    if (req.method === "POST" && url.pathname === "/api/preview") {
      const { body } = JSON.parse((await readBody(req)).toString("utf8"));
      return json(res, { html: marked.parse(body || "") });
    }
    if (req.method === "POST" && url.pathname === "/api/image") {
      // Dropping a picture onto the editor puts it in public/blog/ and hands
      // back the Markdown line, so images never need a file manager.
      const name = safeSlug(url.searchParams.get("name")?.replace(/\.[^.]+$/, ""));
      const ext = (extname(url.searchParams.get("name") || "") || ".png").toLowerCase();
      if (!/^\.(png|jpe?g|webp|gif|svg)$/.test(ext)) throw new Error("画像ではありません");
      await mkdir(imagesDir, { recursive: true });
      let file = `${name || "image"}${ext}`;
      let n = 2;
      while (existsSync(join(imagesDir, file))) file = `${name || "image"}-${n++}${ext}`;
      await writeFile(join(imagesDir, file), await readBody(req));
      return json(res, { markdown: `![](/blog/${file})` });
    }
    res.writeHead(404).end("not found");
  } catch (error) {
    json(res, { error: String(error.message || error) }, 400);
  }
});

const page = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<title>ノートを書く — Maruti Lab</title>
<style>
:root{--paper:#f2f0e9;--ink:#1c211e;--muted:#686d68;--line:#c8c7bf;--verm:#ad4434}
*{box-sizing:border-box}
body{margin:0;height:100vh;display:grid;grid-template-columns:230px minmax(0,1fr) minmax(0,1fr);
font-family:"Yu Gothic UI","Hiragino Kaku Gothic ProN",sans-serif;background:var(--paper);color:var(--ink)}
aside{border-right:1px solid var(--line);overflow-y:auto;padding:18px 0}
aside h1{font-size:11px;letter-spacing:.18em;color:var(--muted);margin:0 0 14px;padding:0 18px;font-weight:500}
aside button.item{display:block;width:100%;text-align:left;padding:12px 18px;border:0;background:none;cursor:pointer;font:inherit;font-size:13px;line-height:1.5;border-top:1px solid var(--line)}
aside button.item:hover{background:#e8e4da}
aside button.item.on{background:#e2ded2}
aside .meta{display:block;font-size:10px;letter-spacing:.1em;color:var(--muted);margin-top:5px}
aside .new{margin:0 18px 16px;padding:10px;width:calc(100% - 36px);border:1px solid var(--ink);background:none;font:inherit;font-size:12px;cursor:pointer}
main{display:flex;flex-direction:column;border-right:1px solid var(--line);min-width:0}
.fields{padding:16px 20px;border-bottom:1px solid var(--line);display:grid;gap:10px}
.fields input[type=text]{width:100%;padding:8px 0;border:0;border-bottom:1px solid var(--line);background:none;font:inherit;color:var(--ink)}
.fields input:focus{outline:none;border-color:var(--verm)}
.fields .title{font-size:19px}
.row{display:flex;gap:14px;align-items:center;font-size:11px;color:var(--muted)}
.row input[type=text]{font-size:12px}
.row label{display:flex;align-items:center;gap:6px;white-space:nowrap}
textarea{flex:1;padding:22px 20px;border:0;background:none;resize:none;font:400 14px/1.9 "Yu Gothic UI",monospace;color:var(--ink)}
textarea:focus{outline:none}
.bar{display:flex;align-items:center;gap:14px;padding:12px 20px;border-top:1px solid var(--line);font-size:11px;color:var(--muted)}
.bar button{padding:9px 20px;border:1px solid var(--ink);background:var(--ink);color:var(--paper);font:inherit;font-size:12px;cursor:pointer}
.bar button.ghost{background:none;color:var(--ink)}
.bar .status{margin-left:auto}
.preview{overflow-y:auto;padding:34px 30px;font-size:14px;line-height:2.05;color:#333937;min-width:0}
.preview h1{font-size:26px;font-weight:400;margin:0 0 22px}
.preview h2{font-size:18px;font-weight:500;margin:44px 0 16px;padding-top:20px;border-top:1px solid var(--line)}
.preview h3{font-size:15px;margin:30px 0 12px}
.preview img{max-width:100%;border:1px solid var(--line)}
.preview pre{background:#050806;color:#d8e6da;padding:16px 18px;overflow-x:auto;font-size:12px;line-height:1.8}
.preview code{background:#e8e4da;padding:2px 5px;font-size:12.5px}
.preview pre code{background:none;padding:0}
.preview blockquote{margin:0 0 22px;padding-left:18px;border-left:2px solid var(--line);color:var(--muted)}
.preview ul{list-style:disc;padding-left:1.4em}.preview ol{list-style:decimal;padding-left:1.4em}
.preview a{color:var(--verm)}
.drop{outline:2px dashed var(--verm);outline-offset:-8px}
</style></head><body>
<aside>
  <h1>NOTES</h1>
  <button class="new" id="new">＋ 新しい記事</button>
  <div id="list"></div>
</aside>
<main>
  <div class="fields">
    <input class="title" id="title" type="text" placeholder="タイトル">
    <div class="row">
      <label>ファイル名 <input id="slug" type="text" placeholder="browser-only" size="18"></label>
      <label>日付 <input id="date" type="text" size="10"></label>
      <label><input id="draft" type="checkbox" checked> 下書き</label>
    </div>
    <div class="row">
      <label style="flex:1">タグ <input id="tags" type="text" placeholder="制作記, SwiftCrop" style="flex:1"></label>
    </div>
    <div class="row">
      <label style="flex:1">説明 <input id="description" type="text" placeholder="空でも本文から自動で作られます" style="flex:1"></label>
    </div>
  </div>
  <textarea id="body" placeholder="ここから本文。画像はドラッグして落とすと入ります。"></textarea>
  <div class="bar">
    <button id="save">保存（Ctrl+S）</button>
    <button class="ghost" id="publish">下書きを外して保存</button>
    <span class="status" id="status"></span>
  </div>
</main>
<div class="preview" id="preview"></div>
<script type="module">
const $ = (id) => document.getElementById(id);
const fields = ["title","slug","date","tags","description"];
let current = null, timer = null;

const today = () => {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
};

async function loadList(selectSlug) {
  const posts = await (await fetch("/api/posts")).json();
  $("list").innerHTML = "";
  for (const post of posts) {
    const button = document.createElement("button");
    button.className = "item" + (post.slug === selectSlug ? " on" : "");
    button.innerHTML = '<span></span><span class="meta"></span>';
    button.firstChild.textContent = post.title;
    button.lastChild.textContent = (post.date || "") + (post.draft ? " ・下書き" : " ・公開");
    button.onclick = () => open(post);
    $("list").append(button);
  }
  return posts;
}

function open(post) {
  current = post.slug;
  $("title").value = post.title === post.slug + ".md" ? "" : post.title;
  $("slug").value = post.slug;
  $("date").value = post.date || today();
  $("tags").value = post.tags;
  $("description").value = post.description;
  $("draft").checked = post.draft;
  $("body").value = post.body.trim();
  preview();
  loadList(post.slug);
}

function blank() {
  current = null;
  for (const id of fields) $(id).value = "";
  $("date").value = today();
  $("draft").checked = true;
  $("body").value = "";
  preview();
  $("title").focus();
  loadList(null);
}

async function preview() {
  const res = await fetch("/api/preview", {
    method: "POST",
    body: JSON.stringify({ body: $("body").value }),
  });
  $("preview").innerHTML = (await res.json()).html;
}

async function save(publish) {
  const slug = $("slug").value.trim() || $("date").value;
  const payload = {
    slug,
    title: $("title").value.trim(),
    date: $("date").value.trim(),
    tags: $("tags").value.trim(),
    description: $("description").value.trim(),
    draft: publish ? false : $("draft").checked,
    body: $("body").value,
  };
  const res = await fetch("/api/save", { method: "POST", body: JSON.stringify(payload) });
  const result = await res.json();
  if (result.error) { $("status").textContent = "⚠ " + result.error; return; }
  if (publish) $("draft").checked = false;
  $("slug").value = result.slug;
  current = result.slug;
  $("status").textContent = "保存しました " + new Date().toLocaleTimeString("ja-JP");
  loadList(result.slug);
}

$("body").addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(preview, 250);
});
$("save").onclick = () => save(false);
$("publish").onclick = () => save(true);
$("new").onclick = blank;
addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); save(false); }
});

const editor = $("body");
editor.addEventListener("dragover", (e) => { e.preventDefault(); editor.classList.add("drop"); });
editor.addEventListener("dragleave", () => editor.classList.remove("drop"));
editor.addEventListener("drop", async (e) => {
  e.preventDefault();
  editor.classList.remove("drop");
  for (const file of e.dataTransfer.files) {
    const res = await fetch("/api/image?name=" + encodeURIComponent(file.name), {
      method: "POST",
      body: await file.arrayBuffer(),
    });
    const result = await res.json();
    if (result.error) { $("status").textContent = "⚠ " + result.error; continue; }
    const at = editor.selectionStart;
    editor.value = editor.value.slice(0, at) + "\\n\\n" + result.markdown + "\\n\\n" + editor.value.slice(at);
  }
  preview();
});

blank();
await loadList(null);
</script></body></html>`;

server.listen(PORT, () => {
  console.log(`\n  ノートを書く → http://localhost:${PORT}\n`);
  console.log(`  保存先: content/posts/`);
  console.log(`  画像:   public/blog/\n`);
});
