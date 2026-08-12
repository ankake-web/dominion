<!-- /handoff が自動生成（2026-08-12）。新セッションはこのファイルの指示に従う。手編集不要 -->

**ウルトラコード（最大エフォート）で進めてください。**

スマホ向けドミニオン対戦Webアプリの続きです。
作業ディレクトリ＝`C:\Users\b1242\claude\game\dominion`／branch＝`main`（最新は `git log` で確認）。回答は日本語で。

## 最初にやること
1. `npm test` を実行し **全38スイート緑（exit 0・整合性 4763・不変条件10）** を確認する。
2. `PROGRESS.md` の **§0-29（同盟＝いま作業中）／§1（ゴール）／§5（未完了タスク）／§6（詰まり・注意点）** を読む。
3. **`docs/research/allies_rules.md` 冒頭の「実装前に必読」9項目**を読む（同盟の正本・554KB。
   巨大なので全部読まず、Grep で必要な節だけ読むこと）。

## いまどこ
新拡張 **同盟（Allies）** に着手中。**未push（5コミット）／作業ツリーはクリーン**。
- ✅ 公式ルール研究（多エージェント22体＝11群を収集→各群を別エージェントが一次資料で敵対検証）
- ✅ **段階1**＝カタログ72種（王国49＋同盟カード23）＋分割山プレースホルダ6＋webp78枚（**絵は未回収＝枠＋文字だけ**）
- ✅ **段階2 A1**＝好意(Favor)トークン `p.favors` と 同盟(Ally)カードの選定基盤 `state.ally`
- ⛔ **CARD_SETS 未参照＝実プレイには出ない。本番挙動は不変**（闇市場にも出ないよう `DOM.STAGE1_POOLS` で塞いである）

## 次に取り組むタスク（優先順1位）＝段階2の **A2＝分割山6組**
同盟の分割山は **4種×4枚＝16枚**（卜占官/衝突/城砦/叙事詩/町民/魔法使い）。
**帝国の `DOM.SPLIT_PILES`（下段id→上段id の2段専用）では表現できない**ので、
**混合山（`state.castles` / `state.knights`）と同型**にする＝`state[pileId]` に実カードid配列を持ち、
`supply[pileId]` が残数、**一番上の1枚だけ購入/獲得できる**。並び順は既に `DOM.ALLIES_SPLIT_PILES` にある（安い順）。

**要点（詳細は PROGRESS §0-29 の「次にやること」3番と注意節）**
- engine 内に **`['ruins','knights','castles']` のハードコードが7箇所**ある
  （`gain` の `isMixed`／`trashFromSupplyPile`／`pileKeyOf`／`cardCost` の分岐／闇市場の `mixedContents`／
  `emptyPileCount`／`BLACK_MARKET_BUY` の `isMixedPile`）。**まず1箇所に集約してから6山ぶん広げること。**
- **`test/invariants.test.js` の tally にも6山を足す**（漏れると保存則が誤検知で赤になる）。
- **循環(Rotate)＝先頭からの「連続」同名ブロックを末尾へ移す**（離れた同名は動かさない）。任意。空の山でも合法（無効果）。
- **循環の位置はカードごとに違う**＝生徒(Student)だけ「循環 → その後に強制廃棄」で循環が先。
- **戦闘計画(Battle Plan)だけが「任意のサプライ山」を回せる**（騎士/廃墟/城/サウナも対象）。他5枚は自分の山を名指し。
- **「山のコスト・種別」は randomizer 固定（＝最安カード）／「買うときのコスト」は今の一番上**。混同しない。

その後は **A3＝Ally 23種 → A4＝王国カード49種 → A5＝CARD_SET 昇格 → 敵対レビュー → 絵の回収 → push**。

## 守るべき進め方・流儀（このプロジェクト固有）
- **簡略化より忠実性**。やむを得ず簡略化したら PROGRESS に「許容簡略化」と理由を必ず書く。
- **新しい pending は4点セット必須**＝engine reducer ＋ `PLAYER_ACTIONS` 登録 ＋ CPU `decidePending` 分岐 ＋
  UI `viewPendingModal` 分岐（＋終端保証）。欠けると **CPU 無限ループ／人間が詰む**。
- **CPU の `decidePending` は絶対に `null` を返さない**（オンラインで `reduce(state,null)` が TypeError → 部屋が固まる）。
- **engine を締める修正と CPU を締める修正は必ず同一コミット**（片方だけだと本番 livelock）。
- **獲得可否・コスト比較は engine の述語を使う**（`gainableBase`/`costUpTo`/`costUnder`/`costExact`/`sameCost`）。
  ただし**非サプライ札を候補にしたい効果ではこれらを使わない**（`gainableBase` が弾く＝候補ゼロで livelock）。
- **`t.actions += n` / `t.coins += n` を直接書かない**（`addActions` / `addCoins` を通す）。
  財宝の効果は `applyTreasureEffect`／公開は `reveal()`／廃棄は `trashCard()`／獲得は `gain()` を通す。
- **多エージェント敵対レビューを必ず行う**（観点ごとに finder → 別エージェントが node で再現して確定。偽陽性は棄却）。
- **push は毎回ユーザー確認を取る**（コミットは随時してよい）。
- **client 資産（js/css/webp 等）を変えたら `sw.js` の VERSION を上げる**（現在 **v63**）。
- 使い捨てスクリプトは**プロジェクト直下に `_*.tmp.js`**（gitignore 済み）で作り、実行後に必ず削除。
  一時ファイルは scratchpad か `c:\tmp` へ。実行前に `Set-Location 'C:\Users\b1242\claude\game\dominion'`。

## 次セッションが知らないと事故る事項
- **未push のコミットが5つある**（研究doc／段階1の下準備／段階1カタログ／A1／PROGRESS）。push はユーザー確認の上で。
- **占星術師団／メイソン団 × `reshuffleDeck` の設計判断は決着済み**＝
  **(a) 常設方針（`p.favorShuffle`＝1回のシャッフルに使う好意の上限）＋どの札を選ぶかはエンジンが自動選択**。
  理由＝`reshuffleDeck` は同期・非対話で74箇所から呼ばれ、`draw()`→`applyEffect` の途中で起きるため
  完全非同期化は14拡張すべてに回帰リスクが及ぶ（星図・へそくりと同じ判断）。**再議論しない。**
- **Ally が起こす攻撃は「アタックカードのプレイ」ではない＝堀で防げない**（魔女の輪・すり師団の公式FAQ）。
  **`ATTACKS` に登録してはいけない／`attackImmune` を通してはいけない。**
- **生徒(Student) は魔法使い(Wizards)の分割山の中に居る連携(Liaison)**。`kingdom` は山IDしか持たないので、
  山IDだけを見る判定では Ally も好意も出ないゲームになる（`alliesHasLiaison` は既に中身4種まで走査済み）。
- **好意は `p.coffers`/`p.villagers` と完全に別枠**。**駐屯地(Garrison)のトークンは好意ではない**（自前のカウンタ）。
- **`test/edition2.test.js` の「堀は全アタックを無効化」が 213→220 件に増えている**のは同盟のアタック7種が
  自動で加わったぶん（いまは効果ゼロで通っている＝**A4 でアタックを実装したとき MOAT 配線漏れを自動検出してくれる**）。
- **`DOM.STAGE1_POOLS = ['allies']`**（`js/cards.js`）＝闇市場デッキから同盟を除外している。
  **A5（CARD_SET 昇格）でこの配列から `'allies'` を外すこと**（忘れると同盟を実プレイ化しても闇市場に出ない）。
- **絵（webp）は同盟の78枚だけ枠＋文字**（47〜67KB）。他の598枚には絵が入っている。
  絵の回収は A5 の後（手順はメモリ `chatgpt-card-art-workflow`。**ChatGPT の生成順は指示順と一致しないので必ず全枚を実見**）。
  分割山のプレースホルダ6枚は最安カードの絵を流用してよい（城 `castles` と同じやり方）。
- **英語wiki は Wayback 経由＝`python tools/wikifetch.py <Page>`**。**出力の `snapshot=` の年を必ず見る**
  （古い年にフォールバックすると拡張の発売前のページを読む）。**2025年12月以降のキャプチャは bot 検知画面**。
- **GitHub Pages のデプロイが失敗し続けたら「ゾンビ化した進行中デプロイ」を疑う**＝
  `gh api -X POST repos/ankake-web/dominion/pages/deployments/<旧SHA>/cancel`（PROGRESS §6 に詳細）。
  失敗した run の `rerun` は必ず失敗する＝**空コミットを積んで push し直す**。
