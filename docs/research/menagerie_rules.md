# 移動動物園（Menagerie）公式ルール研究 — 実装の正本

多エージェント研究＋敵対検証（各群を別エージェントが一次資料で再確認）で確定したデータ。
**カタログ（`js/cards.js`）と engine を書くときは、記憶ではなくこの文書を見ること。**

- 一次資料＝RGG 公式ルールブック PDF（逐語確認）／英語ウィキ（Wayback 経由）／日本語 wiki（wikiwiki.jp/dominiondeck）／ホビージャパン
- 内訳＝**王国30種＋馬(Horse)30枚＋イベント20種＋ウェイ（習性）20種**（ランダマイザー30を含めて公式の400枚と一致）
- **「Way」の日本語公式訳は「習性」**（"ウェイ" ではない）。拡張名は「移動動物園」。
- **注意：日本語の「移動動物園」は収穫祭の `menagerie`（$3 アクション）のカード名でもある**。拡張名と衝突するので id / 表示で区別すること。

## 0. ロースター

```
王国30: Animal Fair, Barge, Black Cat, Bounty Hunter, Camel Train, Cardinal, Cavalry, Coven, Destrier, Displace, Falconer, Fisherman, Gatekeeper, Goatherd, Groom, Hostelry, Hunting Lodge, Kiln, Livery, Mastermind, Paddock, Sanctuary, Scrap, Sheepdog, Sleigh, Snowy Village, Stockpile, Supplies, Village Green, Wayfarer
イベント20: Alliance, Banish, Bargain, Commerce, Delay, Demand, Desperation, Enclave, Enhance, Gamble, Invest, March, Populate, Pursue, Reap, Ride, Seize the Day, Stampede, Toil, Transport
ウェイ20: Way of the Butterfly, Way of the Camel, Way of the Chameleon, Way of the Frog, Way of the Goat, Way of the Horse, Way of the Mole, Way of the Monkey, Way of the Mouse, Way of the Mule, Way of the Otter, Way of the Owl, Way of the Ox, Way of the Pig, Way of the Rat, Way of the Seal, Way of the Sheep, Way of the Squirrel, Way of the Turtle, Way of the Worm
非サプライ: Horse (30 cards)
```

王国カード30種（各10枚＝300枚）／馬(Horse)30枚／イベント20種20枚／ウェイ（習性）20種20枚／ランダマイザー30枚 ＝ 合計400枚（300+30+20+20+30=400、公式記載と一致）。カード以外＝追放(Exile)マット6枚・プラスチックトレイ1・インレイ1・ルールブック1。公式ルールブックの Contents 逐語＝「400 cards / 300 Kingdom cards（10 each of <30種>）/ 30 Horses, 20 Events, 20 Ways / 30 Randomizer cards / 1 Plastic organizer tray, 1 Organizing Inlay / 6 player Exile mats / 1 Rule booklet」。発売時（2020年）から種類数の増減なし。

<details><summary>ロースター調査のメモ（信頼度・エラッタ・日本語名の出典）</summary>

【裏取りの実際／confidence】
- 指定された英語wiki（wiki.dominionstrategy.com）と両ミラー（miraheze / fandom）は**すべてアクセス不能**（Anubis のbot検知チャレンジ／403／402）。そこで**それより強い一次資料＝RGG公式ルールブックPDF**を実DLして pdftotext で逐語確認した：https://www.riograndegames.com/wp-content/uploads/2020/01/DominionMenagerie.pdf （2025年改訂刷 "DommenagerieRules2025"）。
- **confidence: high**（王国30／イベント20／ウェイ20／馬30／総数400）。理由＝①公式ルールブックの Contents に30種が名前入りで列挙、②同ルールブックのカード個別解説の見出しから独立に抽出しても 王国30＋イベント20＋ウェイ20 で完全一致、③足し算が公式の400枚とぴったり一致、④日本語版の対訳表・日本語wikiの習性一覧（20種）とも1対1一致。計4系統が一致。
- **confidence: medium** ＝エラッタ節の網羅性。All_Errata ページ本体を開けず、検索スニペット経由でしか確認できていないため「Menagerie のエラッタはこれで全部」とは断言しない。下記の1件は本文で裏が取れている。

【エラッタ（実装時に重要）】
- **Way of the Mouse ＝ 2025年エラッタ「持続(Duration)カードは脇に置けない」**。手元の2025年版ルールブック本文が現行文言で確認できた：「Set aside any unused **non-Duration** Action kingdom card costing $2 or $3 at the start of the game.」（旧文言は non-Duration が無い）。※同ルールブックの前段セットアップ節は旧文のまま残っており記載が不統一。**現行＝non-Duration を採用すべき**。
- 「脇に置いたカードは場に無いので自分自身を動かせない」（例：Ratcatcher は酒場マットに行かない）／「区切り線の下のテキスト（setup以外）は働かない」も公式明記。

【日本語版（ホビージャパン）名称】
- **「Way」の公式訳は「習性」**（"ウェイ"ではない）。日本語wiki（wikiwiki.jp/dominiondeck/一覧/習性）で20種を確認＝チョウ/ラクダ/カメレオン/カエル/ヤギ/馬/モグラ/サル/ハツカネズミ/ラバ/カワウソ/フクロウ/雄牛/豚/ドブネズミ/アザラシ/羊/リス/ウミガメ/ミミズ（英語20種と完全対応）。拡張名は「移動動物園」。
- 王国カード（対訳表＋wikiwiki個別ページで裏取り、confidence: medium-high）＝動物見本市/艀/黒猫/賞金稼ぎ/ラクダの隊列/枢機卿/騎兵隊/魔女の集会/デストリエ/強制退去/鷹匠/漁師/門番/ヤギ飼い/馬丁/旅籠/狩猟小屋/炉/貸し馬屋/首謀者/パドック/聖域/がらくた/牧羊犬/そり/雪深い村/備蓄品/配給品/村有緑地/行人。イベント＝同盟/放逐/特価品/商売/遅延/要求/絶望/包領/増大/博打/投資/進軍/植民/追求/刈り入れ/乗馬/今を生きる/暴走/苦労/輸送。
- 注意：**日本語の「移動動物園」は収穫祭の Menagerie（$3アクション）のカード名でもある**＝拡張名と衝突するので id/表示で区別すること。

【実装向けの要点（ルールブック本文より）】
- 非サプライ山は **Horse のみ（30枚）**。「馬を獲得」効果でしか取れず、Falconer/Displace のような汎用獲得では取れない。山が空なら獲得失敗。プレイで +2カード+1アクションして**山に戻す**。Mastermind等で複数回プレイすると各回 +2カード+1アクションだが、戻すのは1回だけ。
- Way of the Mouse は**1枚だけ脇に置く**（山ではない）。
- **持続は4枚**＝Barge / Gatekeeper / Mastermind / Village Green。**リアクションは5枚**＝Black Cat / Falconer / Sheepdog / Village Green / Sleigh（前4つは相手のターンにも出せる＝アクション権を消費しない）。
- コストに **`*` が付く5枚**＝Horse（購入不可の目印）/ Animal Fair（アクションを廃棄して購入できる）/ Destrier・Fisherman・Wayfarer（ターン中にコストが変動）。`*` は目印であってコスト成分ではない（Horse は「$3と同じコスト」として扱う）。**コスト変動は全コピーに即時反映され、効果解決の途中でも変わる**＝コスト比較述語は動的に評価すること。
- Exile（追放）＝公開・自分の所有（得点に数える）。「サプライから追放」は獲得ではない＝獲得時能力は誘発しない。追放マットからの捨て札は「捨てる」＝Tunnel/Village Green を誘発する。
- Way は「アクションカードの記載効果の代わり」。区切り線の下のテキストは影響を受けない。Enchantress（帝国）の置換より Way を優先選択できる。Moat/Kiln の "first" 能力の後に Way を使うか選ぶ。

【出典】RGG公式ルールブックPDF（上記URL・逐語確認）／Rio Grande Games 製品ページ https://www.riograndegames.com/games/dominion-menagerie/ ／日本語wiki https://wikiwiki.jp/dominiondeck/一覧/習性 ／対訳表 https://hirotashi-domi.hatenablog.com/entry/2020/05/16/202622 ／ホビージャパン https://hobbyjapan.games/dominion-menagerie/

</details>

## 1. 新機構（ルールブック本文ベース）

### Exile（追放）／追放マット

カードを「追放マット」という公開の別領域に置く新機構。追放は獲得でも廃棄でもないが、マット上のカードはそのプレイヤーの所有物であり、ゲーム終了時の得点計算に数える。カードを獲得したとき、マット上の同名カードを『全部まとめて』捨て札にできる（一部だけは不可）。

**公式規定**

> 【ルールブック逐語（RGG公式PDF 2020, p.3）】
> Menagerie has Exile mats that cards can go on. Each player gets one.
> ・"Exile a card" means, put it on your Exile mat.
> ・"Cards in Exile" are the cards on your mat.
> ・Cards on your mat are yours; at the end of the game, include them when scoring.
> ・The cards on Exile mats are face up and public.
> ・When you gain a card, you may discard the other copies of it from your mat. For example, if you have two Silvers on your mat, and gain a Silver, you may discard the two Silvers from your mat - they go to your discard pile. You can leave them on the mat instead. You cannot discard just one of them.
> ・Exiling a card from the Supply is not "gaining" the card, and will not cause "when you gain this" abilities to happen. Discarding a card from your Exile mat is not gaining it either.
> ・Discarding a card from your Exile mat is discarding a card; if it happens other than in Clean-up, it can trigger Tunnel (from Hinterlands) or Village Green.
> 
> 【日本語訳・規定として断定できる形】
> 1) 追放マットは各プレイヤー1枚。王国に追放を参照するカードがあるときだけ配る。
> 2) 「カード1枚を追放する」＝そのカードを自分の追放マットの上に置く（＝移動）。移動元は問わない（手札／サプライ／獲得したカード等）。
> 3) 追放マット上のカードは**表向き・全員に公開**。伏せない（オンラインでもマスクしない）。
> 4) 追放マット上のカードは**そのプレイヤーの所有物**。サプライから追放した場合も、その時点で自分のカードになる。ゲーム終了時、勝利点カード・呪いを含めて自分のカードとして得点計算に加える。庭園／ブドウ園／絹の道など「所有カード枚数を数える」効果の対象にもなる。
> 5) 追放は**獲得ではない**。獲得時能力（on-gain）は一切誘発しない。追放マットから捨て札にするのも**獲得ではない**。
> 6) 追放は**廃棄ではない**。廃棄時能力（on-trash）も誘発しない。
> 7) **カードを獲得したとき**、自分の追放マット上にある**その獲得カードと同名のカードを、全部**捨て札にしてよい（任意）。「全部捨てる」か「1枚も捨てない」の二択で、**一部だけ捨てることはできない**。
> 8) 追放マットから捨て札置き場へ移す処理は**「カードを捨てる」処理**であり、クリンナップ以外で起きた場合は坑道(Tunnel)や村有緑地(Village Green)などの捨て札リアクションを誘発する。

**エッジケース**

- 【実装の要】追放マット `p.exile` は物理カードのゾーン＝`allCards` と保存則 tally（invariants の ZONES）に必ず入れる。マスクは不要（公開）。
- 「獲得したとき同名を全部捨てる」は**獲得に誘発する効果**。他の on-gain 効果が同時にある場合、処理順は**獲得したプレイヤーが選ぶ**（本プロジェクトの onGainQueue に載せる想定）。
- 同名判定は**カード名**で行う。騎士(knights)・廃墟(ruins)・城(castles) のような『同じ山に名前の違うカードが入る混合山』では、名前が違えば同名扱いにならない。
- 追放は獲得でないので、獲得置換リアクション（交易商人 Trader／望楼 Watchtower／そり Sleigh）で割り込めない。魔女の集会(Coven)の呪い追放が Watchtower/Trader で回避できないのはこのため。
- 追放マットからの捨て札は「捨てる」なので坑道(Tunnel)＝金貨獲得、村有緑地(Village Green)＝リアクション使用が誘発する。
- 得点計算・保存則の両方で、追放マットは『廃棄置き場』ではなく『そのプレイヤーの所有ゾーン』として扱うこと（廃棄と混同すると点が狂う）。
- 投資(Invest)で追放したカードは『投資された追放カード』として、他の手段で追放したカードと**区別して管理する必要がある**（公式FAQ：マットの半分下に差し込むなどして分ける）。投資されていない同名コピーは他人の獲得でドローを発生させない。実装では追放カードごとに investedBy フラグが要る。
- 投資したカードも通常どおり『同名カードを獲得したとき』に捨て札にできる。そうすると以後ドローは発生しなくなる。
- 門番(Gatekeeper)の追放は『獲得したカードが獲得後どこにも動いていない場合のみ』成立する。そり(Sleigh)で手札に移すなど、先に動かせば追放を免れる（＝lose track）。逆に、獲得後に動かす系（Replace/Summon 等）には門番が勝つ。
- 輸送(Transport)は『追放マット上のアクション1枚をデッキトップに置く』こともできる＝追放マットからデッキへ戻す唯一の一般手段。他のカードで追放されたものも対象にできる。
- デジタル版の慣習：獲得カードが銅貨・勝利点・呪い・廃墟のとき「同名を捨てるか」の確認をスキップする設定がある（UX上あると親切）。

関係カード: Camel Train（ラクダの隊列） / Bounty Hunter（賞金稼ぎ） / Cardinal（枢機卿） / Coven（魔女の集会） / Displace（強制退去） / Gatekeeper（門番） / Sanctuary（聖域） / Stockpile（備蓄品） / Banish（放逐・イベント） / Enclave（包領・イベント） / Invest（投資・イベント） / Transport（輸送・イベント） / Way of the Camel（ラクダの習性） / Way of the Worm（ミミズの習性）

### Horse（馬）

サプライ外の共通山（30枚固定）。使用すると +2カード +1アクションを得て、その馬を馬の山に戻す（＝獲得でも廃棄でもない、山への返却）。『馬を獲得する』と書かれたカードでしか取れない。

**公式規定**

> 【ルールブック逐語（RGG公式PDF 2020, p.3）】
> Menagerie adds the Horse pile, and ways to get Horses. When you play a Horse, you get +2 Cards, +1 Action, and return the Horse to the Horse pile.
> ・"Gain a Horse" causes you to gain a Horse from the pile.
> ・This is a non-Supply pile; you can only gain a Horse from it when a card tells you to gain a Horse, not with cards like Falconer or Displace.
> ・If told to gain a Horse with none left in the pile, you fail to gain one.
> ・If you use a card like Mastermind to play a Horse multiple times, you get +2 Cards and +1 Action for each play, even though you can only return the Horse once.
> 
> 【カードテキスト】Horse / 馬 — cost $3*（アクション）
> "+2 Cards / +1 Action / Return this to its pile. (This is not in the Supply.)"
> 「+2 カードを引く／+1 アクション／このカードを馬の山札に戻す。（このカードはサプライに置かない。）」
> 
> 【枚数・準備】箱の内容は「30 Horses」＝**馬の山は常に30枚（人数によらず固定）**。準備は "In games using cards that refer to Horses, keep the Horse pile handy."＝**王国に馬を参照するカードがあるときだけ**馬の山を用意する。
> 
> 【コストの * について】"Horse, for example, has a * by its cost, but costs $3, and so can be Remodel'd into a Duchy and so on. For effects that compare costs, Horse has 'the same cost' as other cards costing $3." ＝ **実コストは $3 として扱う**。* は「サプライではないので購入できない」という注意書きにすぎない。

**エッジケース**

- **サプライではない**＝購入できない／3山終了のカウントに入れない／「コスト$N以下のカードを獲得」などの汎用獲得（鷹匠 Falconer・強制退去 Displace・工房 等）では取れない。本プロジェクトの `NON_SUPPLY` に登録し、4系統（emptyPileCount／canBuyCard／闇市場デッキ母集団／汎用獲得 engine+CPU）から必ず除外すること。
- 「馬を獲得する」効果**だけ**が馬の山から取れる。山が空なら『獲得に失敗する』（エラーにしない・pending を閉じる）。
- **使用時の『山に戻す』は獲得でも廃棄でもない**。山の残数が増える。保存則テストでは馬の山を1ゾーンとして数えれば総数は保存される。
- 玉座の間／首謀者(Mastermind)などで馬を複数回使用すると、**+2カード +1アクションは回数ぶん得られるが、山に戻せるのは1回だけ**（2回目の返却は場に無く失敗＝lose track）。
- 習性(Way)を指定して馬を使用すると『山に戻す』効果は発生しない＝馬が場に残る（豊穣の角笛・絵師など「場のカード」を参照する効果と組める）。
- 馬の習性(Way of the Horse)は『そのカードを由来する山に戻す』ので、非サプライ山にも戻せる。ただし共同墓地(Necropolis)のように**山が存在しないカードは戻すのに失敗する**。
- コスト比較では $3 ちょうど（改築で公領にできる、など）。

関係カード: Horse（馬・非サプライ） / Sleigh（そり） / Supplies（配給品） / Cavalry（騎兵隊） / Groom（馬丁） / Hostelry（旅籠） / Livery（貸し馬屋） / Paddock（パドック） / Scrap（がらくた） / Ride（乗馬・イベント） / Bargain（特価品・イベント） / Demand（要求・イベント） / Stampede（暴走・イベント） / Way of the Horse（馬の習性）

### Ways（ウェイ＝日本語公式名『習性』）

横型ランドスケープの新種別。アクションカードを使用するとき、そのカードの『使用時効果』の代わりに習性の効果を使ってもよい。1回の使用ごとに選び直せる。仕切り線より下の効果は消えない。

**公式規定**

> 【ルールブック逐語（RGG公式PDF 2020, p.3）】
> Menagerie has Ways. Each Way gives Action cards an additional option: you can play the Action for what it normally does, or play it to do what the Way says to do. Playing an Action card for a Way ability means not doing anything the Action card said to do when played. For example, if you have Way of the Sheep in a game, which says "+$2," then you could play a Horse and choose to get +$2; if you did so, you would not get +2 Cards and +1 Action, and would not return the Horse to its pile.
> ・Ways are not Kingdom cards, and cannot be bought; they sit on the table modifying the game rules.
> ・Text below a dividing line is unaffected, it will still happen whenever it says it does.
> ・For tracking, it is helpful to tilt a card that was played using a Way.
> ・Some Ways refer to "this." That is the card being used to do the Way ability. For example, Way of the Turtle says "Set this aside..." If you play a Market using Way of the Turtle, you will set the Market aside.
> ・Enchantress from Empires also changes what an Action card does when played. If you are affected by Enchantress, you can use a Way instead of getting the +1 Card and +1 Action that Enchantress's effect would give you.
> ・When an Action card can be played at an unusual time, like Sheepdog, it can still be used as a Way.
> ・If you play an Action card multiple times, with a card like Mastermind, you can choose for each play whether you want it to use a Way or not. If the card you are playing is a Duration card, it only stays in play if at least one of its plays was for its own abilities.
> ・The choice to use a Way or not happens after "first" abilities on cards like Moat and Kiln.
> ・The tokens from Adventures still apply when playing a card using a Way.
> 
> 【採用枚数（準備）】
> "For normal play we recommend using at most 2 such cards; with other expansions that includes Events, Ways, Landmarks, and Projects. Skip any further landscape cards turned over. We also recommend using at most one Way per game."
> ＝ **枚数の強制ルールは無い（推奨）**。推奨＝横型（イベント／習性／ランドマーク／プロジェクト、および略奪の特性 Trait）の**合計2枚以下**、かつ**習性は1枚まで**。
> 
> 【全20種のカードテキスト（英語公式／日本語公式名）】
> ・Way of the Butterfly / チョウの習性：You may return this to its pile to gain a card costing exactly $1 more than it.
> ・Way of the Camel / ラクダの習性：Exile a Gold from the Supply.
> ・Way of the Chameleon / カメレオンの習性：Follow this card's instructions; each time that would give you +Cards this turn, you get +$ instead, and vice-versa.
> ・Way of the Frog / カエルの習性：+1 Action. When you discard this from play this turn, put it onto your deck.
> ・Way of the Goat / ヤギの習性：Trash a card from your hand.
> ・Way of the Horse / 馬の習性：+2 Cards, +1 Action. Return this to its pile.
> ・Way of the Mole / モグラの習性：+1 Action. Discard your hand. +3 Cards.
> ・Way of the Monkey / サルの習性：+1 Buy, +$1
> ・Way of the Mouse / ハツカネズミの習性：Play the set-aside card, leaving it there.（下記の専用項目を参照）
> ・Way of the Mule / ラバの習性：+1 Action, +$1
> ・Way of the Otter / カワウソの習性：+2 Cards
> ・Way of the Owl / フクロウの習性：Draw until you have 6 cards in hand.
> ・Way of the Ox / 雄牛の習性：+2 Actions
> ・Way of the Pig / 豚の習性：+1 Card, +1 Action
> ・Way of the Rat / ドブネズミの習性：You may discard a Treasure to gain a copy of this.
> ・Way of the Seal / アザラシの習性：+$1. This turn, when you gain a card, you may put it onto your deck.
> ・Way of the Sheep / 羊の習性：+$2
> ・Way of the Squirrel / リスの習性：+2 Cards at the end of this turn.
> ・Way of the Turtle / ウミガメの習性：Set this aside. If you did, play it at the start of your next turn.
> ・Way of the Worm / ミミズの習性：Exile an Estate from the Supply.

**エッジケース**

- **習性を使っても『そのカードを使用した』ことになる**（コンボ判定は成立する）。例：手先(Lackeys)を雄牛の習性で使用した後に共謀者(Conspirator)を使用すると、共謀者は『このターン2回目のアクション使用』として数えられる。岐路(Crossroads)を習性で使用しても『このターン最初に使用した岐路』を消費する。→ 実装では『使用回数カウンタ』は習性でも普通に増やすこと。
- **習性を指定する行為そのものは追加のアクション使用ではない**（1回の使用が1回のまま）。
- **変更されるのは『使用時効果』だけ**。仕切り線より下（リアクション・獲得時・購入時・場にある間、など）は消えない。例：ならず者(Rogue)を雄牛の習性で使っても『場にある間、カードを購入するとき+1VP』は生きる。逆に橋(Bridge)は全文が使用時効果なので、習性を選ぶとコスト減も消える。
- **持続カードに習性を指定すると、その使用では持続効果が発生しない**＝そのターンのクリンナップで捨て札になる。複数回使用のうち1回でも通常使用があれば場に残る。
- **リザーブカードに習性を指定すると酒場マットに移動しない**＝そのターンのクリンナップで捨て札になり、仕切り線下の呼び出し効果も使えなくなる。
- **選択のタイミングは『先に(first)』系の効果より後**。具体的には 堀などのアタック誘発リアクション／浮浪児(Urchin)／炉(Kiln)／冒険の各プレイヤートークン（+1カード/+1アクション/+1購入/+1コイン）／豊作 の後に習性を選ぶ。→ 実装では『トークンのボーナスを先に適用してから習性の選択モーダルを出す』こと。
- **アクションカードを使用するあらゆる場面で習性を選べる**：購入フェイズのアクション使用（冠・資本主義で財宝化したアクション・苦労 Toil）／夜フェイズ（人狼）／他人のターンのリアクション使用（隊商の護衛・黒猫・牧羊犬・鷹匠）／命令カード経由（はみだし者・大君主・ネクロマンサー・相続の屋敷）／脇に置いたカードの使用（幽霊・ウミガメの習性）／アクション権を消費しない使用（サウナ・アヴァント・ピアッツァ・進軍 March・狂信者）。
- **習性を選べない場面**：単にリアクション効果を発揮しただけ（＝自身を使用しないリアクション）／単に持続効果を発揮しただけ／酒場マットからの呼び出しでリザーブ効果を発揮しただけ／購入時・獲得時効果だけの発揮（義賊の購入時アタック、大使館の獲得時銀貨など）／呪いの森など予約されたアタック効果。
- **玉座の間系では1回ごとに選び直せる**。1回目の結果（引いたカード）を見てから2回目の選択をしてよい。ただし建て直し(Rebuild)のような『1回の使用時効果の中で2度処理する』カードは使用が1回なので選択も1回。
- **女魔術師(Enchantress)／追いはぎ(Highwayman)の被害時**は、被害者が「習性を使う」か「アタック効果を受ける」かを選べる（＝習性でアタックを回避できる）。ただし**カメレオンの習性だけは例外**で、アタック側が優先される（カメレオンは『カードの指示に従う』ので、指示が上書きされていると機能しない）。
- **廃墟(Ruins)もアクションカード**なので習性を指定できる。廃墟撒きアタックが弱体化し、場合によっては利敵行為になる。
- **Hinterlands 第二版で街道(Highway)のテキストが変更**され、コスト減が仕切り線より下ではなくなった＝街道に習性を使うとコスト減も消える。ルールブックの街道の例は初版基準なので注意（浮浪児 Peasant などは今も仕切り線下のまま）。
- 習性の指定回数に制限はない（毎回のアクション使用で使える）。
- 習性はサプライではなく購入も獲得もできない。3山終了などにも無関係。
- 記録用に、習性で使用したカードは傾けておくことが公式推奨。

関係カード: Way of the Butterfly / Way of the Camel / Way of the Chameleon / Way of the Frog / Way of the Goat / Way of the Horse / Way of the Mole / Way of the Monkey / Way of the Mouse / Way of the Mule / Way of the Otter / Way of the Owl / Way of the Ox / Way of the Pig / Way of the Rat / Way of the Seal / Way of the Sheep / Way of the Squirrel / Way of the Turtle / Way of the Worm

### Way of the Mouse（ハツカネズミの習性）＝準備が要る唯一の習性

ゲーム開始時に、そのゲームで使わないコスト$2または$3のアクション王国カード1枚を脇に置く。習性を指定すると、その脇のカードを『脇に置いたまま』使用する。2025年2月エラッタで対象が『持続でない』アクションに限定された。

**公式規定**

> 【カードテキスト（2025年2月エラッタ後・現行）】
> "Play the set-aside card, leaving it there."
> "Setup: Set aside an unused non-Duration Action costing $2 or $3."
> 「脇に置いてあるカードを使用し、そのカードはそこに残す。／【準備】このゲームで使わない、コスト$2または$3で持続ではないアクション王国カード1枚を脇に置く。」
> ※エラッタ前（初版印刷・2020ルールブック）は "an unused Action costing $2 or $3"（持続の制限なし）。日本語版カードはエラッタ前のテキストで印刷されている。
> 
> 【公式FAQ】
> ・Set aside any unused Action kingdom card costing $2 or $3 at the start of the game. Do any setup that that card requires.
> ・When using Way of the Mouse, you play the set-aside card, leaving it set-aside. For example, if you set aside Sleigh, then any Action card could be used to gain 2 Horses.
> ・The set-aside card cannot move itself when played, since it is not in play; for example, if the card is Embargo (from Seaside), it cannot be trashed.
> ・Text below a dividing line (other than setup) will not do anything.
> 
> 【公式裁定（追加）】
> ・You cannot use Way of the Mouse when playing the card set aside by Way of the Mouse（＝脇のカード自身にハツカネズミの習性を指定できない。チャンピオンとの無限ループ防止）。
> ・（エラッタ前）If the set-aside card is a Duration, then a card played this Way will stay out as long as that Duration would.

**エッジケース**

- **『命令(Command)』と同型**＝脇のカードは場に出ない。したがって『自身を移動させる効果』（自身を廃棄・脇に置く・山に戻す・マットに置く）は**必ず失敗する**。本プロジェクトの `playAsCommand` / `takeSelf` / `playedByCommand` をそのまま流用できる。
- **移動そのものだけが失われ、残りの効果は普通に解決する**。例：【ハツカネズミ劇団(Acting Troupe)】は『自身を廃棄』に失敗するが『+4 村人』は得られる。【ハツカネズミ陣地(Encampment)】は『+2カード +2アクション』を得たうえで、山に戻る処理が不発になる（＝全アクションが失われし都市級になる異常事態）。【ハツカネズミ抑留(Embargo)】は廃棄に失敗するので抑留トークンも置けない。
- **仕切り線より下（準備を除く）は機能しない**。
- **脇のカードが特別な準備を要求するならそれも行う**（トラベラーなら出世先の山も用意する。ただし実際には交換できない。連携カードなら同盟を準備し全員1好意で開始）。
- **コスト条件は『$2または$3 ちょうど（コイン$2-3・ポーション0・負債0）』**。分割山を構成するカード（パトリキ・投石機・生徒など）も条件を満たせば対象になり得る。
- **サプライ外のカードは対象外**（兵士・トレジャーハンター・インプ・各種ゾンビなど、コストが合っていても不可）。
- **採用するテキスト**：本プロジェクトは現行エラッタ準拠の方針なので **『持続でない』を採用**すべき（Dominion Online もエラッタ後で処理している）。持続を許すと、命令が持続を使ったときに場に残す追跡が必要になり実装コストも上がる。
- Dominion Online は追加で『準備が必要なカード』や『他の習性と同等以下になるカード（堀など）』も脇に置かない実装にしているが、これは**公式ルールではなくオンライン実装の都合**なので真似しなくてよい。

関係カード: Way of the Mouse（ハツカネズミの習性）

### Way of the Chameleon（カメレオンの習性）＝全体ルール変更型の特殊な習性

他の19種と違い『カードの指示に従う』うえで、そのターンに得る +カード と +コイン を相互に入れ替える。ターン全体に掛かる置換ルールなので、実装は他の習性と別系統になる。

**公式規定**

> 【カードテキスト】
> "Follow this card's instructions; each time that would give you +Cards this turn, you get +$ instead, and vice-versa."
> 「このカードの指示に従う。このターン、それが +カードを引く を与えるごとに代わりに +コイン を得て、+コイン を与えるごとに +カードを引く を得る。」
> 
> 【公式FAQ】
> ・For example, if you play Sheepdog and use Way of the Chameleon, you will get +$2 instead of +2 Cards.
> ・If you play a Duration card using Way of the Chameleon, only the +$ and +Cards you get that turn are affected; for example, if you play Merchant Ship (from Seaside) and use Way of the Chameleon, you will get +2 Cards this turn, but the normal +$2 next turn.
> ・This turns "+Cards" into "+$" and vice-versa, but does not change other ways to draw cards, for example, "draw until you have 6 cards in hand."
> ・If the card that uses Way of the Chameleon plays another card, that card just does what it normally does (unless you use Way of the Chameleon on it as well).

**エッジケース**

- **『+カードを引く』という記法だけが対象**。『手札が6枚になるまで引く』『デッキの上から○枚見て手札に加える』などは変換されない。→ 実装では『+Nカード』の記法を明示的に持つ効果だけに掛ける。
- **持続カードでは『そのターンぶん』だけ変換**され、次ターンぶんは通常どおり。
- **そのカードが別のカードを使用した場合、その別カードは通常どおり**（そちらにも別途カメレオンを指定すればそちらも変換される）。
- **女魔術師(Enchantress)／追いはぎ(Highwayman)には負ける**。両者はカードの指示を上書きするため、『指示に従う』カメレオンは機能しない（他の習性はアタックを回避できるのに、カメレオンだけは回避できない）。
- **財源(+Coffers)には無関係**。コインを失う効果（貧民街など）にも無関係。
- **-1カードトークン／-$1トークンは消費されない**（+1カードを得るはずが+$1になった場合、トークンは残る）。
- **教師(Teacher)の山トークンのボーナスは習性の選択より先に適用**されるので変換されない。
- 選択肢を持つカード（宮廷 Courtier など）は記載順にボーナスを得る。
- **『指示に従う』ため、カードの指示を参照する他の効果は生きる**（Lantern・Elder・Reckless など）。
- Cellar・Oracle・Storeroom・語り部 は刷によって『+Cards』表記と『draw』表記が違うので、手元のカードの表記に従う。

関係カード: Way of the Chameleon（カメレオンの習性）

### Events（イベント）— Menagerie 固有の差分

機構自体は冒険/帝国と同一で、Menagerie 独自の新ルールは無い。差分は『イベントが20種あること』と、個別カードの内容（1ターン1回・1ゲーム1回・追加ターン・脇置き）だけ。

**公式規定**

> 【ルールブック逐語（RGG公式PDF 2020, p.4）】
> Menagerie has Events, which first appeared in Adventures. In your Buy phase, when you can buy a card, you can buy an Event instead. You pay the cost indicated on the Event and immediately do its effect.
> ・Events are not Kingdom cards; they sit on the table and provide an effect you can buy. There is no way for you to gain one or end up with one in your deck.
> ・Buying an Event uses up a Buy; normally you can either buy a card, or buy an Event. If you have two Buys, such as after playing Sanctuary, you can buy two cards, or buy two Events, or buy a card and an Event (in either order).
> ・The same Event can be bought multiple times in a turn if you have the Buys and $ available to do it.
> ・You cannot play further Treasures that turn after buying an Event.
> ・Buying an Event is not buying a card and so does not trigger cards like Haggler (from Hinterlands).
> ・Costs of Events are not affected by cards like Bridge (from Intrigue).
> 
> 【Menagerie のイベント20種（コスト／英語名／日本語公式名）】
> $0 Delay 遅延／$0 Desperation 絶望／$2 Gamble 博打／$2 Pursue 追求／$2 Ride 乗馬／$2 Toil 苦労／$3 Enhance 増大／$3 March 進軍／$3 Transport 輸送／$4 Banish 放逐／$4 Bargain 特価品／$4 Invest 投資／$4 Seize the Day 今を生きる／$5 Commerce 商売／$5 Demand 要求／$5 Stampede 暴走／$7 Reap 刈り入れ／$8 Enclave 包領／$10 Alliance 同盟／$10 Populate 植民
> ※負債コストのイベントは Menagerie には無い（すべてコインのみ）。

**エッジケース**

- **本プロジェクトは冒険/帝国のイベント基盤（BUY_EVENT・canBuyEvent・treasuresLocked・buysMade）をそのまま流用できる**。Menagerie 固有の追加機構は無い。
- **Desperation（絶望）は『1ターンに1回』**＝2回目の購入自体を拒否する（購入権を無駄にしない）。既存の canBuyEvent の『1ターン1回』枠に載せる。
- **Seize the Day（今を生きる）は『1ゲームに1回』**。既存の『1ゲーム1回』枠（相続と同型）に載せる。
- **Delay（遅延）／Reap（刈り入れ）は脇置き＋次ターン開始時に使用**。脇置きゾーンは物理カード＝保存則の tally に入れる。ターン開始時の処理は `t.startQueue` に積むこと。
- **Toil（苦労）／March（進軍）はアクションカードを使用する**＝アクション権を消費しない使用。ここでも習性を指定できる。
- **Populate（植民）はサプライのアクションの山から1枚ずつ獲得**＝大量獲得。獲得トリガーの連鎖に注意。
- **Transport（輸送）／Invest（投資）／Banish（放逐）／Enclave（包領）は追放を使う**。
- Alliance（同盟）は略奪の同盟(Alliance)と日本語名が衝突する（英語では Menagerie がイベント、Allies が同名の別カード）。id を分ける必要がある。

関係カード: Delay / Desperation / Gamble / Pursue / Ride / Toil / Enhance / March / Transport / Banish / Bargain / Invest / Seize the Day / Commerce / Demand / Stampede / Reap / Enclave / Alliance / Populate

### 自分のターン以外に使えるリアクション（Menagerie 固有の重要機構）

Menagerie のリアクション5種のうち4種は『手札からそのカード自身を使用する』タイプ。相手のターン中にアクションカードが場に出るため、既存エンジンの前提（場のカードは手番プレイヤーのもの）を壊しやすい。

**公式規定**

> 【ルールブック逐語（RGG公式PDF 2020, p.4）】
> Menagerie has five Reaction cards. Four of them can be played at an unusual time: Black Cat, Falconer, Sheepdog, and Village Green.
> ・Playing one of these Reactions using its ability (the text below the dividing line) puts it into play, like playing it normally, but does not use up an Action.
> ・If you play a card on someone else's turn, you discard it in that turn's Clean-up, unless it is a Duration card with things left to do.
> ・If playing one of these Reactions draws you another Reaction that can be used at the same time, you can use it, and so on. For example, you might have one Black Cat in hand when an opponent gains a Province, play it, draw another, play it, draw another, play it.
> ・When playing one of these Reactions, you can choose to use a Way if there is one.
> ・If multiple players want to do things at the same time - such as play Reactions - the player first in turn order (starting from the player whose turn it is) goes first. This may change who wants to do what; after each thing, start again from the first player and see who has things to do.
> ・Sometimes a condition occurs that allows a Reaction to be played, and that Reaction creates a second condition that allows Reactions to be played. Resolve all Reactions for the new condition and then go back to resolving ones for the first one. For example one player gains a Province, and another plays Black Cat. Gaining a Curse from Black Cat allows players to play Sheepdogs; after resolving those you would go back to see if players had more Black Cats to play.
> 
> 【誘発条件（各カード）】
> ・Black Cat（黒猫・$2）：他プレイヤーが勝利点カードを獲得したとき、手札から使用してよい。使用時＝+2カード、自分のターンでなければ他の各プレイヤーが呪い1枚を獲得。
> ・Sheepdog（牧羊犬・$3）：いずれかのプレイヤーがカードを獲得したとき、手札から使用してよい。使用時＝+2カード。
> ・Falconer（鷹匠・$5）：いずれかのプレイヤーがカードタイプを2つ以上持つカードを獲得したとき、手札から使用してよい。使用時＝これよりコストの少ないカード1枚を手札に獲得。
> ・Village Green（村有緑地・$4）：クリンナップ以外でこれを捨て札にしたとき、公開して使用してよい。使用時＝『今』か『次のターン開始時』に +1カード +2アクション。
> ・Sleigh（そり・$2・5枚目のリアクション）：カードを獲得したとき、これを手札から捨て札にして、獲得したカードを手札かデッキトップに移してよい（＝『使用』ではない）。

**エッジケース**

- **相手のターンに場に出たカードは、そのターンのクリンナップで（そのカードの持ち主が）捨て札にする**。持続カードでやることが残っていれば残る（村有緑地が『次のターン開始時』を選んだ場合など）。
- **アクション権を消費しない**（相手のターンなのでそもそもアクション権が無い）。
- **連鎖する**：リアクションで引いたカードが同じ条件で使えるリアクションなら続けて使える。
- **入れ子の解決順**：条件Aでリアクション → その結果が条件Bを作る → **条件Bのリアクションを全部解決してから条件Aに戻る**。
- **複数人が同時に反応**する場合は、手番プレイヤーから始まるターン順。1つ処理するたびに先頭から見直す。
- **これらのリアクションにも習性を指定できる**。
- 本プロジェクトへの影響が大きい：`inPlay` が手番プレイヤー以外にも存在し得る。cleanup は『各プレイヤーの inPlay』を捨てる必要がある（既存の隊商の護衛 caravan_guard と同型なので、その実装を拡張するのが安全）。
- Sleigh は『使用』ではなく『捨て札にする』ので、リアクション窓の扱いが上記4種と異なる（獲得置換系＝望楼/交易商人と同じ枠）。

関係カード: Black Cat（黒猫） / Sheepdog（牧羊犬） / Falconer（鷹匠） / Village Green（村有緑地） / Sleigh（そり）

### 変動コスト（コスト表記の *）

Menagerie はコストに * が付いたカードが5種ある。* 自体はルールではなく注意書きだが、Destrier / Fisherman / Wayfarer は**ターン中にコストが変動する**ため、コスト比較を成分別・逐次に評価する必要がある。

**公式規定**

> 【ルールブック逐語（RGG公式PDF 2020, p.5）】
> Some cards in Menagerie have costs marked with a *. The * is just a reminder; Horse, for example, has a * by its cost, but costs $3, and so can be Remodel'd into a Duchy and so on. For effects that compare costs, Horse has "the same cost" as other cards costing $3. Horse just uses the * as a reminder that you cannot buy Horse as it is not a Supply card; Animal Fair uses it as a reminder that you can buy the card another way. Destrier, Fisherman, and Wayfarer all use the * because they have costs that can change during a turn.
> ・When these cards change cost, all copies of them change everywhere, for all purposes. For example, when you Remodel one of the cards, the changed cost is what matters, not the printed cost. When another player has an effect that cares what the cost of their cards is on your turn (such as the promo Governor), they use the same changed cost that you do.
> ・Costs cannot go below $0.
> ・Destrier and Fisherman are also affected by other things that change costs, like Bridge (from Intrigue).
> ・Costs can change in the middle of resolving effects. The key thing is to follow card instructions in order.
> 
> 【各カード】
> ・Horse $3*：非サプライ（購入不可）の注意書きのみ。実コストは $3 固定。
> ・Animal Fair（動物見本市）$7*：『コストを支払う代わりに手札からアクション1枚を廃棄して購入してもよい』の注意書き。実コストは $7 固定。
> ・Destrier（デストリエ）$6*："During your turns, this costs $1 less per card you've gained this turn."（手番プレイヤーがこのターンに獲得したカード1枚につき$1安い）
> ・Fisherman（漁師）$5*："During your turns, if your discard pile is empty, this costs $3 less."（手番プレイヤーの捨て札が空なら$3安い＝$2）
> ・Wayfarer（行人）$6*："This has the same cost as the last other card gained this turn, if any."（このターンに最後に獲得された『行人以外の』カードと同じコストになる）

**エッジケース**

- **Destrier は手番プレイヤーの獲得だけを数える**（魔女で相手に呪いを配ってもコストは下がらない）。
- **Wayfarer は誰が獲得したかを問わない**。魔女で相手が呪いを獲得すれば Wayfarer は $0 になる。橋(Bridge)などのコスト減は『相手のカード』側にだけ掛かり Wayfarer には二重に掛からない（ただし、まだ何も獲得していなければ Wayfarer 自身にも掛かる）。Wayfarer はポーション費用や負債コストにもなり得る。
- **コストは解決の途中で変わる**。石工(Stonemason)の過払いで2枚獲得するとき、1枚目に Destrier を取ると2枚目は Destrier を取れない（コストが変わるため）。
- **同コスト比較・改築・交易商人などすべて『変動後の実コスト』で判定する**。交易商人で Destrier を廃棄すると銀貨6枚（先にコストを見てから獲得する）。
- **コストは$0未満にならない**。
- 本プロジェクトへの影響：`cardCost(state, id)` にターン内の獲得履歴・捨て札の空判定を参照する分岐を足し、`gainableBase`/`costUpTo`/`costUnder`/`costExact`/`sameCost` の全述語が自動で追従するようにすること（個別に if を足すと mix-all で必ず破綻する）。
- CPU の購入評価も `cardCost` 経由にすること（静的コストを見ると engine 拒否×CPU 提案で livelock）。

関係カード: Horse（馬） / Animal Fair（動物見本市） / Destrier（デストリエ） / Fisherman（漁師） / Wayfarer（行人）

### 持続カードのルールと【2025年2月の全体ルール変更】

Menagerie の持続は4種。2025年2月（英語版 Menagerie 改版）に『場を離れた持続カードは以降のターンに何もしない』という全体ルール変更が入った。Menagerie は馬/チョウ/ウミガメの習性で持続を場から動かせるため、この変更が直撃する。

**公式規定**

> 【ルールブック逐語（RGG公式PDF 2020, p.2）】
> Menagerie has four Duration cards. Duration cards are orange, and have abilities that affect future turns. Duration cards are not discarded in Clean-up if they have something left to do; they stay in play until the Clean-up of the last turn that they do something. Additionally, if a Duration card is played extra times by a card such as Mastermind, that card also stays in play until the Duration card is discarded, to track the fact that the Duration card was played extra times. Keep track of whether or not a Duration card was played on the current turn, such as by putting your cards into two lines.
> 
> 【2025年2月の全体ルール変更（英語版 Menagerie 改版に伴うエラッタ）】
> ・持続カードが何らかの理由で**場を離れた**場合、その【持続効果】は**ターン終了時にすべて失われる**（＝以降のターンには何もしない）。
> ・逆に言うと、場を離れた後も**そのターンの終了直前までは効果が有効**。
> ・同様に、玉座の間系／命令系のカードで持続カードが再使用されたが、その再使用元のカードがターン終了時に場に無い場合、**再使用ぶんの持続効果もターン終了時に失われる**。
> ・変更前は、場を離れても次ターン以降の効果が残り続けていた。
> 
> 【Menagerie の持続4種】
> ・Barge（艀・$5）：Either now or at the start of your next turn, +3 Cards and +1 Buy.
> ・Village Green（村有緑地・$4）：Either now or at the start of your next turn, +1 Card and +2 Actions.（＋リアクション）
> ・Mastermind（首謀者・$5）：At the start of your next turn, you may play an Action card from your hand three times.
> ・Gatekeeper（門番・$5）：At the start of your next turn, +$3. Until then, when another player gains an Action or Treasure card they don't have an Exiled copy of, they Exile it.（アタック）

**エッジケース**

- **この変更は Menagerie 単体でも到達する**：玉座の間で門番を使い、2回目に馬の習性を指定すると門番が場から消える。旧ルールでは次ターンも +$3 と追放アタックが残ったが、現行ではターン終了時に失われる（そのターン中は有効）。
- **首謀者ループの封じ**：エラッタ前は「首謀者Bを3回使用し、うち1回をウミガメの習性で脇に置く」ことで首謀者が無限に増殖するループが成立した。現行ルールではこれが不可能。
- **本プロジェクトへの影響**：既存の `armDuration` / `durationCards` / `cnt` 機構に『持続カードが場を離れたら、そのターン終了時に予約(delayedEffects)を破棄する』処理を足す必要がある。これは Menagerie を入れる前提なら必須（馬・チョウ・ウミガメの習性が場から動かす手段になる）。
- **首謀者(Mastermind)は3回使用**＝王の宮廷と同型。首謀者で持続カードを使用すると、その持続が場にある限り首謀者も場に残る。
- **門番(Gatekeeper)のアタック効果は次の自分のターン開始時に瞬時に終了する**。他の『ターン開始時』効果を割り込ませて追放効果を延命することはできない。
- Barge / Village Green は『今』か『次のターン開始時』を選ぶ＝選ばなければそのターンのクリンナップで捨て札（＝持続にならない）。海辺の同型カードと同じ扱い。
- 習性を指定して持続カードを使用すると持続効果が発生しない＝そのターンのクリンナップで捨て札になる。複数回使用のうち1回でも通常使用があれば場に残る。

関係カード: Barge（艀） / Village Green（村有緑地） / Mastermind（首謀者） / Gatekeeper（門番） / Way of the Horse / Way of the Butterfly / Way of the Turtle / Delay（遅延） / Reap（刈り入れ）

### 【2025年2月エラッタ】Menagerie のカードテキスト変更3件

英語版 Menagerie の改版（2025年2月）で、Way of the Mouse・Reap・Gamble の3枚のテキストが変更された。Dominion Online 等は変更後で処理している。日本語版カードは変更前のテキストで印刷されている。

**公式規定**

> 【1. Way of the Mouse（ハツカネズミの習性）】
> 変更前：Setup: Set aside an unused Action costing $2 or $3.
> 変更後：Setup: Set aside an unused **non-Duration** Action costing $2 or $3.
> （同じ変更が はみだし者 Band of Misfits／相続 Inheritance／大君主 Overlord にも入った＝命令系4種に『持続でない』が追加された）
> 
> 【2. Reap（刈り入れ・$7 イベント）】
> 変更前：Gain a Gold. Set it aside. At the start of your next turn, play it.
> 変更後：**Gain a Gold, setting it aside.** At the start of your next turn, play it.
> → 金貨が捨て札を経由せず**サプライから直接、脇に獲得される**。捨て札置き場に一瞬でも入らないので、獲得先が『脇』になる。
> 
> 【3. Gamble（博打・$2 イベント）】
> 変更前：+1 Buy. Reveal the top card of your deck. If it's an Action or Treasure, you may play it. Otherwise, discard it.
> 変更後：+1 Buy. **Discard the top card of your deck.** If it's an Action or Treasure, you may play it.
> → 先に**捨て札にしてから**、アクション/財宝なら（捨て札置き場から）使用してよい。公開ではなく捨て札なので、捨て札時リアクション（坑道 Tunnel・村有緑地 Village Green）が誘発し、パトロン(Patron)の『公開』も誘発しなくなる。
> 
> 【4. 全体ルール変更】持続カードが場を離れたら、その持続効果はターン終了時に失われる（上の項目を参照）。

**エッジケース**

- **本プロジェクトの方針（現行エラッタ準拠）に従い、3件とも変更後を採用すべき**。過去の拡張でも『日本語版カードが旧テキストでも本アプリは現行エラッタを採用』という前例がある（ルネサンス §0-22）。
- Way of the Mouse の『持続でない』は、命令機構（`overlordTargets` / `captainTargets` / `bandOfMisfitsTargets` / `princeEligible`）が既に持っている『非持続』条件をそのまま流用できる。
- Reap は『脇に獲得』＝`gain(dest:'setAside')` 相当。封鎖(blockade)で追加済みの dest を流用できる。獲得トリガーは通常どおり発火する。
- Gamble は『捨てる → 捨て札置き場から使用する』＝捨て札からカードを使用する経路（進軍 March と同型）。`triggerOnDiscard` を必ず通すこと。
- カードの絵（webp）を焼くときは**変更後のテキスト**で焼くこと。旧テキストで焼くと一覧の文言と画像が食い違う。

関係カード: Way of the Mouse（ハツカネズミの習性） / Reap（刈り入れ） / Gamble（博打） / Mastermind（首謀者・全体ルール変更の影響） / Gatekeeper（門番・全体ルール変更の影響）

### ターン内カウンタ・追加ターンなど その他の全体ルール

Menagerie は『このターンに獲得した枚数／異なる名前の数』『次に○○したとき』といったターン内カウンタを多用する。追加ターンは Seize the Day（1ゲーム1回）のみ。

**公式規定**

> 【ターン内カウンタ（すべて freshTurn でリセットする類）】
> ・Destrier（デストリエ）：`During your turns, this costs $1 less per card you've gained this turn.` ＝**手番プレイヤーがこのターンに獲得したカード枚数**。
> ・Wayfarer（行人）：`This has the same cost as the last other card gained this turn, if any.` ＝**このターンに最後に獲得された（行人以外の）カード**。誰の獲得でもよい。
> ・Commerce（商売・$5 イベント）：`Gain a Gold per differently named card you've gained this turn.` ＝**このターンに自分が獲得した『異なる名前』の数**だけ金貨を獲得。
> ・Livery（貸し馬屋・$5）：`+$3. This turn, when you gain a card costing $4 or more, gain a Horse.` ＝ターン中の獲得フック。**場にある枚数ぶん累積する**（『while this is in play』ではなく『this turn』なので、場を離れても効く）。
> ・Kiln（炉・$5）：`+$2. The next time you play a card this turn, you may first gain a copy of it.` ＝**このターン次に使用するカード1枚**に対する1回きりのフック。『first（先に）』効果なので、**習性を選ぶより前**に解決する。
> ・Snowy Village（雪深い村・$3）：`+1 Card, +4 Actions, +1 Buy. Ignore any further +Actions you get this turn.` ＝以降このターンに得る **+アクションをすべて無視**する（一部ではなく全部）。
> ・Desperation（絶望・$0 イベント）：`Once per turn: You may gain a Curse. If you do, +1 Buy and +$2.` ＝**1ターンに1回**。
> ・Way of the Seal（アザラシの習性）：`+$1. This turn, when you gain a card, you may put it onto your deck.` ＝ターン中の獲得フック。
> ・Way of the Squirrel（リスの習性）：`+2 Cards at the end of this turn.` ＝ターン終了時（クリンナップで手札を引いた**後**）に2枚引く。他人のターンに使った場合も、そのターンの終わりに引く。
> ・Way of the Frog（カエルの習性）：`+1 Action. When you discard this from play this turn, put it onto your deck.`
> 
> 【追加ターン】
> ・Seize the Day（今を生きる・$4 イベント）：`Once per game: Take an extra turn after this one.`
>   公式FAQ：`The extra turn is like a normal turn, except that it does not count for the tiebreaker.`
>   公式裁定：前哨地(Outpost)や使節団(Mission)と違い、**直前のターンが他人のターンだったかを確認しない**。したがって前哨地で追加ターンを取り、その追加ターンで今を生きるを購入して**3ターン目**を取れる。
> 
> 【獲得フック】
> ・Cavalry（騎兵隊・$4）：`When you gain this, +2 Cards, +1 Buy, and if it's your Buy phase return to your Action phase.` ＝ヴィラ(Villa)と同型のフェイズ復帰。
> ・Hostelry（旅籠・$4）：獲得時、好きな枚数の財宝を公開して捨て、その枚数の馬を獲得。
> ・Camel Train（ラクダの隊列・$3）：獲得時、サプライから金貨1枚を追放。

**エッジケース**

- **Kiln は『first（先に）』効果**なので、習性を選ぶ前に解決する。ルールブック明記：`The choice to use a Way or not happens after "first" abilities on cards like Moat and Kiln.`
- **Snowy Village は『無視する』**＝+アクションを得る効果自体が空振りになる。すでに得たアクション権は減らない。
- **Seize the Day は同点決勝（tiebreaker＝ターン数）に数えない**。本プロジェクトの `scoreGame` のタイブレーク処理に例外を入れる必要がある。
- **Seize the Day は連鎖できる**（前哨地/使節団の『3連続不可』ガードとは別枠）。既存の追加ターン実装に『今を生きるは前ターンの持ち主を見ない』分岐を足すこと。
- **Commerce の『異なる名前』は自分の獲得のみ**。Wayfarer の『最後に獲得された』は全員の獲得が対象＝混同しないこと。
- **Livery / Way of the Seal は『this turn』**＝場を離れても、そのターン中は効き続ける（『while this is in play』の街道型とは別物）。
- Way of the Squirrel をクリンナップの先引きとどう順序づけるか：公式は『クリンナップで手札を引いた後に2枚引く』＝本エンジンの『自分の手番終了時に次の手札を先引きする』設計だと**先引きの後に2枚足す**（＝次の手札が7枚になる）。冒険の『保存(Save)』と同じ位置に挟むこと。

関係カード: Destrier / Wayfarer / Commerce / Livery / Kiln / Snowy Village / Desperation / Seize the Day / Cavalry / Hostelry / Camel Train / Way of the Seal / Way of the Squirrel / Way of the Frog

### 準備（Setup）

## Menagerie（移動動物園）の準備（Setup）

### ルールブック逐語（RGG公式PDF 2020, p.2）
> Menagerie includes 30 randomizer cards (one for each Kingdom card). ... As with previous Dominion games, players must choose 10 sets of Kingdom cards for each game.
>
> Events and Ways can be shuffled into the randomizer deck (despite having a different back). They are not part of the 10 Kingdom cards used in a game; when an Event or Way is turned over, put it on the table but keep turning over cards until you get 10 Kingdom cards. **For normal play we recommend using at most 2 such cards; with other expansions that includes Events, Ways, Landmarks, and Projects. Skip any further landscape cards turned over. We also recommend using at most one Way per game.** Also skip Events and Ways when using a randomizer card to determine whether or not to use Platinum/Colony (from Prosperity), or Shelters (from Dark Ages) in a game, or to determine the bane for Young Witch (from Cornucopia). Another approach some people may prefer is to shuffle Events and Ways (and Landmarks and Projects) separately into their own deck, and always play with one or two of them.
>
> **In games using cards that refer to Exile, give each player an Exile mat. In games using cards that refer to Horses, keep the Horse pile handy. In games using Way of the Mouse, set aside an unused Action kingdom card costing $2 or $3, and do any setup that card requires.**

### 実装として断定できる規定

**1) 王国カードは常に10種**。イベント・習性は10種に含めない（＝馬の山や追放マットは王国の山数に影響しない。3山終了の判定にも無関係）。

**2) 横型ランドスケープの採用枚数**
- **強制ルールは無い**（0枚でも3枚以上でも違反ではない）。以下はすべて公式「推奨（recommend）」。
- 推奨①：**イベント＋習性＋ランドマーク＋プロジェクト（＋略奪の特性 Trait）の合計を2枚以下**にする。
- 推奨②：**習性は1ゲームに1枚まで**。
- ランダマイザで3枚目以降の横型が出たら**読み飛ばす**。
- 横型は Platinum/Colony 判定・Shelters 判定・若き魔女の Bane 決定のときも**読み飛ばす**（＝Bane にはできない）。
- 別法として、横型だけ別の山に分けて、常に1〜2枚使う運用も公式が認めている。
→ 本プロジェクトの既存実装（`DOM.landscapesForSet(setId)` が横型3種を一度に決め、合計最大2枚に制限する唯一の入口）と**完全に整合する**。ここに `ways` を第4の横型種別として足せばよい。ただし「習性は最大1枚」という追加制約が要る。

**3) 追放マット（Exile mat）**
- **王国（＋採用した横型）に追放を参照するカードが1枚でもあるとき**、各プレイヤーに1枚ずつ配る。
- 該当カード＝王国8種（Camel Train / Bounty Hunter / Cardinal / Coven / Displace / Gatekeeper / Sanctuary / Stockpile）、イベント4種（Banish / Enclave / Invest / Transport）、習性2種（Way of the Camel / Way of the Worm）の計14種。
- 実装上は `p.exile = []` を常に持たせておき、UI で「該当カードがあるときだけ追放マットを表示する」でよい（`state.artifacts` を条件付きで作る既存パターンと同型）。

**4) 馬の山（Horse pile）**
- **王国（＋採用した横型）に馬を参照するカードがあるときだけ**用意する。
- **枚数は常に30枚（人数によらず固定）**。箱の内容物も「30 Horses」。
- 非サプライの単一山。`state.supply` の数値キーではなく非サプライ山として持ち、`NON_SUPPLY` に登録する。
- 該当カード＝王国9種（Sleigh / Supplies / Cavalry / Groom / Hostelry / Livery / Paddock / Scrap ＋ Way 系）、イベント4種（Ride / Bargain / Demand / Stampede）、習性1種（Way of the Horse）。※Way of the Horse は「そのカードを由来する山に戻す」だけなので馬の山の用意は不要だが、Way of the Butterfly／Way of the Horse は馬が場にあるときに絡む。

**5) Way of the Mouse の脇置き（唯一、準備が必要な習性）**
- **そのゲームで使わない（＝王国10種に入っていない）コスト$2または$3のアクション王国カード1枚**を脇に置く。
- **2025年2月エラッタ後は「持続でない（non-Duration）」ものに限る**（本アプリは現行エラッタ採用を推奨）。
- **その脇のカードが要求する準備も行う**（例：トラベラーなら成長先の山も用意する／連携カードなら同盟を準備し全員1好意で開始／若き魔女なら Bane も）。
- コスト条件は「コイン$2〜$3・ポーション0・負債0」ちょうど。分割山の構成カード（パトリキ・投石機・生徒など）も条件を満たせば対象。**サプライ外のカード（兵士・トレジャーハンター・インプ・ゾンビ等）は対象外**。
- 脇のカード自身に Way of the Mouse を指定することはできない（チャンピオンとの無限ループ防止）。

**6) その他**
- Menagerie に負債コスト・ポーション費用のカードは無い。VPトークンも使わない。
- Menagerie に「支配」「避難所」「Platinum/Colony」を自動で使う規定は無い。
- 公式推奨キングダムがルールブックに20セット掲載されており、Menagerie 単体の10種セットとして `Intro to Horses` や `Intro to Exile` をそのまま固定セットに採用できる（自作不要）。

### 研究時点での未確定事項

- 【2025年2月エラッタの英語原文の直接確認】本家英語ウィキ（wiki.dominionstrategy.com の All_Errata）・移転先 Miraheze・Dominion Strategy Forum はいずれもボット遮断で到達できなかった。エラッタ3件（Way of the Mouse / Reap / Gamble）の英語テキストは日本語ウィキが引用する英語原文＋日本語ブログの2ソース一致で確定したが、Donald X. の原文投稿そのものは未確認。実装前にブラウザで https://wiki.dominionstrategy.com/index.php/All_Errata を1回開いて突き合わせると万全。
- 【2025年2月エラッタの網羅性】日本語ウィキのエラッタ告知バナーを機械走査して3件と判定したが、日本語ウィキが未反映のエラッタがある可能性は排除しきれない（同ウィキは更新が活発で 2026-08 まで編集されているので可能性は低い）。
- 【持続が場を離れた場合の全体ルールの正確な英語表現】日本語での規定（「場を離れた持続の【持続効果】はターン終了時にすべて失われる／ターン終了直前までは有効」）は複数ページで一致して確認できたが、Donald X. の英語原文の言い回しは未取得。特に『ターン終了時に失われる』のがどのタイミング（クリンナップの前か後か）かは、他拡張の持続と絡むときに差が出る可能性がある。
- 【Way of the Squirrel とこのエンジンの先引き順序】公式は「クリンナップで手札を引いた後に2枚引く」。本エンジンは『自分の手番終了時に次の手札を先引きする』特殊設計なので、先引きの後に2枚足す解釈で正しいはずだが、冒険の Save（保存）と同じ扱いでよいかは実装時に回帰テストで固めること（公式FAQに本エンジン固有の順序についての記述は当然無い）。
- 【Way of the Mouse の対象に『準備が必要なカード』を許すか】公式は許す（そのカードの準備も行う）が、Dominion Online は実装都合で除外している。本プロジェクトでどちらを採るかは設計判断（公式準拠なら若き魔女のBane・連携カード・トラベラー成長先の山まで準備することになり実装コストが大きい）。
- 【日本語版（ホビージャパン）の印刷テキスト】日本語ウィキは「日本語版カードはエラッタ前のテキストで印刷されている」と明記している。本アプリは過去の前例（ルネサンス §0-22）どおり現行エラッタを採用する想定だが、ユーザーの最終確認が要る。

<details><summary>機構調査のメモ</summary>

## 一次資料の到達状況（重要）

**確度 high（一次資料に直接到達して逐語確認）**
- **RGG 公式ルールブックPDF**（`https://www.riograndegames.com/wp-content/uploads/2020/01/Dominion-Menagerie-Rules.pdf`・30MB）を実DL → `pdftotext -layout` で全文抽出。Exile / Horse / Ways / Events / Reactions / Unusual costs / Durations / Setup の各節を**逐語**で取得済み（本回答の official_rules はこのテキストが正本）。抽出テキストのローカル控え＝`C:\Users\b1242\AppData\Local\Temp\menagerie.txt`（953行）。
  - 注意：PDF のコイン記号・負債記号は画像なので pdftotext で落ちる（`+ ,` のように空く）。金額は下記の英語ウィキで補完し、両者を突き合わせて確定した。
- **英語ウィキ（Fandom ミラー `dominionstrategy.fandom.com`）** を MediaWiki API 経由で取得。カードテキスト＋Official FAQ ＋ Other rules clarifications を取得。全20ウェイのテキスト、Exile / Horse / Way / Menagerie(expansion) / 各 Exile 使用カードの FAQ を確認済み。
- **日本語公式名**：`https://wikiwiki.jp/dominiondeck/移動動物園（拡張）` から全カードの日本語名を取得（Dominion Online の公式日本語訳ベース）。**Way の日本語公式名は「ウェイ」ではなく「習性」**、Exile = 追放 / Exile mat = 追放マット / Horse = 馬。

**確度 medium-high（英語一次資料に直接到達できず、日本語の現行ウィキが引用する英語原文で確認）**
- **2025年2月エラッタ（英語版 Menagerie 改版に伴う）**。本家 `wiki.dominionstrategy.com`（Anubis によるボット遮断）、移転先 `dominionstrategy.miraheze.org`（Cloudflare 403）、`forum.dominionstrategy.com`（Anubis）のいずれも**到達不能**（curl / WebFetch / r.jina.ai プロキシ / Wayback すべて失敗）。
  - 代替として、**現在も更新中の日本語ウィキ（wikiwiki.jp/dominiondeck）が各カードページに掲示しているエラッタ告知＋英語原文**を採用した。同ウィキは変更後の英語テキストをそのまま載せており（例：`Setup: Set aside an unused non-Duration Action costing $2 or $3.`）、日本語ブログ `hirotashi-domi.hatenablog.com/entry/2025/02/17/202459`（2025年2月エラッタまとめ）とも一致した。**2独立ソース一致**。
  - Fandom ミラーは 2024年10月時点のスナップショットで、**2025年エラッタを反映していない**（Way of the Mouse が旧テキストのまま）。Fandom だけを見ると誤実装するので注意。
- エラッタ対象の網羅性を確かめるため、**Menagerie の王国30種＋イベント20種＋ウェイ20種の全70ページを日本語ウィキで機械走査**し、エラッタ告知バナーの有無を確認した。カードテキストが変わったのは **Way of the Mouse / Reap / Gamble の3枚のみ**。Gatekeeper・Mastermind・Way of the Butterfly・Way of the Turtle のバナーは**全体ルール変更（持続が場を離れた場合）の解説**であって、カードテキストの変更ではない。

## この実装で特に効く設計上の要点（既存コードとの対応）

1. **追放マット `p.exile` は物理カードのゾーン**。`allCards` と `test/invariants.test.js` の ZONES に必ず追加（酒場マット `tavern`・貨物船 `cargo` と同じ扱い）。公開情報なので `maskStateFor` では伏せない。
2. **馬の山は非サプライ**。`NON_SUPPLY` に登録し、PROGRESS §6 の「4系統除外チェックリスト」（emptyPileCount／canBuyCard／闇市場デッキ母集団／汎用獲得の engine + CPU 両側）を必ず通す。**engine を締めるのと CPU を締めるのは必ず同一コミット**（片方だけだと本番 livelock）。
3. **馬の『山に戻す』は獲得でも廃棄でもない新しい移動**。既存の `returnToPile`（交易商人で使用）を流用できる。
4. **習性は既存の pending 機構と別系統**：「アクションカードを使用する**すべての経路**」に選択の窓を挟む必要がある（PLAY_ACTION だけでは足りない。命令・リアクション・購入フェイズのアクション・進軍/苦労・脇からの使用まで）。本プロジェクトは既に `playAsCommand` / `applyEffect` に経路が分散しているので、**`playActionWithWay(state, pi, cardId, opts)` のような単一の入口を先に作る**のが安全。ここを個別 if で回すと必ず漏れる。
5. **習性を使っても『そのカードを使用した』カウントは増える**（共謀者・岐路・行商人・ならず者など）。既存の `t.actionsPlayed` 系カウンタは習性でも普通に増やす。
6. **変動コスト**は `cardCost(state, id)` に集約する。PROGRESS §0-23 の述語（`gainableBase`/`costUpTo`/`costUnder`/`costExact`/`sameCost`）が自動追従するので、**素の `cardCost(state,id) <= N` を新規に書かないこと**。
7. **持続が場を離れたら予約を破棄**（2025年ルール）は、馬／チョウ／ウミガメの習性を実装した時点で到達可能になる。`armDuration` / `delayedEffects` にターン終了時の掃除を足す。
8. **相手のターンに自分の `inPlay` にカードが載る**（黒猫・牧羊犬・鷹匠・村有緑地）。既存の隊商の護衛(caravan_guard) と同型なので、その実装を一般化するのが安全。cleanup は「そのターンに場に出た全プレイヤーのカード」を捨てる必要がある。
9. **新 pending には必ず4点セット**（engine reducer＋`PLAYER_ACTIONS`＋CPU `decidePending`＋UI `viewPendingModal`）＋終端保証。習性の選択窓も pending になるので、CPU 側に「習性を使うか」の判断を必ず入れる（無いと CPU 無限ループ）。

## 日本語公式カード名 対応表（実装時の表示用）

**王国カード30種**：Sleigh そり$2／Black Cat 黒猫$2／Supplies 配給品$2／Camel Train ラクダの隊列$3／Goatherd ヤギ飼い$3／Scrap がらくた$3／Snowy Village 雪深い村$3／Sheepdog 牧羊犬$3／Stockpile 備蓄品$3／Bounty Hunter 賞金稼ぎ$4／Cavalry 騎兵隊$4／Groom 馬丁$4／Hostelry 旅籠$4／Cardinal 枢機卿$4／Village Green 村有緑地$4／Displace 強制退去$5／Hunting Lodge 狩猟小屋$5／Kiln 炉$5／Livery 貸し馬屋$5／Paddock パドック$5／Sanctuary 聖域$5／Coven 魔女の集会$5／Barge 艀$5／Mastermind 首謀者$5／Gatekeeper 門番$5／Falconer 鷹匠$5／Fisherman 漁師$5*／Destrier デストリエ$6*／Wayfarer 行人$6*／Animal Fair 動物見本市$7*
**非サプライ**：Horse 馬$3*（30枚）
**イベント20種**：Delay 遅延$0／Desperation 絶望$0／Gamble 博打$2／Pursue 追求$2／Ride 乗馬$2／Toil 苦労$2／Enhance 増大$3／March 進軍$3／Transport 輸送$3／Banish 放逐$4／Bargain 特価品$4／Invest 投資$4／Seize the Day 今を生きる$4／Commerce 商売$5／Demand 要求$5／Stampede 暴走$5／Reap 刈り入れ$7／Enclave 包領$8／Alliance 同盟$10／Populate 植民$10
**習性20種**：チョウ／ラクダ／カメレオン／カエル／ヤギ／馬／モグラ／サル／ハツカネズミ／ラバ／カワウソ／フクロウ／雄牛／豚／ドブネズミ／アザラシ／羊／リス／ウミガメ／ミミズ（各「○○の習性」）
※`Alliance（同盟）` は略奪(Allies)拡張の同盟と日本語名が衝突するので id を分けること。

## 公式推奨キングダム（ルールブック掲載・Menagerie 単体20種のうち抜粋）
Intro to Horses（Way of the Sheep, Enhance ＋ Animal Fair, Barge, Destrier, Goatherd, Hostelry, Livery, Paddock, Scrap, Sheepdog, Supplies）／Intro to Exile（Way of the Worm, March ＋ Black Cat, Bounty Hunter, Camel Train, Cardinal, Falconer, …）／Living in Exile（Way of the Mule, Enclave ＋ Gatekeeper, Hostelry, Livery, Scrap, Stockpile ほか他拡張）など。**固定10種セットを自作せずに公式推奨をそのまま使える**のは本プロジェクトにとって好都合（帝国・ルネサンスでは自作していた）。

</details>

## 2. 王国カード 30種

| id | 和名 | 英名 | コスト | 種別 | 機構 |
|---|---|---|---|---|---|
| `animal_fair` | 動物見本市 | Animal Fair | $7 | action | alt-payment on-buy pile-count asterisk-cost |
| `barge` | 艀 | Barge | $5 | action, duration | duration choice |
| `black_cat` | 黒猫 | Black Cat | $2 | action, attack, reaction | attack reaction play-out-of-turn curse on-gain-trigger |
| `bounty_hunter` | 賞金稼ぎ | Bounty Hunter | $4 | action | exile |
| `camel_train` | ラクダの隊列 | Camel Train | $3 | action | exile on-gain |
| `cardinal` | 枢機卿 | Cardinal | $4 | action, attack | attack exile |
| `cavalry` | 騎兵隊 | Cavalry | $4 | action | horse on-gain phase-change |
| `coven` | 魔女の集会 | Coven | $5 | action, attack | attack exile curse |
| `destrier` | デストリエ | Destrier | $6 | action | variable-cost asterisk-cost |
| `displace` | 強制退去 | Displace | $5 | action | exile gain |
| `falconer` | 鷹匠 | Falconer | $5 | action, reaction | reaction on-gain gainer gain-to-hand |
| `fisherman` | 漁師 | Fisherman | $5 | action | variable-cost cost-modifier |
| `gatekeeper` | 門番 | Gatekeeper | $5 | action, duration, attack | duration attack exile on-gain setup |
| `goatherd` | ヤギ飼い | Goatherd | $3 | action | trash counts-previous-turn |
| `groom` | 馬丁 | Groom | $4 | action | horse gainer |
| `hostelry` | 旅籠 | Hostelry | $4 | action | horse on-gain |
| `hunting_lodge` | 狩猟小屋 | Hunting Lodge | $5 | action | discard-hand |
| `kiln` | 炉 | Kiln | $5 | action | next-play-trigger gainer |
| `livery` | 貸し馬屋 | Livery | $5 | action | horse this-turn on-gain |
| `mastermind` | 首謀者 | Mastermind | $5 | action, duration | duration replay |
| `paddock` | パドック | Paddock | $5 | action | horse empty-pile-count |
| `sanctuary` | 聖域 | Sanctuary | $5 | action | exile |
| `scrap` | がらくた | Scrap | $3 | action | horse trash-for-benefit |
| `sheepdog` | 牧羊犬 | Sheepdog | $3 | action, reaction | reaction on-gain divider |
| `sleigh` | そり | Sleigh | $2 | action, reaction | horse reaction on-gain divider |
| `snowy_village` | 雪深い村 | Snowy Village | $3 | action | action-lock |
| `stockpile` | 備蓄品 | Stockpile | $3 | treasure | exile treasure self-exile |
| `supplies` | 配給品 | Supplies | $2 | treasure | horse treasure topdeck on-play-gain |
| `village_green` | 村有緑地 | Village Green | $4 | action, duration, reaction | duration reaction on-discard divider |
| `wayfarer` | 行人 | Wayfarer | $6 | action | variable-cost divider |

### 動物見本市（Animal Fair・`animal_fair`）

- コスト $7 ／ 種別: action ／ 確度: high（和名: high）

**英語（現行）**

```
+$4
+1 Buy per empty supply pile.
————
Instead of paying this card's cost, you may trash an Action card from your hand.
```

**日本語（カタログ用・コピペ形）**

```
+4 コイン\n空のサプライの山1つにつき、+1 購入。\n————\nこれのコストを支払う代わりに、手札のアクションカード1枚を廃棄してもよい。
```

**裁定**

- 表記コストは $7*。* は「別の払い方がある」という目印だけで、コストは常に7コイン（改築・値切り屋・トレーダー等すべてで7コイン扱い）。
- +購入の数は「これをプレイした瞬間の空のサプライ山の数」で確定する。その後にターン中で山が空になっても（大使などで空でなくなっても）購入権の数は変わらない。
- 数えるのはサプライの山だけ。馬などの非サプライ山は数えない。空の山が0なら +購入 は0（+4コインのみ）。
- 「コストを支払う代わりに廃棄」は購入時のみ。手札にアクションカードが無ければ使えない。7コイン持っていなくても使える。この方法だとコインは1枚も払わないが、購入権は1消費する。
- 支払い方に関わらずコストは7コイン扱い。値切り屋（Haggler）はコスト7コイン未満の非勝利点カードを獲得させるし、立案（Plan）の廃棄トークンも通常どおり誘発する。
- 処理順は「廃棄時効果 → 購入時効果 → 獲得時効果」。例：ネズミを廃棄して支払うと、ネズミの廃棄時ドローが先に起き、それが呪いの森で山札の上に置かれる。

### 艀（Barge・`barge`）

- コスト $5 ／ 種別: action, duration ／ 確度: high（和名: high）

**英語（現行）**

```
Either now or at the start of your next turn, +3 Cards and +1 Buy.
```

**日本語（カタログ用・コピペ形）**

```
今、または次の自分のターンの開始時に、+3 カード、+1 購入。
```

**裁定**

- プレイ時に「今もらう」か「次の自分のターンの開始時にもらう」かを選ぶ（強制の二択）。
- 「今」を選んだ場合、艀は持続せずそのターンのクリンナップで捨て札になる（このターンだけは実質ただの +3カード +1購入）。
- 「次のターン」を選んだ場合、そのターンは何も起きず場に残り、次のターンの開始時に +3カード +1購入 を得てそのターンのクリンナップで捨て札になる。
- 玉座の間／首謀者などで複数回プレイした場合は、1回ごとに「今／次のターン」を選ぶ。1回でも「次のターン」を選べば艀は次のターンまで場に残り、複数回プレイさせたカード（首謀者など）も一緒に場に残る。
- 実装注意：このエンジンは自分の手番終了時に次の手札を先引きするため、「次のターン開始時」のドローは先引き済みの5枚に加算される。

### 黒猫（Black Cat・`black_cat`）

- コスト $2 ／ 種別: action, attack, reaction ／ 確度: high（和名: high）

**英語（現行）**

```
+2 Cards
If it isn't your turn, each other player gains a Curse.
————
When another player gains a Victory card, you may play this from your hand.
```

**日本語（カタログ用・コピペ形）**

```
+2 カード\n自分のターンでない場合、他のプレイヤーは各自、呪い1枚を獲得する。\n————\n他のプレイヤーが勝利点カードを獲得したとき、これを手札から使用してもよい。
```

**裁定**

- 自分のターンにプレイした場合は +2カード のみ（呪いは配らない）。他人のターンにプレイした場合のみ呪いを配る。
- リアクション条件は「他のプレイヤーが勝利点カードを獲得したとき」。自分のターン中に相手が勝利点を獲得した場合（大使で屋敷を渡した等）でも使用できるが、その場合は自分のターンなので呪いは配られない。
- リアクションでの使用は「アクションカードの使用」だがアクション権を消費しない。場に出るので、他人のターンに使った場合はそのターンのクリンナップで捨て札になる（持続ではない）。
- 呪いを配る順番は「黒猫の使用者からの順」ではなく、ターンプレイヤーを起点としたターン順（使用者は飛ばす）。例：A→B→C→D の並びで、Aのターン中にCが黒猫を使うと A→B→D の順に呪いを獲得する。
- アタックカードなので堀などのリアクションで無効化できる。呪い山が空なら呪いは獲得できない。
- 連鎖可能：黒猫のドローでもう1枚黒猫を引いたら、それも続けて使用できる。
- 相手の属州獲得に反応して黒猫を出し、その呪い獲得に別プレイヤーが牧羊犬で反応する、といった入れ子は可能。ただし呪い獲得の解決中に別の黒猫を割り込ませることはできない（属州の獲得時処理は一時停止され、黒猫の解決後に再開する）。

### 賞金稼ぎ（Bounty Hunter・`bounty_hunter`）

- コスト $4 ／ 種別: action ／ 確度: high（和名: high）

**英語（現行）**

```
+1 Action
Exile a card from your hand. If you didn't have a copy of it in Exile, +$3.
```

**日本語（カタログ用・コピペ形）**

```
+1 アクション\n手札1枚を追放する。それと同名のカードが追放マットに無かった場合、+3 コイン。
```

**裁定**

- まず +1アクション を得て、手札1枚を追放する。この追放は強制（任意ではない）。手札が0枚で追放できなかった場合は +3コイン も得られない。
- +3コイン の判定は「追放する前に、そのカードと同名のカードが追放マットにあったか」。今この効果で追放したカード自身は判定に含めない（そのため初回は必ず +3コイン になる）。
- 追放は獲得でも廃棄でもないので、獲得時／廃棄時効果は誘発しない。追放したカードは自分のものとしてゲーム終了時に得点計算に含まれる（呪いもマイナス点のまま残る）。
- 追放したカードは、後で同名カードを獲得したときに（追放マット上のそのカードを全部まとめて）捨て札に戻せる。

### ラクダの隊列（Camel Train・`camel_train`）

- コスト $3 ／ 種別: action ／ 確度: high（和名: high）

**英語（現行）**

```
Exile a non-Victory card from the Supply.
————
When you gain this, Exile a Gold from the Supply.
```

**日本語（カタログ用・コピペ形）**

```
サプライから勝利点カード以外のカード1枚を追放する。\n————\nこれを獲得したとき、サプライから金貨1枚を追放する。
```

**裁定**

- プレイ時の追放は強制。対象は「サプライにある」「勝利点タイプを持たない」カードならコスト制限なし（属州もプラチナも不可／可の区別はタイプのみ）。
- 勝利点タイプを併せ持つカード（貴族・遠隔地・ハーレム等）は追放できない。馬など非サプライ山のカードも追放できない。
- サプライから追放するとその山の枚数は減る＝山を空にできる（3山切れ・空山数の判定に影響する）。実装で山の減算を忘れないこと。
- サプライからの追放は「獲得」ではないので獲得時効果は誘発しない（国境の村・宿屋・呪われた村・失われし都市などの獲得時効果を回避できる／逆に利用もできない）。
- 獲得時効果（金貨1枚を追放）は、購入・効果獲得を問わずラクダの隊列を獲得したときに毎回誘発する。金貨の山が空なら何も起きない。
- 追放したカードは、後で同名カードを獲得したときにまとめて捨て札に戻せる（それが本来の使い方）。

### 枢機卿（Cardinal・`cardinal`）

- コスト $4 ／ 種別: action, attack ／ 確度: high（和名: high）

**英語（現行）**

```
+$2
Each other player reveals the top 2 cards of their deck, Exiles one costing from $3 to $6, and discards the rest.
```

**日本語（カタログ用・コピペ形）**

```
+2 コイン\n他のプレイヤーは各自、山札の上から2枚を公開し、コスト3コインから6コインのカード1枚を追放し、残りを捨て札にする。
```

**裁定**

- アタックカード。堀などのリアクションで無効化できる。
- 追放されたカードは「被害者自身の追放マット」に置かれる（相手のものになるわけではない）。得点計算では引き続き被害者のカードとして数える。
- 公開した2枚とも コスト3〜6コイン の場合、どちらを追放するかを選ぶのは アタックを受けたプレイヤー。
- コスト範囲は成分ごとの厳密判定＝「コイン3〜6かつ ポーション0・負債0」のカードのみ。ポーション費用のカード（錬金術師など）や負債コストのカードは、コイン部分が3〜6でも対象外。
- 該当するカードが無ければ2枚とも捨て札にする。山札＋捨て札が1枚しかなければ1枚だけ公開する（0枚なら何も起きない）。
- 追放は獲得ではないので、望楼や交易人で置き換えることはできない。

### 騎兵隊（Cavalry・`cavalry`）

- コスト $4 ／ 種別: action ／ 確度: high（和名: high）

**英語（現行）**

```
Gain 2 Horses.
————
When you gain this, +2 Cards, +1 Buy, and if it's your Buy phase return to your Action phase.
```

**日本語（カタログ用・コピペ形）**

```
馬2枚を獲得する。\n————\nこれを獲得したとき、+2 カード、+1 購入。自分の購入フェイズ中なら、アクションフェイズに戻る。
```

**エラッタ**: カードテキストの変更（エラッタ）は無い。ただし2022年のルール変更で挙動が1点変わった：購入フェイズ中に騎兵隊（またはヴィラ）を獲得してアクションフェイズに戻る場合、以前は「購入フェイズ終了時に誘発する効果は誘発しない」だったが、「誘発する」に変更された。

**裁定**

- プレイ時の馬2枚獲得は強制。馬の山に1枚しか無ければ1枚だけ獲得、0枚なら何も起きない（馬は非サプライ・全30枚）。
- 獲得時効果は購入でも効果獲得でも、どのフェイズでも、他人のターン中の獲得でも誘発する。ただしアクションフェイズに戻るのは「自分の購入フェイズ中に獲得した」場合のみ。他人のターン中に得た +1購入 は使えず持ち越しもできない。
- 獲得時効果は「騎兵隊をプレイしたこと」にはならない＝騎兵隊は場に出ない。よって法貨・御料車などアクション使用に反応するリザーブは呼び出せない。
- アクションフェイズに戻ってもアクション権は増えない（ヴィラと違う）。残っていたアクション権がそのまま使える。
- アクションフェイズに戻ってもターン開始時効果は再発火しない。ただしその後もう一度購入フェイズに入るので「購入フェイズ開始時」の効果は再発火し得る。
- +2カード のドローは「アクションフェイズに戻る前」に行う。
- 2022年ルール変更：この方法で購入フェイズを抜けるとき「購入フェイズ終了時」の効果は誘発する（宝物庫／商人ギルド／ワイン商／野外劇など）。複数回購入フェイズを経ればその回数だけ誘発する。なお探査・隠遁者の「そのフェイズで何も獲得していない場合」は騎兵隊を獲得済みなので条件を満たさない。
- 山札の上に獲得した場合（要求など）、+2カード でその騎兵隊自身を引く。捨て札に獲得してドローでシャッフルが起きた場合、その騎兵隊もシャッフルに含まれ、以後は他の獲得時移動効果（変わり身・技術革新など）で動かせなくなる。
- 獲得時効果同士の順番は獲得者が選べる（変わり身・技術革新などとの競合）。

### 魔女の集会（Coven・`coven`）

- コスト $5 ／ 種別: action, attack ／ 確度: high（和名: high）

**英語（現行）**

```
+1 Action
+$2
Each other player Exiles a Curse from the Supply. If they can't, they discard their Exiled Curses.
```

**日本語（カタログ用・コピペ形）**

```
+1 アクション\n+2 コイン\n他のプレイヤーは各自、サプライから呪い1枚を追放する。できない場合、そのプレイヤーは追放マットの呪いをすべて捨て札にする。
```

**裁定**

- アタックカード。堀などのリアクションで無効化できる。
- 被害者はターン順に1人ずつ処理する。途中で呪い山が空になり得るので、あるプレイヤーは呪いを追放し、別のプレイヤーは追放マットの呪いを捨てる、という状況が起こる。
- 「できない場合」＝サプライの呪い山が空の場合。そのプレイヤーは追放マット上の呪いを（枚数に関わらず）すべて捨て札にする。魔女の集会以外の手段で追放した呪いも対象。
- サプライからの追放も追放マットからの捨て札も「獲得」ではないので、望楼・交易人などの獲得置換リアクションでは防げない。
- 追放マットの呪いは得点計算に含まれる（追放している間もマイナス1点のまま）。捨て札になるとデッキに入って邪魔になる、という二段構えのアタック。
- 追放マットからの捨て札は「捨て札にする」行為なので、トンネル（異郷）や村有緑地の反応条件を満たす。

### デストリエ（Destrier・`destrier`）

- コスト $6 ／ 種別: action ／ 確度: high（和名: high）

**英語（現行）**

```
+2 Cards
+1 Action
————
During your turns, this costs $1 less per card you've gained this turn.
```

**日本語（カタログ用・コピペ形）**

```
+2 カード\n+1 アクション\n————\n自分のターン中、これはこのターンに獲得したカード1枚につきコストが1コイン安くなる。
```

**裁定**

- 表記コストは $6*。* は「ターン中にコストが変動する」目印。基準は「ターンプレイヤーがそのターンに獲得したカードの枚数」で、全プレイヤーから見て同じコストになる（プレイヤーごとにコストが違う状況は起きない）。
- 他プレイヤーの獲得では下がらない。例：魔女で相手に呪いを配ってもコストは下がらない。逆に、詐欺師や総督などターンプレイヤー以外が獲得する処理でも下がらない。
- コストは0コイン未満にはならない。橋・街道などの通常のコスト軽減も重ねて効く。
- コストは獲得のたびに即座に変わる。1つの効果で2枚獲得する場合も1枚目の獲得直後に変わる（石工で廃棄→公領→次は銀貨、など）。
- 購入時効果を解決している時点ではまだそのカードを獲得していないので、コストは下がっていない。
- 交換（トラベラー等）や「サプライから追放マットへの移動」は獲得ではないのでカウントしない。廃棄置き場や非サプライからの獲得、望楼のリアクションで廃棄置き場に移した場合はカウントする。
- 実装注意：このプロジェクトの `cardCost` に「そのターンの獲得枚数」による動的減算を足す必要がある。獲得可否の述語（gainableBase / costUpTo / costExact など）はすべて動的コストを見ること。

### 強制退去（Displace・`displace`）

- コスト $5 ／ 種別: action ／ 確度: high（和名: high）

**英語（現行）**

```
Exile a card from your hand. Gain a differently named card costing up to $2 more than it.
```

**日本語（カタログ用・コピペ形）**

```
手札1枚を追放する。そのカードのコスト+2コイン以下で、名前の異なるカード1枚を獲得する。
```

**裁定**

- 手札1枚の追放は強制。追放したなら獲得も強制（獲得できるカードが存在する限り）。手札が0枚なら追放も獲得も起きない。
- 獲得できるのはサプライにあるカードのみ。馬などの非サプライ山からは獲得できない。
- 「名前の異なる」＝追放したカードと同名のカードは獲得できない。
- 獲得するカードは追放したカードより高い必要はない。同じコストでも安くてもよい（例：属州を追放して金貨を獲得できる）。
- コスト比較は成分ごと。追放したカードのコストにポーションや負債が含まれる場合、その成分を保ったまま「コイン+2まで」。例：大学（2コイン+ポーション）を追放→コスト4コイン+ポーション以下（ポーション無しの4コイン以下でもよい）。大金（8コイン+負債8）を追放→10コイン+負債8以下（負債無しの属州・白金貨・王城でもよい）。
- 追放は獲得でも廃棄でもないので、追放したカードの獲得時／廃棄時効果は誘発しない。追放したカードは自分のものとして得点計算に残る（勝利点を追放しても点は減らない）。
- 獲得したカードが追放マット上のカードと同名なら、通常どおり「獲得時に追放マットの同名カードを全部まとめて捨て札に戻す」を選べる。

### 鷹匠（Falconer・`falconer`）

- コスト $5 ／ 種別: action, reaction ／ 確度: high（和名: high）

**英語（現行）**

```
Gain a card to your hand costing less than this.
---
When any player gains a card with 2 or more types (Action, Attack, etc.), you may play this from your hand.
```

**日本語（カタログ用・コピペ形）**

```
これより安いカード1枚を手札に獲得する。\n————\n誰かが種別（アクション、アタックなど）を2つ以上持つカード1枚を獲得したとき、手札からこれを使用してもよい。
```

**裁定**

- 「これより安い」＝鷹匠自身のコスト（通常5コイン）より厳密に安いカード。コスト比較はコイン/ポーション/負債の成分ごとに行う。橋や街道で鷹匠自身のコストが下がれば基準も下がる。
- 獲得できるのはサプライからのみ。非サプライの馬・賞品・戦利品などは獲得できない（馬は「馬を獲得する」と明示された効果でしか取れない）。
- リアクションとして手札から使用したとき、通常の使用と同じく場に出るが、アクション権を消費しない。そして上段の「手札に獲得する」効果も通常どおり解決する（＝リアクションが本体効果を持つ型）。
- 反応の条件は「誰かが種別を2つ以上持つカードを獲得したとき」。自分の獲得でも相手の獲得でもよく、誰のターンでもよい。購入による獲得でも、それ以外の獲得でもよい。
- 種別＝カード下部の行に書かれた語（アクション/アタック/呪い/持続/リアクション/財宝/勝利点 など。他拡張の種別も含む）。2つ以上あれば対象。
- 鷹匠自身が「アクション・リアクション」の2種別なので、職人などで鷹匠を手札に獲得した場合、その獲得に反応して即座にその鷹匠を使用できる。
- 相手のターン中に複数のプレイヤーが同時に反応できる場合、手番プレイヤーから順に反応する。1つ解決するたびに先頭のプレイヤーから見直す。
- 相手のターンに使用した鷹匠は、そのターンのクリーンアップで捨て札になる（持続でないため）。
- 資本主義（ルネサンス）と相続（冒険）はカードの種別数を変えるので、鷹匠の判定もそれに従う。ただしこれらは「それを購入したプレイヤーのターン中」のみ有効＝相手のターンに屋敷を獲得しても相続では発火しない。
- ペテン師（charlatan・移動動物園）は呪いを財宝にもするので、相手に呪いを獲得させると鷹匠を使用できるようになる。
- 実装注意：獲得トリガーで「全プレイヤー」に反応窓を開く必要がある（従来の獲得トリガーは獲得者本人のみのものが多い）。相手ターン中の使用＝場に出る／クリーンアップで捨てる経路が要る。

### 漁師（Fisherman・`fisherman`）

- コスト $5 ／ 種別: action ／ 確度: high（和名: high）

**英語（現行）**

```
+1 Card
+1 Action
+$1
---
During your turns, if your discard pile is empty, this costs $3 less.
```

**日本語（カタログ用・コピペ形）**

```
+1 カード\n+1 アクション\n+1 コイン\n————\nターン中、ターンプレイヤーの捨て札置き場が空の場合、このカードのコストは3コイン下がる。
```

**裁定**

- 通常コストは5コイン。ターンプレイヤーの捨て札置き場が空である間、コストは2コインになる（カード上の * は「コストが変動する」ことのリマインダー）。
- コストが変わるとき、すべてのコピーが、あらゆる目的で、全員から見て同時に変わる。相手のターン中も基準は「そのターンのプレイヤーの捨て札置き場」＝英語カード文の「During your turns」と公式FAQの「whenever the player whose turn it is has an empty discard pile」は同じことを言っている。
- コストは0コイン未満にならない。橋（陰謀）などの他のコスト軽減とも累積する。
- 判定は獲得/購入するその瞬間。捨て札が空で2コインの漁師を買うと、獲得した漁師が捨て札に入って空でなくなるため、同一ターンに2枚目を2コインで買うことはできない（公式FAQの明示例）。
- 石工で銀貨を廃棄し捨て札が空なら漁師1枚は獲得できるが、2枚目はできない（獲得した漁師が捨て札に入るため）。
- 交易商人（異郷）で漁師を廃棄した場合、廃棄した時点のコスト（2 or 5）に応じて銀貨2枚または5枚を得る。
- 貸し馬屋（Livery）との相互作用：捨て札が空のときに漁師を獲得するとその瞬間のコストは2コインなので馬を得られない。
- 実装注意：cardCost が state（ターンプレイヤーの捨て札枚数）に依存する動的コストになる。engine の canBuyCard／獲得述語（costUpTo/costExact/gainableBase）・CPU の候補選び・UI のモーダル filter が全て同じ cardCost を見ること。

### 門番（Gatekeeper・`gatekeeper`）

- コスト $5 ／ 種別: action, duration, attack ／ 確度: high（和名: high）

**英語（現行）**

```
At the start of your next turn, +$3. Until then, when another player gains an Action or Treasure card they don't have an Exiled copy of, they Exile it.
```

**日本語（カタログ用・コピペ形）**

```
あなたの次のターンの開始時に、+3 コイン。それまでの間、他のプレイヤーは各自、自分の追放マットに同名のカードがないアクションカードか財宝カード1枚を獲得したとき、それを追放する。
```

**裁定**

- 使用した瞬間には何も起きない持続アタック。アタックカードなので、使用したときに他のプレイヤーは堀などのリアクションを公開でき、公開したプレイヤーはこのアタックの影響を受けない（＝そのプレイヤーは追放されない）。灯台などの受動免疫も同様。
- 追放するのはアクションカードと財宝カードのみ。属州などの勝利点カードや呪いは追放しない（ただしペテン師で呪いが財宝にもなっている場合などは種別に従う）。
- 条件は「獲得したカードと同名のカードが、そのプレイヤーの追放マットに1枚も無い」こと。既に同名を追放していれば追放されず、通常どおり「獲得時に追放マットの同名カードを全部捨て札にしてもよい」を選べる。
- 追放マットにどうやって置かれたかは問わない（門番以外の手段で追放していてもよい）。
- 獲得したカードが獲得後に別の場所へ動いていた場合は追放できない（stop-moving ルール）。例：橇（Sleigh）で獲得札を手札に移すと門番は追放に失敗する。
- 逆に、獲得「後」にカードを動かす効果（Replace／Summon など）よりも門番の追放が先に来るので、門番が勝つ。
- カードが直接どこかに獲得される場合（例：Supplies が馬を山札の上に獲得する）でも門番は追放できる。
- 一度も動いていないカードは lose track しない。遊牧民の野営地を山札の上に獲得し、物見やぐらを公開して山札の上に置いても「移動」ではないので門番の追放を妨げない。
- あなたのターン中に他のプレイヤーがカードを獲得した場合も追放される（例：Bargain で相手に馬を与えると、その馬が追放される）。
- 追放効果はあなたの次のターンが始まった瞬間に終わる。ターン開始時の他の効果を先に解決してから門番の追放を続ける、という選択はできない。
- 持続カード＝やることが残っている間は場に残り、次のターンのクリーンアップで捨て札になる。
- 追放（Exile）の共通ルール：追放＝自分の追放マットに置くこと。獲得でも廃棄でもない。マット上のカードは自分のもので、ゲーム終了時の得点に数える。マットは表向き＝公開情報。サプライから追放しても「獲得」ではないので獲得時能力は誘発しない。マットから捨て札にするのは「捨てる」なのでトンネル等を誘発しうる。
- 追放の「同名カードを捨てる」ルール：カードを獲得したとき、その同名のカードを追放マットから捨て札にしてもよい。全部捨てるか1枚も捨てないかの二択で、一部だけ捨てることはできない。
- 実装注意：セットアップで追放マット（`p.exile` 配列）が要る。追放マットのカードは所有カード＝保存則 tally と allCards に入れること。

### ヤギ飼い（Goatherd・`goatherd`）

- コスト $3 ／ 種別: action ／ 確度: high（和名: high）

**英語（現行）**

```
+1 Action

You may trash a card from your hand.

+1 Card per card the player to your right trashed on their last turn.
```

**日本語（カタログ用・コピペ形）**

```
+1 アクション\n手札のカード1枚を廃棄してもよい。\n右隣のプレイヤーが自分の直前のターンに廃棄したカード1枚につき、+1 カード。
```

**裁定**

- 廃棄は任意。廃棄しなかった場合でもカードは引く（引く枚数は右隣の廃棄枚数だけで決まる）。
- 引く枚数＝右隣のプレイヤーが「その人の直前のターン」に廃棄したカードの総枚数。誰が廃棄させたか（本人の効果でもアタックによる廃棄でも）は問わない。
- 同じカードを2回廃棄した場合も2枚と数える。例：右隣が同じ城塞を2回廃棄していたら +2 カード。
- 2人戦では右隣＝相手。まだ右隣が1度もターンを終えていない場合（1巡目など）は0枚＝ドローなし。
- 解決順：+1 アクション → 手札1枚を廃棄してもよい → ドロー。自分がこのターンに廃棄した枚数は自分のドローには影響しない。
- 実装注意：各プレイヤーごとに「今ターン廃棄した枚数」カウンタを持ち、ターン終了時に「直前のターンの廃棄枚数」へ退避する仕組みが要る。カウントは trashCard の共通入口で行うこと（城塞のように廃棄置き場に残らないカードも1枚と数える）。同一ターンにヤギ飼いを複数枚使えば、いずれも同じ枚数を参照する。

### 馬丁（Groom・`groom`）

- コスト $4 ／ 種別: action ／ 確度: high（和名: high）

**英語（現行）**

```
Gain a card costing up to $4. If it's an...

Action card, gain a Horse;
Treasure card, gain a Silver;
Victory card, +1 Card and +1 Action.
```

**日本語（カタログ用・コピペ形）**

```
コスト4コイン以下のカード1枚を獲得する。獲得したカードが……\nアクションカードの場合、馬1枚を獲得する。\n財宝カードの場合、銀貨1枚を獲得する。\n勝利点カードの場合、+1 カード、+1 アクション。
```

**裁定**

- まずカードを獲得し、その後に記載された順（アクション→財宝→勝利点）でボーナスを適用する。
- 1枚のカードが複数のボーナスを与えうる。例：風車（陰謀・アクション＋勝利点）を獲得すると、馬1枚を獲得したうえで +1 カード +1 アクション。
- ボーナスは「獲得したカードによって誘発した効果」の後に解決する。例：Cemetery（墓地）を獲得した場合、先に墓地の獲得時廃棄を解決し、その後にドロー＋アクションを得る＝引いたカードを墓地で廃棄することはできない。
- カード文の「それ（It）」＝馬丁で獲得したカードを指す。獲得置換効果（when-would-gain）などで実際には獲得しなかった場合、ボーナスは一切得られない。
- 獲得は強制（任意ではない）。ただしコスト4コイン以下の獲得可能なカードがサプライに1枚も無ければ何も起きない。
- コスト比較は成分ごと。ポーション費用や負債コストを持つカードは「コスト4コイン以下」に含まれない。
- 馬の山が空なら馬は獲得できない（失敗するだけで他の処理は続く）。銀貨の山が空でも同様。
- 実装注意：獲得先はサプライ。馬は非サプライ山だが「馬を獲得する」と明示されているので獲得できる。

### 旅籠（Hostelry・`hostelry`）

- コスト $4 ／ 種別: action ／ 確度: high（和名: high）

**英語（現行）**

```
+1 Card
+2 Actions
---
When you gain this, you may discard any number of Treasures, revealed, to gain that many Horses.
```

**日本語（カタログ用・コピペ形）**

```
+1 カード\n+2 アクション\n————\nこれを獲得したとき、手札から好きな枚数の財宝カードを公開して捨て札にしてもよい。そうした場合、捨て札にした枚数と同じ枚数の馬を獲得する。
```

**裁定**

- 獲得時能力。購入による獲得でも、他の効果による獲得でもよい。
- 捨てるのは手札からの財宝カード。捨てる財宝は公開する。
- 任意＝0枚でもよい。財宝カード以外は捨てられない。
- 馬の山の残りが足りない場合、残っている分だけ獲得する。
- 実装注意：これは「獲得時に対話（枚数選択）が発生する on-gain」なので pending が必要。既存の獲得時対話ゲート（!pending / _gainDepth）に注意し、獲得キュー（onGainQueue）に積む形にすること。
- 資本主義（ルネサンス）で財宝になったアクションカードも「財宝カード」として捨てられる＝財宝判定は動的述語（isTreasureFor）を使うこと。

### 狩猟小屋（Hunting Lodge・`hunting_lodge`）

- コスト $5 ／ 種別: action ／ 確度: high（和名: high）

**英語（現行）**

```
+1 Card
+2 Actions

You may discard your hand for +5 Cards.
```

**日本語（カタログ用・コピペ形）**

```
+1 カード\n+2 アクション\n手札をすべて捨て札にしてもよい。そうした場合、+5 カード。
```

**裁定**

- 解決順が重要：まず +1 カードを引き、+2 アクションを得て、その後に「手札を全部捨てるか」を決める。捨てる手札には今引いたカードも含まれる。
- 捨てることを選んだ場合、5枚引く。捨てたカードを巻き込んでシャッフルが起きることがある。
- +1 カードを引いた後に手札が0枚でも、「手札を捨てて +5 カード」を選べる（0枚捨てて5枚引く）。
- 捨てるのは任意。
- 実装注意：手札を捨てる処理は捨て札トリガー（トンネル／村の緑地 等）を誘発する共通入口を通すこと。

### 炉（Kiln・`kiln`）

- コスト $5 ／ 種別: action ／ 確度: high（和名: high）

**英語（現行）**

```
+$2

The next time you play a card this turn, you may first gain a copy of it.
```

**日本語（カタログ用・コピペ形）**

```
+2 コイン\nこのターン、次にカード1枚を使用するとき、その解決前に、それと同じカード1枚を獲得してもよい。
```

**裁定**

- 対象のカード種別は問わない（アクションでも財宝でもよい）。ただし炉の直後に使用したカード1枚だけが対象。
- 獲得できるのはサプライからのみ。その山がサプライに無い／空なら獲得できない。
- 獲得は任意で、そのカードの効果を解決する「前」に行う。
- 次に使ったカードがアタックの場合、相手が堀などを使うかどうかを決める「前」に獲得する。
- 玉座の間で炉を2回使うと、1回目の炉が窓を張る→次に使用されるカードは2回目の炉自身なので炉1枚を獲得してよい→2回目の炉が改めて窓を張るので、その後に使う次のカードのコピーも獲得してよい。炉を続けて使っても窓は重ならず、連鎖する形になる。
- 次に使うカードに習性（Way）を使っても炉には影響しない（コピー獲得は通常どおりできる）。習性を使うかの選択は、堀や炉のような「まず（first）」の能力の後に行う。
- 炉→Stockpile の場合：先に Stockpile を1枚獲得し、追放マットの Stockpile を捨ててもよく、その後で使用した Stockpile を追放する。
- 冒険の +1 カードトークンがその山に乗っている場合、コピー獲得の前でも後でも +1 カードを得られる。
- 玉座の間で炉を使って炉を獲得した場合、その獲得に牧羊犬（Sheepdog）で反応できるが、まだ炉を2回目に解決していないので牧羊犬のコピーは獲得できない。
- 炉→Conspirator（陰謀）→2枚目の Conspirator を獲得して技術革新で使用、とした場合、両方の Conspirator が +1 カード +1 アクションを与える。
- 実装注意：`turn` に「次の1回のカード使用時に開く獲得窓」フラグが要る。窓は「カードを使用する処理の冒頭」で消費し、獲得を解決してからカード効果を適用すること。財宝の使用（PLAY_ALL_TREASURES を含む）でも発火する点に注意。

### 貸し馬屋（Livery・`livery`）

- コスト $5 ／ 種別: action ／ 確度: high（和名: high）

**英語（現行）**

```
+$3

This turn, when you gain a card costing $4 or more, gain a Horse.
```

**日本語（カタログ用・コピペ形）**

```
+3 コイン\nこのターン、あなたがコスト4コイン以上のカード1枚を獲得したとき、馬1枚を獲得する。
```

**裁定**

- 効果は累積する。例：首謀者で貸し馬屋を3回使えば、そのターンにコスト4コイン以上のカードを獲得するたびに馬を3枚得る。
- 購入による獲得でも、それ以外の獲得でもよい。
- コストは「獲得したその瞬間」の値で判定する（獲得後ではない）。捨て札置き場が空のときに漁師（この時2コイン）を獲得しても馬は得られない。
- 「このターン」なので、貸し馬屋が場を離れても効果はターン終了まで続く（Way of the Horse で山に戻した場合など）。
- 獲得する馬自体はコスト3コインなので、馬の獲得で貸し馬屋がさらに誘発することはない。
- 貸し馬屋を獲得して技術革新（ルネサンス）で使用した場合は馬を得る。一方、炉で貸し馬屋のコピーを獲得した場合は、まだ貸し馬屋の指示を解決していないので馬は得られない。
- 弟子（Disciple）や Specialist で貸し馬屋のコピーを獲得した場合は馬を得る。
- 馬の山が空なら獲得できない。
- 2022年の一般エラッタで「while this is in play（これが場にある間）」→「this turn（このターン）」への言い換えが行われたが、貸し馬屋は2020年の初版から「This turn」表記＝このカード自体にエラッタは無い（2020年1月版RGGルールブックのカード面画像で確認）。

### 首謀者（Mastermind・`mastermind`）

- コスト $5 ／ 種別: action, duration ／ 確度: high（和名: high）

**英語（現行）**

```
At the start of your next turn, you may play an Action card from your hand three times.
```

**日本語（カタログ用・コピペ形）**

```
あなたの次のターンの開始時に、手札のアクションカード1枚を3回使用してもよい。
```

**裁定**

- 使用は任意。使用する場合は1回目を完全に解決してから2回目、3回目を使用する。間に他のカードを使用しない（カードの指示による場合を除く）。
- この3回の使用はアクション権を消費しない。例：首謀者で賞金稼ぎを使うと合計 +3 アクションを得て、その後に通常の1回＋3回＝計4枚のアクションカードを使える。
- 首謀者が持続カードを使用した場合、その持続カードが場を離れるまで首謀者も場に残る（何回使用したかを追跡するため）。
- 首謀者が別の首謀者を使用した場合、両方が場に残り、その次のターンには3枚の別々のアクションカードをそれぞれ3回ずつ使用できる。
- 首謀者が馬を使用した場合：+2 カード +1 アクション → 馬を山に戻す → +2 カード +1 アクション（もう戻せない）→ +2 カード +1 アクション（同様）。戻すのは1回だけだがボーナスは3回得る。
- 首謀者が玉座の間やはみだし者を使用し、それらが持続カードを使用した場合は、首謀者は場に残らない（首謀者自身が直接持続カードを使用した場合のみ残る）。
- 首謀者が持続カード（例：2枚目の首謀者）を使用しても、それを場から取り除いた場合（例：Way of the Horse で山に戻した場合）、首謀者は場に残らない。この場合、その持続の効果は次のターンに自分で覚えておく必要がある。
- 習性（Way）がある場合、3回の使用それぞれについて Way を使うかどうかを選べる。対象が持続カードのとき、少なくとも1回を本来の効果で使用した場合のみ場に残る。
- ターン開始時の対話なので、他の持続効果と同じ「ターン開始時キュー」に積むこと。
- 実装注意：既存の玉座の間／王の宮廷と同型の再演だが、(1) 発火がターン開始時（持続）である点、(2) 首謀者が場に残るかどうかが「使用した対象が持続カードか」に依存する点、の2つが新しい。

### パドック（Paddock・`paddock`）

- コスト $5 ／ 種別: action ／ 確度: high（和名: high）

**英語（現行）**

```
+$2
Gain 2 Horses.
+1 Action per empty Supply pile.
```

**日本語（カタログ用・コピペ形）**

```
+2 コイン\n馬2枚を獲得する。\n空のサプライの山1つにつき、+1 アクション。
```

**裁定**

- 解決順は上から＝+2コイン → 馬2枚を獲得 → **その時点で**空のサプライの山を数えて1つにつき +1 アクション。
- 空の山を数えるのは**プレイした瞬間の1回だけ**。その後ターン中に山が空になっても +アクションは増えないし、大使（海辺）等で空でなくなっても減らない（公式FAQ）。
- 数えるのは**サプライの山だけ**。馬のような非サプライ山は数えない（公式FAQ）。銅貨・呪い・勝利点などサプライにある山はすべて対象。
- 馬を獲得したことで山が空になった場合（例：獲得した馬をチェンジリングと交換してチェンジリングの山が空になる）、その山も +1 アクションに数える＝**獲得が先・カウントが後**。
- 馬の山が空なら馬は獲得できない（獲得に失敗するだけ）。

### 聖域（Sanctuary・`sanctuary`）

- コスト $5 ／ 種別: action ／ 確度: high（和名: high）

**英語（現行）**

```
+1 Card
+1 Action
+1 Buy
You may Exile a card from your hand.
```

**日本語（カタログ用・コピペ形）**

```
+1 カード\n+1 アクション\n+1 購入\n手札1枚を追放してよい。
```

**裁定**

- **追放は任意**（公式FAQ に明記＝"Exiling a card is optional."）。手札が0枚なら何も追放しない。
- 「追放する」＝そのカードを自分の追放マットに置く。**獲得でも廃棄でもない**ので、獲得時能力・廃棄時能力は一切誘発しない。
- 追放マットのカードは**自分のもの**で、ゲーム終了時の得点計算に含める（属州を追放しても勝利点は残る）。
- 追放マットは**表向きの公開情報**。
- 追放から戻る条件は共通ルール＝「カードを獲得したとき、追放マットにある**同名のカードを全部**捨て札にしてよい。一部だけは不可（全部か0枚か）」。聖域自身にはカードを戻す能力は無い。
- +1 購入があるので同一ターンにカード2枚／イベント2つ／カード＋イベント のいずれも購入できる（購入順は自由）。

### がらくた（Scrap・`scrap`）

- コスト $3 ／ 種別: action ／ 確度: high（和名: high）

**英語（現行）**

```
Trash a card from your hand. Choose a different thing per $1 it costs: +1 Card; +1 Action; +1 Buy; +$1; gain a Silver; gain a Horse.
```

**日本語（カタログ用・コピペ形）**

```
手札1枚を廃棄する。そのカードのコスト1コインにつき、以下から異なるものを1つ選ぶ：+1 カード、+1 アクション、+1 購入、+1 コイン、銀貨1枚を獲得する、馬1枚を獲得する。
```

**裁定**

- 手札があれば**廃棄は強制**（1枚）。手札が0枚なら何も起きない。
- **先に廃棄し、その後**に「廃棄したカードのコイン費用1につき1つ、異なる効果」を選ぶ（公式FAQ）。コスト0なら1つも選べない。
- 選べる効果は6種類なので、**コスト6コイン以上なら6つ全部**を得る（公式："If the card you trash costs $6 or more, you just get all 6 bonuses."）。
- **解決順はカードに書かれた順**（+1 カード → +1 アクション → +1 購入 → +1 コイン → 銀貨獲得 → 馬獲得）。選んだ順ではない（公式FAQ の例：屋敷を廃棄して「+1 カード」と「馬を獲得」を選ぶと、まず1枚引いてから馬を獲得する）。
- コストのポーション・負債の部分は数えない（コイン部分のみ）＝ドミニオン共通則。
- 「+1 カード」で引いたカードが牧羊犬のような**獲得に反応するリアクション**なら、その後の銀貨／馬の獲得に反応してプレイできる（公式の裁定あり）。
- 馬の山が空なら「馬を獲得」を選ぶことはできるが獲得に失敗する（銀貨も同様）。
- 廃棄したカードの**現在の**コストで数える（行人・漁師・駿馬のような可変コスト、街道等のコスト減少を反映）。
- 避難所ありのゲームでは初期の屋敷が無いので、序盤の効率が大きく落ちる（戦略上の注意）。

### 牧羊犬（Sheepdog・`sheepdog`）

- コスト $3 ／ 種別: action, reaction ／ 確度: high（和名: high）

**英語（現行）**

```
+2 Cards
When you gain a card, you may play this from your hand.
```

**日本語（カタログ用・コピペ形）**

```
+2 カード\n————\nあなたがカードを獲得したとき、これを手札からプレイしてよい。
```

**裁定**

- 区切り線あり。上＝プレイ時 +2 カード、下＝リアクション。
- リアクションで自分がカードを**獲得したとき**、手札からプレイしてよい。購入による獲得でも、他の効果（ファルコナー等）による獲得でも、**他プレイヤーのターン中の獲得**（黒猫で呪いを獲得した等）でも使える（公式FAQ）。
- リアクションでのプレイは**アクション権を消費しない**。場に出て通常どおり +2 カードを得る（＝アタック無効化ではない・堀とは別物）。
- 他人のターンにプレイした牧羊犬は、**そのターンのクリンナップで捨て札**になる（持続でないため）。
- **手札に獲得した**牧羊犬（ファルコナー等）は、その獲得自体に反応してプレイできる（公式FAQ）。
- 引いた2枚にまた牧羊犬があれば、**同じ獲得に対して**続けてプレイできる（手札の牧羊犬が尽きるまで連鎖可）。
- 購入で獲得した場合、購入後は**そのターン財宝をプレイできない**点に注意（基本ルール）。
- 獲得時能力を持つカード（ホステルリー等）を獲得したときは、**その能力と牧羊犬のリアクションはどちらを先に解決してもよい**。
- 複数プレイヤーが同時に反応するときは手番順（手番プレイヤーから）に1つずつ解決し、1つ解決するたびに先頭から再確認する。
- リアクションでプレイするときも習性（Way）を使うことを選べる。

### そり（Sleigh・`sleigh`）

- コスト $2 ／ 種別: action, reaction ／ 確度: high（和名: high）

**英語（現行）**

```
Gain 2 Horses.
When you gain a card, you may discard this, to put that card into your hand or onto your deck.
```

**日本語（カタログ用・コピペ形）**

```
馬2枚を獲得する。\n————\nあなたがカードを獲得したとき、これを捨て札にしてよい。そうした場合、獲得したカードを手札に加えるか山札の上に置く。
```

**裁定**

- 区切り線あり。上＝プレイ時に馬2枚を獲得（馬の山が空なら獲得できる分だけ）。下＝リアクション。
- リアクションは**手札から捨て札にする**（デフォルトルール＝公開ではなく捨てる）。捨てた見返りに、獲得したカードを**手札に加えるか山札の上に置く**（どちらか選ぶ）。
- そりを獲得カードの上に捨てても、**その獲得カードを捨て札から動かせる**（公式FAQ で明示）。
- 獲得カードが捨て札以外の場所に直接置かれた場合（例：官僚で獲得した銀貨＝山札の上）でも、そりで手札／山札の上へ動かせる（公式FAQ）。
- **他の効果で既にそのカードが動いていたら動かせない**（lose track / stop-moving ルール）。
- 手札に獲得したそりに自分自身で反応した場合、**捨てることはできるが、stop-moving により自分を手札／山札の上に戻せない**（＝ただ捨てるだけになる）。
- そりAを獲得したときにそりBを捨ててAを手札に入れると、Aで再度リアクションできるが、A自身は動かせない。
- 獲得直後に手札へ入れる使い方が有効（例：墓地(Cemetery)を手札に入れてから廃棄する）。
- リアクションでの「捨て札にする」はクリンナップ以外の捨て札なので、トンネルや村有緑地の誘発条件を満たしうる（そり自身は誘発しない）。

### 雪深い村（Snowy Village・`snowy_village`）

- コスト $3 ／ 種別: action ／ 確度: high（和名: high）

**英語（現行）**

```
+1 Card
+4 Actions
+1 Buy
Ignore any further +Actions you get this turn.
```

**日本語（カタログ用・コピペ形）**

```
+1 カード\n+4 アクション\n+1 購入\nこのターン、これ以降に得る +アクション をすべて無視する。
```

**裁定**

- 解決順は上から＝+1 カード → +4 アクション → +1 購入 → **以降このターンに得る +アクションをすべて無視**（自身の +4 アクションは無視されない）。
- **プレイ前から持っていたアクション権は失わない**（例：村 → 雪深い村 なら、その後さらに5回アクションをプレイできる）。
- 2枚目の雪深い村をプレイしても +4 アクションは入らない（+1 カードと +1 購入は入る）。
- 村人（ルネサンス）の変換による +1 アクションも無視される。チャンピオン（冒険）の +1 アクション、Conclave の +1 アクション、Great Leader（同盟）の追加アクションも無視される。
- 「カードをプレイする」効果（玉座の間・大君主・Mastermind など）は**妨げられない**＝アクション権を使わずにプレイする効果はそのまま機能する。
- カードを引いてから「無視する」の文に到達するまでの間に村人を変換することはできる（効果は上から順に解決するため）。
- チャンピオン所持時：雪深い村をプレイした瞬間のチャンピオンの +1 アクションは得られるが、その後のターン中はチャンピオンからの +アクションを得られない。

### 備蓄品（Stockpile・`stockpile`）

- コスト $3 ／ coin: 3 ／ 種別: treasure ／ 確度: high（和名: high）

**英語（現行）**

```
$3
+1 Buy
Exile this.
```

**日本語（カタログ用・コピペ形）**

```
+3 コイン\n+1 購入\nこれを追放する。
```

**エラッタ**: 2025年2月の Menagerie 再版（2025 printing）で文面を簡略化：'When you play this, Exile it.' → 'Exile this.'（財宝の記載テンプレート変更で、効果は完全に同じ。公式 Errata ページには載っていない＝機能変更なし）

**裁定**

- 財宝＝金貨と同じ +3 コイン。購入フェイズにプレイする。プレイすると +1 購入を得て、**これを自分の追放マットに置く**（＝場に残らない）。
- 冠（帝国）等で**2回プレイすると +6 コイン・+2 購入**になるが、追放できるのは1回だけ（公式FAQ）。2回目は既に場にいないので追放に失敗する。
- 備蓄品を**獲得**したとき、追放マットにある他の備蓄品を**全部**捨て札にしてよい（一部だけは不可）＝追放の共通ルール。これが備蓄品を回収する主な手段。
- Kiln の後に備蓄品をプレイすると、**先に備蓄品を1枚獲得 → 追放中の備蓄品を捨ててよい → その後プレイした備蓄品を追放**、の順になる（公式裁定）。
- 備蓄品を獲得してから同じターンにその1枚をプレイした場合（Mining Road 等）、**追放から捨て札に戻せるのは他の備蓄品だけで、今プレイした1枚は戻らない**（獲得の判定がプレイより先）。
- 追放マットのカードは表向きの公開情報で、ゲーム終了時に自分のカードとして数える。
- チェンジリングとの交換・廃棄からの回収（Treasurer 等）・大使でサプライに戻すなど、山を減らさずに再利用する抜け道がある。

### 配給品（Supplies・`supplies`）

- コスト $2 ／ coin: 1 ／ 種別: treasure ／ 確度: high（和名: high）

**英語（現行）**

```
$1
Gain a Horse onto your deck.
```

**日本語（カタログ用・コピペ形）**

```
+1 コイン\n馬1枚を獲得し、山札の上に置く。
```

**エラッタ**: 2025年2月の Menagerie 再版（2025 printing）で文面を簡略化：'When you play this, gain a Horse onto your deck.' → 'Gain a Horse onto your deck.'（財宝の記載テンプレート変更で、効果は完全に同じ。公式 Errata ページには載っていない＝機能変更なし）

**裁定**

- 財宝＝銅貨と同じ +1 コイン。購入フェイズにプレイする。プレイすると馬1枚を**直接山札の上に**獲得する（捨て札を経由しない）。
- 馬の山が空なら獲得できない（何も起きない）。
- 山札の上に置かれるので、通常は**次のターンの手札**に入る。
- 獲得なので「獲得したとき」の能力（牧羊犬のリアクション等）は誘発する。
- アンチシナジー：山札の上が馬で埋まるため、堀・黒猫などのリアクションを次の手札に引きにくくなる。

### 村有緑地（Village Green・`village_green`）

- コスト $4 ／ 種別: action, duration, reaction ／ 確度: high（和名: high）

**英語（現行）**

```
Either now or at the start of your next turn, +1 Card and +2 Actions.
When you discard this other than during Clean-up, you may play it.
```

**日本語（カタログ用・コピペ形）**

```
今、または次のターンの開始時に、+1 カード および +2 アクション。\n————\nクリンナップフェイズ以外でこれを捨て札にしたとき、これをプレイしてよい。
```

**裁定**

- 区切り線あり。上＝持続の本体、下＝リアクション。
- プレイ時に「**今**」か「**次のターンの開始時**」かを選ぶ。「今」を選ぶと**そのターンのクリンナップで捨て札**になる（持続として残らない）。「次のターン」を選ぶと場に残り、次のターン開始時に +1 カード +2 アクションを得て、そのターンのクリンナップで捨てられる。
- Mastermind 等で複数回プレイした場合は**毎回選ぶ**。1回でも「次のターン」を選べば場に残る（その場合 Mastermind も一緒に残る）。
- リアクション＝**クリンナップ以外で捨て札にしたとき**、これをプレイしてよい。**アクション権を消費しない**。
- 手札から・山札から（Cardinal 等）・脇に置かれた状態から・**追放マットから**捨てた場合も誘発する。自分のターンでも他プレイヤーのターンでも使える。
- **「捨てる」以外の方法で捨て札置き場に置かれた場合は誘発しない**（購入して獲得した場合や、Scavenger（暗黒時代）で山札から捨て札置き場に置く場合など）。判定の要は「カードが『捨てる』と指示しているか」。
- 1回の捨て札につきプレイできるのは1回だけ（何度捨てればその都度使える）。
- 家臣（Vassal）で捨てて村有緑地のリアクションでプレイすると、家臣は lose track となりそのカードをプレイできなくなる。
- 複数枚の村有緑地を同時に捨てたとき、1枚をプレイしてシャッフルが起きると残りは山札に紛れて（stop-moving）反応できなくなる。リアクションは1枚ずつ解決する。
- 民兵等で手札を捨てるときは、**全部まとめて捨ててから**リアクションを解決する。
- 他プレイヤーのターンにプレイして「今」を選ぶと +2 アクションは無駄になる（+1 カードだけ有効）。手札破壊アタック対策では「次のターン」を選ぶのが定石。
- Shuffle iT のデジタル版に一時期「you may reveal it to play it（公開してプレイする）」というバリアント表記が存在したが、**紙版は 2020年版・2025年版とも 'you may play it'**（公開は不要＝捨て札にした状態からプレイする）。

### 行人（Wayfarer・`wayfarer`）

- コスト $6 ／ 種別: action ／ 確度: high（和名: high）

**英語（現行）**

```
+3 Cards
You may gain a Silver.
This has the same cost as the last other card gained this turn, if any.
```

**日本語（カタログ用・コピペ形）**

```
+3 カード\n銀貨1枚を獲得してよい。\n————\nこのカードのコストは、このターンに獲得された直前の他のカード1枚と同じになる（そのようなカードがない場合はコスト6コイン）。
```

**裁定**

- コスト表記は「6コイン*」。* は「コストが変動する」ことの目印にすぎず、基本コストは6コイン。
- 区切り線の下は**常時働く静的能力**。このターンに獲得された**最後の「行人以外の」カード**と同じコストになる。行人を獲得しても行人のコストは変わらない（"the last **other** card"）。
- ターンが変われば「このターンに獲得したカード」がリセットされるので、**各ターンの開始時に6コインへ戻る**。
- **すべての行人のコストが同時に変わる**（相手の手札・山札にある行人も含め、あらゆる目的で）。
- コスト減少（橋・街道など）は行人には適用されない。**そのターンにまだ1枚も獲得していない間だけ**適用される（例：橋をプレイすると行人は5コイン。その後に銀貨を購入すると行人は3コインになる）。
- コストは0コイン未満にはならない。ポーション（P）や負債（D）を含むコストにもなり得る。
- 獲得後にそのカードのコストが変われば、行人のコストも追随する（例：漁師を5コインで獲得 → その後シャッフルで捨て札が空になり漁師が2コインになると、行人も2コイン）。
- **獲得以外**でカードを得た場合はコストが変わらない：追放（キャメルトレインでサプライから追放する等）、交換（Trader 等）は「獲得」ではない。
- 動物見本市（Animal Fair）をアクションカードの廃棄で購入した場合、行人のコストは動物見本市のコスト7コインになる（廃棄したアクションのコストではない）。
- 効果自体は「+3 カード」＋**任意で**銀貨1枚を獲得。銀貨を獲得すると、その瞬間から行人のコストは3コインになる。
- 石工（ギルド）等でコストを参照するカードとの相互作用に注意：効果の解決中にコストが変わり得るので、カードの指示を必ず順番どおりに処理する。

## 3. 非サプライ：馬（Horse）

| id | 和名 | 英名 | コスト | 種別 | 機構 |
|---|---|---|---|---|---|
| `horse` | 馬 | Horse | $3 | action | horse non-supply one-shot return-to-pile draw setup |

### 馬（Horse・`horse`）

- コスト $3 ／ 種別: action ／ 確度: high（和名: high）

**英語（現行）**

```
+2 Cards
+1 Action
Return this to its pile.
(This is not in the Supply.)
```

**日本語（カタログ用・コピペ形）**

```
+2 カード\n+1 アクション\nこれをその山に戻す。\n（このカードはサプライに置かない。）
```

**裁定**

- 【山の構成】馬は30枚1山の非サプライの山。コストは3コイン。カード面は「3*」だが、*は「サプライではない＝買えない」という目印にすぎずゲーム上の意味は無い。公式ルールブック明記：コスト比較では馬は「コスト3の他のカードと同じコスト」として扱う（改築で公領＝コスト5に改築できる／街道・橋などのコスト軽減も普通に効く）。
- 【獲得できる条件】購入は一切できない。「馬1枚を獲得する」と名指しした効果でだけ山から獲得できる。公式FAQ明記：鷹匠(Falconer)や強制退去(Displace)のような『コスト○○のカードを獲得』系の汎用獲得では取れない（このプロジェクトで言えば NON_SUPPLY 扱い＝工房・改築・密輸人・闇市場デッキなどの候補から除外する）。
- 【山が空のとき】「馬を獲得する」と指示されても山に1枚も無ければ、単に獲得に失敗する（エラーにも選択待ちにもしない。何も起きずに次へ進む）。
- 【3山終了に数えない】非サプライの山は3山終了（three-pile ending）に数えない。馬の山が空になってもゲーム終了条件には一切影響しない。
- 【使用時の処理】+2 カード → +1 アクション → これをその山（の一番上）に戻す。「戻す(return)」は捨て札でも廃棄でもない＝捨て札時の誘発（トンネル等）も廃棄時の誘発も起きず、廃棄置き場にも行かない。戻した馬は再び獲得対象になる。
- 【場に残らない】馬は自身の効果で即座に場を離れるため、クリーンアップで場から捨てられることは無い。「これが場にある間」や「場のカード枚数」を数える効果からは見えない。増築(Improve)のような『クリーンアップに場から捨てるアクション』も対象にできない。
- 【御料車は呼べない】御料車(Royal Carriage)は「アクションを解決した直後、それがまだ場にある場合」に呼び出す。馬は解決の中で山へ戻り場を離れるので、馬に対して御料車は呼び出せない（公式wiki明記）。
- 【玉座の間・王の宮廷・首謀者など】公式FAQ明記：馬を複数回使用させた場合、使用のたびに +2 カード と +1 アクション を得る。ただし山に戻るのは1回だけ（2回目以降の「戻す」は既に動いた後なので stop-moving rule により失敗する）。
- 【行進(Procession)】公式wikiの裁定：行進で馬を対象にすると、馬を2回使用 → 馬は既に山へ戻っているので行進は廃棄に失敗する（馬は廃棄置き場に行かない）。しかし行進の獲得は廃棄成功を条件としないので、ちょうど1コイン高い＝コスト4のアクション1枚は獲得する。
- 【習性(Way)で使った場合】公式ルールブック明記：習性でアクションを使用すると、そのカードが本来書いている事は一切行わない。例＝羊の習性(+2コイン)で馬を使用すると「+2 カード +1 アクション」を得ず、馬を山に戻しもしない（＝通常のアクションとしてクリーンアップで捨て札になる）。
- 【場に動かさずに使用させる効果】死霊術師など、カードを場に動かさずに使用させる効果で馬が使用された場合、stop-moving rule により「山に戻す」は失敗する（+2 カード +1 アクションは得る）。
- 【廃棄した場合】馬を廃棄すると山ではなく廃棄置き場に行く。廃棄置き場から獲得する効果（墓暴き等の trash gainer）は非サプライカードも取れるので、廃棄置き場の馬は回収され得る。
- 【追放(Exile)】手札から追放する効果（聖域・強制退去・賞金稼ぎ・追放イベント）は馬を追放できる。一方ラクダの隊列・投資・輸送・ラクダの習性は「サプライから」追放するので馬の山は対象外。馬を獲得したとき、追放マット上の馬を捨て札にしてよい（全部まとめてか、全くしないかの二択。一部だけは不可）。
- 【獲得先】獲得した馬は、獲得元のカードが別途指定しない限り捨て札に置かれる（例：配給品は山札の上に置く、と個別に指定している）。
- 【セットアップ】公式ルールブック：「馬を参照するカードを使うゲームでは、馬の山を手元に用意する」。馬を使うのは王国カード8種（そり／配給品／がらくた／騎兵隊／馬丁／旅籠／貸し馬屋／パドック）とイベント4種（乗馬／特価品／要求／暴走）の計12種。うち旅籠だけは「使用時」ではなく「獲得したとき」に馬を得る。
- 【馬の習性(Way of the Horse)は別物】馬を獲得させるランドスケープではなく、任意のアクション1枚を『+2 カード +1 アクション、これをその山に戻す』としてプレイさせる習性。馬の山を使わない。
- 【得点計算】終了時に自分のデッキに残った馬は自分のカードとして数える（庭園・ブドウ園・凱旋門など、枚数や異名数を数える効果の対象になる）。

## 4. イベント 20種（横型・購入して使う）

| id | 和名 | 英名 | コスト | 種別 | 機構 |
|---|---|---|---|---|---|
| `alliance` | 同盟 | Alliance | $10 | event |  |
| `banish` | 放逐 | Banish | $4 | event | exile |
| `bargain` | 特価品 | Bargain | $4 | event | horse |
| `commerce` | 商売 | Commerce | $5 | event |  |
| `delay` | 遅延 | Delay | $0 | event | duration |
| `demand` | 要求 | Demand | $5 | event | horse |
| `desperation` | 絶望 | Desperation | $0 | event | once-per-turn |
| `enclave` | 包領 | Enclave | $8 | event | exile |
| `enhance` | 増大 | Enhance | $3 | event |  |
| `gamble` | 博打 | Gamble | $2 | event |  |
| `invest` | 投資 | Invest | $4 | event | event exile on-gain setup |
| `march` | 進軍 | March | $3 | event | event |
| `populate` | 植民 | Populate | $10 | event | event |
| `pursue` | 追求 | Pursue | $2 | event | event |
| `reap` | 刈り入れ | Reap | $7 | event | event duration |
| `ride` | 乗馬 | Ride | $2 | event | event horse setup |
| `seize_the_day` | 今を生きる | Seize the Day | $4 | event | event extra-turn once-per-game |
| `stampede` | 暴走 | Stampede | $5 | event | event horse |
| `toil` | 苦労 | Toil | $2 | event | event |
| `transport` | 輸送 | Transport | $3 | event | event exile setup |

### 同盟（Alliance・`alliance`）

- コスト $10 ／ 種別: event ／ 確度: high（和名: high）

**英語（現行）**

```
Gain a Province, a Duchy, an Estate, a Gold, a Silver, and a Copper.
```

**日本語（カタログ用・コピペ形）**

```
属州、公領、屋敷、金貨、銀貨、銅貨 各1枚を獲得する。
```

**裁定**

- サプライにある山のカードはすべて獲得する。強制であり、一部だけを選んで獲得することはできない（公式FAQ）。
- 獲得は記載順に1枚ずつ行う＝属州→公領→屋敷→金貨→銀貨→銅貨。
- 獲得順は望楼などで山札の上に置くときに意味を持つ。6枚すべてを山札の上に置いた場合、上から 銅貨・銀貨・金貨・屋敷・公領・属州 の順に積まれる（最後に獲得した銅貨が一番上）。
- 山が空の種類は獲得できないだけで、残りは通常どおり獲得する。
- 獲得はすべて通常の獲得なので、獲得時能力（望楼・交易人・技術革新など）は1枚ごとに誘発する。

### 放逐（Banish・`banish`）

- コスト $4 ／ 種別: event ／ 確度: high（和名: high）

**英語（現行）**

```
Exile any number of cards with the same name from your hand.
```

**日本語（カタログ用・コピペ形）**

```
手札から同じ名前のカードを好きな枚数追放する。
```

**裁定**

- 追放（Exile）＝カードを自分の追放マットに置くこと。獲得でも廃棄でもないので、獲得時能力・廃棄時能力は一切誘発しない。
- 追放マット上のカードは表向きの公開情報で、自分のものとして扱う。ゲーム終了時の得点計算に数える（庭園などの「所持カード枚数」にも数える）。
- 「好きな枚数」なので0枚でもよい（＝何も追放しないことを選べる）。
- 追放できるのは1種類（同じ名前）のカードだけ。例＝手札の屋敷3枚をまとめて追放できるが、屋敷2枚と銅貨1枚を同時に追放することはできない（公式FAQ）。
- 騎士・廃墟・城のように同じ山でもカード名が異なるものは、別のカードとして扱う（まとめて追放できない）。
- 後で同じ名前のカードを獲得したとき、追放マット上にあるそのカードのコピーを全部捨て札にしてよい。一部だけ捨てることはできず、全部か0枚か。
- 追放マットからカードを捨て札にするのは「捨て札にする」処理なので、クリンナップ以外で起きればトンネルや村緑地が誘発する。
- このイベントを使うゲームでは各プレイヤーに追放マットが必要（新ゾーン）。

### 特価品（Bargain・`bargain`）

- コスト $4 ／ 種別: event ／ 確度: high（和名: high）

**英語（現行）**

```
Gain a non-Victory card costing up to $5.
Each other player gains a Horse.
```

**日本語（カタログ用・コピペ形）**

```
コスト5コイン以下の勝利点でないカード1枚を獲得する。\n他のプレイヤーは各自、馬1枚を獲得する。
```

**裁定**

- 自分の獲得は強制（コスト5コイン以下の非勝利点カードが1枚でもあれば獲得しなければならない）。
- 勝利点カードは獲得できない。勝利点と他の種別を兼ねるカード（分かち合い・ハーレム/農場など）も獲得できない。
- 他のプレイヤーは購入者の左隣から手番順に馬を獲得する。獲得を拒否できない（公式FAQ）。
- アタックではないので堀・灯台などで防げない。
- 馬の山（非サプライ・30枚）が空なら馬は獲得できない（何も起きない）。人数分足りなければ手番順で先着。
- ポーションや負債をコストに含むカードは「コスト5コイン以下」に含まれないため獲得できない（コスト比較はコイン・ポーション・負債の成分別）。
- 橋や街道でコストが下がっていれば、下がった後のコストで判定する。
- 馬は非サプライ山なので、馬の山が空になっても3山切れには数えない。

### 商売（Commerce・`commerce`）

- コスト $5 ／ 種別: event ／ 確度: high（和名: high）

**英語（現行）**

```
Gain a Gold per differently named card you've gained this turn.
```

**日本語（カタログ用・コピペ形）**

```
このターンにあなたが獲得したカードの異なる名前1種類につき、金貨1枚を獲得する。
```

**裁定**

- まず「このターンに獲得した異なる名前のカードが何種類あるか」を数え、その後にその枚数の金貨をまとめて獲得する（公式FAQ）。
- 例：このターンに属州2枚・銀貨1枚・馬1枚を獲得していたら、獲得するのは金貨3枚（属州は2枚でも1種類）。
- 数え終わった後に新たにカードを獲得しても、獲得する金貨は増えない。例＝商売で獲得した金貨によって貸し馬屋が馬を獲得させても、金貨は増えない。
- 「このターン」に獲得したカードなので、購入によるものに限らずあらゆる獲得を数える。
- 日本語版カードの「得る」は「獲得する」の誤訳。実際には通常の獲得なので、望楼などの獲得時リアクションが問題なく使える。
- 金貨の山が足りない場合はあるだけ獲得する。
- カードを1枚も獲得していないターンに購入すると、金貨を1枚も獲得しない（購入自体は合法）。

### 遅延（Delay・`delay`）

- コスト $0 ／ 種別: event ／ 確度: high（和名: high）

**英語（現行）**

```
You may set aside an Action card from your hand. At the start of your next turn, play it.
```

**日本語（カタログ用・コピペ形）**

```
手札からアクションカード1枚を脇に置いてもよい。\nあなたの次のターンの開始時、それを使用する。
```

**裁定**

- 脇に置くのは任意。ただし一度脇に置いたら、次のターン開始時に使用するのは強制（公式FAQ）。
- この使用ではアクション権を消費しない（公式FAQ）。
- ターン開始時に複数の処理があるときは、自分で解決順を選べる（公式FAQ）。
- 持続カードを脇に置いてもよい。次のターン開始時に使用され、その後は通常の持続カードとして場に残る。
- 脇に置いたカードはゲーム終了時まで自分のデッキの一部として扱い、得点計算に数える。
- 実装注意：このプロジェクトのエンジンは「自分の手番終了時に次の手札を先引きする」ので、遅延の使用は次の手番の開始時効果キュー（startQueue）で処理する。
- 0コストなので購入権さえあれば気軽に買える。イベント購入なので購入権を1消費し、以後そのターンは財宝を出せなくなる。

### 要求（Demand・`demand`）

- コスト $5 ／ 種別: event ／ 確度: high（和名: high）

**英語（現行）**

```
Gain a Horse and a card costing up to $4, both onto your deck.
```

**日本語（カタログ用・コピペ形）**

```
馬1枚とコスト4コイン以下のカード1枚を獲得し、2枚ともあなたの山札の上に置く。
```

**裁定**

- 強制効果（獲得しないことを選べない）。
- 馬が先に山札の上に置かれ、その後コスト4コイン以下のカードが置かれる＝コスト4以下のカードが一番上、馬がその下（公式FAQ）。
- 馬は2枚目のカードを選ぶ前に獲得される。そのため駿馬（Destrier）のように「このターンの獲得枚数でコストが下がる」カードは、馬の獲得を反映した後のコストで判定する（公式の裁定）。
- 獲得したカードは捨て札置き場を経由せず、直接山札の上に置かれる。
- 馬の山が空なら馬は獲得できないが、もう1枚は通常どおり獲得する。
- ポーションや負債をコストに含むカードは「コスト4コイン以下」に含まれないため獲得できない。
- 街道などでコストが下がっていれば下がった後のコストで判定する（例＝街道を1回使ったターンなら公領が5→4になり獲得できる）。

### 絶望（Desperation・`desperation`）

- コスト $0 ／ 種別: event ／ 確度: high（和名: high）

**英語（現行）**

```
Once per turn: You may gain a Curse. If you do, +1 Buy and +$2.
```

**日本語（カタログ用・コピペ形）**

```
各ターンに1度、呪い1枚を獲得してもよい。\nそうした場合、+1 購入と+2 コイン。
```

**裁定**

- 呪いの獲得は任意。獲得しなければ +1 購入 と +2 コイン は得られない。
- 呪いの山が空で獲得できなかった場合も、+1 購入 と +2 コイン は得られない（公式FAQ）。
- 呪いを獲得した後にそれをデッキから取り除いても（望楼で廃棄する／交易人を公開して銀貨に交換する等）、獲得はしているので +1 購入 と +2 コイン は得られる。
- 逆に、そもそも獲得が起きない場合（支配のターンに絶望を購入した場合など）は +1 購入 と +2 コイン を得られない。
- 「各ターンに1度」は効果への制限であり、購入自体を禁じる文言ではない（冒険の「1ターンに1回しか購入できない」とは書き方が違う）。一般のイベント規則どおり、購入権とコインがあれば同じターンに複数回購入できるが、2回目以降は効果が無い＝購入権の無駄。
- 0コストなので、デッキ初巡から金量を底上げできる。呪いが山切れすると完全に無効になる。

### 包領（Enclave・`enclave`）

- コスト $8 ／ 種別: event ／ 確度: high（和名: high）

**英語（現行）**

```
Gain a Gold. Exile a Duchy from the Supply.
```

**日本語（カタログ用・コピペ形）**

```
金貨1枚を獲得する。サプライから公領1枚を追放する。
```

**裁定**

- 公領はサプライの公領の山から直接、自分の追放マットに移る（捨て札置き場や手札を経由しない・公式FAQ）。
- サプライからの追放は「獲得」ではないので、獲得時能力（望楼・交易人・技術革新など）は一切誘発しない。
- 公領の山が実際に1枚減るため、3山切れ（山切れ数）の判定に影響する。
- 追放マット上の公領は自分のものとして、ゲーム終了時に3点として得点計算に数える。
- 金貨と公領は独立した2つの処理。金貨の山が空で金貨を獲得できなくても公領の追放は行い、公領の山が空でも金貨の獲得は行う。
- 後で公領を獲得したとき、追放マット上の公領を全部捨て札にしてよい（一部だけは不可）。
- 両方とも強制（追放しないことを選べない）。

### 増大（Enhance・`enhance`）

- コスト $3 ／ 種別: event ／ 確度: high（和名: high）

**英語（現行）**

```
You may trash a non-Victory card from your hand, to gain a card costing up to $2 more than it.
```

**日本語（カタログ用・コピペ形）**

```
手札から勝利点でないカード1枚を廃棄してもよい。\nそうした場合、そのカードよりコストが最大2コイン多いカード1枚を獲得する。
```

**裁定**

- 廃棄は任意だが、廃棄した場合は獲得が強制（公式FAQ：「カードを廃棄したなら、それより最大2コイン多いカード1枚を獲得しなければならない」）。
- 廃棄できるのは勝利点でないカードだけ。勝利点と他の種別を兼ねるカード（例＝ハーレム/農場・貴族・略奪品）は廃棄できない。
- 獲得するカードの種別に制限は無い＝勝利点カードも獲得できる（廃棄側だけが非勝利点制限）。
- コスト比較はコイン・ポーション・負債の成分別に行う（例＝銀貨$3を廃棄しても $0+負債4 のカードは「$5以下」に含まれないので獲得できない）。
- 廃棄するカードのコストは廃棄時点の現在コスト（橋・街道・行商人などの影響を受ける）。増大は購入フェイズに購入するので、行商人はアクションフェイズより高い$8として扱われる点に注意。
- 手札が空、または手札が勝利点カードだけなら、廃棄せず何も起こらない（購入自体は合法）。
- 獲得候補が1枚も無い場合は獲得できずに終わる。

### 博打（Gamble・`gamble`）

- コスト $2 ／ 種別: event ／ 確度: medium（和名: high）

**英語（現行）**

```
+1 Buy
Discard the top card of your deck. If it's an Action or Treasure, you may play it.
```

**日本語（カタログ用・コピペ形）**

```
+1 購入\n山札の一番上のカードを捨て札にする。\nそれがアクションカードか財宝カードの場合、それを使用してもよい。
```

**エラッタ**: 2025年2月：「Reveal the top card of your deck. If it's a Treasure or Action, you may play it. Otherwise, discard it.」→「Discard the top card of your deck. If it's an Action or Treasure, you may play it.」。旧文は「使用しないと選んだアクション/財宝をどうするのか（山札に戻すのか捨てるのか）」が読み取りにくかったための明確化。挙動はほぼ同じだが、現行では必ず先に捨て札置き場へ置き、そこから使用する。

**裁定**

- 使用は任意。この使用ではアクション権を消費しない（公式FAQ）。
- 使用しない場合は、アクション/財宝であってもなくても、そのカードは捨て札置き場に置かれたままになる（公式FAQ）。
- 現行テキストでは「捨て札にする」が先に起きるので、使用するカードは捨て札置き場から使用される。旧テキスト（公開）との実質的な差はここだけで、通常のプレイでは結果は変わらない。
- 博打が使用したカードがアクションカードや財宝カードを手札に引かせても、それらを使用することはできない。使用できるのは博打がめくった1枚だけ（公式の追加裁定）。
- 山札が空なら捨て札置き場をシャッフルして山札を作り直してから一番上を処理する。それでも0枚なら何も起きない（+1 購入 だけ得る）。
- +1 購入 が先に入るので、博打を購入しても購入権は差し引きゼロで、実質 $2 でめくり1回ぶんを買う形になる。
- イベント購入なので、これを購入した後はそのターン財宝を追加で出せない（＝財宝を全部出し切ってから買うこと）。この制約は財宝を使用させる博打の性質上とくに重要。

### 投資（Invest・`invest`）

- コスト $4 ／ 種別: event ／ 確度: high（和名: high）

**英語（現行）**

```
Exile an Action card from the Supply. While it's in Exile, when another player gains or Invests in a copy of it, +2 Cards.
```

**日本語（カタログ用・コピペ形）**

```
サプライからアクションカード1枚を追放する。\nそのカードが追放されている間、他のプレイヤーがそれと同じカード1枚を獲得または投資したとき、+2 カード。
```

**裁定**

- サプライからの追放は「獲得」ではない。獲得時能力（on-gain）は一切誘発しない。追放マットのカードはそのプレイヤーの物で、ゲーム終了時の得点計算に含める（公開情報）。
- +2 カードが誘発するのは「他のプレイヤー」がそのカードを獲得したとき、または「投資」でそのカードのコピーを追放したときだけ。自分自身の獲得では誘発しない。
- この +2 カードは任意ではない＝強制（公式FAQ「This is not optional.」）。相手のターン中に自分がドローする。
- 累積する。同じカードに2回投資すると、他プレイヤーの1回の獲得ごとに +4 カード。
- 【実装最重要】「投資で追放したコピー」と「他の手段（キャメルトレイン・追放アタック等）で追放したコピー」を必ず別管理する。後者は +2 カードを与えない。公式も「マットの半分下に置くなどして分けよ」と指示している。
- 追放解除は通常ルールどおり。そのカードを獲得したとき、追放マットにある同名のコピーを全て捨て札にしてよい（一部だけ捨てるのは不可）。捨てたら以後 +2 カードは発生しない。
- 追放するカード自身がアクションであればよく、山全体がアクションの山である必要はない（分割山の下段など）。
- 追放マットから捨て札にするのは「獲得」ではないが「捨て札にする」ではある＝トンネル（異郷）やヴィレッジグリーンを誘発しうる。
- アタックではないので堀では防げない。
- 王国に追放を参照するカードがある場合、準備で各プレイヤーに追放マットを配る。

### 進軍（March・`march`）

- コスト $3 ／ 種別: event ／ 確度: high（和名: high）

**英語（現行）**

```
Look through your discard pile. You may play an Action card from it.
```

**日本語（カタログ用・コピペ形）**

```
捨て札置き場を見る。\nその中のアクションカード1枚を使用してもよい。
```

**裁定**

- 通常は捨て札置き場の中身を見ることはできないので、「買うかどうか決めるために先に覗く」ことはできない。購入して初めて中身を見て、それからアクション1枚を使うかを選ぶ（公式FAQ）。
- このアクションの使用はアクション権を消費しない。
- 任意＝使用しなくてもよい。捨て札が空、またはアクションカードが無ければ何も起きない。
- 購入フェイズ中なので、使用したアクションで財宝を引いても（通常は）その財宝を使えない（イベント購入後は財宝を出せない）。引いたアクションは進軍をもう一度購入すれば使える。
- 夜行カードを引いた場合は、その後の夜フェイズに使用できる（夜フェイズを実装する場合）。
- 使用したアクションは場に出るので、そのターンのクリーンアップで通常どおり捨て札になる（持続なら残る）。

### 植民（Populate・`populate`）

- コスト $10 ／ 種別: event ／ 確度: high（和名: high）

**英語（現行）**

```
Gain one card from each Action Supply pile.
```

**日本語（カタログ用・コピペ形）**

```
サプライのアクションカードの山それぞれから、カード1枚を獲得する。
```

**裁定**

- 各「アクションのサプライ山」から一番上のカード1枚ずつを獲得する。
- 非サプライの山（馬・賞品・戦利品・成長先など）からは獲得しない。アクションでない山（例：備蓄品＝財宝）からも獲得しない。
- 【実装最重要】山がアクションの山かどうかは「その山のランダマイザー（山の種別）」で決まり、現在の一番上のカードの種別では決まらない。したがって、アクション山の一番上が非アクションでも獲得する（例：剣闘士／大金の分割山で上段が尽きていれば大金＝財宝を獲得する）。
- 逆に、城（帝国の混合山）はランダマイザーが勝利点なのでアクション山ではない＝対象外。廃墟（暗黒時代）はアクションのサプライ山なので対象で、一番上の廃墟を獲得する。
- 騎士のように中身が異なる混合山では、一番上の1枚だけを獲得する。
- 相続（冒険）を購入して屋敷がアクションになっても、屋敷の山は勝利点の山のままなので対象外。カード種別を変えるだけの効果は山の種別を変えない。
- 空の山からは獲得しない。
- 獲得する順番はプレイヤーが選べる（重要：山札の上に置く獲得時能力や騎兵との相互作用で結果が変わる）。
- ヴィラや騎兵（Cavalry）を獲得してアクションフェイズに戻る場合、その場で戻るが、植民による獲得を全て終わらせてから他の行動を行う。
- 解決中にサプライへ新しい山が追加された稀なケースでは、その新しい山からも獲得する。
- コスト10だが購入権は1つしか使わない。イベントなのでコスト軽減（橋・街道）を受けない。
- 一気に大量の山が減るため、3山切れの判定に強く影響する（実装時は獲得ごとに終了条件を再評価）。

### 追求（Pursue・`pursue`）

- コスト $2 ／ 種別: event ／ 確度: high（和名: high）

**英語（現行）**

```
+1 Buy
Name a card. Reveal the top 4 cards from your deck. Put the matches back and discard the rest.
```

**日本語（カタログ用・コピペ形）**

```
+1 購入\nカード名を1つ指定する。山札の上から4枚を公開する。\nそのうち指定したカードを山札の上に戻し、残りを捨て札にする。
```

**裁定**

- ゲームに存在しないカード名も指定できる。その場合は4枚とも捨て札になる（公式FAQ）。
- カード名の指定は公開4枚を見る前に行う。
- 山札が4枚に足りない場合は、捨て札をシャッフルして山札を補ってから公開する（足りなければあるだけ）。
- 一致したカードは山札の上に戻し、一致しなかったカードは捨て札にする。捨てるのは「捨て札にする」なのでトンネル等を誘発しうる。
- 戻す枚数が複数のときの順序について公式裁定は見つからなかった（実装ではプレイヤーに選ばせるか、公開順を維持するかを決め打ちしてよい。ゲーム的影響は小さい）。
- +1 購入 は先に得る。

### 刈り入れ（Reap・`reap`）

- コスト $7 ／ 種別: event ／ 確度: high（和名: high）

**英語（現行）**

```
Gain a Gold, setting it aside. At the start of your next turn, play it.
```

**日本語（カタログ用・コピペ形）**

```
金貨1枚を獲得し、それを脇に置く。\n次のあなたの手番開始時、それを使用する。
```

**エラッタ**: 2025年2月に変更。旧（2020年初版印刷）『Gain a Gold. Set it aside. If you do, at the start of your next turn, play it.』→ 現行『Gain a Gold, setting it aside. At the start of your next turn, play it.』。変更点＝獲得した金貨が捨て札置き場を経由しなくなった（獲得と同時に脇へ置く）。Dominion Online は現行テキストを採用済み。

**裁定**

- 【エラッタ最重要】現行では金貨は捨て札置き場を経由せず、獲得と同時に脇へ置かれる。旧テキストでは「獲得→脇に置く」の間に捨て札置き場を経由する解釈があり、捨て札を参照する効果の挙動が変わる。
- 次のターンの開始時に脇の金貨を「使用」する＝そのターンは金貨が場にある状態で始まり +3 コインを得る。
- その金貨はそのターンのクリーンアップで通常どおり捨て札になる。
- ターン開始時に複数のことが起きる場合、解決順はプレイヤーが選べる。
- 前哨地などと違い、アクションフェイズはスキップしない。
- 金貨の山が空で獲得できなければ、脇に置くものが無いので次のターンに何も起きない。
- イベントなので「刈り入れ」自体は場に出ない。持続カードではないが、次ターンへ持ち越す遅延効果として管理する必要がある（本エンジンなら delayedEffects / startQueue 相当）。
- イベント購入は「カードの購入」ではないので、値切り屋（Haggler）等の購入時トリガーは誘発しない。金貨を直接買うのと違う点として、この差が実際に効く。

### 乗馬（Ride・`ride`）

- コスト $2 ／ 種別: event ／ 確度: high（和名: high）

**英語（現行）**

```
Gain a Horse.
```

**日本語（カタログ用・コピペ形）**

```
馬1枚を獲得する。
```

**裁定**

- 公式FAQは「単に馬1枚を獲得する」だけ（You simply gain a Horse.）。
- 馬は非サプライの山（30枚）。「馬を獲得する」と指示されたときだけ獲得でき、鷹匠（Falconer）やディスプレイス等の汎用獲得では取れない。
- 馬の山が空なら獲得に失敗する（何も起きない）。
- 馬のコストは3コイン（*付きだがコストは3）。コストを比較する効果では3コインのカードと同じ扱い。*は「サプライに無いので購入できない」ことの注意書きに過ぎない。
- 馬を使用すると +2 カード +1 アクション を得て、その馬を馬の山に戻す。戻すのは「獲得」でも「廃棄」でもない。
- マスターマインド等で馬を複数回使用した場合、使用ごとに +2 カード +1 アクション を得るが、山に戻すのは1回だけ。
- 獲得なので、獲得時トリガー（望楼・技術革新など）は通常どおり誘発する。

### 今を生きる（Seize the Day・`seize_the_day`）

- コスト $4 ／ 種別: event ／ 確度: high（和名: high）

**英語（現行）**

```
Once per game: Take an extra turn after this one.
```

**日本語（カタログ用・コピペ形）**

```
ゲーム中に1回：このターンの後に追加のターンを1回行う。
```

**裁定**

- 「ゲーム中に1回」はプレイヤーごと＝各プレイヤーが1ゲームに1度だけ購入できる。2回目の購入はできない（購入自体を拒否する＝購入権を無駄にしない）。
- 追加ターンは通常のターンと全く同じ（カードを引ける・購入できる。使節団のような制限は無い）。
- 唯一の例外＝この追加ターンは同点時のタイブレーク（ターン数の少なさ）に数えない。
- 【実装注意】前哨地・使節団と違い「直前が他プレイヤーのターンだったか」を確認しない。したがって前哨地の追加ターン中に今を生きるを購入して3ターン連続を取れる（公式に認められた挙動）。
- 購入したターンが終わった直後に追加ターンを行う。
- 艦隊（ルネサンス）の追加ターンなど他の追加ターン源とも組み合わせて発生しうるので、追加ターンのキュー管理に注意。

### 暴走（Stampede・`stampede`）

- コスト $5 ／ 種別: event ／ 確度: high（和名: high）

**英語（現行）**

```
If you have 5 or fewer cards in play, gain 5 Horses onto your deck.
```

**日本語（カタログ用・コピペ形）**

```
場にあるあなたのカードが5枚以下の場合、馬5枚を獲得し、山札の上に置く。
```

**裁定**

- 【実装最重要】判定はそのターンに何枚プレイしたかではなく、「暴走を購入した時点で場にあるカードの枚数」だけを見る（公式FAQ）。場を離れたカードは数えない。
- 場のカードには持続カードや前のターンから残っている持続も含まれる（場にあるカード全て）。
- 馬の山の残りが5枚未満なら、取れるだけ取る。
- 獲得した馬は全て山札の上に置く。順序は実質同じカードなので影響しない。
- 条件（場が5枚以下）を満たさない場合、購入自体は成立して購入権とコイン5を消費するが、馬は1枚も得られない。
- 獲得なので獲得時トリガーは通常どおり誘発する（望楼などは「山札の上に置く」置換と競合しうる）。
- 財宝を出さずに購入できると条件を満たしやすい（財源・村人などの仮想コイン、または元々のコイン）。

### 苦労（Toil・`toil`）

- コスト $2 ／ 種別: event ／ 確度: high（和名: high）

**英語（現行）**

```
+1 Buy
You may play an Action card from your hand.
```

**日本語（カタログ用・コピペ形）**

```
+1 購入\n手札からアクションカード1枚を使用してもよい。
```

**裁定**

- このアクションの使用はアクション権を消費しない（公式FAQ）。
- 任意＝使用しなくてもよい。手札にアクションが無ければ何も起きない。
- 購入フェイズ中なので、使用したアクションで財宝を引いても（イベント購入後なので）その財宝は使えない。引いたアクションは苦労をもう一度購入すれば使える。
- +1 購入 を先に得るので、実質「購入権を消費せずアクション1枚を使う」に近い（コスト2は要る）。
- 使用したアクションは場に出るので、そのターンのクリーンアップで通常どおり捨て札になる（持続なら残る）。
- 同じイベントを1ターンに複数回購入できる（購入権とコインがある限り）。

### 輸送（Transport・`transport`）

- コスト $3 ／ 種別: event ／ 確度: high（和名: high）

**英語（現行）**

```
Choose one: Exile an Action card from the Supply; or put an Action card you have in Exile onto your deck.
```

**日本語（カタログ用・コピペ形）**

```
次から1つを選ぶ：\n・サプライからアクションカード1枚を追放する\n・追放されているあなたのアクションカード1枚を山札の上に置く
```

**裁定**

- 2つの選択肢から1つを選ぶ。ドミニオンの原則どおり、実行できない選択肢も選べる（engine は拒否せず、何も起きないだけ＝人間が詰まない／CPUが無限ループしない）。
- 追放するカード自身がアクションであればよく、山全体がアクションの山である必要はない（公式FAQ「It only matters if the card is an Action, not if the whole pile is.」）。
- サプライからの追放は「獲得」ではない＝獲得時能力は誘発しない。
- 追放マットから山札の上に置くカードは、他のカード（キャメルトレイン・追放アタックなど）で追放されたアクションでもよい（公式FAQ）。投資で追放したものも置ける。
- 追放マットから山札の上に置くのは「獲得」ではなく、「捨て札にする」でもない（トンネル等は誘発しない）。
- 【実装注意・投資との相互作用】同名カードが追放マットに2枚あり、片方だけが投資で追放されたものである場合、輸送で「投資でない方」を選んで山札の上に置ける＝投資の +2 カードを維持したまま1枚だけ回収できる。どちらのコピーを動かすかプレイヤーが選べる必要がある。
- 追放マットは公開情報。マット上のカードは所有者のものとして終了時に得点計算に含める。
- 王国に追放を参照するカードがある場合、準備で各プレイヤーに追放マットを配る。

## 5. ウェイ＝習性 20種（横型・アクションの効果の代わりに使う）

| id | 和名 | 英名 | コスト | 種別 | 機構 |
|---|---|---|---|---|---|
| `way_of_the_butterfly` | チョウの習性 | Way of the Butterfly | — | way | way return-to-pile gain optional |
| `way_of_the_camel` | ラクダの習性 | Way of the Camel | — | way | way exile setup |
| `way_of_the_chameleon` | カメレオンの習性 | Way of the Chameleon | — | way | way replacement |
| `way_of_the_frog` | カエルの習性 | Way of the Frog | — | way | way on-discard topdeck |
| `way_of_the_goat` | ヤギの習性 | Way of the Goat | — | way | way trash |
| `way_of_the_horse` | 馬の習性 | Way of the Horse | — | way | way return-to-pile |
| `way_of_the_mole` | モグラの習性 | Way of the Mole | — | way | way discard draw |
| `way_of_the_monkey` | サルの習性 | Way of the Monkey | — | way | way |
| `way_of_the_mouse` | ハツカネズミの習性 | Way of the Mouse | — | way | way setup command non-supply |
| `way_of_the_mule` | ラバの習性 | Way of the Mule | — | way | way |
| `way_of_the_otter` | カワウソの習性 | Way of the Otter | — | way | way |
| `way_of_the_owl` | フクロウの習性 | Way of the Owl | — | way | way |
| `way_of_the_ox` | 雄牛の習性 | Way of the Ox | — | way | way |
| `way_of_the_pig` | 豚の習性 | Way of the Pig | — | way | way |
| `way_of_the_rat` | ドブネズミの習性 | Way of the Rat | — | way | way |
| `way_of_the_seal` | アザラシの習性 | Way of the Seal | — | way | way on-gain |
| `way_of_the_sheep` | 羊の習性 | Way of the Sheep | — | way | way |
| `way_of_the_squirrel` | リスの習性 | Way of the Squirrel | — | way | way |
| `way_of_the_turtle` | ウミガメの習性 | Way of the Turtle | — | way | way duration |
| `way_of_the_worm` | ミミズの習性 | Way of the Worm | — | way | way exile |

### チョウの習性（Way of the Butterfly・`way_of_the_butterfly`）

- 種別: way ／ 確度: high（和名: high）

**英語（現行）**

```
You may return this to its pile to gain a card costing exactly $1 more than it.
```

**日本語（カタログ用・コピペ形）**

```
これをこのカードの山に戻してもよい。そうした場合、これよりコストがちょうど1コイン多いカード1枚を獲得する。
```

**裁定**

- 「山に戻せた場合のみ」獲得する。戻すのに失敗したら獲得も起きない（獲得は戻すことに条件づいている）。
- 非サプライの山（馬など）にも戻せる。一方、山を持たないカード（暗黒時代の共同墓地＝避難所、闇市場デッキから買ったカード）は戻せないので獲得なし。
- 獲得元はサプライのみ。種別は問わない（勝利点でも財宝でもよい）。ちょうど+1コインのカードがサプライに無ければ獲得しない。
- 任意（You may）。戻さない選択もできる。
- コスト比較の基準は「戻したカードのコスト」。このプロジェクトの規約どおり costExact 系の述語（coin/potion/debt の成分別比較）を使うこと。素の cardCost+1 で書くとポーション費用・負債コストを取りこぼす。
- 「戻す→獲得」の順。混合山（騎士/城）に戻すと山の一番上が変わるので、コスト基準は戻す前に確定しておくこと（既存の値切り屋バグと同型）。

### ラクダの習性（Way of the Camel・`way_of_the_camel`）

- 種別: way ／ 確度: high（和名: high）

**英語（現行）**

```
Exile a Gold from the Supply.
```

**日本語（カタログ用・コピペ形）**

```
サプライから金貨1枚を追放する。
```

**裁定**

- 【追放の基本】「追放する」＝自分の追放マットに置く。追放は獲得でも廃棄でもない。
- サプライからの追放は「獲得」ではないので、獲得時能力（on-gain）は一切誘発しない。
- 金貨の山が空なら何も起こらない（強制だが空振り）。
- アタックではない＝堀では防げない。他プレイヤーに影響しない。
- 追放マット上のカードは自分のもの＝ゲーム終了時の得点計算に含める（庭園・品評会などの所有カード計算にも入る）。
- 追放マットは公開情報（表向き）＝オンラインのマスク対象にしない。
- 【重要】後で金貨を獲得したとき、追放マット上の金貨を「すべて」捨て札にしてよい（任意）。一部だけ捨てることはできない＝全部か0枚か。
- 追放マットから捨て札にするのは「獲得」ではないが「捨てる」ではある＝トンネル（異郷）や村有緑地を誘発し得る。
- 追放を使うカードが王国にあるとき、各プレイヤーに追放マットを配る（setup）。

### カメレオンの習性（Way of the Chameleon・`way_of_the_chameleon`）

- 種別: way ／ 確度: high（和名: high）

**英語（現行）**

```
Follow this card's instructions; each time that would give you +Cards this turn, you get +$ instead, and vice-versa.
```

**日本語（カタログ用・コピペ形）**

```
このカードの指示に従う。ただしこのターン、それにより「+カード」を得るなら、代わりに同じ数の「+コイン」を得る。逆も同様。
```

**裁定**

- 他の習性と違い「カードの指示に従う」＝カードの効果は実行され、+カードと+コインだけが入れ替わる。
- 入れ替わるのは「+カード」「+コイン」という表記だけ。「手札が6枚になるまで引く」など別の言い回しのドローは変換されない（フクロウの習性の文言は対象外）。
- 持続カードに使った場合、そのターンに得る分だけ入れ替わる。次のターン分は通常どおり（例：商船＝今ターン+2カード、次ターンは通常の+2コイン）。
- そのカードが別のカードを使用した場合、そのカードは通常どおり動く（そちらにも習性を使わない限り）。
- +財源（Coffers）とは無関係＝変換されない。コインを失う効果（貧民街・スーク）にも影響しない。
- エンチャントレス／追い剥ぎ（Highwayman）はカードの指示自体を上書きするので、カメレオンの習性は機能しない（指示に従うことが前提のため）。
- 教師（Teacher）の山トークンのボーナスは習性を選ぶ前に適用されるので変換されない。
- -1カードトークン／-1コイントークンを持っているとき、変換後のボーナスではトークンを取り除かない。
- 選択肢のあるカード（重臣など）は記載順にボーナスを得る。
- 他プレイヤーが得るボーナスには影響しない（総督で自分は+コイン、相手は+1カードのまま）。
- ブーン（夜想曲）や同盟（Allies）のボーナスは影響を受けない。
- そのターン後半に発生するボーナスにも適用され続ける（司祭＝廃棄のたびに+2カードになる）。
- 使用時効果のみ対象。行進で遊牧民を2回使用しても、廃棄時の+コインは変換されない。
- +カードと+コインを両方持たないカード（礼拝堂）や同数持つカード（市場）にも使用できる（効果は実質同じ）。
- 【2025年2月エラッタ後】戦車競走が「+1 カード、それを公開する」になったため、カメレオンの習性や-1カードトークンの影響でカードを公開できずボーナスを得られなくなり得る。

### カエルの習性（Way of the Frog・`way_of_the_frog`）

- 種別: way ／ 確度: high（和名: high）

**英語（現行）**

```
+1 Action
When you discard this from play this turn, put it onto your deck.
```

**日本語（カタログ用・コピペ形）**

```
+1 アクション\nこのターン、これを場から捨て札にするとき、これを山札の上に置く。
```

**裁定**

- 公式FAQは無し（simplistic 扱い）。
- 「場から捨て札にするとき」＝通常はクリンナップ。このプロジェクトは自分の手番終了時に次の手札を先引きするので、山札の上に置く処理は先引きより前に行うこと（角笛と同じ罠）。
- このターン中に場から捨て札にされなければ、山札の上には置かれない。
- 玉座の間で持続カード（船着場など）を2回使用し、2回目にカエルの習性を使った場合、+1 アクションは得るが、船着場はこのターン場から捨て札にならない（持続で場に残る）ので山札の上には置かれない。
- 複数のカードが同時に山札の上に置かれる場合、置く順番は自分で選ぶ（一般ルール）。

### ヤギの習性（Way of the Goat・`way_of_the_goat`）

- 種別: way ／ 確度: high（和名: high）

**英語（現行）**

```
Trash a card from your hand.
```

**日本語（カタログ用・コピペ形）**

```
手札からカード1枚を廃棄する。
```

**裁定**

- 公式FAQは無し（あまりに単純なため公式FAQが用意されていない、と wiki が明記）。
- 「You may」が無い＝強制。手札があれば必ず1枚廃棄する。
- 手札が0枚なら何も起こらない（終端保証：pending を立てないか、選択肢0で自動終端させること）。
- 廃棄なので廃棄時トリガー（城塞・ネズミ・封土・墓・青空市場など）は通常どおり誘発する。このプロジェクトでは必ず trashCard() を通すこと。
- 廃棄の所有者は使用したプレイヤー自身＝司祭の+2コインや青空市場（自分のカードが廃棄された）が正しく乗る。

### 馬の習性（Way of the Horse・`way_of_the_horse`）

- 種別: way ／ 確度: high（和名: high）

**英語（現行）**

```
+2 Cards
+1 Action
Return this to its pile.
```

**日本語（カタログ用・コピペ形）**

```
+2 カード\n+1 アクション\nこれをこのカードの山に戻す。
```

**裁定**

- 非サプライの山（馬の山など）にも戻る。山の一番上に置く。
- 山を持たないカード（暗黒時代の共同墓地、闇市場デッキから買ったカード）は戻せない。
- 戻すのに失敗しても +2 カード と +1 アクション は得られる（チョウの習性と違い、ボーナスは戻すことに条件づいていない）。
- 降霊術師で廃棄置き場のカードを（場に出さずに）使用して馬の習性を使った場合、そのカードは山に移動しない。
- 順序はカード記載どおり＝+2 カード → +1 アクション → 山に戻す。ドローが先。
- 戻すのは「獲得」でも「廃棄」でもない＝獲得/廃棄トリガーは誘発しない。山の残枚数が増えるので3山終了の判定に影響する。
- 名前は馬（Horse）だが、馬の山とは無関係。任意のアクションカードを自分の山に戻す。

### モグラの習性（Way of the Mole・`way_of_the_mole`）

- 種別: way ／ 確度: high（和名: high）

**英語（現行）**

```
+1 Action
Discard your hand. +3 Cards.
```

**日本語（カタログ用・コピペ形）**

```
+1 アクション\n手札をすべて捨て札にする。+3 カード。
```

**裁定**

- 捨てる手札が1枚も無くても +3 カード は引く（公式FAQ明記）。
- 強制。手札を選べず全部捨てる。
- 手札を捨てるので捨て札トリガー（トンネル＝金貨獲得、村有緑地）が誘発し得る。このプロジェクトでは triggerOnDiscard を通すこと。
- 順序＝+1 アクション → 手札を全部捨てる → 3枚引く。捨ててから引くので、引いた札を捨てることはない。

### サルの習性（Way of the Monkey・`way_of_the_monkey`）

- 種別: way ／ 確度: high（和名: high）

**英語（現行）**

```
+1 Buy
+$1
```

**日本語（カタログ用・コピペ形）**

```
+1 購入\n+1 コイン
```

**裁定**

- 公式FAQは無し（あまりに単純なため公式FAQが用意されていない、と wiki が明記）。
- 順序を気にする場合、+1 購入 が先で、その後 +1 コイン（wiki の rules clarification）。
- -1コイントークンを持っている場合、この +1 コイン に食い込む（このプロジェクトの applyCoinPenalty を通すこと）。

### ハツカネズミの習性（Way of the Mouse・`way_of_the_mouse`）

- 種別: way ／ 確度: high（和名: high）

**英語（現行）**

```
Play the set-aside card, leaving it there.
————
Setup: Set aside an unused non-Duration Action costing $2 or $3.
```

**日本語（カタログ用・コピペ形）**

```
脇に置かれているカードを使用する。そのカードは脇に置いたままにする。\n————\n準備：このゲームで使わない、コスト2コインまたは3コインの、持続でないアクションの王国カード1枚を脇に置く。
```

**エラッタ**: 2025年2月（英語版 移動動物園 改版に伴うエラッタ）＝準備の対象条件に「non-Duration（持続でない）」が追加された。変更前『Setup: Set aside an unused Action costing $2 or $3.』→ 変更後『Setup: Set aside an unused non-Duration Action costing $2 or $3.』＝持続カードが脇置きの対象に選ばれなくなった。同じエラッタで はみだし者(Band of Misfits)・大君主(Overlord)・相続(Inheritance) にも同様に non-Duration が追加されている（＝場に出さずに使用するカードで持続の追跡が困難な問題への対処）。カード表面の主文『Play the set-aside card, leaving it there.』は変更なし。

**裁定**

- 【準備】ゲーム開始時に、このゲームで使わない「王国カード」で、コスト2コインまたは3コインのアクションカード1枚を脇に置く（2025年2月エラッタ以降は持続カードを除く）。そのカードが要求するセットアップも行う。
- 脇に置いたカードは王国の10種には含まれず、サプライにも無い。
- 使用しても脇に置いたままで、場には出ない。したがって「これが場にある間」の能力は何もしない。
- 場に無いので自分自身を動かす効果は失敗する（例：禁制品 Embargo は自身を廃棄できない）。この点は既存の「命令（Command）＝プレイした札は動かない」と完全に同型なので、このプロジェクトの playAsCommand / takeSelf / playedByCommand をそのまま流用できる。
- 区切り線より下のテキスト（準備を除く）は何もしない。
- 脇に置いたカード自体を使用するときに、さらにハツカネズミの習性を使うことはできない（チャンピオンとの無限ループ防止）。
- 例：そりを脇に置いたなら、任意のアクションカードを使って馬2枚を獲得できる。
- 脇に置いたカードは獲得も廃棄もされていない＝そのカードの山はそもそもサプライに無い。3山終了の判定に含めない。
- 【エラッタ前の挙動（参考）】脇のカードが持続だった場合、この習性で使用したカードは、その持続が場に残るのと同じだけ場に残っていた。2025年2月エラッタで持続が選ばれなくなったため、この処理は不要になった。
- このプロジェクトでは新 pending（脇のカードの効果解決）に CPU decidePending と UI viewPendingModal の分岐が必須。脇のカードが選択を要求する種類（例：地下貯蔵庫）なら特に注意。

### ラバの習性（Way of the Mule・`way_of_the_mule`）

- 種別: way ／ 確度: high（和名: high）

**英語（現行）**

```
+1 Action
+$1
```

**日本語（カタログ用・コピペ形）**

```
+1 アクション\n+1 コイン
```

**裁定**

- 公式FAQは無し（あまりに単純なため公式FAQが用意されていない、と wiki が明記）。
- 順序を気にする場合、+1 アクション が先で、その後 +1 コイン（wiki の rules clarification）。
- アクション権を消費して使い、+1 アクションで戻るので実質アクション権は減らない（キャントリップのコイン版）。
- -1コイントークンを持っている場合、この +1 コイン に食い込む（applyCoinPenalty を通すこと）。

### カワウソの習性（Way of the Otter・`way_of_the_otter`）

- 種別: way ／ 確度: high（和名: high）

**英語（現行）**

```
+2 Cards
```

**日本語（カタログ用・コピペ形）**

```
+2 カード
```

**裁定**

- 公式FAQは存在しない（英語ウィキに「単純すぎるため公式FAQを持たない」と明記）。
- ウェイ共通：このウェイでアクションカードを使うと、そのカード本来の効果は一切起きない。カードは通常どおり場に出て、クリンナップで捨て札になる。
- ウェイ共通：区切り線の下のテキストは影響を受けず、通常どおり働く（例：冒険の農民など）。
- ウェイ共通：冒険の山トークン（+1カード/+1アクション/+1購入/+1コイン）や -1カード/-1コイントークンは、ウェイで使ったときも適用される。

### フクロウの習性（Way of the Owl・`way_of_the_owl`）

- 種別: way ／ 確度: high（和名: high）

**英語（現行）**

```
Draw until you have 6 cards in hand.
```

**日本語（カタログ用・コピペ形）**

```
手札が6枚になるまで引く。
```

**裁定**

- すでに手札が6枚以上ある場合、1枚も引かない（公式FAQ／ルールブック本文）。
- 判定時点でこのウェイで使ったカード自身は場に出ている＝手札枚数には含まれない（導出）。
- ウェイ共通：カード本来の効果は起きない。
- 日本語版の公式カード文は「手札が6枚になるようにカードを引く。」。本プロジェクトでは同義の既存表現（物見やぐらの『手札が6枚になるまで引く。』）に合わせた。

### 雄牛の習性（Way of the Ox・`way_of_the_ox`）

- 種別: way ／ 確度: high（和名: high）

**英語（現行）**

```
+2 Actions
```

**日本語（カタログ用・コピペ形）**

```
+2 アクション
```

**裁定**

- 公式FAQは存在しない（英語ウィキに「単純すぎるため公式FAQを持たない」と明記）。
- 【重要】ルールブックのプレイ例：馬(Horse)を雄牛の習性で使うと +2 アクションだけを得て、馬は山に戻らず場に残る。＝ウェイで使うと「これを山に戻す」も起きない。
- ウェイ共通：カード本来の効果は起きない。

### 豚の習性（Way of the Pig・`way_of_the_pig`）

- 種別: way ／ 確度: high（和名: high）

**英語（現行）**

```
+1 Card
+1 Action
```

**日本語（カタログ用・コピペ形）**

```
+1 カード\n+1 アクション
```

**裁定**

- 公式FAQは存在しない（英語ウィキに「単純すぎるため公式FAQを持たない」と明記）。
- 任意のアクションカードをキャントリップ（+1カード+1アクション）に変えられる。
- ウェイ共通：カード本来の効果は起きない。

### ドブネズミの習性（Way of the Rat・`way_of_the_rat`）

- 種別: way ／ 確度: high（和名: high）

**英語（現行）**

```
You may discard a Treasure to gain a copy of this.
```

**日本語（カタログ用・コピペ形）**

```
これと同じカード1枚を獲得するために、財宝カード1枚を捨て札にしてもよい。
```

**裁定**

- 【重要・公式FAQ】獲得できるのはサプライからのみ。＝馬・賞品・戦利品・狂人・傭兵・トラベラー成長先など非サプライのカードをこのウェイで使っても、コピーは獲得できない。
- 「これ」＝そのウェイで使っているカード自身（ウェイ共通ルール）。
- 財宝を捨てるのは任意。獲得は通常の「獲得」なので獲得時能力が誘発する（導出）。
- 実装注意：獲得できない（サプライに無い／山が空）ときに財宝だけ捨てさせないよう、コピーが獲得可能なときだけ選択肢を出すのが安全。
- ウェイ共通：カード本来の効果は起きない（使ったカード自身は場に残り、クリンナップで捨て札）。

### アザラシの習性（Way of the Seal・`way_of_the_seal`）

- 種別: way ／ 確度: high（和名: high）

**英語（現行）**

```
+$1
This turn, when you gain a card, you may put it onto your deck.
```

**日本語（カタログ用・コピペ形）**

```
+1 コイン\nこのターン、カード1枚を獲得したとき、それを山札の上に置いてもよい。
```

**裁定**

- 【公式FAQ】購入による獲得も、それ以外の方法による獲得も、すべての獲得が対象。
- 【公式FAQ】カードはまず通常の獲得先に置かれ、その後で山札の上に移してよい。途中で別の場所に動いた場合（例：繁栄の物見やぐらで廃棄した）は移せない。
- 効果はそのターンの残り全体に持続する（次のターンには持ち越さない）。
- 同じターンに複数回使えば +コインは累積するが、「山札の上に置いてよい」の効果は重複しても同じ（導出）。
- ウェイ共通：カード本来の効果は起きない。

### 羊の習性（Way of the Sheep・`way_of_the_sheep`）

- 種別: way ／ 確度: high（和名: high）

**英語（現行）**

```
+$2
```

**日本語（カタログ用・コピペ形）**

```
+2 コイン
```

**裁定**

- 公式FAQは存在しない（英語ウィキに明記）。
- 【重要】ルールブックのウェイ解説で使われている例：馬(Horse)を羊の習性で使うと +2 コインだけを得て、+2 カード +1 アクションも、馬を山に戻すことも起きない。
- ルールブックの区切り線ルールの例：初版の街道(Highway)を羊の習性で使うと +2 コインを得たうえで、街道が場にある間のコスト軽減は働く（第二版の街道は区切り線が無くなったのでこの例は当てはまらない）。
- ウェイ共通：カード本来の効果は起きない。

### リスの習性（Way of the Squirrel・`way_of_the_squirrel`）

- 種別: way ／ 確度: high（和名: high）

**英語（現行）**

```
+2 Cards at the end of this turn.
```

**日本語（カタログ用・コピペ形）**

```
このターンの終了時（手札を引いた後）に +2 カード。
```

**裁定**

- 【重要・公式FAQ】通常は「クリンナップで手札を引いた後」に2枚引く。★このエンジンは自分の手番終了時に次の手札を先引きする設計なので、先引きの5枚の後にさらに2枚引く＝次の手札が7枚になる（冒険の『保存(save)』と同じタイミング処理）。
- 【公式FAQ】自分の手番でないときに使っても（黒猫のリアクション経由など）、そのターンの終了時に2枚引く。
- 同じターンに複数回使えば累積する（導出）。
- ウェイ共通：カード本来の効果は起きない。
- 日本語版の公式カード文は「このターンの終了時、＋２　カードを引く。」。「（手札を引いた後）」は本プロジェクトの既存カタログ（保存）に倣って明示した補足。

### ウミガメの習性（Way of the Turtle・`way_of_the_turtle`）

- 種別: way ／ 確度: high（和名: high）

**英語（現行）**

```
Set this aside. If you did, play it at the start of your next turn.
```

**日本語（カタログ用・コピペ形）**

```
これを脇に置く。脇に置いた場合、次のターンの開始時にそれを使用する。
```

**裁定**

- 【公式FAQ】次のターン開始時にそのカードを使うとき、再びウミガメの習性を選んでさらに1ターン先送りできる。何度でも繰り返せる。
- 【公式FAQ】次のターンにそのカードを使うのにアクション権は消費しない。
- 【公式FAQ】玉座の間などで2回使ってからウミガメの習性を選んでも、玉座の間が脇に置かれることはなく、持続カードのように場に残ることもない。
- 【公式裁定】玉座の間で2回使い、2回ともウミガメの習性を選んだ場合、次のターンに使えるのは1回だけ（2回目は既に脇にあり脇に置けないため）。
- 【公式裁定】玉座の間で持続カードを1回目は通常・2回目をウミガメの習性で使った場合、玉座の間は場を離れる。持続効果は次のターンに自分で覚えておく必要がある。
- 【公式裁定】冒険のリザーブ（変容など・ターン開始時に呼び出せるもの）にウミガメの習性を使うと、次のターン開始時にそれを使用し→酒場マットに置き→まだターン開始時なので即座に呼び出せる。
- 「脇に置いた場合」＝脇に置けなかった場合（すでに場から動いている等）は次のターンの使用は起きない（lose track）。
- 脇に置くので、そのカードはこのターンのクリンナップでは捨て札にならない。
- ウェイ共通：カード本来の効果は起きない。「これ」＝そのウェイで使っているカード自身。

### ミミズの習性（Way of the Worm・`way_of_the_worm`）

- 種別: way ／ 確度: high（和名: high）

**英語（現行）**

```
Exile an Estate from the Supply.
```

**日本語（カタログ用・コピペ形）**

```
サプライの屋敷1枚を追放する。
```

**裁定**

- 公式FAQは存在しない（英語ウィキに明記）。以下は追放(Exile)の共通ルール（ルールブック本文）から。
- 【重要】サプライからカードを追放するのは「獲得」ではない＝獲得時能力（when you gain this）は誘発しない。
- 追放マット上のカードは自分のもので、ゲーム終了時の得点計算に含める＝追放した屋敷1枚につき1勝利点。
- 追放マットは表向きで公開情報（オンラインでもマスクしない）。
- 追放は屋敷の山から物理的にカードを取る＝屋敷の山が減り、空にもなり得る＝3山終了に影響する（導出）。
- 屋敷の山が空なら追放できない（何も起きない）（導出）。
- 後で屋敷を獲得したとき、追放マット上の屋敷を「他のコピー全部」捨て札にしてもよい。1枚だけ捨てることはできない（全部か0枚か）。
- 追放マットからの捨て札は「獲得」ではない。ただしクリンナップ以外で起きた場合は「捨て札にする」なので、トンネル（異郷）や村有緑地(Village Green)を誘発できる。
- ウェイ共通：カード本来の効果は起きない。
- このウェイを使うゲームでは各プレイヤーに追放マットが必要（setup）。

## 6. 敵対検証で出た訂正（研究データ側の誤りとその正解）

**上のカード節の本文には未反映のものがある。食い違ったらこの節が正。**

### [high] sheepdog — rulings / reaction trigger（機構）

- **誤**: Sheepdog（牧羊犬・$3）：「いずれかのプレイヤーがカードを獲得したとき、手札から使用してよい」（＝any player's gain でリアクション窓が開く）
- **正**: 「あなたがカードを獲得したとき」＝自分自身の獲得だけ。英語原文は "When you gain a card, you may play this from your hand."（相手のターン中でも発火するが、それは『自分が』獲得した場合＝黒猫で呪いを押し付けられた等）。『いずれかのプレイヤーが』と明記されているのは Falconer（鷹匠）だけ＝"When any player gains a card with 2 or more types..."。両者を混同している。
- 根拠: ① RGG公式ルールブックPDF p.6 のカード画像テキスト逐語："Sheepdog / +2 Cards / When you gain a card, you may play this from your hand."（https://www.riograndegames.com/wp-content/uploads/2020/01/Dominion-Menagerie-Rules.pdf を実DLし pdftotext -layout で確認）。② 同PDF p.10 の公式FAQ逐語："Sheepdog: You can use this when gaining a card due to buying it, when gaining a card some other way such as due to Falconer, and even when gaining a card on another player's turn, such as due to Black Cat."（＝『自分が』相手のターン中に獲得した場合）。③ 同PDF p.6 のプレイ例逐語："...giving Simon and Jeff each a Curse. Gaining a Curse lets Jeff play a Sheepdog, which he does"＝Jeff は『自分が』呪いを獲得したから使えている。④ https://dominionstrategy.fandom.com/wiki/Sheepdog （Official FAQ 同文）。⑤ 対比＝https://dominionstrategy.fandom.com/wiki/Falconer 逐語："When any player gains a card with 2 or more types (Action, Attack, etc.), you may play this from your hand." / "You can do this regardless of who gained the card - you or anyone else - and regardless of whose turn it is." ⑥ 日本語ウィキの一覧表も鷹匠だけ「いずれかのプレイヤーが」と書き、牧羊犬は「カード獲得時」（https://wikiwiki.jp/dominiondeck/移動動物園（拡張））。→ 本文書の『リアクション窓をどの獲得で開くか』という設計指針そのものが誤るため high。

### [medium] wayfarer — rulings（kingdom3）

- **誤**: コスト減少（橋・街道など）は行人には適用されない。そのターンにまだ1枚も獲得していない間だけ適用される（例：橋をプレイすると行人は5コイン。**その後に銀貨を購入すると行人は3コインになる**）。
- **正**: その後に銀貨を購入すると行人は **2コイン** になる（橋で銀貨自身が$2に下がっており、行人はその「現在の」コストをコピーするため）。一般則の記述部分は正しいが、例の数値が誤り。この誤りは「行人は最後に獲得したカードの *素の* コストをコピーする」という誤ったモデルを示唆するため、実装時に致命的（正しくは *コスト軽減適用後の現在コスト* をコピーする）。
- 根拠: http://wiki.dominionstrategy.com/index.php/Wayfarer 「Official FAQ」節 逐語: "Cards that lower costs, like Bridge from Intrigue, only apply to the other card, not to Wayfarer too (though they apply to Wayfarer if no other cards have been gained yet). For example, if you play Bridge, Wayfarer costs {$5}; if you then buy a Silver, at that point Wayfarer costs {$2}, the same as Silver." ／ 同節の別ルーリングも整合: "If the cost of the last card gained changes after it was gained, the cost of Wayfarer changes too."（Fisherman $5→$2 の例）

### [medium] enhance — rulings（event1）

- **誤**: 「増大は購入フェイズに購入するので、行商人はアクションフェイズより高い$8として扱われる点に注意。」（購入フェイズの方が行商人が高い、という記述）
- **正**: 逆。行商人(Peddler)は『During a player's Buy phase, this costs $2 less per Action card they have in play.』＝**購入フェイズでこそ安くなる**（場のアクション1枚につき$2安・最低$0）。アクションフェイズ中は常に$8。したがって増大で購入フェイズに行商人を廃棄すると基準コストは$8ではなく下がった後の値（例：場にアクション4枚なら$0 → 獲得できるのは$2以下）。なお『$1安』でもなく『$2安』。
- 根拠: https://wiki.dominionstrategy.com/index.php/Peddler ｜ Infobox text2: "During a player's Buy phase, this costs {{Cost|2}} less per Action card they have in play." ／ 本文: "During the Action phase of a turn, Peddler's cost is always {{Cost|8}}, which allows trash-for-benefit cards to get more value out of it than you may have spent buying it." ／ Official FAQ: "Most of the time, this costs $8. During a player's Buy phase, this costs $2 less per Action card that player has in play."

### [medium] desperation — rulings（event1）

- **誤**: 「『各ターンに1度』は効果への制限であり、購入自体を禁じる文言ではない（冒険の『1ターンに1回しか購入できない』とは書き方が違う）。…購入権とコインがあれば同じターンに複数回購入できるが、2回目以降は効果が無い＝購入権の無駄。」
- **正**: 括弧内が事実誤認。冒険のイベントも**現行印刷では絶望と全く同じ『Once per turn:』接頭辞**（Alms/Save/Borrow/Pilgrimage、同盟拡張の Continue も同様）。そしてこの文言を持つイベントの公式FAQは一律『You can only buy this once per turn.』＝**2回目の購入自体ができない**。よって絶望も『1ターンに1回しか買えない』と扱うのが公式解釈で、『複数回買えるが効果が無い』は誤り。（対照的に Mission/Journey は errata で『Once per turn:』が外れており、そちらだけが「複数回買えて2回目以降が空振り」）。※絶望の個別ページには当該FAQ行が無いため断定は同文言カードからの推論だが、公式FAQの一貫性・日本語版イベント総則（「イベントの能力に制限が書かれていない限り…何度でも購入することができる」）とも整合する。
- 根拠: https://wiki.dominionstrategy.com/index.php/Alms （text: "Once per turn: If you have no Treasures in play..." / Official FAQ: "You can only buy this once per turn."）／ https://wiki.dominionstrategy.com/index.php/Save ／ https://wiki.dominionstrategy.com/index.php/Borrow ／ https://wiki.dominionstrategy.com/index.php/Pilgrimage ／ https://wiki.dominionstrategy.com/index.php/Continue （いずれも同一の「Once per turn:」＋"You can only buy this once per turn."）／ https://wiki.dominionstrategy.com/index.php/Mission ・ https://wiki.dominionstrategy.com/index.php/Journey （現行テキストに Once per turn: が無く「複数回買えるが2回目は失敗」と明記＝対照例）／ https://wikiwiki.jp/dominiondeck/%E6%96%BD%E3%81%97 「施しの購入は1ターンに1度しか行えない。」／ https://wikiwiki.jp/dominiondeck/%E3%82%A4%E3%83%99%E3%83%B3%E3%83%88 「イベントの能力に制限が書かれていない限りコストと購入権が有れば何度でも購入することができる。」

### [medium] gamble — errata（event1）

- **誤**: 「旧文は『使用しないと選んだアクション/財宝をどうするのか（山札に戻すのか捨てるのか）』が読み取りにくかったための明確化。挙動はほぼ同じ」
- **正**: 公式エラッタの内容は**『Discards the card without revealing it.（公開せずに捨て札にする）』で、wiki の 2025 Errata では「Functional card changes（機能変更）」に分類**されている。旧文でも「使用しない場合は捨て札にする」ことは旧公式FAQで明示されていた（"If you do not play the card - whether or not it is an Action or Treasure - discard it."）ので、曖昧さの解消が理由ではない。実際の差分は (a) **公開しなくなった**（公開をトリガーにする効果が誘発しない／相手に見えない）、(b) **使用する場合でも必ず先に捨て札を経由する**ため、捨て札トリガー（忠犬・トンネル・村緑地など）が誘発するようになった点＝『挙動はほぼ同じ』は誤り。
- 根拠: https://wiki.dominionstrategy.com/index.php/2025_Errata 「== Card errata == === Functional card changes === * {{Event|Gamble}} — Discards the card without revealing it.」／ https://wiki.dominionstrategy.com/index.php/Gamble の Versions: 第1版="Reveal the top card of your deck. If it's a Treasure or Action, you may play it. Otherwise, discard it." → February 2025 版="Discard the top card of your deck. If it's an Action or Treasure, you may play it."（注記リンク先が [[2025 Errata#Functional card changes|Discard the card without revealing it.]]）／ 旧公式FAQ（Module:Gamble, dominionstrategy.miraheze.org/wiki/Module:Gamble）"If you do not play the card - whether or not it is an Action or Treasure - discard it."

### [medium] march — rulings（event2）

- **誤**: 「購入フェイズ中なので、使用したアクションで財宝を引いても（通常は）その財宝を使えない（イベント購入後は財宝を出せない）。引いたアクションは進軍をもう一度購入すれば使える。」
- **正**: 後半が誤り。進軍が使用できるのは『捨て札置き場にある』アクションであり、使用したアクションで引いたカードは手札に入るため、進軍をもう一度買っても使えない。この文は Toil（苦労＝手札から使用）の裁定を誤って転記したもの。March の wiki 裁定は『引いた アクション・財宝は（通常）使えない／夜行カードは後の夜フェイズに使える』までで、『買い直せば使える』は含まれない。
- 根拠: http://wiki.dominionstrategy.com/index.php/March 『Other rules clarifications: If you buy March and play an Action card that draws additional cards into your hand, you can't play any Action or Treasure cards you drew (under ordinary circumstances). If you draw Night cards, you can play them during your upcoming Night phase.』（=買い直し条項なし）／対して http://wiki.dominionstrategy.com/index.php/Toil 『...if you draw any Action cards, you can play them by buying Toil again.』／カードテキスト『Look through your discard pile. You may play an Action card from it.』

### [medium] invest — rulings（event2）

- **誤**: 「追放するカード自身がアクションであればよく、山全体がアクションの山である必要はない（分割山の下段など）。」
- **正**: 前段は公式FAQどおり正しいが、例示『分割山の下段』が誤り。『サプライから』＝山の一番上のカードだけが対象で、上段が残っている分割山の下段は『サプライにある』とみなされず追放できない（＝この実装の splitLocked を無視すると本番バグになる）。正しい例は『アクションでない山に入っているアクションカード』＝城の山（ランダマイザーは勝利点）の 小さい城／華やかな城、騎士の山 など。逆に『アクションの山の一番上が非アクション』（石・大金）は追放できない。なお rulings に『追放できるのは各山の一番上の1枚だけ』という実装必須のルール自体が記載されていない。
- 根拠: http://wiki.dominionstrategy.com/index.php/Supply 『only the top card of any pile is considered to be "in the Supply". For instance, when Band of Misfits requires you to choose a "card in the Supply", you may not choose a card in the Ruins or Knights pile other than the one on top.』／http://wiki.dominionstrategy.com/index.php/Split_pile 『Players may only Buy or Gain the top card of a pile; players have to work through the top 5 cards to get to the bottom 5.』／http://wiki.dominionstrategy.com/index.php/Lurker 『You can only trash the top card of a Supply pile, which may matter with split piles or Knights.』

### [medium] way_of_the_chameleon — rulings（way1）

- **誤**: （記載なし）＝「+カード」と「draw（引く）」の刷り違いに関する公式 rules clarification が rulings に一つも入っていない。
- **正**: 公式 clarification を追加すべき："Different printings of Cellar, Oracle, Storeroom, and Storyteller have inconsistent uses of \"+Cards\" and \"draw.\" Go by whichever wording is printed on the cards you are using (only +Cards is affected by Way of the Chameleon)." 日本語版wikiはDominion Online基準を明記＝地下貯蔵庫(Cellar)・物置(Storeroom)は英語版が"draw"のため非対象／語り部(Storyteller)・神託(Oracle)は"+X Cards"のため対象。本プロジェクトは Cellar・Storeroom・Oracle・Storyteller の4枚とも実装済みで、しかも Storyteller は §0-9 で2022エラッタの「+1カード」に書き換えてある＝カメレオンの変換対象になる。この裁定が抜けたまま実装すると4枚が誤動作する。
- 根拠: http://wiki.dominionstrategy.com/index.php/Way_of_the_Chameleon の Other rules clarifications（Anubis回避のため https://web.archive.org/web/20251214id_/http://wiki.dominionstrategy.com/index.php/Way_of_the_Chameleon で取得。該当記述＝「Different printings of Cellar, Oracle, Storeroom, and Storyteller have inconsistent uses of "+Cards" and "draw."…(only +Cards is affected by Way of the Chameleon)」）／https://wikiwiki.jp/dominiondeck/カメレオンの習性 「オンライン版では非対象（英語版が"draw"）：地下貯蔵庫・物置／オンライン版では対象（英語版が"+Xcard"）：語り部・神託」

### [medium] way_of_the_otter — rulings（way2）

- **誤**: 「ウェイ共通」ルールとして3件のみ記載（①本来の効果は起きない ②区切り線の下は影響を受けない ③冒険のトークンは適用される）。この3件セットが全10枚に展開されている。
- **正**: RGG公式ルールブックの Ways 共通ルールは11項目あり、うち本プロジェクトが既に実装済みの機構に直接効く4件が抜けている。(a) 女魔術師(Enchantress・帝国＝実装済み)："If you are affected by Enchantress, you can use a Way instead of getting the +1 Card and +1 Action that Enchantress's effect would give you." (b) 変則タイミングの使用（番犬・隊商の護衛・村有緑地など＝実装済み）："When an Action card can be played at an unusual time, like Sheepdog, it can still be used as a Way." (c)【最重要】複数回プレイと持続："If you play an Action card multiple times, with a card like Mastermind, you can choose for each play whether you want it to use a Way or not. If the card you are playing is a Duration card, it only stays in play if at least one of its plays was for its own abilities."＝プレイごとに独立してウェイを選べ、全部ウェイなら持続カードは場に残らない。玉座の間/王の宮廷/行進/山砦/冠/船長/王子を実装済みの本エンジンの持続処理（armDuration・durationCards）を壊しうる。(d) 選択タイミング："The choice to use a Way or not happens after 'first' abilities on cards like Moat and Kiln."
- 根拠: https://www.riograndegames.com/wp-content/uploads/2020/01/DominionMenagerie.pdf （pdftotext -layout で逐語抽出。p.3「Menagerie has Ways.」節の箇条書き全11項目。上記(a)-(d)は同節の原文ママ）／裏付け https://wikiwiki.jp/dominiondeck/%E7%BF%92%E6%80%A7 「カメレオンの習性以外の習性で、女魔術師のアタックを避けられる…女魔術師に対する対策となり得る。」

### [medium] horse — rulings（nonsupply）

- **誤**: 【追放(Exile)】手札から追放する効果（聖域・強制退去・賞金稼ぎ・追放イベント）は馬を追放できる。一方ラクダの隊列・投資・輸送・ラクダの習性は「サプライから」追放するので馬の山は対象外。
- **正**: 記載漏れ：馬が追放マットに乗る経路は「手札からの追放」だけではない。①門番(Gatekeeper)＝『相手が追放マットに同名の無いアクション/財宝を獲得したとき、獲得したカードを追放する』→ 獲得した馬（アクション）は追放される。②枢機卿(Cardinal)＝『他の各プレイヤーは山札の上2枚を公開し、コスト3〜6のもの1枚を追放』→ 山札の馬（$3）は追放対象。どちらも移動動物園内で必ず同居し得るので、馬を Exile ロジックから一律除外すると同拡張内でルール違反になる。
- 根拠: RGG公式ルールブック(http://dominionleague.org/img/uploads/13-menagerie-rulebook.pdf ＝DommenagerieRules2019.qxp)：Gatekeeper節『While under this attack, whenever you gain an Action or Treasure that you do not have a copy of on your Exile mat, you Exile the gained card.』／Cardinal カード面『Each other player reveals the top 2 cards of their deck, Exiles one costing from $3 to $6, and discards the rest.』

### [medium] desperation — rulings / canBuyEvent（機構）

- **誤**: Desperation（絶望）は『1ターンに1回』＝2回目の購入自体を拒否する（購入権を無駄にしない）。既存の canBuyEvent の『1ターン1回』枠に載せる。
- **正**: 公式に『2回目の購入を拒否する』と書いた一次資料は存在しない。絶望のカード文は現代型の "Once per turn:" 前置句で、これは『効果が1ターン1回』の意。イベントの一般規則は『同じイベントを1ターンに複数回買える』で、購入を禁じているのは FAQ に "You can only buy this once per turn." を持つ冒険のイベント（施し/保存/巡礼等）だけ。絶望の公式FAQは『呪いの山が空なら獲得できず +1購入と+$2 も得られない』しか述べておらず、購入制限の記述が無い。→『買えるが2回目は何も起きない（購入権を無駄にする）』を既定と考えるべき。
- 根拠: ① RGG公式ルールブックPDF Events 節逐語："The same Event can be bought multiple times in a turn if you have the Buys and $ available to do it."（https://www.riograndegames.com/wp-content/uploads/2020/01/Dominion-Menagerie-Rules.pdf）。② 同PDF の Desperation 項の公式FAQは全文が "Desperation: If the Curse pile is empty, you fail to gain one and do not get +1 Buy and +$2." のみ＝購入制限の記述なし。③ https://dominionstrategy.fandom.com/wiki/Desperation （Official FAQ / Other rules clarifications とも購入回数に言及なし）。④ 対比＝https://dominionstrategy.fandom.com/wiki/Alms ・ https://dominionstrategy.fandom.com/wiki/Save ・ https://dominionstrategy.fandom.com/wiki/Pilgrimage はいずれもカード文が "Once per turn:" に改訂済みだが、公式FAQに "You can only buy this once per turn." の一文を明示的に持つ。絶望にはこの一文が無い。⑤ 使節団 Mission は現行エラッタで購入制限句自体が消えている（http://dominionleague.org/resources の New errata → Mission）。※正直に記すと、Alms 等がカード文 "Once per turn:" のまま FAQ に購入制限を残しているため公式資料自体に曖昧さが残る。断定はできないが、根拠なく『拒否する』と書き切っているのは問題。

### [medium] menagerie_2025_errata — errata / 網羅性（機構）

- **誤**: 2025年2月エラッタで変更されたのは Way of the Mouse・Reap・Gamble の3件＋命令系4種への non-Duration 追加＋持続の全体ルール変更（notes で『エラッタ・バッチを機械走査して確定した』と記述）
- **正**: Menagerie 内が3件というスコープ限定の主張は正しい（検証で一致）。ただし同じ 2025年2月エラッタ・バッチは、本プロジェクトが既に実装済みの帝国カードも変更している：【戦車競走 Chariot Race】"Reveal the top card of your deck and put it into your hand" → "+1 Card, revealing it."（ドローになったので -1カードトークン／カメレオンの習性の影響を受け、公開できずボーナスを逃す場合が生じる）／【儀式 Ritual】"+1 VP per $1 it cost" → "it costs"（廃棄直前のコスト参照という特殊処理が廃止され、他の廃棄コスト参照と同じ廃棄後コスト参照に）／【剣闘士 Gladiator】廃棄句から "Supply" 表記を削除（Ferryman との組合せで挙動変化あり）／【元手 Capital】負債返済句の削除。『バッチを確定した』と名乗る以上、既存実装に影響するこの4件の欠落は実害がある。
- 根拠: 日本語ウィキのエラッタ専用ページ（Last-modified 2026-01-24・英語原文併記）https://wikiwiki.jp/dominiondeck/英語版移動動物園（拡張）改版に伴う2025年2月エラッタ の「その他の変更」表逐語："Chariot Race / Empires / +1 Action Reveal the top card of your deck and put it into your hand. The player to your left reveals the top card of their deck. If your card costs more, +1 Coin and +1 VP. → +1 Action +1 Card, revealing it. The player to your left reveals the top card of their deck. If your card costs more, +1 Coin and +1 VP."、"Ritual / Empires / ... +1 VP per $1 it cost. → ... +1 VP per $1 it costs."。同ページ「カードの表記変更まとめ」節に 剣闘士（「サプライにある」表記非推奨・Ferryman で挙動変化）と 元手（負債返済句削除）。同ページ概要：「2025年2月に、暗黒時代、冒険、帝国、移動動物園（拡張）のカードなど＆持続に関するルールについて、エラッタ＆変更が発表された」。

### [medium] way_of_the_mouse — rulings / サプライ判定・3山終了（機構）

- **誤**: （脇に置いたカードについて）サプライか否か・3山終了に数えるかの記述が edge_cases に一切無い（コスト条件・命令同型・準備の連鎖のみを記載）。ユーザが明示的に問うた項目なのに答えていない。
- **正**: 脇に置くのは『1枚のカード』であって山ではない。サプライではなく、購入も獲得もできず、空山カウント（3山終了）にも一切関与しない（王国の山は常に10のまま）。ただし『そのカードが要求する準備』は行うので、隠遁者/浮浪児なら狂人/傭兵の山、トラベラーなら出世先の山、交易路なら勝利点の山にトークン、ピクシーなら家宝が初期デッキの銅貨と入れ替わる、闇市場なら闇市場デッキ、連携カードなら同盟＋全員1好意、が発生する（これらの山は各カード本来の扱いに従う）。この点が抜けていると『11個目の山を作る』実装事故になり得る。
- 根拠: ① RGG公式ルールブックPDF 準備節逐語："In games using Way of the Mouse, set aside an unused Action kingdom card costing $2 or $3, and do any setup that card requires."（pile ではなく card 1枚）。同PDF 冒頭："players must choose 10 sets of Kingdom cards for each game"（王国は常に10）。https://www.riograndegames.com/wp-content/uploads/2020/01/Dominion-Menagerie-Rules.pdf ② https://dominionstrategy.fandom.com/wiki/Way_of_the_Mouse Official FAQ："Set aside any unused Action kingdom card costing $2 or $3 at the start of the game. Do any setup that that card requires." / "Text below a dividing line (other than setup) will not do anything." ③ https://wikiwiki.jp/dominiondeck/ハツカネズミの習性 詳細なルール：「特別な準備が必要なカードが脇に置かれた場合、それも準備する」（交易路/隠遁者・浮浪児/トラベラー/幸運・不運/ピクシー/連携/闇市場 を具体列挙）＋「コストにポーションや負債を含むカード、廃墟、サプライに置かない山札のカードは対象とならない」。

### [low] coven — rulings（kingdom1）

- **誤**: 追放マットからの捨て札は「捨て札にする」行為なので、トンネル（異郷）や村有緑地の反応条件を満たす。
- **正**: 一般論としては正しいが、魔女の集会（Coven）では絶対に起こらない誤った適用。Coven が追放マットから捨てるのは「their Exiled Curses」＝呪いだけ。トンネル／村有緑地（Village Green）は「これ（自分自身）を捨て札にしたとき」にしか反応しないので、Coven の捨て札に混ざることは原理的にありえない。正しい記述は「Coven の追放マットからの捨て札は本物の『捨てる』なので on-discard フックは通す（＝engine の triggerOnDiscard を呼ぶ）。ただし捨てられるのは呪いのみなので、トンネル／村有緑地が実際に誘発することはない」。トンネル／村有緑地が追放マットからの捨て札で誘発するのは、Coven ではなく『同名カードを獲得して追放マットの同名コピーを捨てる』一般ルートのとき。
- 根拠: RGG 公式 Menagerie ルールブック p.3 Exile 節（http://dominionleague.org/img/uploads/13-menagerie-rulebook.pdf）逐語：「Discarding a card from your Exile mat is discarding a card; if it happens other than in Clean-up, it can trigger Tunnel (from Hinterlands) or Village Green.」／同 p.10 Village Green 項：「When you discard this other than during Clean-up, you may play it.」＝自分自身が捨てられたときのみ反応。／Coven のカードテキスト（https://dominionstrategy.miraheze.org/wiki/Module:Coven）：「Each other player Exiles a Curse from the Supply. If they can't, they discard their Exiled Curses.」＝捨てるのは呪いのみ。

### [low] cardinal — rulings（kingdom1）

- **誤**: （記載なし）＝枢機卿の「残りを捨て札にする」が on-discard 反応を誘発する点に一切触れていない
- **正**: 枢機卿こそが「捨て札トリガー」を実際に踏むカード。公式ルールブックが Village Green の誘発例として枢機卿を名指ししている：山札から公開された2枚のうち追放されなかったカードが捨てられるので、そこに村有緑地やトンネルがあれば誘発する。実装上 `discards the rest` は必ず triggerOnDiscard を通す必要がある（この項目が Coven 側に誤って書かれ、枢機卿側から抜けている）。
- 根拠: RGG 公式 Menagerie ルールブック p.10 Village Green 項（http://dominionleague.org/img/uploads/13-menagerie-rulebook.pdf）逐語：「This works whether it is your turn or another player's, and whether you discard it from your hand, or deck (such as with Cardinal), or from being set aside, or from Exile.」＝枢機卿による山札からの捨て札で村有緑地が誘発すると明記。

### [low] falconer — rulings（kingdom2）

- **誤**: 「ペテン師（charlatan・移動動物園）は呪いを財宝にもするので、相手に呪いを獲得させると鷹匠を使用できるようになる。」＝ペテン師を移動動物園のカードとしている
- **正**: ペテン師（Charlatan）は移動動物園ではなく【繁栄（第二版）】のカード。$5・種別は【アクション・アタック】（財宝ではない）。テキストは『+$3／他のプレイヤーは各自、呪い1枚を獲得する。——— このカードを使うゲームでは、呪いは$1の財宝でもある。』。なお条件は "In games using this"（＝場に出ている間ではなくゲーム全体）なので、王国にペテン師があれば常に呪いが2種別になり鷹匠が反応できる、という結論自体は正しい。
- 根拠: https://web.archive.org/web/20251218195339/https://wiki.dominionstrategy.com/index.php/Charlatan — 逐語: 「Type(s) Action - Attack」「Set Prosperity」「+$3 Each other player gains a Curse. / In games using this, Curse is also a Treasure worth $1.」「Charlatan is an Action-Attack card from the second edition of Prosperity.」

### [low] fisherman — jp_text（kingdom2）

- **誤**: 「ターン中、ターンプレイヤーの捨て札置き場が空の場合、このカードのコストは3コイン下がる。」
- **正**: カード面の英文は "During your turns, if your discard pile is empty, this costs $3 less." ＝「あなたのターン中、あなたの捨て札置き場が空の場合、このカードのコストは3コイン少なくなる。」。「ターンプレイヤーの捨て札置き場」は公式FAQの言い換え（"whenever the player whose turn it is has an empty discard pile"）であってカードテキストではない。効果は同値だがカード表示テキストとしては非忠実（日本語圏の記述も「あなたのターンの間、あなたの捨て札置き場にカードが1枚もない場合」）。実装挙動としては報告の記述（ターンプレイヤー基準）が正しいので、直すのは jp_text（表示文）のみでよい。
- 根拠: http://dominionleague.org/img/uploads/13-menagerie-rulebook.pdf（RGG公式・カード面）逐語: 「+1 Card / +1 Action / +$1 / During your turns, if your discard pile is empty, this costs $3 less.」／https://web.archive.org/web/20221003211337/http://wiki.dominionstrategy.com/index.php/Fisherman（Card text に <hr> と同一文）／https://wikiwiki.jp/dominiondeck/漁師 逐語:「あなたのターンの間、あなたの捨て札置き場にカードが1枚もない場合、このカードのコストは3少なくなる。」

### [low] livery — rulings（kingdom2）

- **誤**: 「弟子（Disciple）や Specialist で貸し馬屋のコピーを獲得した場合は馬を得る。」
- **正**: Disciple の日本語公式カード名は【門下生】（冒険）。「弟子」ではない。本プロジェクトの js/cards.js:680 も既に `disciple: name:'門下生'` になっているため、表記を揃えないと混乱する。ruling の内容自体（門下生／Specialist でコピーを獲得すると馬を得る、炉でコピーを獲得した場合は得ない）は wiki 記載どおりで正しい。
- 根拠: https://web.archive.org/web/2025/http://wiki.dominionstrategy.com/index.php/Disciple — Other language versions 表の Japanese 行に「門下生 (pron. monkasei)」／ruling 本文の裏取りは https://web.archive.org/web/20250115144137/https://wiki.dominionstrategy.com/index.php/Livery 「If you gain a copy of Livery with either Disciple or Specialist, you will gain a Horse. But if you gain a copy of Livery with Kiln, you won't gain a Horse...」

### [low] sleigh — rulings（kingdom3）

- **誤**: リアクションでの「捨て札にする」はクリンナップ以外の捨て札なので、トンネルや村有緑地の誘発条件を満たしうる（そり自身は誘発しない）。
- **正**: 誤り。そりのリアクションで捨てるのは **そり自身1枚だけ** であり、トンネル／村有緑地はいずれも「**これを**クリンナップ以外で捨て札にしたとき」という自己参照トリガーなので、そりを捨てても両者は一切誘発しない。「クリンナップ以外の捨て札である」ことは事実だが、そこからトンネル／村有緑地が誘発しうるという帰結は成立しない。
- 根拠: http://wiki.dominionstrategy.com/index.php/Sleigh のOfficial FAQ／Other rules clarifications 全文にトンネル・村有緑地への言及は無い（ページ内の Village Green の出現はナビゲーションボックスのみ）。トリガー文言の自己参照は http://wiki.dominionstrategy.com/index.php/Village_Green 「When you discard this other than during Clean-up, you may play it.」で確認。なお追放マットからの捨て札が両者を誘発する旨は http://wiki.dominionstrategy.com/index.php/Exile に "Discarding a card from your Exile mat is discarding a card; if it happens other than in Clean-up, it can trigger Tunnel (from Hinterlands) or Village Green." とあるが、これは *トンネル／村有緑地自身* が捨てられる場合の話であり、そりの捨て札とは無関係。

### [low] sheepdog — rulings（kingdom3）

- **誤**: 複数プレイヤーが同時に反応するときは手番順（手番プレイヤーから）に1つずつ解決し、1つ解決するたびに先頭から再確認する。
- **正**: 牧羊犬には適用されない記述。牧羊犬のトリガーは「**あなたが**カードを獲得したとき」＝獲得した本人だけが反応でき、複数プレイヤーが同一トリガーに同時反応する状況は発生しない（ドミニオンの獲得は常に逐次）。この「手番順に1つずつ」ルールはアタック（堀など）に対する反応の共通則であり、牧羊犬のルーリングとして載せると実装側で不要な多人数反応キューを作る誤誘導になる。牧羊犬で実際に必要なのは「同一の獲得に対し、本人が手札の牧羊犬を尽きるまで連鎖プレイできる」という点（これは別項で正しく記載済み）。
- 根拠: http://wiki.dominionstrategy.com/index.php/Sheepdog カードテキスト逐語: "+2 Cards ／(区切り線)／ When you gain a card, you may play this from your hand."（主語は獲得した本人）。同ページ Official FAQ も反応主体は常に獲得者本人: "You can use this when gaining a card due to buying it, ... and even when gaining a card on another player's turn, such as due to Black Cat." ／ 同ページ本文 "Playing it means you put it into play and get your +2 Cards; it will be discarded in that turn's Clean-up, even if it's not yours. Using the Reaction part doesn't use up an Action"。複数プレイヤー同時反応への言及は同ページに一切無い。

### [low] wayfarer — jp_text（kingdom3）

- **誤**: このカードのコストは、このターンに獲得された直前の他のカード1枚と同じになる（そのようなカードがない場合はコスト6コイン）。
- **正**: 「（そのようなカードがない場合はコスト6コイン）」は実際のカードに印刷されていない補足。英語原文は "This has the same cost as the last other card gained this turn, if any." で、対応する日本語は「〜と同じになる。」まで（"if any" は「そのようなカードがあれば」の含意で、基本コスト$6 はコスト欄の「6*」表記が担う）。内容自体は正しいが、カード面テキストとして webp に焼く場合は原文に無い文が1文増える。
- 根拠: http://wiki.dominionstrategy.com/index.php/Wayfarer の infobox「Card text」逐語: "+3 Cards ／ You may gain a Silver. ／(区切り線)／ This has the same cost as the last other card gained this turn, if any." ／ 同 infobox「Cost」は "{$6*}"（＝基本$6はコスト欄のアスタリスク表記で表現され、テキスト側には書かれていない）。English versions 表でも 2020年版・2025年版とも同一テキストで、括弧補足は存在しない。

### [low] enhance — rulings（event1）

- **誤**: 「勝利点と他の種別を兼ねるカード（例＝ハーレム/農場・貴族・略奪品）は廃棄できない。」
- **正**: 略奪品（Spoils・暗黒時代）は**財宝カードのみで勝利点種別を持たない**（$0*・非サプライ）。増大で普通に廃棄でき、コスト$2以下のカードを獲得できる。例示として誤り（実装で除外リストに入れると本物のバグになる）。ハーレム/農場・貴族は正しい例。
- 根拠: https://wikiwiki.jp/dominiondeck/%E7%95%A5%E5%A5%AA%E5%93%81 「Dark Ages / Spoils / 0* / Treasure / 3 Coins … (このカードはサプライには置かない。)」＝種別は Treasure のみ

### [low] demand — rulings（event1）

- **誤**: 「駿馬（Destrier）のように…」＝Destrier の日本語名を「駿馬」と表記
- **正**: Destrier の日本語版カード名は「**デストリエ**」（移動動物園）。「駿馬」というカードは存在しない。
- 根拠: https://dominionstrategy.miraheze.org/wiki/Module:Destrier lang.jp = "デストリエ"（text.jp = 「＋２ カードを引く／＋１ アクション／ターン中、このカードのコストはそのターンにターンプレイヤーが獲得したカード1枚につき[1]下がる。」）。wikiwiki.jp でも「駿馬」ページは存在せず「デストリエ」ページが存在する。

### [low] transport — rulings（event2）

- **誤**: 「追放するカード自身がアクションであればよく、山全体がアクションの山である必要はない（公式FAQ）」だけで、対象範囲の制限に言及なし
- **正**: 実装必須のルールが欠落＝輸送の『サプライからアクションカード1枚を追放する』も各サプライ山の一番上のカードしか対象にできない（上段が残っている分割山の下段、騎士/廃墟/城の山の2枚目以降は不可）。投資と同じ制約。
- 根拠: http://wiki.dominionstrategy.com/index.php/Supply 『only the top card of any pile is considered to be "in the Supply"』／http://wiki.dominionstrategy.com/index.php/Transport 公式FAQは『It only matters if the card is an Action, not if the whole pile is.』のみで、上限は Supply の一般ルールで決まる

### [low] stampede — rulings（event2）

- **誤**: 「財宝を出さずに購入できると条件を満たしやすい（財源・村人などの仮想コイン、または元々のコイン）。」
- **正**: 村人（Villagers）は仮想コインではない。村人はアクションフェイズに1個＝+1アクションとして使うものでコインを生まない（暴走の$5には使えない）。仮想コインは財源（Coffers）。
- 根拠: http://wiki.dominionstrategy.com/index.php/Villager 『Villagers are the supply of tokens a player has on their Villagers mat, which can be spent during their Action phase for +1 Action each.』

### [low] way_of_the_chameleon — rulings（way1）

- **誤**: エンチャントレス／追い剥ぎ（Highwayman）はカードの指示自体を上書きするので、カメレオンの習性は機能しない（指示に従うことが前提のため）。
- **正**: 正しくは「カメレオンの習性は上書き後の効果を止めることもできないし、上書きで得るものに適用もされない」。公式 clarification："Enchantress, Highwayman, and Enlightenment can change what a card does; using Way of the Chameleon does not stop the new effect, or apply to what you get from it. For example, if you play a Smithy using Way of the Chameleon but it is affected by Enchantress, you get +1 Card and +1 Action." ＝(a) 習性を選ぶこと自体は可能で、選んでもアタックを回避できない（rulebook「If you are affected by Enchantress, you can use a Way instead of…」）、(b) エンチャントレスの +1カード は +1コイン に変換されない。「機能しない」という書き方だと (a) を「習性を選べない」と実装しかねない。またAllies の Enlightenment が列挙から漏れている（本プロジェクト未実装なので実害は無いが網羅性の欠落）。
- 根拠: https://web.archive.org/web/20251214id_/http://wiki.dominionstrategy.com/index.php/Way_of_the_Chameleon （Other rules clarifications の該当行を逐語確認）／13-menagerie-rulebook.pdf p.3「Enchantress from Empires also changes what an Action card does when played. If you are affected by Enchantress, you can use a Way instead of getting the +1 Card and +1 Action that Enchantress's effect would give you.」（pdftotextで逐語確認）

### [low] way_of_the_chameleon — rulings（way1）

- **誤**: 選択肢のあるカード（重臣など）は記載順にボーナスを得る。
- **正**: この裁定は一次資料に存在しない（削除するか、実在する裁定に置き換えるべき）。RGG公式ルールブック(2020)のカメレオン項・英語wikiのOfficial FAQ・Other rules clarifications・日本語wikiのいずれにも該当記述なし。「順序」に言及した公式 clarification が在るのは サルの習性（+1購入が先、次に+$1）と ラバの習性（+1アクションが先、次に+$1）であり、カメレオンではない。選択肢カードについて実在するのは総督の例＝"the first option of Governor under Way of the Chameleon gives the other players +1 Card and you +$3"（＝他プレイヤー分は変換されない）で、これは既に別項目として報告に入っている。
- 根拠: https://web.archive.org/web/20251214id_/http://wiki.dominionstrategy.com/index.php/Way_of_the_Chameleon （Official FAQ 4項＋Other rules clarifications 9項を全文取得し該当なしを確認）／http://dominionleague.org/img/uploads/13-menagerie-rulebook.pdf p.13 Way of the Chameleon 項（pdftotext -layout で全文確認・該当なし）／https://wikiwiki.jp/dominiondeck/カメレオンの習性 （該当なし）

### [low] way_of_the_owl — rulings（way2）

- **誤**: 「日本語版の公式カード文は『手札が6枚になるようにカードを引く。』。本プロジェクトでは同義の既存表現（物見やぐらの『手札が6枚になるまで引く。』）に合わせた。」
- **正**: 日本語版の公式カード文は「手札が6枚になるまでカードを引く。」（"ように"ではなく"まで"）。物見やぐら(望楼)の公式日本語文も「手札が6枚になるまでカードを引く。」で完全に同一表現であり、「同義の別表現に言い換えた」という前提自体が誤り。jp_text の値『手札が6枚になるまで引く。』自体は正しく、js/cards.js の watchtower のカタログ文とも一致するため、修正が必要なのは注記の文言のみ。
- 根拠: https://wikiwiki.jp/dominiondeck/%E3%83%95%E3%82%AF%E3%83%AD%E3%82%A6%E3%81%AE%E7%BF%92%E6%80%A7 （効果欄＝「手札が6枚になるまでカードを引く。」）／比較 https://wikiwiki.jp/dominiondeck/%E6%9C%9B%E6%A5%BC （望楼の効果欄＝「手札が6枚になるまでカードを引く。」）

### [low] horse — rulings（nonsupply）

- **誤**: 【場に動かさずに使用させる効果】死霊術師など、カードを場に動かさずに使用させる効果で馬が使用された場合、stop-moving rule により「山に戻す」は失敗する（+2 カード +1 アクションは得る）。
- **正**: 内容自体は正しいが、例が本プロジェクトで到達しないカード（死霊術師＝夜想曲・未実装、しかも廃棄置き場の馬が前提）に限定されている。実際に踏むのは (a) 王子(prince・実装済み)＝『コスト4以下の非持続アクションを脇に置き、毎ターン脇に置いたまま使用』→ 馬は毎ターン +2カード+1アクションを出し続け、山へは永久に戻らない（＝実質無限ドロー機関。mix-all で移動動物園×プロモが同居すれば到達）。(b) ネズミの習性(Way of the Mouse)＝脇に置いた札を脇のまま使用（ルールブック明記『The set-aside card cannot move itself when played, since it is not in play』）。船長/大君主/はみだし者はサプライからしか使用しないので馬は対象外。
- 根拠: RGG公式ルールブック Way of the Mouse節『you play the set-aside card, leaving it set-aside … The set-aside card cannot move itself when played, since it is not in play』／Prince の裁定（脇に置いた札が自身を動かそうとすると失敗し、移動を条件とするボーナスは得られない）: https://dominionstrategy.fandom.com/wiki/Prince

### [low] horse — rulings（nonsupply）

- **誤**: 【セットアップ】…馬を使うのは王国カード8種（そり／配給品／がらくた／騎兵隊／馬丁／旅籠／貸し馬屋／パドック）とイベント4種（乗馬／特価品／要求／暴走）の計12種。うち旅籠だけは「使用時」ではなく「獲得したとき」に馬を得る。
- **正**: 12種の顔ぶれは正しい（wiki の Interactions と完全一致）が、最後の一文が不正確。旅籠(Hostelry)＝自身の獲得時トリガーである点は正しい一方、貸し馬屋(Livery)は『+$3。このターン、コスト4以上のカードを獲得するたび馬1枚を獲得』＝使用時に馬は出ず、その後の“他のカードの獲得”のたびに馬が出る（場に在る間の継続トリガー・累積する）。また特価品(Bargain)の馬は購入者ではなく他の各プレイヤーが獲得する（手番順・拒否不可）。実装時はこの3類型（使用時／自身の獲得時／場に在る間の獲得トリガー／相手が獲得）を分けること。
- 根拠: RGG公式ルールブック Livery節『This is cumulative; for example, if you use Mastermind to play a Livery three times, then each card you gain that turn costing $4 or more will come with three Horses. Livery works on cards gained via buying them, and cards gained other ways.』／Bargain節『The other players gain their Horses in turn order. They cannot decline to gain one.』／12種の一覧: https://dominioncg.fandom.com/wiki/Horse?action=raw の Interactions

### [low] alliance — jp_name / 名前衝突の説明（機構）

- **誤**: Alliance（同盟）は略奪の同盟(Alliance)と日本語名が衝突する（英語では Menagerie がイベント、Allies が同名の別カード）。id を分ける必要がある。
- **正**: 『略奪(Plunder)』にも『同盟(Allies)』にも Alliance という名前のカードは存在しない。Dominion 全体で Alliance は移動動物園のイベント1枚だけ。衝突するのは『拡張名としての 同盟＝Allies』であってカード名同士の衝突ではない。また 略奪＝Plunder（特性 Trait と戦利品 Loot の拡張）で Allies ではない（本文書自身が別箇所で『略奪の特性 Trait』と正しく書いており自己矛盾）。id を分ける必要は実際には無い。
- 根拠: ① https://dominionstrategy.fandom.com/wiki/Alliance ＝ "Gain a Province, a Duchy, an Estate, a Gold, a Silver, and a Copper."（Menagerie のイベント$10）。② Fandom 全文検索 api.php?action=query&list=search&srsearch=Alliance の結果に Alliance ページは1件のみ（曖昧さ回避ページも同名別カードも存在しない）。③ 日本語ウィキのカードリスト見出しが「… ルネサンス 移動動物園 同盟 略奪 旭日 …」＝同盟=Allies／略奪=Plunder（https://wikiwiki.jp/dominiondeck/移動動物園（拡張））。

### [low] duration_2025_rule — rulings / 判定タイミング（機構）

- **誤**: 持続カードが場を離れた場合、その持続効果はターン終了時にすべて失われる。（かつ open_questions で『英語原文未取得・クリンナップの前か後かで差が出る可能性』と留保）
- **正**: 英語の公式表現は取得できた："If a Duration card leaves play somehow, it stops doing things on future turns."（＋再使用元カードについて "and that effect also ends if that card somehow leaves play."）。より厳密な条件は『持続カードがターン終了時に場にない → 使用時効果はターン終了時にすべて失われる』で、判定条件は「離れた瞬間」ではなく「**ターン終了時点で場に無いこと**」。したがって実装のチェックポイントはクリンナップ（本エンジンなら cleanupAndAdvance）1点でよい。文書の『場を離れた場合』という書き方だと離脱の瞬間に delayedEffects を破棄する実装になりかねない。
- 根拠: ① 英語一次（Dominion Online が採用する公式エラッタ一覧・2026-06-11 更新）http://dominionleague.org/resources の "New errata → Duration rules" 逐語："Duration cards are not discarded in Clean-up if they have something left to do on a future turn; they stay in play until the Clean-up of the last turn that they do something. If a Duration card leaves play somehow, it stops doing things on future turns. Additionally, if a Duration card is played extra times by a card such as Mastermind, that card also stays in play until the Duration card is discarded, to track the fact that the Duration card was played extra times; and that effect also ends if that card somehow leaves play." ② https://wikiwiki.jp/dominiondeck/英語版移動動物園（拡張）改版に伴う2025年2月エラッタ 「持続に関するルール変更」逐語：「持続カードがターン終了時に場にない →使用時効果はターン終了時にすべて失われる」。→ 文書の open_questions 第3項はこれで解決。

### [low] gamble — rulings / パトロンへの影響（機構）

- **誤**: Gamble のエラッタ（公開→捨て札）により、捨て札時リアクション（坑道・村有緑地）が誘発し、パトロン(Patron)の『公開』も誘発しなくなる。
- **正**: 坑道・村有緑地が誘発するようになる点は正しいが、『パトロンが誘発しなくなる』は誤り＝**このエラッタ以前からパトロンは博打では誘発しない**。パトロンは別のエラッタで既に「**アクションフェイズ中に**『公開』されたとき +1財源」に限定されており、博打は購入フェイズに買うイベントなので元々条件を満たさない。（なお本プロジェクトのパトロン実装は PROGRESS §0-22 のとおりアクションフェイズ限定で既に正しい。）
- 根拠: ① パトロンの現行テキスト（公式エラッタ一覧）http://dominionleague.org/resources 逐語："Patron : Action - Reaction, $4 (Dominion: Renaissance) / +1 Villager / +$2 / –––– / When something causes you to reveal this (using the word “reveal”) in an Action phase, +1 Coffers." ② イベントは購入フェイズに買う（RGG公式ルールブックPDF Events 節："In your Buy phase, when you can buy a card, you can buy an Event instead."）。③ 日本語ウィキのエラッタページコメント欄でも同じ訂正：「パトロンのリアクションは発動しなくなった」→「これより前のエラッタで、既にパトロンはリアクションできなくなってますよ」（https://wikiwiki.jp/dominiondeck/英語版移動動物園（拡張）改版に伴う2025年2月エラッタ）。

### [low] cavalry — en_text（機構）

- **誤**: Cavalry（騎兵隊・$4）：`When you gain this, +2 Cards, +1 Buy, and if it's your Buy phase return to your Action phase.`（獲得時効果のみを記載）
- **正**: 使用時効果『Gain 2 Horses.（馬2枚を獲得）』が抜けている。全文＝"Gain 2 Horses. / When you gain this, +2 Cards, +1 Buy, and if it's your Buy phase return to your Action phase."
- 根拠: https://dominionstrategy.fandom.com/wiki/Cavalry 逐語："Gain 2 Horses. When you gain this, +2 Cards, +1 Buy, and if it's your Buy phase return to your Action phase." ／ 日本語ウィキ一覧：「騎兵隊 | 4 | アクション | 馬2枚を獲得/獲得時、+2ドロー+1購入、現在自分の購入フェイズならアクションフェイズに戻る」（https://wikiwiki.jp/dominiondeck/移動動物園（拡張））

### [low] way_of_the_mouse — jp_name（機構）

- **誤**: （Ways の edge_cases）「ルールブックの街道の例は初版基準なので注意（**浮浪児 Peasant** などは今も仕切り線下のまま）」
- **正**: Peasant の日本語公式名は『農民』。『浮浪児』は暗黒時代の Urchin。英語ウィキの街道脚注が挙げている対比カードは Peasant（農民）で、指摘内容自体（Hinterlands 2版で街道のコスト減が仕切り線下でなくなった）は正しいが日英の対応が入れ替わっている。本プロジェクトは page/peasant=従者/農民、urchin=浮浪児 を既に実装済みなので、この表記のまま作業すると参照先を取り違える。
- 根拠: 英語ウィキ Way ページの脚注逐語："† The text of Highway was changed in the second edition of Hinterlands, so its cost-reduction ability is no longer below a dividing line and therefore this rule no longer applies to it. However, other cards that still have text below dividing lines, such as **Peasant**, still work as described in this rule."（https://dominionstrategy.fandom.com/wiki/Way）。本プロジェクトの用語は PROGRESS §0-9（page/peasant）と §0-8（浮浪児urchin）で確立済み。

### [low] reap_gamble — en_text / エラッタ前テキスト（機構）

- **誤**: Reap 変更前＝"Gain a Gold. Set it aside. At the start of your next turn, play it." ／ Gamble 変更前＝"...If it's an Action or Treasure, you may play it. Otherwise, discard it."
- **正**: Reap 変更前の正確な原文は "Gain a Gold. Set it aside. **If you do,** at the start of your next turn, play it."（"If you do," が抜けている）。Gamble 変更前は "If it's a **Treasure or Action**, you may play it. Otherwise, discard it."（語順が逆）。変更後テキストは両方とも文書のとおりで正しい。
- 根拠: ① RGG公式ルールブックPDF（2020版）のカード画像逐語：Reap＝"Gain a Gold. Set it aside. If you do, at the start of your next turn, play it." ／ Gamble＝"+1 Buy / Reveal the top card of your deck. If it's a Treasure or Action, you may play it. Otherwise, discard it."（https://www.riograndegames.com/wp-content/uploads/2020/01/Dominion-Menagerie-Rules.pdf）。② 日本語ウィキエラッタ表の英語原文欄も同一（https://wikiwiki.jp/dominiondeck/英語版移動動物園（拡張）改版に伴う2025年2月エラッタ）。

### [low] seize_the_day — rulings（機構）

- **誤**: Seize the Day＝1ゲーム1回・追加ターンは同点決勝に数えない・前哨地の追加ターン中に買って3ターン目を取れる。（scoreGame のタイブレークに例外を入れる、とだけ記載）
- **正**: 記載内容はすべて正しいが、実装に直結する裁定が1つ抜けている：**ゲーム終了条件のチェックは追加ターンを得るより前に行われ、終了条件を満たしていると追加ターンは得られない**（艦隊 Fleet がある場合はさらに『全艦隊購入者が追加ターンを終えたか』で判定）。つまり最後の属州を買った同じターンに今を生きるを買っても追加ターンにはならない。
- 根拠: https://wikiwiki.jp/dominiondeck/今を生きる 詳細なルール 逐語：「ゲームの終了条件のチェックは追加ターンを得るより前に行う。ゲームの終了条件を満たしていると追加ターンは得られない。」「ゲームの勝敗を決めるとき、追加ターンは経過ターン数に含めない。」――公式FAQ側の裏取りは https://dominionstrategy.fandom.com/wiki/Seize_the_Day の "The extra turn is like a normal turn, except that it does not count for the tiebreaker." / "Unlike Outpost and Mission, Seize the Day doesn't check if the previous turn was another player's. So if you take an extra turn with Outpost, you can buy Seize the Day on the extra turn, and take a 3rd turn."

### [low] horse — rulings / 一般ルール（機構）

- **誤**: 「馬を獲得する」効果だけが馬の山から取れる（Falconer や Displace のような汎用獲得では取れない）。
- **正**: 内容は正しいが、根拠として引くべき現行の**一般ルール**が抜けている："Gaining non-Supply cards: When a card tells you to gain a non-Supply card by name (e.g., "gain a Horse"), or by a pile type (e.g., "gain any Reward"), you can gain it from its pile, even though it's not in the Supply." これは Menagerie 以降に整備された全体ルールで、本プロジェクトの既存の非サプライ山（戦利品/狂人/傭兵/賞品/トラベラー成長先）すべてに同じ述語が使える。判定基準はカード名のハードコードではなく『名前（または山の種別）で指定されたか』にすべき、という設計指針になる。
- 根拠: http://dominionleague.org/resources の "New errata → Gaining non-Supply cards" 逐語："When a card tells you to gain a non-Supply card by name (e.g., “gain a Horse”), or by a pile type (e.g., “gain any Reward”), you can gain it from its pile, even though it's not in the Supply. For example, Marauder can gain Spoils because Marauder uses the words “gain a Spoils”, but Changeling cannot gain an Imp because Changeling does not use the word “Imp” and instead says “gain a copy”." ＋ RGG公式ルールブックPDF Horse 節："This is a non-Supply pile; you can only gain a Horse from it when a card tells you to gain a Horse, not with cards like Falconer or Displace."
