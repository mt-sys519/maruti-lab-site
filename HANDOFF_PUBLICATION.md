# Maruti Lab サイト公開引き継ぎ

更新日: 2026-08-09

## 現在地

サイト本体とPromptTerm CLOCKのダウンロードページはローカルで完成確認中です。Gitリポジトリは初期化済みですが、まだコミットとGitHub remoteの設定は行っていません。

ローカル確認URL:

- `http://127.0.0.1:4190/`
- `http://127.0.0.1:4190/clock`
- `http://127.0.0.1:4190/privacy`
- `http://127.0.0.1:4190/disclaimer`

## 確定済み

- トップの主役はYURAMEKI
- YURAMEKI作例は提供されたアニメーションWebPを使用
- PromptTerm CLOCKのトップ掲載画像はアンバー
- `/clock` の主役画像は提供されたGREENのCLOCK MODEスクリーンショット
- SwiftCropとCOLOR RE:FINEは横長カード、画像全体を表示
- PromptTerm StickerはLINE STOREへの小さな文字リンク
- X: `https://x.com/maruti_lab`
- LINE Sticker: `https://store.line.me/stickershop/product/35520055/ja`
- PrivacyとDisclaimerをサイト内に作成済み
- すべての作品画像をリンク化済み

## 確認済み

- lint成功
- production build成功
- HTMLレンダリングテスト成功
- `/` `/clock` `/privacy` `/disclaimer` がローカルでHTTP 200
- 主要画面で横スクロールなし
- CLOCKヒーローは6管全体を16:9のまま表示
- インストーラーSHA-256一致

## 次回の順序

1. トップを1100px前後、900px、390pxで最終目視確認
2. 不要な旧画像を参照状況を確認したうえで整理
3. Gitへ初回コミット
4. GitHubに非公開または公開リポジトリを作り、remoteを設定してpush
5. 公開URLを決め、`NEXT_PUBLIC_SITE_URL`を設定
6. Cloudflare側のプロジェクトをGitHubへ接続
7. 本番で全ページ、全外部リンク、画像、ダウンロードを確認
8. ダウンロード計測を実装
9. 計測内容に合わせてPrivacyへ集計記録の説明を追記

## ダウンロード計測案

ダウンロードボタンを直接ファイルへ向けず、`/download/clock` を経由させます。

1. バージョン別・日別の集計値を1件加算
2. インストーラーを返す、またはR2のファイルへ遷移
3. IPアドレスなど利用者を識別する情報は独自保存しない

「開始されたダウンロード」は数えられますが、保存完了やインストール完了までは判定しません。

## 公開前にユーザー判断が必要なもの

- Maruti Labの最終ドメイン
- GitHubリポジトリを公開にするか非公開にするか
- インストーラーをサイト内に残すかR2へ移すか
- ダウンロード数を管理者だけが見るか、サイト上にも表示するか
- 問い合わせ窓口を公式Xのままにするか

## 注意

- Cloudflare、GitHub、R2への書き込みはまだ行っていません。
- 認証情報をリポジトリへ保存しないでください。
- 公開後はPrivacyの「Cookieとアクセス解析」を実際の設定に合わせて再確認してください。
