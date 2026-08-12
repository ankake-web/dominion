<!-- /handoff が自動生成（2026-08-12）。新セッションはこのファイルの指示に従う。手編集不要 -->

**ウルトラコード（最大エフォート）で進めてください。**

スマホ向けドミニオン対戦Webアプリの続きです。
作業ディレクトリ＝`C:\Users\b1242\claude\game\dominion`／branch＝`main`（最新は `git log` で確認）。回答は日本語で。

## 最初にやること
1. `npm test` を実行し **全38スイート緑（exit 0・整合性4184・不変条件10・nocturne 371件＋nocturne-ui 87件・
   CPU序列 強vs弱100/強vs普通64/普通vs弱95）** を確認する。
2. `PROGRESS.md` の **§1（ゴール）／§5（未完了タスク）／§6（詰まり・注意点）** と、
   直近作業の **§0-28（夜想曲＝完成・push済）** を読む。
3. 新しい拡張に着手する前に **`docs/adding-cards.md`**（段階1→段階2の実装設計図）を必ず読む。

## 次に取り組むタスク（優先順1位）
**発売順の未着手拡張＝同盟（Allies）／略奪（Plunder）／日の出づる国（Rising Sun）のうち1つを選び、段階1から始める。**
3つとも**段階1すら未着手**（`DOM.CARDS` にカタログ無し・絵も無し）。どれを先にやるかはユーザーに確認すること。

進め方は夜想曲（§0-27＋§0-28）と移動動物園（§0-25＋§0-26）が最新の手本：
1. **公式ルールの多エージェント研究**（`docs/research/<expansion>_rules.md` を起こす）。
   一次資料の取り方はメモリ `dominion-rules-research-method` が正本＝
   **RGG がホストする PDF は初版のことがある**（夜想曲で実際に踏んだ）／**英語wiki は Wayback 経由＝`tools/wikifetch.py`**／
   **日本語名はホビージャパン印刷版＝日本語wiki が正本**（英語wiki の Japanese 行は信用しない）。
   研究班とは**別のエージェント**に一次資料で敵対検証させること。
2. **段階1**＝カタログ（`DOM.CARDS` / `DOM.LANDSCAPES`）＋孤立プール＋`GAIN_ORDER`＋カード一覧の群＋webp生成。
   この時点では **CARD_SETS から参照しない＝本番挙動は不変**。
3. **段階2**＝新機構の基盤 → カード効果 → **CARD_SET 昇格** → 多エージェント敵対レビュー → CPUソーク →
   `verify:e2e` / `verify:visual` → 絵の回収 → PROGRESS 更新 → **ユーザー確認の上で** push。

## 守るべき進め方・流儀（このプロジェクト固有）
- **簡略化より忠実性**。やむを得ず簡略化したら PROGRESS に「許容簡略化」と理由を必ず書く。
- **新しい pending は4点セット必須**＝engine reducer ＋ `PLAYER_ACTIONS` 登録 ＋ CPU `decidePending` 分岐 ＋
  UI `viewPendingModal` 分岐（＋終端保証）。欠けると **CPU 無限ループ／人間が詰む**。
- **CPU の `decidePending` は絶対に `null` を返さない**（オンラインで `reduce(state,null)` が TypeError → 部屋が固まる）。
- **engine を締める修正と CPU を締める修正は必ず同一コミット**（片方だけだと本番 livelock）。
- **獲得可否・コスト比較は engine の述語を使う**（`gainableBase`/`costUpTo`/`costUnder`/`costExact`/`sameCost`）。
  素の `cardCost(state,id) <= N` を書くと非サプライ・分割山下段・ポーション/負債を取りこぼす。
  ただし**非サプライ札を候補にしたい効果ではこれらを使わない**（`gainableBase` が弾く＝候補ゼロで livelock。夜想曲で実際に踏んだ）。
- **`t.actions += n` / `t.coins += n` を直接書かない**（`addActions` / `addCoins` を通す＝雪深い村・カメレオンが壊れる）。
  財宝の効果は `applyTreasureEffect`／公開は `reveal()`／廃棄は `trashCard()`／獲得は `gain()` を通す。
- **多エージェント敵対レビューを必ず行う**（観点ごとに finder → 別エージェントが node で再現して確定。偽陽性は棄却）。
- **push は毎回ユーザー確認を取る**（コミットは随時してよい）。
- **client 資産（js/css/webp 等）を変えたら `sw.js` の VERSION を上げる**（現在 **v62**）。
- 使い捨てスクリプトは**プロジェクト直下に `_*.tmp.js`**（gitignore 済み）で作り、実行後に必ず削除。
  一時ファイルは scratchpad へ。実行前に `Set-Location 'C:\Users\b1242\claude\game\dominion'`。

## 次セッションが知らないと事故る事項
- **未push のコミットは無い／作業ツリーはクリーン**。夜想曲は本番反映済み（Pages `sw.js` v62・Render 実機確認済み）。
- **絵（webp）は実装済みの全598枚（縦450＋横148）に入っている**。絵の有無はファイルサイズで見分けられる
  （枠＋文字だけ＝36〜66KB／絵入り＝73〜201KB）。再生成は**このPCのみ**
  （縦型 `CARDS_ONLY=<ids> node tools/build-cards.js`／横型 `tools/build-landscape.js`。入力の `images/`・`asset/art/` は gitignore）。
- **ChatGPT の生成順は指示順と一致しないことがある**＝絵の回収は**必ず全枚をエージェントに実見させて id を確定**する
  （移動動物園で3グループが不一致だった）。手順はメモリ `chatgpt-card-art-workflow`。
- **GitHub Pages のデプロイが失敗し続けたら「ゾンビ化した進行中デプロイ」を疑う**＝
  `gh api -X POST repos/ankake-web/dominion/pages/deployments/<旧SHA>/cancel` で解除（PROGRESS §6 に詳細）。
  失敗した run の `rerun` は必ず失敗する＝**空コミットを積んで push し直す**。
- 夜想曲を触るときの落とし穴（`turn.phase==='buy'` の誤爆／祝福・呪詛の解決中に再演を割り込ませない／
  呪われた金貨は `PLAY_ALL_EXCLUDE`／人狼は夜でも「アクションの使用」 等）は **PROGRESS §0-28 の「注意」節**と
  **`docs/research/nocturne_rules.md` 冒頭の「実装前に必読」18項目**に全部ある。
