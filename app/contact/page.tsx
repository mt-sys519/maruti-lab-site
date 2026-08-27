/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires a document navigation for local routes */
import type { Metadata } from "next";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: "お問い合わせ",
  description: "Maruti Labへのご質問・ご要望・不具合のご報告は、こちらのフォームからお送りください。",
};

export default function ContactPage() {
  return (
    <main className="legalPage">
      <header className="legalHeader"><a href="/">Maruti Lab</a><a href="/">トップへ戻る</a></header>
      <article className="legalDocument">
        <p className="eyebrow">CONTACT / 2026</p>
        <h1>お問い合わせ</h1>
        <p className="contactIntro">ご質問・ご要望・不具合のご報告など、以下のフォームからお送りください。</p>
        <ContactForm />
      </article>
    </main>
  );
}
