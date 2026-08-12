<!-- /handoff が自動生成（2026-08-12）。新セッションはこのファイルの指示に従う。手編集不要 -->

**ウルトラコード（最大エフォート）で進めてください。**

スマホ向けドミニオン対戦Webアプリの続きです。
作業ディレクトリ＝`C:\Users\b1242\claude\game\dominion`／branch＝`main`（最新は `git log` で確認）。回答は日本語で。

## 最初にやること
1. `npm test` を実行し **全40スイート緑（exit 0・整合性 4763・不変条件 12・同盟 429件・同盟UI 231件）** を確認する。
2. `PROGRESS.md` の **§0-29（同盟＝いま作業中。特に「段階2 A4」節と末尾の注意節）／§1（ゴール）／
   §5（未完了タスク）／§6（詰まり・注意点）** を読む。
3. **`docs/research/allies_rules.md` 冒頭の「実装前に必読」9項目**を読む（同盟の正本・554KB。
   巨大なので全部読まず、Grep で必要な節だけ読むこと）。

## いまどこ
新拡張 **同盟（Allies）**。**作業ツリーはクリーン／未pushなし**（`sw.js` v67・本番反映を実機確認済み）。
- ✅ 公式ルール研究（多エージェント22体）／段階1（カタログ72種＋webp78枚）
- ✅ **A1**（好意 `p.favors`・Ally 選定 `state.ally`）／**A2**（分割山6組＝混合山モデル＋循環 Rotate）
- ✅ **A2b**（「サプライから獲得/廃棄する札の種別」を山の一番上で判定する横断修正）
- ✅ **A3**＝同盟(Ally)カード23種／✅ **A4**＝**王国カード49種**（＋敵対レビュー確定12件の修正）
- ⛔ **CARD_SETS 未参照＝同盟はまだ実プレイに出ない**（闇市場にも出ないよう `DOM.STAGE1_POOLS` で塞いである）
- **絵（webp）は同盟の78枚だけ枠＋文字**（47〜67KB）。他の598枚には絵が入っている。

## 次に取り組むタスク（優先順1位）＝**A5＝CARD_SET 昇格**（＝同盟の完成）
**この順で**（詳細な手順とチェック項目は PROGRESS §5 の 1. に書いてある）：
1. `js/cards.js` の **`DOM.STAGE1_POOLS` から `'allies'` を外す**
   ＝**闇市場デッキに同盟が入るようになる**。分割山の中身24種が漏れないか（`MIXED_PILE_CONTENTS`）を必ず確認。
2. **`DOM.KINGDOM_ALLIES` 固定10種を選定**（公式の同盟専用10種は無いので自作 showcase）。
   ⚠ **連携(Liaison)を必ず1枚以上入れる**（入れないと Ally も好意も登場しない＝拡張の目玉が出ない）。
   分割山と非分割を混ぜ、循環・持続・アタック・好意の使い道をひと通り味わえる構成に。
   ＋ `DOM.CARD_SETS` に `allies`（kind:'standard'）と `random-allies` を追加。
3. `MIX_KINGDOM_POOLS.allies` に追加して **mix-all（14→15拡張）**へ参加させる。
4. `test/invariants.test.js` の出荷セット検証に `allies` / `random-allies` を追加。
   UI の「拡張」タイルに出ることを確認（`test/ui.test.js` の「全 CARD_SETS がセット選択画面から選べる」が守る）。
5. **昇格後にもう一度 多エージェント敵対レビュー＋CPUソーク**（闇市場経路が新たに開くため）。
6. **絵（webp）72枚の回収**（手順はメモリ `chatgpt-card-art-workflow`。
   **ChatGPT の生成順は指示順と一致しないので必ず全枚を実見して判別**。
   分割山のプレースホルダ6枚は最安カードの絵を流用してよい＝城 `castles` と同じやり方）
   → 縦型 `CARDS_ONLY=<ids> node tools/build-cards.js`／横型 `tools/build-landscape.js`（**このPCのみ**）。
7. `sw.js` の VERSION を上げる（現在 **v67**）→ PROGRESS 更新 → **ユーザー確認の上で** push。

## 守るべき進め方・流儀（このプロジェクト固有）
- **簡略化より忠実性**。やむを得ず簡略化したら PROGRESS に「許容簡略化」と理由を必ず書く。
- **新しい pending は4点セット必須**＝engine reducer ＋ `PLAYER_ACTIONS` 登録 ＋ CPU `decidePending` 分岐 ＋
  UI `viewPendingModal` 分岐（＋終端保証）。欠けると **CPU 無限ループ／人間が詰む**。
- ★**述語を1つ足したら「窓を開く条件・受理・CPU の候補・UI のフィルタ」の4面を必ず同時に直す**。
  **受理側だけ締めるのが本プロジェクトで最も再発する事故**（A4 でも将軍×玉座の間で本番 livelock を作った）。
- **CPU の `decidePending` は絶対に `null` を返さない**（オンラインで `reduce(state,null)` が TypeError → 部屋が固まる）。
- **獲得可否・コスト比較は engine の述語**（`gainableBase`/`costUpTo`/`costUnder`/`costExact`/`sameCost`）。
  **カードの種別は `isTypeSupply`**（混合山＝一番上）。ただし**「山のコスト・種別」は randomizer**。
  **非サプライ札を候補にしたい効果では `costUpTo` 系を使わない**（候補ゼロ→livelock）。
- `t.actions += n` / `t.coins += n` を直接書かない（`addActions`/`addCoins`）。財宝の効果は `applyTreasureEffect`／
  公開は `reveal()`／廃棄は `trashCard()`／獲得は `gain()`／サプライ外からの獲得は `gainFromOutside()`／
  サプライの山からの廃棄は `trashFromSupplyPile()`／山へ戻すのは `returnToPile()`／シャッフルは `reshuffleDeck()`／
  手札から使えるかは `canPlayHandCard()`。
- **選択系モーダルの確定は必ず `takeSelection()` を通す**（`UI.selection` を持ち越さない）。
- **多エージェント敵対レビューを必ず行う**（観点ごとに finder → 別エージェントが node/jsdom で再現して確定。偽陽性は棄却）。
  A2〜A4 の確定35件のうち **13件超が「同盟と無関係な既存バグ」**だった＝毎回やる価値がある。
- **push は毎回ユーザー確認を取る**（コミットは随時してよい）。
  **既存バグの修正が入ったら拡張の完成を待たずに push を提案する**。
- **client 資産（js/css/webp 等）を変えたら `sw.js` の VERSION を上げる**（現在 **v67**）。
- 使い捨てスクリプトは**プロジェクト直下に `_*.tmp.js`**（gitignore 済み）で作り、実行後に必ず削除。
  一時ファイルは scratchpad か `c:\tmp` へ。

## 次セッションが知らないと事故る事項
- **`js/engine.js` と `js/cpu.js` は CRLF・`js/ui.js` は LF**。スクリプトで一括置換するときは改行を合わせること
  （`\n` の複数行パターンが engine.js だけマッチしない）。Edit ツールは改行を保つので基本はそちらを使う。
- **Git Bash の `/tmp` と node の `/tmp`（＝`C:\tmp`）は別物**。両方から触るファイルは `c:/tmp/...` を使う。
- **`lingerAttackEnter` を使う持続アタック（追いはぎ/将軍/呪いの森/沼の妖婆/門番）は
  `state.pending.type` にカード名を変数で入れる**＝リテラル検索や機械的な突き合わせをすり抜ける。
  UI の `viewPendingModal` と `LINGER_REACT` の許可リストに**手で**足すこと（A4 の [high] はこれ）。
- **「見る（look at）」効果を足したら `maskStateFor` の私的看破リストに足す**（`pending.cards` を持つ型名）。
  偵察隊／夜警／粉屋・歩哨 と**3回続けて同じクラスの漏れ**を出している。
- **混合山の正本は `DOM.engine.MIXED_PILE_KEYS`**（廃墟/騎士/城＋同盟の分割山6組＝9山）。
  **「山キー」はプレースホルダ＝実在する1枚ではない**（プレイヤーのゾーン・廃棄置き場・闇市場デッキ・
  相続の脇・命令の対象・宣言モーダルの候補 に入れない）。`id !== 'knights'` を書かず `isMixedPileKey()`。
- **山の上に載せる効果（山上VP・負債・山トークン・好意トークン）の READ は必ず `pileKeyOf` を通す**。
- **Ally が起こす攻撃（魔女の輪／すり師団）は `ATTACKS` に登録しない**（堀で防げてしまう）。
  一方 **A4 の王国アタック7種は普通のアタック**＝登録済み。
- **`test/edition2.test.js` の「堀は全アタックを無効化」が 220件**あるのは同盟のアタックが自動で加わったぶん。
- **英語wiki は Wayback 経由＝`python tools/wikifetch.py <Page>`**。**出力の `snapshot=` の年を必ず見る**
  （2022 より古いと同盟の発売前）。**2025年12月以降のキャプチャは bot 検知画面**。
- **GitHub Pages のデプロイが失敗し続けたら「ゾンビ化した進行中デプロイ」を疑う**＝
  `gh api -X POST repos/ankake-web/dominion/pages/deployments/<旧SHA>/cancel`（PROGRESS §6 に詳細）。
  失敗した run の `rerun` は必ず失敗する＝**空コミットを積んで push し直す**。
- **本番サーバ（Render）が新しい engine で動いているかの確かめ方**＝実 ws（`wss://dominion-server-1hc9.onrender.com/ws`・
  Origin 必須・メッセージは `t:` キー。`create`→`joined` / `setCpu`+`setConfig`→`start` / 盤面は `started`・`state`）で
  対戦を開始し、**配信 state の `turn` に新しく足したフィールドがあるか**を見るのが決定的。
- **保存則ソークを自作するときの落とし穴**：① 王国に**横型のid（イベント等）を混ぜない**（`C()[id].potion` で落ちる）。
  ② tally の比較に `JSON.stringify` を使わない（キーの挿入順で差分が出る）＝キーをソートするか `diffTally` を真似る。
  ③ **ZONES に `contractSetAside`（同盟の脇札）を入れる**（A4 で追加した物理カードのゾーン）。
  ④ CPU は MONEY 戦略だと王国カードを買わないので、**supply / 混合山から抜いて**各自の山札に配ってから回す。
