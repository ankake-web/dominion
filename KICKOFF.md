<!-- /handoff が自動生成（2026-07-11）。新セッションはこのファイルの指示に従う。手編集不要 -->

ウルトラコード（最大エフォート）で進めてください。

スマホ向けドミニオン対戦Webアプリ（CPU戦・2〜4人ローカル・オンライン対戦）の実装を引き継ぎます。回答/UIは日本語。
作業ディレクトリ: c:\Users\b1242\claude\game\dominion / branch: main（main直接作業運用。最新は git log で確認）。

## まずやること
1. `Set-Location 'C:\Users\b1242\claude\game\dominion'` して `npm test` → **35スイート・オールグリーン（exit 0・整合性3148・不変条件6・帝国269＋UI75・ランドマーク80・帝国イベント69（events）・冒険59＋UI40・暗黒時代87＋UI57・新プロモ165＋UI22・繁栄69・異郷83＋UI44・収穫祭107・ギルド81＋UI25・CPU序列 強vs弱100/強vs普通64/普通vs弱95）** を確認。
2. `PROGRESS.md` 先頭サマリ＋**§0-20（帝国イベント・EV0〜EV3 全完了・未push）**を読む。横型の設計正本＝`docs/research/landscape_cards.md`＋`landscape_gaps.md`。全体設計図＝`docs/adding-cards.md`。

## 現状：横型ランドスケープ第2弾＝帝国イベント13種は **EV0〜EV3 全完了・未push**（`39d3129`・`sw.js` v47）
`empires-events` セット（帝国固定10＋イベント2抽選）が実プレイ可能。EV0基盤`BUY_EVENT`＋EV1簡単10種＋EV2重量3種(tax/donate/annex)＋EV3(CARD_SET昇格・CPU購入AI`bestEventBuy`・イベントwebp13種・敵対レビュー4観点で確定バグ3件修正)。全35スイート緑・`verify:e2e` 9/9（webp346/0）。

## 次に取り組むタスク（優先順1位）：**push（ユーザー確認の上で）**
- `origin/main..main` に **EV0〜EV3 の4コミット**（`8caabc0` EV0/EV1・`1bd81ed` handoff・`52f7e7f` EV2・`39d3129` EV3）が未push。**ユーザー確認の上で `git push`**。
- push すれば本番 Pages に `empires-events`（`sw.js` v47）＋イベント webp13種が出る。Render は push で自動再デプロイ（サーバは `DOM.CARD_SETS`/`eventsForSet` から empires-events を自動受理）。
- push 後は §0-19（ランドマーク）と同様に、本番 Pages で `sw.js` v47 とイベント webp（例 `tax.webp`）が 200 になるか実機確認するとよい。

## その後の拡張候補（着手前に `docs/adding-cards.md` 必読）
- **冒険のイベント20種**（横型枠は §0-18 対応済・カタログ研究は `docs/research/landscape_cards.md`・トークン中心/負債なし）。
- 発売順の未着手拡張（段階1すら未着手＝画像・カタログとも無し）：夜想曲/ルネサンス/移動動物園/同盟/略奪/日の出づる国。

## 守るべき進め方・流儀
- **新pendingは必ず4点セット**（engine reducer＋PLAYER_ACTIONS＋CPU decidePending＋UI viewPendingModal）＋終端保証。無いとCPU無限ループ／人間詰み。
- **イベントは「カード」でない**＝コスト軽減を受けず購入時トリガーも発動しない。**負債>0 の間はカードもイベントも購入不可**。返済は購入権を消費しない。
- **徴税の山キーは `pileKeyOf` で正規化**（分割山下段→上段・混合山→numericキー）を READ(triggerOnGain)/WRITE(TAX_PILE) 両方で通す。準備 seeding は分割山下段をスキップ。`state.pileDebt`/`p.donateNext` は非カード＝保存則 tally に混ぜない。
- **1機構ごとに**：狙い撃ち一時テスト（プロジェクト直下 `_*.tmp.js`＝gitignore・実行後必ず削除。cwd がずれるので実行前に `Set-Location`）→ `node test/invariants.test.js` 緑 → `npm test` 全緑 → 恒久回帰は該当 test へ。大きな決定は PROGRESS.md に追記。
- **substantiveなタスクは Workflow/Agent で多エージェント＋敵対的検証**（各finding は node 再現で確定）。公式ルールが曖昧なら研究エージェントで裏取り（wiki.dominionstrategy.com は WebFetch 不可＝WebSearch と RGG公式PDF・ultraboardgames・fandom・wikiwiki.jp を使う）。
- client資産（js/css/webp等）を変えたら `sw.js` の VERSION を上げる（現在 v47）。回答は日本語・フランクに短く。**push は勝手にしない＝完成→全テスト緑→都度ユーザー確認の上で**。**セッションが重くなったら促さず自動で /handoff**（記憶 auto-handoff）。**Read出力の汚染に注意**：断定前に Grep・`git show`・`Get-Content` で裏取り。

## 直近で完了した大仕事（参考）
- **§0-20 帝国イベント EV2＋EV3**（2026-07-11・未push・`52f7e7f`/`39d3129`）＝tax/donate/annex＋CARD_SET昇格＋CPU購入AI＋敵対レビュー確定バグ3件修正＋イベントwebp13種。
- **§0-20 帝国イベント EV0/EV1**（2026-07-11・未push・`8caabc0`）＝BUY_EVENT 基盤＋簡単10種。
- **§0-19 帝国ランドマーク21種＋絵**（2026-07-11・push済・本番 v46 実機確認）。
