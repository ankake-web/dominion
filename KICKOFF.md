<!-- /handoff が自動生成（2026-07-12）。新セッションはこのファイルの指示に従う。手編集不要 -->

ウルトラコード（最大エフォート）で進めてください。

スマホ向けドミニオン対戦Webアプリ（CPU戦・2〜4人ローカル・オンライン対戦）の実装を引き継ぎます。回答/UIは日本語。
作業ディレクトリ: c:\Users\b1242\claude\game\dominion / branch: main（main直接作業運用。最新は git log で確認）。

## まずやること
1. `Set-Location 'C:\Users\b1242\claude\game\dominion'` して `npm test` → **35スイート・オールグリーン（exit 0・整合性3149・不変条件7・横型イベント149（events＝帝国13＋冒険20）・帝国269＋UI75・ランドマーク80・冒険59＋UI67・暗黒時代87＋UI57・新プロモ165＋UI22・繁栄69・異郷83＋UI44・収穫祭107・ギルド81＋UI25・CPU序列 強vs弱100/強vs普通64/普通vs弱95）** を確認。
2. `PROGRESS.md` 先頭サマリ＋**§0-21（冒険イベント20種・push済）**を読む。横型の設計正本＝`docs/research/landscape_cards.md`＋`landscape_gaps.md`（※**2022エラッタ前の記述が混じる**＝§0-21 の裁定が新しい）。全体設計図＝`docs/adding-cards.md`。

## 現状：冒険イベント20種まで完了＝**本番反映済み**（`aa0c185`・`sw.js` v48）
`adventures-events`（冒険固定10＋イベント2抽選）が本番で実プレイ可能。**帝国も冒険も、縦型＋横型すべて実プレイ可能**になった。
この作業で**既存エンジンの全体ルールの穴を2つ修正**＝①一度でも購入したらそのターンは財宝を出せない（`t.treasuresLocked`・**購入フェイズ単位**＝ヴィラで戻ったら解除）／②使者の「最初の購入」にイベント購入を数える。
敵対レビュー4観点で確定9件＋既存バグ1件を修正（ヴィラ×財宝ロックの退行[high]・使節団×闇市場のCPU無限ループ[high]・偵察隊/保存のオンライン情報漏洩・山トークンの分割山孤児化 ほか）。

## 次に取り組むタスク（優先順1位）：**次の拡張候補**（着手前に `docs/adding-cards.md` 必読）
- **発売順の未着手拡張**（段階1すら未着手＝画像・カタログとも無し）：夜想曲/ルネサンス/移動動物園/同盟/略奪/日の出づる国。
- **冒険イベント20種の絵（webp）回収**（今は枠＋文字だけ。`asset/art/<id>.png` に絵を置いて `CARDS_ONLY=<ids> node tools/build-landscape.js`）。

## 守るべき進め方・流儀
- **新pendingは必ず4点セット**（engine reducer＋PLAYER_ACTIONS＋CPU decidePending＋UI viewPendingModal）＋終端保証。無いとCPU無限ループ／人間詰み。**engine が拒否する手はCPUにも提案させない**（同じ述語を engine が公開して3面で共有する＝`canBuyEvent`／`inheritedEstate`／`actionSupplyPiles` 等）。
- **山トークンの山キーは `pileKeyOf` で正規化**（分割山＝上段キー）を READ/WRITE 両方で通す。**`p.inherited`（相続の脇置き）は物理カード**＝保存則 tally に数える。
- **1機構ごとに**：狙い撃ち一時テスト（直下 `_*.tmp.js`＝実行後必ず削除。cwd がずれるので実行前に `Set-Location`）→ `node test/invariants.test.js` 緑 → `npm test` 全緑 → 恒久回帰は該当 test へ。大きな決定は PROGRESS.md に追記。
- **substantiveなタスクは Workflow/Agent で多エージェント＋敵対的検証**（各finding は node 再現で確定）。公式ルールが曖昧なら研究エージェントで裏取り（wiki.dominionstrategy.com は WebFetch 不可＝WebSearch＋RGG公式PDF＋fandom＋wikiwiki.jp。**RGG の Adventures PDF は2022エラッタ前**なので鵜呑みにしない）。
- client資産（js/css/webp等）を変えたら `sw.js` の VERSION を上げる（現在 v48）。回答は日本語・フランクに短く。**push は勝手にしない＝完成→全テスト緑→都度ユーザー確認の上で**。**セッションが重くなったら促さず自動で /handoff**（記憶 auto-handoff）。**Read出力の汚染に注意**：断定前に Grep・`git show`・`Get-Content` で裏取り。

## 直近で完了した大仕事（参考）
- **§0-21 冒険イベント20種**（2026-07-12・push済 `aa0c185`・本番 v48 実機確認）＝軽量11＋山トークン6（新種別＝渡し船の-$2コスト／立案の廃棄）＋重量3（保存/使節団/相続＝屋敷が命令アクション）。
- **§0-20 帝国イベント13種**（2026-07-11・push済・v47）／**§0-19 帝国ランドマーク21種＋絵**（v46）。
