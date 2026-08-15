<!-- /handoff が自動生成（2026-08-15）。新セッションはこのファイルの指示に従う。手編集不要 -->

**ウルトラコード（最大エフォート）で進めてください。**

スマホ向けドミニオン対戦Webアプリの続きです。
作業ディレクトリ＝`C:\Users\b1242\claude\game\dominion`／branch＝`main`（最新は `git log` で確認）。回答は日本語で。

## 最初にやること
1. `npm test` を実行し **全42スイート緑（exit 0・整合性 5303・不変条件 12・略奪29＋略奪UI 9）** を確認する。
2. `PROGRESS.md` の **§0-30（略奪＝いまここ）／§4（決定事項＝版の選択の根拠）／§5（未完了タスク）／§6（詰まり・注意点）** を読む。
3. **`docs/research/plunder_rules.md` の冒頭「実装前に必読」20項目**（＋決定 D1〜D5）と `docs/adding-cards.md` を読む。

## いまどこ
**15拡張＋プロモ＝全676枚が実プレイ可能。略奪(Plunder)は段階0（研究）＋段階1（カタログ85種＋webp）まで完了・push済**
（`sw.js` **v72**・本番反映を機械照合済み＝Pages の主要5ファイルが sha1 一致／Render も実 ws で確認）。
`DOM.CARDS` 560／`DOM.LANDSCAPES` 201＝**計761枚**だが、**略奪は `CARD_SETS` 未参照＝まだ実プレイには出ない**
（`DOM.STAGE1_POOLS = ['plunderexp','loot']` で闇市場にも出ない）。**略奪の絵は未回収＝枠＋文字だけ。**

- **版の選択・割れた裁定は4件とも決着済み**（§4）。**これ以上ユーザーに聞くことは無い。**
  旅行＝2023エラッタ／日本語文面＝Dominion Online 訳で統一／港の村×習性は +$ ボーナスなし／
  旗艦は持続を再演したら場に残る（例外なし）。
- **`spoils`（暗黒時代）は公式訳「略奪品」へ改名済み**（ユーザー決定。Loot＝「戦利品」との衝突解消）。
- ⚠ **2026-08-15 は2つのセッションが並行して同じリポジトリを触り、矛盾するコミットが出た**（§0-30 の「経緯」節）。
  **大きな調査・生成の前に成果物ディレクトリを `ls` すること**（メモリ `check-existing-research-first`）。

## 次に取り組むタスク＝**略奪の段階2 P1b（戦利品15種の効果）から**

バッチ順は正本の §「段階2 の推奨バッチ順」：
1. ~~**P1a＝Loot の山の基盤**~~ ✅**完了（`186e368`・push済）**＝`state.loot` 30枚／`gainLoot()`／非サプライ4系統除外／
   `maskStateFor` で全部伏せる／`returnToPile` は一番上に裏向き／保存則 tally／サーバの同意なし Undo 比較／盤面に残枚数。
   **新設 `test/plunder.test.js` 29件＋`test/plunder-ui.test.js` 9件。** → **次は P1b＝戦利品15種の効果**
   （`gainLoot` はできたが効果はまだ空）。**カード別の要点と難度は PROGRESS §「段階2 P1a」末尾の表**を見ること。
2. **P2＝"next time" 型持続の共通機構**（**相手の片付けでも捨てる**経路・永久持続の器・
   誘発リストは事象の前にスナップショット・**空振りでも消費**）。該当は**ちょうど7枚**＝
   檻/調査/秘境の社/豊穣/旗艦/上陸部隊/切り裂き魔。
3. **P3＝素直な王国カード** → 4. **P4＝特性(Trait) 基盤＋15種**（**無謀な(Reckless)は最後**）→
   5. **P5＝イベント15種** → 6. **P6＝残りの王国**（一等航海士/操舵手/鉱山道路/王の隠し財産/フリゲート船/切り裂き魔）
   → 7. **P7＝CARD_SET 昇格 → 多エージェント敵対レビュー（5観点）→ 絵の回収85枚 → push**。

**一次資料の取り方**：
- 英語wiki＝**`node tools/wikidirect.js <Page> [...]`**（Anubis を突破して**本体を直読み**・1ページ数秒・**常に現行版**）。
  生HTMLが要るときは `RAW_DIR=<dir>` を付ける。**`tools/wikifetch.py`（Wayback）は予備**（遅い／429／
  **snapshot の年は古さの証拠にならない**）。
- 日本語＝**`python tools/jpwiki.py <ページ名>`**（wikiwiki.jp。**429 を出すので逐次＋2秒以上あける**）。
- RGG の PDF＝**一般ルールの逐語にだけ**使う（pdftotext は金額記号を落とす）。

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
  **非サプライ札を候補にしたい効果では `costUpTo` 系を使わない**（候補ゼロ→livelock）。※Loot は非サプライ＝ここが効く。
- `t.actions += n` / `t.coins += n` を直接書かない（`addActions`/`addCoins`）。財宝の効果は `applyTreasureEffect`／
  公開は `reveal()`／廃棄は `trashCard()`／獲得は `gain()`／サプライ外からの獲得は `gainFromOutside()`／
  サプライの山からの廃棄は `trashFromSupplyPile()`／山へ戻すのは `returnToPile()`／シャッフルは `reshuffleDeck()`／
  手札から使えるかは `canPlayHandCard()`。
- **混合山から獲得するログは `gain()` の前に `mixedTopCard` を評価する**（後だと次の札の名前になる＝A5 で8箇所直した）。
- **選択系モーダルの確定は必ず `takeSelection()` を通す**（`UI.selection` を持ち越さない）。
- **多エージェント敵対レビューを必ず行う**（観点ごとに finder → 別エージェントが node/jsdom で再現して確定。偽陽性は棄却）。
  同盟の A2〜A5 の確定45件のうち **15件超が「同盟と無関係な既存バグ」**だった＝毎回やる価値がある。
- **push は毎回ユーザー確認を取る**（コミットは随時してよい）。
  **既存バグの修正が入ったら拡張の完成を待たずに push を提案する**。
- **client 資産（js/css/webp 等）を変えたら `sw.js` の VERSION を上げる**（現在 **v73**）。
- 使い捨てスクリプトは**プロジェクト直下に `_*.tmp.js`**（gitignore 済み）で作り、実行後に必ず削除。
  一時ファイルは scratchpad か `c:\tmp` へ。**`c:\tmp` には本業の `LiS_AF_資料一式` があるので一括削除しない。**

## 次セッションが知らないと事故る事項
- **`js/engine.js` と `js/cpu.js` は CRLF・`js/ui.js` は LF**。スクリプトで一括置換するときは改行を合わせること
  （`\n` の複数行パターンが engine.js だけマッチしない）。Edit ツールは改行を保つので基本はそちらを使う。
- **Git Bash の `/tmp` と node の `/tmp`（＝`C:\tmp`）は別物**。両方から触るファイルは `c:/tmp/...` を使う。
- **`END_TURN` は購入フェイズからしか通らない**（`t.phase !== 'buy'` は状態不変で拒否）。テストで手番を送るときは
  `END_ACTION_PHASE` → `END_TURN` の2手。**また `DOM.KINGDOM_ALLIES` で対局を作るとターン1に Ally の窓が
  開くことがある**（`opts.ally` で窓の無い Ally＝`plateau_shepherds` 等を固定するか、連携の無い王国を使う）。
- **`DOM.STAGE1_POOLS` は現在 `['plunderexp', 'loot']`**（＝略奪は闇市場に出ない）。
  **段階2 で略奪を CARD_SET 昇格するときに、ここから外す。** 新しい拡張を段階1で足したら必ずここに入れる
  （入れないと闇市場に「買っても何も起きない死に札」が $0 で並ぶ）。
- **横型を新しい kind で足すときは `tools/build-landscape.js` にスキンを新設する**
  （略奪の `trait`＝深い臙脂・**コスト欄なし**が直近の前例。その前が同盟の `ally`＝濃い藍）。
- **`p.voyageExtra` は「残り予約数」**（旗ではない）。リッチのスキップで取り直すために残す設計＝`=0` で全部消す
  実装に戻すと公式例（航海2枚＋リッチ）が壊れる。使い切れなかった残りは `finishTurnAdvance` の末尾で必ず捨てる。
- **`chain`（連続手番）は「実際にプレイされたターン」で数える**＝リッチで飛ばしたターンは連続を切らない。
- **CPU は闇市場で新しい拡張のカードを買わない**（黒市の候補は `GAIN_ORDER` の先頭38枚＝銀貨より上だけ）＝
  **闇市場×新拡張は「人間だけが通る道」**。CPUソークではこの経路を検証できない＝購入を強制注入して補う。
- **`lingerAttackEnter` を使う持続アタックは `state.pending.type` にカード名を変数で入れる**＝リテラル検索や
  機械的な突き合わせをすり抜ける。UI の `viewPendingModal` と `LINGER_REACT` の許可リストに**手で**足すこと。
- **「見る（look at）」効果を足したら `maskStateFor` の私的看破リストに足す**（`pending.cards` を持つ型名）。
  偵察隊／夜警／粉屋・歩哨 と**3回続けて同じクラスの漏れ**を出している。
- **混合山の正本は `DOM.engine.MIXED_PILE_KEYS`**（廃墟/騎士/城＋同盟の分割山6組＝9山）。
  **「山キー」はプレースホルダ＝実在する1枚ではない**（プレイヤーのゾーン・廃棄置き場・闇市場デッキ・
  相続の脇・命令の対象・宣言モーダルの候補 に入れない）。`id !== 'knights'` を書かず `isMixedPileKey()`。
- **山の上に載せる効果（山上VP・負債・山トークン・好意トークン）の READ は必ず `pileKeyOf` を通す**。
  ⚠ **特性(Trait)も「山に付く」ので同じ罠を踏む可能性が高い。**
- **保存則ソークを自作するときの落とし穴**：① 王国に**横型のid（イベント等）を混ぜない**（`C()[id].potion` で落ちる）。
  ② tally の比較に `JSON.stringify` を使わない（キーの挿入順で差分が出る）。
  ③ ZONES に `contractSetAside` を入れ、**`p.archives`（帝国・資料庫）と `turn.possessionGains/Trash` も数える**
  （`test/invariants.test.js` の tally が正本）。
  ④ CPU は MONEY 戦略だと王国カードを買わないので、**supply / 混合山から抜いて**各自の山札に配ってから回す。
- **絵の回収**（手順はメモリ `chatgpt-card-art-workflow`）＝ChatGPT はファイル名を付けられず最大10枚/回。
  **⚠ 連番は生成順とは限らない**（同盟でも K1 が10枚中9枚ズレる状態だった）＝**必ず全枚を実見して判別**する。
  同じバッチが二重ダウンロードされることがある（sha1 で重複を落とす）。**回収後は Downloads を掃除する**。
- **GitHub Pages のデプロイが失敗し続けたら「ゾンビ化した進行中デプロイ」を疑う**＝
  `gh api -X POST repos/ankake-web/dominion/pages/deployments/<旧SHA>/cancel`（PROGRESS §6 に詳細）。
  失敗した run の `rerun` は必ず失敗する＝**空コミットを積んで push し直す**。
- **本番サーバ（Render）が新しい engine で動いているかの確かめ方**＝実 ws（`wss://dominion-server-1hc9.onrender.com/ws`・
  Origin 必須・メッセージは `t:` キー。`create`→`joined` / `setCpu`+`setConfig`→`start` / 盤面は `started`・`state`）で
  対戦を開始し、**配信 state に新しく足したフィールドがあるか**を見るのが決定的。
  ※サーバは `DOM.CARD_SETS` から許可IDを導出するので、新セットはサーバ側の変更なしで受理される。
