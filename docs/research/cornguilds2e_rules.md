# 収穫祭＆ギルド 第2版＝未実装14種の公式ルール（段階0の正本）

**対象＝PROGRESS §0-40 の監査で確定した未実装33種のうち、収穫祭＆ギルド第2版（2023年合本・日本語版未発売）の14種。**
段階1（カタログ＋絵＋webp）は 2026-08-23 に完了済み（`cornguilds2e` 8種＋`rewards` 6種＝`DOM.STAGE1_POOLS` で塞いである）。

| 章 | 群 | カード |
|---|---|---|
| 1 | 王国A（＋総論ページ） | 装蹄師(Farrier)／店(Shop)／診療所(Infirmary)／耕作者(Farmhands) ＋ Setup／Rewards／過払いの一般ルール |
| 2 | 王国B | 謝肉祭(Carnival)／**渡し守(Ferryman)＝最重量**／野盗(Footpad)／一騎討ち(Joust) |
| 3 | 褒賞6種 | 小冠(Coronet)／駿馬(Courser)／御料地(Demesne)／ハスカール(Housecarl)／大きなかぶ(Huge Turnip)／名声(Renown) |

一次資料＝英語wiki（`node tools/wikidirect.js`・Versions 表は生HTMLで colspan を確認）＋
**RGG 公式 第2版ルールブック PDF**（wiki の Versions 表「March 2024 / PDF」・`pdftotext -layout`＝「2024RB」）。
14種とも Versions 表は `Second edition / March 2024`（colspan=2＝印刷済み）の1行＝**エラッタ0件**。

⚠ **この正本は「収集」のみ＝「敵対検証」は未実施**（検証3体がセッション上限で落ちた）。
**実装に入る前に、19種の正本（`missing19_rules.md`）と同じ型で別エージェントに一次資料へ当たり直させること。**
とくに検証で覆りやすいのは（19種で実際に覆った形）＝Versions 表の読み違え／`canReturnToPile` 系の述語の
意味取り違え／「獲得時対話を潰す」順序の見落とし。

---

## 🛑 実装前に必読（3群に共通する罠）

1. 🛑 **既存バグ（先に直す）＝`maybeStartOverpay` が `state.pending` を無条件に上書きする**。
   望楼を手札に持って名品を買い残コインがあると、`gain()` 内で立った `watchtower` の窓が `overpay` に潰され、
   `OVERPAY_RESOLVE` 後も復活しない（mix-all で到達・起草が node 再現済み）。交易商人(`trader_react`) も同型。
   公式（2022エラッタ）＝`"overpay" abilities happen when the card is gained, and **are timed with other such abilities**`。
   ⇒ **Farrier／Infirmary を `OVERPAY_CARDS` に足す前に**、pending が立っているときは `onGainQueue` に積んで
   後から `overpay` を開く形へ直す。
2. **過払いは `BUY`／`BLACK_MARKET_BUY` の2経路だけ**（工房／豊穣の角／Ferryman 経由の獲得では起きない＝公式
   `This doesn't happen if you gain ... without paying for it`）。額＝**軽減後コストを超えた残コイン**
   （既存 `overpay` pending の `max: t.coins`）＝公式例「名声2枚で $0 の装蹄師に $5 払えば +5」と一致。
   ポーション・負債は数えない。
3. **「ターンの終了時 +N カード」（Farrier）＝`cleanupAndAdvance` の**先引きの後**＝`t.squirrelDraw` と同じ位置**
   （リスの習性の公式FAQ＝`after drawing your hand in Clean-up`）。
4. **「これを N 回使用する」（Infirmary）＝場に出す通常のプレイ**＝捨て札から `playCardNoAction(..., p.discard, ...)`
   （継続 `continue_play2` と同型）。2回目以降は1回目の廃棄 pending が解決してから。**習性(Way) を毎回選べる**
   （公式 clarification＝羊の習性で4回→+$8）＝習性のあるゲームでは1回ごとに窓を開く再開網。
5. **「獲得時に脇に置いて次ターン開始時に使う」（Farmhands）＝`p.eventSetAside`＋`event_play` をそのまま使う**
   （強制・アクション権不要・**表向き＝公開**・財宝も可）。獲得時窓は `onGainQueue`・**手札限定（山札の影札は出さない）**。
6. **Shop＝`conclaveTargets` を流用し、`conclave_bonus` だけ積まない**（+1アクションが無い）。
7. 🛑 **褒賞(Rewards) の山は「2人＝各1枚／3人以上＝各2枚（計12枚）」**＝賞品(Prizes) の「各1枚」をコピーしない。
   `initSupply` に `supply[id] = numPlayers >= 3 ? 2 : 1`。**段階1で書いた「各1枚」のコメントは誤り**（この正本で訂正）。
   `NON_SUPPLY` 登録済みなので 3山終了／購入／闇市場／汎用獲得の4系統から自動で除外される。
   **廃棄した褒賞は山に戻らない**（公式）／**大使(Ambassador) の「サプライに戻す」は褒賞を対象外に**（`!NON_SUPPLY.has`）。
   ⚠ UI の `nonSupplyIds`（盤面の非サプライ山表示）に `DOM.POOLS.rewards` を足さないと山が画面に出ない。
8. 🛑 **Ferryman の山＝サプライ外の「山」＝本アプリに前例の無い機構**＝専用フィールド `state.ferrymanPile = { card, cards }`。
   - `supply` に載せない（載せると4系統がサプライと誤認）／`state[山キー]`（混合山モデル）にも置かない
     （`mixedPileWithTop` が拾って待ち伏せ/塩まき/追放の候補に漏れる）。前例＝`state.loot`。
   - **カードとして数える**（保存則 tally に足す）／**`allCards` には入れない**（誰も所有していない）／**公開**。
   - 選び方＝`pickBane` と同型の自動抽選。**ちょうど $3 か $4（3成分）**・`unused`＝王国10山・Bane・川船の脇札・
     ハツカネズミの脇札・闇市場デッキと重複しない。**分割山は randomizer のコストで判定**（城$3・卜占官/衝突/城砦/
     叙事詩/魔法使い$3・投石機$3・剣闘士$3・サウナ$4 は候補／$2 の4山と騎士$5 は落ちる）。
     🛑 `costExact` は `gainableBase` を含むので候補ゼロになる＝静的コストで判定（川船と同じ罠）。
   - 枚数＝その山をサプライに置く場合と同じ（通常10／勝利点8 or 12／ネズミ20／城 8 or 12／同盟分割山16／2段 5+5）。
   - **その札が要求する準備も走らせる**＝川船が見ている7系統（馬・祝福・呪詛・アーティファクト・戦利品・Ally・前兆）
     ＋`initSupply` が `kingdom.includes` で見る系統（賞品・廃墟・狂人・傭兵・精霊・家宝・ゾンビ・災いカード・闇市場・来寇）。
     **特性(Trait) の付け先には含めない**（サプライの山ではない）。
   - 獲得＝Ferryman の on-gain（**購入／工房／廃棄置き場／闇市場のどの経路でも**）＝`triggerOnGain` の
     `cardId === 'ferryman'` で1箇所。`pileEmpted` は呼ばない（調査 Search は誘発しない）／`_gainOutside` は立てない
     （戻せる山がある＝交易商人で置換されたら山へ戻す＝`canReturnToPile` に分岐を1つ足す）。
   - 「名指しで自分の山から取る」効果（ネズミ `gain a Rats`／取り替え子の交換／カササギ）は渡し守の山にフォールバック。
     古地図/薬草集め/天幕/生徒の「自分の山を循環」は `rotatePile` に分岐／戦闘計画は対象外（公式＝サプライ限定）。
   - `createInitialState` の順序＝kingdom 確定直後・`pickBane` より前。以後の Bane／川船／ハツカネズミ／来寇／
     闇市場 universe／神風の新10山は**ferryman の山キー（分割山なら中身も）を除外**。
9. **Footpad の「このゲームでは、アクションフェイズにカードを獲得したとき +1カード」＝王国にあるだけで全員に効く常設ルール**
   （シャーマン／官僚制と同型）。誰の獲得でも・そのプレイヤーが引く。購入フェイズの獲得は対象外。
10. **Joust の脇の属州＝カード**（保存則に数える・公開）。褒賞が尽きていても属州は脇に置ける（公式＝何も起きない）。
    クリーンアップで捨て札（本アプリは先引きの**前**＝城壁のある村/宝物庫と同じ位置）。
11. **Coronet＝冠(crown)と同型だが「褒賞でない」制限つき**。自身は財宝でもある＝購入フェイズに財宝として出せる。
12. **Huge Turnip＝「+2財源」を先に受け取ってから「持っている財源」を数える**（記載順）。
13. **Demesne の VP＝所持する金貨（`allCards`）**＝`vpOf` と CPU `vpOfPlayer` の両方に書く。
14. **新しい pending は4点セット**（engine reducer＋`PLAYER_ACTIONS`＋CPU `decidePending`＋UI `viewPendingModal`）。
    `test/integrity.test.js` の「全 pending に CPU/UI の分岐があるか」が足し忘れを検出する。
15. **CPU の `chooseAction` に14種を登録する**（足さないと一度も使わず、ソークが経路を検証しない）。


---

# 【章】王国A

# 収穫祭＆ギルド 第2版 — 公式ルール確定（Farrier／Shop／Infirmary／Farmhands ＋ 総論ページ）

一次資料＝英語wiki ライブページ（`tools/wikidirect.js`・2026-08-23 取得・Versions 表は生HTMLで colspan を確認）＋
**RGG 公式 第2版ルールブック PDF**（wiki の Versions 表「March 2024 / PDF」＝`/images/5/5f/Cornucopia_%26_GuildsRulebook2023.pdf`・
組版日付 2023-11-13・`pdftotext -layout` で全文抽出。以下「2024RB」）。
⚠ 4枚とも **Versions 表は1行（`Second edition` / `March 2024`＝Announced+Printed が colspan=2 で統合＝印刷済み）**＝**エラッタ0件**。
日本語版は未発売（`The official print in English is the only available for either physical edition of this set.`）。

---

## 1. Farrier（装蹄師・$2+・Action）

### 1-1. 英語カード文（現行逐語・区切り線＝**1本**＝`+1 Buy` の直下）
> +1 Card
> +1 Action
> +1 Buy
> ―――――（`<hr>`）
> **Overpay:** +1 Card at the end of this turn per [$1] overpaid.

### 1-2. 版
> Second edition — March 2024（1行のみ・Never printed 無し）＝エラッタなし。

### 1-3. Official FAQ（全文逐語）
> When you gain a Farrier you overpaid for, you draw an extra card at end of turn per [$1] you overpaid.
> For example you could pay [$4] for Farrier, and draw 2 extra cards at end of turn.
> This doesn't happen if you gain a Farrier without paying for it (such as with Horn of Plenty).

（Other rules clarifications の節は無い。2024RB の Farrier 項も同文。）

**「ターンの終了時」の位置の裏取り**＝同じ語法の「+2 Cards at the end of this turn」を持つ リスの習性（Way of the Squirrel）の Official FAQ 逐語：
> Normally you get the two cards after drawing your hand in Clean-up.
> If you use this when it is not your turn (such as via Black Cat), you still draw two cards at the end of the turn.

### 1-4. ⚠ 実装で危ないところ
- **`OVERPAY_CARDS`（engine.js:558）に `'farrier'` を足す**＝`maybeStartOverpay` → `overpay` pending → `OVERPAY_RESOLVE` → `applyOverpayEffect` に `farrier` 分岐。過払いの経路は BUY と BLACK_MARKET_BUY の2箇所だけ（＝「購入したときだけ」の公式と一致。Horn of Plenty／工房での獲得では起きない＝**触らなくてよい**）。
- **「ターンの終了時 +N カード」＝本アプリでは `cleanupAndAdvance` の「次の手札の先引き」の**後**（engine.js:11855 の `t.squirrelDraw` とまったく同じ位置＝公式「after drawing your hand in Clean-up」）。`t.farrierDraw`（または `squirrelDraw` と同じ器を共用）を `freshTurn` に追加し、`draw(state, pi, n)` で引く。
  - この位置なら **-1カードトークンは先引きで消費され、Farrier のぶんは満額**（実物でも5枚の先引きが先）／**旗(Flag)の +1 は先引きにしか乗らない**＝自動で正しい。
  - 前哨地の追加ターン（3枚）でも「3枚＋N」。旅行(Journey)で場を捨てないターンでも先引きはするので引く。
- **過払い額＝軽減後のコストを超えて払った額**＝既存 `overpay` pending の `max: t.coins`（コスト支払い後の残り）がそのまま公式例（Renown 2枚で $0 の Farrier に $5 払えば +5）に一致する。**ポーション・負債は数えない**（公式＝負債は過払い不可／ポーションは Stonemason 以外で無意味）＝既存どおりコインだけ。
- 🛑 **既存バグ（mix-all で到達・node 再現済み）＝`maybeStartOverpay` が `state.pending` を無条件に上書きする。** 望楼を手札に持って名品を買い残コインがあると、`gain()` 内で立った `watchtower` pending が `overpay` pending に潰され、`OVERPAY_RESOLVE` 後も復活しない（残コイン0なら望楼の窓が開く）。実測＝`after BUY: pending={"type":"overpay",...}` / `exact coins: pending={"type":"watchtower",...}`。交易商人(`trader_react`)も同型。**Farrier／Infirmary を足す前に「`state.pending` が既に立っていれば `onGainQueue` に `{type:'overpay_ask', player, card, max}` を積み、消化時に `overpay` pending を開く」形に直すこと**（公式＝`"overpay" abilities happen when the card is gained, and are timed with other such abilities`）。
- UI＝`js/ui.js:3946` の `info` 表に farrier の説明を足す（ボタンは `modalAmount` の既存）。CPU＝`cpu.js:3125` の `case 'overpay'` に farrier の方針（例＝残コインで良い買い物が無ければ全額）。盤面に「ターン終了時 +N」のバッジがあると親切（非カード・公開＝mask 不要）。
- 支配(Possession)中＝`t.farrierDraw` は手番プレイヤー(被支配者)が引く＝公式の「you」と一致（獲得だけが支配者へ）。許容簡略化でよい。

---

## 2. Shop（店・$3・Action）

### 2-1. 英語カード文（区切り線＝**0本**）
> +1 Card
> +[$1]
> You may play an Action card from your hand that you don't have a copy of in play.

### 2-2. 版
> Second edition — March 2024 ＝エラッタなし。

### 2-3. Official FAQ（全文逐語）
> This lets you play an Action card from your hand, provided that you do not have a copy of that card in play.
> It does not matter if you played a copy of that Action that turn, only that it is not in play when you play Shop.

（Other rules clarifications 無し。Trivia＝`Shop puts the idea from Conclave and Imp onto a card in the set that likes variety.`）

### 2-4. ⚠ 実装で危ないところ
- **コンクラーベ(conclave)／インプと同一機構**＝`conclaveTargets(state, pi)`（engine.js:11397）がそのまま正本（「今その名前が場にあるか」だけ／前ターンの持続 `durationCards` も場／持続アクションも選べる／影札＝`handPlayable` 込み）。**ただし Shop は +1アクションを付けない**＝`CONCLAVE_PLAY` の `conclave_bonus` を積まない。新 pending `shop`＋`SHOP_PLAY`（4点セット）＝`playPlayable(state, pi, card, '店で', action.way)` を呼ぶだけ。
- Shop 自身は `PLAY_ACTION` で `inPlay` に入ってから `applyEffect` が走るので、**Shop で別の Shop は使えない**（同名が場）＝自動で正しい。命令（大君主等）経由の Shop は場に無いので別の Shop を使える＝これも公式どおり。
- CPU＝`chooseAction` に `'shop'` を登録（cpu.js:637 の conclave 行と同じ述語＝対象があるときだけ村の後ろで優先、無ければ末尾の terminal 扱い）／`decidePending` は `case 'conclave'`（cpu.js:2746）をコピー。UI＝`pd.type === 'conclave'`（ui.js:2806）をコピー（pool＝`DOM.engine.handPlayable`・「使わない」ボタン）。⚠ 既存の conclave UI は `way` を渡す導線が無い（engine は `action.way` を受理）＝Shop も同じ穴を持つ＝直すなら両方。

---

## 3. Infirmary（診療所・$3+・Action）

### 3-1. 英語カード文（区切り線＝**1本**）
> +1 Card
> You may trash a card from your hand.
> ―――――（`<hr>`）
> **Overpay:** Play this once per [$1] overpaid.

### 3-2. 版
> Second edition — March 2024 ＝エラッタなし（初版の Doctor の差し替え）。

### 3-3. Official FAQ ＋ Other rules clarifications（全文逐語）
> When you gain an Infirmary you overpaid for, you play it once per [$1] you overpaid.
> For example if you buy an Infirmary for [$5], you'd play the Infirmary twice - drawing a card, optionally trashing a card from your hand, drawing another card, and optionally trashing another card.
> This doesn't happen when you gain Infirmary without paying for it (such as with Horn of Plenty).

> In games using a Way, you can apply the Way when overpaying for Infirmary. For instance, you could buy Infirmary for [$7] and play the Infirmary four times using Way of the Sheep to get a total of +[$8], meaning you'd end up with more [$] than you had before buying the Infirmary (which you could then spend if you have an additional +Buy).

### 3-4. ⚠ 実装で危ないところ
- **「これを N 回使用する」は獲得時（＝購入フェイズの途中）にその場で N 回プレイする**。wiki／2024RB のどこにも「場に出さずに」とは書かれていない＝**通常の「カードを使用する」**＝**捨て札置き場にある獲得済みの Infirmary を場(inPlay)へ移して使う**（Way of the Horse で山へ戻せる等、「使用」の一般則）。本アプリの前例＝継続(Continue)の `continue_play2`（engine.js:13403〜）＝`playCardNoAction(state, pi, 'infirmary', p.discard, '過払いで')`（捨て札に無ければ lose track＝**全回とも失敗**とログ）。
  - 2回目以降＝**1回目の「手札1枚を廃棄してもよい」が解決してから**＝`state.replay` に `{player, card:'infirmary', label:…}` を残り回数ぶん積む（`runReplays` は `!state.pending` のときだけ進む＝自然に直列化）。ただし **Way を毎回選べる**（上の clarification）ので、習性のあるゲームでは **1回ごとに `infirmary_play` pending（`way` 付き）を開く再開網**（`t.infirmaryPlays={player,n}`＋reduce 末尾＝`storytellerResume` 型）にするのが忠実。習性が無いゲームは自動で回してよい。
  - 各回は「カードの使用」＝`actionsPlayed`／`noteAllyPlay` は積む（`runReplays` 既定分岐が両方やる）。**アクション権は消費しない**（playCardNoAction）。購入フェイズのまま行う（`t.phase` は触らない＝引いた財宝はもう出せない＝公式の購入後ロックと一致）。
- **基本効果**＝+1カード → 任意の廃棄 pending。既存の「手札1枚を廃棄してもよい」前例＝ヤギ `goat_trash`（engine.js:1692・GOAT_TRASH）と同型＝新 pending `infirmary_trash`（4点セット）。CPU は `card:null` 可（任意）。
- 🛑 上記 1-4 の **`maybeStartOverpay` の pending 上書きバグを先に直すこと**＝Infirmary は「獲得時対話と同時に起きる」効果なので、望楼／そり／貨物船と同じ獲得で並ぶ。順序は選べない（既存の横断簡略化）＝本アプリは「過払い→プレイ」が先・そり等はその後（Infirmary が場へ動いた後なので lose track で失敗）＝公式が許す順序の一つ。
- 支配中の購入＝獲得札は支配者の脇(possessionGains)へ行くので捨て札に無い＝プレイ失敗（許容簡略化）。
- UI＝`overpay` の `info` に「過払い1コインにつき、これを1回使用します」。CPU＝過払い額＝手札の屑（呪い/屋敷/銅貨）枚数を目安に。

---

## 4. Farmhands（耕作者・$4・Action）

### 4-1. 英語カード文（区切り線＝**1本**）
> +1 Card
> +2 Actions
> ―――――（`<hr>`）
> When you gain this, you may set aside an Action or Treasure from your hand, and play it at the start of your next turn.

### 4-2. 版
> Second edition — March 2024 ＝エラッタなし。

### 4-3. Official FAQ（全文逐語）
> Setting aside a card when you gain this is optional.
> Once you do it, you have to play the card at the start of your next turn, even if you no longer want to.
> Playing the Action card does not "use up" one of your Action plays for the turn.
> The set aside card is face up.

（Other rules clarifications 無し。2024RB も同文。）

### 4-4. ⚠ 実装で危ないところ
- **既存機構 `p.eventSetAside` ＋ `event_play` と完全に同型**（遅延／刈り入れ／せっかちな／急速拡大）。`resolveDurationStartEffects`（engine.js:9130）が枚数ぶん `event_play` を `startQueue` に積み、`EVENT_PLAY` が `playCardNoAction(...)` で**強制使用・アクション権不要・場に出る**＝FAQ の4点すべて満たす。**脇札は公開**（`maskStateFor` は `eventSetAside` を伏せていない・盤面チップも既存＝FAQ `face up` と一致）。
- **獲得時の窓＝`triggerOnGain` で `onGainQueue` に `{type:'farmhands_aside', player: pIndex}` を積む**（そり/牧羊犬と同じ形）。🛑 **`pIndex === state.turn.active` で絞らない**（道化師(Jester)／詐欺師で相手ターンに獲得しても自分の手札から脇に置き、自分の次ターン開始時に使う）。
- **脇に置けるのは「手札」だけ＝群B**＝`handPlayable`（山札の影札）を使わない（`DELAY_SETASIDE` engine.js:21451 と同じ `pl.hand.indexOf(card)`）。**遅延と違い財宝も可**（`DOM.isType(c,'action') || isTreasureFor(state,c)`）。
- 財宝を脇に置いた場合＝次ターン開始時に `playCardNoAction` の財宝分岐（`applyTreasureEffect`）＝コインはそのターン中有効。追いはぎ（その人の「最初の財宝」）に止められるのも公式どおり。
- 手札に獲得した場合（職人/彫刻家など）＝**その耕作者自身も「手札のアクション」**なので逐語上は脇に置ける（公式FAQ に明示は無い＝逐語からの推論）。engine/CPU/UI で同じ述語にしておけば整合する。
- CPU＝`decidePending`：手札の最良アクション（`throneValue`）→無ければ最高額の財宝→無ければ `card:null`。UI＝`modalSingleHand` 相当（フィルタ action||treasure・「脇に置かない」）。既存の `event_play` モーダル文言「遅延／刈り入れで脇に置いた」と盤面行の説明を耕作者込みに直す。
- 複数の開始時使用（遅延＋耕作者）の順は FIFO 固定＝既存の横断簡略化（公式は選べる）。

---

## 5. 総論ページ "Cornucopia & Guilds"（第2版）＝Setup／Rewards／過払いの一般ルール（逐語）

### 5-1. Preparation（Additional rules > Preparation＝wiki 本文・2024RB p.2 と一致）
> In games using Young Witch, choose an additional Kingdom card costing [$2] or [$3], and put its pile into the Supply. This is the "Bane" pile referred to by Young Witch; cards that start the game in this pile are "Bane cards." You may choose the card any way you like; for example using the randomizers. Cards from this pile are in the Supply and can be gained like other cards. Do any setup the Bane card requires.
> In games using Ferryman, choose an additional Kingdom card costing [$3] or [$4], and put its pile near the Supply. This pile is not part of the Supply, and these cards can only be gained via gaining a Ferryman. Do any setup the chosen card requires.
> In games using Joust, set the Rewards out near the Supply. Use one of each for 2 players, or two of each for 3-6 players. These are not in the Supply, and can only be gained via Joust.
> In games using Baker, Butcher, Candlestick Maker, Footpad, Joust, Merchant Guild, or Plaza, put the Coin tokens in a pile near the Supply, and each player takes a Coffers mat. In games using Baker, each player starts the game with a single Coin token on their Coffers mat. Otherwise, each player starts with no tokens on their mat.

2024RB の Ferryman 項（逐語）：
> Ferryman: When you gain a Ferryman, you also gain a copy of whichever card was set aside in setup. For example in setup you might set aside Shop, which costs [$3]; then that game, when you gained a Ferryman, you'd also gain a Shop. The card chosen for Ferryman can't be gained other ways, only by gaining a Ferryman. If the chosen card is a split pile (such as the Augurs from Dominion: Allies), different cards will be gained via Ferryman gains as they get uncovered.

### 5-2. Rewards（枚数＝**各2枚・計12枚／2人戦は各1枚だけ使う**）
2024RB 内容物：
> 12 Reward cards
> 2 each of Coronet, Courser, Demesne, Housecarl, Huge Turnip, Renown

wiki 本文：`Joust gives access to the Reward pile, 6 unique cards (though 2 copies of each are used in 3+ player games)`。
2024RB の Rewards 一般則（逐語）：
> There are two each of six rewards: Coronet, Courser, Demesne, Housecarl, Huge Turnip, Renown.
> • These are cards which are never part of the Supply. If the Rewards run out, that does not count towards the game end condition.
> • The Rewards may not be bought, or gained via cards like Horn of Plenty; only Joust can gain them from their pile. They can be gained from other places normally; for example Lurker from Intrigue can gain some of them from the trash.
> • Use all 12 Rewards with 3 or more players; use just one of each with 2 players. With 3 or more players, a single player can get two of the same Reward.
> • Trashed Rewards go to the trash pile, like other cards; they do not return to the Rewards pile.
> • If using the promotional card Black Market, do not put Rewards into the Black Market deck.

2024RB の Joust 項（逐語）：
> Joust: Use one copy of each Reward for games with 2 players, and two copies of each Reward for games with 3-6 players. With 3 or more players, it's okay to gain a Reward you already have a copy of. To gain a Reward you have to set aside a Province from your hand, discarding that Province in Clean-up with your other cards. If all Rewards have been claimed, you can still set aside a Province, but this won't do anything special for you. Rewards are not in the Supply, and can only be gained via playing Joust.

⇒ **本アプリの賞品(Prizes)「各1枚」とは違い、褒賞は `supply[id] = 人数>=3 ? 2 : 1`**（2人＝各1）。

### 5-3. Overpay（Additional rules > Overpay＝wiki `Overpay` ページ Official rules・2024RB p.3 と一致）
> Some cards can be "overpaid" for. The costs for these cards have a "+" next to the coin symbol. A player may pay any additional amount for such a card, and then gets an effect based on how much extra was paid.
> Potions (from Dominion: Alchemy) may be used in overpaid amounts if desired, although this is only meaningful with Stonemason.
> Debt (from Dominion: Empires) cannot be overpaid.
> Players may choose not to overpay, even if they have extra coins, but cannot choose to overpay [$0]; to overpay, a player has to actually pay more than the cost.
> Players can only overpay for a card when buying it, not when gaining it some other way.
> Overpaying itself happens when a card is bought; however "overpay" abilities happen when the card is gained, and are timed with other such abilities.
> The "+" is just a reminder; a card with a "+" in its cost still has its normal cost for all purposes. For example, Infirmary costs [$3], so it can be the card set aside for Ferryman.
> Reducing the costs of cards via cards like Renown does not make overpaying cheaper; for example if you had [$5] and two Renowns in play and bought Farrier, Farrier would cost [$0], and overpaying with your [$5] would still only give you +5 Cards at end of turn.

（2021年以前の旧則は `Overpaying happens when a card is bought, which is before it is gained.`＝**2022エラッタで「獲得時に他の獲得時能力と同時」へ変更**された。Donald X. 2022：`Overpay needed to resolve at the same time as when-gain abilities. But the payment had to be when you pay for the card, so it is.`）

### 5-4. 第2版の内容（Contents）
300枚＝王国262（26種×10・Fairgrounds は12）＋Reward 12＋ランダマイザー26＋コイントークン35＋財源マット6。
2E で削除＝Doctor/Farming Village/Fortune Teller/Harvest/Horse Traders/Masterpiece/Taxman/Tournament＋Prizes＋Bane card。
追加＝Carnival/Farmhands/Farrier/Ferryman/Footpad/Infirmary/Joust/Shop＋Rewards。2E の機能変更＝Herald/Stonemason の過払い表記（2022）・Merchant Guild（購入フェイズ終了時に財源・2021）・財源はターン中いつでも（2021）＝**いずれも本アプリは既に現行**。

### 5-5. Ferryman の非サプライ山＝設計メモ（総論の逐語から導けること）
- 山の中身＝**選んだ王国カードの「山」そのもの**（通常10枚。勝利点王国カード＝庭園$4/大広間$3/島$4/製粉所$4 なら 2人8／3人以上12）＋**その札の準備手順も走らせる**（例＝若き魔女($4)→災いカード／ページ・農民→成長山／サウナ→分割山／隠遁者→狂人山。2024RB が卜占官(Augurs)の分割山を名指し＝**分割山を選べば上から順に違うカードが出る**）。
- `state.supply` に入れない（`gainableBase`/`costUpTo`/3山終了/闇市場母集団/購入の4系統が `supply` を見るので、外に置くだけで全部塞がる）＝`state.ferrymanPile = { id, cards: [...] }` をトップレベルに置き、`allCards`／保存則 tally に**数える**（物理カード）。川船(`state.riverboatCard`＝1枚・数えない)とは逆。
- **公開**（サプライ脇の山＝中身は既知）＝`maskStateFor` は素通しでよい（分割山なら一番上だけが意味を持つ）。盤面に「渡し守の山：〈カード名〉残N」。
- 獲得＝Ferryman の on-gain（`onGainQueue`・誰の獲得でも）で山から1枚を `gainFromOutside` 相当で捨て札へ（山が空なら何もしない）。Infirmary は「$3」なので候補（`+` は飾り）。

---

## 実装前に必読（この群に共通する罠）
- 🛑 **`maybeStartOverpay`（engine.js:3416）は `state.pending` を無条件に上書きする既存バグ**（望楼/交易商人の獲得時窓が消える＝node で再現済み・mix-all で到達）。Farrier/Infirmary を `OVERPAY_CARDS` に足す前に、pending が立っているときは `onGainQueue` に積んで後から `overpay` を開く形へ直す（公式＝過払い能力は「獲得時に他の獲得時能力と同時」）。
- **過払いは BUY／BLACK_MARKET_BUY の2経路だけ**＝工房/Horn of Plenty/Ferryman 経由の獲得では絶対に起きない（公式 `This doesn't happen if you gain ... without paying for it`）。額＝**軽減後コストを超えた残コイン**（既存 `max: t.coins`）＝公式例（Renown×2）と一致。ポーション・負債は数えない。
- **「ターンの終了時 +N カード」は `cleanupAndAdvance` の先引きの後（`t.squirrelDraw` の位置）**＝Squirrel FAQ `after drawing your hand in Clean-up`。
- **「これを使用する」（Infirmary）は場に出す通常のプレイ**＝捨て札から `playCardNoAction(..., p.discard, ...)`（継続 `continue_play2` と同形）→2回目以降は1回目の廃棄 pending 解決後（`state.replay` か専用再開網）。**Way を毎回選べる**（公式 clarification）＝習性があるゲームでは1回ごとに窓。
- **「脇に置いて次ターン開始時に使う」（Farmhands）は `p.eventSetAside`＋`event_play` をそのまま使う**（強制・アクション権不要・公開・財宝も可）。獲得時窓は `onGainQueue`・**active で絞らない**・**手札限定（影札を出さない）**。
- **Shop は `conclaveTargets` を流用・`conclave_bonus` だけ積まない**。
- **Rewards の山は 2人=各1／3人以上=各2**（賞品の「各1」をコピーしない）。Ferryman の山は **サプライ外・10枚（勝利点王国なら8/12）・分割山も可・その札の準備も走らせる**。
- UI の「$2+/$3+」表示＝本アプリは `+` を描かない（石工/医者/伝令官も同じ＝既存の表示簡略化）。`OVERPAY_CARDS` が唯一の正本＝cards.js に overpay フラグは無い。

（取得物＝scratchpad `cg2_overview.txt` / `cg2_overpay.txt` / `cg2_rulebook2024.pdf|.txt` / `cg2raw/raw_*.html`。リポジトリは未変更・一時スクリプトは削除済み。）

---

# 【章】王国B

# 収穫祭＆ギルド 第2版 — Carnival／Ferryman／Footpad／Joust 公式ルール確定レポート

一次資料：英語wiki（2026-02-28 版のライブページ・`tools/wikidirect.js`）／RGG 公式ルールブック **2E（2023年11月組版・2024年3月刷）** `wiki.dominionstrategy.com/images/5/5f/Cornucopia_%26_GuildsRulebook2023.pdf`（pdftotext 済）／英語wiki `Cornucopia_&_Guilds`・`Reward`・`Split_pile`・`Action_phase`／Dominion Strategy フォーラム（Rules Questions・Donald X. 裁定）。**日本語wiki は叩いていない。リポジトリは1バイトも変更していない。**

---

## 1. Carnival（謝肉祭・$5・アクション）

### 1-1 英語カード文（現行逐語・区切り線 0本）
> Reveal the top 4 cards of your deck. Put one of each differently named card into your hand and discard the rest.

### 1-2 版
> English versions ／ Second edition ／ March 2024（Announced/Printed は colspan="2" で統合＝**印刷済み**）

エラッタなし（2024年3月の1刷のみ）。

### 1-3 Official FAQ（全文逐語）
> For example if you revealed 3 Coppers and a Farmhands, you'd put one Copper and the Farmhands into your hand, and discard the other two Coppers.
> Shuffle if necessary to get 4 cards to reveal; if there still aren't 4 cards, reveal what you can.

（Other rules clarifications 節は存在しない。ルールブック p.5 の Carnival 項も同文。）

### 1-4 ⚠ 実装で危ないところ
- **pending は不要＝完全自動**。「名前の異なるカードを1枚ずつ」は id 単位の dedupe（選択の余地なし）。雛形は既存の `case 'harvest'`（上4枚を `p.deck.shift()` で取り、足りなければ `reshuffleDeck`、`reveal(state, pi, revealed, …)`）。違いは「1枚目の各id → `p.hand`、重複分 → `p.discard`」。
- 🛑 **捨てた重複分に `triggerOnDiscard(state, pi, dups)` を必ず呼ぶ**（坑道→金貨／村有緑地／忠犬）。自分のターンなので `noPrompt` なし。順序＝「手札に入れる → 残りを捨てる → 捨て札トリガー」。
- **「手札に加える」はドローではない**＝`draw()` を通さない（-1カードトークンを食わせない／カメレオンの習性の変換対象でもない）。`reveal()` を通せばパトロンは自動で効く。
- 公開は全員に見える＝`maskStateFor` の私的看破リストには**足さない**。
- CPU：`chooseAction` に登録（ターミナルドロー）。`decidePending` 不要。UI も不要（ログ＋公開演出だけ）。

---

## 2. Ferryman（渡し守・$5・アクション）🛑 最重量

### 2-1 英語カード文（現行逐語・区切り線 **1本**＝Setup の前）
> +2 Cards
> +1 Action
> Discard a card.
> ————
> **Setup:** Choose an unused Kingdom card pile costing $3 or $4. Gain one when you gain a Ferryman.

### 2-2 版
> Second edition ／ March 2024（colspan="2"＝印刷済み）

エラッタなし。

### 2-3 Additional rules ＝ Preparation（wiki・ルールブック p.2 ともに同文・逐語）
> In games using Ferryman, choose an additional Kingdom card costing $3 or $4, and put its pile near the Supply.
> This pile is not part of the Supply, and these cards can only be gained via gaining a Ferryman. Do any setup the chosen card requires.

（比較のため同じ Preparation 節の災いカードの文＝`…and put its pile into the Supply. … Cards from this pile are in the Supply and can be gained like other cards.`＝**Bane は Supply 入り／Ferryman は Supply 外**。選び方は Bane の文に `You may choose the card any way you like; for example using the randomizers.` とあり Ferryman も同じ扱い＝**ランダムでも任意でもよい**。）

### 2-4 Official FAQ（全文逐語）
> When you gain a Ferryman, you also gain a copy of whichever card was set aside in setup.
> For example in setup you might set aside Shop, which costs $3; then that game, when you gained a Ferryman, you'd also gain a Shop.
> The card chosen for Ferryman can't be gained other ways, only by gaining a Ferryman.
> If the chosen card is a split pile (such as the Augurs from Dominion: Allies), different cards will be gained via Ferryman gains as they get uncovered.

### 2-5 Other rules clarifications（全文逐語）
> Do any setup required of the chosen card. So if the chosen card is Young Witch, you'll add another Kingdom pile to the Supply.
> In the case of a split pile, it is the cost listed on the pile's randomizer card that determines whether it is eligible to be set aside for Ferryman.
> If Ferryman is gained from the trash or from the Black Market deck, you also gain a card from the set aside pile.
> If the chosen pile is e.g. Odysseys, Old Map can rotate its own pile. But if the chosen pile is Clashes, Battle Plan can't rotate it because Battle Plan specifies that the rotated pile must be in the Supply.
> Contrary to the FAQ, cards like Rats can gain copies of themselves from their own pile, because it explicitly says "gain a Rats."
> However, Acolyte and Small Castle can't gain cards from their pile if it isn't in the Supply. This is because instead of trying to gain a card with a specific name, they try to gain a card with a specific type (from the Supply). [1]
> Changeling's ability still works even if it's not in the Supply (as long as any are in the pile).
> Temple and Farmers' Market can add and take [VP] from their own pile, even if it's not in the Supply.

（[1] の脚注リンクは wiki の HTML に参照先が無く本文だけ。）

関連（総論ページ Overpay 節・逐語）：
> The "+" is just a reminder; a card with a "+" in its cost still has its normal cost for all purposes. For example, Infirmary costs $3, so it can be the card set aside for Ferryman.

関連（ルールブック p.7 Merchant Guild 項・逐語）：
> Merchant Guild: This counts all cards gained in your Buy phase, whether bought, or gained other ways, such as via Ferryman.

### 2-6 Split pile の randomizer コスト（wiki `Split_pile` 逐語）＝どの分割山が選べるか
> Piles are sorted by the cost of the top card (which is shown on the randomizer card for the pile).
> $2 Encampment/Plunder, Patrician/Emporium, Settlers/Bustling Village, Townsfolk
> $3 Castles, Catapult/Rocks, Gladiator/Fortune, Augurs, Clashes, Forts, Odysseys, Wizards
> $4 Sauna/Avanto

⇒ **選べる**＝城(Castles)／投石機・石／剣闘士・大金／卜占官／衝突／城砦／叙事詩／魔法使い／サウナ・アヴァント。**選べない**＝$2 の4山、騎士（randomizer $5）、廃墟（王国カードの山ではない）。

### 2-7 設計メモ（質問項目への回答）
| 問い | 答え（根拠） |
|---|---|
| 何を選ぶ | 「使われていない」王国カードの山で **ちょうど $3 か $4**（3成分＝ポーション費用・負債コストは不可。`costing $3 or $4`）。`+`（過払い）付きでも可（診療所 $3+ を名指し）。分割山は **randomizer のコスト**で判定 |
| 誰が・ランダムか | 公式は「好きな方法で（例：ランダマイザー）」＝本アプリは `pickBane` と同じ自動抽選でよい |
| 何枚 | 「その山を（そのまま）置く」＝サプライに置く場合と同じ枚数。通常10／勝利点（庭園/封土/絹の道…）8 or 12／ネズミ20／城 8 or 12／同盟分割山16／帝国2段 5+5／サウナ・アヴァント 5+5（※港町 Port $4 は公式12枚） |
| 尽きたら | 渡し守を獲得しても何も獲得しない。**3山終了に数えない**（`not part of the Supply`） |
| 購入できるか | 不可（サプライではない）。**汎用獲得（工房/値切り屋/詐欺師…）も不可**＝`only by gaining a Ferryman` |
| サプライの山と同名でよいか | 不可＝`unused`（王国10山・Bane・川船の脇札・ハツカネズミの脇札・闇市場デッキと重複させない。フォーラム Rules Questions で Jeebus＝「Way of the Mouse の札も Duchess も Black Market のセットアップ札も“使われている”」） |
| 誰が獲得するか | 渡し守を獲得した人（購入／効果獲得／廃棄置き場から／闇市場デッキから、すべて） |
| 獲得先 | 渡し守本体の dest とは独立＝通常の捨て札（公式逐語は `gain a copy`＝普通の獲得） |

**state の置き場（推奨）**：`state.ferrymanPile = { card: <山キー>, cards: [実id, …]（先頭＝一番上） }`（無ければ `null`）。
- 🛑 **`supply` には載せない**（載せると `emptyPileCount`／`canBuyCard`／`gainableBase`／`pickBane` 等がサプライと誤認する。`NON_SUPPLY` は静的 Set なので動的な id を入れられない）。**`state[山キー]`（混合山モデル）にも置かない**＝`mixedPileWithTop` が `MIXED_PILE_KEYS.find(k => state[k][0]===id)` で拾い、**待ち伏せ/塩まき/追放/封鎖の候補に漏れる**（同盟分割山や城を選んだとき）。専用フィールドが一番安全。前例＝`state.loot`（supply に無い非サプライ山）。
- **公開**（選ばれる山はすべて公開情報＝騎士/廃墟は選べない）＝`maskStateFor` で伏せない。
- **保存則**＝カードなので `test/invariants.test.js` の `tally` に `(s.ferrymanPile ? s.ferrymanPile.cards : []).forEach(add)` を足す（戦利品と同じ行）。`allCards` には入れない（誰も所有していない）。
- **獲得の入口**＝新ヘルパ `gainFromFerryman(state, pi)`：`cards.shift()` → 実カードを `p.discard` へ → `gainedThisTurn`/`lastGainedAny`/`buyPhaseGained` の帳簿 → `triggerOnGain(state, pi, realId, 'discard', costAtGain)`。**`pileEmptied` は呼ばない**（非サプライ＝調査 Search は誘発しない／塔にも数えない）。**`_gainOutside` は立てない**（戻せる山がある＝交易商人で銀貨に置換されたら山へ戻すのが公式＝`returnToPile`/`canReturnToPile` に `state.ferrymanPile.card === pileKeyOf(id)` の分岐を1つ足す）。支配中は `gain()` と同じ振り分け（獲得者＝支配者）。
- **配線点**＝`triggerOnGain` の `cardId === 'ferryman'` で `gainFromFerryman`（**渡し守の on-gain＝購入/工房/廃棄置き場/闇市場のどの経路でも発火**＝`gain` と `gainFromOutside` の両方が `triggerOnGain` を通るので1箇所でよい）。入れ子の獲得（`_gainDepth` 2段目）になる＝**渡し守自身の獲得時対話（望楼など）を握りつぶさない**よう、対話は `onGainQueue` に積む既存流儀に従う。
- **`createInitialState` の順序**：`kingdom` 確定直後・**`pickBane` より前**に `pickFerrymanCard(kingdom)`（`pickRiverboatCard` と同じ「静的コスト＝`C()[id].cost===3||4`・`!potion`・`!debt`・`!NON_SUPPLY`・`!inK`」。🛑 `costExact` は `gainableBase` を含むので候補ゼロになる）。**分割山は上段キー（randomizer）で判定し候補に残す**（`pickMouseCard` 末尾の「分割山・城・騎士の除外」をコピーしない。`castles` は $3 なので候補、`knights` は $5 で自動的に落ちる）。以後の `pickBane`／`pickRiverboatCard`／`pickMouseCard`／`pickApproachingArmy`／闇市場 universe／`applyDivineWind` の新10山 は**ferryman の山キー（分割山なら中身も）を除外**する。
- 🛑 **「選んだ札が要求する準備も走らせる」**＝現在 `riverboatCard` を見ている6〜7系統（馬 `HORSE_GIVERS`／祝福 fate／呪詛 doom／アーティファクト／戦利品 loot／Ally `alliesHasLiaison`／前兆 `hasOmen`）に加え、**`initSupply` が `kingdom.includes` で見ている系統**＝賞品(tournament $4)／略奪品・廃墟(marauder $4, death_cart $4＝looter)／狂人(hermit $3)／傭兵(urchin $3)／精霊・願い(cemetery $4・secret_cave $3・devils_workshop $4・exorcist $4・leprechaun $3)／**家宝＝開始デッキ**(fool $3・shepherd $4・secret_cave・cemetery)／ゾンビ(necromancer $4)／災いカード(young_witch $4＝Bane をサプライに追加)／闇市場デッキ(black_market $3)／来寇の11山目（前兆 poet/river_shrine/rustic_village $4 → 予言 approaching_army）。**特性(Trait)の付け先には含めない**（サプライの山ではない）。
- **旧スナップショット互換**＝`state.ferrymanPile` が無い保存データでも落ちないよう全参照を `state.ferrymanPile &&` でガード。
- **名指しで自分の山から取る効果**＝公式が名指しした Rats(`gain a Rats`)・Changeling の交換（`exchangeCard` がサプライから取る箇所）は **渡し守の山にフォールバック**できる小ヘルパ（`takeNamedFromPile`）が要る。Magpie（`gain a Magpie`）も同型。Temple/Farmers' Market の `pileVP[山キー]` はマップなので supply に無くても動く（`pileKeyOf` のフォールバック＝cardId）。Old Map/Herb Gatherer/Tent/Student の「自分の山を循環」は `rotatePile` に `ferrymanPile.card === pileId` の分岐＝`cards` 配列を回す／Battle Plan の `rotatableSupplyPiles` は除外のまま（公式）。
- UI：`ruinsPileEl` と同型の「渡し守の山（一番上＋残枚数）」ブロックを盤面に（買う前に見えないと判断できない）。CPU：`GAIN_ORDER` に渡し守を実強度順に置くだけ（獲得は自動）。
- 「Discard a card.」＝強制1枚捨て（手札0なら窓を開かない）。pending `ferryman_discard` を4点セットで。雛形＝`FORUM_DISCARD`（`discardFromHand`）。**捨て札トリガーを通す**（坑道）。
- `sw.js`／闇市場：`DOM.STAGE1_POOLS` から `cornguilds2e` を外すのは R7 相当（ガード済み）。

---

## 3. Footpad（野盗・$5・アクション-アタック）

### 3-1 英語カード文（現行逐語・区切り線 **1本**）
> +2 Coffers
> Each other player discards down to 3 cards in hand.
> ————
> In games using this, when you gain a card in an Action phase, +1 Card.

### 3-2 版
> Second edition ／ March 2024（colspan="2"＝印刷済み）

エラッタなし。

### 3-3 Official FAQ（全文逐語・ルールブック p.5 も同文）
> This changes any game it's part of, even if no-one has gained a Footpad.
> For that entire game, any time you gain a card in an Action phase, you draw a card.
> For example if you played Remake to turn two Estates into two Silvers, you'd draw two cards.
> Drawing isn't optional.
> This doesn't draw you cards in Buy phases or Clean-up, just Action phases.
> When you play a Footpad, you get +2 Coffers, and the other players discard down to 3 cards in hand.

（Other rules clarifications 節は無い。）

### 3-4 追加の裁定（wiki `Action_phase`／フォーラム Rules Questions）
> All effects that are resolved at the start of a turn are also part of the Action phase and all such effects must be completed before the normal optional Action play is performed.
> If gaining a card that returns to your Action phase and there are other when-gain effects which care about which phase a card is gained in (such as Colonnade or Footpad), they will still see when the card was gained, regardless of whether they are resolved before or after returning to your Action phase.
> In games with Footpad, you do not get draw a card from gaining Villa even if you try to resolve it after Villa.
> However, if a when-gain effect triggers new effects (such as gaining additional cards) after Villa's effect has been resolved, these gains happened in your Action phase.

Donald X.（Rules Questions「Villa and Footpad」2026-04-01）：
> No. Footpad doesn't care what phase it is when the ability resolves; it cares what phase it was when you gained the card.

Tiago（Simple Rules Questions 2024-04-11・「ターン開始時の獲得は？」への回答）：
> At the start of your turn is contained in your Action phase, so you'll get +1 Card from Footpad. It also applies with things like Crown.

**相手のアクションフェイズ中の獲得でも引く**（Dominion Online での実例・Semi-Interesting Moments 2024-02-28）：
> Footpad + Old Witch in the same game. Opponent plays Old Witch, giving me a Curse. Since it's during an Action phase, I draw a card.

（カード文が `your` ではなく `**an** Action phase`＝誰のアクションフェイズでもよい。対照＝厳冬の `on your turn`。）

### 3-5 ⚠ 実装で危ないところ
- **常設ルール＝シャーマン／官僚制と同型だが発動点が違う**：`triggerOnGain` に1行＝`if (footpadRule(state) && phaseAtGain === 'action') draw(state, pIndex, 1)`。**誰の獲得でも・誰のアクションフェイズでも**（獲得者 `pIndex` が引く）。
- 🛑 **フェイズは「獲得した瞬間」**＝`triggerOnGain` 冒頭で捕まえている `gainWasBuyPhase` と同じ位置で `gainWasActionPhase = state.turn.phase === 'action'` を捕まえる（ヴィラ/騎兵隊の `phase='action'` 復帰より前）。**ターン開始時も `phase==='action'`**（ピアッツァの前例）＝開始時の獲得（シャーマン・操舵手・王子経由の工房…）で引く＝公式どおり。夜フェイズ（`'night'`）・購入・片付けは引かない。
- **強制**（`Drawing isn't optional`）＝pending 不要。`draw()` を通す（-1カードトークンは食ってよい＝それが draw の定義）。🛑 ただし **`state._chamOff` を立てて呼ぶ**（カメレオンの習性は「そのカードの +カード」だけが対象＝浪人と同じ扱い。外すと Workshop×カメレオン中の獲得で +$1 に化ける）。
- 「in games using this」＝`state.kingdom.includes('footpad')`。**神風で撤去されても効き続ける**／新10山で入ってきたら効き始める＝`createInitialState` と `applyDivineWind` で `state.footpadRule = true` を立てる（下ろさない）形が安全。闇市場デッキの野盗は「使われている」扱いがフォーラム裁定（Jeebus）だが、**シャーマンと同じく kingdom 判定に据え置く＝許容簡略化として明記**。
- アタック部分＝`discardDownEnter(state, pi, 3, others)`（忍者と同型・`down=3`＝**embedded 型なので `ATTACKS` 登録不要**／堀・盾・馬商人・番犬・物乞い・隊商の護衛は `modalDiscardDown` が既に持つ）。被害者の抽出は忍者と同じ `hand.length > 3 && !attackImmune`。
- +2 財源＝`p.coffers = (p.coffers||0) + 2`（ヘルパ無し・肉屋 `p.coffers += 2` と同じ）。**財源を先に**（記載順）。
- **一騎討ちとの相互作用**＝褒賞は手札に「獲得」＝アクションフェイズなので **+1カード**。Remake/改築/工房/馬商人…すべて引く。入れ子の獲得（`_gainDepth>6` ガード）で深い連鎖は止まる＝許容。
- CPU：`chooseAction` に登録／`decidePending` は `discard_down` が既存／UI 追加不要。CPU の王国評価には影響なし。

---

## 4. Joust（一騎討ち・$5・アクション）

### 4-1 英語カード文（現行逐語・区切り線 0本）
> +1 Card
> +1 Action
> +$1
> You may set aside a Province from your hand to gain any Reward to your hand. Discard the Province in Clean-up.

### 4-2 版
> Second edition ／ March 2024（colspan="2"＝印刷済み）

エラッタなし。

### 4-3 Additional rules ＝ Preparation（逐語）
> In games using Joust, set the Rewards out near the Supply.
> Use one of each for 2 players, or two of each for 3-6 players.
> These are not in the Supply, and can only be gained via Joust.

### 4-4 Official FAQ（全文逐語・ルールブック p.7 も同文）
> Use one copy of each Reward for games with 2 players, and two copies of each Reward for games with 3-6 players.
> With 3 or more players, it's okay to gain a Reward you already have a copy of.
> To gain a Reward you have to set aside a Province from your hand, discarding that Province in Clean-up with your other cards.
> If all Rewards have been claimed, you can still set aside a Province, but this won't do anything special for you.
> Rewards are not in the Supply, and can only be gained via playing Joust.

### 4-5 Reward の公式ルール（wiki `Reward`＋ルールブック p.12・逐語）
> There are two each of six rewards: Coronet, Courser, Demesne, Housecarl, Huge Turnip, Renown.
> These are cards which are never part of the Supply. If the Rewards run out, that does not count towards the game end condition.
> The Rewards may not be bought, or gained via cards like Horn of Plenty; only Joust can gain them from their pile. They can be gained from other places normally; for example Lurker from Intrigue can gain some of them from the trash.
> Use all 12 Rewards with 3 or more players; use just one of each with 2 players. With 3 or more players, a single player can get two of the same Reward.
> Trashed Rewards go to the trash pile, like other cards; they do not return to the Rewards pile.
> If using the promotional card Black Market, do not put Rewards into the Black Market deck.

（品評会の FAQ も `sometimes there may be more cards, such as via Young Witch's setup rule, or due to Joust.`＝褒賞は「異なるカード」に数える。）

### 4-6 質問項目への回答
- **褒賞が尽きていたら**：属州は脇に置ける（`you can still set aside a Province, but this won't do anything special`）＝効果なしでも選択自体は合法。
- **玉座で2回**：各プレイで独立に「してもよい」＝属州2枚を脇に置けば褒賞2枚（3人以上なら同名2枚目も可）。2人戦は各1枚＝計6枚しか無い。
- **属州を脇に置いたが褒賞が無い**：そのまま。クリーンアップで属州を捨てる。
- **枚数**：🛑 **「各1枚」ではない＝2人＝各1／3〜6人＝各2**（賞品 Prizes の `supply[id]=1` をそのままコピーしてはいけない）。

### 4-7 ⚠ 実装で危ないところ
- **褒賞の山＝賞品型**：`initSupply` に `if (kingdom.includes('joust')) REWARDS.forEach(id => supply[id] = numPlayers >= 3 ? 2 : 1)`。`REWARDS`（engine 19行）は既に `NON_SUPPLY` に入っている＝購入不可・3山終了に数えない・`gainableBase` で汎用獲得不可・闇市場除外・CPU `NON_SUPPLY_SET` 済み。UI の `nonSupplyIds`（`js/ui.js` 1368）に `DOM.POOLS.rewards` を足す（残枚数表示）。🛑 渡し守の山に一騎討ちは来ない（$5）が、`riverboatCard === 'joust'` なら山を作る（川船は $5 非持続アクションを選べる）。
- **脇に置いた属州＝物理カード・公開**＝新ゾーン `p.joustAside`（`allCards`／invariants `ZONES`／`maskStateFor` は素通し＝公開）。**クリーンアップで捨てる**＝`cleanupAndAdvance` の「手札を捨てる」（`p.discard.push(...p.hand)`）と同じ位置で `p.discard.push(...p.joustAside)`（`journeyKeep`＝旅行の「場のカードを捨てない」は**手札は捨てる**ので属州も捨てる側）。公式「with your other cards」＝捨て札トリガーの対象だが属州に on-discard は無い。支配中はゾーンが被支配者に付き、クリーンアップも被支配者の捨て札へ。
- **pending は2段**（4点セット）：`joust_aside`（任意＝「やめる」必須。候補＝手札の属州。`handPlayable` は使わない＝群B ではないが影に属州は無い）→ `joust_reward`（褒賞を1枚選ぶ＝`supply[id]>0` の褒賞。`gain(state, pi, id, 'hand')`）。🛑 **褒賞がゼロでも1段目の窓は開く**（公式が「それでも脇に置ける」と明記＝書庫/手札枚数依存で意味がある）。候補ゼロなら2段目は開かず終端保証（CPU が `card:null` を返して livelock しない形）。
- **獲得先は手札**＝`gain(..., 'hand')`。獲得トリガーは普通に走る（**野盗の +1カード／望楼／進歩**など）。褒賞の on-gain は無い。
- `+$1` は `addCoins`、`+1 Action` は `addActions`（雪深い村）。
- CPU：`chooseAction` 登録（キャントリップ優先）。`decidePending`＝属州があれば脇へ（終盤の得点勘定は褒賞の種類で判断＝ほぼ常に得）。褒賞の選択順＝Renown > Courser > Demesne > Coronet > Housecarl > Huge Turnip（Glicko 順・wiki）。**CPU の `vpOf`/`winsIfEnds` は御料地(Demesne)の可変VP（金貨1枚につき1点）を別エージェント実装と同時に `vpOf` 両面へ**（赤字にしない）。

---

## 実装前に必読（この群に共通する罠）
1. **「〜のフェイズに獲得したか」は獲得した瞬間のフェイズで判定する**＝`triggerOnGain` 冒頭で捕まえる（`gainWasBuyPhase` の隣に `gainWasActionPhase`）。ヴィラ/騎兵隊/継続で後からフェイズが変わっても見直さない（Donald X. 2026-04 裁定）。ターン開始時＝アクションフェイズ。
2. **野盗は誰のアクションフェイズでも・誰の獲得でも・強制で引く**（相手の魔女で呪いを獲得しても引く）。`draw()` は `_chamOff` 付きで。
3. **褒賞は2人＝各1／3人以上＝各2**。賞品の「各1枚」をコピーしない。`NON_SUPPLY`/`REWARDS` は登録済みなので `initSupply` と UI 表示だけ。
4. **渡し守の山は `supply` にも `state[山キー]` にも置かない**＝専用 `state.ferrymanPile {card, cards[]}`（公開・保存則 tally に数える・`allCards` に入れない）。獲得は専用ヘルパで `triggerOnGain` を通し、`pileEmptied` は呼ばない／`_gainOutside` は立てない／`returnToPile` と `rotatePile` に分岐を足す。
5. **渡し守の候補述語は静的コスト（`C()[id].cost===3||4`・potion/debt なし）で、分割山は randomizer キーで判定**＝城・帝国の $3 分割山・同盟の $3 分割山・サウナが候補。`costExact`/`gainableBase` は使えない（候補ゼロになる）。
6. **「使われている札」の除外は双方向**＝渡し守の山は王国・Bane・川船・ハツカネズミ・闇市場デッキと重複させず、逆に Bane/川船/ハツカネズミ/来寇/闇市場/神風の新10山の抽選からも渡し守の山キー（分割山の中身含む）を除外する。
7. **渡し守の山の札が要求する準備を全部走らせる**（家宝＝開始デッキ／Bane／賞品／廃墟・略奪品・狂人・傭兵／精霊・願い／ゾンビ／祝福・呪詛／馬／Ally／予言＋来寇の11山目／アーティファクト／闇市場デッキ）＝`riverboatCard` を見ている箇所すべて＋`initSupply` の `kingdom.includes` 系。
8. **謝肉祭は pending 無しの完全自動**だが、重複分の捨て札に `triggerOnDiscard` を呼ぶこと（坑道）。「手札に加える」は draw ではない。
9. **一騎討ちの属州の脇置きは褒賞がゼロでも合法**＝窓を閉じない。脇ゾーンは公開・物理カード・クリーンアップで手札と一緒に捨てる。
10. 新 pending（`ferryman_discard`／`joust_aside`／`joust_reward`）は**4点セット**（reducer＋`PLAYER_ACTIONS`＋CPU `decidePending`＋UI `viewPendingModal`）＋終端保証。野盗の `discard_down`・謝肉祭は既存機構だけで足りる。

一時ファイルはすべて scratchpad（`…\scratchpad\cg2\`）に置いた。リポジトリ配下に `_cg2_*` は作っていない（`git status` の変更4件は Codex の既存分のまま）。

Sources: [Carnival](https://wiki.dominionstrategy.com/index.php/Carnival) / [Ferryman](https://wiki.dominionstrategy.com/index.php/Ferryman) / [Footpad](https://wiki.dominionstrategy.com/index.php/Footpad) / [Joust](https://wiki.dominionstrategy.com/index.php/Joust) / [Reward](https://wiki.dominionstrategy.com/index.php/Reward) / [Cornucopia & Guilds](https://wiki.dominionstrategy.com/index.php/Cornucopia_%26_Guilds) / [Split pile](https://wiki.dominionstrategy.com/index.php/Split_pile) / [Action phase](https://wiki.dominionstrategy.com/index.php/Action_phase) / [Rulebook 2E PDF](https://wiki.dominionstrategy.com/images/5/5f/Cornucopia_%26_GuildsRulebook2023.pdf) / [Forum: Villa and Footpad](https://forum.dominionstrategy.com/index.php?topic=22391.0) / [Forum: Simple Rules Questions](https://forum.dominionstrategy.com/index.php?topic=15668.msg907578) / [Forum: Semi-Interesting Moments](https://forum.dominionstrategy.com/index.php?topic=15455.msg906779)

---

# 【章】褒賞

# 褒賞(Reward)6種＝公式ルール確定レポート（段階2の実装用）

一次資料＝英語wiki 各カードページ（`tools/wikidirect.js`・2026-08-23 取得・生HTMLで `<hr>` を確認）／
英語wiki `Reward`・`Joust`・`Cornucopia_&_Guilds`／**RGG 公式ルールブック 2E（`Cornucopia_&_GuildsRulebook2023.pdf`・12p・pdftotext）**。
日本語wiki は一切叩いていない。リポジトリは無変更（一時ファイルは scratchpad のみ）。

---

## 0. 褒賞の山そのもの（6種に共通・逐語）

### 0-1. カード文の共通部分・コスト・種別
- 6種とも **`[$0*]`**、文末に必ず `(This is not in the Supply.)`（Demesne/Housecarl の印刷物は `supply` 小文字＝wiki の Versions 表は大文字）。
- 区切り線 `<hr>` があるのは **Demesne だけ**（`Gain a Gold.` と `Worth 1VP per Gold you have.` の間に1本）。他5種は0本。
  → 現カタログ（`js/cards.js` 1729-1740）は**この通り**になっている（demesne だけ `————`）。**修正不要**。

### 0-2. 準備（RGG 2E ルールブック p.2「Preparation」・英語wiki 総論ページも同文）
> In games using Joust, set the Rewards out near the Supply. Use one of each for 2 players, or two of each for 3-6 players. These are not in the Supply, and can only be gained via Joust.

> In games using Baker, Butcher, Candlestick Maker, Footpad, **Joust**, Merchant Guild, or Plaza, put the Coin tokens in a pile near the Supply, and each player takes a Coffers mat.

（ルールブック p.1 Contents＝`12 Reward cards / 2 each of Coronet, Courser, Demesne, Housecarl, Huge Turnip, Renown`）

### 0-3. 褒賞の一般則（RGG 2E ルールブック p.8＝英語wiki `Reward` ページ「Official rules」と同文）
> There are two each of six rewards: Coronet, Courser, Demesne, Housecarl, Huge Turnip, Renown.
> • These are cards which are never part of the Supply. If the Rewards run out, that does not count towards the game end condition.
> • The Rewards may not be bought, or gained via cards like Horn of Plenty; only Joust can gain them from their pile. They can be gained from other places normally; for example Lurker from Intrigue can gain some of them from the trash.
> • Use all 12 Rewards with 3 or more players; use just one of each with 2 players. With 3 or more players, a single player can get two of the same Reward.
> • Trashed Rewards go to the trash pile, like other cards; they do not return to the Rewards pile.
> • If using the promotional card Black Market, do not put Rewards into the Black Market deck.

### 0-4. Joust 側の FAQ（褒賞の獲得経路・英語wiki `Joust` Official FAQ＝ルールブック p.7 と同文）
カード文（Joust）：
> +1 Card / +1 Action / +[$1]
> You may set aside a Province from your hand to gain any Reward to your hand. Discard the Province in Clean-up.

> Use one copy of each Reward for games with 2 players, and two copies of each Reward for games with 3-6 players.
> With 3 or more players, it's okay to gain a Reward you already have a copy of.
> To gain a Reward you have to set aside a Province from your hand, discarding that Province in Clean-up with your other cards.
> If all Rewards have been claimed, you can still set aside a Province, but this won't do anything special for you.
> Rewards are not in the Supply, and can only be gained via playing Joust.

### ⚠ 0-5. 山の扱い＝本アプリでの帰結（実装メモ）
- 🛑 **各1枚ではない**＝**2人戦＝各1枚／3〜6人戦＝各2枚（計12枚）**。
  現状の engine コメント（`js/engine.js:18` 「各1枚」）と cards.js のコメント、タスク文の「各1枚の想定」は**誤り**。
  `initSupply` に `if (kingdom.includes('joust')) REWARDS.forEach((id) => (supply[id] = numPlayers >= 3 ? 2 : 1));`
  （賞品 `tournament` の行 1945 の隣）。**賞品型の数値キー山**でよい（`supply[id]` 数値・`NON_SUPPLY` 登録済み）。
- **NON_SUPPLY には既に `REWARDS` が入っている**（engine:34／cpu `NON_SUPPLY_SET`:147-148）＝
  3山終了（`emptyPileCount`）・購入（`canBuyCard`）・闇市場デッキ（2275）・汎用獲得（`gainableBase`）の4系統から自動で除外される。
  公式の「If the Rewards run out, that does not count towards the game end」「may not be bought」「not in Black Market deck」「Horn of Plenty で取れない」は**すべて既存機構で満たされる**。
- **「They can be gained from other places normally」**＝廃棄置き場からの獲得（待ち伏せ/墓暴き/リッチ/物色等）は通る。
  `gainFromOutside` は NON_SUPPLY を見ないので自動で正しい。**廃棄した褒賞は褒賞の山に戻らない**＝`trashCard` は supply を触らないので自動で正しい。
- ⚠ **「山に戻す」系（交易商人/取り替え子/大使/無謀な/濡女/馬・チョウの習性）**：`canReturnToPile` は `state.supply` にキーがあれば true を返す＝褒賞は **supply の数値キーを持つので「戻せる」と判定され、実際に `supply[id] += 1` で山が増える**。
  公式は「Trashed Rewards … do not return」（廃棄の話）で、**獲得の置換（交易商人＝Exchange）についての褒賞固有の裁定は見つからない**。Loot の前例（`If you exchange a gained Loot (e.g. with Changeling), the Loot goes back on top of the pile`）と同じ一般則＝**元の山へ戻る**のが素直。ただし §0-40 の注意どおり **大使(Ambassador)の「サプライに戻す→全員が獲得」は `!NON_SUPPLY.has(id)` で褒賞を弾くこと**（戻せても「サプライの山」ではない＝大使の対象外）。
- **`maskStateFor`**＝`supply` は公開のまま（clone）＝褒賞の残枚数は公開情報で正しい（山は表向き・各自が選んで取る）。
- **UI**＝`js/ui.js:1369` の `nonSupplyIds` は `DOM.POOLS.prizes` 等を列挙しているが **`DOM.POOLS.rewards` が入っていない**＝このままだと褒賞の山が盤面に出ない。`(DOM.POOLS && DOM.POOLS.rewards) || []` を足すこと（残枚数が見えないと Joust で属州を脇に置く判断ができない）。
- **CPU**＝`GAIN_ORDER` は `NON_SUPPLY_SET` なので末尾のままでよい（cpu.js:117 コメントどおり）。**`chooseAction` に6種を登録**しないと CPU が手札に来ても一度も使わない（§0-37 で名指しされた罠）。

---

## 1. Coronet（小冠・アクション-財宝-褒賞）

### 1-1. 英語カード文（現行逐語・区切り線0本）
> You may play a non-Reward Action from your hand twice.
> You may play a non-Reward Treasure from your hand twice.
> *(This is not in the Supply.)*

### 1-2. 版
Versions 表は **Second edition（March 2024）の1行だけ**（Print/Digital とも印刷済み）。**エラッタなし**。

### 1-3. Official FAQ（逐語）
> Playing either type of card is optional; you can play an Action twice, play a Treasure twice, do both, or do neither.
> If you do both, you play the Action first.
> This can't play Rewards.
> Playing a card twice with this means playing the card, resolving that completely, then playing the same card again.
> Playing cards with this doesn't use up Action plays for the turn.
> For example you could Coronet a Village and a Silver; you'd get +2 Cards and +4 Actions from the Village plays, and +[$4] from the Silver plays.

### 1-4. Other rules clarifications（逐語）
> If you use Coronet to play an Action card in the Buy phase, that doesn't allow you to continue playing other Actions in the Buy phase after you're finished resolving Coronet, even if the Action you played draws new Actions into your hand and/or gives you +Actions.

### ⚠ 1-5. 実装で危ないところ
- 🛑 **冠(crown)と同型ではない**。冠＝`crownOpenPending` が **`turn.phase` で片方のモードに決める**（engine:1735）。
  Coronet＝**フェイズに関係なく「アクション1枚を2回」→「財宝1枚を2回」の両方**（どちらも任意・FAQ 1行目）。
  wiki 導入文も `can double-play both an Action and a Treasure, in either the Action phase or the Buy phase`。
  → **新 pending を2段で作る**（例 `coronet` stage `'action'` → `'treasure'`）。4点セット必須（reducer＋`PLAYER_ACTIONS`＋CPU `decidePending`＋UI `viewPendingModal`）。
- **順序＝アクションが先**（`If you do both, you play the Action first.`）。**1回目が選択待ちを立てたら2段目は中断**する＝
  アクション側は玉座と同型で `state.replay.push({label:'coronet'})`（2回目は `runReplays`）、**財宝側の窓は「アクションの2回目まで解決し終えてから」開く**＝`state.replay` に**制御項目**（行進の `procession2`/`procession_finish` と同型）を1つ積み、それが消化される瞬間に `coronet` stage `'treasure'` の pending を立てるのが安全（直に2段目を立てると、1回目の選択待ち＝衛兵/金床などで窓が上書きされる）。
- **財宝側の2回目は必ず `'treasure_replay'`**（`applyTreasureEffect` を再適用）。「コインだけ足す」は御守り/水晶玉/愚者の黄金/**Huge Turnip**（褒賞は対象外だが）等で必ず壊れる（§6 の鉄則）。
- **「褒賞でない」の除外**＝候補述語から `DOM.isType(c,'reward')` を外す（アクション側・財宝側とも）。engine 拒否・CPU 候補・UI フィルタの3面を同じ述語に。
- **アクション権を消費しない**（`Playing cards with this doesn't use up Action plays`）＝玉座と同じ（`t.actions` を減らさない）。`t.actionsPlayed` は増やす。
- **購入フェイズに財宝として出した Coronet でアクションを使っても、その後にアクションフェイズへ戻らない**（Other rules）＝
  財宝経路（`playTreasureCard` → `if (card === 'crown')` と同じ位置に `coronet` のフックを置く）で `turn.phase` は `'buy'` のまま、アクション側の2回使用は `playCardNoAction` 相当で場に出して `applyEffect`。**「+アクションを得ても続けて使えない」は本エンジンでは自動**（購入フェイズに `PLAY_ACTION` は受理されない）。
- 🛑 **Coronet 自身は財宝でもある**＝購入フェイズに `PLAY_TREASURE` で出せる／`PLAY_ALL_TREASURES` にも拾われる。冠と同じく **`PLAY_TWICE_TREASURES` に入れて「最初に出す」**（engine:1126）。後回しにすると手札の財宝が残っておらず「2回使う」が空振りする。
  逆にアクションフェイズに `PLAY_ACTION`（アクション権1消費）で出すのも正。**資本主義(Capitalism)下**の `isTreasureFor` は Action-Treasure なので自動で財宝判定＝冠と同じ挙動でよい。
- **玉座の間/王の宮廷×Coronet**＝2回目は `runReplays` → `applyEffect('coronet')` → 再び2段窓が開く（冠×玉座と同型）。**`_replaying` は命令ではないので選び直し可**（冠と同じ）。
- **群A（影札）**＝アクション側は冠と同じく `handPlayable`（山札の影札も使える）を見る。**財宝側は手札だけ**（冠の据え置きと同じ許容簡略化＝魚屋×資本主義は mix-all 限定）。
- **CPU**＝`crown` の `decidePending`（cpu:2188）を2段に拡張。`okC = canPlayHandCard`（航海の3枚制限/将軍）を両段に通す（玉座と同型＝通さないと engine拒否×CPU提案の livelock）。

---

## 2. Courser（駿馬・アクション-褒賞）

### 2-1. 英語カード文（現行逐語・区切り線0本）
> Choose two different options: +2 Cards; +2 Actions; +[$2]; gain 4 Silvers.
> *(This is not in the Supply.)*

### 2-2. 版
Second edition（March 2024）のみ。**エラッタなし**。Trusty Steed の「山札を捨て札にする」が**削られた**版（wiki 導入文＝`drops Trusty Steed's deck discarding ability for the sake of simplicity`）。

### 2-3. Official FAQ（逐語・Other rules clarifications の節は無い）
> First choose any two of the four options, then do those options in the order listed.
> So if you choose both +2 Cards and "Gain 4 Silvers," you will draw cards before you gain the Silvers.

### ⚠ 2-4. 実装で危ないところ
- **`TRUSTY_STEED_RESOLVE`（engine:19000）をほぼ丸ごとコピーできる**が、🛑 **`silver` 分岐の「山札を捨て札へ」（`p.discard.push(...p.deck); p.deck = []`）を必ず外す**。Courser には無い。
- **記載順で解決**（`valid.filter((c) => ch.includes(c))`＝選択順ではない）＝既存実装と同じ。**+2カードが銀貨4枚より先**（引いてから獲得＝リシャッフルの母集団に銀貨が入らない）。
- **「異なる2つ」**＝ちょうど2・重複不可（`ch.length !== 2` で拒否）。候補は常に4つあるので終端保証は自明（選択肢が無くなることはない）。
- **銀貨4枚**＝`gain` を4回。**銀貨の山が足りなければ取れるだけ**（`gain` が false を返す）。**獲得時対話**（望楼/交易商人/牧羊犬等）は `_gainDepth` ゲートで1回目だけ開く既存簡略化のまま。
- **長老(Elder)の「追加で異なるもの1つ」**＝これは「2つ選ぶ」カードなので長老の対象外のはず（公式の長老FAQ＝choose-one のカードが対象）。`ELDER_CHOICE_ORDER` に登録しない。
- CPU＝`trusty_steed` の分岐（cpu:3117）をコピー（`['cards', hasAction ? 'actions' : 'coins']`）。
- UI＝`trusty_steed` のモーダル（4択から2つ）を流用。

---

## 3. Demesne（御料地・アクション-勝利点-褒賞）

### 3-1. 英語カード文（現行逐語・**区切り線1本**＝`Gain a Gold.` の直後）
> +2 Actions
> +2 Buys
> Gain a Gold.
> ――――――――
> Worth 1VP per Gold you have.
> *(This is not in the Supply.)*

### 3-2. 版
Second edition（March 2024）のみ。**エラッタなし**。

### 3-3. Official FAQ（逐語・Other rules clarifications の節は無い）
> When you play this, you get +2 Actions, +2 Buys, and gain a Gold.
> When scoring, this is worth 1VP per Gold you have then.

### ⚠ 3-4. 実装で危ないところ
- **プレイ効果**＝`addActions(t,2); t.buys += 2; gain(state, pi, 'gold', 'discard')`（金貨の山が空なら何も起きない）。
- 🛑 **可変VP**＝「所持する金貨」＝**`allCards(p)` 全体**（手札・山札・捨て札・場・脇・マット…）。
  `vpOf`（engine:8872）に `const demesnes = cards.filter(c=>c==='demesne').length; if (demesnes) vp += demesnes * cards.filter(c=>c==='gold').length;`
  **CPU `vpOfPlayer`（cpu:802）にも同じ1行**（乖離すると hard CPU の終局読みがズレる＝§0-37 ③ の再発）。
  `vp:` 固定値は**持たせない**（封土 feodum と同型）。
- **`'gold'` は id 完全一致**でよい（**金貨の名前を持つカードは基本の金貨だけ**。護符/玉璽/金貨袋は別カード）。
- **勝利点種別**＝`DOM.isType('demesne','victory')` が真＝**絹の道/納屋/狩人/品評会/塩まき/十字路/総督…の「勝利点カード」判定に自動で入る**（正しい）。**Joust で手札に獲得**するので納屋(hovel)の on-gain（勝利点獲得→納屋廃棄）も発火する（公式どおり）。
- **3人以上で同じ褒賞を2枚**＝Demesne 2枚なら金貨1枚につき 2VP（各1枚ごとに数える＝`demesnes *`）。

---

## 4. Housecarl（ハスカール・アクション-褒賞）

### 4-1. 英語カード文（現行逐語・区切り線0本）
> +1 Card per differently named Action card you have in play.
> *(This is not in the Supply.)*

### 4-2. 版
Second edition（March 2024）のみ。**エラッタなし**。

### 4-3. Official FAQ（逐語・Other rules clarifications の節は無い）
> This includes Housecarl itself.

（Trivia「Why only Actions?」＝Donald X. の発言＝財宝は数えない理由の雑談。ルールではない）

### ⚠ 4-4. 実装で危ないところ
- **数える集合＝「場に出している」アクションカード**＝**`p.inPlay` ＋ `p.durationCards`**（前ターンから場に残る持続も「場にある」。豊穣の角 `horn_of_plenty` の `new Set(p.inPlay.concat(p.durationCards || []))` と同じ形）。
- **自分自身を含む**（FAQ）＝`applyEffect` が呼ばれる時点で Housecarl は既に `inPlay` にある（`PLAY_ACTION` は push してから効果）。**命令（船長/大君主/王子/川船）経由では場に出ないので自分を数えない**＝公式どおり（命令は「場に出さずに使う」）。
- **種別判定**＝「アクションカード」＝`isActionFor(state, c)`（悟り(Enlightenment)下では財宝もアクション＝米/稽古と同じ動的判定）。`DOM.isType` の静的判定だと旭日×悟りで内部不整合になる（§0-37 の蓄積/海上交易の轍）。**相続した屋敷**（`inheritedEstate`）も「アクションカード」＝数える（`typesFor` と同じ扱い）。
- **名前の異なる**＝`new Set(ids).size`（id 単位）。**混合山の中身**（騎士各種/城）は id が違うので別名＝正しい。
- **ドロー0枚は正常系**（絵師と同じ）。`draw(state, pi, n)` 1回＝**カメレオンの習性の変換対象**（`+N Cards` 型なので変換されるのが公式）。
- 玉座×Housecarl＝2回目も場の状況で数え直す（`applyEffect` 再実行で自動）。

---

## 5. Huge Turnip（大きなかぶ・財宝-褒賞）

### 5-1. 英語カード文（現行逐語・区切り線0本）
> +2 Coffers
> +[$1] per Coffers you have.
> *(This is not in the Supply.)*

### 5-2. 版
Second edition（March 2024）のみ。**エラッタなし**。

### 5-3. Official FAQ（逐語・Other rules clarifications の節は無い）
> The +[$1] per Coffers you have includes the 2 you just got.

### ⚠ 5-4. 実装で危ないところ
- 🛑 **順序＝先に +2財源、その後に「持っている財源」を数える**（FAQ）＝**最低でも +$2**。
  財宝なので **`applyTreasureEffect`（engine:1326）に書く**（`applyEffect` は財宝では呼ばれない＝§0-25 の轍）。
  `p.coffers = (p.coffers||0) + 2; addCoins(state, p.coffers);`。**`coin: 0` のまま**（カタログどおり）＝`treasureCoins` は 0 を返し、効果側で動的に足す（宝冠 diadem / 愚者の黄金と同じ形）。
- **冠/ティアラ/偽造通貨/王の隠し財産/Coronet の2回目**＝`'treasure_replay'` → `applyTreasureEffect` が再び走る＝**2回目はさらに +2財源して（4→）4以上を数える**＝公式の「resolving that completely, then playing the same card again」どおり自然に正しい。
- **-$1トークン**（`applyCoinPenalty`）・**追いはぎ**（記載効果を丸ごとスキップ＝財源も増えない）・**嫉妬**（銀貨/金貨限定＝対象外）は既存の共通経路で自動。
- **財源の公開性**＝`p.coffers` は公開スカラー（マスク不要）。
- ⚠ **既存の取りこぼし（Huge Turnip とは独立・記録のみ）**＝英語wiki `Coffers` Other rules clarifications 逐語：
  > Coffers could originally only be spent at the beginning of the Buy phase. This was changed in 2021 to the current rule of allowing them to be spent at any time during your turn.

  本アプリの `COFFERS_SPEND`（engine:19043）は `t.phase !== 'buy'` で拒否＝**2021年エラッタ前の挙動**（UI のボタンも購入フェイズのみ）。Huge Turnip の額は「使う前に数える」だけなので Huge Turnip 自体には影響しないが、**「アクションフェイズに財源を使って肉屋/石工の支払いに充てる」等が公式より狭い**＝ギルド側の別課題として PROGRESS に残すべき。
- **CPU**＝`coffersToSpend` は「買いが良くなる最小枚数」だけ使う設計＝Huge Turnip を持つと「温存」が得になる局面があるが、CPU は財源を見て額を増やす評価を持たない（許容）。
- **PLAY_ALL_TREASURES の順序**＝財源を増やす他の財宝は無いので順序依存なし（`playAllOrder` 既定でよい）。

---

## 6. Renown（名声・アクション-褒賞）

### 6-1. 英語カード文（現行逐語・区切り線0本）
> +1 Buy
> This turn, cards cost [$2] less.
> *(This is not in the Supply.)*

### 6-2. 版
Second edition（March 2024）のみ。**エラッタなし**。wiki 導入文＝`functionally identical to Princess … The only difference is the card type—Reward vs. Prize—and the fact that two copies of Renown exist in games of three or more players.`
⚠ ただし **Princess 自身は 2022 年に "while this is in play" → "this turn" へ機能エラッタ済み**（総論ページ Versions＝`Princess — Changed "while this is in play" to "this turn" (2022)`）＝「同一」なのはエラッタ後の Princess。

### 6-3. Official FAQ（逐語・Other rules clarifications の節は無い）
> Costs can't go below [$0].
> This applies to all cards everywhere - cards in the Supply, cards in hand, cards in decks.
> For example if you play Renown and then Remake, trashing a Copper, you could gain a Silver, as Silver would cost [$1] while Copper would still cost [$0].
> Using a card like Throne Room on Renown will make cards cost [$4] less.

### 6-4. 関連＝過払いとの関係（RGG 2E ルールブック p.3「Overpay」逐語）
> Reducing the costs of cards via cards like Renown does not make overpaying cheaper; for example if you had [$5] and two Renowns in play and bought Farrier, Farrier would cost [$0], and overpaying with your [$5] would still only give you +5 Cards at end of turn.

### ⚠ 6-5. 実装で危ないところ
- 🛑 **王女(princess)の実装をコピーしてはいけない**。本アプリの `cardCost`（engine:883-885）は **`active.inPlay` の王女の枚数**で -2 している＝「場にある間」型＝**2022年エラッタ前の旧 Princess**。
  Renown（＝現行 Princess）は **「このターン」型＝`t.costReduction += 2`（橋/街道の `t.costReduction` と同じ）**。
  違いが出る例＝**玉座×Renown＝-$4**（FAQ逐語。inPlay 枚数方式だと -$2 にしかならない）／**命令（船長/大君主/王子）で Renown を使った場合**（場に出ないので inPlay 方式は0）／**Renown が場を離れても（増築/鉱山道路…）そのターンは効き続ける**。
  ⚠ 副産物＝**出荷済みの `princess` も同じ理由で公式（2022エラッタ・`random-cornucopia`/`cornucopia` で到達）と違う**＝PROGRESS の宿題に載せる価値あり（Renown と同時に `princess` を `t.costReduction` 方式へ寄せれば1箇所で済む）。
- **$0 未満にしない**＝`cardCost` 末尾の `Math.max(0, base - red)` で自動。**コイン成分だけ**（ポーション/負債は下げない＝`t.costReduction` の既存挙動）。
- **全カード・どこにあっても**（サプライ/手札/山札）＝`cardCost` は場所を問わないので自動（改築/Remake 等の廃棄カードのコスト参照も下がる＝FAQ の Remake 例が自然に成立）。
- **過払い額は下がらない**（ルールブック）＝`BUY` の過払い判定は「実際に払った額 − `cardCost`」で計算されるはず＝Renown 2枚で装蹄師 $0 のとき $5 払えば過払い5＝**「コストが下がっても過払いは安くならない」は自然に成立**。実装後に `maybeStartOverpay` の計算式が `cardCost` を引いた残りを使っていることを再確認する。
- **得点計算には効かない**（`scoringCost` は `t.costReduction` を拾わない＝公式＝安価な/盛大な取引だけが得点に効く）。
- **+1購入**＝`t.buys += 1`。CPU＝`princess` の位置（cpu:544）に `renown` を追加。

---

## 実装前に必読（この群に共通する罠）

1. 🛑 **褒賞の枚数は各1枚ではない**＝**2人戦＝各1／3〜6人戦＝各2（計12）**。`initSupply` で `kingdom.includes('joust')` のとき `supply[id] = numPlayers >= 3 ? 2 : 1`。現 engine/cards のコメント「各1枚」は訂正する。
2. **非サプライの数値キー山**＝賞品 Prizes と同型。**`REWARDS` は既に `NON_SUPPLY`／cpu `NON_SUPPLY_SET` に入っている**ので 4系統（3山終了・購入・闇市場デッキ・汎用獲得）は自動除外。**UI の `nonSupplyIds`（ui.js:1369）に `DOM.POOLS.rewards` を足す**のを忘れない（足さないと褒賞の山が盤面に出ない）。
3. **獲得経路は Joust のみ（山から）＋廃棄置き場からの獲得は通常どおり**。**廃棄した褒賞は山に戻らない**（自動）。「山に戻す」系は `canReturnToPile` が true を返す（supply キーあり）＝Loot と同じく**元の山へ戻る**扱いでよいが、**大使(Ambassador)の対象からは `!NON_SUPPLY.has(id)` で外す**。
4. **Coronet は冠の単純流用ではない**＝フェイズに依らず「アクション→財宝」の2段。1段目が選択待ちを立てても2段目が潰れないよう **`state.replay` の制御項目で2段目を開く**。財宝の2回目は必ず `'treasure_replay'`。**`PLAY_TWICE_TREASURES` に登録**（最初に出す）。「褒賞でない」除外は engine/CPU/UI の3面で同じ述語。
5. **Courser は `TRUSTY_STEED_RESOLVE` から「山札を捨て札へ」を外したもの**。記載順解決・異なる2つ。
6. **Demesne の VP は `allCards` の金貨数 × 枚数**＝`vpOf` と CPU `vpOfPlayer` の両方に1行。`vp:` 固定値は持たせない。
7. **Housecarl は `inPlay + durationCards` の `isActionFor` 動的判定で id の種類数・自分を含む**。命令経由では自分を数えない（公式どおり自然にそうなる）。
8. **Huge Turnip は `applyTreasureEffect` に書く**＝**先に +2財源、その後 `addCoins(p.coffers)`**。`coin:0` のまま動的加算。2回目の再演でさらに +2 して数え直すのが公式。
9. 🛑 **Renown は `t.costReduction += 2`（橋型）で書く。王女(`inPlay` 枚数型)をコピーしない**（玉座で -$4 になれないと公式違反）。**出荷済みの `princess` も 2022 エラッタで同じ「このターン」型になっている**＝一緒に直すのが効率的（PROGRESS に記録）。
10. **新 pending は必ず4点セット**（reducer＋`PLAYER_ACTIONS`＋CPU `decidePending`＋UI `viewPendingModal`）。**CPU の `chooseAction` に6種を登録**しないとソークで一度も使われない。
11. 記録事項（本群の副産物）＝**財源は 2021 年以降「ターン中いつでも」使える**が、本アプリの `COFFERS_SPEND` は購入フェイズ限定＝既存のギルド側の忠実性差。

---

### 一次資料の所在（scratchpad・再取得可）
- 英語wiki 本文＝`…/scratchpad/cg2raw/rewards.txt`（6種）／`exp.txt`（総論・Reward・Joust）／`coffers.txt`、生HTML＝`raw_*.html`
- RGG 2E ルールブック＝`…/scratchpad/cg2raw/cg2023.pdf`（wiki `/images/5/5f/Cornucopia_%26_GuildsRulebook2023.pdf`）＋ `cg2023.txt`（pdftotext -layout）
- 参照した本アプリ側の箇所＝`js/engine.js` 15-34（REWARDS/NON_SUPPLY）・883-885（王女のコスト）・1126（PLAY_TWICE_TREASURES）・1326（applyTreasureEffect）・1735/19872（冠）・1945（賞品の initSupply）・2893-2920（returnToPile/canReturnToPile）・8872（vpOf）・19000（TRUSTY_STEED_RESOLVE）・19043（COFFERS_SPEND）／`js/cpu.js` 147・802・2188・3117／`js/ui.js` 1369・3591／`js/cards.js` 1729-1740・1991-1997