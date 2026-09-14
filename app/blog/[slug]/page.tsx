/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires a document navigation for local routes */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDate, lastChanged, postBySlug, posts } from "../posts";

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
      modifiedTime: lastChanged(post),
      images: post.image
        ? [{ url: `https://marutilab.com${post.image}`, width: 1200, height: 630 }]
        : undefined,
    },
    twitter: post.image
      ? { card: "summary_large_image", images: [`https://marutilab.com${post.image}`] }
      : undefined,
  };
}

export default async function BlogPost({ params }: Props) {
  const { slug } = await params;
  const post = postBySlug(slug);
  if (!post) notFound();
  const others = posts.filter((other) => other.slug !== post.slug).slice(0, 3);
  // Written out here rather than left to the reader: a post that says when it
  // was published and when it was last touched is the difference between an
  // article that has been kept and one that has merely survived.
  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: lastChanged(post),
    inLanguage: "ja",
    mainEntityOfPage: `https://marutilab.com/blog/${post.slug}`,
    author: { "@type": "Person", name: "Maruti Lab" },
    publisher: { "@type": "Organization", name: "Maruti Lab" },
    ...(post.image ? { image: `https://marutilab.com${post.image}` } : {}),
    ...(post.tags.length ? { keywords: post.tags.join(", ") } : {}),
  };
  return (
    <main className="legalPage notePage">
      <header className="legalHeader">
        <a href="/">Maruti Lab</a>
        <a href="/blog">LabNote一覧</a>
      </header>
      <div className="noteSheet">
      <article className="postDocument">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
        <p className="eyebrow">
          LABNOTE / <time dateTime={post.date}>{formatDate(post.date)}</time>
        </p>
        <h1>{post.title}</h1>
        <p className="postMeta postMetaHead">
          {post.tags.map((tag) => (
            <b key={tag}>{tag}</b>
          ))}
          <i>約{post.minutes}分</i>
          {post.updated && (
            <i>
              <time dateTime={post.updated}>{formatDate(post.updated)}</time>に更新
            </i>
          )}
        </p>
        {/* The body is Markdown written by the site owner and rendered at
            build time, so there is no third-party HTML in here. */}
        <div className="postBody" dangerouslySetInnerHTML={{ __html: post.html }} />
      </article>
      {others.length > 0 && (
        <nav className="postFooter" aria-label="ほかの記事">
          <p className="eyebrow">OTHER LABNOTES</p>
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
      </div>
      <footer>
        <div className="footerBrand">Maruti Lab</div>
        <div className="footerLinks"><a href="/">Works</a><a href="/bit">MarutiBit</a><a href="/4track">4TRACK</a><a href="/blog">LabNote</a><a href="https://x.com/maruti_lab" target="_blank" rel="noreferrer">X / @maruti_lab</a><a href="https://buymeacoffee.com/marutilab" target="_blank" rel="noreferrer">Coffee</a><a href="/about">About</a><a href="/contact">Contact</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/disclaimer">Disclaimer</a></div>
        <small>© 2026 Maruti Lab</small>
      </footer>
    </main>
  );
}
