/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires a document navigation for local routes */
import type { Metadata } from "next";
import { formatDate, postBySlug, posts } from "../posts";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = postBySlug((await params).slug);
  if (!post) return { title: "記事が見つかりません" };
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `https://marutilab.com/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      publishedTime: post.date,
    },
  };
}

export default async function BlogPost({ params }: Props) {
  const { slug } = await params;
  const post = postBySlug(slug);
  if (!post) {
    return (
      <main className="legalPage">
        <header className="legalHeader">
          <a href="/">Maruti Lab</a>
          <a href="/blog">ノート一覧</a>
        </header>
        <article className="legalDocument">
          <p className="eyebrow">404</p>
          <h1>記事が見つかりません</h1>
          <p>
            URLが変わったか、まだ公開されていない記事です。
            <a href="/blog">ノート一覧</a>から探してみてください。
          </p>
        </article>
      </main>
    );
  }
  const others = posts.filter((other) => other.slug !== post.slug).slice(0, 3);
  return (
    <main className="legalPage">
      <header className="legalHeader">
        <a href="/">Maruti Lab</a>
        <a href="/blog">ノート一覧</a>
      </header>
      <article className="postDocument">
        <p className="eyebrow">
          NOTE / <time dateTime={post.date}>{formatDate(post.date)}</time>
        </p>
        <h1>{post.title}</h1>
        <p className="postMeta postMetaHead">
          {post.tags.map((tag) => (
            <b key={tag}>{tag}</b>
          ))}
          <i>約{post.minutes}分</i>
        </p>
        {/* The body is Markdown written by the site owner and rendered at
            build time, so there is no third-party HTML in here. */}
        <div className="postBody" dangerouslySetInnerHTML={{ __html: post.html }} />
      </article>
      {others.length > 0 && (
        <nav className="postFooter" aria-label="ほかの記事">
          <p className="eyebrow">OTHER NOTES</p>
          <ul>
            {others.map((other) => (
              <li key={other.slug}>
                <a href={`/blog/${other.slug}`}>
                  <time dateTime={other.date}>{formatDate(other.date)}</time>
                  <span>{other.title}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </main>
  );
}
