/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires a document navigation for local routes */
import type { Metadata } from "next";
import { formatDate, posts } from "./posts";

export const metadata: Metadata = {
  title: "ノート",
  description:
    "Maruti Labの制作記。ブラウザだけで動く道具をどう作っているか、何を選んで、どこで苦労したかを書いています。",
  alternates: { canonical: "https://marutilab.com/blog" },
};

export default function BlogIndex() {
  return (
    <main className="legalPage notePage">
      <header className="legalHeader">
        <a href="/">Maruti Lab</a>
        <a href="/">トップへ戻る</a>
      </header>
      <div className="noteSheet blogIndexSheet">
      <div className="blogIndex">
        <p className="eyebrow">LAB NOTE / MARUTI LAB</p>
        <h1>ノート</h1>
        <p className="blogLead">
          ブラウザだけで動く道具と、小さなゲームを作っています。ここには、その作り方と、途中で選んだこと・苦労したことを書いていきます。
        </p>
        {posts.length === 0 ? (
          <p className="blogEmpty">最初の記事を準備しています。</p>
        ) : (
          <ol className="postList">
            {posts.map((post) => (
              <li key={post.slug}>
                <a href={`/blog/${post.slug}`}>
                  <time dateTime={post.date}>{formatDate(post.date)}</time>
                  <h2>{post.title}</h2>
                  <p>{post.description}</p>
                  <span className="postMeta">
                    {post.tags.map((tag) => (
                      <b key={tag}>{tag}</b>
                    ))}
                    <i>約{post.minutes}分</i>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        )}
      </div>
      </div>
      <footer>
        <div className="footerBrand">Maruti Lab</div>
        <div className="footerLinks"><a href="/">Works</a><a href="/bit">MarutiBit</a><a href="/4track">4TRACK</a><a href="/blog">ノート</a><a href="https://x.com/maruti_lab" target="_blank" rel="noreferrer">X / @maruti_lab</a><a href="https://buymeacoffee.com/marutilab" target="_blank" rel="noreferrer">Coffee</a><a href="/about">About</a><a href="/contact">Contact</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/disclaimer">Disclaimer</a></div>
        <small>© 2026 Maruti Lab</small>
      </footer>
    </main>
  );
}
