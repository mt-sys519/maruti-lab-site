/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires a document navigation for local routes */
import type { Metadata } from "next";
import { formatDate, posts } from "./posts";
import { SiteFooter } from "../SiteFooter";

export const metadata: Metadata = {
  title: "LabNote",
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
        <p className="eyebrow">MARUTI LAB</p>
        <h1>LabNote</h1>
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
      <SiteFooter />
    </main>
  );
}
