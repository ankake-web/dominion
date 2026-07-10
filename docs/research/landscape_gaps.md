以下が回答集です（この本文がそのまま返り値になります。ファイルには書き出していません）。

---

# ドミニオン 横型ランドスケープ実装 — 未確定事項の回答集

対象：帝国(Empires)のイベント13＋ランドマーク21、冒険(Adventures)のイベント20。本文はリサーチ確定分（6項目）を実装に落とすための正本メモ。
**スコープ注意**：PROGRESS.md のとおり横型ランドスケープは現行の縦枠(768×1152)生成パイプライン未対応＝**段階1(画像化)すら未着手**。本文は「横長枠パイプライン＋Event/Landmark基盤」を作るときのルール正本であり、いま縦型カードに手を入れるものではない。

参照コード基準（`js/engine.js`）：
- `gain(state, pIndex, cardId, dest)` L536 … 全獲得の一元入口。末尾で `triggerOnGain` を呼ぶ（L581）。負債付与もここ（L553-558）。
- `trashCard(state, ownerIdx, card)` L594 … 全廃棄の一元入口。`state.trash.push`(L600)後に `triggerOnTrash`(L601)。**ownerIdx＝持ち主**。
- `BUY` reducer L5052 … `if ((me.debt||0)>0) return state;`(L5055) で負債時の購入拒否。
- `REPAY_DEBT` L8118／`vpOf(p)` L4164（終局得点・引数は p のみ・state を持たない）／`scoreGame(state)` L4199。
- `state.pileVP`（山上VPトークン＝集合機構。temple/farmers_market/wild_hunt が既に使用）／`p.vpTokens`（プレイヤーVPトークン）／`p.debt`／`costIsPlainCoin(id)` L2213。

---

## 0. 共通インフラ設計（6項目を貫く前提・実装の骨格）

複数項目が同じ新基盤を要求するので先にまとめる。

- **`state.landscapes`（0〜2要素の配列）** … その対局で使う Event/Landmark の id。10王国山とは別の横置きプール。**王国山の枚数(10)は絶対に変えない**（項目3）。`emptyPileCount`(L4134/3山終了)にも一切影響しない。
- **`state.landmarkVP = {[landmarkId]: 個数}`** … ランドマーク上のVPトークン残数。`state.pileVP`(山上VP)とは別スカラー。Aqueduct/Defiled Shrine は「山→ランドマーク→プレイヤー」と動くので **山側は既存 `state.pileVP` を流用**、ランドマーク側は `state.landmarkVP` に貯める。
- **Event購入アクション `BUY_EVENT`** … `BUY`(L5052)の双子。負債ガード・buy消費・複数回購入可を同じ形で持たせる（項目2）。`PLAYER_ACTIONS` に追加＋CPU/UI分岐必須（整合性テスト・無限ループ回避）。
- **終局スコアリング** … `vpOf(p)` は state を持たない（L4164）。Obelisk/Museum 等「選ばれた山」依存のランドマークは **`scoreGame(state)`(L4199)側で landmark 加点を別立て**するか、`vpOf(state, p)` に署名変更する。**推奨＝ scoreGame に landmark 加点ブロックを足す**（vpOf の呼び出し箇所が多く署名変更は波及が大きい）。
- **注意**：どの Landmark も「使用中は全員に公開・ゲーム開始から見える」＝maskStateForで伏せない。`state.pileVP` と同じく clone でそのまま残す。

---

## 1. Windfall（意外な授かり物・帝国イベント $5）

### 確定した答え
コスト**$5**（負債なし・通常コインコスト）。効果＝「デッキと捨て札置き場が**両方**空なら金貨3枚を獲得」。手札・場のカードは判定に**含めない**（デッキ＋捨て札のみ）。帝国イベントは全13種（Advance/Annex/Banquet/Conquest/Delve/Dominate/Donate/Ritual/Salt the Earth/Tax/Triumph/Wedding/Windfall）。

### 逐語引用（英文）
> "If your deck and discard pile are empty, gain 3 Golds."

### 出典URL
- https://dominioncg.fandom.com/wiki/Windfall
- https://dominion-portal.com/windfall
- https://www.ultraboardgames.com/dominion/empires-events-and-landmark-notes.php
- https://wikiwiki.jp/dominiondeck/一覧/イベント

### 確信度
**高**（コスト・英文・和名・13種リストを2独立ソースで相互確認。RGG公式PDFはバイナリで本文抽出不可、dominionstrategy/fandom本家は402/403だったが、他4ソースが一致）。

### 実装への含意
```
// BUY_EVENT の windfall 分岐
if (me.deck.length === 0 && me.discard.length === 0) {
  gain(state, pi, 'gold', 'discard');
  gain(state, pi, 'gold', 'discard');
  gain(state, pi, 'gold', 'discard');
}
```
- **判定は `deck.length===0 && discard.length===0` のみ**。`hand`/`inPlay` を条件に入れない（よくある誤り）。
- 金貨獲得は既存 `gain()` を3回。金貨枯渇時は `gain` が `false` を返し自然に取りこぼす（保存則OK）。
- Event なので新pendingは不要（即時解決）。CPU/UIは「買えるとき常に得か」を判定する分岐だけ。

---

## 2. 負債とイベント購入（debt-events）

### 確定した答え
- **負債トークンを持つ間はカードもイベントも購入できない**（Projects＝ルネサンス以降だが同じ理屈で購入不可）。Landmarkは購入しないので無関係。
- **イベント購入はBuyを1つ消費**する（1ターンにVilla等でBuyが2なら「カード2／イベント2／カード+イベント」いずれも可、順不同）。
- **同じイベントを1ターンに複数回購入可**（Buyとコインが足りる限り）。
- **負債の返済はBuyを消費しない**。購入フェイズで、財宝プレイ後、$1＝負債1個、カード購入の前後どちらでも可。

### 逐語引用（英文）
> "Having Debt tokens prevents a player from buying cards or Events; Debt tokens do nothing else (for example they have no effect at the end of the game)."
> "Buying an Event uses up a Buy; ... A player with two Buys, such as after playing Villa, could buy two cards, or buy two Events, or buy a card and an Event (in either order)."
> "The same Event can be bought multiple times in a turn if the player has the Buys and [coins] available to do it."
> "Removing Debt does not use up a Buy."

### 出典URL
- https://www.riograndegames.com/wp-content/uploads/2022/03/Dominion-Rules-Empires.pdf （RGG公式帝国ルールブック 2022・Debt節/Events節を pdftotext で逐語抽出）

### 確信度
**高**（公式ルールブック本文の逐語）。

### 実装への含意
- `BUY_EVENT` reducer 冒頭に **`if ((me.debt||0)>0) return state;`** を `BUY`(L5055)と同形で置く。**「カードだけ拒否・イベントは通す」実装は誤り**。
- `BUY_EVENT` は `t.buys -= 1;`（Buy消費）。回数制限なし＝同一イベントを繰り返し呼べる（stateガードを設けない）。
- 返済は既存 `REPAY_DEBT`(L8118)がそのまま使える（Buy非消費・購入前後可は現行仕様のはず＝要確認）。
- 負債コストのイベント（Annex/Donate/Triumph/Wedding）は、購入時に `gain` を通らない（サプライに実体が無い）ので、**負債付与を `BUY_EVENT` 側で明示**する必要がある（`me.debt += C()[eventId].debt`）。gain経由の自動付与(L553)は効かない点に注意。
- CPUは購入フェイズで `debt>0` なら `REPAY_DEBT`→（コイン0なら）END_TURN、の既存ロジックにイベントを絡めない（負債中はイベントも候補から外す）。

---

## 3. 1ゲームで使うランドスケープ枚数（landscape-count）

### 確定した答え
- **0〜2枚**（公式推奨は最大2枚、0でもよい）。帝国では**Events と Landmarks の合算で最大2**（各2ではない）。冒険（Eventsのみ）も「2枚まで」。
- **王国カードではない＝王国山は常に10のまま**。ランドスケープが何枚(0〜2)出ても10山は不変。
- 選び方は**プレイヤーの自由**：ランダマイザに混ぜて10王国が揃うまでに出た0〜2枚を使う／Event・Landmarkを別デッキにして毎回1〜2枚配る／両方可。まとめて1山にした場合は「2枚」推奨がEvents+Landmark合算に掛かる。
- 帝国の除外規則：**Platinum/Colony・Shelters のランダマイザ判定ではランスケープをスキップ**。**若き魔女のBaneにはできない**。

### 逐語引用（英文）
> Empires: "For normal play we recommend using at most two Events and/or Landmarks per game; skip any further ones." "...when players turn over an Event or Landmark, they put it on the table but keep turning over cards until they get 10 Kingdom cards."
> Adventures: "Events are not Kingdom cards; you still use a full 10 kingdom cards when playing with Events."

### 出典URL
- RGG Dominion Adventures ルールブックPDF（Setup/Events節・pdftotext逐語）
- RGG Dominion Empires ルールブックPDF（Setup節/Landmarks節・pdftotext逐語）

### 確信度
**高**（両公式ルールブックの逐語）。

### 実装への含意
- `DOM.CARD_SETS` の帝国/冒険セットに **`landscapes: [...]`（0〜2 id）** を持たせる or セット選択UIで別枠に0〜2枚選ばせる。**このアプリは固定セット中心なので「セットごとに固定のランスケープ0〜2枚」を showcase 用に手で選ぶのが素直**（KINGDOM_EMPIRES と同じ発想）。
- `createInitialState` は **10王国山の生成を一切変えず**、`state.landscapes` を別途セットアップ（項目6のトークン配置もここ）。
- `emptyPileCount`(L4134)・3山終了・BlackMarket母集団・GAIN_ORDER 等、**カードとしての各種処理には一切混ぜない**（ランスケープは NON_SUPPLY 以前に「サプライではない」）。
- ランダム混成をやるなら：ランスケープは Platinum/Colony/Shelters 判定と若き魔女Bane抽選の母集団から除外。

---

## 4. Tomb（墓標・ランドマーク）と Mission（任務・冒険イベント）

### 確定した答え
**(A) Tomb**：「カードを廃棄するたび +1VP」。VPは**廃棄した本人（trasher）**に入る。**カードの所有者でも手番プレイヤーでもない**。
- 相手のアタック(詐欺師/騎士)で自分のカードが自分のターン外に廃棄される場合、廃棄を実行するのは**被害者本人**＝被害者に+1VP（自分の手番でなくても発火）。
- Salt the Earth でサプライの勝利点を廃棄＝実行者（Salt the Earthをプレイした人）に+1VP。
- 複数枚同時廃棄は**1枚ごとに+1VP**（礼拝堂で4枚廃棄＝+4VP）。

**(B) Mission（$4）**：現行/エラッタ本文＝「このターンの後に追加ターンを1回（ただし3連続ターンは不可）、その追加ターンでは**カードを購入できない（イベントは購入できる）**」。
- 追加ターンでカード購入：**不可**。イベント購入：**可**。購入以外の獲得（工房/魔除けの銀貨等）は**可**、カードのプレイ・廃棄・トラベラー交換も可。
- **Mission→Missionの連続追加ターンは不可**（現行文では「3連続ターン不可」＝Outpost/Voyage等の他の追加ターン源とのスタックも封じる）。

### 逐語引用（英文）
> TOMB: "When you trash a card, +1 VP." — Wiki FAQ: "This works even when it is not your turn, such as when you trash a card to Swindler ... and works when told to trash a card that is not yours, such as with Salt the Earth. You get +1 for each card you trash, even if you trash multiple cards at the same time."
> MISSION: "Take an extra turn after this one (but not a 3rd turn in a row), during which you can't buy cards. (You can still buy Events.)"

### 出典URL
- https://wiki.dominionstrategy.com/index.php/Tomb
- https://wiki.dominionstrategy.com/index.php/Mission
- https://www.ultraboardgames.com/dominion/empires-events-and-landmark-notes.php
- https://www.ultraboardgames.com/dominion/adventures-event-descriptions.php
- https://wiki.dominionstrategy.com/index.php/2022_Errata

### 確信度
**高**。

### 実装への含意
**Tomb**：
- 発火点は **`trashCard`(L594)に一本化**。`state.trash.push(card)`(L600)の直後で `if (landmarkActive(state,'tomb')) { state.players[ownerIdx].vpTokens += 1; }`。
  - **ownerIdx が正しい trasher になる**：現行エンジンは詐欺師/騎士のアタック廃棄も `owner=被害者` で trashCard を通す（L592コメント）＝被害者=trasher で一致。城塞(Fortress)は trash を経由して手札へ戻る（戻り値false）が、**廃棄イベント自体は起きている**ので +1VP は発火させる（戻り値に依存させない＝pushの直後に置く）。
  - 1枚ごとに trashCard が呼ばれるので複数枚同時廃棄も自動で+N。
- **例外＝サプライ札の廃棄（Salt the Earth）**：所有者がいない。Salt the Earth の reducer 内で「active プレイヤーに +1VP」を明示（trashCard(ownerIdx)経路に乗らないため）。
- **支配(Possession)中の退避**（L596-599：trashに入らず返す）では Tomb を発火**させない**（実際に trash に入っていない＝廃棄が起きていない）。

**Mission**：
- 追加ターン基盤は Outpost 型。`state.turn` に **`t.noBuyCards = true`（このターンはカード購入不可・イベントは可）** フラグ。`BUY`(L5052)冒頭に `if (t.noBuyCards) return state;` を追加、`BUY_EVENT` には掛けない。
- **3連続ターン禁止**：`t.extraTurnStreak`（連続追加ターン数）を持ち、Mission購入時に「現在が既に追加ターンなら追加ターンを与えない」＝`if (t.isExtraTurn) { /*付与しない*/ }`。厳密な「3連続不可」まで詰めるなら extraTurn を2連続まで許可し3つ目を拒否。**このアプリに現状 Outpost/Voyage は無い**ので、まずは「Mission→Missionを与えない」だけで実用上十分（デフォルト）。
- 追加ターンでも `gain()` 経由の獲得（工房等）は素通し＝**購入(BUY)だけを塞ぐ**のが要点。

---

## 5. 帝国ランドマーク／イベントの日本語名（jp-names）

### 確定した答え
帝国ランドマーク**21種**の公式和名（ホビージャパン／wikiwiki.jp）：

| EN | JP | EN | JP |
|---|---|---|---|
| Aqueduct | 水道橋 | Museum | 博物館 |
| Arena | 闘技場 | Obelisk | オベリスク |
| Bandit Fort | 山賊の砦 | Orchard | 果樹園 |
| Basilica | 公会堂 | Palace | 宮殿 |
| Baths | 浴場 | Tomb | 墓標 |
| Battlefield | 戦場 | Tower | 塔 |
| Colonnade | 列柱 | Triumphal Arch | 凱旋門 |
| Defiled Shrine | 汚された神殿 | Wall | 壁 |
| Fountain | 噴水 | Wolf Den | 狼の巣 |
| Keep | 砦 | Windfall(Event) | 意外な授かり物 |
| Labyrinth | 迷宮 | | |
| Mountain Pass | 峠 | | |

**要注意の非直訳2件**：Basilica＝**公会堂**（「バシリカ」ではない）／Keep＝**砦**（「天守」ではない）。Bandit Fort＝**山賊の砦**は Keep(砦)とは別カード。

### 逐語引用（英文）
> The wiki uses 公会堂 (not バシリカ) for Basilica and 砦 (not 天守) for Keep, confirming these are the official Japanese translations used in the game.

### 出典URL
- https://wikiwiki.jp/dominiondeck/帝国
- https://wikiwiki.jp/dominiondeck/ランドマーク
- https://dominion-portal.com/windfall

### 確信度
**高**（wikiwiki.jp の帝国/ランドマーク両ページで Basilica=公会堂・Keep=砦 を確認、ランキング本文でも砦/山賊の砦/公会堂が別項で一致）。

### 実装への含意
- `carddata.js` の name マップに上記21＋Windfall を登録。**Basilica=公会堂・Keep=砦・Bandit Fort=山賊の砦 を取り違えない**（砦の重複に注意＝id は `keep`/`bandit_fort` で別管理、表示名だけ「砦」「山賊の砦」）。
- 新種別ラベル `landmark`(ランドマーク)/`event`(イベント) を typeLabel/typeLabelEn に追加（integrity の種別ラベル網羅テストが検査）。
- **Mission の和名は本リサーチ未確定**（冒険イベント）。一般的には「任務」だが**未裏取り＝確信度中**。実装時に wikiwiki.jp/dominiondeck/冒険 で要確認。

---

## 6. 帝国ランドマークのセットアップとVP量（landmark-setup）

### 確定した答え（本リサーチがカバーした10種）
**「1人あたり6VP」型（6種）**：Arena／Basilica／Baths／Battlefield／Colonnade／Labyrinth。
- セットアップ＝**プレイヤー人数×6VP を配置**（2人=12／3人=18／4人=24）。1回の発動で**2VXずつ**プレイヤーへ。トークン枯渇後はそのランドマークで以後得点不可。
- Arena：購入フェイズ開始時、アクション1枚を捨ててよい→捨てたら+2VP。
- Basilica：カード購入時、コインが**$2以上残っていれば**+2VP。
- Baths：カードを1枚も獲得せずにターンを終えたら+2VP。
- Battlefield：勝利点カードを獲得したら+2VP（購入でなくても）。
- Colonnade：アクションカードを**購入**し、その同名を場に持っていれば+2VP（購入時のみ）。
- Labyrinth：自分のターンに**2枚目のカードを獲得**したら+2VP（ターンごと1回・2番目の獲得のみ）。

**「山の上にトークン」型（2種・集合機構と同型）**：
- Aqueduct（水道橋）：セットアップ＝**銀貨の山に8・金貨の山に8（各8＝計16VP・人数非依存）**。財宝を獲得すると**その財宝の山**から1VPを水道橋へ移す。勝利点カードを獲得すると水道橋上のVPを**全部**取る。
- Defiled Shrine（汚された神殿）：セットアップ＝**集合(Gathering)でない各アクション山の上に2VPずつ**（Farmers' Market/Temple/Wild Hunt には置かない・人数非依存）。アクションを獲得するとその山から1VPを神殿へ移す。**呪いを「購入」した**とき神殿上のVPを全部取る（他経路の呪い獲得では取れない）。

**トークン山なし型（2種）**：
- Obelisk（オベリスク）：セットアップ＝**ランダムなアクション山を1つ選ぶ**（トークンは置かない）。終局に、選ばれた山の**カード1枚につき2VP**。
- Mountain Pass（峠）：トークン山なし。**誰かが最初に属州を獲得した**直後、そのターンの後に**全員が1回ずつ入札（最大40負債・属州獲得者が最後）**。最高入札者は**+8VP**を得て入札額ぶんの負債を負う。

### 逐語引用（英文）
> Aqueduct — "When you gain a Treasure, move 1 VP from its pile to this. When you gain a Victory card, take the VP from this. Setup: Put 8 on the Silver and Gold piles."
> Defiled Shrine — "When you gain an Action, move 1 VP from its pile to this. When you buy a Curse, take the VP from this. Setup: Put 2 on each non-Gathering Action Supply pile."
> General — "Some Landmarks start with 6 tokens on them per player in the game. So, 12 in a 2-player game, up to 36 in a 6-player game... When the tokens on the Landmark run out, players cannot earn further points in that way."
> Mountain Pass — "When you are the first player to gain a Province, after that turn, each player bids once, up to 40 [Debt], ending with you. High bidder gets +8 and takes the [Debt] they bid."

### 出典URL
- RGG Dominion Empires ルールブックPDF（Landmark card texts / General Landmark rules・pdftotext逐語）
- https://www.ultraboardgames.com/dominion/empires-events-and-landmark-notes.php
- https://wiki.dominionstrategy.com/index.php/Aqueduct
- https://boardgamegeek.com/thread/1588315/aqueduct-setup

### 確信度
**高**（本10種は公式ルールブック逐語＋wiki/BGGで銀貨8・金貨8を確認）。

### 実装への含意
- **6VP型**：`state.landmarkVP[id] = 6 * state.players.length` を createInitialState で配置。発火点は既存フックに相乗り：
  - Basilica/Colonnade → `BUY`(L5052)の末尾（`triggerMerchantGuild`(L5080)の近く）。Basilica は `t.coins >= 2` を購入後残コインで判定。Colonnade は購入カードがアクション&`me.inPlay.includes(card)`。
  - Battlefield → `triggerOnGain`(L4355)で勝利点獲得時。Baths → END_TURN で `t.gainedThisTurn` が空なら。Labyrinth → `gain()` 内で「このターン2度目の獲得」を検出（`t.gainedThisTurn.length===2` の遷移時）。Arena → 購入フェイズ開始（END_ACTION_PHASE 直後）に pending で「アクション捨てるか」。
  - 各発火は `takeLandmark(state, pi, id, 2)`＝`min(2, landmarkVP[id])` を `p.vpTokens += n; landmarkVP[id] -= n;`（**枯渇したら0**）。
- **Aqueduct/Defiled Shrine**：**既存 `state.pileVP` 機構をそのまま流用**（temple/farmers_market/wild_hunt と同じ）。
  - セットアップ＝`state.pileVP.silver=8; state.pileVP.gold=8;`（Aqueduct）／各非集合アクション山に `state.pileVP[actId]=2`（Defiled Shrine）。
  - `triggerOnGain`(L4355)に「財宝獲得→`state.pileVP[財宝id]`から1を `landmarkVP.aqueduct` へ移動／勝利点獲得→landmarkVP.aqueduct を全取り」。Defiled Shrine は「アクション獲得→山→神殿」＋「呪いを**購入**（gainでなくBUY）→全取り」。**呪い購入限定**なので `BUY` 側で card==='curse' を判定（triggerOnGainではない）。
- **Obelisk**：`state.obeliskPile`（選ばれた山id）を createInitialState で決定。終局は `scoreGame`(L4199)で `+2 * (そのプレイヤーの obeliskPile 由来カード枚数)`。**分割山は名前が違っても同一山として数える**点に注意。**vpOf(p)は state を持たない**ので scoreGame 側で加点。
- **Mountain Pass**：最難関。`triggerOnGain` で「初属州獲得」を検知→**入札サブフェイズ（新pending）**を全員順番に回す（属州獲得者の左隣から、獲得者が最後）。落札者に `p.vpTokens += 8; p.debt += 入札額;`。CPUの入札方針・UIの入札モーダルが要る。**優先度低・複雑度高＝最後に回す**推奨。

---

## 7. 本リサーチで未確定・未調査の項目（正直な「不明」＋推奨デフォルト）

以下は今回のリサーチバッチで**逐語裏取りしていない**。実装前に個別調査（RGG公式PDF or dominionstrategy wiki）を推奨。カッコ内は一般知識ベースの推奨デフォルト（**要検証**）。

### (a) 残り11ランドマークの効果・セットアップ（**未調査＝要研究**）
Bandit Fort／Fountain／Keep／Museum／Orchard／Palace／Tower／Triumphal Arch／Wall／Wolf Den（＋Tombは項目4で確定済）。
- いずれも**トークン山を持たない終局スコアリング型**（Wolf Denは終局ペナルティ）と見られる＝実装は `scoreGame(state)` の加点/減点ブロックで済む見込み。ただし**正確なVP係数・条件は未裏取り**。
- **推奨デフォルト＝実装保留**（この10種を出荷セットに入れない）。入れるなら1枚ずつ公式ルールブック逐語で確定してから。特に Museum(異なる名前1種につき2VP)・Keep(各財宝で最多所持なら5VP)・Wall(15枚超のカード1枚につき-1VP)・Wolf Den(1枚だけ持つカード1種につき-3VP) は**係数の記憶が曖昧＝必ず裏取り**。

### (b) 帝国イベント残り12種（**未調査＝要研究**）
Advance／Annex／Banquet／Conquest／Delve／Dominate／Donate／Ritual／Salt the Earth／Tax／Triumph／Wedding（Windfallのみ項目1で確定）。
- 負債コスト（Annex/Donate/Triumph/Wedding）は項目2の負債付与を `BUY_EVENT` で明示する必要あり。
- Salt the Earth は項目4のTomb連携（サプライ廃棄＝実行者に+VP）を持つ。Dominate/Conquest は勝利点トークン付与、Tax は山上に負債を置く独自機構（`state.pileDebt` 新設が要る）。**Tax は集合機構と別の「山上負債」＝独自state**が必要な点だけ先に注意喚起。
- **推奨デフォルト＝Windfall/Banquet/Delve 等の単純イベントから着手**、負債・入札・山上負債を伴うものは後回し。

### (c) 冒険イベント20種（**未調査＝要研究、Missionのみ項目4で確定**）
Alms/Borrow/Quest/Save/Scouting Party/Travelling Fair/Bonfire/Expedition/Ferry/Plan/Mission/Pilgrimage/Ball/Raid/Seaway/Trade/Lost Arts/Training/Inheritance/Pathfinding。
- 多くが**トークンを山や自分に置く**（Ferry/Plan/Seaway/Lost Arts/Training/Pathfinding＝山トークン、既存 `p.pileTokens`(教師で実装済)が流用可能）。Inheritance は屋敷にアクション能力を付与する特殊機構＝別扱い。
- **推奨デフォルト＝トークン不要の単純イベント（Alms/Borrow/Quest/Save/Expedition/Travelling Fair/Bonfire等）から着手**。Inheritance は最後。

### (d) Mission の日本語名（**確信度中**）
「任務」が有力だが本リサーチ未裏取り。wikiwiki.jp/dominiondeck/冒険 で要確認。

### (e) ランドマークのタイブレーク・端数（**一般ルールで補える＝低リスク**）
6VP型の「2VP取得で残1個なら1個だけ取る」等は項目6の一般規則（枯渇後は取得0）でカバー済。`takeLandmark` を `min(2, 残)` にしておけば安全。

---

### まとめ（実装順の推奨）
1. **共通インフラ**（`state.landscapes`／`state.landmarkVP`／`BUY_EVENT`／scoreGame加点枠）→ 2. **単純Event**（Windfall等・負債ガードのテスト）→ 3. **6VP型ランドマーク6種**（既存フック相乗り）→ 4. **Aqueduct/Defiled Shrine**（`state.pileVP`流用）→ 5. **Tomb**（trashCard一点フック）→ 6. **Obelisk/残りスコア型ランドマーク**（要追加研究）→ 7. **Mission追加ターン**→ 8. **Mountain Pass入札／負債イベント／Tax山上負債**（複雑・最後）。

横型枠の画像生成パイプラインは (1) と並行して別途必要（現状の縦枠は流用不可）。