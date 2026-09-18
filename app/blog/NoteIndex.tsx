/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires a document navigation for local routes */
import { formatDate, pageCount, pagePath, postsOnPage } from "./posts";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";
import { NoteMark } from "../icons";
import { NoteTitle } from "./NoteTitle";

// One component behind both /blog and /blog/page/2, so the two can never drift
// into looking like different sections of the site.
export function NoteIndex({ page }: { page: number }) {
  const shown = postsOnPage(page);
  const previous = page > 1 ? page - 1 : null;
  const next = page < pageCount ? page + 1 : null;
  return (
    <main className="legalPage notePage">
      <SiteHeader />
      <div className="noteSheet blogIndexSheet">
        <div className="blogIndex">
          <h1 className="notesMark">
            <span className="notesMarkIcon" aria-hidden="true"><NoteMark /></span>
            <span className="notesMarkWord">LabNote</span>
          </h1>
          <p className="notesCatch">つくる途中の考えごと。</p>
          <p className="blogLead">
            ブラウザだけで動く道具と、小さなゲームを作っています。ここには、その作り方と、途中で選んだこと・苦労したことを書いていきます。
          </p>
          {shown.length === 0 ? (
            <p className="blogEmpty">最初の記事を準備しています。</p>
          ) : (
            <ol className="postGrid">
              {/* The share cards are the title set in type, so putting one
                  on the card and the title under it printed the same words
                  twice. The frame stays and the words inside it are the
                  page's own - which is also what the highlighter needs to
                  have something to run across. */}
              {shown.map((post) => (
                <li key={post.slug}>
                  <a href={`/blog/${post.slug}`}>
                    <span className="postCard">
                      <span className="postCardKind">LABNOTE</span>
                      <h2><NoteTitle text={post.title} /></h2>
                    </span>
                    <span className="postCardMeta">
                      <time dateTime={post.date}>{formatDate(post.date)}</time>
                      <i>約{post.minutes}分</i>
                    </span>
                    {post.tags.length > 0 && (
                      <span className="postTags">
                        {post.tags.map((tag) => (
                          <b key={tag}>{tag}</b>
                        ))}
                      </span>
                    )}
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
