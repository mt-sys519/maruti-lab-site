/* eslint-disable @next/next/no-html-link-for-pages -- vinext requires document navigation for local routes */
import type { Metadata } from "next";
import content from "../crContent.json";

const title = "第三者ライセンス — COLOR RE:FINE";

export const metadata: Metadata = {
  title,
  description:
    "COLOR RE:FINEが利用しているオープンソースソフトウェアとAIモデルの権利表示。DDColor（Apache License 2.0）とONNX Runtime Web（MIT License）。",
  alternates: { canonical: "https://marutilab.com/color-refine/licenses" },
};

// Apache 2.0 requires the notice to travel with the work, so this page moves
// with the tool rather than being left behind on the old domain.
export default function ColorRefineLicensesPage() {
  const { notices } = content;
  return (
    <main className="legalPage">
      <header className="legalHeader">
        <a href="/">Maruti Lab</a>
        <a href="/color-refine">COLOR RE:FINEへ戻る</a>
      </header>
      <article className="legalDocument">
        <p className="eyebrow">THIRD-PARTY NOTICES</p>
        <h1>第三者ライセンス</h1>
        <p>{notices.intro}</p>
        {notices.items.map((item) => (
          <section key={item.name}>
            <h2>{item.name}</h2>
            {item.paras.map((para) => (
              <p key={para}>{para}</p>
            ))}
            <ul>
              {item.meta.map(([label, value]) => (
                <li key={label}>
                  {label}：<span dangerouslySetInnerHTML={{ __html: value }} />
                </li>
              ))}
            </ul>
          </section>
        ))}
        <section>
          <h2>ライセンス全文</h2>
          <ul>
            <li><a href="/color-refine-app/licenses/DDColor-Apache-2.0.txt">Apache License 2.0（DDColor）</a></li>
            <li><a href="/color-refine-app/licenses/ONNX-Runtime-MIT.txt">MIT License（ONNX Runtime Web）</a></li>
          </ul>
        </section>
        <section>
          <h2>免責</h2>
          <p>{notices.disclaimer}</p>
        </section>
      </article>
      <footer>
        <div className="footerBrand">Maruti Lab</div>
        <div className="footerLinks"><a href="/color-refine">COLOR RE:FINE</a><a href="/">Works</a><a href="/about">About</a><a href="/contact">Contact</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div>
        <small>© 2026 Maruti Lab</small>
      </footer>
    </main>
  );
}
