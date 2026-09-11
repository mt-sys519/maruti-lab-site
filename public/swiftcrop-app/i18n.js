(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('lang') !== 'en') return;

  document.documentElement.lang = 'en';
  document.body?.classList.add('lang-en');

  const exact = new Map(Object.entries({
    '切り抜きも、リサイズも。': 'Crop and resize.',
    'まとめて軽く、安心に。': 'Batch processing, lighter and private.',
    'まとめて軽く、': 'Batch processing, ',
    '安心に。': 'lighter and private.',
    '複数の画像を、ブラウザでまとめて処理。画像を外部サーバーへ送信せず、選んだらすぐ作業を始められます。': 'Process multiple images together in your browser. Nothing is sent to an external server, so you can start as soon as you choose your files.',
    '複数画像を、ブラウザでまとめて切り抜き・リサイズ。': 'Batch crop and resize images in your browser.',
    '複数画像をまとめて、切り抜き・リサイズ。': 'Batch crop and resize multiple images.',
    '同じ設定で切り抜き・リサイズ・形式変換': 'Crop, resize, and convert with one set of options',
    '複数画像をまとめて処理できます。': 'Process multiple images together.',
    '画像はアップロードされず、端末内で処理されます': 'Images are not uploaded and are processed on your device',
    '無料で使えます・登録不要・インストール不要': 'Free to use · No account · No installation',
    '無料で使える': 'Free to use',
    '無料で使えます': 'Free to use',
    'アップロードなし': 'No uploads',
    '画像が、ネットを往復しない。': 'Your images never make a round trip online.',
    'SwiftCropは、選んだ画像をそのままブラウザ内で処理。アップロードを待たず、画像を外へ出さず、編集から保存まで進められます。': 'SwiftCrop processes selected images directly in your browser. Edit and save without uploading them or waiting for a transfer.',
    '画像を選ぶ': 'Choose images',
    'ブラウザ内で編集': 'Edit in your browser',
    '端末の外へ送信しない': 'Nothing leaves your device',
    'そのまま保存': 'Save directly',
    'アップロード型のツールで必要になる、送信・待機・再ダウンロードの往復がありません。': 'Skip the upload, waiting, and download round trip required by upload-based tools.',
    '画像を外に出さない、一括画像ツール': 'Private batch image processing, right in your browser',
    '切り抜き・リサイズ・形式変換を、ブラウザですぐに。': 'Crop, resize, and convert images without uploading.',
    '画像作業を、': 'Make image work',
    'もっと軽く。': 'feel lighter.',
    '複数の画像をドラッグして、一括切り抜き・リサイズ。画像はサーバーへ送らず、あなたの端末のブラウザ内で処理します。': 'Drop multiple images to crop and resize them in one batch. Your images stay on your device and are processed in your browser.',
    '画像を選んですぐ始める': 'Choose images and start',
    '登録不要・インストール不要': 'No account or installation',
    '外へ送信しない': 'Nothing gets uploaded',
    '画像は端末内にとどまります': 'Your images stay on your device',
    'アップロード待ちなし': 'No upload wait',
    '選んだらすぐ編集へ': 'Choose files and start editing',
    'まとめて処理': 'Process in batches',
    '複数画像を同じ設定で': 'One setting for many images',
    '画像が多い日ほど、気持ちよく進む。': 'The more images you have, the smoother it feels.',
    'サーバーとの往復を減らし、端末の性能をそのまま画像作業に使います。処理速度は端末性能や画像枚数によって変わります。': 'Skip the round trip to a server and use your device directly. Processing speed varies with your device, image size, and image count.',
    '待ち時間を少なく': 'Spend less time waiting',
    'PCの性能を活かす': 'Use your computer directly',
    '画像を外に出さない': 'Keep images on your device',
    'アップロードする画像ツールとは、進み方が違います。': 'A shorter workflow than upload-based image tools.',
    '一般的なオンライン画像ツール': 'Typical online image tools',
    '画像をアップロード': 'Upload images',
    '送信と処理を待つ': 'Wait for transfer and processing',
    '加工後の画像をダウンロード': 'Download processed images',
    '端末内で編集・一括処理': 'Edit and batch process on-device',
    'そのまま保存': 'Save directly',
    'いつもの画像作業に、ちょうどいい。': 'Made for everyday image work.',
    'LINEスタンプ': 'LINE stickers',
    'イラスト・創作': 'Illustration and creative work',
    'ネットショップ': 'Online shops',
    '写真整理': 'Photo organization',
    'AI学習データセット作成にも。': 'AI Dataset Builder, when you need it.',
    '処理速度はどのくらいですか？': 'How fast is processing?',
    'アップロード待ちはありませんが、処理速度は端末の性能、画像のサイズや枚数、出力設定によって変わります。': 'There is no upload wait, but processing speed varies with your device, image sizes, image count, and export settings.',
    '無料で使える、一括画像リサイズ＆クロップツール': 'AI training dataset preparation, made simple',
    '画像はブラウザ内で処理。普段の画像加工から、Caption付きのAI学習データ作成までまとめて仕上げられます。': 'Resize, crop, rename, add a trigger word, edit captions per image, and export a dataset-ready ZIP—all in your browser.',
    '画像をまとめて、ちょうどいいサイズに。': 'Prepare AI Training Datasets in Minutes',
    '複数の画像を一括でリサイズ・クロップ・形式変換。画像をアップロードせず、ブラウザだけで安全に処理できます。': 'Crop images to 1024×1024, create paired caption files, and export a clean dataset ZIP without uploading your images.',
    '画像を選択': 'Build a Dataset',
    '一括処理': 'Batch Processing',
    '複数画像をまとめて': 'Process many images',
    'かんたんクロップ': 'Smart Cropping',
    '位置とズームを調整': 'Adjust position and zoom',
    'プライバシー重視': 'Privacy First',
    '画像を外部送信しない': 'No image uploads',
    'まとめて保存': 'Dataset Ready',
    '画像またはZIPで出力': 'Images, TXT, and ZIP',
    '正方形 1024': 'AI 1024',
    'AI学習用オプション': 'AI Dataset Builder',
    '必要な方のみ': '',
    '画像を処理': 'Create Dataset ZIP',
    'いろいろな画像作業を、ひとつの画面で。': 'One fast workflow for AI dataset preparation.',
    'SNS投稿': 'LoRA',
    '正方形・縦長・横長へ一括調整': 'Prepare consistent training images',
    'EC・商品画像': 'FLUX',
    '画像サイズと形式をまとめて統一': 'Build clean 1024px datasets',
    'ブログ・Web': 'SDXL',
    'OGPやWebP画像をすばやく作成': 'Crop and export paired files',
    'AI学習データ': 'Pony & more',
    'LoRA・FLUX・SDXL向けにも対応': 'Guides for popular model workflows',
    'AI Creator Hubへ →': 'Open AI Creator Hub →',
    '複数画像をまとめて処理': 'Dataset-ready ZIP',
    '同じサイズ・形式で一括クロップし、画像またはZIPとしてまとめて保存できます。': 'Export consistently cropped images and matching caption files in one ZIP.',
    '画像とCaptionを、対応したまま書き出せます': 'Prepare training images and matching captions in one batch.',
    'AI学習用オプションをオンにすると、共通の設定と画像ごとの差分を組み合わせ、画像と同名のCaption TXTをまとめて作成できます。': 'Combine shared settings with per-image details, then export every training image with a matching caption TXT file.',
    'すべてのCaptionの先頭に、共通の呼び出し語を追加': 'Add one shared token to the beginning of every caption',
    'データセット全体に共通する説明をまとめて設定': 'Set the description shared across the entire dataset',
    '表情・服装・背景など、画像ごとの差分だけ編集': 'Edit only what changes per image, such as expression, clothing, or background',
    '画像とCaptionの組み合わせを崩しません': 'Keep every image paired with its caption',
    '1つのTrigger word。画像ごとに編集できるCaption。': 'One shared trigger word. One editable caption for every image.',
    '無料': 'Free',
    '無料で使える、一括画像リサイズ＆クロップツール': 'AI Training Dataset Builder',
    '画像はブラウザ内で処理。外部サーバーへの送信・会員登録・インストールは不要です。': 'Images are processed in your browser. No uploads, account, or installation required.',
    'サーバー保存なし': 'No server storage',
    '一括処理': 'Batch processing',
    'Ctrl+V対応': 'Paste with Ctrl+V',
    'アプリとして追加': 'Install app',
    '出力サイズ': 'Output size',
    '幅（px）': 'Width (px)',
    '高さ（px）': 'Height (px)',
    'アスペクト比を維持': 'Keep aspect ratio',
    '基本プリセット': 'Basic presets',
    '比率を固定': 'Lock ratio',
    '比率': 'Aspect ratio',
    '自由入力': 'Free',
    '用途別サイズ': 'Purpose sizes',
    '元画像サイズに戻す': 'Original image size',
    '標準': 'Default',
    '横長 16:9': 'Landscape 16:9',
    '縦長 9:16': 'Portrait 9:16',
    'カスタム': 'Custom',
    '↺ オリジナル': '↺ Original',
    'Caption Files (.txt) を生成': 'Generate Caption Files (.txt)',
    'すべてのCaptionの先頭へ追加する、学習対象を呼び出すための合言葉です。': 'Added to the beginning of every caption as the token used to call the trained subject or style.',
    'を使用できます。': ' are available.',
    '画像リスト（': 'Image list (',
    '枚）': ' images)',
    '0枚': '0 images',
    '・ドラッグで順番を変更できます・画像ファイルを画面へドロップして追加できます': ' · Drag to reorder · Drop more image files anywhere on the page',
    '、Macは': ', on Mac press',
    'SNSプリセット': 'Social presets',
    '最近使ったサイズ': 'Recent sizes',
    '履歴を削除': 'Clear history',
    '出力設定': 'Output settings',
    'フォーマット': 'Format',
    'JPEG（おすすめ）': 'JPEG (recommended)',
    'PNG（透明画像向け）': 'PNG (for transparency)',
    'WebP（Webサイト向け）': 'WebP (for websites)',
    '写真・SNSはJPEG、透明画像はPNG、Webサイト用はWebPがおすすめです。': 'Use JPEG for photos and social media, PNG for transparency, and WebP for websites.',
    '品質': 'Quality',
    '保存方法': 'Save method',
    '1枚ずつ保存・共有': 'Save or share individually',
    'スマホ推奨・画像ごとに保存': 'Recommended on mobile · save each image',
    'ZIPでまとめて保存': 'Save together as ZIP',
    'PC推奨・複数画像を一括保存': 'Recommended on desktop · save multiple images at once',
    '画像ファイル名': 'Image filename',
    'は連番になります。': ' will be numbered sequentially.',
    'ZIPファイル名': 'ZIP filename',
    '画像を追加': 'Add images',
    'まとめて自動調整': 'Auto-adjust all',
    '顔や被写体が収まりやすい位置へ調整します。あとから手動でも変更できます。': 'Adjusts each crop to help keep faces and subjects in frame. You can fine-tune it afterward.',
    '画像を保存': 'Save images',
    'まとめてZIP保存': 'Save all as ZIP',
    '処理中...': 'Processing...',
    '画像は外部へ送信されません。': 'Your images are never uploaded.',
    'すべての処理はこのブラウザ内で完結します。': 'All processing happens in this browser.',
    'すべて削除': 'Remove all',
    '画像をドラッグ＆ドロップ': 'Drag and drop images',
    'JPEG・PNG・WebPを複数まとめて処理できます': 'Process multiple JPEG, PNG, and WebP images at once',
    'でスクリーンショットも貼り付け可能': ' to paste screenshots',
    '完全無料・登録不要・画像を外部サーバーへ送信しません': 'Free · No account · Images are not uploaded',
    'ファイルを選択': 'Choose files',
    '位置調整': 'Position',
    'ホイール／ピンチでズーム': 'Wheel / pinch to zoom',
    'Shift＋ホイールで微調整': 'Shift + wheel for fine zoom',
    'ダブルクリックでリセット': 'Double-click to reset',
    '画像を処理': 'Process images',
    '安全なブラウザ内処理': 'Private browser processing',
    '画像は端末内で処理され、SwiftCropのサーバーへアップロード・保存されません。': 'Images are processed on your device and are never uploaded to or stored on SwiftCrop servers.',
    '複数画像をまとめて処理': 'Process multiple images together',
    '同じサイズ・形式で一括クロップし、ZIPファイルとしてまとめて保存できます。': 'Crop multiple images to the same size and format, then save them together as a ZIP.',
    '設定を自動保存': 'Settings are saved automatically',
    '出力サイズ・形式・品質などをブラウザに保存し、次回アクセス時に復元します。': 'Output size, format, and quality are stored in your browser and restored next time.',
    'よくある質問': 'Frequently asked questions',
    '本当に無料ですか？': 'Is it really free?',
    'はい。SwiftCropの基本機能は無料で利用でき、会員登録も必要ありません。': 'Yes. SwiftCrop’s core features are free and no account is required.',
    '画像はサーバーに保存されますか？': 'Are images stored on a server?',
    '保存されません。画像の読み込み、クロップ、リサイズ、ZIP作成はブラウザ内で実行されます。': 'No. Loading, cropping, resizing, and ZIP creation all happen in your browser.',
    '対応している画像形式は？': 'Which image formats are supported?',
    '入力はJPEG・PNG・WebP、出力はJPEG・PNG・WebPに対応しています。': 'JPEG, PNG, and WebP are supported for both input and output.',
    'スマートフォンでも使えますか？': 'Does it work on mobile?',
    'はい。スマートフォンやタブレットでも利用できます。画像の位置調整は指でドラッグできます。': 'Yes. It works on phones and tablets, and you can drag images with your finger to adjust their position.',
    'トップ': 'Home',
    'プライバシーポリシー': 'Privacy',
    '利用規約': 'Terms',
    'お問い合わせ': 'Contact',
    '保存が完了しました': 'Save complete',
    '保存の準備ができました': 'Ready to save',
    'ZIPをダウンロードしました': 'ZIP download started',
    'の画像を保存できます。': ' images are ready to save.',
    'の画像を、下のボタンから保存できます。': ' images are ready. Use the buttons below to save them.',
    'の画像をZIPにまとめました。': ' images have been added to the ZIP.',
    'の画像をZIPファイルにまとめました。': ' images were added to the ZIP file.',
    'まとめて共有・保存': 'Share or save all',
    'もう一度使う': 'Use again',
    'ブックマーク方法': 'How to bookmark',
    'ここにドロップすると現在の画像リストへ追加されます': 'Drop here to add them to the current image list',
    'SwiftCropを利用するにはJavaScriptを有効にしてください。': 'Enable JavaScript to use SwiftCrop.',
    'AI Dataset': 'AI Dataset',
    '画像名とZIP名のベースになります。': 'Used as the base for image and ZIP filenames.',
    '画像ごとのCaption TXTを生成': 'Generate a caption TXT for each image',
    'を使用できます。各画像と同名のTXTを生成します。': ' are available. A TXT file matching each image name will be created.',
    'Dataset ZIPを作成': 'Create Dataset ZIP',
    'Dataset-ready ZIP': 'Dataset-ready ZIP',
    '1024×1024画像と同名のCaption TXTを、学習用ZIPとしてまとめて保存できます。': 'Export 1024×1024 images and matching caption TXT files in one training-ready ZIP.'
,
    '必要な場合だけ選択してください': 'Enable only when needed',
    '入力すると画像名・TXT名・ZIP名へ自動反映されます。': 'Automatically applied to image, TXT, and ZIP filenames.',
    '最初の2件': 'First 2 files',
    'Caption TXTを出力する場合は、「ZIP保存」を選択してください。': 'To export Caption TXT files, choose ZIP export.',
    '画像をすべてクリア': 'Clear all images',
    'ドラッグで順番を変更できます': 'Drag to reorder',
    '画像ファイルを画面へドロップして追加できます': 'Drop more image files anywhere on the page',
    'AIクリエイター向けの機能とガイドは、必要な方だけこちらから。': 'Explore optional tools and guides for AI creators.',
    '基本の準備方法': 'Getting started',
    'LoRA用画像の準備': 'Prepare LoRA images',
    'FLUX向けデータセット': 'Prepare FLUX datasets',
    '1024px学習画像': 'Prepare 1024px training images',
    'Pony系モデル向け': 'Prepare Pony datasets',
    'フッターナビゲーション': 'Footer navigation',
    '閉じる': 'Close',
    'コーヒーで応援': 'Support with a coffee',
    'SwiftCropが役に立ったら': 'If SwiftCrop helped you',
    'コーヒー1杯で、これからの開発を応援できます。': 'You can support future development with a coffee.',
    'の画像をDataset ZIPにまとめました。': ' images were added to the Dataset ZIP.',
    'Windowsは': 'On Windows, press',
    'で追加できます。': 'to add a bookmark.',
    '画像処理': 'Image processing',
    '広告': 'Advertisement'
  }));

  const attributes = {
    'SwiftCropトップページへ': 'Go to the SwiftCrop home page',
    'SwiftCropの特徴': 'SwiftCrop features',
    'サイズ選択を閉じる': 'Close size selection'
  };

  function translateString(value) {
    const trimmed = value.trim();
    if (exact.has(trimmed)) {
      return value.replace(trimmed, exact.get(trimmed));
    }

    return value
      .replace(/Caption Files \(.txt\) を生成/g, 'Generate Caption Files (.txt)')
      .replace(/すべてのCaptionの先頭へ追加する、学習対象を呼び出すための合言葉です。/g, 'Added to the beginning of every caption as the token used to call the trained subject or style.')
      .replace(/画像リスト（(\d+)枚）/g, 'Image list ($1)')
      .replace(/(\d+:\d+)のサイズ/g, '$1 sizes')
      .replace(/(\d+)枚/g, '$1 images')
      .replace(/画像を(\d+)枚処理しました/g, 'Processed $1 images')
      .replace(/(\d+)枚の画像を処理します/g, 'Process $1 images')
      .replace(/画像を処理中/g, 'Processing images')
      .replace(/自動調整が完了しました/g, 'Auto adjustment complete')
      .replace(/自動調整しました/g, 'Auto adjustment complete')
      .replace(/AIを読み込めなかったため、通常の自動調整を使用しました/g, 'AI could not be loaded, so standard auto adjustment was used')
      .replace(/画像が多すぎるため処理できませんでした。分けてアップロードしてください。/g, 'There are too many images for this device. Please process them in smaller batches.')
      .replace(/ドラッグで順番を変更できます/g, 'Drag to reorder')
      .replace(/画像ファイルを画面へドロップして追加できます/g, 'Drop more image files anywhere on the page')
      .replace(/(\d+)枚の画像を追加しました/g, 'Added $1 images')
      .replace(/(\d+)枚の画像を貼り付けました/g, 'Pasted $1 images')
      .replace(/JPEG・PNG・WebP画像を選択してください/g, 'Choose JPEG, PNG, or WebP images')
      .replace(/画像を読み込み中…\s*(\d+)\/(\d+)/g, 'Loading images… $1/$2')
      .replace(/(.+?)を読み込めませんでした/g, 'Could not load $1')
      .replace(/ドラッグして並び替え/g, 'Drag to reorder')
      .replace(/(.+?)を並び替え/g, 'Reorder $1')
      .replace(/画像を削除/g, 'Remove image')
      .replace(/(.+?)を削除/g, 'Remove $1')
      .replace(/ドラッグで位置調整・ホイールでズーム・ダブルクリックでリセット/g, 'Drag to reposition · wheel to zoom · double-click to reset')
      .replace(/画像の順番を変更しました/g, 'Image order updated')
      .replace(/顔認識の読み込みに失敗しました。通常の自動調整を使用します/g, 'Face detection could not be loaded. Standard auto adjustment will be used.')
      .replace(/顔を(\d+)人検出/g, 'Detected $1 faces')
      .replace(/顔を検出/g, 'Face detected')
      .replace(/自動調整/g, 'Auto adjusted')
      .replace(/顔を確認中…/g, 'Checking faces…')
      .replace(/画像を調整しています…\s*(\d+)\/(\d+)/g, 'Adjusting images… $1/$2')
      .replace(/自動調整中にエラーが発生しました/g, 'An error occurred during auto adjustment')
      .replace(/ZIPライブラリを読み込めませんでした/g, 'Could not load the ZIP library')
      .replace(/画像を処理中…\s*(\d+)\/(\d+)/g, 'Processing images… $1/$2')
      .replace(/画像の生成に失敗しました/g, 'Could not generate the image')
      .replace(/ZIPファイルを作成中…/g, 'Creating ZIP file…')
      .replace(/ZIP圧縮中…\s*(\d+)%/g, 'Compressing ZIP… $1%')
      .replace(/画像の準備が完了しました/g, 'Images are ready')
      .replace(/画像の保存準備中にエラーが発生しました/g, 'An error occurred while preparing the download')
      .replace(/「まとめて共有・保存」から端末の共有メニューを開けます。個別保存も可能です。/g, 'Use “Share or save all” to open your device sharing menu. Individual downloads are also available.')
      .replace(/各画像の保存ボタンをタップしてください。iPhoneでは共有メニューから「画像を保存」を選べます。/g, 'Tap the save button for each image. On iPhone, choose “Save Image” from the sharing menu.')
      .replace(/スマートフォンでは「1枚ずつ保存・共有」がおすすめです。/g, 'On mobile, “Save or share individually” is recommended.')
      .replace(/スマートフォンでは「画像として保存」がおすすめです。/g, 'On mobile, “Save as images” is recommended.')
      .replace(/複数画像は「ZIPでまとめて保存」すると便利です。/g, 'For multiple images, saving them together as a ZIP is recommended.')
      .replace(/保存/g, 'Save')
      .replace(/この端末ではまとめて共有できません/g, 'Bulk sharing is not available on this device')
      .replace(/SwiftCropで処理した画像/g, 'Images processed with SwiftCrop')
      .replace(/共有メニューを開けませんでした/g, 'Could not open the sharing menu')
      .replace(/設定を復元できませんでした/g, 'Could not restore settings')
      .replace(/SwiftCropをホーム画面に追加しました/g, 'SwiftCrop was added to your home screen');
  }

  function translateNode(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    for (const node of nodes) {
      if (!node.nodeValue || !node.nodeValue.trim()) continue;
      const translated = translateString(node.nodeValue);
      if (translated !== node.nodeValue) node.nodeValue = translated;
    }

    if (root.querySelectorAll) {
      root.querySelectorAll('[aria-label], [title], [placeholder]').forEach((el) => {
        for (const attr of ['aria-label', 'title', 'placeholder']) {
          const value = el.getAttribute(attr);
          if (!value) continue;
          el.setAttribute(attr, attributes[value] || translateString(value));
        }
      });
    }
  }

  function updateHead() {
    document.title = 'SwiftCrop | No-Upload Batch Image Crop & Resize';
    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.content = 'Batch crop and resize images in your browser without uploading. A private, no-install image tool for social media, shops, websites, photos, and AI datasets.';
    }
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = 'https://swiftcrop.jp/?lang=en';

    const metaUpdates = {
      'meta[property="og:title"]': 'SwiftCrop | No-Upload Batch Image Crop & Resize',
      'meta[property="og:description"]': 'Batch crop and resize training images, add a shared trigger word, edit captions per image, and export matching image and TXT pairs.',
      'meta[property="og:url"]': 'https://swiftcrop.jp/?lang=en',
      'meta[property="og:image:alt"]': 'SwiftCrop private batch image editor interface',
      'meta[property="og:locale"]': 'en_US',
      'meta[name="twitter:title"]': 'SwiftCrop | No-Upload Batch Image Tool',
      'meta[name="twitter:description"]': 'Batch crop and resize images locally in your browser. No uploads, registration, or installation.',
      'meta[name="twitter:image:alt"]': 'SwiftCrop private batch image editor interface'
    };
    Object.entries(metaUpdates).forEach(([selector, content]) => {
      const meta = document.querySelector(selector);
      if (meta) meta.content = content;
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('lang-en');
    updateHead();
    translateNode(document.body);

    const tagline = document.querySelector('.tagline');
    const taglineSub = document.querySelector('.tagline-sub');
    const aiOptionDescription = document.querySelector('.ai-option-toggle-copy small');
    const aiOptionToggle = document.querySelector('#enable-ai-options');
    const triggerWord = document.querySelector('#trigger-word');
    if (tagline) tagline.textContent = 'AI Training Dataset Builder';
    if (taglineSub) taglineSub.textContent = 'Resize, crop, rename, add a trigger word, edit captions per image, and export a dataset-ready ZIP.';
    if (aiOptionDescription) aiOptionDescription.textContent = 'Prepare images, captions, and a dataset ZIP';
    if (aiOptionToggle) aiOptionToggle.disabled = true;
    const generateTxtLabel = document.querySelector('label[for="generate-txt"]');
    if (generateTxtLabel) {
      const textNode = Array.from(generateTxtLabel.childNodes).find(
        (node) => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim()
      );
      if (textNode) textNode.nodeValue = ' Generate Caption Files (.txt) ';
    }

    if (triggerWord) {
      triggerWord.placeholder = 'e.g. mktk_char';
      const helpText = triggerWord.closest('.input-group')?.querySelector('.help-text');
      if (helpText) helpText.textContent = 'Added to the beginning of every caption as the token used to call the trained subject or style.';
    }

    const languageSwitch = document.querySelector('.language-switch');
    const logo = document.querySelector('.logo-link');
if (logo) logo.href = '/?lang=en';
    if (languageSwitch) {
      languageSwitch.href = './';
      languageSwitch.hreflang = 'ja';
      languageSwitch.lang = 'ja';
      languageSwitch.setAttribute('aria-label', '日本語に切り替える');
      languageSwitch.innerHTML = '<i class="fa-solid fa-globe"></i> 日本語';
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const translated = translateString(node.nodeValue || '');
            if (translated !== node.nodeValue) node.nodeValue = translated;
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            translateNode(node);
          }
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
