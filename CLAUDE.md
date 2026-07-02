# プロジェクト方針（このプロジェクト専用）

このファイルはプロジェクトのルートに `CLAUDE.md` として置く。
セッション開始時に自動で読み込まれる。

## このプロジェクトのゴール
- スマホ向けドミニオン対戦Webアプリ（CPU戦・2〜4人ローカル・オンライン対戦）。UI/回答は日本語。
- 基本・陰謀（第二版）＋プロモ、海辺27・錬金術13（支配含む）・繁栄27（いずれも第二版）＝**全143枚を実プレイ可能**。
- 拡張を「壊さず」増やせる単一ソース設計と、テストで守られた堅牢性を維持する。

## 技術・前提
- フレームワーク無しの素のJS。`js/cards.js`＝カード正本(DOM.CARDS)／`js/engine.js`＝reduce純関数／`js/cpu.js`／`js/ui.js`。PWA（`sw.js`。**client資産を変えたら VERSION を上げる**）。
- オンラインは Node+ws のサーバ権威（`server/gameServer.js`・視点別マスク `maskStateFor`）。デプロイ＝main へ push → GitHub Pages（クライアント）＋ Render（サーバ）が自動。
- テスト＝`npm test`（19スイート・Node単体・決定論シード）。実ブラウザ検証（puppeteer・手動）＝`npm run verify:e2e` / `verify:visual`。
- カード完成画像 `asset/cards/<id>.webp` の再生成は**このPCのみ**（入力 `images/`・`asset/art/` は gitignore）。

## 設計方針・決定事項
- **単一ソース**：`DOM.CARDS` から表示・画像・整合性テストを自動導出。**新しい pending には CPU `decidePending` と UI `viewPendingModal` の分岐が必須**（無いとCPU無限ループ／人間が詰む）。新 `*_RESOLVE` は `PLAYER_ACTIONS` にも追加（整合性テストが検査）。
- 詳細なアーキテクチャ・決定事項・注意点は @PROGRESS.md の §2/§4/§6、広い過去文脈は docs/handover.md を参照。

## 進め方のルール
- 進捗・決定は必ず @PROGRESS.md に追記すること。
- 作業の区切りで「今やったこと / 次にやること」を報告すること。
- 容量が重くなったら /handoff を促すこと。

## 参照ファイル
現在の進捗は @PROGRESS.md を参照すること。
<!-- 設計メモを分けるなら @DESIGN.md なども追加できる -->
