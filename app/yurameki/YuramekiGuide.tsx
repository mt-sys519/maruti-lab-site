/**
 * What YURAMEKI is, in plain words, underneath the studio.
 *
 * The studio is the whole of /yurameki, and a workspace is all it is: its own
 * copy is a tagline and the labels on its controls. Someone arriving from a
 * search has never heard the name and reads none of that as an answer to
 * "what is this thing", so the answer is written out here, below the work
 * rather than in front of it.
 */
export default function YuramekiGuide() {
  return (
    <section className="guide" aria-labelledby="guide-title">
      <div className="guideHead">
        <p className="eyebrow">ABOUT YURAMEKI</p>
        <h2 id="guide-title">YURAMEKIについて</h2>
        <p>
          イラストや写真の一部だけを選んで動かし、GIF・APNG・アニメーションWebP・MP4として
          書き出せる、無料のブラウザツールです。会員登録は要りません。
        </p>
      </div>
      <div className="guideBody">
        <ol className="guideSteps">
          <li>
            <b>一</b>
            <span>画像を置く</span>
            <small>手元のイラストや写真を選ぶか、そのまま画面へドロップします。</small>
          </li>
          <li>
            <b>二</b>
            <span>動かす場所を囲む</span>
            <small>髪、衣、水面、灯り。動かしたいところだけを点で囲みます。囲まなかったところは止まったままです。</small>
          </li>
          <li>
            <b>三</b>
            <span>形式を選んで書き出す</span>
            <small>大きさと形式を選んで生成する。保存も共有も、この端末の中で終わります。</small>
          </li>
        </ol>
        <dl className="guideFacts">
          <div>
            <dt>動きの種類</dt>
            <dd>呼吸・たなびき・灯り・波紋の4種類。範囲はいくつでも置けて、場所ごとに速さや深さを変えられます。</dd>
          </div>
          <div>
            <dt>書き出せる形式</dt>
            <dd>GIF、APNG、アニメーションWebP、MP4。SNSへ上げるならMP4が扱いやすい形式です。</dd>
          </div>
          <div>
            <dt>大きさ</dt>
            <dd>512・720・1080。1080はプレビューを引き伸ばさず、元画像から作り直します。</dd>
          </div>
          <div>
            <dt>スマートフォン</dt>
            <dd>使えます。画面下の「画像／動き／保存」で操作を切り替えます。</dd>
          </div>
          <div>
            <dt>画像の扱い</dt>
            <dd>読み込み・加工・書き出しはすべてブラウザの中で行われ、画像が外部へ送信されることはありません。</dd>
          </div>
        </dl>
        <p className="guideMore">
          <a href="/yurameki/about">YURAMEKIについて詳しく</a>
          <a href="/yurameki/faq">よくある質問</a>
          <a href="/yurameki/gallery">動きのサンプル</a>
        </p>
      </div>
    </section>
  );
}
