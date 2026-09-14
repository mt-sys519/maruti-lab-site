/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires a document navigation for local routes */
import type { Metadata } from "next";
import { NoteIndex } from "../../NoteIndex";
import { SiteFooter } from "../../../SiteFooter";
import { pageCount, pagePath } from "../../posts";

type Props = { params: Promise<{ page: string }> };

// Page one is /blog, so /blog/page/1 is not a URL the site produces. It is
// still reachable by hand, and rather than answer it twice it points at the
// canonical one. Anything past the last page is a page that does not exist.
const parse = (value: string) => {
  const page = Number(value);
  return Number.isInteger(page) && page >= 2 && page <= pageCount ? page : null;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = parse((await params).page);
  if (!page) return { title: "LabNote", robots: { index: false, follow: true } };
  return {
    title: `LabNote（${page}ページ目）`,
    description:
      "Maruti Labの制作記。ブラウザだけで動く道具をどう作っているか、何を選んで、どこで苦労したかを書いています。",
    alternates: { canonical: `https://marutilab.com${pagePath(page)}` },
  };
}

export default async function BlogIndexPage({ params }: Props) {
  const { page: raw } = await params;
  const page = parse(raw);
  if (!page) {
    return (
      <main className="legalPage notePage">
        <header className="legalHeader">
          <a href="/">Maruti Lab</a>
          <a href="/blog">LabNote一覧</a>
        </header>
        <article className="legalDocument">
          <p className="eyebrow">404</p>
          <h1>そのページはありません</h1>
          <p>
            記事が増えるとページが増えます。いまは{pageCount}ページまでです。
            <a href="/blog">LabNote一覧</a>から探してみてください。
          </p>
        </article>
        <SiteFooter />
      </main>
    );
  }
  return <NoteIndex page={page} />;
}
