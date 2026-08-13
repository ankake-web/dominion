<!-- /handoff が自動生成（2026-08-13）。新セッションはこのファイルの指示に従う。手編集不要 -->

**ウルトラコード（最大エフォート）で進めてください。**

スマホ向けドミニオン対戦Webアプリの続きです。
作業ディレクトリ＝`C:\Users\b1242\claude\game\dominion`／branch＝`main`（最新は `git log` で確認）。回答は日本語で。

## 最初にやること
1. `npm test` を実行し **全40スイート緑（exit 0・整合性 4765・不変条件 12・同盟 489件・同盟UI 261件）** を確認する。
2. `PROGRESS.md` の **§0-29（同盟。特に「段階2 A5」節と A4／A5 の注意）／§1（ゴール）／§5（未完了タスク）／§6（詰まり）** を読む。
3. 同盟のカードを触るなら **`docs/research/allies_rules.md` 冒頭の「実装前に必読」9項目**（554KB と巨大なので
   全部読まず Grep で必要な節だけ）。

## いまどこ
新拡張 **同盟（Allies）＝A5（CARD_SET 昇格）まで完了＝実プレイ可能になった**（`sw.js` **v68**）。
- ✅ 研究／段階1（カタログ72種＋webp78枚）／**A1**（好意・Ally 選定）／**A2**（分割山6組＋循環）／
  **A2b**（種別は山の一番上で判定）／**A3**（Ally 23種）／**A4**（王国49種）＝ここまで **push 済**（v67）。
- ✅ **A5＝CARD_SET 昇格**（**push 済・本番反映を実機確認**）＝`allies`（固定10種）／`random-allies`／
  mix-all（14→15拡張）／`DOM.STAGE1_POOLS` を空に（**闇市場に同盟の非分割25種が入る**）／
  CPU の `GAIN_ORDER` を実強度順へ／**多エージェント敵対レビュー確定10件を全修正**。
- **作業ツリーはクリーン／未pushなし**。本番確認済み＝Pages は `sw.js` v68＋主要5ファイルがローカルと sha1 一致、
  Render は実 ws で `kingdomSet=allies` が受理され Ally 1枚・好意1個・分割山3組×16枚を配信。
- **絵（webp）が入っていないのは同盟の78枚だけ**（縦55＋横23＝枠＋文字のみ・47〜67KB）。他の598枚には絵がある。

## 次に取り組むタスク（優先順1位）＝**絵（webp）72枚の回収**
王国49＋Ally 23＝72枚。**分割山のプレースホルダ6枚（卜占官/衝突/城砦/叙事詩/町民/魔法使い）は
その山の最安カードの絵を流用**すればよい（城 `castles` と同じやり方）。
1. 指示文はメモリ `chatgpt-card-art-workflow` の書式で8バッチ（K1〜K5＝王国49／A1〜A3＝Ally 23）。
   ※前セッションで作った指示文が scratchpad の `allies_art_prompts.md` にある（無ければ作り直す）。
2. ユーザーが ChatGPT で生成 → `C:\Users\b1242\Downloads` に落ちる（**ファイル名は付けられない**）。
3. **⚠ ChatGPT は指示した順番どおりに生成するとは限らない**＝連番で機械割当せず、
   **タイムスタンプでグループ化 → グループごとにエージェントを立てて全枚を実見判別**する。
   枚数を予定と突き合わせる（**同じバッチを二重生成していることがある**＝後発を採用）。
4. `asset/art/<id>.png` へ回収 → `CARDS_ONLY=<ids> node tools/build-cards.js`（縦型）／
   `CARDS_ONLY=<ids> node tools/build-landscape.js`（横型）。**このPCでしかできない**（入力は gitignore）。
5. 絵が入ったかは webp のサイズで検算（枠＋文字＝47〜67KB／絵入り＝73〜201KB）＋モンタージュで目視。
6. `sw.js` の VERSION を上げる（v68→v69）→ `npm test` / `verify:e2e` → PROGRESS 更新 → **ユーザー確認の上で** push。

その後の候補＝**未着手の拡張（略奪／日の出づる国）**。着手前に `docs/adding-cards.md` を読むこと。

## 守るべき進め方・流儀（このプロジェクト固有）
- **簡略化より忠実性**。やむを得ず簡略化したら PROGRESS に「許容簡略化」と理由を必ず書く。
- **新しい pending は4点セット必須**＝engine reducer ＋ `PLAYER_ACTIONS` 登録 ＋ CPU `decidePending` 分岐 ＋
  UI `viewPendingModal` 分岐（＋終端保証）。欠けると **CPU 無限ループ／人間が詰む**。
- ★**述語を1つ足したら「窓を開く条件・受理・CPU の候補・UI のフィルタ」の4面を必ず同時に直す**。
  **受理側だけ締めるのが本プロジェクトで最も再発する事故**。
- ★**回数制限つき／候補つきの窓は「積むとき」だけでなく「解決するとき」にも必ず再検査する**
  （A5 の [high]＝蛮族×リッチで候補が枯れて窓が閉じず本番 livelock になった）。
- **CPU の `decidePending` は絶対に `null` を返さない**（オンラインで `reduce(state,null)` が TypeError → 部屋が固まる）。
- **獲得可否・コスト比較は engine の述語**（`gainableBase`/`costUpTo`/`costUnder`/`costExact`/`sameCost`）。
  **カードの種別は `isTypeSupply`**（混合山＝一番上）。ただし**「山のコスト・種別」は randomizer**。
  **非サプライ札を候補にしたい効果では `costUpTo` 系を使わない**（候補ゼロ→livelock）。
- `t.actions += n` / `t.coins += n` を直接書かない（`addActions`/`addCoins`）。財宝の効果は `applyTreasureEffect`／
  公開は `reveal()`／廃棄は `trashCard()`／獲得は `gain()`／サプライ外からの獲得は `gainFromOutside()`／
  サプライの山からの廃棄は `trashFromSupplyPile()`／山へ戻すのは `returnToPile()`／シャッフルは `reshuffleDeck()`／
  手札から使えるかは `canPlayHandCard()`。
- **混合山から獲得するログは `gain()` の前に `mixedTopCard` を評価する**（後だと次の札の名前になる＝A5 で8箇所直した）。
- **選択系モーダルの確定は必ず `takeSelection()` を通す**（`UI.selection` を持ち越さない）。
- **多エージェント敵対レビューを必ず行う**（観点ごとに finder → 別エージェントが node/jsdom で再現して確定。偽陽性は棄却）。
  A2〜A5 の確定45件のうち **15件超が「同盟と無関係な既存バグ」**だった＝毎回やる価値がある。
- **push は毎回ユーザー確認を取る**（コミットは随時してよい）。
  **既存バグの修正が入ったら拡張の完成を待たずに push を提案する**。
- **client 資産（js/css/webp 等）を変えたら `sw.js` の VERSION を上げる**（現在 **v68**）。
- 使い捨てスクリプトは**プロジェクト直下に `_*.tmp.js`**（gitignore 済み）で作り、実行後に必ず削除。
  一時ファイルは scratchpad か `c:\tmp` へ。

## 次セッションが知らないと事故る事項
- **`js/engine.js` と `js/cpu.js` は CRLF・`js/ui.js` は LF**。スクリプトで一括置換するときは改行を合わせること
  （`\n` の複数行パターンが engine.js だけマッチしない）。Edit ツールは改行を保つので基本はそちらを使う。
- **Git Bash の `/tmp` と node の `/tmp`（＝`C:\tmp`）は別物**。両方から触るファイルは `c:/tmp/...` を使う。
- **`END_TURN` は購入フェイズからしか通らない**（`t.phase !== 'buy'` は状態不変で拒否）。テストで手番を送るときは
  `END_ACTION_PHASE` → `END_TURN` の2手。**また `DOM.KINGDOM_ALLIES` で対局を作るとターン1に Ally の窓が
  開くことがある**（`opts.ally` で窓の無い Ally＝`plateau_shepherds` 等を固定するか、連携の無い王国を使う）。
- **`p.voyageExtra` は「残り予約数」**（旗ではない）。リッチのスキップで取り直すために残す設計＝`=0` で全部消す
  実装に戻すと公式例（航海2枚＋リッチ）が壊れる。使い切れなかった残りは `finishTurnAdvance` の末尾で必ず捨てる。
- **`chain`（連続手番）は「実際にプレイされたターン」で数える**＝リッチで飛ばしたターンは連続を切らない。
  島民と航海の「3ターン連続にはできない」が両方これを見ている。
- **`DOM.STAGE1_POOLS` は空になった**。段階1（カタログと画像だけ）の拡張を足したら**必ずここに入れる**
  （入れないと闇市場に「買っても何も起きない死に札」が $0 で並ぶ）。
- **CPU は闇市場で同盟のカードを買わない**（黒市の候補は `GAIN_ORDER` の先頭38枚＝銀貨より上だけ）＝
  **闇市場×同盟は「人間だけが通る道」**。CPUソークを何戦回してもこの経路の検証にはならない。
- **`lingerAttackEnter` を使う持続アタック（追いはぎ/将軍/呪いの森/沼の妖婆/門番）は
  `state.pending.type` にカード名を変数で入れる**＝リテラル検索や機械的な突き合わせをすり抜ける。
  UI の `viewPendingModal` と `LINGER_REACT` の許可リストに**手で**足すこと。
- **「見る（look at）」効果を足したら `maskStateFor` の私的看破リストに足す**（`pending.cards` を持つ型名）。
  偵察隊／夜警／粉屋・歩哨 と**3回続けて同じクラスの漏れ**を出している。
- **混合山の正本は `DOM.engine.MIXED_PILE_KEYS`**（廃墟/騎士/城＋同盟の分割山6組＝9山）。
  **「山キー」はプレースホルダ＝実在する1枚ではない**（プレイヤーのゾーン・廃棄置き場・闇市場デッキ・
  相続の脇・命令の対象・宣言モーダルの候補 に入れない）。`id !== 'knights'` を書かず `isMixedPileKey()`。
- **山の上に載せる効果（山上VP・負債・山トークン・好意トークン）の READ は必ず `pileKeyOf` を通す**。
- **Ally が起こす攻撃（魔女の輪／すり師団）は `ATTACKS` に登録しない**（堀で防げてしまう）。
- **保存則ソークを自作するときの落とし穴**：① 王国に**横型のid（イベント等）を混ぜない**（`C()[id].potion` で落ちる）。
  ② tally の比較に `JSON.stringify` を使わない（キーの挿入順で差分が出る）。
  ③ ZONES に `contractSetAside` を入れ、**`p.archives`（帝国・資料庫）と `turn.possessionGains/Trash` も数える**
  （`test/invariants.test.js` の tally が正本。mix-all に同盟が入った今、抜けると偽陽性の赤になる）。
  ④ CPU は MONEY 戦略だと王国カードを買わないので、**supply / 混合山から抜いて**各自の山札に配ってから回す。
- **英語wiki は Wayback 経由＝`python tools/wikifetch.py <Page>`**。**出力の `snapshot=` の年を必ず見る**
  （2022 より古いと同盟の発売前）。**2025年12月以降のキャプチャは bot 検知画面**。
- **GitHub Pages のデプロイが失敗し続けたら「ゾンビ化した進行中デプロイ」を疑う**＝
  `gh api -X POST repos/ankake-web/dominion/pages/deployments/<旧SHA>/cancel`（PROGRESS §6 に詳細）。
  失敗した run の `rerun` は必ず失敗する＝**空コミットを積んで push し直す**。
- **本番サーバ（Render）が新しい engine で動いているかの確かめ方**＝実 ws（`wss://dominion-server-1hc9.onrender.com/ws`・
  Origin 必須・メッセージは `t:` キー。`create`→`joined` / `setCpu`+`setConfig`→`start` / 盤面は `started`・`state`）で
  対戦を開始し、**配信 state に新しく足したフィールドがあるか**を見るのが決定的。
  ※サーバは `DOM.CARD_SETS` から許可IDを導出するので、`allies`/`random-allies` はサーバ側の変更なしで受理される。
