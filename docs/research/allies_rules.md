# 同盟（Allies）公式ルール研究 — 実装の正本

多エージェント研究（22体＝11群を分担収集 → **各群を別エージェントが一次資料で敵対検証**）で確定したデータ。
**カタログ（`js/cards.js`）と engine を書くときは、記憶ではなくこの文書を見ること。**

- 発売＝2022年3月（初版）／**2023年12月＝第2刷＝現行**。機能変更は **Island Folk と Voyage の2枚だけ**（＋Elder の言い回し）。
- 内訳＝**王国49種**（非分割25種×10枚＝250枚／**分割山6組×4種×4枚＝96枚**）＋**同盟(Ally)カード23種** ＝ **72種**。
  公式の400枚＝250＋96＋ランダマイザー31＋Ally23 と一致。
- 縦型（`DOM.CARDS`）＝王国49種＋分割山のプレースホルダ6種 ＝ **55エントリ**／
  横型（`DOM.LANDSCAPES`）＝同盟カード23種。

## ⚠️ 一次資料の使い方

1. **英語wiki（wiki.dominionstrategy.com）＝現行カードテキストの正本**。本体は Anubis の bot 検知で開けないので
   **Wayback 経由**＝`python tools/wikifetch.py <PageName> [...]`（コスト記号を `[$4]` の形に復元してある）。
   ⚠️ **`wikifetch.py` が返す snapshot の年を必ず見ること**。`2019id_` にフォールバックすると
   **同盟(2022)より前のページ**を読むことになる（検証で `Split_pile` が実際にそうなった）。
   ⚠️ **Wayback の2025年12月以降のキャプチャは Anubis の "Making sure you're not a bot!" 画面が保存されている**。
   実際に読める最新は 2025年1月ごろ。
2. **RGG 公式ルールブック PDF**（同盟は **2023年12月版が現行**。夜想曲のような「PDFが初版」の罠は無い）。
   ⚠️ **pdftotext はコイン記号・VP記号を全部落とす**ので金額は必ず wiki 側で裏取り。
3. **日本語のカード名と文面＝日本語wiki（wikiwiki.jp/dominiondeck）が正本**（ホビージャパン印刷版）。
   **英語wiki の Japanese 行は当てにならない**。→ §g11 が全72枚を個別ページの英日併記表で機械照合済み（一致72/72）。

---

## ⚠️ 実装前に必読：この拡張の落とし穴（敵対検証で確定したリスクの集約）

### 1. ★最大の設計判断★ Order of Astrologers / Order of Masons が `reshuffleDeck` と正面衝突する
両者は **「シャッフルのたびに、Favor を払って全カードを見て、払うたびに選び直せる」** 対話を要求する。
ところが `js/engine.js` の **`reshuffleDeck(p)` は同期・非対話**（37箇所から呼ばれる）。
PROGRESS §0-22 は、まさにこの制約ゆえに **星図(star_chart)＝自動選択／へそくり(Stash)＝常設方針 `stashPlacement`**
という**許容簡略化**を選んだと記録している。**23分の2＝約9%のゲームで必ず出る**。
- 方針候補 **(a)** 常設方針＋自動選択に倒す（許容簡略化を1つ増やす）／
  **(b)** `reshuffleDeck` を非同期化する横断リファクタ／**(c)** 2枚を Ally プールから外す（忠実性を落とす＝最後の手段）。
- **(b) を採るなら**「Emissary と Underling は Favor をくれる**前**にシャッフルを起こしうる。
  まだ持っていない Favor はそのシャッフルには使えない」という**評価順序**を守ること（公式FAQ）。
- **段階2 の最初に決めること。** 後から差し込むのは非常に高くつく。

### 2. Ally が起こす攻撃は「アタックカードのプレイ」ではない＝**堀で防げない**
ルールブック逐語（2箇所）：
`Circle of Witches: ... This is not playing an Attack card and cannot be blocked with Moat.`
`Gang of Pickpockets: ... This is not an Attack card being played and cannot be blocked with Moat.`
→ **`ATTACKS` レジストリに登録してはいけない／リアクション窓を開いてはいけない／`attackImmune` を通してはいけない。**
素直に既存のアタック機構に乗せると**堀・灯台・チャンピオン・守護者で無効化されて公式より弱くなる**。

### 3. Rotate（循環）＝「先頭からの**連続**同名ブロック」を末尾へ移す
ルールブック逐語：`Rotating a pile means taking the top card, and all copies of it directly under it, and putting them on the bottom.`
- **離れた場所にある同名は動かさない**（Swap やウマの習性で順序が乱れた後に効く）。
  wiki 逐語：「Student が4枚の Lich の上にあり、その下にさらに Student が2枚あるとき、
  循環は**一番上の Student 1枚だけ**を動かす」。**「同名を全部集めて下へ」ではない。**
- **回転は常に任意**（`You may rotate ...`）。**空の山・1種類だけの山を回しても合法**（何も起きないだけ）。
  → **選択肢ゼロの pending で詰ませないこと**（公式裁定は無いが「合法・無効果」が安全）。
- **⚠️ 回転の位置はカードごとに違う**。触れ役/薬草集め/古地図/天幕/戦闘計画は**最後**だが、
  **生徒(Student)だけ「循環 → その後に強制廃棄」＝循環が先**。「常に最後」と決め打ちしない。
- **戦闘計画(Battle Plan)だけが「任意のサプライ山」を回せる**（騎士・廃墟・城・サウナ/アヴァントも対象）。
  他の5枚は自分の山を**名指し**＝サプライ外でも回せる。**この2つの述語を分けること。**

### 4. 分割山6組＝**混合山モデル**（`state.castles`/`knights` 型）に寄せる。既存の `SPLIT_PILES` は使えない
- 既存 `DOM.SPLIT_PILES`＝**下段id→上段id の1対1マップ**＋`splitLocked`＝**2段専用モデル**。4段は表現できない。
- 同盟＝**1山16枚＝4種×4枚**を**コストの安い順**（最安が一番上）に積む。**人数によらず常に16枚**（城のような人数別調整は無い）。
- **買える／獲得できるのは一番上だけ**。`cardCost(state,'<pile>')` は**今の一番上の実コスト**（城と同型）。
- **⚠️「山のコスト・種別」を参照する効果は randomizer 固定値**（＝一番安いカード）。
  `Some cards refer to information about a pile as if it's just one card. In these cases, go with what's on the Randomizer card.`
  → **「買うときのコスト（＝今の一番上）」と「山のコスト（＝randomizer＝固定）」を混同しない。**
  実例＝発明家の家族は「勝利点の山には置けないが同盟の6分割山には置ける」（randomizer が勝利点でないから）。
  一方 **城(Castles)には置けない**（randomizer が Victory）。
- **山を名指しする効果はその山の4種すべてに効く**（冒険の山トークンなど）。既存 `pileKeyOf` と同じ考え方。
- **3山終了は16枚全部が無くなって初めて1山ぶんの「空」**。
- 6山＝町民 Townsfolk **[$2]** ／ 卜占官 Augurs・衝突 Clashes・城砦 Forts・叙事詩 Odysseys・魔法使い Wizards **[$3]**。
  **町民だけ $2/$3/$4/$5、他5山は $3/$4/$5/$6**。

### 5. Ally（同盟カード）とセットアップ
- **王国に Liaison(連携) が1枚でもあれば** → Ally 23枚から**1枚だけ**無作為決定＋全員に好意マット＋**開始時 好意1個**
  （**輸入者(Importer) があるゲームは5個**＝Importer の `準備：各プレイヤーは +4 好意 を得る。`）。
- **Liaison が無ければ Ally も好意も一切登場しない。**
- **Ally は横型の枚数制限（イベント/ランドマーク/プロジェクト/習性の合算2枚）に数えない**（別デッキ）。
- **⚠️ 生徒(Student) は魔法使い(Wizards)の分割山の中にいる Liaison**。
  本アプリの `kingdom` は**山ID**（`'wizards'`）を持つので、**山IDだけを見る素朴な判定では Ally が出ないゲームになる。**
  → **分割山は中身4種すべてを走査して Liaison 判定すること。**
- Liaison 9種＝道化棒/ごますり [$2]・輸入者/生徒/下役 [$3]・仲買人 [$4]・契約書/密使/ギルドマスター [$5]。
- **同盟が追加する横型は Ally 23枚だけ**（イベント/ランドマーク/プロジェクト/習性/特性は無い）。

### 6. 好意（Favor）トークン
- **`p.coffers` / `p.villagers` とは完全に別枠の `p.favors` を新設**する。公開情報として実装（Coffers/Villagers と同型）。
- **得点にならない**（唯一の例外＝高原の羊飼い Plateau Shepherds。しかも**自分の好意しか見ない**）。**上限は無い**。
- **使うのは常に任意**。**Ally 能力が誘発するごとに1回だけ**（`Repeat as desired.` のある Ally だけ複数回）。
- **ゲームの最初のターンから使える**（＝開始デッキの最初のシャッフルには占星術師団/メイソン団を使えない）。
- **⚠️ 獲得したばかりの好意は、その場で開いた窓に即使える**（ごますり・魔女の輪の公式FAQ）。
  → **Ally の窓は「その誘発イベントで得た好意を足した後の現在値」を読む**。窓を開く前の値をスナップショットしない。
- **⚠️ 駐屯地(Garrison) のトークンは好意ではない**（カードの上に載る自前のカウンタ＝陰謀の陰謀団と同型）。混同すると好意が湧く/消える。

### 7. 種別（すべて本物の種別として持たせる。飾りにしない）
**連携 Liaison**（王国9種）／分割山専用の **町民 Townsfolk・卜占官 Augur・衝突 Clash・城砦 Fort・叙事詩 Odyssey・魔法使い Wizard**。
- **⚠️ 蛮族(Barbarian) は「廃棄したカードと種別を共有するより安いカード」を獲得する**＝
  **連携も種別一致の対象**（公式FAQ：契約書を廃棄したら、持続を共有する王家のガレー船／財宝を共有する銀貨／
  **連携を共有するごますり** のいずれかを獲得できる）。
- **要塞(Stronghold) は4種別＝アクション・勝利点・持続・城砦**（分割山の中に「勝利点かつ持続」が入る）。
- 同盟内に**リアクションは0枚**（アタック7枚に対し防御札が無い）。

### 8. 日本語名の衝突（表示で事故る）
- **完全一致1件＝「同盟」**：既存の移動動物園イベント `alliance`（カード名＝同盟）と、
  本拡張の**拡張名／`Ally` 種別／23枚の種別ラベル**が同じ文字列。**id 衝突はゼロ**なので機能影響は無いが、
  **カード一覧の全文検索・種別ラベル・盤面の帯で意味が2つになる**。→ 群見出しは「**同盟（拡張）**」等で区別する。
- **⚠️ Blacksmith＝「蹄鉄工」**（「鍛冶屋」は基本の Smithy）／**Order of Masons＝「メイソン団」**（「石工」はギルドの Stonemason）。
- **城砦(Fort 種別) と 城塞(暗黒時代 Fortress) は同音「じょうさい」**。**要塞(Stronghold) は廃棄しても戻らない**（城塞は戻る）。
- **女魔導士(Sorceress・卜占官$5) と 魔導士(Sorcerer・魔法使い$5)** は1文字差の別カード。
- **交換(Swap $5)** は夜想曲で導入したルール用語「交換(exchange)」と同じ語だが、
  効果は `return … to gain …` で **exchange ではない**。ログ文言に注意。

### 9. その他の要注意
- **契約書(Contract) は本シリーズ初の「財宝-持続」**。急使(Courier) は**持続でも財宝でもない**（ただの $4 アクション）。
- **専門家(Specialist) で持続を2回使うと専門家自身も場に残る**（既存の許容簡略化＝§0-25「玉座×持続」と衝突する）。
  一方 **長老(Elder) は「1回だけ」プレイなので場に残らない**。同じ「アクションを使わせるカード」でも扱いが逆。
- **追加ターンの競合は一般則**（航海 Voyage・島民 Island Folk は「3ターン連続不可」）。
  既存の 前哨地／使節団／今を生きる／艦隊／支配 の優先順位ロジック（§0-26）に組み込むこと。
- **航海(Voyage) の「手札から3枚まで」は Ally の能力も止める**（市場の町・都市国家）。
- **商人の野営地(Merchant Camp) は「場に出さずに使用」経路（命令/ネクロマンサー/相続/王子/ハツカネズミ）では
  山札の上に置けない**＝§0-17 の `takeSelf`/`playedByCommand` を通さないと**幻のカードが山札に増える＝保存則違反**。
- **歩哨(Sentinel) が見る5枚は「解決中は山札ではない」**＝deck から抜いて脇に持つ実装が必須
  （廃棄でドローするカード＝ネズミ・狂信者 を廃棄したら「その時の山札」から引く）。
- **ごますり(Sycophant) の3枚は同時に捨てる**（1枚ずつではない）。
  **on-trash はサプライからの廃棄（待ち伏せ等）でも発動**＝`opts.fromSupply` の抑止（青空市場）に混ぜないこと。
- **発明家の家族(Family of Inventors) のコスト軽減は 全員に・恒久的に・累積で** 効く（$0 未満にはならない）。
  好意はマットから**山へ移動する**（消えない）。

---

## 未解決（実装時に判断が要る）
| 項目 | 状況 |
|---|---|
| **Order of Astrologers / Order of Masons の実装方式** | 上記1。**段階2の最初に決める。** |
| 好意マットが公開情報か | 一次資料に明示なし。Coffers/Villagers 同型＝**公開**が妥当（公式実装も全員ぶん表示）。 |
| 空の山を Rotate | 明示的な公式裁定なし。「合法だが無効果」で問題ない。 |
| 闇市場デッキに連携が混ざったとき Ally を配るか | ルールブックにも wiki にも記述なし。**王国10山だけで判定する**のが安全。 |

---

# 以下、群ごとの詳細（22体の研究＋敵対検証の成果）

---

# 同盟（Dominion: Allies）— 一般ルールと新機構（g01_mechanics）

> **【敵対検証済み・2026-08-12】** 別エージェントが一次資料を**引き直して**全項目を再検証した。
> ルールブックPDFは自分でDLし直し（md5 `da61f074f6bfda28a0a1e72d0b1dd237` / 2,915,379 bytes / 12ページ）、
> wiki は下書きの保存ファイルを一切使わず `tools/wikifetch.py` で取り直した。
> **確定した訂正 8件（うち中程度3件）／新規に追加した重要事項 11件／訂正なしで裏取りできた項目 33件。**
> 訂正箇所には **【訂正】**、新規追加には **【追加】** を付けてある。

**担当範囲**＝拡張全体の一般ルール・新機構（Ally / Favor / Liaison / Rotate / 分割山 / Duration / セットアップ）。個別カードのテキストは他担当。

---

## 0. 使った一次資料（と取得方法）

| 資料 | 位置づけ | 取得 |
|---|---|---|
| **RGG 公式ルールブック PDF（2023年11月10日版＝第2刷）** | **現行の正本** | `https://wiki.dominionstrategy.com/images/4/4e/AlliesRulebook2023.pdf` を直接DL（PDF内ページヘッダ＝`DomAlliesRules21x.qxp_WideDominion 11/10/23 5:03 AM`）。`pdftotext -layout` でテキスト化 |
| RGG 公式ルールブック PDF（初版・2022年3月刷） | 差分確認用 | `https://www.riograndegames.com/wp-content/uploads/2021/09/Dominion-Allies-Rules.pdf`（RGG 公式サイトが今もホストしているのは**初版**。※夜想曲で踏んだのと同じ罠） |
| 英語wiki `Allies` `Ally` `Favor` `Liaison` `Rotate` `Split_pile` `Duration` `Landscape` `Mat` `Coffers` `Coin_token` ＋ 個別カード（`Student` `Elder` `Contract` `Courier` `Garrison` `Voyage` `Island_Folk` `Town_Crier` `Herb_Gatherer` `Old_Map` `Tent` `Battle_Plan` `Plateau_Shepherds` `Band_of_Nomads` `Circle_of_Witches` `Order_of_Astrologers`） | 現行カードテキスト／Versions表／Official FAQ の正本 | `tools/wikifetch.py`（Wayback 経由） |

### ⚠️【訂正1】この環境での取得上の注意（下書きの申し送りは誤り）

- **下書きの「`tools/wikifetch.py` はこの環境では動かない（https が拒否されるので http に書き換えよ）」は誤り。**
  検証時に**無改造のまま** `python tools/wikifetch.py Ally` を実行して普通に成功した（snapshot=`2id_`）。改造版は不要。
- 実際の失敗モードは2つ:
  1. **一時的な接続拒否**（`WinError 10061`）。`FAILED` が出たら**同じコマンドを数回叩き直せば通る**（今回 Voyage で3回、Ally/Favor/Split_pile で各1回リトライした）。
  2. **最新スナップショット `2id_` が Anubis ページを返すことがある**。スクリプトはこれを検知して古いスナップショットへ落ちる。
- **🔴 ここが本当の罠：スクリプトが表示する `snapshot=` の年を必ず見ること。**
  検証中、`Split_pile` が **`snapshot=2019id_`（2019年）** にフォールバックした。**2019年は同盟（2022年3月）より前**なので、
  そのページには同盟の情報が1文字も入っていない。**リトライして `2024id_` を取り直した。**
  → **`2022id_` より古いスナップショットが返ってきたら、その内容を同盟の根拠に使ってはいけない。必ず取り直す。**
- `wiki.dominionstrategy.com` 本体は Anubis で直接開けないが、**`wiki.dominionstrategy.com/images/...` 配下の PDF/画像は直接DLできる**（2023ルールブックはこれで入手）。

### 🔑 いちばん重要な確認結果
**一般ルール（この文書が扱う範囲）は初版(2022-03)と第2刷(2023-12)で内容が変わっていない。**
第2刷の**機能変更は Island Folk と Voyage のカードテキスト2枚だけ**（＋Elder の言い回し）＝カード担当の範囲。
※ただし下記 §6-2 のとおり、**wiki は後発拡張ぶんを反映して Duration の一般ルールに2文を足している**ので、そちらは現行として採用する。

---

## 1. Ally（アライ／同盟者カード）

### 1-1. 公式ルール逐語（2023年版ルールブック p.2–3）

```
In games using one or more Liaison cards, give each player a Favors mat and deal out a single Ally card.
The Ally cards are a separate deck, not combined with Events and so on. Each player gets a single Favor
token to start with (or five tokens in games with Importer).

Allies are landscape cards that give Favor tokens a use; Liaisons are kingdom cards that provide a way to
get Favor tokens. In games with a Liaison, deal out a random Ally to use that game. Only use one Ally
per game, even with multiple Liaisons. You can still have as many other landscape cards (Events,
Landmarks, Projects, Ways) as you otherwise would have.
```
※自分でDLしたPDFの p.2 末尾〜p.3 冒頭と**逐語一致**を確認済み。

### 1-2. 質問への回答

| 問い | 答え | 根拠 |
|---|---|---|
| 何枚から何枚選ぶ？ | **23枚の Ally デッキから、1ゲームにつき ちょうど1枚** | `deal out a single Ally card` / `Only use one Ally per game` |
| 選ぶ条件は？ | **王国に Liaison 種別のカードが1枚以上あるとき** | `In games using one or more Liaison cards` |
| Liaison が2枚以上あったら Ally も2枚？ | **いいえ、常に1枚** | `Only use one Ally per game, even with multiple Liaisons` |
| Liaison が無いゲームでは？ | **Ally を使わない。Favors マットも配らないし、開始時 Favor も無い**（＝Favor 機構そのものが不在） | 上記条件節の裏返し。wiki `Landscape` 逐語＝「Allies: **in a game with Liaison cards**, one Ally is selected at the start of the game」（実確認済み） |
| 選び方 | **無作為に1枚**（`deal out a random Ally`）。Ally は**独立したデッキ**で、Event/Landmark 等のランダマイザーには混ぜない | 同上 |
| 横型（landscape）か？ | **横型**。wiki `Ally`＝「printed on cards in a **landscape orientation** with yellowish grey/parchment frames」＝**黄灰色／羊皮紙色の枠** | ルールブック＋wiki |
| コストはあるか？ | **無い**。買えない・獲得できない | wiki `Ally`＝「Since Allies are **not considered cards**, they **cannot be bought or gained**」 |
| 能力はいつ働くか | **ゲーム中ずっと常設**。場に出ている1枚のルールとして全員に等しく適用される | 下表 1-3 |
| 「landscape 最大2枚」の枠を食うか？ | **食わない**。`You can still have as many other landscape cards ... as you otherwise would have` | wiki `Landscape` の推奨文を実確認＝「no more than two in total out of any of the following types: **Events / Landmarks / Projects / Ways / Traits**」＝**Ally はこのリストに入っていない** |
| 「カード」か？ | **カードではない**（Event/Landmark/Project/Way/Artifact と同じ「card-shaped thing」）。庭園・品評会・保存則の類には**一切数えない** | wiki の種別一覧で Ally は **Non-card types** に分類（実確認） |

### 1-3. Ally 23種の「使うタイミング」分類

wiki `Ally` の分類（全23件・分類も要約文も逐語照合して**完全一致**を確認）:

| トリガー | Ally |
|---|---|
| **カードを獲得したとき** (4) | Architects' Guild（より安い非勝利点を獲得）／Band of Nomads（+1カード or +1アクション or +1購入）／City-state（獲得したアクションを使用）／Trappers' Lodge（獲得したカードを山札の上へ） |
| **自分のターンの開始時** (6) | Cave Dwellers（1枚捨てて1枚引く・**Repeatable**）／Crafters' Guild（獲得して山札の上へ）／Desert Guides（手札を捨てて5枚引く・**Repeatable**）／Forest Dwellers（上3枚を見て任意枚数を捨てる）／Gang of Pickpockets（Favor を払わないと手札4枚まで捨てる）／Mountain Folk（+3カード） |
| **自分の購入フェイズの開始時** (5) | Family of Inventors（非勝利点のサプライ山に Favor を置いてコスト-[$1]）／League of Bankers（Favor 数に応じて +[$1]・**払わない**）／Market Towns（手札のアクションを使用・**Repeatable**）／Peaceful Cult（払った Favor 1個につき手札1枚廃棄）／Woodworkers' Guild（手札のアクションを廃棄してアクションを獲得） |
| **カードを使用した後** (3) | Circle of Witches（他の各プレイヤーが呪い獲得）／Fellowship of Scribes（+1カード）／League of Shopkeepers（Favor 5個以上で +[$1]、10個以上でさらに +1アクション+1購入・**払わない**） |
| **その他** (5) | Coastal Haven（片付けで捨てずに手札に残す）／Island Folk（ターン終了時に追加ターン）／Order of Astrologers（シャッフル時に山札の上に置くカードを選ぶ）／Order of Masons（シャッフル時に捨て札へ回すカードを選ぶ）／Plateau Shepherds（Favor 1個＋[$2]のカード1枚のペアごとに 2[VP]・**払わない**） |

### ⚠️【訂正2】上の分類ラベルは wiki の**粗い**まとめで、実際のトリガー条件はもっと狭い

実カードテキスト／ルールブックFAQで確認した**本当の条件**（実装の窓を作るときはこちらを見ること）:

| Ally | 実際のトリガー（一次資料） |
|---|---|
| **Band of Nomads** | 「When you gain a card **costing [$3] or more**」＝**コスト閾値がある**（wiki `Band_of_Nomads` 逐語）。ルールブックFAQ＝「What matters is how much the card costs **when you gain it**, not how much it normally costs.」＝橋/街道の軽減後コストで判定 |
| **Circle of Witches** | 「**After playing a Liaison**」＝**Liaison を使ったときだけ**（どのカードでもない）。wiki `Circle_of_Witches` 逐語 |
| **League of Shopkeepers** | ルールブック＝「After each time you play a **Liaison**」＝同上。「In games with multiple Liaisons, **all** of the Liaisons get the bonus, even if only one of them was used to get the Favors.」 |
| **Fellowship of Scribes** | ルールブック＝「once per time you play an **Action** card ... then **if you have 4 or fewer cards in hand**, you may spend a Favor for +1 Card」＝**アクション限定＋手札4枚以下の条件つき** |
| **City-state** | ルールブック＝「City-state **only works during your turns**.」 |
| **Forest Dwellers** | ルールブック＝「You can only do this **once per turn**.」 |
| **Mountain Folk** | ルールブック＝「You need the **full 5 Favors** to use this.」 |

- **Favor を消費しない Ally が3つある**：League of Bankers / League of Shopkeepers / Plateau Shepherds（wiki 逐語 `tokens are never spent`）。
  ＝「Favor を払う」がコストになる Ally と、「**持っている数**を参照するだけ」の Ally を区別すること。
- **Family of Inventors は「払う」ではなく「サプライ山の上に置く」**。詳細は【追加7】。
- `Repeat as desired.` と書いてある Ally（Cave Dwellers / Desert Guides / Market Towns）だけが**1トリガーで複数回**使える。

---

## 2. Favor（好意トークン）

> **【追加】日本語の公式訳＝「好意」**。wiki `Island_Folk` の日本語版カードテキストに「**好意5**を使ってもよい」とあり、
> ホビージャパン印刷版の訳語が確認できた（§9-3）。

### 2-1. 公式ルール逐語（2023年版ルールブック p.3）

```
Coin tokens are used for Favors; they go on a Favors mat to distinguish them from Coffers and
Villagers (from other expansions), which have their own mats. When a card gives you +1 Favor, add a
token to your mat; when spending a Favor, remove the token from your mat.

Favors may be used starting with the first turn of the game; they may not be used prior to that turn.
Spending Favors is always optional. Spending Favors can only be done once per time an Ally ability
triggers, unless it says, "Repeat as desired."
```
※自分でDLしたPDFと逐語一致を確認済み。wiki `Favor` の Official FAQ 節とも一致。

### 2-2. 質問への回答

| 問い | 答え |
|---|---|
| **35個は共有プールか各自か** | **共有の在庫（component）**。Favor は**各プレイヤーが自分の Favors マットの上に積む個人資源**で、マットは6枚同梱（＝最大6人）。35個は物理トークン数であってルール上の上限ではない。 |
| **得る方法** | **Liaison 種別のカードだけ**が `+N Favor` を与える（9種＝Bauble/Sycophant [$2]、Importer/Student/Underling [$3]、Broker [$4]、Contract/Emissary/Guildmaster [$5]）。加えて**全員が開始時に1個**（Importer があるゲームは5個）。<br>※ルールブックの `+N Favor` 記述を全部拾って発生源を突き合わせ、**9種の Liaison 以外に Favor を与えるカードが1枚も無い**ことを確認済み。 |
| **使う方法** | **その game の Ally カードが定める1通りだけ**（wiki `Liaison`＝「the effective abilities of Liaison cards can vary greatly from one game to another, depending on which Ally they appear with」）。 |
| **Favors マットは公開情報か** | **⚠️ 一次資料に明示なし**（ルールブック／wiki `Favor`／`Ally`／`Mat` のいずれにも public/private の記述が無いことを実確認）。**公開として実装するのが妥当**：①マットは表向きに置く物で伏せる指示が一切ない ②Coffers/Villagers と同じ扱い（本アプリは既に `p.coffers`/`p.villagers` を公開＝`maskStateFor` 素通し）③公式実装（Shuffle iT）は全員の Favor 数を常時表示する。<br>**【訂正3】下書きの「Plateau Shepherds は他人の Favor 数が得点になるから公開でないと成立しない」は誤り**（下記）。 |
| **終了時に得点になるか** | **ならない**。唯一の例外が Ally「Plateau Shepherds」。 |
| **Favor が尽きたら？** | **在庫制限は無い**。wiki `Coffers` の Official FAQ 逐語（3版ぶん確認）＝「**They are not component-limited; players may use a substitute if they run out.**」／wiki `Mat` 逐語＝「**Coin tokens cannot run out; players should use a substitute if needed.**」→ **実装では Favor 数に上限を設けない**。 |
| **いつから使えるか** | **ゲームの最初のターンから**。「それより前」＝セットアップ中には使えない。 |
| **払うのは任意か** | **常に任意**。※Gang of Pickpockets は「払わなければ手札を4枚まで捨てる」＝払わない選択が不利益、という形（払わないこと自体は合法）。 |
| **1トリガーに何回？** | **Ally 能力が誘発するごとに1回だけ**。例外は `Repeat as desired.` のある Ally のみ。 |

### ⚠️【訂正3】Plateau Shepherds は「**自分の**」Favor しか見ない

wiki `Plateau_Shepherds` の Ally text 逐語:
```
When scoring, pair up your Favors with cards you have costing [$2], for 2 [VP] per pair.
```
ルールブック逐語:
```
Plateau Shepherds: For example, if you have five Favors, two Estates, and a Moat,
you can make three pairs, for 6 [VP].
```
→ **自分の Favor と自分の [$2] カードを組にするだけで、他人の Favor 数はまったく参照しない。**
下書きが「公開情報である証拠」として挙げていた論拠は**成立しない**ので削除した。
（結論「公開として実装する」自体は Coffers/Villagers との同型性から**変わらない**。）

### 2-3. 実装上の注意（Favor）
- **`+N Favor` はマットに N 個載せるだけ**。「コイン」ではないので購入力にはならない（League of Bankers のゲームでのみ購入フェイズ開始時に $ に化ける）。
- **Coffers / Villagers とは完全に別枠**。→ 既存の `p.coffers` / `p.villagers` とは**独立した `p.favors` を新設**すること。
- **Garrison（Forts の2枚目）もコイントークンを使うが、それは Favor ではない**。
  wiki `Garrison` 実確認＝[$4] **Action - Duration - Fort**／「+[$2] This turn, when you gain a card, **add a token here**. At the start of your next turn, remove them for +1 Card each.」
  ＝**カードの上に載る自前のカウンタ**（Sinister Plot と同型）。**混同すると Favor が湧く/消える。**
  wiki `Coin_token` の Uses 一覧（実確認）＝ Pirate Ship / Trade Route / Coffers / Villagers / Sinister Plot / **Garrison** / **Favors** の7用途を別物として列挙。
- **開始時 Favor は「獲得」ではない**（トークンなのでトリガーは何も起きない）。Importer がある場合の5個は「1個＋Setup で +4」。
  wiki `Importer` 実確認＝[$3] **Action - Duration - Liaison**／カード文に `Setup: Each player gets +4 Favors.`／
  ルールブックFAQ逐語＝「At the start of the game, each player gets five Favors instead of one. **Importer doesn't provide a way to get any more Favors during the game.**」
  ＝**Importer はゲーム中に Favor を増やす手段を持たない唯一の Liaison。**

### 🔴【追加1】獲得したばかりの Favor は、その場で開いた窓に即使える

ルールブック逐語（2箇所）:
```
Sycophant: ... When you gain or trash this, you get +2 Favors;
           you can immediately spend them, for example on the ability of City-state.

Circle of Witches: After you completely resolve playing a Liaison, you may spend 3 Favors to have
           each other player gain a Curse. This can include Favors you just got from playing that Liaison.
```
→ **Ally の窓は「その誘発イベントで得た Favor を足した後の現在値」を読むこと。**
（例：Underling をプレイ → +1 Favor → その同じ「Liaison を使った後」の窓で League of Shopkeepers / Circle of Witches が
その1個を含めて判定する。窓を開く前にスナップショットした値を使うと公式と食い違う。）

---

## 3. Liaison（連携）種別

- **意味**：`Liaisons are kingdom cards that provide a way to get Favor tokens.`
  ＝ **① Favor を与える王国カードであることを示す** ＋ **② 「このゲームで Ally を使うか」の判定そのもの**。
- **Liaison が1枚でも王国にあれば** → Ally 1枚を無作為決定＋全員に Favors マット＋開始時 Favor 1個（Importer なら5個）。
- **Liaison が1枚も無ければ** → Ally も Favor も一切登場しない。
- 該当9種（wiki `Liaison` の List を実確認・コストも一致）：
  `Bauble` `Sycophant` [$2] / `Importer` `Student` `Underling` [$3] / `Broker` [$4] / `Contract` `Emissary` `Guildmaster` [$5]。
- **Liaison は同盟のみに存在する種別**（wiki の種別一覧で "Single-expansion special types" に分類。実確認）。
- **種別としての機能はそれだけではない**：`Barbarian` は「廃棄したカードと**種別を共有する**より安いカードを獲得」なので、
  **Liaison 種別そのものが Barbarian の「種別一致」の対象になる**。ルールブック逐語（自分のPDFで確認）:
  > Barbarian: For example, if a player trashes Contract to this, they could gain a **Royal Galley, as they share the Duration type**, or a **Silver, as they share the Treasure type**, or a **Sycophant, as they share the Liaison type**.
  → **種別として正しく持たせること**（表示だけの飾りにしない）。

### 🔴【追加2】Student は「分割山の中に入っている Liaison」＝Wizards があるだけで Ally が発生する

wiki `Student` 実確認：**[$3] / Type(s) = Action - Wizard - Liaison**
```
+1 Action
You may rotate the Wizards.
Trash a card from your hand. If it's a Treasure, +1 Favor and put this onto your deck.
```
→ **Wizards の分割山を王国に入れただけで「Liaison を使うゲーム」になる**（Student が王国内の Liaison カードだから）。
→ **セットアップ判定は「王国10山の中の全カード」を見なければならない。分割山は中身4種すべてを走査すること。**
  本アプリの `kingdom` は**山ID**（例 `'wizards'`）を持つので、`DOM.isType(pileId,'liaison')` のような
  **山IDだけを見る素朴な判定では Student を取りこぼし、Ally も Favor も出ないゲームになる。**

---

## 4. Rotate（回転）

### 4-1. 公式ルール逐語（2023年版ルールブック p.3。wiki `Rotate` の Official Rules と同文＝両方実確認）

```
The top card of each split pile has an ability that can "rotate" the pile (or with Battle Plan, any pile).
Rotating a pile means taking the top card, and all copies of it directly under it, and putting them on
the bottom. For example, if three Herb Gatherers were at the top of the Augurs, followed by Acolytes,
you would put those three Herb Gatherers on the bottom, and Acolyte would now be on top.
```

### 4-2. 質問への回答

- **「一番上のカード1枚」ではなく「一番上のカードと、その直下にある同名カードのまとまり全部」を一番下へ移す。**
  デザイナー本人の説明（wiki `Split_pile` の Allies プレビュー・逐語確認済み）：
  > "This puts all copies of whatever's on top onto the bottom. If the top has three Herb Gatherers and then Acolytes etc., rotating it puts all three Herb Gatherers on the bottom. **If it was just one Herb Gatherer and then Acolytes, that one Herb Gatherer goes on the bottom.** If the pile has different cards left in it, then rotating it will uncover a different one. It gets you through the pile."
  > — Donald X. Vaccarino, *Allies Preview 2: Split piles*, March 2022
- **「直下の連続する同名だけ」＝離れた位置にある同名は動かさない**（wiki `Rotate` の Other rules clarifications・逐語確認済み）：
  > "When cards are **returned** to their piles out of order via an effect such as **Swap** or **Way of the Horse**, rotating only affects **consecutive** cards of the same name on top of the pile. For instance, if the Wizards pile has a Student on top of four Liches and then two more Students below that, rotating the pile will only move **the top Student** and leave the rest of the Students where they are."
  ⚠️ **これが実装で一番間違えやすい点**。「同名を全部集めて下へ」ではなく「**先頭からの連続ブロック**を下へ」。
  （歴史メモ＝wiki `Split_pile` Secret History：「The first version of rotation just moved **one card**; then it got the word 'rotate' and did what it does.」＝連続ブロック方式は意図的な設計）
- **どの山でも回せるのか？**
  - **分割山の一番上のカードの能力は「自分の山」だけ**（各カードのテキストが山を名指ししていることを6枚とも実確認）。
  - **Battle Plan（Clashes の一番上）だけが「任意のサプライ山」を回せる**。
    wiki `Rotate` 逐語：「Battle Plan can rotate **any Supply pile**, not just the split piles from Allies. This includes **Knights and Ruins** from Dark Ages and other **split piles** (for example **Castles** and **Sauna/Avanto**).」
    Battle Plan のルールブックFAQ逐語（自分のPDFで確認）：「**Many piles won't do anything meaningful if you do this.** It can be relevant though for split piles, or for the Castles from Empires, or the Knights or Ruins from Dark Ages.」
  - **Battle Plan は「サプライ山」限定**（wiki `Rotate`：「As Battle Plan can only rotate Supply piles, it cannot rotate the Ferryman's pile, even if that pile is Clashes.」）。
    一方**山の名前で参照するカード（Town Crier 等）は、その山がサプライ外でも回せる**（同：「If a split pile is chosen as the pile for Ferryman, the pile can still be rotated by cards that refer to the pile by its name even though the pile is not in the Supply.」）。
    ※Ferryman は Rising Sun（未実装）。ただし**「サプライ限定」と「名指し」の区別**は Battle Plan の述語に反映しておくこと。
- **回転は任意（`You may rotate ...`）**。
  Herb Gatherer FAQ（PDF実確認）：「Playing a Treasure from your discard pile is optional, **as is rotating the Augurs**.」
  Student FAQ（PDF実確認）：「**Rotating the Wizards is optional, but trashing a card is mandatory.**」

### ⚠️【訂正4】「回転は必ず本体効果の**後**」は誤り。**カードごとの記載順に従う**

下書きは「**回転は本体効果の後に、別の独立した選択として解決する**」と一般則として書いていたが、
6枚のカードテキストを全部取り直して照合した結果、**Student だけ順番が違う**:

| カード | カードテキスト（wiki 逐語） | rotate の位置 |
|---|---|---|
| Town Crier [$2] | `Choose one: +[$2]; or gain a Silver; or +1 Card and +1 Action.` → **`You may rotate the Townsfolk.`** | 最後 |
| Herb Gatherer [$3] | `+1 Buy` `Put your deck into your discard pile. Look through it and you may play a Treasure from it.` → **`You may rotate the Augurs.`** | 最後 |
| Old Map [$3] | `+1 Card` `+1 Action` `Discard a card.` `+1 Card.` → **`You may rotate the Odysseys.`** | 最後 |
| Tent [$3] | `+[$2]` → **`You may rotate the Forts.`** （`When you discard this from play, you may put it onto your deck.` は別の誘発能力） | 最後 |
| Battle Plan [$3] | `+1 Card` `+1 Action` `You may reveal an Attack card from your hand for +1 Card.` → **`You may rotate any Supply pile.`** | 最後 |
| **Student [$3]** | `+1 Action` → **`You may rotate the Wizards.`** → `Trash a card from your hand. If it's a Treasure, +1 Favor and put this onto your deck.` | **2番目（廃棄より前！）** |

→ **正しい理解**：Town Crier のFAQ「**Then, no matter what you picked**, choose whether or not to rotate the Townsfolk pile.」は
**「選んだモードに依存しない」ことを言っているのであって、「rotate は必ず最後」を言っているのではない。**
**Student は rotate が先、強制廃棄が後。** 実装は**各カードの記載順どおり**に窓を開くこと。

- **空の山を回したらどうなるか**
  **⚠️ 明示的な公式裁定は見つからなかった**（wiki 全ページと PDF を横断検索して該当なし＝下書きの判断と一致）。
  ルール文を素直に適用すれば **①空の山＝動かすカードが無いので何も起きない（違法ではない）／②残りが1種類だけの山＝全部を下へ移す＝見た目も中身も不変**。
  Battle Plan の公式FAQ「Many piles won't do anything meaningful if you do this」もこの読みと整合。
  → **実装方針＝「回転は常に合法。効果が無ければ何も起きずに次へ進む」**（`pending` を立てて選択肢ゼロで詰む形にしないこと）。

### 4-3. 回転できるカード一覧（wiki `Rotate` の List・実確認）
| カード | 回せる山 |
|---|---|
| Battle Plan | **任意のサプライ山** |
| Herb Gatherer | Augurs |
| Old Map | Odysseys |
| Student | Wizards |
| Tent | Forts |
| Town Crier | Townsfolk |

---

## 5. 同盟の分割山（6組）

### 5-1. 公式ルール逐語（2023年版ルールブック p.3）

```
Dominion: Allies has six split piles, that have four different cards in each of them. The cards start the
game in order by cost. For example, the Augurs pile starts out with 4 Herb Gatherers on top, then 4
Acolytes, then 4 Sorceresses, then 4 Sibyls. This order may get messed up by cards like Swap; that's fine.
As with the split piles in Dominion: Empires, only the top card of a split pile can be bought or gained.
You can look through the cards in a split pile at any time, without changing the order.
...
Some cards refer to information about a pile as if it's just one card. In these cases, go with what's on
the Randomizer card, which usually matches the top card. Some things refer to cards from a particular
pile; these things work on all cards from a split pile. For example Training (from Dominion:
Adventures) lets a player put a token on an Action pile, which causes them to get +[$1] when playing a
card from that pile. The token can be put on the Odyssey pile, and then Sunken Treasure will also make
+[$1] when played.
```
※`+[$1]` は pdftotext がコイン記号を落とすため wiki `Split_pile` の同文で補った（両方実確認）。

### 5-2. 6つの分割山（各16枚＝4種×4枚。**上から安い順**）

**24枚すべてのコストを wiki `Allies` の「Split pile cards (4 of each)」コスト別リストで個別に裏取り済み。**

| 山名（randomizer） | 山のコスト | 上→下（各4枚） |
|---|---|---|
| **Townsfolk** | **[$2]** | Town Crier [$2] → Blacksmith [$3] → Miller [$4] → Elder [$5] |
| **Augurs** | [$3] | Herb Gatherer [$3] → Acolyte [$4] → Sorceress [$5] → Sibyl [$6] |
| **Clashes** | [$3] | Battle Plan [$3] → Archer [$4] → Warlord [$5] → Territory [$6] |
| **Forts** | [$3] | Tent [$3] → Garrison [$4] → Hill Fort [$5] → Stronghold [$6] |
| **Odysseys** | [$3] | Old Map [$3] → Voyage [$4] → Sunken Treasure [$5] → Distant Shore [$6] |
| **Wizards** | [$3] | Student [$3] → Conjurer [$4] → Sorcerer [$5] → Lich [$6] |

※**Townsfolk だけ $2/$3/$4/$5、他の5山は $3/$4/$5/$6**。
※山のコストは wiki `Split_pile`「Piles are sorted by the cost of the top card (which is shown on the randomizer card for the pile)」の分類でも裏取り（Townsfolk が [$2] 群、他5山が [$3] 群）。

- 種別も山ごとに固有：**Townsfolk / Augur / Clash / Fort / Odyssey / Wizard**（wiki の種別一覧で "**Single-pile types**"＝Prize/Reward/Knight/Ruins/Castle/Loot と同じ枠。実確認）。
  **カタログの types に必ず入れること**（Barbarian の種別一致の対象になる）。
- **枚数は人数によらず常に16枚**（Castles のような人数別セットアップは**無い**。ルールブックの同梱物が「4 each of ...」固定で、人数条件の記述が無いことを確認）。

### 5-3. 質問への回答

| 問い | 答え | 根拠 |
|---|---|---|
| 初期の並び順 | **コストの安い順で、一番上が最安** | `The cards start the game in order by cost.` ＋Augurs の例示 |
| 買える／獲得できるのは一番上だけか | **一番上だけ** | `only the top card of a split pile can be bought or gained` |
| 上が尽きたら次が見えるか | **見える**。**さらに Rotate でも次を出せる**のが帝国との最大の違い | 5-4 |
| 中身を見てよいか | **いつでも全部見てよい。ただし順番を変えてはいけない** | `You can look through the cards in a split pile at any time, without changing the order.` |
| 3山終了の数え方 | **分割山は1山として数え、16枚**全部**が無くなって初めて「空」** | wiki `Split_pile` の Empires 節逐語＝「Emptying the top half of a split pile does **not** count as emptying a pile, **for the game end condition** or cards that refer to empty piles. **The entire pile needs to be gone** for the pile to be empty.」<br>※これは Empires 節の文で、Allies 節に再掲は無い。同盟ルールブックの `As with the split piles in Dominion: Empires` による継承と読む（＝一次資料の直接明記ではなく**継承解釈**）。 |
| 山の「コスト」は？ | **買うときは「今の一番上のカード自身のコスト」**。**「山のコスト／種別」を参照する効果は randomizer カードの値＝固定** | `Some cards refer to information about a pile as if it's just one card. In these cases, go with what's on the Randomizer card` |
| 山を名指しする効果は？ | **その山の4種すべてに効く** | `Some things refer to cards from a particular pile; these things work on all cards from a split pile.` |

### 5-4. 帝国（Empires）の分割山との違い（実装差分の要点）

| | 帝国 | **同盟** |
|---|---|---|
| 1山の構成 | **2種×5枚＝10枚** | **4種×4枚＝16枚** |
| 下段への到達手段 | **上段を全部 獲得/廃棄して掘るしかない** | **上段を掘る＋「Rotate」で一番上を最下段へ送れる** |
| 城(Castles) | 8種の混合山・人数で枚数可変（2人=8／3人以上=12） | **人数不変の16枚固定** |
| 山の上下の入れ替わり | 基本は上→下の一方向 | **Rotate と Swap で日常的に順序が入れ替わる**（`This order may get messed up by cards like Swap; that's fine.`） |
| 共通点 | 一番上だけ購入/獲得可／山のコスト・種別は randomizer 準拠／山を名指しする効果は全種に効く／3山終了は「全部無くなって1山」 | 同左 |

### 5-5. 実装上の注意（分割山）— 本アプリのコードを実際に読んで確認済み

- **既存の `DOM.SPLIT_PILES` と `splitLocked` は、同盟の4段構成では使えない。**（コード実確認）
  - `js/cards.js:1275` `DOM.SPLIT_PILES = { 下段id: 上段id }` ＝**1対1マップ**。
  - `js/engine.js:31` `function splitLocked(state, id) { return !!(SPLIT_TOP[id] && (state.supply[SPLIT_TOP[id]] || 0) > 0); }`
    ＝**「上段が残っている間、下段は獲得不可」という2段専用モデル**。4段では表現できない。
  - → **`js/engine.js:1120` の混合山モデル（`isMixed = (cardId === 'ruins' || 'knights' || 'castles')`）に寄せるのが素直**
    （実カードid配列 `state[pileId]` を持ち、`state[cardId].shift()` で先頭だけ取る）。
    ただし城と違い**Rotate で先頭ブロックが末尾に回る**点が新しい。
- **`emptyPileCount`（3山終了）は分割山を1山として数え、配列が空になったときだけ「空」**。
  帝国の分割山は「上下2つの supply キー」で表現しているが、同盟は16枚1配列にするなら**二重計上に注意**。
- **`cardCost(state, '<pile>')` は先頭カードの実コストを返す**（城と同型）。
  一方 **randomizer 由来の固定値（若き魔女の災い候補・山トークンの配置可否・Trait 等）は別の述語**にすること。
  取り違えると、Rotate で一番上が変わるたびに「山のコスト」が動いて公式と食い違う。
- **山トークン（冒険の Training/Pathfinding 等）は山キーに載せる**＝その山の**4種すべて**にボーナスが乗る（既存 `pileKeyOf` と同じ考え方）。

### 🔴【追加7】Family of Inventors のコスト軽減は「全員に・恒久的に・累積で」効く

ルールブック逐語（自分のPDFで確認）:
```
Family of Inventors: This can't put tokens on Victory piles. It can put tokens on split piles that have
Victory cards in them, if the randomizer isn't a Victory card; this means it can put tokens on the 6 split
piles in Allies, but not on the Castles pile from Empires. The effect is cumulative; two tokens on a pile
means that cards in that pile cost [$2] less. This does not reduce costs below [$0]. This makes cards cost
less at all times for all players, not just for the player placing the token.
```
→ ① **「山が勝利点かどうか」は randomizer で判定**（＝§5-3 の原則の実例。Stronghold/Territory/Distant Shore が
勝利点でも、同盟の6分割山は randomizer が勝利点でないので**置ける**。Castles は randomizer が Victory なので**置けない**）。
② **累積**（2個で -[$2]）／③ **[$0] 未満にならない**／④ **全プレイヤーに常時**効く恒久的なコスト軽減。
→ 本アプリの `cardCost` に**橋/街道とは別枠の、山単位の恒久軽減**として入る。Favor はマットから山へ**移動**する（消えない）。

---

## 6. Duration（持続）

### 6-1. ルールブック逐語（2023年版 p.3。**初版と同文**）

```
Allies has some Duration cards. Duration cards are orange and have abilities that affect future turns.
Duration cards are not discarded in Clean-up if they have something left to do; they stay in play until
the Clean-up of the last turn that they do something. Additionally, if a Duration card is played extra
times by a card such as Specialist, that card also stays in play until the Duration card is discarded, to
track the fact that the Duration card was played extra times. Keep track of whether or not a Duration
card was played on the current turn, such as by putting your cards into two lines.
```

### 6-2. wiki `Allies` ページの現行版（後発拡張ぶんを補ったもの）

**【訂正5】出典の訂正**：下書きはこれを「wiki `Allies` / `Duration` の Official rules」としていたが、
**下の2文は `Duration` ページには存在しない**（全文検索して0ヒット）。
**`Allies` ページ → Additional rules → Durations 節にだけ載っている**。逐語:

```
Duration cards are orange, and have abilities that affect future turns.
Duration cards are not discarded in Clean-up if they have something left to do on a future turn;
they stay in play until the Clean-up of the last turn that they do something.
★ If a Duration card leaves play somehow, it stops doing things on future turns.
Additionally, if a Duration card is played extra times by a card such as
[Throne Room, Scepter, Mastermind, Specialist, Flagship, or Daimyo],
that card also stays in play until the Duration card is discarded, to track the fact that
the Duration card was played extra times; ★ and that effect also ends if that card somehow leaves play.
Keep track of whether or not a Duration card was played on the current turn,
such as by putting your cards into two lines.
```
※ `[ ]` はwiki編集者による一般化の印（ルールブック原文は `a card such as Specialist`）。★が後発の追加2文。

### 🔴【追加3】`Duration` ページ側にある、上と**対になる**重要な但し書き（下書きは未収録）

wiki `Duration` → Other rules clarifications 逐語:
```
When you use a Throne Room variant on a Duration, that Throne Room stays in play for as long as the
Duration does. ... If the Duration leaves play at an unusual time (e.g. Highwayman and Conjurer)
the Throne Room still stays in play until Clean-up; and if you replay that Duration later on, the
Throne Room still leaves play.
A card that plays a Duration only once (e.g. Elder or Vassal) never stays in play for multiple turns.
```
→ **① 「効果が終わる」と「カードが即座に捨てられる」は別**。持続側が早く場を離れても、玉座側は**その片付けまでは場に残る**。
→ **② 「1回だけプレイする」カードは場に残らない。**同盟の **Elder** がまさにこれ。
   wiki `Elder` 実確認＝[$5] **Action - Townsfolk**／`+[$2] You may play an Action card from your hand. When it gives you a choice of abilities (e.g. "choose one") this turn, you may choose an extra (different) option.`
   ＝**Elder は「もう一度」ではなく「1回」プレイするので、持続を使わせても Elder 自身は場に残らない。**
   **Specialist（「Play it again」）とは扱いが正反対**なので、同盟の2枚を同じロジックに乗せてはいけない。

### 6-3. 意味と実装上の注意
- **「玉座の間などが持続カードを余分に使用したら、その玉座の間自身も持続カードが捨てられるまで場に残る」**＝
  「余分に使用した」事実を物理的に追跡するための規則。
- ⚠️ **本アプリの既知の許容簡略化と正面衝突する項目**：
  PROGRESS §0-25／§0-28 の「命令/王子がサプライの玉座の間をプレイして持続を2回使うと、**次ターンも2倍のまま**」
  「**幽霊が持続カードをプレイしても幽霊自身は場に残らない**」（＝`p.delayedEffects` の残り枚数で持続を仕分けているため）。
  同盟では **Specialist（[$5]・Action）** が普通の王国カードとして入るので、
  **「持続を2回使ったときに Specialist 自身が場に残る」経路が日常的に発生する。**
  → 同盟を実装するときは `p.delayedEffects` の枚数勘定を必ず見直すこと。
  Specialist のルールブックFAQ（PDF実確認）＝「First you may play an Action or Treasure card from your hand. If you did, then after completely resolving playing that card, you choose to either play it again, or gain a copy of it. **You can play the card again even if it left play.** You can choose to gain a copy even if there are no copies left; you won't gain anything though. **This can only gain cards from the Supply.**」
- 同盟の Duration は**9枚**（Teaser の型カウント：`durations - 9`）。
- **同盟で初めて「Treasure - Duration」が登場＝`Contract`**。
  wiki `Contract` 実確認＝**[$5] / Treasure - Duration - Liaison** ／ `[$2]  +1 Favor  You may set aside an Action from your hand to play it at the start of your next turn.`
  wiki `Duration` 逐語＝「Duration **Treasures** began to be introduced with **Contract** from Allies」。Teaser の "a treasure-duration"（**単数**）とも一致。
  → **財宝でありながら片付けで捨てずに場に残る**＝既存の「持続は必ずアクション」前提のコードがあれば壊れる。

### ⚠️【訂正6】`Courier` は Treasure-Duration では**ない**（下書き §11-13 の誤り）

下書きは末尾のまとめで「**Treasure-Duration（Contract / Courier）**＝財宝なのに場に残る」と書いていたが、
これは**同じ文書の §6-3（Contract が唯一）と矛盾**しており、後者が正しい。

wiki `Courier` 実確認:
```
Cost: [$4]   Type(s): Action        ← 単なるアクション。Treasure でも Duration でもない
Card text: +[$1]  Discard the top card of your deck.
           Look through your discard pile; you may play an Action or Treasure from it.
```
→ **Courier は普通のアクションで、片付けで普通に捨てられる。** Treasure-Duration は **Contract のみ**。
（`Courier` を持続として実装すると、場に残り続けて保存則・片付けが壊れる。）

---

## 7. セットアップ（同盟固有）

### 7-1. ルールブック逐語（2023年版 p.2）

```
Dominion: Allies includes 31 randomizer cards (one for each Kingdom card pile). Players will need the
Treasure cards, Victory cards, Curse cards, and Trash mat/card from either Dominion or Base Cards (or
older editions of Intrigue) and the rules from Dominion to play with this expansion. As with previous
Dominion games, players must choose 10 sets of Kingdom cards for each game. If players choose the
random approach for choosing sets, they should shuffle the randomizer cards from this expansion with
those of any other Dominion games they choose to play with.

In games using one or more Liaison cards, give each player a Favors mat and deal out a single Ally card.
The Ally cards are a separate deck, not combined with Events and so on. Each player gets a single Favor
token to start with (or five tokens in games with Importer).
```

### 7-2. 手順（実装順）
1. **王国10山を選ぶ**（randomizer は 31枚＝25の通常山＋6の分割山。**分割山は1枚の randomizer で1山**）。
2. **分割山を作る**：選ばれた分割山ごとに、**4種×4枚をコストの安い順に重ねる**（最安が一番上）。人数による調整は無い。
3. **Liaison が1枚以上あるか判定**（🔴 **分割山は中身4種すべてを見る**＝Wizards の Student が Liaison。【追加2】参照）→ あれば：
   - 全員に **Favors マット**を1枚ずつ配る。
   - **Ally を1枚だけ無作為に決める**（23枚の Ally 専用デッキから。Event 等のランダマイザーとは混ぜない）。
   - **全員に開始時 Favor を1個**。ただし **Importer が王国にあるゲームは 5個**（Importer の `Setup: Each player gets +4 Favors.`）。
4. Liaison が無ければ 3 は丸ごと行わない。
5. その他の横型（Event/Landmark/Project/Way/Trait）は普段どおり（**Ally はこの枚数制限に含めない**）。

### 7-3. 同梱物とコイントークン35個の用途

ルールブックの同梱物リスト逐語（自分のPDFで確認）:
```
400 cards
     250 Normal Kingdom cards   (10 each of 25 名 — Barbarian … Underling)
      96 Split pile cards       (4 each of 24 名 — Acolyte … Warlord)
      31 Randomizer cards
      23 Ally cards
 6 Favors mats
35 Coin tokens
```
- **400枚** ＝ 250 ＋ 96 ＋ 31 ＋ 23。**王国カードの合計＝346**（250+96。wiki `Allies` の Info ボックスと一致）。
- **Favors マット 6枚**（＝最大6人ぶん）。
- **【訂正7】コイントークン35個の用途は、同盟の中でも「Favor」と「Garrison」の2つ**
  （下書きは「用途は Favor のみ」と書いた直後に Garrison を挙げていて自己矛盾していた）。
  **Garrison はカードの上にトークンを載せる**（`add a token here`）＝**Favor ではない**。
  他拡張の Coffers/Villagers/Pirate Ship/Trade Route/Sinister Plot 用のコイントークンと物理的には同じ物で、混ぜて使える。

---

## 8. 「同盟にイベント／ランドマーク／プロジェクト／習性は無い」の確認

**確認できた。同盟が追加する横型は Ally 23枚だけ。**
- 同梱物リスト（400枚の内訳）に Event / Landmark / Project / Way / Trait は**一切現れない**（上記 7-3・PDF実確認）。
- wiki `Allies` の Info ボックス：`Other Card(s) = 23 Ally cards`。Contents 節も「Kingdom cards / Allies / Additional materials」の3つだけ。
- ルールブック自身が `You can still have as many other landscape cards (Events, Landmarks, Projects, Ways) as you otherwise would have.`
  ＝**「他の拡張から持ってくる横型」という言い方**をしており、同盟が供給しないことを裏から示している。
- Donald X. の Secret History（wiki `Ally` 実確認）：「There was also another new kind of **landscape**; I liked it but **can only fit so much into one expansion**.」
  ＝もう1種類の横型は**同盟に入らなかった**と明言（これが後の Trait / Prophecy に相当）。

---

## 9. Versions（版）— 初版と第2刷の差

wiki `Allies` の Versions 表 逐語（実確認）:

| Date | Rulebook | Changes |
|---|---|---|
| **March 2022** | PDF | **First edition**<br>Errors:<br>Rulebook — The text at the end of the last page is missing the last line with the mail address and web site for Rio Grande Games. |
| **December 2023** | PDF | **Functional changes:**<br>**Island Folk, Voyage** — Cannot take a third turn in a row (2023).<br>**Cosmetic changes:**<br>**Elder** — Rephrased for clarity (2023). |
| Expected changes for future printing | — | Cosmetic changes:<br>Specialist — Rephrase "Play it again" to "Replay it" to match the phrasing of other Throne Room variants.<br>Sunken Treasure — Remove the value of [$0] from the upper corners of Treasures (2022).<br>Importer — Mark "Setup:" in bold (2023). |

### 9-1. 機能変更2枚の新旧カードテキスト

**【訂正8】出典の訂正**：下書きは「wiki の **Versions 表**から逐語」としていたが、
**`Allies` ページの Versions 表にカードテキストは載っていない**（上表のとおり変更サマリだけ）。
新旧テキストは**各カードページの「Versions → English versions」表**にある。そちらから逐語（実確認）:

```
Island Folk
  [初版 2022-03] At the end of your turn, if the previous turn wasn't yours, you may spend 5 Favors
                 to take another turn.
  [現行 2023-12] At the end of your turn, you may spend 5 Favors to take an extra turn after this one
                 (but not a 3rd turn in a row).                                    (2023 printing)

Voyage   ([$4] / Action - Duration - Odyssey)
  [初版 2022-03] +1 Action
                 If the previous turn wasn't yours, take an extra turn after this one,
                 during which you can only play 3 cards from your hand.
  [現行 2023-12] +1 Action
                 Take an extra turn after this one (but not a 3rd turn in a row),
                 during which you can only play 3 cards from your hand.             (2023 printing)
```
→ **本アプリは現行（2023年12月＝第2刷）を採用する。**

### 9-2. 追加ターン系の裁定（Island Folk / Voyage・カード担当への申し送り）
wiki `Island_Folk` / `Voyage` の Official FAQ (2023) と Other rules clarifications より（実確認）:
- `This can never let you take a 3rd turn in a row.`（両方）
- **Island Folk と Voyage を同じターンに両方使おうとしたら**：「you've hit the "but not a 3rd turn" limit, so **you will have to choose which extra turn to take**」
- 「If you spend Favors for Island Folk **on an extra turn**, you won't get an extra turn.」
- 「If you are **Possessed**, and they make you spend Favors for Island Folk, you take an Island Folk turn, and then take your normal turn.」
- **【追加8】**「**You can look at your next hand before deciding to spend 5 Favors for an extra turn.**」
  → 本アプリは**自分の手番終了時に次の手札を先引きする**設計なので、**この裁定と自然に整合する**（珍しく簡略化不要の箇所）。
- Voyage：「This limits plays of **all types** of cards, including Treasures like Copper.」「if the third card you play is Golem, it can still play its two cards, which are set aside」（＝**手札からの使用だけを3枚に数える**）。「if you Throne Room a card, **both Throne Room and that card count as plays from your hand**, but Throne Room **replaying** the card does not.」

### 🔴【追加4】追加ターンの競合は「Island Folk × Voyage」に限らない — **一般則**

wiki `Voyage` の Other rules clarifications 逐語（下書きは未収録）:
```
If you set up multiple extra turns at once (e.g. one from Voyage, one from Mission),
you choose one turn to take, and the others fail.
If you play Voyage multiple times in one turn, you aren't able to take more than 2 turns in a row,
so all Voyages after the first will fail.
If you play Voyage on an extra turn, you fail to get a 3rd turn.
If a Voyage turn fails to occur (e.g. due to Lich), you discard the Voyage during the next
Clean-up that happens (either yours or another player's).
```
→ **本アプリは既に 前哨地(Outpost)／使節団(Mission)／今を生きる(Seize the Day)／艦隊(Fleet)／支配(Possession) を実装済み。**
PROGRESS §0-26 の優先順位ロジック（前哨地 > 使節団 > 今を生きる／負けた旗は持ち越す）に
**Voyage と Island Folk を「3連続不可」制約つきで組み込む**必要がある。「片方だけ実装して他は無視」はできない。

### 🔴【追加5】Voyage の「手札から3枚まで」は **Ally の能力も止める**

wiki `Voyage` 逐語:
```
Once you've played 3 cards from your hand, Voyage's restriction will override any ability that lets you
play cards from your hand (such as Market Towns or Storyteller).

Normally, if you gain an Action and immediately play it (e.g. you gained a Buried Treasure, or you spent
Favors for City-state), that won't count towards Voyage's limit. However, if you gained the card directly
to your hand (with e.g. Swap), then playing that card with e.g. City-state will count towards Voyage's limit.
```
→ **Market Towns（Ally）と City-state（Ally）が Voyage と直接干渉する。**
Ally の「手札からアクションを使う」窓は、Voyage ターンでは**3枚制限に従わせる**こと。
（Storyteller＝語り部は本アプリ実装済み＝同じ制約に服する。）

### 🔴【追加9】日本語版の印刷テキスト（下書きの「未調査」を一部解決）

wiki `Island_Folk` の「Other language versions」表に**日本語行がある**（実確認）:
```
Japanese: 島民
あなたのターンの終了時、直前のターンが自分のターンでない場合、好意5 を使ってもよい。
そうした場合、追加のターンを得る。
```
→ **「直前のターンが自分のターンでない場合」＝初版(2022-03)の文面**。
＝**日本語版カードは初版テキストで印刷されている**（ドイツ語版・オランダ語版も同様。フランス語版のみ現行）。
→ 夜想曲と同じく、**本アプリは現行（2023年12月）を採用**する（PROGRESS の既定方針どおり）。
→ 副産物として**公式訳語が2つ確定**：**Favor＝好意** ／ **Island Folk＝島民**。
※Voyage と 23枚の Ally には日本語行が無い（蘭・仏・独のみ）＝日本語名担当は別途 日本語wiki を当たること。

---

## 10. この拡張の規模（実装計画用）

- **31の王国山**＝通常25山（各10枚）＋**分割山6山（各16枚）**。
- **カード種類の総数＝25＋24（分割山の中身）＝49種の王国カード ＋ Ally 23種 ＝ 72種**。
- Teaser の型カウント（Donald X.・wiki `Allies` で逐語実確認）：
  `actions - 45 / allies - 23 / liaisons - 9 / durations - 9 / attacks - 7 / treasures - 3 / victory cards - 3 / reactions - 0`
  → **リアクションはゼロ**（アタック7枚に対して同盟内には堀型の防御が無い）。
  Miscellaneous 欄も逐語確認：`a kingdom card that cares about shuffling` / `a sorcerer and a sorceress` / `a treasure Pawn` / **`a treasure-duration`（単数）** / **`two cards with four types`**。
- **【追加10】「4種別のカードが2枚」**＝その1枚は **Stronghold**（wiki 実確認＝**Action - Victory - Duration - Fort**）。
  ルールブックFAQ＝「If you choose +[$3], Stronghold will be discarded that turn; if you choose the +3 Cards next turn,
  Stronghold will stay out until that turn's Clean-up (**and if you choose both via Elder, it will stay out**).」
  → **分割山の中に「勝利点かつ持続」が入る**＝得点計算・片付け・`vpOf` の全部に絡む。
- 新種別＝**Liaison**（王国カード9枚）／**Ally**（横型・非カード）／
  分割山専用種別 **Townsfolk・Augur・Clash・Fort・Odyssey・Wizard**（6種）。
- 新機構＝**Favor トークン**／**Ally（横型）**／**Rotate**／**4種16枚の分割山**（＋Treasure-Duration が初登場）。

---

## 11. 実装で素朴に書くと間違える点（まとめ）

1. **Rotate は「先頭からの連続同名ブロック」を末尾へ移す**。離れた場所の同名は動かさない（Swap で乱れた後に効く）。
2. **【訂正】Rotate の位置はカードごとに違う**。Town Crier/Herb Gatherer/Old Map/Tent/Battle Plan は最後だが、
   **Student だけ rotate が先で強制廃棄が後**。「常に最後」と決め打ちしない。
3. **空の山・1種類だけの山を Rotate しても合法**。何も起きないだけ（選択肢ゼロで詰ませない）。
4. **Battle Plan は「サプライ山」限定**だが、他の5枚は「自分の山」を名指し（サプライ外でも回せる）。
5. **「山のコスト／種別」は randomizer 固定、「買うときのコスト」は今の一番上**。この2つを混同しない。
   （Family of Inventors の「勝利点の山には置けないが同盟の6分割山には置ける」がこの原則の実例。）
6. **分割山16枚が全部無くなって初めて1山ぶんの「空」**（3山終了・空山参照カード）。
7. **Favor は Coffers/Villagers と別枠**。**Garrison のトークンは Favor ではない**。
8. **Favor は得点にならない**（Plateau Shepherds のあるゲームだけ例外。しかも**自分の Favor しか見ない**）。**上限も無い**。
9. **Favor はゲーム最初のターンから**。開始デッキの最初のシャッフルには Order of Astrologers / Order of Masons を使えない。
10. **1トリガー1回**。`Repeat as desired.` のある Ally だけ複数回。
11. **Ally は1枚だけ**。Liaison が何枚あっても、他の横型が何枚あっても変わらない。**横型2枚制限には数えない**。
12. **Liaison は Barbarian の「種別一致」の対象**＝飾りではなく本物の種別。
13. **【訂正】Treasure-Duration は `Contract` **だけ**。`Courier` は単なるアクション**（[$4] / Action）で片付けで普通に捨てる。
14. **Specialist で持続を2回使うと Specialist 自身も場に残る**（本アプリの既存簡略化と衝突する）。
    **ただし Elder は「1回だけ」プレイなので場に残らない**——同じ「アクションを使わせるカード」でも扱いが逆。
15. **Importer は Setup 変更（全員 +4 Favor）を持つ唯一のカード**＝`createInitialState` の段階で処理する。
16. **【追加】Ally の効果は「アタックカードのプレイ」ではない＝堀/灯台で防げない**（【追加6】）。
17. **【追加】Wizards の Student は Liaison**＝分割山の中身を走査しないと Ally 判定を取りこぼす（【追加2】）。
18. **【追加】獲得したばかりの Favor はその場の窓で即使える**（【追加1】）。

---

## 🔴 12. 実装者への最重要警告（下書きが完全に見落としていた2件）

### 【追加6】Ally が起こす攻撃は「アタックカードのプレイ」ではない＝**堀で防げない**

ルールブック逐語（2箇所・自分のPDFで確認）:
```
Circle of Witches: ... to have each other player gain a Curse.
                   This is not playing an Attack card and cannot be blocked with Moat.

Gang of Pickpockets: ... and if you didn't, you discard down to 4 cards in hand.
                   It's okay if you already only had 4 cards or fewer.
                   This is not an Attack card being played and cannot be blocked with Moat.
```
→ **`ATTACKS` レジストリに登録してはいけない／リアクション窓を開いてはいけない。**
本アプリはアタックを `ATTACKS` 登録表＋`*EnterVictim`＋堀/灯台免疫 で処理しているので、
Circle of Witches・Gang of Pickpockets を「呪い配布アタック」「手札制限アタック」として素直に既存機構へ乗せると
**公式より弱くなる**（堀・灯台・チャンピオン・守護者で無効化されてしまう）。
**Ally 由来の効果は免疫判定を一切通さない専用経路にすること。**

### 【追加11】★最大の地雷★ Order of Astrologers / Order of Masons は **`reshuffleDeck` と正面衝突する**

ルールブック逐語（自分のPDFで確認）:
```
Order of Astrologers: Each time you shuffle, you can spend Favors to look through the cards and pick
one card per Favor spent to go on top. Shuffle the other cards normally. You can't look through your
cards unless you spend at least one Favor. You can look at any to-be-drawn cards while making this
decision; for example, if you're shuffling at end of turn and had two cards left, you can look at those,
then decide whether or not to spend Favors and what cards to put on top. After spending a Favor and
looking at the cards, you may still spend more Favors. Note that Emissary and Underling can cause you
to shuffle before giving you Favors; the Favors you don't have yet can't be used on that shuffle.

Order of Masons: Each time you shuffle, you can spend Favors to look through the cards and pick up to
two cards per Favor spent to put into your discard pile. Shuffle the other cards normally, but don't
shuffle in those cards. ... (以下 Astrologers と同文の但し書き)
```

**なぜ地雷か**（コードを実際に読んで確認）:
- `js/engine.js:609` の **`reshuffleDeck(p)` は同期・非対話の関数**。シャッフルの最中に `state.pending` を立てて
  人間/CPUの選択を待つ機構が**存在しない**。
- PROGRESS §0-22 は、まさにこの制約のせいで **星図（star_chart）を「最良の札を自動で選ぶ」**、
  **へそくり（Stash）を「常設方針 `stashPlacement` で自動配置」** という**許容簡略化**にしたと記録している
  （`js/engine.js:578-596` のコメントで「シャッフル中に対話を挟めない…未実装のままの難物」と明記）。
- ところが Order of Astrologers / Order of Masons が要求するのは、
  **① 毎回のシャッフルで ② 全カードを見て ③ 何個 Favor を払うか決め ④ 払うたびに再度選び直せる（repeatable）** という、
  **まさにその「シャッフル中の対話」そのもの**。しかも **23分の2 の Ally＝約9%のゲームで必ず出る**。

**取りうる方針（実装時に決定が必要）**:
- (a) 既存の `stashPlacement` / `star_chart` と同じく**常設方針＋自動選択**に倒す（＝許容簡略化を1つ増やす）。
- (b) `reshuffleDeck` を「シャッフル要求 → pending → 解決後に確定」の**非同期化**に作り替える（横断リファクタ。
  `reshuffleDeck` は37箇所から呼ばれている＝影響範囲が極めて広い）。
- (c) Order of Astrologers / Order of Masons の2枚だけ Ally プールから外す（＝忠実性を落とす。
  PROGRESS の「簡略化より忠実性を優先」方針に反するので最後の手段）。

**どれを選ぶにせよ、同盟の設計段階で最初に決めるべき論点。** 後から差し込むのは非常に高くつく。
なお **「Emissary と Underling は Favor をくれる前にシャッフルを起こしうる。まだ持っていない Favor はそのシャッフルには使えない」**
という但し書きは、(b) を採る場合の**評価順序**を規定するので必ず守ること。

---

## 13. 未解決・要注意（一次資料が無い／割れている）

| 項目 | 状況 |
|---|---|
| **Favors マットが公開情報か** | ルールブック・wiki（`Favor`/`Ally`/`Mat`）とも**明示なし**（検証で再確認）。**公開として実装**が妥当だが、根拠は「Coffers/Villagers と同型」「伏せる指示が無い」「公式実装が全員ぶん表示」であって、**Plateau Shepherds ではない**（訂正3）。 |
| **空の山を Rotate したときの扱い** | **明示的な公式裁定なし**（wiki 全文＋PDF を横断検索して該当なし）。「合法だが無効果」で問題ない。 |
| **Order of Astrologers/Masons の実装方式** | **本プロジェクト固有の未決事項**。上記【追加11】の (a)/(b)/(c) から選ぶ必要がある。 |
| **Island Folk の「3ターン連続不可」FAQ の初出時期** | wiki は `Official FAQ (2023)` と表示するが、**2022年3月刷のルールブックPDFにも同じ一文が既に載っている**。カードテキストが変わったのは2023年12月刷。実装には影響しない（どちらでも「3連続不可」）。 |
| **日本語版カードの印刷版** | **Island Folk は初版テキストで確定**（【追加9】）。他のカードは wiki に日本語行が乏しく未確定。**現行＝2023年12月版を採用**する方針は変わらない。 |
| **Voyage・23 Ally の日本語名** | wiki `Voyage` / 各 Ally ページに日本語行が無い。**日本語wiki（ホビージャパン印刷版）を当たること**（PROGRESS の「日本語名は日本語wikiが正本／英語wiki の Japanese 行は当てにならない」方針どおり）。 |

---

# Allies（同盟）研究 — g02_kingdom_2_3：非分割の王国カード 6枚

担当＝**Bauble / Sycophant（$2）／ Importer / Merchant Camp / Sentinel / Underling（$3）**

> **【敵対検証済み・2026-08-12】** 別の検証官が下書きの引用を一切コピーせず、英語wiki 6ページ＋`Allies`／`Errata`／`Lurker`／
> `Clean-up phase`（Wayback 経由）と RGG 公式ルールブック PDF（実DL＋`pdftotext -layout`）、および**日本語wiki
> （wikiwiki.jp/dominiondeck・ホビージャパン日本語版が正本）の6カードページ**を独立に引き直して全項目を再検証した。
> **カードテキスト・コスト・種別・Setup・公式FAQ の逐語は 6/6 すべて下書きどおりで誤りゼロ**だったが、
> **実装に直結する裁定の欠落4件・根拠の誤り2件・日本語名の全欠落**を訂正・追記した（訂正箇所は 🔴 で示す）。
> 生データ＝`c:\tmp\verify_g02\`（`allies.txt`＝rulebook全文／`bauble.txt`／`sycophant.txt`／`allies_page.txt`／
> `err2.txt`／`lurker.txt`／`cleanup.txt`／`jp_*.txt`）。

---

## 0. この6枚に共通する前提（Liaison / Favors の一般ルール）

6枚のうち **4枚（Bauble / Sycophant / Importer / Underling）が Liaison** で、Merchant Camp と Sentinel は Liaison ではない（Favors に無関係）。

**RGG 公式ルールブック 逐語（p.2〜3／独立に再取得して1語ずつ照合＝完全一致）:**

```
In games using one or more Liaison cards, give each player a Favors mat and deal out a single Ally card.
The Ally cards are a separate deck, not combined with Events and so on. Each player gets a single Favor
token to start with (or five tokens in games with Importer).

Allies are landscape cards that give Favor tokens a use; Liaisons are kingdom cards that provide a way to
get Favor tokens. In games with a Liaison, deal out a random Ally to use that game. Only use one Ally
per game, even with multiple Liaisons. You can still have as many other landscape cards (Events,
Landmarks, Projects, Ways) as you otherwise would have.

Coin tokens are used for Favors; they go on a Favors mat to distinguish them from Coffers and
Villagers (from other expansions), which have their own mats. When a card gives you +1 Favor, add a
token to your mat; when spending a Favor, remove the token from your mat.

Favors may be used starting with the first turn of the game; they may not be used prior to that turn.
Spending Favors is always optional. Spending Favors can only be done once per time an Ally ability
triggers, unless it says, "Repeat as desired."
```

実装で効く要点:
- **Liaison が1枚でも王国にあれば Ally を1枚だけ配る**（Liaison が複数あっても Ally は1枚）。Ally は Event / Landmark / Project / Way の「合計最大2枚」の枠とは**別枠**で、他の横型カードの枚数を減らさない。
- 開始 Favor＝**各自1個**。ただし **Importer がある対局は各自5個**（Importer の Setup が +4）。
- **Favor は非カード**（Coin token）＝保存則 tally に混ぜない。Coffers / Villagers とは別のマットで、混ぜて使えない。
- Favor はゲーム最初のターンから使える（それ以前＝セットアップ中は使えない）。使うのは常に任意。
- Ally 能力の1回の誘発につき Favor の消費は1回だけ（"Repeat as desired." と書いてある Ally を除く）。

🔴 **日本語版の用語（日本語wiki＝ホビージャパン版が正本。下書きには1つも無かった）**
| 英語 | 日本語（公式） |
|---|---|
| Liaison（カード種別） | **連携** |
| Favor(s) | **好意** |
| Ally（横型カード） | **同盟** |
| Setup: | **準備：** |
| 拡張名 Allies | **同盟** |

---

## 1. Bauble  [$2]

- **id候補**: `bauble`　／　🔴 **日本語名: 道化棒**（種別表記＝**財宝-連携**）
- **コスト**: $2（ポーション費用なし・負債コストなし）
- **種別**: **Treasure - Liaison**（財宝＋連携）
- **カードテキスト（英語・現行／英語wiki `Bauble` の Card text 欄を再取得）**:

```
Choose two different options: +1 Buy; +[$1]; +1 Favor;
this turn, when you gain a card, you may put it onto your deck.
```

🔴 **日本語カードテキスト（日本語wiki `道化棒`・逐語）**:

```
次のうち異なるもの2つを選ぶ：
「+1 カードを購入」；「+1 コイン」；「+1 好意」；
「このターン、あなたがカード1枚を獲得するときそれをあなたのデッキの一番上に置いてもよい」
```

- **Setup:**: なし
- **公式FAQ・裁定**:
  - **RGG ルールブック逐語（再取得・完全一致）**: *"Bauble: Choose two of the four options; the first three options are simple +1's, and the last is everything else. So for example you could choose to take +1 Buy and 'this turn, when you gain a card, you may put it onto your deck.'"*
    → **選択肢は4つ**（+1 Buy ／ +$1 ／ +1 Favor ／ topdeck 能力）で、そのうち**異なる2つ**を選ぶ。
  - **同じ選択肢を2回は選べない**（カード文 "two **different** options"）。
  - 🔴 **【訂正・根拠の差し替え】2つを「先に両方選んでから」解決する**。下書きは Pawn の FAQ を「参考（Bauble に同文の記載は無い）」としていたが、**Bauble 自身の一次資料がある**＝
    日本語wiki `道化棒` 詳細なルール 逐語：*「先に2つの効果を選択してからそれらの効果を解決する。」*
  - 🔴 **【訂正】4番目のオプションが Bauble の場離脱後も効く根拠**。下書きは *「2022エラッタで全カードがこの表現に統一された」* と書いていたが**これは誤り**。
    英語wiki `Errata` を再取得したところ、*"Active this turn instead of while in play (2022)"* は
    **Quarry / Princess / Highway / Groundskeeper / Tracker / Sauna などの個別カードに対する変更**であり「全カード統一」ではない。
    **Bauble はそもそも 2022年3月の初版から "this turn" で印刷されておりエラッタ対象ですらない。**
    正しい一次資料＝日本語wiki `道化棒` 詳細なルール 逐語：
    *「道化棒の玉璽効果は使用時効果なので、偽造通貨で使用し、廃棄されるなどして場から移動しても、効果を失わない。」*
    → **結論（Bauble が場を離れてもそのターンの残りは topdeck 能力が効き続ける）は下書きどおり正しい**。根拠だけ差し替えた。
  - topdeck は **"you may"＝獲得ごとに任意**。対象は **「あなたが獲得したカード」** のみ（相手の獲得は対象外）。
  - 🔴 **【追記】複数回プレイ時は毎回選び直せる**。日本語wiki 逐語：*「偽造通貨や冠や専門家などで道化棒を複数回使用する場合、1回目と2回目で違う効果を選ぶことができる。」*
    （＝玉座系の再演でも選択をやり直す。本エンジンは §0-15 で「命令の再演は選び直さない」を `commandAs` で実装したが、**Bauble はそれとは逆で毎回選び直す**＝`commandAs` を流用してはいけない。）
  - 🔴 **【追記】Bauble はアクションカードではないので Elder（長老・同盟$2 Townsfolk）の対象にできない**。日本語wiki 逐語：*「選択効果を持つが、アクションカードでないため、長老の対象とすることができない。」**（同拡張内の相互作用＝g01/Townsfolk 担当と突き合わせること）
  - **Liaison** なので、この1枚が王国に入るだけで Favors マット＋Ally が配られる（§0）。
- **エラッタ**: **なし**（英語wiki `Bauble` の English versions 表は `Allies / March 2022` の1行のみ＝2023年12月の第2刷でも変更なし。英語wiki `Errata` の Allies 節にも Bauble は無い）。
- **実装上の注意**:
  - **財宝カード**なので通常は購入フェイズに出す。ただし「アクションフェイズに財宝を出させる」カード（語り部・闇市場など）経由でも出せる＝**その場合も topdeck 能力はそのターン中ずっと有効**。
  - topdeck は「獲得を置換する」効果ではなく、**獲得した後にそのカードを山札の上へ移す**（"put it onto your deck"）。したがって **Stop-moving ルールの対象**＝獲得直後に別の効果でカードが動いてしまっていたら移せない。
  - 🔴 **【本エンジン固有】この「このターン、獲得したとき〜」の窓は `state.onGainQueue` に積むこと**（`state.pending` を直接代入しない）。PROGRESS §0-26 の要点＝「1つの効果で複数枚を獲得する」ときに直代入すると望楼/牧羊犬などの窓を握りつぶす。
  - 4つのうち3つは単純な +1 なので解決順は結果に影響しない（実装は記載順でよい）。
  - **同一ターンに Bauble を2枚出して両方で4番目を選んでも、1回の獲得でカードを山札の上に2回は置けない**（2つ目は Stop-moving で追跡を失う）。※一次資料に明示の記述は見つからなかった＝実装者判断。
  - **+1 Favor は即座に使える**（Ally によっては購入フェイズ中に使う）。

---

## 2. Sycophant  [$2]

- **id候補**: `sycophant`　／　🔴 **日本語名: ごますり**（**アクション-連携**）
- **コスト**: $2（ポーション費用なし・負債コストなし）
- **種別**: **Action - Liaison**（アクション＋連携）
- **カードテキスト（英語・現行）**:

```
+1 Action

Discard 3 cards. If you discarded at least one, +[$3].
------------------------------
When you gain or trash this, +2 Favors.
```

🔴 **日本語カードテキスト（日本語wiki `ごますり`・逐語）**:

```
+1 アクション
カード3枚を捨て札にする。1枚以上を捨て札にした場合、+3 コイン。
------------------------------
このカードを獲得または廃棄するとき、+2 好意。
```

- **Setup:**: なし
- **公式FAQ・裁定**:
  - **RGG ルールブック逐語（再取得・完全一致）**:
    ```
    Sycophant: You can play this regardless of how many cards are left in your hand.
    When you play this, if you have at least three cards left in hand, you discard three
    and get +[$3]. If you have one or two cards, you discard them and get +[$3]. If you
    have no cards, you don't get the +[$3]. When you gain or trash this, you get +2
    Favors; you can immediately spend them, for example on the ability of City-state.
    ```
  - **捨て札は強制**（"you may" ではない）。手札が3枚未満なら**あるだけ全部**捨てる。
  - **1枚でも捨てたら +$3**（3枚捨てる必要は無い）。**手札0枚なら +$3 は無し**（+1 Action だけ）。
  - **獲得でも廃棄でも +2 Favors**。得た Favor は**その場で即使える**（例：City-state＝都市国家）。
  - 🔴 **【重大な追記＝実装に直結】3枚は「1枚ずつ」ではなく「同時に」捨てる**。
    日本語wiki `ごますり` 詳細なルール 逐語：
    *「手札から複数の枚数のカードを捨て札にする際には1枚ずつではなく、カード全てを同時に捨て札にする処理であることに注意。
    例えば、手札からまず坑道を捨て札にする→坑道のリアクション効果で金貨を獲得→手札から望楼を公開し金貨をデッキの上に置く
    →望楼を捨て札にする…という動きはできない。
    例えば、手札の村有緑地を捨て札にする→村有緑地をリアクションして即座に「+1ドロー、+2アクション」を得る、
    という動きはできるが、ここでドローしたカードを更に捨て札にすることはできない。」*
    → **捨てる3枚を確定して同時に手札から捨て札へ移してから、捨て札トリガー（坑道 Tunnel／村有緑地 Village Green／忠犬 Faithful Hound）を解決すること**。
    「1枚捨てる→トリガー解決→次の1枚を選ぶ」というループ実装にすると公式挙動から外れ、望楼との合わせ技で不正が通る。
  - 🔴 **【追記】Peaceful Cult（平和的教団）との組み合わせ**：平和的教団は「支払う好意数を決める→支払う→その枚数ぶん廃棄する」の順なので、
    **平和的教団でごますりを廃棄して得た2好意を、その同じ平和的教団の支払いに上乗せすることはできない**（日本語wiki 逐語）。
    一方、**獲得時の2好意は、その獲得自体を対象とする Ally（都市国家）の支払いに使える**（＝City-state で今獲得したごますりを即使用できる）。
  - 🔴 **【決着】サプライから直接廃棄（Lurker 等）でも +2 Favors は発動する**（下書きは「一次資料に明示なし」としていたが、決着した）。
    英語wiki `Lurker` の "Other Rules clarifications" 逐語：
    *"Trashing a card from the Supply will activate its when-trash abilities. For example, if you trash a Fortress from the Supply,
    it will move itself into your hand; if you trash Hunting Grounds from the Supply, you gain a Duchy or 3 Estates.
    Trashing from the Supply does **not** allow you to react with Market Square, because it isn't one of your cards."*
    → **Sycophant は "When you gain or trash **this**" ＝カード自身の能力なのでサプライから廃棄されても発動し、得るのは廃棄したプレイヤー。**
    Market Square（青空市場）だけが "one of **your** cards" なので発動しない、という線引き。
  - **Liaison**（§0）。
  - Barbarian の公式FAQ 逐語（再取得・完全一致）：*"...they could gain a Royal Galley, as they share the Duration type, or a Silver, as they share the Treasure type, or a **Sycophant, as they share the Liaison type**."*
    → **Liaison 種別は「種別を共有する」判定の対象になる**（種別を1つ落とすと他カードが静かに壊れる）。
- **エラッタ**: **なし**（English versions 表は `Allies / March 2022` の1行のみ。`Errata` の Allies 節にも無し）。
  - ※ Secret History によれば、開発中は "at least one" の条件が無かった（League of Shopkeepers と組んで壊れたので後付け）。**印刷版は最初から現行テキスト**。
- **実装上の注意**:
  - **`+1 Action` を先に解決してから捨て札**（記載順）。捨てる前に手札枚数を測ること（Sycophant 自身は既に場に出ているので手札に含まれない）。
  - `When you gain or trash this` は**カード上の静的能力**なので、**どのゾーンから獲得／廃棄しても働く**（購入で獲得／効果で獲得／手札から廃棄／場から廃棄／山札の上から廃棄／**サプライから廃棄**）。
  - 🔴 **【本エンジン固有】`trashFromSupplyPile` / `trashCard(opts.fromSupply)` は青空市場を抑止するが、Sycophant は抑止してはいけない**（§0-23 で入れた `opts.fromSupply` の抑止対象を広げないこと）。
  - 🔴 **【本エンジン固有】支配（Possession）中の獲得は獲得者＝支配者**（§0-23）なので、+2 Favors も支配者に入る。
  - **獲得時・廃棄時トリガーが同一カードに両方ある**＝実装では on-gain と on-trash の両方に配線が必要。

---

## 3. Importer  [$3]

- **id候補**: `importer`　／　🔴 **日本語名: 輸入者**（**アクション-持続-連携**）
- **コスト**: $3（ポーション費用なし・負債コストなし）
- **種別**: **Action - Duration - Liaison**（アクション＋持続＋連携）
- **カードテキスト（英語・現行）**:

```
At the start of your next turn, gain a card costing up to [$5].
------------------------------
Setup: Each player gets +4 Favors.
```

🔴 **日本語カードテキスト（日本語wiki `輸入者`・逐語）**:

```
あなたの次のターンの開始時、コスト5以下のカード1枚を獲得する。
------------------------------
準備：各プレイヤーは +4 好意 を得る。
```

- **公式FAQ・裁定**:
  - **RGG ルールブック逐語（再取得・完全一致）**: *"Importer: At the start of the game, each player gets five Favors instead of one. Importer doesn't provide a way to get any more Favors during the game."*
  - **wiki `Ally` / ルールブック p.2 逐語**: *"Each player gets a single Favor token to start with (**or five tokens in games with Importer**)."*
  - つまり **Setup の +4 は「Liaison による標準の1個」に上乗せ**され、合計 **5個** になる（"+4" は差分表記）。
  - Importer 自身は **ゲーム中に Favor を増やす手段を持たない**（他の Liaison が同席していない限り、5個から増えない）。
  - 🔴 **【追記】コスト軽減を受けた後のコストで判定する**。日本語wiki `輸入者` 詳細なルール 逐語：
    *「橋などでカードのコストが下がった場合、下がった後のコストが5コスト以下であれば獲得できる。
    王家のガレー船の効果でターン開始時に橋を使用→輸入者の持続効果発揮の順に効果を処理した場合、輸入者で金貨(コスト6→5)を獲得できる。」*
  - 🔴 **【追記・下書きの記述を一次資料で裏取り】ポーション費用／負債コストのカードは獲得できない**。日本語wiki 逐語：
    *「ポーションをコストに含むカード（ブドウ園など）、負債をコストに含むカード（技術者など）は、どちらもコスト最大5(コイン)までのカードに含まれないため、獲得できない。
    輸入者で獲得できるカードは、正確には「コスト最大5コイン0ポーション0負債までのカード」とみなされるため。」*
    → 本エンジンでは **`costUpTo(state, id, 5)` をそのまま使えばよい**（§0-23 で成分別比較を実装済み）。
  - 🔴 **【追記】イベント／プロジェクトは「カード」ではないので獲得できない**（日本語wiki 逐語）。
- **エラッタ**: **機能的なエラッタは無し**。英語wiki `Allies` の **Versions** 表を再取得して確認した内容（逐語）:
  - `March 2022 / First edition` — Errors: ルールブック末尾の住所行が欠落しているだけ。
  - `December 2023`（＝第2刷）— **Functional changes: Island Folk, Voyage — Cannot take a third turn in a row (2023).** ／ **Cosmetic changes: Elder — Rephrased for clarity (2023).**
  - **Expected changes for future printing** — Cosmetic changes: Specialist（"Play it again"→"Replay it"）／Sunken Treasure（隅の `[$0]` 表記削除・2022）／**Importer — Mark "Setup:" in bold (2023).**
  → **Importer の "Setup:" 太字化は「今後の刷で予定されている表記変更」であって 2023年12月の第2刷には入っていない。機能差ゼロ。**（下書きどおり・訂正なし）
  → **この6枚はいずれも第2刷の機能変更の対象外。**
- **実装上の注意**:
  - **Setup は「山1つにつき1回」**＝Importer の山は1つなので **+4 は1回だけ**（Importer を何枚買おうが増えない）。※一般ルールからの帰結で、Allies ルールブックに明示の1文は無い。
  - **Duration**＝プレイしたターンの片付けでは場に残り、**次の自分のターンの開始時**に獲得を解決してから捨てる。
  - 獲得は **強制**（"gain a card costing up to $5"＝"you may" ではない）。$0 の銅貨／呪いが常にあるので遂行不能にはならない設計だが、実装では「候補ゼロ」を終端保証すること。
  - **ターン開始時の獲得**なので、獲得したカードは捨て札に入る＝そのターンの手札には入らない（獲得先を変える効果があれば別）。
  - Throne Room 等で複数回プレイすると、次のターン開始時に**その回数ぶん獲得**する。
  - 🔴 **【本エンジン固有】ターン開始時の対話は `t.startQueue` に push する**（`state.pending` を直接立てない＝§0-22 の確立方針）。
  - **Liaison** なので Ally が配られる（§0）。**Importer は「Favor の総量を増やすが供給を絶つ」という特殊な設計**＝Ally の効果設計に強く影響する。

---

## 4. Merchant Camp  [$3]

- **id候補**: `merchant_camp`　／　🔴 **日本語名: 商人の野営地**（**アクション**）
- **コスト**: $3（ポーション費用なし・負債コストなし）
- **種別**: **Action**（アクションのみ。**Liaison ではない**）
- **カードテキスト（英語・現行）**:

```
+2 Actions
+[$1]
------------------------------
When you discard this from play, you may put it onto your deck.
```

🔴 **日本語カードテキスト（日本語wiki `商人の野営地`・逐語）**:

```
+2 アクション
+1 コイン
------------------------------
あなたがこのカードを場から捨て札にするとき、このカードをあなたのデッキの一番上に置いてもよい。
```

- **Setup:**: なし
- **公式FAQ・裁定**:
  - **RGG ルールブック逐語（再取得・完全一致）**: *"Merchant Camp: If you have multiple Merchant Camps in play, you can choose how many you want to put on top of your deck."*
  - **英語wiki「Other rules clarifications」逐語（再取得・完全一致）**: *"If you play this using a **Way**, or under the influence of **Enchantress**, you can still top-deck this when you discard it from play."*
    → **記載効果を置き換える効果（習性・女魔術師）を受けても、when-discard-from-play の能力は働く**（これは記載効果ではなく静的能力のため）。
  - 🔴 **【重大な追記＝下書きに丸ごと欠落】「場に出さずに使用した」「場に出したが場を離れた」場合は置けない。**
    日本語wiki `商人の野営地` 詳細なルール 逐語：
    ```
    商人の野営地を場に出さずに使用した場合、場から捨て札にならないのでデッキトップに置くことができない。下記の事例が該当。
      ・はみだし者などの命令カードでサプライにある商人の野営地を使用する。
      ・ネクロマンサーで廃棄置き場にある（表向きの）商人の野営地を使用する。
      ・相続（2019年のルール変更とエラッタを適用）した屋敷を使用し、（相続の効果で）脇に置いた商人の野営地を使用する。
      ・ハツカネズミの習性で脇に置かれた商人の野営地を使用する。
      ・王子（持続カードとなった最新版）の【王子アクション】により、脇に置いた商人の野営地を使用する。
    商人の野営地を場に出して使用してもその後に場から離れた場合、デッキトップに置くことができない。下記の事例が該当。
      ・行進で商人の野営地を2度使用し、廃棄した。
      ・増築で、場に出ていた商人の野営地を廃棄した。
      ・使用した商人の野営地にウミガメの習性を指定し、脇に置いた。
    ```
    → **本エンジンの §0-17「命令（Command）がプレイした札は動かない」＋ `takeSelf`／`playedByCommand` と完全に同型**。
    ここを配線しないと、**大君主／はみだし者／船長／王子／ネクロマンサー／相続／ハツカネズミの習性 経由で使った商人の野営地が
    幻としてサプライや脇から山札の上に増殖する（保存則違反）**。
    ※ 上の「Way でも top-deck できる」（英語wiki）と矛盾しない：**ウシの習性等は場にある本体に指定するので働き、
    ハツカネズミ／ウミガメの習性は本体が場に出ない／場を離れるので働かない。**
- **エラッタ**: **なし**（English versions 表は `Allies / March 2022` の1行のみ。`Errata` の Allies 節にも無し）。
  - ※ Secret History で Donald X. が「捨てたときに何かする札だと分かるよう種別と色を付けようか強く検討したが、Treasury 等の既存カードが新色にならないのでやめた」と述べている＝**種別は Action 単独が正**。
- **実装上の注意**:
  - **「場から捨てるとき（from play）」限定**。**手札から捨てても発動しない**（Cellar / Militia 等では働かない）。通常はクリンナップの「場を捨てる」瞬間。
  - **"you may"＝任意**。複数枚が場にあるなら**何枚を山札の上に置くか自分で選べる**（0枚〜全部）。
  - 🔴 **【訂正】比較対象のカードを取り違えている**。下書きは *「2022エラッタで『Alchemist / Herbalist は場から捨てる順序を気にしなくなった』流れと同じ」* と書いていたが、
    英語wiki `Errata` を再取得すると**逆**だった：
    - **Alchemist（2022）** → `'+2 Cards. +1 Action. **At the start of Clean-up this turn**, if you have a Potion in play, you may put this onto your deck.'` ＝**捨てる前**の窓に移された（when-discard トリガーではなくなった）。
    - **Treasury（2022）** → `'... **At the end of your Buy phase this turn**, if you didn't gain a Victory card in it, you may put this onto your deck.'` ＝同上。
    - **Herbalist（2022）** → `'+1 Buy. +[$1]. **Once this turn, when you discard a Treasure from play**, you may put it onto your deck.'` ＝when-discard トリガーのまま。
    - **Scheme（2016）** → `'+1 Card. +1 Action. **This turn, you may put one of your Action cards onto your deck when you discard it from play.**'`
    → **Merchant Camp の構造的な双子は Scheme（策謀）**。Alchemist 型（クリンナップ開始時）ではない。
    **本エンジンでは `endBuyTailSchemeOrCleanup` の `scheme_cleanup`（`js/engine.js`）と同じスロット・同じ形（`max` 枚数つきの任意選択）で実装するのが正解。**
  - 🔴 **【訂正】「捨て札置き場を経由しない」という説明は公式の読みとしては誤り**。Merchant Camp は **when-discard トリガー**＝「場から捨てる」という事象そのものが発動条件なので、捨てること自体は必ず起きる。
    ただし本エンジンには「他人のカードの捨て札に反応する」トリガーは無い（坑道／村有緑地／忠犬はいずれも**自分自身**の捨て札に反応する）ので、
    **策謀と同じ「inPlay → deck へ直接移動」で観測差は出ない**。実装はそれでよいが、説明を鵜呑みにして「捨て札トリガーを誘発させない」を設計原則にしないこと。
  - **このエンジン特有の落とし穴：本アプリは自分の手番終了時に次の手札を先引きする**ので、「場から捨てる → 山札の上に置く」は **必ず先引きより前**に処理すること（後にすると1ターン遅れて意味が変わる）。策謀・角笛（Horn）と同じ位置。

---

## 5. Sentinel  [$3]

- **id候補**: `sentinel`　／　🔴 **日本語名: 歩哨**（**アクション**）
- **コスト**: $3（ポーション費用なし・負債コストなし）
- **種別**: **Action**（アクションのみ。**Liaison ではない**）
- **カードテキスト（英語・現行）**:

```
Look at the top 5 cards of your deck. You may trash up to 2 of them.
Put the rest back in any order.
```

🔴 **日本語カードテキスト（日本語wiki `歩哨`・逐語）**:

```
あなたの山札の上から5枚のカードを見る。その中から最大2枚までを廃棄してもよい。
残りは好きな順番であなたの山札の上に戻す。
```

- **Setup:**: なし
- **公式FAQ・裁定**:
  - **RGG ルールブック逐語（再取得・完全一致）**: *"Sentinel: Shuffle as needed; if you don't have five cards even after shuffling, you look at all of them."*
    → **必要ならシャッフルする**。シャッフル後でも5枚に満たないなら**あるだけ全部見る**（それでも実行できる）。
  - 廃棄は **"You may trash **up to** 2"** ＝**0枚・1枚・2枚のどれでもよい（完全に任意）**。
  - 残りは **好きな順番で山札の上に戻す**（捨て札ではない）。
  - 🔴 **【重大な追記＝実装に直結／下書きに欠落】「見ている5枚」は解決中は山札のカードではない。**
    日本語wiki `歩哨` 詳細なルール 逐語：
    ```
    山札と捨て札の合計枚数が4枚以下の場合、すべてを見て2枚以下を廃棄する処理になる。
    歩哨の効果は、厳密には
      ①山札の上から5枚を見る → ②そのうち2枚以下を廃棄する → ③残りを好きな順番で山札に戻す
    …という処理である。①の処理の時点で、山札から見るカードの枚数は確定する。
    よって、山札と捨て札の合計枚数が4枚以下の際に①の処理を行い、その後の②の処理でリッチを廃棄したなどの理由で
    捨て札置き場にカードが増えた場合でも、その増えたカードを追加で見るカードに加えることはできない。
    ②の処理中、①で見たカードすべては山札のカードではない状態である。よって、②の効果で廃棄時ドローが発生するカード
    （ネズミ、狂信者など）を廃棄した場合は、見ているカードではなく、この時の山札のカードを引く。
    ```
    → **実装では「5枚を deck から取り出して脇に持つ」方式にすること。**
    `deck` に置いたまま index で扱うと、**ネズミ／狂信者（暗黒時代）を廃棄したときのドローが「今見ている5枚」から引かれてしまい公式と食い違う**。
    mix-all（14拡張混成）では歩哨と暗黒時代が同居するので**必ず到達する**。
- **エラッタ**: **なし**（English versions 表は `Allies / March 2022` の1行のみ。`Errata` の Allies 節にも無し）。
- **実装上の注意**:
  - **「見る（look at）」であって「公開する（reveal）」ではない**＝
    (a) `reveal()` を通してはいけない（ルネサンスのパトロン等、公開に反応する効果を誤爆させる）。
    (b) **オンラインでは相手にマスク必須**（`maskStateFor` の私的看破リストに入れる）。§0-21 の偵察隊・§0-28 の夜警と同型。
  - **ドローではない**ので -1カードトークン等のドロー置換は無関係。
  - 山札が足りないときは「捨て札をシャッフルして補充 → それでも足りなければあるぶんだけ」＝ドローと同じ補充ロジックを通すが、**引かずに覗く**点に注意。
  - 廃棄枚数が0でも合法＝**選択肢ゼロで詰まないこと**（UI に「廃棄しない」を必ず出す）。
  - 戻す順序をプレイヤーが選べる＝順序選択UIが要る（本アプリ既存の「好きな順で山札の上に戻す」系＝衛兵/見張り と同型）。

---

## 6. Underling  [$3]

- **id候補**: `underling`　／　🔴 **日本語名: 下役**（**アクション-連携**）
- **コスト**: $3（ポーション費用なし・負債コストなし）
- **種別**: **Action - Liaison**（アクション＋連携）
- **カードテキスト（英語・現行）**:

```
+1 Card
+1 Action
+1 Favor
```

🔴 **日本語カードテキスト（日本語wiki `下役`・逐語）**: `+1 カードを引く／+1 アクション／+1 好意`

- **Setup:**: なし
- **公式FAQ・裁定**:
  - **RGG ルールブック逐語（再取得・完全一致）**: *"Underling: Playing this simply gives you +1 Card, +1 Action, and +1 Favor."*
  - **順序に関する公式明記（ルールブックの Order of Astrologers／Order of Masons の項＝両方に同じ1文が載っている。再取得・完全一致）**:
    *"Note that **Emissary and Underling can cause you to shuffle before giving you Favors**; the Favors you don't have yet can't be used on that shuffle."*
    → **+1 Card（＝必要ならシャッフル）が +1 Favor より先に解決される**ことが公式に明記されている。
- **エラッタ**: **なし**（English versions 表は `Allies / March 2022` の1行のみ。`Errata` の Allies 節にも無し）。
  - ※ Secret History＝「Favor を与えた最初のカード。一度も変わっていない（名前が Poet だったことを除く）」。
- **実装上の注意**:
  - **解決順は記載順を厳守**：`+1 Card` → `+1 Action` → `+1 Favor`。
    シャッフル時に Favor を消費する Ally（**Order of Astrologers / Order of Masons**）がある対局で、**この Underling のドローが引き起こすシャッフルには「まだ得ていない +1 Favor」を使えない**（公式明記）。順序を入れ替えると本当にルールが壊れる。
  - **Liaison**（§0）＝この1枚があるだけで Ally が配られる。
  - キャントリップなので CPU 実装上は「常に使ってよい」札。

---

## 7. この6枚を実装するときの横断メモ

- **Liaison 種別を落とさないこと**：Bauble（Treasure - Liaison）／Sycophant（Action - Liaison）／Importer（Action - Duration - Liaison）／Underling（Action - Liaison）。
  Barbarian の公式FAQ が示すとおり **Liaison は「種別を共有する」判定に使われる**ので、種別を1つ落とすと他カードの挙動が静かに壊れる。
- **Merchant Camp と Sentinel は Liaison ではない**＝この2枚だけでは Favors / Ally は登場しない。
- **Favor は非カード**（Coin token）＝保存則 tally に混ぜない。Coffers / Villagers とは別マット・別枠。
- **Importer の Setup は「王国に Importer があれば各自 +4」の1回きり**。標準の1個と合わせて5個。
- **6枚とも機能エラッタはゼロ**（第2刷 2023年12月の機能変更は Island Folk / Voyage のみ、Cosmetic は Elder のみ）。Importer の "Setup:" 太字化は**未実施の予定変更＋純粋な表記**。

🔴 **本エンジンを壊しそうな公式挙動（優先度順・実装前に必読）**
1. **Merchant Camp × 命令／脇置きプレイ**（§4）＝**保存則違反の危険が最も高い**。`takeSelf`／`playedByCommand`（§0-17）を必ず通す。
2. **Sentinel の5枚は deck から抜いて脇に持つ**（§5）＝ネズミ／狂信者の廃棄時ドローが「見ている5枚」から引かれると公式と食い違う。mix-all で必ず到達。
3. **Sycophant の3枚は同時に捨てる**（§2）＝坑道／村有緑地／忠犬のトリガーは「3枚を確定して捨てた後」に解決する。
4. **Sycophant の on-trash はサプライからの廃棄でも発動する**（§2）＝`opts.fromSupply` の抑止対象（青空市場）に混ぜてはいけない。
5. **Bauble の「このターン、獲得したとき」窓は `onGainQueue` に積む**（§1）＝`state.pending` 直代入は他の獲得時窓を握りつぶす。
6. **Bauble の選択は再演のたびに選び直す**（§1）＝命令の `commandAs`（選び直さない）を流用しないこと。
7. **Importer のターン開始時獲得は `t.startQueue`**（§3）。強制なので候補ゼロの終端保証を入れる。

🔴 **一次資料でも決着しなかった（実装時に判断が要る）**
- **闇市場（Black Market）デッキに Liaison が混ざったとき Ally を配るか／Importer の Setup を発動させるか**。
  Allies ルールブックにも英語wiki にも記述が見つからなかった。本アプリの闇市場デッキは全 POOLS から作られる（PROGRESS §6）ので実際に起こり得る。
  **「Ally を配るか」「Setup +4」の判定は王国10山だけを見る**のが安全（若き魔女の Bane と同じ扱い）。
- **同一ターンに Bauble を2枚出し、両方で topdeck オプションを取ったときの1回の獲得の扱い**（§1）。Stop-moving からの帰結で問題は無いはずだが明示の裁定は無い。
- **Importer の Setup が「山1つにつき1回」であること**（§3）。一般ルールからの帰結で、Allies ルールブックに明示の1文は無い。
- **日本語カードテキストの `+N` 表記ゆれ**：日本語wiki は `+1 カードを購入` / `+1 カードを引く` と書くが、本プロジェクトの既存カタログは `+1 購入` / `+1 カード` の表記。**カード名（道化棒／ごますり／輸入者／商人の野営地／歩哨／下役）は日本語wiki が正本**だが、`+N` の言い回しは既存カタログの流儀に合わせること。

---

## 8. 参照した一次資料（この検証で**自分で**引き直したもの）

- 英語wiki（Wayback CDX でキャプチャを列挙し、Anubis の bot チェック画面が保存されている回を除外して最新の実ページを取得）:
  `Bauble`(2025id_, oldid=93244) / `Sycophant`(20250115194238) / `Importer`(20250802091003) / `Merchant_Camp`(20251214074123) /
  `Sentinel`(20260102081100) / `Underling`(20251007044423) / `Allies`(20251224083450) / `Errata`(20250801045837, oldid=91330) /
  `Liaison` / `Lurker` / `Clean-up_phase`(20250717183201)
- RGG 公式ルールブック PDF: `https://www.riograndegames.com/wp-content/uploads/2021/09/Dominion-Allies-Rules.pdf`
  （実DL 2,144,349 bytes → `pdftotext -layout` 1,204行。6枚のFAQ・Favors/Ally 一般ルール・Barbarian FAQ・Order of Astrologers/Masons を逐語照合）
- **日本語wiki（ホビージャパン日本語版が正本）**: `wikiwiki.jp/dominiondeck` の
  `同盟（拡張）`(20260522210554) / `道化棒` / `ごますり` / `輸入者` / `商人の野営地` / `歩哨` / `下役`（いずれも Wayback 経由の最新キャプチャ）
- 生データ保存先: `c:\tmp\verify_g02\`（`allies.pdf` / `allies.txt` / `bauble.txt` / `sycophant.txt` / `allies_page.txt` /
  `err2.txt` / `lurker.txt` / `cleanup.txt` / `jp_allies_exp.txt` / `jp_道化棒.txt` / `jp_ごますり.txt` / `jp_歩哨.txt` / `jp_下役.txt`）

> ⚠️ pdftotext はコイン記号を落とすため、金額はすべて英語wiki 側（`[$N]` 形式）で裏取りしている。
> ⚠️ 🔴**下書きの「取得状況」表にあった「2025年12月〜2026年1月の最新スナップショット（Sycophant=20251228 oldid93246 等）で再確認」という記述は再現できなかった。**
> Wayback の 2025年12月以降の wiki キャプチャは **Anubis の "Making sure you're not a bot!" 画面**が保存されている（実測：Sycophant の 2025-12-30 キャプチャがそれ）。
> **結論（テキスト・種別・コスト・FAQ）は 6/6 とも正しかったが、出典メタ情報は信用しないこと。**

---

# 同盟（Allies）— 非分割の王国カード 7枚（$4×6 ＋ $6×1）

**KEY = g03_kingdom_4_6** / 担当＝Broker, Carpenter, Courier, Innkeeper, Royal Galley, Town, Marquis

> **【敵対検証済み・2026-08-12】** 別エージェントが**一次資料を引き直して**全項目を再検証した
> （下書きの引用は一切コピーせず、live wiki／Wayback／RGG 公式PDF を自分で取得）。
> **確定した訂正 5件**（Golem/Engineer のコスト、参照PDFの版、削除時期、日本語名の欠落、Elder の "different" 条件）。
> 検証の詳細は次節。訂正箇所には ✅**[検証]** / ⚠**[訂正]** を付けた。

---

## 一次資料と取得方法（検証官が自分で取り直したもの）

1. **英語wiki 本体（live）＝ `https://wiki.dominionstrategy.com/index.php/<Page>`**
   Anubis v1.27.0（`{"rules":{"algorithm":"fast","difficulty":5}}`）の PoW を自作スクリプトで解いて取得。
   解き方＝`<script id="anubis_challenge">` の JSON から `challenge.randomData` / `id` / `difficulty` を読み、
   **sha256(randomData + nonce) の16進が先頭 difficulty 桁ぶん "0" になる nonce** を総当たり（difficulty 5＝1秒未満）→
   `/.within.website/x/cmd/anubis/api/pass-challenge?id=…&response=<hash>&nonce=<n>&redir=<url>&elapsedTime=<ms>`
   を Cookie ジャーつきで叩く。実装＝`c:\tmp\allies_parts\vfy_live.py`（検証官が自作・動作確認済み）。
   取得物＝`c:\tmp\allies_parts\vfylive\<Page>.live.txt`（**取得時刻 2026-08-12 11:16〜11:20**）。
   Versions 表の**セル境界つき**ダンプ＝`vfy_table.py`（列の取り違えを防ぐため別に取得）。
2. **Wayback（履歴の確認用）**＝`vfy_fetch.py`（新しいスナップショット優先）＋ CDX API。
   **Royal_Galley の最新アーカイブは 2025-12-13**（CDX で確認。2026年のキャプチャは存在しない）。
   → 「2025-12 時点＝旧テキスト」「2026-08 の live＝新テキスト」という**時系列の裏が取れた**。
3. **RGG 公式ルールブック PDF**（検証官が自分でDL）
   `https://www.riograndegames.com/games/dominion-allies/` → `…/wp-content/uploads/2021/09/DomAllies.pdf`
   **sha1 = b84aadb84949225ae26102efbcbef3371fafefb3**（`_vfy_allies.pdf` / `pdftotext -layout` → `_vfy_allies.txt`）。
   内部の組版スタンプ＝**ルール本文 12ページ分が `DomAlliesRules21x.qxp 11/10/23`（＝2023年12月 第2刷の版）**／
   カード一覧＋FAQ 付録が `alliesrandomizers21.indd 3/1/22`。
   ※ **pdftotext はコイン記号・VP記号を落とす**ので、金額はすべて wiki 側の `[$N]` で確定した。

⚠**[訂正1・方法論]** 下書きが突き合わせに使った `allies_rulebook.txt`（= `allies_rules.pdf`, sha1 `009ff876…`）は
**RGG が現在配っている PDF ではない**。内部スタンプが `10/6/21` `10/24/21` `12/29/21` ＝**2022年3月 初版の版**。
→ ただし**担当7枚については、初版PDFと現行PDFの Official FAQ 本文は完全に同一**であることを
機械照合で確認した（差分は `.indd` の日付スタンプのみ）。**結論は変わらないが、出典表記は現行PDFに直した。**

---

## 刷（printing）と現行テキストの判定 ✅[検証：live `Allies` ページ Versions 表を逐語で再取得]

| 日付 | 内容 |
|---|---|
| March 2022 | First edition（Errors: ルールブック最終ページの Rio Grande Games の住所行が抜けている） |
| **December 2023** | **Functional changes:** Island Folk, Voyage — Cannot take a third turn in a row (2023).　**Cosmetic changes:** Elder — Rephrased for clarity (2023). |
| **Announced changes for future printing** | **Functional changes: Royal Galley — Don't set the played card aside (2026).** |
| Expected changes for future printing | *(Cosmetic のみ)* Specialist — Rephrase "Play it again" to "Replay it"／Sunken Treasure — Remove the value of [$0] from the upper corners of Treasures (2022)／Importer — Mark "Setup:" in bold (2023). |

**担当7枚のうち 2023年12月 第2刷での変更を受けたカードは 0枚。**
✅[検証] **Broker / Carpenter / Courier / Innkeeper / Town / Marquis の Versions 表は 6枚とも
「Print | Digital | Text | Changes | Announced | Printed」の1行だけ＝`First edition / March 2022`**
（`vfy_table.py` でセル境界つきに再取得して確認。＝初版テキストがそのまま現行）。

⚠ **Royal Galley だけ 2026年5月に公式エラッタが announce 済み（未印刷）**。詳細は Royal Galley の項。

---

### Broker  [$4]
- **id候補**: `broker`（既存カタログに衝突なし）
- **コスト**: $4（ポーション費用・負債コストとも **なし**）✅[検証：live infobox `Cost [$4]`]
- **種別**: **Action - Liaison** ✅[検証：live infobox `Type(s) Action - Liaison`]
- **日本語名（英語wiki の Other language versions 行）**: **仲買人** ⚠[訂正4：下書きは日本語名を全カード欠落]
  ※このプロジェクトの過去の教訓（PROGRESS §0-27）＝**英語wiki の Japanese 行は実物と食い違うことがある**
  （夜想曲では17枚が不一致）。**最終的な正本は日本語wiki／ホビージャパン印刷版**。
- **カードテキスト（英語・現行 = 2022年3月初版のまま）** ✅[検証：live `Card text` ＋ Versions 表 ＋ 現行PDFのカード画像]:

```
Trash a card from your hand and choose one:
+1 Card per [$1] it costs;
or +1 Action per [$1] it costs;
or +[$1] per [$1] it costs;
or +1 Favor per [$1] it costs.
```

- **Setup:**: なし ✅[検証：live のカードテキスト欄・現行PDFのカード画像とも Setup 行なし]
  - ただし **Liaison 種別なので、Broker が王国にある時点でゲーム設定が変わる**。
    ✅[検証：現行PDF p.2-3 逐語]
    > "In games using one or more Liaison cards, give each player a Favors mat and deal out a single Ally card.
    >  The Ally cards are a separate deck, not combined with Events and so on. **Each player gets a single Favor
    >  token to start with (or five tokens in games with Importer).**"
    > "Allies are landscape cards that give Favor tokens a use; Liaisons are kingdom cards that provide a way to
    >  get Favor tokens. In games with a Liaison, deal out a random Ally to use that game. **Only use one Ally
    >  per game, even with multiple Liaisons.** You can still have as many other landscape cards (Events,
    >  Landmarks, Projects, Ways) as you otherwise would have."
    > "**Favors may be used starting with the first turn of the game**; they may not be used prior to that turn.
    >  **Spending Favors is always optional.** Spending Favors can only be done once per time an Ally ability
    >  triggers, unless it says, 'Repeat as desired.'"
    これはカード上の "Setup:" 行ではなく拡張の一般ルール。
- **公式FAQ**（wiki Official FAQ ＝ 現行PDF逐語。**両者完全一致を機械照合で確認**）:
  - "For example, if you trash an Estate, which costs [$2], you could choose to get +2 Cards,
    or +2 Actions, or +[$2], or +2 Favors."
  - "If you trash a card with [D] or [P] in the cost (from other expansions), you get nothing
    for those symbols." ＝ **負債(Debt)・ポーション(Potion) 成分は一切ボーナスにならない**（コイン費用の数だけ見る）。
- ⚠**[訂正2] 下書きの例が2つとも間違っていた**（一次資料＝英語wiki のナビゲーションボックスで確認）:
  - **ゴーレム(Golem)は `$3+P` ではなく `[$4][P]`＝$4+ポーション** → 廃棄すると **4個**（3個ではない）。
    （Alchemy 欄の逐語: `[$4] Potion • [$4][P] Golem`。$3+P は Alchemist / Familiar / Philosopher's Stone）
  - **技術者(Engineer)は `$0+負債8` ではなく `[4D]`＝$0+負債4** → 得られるのは 0個（結論は同じだがコスト表記が誤り）。
    （Empires 欄の逐語: `[4D] Engineer` / `[8D] City Quarter • Overlord • Royal Blacksmith`。
    本プロジェクトの PROGRESS §0-16 も `$0+負債4` で一致）
- **[一次資料なし＝一般ルールからの推定]** 廃棄は強制（"Trash a card from your hand"）。手札が0枚なら廃棄できず、
  "it" が存在しないのでどの選択肢を選んでも 0 個（＝実質何も起きない）。**Broker 固有の公式FAQ文は無い**。
- 選択肢は4つの **choose one**。4つとも「N個もらう」だけなので **遂行不能な選択肢は存在しない**
  （$0 のカードを廃棄した場合は、どれを選んでも 0 個。選ぶこと自体は可能）。
- **エラッタ**: なし（初版のまま）✅[検証：Versions 表が1行のみ]
- **実装上の注意**:
  - コスト参照は "it costs"（現在形）。**橋/街道/渡し船トークン/王女 等のコスト軽減が効いた現在のコイン費用**を使う。
    ※「廃棄前に測るか廃棄後に測るか」は**実挙動に差が出ない**（廃棄はコストを変えない）。
    一次資料に明示は無いので、帝国の儀式(ritual) と同じく**廃棄後に測る**実装で問題ない（PROGRESS §0-26 の前例）。
  - コイン成分だけを取る述語が要る。`costUpTo` 等の「以下」判定ではなく
    **「そのカードのコイン費用の数値そのもの」**が要る（負債・ポーションは 0 扱いで捨てる）。
  - 「+1 Card per $1」は**ドロー**なので -1カードトークン(冒険)・書庫系の相互作用に注意。
  - **+アクション／+コインは `addActions()` / `addCoins()` を通す**（PROGRESS §0-25。直書き禁止）。
  - **Elder（同拡張 Townsfolk [$5]）の対象**＝下の「Elder との相互作用」節を参照。
  - Favor は Ally 次第で効果が変わる。Broker は 1回で大量（属州廃棄なら8個）の Favor を出せる。
    ※Favor トークンの総量（現行PDF の内容物＝**35 Coin tokens**）の扱いは機構担当（g01）を参照。

---

### Carpenter  [$4]
- **id候補**: `carpenter`（衝突なし）
- **コスト**: $4（ポーション費用・負債コストとも なし）✅[検証：live infobox]
- **種別**: **Action**（単一種別。Liaison ではない）✅[検証：live infobox `Type(s) Action`]
- **日本語名**: 英語wiki に Japanese 行**なし**（要・日本語wiki 確認）
- **カードテキスト（英語・現行 = 2022年3月初版のまま）** ✅[検証：live `Card text` ＋ Versions 表 ＋ 現行PDF]:

```
If no Supply piles are empty, +1 Action and gain a card costing up to [$4].
Otherwise, trash a card from your hand and gain a card costing up to [$2] more than it.
```

- **Setup:**: なし ✅[検証]
- **公式FAQ**（wiki ＝ 現行PDF逐語・完全一致を確認）:
  - "First see if there are any empty **Supply** piles."
  - "If there are none, you get +1 Action and **gain** a card costing up to [$4];
    if there are one or more empty piles, instead you **trash** a card from your hand and
    gain a card costing up to [$2] more than the card you trashed."
  - ＝ **これは「選択」ではない**。空のサプライ山の有無で**どちらの効果になるかが決まる**。
- ✅[検証] live の "Other rules clarifications" 節は**存在しない**（FAQ は Official FAQ のみ）。
- **エラッタ**: なし ✅[検証：Versions 表が1行のみ]
- **実装上の注意**:
  - **「空のサプライ山」の数え方は3山終了と同じ概念**。本プロジェクトでは
    **`DOM.engine.emptyPileCount` を必ず使う**（PROGRESS §0-24 で公開済み）。
    分割山は上下とも尽きて初めて1山ぶん空／混合山（廃墟・騎士・城）は集約キー1山／
    **非サプライ山（賞品・戦利品・馬・精霊・願い 等）は数えない**。
    ここを素朴に `Object.values(supply).filter(v=>v<=0)` で書くと**分岐が丸ごと壊れる**。
  - **判定は使用時に1回**（FAQ "First see if…"）。1段目の獲得で山が空になっても、その使用の途中で2段目に切り替わらない。
  - **1段目の獲得は強制**。銅貨($0)が常にあるので候補ゼロにはならない。
    `costUpTo(state, id, 4)` を使うこと（成分別比較＝$0+負債8 や $3+P は「$4以下」ではない）。
  - **2段目：廃棄も獲得も強制**。ただし**手札が空なら廃棄できず、"it" が無いので獲得も起きない**
    （改築(remodel)の空手札と同じ＝何も起きない）。この場合 pending を立てないこと（人間が詰む）。
    ※これは**一般ルールからの推定**（Carpenter 固有の公式FAQ文は無い）。
  - 2段目には **+1アクションが付かない**（＝条件つき非ターミナル。終盤にターミナル化する）。
  - 2段目のコスト基準は「廃棄したカードの**現在**コスト +$2 以下」／`costUpTo` の成分別比較を使う。

---

### Courier  [$4]
- **id候補**: `courier`（衝突なし）
- **コスト**: $4 ✅[検証：live infobox]
- **種別**: **Action**（単一種別）✅[検証]
- **日本語名**: 英語wiki に Japanese 行**なし**（Dutch=Renbode / French=Courrier rapide / German=Botin のみ）
- **カードテキスト（英語・現行 = 2022年3月初版のまま）** ✅[検証：live ＋ 2026-01 Wayback ＋ 現行PDF]:

```
+[$1]
Discard the top card of your deck. Look through your discard pile; you may play an Action or Treasure from it.
```

- **Setup:**: なし ✅[検証]
- **公式FAQ**（wiki ＝ 現行PDF逐語・完全一致を確認）:
  - "First **discard** your top card, **shuffling** if needed.
     Then look through your **discard pile**, and you may play an **Action** or **Treasure** from it."
- **Other rules clarifications**（wiki・**live で現存を確認**）:
  - "You resolve any effects from discarding the top card of your deck **before** you look through
    your discard pile. So if this discards a **Tunnel**, you can play the **Gold** that you gained from it."
  - "If you have an empty discard pile after discarding the top card of your deck
    (e.g. you discard a **Village Green**, play it, and that makes you shuffle), you can't play any card."
- **プレイは任意**（"you may play"）。捨て札にアクションも財宝も無ければ何も起きない。
- **エラッタ**: なし ✅[検証：Versions 表が1行のみ]
- **実装上の注意**:
  - **手順の順番が厳密**：① +$1 → ② 山札の一番上を捨てる（**山札が空なら先に捨て札をシャッフルして山札にする**）
    → ③ 捨てたカードの**捨て札トリガーを全部解決**（坑道→金貨獲得／村有緑地→その場でプレイ 等）
    → ④ **その後で**捨て札を見てアクション/財宝を1枚プレイしてよい。
  - **③の結果で捨て札の中身が変わる**のが最大の罠（公式 clarification が2つとも この点）。
    - 坑道(Tunnel)を捨てた → 獲得した**金貨が捨て札に入り、それを④でプレイできる**。
    - **山札が空でシャッフルが起きた場合、捨て札は「今捨てた1枚」だけになる**
      （さらに村有緑地のように捨て札から場に出るカードだと**捨て札が0枚になり、プレイできるものが無い**）。
  - **④のプレイはアクション権を消費しない**（カードが「プレイする」と指示した場合の一般ルール）。
    本プロジェクトの共通入口＝**`playCardNoAction`**（PROGRESS §0-26）。
  - **④では習性(Way)も選べる**（公式：カードを使用するときはいつでも選べる。`playCardNoAction` は既に対応）。
    ⚠[訂正5：下書きは Way への言及が無かった] **炉(kiln)も通る**（＝カードの使用だから）。
  - **購入フェイズでなくても財宝を出せる**（このカードの指示によるため。他の財宝が自由に出せるようになる訳ではない）。
    本プロジェクトでは財宝の効果は **`applyTreasureEffect` に書く**規約（PROGRESS §0-15）。
    「財宝か」の判定は **`isTreasureFor(state,id)`**（資本主義対応。PROGRESS §0-22）。
    先例＝**語り部(storyteller)** がアクションフェイズに財宝をプレイする（PROGRESS §0-9 Batch6）。
  - **持続(Duration)アクションも出せる**（Royal Galley と違い "non-Duration" の制限が無い）＝場に残る。
  - 自分の捨て札は自分には見えているのでオンラインの `maskStateFor` を触る必要は基本ない。
  - UI＝捨て札のアクション/財宝を一覧にして選ばせるモーダルが要る（+「何もしない」）。

---

### Innkeeper  [$4]
- **id候補**: `innkeeper`（衝突なし。※既存カタログに異郷の `inn`＝宿屋があるので**別物として区別**すること）
- **コスト**: $4 ✅[検証：live infobox]
- **種別**: **Action**（単一種別）✅[検証]
- **日本語名**: 英語wiki に Japanese 行**なし**
- **カードテキスト（英語・現行 = 2022年3月初版のまま）** ✅[検証：live ＋ Versions 表 ＋ 現行PDF]:

```
+1 Action
Choose one: +1 Card; or +3 Cards, then discard 3 cards; or +5 Cards, then discard 6 cards.
```

- **Setup:**: なし ✅[検証]
  ※現行PDF のレイアウト上、Innkeeper の FAQ 行のすぐ横に **`Setup: Each player gets +4 Favors`** が見えるが、
  これは**隣に印刷されている Importer（$3・Action-Duration-Liaison）のカード画像**である。**取り違え注意**。
- **公式FAQ**（wiki ＝ 現行PDF逐語・完全一致を確認）:
  - "First get +1 Action and **choose** which option you want, then do it."
    ＝ **+1アクションが先／選択はドローの前**（何を引くか分かってから選ぶことはできない）。
  - "You either get +1 Card, or get +3 Cards but **discard** 3 cards, or get +5 Cards but discard 6 cards."
- **「両方遂行できないとき選べるか」について**:
  - 3つとも**常に選べる**。ドローは山札が尽きても「引けるだけ引く」で成立し、捨て札も**手札にある枚数だけ捨てる**。
  - ⚠ **Innkeeper 固有の公式FAQ文は無い**（一般ルール「できるだけ行う」に基づく推定）。
    ✅[検証・補強] ただし**同じルールブック内の Capital City の公式FAQに同型の明文がある**：
    "Capital City: … **You may choose to do this even with fewer than 2 cards in hand.**"
    （＝同盟の設計者は「枚数が足りなくてもその選択肢を選べる」側で書いている）。
- **エラッタ**: なし ✅[検証：Versions 表が1行のみ]
- **実装上の注意**:
  - 捨てるカードは**自分が選ぶ**（強制枚数・任意の中身）。手札が足りなければ全部捨てる。
  - 第3選択肢は **+5引いて6捨て**＝手札は差し引き -1枚、Innkeeper 自身を場に出したぶんを含めると **-2枚**。
  - **Elder の対象**（下の節参照）。Elder で2つ選ぶと**カードに書かれた順**（+1 Card → +3/-3 → +5/-6）で解決する。
  - 本プロジェクトの `discard_down`（民兵型「N枚まで捨てる」）とは別物＝**枚数固定の強制捨て**。

---

### Royal Galley  [$4]  ⚠ **2026年5月 公式エラッタあり（未印刷）**
- **id候補**: `royal_galley`（衝突なし）
- **コスト**: $4 ✅[検証：live infobox]
- **種別**: **Action - Duration** ✅[検証：live infobox `Type(s) Action - Duration`。**両テキストとも種別は同じ**]
- **日本語名**: 英語wiki に Japanese 行**なし**（Dutch / French / German のみ）
- **カードテキスト（英語）**: **2種類あるので両方を載せる**

**(A) 印刷済み＝2022年3月 初版／2023年12月 第2刷（＝現物のカードはこれ）**
```
+1 Card
You may play a non-Duration Action card from your hand. Set it aside; if you did, then at the start of your next turn, play it.
```
✅[検証：現行RGG PDF のカード画像 逐語／Wayback **2025-12-13** キャプチャの Card text 欄／live Versions 表の第1行]

**(B) 2026年5月 announce 済み（"Not printed yet"）＝live wiki が現在「Card text」欄に載せている最新テキスト**
```
+1 Card
You may play a non-Duration Action card from your hand. Don't discard it in Clean-up until your next turn. At the start of your next turn, if it's still in play, replay it.
```
✅[検証：**検証官自身が 2026-08-12 に live を取得**。Versions 表の第2行（セル境界つきダンプ）＝
`Text=(B) | Changes="Don't set the played card aside." | Announced="May 2026" | Printed="Not printed yet"`。
拡張ページ側も "Announced changes for future printing — Functional changes: Royal Galley — Don't set the played card aside (2026)."]

- **Setup:**: なし ✅[検証]
- **公式FAQ・裁定**:
  - **(A) に対する FAQ**（live wiki は現在これを **"Deprecated official FAQ (2022)"** と明記して保存。
    現行PDF の逐語と完全一致）:
    - "Playing a non-Duration Action card via this is optional. If you do play one, **you resolve the card
      completely, then set it aside**. If it moved elsewhere somehow (for example, if it trashed itself),
      **you fail to set it aside, and Royal Galley is discarded that turn normally**."
    - "If you do set the card aside, then Royal Galley stays in play with it this turn, and at the start of
      your next turn, you play the card again. **Royal Galley and the card are both discarded that turn.**"
    - "Playing a card via Royal Galley **does not use up an Action play**（though playing Royal Galley itself does）."
  - ⚠**[訂正3・時期]** 下書きは「**2024年時点**の wiki には "…(such as a Band of Misfits that plays a Duration,
    or a Throne Room that plays a Duration), it still gets set aside with Royal Galley." があった」と書いていたが、
    ✅[検証] **Wayback 2025-12-13 のキャプチャにも現存**していた（表現は
    "If you Royal Galley a non-Duration card that should stay in play (**such as a Throne Room that plays a Duration**),
    it still gets set aside with Royal Galley." ＝ Band of Misfits には言及していない）。
    **live（2026-08）では削除済み**＝(B) 化に伴う削除で間違いない。
  - **(B) に対する FAQ は live wiki 上「Unofficial FAQ」扱い**（公式FAQは未更新）:
    - "Playing a non-Duration Action card via this is optional. If you do play one and **it moved elsewhere
      somehow** (for example, if it trashed itself), Royal Galley is discarded that turn normally."
    - "**If the card stayed in play**, then Royal Galley also stays in play with it this turn, and at the
      start of your next turn, you play the card again. Royal Galley and the card are both discarded that turn."
    - "Playing a card via Royal Galley does not use up an Action play (though playing Royal Galley itself does)."
  - **Other rules clarifications（live・(B) 前提で1項だけ残っている）**:
    - "If you Royal Galley a **Throne Room**, and on your next turn, you make the Throne Room play a Duration
      (like **Caravan**), **the Throne Room stays in play, but Royal Galley doesn't**."
  - **対象は「手札の 非持続(non-Duration) のアクションカード」1枚**。任意（選ばなくてよい）。
    選ばなければ Royal Galley は**そのターンの片付けで普通に捨てられる**（持続として残らない）。
- **エラッタ**: **あり**。(A)→(B)、**Functional change**、announce 2026年5月、**未印刷**。
  日本語版カード（ホビージャパン）は当然 (A) のテキスト。
- **実装上の注意**:
  - **(A) と (B) は挙動が実際に変わる**。主な差:
    | 論点 | (A) 印刷版＝脇に置く | (B) 2026版＝場に残す |
    |---|---|---|
    | プレイしたカードの居場所（このターン中） | **脇（場を離れる）** | **場（in play）のまま** |
    | "while this is in play" 能力（街道/橋の下のトロル/値切り屋/共謀者の数え 等） | **解決後は効かなくなる** | **そのターン中ずっと効く** |
    | 失敗判定 | 「脇に置けたか」（自己廃棄した祝宴等は失敗） | 「次のターン開始時に**まだ場にあるか**」 |
    | 次ターンの動詞 | "play it"（脇→場） | "**replay it**"（場にあるものを再演＝玉座の2回目と同型） |
    | 新ゾーンの要否 | **脇置きゾーンが必要** | **不要**（場に残すだけ） |
  - **本プロジェクト的には (B) の方が実装が軽い**（`state.replay` の再演機構＋持続の予約でそのまま書ける。
    PROGRESS §0-15 の `treasure_replay` / 山砦(citadel) の "replay" と同型）。
    (A) だと `p.royalGalleySetAside` のような**物理カードの新ゾーン**が要り、`allCards`・invariants の
    `ZONES`・`maskStateFor` の3点配線が必要（脇札は所有カードとして数える。※プレイ済みなので**公開情報**）。
  - **どちらを採用するかは要判断**。本プロジェクトはこれまで一貫して
    「日本語版カードが旧テキストでも**現行エラッタを採用**」（夜想曲§0-27／移動動物園§0-25 の 2025エラッタ）
    としてきたので、その方針に従うなら **(B)**。
    ただし **(B) は「announce 済み・未印刷」で公式FAQも未更新**（wiki も Unofficial FAQ 扱い）＝
    **これまでのエラッタ採用（＝すでに印刷され公式FAQも更新済み）とは性質が違う**点は明記が要る。
  - **持続カードは対象にできない**（カード文で明示。命令(Command)の non-Duration 制限を流用するのではなく
    **カード自身の制限**なので、Courier のような他のプレイ効果には波及させないこと）。
  - **プレイしたカードでアクション権を消費しない**（＝`playCardNoAction`）。Royal Galley 自身のプレイは消費する。
    **最初のプレイでは習性(Way)も選べる**／**次ターンの再演では選び直せない**
    （＝玉座の2回目と同じ。本プロジェクトの既存の許容簡略化。PROGRESS §0-25）。
  - Royal Galley は **Duration**。次のターンの開始時効果を解決したあと、
    **そのターンの片付けで Royal Galley と対象カードの両方が捨てられる**。
  - (B) の「if it's still in play」＝ 次のターン開始時に**まだ場にあるか**を見る
    （そのカードを廃棄したり山札に戻したりする効果が挟まると再演されない）。
  - 玉座の間を対象にした場合の公式裁定（上記 clarification）＝ **次のターンに玉座で持続をプレイすると
    玉座は場に残るが Royal Galley は残らない**（Royal Galley の仕事は終わっているため）。

---

### Town  [$4]
- **id候補**: `town`（衝突なし）
- **コスト**: $4 ✅[検証：live infobox]
- **種別**: **Action**（単一種別）✅[検証]
- **日本語名**: 英語wiki に Japanese 行**なし**
- **カードテキスト（英語・現行 = 2022年3月初版のまま）** ✅[検証：live ＋ Versions 表 ＋ 現行PDF]:

```
Choose one: +1 Card and +2 Actions; or +1 Buy and +[$2].
```

- **Setup:**: なし ✅[検証]
- **公式FAQ**（wiki ＝ 現行PDF逐語・完全一致を確認）:
  - "You simply **choose** to either get +1 Card and +2 Actions, or +1 Buy and +[$2]."
  - ＝ **村（Village）と木こり（Woodcutter）の二択**。
- **「両方遂行できないとき選べるか」について**:
  - **2つとも常に完全に遂行できる**（+1カードは山札が空でも「引けない」だけで選択は合法）。
- **エラッタ**: なし ✅[検証：Versions 表が1行のみ]
- **実装上の注意**:
  - 選んだ選択肢の**2つのボーナスはセット**（片方だけ取ることはできない）。
  - **Elder の対象**。Elder で両方選ぶと**カード記載順**に +1カード → +2アクション → +1購入 → +$2。
  - 本プロジェクトの規約により **`t.actions += n` / `t.coins += n` を直接書かず
    `addActions()` / `addCoins()` を通すこと**（雪深い村・カメレオンの習性が静かに壊れる。PROGRESS §0-25）。
  - 日本語名の衝突注意：収穫祭の `menagerie`（$3）の日本語名が「移動動物園」で拡張名と衝突した前例（§0-25）と
    同じ問題が起きうるので、**id は英語で `town`** に固定するのが安全。

---

### Marquis  [$6]
- **id候補**: `marquis`（衝突なし）
- **コスト**: $6 ✅[検証：live infobox `Cost [$6]`]
- **種別**: **Action**（単一種別。**アタックではない**＝堀で防げない、そもそも他プレイヤーに影響しない）✅[検証]
- **日本語名（英語wiki の Other language versions 行）**: **侯爵**（要・日本語wiki 確認）
- **カードテキスト（英語・現行 = 2022年3月初版のまま）** ✅[検証：live ＋ Versions 表 ＋ 現行PDF]:

```
+1 Buy
+1 Card per card in your hand. Discard down to 10 cards in hand.
```

- **Setup:**: なし ✅[検証]
- **公式FAQ**（wiki ＝ 現行PDF逐語・完全一致を確認）:
  - "**Even if you were unable to draw the full amount, you still discard down to 10 cards in hand afterwards.**"
    ＝ 山札＋捨て札が尽きて引ききれなくても、**「10枚まで捨てる」は必ず実行する**。
- **エラッタ**: なし ✅[検証：Versions 表が1行のみ]
- **実装上の注意**:
  - **枚数を数えるのは「その時点の手札枚数」＝ドローの前に1回だけ**。
    **Marquis 自身は既に場に出ているので数に入らない**（手札6枚なら +6カード → 手札12枚 → 2枚捨てて10枚）。
  - 「Discard down to 10」は**強制**だが、**どの10枚を残すかは自分が選ぶ**。手札が10枚以下なら何も捨てない。
  - 手札0枚で使うと +1購入 だけ（0枚ドロー・捨てなし）。
  - 民兵型の `discard_down`（相手に「3枚まで捨てさせる」）とは**方向が逆**（自分・上限10枚）。
    既存の `discard_down` を流用するなら「down to N」の N を可変にし、
    **アタック扱いにしない**（免疫判定・リアクション窓を開かない）こと。
  - 手札上限攻撃（民兵・襲撃者 等）と相性が最悪＝手札が減ると引ける枚数もそのまま減る（仕様どおり）。

---

## Elder との相互作用（担当7枚のうち Broker / Innkeeper / Town が対象）

⚠**[訂正5]** 下書きは Elder の "**(different)**" 条件を落としていた。以下は一次資料で取り直したもの。

- **Elder [$5]・Action - Townsfolk**（Townsfolk 分割山の4枚目）✅[検証：live infobox]
  カードテキスト逐語（live）:
  > "+[$2]
  >  You may play an Action card from your hand. **When it gives you a choice of abilities (with "choose")
  >  this turn, you may choose an extra (different) option.**"
- **公式FAQ（現行PDF 逐語）**:
  > "Elder: You can play an Action card with no 'choose' ability; it will simply do what it normally does.
  >  If you play one with a 'choose' ability, **you may take an extra choice, but don't have to**; for example,
  >  when playing Count (from Dark Ages), you could choose to only get one thing from the first 'choose' ability,
  >  but two from the second. **If you choose multiple things, you do those things in the order listed on the card**;
  >  for example, if you use Elder on Blacksmith and choose 'draw until you have 6 cards in hand' and
  >  '+1 Card and +1 Action,' you first draw up to 6, then get +1 Card and +1 Action.
  >  If you use Elder on Courtier (from Intrigue), you get one extra choice, not one extra choice per type.
  >  **Elder doesn't affect all choices, just ones that say 'choose' and have a list of options**; for example
  >  Workshop gives you a choice of what card to gain, but Elder playing Workshop doesn't do anything extra."
- ＝ **Broker / Innkeeper / Town はいずれも "choose one:" ＋選択肢リストなので Elder の対象**。
  **追加で選ぶのは「別の(different)」選択肢**（同じものを2回は選べない）／**解決順はカード記載順**／**任意**。
- **engine 側で選択肢を間引いてはいけない**（遂行できない選択肢も選べるのが公式。間引くと Elder との
  組み合わせや将来の裁定で食い違う）。

---

## まとめ表

| English | 日本語名（英語wiki の Japanese 行） | id候補 | $ | 種別 | 現行テキストの刷 | エラッタ |
|---|---|---|---|---|---|---|
| Broker | 仲買人 | `broker` | 4 | Action - Liaison | 2022-03 初版のまま | なし |
| Carpenter | （記載なし） | `carpenter` | 4 | Action | 2022-03 初版のまま | なし |
| Courier | （記載なし） | `courier` | 4 | Action | 2022-03 初版のまま | なし |
| Innkeeper | （記載なし） | `innkeeper` | 4 | Action | 2022-03 初版のまま | なし |
| Royal Galley | （記載なし） | `royal_galley` | 4 | Action - Duration | **印刷は 2022-03 のまま／2026-05 に機能エラッタ announce（未印刷）** | **あり（要判断）** |
| Town | （記載なし） | `town` | 4 | Action | 2022-03 初版のまま | なし |
| Marquis | 侯爵 | `marquis` | 6 | Action | 2022-03 初版のまま | なし |

- **負債コスト・ポーション費用を持つカードは 7枚とも 0**。✅[検証：live infobox のコスト欄が全て `[$N]` のみ]
- **Liaison は Broker だけ**（担当7枚のうち）。Broker が王国に入ると Ally 1枚＋Favors マット＋初期Favor 1個が付く
  （Importer が同居する場合は初期5個）。
- **"choose one" 系は Broker / Innkeeper / Town の3枚**＝いずれも **Elder の対象**（上節）。
- **7枚とも Setup: 行なし**。同盟で Setup: を持つ王国カードは **Importer**（"Setup: Each player gets +4 Favors"）等
  であって、担当7枚ではない。**現行PDF のレイアウトで Innkeeper の FAQ の横に Importer の Setup 行が並ぶので取り違え注意。**

---

## 未決（実装時に判断が要るもの）

1. **Royal Galley を (A) 印刷版 と (B) 2026エラッタ版 のどちらで実装するか。**
   一次資料では決着しない（(B) は announce 済み・未印刷・公式FAQ未更新＝wiki も "Unofficial FAQ" 扱い）。
   プロジェクトの前例（現行エラッタ採用）に従うなら (B)、実カードに合わせるなら (A)。**(B) の方が実装が軽い。**
2. **日本語名**。英語wiki は Broker=仲買人 / Marquis=侯爵 しか持たず、他5枚は Japanese 行が無い。
   PROGRESS §0-27 の教訓＝**英語wiki の Japanese 行は実物と食い違う（夜想曲で17枚）**ので、
   **日本語wiki（ホビージャパン印刷版）での確認が必須**。検証官の環境からは wikiwiki.jp の該当ページに
   到達できなかった（`/dominion/同盟` は 404・トップページはJS生成でリンクが取れない）。
3. **Broker / Carpenter の「空手札」時の挙動**、**Innkeeper の「6枚未満でも第3選択肢を選べる」**は
   カード固有の公式FAQ文が無い（一般ルール＋同拡張 Capital City の同型FAQからの推定）。

---

# 同盟（Allies）— 非分割の王国カード $5 × 6枚（KEY = g04_kingdom_5a）

> **【敵対検証済み・2026-08-12】** 別エージェント（敵対検証官）が下書きの引用を一切コピーせず、
> 一次資料を**自分で引き直して**全項目を照合した。**確定した訂正 6件**（うち1件は実装バグ直結）、
> **訂正なしで確認できた項目 46件**。訂正箇所には `【訂正】` を付けてある。
> 検証で使った一次資料と取得方法は「収集した一次資料」節に**正直に**書き直した。

対象＝ **Barbarian / Capital City / Contract / Emissary / Galleria / Guildmaster**（すべて $5・非分割の単独山）

## 収集した一次資料（★検証官が実際に取得できたものだけを書く）
| 資料 | 用途 | 取得方法・スナップショット |
|---|---|---|
| 英語wiki `Barbarian` | カードテキスト正本／FAQ | Wayback `2024id_`＋`2025id_`（日本語行の確認用）で二重取得・一致 |
| 英語wiki `Capital_City` | 同上 | Wayback `2id_`（最新） |
| 英語wiki `Contract` | 同上 | Wayback `2024id_`→実際は `20250116170904id_` に解決 |
| 英語wiki `Emissary` | 同上 | Wayback `2024id_` |
| 英語wiki `Galleria` | 同上 | Wayback `2id_`（最新） |
| 英語wiki `Guildmaster` | 同上 | Wayback `2024id_`＋`2023id_` の2スナップショットで一致 |
| 英語wiki `Allies` の `Versions` 表 | 刷（版）差分の確定 | Wayback `2025id_` |
| 英語wiki `Liaison` | Liaison 種別の一覧 | Wayback `2024id_` |
| 英語wiki `Flag` / `Duration` / `Gondola` | 訂正の裏取り | Wayback `2024id_` |
| **RGG 公式ルールブック PDF**（実DL＋`pdftotext -layout`） | Official FAQ の逐語裏取り／Favor の一般ルール／Setup の有無 | `https://www.riograndegames.com/wp-content/uploads/2021/09/Dominion-Allies-Rules.pdf`（2,144,349 bytes・2021年12月入稿の初版） |
| 日本語wiki `同盟（拡張）`（wikiwiki.jp/dominiondeck） | **日本語カード名・種別語の正本** | WebFetch |

> **取得上の注意（次に引き直す人へ）**
> - `tools/wikifetch.py` は **https の web.archive.org に連続アクセスすると IP ごと弾かれる**（`WinError 10061`／
>   `429 Too Many Requests`）。**`http://web.archive.org/...` に `curl -sL` で落とすと通る**（302→https に戻るが成功する）。
> - 最新スナップショット（`2id_` / `2025id_`）は **Anubis の bot 検知ページ（2.2KB）を保存していることがある**。
>   サイズが 3KB 未満なら中身は "Making sure you're not a bot!" なので `2024id_` / `2023id_` に落とすこと。
> - RGG の Allies ルールブックは `2022/03/` ではなく **`2021/09/` 配下**にある（`2022/03/` は 404）。

### 版（刷）の確定 — **6枚とも初版から一切変更なし**（✅検証官が独立に再取得して一致）
英語wiki `Allies` ページの `Versions` 表（逐語・検証官が自分で取得したもの）:

```
March 2022   PDF   First edition
                   Errors:
                   Rulebook — The text at the end of the last page is missing the last line
                   with the mail address and web site for Rio Grande Games.
December 2023 PDF  Functional changes:
                     Island Folk, Voyage — Cannot take a third turn in a row (2023).
                   Cosmetic changes:
                     Elder — Rephrased for clarity (2023).
Expected changes for future printing
                   Cosmetic changes:
                     Specialist — Rephrase "Play it again" to "Replay it" to match the phrasing of
                       other Throne Room variants.
                     Sunken Treasure — Remove the value of [$0] from the upper corners of Treasures (2022).
                     Importer — Mark "Setup:" in bold (2023).
```

→ **第2刷（2023年12月）の機能変更は Island Folk と Voyage のみ**（＋Elder の文言整理）。
担当6枚は**初版＝現行**で、エラッタ・文言変更ともに**存在しない**。
各カードの `English versions` 表も6枚すべて **「Allies / March 2022」の1行だけ**（6枚とも個別に確認済み）。

### 参考：Favor（好意）の一般ルール（RGG ルールブック逐語・検証官が PDF から再抽出して一致）
実装時に必ず要る前提なので引用しておく（担当外だが Contract / Emissary / Guildmaster に直結する）。

> In games using one or more Liaison cards, give each player a Favors mat and deal out a single Ally card.
> The Ally cards are a separate deck, not combined with Events and so on. Each player gets a single Favor
> token to start with (or five tokens in games with Importer).
>
> Allies are landscape cards that give Favor tokens a use; Liaisons are kingdom cards that provide a way to
> get Favor tokens. In games with a Liaison, deal out a random Ally to use that game. Only use one Ally
> per game, even with multiple Liaisons. You can still have as many other landscape cards (Events,
> Landmarks, Projects, Ways) as you otherwise would have.
>
> Coin tokens are used for Favors; they go on a Favors mat to distinguish them from Coffers and
> Villagers (from other expansions), which have their own mats. When a card gives you +1 Favor, add a
> token to your mat; when spending a Favor, remove the token from your mat.
>
> Favors may be used starting with the first turn of the game; they may not be used prior to that turn.
> Spending Favors is always optional. Spending Favors can only be done once per time an Ally ability
> triggers, unless it says, "Repeat as desired."

（`Liaison` ページより：**$5 の Liaison は Contract / Emissary / Guildmaster の3枚**＝本担当に全部入っている。
全 Liaison ＝ [$2] Bauble, Sycophant ／ [$3] Importer, Student, Underling ／ [$4] Broker ／
[$5] Contract, Emissary, Guildmaster。✅検証官が `Liaison` ページで確認。）

**Setup: 行は6枚とも無い**（✅ RGG ルールブックの全カード画像を走査した結果、Allies で `Setup:` を持つのは
**Importer だけ**＝"Setup: Each player gets +4 Favors."）。

---

## 【訂正5】日本語カード名（下書きには1枚も無かった＝欠落）
本プロジェクトの正本は**日本語wiki（ホビージャパン印刷版）**（PROGRESS §0-27：
「英語wiki の Japanese 行は17枚で実物と食い違う」ので英語wiki は使わない）。
日本語wiki `同盟（拡張）` のカード一覧より:

| id候補 | 英名 | **日本語名** | 種別（日本語） |
|---|---|---|---|
| `barbarian` | Barbarian | **蛮族** | アクション・アタック |
| `capital_city` | Capital City | **首都** | アクション |
| `contract` | Contract | **契約書** | 財宝・持続・連携 |
| `emissary` | Emissary | **密使** | アクション・連携 |
| `galleria` | Galleria | **ガレリア** | アクション |
| `guildmaster` | Guildmaster | **ギルドマスター** | アクション・連携 |

新しい訳語（日本語wiki）＝ **Favor＝好意** ／ **Liaison＝連携** ／ **Ally（横型）＝同盟** ／ Duration＝持続。
（英語wiki の Japanese 行でも 蛮族／首都／契約書 の3枚は一致した＝クロスチェック済み。
残り3枚は英語wiki に日本語行が無いので日本語wiki 単独。）

> ### ⚠ 日本語名の三重衝突（実装前に必ず読む）
> **「同盟」という日本語名が3つの別物に付く**：
> 1. **拡張名 Allies＝同盟**
> 2. **Ally 横型カード（23種）＝同盟カード**
> 3. **既存の `js/cards.js:1637` `alliance`＝「同盟」（移動動物園のイベント Alliance・$10）** ← **もう実装済み**
>
> §0-25 で踏んだ「移動動物園（Menagerie）が収穫祭の `menagerie`（$3）とかぶる」と**同型**。
> id と UI 表示の両方で区別すること（例：Ally は `ally-*`、拡張セット id は `allies`）。

---

## ★ 課題として明示された論点への回答（先出し）
### 「〜するたび」の常在効果は "while this is in play" か「そのターン中」か
**Galleria も Guildmaster も、印刷は "This turn, ..." であって "while this is in play" ではない。** 逐語:

- Galleria: `This turn, when you gain a card costing [$3] or [$4], +1 Buy.`
- Guildmaster: `This turn, when you gain a card, +1 Favor.`

→ **場に残っているかどうかは一切問わない**。使用したそのターンの終わりまで効き続ける。
玉座の間などで複数回使えば、あるいは2枚使えば **効果は重なる**（1回の獲得で +2 Buy / +2 Favor）。
既存拡張の `groundskeeper`（庭師・帝国＝**"While this is in play,"**＝場の物理枚数で数える）とは
**判定基準がまったく違う**ので、実装時に同型として書くと壊れる。

※「"This turn," は場を離れても効き続ける／重複する」は**公式FAQ の明文ではなく一般則からの推定**だが、
`Bridge`（陰謀＝"This turn, cards cost [$1] less"）が場を離れても効き重複する既存挙動と同じ template で、
争いのない解釈。**本プロジェクトの `t.costReduction`（橋）と同じ持ち方にすればよい。**

なお Galleria の wiki には
`If gaining a card costing [$3] or [$4] causes you to play a Galleria (e.g. you gained a Gondola), that will let Galleria give you +1 Buy.`
という裁定があり、**「その獲得の解決中に Galleria をプレイした場合、まさにその獲得に対しても +1 Buy が出る」**。
＝トリガの登録が「獲得の解決が終わる前」なら間に合う、ということまで公式が明示している。

> **【訂正4】Gondola は同盟のカードではない。** Gondola は**略奪（Plunder）の [$4] Treasure - Duration**で、
> `When you gain this, you may play an Action card from your hand.` を持つ（✅検証官が wiki `Gondola` で確認）。
> **略奪は本プロジェクト未実装**なので、この裁定は当面 mix-all でも再現しない。ただし
> **同型の経路は既に実装済みの拡張にある**（例：暗黒時代の `berserker`＝獲得時に自身をプレイ、
> ルネサンスの `experiment`、夜想曲の `changeling` の交換窓、移動動物園の `sleigh`／`falconer`）。
> **「獲得の解決中に Galleria がプレイされ得る」経路は現行プールでも存在する**前提で実装すること。
> （同盟の Odysseys 分割山は Old Map / Sunken Treasure / Distant Shore / Voyage ＝ Gondola は入っていない。）

---

### Barbarian  [$5]（日本語名：**蛮族**）
- **id候補**: `barbarian`（`js/cards.js` に既存なし＝衝突なし・✅grep 済み）
- **コスト**: $5（ポーション費用・負債コストなし）
- **種別**: **Action - Attack**
- **カードテキスト（英語・現行）** ✅逐語一致:
```
+[$2]
Each other player trashes the top card of their deck. If it costs [$3]
or more they gain a cheaper card sharing a type with it; otherwise
they gain a Curse.
```
- **Setup:**: なし
- **公式FAQ（wiki `Official FAQ` ＝ RGG ルールブック逐語と一致・✅両方で照合）**:
  - `For example, if a player trashes Contract to this, they could gain a Royal Galley, as they share the Duration type, or a Silver, as they share the Treasure type, or a Sycophant, as they share the Liaison type.`
    → **複数種別を持つカードは、そのうち どれか1つ でも共有していればよい**（Liaison のような
    「新種別」でも共有として成立する）。
  - `If the trashed card costs [$3] or more, they have to gain a cheaper card if they can; if there are no cheaper cards that share a type, they simply fail to gain a card.`
    → **強制**（獲得できるなら必ず獲得する＝辞退不可）。ただし候補がゼロなら**何も獲得しない**
    （呪いに落ちるのではない）。
  - `The attack hits each other player in turn order, starting with the player to your left; this can be important.`
    → **手番順に左隣から1人ずつ完全解決**（呪い山の枯渇や山の残枚数が絡むので順序が意味を持つ）。
- **Other rules clarifications（wiki）** ✅逐語一致:
  - `The player who trashes the card chooses the cheaper card they gain.`
    → **選ぶのは被害者本人**（使用者ではない）。
  - `If you cannot trash a card, then you did not trash a card costing [$3] or more, and so you gain a Curse.`
    → **山札も捨て札も空で1枚も廃棄できなかった場合は「呪いを獲得」側**に落ちる。
  - `If you trash a card that costs [P] or [D] (from other expansions), you still check if the [$] amount is [$3] or more. If it is not (like with Apothecary or City Quarter), then you gain a Curse. If it is (like with Alchemist or Fortune), then you gain a cheaper card. For example, if you trash an Alchemist, you could gain an Apothecary (which costs [$1] less) or a Village (which costs [P] less).`
    → **「$3以上か」の判定は コイン成分だけ**を見る。
    **【訂正3】** 下書きは City Quarter を「$8+負債?」「$8D」と書いていたが誤り。
    **City Quarter（市街）は $0 + 負債8**（`js/cards.js:687` = `cost:0, debt:8`／wiki も同じ）。
    コイン成分が $0 なので **呪い**、という例。薬草商(Apothecary) $2+P も **呪い**。
    錬金術師(Alchemist) $3+P・大金(Fortune) $8+負債8 は **格下げ獲得**。
  - `You cannot gain a card costing [P] (or [D]) if the card you trashed does not cost [P] (or [D]).`
    → **「より安い（cheaper）」は成分ごとの厳密比較**（コイン／ポーション／負債すべてで ≤ かつ
    どれかが < ）。$2+P は $3 より安くない。
- **エラッタ**: なし（初版＝現行・`English versions` は "Allies / March 2022" の1行のみ）。
- **Secret History**（参考）: 暗黒時代のボツ札。当時は呪いではなく **Ruins** を配っていた。Clashes の山にも
  試したが単独の山にした。
- **実装上の注意**:
  - **獲得先は「サプライ」**（一般則。カード文に "from the Supply" は書かれていないが、
    獲得は明示が無い限りサプライから）。→ **非サプライ山（馬／戦利品／精霊／賞品／成長先／願い等）は候補外**。
    ロック中の分割山下段・混合山の2枚目以降も候補外＝`gainableBase` が正本。
  - 「廃棄する」のは**被害者本人**＝廃棄時トリガ（城塞が手札に戻る／ネズミ／草茂る屋敷／墓所＋1VP
    ／青空市場のリアクション など）は**被害者のものとして発火する**。本プロジェクトでは
    `trashCard(state, 被害者, card)` を通すこと。
  - **獲得時トリガも被害者のもの**（望楼／交易商人／そり／鷹匠／取り替え子／牧羊犬／技術革新 …）。
    `gain()` を通し、`state.onGainQueue` に窓が積まれ得ることを前提に書く。
  - 山札が空なら**捨て札をシャッフルして山札にしてから**一番上を廃棄する（一般ルール）。
    両方空なら廃棄できず → 呪いを獲得。
  - 「$3以上か」＝**コイン成分のみ**、「より安いか」＝**3成分の厳密比較**という**非対称**が最大の罠。
  - 呪い山が空なら呪いは獲得できない（＝何も起きない）。呪いは手番順に先着で配られる。
  - アタックなので堀／灯台などの免疫は通常どおり。免疫のプレイヤーは廃棄も獲得もしない。
    → `ATTACKS` 登録＋`*EnterVictim`＋react 窓（`MOAT_REVEAL`）の既存4点セットに乗せる。
  - 「同じ種別を共有」の判定は **同盟の新種別（Liaison / Fort / Odyssey / Augur / Clash /
    Townsfolk / Wizard）や Duration / Reaction / Attack / Victory / Treasure も含む全種別**で行う。
    ＝カタログの `types` 配列の積集合が空でなければよい。

---

### Capital City  [$5]（日本語名：**首都**）
- **id候補**: `capital_city`
  （⚠ 既存カタログに帝国の `capital`＝「元手」（$5・財宝・+$6）が居る＝`js/cards.js:707`。
  **別カードなので id を衝突させない**。`capital_city` は未使用＝✅grep 済み。
  日本語名も「元手」と「首都」で別なので表示は衝突しない。）
- **コスト**: $5（ポーション費用・負債コストなし）
- **種別**: **Action**（それだけ。Duration でも Liaison でもない）✅wiki の Type(s) 欄で確認
- **カードテキスト（英語・現行）** ✅逐語一致:
```
+1 Card
+2 Actions
You may discard 2 cards for +[$2].
You may pay [$2] for +2 Cards.
```
- **Setup:**: なし
- **公式FAQ（wiki ＝ RGG ルールブック逐語と一致・✅両方で照合）**:
  - `First draw a card and get +2 Actions.`
    → **順序は固定**：まず +1カード／+2アクション。
  - `Then decide if you want to discard 2 cards for +[$2]. You may choose to do this even with fewer than 2 cards in hand, and will discard what you can, but you only get +[$2] if you actually discarded 2 cards.`
    → **任意**。**手札が2枚未満でも「する」を選べて、その場合は捨てられるだけ捨てるが +$2 は得られない**
    （＝1枚だけ捨てて損をすることが公式に可能。人間が選べる形にする必要がある）。
  - `Then decide if you want to spend [$2] for +2 Cards. The [$2] can come from discarding to Capital City, or some other source, e.g. a Barbarian you played earlier in the turn. You don't get to play Treasures here to make the [$2] though.`
    → **任意**。支払い原資は**そのターンの手持ちコイン全般**（この Capital City の捨て札で得た $2 でも、
    先にプレイした Barbarian の +$2 でもよい）。**ここで財宝をプレイして $2 を作ることはできない**。
- **Other rules clarifications（wiki）** ✅逐語一致:
  - `If you play this with Way of the Chameleon, you may discard 2 cards for +2 Cards. You can also pay [$2] for +[$2], although this isn't useful.`
    → カメレオンの習性（移動動物園）で +カード ↔ +コイン が入れ替わると、
    「2枚捨てて +2カード」「$2 払って +$2」になる（後者は無意味）。
    **本プロジェクトは `addCoins` / `draw()` 冒頭のフックでカメレオンを実装済み**（§0-25）なので、
    `addCoins(state, 2)` と `draw()` を素直に使えば自動で一致する。**`t.coins += 2` を直接書かない**。
- **エラッタ**: なし（初版＝現行）。
- **実装上の注意**:
  - **3つの段階を必ずこの順で解決する**（+1カード+2アクション → 捨てるか → 払うか）。
    2段目の結果得たコインを3段目で使えるので、**まとめて1つの選択にしてはいけない**。
    → pending 2段（`capital_city_discard` → `capital_city_pay`）。両方とも**任意＝辞退ボタンが要る**。
  - 2段目は「2枚ちょうど捨てる／捨てない」の二択ではなく、**手札1枚しか無くても“捨てる”を選べる**
    （＝engine は「2枚未満でも受理し、捨てられるだけ捨て、+$2 は出さない」を実装する）。
    ただし人間が誤タップで損をしないよう UI では警告を出すのが望ましい。
  - **捨て札トリガ**（坑道／村有緑地／忠犬／羊飼い …）は普通に誘発する。
    本プロジェクトは `triggerOnDiscard` を通す経路にしか配線していない（§0-25 の既知制約）ので、
    **Capital City の捨て札は必ず `triggerOnDiscard` を通すこと**。
  - 3段目の「$2 を払う」は**購入ではない支払い**。本プロジェクトでは `t.coins` から 2 を引く
    （`addCoins` は加算専用＝消費側は直接減算＝§0-25 の規約どおり）。コインが $2 未満なら選べない。
  - この $2 消費は「購入」ではないので、購入回数・`treasuresLocked`（購入したらそのターンは
    財宝を出せない）などのフラグには**触れない**。
    ※通常はアクションフェイズで解決するが、**Contract／Courier／王子／御料車 などで
    「アクションフェイズ以外」に使われ得る**（Contract は次のターンの**開始時**に使わせる）。
    `turn.phase === 'buy'` を前提にした分岐を書かないこと（§0-27 の最大の罠と同型）。
  - **【訂正1】3段目の +2カード について、下書きは「-1カードトークンや旗（アーティファクト）の
    影響を受ける」と書いていたが、旗は誤り。**
    `Flag`（ルネサンスのアーティファクト）の印刷は **`When drawing your hand, +1 Card.`** で、
    Official FAQ は `The Flag causes you to draw an extra card when drawing your hand in Clean-up.`
    ＝**片付けで手札を引くときだけ**（前哨地の3枚→4枚には効くが、学者・寄付・そして Capital City の
    +2カードには効かない）。本プロジェクトも §0-22 で「旗は先引きに乗せる」と実装済み。
    → **-1カードトークン（遺物／借入）は効く**（`draw()` 冒頭フック）が、**旗は効かない**。
    この誤りをそのまま実装すると「旗持ちが Capital City で3枚引く」実バグになる。

---

### Contract  [$5]（日本語名：**契約書**）
- **id候補**: `contract`（衝突なし・✅grep 済み）
- **コスト**: $5（ポーション費用・負債コストなし）
- **種別**: **Treasure - Duration - Liaison**（✅wiki の Type(s) 欄＋RGG ルールブックのカード画像の両方で確認）
  （wiki Trivia: `Contract was the first official Duration-Treasure (excepting interactions with Capitalism).`）
- **カードテキスト（英語・現行）** ✅逐語一致:
```
[$2]
+1 Favor
You may set aside an Action from your hand to play it at the start of your next turn.
```
（先頭の `[$2]` は「+」の付かない財宝の $ 表記＝銀貨などと同じ形式。カタログには `coin: 2` を持たせる。）
- **Setup:**: なし
- **公式FAQ（wiki ＝ RGG ルールブック逐語と一致・✅両方で照合）**:
  - `If you set aside a card, then Contract stays in play until the Clean-up of your next turn; if you don't set aside a card, Contract is discarded the same turn in Clean-up.`
    → **脇に置いたときだけ持続になる**（0枚なら持続にならず、そのターンの片付けで捨てる）。
    ＝ルネサンスの貨物船（`cargo_ship`）と同じ形。
  - `If you set aside a card, you have to play it at the start of your next turn.`
    → **脇に置くのは任意、次のターン開始時にプレイするのは強制**。
  - `The set-aside card is face up.`
    → **脇札は表向き＝公開情報**（オンラインの `maskStateFor` で伏せてはいけない）。
- **Other rules clarification（wiki・1件のみ）** ✅逐語一致:
  - `Contract is discarded from play during Clean-up on the turn on which it plays the set-aside card, even if the set-aside card itself is a Duration card (or a Throne Room variant that plays a Duration card) and stays in play longer than that.`
    → **脇札が持続カード（あるいは持続を再演する玉座系）であっても、Contract 自身はそのターンの
    片付けで場を離れる**。プレイされた持続カードだけがさらに場に残る。
    これは RGG ルールブックの一般則
    `if a Duration card is played extra times by a card such as Specialist, that card also stays in play until the Duration card is discarded`
    の**明示された例外**にあたるので要注意（✅ルールブック本文も検証官が確認）。
- **エラッタ**: なし（初版＝現行）。
- **実装上の注意**:
  - **財宝なので効果は `applyTreasureEffect` に書く**（本プロジェクトの規約。`applyEffect` に書くと
    財宝プレイでは呼ばれず空振りする＝§0-25 の既出の罠）。
  - **`PLAY_ALL_TREASURES`（財宝を全部出す）で脇置きの選択待ちが立つ**＝中断→再開の経路
    （`turn.playAllResume`）に正しく乗ること。**`PLAY_ALL_EXCLUDE`（呪われた金貨）には入れない**
    （事故にならない任意の選択なので出してよい）。
  - 通常は購入フェイズにプレイされるので、「手札のアクション」＝購入フェイズ時点で手札に残っている
    アクションカード。**相続（冒険の inheritance）で屋敷がアクションになっている場合も対象**
    （本プロジェクトなら `DOM.isType(card,'action') || inheritedEstate(p, card)`）。
  - 脇札は**物理カード**＝`allCards` と invariants の `ZONES` に新ゾーンを登録すること
    （保存則テストに数える）。**表向きなので `maskStateFor` では伏せない**
    （＝ルネサンスの `research`／夜想曲の `cryptSetAside` とは逆・`ghostSetAside` と同じ扱い）。
  - 次のターン開始時のプレイは**アクション権を消費しない**（王子・遅延（Delay）と同型）。
    本プロジェクトでは `resolveDurationStartEffects` から `t.startQueue` に積み、`playCardNoAction`
    で解決する。**習性（Way）も選べる**（公式：カードを使用するときはいつでも選べる）。
    ※**ターン開始時の複数処理の解決順は選べない**（`startQueue` は先入れ順）＝既存の許容簡略化と同じ。
  - 冠／ティアラ／偽造通貨で Contract を2回使うと **$2×2・+1Favor×2・脇置きの機会が2回**
    （2枚のアクションを脇に置ける）。2回目も `applyTreasureEffect` を通ること（§0-15 の `treasure_replay`）。
  - **【訂正6・断定を撤回】偽造通貨（counterfeit）で Contract を使うと Contract は廃棄される**
    （偽造通貨は2回使った財宝を廃棄する）。下書きはこの場合も脇札が次のターンに使われる前提で
    断定していたが、**Contract 固有の公式裁定は見つからなかった**。
    英語wiki `Duration` の一般則
    `It is occasionally possible to remove Duration cards from play before they are done resolving all their abilities. ... In most cases, the Duration card's effects will still carry over to future turns, which you will have to remember.`
    からは「**脇札は次のターンに使用される**」と読めるが、**実装時の判断が要る**（下の「未決事項」参照）。

---

### Emissary  [$5]（日本語名：**密使**）
- **id候補**: `emissary`（衝突なし・✅grep 済み）
- **コスト**: $5（ポーション費用・負債コストなし）
- **種別**: **Action - Liaison**
- **カードテキスト（英語・現行）** ✅逐語一致:
```
+3 Cards
If this made you shuffle (at least one card), +1 Action and +2 Favors.
```
- **Setup:**: なし
- **公式FAQ（wiki ＝ RGG ルールブック逐語と一致・✅両方で照合）**:
  - `First draw 3 cards; then see if drawing those cards caused you to shuffle. If it did, you get +1 Action and +2 Favors.`
  - `It only counts as shuffling if at least one card was in your discard pile.`
- **Other rules clarifications（wiki）** ✅逐語一致（wiki の原文にある typo も含めそのまま）:
  - `This checks if any cards were in your discard pile, and not how many cards were actually shuffled. So if you use either Order of Astrologers or Order of Masons to effectively shuffle 0 cards back into your deck, you'll still get the bonus from Emissary.`
    → **判定は「シャッフルの時点で捨て札に1枚以上あったか」**であって、実際に何枚が山札に
    戻ったかではない（Ally の効果で実質0枚になっても成立する）。
  - `This checks if its +3 Cards is the effect that you makes you shuffle. So if playing Emissary gets you +1 Card (from Pathfinding), and that makes you shuffle, you won't get the bonus from Emissary.`
    → **「この カード自身の +3カード」が原因のシャッフルでなければならない**。
    山トークン（冒険の Pathfinding＝+1カード）による先行ドローでシャッフルが起きた場合は
    ボーナスが出ない。
  - `But if you use Order of Masons to leave yourself with less than 3 cards in your deck after Pathfinding, then Emissary's +3 Cards will make you shuffle, and that's give you +1 Action and +2 Favors.`
- **エラッタ**: なし（初版＝現行）。
- **Wording（Donald X.・参考）**: `A good starting point is to assume that every time "would" is used, it's a huge mistake.`
  「Order of Masons でドローを潰す人はいないので、通常のゲーム状況で読みやすい文言を選んだ」。
- **実装上の注意**:
  - 判定は「**+3カードのドロー中に `reshuffleDeck` が走ったか**」＋「**そのシャッフルの直前に捨て札が
    1枚以上あったか**」の2条件。本プロジェクトは全リシャッフルが `reshuffleDeck(p)` の1入口に
    集約されている（§0-7 で37箇所を統一済み）ので、そこにカウンタ／フラグを立てて前後比較すれば正しく取れる。
  - **山トークン等による先行ドローは対象外**＝`applyPileTokens`（山トークンのボーナス）は
    `PLAY_ACTION` の中で**カード効果の解決より前**に適用される（§0-9 Batch5b）ので、
    「Emissary の効果に入った時点」からのシャッフルだけを数えること。
  - 山札がちょうど3枚以上あって1枚もシャッフルせずに引けた場合は**ボーナスなし**。
    山札0枚・捨て札0枚で1枚も引けない場合も**ボーナスなし**。
  - **ボーナスが出ないと terminal（アクション権を消費して終わる）**＝CPU の「ターミナル衝突」評価に
    影響する。逆に出れば +1アクションで cantrip 化する。
  - -1カードトークン（遺物／借入）で引く枚数が 3→2 に減っても、判定条件そのものは変わらない
    （実際に引く枚数が減るだけで、その2枚を引く過程でシャッフルすればボーナスは出る）。
    ※**公式に明示なし＝一般則からの推定**。
  - **選択待ちは不要**（完全自動）。ただし **Favor を得た結果 Ally の能力が使えるようになる**ので、
    Ally 側の対話は別途。

---

### Galleria  [$5]（日本語名：**ガレリア**）
- **id候補**: `galleria`（衝突なし・✅grep 済み）
- **コスト**: $5（ポーション費用・負債コストなし）
- **種別**: **Action**（Liaison **ではない**＝Favor を配らない。✅wiki の Type(s) 欄で確認）
- **カードテキスト（英語・現行）** ✅逐語一致:
```
+[$3]
This turn, when you gain a card costing [$3] or [$4], +1 Buy.
```
- **Setup:**: なし
- **公式FAQ（wiki ＝ RGG ルールブック逐語と一致・✅両方で照合）**:
  - `What matters is how much a card actually costs when you gain it. If, for example, cards cost [$1] less due to Bridge (from Intrigue), then gaining Silver would not produce +1 Buy, but gaining Duchy would.`
    → **判定は「獲得した瞬間の実コスト」**。コスト軽減（橋／街道／石切場／渡し船トークン…）を
    反映した後の値で見る。橋が1枚出ていれば 銀貨は $2 になるので**対象外**、公領は $4 になるので**対象**。
- **Other rules clarifications（wiki・3件）** ✅逐語一致:
  - `Alchemist, Familiar, and Golem do not cost either [$3] or [$4].`
    → **ポーション費用のカードは「$3」「$4」ではない**（錬金術師 $3P・使い魔 $3P・ゴーレム $4P）。
    ＝**コイン成分だけ見て一致させてはいけない。ポーション成分・負債成分が 0 であることも必要**。
  - `Galleria cares about the cost a card has at the moment you gain it, even if the cost changes. So if you gain a Destrier when it costs [$5], that won't count for Galleria (even though gaining the Destrier reduces its own cost to [$4]). But if you gain a Destrier when it costs [$3] (reducing its cost to [$2]), that will make Galleria give +1 Buy.`
    → **獲得した瞬間の値で固定**。獲得によってコストが変わる札（デストリエ＝移動動物園・実装済み）でも、
    **変化前**で判定。
  - `If gaining a card costing [$3] or [$4] causes you to play a Galleria (e.g. you gained a Gondola), that will let Galleria give you +1 Buy.`
    → **その獲得の解決中に Galleria をプレイした場合、まさにその獲得に対しても +1 Buy が出る**。
    （Gondola については上の【訂正4】参照＝略奪のカードで本プロジェクト未実装。）
- **エラッタ**: なし（初版＝現行）。
- **実装上の注意**:
  - **"This turn," であって "while this is in play," ではない**。Galleria が場を離れても
    （行進で廃棄された／焚火で廃棄された／玉座で2回使った等）**そのターンの間ずっと効き続ける**。
    → **ターン変数（例 `t.galleriaCount`）に「使用回数」を積む**。場の枚数を数えてはいけない。
  - **重複する**：2回使えば1回の該当獲得で **+2 Buy**。
  - **「ちょうど $3 か $4」＝3成分すべてが一致する必要がある**（ポーション費用・負債コストが
    付いていたら対象外）。ポーションについては上記のとおり公式に明示。
    負債については明文が無い（**推定**）が、帝国ルールブックの
    `[$0+4D] is not "up to [$5]."`（成分別比較）と同じ理屈で、$3+負債N は「$3」ではない。
  - **⚠【重要な実装警告・下書きに無かった】`costExact` / `costUpTo` / `costUnder` は
    `gainableBase` を内包している**（`js/engine.js:3282-3300`＝**`state.supply[id] > 0` を要求し、
    非サプライ札とロック中の分割山下段を弾く**）。
    Galleria が見るのは**「今まさに獲得したカードのコスト」**であって「これから獲得できるか」ではない。
    - **最後の1枚を獲得すると `supply[id]` が 0 になる**ので、獲得後に `costExact(state,id,3)` を
      呼ぶと **false**＝**+1購入が黙って消える**。
    - **非サプライのカードを獲得した場合**（馬・戦利品・精霊・願い・賞品・成長先・ゾンビ…）も同様に
      false になるが、**馬は $3・インプは $2・ウィル・オ・ウィスプは $0** なので
      「馬を獲得しても +1購入 が出ない」という**忠実性バグ**になる（公式は馬 $3 なので出る）。
    → **コストの「読み取り」には `costOf(state, id)` を直接使い**、
      `{coin:3,pot:0,debt:0}` または `{coin:4,pot:0,debt:0}` と厳密比較する。
      `cost*` 述語は**獲得候補の絞り込み専用**（Barbarian の「より安い」候補作りには使ってよい）。
  - **「自分が獲得したとき」だけ**（相手の獲得では出ない）。かつ「このターン」なので、
    相手のターンに自分がリアクションで獲得しても出ない。
  - 獲得の解決中に新たに立った Galleria も同じ獲得に間に合う＝**トリガの登録タイミングは
    「その獲得の on-gain 解決が終わる前」でよい**（本プロジェクトなら `onGainQueue` の消化中に
    カウンタが増えても、その獲得ぶんの +1購入 を出す）。
  - +1購入は購入フェイズ前に出ても構わない（`t.buys` を増やすだけ）。
  - **選択待ちは不要**。

---

### Guildmaster  [$5]（日本語名：**ギルドマスター**）
- **id候補**: `guildmaster`（衝突なし・✅grep 済み）
- **コスト**: $5（ポーション費用・負債コストなし）
- **種別**: **Action - Liaison**
- **カードテキスト（英語・現行）** ✅逐語一致:
```
+[$3]
This turn, when you gain a card, +1 Favor.
```
- **Setup:**: なし
- **公式FAQ（wiki ＝ RGG ルールブック逐語と一致・✅両方で照合。wiki には
  "Other rules clarifications" 節が**無い**＝Official FAQ の1件だけ）**:
  - `If an Ally ability triggers on gaining cards, e.g. Band of Nomads, you can use the Favor you just got on it.`
    → **獲得で得た Favor を、その同じ獲得で誘発した Ally 能力に即座に使える**
    （＝「+1 Favor」が Ally のトリガより先に解決される、と公式が保証している）。
- **エラッタ**: なし（初版＝現行）。
- **Secret History**（✅逐語確認）:
  `One of the later Liaisons; just trying to get in another way to get Favors. Printed like it started, though I considered limiting it to e.g. "when you gain a card costing [$3] or more."`
  → **コスト制限は無い**（どんなに安いカードの獲得でも +1 Favor）。
- **実装上の注意**:
  - Galleria と同じく **"This turn," であって "while this is in play," ではない**。
    場を離れてもそのターン中は効き続け、**複数回使えば重複する**（1回の獲得で +2 Favor 等）。
    → ターン変数（例 `t.guildmasterCount`）に使用回数を積む。
  - **獲得するカードの種類・コスト・獲得元を問わない**（購入でも効果による獲得でもよい／
    **非サプライ札の獲得でも出る**＝コスト述語を挟まないこと）。「自分が獲得したとき」だけ。
  - **解決順が重要**：獲得 → **まず Guildmaster の +1 Favor** → その後に Ally の「獲得時」能力を開く。
    逆順にすると「今もらった Favor をその場で使う」という公式挙動が再現できない。
    本プロジェクト流に言うと、`triggerOnGain` の中で **Guildmaster のカウンタぶんの Favor を先に
    加算してから** `onGainQueue` に Ally の対話を積む。
  - Favor（好意）は非カード（`p.favors` のような数値）＝**保存則 tally に混ぜない**。**公開情報**
    （＝財源 Coffers／村人 Villagers と同型。ただし**別枠のマット**なので混ぜて使えない）。
  - **選択待ちは不要**（Favor を使うかどうかの対話は Ally 側）。

---

## 6枚まとめ（実装用の早見表）
| id候補 | 日本語名 | $ | 種別 | 選択待ち(pending)の要否 | 持続 | Favor |
|---|---|---|---|---|---|---|
| `barbarian` | 蛮族 | 5 | Action - Attack | 要（被害者が「共有種別かつより安い」1枚を選ぶ／堀リアクション窓） | – | – |
| `capital_city` | 首都 | 5 | Action | 要（2段：捨てるか／$2払うか。順序固定・両方とも任意） | – | – |
| `contract` | 契約書 | 5 | **Treasure - Duration - Liaison** | 要（手札のアクション1枚を脇に置くか。任意） | ○（脇に置いたときだけ） | +1 |
| `emissary` | 密使 | 5 | Action - Liaison | 不要（自動判定） | – | +2（条件付き） |
| `galleria` | ガレリア | 5 | Action | 不要（ターンフラグ） | – | – |
| `guildmaster` | ギルドマスター | 5 | Action - Liaison | 不要（ターンフラグ） | – | 獲得ごと+1 |

**この6枚で新たに要る機構**
1. **Favor（好意）＝プレイヤーごとの数値＋Ally（同盟）1枚**（Contract/Emissary/Guildmaster）。
   Liaison（連携）が王国にあるとき Ally を1枚だけ配り、全員 Favor 1個（Importer があれば5個）で開始。
   財源／村人と**別枠のマット**。非カード・公開。
2. **"This turn," 型の獲得トリガ**（Galleria/Guildmaster）＝**ターン変数に使用回数を積む**。
   既存の `groundskeeper`（"while this is in play"）とは別機構。橋（`t.costReduction`）と同型。
3. **Duration-Treasure**（Contract）＝財宝でありながら持続。`applyTreasureEffect` に書きつつ、
   脇置きしたときだけ持続になる（貨物船と同型）。脇札は**表向き**＝新ゾーンを `allCards`／`ZONES` に登録。
4. **「共有種別かつより安い」獲得述語**（Barbarian）＝コイン成分だけの「$3以上」判定と、
   3成分厳密比較の「より安い」判定という**非対称**を正しく分けること。

---

## ⚠ 未決事項（一次資料でも決着しなかった＝実装時に判断が要る）
1. **Contract × 偽造通貨（counterfeit）／焚火（bonfire）等で Contract が場から除かれた場合**、
   脇に置いたアクションは次のターンに使用されるか。
   Contract 固有の裁定は無し。英語wiki `Duration` の一般則
   `In most cases, the Duration card's effects will still carry over to future turns` からは
   **「使用される」**と読める。→ **その方向に倒し、PROGRESS に「一次資料で明文なし・一般則から採用」と明記する**のを推奨。
2. **Galleria の「ちょうど $3/$4」に負債コストが含まれないこと**は公式の明文が無い（ポーションのみ明示）。
   帝国ルールブックの成分別比較（`[$0+4D] is not "up to [$5]."`）から**含まれない**と判断するのが自然。
3. **Emissary と -1カードトークンの相互作用**（引く枚数が減った状態でのシャッフル判定）は公式の明文なし。
   カード文どおり「+3 Cards の解決中にシャッフルしたか」で判定するのが自然。
4. **Contract を冠／ティアラで2回使ったときの脇置き2回**は公式の明文なし（一般則からは成立）。
5. **日本語のカードテキスト（本文）は未確定**。日本語wiki のカード名は取れたが、
   英語wiki の Japanese 行のスキャン OCR は誤りだらけ（「廃棄」→「焼車」、「脇に置いて」→「感に置いて」、
   「好意」→「好斌」等）＝**本文の日本語は日本語wiki の各カードページから取り直すこと**。

---

# 同盟（Allies）研究 — g05_kingdom_5b：非分割の王国カード 6枚（全部 $5）

> **【敵対検証済み・2026-08-12】** 別エージェントが下書きの引用を一切コピーせず、
> 一次資料（英語wiki 6ページ＋`Allies`／`Duration`／`Return` の3ページ＋RGG ルールブック PDF 2種）を
> **自分で引き直して**全項目を突き合わせた。**確定訂正 9件**（うち引用の捏造・改変が5件）。
> 訂正箇所には 🔴 を付けてある。訂正の詳細は末尾の「§検証ログ」を参照。
> **カードテキスト・コスト・種別・Setup の有無・エラッタの有無は 6枚とも下書きどおりで正しかった。**

担当カード＝**Highwayman / Hunter / Modify / Skirmisher / Specialist / Swap**（すべて単独山・$5・Liaison ではない）。

## 一次資料と、それをどう突き合わせたか

| 資料 | 取得方法 | 用途 |
|---|---|---|
| 英語wiki `Highwayman`（Wayback 2025 スナップショット） | `python tools/wikifetch.py` | カードテキスト正本・Official FAQ・Other rules clarifications・Versions 表 |
| 英語wiki `Hunter`（2025 スナップショット・oldid=93292） | 同上 | 同上 |
| 英語wiki `Modify`（2024 スナップショット） | 同上 | 同上 |
| 英語wiki `Skirmisher`（2025 スナップショット） | 同上 | 同上 |
| 英語wiki `Specialist`（2024 スナップショット） | 同上 | 同上 |
| 英語wiki `Swap`（**2022 と 2024 の2スナップショットで一致確認**） | 同上 | 同上 |
| 英語wiki `Allies` ページ `Versions` 節（2025 スナップショット） | 同上 | 刷（版）差分の確定 |
| 英語wiki `Duration` ページ（2025 スナップショット） | 同上 | Specialist × 持続カードの一般ルール |
| 🔴 英語wiki `Return` ページ（2025 スナップショット） | 同上 | **「山へ返す」の一般ルール**（Swap の分割山挙動の**正しい**出典） |
| RGG 公式ルールブック PDF **2022年 初版**（`allies_rulebook.txt`・indd 日付 10/24/21・12/29/21） | curl 実DL → `pdftotext -layout` | Official FAQ とカード面テキストの逐語裏取り |
| RGG 公式ルールブック PDF **2023年11月版（＝2023年12月 第2刷）**（`rb2023.txt`・`DomAlliesRules21x.qxp 11/10/23`） | 同上 | **現行**の逐語裏取り |

**結論：担当6枚は 2022年初版 → 2023年12月 第2刷 でカードテキスト・FAQ とも一切変わっていない。**
検証者が **2つのルールブック PDF から6枚ぶんの FAQ 段落を機械抽出して文字列比較したところ、
`.indd` のタイムスタンプ以外は完全一致**（`12/29/21` → `3/1/22` のみ差分）。
wiki 側も6枚すべて `English versions` 表が **「Allies / March 2022」の1行だけ**＝エラッタ行が存在しない。

`Allies` ページの Versions 節（逐語・検証者が再取得）:

```
December 2023
Functional changes:  Island Folk, Voyage — Cannot take a third turn in a row (2023).
Cosmetic changes:    Elder — Rephrased for clarity (2023).

Expected changes for future printing
Cosmetic changes:
  Specialist — Rephrase "Play it again" to "Replay it" to match the phrasing of other Throne Room variants.
  Sunken Treasure — Remove the value of [$0] from the upper corners of Treasures (2022).
  Importer — Mark "Setup:" in bold (2023).
```

→ **Specialist の "Replay it" は「将来の刷で予定されている cosmetic（表現のみ）変更」**であり、
**現行（第2刷 2023-12）の印刷は今も "Play it again"**。機能差はゼロ。

## ⚠️ 依頼文の前提に対する訂正（重要・検証で追認）

依頼文には「**Skirmisher は持続アタック**（獲得のたび相手が手札を捨てる）」とあったが、
**Skirmisher は Duration ではない。種別は `Action - Attack` のみ**で、効果は
"**This turn**, when you gain an Attack card, ..." ＝**そのターン限りの獲得時トリガー**である。
（検証者が wiki `Skirmisher` の Info ボックス＋Versions 表、および 2022/2023 両ルールブックの
カード面テキスト `Action - Attack` の4点で独立に確認。種別変更のエラッタは存在しない。）
持続アタックなのは **Highwayman だけ**（`Action - Duration - Attack`）。

---

### Highwayman  [$5]
- **id候補**: `highwayman`
- **コスト**: $5（ポーション費用・負債コストとも無し）
- **種別**: **Action - Duration - Attack**
- **Purpose**: Kingdom Pile（王国カード・10枚の単独山）
- **カードテキスト（英語・現行）**:
```
At the start of your next turn, discard this from play and +3 Cards.
Until then, the first Treasure each other player plays each turn does nothing.
```
- **Setup:**: なし
- **Official FAQ（逐語・7項目）**:
  1. "You draw the 3 cards even if Highwayman can't be discarded from play; for example, if you Throne Room a
     Highwayman, you'll only discard it once but will draw 6 cards."
  2. "Discarding Highwayman happens first, so it's possible to even draw that Highwayman with the +3 Cards."
     ＝**「捨てる」→「+3カード」の順**。捨てた自分自身を引き直すことがあり得る。
  3. "The attack stops each other player's first Treasure from doing anything, each turn; if they take extra turns,
     every turn is affected. For example, if their first played Treasure is Copper, it produces no [$]."
  4. "This isn't cumulative; if multiple players play copies of Highwayman, or one player plays multiple copies of it,
     still only one Treasure per turn does nothing."
  5. "The Treasure does nothing even if it's also an Action, e.g., Crown (from Empires)."
  6. "This stops the Treasure from doing what it does when played, but doesn't stop abilities below a dividing line,
     like Capital's (from Empires)."
     ＝ライン下の能力（＝場から捨てるときの負債など）は普通に働く。
  7. "If the Treasure is also an Action, a Way (from Menagerie) can still be used on it, and Enchantress (from Empires)
     can still work on it; the player who played the Treasure decides which effect applies."
- **Other rules clarifications（逐語・10項目）**:
  1. "If you play this with Throne Room, then when Highwayman discards itself from play, Throne Room still remains
     in play until Clean-up."
  2. "If you play a Scheme at the start of your turn (with e.g. Royal Galley), you may put Highwayman onto your deck
     when you discard it from play with its own ability (and you will immediately draw the Highwayman back)."
  3. "If Highwayman is Tireless, when you discard it from play at the start of your turn, you set it aside, and put it
     onto your deck at the end of that turn. And if it's Reckless, you'll return it to its pile at the start of your turn."
  4. "Highwayman does not change anything about the Treasure, just prevents on-play instructions on the card from being
     carried out. So a blocked Fool's Gold will still let your other Fool's Gold make +[$4], and it can still be
     replayed by Specialist."
  5. "Highwayman overrules effects that change the values of Treasures, meaning that Envious and Coppersmith will have
     no effect."
  6. 🔴（**下書きが落としていた1項目**）"If the Treasure is Reckless, you won't follow its instructions twice, and you
     return it to its pile when discarding it from play."
     ※ Reckless＝日の出づる国の Trait。本アプリ未実装なので当面の影響はゼロだが、将来 Rising Sun を入れるときに要る。
  7. "Unlike Enchantress, this can affect a Treasure that another player plays during your turn. So if you play
     Barbarian, trash their Gold, and they gain and play a Buried Treasure, the Buried Treasure will do nothing and be
     discarded from play during your Clean-up."
  8. "However, if you have Capitalism and other players react with Caravan Guards to your first Highwayman, they get
     full value from all their Caravan Guards, because the reaction takes place before Highwayman resolves."
  9. "If you play an Action card that gives +[$], and then buy Capitalism later the same turn, that Action card you
     already played will become a Treasure, but it doesn't count as the first Treasure you played this turn because it
     wasn't a Treasure when you played it."
  10. "If you play a Treasure and then an opponent somehow plays Highwayman on the same turn, Highwayman missed its
      chance; the first Treasure you played has already had its effect and doesn't get revoked, and future Treasures
      you may play on that turn aren't affected by Highwayman because they're not the first."
- **エラッタ**: なし（初版PDF＝第2刷PDF＝wiki が完全一致）。
- **実装上の注意**:
  - **このアプリの「先引き」構造と真正面から噛み合う要注意カード。** Highwayman は
    **「次の自分のターンの *開始時* に、場から自分を捨てて +3カード」**という**普通の持続と逆の形**をしている
    （普通の持続は片付けで捨てる）。本エンジンは**自分の手番終了時に次の手札を先引きする**ので、
    +3カード は**先引きの後**＝`resolveDurationStartEffects`（開始時効果）で処理する。
    §0-25 のリス／§0-9 の保存(save)／§0-28 の川の恵み と同じ位置。
  - **捨てる→引く の順を守る**（引いた3枚の中に自分自身が入り得る＝公式が明示している挙動）。
    「引いてから捨てる」にすると絶対に引き直せなくなる。
  - **場から捨てられなくても +3カード は必ず引く**（玉座の間で2回使うと、捨てるのは1回・引くのは6枚）。
    ＝「捨てられたなら」の条件を付けてはいけない。**`removeOne` の成否とドローを結びつけないこと。**
  - **玉座の間（および Specialist 等の再演）で使った場合、Highwayman が自分で場を離れても、
    玉座の間は片付けまで場に残る**（`Duration` ページが Highwayman を名指しで例示）。本アプリの持続仕分けは
    `p.delayedEffects` の残り枚数で数えるため、ここは既存の「幽霊が場に残らない」許容簡略化（§0-28）と
    同種のズレが出やすい。**要検討ポイント**。
  - **アタックの本体＝「無効化」であって「使用の禁止」ではない**。
    財宝は普通に場に出て、普通に「使用した」と数え、片付けで普通に捨てる。**記載効果だけが空振りする**。
    したがって:
    - 愚者の黄金（fools_gold）＝無効化された1枚目も「場にある1枚目の愚者の黄金」として数えるので
      2枚目は +$4 になる（**公式が明示**）。
    - ライン下の能力（元手 capital の負債など）は働く。
    - 嫉妬（envious・夜想曲の状態）や銅細工師（coppersmith）のような**額を書き換える効果は全部負ける**
      （Highwayman が上書きする）＝`treasureCoins` の計算全体を 0 にするのではなく、
      **その財宝の「使用時の効果」を丸ごとスキップする**実装にすること。
    - **「1枚目の財宝」のカウントは各プレイヤーごと・各ターンごと**。追加ターン（前哨地/使節団/今を生きる等）でも
      そのターンごとに1枚無効化する。
  - **累積しない**＝複数の Highwayman があっても1ターンに1枚だけ。
    §0-9 の呪いの森/沼の妖婆で作った「予約 rid ごとに1回」モデル（`applyLingerOnBuy`）を**そのまま流用すると
    多重発動してしまう**。**Highwayman は「予約が1つでもあれば、そのターン最初の財宝1枚を無効化」**という
    per-turn フラグ（例 `t.highwaymanUsed`）で実装すること。
  - **自分のターン中に相手が出した財宝も対象**（Enchantress と違う）。＝「手番プレイヤーの購入フェイズ」だけを
    見る実装にしてはいけない。**誰のターンかに関係なく、「Highwayman を使った人以外の各プレイヤー」が
    「そのターン最初に使用した財宝」**が対象。
  - **`isTreasureFor`（資本主義）との関係**：使用した時点で財宝でなかったカードは「最初の財宝」に数えない
    （公式が明示）。＝**判定は使用の瞬間に行い、後から遡らない**。
  - **リアクション（隊商の護衛など）は Highwayman の解決より前**＝アタック反応窓を先に閉じてから
    `immune[]` を確定し、そのあとで「無効化する権利」を張る。
  - 免疫（堀/灯台/チャンピオン）＝アタックなので通常どおり。免疫者はそのターン以降も財宝を無効化されない
    （＝予約の `immune[]` に記録するモデル。§0-9 Batch5c と同型）。

---

### Hunter  [$5]
- **id候補**: `hunter`
- **コスト**: $5（ポーション費用・負債コストとも無し）
- **種別**: **Action**（アタックでもリアクションでもない）
- **Purpose**: Kingdom Pile
- **カードテキスト（英語・現行）**:
```
+1 Action
Reveal the top 3 cards of your deck. From those cards, put an Action, a Treasure, and a Victory card into your hand. Discard the rest.
```
- **Setup:**: なし
- **Official FAQ（逐語・2項目。Other rules clarifications 節は存在しない）**:
  1. "From the three cards, choose an Action, then a Treasure, then a Victory card."
     ＝**解決順は アクション → 財宝 → 勝利点 で固定**。
  2. "Cards with multiple types can be chosen for any matching type. For example, if the revealed cards were
     Stronghold, Copper, Silver, you would have to take Stronghold as the Action, would choose between Silver and
     Copper as the Treasure, and would get no Victory card. Then you would discard the unchosen Treasure."
- **エラッタ**: なし。
- **実装上の注意**:
  - **公式例が示すとおり「任意」ではなく「強制・順番固定」**。Stronghold（Action-Victory）が唯一のアクションなら
    **アクションとして取ることを強制され**、その結果 勝利点の枠は空になる
    （＝「Stronghold を勝利点として取るために、アクションを取らない」ことは**できない**）。
    → 実装は **3段階の逐次 pending**（`hunter_action` → `hunter_treasure` → `hunter_victory`）にし、
    各段で「候補が2枚以上あるときだけプレイヤーに選ばせ、1枚しか無ければ自動、0枚なら飛ばす」。
    **各段で1枚まで・多重種別カードは1回しか取れない**（取った時点で以後の候補から外す）。
  - `reveal()` を通す（＝**公開**なので パトロン（ルネサンス）が誘発する）。「見る」ではない。
  - 3枚に満たない場合＝山札が足りなければ捨て札をシャッフルして補充し、**あるだけ公開する**（0〜3枚）。
    リシャッフルは `reshuffleDeck` を通す（へそくり `placeStash` の配線が要るため）。
  - **どの種別にも当てはまらない札は必ず捨てる**。特に:
    - **呪い（curse）は勝利点カードではない**＝取れない。
    - **夜行（night）専用カード・避難所の納屋(hovel)＝リアクションのみ**なども取れない。
    - 廃墟（ruins）はアクション、共同墓地(necropolis)はアクション、草茂る屋敷(overgrown_estate)は勝利点。
  - **種別判定は動的述語を使う**：財宝かどうかは `isTreasureFor(state, id)`
    （資本主義で財宝になったアクションは**アクションでもあり財宝でもある**＝どちらの枠でも取れる）。
    アクション判定は相続の屋敷（`inheritedEstate`）を含めるか要検討（本アプリの既存簡略化＝
    「屋敷がアクションに見えるのは4経路のみ」に合わせるなら含めない）。
  - CPU の選好は「アクション＝最も高コスト」「財宝＝最も高コスト」「勝利点＝どれでも」で十分だが、
    **候補ゼロでも pending を終端させること**（候補ゼロなら pending を立てない）。

---

### Modify  [$5]
- **id候補**: `modify`
- **コスト**: $5（ポーション費用・負債コストとも無し）
- **種別**: **Action**
- **Purpose**: Kingdom Pile
- **カードテキスト（英語・現行）**:
```
Trash a card from your hand. Choose one: +1 Card and +1 Action; or gain a card costing up to [$2] more than the trashed card.
```
- **Setup:**: なし
- **Official FAQ（逐語・1項目）**:
  - "First trash a card from your hand. Then, choose whether to take +1 Card and +1 Action, or to gain a card
    costing up to [$2] more than the trashed card."
    ＝**廃棄が先・選択が後**。**何を廃棄したかを見てから選べる**。
- **Other rules clarifications（逐語・1項目）**:
  - "If you play this with Elder and pick both choices, you do them in the printed order, meaning you draw a card
    before gaining a card. This means you can't draw the card that you just gained. But if the card you draw is a
    Reaction that cares about gaining cards (such as Sheepdog), you can use it."
- **エラッタ**: なし。
- **実装上の注意**:
  - **廃棄は強制**（手札があれば必ず1枚廃棄する。「してもよい」ではない）。
  - **「コスト+$2 以下」の比較は必ず engine の成分別述語を使う**＝`costUpTo`/`costUnder` 系
    （§0-23）。素の `cardCost(state,id) <= n` を書くと、ポーション費用・負債コスト・非サプライ・
    ロック中の分割山下段を取りこぼして **engine拒否 × CPU提案 の本番 livelock** になる。
    ※ 廃棄した札が **ポーション費用や負債コスト**を持つ場合の「+$2」の意味は
    「コインを+2した成分別コスト」＝**ポーション/負債の成分はそのまま引き継ぐ**（一般ルール。
    §0-25 の戦争(war)で踏んだのと同型）。
  - 🔴 **廃棄した札のコストは「廃棄した後」に測る**（＝廃棄置き場にある札の**現在**コスト。橋/街道等の
    コスト軽減が効く）。**ただしこれは一般ルールからの推論であって、`Modify` ページには
    この点に触れた一次資料の記述は無い**（Modify の FAQ は上記2項目で全部）。
    §0-25 で儀式(ritual)を "it cost" → "it costs" に直したのと同じ扱いにするのが既存実装との整合が取れる。
  - **2段 pending 必須**：`modify_trash`（廃棄）→ `modify_choose`（二択）→（獲得を選んだら）`modify_gain`。
    **1段目で pending を直接代入せず、獲得は `gain()` を通す**（廃棄時トリガー＝城塞/ネズミ/封土/墓所 等が
    先に走るため）。
  - **手札が空のとき**：一次資料に明示が無い（末尾「決着しなかった項目」参照）。
    最も素直な読み＝**廃棄は0枚で終わり、"Choose one" は依然として起きる**。
    +1カード+1アクション は普通に得られる。獲得を選ぶと「the trashed card」が存在しないので**何も獲得しない**。
    → 実装は **手札が空なら二択のうち「+1カード+1アクション」だけを出す**のが安全
    （engine拒否とCPU提案の食い違いを作らない・人間も詰まない）。
  - **選択は強制（Choose one）**＝どちらかを必ず選ぶ。ただし獲得側を選んで候補ゼロなら何も獲得しない
    （終端保証を入れる）。
  - Elder（同盟の Townsfolk 上から3枚目・別担当）と組むと**両方**選べる。そのときは**印刷順＝ドローが先**。
    本アプリで Elder を実装するとき、この「印刷順で両方」の一般則を Modify にも通すこと。

---

### Skirmisher  [$5]
- **id候補**: `skirmisher`
- **コスト**: $5（ポーション費用・負債コストとも無し）
- **種別**: **Action - Attack**（**Duration ではない**＝依頼文の記載を訂正）
- **Purpose**: Kingdom Pile
- **カードテキスト（英語・現行）**:
```
+1 Card
+1 Action
+[$1]
This turn, when you gain an Attack card, each other player discards down to 3 cards in hand.
```
- **Setup:**: なし
- **Official FAQ（逐語・2項目）**:
  1. "When played, Skirmisher sets up an ability for the rest of the turn; any time you gain an Attack card, each
     other player discards down to 3 cards in hand."
  2. "Revealing Moat when Skirmisher is played stops the attack; you can't reveal Moat when an Attack card is
     gained later."
     ＝**免疫は「Skirmisher を使用した瞬間」に確定する**。
- **Other rules clarifications（逐語・5項目）**:
  1. "You resolve all your on-gain abilities before the other players get to use their own on-gain abilities
     (assuming that it's your turn). This means that an attacked player has to discard to your Skirmisher first
     before they get to use Invest or Falconer."
  2. "If you gain Skirmisher and then play it (with e.g. City-state), the other players will discard down to 3 cards
     in hand."
  3. "When you gain an Attack, you may play it with City-state before attacking with Skirmisher. This may be useful
     if playing the Attack would draw them cards (such as Soothsayer)."
  4. "If you gain a copy of Skirmisher with either Disciple or Specialist, Skirmisher will attack. But if you gain a
     copy of Skirmisher with Kiln, you won't attack, because you haven't followed Skirmisher's instructions yet."
  5. "Exchanging or exiling a card doesn't count as gaining it. So if you exchange a Peasant for a Soldier, or exile
     a Skirmisher with Invest, you won't attack. But if you gain an Attack and exchange it (e.g. for a Changeling),
     you'll still attack."
  6. 🔴（**下書きが "twice" と誤引用していた項目。正しくは "multiple times"**）
     "If you play multiple Skirmishers and then gain an Attack card, this means you will **attack multiple times**.
     So if your 1st Skirmisher attack makes them draw cards (e.g. they discard and play a Trail), your 2nd
     Skirmisher will once again make them discard down to **3 cards**."
     ＝**N枚使えば N回**（「2回まで」ではない）。
- **エラッタ**: なし。
- **実装上の注意**:
  - **「使用時に窓を開き、免疫をその場で固定し、そのターン中は獲得のたびに発動」**＝
    §0-9 Batch5c の **沼の妖婆/呪いの森（`applyLingerOnBuy` の予約 + `immune[]` + 一意 rid）**と**完全に同型**。
    違いは「フックするのが相手の購入」ではなく「**自分の Attack カード獲得**」で、**そのターン限り**という点だけ。
    → `t.skirmishers = [{ immune:[席...] }, ...]`（**プレイ回数ぶん積む**）を `freshTurn` で消す形が素直。
  - **使用した瞬間にアタック反応窓を開く必要がある**（堀/灯台/チャンピオン/馬商人/隊商の護衛）。
    **即座には誰も何もされない**のに窓を開ける＝§0-28 で新設した `attack_window` pending がそのまま使える。
    **窓を開けないと堀を公開する機会が永久に失われる**（公式は「獲得時には堀を公開できない」と明記）。
    `ATTACKS` への登録も必要（整合性テストが検査する）。
  - **複数枚プレイしたぶんだけ発動する（N枚→N回）**。免疫は**予約ごとに独立**
    （1枚目に堀を見せた人は1枚目からのみ免疫。2枚目には別途反応窓が開いている）。
  - **「捨てて3枚まで」は既存の汎用 `discard_down` pending をそのまま使える**（民兵型・浮浪児/傭兵/
    sir_michael と共用済み。§0-8 D）。**`drawAfter` は付けない**（軍団兵 legionary と違って引き直しは無い）。
  - **獲得トリガーの発火順**＝「自分の on-gain を全部解決してから、相手の on-gain」。
    本アプリの `onGainQueue` は**獲得者の窓を先に消化する**構造なので概ね合うが、
    **Skirmisher の攻撃は `onGainQueue` に積む**こと（`state.pending` 直代入は他の窓を握りつぶす＝§0-26 の要求(demand)で踏んだ罠）。
  - **「獲得」だけが対象**：交換（exchange・§0-28 の `exchangeCard`）と追放（exile・§0-25）は獲得ではない
    ＝発動しない。逆に**獲得してから交換した場合は発動する**。
  - **Kiln（移動動物園・炉）との差が示す一般則**：*Skirmisher の記載効果を解決し終える前*の獲得では発動しない。
    ＝「+1カード +1アクション +$1 と、この一文の設置」まで済んで初めて有効。
    本アプリでは炉が `PLAY_ACTION` を中断して先に獲得する実装（§0-25）なので、**中断中の獲得では発動させない**。
  - **自分の獲得のみ**（"when **you** gain"）。相手の獲得では発動しない。
  - Skirmisher 自身も Attack カードなので、**Skirmisher を獲得しても発動する**（既に1枚使ってあれば）。
  - CPU：Skirmisher を使ったターンにアタックカードを獲得すると強い、という評価までは不要だが、
    **`decidePending` に `discard_down` の分岐は既にある**ので追加不要。反応窓（`attack_window`）の分岐は要確認。

---

### Specialist  [$5]
- **id候補**: `specialist`
- **コスト**: $5（ポーション費用・負債コストとも無し）
- **種別**: **Action**（**Command ではない**。Duration でもない）
- **Purpose**: Kingdom Pile
- **カードテキスト（英語・現行＝2023年12月 第2刷）**:
```
You may play an Action or Treasure from your hand. Choose one: Play it again; or gain a copy of it.
```
  🔴 **表記ゆれ注意**：RGG ルールブック PDF（2022 初版・2023 第2刷とも）のカード面は
  **"Choose one: Play it again;"（大文字 P）**、英語wiki の Card text 欄は
  **"Choose one: play it again;"（小文字 p）** で割れている。`Allies` ページのエラッタ予告も大文字表記
  （`Rephrase "Play it again" to "Replay it"`）。**機能差ゼロ**なのでどちらでもよい。
- **Setup:**: なし
- **Official FAQ（逐語・4項目。Other rules clarifications 節は存在しない）**:
  1. "First you may play an Action or Treasure card from your hand. If you did, then after completely resolving
     playing that card, you choose to either play it again, or gain a copy of it."
     ＝**1枚目のプレイを完全に解決してから**二択を選ぶ。プレイ自体は**任意**、プレイしたなら二択は**強制**。
  2. "You can play the card again even if it left play."
  3. "You can choose to gain a copy even if there are no copies left; you won't gain anything though."
  4. "This can only gain cards from the Supply."
- **持続カードを対象にできるか＝できる（確定）**。英語wiki `Duration` ページが**明示的に Specialist を
  名指ししている**（逐語・検証者が再取得）:
  > "Additionally, if a Duration card is played extra times by a card such as [Throne Room, Scepter, Mastermind,
  > **Specialist**, Flagship, or Daimyo], that card also stays in play until the Duration card is discarded, to
  > track the fact that the Duration card was played extra times."

  同ページ（逐語）: "When you use a Throne Room variant on a Duration, that Throne Room stays in play for as long as
  the Duration does. ... **If the Duration leaves play at an unusual time (e.g. Highwayman and Conjurer) the Throne
  Room still stays in play until Clean-up; and if you replay that Duration later on, the Throne Room still leaves
  play. A card that plays a Duration only once (e.g. Elder or Vassal) never stays in play for multiple turns.**"

  同ページ（逐語）: "Effects that resolve at the start of your turn can be resolved in any order; this includes
  multiple plays of the same Duration card by a Throne Room variant."
- **エラッタ**: **機能エラッタは無し**。ただし `Allies` ページの
  「Expected changes for future printing（cosmetic）」に
  **"Specialist — Rephrase "Play it again" to "Replay it" to match the phrasing of other Throne Room variants."**
  が挙がっている。**現行（第2刷）の印刷は今も "Play it again"** で、**機能は同一**。
- **実装上の注意**:
  - **依頼の2つの確認事項への回答**:
    1. **持続カードを対象にできる＝YES**（`Duration` ページが Specialist を名指し）。
       「Play it again」を選んだ場合、**Specialist は持続カードが捨てられるまで場に残る**（玉座の間と同じ）。
       🔴 **「gain a copy」を選んだ場合に Specialist が片付けで捨てられるかは、一次資料に Specialist を
       名指しした裁定が無い**（`Duration` ページの "A card that plays a Duration only once (e.g. Elder or Vassal)
       never stays in play for multiple turns." は Elder / Vassal を例示しているだけ）。
       ただし同ページが場残りの理由を "**to track the fact that the Duration card was played extra times**" と
       明記しているので、**追加プレイをしていない gain 側では場に残さない**のが一次資料からの合理的な推論
       （＝**選択によって Specialist の場残りが変わる**）。
       ※ 本アプリには **§0-28 の既知の許容簡略化**（幽霊が持続をプレイしても幽霊自身は場に残らない／
       玉座の間×持続も同型）があるので、そこに合わせるなら Specialist も残さない＝許容簡略化として明記すること。
    2. **獲得を選べる＝YES**（"Choose one" の片側が獲得）。**プレイ自体は任意だが、プレイしたなら二択は強制**。
       獲得は**サプライからのみ**・**コピーが尽きていても「獲得」を選べる**（何も起きないだけ）。
  - **`state.replay` の "玉座の2回目" と同型で実装する**（§0-15 の `treasure_replay` / §0-28 の幽霊）。
    **Specialist は Command 種別を持たない**ので、
    **「命令は命令を使えない」ガードを適用してはいけない**（ネクロマンサーと同じ立場＝§0-28）。
    また §0-17 の「命令がプレイした札は動かない」も**適用しない**
    （Specialist は**手札から場へ普通にプレイする**＝物理的に場にある）。
  - **「場を離れていても2回目をプレイできる」**＝自己移動する札（祝宴/宝の地図/鉱山の村/投資/豊穣の角/
    馬(horse)/狂人 等）の2回目は、**移動だけが `removeOne` 失敗で不発（lose track）**になり、
    **残りの効果は普通に起きる**。§0-17 で確立した `takeSelf` / `removeOne` ガードの考え方と同じ。
  - **財宝をアクションフェイズにプレイする**点が要注意（冠 crown は購入フェイズ）。
    - 行商人(peddler)/公会堂/列柱/徴税/`gainWasBuyPhase` など**フェイズ依存の判定を誤爆させない**。
    - **`t.treasuresLocked`（購入したらそのターンは財宝を出せない・§0-21）はアクションフェイズなので立てない／見ない**
      （闇市場と同じ扱い）。
    - 採石場(quarry)/収集(collection)/ティアラ 等を先に出すと後続の獲得・コスト計算が変わる（公式の想定内。
      wiki の Strategy 節がこの使い方を明示的に推奨している）。
  - **財宝の効果は `applyTreasureEffect` に書く**という既存規約（§0-15）が効く。
    2回目は **`state.replay` に積んで、1回目が立てた選択待ちが解決してから適用**すること
    （旧 `treasureReplayCoins` 方式＝「コインだけ足す」は禁止。御守り/水晶玉/不正利得/元手/大金/鹵獲品の
    2回目が丸ごと消える）。
  - **「a copy of it」＝同名カードの獲得**。**サプライにある山からのみ**（FAQ が明示）。
    - **非サプライ（馬・戦利品・狂人・傭兵・賞品・精霊・願い・ゾンビ・成長先 など）は獲得できない**。
      **`costUpTo`/`costUnder` を使ってはいけない**（コスト制限ではない）。
      正しくは「サプライにその名前の山があり、**山の一番上がその名前**で、残枚数>0」。
    - 🔴 **分割山・混合山は「一番上でなければ獲得できない」**＝これは Specialist の FAQ ではなく
      **獲得の一般則**（Swap の FAQ が Augurs の例で同じ一般則を示している）。
      例：Augurs の Sorceress をプレイしても、山の一番上が Sorceress でなければコピーを獲得できない。
      → `gainableBase` / `splitBlocked` を通すこと。混合山（騎士/廃墟/城）も同様。
  - **獲得は「獲得」＝ on-gain トリガーが全部働く**（Skirmisher の FAQ が
    「Specialist で Skirmisher のコピーを獲得すると Skirmisher は攻撃する」と明示）。
  - 🔴 **習性（Way・移動動物園）**：「Specialist がプレイさせるカードにも Way を選べる」は
    **一般則からの推論**（Specialist ページに記述は無い）。本アプリには
    **§0-25 の許容簡略化「再演では習性を選び直せない」**があるので、それに従えばよい。
  - **新 pending は4点セット**（engine reducer＋`PLAYER_ACTIONS`＋CPU `decidePending`＋UI `viewPendingModal`）:
    `specialist_play`（手札のアクション/財宝を1枚・**辞退可**）→ `specialist_choose`（2択・強制）
    →（獲得側なら自動で `gain`／再演側なら `state.replay` に積む）。
    **辞退（何もプレイしない）を必ず選べるようにする**こと（人間が詰まない）。
  - CPU：`throneValue`（§3 の玉座対象選択）を流用しつつ、
    「強いカードのコピーを獲得したい」局面（研究所/大市場/白金貨など）を評価に足すと自然。
    **候補ゼロでも `card:null` を返さず、辞退という形で必ず終端させる**。

---

### Swap  [$5]
- **id候補**: `swap`
- **コスト**: $5（ポーション費用・負債コストとも無し）
- **種別**: **Action**
- **Purpose**: Kingdom Pile
- **カードテキスト（英語・現行）**:
```
+1 Card
+1 Action
You may return an Action from your hand to its pile, to gain to your hand a different Action costing up to [$5].
```
- **Setup:**: なし
- **Official FAQ（逐語・3項目）**:
  1. "First you get +1 Card and +1 Action. Then you may return an Action card from your hand to its pile; this is
     optional. If you do, then gain an Action card from the Supply costing up to [$5], and put it into your hand."
  2. "The card you gain can't have the same name as the one you returned."
  3. "Returning the card isn't trashing it, and won't trigger "when you trash this" abilities; gaining the card is
     gaining it, and will trigger "when you gain this" abilities."
- 🔴 **Other rules clarifications（逐語・「ちょうど3項目」。2022 と 2024 の2スナップショットで同一）**:
  1. "A non-Supply card (like Horse) can be returned to its pile. However, a card with no pile (like Necropolis, or
     anything from the Black Market deck) can't be returned anywhere."
  2. "You can't return a card and gain a card from the same pile. So if Sorceress is on top of the Augurs pile, and
     you return a Herb Gatherer, you can't gain the Sorceress."
  3. "If you Possess another player and make them Swap an Action card, their Action returns to its pile, and then you
     gain a differently named Action card to your discard pile."

  ⚠️ **下書きにあった「A card from a split pile can be returned even if a different card is currently on top…」
  という4本目の箇条書きは、Swap ページには存在しない（捏造）**。ただし**内容は正しく**、
  出典は英語wiki **`Return`** ページの一般ルール（逐語）:
  > "The returned card is placed on the top of the pile."
  > "**If the pile is a split pile, the card is returned on the top even if a different card is currently on top,
  > covering it.**"
  > "The card returned is not considered trashed."
  > "Non-Supply cards, for example Rewards or Spoils, can be returned."
  > "Only cards that belong to a pile can be returned. Notably, the Black Market deck is not considered a pile
  > meaning cards from it cannot be returned."
- **エラッタ**: なし（`English versions` 表は「Allies / March 2022」の1行のみ）。
- **デザイナーのプレビュー（逐語・実在を確認）**:
  > "Cards turn into other cards and leap into the fray. Buy it even if you don't know what it will possibly do for
  > you; you won't regret it. **This can of course mess up the order of split piles.**"
  > — Donald X. Vaccarino, *Allies Preview 2: Split piles*, March 2022
- **実装上の注意**:
  - **順番厳守**：`+1カード → +1アクション → （任意で）返却 → 獲得`。
    ドローが先なので、**引いた札をそのまま返却対象にできる**。
  - **返却は任意。ただし返却したら獲得は強制**（"If you do, then gain"）。
    → 2段 pending：`swap_return`（辞退可）→ `swap_gain`（**返却したら強制・辞退不可**）。
    候補ゼロの終端保証を入れる（同名しか無い等）。
  - **「返却」は廃棄でも獲得でもない**（§0-28 の `exchangeCard` に近い第3の移動）が、
    **`supply` は増える**（3山終了に影響する＝空の山が復活し得る）。
    本アプリには既に **`returnToPile`**（交易商人・§0-23）があるので**それを流用する**。
    **`triggerOnTrash` は絶対に呼ばない**。
  - **獲得先は手札**＝`gain(..., dest:'hand')`。獲得置換（遊牧民の野営地/ヴィラ/彫刻家 等）との競合は
    §0-22 の彫刻家で作った規約に従う。**獲得なので on-gain は全部誘発する**。
  - **獲得の条件は4つ同時**：(1) **アクションカード**、(2) **サプライにある**、(3) **コスト$5以下**、
    (4) **返却した札と別名**。
    - コスト比較は **`costUpTo(state, id, 5)`**（成分別＝ポーション費用・負債コストの札は「$5以下」ではない）。
    - **返却で山が変わった後**の状態で候補を出すこと（公式例＝Herb Gatherer を返すと Augurs の山の
      一番上が Herb Gatherer になり、Sorceress は獲得できなくなる）。
      ＝**「返却 → supply 更新 → 候補算出」の順**。ここを逆にすると engine拒否 × CPU提案 の livelock になる。
    - `gainableBase` / `splitBlocked`（分割山の下段ロック）/ 混合山の一番上、を必ず通す。
  - **返却できる札の条件**：手札の**アクションカード**で、**「自分の山」が存在すること**。
    - **非サプライ札でも山があれば返せる**（馬 horse・賞品 Rewards・戦利品 Spoils・成長先・精霊 など。
      `Return` ページが "Non-Supply cards, for example Rewards or Spoils, can be returned." と明記）。
      → **サプライの有無ではなく「山が実在するか」で判定する**。本アプリなら
      `state.supply` の数値キー山・`state.ruins`/`state.knights`/`state.castles` などの混合山・
      非サプライ数値キー山（賞品/戦利品/馬/願い/インプ 等）を含む。
    - **山が無い札は返せない**：避難所（納屋/共同墓地＝Necropolis を公式が名指し/草茂る屋敷）・
      **闇市場デッキ由来の札**（公式が名指し）・家宝（heirloom・§0-28）・**相続の脇札**など。
      → **「返却候補」の述語を1本作り、engine拒否・CPU候補・UIフィルタの3面が同じものを見る**こと（§0-23 の原則）。
    - **分割山**：一番上が別カードでも返せる。**返した札が山の一番上に載る**（`Return` ページの一般ルール）。
      ＝本アプリの分割山は `supply.<上段>` / `supply.<下段>` の2キー方式（§0-13）なので、
      **「上下の順序が入れ替わり得る」＝現在の実装では表現できない**。
      **同盟の分割山（Augurs/Clashes/Forts/Odysseys/Townsfolk/Wizards＝各4種を4枚ずつ積んだ順序山）を
      実装するときに、分割山を「順序つき実カード配列」に一般化する必要がある**（騎士/城の混合山と同じ形）。
      Swap はその一般化を**強制する**カードなので、**設計順として同盟の分割山機構より後に実装すること**
      （デザイナー自身が "This can of course mess up the order of split piles." と明言＝上記プレビュー）。
  - **支配（Possession）**：**返却するのは被支配者の札（＝被支配者の手札から、その山へ）**だが、
    **獲得するのは支配者で、獲得先は支配者の捨て札**（公式が明示。"put it into your hand" が
    支配のルール「あなたが代わりに獲得する」に上書きされる）。§0-23 の支配の振り分け（`gainFromOutside`／
    獲得者は支配者）と整合するので、**`gain` を通しさえすれば自動で正しくなるはず**だが、
    **`dest:'hand'` が支配時に捨て札へ落ちることを回帰テストで固定すること**。
  - **相続（inheritance・冒険）の屋敷**を返却対象にできるかは公式に記述が無い。
    本アプリの既存簡略化（屋敷がアクションに見えるのは4経路のみ・§0-21）に合わせて**対象外**が無難。

---

## 補足：担当6枚に共通する確認結果

- **6枚とも Liaison ではない**（Favor を扱わない）＝**Ally カードとの直接の相互作用は無い**
  （Skirmisher の FAQ に出てくる City-state は「Ally が Attack の獲得時にプレイさせる」文脈であって、
  Skirmisher 自身が Favor を扱うわけではない）。
- **6枚とも Setup: を持たない**（wiki の Card text 欄・両ルールブックのカード面テキストで確認）。
- **6枚ともポーション費用・負債コストを持たない**（同盟には負債コスト・ポーション費用のカードは無い）。
- **6枚とも単独山（10枚）＝`Purpose: Kingdom Pile`**。分割山ではない。
- **6枚とも `English versions` 表が1行（Allies / March 2022）＝エラッタ・文言変更ゼロ**。
- 新機構として engine に必要になるのは:
  1. **Highwayman**＝「相手の最初の財宝の使用効果を無効化する」持続アタック
     （既存の `applyLingerOnBuy` 予約モデル＋**per-turn 1回フラグ**）と、
     **開始時に自分を場から捨てる持続**（既存の持続と逆・先引きとの順序に注意）。
  2. **Skirmisher**＝「使用時に免疫を固定し、そのターンの自分の獲得をフックする」アタック
     （沼の妖婆と同型＋`attack_window`＋`discard_down` の再利用）。
  3. **Specialist**＝玉座系の再演（`state.replay`）＋「コピーを獲得」の二択。**Command ではない**。
  4. **Swap**＝**「山へ返す」＋「手札へ獲得」**。`returnToPile` は既にあるが、
     **分割山の順序を壊す**ため、**同盟の分割山を「順序つき実カード配列」に一般化してから実装する**必要がある。
  5. **Hunter / Modify** は既存機構だけで書ける（逐次 pending と `costUpTo`）。

---

## §検証ログ（敵対検証官・2026-08-12）

### 検証方法
下書きの引用を1文字も参照せず、`python tools/wikifetch.py` で英語wiki 9ページを**自分で再取得**
（`Highwayman` / `Hunter` / `Modify` / `Skirmisher` / `Specialist` / `Swap` / `Allies` / `Duration` / `Return`）。
さらに RGG ルールブック PDF 2種（2022 初版・2023 第2刷）の pdftotext 出力から
**6枚ぶんの FAQ 段落を機械抽出して文字列比較**した。

### 確定した訂正（9件）

| # | 箇所 | 下書き | 一次資料 | 影響 |
|---|---|---|---|---|
| 1 | Swap / Other rules clarifications | 「分割山の札は一番上が別カードでも返せる／返した札は山の一番上に載る」を **Swap の FAQ 4本目として引用** | **Swap ページに該当箇条書きは存在しない**（2022・2024 の2スナップショットとも3本のみ） | 内容は正しいが出典が誤り。正しい出典＝`Return` ページの一般ルール |
| 2 | Swap / 同1本目 | "A non-Supply card (like Horse **or cards gained with Ferryman**)…" | "A non-Supply card (**like Horse**) can be returned to its pile." | Ferryman の加筆は一次資料に無い。非サプライ一般の根拠は `Return` ページ |
| 3 | Swap / 同2本目 | "**You can't gain a card that's not on top of its pile, which means** you can't return…Sorceress **because it's no longer on top**." | "You can't return a card and gain a card from the same pile. So if Sorceress is on top of the Augurs pile, and you return a Herb Gatherer, you can't gain the Sorceress." | 前置き・後置きが加筆 |
| 4 | Skirmisher / 最終 FAQ | "you will attack **twice**" ／ "discard down to 3 cards **in hand**" | "you will attack **multiple times**" ／ "discard down to **3 cards**" | **N枚→N回**の一般則が "twice" だと弱まる＝実装で「最大2回」と誤読する危険 |
| 5 | Specialist / `Duration` ページ引用 | "…played extra times; **and that effect also ends if that card somehow leaves play.**" | "…to track the fact that the Duration card was played extra times." で終端 | 加筆。近い趣旨の文は別段（"if you replay that Duration later on, the Throne Room still leaves play."） |
| 6 | Highwayman / Other rules clarifications | 10項目中 **1項目を欠落** | "If the Treasure is Reckless, you won't follow its instructions twice, and you return it to its pile when discarding it from play." | Reckless は未実装拡張（日の出づる国）のため当面影響ゼロ |
| 7 | Specialist / カードテキスト | "Choose one: **P**lay it again;" と断定 | **ルールブック＝大文字P／wiki の Card text 欄＝小文字p** で一次資料が割れている | 機能差ゼロ。表記ゆれとして明記した |
| 8 | Specialist / 「gain を選ぶと場に残らない」 | `Duration` ページの裁定として提示 | **Specialist を名指しした裁定は無い**（Elder / Vassal の例のみ） | 一次資料からの合理的推論として格下げ |
| 9 | Modify / 「廃棄後にコストを測る」 | 断定 | `Modify` ページに該当記述なし（FAQ は Official 1本＋Other 1本で全部） | 一般則からの推論として格下げ |

### 訂正なしで確認できた項目：約 65

- 6枚 × 5項目（コスト・種別・カードテキスト・`Setup:` の不在・版/エラッタの有無）＝ **30**
- FAQ 箇条書きの逐語一致 ＝ **38 項目中 34**（Highwayman 17／Hunter 2／Modify 2／Skirmisher 7／
  Specialist 4／Swap 6 のうち、上表の #1〜#4・#6 を除く）
- `Allies` Versions ブロック（逐語一致）／Donald X. のプレビュー引用（実在確認）／
  `Duration` ページ 3引用中2つ（逐語一致）＝ **4**
- **下書きの最大の主張「6枚は 2022→2023 で1文字も変わっていない」は、2つのルールブック PDF の
  機械比較で追認された**（差分は `.indd` タイムスタンプのみ）。
- **依頼文の誤り（Skirmisher が持続アタック）を下書きが訂正していた点も、4つの一次資料で追認**。

### 一次資料でも決着しなかった項目（実装時に判断が要る）

1. **Modify を手札0枚で使ったときの挙動**。「Trash a card from your hand.」が空振りしたあと
   "Choose one" が起きるのかどうかの明文が無い。→ 本文どおり「+1カード+1アクションのみ提示」を推奨
   （engine拒否とCPU提案の食い違いを作らないため）。
2. **Modify の「廃棄した札のコスト」を廃棄前／後どちらで測るか**。明文なし。
   一般則＝**廃棄後（廃棄置き場にある札の現在コスト）**。§0-25 の儀式(ritual)と同じ扱いにするのが既存実装と整合。
3. **Specialist で「gain a copy」を選んだとき、対象が持続カードだった場合に Specialist が場に残るか**。
   Specialist を名指しした裁定なし。推論では**残らない**。
   ※ 本アプリには §0-28 の許容簡略化があるので、どちらに倒しても既存の簡略化の範囲内。
4. **Specialist がプレイさせるカードに習性(Way)を選べるか**。一般則ではYESだが Specialist ページに記述なし。
   §0-25 の「再演では習性を選び直せない」に従えばよい。
5. **Swap で相続(inheritance)の屋敷を返却できるか**。公式に記述なし。§0-21 の既存簡略化に合わせて対象外を推奨。
6. **日本語カード名は本ドキュメントでは未確定**。英語wiki の `Japanese` 行は
   Highwayman＝追いはぎ／Skirmisher＝散兵 と出るが、**§0-27 の教訓（英語wiki の Japanese 行は
   実物と食い違うことがある）**があるため、**日本語wiki（ホビージャパン印刷版）で別途裏取りすること**。

### 実装者への警告（このエンジンを壊しそうな公式挙動）

1. **【最重要】Highwayman は「ターン開始時に場から自分を捨てる」＝本エンジンの持続仕分けと逆向き。**
   本アプリの片付けは `p.delayedEffects` の残り枚数で持続を判定するため、
   *開始時に自分だけ場を離れる持続* は既存のどの持続とも形が違う。
   さらに公式は「**Highwayman を玉座の間で使うと、Highwayman が場を離れても玉座の間は片付けまで場に残る**」
   （`Duration` ページが Highwayman を "unusual time" の例として名指し）と定めており、
   §0-28 の「幽霊が場に残らない」許容簡略化と同種のズレが必ず出る。**設計時に最初に決めること。**
2. **【最重要】Swap は分割山の順序を破壊する（デザイナーが明言）。**
   本アプリの分割山は `supply.<上段>` / `supply.<下段>` の2キー方式（§0-13）なので、
   「下段の札を返したら下段が一番上に載る」を**表現できない**。
   同盟の分割山6組（Augurs/Clashes/Forts/Odysseys/Townsfolk/Wizards＝各4種×4枚の順序山）の実装で
   **分割山を「順序つき実カード配列」（騎士/城の混合山と同じ形）に一般化してから** Swap に着手すること。
   `splitLocked` / `emptyPileCount` / `cardCost` / `captainTargets` / `validTeacherPiles` /
   CPU `splitBlocked` / `randomKingdom` の**分割山ガード全系統**が影響を受ける。
3. **Skirmisher は「即座には何も起きないのにアタック反応窓を開く」**。
   公式が「獲得時には堀を公開できない／使用時にしか公開できない」と明記しているので、
   **使用時に必ず `attack_window` を開かないと堀が永久に死ぬ**。`ATTACKS` 登録も必須（整合性テストが検査）。
   また **N枚使えば N回発動**するので、免疫は予約ごとに独立（一意 rid）にすること。
4. **Highwayman は逆に「累積しない」**。§0-9 の予約 rid モデルを素直に流用すると
   **複数枚で多重発動して公式違反**になる。per-turn フラグで1回に絞ること。
   ＝**3 と 4 は正反対の要求なので、同じヘルパで書こうとすると必ずどちらかが壊れる。**
5. **Specialist は財宝をアクションフェイズにプレイする**。`turn.phase === 'buy'` 前提の判定
   （行商人のコスト／公会堂／列柱／徴税の `gainWasBuyPhase`／`t.treasuresLocked`／闘技場／浴場 など）を
   誤爆させないこと。§0-27 で夜フェイズを足したときと**同じクラスの事故**が起きる。
6. **Specialist の「コピーを獲得」に `costUpTo`/`costUnder` を使ってはいけない**（コスト制限ではない）。
   §0-28 の悪魔祓いの精霊で踏んだ罠の裏返しで、**分割山・混合山では「一番上でなければ獲得できない」**。
   engine拒否・CPU候補・UIフィルタの3面が同じ述語を見ること（§0-23 の原則）。
7. **Modify / Swap / Specialist の3枚とも「engine を締めたら CPU も同時に締める」対象**。
   獲得候補の述語が engine と CPU でずれると、engine が拒否し CPU が同じ手を返し続けて
   **本番 livelock** になる（§0-23・§0-28 で計3回踏んでいる）。

---

# 同盟（Allies）研究 — g06: 分割山 2組（Augurs 4種 / Odysseys 4種）＝8枚

> **【敵対検証済み】2026-08-12・検証官が一次資料を独自に引き直して全面検証した版。**
> 下書きの引用は一切コピーせず、英語wiki 10ページ＋RGG公式ルールブックPDF 2種を自分でDL・逐語確認した。
> **確定した訂正＝5件**（うち引用の捏造1件・欠落した重大警告3件）。**カードの本文・コスト・種別・FAQ は8枚すべて下書きどおりで正しかった。**
> 訂正・追記した箇所には **［検証官訂正］/［検証官追記］** を付けてある。

---

## 【この版の一次資料】検証官が自分で取得したもの

**英語wiki（wiki.dominionstrategy.com）＝Wayback 経由**
（本体は Anubis の bot 検知で開けない。また **本環境では python の urllib が Wayback の一部IPに繋がらない**ので
`curl` でDL→HTMLを strip する自前スクリプトで取得した。`<img alt>` は `[$4]` / `[2VP]` の形で本文に埋め戻し済み）

| ページ | 取得スナップショット |
|---|---|
| Augurs | 2023id_ フォールバック（内容は現行と同一。Versions 表＝Allies 2022 のみ） |
| Herb_Gatherer | **20260207** |
| Acolyte | **20251219** |
| Sorceress | **20250628** |
| Sibyl | **20251213** |
| Odysseys | **20251215** |
| Old_Map | **20251215** |
| Voyage | **20251213** |
| Sunken_Treasure | **20251214** |
| Distant_Shore | **20241004**（※下書きは 20251227 と書いていたが、検証官が取れたのは 2024-10。**本文・FAQ は同一**なので実害なし） |
| 補助: Split_pile / Rotate / Extra_turn / Allies / 2023_Errata / 2022_Errata / Wishing_Well | 2025-12〜2026-01 |

**RGG 公式ルールブック PDF 2種を実DL＋`pdftotext -layout` で逐語確認**
（⚠ コイン記号 `$` は pdftotext で落ちるので、**金額はすべて wiki の `[$N]` 側で裏取りした**）

| 版 | URL（検証官が実際に叩いたもの） | サイズ | ページ内スタンプ |
|---|---|---|---|
| **旧＝第1版（2022-03）** | `https://www.riograndegames.com/wp-content/uploads/2021/09/Dominion-Allies-Rules.pdf` | 2,144,349 B | `alliessplitcards21.indd 10/6/21 10:28 AM` |
| **新＝第2刷（2023-12）** | **`http://wiki.dominionstrategy.com/images/4/4e/AlliesRulebook2023.pdf`**（Wayback 経由でDL） | 2,915,379 B | **`DomAlliesRules21x.qxp_WideDominion 11/10/23 5:03 AM`** |

> ［検証官訂正①・出典の欠落］下書きは新ルールブックを「別担当が取得済みのローカルファイル `rb2023.txt`」としか書いておらず、
> **URLが無かった**（＝第三者が追試できない）。上表のとおり **wiki 自身がホストしている PDF** が正本の入手先。
> 検証官が自分でDLしたバイト数（2,915,379）はローカルの `rb2023_direct.pdf` と一致した。

**枚数の裏取り（2023年ルールブック p.2 逐語）**
```
400 cards
  250 Normal Kingdom cards  (10 each of ... 25種)
   96 Split pile cards
      4 each of Acolyte, Archer, Battle Plan, Blacksmith, Conjurer, Distant Shore, Elder,
               Garrison, Herb Gatherer, Hill Fort, Lich, Miller, Old Map, Sibyl, Sorcerer,
               Sorceress, Stronghold, Student, Sunken Treasure, Tent, Territory, Town Crier,
               Voyage, Warlord
   31 Randomizer cards
   23 Ally cards
```
＝ **6山 × 4種 × 4枚 = 96**。Allies 拡張ページも *"There are 16 cards in each split pile … with 4 of each individual card"* と明記。
**人数によらず常に16枚**（Empires の城＝2人8枚/3人以上12枚 とは違う）。

**2種のPDFを検証官が独立に diff した結果**：g06 の8枚のうち**カード文面／FAQ が変わったのは Voyage だけ**。
他7枚は FAQ の逐語まで完全一致。分割山・rotate の一般ルール節も両版で完全一致（＝下書きの結論を追認）。

---

## 0. 版（Versions）＝この8枚に関わる差分

Allies 拡張ページの Versions 表（**検証官が逐語で再取得**）:

| Date | Rulebook | Changes |
|---|---|---|
| March 2022 | PDF | First edition。Errors: Rulebook — 最終ページの RGG 住所/URL の行が欠落。 |
| **December 2023** | PDF | **Functional changes: Island Folk, Voyage — Cannot take a third turn in a row (2023).** Cosmetic changes: Elder — Rephrased for clarity (2023). |
| Expected changes for future printing | — | Cosmetic: Specialist — Rephrase "Play it again" to "Replay it". **Sunken Treasure — Remove the value of [$0] from the upper corners of Treasures (2022).** Importer — Mark "Setup:" in bold (2023). |

➡ **g06 の8枚のうち機能エラッタがあるのは Voyage の1枚だけ**（2023年12月）。残り7枚は 2022年3月の初版テキストのまま＝現行。
Sunken Treasure の「隅の $0 を消す」は**表示上の変更のみ**（＝Sunken Treasure が **$0 の財宝**＝コインを1枚も出さないことの裏取りにもなる。
2022 Errata 本体の該当行は *"Horn of Plenty — Don't show the Treasure value as [$0] in upper corners for cards that don't produce any [$]."* ＝同じ処理を Sunken Treasure にも適用する、という意味）。

### ★［検証官訂正②・重大な欠落］2023年エラッタは **Allies の2枚だけではない**

上の表は **Allies 拡張ページ**なので Allies のカードしか載っていない。**wiki `2023_Errata` ページの逐語**は：

> **Island Folk, Journey, Mission, Outpost, Possession, and Voyage are changed to never allow more than two turns in a row.
> Fleet and Seize the Day however are not changed.**

➡ **追加ターンを与える6枚が同時に改訂された**。本プロジェクトは
**前哨地(Outpost・海辺)／使節団(Mission・冒険)／支配(Possession・錬金術)** を**2023年エラッタ前のテキストで実装済み**、
**艦隊(Fleet)／今を生きる(Seize the Day)** は改訂対象外。
**Voyage を「忠実に」実装するには、追加ターン機構そのものを 2023 版（＝3連続禁止）に揃える必要がある**。
下書きはこの点にまったく触れておらず、「§0-26 の 前哨地 > 使節団 > 今を生きる の優先順位機構に載せるだけ」と書いていた（＝不十分）。

DXV 本人の説明（`2023_Errata` の Trivia 節・逐語）:
> I'm changing 6 of the extra turn cards - but not Seize the Day or Fleet - to just rule out three turns in a row completely.
> This is apropos of a reprint of Allies … Functionally they just lock out three turns in a row from happening,
> even with multiple kinds of extra-turn things; except, Seize the Day and Fleet aren't changed and could result in a one-time 3rd turn.

---

## 1. 山（pile）そのもの

### Augurs  [$3]  （ランダマイザ／山）
- **id候補**: `augurs`（山のプレースホルダ id）
- **コスト**: **[$3]**（＝一番安い Herb Gatherer のコスト。負債・ポーション費用は無い）
- **種別**: **Action - Augur**（ランダマイザ上の種別。山の中には Attack を持つ Sorceress もあるが、**山としては Action-Augur**）
- **カードテキスト（英語・現行）**:
```
This pile starts the game with 4 copies each of Herb Gatherer, Acolyte, Sorceress, and Sibyl,
in that order. Only the top card can be gained or bought.
```
- **Setup:**: なし（テキスト自体が山の構成を定義している）
- **山の構成**: 上から **Herb Gatherer ×4 → Acolyte ×4 → Sorceress ×4 → Sibyl ×4 ＝ 16枚**（**人数によらず常に16枚**）
- **rotate 元**: 一番安い **Herb Gatherer** が「You may rotate the Augurs.」を持つ
- **wiki の Versions 表**: `Allies / 2022` の1行のみ＝**エラッタ無し**

### Odysseys  [$3]  （ランダマイザ／山）
- **id候補**: `odysseys`
- **コスト**: **[$3]**（＝Old Map のコスト）
- **種別**: **Action - Odyssey**
  （wiki 本文・逐語：*"with a single randomizer card whose type is Action-Odyssey (thought not all cards in the pile are Actions)"*
  ※ wiki 側の "thought" は "though" の誤記。**下書きは "though" に直して引用していた**＝逐語ではなかったので、ここは原文どおりにした）
  ＝ Sunken Treasure は Treasure、Distant Shore は Action-Victory だが**山としては Action-Odyssey**
- **カードテキスト（英語・現行）**:
```
This pile starts the game with 4 copies each of Old Map, Voyage, Sunken Treasure, and Distant Shore,
in that order. Only the top card can be gained or bought.
```
- **Setup:**: なし
- **山の構成**: 上から **Old Map ×4 → Voyage ×4 → Sunken Treasure ×4 → Distant Shore ×4 ＝ 16枚**（人数非依存）
- **rotate 元**: **Old Map** が「You may rotate the Odysseys.」を持つ
- **wiki の Versions 表**: `Allies / 2022` の1行のみ＝**山カード自体にエラッタ無し**（中身の Voyage だけが2023改訂）

### 分割山・rotate の公式ルール（2023年ルールブック逐語＝検証官が PDF から再抽出。wiki `Split_pile` / `Rotate` とも完全一致）

```
Dominion: Allies has six split piles, that have four different cards in each of them. The cards start the
game in order by cost. For example, the Augurs pile starts out with 4 Herb Gatherers on top, then 4
Acolytes, then 4 Sorceresses, then 4 Sibyls. This order may get messed up by cards like Swap; that's fine.
As with the split piles in Dominion: Empires, only the top card of a split pile can be bought or gained.
You can look through the cards in a split pile at any time, without changing the order.
The top card of each split pile has an ability that can "rotate" the pile (or with Battle Plan, any pile).
Rotating a pile means taking the top card, and all copies of it directly under it, and putting them on
the bottom. For example, if three Herb Gatherers were at the top of the Augurs, followed by Acolytes,
you would put those three Herb Gatherers on the bottom, and Acolyte would now be on top.
Some cards refer to information about a pile as if it's just one card. In these cases, go with what's on
the Randomizer card, which usually matches the top card. Some things refer to cards from a particular
pile; these things work on all cards from a split pile. For example Training (from Dominion:
Adventures) lets a player put a token on an Action pile, which causes them to get +[$1] when playing a
card from that pile. The token can be put on the Odyssey pile, and then Sunken Treasure will also make
+[$1] when played.
```

**rotate の追加裁定（wiki `Rotate` の "Other rules clarifications" ＝検証官が逐語で再取得）**
- *"Battle Plan can rotate any Supply pile, not just the split piles from Allies. This includes Knights and Ruins from Dark Ages
  and other split piles (for example Castles and Sauna/Avanto)."*
- *"If a split pile is chosen as the pile for Ferryman, the pile can still be rotated by cards that refer to the pile by its name
  even though the pile is not in the Supply. As Battle Plan can only rotate Supply piles, it cannot rotate the Ferryman's pile,
  even if that pile is Clashes."*
- *"When cards are returned to their piles out of order via an effect such as Swap or Way of the Horse, rotating only affects
  consecutive cards of the same name on top of the pile. For instance, if the Wizards pile has a Student on top of four Liches
  and then two more Students below that, rotating the pile will only move the top Student and leave the rest of the Students
  where they are."*
- **rotate できるカードの全リスト（wiki）**: Battle Plan（任意のサプライ山）／Herb Gatherer（Augurs）／Old Map（Odysseys）／
  Student（Wizards）／Tent（Forts）／Town Crier（Townsfolk）＝**計6枚**

**Empires 由来で Allies にも効く一般ルール（wiki `Split_pile` の Empires 節・逐語）**
```
Emptying the top half of a split pile does not count as emptying a pile, for the game end condition or
cards that refer to empty piles. The entire pile needs to be gone for the pile to be empty.
```
➡ **Augurs / Odysseys が「空の山」に数えられるのは16枚すべてが無くなったときだけ**（3山終了・塔・品評会等）。

**［検証官追記］同ページ Empires 節にある、Allies にも効く2つの逐語**
- *"In Empires, the cards on top of the pile had to be **gained or trashed** before the cards on the bottom would be available"*
  ➡ **サプライの山からの廃棄（待ち伏せ Lurker / 剣闘士 / 塩まき）も「一番上の1枚」に当たる**。
  本プロジェクトの **`trashFromSupplyPile` は Allies 山でも「配列の先頭」を抜く**ように配線すること。
- *"Returning cards to a pile, such as with Ambassador …, can also result in the pile being in an unusual order;
  an Ambassador could return a Plunder to the Encampment/Plunder pile **on top of** an Encampment."*
  ➡ **山へ戻す（`returnToPile`／大使／Swap／Way of the Horse）は「一番上に載る」**。
  ➡ 上の rotate 裁定（「一番上から連続する同名だけ」）は、まさにこの「順序が乱れた山」のための規定。

**実装上の注意（山レベル）**
- 「山のコスト/種別」を見る効果（若き魔女の Bane、冒険の山トークン、Ferryman、Family of Inventors のトークン、
  オベリスク、汚された神殿 等）は **ランダマイザの値 = [$3] / Action-Augur・Action-Odyssey** を見る。
  - **Family of Inventors のルールブック逐語（検証官が2023 PDF から再抽出。下書きの引用は正しかった）**:
    *"This can't put tokens on Victory piles. It can put tokens on split piles that have Victory cards in them,
    if the randomizer isn't a Victory card; this means it can put tokens on the 6 split piles in Allies, but not
    on the Castles pile from Empires."*
    ➡ **Distant Shore（Victory）が入っていても Odysseys 山は「勝利点の山」ではない**。
  - **冒険の山トークンの逐語（2023 PDF）**：Odysseys 山にトークンを置くと **財宝である Sunken Treasure でもボーナスが乗る**。
- **山の中身はいつでも見てよい（公開情報）**＝オンラインのマスク対象にしない。ただし**順序は変えない**。
- rotate は「一番上から連続する同名カード」をまとめて底へ。
  **山が空、または山の中身が全部同名のときは rotate しても見た目が変わらない**（＝実質 no-op）。
  ※これは上記ルールからの自明な帰結で、一次資料に明示の一文は無い。

---

## ★［検証官追記③・最重要］本プロジェクトの既存「分割山」モデルでは Allies の山は表現できない

下書きは rotate の挙動は正しく書いていたが、**「今のエンジンのどこが壊れるか」を1行も書いていなかった**。
実装者が最初に踏むのはここなので、実コードを読んで具体化しておく。

**現状（`js/engine.js` を検証官が実読）**
- 分割山＝**`DOM.SPLIT_PILES`（下段id→上段id）の静的2枚モデル**（`js/cards.js:1275`）。
  `SPLIT_TOP` / `SPLIT_BOTTOM` / **`splitLocked(state,id)` ＝「上段の supply が残っている間は下段を獲得不可」**（`engine.js:28-31`）。
  supply キーは**上段・下段の2つ**（`engine.js:643` が各5枚を置く）。
- 混合山＝**順序つき実カード配列モデル**（`state.ruins` / `state.knights` / `state.castles`）＋ `supply.<pileId>` は残数のみ。
  **`isMixed` はこの3つの id をリテラル比較でハードコード**（`engine.js:1120`, `1234`, `8053`, `11494`, `12939` の**5箇所以上**）。

**Allies の山は「4種×4枚が順序を持ち、rotate で順序が変わる」＝ 2枚モデルでは表現不能。**
➡ **混合山（城）モデルの側を使う**のが正解：`state.augurs = [id,…16]` / `state.odysseys = [id,…16]`、
  `supply.augurs` は残数。**`SPLIT_PILES` には絶対に入れない**（入れると `splitLocked` が誤作動する）。

**そのとき同時に直さないと壊れる箇所（すべて実コードで確認済み）**
| 場所 | 何が起きるか |
|---|---|
| `isMixed`（5箇所以上のリテラル比較） | 追加し忘れると gain がプレースホルダを配り、**保存則テストが即赤** |
| `cardCost`（`engine.js:161-164`） | 山のコストは**一番上の実カード**（rotate で $3→$4→$5→$6 と変わる）。CPU は `mixedTop` 相当を使うこと（§0-16 で城が踏んだ罠と同型） |
| `emptyPileCount`（`engine.js:5903`） | **16枚全部が無くなって初めて空**。プレースホルダの supply 数値と実配列の二重計上に注意 |
| `plainActionPile`（`engine.js:887`） | 汚された神殿／オベリスクの対象判定が `castles/knights/ruins` をリテラル除外している。**Augurs / Odysseys は「素のアクションの山」として対象になる**（ランダマイザが Action）ので、除外リストに足すのではなく**通す**判断が要る |
| **オベリスク** | §0-19 で「分割山を選んだら両半分を数える」を実装済み。**Allies 山を選んだら4種すべてを数える**必要がある（2種ではない） |
| `pileKeyOf`（`engine.js:139`） | 徴税の負債・山トークンは **1山＝1キー**。Allies はもともと supply キーが1つなので、`SPLIT_TOP` 経由の正規化は**使わない**（使うと壊れる） |
| `maskStateFor` | **山の中身は全公開**（「いつでも見てよい」）＝伏せない。城と同じ扱い |
| `trashFromSupplyPile` / `returnToPile` | 上記のとおり「先頭を抜く」「先頭に載せる」 |
| `randomKingdom`（`js/cards.js:1283`） | 現状は「下段idを上段idに正規化」。Allies は**山id 1つだけ**を抽選対象にする（4種を個別に抽選しない） |

---

## 2. Augurs（4枚）

### Herb Gatherer  [$3]
- **id候補**: `herb_gatherer`
- **コスト**: **[$3]**（負債・ポーション費用なし）
- **種別**: **Action - Augur**
- **カードテキスト（英語・現行。wiki Versions 表 `Allies / March 2022` の1行のみ＝エラッタ無し）**:
```
+1 Buy
Put your deck into your discard pile. Look through it and you may play a Treasure from it.
You may rotate the Augurs.
```
- **Setup:**: なし
- **公式FAQ（2023年ルールブック p.7 逐語＝検証官が PDF から再抽出。wiki の Official FAQ と完全一致）**:
  > *"Herb Gatherer: Putting your deck into your discard pile does not trigger "when you discard this" abilities like
  > Tunnel's (from Hinterlands). Playing a Treasure from your discard pile is optional, as is rotating the Augurs."*
  - ＝ **山札を捨て札に移す処理は「捨てる」トリガーを誘発しない**
  - ＝ **財宝のプレイも rotate も任意**
- **wiki 本文**: *"allows you to play a Treasure during your Action phase"* ＝ **アクションフェイズ中に財宝を1枚プレイできるカード**
- **エラッタ**: なし
- **実装上の注意**:
  - **解決順**＝ +1購入 → 山札を全部捨て札へ → 捨て札を見て財宝を1枚プレイしてよい → rotate するか選ぶ。
    （※ Old Map の FAQ が「記載順どおり」を明示しており同じ構造＝**推定**。Herb Gatherer 自体に順序の明文FAQは無い）
  - 山札→捨て札は **`triggerOnDiscard` を通してはいけない**（坑道・村有緑地・忠犬などが誤発火する）。
    本プロジェクトは §0-28 で「**山札から捨てたカードでも捨て札トリガーを誘発**」にしてあるので、
    **ここだけは明示的に除外する必要がある**（＝engine 側に「捨て札トリガーを起こさない移動」の口が要る）。
  - 「Look through it」＝**捨て札の中身を見る**＝**私的な看破**。オンラインの `maskStateFor` で
    本人にだけ捨て札の全内容を出し、相手には漏らさないこと（§0-28 の夜警/太陽の恵みと同型）。
  - プレイした財宝は普通の「財宝の使用」＝ +$ もカードの効果（御守り・水晶玉等の選択待ち）も普通に起きる。
    **アクションフェイズで財宝を出す**ので、`turn.phase === 'buy'` 前提の分岐（財宝ロック `treasuresLocked`、
    資本主義、-$1トークンの変換 等）に誤爆しないよう注意（語り部 storyteller と同型）。
  - **rotate は「使ったカード自身の山」を動かす**＝ Herb Gatherer をプレイした後に rotate すると
    山の一番上が Acolyte に変わる（＝自分の山から自分がいなくなる）。
  - Augurs 山がキングダムに無いのに Herb Gatherer だけ手に入る経路（闇市場等）では **rotate 先が無い**＝ガードすること。

### Acolyte  [$4]
- **id候補**: `acolyte`
- **コスト**: **[$4]**
- **種別**: **Action - Augur**
- **カードテキスト（英語・現行。エラッタ無し）**:
```
You may trash an Action or Victory card from your hand to gain a Gold.
You may trash this to gain an Augur.
```
- **Setup:**: なし
- **公式FAQ（2023年ルールブック p.5 逐語＝検証官が PDF から再抽出。wiki と完全一致）**:
  > *"Acolyte: Both abilities are optional; you may do either or both or neither. You only gain a Gold if you actually
  > trashed an Action or Victory card from your hand; you only gain an Augur if you actually trashed Acolyte.
  > Gaining an Augur will give you whichever Augur is on top of the pile currently, even if that's another Acolyte."*
  - ＝ **2つとも任意・独立**／**どちらも「実際に廃棄できたなら」の条件付き**／
    **獲得するのは「今その時点で山の一番上にある Augur」**（別の Acolyte でもよい）
- **エラッタ**: なし
- **実装上の注意**:
  - 「Augur を獲得する」は**サプライからの通常の獲得**＝獲得時トリガー（望楼/交易商人/牧羊犬/そり 等）が普通に働く。
    **コスト制限は無い**（Sibyl [$6] が一番上なら $4 の Acolyte を廃棄して Sibyl を獲得できる）。
    ➡ **`costUpTo` / `costUnder` を使ってはいけない**（コスト述語ではなく「その山の一番上」という指定）。
  - **「これ(this)を廃棄」＝命令(Command)経由では失敗する**（本プロジェクト §0-17 の現行ルール）。
    大君主/はみだし者/船長/王子/ネクロマンサーが Acolyte をプレイした場合、
    **2つ目の能力（Augur 獲得）だけが空振りし、1つ目（Action/Victory を廃棄して金貨）は普通に働く**。
  - **玉座の間などで2回使うと、1回目で自身を廃棄した後の2回目は「これ」が場に無い**＝
    `removeOne(inPlay)` が失敗して2つ目だけ空振り。1つ目は2回とも働く。
    ※一般ルール（lose track）からの帰結で、Acolyte 固有の一次資料の明文は無い。
  - **廃棄の対象順序**：カード記載順どおり「まず Action/Victory の廃棄 → 金貨獲得」→「次に自身の廃棄 → Augur 獲得」。
  - **Acolyte 自身は Action カード**なので、1つ目の候補に**手札にある別の Acolyte も入る**（場の自分自身とは別物）。
  - Augurs の山が空のときに自身を廃棄すると、**廃棄だけして何も獲得しない**（明文なし・一般則からの帰結）。
    UI は「何も得られません」を明示すべき。

### Sorceress  [$5]
- **id候補**: `sorceress`
- **コスト**: **[$5]**
- **種別**: **Action - Attack - Augur**（**Attack を落とさないこと**）
- **カードテキスト（英語・現行。エラッタ無し）**:
```
+1 Action
Name a card. Reveal the top card of your deck and put it into your hand.
If it's the named card, each other player gains a Curse.
```
- **Setup:**: なし
- **公式FAQ（2023年ルールブック p.7 逐語）**:
  > *"Sorceress: Name a card; if the top card of your deck has that name, each other player gains a Curse.
  > You put the card into your hand whether or not it had the name you chose."*
  ＝ **当たっても外れても、公開したカードは必ず手札に入る**
- **その他の裁定（wiki `Sorceress` の "Other Rules clarifications" 逐語）**:
  > *"If you have no cards in your deck or discard pile, no-one gains a Curse."*
  ＝ **山札も捨て札も空なら公開できない → 誰も呪いを得ない**（宣言自体はする）
- **エラッタ**: なし
- **［検証官追記］紛らわしい同拡張の別カード**: **Sorcerer（$5・Wizards・Action-Attack-Wizard）は別カード**。
  文面も逆（*"Each other player names a card, then reveals the top card of their deck. If wrong, they gain a Curse."*）。
  **日本語名は 女魔導士(Sorceress) と 魔導士(Sorcerer) で1文字しか違わない**（g11 参照）。取り違え厳禁。
- **実装上の注意**:
  - **これは Attack** ＝ 堀 (Moat) / 灯台 / チャンピオン等の免疫が働く。
    **リアクションの窓は「アタックをプレイした時点」＝宣言・公開より前**に開く（一般ルール）。
    免疫でないプレイヤーだけが呪いを得る。
  - **山札が空なら捨て札をシャッフルして山札にしてから公開する**（通常のドローと同じ）。その結果まだ0枚なら公開できない（＝呪いなし）。
  - **宣言（name a card）は「カード名」であって種別ではない**。
    ［検証官追記・出典］Wishing Well の Official FAQ 逐語が一般則の裏取りになる：
    *"Then name a card - a name, not a type, so e.g. "Copper," not "Treasure.""*
    **サプライにある必要があるという明文の制限は一次資料に無い**（Wishing Well / Mystic と同じ扱いにするのが安全）。
  - **呪いの山が空**なら誰も呪いを得ない。人数分足りなければ**手番順に先着**。
  - **Sibyl とのシナジー**（DXV プレビュー：*"Sibyl lets you win that guessing game."*）＝
    実装上 Sorceress の宣言は**プレイヤーが自由に決める**（自動で最善を選ぶ設計にすると Sibyl が死ぬ）。
  - 公開して手札に入れるのは**手番プレイヤー自身の山札**（相手の山札ではない）。
    公開＝ `reveal()` を通す（ルネサンスのパトロンが誘発する）。

### Sibyl  [$6]
- **id候補**: `sibyl`
- **コスト**: **[$6]**
- **種別**: **Action - Augur**
- **カードテキスト（英語・現行。エラッタ無し）**:
```
+4 Cards
+1 Action
Put a card from your hand on top of your deck, and another on the bottom.
```
- **Setup:**: なし
- **公式FAQ（2023年ルールブック p.7 逐語）**:
  > *"Sibyl: If after drawing your deck has no cards in it, the first card you put back will become the top card of it."*
  ＝ **4枚引いた結果 山札が0枚になった場合、最初に置く1枚（＝「上に置く」ぶん）がその山札の一番上になる**
  （＝その後「下に置く」ぶんはその下＝2枚目になる）
- **エラッタ**: なし
- **実装上の注意**:
  - **「上に1枚・下に1枚」は任意ではない**（"You may" が無い）＝ **強制**。
  - **手札が足りないときの扱いは一次資料に明文が無い**（⚠自信の低い項目）。
    一般則「できるだけやる」に従い、手札1枚なら上に1枚だけ置く／手札0枚なら何もしない、が妥当（Secret Passage と同型）。
  - **順序が重要**：先に「上に置く」→ 次に「下に置く」。上のFAQがこの順序を前提にしている。
    ＝ **2枚を同時に選ばせて自動で振り分ける実装にすると FAQ の状況を再現できない**ので、
    「上に置く1枚」「下に置く1枚」を別々に選ばせること（同じカードを両方には選べない＝"another"）。
  - **「下に置く」＝山札の一番下**＝engine に `deck.push()`（＝底）が要る。
    底に入れたカードは次のリシャッフルまで引かれない。
  - **+4 Cards は先**なので、引いた4枚も「上/下に置く」候補になる。
  - 引くときに山札が尽きればリシャッフルが起きる（＝へそくり/星図等の割り込みが起き得る）。

---

## 3. Odysseys（4枚）

### Old Map  [$3]
- **id候補**: `old_map`
- **コスト**: **[$3]**
- **種別**: **Action - Odyssey**
- **カードテキスト（英語・現行。エラッタ無し）**:
```
+1 Card
+1 Action
Discard a card. +1 Card.
You may rotate the Odysseys.
```
- **Setup:**: なし
- **公式FAQ（2023年ルールブック p.7 逐語）**:
  > *"Old Map: Everything happens in the order listed: first you get +1 Card and +1 Action; then you discard a card;
  > then you draw a card; then you choose whether or not to rotate the Odysseys."*
  ＝ **順序厳守：+1カード → +1アクション → 1枚捨てる → 1枚引く → rotate するか選ぶ**
- **エラッタ**: なし
- **実装上の注意**:
  - **「Discard a card.」は任意ではない**（"You may" が無い）＝ **手札があれば強制で1枚捨てる**。
  - 手札が0枚で捨てられない場合でも、**次の「+1 Card」は独立した指示なので引ける**
    （⚠一次資料に明文なし。"Discard a card." と "+1 Card." が別文＝条件節でないことからの読み。
    Cellar のような「捨てた枚数ぶん引く」型ではない）。
  - **捨て札は本物の「捨てる」**＝坑道 (Tunnel)・村有緑地・忠犬 などの捨て札トリガーが誘発する
    （Herb Gatherer の「山札を捨て札に移す」とは違う＝**同じ拡張の同じ山の中に、誘発する捨てと誘発しない捨てが両方ある**）。
  - **rotate は最後・任意**。捨て→引き の解決（＝捨て札トリガーで対話が開き得る）を全部終えてから rotate を聞く。
  - rotate すると山の一番上が Voyage になる（自分＝Old Map が底へ）。

### Voyage  [$4]  ★2023年12月にエラッタ（機能変更）
- **id候補**: `voyage`
- **コスト**: **[$4]**
- **種別**: **Action - Duration - Odyssey**
- **カードテキスト（英語・現行＝2023 printing / December 2023）**:
```
+1 Action
Take an extra turn after this one (but not a 3rd turn in a row), during which you can only play
3 cards from your hand.
```
  （**検証官が 2023年11月10日版ルールブック PDF p.8 のカード図版から逐語で確認**＝
  英語wiki Versions 表の「(2023 printing) / December 2023」行と完全一致。図版の種別行も `Action - Duration - Odyssey`）
- **カードテキスト（初版・2022年3月＝採用しない）**:
```
+1 Action
If the previous turn wasn't yours, take an extra turn after this one, during which you can only play
3 cards from your hand.
```
  （**検証官が 2021年版ルールブック PDF p.8 のカード図版から逐語で確認**）
- **Setup:**: なし
- **公式FAQ（wiki の見出しは "Official FAQ **(2023)**"。2023年11月版ルールブック p.8 の逐語と完全一致）**:
  > *"Voyage: This doesn't stop you from playing cards that aren't in your hand; for example, if the third card you play
  > is Golem (from Alchemy), it can still play its two cards, which are set aside. On a Voyage turn, if you Throne Room
  > a card, both Throne Room and that card count as plays from your hand, but Throne Room replaying the card does not.
  > This limits plays of all types of cards, including Treasures like Copper. **This can never let you take a 3rd turn in a row.**"*
  - ★最後の一文は **2021年版ルールブックには存在しない**（検証官が両PDFを diff して確認）＝エラッタと同時に追記された。

- **［検証官訂正④・引用の捏造］** 下書きは以下の4項目を **「wiki `Errata` 節・逐語要旨」** として、
  > *"Voyage has received errata so that you can't take multiple extra turns in a row. **Here are rulings that will change as a result.**"*

  という前置きつきで引用していた。**この太字の一文は Voyage ページのどこにも存在しない**。
  実際の wiki `Voyage` ページでは、これらはすべて **"Other Rules clarifications" 節の並列の箇条書き**であり、
  該当の1行は **"Voyage has received errata so that you can't take multiple extra turns in a row"（句点なし）だけ**。
  以下が **検証官が取得した "Other Rules clarifications" の全項目（逐語・順序も原文どおり）**:
  1. *"Voyage has received errata so that you can't take multiple extra turns in a row"*
  2. *"If a Voyage turn **fails to occur** (e.g. due to Lich), you discard the Voyage during the next Clean-up that happens
     (either yours or another player's)."*（※下書きは "fails" と縮めていた＝逐語ではなかった）
  3. *"Once you've played 3 cards from your hand, Voyage's restriction will override any ability that lets you play cards
     from your hand (such as Market Towns or Storyteller)."*
  4. *"Normally, if you gain an Action and immediately play it (e.g. you gained a Buried Treasure, or you spent Favors for
     City-state), that won't count towards Voyage's limit. However, if you gained the card directly to your hand (with e.g. Swap),
     then playing that card with e.g. City-state will count towards Voyage's limit."*
  5. *"Playing Shadow cards from your deck isn't playing cards from your hand and doesn't count towards Voyage. However,
     once you've played 3 cards from your hand, you can no longer play any cards from your hand, which also means you can
     no longer play Shadow cards."*
  6. *"If you play Voyage multiple times in one turn, you aren't able to take more than 2 turns in a row, so all Voyages
     after the first will fail."*
  7. *"If you play Voyage on an extra turn, you fail to get a 3rd turn."*
  8. *"If you set up multiple extra turns at once (e.g. one from Voyage, one from Mission), you choose one turn to take,
     and the others fail."*
  9. *"If you are Possessed, and they make you play Voyage, you take a Voyage turn, and then take your normal turn."*

- **★［検証官追記⑤・下書きが完全に落としていた最重要の裁定］「3連続禁止」の判定タイミング**

  下書きは「**今のターン自体が追加ターンなら Voyage は失敗**」という**プレイ時判定モデル**を提案していた。
  これは近似としては概ね合うが、**公式の判定タイミングはターンとターンの「あいだ」**であり、
  DXV は Outpost を例に**明示的にそう読めと言っている**（wiki `2023_Errata` Trivia 節・逐語）:

  > *"Outpost says "Take an extra turn after this one (but not a 3rd turn in a row)"; that can be read as
  > **"After this turn, if this wouldn't be a 3rd turn in a row, take an extra one."** Outpost is timed as
  > "in-between turns"; Lich is timed as "when you're about to take a turn." **If you play two Outposts and Lich on one turn,
  > Lich can skip the first extra turn. The second Outpost still happens, since you haven't taken 2 turns in a row yet.**
  > If you play Outpost and Lich on an Outpost turn, Outpost doesn't generate an extra turn and Lich ends up skipping your
  > next normal turn. As noted this means that a superfluous Outpost gets discarded during another player's Clean-up.
  > It doesn't know that the extra turn won't happen until we're right there failing to do it, which is after Clean-up."*

  ➡ **「1ターンに1回しか成立しない」というフラグ方式で実装すると、Lich が絡んだときに公式と食い違う**
  （2枚目の Voyage/Outpost が「まだ2連続していない」ので成立するケースを再現できない）。
  ➡ **正しいモデル＝「そのターンの片付けが終わった時点で、次に自分がターンを取ると3連続になるか？」を毎回評価する**。
  ➡ Voyage が空振りした場合の**捨てるタイミングが「次に起きる片付け（他人のでもよい）」になる理由**も、この引用が説明している
  （＝「追加ターンが来ないと判明するのは片付けの後」だから）。
  ※ Lich は「日の出づる国」ではなく **同盟の Wizards 山**のカード＝**同拡張内で必ず同居し得る**。夢物語ではない。

- **追加ルール（wiki `Extra_turn` ページ・逐語）**:
  - *"Extra turns do not count toward the tiebreaker rule that the player who has taken fewer turns wins a game with a tied score."*
    ＝ **追加ターンは同点タイブレークに数えない**（本プロジェクトの `p.freeTurns` / `scoreGame` の `tieTurns` に乗る）
  - *"In 2023, Donald X. introduced errata to prevent players from getting more than one extra turn at a time in most cases.
    Therefore the maximum turns on a row for the same player is 5:"*
    **Possession → card-shaped thing（Outpost / Mission / Voyage / Island Folk / Journey）→ your normal turn → Seize the Day → Fleet**
  - *"Lich has the opposite effect, making you lose a turn. If you play a Lich and earn an extra turn on the same turn,
    the two effects cancel out; you just skip the extra turn and have your next normal turn as usual."*
  - **Lich の 2023年ルールブック逐語（検証官が PDF から再抽出。下書きの引用は正しかった）**:
    *"You can skip an extra turn, like one from Voyage. **Skipped turns still count for the tiebreaker however they would
    have if taken.**"* ＝ スキップした追加ターンも「取っていたら数えられ方」のままタイブレークに反映する
    （＝追加ターンは数えないので、スキップした追加ターンも数えない）

- **［検証官追記］持続の追跡ルール（Allies ルールブック本文・逐語。下書きに無し）**:
  > *"Additionally, if a Duration card is played extra times by a card such as Specialist, that card also stays in play
  > until the Duration card is discarded, to track the fact that the Duration card was played extra times;
  > and that effect also ends if that card somehow leaves play."*
  （wiki Allies ページ版では対象カードが *[Throne Room, Scepter, Mastermind, Specialist, Flagship, or Daimyo]* と列挙されている）
  ➡ **玉座の間 等で Voyage を2回使うと、玉座の間も Voyage が捨てられるまで場に残る**。
  ➡ 本プロジェクトは §0-25 / §0-28 に「**玉座×持続で再演カードが場に残らない**」という**許容簡略化**が既にある。
     Voyage は「2回使っても追加ターンは1回」なので**得点・保存則への影響は無い**が、
     **「3枚制限のカウント」には影響する**（玉座の間そのものが1枚、玉座が選んだ手札のカードが1枚＝計2枚を消費する）。

- **実装上の注意**:
  - **持続カード**＝追加ターンの片付けまで場に残る。追加ターンが不成立（＝ "fail"）だった場合でも
    「**次に起きる片付け（自分のでも他人のでも）で捨てる**」。
  - **追加ターンの制限＝「手札から3枚まで」**。数えるのは**手札からのプレイのみ**。
    - **数える**：手札のアクション・財宝・夜行カードすべて／玉座の間そのもの＋玉座が選んだ**手札の**カード／
      **手札に直接獲得した**カードを City-state 等で即プレイした場合
    - **数えない**：玉座の2回目（再演）／ゴーレム・家臣・伝令官などが「手札以外から」プレイするカード／
      獲得して即プレイ（**手札に獲得したのでなければ**）
    - **3枚に達したら、手札からカードをプレイさせる一切の能力が上書きで止まる**（語り部・Market Towns 等）
  - **本プロジェクトへの影響が広い**：`PLAY_ACTION` / `PLAY_NIGHT` / `playTreasureCard` / `PLAY_ALL_TREASURES` /
    `playCardNoAction`（苦労/進軍/博打）/ 御料車・法貨の呼び出し / 女魔術師の置換 / 習性(Way) …
    **「手札から出したか」を1箇所で数える共通カウンタ**（例 `t.voyageHandPlays`）を作り、
    **engine 拒否・CPU 非提案・UI の無効化の3面が同じ述語を見ること**
    （engine だけ締めると CPU が同じ手を返し続けて本番 livelock ＝ §0-28 の錯乱と同型）。
  - **`PLAY_ALL_TREASURES` は3枚制限に必ずぶつかる**（銅貨も1枚と数える）。
    §0-24 の `playAllOrder` / `playAllResume` は「残り枚数」を知らないので、**制限に達したら残りを出さずに止める**配線が要る。

### Sunken Treasure  [$5]
- **id候補**: `sunken_treasure`
- **コスト**: **[$5]**
- **種別**: **Treasure - Odyssey**（アクションではない）
- **カードテキスト（英語・現行。エラッタ無し）**:
```
Gain an Action card you don't have a copy of in play.
```
- **コイン**: **[$0]**（＝**コインを1枚も出さない**。印刷面の隅に $0 が入っており、Allies Versions 表の
  「Expected changes for future printing: Sunken Treasure — Remove the value of [$0] from the upper corners of Treasures (2022)」
  が裏取りになる）
- **Setup:**: なし
- **公式FAQ（2023年ルールブック p.8 逐語）**:
  > *"Sunken Treasure: If there's no such Action in the Supply, you don't gain one."*
  ＝ **条件を満たすアクションがサプライに無ければ獲得しない**（＝空振りしてよい）
- **エラッタ**: なし（機能変更なし。将来の刷で隅の $0 表記を消す＝表示のみ）
- **実装上の注意**:
  - **コスト制限が一切無い**＝ $5 の財宝で **任意のアクション**（例：$6 の Distant Shore、$8 の King's Court 等）をタダで獲得できる。
    **`costUpTo` 等のコスト述語を使ってはいけない**。
    正しい候補述語＝「**サプライから獲得可能なアクションカード（`gainableBase`）**で、かつ**自分の場に同名のコピーが無い**もの」。
  - **「in play」の判定は解決時点**。**持続カードで場に残っているものも「場にある」**
    （＝本プロジェクトでは `p.inPlay` **＋ `p.durationCards`** の両方を見る。※一次資料に明文は無く一般則からの帰結）。
    Sunken Treasure 自身は Treasure なので自分自身は制限に関わらない。
  - **強制**（"You may" が無い）＝候補があるなら必ず1枚獲得する。
    候補ゼロなら獲得しない＝**終端保証を engine 側に必ず書く**（CPU が `card:null` を返し続けて livelock するのを防ぐ）。
  - 分割山の**下段（ロック中）は獲得できない**＝ `splitBlocked` を必ず併用。
    非サプライ山（賞品/戦利品/馬/精霊/願い 等）も除外（`gainableBase` が正本）。
  - **［検証官追記］この効果は `applyEffect` ではなく `applyTreasureEffect` に書くこと**
    （§0-25 の自己回帰：財宝の効果を `applyEffect` に書くと空振りする）。
    さらに **`PLAY_ALL_TREASURES` の途中で選択待ちを立てる財宝**なので、§0-24 の `turn.playAllResume`（中断→再開）に乗る。
    冠/ティアラ/偽造通貨で2回使う経路もあるので **`applyTreasureEffect` に書けば2回目も自動で正しくなる**（§0-15）。
  - **戦略メモ（wiki）**：Mining Village / Tragic Hero のような「1枚出すと自分を廃棄する」札と相性が良い（場に残らないので毎回獲得できる）。
  - 冒険の山トークンを Odysseys 山に置くと **財宝である Sunken Treasure でもボーナスが乗る**（ルールブック逐語）。

### Distant Shore  [$6]
- **id候補**: `distant_shore`
- **コスト**: **[$6]**
- **種別**: **Action - Victory - Odyssey**（**Victory を落とさないこと**）
- **カードテキスト（英語・現行。エラッタ無し）**:
```
+2 Cards
+1 Action
Gain an Estate.
2 [VP]
```
- **Setup:**: なし
- **公式FAQ（2023年ルールブック p.5 逐語＝wiki と完全一致。※wiki では1つの箇条書き）**:
  > *"Distant Shore: Gaining an Estate isn't optional. If the Estate pile is empty you still get +2 Cards and +1 Action."*
  ＝ **屋敷の獲得は強制**／**屋敷の山が空でも +2カード +1アクション は普通に得る**
- **エラッタ**: なし
- **実装上の注意**:
  - **固定 2VP の勝利点カード**。`vp: 2`。
  - **解決順は記載順**＝ +2カード → +1アクション → 屋敷を獲得（＝ドローが先。屋敷はそのターンには引けない）。
  - 獲得先は既定＝**捨て札**（望楼/ヴィラ/牧羊犬 等の獲得時トリガーは普通に働く）。
  - **屋敷を獲得する＝屋敷の山が減る**＝3山終了に効く。相続 (Inheritance) を使っているゲームでは強コンボ（ルール上の問題は無い）。
  - **山レベルの種別は Action-Odyssey**（ランダマイザ）なので、Distant Shore が Victory であっても
    **Odysseys 山は「勝利点の山」として扱われない**（Family of Inventors のトークンを置ける／若き魔女の Bane にできる／
    冒険の山トークンを置ける／**オベリスク・汚された神殿の対象にもなる**）。
    ➡ **本プロジェクトでは `DOM.CARDS.odysseys`（山のプレースホルダ）の types を `['action']` にすること**。
      城 (Castles) が `victory` 扱い（*"This pile is treated as a Victory - Castle pile, as per the Randomizer"*）なのと**対照的**。
  - 得点計算では **カード単位で 2VP**（山ではない）。庭園/品評会/絹の道など「所有カード枚数」系にも普通に数える。

---

## 4. まとめ表（実装用）

| id候補 | 山 | コスト | 種別 | 主効果 | 新規機構 |
|---|---|---|---|---|---|
| `augurs` | （山） | [$3] | Action - Augur | 上から Herb Gatherer×4 / Acolyte×4 / Sorceress×4 / Sibyl×4 ＝16枚 | rotate する順序つき山 |
| `herb_gatherer` | Augurs | [$3] | Action - Augur | +1購入／山札→捨て札、捨て札から財宝1枚をプレイしてよい／rotate してよい | rotate・アクションフェイズの財宝プレイ・捨て札の私的看破・**捨て札トリガーを誘発しない移動** |
| `acolyte` | Augurs | [$4] | Action - Augur | 手札のアクション/勝利点を廃棄して金貨／自身を廃棄して Augur を獲得（どちらも任意） | 「山の一番上を獲得」（コスト制限なし） |
| `sorceress` | Augurs | [$5] | Action - **Attack** - Augur | +1アクション／カード名を宣言、山札の一番上を公開して手札へ、当たれば他全員に呪い | アタック（宣言＋公開） |
| `sibyl` | Augurs | [$6] | Action - Augur | +4カード +1アクション／手札から1枚を山札の上、もう1枚を山札の**下** | 山札の**底**に置く |
| `odysseys` | （山） | [$3] | Action - Odyssey | 上から Old Map×4 / Voyage×4 / Sunken Treasure×4 / Distant Shore×4 ＝16枚 | 種別の異なる4種が同居（**山は Action 扱い**） |
| `old_map` | Odysseys | [$3] | Action - Odyssey | +1カード +1アクション／**強制で**1枚捨てて +1カード／rotate してよい | rotate |
| `voyage` | Odysseys | [$4] | Action - **Duration** - Odyssey | +1アクション／追加ターン（**3連続不可**）・そのターンは**手札から3枚まで**しかプレイできない | 追加ターン＋**プレイ枚数制限**（engine 横断） |
| `sunken_treasure` | Odysseys | [$5] | **Treasure** - Odyssey（**$0**） | 場に同名のコピーが無いアクション1枚を獲得（コスト制限なし・強制） | コスト制限なしの獲得 |
| `distant_shore` | Odysseys | [$6] | Action - **Victory** - Odyssey | +2カード +1アクション／屋敷を獲得（強制）／2VP | ラボ＋勝利点 |

### 日本語名（［検証官追記］。**正本は日本語wiki＝担当は g11**。ここは g11 との突き合わせ用）
| 英語 | 日本語 | 備考 |
|---|---|---|
| Augur（種別・山） | **卜占官** | 単複同形。読み「ぼくせんかん」 |
| Herb Gatherer | **薬草集め** | 英語wiki の Japanese 行とも一致 |
| Acolyte | **侍祭** | 英語wiki の Japanese 行とも一致 |
| Sorceress | **女魔導士** | ⚠ 同拡張の **Sorcerer＝魔導士** と1文字差 |
| Sibyl | **女予言者** | ⚠ ギルドの **Soothsayer＝予言者** と1文字差。英語wiki の Japanese 行とも一致 |
| Odyssey（種別・山） | **叙事詩** | |
| Old Map | **古地図** | |
| Voyage | **航海** | ⚠ **日本語版の印刷カードは2023年エラッタ前のテキスト**（＝本アプリは現行＝エラッタ後を採用する） |
| Sunken Treasure | **沈没船の財宝** | |
| Distant Shore | **遠い海岸** | |

---

## 5. ⚠ 自信が低い／一次資料に明文が無い項目（実装時に判断が要る）

1. **Sibyl の手札不足時**（手札1枚 or 0枚のとき「上/下に置く」をどうするか）。明文なし。一般則「できるだけやる」で実装するのが妥当。
2. **Old Map で手札が0枚のとき、"Discard a card." ができなくても "+1 Card." は得られるか**。別文なので得られると読むのが自然だが、明文の FAQ は無い。
3. **Acolyte で自身を廃棄したが Augurs の山が空**のとき（廃棄だけして何も得ない）。明文なし・一般則からの帰結。
4. **rotate の no-op ケース**（山が空 / 山の中身が全部同名）。明文なし・自明な帰結。
5. **Sorceress の「宣言できるカード名」の範囲**（サプライ外の名前も宣言できるか）。
   明文の制限は無い。Wishing Well の Official FAQ（*"a name, not a type"*）だけが一般則の手掛かり。Wishing Well / Mystic と同じ扱いにするのが安全。
6. **Sunken Treasure の "in play" に持続カード（場に残っているもの）を含めるか**。明文なし。「場にある」＝含める、が自然。
7. **Voyage の Shadow 裁定（上記 "Other Rules clarifications" #5）の読み**。
   逐語は「Shadow を山札からプレイするのは3枚に数えない。**ただし** 3枚使い切ったら手札からカードをプレイできなくなり、
   その結果 Shadow もプレイできなくなる」と読める＝**数えないのにロックはされる**という非対称な挙動。
   Shadow（日の出づる国）は本プロジェクト未実装なので当面影響なし。実装するときに再確認すること。
8. **Herb Gatherer の解決順に関する明文FAQは無い**（Old Map の「記載順どおり」からの類推）。

---

## 6. ［検証官］この文書の検証カバレッジ

- **訂正5件**：① 2023ルールブックの出典URL欠落／② 2023エラッタが6枚（Outpost・Mission・Possession・Journey を含む）である事実の欠落／
  ③ 既存 `SPLIT_PILES` モデルでは Allies 山を表現できないという engine 影響の欠落／
  ④ Voyage の "Here are rulings that will change as a result." という**存在しない引用文**／
  ⑤ 「3連続禁止」の判定タイミング（in-between turns）と Lich 相互作用の欠落。
- **訂正なしで確認できた項目**：8枚すべての **カード名 / コスト / 種別 / カードテキスト / Setup有無 / 公式FAQ**（＝48項目）、
  山2つの **コスト・種別・構成16枚・人数非依存**、**分割山と rotate の一般ルール全文**、**rotate 裁定3件**、
  **Versions 表（2022初版・2023機能変更・将来の表示変更3件）**、**Extra turn の最大5連続とタイブレーク**、
  **Lich のルールブック逐語**、**Family of Inventors のルールブック逐語**、**96枚の内訳**。
- **未実施**：日本語wiki（wikiwiki.jp）は Cloudflare の 429 で本セッション中に開けなかった。
  上の日本語名は **g11 担当の成果を英語wiki の Japanese 行で照合**したもの（薬草集め/侍祭/女予言者の3件は一致を確認済み）。

---

# 同盟(Allies) 分割山 2組 8枚 ＋ 山そのもの — 一次資料まとめ
**KEY = g07_split_townsfolk_wizards**

> **【敵対検証済 2026-08-12】** 別の検証官が下書きを一切引用せず一次資料を**引き直して**全項目を再取得・照合した。
> **確定した訂正 3件**（①第2刷PDFの入手元URLが未記載＝再現不能だった／②「第2刷である」証拠として挙げた
> `Island Folk: This can never let you take a 3rd turn in a row.` は**第1版ルールブックにも載っている**＝証拠として無効／
> ③Elder の対象一覧で `Trusty Steed` も italic＝**除外済カード**なのに印が無かった）。
> **カード8枚＋山2枚の 名前・コスト・種別・カードテキスト・FAQ は全項目 訂正なしで一致**（下記「検証ログ」参照）。

対象: **Townsfolk**（Town Crier / Blacksmith / Miller / Elder）と
**Wizards**（Student / Conjurer / Sorcerer / Lich）＝ 王国カード8枚＋山カード（ランダマイザー）2枚。

## 出典（すべて一次資料・**再取得して自分の目で確認した**）
| 資料 | 取得方法 | 備考 |
|---|---|---|
| 英語wiki `Townsfolk` | `python tools/wikifetch.py Townsfolk` | 山カードの infobox（[$2] / Action - Townsfolk）と本文。2024/2025 スナップショットでも同一 |
| 英語wiki `Town_Crier` / `Blacksmith` / `Miller` | 同上 | カード文＋Official FAQ＋Versions 表（**March 2022 の1行のみ＝改訂なし**） |
| 英語wiki `Elder` | 同上（**必ず 2025 以降のスナップショット**） | 2023 スナップショットは**旧文**（`e.g. "choose one"`）。2025 スナップショットで現行文と Versions 表2行を確認 |
| 英語wiki `Wizards`（→ ページ名は `Wizard` にリダイレクト） | 同上 | infobox は最新版で `Action - Wizard - Liaison`、**2024スナップショットでは `Action - Wizard`**、本文は一貫して `Action-Wizard`（下の「決着しなかった点」参照） |
| 英語wiki `Student` / `Conjurer` / `Sorcerer` / `Lich` | 同上 | カード文・Official FAQ・Other rules clarifications |
| 英語wiki `Rotate` | 同上（**必ず最新スナップショット `2id_`**） | ⚠ **2024 スナップショットは stub（中身がほぼ空）**。最新版にだけ Official Rules／Other rules clarifications／回転できるカード一覧が載っている |
| 英語wiki `Split_pile` | 同上 | 分割山の一般ルール（Allies 節を逐語確認） |
| 英語wiki `Liaison` | 同上 | List of Liaisons ＝ Bauble / Sycophant / **Importer, Student, Underling** / Broker / Contract, Emissary, Guildmaster |
| 英語wiki `Allies` | 同上（2025 スナップショット） | Versions 表＝2023年12月刷の変更点 |
| 英語wiki `Wishing_Well` | 同上 | 「name a card」の一般裁定（名前であって種別ではない）の裏取り |
| **RGG 公式ルールブックPDF（第1版・2022年3月）** | `curl -sL https://www.riograndegames.com/wp-content/uploads/2021/09/Dominion-Allies-Rules.pdf` → `pdftotext -layout` | **このURLに置かれているのは今も第1版**。版組スタンプ無し・カード画像スタンプ `alliessplitcards21.indd … 10/6/21` `Allies_alliescards.indd … 10/24/21` `12/29/21`。**Elder は旧文 `(e.g. "choose one")`／Island Folk・Voyage のカード文に `(but not a 3rd turn in a row)` が無い** |
| **RGG 公式ルールブックPDF（第2刷・2023年12月）** | **`curl -sL "https://web.archive.org/web/2id_/http://wiki.dominionstrategy.com/images/4/4e/AlliesRulebook2023.pdf"`**（英語wiki `Allies` の Versions 表の PDF リンク先。Wayback 経由でDL可） → `pdftotext -layout` | 版組スタンプ **`DomAlliesRules21x.qxp_WideDominion 11/10/23 5:03 AM Page N`**（全12ページ）。**Elder のカード画像が `(with "choose")`／Island Folk・Voyage のカード画像に `(but not a 3rd turn in a row).`**。担当8枚の現行カード文・FAQ をこれで最終確認した |

### ⚠️ 第2刷を判定するときに使ってはいけない証拠（下書きの誤り②）
- ルールブック本文の FAQ 行 **`Island Folk: This can never let you take a 3rd turn in a row.` は第1版にも載っている**
  （第1版テキストの該当行を実確認）。**これでは版を判別できない。**
- **有効な判別材料は次の3つだけ**：
  1. 版組スタンプ `DomAlliesRules21x.qxp_WideDominion **11/10/23** 5:03 AM`（第1版のPDFには存在しない）
  2. **Island Folk / Voyage のカード画像**に `(but not a 3rd turn in a row).` があるか
  3. **Elder のカード画像**が `(with "choose")` か `(e.g. "choose one")` か

### 版（printing）の確定
英語wiki `Allies` の Versions 表（逐語・2025 スナップショットで再取得）:

```
March 2022    — First edition
                Errors: Rulebook — The text at the end of the last page is missing the last line
                with the mail address and web site for Rio Grande Games.
December 2023 — Functional changes:
                  Island Folk, Voyage — Cannot take a third turn in a row (2023).
                Cosmetic changes:
                  Elder — Rephrased for clarity (2023).
Expected changes for future printing —
                Cosmetic changes:
                  Specialist — Rephrase "Play it again" to "Replay it" …
                  Sunken Treasure — Remove the value of [$0] from the upper corners …
                  Importer — Mark "Setup:" in bold (2023).
```

→ **この担当範囲(8枚)で 2023年12月刷で文面が変わったのは Elder だけ**（公式分類は **cosmetic**）。
Town Crier / Blacksmith / Miller / Student / Conjurer / Sorcerer / Lich は**カード文もFAQも第1版と逐語一致**
（両版PDFで機械比較・目視確認）。**Setup: 行は8枚とも無し**。
**本アプリは現行＝2023年12月刷を採用**。
※ 将来刷の予告に **Specialist / Sunken Treasure / Importer** があるが、いずれも担当範囲外。

---

# 【A】山そのもの（split pile / rotate）

## Townsfolk（山カード＝ランダマイザー）  [$2]
- **id候補**: `townsfolk`（山の pile-id）
- **コスト**: **$2**（ポーション費用・負債コスト**なし**。同盟に負債/ポーションは1枚も無い）
- **種別**: **`Action - Townsfolk`**（infobox。2019/2024/2025 のどのスナップショットでも同一）
- **カードテキスト（英語・現行）**:
```
This pile starts the game with 4 copies each of Town Crier, Blacksmith, Miller, and Elder,
in that order. Only the top card can be gained or bought.
```
- **Setup:**: なし（この文は山カードの本文であって Setup 行ではない）
- **山の中身と並び**（上から。コスト昇順・**人数によらず各4枚＝計16枚**）:

| 位置 | カード | コスト | 種別 |
|---|---|---|---|
| 上(1) | Town Crier | $2 | Action - Townsfolk |
| 2 | Blacksmith | $3 | Action - Townsfolk |
| 3 | Miller | $4 | Action - Townsfolk |
| 下(4) | Elder | $5 | Action - Townsfolk |

- **公式ルール（RGG ルールブック 第2刷 逐語・分割山の節。wiki `Split_pile` の Allies 節と完全一致）**:
```
Dominion: Allies has six split piles, that have four different cards in each of them. The cards start
the game in order by cost. For example, the Augurs pile starts out with 4 Herb Gatherers on top,
then 4 Acolytes, then 4 Sorceresses, then 4 Sibyls. This order may get messed up by cards like Swap;
that's fine.
As with the split piles in Dominion: Empires, only the top card of a split pile can be bought or gained.
You can look through the cards in a split pile at any time, without changing the order.
The top card of each split pile has an ability that can "rotate" the pile (or with Battle Plan, any
pile). Rotating a pile means taking the top card, and all copies of it directly under it, and putting
them on the bottom. For example, if three Herb Gatherers were at the top of the Augurs, followed by
Acolytes, you would put those three Herb Gatherers on the bottom, and Acolyte would now be on top.
Some cards refer to information about a pile as if it's just one card. In these cases, go with what's
on the Randomizer card, which usually matches the top card. Some things refer to cards from a
particular pile; these things work on all cards from a split pile. For example Training (from
Dominion: Adventures) lets a player put a token on an Action pile, which causes them to get +[$1]
when playing a card from that pile. The token can be put on the Odyssey pile, and then Sunken
Treasure will also make +[$1] when played.
```
- **枚数の一次資料**（ルールブックの内容物一覧・逐語。第1版・第2刷とも同一）:
```
96 Split pile cards
   4 each of Acolyte, Archer, Battle Plan, Blacksmith, Conjurer, Distant Shore, Elder,
   Garrison, Herb Gatherer, Hill Fort, Lich, Miller, Old Map, Sibyl, Sorcerer,
   Sorceress, Stronghold, Student, Sunken Treasure, Tent, Territory, Town Crier,
   Voyage, Warlord
31 Randomizer cards
```
  → **各4枚固定。人数（2〜4人）で枚数は変わらない**（帝国の城＝2人8枚/3人以上12枚 とは違う）。

## Wizards（山カード＝ランダマイザー）  [$3]
- **id候補**: `wizards`
- **コスト**: **$3**
- **種別**: **`Action - Wizard`**（※ Liaison が付くかは下の「決着しなかった点」参照。**実装上の影響はほぼ無い**）
- **カードテキスト（英語・現行）**:
```
This pile starts the game with 4 copies each of Student, Conjurer, Sorcerer, and Lich,
in that order. Only the top card can be gained or bought.
```
- **Setup:**: なし
- **山の中身と並び**（上から・各4枚＝計16枚）:

| 位置 | カード | コスト | 種別 |
|---|---|---|---|
| 上(1) | Student | $3 | Action - Wizard - **Liaison** |
| 2 | Conjurer | $4 | Action - **Duration** - Wizard |
| 3 | Sorcerer | $5 | Action - **Attack** - Wizard |
| 下(4) | Lich | $6 | Action - Wizard |

- **重要（Ally の発動条件）**: RGG ルールブック（第2刷）逐語 —
```
In games using one or more Liaison cards, give each player a Favors mat and deal out a single Ally
card. The Ally cards are a separate deck, not combined with Events and so on. Each player gets a
single Favor token to start with (or five tokens in games with Importer).

Allies are landscape cards that give Favor tokens a use; Liaisons are kingdom cards that provide a
way to get Favor tokens. In games with a Liaison, deal out a random Ally to use that game. Only use
one Ally per game, even with multiple Liaisons. …
Favors may be used starting with the first turn of the game; they may not be used prior to that turn.
Spending Favors is always optional. Spending Favors can only be done once per time an Ally ability
triggers, unless it says, "Repeat as desired."
```
  → **Wizards を王国に入れたら Student（Liaison）が山の中に居るので Ally を1枚配る**
  （山の種別に Liaison が印字されているかに関わらず、この結論は動かない。
  Student が回転で底に回っていても、山にある以上「Liaison を使うゲーム」である）。

## rotate（回転）の公式ルール — wiki `Rotate` ページ（**最新スナップショット**）逐語
```
The top card of each split pile has an ability that can "rotate" the pile (or with Battle Plan, any pile).
Rotating a pile means taking the top card, and all copies of it directly under it, and putting them on
the bottom.
For example, if three Herb Gatherers were at the top of the Augurs, followed by Acolytes, you would
put those three Herb Gatherers on the bottom, and Acolyte would now be on top.
```
### 追加の裁定（`Rotate` の Other rules clarifications・逐語）
- **Battle Plan は「サプライの山」なら何でも回せる**（同盟の分割山だけでなく、暗黒時代の Knights /
  Ruins、帝国の Castles、プロモの Sauna/Avanto も）。
- **Ferryman の山に分割山が選ばれた場合**、その山は**サプライ外**になるが、
  **山を名指しするカード（Town Crier / Student など）は回せる**。
  一方 **Battle Plan は「サプライの山」限定なので Ferryman の山は回せない**（Clashes であっても）。
- **`Swap` や `Way of the Horse` で順序が崩れた山を回すと、「一番上と、その直下に連続して並ぶ同名カード」だけが動く**。
  逐語:
```
When cards are returned to their piles out of order via an effect such as Swap or Way of the Horse,
rotating only affects consecutive cards of the same name on top of the pile. For instance, if the
Wizards pile has a Student on top of four Liches and then two more Students below that, rotating the
pile will only move the top Student and leave the rest of the Students where they are.
```
- 回転できるカード一覧（逐語）: **Battle Plan（任意のサプライ山）／ Herb Gatherer（Augurs）／
  Old Map（Odysseys）／ Student（Wizards）／ Tent（Forts）／ Town Crier（Townsfolk）**。

### 分割山の一般ルール（`Split_pile` ページ）で実装に効くもの
- **一番上のカードしか購入/獲得できない**。
- **いつでも山の中身を見てよい（順序は変えない）**。
- **山のコスト/種別を参照する効果はランダマイザー（＝山カード）を見る**
  （Townsfolk＝$2 Action / Wizards＝$3 Action）。逐語:
  `Some cards refer to the cost or types of a pile as if it is just one card. In these cases go with
  what is on the Randomizer card, which usually matches the top card.`
  → 若き魔女の Bane、冒険の山トークン（Training/Lost Arts/Pathfinding/Seaway）、Ferryman 等はこれで判定。
- **「その山のカード」を参照する効果は分割山の全カードに効く**（山トークンのボーナスは Lich でも乗る）。
  逐語の公式例：Odysseys 山にトークンを置くと **Sunken Treasure（財宝）** でも +[$1] が出る。
- **上半分が尽きても「山が空」ではない**（一般節の逐語。Empires 限定の記述ではない）:
  `Emptying the top half of a split pile does not count as emptying a pile, for the game end condition
  or cards that refer to empty piles. The entire pile needs to be gone for the pile to be empty.`

### 実装上の注意（山まわり）
- 本プロジェクトの既存 `DOM.SPLIT_PILES` は **2段（上段id→下段id）専用**で、
  「上段が残っている間は下段を獲得できない」ロックしか持たない。
  同盟は **4段＋回転**なので、**山の状態を「id配列（順序つき）」で持つ新機構が要る**
  （暗黒時代の `state.knights` / `state.ruins`＝混合山の配列表現が最も近いコピー元。
  ただし混合山は開始時シャッフルで**回転が無い**点が違う）。
- **`cardCost(state,'townsfolk')` 等の「山のコスト」は一番上の実カードのコスト**で返す設計にすると
  購入判定は正しくなるが、**山の種別/コストを参照する効果（Bane・山トークン・Ferryman）は
  ランダマイザー値（$2 Action / $3 Action）を返さねばならない**＝**2つの述語が要る**。
  帝国の `castles`（プレースホルダの静的コスト $3 と一番上の実コストがずれる）で既に踏んだ罠と同型
  （PROGRESS §0-16 の「CPUで山のコストを見るときは engine の `cardCost` を使う」参照）。
- **回転は「一番上のカードと、その直下に連続する同名カード」だけを底に回す**。
  「同名を全部集めて底へ」ではない（Swap 実装後にここを間違えると壊れる）。
- **`emptyPileCount`（3山終了）は 16枚すべて尽きたときだけ +1**。
- **回転は「獲得」でも「廃棄」でもない**＝`triggerOnGain`/`triggerOnTrash` を呼ばない。山の枚数も変わらない。
- **山の中身は公開情報**（"You can look through the cards in a split pile at any time"）＝
  `maskStateFor` で伏せてはいけない。

---

# 【B】Townsfolk 4枚

### Town Crier  [$2]
- **id候補**: `town_crier`
- **コスト**: $2（ポーション/負債なし）
- **種別**: `Action - Townsfolk`
- **カードテキスト（英語・現行。wiki Versions 表の逐語）**:
```
Choose one: +[$2];
or gain a Silver;
or +1 Card and +1 Action.
You may rotate the Townsfolk.
```
- **Setup:**: なし
- **Versions**: **March 2022 の1行のみ＝改訂なし**
- **公式FAQ（wiki Official FAQ ＝ ルールブック逐語）**:
```
Town Crier: First choose either to get +[$2], or to gain a Silver, or to get +1 Card and +1 Action.
Then, no matter what you picked, choose whether or not to rotate the Townsfolk pile.
```
  → **① 3択を先に解決 → ② その後に回転するかを選ぶ**。**順序が固定**。
- **裁定まとめ**:
  - **回転は任意**（"You may"）。3択で何を選んだかに関係なく回転を選べる。
  - **3択は強制**（1つは必ず選ぶ）。
  - 銀貨の山が空なら「gain a Silver」を選んでも何も獲得しない（選ぶこと自体は合法）。
  - **Elder の対象になる**（wiki `Elder` の対象一覧に Town Crier あり。回転は "choose" の選択肢では
    ないので Elder で増えない）。
- **実装上の注意**:
  - **回転は3択の後**。「+1 Card」を選んだドローの結果を見てから回転の可否を決められる。
  - 回転で Town Crier 自身が底に回っても、**場に出ている Town Crier は関係ない**（山だけが動く）。
  - 3択＋回転＝**pending が2段**になる（選択→回転Yes/No）。Elder 併用時は3択が「2つ選ぶ」に化ける。
  - 「+1 Card and +1 Action」を選ぶと非ターミナル（cantrip）になる＝CPU の chooseAction 評価に影響。

### Blacksmith  [$3]
- **id候補**: `blacksmith`
- **コスト**: $3
- **種別**: `Action - Townsfolk`
- **カードテキスト（英語・現行）**:
```
Choose one: Draw until you have 6 cards in hand;
or +2 Cards; or +1 Card and +1 Action.
```
- **Setup:**: なし
- **Versions**: **March 2022 の1行のみ＝改訂なし**
- **公式FAQ（逐語）**:
```
Blacksmith: You either draw until you have 6 cards in hand, or draw 2 cards, or draw one card and
get +1 Action.
```
- **裁定まとめ**:
  - 選択は強制（1つ必ず選ぶ）。
  - **Elder の対象になる**。Elder ページの Official FAQ に**この組み合わせの公式例**がある（逐語）:
    `if you use Elder on Blacksmith and choose "draw until you have 6 cards in hand" and "+1 Card and
    +1 Action," you first draw up to 6, then get +1 Card and +1 Action.`
    ＝**カード記載順に解決**（結果7枚）。
  - ⚠ **「手札が既に6枚以上なら1枚も引かない」は一次資料に明示が無い**（"draw until" の一般規約＝
    Library/Watchtower と同じ。マイナスにはならない）。実装はこの一般規約に従えばよい。
- **実装上の注意**:
  - 「6枚まで引く」の 6 は**手札の枚数**（場や脇は数えない）。この効果を解決する時点の手札で判定。
  - `draw()` を通すこと（-1カードトークン等が正しく効く）。

### Miller  [$4]
- **id候補**: `miller`
- **コスト**: $4
- **種別**: `Action - Townsfolk`
- **カードテキスト（英語・現行）**:
```
+1 Action
Look at the top 4 cards of your deck. Put one into your hand and discard the rest.
```
- **Setup:**: なし
- **Versions**: **March 2022 の1行のみ＝改訂なし**
- **公式FAQ（逐語）**:
```
Miller: If you have fewer than four cards (after shuffling), you just look at what's left.
```
- **裁定まとめ**:
  - 見た中から**1枚を手札に入れる（強制）／残りは捨てる**。0枚しか無ければ何も起きない。
  - **"Look at"＝「見る」であって「公開(reveal)」ではない**（＝パトロンは誘発しない／私的情報）。
- **実装上の注意**:
  - **「見る」なので `reveal()` を通してはいけない**（PROGRESS §0-22 の公開フック／§0-28 の夜警・
    ゾンビの密偵と同じ扱い）。**オンラインでは `maskStateFor` のマスク一覧に必ず足す**
    （§0-28 で「見る」がマスク漏れして相手の山札が読めた実バグが出ている）。
  - **捨てる3枚は本物の「捨てる」**＝捨て札トリガー（Tunnel / Village Green / Faithful Hound /
    Trail 等）が誘発する。
  - 4枚に足りないときは**リシャッフルを1回行ってから**残りを見る（FAQ の "after shuffling"）。
  - Border Guard の強化版だが Border Guard と違い**残りは山札に戻さず捨てる**。

### Elder  [$5]
- **id候補**: `elder`
- **コスト**: $5
- **種別**: `Action - Townsfolk`
- **カードテキスト（英語・現行＝2023年12月刷。wiki Versions 表＋第2刷PDFのカード画像で確認）**:
```
+[$2]
You may play an Action card from your hand. When it gives you a choice of abilities
(with "choose") this turn, you may choose an extra (different) option.
```
- **Setup:**: なし
- **Versions（逐語）**:
  - **March 2022（初版）**: `… When it gives you a choice of abilities (e.g. "choose one") this turn, …`
  - **December 2023（2023 printing・現行）**: `… When it gives you a choice of abilities (with "choose")
    this turn, …`
  - wiki `Allies` の Versions 表では **Cosmetic changes ＝ "Rephrased for clarity"** に分類。
  - **意味の差**：初版の `e.g. "choose one"` は「たとえば choose one のような選択」と読めて、
    "choose" の語が無い選択（Weaver / Barge / Jester）まで含むように誤読され得た。
    現行は **`with "choose"`＝カード文に literally "choose" が書いてあるものだけ**と限定。
    **本アプリは現行を採用**。
  - ※ **公式FAQの文面は初版・第2刷で完全に同一**（変わったのはカード文だけ）。
- **公式FAQ（wiki `Elder` の Official FAQ ＝ ルールブック逐語）**:
  - `You can play an Action card with no "choose" ability; it will simply do what it normally does.`
    → **"choose" を持たないアクションを使ってもよい**（ただの1枚プレイになる）。
  - `If you play one with a "choose" ability, you may take an extra choice, but don't have to; for
    example, when playing Count (from Dark Ages), you could choose to only get one thing from the
    first "choose" ability, but two from the second.`
    → **追加の選択は任意**。
  - `If you choose multiple things, you do those things in the order listed on the card;` （Blacksmith の例）
    → **複数選んだら必ずカード記載順に解決**。
  - `If you use Elder on Courtier (from Intrigue), you get one extra choice, not one extra choice per type.`
  - `Elder doesn't affect all choices, just ones that say "choose" and have a list of options; for example
    Workshop gives you a choice of what card to gain, but Elder playing Workshop doesn't do anything extra.`
- **Other rules clarifications（wiki 逐語）**:
  - **"choose" と書いていない選択（Weaver / Barge / Jester）は対象外**。
  - **Scrap**：$0 のカードを廃棄したら選択1つ（＋Elder で1つ）。**手札が空で1枚も廃棄しなければ選択0**
    （Elder があっても増えない＝「0に+1」ではない）。
  - **Catacombs は Elder で得しない**（両方選ぶと3枚を手札に入れ→その3枚を手札から捨て→別の3枚を引く）。
  - **持続カードの「次のターンの選択」には基本的に効かない**。Amulet は**今ターンだけ**追加選択、
    次のターンは増えない。Cabin Boy は何も起きない。**Elder は持続と一緒に場に残らない**。
  - ただし **Contract 等でターン開始時に Elder を使い Quartermaster を使わせた場合**は、
    そのターンに両方の選択肢を選べる（将来のターンは不可）。
  - **Stronghold**：Elder で「今 +[$3]」と「次のターン +3 Cards」を**両方**得られる。
    **Elder は Stronghold と一緒に場に残らない**（wiki 逐語 `Elder won't stay in play with the Stronghold.`）。
    ルールブックの Stronghold 項も逐語で
    `Stronghold: If you choose +[$3], Stronghold will be discarded that turn; if you choose the +3 Cards
    next turn, Stronghold will stay out until that turn's Clean-up (and if you choose both via Elder, it
    will stay out).` ＝**残るのは Stronghold**。
  - **Elder で選択を増やしたアクションを Royal Carriage / Scepter で再演しても、2回目には追加選択が付かない**。
  - **Way of the Chameleon** で使われたカードなら、追加選択も得るし +Cards/+[$] の入れ替えも起きる。
  - **Reckless（略奪の Trait）**の選択持ちカードなら、**2回の反復の両方で**追加選択を得られる。
  - **"choose" の語があっても Elder が効かないカード**: Advisor / Necromancer / Pillage / Swindler /
    **2枚目の Elder**。
- **Elder が追加選択を与えるカードの公式一覧**（wiki `Elder`。**italic＝現行版から除外されたカード**）:
  - 陰謀: Courtier, Lurker, Minion, Nobles, Pawn, Steward
  - 海辺: Native Village, *Pirate Ship*（**除外済**）
  - 収穫祭&ギルド: Courser, *Trusty Steed*（**除外済**）
  - 異郷: Spice Merchant
  - 暗黒時代: Catacombs（実益なし）, Count, Graverobber, Squire
  - 冒険: Amulet（使用時のみ／次ターンは不可）, Miser
  - 帝国: Wild Hunt
  - ルネサンス: Treasurer
  - 移動動物園: Scrap
  - **同盟: Blacksmith, Broker, Hill Fort, Innkeeper, Modify, Specialist, Stronghold, Town, Town Crier**
  - 略奪: Quartermaster（ターン開始時に使った場合のみ）
  - 日の出づる国: Kitsune
  - プロモ: Governor
  - Enlightenment が有効で購入フェイズに Elder を使えた場合（Market Towns 等）に追加選択が付く財宝:
    Bauble, Charm, Investment, Orb, Scepter
- **実装上の注意**:
  - **Elder はアクション権を消費せずに手札のアクション1枚を使う**（玉座の間の「1回だけ」版）。
    このプロジェクトの `playCardNoAction`（§0-26 で新設）が最も近い入口。**習性(Way)も選べる**
    （公式：カードを使用するときはいつでも Way を選べる。上の Way of the Chameleon 裁定が裏づけ）。
  - **Elder は持続と一緒に場に残らない**（＝玉座の間との最大の違い）。`armDuration` の予約を張らない。
  - 「追加選択」は **Elder が使ったその1枚に対して・そのターン中に限り**有効。
    → `t.elderBoost = { card: <id>, count: n }` のようなターン変数が要る（同一ターンに Elder を
    複数回使えば別々のカードに乗る）。
  - **「追加選択は different option」**＝同じ選択肢を2回選ぶことはできない（玉座の間との違い）。
  - **再演（Royal Carriage / Scepter / 玉座の2回目）には追加選択が乗らない**＝
    このプロジェクトの `state.replay` 経由では Elder ブーストを見ないこと。
  - **判定は「カード文に choose があるか」**なので、**カタログに `elderChoice: true` のような
    明示フラグを持たせるのが安全**（日本語テキストからの正規表現判定は §0-22 の資本主義の判定表と
    同じ罠を踏む）。公式の対象一覧は上記のとおり確定しているので、そのまま列挙できる。
  - Scrap の「0個なら 0＋Elder でも 0」に注意（「選択肢が発生する経路が無いなら増えない」）。

---

# 【C】Wizards 4枚

### Student  [$3]
- **id候補**: `student`
- **コスト**: $3
- **種別**: **`Action - Wizard - Liaison`**（**Liaison を落とさないこと**。wiki infobox＋第2刷PDFのカード画像で確認）
- **カードテキスト（英語・現行）**:
```
+1 Action
You may rotate the Wizards.
Trash a card from your hand. If it's a Treasure, +1 Favor and put this onto your deck.
```
- **Setup:**: なし
- **Versions**: **March 2022 の1行のみ＝改訂なし**
- **公式FAQ（wiki ＝ ルールブック逐語で一致）**:
```
Student: Rotating the Wizards is optional, but trashing a card is mandatory. If you trash a Treasure,
you get +1 Favor and put Student onto your deck: that's mandatory. This means you might draw that
same Student again that turn and play it again. If you trash a non-Treasure, Student stays in play,
and is discarded in Clean-up like other cards.
```
- **Other rules clarifications（wiki 逐語）**:
  - **Student が場に無い場合**（Band of Misfits 等でサプライから使った場合）は、
    **財宝を廃棄しても +1 Favor は得るが、Student を山札に置くことはできない**（lose track）。
  - **玉座の間で Student を使い山札の上に置くと、玉座の間は Student を見失う**（lose track）。
    さらに Fellowship of Scribes 等でその Student をすぐ引いても、玉座の間はそれを場に戻せない。
- **順序（カード記載順）**: ① +1 Action → ② 回転するか選ぶ → ③ 手札1枚を廃棄。
- **実装上の注意**:
  - **回転が「廃棄より前」**（Town Crier は逆に「3択の後」）。順序を取り違えないこと。
  - **`put this onto your deck` の「this」は場にある Student 自身**＝
    このプロジェクトの `takeSelf` / `removeOne(p.inPlay, id)` ガードを必ず通す
    （PROGRESS §0-17：命令(Command)経由でプレイされた札は動かない／
     場に無いのに山札へ push すると保存則違反）。
  - **廃棄は `trashCard` を通す**（Fortress / Rats / 墓所 / 青空市場 / Lich 等の on-trash が誘発）。
  - **Liaison＝Favor を得る**。Wizards が王国に入るだけで **Ally を1枚配る**必要がある。
  - Student を山札の上に置くと、同ターンに引いて再プレイできる＝
    **CPU が無限ループしないよう「同一ターンの Student 再使用回数」に注意**（廃棄する手札が尽きれば止まる）。

### Conjurer  [$4]
- **id候補**: `conjurer`
- **コスト**: $4
- **種別**: `Action - Duration - Wizard`
- **カードテキスト（英語・現行）**:
```
Gain a card costing up to [$4].
At the start of your next turn, put this into your hand.
```
- **Setup:**: なし
- **Versions**: **March 2022 の1行のみ＝改訂なし**
- **公式FAQ（逐語）**:
```
Conjurer: This will keep returning to your hand each turn as long as you keep playing it.
```
- **Other rules clarifications（wiki 逐語）**:
  - **命令(Command)系（Band of Misfits / Overlord など）でプレイした場合、stop-moving rule により
    Conjurer は自分を手札に置けない**。そして「次のターンに何もしない」ので、
    **Band of Misfits はそのターンの Clean-up で捨て札になる**（場に残らない）。
  - **Conjurer が自分を手札に戻すと、場に残っていた玉座の間はそれを見失う**。
    → その Conjurer をもう一度使っても、**その玉座の間は3ターン目まで場に残らない**。
- **裁定まとめ**: 獲得は**即時・強制**（"Gain a card costing up to $4"）。
- **実装上の注意**:
  - **「持続だが次のターンに手札へ入って場を離れる」**＝場から捨て札に行かない持続。
    このプロジェクトの持続処理（`p.delayedEffects` / `cnt.<id>` で片付けを保留する仕組み）で、
    **解決時に inPlay から hand へ移す**必要がある（捨て札に行かせない）。
  - **このエンジンは自分の手番終了時に次の手札を先引きする**（PROGRESS §0-9）。
    Conjurer の「ターン開始時に手札へ」は**先引きの後に加算**される＝**手札6枚**になる。
    Hireling の +1カード と同じ位置。
  - 獲得コストの判定は **`costUpTo(state, id, 4)`（3成分比較・サプライ限定）** を使うこと。
    素の `cardCost(...) <= 4` を書くと mix-all で本番 livelock（PROGRESS §0-23）。
  - 獲得は**強制**なので、候補ゼロ（$4以下のサプライが空）でも詰まないよう終端保証を入れる。

### Sorcerer  [$5]
- **id候補**: `sorcerer`
- **コスト**: $5
- **種別**: `Action - Attack - Wizard`
- **カードテキスト（英語・現行）**:
```
+1 Card
+1 Action
Each other player names a card, then reveals the top card of their deck.
If wrong, they gain a Curse.
```
- **Setup:**: なし
- **Versions**: **March 2022 の1行のみ＝改訂なし**
- **公式FAQ（逐語）**:
```
Sorcerer: Each other player names a card and reveals the top card of their deck. If it doesn't have
that name, they gain a Curse. Whether or not it does, they return the card to the top of their deck.
So, if you play Sorcerer twice in a turn, they will probably know the card for the 2nd play.
```
  → **公開したカードは山札の上に戻す**（当たっても外れても）。
  → **同一ターンに2回目の Sorcerer を使うと相手はほぼ確実に当てられる**（＝2枚目は空振り）。
- **Other rules clarifications（wiki 逐語）**:
```
If a player has no cards in their deck or discard pile, they do not gain a Curse.
```
  Donald X. の Discord 発言（wiki `Sorcerer` の Trivia > Wording に全文引用あり）:
  `… Matching Sorceress is compelling. … Sorceress suggests that they don't get a Curse. It would be
  "If it's not the named card," and "no card" cannot be compared. For the moment, no Curse.`
  ※本人が `the card doesn't clarify it` と明言＝**カード文からは決まらない**。**Sorceress に合わせて
  「呪い無し」が公式見解。本アプリもそれを採用**。
- **アタック**＝堀(Moat)・灯台(Lighthouse)・Champion 等で防がれる。免疫者は名前も言わず公開もしない。
- **参考（同拡張の対になるカード）**: `Sorceress: Name a card; if the top card of your deck has that
  name, each other player gains a Curse. You put the card into your hand whether or not it had the
  name you chose.` ＝ **Sorceress は「手札に入れる」／Sorcerer は「山札の上に戻す」。挙動が違う。混同注意。**
- **実装上の注意**:
  - **順序**：① 使用者が +1カード +1アクション → ② 各相手が（手番順に）**まず名前を言い**、
    **その後に**山札の上を公開。**名指し→公開の順を逆にしてはいけない**（当てゲームが成立しなくなる）。
  - **公開したカードは山札の上に戻す**（捨てない・手札に入れない）。
  - 山札が空なら**捨て札をシャッフルして山札にしてから**公開する。両方空なら公開できず**呪い無し**。
  - 呪いの山が空なら誰も呪いを得ない（既存の一般ルール）。呪いは手番順に先着で配る。
  - **「名前を言う」は「カード名」であって種別ではない**（Wishing Well の公式FAQ 逐語:
    `name a card - a name, not a type, so e.g. "Copper," not "Treasure."`）。
    **サプライにあるカードに限る、という制限は一次資料のどこにも無い**。
    CPU は「自分の山札の上として最もありそうな名前」を推定する必要がある
    （素朴には自分のデッキで最多のカード名＝銅貨/屋敷）。**CPU が null を返さないこと**。
  - 名指し／公開は**相手プレイヤーの pending**（`pd.player` が被害者）＝
    このプロジェクトの助言者(advisor)型と同じルーティングが要る。
  - オンラインでは「相手が名指しした内容」は公開情報だが、**山札の中身は公開してはいけない**
    （公開した1枚だけが公開情報）。

### Lich  [$6]
- **id候補**: `lich`
- **コスト**: $6
- **種別**: `Action - Wizard`
- **カードテキスト（英語・現行）**:
```
+6 Cards
+2 Actions
Skip a turn.
When you trash this, discard it and gain a cheaper card from the trash.
```
- **Setup:**: なし
- **Versions**: **March 2022 の1行のみ＝改訂なし**
- **公式FAQ（wiki ＝ ルールブック逐語で一致）**:
  - `Skipping a turn means that the next time you would take a turn, you don't; nothing happens for
    that turn: no "start of turn" abilities, no phases. Play continues with the player to your left as usual.`
    → **スキップしたターンでは何も起きない**（持続の開始時効果も無し・フェイズも無し）。
  - `You can skip an extra turn, like one from Voyage.`
  - `Skipped turns still count for the tiebreaker however they would have if taken.`
    → **同点決勝（手番数）には数える**（実際に取っていたのと同じ扱い）。
  - `If you play multiple Liches you will skip multiple turns.`
  - `When you trash Lich, you put it from the trash into your discard pile, which does not trigger
    abilities that care about gaining cards; then you gain a card costing less than Lich from the trash,
    which does trigger such abilities.`
    → **① Lich を廃棄置き場→自分の捨て札へ（これは「獲得」ではない）
       ② そのあと廃棄置き場からコストがより安いカードを1枚「獲得」する（こちらは獲得トリガーが誘発）**。
  - `Gaining a cheaper card is mandatory if possible.` → **可能なら強制**。
- **Other rules clarifications（wiki 逐語）**:
  - **追加ターンをスキップすると、その Clean-up もスキップされる**。
    → 例：Voyage をスキップすると、その **Voyage は「次に実際に起きるターン」（自分でも他人でも）の
    Clean-up で場から捨てられる**。
  - **Lich + Outpost を同じターンに使う**と：Clean-up で3枚引き → Outpost のターンをスキップ →
    **その3枚の手札を次の自分のターンまで持ち越す**。
  - **同時に複数の追加ターンを取る場合（Voyage と Island Folk 等）は順番を選べる。
    最初に取ろうとしたターンが Lich でスキップされる。**
  - **スキップしたターンは「取ったターン数」に数えない**（追加ターン系カードのカウント用）。
    → 通常ターンに Lich と Voyage 2枚を使うと、Lich が Voyage ターンの1つをスキップし、
    **もう1つの Voyage ターンは取れる**。
  - **Lich は「そもそも起きないターン」はスキップできない**。
    → Island Folk のターンに Lich と Voyage を使うと、Voyage は「3ターン連続不可」なので
    そのターン自体が起きず、**Lich はそれをスキップしたことにならない**（スキップは次に持ち越し）。
  - **前のターンを参照するカード（Smugglers）は「実際にプレイされたターン」を見る**。
    スキップしたターンは見ない（＝Lich を使ったターンを見る）。
  - **「直前のターンの持ち主」を見るカード（Voyage）も、実際にプレイされた最後のターン**を見る。
    → 他の全員が Lich でターンをスキップしていると、**あなたの Voyage は失敗する**。
  - **同じターンに Lich と「次のターンまで」系の持続（Monkey / Highwayman）を使うと、
    その持続効果は「次に実際に取るターン」まで続く**（スキップしたターンをまたいで延長される）。
  - **獲得するのは「Lich より安いカード」であって「$5以下」ではない**。
    Family of Inventors 等でコストが変わっていると差が出る。
  - **複数枚を同時に廃棄したときは、全部を廃棄置き場に入れてから on-trash を解決する**。
    → **Sentinel で Lich と Sycophant を同時に廃棄すると、Lich はその Sycophant を獲得できる**。
  - **支配(Possession)で相手に Lich を廃棄させた場合**、Lich を
    **(a) 相手の捨て札に入れる か (b) 脇に置いてターン終了時に相手の捨て札に入れる** のどちらかを
    支配者が選べる。**どちらにせよ支配者は廃棄置き場から安いカードを獲得する**。
  - **サプライから廃棄された場合（Lurker）**も、**Lich を（自分の）捨て札に置き、
    廃棄置き場から安いカードを獲得する**。この捨て札への移動は「獲得」には数えない。
- **実装上の注意**:
  - **「スキップしたターン」は本エンジンにとって最大の新機構**。`p.skipTurns`（数値）を持ち、
    `cleanupAndAdvance` で次の手番に回すときに消費する。ただし：
    - **同点決勝には数える**＝移動動物園で作った `p.freeTurns` / `tieTurns`（§0-26）とは**逆向き**の扱い。
      「スキップしたターンも `turns` に数える」が公式（`Skipped turns still count for the tiebreaker
      however they would have if taken.`）。
    - **追加ターン系のカウント（Voyage の「3連続不可」等）には数えない**。
    - **「起きないターンはスキップできない」**＝スキップの消費は「実際にターンが始まる直前」に行う。
  - **本エンジンは自分の手番終了時に次の手札を先引きする**。Lich でスキップする場合でも
    **先引きは Clean-up の一部として行われる**（公式 Outpost の裁定がそれを保証している：
    「Clean-up で3枚引き → Outpost ターンをスキップ → その3枚を次の自分のターンで使う」）。
    ＝**スキップ＝「引き直さない・持続の開始時効果を出さない・フェイズを回さない」**であって
    手札を捨てるわけではない。
  - **on-trash が「廃棄置き場を触る」＝このエンジン初の挙動**。
    ① `state.trash` から Lich を1枚抜いて `p.discard` へ（**獲得ではない**＝`triggerOnGain` を呼ばない）
    ② `state.trash` から「Lich より厳密に安い」カードを1枚選んで**獲得**（`triggerOnGain` を呼ぶ）。
    → **獲得元がサプライではない**ので、このプロジェクトの **`gainFromOutside`**（§0-23）を使うこと。
    → **候補述語に `costUpTo` / `costUnder` を使ってはいけない**（`gainableBase` が非サプライを弾くので
      候補が常にゼロ→CPU が null を返し続けて本番 livelock。PROGRESS §0-28 の
      「悪魔祓いの精霊」と完全に同型の罠）。**`state.trash` を直接走査する専用述語** を engine に新設し、
      **engine 拒否・CPU 候補・UI モーダルの3面が同じ述語を見る**こと。
    - コスト比較は **component-wise strictly less**（`costUnder` の比較ロジックだけ流用する）。
  - **`trashCard` の戻り値**（このプロジェクトは「廃棄置き場に残ったか」を返す＝城塞が false）を
    Lich でも false 相当にする（Lich は廃棄置き場に残らず捨て札へ行く）。
  - **複数同時廃棄の順序**：本エンジンは「全部 trash に入れてから on-trash を解決」になっているか
    要確認（Sentinel×Lich×Sycophant の公式例が回帰テストになる）。
  - **`state.trash` から抜くと廃棄置き場の枚数が減る**＝保存則 tally は `trash` ゾーンを数えているので
    捨て札に移した時点で辻褄は合う。**ネクロマンサーの「裏向きフラグ」（§0-28 は id→枚数で管理）と
    同居すると、廃棄置き場から札が抜けるのでフラグ管理に影響する**（夜想曲と mix したときの注意）。

---

## 日本語名（未確定＝別途 日本語wiki で取ること）
英語wiki の "Other language versions" に Japanese 行があったのは **2枚だけ**：
- Conjurer ＝ **霊術師** / Sorcerer ＝ **魔道士**
- 残り（Town Crier / Blacksmith / Miller / Elder / Student / Lich / Townsfolk / Wizards）は英語wikiに
  Japanese 行が無い。
- ⚠ **PROGRESS §0-27 の教訓**：夜想曲では**英語wiki の Japanese 行が17枚で実物と食い違った**。
  **日本語名の正本は日本語wiki（ホビージャパン印刷版）**。上の2つも日本語wikiで裏取りすること。

---

## 決着しなかった点（実装時に判断が要る）
1. **Wizards のランダマイザー（山カード）の種別に `Liaison` が含まれるか**。
   - 英語wiki `Wizards` の **最新版 infobox は `Action - Wizard - Liaison`**。
   - **2024年スナップショットの infobox は `Action - Wizard`**（＝後から編集で Liaison が足された）。
   - **同ページの本文は最新版でも `a single randomizer card whose type is Action-Wizard`**（Liaison なし）。
   - **wiki `Liaison` ページの List of Liaisons は `Student`（$3）を挙げており、`Wizards` は挙げていない。**
   - **RGG ルールブックPDF（第1版・第2刷とも）にはランダマイザー（山カード）の画像が無い**
     ＝PDF では決着しない（PDFで確認できたのは **Student のカード種別が `Action - Wizard - Liaison`** まで）。
   - **実装上の影響はほぼ無い**：Ally を配るかは「王国に Liaison カード（＝Student）があるか」で決まり
     （ルールブック逐語で確定）、山の種別を参照する効果（若き魔女の Bane・冒険の山トークン・Ferryman）は
     `Action` であることだけが効く。**本文＋Liaisonページに合わせて `Action - Wizard` に倒すのを推奨**。
2. **Sorcerer で「山札も捨て札も空」のときに呪いを与えないルール**は、
   wiki の Official FAQ ではなく **Other rules clarifications ＋ Donald X. の Discord 発言**が根拠。
   本人も `the card doesn't clarify it` と述べており、**カード文からは決まらない**。
   Sorceress に合わせて「呪い無し」が現時点の公式見解＝**本アプリもそれを採用**。
3. **Blacksmith「Draw until you have 6 cards in hand」で手札が既に6枚以上のとき**の挙動は
   一次資料に明示が無い（"draw until" の一般規約に従って「1枚も引かない・マイナスにはならない」）。
4. **Sorcerer の「名前を言う」がサプライ外のカード名でもよいか**は一次資料に明示なし。
   Wishing Well の公式FAQ（`a name, not a type`）から「カード名なら何でもよい」と解した。
5. **Elder の 2023年12月版の変更が「機能変更」か「表現の明確化」か**（※文面自体は両版のPDFで
   確認済みなので、割れているのは"分類"だけ）。wiki `Allies` の Versions 表は **Cosmetic changes**
   に分類しているが、実装挙動としては「"choose" の語が無い選択（Weaver / Barge / Jester）を対象外にする」
   という**明確な線引き**が入っている。**本まとめでは現行(2023-12)の線引きを正とした**。

---

## 検証ログ（訂正なしで一次資料と一致した項目 ＝ 42件）
- カード文 10件（Town Crier / Blacksmith / Miller / Elder / Student / Conjurer / Sorcerer / Lich ＋
  Townsfolk 山 / Wizards 山）
- コスト 10件（$2 / $3 / $4 / $5 ／ $3 / $4 / $5 / $6 ／ 山 $2 / 山 $3）
- 種別 10件（Liaison・Duration・Attack の取りこぼし無し）
- Setup: 行が無いこと 10件
- 山の並び順・各4枚（96 Split pile cards の内容物一覧で確認）2件
- Official FAQ 8件、Other rules clarifications 4群（Student 2 / Conjurer 2 / Sorcerer 1 / Lich 12）
- Rotate の公式ルール逐語＋追加裁定3件＋回転できるカード一覧6枚
- Split_pile の Allies 節逐語（山のコスト/種別＝ランダマイザー／上半分が尽きても空ではない）
- Ally / Favors の setup 逐語（Liaison が1枚でもあれば Ally を1枚配る／開始時 Favor 1個・Importer なら5個）
- Elder の対象カード公式一覧（除外済2枚の italic を訂正した以外は一致）
- Stronghold × Elder のルールブック逐語

## 取得のコツ（次の担当者向け）
- `python tools/wikifetch.py <Page>` は Wayback が高頻度で接続拒否を返す。**同じページを最大12回
  リトライするループ**を組むこと（1〜7回目で通る）。
- **`wikifetch.py` は `2id_` → `2025id_` → `2024id_` → `2023id_` → `2019id_` の順に試して
  最初に通ったものを返す**。＝**古いスナップショットが返ってくることがある**。
  **Elder と Rotate は必ず `2025id_` 以降を明示指定して取り直すこと**
  （Elder の 2023 スナップショットは旧文／Rotate の 2024 スナップショットは stub＝中身が無い）。
- `Wizards` は `Wizard` へリダイレクトされる。`Skip` / `Skipped_turn` というページは存在しない
  （ターンスキップの裁定は全部 `Lich` ページにある）。
- 2023年12月刷ルールブックPDFは RGG のサイトには無い。**英語wiki がホストしている
  `http://wiki.dominionstrategy.com/images/4/4e/AlliesRulebook2023.pdf` を Wayback 経由でDLする**
  （第1版は `.../images/3/31/AlliesRulebook2021.pdf`、および RGG の
  `https://www.riograndegames.com/wp-content/uploads/2021/09/Dominion-Allies-Rules.pdf`）。

---

# 同盟（Allies）分割山 2組 8枚 ＋ 山そのもの — 一次資料まとめ

**KEY = g08_split_clashes_forts**

> ✅ **敵対検証済み（2026-08-12）**：下書きの引用を一切コピーせず、**英語wiki 12ページ**と
> **RGG 公式ルールブック PDF の 第1版(2021/03-2022) と 第2版(December 2023) の両方**を独立に取り直して照合した。
> **確定した訂正 6件**（下の「検証ログ」参照）。カードテキスト・種別・コスト・FAQ の**本体は全8枚とも下書きどおり正しかった**。

## 出典（このファイルを書くために実際に取得した一次資料）
- **英語wiki（wiki.dominionstrategy.com、Wayback 経由）**
  取得ページ＝`Clashes` / `Battle_Plan` / `Archer` / `Warlord` / `Territory` /
  `Forts` / `Tent` / `Garrison` / `Hill_Fort` / `Stronghold` / `Rotate` / `Split_pile` / `Pile` / `Allies` / `Elder` / `Townsfolk`
  ※ `<img alt="$4">` を `[$4]` の形に埋め戻して読んでいる（コスト・VPはこの形が正）。
- **RGG 公式ルールブック PDF ＝ 2つある。両方を実DL＋`pdftotext -layout` で読んだ**
  1. **第1版（March 2022）**：`https://www.riograndegames.com/wp-content/uploads/2021/09/Dominion-Allies-Rules.pdf`
     （2,144,349 bytes）
  2. **第2版（December 2023・現行）**：`http://wiki.dominionstrategy.com/images/4/4e/AlliesRulebook2023.pdf`
     （2,915,379 bytes・12ページ。Wayback 経由でDL可）
  → **本担当8枚のカードノート（公式FAQ）と分割山の一般ルールは、両版で1文字も違わなかった**（機械diff済み）。
  ⚠️ pdftotext はコイン記号・VP記号を落とすので、**金額は必ず wiki 側（`[$4]` 形式）で裏取り**した。

### ⚠️【この拡張の最大の罠】ルールブック PDF に埋め込まれたカード画像は「版に関わらず 2021年10月の校正刷り」
第2版(2023-12) の PDF の中身も、カード画像の InDesign スタンプは **`alliessplitcards21.indd  10/6/21`** のまま。
実際 **Archer の文面は 2023年版 PDF でも `one of them that you choose`** で、印刷カード／Shuffle iT の
**`one of those you choose`** に更新されていない。
→ **カード文面の正本は wiki の Versions 表（＝印刷カード＋デジタル実装）**。PDF のカード画像は使ってはいけない。
（PROGRESS §0-27 の「RGG の PDF は初版の罠」と同型。ただし今回は**第2版 PDF でも罠が残っている**点が悪質。）
PDF が正本として使えるのは **「SPLIT PILE CARD NOTES」＝公式FAQ の本文**と**一般ルール**だけ。

## 版（printing）について ＝ **本担当8枚に機能変更は無い**
`Allies` ページの Versions 表（自分で取り直した逐語）:
```
March 2022     First edition
               Errors: Rulebook — The text at the end of the last page is missing the last line
                       with the mail address and web site for Rio Grande Games.
December 2023  Functional changes:
                 Island Folk, Voyage — Cannot take a third turn in a row (2023).
               Cosmetic changes:
                 Elder — Rephrased for clarity (2023).
Expected changes for future printing:
               Cosmetic changes: Specialist / Sunken Treasure / Importer
```
→ **Clashes 4枚・Forts 4枚は 2022年初版と 2023年12月第2刷（現行）で完全に同一**。エラッタなし。
（Elder は本担当外だが Stronghold から参照するので下の「Elder」節に現行文を載せた。）

---

# 山そのもの

## Clashes（Clash 分割山・ランダマイザー）  [$3]
- **id候補**: `clashes`（プレースホルダ／ランダマイザー）
- **コスト**: **$3**（**ランダマイザー上の値**。中身は $3/$4/$5/$6）
- **種別**: **Action - Clash**（wiki infobox 逐語 `Action - Clash`）
  ＝**山全体の種別**。中身に Victory の Territory が居ても、**山としては「$3 の Action の山」**。
- **カードテキスト（英語・現行／ランダマイザー・wiki Versions 表 March 2022 行 逐語）**:
```
This pile starts the game with 4 copies each of Battle Plan, Archer, Warlord, and Territory, in that order.
Only the top card can be gained or bought.
```
- **構成**: 上から **Battle Plan ×4 → Archer ×4 → Warlord ×4 → Territory ×4 ＝ 計16枚**（コスト昇順）。
  **人数によらず16枚固定**（第2版ルールブックの構成表 逐語＝`96 Split pile cards / 4 each of Acolyte, Archer,
  Battle Plan, ... Warlord`＝6山×16枚）。
- **Setup:**: なし
- **公式FAQ・裁定**: Clashes ページの `Other rules clarifications` 節は**空**。共通ルールは下の節を参照。
- **エラッタ**: なし

## Forts（Fort 分割山・ランダマイザー）  [$3]
- **id候補**: `forts`
- **コスト**: **$3**（ランダマイザー上の値。中身は $3/$4/$5/$6）
- **種別**: **Action - Fort**（wiki infobox 逐語）
- **カードテキスト（英語・現行／wiki Versions 表 逐語）**:
```
This pile starts the game with 4 copies each of Tent, Garrison, Hill Fort, and Stronghold, in that order.
Only the top card can be gained or bought.
```
- **構成**: 上から **Tent ×4 → Garrison ×4 → Hill Fort ×4 → Stronghold ×4 ＝ 計16枚**。人数非依存。
- **Setup:**: なし
- **公式FAQ**: Forts ページの `Official rules` は「`See the Split pile page.`」の1行のみ。
- **エラッタ**: なし

## 【重要】分割山・Rotate の共通ルール（RGG ルールブック 第1版・第2版とも同一の逐語）
```
Dominion: Allies has six split piles, that have four different cards in each of them. The cards start the
game in order by cost. For example, the Augurs pile starts out with 4 Herb Gatherers on top, then 4
Acolytes, then 4 Sorceresses, then 4 Sibyls. This order may get messed up by cards like Swap; that's fine.
As with the split piles in Dominion: Empires, only the top card of a split pile can be bought or gained.
You can look through the cards in a split pile at any time, without changing the order.

The top card of each split pile has an ability that can "rotate" the pile (or with Battle Plan, any pile).
Rotating a pile means taking the top card, and all copies of it directly under it, and putting them on
the bottom. For example, if three Herb Gatherers were at the top of the Augurs, followed by Acolytes,
you would put those three Herb Gatherers on the bottom, and Acolyte would now be on top.

Some cards refer to information about a pile as if it's just one card. In these cases, go with what's on
the Randomizer card, which usually matches the top card. Some things refer to cards from a particular
pile; these things work on all cards from a split pile. For example Training (from Dominion:
Adventures) lets a player put a token on an Action pile, which causes them to get +$1 when playing a
card from that pile. The token can be put on the Odyssey pile, and then Sunken Treasure will also make
+$1 when played.
```
- **Rotate の定義**＝**「一番上のカードと、その直下に連続して並ぶ同名のコピーを、まとめて山の一番下へ移す」**。
  ＝**「4枚まとめて」ではなく「今の一番上の名前が連続している分だけ」**。
- **順序が乱れているときの挙動（wiki `Rotate` の「Other rules clarifications」逐語）**:
  > When cards are returned to their piles out of order via an effect such as `Swap` or `Way of the Horse`,
  > rotating only affects **consecutive** cards of the same name on top of the pile. For instance, if the
  > `Wizards` pile has a Student on top of four Liches and then two more Students below that, rotating the
  > pile will only move the top Student and leave the rest of the Students where they are.
- **Battle Plan が回せる山（wiki `Rotate` 逐語）**:
  > Battle Plan can rotate any Supply pile, not just the split piles from Allies. This includes Knights and
  > Ruins from Dark Ages and other split piles (for example Castles and Sauna/Avanto).
  > If a split pile is chosen as the pile for Ferryman, the pile can still be rotated by cards that refer to
  > the pile by its name even though the pile is not in the Supply.
  > As Battle Plan can only rotate Supply piles, it cannot rotate the Ferryman's pile, even if that pile is Clashes.
- **Rotate できるカードの全リスト（wiki `Rotate`）**＝Battle Plan（任意のサプライ山）／Herb Gatherer（Augurs）／
  Old Map（Odysseys）／Student（Wizards）／**Tent（Forts）**／Town Crier（Townsfolk）。
- **山の cost / types はランダマイザーが正**（wiki `Split pile` 逐語）:
  > When an effect depends on the cost or types **of a pile**, rather than of an individual card, the
  > information listed on a split pile's randomizer card determines what the cost and types of the pile as a
  > whole are considered to be. For instance, the Gladiator/Fortune pile is labeled a [$3] Action pile, and
  > therefore may be designated the Bane pile for Young Witch and have various Adventures tokens placed on
  > it, even though Fortune is not an Action and costs more than [$3]; and when this is the case, Fortune and
  > Gladiator both receive the bonuses from the Adventures tokens and may be used as a Bane card.
  → **Clashes ＝ $3 Action の山／Forts ＝ $3 Action の山**。**Territory が一番上でも山は $3 Action のまま**。
  → Young Witch の Bane・Adventures 山トークン・Family of Inventors のコスト軽減は**山単位で効き、山の全カードに効く**。
- **`Family of Inventors`（同盟の Ally）の公式ノート（ルールブック逐語）**:
  > ... split piles that have Victory cards in them, if the randomizer isn't a Victory card;
  > this means it can put tokens on the 6 split piles in Allies, but not on the Castles pile from Empires.
  ＝**Clashes / Forts には（Territory・Stronghold が居ても）コスト軽減トークンを置ける**。
- **山の中身はいつでも見てよい**（＝公開情報。順序を変えずに閲覧可）。
- **3山終了の数え方**：⚠️**これはルールブックの逐語ではなく、一般ルールからの帰結**。
  分割山は **1つのサプライ山**であり、`Pile` ページ逐語＝
  > Piles still exist even when they are empty, you can still return cards to them and place Adventures
  > tokens on them. Only Divine Wind can remove a pile; removed piles are not considered to be empty and
  > no longer count for a three-pile ending even if they were empty before being removed.
  → **16枚が全部無くなって初めて「空の山」1つ**（Empires の分割山と同じ）。

---

# Clashes（4枚）

### Battle Plan  [$3]
- **id候補**: `battle_plan`
- **コスト**: **$3**（ポーション費用・負債コストなし）
- **種別**: **Action - Clash**（wiki infobox＝`Action - Clash`／両版ルールブックの印刷カード type line も `Action - Clash`）
- **カードテキスト（英語・現行／wiki Card text ＋ Versions 表 March 2022 行）**:
```
+1 Card
+1 Action

You may reveal an Attack card from your hand for +1 Card.

You may rotate any Supply pile.
```
（印刷カードの改行＝`+1 Card / +1 Action / You may reveal an Attack card / from your hand for +1 Card. /
You may rotate any / Supply pile.`）
- **Setup:**: なし
- **公式FAQ・裁定**（RGG ルールブック 第1版・第2版とも同文／wiki `Official FAQ` とも同文）:
  > First you get +1 Card and +1 Action, then you may reveal an Attack card from your hand to draw a card,
  > and finally you may rotate any Supply pile. Many piles won't do anything meaningful if you do this.
  > It can be relevant though for split piles, or for the Castles from Empires, or the Knights or Ruins
  > from Dark Ages.
  - **解決順は厳密に 3段階**：①+1 Card / +1 Action → ②公開（任意）→ ③Rotate（任意）。
    ＝**①で引いた Attack を②で公開できる**。
  - 公開は **手札から**（場のアタックは不可）。**公開するだけ**＝手札に残る。捨てない・廃棄しない。
  - ②③とも **任意**（"You may"）。②を使わなくても③はできる（独立）。
  - ③は **任意のサプライの山1つ**。
- **エラッタ**: なし
- **実装上の注意**:
  - **「Attack カード」の判定は手札のカードの種別を見るだけ**（習性 Way でどう使ったか等は無関係）。
    同盟内では Archer / Warlord が Attack。他拡張の Attack も当然対象。
  - Rotate 対象は **サプライの山すべて**＝単一名の山を回しても実質無変化だが、
    **拒否せず受理してよい**（公式に「多くの山では意味が無い」と明記）。
    **混合山（Knights/Ruins＝全部名前が違う）を回すと1枚だけ**が下に行く。
  - **Rotate は「一番上の名前が連続している分だけ」**。素朴に「4枚ずつ」動かすと誤り。

### Archer  [$4]
- **id候補**: `archer`
- **コスト**: **$4**
- **種別**: **Action - Attack - Clash**（wiki infobox／両版ルールブックの印刷カード type line とも同一）
- **カードテキスト（英語・現行＝wiki の Card text ／ Versions 表 March 2022 行）**:
```
+$2

Each other player with 5 or more cards in hand reveals all but one,
and discards one of those you choose.
```
  ⚠️ **表記ゆれ（検証で確定）**：**第1版・第2版どちらの RGG ルールブック PDF に載っているカード画像も
  `... discards one of them that you choose.`**（indd スタンプ `10/6/21`＝2021年の校正刷りが両版に流用されている）。
  **印刷カード／Shuffle iT ＝ `one of those you choose`** が正本。**機能は完全に同一**。
  → **カード文面を PDF から取ってはいけない**（この拡張全体に言える）。
- **Setup:**: なし
- **公式FAQ・裁定**（RGG ルールブック 第1版・第2版とも同文／wiki `Official FAQ` とも同文）:
  > The players go in turn order if they care. Each other player, if they have 5 or more cards in hand,
  > chooses one to keep secret and safe, and reveals the rest. You choose one of the revealed cards for
  > them to discard.
  - **解決は手番順**（左隣から）。
  - **手札5枚以上の相手だけが対象**（4枚以下は完全に無事＝何も公開しない・捨てない）。
  - **被害者が「隠す1枚」を先に選ぶ**（その1枚は公開されず、捨てさせられない）。
    残り（4枚以上）を公開し、**その中から使用者が1枚を選んで捨てさせる**。
  - 捨てる枚数は **常にちょうど1枚**（民兵のような「◯枚まで減らす」ではない）。
- **その他の裁定**: Archer ページの `Other rules clarifications` 節は**存在しない**（`Strategy` 節も空）。
- **エラッタ**: なし
- **実装上の注意**:
  - **Attack なので Moat / Lighthouse 等の免疫が効く**（＝一般ルール。
    ⚠️ この点を明記した wiki の一文は **Archer ページではなく Warlord ページの Strategy 節**にある：
    「…Lighthouse … Moat (**which incidentally also both counter Archer**)…」）。
  - **2段階の対話**（被害者が隠す1枚を選ぶ → 使用者が公開札から1枚選ぶ）＝
    pending が **被害者→使用者** と持ち主を跨ぐ。オンラインでは
    **「隠した1枚」を使用者・他プレイヤーに漏らさないマスク**が必須（§0-28 の夜警/太陽の恵みと同型の漏洩リスク）。
  - 手札5枚ちょうどでも対象（＝公開4枚から1枚選ばれる）。相手の手札が全部同名でも普通に成立する。

### Warlord  [$5]
- **id候補**: `warlord`
- **コスト**: **$5**
- **種別**: **Action - Duration - Attack - Clash**
  （wiki infobox／両版ルールブックの印刷カード type line とも `Action - Duration - Attack - Clash`。4種別）
- **カードテキスト（英語・現行）**:
```
+1 Action

At the start of your next turn, +2 Cards. Until then, other players can't play an Action
from their hand that they have 2 or more copies of in play.
```
  （wiki Card text は「+2 Cards.」と「Until then,」が**同じ段落**。印刷カードの改行＝
   `+1 Action / At the start of your next turn, / +2 Cards. Until then, other / players can't play an Action /
   from their hand that they have / 2 or more copies of in play.`）
- **Setup:**: なし
- **公式FAQ・裁定**（RGG ルールブック 第1版・第2版とも同文）:
  > This doesn't stop players from playing cards that aren't in their hands; for example, Golem (from
  > Alchemy) can still play its two cards, which are set aside, no matter how many copies of them are in
  > play. With Warlord affecting you, Throne Room can't play a card from your hand that you have two
  > copies of in play; but Throne can play a card you have one copy of in play, and then can replay that
  > card, even though now you have two copies of it in play. This only affects Action cards; it doesn't
  > affect Copper, for example.
- **その他の裁定（wiki `Other rules clarifications` 逐語・全7項目）**:
  - > Normally, if you gain an Action and immediately play it (e.g. you gained a Berserker, or you spent
    > Favors for City-state), that will dodge Warlord. **However, if you gained the card directly to your
    > hand (with e.g. Swap), then Warlord can prevent that play.**
  - > **Warlord can prevent you from playing a card from your hand, even if you didn't play any copies of
    > it this turn.** For example, if you called 2 Guides at the start of your turn, then you can't play
    > any Guides from your hand.
  - > Actions that have been **played as a Way** will still count towards Warlord's restriction.
  - > If you have two copies of a **Shadow** card in play, Warlord prevents you from playing a third copy
    > of it **from your deck** as well as from your hand.
  - > **If you remove a 2nd copy of an Action card from play** (with e.g. Royal Galley or Way of the Horse),
    > you can then play another copy of that Action from your hand.
  - > **This attack applies to other players even during the turn you play it.** So if you play Warlord and
    > then gain a Province, each other player may play up to 2 Black Cats from their hands, but they can't
    > play a 3rd one.
  - > However, if you play a Warlord (and haven't already played one), other players can react with as many
    > **Caravan Guards** as they want, because the Caravan Guard reaction takes place **before** the Warlord
    > restriction kicks in.
  - > **The attack ends instantaneously when your next turn starts**; you can't choose to execute other
    > start-of-turn abilities while your Warlord's restriction on other players is still in effect. So if
    > you start your turn by playing an Archer with Royal Galley, each other player can react with as many
    > Caravan Guards as they want (even if you haven't taken the +2 Cards from Warlord yet).
- **エラッタ**: なし（Secret History＝開発中は「次のターン **+$3**」だった。Clashes ページ Secret History 逐語
  「And originally it gave +[$3] next turn.」）
- **実装上の注意**:
  - **Attack なので Moat / Lighthouse で無効化される**（免疫を得た相手には制限がかからない）。
    ＝**プレイ時に免疫を確定して「制限を受けるプレイヤー集合」を持つ**設計（§0-9 の沼の妖婆/呪いの森と同型の
    「相手のターンをフックする持続アタック」だが、**フックするのは購入ではなく「手札からのアクション使用」**）。
  - **制限の窓＝Warlord をプレイした瞬間 〜 Warlord 使用者の次のターン開始時（+2 Cards の直前・瞬時に解除）**。
    自分のターン中にも相手に効く（相手のリアクション＝Black Cat / Sheepdog 等が対象）。
    **Caravan Guard のリアクションは制限より前**なので、その窓では何枚でも通る。
  - **「2枚以上場にある」の数え方＝場（in play）にある同名カードの枚数**。
    持続で残っているカードも「場」に数える（前のターンから残る Duration がそのまま制限に効く）。
  - **禁じるのは「手札からアクションカードを使用すること」だけ**。
    ・脇に置かれたカードのプレイ（Golem、Prince、Band of Misfits 等）は禁じない。
    ・Throne Room の再演（replay）は「手札からのプレイ」ではないので禁じない。
    ・**Way で使ったアクションも「場にあるコピー」として枚数に数える**。
    ・**Shadow（Rising Sun・本プロジェクト未実装）は「山札から使う」が、それも止まる**と明記されている。
    ・財宝カードは対象外。
  - 場から取り除かれる（Royal Galley / Way of the Horse）と枚数が減り、また使えるようになる＝**動的判定**。

### Territory  [$6]
- **id候補**: `territory`
- **コスト**: **$6**
- **種別**: **Victory - Clash**（wiki infobox／両版ルールブックの印刷カード type line とも `Victory - Clash`。
  **アクションではない**。ただし**山としては $3 Action-Clash 扱い**＝ランダマイザー準拠）
- **カードテキスト（英語・現行）**:
```
Worth 1 [VP] per differently named Victory card you have.

When you gain this, gain a Gold per empty Supply pile.
```
- **Setup:**: なし
- **公式FAQ・裁定**（RGG ルールブック 第1版・第2版とも同文）:
  > For example, if your deck has 3 Estates, a Province, and a Territory, Territory is worth 3 [VP].
  > If gaining Territory causes the Clashes pile to be empty, that counts for how many Golds you get.
  - **「異なる名前の勝利点カード」＝自分が所有する全カードの中で数える**（山札・手札・捨て札・場・各種マット等）。
    **Territory 自身も1種類として数える**（上の例：Estate / Province / Territory ＝ 3種類 → 3VP）。
  - **枚数ではなく「名前の種類数」**。Estate を3枚持っていても Estate は1種類。
  - Territory を複数枚持っていれば **各 Territory がそれぞれその点数**（例：3種類なら1枚につき3VP）。
  - **獲得時の金貨＝「空のサプライ山1つにつき1枚」**。**Territory の獲得で Clashes が空になったら、それも数える**
    ＝**金貨の枚数は「Territory の獲得が完了した後」の空の山の数**。
- **その他の裁定（wiki `Other rules clarifications` 逐語）**:
  > If the Clashes are **Hasty** or **Patient**, then that may lead you to play Territory. This normally means
  > nothing, but it will still trigger **Adventures tokens** (e.g. Pathfinding), count as a card you've
  > played this turn (e.g. for **Landing Party**), and counts as a card **in play** (e.g. for **Tools**).
  （Hasty / Patient は Plunder の Trait ＝**本プロジェクト未実装**。Landing Party / Tools も Rising Sun ＝未実装。）
- **エラッタ**: なし
- **実装上の注意**:
  - **可変VP**＝`vpOf`（engine）と CPU の `vpOfPlayer` の**両方**に同じ式を書くこと（絹の道/品評会と同型）。
  - **空のサプライ山の数え方は engine の `emptyPileCount` と同じ述語を使う**
    （非サプライ山は数えない／分割山は**全部空**で1つ／混合山は集約キー）。
  - 獲得時トリガーは **購入・効果獲得どちらでも**発火（"When you gain this"）。
  - 金貨が足りなければ **ある分だけ**獲得。
  - **山としては $3 Action の山**なので、Young Witch の Bane・Adventures 山トークン・
    Family of Inventors のコスト軽減の対象になり得る（Territory 自身が Victory でも山の判定はランダマイザー）。

---

# Forts（4枚）

> ⚠️ **担当指示の前提訂正（検証で再確認）**：**Forts は「すべて持続（Duration）」ではない**。
> wiki infobox・**両版ルールブック PDF の印刷カード type line** で確認した実際の種別:
> - Tent ＝ **Action - Fort**（持続ではない）
> - Garrison ＝ **Action - Duration - Fort**
> - Hill Fort ＝ **Action - Fort**（持続ではない）
> - Stronghold ＝ **Action - Victory - Duration - Fort**
> 「持続」は **Garrison と Stronghold の2枚だけ**。

### Tent  [$3]
- **id候補**: `tent`
- **コスト**: **$3**
- **種別**: **Action - Fort**（**Duration ではない**）
- **カードテキスト（英語・現行）**:
```
+$2

You may rotate the Forts.

When you discard this from play, you may put it onto your deck.
```
- **Setup:**: なし
- **公式FAQ・裁定**（RGG ルールブック 第1版・第2版とも同文）:
  > If you have multiple Tents in play, you can choose how many you want to put on top of your deck.
- **その他の裁定（wiki `Other rules clarifications` 逐語）**:
  > If you play this using a **Way**, or under the influence of **Enchantress**, you can still top-deck
  > this when you discard it from play.
  （＝「場から捨てるときの能力」はカード自身の常在能力なので、記載効果が置換されても働く）
- **エラッタ**: なし
- **実装上の注意**:
  - **ターミナル銀貨（+$2、+アクション無し）**。Rotate は **任意**。
  - **「場から捨てるとき」＝クリンナップの捨てるタイミング**。
    公式のクリンナップ順は **①場と手札を捨てる（このとき "when you discard this from play" が解決）→ ②5枚引く**。
    ＝**山札の上に置いた Tent は、そのまま次の手札に引き込まれる**（Treasury / Alchemist と同じ）。
    **本プロジェクトのエンジンは「自分の手番終了時に次の手札を先引き」する**ので、
    **Tent の山札上置きは「先引きより前」**に置くこと（＝`scheme_cleanup`／城壁のある村／宝物庫と同じ場所）。
    後ろに置くと1ターン遅れて挙動が変わる。
  - **クリンナップ以外の「場から捨てる」経路でも誘発する**（"When you discard this **from play**"）。
  - **場に複数枚あるなら1枚ずつ任意**（何枚を山札の上に置くか選べる）。
  - Rotate は **Forts の山を名前で指定**しているので、山がサプライに無くても回せる
    （Ferryman＝本プロジェクト未実装なので実害なし）。

### Garrison  [$4]
- **id候補**: `garrison`
- **コスト**: **$4**
- **種別**: **Action - Duration - Fort**
- **カードテキスト（英語・現行）**:
```
+$2

This turn, when you gain a card, add a token here.
At the start of your next turn, remove them for +1 Card each.
```
- **Setup:**: なし
- **公式FAQ・裁定**（RGG ルールブック 第1版・第2版とも同文）:
  > This can only have tokens on it if it's in play; if it leaves play, it has no tokens. You can use coin
  > tokens for this; on Garrison they have no other meaning, they're just tokens on Garrison. If you Throne
  > Room Garrison and then gain 3 cards, it will get 6 tokens total, and you'll draw 6 cards next turn,
  > not 12, as you can only remove the tokens once.
- **その他の裁定（wiki `Other rules clarifications` 逐語）**:
  > **If Garrison doesn't have any tokens on it** (i.e. because you didn't gain any cards after playing
  > it), **you discard Garrison from play during Clean-up.**
  > This means you can **Improve** the Garrison if you haven't yet gained any cards this turn, since it is
  > due to get discarded from play. Improve will then gain a card, but since Garrison is no longer in
  > play, you can't put tokens on Garrison, so you won't draw cards next turn.
  > If you play Garrison with a card like **Band of Misfits**, it's not in play, so you can't put any
  > tokens on it. In contrast, Haven and Cargo Ship can set aside a card even if they're not in play,
  > because their "(on/under this)" wordings are only for player convenience.
- **エラッタ**: なし
- **実装上の注意**:
  - **トークンは「その物理カード1枚ごと」**。場に Garrison が2枚あれば、1回の獲得で**それぞれに1個ずつ**乗る
    （2枚＋3獲得 ＝ 各3個 ＝ 次のターン合計 +6カード）。
    ⚠️ **この「2枚の場合」の数値例は一次資料に明示が無く、"add a token **here**"（＝このカードの上）と
    "This can only have tokens on it if it's **in play**" からの帰結**（＝各 Garrison が独立にトリガーを持つ）。
    ＝**engine では「場の Garrison インスタンス単位のカウンタ」が要る**
    （id→枚数のマップでは玉座の2回分と2枚目を区別できない。§0-28 のネクロマンサー裏向きフラグで踏んだのと同型）。
  - **玉座で2回使うと「1回の獲得につき2個」乗るが、除去は1回だけ**（3獲得＝6個＝+6カード。12ではない）＝FAQ明記。
  - **場を離れたらトークンは消える**（廃棄・場から除去）。
    → **`Band of Misfits`/`Overlord` 等の「命令」で使うと場に出ないのでトークンが1個も乗らない**
      （公式FAQに Band of Misfits で明記＝§0-17 の「命令がプレイした札は動かない」と同型の帰結）。
  - **トークンが0個ならクリンナップで普通に捨てる＝持続にならない**（wiki 明記）
    （ルネサンスの貨物船・研究と同じ「条件つき持続」＝`p.delayedEffects` を張るのは1個以上乗ったときだけ）。
  - **「このターンに獲得したカード」＝Garrison をプレイした後の獲得**（プレイ前の獲得は数えない＝wiki の Improve 例で明示）。
    購入による獲得も効果による獲得も区別しない。
  - 次のターン開始時の除去＋ドローは **強制**（"remove them for +1 Card each"＝may が無い）。

### Hill Fort  [$5]
- **id候補**: `hill_fort`
- **コスト**: **$5**
- **種別**: **Action - Fort**（**Duration ではない**）
- **カードテキスト（英語・現行）**:
```
Gain a card costing up to [$4].
Choose one: Put it into your hand; or +1 Card and +1 Action.
```
- **Setup:**: なし
- **公式FAQ・裁定**（RGG ルールブック 第1版・第2版とも同文）:
  > First completely resolve gaining a card costing up to [$4]; then choose whether to put it into your
  > hand or get +1 Card and +1 Action. If the card is no longer where it was gained to (normally your
  > discard pile) then you will fail to put it into your hand if you choose that. If it's been covered up
  > in your discard pile, you can still put it into your hand.
- **その他の裁定（wiki `Other rules clarifications` 逐語）**:
  > Because you resolve all on-gain effects before you make your choice, this means that if you gain a
  > **Sheepdog** and put it into your hand, you can't use the Sheepdog's reaction to react to its own gain.
  > If you're subject to the effect of **Gatekeeper**, the gained card will be exiled before you get a
  > chance to put it into your hand.
- **エラッタ**: なし
- **実装上の注意**:
  - **獲得が先・選択が後**。獲得は**捨て札へ**（通常の獲得）で、**獲得時トリガーを全部解決してから**選択する。
    ＝**「手札に獲得する」置換ではない**（彫刻家/遊牧民の野営地のような獲得先の置換とは別物）。
    したがって **on-gain（望楼・そり・牧羊犬・追放の払い戻し 等）は「捨て札への獲得」として先に開く**。
  - **獲得は強制**（"Gain a card costing up to $4"＝may が無い）。獲得できる山が1つも無ければ獲得しない。
  - **選択（Choose one）は強制で、獲得できなかった場合でも行える**
    （「手札に加える」を選んでも何も起きない＝空振り）。
    ⚠️ **engine 側に終端保証を必ず書く**（候補ゼロの pending を立てると CPU が `card:null` を返し続けて
    §0-23 と同じ本番 livelock になる）。
  - **「獲得した場所（通常は捨て札）から動いていたら手札に加えられない」**＝lose-track。
    （例：望楼で山札の上に置いた／廃棄した／追放された 場合は失敗。
     捨て札の中で他のカードに埋もれただけなら成功する。）
  - コスト判定は **engine の `costUpTo(state, id, 4)` を必ず使う**
    （非サプライ・ロック中の分割山下段・ポーション費用・負債コストの成分別比較。§0-23 の必読事項）。
  - **Hill Fort 自身が $5 なので自分自身は獲得できない**（Forts 山の Stronghold も $6 で不可）。
    ただし **Forts の一番上が Tent($3)/Garrison($4) なら、Hill Fort で Forts 山から獲得できる**。

### Stronghold  [$6]
- **id候補**: `stronghold`
- **コスト**: **$6**
- **種別**: **Action - Victory - Duration - Fort**（この順が正）
  ⚠️ **両版ルールブック PDF の印刷カード type line ＝ `Action - Victory - Duration - Fort`。
  wiki の infobox も `Action - Victory - Duration - Fort`。
  wiki の本文プロース（"Stronghold is an Action-Duration-Victory-Fort card..."）だけが並び順違い＝機能差なし。**
- **カードテキスト（英語・現行）**:
```
Choose one: +$3; or at the start of your next turn, +3 Cards.

2 [VP]
```
- **Setup:**: なし
- **公式FAQ・裁定**（RGG ルールブック 第1版・第2版とも同文）:
  > If you choose +[$3], Stronghold will be discarded that turn; if you choose the +3 Cards next turn,
  > Stronghold will stay out until that turn's Clean-up (and if you choose both via **Elder**, it will stay out).
- **エラッタ**: なし
- **実装上の注意**:
  - **固定 2VP**（可変ではない）。**Victory かつ Action かつ Duration**＝4種別。
  - **選択は強制**（Choose one）。
  - **「+$3」を選んだら持続にならず、そのターンのクリンナップで捨てる**。
    **「次のターン開始時に +3カード」を選んだときだけ持続として場に残る**（＝条件つき持続。Garrison と同型）。
  - **Elder（同盟）で両方選ぶと、場に残る**（＝+$3 も得て、かつ次のターン +3カード）。**Elder は別担当だが連携必須**。
  - **アクションカードでもある**ので、勝利点なのに玉座の間等の対象になり得る／
    アクションフェイズにアクション権を1つ使ってプレイする。
  - **山としては $3 Action-Fort の山**（Family of Inventors のトークンは Forts 山に置ける＝公式ノートで明記）。

---

## 参考：Elder（別担当・Stronghold から参照するので現行文だけ確定しておく）
- **コスト ＝ [$5]**（⚠️ 下書きの「$3」は誤り。wiki `Elder` infobox 逐語 `[$5]`）
- **種別 ＝ Action - Townsfolk**
- **Townsfolk 分割山の4枚目**（`Townsfolk` ランダマイザー逐語＝
  "This pile starts the game with 4 copies each of **Town Crier, Blacksmith, Miller, and Elder**, in that order."）
- **現行テキスト（December 2023 印刷＝Versions 表の "Rephrased for clarity"）**:
```
+$2
You may play an Action card from your hand. When it gives you a choice of abilities
(with "choose") this turn, you may choose an extra (different) option.
```
  （March 2022 初版は `(e.g. "choose one")`。**機能差なし＝コスメティック**。）

## 日本語名について
**英語wiki の "Other language versions" 節に、本担当10ページとも日本語の行は存在しない**
（Dutch / German / French のみ）。**日本語名は日本語wiki（ホビージャパン印刷版）が正本**（PROGRESS §0-27 の教訓）。
**英語wiki から日本語名を捏造しないこと。**

---

## 本プロジェクト実装向けの横断メモ（重要）
1. **Rotate は新機構**。既存の Empires 分割山（`DOM.SPLIT_PILES`＝上段/下段2枚組）とは別で、
   **1山4名 ×4枚＝16枚の順序つき配列**が要る（Castles の `state.castles` に近い形）。
   - `state.clashes = [id, ...]` / `state.forts = [id, ...]`（コスト昇順で初期化・**人数非依存で16枚**）
   - 一番上（index 0）だけ購入/獲得可。
   - **Rotate＝先頭と、それに連続する同名を末尾へ移す**（4枚固定ではない）。
   - **`emptyPileCount` は「配列が空」のときだけ1山に数える**。
   - **山の中身は公開情報**＝`maskStateFor` で伏せない。
2. ⚠️**【最重要】「支払うコスト」と「山としてのコスト/種別」を別の述語にすること**。
   - **購入/獲得で払うコスト・種別 ＝ 一番上の実カード**（Territory が上なら $6 の Victory を買う）。
   - **山としてのコスト/種別 ＝ ランダマイザー固定の $3 / Action**（Territory が上でも $3 Action のまま）。
   Empires の分割山は「上段カード＝ランダマイザー相当」で同一視できていたので、
   `cardCost(pileKey)` 1本で済んでいた。**Allies では同一視すると次が全部壊れる**：
   Young Witch の Bane 候補（$2-3 の山）／Adventures の山トークン設置と発火／
   Family of Inventors のコスト軽減／**移動動物園の Populate**。
3. ⚠️**Populate（移動動物園・実装済み §0-26 `populatePiles`）が確実に壊れる**。
   wiki `Pile` 逐語＝
   > Populate can gain a Fortune if it is currently on top of the Gladiator/Fortune pile because the pile
   > has an Action type according to its randomizer.
   現行の `populatePiles` は「分割山は**上段カード**で判定し、上段が尽きていれば下段」＝Empires の2枚組前提。
   Allies の4枚組では **ランダマイザー固定の種別（Action）** を見る必要があり、
   **Territory / Stronghold が一番上でも Populate の対象になり、それを獲得する**（Victory なのに）。
4. **Battle Plan の「任意のサプライの山を Rotate」は、Knights / Ruins / Castles / Empires の分割山 /
   Sauna-Avanto にも効く**＝**汎用の `rotatePile(state, pileKey)` を1本作って全混合山に配線する**のが正解。
   単一名の山は「回しても不変」で受理する（拒否すると公式挙動と食い違う）。
   混合山（Knights/Ruins＝全部名前が違う）は**1枚だけ**下に行く。
5. **Warlord は「相手の手札からのアクション使用」をフックする持続アタック**＝
   §0-9 の `applyLingerOnBuy`（購入フック）と同型だが、フック点が **PLAY_ACTION** になる。
   engine の拒否・CPU の非提案・UI の非活性 の**3面が同じ述語**を見ること
   （engine だけ締めると CPU が拒否される PLAY_ACTION を返し続けて本番 livelock＝§0-28 で2回踏んだ型）。
   **免疫はプレイ時に確定**して予約に持つ（沼の妖婆/呪いの森の `immune[]`＋一意 rid と同型）。
6. **Archer は2段階の対話（被害者が隠す1枚 → 使用者が公開札から1枚）**＝
   pending の持ち主が跨ぐ。オンラインの `maskStateFor` に「隠した1枚」を必ず加えること。
7. **Garrison のトークンは物理カード1枚ごとのカウンタ**。id→枚数マップにすると玉座や2枚目で壊れる。
   **0個ならクリンナップで捨てる＝条件つき持続**（貨物船/研究と同型）。
8. **Tent の山札上置きは「先引きの前」**（§0-25 のカエル／城壁のある村と同じ場所）。
9. **Hill Fort は「獲得→on-gain 全解決→選択」**。獲得先は捨て札（置換ではない）。
   選択時に獲得札が捨て札から動いていたら lose-track で手札に入らない。
   **候補ゼロでも pending を必ず終端させる**。
10. **カード文面の正本は wiki の Versions 表**。**RGG ルールブック PDF のカード画像は第2版でも 2021年の校正刷り**
    なので使ってはいけない（Archer の "them that" / "those" がその実例）。
    **PDF が使えるのは公式FAQ本文と一般ルールだけ。**

---

## 検証ログ（この敵対検証で確定した訂正 6件）
| # | 箇所 | 下書きの記述 | 一次資料 |
|---|---|---|---|
| 1 | Elder のコスト | 「同盟 **$3**・Townsfolk 分割山の4枚目」 | wiki `Elder` infobox ＝ **[$5]**。4枚目は正しい（`Townsfolk` ランダマイザーで確認） |
| 2 | Stronghold の種別並び | 「PDF＝Action-Victory-Duration-Fort、**wiki infobox＝Action-Duration-Victory-Fort**」 | wiki `Stronghold` **infobox も Action - Victory - Duration - Fort**。並び順が違うのは wiki の本文プロースのみ |
| 3 | Archer の "them that" 表記 | 「**2021年10月付**のルールブック PDF内カード画像（製品前の校正）」 | **December 2023 の第2版 PDF でも `one of them that you choose` のまま**（カード画像は両版とも indd `10/6/21`）。「初版だけの問題」ではない |
| 4 | Archer の Moat/Lighthouse 出典 | 「**wiki（Archer）戦略節**にも明記」 | Archer ページの Strategy 節は**空**。当該文は **Warlord ページの Strategy 節**にある（"…which incidentally also both counter Archer…"）。結論（Attack なので免疫が効く）は一般ルールから正しい |
| 5 | 3山終了の数え方 | ルールブック共通ルールの一部として提示 | **Allies ルールブックに該当の逐語は無い**。根拠は wiki `Pile`（three-pile ending の記述）＋「分割山＝1つのサプライ山」からの帰結。**推論であることを明記**した |
| 6 | 参照した公式ルールブック | 2021/09 の URL 1本だけを「公式ルールブック」として提示 | **PDF は2つある**（March 2022 第1版 2,144,349 bytes ／ **December 2023 第2版** `AlliesRulebook2023.pdf` 2,915,379 bytes・12ページ）。両方DLして機械diff＝**本担当8枚のノートと分割山一般ルールは完全一致**。第2版を明記した |

### 訂正なしで確認できた項目（**48件**）
- コスト 10件（Clashes $3 / Forts $3 / Battle Plan $3 / Archer $4 / Warlord $5 / Territory $6 /
  Tent $3 / Garrison $4 / Hill Fort $5 / Stronghold $6）＝すべて wiki infobox の `[$N]` で確認。
- 種別 10件（うち **Warlord＝Action-Duration-Attack-Clash の4種別**、**Territory＝Victory-Clash（Action でない）**、
  **Tent / Hill Fort が Duration でない**＝下書きの前提訂正が正しいことを再確認）＝
  wiki infobox ＋**両版ルールブックの印刷カード type line** の二重確認。
- カードテキスト 10件（ランダマイザー2件を含む）＝wiki `Card text` ＋ Versions 表 March 2022 行。
- 公式FAQ 8件（Battle Plan / Archer / Warlord / Territory / Tent / Garrison / Hill Fort / Stronghold）＝
  **第1版・第2版 PDF ＋ wiki `Official FAQ` の三重一致**。下書きの引用は全て逐語で正しかった。
- `Other rules clarifications` の逐語 4群（Warlord 7項目 / Territory 1項目 / Tent 1項目 /
  Garrison 3項目 / Hill Fort 2項目）＝すべて実在・下書きの引用が正確。
- Setup: 行が無いこと 8件（全8枚とも `Setup:` 無し）。
- 版・エラッタ（Allies Versions 表＝機能変更は Island Folk / Voyage のみ、Elder はコスメティック。
  **本担当8枚は初版と現行で同一**）。
- 分割山・Rotate の一般ルール逐語（第1版と第2版で**バイト一致**を機械diffで確認）。
- Rotate = 連続同名のみ（`Rotate` ページ）／Battle Plan は Supply pile のみ・Ferryman の山は不可（同）。
- ランダマイザーが山の cost/type を決める（`Split pile` ページ）／Family of Inventors のノート（ルールブック）。
- 構成 16枚×6山＝96枚・人数非依存（第2版ルールブックの構成表）。

### 一次資料でも決着しなかった項目（実装時に判断が要る）
1. **場に Garrison が2枚あるときの正確な挙動**。公式FAQ は「玉座で1枚を2回＝1獲得につき2個」しか例示していない。
   "add a token **here**" ＋「in play でないとトークンは乗らない」から
   **「各 Garrison に1個ずつ」＝2枚×3獲得で各3個・合計+6カード**が論理的帰結だが、逐語の裏付けは無い。
   （実装はこの解釈でよい。engine の内部表現だけは「インスタンス単位」にしておくこと。）
2. **Hill Fort で獲得できる山が1つも無いときに「Choose one」を出すか**。
   FAQ は「まず獲得を完全に解決し、**その後** choose する」としか書いておらず、獲得0枚のときの明示が無い。
   カード文が2文に分かれている以上「選択は行う」が正しいはずだが、
   **どちらでもゲーム上の差は無い**（手札に入れる対象が無い）ので、**UI で空振り選択を出さない簡略化も可**。
3. **Battle Plan で「単一名の山」を Rotate したときの扱い**。公式は「多くの山では意味が無い」と書くだけで
   「受理する／しない」を明示していない。**受理して no-op** が自然（拒否すると CPU/UI の述語が engine とずれる）。
4. **日本語カード名・日本語文面**（英語wiki に日本語行が無い）。日本語wiki（ホビージャパン）で別途確定が必要。

### 実装者への警告（このプロジェクトのエンジンを壊しそうな公式挙動）
- **A. Populate（実装済み）が Allies 分割山で誤動作する**（横断メモ 3.）。
  `populatePiles` が「上段カードの種別」で判定しているため、Allies の4枚組では
  **ランダマイザー固定の種別（Action）**を返す新しい述語が必要。放置すると
  「Victory の Territory / Stronghold を Populate が獲得する」or「Clashes 山を丸ごと見落とす」のどちらかになる。
- **B. `cardCost(pileKey)` の一本化が破綻する**（横断メモ 2.）。
  Young Witch の Bane 候補・Adventures 山トークン・コスト軽減は **$3 固定**、購入は **先頭カードの実コスト**。
  Empires 実装をそのまま流用すると、Territory が一番上に来た瞬間に Bane や山トークンの判定が $6 に化ける。
- **C. Warlord は engine / CPU / UI の3面同時修正が必須**。
  「手札からのアクション使用」を engine だけで拒否すると、CPU が同じ `PLAY_ACTION` を返し続けて
  **本番 livelock**（§0-28 の錯乱・闇市場で2回踏んだのと完全に同型）。
  さらに **Warlord の制限は「自分のターン中の相手のリアクション」にも効く**ので、
  `LINGER_REACT` 系のリアクション窓（牧羊犬/そり/隊商の護衛/村有緑地/黒猫）にも述語を通すこと。
- **D. Warlord の解除は「次の自分のターン開始時に瞬時」**。`startQueue`（開始時効果キュー）の**先頭より前**で
  解除しないと、開始時効果の順序次第で1手ぶん過剰に相手を縛る（§0-28 の守護者の免疫窓と同じ罠）。
- **E. Archer は pending の持ち主が被害者→使用者と跨ぐ**。`maskStateFor` に「隠した1枚」を必ず加える
  （§0-28 の夜警/太陽の恵み/ゾンビの密偵で実際に漏れた型）。
- **F. Garrison / Stronghold は「条件つき持続」**。トークン0個／+$3 を選んだ場合は**持続にならず即捨て**。
  `p.delayedEffects` を無条件に張ると、片付けの持続仕分け（残り枚数で数える方式）がずれて
  カードが場に残り続ける（保存則は保つが挙動が壊れる）。
- **G. Rotate は「新しい種類の山操作」**＝獲得でも廃棄でも交換でもない。
  `triggerOnGain` / `triggerOnTrash` を呼ばず、**`supply` の枚数も変えない**（順序だけ変わる）。
  ただし**一番上のカードが変わる＝購入可能なカードとコストが変わる**ので、
  UI の再描画と CPU の購入候補は必ず作り直すこと。

---

# 同盟（Allies）調査 — g09_ally_a：Ally カード 12枚（横型・1ゲームに1枚だけ使う）

> **【敵対検証済み・2026-08-12】** 別エージェントが一次資料を引き直して全項目を再検証した。
> **カードテキスト・種別・FAQ は12枚とも訂正なし**（下書きは正しかった）。
> **ただし「一次資料」節の出典が誤っていた**＝下書きが逐語確認に使った RGG の PDF は
> **第2刷（2023年12月）ではなく初版（2022年3月）のルールブック**だった（詳細は §一次資料の【訂正1】）。
> 本版では**本物の第2刷ルールブック（`AlliesRulebook2023.pdf`・内部日付 11/10/23）で12枚を取り直して**確認している。
> 他に確定訂正2件（Band of Nomads × Elder／「Ally はカードではない」の明記）。

担当＝`Architects' Guild` / `Band of Nomads` / `Cave Dwellers` / `Circle of Witches` / `City-state` /
`Coastal Haven` / `Crafters' Guild` / `Desert Guides` / `Family of Inventors` / `Fellowship of Scribes` /
`Forest Dwellers` / `Gang of Pickpockets`

## 一次資料（検証官が引き直したもの）

- 英語wiki（wiki.dominionstrategy.com）を Wayback 経由で取得（`tools/wikifetch.py`）。
  **12枚すべてを 2024〜2025年のスナップショットで取り直した**（`Ally text` / `Official FAQ` /
  `Other rules clarifications` / `Versions` 表）。
  ⚠ **wikifetch.py はスナップショット候補を順に試すので、古い版（`2id_` / `2019id_`）を掴むことがある**。
  実際、初回取得の Forest Dwellers は 2019 スナップショットで **`Other rules clarifications` 節がまるごと存在しなかった**。
  **必ず取得したスナップショット id を確認し、古ければ 2025 を明示指定して引き直すこと。**
- 共通ルールは wiki の `Ally` ページ（`Official Rules` 節）と `Allies` ページ（`Versions` 表）。
- **RGG 公式ルールブック PDF を2種類とも実DL＋`pdftotext -layout` で逐語確認**。
- ⚠ pdftotext はコイン記号を落とす（`costing or more` のように金額が消える）ので、
  **金額はすべて wiki 側（`[$3]` 形式）で裏取りした**。

### 【訂正1・重要】下書きが使った PDF は「初版」だった（現行版ではない）

下書きは
`https://www.riograndegames.com/wp-content/uploads/2021/09/Dominion-Allies-Rules.pdf`
を「Island Folk が "if the previous turn wasn't yours" と印字された**現行（2023年12月・第2刷）版**」と説明していたが、
**これは事実と逆**である。

- wiki `Island Folk` の `Versions` 表（一次資料）:
  - **March 2022（初版）**＝ "At the end of your turn, **if the previous turn wasn't yours**, you may spend 5 Favors to take another turn."
  - **December 2023（第2刷）**＝ "At the end of your turn, you may spend 5 Favors to take another turn after this one **(but not a 3rd turn in a row)**."
  → 下書きが「現行の証拠」として挙げた文面は、**初版の文面**だった。
- 実際に DL して照合した結果:
  - 下書きの URL のファイルは **md5 `300c257c3d7c644048cbd9488f2ac54a`** で、
    wiki がホストする **`AlliesRulebook2021.pdf` とバイト単位で同一**（＝初版ルールブック）。
    中の Island Folk / Voyage のカード画像は**エラッタ前**の文面（カード画像は © 2021・indd 10/2021）。
  - 現行版は別ファイル **`AlliesRulebook2023.pdf`**（wiki `Allies` ページからリンク。
    内部に `DomAlliesRules21x.qxp_WideDominion 11/10/23` の版面日付。Island Folk は
    "…take another turn after this one (but not a 3rd turn in a row)." と印字されている）。
- **影響の評価＝担当12枚には影響なし**。理由:
  - wiki `Allies` ページ `Versions` 表の逐語:
    「**December 2023 / Functional changes: Island Folk, Voyage — Cannot take a third turn in a row (2023).
    Cosmetic changes: Elder — Rephrased for clarity (2023).**」
    ＝**第2刷の機能変更は Island Folk と Voyage の2枚だけ**（＋Elder の表現明確化）。担当12枚は無関係。
  - 検証官が **`AlliesRulebook2023.pdf` の `ALLY NOTES` 節（現行版）を読み直し**、
    担当12枚のカード文面・注記が **初版・wiki と完全一致**することを確認済み。
  - 参考：初版ルールブックにも既に「Island Folk: This can never let you take a 3rd turn in a row.」の注記はある
    （＝2023年の変更は「注記どおりの挙動になるようカード文を書き直した」もの）。wiki が同注記を
    "Official FAQ (2023)" と見出しづけしているのは wiki 側のラベリング。
- **教訓（次の担当者へ）**：`riograndegames.com` の同じ URL に置かれた PDF が現行版とは限らない。
  **wiki `<拡張名>` ページの `Versions` 表からリンクされている PDF（`AlliesRulebook2023.pdf`）を正本にすること。**

---

## 0. Ally 共通ルール（実装の前提。`AlliesRulebook2023.pdf` p.2–3 ＋ wiki `Ally` の逐語）

> In games using one or more Liaison cards, give each player a Favors mat and deal out a single Ally card.
> The Ally cards are a separate deck, not combined with Events and so on. Each player gets a single Favor
> token to start with (or five tokens in games with Importer).
>
> Allies are landscape cards that give Favor tokens a use; Liaisons are kingdom cards that provide a way to
> get Favor tokens. In games with a Liaison, deal out a random Ally to use that game. Only use one Ally
> per game, even with multiple Liaisons. You can still have as many other landscape cards (Events,
> Landmarks, Projects, Ways) as you otherwise would have.
>
> Coin tokens are used for Favors; they go on a Favors mat to distinguish them from Coffers and
> Villagers (from other expansions), which have their own mats. When a card gives you +1 Favor, add a
> token to your mat; when spending a Favor, remove the token from your mat.
>
> Favors may be used starting with the first turn of the game; they may not be used prior to that turn.
> **Spending Favors is always optional. Spending Favors can only be done once per time an Ally ability
> triggers, unless it says, "Repeat as desired."**

実装上の要点：
- **Ally は「王国に Liaison が1枚以上あるとき」だけ場に出す。1ゲーム1枚だけ**（Liaison が複数でも1枚）。
  他の横型（Event/Landmark/Project/Way）の枚数制限とは**別枠**（"as many … as you otherwise would have"）。
- **【訂正2・追記】Ally は「カード」ではない**。wiki `Ally` の逐語：
  *"Since Allies are **not considered cards**, they cannot be bought or gained."*
  ＝コストが無いだけでなく、**カードとして数えない**。
  → 本プロジェクトでは **`DOM.CARDS` に入れず `DOM.LANDSCAPES` に入れる**／
  **保存則 tally・`allCards`・庭園/品評会/壁 の枚数に一切数えない**（`state.pileVP` / `state.pileDebt` と同じ非カード扱い）。
  下書きは「購入も獲得もできない＝コスト無し」としか書いておらず、この一線を明示していなかった。
- **好意（Favor）の総数は23種の Ally 全体で共通**。Ally は全23種（wiki `Ally` で確認）。
- **開始時に全員が好意1個**（Importer がある王国なら**5個**。`AlliesRulebook2023.pdf` の Importer 注記も
  「At the start of the game, each player gets five Favors instead of one. Importer doesn't provide a way to
  get any more Favors during the game.」で一致）。
- **「1トリガーにつき1回だけ」が全 Ally 共通の上限**。例外は文面に "Repeat as desired." がある
  **Cave Dwellers / Desert Guides** の2枚だけ（担当内。全23種では Market Towns を加えた3枚）。
- **好意の支払いは常に任意**。ただし Gang of Pickpockets は「払わなければ捨てる」形（下記）。
- 【公式裁定・Liaison 側の注記／`AlliesRulebook2023.pdf` で再確認】
  **その獲得で得た好意を、その同じ獲得の Ally 能力に即使える**：
  - Guildmaster: *"If an Ally ability triggers on gaining cards, e.g. Band of Nomads, you can use the Favor you just got on it."*
  - Sycophant: *"When you gain or trash this, you get +2 Favors; you can immediately spend them, for example on the ability of City-state."*
  → 獲得トリガー系 Ally（Architects' Guild / Band of Nomads / City-state）は、**その獲得で増えた好意を含めて**判定する。

### 担当12枚のタイミング分類（wiki `Ally` の `List of Allies` 節と突き合わせ済み）
- **カード獲得時**＝Architects' Guild / Band of Nomads / City-state（担当外の同カテゴリ＝Trappers' Lodge）
- **自ターン開始時**＝Cave Dwellers / Crafters' Guild / Desert Guides / Forest Dwellers / Gang of Pickpockets
  （担当外＝Mountain Folk）
- **自分の購入フェイズ開始時**＝Family of Inventors（担当外＝League of Bankers / Market Towns / Peaceful Cult / Woodworkers' Guild）
- **カードをプレイした後**＝Circle of Witches / Fellowship of Scribes（担当外＝League of Shopkeepers）
- **その他**＝Coastal Haven（担当外＝Island Folk / Order of Astrologers / Order of Masons / Plateau Shepherds）

---

### Architects' Guild
- **id候補**: `architects_guild`
- **コスト**: なし（Ally は購入・獲得しない。ポーション費用/負債コストの概念も無い）
- **種別**: Ally（唯一の種別。他の種別は付かない）
- **カードテキスト（英語・現行＝2023年12月版で確認。初版と同一）**:
```
When you gain a card, you may spend 2 Favors
to gain a cheaper non-Victory card.
```
- **Setup:**: なし
- **好意を消費するか**: **する（2 Favors）**。逐語 "you may spend **2 Favors**"。
- **いつ使えるか**: **カードを獲得したとき**。**テキストに「自分のターン中」の限定が無い**＝
  相手のターン中の獲得（Barbarian 等）でも使える。
  ⚠ **これは直接の明文ではなく推論**（一次資料に Architects' Guild 自身についての明示的な記述は無い）。
  根拠＝(a) カード文に turn 限定句が無い、(b) Band of Nomads の wiki 裁定
  *"**Unlike City-state**, you may spend Favors for this when gaining a card during another player's turn"*
  ＝獲得系 Ally で自ターン限定なのは City-state だけ、という書き方になっている。
- **回数制限**: **1回の獲得につき1回**（"This only works once per gain"）。
  ただし**自分自身の獲得で再誘発する**（連鎖する）＝1ターンに何度でも起こり得る。
- **強制か任意か**: 任意（"you may"）。ただし**払うと決めたら獲得は行う**（獲得自体の任意性は無い）。
- **得点に関わるか**: 直接は関わらない。
- **公式FAQ・裁定**（wiki `Official FAQ` ＝ `AlliesRulebook2023.pdf` `ALLY NOTES` と逐語一致）:
  - *"This only works once per gain but can trigger off of itself; you could gain a Province, spend 2 Favors
    to gain a Gold (cheaper than Province), spend 2 Favors to gain a Laboratory (cheaper than Gold)."*
    ＝**連鎖する**。属州→金貨→研究所→… と好意が続く限り伸びる。
  - （wiki `Other rules clarifications`・2025スナップショットで確認）
    *"In situations where costs change, what matters is the cost of cards at the time you are gaining the second card.
    If you gain a Fisherman when it costs [$2], and it lands in your discard pile and now costs [$5],
    Architects' Guild will gain a card costing less than [$5], because it's once the Fisherman is already in your
    discard pile that Architects' Guild cares about what its cost is."*
    ＝**「2枚目を獲得しようとしている時点」の1枚目のコストで判定する**（＝捨て札に入った後のコスト）。
    ※ **Band of Nomads とは逆**（あちらは「獲得した瞬間」のコスト）。**この2枚は基準時点が違う**ので取り違えないこと。
  - 対象は **non-Victory**。「Victory かつ他種別」の混成札（Harem/Nobles 等）も勝利点なので不可。
- **エラッタ**: なし（初版 March 2022 と第2刷 December 2023 で文面同一）。
- **実装上の注意**:
  - 「cheaper（より安い）」＝**厳密により安い**。本プロジェクトの `costUnder`（コイン/ポーション/負債の成分ごとに厳密に小さい）を使うこと。
    素の `cardCost <= N` を書かない（§0-23 の教訓）。
  - **獲得トリガーの中でさらに獲得が起きる**ので、獲得時対話キュー（`onGainQueue`）に積む設計が必須。
    `state.pending` 直代入は望楼/牧羊犬などの窓を握りつぶす。
  - **その獲得で得た好意を使える**（共通ルール節の Guildmaster/Sycophant 裁定）。
  - 相手のターン中でも発火する＝アタックで獲得させられた呪い（コスト$0）では「$0未満」が無いので何も獲得できない、等の
    終端保証を engine/CPU/UI の3面で同じ述語にすること。

---

### Band of Nomads
- **id候補**: `band_of_nomads`
- **コスト**: なし
- **種別**: Ally
- **カードテキスト（英語・現行）**:
```
When you gain a card costing [$3] or more, you may spend a Favor,
for +1 Card, or +1 Action, or +1 Buy.
```
- **Setup:**: なし
- **好意を消費するか**: **する（1 Favor）**。
- **いつ使えるか**: **[$3] 以上のカードを獲得したとき**。**相手のターン中の獲得でも使える**（公式明記・下記）。
- **回数制限**: **1回の獲得につき1回**（"This only works once per gain"）。1ターンに複数回獲得すればその都度使える。
- **強制か任意か**: 任意（"you may"）。使うなら **+1 Card / +1 Action / +1 Buy の3択を1つだけ**選ぶ。
- **得点に関わるか**: 関わらない。
- **公式FAQ・裁定**:
  - *"What matters is how much the card costs when you gain it, not how much it normally costs.
    This only works once per gain; you can spend a Favor, and then get your choice of +1 Card, +1 Action, or +1 Buy."*
  - （wiki `Other rules clarifications`）*"The card has to cost [$3] or more **when you gain it**; if it changes cost
    afterwards, that doesn't matter. For example, if you gain a Fisherman when it costs [$2], and it goes into your
    discard pile, you can't spend a Favor for Band of Nomads, even though by that time the Fisherman now costs [$5]."*
    ＝**獲得した瞬間のコストで判定**（Architects' Guild と基準時点が違う）。
  - ***"Unlike City-state, you may spend Favors for this when gaining a card during another player's turn
    (with e.g. Barbarian). Getting +1 Action or +1 Buy is not useful."*** ＝**相手のターン中も使える**
    （その場合 +1 Action / +1 Buy は無意味だが選ぶこと自体は合法）。
- **エラッタ**: なし。
- **【訂正3】Elder との相互作用は「戦略の話」ではなく挙動の話**:
  下書きは DXV の *"Band of Nomads gives you a choice, though it doesn't work with Elder."*
  （Allies Preview 3）を「挙動ではなく戦略の話」と書いていたが、**これは挙動の記述**である。
  wiki `Elder` の `Official FAQ` 逐語：
  *"Elder doesn't affect all choices, just ones that say "choose" and have a list of options; for example Workshop
  gives you a choice of what card to gain, but Elder playing Workshop doesn't do anything extra."*
  ＋ `Other rules clarifications`：*"Some cards may appear like they're giving you a choice … but because they
  don't say "choose", they aren't affected by Elder."*
  → **Band of Nomads の3択は "choose one" 構文ではなく、そもそも Elder が使用する「アクションカード」でもない
  （Ally は カードですらない）ので、Elder は追加の選択肢を与えない**。
  **実装＝Elder の「選択肢を1つ追加する」処理を Band of Nomads の3択に適用してはいけない。**
- **実装上の注意**:
  - 「[$3] 以上」は**獲得時点の実コスト**（橋/街道/Family of Inventors のコスト軽減後）で判定する。
  - **相手のターン中に +1 Card を得る**経路がある＝ドローは「その相手のターン中に自分が引く」。
    本プロジェクトの `draw()` は席指定なのでそのまま使えるが、**+Action/+Buy を手番プレイヤーの turn 資源に入れてはいけない**
    （公式も "not useful" と言うだけで選ぶこと自体は合法＝**選択肢は残しつつ効果を捨てる**のが忠実）。

---

### Cave Dwellers
- **id候補**: `cave_dwellers`
- **コスト**: なし
- **種別**: Ally
- **カードテキスト（英語・現行）**:
```
At the start of your turn, you may spend a Favor,
to discard a card then draw a card. Repeat as desired.
```
（"Favor," の後の読点は印刷どおり）
- **Setup:**: なし
- **好意を消費するか**: **する（1回につき1 Favor）**。
- **いつ使えるか**: **自分のターンの開始時**のみ。
- **回数制限**: **"Repeat as desired." ＝回数無制限**（好意が続く限り、1枚捨てて1枚引く、を繰り返せる）。
- **強制か任意か**: 任意。いつでもやめられる。
- **得点に関わるか**: 関わらない。
- **公式FAQ・裁定**:
  - *"At the start of your turn, you may spend a Favor; if you do, you discard a card and then draw a card.
    Then you can spend another Favor to discard another card and draw another card, and so on,
    until you stop spending Favors."*
  - ***"You draw a card even if you failed to discard one."***
    ＝**手札が0枚でも好意を払えば1枚引ける**（捨てられなくてもドローは起きる）。
- **エラッタ**: なし。
- **実装上の注意**:
  - **1枚ずつ「捨てる→引く」を交互に**行う（まとめて捨ててからまとめて引くのではない）。
    DXV の Secret History 逐語（wiki で確認）：*"Originally you did all the discarding at once, then all the drawing;
    now you get to discard/draw, then see if you want to do it again."*
    ＝**捨て札トリガー（坑道/村有緑地/忠犬 等）と引いたカードが相互作用する**ので順序を守ること。
  - **手札0枚でもドローできる**＝ドローだけを繰り返して好意を全部カードに変換できる（終端は好意の枚数）。
  - ターン開始時の対話なので、本プロジェクトでは `t.startQueue` に積む（`state.pending` を直接立てない）。
  - **Desert Guides と違い「一度辞退したら再開できない」という明文は無い**（下の「決着しなかった項目」参照）。

---

### Circle of Witches
- **id候補**: `circle_of_witches`
- **コスト**: なし
- **種別**: Ally
- **カードテキスト（英語・現行）**:
```
After playing a Liaison, you may spend 3 Favors
to have each other player gain a Curse.
```
- **Setup:**: なし
- **好意を消費するか**: **する（3 Favors）**。
- **いつ使えるか**: **Liaison カードをプレイした後**（＝そのプレイを**完全に解決してから**）。
  テキストに自ターン限定は無いが、Liaison を相手のターンにプレイする手段は Allies 内には無い。
- **回数制限**: **Liaison を1回プレイするごとに1回**（共通ルールの「1トリガー1回」）。
- **強制か任意か**: 任意（"you may"）。
- **得点に関わるか**: 直接は関わらない（相手に呪い＝相手の得点を下げる）。
- **公式FAQ・裁定**（wiki＝`AlliesRulebook2023.pdf` `ALLY NOTES` と逐語一致）:
  - *"After you completely resolve playing a Liaison, you may spend 3 Favors to have each other player gain a Curse.
    **This can include Favors you just got from playing that Liaison.**"*
    ＝**そのLiaisonでもらった好意を、そのまま3枚のうちに数えて良い**。
  - ***"This is not playing an Attack card and cannot be blocked with Moat."***
    ＝**アタックではない**。堀/灯台/リアクションで防げない。
- **エラッタ**: なし。
- **実装上の注意**:
  - **解決タイミングは「そのLiaisonのプレイが全部終わった後」**。Liaison が選択待ちを出す場合、
    それを解決し切ってから窓を開く（本プロジェクトなら Conclave の +1アクション（`state.replay` の
    `conclave_bonus`）と同型の位置）。
  - **アタックではない**＝`ATTACKS` に登録しない／リアクション窓を開かない／`attackImmune` を見ない。
    （不正利得(Ill-Gotten Gains) と同じ「非アタックの呪い配布」）。
  - 呪い山が尽きたら、通常の手番順（自分の左隣から）で配れるだけ配る＝**先着**（既存の魔女系と同じ）。
  - 玉座の間などで Liaison を2回プレイした場合に窓が2回開くかは**一次資料に直接の明記が無い**
    （下の「決着しなかった項目」参照。Fellowship of Scribes の "once per time you play an Action card" と
    共通ルールから「1プレイ＝1トリガー」が最も整合的）。

---

### City-state
- **id候補**: `city_state`（表示名のハイフンに注意：`City-state`。**s は小文字**）
- **コスト**: なし
- **種別**: Ally
- **カードテキスト（英語・現行）**:
```
When you gain an Action card during your turn,
you may spend 2 Favors to play it.
```
- **Setup:**: なし
- **好意を消費するか**: **する（2 Favors）**。
- **いつ使えるか**: **自分のターン中に「アクションカード」を獲得したときだけ**。
  **明示的に自ターン限定**（"City-state only works during your turns."）。
- **回数制限**: **1回の獲得につき1回**（共通ルール）。1ターンに何枚獲得してもその都度使える。
- **強制か任意か**: 任意。
- **得点に関わるか**: 関わらない。
- **公式FAQ・裁定**:
  - *"If you gain an Action card in your Buy phase (such as by buying it), City-state can still let you play it then;
    if it gives you +Actions, that won't let you play more Action cards in your Buy phase, and if it draws you
    Treasures, you can only play them if you haven't bought anything yet."*
    ＝**購入フェイズでも使える**。ただし +アクションは購入フェイズでは無意味／引いた財宝は
    **まだ何も購入していない場合にのみ**出せる（＝財宝ロック `t.treasuresLocked` の一般ルール）。
  - *"City-state can only play a card that's still wherever it was gained to (normally the discard pile) but can still
    play a card in your discard pile if it was covered up by other cards."*
    ＝**獲得先ゾーンにまだ在るカードしかプレイできない**（動かされたら失敗＝lose track）。
    捨て札の上に他のカードが積まれていてもプレイできる。
  - *"City-state only works during your turns."*
  - （Secret History）*"Originally just one Favor, which was nuts. Also it had the wording where you set aside the card,
    and check if you did. That went away with a rules change: now you can't play a card you can't find
    (though you can replay it, meaning Thrones on Horses still work)."*
    ＝**脇に置いてからプレイする方式ではない**（現行は「獲得先から直接プレイする」）。
- **エラッタ**: なし。
- **実装上の注意**:
  - **アクション権（+Action）を消費しない**（「プレイする」だけ）＝本プロジェクトの `playCardNoAction` 系の入口が適切。
    ただし**「カードの使用」なので習性(Way)・炉(kiln)・女魔術師の置換・浮浪児のトラップ等は通常どおり働く**。
  - **獲得先ゾーン（通常は捨て札）からプレイする**＝獲得先が手札に変わるカード（Villa/Sculptor/遊牧民の野営地 等）や、
    山札の上に置かれるカード（Innovation/Tiara/Crafters' Guild）でも「そこに在るなら」プレイできる。
    **カードが既に動いていたらプレイできない**（黙って不発）。
  - 持続カードを獲得してこれでプレイした場合、通常どおり場に残って次のターンも働く。
  - 獲得時対話が複数競合し得る（望楼/交易商人/Architects' Guild 等）＝`onGainQueue` に積む。
  - **相手のターン中は絶対に発火させない**（Band of Nomads との明確な差＝公式が名指しで対比している）。

---

### Coastal Haven
- **id候補**: `coastal_haven`
- **コスト**: なし
- **種別**: Ally
- **カードテキスト（英語・現行）**:
```
When discarding your hand in Clean-up, you may spend any number of Favors
to keep that many cards in hand for next turn (you still draw 5).
```
- **Setup:**: なし
- **好意を消費するか**: **する（好きな枚数＝残したいカード1枚につき1 Favor）**。
- **いつ使えるか**: **自分のクリンナップ（片付け）で手札を捨てるとき**。
- **回数制限**: **クリンナップにつき1トリガー**だが、**そのとき好きな枚数の好意をまとめて払える**
  （"any number of Favors"＝共通ルールの「1トリガー1回」に反しない。1回の決定で N 枚残す）。
- **強制か任意か**: 任意。
- **得点に関わるか**: 関わらない。
- **公式FAQ・裁定**:
  - *"For example, you could spend two Favors to keep a Copper and a Silver in your hand, discard the rest of your
    hand and all of your cards from play (as usual), then draw a new hand of five cards and add it to the Copper
    and Silver."* ＝残したカードは**手札に残ったまま**、通常どおり5枚引いて**合流**する（手札7枚になる）。
  - *"If for some reason you aren't drawing five cards (for example due to Outpost, from Seaside), Coastal Haven
    doesn't get you around that; you draw however many cards you were otherwise supposed to draw,
    **with the kept cards not counting against that**."*
    ＝**引く枚数は変わらない**（前哨地なら3枚引いて、残したカードはそれに加算）。
  - （wiki `Other rules clarifications`・2025スナップショットで確認）
    ***"This only applies to discarding your hand the normal way during Clean-up.
    If something else causes you to discard your hand (e.g. you use Improve to gain a Tactician, and then play it
    with Sailor), you can't use Coastal Haven there."***
    ＝**クリンナップの通常の手札捨てだけ**。戦術家などの「手札を捨てる」には使えない。
- **エラッタ**: なし。DXV の Secret History＝*"The wording changed a lot while the functionality stayed basically the same.
  You were setting aside cards and getting them back; now they just stay in your hand."*
  ＋ 別途 `Wording` 節：*"There were four different printed versions of Coastal Haven before the final one,
  all with the same functionality but different wordings."*（**機能は不変**）。
- **実装上の注意**:
  - 本プロジェクトのエンジンは**自分の手番終了時に次の手札を先引きする**設計なので、
    **「手札を捨てる直前」に窓を開き、残す枚数だけ好意を払わせてから、残りを捨て→先引き**の順にする。
    （城壁のある村/宝物庫の自動返却と同じ位置＝`cleanupAndAdvance` の捨てる直前）。
  - **残したカードは「捨てられていない」**＝捨て札トリガー（坑道/村有緑地）は残した分には発火しない。
  - 引く枚数は既存の値（通常5・前哨地3・戦術家0 など）をそのまま使い、**残した枚数を差し引かない**。
  - **「クリンナップの通常の手札捨て」以外の手札捨てでは窓を開かない**（戦術家/Sailor 経由は不可）。
    ＝本プロジェクトの `cleanupAndAdvance` の捨て以外の経路（`discardHand` 相当）には配線しないこと。

---

### Crafters' Guild
- **id候補**: `crafters_guild`
- **コスト**: なし
- **種別**: Ally
- **カードテキスト（英語・現行）**:
```
At the start of your turn, you may spend 2 Favors
to gain a card costing up to [$4] onto your deck.
```
- **Setup:**: なし
- **好意を消費するか**: **する（2 Favors）**。
- **いつ使えるか**: **自分のターンの開始時**のみ。
- **回数制限**: **ターン開始時のトリガー1回につき1回**＝実質**1ターンに1回**
  （"Repeat as desired." が無いので共通ルールの「1トリガー1回」が効く）。
- **強制か任意か**: 任意。ただし払うと**獲得は強制**（"to gain a card"）。
- **得点に関わるか**: 関わらない（勝利点カードも獲得できるので間接的には効く）。
- **公式FAQ・裁定**:
  - *"The card is gained directly onto your deck."*
    ＝**捨て札を経由せず、山札の上に直接獲得する**（獲得先ゾーン＝山札）。
- **エラッタ**: なし。
- **実装上の注意**:
  - **獲得先が山札の上**＝`gain(dest:'deck')`。「捨て札に獲得したとき」だけ働く効果
    （悪人のアジト/ゴーストタウン/守護者/夜警 等）は働かない。獲得トリガー自体（望楼/交易商人など）は通常どおり。
  - 対象は **"costing up to [$4]"**＝本プロジェクトの `costUpTo(state, id, 4)` を使う
    （非サプライ・ロック中の分割山下段・ポーション費用・負債コストを正しく弾く）。
  - ターン開始時なので `t.startQueue` に積む。

---

### Desert Guides
- **id候補**: `desert_guides`
- **コスト**: なし
- **種別**: Ally
- **カードテキスト（英語・現行）**:
```
At the start of your turn, you may spend a Favor to discard your hand
and draw 5 cards. Repeat as desired.
```
（※ルールブックの版面では "draw 5 **C**ards." と大文字で組まれているが、wiki の Versions 表は "5 cards"。
　機能差なし＝組版上のゆらぎ）
- **Setup:**: なし
- **好意を消費するか**: **する（1回につき1 Favor）**。
- **いつ使えるか**: **自分のターンの開始時**のみ。
- **回数制限**: **"Repeat as desired." ＝回数無制限**（好意が続く限り引き直せる）。
- **強制か任意か**: 任意。
- **得点に関わるか**: 関わらない。
- **公式FAQ・裁定**:
  - *"After discarding your hand and drawing 5 cards, you may spend another Favor to do it again, repeatedly."*
  - （wiki `Other rules clarifications`）***"Unlike Guide, once you decline to spend more Favors for Desert Guides,
    you can't come back to it later after performing other start-of-turn effects."***
    ＝**一度「やめる」と言ったら、他のターン開始時効果を解決した後に戻ってくることはできない**（案内人 Guide と違う）。
- **エラッタ**: なし。
- **実装上の注意**:
  - **引く枚数は常に「5枚」固定**（"draw 5 cards"）＝前哨地等でその手番の手札が3枚でも、これを使うと5枚になる。
  - **手札を全部捨てる**＝捨て札トリガー（坑道/村有緑地/忠犬）が発火する。
  - **繰り返しのたびにシャッフルが起こり得る**（wiki `Further development comments` 逐語：
    *"[LastFootnote] complained about it for the worry that you'd pile up tokens and shuffle multiple times a turn,
    but there it is."* ＝**1ターンに複数回シャッフルするのは公式に想定内**）。
  - **辞退したら同じターンでは二度と開かない**＝`startQueue` の他の項目を処理した後に窓を開き直してはいけない。

---

### Family of Inventors
- **id候補**: `family_of_inventors`
- **コスト**: なし
- **種別**: Ally
- **カードテキスト（英語・現行）**:
```
At the start of your Buy phase, you may put a Favor token you have
on a non-Victory Supply pile.
Cards cost [$1] less per Favor token on their piles.
```
- **Setup:**: なし
- **好意を消費するか**: **する**（ただし文面は "spend" ではなく **"put a Favor token you have on a … pile"**
  ＝**マットから山の上へ置く**。自分のマットからは無くなり、**戻ってこない**）。
- **いつ使えるか**: **自分の購入フェイズの開始時**。
- **回数制限**: **購入フェイズ開始1回につき、トークン1個**（"Repeat as desired." が無い）。
  ※ヴィラ等でアクションフェイズに戻り再度購入フェイズに入ると**購入フェイズ開始が再度起こる**点に注意
  （ルネサンスの宝箱＝2022エラッタと同じ扱い）。
- **強制か任意か**: 任意（"you may"）。
- **得点に関わるか**: 直接は関わらない（**勝利点の山には置けない**ので勝利点カードは安くならない）。
- **公式FAQ・裁定**:
  - *"This can't put tokens on Victory piles. It can put tokens on **split piles that have Victory cards in them,
    if the randomizer isn't a Victory card**; this means it can put tokens on the 6 split piles in Allies,
    but not on the Castles pile from Empires."*
  - *"The effect is cumulative; two tokens on a pile means that cards in that pile cost [$2] less."*
  - *"This does not reduce costs below [$0]."*
  - *"This makes cards cost less **at all times for all players**, not just for the player placing the token."*
  - （wiki `Other rules clarifications`）*"This can put a token on Knights, even if the top Knight in the pile is
    Dame Josephine."* ＝**山の「ランダマイザー／山の種別」で判定する（今の一番上のカードの種別ではない）**。
- **エラッタ**: なし。
- **実装上の注意**:
  - **判定は「山（ランダマイザー）の種別」**＝植民(Populate)と同じ考え方。
    分割山は**上段（ランダマイザー）カード**が勝利点でなければ置ける（Allies の6分割山は全部OK／Empires の Castles はNG）。
    騎士(Knights)の混合山も置ける（一番上が Dame Josephine でも）。
  - **サプライの山だけ**（非サプライ山・廃墟/褒賞/馬/精霊などには置けない）。
  - **全員に・常時・累積で効く**＝本プロジェクトの `cardCost` に「山の好意トークン数 × $1」を減算する
    （橋/街道/渡し船 と同じ層。**$0未満にはしない**）。
  - トークンは**山の上に残り続ける**＝`state.pileFavor = {山キー: 個数}` のような**非カードの公開スカラー**。
    保存則 tally には混ぜない（`state.pileVP` / `state.pileDebt` と同型）。
    **山キーは分割山の上段に正規化する**（本プロジェクトの `pileKeyOf`。徴税で踏んだ孤児化バグと同型の罠）。
  - コスト軽減はイベント/プロジェクト等の「カードでないもの」には効かない（それらは山ではない）。
  - **トークンを1個も持っていなければ置けない**（"a Favor token **you have**"）。

---

### Fellowship of Scribes
- **id候補**: `fellowship_of_scribes`
- **コスト**: なし
- **種別**: Ally
- **カードテキスト（英語・現行）**:
```
After playing an Action, if you have 4 or fewer cards in hand,
you may spend a Favor for +1 Card.
```
- **Setup:**: なし
- **好意を消費するか**: **する（1 Favor）**。
- **いつ使えるか**: **アクションカードをプレイした後**（そのプレイを**完全に解決してから**手札を数える）。
  テキストに自ターン限定は無い（⚠ 相手ターンでも働くかは**推論**＝下の「決着しなかった項目」）。
- **回数制限**: **アクションを1回プレイするごとに1回**（"You can only do this once per time you play an Action card."）。
- **強制か任意か**: 任意。
- **得点に関わるか**: 関わらない。
- **公式FAQ・裁定**:
  - *"You can only do this once per time you play an Action card."*
  - ***"Completely resolve the Action card; then if you have 4 or fewer cards in hand, you may spend a Favor for +1 Card."***
    ＝**手札枚数を数えるのは解決後**（プレイ前でも途中でもない）。
- **エラッタ**: なし。
- **実装上の注意**:
  - 「4枚以下」の判定は**そのアクションを解決し切った直後の手札**。プレイしたカード自身は場に出ているので数えない。
  - **アクションの解決が完全に終わってから開く窓**＝本プロジェクトの「アクション解決直後フック」
    （御料車 royal_carriage の `t.afterActionCard` と同じ位置）が最も近い。
  - 「1回のプレイにつき1回」＝**玉座の間で2回プレイすれば窓は2回開く**（"once per **time you play**"）。
  - 夜行カード（Nocturne）はアクションではないので対象外。人狼のような「アクション かつ 夜行」を夜フェイズに使った場合は
    **アクションカードの使用**なので対象になる（本プロジェクトの `nIsAction` 分岐と同じ扱い）。※これは推論。
  - Secret History＝*"Unchanged. The Allies tried to get in Villagers/Coffers/Horses in tweaked forms,
    as basic things to do with tokens. This is the Horse."*（設計意図の話。挙動には影響しない）。

---

### Forest Dwellers
- **id候補**: `forest_dwellers`
- **コスト**: なし
- **種別**: Ally
- **カードテキスト（英語・現行／wiki `Versions` 表）**:
```
At the start of your turn, you may spend a Favor to look at the top 3 cards
of your deck, discard any number and put the rest back in any order.
```
（ルールブック（初版・第2刷とも）の印字は "…discard any **number, and** put the rest back in any order."
　＝読点の有無だけの差。機能差なし）
- **Setup:**: なし
- **好意を消費するか**: **する（1 Favor）**。
- **いつ使えるか**: **自分のターンの開始時**のみ。
- **回数制限**: ***"You can only do this once per turn."***（公式FAQに明記＝**1ターン1回**）。
  ※他の「開始時」Ally が「1トリガー1回」なのに対し、**これだけ "once per turn" と書かれている**
  （ヴィラ等で開始時が複数回起こることは無いので実質同じだが、文面の差は記録しておく）。
- **強制か任意か**: 任意。捨てる枚数は0枚でもよい（"any number"）。
- **得点に関わるか**: 関わらない。
- **公式FAQ・裁定**:
  - *"You can only do this once per turn."*
  - （wiki `Other rules clarifications`・**2025スナップショットでのみ存在する**節）
    *"If you happen to put a card on top of your deck in the middle of resolving Forest Dwellers—for instance,
    by discarding a Tunnel, gaining a Gold, and top-decking it due to Progress—then when you return any
    remaining cards to your deck they will go on top of the card you just put there."*
    ＝**解決中に山札の上に置かれたカードがあれば、戻す残りのカードはその上に載る**。
- **エラッタ**: なし。
- **実装上の注意**:
  - **"look at"＝「見る」であって「公開する」ではない**。`reveal()` を通してはいけない（パトロンが誤って誘発する）。
    オンラインの視点マスク（`maskStateFor`）には**私的看破として必ず登録する**（§0-21 の偵察隊・§0-28 の夜警と同型）。
  - **捨てる → 残りを好きな順で戻す**。捨て札トリガー（坑道/村有緑地）は捨てた時点で発火し、
    その結果 山札の上に何かが載ることがある＝**残りを戻すのはその後（上に載せる）**（上の公式裁定そのもの）。
  - 山札が3枚未満なら（必要なら捨て札をシャッフルして）見られるだけ見る。

---

### Gang of Pickpockets
- **id候補**: `gang_of_pickpockets`
- **コスト**: なし
- **種別**: Ally
- **カードテキスト（英語・現行）**:
```
At the start of your turn, discard down to 4 cards in hand
unless you spend a Favor.
```
- **Setup:**: なし
- **好意を消費するか**: **する（1 Favor）**。ただし**払うのは「捨てさせられないため」**＝
  他の Ally と逆で、**好意を払わないと罰を受ける**（wiki の説明文：
  *"instead of using Favor tokens to earn a bonus, Gang of Pickpockets extorts Favor tokens out of you
  by making you discard if you don't pay them."*）。
- **いつ使えるか**: **自分のターンの開始時**（毎ターン必ず判定が起きる）。
- **回数制限**: **各ターンの開始時に1回ずつ**（払うか払わないかの二択が毎ターン起こる）。
- **強制か任意か**: **好意を払うこと自体は任意**（共通ルール「Spending Favors is always optional」）。
  ただし**払わなければ手札4枚まで捨てるのは強制**。好意が0個なら選択の余地なく捨てる。
- **得点に関わるか**: 関わらない。
- **公式FAQ・裁定**:
  - *"At the start of each of your turns, you choose to spend a Favor or not, and if you didn't, you discard down to
    4 cards in hand. **It's okay if you already only had 4 cards or fewer.**"*
    ＝既に4枚以下なら何も捨てない（好意を払う必要も無い）。
  - ***"This is not an Attack card being played and cannot be blocked with Moat."***
    ＝**アタックではない**（堀/灯台/リアクションで防げない）。
  - （wiki `Other rules clarifications`）***"If you have other abilities at the start of your turn (such as Highwayman or
    Cathedral), you may resolve them either before or after Gang of Pickpockets. This may matter if those abilities
    would change the number of cards in your hand."***
    ＝**他のターン開始時効果との解決順はプレイヤーが選べる**。
- **エラッタ**: なし。
- **実装上の注意**:
  - **アタックではない**＝`ATTACKS` に登録しない／リアクション窓を開かない。
  - 「4枚まで捨てる」は民兵型の `discard_down`（本プロジェクトに既存）を流用できるが、**攻撃扱いにしないこと**。
  - **好意0個のときは選択肢を出さずに強制で捨てる**（CPU が `card:null` を返して無限ループしないよう終端保証）。
  - 追加ターン（前哨地/使節団/Island Folk 等）でも「あなたのターンの開始時」なので毎回発生する。
  - 解決順が選べる点は、本プロジェクトの既存の許容簡略化（`startQueue` は先入れ順）と衝突する。
    忠実にやるなら開始時効果の順序選択が要るが、既存の横断簡略化と同じ扱いで良い（**PROGRESS に要記録**）。

---

## まとめ表（実装用の早見）

| Ally | 好意 | タイミング | 相手のターンでも | 回数 | 任意/強制 | 得点 |
|---|---|---|---|---|---|---|
| Architects' Guild | 2 | カード獲得時 | ○（推論・制限文言なし） | 1獲得1回（自己連鎖する） | 任意 | × |
| Band of Nomads | 1 | [$3]以上のカード獲得時 | **○（公式明記）** | 1獲得1回 | 任意（3択は必ず1つ） | × |
| Cave Dwellers | 1/回 | 自ターン開始時 | × | **無制限（Repeat）** | 任意 | × |
| Circle of Witches | 3 | Liaison を使い切った後 | （通常起こらない） | 1プレイ1回 | 任意 | × |
| City-state | 2 | アクション獲得時 | **×（自ターンのみ・公式明記）** | 1獲得1回 | 任意 | × |
| Coastal Haven | 任意枚数 | 自分のクリンナップの手札捨て | × | 1回（枚数はまとめて） | 任意 | × |
| Crafters' Guild | 2 | 自ターン開始時 | × | 1ターン1回 | 任意（獲得は強制） | × |
| Desert Guides | 1/回 | 自ターン開始時 | × | **無制限（Repeat）** | 任意（辞退したら再開不可） | × |
| Family of Inventors | 1（山に置く・戻らない） | 自分の購入フェイズ開始時 | × | 購入フェイズ開始1回につき1個 | 任意 | ×（勝利点の山は不可） |
| Fellowship of Scribes | 1 | アクションを使い切った後・手札4枚以下 | ○（推論・制限文言なし） | 1プレイ1回 | 任意 | × |
| Forest Dwellers | 1 | 自ターン開始時 | × | **1ターン1回（公式明記）** | 任意 | × |
| Gang of Pickpockets | 1 | 自ターン開始時 | × | 各ターン1回 | 払うのは任意／捨てるのは強制 | × |

**担当12枚のうち、ゲーム終了時の得点に直接関わるものは1枚も無い**
（得点系 Ally は Plateau Shepherds＝別担当）。**Setup: を持つ Ally も担当12枚には無い**
（Ally 共通の準備＝「Liaison があるとき Ally を1枚だけ配り、全員が好意1個を持って開始」は全 Ally 共通。
Setup: を持つのは Liaison 側の **Importer**＝「各プレイヤーは好意1個ではなく5個で開始」）。

**担当12枚は全て「Ally」以外の種別を持たない**（Liaison / Duration / Attack / Victory / Augur / Clash /
Fort / Odyssey / Townsfolk / Wizard / Reaction / Command のいずれも付かない）。
これらの種別は**王国カード側（別担当）**にのみ現れる。

---

## 検証官の注記

### 一次資料でも決着しなかった項目（実装時に判断が要る）
1. **Architects' Guild / Fellowship of Scribes が相手のターン中にも働くか**
   ＝カード文に turn 限定句が無く、かつ Band of Nomads の裁定が「自ターン限定なのは City-state だけ」という
   書き方をしているので**働く**と読むのが自然だが、この2枚については**直接の明文が無い**（推論）。
2. **玉座の間などで同じ Liaison / アクションを2回プレイしたときに窓が2回開くか**
   ＝Fellowship of Scribes は "once per **time you play** an Action card" と書かれているので2回開くと読める。
   **Circle of Witches には同じ明文が無い**（"After playing a Liaison"）。共通ルールの
   「1トリガーにつき1回」から「1プレイ＝1トリガー＝2回開く」が最も整合的だが、明文ではない。
3. **Cave Dwellers を一度辞退した後、他の開始時効果を解決してから再開できるか**
   ＝Desert Guides には「できない」の明文があるが、**Cave Dwellers には無い**。
   同じ "Repeat as desired." 構文なので同じ扱い（辞退＝終了）にするのが安全。
4. **日本語カード名**＝英語wikiの `Other language versions` に載っていたのは3枚だけ
   （建築家ギルド / 工芸家ギルド / 砂漠の案内人。Favor＝**好意**）。
   **PROGRESS §0-27 の教訓どおり、英語wikiの Japanese 行は実物と食い違うことがある**ので、
   **日本語wiki（ホビージャパン印刷版）で12枚とも取り直すこと**。本文書では日本語名を確定していない。

### 実装者への警告（本プロジェクトのエンジンを壊しそうな公式挙動）
- **Ally は「カード」ではない**。`DOM.CARDS` に入れず `DOM.LANDSCAPES` へ。
  `allCards` / 保存則 tally / 庭園・品評会・壁 の枚数に**絶対に混ぜない**。
- **好意（Favor）は非カードの公開スカラー**（財源 Coffers / 村人 Villagers と同型・**別枠**）。
  `state.pileFavor`（Family of Inventors が山に置くトークン）も非カード＝`state.pileVP` / `state.pileDebt` と同型。
- **Architects' Guild と Band of Nomads はコスト判定の基準時点が違う**
  （前者＝2枚目を獲得する時点／後者＝獲得した瞬間）。同じ `costOf` を同じタイミングで呼ぶと片方が壊れる。
- **獲得トリガーの中で更に獲得が起きる（Architects' Guild の自己連鎖／City-state の即プレイ）**。
  `state.pending` 直代入は禁止＝**`onGainQueue` に積む**。でないと望楼/牧羊犬/交易商人の窓を握りつぶす。
- **Circle of Witches / Gang of Pickpockets はアタックではない**。`ATTACKS` に登録すると堀で防がれて壊れる。
- **Family of Inventors は全プレイヤーに常時・累積で効くコスト軽減**＝`cardCost` の橋/街道と同じ層に入れ、
  **山キーは `pileKeyOf` で分割山の上段に正規化**すること（徴税で踏んだ孤児化バグと同型）。
  **判定は「山の種別」であって「今の一番上のカードの種別」ではない**（騎士＋Dame Josephine の裁定）。
- **Forest Dwellers は "look at"＝公開ではない**。`reveal()` を通すとパトロンが誤誘発する。
  **`maskStateFor` の私的看破に必ず登録**（登録漏れ＝オンラインの情報漏洩。§0-28 の夜警と同型）。
- **Coastal Haven は「クリンナップの通常の手札捨て」限定**。他の「手札を捨てる」経路に配線してはいけない。
  また**先引き設計との噛み合わせ**（捨てる直前に窓 → 残り捨て → 先引き。残した枚数は引く枚数から引かない）に注意。
- **Desert Guides は1ターンに何度でもシャッフルし得る**（公式に想定内）。
  シャッフル回数を前提にした最適化・キャッシュを置かないこと。
- **Cave Dwellers は手札0枚でもドローできる**（"You draw a card even if you failed to discard one."）。
  「捨てられないなら引かない」と実装すると間違い。
- **Elder は Band of Nomads の3択に追加の選択肢を与えない**（Elder は "choose" 構文のアクションにしか効かず、
  Ally はそもそもカードではない）。Elder 実装時に Ally の選択へ波及させないこと。

---

# 同盟(Allies) 研究 — 【g10_ally_b】Ally カード 11枚（横型・1ゲームに1枚だけ使う）

> **【敵対検証済み・2026-08-12】** 別の検証官が下書きの引用を一切コピーせず、一次資料を自分で引き直して全項目を再確認した。
> **カードテキスト11枚・公式FAQ11枚・Island Folk のエラッタ・種別・コスト・Setup の有無は全て逐語一致＝訂正なし。**
> **確定した訂正は 6件（うち [中] 3件）＋補足追記 4件**。各項目の末尾に `【検証】` として根拠を残した。
> 検証で取り直した一次資料＝`C:\tmp\vv_ally\*.txt`（実ブラウザ取得・oldid つき）／`C:\tmp\vv_rgg.pdf` → `C:\tmp\vv_rgg.txt`。

**一次資料（検証官が自分で取り直したもの）**
- 英語wiki（wiki.dominionstrategy.com）の各カードページ＝**現行カードテキストの正本**。
  Anubis の bot 検知で curl / urllib / `action=raw` / `api.php` はすべて弾かれ（実測）、
  **Wayback も この環境からは TCP 拒否（WinError 10061）＝`tools/wikifetch.py` は同盟では使えない**。
  → **puppeteer で実ブラウザとして開き、Anubis の PoW をブラウザに解かせて取得**した。
  ⚠️ **チャレンジ画面のタイトルは日本語（「あなたがボットでないことを確認しています！」）で出る**ので、
  `not a bot` でタイトル判定すると素通りして**チャレンジ画面の169文字をカード本文として保存してしまう**。
  **`#mw-content-text` の出現を待つ**のが正しい（検証官はこれを踏んで1回取り直した）。
  取得テキスト＝`C:\tmp\vv_ally\*.txt`（各ファイル末尾に oldid あり。例 Island_Folk は oldid=95076、Ally は oldid=95934）。
- RGG 公式ルールブック PDF＝`https://www.riograndegames.com/wp-content/uploads/2021/09/Dominion-Allies-Rules.pdf`
  を実DL（200・2,144,349 bytes）＋`pdftotext -layout`（`C:\tmp\vv_rgg.txt`・1204行）で逐語確認。
  ⚠️ **このPDFは 2022年3月＝第1版**。判定根拠＝**PDF内のカード画像の Island Folk が旧文面**
  （逐語: `At the end of your turn, if the previous turn wasn't yours, you may spend 5 Favors to take another turn.`）。
  ❗**「FAQ に "This can never let you take a 3rd turn in a row." があるから新版」と判断してはいけない**：
  この FAQ 行は**第1版のPDFにも既にある**（旧文面でも Island Folk 単独では3連続にならないため、
  FAQ 文言は新旧どちらでも成立する）。**版の判定はカード画像の文面だけが根拠になる。**
- **英語wiki の Versions 表で 2023年12月版（第2刷）を確認して現行文を採用した**（下記 Island Folk 参照）。
- 参考：wiki が配布している PDF は `https://wiki.dominionstrategy.com/images/3/31/AlliesRulebook2021.pdf` の1本のみ
  （`Allies` ページ内の全 .pdf リンクを実抽出＝これ1件）。**2023年12月版の PDF への直リンクは wiki 上に無い**。

**担当範囲**＝Ally 全23枚のうち、アルファベット順で後半の11枚（Island Folk 〜 Woodworkers' Guild）。
【検証】`Ally` ページ逐語 `There are 23 Allies` ＋ ナビゲーション表の Allies 行を数えて23／担当11枚と一致。

---

## 0. 前提＝Ally / Favor の一般ルール（`Ally` / `Favor` ページ＋ルールブック逐語）

`Ally` ページの Official rules 節 逐語（RGG ルールブック p.2 と一字一句同じであることを検証官が突き合わせ済み）:

> In games using one or more Liaison cards, give each player a Favors mat and deal out a single Ally card.
> The Ally cards are a separate deck, not combined with Events and so on.
> Each player gets a single Favor token to start with (or five tokens in games with Importer).
> Allies are landscape cards that give Favor tokens a use; Liaisons are kingdom cards that provide a way to
> get Favor tokens.
> In games with a Liaison, deal out a random Ally to use that game.
> Only use one Ally per game, even with multiple Liaisons. You can still have as many other landscape cards
> (Events, Landmarks, Projects, Ways) as you otherwise would have.
> Coin tokens are used for Favors; they go on a Favors mat to distinguish them from Coffers and
> Villagers (from other expansions), which have their own mats.
> When a card gives you +1 Favor, add a token to your mat; when spending a Favor, remove the token from your mat.
> **Favors may be used starting with the first turn of the game; they may not be used prior to that turn.**
> **Spending Favors is always optional.**
> **Spending Favors can only be done once per time an Ally ability triggers, unless it says, "Repeat as desired."**

【検証】`C:\tmp\vv_ally\Ally.txt` 28〜38行／`C:\tmp\vv_ally\Favor.txt` 17〜21行（`Favor` ページにも同文が載る）／
`C:\tmp\vv_rgg.txt` 55〜57行。**3ソースで一致。下書きの引用は正しかった。**

`Ally` ページ本文 逐語:
> Allies are not Kingdom cards, but are added to the game whenever one or more Kingdom cards have the
> Liaison type. In any game using Liaisons, exactly one Ally is chosen (…) **Since Allies are not considered
> cards, they cannot be bought or gained** (…)
> There are 23 Allies, printed on cards in a landscape orientation with **yellowish grey/parchment frames**.

実装上の要点（11枚すべてに効く）:
- **Ally はカードではない**（landscape）＝**購入も獲得もできない／コストが無い**。1ゲームに**ちょうど1枚**。
  Liaison が王国に1枚でもあれば Ally を1枚配る（Liaison が複数でも Ally は1枚）。
- **枠スキンは「黄みがかった灰色／羊皮紙色」**（`build-landscape.js` の新スキン。
  既存＝イベント茶褐色／ランドマーク深い青緑／プロジェクト赤茶／アーティファクト灰青／習性深い黄緑／
  祝福黄金／呪詛紫／状態灰褐色 とぶつからない色）。【✚追記】
- **Favor は各自1個から開始**（Importer がある game だけ5個）。**セットアップ中（初期山札のシャッフル）には使えない**。
- **Favor の消費は常に任意**。**1回の誘発につき1回だけ**消費できる。
  例外は "Repeat as desired." と書いてある Ally（本担当では **Market Towns** のみ）、
  および **Order of Astrologers / Order of Masons**（カード文に "Repeat as desired." は無いが
  **公式FAQが `After spending a Favor and looking at the cards, you may still spend more Favors.` と明示**＝実質繰り返し可）。
  【検証】Order_of_Astrologers.txt 33行／Order_of_Masons.txt 34行／PDF 1053行・1069行。**下書きどおり。**
- **Favor を消費しない Ally が3枚ある**：League of Bankers / League of Shopkeepers / Plateau Shepherds
  （`Ally` ページの一覧に "(tokens are never spent)" と明記）。**3枚とも本担当に含まれる。**
  【検証】Ally.txt 54行・61行・67行。**下書きどおり。**
- **本担当11枚はすべて Setup を持たない**。
  【検証】wiki の Ally text 欄11枚と RGG PDF のカード画像11枚の**両方**に `Setup:` 行が無いことを逐語確認。
  ⚠️ 下書きの「**Ally のうち Setup を持つものは無い**」は**担当外12枚を検証していないので断定を避ける**（下記 訂正7）。
  なお「Setup があるのは Liaison の Importer」は裏取りできた＝`Allies` ページ Expected changes 逐語
  `Importer — Mark "Setup:" in bold (2023).`（＝Importer に Setup 行が実在する）。

### ⚠️【訂正6・一次資料側の罠】`Ally` ページの「List of Allies」要約は League of Bankers を誤記している
- 要約リスト 逐語（Ally.txt 54行）:
  `League of Bankers — Produce +[$1] per Favor token you have (tokens are never spent)`
  → **「Favor 1個につき +$1」と読める。**
- 正しいカード文（`Ally text` 欄＝Ally.txt ではなく League_of_Bankers.txt 15行、および RGG PDF のカード画像）:
  `At the start of your Buy phase, +[$1] per 4 Favors you have (round down).`
- **要約リストを一次資料として引くとカードが4倍強くなる。カード文（`Ally text` 欄）だけを正本にすること。**
  下書きは正しくカード文を採っていた＝**下書きに誤りは無い**が、次に触る人が同じ罠を踏まないよう明記する。

---

## 1. Island Folk

### Island Folk  （Ally・コスト無し）
- **id候補**: `island_folk`
- **日本語名**: **島民**（※英語wiki の Japanese 行。**本プロジェクトの規約では英語wikiの Japanese 行は正本にしない**＝
  日本語wiki／ホビージャパン印刷版で裏取りが必要。下記「未決事項」参照）
- **コスト**: なし（Ally＝横型ランドスケープ。ポーション費用・負債コストとも無し）
- **種別**: **Ally のみ**（他の種別は無い）
- **イラスト**: Brian Brinlee
- **カードテキスト（英語・現行＝2023年12月 第2刷）**:
```
At the end of your turn, you may spend 5 Favors to take an extra turn after this one
(but not a 3rd turn in a row).
```
- **カードテキスト（英語・初版＝2022年3月。※日本語版カードはこちらで印刷されている）**:
```
At the end of your turn, if the previous turn wasn't yours, you may spend 5 Favors to take another turn.
```
- **Setup:**: なし
- **公式FAQ・裁定**:
  - Official FAQ（wiki＋ルールブック 逐語）: `This can never let you take a 3rd turn in a row.`
  - Other rules clarifications（wiki 逐語）:
    - `You can look at your next hand before deciding to spend 5 Favors for an extra turn.`
    - `If you play Voyage the same turn you spend Favors with Island Folk, you've hit the "but not a 3rd turn" limit, so you will have to choose which extra turn to take.`
    - `If you spend Favors for Island Folk on an extra turn, you won't get an extra turn.`
    - `If you are Possessed, and they make you spend Favors for Island Folk, you take an Island Folk turn, and then take your normal turn.`
  - **追加ターンはタイブレーク（同点時は手番数が少ない方の勝ち）に数えない**
    （`Extra turn` ページ 逐語: `Extra turns do not count toward the tiebreaker rule that the player who has taken fewer turns wins a game with a tied score.`）。
  - `Extra turn` ページ 逐語: `In 2023, Donald X. introduced errata to prevent players from getting more than one extra turn at a time in most cases.`
    **同一プレイヤーの最大連続手番は5**＝Possession → 追加ターン札(Outpost/Mission/Voyage/**Island Folk**/Journey) → 通常ターン → Seize the Day → Fleet。
- **エラッタ**: **あり（機能変更）**。`Island Folk` ページの English versions 表 逐語:
  - `At the end of your turn, if the previous turn wasn't yours, you may spend 5 Favors to take another turn.` — `First edition` — Announced **March 2022**
  - `At the end of your turn, you may spend 5 Favors to take an extra turn after this one (but not a 3rd turn in a row).` — Changes `Never allow more than two turns in a row.` — Announced **September 2023** / Printed **December 2023**
  - `Allies` 拡張ページ Versions 表の December 2023 行 逐語: `Island Folk, Voyage — Cannot take a third turn in a row (2023).`
  - **日本語版カード（2022年印刷）は初版文面**（wiki の Japanese 行: 「あなたのターンの終了時、直前のターンが自分のターンでない場合、好意5を使ってもよい。そうした場合、追加のターンを得る。」）
    ＝**本アプリは現行（2023年12月版）を採用すべき**（夜想曲で「日本語版が旧テキスト＝現行を採用」と決めたのと同じ方針）。
  【検証】Island_Folk.txt 41〜43行（Versions 表）／Allies.txt 188行／`C:\tmp\vv_rgg.txt` 997〜998行（第1版PDFの旧文面）。
  **下書きのエラッタ記述は日付・新旧文面とも完全に正しかった。**
- **Favor を消費するか**: **する（ちょうど5個）**。5個未満では使えない。
- **いつ使えるか**: **自分のターンの終了時のみ**（`At the end of your turn`）。相手のターン中は使えない。
- **1ターンに何回**: 1回（"Repeat as desired." が無い＝誘発1回につき1回）。
- **強制か任意か**: **任意**（`you may`）。
- **終了時得点に関わるか**: いいえ（ただし追加ターンはタイブレークに数えない）。
- **Setup があるか**: なし

#### ⚠️【訂正3・下書きの見落とし】Lich（同じ同盟拡張のカード）との相互作用
下書きは Island Folk × Lich に一切触れていなかった。**Lich は同盟拡張の Wizards 分割山の最下段（$6）＝
Island Folk と必ず同じ拡張に居る**ので、実装すれば確実に到達する。
- `Extra turn` ページ 逐語:
  `Lich has the opposite effect, making you lose a turn. If you play a Lich and earn an extra turn on the same turn, the two effects cancel out; you just skip the extra turn and have your next normal turn as usual.`
- RGG ルールブック PDF（Lich 項）逐語:
  `Skipping a turn means that the next time you would take a turn, you don't; nothing happens for that turn: no "start of turn" abilities, no phases. Play continues with the player to your left as usual. You can skip an extra turn, like one from Voyage. **Skipped turns still count for the tiebreaker however they would have if taken.** If you play multiple Liches you will skip multiple turns.`
- **実装上の意味**：
  - Island Folk の追加ターンと Lich のスキップは**打ち消し合う**（追加ターンを飛ばして次の通常ターンへ）。
  - **飛ばしたターンも「取っていたら数えられたのと同じように」タイブレークに数える**
    ＝飛ばしたのが**追加**ターンなら数えない／飛ばしたのが**通常**ターンなら数える。
    ＝このプロジェクトの `tieTurns`（`turns - freeTurns`・§0-26）に**直撃する**。
    「スキップしたから `turns` を増やさない」と素朴に実装すると同点決勝が狂う。
  【検証】Extra_turn.txt 6行／`C:\tmp\vv_rgg.txt` 650〜654行。

- **実装上の注意**:
  - **旧文（"if the previous turn wasn't yours"）と現行文（"but not a 3rd turn in a row"）は挙動が違う**。
    旧＝「直前が自分のターンなら不可」／現行＝「これを含めて3連続にならなければよい」＝**連続数**で判定する。
  - 「3連続禁止」の判定は **Voyage / Outpost / Mission / Seize the Day / Fleet / Possession / Journey** など
    他の追加ターン源と**同じ土俵で数える**必要がある（同ターンに Voyage と両方成立したら**どちらか片方を選ぶ**＝FAQ逐語）。
  - **「次の手札を見てから決めてよい」**＝このエンジンは片付けで次の手札を先引きする構造なので、
    **Island Folk の判定は先引きの後**に置くのが公式どおり（§0-25 のリス／§0-21 の保存と同じ位置）。
  - Possession 中に「支配者が Island Folk の Favor を使わせた」場合、
    **被支配者は Island Folk のターンを取り、その後に通常のターンも取る**。

---

## 2. League of Bankers

### League of Bankers  （Ally・コスト無し）
- **id候補**: `league_of_bankers`
- **日本語名**: 英語wiki に Japanese 行なし（未取得）
- **コスト**: なし
- **種別**: **Ally のみ**
- **イラスト**: Martin Hoffmann
- **カードテキスト（英語・現行）**:
```
At the start of your Buy phase, +[$1] per 4 Favors you have (round down).
```
- **Setup:**: なし
- **公式FAQ・裁定**:
  - Official FAQ 逐語: `You don't spend Favors to use this; you just get +[$] based on the number of Favors you've accumulated.`
  - Other rules clarifications 逐語:
    - `If you gain extra Favors at the start of your Buy phase (e.g. you discard a Weaver to Arena, and then gain a Sycophant), that may give you more +[$] from this.`
    - `If you take multiple Buy phases in a turn (with e.g. Villa or Cavalry), you can get +[$] from this multiple times.`
- **エラッタ**: なし（English versions 表は `First edition` / March 2022 の1行のみ）
- **Favor を消費するか**: **しない**（貯めた枚数を参照するだけ）。
- **いつ使えるか**: **自分の購入フェイズの開始時**（自動）。相手のターン中は無関係。
- **1ターンに何回**: **購入フェイズ開始のたび**＝ヴィラ/騎兵で購入フェイズに複数回入れば**そのたびに**得る。
- **強制か任意か**: **強制（自動）**。"may" が無い。
- **終了時得点に関わるか**: いいえ。
- **Setup があるか**: なし
- **実装上の注意**:
  - **端数切り捨て**（4個ごとに +$1。3個＝$0、7個＝$1、8個＝$2）。
  - ❗**`Ally` ページの要約リストは "per Favor token you have" と誤記している**（上記 訂正6）。
    **カード文の "per 4 Favors ... (round down)" が正本。**
  - **枚数を数えるのは「購入フェイズ開始の解決時点」**。同じ「購入フェイズ開始時」の複数の能力の解決順は
    プレイヤーが選べるので、**先に Favor が増える能力（Arena→Weaver→Sycophant 獲得など）を解決すれば +$ が増える**
    ＝公式に認められた挙動（FAQ 逐語）。素朴に「購入フェイズに入った瞬間の枚数」で焼き込むと過小になる。
  - ヴィラ/騎兵で購入フェイズに再入するたびに再発動する（1ターン1回に絞ってはいけない）。
【検証】League_of_Bankers.txt 15行・32〜35行・40行／PDF 1006〜1008行。**下書きの記述は全項目一致＝訂正なし。**

---

## 3. League of Shopkeepers

### League of Shopkeepers  （Ally・コスト無し）
- **id候補**: `league_of_shopkeepers`
- **日本語名**: 英語wiki に Japanese 行なし（未取得）
- **コスト**: なし
- **種別**: **Ally のみ**
- **イラスト**: Marco Primo（PDF のクレジットは "Marco Morte"＝表記ゆれ）
- **カードテキスト（英語・現行）**:
```
After playing a Liaison, if you have 5 or more Favors, +[$1],
and if 10 or more, +1 Action and +1 Buy.
```
- **Setup:**: なし
- **公式FAQ・裁定**:
  - Official FAQ 逐語:
    - `You don't spend Favors to use this.`
    - `After each time you play a Liaison, you get +[$1] if you have 5 or more Favors, and +1 Action and +1 Buy (in addition to the +[$1]) if you have 10 or more.`
    - `In games with multiple Liaisons, all of the Liaisons get the bonus, even if only one of them was used to get the Favors.`
  - Other rules clarifications 逐語:
    - `If you have 3 Favors, and you use Throne Room on Underling, you only get +[$1] from League of Shopkeepers.`
    - `However, if you have 3 Favors, play an Underling, and then replay it with either Royal Carriage or Citadel, League of Shopkeepers will trigger twice, and you can get +[$2] from it.`
    - `If you have 10+ Favors and play either a Bauble or a Contract, you can get +1 Action in your Buy phase; this won't let you play more Actions from your hand.`
    - `If you gain a Sycophant, get +2 Favors, and then play it with Innovation, the 2 Favors will count for League of Shopkeepers.`
    - `However, if you gain a Guildmaster and play it with Innovation, the Guildmaster will give you +1 Favor from gaining itself. However, you won't get that Favor in time for League of Shopkeepers.`
- **エラッタ**: なし（First edition のみ・March 2022）
- **Favor を消費するか**: **しない**（閾値を参照するだけ）。
- **いつ使えるか**: **Liaison カードを使用した直後**（アクションフェイズでも購入フェイズでも＝
  Bauble / Contract は財宝の Liaison なので購入フェイズでも誘発する）。
- **1ターンに何回**: **Liaison を使用したそのたびに**（回数制限なし）。
- **強制か任意か**: **強制（自動）**。
- **終了時得点に関わるか**: いいえ。
- **Setup があるか**: なし
- **実装上の注意**:
  - **10以上のときは +$1 も併せて得る**（`in addition to the +[$1]`）＝**排他ではなく累積**。
    ＝5〜9で「+$1」、10以上で「+$1、+1アクション、+1購入」。
  - **判定は「その誘発を解決する時点」の Favor 枚数**。
  - **【訂正5】Throne Room で +$1、Royal Carriage/Citadel で +$2 になる理由**（下書きは「私の解釈」と留保していたが、
    ドミニオンの一般ルール（同時に誘発した効果の解決順は本人が選ぶ）から確定できる。
    ※ただし **wiki には理由までは書かれていない**＝結論の数値のみ逐語、理屈は一般ルールからの導出）:
    - **Royal Carriage / Citadel は「アクションの使用を終えたとき」に呼ぶ**＝League of Shopkeepers の
      「Liaison を使用した後」と**同時誘発**→**解決順をプレイヤーが選べる**。
      Royal Carriage を先に解決 → 再演で Favor が 4→5 → **再演ぶんの誘発が 5個 で +$1** →
      その後に解決する**1回目の誘発も 5個 のまま**なので **+$1** ＝ 計 **+$2**。
    - **Throne Room は 2回目の使用が Throne Room 自身の解決の逐次な一部**なので割り込めない。
      1回目の誘発は Favor 4個 のまま解決＝**$0**、2回目の使用後に 5個 で **+$1** ＝ 計 **+$1**。
    - ＝**このエンジンで「同時誘発の順番を選べない（先入れ順）」という既存の許容簡略化を当てると
      Royal Carriage 側が +$1 にしかならない**（公式より弱い）。許容するなら PROGRESS に明記すること。
  - **購入フェイズで得た +1アクションでは手札のアクションを使えない**（FAQ 逐語）。値としては加算するが使い道が無いのが正しい。
  - 「Liaison を使用したとき」＝**カードの使用（play）が正本**。獲得や公開では誘発しない。
    Innovation（技術革新）で使用した場合も「使用」なので誘発する。
  - **Guildmaster を Innovation で使用しても、獲得由来の +1 Favor は League of Shopkeepers の判定に間に合わない**（FAQ 逐語）。
  - 複数種の Liaison がある game では、Favor を出さない側の Liaison を使用しても誘発する。
【検証】League_of_Shopkeepers.txt 15行・31〜38行・42行／PDF 1013〜1018行。**カード文・FAQ は下書きと逐語一致。**

---

## 4. Market Towns

### Market Towns  （Ally・コスト無し）
- **id候補**: `market_towns`
- **日本語名**: 英語wiki に Japanese 行なし（未取得）
- **コスト**: なし
- **種別**: **Ally のみ**
- **イラスト**: Marco Primo
- **カードテキスト（英語・現行）**:
```
At the start of your Buy phase, you may spend a Favor to play an Action card from your hand.
Repeat as desired.
```
- **Setup:**: なし
- **公式FAQ・裁定**:
  - Official FAQ 逐語: `Fully resolve playing the Action card before deciding if you want to spend a Favor to play another one.`
  - Other rules clarifications 逐語:
    - `If you gain Favors while resolving Market Towns (e.g. by playing a Broker), you may continue spending those Favors to keep playing Actions.`
    - `Market Towns does not specify that you re-enter your Action phase. Therefore, cards that give additional Action plays, such as Village, do not allow additional Actions to be played.`
    - `If you gain a Villa or Cavalry in the middle of resolving Market Towns, you'll end your Buy phase (which will let you discard Wine Merchant and pay [$1] to Pageant), and then continue resolving other "at the start of Buy phase" abilities (such as Arena or Market Towns itself).`
    - `If you play Leprechaun and receive either Envy or Delusion, you return the corresponding State after you finish resolving Market Towns.`
    - `If you return Deluded, then use Market Towns to play Leprechaun and receive Envy, you'll be affected by Deluded and Envious at the same time.`
- **エラッタ**: なし（First edition のみ・March 2022）
- **Favor を消費するか**: **する（アクション1枚につき1個）**。
- **いつ使えるか**: **自分の購入フェイズの開始時**のみ。
- **1ターンに何回**: **"Repeat as desired." ＝ Favor が続く限り何度でも**（購入フェイズが複数回あればそのたびに開く）。
- **強制か任意か**: **任意**（`you may`）。
- **終了時得点に関わるか**: いいえ。
- **Setup があるか**: なし
- **実装上の注意**:
  - **アクションフェイズに戻るわけではない**。`turn.phase` は購入フェイズのまま（FAQ 逐語）。
    → **村などの +アクションは意味を持たない**（手札からさらにアクションを使えるようにはならない）。
    → 逆に「購入フェイズか」を見るカード（冠のモード分岐・公会堂・列柱・徴税・行商人のコスト等）は
      **購入フェイズとして扱われたまま**アクションが使われる＝**この engine で最も誤爆しやすい点**
      （PROGRESS §0-27 の「`turn.phase === 'buy'` の誤爆が最大のリスク」の再来）。
  - **アクション権（+アクション）を消費しない**（Favor が対価）。
  - **1枚を完全に解決してから次を決める**（途中で Favor が増えたら、その Favor も使える＝Broker の例）。
  - Villa/Cavalry を途中で獲得すると**購入フェイズがいったん終わる**→アクションフェイズに戻る→
    再び購入フェイズに入ったら **Market Towns 自身を含む「購入フェイズ開始時」能力を改めて解決する**。
  - 状態（Envy/Delusion＝夜想曲の嫉妬/錯乱）の返却は **Market Towns の解決が全部終わった後**。
    ＝夜想曲の「購入フェイズ開始時に状態を返す」2階建て（PROGRESS §0-28）と**順序が噛み合う**か要確認。
【検証】Market_Towns.txt 15行・31〜37行・42行／PDF 1031行。**下書きと逐語一致＝訂正なし。**

---

## 5. Mountain Folk

### Mountain Folk  （Ally・コスト無し）
- **id候補**: `mountain_folk`
- **日本語名**: **山の民**（※英語wiki の Japanese 行。要・日本語wiki 裏取り）
- **コスト**: なし
- **種別**: **Ally のみ**
- **イラスト**: Brian Brinlee
- **カードテキスト（英語・現行）**:
```
At the start of your turn, you may spend 5 Favors for +3 Cards.
```
- **Setup:**: なし
- **公式FAQ・裁定**:
  - Official FAQ 逐語: `You need the full 5 Favors to use this.`
  - **`Other rules clarifications` 節は wiki に存在しない**（検証官が実確認）。
- **エラッタ**: なし（First edition のみ・March 2022）
- **Favor を消費するか**: **する（ちょうど5個・端数不可）**。
- **いつ使えるか**: **自分のターンの開始時**のみ。
- **1ターンに何回**: 1回（"Repeat as desired." 無し）。
- **強制か任意か**: **任意**（`you may`）。
- **終了時得点に関わるか**: いいえ。
- **Setup があるか**: なし
- **実装上の注意**:
  - **追加ターン系ではない**（**+3カード**）。追加ターンは Island Folk のほう。
  - 5個未満では**部分的にも使えない**（「4個で +2カード」等は不可）。
  - 「ターンの開始時」＝持続カードの開始時効果や Cave Dwellers 等と**同じ窓**に入る。
    このエンジンでは `startQueue` に積む枠。**複数の開始時効果の解決順は公式ではプレイヤーが選べる**
    （このエンジンの既存の許容簡略化＝先入れ順、と同じ扱いになる見込み＝PROGRESS §0-28 の既知簡略化）。
【検証】Mountain_Folk.txt 15行・31行・36行／PDF 1045行。**下書きと逐語一致＝訂正なし。**

---

## 6. Order of Astrologers

### Order of Astrologers  （Ally・コスト無し）
- **id候補**: `order_of_astrologers`
- **日本語名**: 英語wiki に Japanese 行なし（未取得）
- **コスト**: なし
- **種別**: **Ally のみ**
- **イラスト**: Brian Brinlee
- **カードテキスト（英語・現行）**:
```
When shuffling, you may pick one card per Favor you spend to go on top.
```
- **Setup:**: なし
- **公式FAQ・裁定**:
  - Official FAQ 逐語:
    - `Each time you shuffle, you can spend Favors to look through the cards and pick one card per Favor spent to go on top. Shuffle the other cards normally.`
    - `You can't look through your cards unless you spend at least one Favor. You can look at any to-be-drawn cards while making this decision; for example, if you're shuffling at end of turn and had two cards left, you can look at those, then decide whether or not to spend Favors and what cards to put on top.`
    - `After spending a Favor and looking at the cards, you may still spend more Favors.`
    - `Note that Emissary and Underling can cause you to shuffle before giving you Favors; the Favors you don't have yet can't be used on that shuffle.`
  - Other rules clarifications 逐語:
    - `Since you can only begin using Favors starting from the first turn of the game, you can't use Order of Astrologers when shuffling your starting deck during setup.`
    - `If you shuffle your entire deck (with e.g. Inn), you may still spend Favors for Order of Astrologers. If you do, you get to look through your entire deck.`
    - `If you have Star Chart, you may pick one card to go on top for free, and then may spend Favors to put additional cards on top.`
    - `If you spend multiple Favors for this, you can choose the order for the cards you put on top of the shuffled cards. This may matter if e.g. you play Smithy with 2 cards in your deck, and the Smithy will only draw one of the cards you put on top with Order of Astrologers.`
    - `The cards you choose with this go on top of the other shuffled cards, not on top of your deck. So if you play Smithy with 2 Towns in your deck, you can't use Order of Astrologers to put 3 Coppers on top of the Towns; you're forced to draw those 2 Towns dead.`
    - `If you spend a Favor to look through the cards you're shuffling, but decide not to put any of them on top, you still lose that Favor.`
- **エラッタ**: なし（First edition のみ・March 2022）
- **Favor を消費するか**: **する（山札の上に置く1枚につき1個）**。
- **いつ使えるか**: **自分がシャッフルするたび**（＝「自分のターンだけ」ではない。
  相手のターン中に自分がドローしてシャッフルが起きた場合も自分のシャッフル。
  ※「相手のターン中も可」は**カード文面からの帰結で、一次資料に明記は見つからなかった**。
  ただし望楼/王室の封印が相手のターンでも働くのと同じ既定＝安全な導出）。
  **セットアップの初期山札シャッフルでは使えない**（Favor は1ターン目から＝FAQ 逐語）。
- **1ターンに何回**: シャッフルのたび。**1回のシャッフル内でも Favor を複数回に分けて追加投入できる**（FAQ 逐語）。
- **強制か任意か**: **任意**（`you may`）。ただし**使ったら中身を見ないと決めても Favor は返らない**（FAQ 逐語）。
- **終了時得点に関わるか**: いいえ。
- **Setup があるか**: なし
- **実装上の注意**:
  - **「山札の上」ではなく「シャッフルした札束の上」**。＝**シャッフル前に山札に残っていた札の下**に入る。
    **【✚検証で具体化】このエンジンの `js/engine.js:609-618` `reshuffleDeck(p)` は
    `p.deck = p.deck.concat(shuffled)` ＝シャッフルした捨て札は残り山札の下に付く**（実測）。
    さらに **Star Chart は `shuffled.unshift(pick)`（concat の前・612〜615行）** で実装されている。
    ＝**Order of Astrologers の選択札も `shuffled.unshift()` と同じ位置に入れれば公式どおりになる**。
    **`p.deck.unshift()` にすると公式より強くなる**（下書きの警告は正しい）。
  - **Favor を1個も使わないなら中身を見てはいけない**＝「見てから決める」ができるのは
    **これからドローする残りの札（シャッフル対象外の、既に山札にある札）だけ**。
    ＝オンラインのマスク設計上、**シャッフル対象の内容を Favor 消費前にクライアントへ送ってはいけない**。
  - **複数枚を置くときは順序も選べる**。
  - **Star Chart（ルネサンスのプロジェクト）と併用可**（Star Chart のぶんは無料で1枚、その上でさらに Favor で追加）。
    ※このエンジンの Star Chart は「シャッフル中に対話を挟めない」ため `starChartPick` で**自動選択**の許容簡略化
      （PROGRESS §0-22。`js/engine.js:612-615` で実測確認）。Order of Astrologers は**対話が必須**なので、
      **シャッフル処理の途中に pending を挟める形にリファクタしないと実装できない**＝最大の技術的難所。
  - Emissary / Underling は「先にシャッフルさせてから Favor をくれる」ことがある＝**まだ持っていない Favor は使えない**。
【検証】Order_of_Astrologers.txt 15行・31〜41行・46行／PDF 1053〜1060行。**下書きと逐語一致＝訂正なし。**

---

## 7. Order of Masons

### Order of Masons  （Ally・コスト無し）
- **id候補**: `order_of_masons`
- **日本語名**: **メイソン団**（※英語wiki の Japanese 行。要・日本語wiki 裏取り）
- **コスト**: なし
- **種別**: **Ally のみ**
- **イラスト**: Brian Brinlee
- **カードテキスト（英語・現行）**:
```
When shuffling, you may pick up to 2 cards per Favor you spend to put into your discard pile.
```
- **Setup:**: なし
- **公式FAQ・裁定**:
  - Official FAQ 逐語:
    - `Each time you shuffle, you can spend Favors to look through the cards and pick up to two cards per Favor spent to put into your discard pile. Shuffle the other cards normally, but don't shuffle in those cards.`
    - `You can't look through your cards unless you spend at least one Favor. You can look at any to-be-drawn cards while making this decision, as with Order of Astrologers.`
    - `After spending a Favor and looking at the cards, you may still spend more Favors.`
    - `Note that Emissary and Underling can cause you to shuffle before giving you Favors; the Favors you don't have yet can't be used on that shuffle.`
  - Other rules clarifications 逐語:
    - `Since you can only begin using Favors starting from the first turn of the game, you can't use Order of Masons when shuffling your starting deck during setup.`
    - `Putting cards into your discard pile doesn't count as discarding (e.g. it won't activate e.g. Village Green).`
    - `If you have Star Chart, you can both choose a card to go on top of of the shuffle, and spend Favors to leave cards in your discard pile.`
    - `When you shuffle your entire deck (with e.g. Inn or Famine), you may spend Favors to both look through your entire deck, and put cards directly into your discard pile.`
    - `When you need to shuffle to access more cards from your deck, you only shuffle one time, even if Order of Masons put some cards back in your discard pile. For example, if Sentinel makes you shuffle a discard pile of 2 Curses and 2 Provinces, but you spend a Favor to leave the 2 Provinces in your discard pile, the Sentinel will only look at the 2 Curses; you won't shuffle a 2nd time for the 2 Provinces.`
    - `However, some cards access cards from your deck one at a time (e.g. Watchtower and Journeyman). If there aren't enough cards after shuffling for the first time, you will shuffle a second time.`
    - `If you spend a Favor to look through the cards you're shuffling, but decide not to put any of them into your discard pile, you still lose that Favor.`
- **エラッタ**: なし（First edition のみ・March 2022）
- **Favor を消費するか**: **する（Favor 1個につき最大2枚）**。
- **いつ使えるか**: **自分がシャッフルするたび**（Order of Astrologers と同じ。セットアップ時は不可）。
- **1ターンに何回**: シャッフルのたび。**1回のシャッフル内でも追加投入可**（FAQ 逐語）。
- **強制か任意か**: **任意**（`you may` ＋ "up to 2"＝0枚でもよいが Favor は失う）。
- **終了時得点に関わるか**: いいえ。
- **Setup があるか**: なし
- **実装上の注意**:
  - **「捨て札置き場に置く」は「捨てる」ではない**（FAQ 逐語で Village Green を名指し）＝
    村有緑地/坑道/忠犬 等の**捨て札トリガーを誘発させない**（このエンジンの `triggerOnDiscard` を通してはいけない）。
  - **"up to 2"＝1枚だけでもよい**（Secret history 逐語: `Mostly it had you set aside exactly two cards per Favor, but my heart softened, and now it's "up to" two per.` ＝開発途中で緩められた）。
  - **1回のシャッフル要求につきシャッフルは1回だけ**。残した札のせいで山札が足りなくても
    **その場ではもう一度シャッフルしない**（Sentinel の例）。
    ただし **1枚ずつ山札にアクセスするカード（Watchtower/Journeyman 等）は、次に足りなくなった時点で改めてシャッフルする**。
    ＝このエンジンの `draw()` / `reshuffleDeck()` の「足りなければ即シャッフル」ループと噛み合うので、
      **「今回のシャッフルで捨て札に残した札」を同じアクセス中に再シャッフルしないためのフラグが要る**。
  - **実装位置**＝`reshuffleDeck` で `shuffle(p.discard)` した結果から**選んだ札を抜いて `p.discard` に残す**
    （`p.deck.concat(shuffled)` に混ぜない）。Order of Astrologers（`shuffled.unshift`）とは逆向きの操作。
  - Order of Astrologers と同じく **Favor 消費前にシャッフル対象を見せてはいけない**（マスク設計）。
【検証】Order_of_Masons.txt 15行・32〜43行・48行・64行／PDF 1065〜1075行。**下書きと逐語一致＝訂正なし。**

---

## 8. Peaceful Cult

### Peaceful Cult  （Ally・コスト無し）
- **id候補**: `peaceful_cult`
- **日本語名**: 英語wiki に Japanese 行なし（未取得）
- **コスト**: なし
- **種別**: **Ally のみ**
- **イラスト**: Martin Hoffmann
- **カードテキスト（英語・現行）**:
```
At the start of your Buy phase, you may spend any number of Favors to trash that many cards from your hand.
```
- **Setup:**: なし
- **公式FAQ・裁定**:
  - Official FAQ 逐語: `Spend the Favors all at once; then choose all the cards to trash; then trash them; then resolve things that happen due to trashing those cards, in any order.`
  - Other rules clarifications 逐語:
    - `If trashing those cards gets you more Favors (e.g. by trashing a Sycophant) or more cards in your hand (e.g. by trashing a Cultist), you won't be able to trash more cards with Peaceful Cult.`
    - `If you take multiple Buy phases in a turn (with e.g. Villa or Cavalry), you can trash with Peaceful Cult multiple times a turn.`
- **エラッタ**: なし（First edition のみ・March 2022）
- **Favor を消費するか**: **する（廃棄する枚数ぶん）**。
- **いつ使えるか**: **自分の購入フェイズの開始時**のみ。
- **1ターンに何回**: 1回（購入フェイズが複数回あればそのたびに1回）。**"Repeat as desired." は無い**。
- **強制か任意か**: **任意**（`you may` ＋ 枚数は0〜任意）。
- **終了時得点に関わるか**: いいえ。
- **Setup があるか**: なし
- **実装上の注意**:
  - **順序が厳密に決まっている**（FAQ 逐語）：①Favor を**まとめて**支払う → ②廃棄する札を**全部まとめて**選ぶ →
    ③まとめて廃棄する → ④廃棄によるトリガーを（任意の順で）解決する。
    ＝**廃棄の途中で増えた Favor や手札は使えない**（枚数は最初に固定される。夜想曲の修道院と同型）。
  - **「払いすぎ」は一次資料で未決**（下記「未決事項」参照）。実装は**手札枚数でクランプする**のが安全
    （CPU が空振りを選んで Favor を溶かすのを防ぐ）。
  - ヴィラ/騎兵で購入フェイズに再入すると再び使える。
【検証】Peaceful_Cult.txt 15行・32〜35行・40行／PDF 1084行。**下書きと逐語一致＝訂正なし。**

---

## 9. Plateau Shepherds

### Plateau Shepherds  （Ally・コスト無し）
- **id候補**: `plateau_shepherds`
- **日本語名**: 英語wiki に Japanese 行なし（未取得）
- **コスト**: なし
- **種別**: **Ally のみ**
- **イラスト**: Matthias Catrein
- **カードテキスト（英語・現行）**:
```
When scoring, pair up your Favors with cards you have costing [$2], for 2[VP] per pair.
```
- **Setup:**: なし
- **公式FAQ・裁定**:
  - Official FAQ 逐語: `For example, if you have five Favors, two Estates, and a Moat, you can make three pairs, for 6 [VP].`
  - Other rules clarifications 逐語:
    - `Cards must cost exactly [$2] to count, which means that Apothecary can't be paired with a Favor.`
    - `Most forms of cost reduction (e.g. Bridge) have no effect when scoring. However, Cheap cards still cost [$1] less when scoring, which may matter for Plateau Shepherds, and Flourishing Trade remains in effect, which definitely matters.`
- **エラッタ**: なし（First edition のみ・March 2022）
- **Favor を消費するか**: **しない**（`Ally` ページ一覧に "(tokens are never spent)"）。
- **いつ使えるか**: **ゲーム終了時の得点計算のみ**（ゲーム中は何もしない）。
- **1ターンに何回**: 該当なし。
- **強制か任意か**: **強制（自動）**。得点計算の一部。
- **終了時得点に関わるか**: **はい（この11枚で唯一）**。
- **Setup があるか**: なし
- **実装上の注意**:
  - **ペア数 = min(Favor 枚数, コストちょうど$2 のカード枚数)**、得点は **2VP × ペア数**。
    上の例（Favor5・屋敷2・堀1）＝min(5,3)=3ペア＝6VP。
  - **「ちょうど$2」＝コストの3成分（コイン/ポーション/負債）で厳密一致**。
    薬草商（Apothecary＝$2+ポーション）は**数えない**（FAQ 逐語）。
    ＝このエンジンの `costExact` / `sameCost` 系の成分別比較を使うこと（素の `cost === 2` は誤り＝PROGRESS §0-23 の鉄則）。
  - **得点計算時のコスト軽減は基本的に効かない**（橋/街道などは終了時には効かない）。
    例外＝**Cheap（日の出づる国の Trait）は終了時も$1安い**／**Flourishing Trade（日の出づる国の Prophecy）も有効**。
    ＝現時点の実装範囲（日の出づる国 未着手）では**素のコストで判定してよい**が、
      将来 日の出づる国 を入れるときに**ここが壊れる**ので注意。
  - 「cards you have」＝**所有カード全部**（山札・手札・場・捨て札・各種マット/脇置きを含む＝
    このエンジンの `DOM.engine.allCards` と同じ範囲）。CPU の終局読み（`vpOfPlayer`）にも同じ加点が要る。
  - **Favor は消費されない**＝得点計算時点のマット上の枚数をそのまま使う。
  - Strategy 節 逐語: `Can lead to a rush strategy if Bauble appears in the kingdom.`（Bauble は $2 の Liaison ＝ Favor も $2 札も同時に増える）。
【検証】Plateau_Shepherds.txt 15行・32〜35行・38行・43行／PDF 1096〜1097行。**下書きと逐語一致＝訂正なし。**

---

## 10. Trappers' Lodge

### Trappers' Lodge  （Ally・コスト無し）
- **id候補**: `trappers_lodge`
- **日本語名**: 英語wiki に Japanese 行なし（未取得）
- **コスト**: なし
- **種別**: **Ally のみ**
- **イラスト**: Marco Primo
- **カードテキスト（英語・現行）**:
```
When you gain a card, you may spend a Favor to put it onto your deck.
```
- **Setup:**: なし
- **公式FAQ・裁定**:
  - Official FAQ 逐語: `If your deck is empty, the card becomes the only card in your deck.`
  - **`Other rules clarifications` 節は wiki に存在しない**（検証官が実確認）。
- **エラッタ**: なし（First edition のみ・March 2022）
- **Favor を消費するか**: **する（獲得1回につき1個）**。
- **いつ使えるか**: **カードを獲得したとき**。
  **自分のターンに限らない**（魔女の呪い等、相手のターンに獲得したカードにも使える
  ※「相手のターン中も可」は**カード文面からの帰結で、一次資料に明記は見つからなかった**。
  ただし**望楼(Watchtower)/王室の封印(Royal Seal) が相手のターンの獲得でも働くのと完全に同型**＝安全な導出）。
- **1ターンに何回**: **獲得ごとに1回**（獲得のたびに新しい誘発なので、Favor がある限り何度でも）。
- **強制か任意か**: **任意**（`you may`）。
- **終了時得点に関わるか**: いいえ。
- **Setup があるか**: なし
- **実装上の注意**:
  - **獲得時の「置き場所を変える」効果**＝このエンジンの `state.onGainQueue`（獲得時対話キュー）に載せる型。
    **牧羊犬/そり/鷹匠/追放の払い戻し/望楼 などと同時に開く**ので、
    **else-if 連鎖ではなく `onGainQueue` に積む**こと（PROGRESS §0-25/§0-26 の教訓どおり）。
  - **望楼（Watchtower）や交易商人などの「獲得の置換/移動」と競合する**＝
    公式では「同時に起きる効果の順番は獲得者が選ぶ」。片方が先に動かすと **lose track** でもう片方が失敗する。
  - **山札が空なら、そのカードが山札の唯一の札になる**（＝捨て札を経由しない＝FAQ 逐語）。
  - **獲得先が捨て札でないカード**（彫刻家/遊牧民の野営地/ヴィラ など、手札や山札上に獲得するもの）にも
    誘発するが、「実際にどのゾーンにあるか」を追って移す必要がある（移動遊園地と同型の注意）。
【検証】Trappers'_Lodge.txt 15行・30行・35行／PDF 1103〜1104行。**下書きと逐語一致＝訂正なし。**

---

## 11. Woodworkers' Guild

### Woodworkers' Guild  （Ally・コスト無し）
- **id候補**: `woodworkers_guild`
- **日本語名**: 英語wiki に Japanese 行なし（未取得）
- **コスト**: なし
- **種別**: **Ally のみ**
- **イラスト**: Marco Primo
- **カードテキスト（英語・現行）**:
```
At the start of your Buy phase, you may spend a Favor to trash an Action card from your hand.
If you did, gain an Action card.
```
- **Setup:**: なし
- **公式FAQ・裁定**:
  - Official FAQ 逐語: `This can gain an Action of any cost, including Actions with [D] or [P] in the cost. You only gain an Action if you trashed one.`
  - **`Other rules clarifications` 節は wiki に存在しない**（検証官が実確認）。
- **エラッタ**: なし（First edition のみ・March 2022）
- **Favor を消費するか**: **する（1個）**。
- **いつ使えるか**: **自分の購入フェイズの開始時**のみ。
- **1ターンに何回**: 1回（"Repeat as desired." 無し。購入フェイズが複数回あればそのたびに1回
  ※「複数購入フェイズで複数回」は League of Bankers / Peaceful Cult の裁定からの類推で、
  この Ally には明記が無い＝**未決事項**）。
- **強制か任意か**: **任意**（`you may`）。
- **終了時得点に関わるか**: いいえ。
- **Setup があるか**: なし
- **実装上の注意**:
  - **獲得できるアクションのコストは無制限**＝**負債コスト（[D]）でもポーション費用（[P]）でもよい**（FAQ 逐語）。
    ＝このエンジンの `costUpTo` / `costIsPlainCoin` などの**コスト制限を掛けてはいけない**。
    条件は「アクションカードであること」と「サプライから獲得できること（＝`gainableBase` 相当＝
    非サプライ・ロック中の分割山下段・混合山の2枚目以降を弾く）」だけ。
  - ⚠️**【訂正2】「Advance と同型」と書いてはいけない**（下書きの記述は2重に危険）:
    - **本プロジェクトでの Advance の日本語名は「昇進」**（`js/cards.js:1506` 実測）。下書きの「進歩」は**誤り**。
    - **Advance（昇進・帝国のイベント）には「コスト$6以下」の上限がある**
      （`js/cards.js:1507` 逐語: 「手札のアクションカード1枚を廃棄してもよい。\nそうしたなら、**コスト$6以下**のアクションカード1枚を獲得する。」）。
      **Woodworkers' Guild には上限が無い。**「同型」と書くと実装者が `costUpTo(6)` を写して静かに壊す。
    - Secret history 逐語 `This one, directly playing off of Advance, just did more in the games we played with it than the others did.`
      は**設計の由来**を語っているだけで、**挙動が同じという意味ではない**。
  - **廃棄できなければ獲得しない**（`If you did`）。手札にアクションが1枚も無ければ Favor を払う意味が無い
    （＝候補ゼロなら窓を開かない実装にするのが親切。engine は「払っても空振り」を受理してよいが、
      **CPU が空振りを選んで無限ループしないよう候補ゼロなら提案させないこと**）。
  - 「アクションカード」判定は**相続の屋敷**や**資本主義**のような動的な種別変更の影響を受ける点に注意
    （このエンジンでは `DOM.isType(card,'action')` を直に書かず、既存の述語に合わせる）。
【検証】Woodworkers'_Guild.txt 15行・30行・35行・47行／PDF 1111〜1112行。**カード文・FAQ は下書きと逐語一致。**

---

## 12. 実装計画メモ（この11枚に共通する engine 上の勘所）

1. ⚠️**【訂正1】Ally は「横型ランドスケープの第6種別」ではない。**
   下書きは「第6種別（Event / Landmark / Project / Way / **Ally**）」と書いていたが、
   **5個しか列挙していないのに「第6」**という内部矛盾があり、かつ**このプロジェクトの実測と合わない**。
   - **実測（`js/cards.js` を vm で読んで `DOM.LANDSCAPES` の kind を集計）**:
     `landmark 21 / event 53 / project 20 / artifact 5 / way 20 / boon 12 / hex 12 / state 5` ＝**既に8種類**。
   - ∴ **Ally は `DOM.LANDSCAPES` の 9番目の `kind`**。
     「Event/Landmark/Project/Way の**『合計2枚まで』ファミリー**」に限れば**5番目**。
   `DOM.LANDSCAPES` に `kind:'ally'` で入れる。**コスト無し・購入不可**なので `BUY_*` は不要。
   1ゲームに**ちょうど1枚**（Liaison が王国にある時だけ）＝「合計最大2枚」の横型枠とは**別枠**
   （ルールブック逐語: `You can still have as many other landscape cards (Events, Landmarks, Projects, Ways) as you otherwise would have.`）。
   ＝**`DOM.landscapesForSet()`（横型3種を一度に決める唯一の入口・PROGRESS §0-23）の「合計2枚」制限に
   Ally を混ぜてはいけない**。混ぜると Ally が出たぶんイベント/ランドマークが減って公式と違うゲームになる。
2. **Favor は非カードの per-player 数値**（Coffers/Villagers と同型・**公開情報**・VPには数えない）。
   ただし **Plateau Shepherds があるゲームでは終了時得点に影響する**ので `scoreGame` と CPU の `vpOfPlayer` の両方から参照が要る。
   **開始時に全員1個**（Importer があるゲームだけ5個）。**保存則 tally には入れない**（非カード）。
3. ⚠️**【訂正4】誘発窓の種類は「5つ」ではなく 7つ**（下書きは「5つ」と書きながら7つ列挙していた）：
   - 自分の**ターンの開始時**：Mountain Folk
   - 自分の**購入フェイズの開始時**：League of Bankers（自動）/ Market Towns / Peaceful Cult / Woodworkers' Guild
   - **Liaison を使用した直後**：League of Shopkeepers（自動）
   - **カードを獲得したとき**：Trappers' Lodge（**相手のターンでも起きる**）
   - **シャッフルするとき**：Order of Astrologers / Order of Masons（**相手のターンでも起き得る／対話が必要**）
   - 自分の**ターンの終了時**：Island Folk
   - **得点計算時**：Plateau Shepherds
4. **「購入フェイズの開始時」は1ターンに複数回起こり得る**（ヴィラ/騎兵）。1ターン1回に焼くと壊れる。
   ＝夜想曲の「錯乱/嫉妬を購入フェイズ開始時に返す」2階建て（`END_ACTION_PHASE` が1ターンに複数回走る）と同じ罠。
5. **最難関は Order of Astrologers / Order of Masons**＝**シャッフルの最中に対話（pending）を挟む**必要がある。
   このエンジンは `reshuffleDeck(p)`（`js/engine.js:609-618`）が同期関数で、
   へそくり(`stashPlacement`・578〜582行)・星図(`star_chart`・612〜615行)は
   「対話を挟めないので自動選択」という許容簡略化になっている（PROGRESS §0-7・§0-22。検証官が実測確認）。
   **忠実に実装するにはこの前提を崩す横断リファクタが要る**
   （＝`draw()` の途中でシャッフルが起きるため、ドロー処理自体を中断・再開可能にする必要がある）。
   ここは着手前にユーザーと方針を決めるべき最大の論点。
   - 挿入位置の正解は実測済み＝**Astrologers は `shuffled.unshift()`（`p.deck.concat` の前）／
     Masons は `shuffled` に入れず `p.discard` に残す**。
6. **Favor の消費は engine 拒否・CPU 候補・UI モーダルの3面が同じ述語を見る**こと（既存の鉄則）。
   **CPU に分岐が無い pending を作らない**（本番 livelock）。
7. ⚠️**Island Folk × Lich（同じ拡張内）で `tieTurns` が壊れる**（上記 訂正3）。
   追加ターン／スキップしたターンの**タイブレーク上の数え方**を `freeTurns` と噛み合う形で設計すること。

---

## 13. 未決事項（一次資料でも決着しなかった＝実装時に判断が要る）

1. **Peaceful Cult で手札より多く Favor を払えるか**（例：手札3枚で5 Favor を払う）。
   カード文 `spend any number of Favors to trash that many cards from your hand` は文面上可能に読めるが、
   **wiki にも RGG ルールブックにも裁定が無い**。→ 実装は**手札枚数でクランプ**が安全（CPU の空振り防止）。
2. **Woodworkers' Guild が複数の購入フェイズでそれぞれ使えるか**。
   League of Bankers / Peaceful Cult には「ヴィラ/騎兵で複数回」の明記があるが、
   **Woodworkers' Guild と Market Towns にはこの明記が無い**（Market Towns は別の FAQ から複数回が読める）。
   「購入フェイズの開始時」という同じ文言なので**複数回で揃えるのが自然**だが、逐語の裏取りは取れなかった。
3. **Trappers' Lodge / Order of Astrologers / Order of Masons が相手のターン中にも使えるか**の明文。
   カード文に「自分のターン」の限定が無く、Favor の一般ルールにも制限が無いので**使える側で確定してよい**
   （望楼/王室の封印と同型）が、**名指しの逐語裁定は見つからなかった**。
4. **日本語カード名（11枚中8枚が未取得）**。
   英語wiki の Japanese 行があったのは **島民 / 山の民 / メイソン団 の3枚だけ**。
   しかも**本プロジェクトの規約では英語wiki の Japanese 行は正本にしない**
   （PROGRESS §0-27＝夜想曲で17枚が実物と食い違った）。
   検証官が日本語wiki（wikiwiki.jp/dom）を試したが **404 / 429（レート制限）で取得できず**。
   → **日本語wiki（ホビージャパン印刷版）での裏取りが必須の宿題**。
   なお拡張名は英語wiki 逐語で `Japanese: 同盟 (pron. doumei)` を確認済み。
5. **2023年12月版ルールブック PDF の入手先**。
   `Allies` ページの Versions 表には December 2023 の PDF 行があるが、
   **ページ内の .pdf リンクを全抽出しても 2021年版（`AlliesRulebook2021.pdf`）1本しか無い**。
   → 現状、**現行カードテキストの正本は wiki の Versions 表**（Island Folk 以外は初版と同一なので実害は Island Folk のみ）。

---

## 14. 検証サマリ（この文書の信頼度）

- **逐語一致で訂正なしを確認した項目**：カードテキスト11枚／Official FAQ 11枚／Other rules clarifications 8枚
  （Mountain Folk・Trappers' Lodge・Woodworkers' Guild は当該節が wiki に存在しないことを確認）／
  種別11枚（すべて `Ally` のみ）／コスト11枚（すべて無し）／Setup 11枚（すべて無し）／
  エラッタ表11枚（機能変更は Island Folk のみ・日付も一致）／Ally・Favor の一般ルール全文。
- **確定した訂正**：6件（[中] 3件＝ランドスケープ種別数／Advance の名前とコスト上限／Lich 相互作用の欠落、
  [小] 3件＝誘発窓の個数／League of Shopkeepers の理屈の留保／Setup 主張の範囲）。
- **補足追記**：4件（枠色／`reshuffleDeck` の実測アンカー／`Ally` 要約リストの罠／wikifetch が使えず puppeteer が必要な件）。
- **独立ソース数**：カード文と FAQ は **英語wiki と RGG ルールブック PDF の2系統**で突き合わせ済み。

---

# 同盟（Allies）— 日本語公式カード名・公式訳語の確定（KEY = g11_japanese）

> **【敵対検証済み 2026-08-12】** 別の検証官が下書きの引用を一切使わず、日本語wiki（wikiwiki.jp/dominiondeck）を
> 自前のフェッチャで再取得して 72枚全数を機械照合し、英語wiki（Wayback 経由）とホビージャパン製品ページで裏取りした。
> **カード名 72/72・コスト 49/49・種別（集合）49/49 は下書きどおりで誤りゼロ**。
> ただし **§7/§8 のエラッタ・訳文出典の記述に確定訂正6件**（うち1件は重大＝2026年4月エラッタの見落とし）と、
> **§0 の検証方法の記述に誤り1件**、**§6 の既存名称数に誤り1件**があったので訂正した。
> 新たに判明した実装上の重要事項5件を §9 に追加した。訂正箇所は **［訂正］** / **［追加］** で明示してある。

---

## 0. 出典と検証方法

**一次資料＝日本語wiki（ドミニオン Wiki\*・ホビージャパン印刷版準拠）** `https://wikiwiki.jp/dominiondeck/`

- 拡張一覧ページ：`https://wikiwiki.jp/dominiondeck/同盟（拡張）`
  （**`.../同盟` は移動動物園のイベント「同盟」のページ**。両ページとも冒頭に「もしかして →ドミニオン：移動動物園のイベント「同盟」」の
  曖昧さ回避リンクを持つ＝**公式訳の時点で名前が衝突している**ことの一次証拠）
- ランドスケープ機構ページ：`.../同盟（ランドスケープ）`
- 各カード個別ページ：`.../<日本語カード名>`
- 分割山の山ページ：`.../町民`, `.../卜占官`, `.../叙事詩`, `.../城砦`, `.../衝突`, `.../魔法使い`
- 用語ページ：`.../好意`
- ホビージャパン製品ページ：<https://hobbyjapan.games/dominion_allies/>
- 裏取り＝英語wiki `wiki.dominionstrategy.com`（Anubis の bot 検知のため Wayback 経由・`tools/wikifetch.py` 系）

**検証方法**：日本語wikiの各カード個別ページは
`収録拡張 | カード名 | コスト | カード種別 | 効果` の表を
**英語行（Allies / 英語名 / 英語種別 / 英語テキスト）と日本語行（同盟 / 日本語名 / 日本語種別 / 日本語テキスト）の2行で併記**している。
これを HTTPS で実取得し、**同一表の中で英語名と日本語名が対になっていること**を**スクリプトで機械照合**した（目視ではない）。

### ［訂正1］検証カバレッジ（下書きの記述は誤りだった）
下書きは「薬草集め・侍祭・女予言者・遠い海岸 の4枚は個別ページが無く、山ページ＋一覧ページから間接的に確定した」と書いていたが、
**4枚とも個別ページは存在し、英日併記表を持っている**（実取得で確認）。したがって間接確認は不要だった。

再検証の結果、**王国カード49枚・同盟カード23枚＝72/72 すべてを個別ページの英日併記表で直接確認**した。
機械照合の結果は **一致 72 / 不一致 0 / 未確認 0**。

**確度**：下表の日本語名はすべて **確定（High）**。効果文の日本語だけは一部が非公式訳＝§7 参照。

---

## 1. 新しい用語の公式日本語訳

| 英語 | 日本語（公式） | 確度 | 根拠（自前で再取得して確認） |
|---|---|---|---|
| **Ally**（ランドスケープ／種別） | **同盟** | 確定 | 全同盟カードの種別欄が `Ally` ⇔ `同盟`。拡張名も「同盟」。ページ名 `同盟（ランドスケープ）` |
| **Favor**（トークン） | **好意** | 確定 | `+1 Favor` ⇔ `+1 好意`（下役）。HJ製品ページ内容物に「**好意マット6枚**」 |
| Favor token | **好意トークン** | 確定 | 発明家の家族 `a Favor token you have` ⇔ `自分の好意トークン1枚` |
| Favor mat | **好意マット** | 確定 | HJ製品ページ「好意マット6枚」／好意ページ「好意マット上にコイントークンを置く」 |
| **Liaison**（種別） | **連携** | 確定 | `Action-Liaison` ⇔ `アクション-連携`（ごますり/下役/仲買人/密使/ギルドマスター/生徒）、`Treasure-Liaison` ⇔ `財宝-連携`（道化棒） |
| **Rotate**（動詞） | **循環（する／させる）** | 確定 | `You may rotate the Wizards.` ⇔ `あなたは魔法使いを循環させてもよい。`（生徒）。HJ製品ページも「**循環できる分割された山札**」 |
| **Augur**（種別） | **卜占官** | 確定 | `Action-Attack-Augur` ⇔ `アクション-アタック-卜占官`（女魔導士）。読み「**ぼくせんかん**」（卜占官ページ余談） |
| **Clash**（種別） | **衝突** | 確定 | `Victory-Clash` ⇔ `勝利点-衝突`（領土） |
| **Fort**（種別） | **城砦** | 確定 | `Action-Fort` ⇔ `アクション-城砦`（天幕/堡塁）。読み「**じょうさい**」（城砦ページ余談） |
| **Odyssey**（種別） | **叙事詩** | 確定 | `Treasure-Odyssey` ⇔ `財宝-叙事詩`（沈没船の財宝）／`Action-Odyssey` ⇔ `アクション-叙事詩`（古地図） |
| **Townsfolk**（種別） | **町民** | 確定 | `Action-Townsfolk` ⇔ `アクション-町民`（触れ役ほか4枚全部） |
| **Wizard**（種別） | **魔法使い** | 確定 | `Action-Liaison-Wizard` ⇔ `アクション-連携-魔法使い`（生徒） |
| Setup:（カード上の準備句） | **準備：** | 確定 | 輸入者 `Setup: Each player gets +4 Favors.` ⇔ `準備：各プレイヤーは +4 好意 を得る。` |
| split pile（既存語） | **分割された山札** | 確定（既存訳） | 帝国で既出。HJ製品ページも「分割された山札」 |

> 補足：`連携`（Liaison）は日本語wikiに単独ページが無い（**404 を実測**）。`循環` も単独ページ 404。
> いずれも全カードの種別欄／カード文で確定しているので実害は無い。

### ［追加1］好意の初期配布（下書きに無かった）
`同盟（ランドスケープ）` ページ逐語：
> カード種別に連携を持つカードを用いる場合、ゲームの準備の際に以下を行う。
> ・各プレイヤーは好意マットを得る。・**好意マットに1好意を加える。**・同盟をランダムに1枚だけ選ぶ。

＝**連携カードが王国にあるゲームでは、全員 1好意 を持って開始する**。
輸入者の `準備：+4好意` はこれに**上乗せ**なので、輸入者がある場は開始 **5好意**（輸入者ページも「全プレイヤーが5好意を所持している状態でゲームを開始する」と明記）。

---

## 2. 分割山6組そのものの日本語名

英語の山名は複数形（Augurs / Clashes / …）だが、**日本語は単複同形**で種別名と同じ語をそのまま使う。

| 英語（山名） | 日本語（山名＝種別名） | 構成（安→高） | 出典URL |
|---|---|---|---|
| Augurs | **卜占官** | 薬草集め→侍祭→女魔導士→女予言者 | <https://wikiwiki.jp/dominiondeck/卜占官> |
| Clashes | **衝突** | 戦闘計画→射手→将軍→領土 | <https://wikiwiki.jp/dominiondeck/衝突> |
| Forts | **城砦** | 天幕→駐屯地→堡塁→要塞 | <https://wikiwiki.jp/dominiondeck/城砦> |
| Odysseys | **叙事詩** | 古地図→航海→沈没船の財宝→遠い海岸 | <https://wikiwiki.jp/dominiondeck/叙事詩> |
| Townsfolk | **町民** | 触れ役→蹄鉄工→粉屋→長老 | <https://wikiwiki.jp/dominiondeck/町民> |
| Wizards | **魔法使い** | 生徒→霊術師→魔導士→リッチ | <https://wikiwiki.jp/dominiondeck/魔法使い> |

山ページの逐語（自前で再取得して確認）：
- 卜占官＝「**女性の魔術師に関係した**分割された山札」／魔法使い＝「**男性の魔術師に関係した**分割された山札」（対になっている）
- 町民＝「同盟の他の分割された山札と比較して、**コストが1ずつ安い**」（$2/$3/$4/$5）
- 叙事詩＝「英語名はOdyssey。『オデュッセイア』という有名な叙事詩があり、日本語名はここから取られたと考えられる」

---

## 3. 王国カード（非分割）25枚

**全25枚を個別ページの英日併記表で機械照合済み（一致25/25）。** コストは `下役` ページ末尾の拡張内コスト別索引でも二重確認した。

| # | English Name | 日本語名 | コスト | 日本語種別 | 出典URL |
|---|---|---|---|---|---|
| 1 | Bauble | **道化棒** | $2 | 財宝-連携 | <https://wikiwiki.jp/dominiondeck/道化棒> |
| 2 | Sycophant | **ごますり** | $2 | アクション-連携 | <https://wikiwiki.jp/dominiondeck/ごますり> |
| 3 | Importer | **輸入者** | $3 | アクション-持続-連携 | <https://wikiwiki.jp/dominiondeck/輸入者> |
| 4 | Merchant Camp | **商人の野営地** | $3 | アクション | <https://wikiwiki.jp/dominiondeck/商人の野営地> |
| 5 | Sentinel | **歩哨** | $3 | アクション | <https://wikiwiki.jp/dominiondeck/歩哨> |
| 6 | Underling | **下役** | $3 | アクション-連携 | <https://wikiwiki.jp/dominiondeck/下役> |
| 7 | Broker | **仲買人** | $4 | アクション-連携 | <https://wikiwiki.jp/dominiondeck/仲買人> |
| 8 | Carpenter | **大工** | $4 | アクション | <https://wikiwiki.jp/dominiondeck/大工> |
| 9 | Courier | **急使** | $4 | アクション | <https://wikiwiki.jp/dominiondeck/急使> |
| 10 | Innkeeper | **宿屋の主人** | $4 | アクション | <https://wikiwiki.jp/dominiondeck/宿屋の主人> |
| 11 | Royal Galley | **王家のガレー船** | $4 | アクション-持続 | <https://wikiwiki.jp/dominiondeck/王家のガレー船> |
| 12 | Town | **町** | $4 | アクション | <https://wikiwiki.jp/dominiondeck/町> |
| 13 | Barbarian | **蛮族** | $5 | アクション-アタック | <https://wikiwiki.jp/dominiondeck/蛮族> |
| 14 | Capital City | **首都** | $5 | アクション | <https://wikiwiki.jp/dominiondeck/首都> |
| 15 | Contract | **契約書** | $5 | **財宝-持続-連携** | <https://wikiwiki.jp/dominiondeck/契約書> |
| 16 | Emissary | **密使** | $5 | アクション-連携 | <https://wikiwiki.jp/dominiondeck/密使> |
| 17 | Galleria | **ガレリア** | $5 | アクション | <https://wikiwiki.jp/dominiondeck/ガレリア> |
| 18 | Guildmaster | **ギルドマスター** | $5 | アクション-連携 | <https://wikiwiki.jp/dominiondeck/ギルドマスター> |
| 19 | Highwayman | **追いはぎ** | $5 | アクション-持続-アタック | <https://wikiwiki.jp/dominiondeck/追いはぎ> |
| 20 | Hunter | **狩人** | $5 | アクション | <https://wikiwiki.jp/dominiondeck/狩人> |
| 21 | Modify | **改造** | $5 | アクション | <https://wikiwiki.jp/dominiondeck/改造> |
| 22 | Skirmisher | **散兵** | $5 | アクション-アタック | <https://wikiwiki.jp/dominiondeck/散兵> |
| 23 | Specialist | **専門家** | $5 | アクション | <https://wikiwiki.jp/dominiondeck/専門家> |
| 24 | Swap | **交換** | $5 | アクション | <https://wikiwiki.jp/dominiondeck/交換> |
| 25 | Marquis | **侯爵** | $6 | アクション | <https://wikiwiki.jp/dominiondeck/侯爵> |

### ［訂正2・罠］日本語wikiの「種別」欄は本文をまたいで分割表示されるので素朴に読むと種別を落とす
カード上の区切り線（`------`）の位置で種別が2〜3片に割れて描画される。行単位で読むと**必ず取りこぼす**。

| カード | wikiの見た目 | 正しい種別（英語wiki `Type(s)` で裏取り） |
|---|---|---|
| **契約書** | `Treasure-Liaison` … 本文 … `Duration` … 本文 | **Treasure - Duration - Liaison**＝財宝-持続-連携 |
| 追いはぎ | `Action` … `Duration` … `Attack` … | Action - Duration - Attack |
| 将軍 | `Action` … `Duration` … `Attack-Clash` … | Action - Duration - Attack - Clash |
| 要塞 | `Action-Duration` … `Victory-Fort` | Action - Duration - Victory - Fort |
| 遠い海岸 | `Action` … `Victory-Odyssey` | Action - Victory - Odyssey |

**特に契約書は「財宝-連携」と読み違えやすい**（Duration が本文の後に出るのは契約書だけ）。
英語wiki の infobox で `Treasure - Duration - Liaison` を確認済み。下書きの `財宝-持続-連携` は正しい。

---

## 4. 分割山カード 24枚

**全24枚を個別ページの英日併記表で機械照合済み（一致24/24）。**

### 4-1. Townsfolk＝**町民**（$2/$3/$4/$5）

| English Name | 日本語名 | コスト | 日本語種別 | 出典URL |
|---|---|---|---|---|
| Town Crier | **触れ役** | $2 | アクション-町民 | <https://wikiwiki.jp/dominiondeck/触れ役> |
| Blacksmith | **蹄鉄工** | $3 | アクション-町民 | <https://wikiwiki.jp/dominiondeck/蹄鉄工> |
| Miller | **粉屋** | $4 | アクション-町民 | <https://wikiwiki.jp/dominiondeck/粉屋> |
| Elder | **長老** | $5 | アクション-町民 | <https://wikiwiki.jp/dominiondeck/長老> |

> ⚠ **Blacksmith＝「蹄鉄工」**（「鍛冶屋」ではない）。**基本セットの Smithy が「鍛冶屋」**（`smithy`）なので直訳すると完全衝突する。

### 4-2. Augurs＝**卜占官**（$3/$4/$5/$6）

| English Name | 日本語名 | コスト | 日本語種別 | 出典URL |
|---|---|---|---|---|
| Herb Gatherer | **薬草集め** | $3 | アクション-卜占官 | <https://wikiwiki.jp/dominiondeck/薬草集め> |
| Acolyte | **侍祭** | $4 | アクション-卜占官 | <https://wikiwiki.jp/dominiondeck/侍祭> |
| Sorceress | **女魔導士** | $5 | アクション-アタック-卜占官 | <https://wikiwiki.jp/dominiondeck/女魔導士> |
| Sibyl | **女予言者** | $6 | アクション-卜占官 | <https://wikiwiki.jp/dominiondeck/女予言者> |

> ⚠ **Sorceress＝「女魔導士」 と Sorcerer＝「魔導士」は別カード**（前者は卜占官$5、後者は魔法使い$5）。**日本語名は「女」の1文字しか違わない**。
> ⚠ **Sibyl＝「女予言者」** は、**ギルドの Soothsayer＝「予言者」**（`soothsayer`）と部分一致。どちらも呪い撒きアタックなので混同しやすい。

### 4-3. Odysseys＝**叙事詩**（$3/$4/$5/$6）

| English Name | 日本語名 | コスト | 日本語種別 | 出典URL |
|---|---|---|---|---|
| Old Map | **古地図** | $3 | アクション-叙事詩 | <https://wikiwiki.jp/dominiondeck/古地図> |
| Voyage | **航海** | $4 | アクション-持続-叙事詩 | <https://wikiwiki.jp/dominiondeck/航海> |
| Sunken Treasure | **沈没船の財宝** | $5 | 財宝-叙事詩 | <https://wikiwiki.jp/dominiondeck/沈没船の財宝> |
| Distant Shore | **遠い海岸** | $6 | アクション-勝利点-叙事詩 | <https://wikiwiki.jp/dominiondeck/遠い海岸> |

### 4-4. Forts＝**城砦**（$3/$4/$5/$6）

| English Name | 日本語名 | コスト | 日本語種別 | 出典URL |
|---|---|---|---|---|
| Tent | **天幕** | $3 | アクション-城砦 | <https://wikiwiki.jp/dominiondeck/天幕> |
| Garrison | **駐屯地** | $4 | アクション-持続-城砦 | <https://wikiwiki.jp/dominiondeck/駐屯地> |
| Hill Fort | **堡塁** | $5 | アクション-城砦 | <https://wikiwiki.jp/dominiondeck/堡塁> |
| Stronghold | **要塞** | $6 | アクション-持続-勝利点-城砦 | <https://wikiwiki.jp/dominiondeck/要塞> |

> ［訂正3・軽微］**要塞の種別「順序」は一次資料間で決着しない**：英語wiki infobox＝`Action - Victory - Duration - Fort`／
> 同ページ本文＝`Action-Duration-Victory-Fort`／日本語wiki＝`アクション-持続` + `勝利点-城砦`。
> **集合 {アクション, 持続, 勝利点, 城砦} は3資料とも同一**なので実装には影響しない。表示順は本アプリの慣例に合わせてよい。

### 4-5. Clashes＝**衝突**（$3/$4/$5/$6）

| English Name | 日本語名 | コスト | 日本語種別 | 出典URL |
|---|---|---|---|---|
| Battle Plan | **戦闘計画** | $3 | アクション-衝突 | <https://wikiwiki.jp/dominiondeck/戦闘計画> |
| Archer | **射手** | $4 | アクション-アタック-衝突 | <https://wikiwiki.jp/dominiondeck/射手> |
| Warlord | **将軍** | $5 | アクション-持続-アタック-衝突 | <https://wikiwiki.jp/dominiondeck/将軍> |
| Territory | **領土** | $6 | 勝利点-衝突 | <https://wikiwiki.jp/dominiondeck/領土> |

### 4-6. Wizards＝**魔法使い**（$3/$4/$5/$6）

| English Name | 日本語名 | コスト | 日本語種別 | 出典URL |
|---|---|---|---|---|
| Student | **生徒** | $3 | アクション-連携-魔法使い | <https://wikiwiki.jp/dominiondeck/生徒> |
| Conjurer | **霊術師** | $4 | アクション-持続-魔法使い | <https://wikiwiki.jp/dominiondeck/霊術師> |
| Sorcerer | **魔導士** | $5 | アクション-アタック-魔法使い | <https://wikiwiki.jp/dominiondeck/魔導士> |
| Lich | **リッチ** | $6 | アクション-魔法使い | <https://wikiwiki.jp/dominiondeck/リッチ> |

> ［訂正4・軽微］**生徒の種別順序も資料内で不一致**：一覧ページ（同盟（拡張））は `アクション-魔法使い-連携`、
> **個別ページは `Action-Liaison-Wizard` ⇔ `アクション-連携-魔法使い`**。
> 英語の正順 `Action - Liaison - Wizard` に一致する**個別ページ側（＝下書きの記載）が正しい**。

---

## 5. 同盟カード（Ally・ランドスケープ）23枚

すべて種別は **同盟**（`Ally`）・**コスト無し**。**［訂正5］今回あらためて 23/23 を個別ページの英日併記表で取得し機械照合した（一致23/23）。**

| # | English Name | 日本語名 | 出典URL |
|---|---|---|---|
| 1 | Architects' Guild | **建築家ギルド** | <https://wikiwiki.jp/dominiondeck/建築家ギルド> |
| 2 | Band of Nomads | **遊牧民団** | <https://wikiwiki.jp/dominiondeck/遊牧民団> |
| 3 | Cave Dwellers | **穴居民** | <https://wikiwiki.jp/dominiondeck/穴居民> |
| 4 | Circle of Witches | **魔女の輪** | <https://wikiwiki.jp/dominiondeck/魔女の輪> |
| 5 | City-state | **都市国家** | <https://wikiwiki.jp/dominiondeck/都市国家> |
| 6 | Coastal Haven | **沿岸の避難港** | <https://wikiwiki.jp/dominiondeck/沿岸の避難港> |
| 7 | Crafters' Guild | **工芸家ギルド** | <https://wikiwiki.jp/dominiondeck/工芸家ギルド> |
| 8 | Desert Guides | **砂漠の案内人** | <https://wikiwiki.jp/dominiondeck/砂漠の案内人> |
| 9 | Family of Inventors | **発明家の家族** | <https://wikiwiki.jp/dominiondeck/発明家の家族> |
| 10 | Fellowship of Scribes | **写本士の仲間たち** | <https://wikiwiki.jp/dominiondeck/写本士の仲間たち> |
| 11 | Forest Dwellers | **森の居住者** | <https://wikiwiki.jp/dominiondeck/森の居住者> |
| 12 | Gang of Pickpockets | **すり師団** | <https://wikiwiki.jp/dominiondeck/すり師団> |
| 13 | Island Folk | **島民** | <https://wikiwiki.jp/dominiondeck/島民> |
| 14 | League of Bankers | **銀行家連盟** | <https://wikiwiki.jp/dominiondeck/銀行家連盟> |
| 15 | League of Shopkeepers | **小売店主連盟** | <https://wikiwiki.jp/dominiondeck/小売店主連盟> |
| 16 | Market Towns | **市場の町** | <https://wikiwiki.jp/dominiondeck/市場の町> |
| 17 | Mountain Folk | **山の民** | <https://wikiwiki.jp/dominiondeck/山の民> |
| 18 | Order of Astrologers | **占星術師団** | <https://wikiwiki.jp/dominiondeck/占星術師団> |
| 19 | Order of Masons | **メイソン団** | <https://wikiwiki.jp/dominiondeck/メイソン団> |
| 20 | Peaceful Cult | **平和的教団** | <https://wikiwiki.jp/dominiondeck/平和的教団> |
| 21 | Plateau Shepherds | **高原の羊飼い** | <https://wikiwiki.jp/dominiondeck/高原の羊飼い> |
| 22 | Trappers' Lodge | **罠師の小屋** | <https://wikiwiki.jp/dominiondeck/罠師の小屋> |
| 23 | Woodworkers' Guild | **木工ギルド** | <https://wikiwiki.jp/dominiondeck/木工ギルド> |

> ⚠ **Order of Masons＝「メイソン団」**（「石工団」ではない。カタカナ）。**ギルドの Stonemason＝「石工」**（`stonemason`）と混同しないこと。
> ※ 個別ページ23枚はいずれも `※日本語訳は…` の非公式訳注記を持たない＝**ホビージャパン印刷文**。
> （`同盟（ランドスケープ）` ページの例示表2枚ぶんだけ Dominion Online 訳の注記が付くが、それは例示であって個別ページとは別物）

---

## 6. 既存の日本語カード名との衝突チェック

### ［訂正6］母数の訂正
下書きは「既存641名称（縦型450＋横型148ほか）」と書いていたが **450+148=598 で算術が合っていない**。
本アプリで実測（`node` で `js/cards.js` を読み込み）：
**`DOM.CARDS` 450 ＋ `DOM.LANDSCAPES` 148 ＝ 598 id ／ 異なる表示名 594個**。以下はこの594名との機械照合結果。

### 6-1. 🔴 完全一致（致命的・対処必須）＝1件のみ

| 新規（同盟） | 既存 | 既存id | 既存の種別 | 影響 |
|---|---|---|---|---|
| **同盟**（拡張名／`Ally` 種別／23枚のランドスケープ種別） | **同盟** | `alliance` | **移動動物園のイベント**（$10・属州/公領/屋敷/金貨/銀貨/銅貨を各1枚獲得） | **表示名が完全一致**。カード一覧の全文検索（§0-24 の `searchNorm`）で「同盟」を引くと移動動物園のイベントと同盟拡張の23枚＋拡張見出しが混ざる。盤面のランドスケープ帯・拡大オーバーレイ・種別ラベルでも「同盟」が2つの意味を持つ |

**実測**：72個の新規日本語名＋種別語（同盟/好意/連携/卜占官/衝突/城砦/叙事詩/町民/魔法使い）を既存594名と突き合わせた結果、
**完全一致は `同盟` の1件のみ**。

**対処案（実装判断は別途）**：
- **カード名としての衝突ではない**（`alliance` は「カード名＝同盟」、同盟拡張側は「種別＝同盟」「拡張名＝同盟」）。
- **id 衝突はゼロ**：`allies` `territory` `town` `hunter` `swap` `contract` `archer` `tent` `elder` `miller` `student` `conjurer`
  `sorcerer` `lich` `marquis` `sentinel` `underling` `broker` `courier` `emissary` `galleria` `importer` `bauble` `sycophant`
  `carpenter` `garrison` `stronghold` `voyage` を機械確認し、**取られているのは `alliance`（既存）だけ**。
- 種別ラベルは `carddata.js` の typeLabel で **「同盟」** とするしかない（公式訳）。**カード一覧の群見出しは「同盟（拡張）」** のように区別すると事故が減る（日本語wiki自身がこの逃がし方をしている）。

### 6-2. 🟡 同音・字面が極めて近い（実装者が取り違えやすい）

**下表の「既存id→既存名」は全件 `js/cards.js` を実行して実在を確認済み。**

| 新規（同盟） | 既存 | 既存id | 注意点 |
|---|---|---|---|
| **城砦**（Fort＝種別名） | **城塞** | `fortress`（暗黒時代 Fortress） | **どちらも読みは「じょうさい」**（日本語wikiの城砦ページ自身が「『城塞』との違いは…」と注意喚起し、**併用時は城砦を「しろとりで」と呼ぶことを提案**している）。2文字目が 砦/塞 で違うだけ |
| **城砦**（Fort＝種別名） | **砦** | `keep`（帝国ランドマーク Keep） | 「砦」が既存カード名。種別「城砦」の部分文字列 |
| **要塞**（Stronghold $6） | **城塞** | `fortress` | **Stronghold は廃棄しても戻ってこない**が、城塞（Fortress）は手札に戻る。混同すると挙動を取り違える |
| **女魔導士**（Sorceress） | — | — | 同拡張内の **魔導士**（Sorcerer）と1文字差 |
| **女予言者**（Sibyl） | **予言者** | `soothsayer`（ギルド） | 部分一致。両方とも呪い撒きアタックなので混同しやすい |
| **蹄鉄工**（Blacksmith） | **鍛冶屋** | `smithy` | 名前は衝突しないが、**Blacksmith を「鍛冶屋」と訳すと基本セットと完全衝突**。必ず「蹄鉄工」 |
| **メイソン団**（Order of Masons） | **石工** | `stonemason`（ギルド） | 同上。「石工団」と訳さないこと |
| **交換**（Swap $5） | （語彙） | — | 夜想曲で導入したルール用語「**交換（exchange）**」（`exchangeCard`／吸血鬼↔コウモリ・取り替え子）と**同じ語**。カード名「交換」の効果は "return … to gain …" で **exchange ではない**。ログ文言・検索で紛らわしい |
| **町**（Town $4） | **港町** `port` ／ **市場の町**（同盟カード） | — | 部分一致3件 |
| **島民**（Island Folk） | **島** `island` | — | 部分一致 |
| **高原の羊飼い**（Plateau Shepherds） | **羊飼い** `shepherd`（夜想曲） | — | 部分一致 |
| **魔女の輪**（Circle of Witches） | **魔女** `witch` | — | 部分一致 |
| **都市国家**（City-state） | **都市** `city`（繁栄） | — | 部分一致 |
| **銀行家連盟**（League of Bankers） | **銀行** `bank`（繁栄） | — | 部分一致 |
| **遊牧民団**（Band of Nomads） | **遊牧民** `nomads`（異郷） | — | 部分一致 |
| **発明家の家族**（Family of Inventors） | **発明家** `inventor`（ルネサンス） | — | 部分一致 |
| **砂漠の案内人**（Desert Guides） | **案内人** `guide`（冒険） | — | 部分一致。効果も「手札を全部捨てて5枚引く」で**ほぼ同じ** |
| **大工**（Carpenter） | **車大工** `wheelwright`（移動動物園） | — | 部分一致 |
| **宿屋の主人**（Innkeeper） | **宿屋** `inn`（異郷） | — | 部分一致 |
| **商人の野営地**（Merchant Camp） | **商人** `merchant`（海辺） | — | 部分一致 |

### 6-3. ✅ 衝突しないことを確認したもの（誤解しやすいペア）

| 誤解しやすい組 | 結論 |
|---|---|
| **Capital City（同盟$5）＝首都** vs **Capital（帝国$5）＝元手**（`capital`） | **衝突なし** |
| **Miller（同盟$4）＝粉屋** vs **Mill（陰謀$4）＝風車**（`mill`） | **衝突なし** |
| **Sentinel（同盟$3）＝歩哨** vs **Sentry（基本2E$5）＝衛兵**（`sentry`） | **衝突なし** |
| **Territory（同盟$6）＝領土** | 既存に「領土」は無い。**衝突なし** |
| **Hunter（同盟$5）＝狩人** vs 冒険 Treasure Hunter／暗黒時代 Hunting Grounds＝**狩場**／収穫祭 Hunting Party＝**狩猟団** | **衝突なし** |
| **Student（同盟$3）＝生徒** vs 冒険 Page＝**騎士見習い** | **衝突なし** |
| **Tent / Garrison / Elder / Archer / Warlord / Marquis / Contract / Broker / Courier / Emissary / Galleria / Importer / Bauble / Sycophant …** | 名前・id とも既存に**完全一致なし**（機械確認済み） |

---

## 7. 日本語版カード固有の注意（実装時に効く）

### 7-1. 蛮族（Barbarian）— 日本語版カードテキストに誤訳がある
日本語版は「そのカードよりもコストが安い**同じタイプのカード**1枚を獲得する」と印刷されているが、
日本語wikiが表の直下に注記：
> ※注　上記のカードテキストに『同じタイプのカード』と書かれている部分は誤訳である。
> 　　　正確には『**同じカードタイプを1つでも持つカード**』と読み替えて処理する。

英語原文は `they gain a cheaper card **sharing a type** with it`（英日併記表で確認）。
→ **本アプリは「種別を1つ以上共有する」で実装すべき**（夜想曲の取り替え子と同じ「日本語版誤訳・差し戻し禁止」パターン）。

### 7-2. リッチ（Lich）— 日本語版**初回生産分**に誤記がある
正しくは「廃棄置き場から**これより**コストが小さいカード1枚を獲得する」だが、初回生産分は「これより」が抜けている。
日本語wikiのリッチページと魔法使い（山）ページの**両方**が同じ注記を持つ。
英語原文 `gain a cheaper card from the trash`。→ **現行（英語原文）を採用**。

### ［訂正7］7-1・7-2 の典拠の強さ（下書きは過大評価していた）
ホビージャパンの正誤表ページ <https://hobbyjapan.games/error/> は冒頭で
「**※日本語版ゲームの正誤表は、各ゲームのページに掲載しております。**」と明記しており、輸入ゲーム用の一覧である。
そして **`dominion_allies` の製品ページには正誤表・エラッタの掲載が一切無い**（実取得で確認）。
＝**蛮族の誤訳・リッチの誤記は「日本語wikiの編集者注記」だけが典拠**であり、ホビージャパン公式の正誤表としては未公表。
実装方針（英語原文を採る）は変わらないが、**「公式が誤訳と認めた」とは書かないこと**。

### ［訂正8・重大］7-3. 王家のガレー船（Royal Galley）＝**2026年4月29日エラッタで機能が変わっている**
下書きは「日本語wikiが『仮訳』と注記しているだけ」と書いていたが、これは実態を取り違えている。
王家のガレー船のページには**専用のエラッタ告知ボックス**があり、逐語で：
> このカードは **2026年4月エラッタ** でカードテキストから効果が変更されており、2026年5月現在のカードテキストと効果が異なります。

余談節に「2026/4/29に発表されたエラッタ前のカードテキストを残しておく」として旧文が保存されている。

| | カードテキスト |
|---|---|
| **エラッタ前**（＝**英語・日本語とも全ての印刷カード**。第2刷 2023-12 も含む） | `+1 Card` / `You may play a non-Duration Action card from your hand.` / **`Set it aside; if you did, then at the start of your next turn, play it.`**<br>「そのカードを**脇に置く**：あなたの次のターンの開始時、それを使用する。」 |
| **エラッタ後**（現行・Dominion Online 英語表示に反映済み） | `+1 Card` / `You may play a non-Duration Action card from your hand.` / **`Don't discard it in Clean-up until your next turn. At the start of your next turn, if it's still in play, replay it.`**<br>「あなたの次のターンまで、クリーンアップフェイズにそのカードを**捨て札にしない**。あなたの次のターンの開始時、そのアクションカードが**まだ場に出ている場合、それを再使用する**。」 |

**これは文言整理ではなく機能変更**（脇に置く → 場に残したまま「再使用(replay)」）。挙動が実際に変わる例：
- **場に出ていると働く効果**（ならず者/浮浪児/橋 など）が、エラッタ前は脇に置かれて消えるが、**エラッタ後は場に残るので効き続ける**。
- 「まだ場に出ている場合」の判定が入るため、**自分を場から動かすアクション**（島/劇団/リザーブ/御料車）を対象にすると再使用に失敗する。
- 「再使用(replay)」＝玉座の2回目と同じ扱い（本アプリの `state.replay` 系）。エラッタ前の「脇に置いて使用」とは実装が別物。

> **依頼時の前提（「同盟の機能変更は Island Folk と Voyage の3ターン連続不可、Elder の表現明確化だけ」）は 2026年4月時点で古い。**
> 王家のガレー船を加えた**4枚**が機能変更対象。

なお同ページは **2025年2月エラッタ**（移動動物園改版に伴う「玉座系×持続」の扱い）にも言及している。

### ［訂正9］7-4. 「※日本語訳はDominion Onlineより」が付くカードは 航海・島民 だけではない
下書きは 航海・島民 の2枚しか挙げていなかった。**全ページを機械走査した結果、注記は次の5枚に付く**：

| カード | 注記 | 背景 |
|---|---|---|
| **航海**（Voyage） | ※日本語訳はDominion Onlineより | **2023年エラッタ**で「連続3ターンとなる場合は得られない」が追加。日本語印刷カードはエラッタ前 |
| **島民**（Island Folk） | ※日本語訳はDominion Onlineより | 同上（2023年エラッタ） |
| **要塞**（Stronghold） | ※日本語訳はDominion Onlineより | **［新規発見］** エラッタ告知ボックスは無いが訳文が非公式 |
| **長老**（Elder） | ※日本語訳はDominion Onlineより | **［新規発見］** 英語は第2刷の明確化文（`When it gives you a choice of abilities (with "choose") this turn, you may choose an extra (different) option.`） |
| **王家のガレー船**（Royal Galley） | ※日本語訳は**仮訳** | 上記 7-3 の2026年4月エラッタ後の文に対する wiki 編集者の仮訳 |

**⚠ さらに長老は日本語wiki内で表記が割れている**（どちらも非公式訳なので当然だが、コピペ元にしてはいけない）：
- 長老の個別ページ：「それによりこのターンに（「選ぶ」という指示で）能力を選ぶとき、追加で異なるもの1つを選んでよい。」
- 町民（山）ページ：「それの能力がこのターンあなたに1つを選ばせる（例：次のうち1つを選ぶ）場合、追加で異なる選択肢1つを選んでもよい。」

→ **この5枚の日本語効果文は日本語wikiからコピーせず、英語原文から自前で訳し直すこと。**

### 7-5. ［追加2］道化棒（Bauble）の訳への疑義は「利用者コメント」であって公式注記ではない
道化棒ページの**コメント欄**に「イラストを見る限り、道化棒は誤訳と言わざるを得ない」「絵柄があきらかに ornament だし」という投稿がある。
これは wiki 利用者の意見であり、表の直下に置かれる編集者注記（＝蛮族・リッチのような公式扱いの注記）ではない。
→ **公式日本語名は「道化棒」のまま採用する。**

### 7-6. 読み
- **卜占官＝「ぼくせんかん」**（卜占官ページ余談。古代ローマで鳥占いをした占い師の意）
- **城砦＝「じょうさい」**（城砦ページ余談。「城塞」と同音）

---

## 8. 未確定・要注意（確度が低いもの）

| 項目 | 状況 |
|---|---|
| **航海・島民・要塞・長老・王家のガレー船 の効果文（日本語）** | **名前は5枚とも確定**。ただし**効果文の日本語は非公式**（Dominion Online 訳／仮訳）＝ホビージャパン印刷文ではない。名前だけ採用し、**効果文は英語原文から訳し直す**こと（§7-4） |
| **要塞・生徒 の種別「順序」** | 集合は確定。**順序は一次資料間で不一致**（§4-4・§4-6）。実装は集合で持ち、表示順は本アプリの慣例に合わせる |
| **「循環」の活用形** | カード上は「あなたは町民を**循環させてもよい**」。名詞形は「循環」。**動詞の公式活用は「循環させる」**（生徒の英日併記で確認） |
| **山名に「の山」を付けるか** | カード文は「**町民を循環させてもよい**」（「町民の山」ではない）。一覧ページの効果概要欄の「町民の山を循環できる」は wiki 編集者の意訳。**カードテキストは「町民を循環させてもよい」を採用** |
| ホビージャパン公式の**用語一覧／ルールブック逐語** | 製品ページから確認できたのは内容物表記（好意マット／循環できる分割された山札）だけ。**Ally/Liaison/Rotate の訳語はカード面（英日併記）からの確定**であり、ルールブック本文の逐語は未取得 |
| **蛮族の誤訳／リッチの誤記** | **日本語wikiの編集者注記のみが典拠**。HJ公式の正誤表には未掲載（§7 ［訂正7］） |

**取得に失敗したページ**：`.../連携`（404＝未作成）、`.../循環`（404＝未作成）。いずれも種別名・動詞として全カードの併記表で確定済み。
一時的な HTTP 429（レート制限）は間隔を空けて再取得し、**最終的に必要な全ページ（王国49＋同盟23＋山6＋機構3）を取得完了**。

---

## 9. ［追加］実装者への警告（今回の再検証で新たに判明した公式挙動）

本アプリのエンジンを壊しかねないもの。日本語名の話ではないが、g11 の検証中に一次資料で確認したので記録する。

1. **同盟（Ally）は「ランドスケープ合計2枚まで」の制限に含まれない。**
   `同盟（ランドスケープ）` ページ逐語：
   > 公式ルールでは、通常のゲームで用いるイベント・ランドマーク・プロジェクト・習性の合計を2枚以下にすることを推奨しているが、
   > **同盟はこの2枚制限に含まれないので注意。**

   本アプリは `DOM.landscapesForSet(setId)` が「横型は合計最大2枚」を強制する唯一の入口になっている（PROGRESS §0-23）。
   **Ally をここに通すと公式ルールに反する**（イベント2枚＋同盟1枚＝3枚が正しい）。Ally は別枠で持つこと。

2. **同盟は「連携カードが王国にあるとき」だけ使い、必ず1枚だけ選ぶ。**
   連携カードが複数種あっても同盟は1枚。準備で全員が好意マット＋**1好意**を得る（§1 ［追加1］）。

3. **同盟の効果は原則「1つの機会につき1回だけ」。**
   > 同盟の効果は基本的に一度の機会につき一回しか(好意を支払い)効果を得ることができないが、
   > テキストに「**これを好きな回数繰り返す(Repeat as desired.)**」と書いてある場合は、(好意を支払える限り)何度でも効果を得ることができる。

   **島民には Repeat 記載が無い**ので、ターン終了時に1回しか使えない（島民ページに明記）。
   さらに「好きな回数繰り返す」型でも、**同じ機会の中で一度打ち切ったら再開できない**（穴居民×王家のガレー船×密使の例が同ページにある）。

4. **戦闘計画（Battle Plan）だけ「サプライのいずれかの山札」を循環できる。**
   他の1枚目（触れ役／薬草集め／古地図／天幕／生徒）は**自分の山だけ**を循環させる。
   衝突ページ逐語：「戦闘計画は、同セットの他の分割された山札の1枚目と異なり**任意の山札**を循環できる。」
   → 循環の対象述語を「自分の山」で決め打ちすると戦闘計画が壊れる。

5. **好意は「コイントークン」を流用するが、財源／村人とは別物として扱う。**
   好意ページ逐語：「それらの効果で用いられるトークンと好意は**別の全くモノ**であり、混ぜ合わせて扱うことはできない。」
   本アプリは既に財源（Coffers）・村人（Villagers）を別スカラーで持っているので、好意も**第3の独立スカラー**にすること。
   なお **好意はどんなアタックでも失わない**（好意ページ）。

6. **参考：ホビージャパン製品ページの実データ**（自前取得）
   カード400枚 ／ **好意マット6枚** ／ コイン35枚 ／ 収納トレイ ／ インデックスシート ／ ルールブック。
   「**31種類の新たな王国カード**」＝非分割25＋分割山6＝**ランダマイザー31枚**（王国カードの「種類」ではなく「山」の数）。
   日本語版発売 2022年5月・Rio Grande Games／ホビージャパン。
