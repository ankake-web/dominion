# 夜想曲（Nocturne）公式ルール研究 — 実装の正本

多エージェント研究（14体：日本語名・エラッタ確定 → 6群を分担収集 → **各群を別エージェントが一次資料で敵対検証**）で
確定したデータ。**カタログ（`js/cards.js`）と engine を書くときは、記憶ではなくこの文書を見ること。**

- 内訳＝**王国33種＋家宝7種＋祝福12種＋呪詛12種＋ゾンビ3種＋その他5種（インプ/ウィル・オ・ウィスプ/願い/コウモリ/幽霊）＋状態5種 ＝ 77種**
  （公式の500枚＝王国332＋ランダマイザー33＋家宝42＋祝福12＋呪詛12＋ゾンビ3＋その他66 と一致）
- 縦型（`DOM.CARDS`）＝王国33＋家宝7＋ゾンビ3＋非サプライ5 ＝ **48種**／
  横型（`DOM.LANDSCAPES`）＝祝福12＋呪詛12＋状態5 ＝ **29種**

## ⚠️ 一次資料の使い方（ここを間違えると全部ずれる）

1. **RGG 公式ルールブック PDF は「2017年 第1版」＝現行テキストの根拠にしてはいけない**。
   （`https://www.riograndegames.com/wp-content/uploads/2017/08/Dominion-Nocturne-Rules.pdf`。
   ローカル抽出＝`scratchpad/nocturne_rulebook.txt`）。**一般ルールの逐語には使えるが、カード文面は第1版**。
   → **現行カード文面の正本＝英語wiki の `Card text` 欄と `Versions` 表の「2021 printing」行**。
2. 英語wiki（wiki.dominionstrategy.com）は Anubis の bot 検知で直接開けない。
   **Wayback 経由で読む**＝`python scratchpad/wikifetch.py <PageName> [...]`（コスト記号を `[$4]` の形に復元してある）。
3. 日本語の**カード名と文面**はホビージャパン印刷版（2019年1月）＝日本語wiki（wikiwiki.jp/dominiondeck）が正本。
   **英語wiki の "Japanese" 行の名前は当てにならない**（17枚で実物と食い違う＝§0 の検証で確定）。
4. **pdftotext はコイン記号・VP記号を全部落とす**（"You get + and receive a Boon." ＝実際は +$2）。金額は必ず wiki で裏取り。

## ⚠️ 実装前に必読：この拡張の落とし穴（敵対検証で確定した実装リスクの集約）

### 1. 夜フェイズ（`turn.phase` に `'night'` を足す）＝ engine 横断で最大のリスク
現在 `t.phase` は `'action' | 'buy'` の2値。**`'night'` を足すと既存の `phase === 'buy'` 判定が誤爆し得る**。
必ず全部洗い出すこと＝冠(crown のモード分岐)／ヴィラ／公会堂 basilica／列柱 colonnade／汚された神殿／
徴税 tax の `gainWasBuyPhase`／闘技場 arena／浴場 baths／`t.treasuresLocked`／`t.inStartPhase`(ピアッツァ)／
`t.buysMade`(使者)／行商人 peddler のコスト／-$1トークンの `applyCoinPenalty`／
§0-24 の `isNoConsentUndoableBuy`（同じターン/フェイズ判定）。**夜フェイズは購入フェイズではない**。
- 差し込み位置＝`END_TURN` → 購入フェイズ終了時の効果（ワイン商/野外劇/探査）→ **夜フェイズ** →
  片付け開始時の効果（浴場/隠遁者/トラベラー/増築/策謀）→ `cleanupAndAdvance`。
- **夜フェイズでアタックが飛ぶ**（人狼・吸血鬼・夜襲）。既存の `ATTACKS`／`*EnterVictim`／堀・灯台の免疫窓が
  フェイズ非依存で動くか要検証（§0-25 で門番を足したとき `LINGER_REACT` の許可リスト漏れで fuzz が未終局になった型）。
- **呪いの森を受けた状態で購入すると手札が山札に載る＝夜行カードを1枚も使えない**。この経路を必ずテストする。
- CPU の `decide` に夜フェイズの分岐が無いと `END_TURN` を返し続けて夜行カードを一生使わない（最悪 livelock）。

### 2. 「カード」と「非カード」の線引き（保存則テストが即赤になる）
- **非カード**＝祝福(Boon)・呪詛(Hex)・状態(State)。`allCards` にも invariants の `ZONES` にも入れない。
  **プレイヤーの前に保持された祝福も所有カードに数えない**（庭園/品評会/絹の道/壁/博物館に影響しない）。
- **物理カード**＝家宝7種・ゾンビ3枚（開始時から `state.trash` にある）・幽霊の脇札・納骨堂の脇札・
  コウモリの山。`allCards`／`ZONES`／`result.scores[i].deckCards`／`maskStateFor` の配線が要る。

### 3. 非サプライ5山＋家宝＝§6 の「4系統除外チェックリスト」を必ず通す
非サプライ山＝ウィル・オ・ウィスプ12／インプ13／幽霊6／願い12／コウモリ10。
**(1) `emptyPileCount`（3山終了） (2) `canBuyCard`（購入） (3) 闇市場デッキ母集団 (4) 汎用獲得
（engine の `*_GAIN` と CPU の `bestGain`/`bestGainExact` の両方）** から除外する。
**engine だけ締めて CPU を放置すると本番 livelock**（§0-2・§0-23 で実際に踏んだ型）。
**家宝7種は山を持たない**＝`DOM.POOLS` に入れてはいけない（闇市場デッキに漏れて $0 で買える）。

### 4. 錯乱(Deluded)／嫉妬(Envious)の発動タイミング＝最頻の事故
**「持っている＝効いている」ではない**。購入フェイズ開始時に**返す**ことで初めて発動し、そのターンの残りに効く。
- `p.deluded` / `p.envious`（保有）と `t.cantBuyActions` / `t.enviousActive`（このターン発動中）を**別フィールド**で持つ。
- `END_ACTION_PHASE` は1ターンに複数回走り得る（ヴィラ／騎兵）。**毎回 `p.deluded`/`p.envious` を見て返す**が、
  **一度立った `t.*Active` は下ろさない**。購入フェイズ中に得た錯乱はその購入フェイズでは発動せず、
  次の購入フェイズ開始時（ヴィラで再突入した同じターンを含む）に返して発動する。
- 錯乱の「アクションを購入できない」は **engine 拒否・CPU 非提案・UI ボタン無効化を同一コミットで**。

### 5. 呪詛の配布手順（ルール違反になりやすい）
**リアクション（堀等）を全員ぶん解決して窓を閉じてから、はじめて呪詛を1枚めくる**。
呪詛 id は被害者ごとに引き直さない＝1回だけ確定して手番順に適用する。全員が免疫でもカードの指示があれば1枚めくる。

### 6. 獲得時／廃棄時の窓は必ずキューに積む
`state.pending` への直接代入は禁止（§0-26 の要求(demand)で望楼の窓を握りつぶした事故と同型）。
獲得時＝`state.onGainQueue`／廃棄時＝`state.onTrashQueue`。
夜想曲は「1つの効果で複数の祝福を順に受ける」（ドルイド／愚者3枚／恵みの村／ピクシー2回）や
「獲得の窓が2段になる」（暗躍者＝自身の獲得→金貨の獲得）が普通に起きる。

### 7. コスト比較は必ず成分別述語（`DOM.engine` のもの）
`gainableBase` / `costUpTo` / `costUnder` / `costExact` / `sameCost`。素の `cardCost(state,id) <= N` は禁止
（mix-all で非サプライ・ロック中の分割山下段・ポーション費用・負債コストを取りこぼして本番 livelock）。
- **ゾンビの石工の「廃棄カードのコスト+$1 以下」は3成分（コイン/ポーション/負債）版のヘルパが要る**
  （既存 `costUpTo` はコイン上限のみ）。
- 取り替え子の交換「コスト$3以上」も新述語が要る。

### 8. 既存の横断ヘルパを必ず通す
`addActions(t,n)` / `addCoins(state,n)` / `draw()` / `reveal()`（「見る」は通さない）/ `trashCard()` /
`gain()` / `reshuffleDeck()`。**財宝の効果は `applyTreasureEffect`**（`applyEffect` は財宝では呼ばれない）。
- 嫉妬（銀貨/金貨が$1）は `applyTreasureEffect` 側に書く（`playTreasureCard` の入口だけだと
  ティアラ/冠/偽造通貨の2回目＝`treasure_replay` で漏れる＝§0-15 の轍）。

### 9. CPU の終端保証
新 pending すべてで `decidePending` が **`null` を返さない**（オンラインで `reduce(state, null)` が TypeError →
部屋が固まる＝§0-26）。任意効果は `{type:'X', card:null}`＝辞退を返し、engine 側にも
「候補ゼロなら窓を閉じる」終端保証を書く。

### 10. 得点は負になり得る／CPU にも同じ式を入れる
生活苦(Miserable) -2 ／二重苦(Twice Miserable) -4。**下限クランプ禁止**（§0-19 と同じ）。
`scoreGame`（engine）と CPU の `vpOfPlayer` / `winsIfEnds` の**両方**に入れる（片方だけだと §0-26 の
[medium] バグ＝「勝てると思って買って負ける」と同型）。牧草地(Pasture)の可変VPも同様。

### 11. このエンジン特有の「先引き」の後に置くもの
`cleanupAndAdvance` は自分の手番終了時に**次の手札を先引き**する。
**川の恵み（ターン終了時 +1カード）と忠犬（ターン終了時に手札へ戻す）は先引きの後**
（§0-25 のリス／§0-21 の保存 と同じ位置）。§0-22 の角笛は逆に先引きの**前**なので取り違えないこと。
忠犬は**相手のターンに捨てた場合そのターンの終了時に戻る**＝`cleanupAndAdvance` で全プレイヤーぶん回収する。

### 12. 捨て札トリガーの配線（既存の穴に当たる）
`.discard.push(` は engine 全体で113箇所あり `triggerOnDiscard` は共通ヘルパ化されていない（§0-25 の既知簡略化）。
**忠犬と夜警は「山札から捨てられても」発動する**ので、夜想曲の捨て札経路で自分で呼ぶこと。
凶兆(Bad Omens)の「山札を捨て札置き場に置く」は**誘発しない**（英語wiki 明記）。

### 13. オンラインの看破（`maskStateFor`）
伏せる＝祝福/呪詛の山の中身・**捨て札は一番上の1枚だけ公開**（順序が漏れると残りが完全に読める）・
夜警の「山札の上5枚を見る」（「公開」ではないので `reveal()` も通さない）・太陽の恵み・憑依・納骨堂の脇札。
**幽霊の脇札は公開情報**（公開しながら掘るため）＝伏せてはいけない。

### 14. 開始デッキの家宝置換
「屋敷3＋家宝N＋銅貨(7−N)」に一般化する（暗黒時代の避難所＝屋敷3枚置換と同時に成立する）。
mix-all では家宝7種が全部立って**銅貨0枚スタート**になり得る＝invariants で必ず踏む。

### 15. 「交換(exchange)」は獲得でも廃棄でもない
吸血鬼↔コウモリ／取り替え子。`triggerOnGain` も `triggerOnTrash` も呼ばない。
ただし `supply` が増減するので `emptyPileCount`（3山終了）には影響する。`removeOne` の成否を必ず見る（lose track）。
**取り替え子の交換で廃棄置き場由来のカードを戻すと、空だったサプライ山が復活し得る**（§0-23 の交易商人と同型）。

### 16. `PLAY_ALL_TREASURES`（財宝を全部出す）との相性
**呪われた金貨は出すと呪いを獲得する**＝勝手に出すと事故。幸運のコインも「出さない選択」がある。
魔法のランプは「場にちょうど1枚だけのカードが6種」を作るため出す順で結果が変わる。
§0-24 の `playAllOrder` の設計判断が要る（除外するなら PROGRESS に許容簡略化として明記）。

### 17. 幽霊の2回使用は `state.replay`（命令ではない）
玉座の2回目と同型。カードは場に出るので「これ」は普通に動く。
命令(`state._cmd`)扱いにすると自己廃棄カードの挙動が公式と逆になる。
一方 **ネクロマンサーは命令機構（§0-17）を流用できるが、ネクロマンサー自身は Command 型を持たない**ので
「命令は命令をプレイできない」ガードを適用してはいけない（廃棄置き場の大君主/はみだし者/船長/王子を使えるのが公式）。

### 18. ネクロマンサーのセットアップ
ゾンビ3枚をゲーム開始時に `state.trash` へ置く（**廃棄ではない**＝墓所/下水道/青空市場は発火しない）。
**保存則 tally の総枚数が3枚増える**。山ではないので `emptyPileCount`／3山終了には無関係。
裏向きフラグは `state.trash` の**物理カード1枚ずつ**に付き、ターン終了時に全解除（`freshTurn`）。

---

（以下、§0＝命名とエラッタ／§機構／§王国A・B・C群／§祝福・呪詛・状態／§家宝・非サプライ・状態 の順。
各群は独立に収集され、別エージェントが一次資料で敵対検証したもの。**状態(State)は3つの節に出てくるが内容は整合している**。）


---

# パート0：日本語公式名とエラッタ（命名の正本）

# 夜想曲（Nocturne）§0 — 日本語公式名 全77種 ＋ 現行エラッタ 全件

**版**: 第2版（敵対検証済み）。第1版の**結論（77名の一覧）は全件正しかった**が、**根拠の帰属に4つの誤り**が
あったので書き直した。訂正点は §5 に全部書いた。

---

## 0. 最重要の結論（先に読むこと）

### (A) 日本語名には **3系統** ある。**ホビージャパン印刷版（＝公式）を採用すること**

| 系統 | 実体 | 採否 |
|---|---|---|
| **①ホビージャパン印刷版（2019年1月発売）** | 日本語wiki のページ名／日本語プレイヤーの実カードレビュー | ✅ **これを採用** |
| **②英語wiki のカード個別ページの Japanese 行** | 出典画像なしの手入力テキスト。**17枚が①と違う** | ❌ 不採用 |
| **③英語wiki「List of cards in other languages」ページ** | さらに古い別訳。**②とも違う**（歌人/巫女/小妖精…） | ❌ 不採用 |

**②を信用してはいけない決定的な理由**（自分で確認した）:
英語wiki の言語表は `Language | Name | Print | Digital | Text | Notes` の6列だが、
**夜想曲の Japanese 行は Print 列も Digital 列も空**＝**カード画像による裏付けが1枚も無い**。
唯一の例外が **Druid** で、ここだけ Print 列に `[Japanese language Druid]` の実カード画像があり、
その名前は **ドルイド**＝①と一致する。**画像で裏が取れている唯一の1枚が①と一致し、
裏が取れていない17枚が①と食い違う**＝②は手入力の旧訳・誤訳とみるのが自然。

さらに②は**自分自身と矛盾**している（同じカードを別ページで違う名前で呼ぶ）:
- **Imp**: 自ページと悪魔の工房では「小悪魔」／迫害者の文中では「**インプ**」
- **Will-o'-Wisp**: 自ページでは「ウィル・オ・ウィスプ」／沼の恵みの文中では「**鬼火**」

### (B) 現行エラッタで **機能が変わったのは3枚だけ**（Crypt / Necromancer / Tracker）
英語wiki `All Errata` の Nocturne 節が正本。逐語は §4-1。

### (C) **日本語版カード（2019年印刷）は Crypt と Tracker が旧テキストのまま**
日本語wiki も注意書きを出している。**方針どおり現行（エラッタ後）を採用すること**。

### (D) 既存カタログとの**日本語名の衝突はゼロ**
本プロジェクトの `DOM.CARDS` 402枚＋`DOM.LANDSCAPES` 119枚に対し、
夜想曲77種の日本語名を全件突き合わせた（node で実行）＝**重複0件**。
依頼文が警戒していた Guardian(守護者)／Monastery(修道院)／Tracker(追跡者)／Vampire(吸血鬼)／
Cemetery(墓地) も既存カードと被らない。

---

## 1. 種別名（Type）の日本語公式訳

**この節だけは「ホビージャパン公式サイトの逐語」で裏が取れている**（カード名は取れていない＝§5参照）。

HJ公式 <https://hobbyjapan.games/dominion_nocturne/> 逐語:
> 「購入フェイズが終わったあとにプレイできる**夜行**カード、初期デッキの銅貨と入れ替えて使用する**家宝**カード、
> **祝福**と**呪詛**をもたらす**幸運**カードと**不運**カードが登場します。」

| English | 日本語公式訳 | 出典 | conf |
|---|---|---|---|
| **Night** | **夜行** | HJ公式 逐語 | high |
| **Fate** | **幸運** | HJ公式 逐語 ＋ HJ正誤表《ドルイド》「アクション – 幸運」 | high |
| **Doom** | **不運** | HJ公式 逐語 | high |
| **Heirloom** | **家宝** | HJ公式 逐語 | high |
| **Boon** | **祝福** | HJ公式 逐語 | high |
| **Hex** | **呪詛** | HJ公式 逐語 | high |
| **Spirit** | **精霊** | 日本語wiki「アクション-**精霊**」（3種＝ウィル・オ・ウィスプ/インプ/幽霊） | high |
| **Zombie** | **ゾンビ** | 日本語wiki「アクション-**ゾンビ**」 | high |
| **State** | **状態** | 日本語wiki 呪詛ページ「**状態**カード」 | high |

- **Night phase = 夜フェイズ**（人狼の日本語テキスト「夜フェイズ中の場合」）。
- **Duration = 持続**／**Attack = アタック**／**Reaction = リアクション**（既存拡張と同じ）。
- 依頼文の候補訳「Doom=災い(呪縛)」「Fate=運命」は**誤り**。公式は **不運 / 幸運**。

---

## 2. 日本語公式名 全77種

**出典凡例**
- **[JW]** 日本語wiki wikiwiki.jp/dominiondeck（夜想曲ページのカード一覧＋各カードページ）＝系統①
- **[SD]** 三月類「ドミニオン:夜想曲の全カードレビュー」前編/中編/後編（2019年1〜2月＝**HJ発売直後**）
  <https://www.sandomi.net/entry/2019/01/22/014406> ほか2本 ＝ **JWとは独立した系統①の第2証人**
- **[HJ]** ホビージャパン公式サイト
- **[EW]** 英語wiki カード個別ページ（系統②・参考）

> **全77件が [JW] と [SD]（＋一部 [HJ]）の2系統以上で一致**。以下 conf は全件 **high**。

### 2-1. 王国カード 33種

| # | English | 日本語公式名 | コスト | 種別（日本語） | ②英語wikiの名 |
|---|---|---|---|---|---|
| 1 | Druid | **ドルイド** | $2 | アクション-幸運 | 一致（※実カード画像あり／HJ正誤表にも掲載） |
| 2 | Pixie | **ピクシー** | $2 | アクション-幸運 | 一致 |
| 3 | Tracker | **追跡者** | $2 | アクション-幸運 | 一致 |
| 4 | Monastery | **修道院** | $2 | 夜行 | 一致 |
| 5 | Guardian | **守護者** | $2 | 夜行-持続 | 一致 |
| 6 | Faithful Hound | **忠犬** | $2 | アクション-リアクション | 一致 |
| 7 | Fool | **愚者** | $3 | アクション-幸運 | 一致 |
| 8 | Leprechaun | **レプラコーン** | $3 | アクション-不運 | 一致 |
| 9 | Secret Cave | **秘密の洞窟** | $3 | アクション-持続 | 一致 |
| 10 | Changeling | **取り替え子** | $3 | 夜行 | 一致 |
| 11 | Night Watchman | **夜警** | $3 | 夜行 | 一致 |
| 12 | Ghost Town | **ゴーストタウン** | $3 | 夜行-持続 | ❌幽霊街 |
| 13 | Bard | **詩人** | $4 | アクション-幸運 | 一致 |
| 14 | Blessed Village | **恵みの村** | $4 | アクション-幸運 | 一致 |
| 15 | Conclave | **コンクラーベ** | $4 | アクション | 一致 |
| 16 | Necromancer | **ネクロマンサー** | $4 | アクション | 一致 |
| 17 | Shepherd | **羊飼い** | $4 | アクション | 一致 |
| 18 | Skulk | **暗躍者** | $4 | アクション-アタック-不運 | 一致 |
| 19 | Cemetery | **墓地** | $4 | 勝利点 | 一致 |
| 20 | Devil's Workshop | **悪魔の工房** | $4 | 夜行 | 一致 |
| 21 | Exorcist | **悪魔祓い** | $4 | 夜行 | 一致 |
| 22 | Cursed Village | **呪われた村** | $5 | アクション-不運 | 一致 |
| 23 | Pooka | **プーカ** | $5 | アクション | 一致 |
| 24 | Sacred Grove | **聖なる木立ち** | $5 | アクション-幸運 | 一致 |
| 25 | Tormentor | **迫害者** | $5 | アクション-アタック-不運 | 一致 |
| 26 | Tragic Hero | **悲劇のヒーロー** | $5 | アクション | ❌悲劇の勇者 |
| 27 | Werewolf | **人狼** | $5 | アクション-夜行-アタック-不運 | 一致 |
| 28 | Vampire | **吸血鬼** | $5 | 夜行-アタック-不運 | 一致 |
| 29 | Crypt | **納骨堂** | $5 | 夜行-持続 | 一致 |
| 30 | Den of Sin | **悪人のアジト** | $5 | 夜行-持続 | 一致 |
| 31 | Cobbler | **カブラー** | $5 | 夜行-持続 | 一致 |
| 32 | Idol | **偶像** | $5 | 財宝-幸運-アタック | 一致 |
| 33 | Raider | **夜襲** | $6 | 夜行-アタック-持続 | 一致 |

**取り違え注意（依頼文が警戒していた点を個別に潰した）**
- **Tormentor＝迫害者**（$5 アクション-アタック-不運／「場に他のカードが無ければインプ獲得、
  そうでなければ他P全員が呪詛」）。**陰謀の Torturer＝拷問人（$5）とは別カード**。効果で照合済み。
- **Skulk＝暗躍者**（$4／+1購入・他P呪詛・獲得時に金貨）。他の潜伏系との混同なし。
- **Raider＝夜襲**（$6 夜行-アタック-持続／手札5枚以上の他Pが「場のカードと同名」を捨てる）。
- **Fool＝愚者**（$3／森の迷子でなければ祝福3つ）。
- **Guardian＝守護者 / Monastery＝修道院 / Tracker＝追跡者 / Vampire＝吸血鬼**＝
  いずれも**既存402枚と日本語名が衝突しない**ことを実測確認済み（§0-D）。

### 2-2. 家宝（Heirloom）7種
開始デッキの銅貨1枚と置き換える。

| English | 日本語公式名 | コスト | 種別 | 対応王国カード | ②英語wikiの名 |
|---|---|---|---|---|---|
| Haunted Mirror | **呪いの鏡** | $0 | 財宝-家宝 | 墓地 | 一致 |
| Magic Lamp | **魔法のランプ** | $0 | 財宝-家宝 | 秘密の洞窟 | 一致 |
| Goat | **ヤギ** | $2 | 財宝-家宝 | ピクシー | ❌山羊 |
| Pasture | **牧草地** | $2 | 財宝-家宝-勝利点 | 羊飼い | 一致 |
| Pouch | **革袋** | $2 | 財宝-家宝 | 追跡者 | 一致 |
| Lucky Coin | **幸運のコイン** | $4 | 財宝-家宝 | 愚者 | ❌幸運の銅貨 |
| Cursed Gold | **呪われた金貨** | $4 | 財宝-家宝 | プーカ | 一致 |

### 2-3. その他の非サプライカード 5種

| English | 日本語公式名 | コスト | 種別 | ②英語wikiの名 |
|---|---|---|---|---|
| Will-o'-Wisp | **ウィル・オ・ウィスプ** | $0* | アクション-精霊 | 一致（ただし沼の恵みの文中では❌鬼火） |
| Wish | **願い** | $0* | アクション | ❌大願 |
| Imp | **インプ** | $2* | アクション-精霊 | ❌小悪魔（ただし迫害者の文中ではインプ） |
| Bat | **コウモリ** | $2* | 夜行 | ❌蝙蝠 |
| Ghost | **幽霊** | $4* | 夜行-持続-精霊 | 一致 |

### 2-4. ゾンビ 3種（非サプライ・準備で廃棄置き場へ）

| English | 日本語公式名 | コスト | 種別 |
|---|---|---|---|
| Zombie Apprentice | **ゾンビの弟子** | $3 | アクション-ゾンビ |
| Zombie Mason | **ゾンビの石工** | $3 | アクション-ゾンビ |
| Zombie Spy | **ゾンビの密偵** | $3 | アクション-ゾンビ |

②英語wikiも全3件一致。

### 2-5. 祝福（Boon）12種 — 横型・コスト無し

| English | 日本語公式名 | ②英語wikiの名 |
|---|---|---|
| The Earth's Gift | **大地の恵み** | 一致 |
| The Field's Gift | **田畑の恵み** | ❌土地の恵み |
| The Flame's Gift | **炎の恵み** | ❌火の恵み |
| The Forest's Gift | **森の恵み** | 一致 |
| The Moon's Gift | **月の恵み** | 一致 |
| The Mountain's Gift | **山の恵み** | 一致 |
| The River's Gift | **川の恵み** | 一致 |
| The Sea's Gift | **海の恵み** | 一致 |
| The Sky's Gift | **空の恵み** | 一致 |
| The Sun's Gift | **太陽の恵み** | 一致 |
| The Swamp's Gift | **沼の恵み** | 一致 |
| The Wind's Gift | **風の恵み** | 一致 |

### 2-6. 呪詛（Hex）12種 — 横型・コスト無し

| English | 日本語公式名 | ②英語wikiの名 |
|---|---|---|
| Bad Omens | **凶兆** | ❌悪兆 |
| Delusion | **幻惑** | ❌妄想 |
| Envy | **羨望** | 一致 |
| Famine | **飢饉** | 一致 |
| Fear | **恐怖** | 一致 |
| Greed | **貪欲** | 一致 |
| Haunting | **憑依** | 一致 |
| Locusts | **蝗害** | ❌イナゴ |
| Misery | **みじめな生活** | ❌苦難 |
| Plague | **疫病** | ❌伝染病 |
| Poverty | **貧困** | 一致 |
| War | **戦争** | 一致 |

### 2-7. 状態（State）5種 — 横型・コスト無し

| English | 日本語公式名 | 枚数 | ②英語wikiの名 |
|---|---|---|---|
| Deluded | **錯乱** | 6 | ❌混乱 |
| Envious | **嫉妬** | 6 | 一致 |
| Lost in the Woods | **森の迷子** | 1 | 一致 |
| Miserable | **生活苦**（-2勝利点） | 6 | ❌没落 |
| Twice Miserable | **二重苦**（-4勝利点） | 6 | ❌都落ち |

合計 **33+7+5+3+12+12+5 = 77種**。

---

## 3. 日本語カードテキストの書式（実装用メモ）

日本語版カードの実表記:
- `+1 カードを引く`（+1 Card）／`+1 カードを購入`（+1 Buy）
- `+1 アクション`／`+1 コイン`／`-2 勝利点`
- 家宝の表記: `(家宝：幸運のコイン)` … **全角コロン**
- 準備の表記: `準備: 祝福3枚を脇に表向きで置く。`（ドルイド）／
  `準備: 廃棄置き場にゾンビ3種類を置く。`（ネクロマンサー）
  ※2023年エラッタで英語版は "Setup:" が**太字**になったが、**Druid/Necromancer は未反映**（§4-2）。
- 非サプライ注記: `(このカードはサプライには置かない。)`

> **【書式の要判断】** 日本語版カードは `+1 カードを引く` / `+1 カードを購入` と書くが、
> 本プロジェクトの既存521枚は `+1 カード` / `+1 購入` で統一されている。
> → **既存書式（`+1 カード` / `+1 購入`）に合わせることを推奨**（一貫性優先）。
> 区切り線は既存どおり `————`（全角ダッシュ4つ）。

---

## 4. 現行エラッタ 全件

### 4-1. 機能が変わったもの＝**3枚のみ**

英語wiki `All Errata` の Nocturne 節 **逐語**:
> **Crypt** — Cannot set aside Duration cards (2022).
> **Necromancer** — Turn the card face down before playing it (2020).
> **Tracker** — (No dividing line.) Active this turn instead of while in play (2022).

#### ① Crypt（納骨堂）— 2022年【機能変更】
**現行英文（英語wiki Card text 逐語）**:
> Set aside any number of **non-Duration** Treasures you have in play, face down (under this).
> While any remain, at the start of each of your turns, put one of them into your hand.

2022年エラッタ 逐語:
> Duration tracking — Avoid tracking issues by not moving Durations that are in play.
> **Counterfeit, Mint, Crypt** — Only trash or set aside **non-Duration** cards.

**実装**: 脇に置ける候補は**場の財宝のうち持続でないもの**に限る。
（本プロジェクトは Counterfeit/Mint で同じ制約を既に実装済み＝同じ述語を流用できる。）

#### ② Necromancer（ネクロマンサー）— 2020/2021年【機能変更】
**現行英文（逐語）**:
> **Choose** a face up, non-Duration Action card in the trash. **Turn it face down for the turn, and play it**, leaving it there.
> Setup: Put the 3 Zombies into the trash.

2021年エラッタ 逐語:
> **Necromancer** — Now turns the chosen card face down before playing it **to prevent loops**.

**実装**: **「裏返す」→「使用する」の順**。旧文（"Play a card from the trash … turning it face down for
the turn"）だと、そのカードの解決中にもう一度自分自身を選べてループし得た。
日本語wikiは「効果は変わらない」と書くがループ局面を無視した簡略説明で、
英語wikiは **Functional change** に分類している。**裏返し→使用の順で実装すること**。

#### ③ Tracker（追跡者）— 2020年→2022年【機能変更】
**現行英文（逐語）**:
> +$1
> **This turn, when you gain a card, you may put it onto your deck.** Receive a Boon.
> Heirloom: Pouch

変更は**2段階**:
- **2020年**: `while this is in play` → `while you have this in play`（文言のみ）
- **2022年**: 逐語 > `Princess, Hermit, Merchant Guild, Bridge Troll, Groundskeeper, **Tracker**, Sauna,
  Lighthouse, Quarry, Hoard, Haggler, Highway` — **Active during this turn.**（区切り線も削除）

**実装差2点**:
1. **追跡者が場を離れても、このターン中ずっと有効**（`while in play` ではない）。
2. **文の順序が「Receive a Boon」より前**に移った＝**祝福で獲得したカードも山札の上に置ける**
   （山の恵みの銀貨／沼の恵みのウィル・オ・ウィスプ／大地の恵みの獲得）。

### 4-2. 文言のみ（cosmetic）— 機能変更なし

**2021年エラッタの夜想曲・変更カード13枚（逐語リスト）**:
> Nocturne — **Tracker, Fool, Leprechaun, Devil's Workshop, Necromancer, Idol, Tormentor,
> Cursed Gold, Goat, Haunted Mirror, Lucky Coin, Magic Lamp, The Swamp's Gift**

このうち Necromancer（機能）と Tracker（後に機能）を除く **11枚が文言のみ**。内訳:
- **非サプライ獲得ルール(2019)による `from its pile` 系の整理**＝
  Leprechaun / Devil's Workshop / Tormentor / Haunted Mirror / Magic Lamp / The Swamp's Gift
- **財宝の `When you play this,` 削除**（2020年の全財宝一括変更）＝Cursed Gold / Goat / Lucky Coin
  ※逐語 > "Remove 'when you play this' from Treasures."
- **Idol**: 自身を数えることを明示化 → 現行逐語
  `If you have an odd number of Idols in play **(counting this)**, receive a Boon; otherwise, each other player gains a Curse.`
- **Fool**: 逐語 > "Fool — Change a comma to a colon."

**2022年（cosmetic）**:
> **Guardian**, Haunted Woods, Lighthouse, Swamp Hag — Prefer "At X do Y. Until then Z" over
> "Until X do Z. At X do Y."

**2023年**: 逐語 > "…**Druid**, …, **Necromancer**, … have **not** been updated but are likely to change
in future reprints." ＝ **"Setup:" 太字化は Druid/Necromancer には未反映**。

**2024年**: 夜想曲に該当なし（All Errata の Nocturne 節が Crypt/Necromancer/Tracker の3件のみ）。
**2025年**: 夜想曲の**カード個別**変更なし（→ ただし §4-3 の一般ルール変更が波及する）。

### 4-3. 【重要】2025年エラッタの一般ルール変更（夜想曲の持続に波及）

逐語（2025 Errata / All Errata）:
> **Durations** — No longer have any effect on future turns **if the card has left play** (2025).
> A Duration card played extra times by a Throne Room variant that has left play is only multiplied
> for the remainder of the turn it was played, not during future turns.

**波及先＝夜想曲の持続7枚**: 守護者 / ゴーストタウン / 秘密の洞窟 / 納骨堂 / 悪人のアジト /
カブラー / 夜襲 ／および 幽霊（夜行-持続-精霊）。
※本プロジェクトは移動動物園の実装時にこの一般ルールを既に検討済み（PROGRESS §0-26 参照）。

### 4-4. 2019年エラッタ（夜想曲に効く一般ルール）

- **非サプライ山からの獲得**: `gain a Wish from its pile` のような「山の明示」が不要になる方向の整理。
  対象＝Leprechaun / Devil's Workshop / Tormentor / Haunted Mirror / Magic Lamp / The Swamp's Gift。
  **機能差はゼロ**（獲得元の山は変わらない）。
- **Stop-moving ルール(2019)**: 「効果はカードが在ると想定した場所にある時だけ動かせる」＝
  取り替え子・吸血鬼・コウモリの「交換」、悲劇のヒーローの自己廃棄などの挙動判断に効く。

---

## 5. 第1版からの訂正（＝後続エージェントへの警告）

第1版は**77名の結論は全件正しかった**が、**根拠の帰属に4つの誤り**があった。

### 訂正① 「正本＝ホビージャパン公式サイト」は**誤り**
HJ公式ページ <https://hobbyjapan.games/dominion_nocturne/> を全文取得して確認したところ、
**33枚の王国カード名は1つも載っていない**。載っているのは
**種別名6語（夜行/家宝/幸運/不運/祝福/呪詛）**と、正誤表に出てくる**《ドルイド》1枚だけ**。
→ カード名の正本は **日本語wiki（系統①）＋ 日本語プレイヤーの発売直後レビュー（独立第2証人）**。
HJ公式は**種別名の正本**として使うこと。

### 訂正② 「英語wikiは24枚で間違っている」は**過大**。正しくは**17枚**
自分で全96ページを引き直して数えた結果、**英語wikiのカード個別ページ**で公式と食い違うのは
**17枚**（ゴーストタウン/悲劇のヒーロー/ヤギ/幸運のコイン/願い/インプ/コウモリ/
田畑の恵み/炎の恵み/凶兆/幻惑/蝗害/みじめな生活/疫病/錯乱/生活苦/二重苦）。

### 訂正③ 「歌人・巫女・小妖精・家事の妖精・秘密の洞穴」は**カード個別ページには存在しない**
これらは**別ページ「List of cards in other languages」＝系統③**にしかない、さらに古い第3の訳。
カード個別ページの方は **詩人・ドルイド・ピクシー・レプラコーン・秘密の洞窟＝公式と一致**している。
→ 「英語wikiが間違い」と一括りにせず、**どのページか**を必ず区別すること。

### 訂正④ 「守衛（Guardian）」は**日本語ではなく中国語**
`Guardian` ページの `守衛` は **Chinese の行**（`(pron. shǒuwèi)`、本文は繁体字
「直到你的下回合開始以前…」）。**言語行を1つ読み違えた**もの。
英語wikiの Japanese 行は **守護者** で公式と一致している。
→ 同じ事故は `Will-o'-Wisp` ページの **鬼火** でも起きる（あれも Chinese 行）。
ただし **沼の恵みページの「鬼火」は本当に Japanese 行**なので、そちらは②の実在の自己矛盾。

### 訂正⑤（軽微）「Doom=呪縛 / Fate=運命 と英語wikiが書いている」も誤り
`呪縛` `運命` は取得した96ページのどこにも出現しない。これは**依頼文が挙げた候補訳**であって、
英語wikiの主張ではない。結論（不運/幸運が公式）は正しい。

### 第1版で**正しかった**もの（維持）
- 77名の一覧（全件）／種別名6語／エラッタ3枚＋文言11枚／
- ②の自己矛盾2例（Imp＝小悪魔 vs インプ、Will-o'-Wisp＝ウィル・オ・ウィスプ vs 鬼火）は**実在**。

### 検証方法（再現可能）
1. 英語wiki は Wayback 経由（`wfetch2.py` / `rowdump.py`）。`rowdump.py` は言語表を
   **セル単位**で出すので、Print/Digital 列に画像があるか＝**裏付けの有無**が判る。
   **言語行の読み違い（中国語→日本語）を防ぐにはセル単位で見ること。**
2. 日本語名は **2系統以上で一致**を要求した（日本語wiki ＋ 発売直後の日本語レビュー）。
3. 既存カタログとの衝突は node で `DOM.CARDS`＋`DOM.LANDSCAPES` を実際に読んで突合。

---

## 6. 第1版の「未確定2件」は**両方とも解決した**

### ✅ 解決① Leprechaun の現行英文＝**`from its pile` は今も付いている**
英語wiki Card text 逐語:
> Gain a Gold. If you have exactly 7 cards in play, **gain a Wish from its pile**. Otherwise, receive a Hex.

第1版は「2019/2021エラッタで簡略化されたはず」と推測して `gain a Wish.` と判断していたが、
**現行のカードテキストは `from its pile` のまま**。**機能差はゼロ**なので実装に影響はないが、
**カタログ文は上記逐語を採る**こと。（同様に Devil's Workshop / Tormentor / The Swamp's Gift も
現行テキストに `from its pile` 相当が残っている。）

### ✅ 解決② Magic Lamp は**自身を数える**（公式FAQ逐語で確定）
現行 Card text（逐語）には `(counting this)` は**無い**:
> [$1] If there are at least 6 cards that you have exactly 1 copy of in play, trash this. If you did, gain 3 Wishes.

しかし **Official FAQ 逐語**で確定:
> **Magic Lamp itself counts as one of the six cards.**
> A card you have two or more copies of in play does not count; you have to have exactly one copy in play to count a card.
> You can play more Treasures after trashing Magic Lamp, and still get [$1] from it for that turn.

→ **魔法のランプ自身も6種類に数える**（conf: **high**）。
文面に `(counting this)` を足すかは表示上の判断（**Idol は現行文に `(counting this)` が有る**ので、
Idol には入れ、Magic Lamp には入れないのが逐語どおり）。

### なお未確認（実装に影響しない）
- 日本語版カードの**実物スキャン**は入手していない。系統①の名前は「日本語wiki＋日本語レビュー2系統の
  一致」で確定させており、HJ印刷版の写真そのものでの照合はしていない。
  ただし **Druid だけは英語wikiに実カード画像があり ドルイド で一致**、かつ HJ正誤表にも《ドルイド》と
  出るため、系統①がHJ印刷版であることの裏付けになっている。

---

## 7. 実装用・確定日本語名一覧（コピペ用）

```
# 種別
Night=夜行 / Fate=幸運 / Doom=不運 / Heirloom=家宝 / Spirit=精霊 / Zombie=ゾンビ
Boon=祝福 / Hex=呪詛 / State=状態 / Night phase=夜フェイズ
Duration=持続 / Attack=アタック / Reaction=リアクション / Treasure=財宝 / Victory=勝利点
# 王国カード33
Bard=詩人
Blessed Village=恵みの村
Cemetery=墓地
Changeling=取り替え子
Cobbler=カブラー
Conclave=コンクラーベ
Crypt=納骨堂
Cursed Village=呪われた村
Den of Sin=悪人のアジト
Devil's Workshop=悪魔の工房
Druid=ドルイド
Exorcist=悪魔祓い
Faithful Hound=忠犬
Fool=愚者
Ghost Town=ゴーストタウン
Guardian=守護者
Idol=偶像
Leprechaun=レプラコーン
Monastery=修道院
Necromancer=ネクロマンサー
Night Watchman=夜警
Pixie=ピクシー
Pooka=プーカ
Raider=夜襲
Sacred Grove=聖なる木立ち
Secret Cave=秘密の洞窟
Shepherd=羊飼い
Skulk=暗躍者
Tormentor=迫害者
Tracker=追跡者
Tragic Hero=悲劇のヒーロー
Vampire=吸血鬼
Werewolf=人狼
# 家宝7
Cursed Gold=呪われた金貨
Goat=ヤギ
Haunted Mirror=呪いの鏡
Lucky Coin=幸運のコイン
Magic Lamp=魔法のランプ
Pasture=牧草地
Pouch=革袋
# その他の非サプライ5
Will-o'-Wisp=ウィル・オ・ウィスプ
Wish=願い
Imp=インプ
Ghost=幽霊
Bat=コウモリ
# ゾンビ3
Zombie Apprentice=ゾンビの弟子
Zombie Mason=ゾンビの石工
Zombie Spy=ゾンビの密偵
# 祝福12
The Earth's Gift=大地の恵み
The Field's Gift=田畑の恵み
The Flame's Gift=炎の恵み
The Forest's Gift=森の恵み
The Moon's Gift=月の恵み
The Mountain's Gift=山の恵み
The River's Gift=川の恵み
The Sea's Gift=海の恵み
The Sky's Gift=空の恵み
The Sun's Gift=太陽の恵み
The Swamp's Gift=沼の恵み
The Wind's Gift=風の恵み
# 呪詛12
Bad Omens=凶兆
Delusion=幻惑
Envy=羨望
Famine=飢饉
Fear=恐怖
Greed=貪欲
Haunting=憑依
Locusts=蝗害
Misery=みじめな生活
Plague=疫病
Poverty=貧困
War=戦争
# 状態5
Deluded=錯乱
Envious=嫉妬
Lost in the Woods=森の迷子
Miserable=生活苦
Twice Miserable=二重苦
```

---

## 8. 参照した一次資料

| 資料 | 用途 | 備考 |
|---|---|---|
| ホビージャパン公式 <https://hobbyjapan.games/dominion_nocturne/> | **種別名6語の正本**／《ドルイド》 | カード名一覧は**無い** |
| 日本語wiki <https://wikiwiki.jp/dominiondeck/夜想曲> ほか各カードページ | **カード名の正本（系統①）** | 33+8+7+12+12 を一覧で保持 |
| 三月類「夜想曲 全カードレビュー」前/中/後編（2019-01〜02） | **系統①の独立第2証人** | HJ発売直後・全77件を網羅 |
| 英語wiki `All Errata` / `2019〜2025 Errata` | **エラッタの正本** | Nocturne 節は機能変更3件のみ |
| 英語wiki 各カードページ `Card text` / `Official FAQ` | **英語逐語テキスト・FAQ** | Japanese 行は**不採用**（§0-A） |
| 英語wiki `List of cards in other languages` | 参考（系統③） | **不採用**。さらに古い別訳 |
| RGG公式ルールブック `nocturne_rulebook.txt` | 一般ルール | **コイン記号が脱落**＝金額は英語wikiで裏取り |

**取得スクリプト**（scratchpad 内）: `wfetch2.py`（ページ保存）／`rowdump.py`（言語表をセル単位で出す＝
**言語行の読み違い防止**）／`jfetch.py`（日本語サイト）。

---

# パート1：新機構とゲーム全体ルール

## 夜想曲（Nocturne）§機構 — 新機構とゲーム全体ルール【正本・敵対検証済み 第2版】

**下書き（第1版）を一次資料から全項目引き直して検証した**。結論の骨格は概ね正しかったが、
**確定訂正 13 件**（うち high 4 件）があったので書き直した。訂正の一覧は §11。

---

## 機構0. 出典と、先に読むべき最重要の前提

| 記号 | 出典 | 強さ |
|---|---|---|
| **RB:N** | RGG 公式ルールブック（実DL・pdftotext・909行）の行番号 | 最強（ただし下記の罠あり） |
| **wiki:X** | 英語wiki（Wayback経由）ページ X の "Card text" / "Official FAQ" / "Versions" | 最強（記号が `[$4]` `[2VP]` で復元済み） |
| **jwiki:X** | 日本語wiki wikiwiki.jp/dominiondeck のページ X | 日本語公式文面・日本語圏の詳細ルールの正本 |

### 【罠①】**手元の RB PDF は 2017年 “第1版” である**（下書きが踏んだ最大の落とし穴）
`wiki:Necromancer` の Versions 表が決定的：

> First edition (November 2017): "**Play a face up, non-Duration Action card from the trash, leaving it there and turning it face down for the turn.**"
> 2021 printing (January 2021): "**Choose a face up, non-Duration Action card in the trash. Turn it face down for the turn, and play it, leaving it there.**"

**手元 RB の Necromancer カード画像は前者＝第1版**（RB:374-377 で確認）。したがって
**RB のカード画像テキストは全部 2017年初版であり、「現行テキスト」の根拠にしてはならない**。
現行テキストの正本は `wiki:<Card>` の **Card text** 欄と **Versions 表の 2021 printing 行**。

### 【罠②】RB の pdftotext は **コイン記号・VP記号が全部脱落**している
例：RB:145「Bard: You get + and receive a Boon.」＝実際は **+$2**。
**数値は必ず wiki の `[$N]` か jwiki で裏取りすること**（本書は全件裏取り済み）。

### 【罠③】2021年印刷での文面変更は**機能変更ではない**（エラッタ表に載らない）
`wiki:All_Errata` の Nocturne 節に載る**機能エラッタは3枚だけ**（§7-5）。
それとは別に、**2021年印刷で7枚の家宝＋沼の恵みの文面が短縮された**（§2-3・§3-4）。
これは editorial であり挙動は 1 ビットも変わらない。**混同しないこと**。

---

## 機構1. 夜フェイズ（Night phase）と夜行カード（Night）

### 1-1. 公式ルール（逐語・これで全部）

> **RB:78-80** ＝ `wiki:Night` の Official rules と完全一致
> "Nocturne adds Night cards and the Night phase. In games using Night cards, the Night phase happens
> after the Buy phase - it goes, **Action, Buy, Night, Clean-up**. In your Night phase, you can play
> **any number** of Night cards."

Donald X. 曰く "Night is a new phase. It comes after the Buy phase, and in it you can play any number of
Night cards. **That's all there is to it.**"（`wiki:Night` Preview）＝ルールはこの3行が全部。

### 1-2. 確定事項

| # | 事項 | 根拠 |
|---|---|---|
| 1 | フェイズ順＝**アクション → 購入 → 夜 → クリンナップ** | RB:79 |
| 2 | 夜フェイズに**何枚でも**夜行カードを使用できる | RB:80 |
| 3 | 夜行カードの使用は**アクション権を消費しない**（＝non-terminal）。バニラボーナスは夜フェイズでは無意味なので夜行カードは持たない | `wiki:Night`「Night cards are usually not drawn dead, and are **non-terminal**」 |
| 4 | 夜フェイズでは**購入できない**（購入フェイズはもう終わっている）。夜行カードは購入権も消費しない | RB:79 |
| 5 | 夜行カードは**場に出る**（in play）。持続でなければクリンナップで捨て札 | RB:134-140 のプレイ例「she plays Den of Sin; **it sits in play**」「In Clean-up, she discards everything from play **except the Crypt and the two Dens of Sin**」 |
| 6 | **夜行カードはアクションカードではない**（人狼のような複合種別を除く）。種別を見るカードは反応しない | `wiki:Night`「Cards that care about specific types will not have their usual effects when dealing with Night cards, whether positive (e.g., **Ironworks** or **Magpie**) or negative (e.g., **Rabble**)」 |
| 7 | **玉座の間系で夜行カードを増幅する手段は基本的に無い**。唯一の例外＝**御料車(Royal Carriage)を人狼に対して呼ぶ** | `wiki:Night`「In general, there is no way to multiply a Night card with a Throne Room variant (**the exception being calling Royal Carriage on Werewolf**)」 |
| 8 | **フェイズを見るカードは夜フェイズでは通常の効果を出さない**（例：ヴィラ） | `wiki:Night`「Cards that care about specific phases (e.g., **Villa**) will not have their usual effects in the Night phase」 |
| 9 | **呪いの森(Haunted Woods)は夜行と極端に相性が悪い**＝何か購入すると手札が山札の上に乗り、その後 手札から夜行カードを使えない | `wiki:Night`「**Haunted Woods** is particularly brutal, as it prevents you from playing any of your Night cards if you buy anything」 |
| 10 | **ターン開始時の効果はアクションフェイズの一部**であり、そこで打ち切って夜フェイズへ飛べない | `wiki:Werewolf`「If you have abilities to resolve at the start of your turn, **it is considered part of your Action phase, and you cannot end it**. This means if you play Werewolf at the start of your turn (with e.g, Delay), you cannot skip to your Night phase and give out a Hex」 |
| 11 | 夜フェイズに獲得したカードも「このターンに獲得したカード」に数える | RB:224「Devil's Workshop: This counts all cards you have gained this turn, **including cards gained at Night prior to playing it**」 |
| 12 | 夜行カードのうち**4枚は獲得時に手札へ入る**（悪人のアジト／ゴーストタウン／守護者／夜警）ので、買ったターンにそのまま夜フェイズで使える | 各カード文「This is gained to your hand (instead of your discard pile).」＋RB:221/309/320/383「Since Night is after the Buy phase, normally you can play this the turn you buy it」 |
| 13 | **人狼＝アクション・夜行・アタック・不運**。**自分の夜フェイズ**で使うと相手に呪詛、それ以外（自分のアクションフェイズ／王笏や進軍で他フェイズ／**他プレイヤーの夜フェイズ**）だと +3カード | `wiki:Werewolf` Official FAQ ＋「If you play it during any phase that isn't your own Night phase (such as with Scepter, or March), **including during another player's Night Phase**, you get +3 Cards」 |
| 14 | 人狼は**夜フェイズでも習性(Way)を選べる**（アクションカードだから）。**アクション権も消費しない** | `wiki:Werewolf`「A unique aspect of Werewolf is that it can be played with a **Way even during the Night phase, which does not cost an Action**」（逐語） |
| 15 | 複合種別は文脈を問わず全種別を保持する。アクションフェイズで人狼を使う（＝攻撃しない）ときも**アタックカードではある** | `wiki:Werewolf`「a card with multiple types retains those types in all contexts ... it's still an Attack card and activates other players' Diplomats」 |

### 1-3. 夜行カード全リスト＝**15種**（下書きの「14種」は誤り）

| コスト | カード |
|---|---|
| $2 | Guardian(守護者), Monastery(修道院) |
| **$2\*** | **Bat(コウモリ)** ＝非サプライ |
| $3 | Changeling(取り替え子), Ghost Town(ゴーストタウン), Night Watchman(夜警) |
| $4 | Devil's Workshop(悪魔の工房), Exorcist(悪魔祓い) |
| **$4\*** | **Ghost(幽霊)** ＝非サプライ |
| $5 | Cobbler(カブラー), Crypt(納骨堂), Den of Sin(悪人のアジト), Vampire(吸血鬼), **Werewolf(人狼)** |
| $6 | Raider(夜襲) |

（`wiki:Night` の List of Night cards ＋ Card gallery のサムネ数 15 で二重確認）
うち**持続は7枚**＝Ghost / Cobbler / Crypt / Den of Sin / Ghost Town / Guardian / Raider。
※Secret Cave(秘密の洞窟) は **アクション-持続**であり夜行ではない。

### 1-4. 実装注意（本プロジェクト固有）

1. **`turn.phase` に `'night'` を追加する**。**既存の `phase === 'buy'` 判定を全部洗い出し、夜フェイズを購入フェイズと
   誤認させないこと**。該当（grep 対象）＝
   冠(crown・§0-15 のフェイズ分岐)／ヴィラ(villa)／ランドマークの公会堂(basilica)・列柱(colonnade)・
   汚された神殿(defiled_shrine)／徴税(tax の `gainWasBuyPhase`)／闘技場(arena)／浴場(baths)／
   `t.treasuresLocked`(§0-21)／`t.inStartPhase`(ピアッツァ)／`t.buysMade`(使者)／
   `isNoConsentUndoableBuy`(§0-24 の「同じターン/フェイズ」判定)。
2. **ターン開始時は `phase='action'` のまま**（§0-22 のピアッツァと同じ）。上表#10 が公式にこれを裏づける。
3. 遷移＝`END_ACTION_PHASE`(action→buy) の後に **`END_BUY_PHASE`(buy→night)** を新設し、
   `END_TURN` は night からのみ受理。**手札に夜行カードが1枚も無ければ自動スキップ**
   （既存の「アクションが無いとき購入へ自動スキップ」と同型。**Undo 直後の抑止 `UI._noAutoSkipOnce` 相当も必要**）。
4. **夜行カードの使用は新 action `PLAY_NIGHT`**（`PLAYER_ACTIONS` 登録必須）。アクション権も購入権も消費しない。
5. **人狼は `PLAY_ACTION` と `PLAY_NIGHT` の両入口を持つ**。効果は `turn.phase === 'night'` で分岐。
   **習性(`action.way`)は両方の入口で受け付ける**（#14）。
6. **御料車(royal_carriage)の「アクション解決直後フック」（§0-9 Batch4b の `t.afterActionCard`）は
   夜フェイズの人狼でも立てること**（唯一の夜行×玉座系の合法経路）。**それ以外の夜行カードでは立てない**。
7. **夜行カードは `armDuration` 対象になり得る**（持続7枚）。クリンナップの持続保持はそのまま流用できる。
8. **アタックが夜フェイズで飛ぶ**（人狼・吸血鬼・夜襲）。既存の `ATTACKS` ／ `*EnterVictim` ／
   堀・灯台・守護者の免疫窓が**フェイズ非依存で動くか**を必ず確認する（既存は行動フェイズ前提の箇所がある）。
9. **CPU の `decide` に夜フェイズの分岐が要る**（無いと `END_TURN` を返し続けて夜行カードを一生使わない／
   最悪 livelock）。UI にも夜フェイズの操作面（「夜フェイズへ」「ターン終了」）が要る。
10. 「このターンに獲得した枚数」（`t.gainedThisTurn` 等）は**夜フェイズの獲得も数える**（#11）。

---

## 機構2. 家宝（Heirloom）

### 2-1. 公式ルール（逐語）

> **RB:82-83**「Nocturne has cards with a yellow banner saying "Heirloom" and naming a card. In games using
> a card with that banner, each player **replaces a starting Copper with the named card**. See Preparation.」
>
> **RB:60-63（Preparation）**「If any Kingdom cards being used have a yellow banner indicating an Heirloom,
> players start the game with that Heirloom replacing what would normally be a Copper. **For example in a
> game with Pixie and Tracker, players start with 3 Estates, 5 Coppers, a Goat, and a Pouch.** The unused
> Coppers go in the Copper pile.」

### 2-2. 確定事項

| # | 事項 | 根拠 |
|---|---|---|
| 1 | 開始デッキは常に7枚（屋敷3＋残り）。**家宝1種につき銅貨1枚が置き換わる** | RB:62 の実例 |
| 2 | **複数の家宝は同時に成立する**（理論上7種＝銅貨0枚スタート） | Donald X.「In a game with Shepherd, Pooka, and Cemetery, you start with 3 Estates, **4 Coppers**, a Pasture, a Cursed Gold, and a Haunted Mirror」(`wiki:Heirloom` Preview) |
| 3 | **家宝はサプライの山ではない**＝**そもそも山が存在しない**。購入も獲得もできない | `wiki:Heirloom`「Unlike Coppers, **Heirlooms don't come from a Supply pile**. Therefore they can't be returned or distributed with Ambassador and aren't returned by Panic」 |
| 4 | **家宝は「交換(exchange)」に関われない**（戻す山が無い） | `wiki:Exchange`「The card being returned as part of the exchange must have a pile to go back to. Therefore cards that don't have piles of their own anywhere, such as **Shelters, Heirlooms, or Zombies** ... cannot be involved in an exchange」 |
| 5 | 家宝は**普通のカード**＝デッキの一部・得点計算に入る（牧草地は勝利点カードでもある） | 種別 Treasure（牧草地のみ Treasure-Victory） |
| 6 | 王国カードが**闇市場デッキにあるだけでもセットアップは発動する**（＝家宝も置き換わる） | `wiki:Black_Market`（§7-6） |

### 2-3. 家宝7種（全カードデータ）

**⚠ 文面について**：2017年初版は各カードに「**When you play this,**」の前置きがあり、獲得先も
「**from its pile**」と書かれていた。**2021年印刷でこれらが削られた**（`wiki:<Card>` Versions 表で確認）。
**機能は完全に同じ**。日本語版（ホビージャパン 2019年1月）は**2017年の文面で印刷**されている。
→ **本アプリの表示は下記の「日本語テキスト（HJ印刷版）」を採用する**（§0 の方針＝日本語名/文面は HJ 版が正本。
この変更は機能エラッタではないので §0 の「現行エラッタを採用」とは衝突しない）。

コイン値は **RB では脱落**しているので全件 `wiki:` の `[$N]` と jwiki で裏取りした。

---

#### 呪いの鏡 / Haunted Mirror
- **コスト**: $0 ／ **種別**: 財宝 - 家宝（Treasure - Heirloom）／ **コイン**: +1 ／ **親**: Cemetery(墓地)
- **日本語テキスト**
  ```
  +1 コイン
  ————
  あなたがこのカードを廃棄したとき、あなたの手札からアクションカード1枚を捨て札にし、幽霊1枚をそのカードの山から獲得してもよい。
  ```
- **英語原文**
  - 現行(2021-)：`[$1]` ／ `When you trash this, you may discard an Action card, to gain a Ghost.`
  - 初版(2017)：`... to gain a Ghost from its pile.`
- **公式裁定**: RB:598「Haunted Mirror does not give you a way to trash it, but **does something if you find a way to**.」
- **実装注意**: **区切り線あり**（jwiki が `--------------------` を明示）。`triggerOnTrash` に配線。
  捨てるのは**手札の**アクション。任意。**幽霊の山が空なら獲得できない**（捨て札も起きないと解すのが自然＝
  "discard ... to gain" の条件節。**明文なし＝confidence medium**）。

#### 魔法のランプ / Magic Lamp
- **コスト**: $0 ／ **種別**: 財宝 - 家宝 ／ **コイン**: +1 ／ **親**: Secret Cave(秘密の洞窟)
- **日本語テキスト**
  ```
  +1 コイン
  あなたがこのカードを使用するとき、あなたの場にちょうど1枚だけ出ているカードが6つ以上あるなら、このカードを廃棄する。
  そうした場合、願い3枚をそのカードの山から獲得する。
  ```
- **英語原文**
  - 現行(2021-)：`[$1]` ／ `If there are at least 6 cards that you have exactly 1 copy of in play (counting this), trash this. If you did, gain 3 Wishes.`
  - 初版(2017)：`When you play this, if there are at least 6 cards that you have exactly 1 copy of in play, trash this. If you do, gain 3 Wishes from their pile.`
  - ※2021年印刷で「**(counting this)**」が**追加**された（FAQ の明文化・機能不変）。
- **公式裁定**: RB:632-635「**Magic Lamp itself counts as one of the six cards.** A card you have two or more
  copies of in play does not count; **you have to have exactly one copy in play to count a card**. You can play
  more Treasures after trashing Magic Lamp, and still got [$1] from it for that turn.」
  `wiki:Magic_Lamp`「Since you can play Treasures in whatever order you want ... play one Copper to count as one
  of your six unique cards in play, play your Magic Lamp, and then play the rest of your Coppers.」
- **実装注意**: 数えるのは **`p.inPlay` ＋ `p.durationCards`（前ターンからの持続）** の **id 別枚数がちょうど1のもの**の**種類数**。
  自身を含む。**廃棄しても +$1 は残る**（コインを先に加算してから廃棄判定する順に書く）。区切り線なし。

#### ヤギ / Goat
- **コスト**: $2 ／ **種別**: 財宝 - 家宝 ／ **コイン**: +1 ／ **親**: Pixie(ピクシー)
- **日本語テキスト**
  ```
  +1 コイン
  あなたがこのカードを使用するとき、手札からカードを1枚廃棄してもよい。
  ```
- **英語原文**: 現行 `[$1]` / `You may trash a card from your hand.` ／ 初版 `When you play this, you may trash a card from your hand.`
- **公式裁定**: RB:596「Goat: **Trashing a card is optional.**」

#### 牧草地 / Pasture
- **コスト**: $2 ／ **種別**: 財宝 - **勝利点** - 家宝（Treasure - Victory - Heirloom）／ **コイン**: +1 ／ **親**: Shepherd(羊飼い)
- **日本語テキスト**
  ```
  +1 コイン
  ————
  あなたの持つ屋敷1枚につき1勝利点になる。
  ```
- **英語原文**: `[$1]` ／ `Worth 1 [VP] per Estate you have.`
- **公式裁定**: RB:637「For example if you have three Estates, then Pasture is worth 3 VP.」
- **実装注意**: **可変VP**＝`vpOf`（engine）と `vpOfPlayer`（cpu）の**両方**に「所持する屋敷の枚数 × 枚数」を足す
  （§0-5 絹の道・§0-14 城と同型。**CPU 側を忘れると終局読みがずれる**）。
  **「相続(inheritance)」で屋敷がアクションになっていても屋敷は屋敷**（種別が増えるだけ）＝数える。

#### 革袋 / Pouch
- **コスト**: $2 ／ **種別**: 財宝 - 家宝 ／ **コイン**: +1 ／ **親**: Tracker(追跡者)
- **日本語テキスト**
  ```
  +1 コイン
  +1 購入
  ```
- **英語原文**: `[$1]` / `+1 Buy`
- **公式裁定**: RB:639「This simply gives you [$1] and +1 Buy when you play it.」

#### 幸運のコイン / Lucky Coin
- **コスト**: $4 ／ **種別**: 財宝 - 家宝 ／ **コイン**: +1 ／ **親**: Fool(愚者)
- **日本語テキスト**
  ```
  +1 コイン
  あなたがこのカードを使用するとき、銀貨1枚を獲得する。
  ```
- **英語原文**: 現行 `[$1]` / `Gain a Silver.` ／ 初版 `When you play this, gain a Silver.`
- **公式裁定**: RB:630「You can **choose not to play** Lucky Coin, and thus not gain a Silver.」

#### 呪われた金貨 / Cursed Gold
- **コスト**: $4 ／ **種別**: 財宝 - 家宝 ／ **コイン**: **+3** ／ **親**: Pooka(プーカ)
- **日本語テキスト**
  ```
  +3 コイン
  あなたがこのカードを使用するとき、呪い1枚を獲得する。
  ```
- **英語原文**: 現行 `[$3]` / `Gain a Curse.` ／ 初版 `When you play this, gain a Curse.`
- **公式裁定**: RB:560「You can **choose not to play** Cursed Gold, and thus not gain a Curse.」
- **実装注意**: **呪い山が空なら呪いは獲得しないが +$3 は得る**（一般則）。
  「財宝を出さない自由」は既存の一般則なので、`PLAY_ALL_TREASURES`（§0-24 `playAllOrder`）が
  **呪われた金貨を勝手に出さないようにするか、CPU の判断に委ねるか**を決めること（下記 §9 参照）。

### 2-4. 実装注意（家宝の共通）

- **`DOM.CARDS` には入れるが `NON_SUPPLY` とも違う特殊な立場＝「山が存在しない」**。
  - `initSupply` に**キーを作らない**。`canBuyCard`＝false。
  - **`gainableBase` / `costUpTo` / `costUnder` / `costExact` / `sameCost` の候補から必ず除外**
    （§0-23 の述語に非サプライと同じ扱いで足す。engine拒否・CPU非提案・UIフィルタの4面同時）。
  - **`emptyPileCount`（3山終了）に一切関与しない**。
  - **保存則 tally には数える**（開始デッキの実カード）。`allCards` にも当然入る。
- `createInitialState` の開始デッキ生成を「屋敷3＋銅貨7」から **「屋敷3＋家宝N＋銅貨(7−N)」**に一般化する。
  **避難所(§0-8)と同じ場所だが、避難所は屋敷3枚を置換・家宝は銅貨を置換＝両立する**
  （暗黒時代＋夜想曲の mix-all で同時に起きる。**テストで必ず踏むこと**）。
- **交換(exchange)の対象にできない**（§7-3）。既存の `returnToPile` 系に**「戻す山が存在するか」のチェック**が要る。
  現行エラッタの**交易商人(Trader)は「獲得したカードを銀貨と交換する」**＝家宝は交換できないが、
  そもそも家宝は獲得されないので実害はない。
- **mix-all では家宝7種が同時成立し得る**（銅貨0枚スタート）＝`invariants` に必ず入れる。

---

## 機構3. 幸運（Fate）と祝福（Boon）

### 3-1. 公式ルール（逐語 RB:85-91 ＝ `wiki:Boon` Official rules と完全一致）

> "Nocturne has Fate cards and Boons. **Fate cards can somehow give players Boons; all the Fate type means
> is that the Boons are shuffled at the start of the game.** Boons are a face-down deck of cards that are
> revealed as needed. The phrase **"receive a Boon" means, turn over the top Boon, and follow the
> instructions on it.** If the Boons deck is empty, first **shuffle the discarded Boons to reform the deck;
> you may also do this any time all Boons are in their discard pile.** Received Boons normally go to the
> Boons discard pile, but **three (The Field's Gift, The Forest's Gift, and The River's Gift) go in front of
> a player until that turn's Clean-up.**"
>
> **Preparation（RB:66-67）**: "If any Kingdom cards being used have the **Fate** type, shuffle the Boons and
> put them near the Supply, and **put the Will-o'-Wisp pile near the Supply also**."

### 3-2. 確定事項

| # | 事項 | 根拠 |
|---|---|---|
| 1 | 祝福は**12枚（各1枚）**。裏向きの山＋捨て札置き場の2ゾーン | RB:36-38 |
| 2 | セットアップ＝**幸運(Fate)が1枚でもあれば**祝福をシャッフルして脇に置き、**ウィル・オ・ウィスプの山も置く** | RB:66-67 |
| 3 | 山が空なら**捨て札をシャッフルして作り直す**。「全部が捨て札にある」ときは**いつでも任意で**作り直してよい | RB:88-89 |
| 4 | **3枚（田畑/森/川の恵み）はそのターンのクリンナップまでプレイヤーの前に置く**→クリンナップで祝福の捨て札へ | RB:90-91／RB:139-140「returning **The Forest's Gift to the Boons discard pile**」 |
| 5 | **山も捨て札も空なら（全部が脇/手元にある等）、祝福を受け取れない** | `wiki:Boon`「In the unlikely event that all the Boons are set aside or otherwise occupied at the same time, so there are no Boons in the Boons deck or discard pile when you are told to receive a Boon, **you don't receive one**」 |
| 6 | **★祝福の捨て札は「一番上だけ」が公開情報**。それ以外を見てはならない | jwiki:祝福「祝福の捨て札は**一番上のみが公開情報であり、それ以外を見てはならない**。」 |
| 7 | **プレイヤーが保持中の祝福は、山を作り直すときに新しい山に入らない** | jwiki:祝福「恵みの村の効果や、祝福に書かれた効果で各プレイヤーに保持されたままの祝福は新たな山札に入らない。」「愚者によって3枚の祝福を公開する途中で山札が空になった場合、すでに表になっているカードは新たな山札に入らない。」 |
| 8 | **ドルイド例外**：ゲーム開始時に3枚を**表向きで脇に置く**。他の幸運カードはその3枚を出さない＝**山は残り9枚** | RB:230-232「the deck will consist of **the other nine Boons**」 |
| 9 | ドルイドで受けた祝福は**脇に置いたまま**。「クリンナップまで持っておく」型でも脇から動かさない | RB:233-235「leave it there in the set-aside area for Druid, **even if it is one of the Boons that says to keep it until Clean-up** (e.g. The Field's Gift)」 |
| 10 | 「祝福を**取る(take)**」（恵みの村/愚者）と「**受ける(receive)**」は別。取った祝福は解決までプレイヤーの前に置かれる | RB:147-149「Blessed Village: You see the Boon before deciding to resolve it immediately or at the start of your next turn. If you save it for next turn, **it sits in front of you until then** (or until the end of that turn if it says to keep it out until Clean-up)」 |
| 11 | ピクシーは「**山の一番上の祝福を捨てる**」→ **これ(ピクシー)を廃棄したなら、その祝福を2回受ける**（廃棄しなければ祝福は**受けない**・捨てられるだけ） | カード文（RB:396-402）「Discard the top Boon. **You may trash this to receive that Boon twice.**」／RB:386-387「If you receive a Boon that says to keep it until Clean-up, move it to in front of you, and **remember that you get it twice**」 |
| 12 | 聖なる木立ちで共有できるのは「**+$ を出さない祝福**」だけ。**田畑の恵みと森の恵みは共有されない**。川の恵みは各人が**あなたのターン終了時に同時に**引く | RB:433-436「You have to receive the Boon; the other players can choose to receive it. **The Field's Gift and The Forest's Gift are not shared.** The River's Gift means that each player choosing to receive it draws a card at the end of your turn, **at the same time as you**」 |
| 13 | 保持中の祝福は**ゲーム終了時に所有カードに数えない**（庭園/壁などに影響しない） | jwiki:祝福「恵みの村の獲得時効果でプレイヤーの手元に祝福カードが置いてある状態でゲームが終了したとしても、それはそのプレイヤーの**所有カードに含まれない**。」 |

### 3-3. 幸運(Fate)カード8種

$2 **Druid(ドルイド)** / **Pixie(ピクシー)** / **Tracker(追跡者)** ・ $3 **Fool(愚者)** ・
$4 **Bard(詩人)** / **Blessed Village(恵みの村)** ・ $5 **Idol(偶像)** / **Sacred Grove(聖なる木立ち)**
（`wiki:Fate` List of Fate cards）

### 3-4. 祝福12種（全データ）

英語は `wiki:` の Boon text ＋ RB のカード画像で二重確認。日本語は jwiki:祝福（HJ 公式文面）。
**表示は本プロジェクト書式（`+1 カード` `+1 コイン` `+1 購入`）に直してある**
（jwiki は `+1 カードを引く` `+1 カードを購入` と書くが同義）。

| 英語名 | 日本語 | 英語原文（現行・逐語） | 日本語テキスト |
|---|---|---|---|
| The Earth's Gift | **大地の恵み** | `You may discard a Treasure to gain a card costing up to [$4].` | 手札の財宝カード1枚を捨て札にして、コスト4以下のカード1枚を獲得してもよい。 |
| The Field's Gift | **田畑の恵み** | `+1 Action` / `+[$1]` / `(Keep this until Clean-up.)` | `+1 アクション` / `+1 コイン` / (これをクリーンアップフェイズまで持っておく。) |
| The Flame's Gift | **炎の恵み** | `You may trash a card from your hand.` | 手札のカード1枚を廃棄してもよい。 |
| The Forest's Gift | **森の恵み** | `+1 Buy` / `+[$1]` / `(Keep this until Clean-up.)` | `+1 購入` / `+1 コイン` / (これをクリーンアップフェイズまで持っておく。) |
| The Moon's Gift | **月の恵み** | `Look through your discard pile. You may put a card from it onto your deck.` | あなたの捨て札のカードすべてを見る。その中のカード1枚をあなたのデッキの上に置いてもよい。 |
| The Mountain's Gift | **山の恵み** | `Gain a Silver.` | 銀貨1枚を獲得する。 |
| The River's Gift | **川の恵み** | `+1 Card at the end of this turn.` / `(Keep this until Clean-up.)` | このターンの終了時、`+1 カード`。 / (これをクリーンアップフェイズまで持っておく。) |
| The Sea's Gift | **海の恵み** | `+1 Card` | `+1 カード` |
| The Sky's Gift | **空の恵み** | `You may discard 3 cards to gain a Gold.` | あなたの手札3枚を捨て札にして、金貨1枚を獲得してもよい。 |
| The Sun's Gift | **太陽の恵み** | `Look at the top 4 cards of your deck. Discard any number of them and put the rest back in any order.` | あなたのデッキの上からカード4枚を見る。その中から好きな枚数を捨て札にし、残りを好きな順番でデッキの上に戻す。 |
| The Swamp's Gift | **沼の恵み** | 現行 `Gain a Will-o'-Wisp.`／初版 `Gain a Will-o'-Wisp from its pile.` | ウィル・オ・ウィスプ1枚をそのカードの山から獲得する。 |
| The Wind's Gift | **風の恵み** | `+2 Cards` / `Discard 2 cards.` | `+2 カード` / 手札からカード2枚を捨て札にする。 |

**祝福の公式裁定**
- **月の恵み**: RB:782「If your discard pile is empty, this will not do anything.」／
  jwiki:祝福「**捨て札のカードを見るのは強制**だが、その中のカード1枚をデッキトップに置くかどうかは**任意**。」
- **川の恵み**: RB:794「**You draw the card after drawing your hand for your next turn.**」（＝先引きの**後**）
- **空の恵み**: RB:801-803「If you choose to do this with **fewer than three cards in hand**, you will
  **discard the rest of your cards but not gain a Gold**. Discarding three cards gets you **one Gold, not three**.」
  jwiki「捨てることを選択した場合、手札が3枚あれば3枚、それ未満なら全て捨てる。**手札が3枚以上あるのに
  1枚や2枚だけを捨てることはできない**」（探索(quest)と同型）。
- **風の恵みは強制**: jwiki「＋2ドローを実行し、**実際に2枚引けたかどうかに関わらず**手札2枚を捨て札にする。」
- **★空の恵み／風の恵みの複数枚捨ては「同時に」**: jwiki「1枚ずつではなく、カード全てを**同時に**捨て札にする処理。
  例えば、手札からまず坑道を捨て札にする→坑道のリアクション効果で金貨を獲得→手札から望楼を公開し
  金貨をデッキの上に置く→望楼を捨て札にする…という動きはできない。」
  （※村有緑地のように「捨てた瞬間にリアクションして +1ドロー」は可能だが、**そこで引いたカードをさらに
  同じ処理で捨てることはできない**）
- **沼の恵み**: ウィル・オ・ウィスプの山が空なら獲得できない（山は12枚しかない）。

### 3-5. 実装注意

- **祝福デッキ＝非カードの新ゾーン**。`state.boons = { deck:[], discard:[], druid:[] }`。
  `state.landmarks` / `state.pileVP` / `state.artifacts` と同型＝**保存則 tally に混ぜない**・
  `clone` で `maskStateFor` を素通しさせる…**が、素通しさせてはいけない部分がある（下記）**。
- **★マスク（オンライン）**：
  - `boons.deck` ＝ **中身も順序も全員に秘密**（枚数だけ公開）。
  - `boons.discard` ＝ **一番上の1枚だけ公開**、残りは伏せる（jwiki の明文ルール）。
  - `boons.druid`（ドルイドの脇3枚）＝ **表向き＝全員に公開**。
  - `p.boonsInFront` / `p.boonHeld` ＝ **公開**（プレイヤーの前に置かれる）。
  - ※下書きは「捨て札は全部公開」としていたが**誤り**。呪詛も同じ（§4-5）。
- 「クリンナップまで前に置く」3枚は **`p.boonsInFront = [boonId,...]`**（プレイヤーごとの配列。
  **川の恵みは聖なる木立ちで複数人が同時に持ち得る**／ピクシーで同じ祝福を2回受けると1枚で2回ぶん）。
  クリンナップで `boons.discard` へ戻す。
- **川の恵みは「先引きの後」に +1ドロー**＝`cleanupAndAdvance` の先引き**直後**
  （§0-25 のリス、§0-21 の保存(save)、§忠犬 と**同じ場所**）。
  田畑/森の恵みはその場で `addActions` / `+buy` / `addCoins`。
- **`addCoins(state,n)` / `addActions(t,n)` を必ず通す**（§0-25 の雪深い村・カメレオン対応）。
- **山も捨て札も空なら「受けない」で終端する**こと（pending を開かない）。
  ドルイド3枚＋恵みの村の保留＋田畑/森/川の保持 が重なると実際に起こり得る。
- ドルイドのセットアップは `createInitialState` で3枚を `boons.druid` に移し、**残り9枚で山を作る**。
- **山の作り直しに `boons.druid` と各プレイヤーの保持ぶんを入れない**（#7）。
- 「祝福を受ける」の結果は**選択待ち(pending)を生むものが多い**（大地/炎/月/空/太陽/風）＝
  **4点セット必須**。かつ**ドルイド・愚者・恵みの村は「複数の祝福を順に受ける」**ので、
  §0-26 の教訓どおり **`state.pending` を直接代入せずキューに積む**こと。

---

## 機構4. 不運（Doom）と呪詛（Hex）

### 4-1. 公式ルール（逐語 RB:93-99 ＝ `wiki:Hex` Official rules と完全一致）

> "Nocturne also has Doom cards and Hexes. Doom cards can somehow give players Hexes; **all the Doom type
> means is that the Hexes are shuffled at the start of the game.** Hexes are a face-down deck of cards that
> are revealed as needed. The phrase **"receive a Hex" means, turn over the top Hex, and follow the
> instructions on it.** **"Each other player receives the next Hex" means, turn over just one Hex, and the
> other players all follow the instructions on that same Hex.** If all Hexes have been used, shuffle the
> discards to reform the deck; do this whenever the deck is empty. **Received Hexes always go to the Hexes
> discard pile.**"
>
> **Preparation（RB:67-69）**: "If any have the **Doom** type, shuffle the Hexes and put them near the Supply,
> and **put Deluded/Envious and Miserable/Twice Miserable near the Supply also**."

### 4-2. 確定事項

| # | 事項 | 根拠 |
|---|---|---|
| 1 | 呪詛は**12枚（各1枚）** | RB:39-40 |
| 2 | セットアップ＝**不運(Doom)が1枚でもあれば**呪詛をシャッフル＋**錯乱/嫉妬 と 生活苦/二重苦 も用意** | RB:67-69 |
| 3 | **「他のプレイヤーは各自、次の呪詛を受ける」＝呪詛は1枚だけめくる**。全員が**同じ1枚**に従う（人数分めくらない） | RB:96-97（**最重要**） |
| 4 | **祝福と違って「前に置き続ける呪詛」は無い**＝解決後は必ず呪詛の捨て札へ（状態カードは別物） | RB:98-99 |
| 5 | 山が空なら捨て札を混ぜ直す。**祝福と違い「任意で作り直す」節は無い** | RB:97-98 |
| 6 | **★呪詛の捨て札も「一番上以外は見てはならない」** | jwiki:呪詛「呪詛の捨て札は一番上以外見てはならない。」 |
| 7 | **★堀・灯台などで呪詛の影響を受けるプレイヤーが1人もいない場合でも、カードの指示があれば呪詛を1枚めくる** | jwiki:呪詛（逐語）。**confidence: medium**（英語一次資料に明文なし＝§10-1） |
| 8 | **★リアクション（堀など）は「呪詛をめくる前」に公開して処理しなければならない** | jwiki:呪詛「不運-アタックカードの使用に対して堀などでリアクションする場合、解決前すなわち**呪詛をめくる前**に公開して処理しなくてはならない。実機でプレイしている場合、アタックカードの使用者は呪詛を公開する前にリアクションの有無を尋ねることが望ましい。」 |
| 9 | 不運のうち**アタックは4種**（暗躍者/迫害者/吸血鬼/人狼）＝堀・灯台・守護者で防げる。**呪われた村（獲得時）とレプラコーン（使用時）は自分が受ける**＝非アタック | `wiki:Hex`「If the Doom card is an Attack, only one Hex is revealed, and it affects all other players」／jwiki:呪詛 の関連表 |
| 10 | 呪われた村の呪詛は購入フェイズに受けることが多く、**空振りする呪詛がある** | RB:217-219「since that will often be in your Buy phase, **some of the Hexes may not do anything to you**」 |

### 4-3. 不運(Doom)カード6種

$3 **Leprechaun(レプラコーン)** ・ $4 **Skulk(暗躍者)** ・
$5 **Cursed Village(呪われた村)** / **Tormentor(迫害者)** / **Vampire(吸血鬼)** / **Werewolf(人狼)**
（`wiki:Doom` List of Doom cards ＋ jwiki:呪詛 の関連表で日本語名を二重確認）

### 4-4. 呪詛12種（全データ）

| 英語名 | 日本語 | 英語原文（逐語） | 日本語テキスト |
|---|---|---|---|
| Bad Omens | **凶兆** | `Put your deck into your discard pile. Look through it and put 2 Coppers from it onto your deck (or reveal you can't).` | あなたのデッキを捨て札に置く。あなたの捨て札のカードすべてを見て、そこから銅貨2枚をデッキの上に置く。(それができない場合、捨て札のカードすべてを公開する。) |
| Delusion | **幻惑** | `If you don't have Deluded or Envious, take Deluded.` | あなたが錯乱も嫉妬も持っていなければ、錯乱を取る。 |
| Envy | **羨望** | `If you don't have Deluded or Envious, take Envious.` | あなたが錯乱も嫉妬も持っていなければ、嫉妬を取る。 |
| Famine | **飢饉** | `Reveal the top 3 cards of your deck. Discard the Actions. Shuffle the rest into your deck.` | あなたのデッキの上からカード3枚を公開し、公開したアクションカードすべてを捨て札にする。残りをあなたのデッキに加えてシャッフルする。 |
| Fear | **恐怖** | `If you have at least 5 cards in hand, discard an Action or Treasure (or reveal you can't).` | あなたの手札が5枚以上あれば手札からアクションカードか財宝カード1枚を捨て札にする。(それができない場合、手札を公開する。) |
| Greed | **貪欲** | `Gain a Copper onto your deck.` | 銅貨1枚を獲得し、あなたのデッキの上に置く。 |
| Haunting | **憑依** | `If you have at least 4 cards in hand, put one of them onto your deck.` | あなたの手札が4枚以上あれば、手札のカード1枚をあなたのデッキの上に置く。 |
| Locusts | **蝗害** | `Trash the top card of your deck. If it's Copper or Estate, gain a Curse. Otherwise, gain a cheaper card that shares a type with it.` | あなたのデッキの一番上のカード1枚を廃棄する。廃棄したカードが屋敷か銅貨だった場合、呪い1枚を獲得する。そうでない場合、廃棄したカードと同じ種類を持ち、コストが少ないカード1枚を獲得する。 |
| Misery | **みじめな生活** | `If this is your first Misery this game, take Miserable. Otherwise, flip it over to Twice Miserable.` | このゲーム中にあなたが初めてみじめな生活の効果を受けた場合、生活苦を取る。そうでない場合、生活苦を裏返して二重苦にする。 |
| Plague | **疫病** | `Gain a Curse to your hand.` | 呪い1枚を獲得し、あなたの手札に加える。 |
| Poverty | **貧困** | `Discard down to 3 cards in hand.` | 手札が3枚になるように捨て札をする。 |
| War | **戦争** | `Reveal cards from your deck until revealing one costing [$3] or [$4]. Trash it and discard the rest.` | コスト3か4のカードを1枚が公開されるまで、あなたのデッキを上から公開する。そのカードを廃棄し、残りを捨て札にする。 |

**呪詛の公式裁定**
- **凶兆**: RB:708-710「Normally you will end up with a deck consisting of two Coppers, and a discard pile
  with the rest of your cards. **Sometimes you will only have one or no Coppers; in those cases reveal your
  deck to demonstrate this.**」／**★銅貨が1枚しかない場合は、その1枚を山札の上に置いたうえで公開する**
  （jwiki:呪詛 コメント欄・公式ルルブ照会「その通りです」＝ドミニオン一般則「可能な限り実行する」）。
- **飢饉**: RB:739「The revealed cards that are not Actions are **shuffled back into your deck**.」
  ＝**その場でシャッフルが発生する**（＝へそくり `stashPlacement` / 星図 と同じ「対話を挟めないシャッフル」）。
- **恐怖**: RB:751-752「You discard an Action or Treasure if you have either, and **only reveal your hand if
  you have no Actions and no Treasures**.」
- **蝗害**: RB:754-756「**Types are the words on the bottom banner**, like Action and Attack. If there is no
  cheaper card that shares a type - for example if the card trashed is **Curse** - the player **does not gain
  anything**.」
- **みじめな生活**: RB:779-780「If this hits you for a **third** time in a game, **nothing will happen**; you
  stay at Twice Miserable.」／**プレイヤーごとに独立**（jwiki コメント「A・B双方が生活苦状態になります。
  呪詛や祝福の効果はそれを受けた人にしか発揮しません」）。
- **戦争**: RB:808-809「If you do not find a card costing [$3] or [$4], **your entire deck will end up in your
  discard pile, with nothing trashed**.」／**★山札を全部公開しても見つからなければ、捨て札をシャッフルして
  新しい山札を作り公開を続ける**。それでも見つからなければ全部捨て札にして終了（廃棄は起きない）
  ＝「特定のカードが見つかるまで公開する」の一般則（jwiki:呪詛 コメント欄）。

### 4-5. 実装注意

- **呪詛デッキ＝非カードの新ゾーン** `state.hexes = { deck:[], discard:[] }`。祝福と同型。
  **マスク＝`deck` は完全に秘密、`discard` は一番上だけ公開**（#6）。
- **★「他のプレイヤーは各自、次の呪詛を受ける」の実装順序（ここを間違えると重大なルール違反）**
  1. アタックを使用 → **全員のリアクション窓（堀・馬商人・隊商の護衛…）を先に全部閉じる**（#8）。
  2. **その後で呪詛を1枚だけめくって id を確定**する（`t.currentHex` 等に保持）。
  3. 免疫でない被害者に**手番順（手番プレイヤーの左隣から時計回り）**で同じ id を適用する。
  4. 全員の解決が終わったら `hexes.discard` へ。
  - **被害者ごとにめくってはいけない**。**リアクション解決より前にめくってもいけない**。
  - **全員が免疫でも1枚めくって捨てる**（#7・confidence medium・§10-1）。
- **貪欲＝「銅貨を山札の上に獲得」**＝`gain(dest:'deck')`。**捨て札置き場を経由しない**
  （"gain X onto your deck" は直接獲得の定型。§0-26 の刈り入れ／帝国の石(rocks)の 2021 エラッタと同型）。
- **疫病＝「呪いを手札に獲得」**＝`gain(dest:'hand')`。**呪い山が空なら何も起きない**。
- **貧困＝`discard_down` の既存汎用機構**（民兵型・手札3枚まで）。ただしこれは**アタックの副次効果ではなく
  呪詛の効果**なので、免疫判定は呪詛の配布時点で済んでいる。
- **幻惑/羨望/みじめな生活は状態(State)を配る**＝§5。
- **蝗害の「同じ種別を持ち、コストが少ないカード」は成分別のコスト比較**＝
  **`costUnder(state, id, ref)`（§0-23）を使う**。素の `cost <` を書くとポーション費用・負債コスト・
  ロック中の分割山下段・非サプライを取りこぼして mix-all で livelock する。
  **種別の一致は「カード下部の種別欄の語」**＝`DOM.CARDS[id].types` の積集合が非空か。
- **飢饉のシャッフル**は対話を挟めない（既存の許容簡略化と同型）。

---

## 機構5. 状態（State）

### 5-1. 公式ルール（逐語 RB:101-106 ＝ `wiki:State` Official rules と完全一致）

> "**Three Hexes and one Kingdom card give players a State**; this is a card that goes in front of a player
> and applies a rule. **Deluded and Envious affect a single turn, and then are returned; Miserable and Twice
> Miserable affect scoring at the end of the game; Lost in the Woods affects one player's turns until
> another player takes it.** Deluded and Envious are **on the same card**; have the relevant side face-up.
> Similarly Miserable and Twice Miserable are on the same card. **A State only applies while a player has it.**"

### 5-2. 枚数

RB:46-47：`6 each of ... **Deluded / Envious**, **Miserable / Twice Miserable**` ／ `**1 of Lost in the Woods**`
＝**錯乱/嫉妬は両面1枚のカードが6枚（1人1枚まで）／生活苦/二重苦も両面1枚が6枚／森の迷子は全体で1枚**。
`wiki:Deluded`「there is **one copy for each player**」／`wiki:Lost_in_the_Woods`「There is **one copy of it**,
and players can take it from each other」。

### 5-3. 状態5種（全データ）

---

#### 錯乱 / Deluded
- **種別**: 状態（State）／コストなし／**幻惑(Delusion) が配る**
- **日本語テキスト**
  ```
  あなたの購入フェイズの開始時、このカードを返し、あなたはこのターンが終わるまでアクションカードを購入できない。
  ```
- **英語原文（2017/2021 とも同一）**: `At the start of your Buy phase, return this, and you can't buy Actions this turn.`
- **公式FAQ**（`wiki:Deluded`／RB:717-719）
  - "This prevents you from **buying Action cards** during one turn, **starting in the Buy phase**."
  - "If you get Deluded during your turn **before** the Buy phase (such as with **Leprechaun**), it will apply
    **that** turn; **normally it will apply to your next turn**."
  - RB:724「Delusion: Deluded / Envious is two-sided; **take it with the Deluded side face up**.」
- **その他の裁定**（`wiki:Deluded` Other rules clarifications）
  - "The effect doesn't kick in until the beginning of your Buy phase; **if you play Black Market during the
    Action phase, you can buy cards from the Black Market deck normally.**"
  - "However, if you start your Buy phase, return Deluded, somehow return to your Action phase (for example by
    gaining **Villa**), and then play Black Market, **you won't be able to buy Actions from the Black Market
    deck, since Deluded's effect lasts for the rest of the turn once activated.**"
  - "**This does not stop you from gaining Action cards** via cards such as Horn of Plenty, Sunken Treasure,
    Tools, etc. in your Buy phase, **since it is not buying**."
- **実装注意**
  - `p.deluded`（`p.envious` と**排他**）＋ `t.cantBuyActions`（このターン限りのフラグ）の**2段構え**。
  - **禁止されるのは「アクションカードの購入」だけ**。獲得はブロックしない。**イベント/プロジェクトの購入も
    ブロックしない**（カードではない）。**人狼以外の夜行カードはアクションカードではないので購入できる**
    （＝種別ルールからの帰結。**明文の裁定は見つからなかった＝confidence high の演繹**）。人狼は
    アクションカードなので**買えない**。
  - **★「返す」判定を1ターン1回にしてはいけない**（下書きの誤り）＝§10 の Villa 例を参照。詳細は 5-4。

#### 嫉妬 / Envious
- **種別**: 状態（State）／**羨望(Envy) が配る**
- **日本語テキスト**
  ```
  あなたの購入フェイズの開始時、このカードを返し、このターンが終わるまで銀貨と金貨は1コインのみ生み出す。
  ```
- **英語原文**: `At the start of your Buy phase, return this, and Silver and Gold make [$1] this turn.`
- **公式FAQ**（RB:726-730）
  - "This causes Silver and Gold to make [$1] when you [play them] in your Buy phase for one turn, rather than
    their usual [$2] and [$3], starting in the Buy phase. **It does not affect other Treasures, just Silver and
    Gold.**"
  - "If you get Envious during your turn before the Buy phase (such as with Leprechaun), it will apply that turn;
    normally it will apply to your next turn."
  - RB:738「Envy: Deluded / Envious is two-sided; **take it with the Envious side face up**.」
- **その他の裁定**（`wiki:Envious`）
  - "**Silvers and Golds played before your Buy phase, such as by Storyteller, are not affected.**"
  - "Once you return Envious, it will affect your Silvers and Golds **for the rest of the turn**, even if you
    return to the Action phase with **Villa** or **Cavalry** and then start a new Buy phase."
  - "If you don't follow the instructions of a Silver or Gold (due to Enlightenment or Highwayman), Envious will
    have no effect."
- **実装注意**
  - `t.enviousActive`（このターン限り）。**銀貨/金貨のコイン量を動的に 1 にする**
    （`treasureCoins` 相当のところで判定。**`isTreasureFor` の資本主義とは無関係**）。
  - **語り部(storyteller)でアクションフェイズに出した銀貨/金貨は対象外**。実質の判定軸は
    「購入フェイズか」ではなく「**嫉妬を返した後か**」。
  - **銀貨/金貨の付随効果は消えない**（商人の「最初の銀貨で +$1」等）。減るのはカード自身のコインだけ。
  - **冠/ティアラ/偽造通貨で2回使っても各回 $1**。

#### 生活苦 / Miserable
- **種別**: 状態（State）／**みじめな生活(Misery) が配る**
- **日本語テキスト**: `-2 勝利点`
- **英語原文**: `-2 [VP]`
- **公式FAQ**: RB:771-773「When scoring at the end of the game, you lose **2 VP**. This does nothing until then,
  it just sits in front of you.」

#### 二重苦 / Twice Miserable
- **種別**: 状態（State）／生活苦の裏面
- **日本語テキスト**: `-4 勝利点`
- **英語原文**: `-4 [VP]`
- **公式FAQ**: RB:805-806「When scoring at the end of the game, you lose **4 VP**.」／
  RB:779-780「3回目は何も起きない（二重苦のまま）」
- **実装注意**: 生活苦との**排他 enum** `p.misery ∈ {0,1,2}`。**-2 / -4 は累積ではなく置換**。
  `scoreGame` で減算し、**得点は負になり得る＝下限クランプ禁止**（§0-19 と同じ）。
  **CPU の `vpOfPlayer` / `winsIfEnds` にも同じ減算を入れる**（入れないと終局読みがずれる）。

#### 森の迷子 / Lost in the Woods
- **種別**: 状態（State）／**愚者(Fool) が配る**／**ゲーム中に1枚だけ**
- **日本語テキスト**
  ```
  あなたのターンの開始時、あなたは手札1枚を捨て札にして祝福を1つ受けてもよい。
  ```
- **英語原文**: `At the start of your turn, you may discard a card to receive a Boon.`
- **公式FAQ**（RB:758-760 ／ `wiki:Lost_in_the_Woods`）
  - "**The two sides are the same; use either.**"
  - "Using the ability is **optional**."
  - "Lost in the Woods stays in front of you turn after turn, **until another player takes it with a Fool**."
  - RB:293-299（愚者）「**If you have Lost in the Woods, playing Fool does nothing.** If you do not have Lost in
    the Woods, you take it - **even from another player, if another player has it** - and also take 3 Boons and
    receive them in the order you choose ... You do not need to pick the full order in advance - pick one to
    resolve, then after resolving it pick another to resolve."
- **実装注意**
  - **`state.lostInTheWoods = 席番号 | null`**（トップレベルの公開スカラー。`state.artifacts` と同型＝
    非カード・保存則対象外・マスク素通し）。
  - ターン開始時の任意効果は **`t.startQueue` に積む**（§0-22 の方針。`state.pending` を直接立てない）。
  - **捨て札→祝福を受ける**＝**捨て札トリガーが発火する**（トンネル/忠犬/村有緑地）。
  - **愚者を持ち主自身が使うと完全に空振り**（祝福も取らない）＝CPU の終端保証に注意。

### 5-4. ★錯乱/嫉妬の発動タイミング（下書きが取り違えた箇所・実装の肝）

jwiki:呪詛 の詳細なルールが逐語で示している：

> 「錯乱や嫉妬の能力にある**「返す」とは手放して誰も保有していない共通プールへと戻すこと**である。**裏返すことではない**。」
> 「錯乱と嫉妬は**購入フェイズの開始時に誘発するまで効果を発揮しない**。言い換えれば、**手元にある間は影響を受けない**。
> 「状態カード」でありながら、直観に反するため注意が必要である。」
> 「錯乱と嫉妬を得ていても、**闇市場や語り部や刈り入れによりカードを購入 or 財宝を使用した際は影響を受けない**。」
> 「錯乱と嫉妬が効果を発揮した後、**ヴィラなどの効果でアクションフェイズに戻った際**に上記のカードを使用したり、
> 王笏、資本主義、技術革新などで購入フェイズに使用したりするときは、**当然影響を受ける**。」
> 【間違いやすい例】「プレイヤーAが（購入フェイズの開始時**の後**の処理である）**呪われた村を購入して獲得した際に
> 錯乱 or 嫉妬を得た**」場合 → **この購入フェイズ時には返すことは無く、効果を発揮しない**。
> **Aの[次の購入フェイズ開始時]が訪れた際に返し、効果を発揮する**。
> ※[次の購入フェイズ開始時]が訪れるのは**Aの次ターンであることが多いが、ヴィラなどの効果でアクションフェイズに
> 戻り、再度購入フェイズに入る際でも[次の購入フェイズ開始時]が訪れる**ので注意。
> 【例】（購入フェイズ開始時の処理で）レプラコーンを使用して錯乱 or 嫉妬を得た場合
> → その一連の処理を終えた後も**まだ[購入フェイズ開始時]なので、即座に返して効果を発揮しなければならない**。

**したがって実装は次の2階建てにする**：

```
END_ACTION_PHASE（＝購入フェイズ開始）が走るたびに毎回：
  if (p.deluded) { p.deluded = false;  t.cantBuyActions = true; }   // 状態を共通プールへ返す
  if (p.envious) { p.envious = false;  t.enviousActive  = true; }
  ※「購入フェイズ開始時」の他の処理（宝箱・ピアッツァ相当・闘技場…）と同じキューに載せ、
    その一連の処理の中で新たに錯乱/嫉妬を得たら、その場でもう一度この判定を回す。

t.cantBuyActions / t.enviousActive は freshTurn でのみ消える（＝そのターン中は消えない）。
```

- **`END_ACTION_PHASE` は1ターンに複数回走り得る**（ヴィラ／騎兵(cavalry)でアクションフェイズに戻る）。
  **毎回 `p.deluded` / `p.envious` を見て返すこと**。1回だけの判定にすると、
  「購入フェイズ中に呪われた村を獲得して錯乱を得る → ヴィラで戻って再突入」で発動しない。
- 逆に **`t.cantBuyActions` / `t.enviousActive` は一度立ったらそのターン中は下ろさない**
  （`wiki:Deluded`「lasts for the rest of the turn once activated」）。
- **`END_ACTION_PHASE` の解除処理と `t.treasuresLocked`（§0-21）の解除は同じ場所**なので巻き込み注意。

### 5-5. 状態の一般則（実装まとめ）

- **状態は「カード」ではない**（§7-1）。デッキに入らない・獲得ではない・**場のカードでもない**
  （jwiki コメント「場に出ているカードとは別枠。アーティファクトに近い」）。
  ＝**レプラコーン「場にちょうど7枚」／魔法のランプ／迫害者／夜襲 は状態を数えない**。
- 3系統：**`p.deluded` / `p.envious`（排他 boolean）／`p.misery ∈ {0,1,2}`／`state.lostInTheWoods`（全体1つ）**。
  すべて**非カード＝保存則 tally に混ぜない**（`landmarkVP`・`artifacts` と同型）。
- **すべて公開情報**＝`maskStateFor` で伏せない。
- 「返す(return)」は**共通プールに戻すだけ**。獲得でも廃棄でもない。**裏返すことではない**。
- **`state.result.scores[i]` の表示に生活苦/二重苦の -2/-4 を出す**（終局画面で「なぜ点が減ったか」が分かるように）。

---

## 機構6. 非サプライ山と、山を持たないカード

### 6-1. セットアップ（逐語 RB:71-76）

> "**If Druid is being used, deal three Boon cards face up for use with it. If Necromancer is being used, put
> the three Zombies into the trash. If Fool is being used, get Lost in the Woods and have it handy. If Vampire
> is being used, put the Bat pile near the Supply. If Leprechaun or Secret Cave is being used, put the Wish
> pile near the Supply. If Devil's Workshop or Tormentor are being used, put the Imp pile near the Supply; if
> Cemetery is being used, put the Ghost pile near the Supply; and if Exorcist is being used, put all three
> Spirit piles - Will-o'-Wisp, Imp, and Ghost - near the Supply.**"
> ＋ **RB:66-67**「幸運(Fate)が1枚でもあれば **ウィル・オ・ウィスプの山も置く**」（沼の恵みのため）

### 6-2. セットアップ表【実装用・これが正本】

| 用意するもの | 枚数 | 条件（いずれか1つでも成立すれば置く） |
|---|---|---|
| 祝福デッキ | **12**（ドルイド有りなら脇3＋山9） | 王国に **Fate** が1枚以上（ドルイド/ピクシー/追跡者/愚者/詩人/恵みの村/偶像/聖なる木立ち） |
| 呪詛デッキ | **12** | 王国に **Doom** が1枚以上（レプラコーン/暗躍者/呪われた村/迫害者/吸血鬼/人狼） |
| 錯乱/嫉妬 ・ 生活苦/二重苦 | 各 **6**（＝人数分） | 同上（Doom があれば） |
| **ウィル・オ・ウィスプ** | **12** | **Fate が1枚以上** または **Exorcist(悪魔祓い)** |
| **インプ** | **13** | **Devil's Workshop(悪魔の工房)** または **Tormentor(迫害者)** または **Exorcist** |
| **幽霊** | **6** | **Cemetery(墓地)** または **Exorcist** |
| **願い** | **12** | **Leprechaun(レプラコーン)** または **Secret Cave(秘密の洞窟)** |
| **コウモリ** | **10** | **Vampire(吸血鬼)** |
| **ゾンビ3種**（**廃棄置き場に置く**） | 各 **1** | **Necromancer(ネクロマンサー)** |
| **森の迷子** | **1** | **Fool(愚者)** |
| 家宝（該当するもの） | 各人1枚 | 対応する王国カードがある（§2-3） |

- **枚数は人数によって変わらない**（RB:42-47 の内訳と一致。賞品/戦利品と同じ）。
- ※**墓地(Cemetery) は勝利点の王国カード**なので、その山自体は通常どおり **2人戦8枚／3人以上12枚**
  （箱には12枚入り＝RB:32）。
- **Exorcist は3つの精霊の山を全部要求する**のがポイント（「安い精霊を獲得」なので全種必要）。

### 6-3. 精霊（Spirit）3種

**ウィル・オ・ウィスプ $0\*(12枚)／インプ $2\*(13枚)／幽霊 $4\*(6枚)**（`wiki:Spirit`）。
入手経路は **Exorcist／沼の恵み(→ウィル・オ・ウィスプ)／悪魔の工房・迫害者(→インプ)／呪いの鏡(→幽霊)** のみ。

---

#### ウィル・オ・ウィスプ / Will-o'-Wisp
- **コスト**: $0\*（非サプライ）／**種別**: アクション - 精霊（Action - Spirit）
- **日本語テキスト**
  ```
  +1 カード
  +1 アクション
  あなたのデッキの一番上のカードを公開する。そのカードのコストが2以下なら、それを手札に加える。
  (このカードはサプライには置かない。)
  ```
- **英語原文**: `+1 Card` / `+1 Action` / `Reveal the top card of your deck. If it costs [$2] or less, put it into your hand.` / `(This is not in the Supply.)`
- **公式裁定**
  - RB:656「If the revealed card **does not cost [$2] or less, leave it on your deck**.」
  - RB:660「**Cards with [P] or [D] in the cost (from Alchemy and Empires) do not cost [$2] or less.**」
- **実装注意**: コスト判定は必ず **`costUpTo(state, id, 2)`（§0-23 の成分別述語）**。
  素の `cardCost <= 2` を書くとポーション費用・負債コストを取りこぼす（RB:660 が明文で禁じている）。
  **`reveal()` を通す**（§0-22 のパトロン対応）。**山札が空なら公開できない**（引いた後に判定するので
  +1カードでデッキが空になり得る）。

#### インプ / Imp
- **コスト**: $2\*（非サプライ）／**種別**: アクション - 精霊
- **日本語テキスト**
  ```
  +2 カード
  あなたの場に出ていないアクションカード1枚をあなたの手札から使用してもよい。
  (このカードはサプライには置かない。)
  ```
- **英語原文**: `+2 Cards` / `You may play an Action card from your hand that you don't have a copy of in play.` / `(This is not in the Supply.)`
- **公式裁定**（RB:601-607）
  - "After drawing two cards, you can play an Action card from your hand, **provided that you do not have a copy
    of that card in play**."
  - "**It does not matter if you played the Action card this turn, only that it is not in play** when you play
    Imp; you can use Imp to play a card that you played but **trashed** and so do not have in play, like a Pixie
    you trashed, but **cannot** use it to play a card you did not play this turn that **is still in play**, such
    as a **Secret Cave from your previous turn**."
  - "Imp normally **cannot play an Imp** as that is a card you have in play."
- **実装注意**
  - 判定対象は **`p.inPlay` ＋ `p.durationCards`（前ターンからの持続）**の id 集合。
  - **アクション権を消費しない**（コンクラーベ／伝令官と同型。**+1アクションも付かない**＝
    コンクラーベは付くがインプは付かない。混同しないこと）。
  - **玉座の間などと違い「使用してよい」＝任意**。候補ゼロなら pending を開かない。

#### 幽霊 / Ghost
- **コスト**: $4\*（非サプライ）／**種別**: **夜行 - 持続 - 精霊**（Night - Duration - Spirit）
- **日本語テキスト**
  ```
  アクションカードが公開されるまで、あなたのデッキを上から公開する。公開したアクションカードを脇に置き、残りのカードを捨て札にする。
  ————
  あなたの次のターンの開始時、そのアクションカードを2度使用する。
  (このカードはサプライには置かない。)
  ```
  ※日本語版は区切り線で上下に分かれており、下段の種別欄が「持続-精霊」になっている（jwiki:幽霊）。
- **英語原文**: `Reveal cards from your deck until you reveal an Action. Discard the other cards and set aside the Action. At the start of your next turn, play it twice.` / `(This is not in the Supply.)`
- **公式裁定**（RB:571-582 ＝ `wiki:Ghost` Official FAQ と完全一致）
  - "If you run out of cards before revealing an Action, **shuffle your discard pile but not the revealed cards**,
    and continue. If you still do not find an Action, **just discard everything and do not do anything else**."
  - "If you find an Action card ... play it twice at the start of your next turn. **This is not optional.**"
  - "If you have multiple start-of-turn effects, you can put them in any order, but **when you resolve Ghost, you
    play the Action twice then; you cannot resolve other effects in the middle.**"
  - "You play the Action card, **resolving it completely, then play it a second time**."
  - "**Playing the card does not use up Action plays** for the turn."
  - "**If Ghost plays a Duration card, Ghost will stay out with the Duration card.**"
  - "If Ghost plays **a card that trashes itself**, it will play it a second time even though the card is no
    longer in play."
  - "**If Ghost fails to play a card, it will be discarded from play that turn.**"（＝持続にならない）
  - `wiki:Ghost` その他「If Ghost plays a **Horse**, it will be played the second time **even after it will have
    been returned to its pile**.」
- **実装注意**
  - **★脇に置いたカードは公開情報**（下書きの「所有者のみ可視」は誤り）。
    幽霊は「**公開しながら**掘る」ので、脇に置くカードは**全員が見ている**。
    `maskStateFor` で伏せてはいけない（研究(research)・保存(save)・納骨堂とは違う）。
  - **脇置きカードは物理カード**＝`allCards`・invariants の `ZONES`・終局の `deckCards` に入れる。
  - 2回目は §0-15 の `state.replay` 機構を流用（**玉座の2回目と同じ扱い**）。
    **`state._cmd`（命令）ではない**＝カードは場に出るので「これ」は普通に動く。
  - **2025年エラッタ**：幽霊が場を離れたら（＝ターン終了時に場に無ければ）以後の持続効果は消える。
    ただし「その脇に置いたカードは**デッキの一部として得点計算に数える**」
    （`wiki:2025_Errata`「Yes if you say Throne Room a Gear ... you can end up with set-aside cards that will
    never come back. **They still count as being in your deck at the end of the game.**」）。
  - **山札を全部めくってもアクションが無い**場合＝捨て札をシャッフルして続行、それでも無ければ全部捨て札にして
    幽霊は持続にならずそのターンのクリンナップで捨て札。

### 6-4. 願い / Wish
- **コスト**: $0\*（非サプライ・**12枚**）／**種別**: **アクション**（**精霊ではない**）
- **日本語テキスト**
  ```
  +1 アクション
  このカードを願いの山に戻す。そうした場合、コスト6以下のカード1枚を獲得し、あなたの手札に加える。
  (このカードはサプライには置かない。)
  ```
- **英語原文**: `+1 Action` / `Return this to its pile. If you did, gain a card to your hand costing up to [$6].` / `(This is not in the Supply.)`
- **公式裁定**（RB:673-675）
  - "**You only gain a card if you actually returned Wish to its pile.**"
  - "A card you gain that would normally go somewhere else, like **Nomad Camp** (from Hinterlands), **goes to
    your hand**."
- **入手経路**: レプラコーン（場のカードがちょうど7枚のとき1枚）／魔法のランプ（廃棄して3枚）
- **実装注意**
  - 「山に戻す(return)」は**廃棄でも捨て札でもない**（`returnToPile` 相当）。**交換(exchange)でもない**。
  - **玉座/命令などで場に無いときは戻せない＝獲得もしない**（`removeOne` ガード必須。§0-17 の `takeSelf` と同型）。
    ネクロマンサーで廃棄置き場から使うと戻せない＝獲得なし（`wiki:Necromancer`「Island will fail to move itself
    out of the trash」と同型）。
  - 獲得候補は **`costUpTo(state, id, 6)`**（非サプライ・ロック中の分割山下段・ポーション費用・負債コストを除外）。
  - **獲得先は手札固定**＝**遊牧民の野営地(nomad_camp)の「山札の上に獲得」置換に勝つ**
    （§0-22 の彫刻家と同じ扱い＝`triggerOnGain` の nomad_camp 句の `dest !== 'hand'` 判定に乗る）。

### 6-5. コウモリ / Bat
- **コスト**: $2\*（非サプライ・**10枚**）／**種別**: **夜行**（Night）
- **日本語テキスト**
  ```
  あなたの手札から最大2枚までのカードを廃棄する。
  これにより1枚以上廃棄した場合、このカードを吸血鬼と交換する。
  (このカードはサプライに置かない。)
  ```
- **英語原文**: `Trash up to 2 cards from your hand. If you trashed at least one, exchange this for a Vampire.` / `(This is not in the Supply.)`
- **公式裁定**（RB:557-558）
  - "The Vampire is **put into your discard pile**."
  - "**If there are no Vampires in their pile, you cannot exchange Bat for one, but can still trash cards.**"
- **実装注意**
  - **交換(exchange)＝廃棄でも獲得でもない**（§7-3）。コウモリを**コウモリの山へ戻し**、
    吸血鬼を**サプライから取って捨て札へ**。`triggerOnGain` / `triggerOnTrash` は**発火しない**。
  - **闇市場で吸血鬼を買った場合は戻す山が無いので交換できない**
    （`wiki:Exchange`「The Black Market deck is not considered a pile; so for example if a Traveller, **Vampire**,
    or Hermit is bought using Black Market, there is no pile to return it to and therefore it cannot be exchanged」）。
    ※本プロジェクトの闇市場は「サプライ外から獲得」なので、吸血鬼の山が存在しない局面が実際に起こり得る。
  - 廃棄0枚も合法（そのときは交換しない）。

### 6-6. ゾンビ（Zombie）3種

**共通**：**コスト $3 ／ 種別 アクション - ゾンビ ／ 各1枚のみ ／ 山が存在しない**。
ネクロマンサーがあるとき、**ゲーム開始時に廃棄置き場に置かれる**。

> `wiki:Zombie`「The Zombies are three differently-named Action cards that are used in games with Necromancer.
> **There is only one copy of each. They begin the game in the trash**, allowing Necromancer's ability to play
> cards from the trash to have something to work with.」

#### ゾンビの弟子 / Zombie Apprentice
- **日本語テキスト**: `あなたの手札にあるアクションカード1枚を廃棄して、+3 カード、+1 アクションを得てもよい。`
- **英語原文**: `You may trash an Action card from your hand for +3 Cards and +1 Action.`
- **裁定**: RB:677-678「If you trash an Action card from your hand, you draw three cards and get +1 Action.」
  （＝**廃棄しなければ何も得ない**）

#### ゾンビの石工 / Zombie Mason
- **日本語テキスト**: `あなたのデッキの一番上のカードを廃棄する。そのカードよりコストが最大1多いカード1枚を獲得してもよい。`
- **英語原文**: `Trash the top card of your deck. You may gain a card costing up to [$1] more than it.`
- **裁定**: RB:680-682「**Gaining a card is optional.** You can gain a card costing more than the trashed card,
  **or any amount less**; for example you can gain a copy of the trashed card.」
- **実装注意**: `costUpTo(state, id, trashedCost + 1)` 相当（**成分別**。改良(remake)/改築 と同じ述語を使う）。
  **山札が空なら廃棄も獲得も起きない**（シャッフルはする）。

#### ゾンビの密偵 / Zombie Spy
- **日本語テキスト**
  ```
  +1 カード
  +1 アクション
  あなたのデッキの一番上のカードを見る。そのカードを捨て札にするか元に戻す。
  ```
- **英語原文**: `+1 Card` / `+1 Action` / `Look at the top card of your deck. Discard it or put it back.`
- **裁定**: RB:684「**You draw a card before looking at the top card.**」

#### ゾンビ共通の裁定（ネクロマンサー由来・`wiki:Necromancer` Official FAQ 2021）
- **ネクロマンサーの現行カードテキスト（2021）**：
  `Choose a face up, non-Duration Action card in the trash. Turn it face down for the turn, and play it, leaving it there.`
  `Setup: Put the 3 Zombies into the trash.`
  （※手元 RB の初版テキスト "Play a face up, non-Duration Action card from the trash, leaving it there and
  turning it face down for the turn." は**古い**。2020/2021エラッタ「使用**前**に裏返す」＝無限ループ防止）
- "The played cards are **turned over**, to track that each can only be used **once per turn** this way; **at end
  of turn, turn them back face up**."
- "**The Action card stays in the trash**; if an effect tries to move it, such as Encampment returning to the
  Supply, **it will fail to move it**."
- "Necromancer can be used on a card that trashes itself when played; **if the card checks to see if it was
  trashed (such as Pixie), it was not**, but if the card does not check (such as Tragic Hero), it will function
  normally."
- "**Since the played card is not in play, "while this is in play" abilities (such as Tracker's) will not do
  anything.**"
- その他（`wiki:Necromancer`）
  - "Face-down cards in the trash **can still be interacted with by cards other than Necromancer, such as
    Lurker**, and **you can still look at them if you want to know what they are**."（＝裏向きでも公開情報）
  - "The restriction on movement only applies to effects that would have moved the card out of the play area ...
    **if a card is looking to move a card out of the trash, it may move itself** - thus, if you choose to play a
    **Lurker, Graverobber or Rogue** in the trash, **it can gain itself out of the trash**."
  - "If a face-down card in the trash is gained, and then later trashed in the same turn, **it is returned to the
    trash face-up**, meaning another Necromancer may play it."
  - "**Attempting to trash a card in the trash doesn't count as trashing.** So if you try to trash a Tragic Hero
    in the trash, **you won't gain any VP from Tomb**, and it won't activate Sewers."
  - "**Unlike Band of Misfits, Necromancer can play Command cards from the trash.**"
  - `wiki:Exchange`「**Zombies** ... cannot be involved in an exchange.」（山が無い）

**実装注意**
- ゾンビ3枚は**物理カード**＝`state.trash` に入る＝**保存則 tally に数える**。
  `supply` にキーを作らない・`NON_SUPPLY` でもなく**山そのものが無い**（家宝と同じ立場）。
- **ゲーム開始時に廃棄置き場が空でなくなる**＝**墓暴き(graverobber)／盗賊(rogue)／待ち伏せ(lurker)／
  墓所(tomb・帝国ランドマーク)／下水道(sewers)／青空市場(market_square) との相互作用が初手から発生する**。
  **ゾンビは $3 なので墓暴き($3-6)で普通に獲得できる**（獲得すると山が無いので二度と戻らない）。
- **セットアップの「廃棄置き場に置く」は廃棄ではない**＝`trashCard` を通さず `state.trash.push` する
  （墓所/下水道/青空市場は発火しない）。※RB に明文はなく**一般則からの演繹＝confidence high**。
- 「裏向き」フラグは **trash のカードごとの属性**が要る（`state.trashFaceDown`）。**ターン終了時に全解除**。
  ゾンビは同名1枚ずつなので id ベースで足りるが、**他のアクションが複数枚 trash にある場合は枚数管理が要る**。

---

## 機構7. 夜想曲がゲーム全体ルールに与える変更

### 7-1. 【最重要】祝福・呪詛・状態は「カード」ではない

> **RB:108-110（逐語）**
> "Boons, Hexes, and States are **never in a player's deck**; like Events and Landmarks (from Adventures and
> Empires), **they are physically cards but are not "cards" in game terms**. They are thus never "cards in
> play," **receiving Boons and Hexes or taking a State is not "gaining a card,"** and so on."

**帰結（実装）**
- `allCards` / 保存則 tally / `deckCards`（§0-24 の終局デッキ公開）に**入れない**。
- 「カードを獲得したとき」トリガー（物見やぐら/交易商人/牧羊犬/鷹匠/追跡者/技術革新…）は**一切発火しない**。
- 「場のカード」を数える効果（**レプラコーンの「ちょうど7枚」／魔法のランプ／迫害者／夜襲**）に**数えない**。
- 庭園/品評会/絹の道/壁 などの「所有カード」に**数えない**（jwiki:祝福 §3-2 #13）。
- `state.boons` / `state.hexes` / `p.deluded` / `p.envious` / `p.misery` / `state.lostInTheWoods` /
  `p.boonsInFront` / `p.boonHeld` は**すべて非カードの新ゾーン**。
  §0-19 の `landmarkVP`・§0-22 の `artifacts` と同型。

### 7-2. 夜フェイズの追加（§1 参照）
- **フェイズは4つになる**：Action → Buy → **Night** → Clean-up。
- 「アクションカード」を参照する既存カードは**夜行カードに反応しない**
  （鉄工所/カササギ/暴徒/伝令官/家臣/ゴーレム/玉座の間/習性 など）。**例外は人狼**（アクションでもある）。
- 「購入フェイズか」を見る既存カードは**夜フェイズを購入フェイズと見なさない**
  （ヴィラ/冠/公会堂/列柱/汚された神殿/徴税/闘技場/浴場/行商人…）。
- **ターン開始時の効果はアクションフェイズの一部**（`wiki:Werewolf`）。

### 7-3. 「交換(exchange)」の一般則

> **RB:120-123（逐語）**
> "Nocturne has **three cards** that tell a player to "exchange" a card for another card. The card being
> exchanged is **returned to its Supply pile, or non-Supply pile**, and the card being exchanged for is taken
> and put into the player's **discard pile**. **This does not count as gaining a card.** The exchange only
> happens **if both cards can be exchanged**; **if the pile is empty, the cards are not exchanged**."

該当3枚＝**Changeling(取り替え子) / Vampire(吸血鬼) / Bat(コウモリ)**。

**追加則**（`wiki:Exchange`）
- "Exchanging is **not trashing or gaining**, and so does not trigger abilities like Travelling Fair's."
- "**Unlike gaining, exchanging can happen with a non-Supply pile without special instructions.**"
- "The card being returned as part of the exchange **must have a pile to go back to**. Therefore cards that
  don't have piles of their own anywhere, such as **Shelters, Heirlooms, or Zombies** ... cannot be involved
  in an exchange."
- "**The Black Market deck is not considered a pile**; so for example if a Traveller, **Vampire**, or Hermit is
  bought using Black Market, there is no pile to return it to and therefore it cannot be exchanged."
- RB:228/360（悪魔の工房・修道院）「Normally, bought cards are then gained, but **cards exchanged for (such as
  Vampire exchanging for Bat) are not gained**.」

**実装注意**: **冒険のトラベラー交換（§0-9 Batch5a の `TRAVELLER_NEXT`）がそのまま流用できる**
（獲得でも廃棄でもない・on-gain / on-trash 不発）。**「戻す山が存在するか」のチェックを共通化すること**。

### 7-4. 持続カードの一般則（RB:113-119 ＋ **2025年エラッタ**）

RB（2017年版）の記述に加え、**2025年エラッタで一般則が変わっている**（移動動物園の再版に伴う。§0-26 で既に適用済み）：

> `wiki:2025_Errata`「**If a Duration card leaves play, it stops doing things on future turns.** This also
> applies to Throne Room variants tracking repeated Durations.」
> 「"the card was never in play" is treated just like "it left play."」
> 「**The Duration still does stuff that turn.**」
> 「Yes if you say Throne Room a Gear ... you can end up with set-aside cards that will never come back.
> **They still count as being in your deck at the end of the game.**」
> 「"Take an extra turn" counts as a Duration thing」
> 「**Non-cards aren't affected by this**; Citadel on a Duration does get you two plays of it next turn.」

**夜想曲の持続は7枚**：Ghost / Cobbler / Crypt / Den of Sin / Ghost Town / Guardian / Raider
（＋Secret Cave は アクション-持続）。

### 7-5. 夜想曲の**機能**エラッタは3枚だけ（`wiki:All_Errata` Nocturne 節・逐語）

> - **Crypt** — Cannot set aside **Duration** cards (**2022**).
> - **Necromancer** — Turn the card **face down before playing it** (**2020**).
> - **Tracker** — **(No dividing line.)** Active this turn instead of while in play (**2022**).

**＝夜フェイズ／家宝／祝福／呪詛／状態／精霊／願い／コウモリ／ゾンビ の機構ルール自体には機能エラッタは無い**
（2017年 RB の記述がそのまま現行）。
**別途、2021年印刷で文面だけが短縮された**（家宝7枚 ＋ 沼の恵み。§0 の罠③・§2-3）。

### 7-6. 闇市場（Black Market）とセットアップ

> `wiki:Black_Market`「**Any setup instructions or "in games using this" rules that apply to cards in the Black
> Market deck are in effect, even if nobody ever gains (or even reveals) the relevant cards.** For example, if
> Young Witch is in the Black Market deck, you add a Bane, and if Charlatan is there, Curses are Treasures for
> the whole game.」

＝闇市場デッキに Fate/Doom/家宝つき/Necromancer/Fool/Vampire 等が入っているだけで、
**祝福デッキ・呪詛デッキ・各種非サプライ山・家宝の置換・ゾンビの廃棄置き場配置がすべて発動する**のが公式。

**実装の逃げ道（推奨）**：同じ wiki ページが
> "It is **not necessary to include every unused Kingdom card**; you may decide how many cards to include in the
> Black Market deck, and which ones, in any way."
> "**Dominion Online** creates a deck of up to 60 cards. **It does not include cards with an obvious setup that
> would give away what's in the Black Market deck, such as Joust or Baker.**"

と明記している。したがって **闇市場デッキの母集団から「セットアップを持つ夜想曲のカード」を除外するのは
簡略化ではなく公式が認めた運用**（Dominion Online と同じ）。本プロジェクトはこちらを採るのが安全。
除外対象＝**Fate 8種／Doom 6種／家宝を持つ7種／Necromancer／Fool／Vampire／Devil's Workshop／
Tormentor／Exorcist／Cemetery／Leprechaun／Secret Cave**（実質、夜想曲の王国33種のほとんど）。
※採用したら **PROGRESS に「公式が認める運用（Dominion Online 準拠）」として明記**すること。

---

## 機構8. 新ゾーン／新フィールド一覧

| フィールド | カード? | 公開? | 保存則 tally |
|---|---|---|---|
| `state.boons = {deck, discard, druid}` | ✗ | **deck=完全に秘密 / discard=一番上だけ公開 / druid=公開** | 数えない |
| `state.hexes = {deck, discard}` | ✗ | **deck=完全に秘密 / discard=一番上だけ公開** | 数えない |
| `p.boonsInFront[]`（田畑/森/川の恵み） | ✗ | 公開 | 数えない |
| `p.boonHeld`（恵みの村の保留） | ✗ | 公開 | 数えない |
| `p.deluded` / `p.envious`（排他） | ✗ | 公開 | 数えない |
| `p.misery ∈ {0,1,2}` | ✗ | 公開 | 数えない |
| `state.lostInTheWoods = seat\|null` | ✗ | 公開 | 数えない |
| `t.cantBuyActions` / `t.enviousActive` | ✗ | 公開 | — |
| `t.currentHex`（配布中の呪詛id） | ✗ | 公開 | — |
| **`p.ghostSetAside`（幽霊の脇札）** | **✓** | **公開**（掘るときに公開済み） | **数える** |
| **`p.cryptSetAside`（納骨堂の脇札）** | **✓** | **所有者のみ**（RB:206-207「face-down; you can look at them at any time, but **other players may not**」） | **数える** |
| `state.trashFaceDown`（ネクロマンサー） | — | 公開（wiki:見てよい） | — |
| 家宝（開始デッキ内） | **✓** | 通常 | **数える** |
| ゾンビ3枚（廃棄置き場） | **✓** | 公開 | **数える** |

---

## 機構9. 実装チェックリスト

### 9-1. 非サプライ山＝`NON_SUPPLY` に登録し**4系統から除外**（§6 の必須チェックリスト）

`will_o_wisp`(12) / `imp`(13) / `ghost`(6) / `wish`(12) / `bat`(10)
→ **(1) `emptyPileCount`（3山終了） (2) `canBuyCard` (3) 闇市場デッキの母集団
(4) 汎用獲得（engine の `gainableBase`/`costUpTo`/`costUnder`/`costExact` と CPU の `bestGain`/`bestGainExact`
と UI モーダルの filter）** の**すべて**から除外。
**engine を締める修正と CPU を締める修正は必ず同一コミット**（§0-23 の教訓＝engine だけ締めると本番 livelock）。

**家宝7種とゾンビ3種は「山そのものが無い」**＝`NON_SUPPLY` ともさらに違う扱い
（上記4系統 ＋ **交換の対象外** ＋ `initSupply` にキーを作らない）。

### 9-2. 新 pending は必ず4点セット（engine reducer＋`PLAYER_ACTIONS`＋CPU `decidePending`＋UI `viewPendingModal`）＋終端保証

この機構ぶんで最低限必要になる pending：
- **祝福**：大地の恵み(財宝を捨てて獲得)／炎の恵み(廃棄)／月の恵み(捨て札から山札上へ)／空の恵み(3枚捨て)／
  太陽の恵み(上4枚を捨て/戻す)／風の恵み(2枚捨て・強制)／**ドルイドの3択**／**愚者の3枚を任意順**／
  **恵みの村の「今か次のターンか」**
- **呪詛**：凶兆(銅貨2枚を選ぶ)／恐怖(アクションor財宝1枚を捨てる)／憑依(手札1枚を山札上へ)／
  貧困(`discard_down` 3枚)／蝗害(獲得先の選択)
- **状態**：森の迷子(ターン開始時に手札1枚を捨てるか)
- **非サプライ**：幽霊の脇札プレイ(**強制・2回**)／コウモリの廃棄(0〜2枚)／願いの獲得($6以下・手札へ)／
  ゾンビの弟子(アクション廃棄・任意)／ゾンビの石工(獲得・任意)／ゾンビの密偵(捨てるか戻すか)／
  インプ(手札のアクション1枚・任意)／ウィル・オ・ウィスプ(自動)

**CPU は `null` を返さないこと**（§0-26：オンラインで `reduce(state, null)` が TypeError → 部屋が固まる）。
候補ゼロでも `{type:'X', card:null}` を返し、**engine 側に「候補ゼロなら窓を閉じる」終端保証**を書く。

### 9-3. このエンジン固有の落とし穴（**先引き**）

このエンジンは**自分の手番終了時に次の手札を先引きする**（§0-22 の最重要事項）。したがって：
- **川の恵み「このターンの終了時 +1カード」＝先引きの後**（RB:794 が明文）。
  §0-25 のリス、§0-21 の保存(save) と**同じ場所**。
- **忠犬(Faithful Hound)「ターン終了時に手札に戻す」も先引きの後**
  （RB:276「**"End of turn" is after drawing in Clean-up.**」）。
- **クリンナップで `p.boonsInFront` を祝福の捨て札へ戻す**のを忘れない（RB:139-140）。
- **夜フェイズはクリンナップ（＝先引き）より前**。`END_TURN` の入口を night からに変えるとき、
  既存の `endBuyTail` / `endBuyTailSchemeOrCleanup` / `t.cleanupWaiting`（§0-22）の並びを崩さないこと。

### 9-4. 既存の横断ヘルパを必ず通す
- **`addCoins(state,n)` / `addActions(t,n)`**（§0-25：雪深い村・カメレオン）。直書き禁止。
- **`reveal(state, seat, cards, note)`**（§0-22：パトロン）。ウィル・オ・ウィスプ／幽霊／凶兆／飢饉／
  恐怖／戦争／羊飼い は**公開**なので通すこと。
- **`isTreasureFor(state,id)`**（§0-22：資本主義）。大地の恵み・恐怖・納骨堂 の「財宝」判定はこれ。
- **`costUpTo` / `costUnder` / `costExact` / `sameCost` / `gainableBase`**（§0-23）。
  ウィル・オ・ウィスプ($2以下)／願い($6以下)／ゾンビの石工(+$1)／蝗害(より安い)／大地の恵み($4以下)。
- **`trashCard(state, owner, card)`**（§0-8）。炎の恵み／ヤギ／コウモリ／蝗害／戦争／ゾンビの弟子・石工。
- **`triggerOnDiscard`**（§0-5）。祝福/呪詛の捨てもトンネル/忠犬/村有緑地を誘発する。
- **`DOM.engine.allCards`**（§0-26）。新ゾーン `ghostSetAside` / `cryptSetAside` を足したら自動追従する。

### 9-5. 財宝を出す順（§0-24 `playAllOrder`）
- **呪われた金貨は「出すと呪いを獲得する」**＝`PLAY_ALL_TREASURES`（財宝を全部出す）が
  **勝手に出してよいか**を決める必要がある。**推奨＝`playAllOrder` から除外し、単独タップでのみ出せる**
  （魔法のランプ／幸運のコイン／ヤギ／呪いの鏡 も「出す順で結果が変わる」＝魔法のランプは
  「ちょうど1枚のカードが6種」を作るために**銅貨1枚を先に出す**必要がある。RB/wiki が明示している技法）。
- **嫉妬(Envious)** がある turn は財宝の価値が変わる＝CPU の購入見積りに反映する。

---

## 機構10. 未確定事項（confidence を明示）

1. **「他のプレイヤーは各自、次の呪詛を受ける」で、全員が免疫のとき呪詛をめくるか**
   — jwiki:呪詛 は「**めくる**」と明記（「堀や灯台などによって呪詛の影響を受けるプレイヤーが居ない場合でも、
   カードの指示があれば呪詛を1枚めくる」）。**RGG ルールブックにも英語wikiにも明文が無い**。
   **confidence: medium**。影響は**呪詛デッキの順序と枯渇タイミングだけ**（勝敗には直結しない）。
   → **jwiki に従って「めくって捨てる」で実装し、PROGRESS に根拠と confidence を明記する**のを推奨。

2. **呪詛の解決順序**（手番プレイヤーの左隣から時計回り）
   — RB にも `wiki:Hex` にも呪詛について明記が無い。**ドミニオンのアタック一般則からの演繹**。
   **confidence: medium-high**。疫病（呪い枯渇）・蝗害（獲得競合）で結果が変わり得る。
   本プロジェクトの既存アタックは全部この順なので**それに揃える**。

3. **セットアップでゾンビを廃棄置き場に置くのは「廃棄」ではない**
   — 明文が無い。一般則からの演繹。**confidence: high**。
   （墓所(Tomb)・下水道(Sewers)・青空市場(Market Square) が発火しない）

4. **祝福/呪詛の山と捨て札のマスク仕様**
   — jwiki が「**捨て札は一番上のみ公開**」を明記しており、これは実装可能な明確ルール。
   ただし RGG ルールブックには記載が無い。**confidence: high（jwiki の明文＋ Dominion Online の実装と整合）**。
   ※`wiki:Boon` / `wiki:Hex` の Strategy 節が「めくられた祝福/呪詛を**記憶で**追跡する」ことを推奨しており、
   「捨て札を見返せる」なら記憶する必要がないので、この読みと整合する。

5. **呪いの鏡：幽霊の山が空のとき、アクションカードを捨てるか**
   — "you may discard an Action card, **to gain** a Ghost" の条件節。**捨てても無駄なので捨てない**
   （＝そもそもこの任意効果を選べない）と解するのが自然。明文なし。**confidence: medium**。
   実装は「幽霊の山が空なら pending を開かない」で安全側。

6. **錯乱：wiki の1文に文言の揺れがある**
   — `wiki:Deluded`「You also won't be able to **buy cards** during a second Buy phase on the same turn.」
   逐語では "cards" だが、カード文が "you can't buy **Actions** this turn" である以上、
   **正しくは「アクションカードのみ購入不可」**。**wiki の省略表記とみるのが妥当（confidence: high）**。

7. **夜フェイズの「開始時」トリガー**
   — 夜想曲内には存在しないことを確認した。後続拡張（同盟・略奪・日の出づる国）に
   「夜フェイズの開始時」を参照するカードがあるかは未調査。本プロジェクトの実装順では問題にならない。

8. **牧草地の区切り線の有無**
   — jwiki の表示構造から「区切り線あり（上＝+1コイン／下＝可変VP）」と判断した。
   実カード画像で直接確認したわけではない。**confidence: medium-high**（財宝-勝利点の複合＝ハーレム型と同様）。
   **表示上の問題だけで挙動に影響しない**。

9. **日本語名の裏取り**
   — 日本語名はすべて **jwiki（ホビージャパン印刷版準拠）** に依拠している。§0（命名セクション）の結論
   （**英語wiki の Japanese 行を信用しない**）に従った。HJ 印刷版カードの実物スキャンによる照合はしていない。

---

## 機構11. 下書き（第1版）からの訂正 全13件

| # | 重大度 | 訂正 |
|---|---|---|
| 1 | **high** | **夜行カードは「14種」ではなく15種**（下書きの表自体は15行あった＝見出しの数え間違い）。`wiki:Night` のリストとギャラリー数で二重確認。 |
| 2 | **high** | **家宝7枚の英語テキストが2017年初版のまま**だった。現行(2021年印刷)は「When you play this,」と「from its/their pile」が削られ、魔法のランプには「(counting this)」が追加され "If you do"→"If you did" になっている。**沼の恵みも同じ**。**機能不変**だが「逐語・現行」を謳う以上は誤り。あわせて**下書きが1枚も書いていなかった家宝の日本語テキストを全件補った**。 |
| 3 | **high** | **幽霊(Ghost)の脇札を「所有者のみ可視」としていたのは誤り＝公開情報**。幽霊は「**公開しながら**」掘るので全員が見ている（研究/保存とは違う）。※納骨堂(Crypt)の脇札が伏せなのは RB:206-207 で正しい。 |
| 4 | **high** | **祝福/呪詛の捨て札は「全部公開」ではなく「一番上だけ公開」**。jwiki:祝福「一番上のみが公開情報であり、それ以外を見てはならない」／jwiki:呪詛「一番上以外見てはならない」。下書きはこれを未確定事項に挙げたまま「捨て札は公開」と実装指示していた。 |
| 5 | **medium** | **錯乱/嫉妬の「返す」判定を1ターン1回にしてはいけない**。下書きは「ヴィラで戻って再突入しても解除しない」とだけ書いていたが、**購入フェイズ中に錯乱/嫉妬を得た場合はその購入フェイズでは返さず、同じターンでもヴィラ等で再突入した「次の購入フェイズ開始時」に返して発動する**（jwiki:呪詛 の明示例）。`END_ACTION_PHASE` は毎回 `p.deluded`/`p.envious` を見ること。 |
| 6 | **medium** | **呪詛の配布手順が不足**。(a)**リアクション（堀等）は呪詛をめくる前に全部解決する**、(b)**全員が免疫でも1枚めくる**（jwiki 明文・confidence medium）。下書きは「被害者ループの外で1回だけ決める」までしか書いていなかった。 |
| 7 | **medium** | **RB PDF が2017年第1版であることを見落としていた**。`wiki:Necromancer` の Versions 表で確定（現行は "Choose a face up ... Turn it face down for the turn, and play it, leaving it there."）。下書きは RB のカード画像テキストを現行として引用していた＝訂正2の根本原因。 |
| 8 | **low** | **空の恵み／風の恵みの複数枚捨ては「同時」**（jwiki）。1枚ずつ捨てて坑道→望楼と連鎖することはできない。本プロジェクトの `triggerOnDiscard` 実装に直結するのに欠落していた。 |
| 9 | **low** | **風の恵みは強制**（引けた枚数に関わらず2枚捨てる）／**月の恵みは「見る」が強制で「置く」が任意**。欠落。 |
| 10 | **low** | **戦争(War)は山札を使い切ったら捨て札をシャッフルして公開を続ける**。下書きは「見つからなければ全部捨て札・廃棄なし」の結末しか書かず、途中のリシャッフルを落としていた。 |
| 11 | **low** | **保持中の祝福は (a) 山の作り直しに入らない (b) ゲーム終了時の所有カードに数えない**（jwiki 明文）。欠落。 |
| 12 | **low** | **凶兆(Bad Omens)で銅貨が1枚しかない場合、その1枚は山札の上に置いたうえで捨て札を公開する**（「可能な限り実行する」の一般則。jwiki が公式ルルブ照会で確認）。下書きは「公開するだけ」と読める書き方だった。 |
| 13 | **low** | **闇市場のセットアップ規則を「実装しないなら許容簡略化」としていたのは弱い**。`wiki:Black_Market` は「闇市場デッキに入れるカードは任意に決めてよい」「Dominion Online は**セットアップが露骨なカードを最初から入れない**」と明記している＝**除外は公式が認めた運用**。簡略化ではなく設計判断として書ける。 |

**棄却（下書きが正しかったので直さなかったもの）**：夜フェイズの3行ルール／家宝の置換とコスト($0/$0/$2/$2/$2/$4/$4)と
呪われた金貨の +$3／祝福12・呪詛12・状態5の日本語名と文面／非サプライ山の枚数(12/13/6/12/10)と全セットアップ条件／
「呪詛は1枚だけめくって全員に適用」／状態の枚数（錯乱/嫉妬・生活苦/二重苦は人数分、森の迷子は1枚）／
ドルイドの「残り9枚」／交換の一般則3枚／夜想曲の機能エラッタは3枚だけ／
ゾンビ3枚のコスト$3・種別・「山が無い」／願いは精霊ではない／Werewolf の全裁定と習性の可否／
川の恵みと忠犬が「先引きの後」であること。

---

# パート2：王国カード A群（詩人〜ドルイド）

## 夜想曲（Nocturne）A群＝王国カード11種

**この節の正本**（すべて本セッションで実際に開いて逐語確認した一次資料）

| # | 資料 | 使い方 |
|---|---|---|
| 1 | **RGG 公式ルールブック（英語・実DL）** `scratchpad/nocturne_rulebook.txt`（pdftotext・909行） | 準備 L60〜L76／全体ルール L78〜L124／カード個別解説 L143〜L246。**⚠️ コイン記号($)とVP記号が全滅**しているので数値は一切採用しない |
| 2 | **英語wiki**（Wayback経由・本セッションで再取得。`adv/p_*.txt`） | 記号が `[$4]` `[2 VP]` に復元済み＝**数値の正本**。Card text／Official FAQ／Other rules clarifications／English versions（初版 vs 2021年版）／Other language versions |
| 3 | **日本語wiki**（wikiwiki.jp/dominiondeck・`jpA_*.txt`） | **日本語版（ホビージャパン）印刷カードの実文面の正本**。表の下段＋「詳細なルール」節に公式裁定が大量にある |
| 4 | **ホビージャパン公式**（`jp_https___hobbyjapan_games_dominion_nocturne_.txt`） | 種別の日本語公式名／《ドルイド》の正誤表／日本語版発売日 |
| 5 | **英語wiki `Errata`（All_Errata）** 最終更新 **2026-06-12** | エラッタの網羅確認 |

> **⚠️ 罠1：英語wikiの `List of cards in other languages` ページの Japanese 列は、夜想曲では日本語版の公式名と一致しない。**
> 実際に比較した（本セッション）：ドルイド→「巫女」／ピクシー→「小妖精」／ゴーストタウン→「幽霊街」／レプラコーン→「家事の妖精」／秘密の洞窟→「秘密の洞穴」／詩人→「歌人」。
> **カード名は必ず各カードの個別ページの Other language versions か日本語wikiで裏取りすること。**
>
> **⚠️ 罠2：英語wikiの各カードページの Japanese 列は「Shuffle iT（Dominion Online）日本語訳」であることが多く、HJ の印刷カードとは別訳。**
> 例：墓地＝英語wiki「これを獲得するとき、手札から4枚以下のカードを廃棄する。」／HJ印刷「このカードを獲得したとき、あなたの手札から最大4枚までのカードを廃棄する。」
> **本ドキュメントの「日本語カードテキスト」は HJ印刷（日本語wiki）を採用**し、差異があれば併記した。

---

## 0. A群に共通する前提（実装の土台）

### 0-1. 種別の日本語公式名（ホビージャパン公式サイト本文の逐語）

> 「購入フェイズが終わったあとにプレイできる**夜行**カード、初期デッキの銅貨と入れ替えて使用する**家宝**カード、**祝福**と**呪詛**をもたらす**幸運**カードと**不運**カードーー」

| English | 日本語公式 | 裏取り |
|---|---|---|
| Night | **夜行** | HJ公式／日本語wiki（取り替え子・カブラー・納骨堂・悪人のアジト・悪魔の工房 の種別行が「夜行」） |
| Duration | **持続** | 日本語wiki（既存の海辺と同じ） |
| Fate | **幸運** | HJ公式／日本語wiki「アクション-幸運」／**HJ正誤表「《ドルイド》「アクション – 幸運」のテキストが欠落しています。」** |
| Doom | **不運** | HJ公式／日本語wiki「アクション-不運」（呪われた村） |
| Heirloom | **家宝** | HJ公式／日本語wiki（墓地の下段「(家宝: 呪いの鏡)」） |
| Spirit | **精霊** | 日本語wiki（インプ＝「アクション-精霊」） |
| Boon / Hex | **祝福 / 呪詛** | HJ公式／英語wiki Boon「Japanese: 祝福」 |

> **依頼文が候補として挙げていた「夜／運命／災い(呪縛)」はすべて誤り。上表が公式。**

### 0-2. 夜フェイズ（rulebook L78-80 逐語）

> "Nocturne adds Night cards and the Night phase. In games using Night cards, the Night phase happens after the Buy phase - it goes, **Action, Buy, Night, Clean-up**. In your Night phase, you can play **any number** of Night cards."

- フェイズ順＝**アクション → 購入 → 夜 → 片付け**。夜行カードは**何枚でも**使用でき、**アクション権とは無関係**（別枠。ターミナルにならない）。
- 英語wiki `Night` の Overview 逐語：
  > "In general, **there is no way to multiply a Night card with a Throne Room variant** (the exception being calling Royal Carriage on Werewolf)."
  > "Cards that care about specific phases (e.g., Villa) will not have their usual effects in the Night phase. **Haunted Woods is particularly brutal, as it prevents you from playing any of your Night cards if you buy anything.**"

### 0-3. 幸運/祝福（rulebook L85-91 逐語）

> "Fate cards can somehow give players Boons; **all the Fate type means is that the Boons are shuffled at the start of the game.** ... The phrase "receive a Boon" means, turn over the top Boon, and follow the instructions on it. **If the Boons deck is empty, first shuffle the discarded Boons to reform the deck**; you may also do this any time all Boons are in their discard pile. Received Boons normally go to the Boons discard pile, but **three (The Field's Gift, The Forest's Gift, and The River's Gift) go in front of a player until that turn's Clean-up.**"

英語wiki `Boon` の Other rules clarifications 逐語（終端保証の根拠）：
> "In the unlikely event that all the Boons are set aside or otherwise occupied at the same time, so there are no Boons in the Boons deck or discard pile when you are told to receive a Boon, **you don't receive one.**"

### 0-4. 不運/呪詛（rulebook L93-99 逐語）

> "Doom cards can somehow give players Hexes; all the Doom type means is that the Hexes are shuffled at the start of the game. ... "Each other player receives the next Hex" means, turn over just one Hex, and the other players all follow the instructions on that same Hex. If all Hexes have been used, shuffle the discards to reform the deck. **Received Hexes always go to the Hexes discard pile.**"

### 0-5. 準備（rulebook L60-76 逐語・A群に関係する行）

> "If any Kingdom cards being used have a yellow banner indicating an Heirloom, players start the game with **that Heirloom replacing what would normally be a Copper.**"
> "If any Kingdom cards being used have the **Fate** type, shuffle the Boons and put them near the Supply, and **put the Will-o'-Wisp pile near the Supply also.** If any have the **Doom** type, shuffle the Hexes and put them near the Supply, and put **Deluded/Envious** and **Miserable/Twice Miserable** near the Supply also."
> "**If Druid is being used, deal three Boon cards face up for use with it.** ... **If Devil's Workshop or Tormentor are being used, put the Imp pile near the Supply; if Cemetery is being used, put the Ghost pile near the Supply**"

**非サプライ山の枚数（rulebook 内容物 L36-47 逐語）**：`12 Boons` / `12 Hexes` / `13 of Imp` / `12 each of Will-o'-Wisp, Wish` / `6 each of Ghost, Deluded/Envious, Miserable/Twice Miserable` / 家宝は `6 each`（＝最大人数分）。

### 0-6. 祝福・呪詛・状態は「カード」ではない（rulebook L108-110 逐語）

> "Boons, Hexes, and States are never in a player's deck; like Events and Landmarks, they are physically cards but **are not "cards" in game terms.** They are thus never "cards in play," receiving Boons and Hexes or taking a State **is not "gaining a card,"** and so on."

→ **本アプリの保存則 tally（invariants の `ZONES`）に入れない**（`state.pileVP` / `p.villagers` / `state.artifacts` と同型の非カード）。

### 0-7. 「交換（exchange）」の一般ルール（rulebook L120-123 逐語）＝取り替え子で必須

> "Nocturne has three cards that tell a player to "exchange" a card for another card. The card being exchanged is **returned to its Supply pile, or non-Supply pile**, and the card being exchanged for is taken and **put into the player's discard pile. This does not count as gaining a card.** The exchange only happens if **both** cards can be exchanged; **if the pile is empty, the cards are not exchanged.**"

英語wiki `Exchange` の Other rules clarifications 逐語：
> "Unlike gaining, **exchanging can happen with a non-Supply pile without special instructions.**"
> "The card being returned as part of the exchange **must have a pile to go back to.** Therefore cards that don't have piles of their own anywhere, such as **Shelters, Heirlooms, or Zombies**, cannot be involved in an exchange."
> "**The Black Market deck is not considered a pile**; so for example if a Traveller, Vampire, or Hermit is bought using Black Market, there is no pile to return it to and therefore it cannot be exchanged."

### 0-8. A群に効くエラッタ（`Errata`（All_Errata）最終更新 2026-06-12 の Nocturne 節・**全文**）

> "Nocturne / **Crypt** — Cannot set aside Duration cards (**2022**). / Necromancer — Turn the card face down before playing it (2020). / Tracker — (No dividing line.) Active this turn instead of while in play (2022)."

→ **A群11種のうち機能エラッタは納骨堂(Crypt)の1枚だけ。** 悪魔の工房と呪いの鏡は2021年印刷で "from its pile" が落ちた**表記のみ**の変更（`Errata` に載っていない＝機能差ゼロ。英語wikiの English versions 表で 2017年版／2021年版の両方を確認済み）。

**A群に効く一般ルールのエラッタ（同ページ Rules 節・逐語）**
> "**Durations** — No longer have any effect on future turns if the card has left play (**2025**). A Duration card played extra times by a Throne Room variant that has left play is only multiplied for the remainder of the turn it was played, not during future turns."
> "**Playing cards** — An effect that tries to play a card for the first time can only do so **when the card is where the effect expects it to be** (2021)."
> "**Stop-moving** — ... **Gained cards are expected to be where they were gained to, even if this isn't the discard pile.** Cards in discard piles can be moved even if covered up by other cards; cards on top of a deck can't be moved once covered up. (2019)"

日本語wiki 納骨堂の2025年ルール逐語（本アプリの得点計算に直結）：
> 「※結果として、1枚のカードが脇に置かれ続けるが、これは『プレイヤーAのカード』であり続ける。（例えば、得点計算時に『プレイヤーAのカード』を数える場合に、この脇に置かれ続けるカードもカウントする。）」

---

## 1. Bard ／ 詩人

| 項目 | 内容 |
|---|---|
| 英語名 | **Bard** |
| 日本語公式名 | **詩人** |
| コスト | **$4** |
| 種別 | **Action - Fate ／ アクション・幸運** |
| 仕切り線 | なし |

**日本語カードテキスト（本アプリ書式）**
```
+2 コイン
祝福を1つ受ける。
```
*日本語wiki の日本語版カード実文面＝「+2 コイン／祝福を1つ受ける。」と逐語一致。*

**英語原文（逐語・現行＝2017年から不変）**
> `+$2`
> `Receive a Boon.`

**公式裁定**
- Official FAQ（rulebook L145／英語wiki）逐語：`"You get +[$2] and receive a Boon."`
- **Other rules clarifications は存在しない**（英語wiki 2025-09-10版の目次に節が無い）＝A群でいちばん単純な幸運カード。

**実装注意**
- 実質ターミナルシルバー＋祝福1。**詩人固有の pending は不要**だが、祝福そのものが対話を伴う（大地の恵み＝手札1枚廃棄、海の恵み＝銀貨獲得、空の恵み＝3枚捨てて金貨、太陽の恵み＝山札上4枚 …）。
- **共通ヘルパ `receiveBoon(state, pi)` を1本作る**こと。同じ入口を使うのは**幸運カード8枚**＝詩人／恵みの村／ドルイド／愚者／ピクシー／追跡者／偶像／聖なる木立ち。
- 祝福デッキが空なら**引く直前に捨て札をシャッフルして再形成**。**祝福が1枚も無い（全部が脇に置かれている）なら受けない**（§0-3 の逐語）＝**終端保証として必ず書く**。ドルイドが3枚抜くので通常は9枚が回るが、書かないと理論上 pending が閉じない。

---

## 2. Blessed Village ／ 恵みの村

| 項目 | 内容 |
|---|---|
| 英語名 | **Blessed Village** |
| 日本語公式名 | **恵みの村** |
| コスト | **$4** |
| 種別 | **Action - Fate ／ アクション・幸運** |
| 仕切り線 | **あり** |

**日本語カードテキスト（本アプリ書式）**
```
+1 カード
+2 アクション
————
このカードを獲得するとき、祝福を1つ取り、それを今か次のあなたのターンの開始時に受ける。
```
*日本語wiki（HJ印刷）と逐語一致。※英語wikiの日本語欄（Shuffle iT訳）は「これを獲得するとき、祝福を1つ得る。その祝福を直ちに受けるか、あなたの次のターンの開始時に受けるか選ぶ。」＝別訳。*

**英語原文（逐語・現行）**
> `+1 Card`
> `+2 Actions`
> `When you gain this, take a Boon. Receive it now or at the start of your next turn.`

**公式裁定（Official FAQ・rulebook L147-149 逐語）**
> "**You see the Boon before deciding** to resolve it immediately or at the start of your next turn. If you save it for next turn, **it sits in front of you until then** (or until the end of that turn if it says to keep it out until Clean-up)."

**Other rules clarifications（英語wiki 2025年版・逐語）**
> "If you gain this onto your deck (with e.g. Armory) and receive The Sea's Gift, cards like **Gatekeeper will lose track of Blessed Village**."
> "When you are looking at cards from the top of your deck (with e.g. The Sun's Gift), **that counts as moving them.** So if you gain this onto your deck and then receive The Sun's Gift, that will cause Gatekeeper to lose track (even if you leave Blessed Village on top of your deck)."
> "If you gain a Blessed Village, discard a Blessed Village from Exile, and receive The Moon's Gift, and topdeck the Blessed Village you just discarded, then **Changeling and Gatekeeper can still move the Blessed Village you just gained**."

**追加裁定（日本語wiki「詳細なルール」逐語）**
> 「次ターンに祝福を受けることを選択した場合、その祝福は次ターンまでに手元に保持しておく。」
> 「**次のターンが来るまでに祝福の山札が切れ、シャッフルが入った場合には手元に保持した祝福は新しい山札に入らない。**」
> 「**この方法で複数の祝福を保持した場合、次のターン開始時に受ける順番は自由に選んでよい。**」
> 「**保持した祝福は場のカードとして扱われない。**」
> 「保持した祝福を受けるのは、『ターンの開始時』にあたる。」

**実装注意**
- **"take"（取る）であって "receive"（受ける）ではない**＝獲得時に祝福デッキの一番上を**1枚抜き取り、中身を見せてから**「今受ける／次の自分のターン開始時に受ける」の2択 pending（`blessed_village_boon`）を出す。**先に見せること**（公式が明記）。
- 保存を選んだ祝福は**そのプレイヤーの前に置かれたまま**＝新スロット **`p.savedBoons`（配列・非カード・公開でよい）**。次の自分のターン開始時に `t.startQueue` へ積む（`resolveDurationStartEffects` の枠組みを流用）。
  - **保存中の祝福は祝福デッキの再形成に混ぜない**（上の日本語wiki逐語）。
  - **複数保持していたら受ける順番を選べる**が、`startQueue` は先入れ順＝**既存の許容簡略化（§0-26）と同じ扱いでよい**（PROGRESS に記録）。
- 「片付けまで手元に置く」系（田畑／森／川の恵み）を保存して受けた場合は、**受けたターンの片付けまで**手元に残る。
- **獲得時の対話が他と競合する**（望楼／そり／鷹匠／追放の払い戻し／墓地／呪われた村…）→ §0-26 の教訓どおり **`state.onGainQueue` に積む**（else-if 連鎖に足さない）。
- 上の3つの lose-track 裁定は「獲得直後に山札の上を動かす／見る」と追跡が切れる一般則の具体例。本アプリは**門番(gatekeeper)・取り替え子（本拡張）を実装済み／実装予定なので実際に到達し得る**。

---

## 3. Cemetery ／ 墓地

| 項目 | 内容 |
|---|---|
| 英語名 | **Cemetery** |
| 日本語公式名 | **墓地** |
| コスト | **$4** |
| 種別 | **Victory ／ 勝利点**（アクションではない） |
| VP | **2 勝利点**（固定） |
| 家宝 | **Haunted Mirror ／ 呪いの鏡** |
| 仕切り線 | **あり** |

**日本語カードテキスト（本アプリ書式）**
```
2 勝利点
————
このカードを獲得したとき、あなたの手札から最大4枚までのカードを廃棄する。
（家宝: 呪いの鏡）
```
*日本語wiki（HJ印刷）と逐語一致（「(家宝: 呪いの鏡)」まで含む）。書式は既存の `farmland`（`2 勝利点\n…`）／`overgrown_estate`（`0 勝利点\n————\n…`）に合わせた。*

**英語原文（逐語・現行）**
> `2 VP`
> `When you gain this, trash up to 4 cards from your hand.`
> `Heirloom: Haunted Mirror`

**公式裁定（Official FAQ・rulebook L161-163 逐語）**
> "In games using this, **replace one of your starting Coppers with a Haunted Mirror.** When you gain a Cemetery, **trash from zero to four cards** from your hand."

**Other rules clarifications は存在しない**（英語wiki 2023年版の目次に節が無い／`Errata` にも墓地の項は無い）。

**追加裁定（日本語wiki「詳細なルール」逐語）**
> 「ゲームの準備で、**サプライに用意される墓地の枚数は「2人で遊ぶ場合は8枚、3人以上で遊ぶ場合は12枚」**である。」
> 「獲得時、手札から4枚以下のカードを廃棄できる。**0枚、つまり廃棄しなくてもよい。**」
> 「職人、カブラー、願いなどによって**手札に獲得した場合、その墓地自体も廃棄することができる**。獲得時効果を解決するとき墓地はすでに獲得先に移動している。」
> 「**手札から廃棄するカードを選び、全て(1枚ずつではなく)同時に廃棄置き場に置く。** その後、カードの廃棄に誘発する効果があれば処理する。**墓地でまず手札からネズミ1枚を廃棄→ネズミの廃棄時効果で+1カード→引いたカードを同じ墓地の効果で廃棄する、という動きはできない。**」
> 「鉄工所や馬丁で墓地を獲得した場合、**追加効果で1ドローする前に廃棄を行う**。」
> 「墓地を使用するゲーム開始時に、初期デッキの銅貨1枚を呪いの鏡に入れ替える。**入れ替えた銅貨は、サプライの山札に戻す。**」
> 「墓地の廃棄効果と呪いの森のアタック効果はどちらも獲得時効果であるため、**墓地の獲得者が好きな順番で処理できる**。」

**実装注意**
- **⚠️ 山の枚数は「常に12枚」ではない。** 箱の実物が12枚（rulebook 内容物 L32 逐語 `"12 of Cemetery"`）というだけで、**サプライは勝利点カードの一般則＝2人戦8枚／3人以上12枚**。
  英語wiki `Victory card` 逐語：`"Victory card piles in the supply start with 8 cards in 2-player games and 12 cards in larger games."`
  → **本アプリの `initSupply` は `DOM.isType(k,'victory') ? (numPlayers<=2?8:12) : 10` で自動的に正しくなる。追加コード不要。**
- 廃棄は**0〜4枚の任意**＝pending に「**0枚で確定**」ボタンが必須。
- **廃棄は「まとめて同時」**＝選択を全部確定してから `trashCard` をまとめて呼ぶ。**1枚ずつ廃棄→ドロー→また選ばせる、にしてはいけない**（ネズミ／城塞／青空市場／墓所 が絡むと挙動が変わる）。廃棄時トリガーはその後にまとめて処理。
- 墓地は通常**捨て札に獲得される＝手札に無いので自分を廃棄できない**。職人／カブラー／彫刻家／願い等で**手札に獲得したときだけ自分も廃棄対象**（獲得時効果の解決時点で既に手札にある）。
- 獲得時対話なので **`state.onGainQueue`** に積む。**呪いの森・望楼・そり等と同時に開いたら順番は獲得者が選ぶ**（本アプリの既存簡略化に落として構わないが、**墓地を先に処理できる**ようにしないと「呪いの森で手札が山札に載って墓地が空振り」になる）。
- **家宝**：王国に墓地があれば全員の初期銅貨1枚が**呪いの鏡**に置き換わる（銅貨7→6枚＋鏡1枚。**抜いた銅貨は銅貨の山へ戻す**）。
  - **呪いの鏡（Haunted Mirror）**＝コスト **$0**・**Treasure - Heirloom ／ 財宝・家宝**・**非サプライ（購入不可・山を持たない）**。
    - 英語原文（**現行＝2021年印刷**）：`$1` / `When you trash this, you may discard an Action card, to gain a Ghost.`
    - 英語原文（2017年印刷／参考）：`... to gain a Ghost from its pile.`
    - 日本語版（HJ印刷）：「1コイン ／ ———— ／ あなたがこのカードを廃棄したとき、あなたの手札からアクションカード1枚を捨て札にし、幽霊1枚をそのカードの山から獲得してもよい。」
    - Official FAQ 逐語：`"Haunted Mirror does not give you a way to trash it, but does something if you find a way to."`
- **墓地を使うゲームでは幽霊(Ghost)の山を出す**（rulebook L75）＝**非サプライ6枚**・コスト **$4\***・**Night - Duration - Spirit ／ 夜行・持続・精霊**。
  英語原文：`Reveal cards from your deck until you reveal an Action. Discard the other cards and set aside the Action. At the start of your next turn, play it twice.` / `(This is not in the Supply.)`
- 幽霊の山は**非サプライ**＝§0-2（PROGRESS）の**4系統除外チェックリスト**（`emptyPileCount` / `canBuyCard` / 闇市場デッキ母集団 / 汎用獲得＝engine の `*_GAIN` と CPU の `bestGain`/`bestGainExact`）を全部通すこと。

---

## 4. Changeling ／ 取り替え子 ★A群で最難

| 項目 | 内容 |
|---|---|
| 英語名 | **Changeling** |
| 日本語公式名 | **取り替え子** |
| コスト | **$3** |
| 種別 | **Night ／ 夜行**（持続ではない） |
| 仕切り線 | **あり** |

**日本語カードテキスト（本アプリ書式・⚠️下段は訂正版を採用）**
```
このカードを廃棄する。あなたの場に出ているカード1枚と同じカード1枚を獲得する。
————
取り替え子を使用するゲームで、コスト3以上のカード1枚を獲得するとき、それを取り替え子と交換してもよい。
```

> **⚠️ 日本語版カードの下段は公式に誤訳。日本語版の印刷文面「このカードが用いられるゲームでコスト3以上のカードを獲得するとき、代わりに取り替え子1枚を獲得してもよい。」は採用してはいけない。**
> 日本語wiki 逐語：
> > 「仕切り線以下の効果は**誤訳**である。本来は『コスト3以上のカードを獲得した後に(望むなら)それを取り替え子に**交換**する』なのだが、上記のテキストでは『交換』の単語が出てこず『(コスト3以上の)カードの獲得を、取り替え子の獲得に置き換える』と解釈できるように書かれている。**日本語版のマニュアル内の取り替え子の処理の説明（こちらでは「交換」と明記されている）は正しく書いてある**ので、そちらも確認されたい。」
> 上に採った訂正文は**英語wiki の Japanese 欄（Shuffle iT 日本語訳）の逐語**：「取り替え子を使用するゲームで、コスト[$3]以上のカード1枚を獲得するとき、それを取り替え子と交換してもよい。」
> 印刷文面のままにすると「獲得を置換する」＝獲得時トリガーが発火しなくなり、**ゲームが壊れる**。

**英語原文（逐語・現行＝2017年から不変）**
> `Trash this. Gain a copy of a card you have in play.`
> `In games using this, when you gain a card costing $3 or more, you may exchange it for a Changeling.`

**公式裁定（Official FAQ・rulebook L165-178 逐語）**
> "When Changeling is in the Supply, **any time you gain a card costing at least [$3], you may exchange it for a Changeling from the Supply.** You can only do this if **you can actually return the card you gained**, and **there is at least one Changeling in the Supply**. The Changeling goes to your **discard pile, no matter where the gained card went**. **Things that happen due to gaining the gained card still happen.** So for example you could gain Skulk, exchange it for a Changeling (returning Skulk to the Supply and putting Changeling into your discard pile), and still gain a Gold from Skulk's ability. **Exchanging for a Changeling is optional.** You cannot do it if the gained card costs less than [$3], even if it normally costs [$3] or more, and **you cannot do it if the cost is neither more or less than [$3] (such as Transmute from Alchemy)**. When you play Changeling, you trash it and gain a copy of a card you have in play; that can be **any card you have in play, including Actions, Treasures, and Night cards, and including Duration cards you played on a previous turn that are still in play**."

**Other rules clarifications（英語wiki 2025年版・逐語）**
> "Changeling **cannot gain a copy of Changeling**, since it is not in play when the effect happens - it's either in the trash (in a normal turn) or set aside (when played in a Possessed turn)."
> "You can choose any card you have in play, but **if that card's pile is empty, or its name does not match the name of the top card on that pile (e.g. it's a split pile), or that card's pile is not in the Supply (e.g. Imp), or that card has no pile (e.g. an Heirloom), you gain nothing.**"
> "**You can exchange for Changeling when gaining non-Supply cards, as long as they come from a pile, such as Ghost.** You cannot exchange for non-Supply cards that do not have an associated pile, such as the Zombies."
> "You can still exchange for Changeling **even if the Changeling pile is not in the Supply**, for example if it is the pile chosen for Ferryman. However you cannot exchange for Changeling **if it has no pile, e.g. when Changeling is in the Black Market deck**."
> "Remember that **you can choose the order in which simultaneous effects happen.** When you gain a card that either gains other cards (like Skulk above) or moves itself (like Villa), and you allow that gaining or moving effect to happen first, **Changeling will lose track of the card and not be able to exchange with it.** If you want to exchange, make sure you do that first."
> "**This checks the cost of the card as you're gaining it, not after.** So if you gain a Fisherman with an empty discard pile, you cannot exchange it for a Changeling, because Fisherman cost [$2] when you gained it."
> "If you gain a **Loot** and exchange it for a Changeling, the Loot goes back **on top of the pile, face down**."
> "**Exchanging is not gaining**, so exchanging a card for a Changeling will not allow you to take Changelings out of exile."

**追加裁定（日本語wiki「詳細なルール」逐語・実装の正本）**
- 使用時（上段）：
  > 「場に出ているカードであればコストやカードの種類に関係なく獲得できる。前のターンから場に出ている持続カードや呼び出したリザーブカードでもよい。」
  > 「**サプライに置かないカード、サプライの山札の一番上にないカード、あるいはサプライに1枚も残っていないカードを選んでもよいが、その場合、取り替え子は廃棄されるが、カードは獲得できない。**」
  > 「使用した取り替え子自身は廃棄されるため選べない。」
- 交換（下段）：
  > 「**コストにポーションや負債を含むカードとも交換できるが、コスト中のコインが3以上でなければならない。**」
  > 「橋などでカードのコストが下がっている場合、**下がった後のコスト**を参照する。」
  > 「**自分のターン以外で獲得するカードを、取り替え子に交換することもできる。**」
  > 「**廃棄置き場から獲得したカードに対しても、可能であれば取り替え子と交換することができる。この場合、交換元のカードは廃棄置き場ではなく由来する山札に戻す。**（例：盗賊で廃棄置き場から略奪を獲得し、それを取り替え子と交換した場合、略奪はサプライの略奪の山札に戻す。**※山切れだったハズのサプライが復活する可能性がある珍しい例である。**）」
  > 「役人やカブラーなどで捨て札以外に獲得されたカード、あるいは遊牧民の野営地やゴーストタウンなど捨て札以外に獲得されるカードとも交換することができる。**ただし、交換元のカードがどこに獲得されたとしても、交換して手に入れた取り替え子は例外なく捨て札に置く。**」
  > 「**交換は、「①獲得した『交換元のカード』が獲得先にあること」「②獲得した『交換元のカード』を由来する山札に戻せること」「③交換先のカードが山札にあること」の3つ全てが成立していなければならない。**」
  > 「例えば、廃棄置き場から獲得した**幸運のコイン**は、②に反するので交換できない。一方、獲得した**幽霊**は、②に反しないので交換できる。また、**闇市場で購入して獲得したカードは②に反するので交換できない**。」
  > 「サプライに取り替え子が残っていない場合は③に反するので交換できない。**また、闇市場デッキ内に取り替え子があっても、③に反するので交換できない。**」
  > 「何かカードを購入した場合、そのカードの『**購入時効果の発生**』は、カードを獲得するより前(=取り替え子との交換が誘発される前)なので注意。」
  > 「**交換は獲得ではないため、取り替え子を交換して手に入れたことに対しては、獲得に対する効果は誘発しない。**（例：追跡者でデッキの一番上に置けない。交換で手に入れた取り替え子をさらに取り替え子へ交換することもできない。）」
  > 「**ただし、交換元のカードは実際に獲得しているため、獲得を参照する他のカードは以下のように機能する。**鉄工所で獲得したカードを交換してもボーナスは得られる。密輸人は右隣のプレイヤーが交換した取り替え子を選べないが、**交換元のカードは選んで獲得してよい**。トレジャーハンター、凱旋、征服、浴場、迷宮、修道院、**悪魔の工房**、デストリエ、商売、賛辞は**交換した取り替え子を数に含めないが、交換元のカードの獲得は数に含める**。」

**実装注意**

**(A) 使用時（上段）**
- 対象＝**`p.inPlay` ＋ `p.durationCards`**（前ターンから残っている持続も可）。**取り替え子自身は不可**（先に廃棄されて場に無い）。
- **⚠️ 獲得できるのは「サプライの山の一番上が同名のとき」だけ。非サプライ（インプ／幽霊／ウィル・オ・ウィスプ／願い／馬／戦利品／賞品／成長先）は選べても何も獲得しない。** 家宝・避難所・ゾンビも山が無いので何も獲得しない。分割山で一番上の名前が違う場合も獲得なし。
  → 本アプリの `gainableBase`（非サプライ／ロック中の分割山下段を弾く述語）を**そのまま使えばよい**。
- 廃棄は**必ず起きる**（獲得できなくても取り替え子は廃棄される）。pending は必ず終端させる（候補ゼロでも CPU は `{type:'CHANGELING_GAIN', card:null}` を返し、engine 側に「候補ゼロなら窓を閉じる」終端保証を書く＝§0-26）。
- 支配(Possession)中は取り替え子が**廃棄でなく脇に置かれる**＝そのときも自分自身は選べない。

**(B) 交換（下段）＝新機構。engine 横断で最も危険**
- **「取り替え子がサプライにあるゲームでは、全プレイヤーが、自分の獲得すべてに対して」窓が開く**（取り替え子を持っていなくてよい／自分のターン以外でもよい）。交易商人(trader)のリアクションとは違い、**手札の公開は不要**。
- **成立条件は3つとも必要**：①獲得したカードが**獲得先にまだある**（stop-moving）／②**由来する山に戻せる**（闇市場購入・廃棄置き場由来で山を持たない札は不可。**廃棄置き場からの獲得でも、山があるなら山に戻す**）／③**取り替え子の山に在庫がある**（闇市場デッキ内は不可）。
- **コスト判定は「獲得した瞬間」の実コスト**（橋／街道／渡し船で下がっていたらその値。漁師の例）。
- **判定式**：「$3以上」＝コスト成分の component-wise 比較で `(3,0,0)` 以上。ポーション・負債は常に0以上なので、**「コイン成分 ≥ 3」と厳密に同値**（変成 $0+P はコイン0<3で不可＝公式FAQの例と一致／大金 $8+負債8 はコイン8≥3で可）。日本語wikiが「コスト中のコインが3以上でなければならない」と明記しているのでこれで確定。
  → **新述語 `costAtLeastCoin(state, id, 3)` を engine に置き、engine拒否・CPU候補・UIフィルタの3面が同じものを見ること**（§0-23 の教訓）。
- **交換は獲得ではない**：
  - **`triggerOnGain` を呼ばない**（望楼／そり／鷹匠／技術革新／追跡者／密輸人／貨物船／追放の払い戻し が発火しない）。
  - **追放マットから取り替え子を戻せない**（`EXILE_DISCARD` の「同名獲得」条件を満たさない）。
  - **悪魔の工房・浴場・迷宮・凱旋・征服・修道院・商売 等のカウンタに入らない。ただし「交換元として実際に獲得したカード」は数える**（＝1回の獲得はきっちり1回数える）。
- **交換元のカードは山の上に戻す**（`supply[id]++`。分割山・混合山は元の山へ。**戦利品(Loot)は裏向きで山の一番上**）。**購入時効果は交換より前に済んでいる**。
- **`state.onGainQueue` に載せる**（§0-26）。公式は「同時に起きる効果の順番はプレイヤーが選ぶ」なので**取り替え子の窓を先に開く**のが忠実性が高い（後に回すと、ヴィラ／スカルク／望楼が先に動いて lose-track で交換できなくなる）。
- **CPU**：交換候補は「デッキに増やしたくない獲得」（呪い以外の$3以上のジャンク、銀貨、ネズミ、馬 等）に限る。**必ず非nullを返す**こと。

---

## 5. Cobbler ／ カブラー

| 項目 | 内容 |
|---|---|
| 英語名 | **Cobbler** |
| 日本語公式名 | **カブラー** |
| コスト | **$5** |
| 種別 | **Night - Duration ／ 夜行・持続** |
| 仕切り線 | なし |

**日本語カードテキスト（本アプリ書式）**
```
あなたの次のターンの開始時、コスト4以下のカードを1枚獲得し、手札に加える。
```
*日本語wiki（HJ印刷）と逐語一致。*

**英語原文（逐語・現行＝2017年から不変）**
> `At the start of your next turn, gain a card to your hand costing up to $4.`

**公式裁定（Official FAQ・rulebook L180-181 逐語）**
> "If you gain a **Nomad Camp** (from Hinterlands) with this, **it goes to your hand.**"

**Other rules clarifications は存在しない**（英語wiki 2024年版の目次に節が無い／`Errata` にもカブラーの項は無い）。

**追加裁定（日本語wiki「詳細なルール」逐語）**
> 「ターン開始時に**サプライの**コスト4以下のカードを獲得し手札に加えるのは**強制**である。」
> 「運河の効果などでカードのコストが下がった場合、下がった後のコストが4コスト以下であれば獲得できる。」
> 「**ポーションや負債をコストに含むカードは、どちらもコスト4(コイン)以下までのカードに含まれないため、獲得できない。**カブラーで獲得できるカードは、正確には『コスト 4コイン0ポーション0負債 以下のカード』とみなされるため。」
> 「イベント・プロジェクトはカードではないため、獲得できない。」
> 「カブラーの効果で獲得されるカードは、**捨て札置き場を経由せずに直接手札に獲得される**。」

**実装注意**
- **獲得先は手札**（`gain(..., dest:'hand')`）。**遊牧民の野営地の「山札の上に獲得」よりカブラーの「手札に獲得」が勝つ**（獲得置換の競合＝獲得者が選ぶ／公式が明記）。本アプリは §0-22 の彫刻家対応で `triggerOnGain` の `nomad_camp` 句に `dest !== 'hand'` を入れてあるので**そのまま動く**。**同じ理由でゴーストタウン（夜想曲・自分は「獲得したら手札に」ではないので無関係）や悪人のアジトとの競合も考慮**。
- **強制**（"gain a card"＝may ではない）。銅貨／呪いが常にあるので終端は容易だが、**必ず `gainableBase` ＋ `costUpTo(state, id, 4)` を使う**（素の `cardCost <= 4` は mix-all で非サプライ・ロック中の分割山下段・ポーション費用・負債コストを取りこぼす＝§0-23）。
- 持続なので `armDuration` ＋ `DURATION_RESOLVERS.cobbler` で次ターン開始時に pending（`cobbler_gain`）を `t.startQueue` に積む。
- **2025年の持続ルール**：カブラーが何らかの理由で場を離れたら、次ターンの獲得は起きない。
- 強シナジー（テストに使える）：**カブラーで墓地を手札に獲得すると、その墓地自身も墓地の獲得時効果で廃棄できる**（日本語wiki が明記）。

---

## 6. Conclave ／ コンクラーベ

| 項目 | 内容 |
|---|---|
| 英語名 | **Conclave** |
| 日本語公式名 | **コンクラーベ** |
| コスト | **$4** |
| 種別 | **Action ／ アクション**（幸運でも不運でもない） |
| 仕切り線 | なし |

**日本語カードテキスト（本アプリ書式）**
```
+2 コイン
あなたの場に出ていないアクションカード1枚を手札から使用してもよい。
そうした場合、+1 アクション。
```
*日本語wiki（HJ印刷）と逐語一致。*

**英語原文（逐語・現行＝2017年から不変）**
> `+$2`
> `You may play an Action card from your hand that you don't have a copy of in play. If you do, +1 Action.`

**公式裁定（Official FAQ・rulebook L184-192 逐語）**
> "When you play this, you can play an Action card from your hand, **provided that you do not have a copy of that card in play.** **It does not matter if you played the Action card this turn, only that it is not in play when you play Conclave**; you can use Conclave to play a card that you played but trashed and so do not have in play, like a Pixie you trashed, but cannot use it to play a card you did not play this turn that is still in play, such as **a Secret Cave from your previous turn**. **Conclave normally cannot play a Conclave**, as that is a card you have in play. If you do play a card with Conclave, then Conclave gives you +1 Action, which has **no special limitations**, and so can for example be used to play another Conclave."

**Other rules clarifications は存在しない**（英語wiki 2025年版の目次に節が無い）。

**追加裁定（日本語wiki「詳細なルール」逐語・実装の正本）**
> 「コンクラーベで手札のアクションを使用する際には、**アクション権を消費しない**。」
> 「確認されるのは『**現状でそれと同じ(名前の)カードが場に出ているか？**』という点である。例えば、鉱山の村を使用して2コインを得るために廃棄していた場合は、現状で鉱山の村は場にないため、同一ターン内でもコンクラーベで手札の鉱山の村を使用できる。逆に、**持続カードや呼び出したリザーブカードなどが場に出ていれば、(それを同一ターンに使用していなくても)コンクラーベの効果で手札の同じ名前のカードを使用できない**。」
> 「**コンクラーベの厳密な処理は以下の通り。**(1) コンクラーベを使用した。(2) コンクラーベの効果により、『+2コインを得る』『手札からあなたの場にないアクションAを使用しても良い』を処理する。**(i) 場にないアクションAを使用する場合は、このタイミングですべての処理を完了する。** (2) (i)でアクションを使用した場合、コンクラーベの効果で+1アクションを得る。**※つまり、(2)の処理は(i)の処理の後である。(i)で雪深い村を使用した場合は、(2)で+1アクションを得られない。**」
> 「手札のアクションを使用する効果は**任意処理**である。場に出ていないアクションカードが手札にある場合でも、使用しないことを選んでもよい。使用しない場合、+1アクションを得られない。」
> 「**コンクラーベが場から捨て札になるタイミングは、常に「コンクラーベ使用ターンのクリーンアップフェイズ」である。玉座の間やはみだし者などの『自身の効果で使用したカードが場から離れるまで場に残るカード』との違いに注意。** コンクラーベの効果で漁村を使用すると、漁村は『コンクラーベ使用者の次のターンのクリーンアップフェイズ』まで場に残るが、**コンクラーベ自身は使用ターンのクリーンアップフェイズに捨て札になる**。コンクラーベの効果で雇人を使用すると、雇人は場に残り続けるが、コンクラーベ自身は使用ターンのクリーンアップフェイズに捨て札になる。」
> 「（2019年のルール変更とエラッタに関連し）**はみだし者／大君主は、使用されると場を離れるまでカード名を含めて「はみだし者／大君主で選んだカード」として扱われなくなった**。」
> 「『何かを**相続**した屋敷』は、相続後も『カード名は「屋敷」のまま』なので注意。（村を相続した状態で屋敷を使用→屋敷の効果で村を使用→コンクラーベを使用→コンクラーベで手札から村を使用できる。この時、**手札の屋敷は使用できない**。）」

**実装注意**
- **判定は「その名前のカードが今 場にあるか」だけ**。`p.inPlay` ＋ **`p.durationCards`（前ターンから残っている持続）** の両方を見る。**前ターンの持続が場に残っているとその名前は選べない**（＝持続との強いアンチシナジー）。
- 逆に、**プレイ後に場から消えるカード（馬／自己廃棄する祝宴・鉱山の村／その山に戻る実験・陣地／追放される備蓄品）は同一ターンに何度でも対象にできる**。
- **⚠️ コンクラーベは持続アクションもプレイできる**（"an Action card" に制限が無い）。本アプリの他の「カードを使用する」機構（王子／船長／大君主／はみだし者／行進／相続）は**すべて non-Duration 制限がある**ので、**同じ述語を使い回すと誤って持続を弾く**。コンクラーベ／インプ専用の述語を用意すること。
- **⚠️ コンクラーベ自身は「持続を代理プレイしたから場に残る」ことはしない。** 玉座の間系（`armDuration` で命令カードを場に残す機構）を流用してはいけない。**コンクラーベは常に使用ターンの片付けで捨て札**。
- **効果の順序（テストで固定すること）**：
  1. `addCoins(state, 2)`
  2. 手札のアクション1枚を選ぶ（任意・候補が無ければ pending を開かない＝死に選択肢を出さない）
  3. **選んだアクションを完全に解決する**（そのアクションが立てた pending もここで解決しきる）
  4. **その後に** `addActions(t, 1)` ← **`t.actions += 1` を直接書かない**（雪深い村が壊れる＝§0-25）。
  - **回帰テスト**：コンクラーベで**雪深い村**を使ったら **+1 アクションが得られない**こと（日本語wikiが明記）。
- アクション権は消費しない（コンクラーベがプレイする）。+1 アクションに制限は無い＝**もう1枚のコンクラーベを使える**。
- 本アプリの `PLAY_ACTION` を経由しない内部プレイになるので、**チャンピオン／教師トークン／山砦の「PLAY_ACTION のみ」既存簡略化と同じ扱い**になる（PROGRESS に許容簡略化として記録すること）。
- **同型カード**：**インプ（Imp・非サプライ）** が同じ「場にないアクションを1枚使用」を持つ。述語・pending を共有できる。

---

## 7. Crypt ／ 納骨堂 ★機能エラッタあり（2022）

| 項目 | 内容 |
|---|---|
| 英語名 | **Crypt** |
| 日本語公式名 | **納骨堂** |
| コスト | **$5** |
| 種別 | **Night - Duration ／ 夜行・持続** |
| 仕切り線 | なし |

**日本語カードテキスト（本アプリ書式・⚠️現行＝2022年エラッタ後）**
```
あなたの場に出ている、持続でない財宝カードを好きな枚数、(このカードの下に)裏向きで脇に置く。
残りがある限り、あなたの各ターンの開始時に、その中の1枚を手札に加える。
```
> **出典と注記（confidence: 文面 medium／機能 high）**
> - Dominion Online の日本語訳（日本語wiki が転載・逐語）：「**持続でない財宝カードを好きな枚数(このカードの)脇に伏せて置く。／残りがある限り、あなたの各ターンの開始時に、その中の1枚を手札に加える。**」
> - **日本語版の印刷カードは2017年版で内容が古い**（「持続でない」が無い）。日本語wiki 逐語：
>   > 「このカードは**2022年のルール変更とエラッタでカードテキストから効果が変更されており、2022年現在の(日本語版の)カードテキストと効果が異なります**。Dominion Online等のインターネット上でドミニオンを遊べるサービスでは変更後のルールで処理が行われています。」
> - 上に採った本アプリ用テキストは、**Dominion Online 訳に「あなたの場に出ている」「(このカードの下に)裏向きで」を英語原文から補った合成**（どこから脇に置くのかが訳文だけでは伝わらないため）。**HJ が現行文で再版した日本語カードは確認できていない。**

**英語原文（逐語・現行＝2022年6月エラッタ後）**
> `Set aside any number of non-Duration Treasures you have in play, face down (under this). While any remain, at the start of each of your turns, put one of them into your hand.`

**英語原文（旧・2017年印刷／参考）**
> `Set aside any number of Treasures you have in play, face down (under this). ...`

**日本語版の印刷文面（2017年・参考／採用しない）**
> 「あなたの場に出ている財宝カードを好きな枚数裏向きにして脇に置く(このカードの下)。／それらのカードが残っている間、あなたのターンの開始時に、その中の1枚をあなたの手札に加える。」

**公式裁定（Official FAQ (2021)・rulebook L204-207 逐語）**
> "For example if you set aside three Treasures, then at the start of each of your next three turns you will put one of them into your hand, and **at the end of the last of those turns you will discard Crypt from play**. **The Treasures are face-down; you can look at them at any time, but other players may not.**"

**Other rules clarifications（英語wiki 最新版・逐語）**
> "**Crypt can't set aside Duration Treasures.** However, it **can set aside Throne Room variant Treasures (such as Crown)** even if they played a Duration card multiple times and would be scheduled to stay in play until the next turn. If this happens, the Duration card remains in play, but its future-turn effects will only happen once."

**エラッタの理由（英語wiki `2022 Errata` 逐語）**
> "Durations don't want to be trashed from play because then you have to remember the effect with no card reminding you. There didn't used to be Treasure - Durations but now there are; hence "non-Duration" on **Counterfeit, Crypt, Mint**."

**追加裁定（日本語wiki「詳細なルール」逐語）**
> 「納骨堂で場の財宝カードを脇に置く効果は、**使用時効果**である。脇に置きたい財宝は納骨堂を使用したタイミングで場に出ている必要がある。」
> 「このカードは使用したターンのクリーンアップフェイズには捨て札にならず、**脇に置いたカードがなくなったターンのクリーンアップフェイズに捨て札になる**。」
> 「**脇に置くカードの枚数は0でもよい。その場合、納骨堂は使用ターンのクリーンアップフェイズに捨て札に置かれる。**」
> 「複数の種類を持つカードの場合、その中に財宝を含めば財宝カードとして扱う。**財宝カードのうち、持続でさえなければアクションのタイプを持っていても納骨堂の対象になるため、例えば冠を脇に置くことができる。**」
> 「**納骨堂により脇に置かれた財宝カードが、「場に出ている限り」の効果を持っていた場合は、脇に置かれた時点で効果を失う。**」
> 「**元手を使用後脇に置けば、負債を受け取らなくて済む。**納骨堂を複数用意すれば…負債を踏み倒し続けることも可能。」
> 「（2025年エラッタの帰結）納骨堂がターン終了時に場を離れている場合、脇にカードを置き続けることになる。**※結果として、1枚のカードが脇に置かれ続けるが、これは「プレイヤーAのカード」であり続ける。（得点計算時にカウントする。）**」

**実装注意**
- **脇置きの財宝は物理カード**＝**新ゾーン `p.cryptStacks = [{ id:'crypt', cards:[...] }]`（納骨堂1枚につき1スタック）**。
  **`allCards` と invariants の `ZONES` に必ず入れる**（§0-22 の `p.cargo`、§0-26 の `p.eventSetAside` と同型）。
- **裏向き＝自分だけ見える**。`maskStateFor` で他席には `'back'`（ルネサンスの研究(research)の裏向き脇置きと同型）。
- **納骨堂は複数枚同時に場にあり得る**。どの納骨堂の下に何を置くかは1枚ずつ解決すれば自然に決まる。ターン開始時は**納骨堂ごとに1枚**手札へ。**複数ある場合の解決順は公式なら選べる**が、本アプリの `startQueue` は先入れ順＝**既存の許容簡略化でよい**。
- **0枚を脇に置いたら持続にならず、そのターンの片付けで捨てる**（ルネサンスの研究で銅貨$0を廃棄したときと同型の分岐）。
- **「持続でない財宝」の判定は `isTreasureFor(state, id) && !DOM.isType(id, 'duration')`**（資本主義があると「+$を持つアクション」も財宝になる＝§0-22 の必読事項。`DOM.isType(id,'treasure')` を直接書かない）。**冠(crown)＝アクション＋財宝は対象になる**。
- **脇に置かれた財宝の「場に出ている限り」効果は失われる**（例：ティアラ／群衆／ならず者の隠れ家 など）。本アプリでは inPlay から抜けるので自然にそうなるはずだが**テストで固定する**。
- **回帰テストの目玉**：帝国の**元手(capital)** を納骨堂で脇に置くと、`cleanupAndAdvance` の「場から捨てるとき負債6」を通らないので**負債を負わない**。
- **2025年の持続ルール**：納骨堂が場を離れると以後の開始時効果が止まり、**下の財宝は永久に取り出せなくなるが、ゲーム終了時の得点には自分のカードとして数える**（`allCards` に含めれば自動で正しくなる／保存則テストも通る）。
- **「あなたの各ターンの開始時」**（"each of your turns"）＝**追加ターン（前哨地／使節団／今を生きる／艦隊）でも発動する**。「次のターン」ではない点に注意。

---

## 8. Cursed Village ／ 呪われた村

| 項目 | 内容 |
|---|---|
| 英語名 | **Cursed Village** |
| 日本語公式名 | **呪われた村** |
| コスト | **$5** |
| 種別 | **Action - Doom ／ アクション・不運** |
| 仕切り線 | **あり** |

**日本語カードテキスト（本アプリ書式）**
```
+2 アクション
あなたの手札が6枚になるまでカードを引く。
————
このカードを獲得するとき、呪詛を1つ受ける。
```
*日本語wiki（HJ印刷）と逐語一致。*

**英語原文（逐語・現行＝2017年から不変）**
> `+2 Actions`
> `Draw until you have 6 cards in hand.`
> `When you gain this, receive a Hex.`

**公式裁定（Official FAQ・rulebook L217-219 逐語）**
> "**If you already have six or more cards in hand, you do not draw any cards.** When you gain Cursed Village, you receive a Hex; **since that will often be in your Buy phase, some of the Hexes may not do anything to you.**"

**Other rules clarifications は空**（英語wiki 最新版で節見出しはあるが中身が無い）。

**追加裁定（日本語wiki「詳細なルール」逐語）**
> 「**手札のカードが6枚になるまでドローし続けるので、即座に －1カードトークンは取り除かれ、実質的に影響を受けない。**」
> 「**手札が6枚以上ある場合、カードのドローを行えない。この場合、－1カードトークンは残ったままとなる。**」
> 「呪詛を受ける効果は、**獲得時効果**である。獲得カードを捨て札置き場に置いた直後に発揮される。よって、呪われた村の獲得で呪詛を受け、その効果でリシャッフルが発生する場合は、**呪われた村は必ず新しいデッキに加えられる**。望楼などタイミングが同じである獲得時効果によって先に移動された場合、呪われた村をデッキに含まず呪詛を受けることは可能。」
> 「抜け道として、**獲得さえしなければ呪詛を受ける効果は誘発しない**ため、追放によって入手するか、あるいはそもそも入手せず遠隔操作系で使用するとノーダメージで済む。ラクダの隊列で追放マットに貯めてから獲得することで、**呪詛を1回受けるだけで複数の呪われた村がデッキに入れられる**。輸送2回で追放マット経由でデッキトップに置けば全く呪詛を受けずに済む。」
> 「**コスト減を絡めて相続すれば屋敷の獲得でよい。なおサプライから脇に置く挙動はカードの獲得にはあたらないため、相続時も呪詛を受けない。**」

英語wiki Antisynergies 逐語：`"Swindler can also Hex you whenever it hits a [$5]"`

**実装注意**
- **draw-to-X**＝図書館／物見やぐらと同型。**手札6枚以上なら1枚も引かない**（負の枚数を引かない）。**-1カードトークン**は「引く」処理で1枚食われるが、6枚になるまで引き続けるので実質無害（ただし6枚以上なら**トークンは残る**）。
- 呪詛を受けるのは**獲得した本人**（"you gain"）。**相手のターンでも発火する**（例：詐欺師で$5札を呪われた村に置き換えられた被害者／総督の格上げ／不正利得系）。
- 呪詛を受けるのは購入フェイズが多く、**手札を捨てさせる系の呪詛（憑依／恐怖／貧困）が空振りするのが正しい**（公式が明記）。**空振りを「バグ」と誤認して直さないこと。**
- **`receiveHex(state, pi)` 共通ヘルパ**を作る（呪詛デッキ12枚から1枚めくる → 効果解決 → 呪詛の捨て札へ）。**呪詛は必ず捨て札に行く**（祝福と違い手元に残るものは無い。ただし幻惑／羨望は「状態カード」＝錯乱／嫉妬 をプレイヤーの前に置く＝別スロット）。
- 呪詛の中には対話を伴うもの（疫病＝呪い獲得、飢饉＝シャッフル、戦争 等）があるので **`state.onGainQueue` に積む**（§0-26）。
- **「追放は獲得ではない」「相続でサプライから脇に置くのは獲得ではない」ので呪詛は発火しない**＝本アプリの `p.exile` / `p.inherited` の実装がそのまま正しい挙動になる（テストで固定）。

---

## 9. Den of Sin ／ 悪人のアジト

| 項目 | 内容 |
|---|---|
| 英語名 | **Den of Sin** |
| 日本語公式名 | **悪人のアジト** |
| コスト | **$5** |
| 種別 | **Night - Duration ／ 夜行・持続** |
| 仕切り線 | **あり** |

**日本語カードテキスト（本アプリ書式）**
```
あなたの次のターンの開始時、+2 カード。
————
このカードを獲得するとき、(捨て札に置く代わりに)手札に加える。
```
*日本語wiki（HJ印刷）＝「あなたの次のターンの開始時、+2 カードを引く。／————／このカードを獲得するとき、(捨て札に置く代わりに)手札に加える。」と逐語一致（`+2 カードを引く` を本アプリ書式の `+2 カード` に置換）。*

**英語原文（逐語・現行＝2017年から不変）**
> `At the start of your next turn, +2 Cards.`
> `This is gained to your hand (instead of your discard pile).`

**公式裁定（Official FAQ・rulebook L221-222 逐語）**
> "Since Night is after the Buy phase, **normally you can play this the turn you buy it.**"

**Other rules clarifications（英語wiki 最新版・逐語）**
> "**If you gain this onto your deck (with e.g. Armory), you didn't gain it to your discard pile, so Den of Sin's ability doesn't trigger and it stays on your deck.**"

**追加裁定（日本語wiki「詳細なルール」逐語）**
> 「悪人のアジトは、獲得時に**捨て札置き場を経由せずに直接手札に獲得される**。」
> 「悪人のアジトの**既定獲得先は、捨て札置き場ではなく手札であり、一度捨て札置き場を経由してから手札に移動するわけではない（他のカードが見失うことはない）**、という意味である。」

**実装注意**
- **「捨て札置き場に獲得される場合だけ」手札に置き換わる**。武器庫／遊牧民の野営地系のように**獲得先が明示されている効果ではその場所のまま**（置換しない）。
  → 本アプリの `gain(state, pi, id, dest)` で **`dest === 'discard'` のときだけ `'hand'` に読み替える**（＝既定獲得先が手札という表現の実装）。**捨て札を経由しないので `stop-moving`（望楼等）が見失うことは無い。**
- **相手のターンに獲得しても自分の手札に入る**（例：総督の格上げ、詐欺師の置き換え）。
- **夜フェイズは購入フェイズの後**なので、買ったターンにそのまま使える＝`$5/$2` の初手で強い。**これがフェイズ順の正しさの一番わかりやすい回帰テスト**（買う → 手札に入る → 同ターンの夜フェイズで使用 → 次ターン +2カード）。
- 持続＝次ターン開始時に **+2 カード**。**2025年エラッタ**：場を離れたら +2 カードは起きない。
- 呪いの森(haunted_woods)を受けている状態で何かを購入すると**手札が山札に載る＝夜行カードを一切使えない**（英語wiki `Night` が明記）。悪人のアジトを買った直後でも同じ＝**購入 → 呪いの森で手札ごと山札へ → 夜フェイズに使えない**。

---

## 10. Devil's Workshop ／ 悪魔の工房

| 項目 | 内容 |
|---|---|
| 英語名 | **Devil's Workshop** |
| 日本語公式名 | **悪魔の工房** |
| コスト | **$4** |
| 種別 | **Night ／ 夜行**（持続ではない） |
| 仕切り線 | なし |

**日本語カードテキスト（本アプリ書式・現行＝2021年版に合わせる）**
```
このターンにあなたが獲得したカードの枚数が:
2枚以上の場合、インプ1枚を獲得する。
1枚の場合、コスト4以下のカード1枚を獲得する。
0枚の場合、金貨1枚を獲得する。
```
*日本語版（HJ印刷・2017年版）は「2枚以上の場合、インプ1枚を**そのカードの山から**獲得する。」。英語は2021年印刷で "from its pile" が落ちた＝**機能差ゼロの表記変更**（`Errata` に functional change として載っていない）。表示は簡潔な現行に合わせるのを推奨。*

> **⚠️ インプの日本語公式名は「インプ」**（日本語wiki のカード個別ページ・カードテキスト転記とも「インプ」／種別「アクション-精霊」）。**英語wikiの Japanese 欄が使う「小悪魔」は Shuffle iT 訳**なので採用しない。

**英語原文（逐語・現行＝2021年印刷）**
> `If the number of cards you've gained this turn is:`
> `2+, gain an Imp;`
> `1, gain a card costing up to $4;`
> `0, gain a Gold.`

**英語原文（旧・2017年印刷／参考）**
> `2+, gain an Imp from its pile;`

**公式裁定（Official FAQ・rulebook L224-228 逐語）**
> "This counts **all cards you have gained this turn, including cards gained at Night prior to playing it.** **You cannot choose a different benefit**; if you have gained two or more cards, you have to gain an Imp, you cannot take a card costing up to [$4] or a Gold instead. Normally, bought cards are then gained, but **cards exchanged for (such as Vampire exchanging for Bat) are not gained.**"

**Other rules clarifications（英語wiki 最新版・逐語）**
> "Since **you can't gain anything while Possessed**, playing Devil's Workshop on a Possession turn **always gains a Gold**. (And it is gained by the player possessing you, of course.)"

**追加裁定（日本語wiki「詳細なルール」逐語）**
> 「**獲得するカードの枚数は、悪魔の工房の効果処理時に判定する。**」
> 「**悪魔の工房を使用した場合、必ずカードを獲得しなければならない。**」
> 「**獲得するカードの山札が切れている場合、何も獲得できない。**」
> 「橋などでカードのコストが下がった場合、下がった後のコストが4コスト以下であれば獲得できる。」
> 「**ポーションをコストに含むカード（ブドウ園など）、負債をコストに含むカード（技術者など）は、どちらもコスト最大4(コイン)までのカードに含まれないため、獲得できない。**」
> 「悪魔の工房は購入フェイズ後にカードを獲得するため、**石切場やティアラを使用した後に使用することで、それらの恩恵を受けられる**。」

**取り替え子との関係（日本語wiki 取り替え子ページ・逐語）**
> 「トレジャーハンター、凱旋、征服、浴場、迷宮、修道院、**悪魔の工房**、デストリエ、商売、賛辞は**交換した取り替え子を数に含めないが、交換元のカードの獲得は数に含める**。」

**実装注意**
- **カウンタは「このターン、そのプレイヤーが獲得したカードの枚数」**。本アプリには `t.gainedThisTurn`（手番プレイヤーの獲得id列・帝国の制圧/凱旋で使用）があるのでそのまま使える。**夜フェイズでこのカードより前に獲得したぶんも含む。**
- **選択の余地は無い**（枚数で自動決定）。pending が要るのは「1枚」ケース（コスト4以下を選ぶ）だけ。
- **⚠️「交換は獲得ではない」の正確な意味**：交換して得た**取り替え子（やコウモリ）は数えない**が、**交換元として実際に獲得したカードは1回の獲得として数える**。「交換したから何も数えない」ではない。
  例）銀貨を獲得 → 取り替え子に交換 → **カウントは 1**（銀貨の獲得ぶん）。
- **インプの山＝非サプライ13枚**（rulebook 内容物 L43 逐語 `"13 of Imp"`）。**悪魔の工房か迫害者(Tormentor)か悪魔祓い(Exorcist)が王国にあるとき**に出す（rulebook L74-76）。
  - **インプ**＝コスト **$2\***・**Action - Spirit ／ アクション・精霊**・非サプライ。
    英語原文：`+2 Cards` / `You may play an Action card from your hand that you don't have a copy of in play.` / `(This is not in the Supply.)`
    日本語（HJ印刷）：「+2 カードを引く／あなたの場に出ていないアクションカード1枚をあなたの手札から使用してもよい。／(このカードはサプライには置かない。)」
    → **§6 コンクラーベと同じ述語・同じ pending を共有できる**（インプ自身も「場にあるので選べない」／インプが持続をプレイしても**インプは使用ターンの片付けで捨て札**）。
  - **`NON_SUPPLY` に登録し、§0-2 の4系統除外チェックリスト**（`emptyPileCount` / `canBuyCard` / 闇市場デッキ母集団 / 汎用獲得＝engine の `*_GAIN` と CPU の `bestGain`/`bestGainExact`）を**必ず全部通す**。
- **インプの山が空なら何も獲得しない**（終端保証）。同様に金貨の山が空なら何も獲得しない。
- **支配(Possession)中**：被支配者は何も獲得できない＝カウンタ0 → **常に金貨**（獲得するのは支配者）。本アプリの支配ルーティング（§0-23）で自然にこうなるはずだが**テストで固定**。
- 「コスト4以下」は必ず **`gainableBase` ＋ `costUpTo(state, id, 4)`**（素の `cardCost <= 4` は禁止＝§0-23）。

---

## 11. Druid ／ ドルイド

| 項目 | 内容 |
|---|---|
| 英語名 | **Druid** |
| 日本語公式名 | **ドルイド** |
| コスト | **$2** |
| 種別 | **Action - Fate ／ アクション・幸運** |
| 仕切り線 | **あり**（準備行の前） |

**日本語カードテキスト（本アプリ書式）**
```
+1 購入
脇に置かれた祝福1つを受ける（その祝福はそのまま置いておく）。
————
準備：祝福3枚を表向きにして脇に置く。
```
*日本語wiki（HJ印刷）＝「+1 カードを購入／脇に置かれた祝福1つを受ける（その祝福はそのまま置いておく。）／————／準備：祝福3枚を表向きして脇に置く。」（「表向きして」は原文ママ）。本アプリ書式の `+1 購入` と自然な日本語に整えた。*

> **⚠️ 日本語版の初回生産分は種別欄が空欄。** ホビージャパン公式の正誤表 逐語：
> > 「『ドミニオン：夜想曲』の王国カード**《ドルイド》のカードタイプ表記に誤植（文字抜け）**がありました。／《ドルイド》／**「アクション – 幸運」のテキストが欠落しています。**」
> → 正しい種別は **アクション・幸運**（この誤植が Fate＝「幸運」訳の最強の裏付けでもある）。

**英語原文（逐語・現行＝2017年から不変）**
> `+1 Buy`
> `Receive one of the set-aside Boons (leaving it there).`
> `Setup: Set aside the top 3 Boons face up.`

**公式裁定（Official FAQ・rulebook L230-235 逐語）**
> "At the start of the game, deal out three Boons face up for Druid. **If there are other Fate cards in the same game, those Fate cards will not produce those Boons that game; the deck will consist of the other nine Boons.** When you play Druid, you choose one of its three Boons to receive, and **leave it there in the set-aside area for Druid, even if it is one of the Boons that says to keep it until Clean-up (e.g. The Field's Gift).**"

**Other rules clarifications は存在しない**（英語wiki 2024年版の目次に節が無い）。

**追加裁定（日本語wiki「詳細なルール」逐語）**
> 「ドルイドを使うゲームでは、祝福の山札から3枚を選出し、表向きにしてドルイドの脇に置く。ドルイドと合わせて他に幸運カードを使うゲームでは、**残る9枚の祝福を祝福の山札として準備する**。」
> 「**ドルイドによって脇に置かれた祝福は祝福の山札に入らないので、他の幸運カードによってそれら3枚の祝福を受けることはなくなる。**」
> 「沼の恵みが選出された場合、ウィル・オ・ウィスプをサプライの外に置く。」
> 「ドルイドをプレイし、**クリーンアップフェイズまで保持するよう指示されている祝福を選択した場合でも、その祝福は脇から移動しない**。」
> 「**玉座の間系で複数回ドルイドを使用した場合、1回の使用ごとに異なる祝福を選択してよい。**」
> 「複数の効果から一つを選べるアクションではあるが、『次の効果から一つを選ぶ』系統のテキストではないので、長老の対象にはならない。」

**エラッタ（表記のみ・未反映）** — 英語wiki `2023 Errata` の Cosmetic card changes 逐語：
> "Baker, Young Witch — "Setup:" is now written in bold text. (Aqueduct, Arena, Basilica, Battlefield, Baths, Black Market, Colonnade, Defiled Shrine, **Druid**, Importer, Inherited, Labyrinth, Necromancer, Obelisk, Tax, and Way of the Mouse **have not been updated** but are likely to change in future reprints.)"
→ **ドルイドは未反映**。表示は現状のままでよい（本アプリの `way_of_the_mouse` も `準備：` 表記なので揃う）。

**実装注意**
- **セットアップ**：王国にドルイドがあれば、シャッフルした祝福12枚の**上から3枚を表向きに脇へ**。**この3枚は祝福デッキから恒久的に抜かれる**＝他の幸運カードは**残り9枚しか使わない**。
  → **`state.druidBoons = [id, id, id]`**（トップレベル・公開・**非カード＝保存則 tally 対象外**・`maskStateFor` は素通し）。若き魔女の `state.baneCard` と同型。`createInitialState` の `pickBane` と同じ場所に置く。
- **祝福は消費されない**＝毎回3択から選び、選んだ祝福は**脇に置かれたまま**。何度でも同じ祝福を受けられる（例：沼の恵みが3枚の中にあればウィル・オ・ウィスプ製造機）。
- **「片付けまで手元に置く」系（田畑／森／川の恵み）を選んでも、カード自体は脇から動かさない。** ただし**そのターン中の効果は普通に適用される**（田畑の恵み＝そのターン +1アクション扱い等）。実装では「効果フラグだけ立てて、カードは動かさない」。
- **選択は強制**（"Receive one of the set-aside Boons"＝may ではない）。3択 pending（`druid_boon`）＝**engine reducer ＋ `PLAYER_ACTIONS` ＋ CPU `decidePending` ＋ UI `viewPendingModal` の4点セット必須**。
- **⚠️ 玉座の間／王の宮廷／行進で複数回使うと、1回ごとに祝福を選び直せる。** 本アプリの命令(Command)の `t.commandAs`（再演では選び直せない）の流儀を**適用してはいけない**。
- `+1 購入` はカード記載順どおり**先**（`addCoins`/`addActions` と同じく既存の +購入 経路を使う）。
- ドルイドがある＝Fate があるので**ウィル・オ・ウィスプの山も出す**（rulebook L66-67）。

---

## 12. 実装チェックリスト（A群まとめ）

### 新しい pending（すべて **engine reducer ＋ `PLAYER_ACTIONS` ＋ CPU `decidePending` ＋ UI `viewPendingModal` の4点セット＋終端保証**）
| pending | カード | 内容 |
|---|---|---|
| `blessed_village_boon` | 恵みの村 | 取った祝福を「今受ける／次の自分のターン開始時に受ける」の2択（**中身を見せてから**） |
| `cemetery_trash` | 墓地 | 手札から**0〜4枚**（0枚確定ボタン必須・**同時に廃棄**） |
| `changeling_gain` | 取り替え子 | 場（inPlay＋durationCards）の1枚を選び同名を獲得（`gainableBase` で非サプライを弾く・**候補ゼロでも終端**） |
| `changeling_exchange` | 取り替え子（下段） | 獲得したカードを取り替え子と交換するか（任意・`onGainQueue`・**全プレイヤー／全ターン**） |
| `cobbler_gain` | カブラー | 次ターン開始時（`startQueue`）に **$4以下を手札に強制獲得** |
| `conclave_play` | コンクラーベ | 手札の「場にない」アクション1枚を任意でプレイ（**候補ゼロなら開かない**） |
| `crypt_setaside` | 納骨堂 | 場の**持続でない財宝**を任意枚数（0枚可）脇へ |
| `crypt_take` | 納骨堂 | 各ターン開始時に脇の1枚を選んで手札へ（`startQueue`） |
| `devils_workshop_gain` | 悪魔の工房 | 獲得数1枚のときだけ $4以下を選ぶ |
| `druid_boon` | ドルイド | 脇の祝福3枚から1つ選ぶ（**強制**） |
| （共通） `boon_*` / `hex_*` | 祝福8枚／呪詛12枚 | `receiveBoon` / `receiveHex` から派生する対話（B群で詳細） |

### 新しい state スロット
| スロット | 種別 | 保存則 tally | マスク |
|---|---|---|---|
| `turn.phase === 'night'` | フェイズ | — | 公開 |
| `state.boons` / `state.boonsDiscard` | 非カード（id配列） | **入れない** | 山は伏せる／捨て札は公開 |
| `state.hexes` / `state.hexesDiscard` | 非カード | **入れない** | 同上 |
| `state.druidBoons` | 非カード（3件・固定） | **入れない** | 公開 |
| `p.savedBoons` | 非カード（配列） | **入れない** | 公開（誰が何を保持しているかは公開情報） |
| `p.states`（錯乱／嫉妬／不幸／森の迷子） | 非カード | **入れない** | 公開 |
| **`p.cryptStacks`** | **物理カード** | **必ず入れる**（`allCards` ＋ invariants の `ZONES`） | **他席には `'back'`** |
| 非サプライ山 `imp`(13) / `ghost`(6) / `will_o_wisp`(12) / `wish`(12) / `bat`(10) | 物理カード | 既存の非サプライ扱い | 公開 |

### 「素の `cardCost(state,id) <= N`」を書いてはいけない箇所（§0-23）
- カブラー（$4以下・手札に強制獲得）／悪魔の工房（$4以下）→ **`gainableBase` ＋ `costUpTo`**
- 取り替え子の交換（$3以上）→ **新述語 `costAtLeastCoin(state, id, 3)`**（コイン成分のみで厳密に同値）
- いずれも **engine拒否・CPU候補・UIフィルタの3面が同じ述語を見る**こと。

### `addActions` / `addCoins` を必ず通す（§0-25）
- コンクラーベの `+2 コイン` と `+1 アクション`（**雪深い村の回帰テストで固定**）／ドルイドの `+1 購入`。

### 回帰テストで固定すべき挙動（優先順）
1. **悪人のアジト**：買ったターンに手札に入り、そのまま夜フェイズで使える（フェイズ順の正しさ）。武器庫で山札の上に獲得したら**山札の上のまま**。
2. **コンクラーベ × 雪深い村**：**+1 アクションが得られない**（＝サブプレイの解決後に +1 アクション）。
3. **コンクラーベ × 漁村／雇人**：持続は残るが**コンクラーベ自身は使用ターンの片付けで捨て札**。
4. **取り替え子（上段）× インプ／幽霊／馬／家宝**：選べるが**何も獲得しない**（廃棄だけ起きる）。
5. **取り替え子（下段）× 暗躍者(Skulk)**：交換しても暗躍者の獲得時の金貨は得られる。**交換で得た取り替え子は `triggerOnGain` を呼ばない**（望楼が反応しない・追放から戻せない）。
6. **取り替え子（下段）× 悪魔の工房**：銀貨を獲得→取り替え子に交換 → **獲得数カウントは 1**。
7. **納骨堂 × 元手(capital)**：脇に置くと**負債6を負わない**。
8. **納骨堂 × 冠(crown)**：アクション＋財宝は脇に置ける。**持続の財宝は置けない**。
9. **納骨堂 0枚**：使用ターンの片付けで捨て札になる。
10. **墓地**：2人戦8枚／3人以上12枚。0枚廃棄可。**同時廃棄**（ネズミの連鎖不可）。カブラーで手札に獲得したら自分も廃棄できる。
11. **呪われた村**：手札6枚以上なら1枚も引かない。**詐欺師で押し付けられた被害者が呪詛を受ける**。**追放経由の入手では呪詛を受けない**。
12. **恵みの村**：保存した祝福が次ターン開始時に `startQueue` へ入る。**保存中の祝福は祝福デッキの再形成に混ざらない**。
13. **ドルイド**：脇の3枚が祝福デッキから抜けている（他の幸運カードが9枚しか回さない）。**玉座の間で2回使うと選び直せる**。

---

## 13. 確認できなかったこと（未確定・confidence 注記）

1. **納骨堂(Crypt)の「持続でない」を含む日本語の公式印刷文面は存在を確認できていない。** 日本語wikiが載せているのは **Dominion Online の日本語訳**であり、ホビージャパンが印刷した日本語カード（2019年1月発売・2017年英語版準拠）ではない。本ドキュメントの推奨テキストは**英語原文から「あなたの場に出ている」「(このカードの下に)裏向きで」を補った合成**。**機能・英語原文の confidence は high、日本語文面は medium。**
2. **HJ 日本語版が2022年以降のテキストで再版されたかは確認できていない。** HJ公式は「2回目以降の生産分はすでに修正済みです」と書いているが、これは**《ドルイド》の種別欄の誤植**についてであり、カードテキスト全般の更新ではない。
3. **悪魔の工房・呪いの鏡の「そのカードの山から」削除（2021年英語印刷）は日本語版に反映されていない。** ただし **`Errata` に functional change として載っていない＝機能差ゼロ**なので実装には影響しない（confidence: high）。
4. **2026年6月以降のエラッタは確認できていない。** `Errata`（All_Errata）のスナップショットは **2026-06-12 最終更新**（Royal Galley 2026 の項がある＝2026年分を収載している版）で、その Nocturne 節は Crypt / Necromancer / Tracker の3枚のみ。それ以降の変更は排除できない。
5. **rulebook（pdftotext）は $ と VP の記号が全滅**しているため、**コスト・コイン・VPの数値はすべて英語wikiの `[$N]`/`[N VP]` 復元表記と日本語wikiで裏取り**した。rulebook 単独の数値は一切採用していない。
6. **英語wikiのスナップショット年が均一でない**：Bard/Crypt/All_Errata＝最新(2id_)、Blessed Village/Changeling/Conclave/Devil's Workshop/Ghost/Haunted Mirror/Cursed Village＝2025、Cobbler/Druid/Imp/Victory card＝2024、Den of Sin＝2025。**Cemetery だけ2023年版までしか取得できなかった**（Wayback が新しい版を返さなかった）ため、2024年以降に Other rules clarifications が追加されている可能性は排除できない（`Errata` に墓地の項が無いので機能的な変更は無いと判断。confidence: high）。
7. **墓地の山の枚数は Nocturne ルールブック本体には書かれていない**（内容物の "12 of Cemetery" は箱の実物枚数）。8/12 は英語wiki `Victory card` の一般則と**日本語wiki 墓地の「詳細なルール」の明文**（「2人で遊ぶ場合は8枚、3人以上で遊ぶ場合は12枚」）による。confidence: **high**。

---

# パート3：王国カード B群（悪魔祓い〜ピクシー）

## 夜想曲（Nocturne）§B — 王国カード11種（B群）＋関連の非サプライ札

**版**: 第2版（敵対検証済み）。第1版の下書きを**全項目 一次資料から引き直した**。
**結論として、下書きの コスト11/11・種別11/11・カードテキスト11/11・公式FAQ の要点は正しかった**。
訂正したのは **エラッタの帰属3件と、確信度の格上げ2件、および下書きが落としていた裁定4件**（§B-13 に一覧）。

**担当11種**: 悪魔祓い / 忠犬 / 愚者 / ゴーストタウン / 守護者 / 偶像 / レプラコーン / 修道院 /
ネクロマンサー / 夜警 / ピクシー
**併せて確定させた関連札**: 幸運のコイン（家宝）・ヤギ（家宝）・願い（非サプライ）・森の迷子（状態）

### 使った一次資料（すべて自分で開いた）
| 資料 | 用途 | 注意 |
|---|---|---|
| RGG公式ルールブック（`nocturne_rulebook.txt`・pdftotext） | 構成枚数・準備・夜フェイズ・カード別FAQ | **コイン記号が脱落**。金額判定には単独使用禁止 |
| 英語wiki（Wayback経由・`wikifetch.py`） | コスト・種別・現行テキスト・版履歴・FAQ | 記号が `[$4]` に復元される。**Japanese行の「名前」は不正確**（§B-0） |
| 英語wiki `Errata` / `2021 Errata` / `All Errata` | エラッタの有無と年 | ページ間で年の帰属が食い違う（§B-9） |
| wikiwiki.jp/dominiondeck | **日本語公式カード名・種別訳** | 名前はこちらが正 |
| ホビージャパン公式 夜想曲 商品ページ | **種別の日本語公式訳** | 下記(B)の決定的根拠 |

---

## B-0. 先に確定させた前提（これを外すと全カードが崩れる）

### (A) 種別の日本語公式訳＝**ホビージャパン公式サイトで裏が取れた**
商品説明の逐語:

> このセットは500枚のカードからなり、33種の新たな王国カードを収録しています。**購入フェイズが終わったあとにプレイできる夜行カード**、**初期デッキの銅貨と入れ替えて使用する家宝カード**、**祝福と呪詛をもたらす幸運カードと不運カード**、他にも様々な新カードが登場します。

⇒ **Night=夜行 / Heirloom=家宝 / Fate=幸運 / Doom=不運 / Boon=祝福 / Hex=呪詛**。
これは wiki ではなく**版元の記述**なので最も強い。`Duration=持続` `Reaction=リアクション` `Attack=アタック`
`Spirit=精霊` `Zombie=ゾンビ` は wikiwiki.jp のカード一覧で確認（例: `ピクシー 2 アクション-幸運`／
`守護者 2 夜行 持続`／`ウィル・オ・ウィスプ 0* アクション-精霊`）。

※ 同ページには**日本語版の初回生産ロットの誤植情報**もある（《ドルイド》の種別欄「アクション – 幸運」が
文字抜け・第2ロット以降は修正済）。B群には影響しないが、日本語カード画像を参照するときの注意点。

### (B) **英語wiki の「Japanese」行の“名前”は採用しない**（§0 の結論と独立に再確認した）
B群で実際に食い違ったのは4つ。**すべて wikiwiki.jp 側（＝ホビージャパン印刷版）が正**。

| 英語名 | 英語wiki Japanese行（❌） | 採用（✅） | wikiwiki.jp の逐語 |
|---|---|---|---|
| Ghost Town | 幽霊街 | **ゴーストタウン** | `ゴーストタウン / 3 / 夜行 持続` |
| Lucky Coin | 幸運の銅貨 | **幸運のコイン** | `幸運のコイン / 4 / 財宝-家宝 / 1●、銀貨1枚を獲得` |
| Goat | 山羊 | **ヤギ** | `ヤギ / 2 / 財宝-家宝 / 1●、手札1枚を廃棄できる` |
| Wish | 大願 | **願い** | `願い / 0* / アクション` |

英語wiki の Japanese 行は**本文テキスト自体も同じ旧訳系統**（愚者の行に `(家宝: 幸運の銅貨)`、
ピクシーの行に `(家宝: 山羊)`、レプラコーンの行に `大願の山から` と書かれている）。
⇒ **本節の日本語テキストは、英語原文＋(A)の公式種別訳＋既存カタログ書式から起草したもの**であって、
ホビージャパン印刷版の逐語ではない（§B-12 の未解決事項1）。

### (C) B群のエラッタ結論
`All Errata` の Nocturne 節は**逐語で3枚のみ**（Crypt / Necromancer / Tracker）。
**B群で機能が変わったのは ネクロマンサー 1枚だけ**。他10枚は版履歴を1枚ずつ確認した結果:

| カード | 英語版履歴 | 判定 |
|---|---|---|
| 悪魔祓い | 2017 のみ | 変更なし |
| 忠犬 | 2017 / 2021印刷（**本文完全一致**） | 変更なし |
| 愚者 | 2017 / 2021印刷（**コンマ→コロン**） | 文言のみ |
| ゴーストタウン | 2017 のみ | 変更なし |
| 守護者 | 2017 / 2021印刷（同文）/ **2022-06 で語順入替** | 文言のみ（未印刷） |
| 偶像 | 2017 / **2021印刷で書き換え** | 文言のみ |
| レプラコーン | 2017 のみ（ただし §B-9 注） | 機能変更なし |
| 修道院 | 2017 / 2021印刷（**本文完全一致**） | 変更なし |
| **ネクロマンサー** | 2017 / **2021印刷で機能変更** | ★**機能変更** |
| 夜警 | 2017 / 2021印刷（**本文完全一致**） | 変更なし |
| ピクシー | 2017 のみ | 変更なし |

### (D) コストの独立検証
英語wiki の Nocturne ナビボックス（カードをコスト別に並べた一覧）で**11種すべてを突き合わせた**
＝カード個別ページの Cost 欄とは別系統の裏取り。逐語:

> `[$2]` Druid • Faithful Hound • **Guardian** • **Monastery** • **Pixie** (Goat) • Tracker (Pouch)
> `[$2*]` Imp
> `[$3]` Changeling • **Fool** (Lost in the Woods • Lucky Coin) • **Ghost Town** • **Leprechaun** • **Night Watchman** • Secret Cave (Magic Lamp)
> `[$4]` Bard • Blessed Village • Cemetery (Haunted Mirror) • Conclave • Devil's Workshop • **Exorcist** • **Necromancer** (Zombies: Apprentice • Mason • Spy) • Shepherd (Pasture) • Skulk
> `[$4*]` Ghost
> `[$5]` Cobbler • Crypt • Cursed Village • Den of Sin • **Idol** • Pooka (Cursed Gold) • Sacred Grove • Tormentor • Tragic Hero • Vampire (Bat) • Werewolf

⚠ **括弧内は「そのカードに付く家宝」であって、括弧内のカードのコストではない**
（ヤギが `[$2]` の行にあるのはピクシーが $2 だから。ヤギ自身のコストは別途 `$2`、
幸運のコインは `[$3]` の行にあるが自身は **`$4`**）。ここは取り違えやすい。

---

## B-1. Exorcist ／ 悪魔祓い

- **コスト**: `$4`
- **種別**: 夜行（Night）
- **日本語テキスト**:
```
手札1枚を廃棄する。廃棄したカードよりコストの低い精霊カード1枚を、精霊の山のいずれか1つから獲得する。
```
- **英語原文（逐語・2017年版のみ＝変更なし）**:
> Trash a card from your hand. Gain a cheaper Spirit from one of the Spirit piles.
- **公式FAQ（逐語）**:
> The Spirits are Will-o'-Wisp, Imp, and Ghost.
> If for example you trash a Silver, you can gain a Will-o'-Wisp or Imp, as those both cost less than Silver.

### 実装注意
- **「cheaper」は厳密により安い**（component-wise strictly less）。銀貨($3)の例が決定打＝
  ウィル・オ・ウィスプ($0)とインプ($2)は取れるが幽霊($4)は取れない。
  → **`DOM.engine.costUnder` を使う**（素の `cost <` を書かない＝§6 の mix-all 硬化ルール）。
- **★下書きから格上げ**: 「$0のカード（銅貨）を廃棄すると何も獲得できない」は**推論ではなく明示されている**。
  wiki 戦略節の逐語:
  > its trash-for-benefit effect makes it better at trashing Estates or Shelters than cards costing `[$0]`
  > (most notably your starting Coppers), **for which it provides no additional benefit**.

  ⇒ 屋敷($2)→ウィル・オ・ウィスプのみ。$5以上→3種すべて可。**confidence: high**。
- **廃棄も獲得も強制**（"may" が無い）。ただし**どの山から取るかはプレイヤーが選ぶ**。
  手札0枚なら廃棄も獲得も起きない＝**pending を立てない**（CPU無限ループ防止）。
  廃棄した結果 候補ゼロ（銅貨を廃棄）でも**窓を閉じる終端保証**を engine 側に書く（§0-26 の教訓）。
- **精霊3種**（ルールブック構成表の逐語 `13 of Imp` / `12 each of Will-o'-Wisp, Wish` / `6 each of Ghost, …`）:

  | 精霊 | コスト | 枚数 | 種別 |
  |---|---|---|---|
  | ウィル・オ・ウィスプ | `$0` | **12** | アクション・精霊 |
  | インプ | `$2` | **13** | アクション・精霊 |
  | 幽霊 | `$4` | **6** | アクション・持続・精霊 |

  すべて**非サプライ**＝`NON_SUPPLY` 登録＋**§6 の4系統除外チェックリスト**
  （`emptyPileCount` / `canBuyCard` / `blackMarket` 母集団 / 汎用獲得の engine `*_GAIN` と CPU `bestGain`・`bestGainExact`）を必ず通す。
- **セットアップ（ルールブック逐語）**:
  > and if Exorcist is being used, put all three Spirit piles - Will-o'-Wisp, Imp, and Ghost - near the Supply.

  ⚠ **ただし「悪魔祓いがある時だけ精霊の山が出る」わけではない**。同じ段落の逐語:
  > If any Kingdom cards being used have the Fate type, shuffle the Boons and put them near the Supply,
  > and put the **Will-o'-Wisp pile** near the Supply also.
  > … If Devil's Workshop or Tormentor are being used, put the **Imp pile** near the Supply;
  > if Cemetery is being used, put the **Ghost pile** near the Supply;

  ⇒ **山の設置条件は山ごとに独立**（移動動物園の `DOM.HORSE_GIVERS` と同型で `SPIRIT_GIVERS` 的に持つ）。
  B群では**愚者・偶像・ピクシーが幸運（Fate）なので、悪魔祓いが無くてもウィル・オ・ウィスプの山は出る**。
- confidence: **high**

---

## B-2. Faithful Hound ／ 忠犬

- **コスト**: `$2`
- **種別**: アクション・リアクション（Action - Reaction）
- **日本語テキスト**:
```
+2 カード
————
これをクリーンアップフェイズ以外で捨て札にするとき、これを脇に置いてもよい。
そうした場合、このターンの終了時にこれを手札に加える。
```
- **英語原文（逐語・2017年版と2021年印刷版が完全一致＝変更なし）**:
> +2 Cards
> When you discard this other than during Clean-up, you may set it aside, and put it into your hand at end of turn.
- **公式FAQ（逐語・全7項）**:
> "End of turn" is after drawing in Clean-up.
> The Reaction ability can happen on your turn and on other players' turns; if for example you discard Faithful Hound to another player's Raider, you can set it aside and return it to your hand at the end of that turn.
> Faithful Hound does not have to be in your hand for the ability to work; for example you can set it aside when it is discarded from your deck due to Night Watchman.
> The ability does not work if Faithful Hound is put into your discard pile without being discarded; for example nothing special happens when you gain Faithful Hound, or put your deck into your discard pile with Scavenger (from Dark Ages).
> The ability does not do anything during Clean-up.
> Setting Faithful Hound aside is optional.
> You cannot choose to discard Faithful Hound without something telling you to discard.
- **その他の裁定（逐語）**:
> If you discard Faithful Hound with Vassal and choose to set it aside, Vassal will fail to play it.

### 実装注意
- **【本エンジン最大の罠】「ターンの終了時」＝クリーンアップの“ドローの後”**。
  本エンジンの `cleanupAndAdvance` は**自分の手番終了時に次の手札を先引きする**ので、
  **自分のターンに捨てた忠犬は「先引き5枚の後」に手札へ戻る＝手札6枚**になる。
  §0-22 の角笛（＝先引きより**前**）とは**逆側**なので取り違えないこと。
- **相手のターンに捨てた場合は「その相手のターンの終了時」**（自分の手番を待たない）＝FAQ の Raider の例。
  ⇒ `cleanupAndAdvance` の中で、手番プレイヤーの先引きと同じ位置で**全プレイヤーぶんの脇置き忠犬を回収**する。
- **手札からとは限らない**＝**山札から捨てられても発動する**（夜警・家臣・神託など）。
  ⚠ 本プロジェクトは `.discard.push(` が engine 全体に **113箇所**あり、移動動物園の `triggerOnDiscard` は
  移動動物園内の経路にしか配線されていない（§0-25 の既知簡略化）。
  **忠犬を入れるなら捨て札フックの横断整備が要る**（さもないと村有緑地/坑道と同じ穴が空く）。
- **「捨て札置き場に置かれる」だけでは発動しない**（獲得／清掃で山札→捨て札）。**クリーンアップ中は不発**。**任意**。
- **家臣（vassal）で捨てて脇に置くと、家臣はそれをプレイできなくなる**（本プロジェクトは家臣 実装済み＝要対応）。
- 脇置きは**物理カード**＝新ゾーンを `allCards` と invariants の `ZONES` に追加すること。
- **リアクションだが免疫にはならない**（アタックを受けないわけではない）。
- confidence: **high**（英語）／日本語文面は §B-12 の注記

---

## B-3. Fool ／ 愚者

- **コスト**: `$3`
- **種別**: アクション・幸運（Action - Fate）
- **日本語テキスト**:
```
あなたが森の迷子を持っていない場合、それを受け取り、祝福3枚を取り、好きな順番でその祝福を受ける。
————
家宝: 幸運のコイン
```
- **英語原文（逐語・現行＝2021年印刷版）**:
> If you aren't the player with Lost in the Woods: take it, take 3 Boons, and receive the Boons in any order.
> Heirloom: Lucky Coin
- **変更点**: 2017年版は `…Lost in the Woods, take it, …`（**コンマ**）。2021年印刷版で**コロン**。
  `2021 Errata` の「Cosmetic card changes」節に逐語で載っている:
  > Fool — Change a comma to a colon.

  ⇒ **句読点のみ＝機能同一**。
- **公式FAQ（逐語）**:
> If you have Lost in the Woods, playing Fool does nothing.
> If you do not have Lost in the Woods, you take it - even from another player, if another player has it - and also take 3 Boons and receive them in the order you choose (discarding them when receiving them, or in Clean-up as appropriate).
> You do not need to pick the full order in advance - pick one to resolve, then after resolving it pick another to resolve.
> The player with Lost in the Woods (if any) can optionally discard a card to receive a Boon, at the start of each of their turns.
> In games using Fool, replace one of your starting Coppers with a Lucky Coin.

### 森の迷子（Lost in the Woods）＝状態（State）
- **状態テキスト（逐語）**: `At the start of your turn, you may discard a card to receive a Boon.`
- **公式FAQ（逐語）**:
  > The two sides are the same; use either.
  > Using the ability is optional.
  > Lost in the Woods stays in front of you turn after turn, until another player takes it with a Fool.
- **ゲーム中に1枚しか存在しない**（構成表の逐語 `1 of Lost in the Woods`／ルールブック逐語
  `Lost in the Woods affects one player's turns until another player takes it`）＝**相手から奪う**。
- **状態は「カード」ではない**（§B-11）。⇒ **トップレベルの公開スカラー
  `state.lostInTheWoods = 席番号 | null`**（`state.pileVP` / `state.artifacts` と同型・保存則tally対象外）。

### 実装注意
- **既に自分が持っていたら完全に無効**（祝福3枚も取れない・カード文の条件節が全体に掛かる）。
- **祝福3枚は先に3枚取ってから、1つずつ順番を選んで解決する**。
  FAQ が「全順序を先に決めなくてよい＝1つ解決してから次を選ぶ」と明示＝
  **`pending` をキューで回す**（3枚を手前に置いた状態で1つずつ選ばせる）。
  3枚同時に手元にあるので `The Field's Gift` 等の「クリーンアップまで手元に置く」祝福とも整合する。
- **森の迷子の能力はターン開始時**＝`t.startQueue` に積む（`state.pending` を直接立てない＝§0-22 の注意点）。
  **任意**・**手札1枚を捨てる**（捨て札トリガーが発火する）。
- **家宝 幸運のコイン（Lucky Coin）**: `$4`・**財宝・家宝**・非サプライ・6枚。
  現行テキスト逐語 `[$1]` / `Gain a Silver.`（2017年版は `When you play this, gain a Silver.` ＝文言のみ）。
  日本語 `+1 コイン` / `銀貨1枚を獲得する。`
  **公式FAQ 逐語**: `You can choose not to play Lucky Coin, and thus not gain a Silver.`
  ⇒ **出さない選択ができる**。`PLAY_ALL_TREASURES` で機械的に出し切ると忠実性が落ちる
  （`playAllOrder` の扱いを要検討＝§0-24 で作った並び順の正本）。
- **家宝は開始時の銅貨1枚と置き換える**（ルールブック逐語）:
  > If any Kingdom cards being used have a yellow banner indicating an Heirloom, players start the game with that Heirloom replacing what would normally be a Copper. For example in a game with Pixie and Tracker, players start with 3 Estates, 5 Coppers, a Goat, and a Pouch. The unused Coppers go in the Copper pile.

  ⇒ 暗黒時代の避難所（`opts.shelters`）と同型の開始デッキ置換。**家宝は各6枚**（構成表 `6 each of …`）。
- ⚠ `————` の下の `家宝: 幸運のコイン` は、正確には**カード下部の黄色い帯（banner）**であって
  通常の区切り線の下のテキストではない（ルールブック逐語 `cards with a yellow banner saying "Heirloom" and naming a card`）。
  表示上どう描くかは実装判断。
- confidence: **high**

---

## B-4. Ghost Town ／ ゴーストタウン

- **コスト**: `$3`
- **種別**: 夜行・持続（Night - Duration）
- **日本語テキスト**:
```
あなたの次のターンの開始時に、+1 カード および +1 アクション。
————
これは（捨て札置き場ではなく）手札に獲得する。
```
- **英語原文（逐語・2017年版のみ＝変更なし）**:
> At the start of your next turn, +1 Card and +1 Action.
> This is gained to your hand (instead of your discard pile).
- **公式FAQ（逐語）**:
> Since Night is after the Buy phase, normally you can play this the turn you buy it.
- **その他の裁定（逐語）**:
> If you gain this onto your deck (with e.g. Armory), you didn't gain it to your discard pile, so Ghost Town's ability doesn't trigger and it stays on your deck.

### 実装注意
- **獲得先の置換は「捨て札置き場に行くはずだった獲得」に限る**。山札の上に獲得する効果
  （武器庫・追跡者・物見やぐら等）が優先されたら**手札に来ない**。
  ⇒ **`dest === 'discard'` のときだけ手札へ移す**。ルネサンスの彫刻家×遊牧民の野営地で作った
  既存の分岐（`triggerOnGain` の `dest !== 'hand'` 判定）と同じ形。
- 夜フェイズは購入フェイズの後なので**買ったターンにそのまま出せる**。
- 持続なので `armDuration` で次ターン開始時に `+1 カード` `+1 アクション`。
  **夜行はアクション権を消費せず出せるので実質+1アクション増**（wiki 戦略節が明記）。
- **`+1 アクション` は `addActions()` を通す**（§0-25 の雪深い村／`t.actions += n` 直書き禁止）。
- confidence: **high**

---

## B-5. Guardian ／ 守護者

- **コスト**: `$2`
- **種別**: 夜行・持続（Night - Duration）
- **日本語テキスト**:
```
あなたの次のターンの開始時に、+1 コイン。
それまでの間、他のプレイヤーがアタックカードを使用するとき、あなたはその影響を受けない。
————
これは（捨て札置き場ではなく）手札に獲得する。
```
- **英語原文（逐語・現行＝2022年6月 Temple Gates／デジタル）**:
> At the start of your next turn, +$1. Until then, when another player plays an Attack card, it doesn't affect you.
> This is gained to your hand (instead of your discard pile).
- **変更点**: 2017年版**および2021年印刷版**は
  `Until your next turn, when another player plays an Attack card, it doesn't affect you. At the start of your next turn, +$1.`
  ＝**語順が逆**。2022年6月に「At X do Y. Until then Z」の書式へ統一（版履歴の Notes 欄 逐語 `Prefer "At X do Y. Until then Z"`）。
  **紙のカードは未反映**（Print 欄が `Not printed yet`）。日本語版カードも2017年順
  （wikiwiki.jp 逐語 `次ターン開始時までアタック効果を受けない / 次ターン開始時+1●`）。**機能は完全に同一**。
- **公式FAQ（逐語）**:
> Since Night is after the Buy phase, normally you can play this the turn you buy it.
> When you play Guardian, you are unaffected by Attack cards other players play between then and your next turn (even if you want one to affect you).
> Guardian does not prevent you from using Reactions when other players play Attacks.
- **その他の裁定（逐語）**:
> If you gain this onto your deck (with e.g. Armory), you didn't gain it to your discard pile, so Guardian's ability doesn't trigger and it stays on your deck.
> This protects you for the rest of the turn when you play it. So if after playing a Guardian, you gain a Duchy with Vampire, this will protect you from another player's Black Cat.
> This offers no protection during your next turn. This means that on the turn after you play a Guardian, you can still get attacked by another player's Black Cat.

### 実装注意
- **【最重要】灯台（Lighthouse）と免疫の窓が違う。灯台の述語を流用すると1ターンぶん過剰に守る。**
  自分で灯台の現行テキストを引いて確認した:

  | | 条件文 | 窓の終わり | 自分の次のターン中 |
  |---|---|---|---|
  | 灯台 | `While this is in play, …` | **場を離れるまで**（＝次の自分のターンのクリーンアップ） | **守られる** |
  | **守護者** | `… Until then, …`（then＝次のターンの開始時） | **次の自分のターンの開始時** | **守られない** |

  wiki が守護者側で明示している（上記 `This offers no protection during your next turn.`）。
  ⇒ 既存 `attackImmune` に**灯台とは別の述語**として足すこと。
- **免疫は「使用したそのターンの残り」もカバーする**（夜フェイズ以降に自分の獲得が相手のリアクション型
  アタック＝黒猫 を誘発した場合）。
- **免疫であってもリアクションは使える**（堀を公開して別の利益を得るのは妨げない）。
- **「受けたくない」場合でも拒否できない**（`even if you want one to affect you` ＝強制免疫）。
- 獲得先の置換は §B-4 と同じ注意（`dest === 'discard'` のときだけ）。
- `+1 コイン` は **`addCoins()` を通す**（§0-25 のカメレオン／`t.coins += n` 直書き禁止）。
- confidence: **high**

---

## B-6. Idol ／ 偶像

- **コスト**: `$5`
- **種別**: 財宝・アタック・幸運（Treasure - Attack - Fate）
- **日本語テキスト**:
```
+2 コイン
場にある偶像（これを含む）が奇数枚の場合、祝福1つを受ける。
そうでない場合、他のプレイヤーは全員、呪い1枚を獲得する。
```
- **英語原文（逐語・現行＝2021年印刷版）**:
> $2
> If you have an odd number of Idols in play (counting this), receive a Boon; otherwise, each other player gains a Curse.
- **変更点**: 2017年版は
  `$2 / When you play this, if you then have an odd number of Idols in play, receive a Boon; if an even number, each other player gains a Curse.`
  ⇒ 2021年印刷版で `(counting this)` を明示し「When you play this / if you then」を整理。**機能同一**。
  ⚠ **日本語版カードは2017年の文面**（wikiwiki.jp 逐語 `奇数枚の偶像が場に出ている場合祝福を受ける / 偶数枚の場合は他プレイヤーは呪い1枚を獲得`）。
- **公式FAQ（逐語）**:
> Idol cares how many Idols you have in play, not how many you have played this turn; some cards can make those numbers different (e.g. Counterfeit from Dark Ages).
> If you have one Idol in play, you receive a Boon, if two, the other players gain a Curse, if three, you receive a Boon, and so on.
- **その他の裁定（逐語）**:
> As with all Treasures, you play Idols one at a time.
> If there are no Curses in the Supply, you can't choose to receive a Boon instead.
> Receiving either The Sea's Gift or The Wind's Gift may draw you Actions that you normally can't play in your Buy phase.

### 実装注意
- **「場にある偶像の枚数」で判定する（プレイした回数ではない）**。
  偽造通貨（counterfeit）で偶像を2回使うと**場の偶像は1枚のまま＝祝福を2回受けて呪いは配らない**。
  ⇒ **`applyTreasureEffect` に書くこと**（§0-15 で新設）。`applyEffect` に書くと財宝では呼ばれず
  空振りする（§0-25 で備蓄品/配給品を applyEffect に書いて踏んだ罠）。
  冠/ティアラ/偽造通貨の2回目は `treasure_replay` が `applyTreasureEffect` を通るので、
  **枚数判定は自動的に正しくなる**。
- **呪い山が空でも「祝福を受ける」に切り替えられない**（偶数枚なら何も起きない）。
- **アタックなので堀／灯台／守護者の免疫窓が要る**（`ATTACKS` 登録＋`*EnterVictim`＋react窓）。
  財宝がアタックなのは既存の**遺物（relic・冒険）と同型**＝`playTreasureCard` から pending を立て、
  `PLAY_ALL_TREASURES` は中断して `playAllResume` で再開する（§0-24）。
- **`+2 コイン` は `addCoins()` を通す**。
- 祝福で `The Sea's Gift`（+1カード）や `The Wind's Gift` を受けると
  **購入フェイズなのにアクションが手札に来る**（使えない）＝正常。
- confidence: **high**

---

## B-7. Leprechaun ／ レプラコーン

- **コスト**: `$3`
- **種別**: アクション・不運（Action - Doom）
- **日本語テキスト**:
```
金貨1枚を獲得する。場にあるカードがちょうど7枚の場合、願い1枚をその山から獲得する。
そうでない場合、呪詛1つを受ける。
```
- **英語原文（逐語）**:
> Gain a Gold. If you have exactly 7 cards in play, gain a Wish from its pile. Otherwise, receive a Hex.
- **公式FAQ（逐語）**:
> Cards you have in play normally include Leprechaun itself, other cards you have played this turn, and Duration cards from previous turns that have not removed themselves from play.
> Cards that were in play but no longer are - e.g. a Pixie you trashed - do not count.
- **その他の裁定（逐語・実装上きわめて重要）**:
> This checks for the number of cards you have in play **after gaining the Gold**. This means that if you have 6 cards in play (including the Leprechaun), you can react to the gained Gold with a Sheepdog, and that will count for the Wish.

### 実装注意
- **順序が厳密**: ①金貨を獲得 → ②**その後**に場の枚数を数える → ③ちょうど7枚なら願い、それ以外は呪詛。
  金貨の獲得で**牧羊犬（sheepdog・移動動物園／実装済み）が場に出る**と、その1枚が7枚目に数えられる。
  ⇒ **獲得時リアクションを解決し終えてから枚数を数える**。`state.onGainQueue` を使い、
  **キューが空になってから**判定すること
  （§0-26 の「複数枚を獲得する効果の後に `state.pending` を直接代入しない」と同じ罠）。
- 「場にあるカード」＝ `p.inPlay` ＋ **前のターンから残っている持続カード `p.durationCards`**。
  **場を離れたカードは数えない**（廃棄したピクシー等）。
  ※ ルールブック(2017)は `and sometimes Duration cards from previous turns`、
  現行wikiは `Duration cards from previous turns that have not removed themselves from play` ＝同義の言い換え。
- **ちょうど7枚**（`===`）。**多くても少なくても呪詛**。
- **願い（Wish）**: `$0`・**アクション**（※**精霊ではない**）・非サプライ・**12枚**。
  テキスト逐語:
  > +1 Action / Return this to its pile. If you did, gain a card to your hand costing up to `[$6]`. / (This is not in the Supply.)

  日本語 `+1 アクション` / `これを願いの山に戻す。そうした場合、コスト6以下のカード1枚を獲得し、手札に加える。`
  **公式FAQ 逐語**:
  > You only gain a card if you actually returned Wish to its pile.
  > **A card you gain that would normally go somewhere else, like Nomad Camp (from Hinterlands), goes to your hand.**

  ★**下書きが落としていた裁定**。本プロジェクトは遊牧民の野営地（nomad_camp）実装済み＝
  「手札に獲得」が他の獲得先置換に**勝つ**。彫刻家で作った既存分岐と同じ扱いにすること。
- **セットアップ（ルールブック逐語）**:
  > If Leprechaun or Secret Cave is being used, put the Wish pile near the Supply.

  ⇒ **レプラコーンか秘密の洞窟がある場合のみ**（移動動物園の `DOM.HORSE_GIVERS` と同型）。
- **不運（Doom）なので準備で呪詛をシャッフルし、Deluded/Envious・Miserable/Twice Miserable も用意する**
  （ルールブック逐語 `If any have the Doom type, shuffle the Hexes and put them near the Supply, and put Deluded/Envious and Miserable/Twice Miserable near the Supply also.`）。
- confidence: **high**

---

## B-8. Monastery ／ 修道院

- **コスト**: `$2`
- **種別**: 夜行（Night）
- **日本語テキスト**:
```
このターンにあなたが獲得したカード1枚につき、手札1枚または場にある銅貨1枚を廃棄してもよい。
```
- **英語原文（逐語・2017年版と2021年印刷版が完全一致＝変更なし）**:
> For each card you've gained this turn, you may trash a card from your hand or a Copper you have in play.
- **公式FAQ（逐語）**:
> For example if you have gained three cards, you may trash up to three cards, with each being either a card from your hand or a Copper you have in play, in any combination.
> Normally, bought cards are then gained, but cards exchanged for (such as Vampire exchanging for Bat) are not gained.
- **その他の裁定（逐語）**:
> Cards are trashed one at a time. This matters if one of the cards you trashed draws another card; such cards drawn in the middle of trashing can be trashed by Monastery.
> Gaining cards while you trash to Monastery (for example, if you trash a Hunting Grounds) does not let you trash additional cards; you can only trash a number of cards equal to the number of cards gained that turn prior to playing Monastery.

### 実装注意
- **上限は「修道院を使用した時点までに このターン獲得した枚数」で固定**。
  廃棄の途中で獲得が起きても（狩場の on-trash 等）**上限は増えない** ⇒ **pending に `max` を焼き込む**。
- **1枚ずつ廃棄する** ⇒ 途中でドローが起きたら（ネズミ等）**その引いたカードも廃棄対象にできる**。
  「最初に全部選ばせる」UIにすると忠実性が落ちる。**1枚ずつのループ pending** を推奨。
- 対象は「**手札の任意のカード**」または「**場にある銅貨**」。混在可・**任意**（0枚でよい）。
- **場の銅貨を廃棄しても、そのターン既に得たコインは失われない**
  （wiki 冒頭 逐語 `meaning you can get [$] out of your Coppers and still trash them on the same turn`）。
- **「獲得」の数え方**: 購入で得たカードは獲得に数える。**交換（exchange）は獲得ではない**。
  ルールブック逐語:
  > The card being exchanged is returned to its Supply pile, or non-Supply pile, and the card being exchanged for is taken and put into the player's discard pile. **This does not count as gaining a card.**

  ⇒ 吸血鬼→コウモリ、取り替え子、冒険のトラベラー成長（本プロジェクトは既に「獲得でも廃棄でもない」実装＝§0-9）。
  既存の **`t.gainedThisTurn`**（帝国の凱旋で使用）がそのまま使える。
- **夜フェイズなので購入で獲得したカードもすでに数に入っている**
  （ルールブックの Avery の例＝銀貨・悪人のアジト・悪人のアジトの3枚を獲得済みで修道院を使い、場の銅貨1枚を廃棄している）。
- **廃棄は `trashCard(state, owner, card)` を通す**（墓/下水道/城塞 等の on-trash 配線＝§0-8）。
- confidence: **high**

---

## B-9. Necromancer ／ ネクロマンサー ★B群で唯一の機能エラッタ

- **コスト**: `$4`
- **種別**: アクション（Action）
- **日本語テキスト**:
```
廃棄置き場にある、表向きで持続ではないアクションカード1枚を選ぶ。
それをこのターンの間 裏向きにし、廃棄置き場に置いたまま使用する。
————
準備：ゾンビ3枚を廃棄置き場に置く。
```
- **英語原文（逐語・現行＝2021年印刷版）**:
> Choose a face up, non-Duration Action card in the trash. Turn it face down for the turn, and play it, leaving it there.
> Setup: Put the 3 Zombies into the trash.
- **★機能エラッタ**: 2017年版は
  > Play a face up, non-Duration Action card from the trash, leaving it there and turning it face down for the turn.

  `2021 Errata`「Functional card changes」節の逐語:
  > **Necromancer — Now turns the chosen card face down before playing it to prevent loops.**

  `Errata`（年別ページ）の逐語:
  > Necromancer turns the chosen card face down before playing it instead of after.

  ⇒ **「裏返す → 使用する」の順で実装すること**。旧文だと使用の解決中はまだ表向きなので、
  ネクロマンサーがネクロマンサーを使うと**同じカードを再選択できて無限ループになる**。
  ★**下書きは「理由の説明は推論（medium）」としていたが、`to prevent loops` と一次資料に明記されている＝high**。
- **★年の帰属（下書きの訂正）**: wiki 内で食い違う。
  `All Errata` の Nocturne 節は `Necromancer — Turn the card face down before playing it (**2020**).`、
  一方 年別 `Errata` ページではこの変更は **2021 Errata の節**に置かれ、
  版履歴の印刷は **January 2021（2021年印刷版）**。
  ⇒ **「2020年にオンラインで告知 → 2021年1月の印刷版に反映」と書くのが安全**。
  「2020エラッタ」と単独で書くと版履歴と食い違って見える。
- **公式FAQ（2021・逐語）**:
> This plays a non-Duration Action card from the trash.
> Normally it can at least play one of the three Zombies, since they start the game in the trash.
> It can play other Action cards that make their way into the trash too.
> The played cards are turned over, to track that each can only be used once per turn this way; at end of turn, turn them back face up.
> Necromancer can play another Necromancer, though normally that will not be useful.
> The Action card stays in the trash; if an effect tries to move it, such as Encampment (from Empires) returning to the Supply, it will fail to move it.
> Necromancer can be used on a card that trashes itself when played; if the card checks to see if it was trashed (such as Pixie), it was not, but if the card does not check (such as Tragic Hero), it will function normally.
> Since the played card is not in play, "while this is in play" abilities (such as Tracker's) will not do anything.
- **その他の裁定（逐語）**:
> Face-down cards in the trash can still be interacted with by cards other than Necromancer, such as Lurker, and you can still look at them if you want to know what they are.
> The restriction on movement only applies to effects that would have moved the card out of the play area if it were played normally, for example, Island will fail to move itself out of the trash and onto your Island Mat, although any other effect will still apply, such as moving a card from your hand onto your Island Mat; if a card is looking to move a card out of the trash, it may move itself - thus, if you choose to play a Lurker, Graverobber or Rogue in the trash, it can gain itself out of the trash as a result.
> If a face-down card in the trash is gained, and then later trashed in the same turn, it is returned to the trash face-up, meaning another Necromancer may play it.
> Attempting to trash a card in the trash doesn't count as trashing. So if you try to trash a Tragic Hero in the trash, you won't gain any [VP] from Tomb, and it won't activate Sewers.
> If Necromancer plays a Throne Room variant that then plays a Duration card, the Necromancer stays in play as long as the Duration does.
> **Unlike Band of Misfits, Necromancer can play Command cards from the trash.**
- wiki 冒頭の逐語（1ターンに複数回使うときの制約）:
> If you play multiple Necromancers in one turn, you have to choose a different trashed Action each time.

### 実装注意（本プロジェクトへの落とし込み）
- **§0-17 の命令（Command）機構がほぼそのまま使える**＝「カードを動かさずに使用する」
  ⇒ `playAsCommand` / `takeSelf` / `playedByCommand` / `pendingSelf`。
- ⚠ **ただしネクロマンサーは Command 種別を持たない**（上記逐語）
  ⇒ **大君主・はみだし者・船長・王子を廃棄置き場から使用できる**。
  `playAsCommand` の「命令は命令をプレイできない」ガードを**ネクロマンサーには適用しないこと**。
- **裏向きフラグは廃棄置き場の“物理カード1枚ずつ”に付く**。`state.trash` は id 配列なので、
  **同名が複数あっても1枚ずつ独立に裏返す**（廃棄置き場にネクロマンサーが2枚あれば同ターンに両方使える）
  ⇒ **インデックス基準の集合**（例 `t.trashFaceDown = [index, …]`）。
  **ターン終了時に全部表向きに戻す**（`freshTurn`）。
- **持続カードは選べない**（追跡不能のため。Secret History 逐語 `Not working on Duration cards was a late change; there's no tracking there, which is awful.`）。
- **「これ」の自己移動はすべて失敗する**（§0-17 の `takeSelf` と同じ）。
  ただし**移動そのものだけが失われ、残りの効果は起きる**
  （島＝自分は動かないが手札1枚は島マットへ／ピクシーは「廃棄したか」を見るので祝福を2回受けられない／
  悲劇のヒーローは見ないので財宝を獲得できる）。
- **廃棄置き場から自分を「獲得」する効果は成功する**（待ち伏せ・墓暴き・盗賊）＝「外へ出す」方向は別扱い。
- **裏向きのカードが獲得され、同ターンに再び廃棄されると表向きで戻る**＝別のネクロマンサーが使える。
- **廃棄置き場のカードを「廃棄」しようとしても廃棄にならない**（墓の+1VP・下水道が発動しない）。
- **「場にある間」の能力は働かない**（追跡者・街道・パトロン等）＝場に出さない。
- **玉座の間系を使用させ、それが持続を使用したら、ネクロマンサーは持続と一緒に場に残る**。
- **セットアップ**: **ゾンビ3枚を1枚ずつ**（ゾンビの弟子／ゾンビの石工／ゾンビの密偵・アクション-ゾンビ・非サプライ）
  を**ゲーム開始時に廃棄置き場に置く**（ルールブック逐語 `If Necromancer is being used, put the three Zombies into the trash.`／
  構成表 `3 Zombies - Zombie Apprentice, Zombie Mason, Zombie Spy`）。
  ⇒ `createInitialState` で `state.trash` に3枚積む。**保存則 tally に数える**（廃棄置き場は既に数えている）。
  **山ではないので `emptyPileCount`／3山終了には無関係**。
- **【将来の無限ループ注意】** 略奪（Plunder）実装後に「Necromancer が Command 型を持たないこと」を突く
  無限ループが公式に報告されている（Reckless Band of Misfits → Sentinel → Lich → 無限 Tomb VP）。
  本プロジェクトは略奪未実装なので**現時点では到達不能**。Donald X. 逐語:
  > It's possible that Necromancer will become a Command card after all, whenever Nocturne next gets reprinted.
- confidence: **high**

---

## B-10. Night Watchman ／ 夜警

- **コスト**: `$3`
- **種別**: 夜行（Night）
- **日本語テキスト**:
```
あなたの山札の上から5枚を見る。好きな枚数を捨て札にし、残りを好きな順番で山札の上に戻す。
————
これは（捨て札置き場ではなく）手札に獲得する。
```
- **英語原文（逐語・2017年版と2021年印刷版が完全一致＝変更なし）**:
> Look at the top 5 cards of your deck, discard any number, and put the rest back in any order.
> This is gained to your hand (instead of your discard pile).
- **公式FAQ（逐語）**:
> Since Night is after the Buy phase, normally you can play this the turn you buy it.
- **その他の裁定（逐語）**:
> If you gain this onto your deck (with e.g. Armory), you didn't gain it to your discard pile, so Night Watchman's ability doesn't trigger and it stays on your deck.
> If you happen to put a card on top of your deck in the middle of resolving Night Watchman—for instance, by discarding a Tunnel, gaining a Gold, and top-decking it due to Progress—then when you return any remaining cards to your deck they will go on top of the card you just put there.

### 実装注意
- **「見る（look at）」であって「公開（reveal）」ではない**
  ⇒ **`reveal()` を通さないこと**（ルネサンスのパトロンが誤って+1財源を得る）。
  `{notReveal:true}` を付けるのではなく、そもそも `reveal` を呼ばない。
- **オンラインでは自分だけに見える私的情報** ⇒ **`maskStateFor` の対象**
  （冒険の偵察隊で踏んだ情報漏洩と同型＝§0-21 の [med]）。
- **捨てる途中で山札の上にカードが置かれたら、残りはその上に乗る**（トンネル→金貨→山札の上）。
  「先に全部抜いてから戻す」実装だと順序がずれる。**捨て札の解決 → その後に残りを戻す**の順を守る。
- 捨てる過程で**トンネル・忠犬・村有緑地・坑道**などの捨て札トリガーが発火する
  （§0-25 の既知簡略化＝捨て札フックが横断配線されていない点に注意。§B-2 と同じ課題）。
- 獲得先の置換は §B-4 と同じ注意（`dest === 'discard'` のときだけ）。
- 山札5枚未満ならシャッフルして補充（通常の「見る」と同じ）。
- confidence: **high**

---

## B-11. Pixie ／ ピクシー

- **コスト**: `$2`
- **種別**: アクション・幸運（Action - Fate）
- **日本語テキスト**:
```
+1 カード
+1 アクション
祝福の山の一番上を捨て札にする。これを廃棄して、その祝福を2回受けてもよい。
————
家宝: ヤギ
```
- **英語原文（逐語・2017年版のみ＝変更なし）**:
> +1 Card
> +1 Action
> Discard the top Boon. You may trash this to receive that Boon twice.
> Heirloom: Goat
- **公式FAQ（逐語・全2項）**:
> If you receive a Boon that says to keep it until Clean-up, move it to in front of you, and remember that you get it twice.
> In games using Pixie, replace one of your starting Coppers with a Goat.
- **関連裁定（ネクロマンサーのページ 逐語）**:
> Necromancer can be used on a card that trashes itself when played; if the card checks to see if it was trashed (such as Pixie), it was not …

### 実装注意
- **順序が特殊**: ①祝福の一番上を**先に捨て札にする（＝内容が見える）**
  → ②その内容を見てから「ピクシーを廃棄するか」を選ぶ → ③廃棄したらその祝福を**2回受ける**。
  **捨てるのは強制、廃棄は任意**。廃棄しなければ祝福は捨て札のまま（**受けない**）。
- **「クリーンアップまで手元に置く」祝福3種**（`The Field's Gift` / `The Forest's Gift` / `The River's Gift`）を
  2回受ける場合は、**捨て札置き場から自分の手前に移し、2回ぶんとして記録する**
  （例: 森の恵み＝+1購入+1コイン → +2購入+2コイン）。
- **「これを廃棄」は場のピクシー自身** ⇒ **§0-17 の `takeSelf` ガードが必須**。
  **ネクロマンサー／はみだし者／大君主／船長／王子 で使用した場合は場にいないので廃棄できず、
  祝福を受けられない**（＝祝福を捨てるだけ・祝福の山だけが減る）。
- **玉座の間で2回使うと祝福を2枚捨てる**（1枚目で廃棄せず2枚目で廃棄する、が可能）が、
  **1枚のピクシーで異なる2つの祝福を受けることはできない**（廃棄した時点で場から消える＝2回目は自己廃棄失敗）。
- **家宝 ヤギ（Goat）**: `$2`・**財宝・家宝**・非サプライ・6枚。
  現行テキスト逐語 `[$1]` / `You may trash a card from your hand.`
  （2017年版は `When you play this, you may trash a card from your hand.` ＝文言のみ）。
  日本語 `+1 コイン` / `手札1枚を廃棄してもよい。`
  **公式FAQ 逐語**（ルールブック）: `Goat: Trashing a card is optional.`
- 家宝は開始時の銅貨1枚と置き換える（ルールブックの例に `a Goat` が明示＝§B-3）。
- `+1 アクション` は `addActions()`、`+1 カード` は `draw()` を通す。
- confidence: **high**

---

## B-12. 横断メモ（B群共通・実装前に必読）

### 1. 夜フェイズ（Night phase）＝**横断影響が最も大きい設計判断**
ルールブック逐語:
> Nocturne adds Night cards and the Night phase. In games using Night cards, the Night phase happens after the Buy phase - **it goes, Action, Buy, Night, Clean-up**. In your Night phase, **you can play any number of Night cards**.

- **アクション権も購入権も消費しない・枚数無制限**。
- ⚠ 本プロジェクトの `t.phase` は `'action' | 'buy'` の2値。**`'night'` を足すと**
  帝国の**冠**（phase でモードを決める）・ピアッツァ・闘技場・**財宝ロック `t.treasuresLocked`**
  （§0-21 で「購入フェイズ単位」と決めた）の判定に影響する。
  `END_ACTION_PHASE` / `endBuyTail` の間に夜フェイズを差し込む形になる。
- **夜行カードは持続でなければクリーンアップで捨てる**（通常の場のカードと同じ）。

### 2. 「手札に獲得する」3枚（ゴーストタウン／守護者／夜警）
**捨て札置き場に行くはずだった獲得のときだけ**手札へ移す。
山札の上に獲得する効果が優先されたら**発動しない**（3枚とも wiki が同じ文で明記）。
既存の `zoneOf(p, dest)`（§0-23）と彫刻家の `dest !== 'hand'` 分岐が下敷き。
※ **願い（Wish）の「手札に獲得」は逆に他の置換に勝つ**（§B-7）。両者を混同しないこと。

### 3. 非サプライ山（§6 の4系統除外チェックリスト必須）

| 札 | コスト | 枚数 | 設置条件 |
|---|---|---|---|
| ウィル・オ・ウィスプ | `$0` | 12 | **幸運(Fate)カードがある**／悪魔祓い |
| インプ | `$2` | 13 | 悪魔の工房／迫害者／悪魔祓い |
| 幽霊 | `$4` | 6 | 墓地／悪魔祓い |
| 願い | `$0` | 12 | レプラコーンまたは秘密の洞窟 |
| ゾンビ3種 | — | 各1 | ネクロマンサー（**廃棄置き場に置く**・山ではない） |
| 家宝（ヤギ／幸運のコイン等） | $2/$4 | 各6 | 対応する王国カード（**開始デッキの銅貨と置換**） |

除外4系統＝`emptyPileCount`(3山終了) / `canBuyCard`(購入) / `blackMarket` 母集団 /
汎用獲得（engine の `*_GAIN` と CPU の `bestGain`・`bestGainExact`）。

### 4. 祝福・呪詛・状態は「カード」ではない
ルールブック逐語:
> Boons, Hexes, and States are never in a player's deck; like Events and Landmarks (from Adventures and Empires), they are physically cards but are not "cards" in game terms. They are thus never "cards in play," receiving Boons and Hexes or taking a State is not "gaining a card," and so on.

⇒ **保存則 tally に混ぜない**（`state.pileVP` / `state.artifacts` と同型）。
⇒ **レプラコーンの「場のカード7枚」にも数えない**。
⇒ 森の迷子を取るのは「獲得」ではない。

### 5. 新 pending は必ず4点セット＋終端保証
（engine reducer＋`PLAYER_ACTIONS`＋CPU `decidePending`＋UI `viewPendingModal`）。
B群だけで最低これだけ要る:
`exorcist_trash` / `exorcist_gain` / `faithful_hound_react` / `fool_boon_order` /
`lost_in_woods_discard` / `monastery_trash`（ループ）/ `necromancer_play` /
`night_watchman_sift` / `pixie_trash`
**CPU は候補ゼロでも `null` を返さない**（§0-26＝オンラインで `reduce(state, null)` が TypeError → 部屋が固まる）。

---

## B-13. 下書きからの訂正・追加（この節だけ読めば差分が分かる）

### 訂正した項目
1. **ネクロマンサーのエラッタ年**（下書き「2020エラッタ」）
   → wiki 内で帰属が割れている。`All Errata` は `(2020)`、年別 `Errata` と `2021 Errata` は**2021の節**、
   版履歴の印刷は **January 2021**。⇒ **「2020年告知／2021年1月印刷版で反映」**と両方書く形に修正。
2. **ネクロマンサーのエラッタ理由の確信度**（下書き「推論・medium」）
   → `2021 Errata` に **`to prevent loops`** と逐語で書いてある。⇒ **high** に格上げ。
3. **レプラコーン「単一版＝エラッタなし」**（下書き）
   → 版履歴は2017の1行だけだが、`2021 Errata` の「2021年1月の告知で新しい文面が示されたカード」一覧に
   **Leprechaun が入っている**（Nocturne: Tracker, Fool, Leprechaun, Devil's Workshop, Necromancer, Idol, …）。
   ⇒ **「機能変更なし」は維持しつつ、「単一版・エラッタ皆無」という断定は撤回**。
4. **悪魔祓いの $0 廃棄の確信度**（下書き「明示裁定は未確認・medium-high」）
   → wiki 戦略節に `cards costing [$0] …, for which it provides no additional benefit` と明示。⇒ **high**。
5. **悪魔祓いのセットアップの書き方**（下書き「悪魔祓いがある場合のみ3山とも用意する」）
   → 誤読を招く。**山の設置条件は山ごとに独立**で、幸運カードがあればウィル・オ・ウィスプの山は出る。
   B群の愚者・偶像・ピクシーが幸運なので**実際に頻繁に該当する**。⇒ 条件表（§B-12-3）に整理。

### 追加した（下書きが落としていた）裁定
6. **願いの「他の獲得先置換に勝つ」裁定**＝`A card you gain that would normally go somewhere else, like Nomad Camp, goes to your hand.`
   本プロジェクトは遊牧民の野営地 実装済み＝**実際に衝突する**。
7. **守護者 vs 灯台の免疫窓の差を一次資料で確定**。灯台の現行テキストを自分で引いて
   `While this is in play` であることを確認（＝**自分の次のターン中も守られる**）。
   守護者は `Until then`（＝次のターンの開始時で終わり）＝**守られない**。下書きの主張は正しかったが根拠が未提示だった。
8. **ネクロマンサーを1ターンに複数回使うときは毎回“別の物理カード”を選ぶ**（wiki 冒頭の逐語）。
9. **種別の日本語訳をホビージャパン公式サイトで裏取り**（下書きは wikiwiki.jp のみ）。
   併せて**日本語版初回ロットの《ドルイド》種別欄 文字抜け**という日本語固有のエラッタ情報も確認。

### 検証したが下書きが正しかった項目（変更なし）
- **コスト 11/11**（ナビボックスで独立に再検証）／**種別 11/11**／**現行カードテキスト 11/11**
- 公式FAQ の要点（悪魔祓い・忠犬・愚者・ゴーストタウン・守護者・偶像・レプラコーン・修道院・
  ネクロマンサー・夜警・ピクシー のすべて）
- 日本語公式名 11/11 ＋ ゴーストタウン／幸運のコイン／ヤギ／願い の4件の取り違え警告
- 非サプライ枚数（インプ13／ウィル・オ・ウィスプ12／願い12／幽霊6／家宝 各6／ゾンビ 各1）
- 家宝コスト（ヤギ `$2` ／幸運のコイン `$4`）・願いは**精霊ではなくアクション**
- 忠犬の「ターン終了時＝クリーンアップのドロー後」＝本エンジンの先引きとの関係（角笛と逆側）
- 偶像を `applyTreasureEffect` に書くこと・偶像は場の枚数で判定（偽造通貨で差が出る）
- レプラコーンは**金貨獲得の“後”**に場の枚数を数える（牧羊犬が7枚目になり得る）
- 修道院の上限固定・1枚ずつ廃棄・交換は獲得でない
- 守護者/ゴーストタウン/夜警 の「手札に獲得」は `dest === 'discard'` のときだけ

---

## B-14. 未解決事項（confidence が high でないもの）

1. **日本語カードの印刷文面そのものは未照合**（confidence: **medium**）。
   日本語**名**は wikiwiki.jp（ホビージャパン印刷版）で11種＋家宝2種すべて確認済み＝**high**。
   **種別訳**はホビージャパン公式サイトで確認済み＝**high**。
   しかし wikiwiki.jp が載せているのは**効果の要約**であってカードの印刷文面ではないため、
   本節の日本語テキストは**英語原文＋公式用語＋既存カタログ書式から起草したもの**。
   「これは（捨て札置き場ではなく）手札に獲得する。」「精霊の山のいずれか1つから」
   「祝福の山の一番上」等の言い回しは実物と異なる可能性がある。
2. **守護者・偶像は「現行英語（新語順/新文面）」と「日本語版カード（2017年文面）」が食い違う**。
   機能は同一なので実害はないが、**カード画像の文字をどちらで焼くかは方針決定が要る**
   （本節は指示どおり「現行を採用」で書いた）。守護者の新語順は**紙では未印刷**（`Not printed yet`）。
3. **レプラコーンが2021年に実際に文面変更を受けたのか**は確定できなかった（§B-13-3）。
   機能変更が無いことは版履歴・FAQ から確実。
4. **忠犬・ネクロマンサー等の区切り線（————）の有無は画像で未確認**。
   リアクション節・Setup節・on-gain節は標準的に区切り線の下（遊牧民の野営地 `This is gained onto your deck.` が
   同型の先例）と判断したが、カード画像での実測はしていない。
   ※ wiki の Errata は区切り線を追跡しており（Tracker に `(No dividing line.)` の注記がある）、
   B群にはその種の注記が無い＝標準レイアウトとみてよい。
5. **ゾンビ3枚・祝福12種・呪詛12種の個別テキストは本節の範囲外**（別担当）。
   愚者・偶像・ピクシー・レプラコーンの実装は**祝福/呪詛の受領機構が前提**なので、そちらと必ず突き合わせること。
   特に**クリーンアップまで手元に置く祝福3種はピクシーの「2回受ける」で特別扱いが要る**。
6. **森の迷子を `state` トップレベルに持つ設計は提案であって公式ルールではない**。
   「1枚しか存在せず奪い合う」ことと「状態はカードではない」ことは一次資料で確定済み。

---

# パート4：王国カード C群（プーカ〜人狼）

## C群：王国カード11種（＋家宝4種・コウモリ）＝敵対検証済み最終版

**この節の一次資料（すべて自分で開いて逐語確認した）**

| 資料 | 使い方 | 備考 |
|---|---|---|
| RGG 公式ルールブック（英語・実DL・pdftotext） | `nocturne_rulebook.txt`。**Official FAQ の正本** | **コイン記号・VP記号が脱落している**ので金額は必ず wiki で裏取りした |
| 英語wiki（Wayback経由・`python adv/wf.py <Page>`） | Card text / Official FAQ / Other rules clarifications / **Versions表（＝エラッタの正本）** | 記号は `[$4]` 形式で復元。**取得スナップショットを各ファイル1行目に記録した**（古いスナップショットを掴むとエラッタを見落とすため） |
| 英語wiki Errata各年ページ | **エラッタの年次帰属の正本** | `2019/2020/2021/2022/2025_Errata` |
| 日本語wiki（wikiwiki.jp/dominiondeck） | 日本語カードテキスト・詳細なルール | Dominion Online 訳 |
| **ホビージャパン公式 夜想曲 商品ページ** | **種別の日本語公式訳の正本** | 下記 |

**取得したスナップショット（この節の記述の根拠）**：Raider/Bat/Magic_Lamp=`2id_`(最新)、Pooka/Skulk/Vampire/Wish=`2025id_`、Shepherd/Cursed_Gold/Pasture=`2024id_`、Sacred_Grove/Tracker/Tragic_Hero=`2023id_`、Tormentor=`2022id_`、Secret_Cave/Werewolf=`2021id_`。**Secret Cave / Werewolf / Sacred Grove / Tragic Hero は 2021〜2023 スナップショットしか取れていない**が、Versions表に2017年版1種しか無い＝エラッタが存在しないカードなので影響なし（下の「エラッタ年表」で全16枚を Errata ページ側からも交差検証済み）。

---

### 種別の日本語公式訳（★ホビージャパン公式サイトの逐語で確定）

> 「このセットは500枚のカードからなり、33種の新たな王国カードを収録しています。購入フェイズが終わったあとにプレイできる**夜行カード**、初期デッキの銅貨と入れ替えて使用する**家宝カード**、**祝福**と**呪詛**をもたらす**幸運カード**と**不運カード**、他にも様々な新カードが登場します。」
> — ホビージャパン『ドミニオン：夜想曲』日本語版 商品ページ

したがって **Night=夜行 / Heirloom=家宝 / Boon=祝福 / Hex=呪詛 / Fate=幸運 / Doom=不運** で確定（＝日本語wikiの用語と完全一致）。
**タスク指示にあった候補「Fate=運命 / Doom=災い(呪縛)」は誤り**なので採用しないこと。
Duration=持続 / Attack=アタック / Reaction=リアクション / Treasure=財宝 / Victory=勝利点 / Action=アクション は既存どおり。

---

### 共通の前提（ルールブック逐語）

- **交換（exchange）**：*"The card being exchanged is returned to its Supply pile, or non-Supply pile, and the card being exchanged for is taken and put into the player's discard pile. **This does not count as gaining a card.** The exchange only happens if both cards can be exchanged; if the pile is empty, the cards are not exchanged."*
- **家宝（Heirloom）**：*"If any Kingdom cards being used have a yellow banner indicating an Heirloom, players start the game with that Heirloom **replacing what would normally be a Copper**. ... The unused Coppers go in the Copper pile."*（＝抜いた銅貨は銅貨の山へ戻す）
- **「Each other player receives the next Hex」**：*"turn over **just one Hex**, and the other players all follow the instructions on that same Hex."*（＝呪詛は1枚しかめくらない）
- **夜フェイズ**：*"the Night phase happens after the Buy phase - it goes, Action, Buy, Night, Clean-up. In your Night phase, you can play any number of Night cards."*
- **祝福の据え置き3種**：*"Received Boons normally go to the Boons discard pile, but three (The Field's Gift, The Forest's Gift, and The River's Gift) go in front of a player until that turn's Clean-up."*
- **非サプライ山の枚数**：Imp **13** ／ Will-o'-Wisp **12** ／ Wish **12** ／ **Bat 10** ／ Ghost 6。
- **山の設置条件**：*"If Vampire is being used, put the Bat pile near the Supply. If **Leprechaun or Secret Cave** is being used, put the Wish pile near the Supply. If **Devil's Workshop or Tormentor** are being used, put the Imp pile near the Supply."*
  （＝秘密の洞窟は家宝の魔法のランプ経由で願いを配るので、**秘密の洞窟だけでも願いの山が要る**）
- **持続の一般ルール（2017年版）**：*"if a Duration card is played multiple times by a card such as Throne Room, that card also stays in play until the Duration card is discarded"*

---

### 【重要・新規】2025 Errata が夜襲・秘密の洞窟に効く（下書きは「検証できていない」としていた）

英語wiki `2025_Errata` 逐語：

> **New rules** — "If a Duration card leaves play, it stops doing things on future turns. This also applies to **Throne Room variants** tracking repeated Durations."
> **Functional card changes** — "**Band of Misfits, Inheritance, Overlord — Can no longer play Duration cards.**"
> "**Way of the Mouse** — Can no longer set aside a Duration card."

**この節への波及**：
1. **夜襲・秘密の洞窟が場を離れたら、次のターンの `+$3` は発生しない**（玉座の間×馬の習性などで到達可能）。
2. **大君主／はみだし者／相続 は夜襲・秘密の洞窟を使用できない**。
   → 本プロジェクトは §0-17 で「公式カード文に non-Duration が無いので**除外は簡略化**」と記録していたが、**2025エラッタで除外が正解になった**（PROGRESS のその注記は更新すべき）。
3. ハツカネズミの習性も夜襲・秘密の洞窟を脇に置けない（§0-25 で対応済み）。

※本プロジェクトは §0-22 に「命令/王子がサプライの玉座の間で持続を2回使うと、2025の『場を離れた持続は以後働かない』に反して次ターンも2倍のまま」という**既知の許容簡略化**がある。夜襲・秘密の洞窟でも同じ簡略化が露出する。

---

### エラッタ年表（この16枚。Errata各年ページ＋各カードのVersions表で交差検証）

| カード | 年 | 内容 | 機能差 |
|---|---|---|---|
| Tormentor 迫害者 | **2019** | 「非サプライ札を名指しなら山から獲得できる」の一般ルール化 → `gain an Imp **from its pile**` → `gain an Imp` | **なし** |
| Magic Lamp 魔法のランプ | **2019** | 同上 → `gain 3 Wishes **from their pile**` → `gain 3 Wishes` | **なし** |
| Cursed Gold 呪われた金貨 | **2020** | 「財宝から *When you play this* を外す」 → `Gain a Curse.` | **なし** |
| Magic Lamp 魔法のランプ | **2020** | 同上。あわせて `(counting this)` を明記・`If you do`→`If you did` | **なし**（明確化） |
| Tracker 追跡者 | **2020** | `while this is in play` → `while you have this in play` | なし |
| Tracker 追跡者 | **2022（6/29）** | → **`This turn, when you gain a card, you may put it onto your deck.`**＋**節の順序が入れ替わり（山札上置き節が「祝福を受ける」より前）** | **あり（下記）** |
| 夜襲・秘密の洞窟 | **2025** | 持続一般ルール（場を離れたら以後働かない）＋大君主/はみだし者/相続で使えない | **あり** |
| 上記以外の10枚 | — | **エラッタなし**（Versions表が2017年版1種のみ、または2021印刷と同文） | — |

※2019/2020 のエラッタは**物理カードには2021年1月印刷で初めて載った**。「2021印刷で変わった」は物理の話、「2019/2020エラッタ」は裁定の話。**下書きは Cursed Gold / Magic Lamp の "When you play this" 削除を「2022エラッタの一般方針」と書いていたが誤り＝2020 Errata**。

---
---

## 1. Pooka / プーカ

- **コスト**：$5
- **種別**：Action ＝ **アクション**（Fate ではない）
- **日本語テキスト**
```
あなたの手札から呪われた金貨以外の財宝カード1枚を廃棄してもよい。そうした場合、+4 カード。
————
家宝：呪われた金貨
```
- **英語原文（現行＝2017年版と2021印刷が同一・エラッタなし）**
```
You may trash a Treasure other than Cursed Gold from your hand, for +4 Cards.
Heirloom: Cursed Gold
```
- **公式裁定**
  - ルールブック逐語（Official FAQ はこの1行のみ）：*"Pooka: In games using Pooka, replace one of your starting Coppers with a Cursed Gold."*
  - 日wiki 詳細なルール：**廃棄は任意。廃棄しなければドローもできない。廃棄したら+4カードは強制。**
  - 日wiki 詳細なルール（逐語）：*「プーカの使用時効果は①手札のカードを廃棄し、廃棄置き場に置く→②ドロー効果を得る、という二段階の処理である。①でのカード廃棄に対して廃棄時効果が誘発するタイミングは①の直後であり、②の後ではないので注意。」*
    ＝**②のドローで引いた青空市場で①の廃棄にリアクションすることはできない**／**②のドローで引いたアクションを捨てて呪いの鏡の幽霊獲得、もできない**。
- **実装注意**
  - 候補＝手札の財宝のうち **id が `cursed_gold` でないもの**。財宝判定は **`isTreasureFor(state, id)`**（資本主義対応）を使い、素の `DOM.isType(id,'treasure')` を書かない。
  - 廃棄は **`trashCard(state, pi, card)`** 経由（城塞・ネズミ・墓・青空市場・呪いの鏡の on-trash が正しく走る）。**戻り値/廃棄成立を確認してから `draw(state, pi, 4)`**。
  - 上の「二段階」は本エンジンの `onTrashQueue` と噛み合う：**on-trash キューを消化しきってからドローする**こと。ドローを先にすると青空市場の窓が誤って開く。
  - **新 pending 1種 `pooka_trash`**（任意・「廃棄しない」ボタン必須）＝4点セット（engine reducer＋`PLAYER_ACTIONS`＋CPU `decidePending`＋UI `viewPendingModal`）。**手札に対象財宝が無ければ pending を立てない**（終端保証）。
  - **CPU は `decidePending` で `null` を返さない**（`{type:'POOKA_TRASH', card:null}` ＝辞退を返す）。

---

## 2. Raider / 夜襲

- **コスト**：$6
- **種別**：Night - Duration - Attack ＝ **夜行 - 持続 - アタック**
- **日本語テキスト**
```
手札が5枚以上ある他のプレイヤーは全員、あなたの場に出ているいずれかのカードと同じカード1枚を捨て札にする（それができない場合、手札を公開する）。
あなたの次のターンの開始時に、+3 コイン。
```
- **英語原文（現行＝2017年版と2021印刷が同一・カード文のエラッタなし／2025の持続一般ルールは適用される）**
```
Each other player with 5 or more cards in hand discards a copy of a card you have in play (or reveals they can't).
At the start of your next turn, +$3.
```
- **公式裁定**
  - ルールブック逐語：*"Raider: For example if your cards in play are 3 Coppers, a Silver, and a Raider, then each other player with at least 5 cards in hand has to discard a Copper, Silver, or Raider, or reveal their hand to show that they did not have any of those cards."*
    ＝**夜襲自身も「場にあるカード」に含まれる**。
  - 前ターンから場に残っている持続カードも「場にある」（迫害者の Official FAQ *"Cards in play from previous turns are still cards in play"* の一般則）。
  - 手札4枚以下の相手は完全に対象外。
  - **ルールブックの番犬(Faithful Hound)項が夜襲を名指ししている**（逐語）：*"if for example you discard Faithful Hound to another player's Raider, you can set it aside and return it to your hand at the end of that turn."*
    ＝**夜襲の捨て札は本物の「捨てる」**で、捨て札時リアクション／`triggerOnDiscard`（坑道など）が正しく誘発する。
  - 日wiki：騎士・分割山のように同じ山に由来しても**印刷名が違えば別カード**。
  - 日wiki（2019年ルール変更）：**はみだし者／大君主で使ったカードは「そのカード」として扱われない**ので捨てさせるのは「はみだし者／大君主」の方。**相続した屋敷はカード名が「屋敷」のまま**。
  - **2025エラッタ**：夜襲が場を離れたら次ターンの +$3 は発生しない。
- **実装注意**
  - **夜フェイズにプレイするアタック**＝堀/灯台/番犬/そり型のリアクション窓を**夜フェイズでも開く**。既存の `ATTACKS` 登録＋`*EnterVictim` に乗せる。
  - 捨てる札は**被害者が選ぶ**＝新 pending `raider_discard`。候補＝被害者の手札のうち、**使用者の `inPlay` ＋ `durationCards` にあるカード名と一致するもの**。
  - 候補ゼロなら**手札を公開して終端**。公開は `reveal(state, 被害者席, 手札, ...)` を通す（owner＝被害者）。
  - 持続の +$3 は `armDuration` ＋ `DURATION_RESOLVERS.raider` に登録し、`addCoins(state, 3)` を使う（`t.coins += 3` を直接書かない＝カメレオンの習性が壊れる）。
  - **[矛盾・判断済み] 手札公開の要否**：日wikiの詳細なルールに *「場に出ているカードと同じカードが手札になかったとしても、手札を公開する必要はない。」* という記述があるが、**同じ日wikiのカードテキスト欄自身が「(それができない場合、手札を公開する)」と書いており内部矛盾している**。英語カード文（2017/2021とも `or reveals they can't`）・RGG公式FAQ・独・仏・波の全言語版が「公開する」で一致するので、**「公開する」で実装する**。（日wiki側の記述の由来は追えていない＝下の未解決事項1）

---

## 3. Sacred Grove / 聖なる木立ち

- **コスト**：$5
- **種別**：Action - Fate ＝ **アクション - 幸運**
- **日本語テキスト**
```
+1 購入
+3 コイン
祝福を1つ受ける。それにより +1 コイン を得なければ、他のプレイヤーも全員、それを受けてもよい。
```
- **英語原文（現行＝2017年版のみ・エラッタなし）**
```
+1 Buy
+$3
Receive a Boon. If it doesn't give +$1, each other player may receive it.
```
- **公式裁定**
  - ルールブック逐語：*"Sacred Grove: You have to receive the Boon; the other players can choose to receive it. **The Field's Gift and The Forest's Gift are not shared.** The River's Gift means that each player choosing to receive it draws a card at the end of your turn, at the same time as you."*
  - **祝福12種の全文を実見して確認：`+$1` を含むのは 田畑の恵み(The Field's Gift) と 森の恵み(The Forest's Gift) の2種だけ**（Field=`+1 Action / +$1`、Forest=`+1 Buy / +$1`）。日wikiも *「祝福12種類中+1コインを与えるものは2種類しかなく」* と一致。
  - 日wiki 詳細なルール：*「使用したプレイヤーが祝福を受けた後、他のプレイヤーは**ターンプレイヤーの左隣の人から順に**、祝福を受けるか判断し、受ける場合は**即座に処理**する。」*
  - 日wiki：*「カメレオンの習性を使うと+3金が3ドローになるが、**「+1金を得なければ」や個々の祝福が変わることはない**。」*
- **実装注意**
  - **「+$1 を与えるか」の判定は祝福ID 2種のハードコード**（`the_fields_gift` / `the_forests_gift`）にする。テキスト解析は禁止。
  - **1枚の祝福カードを全員が受ける**（呪詛の "next Hex" と同型）＝祝福デッキは1枚しかめくらない。祝福の捨て札化は全員の処理が終わってから。
  - **他プレイヤーは任意**＝新 pending `sacred_grove_offer`。**左隣から逐次**（先に受けた人の効果が盤面を変え得るので同時解決にしない）。
  - **田畑/森/川の恵みは「そのターンの片付けまでプレイヤーの前に置く」**（ルールブック）＝川の恵みは**複数人が同時に持ち得る**（各自が使用者のターン終了時に1枚引く）。
  - `+3 コイン` は **`addCoins(state, 3)`**、`+1 購入` は `t.buys += 1`。
  - **[実装リスク] カメレオンの習性**：本プロジェクトは `addCoins`/`draw` にフックを入れて「そのプレイの解決中」を変換する。素直に作ると**祝福の `+$1` まで変換されてしまい、公式（祝福は変わらない）に反する**。祝福の解決中はフックを切ること。mix-all でのみ到達。
  - **[CPU] 「常に受ける」は安全な近似だが最適ではない**：強制効果の 山の恵み(銀貨獲得)・沼の恵み(ウィル・オ・ウィスプ獲得) は薄いデッキには不利。残り10種は任意効果か純利得なので、少なくとも**終端保証としては「常に受ける」でよい**。

---

## 4. Secret Cave / 秘密の洞窟

- **コスト**：$3
- **種別**：Action - Duration ＝ **アクション - 持続**
- **日本語テキスト**
```
+1 カード
+1 アクション
あなたの手札からカード3枚を捨て札にしてもよい。そうした場合、あなたの次のターンの開始時、+3 コイン。
————
家宝：魔法のランプ
```
- **英語原文（現行＝2017年版のみ・カード文のエラッタなし／2025の持続一般ルールは適用される）**
```
+1 Card
+1 Action
You may discard 3 cards. If you did, then at the start of your next turn, +$3.
Heirloom: Magic Lamp
```
- **公式裁定**（ルールブック＝英語wiki Official FAQ と完全一致）
  - *"If you do not discard three cards, Secret Cave is discarded from play at end of turn."*
  - *"If you do discard three cards, Secret Cave stays out until the Clean-up of your next turn, and you get +$3 at the start of that turn."*
  - *"**You can choose to discard three cards even with fewer cards in hand, and will discard your remaining cards, but will not get the bonus.**"*
  - *"In games using Secret Cave, replace one of your starting Coppers with a Magic Lamp."*
  - 日wiki 詳細なルール：*「手札から複数の枚数のカードを捨て札にする際には1枚ずつではなく、カード全てを**同時に**捨て札にする処理」*
    ＝坑道を捨てる→金貨獲得→望楼で山札の上に→望楼を捨てる、という連鎖はできない。
    ただし *「村有緑地を捨て札にする→村有緑地をリアクションして即座に『+1ドロー、+2アクション』を得る、という動きはできるが、**ここでドローしたカードを更に捨て札にすることはできない**」*。
  - **2025エラッタ**：秘密の洞窟が場を離れたら次ターンの +$3 は発生しない。
- **実装注意**
  - **持続になるのは「実際に3枚捨てた場合だけ」**。捨てなければ通常のクリンナップで捨て札。`armDuration` を条件付きで呼ぶ。
  - **手札が3枚未満でも「3枚捨てる」を選べる**（engine は拒否しないこと＝人間が詰む）。**実際に捨てた枚数が3未満ならボーナス無し**。UI の文言でこれを明示する。
  - 捨て札は同時＝**全部捨ててから `triggerOnDiscard` をまとめて誘発**（§0-5 の坑道／§0-25 の村有緑地と同じ配線）。
  - **新 pending 1種 `secret_cave_discard`**（任意・「捨てない」ボタン必須・複数選択）。
  - `+3 コイン` は `DURATION_RESOLVERS.secret_cave` で **`addCoins(state, 3)`**。`+1 カード` は `draw()`（-1カードトークン／カメレオンの習性を通す）。

---

## 5. Shepherd / 羊飼い

- **コスト**：$4
- **種別**：Action ＝ **アクション**
- **日本語テキスト**
```
+1 アクション
好きな枚数の勝利点カードを公開して捨て札にする。捨て札にしたカード1枚につき、+2 カード。
————
家宝：牧草地
```
- **英語原文（現行＝2017年版のみ・エラッタなし）**
```
+1 Action
Discard any number of Victory cards, revealing them. +2 Cards per card discarded.
Heirloom: Pasture
```
- **公式裁定**
  - ルールブック逐語：*"Shepherd: For example, you could discard three Victory cards to draw six cards. In games using Shepherd, replace one of your starting Coppers with a Pasture."*
  - 英語wiki「Other rules clarifications」逐語：*"If drawing causes you to shuffle, you will shuffle in the discarded Victory cards. And if you discard a Tunnel and gain a Gold, the Gold will get shuffled in."*
  - 日wiki 詳細なルール：**0枚も選べる（何も起きない）**／**複数種別のカードは勝利点を含めば勝利点カード**（後宮・ミル・牧草地・封土など）／**ドローは捨て札の後**。
- **実装注意**
  - 候補フィルタは `DOM.isType(card,'victory')`。**相続した屋敷はカード名が「屋敷」のまま＝勝利点カード**なので候補に入る。
  - **公開しながら捨てる**＝`reveal()` を通す（パトロンが誘発する・オンラインのログに残る）。
  - **順序厳守**：捨て札 → `triggerOnDiscard`（坑道の金貨獲得を含む）を全部解決 → **その後にまとめて `draw(state, pi, 2*n)`**。この順序でないと坑道の金貨がリシャッフルに入らない（＝上の公式裁定に反する）。
  - **新 pending 1種 `shepherd_discard`**（複数選択・**0枚可＝「捨てない」で確定できること**）。
  - 家宝 `pasture` のセットアップが必要。

---

## 6. Skulk / 暗躍者

- **コスト**：$4
- **種別**：Action - Attack - Doom ＝ **アクション - アタック - 不運**
- **日本語テキスト**
```
+1 購入
他のプレイヤーは全員、次の呪詛を1つ受ける。
————
このカードを獲得するとき、金貨1枚を獲得する。
```
- **英語原文（現行＝2017年版のみ・エラッタなし）**
```
+1 Buy
Each other player receives the next Hex.
When you gain this, gain a Gold.
```
- **公式裁定**
  - ルールブック逐語：*"Skulk: You gain the Gold whether you gained Skulk due to buying it, or gained it some other way."*
  - **ルールブックの取り替え子(Changeling)項が暗躍者を名指ししている**（逐語）：*"So for example you could gain Skulk, exchange it for a Changeling (returning Skulk to the Supply and putting Changeling into your discard pile), and **still gain a Gold from Skulk's ability**."*
  - 日wiki 詳細なルール：**望楼のリアクションで獲得直後に廃棄しても金貨は獲得できる**／**金貨の山が空なら暗躍者だけ獲得**／**墓暴きなどサプライ以外から獲得しても金貨を獲得する**／**呪詛を公開する前にリアクションの有無を確認する**。
  - （派生・一般ルール）**「サプライから追放する」は獲得ではない**ので金貨は出ない。**門番は「獲得してから追放」なので金貨が出る**。※これは追放の一般ルールからの演繹で、暗躍者を名指しした一次資料は無い。
- **実装注意**
  - **on-gain は `triggerOnGain` に配線**（購入・効果獲得・`gainFromOutside`（墓暴き/闇市場/廃棄置き場）のすべてで発火すること）。
  - **`+$` は無い**（`+1 購入` のみ）。`t.buys += 1`。
  - アタック＝`ATTACKS` 登録＋`skulk_react` の堀リアクション窓。**呪詛は1枚だけめくり全員が同じ呪詛を受ける**。
  - **獲得時の対話が同時に複数開き得る**（望楼・そり・鷹匠・追跡者の山札上置き）→ **`state.onGainQueue` に積む。`state.pending` への直代入は禁止**（§0-26 の必読事項：望楼の窓を握りつぶす）。
  - **金貨の獲得自体も新たな `triggerOnGain` を呼ぶ**（追跡者があれば金貨も山札の上に置ける）。

---

## 7. Tormentor / 迫害者

- **コスト**：$5
- **種別**：Action - Attack - Doom ＝ **アクション - アタック - 不運**
- **日本語テキスト**
```
+2 コイン
他のカードがあなたの場に出ていなければ、インプ1枚を獲得する。そうでない場合、他のプレイヤーは全員、次の呪詛を1つ受ける。
```
- **英語原文（現行＝2021印刷）**
```
+$2
If you have no other cards in play, gain an Imp. Otherwise, each other player receives the next Hex.
```
- **【エラッタ・文言のみ／2019 Errata】** 2017年版は `gain an Imp **from its pile**.`。2019年の一般ルール化（*"When a card tells you to gain a non-Supply card by name, you can gain it from its pile, even though it's not in the Supply."*）で `from its pile` が不要になり、2021印刷で削除。**機能差ゼロ**。
- **公式裁定**
  - ルールブック逐語：*"Tormentor: Cards in play from previous turns are still cards in play; cards you played this turn but which are no longer in play (such as a Pixie you trashed) are not in play."*
  - 英語wiki「Other rules clarifications」逐語：*"If your only card in play is an Overlord, and it plays a Tormentor, you give out a Hex instead of gaining an Imp."* ／ *"If you somehow play this without having any cards in play (even the Tormentor itself), you gain an Imp."*
  - 日wiki 詳細なルール（逐語・要点）：
    - *「**「迫害者以外のカードが場にあるかどうか」ではなく、「使用されたその迫害者以外のカードが場にあるかどうか」で判定される。同名か否かは関係ない。**」*
      ＝**迫害者Aでインプを得た後に迫害者Bを使うと、Bにとって A は「他のカード」なので呪詛を撒く**。
    - *「持続カードや呼び出したリザーブカードは「場に出ている」ため、呪詛を撒く。特に**雇人やチャンピオン**など、使用後に場に出続けるカードがある場合は注意。」*
    - *「**命令カード、ネクロマンサー、相続した屋敷によって使用すると、場にそのカードだけしかなくても呪詛を撒く。**あくまでサプライor廃棄置き場or脇の迫害者の効果が発揮されるため、使用したそれらのカード（＝迫害者にとって他のカード）が場に存在する扱いとなる。」*
    - *「**迫害者でインプを獲得する場合でも、他プレイヤーは【アタック誘発リアクション】でリアクションすることができる。**」*
    - *「場に迫害者自身以外のカードが出ておらず、インプの山札が空の場合は何も獲得できない。」*
    - 場に何も無い状態で使う手順の例：*「山砦購入後にターン中初めてのアクションとして大君主を2度使用する際に、1度目を馬の習性として使用し、2度目を通常の効果として使用した場合」*
- **実装注意**
  - 判定＝**`p.inPlay`（今プレイした迫害者自身を除く）＋ `p.durationCards` が空かどうか**。「同名の迫害者がもう1枚あるか」ではない。
  - **命令経由（大君主/はみだし者）・ネクロマンサー・相続した屋敷では、迫害者自身は場に出ないが代理でプレイしたカードが場にある**＝呪詛側。本プロジェクトの `state._cmd` / `playedByCommand` と整合させること。
  - `+2 コイン` は **`addCoins(state, 2)`**。
  - アタック＝`ATTACKS` 登録＋`tormentor_react`。**インプ獲得側でも「アタックカードを使用した」窓は開く**（番犬・馬商人・そり型が誘発する）。堀は呪詛を防ぐだけ。
  - Imp は**非サプライ13枚**。王国に**迫害者または悪魔の工房**があれば Imp 山を用意。`NON_SUPPLY` の4系統除外（`emptyPileCount` / `canBuyCard` / 闇市場母集団 / 汎用獲得）を必ず通す。
  - **日本語版カードは旧文言のまま**（`(インプの山から)` が残っている）。本アプリは現行文を採用する。

---

## 8. Tracker / 追跡者

- **コスト**：$2
- **種別**：Action - Fate ＝ **アクション - 幸運**
- **日本語テキスト**
```
+1 コイン
このターン、カード1枚を獲得したとき、それを山札の上に置いてもよい。
祝福を1つ受ける。
————
家宝：革袋
```
- **英語原文（現行＝2022年6月29日改訂）**
```
+$1
This turn, when you gain a card, you may put it onto your deck.
Receive a Boon.
Heirloom: Pouch
```
- **【エラッタ・3段階／うち2022は機能変更】**
  1. **2017年版**：`+$1 / Receive a Boon. / **While this is in play,** when you gain a card, you may put that card onto your deck.`
  2. **2020 Errata（物理は2021印刷）**：`**While you have this in play,**`（文言のみ）
  3. **2022 Errata（Versions表の日付＝June 29, 2022）**：`+$1 / **This turn,** when you gain a card, you may put it onto your deck. / Receive a Boon.`
     — 2022の一般方針 *"while this is in play" → "this turn"*（同バッチ＝Princess, Hermit, Merchant Guild, Bridge Troll, Groundskeeper, Tracker, Sauna, Lighthouse, Quarry, Hoard, Haggler, Highway）。
     **同時に節の順序も入れ替わり、山札上置き節が「祝福を受ける」より前に来た**（＝祝福が獲得させたカードも置けることを本文で明示するため）。
- **公式裁定**
  - 英語wiki **Unofficial FAQ (2022)**（＝現行）逐語：*"If you gain multiple cards after playing Tracker, this applies to each of them—you could put any or all of them on top of your deck."* ／ *"This applies both to cards gained due to being bought, and to cards gained other ways."* ／ *"**Tracker's top-decking effect kicks in before its Boon-granting effect does**, so if the Boon causes you to gain a card, for example a Silver from The Mountain's Gift, you can put that card onto your deck."* ／ *"In games using Tracker, replace one of your starting Coppers with a Pouch."*
    （※wiki は 2021年版FAQを "Deprecated official FAQ (2021)" として別掲＝現行は上の2022版）
  - 日wiki 詳細なルール（逐語・要点）：
    - *「追跡者の『カード1枚を獲得したとき、それを山札の上に置いてもよい』の効果は**「使用時効果」であり、「場に出ているときに発揮される効果」ではない**ので注意。」*
    - *「玉座の間などで複数回プレイすると、効果は**累積する**（ただし、累積しても意味が無い）。」*
    - *「**行進などで使用後に場から移動しても、効果が消えない。**」*
    - *「**はみだし者などによって、カードが場に出ない方法で使用されても、効果は発揮される。**」*
    - *「逆に、**女魔術師のアタック効果や習性により使用時効果が書き換えられると、効果は発揮されない**。」*
    - 獲得時トリガーが複数同時に誘発したとき（暗躍者を獲得＝追跡者の窓＋暗躍者の on-gain 金貨、国境の村＋銀貨など）は**獲得者が解決順を選べる**。2019年の「捨て札からのカード移動時のルール変更」により、**どちらの順でも両方を山札の上に置ける**（順番だけが変わる）。
- **実装注意**
  - **ターン単位のフラグ `t.trackerTopdeck = true` にする。「場にあるか」で見ない**（現行エラッタ）。`freshTurn` でクリア。
    → これにより **行進で場を離れても効く／命令・ネクロマンサー経由でも効く**が、**習性で使用すると効かない**（`applyWay` は記載効果を置き換えるため自動的にそうなる）。
  - **`+1 コイン`（`addCoins(state,1)`）→ フラグを立てる → 祝福を受ける** の**この順**で実装する（祝福由来の獲得を拾うため。現行の節順どおり）。
  - 山札上置きは**任意**＝獲得のたびに窓。**`state.onGainQueue` に積む**（`state.pending` 直代入は禁止）。
  - **CPU は `null` を返さない**（`{type:'TRACKER_TOPDECK', card:null}`＝辞退）。候補ゼロなら engine 側で窓を閉じる終端保証。
  - **日本語版の印刷カードは旧文言（「これが場にある間」）だが、Dominion Online の日本語訳は既に現行（「このターン、」）に更新済み**（日wikiで確認）。本アプリは現行を採用。

---

## 9. Tragic Hero / 悲劇のヒーロー

- **コスト**：$5
- **種別**：Action ＝ **アクション**
- **日本語公式名**：**悲劇のヒーロー**（Dominion Online／日本語wiki）。**英語wikiの Other language versions は「悲劇の勇者」**と別名を載せている＝下の未解決事項3。
- **日本語テキスト**
```
+3 カード
+1 購入
カードを引いた後にあなたの手札が8枚以上あるなら、これを廃棄して財宝カード1枚を獲得する。
```
- **英語原文（現行＝2017年版と2021印刷が同一・エラッタなし）**
```
+3 Cards
+1 Buy
If you have 8 or more cards in hand (after drawing), trash this and gain a Treasure.
```
- **公式裁定**
  - ルールブック逐語：*"Tragic Hero: First draw three cards; then, if you have eight or more cards in hand, you trash Tragic Hero and gain a Treasure. **If you cannot trash Tragic Hero (for example if you play it twice with Throne Room and trashed it the first time), you still gain the Treasure.**"*
    ＝**廃棄は財宝獲得の条件ではない。判定は手札枚数だけ。**
  - **ルールブックのネクロマンサー項が悲劇のヒーローを名指ししている**（逐語）：*"Necromancer can be used on a card that trashes itself when played; if the card checks to see if it was trashed (such as Pixie), it was not, but **if the card does not check (such as Tragic Hero), it will function normally.**"*
  - 日wiki 詳細なルール：**強制**（手札8枚以上なら廃棄も獲得もしなければならない）／*「獲得する財宝カードは、サプライにあるものであればコストは問わない。」*／幽霊で2回使用する例（1回目で廃棄＋財宝、2回目は廃棄に失敗するが財宝獲得は有効）。
- **実装注意**
  - 判定タイミング＝`draw(state,pi,3)` の**直後**に `p.hand.length >= 8`。**悲劇のヒーロー自身は場にあるので手札に数えない**。
  - 廃棄は `removeOne(p.inPlay,'tragic_hero')` の成否を見る（`takeSelf` 相当）。命令カード（大君主/はみだし者/船長/王子）・ネクロマンサー経由では場に無いので廃棄は失敗する。
  - **【本プロジェクト固有の注意】財宝の獲得は `self` に条件づかない**＝倒壊・死の荷車で使った **`pendingSelf` パターンとは逆**。廃棄成否にかかわらず必ず財宝を獲得させること。
  - **新 pending 1種 `tragic_hero_gain`**（強制・サプライの財宝から1枚）。候補は **`isTreasureFor(state,id)` ＋ `gainableBase`**（非サプライ・ロック中の分割山下段・混合山を除外）。**コスト上限は無い**（白金貨・銀行・豊穣の角も可）。候補ゼロなら窓を閉じる終端保証。
  - `+1 購入` は判定より**先に**付与済みであること（廃棄されても購入権は残る）。
  - `+3 カード` は `draw()`（-1カードトークンを通す）。

---

## 10. Vampire / 吸血鬼

- **コスト**：$5
- **種別**：Night - Attack - Doom ＝ **夜行 - アタック - 不運**
- **日本語テキスト**
```
他のプレイヤーは全員、次の呪詛を1つ受ける。
コスト5以下の吸血鬼以外のカード1枚を獲得する。
これをコウモリ1枚と交換する。
```
- **英語原文（現行＝2017年版と2021印刷が同一・エラッタなし）**
```
Each other player receives the next Hex.
Gain a card costing up to $5 other than a Vampire.
Exchange this for a Bat.
```
- **公式裁定**
  - ルールブック逐語：*"Vampire: **Follow the instructions in order.** If the Bat pile is empty, you will be unable to exchange Vampire for a Bat, but will do the rest. The Bat is put into your discard pile."*
  - 日wiki 詳細なルール（逐語・要点）：
    - *「吸血鬼の使用に対して堀などでリアクションを行う場合、使用者が**呪詛を公開する前に**リアクションするか選ばなければならない。」*
    - *「他プレイヤーが呪詛を受けてから、5コスト以下のカードの獲得を行う。」*
    - *「橋などの効果でカードのコストが下がっている場合、**下がった後のコスト**を参照する。」*
    - *「ポーションをコストに含むカード（ブドウ園など）、負債をコストに含むカード（技術者など）は、どちらもコスト最大5(コイン)までのカードに含まれないため獲得できない。**正確には「コスト最大5コイン0ポーション0負債まで」**」*
    - *「誰かがカードを獲得する度にコストが変化する**行人**と組み合わせる場合は特に注意が必要。」*
    - *「イベントやプロジェクトはカードではないので獲得できない。」*
    - *「コウモリとの**交換はカードの獲得ではない**。」*
  - **交換は強制**（トラベラーの任意交換と違う）。**クリンナップ時の処理ではなく使用時効果の一部**（日wiki コウモリ項の逐語：*「交換はクリーンアップフェイズ時の処理ではなく、使用時効果の一環として処理される。」*）。
- **実装注意**
  - **順序厳守**：①呪詛（アタック窓＋リアクション）→②獲得→③交換。②の獲得で `onGainQueue` の窓（望楼など）が開くので、**③はキューを消化してから**実行するか、③を `onGainQueue` の**非対話項目**として積む（§0-26 の `gatekeeper_exile` と同じ扱い）。
  - 獲得述語は **`costUpTo(state, id, 5)` ＋ `gainableBase`**（成分別比較＝ポーション費用・負債コスト・非サプライ・分割山ロックを弾く）。**さらに `id !== 'vampire'` を engine拒否・CPU候補・UIフィルタの3面に入れる**（片側だけだと CPU 無限ループ）。
  - **交換の実装**：`removeOne(p.inPlay,'vampire')` に成功したときだけ → `supply.vampire++`（**サプライ山へ戻る＝`emptyPileCount`／3山終了の判定に影響する**）→ `state.bat--` → `p.discard.push('bat')`。**獲得でも廃棄でもないので `triggerOnGain`／`triggerOnTrash` を呼ばない**。`removeOne` が失敗したら交換しない（lose track）。**コウモリの山が空なら交換せず、残りは実行する。**
  - **コウモリの山（非サプライ10枚）は `NON_SUPPLY` に登録**し、4系統（`emptyPileCount` / `canBuyCard` / 闇市場母集団 / 汎用獲得）から除外。
  - 夜フェイズのアタック＝堀/灯台/番犬のリアクション窓を夜フェイズでも開く。
  - **（演繹）闇市場デッキから得た吸血鬼のように「戻るべき山が無い」場合は交換できない**＝交換の一般ルール *"The exchange only happens if both cards can be exchanged"* の帰結。一次資料でこのケースを名指しした記述は見つけていない。
  - **[日wikiの誤植]** 日wikiは *「コスト最大5コイン0ポーション0負債までの**アクションカード**」* と書いているが、英語カード文は `Gain a card` ＝**種別を問わない**。日wikiの誤植なので追随しないこと。

---

## 11. Werewolf / 人狼

- **コスト**：$5
- **種別**：Action - Night - Attack - Doom ＝ **アクション - 夜行 - アタック - 不運**
- **日本語テキスト**
```
あなたの夜フェイズである場合、他のプレイヤーは全員、次の呪詛を1つ受ける。そうでない場合、+3 カード。
```
- **英語原文（現行＝2017年版のみ・エラッタなし）**
```
If it's your Night phase, each other player receives the next Hex. Otherwise, +3 Cards.
```
- **公式裁定**
  - ルールブック逐語：*"Werewolf: Werewolf can be played in either your Action phase or Night phase. If played in your Action phase, you draw three cards; if played at Night, each other player receives the next Hex."*
  - 英語wiki「Other rules clarifications」逐語：
    - *"As always, a card with multiple types retains those types in all contexts. For instance, when you play Werewolf in the Action phase (so it doesn't attack), **it's still an Attack card and activates other players' Diplomats and so on**. And when you play it in the Night phase, **it's still an Action card, so you can call Royal Carriage to repeat the Hexing**, for example."*
    - *"**If you have abilities to resolve at the start of your turn, it is considered part of your Action phase, and you cannot end it.** This means if you play Werewolf at the start of your turn (with e.g. Delay), you cannot skip to your Night phase and give out a Hex."*
    - *"If you play it during any phase that isn't your own Night phase (such as with Scepter, or March), **including during another player's Night Phase**, you get +3 Cards."*
  - 日wiki 詳細なルール：**アタック窓は「+3カード」側でも開く**（*「人狼はアタックカードであり、夜フェイズ以外に使用した場合でも、他プレイヤーは【アタック誘発リアクション】でリアクションすることができる。この場合も、人狼使用者が**カードを引いた後はリアクションできない**」*）／**教師の山トークンは夜フェイズに使用しても効く**／**女魔術師の置換は夜フェイズの人狼にも適用される**（そのターン最初のアクションカードなら +1カード+1アクションになる）／御料車・旗艦・大名の再使用も効く。
- **実装注意**
  - 判定は **`turn.phase === 'night'` かつ 手番プレイヤー本人**の両方。
  - **本プロジェクトは既に「ターン開始時は `turn.phase === 'action'`」（§0-22 ピアッツァの決定）＝上の公式裁定と一致している**。この不変条件を壊さないこと（壊すと帝国の冠も壊れる）。
  - **アタック窓は「+3カード」側でも開く**。既存の `ATTACKS` 実装が「効果を防ぐ」前提なら、**効果なしでも窓だけ開く分岐**が要る（堀は無意味だが、番犬/馬商人/そり/村有緑地型のリアクションが誘発する）。**窓はドロー／呪詛公開より前に閉じること。**
  - `+3 カード` は `draw(state, pi, 3)`（カメレオンの習性・-1カードトークンを通す）。
  - **習性（Way）を選べる**＝夜フェイズでも `playCardNoAction` / `applyWay` の経路に乗せる（`isUsableWay` が正本）。
  - 夜フェイズでも**アクションカードなので**、教師の山トークン（`applyPileTokens`）・御料車・山砦などの「アクションをプレイしたとき」系が発火すること。

---
---

## 家宝（Heirloom）4種 ＋ コウモリ

いずれも**非サプライ・購入不可**。対応する王国カードが使われるとき、**初期デッキの銅貨1枚と入れ替える**（抜いた銅貨は銅貨の山へ戻す）。ルールブックの例：*"For example in a game with Pixie and Tracker, players start with 3 Estates, 5 Coppers, a Goat, and a Pouch."*

### Cursed Gold / 呪われた金貨（プーカの家宝）
- **コスト**：**$4** ／ **種別**：Treasure - Heirloom ＝ **財宝 - 家宝**
- **日本語テキスト**
```
3 コイン
呪い1枚を獲得する。
```
- **英語原文（現行＝2021印刷）**：`$3` ／ `Gain a Curse.`
- **【エラッタ・文言のみ／2020 Errata】** 2017年版は `$3 / **When you play this,** gain a Curse.`。2020の一般方針 *"Remove 'when you play this' from Treasures"*（Cursed Gold / Magic Lamp / Goat / Lucky Coin / Idol ほか多数）で削除。物理は2021年1月印刷から。**機能差ゼロ**。
- **公式裁定**：ルールブック逐語 *"Cursed Gold: You can choose not to play Cursed Gold, and thus not gain a Curse."*（＝**プレイ自体が任意**）。日wiki：**プレイしたら呪い獲得は強制**／**呪いの山が空なら何も獲得しない**。
- **実装注意**
  - 効果は **`applyTreasureEffect` に書く**（`applyEffect` は財宝では呼ばれない＝§0-25 の自己回帰）。`coin: 3`。
  - **「財宝を全部出す」（`PLAY_ALL_TREASURES`）が呪われた金貨を勝手に出すと事故になる**。`playAllOrder` から除外するか、UI で確認を入れること（＝本プロジェクト固有のUX判断。**公式ルール上はプレイが任意なので除外して構わない**）。
  - 冠／ティアラ／偽造通貨で2回使えば**呪い2枚**（`applyTreasureEffect` に書けば自動的に正しくなる）。
  - 日本語版カードは旧文言（「あなたがこのカードを使用するとき、」）のまま。

### Pasture / 牧草地（羊飼いの家宝）
- **コスト**：$2 ／ **種別**：Treasure - Victory - Heirloom ＝ **財宝 - 勝利点 - 家宝**
- **日本語テキスト**
```
1 コイン
————
あなたの持つ屋敷1枚につき 1 勝利点。
```
- **英語原文（現行＝2017年版のみ・エラッタなし）**：`$1` ／ `Worth 1VP per Estate you have.`
- **公式裁定**：ルールブック逐語 *"Pasture: For example if you have three Estates, then Pasture is worth 3VP."*
- **実装注意**
  - **可変VP**＝engine の `vpOf` と cpu の `vpOfPlayer` の**両方**に加算（絹の道・封土・品評会・城と同型）。片方だけだと CPU の終局読みが engine の得点とずれる（§0-26 で実際に踏んだバグ）。
  - 数えるのは**所有する屋敷の枚数**＝**`DOM.engine.allCards`** を使う（追放マット・島マット・脇置き・酒場マット等を全部含む。CPU 側で列挙を手書きしない）。
  - **相続した屋敷もカード名は「屋敷」のまま**なので数える。**牧草地自身は屋敷ではない**。

### Pouch / 革袋（追跡者の家宝）
- **コスト**：$2 ／ **種別**：Treasure - Heirloom ＝ **財宝 - 家宝**
- **日本語テキスト**
```
1 コイン
+1 購入
```
- **英語原文（現行＝2017年版のみ・エラッタなし）**：`$1` ／ `+1 Buy`
- **公式裁定**：ルールブック逐語 *"Pouch: This simply gives you $1 and +1 Buy when you play it."*
- **実装注意**：`coin: 1` ＋ `applyTreasureEffect` で `t.buys += 1`。

### Magic Lamp / 魔法のランプ（秘密の洞窟の家宝）
- **コスト**：**$0** ／ **種別**：Treasure - Heirloom ＝ **財宝 - 家宝**
- **日本語テキスト**
```
1 コイン
あなたの場にちょうど1枚だけ出ているカードが（これを含めて）6種類以上あるなら、これを廃棄する。そうした場合、願い3枚を獲得する。
```
- **英語原文（現行＝2021印刷。最新スナップショット `2id_` で確認）**
```
$1
If there are at least 6 cards that you have exactly 1 copy of in play (counting this), trash this. If you did, gain 3 Wishes.
```
- **【エラッタ・文言のみ／2019＋2020 Errata】** 2017年版は
  `$1 / **When you play this,** if there are at least 6 cards that you have exactly 1 copy of in play, trash this. If you **do**, gain 3 Wishes **from their pile**.`
  → **2019**（非サプライ札の名指し獲得が一般ルール化）で `from their pile` 不要、**2020**（財宝から "When you play this" を外す）で前置句削除、あわせて `(counting this)` を明記・`do`→`did`。物理は2021年1月印刷。**機能差ゼロ**。
  ※`(counting this)` は**現行文に確かに存在する**（最新スナップショットの Card text と Versions表の2021印刷行の両方で確認）。
- **公式裁定**
  - ルールブック逐語：*"Magic Lamp: **Magic Lamp itself counts as one of the six cards.** A card you have two or more copies of in play does not count; you have to have exactly one copy in play to count a card. **You can play more Treasures after trashing Magic Lamp, and still get $1 from it for that turn.**"*
  - 英語wiki「Other rules clarifications」逐語：*"Since you can play Treasures in whatever order you want, having (for example) multiple Coppers you want to play needn't prevent you from trashing your Magic Lamp for Wishes. Simply play one Copper to count as one of your six unique cards in play, play your Magic Lamp, and then play the rest of your Coppers."*
  - 日wiki 詳細なルール：**廃棄も願い3枚の獲得も強制**／**分割山・騎士のように同じ山でも印刷名が違えば別カード名**／*「偽造通貨や冠などで魔法のランプを2度使用することはできるが、**「魔法のランプの廃棄」は1度しかできないため、願い3枚獲得も1度しかできない**。」*／はみだし者・大君主で使ったカードは（2019年ルール変更で）そのカード名として扱われない／相続した屋敷はカード名が「屋敷」のまま。
- **実装注意**
  - 判定＝**`p.inPlay` ＋ `p.durationCards` の「カード名ごとの枚数がちょうど1」のものが6種類以上**（魔法のランプ自身を含める）。
  - **コインを先に計上してから廃棄する**（廃棄しても $1 は消えない）。廃棄後も財宝を出し続けられる。
  - 廃棄は **`trashCard`** 経由（青空市場・墓・出納官の回収経路のため）。
  - 願い（Wish）は**非サプライ12枚**。王国に**レプラコーンまたは秘密の洞窟**があれば願いの山を用意。**山が3枚未満ならあるだけ獲得**。`NON_SUPPLY` の4系統除外必須。
  - 日本語版カードは旧文言のまま。

### Bat / コウモリ（吸血鬼と入れ替わる非サプライ・10枚）
- **コスト**：$2*（`*` ＝サプライに無い） ／ **種別**：Night ＝ **夜行**
- **日本語テキスト**
```
あなたの手札から最大2枚までのカードを廃棄する。これにより1枚以上廃棄した場合、このカードを吸血鬼と交換する。
————
（このカードはサプライに置かない。）
```
- **英語原文（現行＝2017年版のみ・エラッタなし）**
```
Trash up to 2 cards from your hand. If you trashed at least one, exchange this for a Vampire.
(This is not in the Supply.)
```
- **公式裁定**
  - ルールブック逐語：*"Bat: The Vampire is put into your discard pile. If there are no Vampires in their pile, you cannot exchange Bat for one, but can still trash cards."*
  - 日wiki 詳細なルール（逐語・要点）：
    - *「吸血鬼との**交換はカードの獲得ではない**。」*／*「交換は**強制効果**であり、コウモリの効果で手札を1枚でも廃棄した場合は必ず一度手放さなければならない。」*
    - *「交換は**クリーンアップフェイズ時の処理ではなく、使用時効果の一環**として処理される。」*
    - *「コウモリはサプライに置かれず、購入や通常のカードの効果では獲得できない。」*／*「**コウモリの山札が切れたとしても、ゲーム終了条件には数えない。**」*
    - *「廃棄するカードの枚数は**0でもよい**。この場合コウモリは何もせず、交換も起こらない。」*
    - *「コウモリを使用する際は、まずコウモリの効果で廃棄するカードの全てを選び、その全てを**(1枚ずつではなく)同時に**廃棄置き場に置く。その後、カードの廃棄に誘発する効果があれば、誘発する。」*
      ＝**ネズミ1枚を廃棄→+1カード→引いたカードを同じコウモリで廃棄、はできない。**
- **実装注意**
  - **新 pending 1種 `bat_trash`**（0〜2枚選択・**0枚で確定できること**）。廃棄は全部同時に `trashCard` へ入れ、**その後に on-trash をまとめて誘発**（`onTrashQueue`）。
  - 交換＝`removeOne(p.inPlay,'bat')` 成功時のみ → `state.bat++`（コウモリの山へ戻す）→ `supply.vampire--` → `p.discard.push('vampire')`。**吸血鬼の山が空なら交換しない**（廃棄はそのまま有効）。
  - **`state.bat`（非サプライ山の残枚数）は物理カード**＝`allCards`（プレイヤー所有）には入らないが、**保存則 tally には「山」として数える**（賞品・戦利品・馬の山と同型。invariants の ZONES／tally に追加すること）。
  - **`NON_SUPPLY` の4系統除外必須**。コウモリの山が空でも `emptyPileCount` に数えない。

---
---

## 実装向けサマリ（この11＋5枚が engine に要求するもの）

| 事項 | 内容 |
|---|---|
| **新ゾーン** | **なし**（`p.inPlay` / `p.durationCards` / 既存の持続機構で足りる） |
| **新非サプライ山** | **Bat 10**（王国に吸血鬼）／**Imp 13**（迫害者 or 悪魔の工房）／**Wish 12**（秘密の洞窟 or レプラコーン）＝いずれも `NON_SUPPLY` の**4系統除外**（`emptyPileCount` / `canBuyCard` / 闇市場母集団 / 汎用獲得＝engine reducer と CPU `bestGain`/`bestGainExact` の**両方**）が必須 |
| **新機構** | **夜フェイズ**（夜襲/吸血鬼/人狼/コウモリ）／**交換 exchange**（吸血鬼⇄コウモリ・**獲得でも廃棄でもない**）／**家宝の初期デッキ置換**（呪われた金貨/牧草地/革袋/魔法のランプ）／**祝福・呪詛**（聖なる木立ち/追跡者/暗躍者/迫害者/吸血鬼/人狼） |
| **新 pending（4点セット必須）** | `pooka_trash` / `raider_discard`(被害者) / `sacred_grove_offer`(他プレイヤー逐次・左隣から) / `secret_cave_discard` / `shepherd_discard` / `tragic_hero_gain` / `vampire_gain` / `bat_trash` / `tracker_topdeck`(**onGainQueue**) ＋ アタック窓 `skulk_react` `tormentor_react` `vampire_react` `werewolf_react` `raider_react` |
| **ターンフラグ** | **`t.trackerTopdeck`**（このターン獲得カードを山札の上に置ける。**「場にある間」ではない**＝2022エラッタ）／`freshTurn` でクリア |
| **可変VP** | 牧草地（所有する屋敷1枚につき1VP）→ engine `vpOf` と cpu `vpOfPlayer` の**両方** |
| **既存述語の再利用** | `costUpTo`(吸血鬼 $5) / `gainableBase` / `isTreasureFor`(プーカ・悲劇のヒーロー) / `trashCard` / `reveal`(羊飼い・夜襲) / **`addCoins`**(聖なる木立ち+3・迫害者+2・夜襲/秘密の洞窟の持続+3) / `draw` / `state.onGainQueue`(暗躍者・追跡者) / `armDuration`+`DURATION_RESOLVERS`(夜襲・秘密の洞窟) / `allCards`(牧草地) |
| **アタックだが「効果なし」の窓** | **人狼をアクションフェイズで使ったとき**も「アタックカードを使用した」窓は開く（堀は無意味だが番犬/馬商人/そり型が誘発）。**迫害者がインプを獲得する側でも同じ** |
| **2025エラッタの波及** | 夜襲・秘密の洞窟が場を離れたら次ターンの効果は消える／**大君主・はみだし者・相続は夜襲・秘密の洞窟を使用できない**（＝本プロジェクトの既存の除外が正解になった） |

### 特に事故りやすい順序（実装時に必ず守る）

1. **プーカ**：①廃棄 → **on-trash を全部解決** → ②ドロー。（逆順にすると引いた青空市場でリアクションできてしまう）
2. **羊飼い**：①公開して捨てる → **`triggerOnDiscard` を全部解決（坑道の金貨）** → ②まとめてドロー。（逆順にすると金貨がリシャッフルに入らない）
3. **吸血鬼**：①呪詛（アタック窓を先に閉じる） → ②獲得（`onGainQueue` を消化） → ③交換。
4. **追跡者**：①`+$1` → ②**フラグを立てる** → ③祝福を受ける。（②が③より後だと祝福由来の獲得を拾えない）
5. **人狼／暗躍者／迫害者／吸血鬼**：**リアクション窓は「呪詛を公開する前」に閉じる**（人狼のアクションフェイズ側は「ドローする前」）。
6. **魔法のランプ**：$1 の計上 → 判定 → 廃棄 → 願い3枚。（廃棄しても $1 は消えない）

---

## 確認できなかったこと／未解決事項

1. **【矛盾・判断済み】夜襲の「手札公開」**：カード本文（2017/2021とも `or reveals they can't`）・RGG公式FAQ逐語・独/仏/波の全言語版・**日wikiのカードテキスト欄自身**が「公開する」で一致するのに、**日wikiの「詳細なルール」だけが「手札を公開する必要はない」と書いており内部矛盾している**。一次資料側を採用して「公開する」で実装すべき。日wiki側の記述の由来は追えていない。confidence: 公開する側=**high**／日wiki記述の由来=unknown。

2. **日本語カード名の3件の食い違い（英語wiki vs 日本語wiki）**：英語wiki の Other language versions は **蝙蝠 / 大願 / 悲劇の勇者**、日本語wiki（Dominion Online 訳）は **コウモリ / 願い / 悲劇のヒーロー**。他の13枚は両者一致。
   - **種別名についてはホビージャパン公式商品ページで日本語wiki側が正しいと確定した**（夜行/家宝/祝福/呪詛/幸運/不運）。またHJ公式ページのフレーバー文は「コウモリ」を使っている。
   - しかし **願い/大願・悲劇のヒーロー/悲劇の勇者 は、ホビージャパンの公式ページにも商品説明にもカード名が載っておらず決着していない**（印刷カードの実物照合をしていない）。**日本語wiki側（コウモリ/願い/悲劇のヒーロー）で統一することを推奨**（HJ公式と用語体系が一致し、本プロジェクトが全拡張で使ってきた出典でもあるため）。confidence: **medium**。**表示名なので、拡張全体で1回だけ決めること。**

3. **日本語カードテキストの出所**：本節の日本語文はすべて **Dominion Online の日本語訳**（日本語wiki 各カードページ）に基づく。**ホビージャパン印刷版カードの実物では照合していない**。特に**追跡者・迫害者・呪われた金貨・魔法のランプの日本語版印刷カードはエラッタ前の旧文言**である（追跡者は Dominion Online 側だけが現行に更新済み）。本アプリは方針どおり**現行（エラッタ後）英文に合わせた日本語**を採用すべき。

4. **暗躍者と追放（Exile）の関係**：「サプライから追放するのは獲得ではないので金貨は出ない／門番は獲得してから追放なので出る」は**追放の一般ルールからの演繹**であり、暗躍者を名指しした一次資料は見つけていない。confidence: medium-high。

5. **闇市場から得た吸血鬼（＝サプライに吸血鬼の山が無い場合）の交換**：交換の一般ルール *"The exchange only happens if both cards can be exchanged"* から「交換できない」と演繹したが、このケースを名指しした一次資料は無い。confidence: medium。

6. **聖なる木立ち × カメレオンの習性**：日wikiの *「+3金が3ドローになるが、『+1金を得なければ』や個々の祝福が変わることはない」* が唯一の根拠で、英語一次資料では確認できていない。ただし実装上は「祝福の解決中は習性の変換フックを切る」で両立するので実害は無い見込み。confidence: medium。

7. **祝福12種の詳細（B群の担当）との突き合わせ**：本節では「+$1 を与える祝福＝田畑の恵み・森の恵みの2種だけ」を、①ルールブック逐語 ②祝福12種のカード文全実見 ③日wikiの記述、の3系統で確認した。ただし**祝福個々の裁定（据え置き3種の扱い、川の恵みの「ターン終了時に全員同時に引く」の実装位置など）は B群の記述と必ず突き合わせること**。

---

# パート5：祝福12種・呪詛12種・状態

## 夜想曲（Nocturne）— 祝福12種・呪詛12種・状態4種

**この節の正本**（すべて自分で開いて逐語確認済み。下書きの引用は一切コピーしていない）
- RGG 公式ルールブック（2017年11月）pdftotext：`nocturne_rulebook.txt`（金額記号が脱落しているので数値は必ず別資料で裏取り）
- 英語wiki（Wayback経由・記号を `[$1]` `[2VP]` に復元）：`v2/p_<PageName>.txt` に28ページ保存済み
- 日本語wiki（wikiwiki.jp/dominiondeck）：`jp_boon.txt`／`jp_hex.txt`／`jpx_夜想曲.txt`／`jpx_ウィル・オ・ウィスプ.txt`
- ドミニオンポータル（dominion-portal.com）＝日本語名のクロスチェック用

---

### 0. 前提（この節の全カードに共通・実装の土台）

#### 0-1. ⚠️ 英語wikiの "Japanese" 行は夜想曲では信用できない（10/28が誤り）

英語wikiのカード個別ページは、日本語だけ **Print/Digital 列（カード画像）が空**で、テキストも実カードと違う。実際に日本語wiki・ドミニオンポータル・日本語wikiの夜想曲カードリストの**3系統で全28件を照合**したところ、次の10件が食い違った。**英語wikiの日本語名を使ってはいけない。**

| 英語名 | 英語wikiの日本語名（誤） | 日本語公式（正） |
|---|---|---|
| The Field's Gift | 土地の恵み | **田畑の恵み** |
| The Flame's Gift | 火の恵み | **炎の恵み** |
| Bad Omens | 悪兆 | **凶兆** |
| Delusion | 妄想 | **幻惑** |
| Deluded | 混乱 | **錯乱** |
| Locusts | イナゴ | **蝗害** |
| Misery | 苦難 | **みじめな生活** |
| Miserable | 没落 | **生活苦** |
| Twice Miserable | 都落ち | **二重苦** |
| Plague | 伝染病 | **疫病** |

一致していたもの（＝英語wikiでも正しい）：大地／森／月／山／川／海／空／太陽／沼／風の恵み、羨望、飢饉、恐怖、貪欲、憑依、貧困、戦争、嫉妬。

#### 0-2. 祝福（Boon）の共通ルール — ルールブック逐語

> "Nocturne has Fate cards and Boons. Fate cards can somehow give players Boons; all the Fate type means is that the Boons are shuffled at the start of the game. Boons are a face-down deck of cards that are revealed as needed. The phrase "receive a Boon" means, turn over the top Boon, and follow the instructions on it. If the Boons deck is empty, first shuffle the discarded Boons to reform the deck; you may also do this any time all Boons are in their discard pile. **Received Boons normally go to the Boons discard pile, but three (The Field's Gift, The Forest's Gift, and The River's Gift) go in front of a player until that turn's Clean-up.**"

英語wiki Boon ページの追加規定（逐語）：
> "In the unlikely event that all the Boons are set aside or otherwise occupied at the same time, so there are no Boons in the Boons deck or discard pile when you are told to receive a Boon, **you don't receive one**."

日本語wiki「詳細なルール」（逐語・実装に効く順に）：
- 「祝福はゲーム中はカードとして扱わない。また、祝福を受けることはカードの獲得とは異なる。**祝福はプレイヤーの場に出ることはない。**」
- 「受け終わった祝福は祝福の捨て札に置かれる（**通常のカードを置く捨て札・廃棄置き場とは別の場所である**。）。」
- 「**祝福の捨て札は一番上のみが公開情報であり、それ以外を見てはならない。**」
- 「祝福を受ける際に祝福の山札にカードが無い場合、祝福の捨て札のカードをシャッフルし、新たな山札を作る。」
- 「**恵みの村の効果や、祝福に書かれた効果で各プレイヤーに保持されたままの祝福は新たな山札に入らない。**」
- 「愚者によって3枚の祝福を公開する途中で山札が空になった場合、**すでに表になっているカードは新たな山札に入らない**。」
- 「恵みの村の獲得時効果でプレイヤーの手元に祝福カードが置いてある状態でゲームが終了したとしても、**それはそのプレイヤーの所有カードに含まれない**。庭園や壁を使用しているゲームでは注意。」

#### 0-3. 呪詛（Hex）の共通ルール — ルールブック逐語

> "Nocturne also has Doom cards and Hexes. ... The phrase "receive a Hex" means, turn over the top Hex, and follow the instructions on it. **"Each other player receives the next Hex" means, turn over just one Hex, and the other players all follow the instructions on that same Hex.** If all Hexes have been used, shuffle the discards to reform the deck; do this whenever the deck is empty. **Received Hexes always go to the Hexes discard pile.**"

日本語wiki「詳細なルール」（逐語）：
- 「多人数戦でアタックにより呪詛を受けるときは、**呪詛1枚だけを公開し、その効果を各被害者が受ける**。それぞれに1枚呪詛を公開するわけではないことに注意。」
- 「**堀や灯台などによって呪詛の影響を受けるプレイヤーが居ない場合でも、カードの指示があれば呪詛を1枚めくる。**」
- 「**呪詛の捨て札は一番上以外見てはならない。**」
- 「不運-アタックカードの使用に対して堀などでリアクションする場合、解決前すなわち**呪詛をめくる前**に公開して処理しなくてはならない。」

#### 0-4. 祝福・呪詛・状態は「カード」ではない — ルールブック逐語

> "**Boons, Hexes, and States are never in a player's deck**; like Events and Landmarks (from Adventures and Empires), they are physically cards but are **not "cards" in game terms**. They are thus never "cards in play," **receiving Boons and Hexes or taking a State is not "gaining a card,"** and so on."

#### 0-5. 状態（State）— ルールブック逐語

> "Three Hexes and one Kingdom card give players a State; this is a card that goes in front of a player and applies a rule. **Deluded and Envious affect a single turn, and then are returned; Miserable and Twice Miserable affect scoring at the end of the game;** Lost in the Woods affects one player's turns until another player takes it. **Deluded and Envious are on the same card; have the relevant side face-up.** Similarly Miserable and Twice Miserable are on the same card. **A State only applies while a player has it.**"

#### 0-6. 構成枚数・準備 — ルールブック逐語

構成（p.1）：`12 Boons` ／ `12 Hexes` ／ `12 each of Will-o'-Wisp, Wish` ／ `6 each of Ghost, Deluded / Envious, Miserable / Twice Miserable` ／ `1 of Lost in the Woods`。
＝**祝福・呪詛は各1枚ずつ／錯乱・嫉妬と生活苦・二重苦はプレイヤー人数分（6枚・両面1枚）／ウィル・オ・ウィスプは12枚**。

準備（p.2 逐語）：
> "If any Kingdom cards being used have the Fate type, shuffle the Boons and put them near the Supply, **and put the Will-o'-Wisp pile near the Supply also**. If any have the Doom type, shuffle the Hexes and put them near the Supply, **and put Deluded/Envious and Miserable/Twice Miserable near the Supply also**."
> "If Druid is being used, **deal three Boon cards face up for use with it**."（＝残り9枚が祝福の山）

**ウィル・オ・ウィスプ＝非サプライ**（英語wiki Spirit：「They are **outside the Supply**」）。日本語wiki：`ウィル・オ・ウィスプ／0*／アクション-精霊／+1 カードを引く／+1 アクション／あなたのデッキの一番上のカードを公開する。そのカードのコストが2以下なら、それを手札に加える。／(このカードはサプライには置かない。)`

#### 0-7. 表示（webp枠スキン）— 英語wiki逐語
- 祝福：「the Boon effects are printed on cards in a **landscape orientation with golden frames**」
- 呪詛：「... landscape orientation with **dark purple frames**」
- 状態：「... landscape orientation with **rusted frames**」

---

### A. 祝福（Boon）12種

すべて **種別＝祝福（Boon）／コスト無し／購入不可／横型**。
「日本語テキスト（カタログ用）」は本プロジェクトの既存書式（`+1 アクション` `+1 コイン` `山札` `捨て札置き場` `コスト4コイン以下` 全角括弧）に寄せた案、「日本語公式」は実カードの逐語（日本語wiki＋ドミニオンポータルで一致確認）。

---

#### A-1. The Earth's Gift ／ **大地の恵み**

**日本語テキスト（カタログ用）**
```
手札の財宝カード1枚を捨て札にして、
コスト4コイン以下のカード1枚を獲得してもよい。
```
**日本語公式**：「手札の財宝カード1枚を捨て札にして、コスト4以下のカード1枚を獲得してもよい。」

**英語原文（逐語・2017／現行とも同一）**：`You may discard a Treasure to gain a card costing up to [$4].`

**公式裁定**：ルールブック・英語wikiとも Official FAQ の実体なし。ただしドイツ語版が2文に分割されており（`Du darfst eine Geldkarte aus der Hand ablegen. Wenn du das tust: Nimm eine Karte, die bis zu [$4] kostet.`）、**捨てられなければ獲得もできない**ことが確定する。

**実装注意**
- **任意**。手札に財宝が無ければ pending を立てない（人間が詰まない／CPUがループしない）。捨てる財宝は本人が選ぶ。
- 「捨てる」は本物の捨て札＝`triggerOnDiscard` を通す（坑道／忠犬／村有緑地／織工が誘発する）。
- コスト判定は必ず `DOM.engine.costUpTo(state, id, 4)`＋`gainableBase`。素の `cardCost(state,id) <= 4` を書くと mix-all で本番 livelock（PROGRESS §0-23）。
- 日本語wiki：「これによって**恵みの村**を獲得した場合、追加で祝福を1つ受けることができる」＝**入れ子で祝福が発生する**。獲得時対話は `onGainQueue` に積む設計が必須。
- 資本主義（ルネサンス）併用時、「財宝カード」判定は `DOM.engine.isTreasureFor(state, id)` を使う。

---

#### A-2. The Field's Gift ／ **田畑の恵み**

**日本語テキスト（カタログ用）**
```
+1 アクション
+1 コイン
（これをクリーンアップフェイズまで持っておく。）
```
**日本語公式**：「+1 アクション　+1 コイン　(これをクリーンアップフェイズまで持っておく。)」

**英語原文（逐語）**：`+1 Action / +[$1] / (Keep this until Clean-up.)`

**公式裁定**：自身の Official FAQ は無い。関連する公式裁定が3つある（すべてルールブック逐語）。
- 聖なる木立ち項：「**The Field's Gift and The Forest's Gift are not shared.**」＝聖なる木立ちの「+$を出さない祝福なら他プレイヤーも受けてよい」に該当しない。
- ドルイド項：「leave it there in the set-aside area for Druid, **even if it is one of the Boons that says to keep it until Clean-up (e.g. The Field's Gift)**」
- ピクシー項：「If you receive a Boon that says to keep it until Clean-up, **move it to in front of you, and remember that you get it twice**.」

**実装注意**
- **強制**。効果（+1アクション／+1コイン）は**即時**。「クリーンアップフェイズまで持っておく」は**物理カードの居場所の規定**であって持続効果ではない。
- 機能的な帰結は1つだけ：**そのターン中、祝福の山にも捨て札にも戻らない＝ターン中にリシャッフルが起きても再抽選の対象にならない**。実装では「プレイヤーの前」という第3のゾーン（公開）を作り、クリンナップで祝福の捨て札へ返す。
- ピクシーで2回受けると **+2アクション +2コイン**。
- **+$を出す祝福は 田畑・森 の2種だけ**（聖なる木立ちの分岐条件の正本）。
- `+1 コイン` は必ず `addCoins(state, 1)`／`+1 アクション` は必ず `addActions(t, 1)` を通す（雪深い村・カメレオンの習性が静かに壊れる。PROGRESS §0-25）。

---

#### A-3. The Flame's Gift ／ **炎の恵み**

**日本語テキスト（カタログ用）**
```
手札のカード1枚を廃棄してもよい。
```
**日本語公式**：「手札のカード1枚を廃棄してもよい。」

**英語原文（逐語）**：`You may trash a card from your hand.`

**公式裁定**：Official FAQ なし（英語wikiの Official FAQ 節は空）。

**実装注意**
- **任意**。手札0枚なら pending を立てない。
- 廃棄は `trashCard(state, owner, card)` を通す（城塞／ネズミ／封土／狂信者／サー・ヴァンダー／草茂る屋敷／絹商人／旗手／石／墓／青空市場の on-trash が正しく誘発する）。

---

#### A-4. The Forest's Gift ／ **森の恵み**

**日本語テキスト（カタログ用）**
```
+1 購入
+1 コイン
（これをクリーンアップフェイズまで持っておく。）
```
**日本語公式**：「+1 カードを購入　+1 コイン　(これをクリーンアップフェイズまで持っておく。)」
※日本語版の "+1 Buy" 表記は「+1 カードを購入」。本プロジェクトの既存書式は `+1 購入`。

**英語原文（逐語）**：`+1 Buy / +[$1] / (Keep this until Clean-up.)`

**公式裁定**：Official FAQ なし。**聖なる木立ちでは共有されない**（+$を出すため・ルールブック明記）。ルールブックの通しプレイ例（p.4）にも登場：Avery が詩人で森の恵みを受け、自分の前に置き、+1購入と+$1を使い、クリンナップで祝福の捨て札に返している。

**実装注意**：A-2 と同型。

---

#### A-5. The Moon's Gift ／ **月の恵み**

**日本語テキスト（カタログ用）**
```
捨て札置き場を見る。
その中のカード1枚を山札の一番上に置いてもよい。
```
**日本語公式**：「あなたの捨て札のカードすべてを見る。その中のカード1枚をあなたのデッキの上に置いてもよい。」

**英語原文（逐語）**：`Look through your discard pile. You may put a card from it onto your deck.`

**公式裁定（ルールブック／英語wiki 逐語・一致）**
> "The Moon's Gift: **If your discard pile is empty, this will not do anything.**"

**エラッタ：無し。** 英語wikiのカードページの English versions は **2017年11月版の1行だけ**＝現行印刷でも `Look through your discard pile.` を保持している（2019年の一般ルール化で「削除してもよい」候補に挙がっただけで、**印刷は変わっていない**）。機能はいずれにせよ同一。

**実装注意**
- **前駆者(harbinger)と完全同型**。既存 reducer を流用できる（`js/engine.js` `case 'harbinger'`）。
- 捨て札を見るのは強制、山札の上に置くかは任意（日本語wiki：「捨て札のカードを見るのは強制だが、その中のカード1枚をデッキトップに置くかどうかは任意で選べる」）。実装上の差は出ない。
- オンラインでは**自分の捨て札は元から公開**なので看破の心配なし。

---

#### A-6. The Mountain's Gift ／ **山の恵み**

**日本語テキスト（カタログ用）**
```
銀貨1枚を獲得する。
```
**日本語公式**：「銀貨1枚を獲得する。」

**英語原文（逐語）**：`Gain a Silver.`

**公式裁定**：Official FAQ なし。設計者コメント（英語wiki Trivia「Why is it non-optional?」逐語）：
> "I considered "you may" for The Mountain's Gift but felt that it would look weird to give you that option if you weren't a super-serious player. And the expansion overall does a lot to entertain those not super-serious players, it's a good set for them." — Donald X. Vaccarino, Dominion Discord, 2017

**実装注意**
- **強制**（"you may" ではない）。日本語wiki：「引き切りデッキにとって邪魔だったり**山賊の砦**がある場合でも強制的に獲得しなければならない」＝拒否させないこと。
- 銀貨の山が空なら獲得しない（＝ここで pending を立てない）。
- 獲得なので望楼／そり／牧羊犬／鷹匠／追跡者などの獲得時リアクションが誘発する。ルールブック（追跡者項・逐語）：「Tracker is in play when you resolve its Boon, so **if the Boon causes you to gain a card, for example a Silver from The Mountain's Gift, you can put that card onto your deck**.」

---

#### A-7. The River's Gift ／ **川の恵み**

**日本語テキスト（カタログ用）**
```
このターンの終了時、+1 カード。
（これをクリーンアップフェイズまで持っておく。）
```
**日本語公式**：「このターンの終了時、+1 カードを引く。(これをクリーンアップフェイズまで持っておく。)」

**英語原文（逐語）**：`+1 Card at the end of this turn. (Keep this until Clean-up.)`

**公式裁定（ルールブック／英語wiki 逐語・一致）**
> "The River's Gift: **You draw the card after drawing your hand for your next turn.**"

ルールブック 聖なる木立ち項（逐語）：
> "The River's Gift means that **each player choosing to receive it draws a card at the end of your turn, at the same time as you.**"

**実装注意（本プロジェクト固有の最重要点）**
- 本エンジンは**自分の手番終了時に次の手札を先引きする**（`cleanupAndAdvance` 内 `draw(state, pi, 5 + extraDraw + flagBonus)`）。川の恵みの +1 カードは**その先引きの後**に置く。＝engine.js の **`turn.savedCard`（保存）／`turn.squirrelDraw`（リスの習性）とまったく同じ場所**。ここを先引きの前に置くと1ターンぶんずれる。
- 3枚の「保持する祝福」の中で**唯一、保持そのものが機能を持つ**（田畑・森は物理位置のみ）。
- 聖なる木立ちで他プレイヤーが受けた場合、その人も**使用者のターン終了時に同時に**1枚引く（＝他人の手番中に手札が増える）。実装するなら「保持している祝福」を全プレイヤーぶん持つ必要がある。
- 2025年の持続ルール変更（場を離れた持続は以後働かない）は**非カードには適用されない**＝川の恵みは無関係。

---

#### A-8. The Sea's Gift ／ **海の恵み**

**日本語テキスト（カタログ用）**
```
+1 カード
```
**日本語公式**：「+1 カードを引く」

**英語原文（逐語）**：`+1 Card`

**公式裁定**：Official FAQ なし。

**実装注意**：**強制**。祝福中で最も単純。山札・捨て札が両方空なら引けないだけ。

---

#### A-9. The Sky's Gift ／ **空の恵み**

**日本語テキスト（カタログ用）**
```
手札3枚を捨て札にして、金貨1枚を獲得してもよい。
```
**日本語公式**：「あなたの手札3枚を捨て札にして、金貨1枚を獲得してもよい。」

**英語原文（逐語）**：`You may discard 3 cards to gain a Gold.`

**公式裁定（ルールブック／英語wiki 逐語・一致）**
> "The Sky's Gift: **If you choose to do this with fewer than three cards in hand, you will discard the rest of your cards but not gain a Gold. Discarding three cards gets you one Gold, not three.**"

日本語wiki「詳細なルール」（逐語）：
> 「空の恵みで手札を捨てて金貨を獲得する効果は任意処理である。ただし、**捨てることを選択した場合、手札が3枚あれば3枚、それ未満なら全て捨てる。手札が3枚以上あるのに1枚や2枚だけを捨てることはできない。** また、金貨1枚を獲得する処理は3枚捨てた場合のみ実行される。**探索と同様。**」

**実装注意**
- **冒険の「探索(quest)」と同型**＝条件を満たさない選択肢も選べる。手札2枚でも「やる」を選べて、2枚捨てて金貨は得られない。engine は忠実に受理し、UI で「（金貨は得られません）」と明示するのが本プロジェクトの既定路線（PROGRESS §0-21）。
- **枚数は3枚固定**。手札が3枚以上あるときに1枚・2枚だけの部分実行は不可。
- **3枚は同時に捨てる**（日本語wiki逐語）：「例えば、手札からまず**坑道**を捨て札にする→坑道のリアクション効果で金貨を獲得→手札から**望楼**を公開し金貨をデッキの上に置く→望楼を捨て札にする…という動きはできない。」
- ただし「捨てた瞬間に自身が誘発する」ものは働く（日本語wiki逐語）：「手札の**村有緑地**を捨て札にする→村有緑地をリアクションして即座に『+1ドロー、+2アクション』を得る、という動きはできるが、**ここでドローしたカードを更に捨て札にすることはできない**。」

---

#### A-10. The Sun's Gift ／ **太陽の恵み**

**日本語テキスト（カタログ用）**
```
山札の上から4枚を見る。好きな枚数を捨て札にし、
残りを好きな順番で山札の一番上に戻す。
```
**日本語公式**：「あなたのデッキの上からカード4枚を見る。その中から好きな枚数を捨て札にし、残りを好きな順番でデッキの上に戻す。」

**英語原文（逐語）**：`Look at the top 4 cards of your deck. Discard any number of them and put the rest back in any order.`

**公式裁定**：Official FAQ なし。

**実装注意**
- **地図職人(cartographer)と完全同型**（見る4枚・捨て枚数任意〔0枚可〕・残りを好きな順で山札の上へ）。既存 reducer を流用できる（`js/engine.js` `case 'cartographer'`）。
- **強制だが捨て枚数0を選べる**＝実質辞退できる。
- **山札が4枚未満なら、見る前に捨て札をシャッフルして補充する**（ドミニオン共通ルール）。日本語wiki：「山札が3枚以下だとシャッフルが入ってしまうのが玉に瑕」。
- 捨てるので坑道／忠犬／村有緑地がリアクションできる（日本語wiki明記）。
- 「見る」であって「公開」ではない＝`reveal()` を通さない（パトロンは誘発しない）。**オンラインでは看破情報＝`maskStateFor` で他席から伏せること**（冒険の偵察隊で踏んだのと同型）。

---

#### A-11. The Swamp's Gift ／ **沼の恵み**

**日本語テキスト（カタログ用）**
```
ウィル・オ・ウィスプ1枚をそのカードの山から獲得する。
```
**日本語公式**：「ウィル・オ・ウィスプ1枚をそのカードの山から獲得する。」
※日本語版（2020年2月・HJ）は2017年英文ベースなので「そのカードの山から」を含む。

**英語原文（逐語・英語wiki English versions テーブルで2行を実見）**
| 版 | テキスト | 発売 |
|---|---|---|
| Nocturne | `Gain a Will-o'-Wisp from its pile.` | 2017年11月 |
| Nocturne (2021 printing) | **`Gain a Will-o'-Wisp.`** | 2021年1月 |

→ **機能変更ゼロの表記簡略化**（2019年の一般ルール化＝「非サプライのカードを名指しで獲得しろと言われたら、サプライに無くてもその山から獲得できる」に伴うもの）。ドイツ語版も同じく2017年 `Nimm ein Irrlicht vom Irrlicht-Stapel.` → Temple Gates 版 `Nimm ein Irrlicht.` の2行がある。

**公式裁定**：Official FAQ なし。

**実装注意**
- **ウィル・オ・ウィスプは非サプライ・12枚**（コスト $0*、アクション-精霊）。準備で、王国に幸運（Fate）カードがあれば**必ず**脇に置く＝**祝福を使うゲームには常に存在する**。
- **強制**。山が空なら獲得しない。
- 非サプライなので **`NON_SUPPLY` の4系統除外チェックリスト**を必ず通す：(1) `emptyPileCount`（3山終了）(2) `canBuyCard`（購入）(3) 闇市場デッキの母集団 (4) 汎用「$N以下を獲得」の engine 述語と CPU 候補（`gainableBase`）。**engine拒否とCPU非提案は必ずセット**（片側だけだと本番 livelock）。

---

#### A-12. The Wind's Gift ／ **風の恵み**

**日本語テキスト（カタログ用）**
```
+2 カード
手札からカード2枚を捨て札にする。
```
**日本語公式**：「+2 カードを引く　手札からカード2枚を捨て札にする。」

**英語原文（逐語）**：`+2 Cards / Discard 2 cards.`

**公式裁定**：Official FAQ なし。設計者コメント（英語wiki Boon ページ「Why are some Boons not optional?」逐語）：
> "It's strictly for simplicity. It's normally simpler to not make something optional. ... Instead what would matter is, if you don't know this rule, what would you guess from the cards. **If they don't all say "you may" I am betting more people would guess it's mandatory.**" — Donald X. Vaccarino, Dominion Discord, 2020

日本語wiki「詳細なルール」（逐語）：
> 「**風の恵みは強制処理である。＋2ドローを実行し、実際に2枚引けたかどうかに関わらず手札2枚を捨て札にする。**」

**実装注意**
- **強制**。引き切った後に受けるとセルフ手札破壊になる（偶像で特に痛い＝設計者も認めている）。
- **実際に2枚引けなくても手札から2枚捨てる**（手札が2枚未満ならある分だけ）。
- **2枚は同時に捨てる**（A-9 と同じ制約が全部かかる）。
- 宿屋(inn)と同型の入れ替え。

---

### B. 呪詛（Hex）12種

すべて **種別＝呪詛（Hex）／コスト無し／横型**。**任意（"you may"）のものは12種中1つも無い**（条件付きのものはある）。

---

#### B-1. Bad Omens ／ **凶兆**

**日本語テキスト（カタログ用）**
```
山札を捨て札置き場に置く。捨て札置き場をすべて見て、
その中から銅貨2枚を山札の上に置く。
（それができない場合、捨て札置き場をすべて公開する。）
```
**日本語公式**：「あなたのデッキを捨て札に置く。あなたの捨て札のカードすべてを見て、そこから銅貨2枚をデッキの上に置く。（それができない場合、捨て札のカードすべてを公開する。）」

**英語原文（逐語・2017／現行とも同一）**：`Put your deck into your discard pile. Look through it and put 2 Coppers from it onto your deck (or reveal you can't).`

**公式裁定（ルールブック／英語wiki 逐語・一致）**
> "Bad Omens: **Normally you will end up with a deck consisting of two Coppers, and a discard pile with the rest of your cards. Sometimes you will only have one or no Coppers; in those cases reveal your deck to demonstrate this.**"

英語wiki「Other rules clarifications」（逐語）：
> "**This doesn't count as discarding, so it will not activate Tunnel, Faithful Hound, or Village Green.**"

**実装注意**
- **最重要**：「山札を捨て札置き場に置く」は**捨てる(discard)ではない**＝坑道／忠犬／村有緑地／織工は**誘発しない**。宰相(chancellor)と同じ扱い。**`triggerOnDiscard` を通してはいけない。**
- 銅貨の山からではなく、**自分の捨て札の中の銅貨**を山札の上に戻す（＝獲得ではない）。
- 「(or reveal you can't)」の公開対象は**捨て札置き場**（英文の "it" ＝ discard pile／日本語公式も「捨て札のカードすべてを公開する」）。ルールブックFAQの "reveal your deck" は、直前に山札を全部捨て札へ移しているので実質同じものを指す緩い表現。
- 順序：①山札を全部捨て札置き場へ ②捨て札置き場を見る ③銅貨2枚を山札の上へ。結果、山札は銅貨2枚だけになる。
- **銅貨が1枚しか無い場合＝その1枚を山札の上に置き、かつ捨て札を公開する**（ドミニオンの「可能な限り実行する」原則）。日本語wiki 呪詛ページのコメント（2025-08-12／13）で明示的に確認：「その場合その銅貨1枚はトップ置きするのでしょうか？」→「**その通りです。**」「可能な限り実行するのはご認識の通りで、極端なことを言うとドミニオンでは+2ドローでデッキが1枚しかないから引けないといったことは無いですね。獲得物なども同様です。」／**銅貨0枚なら公開のみ**。※一次資料の明文ではなく原則＋日本語wikiの回答なので confidence: medium。
- 「Look through it」は将来の印刷で削除見込みだが**機能は同一**（2019年の一般ルール化＝「捨て札から選ぶ効果は明記しなくても捨て札を見てよい」）。

---

#### B-2. Delusion ／ **幻惑**

**日本語テキスト（カタログ用）**
```
あなたが錯乱も嫉妬も持っていなければ、錯乱を取る。
```
**日本語公式**：「あなたが錯乱も嫉妬も持っていなければ、錯乱を取る。」

**英語原文（逐語）**：`If you don't have Deluded or Envious, take Deluded.`

**公式裁定（ルールブック逐語）**
> "Delusion: **Deluded / Envious is two-sided; take it with the Deluded side face up.**"

**実装注意**
- **錯乱と嫉妬は同一カードの表裏＝同時には持てない**。既に錯乱か嫉妬を持っていれば**完全に空振り**（重ねがけ不可）。
- **幻惑を受けた瞬間には何も起きない**。効果本体は C-1（錯乱）。
- 状態は非カード＝保存則 tally（`allCards`・invariants の `ZONES`）に**絶対に入れない**。プレイヤーごとの公開スカラー1つ（`p.state = 'deluded' | 'envious' | null`）で足りる。
- 日本語wiki のコメント（2025-06-11）に「毎ターン12枚呪詛めくればアクションカード買えなくなるのか？って思ったけど**錯乱と嫉妬が排他的だから**それは無いのか。」＝排他性がゲームバランスの前提。

---

#### B-3. Envy ／ **羨望**

**日本語テキスト（カタログ用）**
```
あなたが錯乱も嫉妬も持っていなければ、嫉妬を取る。
```
**日本語公式**：「あなたが錯乱も嫉妬も持っていなければ、嫉妬を取る。」

**英語原文（逐語）**：`If you don't have Deluded or Envious, take Envious.`

**公式裁定（ルールブック逐語）**
> "Envy: **Deluded / Envious is two-sided; take it with the Envious side face up.**"

**実装注意**：B-2 と同型。効果本体は C-2（嫉妬）。

---

#### B-4. Famine ／ **飢饉**

**日本語テキスト（カタログ用）**
```
山札の上から3枚を公開し、そのうちのアクションカードを
すべて捨て札にする。残りを山札に混ぜてシャッフルする。
```
**日本語公式**：「あなたのデッキの上からカード3枚を公開し、公開したアクションカードすべてを捨て札にする。残りをあなたのデッキに加えてシャッフルする。」

**英語原文（逐語）**：`Reveal the top 3 cards of your deck. Discard the Actions. Shuffle the rest into your deck.`

**公式裁定（ルールブック／英語wiki 逐語・一致）**
> "Famine: **The revealed cards that are not Actions are shuffled back into your deck.**"

英語wiki「Other Rules clarifications」（逐語）：
> "**When all revealed cards are Actions, you still shuffle your deck.**"
> "**If your deck is empty after you discard the Actions and you have no cards return to your deck, you simply do nothing—you do not shuffle your discard pile to form a new deck.**"

日本語wiki：「デッキの上3枚が全てアクションカードで、デッキに戻すカードが無い場合も**デッキのシャッフルは発生する**ので注意。」

**実装注意**
- **シャッフル対象は「山札」であって捨て札ではない**。捨て札は絶対に混ぜない。ここを間違えると盤面が壊れる。
- 3段階：①上3枚を公開 ②その中のアクションを捨て札へ（`triggerOnDiscard` を通す） ③**非アクションを山札に戻し、山札全体をシャッフル**。
- **公開の時点で山札が3枚未満なら、捨て札をシャッフルして新しい山札を作り、3枚に足りるまで公開する**（ドミニオン共通ルール。日本語wiki 太陽の恵み「山札が3枚以下だとシャッフルが入ってしまう」／日本語wiki 呪詛コメント「[デッキの上から特定のカードが見つかるまで公開する]という効果であればすべて共通」）。上の英語wiki clarification は**最後の③の段だけ**の話（戻すカードが1枚も無いなら③をしない）。
- 公開なので `reveal()` を通す（**パトロン**＝アクションフェイズ中の公開で +1財源 が誘発する）。**他人のターン中に解決されるので、パトロンの「アクションフェイズ中」判定は手番プレイヤーのフェイズを見る**点に注意。
- 星図(star_chart・ルネサンス)を持っていれば、このシャッフルでも恩恵を受ける。ただし**山札トップに置けるのは山札に戻るカードだけで、捨て札にしたカードは選べない**（日本語wiki）。
- 「アクションカード」判定は静的種別でよい（資本主義でもアクション種別は消えない）。

---

#### B-5. Fear ／ **恐怖**

**日本語テキスト（カタログ用）**
```
手札が5枚以上の場合、手札からアクションカードか
財宝カード1枚を捨て札にする。
（それができない場合、手札を公開する。）
```
**日本語公式**：「あなたの手札が5枚以上あれば手札からアクションカードか財宝カード1枚を捨て札にする。（それができない場合、手札を公開する。）」

**英語原文（逐語・2017／現行とも同一）**：`If you have at least 5 cards in hand, discard an Action or Treasure (or reveal you can't).`

**公式裁定（ルールブック／英語wiki 逐語・一致）**
> "Fear: **You discard an Action or Treasure if you have either, and only reveal your hand if you have no Actions and no Treasures.**"

**実装注意**
- **二段の条件**：①手札4枚以下なら**完全に何も起きない**（公開もしない） ②手札5枚以上でアクションも財宝も無ければ**手札を公開する**（捨てない） ③あれば1枚捨てる（**強制・本人が選ぶ**）。
- アクションと財宝の両方の種別を持つカード（冠 crown など）も当然対象。
- 判定タイミングは**呪詛を解決するその瞬間の手札枚数**。アタックで複数人が受ける場合、各自が自分の手札で判定する。
- 財宝判定は `DOM.engine.isTreasureFor(state, id)` に統一する（資本主義下でもアクションでもあるので実害は薄いが、既存方針＝財宝参照は必ずこの述語）。
- 捨てるので `triggerOnDiscard` を通す（坑道／忠犬／村有緑地）。
- **候補ゼロ（アクションも財宝も無い）の終端保証が必須**＝engine 側で窓を閉じる。CPU の `decidePending` は `null` を返さない（オンラインで `reduce(state, null)` が TypeError → 部屋が固まる）。

---

#### B-6. Greed ／ **貪欲**

**日本語テキスト（カタログ用）**
```
銅貨1枚を獲得し、山札の一番上に置く。
```
**日本語公式**：「銅貨1枚を獲得し、あなたのデッキの上に置く。」

**英語原文（逐語）**：`Gain a Copper onto your deck.`

**公式裁定**：英語wiki に明記＝「**There is no official FAQ for Greed.**」（ルールブックにも項目なし）。

**実装注意**
- **「山札の上に獲得」＝捨て札置き場を経由しない**（日本語wiki：「この効果で獲得される銅貨は、**捨て札置き場を経由せずに直接デッキトップに獲得される**」）。武器庫(armory)と同じ `gain(state, pi, 'copper', 'deck')`（engine の `zoneOf` に `'deck'` あり）。
- 銅貨の山が空なら獲得しない。
- 獲得なので獲得時リアクションが誘発する。日本語wikiの明示例（逐語）：
  > 「銅貨の獲得に対して**牧羊犬**でリアクションした場合は、①銅貨をデッキトップに獲得 ⇒ ②牧羊犬でリアクションする ⇒ ③牧羊犬の使用時効果で2ドロー(1枚は必ず銅貨)という処理順になる。」
- **他人のターン中に自分が獲得する**ので、「自分の手番中の獲得」を条件とする on-gain（ヴィラ／交易商人／技術革新など）は発火しない。望楼／牧羊犬／鷹匠／そりは発火する。

---

#### B-7. Haunting ／ **憑依**

**日本語テキスト（カタログ用）**
```
手札が4枚以上の場合、その中のカード1枚を山札の一番上に置く。
```
**日本語公式**：「あなたの手札が4枚以上あれば、手札のカード1枚をあなたのデッキの上に置く。」

**英語原文（逐語）**：`If you have at least 4 cards in hand, put one of them onto your deck.`

**公式裁定**：英語wiki に明記＝「**There is no official FAQ for Haunting.**」（ルールブックにも項目なし）。

**実装注意**
- **手札3枚以下なら何も起きない**（公開もしない）。
- 置くカードは**本人が選ぶ**（強制・拒否不可）。
- 「置く」であって捨てるではない＝**捨て札トリガーは誘発しない**（`triggerOnDiscard` を呼ばない）。
- 幽霊船(ghost_ship)の1枚版。オンラインでは**何を置いたかは非公開**＝`maskStateFor` に注意。

---

#### B-8. Locusts ／ **蝗害**

**日本語テキスト（カタログ用）**
```
山札の一番上のカード1枚を廃棄する。
それが銅貨か屋敷の場合、呪い1枚を獲得する。
そうでない場合、廃棄したカードと同じ種別を1つ以上持ち、
それよりコストが少ないカード1枚を獲得する。
```
**日本語公式**：「あなたのデッキの一番上のカード1枚を廃棄する。廃棄したカードが屋敷か銅貨だった場合、呪い1枚を獲得する。そうでない場合、廃棄したカードと同じ種類を持ち、コストが少ないカード1枚を獲得する。」

**英語原文（逐語・2017／2021印刷とも同一）**：`Trash the top card of your deck. If it's Copper or Estate, gain a Curse. Otherwise, gain a cheaper card that shares a type with it.`

**公式裁定（ルールブック／英語wiki 逐語・一致）**
> "Locusts: **Types are the words on the bottom banner, like Action and Attack. If there is no cheaper card that shares a type - for example if the card trashed is Curse - the player does not gain anything.**"

英語wiki「Unofficial rules clarifications」（逐語）：
> "If you trash a card costing a [P] or [D], **the cheaper cards are those that cost less [$], [P], or [D] and also don't cost more [$], [P], or [D]**. For example, Village and University are both cheaper than Alchemist. Ruined Village and Engineer are both cheaper than City Quarter. **Nothing is cheaper than [$0].**"

日本語wiki（逐語・実装に直結する具体例）：
> 「獲得するカードは、廃棄したカードと**1つでも同じ種類を持つ**カードであれば良い。例えば**ゴーストタウン**（＝コスト3の夜行-持続カード）を廃棄した場合は、サプライに『コスト2以下の夜行を種類に含むカード』か『コスト2以下の持続を種類に含むカード』があれば獲得する。」
> 「**カードの獲得はサプライからしか行えないので、精霊カードやコウモリなど、サプライに置かないカードは獲得できない。**」
> 「**薬師**(コスト2+Pのアクションカード)を廃棄した際は、サプライに『コスト2以下のアクションカード(**堀**などが該当)』か、『コスト1+P以下のアクションカード(**変成**が該当)』があれば獲得する。」
> 「**技術者**(コスト0+負債4のアクションカード)を廃棄した際は、サプライに『コスト0+負債3以下のアクションカード(**廃墟**が該当)』があれば獲得する。」

**実装注意（この節で最も慎重を要する）**
- **コスト比較は成分別（component-wise strictly less）**＝`DOM.engine.costUnder(state, id, ref)`。**素の `cardCost(...) < N` を書くと mix-all で本番 livelock**（PROGRESS §0-23 の教訓そのもの）。
- **種別は「1つでも一致」でよい**。廃棄カードの `types` と候補の `types` の積集合が空でなければ可。
- **候補はサプライのみ**＝`gainableBase`（非サプライ：精霊3種／コウモリ／願い／賞品／戦利品／トラベラー成長先／馬 と、ロック中の分割山下段を弾く）。
- **銅貨／屋敷の分岐は種別ではなくカードidで判定**（銅貨は財宝、屋敷は勝利点だが、それぞれ「安い同種別」を探しに行かない）。**呪いの山が空なら何も獲得しない。**
- **呪いを廃棄したときは何も獲得しない**（$0 より安いものは無い）。廃墟（$0）も同様。日本語wiki：「呪いや廃墟や避難所を廃棄した場合には何も獲得しなくてよいので、むしろプラスになる。」
- **強制獲得だが候補ゼロがあり得る**＝engine 側に「候補ゼロなら窓を閉じる」終端保証が必須。CPU は `null` を返さない（`{type:'X', card:null}`）。
- 候補が複数あるときは**本人が選ぶ**。
- 廃棄は `trashCard` を通す（城塞は手札に戻る／ネズミは +1カード／封土は銀貨3枚／墓は +1VP／青空市場が反応）。
- 山札が空なら捨て札をシャッフルして補充してから廃棄。両方空なら何も起きない。

---

#### B-9. Misery ／ **みじめな生活**

**日本語テキスト（カタログ用）**
```
このゲームであなたがこれを受けるのが初めての場合、生活苦を取る。
そうでない場合、生活苦を裏返して二重苦にする。
```
**日本語公式**：「このゲーム中にあなたが初めてみじめな生活の効果を受けた場合、生活苦を取る。そうでない場合、生活苦を裏返して二重苦にする。」

**英語原文（逐語）**：`If this is your first Misery this game, take Miserable. Otherwise, flip it over to Twice Miserable.`

**公式裁定（ルールブック逐語）**
> "Misery: **If this hits you for a third time in a game, nothing will happen; you stay at Twice Miserable.**"

英語wiki の要約（逐語）：「giving you -2 [VP] when you first receive it, or **-4 [VP] total** if you've received it at least twice」

**実装注意**
- **1回目＝生活苦(-2VP)／2回目＝二重苦(-4VP)／3回目以降＝何も起きない**（-4 で頭打ち・**累積しない**＝合計 -4 であって -6 ではない）。
- 実装は `p.misery = 0 | 1 | 2` の整数1つで足りる（得点は `-2 × min(count, 2)`）。
- 生活苦／二重苦は**非カード**＝所有カード枚数（庭園・品評会・絹の道・壁・博物館・封土など）に一切影響しない。得点計算にだけ効く。
- **得点は負になり得る**（ランドマークと同じ）＝下限クランプ禁止。
- **engine の `scoreGame`／`vpOf` と CPU の `vpOfPlayer`／`winsIfEnds` の両方に同じ減点を入れる**。片方だけだと終局読みがずれて「勝てると思って買って負ける」（PROGRESS §0-26 の `tieTurns` と同じ事故）。
- **状態はプレイヤーごとに独立**。日本語wiki コメント（2024-12-09）で確認：「A・B双方が『生活苦』状態になります。みじめな生活に限らず、呪詛や祝福の効果はそれを受けた人にしか発揮しません。」「これらの状態はプレイヤー間で連動するものではありません。」（＝アーティファクトのような1点物ではない）

---

#### B-10. Plague ／ **疫病**

**日本語テキスト（カタログ用）**
```
呪い1枚を獲得し、手札に加える。
```
**日本語公式**：「呪い1枚を獲得し、あなたの手札に加える。」

**英語原文（逐語）**：`Gain a Curse to your hand.`

**公式裁定**：ルールブック・英語wikiとも Official FAQ の実体なし（wikiの Official FAQ 節は空）。

**実装注意**
- **手札に直接獲得＝捨て札置き場を経由しない**（日本語wiki：「この効果で獲得される呪いは、**捨て札置き場を経由せずに直接手札に獲得される**」）。`gain(state, pi, 'curse', 'hand')`。
- 呪いの山が空なら獲得しない。
- **手札への獲得は既存の獲得置換と競合し得る**＝彫刻家(sculptor)で踏んだのと同型。`triggerOnGain` の `nomad_camp` 句などが `dest !== 'hand'` でガードされていることを確認する。
- 手札が1枚増える。**同一のアタックでは呪詛は1枚しかめくられない**ので「疫病→恐怖」のような連鎖は同一アタック内では起きないが、**同ターンに複数の不運カードを使えば別々の呪詛が2回めくられる**（例：人狼2枚）ので、後の呪詛の手札枚数判定（恐怖5枚／憑依4枚／貧困3枚）には影響する。

---

#### B-11. Poverty ／ **貧困**

**日本語テキスト（カタログ用）**
```
手札が3枚になるように捨て札にする。
```
**日本語公式**：「手札が3枚になるように捨て札をする。」

**英語原文（逐語）**：`Discard down to 3 cards in hand.`

**公式裁定**：ルールブック・英語wikiとも Official FAQ の実体なし。

**実装注意**
- **民兵(militia)と完全同型**。既存の汎用 `discard_down` pending をそのまま流用できる（`js/engine.js`：`{ type:'discard_down', player, source, down, queue, next, drawAfter }`。暗黒時代の浮浪児4／傭兵3／sir_michael 3 と共用）。**閾値 `down: 3`／`drawAfter: 0`**。
- 手札3枚以下なら何も起きない。
- 呪詛そのものはアタックではない。堀／灯台の免疫は**不運アタックカードのプレイ**に対して判定され、免疫者はそもそも呪詛を受けない。

---

#### B-12. War ／ **戦争**

**日本語テキスト（カタログ用）**
```
コスト3コインまたは4コインのカードが公開されるまで、
山札の上からカードを公開する。
そのカードを廃棄し、残りを捨て札にする。
```
**日本語公式**：「コスト3か4のカードを1枚が公開されるまで、あなたのデッキを上から公開する。そのカードを廃棄し、残りを捨て札にする。」
※日本語版の実カード文はやや不自然（「カードを1枚が」）だが日本語wiki・ドミニオンポータルの2系統で同じ表記。カタログには上の自然な日本語を採用することを推奨（機能は同一）。

**英語原文（逐語）**：`Reveal cards from your deck until revealing one costing [$3] or [$4]. Trash it and discard the rest.`

**公式裁定（ルールブック／英語wiki 逐語・一致）**
> "War: **If you do not find a card costing [$3] or [$4], your entire deck will end up in your discard pile, with nothing trashed.**"

日本語wiki（逐語）：
> 「**コストに負債やポーションを含むカードは「3・4コストのカード」には該当しないので注意。**」
> 「公開された3・4コストのカードを廃棄するタイミングでは、**「他の公開されたカード」はまだ捨て札になっていない**ことに注意。例えば、公開された**ネズミ**を廃棄した際に、ネズミの廃棄時効果で+1ドローするが、この時にデッキが0枚であれば『**このタイミングでの捨て札のみ**』をシャッフルし新たなデッキとしてから1ドローし、その後「他の公開されたカード」を捨て札にする。」

日本語wiki コメント（2023-10-01・山札を掘り切ったとき）：
> 「戦争で、今ある山札を全て公開しても3,4コストのカードがなかった場合は、**捨て札をシャッフルして新しい山札を作り、公開を続けます**。その新しい山札を全て公開しても3,4コストのカードがなかった場合は、公開したカード全てを捨て札にして処理を終了します(よってカードの廃棄は発生しません)。これは戦争に限らず、[デッキの上から特定のカードが見つかるまで公開する]という効果であればすべて共通です。」

**実装注意**
- **破壊工作員(saboteur)と同型のディグ**。山札が尽きたら捨て札をシャッフルして続行し、それでも見つからなければ全部が捨て札になり何も廃棄されない。
- **コスト判定＝現在コスト（橋／街道／運河のコスト軽減後）が ちょうど $3 または $4 で、かつポーション費用も負債コストも持たないこと**。engine 内部の `costIsPlainCoin(id)` と `cardCost(state,id)` を併用する（`costExact(state, id, 3) || costExact(state, id, 4)` で成分別に書くのが安全）。
- **廃棄の順序が実装上シビア**：該当カードを廃棄する時点では、他の公開済みカードはまだ捨て札に置かれていない。廃棄時効果（ネズミの +1カード／城塞／封土／墓／青空市場）が先に走り、そのドローで山札が空ならその時点の捨て札だけをシャッフルする。
- 廃棄は `trashCard`／公開は `reveal()` を通す（パトロン）。
- 多くのゲームで初手が3-4なので**序盤に非常に刺さる**。夜想曲内では家宝の**呪われた金貨($4)／幸運のコイン($4)**、獲得手段が限られる**幽霊($4)** が狙われ得る（日本語wiki）。

---

### C. 状態（State）4種

すべて **種別＝状態（State）／コスト無し／横型／非カード**。プレイヤーの前に置かれ、**公開情報**。

---

#### C-1. Deluded ／ **錯乱**（幻惑 Delusion が与える）

**日本語テキスト（カタログ用）**
```
あなたの購入フェイズの開始時、これを戻す。
このターン、アクションカードを購入できない。
```
**日本語公式**：「あなたの購入フェイズの開始時、このカードを返し、あなたはこのターンが終わるまでアクションカードを購入できない。」

**英語原文（逐語・2017／2021印刷とも同一）**：`At the start of your Buy phase, return this, and you can't buy Actions this turn.`

**公式裁定（ルールブック／英語wiki 逐語・一致）**
> "Deluded: **This prevents you from buying Action cards during one turn, starting in the Buy phase. If you get Deluded during your turn before the Buy phase (such as with Leprechaun), it will apply that turn; normally it will apply to your next turn.**"

英語wiki「Other rules clarifications」（逐語）：
> "The effect doesn't kick in until the beginning of your Buy phase; **if you play Black Market during the Action phase, you can buy cards from the Black Market deck normally.**"
> "However, if you start your Buy phase, return Deluded, somehow return to your Action phase (for example by gaining Villa), and then play Black Market, you won't be able to buy Actions from the Black Market deck, since **Deluded's effect lasts for the rest of the turn once activated.**"
> "**You also won't be able to buy cards during a second Buy phase on the same turn.**"
> "**This does not stop you from gaining Action cards** via cards such as Horn of Plenty, Sunken Treasure, Tools, etc. in your Buy phase, since it is not buying."

日本語wiki「詳細なルール」（逐語）：
> 「錯乱や嫉妬の能力にある『返す』とは**手放して誰も保有していない共通プールへと戻すこと**である。**裏返すことではない。**」
> 「錯乱と嫉妬は**購入フェイズの開始時に誘発するまで効果を発揮しない**。言い換えれば、**手元にある間は影響を受けない**。『状態カード』でありながら、直観に反するため注意が必要である。」
> 「錯乱と嫉妬を得ていても、**闇市場や語り部や刈り入れによりカードを購入or財宝を使用した際は影響を受けない**。」
> 「錯乱と嫉妬が効果を発揮した後、**ヴィラ**などの効果でアクションフェイズに戻った際に上記のカードを使用したり、**王笏、資本主義、技術革新**などで購入フェイズに使用したりするときは、当然影響を受ける。」

日本語wiki の「間違いやすい例」2件（逐語要約）：
1. プレイヤーAが（購入フェイズ開始時**の後**の処理である）**呪われた村を購入して獲得**して錯乱／嫉妬を得た →「この購入フェイズ時には返すことは無く、効果を発揮しない。プレイヤーAの[次の購入フェイズ開始時]が訪れた際に返し、効果を発揮する。」「※[次の購入フェイズ開始時]が訪れるのはAの次ターンであることが多いが、**ヴィラなどの効果でアクションフェイズに戻り、再度購入フェイズに入る際でも訪れる**ので注意。」
2. プレイヤーBが（購入フェイズ開始時の処理である）**市場の町の効果でレプラコーンを使用**して錯乱／嫉妬を得た →「市場の町の処理を終えた後も、**まだ[購入フェイズ開始時]であるので、即座に返し、効果を発揮しなければならない**。」

**実装注意（この節で最も事故りやすい）**
- **状態を「持っている」間は何も起きない**。効果は**購入フェイズ開始時に「返す」ことで初めて発動**し、そのターンの残り全部に効く。「持っている＝効いている」と実装すると全部間違う。
- **`p.state`（保有）と `t.deludedActive`（このターン発動中）を別フィールドで持つ**こと。1つにまとめると必ず間違う。
- **禁じるのは「購入」だけ**。獲得（豊穣の角／値切り屋／技術革新／密輸人など）は自由。
- **夜行(Night)カードは「アクションカード」ではないので購入できる**。ただし**人狼（Action-Night-Attack-Doom）はアクションでもあるので購入できない**。同様に**冠(crown・Action-Treasure)も購入できない**（日本語wiki：「王国カードに(**冠以外の**)有用な財宝カードがある場合も相対的に影響が少なくなる」）。
- 「返す」＝プールに戻す。**裏返して嫉妬になるのではない。**
- 錯乱と嫉妬は**同一カードの表裏＝排他**。プレイヤーごとに1枚（構成は6枚）。
- 悟り(Enlightenment・日の出づる国)発動後は財宝も買えなくなるが、**当プロジェクトでは日の出づる国が未実装なので到達不能**。

---

#### C-2. Envious ／ **嫉妬**（羨望 Envy が与える）

**日本語テキスト（カタログ用）**
```
あなたの購入フェイズの開始時、これを戻す。
このターン、銀貨と金貨は 1 コインしか生み出さない。
```
**日本語公式**：「あなたの購入フェイズの開始時、このカードを返し、このターンが終わるまで銀貨と金貨は1コインのみ生み出す。」

**英語原文（逐語・2017／2021印刷とも同一）**：`At the start of your Buy phase, return this, and Silver and Gold make [$1] this turn.`

**公式裁定（ルールブック／英語wiki 逐語・一致。※pdftotext で金額が脱落しているので英語wikiで復元）**
> "Envious: **This causes Silver and Gold to make [$1] when you [play them] in your Buy phase for one turn, rather than their usual [$2] and [$3], starting in the Buy phase. It does not affect other Treasures, just Silver and Gold.** If you get Envious during your turn before the Buy phase (such as with Leprechaun), it will apply that turn; normally it will apply to your next turn."

英語wiki「Other rules clarifications」（逐語）：
> "**Silvers and Golds played before your Buy phase, such as by Storyteller, are not affected.**"
> "**Once you return Envious, it will affect your Silvers and Golds for the rest of the turn, even if you return to the Action phase with Villa or Cavalry and then start a new Buy phase.**"
> "If you don't follow the instructions of a Silver or Gold (due to Enlightenment or Highwayman), Envious will have no effect."
> "If both Envious and Enlightenment are active and you play a Silver in your Buy phase as Way of the Chameleon, you will only get +1 Card."

設計者コメント（なぜ銀貨・金貨だけか。英語wiki Trivia）：
> "We know everything about Silver and Gold, and can say they make [$1] without needing to clarify what happens to below-the-line text or what have you." — Donald X. Vaccarino, Interview with Donald X.

**実装注意**
- **銀貨と金貨のみ**。白金貨・特殊財宝・仮想コイン（財源／村人／コイントークン）には一切効かない。日本語wiki：「ステロや、金貨銀貨を金量源としているコンボデッキには非常に良く刺さるが、**仮想コインや特殊財宝や白金貨相手には効果がない**。」
- C-1 と同じく**「返す」で発動、そのターンの残り全部に効く**。**アクションフェイズ中に出した銀貨・金貨（語り部／闇市場／刈り入れ等）は影響を受けない**。逆に、発動後にヴィラ／騎兵でアクションフェイズに戻って語り部を使ったり、王笏／資本主義／技術革新で購入フェイズに使ったりすると影響を受ける。
- 実装は `applyTreasureEffect` の銀貨／金貨分岐で「`t.enviousActive` なら +$1」とするのが素直。**必ず `addCoins(state, n)` を通す**（カメレオンの習性が壊れる）。
- ティアラ／冠／偽造通貨で銀貨・金貨を**2回使う場合、各プレイが $1**（＝合計 $2）。`applyTreasureEffect` に書けば `treasure_replay` の2回目も自動で正しくなる（PROGRESS §0-15）。
- 商人(merchant)の「このターン最初に銀貨を出したとき +1コイン」は別枠なので加算される（銀貨の $1 ＋ 商人の $1）。
- 英語wikiが挙げる「悟り＋カメレオンの習性」の例は、**悟り（日の出づる国）が未実装なので到達不能**（習性はアクションカードにしか使えず、財宝をアクションにするのは悟りだけ。資本主義は逆方向）。

---

#### C-3. Miserable ／ **生活苦**（みじめな生活の1回目）

**日本語テキスト（カタログ用）**
```
-2 勝利点
```
**日本語公式**：「-2 勝利点」

**英語原文（逐語）**：`-2 [VP]`

**公式裁定（ルールブック／英語wiki 逐語・一致）**
> "Miserable: **When scoring at the end of the game, you lose 2 [VP]. This does nothing until then, it just sits in front of you.**"

**実装注意**：得点計算時のみ効く。所有カードではない。得点は負になり得る＝クランプ禁止。

---

#### C-4. Twice Miserable ／ **二重苦**（みじめな生活の2回目）

**日本語テキスト（カタログ用）**
```
-4 勝利点
```
**日本語公式**：「-4 勝利点」

**英語原文（逐語）**：`-4 [VP]`

**公式裁定（ルールブック逐語）**
> "Twice Miserable: **When scoring at the end of the game, you lose 4 [VP]. This does nothing until then, it just sits in front of you.**"

**実装注意**：生活苦の裏面。**-2 と -4 は累積しない**（合計 -4 であって -6 ではない）。3回目以降は何も起きない。

---

### D. エラッタまとめ（この節の28枚）

**機能変更は1件も無い。**

| 対象 | 変更 | 種類 | 反映 |
|---|---|---|---|
| **The Swamp's Gift ／ 沼の恵み** | `Gain a Will-o'-Wisp from its pile.` → `Gain a Will-o'-Wisp.` | **表記のみ**（2019年の一般ルール化＝非サプライを名指しなら山から獲得できる） | **2021年1月印刷で反映済**（英語wikiの English versions に2行を実見）。**日本語版（2020年2月・HJ）は旧表記のまま**（「そのカードの山から」を含む） |
| Bad Omens ／ 凶兆 | `Look through it` の削除が将来の印刷で見込まれる | **表記のみ** | **未反映**（English versions は2017年版の1行のみ）。機能は同一 |
| The Moon's Gift ／ 月の恵み | `Look through your discard pile.` の削除が検討された | **表記のみ** | **未反映**（English versions は2017年版の1行のみ）＝**現行印刷でも文面は変わっていない**。機能は同一 |
| Locusts ／ 蝗害、The Sun's Gift ／ 太陽の恵み、Deluded ／ 錯乱、Envious ／ 嫉妬 | 2021年印刷で再版（テキスト同一） | **書式のみ** | 2021年1月。**テキストは1文字も変わっていない**（English versions の2行を実見して確認）。※他のカードにも 2021 printing 行が有り得るが、取得できたスナップショットが2022〜2023年のものだったため未確認。いずれにせよ**文面変更は沼の恵みの1件だけ** |

2022／2023／2025 の各 Errata に本節該当カードは**1枚も無い**。2025 Errata の持続ルール変更（場を離れた持続は以後働かない）は**非カードには適用されない**ので、川の恵み等の祝福には無関係。

---

### E. 実装の横断メモ（このプロジェクト向け）

1. **祝福・呪詛・状態は「カード」ではない。** 横型カードの表示基盤（`DOM.LANDSCAPES` の `kind:'boon' | 'hex' | 'state'`）は流用するのが自然（イベント／ランドマーク／プロジェクト／アーティファクト／習性と同じ道）。ただし **`allCards` と invariants の `ZONES` には絶対に入れない**（`state.pileVP` / `state.artifacts` / `p.villagers` と同型の非カード）。`carddata.js` の `typeLabel` に「祝福／呪詛／状態」を追加、`tools/build-landscape.js` に **金枠（boon）／濃紫枠（hex）／錆色枠（state）** の3スキンを追加する。
2. **山と捨て札は別トップレベル**：`state.boonDeck` / `state.boonDiscard` / `state.hexDeck` / `state.hexDiscard`。**マスク配信では山の中身を全員に伏せ、捨て札は一番上だけ公開**（順序が漏れると看破＝冒険の偵察隊・保存で踏んだのと同型）。
3. **「プレイヤーの前に置かれた祝福」は第3のゾーン**（`p.boonsHeld`・公開）。田畑／森／川の3種＋恵みの村の先送りぶん＋ドルイドの脇3枚。クリンナップで祝福の捨て札へ返す。**ここに在る間はリシャッフルに入らない**（＝「解決中の祝福」も入らない。日本語wiki コメント 2025-03-05 で確認）。
4. **祝福の山も捨て札も空なら、祝福を受けろと言われても受けない**（英語wiki Boon 逐語）。
5. **強制／任意の正本**（engine が pending を立てるかどうか）
   - **任意（may）＝4つだけ**：大地（財宝を捨てるか）／炎（廃棄するか）／空（3枚捨てるか）／月（山札の上に置くか）。
   - 太陽は「好きな枚数を捨てる」で0枚可＝実質辞退できる（強制だが空振り可）。
   - **強制＝田畑・森・山・川・海・沼・風**。
   - **呪詛は12種すべて強制**（条件付きのものはあるが "you may" は1つも無い）。
6. **候補ゼロの終端保証が必要な pending**：蝗害（安い同種別がサプライに無い）／恐怖（アクションも財宝も無い）／大地（$4以下の獲得先が無い）。engine 側で窓を閉じ、CPU の `decidePending` は **`null` を返さない**（オンラインで `reduce(state, null)` が TypeError → 部屋が固まる）。
7. **コスト述語は必ず `DOM.engine` の公開関数を使う**：大地＝`costUpTo(...,4)`＋`gainableBase`／蝗害＝`costUnder`＋`gainableBase`＋種別の積集合／戦争＝`costExact(...,3) || costExact(...,4)`。**素の `cardCost(state,id) <= N` は mix-all で本番 livelock**（PROGRESS §0-23）。
8. **捨て札トリガーの誘発／非誘発を取り違えない**
   - **誘発する**（`triggerOnDiscard` を通す）＝大地（財宝1枚）・空（3枚）・風（2枚）・太陽（任意枚数）・貧困・恐怖・飢饉。
   - **誘発しない**＝**凶兆**（「山札を捨て札置き場に置く」は discard ではない＝英語wiki明記）・**憑依**（「置く」）。
   - ⚠️ **`triggerOnDiscard` は engine 全体の捨て札経路に配線されていない**（PROGRESS §0-25：「`.discard.push(` は engine 全体で113箇所」）。夜想曲の捨て札経路には自分で `triggerOnDiscard` を呼ぶこと。
9. **`+1 アクション` は `addActions(t, n)`／`+1 コイン` は `addCoins(state, n)` を必ず通す**（`t.actions += n` / `t.coins += n` を直接書かない＝雪深い村とカメレオンの習性が静かに壊れる）。
10. **不運アタックの窓は「呪詛をめくる前」**。堀／灯台のリアクションを全部解決してから**1枚だけ**めくり、免疫でない全員が同じ呪詛を受ける。**免疫者しかいない場合でも1枚めくる**（日本語wiki。confidence: medium）。
11. **夜想曲の不運（Doom）カード6種に持続は1枚も無い**（レプラコーン＝アクション-不運／暗躍者 Skulk＝アクション-アタック-不運／呪われた村＝アクション-不運／迫害者 Tormentor＝アクション-アタック-不運／吸血鬼＝夜行-アタック-不運／**人狼**＝ルールブック逐語 `Action - Night - Attack - Doom`／日本語wikiの型欄は「夜行-アタック-不運」表記＝いずれにせよ**持続を含まない**）。**＝相手のターンをフックする窓は生じないので `LINGER_REACT` の許可リストは触らない**（門番／呪いの森／沼の妖婆の既存配線を壊さないこと）。※王国カード側の型は別担当の節が正本。
12. **みじめな生活の減点は engine と CPU の両方に入れる**（`scoreGame`／`vpOf` と `vpOfPlayer`／`winsIfEnds`）。片方だけだと終局読みがずれる（PROGRESS §0-26 の `tieTurns` と同じ事故）。
13. **錯乱／嫉妬は「持っている」ではなく「購入フェイズ開始時に返して発動」**。`p.state`（保有）と `t.deludedActive` / `t.enviousActive`（このターン発動中）を**別フィールド**で持つ。1つにまとめると必ず間違う。
14. **川の恵みの +1カードは `cleanupAndAdvance` の先引き（`draw(state, pi, 5+…)`）の後**＝`turn.savedCard`／`turn.squirrelDraw` とまったく同じ位置に置く。
15. **新 pending は4点セット必須**（engine reducer＋`PLAYER_ACTIONS`＋CPU `decidePending`＋UI `viewPendingModal`）。この節で pending が要るのは：大地（捨てる財宝／獲得先）／炎（廃棄）／空（やるか）／月（置くか＋どれ）／太陽（捨て枚数＋順序）／風（捨てる2枚）／恐怖（捨てる1枚）／憑依（置く1枚）／蝗害（獲得先）／貧困（`discard_down` 流用）。

---

### F. 敵対検証：下書きから訂正した点

| # | 箇所 | 下書き（誤） | 訂正（正） | 一次資料 |
|---|---|---|---|---|
| 1 | E-8 | 「持続アタック（人狼）は `LINGER_REACT` の許可リストにも足すこと」 | **人狼は持続ではない**（Action-Night-Attack-Doom）。夜想曲の不運6種に持続は1枚も無く、`LINGER_REACT` は無関係 | ルールブック 549-550行 `Action - Night - Attack - Doom` |
| 2 | 未確認#2（飢饉） | 「山札が3枚未満のとき、補充しないと推定」 | **補充する**（共通ルール）。英語wikiの clarification は最後の「残りを山札に混ぜてシャッフル」段だけの話 | 日本語wiki 太陽の恵み／呪詛コメント（2023-10-01） |
| 3 | 未確認#1（凶兆） | 「銅貨1枚のとき置くか置かないか一次資料に明示なし」 | **その1枚を山札の上に置き、かつ公開する**（可能な限り実行する原則） | 日本語wiki 呪詛コメント（2025-08-12／13） |
| 4 | 未確認#4（月の恵み） | 「2019 Errata と英語wiki Nocturne ページが矛盾」 | 矛盾ではない。**現行印刷は2017年版のまま**（English versions は1行だけ）＝`Look through` を含む文が現行 | 英語wiki The Moon's Gift の English versions |
| 5 | C-1／C-2 | 錯乱の闇市場裁定だけを記載 | **嫉妬側の同裁定（語り部／刈り入れで購入フェイズ前に出した銀貨・金貨は影響なし）と、発動後にヴィラ／騎兵で戻る・王笏／資本主義／技術革新で購入フェイズに使う場合は影響を受ける**を追加 | 英語wiki Envious「Other rules clarifications」／日本語wiki 呪詛「詳細なルール」 |
| 6 | C-1 | 「夜行カードは購入できる（例外：人狼）」のみ | **冠(crown・Action-Treasure)も購入できない**を追加 | 日本語wiki 幻惑「(冠以外の)有用な財宝カード」 |
| 7 | B-8 | コスト比較の具体例が英語wikiの1文のみ | **薬師($2+P)／技術者($0+負債4)／ゴーストタウン($3 夜行-持続)の3例**を追加（実装の判定表そのもの） | 日本語wiki 蝗害 |
| 8 | A-6 | 設計者コメントを途中で切っていた | 英語wiki Trivia「Why is it non-optional?」の全文＋出典（Dominion Discord, **2017**）に修正 | 英語wiki The Mountain's Gift |
| 9 | B-10 | 「同ターンに別の呪詛で恐怖の判定に影響」 | **1回のアタックでめくる呪詛は1枚だけ**。影響するのは同ターンに不運カードを複数回使った場合と明記 | ルールブック「turn over just one Hex」 |
| 10 | D（エラッタ表） | 「Deluded/Envious/Fear/Locusts/Bad Omens が2021年印刷で再レイアウト」 | 実見できた2021印刷行は **Locusts／The Sun's Gift／Deluded／Envious** の4枚（下書きに無い The Sun's Gift を追加、Fear・Bad Omens は未確認扱いに降格）。いずれも**テキストは同一**で、文面が変わったのは**沼の恵みの1件だけ** | 英語wiki 各ページの English versions |
| 11 | A-11 | 「日本語公式は 鬼火」的な混同なし（英語wikiの JP 訳は「鬼火」を使う） | 日本語公式は**ウィル・オ・ウィスプ**（英語wikiの JP 訳「(鬼火の山から)鬼火1枚」は非公式訳） | 日本語wiki ウィル・オ・ウィスプ |
| 12 | 全カタログ文 | `コスト4以下` `+1 コイン` 等の表記が本プロジェクトの既存書式と不統一 | 既存書式に統一（`コスト4コイン以下`＝移動動物園イベントの表記／全角括弧／`山札`『捨て札置き場』） | `js/cards.js` の既存エントリを実見 |

**下書きが正しかった主な項目**（再検証して確認済み・変更なし）：日本語公式名28件すべて／英語wikiの日本語名が10件誤りという指摘／沼の恵みの2021エラッタ／凶兆が discard でないこと／空の恵みの「探索と同様」／風の恵みが強制／山の恵みが強制／川の恵みの先引き後ドロー／飢饉が山札だけをシャッフルすること／みじめな生活が -4 で頭打ち／錯乱・嫉妬が「返して初めて発動」／貧困＝民兵同型／戦争のディグと廃棄順序／状態の枚数と構成。

---

### G. 確認できなかったこと

1. **【凶兆】銅貨1枚のときの挙動** — 一次資料（ルールブックFAQ・英語wiki）は「置くかどうか」に触れていない。日本語wiki のコメント回答＋ドミニオンの「可能な限り実行する」原則から**置く**と判断した。**confidence: medium**。実装前に Shuffle iT 実機で確認できればなお良い。
2. **【不運アタック】全員が免疫（堀／灯台）のとき呪詛をめくるか** — 日本語wiki は「めくる」と明記するが、英語の一次資料（ルールブック・英語wiki Hex ページ）に対応する記述を見つけられなかった。**confidence: medium**（日本語wikiのみ）。呪詛の山の消化ペース＝相手の呪詛予測に影響するので、実装で明示的に決める必要がある。
3. **【飢饉】公開時の補充シャッフル** — 飢饉固有の明文は無く、共通ルール＋日本語wiki の同型カード解説からの帰結。**confidence: medium-high**（同型の太陽の恵み・戦争では明文あり）。
4. **日本語版の実カード（HJ 2020年2月版）の写真照合はしていない** — 日本語名・日本語文面は「日本語wiki」「日本語wiki 夜想曲カードリスト」「ドミニオンポータル」の**3系統が全件一致**することで担保した。ホビージャパン公式サイトには**種別名6語（夜行／家宝／幸運／不運／祝福／呪詛）と正誤表の《ドルイド》しか載っておらず**、祝福・呪詛の個別名は公式サイトからは取れない。
5. **【戦争】日本語公式文が文法的に不自然**（「コスト3か4のカードを1枚が公開されるまで」）— 2系統とも同じ表記なので実カードのママと思われるが実物照合はしていない。カタログには自然な日本語を採用することを推奨（機能は明確）。
6. **Twice Miserable の英語wikiカードページ**は Wayback から取得できなかった（Bad Gateway の連続）。テキスト・FAQ ともルールブック逐語で確認済みなので実害なし。
7. **2019 Errata／2021 Errata のページ本文**も取得できなかった。ただしエラッタの結論（沼の恵みの文面変更・他は変更なし）は**各カードページの English versions テーブル（版ごとの実テキスト）で直接確認済み**なので、より強い証拠に置き換わっている。

---

**取得済み一次資料の保存先**（再検証用）
- ルールブック：`nocturne_rulebook.txt`（909行）
- 英語wiki：`v2/p_*.txt`（Boon／Hex＋祝福12・呪詛12・状態3の個別ページ）／State 概要は `v2/ADV_boon_hex_state.txt`
- 日本語wiki：`jp_boon.txt`（祝福）／`jp_hex.txt`（呪詛）／`jpx_夜想曲.txt`（カードリスト）／`jpx_ウィル・オ・ウィスプ.txt`
- 取得スクリプト：`v2/bh.py`（Wayback 経由・記号を `[$1]` に復元・ページ単位でキャッシュ）

---

# パート6：家宝7種・非サプライ8種・状態5種

## 夜想曲（Nocturne）：家宝7種 ＋ 非サプライ8種 ＋ 状態5種 ＝ 20枚

**検証者メモ**：本節は先行下書きの**敵対的再検証**として、全項目を一次資料から引き直したものである。下書きの引用は一切流用していない。

### 使った一次資料（この順に強い）
1. **RGG 公式ルールブック英語版（2017年11月・実DL＋pdftotext）** `nocturne_rulebook.txt`（909行）。
   ⚠️ pdftotext がコイン/VP記号を落とすため、**数値はすべて別資料で裏取りした**。また**このPDFは2017年初版**なので、カード文は旧版である。
2. **英語wiki（wiki.dominionstrategy.com・Wayback経由で自前再取得）**。`Card text`（現行文）／`Official FAQ`／`Versions`（版ごとの逐語）／`Other language versions`。
   取得スナップショット：Magic_Lamp=`20241201id_`(2025-01-04編集)／Haunted_Mirror・Wish・Ghost・Bat・Miserable・Envious・Pasture=`2id_`〜`2025id_`／2021_Errata=`20250601id_`／2025_Errata=`20241201id_` ほか。
3. **日本語wiki wikiwiki.jp/dominiondeck（自前再取得）**：`夜想曲` 一覧＋個別16ページ＋`呪詛`。**日本語版カードの実文面（英日併記表）と「詳細なルール」節**を逐語取得。
4. **ホビージャパン公式 製品ページ（`hobbyjapan.games/dominion/nocturne/`）**：日本語の**種別名**と**発売時期**の一次確認。

---

## 0. 共通ルール（この20枚すべてに効く前提）

### 0-1. 日本語の公式種別名（★実装の命名はここに従う）

ホビージャパン公式ページ 逐語：
> 「このセットは500枚のカードからなり、33種の新たな王国カードを収録しています。購入フェイズが終わったあとにプレイできる**夜行**カード、初期デッキの銅貨と入れ替えて使用する**家宝**カード、**祝福**と**呪詛**をもたらす**幸運**カードと**不運**カード、他にも様々な新カードが登場します。」

| 英語 | 日本語（採用） | 根拠 |
|---|---|---|
| Night | **夜行** | HJ公式 逐語（★タスク指示の候補「夜」は**誤り**） |
| Heirloom | **家宝** | HJ公式 逐語 |
| Fate | **幸運** | HJ公式 逐語 |
| Doom | **不運** | HJ公式 逐語 |
| Boon | **祝福** | HJ公式 逐語 |
| Hex | **呪詛** | HJ公式 逐語 |
| Spirit | **精霊** | 日本語wiki（「アクション-精霊」＝3種） |
| Zombie | **ゾンビ** | 日本語wiki（「アクション-ゾンビ」） |
| State | **状態** | 日本語wiki 呪詛ページ「各**状態**カード」 |
| Duration | 持続 | 既存カタログどおり |

**★日本語版の発売は 2019年1月**（HJ公式 製品ページ「発売日 2019年1月」）。したがって**日本語版カードは2017年文面で印刷されている**（2021年印刷での文面変更は日本語版に反映されていない）。
本プロジェクトの既定方針（§0-22 ルネサンス）に従い、**現行（最新エラッタ後）を採用**する。日本語版と現行英語版で文面が違う5枚（呪われた金貨／ヤギ／呪いの鏡／幸運のコイン／魔法のランプ）は、各項に**両方**を記載した。

### 0-2. 家宝（Heirloom）＝開始デッキの銅貨と置き換わる非サプライ財宝

ルールブック 逐語：
> "If any Kingdom cards being used have a yellow banner indicating an Heirloom, players start the game with that Heirloom replacing what would normally be a Copper. **For example in a game with Pixie and Tracker, players start with 3 Estates, 5 Coppers, a Goat, and a Pouch.** The unused Coppers go in the Copper pile."

- **開始デッキは常に10枚**。家宝1枚につき銅貨が1枚減る（家宝2枚なら 屋敷3＋銅貨5＋家宝2）。**入れ替えた銅貨は銅貨の山に戻す**（日本語wiki「入れ替えた銅貨は、サプライの山札に戻す。」）。
- **家宝はサプライ山から来ない**（各1枚が直接デッキへ）。英語wiki Heirloom 逐語：*"Unlike Coppers, Heirlooms don't come from a supply pile. Therefore they can't be returned or distributed with **Ambassador**."*
  （※先行下書きの「Panic でも戻らない」は現行 Heirloom ページに記載が無い＝**未確認**。Panic は略奪＝未実装なので実害なし。）
- 物理枚数は**各6枚**（＝最大6人ぶん）。ゲーム中に増える手段は無い＝**1人1枚が上限**。
- 対応表（コスト順・英語wiki Heirloom ページ逐語）：
  `$0` **呪いの鏡**/(墓地)・**魔法のランプ**/(秘密の洞窟)　`$2` **ヤギ**/(ピクシー)・**牧草地**/(羊飼い)・**革袋**/(追跡者)　`$4` **呪われた金貨**/(プーカ)・**幸運のコイン**/(愚者)

### 0-3. 非サプライ山の準備条件（ルールブック 逐語）

> "If any Kingdom cards being used have the Fate type, shuffle the Boons and put them near the Supply, **and put the Will-o'-Wisp pile near the Supply also**. If any have the Doom type, shuffle the Hexes and put them near the Supply, **and put Deluded/Envious and Miserable/Twice Miserable near the Supply also**.
> If Druid is being used, deal three Boon cards face up for use with it. **If Necromancer is being used, put the three Zombies into the trash. If Fool is being used, get Lost in the Woods and have it handy. If Vampire is being used, put the Bat pile near the Supply. If Leprechaun or Secret Cave is being used, put the Wish pile near the Supply. If Devil's Workshop or Tormentor are being used, put the Imp pile near the Supply; if Cemetery is being used, put the Ghost pile near the Supply; and if Exorcist is being used, put all three Spirit piles - Will-o'-Wisp, Imp, and Ghost - near the Supply.**"

枚数はルールブックの内訳（"66 Other cards"）逐語：`13 of Imp` / `12 each of Will-o'-Wisp, Wish` / `10 of Bat` / `6 each of Ghost, Deluded / Envious, Miserable / Twice Miserable` / `1 of Lost in the Woods` / `3 Zombies`。

| 山 | 枚数 | 準備条件 |
|---|---|---|
| ウィル・オ・ウィスプ | **12** | **幸運(Fate)カードが1枚でもある**（沼の恵みが配るため）／悪魔祓い |
| インプ | **13** | 悪魔の工房／迫害者／悪魔祓い |
| 幽霊 | **6** | 墓地／悪魔祓い |
| 願い | **12** | レプラコーン／秘密の洞窟（＝魔法のランプが配るため） |
| コウモリ | **10** | 吸血鬼 |
| ゾンビ3種 | **各1** | ネクロマンサー（**廃棄置き場に表向きで置く**） |
| 錯乱/嫉妬・生活苦/二重苦 | **各6**（両面） | **不運(Doom)カードが1枚でもある** |
| 森の迷子 | **1** | 愚者 |

- **幸運(Fate)＝8枚**：詩人・恵みの村・ドルイド・愚者・偶像・ピクシー・聖なる木立ち・追跡者。
- **不運(Doom)＝6枚**：呪われた村・レプラコーン・暗躍者・迫害者・吸血鬼・人狼。

### 0-4. 「交換(exchange)」は獲得ではない（ルールブック 逐語）

> "Nocturne has three cards that tell a player to "exchange" a card for another card. The card being exchanged is **returned to its Supply pile, or non-Supply pile**, and the card being exchanged for is taken and **put into the player's discard pile. This does not count as gaining a card.** The exchange only happens if both cards can be exchanged; **if the pile is empty, the cards are not exchanged.**"

→ 該当3枚＝**吸血鬼／コウモリ／取り替え子**。**獲得トリガーも廃棄トリガーも発火しない**。

### 0-5. 祝福・呪詛・状態は「カード」ではない（ルールブック 逐語）

> "Boons, Hexes, and States are never in a player's deck; like Events and Landmarks (from Adventures and Empires), **they are physically cards but are not "cards" in game terms.** They are thus never "cards in play," receiving Boons and Hexes or **taking a State is not "gaining a card,"** and so on."
> "Three Hexes and one Kingdom card give players a State; this is a card that goes in front of a player and applies a rule. **Deluded and Envious affect a single turn, and then are returned; Miserable and Twice Miserable affect scoring at the end of the game; Lost in the Woods affects one player's turns until another player takes it. Deluded and Envious are on the same card**; have the relevant side face-up. **Similarly Miserable and Twice Miserable are on the same card. A State only applies while a player has it.**"

**★状態カードは横型（landscape）**。英語wiki State ページ 逐語：*"the State effects are printed on cards in a **landscape** orientation with **rusted frames**."*
→ **画像生成は `tools/build-landscape.js` 側**（縦型 `build-cards.js` ではない）。既存の event/landmark/project/way/artifact に並ぶ**新スキン「state＝錆色・コスト円なし」**を足すこと。

### 0-6. 2019年エラッタ＝「非サプライ札を名指しで獲得できる」（英語wiki 2019_Errata 逐語）

> "**Gain non-Supply cards when called out** — When a card tells you to gain a non-Supply card by name, you can gain it from its pile, even though it's not in the Supply.
> This allowed the text on the following cards to be simplified: Bandit Camp, Devil's Workshop, **Haunted Mirror**, Hermit, Leprechaun, **Magic Lamp**, Marauder, Pillage, The Swamp's Gift, Tormentor, Urchin"

→ 呪いの鏡・魔法のランプの `from its pile` / `from their pile` が現行文で消えている理由。**機能変更なし**。

### 0-7. 2020／2021 エラッタ＝家宝5枚の「使用したとき」削除（コスメティック）

英語wiki 2020_Errata「Cosmetic card changes」逐語：
> "Bank, Charm, Coin of the Realm, Contraband, Counterfeit, **Cursed Gold**, Diadem, Fortune, **Goat**, Horn of Plenty, Idol, Ill-Gotten Gains, Loan, **Lucky Coin**, **Magic Lamp**, Philosopher's Stone, Relic, Scepter, Stockpile, Supplies, Treasure Trove, Venture — Remove "when you play this" from Treasures."

2021_Errata のアナウンス（DXV, Discord, January 2021）逐語で、Nocturne の新文面対象に
`Tracker, Fool, Leprechaun, Devil's Workshop, Necromancer, Idol, Tormentor, Cursed Gold, Goat, Haunted Mirror, Lucky Coin, Magic Lamp, The Swamp's Gift` が挙がっている。

**★本節20枚に機能エラッタは1件も無い**。英語wiki All_Errata の Nocturne 機能変更欄は `Crypt`(2022) / `Necromancer`(2020) / `Tracker`(2022) の**3枚のみ**。

### 0-8. 2025年エラッタ＝持続が場を離れたら以後働かない（幽霊に効く）

英語wiki 2025_Errata 逐語：
> "**If a Duration card leaves play, it stops doing things on future turns.** This also applies to Throne Room variants tracking repeated Durations."
> （Trivia／DXV）"the card was never in play" is treated just like "it left play." … "Yes if you say Throne Room a Gear, using it as Way of the Horse once, you can end up with **set-aside cards that will never come back. They still count as being in your deck at the end of the game.**"

---

## 1. 家宝（Heirloom）7種

すべて **非サプライ・購入不可・山を作らない**（各プレイヤーの開始デッキに直接1枚入る）。
`types` は `['treasure','heirloom']`（牧草地のみ `['treasure','victory','heirloom']`）。

---

### 1-1. Cursed Gold / 呪われた金貨

| | |
|---|---|
| **コスト** | `$4` |
| **種別** | 財宝-家宝（Treasure - Heirloom） |
| **対応王国カード** | プーカ（Pooka・$5） |
| **coin** | 3 |

**日本語テキスト（本アプリ用・現行準拠）**
```
+3 コイン
呪い1枚を獲得する。
```

**英語原文（現行＝2021年印刷・英語wiki Versions 逐語）**：`[$3]` / `Gain a Curse.`
**旧版（2017・逐語）**：`[$3]` / `When you play this, gain a Curse.`（2020エラッタで前置句を削除＝**コスメティック**）
**日本語版カード（2019年1月印刷）逐語**：「3コイン／あなたがこのカードを使用するとき、呪い1枚を獲得する。」

**公式FAQ（ルールブック逐語）**
> "Cursed Gold: **You can choose not to play Cursed Gold, and thus not gain a Curse.**"

**追加裁定（日本語wiki「詳細なルール」逐語）**
> 「呪われた金貨使用時の呪いの獲得は**強制**である。」「呪いの山札が空の場合、何も獲得しない。」

**実装注意**
- 「出すかどうか」は任意（財宝は出す義務が無い）だが、**出したら呪い獲得は強制**。呪い山が空なら不発。
- `gain()` を通すので物見やぐら／牧羊犬／取り替え子 などの獲得時リアクションが正しく開く。
- 効果は **`applyTreasureEffect` に書く**（`applyEffect` は財宝では呼ばれない＝§0-25 の既知の罠）。
- **CPU**：既存 `PLAY_ALL_TREASURES` は財宝を全部出す設計なので、CPU は必ず呪いを取る。**許容簡略化として明記**するか、`playAllOrder`／CPU に「呪われた金貨は出さない」判断を足すかは実装判断（前者を推奨。呪いの3点差より $3 の方が序盤は強いことが多い）。

---

### 1-2. Goat / ヤギ

| | |
|---|---|
| **コスト** | `$2` |
| **種別** | 財宝-家宝 |
| **対応王国カード** | ピクシー（Pixie・$2） |
| **coin** | 1 |

**日本語テキスト（本アプリ用・現行準拠）**
```
+1 コイン
手札1枚を廃棄してもよい。
```

**英語原文（現行＝2021年印刷）**：`[$1]` / `You may trash a card from your hand.`
**旧版（2017）**：`[$1]` / `When you play this, you may trash a card from your hand.`
**日本語版カード 逐語**：「1 コイン／あなたがこのカードを使用するとき、手札からカードを1枚廃棄してもよい。」

**公式FAQ（ルールブック逐語）**
> "Goat: **Trashing a card is optional.**"

**実装注意**
- **初期デッキに廃棄手段が入る唯一の家宝**。任意。手札0枚なら空振り。
- **`trashCard()` を必ず通す**（城塞／ネズミ／墓／青空市場／呪いの鏡 の on-trash が発火する）。
- **購入フェイズ中の廃棄**なので、司教型「廃棄したら+VP」や墓(Tomb)との相互作用に注意。
- **★呪いの鏡と同居し得る**（墓地＋ピクシー）＝ヤギで呪いの鏡を廃棄→幽霊獲得の対話が**購入フェイズ中に開く**。`state.onTrashQueue` に積むこと。

---

### 1-3. Haunted Mirror / 呪いの鏡

| | |
|---|---|
| **コスト** | `$0` |
| **種別** | 財宝-家宝 |
| **対応王国カード** | 墓地（Cemetery・$4・勝利点） |
| **coin** | 1 |

**日本語テキスト（本アプリ用・現行準拠）**
```
+1 コイン
————
これを廃棄したとき、手札のアクションカード1枚を捨て札にしてもよい。そうした場合、幽霊1枚を獲得する。
```

**英語原文（現行＝2021年印刷）**：`[$1]` / `When you trash this, you may discard an Action card, to gain a Ghost.`
**旧版（2017）**：`... to gain a Ghost **from its pile**.`（2019一般ルール変更で簡略化＝機能変更なし）
**日本語版カード 逐語**：「1コイン／(区切り線)／あなたがこのカードを廃棄したとき、**あなたの手札から**アクションカード1枚を捨て札にし、幽霊1枚をそのカードの山から獲得してもよい。」
→ **捨てる場所は「手札」**（日本語版が明示。ドイツ語 Lost in the Woods 等でも discard の既定は手札）。

**公式FAQ（ルールブック逐語）**
> "Haunted Mirror: **Haunted Mirror does not give you a way to trash it, but does something if you find a way to.**"

**追加裁定（日本語wiki「詳細なルール」逐語）**
> 「幽霊を獲得する効果は、呪いの鏡の**廃棄手段を問わない**。礼拝堂など、墓地以外の手段で廃棄しても、手札からアクションカード1枚を捨て札にして幽霊を獲得できる。」
> 「山賊や詐欺師などにより、**自分のターン以外に**呪いの鏡が廃棄された場合でも、手札からアクションカード1枚を捨て札にして幽霊を獲得できる。」
> 「呪いの鏡を廃棄した際にアクションカードを捨て札にするのは**任意**である。捨て札にしなかった場合は何も起きない。」
> 「ただし、呪いの鏡を廃棄した際にアクションカードを捨て札にした場合は、**幽霊の獲得は強制**である。」
> 「**幽霊の山札が空であった場合は、廃棄時にアクションを捨て札にしても何も獲得できない。**」

**なぜ $0 か（DXV・Secret History）**：改築等で価値を引き出させないため（幽霊はすでに得られるので）。

**実装注意**
- **on-trash トリガー**＝`trashCard()` の `triggerOnTrash` に配線。**誰が廃棄しても持ち主に発動**（アタック廃棄・相手のターンでも）。
- **墓地(Cemetery)の獲得時「手札から最大4枚廃棄」の窓の中で鏡を廃棄→幽霊**が定番。＝**獲得時対話の最中に on-trash 対話が開く**ので、**必ず `state.onTrashQueue`（暗黒時代 §0-8 の機構）に積む**。`state.pending` に直接代入すると窓を握りつぶす。
- **幽霊の山が空のとき**は「捨てても何も得ない」が正だが、**UI では選択肢を出さない（＝自動で辞退）方が親切**。engine 側は捨てても不発で構わない（保存則OK）。CPU は必ず終端すること。
- 新 pending：`haunted_mirror_trash`（手札のアクションを1枚捨てるか／しないか）。**4点セット必須**。

---

### 1-4. Lucky Coin / 幸運のコイン

| | |
|---|---|
| **コスト** | `$4` |
| **種別** | 財宝-家宝 |
| **対応王国カード** | 愚者（Fool・$3） |
| **coin** | 1 |

**日本語テキスト（本アプリ用・現行準拠）**
```
+1 コイン
銀貨1枚を獲得する。
```

**英語原文（現行＝2021年印刷）**：`[$1]` / `Gain a Silver.`
**旧版（2017）**：`[$1]` / `When you play this, gain a Silver.`
**日本語版カード 逐語**：「1コイン／あなたがこのカードを使用するとき、銀貨1枚を獲得する。」

**公式FAQ（ルールブック逐語）**
> "Lucky Coin: **You can choose not to play Lucky Coin, and thus not gain a Silver.**"

**追加裁定（日本語wiki 逐語）**
> 「幸運のコインをプレイした時の、**銀貨の獲得は強制**である。」

**実装注意**：銀貨山が空なら不発。CPU は全出し設計なので銀貨を取り続ける（許容簡略化として明記）。

---

### 1-5. Magic Lamp / 魔法のランプ

| | |
|---|---|
| **コスト** | `$0` |
| **種別** | 財宝-家宝 |
| **対応王国カード** | 秘密の洞窟（Secret Cave・$3） |
| **coin** | 1 |

**日本語テキスト（本アプリ用・現行準拠）**
```
+1 コイン
場に出ているカードのうち、あなたがちょうど1枚だけ持っているカードが6種類以上ある場合、これを廃棄する。廃棄した場合、願い3枚を獲得する。
```

**★英語の現行文面は wiki 内で表記ゆれがある（confidence: medium）**
自前再取得（snapshot `20241201id_`／ページ最終編集 **2025-01-04**）の結果：

| 出所 | 逐語 | `(counting this)` |
|---|---|---|
| 英語wiki **infobox「Card text」** | `[$1]` `If there are at least 6 cards that you have exactly 1 copy of in play, trash this. If you did, gain 3 Wishes.` | **無し** |
| 英語wiki **Versions 表・2021 printing 行** | `[$1]` `If there are at least 6 cards that you have exactly 1 copy of in play (counting this), trash this. If you did, gain 3 Wishes.` | **有り** |
| 英語wiki **ドイツ語 2021 版** | `Wenn du mindestens 6 verschiedene Karten genau einmal im Spiel hast (inklusive dieser), entsorge diese Karte...` | **有り**（＝inklusive dieser） |
| 日本語wiki の英語欄 | `If there are at least 6 cards that you have exactly 1 copy of in play, trash this. If you do, gain 3 Wishes.` | 無し |
| ルールブック（2017） | `When you play this, if there are at least 6 cards that you have exactly 1 copy of in play, trash this. If you do, gain 3 Wishes from their pile.` | 無し |

→ **物理2021年印刷（英・独）は「(counting this)」を持つ可能性が高い**が、wiki の infobox と日本語wiki は持たない。
**意味は完全に同じ**（下の公式FAQが「自身も数える」と明言）ので**ゲーム挙動には一切影響しない**。
**推奨＝webp の文面には「（これを含む）」を入れない**（日本語版カード・日本語wiki・wiki infobox の3つが揃って持たないため）。入れるなら `…6種類以上ある場合（これを含む）、…`。

**日本語版カード（2019年1月印刷）逐語**：「1コイン／あなたがこのカードを使用するとき、あなたの場にちょうど1枚だけ出ているカードが6つ以上あるなら、このカードを廃棄する。そうした場合、願い3枚をそのカードの山から獲得する。」

**公式FAQ（ルールブック逐語）**
> "Magic Lamp: **Magic Lamp itself counts as one of the six cards.** A card you have two or more copies of in play does not count; **you have to have exactly one copy in play to count a card.** You can play more Treasures after trashing Magic Lamp, and **still get [$1] from it for that turn**."

**その他の裁定（英語wiki "Other rules clarifications" 逐語）**
> "Since you can play Treasures in whatever order you want, having (for example) multiple Coppers you want to play needn't prevent you from trashing your Magic Lamp for Wishes. **Simply play one Copper to count as one of your six unique cards in play, play your Magic Lamp, and then play the rest of your Coppers.**"

**追加裁定（日本語wiki「詳細なルール」逐語）**
> 「『場にちょうど1枚だけ出ているカードが6つ以上ある場合の、魔法のランプの廃棄』と、『廃棄した場合の願い3枚の獲得』は**強制**である。」
> 「6種類には魔法のランプ自身も数える。」
> 「魔法のランプが廃棄されても、魔法のランプをプレイした時に出る1コインは消えない。」
> 「**分割された山札や騎士のように同じ山札に由来するカードでも、カードに印刷している名前が異なれば「異なるカード名のカード」として扱う。**」
> 「**はみだし者／大君主**は、使用されると場を離れるまでカード名を含めて『はみだし者／大君主で選んだカード』として**扱われなくなった**（2019エラッタ）ので注意。」
> 「**『相続した屋敷』は、相続後も『カード名は「屋敷」のまま』**」
> 「**偽造通貨や冠などで魔法のランプを2度使用することはできるが、願い3枚獲得には『魔法のランプを廃棄した場合』という条件がある。『魔法のランプの廃棄』は1度しかできないため、願い3枚獲得も1度しかできない。**」

**実装注意（この20枚で最も実装が難しい）**
- 判定＝**場のカードを「印刷されたカード名」でグループ化し、枚数がちょうど1のグループ数 ≧ 6**。銅貨が2枚場にあれば銅貨は**0カウント**。ランプ自身は場にあるので1グループ。
  - 「場」＝`p.inPlay` ＋ **持続で残っている `p.durationCards`**（前ターンから場にある札も「場」）。
  - **分割山（開拓者/騒がしい村 等）・混合山（騎士/城）は別名なので別カウント**。
  - **はみだし者/大君主/船長/王子（命令）は自分自身の名前**（§0-17 の現行ルールと整合）。
  - **相続した屋敷は「屋敷」**。
- **廃棄も願い3枚獲得も強制**（条件を満たしたら選べない）。
- **廃棄しても +$1 は残る**＝コイン計上を先に済ませてから廃棄する。
- **`trashCard()` 経由で自己廃棄**し、**`if (removeOne(p.inPlay,'magic_lamp')) {…}` ガード必須**（冠/偽造通貨の2回目・命令経由では場に無い＝lose track）。2回目に願いは出ない。
- **★`playAllOrder` に魔法のランプを足す**（ティアラ/冠/偽造通貨/銀貨/大金 と同じ「出す順序が結果を変える財宝」）。
  素直な最適化は難しいので、**許容簡略化として「重複しない財宝を1枚ずつ出した直後にランプ」程度の固定順**にし、PROGRESS に明記するのが現実的。

---

### 1-6. Pasture / 牧草地

| | |
|---|---|
| **コスト** | `$2` |
| **種別** | **財宝-勝利点-家宝**（Treasure - Victory - Heirloom） |
| **対応王国カード** | 羊飼い（Shepherd・$4） |
| **coin** | 1（**`vp` フィールドは持たせない＝可変VP**） |

**日本語テキスト（本アプリ用）** ※既存の同型 `humble_castle`（粗末な城）の書式に合わせた
```
+1 コイン
（勝利点：所有する屋敷1枚につき1点）
```

**英語原文（逐語・エラッタ無し＝Versions 表は2017年の1行のみ）**：`[$1]` / `Worth 1 [VP] per Estate you have.`
**日本語版カード 逐語**：「1 コイン／勝利点／あなたの持つ屋敷1枚につき1勝利点になる。」

**公式FAQ（ルールブック逐語）**
> "Pasture: **For example if you have three Estates, then Pasture is worth 3 [VP].**"

**実装注意**
- **可変VP**＝`vpOf`（engine）と CPU `vpOfPlayer` の**両方**に加算（庭園/絹の道/封土/粗末な城と同型）。**牧草地自身は屋敷ではない**ので自分を数えない。
- **相続（Inheritance・冒険）との相互作用**：屋敷がアクションになっても名前は屋敷のまま＝数える（英語wiki Synergies に明記）。
- **家宝は1人1枚が上限**なので「牧草地を複数持つ」ケースは通常起きないが、闇市場等の経路が無いことを確認しておくこと（家宝はどの山にも属さないので黒市デッキにも入らない＝`DOM.POOLS` に家宝を入れないこと）。

---

### 1-7. Pouch / 革袋

| | |
|---|---|
| **コスト** | `$2` |
| **種別** | 財宝-家宝 |
| **対応王国カード** | 追跡者（Tracker・$2） |
| **coin** | 1 |

**日本語テキスト（本アプリ用）**
```
+1 コイン
+1 購入
```

**英語原文（逐語・エラッタ無し＝Versions 表は "First edition" の1行のみ）**：`[$1]` / `+1 Buy`
**日本語版カード 逐語**：「1 コイン／+1 カードを購入」

**公式FAQ（ルールブック逐語）**
> "Pouch: **This simply gives you [$1] and +1 Buy when you play it.**"

**実装注意**：最も単純。`coin:1` ＋ `+1 購入`。エラッタ無し。

---

## 2. 非サプライ 8種

コスト表記の `*` は「サプライに無い＝購入できない」ことを示す印刷上の印で、**コスト比較上の値は素の数値**（悪魔祓いの「より安い精霊」判定・取り替え子の「$3以上」判定に使う）。
※ゾンビ3種だけは `*` が付かない（英語wiki infobox が `[$3]`）。

---

### 2-1. Will-o'-Wisp / ウィル・オ・ウィスプ

| | |
|---|---|
| **コスト** | `$0*` |
| **種別** | アクション-精霊（Action - Spirit） |
| **山の枚数** | **12** |
| **入手経路** | 沼の恵み(The Swamp's Gift)＝`Gain a Will-o'-Wisp.`／悪魔祓い(Exorcist) |

**日本語テキスト（本アプリ用）** ※日本語版カード逐語
```
+1 カード
+1 アクション
あなたのデッキの一番上のカードを公開する。そのカードのコストが2コイン以下なら、それを手札に加える。
（このカードはサプライには置かない。）
```

**英語原文（逐語・エラッタ無し）**
`+1 Card` / `+1 Action` / `Reveal the top card of your deck. If it costs [$2] or less, put it into your hand.` / `(This is not in the Supply.)`

**公式FAQ（ルールブック＆英語wiki 逐語）**
> "Will-o'-wisp: **If the revealed card does not cost [$2] or less, leave it on your deck.**"
> "**Cards with [P] or [D] in the cost (from Alchemy and Empires) do not cost [$2] or less.**"

**追加裁定（日本語wiki「詳細なルール」逐語）**
> 「公開したカードが2コスト以下であれば、**必ず手札に加えなければならない**。」
> 「コストに負債やポーションを含むカードは『2コスト以下のカード』には該当しないので、手札に加えられない。」
> 「ウィル・オ・ウィスプの山札が空になったとしても、**ゲーム終了条件には数えない**。」

**実装注意**
- **`DOM.engine.costUpTo(state, id, 2)` を使う**（PROGRESS §0-23 の必読事項そのもの）。素の `cardCost <= 2` は**FAQ が明示的に否定している**ので忠実性としても必須。
- **手札に加えるのは強制**（2コイン以下なら選べない）。該当しなければ**山札の上に残す（捨てない）**。
- **`reveal()` を通す**（ルネサンスのパトロン＝「アクションフェイズ中に公開したら+1財源」が自動で効く）。
- 山札が空でシャッフルしても空なら公開できず何も起きない。
- 対話なし＝新 pending 不要。

---

### 2-2. Wish / 願い

| | |
|---|---|
| **コスト** | `$0*` |
| **種別** | **アクション**（Action。**精霊ではない**） |
| **山の枚数** | **12** |
| **入手経路** | レプラコーン（場にちょうど7枚あるとき）／魔法のランプ（**3枚**） |

**日本語テキスト（本アプリ用）** ※日本語版カード逐語
```
+1 アクション
このカードを願いの山に戻す。そうした場合、コスト6コイン以下のカード1枚を獲得し、あなたの手札に加える。
（このカードはサプライには置かない。）
```

**英語原文（逐語・エラッタ無し）**
`+1 Action` / `Return this to its pile. If you did, gain a card to your hand costing up to [$6].` / `(This is not in the Supply.)`

**公式FAQ（ルールブック逐語）**
> "Wish: **You only gain a card if you actually returned Wish to its pile.** A card you gain that would normally go somewhere else, like **Nomad Camp** (from Hinterlands), **goes to your hand**."

**追加裁定（日本語wiki「詳細なルール」逐語）**
> 「願いを由来する山札に戻せなかった場合、カードは獲得できない。」
> 「**玉座の間系で使用してもカードは1枚しか獲得できない。**」
> 「**ネクロマンサーで使用してもカードは獲得できない。**」
> 「ポーションをコストに含むカード(ブドウ園など)、負債をコストに含むカード(技術者など)は、どちらもコスト最大6(コイン)までのカードに含まれないため、獲得できない。願いで獲得できるカードは、正確には**『コスト最大6コイン 0ポーション 0負債 までのカード』**とみなされる。」
> 「イベント・プロジェクトはカードではないため、獲得できない。」
> 「**願いの効果で獲得されるカードは、捨て札置き場を経由せずに直接手札に獲得される。**」
> 「願いの山札が切れたとしても、ゲーム終了条件には数えない。」

**実装注意**
- **「山に戻す」は獲得でも廃棄でもない**＝**移動動物園の「馬(horse)」と完全に同型**。既存の `horse` 実装（`これをその山に戻す。`）をコピーできる。
- **戻せなかったら獲得しない**＝`if (removeOne(p.inPlay,'wish')) { ... }` **ガード必須**。戻せない例＝ネクロマンサーで廃棄置き場から使用した／命令(Command)経由（§0-17 の「命令がプレイした札は動かない」）。**本プロジェクトの既存の罠そのもの**。
- **獲得先は手札**＝`gain(dest:'hand')`。**獲得先を変える on-gain（遊牧民の野営地＝山札の上／カブラー等）に勝つ**。彫刻家（ルネサンス）で踏んだ「獲得置換の競合＝獲得者が選ぶ」と同じ扱いで、`triggerOnGain` の `nomad_camp` 句に既に `dest !== 'hand'` ガードがあるため**そのまま正しく動く**。
- **`costUpTo(state, id, 6)` を使う**（非サプライ・ロック中の分割山下段・ポーション/負債を除外）。
- 取り替え子(Changeling)は「コスト$3以上を獲得したとき交換してよい」＝**願い自身($0)は対象外**だが、**願いで獲得した$3以上のカードは交換され得る**。
- 新 pending：`wish_gain`（コスト6以下を1枚・**強制**）。**候補ゼロなら窓を閉じる終端保証**必須、CPU は `null` を返さないこと。

---

### 2-3. Imp / インプ

| | |
|---|---|
| **コスト** | `$2*` |
| **種別** | アクション-精霊 |
| **山の枚数** | **13** |
| **入手経路** | 悪魔の工房（そのターン2枚以上獲得済み）／迫害者（場に他のカードが無い）／悪魔祓い |

**日本語テキスト（本アプリ用）** ※日本語版カード逐語
```
+2 カード
あなたの場に出ていないアクションカード1枚をあなたの手札から使用してもよい。
（このカードはサプライには置かない。）
```

**英語原文（逐語・エラッタ無し）**
`+2 Cards` / `You may play an Action card from your hand that you don't have a copy of in play.` / `(This is not in the Supply.)`

**公式FAQ（ルールブック逐語・Conclave と一字一句同じ）**
> "Imp: **After drawing two cards**, you can play an Action card from your hand, provided that you do not have a copy of that card in play. **It does not matter if you played the Action card this turn, only that it is not in play when you play Imp**; you can use Imp to play a card that you played but trashed and so do not have in play, like a Pixie you trashed, but **cannot use it to play a card you did not play this turn that is still in play, such as a Secret Cave from your previous turn**. **Imp normally cannot play an Imp** as that is a card you have in play."

**追加裁定（日本語wiki「詳細なルール」逐語）**
> 「インプの効果で手札のアクションを使用する際には、**アクション権を消費しない**。」
> 「確認されるのは『**現状で**それと同じ(名前の)カードが場に出ているか？』という点。例えば、鉱山の村を使用して2コインを得るために廃棄していた場合は、現状で鉱山の村は場にないため、同一ターン内でもインプの効果で手札の鉱山の村を使用できる。逆に、**持続カードや呼び出したリザーブカードなどが場に出ていれば、(それを同一ターンに使用していなくても)インプの効果で手札の同じ名前のカードを使用できない**。」
> 「はみだし者／大君主は、2019エラッタ後は**カード名を含めて『選んだカード』として扱われなくなった**。」「『何かを相続した屋敷』は、**カード名は『屋敷』のまま**。」
> 「手札のアクションを使用する効果は**任意**処理である。」
> 「**★インプが場から捨て札になるタイミングは、常に『インプ使用ターンのクリーンアップフェイズ』である。玉座の間やはみだし者などの『自身の効果で使用したカードが場から離れるまで場に残るカード』との違いに注意。**」
>   例：「インプの効果で漁村を使用すると、漁村は次のターンのクリーンアップまで場に残るが、**インプ自身はインプ使用ターンのクリーンアップフェイズに捨て札になる**。」「インプの効果で雇人を使用すると、雇人は場に残り続けるが、**インプ自身はインプ使用ターンのクリーンアップフェイズに捨て札になる**。」

**実装注意**
- **判定対象＝`p.inPlay` ＋ `p.durationCards`**（前ターンの持続も「場」）。加えて、**呼び出し済みのリザーブ（酒場マットから場に出た札）や、場に残る永続持続（雇人/チャンピオン/王子）も「場」**。
- **アクション権を消費しない**。**コンクラーベ（Conclave）と同一機構**（ルールブックの解説文が一字一句同じ）だが、**コンクラーベは「使用したら +1 アクション」が付き、インプには付かない**。
- **★インプは持続を使用しても場に残らない**（玉座の間型ではない）＝`armDuration` の cnt 機構に載せてはいけない。
- 使用したアクションは通常どおり場に出る（＝以後インプで同名を使えなくなる）。
- 新 pending：`imp_play`（**任意**・候補ゼロなら窓を出さない）。

---

### 2-4. Bat / コウモリ

| | |
|---|---|
| **コスト** | `$2*` |
| **種別** | **夜行**（Night。持続でも精霊でもない） |
| **山の枚数** | **10** |
| **入手経路** | **吸血鬼(Vampire)を使用したときの交換のみ** |

吸血鬼（$5・夜行-アタック-不運）逐語：`Each other player receives the next Hex.` / `Gain a card costing up to [$5] other than a Vampire.` / `Exchange this for a Bat.`

**日本語テキスト（本アプリ用）** ※日本語版カード逐語
```
あなたの手札から最大2枚までのカードを廃棄する。
これにより1枚以上廃棄した場合、このカードを吸血鬼1枚と交換する。
（このカードはサプライには置かない。）
```

**英語原文（逐語・エラッタ無し）**
`Trash up to 2 cards from your hand. If you trashed at least one, exchange this for a Vampire.` / `(This is not in the Supply.)`

**公式FAQ（英語wiki Bat 逐語）**
> "**The Vampire is put into your discard pile.**"
> "**If there are no Vampires in their pile, you cannot exchange Bat for one, but can still trash cards.**"

**追加裁定（日本語wiki「詳細なルール」逐語）**
> 「吸血鬼との交換は**カードの獲得ではない**。」
> 「吸血鬼と同様に**交換は強制効果**であり、コウモリの効果で手札を1枚でも廃棄した場合は**必ず一度手放さなければならない**。」
> 「交換はクリーンアップフェイズ時の処理ではなく、**使用時効果の一環として処理される**。」
> 「**廃棄するカードの枚数は0でもよい。この場合コウモリは何もせず、交換も起こらない。**」
> 「**★コウモリを使用する際は、まずコウモリの効果で廃棄するカードの全てを選び、その全てを(1枚ずつではなく)同時に廃棄置き場に置く。その後、カードの廃棄に誘発する効果があれば、誘発する。**」
> 「例：コウモリの効果でまず手札からネズミ1枚を廃棄→ネズミの廃棄時効果で+1カード→引いたカードを同じコウモリの効果で廃棄する、**という動きはできない**。」
> 「コウモリの山札が切れたとしても、ゲーム終了条件には数えない。」

**実装注意**
- **夜フェイズに使用する**（新フェイズ＝アクション→購入→**夜**→片付け）。
- **交換＝獲得ではない**（§0-4）。吸血鬼は**捨て札置き場へ**、コウモリは**コウモリの山へ戻る**。**獲得/廃棄トリガーは一切発火しない**。
- **0枚廃棄も合法**。その場合コウモリは場に残り、片付けで捨て札へ。
- **吸血鬼の山が空なら交換不成立だが廃棄はできる**（ここを「交換できないから廃棄も拒否」にすると忠実性バグ）。
- **★廃棄は「同時」**：選択を確定してから2枚まとめて `trash` に置き、その後に on-trash を回す。**1枚ずつ廃棄して引いた札を追加で選ばせてはいけない**（ネズミ／城塞／墓／青空市場 で差が出る）。
- 新 pending：`bat_trash`（0〜2枚の複数選択）。**「0枚で確定」ボタンを必ず用意する**（無いと人間が詰む）。

---

### 2-5. Ghost / 幽霊

| | |
|---|---|
| **コスト** | `$4*` |
| **種別** | **夜行-持続-精霊**（Night - Duration - Spirit） |
| **山の枚数** | **6** |
| **入手経路** | 呪いの鏡を廃棄（手札のアクションを捨てる）／悪魔祓い（**幽霊より高いコストのカードを廃棄**＝実質$5以上） |

**日本語テキスト（本アプリ用）** ※日本語版カード逐語
```
アクションカードが公開されるまで、あなたのデッキを上から公開する。公開したアクションカードを脇に置き、残りのカードを捨て札にする。
あなたの次のターンの開始時、そのアクションカードを2度使用する。
（このカードはサプライには置かない。）
```

**英語原文（逐語・エラッタ無し）**
`Reveal cards from your deck until you reveal an Action. Discard the other cards and set aside the Action. At the start of your next turn, play it twice.` / `(This is not in the Supply.)`

**公式FAQ（ルールブック逐語・実装の要）**
> "**If you run out of cards before revealing an Action, shuffle your discard pile but not the revealed cards, and continue.**"
> "If you still do not find an Action, just discard everything and do not do anything else."
> "If you find an Action card, you discard the other cards, set the Action card aside, and play it twice at the start of your next turn. **This is not optional.**"
> "If you have multiple start-of-turn effects, you can put them in any order, but **when you resolve Ghost, you play the Action twice then; you cannot resolve other effects in the middle.**"
> "**You play the Action card, resolving it completely, then play it a second time.**"
> "**Playing the card does not use up Action plays for the turn.**"
> "**If Ghost plays a Duration card, Ghost will stay out with the Duration card.**"
> "If Ghost plays a card that trashes itself, **it will play it a second time even though the card is no longer in play**."
> "**If Ghost fails to play a card, it will be discarded from play that turn.**"

**その他の裁定（英語wiki "Other rules clarifications" 逐語）**
> "If Ghost plays a Horse, it will be played the second time even after it will have been returned to its pile."

**追加裁定（日本語wiki「詳細なルール」逐語）**
> 「**持続カードがターン終了時に何らかの理由により場を離れている場合、【持続効果】はターン終了時にすべて失われる、というルールがある。幽霊がターン終了時に場を離れている場合、脇にカードを置き続けることになる。**」（＝2025エラッタ。DXV「They still count as being in your deck at the end of the game.」＝**脇の札は最後まで自分のデッキとして数える**）
> 「デッキにアクションが無い場合など、幽霊の効果でアクションを公開できなかった場合、全ての公開したカードを捨て札にする。この場合、幽霊は『次ターンまで持続する効果』を発揮しないので、**使用したターンのクリーンアップフェイズに場から捨て札になる**。」
> 「幽霊で公開されたアクションは、まず脇に置かれ、**次のターン開始時に脇から場に出て使用される**。」
> 「**脇に置かれているカードは 夜襲 の効果で対象とされる『場に出ているカード』には当たらない**。」
> 「幽霊の効果で共謀者を2度使用しただけでは、『(このカードも含めて)3枚以上のアクションを使用している』という状態とはならず、追加効果は得られない。」
> 「幽霊の効果で使用するアクションカードが他プレイヤーの女魔術師の影響を受ける場合、1回目の使用ではキャントリップの、2回目の使用では本来の効果を得る。」
> 「幽霊の効果で、ターンの開始時に呼び出せるリザーブカード(鼠取り、案内人、変容、教師)を使用した場合、酒場マットに置かれたカードを(まだ『ターンの開始時』なので)すぐさま呼び出すことができる。」
> 「幽霊の効果で、雇人などの『各ターンの開始時』の効果を持つカードを使用した場合、すぐさま『各ターンの開始時』の効果を2度発揮する(この場合、雇人が場に残り続けるので、**幽霊も場に残り続ける**ので注意)。」
> 「幽霊でターン開始時にアクションを2回使用する処理は、いわゆる一連の処理なので、**一度処理を開始したら他の『ターンの開始時』効果の処理を割り込ませることはできない**。」

**実装注意**
- **★シャッフル時に「公開済みのカードは混ぜない」**：本プロジェクトの `reshuffleDeck(p)` は append 方式（§0-8 で修正済み）なので、**公開済みカードを一時退避してからシャッフルし、その後に続きを公開する**こと。
- **脇置きは物理カード**＝新ゾーン（例 `p.ghostSetAside = [{id, card}]`）を `allCards`・invariants の `ZONES`・結果画面の `deckCards` に入れる。**公開情報でよい**（reveal 済み）＝マスク不要。
- **「2回使用」は玉座の間と同型**＝`state.replay` に積む。**1回目を完全解決してから2回目**（既存の玉座機構がそのまま合う）。**アクション権を消費しない**。
- **持続を使ったら幽霊も場に残る**＝海辺の `armDuration` の cnt 機構と同じ。
- **アクションが見つからなければ幽霊は持続にならず、そのターンの片付けで捨てる**。
- **幽霊が場を離れたら（2025ルール）脇の札は永久に戻らないが、所有カードとして得点・庭園等に数え続ける**。
- **★取り替え子（Changeling）で交換され得る**：幽霊はコスト$4（≧$3）なので、獲得した瞬間に交換の窓が開く。交換すると幽霊は**幽霊の山（非サプライ）に戻る**（§0-4 の "or non-Supply pile"）。
- 対話は基本なし（強制）だが、**開始時の2回使用が startQueue の途中に割り込めない**＝`t.startQueue` の先頭で一括処理する。

---

### 2-6〜2-8. ゾンビ3種（Zombie Apprentice / Zombie Mason / Zombie Spy）

**共通**：コスト **`$3`（アスタリスク無し）**／種別 **アクション-ゾンビ**／**各1枚のみ**／非サプライ。
**準備**：ネクロマンサー(Necromancer)を使うゲームで **3枚とも廃棄置き場(trash)に表向きで置く**（`Setup: Put the 3 Zombies into the trash.`）。

**ネクロマンサー（$4・アクション・現行文＝2020エラッタ後）逐語**
`Play a face up, non-Duration Action card from the trash, leaving it there and turning it face down for the turn.` / `Setup: Put the 3 Zombies into the trash.`

**ゾンビ共通の公式裁定（ルールブック逐語）**
> "This plays a non-Duration Action card from the trash. Normally it can at least play one of the three Zombies, since they start the game in the trash. … **The played cards are turned over, to track that each can only be used once per turn this way; at end of turn, turn them back face up.** … **The Action card stays in the trash; if an effect tries to move it, such as Encampment returning to the Supply, it will fail to move it.** … **Since the played card is not in play, "while this is in play" abilities (such as Tracker's) will not do anything.**"

**共通の追加裁定（日本語wiki「詳細なルール」逐語・3ページとも同文）**
> 「ゾンビの◯◯はサプライに置かれず、ネクロマンサーを使用するゲームの準備で廃棄置き場に置く。」
> 「**大使で公開してもサプライに戻すことはできない。**」
> 「**★盗賊や墓暴きや待ち伏せで廃棄置き場のゾンビの◯◯を獲得することができる。**」

**共通の実装注意**
- ゾンビは**廃棄置き場に置かれた物理カード**。`state.trash` に入れるので**保存則 tally の総枚数が3枚増える**（テストの期待値に注意）。
- **★「廃棄置き場から出られる」**：墓暴き(graverobber)・盗賊(rogue)・待ち伏せ(lurker) で獲得され得る。獲得されたら普通の自分のカードになり、**得点計算（庭園/品評会/絹の道）にも数える**。逆に、そのゲームでは以後ネクロマンサーがそれを使えない。
  → **`NON_SUPPLY` には入れる（購入不可・3山終了に数えない・汎用獲得の対象外）が、`state.trash` からの獲得は許す**。
- **表/裏の状態が要る**：`state.trashFaceDown = Set<index or id>` 等。**ターン終了時に全部表に戻す**。
- **プレイしても場に出ない**＝`inPlay` に入れない。「場にある間」系（追跡者・街道・インプの判定・魔法のランプの6種類判定）に一切影響しない。
  → 本プロジェクトの **§0-17 命令(Command)機構と同型**（`playAsCommand` で「動かさずに使用する」）。ゾンビは自己移動しないので事故は少ない。
- ネクロマンサーは**アクションフェイズのアクション**で、**持続は選べない**（`non-Duration`）。

---

#### 2-6. Zombie Apprentice / ゾンビの弟子

**日本語テキスト（本アプリ用）** ※日本語版カード逐語
```
あなたの手札にあるアクションカード1枚を廃棄して、+3 カード、+1 アクション を得てもよい。
```

**英語原文（逐語・エラッタ無し）**：`You may trash an Action card from your hand for +3 Cards and +1 Action.`

**公式FAQ（ルールブック逐語）**
> "Zombie Apprentice: **If you trash an Action card from your hand, you draw three cards and get +1 Action.**"

**追加裁定（日本語wiki 逐語）**
> 「**手札のアクションカードを廃棄しないことを選んでもよい。この場合、何も起こらない。**」

**実装注意**
- **廃棄が対価**（廃棄しなければドローもアクションも無い）。手札にアクションが無ければ空振り。
- **`trashCard()` 経由**（城塞が手札に戻る／墓のVP／呪いの鏡の幽霊 が発火する）。
- 新 pending：`zombie_apprentice_trash`（任意・アクション限定）。

#### 2-7. Zombie Mason / ゾンビの石工

**日本語テキスト（本アプリ用）** ※日本語版カード逐語
```
あなたのデッキの一番上のカードを廃棄する。そのカードよりコストが最大1コイン多いカード1枚を獲得してもよい。
```

**英語原文（逐語・エラッタ無し）**：`Trash the top card of your deck. You may gain a card costing up to [$1] more than it.`

**公式FAQ（ルールブック逐語）**
> "Zombie Mason: **Gaining a card is optional.** You can gain a card costing [$1] more than the trashed card, **or any amount less; for example you can gain a copy of the trashed card.**"

**追加裁定（日本語wiki「詳細なルール」逐語）**
> 「ゾンビの石工を使用した場合、**必ずデッキの上のカード1枚を廃棄しなくてはならない**。」
> 「**デッキが1枚もなく廃棄できなかった場合はカードを獲得できない。**」
> 「コストを参照するとき廃棄したカードは通常廃棄置き場にある。」
> 「**廃棄したカードのコストにポーション(負債)が含まれている場合、コストにポーション(負債)が含まれるカードも獲得できる。**
>   大学(2+P)を廃棄した場合、**コスト3+P以下**のカード1枚を獲得できる。ポーションが含まれていない、ただの3コスト以下のカードでもよい。
>   大金(8+負債8)を廃棄した場合、**コスト9+負債8以下**のカード1枚を獲得できる。負債が含まれていない属州(8)や白金貨(9)、逆に負債だけの大君主(負債8)などでもよい。」

**実装注意**
- 廃棄は**強制**（山札が空ならシャッフル、それでも空なら何もしない）。獲得は**任意**。
- **★コスト比較は成分別に「コインだけ +1」**：`{coin: c+1, potion: p, debt: d}` を上限とする `costUpTo` 相当。
  本プロジェクトの `costUpTo(state, id, N)` はコイン上限しか取らないので、**3成分版のヘルパ（または `gainableBase` + 成分比較）を用意すること**。素の `cardCost <= c+1` は mix-all で忠実性バグ＋livelock。
- 新 pending：`zombie_mason_gain`（任意・辞退ボタン必須）。

#### 2-8. Zombie Spy / ゾンビの密偵

**日本語テキスト（本アプリ用）** ※日本語版カード逐語
```
+1 カード
+1 アクション
あなたのデッキの一番上のカードを見る。そのカードを捨て札にするか元に戻す。
```

**英語原文（逐語・エラッタ無し）**：`+1 Card` / `+1 Action` / `Look at the top card of your deck. Discard it or put it back.`

**公式FAQ（ルールブック逐語）**
> "Zombie Spy: **You draw a card before looking at the top card.**"

**追加裁定（日本語wiki 逐語）**
> 「カードを1枚引き、+1アクションを得てから、デッキの上のカードの確認を行う。」
> 「確認したデッキのカードを捨て札にしなかった場合、そのままデッキの上に戻す。」

**実装注意**
- **「見る(look at)」＝公開ではない**ので **`reveal()` を通さない**（パトロンが誤発火する）。
- **オンラインでは本人だけに見える私的情報**＝`maskStateFor` の対象（冒険の偵察隊 §0-21 と同型。忘れると相手に丸見え）。
- 捨てる場合は **`triggerOnDiscard` を通す**（異郷の坑道・移動動物園の村有緑地）。
- 新 pending：`zombie_spy_choose`（捨てる／戻す の2択・**強制**＝どちらかは必ず選ぶ）。

---

## 3. 状態（State）5種

**種別**：すべて `State`（**状態**）。**カードではない**（§0-5）。**コストは無い**。**横型（landscape・錆色の枠）**。
物理的には**3種類の札**：`錯乱／嫉妬`（両面・6枚）、`生活苦／二重苦`（両面・6枚）、`森の迷子`（1枚・両面同文）。

---

### 3-1. Deluded / 錯乱

**日本語テキスト（本アプリ用）** ※日本語版カード逐語（日本語wiki 呪詛ページ）
```
あなたの購入フェイズの開始時、このカードを返し、あなたはこのターンが終わるまでアクションカードを購入できない。
```

**英語原文（逐語・エラッタ無し）**：`At the start of your Buy phase, return this, and you can't buy Actions this turn.`

**取得**：呪詛「**幻惑(Delusion)**」＝`If you don't have Deluded or Envious, take Deluded.`
→ **錯乱も嫉妬も持っていなければ**取る＝**非スタック**。裏面が嫉妬の**両面カード**（錯乱の面を表にして置く）。各プレイヤーに1枚。

**公式FAQ（ルールブック逐語）**
> "Deluded: **This prevents you from buying Action cards during one turn, starting in the Buy phase.** If you get Deluded during your turn **before the Buy phase** (such as with Leprechaun), **it will apply that turn**; normally it will apply to your next turn."
> "Delusion: Deluded / Envious is two-sided; take it with the Deluded side face up."

**その他の裁定（英語wiki "Other Rules clarifications" 逐語）**
> "The effect doesn't kick in until the beginning of your Buy phase; **if you play Black Market during the Action phase, you can buy cards from the Black Market deck normally.**"
> "However, if you start your Buy phase, return Deluded, somehow return to your Action phase (for example by gaining Villa), and then play Black Market, you won't be able to buy Actions from the Black Market deck, **since Deluded's effect lasts for the rest of the turn once activated**."
> "**This does not stop you from gaining Action cards via Horn of Plenty in your Buy phase, since it is not buying.**"

**★追加裁定（日本語wiki 呪詛ページ「詳細なルール」逐語）＝先行下書きに欠落**
> 「錯乱や嫉妬の能力にある『**返す**』とは手放して誰も保有していない共通プールへと戻すことである。**裏返すことではない**。」
> 「錯乱と嫉妬は**購入フェイズの開始時に誘発するまで効果を発揮しない**。言い換えれば、手元にある間は影響を受けない。」
> 「**★購入フェイズに錯乱or嫉妬を得た際は、返す(=効果を発揮する)タイミングに注意が必要。**
>   『プレイヤーＡが(購入フェイズの開始時の後の処理である)呪われた村を購入して獲得した際に錯乱or嫉妬を得た』という場合、
>   **この購入フェイズ時には錯乱or嫉妬を返すことは無く、効果を発揮しない。**
>   プレイヤーＡの[**次の**購入フェイズ開始時]が訪れた際に錯乱or嫉妬を返し、効果を発揮する。
>   ※[次の購入フェイズ開始時]が訪れるのはプレイヤーＡの次ターンであることが多いが、**ヴィラなどの効果でアクションフェイズに戻り、再度購入フェイズに入る際でも[次の購入フェイズ開始時]が訪れる**ので注意。」

**実装注意**
- **2段階**：①**購入フェイズ開始時**に「返す」（状態が外れる＝共通プールへ戻す）→ ②**そのターンいっぱい**アクション購入禁止のフラグ `t.cantBuyActions` が立つ。**状態を返した後もフラグは残る**（ヴィラでアクションフェイズに戻って再入場しても継続）。
- **★購入フェイズ中に取得した錯乱は、そのフェイズでは発動しない**（フラグを立てるのは「購入フェイズ開始時」の処理だけ）。＝呪われた村の獲得時呪詛で自分が錯乱を取っても、そのターンは普通に買える。
- **購入のみ禁止＝獲得は自由**。`BUY` の拒否だけに書く。**闇市場もアクションフェイズなら影響しない**が、購入フェイズに再入場した後の闇市場は禁止。
- **★engine 拒否と CPU 非提案は必ずセット**（engine だけ締めると CPU がアクションを提案し続けて本番 livelock）。UI の購入ボタンも無効化。
- 状態は `p.deluded`（boolean）＋ `t.cantBuyActions`（boolean）の**非カードスカラー2つ**。保存則 tally に混ぜない。マスク不要（公開）。

---

### 3-2. Envious / 嫉妬

**日本語テキスト（本アプリ用）** ※日本語版カード逐語
```
あなたの購入フェイズの開始時、このカードを返し、このターンが終わるまで銀貨と金貨は1コインのみ生み出す。
```

**英語原文（逐語・エラッタ無し）**：`At the start of your Buy phase, return this, and Silver and Gold make [$1] this turn.`

**取得**：呪詛「**羨望(Envy)**」＝`If you don't have Deluded or Envious, take Envious.`（錯乱と同一の両面カード）

**公式FAQ（ルールブック逐語）**
> "Envious: This causes Silver and Gold to make [$1] when you [play them] in your Buy phase for one turn, rather than their usual [$2] and [$3], starting in the Buy phase. **It does not affect other Treasures, just Silver and Gold.** If you get Envious during your turn before the Buy phase (such as with Leprechaun), it will apply that turn."

**その他の裁定（英語wiki 逐語）**
> "**Silvers and Golds played before your Buy phase, such as by Storyteller, are not affected.**"
> "Once you return Envious, it will affect your Silvers and Golds for the rest of the turn, **even if you return to the Action phase with Villa or Cavalry and then start a new Buy phase.**"

**追加裁定（日本語wiki 呪詛ページ 逐語）**
> 「錯乱と嫉妬を得ていても、**闇市場や語り部や刈り入れによりカードを購入or財宝を使用した際は影響を受けない**。」
> 「錯乱と嫉妬が効果を発揮した後、ヴィラなどの効果でアクションフェイズに戻った際に上記のカードを使用したり、**王笏、資本主義、技術革新などで購入フェイズに使用したりするときは、当然影響を受ける**。」
> （※購入フェイズ中の取得タイミングの扱いは §3-1 と同じ）

**実装注意**
- **銀貨・金貨のみ**。白金貨・その他の財宝は無関係。**銀貨/金貨を参照する他効果（商人の「最初の銀貨」等）は変わらない**（コイン量だけが1になる）。
- 錯乱と同じく**返した後もターン末まで継続**するフラグ `t.enviousActive`。**購入フェイズ開始時に立てる**ので、「アクションフェイズで語り部が出した銀貨/金貨は影響を受けない」が自然に表現できる。
- 本プロジェクトは**財宝のコイン計上が `addCoins` に一本化済み**（§0-25 カメレオン対応）なので、`playTreasureCard` の銀貨/金貨分岐でコイン値を差し替えるのが素直。
- **★王笏／資本主義／冠・ティアラ・偽造通貨の2回目**も購入フェイズなら影響を受ける＝**`applyTreasureEffect` 側で判定する**こと（`playTreasureCard` の入口だけに書くと2回目が漏れる）。
- CPU の「あといくら出せるか」見積り（`chooseBuy` の coins 予測）にも反映しないと、買えない札を提案して livelock する。

---

### 3-3 / 3-4. Miserable / 生活苦 ・ Twice Miserable / 二重苦

**日本語テキスト（本アプリ用）** ※日本語版カード逐語
```
-2 勝利点
```
```
-4 勝利点
```

**英語原文（逐語・エラッタ無し）**：`-2 [VP]` ／ `-4 [VP]`

**取得**：呪詛「**みじめな生活(Misery)**」＝`If this is your first Misery this game, take Miserable. Otherwise, flip it over to Twice Miserable.`

**公式FAQ（ルールブック逐語）**
> "Miserable: **When scoring at the end of the game, you lose 2 [VP]. This does nothing until then, it just sits in front of you.**"
> "Twice Miserable: When scoring at the end of the game, you lose 4 [VP]. This does nothing until then, it just sits in front of you."
> "Misery: **If this hits you for a third time in a game, nothing will happen; you stay at Twice Miserable.**"

**実装注意**
- **生活苦と二重苦は同一の両面カード**＝1人につき「無し / 生活苦(-2) / 二重苦(-4)」の**3状態のスカラー1個**（`p.miseryLevel = 0|1|2`）。**-2 と -4 は加算されない**（-4 が上限、3回目以降は何も起きない）。
- **得点は負になり得る＝下限クランプ禁止**（帝国ランドマーク §0-19 と同じ注意）。
- **★`scoreGame`（engine）と CPU の `vpOfPlayer` / `winsIfEnds` の両方に加算する**。片方だけだと CPU の終局読みが engine とずれる（§0-26 で実際に踏んだ [medium] バグ）。
- **非カード**＝保存則 tally に混ぜない（`state.pileVP` / `state.artifacts` と同型）。マスク不要（公開）。

---

### 3-5. Lost in the Woods / 森の迷子

**日本語テキスト（本アプリ用）** ※日本語版カード逐語
```
あなたのターンの開始時、あなたは手札1枚を捨て札にして祝福を1つ受けてもよい。
```

**英語原文（逐語・エラッタ無し）**：`At the start of your turn, you may discard a card to receive a Boon.`

**取得**：愚者(Fool・$3・アクション-幸運)＝`If you aren't the player with Lost in the Woods: take it, take 3 Boons, and receive the Boons in any order.`
→ **既に持っている人が愚者を使っても何も起きない**（ルールブック "If you have Lost in the Woods, playing Fool does nothing."）。**ゲーム中に1枚のみ**、プレイヤー間を移動する。

**公式FAQ（ルールブック逐語）**
> "Lost in the Woods: **The two sides are the same; use either. Using the ability is optional. Lost in the Woods stays in front of you turn after turn, until another players takes it with a Fool.**"

**実装注意**
- **ターン開始時の任意対話**＝**`t.startQueue` に積む**（`state.pending` を直接立てない＝§0-22 の注意）。手札0枚なら窓を出さない（終端保証）。
- **捨てるのが対価**＝捨てなければ祝福を受けない。捨て札は**手札から**（ドイツ語版 "eine **Handkarte** ablegen" が明示）。**`triggerOnDiscard` を通す**（坑道・村有緑地）。
- 保持者は `state.lostInTheWoods = 席番号|null` の**トップレベル公開スカラー1個**で足りる（**非カード**）。
- 新 pending：`lost_in_the_woods`（捨てる1枚／辞退）。**4点セット必須**。

---

## 4. 実装チェックリスト（この20枚に固有）

1. **非サプライ山5つ（ウィル・オ・ウィスプ／インプ／幽霊／願い／コウモリ）は `NON_SUPPLY` に登録し、4系統すべてから除外**：
   `emptyPileCount`(3山終了)／`canBuyCard`／**闇市場デッキの母集団**／汎用獲得（engine の `*_GAIN` と **CPU の `bestGain`/`bestGainExact` の両方**）。
   ＝PROGRESS §6 の既存チェックリストそのもの。**engine 拒否と CPU 非提案は必ずセット**。
2. **家宝7枚も非サプライだが「山」を作らない**（各プレイヤーの開始デッキに直接入る）。`createInitialState` の開始デッキ生成に
   「対応王国カードがあれば銅貨1枚を置換」を書く＝**暗黒時代の避難所(Shelters)と同型**。**入れ替えた銅貨は銅貨の山に戻す**（＝銅貨山が増える）。
   **`DOM.POOLS` に家宝を入れない**（入れると闇市場デッキに漏れて $0 で買えてしまう）。
3. **ゾンビ3枚は `state.trash` に表向きで置く**＝**カードだが山ではない**。
   - 保存則 tally の総枚数が3枚増える（テストの期待値に注意）。
   - **廃棄置き場から獲得され得る**（墓暴き／盗賊／待ち伏せ）。獲得後は普通の自分のカード。
   - **`state.trashFaceDown` の表裏管理**が要る（ネクロマンサーで使ったら裏返し、**ターン終了時に全部表に戻す**）。
4. **新ゾーン**：幽霊の脇置き（アクション1枚）は**物理カード**＝`allCards`・invariants の `ZONES`・`result.scores[i].deckCards` に追加。
5. **非カードのスカラー**（保存則 tally に混ぜない・マスク不要）：`p.deluded` / `p.envious` / `t.cantBuyActions` / `t.enviousActive` / `p.miseryLevel` / `state.lostInTheWoods`。
6. **新 pending は4点セット必須**（engine reducer ＋ `PLAYER_ACTIONS` ＋ CPU `decidePending` ＋ UI `viewPendingModal`）＋終端保証：
   `goat_trash`／`haunted_mirror_trash`／`bat_trash`／`wish_gain`／`imp_play`／`zombie_apprentice_trash`／`zombie_mason_gain`／`zombie_spy_choose`／`lost_in_the_woods`。
   （魔法のランプ・呪われた金貨・幸運のコイン・ウィル・オ・ウィスプ・幽霊は**対話なし＝強制**なので pending 不要。）
   **CPU は `null` を返さないこと**（オンラインで `reduce(state,null)` が TypeError ＝部屋が固まる）。
7. **コスト比較は必ず engine の述語**（`gainableBase` / `costUpTo` / `costExact` / `sameCost`）。
   - ウィル・オ・ウィスプの「$2以下」と願いの「$6以下」は **FAQ がポーション/負債の除外を明示**しており、素の `cardCost <= N` は忠実性バグ＋mix-all で livelock。
   - **ゾンビの石工は「3成分すべてを基準にコインだけ +1」**＝既存 `costUpTo` では表現できない。**新ヘルパが要る**。
8. **財宝の効果は `applyTreasureEffect` に書く**（`applyEffect` は財宝では呼ばれない＝§0-25 で踏んだ自己回帰）。家宝7枚すべてが該当。
9. **`playAllOrder` に魔法のランプを足す**（ティアラ/冠/偽造通貨と同じ「順序が結果を変える財宝」）。
10. **夜フェイズ（Night phase）が新設**＝`アクション → 購入 → 夜 → 片付け`。**コウモリと幽霊が該当**（他担当の夜行カードと共通基盤）。
11. **状態5種は横型（landscape）**＝`tools/build-landscape.js` に **`state` スキン（錆色・コスト円なし）** を新設。`DOM.LANDSCAPES` 側に置く（`DOM.CARDS` に入れない）。
12. **獲得時に複数の窓が開く経路がある**（呪いの鏡の on-trash が墓地の獲得時廃棄の中で開く／幽霊の獲得で取り替え子の交換窓が開く）
    → **`state.onTrashQueue` / `state.onGainQueue` に積む**（`state.pending` に直接代入しない＝§0-26 の必読事項）。

---

## 5. 確認できなかったこと・信頼度

1. **【medium】魔法のランプの `(counting this)`**：英語wiki の infobox（2025-01-04 編集）は**持たず**、Versions 表の2021年印刷行とドイツ語2021年版は**持つ**。
   物理カードのスキャンを確認していないため断定できない。**ゲーム挙動には影響しない**（FAQ が「自身も数える」と明言）。
   → 本節は**「（これを含む）」を入れない**方針で書いた（日本語版カード・日本語wiki・wiki infobox が揃って持たないため）。
2. **【low】日本語版の実物スキャン照合はしていない**。日本語名・日本語文面は日本語wiki wikiwiki.jp の per-card ページ（英日併記表）を逐語取得したもの。
   ホビージャパン公式サイトには**カード個別名が一切載っていない**（種別名6語と、正誤表に出る《ドルイド》1枚だけが確認できる）。
   ただし本節20枚は**日本語wikiの per-card ページと 夜想曲まとめページの2箇所で一致**を独立に確認済み。
3. **【確定】英語wiki の「Japanese」欄は信用してはいけない**。私の担当20枚のうち**8枚で日本語wikiと食い違う**
   （幸運の銅貨/大願/小悪魔/蝙蝠/混乱/没落/都落ち/山羊）。しかも**同一wiki内で自己矛盾している**
   （Imp は自ページで「小悪魔」だが迫害者の文中では「インプ」／Will-o'-Wisp は自ページで「ウィル・オ・ウィスプ」だが沼の恵みの文中では「鬼火」）。
   → **日本語wiki側の名前（幸運のコイン/願い/インプ/コウモリ/錯乱/生活苦/二重苦/ヤギ）を採用**した。
4. **【low】日本語版に2021年エラッタ反映版が存在するかは未確認**。日本語版は**2019年1月**発売で2017年文面。
   したがって呪われた金貨・ヤギ・呪いの鏡・幸運のコイン・魔法のランプの5枚は「現行文面の公式日本語訳」が存在しない可能性が高く、
   本節の該当5枚の日本語テキストは**現行英文から起こしたもの**（プロジェクトの既定方針＝現行採用に従った）。旧文面も各項に併記した。
5. **【low】表記の揺れ**：日本語版カードの実表記は `+1 カードを引く` / `+1 カードを購入` だが、既存521枚は `+1 カード` / `+1 購入` で統一されている。
   **タスク指定に従い後者**で記載した。財宝のコイン行も既存カタログが `+2 コイン`(鹵獲品) / `1 コイン`(名品・戦利品) / `＋1 コイン`(粗末な城・全角プラス) と揺れているが、
   **タスク指定に従い `+N コイン` に統一**した。
6. **【low】コウモリの山が空になったとき**の吸血鬼側の挙動は、一般規則（§0-4「if the pile is empty, the cards are not exchanged」）以上の個別裁定が見つからなかった。
   コウモリ→吸血鬼の側は「吸血鬼の山が空なら交換できないが廃棄はできる」と公式FAQに明記があるので、そこだけは確定。
7. **【low】幽霊が場を離れた場合の脇札**：2025エラッタ本文＋DXV の Trivia（「set-aside cards that will never come back. They still count as being in your deck at the end of the game.」）と
   日本語wiki（「脇にカードを置き続けることになる」）から**確定**として書いたが、幽霊固有の公式FAQ文は存在しない（一般ルールからの帰結）。
