# Maruti Lab Official Site

Maruti Labの作品紹介と、PromptTerm CLOCKの配布を行う公式サイトです。

公開URL: https://maruti-lab-site.mt-kiryu.workers.dev

## 公開ページ

- `/` — Maruti Labトップ、YURAMEKI、PromptTerm CLOCK、SwiftCrop、COLOR RE:FINE、PromptTerm Sticker
- `/clock` — PromptTerm CLOCK紹介・Windows版ダウンロード
- `/privacy` — プライバシーポリシー
- `/disclaimer` — 免責事項

## ローカル起動

```powershell
npm.cmd install
npm.cmd run dev
```

本番相当の確認:

```powershell
npm.cmd run build
npm.cmd run start -- -p 4190
```

## 品質確認

```powershell
npm.cmd run lint
npm.cmd run build
node --test tests\rendered-html.test.mjs
git diff --check
```

## 配布ファイル

- `public/downloads/PromptTerm_CLOCK_1.0.0_setup.exe`
- `public/downloads/SHA256SUMS.txt`
- SHA-256: `28D02F8B39B84AF300388E425F74CAB001BDFEC1DC4271114120D7089C55D927`

公開前に `Get-FileHash` でインストーラーと表示値の一致を再確認します。

## 環境変数

- `NEXT_PUBLIC_SITE_URL` — 公開後のMaruti LabサイトURL

未設定時は `http://localhost:4188` です。本番ビルドでは必ず設定します。

## 公開方針

- ソース: GitHub
- サイト: Cloudflare Pages / Workers
- インストーラー: 現在はサイト内配置。R2へ分離する場合はダウンロード計測エンドポイントを経由
- ダウンロード計測: 個人を識別しない集計値のみを記録する設計を予定

公開作業の具体的な順序と未完了項目は `HANDOFF_PUBLICATION.md` を参照してください。
