# 帝国（Empires）段階2 実装のための公式ルール研究＋バッチ計画

2026-07-08 作成。段階1（画像・カタログ・GAIN_ORDER）は §0-6 で完了済み。本書は段階2（実プレイ化）の基盤。
裏取り元＝ultraboardgames（公式ルール転記）＋Dominion Strategy Wiki（Anubis で WebFetch 不可・WebSearch 経由）＋RGG公式PDF。
**設計図は `docs/adding-cards.md`。再利用テンプレは既存コードにある（下記「再利用」）。**

対象＝縦型カード36枚（王国18＋分割両面10＋城8）。横型ランドスケープ（イベント/ランドマーク）は縦枠パイプライン未対応＝**対象外**（段階1すら未着手）。

---

## 1. 新機構と検証済みルール（要）

### 1-1. 負債（Debt）経済 ★foundational
- `debt` コスト（オレンジ六角）を持つカードを**購入または獲得**すると、その数だけ**負債トークン**を負う（`p.debt` スカラー）。
- **負債トークンがある間はカードもイベントも購入できない**（それ以外の効果は無い。**ゲーム終了時に減点にはならない**）。
- 返済＝**自分の購入フェイズ**に、財宝をプレイした後、**$1につき負債1個**を返す。**購入の前でも後でも・交互でもよい**。**購入権（Buy）は消費しない**。
- 負債を全部返すまで購入不可＝実質「負債を負ったら次に買う前に返す」。
- コスト軽減（橋/公共広場のコイン部分等）は**コイン費用のみ**軽減し**負債は軽減しない**（コインと負債は別建て）。
- 該当カード＝engineer(d4)/city_quarter(d8)/overlord(d8)/royal_blacksmith(d8)/fortune($8+d8)。**capital** は財宝で、**場から捨てるとき負債6を負い可能な限り即返済**。
- 実装：`p.debt` スカラー（公開・VP無関係＝coffers 型）。BUY 冒頭で `p.debt>0` なら拒否。負債コストカードの gain/buy 末尾で `p.debt+=debt`。新 action `REPAY_DEBT`（購入フェイズ・コインで返済）。UI に負債バッジ＋返済ボタン。CPU は購入前に自動返済（`coffers` 消費の隣に）。

### 1-2. 集合（Gathering）＝サプライ山上のVPトークン ★new
- 一部アクション（種別 Gathering）は**自分のサプライ山の上にVPトークンを置く**。VPトークンは**そのアビリティが取り去るまで山に残る**。その山からカードを獲得したら**トークンは次のカードへスライド**（＝山に残り続ける・獲得者は取らない）。
- 実装：`state.pileVP = { [pileId]: 個数 }`（公開・非カード＝保存則に無関係）。maskStateFor は Object.assign で残る。
- 該当＝farmers_market/temple/wild_hunt（各々「自分の山」= 'farmers_market'/'temple'/'wild_hunt' のsupplyキー上に置く）。
  - **temple**：獲得時（購入含む）に**その山のVPを全部自分の vpTokens へ**。プレイ時＝vpTokens+1、手札から**名前の異なる1〜3枚**廃棄、山にVP+1。
  - **farmers_market**：+1購入。山のVPが**4個以上**なら全部得て farmers_market を廃棄。そうでなければ山にVP+1、その後**山のVP1個につき+1コイン**（＝置いた後に数える＝初回+1コイン、2回目+2…4個で全取得＝1+2+3、次は4個以上で全取得＋廃棄）。
  - **wild_hunt**：二択。(a)+3カード＆山にVP+1。(b)屋敷1枚を獲得し、獲得したら**山のVPを全部得る**（屋敷山が空なら b を選べるがVPは得られない）。
- **プレイヤーVPトークン `p.vpTokens` は既存**（繁栄で実装済＝司教/記念碑/収集）。vpOf に加算済み。集合は「山側のVP」だけが新規。

### 1-3. 分割山（Split pile）＝上5＋下5 ★reuse sauna/avanto
- 5組：encampment/plunder・patrician/emporium・settlers/bustling_village・catapult/rocks・gladiator/fortune。
- 各**上5枚・下5枚**（計10枚1山枠）。**上が尽きるまで下は取れない**。安い方が上。
- 実装＝sauna/avanto と同型（`js/engine.js:266,384-386,486` 参照）。4系統ガード（gain冒頭/canBuyCard/emptyPileCount ペアで1山/CPU splitBlocked）。`DOM.randomKingdom` は下→上に正規化。createInitialState で相互補完。**上下でコストが違う**点だけ sauna/avanto（両方$4）と異なる＝cardCost はカード固有でOK（分割山でコスト参照は「今取れる方」）。

### 1-4. 城（Castles）＝混合順序山 ★reuse knights
- 8種を**コスト昇順で積む**（Humble$3→Crumbling$4→Small$5→Haunted$6→Opulent$7→Sprawling$8→Grand$9→King's$10）。**一番上（＝今の最安）だけ購入・獲得できる**。
- **2人＝各1枚（計8枚）**。**3人以上＝計12枚**（Humble/Small/Opulent/King's を**各2枚**、Crumbling/Haunted/Sprawling/Grand は各1枚）。順序は昇順を維持（同コスト2枚は連続）。
- 城は勝利点（humble/kings は所有城数で可変VP）。実装＝knights 混合山と同型（`state.castles` = top-level id 配列・isMixed 分岐に castles 追加・invariants tally に forEach(add)・maskで先頭のみ公開・emptyPileCount に +（空なら1））。**cardCost('castles')=先頭の実コスト**（knights と同じ可変）。
- **可変VP**：humble_castle=所有する城1枚につき1点／kings_castle=所有する城1枚につき2点（vpOf に城カウント項を追加）。他は固定 vp。

### 1-5. 命令（Command）＝overlord / crown ★reuse band_of_misfits・throne
- **overlord**（d8）：サプライのコスト5以下・**非命令アクション**1枚を、そのカードとして**サプライに残したまま**使う。band_of_misfits/captain と同型（`captainTargets`/`bandOfMisfitsTargets` 型・上限=コスト5固定）。自己移動系（採掘村の自己廃棄等）は removeOne 失敗で自然不発。**持続カードは対象外**（船長/はみだし者と同じ簡略化＝場に残らないと持続予約が宙に浮く）。
- **crown**（$5・action+treasure）：**アクションフェイズなら手札のアクション1枚を2回プレイ／購入フェイズなら手札の財宝1枚を2回プレイ**。玉座と同型（`state.replay` 1件push）だが**現在フェイズで対象種別が変わる**。アクション権は消費しない。
- 命令カードは `types` に 'command' 済み（overlord）。crown は action+treasure。

### 1-6. villa ★new（フェイズ復帰）
- +2アクション+1購入+1コイン、**これを手札に加える**。
- **獲得時**：手札に加え+1アクション。**購入フェイズ中に獲得したなら、アクションフェイズに戻る**（＝購入フェイズ→アクションフェイズへ巻き戻し・複数回可）。自分のアクションフェイズ中の獲得なら手札+1アクションのみ。相手ターン中の獲得なら手札へ入るだけ。
- 実装：on-gain フックで dest='hand'＋t.actions+=1、`t.phase==='buy' && pi===active` なら `t.phase='action'`（購入フェイズで得たコイン/購入権は保持＝公式）。フェイズ管理を確認（現状 phase の持ち方＝要調査）。

---

## 2. バッチ計画（安全順＝新機構の少ない・foundationalを先に）

各バッチ＝研究（個別裁定の最終確認）→実装（4点セット＋終端保証）→狙い撃ち `_*.tmp.js`→`node test/invariants.test.js` 緑→`npm test` 全緑→多エージェント敵対レビュー→コミット。

- **E1＝負債経済の基盤＋純負債カード**：`p.debt`＋BUY拒否＋REPAY_DEBT＋UI/CPU。カード＝engineer/city_quarter/royal_blacksmith/capital。
- **E2＝既存VPトークン＆単独カード**：sacrifice（廃棄→種別別ボーナス＝VPも）・chariot_race（コスト比較→VP）・groundskeeper（場にある間 勝利点獲得毎VP）・forum（+3カード+1ア-2捨て・on-buy+1購入）・legionary（アタック・金貨公開で手札2に）・enchantress（持続アタック＝相手の最初のアクションを+1c+1aに置換）・archive（持続・3枚脇→3手番かけ1枚ずつ手札）・charm（財宝の二択＝獲得コピー）。
- **E3＝集合（山上VPトークン）**：`state.pileVP`＋farmers_market/temple/wild_hunt。
- **E4＝分割山5組**：sauna/avanto 流用＋10枚の効果（encampment/plunder・patrician/emporium・settlers/bustling_village・catapult[アタック]/rocks[on-gain/trash銀貨]・gladiator[左隣公開]/fortune[負債+コイン2倍+on-gain金貨]）。
- **E5＝城8（混合山）**：knights 流用＋各on-gain/可変VP（humble/kings=城数VP・small=trash→城獲得・haunted/grand/crumbling/sprawling=on-gain効果・opulent=勝利点捨てて+2コイン/枚）。
- **E6＝命令**：overlord（band_of_misfits流用・負債）・crown（フェイズ別玉座）。
- **E7＝Phase E＝CARD_SET昇格**：`DOM.KINGDOM_EMPIRES` 固定10種＋`empires`/`random-empires`。全テスト緑→**ユーザー確認の上で** push。

依存の注意：fortune は gladiator 分割山かつ負債＝E1（負債）の後 E4。emporium は patrician 分割山かつ on-gain VP＝E2(VP)の後 E4。capital の on-discard 負債は E1 で cleanup フックを作る。

---

## 3. 個別カードの裁定・実装メモ（バッチ着手時に該当を再確認）

- **engineer**：コスト4以下1枚獲得（強制）→ engineer を廃棄してよい（任意）、廃棄したらもう1枚≤4獲得。玉座2回目は場に engineer が無いので2回目の自己廃棄は不発（band_of_misfits/procession と同型 removeOne チェック）。**`!NON_SUPPLY.has(id)` を anyGainable/canGain 両側に**。
- **city_quarter**：+2アクション。手札を公開しアクション1枚につき+1カード（公開後に引く＝公開した手札のアクション枚数で数える。city_quarter自身は場に出ているので手札にない）。
- **royal_blacksmith**：+5カード。手札を公開し銅貨を全部捨てる（引いた後の手札の銅貨）。
- **capital**：財宝 +6コイン+1購入。**場から捨てるとき**（cleanup または他効果で場を離れるとき）負債6を負い可能な限り即返済（＝そのターンのコイン残があれば相殺…ではなく、次の購入フェイズに持ち越す負債。cleanup時点ではコインは使い切っているのが普通＝負債6が残る）。実装＝cleanupAndAdvance の inPlay 捨て処理でフック。
- **fortune**（分割山下・E4）：+1購入。**このターンまだ fortune をプレイしていなければコインを2倍**（`t.fortunePlayed` 旗）。**獲得時**：場の剣闘士1枚につき金貨1枚獲得。
- **chariot_race**：+1アクション。山札の一番上を公開し手札に加える。左隣も山札の一番上を公開（**公開するだけ＝山札の上に戻す**）。**自分の（手札に入れた）カードのコスト＞左隣の公開カードのコスト**なら+1コイン＋VP1個（同コスト・安いは無し）。左隣が山札0枚なら公開なし＝比較でこちらが勝ち（相手コスト無し扱い＝+1コイン+VP）。
- **enchantress**（持続アタック・E2）：即時効果なし。次の自手番まで、他の各Pが**その手番で最初にプレイするアクションカード**は記載効果の代わりに**+1カード+1アクション**になる（1回だけ）。次の自手番開始時+2カード。実装＝相手の PLAY_ACTION に「今手番でまだ置換していない＆enchantress 予約あり」なら effect を置換。堀で防げる（アタック）。
- **archive**（持続・E2）：+1アクション。山札上3枚を裏で脇へ。**今回含め3回**の手番開始時に脇を見て1枚手札へ（dungeon/hireling 型の複数手番持続＋脇置き）。
- **charm**（財宝・E2）：二択。(a)+1購入+2コイン。(b)このターン次に**カードを獲得したとき**、それと**同コストで名前の異なる**カード1枚を獲得してよい（on-gain 一回フック＝duplicate/charm 型）。
- **sacrifice**（E2）：手札1枚廃棄→アクションなら+2カード+2アクション／財宝なら+2コイン／勝利点なら VP2個（複数種別は全適用＝城やハーレム等）。空手札なら不発。
- **groundskeeper**（E2）：+1カード+1アクション。**場にある間、勝利点カードを獲得するたびVP1個**（on-gain フック＝場にgroundskeeperがある数だけ？公式は「これが場にある間」＝1枚につき発火＝場に2枚なら勝利点獲得毎+2VP）。
- **forum**（E2）：+3カード+1アクション、手札2枚捨て。**購入時+1購入**（on-buy＝mint 型 BUY インライン）。
- **legionary**（アタック・E2）：+3コイン。手札の金貨1枚を公開してよい。公開したら他の各Pは**手札2枚になるまで捨て、その後1枚引く**。金貨非公開なら無効果（アタック不発）。
- **temple/farmers_market/wild_hunt**（集合・E3）：§1-2。**temple の獲得時VP全取得は on-gain**（自分/相手どちらが獲得しても取得者が得る）。
- **encampment**（分割山上・E4）：+2カード+2アクション。手札から金貨か鹵獲品を公開してよい。**公開しない場合、脇へ置きクリンナップ開始時にサプライに戻す**（陣地は消える＝獲得でなくサプライへ返却）。玉座×陣地の返却は1枚のみ（lose track）。
- **plunder**（分割山下・E4）：財宝 +2コイン+1VP（プレイ毎にVPトークン1）。
- **patrician**（分割山上・E4）：+1カード+1アクション。山札の一番上を公開しコスト5以上なら手札へ（安ければ山札上に残す）。
- **emporium**（分割山下・E4）：+1カード+1アクション+1コイン。**獲得時、場にアクション5枚以上なら+2VP**（on-gain）。
- **settlers**（分割山上・E4）：+1カード+1アクション。捨て札から銅貨1枚を手札へ（任意）。
- **bustling_village**（分割山下・E4）：+1カード+3アクション。捨て札から開拓者1枚を手札へ（任意）。
- **catapult**（分割山上・アタック・E4）：+1コイン。手札1枚廃棄。廃棄カードのコスト3以上なら他全Pが呪い獲得。廃棄カードが財宝なら他全Pが手札3枚になるまで捨て（両方満たせば両方）。
- **rocks**（分割山下・E4）：財宝+1コイン。**獲得または廃棄したとき銀貨1枚獲得**（購入フェイズ中なら山札の上へ、そうでなければ手札へ）。
- **gladiator**（分割山上・E4）：+2コイン。手札1枚公開。左隣は同じカードを公開してよい。**公開されなかったら+1コイン＆サプライから剣闘士1枚を廃棄**（＝分割山の上を1枚減らす→尽きたら fortune が見える）。
- **villa**（E2 or 単独）：§1-6。
- **城8**（E5）：§1-4。small_castle=これか手札の城1枚を廃棄→城1枚獲得。opulent=手札の勝利点を任意枚数公開して捨て、1枚につき+2コイン。crumbling=獲得/廃棄時+1VP＆銀貨1。haunted=自手番に獲得時 金貨1＆他Pは手札5枚以上なら2枚を山札上へ。sprawling=獲得時 公領1 or 屋敷3。grand=獲得時 手札公開、手札＋場の勝利点カード1枚につき+1VP。

---

## 4. 再利用テンプレ（実コードの場所）
- **スカラー（負債の型）**：`p.coffers`（`js/engine.js:354` init／`3275,3329` 付与／`COFFERS_SPEND` 消費）・`p.minusCoin`（`362,4528`）。
- **山上VPの下敷き**：`p.vpTokens`（`353` init／`vpOf` `3762` 加算）。
- **分割山**：`js/engine.js:266,384-386,486`（sauna/avanto）＋CPU `splitBlocked`。
- **混合山**：`js/engine.js:43-44,480-499`（isMixed knights/ruins・`state.knights`）＋invariants tally。
- **命令**：`captainTargets` `js/engine.js:2082`／`band_of_misfits` `2770`／`state.replay`＋`runReplays` `4373`。
- **持続**：`armDuration`／`DURATION_RESOLVERS`／`resolveDurationStartEffects`／startQueue 安全網（reduce末尾）。
- **on-gain 対話ゲート**：`_gainDepth===1 && !pending && pi===turn.active`。

---

## 出典
- UltraBoardGames「How to play Dominion: Empires」 https://www.ultraboardgames.com/dominion/empires.php （＋ additional-rules / card-descriptions）
- Dominion Strategy Wiki（WebSearch 経由）: Debt / Castle / Split pile
- RGG 公式PDF: https://www.riograndegames.com/wp-content/uploads/2022/03/Dominion-Rules-Empires.pdf
