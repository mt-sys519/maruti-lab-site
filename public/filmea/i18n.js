// FILMEA in English: the button in the top bar switches the screen between Japanese and English.
//
// The page and app.js stay written in Japanese. In English, every Japanese string on the screen (text,
// title, aria-label and data-tip) is looked up here and swapped for its English, and a MutationObserver
// does the same for whatever app.js writes later (tabs, states, toasts), before it is painted. Switching
// back puts the Japanese each node had. The guide, FAQ and licence pages are not translated here.
//
// The first visit follows the browser's language, except for crawlers, which keep the Japanese page;
// a choice made with the button is remembered.
(() => {
  const KEY = 'filmea-lang';

  const EN = {
    // top bar and start screen
    'アプリとして追加': 'Add as an app',
    '明るい画面 / 暗い画面': 'Light / dark screen',
    '保存': 'Save',
    '写真をえらぶ／ここにドロップ': 'Choose a photo / drop it here',
    '写真はアップロードされず、この端末の中だけで処理します': 'Your photo is never uploaded. Everything happens on this device.',
    'サンプルで試す': 'Try a sample',
    '自分の写真をひらく': 'Open your own photo',
    'サンプル': 'Samples',
    // the stage and the dock
    '元の色': 'Original',
    '写真を長押しすると元の色': 'Press and hold the photo to see the original',
    '左右で比べる': 'Compare side by side',
    '押している間だけ元の色': 'Original while pressed',
    '押している間だけ元の色（Space）': 'Original while pressed (Space)',
    '効き具合': 'Strength',
    'トリミング': 'Crop',
    'トリミング（回転・角度・拡大）': 'Crop (rotate, straighten, zoom)',
    'ヒストグラム': 'Histogram',
    '90°回転': 'Rotate 90°',
    '窓の向き': 'Window direction',
    '窓の向き（横／縦）': 'Window direction (landscape / portrait)',
    '窓の向き：横（押すと縦）': 'Window: landscape (tap for portrait)',
    '窓の向き：縦（押すと横）': 'Window: portrait (tap for landscape)',
    '角度': 'Angle',
    'ドラッグで角度（← → で 0.1°）': 'Drag to straighten (← → for 0.1°)',
    'リセット': 'Reset',
    '完了': 'Done',
    '写真、または .cube / HaldCLUT / .lut16 をここに': 'Drop a photo, or a .cube / HaldCLUT / .lut16 file',
    // LOOKS
    '目的で選ぶ': 'Choose by subject',
    '系統': 'Family',
    '系統で選ぶ': 'Choose by family',
    '前へ': 'Previous',
    '次へ': 'Next',
    '人物': 'People',
    '風景': 'Scenery',
    '街': 'Street',
    '食事': 'Food',
    'モノクロ': 'Mono',
    'フィルム': 'Film',
    '気分': 'Mood',
    '赤': 'Red',
    '陰影': 'Shadow',
    '手持ち': 'Yours',
    '手持ちのLUT': 'Your LUTs',
    'ドロップした LUT です。ページを閉じると消えます': 'The LUTs you dropped. They go when you close the page.',
    // the purposes' notes (app.js PURPOSES)
    '肌がやわらかく明るく見える色。9系統から集めました': 'Soft, bright skin. Gathered from all nine families',
    '空の青と緑が映える色': 'Makes blue sky and greenery shine',
    '街のスナップに合う、硬めで渋い色': 'Crisp, muted looks for street snaps',
    'あたたかく明るい、おいしそうに見える色': 'Warm and bright, to make food look delicious',
    '白黒。やわらかいものから硬いものまで': 'Black and white, from soft to hard',
    '褪せた色、クロス現像、セピア。昔のフィルムやプリントの風合い': 'Faded colour, cross processing, sepia. The feel of old film and prints',
    '朝の青、夢のアンバー、染めた色。気分で選ぶ色': 'Morning blue, dreamy amber, tinted colour. Looks to pick by mood',
    // the groups' notes (presets.json)
    'フィルムの名前がついた色。リバーサル、ネガ、映画用まで': 'Looks named after film: slide, negative and motion picture stock',
    '明るさと透明感をつくる、雰囲気重視の色': 'Bright, airy looks made for atmosphere',
    '朝の青、夢のアンバー。気分で選ぶ色': 'Morning blue, dreamy amber. Looks to pick by mood',
    '映像寄りの落ち着いた色と、深いモノクロ': 'Calm, cinematic colour and deep mono',
    '素直な発色と、硬軟2つのモノクロ': 'Honest colour, and a soft and a hard mono',
    '肌、風景、忠実。用途で選ぶ定番の色': 'Skin, landscape, faithful. Standard looks picked by use',
    'スナップ向きのポジとネガ、硬軟そろったモノクロ': 'Slide and negative for snaps, and mono from soft to hard',
    '濃い青空と緑が基準。和の色、古いプリント、金色まで': 'Built on deep blue sky and green: Japanese tones, old prints, even gold',
    '遊び心のある色と、控えめな定番の色': 'Playful colour and understated standards',
    'どの色も FILMEA が独自に作ったものです。撮って出しの写真に当てると、いちばん本来の色に近づきます。': 'Every look is FILMEA\'s own. They come closest to their intended colour on photos straight out of the camera.',
    // the looks' descriptions (presets.json, shown on hover)
    '濃い空と緑、締まった中間調': 'Deep sky and green, firm midtones',
    '肌と明るい所がやわらかい': 'Soft skin and highlights',
    '色を抑えた渋い発色、硬めの影': 'Muted, subdued colour with firm shadows',
    '人物向けのネガ調、やや硬め': 'Portrait negative look, slightly firm',
    '人物向けのネガ調、軟らかく穏やか': 'Portrait negative look, soft and gentle',
    '赤みの影と硬い階調、スナップ向き': 'Reddish shadows and firm tones, for snaps',
    '低彩度・低コントラストの映画調': 'Low-saturation, low-contrast cinema look',
    '銀残し。色が抜けた硬い調子': 'Bleach bypass. Drained colour, hard tones',
    '締まった黒と滑らかなモノクロ': 'Mono with firm blacks and smooth tones',
    '素直なモノクロ': 'Plain mono',
    'セピア': 'Sepia',
    '自然な色に少しだけメリハリ': 'Natural colour with a little punch',
    '琥珀色の影、やわらかい懐かしさ': 'Amber shadows, a soft nostalgia',
    '肌が明るく、やわらかく': 'Bright, soft skin',
    '彩度を抑えた落ち着いた色': 'Calm, low-saturation colour',
    '鮮やかでメリハリのある色': 'Vivid, punchy colour',
    '深く濃い鮮やかさ': 'Deep, rich vividness',
    'シアンの空と淡いトーン': 'Cyan sky and pale tones',
    'くすみを帯びたやさしいフィルム調': 'A gentle, slightly dusty film look',
    '澄んだ青と軽いトーン': 'Clear blue and light tones',
    '白っぽくかすんだ、くすみ系': 'Whitish, hazy and dusty',
    '明るく透明感のある': 'Bright and airy',
    'やわらかなアンバーの光': 'Soft amber light',
    '朝の空気のような青緑': 'Teal like morning air',
    '色が弾ける明るい鮮やかさ': 'Bright, popping colour',
    '明るく開けた休日の光': 'Bright, open holiday light',
    '濃い色と沈んだ明るさ': 'Dense colour, subdued brightness',
    '光と影を強めた重い調子': 'Heavy tones with strong light and shadow',
    '色を落とした静かな調子': 'Quiet, desaturated tones',
    '色が抜けた硬めの調子': 'Drained colour, firm tones',
    'くすんだピンクと青': 'Dusty pink and blue',
    '淡く色が抜けた': 'Pale and washed out',
    '青に寄せたクールな色': 'Cool colour leaning blue',
    'おもちゃカメラのような色': 'Like a toy camera',
    '色を残したセピア': 'Sepia with some colour left',
    '青く染めた': 'Tinted blue',
    '赤く染めた': 'Tinted red',
    'ピンクに染めた': 'Tinted pink',
    'やわらかいモノクロ': 'Soft mono',
    '硬いモノクロ': 'Hard mono',
    '黒の深いモノクロ': 'Mono with deep blacks',
    '鮮やか': 'Vivid',
    '控えめで自然な色': 'Understated, natural colour',
    '青い影とノスタルジックな光': 'Blue shadows and nostalgic light',
    '緑と青を深く': 'Deep green and blue',
    '肌をきれいに': 'Flattering skin',
    '映像向けの寝かせた調子': 'Flat tones for video',
    '映像向けのコントラスト': 'Contrast for video',
    '階調豊かなモノクロ': 'Mono with rich tones',
    '明暗を強めたモノクロ': 'Mono with strong light and dark',
    '古典的なモノクロ': 'Classic mono',
    '少しだけ鮮やかに': 'A little more vivid',
    '硬調のモノクロ': 'High-contrast mono',
    '肌を明るくやわらかく': 'Bright, soft skin',
    '空の青と緑を濃く': 'Deeper sky blue and green',
    '階調を広く、色は自然に': 'Wide tonal range, natural colour',
    '低コントラスト、素材向き': 'Low contrast, a base for editing',
    '見たままの色を測色的に': 'Colour as seen, measured faithfully',
    '色を少し濃く、くっきり': 'Slightly richer colour, crisp',
    '締まった影と澄んだ青': 'Firm shadows and clear blue',
    '暖かくふわっと淡い': 'Warm, soft and pale',
    '色を抜いた古い写真の風合い': 'The drained feel of an old photo',
    '銀を残したような低彩度と硬さ': 'Low saturation and hardness, like bleach bypass',
    '空が沈む硬いモノクロ': 'Hard mono with a darkened sky',
    '白と黒だけに近い強いモノクロ': 'Strong mono, nearly just black and white',
    '青に転んだクロス現像': 'Cross processing shifted to blue',
    '黄に転んだクロス現像': 'Cross processing shifted to yellow',
    '赤紫に転んだクロス現像': 'Cross processing shifted to magenta',
    '青と緑を落ち着かせた素直な色': 'Plain colour with calmer blue and green',
    '肌をほんのり桃色に': 'A faint pink glow on skin',
    '青と緑をさらに濃く、黄を明るく': 'Even deeper blue and green, brighter yellow',
    '紅葉と空を明るく落ち着いた和の色に': 'Autumn leaves and sky in bright, calm Japanese tones',
    '60〜70年代のカラープリントのような褪せた色': 'Faded colour like a colour print from the 60s and 70s',
    '明るく派手に、色をはっきり': 'Bright and bold, with clear colour',
    '白っぽく淡い、やさしい色': 'Whitish, pale and gentle',
    'コントラストと彩度を抑えた素材向きの色': 'Low contrast and saturation, a base for editing',
    '色を抜いて暗部を締めた銀残し調': 'A bleach-bypass look, drained with firm shadows',
    '緑と空を記憶色に寄せたポジフィルム調': 'A slide film look with green and sky as you remember them',
    '色が転んだクロス現像': 'Cross processing with shifted colour',
    '全体を金色に包む暖かい色': 'Warm colour that wraps everything in gold',
    '明るく弾ける原色': 'Bright, popping primaries',
    '白っぽく淡い、光の多い色': 'Whitish, pale and full of light',
    '影を起こしてやわらかく': 'Lifted shadows, soft',
    '黒の深い硬調モノクロ': 'Hard mono with deep blacks',
    '黄と緑に転んだクロス現像': 'Cross processing shifted to yellow and green',
    'やさしいセピア': 'Gentle sepia',
    '褪せた色と青い黒': 'Faded colour and bluish blacks',
    '控えめに鮮やか': 'Quietly vivid',
    '少し色を抑えた素材向き': 'Slightly muted, a base for editing',
    '明るく肌をやわらかく': 'Bright, with soft skin',
    '赤フィルターのモノクロ': 'Mono through a red filter',
    // the rows under the looks
    'フィルム化': 'Film',
    'なし': 'None',
    'スリーブ': 'Sleeve',
    'マウント': 'Mount',
    'フィルムの色': 'Film base',
    '黒': 'Black',
    '茶': 'Brown',
    '透明': 'Clear',
    'マウントの色': 'Mount colour',
    '白': 'White',
    '紙': 'Paper',
    'インスタント': 'Instant',
    '光の強さ': 'Light',
    '写真をドラッグすると、切り取る位置を動かせます': 'Drag the photo to move the crop',
    '枠に入れる文字': 'Text on the frame',
    '色名を入れる': 'Add the look\'s name',
    '16桁の番号を入れる（撮影日時と色）': 'Add the 16-digit number (date taken and look)',
    '枠': 'Frame',
    '明るさ・色温度・粒子': 'Brightness, warmth, grain',
    '初期値': 'Default',
    '調整中': 'Adjusted',
    '明るさ': 'Brightness',
    '色温度': 'Warmth',
    'フィルム粒子': 'Film grain',
    '周辺減光': 'Vignette',
    'すべて初期値にもどす': 'Reset all',
    '保存の大きさ': 'Save size',
    '元の大きさ': 'Original size',
    '大きさ（長い辺）': 'Size (long side)',
    '大きさ（枠の横幅）': 'Size (frame width)',
    '手持ちの LUT を読み込む': 'Load your own LUT',
    '.cube / HaldCLUT .png / .lut16 を': 'Drop a .cube / HaldCLUT .png / .lut16 file',
    'ドロップ、またはタップして選ぶ': 'here, or tap to choose one',
    // about, links and the ad
    'FILMEA でできること': 'What FILMEA can do',
    '撮って出しのように仕上がる101色': '101 looks that finish like straight out of the camera',
    'かけても白っぽく褪せず、白い物は白いまま。9つの系統から、写真に合う色を選べます。': 'They never wash your photo out, and white stays white. Pick the look that suits your photo from nine families.',
    '撮ったもので選べる': 'Choose by what you shot',
    '人物・風景・街・食事・モノクロ・フィルム・気分のタブから。一覧のコマは、あなたの写真で描きます。': 'From the People, Scenery, Street, Food, Mono, Film and Mood tabs. Every frame in the list is drawn with your own photo.',
    'ポジフィルムのように見せる': 'Show it like slide film',
    'スリーブ・マウント白・マウント紙。ライトボックスにのせたような光の強さも変えられます。': 'A film sleeve, or a white or paper slide mount. You can set how bright the light box behind it shines.',
    'インスタにそのまま載せられる枠': 'Frames ready for Instagram',
    '白・黒の枠は4:5と正方形で保存。インスタント風の枠もあります。': 'White and black frames save at 4:5 or square. There is an instant photo frame too.',
    '写真はどこにも送られない': 'Your photo goes nowhere',
    '読み込みから保存まで端末の中だけで処理します。無料・登録なし・クレジット表記も不要です。': 'From opening to saving, everything happens on your device. Free, no sign-up, no credit needed.',
    'アプリとしても使える': 'Works as an app',
    'ホーム画面に追加すると画面いっぱいで開け、一度開けば通信がなくても使えます。': 'Add it to your home screen to open it full screen. Once opened, it works offline too.',
    'FILMEA の使い方': 'How to use FILMEA',
    '使い方': 'How to use',
    '写真をひらいてから保存するまで': 'From opening a photo to saving it',
    'よくある質問': 'FAQ',
    '料金・写真の扱い・保存の大きさ': 'Price, privacy and save sizes',
    '制作記': 'Making of',
    'FILMEAを作った話（LabNote）': 'How FILMEA was made (LabNote)',
    'FILMEA について': 'About FILMEA',
    'ライセンス': 'Licenses',
    'プライバシーポリシー': 'Privacy policy',
    '広告': 'Advertisement',
    '楽天市場の広告': 'Rakuten ad',
    'このページには広告（アフィリエイトリンク）が含まれます。': 'This page contains ads (affiliate links).',
    // messages
    'サンプル写真を読み込めませんでした。手元の写真を選んでください': 'Couldn\'t load the sample photo. Please choose one of your own.',
    'この写真は大きすぎて表示できませんでした。別の写真を選んでください': 'This photo is too large to show. Please choose another.',
    '描画を立て直しています。少し待ってからもう一度保存してください': 'Restoring the display. Wait a moment and save again.',
    'Safari の共有ボタン（□に↑）から「ホーム画面に追加」を選ぶと、アプリとして使えます': 'In Safari, tap the Share button (□ with ↑) and choose "Add to Home Screen" to use it as an app.',
    'ブラウザのメニューの「アプリをインストール」か「ホーム画面に追加」から、アプリとして追加できます': 'Choose "Install app" or "Add to Home screen" from the browser\'s menu to add it as an app.',
  };

  // Strings app.js builds around a value.
  const RULES = [
    [/^サンプル: (.+)$/, (m) => `Sample: ${tr(m[1]) || m[1]}`],
    [/^(.+)（(\d+)種）$/, (m) => `${tr(m[1]) || m[1]} (${m[2]} looks)`],
    [/^(\d+) 種$/, (m) => `${m[1]} looks`],
    [/^([+−])(\d+) 暖$/, (m) => `${m[1]}${m[2]} warm`],
    [/^([+−])(\d+) 寒$/, (m) => `${m[1]}${m[2]} cool`],
    [/^(.+) を読み込みました（(\d+)³）$/, (m) => `Loaded ${m[1]} (${m[2]}³)`],
    [/^(.+): 対応していない形式です$/, (m) => `${m[1]}: this format isn't supported`],
    [/^保存できませんでした: (.*)$/, (m) => `Couldn't save: ${tr(m[1]) || m[1]}`],
    [/^(.+?) — (.+)$/, (m) => { const d = tr(m[2]); return d ? `${m[1]} — ${d}` : null; }],
  ];

  const JA = Object.fromEntries(Object.entries(EN).map(([k, v]) => [v, k]));

  // English for a Japanese string, or null when there is none.
  function tr(s) {
    if (EN[s] !== undefined) return EN[s];
    for (const [re, fn] of RULES) { const m = s.match(re); if (m) { const r = fn(m); if (r) return r; } }
    return null;
  }

  const ATTRS = ['title', 'aria-label', 'data-tip'];
  const orig = new WeakMap(); // node -> { text, attrs: { name: Japanese } }, the Japanese it had
  let lang = 'ja';

  const rec = (n) => { let o = orig.get(n); if (!o) { o = { attrs: {} }; orig.set(n, o); } return o; };
  const SKIP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'svg', 'CANVAS']);

  function toEnText(n) {
    const v = n.nodeValue, s = v.trim();
    if (!s) return;
    const e = tr(s);
    if (e === null) return;
    rec(n).text = v;
    n.nodeValue = v.replace(s, e);
  }
  function toEnAttr(el, a) {
    const v = el.getAttribute(a);
    if (!v) return;
    const e = tr(v);
    if (e === null) return;
    rec(el).attrs[a] = v;
    el.setAttribute(a, e);
  }
  function walk(root, fnText, fnAttr) {
    if (root.nodeType === 3) { fnText(root); return; }
    if (root.nodeType !== 1) return;
    for (const a of ATTRS) if (root.hasAttribute(a)) fnAttr(root, a);
    if (SKIP.has(root.nodeName)) return;
    for (const c of root.childNodes) walk(c, fnText, fnAttr);
  }

  // Back to Japanese: what the node had, or the Japanese for an English string app.js copied from the
  // screen (the save size, read off its button).
  function toJaText(n) {
    const o = orig.get(n), v = n.nodeValue, s = v.trim();
    if (o?.text !== undefined && tr(o.text.trim()) === s) { n.nodeValue = o.text; return; }
    if (JA[s] !== undefined) n.nodeValue = v.replace(s, JA[s]);
  }
  function toJaAttr(el, a) {
    const o = orig.get(el), v = el.getAttribute(a);
    if (o?.attrs[a] !== undefined && tr(o.attrs[a]) === v) el.setAttribute(a, o.attrs[a]);
    else if (JA[v] !== undefined) el.setAttribute(a, JA[v]);
  }

  const observer = new MutationObserver((list) => {
    if (lang !== 'en') return;
    for (const m of list) {
      if (m.type === 'childList') m.addedNodes.forEach((n) => walk(n, toEnText, toEnAttr));
      else if (m.type === 'characterData') toEnText(m.target);
      else if (m.type === 'attributes') toEnAttr(m.target, m.attributeName);
    }
  });

  const btn = document.getElementById('btnLang');
  function apply(next) {
    lang = next;
    document.documentElement.lang = next;
    walk(document.body, next === 'en' ? toEnText : toJaText, next === 'en' ? toEnAttr : toJaAttr);
    observer.takeRecords();
    if (btn) {
      btn.textContent = next === 'en' ? 'JP' : 'EN';
      btn.setAttribute('aria-label', next === 'en' ? '日本語' : 'English');
      btn.title = next === 'en' ? '日本語' : 'English';
    }
  }

  let first = null;
  try { first = localStorage.getItem(KEY); } catch {}
  if (first !== 'ja' && first !== 'en') {
    const bot = /bot|crawl|spider|slurp|lighthouse|inspection/i.test(navigator.userAgent);
    const ja = /^ja\b/i.test((navigator.languages && navigator.languages[0]) || navigator.language || '');
    first = bot || ja ? 'ja' : 'en';
  }
  apply(first);
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });

  btn?.addEventListener('click', () => {
    const next = lang === 'en' ? 'ja' : 'en';
    try { localStorage.setItem(KEY, next); } catch {}
    apply(next);
  });
})();
