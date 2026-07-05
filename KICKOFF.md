<!-- /handoff が自動生成（2026-07-06）。新セッションはこのファイルの指示に従う。手編集不要 -->

ウルトラコード（最大エフォート）で進めてください。

スマホ向けドミニオン対戦Webアプリ（CPU戦・2〜4人ローカル・オンライン対戦）の実装を引き継ぎます。回答/UIは日本語。
作業ディレクトリ: `c:\Users\b1242\claude\game\dominion` / branch: `main`（main直接作業運用。最新は `git log` で確認。**未pushコミット多数＝push はユーザー確認必須**）。

## まずやること（着手前の健全性確認）
1. `Set-Location 'C:\Users\b1242\claude\game\dominion'` して `npm test` → **29スイート・オールグリーン（exit 0）**・整合性 **3132件**・暗黒時代 **70件＋UI57件** を確認。
2. `PROGRESS.md` の **§0-8（暗黒時代 段階2 完了サマリ・許容簡略化）** と **§5（次タスク）**、§6 を読む。設計図＝`docs/adding-cards.md`（特殊機構は §C）。

## 現状：暗黒時代 段階2 ＝ 完成（全56枚 実プレイ化）
- 前セッションで暗黒時代を全56枚実プレイ化＋UI＋テスト＋**CARD_SET昇格（`darkages` 固定=Grim Parade／`random-darkages`）**＋webp9枚再生成（`sw.js` v35）＋多エージェント敵対レビュー10件修正まで完了。**全29スイート緑・出荷2セット280戦ソーク クリーン**。詳細は PROGRESS §0-8。
- **未pushコミット多数**（今回の暗黒時代作業＋前回の基盤）。**未pushなので本番はまだ v34・新プロモ段階2 のまま**。

## 次にやること（優先順）
1. **push 判断（最優先）**：暗黒時代は完成済み。**ユーザーに push してよいか確認**の上で main に push → GitHub Pages（sw.js v35）＋ Render 自動デプロイ。勝手に push しない。
2. **段階2の残り拡張＝発売順**（着手前に `docs/adding-cards.md` 必読）：
   - **冒険(Adventures)/帝国(Empires) の段階2（実プレイ化）**＝段階1（画像・カタログ）は済み(§0-6)。Reserve/酒場マット・トラベラー交換・旅トークン・負債コスト・分割山・城・命令・勝利点トークン・集合 など新機構が多い大仕事。
   - その先（画像・カタログとも未着手）：夜想曲/ルネサンス/移動動物園/同盟/略奪/日の出づる国。

## 進め方（厳守）
- **新pendingは engine reducer＋PLAYER_ACTIONS＋CPU decidePending＋UI viewPendingModal の4点セット必須**（漏れ＝CPU無限ループ/人間詰み/サーバ拒否/整合性赤）。「捨て→次へ」型reducerは前進前に `state.pending=null`。
- **非サプライ獲得は engine拒否とCPU非提案(`NON_SUPPLY_SET`)を必ずセット**。混合山の非対称（騎士=supply.knights＋state.knights／廃墟=state.ruinsのみ）は変えない。
- substantiveなタスクは Workflow で多エージェント＋敵対的検証（前回もこれで確定バグ10件を検出・修正）。使い捨てスクリプトは直下 `_*.tmp.js` で作り実行後**必ず削除**（コミットに混ぜない）。
- 1機構/1グループごとに `node test/invariants.test.js`（全プール混成fuzz）緑→こまめにコミット。大きな決定は PROGRESS.md へ。区切りで「今やったこと/次やること」報告。容量が重くなったら /handoff を促す。
- **webp再生成はこのPCのみ可**（`CARDS_ONLY=<ids> node tools/build-cards.js`・入力 `asset/art/*.png` は gitignore）。client資産を変えたら `sw.js` VERSION を上げる（現在 **v35**）。

## 次セッションが知らないと事故る事項
- **push 未実施**＝本番は暗黒時代を含まない（v34）。push 前に必ずユーザー確認。
- **避難所は「王国が KINGDOM_DARKAGES と内容一致」で `createInitialState` が自動ON**（opts不要）。random-darkages はOFF。この判定は変えない。
- **暗黒時代の許容簡略化（意図的・再議論しない・PROGRESS §0-8末）**：浮浪児→傭兵の玉座/行進経由リプレイ未対応（狂信者連鎖のみ）／on-trash対話キューの順序は多少前後し得る／BoM・行進は持続を対象外／納屋on-gainは自分手番のトップレベル勝利点獲得のみ。
- **`reshuffleDeck` は「捨て札を既存山札の下にappend」方式**（前回、山札の上N枚を見る系の保存則バグを修正した）。この不変を壊さない。
- **Read ツール出力の汚染に注意**（実在しないコードが混入して見えることがある）。実装状態を断定する前に Grep / `git show` の生確認で裏取り。
