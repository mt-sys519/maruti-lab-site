/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires a document navigation for local routes */
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";

// Everything under /blog that does not exist ends here, with a real 404 rather
// than a page that answers 200 and merely asks not to be indexed. A soft 404
// is a page as far as anything reading the site is concerned, and at a hundred
// articles the mistyped and the retired would quietly become a section of
// their own.
export default function NoteNotFound() {
  return (
    <main className="legalPage notePage">
      <SiteHeader />
      <article className="legalDocument">
        <p className="eyebrow">404</p>
        <h1>そのページはありません</h1>
        <p>
          URLが変わったか、まだ公開されていない記事です。
          <a href="/blog">LabNote一覧</a>から探してみてください。
        </p>
      </article>
      <SiteFooter />
    </main>
  );
}
