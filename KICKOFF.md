<!-- /handoff が自動生成（2026-08-11）。新セッションはこのファイルの指示に従う。手編集不要 -->

**ウルトラコード（最大エフォート）で進めてください。**

スマホ向けドミニオン対戦Webアプリの開発。
作業ディレクトリ＝`C:\Users\b1242\claude\game\dominion` ／ branch＝`main`（最新は `git log` で確認）。回答は日本語。

## 最初にやること
1. `npm test` を実行し、**全36スイート・オールグリーン（exit 0）**を確認する
   （整合性 **4182**／不変条件 **10**／CPU序列 100/64/95 など）。赤ならまずそこを直す。
2. `PROGRESS.md` の **§0-27（夜想曲の現状）**／§1（ゴール）／§5（未完了タスク）／§6（注意点）を読む。
3. **`docs/research/nocturne_rules.md` 冒頭の「実装前に必読」18項目を必ず読む**（これが夜想曲の実装の正本。
   49万字あるので全部読む必要はない。カードを実装するときに該当パートを引く）。
4. 新しいカードを足す前に `docs/adding-cards.md`（engine の全機構の実装手順＋落とし穴）も参照する。

## いまの状態
**新拡張「夜想曲（Nocturne）」に着手中。未pushのコミットが3つある**（段階1＋段階2-N0＋tools）。
- 済み＝**研究**（多エージェント14体・敵対検証つき）／**段階1**（カタログ77種＝縦48＋横29、webp 77枚、`sw.js` v59）／
  **段階2-N0**（夜フェイズ `turn.phase='night'`＋`PLAY_NIGHT`、家宝の開始デッキ置換、非サプライ5山、
  祝福/呪詛デッキ、状態、脇札2種、ゾンビ3枚を trash へ）。
- **まだ `DOM.CARD_SETS` 未参照＝実プレイには出ない**（本番挙動は不変）。カードの効果はまだ空。
- 本番（Pages v58 / Render）は移動動物園までの状態で稼働中。

## 次に取り組むタスク（優先順1位）＝ 夜想曲の段階2を完成させる
§0-27 の「次にやること」を上から順に。要点だけ再掲：
1. **N0b＝UI の夜フェイズ操作**（手札の夜行カードを光らせて `PLAY_NIGHT` を dispatch／フェイズ表示／
   夜フェイズでも「ターン終了」が押せる）。**これが無いと人間が夜行カードを使えない**。
2. **N1＝祝福12＋呪詛12＋状態5**。`receiveBoon`/`receiveHex` の共通機構。
   **複数枚を順に受ける**（ドルイド／愚者3枚／恵みの村／ピクシー2回）ので `state.pending` に直接代入せず**キューに積む**。
3. **N2＝素直な王国カード** → **N3＝夜行カード15種** → **N4＝複雑**（ネクロマンサー／取り替え子の交換／
   幽霊の2回使用／吸血鬼↔コウモリの交換）。
4. **N5＝CARD_SET 昇格**（固定10種を選ぶ）→ 多エージェント敵対レビュー → UIテスト新設・CPUソーク・
   `verify:e2e`／`verify:visual`。
5. **絵（webp）77枚の回収**（記憶 `chatgpt-card-art-workflow` の手順）→ PROGRESS 更新 → **ユーザー確認の上で** push。

各バッチの末で `node test/invariants.test.js` 緑＋`npm test` 全緑を確認してコミットする。

## 守るべき流儀
- **ウルトラコードで多エージェント＋敵対的検証**。**各 finding は必ず node で再現してから直す**（偽陽性は棄却）。
  今回の研究でも敵対検証が「RGG の PDF が初版だった」という致命的な誤りを発見している。
- **完全忠実 > 簡略化**。簡略化するなら PROGRESS に「許容簡略化」と理由を必ず書く。
- **push は毎回ユーザー確認を取る**（コミットは随時してよい）。push 後は Pages/Render の本番反映を実機確認する。
- 使い捨てスクリプトは**プロジェクト直下に `_*.tmp.js`**（gitignore 済み）で作り、実行後に必ず削除。一時ファイルは scratchpad へ。
- client 資産（js/css/webp 等）を変えたら **`sw.js` の VERSION を上げる**（現在 **v59**）。
- 進捗・決定は `PROGRESS.md` に追記する。

## 次セッションが知らないと事故ること（夜想曲固有）
- **`turn.phase === 'buy'` 判定の誤爆が最大のリスク**。夜フェイズは購入フェイズではない
  （冠のモード分岐／ヴィラ／公会堂／列柱／汚された神殿／徴税の `gainWasBuyPhase`／闘技場／浴場／
  `t.treasuresLocked`／ピアッツァ／使者／行商人のコスト／-$1トークン／Undo の同フェイズ判定）。
- **祝福・呪詛・状態は「カード」ではない**（`allCards` にも保存則 tally にも入れない）。
  **家宝・ゾンビ・脇札2種（`p.ghostSetAside`／`p.cryptSetAside`）は物理カード**（数える）。取り違えると保存則が即赤。
- **錯乱/嫉妬は「持っている＝効いている」ではない**＝購入フェイズ開始時に**返して**初めて発動する2階建て
  （`p.deluded`/`p.envious` と `t.cantBuyActions`/`t.enviousActive`）。`END_ACTION_PHASE` は1ターンに複数回走る。
- **呪詛はリアクションを全員ぶん閉じてから1枚だけめくる**（被害者ごとに引き直さない）。
- **「交換」は獲得でも廃棄でもない**（吸血鬼↔コウモリ／取り替え子）が `supply` は増減する（3山終了に影響）。
- **取り替え子の日本語版カードは公式に誤訳**。カタログは訂正版を採用済み＝**印刷文に差し戻してはいけない**
  （`js/cards.js` の夜想曲ブロック冒頭コメントに理由を明記してある）。
- 新 pending は必ず**4点セット**（engine reducer＋`PLAYER_ACTIONS`＋CPU `decidePending`＋UI `viewPendingModal`）。
  **CPU の `decidePending` で `null` を返さない**（オンラインで `reduce(state,null)` が TypeError → 部屋が固まる）。
- 獲得可否・コスト比較は必ず `DOM.engine` の述語（`gainableBase`/`costUpTo`/`costUnder`/`costExact`/`sameCost`）。
  **`t.actions += n` / `t.coins += n` を直接書かない**（`addActions`/`addCoins`）。**財宝の効果は `applyTreasureEffect`**。
- **英語wiki は `tools/wikifetch.py` で読む**（本体は bot 検知で開けない。Wayback 経由＋コスト記号を `[$4]` に復元）。
  日本語のカード名・文面は日本語wiki（wikiwiki.jp/dominiondeck）が正本。
- 絵の webp 再生成は**このPCでしかできない**（入力の `images/`・`asset/art/` は gitignore）。
  縦型 `CARDS_ONLY=<ids> node tools/build-cards.js`／横型 `CARDS_ONLY=<ids> node tools/build-landscape.js`。
- **GitHub Pages のデプロイが詰まったら** PROGRESS §6 の「ゾンビ化」の項
  （`gh api -X POST repos/ankake-web/dominion/pages/deployments/<旧SHA>/cancel`）。
