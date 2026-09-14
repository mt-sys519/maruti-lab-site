/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires a document navigation for local routes */
import { formatDate, pageCount, pagePath, postsOnPage } from "./posts";
import { SiteFooter } from "../SiteFooter";

// One component behind both /blog and /blog/page/2, so the two can never drift
// into looking like different sections of the site.
export function NoteIndex({ page }: { page: number }) {
  const shown = postsOnPage(page);
  const previous = page > 1 ? page - 1 : null;
  const next = page < pageCount ? page + 1 : null;
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
          {shown.length === 0 ? (
            <p className="blogEmpty">最初の記事を準備しています。</p>
          ) : (
            <ol className="postList">
              {shown.map((post) => (
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
          {pageCount > 1 && (
            <nav className="notePager" aria-label="ページ送り">
              {previous ? (
                <a href={pagePath(previous)} rel="prev">
                  ← 新しい記事
                </a>
              ) : (
                <span />
              )}
              <small>
                {page} / {pageCount}
              </small>
              {next ? (
                <a href={pagePath(next)} rel="next">
                  古い記事 →
                </a>
              ) : (
                <span />
              )}
            </nav>
          )}
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
