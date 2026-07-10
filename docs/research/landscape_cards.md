All key mechanisms confirmed with file:line anchors. Here is the canonical document (returned as text for the orchestration script to capture / save).

---

# 横型ランドスケープ（イベント／ランドマーク）実装 正本ドキュメント

対象＝**冒険（Adventures）のイベント20＋帝国（Empires）のイベント＋ランドマーク**。縦枠パイプライン（768×1152・`DOM.CARDS`）では未対応の「横長カード」を、既存エンジンにどう載せるかの設計正本。一次調査＋敵対検証済みデータ（`accurate=false` は `corrected` を採用）を基に、既存コードの流用先を `file:line` で示す。

> 参照した既存機構（実在確認済み）
> `engine.js`: `gain`(536) / `trashCard`(594) / `triggerOnGain`(4355) / `triggerOnTrash`(4590) / `triggerOnDiscard`(4567) / `costIsPlainCoin`(2213) / `cardCost`(BUY:5058) / `applyCoinPenalty`(90) / `applyPileTokens`(1180) / `validTeacherPiles`(1195) / `reshuffleDeck`(279) / `placeStash`(268) / `DURATION_RESOLVERS`(4274) / `cleanupAndAdvance`(4693) / `freshTurn`(335・`buysMade`/`actionsGainedThisTurn`(4454)/`buyPhaseGained`(579)/`gainedThisTurn`) / `vpOf`(4164) / `pickBane`(419) / `maybeStartOverpay`(684) / `endBuyTail`(4830) / `canBuyCard`(616) / `BUY`(5052) / `NON_SUPPLY`(18) / `splitLocked`(23)
> フィールド: `p.pileTokens`(400・`{card|action|buy|coin: 山id}`) / `state.pileVP`(476・集合Gathering) / `p.vpTokens`(繁栄VP) / `p.debt`＋`REPAY_DEBT` / `p.minusCard`(404) / `p.minusCoin`(405) / `p.journeyDown`(403) / `DOM.SPLIT_PILES`(cards.js:953) / `DOM.CARD_SETS`(cards.js:891)

---

## 0. 枚数の整合と入力データの誤り（先に読むこと）

依頼文は「冒険イベント20＋帝国イベント13＋帝国ランドマーク20＝53」だが、**入力データ54件のうち2件が同じ `trade`**（1件は正しく冒険、1件は帝国に誤ラベル）。検証で「帝国 `trade` は実際は Adventures の Trade」と確定。整理すると:

| 区分 | 依頼の数 | データ実数（重複除外） | 差分 |
|---|---|---|---|
| 冒険イベント | 20 | 20 | 一致 |
| 帝国イベント | 13 | **12**（`trade` は冒険の重複／**Windfall が欠落**） | −1 |
| 帝国ランドマーク | 20 | **21**（実際の帝国ランドマークは21種） | +1 |
| 合計（重複除外） | 53 | **53** | 相殺して一致 |

- 本書の総覧テーブル＝**53行（冒険イベント20＋帝国イベント12＋帝国ランドマーク21）**。帝国 `trade` 行は作らない（＝冒険 `trade` に統合）。
- **公式の完全セットは54種**（帝国イベントは13）。**欠落しているのは Windfall（帝国イベント $5）**。本データには無いので §6 で別調査を要すると記載。
- 名称修正2件（検証で確定）: **basilica の和名は「公会堂」**（初期データ「バシリカ」は読み仮名の誤採用）／**keep の和名は「砦」**（初期データ「天守」は誤り）。
- エラッタで文面が変わった札は **現行テキストを採用**（§6にリスト）。

---

## 1. 総覧テーブル（53行）

### 冒険（Adventures）イベント 20種

| id | 和名 | 英名 | 種別 | 拡張 | コスト | 一行説明 |
|---|---|---|---|---|---|---|
| alms | 施し | Alms | イベント | 冒険 | $0 | 1ターン1回・場に財宝が無ければ$4以下を1枚獲得 |
| borrow | 借入 | Borrow | イベント | 冒険 | $0 | ＋購入1。1回だけ-1カードトークンを置き＋$1 |
| quest | 探索 | Quest | イベント | 冒険 | $0 | アタック1/呪い2/任意6枚を捨てて金貨獲得 |
| save | 保存 | Save | イベント | 冒険 | $1 | 1回・＋購入1。手札1枚を退避しターン終了時（引いた後）手札へ |
| scouting_party | 偵察隊 | Scouting Party | イベント | 冒険 | $2 | ＋購入1。山札上5枚を見て3枚捨て残りを並べ替え |
| travelling_fair | 移動遊園地 | Travelling Fair | イベント | 冒険 | $2 | ＋購入2。今ターンの獲得を山札上に置いてよい |
| bonfire | 焚火 | Bonfire | イベント | 冒険 | $3 | 場の銅貨を2枚まで廃棄（現行エラッタ＝銅貨限定） |
| expedition | 探検 | Expedition | イベント | 冒険 | $3 | 次の手札を追加で2枚引く（累積） |
| ferry | 渡し船 | Ferry | イベント | 冒険 | $3 | -$2コストトークンをアクション山へ（自ターン中$2安く） |
| plan | 立案 | Plan | イベント | 冒険 | $3 | 廃棄トークンをアクション山へ（獲得時に手札1枚廃棄可） |
| mission | 使節団 | Mission | イベント | 冒険 | $4 | 追加ターン1回（3連続不可・カード購入不可） |
| pilgrimage | 巡礼 | Pilgrimage | イベント | 冒険 | $4 | 1回・旅トークン裏返し→表なら場の異名3枚までコピー獲得 |
| ball | 舞踏会 | Ball | イベント | 冒険 | $5 | -$1トークンを得て$4以下を2枚獲得 |
| raid | 奇襲 | Raid | イベント | 冒険 | $5 | 場の銀貨数だけ銀貨獲得＋他全員に-1カードトークン |
| seaway | 海路 | Seaway | イベント | 冒険 | $5 | $4以下アクション獲得＋その山に+1購入トークン |
| trade | 交易 | Trade | イベント | 冒険 | $5 | 手札2枚まで廃棄し廃棄数だけ銀貨獲得 |
| lost_arts | 失われた技術 | Lost Arts | イベント | 冒険 | $6 | +1アクショントークンをアクション山へ |
| training | 鍛錬 | Training | イベント | 冒険 | $6 | +$1トークンをアクション山へ |
| inheritance | 相続 | Inheritance | イベント | 冒険 | $7 | 1ゲーム1回・$4以下非命令アクションに屋敷トークン（屋敷が命令化） |
| pathfinding | 誘導 | Pathfinding | イベント | 冒険 | $8 | +1カードトークンをアクション山へ |

### 帝国（Empires）イベント 12種（Windfall 欠落・§6）

| id | 和名 | 英名 | 種別 | 拡張 | コスト | 一行説明 |
|---|---|---|---|---|---|---|
| advance | 昇進 | Advance | イベント | 帝国 | $0 | 手札のアクションを廃棄→$6以下アクションを獲得 |
| annex | 併合 | Annex | イベント | 帝国 | $0＋負債8 | 捨て札5枚残し他を山札へ混ぜ→公領獲得 |
| banquet | 宴会 | Banquet | イベント | 帝国 | $3 | 銅貨2枚＋$5以下の勝利点でないカード1枚を獲得 |
| conquest | 征服 | Conquest | イベント | 帝国 | $6 | 銀貨2枚獲得＋今ターン獲得の銀貨1枚ごと+1VP |
| delve | 掘進 | Delve | イベント | 帝国 | $2 | ＋購入1。銀貨1枚獲得（反復購入の定番） |
| dominate | 制圧 | Dominate | イベント | 帝国 | $14 | 属州獲得できたら+9VP |
| donate | 寄付 | Donate | イベント | 帝国 | $0＋負債8 | 次ターン開始時にデッキ全掃討→任意廃棄→5枚引く |
| ritual | 儀式 | Ritual | イベント | 帝国 | $4 | 呪い獲得→手札1枚廃棄しそのコスト$1ごと+1VP |
| salt_the_earth | 大地への塩まき | Salt the Earth | イベント | 帝国 | $4 | +1VP。サプライの勝利点カード1枚を廃棄 |
| tax | 徴税 | Tax | イベント | 帝国 | $2 | 山1つに負債2追加（準備で全山に負債1・購入獲得で受取） |
| triumph | 凱旋 | Triumph | イベント | 帝国 | $0＋負債5 | 屋敷獲得できたら今ターン獲得カード1枚ごと+1VP |
| wedding | 結婚式 | Wedding | イベント | 帝国 | $4＋負債3 | +1VP。金貨1枚を獲得 |

### 帝国（Empires）ランドマーク 21種（コスト無し）

| id | 和名 | 英名 | 種別 | 拡張 | コスト | 一行説明 |
|---|---|---|---|---|---|---|
| aqueduct | 水道橋 | Aqueduct | ランドマーク | 帝国 | — | 財宝獲得で山からVP移動・勝利点獲得でVP取得（準備:銀金に8ずつ） |
| arena | 闘技場 | Arena | ランドマーク | 帝国 | — | 購入フェイズ開始時アクション捨てて2VP（準備:6/人） |
| bandit_fort | 山賊の砦 | Bandit Fort | ランドマーク | 帝国 | — | 得点時・銀貨/金貨1枚ごと-2VP |
| basilica | 公会堂 | Basilica | ランドマーク | 帝国 | — | 購入フェイズの獲得時コイン2以上残なら2VP（準備:6/人） |
| baths | 浴場 | Baths | ランドマーク | 帝国 | — | カード未獲得でターン終了時2VP（準備:6/人） |
| battlefield | 戦場 | Battlefield | ランドマーク | 帝国 | — | 勝利点カード獲得で2VP（準備:6/人） |
| colonnade | 列柱 | Colonnade | ランドマーク | 帝国 | — | 購入フェイズにアクション獲得・場に同名あれば2VP（準備:6/人） |
| defiled_shrine | 汚された神殿 | Defiled Shrine | ランドマーク | 帝国 | — | アクション獲得で山からVP移動・購入フェイズの呪い獲得でVP取得 |
| fountain | 噴水 | Fountain | ランドマーク | 帝国 | — | 得点時・銅貨10枚以上で15VP |
| keep | 砦 | Keep | ランドマーク | 帝国 | — | 得点時・各財宝の最多所持ごと5VP（同数は全員） |
| labyrinth | 迷宮 | Labyrinth | ランドマーク | 帝国 | — | 自ターン2枚目の獲得で2VP（準備:6/人） |
| mountain_pass | 峠 | Mountain Pass | ランドマーク | 帝国 | — | 最初の属州獲得後に競り→最高入札者+8VP＆負債 |
| museum | 博物館 | Museum | ランドマーク | 帝国 | — | 得点時・異名1種ごと2VP |
| obelisk | オベリスク | Obelisk | ランドマーク | 帝国 | — | 得点時・選ばれた山由来のカード1枚ごと2VP（準備:山を無作為選択） |
| orchard | 果樹園 | Orchard | ランドマーク | 帝国 | — | 得点時・3枚以上ある異名アクション1種ごと4VP |
| palace | 宮殿 | Palace | ランドマーク | 帝国 | — | 得点時・銅銀金の1組ごと3VP |
| tomb | 墓標 | Tomb | ランドマーク | 帝国 | — | カード廃棄のたび+1VP |
| tower | 塔 | Tower | ランドマーク | 帝国 | — | 得点時・空山由来の勝利点でないカード1枚ごと1VP |
| triumphal_arch | 凱旋門 | Triumphal Arch | ランドマーク | 帝国 | — | 得点時・2番目に多いアクション1枚ごと3VP |
| wall | 壁 | Wall | ランドマーク | 帝国 | — | 得点時・15枚を超えるカード1枚ごと-1VP |
| wolf_den | 狼の巣 | Wolf Den | ランドマーク | 帝国 | — | 得点時・ちょうど1枚だけの札1種ごと-3VP |

> 和名はすべて検証済み（`(仮)` は無し）。ただし **basilica「公会堂」**（読み仮名バシリカ）と **keep「砦」** は初期データを修正した2件＝§6で最終確認推奨。

---

## 2. カード定義データ（`DOM.CARDS` にそのまま追記できる形）

`cost`＝コイン、`debt`＝負債（0なら無し）、`kind`＝`event|landmark`、`textJa` の `\n` はカード面の改行。負債コストは絶対に落とさないこと。

```js
// ===== 冒険（Adventures）イベント 20 =====
DOM.LANDSCAPE_ADVENTURES = [
  { id:'alms', nameJa:'施し', nameEn:'Alms', kind:'event', expansion:'adventures', cost:0, debt:0,
    textJa:'1ターンに1回：あなたのプレイエリアに財宝がない場合、\nコスト$4以下のカード1枚を獲得する。',
    textEn:'Once per turn: If you have no Treasures in play, gain a card costing up to $4.' },
  { id:'borrow', nameJa:'借入', nameEn:'Borrow', kind:'event', expansion:'adventures', cost:0, debt:0,
    textJa:'＋購入1。\n1ターンに1回：あなたの-1カードトークンが山札の上にない場合、\nそれを山札の上に置き、＋$1。',
    textEn:'+1 Buy. Once per turn: If your -1 Card token isn\'t on your deck, put it there and +$1.' },
  { id:'quest', nameJa:'探索', nameEn:'Quest', kind:'event', expansion:'adventures', cost:0, debt:0,
    textJa:'アタックカード1枚、呪い2枚、または任意の6枚を捨て札にしてよい。\nそうした場合、金貨1枚を獲得する。',
    textEn:'You may discard an Attack, two Curses, or six cards. If you do, gain a Gold.' },
  { id:'save', nameJa:'保存', nameEn:'Save', kind:'event', expansion:'adventures', cost:1, debt:0,
    textJa:'1ターンに1回：＋購入1。手札1枚を脇に置き、\nこのターンの終了時（手札を引いた後）にそれを手札に加える。',
    textEn:'Once per turn: +1 Buy. Set aside a card from your hand, and put it into your hand at end of turn (after drawing).' },
  { id:'scouting_party', nameJa:'偵察隊', nameEn:'Scouting Party', kind:'event', expansion:'adventures', cost:2, debt:0,
    textJa:'＋購入1。あなたの山札の上から5枚を見る。\nそのうち3枚を捨て札にし、残りを好きな順で山札の上に戻す。',
    textEn:'+1 Buy. Look at the top 5 cards of your deck. Discard 3 and put the rest back in any order.' },
  { id:'travelling_fair', nameJa:'移動遊園地', nameEn:'Travelling Fair', kind:'event', expansion:'adventures', cost:2, debt:0,
    textJa:'＋購入2。\nこのターンにカードを獲得するたび、それを山札の上に置いてよい。',
    textEn:'+2 Buys. When you gain a card this turn, you may put it onto your deck.' },
  { id:'bonfire', nameJa:'焚火', nameEn:'Bonfire', kind:'event', expansion:'adventures', cost:3, debt:0,
    textJa:'あなたの場の銅貨2枚以下を廃棄する。',
    textEn:'Trash up to 2 Coppers you have in play.' },
  { id:'expedition', nameJa:'探検', nameEn:'Expedition', kind:'event', expansion:'adventures', cost:3, debt:0,
    textJa:'次の手札のために追加で2枚引く。',
    textEn:'Draw 2 extra cards for your next hand.' },
  { id:'ferry', nameJa:'渡し船', nameEn:'Ferry', kind:'event', expansion:'adventures', cost:3, debt:0,
    textJa:'あなたの-$2コストトークンをアクションのサプライ山1つに移動する。\n（あなたのターンの間、その山のカードのコストが$2下がる。）',
    textEn:'Move your -$2 cost token to an Action Supply pile. (Cards from that pile cost $2 less on your turns.)' },
  { id:'plan', nameJa:'立案', nameEn:'Plan', kind:'event', expansion:'adventures', cost:3, debt:0,
    textJa:'あなたの廃棄トークンをアクションのサプライ山1つに移動する。\n（その山からカードを獲得したとき、手札1枚を廃棄してよい。）',
    textEn:'Move your Trashing token to an Action Supply pile. (When you gain a card from that pile, you may trash a card from your hand.)' },
  { id:'mission', nameJa:'使節団', nameEn:'Mission', kind:'event', expansion:'adventures', cost:4, debt:0,
    textJa:'このターンの後に追加のターンを1回行う（ただし3ターン連続は不可）。\nその追加ターン中は、カードを購入できない（イベントの購入は可能）。',
    textEn:'Take an extra turn after this one (but not a 3rd turn in a row), during which you can\'t buy cards.' },
  { id:'pilgrimage', nameJa:'巡礼', nameEn:'Pilgrimage', kind:'event', expansion:'adventures', cost:4, debt:0,
    textJa:'ターンに1度のみ：あなたの旅トークンを裏返す（ゲーム開始時は表向き）。\n表向きになった場合、場に出している名前の異なるカードを3枚まで選び、\nそれぞれのコピーを1枚ずつ獲得する。',
    textEn:'Once per turn: Turn your Journey token over (it starts face up); then if it\'s face up, choose up to 3 differently named cards you have in play and gain a copy of each.' },
  { id:'ball', nameJa:'舞踏会', nameEn:'Ball', kind:'event', expansion:'adventures', cost:5, debt:0,
    textJa:'あなたの-$1トークンを受け取る。\nその後、コスト$4以下のカードを2枚獲得する。',
    textEn:'Take your -$1 token. Gain 2 cards each costing up to $4.' },
  { id:'raid', nameJa:'奇襲', nameEn:'Raid', kind:'event', expansion:'adventures', cost:5, debt:0,
    textJa:'場に出ている銀貨1枚につき、銀貨を1枚獲得する。\n他のプレイヤーは全員、自分の-1カードトークンを自分の山札の上に置く。',
    textEn:'Gain a Silver per Silver you have in play. Each other player puts their -1 Card token on their deck.' },
  { id:'seaway', nameJa:'海路', nameEn:'Seaway', kind:'event', expansion:'adventures', cost:5, debt:0,
    textJa:'コスト$4以下のアクションカードを1枚獲得する。\n+1購入トークンをそのカードの山に移す。\n（その山のカードをプレイするたび、まず+1購入を得る）',
    textEn:'Gain an Action card costing up to $4. Move your +1 Buy token to its pile. (When you play a card from that pile, you first get +1 Buy.)' },
  { id:'trade', nameJa:'交易', nameEn:'Trade', kind:'event', expansion:'adventures', cost:5, debt:0,
    textJa:'手札を2枚まで廃棄する。廃棄したカード1枚につき、銀貨を1枚獲得する。',
    textEn:'Trash up to 2 cards from your hand. Gain a Silver per card you trashed.' },
  { id:'lost_arts', nameJa:'失われた技術', nameEn:'Lost Arts', kind:'event', expansion:'adventures', cost:6, debt:0,
    textJa:'+1アクショントークンを、任意のアクションのサプライ山に移す。\n（その山のカードをプレイするたび、まず+1アクションを得る）',
    textEn:'Move your +1 Action token to an Action Supply pile. (When you play a card from that pile, you first get +1 Action.)' },
  { id:'training', nameJa:'鍛錬', nameEn:'Training', kind:'event', expansion:'adventures', cost:6, debt:0,
    textJa:'+$1トークンを、任意のアクションのサプライ山に移す。\n（その山のカードをプレイするたび、まず+$1を得る）',
    textEn:'Move your +$1 token to an Action Supply pile. (When you play a card from that pile, you first get +$1.)' },
  { id:'inheritance', nameJa:'相続', nameEn:'Inheritance', kind:'event', expansion:'adventures', cost:7, debt:0,
    textJa:'ゲーム中に1度のみ：サプライから、命令(Command)でないコスト$4以下のアクションカード1枚を脇に置き、\nあなたの屋敷トークンをそれに置く。\n（あなたのターン中、あなたの屋敷は「屋敷トークンの置かれたカードを、そのまま置いたままプレイする」\n という能力を持つ命令(Command)アクションにもなる）',
    textEn:'Once per game: Set aside a non-Command Action card from the Supply costing up to $4. Move your Estate token to it. (During your turns, Estates are also Command Actions with "Play the card with your Estate token, leaving it there.")' },
  { id:'pathfinding', nameJa:'誘導', nameEn:'Pathfinding', kind:'event', expansion:'adventures', cost:8, debt:0,
    textJa:'+1カードトークンを、任意のアクションのサプライ山に移す。\n（その山のカードをプレイするたび、まず+1カードを得る）',
    textEn:'Move your +1 Card token to an Action Supply pile. (When you play a card from that pile, you first get +1 Card.)' },
];

// ===== 帝国（Empires）イベント 12（負債コストに注意） =====
DOM.LANDSCAPE_EMPIRES_EVENTS = [
  { id:'advance', nameJa:'昇進', nameEn:'Advance', kind:'event', expansion:'empires', cost:0, debt:0,
    textJa:'手札のアクションカード1枚を廃棄してもよい。\nそうしたなら、コスト$6以下のアクションカード1枚を獲得する。',
    textEn:'You may trash an Action card from your hand. If you do, gain an Action card costing up to $6.' },
  { id:'annex', nameJa:'併合', nameEn:'Annex', kind:'event', expansion:'empires', cost:0, debt:8,
    textJa:'捨て札置き場を見る。そこから最大5枚を選び、残りを山札に加えてシャッフルする。\n公領1枚を獲得する。',
    textEn:'Look through your discard pile. Choose up to 5 cards from it and shuffle the rest into your deck. Gain a Duchy.' },
  { id:'banquet', nameJa:'宴会', nameEn:'Banquet', kind:'event', expansion:'empires', cost:3, debt:0,
    textJa:'銅貨2枚と、コスト$5以下の勝利点でないカード1枚を獲得する。',
    textEn:'Gain 2 Coppers and a non-Victory card costing up to $5.' },
  { id:'conquest', nameJa:'征服', nameEn:'Conquest', kind:'event', expansion:'empires', cost:6, debt:0,
    textJa:'銀貨2枚を獲得する。このターンにあなたが獲得した銀貨1枚につき＋1勝利点。',
    textEn:'Gain 2 Silvers. +1 VP per Silver you\'ve gained this turn.' },
  { id:'delve', nameJa:'掘進', nameEn:'Delve', kind:'event', expansion:'empires', cost:2, debt:0,
    textJa:'＋購入1。銀貨1枚を獲得する。',
    textEn:'+1 Buy. Gain a Silver.' },
  { id:'dominate', nameJa:'制圧', nameEn:'Dominate', kind:'event', expansion:'empires', cost:14, debt:0,
    textJa:'属州1枚を獲得する。そうしたなら、＋9勝利点。',
    textEn:'Gain a Province. If you do, +9 VP.' },
  { id:'donate', nameJa:'寄付', nameEn:'Donate', kind:'event', expansion:'empires', cost:0, debt:8,
    textJa:'あなたの次のターンの開始時、まず、あなたの山札と捨て札置き場をすべて手札に加える。\nその中から好きな枚数のカードを廃棄し、残りを山札に混ぜてシャッフルし、5枚引く。',
    textEn:'At the start of your next turn, first, put your deck and discard pile into your hand, trash any number of cards from it, then shuffle the rest into your deck and draw 5 cards.' },
  { id:'ritual', nameJa:'儀式', nameEn:'Ritual', kind:'event', expansion:'empires', cost:4, debt:0,
    textJa:'呪い1枚を獲得する。そうしたなら、手札から1枚を廃棄する。\nそのコスト$1につき＋1勝利点。',
    textEn:'Gain a Curse. If you do, trash a card from your hand. +1 VP per $1 it costs.' },
  { id:'salt_the_earth', nameJa:'大地への塩まき', nameEn:'Salt the Earth', kind:'event', expansion:'empires', cost:4, debt:0,
    textJa:'＋1勝利点。サプライの勝利点カード1枚を廃棄する。',
    textEn:'+1 VP. Trash a Victory card from the Supply.' },
  { id:'tax', nameJa:'徴税', nameEn:'Tax', kind:'event', expansion:'empires', cost:2, debt:0,
    textJa:'サプライの山1つに負債トークンを2個置く。\n（セットアップ：各サプライの山に負債トークンを1個ずつ置く。\n プレイヤーが自分の購入フェイズにカードを獲得したとき、その山の負債トークンをすべて受け取る。）',
    textEn:'Add [2 Debt] to a Supply pile. (Setup: Add [1 Debt] to each Supply pile. When a player gains a card in their Buy phase, they take the Debt tokens from its pile.)' },
  { id:'triumph', nameJa:'凱旋', nameEn:'Triumph', kind:'event', expansion:'empires', cost:0, debt:5,
    textJa:'屋敷1枚を獲得する。そうしたなら、\nこのターンにあなたが獲得したカード1枚につき＋1勝利点。',
    textEn:'Gain an Estate. If you did, +1 VP per card you\'ve gained this turn.' },
  { id:'wedding', nameJa:'結婚式', nameEn:'Wedding', kind:'event', expansion:'empires', cost:4, debt:3,
    textJa:'＋1勝利点。金貨1枚を獲得する。',
    textEn:'+1 VP. Gain a Gold.' },
];

// ===== 帝国（Empires）ランドマーク 21（cost/debt は無し・0固定） =====
DOM.LANDSCAPE_EMPIRES_LANDMARKS = [
  { id:'aqueduct', nameJa:'水道橋', nameEn:'Aqueduct', kind:'landmark', expansion:'empires', cost:0, debt:0,
    textJa:'財宝を獲得したとき、その山から勝利点トークン1個をこの上に移す。\n勝利点カードを獲得したとき、この上にあるすべての勝利点トークンを受け取る。\n準備：銀貨と金貨の山に勝利点トークンを8個ずつ置く。',
    textEn:'When you gain a Treasure, move 1 VP from its pile to this. When you gain a Victory card, take the VP from this. Setup: Put 8 VP on the Silver and Gold piles.' },
  { id:'arena', nameJa:'闘技場', nameEn:'Arena', kind:'landmark', expansion:'empires', cost:0, debt:0,
    textJa:'あなたの購入フェイズの開始時、アクションカード1枚を捨て札にしてもよい。\nそうした場合、ここから勝利点トークン2個を受け取る。\n準備：プレイヤー1人につき勝利点トークン6個をここに置く。',
    textEn:'At the start of your Buy phase, you may discard an Action card. If you do, take 2 VP from here. Setup: Put 6 VP here per player.' },
  { id:'bandit_fort', nameJa:'山賊の砦', nameEn:'Bandit Fort', kind:'landmark', expansion:'empires', cost:0, debt:0,
    textJa:'得点計算時、あなたが持っている銀貨と金貨1枚につき-2勝利点。',
    textEn:'When scoring, -2 VP for each Silver and each Gold you have.' },
  { id:'basilica', nameJa:'公会堂', nameEn:'Basilica', kind:'landmark', expansion:'empires', cost:0, debt:0,
    textJa:'あなたの購入フェイズ中にカードを獲得したとき、コインが2以上残っていれば、\nここから勝利点トークン2個を受け取る。\n準備：プレイヤー1人につき勝利点トークン6個をここに置く。',
    textEn:'When you gain a card in your Buy phase, if you have $2 or more, take 2 VP from here. Setup: Put 6 VP here per player.' },
  { id:'baths', nameJa:'浴場', nameEn:'Baths', kind:'landmark', expansion:'empires', cost:0, debt:0,
    textJa:'カードを1枚も獲得せずにターンを終えたとき、ここから勝利点トークン2個を受け取る。\n準備：プレイヤー1人につき勝利点トークン6個をここに置く。',
    textEn:'When you end your turn without having gained a card, take 2 VP from here. Setup: Put 6 VP here per player.' },
  { id:'battlefield', nameJa:'戦場', nameEn:'Battlefield', kind:'landmark', expansion:'empires', cost:0, debt:0,
    textJa:'勝利点カードを獲得したとき、ここから勝利点トークン2個を受け取る。\n準備：プレイヤー1人につき勝利点トークン6個をここに置く。',
    textEn:'When you gain a Victory card, take 2 VP from here. Setup: Put 6 VP here per player.' },
  { id:'colonnade', nameJa:'列柱', nameEn:'Colonnade', kind:'landmark', expansion:'empires', cost:0, debt:0,
    textJa:'あなたの購入フェイズ中にアクションカードを獲得したとき、同名のカードが場に出ていれば、\nここから勝利点トークン2個を受け取る。\n準備：プレイヤー1人につき勝利点トークン6個をここに置く。',
    textEn:'When you gain an Action card in your Buy phase, if you have a copy of it in play, take 2 VP from here. Setup: Put 6 VP here per player.' },
  { id:'defiled_shrine', nameJa:'汚された神殿', nameEn:'Defiled Shrine', kind:'landmark', expansion:'empires', cost:0, debt:0,
    textJa:'アクションを獲得したとき、その山から勝利点トークン1個をこの上に移す。\nあなたの購入フェイズ中に呪いを獲得したとき、この上の勝利点トークンをすべて受け取る。\n準備：集合（Gathering）を持たない各アクションのサプライ山に勝利点トークン2個ずつ置く。',
    textEn:'When you gain an Action, move 1 VP from its pile to this. When you gain a Curse in your Buy phase, take the VP from this. Setup: Put 2 VP on each non-Gathering Action Supply pile.' },
  { id:'fountain', nameJa:'噴水', nameEn:'Fountain', kind:'landmark', expansion:'empires', cost:0, debt:0,
    textJa:'得点計算時、銅貨を10枚以上持っていれば15勝利点。',
    textEn:'When scoring, 15VP if you have at least 10 Coppers.' },
  { id:'keep', nameJa:'砦', nameEn:'Keep', kind:'landmark', expansion:'empires', cost:0, debt:0,
    textJa:'得点計算時、あなたが他のどのプレイヤーよりも多くの枚数を持っている\n（同数の場合は全員が得る）異なる名前の財宝1種につき5勝利点。',
    textEn:'When scoring, 5VP per differently named Treasure you have, that you have more copies of than any other player (they break ties).' },
  { id:'labyrinth', nameJa:'迷宮', nameEn:'Labyrinth', kind:'landmark', expansion:'empires', cost:0, debt:0,
    textJa:'自分のターン中に2枚目のカードを獲得したとき、ここから勝利点トークン2個を受け取る。\n準備：プレイヤー1人につき勝利点トークン6個をここに置く。',
    textEn:'When you gain a 2nd card in one of your turns, take 2 VP from here. (Setup: Put 6 VP here per player.)' },
  { id:'mountain_pass', nameJa:'峠', nameEn:'Mountain Pass', kind:'landmark', expansion:'empires', cost:0, debt:0,
    textJa:'いずれかのプレイヤーが最初に属州を獲得したとき、そのターンの後、\n各プレイヤーは1回ずつ、最大40負債まで競りを行う（あなたで終わる）。\n最高額の入札者は+8勝利点を得て、入札した額の負債を負う。',
    textEn:'When you are the first player to gain a Province, after that turn, each player bids once, up to 40 Debt, ending with you. High bidder gets +8 VP and takes the Debt they bid.' },
  { id:'museum', nameJa:'博物館', nameEn:'Museum', kind:'landmark', expansion:'empires', cost:0, debt:0,
    textJa:'得点計算時、あなたが持つ名前の異なるカード1種類につき2勝利点。',
    textEn:'When scoring, 2 VP per differently named card you have.' },
  { id:'obelisk', nameJa:'オベリスク', nameEn:'Obelisk', kind:'landmark', expansion:'empires', cost:0, debt:0,
    textJa:'得点計算時、選ばれた山から得たカード1枚につき2勝利点。\n（セットアップ：アクションのサプライ山を無作為に1つ選ぶ。）',
    textEn:'When scoring, 2 VP per card you have from the chosen pile. (Setup: Choose a random Action Supply pile.)' },
  { id:'orchard', nameJa:'果樹園', nameEn:'Orchard', kind:'landmark', expansion:'empires', cost:0, debt:0,
    textJa:'得点計算時、3枚以上持っている名前の異なるアクションカード1種類につき4勝利点。',
    textEn:'When scoring, 4 VP per differently named Action card you have 3 or more copies of.' },
  { id:'palace', nameJa:'宮殿', nameEn:'Palace', kind:'landmark', expansion:'empires', cost:0, debt:0,
    textJa:'得点計算時、銅貨・銀貨・金貨のセット1組につき3勝利点。',
    textEn:'When scoring, 3 VP per set you have of Copper - Silver - Gold.' },
  { id:'tomb', nameJa:'墓標', nameEn:'Tomb', kind:'landmark', expansion:'empires', cost:0, debt:0,
    textJa:'カードを廃棄するたび、+1勝利点。',
    textEn:'When you trash a card, +1 VP.' },
  { id:'tower', nameJa:'塔', nameEn:'Tower', kind:'landmark', expansion:'empires', cost:0, debt:0,
    textJa:'得点計算時、空になったサプライ山に由来する、勝利点でないカード1枚につき1勝利点。',
    textEn:'When scoring, 1 VP per non-Victory card you have from an empty Supply pile.' },
  { id:'triumphal_arch', nameJa:'凱旋門', nameEn:'Triumphal Arch', kind:'landmark', expansion:'empires', cost:0, debt:0,
    textJa:'得点計算時、あなたのカードのうち2番目に多いアクションカード\n（同数の場合は好きな方）1枚につき3勝利点。',
    textEn:'When scoring, 3 VP per copy you have of the 2nd most common Action card among your cards (if it\'s a tie, count either).' },
  { id:'wall', nameJa:'壁', nameEn:'Wall', kind:'landmark', expansion:'empires', cost:0, debt:0,
    textJa:'得点計算時、最初の15枚を超えて持っているカード1枚につき-1勝利点。',
    textEn:'When scoring, -1 VP per card you have after the first 15.' },
  { id:'wolf_den', nameJa:'狼の巣', nameEn:'Wolf Den', kind:'landmark', expansion:'empires', cost:0, debt:0,
    textJa:'得点計算時、ちょうど1枚だけ持っているカード1種類につき-3勝利点。',
    textEn:'When scoring, -3 VP per card you have exactly one copy of.' },
];
```

---

## 3. 必要なエンジン機構の分類（最重要）

### 3-0. 全53枚に先立つ「横型ランドスケープ共通基盤」（新規・ここが本体）

縦カードと違い、イベント／ランドマークは**サプライ山ではない**。以下の共通基盤を最初に作る（＝これが実装コストの大半で、個々の札は基盤の上では安い）。

1. **ランドスケープ状態スロット**：`state.events = [id...]`／`state.landmarks = [id...]`（対局で採用した横型のid。王国と同様にゲーム開始時に決定。公開情報＝`maskStateFor` はそのまま残す）。
2. **イベント購入ディスパッチャ（新 action `BUY_EVENT`）**：`BUY`(engine.js:5052) と別入口。コイン（＋負債）を払い**購入権を1消費**し、**カードは獲得しない**。同一ターンに**同じイベントを複数回買える**（Delve/Bonfire/Trade など・上限はコイン/購入権のみ）。`PLAYER_ACTIONS` に追加必須。負債コストのイベントは `p.debt += debt`。**負債>0のときイベントを買えるか＝要判断（§6）**。
3. **ランドマークVP採点パス**：`vpOf`(engine.js:4164) と CPU の `vpOfPlayer` に「ランドマーク加点」ステップを追加。得点が**負になり得る**（Bandit Fort/Wall/Wolf Den）ので下限クランプ禁止。**Keep はプレイヤー横断**＝`vpOf(p)`の単体シグネチャで扱えず、全員のデッキを同時に見る**グローバル採点ステップ**が要る。
4. **ランドマークの有限VPリザーブ（新 `state.landmarkVP = {arena:n, ...}`）**：`createInitialState` で `6×人数` 等を供給VPから積む。払い出しは `reserve → p.vpTokens`、空になったら停止。**`state.pileVP`（集合）とは別物**（下記 3-6 の比較参照）。
5. **横型カード描画パイプライン**（`build-cards.js`/`carddata.js`/`ui.js`・§5）。**初版はwebpを作らずテキストパネル描画で代替可**（画像化を後回しにできる＝最小出荷を早める）。

### 3-1. 購入するだけの一過性イベント（既存の獲得/廃棄 pending を再利用）

`BUY_EVENT` の解決時に効果を適用。多くは既存の `*_GAIN`（workshop/remodel型）・`trashCard`(594)・並べ替えpendingを流用。

| id | 効果の骨子 | 流用先 |
|---|---|---|
| delve | ＋購入1・銀貨1枚 | pending不要 |
| alms | 場に財宝が無ければ$4以下1枚獲得 | 工房型 `*_GAIN`＋`p.inPlay` に財宝が無いか走査 |
| banquet | 銅貨2＋$5以下の勝利点でない1枚 | `gain`×2＋型フィルタ付き `*_GAIN`（`costIsPlainCoin`で$5判定） |
| advance | 手札アクション廃棄→$6以下アクション獲得 | remodel型（trash→gain・任意なので空手札で無害終端） |
| ball | -$1トークン＋$4以下×2 | `p.minusCoin`＋`applyCoinPenalty`＋`*_GAIN`×2 |
| raid | 場の銀貨数だけ銀貨＋他全員に-1カードトークン | `gain`ループ＋`p.minusCard`（アタックではない＝堀無効） |
| trade | 手札2枚まで廃棄→廃棄数だけ銀貨 | 礼拝堂型廃棄（上限2）＋`gain`ループ |
| bonfire | 場（inPlay）の銅貨2枚まで廃棄 | 対象ゾーン=inPlay の廃棄chooser＋`trashCard` |
| quest | アタック1/呪い2/任意6枚を捨て→金貨 | 3択の捨てpending＋`gain('gold')` |
| scouting_party | ＋購入1・山札上5枚→3捨て・残り並べ替え | 地図職人/衛兵型の top-N reveal/reorder |
| salt_the_earth | +1VP＋サプライの勝利点カード1枚を廃棄 | Lurker型「サプライから廃棄」＋勝利点山フィルタ（山が減る＝3山終了に影響） |
| pilgrimage | 旅トークン裏返し→表なら場の異名3枚までコピー獲得 | `p.journeyDown` flip-then-check(4001)＋複数選択gain |

いずれも**新pendingは4点セット**（engine reducer＋`PLAYER_ACTIONS`＋CPU `decidePending`＋UI `viewPendingModal`）＋終端保証（候補ゼロなら獲得せず解決＝CPU無限ループ回避、§ギルド taxman の轍）。

### 3-2. VP／負債がからむ一過性イベント（`p.vpTokens`／`p.debt`／新「今ターン獲得数」カウンタ）

- **Conquest／Triumph**：**新カウンタが必要**＝`freshTurn`(335) に「今ターン獲得カード数」（Triumph）と「今ターン獲得した銀貨数」（Conquest・直前の2枚を含む）を追加し、`gain`(536)/`triggerOnGain`(4355) でインクリメント。既存 `actionsGainedThisTurn`(4454) と同型。Triumph はさらに **負債5**。
- **Dominate**：属州獲得成功時のみ +9VP（空山なら加点なし＝`gain` の成否でゲート）。
- **Ritual**：呪い獲得→手札1枚廃棄→`cardCost` の$1ごと+VP（コスト軽減反映）。
- **Wedding**：+1VP＋金貨。**$4＋負債3の複合コスト**＝`BUY_EVENT` がコインと負債を同時に課す。
- **Annex**：捨て札から5枚残し他を `reshuffleDeck`(279) で山札へ→公領獲得。**負債8**。捨て札は私的なので pending は本人視点のみ意味あり。

### 3-3. ターンをまたぐ持続イベント（`DURATION_RESOLVERS`／`startQueue`／cleanup／追加ターン）

- **Expedition**：`cleanupAndAdvance`(4693) の次手札ドロー数に**加算**（通常5→7…累積）。Outpost(3401) が「上書き」なのに対し**加算**。
- **Save**：手札1枚退避→**次手札を引いた後**に手札へ戻す（cleanup の特殊順序）。退避のマスクは `church_setaside` と同型だが、戻すタイミングが「先引きの後」で通常の持続開始時効果と異なる。
- **Travelling Fair**：ターン限定フラグ `t.travellingFair` を立て、`gain()` 経路をフックして獲得ごとに山札上置きを任意提示（Watchtower/Royal Seal の on-gain 山札上と同型・ただし「場のカード」でなくターンフラグ）。トラベラー交換は獲得ではないので発動しない。
- **Mission**：追加ターン（Outpost/Possession の追加ターン機構を流用）＋`state.turn` に「カード購入禁止（イベントは可）」フラグ＋**3連続ターン禁止**の連続手番トラッキング。アタックではない。
- **Donate**：**負債8**。次ターン開始時（他の開始時効果より前）にデッキ＋捨て札を全部手札へ→任意枚数廃棄→残りをシャッフルして5枚引く（**通常のドローを置換**）。`DURATION_RESOLVERS`(4274)/`resolveDurationStartEffects`→`startQueue` に予約し、開始時の最初に実行。**タイミングが繊細＝エラッタの主因**。

### 3-4. サプライ山トークン移動イベント（`p.pileTokens` 系）── 既存教師トークンと同型か？

**結論：+1系4枚（Lost Arts/Training/Pathfinding/Seaway）は既存 `p.pileTokens` にドロップイン。Ferry と Plan は別トークン型＋別フック点が必要。**

既存 `p.pileTokens`(engine.js:400) は `{card|action|buy|coin: 山id}`（各種別1つ・公開）。教師（Teacher）が `TAVERN_START_CALL`→`validTeacherPiles`(1195) で置き、`applyPileTokens`(1180) が **`PLAY_ACTION` 冒頭でその山のカードをプレイした時に +1X**（効果解決より前）を与える。

- **Lost Arts=`action`／Training=`coin`／Pathfinding=`card`／Seaway=`buy`** ＝ **まさにこの4トークンそのもの**。違いは「置く契機が教師のカードプレイ→イベント購入」だけ。→ **新pending（山選択）を作り `validTeacherPiles` を再利用**して `p.pileTokens[type]=pile` を設定すれば、`applyPileTokens` がそのまま効く。Seaway だけは**先に$4以下アクションを1枚獲得→その山に`buy`トークン**の順（gain＋トークン設定）。
  - 検証点：`applyPileTokens` が `buy` 種別も加算するか実装確認（コメントでは4種対応・要目視）。
- **Ferry（-$2コスト）**＝**新トークン型 `cost`**。`applyPileTokens`（プレイ時+X）ではなく **`cardCost`(BUY:5058) にフック**して、能動プレイヤーがその山のカードを評価する時だけ$2引く（$0下限・`costIsPlainCoin`のみ・**ターンをまたいで永続**・自ターン限定）。`t.costReduction`（橋/街道）に似るが**山スコープ＆永続**。
- **Plan（廃棄トークン）**＝**新トークン型 `trash`**。**その山からの獲得時**（**購入→獲得のエラッタ**）に「手札1枚を任意廃棄」pendingを開く on-gain フック。`applyPileTokens` とは別のフック点。

### 3-5. プレイヤーの持続状態（Inheritance）── 最重量イベント

屋敷トークン＋脇置きゾーン＋「屋敷をアクション（命令）としてプレイ可能にする」。必要要素：(1) 1ゲーム1回フラグ、(2) `$4以下・非命令`フィルタ（`overlordTargets`/`captainTargets`/`bandOfMisfitsTargets`(2226-2249) と同じ述語スタイル＋`costIsPlainCoin`）、(3) 屋敷トークンを載せたサプライ札＋脇置きゾーン（`allCards`/invariants の得点計算に数える＝`p.tavern` 同様）、(4) 自ターン中に屋敷をアクションとして解決＝**命令プレイ「そのまま置いたまま」**（`OVERLORD_PLAY`/`applyEffect` の命令経路を流用）。→ **E8（命令の「自身が動く」clause）に依存**（PROGRESS §0-16）。`PLAY_ACTION`・獲得フィルタ・マスク・得点まで横断。

### 3-6. 山上VP／リザーブVP系ランドマーク（`state.pileVP` vs 新 `state.landmarkVP`）── 集合と同型か？

**3系統に分かれる。**

- **(a) 集合（Gathering）ファミリー ＝ 既存 `state.pileVP` を再利用**：**Aqueduct／Defiled Shrine**。準備でサプライ山にVPを積む（`state.pileVP` に seed）→ アクション/財宝の獲得で**山のVPをランドマークの蓄積カウンタへ1個移動**→ 別トリガー（勝利点/呪い獲得）で蓄積を `p.vpTokens` へ放出。
- **(b) 有限リザーブ ＝ 新 `state.landmarkVP`（6×人数）**：**Arena／Basilica／Baths／Battlefield／Colonnade／Labyrinth**。**ランドマーク上**に置いた有限プールから2ずつ払い出し、空で停止。
- **(c) リザーブ無しの純トリガー→`p.vpTokens`**：**Tomb**（廃棄のたび+1・`trashCard`(594) をフック＝**相手ターンの詐欺師での廃棄や、自分の物でない廃棄（塩まき）でも発動**するので per-card 分岐でなく `trashCard` 本体に置く）／**Mountain Pass**（競り勝者+8）。

**`state.pileVP`（集合）との違い（依頼の問い）**：
- `state.pileVP`(476) は**サプライ山の上**に載るVPで、`pileId` キー、**プレイ中に集合カード（神殿等）が積み上げる**、実質無制限、トリガーした者が取る。
- ランドマークの**リザーブ**（Arena等）は、**山ではなくランドマーク上**に載る**有限プール**で、**準備時に供給VPから `6×人数` 積む**（＝依頼注記「VPトークンを供給から取る」）。空になったら払い出し停止。**`pileId` に紐付かない**ので `state.pileVP` では表せず、**新スカラーマップ `state.landmarkVP` が必要**。
- Aqueduct/Defiled Shrine は**両方使うハイブリッド**：山に積む部分は `state.pileVP` を再利用し、ランドマークの一時蓄積は小さな別カウンタを足す。

トリガーの流用：`triggerOnGain`(4355)（購入フェイズゲート `state.turn.phase==='buy'`／勝利点型／アクション型／場に同名／2枚目の獲得／コイン≥2 の各条件）・`triggerOnTrash`(4590)（Tomb）・`END_ACTION_PHASE→buy`(5102)（Arena の購入フェイズ開始・任意廃棄pending＝4点セット必須）・`END_TURN`(5111)（Baths＝今ターン獲得ゼロ判定に新カウンタ）。

### 3-7. 終了時得点のみのランドマーク（`vpOf`/`vpOfPlayer` 拡張だけ）

**盤面に一切触れない・受動**。CPUは `vpOfPlayer` が見えれば良い（`decidePending`/`viewPendingModal` 変更不要）。

- **単純な自デッキ集計**：Museum（異名×2）／Fountain（銅貨≥10で15）／Palace（銅銀金の組×3）／Bandit Fort（銀金×-2）／Wall（15超×-1）／Wolf Den（1枚だけの札×-3）／Orchard（3枚以上の異名アクション×4）／Triumphal Arch（2番目に多いアクション×3）。品評会(fairgrounds)の可変VP計算が良い雛形。
- **Keep**：**プレイヤー横断**（各財宝を最多所持なら5・同数は全員）→ グローバル採点ステップ。
- **Tower**：**最終サプライの空山を読む**＋「カード→由来山」のメンバーシップ写像（分割山は両名・混合山 knights/castles/ruins は length で判定）＋勝利点でない札のみ。
- **Obelisk**：準備で無作為アクション山を選び `state.obeliskPile` に保存（`pickBane`(419) と同型）＋Tower と同じ由来山写像。

### 3-8. セットアップで何かする（`createInitialState`）

`pickBane`(419) パターンを流用。該当が対局に採用されている時だけ実行。

| id | 準備処理 |
|---|---|
| aqueduct | 銀貨・金貨の山に `state.pileVP` で8ずつ（＝各8個・§6注記） |
| defiled_shrine | 集合を持たない各アクション山に `state.pileVP` で2ずつ |
| obelisk | 無作為アクション山を選び `state.obeliskPile` に保存 |
| tax | **全サプライ山に負債1**（新 `state.pileDebt`・下記3-9）＋自身は山選択で+2 |
| arena/basilica/baths/battlefield/colonnade/labyrinth | `state.landmarkVP[id] = 6×人数` |
| mountain_pass | 「最初の属州獲得」一回きりフラグ `state.mountainPassTriggered=false` |

依頼の「Baths?」＝**セットアップ有り**（リザーブ6×人数を積む）。

### 3-9. 常時のコスト／ルール変更

- **Ferry**：自ターン中、指定山のカードが$2安い（`cardCost` フック・永続・山スコープ）。**唯一の恒常コスト変更**。
- **Inheritance**：自ターン中、屋敷が指定アクションの能力・命令型を持つ（恒常の型/能力変更・§3-5）。
- **Tax（`state.pileDebt`）**：`state.pileVP` と同型の新マップ（公開・非カード・保存則tally対象外・`maskStateFor` で clone 残す）。購入フェイズの獲得で `gain()`/`triggerOnGain` を `turn.phase==='buy'` でゲートし、その山の負債を全部 `p.debt` へ移す（→ `⭐`同様の負債バッジをUIに）。厳密には「山の状態」で、恒常ルール変更ではない。
- **依頼の暫定分類を訂正**：**Salt the Earth はサプライ廃棄の一過性**、**Wall／Bandit Fort は得点フックのみ**＝恒常ルール変更ではない。

---

## 4. 実装が重い順ランキングと「最小で意味のある出荷単位」

### 4-1. 重量ランキング（重い→軽い・ティア方式）

- **T1（最重量・単独で大工事）**：`inheritance`（屋敷=命令・E8依存）／`mountain_pass`（新規の逐次競りpending＋CPU入札＋UI入札モーダル＋手番間タイミング）／`tax`（新 `state.pileDebt`＋全山準備＋購入獲得フック＋UIバッジ）／`aqueduct`・`defiled_shrine`（pileVP＋蓄積＋準備seed＋2フック）／`donate`（次ターン開始の全掃討・ドロー置換の繊細タイミング）／`mission`（追加ターン＋購入禁止＋3連続禁止）。
- **T2（新機構だが定型）**：`keep`（横断採点）／`tower`・`obelisk`（由来山写像＋空山読み/準備選択）／リザーブ系ランドマーク `arena`・`basilica`・`baths`・`battlefield`・`colonnade`・`labyrinth`（`state.landmarkVP`＋各トリガー・Arenaは購入フェイズ開始の廃棄pending）／`save`（先引き後の返却の特殊順序）／`ferry`・`plan`（新トークン型＋新フック点）。
- **T3（既存パターンの組合せ）**：`ritual`・`advance`・`banquet`・`ball`・`quest`・`scouting_party`・`pilgrimage`（新pending・4点セットだが定型）／`conquest`・`triumph`（今ターン獲得カウンタ新設）／`annex`（捨て札選択＋reshuffle）。
- **T4（軽い・トリガー/トークンの薄い実装）**：`tomb`・`battlefield`型 on-gain・`labyrinth`（薄いトリガー）／`seaway`・`lost_arts`・`training`・`pathfinding`（`p.pileTokens` ドロップイン）／`travelling_fair`・`raid`・`bonfire`・`borrow`・`alms`・`trade`・`salt_the_earth`・`wedding`・`dominate`・`expedition`・`delve`（一過性・pending最小）。
- **T5（最軽量・`vpOf` に数式1本）**：`museum`・`fountain`・`palace`・`bandit_fort`・`wall`・`wolf_den`・`orchard`・`triumphal_arch`。

### 4-2. 最小で意味のある出荷単位の提案

**第1弾＝「得点専用ランドマークだけ」（T5の8枚＋可能なら Keep/Tower/Obelisk）を推奨。**

理由：
- **ターンループ・購入経路・pending・CPU decidePending・UI modal をいっさい触らない**。必要なのは §3-0 の (1)状態スロット (3)採点パス と、§5 の描画（初版はテキストパネルで可）だけ。**イベント購入ディスパッチャすら不要**（ランドマークは買わない）。
- ランドマークは**受動的な得点修正**なので、CPUは `vpOfPlayer` が見えれば戦えて、無限ループや詰みのリスクが構造的に無い（4点セットの「CPU/UI分岐」義務が発生しない）。
- 盤面の遊びを一気に変える（デッキ構築の目標が変わる）＝**投資対効果が最大**。

**第2弾＝「トリガー/リザーブ系ランドマーク」**（Tomb/Battlefield/Labyrinth/Arena/Basilica/Baths/Colonnade/Aqueduct/Defiled Shrine）。`state.landmarkVP` と `triggerOnGain/Trash`・`END_TURN`・`END_ACTION_PHASE` フックを足すが、**まだイベント購入経路は不要**（Arena の任意廃棄pendingだけ4点セット）。

**第3弾＝「冒険イベント（購入ディスパッチャ導入）」**。ここで初めて `BUY_EVENT`＋CPUのイベント購入評価＋UIのイベント購入ボタンが要る。まず軽い一過性（Delve/Expedition/Travelling Fair/Alms/Raid/Trade/Bonfire/Borrow/Ball/Quest/Scouting Party/Advance/Banquet/Ritual/Salt the Earth/Wedding/Dominate/Conquest/Triumph）→ トークン移動（Lost Arts/Training/Pathfinding/Seaway/Ferry/Plan）。

**第4弾＝重量イベント**（Save/Mission/Donate/Annex/Tax）。**最後に Inheritance と Mountain Pass**（E8・競りUIが要る）。

補足：もし「冒険/帝国の縦カードは既にプレイ可能」な現状に合わせるなら、**帝国ランドマークだけを既存 `empires` セットにオプションで付ける showcase** が最も自然（縦カードの帝国と主題が揃う）。

---

## 5. 横型カード画像に必要な情報

横長（縦枠768×1152に対し、例えば1152×768の横向き）。`build-cards.js` に**横型フレーム**、`carddata.js` に**横型 frameType**（イベント／ランドマークの2スキン）を新設。載せる要素：

| 要素 | イベント | ランドマーク |
|---|---|---|
| 名前 | ○ | ○ |
| 種別ラベル | 「イベント」 | 「ランドマーク」 |
| コスト欄 | ○（コイン＋負債） | **不要**（ランドマークにコストは無い） |
| 効果テキスト | ○ | ○（`準備：`行は別行） |

**負債コストの表示が要るイベント（オレンジ六角トークン）**：
- `annex`（$0＋負債8・負債のみ）
- `donate`（$0＋負債8・負債のみ）
- `triumph`（$0＋負債5・負債のみ）
- `wedding`（**$4＋負債3・コインと負債の併記**）

→ 帝国縦カードの負債描画（`build-cards.js` のオレンジ六角）を流用。負債のみ札はコイン位置に大トークン、`wedding` はコイン＋負債の併記。`dominate`（$14）は大きいコイン、`tax`/`delve` 等は通常コイン。ランドマークはコスト欄自体を描かない。

**初版は画像を作らずテキストパネルで代替可**（名前＋種別＋効果を盤面の横型パネルに描画）＝`verify:e2e` の webp404検査に引っかからず、最小出荷を早められる。webp化は後追いで良い（このPCでしか再生成できない制約もあるため）。

---

## 6. 未確定・要判断の点

1. **Windfall（帝国イベント第13）がデータに無い**：本データの帝国 `trade` は誤ラベル（実体は冒険 Trade）。**Windfall は別途一次調査が必要**。参考（未検証・仮）＝$5「山札と捨て札が両方空なら金貨3枚を獲得（If your deck and discard pile are empty, gain 3 Golds.）」。実装前に検証WFで裏取りすること。
2. **ランドマークは20ではなく21種**（依頼の「20」は誤り）。帝国の横型は「イベント13＋ランドマーク21＝34」、冒険イベント20と合わせ**完全セットは54**。本データは Windfall 欠落で53。
3. **和名の修正2件（要最終確認）**：
   - **basilica＝「公会堂」**（初期データ「バシリカ」は読み仮名）。検証は演繹的推定（21ランドマークの1対1対応＋tanuhackの用例）で確度は高いが、**ホビージャパン公式表記を最終確認推奨**。
   - **keep＝「砦」**（初期データ「天守」は誤り）。専用wikiページ由来で確度高。Bandit Fort=「山賊の砦」と紛らわしい点に注意（別カード）。
4. **エラッタで現行文面が変わった札＝旧文を使わないこと**（本書は全て現行を採用済み）：`borrow`（「1ターン1回」が-1カードトークン節のみに掛かる／＋購入は無条件）／`bonfire`（**銅貨限定**）／`plan`（**購入→獲得**）／`donate`（**次ターン開始時**に解決）／`tax`・`basilica`・`colonnade`・`defiled_shrine`（**購入時→購入フェイズの獲得時**）／`inheritance`（**命令型**・対象は非命令）／`mission`（**3連続不可**の現行文）。
5. **Aqueduct の準備文**：「Put 8 VP on the Silver and Gold piles」＝**銀貨に8・金貨に8（各8個）**。「each of」は物理カードには印字されていないが意味は各8。実装は各8で確定。
6. **負債中にイベントを買えるか＝要確認（実装分岐に直結）**：一次調査の mechanics 注は「カード購入のみブロック＝イベントは買える」と仮定しているが、公式の負債ルールは**「負債トークンがある間はカードもイベントも購入不可」**の可能性が高い（現行 `BUY` は `p.debt>0` で拒否・engine.js:5055）。→ `BUY_EVENT` にも `p.debt>0` 拒否を入れる方針を推すが、**公式裁定を確認**すること。
7. **Mission の「カード購入不可」**：追加ターンで**カードは買えないがイベントは買える／非購入の獲得・交換は可**。この非対称を `state.turn` フラグで正しく表現する。
8. **Keep のプレイヤー横断採点**：`vpOf(p)` の単体シグネチャを破る＝**全員のデッキを見るグローバル採点ステップ**をアーキテクチャに足す必要（Museum等の単体採点と混在させる設計を決める）。
9. **Tomb の廃棄フック網羅**：相手ターンの詐欺師での自札廃棄、Salt the Earth のサプライ廃棄（自分の物でない）でも+1VP。→ per-card 分岐でなく **`trashCard`(594) 本体**に置き、**廃棄する主体（そのターンのアクティブ or 廃棄を行うプレイヤー）** の定義を裁定する（オフターン廃棄の帰属）。
10. **1対局に採用する横型枚数**：公式は「最大2枚のランドスケープ」等の運用。本アプリで**何枚出すか（0〜2？固定？ランダム？）は設計判断**。`DOM.CARD_SETS` にどう紐付けるか（例：`empires` セットにランドマーク2枚を付随）も決める。
11. **Inheritance は E8（命令の自身移動clause）依存**：E8未実装のまま入れると屋敷=命令の再演/自己移動で不整合。**E8完了後に着手**。
12. **Mountain Pass の競りは完全新規インタラクション**：逐次昇順入札の pending（席順＝獲得者の左隣→獲得者で終端）、CPUの入札価値評価（8VP vs 負債）、UIの入札額モーダル（上限40・現在最高額超）。**手番間（cleanup後・次手番前）**に走るため、支配(Possession)が絡まないタイミングも要考慮。
13. **`p.pileTokens` の `buy` 種別が `applyPileTokens` で加算されるか目視確認**（Seaway）。コメント上は4種対応だが実コード確認を推奨（engine.js:1180-1194）。

---

（本書のカード定義§2はそのまま `js/cards.js` へ追記可能。実装着手時は §3-0 の共通基盤→§4-2 第1弾＝得点専用ランドマークの順を推奨。関連ファイル：`C:\Users\b1242\claude\game\dominion\js\engine.js` / `js\cards.js` / `js\cpu.js` / `js\ui.js` / `tools\build-cards.js` / `js\carddata.js`）