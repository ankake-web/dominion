## FIND [medium] 悲劇のヒーロー：これを廃棄できなかったときに財宝を獲得しない（ネクロマンサー／玉座の2回目で発生）
- file: js/engine.js:5870
- rule: nocturne_rules.md パート4 §9（Tragic Hero）ルールブック逐語："First draw three cards; then, if you have eight or more cards in hand, you trash Tragic Hero and gain a Treasure. **If you cannot trash Tragic Hero (for example if you play it twice with Throne Room and trashed it the first time), you still gain the Treasure.**" ＝「**廃棄は財宝獲得の条件ではない。判定は手札枚数だけ。**」。同節の実装注意も「**【本プロジェクト固有の注意】財宝の獲得は `self` に条件づかない**＝倒壊・死の荷車で使った `pendingSelf` パターンとは逆。**廃棄成否にかかわらず必ず財宝を獲得させること。**」と明記。さらにネクロマンサー項のルールブック逐語が悲劇のヒーローを名指し："if the card does not check (such as Tragic Hero), it will function normally."
- actual: applyEffect の case 'tragic_hero'（js/engine.js:5870-5879）が、財宝獲得の pending を takeSelf の成功ブロックの内側に置いている：
```js
if (p.hand.length >= 8) {
  if (takeSelf(state, pi, 'tragic_hero')) {      // ← 場に無ければ false
    trashCard(state, pi, 'tragic_hero');
    if (anyGainable(...)) state.pending = { type: 'tragic_hero_gain', player: pi };
  }
}
```
ネクロマンサー（廃棄置き場に置いたまま使用）や命令カード経由・幽霊の2回目では takeSelf が失敗するため、手札8枚以上でも `tragic_hero_gain` が一切開かず、財宝を1枚まるごと取り逃す。
- repro: test/nocturne.test.js と同じ vm ハーネスで:
```js
const s = mk(king(['tragic_hero','necromancer']));
s.trash.push('tragic_hero');                     // 一度使って廃棄された状態
s.players[0].hand = ['necromancer','copper','copper','copper','copper','copper'];
s.players[0].deck = ['estate','estate','estate'];
s.turn.actions = 1;
let t = reduce(s, {type:'PLAY_ACTION', card:'necromancer'});
t = reduce(t, {type:'NECROMANCER_PLAY', index: t.trash.indexOf('tragic_hero')});
console.log(t.players[0].hand.length, t.pending);
```
実測＝手札8枚・`pending === null`（財宝を獲得できない）。期待＝`pending.type === 'tragic_hero_gain'`。
比較用に手札から普通に使った場合（`p.hand=['tragic_hero',copper×5]`, `deck=[estate×3]`）は手札8枚・`pending.type==='tragic_hero_gain'` になるので、差は「廃棄できたかどうか」だけであることが確認できる。

## FIND [medium] 忠犬：夜警／太陽の恵み（look_arrange）で山札から捨てられたとき「脇に置く」窓が開かない
- file: js/engine.js:14658
- rule: nocturne_rules.md パート3 B-2（Faithful Hound）公式FAQ逐語："Faithful Hound does not have to be in your hand for the ability to work; **for example you can set it aside when it is discarded from your deck due to Night Watchman.**" ／ "The Reaction ability can happen on your turn and on other players' turns" ／ "The ability does not do anything during Clean-up."（＝クリンナップ以外のあらゆる捨て札で誘発する）
- actual: 汎用 reducer `LOOK_ARRANGE_RESOLVE`（js/engine.js:14658）が `triggerOnDiscard(state, pd.player, disc, true)` と **noPrompt=true** で呼んでいる。`triggerOnDiscard`（6802-6833）は noPrompt のとき `faithful_hound_react` / `village_green_react` を積む分岐（6824-6832）を丸ごと飛ばすため、夜警（source:'night_watchman'）でも太陽の恵み（source:'the_suns_gift'）でも忠犬の脇置き窓が一切開かない。忠犬・夜警・太陽の恵みはいずれも夜想曲のカードで、`random-nocturne` で同居し得る。
- repro: ```js
const s = mk(king(['night_watchman','faithful_hound']));
s.players[0].hand = ['night_watchman'];
s.players[0].deck = ['faithful_hound','copper','copper','copper','copper'];
let t = reduce(reduce(s,{type:'END_ACTION_PHASE'}),{type:'END_TURN'}); // 夜フェイズ
t = reduce(t, {type:'PLAY_NIGHT', card:'night_watchman'});
t = reduce(t, {type:'LOOK_ARRANGE_RESOLVE', discard:['faithful_hound'], top:['copper','copper','copper','copper']});
console.log(t.pending, t.onGainQueue, t.players[0].discard, t.players[0].setAside);
```
実測＝`pending=null / onGainQueue=[] / discard=['faithful_hound'] / setAside=[]`（窓が出ない）。期待＝`onGainQueue` に `{type:'faithful_hound_react'}` が積まれ、脇に置ける。
太陽の恵みでも同じ（`s.boons.deck` の先頭を `the_suns_gift` にして bard を使い、`LOOK_ARRANGE_RESOLVE` で忠犬を捨てる）。
※夜襲（RAIDER_DISCARD, 15009行）と ゾンビの密偵（15168行）は noPrompt なしで呼んでいて正しく窓が開くので、look_arrange だけが取り残されている。

## FIND [medium] 迫害者：場にある「他の迫害者」を数えず、2枚目以降でもインプを獲得してしまう
- file: js/engine.js:5677
- rule: nocturne_rules.md パート4 §7（Tormentor）日本語wiki 詳細なルール逐語：「**「迫害者以外のカードが場にあるかどうか」ではなく、「使用されたその迫害者以外のカードが場にあるかどうか」で判定される。同名か否かは関係ない。**」＝迫害者Aでインプを得た後に迫害者Bを使うと、Bにとって A は「他のカード」なので呪詛を撒く。同節の実装注意も「判定＝`p.inPlay`（**今プレイした迫害者自身を除く**）＋ `p.durationCards` が空かどうか。**「同名の迫害者がもう1枚あるか」ではない。**」と明記。
- actual: js/engine.js:5677 が `p.inPlay.filter((c) => c !== 'tormentor').length + (p.durationCards||[]).length` と、**場にあるすべての迫害者**を除外している。今プレイした1枚だけを除くべきところを名前で一括除外しているため、場に迫害者が2枚あっても othersInPlay===0 と判定され、呪詛ではなくインプを獲得する。
- repro: ```js
const s = mk(king(['tormentor','village']));
s.players[0].inPlay = ['tormentor'];   // 1枚目が既に場にある
s.players[0].hand   = ['tormentor'];
s.turn.actions = 1;
const before = s.supply.imp;
const t = reduce(s, {type:'PLAY_ACTION', card:'tormentor'});
console.log(before, '→', t.supply.imp, t.log.slice(-1));
```
実測＝`13 → 12`／log「あなた は迫害者でインプ1枚を獲得した。」。期待＝インプ山は減らず、他プレイヤーが次の呪詛を受ける。
実戦到達路（mix-all）：ルネサンスの村人を前ターンに貯めておく（村人はターンを跨いで残り、場にカードを残さない）→ 迫害者A を使用（場が空＝インプ）→ `SPEND_VILLAGER` で +1アクション → 迫害者B を使用。冒険の教師の山トークン（+1アクション）を迫害者の山に置く経路でも同じ。

## FIND [medium] 羊飼い：捨て札トリガーより先にドローするため、坑道で得た金貨がシャッフルに入らない
- file: js/engine.js:14846
- rule: nocturne_rules.md パート4 §5（Shepherd）英語wiki「Other rules clarifications」逐語："**If drawing causes you to shuffle, you will shuffle in the discarded Victory cards. And if you discard a Tunnel and gain a Gold, the Gold will get shuffled in.**" ／ 同節の実装注意「**順序厳守**：捨て札 → `triggerOnDiscard`（坑道の金貨獲得を含む）を全部解決 → **その後にまとめて `draw(state, pi, 2*n)`**。この順序でないと坑道の金貨がリシャッフルに入らない（＝上の公式裁定に反する）。」
- actual: `SHEPHERD_DISCARD`（js/engine.js:14835-14851）は `discardFromHand(...)` → **`draw(state, pd.player, cards.length*2)`（14846）** → `triggerOnDiscard(...)`（14848）の順。ドローが先なので、捨てた坑道で獲得する金貨は「シャッフル済みの山札」に入らず捨て札に残り、そのぶん引く枚数も1枚少なくなる。
- repro: ```js
const s = mk(king(['shepherd','tunnel']));
s.players[0].hand = ['shepherd','tunnel','estate'];
s.players[0].deck = []; s.players[0].discard = [];
s.turn.actions = 1;
let t = reduce(s, {type:'PLAY_ACTION', card:'shepherd'});
t = reduce(t, {type:'SHEPHERD_DISCARD', cards:['tunnel','estate']});
console.log(t.players[0].hand, t.players[0].deck, t.players[0].discard);
```
実測＝`hand=['estate','tunnel'] / deck=[] / discard=['gold']`（金貨がデッキに入らず、+4カードのうち2枚しか引けていない）。期待＝坑道の金貨を先に獲得 → 捨て札(tunnel/estate/gold)をシャッフルして4枚引く＝手札3枚（tunnel・estate・gold）。
※到達には mix-all（異郷の坑道＋夜想曲の羊飼い）が必要。夜想曲単独では勝利点カードに捨て札トリガーが無いため差は出ない。

## FIND [low] ウィル・オ・ウィスプ：コストの負債成分を見ていないため、負債コストの札を手札に加えてしまう
- file: js/engine.js:5846
- rule: nocturne_rules.md パート6 2-1（Will-o'-Wisp）公式FAQ逐語："Will-o'-wisp: If the revealed card does not cost [$2] or less, leave it on your deck." ／ "**Cards with [P] or [D] in the cost (from Alchemy and Empires) do not cost [$2] or less.**" ／ 日本語wiki逐語「コストに負債やポーションを含むカードは『2コスト以下のカード』には該当しないので、手札に加えられない。」／実装注意「**`DOM.engine.costUpTo(state, id, 2)` を使う**。素の `cardCost <= 2` は**FAQ が明示的に否定している**」
- actual: js/engine.js:5846 が `if (cardCost(state, top) <= 2 && potionCost(top) === 0)` とコイン成分＋ポーションしか見ていない。負債成分（`C()[id].debt`）を見ていないため、技術者（$0+負債4）・市街（$0+負債8）・大君主（$0+負債8）・王室の鍛冶屋（$0+負債8）・元手（$0+負債8）が「$2以下」と判定されて手札に入る。正しくは3成分比較（`costLE(costOf(state, top), {coin:2, pot:0, debt:0})`）。
- repro: ```js
const s = mk(king(['will_o_wisp','engineer']));
s.supply.will_o_wisp = 12;
s.players[0].hand = ['will_o_wisp'];
s.players[0].deck = ['copper','engineer','estate']; // 1枚引いた後の山札の上が engineer
s.turn.actions = 1;
const t = reduce(s, {type:'PLAY_ACTION', card:'will_o_wisp'});
console.log(t.players[0].hand, t.players[0].deck);
```
実測＝`hand=['copper','engineer'] / deck=['estate']`（負債コストの技術者が手札に入る）。期待＝技術者は山札の上に残り `hand=['copper'] / deck=['engineer','estate']`。
※ポーション費用（変成 $0+P）は `potionCost` で正しく弾けていることも同じ手順で確認済み。到達は mix-all（帝国＋夜想曲）。

## FIND [low] 秘密の洞窟：手札が3枚未満のとき「3枚捨てる」を選べない（公式は選べて、残り全部を捨てるがボーナス無し）
- file: js/engine.js:14826
- rule: nocturne_rules.md パート4 §4（Secret Cave）公式裁定逐語（ルールブック＝英語wiki Official FAQ と完全一致）："**You can choose to discard three cards even with fewer cards in hand, and will discard your remaining cards, but will not get the bonus.**" ／ 同節の実装注意「**手札が3枚未満でも「3枚捨てる」を選べる**（engine は拒否しないこと＝人間が詰む）。**実際に捨てた枚数が3未満ならボーナス無し**。UI の文言でこれを明示する。」
- actual: `SECRET_CAVE_DISCARD`（js/engine.js:14826）が `if (cards.length !== 3) return state; // 3枚ちょうど（手札が3枚未満なら捨てられない＝辞退のみ）` と、ちょうど3枚以外を状態不変で拒否する。手札が1〜2枚のときは「捨てない」しか選べず、坑道（金貨獲得）・忠犬（脇置き）・村有緑地（使用）といった捨て札トリガーを狙って手札を捨てる選択肢が失われる。
- repro: ```js
const s = mk(king(['secret_cave','tunnel']));
s.players[0].hand = ['secret_cave','tunnel'];  // 使用後の手札は1枚
s.players[0].deck = [];
s.turn.actions = 1;
let t = reduce(s, {type:'PLAY_ACTION', card:'secret_cave'});
console.log(t.pending.type, t.players[0].hand);      // secret_cave / ['tunnel']
const t2 = reduce(t, {type:'SECRET_CAVE_DISCARD', cards:['tunnel']});
console.log(t2.pending && t2.pending.type, t2.players[0].hand);
```
実測＝`pending='secret_cave' / hand=['tunnel']`（拒否されて何も起きない）。期待＝坑道が捨て札になり（金貨を獲得し）、持続にはならない。

## FIND [low] 家宝に置き換えた銅貨がサプライの銅貨の山に戻らない（山が人数×家宝数だけ少ない）
- file: js/engine.js:624
- rule: nocturne_rules.md パート2 §3（Cemetery）日本語wiki「詳細なルール」逐語：「墓地を使用するゲーム開始時に、初期デッキの銅貨1枚を呪いの鏡に入れ替える。**入れ替えた銅貨は、サプライの山札に戻す。**」（家宝の一般則。パート6 0-2 も「開始デッキの銅貨と置き換わる」と同旨）
- actual: `initSupply`（js/engine.js:624）が `copper: 60 - 7 * numPlayers` と固定。一方 `createInitialState`（738行）は開始デッキに `7 - heirlooms.length` 枚しか銅貨を配らないため、置き換えたぶんの銅貨がどこにも戻らずゲームから消える。夜想曲の固定セット（`DOM.KINGDOM_NOCTURNE`＝ピクシー→ヤギ／墓地→呪いの鏡 の家宝2種）の2人戦だと、銅貨の山は本来 60-5×2=50 のところ 46 になる。
- repro: ```js
const a = E.createInitialState(['a','b'], ['village', ...FILLER].slice(0,10), {startActive:0});
const b = E.createInitialState(['a','b'], DOM.KINGDOM_NOCTURNE.slice(), {startActive:0});
const coppers = (s,i)=>s.players[i].deck.concat(s.players[i].hand).filter(c=>c==='copper').length;
console.log(a.supply.copper, coppers(a,0));  // 46, 7
console.log(b.supply.copper, coppers(b,0));  // 46, 5  ← 期待は 50, 5
```
修正案：`copper: 60 - (7 - heirloomCount) * numPlayers`（家宝数は `DOM.HEIRLOOM_OF` と kingdom の積集合＝createInitialState 側と同じ算出）。

## FIND [low] 人狼（アクションフェイズ）と迫害者（インプを獲得する側）でアタックのリアクション窓が開かない
- file: js/engine.js:5758
- rule: nocturne_rules.md パート4 §11（Werewolf）英語wiki逐語："when you play Werewolf in the Action phase (so it doesn't attack), **it's still an Attack card and activates other players' Diplomats and so on**"／日本語wiki逐語「人狼はアタックカードであり、夜フェイズ以外に使用した場合でも、他プレイヤーは【アタック誘発リアクション】でリアクションすることができる」。同節の実装注意「**アタック窓は「+3カード」側でも開く**。…**効果なしでも窓だけ開く分岐**が要る（堀は無意味だが、番犬/馬商人/そり/村有緑地型のリアクションが誘発する）。**窓はドロー／呪詛公開より前に閉じること。**」／パート4 §7（Tormentor）日本語wiki逐語「**迫害者でインプを獲得する場合でも、他プレイヤーは【アタック誘発リアクション】でリアクションすることができる。**」
- actual: js/engine.js:5758-5760 の case 'werewolf' はアクションフェイズなら `draw(state, pi, 3)` のみで `hexReactEnter` を通らない。同じく case 'tormentor'（5675-5681）は `othersInPlay === 0` のとき `gain(state, pi, 'imp', ...)` のみでリアクション窓を開かない。どちらのケースも「アタックカードを使用したとき」に反応する番犬(guard_dog)／馬商人／物乞い／隊商の護衛の窓が一切開かない。
- repro: ```js
const s = mk(king(['werewolf','guard_dog']));
s.players[0].hand = ['werewolf'];
s.players[0].deck = ['copper','copper','copper'];
s.players[1].hand = ['guard_dog','copper','copper','copper','copper'];
s.turn.actions = 1;
const t = reduce(s, {type:'PLAY_ACTION', card:'werewolf'});
console.log(t.pending);   // 実測 null（番犬の窓が出ない）
```
迫害者側：
```js
const s = mk(king(['tormentor','guard_dog']));
s.players[0].hand = ['tormentor'];
s.players[1].hand = ['guard_dog','copper','copper','copper','copper'];
s.turn.actions = 1;
const t = reduce(s, {type:'PLAY_ACTION', card:'tormentor'});
console.log(t.pending, t.supply.imp);  // 実測 null, 12（窓が出ないままインプ獲得）
```
※夜想曲単独の王国には該当リアクションが無いため、到達は mix-all（移動動物園の番犬／暗黒時代の物乞い／収穫祭の馬商人／冒険の隊商の護衛）。

## FIND [low] 幽霊が持続カードをプレイしても幽霊自身が場に残らず、そのターンの片付けで捨て札になる
- file: js/engine.js:6215
- rule: nocturne_rules.md パート6 2-5（Ghost）公式FAQ（ルールブック逐語）："**If Ghost plays a Duration card, Ghost will stay out with the Duration card.**" ／ 日本語wiki逐語「幽霊の効果で、雇人などの『各ターンの開始時』の効果を持つカードを使用した場合、…（この場合、雇人が場に残り続けるので、**幽霊も場に残り続ける**ので注意）」。同節の実装注意も「**持続を使ったら幽霊も場に残る**＝海辺の `armDuration` の cnt 機構と同じ」と明記。
- actual: 片付けの持続仕分け（js/engine.js:7409-7428）は「`p.delayedEffects` に予約が残っている枚数ぶん」しか durationCards に保持しない。`DURATION_RESOLVERS.ghost`（6215-6219）はターン開始時に幽霊の予約を消費して `ghost_play` を積むだけなので、幽霊自身の予約は残らず、プレイした持続カードだけが場に残って幽霊は捨て札になる。結果、幽霊が「場にあるカード」として数えられない（レプラコーンのちょうど7枚／夜襲の同名カード／迫害者の「他のカード」／魔法のランプの6種類 の判定がずれる）。※玉座の間×持続の既存挙動と同型で、夜想曲固有の新規劣化ではない可能性が高い。
- repro: ```js
const s = mk(king(['ghost','fishing_village']));
s.supply.ghost = 6;
s.players[0].hand = ['ghost'];
s.players[0].deck = ['copper','fishing_village'];
let t = reduce(reduce(s,{type:'END_ACTION_PHASE'}),{type:'END_TURN'});   // 夜フェイズ
t = reduce(t, {type:'PLAY_NIGHT', card:'ghost'});                        // 漁村を脇へ
t = reduce(t, {type:'END_TURN'});                                        // 自分の片付け→相手
t = reduce(reduce(t,{type:'END_ACTION_PHASE'}),{type:'END_TURN'});       // 相手の番を終える
t = reduce(t, {type:'GHOST_PLAY'});                                      // 漁村を2度使用
console.log(t.players[0].inPlay, t.players[0].durationCards);            // ['fishing_village'] / ['ghost']
t = reduce(reduce(t,{type:'END_ACTION_PHASE'}),{type:'END_TURN'});
console.log(t.players[0].durationCards);                                 // 実測 ['fishing_village'] のみ
```
実測＝片付け後の durationCards から ghost が消える。期待＝漁村が場に残る間は ghost も durationCards に残る。

## FIND [medium] 夜フェイズの人狼に習性(Way)を使えない（engine が action.way を黙って捨てる・CPU/UI にも経路が無い）
- file: js/engine.js:8499
- rule: docs/research/nocturne_rules.md §1-2 表 #14：「人狼は**夜フェイズでも習性(Way)を選べる**（アクションカードだから）。**アクション権も消費しない**」／逐語 `wiki:Werewolf`「A unique aspect of Werewolf is that it can be played with a **Way even during the Night phase, which does not cost an Action**」。§1-4「実装注意」5：「**人狼は `PLAY_ACTION` と `PLAY_NIGHT` の両入口を持つ**。効果は `turn.phase === 'night'` で分岐。**習性(`action.way`)は両方の入口で受け付ける**（#14）」
- actual: `case 'PLAY_NIGHT'`（js/engine.js:8499-8525）は `action.way` を一切読まない。直前のコメント（js/engine.js:8498）は「習性（Way）は「アクションカードを使用するとき」なので夜行カードには使えない＝ここでは選ばせない」と、正本と逆の規則を断定して書いている（＝「許容簡略化」の明記ではなく規則の誤記）。UI の夜フェイズのタップ経路（js/ui.js:1573-1575）も `PLAY_NIGHT` 一択で習性ボタンを出さない（アクションフェイズの js/ui.js:1563-1570 は出す）。CPU（js/cpu.js:3083）も `way` を付けない。結果、`{type:'PLAY_NIGHT', card:'werewolf', way:'way_of_the_otter'}` を送ると習性が無視され、記載効果（呪詛の配布）が実行される。mix-all（`mix:menagerie,nocturne:2:way-menagerie`）で到達可能。
- repro: const fs=require('fs'),path=require('path'),vm=require('vm');const R='c:/Users/b1242/claude/game/dominion';
const sb={window:{},Math,JSON,console};vm.createContext(sb);
['js/cards.js','js/engine.js','js/cpu.js'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(R,f),'utf8'),sb,{filename:f}));
const DOM=sb.window.DOM,E=DOM.engine,red=(s,a)=>E.reduce(s,a);
const K=c=>c.concat(['village','smithy','market','militia','cellar','workshop','laboratory','festival','mine','moat']).slice(0,10);
function mk(k,o){const s=E.createInitialState(['A','B'],k.slice(),Object.assign({startActive:0},o||{}));s.players.forEach(p=>{p.hand=[];p.deck=[];p.discard=[];p.inPlay=[];});return s;}
const s=mk(K(['werewolf']),{ways:['way_of_the_otter']});s.ways=['way_of_the_otter'];
s.players[0].hand=['werewolf'];s.players[0].deck=['copper','copper','silver','gold'];s.players[1].hand=['copper','copper'];
let t=red(red(s,{type:'END_ACTION_PHASE'}),{type:'END_TURN'});           // phase='night'
t=red(t,{type:'PLAY_NIGHT',card:'werewolf',way:'way_of_the_otter'});
console.log('手札',t.players[0].hand.length,'呪詛めくり',t.hexes.discard.length,t.log.slice(-2));
// 期待: 手札 2（カワウソの習性＝+2カード）・呪詛めくり 0
// 実際: 手札 0・呪詛めくり 1（"B は呪詛「幻惑」を受けた。"）＝習性が完全に無視された

## FIND [medium] 夜フェイズの人狼で御料車(royal_carriage)/法貨の呼び出し窓が開かない（正本が明示的に要求している唯一の夜行×玉座系経路が欠落）
- file: js/engine.js:8499
- rule: docs/research/nocturne_rules.md §1-4「実装注意」6：「**御料車(royal_carriage)の「アクション解決直後フック」（§0-9 Batch4b の `t.afterActionCard`）は夜フェイズの人狼でも立てること**（唯一の夜行×玉座系の合法経路）。**それ以外の夜行カードでは立てない**。」／§1-2 表 #7「唯一の例外＝**御料車(Royal Carriage)を人狼に対して呼ぶ**」／§11 逐語「And when you play it in the Night phase, **it's still an Action card, so you can call Royal Carriage to repeat the Hexing**, for example.」
- actual: `case 'PLAY_NIGHT'`（js/engine.js:8499-8525）は `t.afterActionCard = ncard` を設定しない（`PLAY_ACTION` は js/engine.js:8465 で設定している）。さらに reduce 末尾の呼び出し窓（js/engine.js:8300）が `state.turn.phase === 'action'` でゲートされているため、仮に立てても夜フェイズでは開かない。結果、酒場マットに御料車があっても夜フェイズの人狼を再演できず、呪詛を2回配れない。法貨(coin_of_the_realm)の +2アクション も同様に呼べない（こちらは実害小）。mix-all（`mix:adventures,nocturne`）で到達可能。
- repro: // 上と同じ preamble
const s=mk(K(['werewolf','royal_carriage']));
s.players[0].hand=['werewolf'];s.players[0].tavern=['royal_carriage'];s.players[1].hand=['copper','copper','copper'];
let t=red(red(s,{type:'END_ACTION_PHASE'}),{type:'END_TURN'});   // phase='night'
t=red(t,{type:'PLAY_NIGHT',card:'werewolf'});
console.log('night:',JSON.stringify(t.pending),t.turn.afterActionCard);
// 期待: {"type":"after_action","player":0,"card":"werewolf"}
// 実際: null / null
// 対照（アクションフェイズなら開く）:
const s2=mk(K(['werewolf','royal_carriage']));
s2.players[0].hand=['werewolf'];s2.players[0].tavern=['royal_carriage'];s2.players[1].hand=['copper'];
console.log('action:',JSON.stringify(red(s2,{type:'PLAY_ACTION',card:'werewolf'}).pending));
// → {"type":"after_action","player":0,"card":"werewolf"}

## FIND [medium] 女魔術師(enchantress・帝国)の置換が夜フェイズの人狼に適用されない＝相手のアタックが空振りする
- file: js/engine.js:8499
- rule: docs/research/nocturne_rules.md §11「Werewolf / 人狼」公式裁定（日wiki 詳細なルール）：「**女魔術師の置換は夜フェイズの人狼にも適用される**（そのターン最初のアクションカードなら +1カード+1アクションになる）」。女魔術師の公式文＝「次のあなたのターンまで、他のプレイヤーがそのターン最初にプレイしたアクションカードは、記載された効果の代わりに +1カード +1アクション」
- actual: `me.enchanted` の消費は `PLAY_ACTION`（js/engine.js:8473-8483）にしか無く、`PLAY_NIGHT`（js/engine.js:8499-8525）は `enchanted` を見ない。そのため女魔術師を受けたプレイヤーがそのターン1枚もアクションを使わずに夜フェイズで人狼を使うと、置換されずに呪詛が配られ、しかも `p.enchanted` は true のまま残る（そのターン終了時に消える）。＝帝国の女魔術師が夜想曲の人狼に対して完全に無効。mix-all（`mix:empires,nocturne`）で到達可能。
- repro: // 上と同じ preamble
const s=mk(K(['werewolf','enchantress']));
s.players[0].hand=['werewolf'];s.players[0].deck=['silver','silver'];
s.players[0].enchanted=true;                       // 相手の女魔術師を受けている
s.players[1].hand=['copper','copper'];
let t=red(red(s,{type:'END_ACTION_PHASE'}),{type:'END_TURN'});   // phase='night'
t=red(t,{type:'PLAY_NIGHT',card:'werewolf'});
console.log(t.players[0].hand.length, t.players[0].enchanted, t.hexes.discard.length, t.players[1].deluded);
// 期待: 手札1（+1カード）／enchanted=false／呪詛めくり0
// 実際: 手札0 / enchanted=true / 呪詛めくり1 / 相手が錯乱を取る
// 対照（アクションフェイズなら置換される）:
const s2=mk(K(['werewolf','enchantress']));s2.players[0].hand=['werewolf'];s2.players[0].deck=['silver','silver'];s2.players[0].enchanted=true;
console.log(red(s2,{type:'PLAY_ACTION',card:'werewolf'}).log.slice(-1)); // → 「A は女魔術師の効果で 記載効果の代わりに +1カード +1アクション。」

## FIND [medium] アクションフェイズで人狼を使ってもアタック誘発リアクションの窓が開かない（番犬/隊商の護衛/物乞い/馬商人/外交官が使えない）
- file: js/engine.js:5758
- rule: docs/research/nocturne_rules.md §11「Werewolf / 人狼」：「**アタック窓は「+3カード」側でも開く**（『人狼はアタックカードであり、夜フェイズ以外に使用した場合でも、他プレイヤーは【アタック誘発リアクション】でリアクションすることができる。この場合も、人狼使用者が**カードを引いた後はリアクションできない**』）」／英語wiki 逐語「when you play Werewolf in the Action phase (so it doesn't attack), **it's still an Attack card and activates other players' Diplomats and so on**」。§1-2 表 #15 も「複合種別は文脈を問わず全種別を保持する」
- actual: `case 'werewolf'`（js/engine.js:5758-5761）は `t.phase === 'night'` なら `startHexAttack`、そうでなければ `draw(state, pi, 3)` を実行するだけで、非夜フェイズ側では被害者のリアクション窓（`hasReaction` → `*EnterVictim` 相当）を一切開かない。そのため相手が手札に番犬・隊商の護衛・物乞い・馬商人・外交官を持っていても「他プレイヤーがアタックカードを使ったとき」の恩恵を得られない。これらはすべて既存拡張（異郷/冒険/暗黒時代/収穫祭/陰謀）のカードで、夜想曲単独セット（`nocturne`）でも人狼＋堀等が同居し得る。
- repro: // 上と同じ preamble
const s=mk(K(['werewolf','guard_dog']));
s.players[0].hand=['werewolf'];s.players[0].deck=['silver','silver','silver','gold'];
s.players[1].hand=['guard_dog','moat','copper','copper','copper'];
s.players[1].deck=['silver','silver','silver','silver'];
const t=red(s,{type:'PLAY_ACTION',card:'werewolf'});
console.log(JSON.stringify(t.pending), '相手の手札', t.players[1].hand.length);
// 期待: 相手に「アタックを受ける（番犬を先に使う/堀を公開する）」窓が開く
// 実際: pending=null・相手の手札は5枚のまま＝窓が一度も開かない

## FIND [medium] 片付け開始時の効果（増築）が「手札に夜行カードがあるか」で turn.phase='buy'/'night' に分岐し、公会堂・列柱・徴税・行商人のコスト・石の銀貨先が変わる
- file: js/engine.js:8060
- rule: docs/research/nocturne_rules.md §1-2 表 #1「フェイズ順＝**アクション → 購入 → 夜 → クリンナップ**」（＝クリンナップは購入フェイズではない）。§1-4「実装注意」1：「**既存の `phase === 'buy'` 判定を全部洗い出し、夜フェイズを購入フェイズと誤認させないこと**…公会堂(basilica)・列柱(colonnade)・汚された神殿(defiled_shrine)／徴税(tax の `gainWasBuyPhase`)…**行商人 peddler のコスト**」
- actual: `maybeEnterNight`（js/engine.js:8060-8068）は手札に夜行カードがあるときだけ `turn.phase='night'` にする。夜行カードが無いと `phase` は `'buy'` のまま `endBuyTailBaths`→`endBuyTailSchemeOrCleanup`（js/engine.js:8140）へ進み、**片付け開始時の増築(improve)の獲得が「購入フェイズ中の獲得」として処理される**。`gainWasBuyPhase`（js/engine.js:6356）が true になるため公会堂（js/engine.js:6738）・列柱・汚された神殿・徴税の負債受け取りが誤って発火し、`cardCost` の行商人分岐（js/engine.js:186）も購入フェイズ扱いで安くなる（石の銀貨先も deck/hand が入れ替わる）。夜行カードを1枚持っているだけで結果が変わる＝同一局面が「無関係な条件」で分岐する。※正しいのは night 側（クリンナップは購入フェイズではない）で、buy 側が公式に反する。mix-all（`mix:nocturne,renaissance,empires,prosperity:1:lm-empires`）で到達可能。
- repro: // 上と同じ preamble
function run(withNight){
  const s=mk(K(['improve','peddler','guardian','village']));
  s.landmarks=['basilica']; s.landmarkVP={basilica:12};
  s.players[0].hand = withNight?['guardian']:[];
  s.players[0].inPlay=['improve','village','village','village'];
  s.turn.improvePlays=1;
  let t=red(s,{type:'END_ACTION_PHASE'}); t.turn.coins=5;
  t=red(t,{type:'END_TURN'});
  if(withNight) t=red(t,{type:'END_TURN'});          // 夜フェイズを抜ける
  console.log('withNight='+withNight,'phase='+t.turn.phase,'pending='+(t.pending&&t.pending.type),'peddlerCost='+E.cardCost(t,'peddler'));
  t=red(t,{type:'IMPROVE_TRASH',card:'village'});
  t=red(t,{type:'IMPROVE_GAIN',card:'militia'});
  console.log('   公会堂VP=',t.players[0].vpTokens);
}
run(false); run(true);
// 実測: withNight=false → phase='buy' / peddlerCost=0 / 公会堂VP=2
//       withNight=true  → phase='night'/ peddlerCost=8 / 公会堂VP=0

## FIND [low] 夜フェイズのアタック（人狼・吸血鬼・夜襲）で浮浪児(urchin・暗黒時代)が傭兵に化けない
- file: js/engine.js:8499
- rule: 暗黒時代・浮浪児の公式文「When you play another Attack card, and this is on your play area, you may trash this from play. If you do, gain a Mercenary from the Mercenary pile.」（フェイズ条件は無い）。docs/research/nocturne_rules.md §1-2 表 #15「複合種別は文脈を問わず全種別を保持する」＋#13（人狼・吸血鬼・夜襲はアタックカード）
- actual: `maybeUrchinTrap` は `PLAY_ACTION`（js/engine.js:8484）でしか呼ばれず、`case 'PLAY_NIGHT'`（js/engine.js:8499-8525）には無い。そのため場に浮浪児がある状態で夜フェイズに人狼／吸血鬼／夜襲を使っても「浮浪児を廃棄して傭兵を獲得」の窓が開かない。mix-all（`mix:darkages,nocturne`）で到達可能。
- repro: // 上と同じ preamble
const s=mk(K(['werewolf','urchin','mercenary']));
s.supply.mercenary=10;
s.players[0].hand=['werewolf']; s.players[0].inPlay=['urchin'];
s.players[1].hand=['copper','copper','copper','copper','copper'];
let t=red(red(s,{type:'END_ACTION_PHASE'}),{type:'END_TURN'});   // phase='night'
t=red(t,{type:'PLAY_NIGHT',card:'werewolf'});
console.log(t.pending, t.players[0].inPlay);
// 期待: pending={type:'urchin_trash',...}
// 実際: pending=null / inPlay=['urchin','werewolf']（浮浪児は場に残ったまま）
// 対照（アクションフェイズ）: red(s2,{type:'PLAY_ACTION',card:'werewolf'}).pending.type === 'urchin_trash'

## VERDICT confirmed=True sev=medium
■ コードの事実確認（孫引きせず自分で Read）
js/engine.js:5870-5879
```js
case 'tragic_hero':
  draw(state, pi, 3); t.buys += 1;
  if (p.hand.length >= 8) {
    if (takeSelf(state, pi, 'tragic_hero')) {        // 5873
      trashCard(state, pi, 'tragic_hero');           // 5874
      log(...);
      if (anyGainable(...isTreasureFor...)) state.pending = { type:'tragic_hero_gain', player: pi }; // 5876 ← takeSelf 成功ブロックの内側
    }
  }
  break;
```
報告者の「実装の主張」は事実。財宝獲得の pending が `takeSelf` の成功ブロック内にネストしている。
`takeSelf`（js/engine.js:3399-3402）は `playedByCommand` が真なら必ず null を返し、`state._cmd.as` は
`playAsCommand`（3404-3409）が立てる。**NECROMANCER_PLAY（js/engine.js:15130）は `playAsCommand(state, pd.player,'necromancer', card)` を呼ぶ**ので、悲劇のヒーローの `takeSelf` は必ず失敗する。玉座/幽霊の2回目は場から既に消えているので `removeOne` が失敗する。

■ 正本の逐語確認（docs/research/nocturne_rules.md §9 = 3624-3651行 を自分で開いた）
- 3642行 ルールブック逐語："...**If you cannot trash Tragic Hero (for example if you play it twice with Throne Room and trashed it the first time), you still gain the Treasure.**" ＋ 3643行「＝**廃棄は財宝獲得の条件ではない。判定は手札枚数だけ。**」
- 3644行 ネクロマンサー項の逐語（3025行にも重複）："...if the card does not check (such as Tragic Hero), it will function normally."
- 3645行 日wiki：「幽霊で2回使用する例（1回目

FIX: js/engine.js:5870-5879 の `case 'tragic_hero'` で、**財宝獲得の pending を `takeSelf` の成功ブロックの外へ出す**（廃棄と獲得を独立させる）。最小差分：

```js
      case 'tragic_hero':
        draw(state, pi, 3); t.buys += 1;
        if (p.hand.length >= 8) {
          if (takeSelf(state, pi, 'tragic_hero')) {          // 5873：廃棄は「できたら」だけ
            trashCard(state, pi, 'tragic_hero');             // 5874
            log(state, `${p.name} は悲劇のヒーローを廃棄した（手札8枚以上）。`);
          }
          // ★廃棄の成否に条件づかない（ルールブック逐語 "If you cannot trash Tragic Hero ... you still
          //   gain the Treasure."）＝ネクロマンサー／玉座・幽霊の2回目でも財宝を獲得する。
          //   倒壊・死の荷車の pendingSelf パターンとは**逆**なので self を持ち回らないこと。
          if (anyGainable(state, (id) => gainableBase(state, id) && isTreasureFor(state, id))) {
            state.pending = { type: 'tragic_hero_gain', player: pi };   // 5876 を1段外に出すだけ
          }
        }
        break;
```
＝5876行を1段アンインデントして `if (takeSelf(...))` ブロックの外（`if (p.hand.length >= 8)` の直下）へ移すだけ。`tragic_hero_gain` の reducer（js/engine.js:14855）・CPU（js/cpu.js:2188）・UI（js/ui.js:2264）は既に完備なので変更不要。

回帰テスト（test/nocturne.test.js の 761-771 の隣に追加）：
1. ネクロマンサーで廃棄置き場の悲劇のヒーローを使う → 手札8枚 → `pending.type === 'tragic_hero_gain'`、かつ**廃棄置き場のヒーローは廃棄されず残る**（`state.trash` の枚数不変＝「廃棄置き場のカードを廃棄しようとしても廃棄にならない」＝rules.md 3031行）。
2. 玉座の間×悲劇のヒーロー：1回目・2回目とも `tragic_hero_gain` が開き、財宝を計2枚獲得する。
3. 幽霊×悲劇のヒーロー：同上（日wiki の例）。
なお `state.pending` を直接代入する形は1回目と同じ経路なので新たな窓の握りつぶしは生じないが、直近 `2aea7c4`（再演が祝福/呪詛の解決に割り込む修正）と同じ領域なので、玉座・幽霊の2回目で `state.replay` と衝突しないことをテスト2/3で確認しておくこと。

## VERDICT confirmed=True sev=low
【1. 実装の主張は事実】js/engine.js の `case 'will_o_wisp'` は
`if (cardCost(state, top) <= 2 && potionCost(top) === 0)`。
`cardCost()`（engine.js:159）はコイン成分しか返さず、`C()[id].debt` を一切見ていない。
※報告時 5846 行 → 別セッションの同時編集で現在 **5849 行**にずれている（コード文字列で特定すること）。

【2. 正本の逐語を確認（孫引きせず開いた）】docs/research/nocturne_rules.md:1330-1333
  RB:656「If the revealed card does not cost [$2] or less, leave it on your deck.」
  RB:660「**Cards with [P] or [D] in the cost (from Alchemy and Empires) do not cost [$2] or less.**」
  実装注意「素の `cardCost <= 2` を書くとポーション費用・負債コストを取りこぼす（RB:660 が明文で禁じている）」
同じ逐語が 5124-5125 行、5567 行にもある。PROGRESS・engine のコメントに「許容簡略化」の記載は無し（grep 済み）。

【3. node で再現（使い捨てスクリプト3本を実行後に削除）】
(a) 直接再現＝報告どおり。山札の上を変えて `PLAY_ACTION will_o_wisp`：
  engineer($0+負債4)        → hand=["copper","engineer"]  deck=["estate"]      ← 入ってしまう（BUG）
  city_quarter($0+負債8)    → 手札に入る（BUG）
  overlord($0+負債8)        → 手札に入る（BUG）
  royal_blacksmith($0+負債8)→ 手札に入る（BUG）
  transmute($0+P)           → 入らない（OK＝potionCost で弾けている）
  estate($2)/silver($3)     → 入る/入らない（対照OK）
  ＝負債持ち4枚すべてで期待と食い違い。カタログ実測 engineer: coin=0 potion=0 debt=4。

(b) 通しの到達確認（合法な操作列のみ）＝夜フェイズで悪魔祓い→屋敷を廃棄→ウィル・オ・ウィスプ獲得→
  次の手番でプレイ、まで実際に走らせて再現：
  ログ＝「あなた は悪魔祓いで「ウィル・オ・ウィスプ」を獲得した。」→

FIX: js/engine.js:5849（報告時 5846・同時編集で3行ずれた。`case 'will_o_wisp'` 内のこの1行を文字列で特定すること）

  - if (cardCost(state, top) <= 2 && potionCost(top) === 0) {
  + if (costLE(costOf(state, top), { coin: 2, pot: 0, debt: 0 })) {

`costOf`(engine.js:3266) / `costLE`(engine.js:3270) は同じモジュール closure 内なので追加の配線は不要。
これでコイン/ポーション/負債の3成分比較になり、RB:660 の "[P] or [D] in the cost … do not cost [$2] or less" を満たす。

**`costUpTo(state, top, 2)` を使ってはいけない**（正本の実装注意はここだけ過剰）。`costUpTo` は
`gainableBase`＝非サプライ除外＋在庫>0 を含むため、自分のデッキにある願い/インプ/ウィル・オ・ウィスプが
手札に加えられなくなり、屋敷の山が空でも加えられなくなる（上記 evidence 5 で実測）。
公式文は「あなたのデッキの一番上のカードを公開する」＝サプライは無関係。

回帰テスト（test/nocturne.test.js）に足すべきケース：
  技術者($0+負債4)を山札の上に置いてウィル・オ・ウィスプをプレイ → 山札の上に残る（手札に入らない）
  願い($0・非サプライ)を山札の上に置く → 手札に入る（costUpTo に замен えた場合の退行を捕まえる番人）
  屋敷の山が空でも自分の屋敷は手札に入る

## FIND [medium] 川の恵み × ドルイド＝「ターン終了時 +1カード」が完全に発動しない
- file: js/engine.js:7034
- rule: nocturne_rules.md §機構3 3-2 #9「ドルイドで受けた祝福は**脇に置いたまま**。『クリンナップまで持っておく』型でも脇から動かさない」（RB:233-235 逐語）／§A-7 川の恵み「`+1 Card at the end of this turn.`」「**You draw the card after drawing your hand for your next turn.**」。＝カードは脇に残るが、**受けた以上その効果は必ず発生する**。
- actual: `applyBoonEntry`（7031-7039）は `if (!q.aside && q.place !== false)` で置き場所ブロックごとスキップするため、ドルイド経由（`DRUID_BOON` が `queueBoon(..., {aside:true})`＝14768行）では `p.boonsInFront` に何も積まれない。ところが川の恵みの追加ドローは `cleanupAndAdvance` の 7499行 `const n = (pl.boonsInFront || []).filter((b) => b === 'the_rivers_gift').length;` ＝**boonsInFront に入っている枚数でしか数えていない**ので、ドルイドで川の恵みを受けると 0 枚＝完全な空振りになる。田畑/森の恵みは switch 側で即時に効果を出すので無傷。
- repro: node で：`s = E.createInitialState(['A','B'], king(['druid']), {startActive:0})` → 各 player の hand/deck/discard/inPlay を空に → `s.boons.druid = ['the_rivers_gift','the_seas_gift','the_moons_gift']` → `p.hand=['druid']`, `p.deck = new Array(20).fill('copper')` → `reduce(s,{type:'PLAY_ACTION',card:'druid'})` → `reduce(t,{type:'DRUID_BOON',boon:'the_rivers_gift'})` → `boonsInFront` は `[]` → `END_ACTION_PHASE` → `END_TURN`。**片付け後の手札 = 5枚（期待 6枚）**。実測済み。

## FIND [medium] 川の恵み × ピクシー（2回受ける）＝1回ぶんしか引けない
- file: js/engine.js:7036
- rule: nocturne_rules.md §機構3 3-2 #11／§A-2「ピクシー項：`If you receive a Boon that says to keep it until Clean-up, move it to in front of you, and **remember that you get it twice**.`（RB:386-387）」／§3-5 実装注意「ピクシーで同じ祝福を2回受けると**1枚で2回ぶん**」。
- actual: `PIXIE_TRASH`（14790付近）は `queueBoon` を2回積むので `applyBoonEntry` は2回走るが、7036行の `if (!q.share) removeBoonAnywhere(state, boon);` が2回目の直前に `p.boonsInFront` から同じ id を取り除いてしまう（`removeBoonAnywhere` 6989-6996）。結果 `boonsInFront` には常に1枚しか残らず、7499行の枚数カウントで +1カードが1回しか起きない。田畑/森は switch 側で2回とも効果が出るので正しく +2アクション/+2コインになる＝川の恵みだけがずれる。
- repro: node で：`s = mk(king(['pixie','druid']))` → `s.boons.deck = ['the_rivers_gift'].concat(...)`、`s.boons.druid = []` → `p.hand=['pixie']`, `p.deck` に銅貨10枚＋屋敷2枚 → `reduce(s,{type:'PLAY_ACTION',card:'pixie'})`（pending=pixie_trash, boon=the_rivers_gift）→ `reduce(t,{type:'PIXIE_TRASH',trash:true})` → `boonsInFront === ['the_rivers_gift']`（1枚）→ `END_ACTION_PHASE` → `END_TURN`。**片付け後の手札 = 6枚（期待 5+2=7枚）**。実測済み。

## FIND [medium] 呪われた村の獲得時 receiveHex が state.pending を直接立て、同じ獲得で開くはずの獲得時リアクション窓を握りつぶす
- file: js/engine.js:6410
- rule: nocturne_rules.md 冒頭「実装前に必読」#6「**獲得時／廃棄時の窓は必ずキューに積む**。`state.pending` への直接代入は禁止（§0-26 の要求(demand)で望楼の窓を握りつぶした事故と同型）。獲得時＝`state.onGainQueue`」。公式でも「同時に起きる効果の順番は獲得者が選べる」ので、呪詛と望楼の両方が使えるのが正。
- actual: `triggerOnGain` の 6410行 `if (cardId === 'cursed_village') receiveHex(state, pIndex);` は `receiveHex`(7136) → `runHexQueue` → `applyHexTo` を同期実行し、貧困/恐怖/憑依/蝗害では `state.pending` を直接立てる。その後 6653行以降の `state._gainDepth === 1 && !state.pending` ゲートが全部 false になり、**望楼(watchtower)／ティアラ／交易商人／複製(duplicate)／御守り(charm) の窓が1つも開かないまま消える**（呪詛を解決しても再度開かない）。他の夜想曲の獲得時効果（恵みの村・墓地・取り替え子・追跡者）は正しく `onGainQueue` に積んでいるので、呪われた村だけが例外になっている。
- repro: node で：`s = mk(king(['cursed_village','watchtower']))` → `s.hexes.deck = ['poverty'].concat(...)` → `p.hand = ['watchtower','estate','estate','estate','copper'×5]` → `END_ACTION_PHASE` → `PLAY_ALL_TREASURES`（手札は watchtower+屋敷3＝4枚, coins=5）→ `BUY cursed_village`。**pending は `hex_poverty` で、`HEX_POVERTY_DISCARD` を解決した後も pending は null のまま＝watchtower の窓が一度も開かない**。実測済み（mix:nocturne,prosperity 等で到達）。

## FIND [medium] 飢饉・戦争・太陽の恵み・夜警の捨て札が noPrompt 呼び出しのため、忠犬（と村有緑地）の窓が一切開かない
- file: js/engine.js:7203
- rule: nocturne_rules.md 冒頭「実装前に必読」#12「**忠犬と夜警は『山札から捨てられても』発動する**ので、夜想曲の捨て札経路で自分で呼ぶこと」／§E-8「**誘発する**（`triggerOnDiscard` を通す）＝大地（財宝1枚）・空（3枚）・風（2枚）・**太陽（任意枚数）**・貧困・恐怖・**飢饉**」／§A-10 太陽の恵み「捨てるので坑道／**忠犬**／村有緑地がリアクションできる（日本語wiki明記）」。
- actual: 飢饉 7203行 `triggerOnDiscard(state, pi, acts, true)`／戦争 7238行 `triggerOnDiscard(state, pi, rev, true)`／`LOOK_ARRANGE_RESOLVE`（太陽の恵み・夜警）14658行 `triggerOnDiscard(state, pd.player, disc, true)` がいずれも第4引数 `noPrompt=true` を渡している。`triggerOnDiscard`(6802) は `if (!noPrompt)` の中でしか `faithful_hound_react` / `village_green_react` を `onGainQueue` に積まないので、**忠犬をこれらの経路で捨てても脇に置く窓が開かず、そのまま捨て札に落ちる**（坑道の金貨だけは自動なので動く）。忠犬は夜想曲内のカードで、飢饉/戦争は夜想曲の呪詛、太陽の恵みは夜想曲の祝福＝`random-nocturne` 単独で到達する。貧困・恐怖・風・空の恵みは noPrompt なしなので正しく開く（比較実測済み）。
- repro: (a) 飢饉：`s = mk(king(['cursed_village','faithful_hound']))`、`s.hexes.deck=['famine'].concat(...)`、`p.hand=[]`, `p.deck=['faithful_hound','copper','copper','copper']` → `END_ACTION_PHASE` → `t.turn.coins=5` → `BUY cursed_village` → **pending=null / onGainQueue=[] / discard に faithful_hound が落ちる**。(b) 夜警：`p.hand=['night_watchman']`, `p.deck=['faithful_hound','copper'×4]` → `END_ACTION_PHASE` → `END_TURN`（夜フェイズ）→ `PLAY_NIGHT night_watchman` → `LOOK_ARRANGE_RESOLVE {discard:['faithful_hound'], top:[...]}` → **窓が開かない**。(c) 比較：同じ盤面で呪詛を `poverty` にして手札の忠犬を捨てると `pending=faithful_hound_react` が正しく開く。実測済み。

## FIND [low] 戦争（War）のコスト判定が coin 成分だけ＝ポーション費用のカードを「コスト3/4」として廃棄してしまう
- file: js/engine.js:7231
- rule: nocturne_rules.md §B-12 戦争 日本語wiki逐語「**コストに負債やポーションを含むカードは「3・4コストのカード」には該当しないので注意。**」／実装注意「コスト判定＝現在コストが ちょうど $3 または $4 で、**かつポーション費用も負債コストも持たないこと**。`costExact(state, id, 3) || costExact(state, id, 4)` で成分別に書くのが安全」。冒頭「実装前に必読」#7 も同旨。
- actual: 7230-7231行 `const cc = cardCost(state, c); if (cc === 3 || cc === 4) { found = c; break; }` ＝コイン成分だけを見ている。`cardCost` はポーション費用・負債コストを返さないので、**使い魔/錬金術師/賢者の石（$3+P）・ゴーレム（$4+P）が「コスト3/4のカード」に化けて廃棄される**。
- repro: node で：`s = mk(['cursed_village','familiar','alchemist','potion'].concat(FILLER).slice(0,10))` → `s.hexes.deck = ['war'].concat(...)` → `p.hand=[]`, `p.deck=['familiar','gold','gold']`, `p.discard=[]` → `END_ACTION_PHASE` → `t.turn.coins=5` → `BUY cursed_village`。**`state.trash === ['familiar']`／ログ「あなた は戦争で「使い魔」を廃棄した。」**（公式では使い魔は $3+P なので該当せず、そのまま捨て札になるべき）。実測済み。到達＝`mix:alchemy,nocturne`。

## FIND [low] 戦争（War）が「残りを捨て札にしてから廃棄」しており公式と順序が逆（廃棄時ドローの結果が変わる）
- file: js/engine.js:7235
- rule: nocturne_rules.md §B-12 実装注意「**廃棄の順序が実装上シビア**：該当カードを廃棄する時点では、他の公開済みカードはまだ捨て札に置かれていない。廃棄時効果（ネズミの +1カード／城塞／封土／墓／青空市場）が先に走り、そのドローで山札が空なら**その時点の捨て札だけ**をシャッフルする」（日本語wiki 逐語）。
- actual: 7235-7236行が `rev.forEach((c) => p.discard.push(c));` → その後 `if (found) { trashCard(state, pi, found); ... }` の順になっている。公式は「廃棄 → その解決 → 残りを捨てる」。そのため、廃棄したカードの on-trash がドローを起こす（ネズミ）と、**まだ捨て札に置かれていないはずの公開済みカードを巻き込んでシャッフルし、それを引いてしまう**。
- repro: node で：`s = mk(king(['cursed_village','rats']))` → `s.hexes.deck=['war'].concat(...)` → `p.hand=[]`, `p.deck=['estate','rats']`, `p.discard=[]` → `END_ACTION_PHASE` → `t.turn.coins=5` → `BUY cursed_village`。実測結果は `trash=['rats']` / **`hand=['estate']`（公開済みの屋敷を引いてしまう）** / `deck=['cursed_village']`。公式は廃棄時点の捨て札＝`['cursed_village']` だけをシャッフルするので `hand=['cursed_village']` になり、屋敷はその後に捨て札へ行く。

## FIND [low] 非手番プレイヤーが受けた祝福の「+1 アクション／+1 コイン」が手番プレイヤーに入る（相手を利する）
- file: js/engine.js:7046
- rule: nocturne_rules.md §B-9 日本語wiki逐語「みじめな生活に限らず、**呪詛や祝福の効果はそれを受けた人にしか発揮しません**」「これらの状態はプレイヤー間で連動するものではありません」／§3-2 #10（RB:147-149）「恵みの村＝取った祝福を**今受けるか次の自分のターンの開始時に受けるか選ぶ**」＝相手のターンに獲得しても「今受ける」を選べる。受け手が非手番なら +1アクション/+1コインは単に無駄になるのが正。
- actual: `applyBoonEntry`(7031) は `const t = state.turn;` を使い、7046行 `case 'the_fields_gift': addActions(t, 1); addCoins(state, 1);`／7049行 `case 'the_forests_gift': t.buys += 1; addCoins(state, 1);` と、**受け手 `q.player` ではなく現在の手番の turn に加算している**。祝福の物理カードだけは受け手の `p.boonsInFront` に正しく入るので、リソースだけが手番プレイヤーに移る。CPU の `decidePending` は `blessed_village_boon` に対して常に `{now:true}` を返す（js/cpu.js:2144-2145）ため、CPU 戦で自動的に踏む。
- repro: node で：`s = mk(king(['blessed_village','swindler']))` → `s.boons.deck = ['the_fields_gift'].concat(...)` → `s.players[0].hand=['swindler']`、`s.players[1].deck=['militia']`（$4）→ `PLAY_ACTION swindler` →（必要なら `SWINDLER_REACT`）→ `SWINDLER_GAIN {card:'blessed_village'}` → pending は `blessed_village_boon`（player=1）→ `BLESSED_VILLAGE_BOON {now:true}`。**手番 A の `turn.coins` が 2→3、`turn.actions` が 0→1 に増える**（受け手は B）。B の boonsInFront には the_fields_gift が正しく入る。実測済み。到達＝mix:nocturne,intrigue（詐欺師）／nocturne,adventures（使者）等。

## VERDICT confirmed=True sev=low
【1. 実装の主張は事実】js/engine.js:5675-5681 を Read で確認。
```js
case 'tormentor': {
  addCoins(state, 2);
  const othersInPlay = p.inPlay.filter((c) => c !== 'tormentor').length + (p.durationCards || []).length;
  if (othersInPlay === 0) { if (gain(state, pi, 'imp', 'discard')) log(...); }
  else startHexAttack(state, pi, othersInOrder(state, pi));
```
名前で一括除外している＝場にある迫害者を「全部」自分扱いする。また js/engine.js:8452-8453（PLAY_ACTION）で `me.inPlay.push(card)` が `applyEffect` より前に走るので、判定時に自分の1枚が inPlay に入っているのは設計どおり。

【2. 正本の逐語】docs/research/nocturne_rules.md:3562-3563（§7 Tormentor・日wiki 詳細なルール）
「「迫害者以外のカードが場にあるかどうか」ではなく、「使用されたその迫害者以外のカードが場にあるかどうか」で判定される。同名か否かは関係ない。」＝「迫害者Aでインプを得た後に迫害者Bを使うと、Bにとって A は「他のカード」なので呪詛を撒く」。
同 3570 の実装注意「判定＝p.inPlay（今プレイした迫害者自身を除く）＋ p.durationCards が空かどうか。「同名の迫害者がもう1枚あるか」ではない。」

【3. node で再現（_verify_kingdom-cards_tormentor.tmp.js・実行後に削除済み）】
A. 合成再現：inPlay=['tormentor']／hand=['tormentor']／actions=1 で PLAY_ACTION
   → imp山 13→12、log「あなた は迫害者でインプ1枚を獲得した。」、hexes.discard=[] のまま、相手の deluded/envious/misery いずれも変化なし＝呪詛が撒かれない。
B. 対照（inPlay=['village']）→ imp山 13→13、hexes.discard=['famine']＝正しく呪詛。
C. 対照（inPlay=[]）→ imp山 13→12＝正しくインプ。

【4. 実戦到達路＝mix-all 不要。夜想曲“単独”で到達する】
報告者は mix-all（ルネサンスの村人／冒険

FIX: js/engine.js:5677 の1行を、名前による一括除外から「今プレイした1枚だけを除く」に変える。

現行:
```js
const othersInPlay = p.inPlay.filter((c) => c !== 'tormentor').length + (p.durationCards || []).length;
```
修正案:
```js
// 正本 nocturne_rules.md §7: 判定は「**使用したその迫害者**以外のカードが場にあるか」＝同名か否かは無関係。
// 命令(大君主/はみだし者)・ネクロマンサー・相続の屋敷経由では迫害者自身が場に出ない＝1枚も引かない。
const selfInPlay = (!playedByCommand(state, pi, 'tormentor') && p.inPlay.indexOf('tormentor') >= 0) ? 1 : 0;
const othersInPlay = p.inPlay.length + (p.durationCards || []).length - selfInPlay;
```
`playedByCommand` は js/engine.js:3393 に既存（`state._cmd` を見る）。

手計算で9ケースを突き合わせ済み（別スクリプトで検証・削除済み）：迫害者2枚=1(呪詛)／ネクロマンサー＋場に別の迫害者=2(呪詛) の2ケースが現行から直り、通常プレイ・村あり・持続あり・玉座再演・大君主・ネクロマンサー・場が空 の7ケースは現行と同じ結果を保つ（＝退行なし）。

回帰テストの追加先＝test/nocturne.test.js の迫害者の節に「場に迫害者が2枚あるときは呪詛を撒く（インプ山が減らない）」を1件。上の実戦到達路（恵みの村→田畑の恵み→迫害者2連打）そのままでもよい。

## FIND [high] 錯乱(Deluded)中に CPU がアクションカードの購入を提案し続けて無限ループ（ポーション経路が canBuyCard ガードを飛び越える）
- file: js/cpu.js:854
- rule: docs/research/nocturne_rules.md 冒頭「実装前に必読」§4 逐語：「錯乱の『アクションを購入できない』は **engine 拒否・CPU 非提案・UI ボタン無効化を同一コミットで**」。さらに §9「CPU の終端保証」＝engine が拒否する手を CPU が出し続けてはならない。
- actual: engine は canBuyCard（js/engine.js:1389）で錯乱中のアクション購入を拒否し、UI も同じ述語でボタンを無効化しているが、**js/cpu.js には `cantBuyActions` の参照が1つも無い**（grep 0 件）。chooseBuy の最終ガード（cpu.js:880 `const canBuy = ... canBuyCard(...)`）は効くが、その手前 cpu.js:854 `if (potions >= 1) { const pc = bestPotionBuy(state, real, potions); if (pc) return pc; }` が**ガードを飛び越えて early return** する。bestPotionBuy（cpu.js:839）は supply>0・コスト・ポーション数しか見ておらず canBuyCard/NON_SUPPLY/splitBlocked を見ていない。ポーション費用の王国カードはブドウ園以外すべてアクションなので、錯乱を返したターンにポーションを1つでも持っていると engine が必ず拒否 → state 不変 → CPU が同じ BUY を無限に返す（ローカルはタブが固まり、オンラインは部屋が固まる）。加えて cpu.js:1624 の闇市場ハンドラも `cantBuyActions` を見ていないため、ヴィラ等で購入フェイズ→アクションフェイズに戻ってから闇市場を使うと engine.js:10142 が拒否して同型のループになる。
- repro: （1）自然発生：全プール混成 fuzz（夜想曲5枚＋他5枚をランダム抽選）120戦のうち1戦が 20000 step で未終局。王国＝skulk,tracker,ghost_town,cursed_village,bard,masterpiece,crypt,alchemist,tragic_hero,acting_troupe。直近14手すべて {"type":"BUY","card":"alchemist"}、直前ログ「C1 は錯乱を返した（このターンはアクションカードを購入できない）。」

（2）最小再現（test/invariants.test.js と同じ vm ローダで cards/engine/cpu を読み込む）:
const K=['alchemist','skulk','bard','tracker','ghost_town','cursed_village','crypt','village','market','smithy'];
let s=E.createInitialState([{name:'C0',isCpu:true,level:'normal'},{name:'C1',isCpu:true,level:'normal'}],K,{startActive:0});
s.players[0].deluded=true;                       // 呪詛「幻惑」を受けた状態
s.players[0].hand=['copper','copper','copper','potion'];
s.players[0].deck=Array(5).fill('copper');
s=E.reduce(s,{type:'END_ACTION_PHASE'});          // ここで錯乱を返す → t.cantBuyActions=true
s=E.reduce(s,{type:'PLAY_ALL_TREASURES'});        // coins=3 / potions=1
console.log(E.canBuyCard(s,0,'alchemist'));       // → false
for(let i=0;i<5;i++){const a=CPU.decide(s);const b=JSON.stringify(s);s=E.reduce(s,a);console.log(a,JSON.stringify(s)!==b);}

実測出力（HEAD）:
canBuyCard(alchemist)= false
0 {"type":"BUY","card":"alchemist"} 変化= false
1 {"type":"BUY","card":"alchemist"} 変化= false
2 {"type":"BUY","card":"alchemist"} 変化= false  …（以下無限）

到達セット＝mix-all（例 `mix:alchemy,nocturne`。ポーション費用カードと不運カードが同居すれば成立）。固定 `nocturne` / `random-nocturne` にはポーション費用カードが無いので到達しない。

## FIND [medium] オンラインの「買い物だけ同意なしで戻せる」証明が、呪われた村で受けた呪詛を素通しする（呪詛の山を無料で覗ける／-2VP を無料で回避できる）
- file: server/gameServer.js:191
- rule: isNoConsentUndoableBuy 自身が謳う不変条件「② **情報が増えない**＝サプライは公開情報、自分のコインも自分の情報」（server/gameServer.js:179-188 のコメント逐語）。および docs/research/nocturne_rules.md §13「伏せる＝祝福/呪詛の**山の中身**」／§5「呪詛はリアクションを全員ぶん閉じてから**1枚だけめくる**」＝呪詛の山の一番上は秘密。
- actual: isNoConsentUndoableBuy は `state.boons` / `state.hexes` を一切比較せず、自分については `deck` と `hand` の2配列しか比較しない（他プレイヤーは丸ごと比較する）。呪われた村（cursed_village）は獲得時に**自分が呪詛を1つ受ける**が、幻惑(delusion)／羨望(envy)／みじめな生活(misery) は「自分の p.deluded / p.envious / p.misery を書き換えるだけ」で deck も hand も他プレイヤーも動かさず、pending も onGain/onTrashQueue も残さない。したがって述語が true を返し、**相手の承認なしで巻き戻せる**。結果、(a) 呪詛の山の一番上が何かを無料で覗いてから買い直せる（次に誰かが呪詛を配ったとき何が来るか分かる＝情報が増えている）、(b) 生活苦(-2VP)／錯乱／嫉妬を無料で回避できる。カード名を列挙せず「その場で証明する」方式にした設計意図（新カードで漏れないこと）が、非カードの秘密ゾーンを比較対象に入れていないため破れている。
- repro: （server/gameServer.js:191 の isNoConsentUndoableBuy を逐語コピーした述語 proof(prev,cur,seat,action) を使って engine 上で再現。history 先頭＝この BUY、prev＝reduce 前の state）
const K=['cursed_village','skulk','bard','tracker','ghost_town','crypt','village','market','smithy','moat'];
for(const hex of ['delusion','envy','misery']){
  let s=E.createInitialState(['HUMAN','OPP'],K,{startActive:0});
  s.hexes={deck:[hex,'greed','plague'],discard:[]};
  s.players[0].hand=['gold','gold'];
  s.players[0].deck=['copper','copper','copper','copper','copper'];
  s=E.reduce(s,{type:'END_ACTION_PHASE'});
  s=E.reduce(s,{type:'PLAY_ALL_TREASURES'});
  const prev=JSON.parse(JSON.stringify(s));      // pushUndoPoint が積む戻り先
  const act={type:'BUY',card:'cursed_village'};
  const cur=E.reduce(s,act);
  console.log(hex, proof(prev,cur,0,act));
}

実測出力（HEAD）:
delusion → 呪詛の山 ["greed","plague"] / deluded=true / 同意なしUndo可能？= true
envy     → 呪詛の山 ["greed","plague"] / envious=true / 同意なしUndo可能？= true
misery   → 呪詛の山 ["greed","plague"] / misery=1    / 同意なしUndo可能？= true

※ 恵みの村（祝福を取る）は必ず pending（blessed_village_boon）を開き、その回答が履歴の一番上になるので `h.action.type!=='BUY'` で弾かれる＝穴は呪われた村（と将来の「獲得時に静かに非カードを動かす札」）。

## FIND [medium] ピクシーで「祝福を2回受ける」が、クリンナップまで持つ祝福（川の恵み）だと1回ぶんしか効かない
- file: js/engine.js:7036
- rule: docs/research/nocturne_rules.md §3 表 #11（RB:386-387 逐語）：「If you receive a Boon that says to keep it until Clean-up, move it to in front of you, and **remember that you get it twice**」。同 §「田畑の恵み」実装注意：「**ピクシーで2回受けると +2アクション +2コイン**」。同 §「実装前に必読」#11 で川の恵みは「ターン終了時 +1カード（先引きの後）」。
- actual: PIXIE_TRASH（js/engine.js:14802-14803）が queueBoon を2回積むところまでは正しい。しかし applyBoonEntry（7034-7039）は毎回 `if (!q.share) removeBoonAnywhere(state, boon);` を通り、removeBoonAnywhere（6989-6996）が **p.boonsInFront からも removeOne する**ため、2回目の受領で1回目に置いた札を取り上げてから置き直す＝前に置かれる枚数が常に1枚にしかならない。田畑/森の恵みは効果（addActions/addCoins/+1購入）が受領時に即適用されるので2回とも効くが、**川の恵みだけは cleanupAndAdvance（7499）が `(pl.boonsInFront||[]).filter(b=>b==='the_rivers_gift').length` で回数を数える**ため、+2カードのはずが +1カードになる。ログは「川の恵みを受けた」を2回出しているのに引くのは1枚＝表示と挙動も食い違う。ピクシーは出荷の固定 `nocturne` セット（DOM.KINGDOM_NOCTURNE）に入っており、祝福の山には川の恵みが必ず含まれるので**本番で普通に踏む**。
- repro: const K=['pixie','bard','druid','fool','tracker','idol','sacred_grove','blessed_village','village','market'];
let s=E.createInitialState(['A','B'],K,{startActive:0});
s.boons={deck:['the_rivers_gift'],discard:[],druid:[]};   // 山の一番上を川の恵みに固定
s.players[0].hand=['pixie'];
s.players[0].deck=Array(8).fill('copper');
s.players[0].discard=[];
s=E.reduce(s,{type:'PLAY_ACTION',card:'pixie'});
s=E.reduce(s,{type:'PIXIE_TRASH',trash:true});            // ピクシーを廃棄＝2回受ける
console.log(s.players[0].boonsInFront);                    // → ['the_rivers_gift']（1枚しかない）
s=E.reduce(s,{type:'END_ACTION_PHASE'});
s=E.reduce(s,{type:'END_TURN'});
console.log(s.players[0].hand.length);                     // → 6（正しくは 5(先引き)+2 = 7）

実測ログ（HEAD）:
'A はピクシーを廃棄して祝福「川の恵み」を2回受ける。'
'A は祝福「川の恵み」を受けた。'  ×2
'A は川の恵みで +1カード（ターンの終了時）。'  ← 1回しか出ない

## FIND [medium] ネクロマンサーの裏向きフラグが state.trash の「添字」なので、廃棄置き場からカードが抜けるとずれ、同じゾンビを同一ターンに2回使える
- file: js/engine.js:15126
- rule: docs/research/nocturne_rules.md §B-9：「**ネクロマンサーを1ターンに複数回使うときは毎回“別の物理カード”を選ぶ**（wiki 冒頭の逐語）」／「**廃棄置き場から自分を『獲得』する効果は成功する**（待ち伏せ・墓暴き・盗賊）＝『外へ出す』方向は別扱い」。2021エラッタ（裏返してから使用する）は「ネクロマンサーがネクロマンサーを使うと同じカードを再選択できて無限ループになる」ことの防止が目的（同 §B-9）。
- actual: NECROMANCER_PLAY（js/engine.js:15126）が `state.trashFaceDown.push(idx)` と**添字**を積み、necromancerTargets（7287-7296）が `fd.indexOf(i) >= 0` で添字判定する。ところが廃棄置き場からカードを抜く経路（LURKER_GAIN の `removeOne(state.trash, card)`、GRAVEROBBER_FROM_TRASH、ROGUE_GAIN_FROM_TRASH、THIEF_GAIN、TREASURER_GAIN、城塞の `removeOne(state.trash,'fortress')`）は配列を詰めるだけで trashFaceDown を補正しない。→ 抜けた位置より後ろの添字が1つずれ、**使用済みのカードが表向きに戻って同一ターンにもう一度使え**、無関係なカードが裏向き扱いで使えなくなる。研究doc が推奨した「インデックス基準の集合」は、同 doc が明記する『待ち伏せ・墓暴き・盗賊で廃棄置き場からカードが出ていく』経路と両立しない。到達性は mix-all（例 mix:nocturne,intrigue／nocturne,darkages／nocturne,renaissance）。固定 nocturne セット単独では廃棄置き場から抜く効果が無いので到達しない。
- repro: const K=['necromancer','lurker','village','market','smithy','moat','militia','festival','laboratory','cellar'];
let s=E.createInitialState(['A','B'],K,{startActive:0});   // trash=['zombie_apprentice','zombie_mason','zombie_spy']
s.players[0].hand=['necromancer','lurker','necromancer'];
s.players[0].deck=Array(5).fill('copper');
s.turn.actions=5;
s=E.reduce(s,{type:'PLAY_ACTION',card:'necromancer'});
s=E.reduce(s,{type:'NECROMANCER_PLAY',index:1});            // ゾンビの石工(添字1)を使用＝裏返す
if(s.pending) s=E.reduce(s,{type:'ZOMBIE_MASON_GAIN',card:null});
if(s.pending) s.pending=null;
// → trashFaceDown=[1] / 裏向き=zombie_mason（正しい）
s=E.reduce(s,{type:'PLAY_ACTION',card:'lurker'});
s=E.reduce(s,{type:'LURKER_CHOOSE',choice:'gain'});
s=E.reduce(s,{type:'LURKER_GAIN',card:'zombie_apprentice'});// 添字0 を廃棄置き場から獲得＝以降の添字が1ずれる
// → trash=['zombie_mason','zombie_spy','copper'] だが trashFaceDown は [1] のまま＝engine は zombie_spy を裏向きだと思う
s=E.reduce(s,{type:'PLAY_ACTION',card:'necromancer'});
s=E.reduce(s,{type:'NECROMANCER_PLAY',index:0});            // 今の添字0＝ゾンビの石工（さっき使ったはず）
console.log(s.log.filter(x=>/ネクロマンサー/.test(x)));

実測出力（HEAD）:
'A はネクロマンサーで廃棄置き場の「ゾンビの石工」を使用した。'
'A はネクロマンサーで廃棄置き場の「ゾンビの石工」を使用した。'   ← 同一ターンに同じ物理カードを2回使用
facedown=[1,0]  trash=['zombie_mason','zombie_spy','copper','copper']  ← ゾンビの密偵が不当に裏向き扱い

## VERDICT confirmed=True sev=medium
確定（真陽性）。ただし**検証中に作業ツリー側で既に修正が当たった**ので、両方を切り分けて報告する。

■ 1. コードの事実確認（孫引きせず自分で Read）
- `git show HEAD:js/engine.js` の 14658行＝`if (disc.length) triggerOnDiscard(state, pd.player, disc, true);`（noPrompt=true）。報告者の主張どおり。
- `triggerOnDiscard`（6802-6833）は 6824 の `if (!noPrompt) {` ブロックの中でしか `village_green_react`(6826) / `faithful_hound_react`(6831) を積まない。よって noPrompt=true では窓が一切開かない。
- 対照：`RAIDER_DISCARD` の 15023行・`ZOMBIE_SPY` の 15182行は noPrompt なしで呼んでいる（報告者の指摘どおり look_arrange だけ取り残されている）。
- 窓側の配線は健全＝`FAITHFUL_HOUND_REACT` reducer(14890-14900)・`houndsAside` 回収(7508-7513)・CPU `decidePending`(cpu.js:2198)・UI(ui.js:2278) はすべて存在する。つまり「窓さえ開けば正しく動く」状態で、開く側だけが欠けていた。

■ 2. 正本の逐語確認（docs/research/nocturne_rules.md を自分で開いた）
- 2688行（B-2 Faithful Hound の公式FAQ逐語）：
  "Faithful Hound does not have to be in your hand for the ability to work; **for example you can set it aside when it is discarded from your deck due to Night Watchman.**"
  ＝公式FAQが**夜警を名指しで例に挙げている**まさにその経路。
- 2689行："The ability does not work if Faithful Hound is put into your discard pile without being discarded"（＝逆に「捨てる」なら誘発する）。
- 100行（実装前に必読 §12）："**忠犬と夜警は「山札から捨てられても」発動する**ので、夜想曲の捨て札経路で自分で呼ぶこと。"
  ＝正本が実装前に明示的に警告していた項目そのもの。
- なお engine 6827

FIX: 最小修正＝`js/engine.js` の `LOOK_ARRANGE_RESOLVE` で noPrompt を外す（HEAD で js/engine.js:14658、作業ツリーでは 14665 に相当）：

  - `if (disc.length) triggerOnDiscard(state, pd.player, disc, true);`
  + `if (disc.length) triggerOnDiscard(state, pd.player, disc);`

安全性の根拠：直前の 14657行で `state.pending = null;` を済ませているので、`triggerOnDiscard` が
`faithful_hound_react` / `village_green_react` を `onGainQueue` に積んでも pending 競合は起きず、
reduce 末尾のキュー消化（js/engine.js:8260-8272）がそのまま pending 化する。夜フェイズでも同じ
（`END_TURN` 前に消化される）。同じ「山札から捨てる」経路の `RAIDER_DISCARD`（js/engine.js:15023）と
`ZOMBIE_SPY`（js/engine.js:15182）は元から noPrompt なしで、これらと挙動が揃う。

副作用（把握しておくべき点・いずれも改善方向）：
1. `weaver`（織工・異郷）が「自動で銀貨2枚」から「獲得を選ぶ pending」に変わる。mix-all（異郷×夜想曲）でのみ到達。
   `triggerOnDiscard` 6816行の条件は「自分の手番かつ pending 無し」なので、夜警＝自分の夜フェイズでは選択が開く。
   これを避けたい場合は noPrompt を外す代わりに、この呼び出しの後で忠犬／村有緑地ぶんだけ明示的に
   `onGainQueue.push({type:'faithful_hound_react'|'village_green_react', player: pd.player})` する形でも直せる。
2. `village_green_react`（移動動物園）も同経路で開くようになる（これも公式どおり＝mix-all での忠実性向上）。

※**この修正は作業ツリーに既に適用済み**（js/engine.js:14664-14665、および同型の 5789/7203/7238 行）。
併せて回帰テストを `test/nocturne.test.js` に「夜警／太陽の恵みで山札の忠犬を捨てても脇置き窓が開く」で
足しておくとよい（既存の忠犬テストは js/engine.js の OASIS 経路＝手札からの捨て札しか通っていない
＝test/nocturne.test.js:775-785）。

## VERDICT confirmed=True sev=medium
node で再現＝確定（偽陽性ではない）。`_verify_night-phase-cross_way.tmp.js`（vm sandbox に js/cards.js, js/engine.js, js/cpu.js をロード・実行後に削除済み）。

【1. 正本の逐語を自分で確認】
- docs/research/nocturne_rules.md:720（§1-2 表 #14）＝「人狼は**夜フェイズでも習性(Way)を選べる**（アクションカードだから）。**アクション権も消費しない**」／根拠列に `wiki:Werewolf`「A unique aspect of Werewolf is that it can be played with a **Way even during the Night phase, which does not cost an Action**」（逐語）。
- 同 :753（§1-4 実装注意 #5）＝「**人狼は `PLAY_ACTION` と `PLAY_NIGHT` の両入口を持つ**。効果は `turn.phase === 'night'` で分岐。**習性(`action.way`)は両方の入口で受け付ける**（#14）」。
- 同 :3718（人狼カードの節・実装注意）＝「**習性（Way）を選べる**＝夜フェイズでも `playCardNoAction` / `applyWay` の経路に乗せる（`isUsableWay` が正本）」。
→ 正本は3箇所で明示。しかも #5 は「実装注意」＝仕様として要求されていた項目。

【2. 実装を自分で Read（孫引きしていない）】
- js/engine.js:8501 のコメント＝「習性（Way）は「アクションカードを使用するとき」なので夜行カードには使えない＝ここでは選ばせない。」＝正本と**逆の規則を断定**。「許容簡略化」の明記ではなく規則の誤記。
- js/engine.js:8502 `case 'PLAY_NIGHT'` の本体（8502-8525）に `action.way` の参照は1つも無い。`maybeKiln(state, ncard, pi, 'night', null)` と、way 引数に**リテラル null** を渡している（PLAY_ACTION 側 js/engine.js:8484 は `useWay` を渡す）。
- js/ui.js:1574-1575＝夜フェイズのタップは `PLAY_NIGHT` 一択、コメントも同じ誤記。対照の js/ui.js:1563-1570（アクションフェイズ）は `state.ways` を回して「「〜」で使う」ボタンを並べている。
- js/cpu.js:3083＝`{ type

FIX: 最小修正は engine と UI の2ファイル（CPU は任意）。**習性はアクションカードにしか使えない**ので、夜行カードのうち `action` を併せ持つもの（＝人狼のみ）に限定してゲートすること（守護者等の純夜行カードで way を受理してはいけない）。

1) **js/engine.js:8501** — 誤記コメントを差し替える。「習性（Way）は夜行カードには使えない」→「**アクションでもある夜行カード（人狼）は夜フェイズでも習性を選べる（正本 §1-2 #14／§1-4 #5・アクション権は消費しない）**」。

2) **js/engine.js:8502 `case 'PLAY_NIGHT'`** — PLAY_ACTION 側（js/engine.js:8470-8487）と同じ形にする。`me.inPlay.push(ncard)` の後・`applyEffect` の前に：
   - `const useWay = (DOM.isType(ncard, 'action') && isUsableWay(state, action.way)) ? action.way : null;`
     （`isUsableWay` は js/engine.js:2515 が正本。`DOM.isType(ncard,'action')` のゲートを必ず付ける）
   - `if (useWay) log(state, \`${me.name} は「${DOM.LANDSCAPES[useWay].name}」を使う。\`);`
   - 既存の `maybeKiln(state, ncard, pi, 'night', null)`（js/engine.js:8517 付近）の第5引数を **`null` → `useWay`** に変更（炉で中断→再開したときに習性が消えないようにする。PLAY_ACTION は js/engine.js:8484 で既にそうしている）。
   - 直後に `if (useWay) { applyWay(state, useWay, ncard, pi); return state; }` を入れてから `applyEffect(state, ncard, pi);`。
   ※ `t.actionsPlayed` の加算・チャンピオン・`applyPileTokens`（js/engine.js:8509-8515）は**習性でも発火したまま**にすること（正本 :3718「教師の山トークン・御料車・山砦などの『アクションをプレイしたとき』系が発火する」／#14 が「アクション権を消費しない」としか言っていない）。

3) **js/ui.js:1573-1575** — 夜フェイズの分岐を、アクションフェイズ（js/ui.js:1563-1570）と同じ「使う（夜）」＋習性ボタン群にする。ただし `DOM.isType(id,'action')` のときだけ習性ボタンを出す：
   `const wayList = DOM.isType(id,'action') ? (state.ways||[]).filter((w)=>(DOM.LANDSCAPES||{})[w]) : [];` → 各 `w` について `dispatch({type:'PLAY_NIGHT', card:id, way:w})`。コメント（js/ui.js:1574）も engine と同じく訂正する。

4) **js/cpu.js:3083**（任意・非必須）— way を付けないままでも engine は受理する＝ livelock は起きないので機能上は安全。付けるなら PLAY_ACTION 側の習性採用ロジックと同じ述語を使い、`{type:'PLAY_NIGHT', card:n, way:...}` を返す。

回帰テストは test/nocturne.test.js に、(a) 夜の人狼＋`way_of_the_otter` で +2カード・呪詛めくり 0、(b) 純夜行カード（guardian）に way を付けても無視され記載効果が走る、(c) 夜の人狼＋習性でも `t.actionsPlayed` が増える、の3件を追加するのが最小。

## VERDICT confirmed=True sev=medium
確定（再現あり）。報告者の「実装の主張」は孫引きせず自分で確認し、node で実挙動を再現した。

【1. 静的確認（Read 実施）】
- js/engine.js:8502-8523 `case 'PLAY_NIGHT'` は `t.afterActionCard` を一切設定しない。対して js/engine.js:8468 の `PLAY_ACTION` は `t.afterActionCard = card;` を設定する。→ 主張は事実。
- js/engine.js:8303 の reduce 末尾の呼び出し窓は `&& state.turn.phase === 'action'` でゲートされている。→ 主張は事実。
- `after_action` の窓は engine 全体でこの1箇所のみ（grep で確認）＝夜フェイズ用の別経路は存在しない。

【2. 正本の逐語確認（自分で開いた）】
- nocturne_rules.md:754-755「**御料車(royal_carriage)の「アクション解決直後フック」（§0-9 Batch4b の `t.afterActionCard`）は夜フェイズの人狼でも立てること**（唯一の夜行×玉座系の合法経路）。**それ以外の夜行カードでは立てない**。」＝実装への直接指示。
- nocturne_rules.md:713 表#7／:1821「the exception being calling Royal Carriage on Werewolf」
- nocturne_rules.md:3709「when you play it in the Night phase, **it's still an Action card, so you can call Royal Carriage to repeat the Hexing**」
- nocturne_rules.md:3719「夜フェイズでも**アクションカードなので**…御料車…が発火すること」
→ 正本は明示的に要求しており、曖昧さゼロ。

【3. node 再現（`_verify_night-phase-cross_rc.tmp.js`／実行後に削除済み）】
werewolf types = ["action","night","attack","doom"]（Action でもある）
- 対照（アクションフェイズ）: `PLAY_ACTION werewolf` → afterActionCard='werewolf' / pending={"type":"after_action","player":0,"card":"werewolf"} → 窓は正常に開く。
- 本題（夜フェイズ）: END_ACTION_PHASE→EN

FIX: 2箇所（両方直さないと効かない。片方だけでは窓は開かない）。

**① js/engine.js:8511-8516** — `case 'PLAY_NIGHT'` の既存の `if (DOM.isType(ncard, 'action')) { ... }` ブロック内（共謀者カウント／チャンピオンの隣、`applyPileTokens`（8517行）より前）に1行追加：

```js
if (DOM.isType(ncard, 'action')) {
  t.actionsPlayed = (t.actionsPlayed || 0) + 1;
  const champs = ...;
  if (champs > 0) { ... }
  t.afterActionCard = ncard; // ★追加：夜想曲＝夜フェイズの人狼も「アクションを使用した」＝御料車/法貨の呼び出し窓の対象
}
```
既存の `isType(ncard,'action')` ガードにそのまま乗せれば、正本 nocturne_rules.md:755「**それ以外の夜行カードでは立てない**」を自動的に満たす。実測で **夜行15枚のうち Action でもあるのは werewolf ただ1枚**なので、この述語は werewolf を名指しするのと厳密に等価（かつ将来の夜行×アクション札にも自動追従する）。

**② js/engine.js:8303** — 呼び出し窓の phase ゲートに 'night' を足す：

```js
// 変更前
if (!state.pending && !state.gameOver && state.turn && state.turn.afterActionCard && state.turn.phase === 'action') {
// 変更後
if (!state.pending && !state.gameOver && state.turn && state.turn.afterActionCard && (state.turn.phase === 'action' || state.turn.phase === 'night')) {
```

【この修正が安全な理由（検証済み）】
- **窓が誤爆しない**：`afterActionCard` は END_ACTION_PHASE（js/engine.js:9011）で null にされ、`freshTurn`（js/engine.js:688）でも null。よって夜フェイズで非 null になるのは ① が立てたときだけ＝人狼を夜に使った直後に限られる。購入フェイズは 'buy' なのでゲート外のまま（**`turn.phase === 'buy'` 誤爆の逆パターンも起きない**）。
- **人間が詰まない**：ui.js:2703 が常に「呼び出さない」を積むので選択肢ゼロにならない。
- **CPU が無限ループしない**：cpu.js:1691-1700 の `after_action` 分岐はフェイズ非依存で、最後は必ず `{type:'AFTER_ACTION_CALL', card:null}` を返す終端保証がある。
- パッチ版の実測で 呪詛2回配布・pending=null で正常終了・END_TURN で手番が進む・保存則違反なし を確認済み。

【回帰テスト】test/nocturne.test.js に追加推奨：夜フェイズで人狼を使うと `after_action` pending が開くこと／`AFTER_ACTION_CALL royal_carriage` で `hexes.discard` が2になること／**御料車を持たない場合は窓が開かないこと**／**人狼以外の夜行カード（例 guardian/cobbler）では afterActionCard が立たないこと**（正本:755 の「それ以外では立てない」を固定する番人テスト）。

## VERDICT confirmed=True sev=medium
【1. 実装の主張を自分で確認（孫引きせず）】
- js/engine.js:8476-8483（`PLAY_ACTION`）に `if (me.enchanted) { me.enchanted=false; ... draw 1 / addActions 1; return state; }` がある。
- js/engine.js:8502-8523（`PLAY_NIGHT`）を全文 Read。champion(8513-8515)／`applyPileTokens`(8517)／`maybeKiln`(8520)／`applyEffect`(8521) はあるが、**`enchanted` の参照は1つも無い**（`sed -n '8502,8523p' | grep enchant` が0ヒット）。
- `enchanted` の engine 全体の出現箇所を Grep：1713/2608-2619/3509-3513/6324/7353-7354/8470-8483/13586-13591 のみ。消費点は 8476 の PLAY_ACTION **だけ**。`p.enchanted` のクリアは `cleanupAndAdvance`(7354)＝**夜フェイズの後**なので、被害者の夜フェイズ中は true のまま。
- `DOM.isType(id,'night') && DOM.isType(id,'action')` に該当するのは **werewolf のみ**（実測）。

【2. 正本の逐語】docs/research/nocturne_rules.md:3712（§11 Werewolf／日wiki 詳細なルール）
「…／**女魔術師の置換は夜フェイズの人狼にも適用される**（そのターン最初のアクションカードなら +1カード+1アクションになる）／御料車・旗艦・大名の再使用も効く。」
補強：同3709「when you play it in the Night phase, **it's still an Action card**」＝夜に出しても Action カードなので「最初にプレイしたアクションカード」に該当する。

【3. node での再現】`_verify_night-phase-cross_enchantress.tmp.js`（vm sandbox に js/cards.js, js/engine.js, js/cpu.js をロード。実行後に削除済み）
- 前提：werewolf types = `action,night,attack,doom`／enchantress ∈ POOLS.empires／werewolf ∈ POOLS.nocturne／MIX_KINGDOM_POOLS に empires・

FIX: **js/engine.js:8518 の直後（`log(... を使った（夜フェイズ）。`) と 8520 の `maybeKiln` の間）に、PLAY_ACTION:8476-8483 と同じ置換ブロックを移植する。**

```js
// js/engine.js  PLAY_NIGHT 内、8518 の log の直後・8520 の maybeKiln の前
// 帝国：女魔術師＝この手番で最初にプレイした「アクションカード」は記載効果の代わりに +1カード +1アクション。
//   人狼のように Action でもある夜行カードを夜に使った場合にも適用される（正本 nocturne_rules.md:3712）。
if (DOM.isType(ncard, 'action') && me.enchanted) {
  me.enchanted = false;
  draw(state, pi, 1); addActions(t, 1);
  log(state, `${me.name} は女魔術師の効果で 記載効果の代わりに +1カード +1アクション。`);
  return state;
}
```

要点：
1. **`DOM.isType(ncard,'action')` のガードは必須**。女魔術師は「最初にプレイした**アクションカード**」を置換するので、守護者/インプ等の純夜行カード（Action でない）は置換対象外。現状 night+action は werewolf のみだが、将来の夜行カード追加で誤爆しないようガードを残すこと。
2. **挿入位置は「champion(8513-8515)／applyPileTokens(8517)／log(8518) の後・maybeKiln(8520)／applyEffect(8521) の前」**＝PLAY_ACTION と同じ相対順（8461 champion → 8467 pile tokens → 8469 log → 8476 enchanted → 8490 kiln → 8492 applyEffect）。ライン下の外部トリガー（共謀者の数え・チャンピオン・山トークン）は置換されても働く、という公式挙動と PLAY_ACTION の既存実装の両方に一致する。
3. `t.actions += 1` ではなく **`addActions(t, 1)`** を使うこと（雪深い村）。ドローは **`draw(state, pi, 1)`**（-1カードトークン／カメレオンの習性）。どちらも PLAY_ACTION 側と同じ関数。
4. 4点セット（CPU `decidePending`／UI `viewPendingModal`）の追加は**不要**（新 pending を作らない／CPU の `chooseNight` は人狼を選び engine は受理するので livelock なし）。
5. 回帰テストは test/nocturne.test.js に3件：(a) enchanted で夜の人狼 → 手札+1・呪詛めくり0・enchanted=false、(b) 先にアクションを使ってから夜の人狼 → 呪詛が配られる、(c) enchanted で夜の**守護者**（Action でない夜行）→ 置換されず通常どおり解決（ガードの番人テスト）。

## VERDICT confirmed=True sev=medium
【1. 実装の確認（孫引きせず自分で Read）】
- js/engine.js:7031-7041 `applyBoonEntry`：`if (!q.aside && q.place !== false) { … if (BOON_KEEPERS.has(boon)) p.boonsInFront.push(boon); … }` ＝**置き場所ブロックごと丸ごとスキップ**。BOON_KEEPERS は 6990 行＝田畑/森/川の3種。
- js/engine.js:14775 `DRUID_BOON` は `queueBoon(state, pd.player, b, { aside: true })`。`aside:true` を渡すのは**ここだけ**（grep 済み。`place:false` は現状どこからも渡されない）＝バグ経路はドルイド1本。
- js/engine.js:7499-7507 `cleanupAndAdvance`：川の恵みの追加ドローは `const n = (pl.boonsInFront || []).filter((b) => b === 'the_rivers_gift').length;` ＝**boonsInFront の枚数でしか数えていない**。
→ 報告者の「実装の主張」は事実。

【2. 正本の逐語（docs/research/nocturne_rules.md）】
- L2457（ドルイド節・日本語wiki「詳細なルール」逐語の直下の実装注意）：「**「片付けまで手元に置く」系（田畑／森／川の恵み）を選んでも、カード自体は脇から動かさない。** ただし**そのターン中の効果は普通に適用される**（田畑の恵み＝そのターン +1アクション扱い等）。実装では「効果フラグだけ立てて、カードは動かさない」。」
- L964/L974（A-7 川の恵み）：`+1 Card at the end of this turn.` ／ RB:794「**You draw the card after drawing your hand for your next turn.**」
→ 「脇から動かさない」＝**移動しないだけで効果は必ず発生する**。実装は効果まで落としている＝正本違反。

【3. node で再現（`_verify_boons-hexes-states_rivers.tmp.js`・実行後に削除済み）】
vm sandbox に js/cards.js, js/engine.js, js/cpu.js をロード。手札/山札/捨て札を空にした2人戦、山札＝銅貨20枚。
- A（ドルイド）：`s.boons.druid=['the_rivers_gift','the_seas_gift','the_moo

FIX: 正本 L2457 の「効果フラグだけ立てて、カードは動かさない」に合わせ、**「前に置いた枚数」と「ターン終了時ドローの回数」を分離する**のが最小修正（新フィールド1個・3箇所）。

1. js/engine.js:7054 `case 'the_rivers_gift':`（現在 `break;` だけ）
   → `p.riversGift = (p.riversGift || 0) + 1; break;`（受けた回数を受け手に積む。ドルイド・聖なる木立ちの共有・ピクシーの2回受け・恵みの村の持ち越し すべて applyBoonEntry を通るので自動で正しい）。
2. js/engine.js:7501-7507（cleanupAndAdvance の川の恵みブロック）
   → `const n = (pl.boonsInFront || []).filter(...)` を **`const n = pl.riversGift || 0;`** に変え、ドロー後に `pl.riversGift = 0;` を入れる（boonsInFront はこれまでどおり表示と「片付けで捨て札へ戻す」用途に残す＝7517-7523 は不変）。
3. js/engine.js:795 のプレイヤー初期化（`boonsInFront: []` の隣）に `riversGift: 0,` を追加。非カードの公開スカラー＝`maskStateFor` は Object.assign の clone で素通し・invariants の tally 対象外・旧スナップショットは `|| 0` で安全。

（代替案：7034 の条件を緩めて aside でも boonsInFront に push する方式でも直るが、その場合は **js/engine.js:7521 の重複ガードに `state.boons.druid.indexOf(b) < 0` を必ず追加**しないと、片付けでドルイドの祝福が祝福の捨て札に複製されて祝福が13枚になる。また「脇から動かさない」の表示忠実性が崩れるので、1〜3 の分離方式を推奨。）

回帰テスト（test/nocturne.test.js）に追加すべき最小2件：
- ドルイドで川の恵みを受け、`END_ACTION_PHASE`→`END_TURN` 後の手札が **6枚**であること（かつ `boons.druid` が3枚のまま・`boons.discard` に川の恵みが**入らない**こと）。
- 玉座の間でドルイドを2回使い両方 川の恵みを選んだら手札 **7枚**であること。

## VERDICT confirmed=True sev=medium
【1. 実装の確認（孫引きせず自分で Read）】
js/engine.js:5760-5763 は逐語で下記のみ:
  case 'werewolf':
    if (t.phase === 'night') startHexAttack(state, pi, othersInOrder(state, pi));
    else draw(state, pi, 3);
    break;
`grep -n werewolf js/engine.js` の出現は **5761 行の1箇所だけ**。`werewolf_react` は engine.js に一度も現れない（grep で false）。ATTACKS 登録表（js/engine.js:1652-1725）にも werewolf 用のエントリは無く、`hex` エントリ（夜フェイズ側）しかない。PLAY_ACTION reducer（js/engine.js:8444-）を通読したが、「アタックカードを使用したとき」の汎用リアクション窓は存在しない（窓は各アタックの *EnterVictim が個別に開く設計）。＝報告者の「実装の主張」は事実。
なお `maybeUrchinTrap`（8489行）は種別で判定するので浮浪児だけは人狼でも発火する＝「アタックを使用した」判定が部分的にしか無いことの傍証。

【2. 正本の逐語（自分で開いて確認）】
docs/research/nocturne_rules.md
- 3712行（§11 Werewolf・日wiki 詳細なルール）: 「**アタック窓は「+3カード」側でも開く**（『人狼はアタックカードであり、夜フェイズ以外に使用した場合でも、他プレイヤーは【アタック誘発リアクション】でリアクションすることができる。この場合も、人狼使用者が**カードを引いた後はリアクションできない**』）」
- 3709行（英語wiki 逐語）: "when you play Werewolf in the Action phase (so it doesn't attack), **it's still an Attack card and activates other players' Diplomats and so on**"
- 3717行（実装注意）: 「**アタック窓は「+3カード」側でも開く**。既存の `ATTACKS` 実装が「効果を防ぐ」前提なら、**効果なしでも窓だけ開く分岐**が要る（堀は無意味だが、番犬/馬商人/そり/村有緑地型のリアクションが誘発する）。**窓はドロー／呪詛公開より前に閉じること。**」
- 3836行（新 pending 一覧）: アタック窓として `werewolf_react` が**明示的に必須と列挙**

FIX: 最小修正＝夜側の `hex` 窓と同じ形の「効果なしのアタック窓」を1つ足し、**ドローを窓の後ろへ移す**（正本 §11「カードを引いた後はリアクションできない」）。4点セット（engine reducer＋PLAYER_ACTIONS＋CPU＋UI）が必須。

1) js/engine.js:7092 付近（`startHexAttack` / `hexReactEnter` の直後）に、`relicEnterVictim`（js/engine.js の同名関数）と同型の関数を新設：
   function werewolfReactEnter(state, source, queue) {
     queue = (queue || []).filter((v) => !attackImmune(state, v)); // 既存の全アタックと同じ慣行に揃える
     while (queue.length) {
       const v = queue.shift();
       if (hasReaction(state.players[v])) {
         state.pending = { type: 'werewolf_react', stage: 'react', player: v, source, victim: v, queue: queue.slice() };
         return;
       }
     }
     state.pending = null;
     draw(state, source, 3); // 全員の窓を閉じてから引く
   }

2) js/engine.js:5760-5763 の `case 'werewolf'` の else 側を
   `else draw(state, pi, 3);` → `else werewolfReactEnter(state, pi, othersInOrder(state, pi));`
   （夜側 `startHexAttack` はそのまま）。

3) js/engine.js:1652-1725 の ATTACKS 登録表に1行追加（整合性テストが「'react' ステージを作るアタックは全て登録済み」を検査するので必須）：
   werewolf_react: { onMoat: (s, pd) => werewolfReactEnter(s, pd.source, pd.queue) },

4) js/engine.js:14669 の `case 'HEX_REACT'` の隣に `case 'WEREWOLF_REACT'` を追加（窓を閉じて `werewolfReactEnter(state, pd.source, pd.queue)` で次へ）＋ js/engine.js:15460 付近の PLAYER_ACTIONS に `'WEREWOLF_REACT'` を登録。

5) js/cpu.js:2120 の `case 'hex':` と同型で `case 'werewolf_react':` を追加（堀があれば MOAT_REVEAL、無ければ `{ type: 'WEREWOLF_REACT' }` を返す＝**null を返さない**）。

6) js/ui.js:2178 の `if (pd.type === 'hex' && pd.stage === 'react')` と同型で `werewolf_react` の分岐を追加し、`reactOptions(p, pd, { type: 'WEREWOLF_REACT' })` を渡す（押せる選択肢がゼロにならないこと）。

回帰テスト（test/nocturne.test.js）：①アクションフェイズの人狼で相手（guard_dog 保持）に窓が開く ②窓が閉じるまで使用者の手札が増えない（＝ドローは窓の後） ③堀を公開しても +3カードは失われない ④相手がリアクションを持たなければ pending を立てずに即 +3カード（＝CPU 非ループ）。

## VERDICT confirmed=True sev=medium
【1】実装の主張は事実（孫引きせず自分で Read）
js/engine.js の `case 'SHEPHERD_DISCARD'` は
  reveal → discardFromHand → **draw(cards.length*2)** → log → **triggerOnDiscard**
の順。報告どおりドローが捨て札トリガーより先。
※作業中に別セッションが engine.js/cpu.js を並行編集しており行番号が +7 ずれた（報告時 14846 → 現在 14853）。
  ブロック自体は未変更（git diff に SHEPHERD の差分なし）。現在の行＝14852 discardFromHand / **14853 draw** /
  14854 log / **14855 triggerOnDiscard**。以後は行番号でなく内容で特定すること。

【2】正本の逐語を自分で確認
docs/research/nocturne_rules.md:3501（英語wiki "Other rules clarifications" 逐語）
  "If drawing causes you to shuffle, you will shuffle in the discarded Victory cards.
   And if you discard a Tunnel and gain a Gold, **the Gold will get shuffled in**."
同 :3506「**順序厳守**：捨て札 → triggerOnDiscard（坑道の金貨獲得を含む）を全部解決 → その後にまとめて draw」
同 :3845（冒頭「特に事故りやすい順序」2番）にも同じ指示。＝実装は正本に明確に反する。

【3】node で再現（使い捨て `_verify_kingdom-cards_*.tmp.js`・実行後削除済み）
ケースA（山札0・捨て札0／報告の再現）：
  hand=["tunnel","estate"] deck=[] discard=["gold"]
  → 引けたのは **2枚**（羊飼いは +4カード）。金貨はシャッフルに入らず捨て札に取り残される。
  対照実験：捨て札[tunnel,estate,gold]から鍛冶屋(+3)を撃つと hand=[estate,gold,tunnel]
  ＝正しい順序なら「3枚（tunnel/estate/gold）」になることを確認＝報告者の期待値も正しい。
ケースB（山札1・捨て札2＝部分シャッフル／実戦で最も起きやすい形）：
  引き枚数は4で変わらないが金貨だけ捨て札に取り残される＝逐語違反が単独で成立。
ケースC（山札5＝シャッフル不要）：差は出ない（＝影響

FIX: js/engine.js の `case 'SHEPHERD_DISCARD'`（現在 14842 行目。並行編集で行番号が動くので内容で特定すること）
の `if (cards.length) { ... }` 内で、**`triggerOnDiscard` を `draw` より前に動かす**だけ。

現状（js/engine.js:14852-14855）:
    discardFromHand(state, pd.player, cards, cards.length, 'を捨てた（羊飼い）。');
    draw(state, pd.player, cards.length * 2);                 // ← 14853
    log(state, `... +${cards.length * 2}カード。`);
    triggerOnDiscard(state, pd.player, cards);                // ← 14855

修正後:
    discardFromHand(state, pd.player, cards, cards.length, 'を捨てた（羊飼い）。');
    triggerOnDiscard(state, pd.player, cards);   // 坑道の金貨などを先に捨て札へ入れる
    draw(state, pd.player, cards.length * 2);    // その後にまとめて引く（＝金貨がリシャッフルに入る）
    log(state, `... +${cards.length * 2}カード。`);

＝3行の並べ替えのみ。engine 以外（cpu.js / ui.js / PLAYER_ACTIONS）の変更は不要。
正本 docs/research/nocturne_rules.md:3506 の「捨て札 → triggerOnDiscard を全部解決 → その後にまとめて draw」
と一致する。なお同 :3844 のプーカ（廃棄 → on-trash 全部解決 → ドロー）は同型なので、併せて
`POOKA_TRASH` が同じ順序になっているか確認しておくと良い。

回帰テストの追加（test/nocturne.test.js の羊飼い節）:
  ・山札0・捨て札0で ['shepherd','tunnel','estate'] → SHEPHERD_DISCARD(['tunnel','estate'])
    → 手札が3枚で 'gold' を含むこと（現行実装では手札2枚・discard=['gold'] になり落ちる）。
  ・山札1・捨て札2の部分シャッフルで discard に 'gold' が残らないこと。

## VERDICT confirmed=True sev=medium
【1】コードの実見（孫引きせず自分で Read）
js/engine.js:7226-7241 の `case 'war':`
```
          const c = p.deck.shift();
          const cc = cardCost(state, c);          // 7233
          if (cc === 3 || cc === 4) { found = c; break; }   // 7234
```
`cardCost()`（js/engine.js:159）はコイン成分だけを返す。`potionCost()` も `c.debt` も見ていない＝報告者の「実装の主張」は事実。
決定的な傍証＝**同一 engine 内の同型カードは全部ちゃんと弾いている**：
- js/engine.js:2008 ウォリアー `if ((cc === 3 || cc === 4) && potionCost(top) === 0)`
- js/engine.js:2115 / 2178 破壊工作員・騎士 `cc >= 3 && cc <= 6 && potionCost(c) === 0`
戦争だけが `potionCost(c) === 0` を落としている＝書き漏らし。

【2】正本の逐語（docs/research/nocturne_rules.md を自分で開いて確認）
- L4520 §B-12 日本語wiki逐語：「**コストに負債やポーションを含むカードは「3・4コストのカード」には該当しないので注意。**」
- L4529 実装注意：「コスト判定＝現在コストが ちょうど $3 または $4 で、**かつポーション費用も負債コストも持たないこと**」
- L4675 冒頭「実装前に必読」#7：「戦争＝`costExact(...,3) || costExact(...,4)`」

【3】node で再現（使い捨て `_verify_boons-hexes-states_war.tmp.js` を作成→実行→削除済み）
盤面＝`mk(['cursed_village','familiar','alchemist',...FILLER].slice(0,10))` ／ `s.hexes.deck=['war',...]` ／
`p.hand=[] p.deck=['familiar','gold','gold'] p.discard=[]` → `END_ACTION_PHASE` → `turn.coins=8` → `BUY cursed_village`（獲得時に呪詛を受ける）。
実測出力：
- ケース1 使い魔($3+P)：`trash = ["familiar"]` ／ log「あなた は

FIX: js/engine.js:7233-7234。ポーション費用／負債コストを成分別に弾く1条件を足すだけ。

```js
const cc = cardCost(state, c);
if ((cc === 3 || cc === 4) && costIsPlainCoin(c)) { found = c; break; }
```
（`costIsPlainCoin`＝js/engine.js:3313＝`!(potion || debt)`。engine 内の同型実装の書き方に合わせるなら
`(cc === 3 || cc === 4) && potionCost(c) === 0`＝ウォリアー js/engine.js:2008／破壊工作員 js/engine.js:2115 と同じ形。
今のカタログには「コイン3/4 かつ負債」のカードが存在しないので両者は挙動同値だが、将来の拡張を考えると `costIsPlainCoin` の方が安全）。

【重要・修正時の落とし穴】正本 nocturne_rules.md の「実装前に必読」#7 が推奨する
`costExact(state, c, 3) || costExact(state, c, 4)` を**そのまま当ててはいけない**。
`costExact`（js/engine.js:3291）は `gainableBase`（js/engine.js:3277）を含み、
`!NON_SUPPLY.has(id) && (state.supply[id] || 0) > 0 && !splitLocked(id)` を要求する。
戦争が廃棄するのは**サプライではなく自分の山札の札**なので、これを使うと新規に medium〜high のバグが入る：
- **幽霊($4・NON_SUPPLY)／呪われた金貨($4・家宝)／幸運のコイン($4・家宝)** が対象外になる。
  これらは §B-12 が「戦争に狙われ得る」と**名指しで挙げている**（実測でも現状は正しく廃棄されている＝この挙動は維持すべき）。
- **銀貨($3)** も、銀貨の山を買い切った局面では `supply.silver === 0` になって対象外に化ける。
`gainableBase` を通さない `cardCost + costIsPlainCoin` の形にすること。

回帰テストは test/nocturne.test.js の戦争の節に、
(a) 山札の上が使い魔($3+P)＝廃棄されず捨て札へ、(b) ポーション費用札だけの山札＝`trash` が空で全部捨て札、
(c) 幽霊($4・非サプライ)と呪われた金貨($4・家宝)は従来どおり廃棄される、の3件を追加するとよい。

## VERDICT confirmed=True sev=low
■ 1) コードの確認（孫引きせず自分で Read）
- js/engine.js:8063-8071 `maybeEnterNight`＝`if (state.turn.phase !== 'night' && p.hand.some(c => DOM.isType(c,'night'))) { state.turn.phase = 'night'; return; } endBuyTailBaths(state, pi);`
  → **夜行カードが手札に無いと `phase` は `'buy'` のまま** `endBuyTailBaths`（8070）へ落ちる。報告者の主張どおり。
- js/engine.js:9037 `case 'END_TURN'`＝`if (t.phase === 'night') { endBuyTailBaths(state, pi); return state; }`
  → 夜側は **`phase='night'` を保ったまま** 片付け開始時の効果へ入る。よって増築の窓（js/engine.js:8140 `endBuyTailSchemeOrCleanup`）が
  `phase='buy'` / `phase='night'` の2通りで開く。
- 影響先も実在を確認：`gainWasBuyPhase`（6359）→ 公会堂 6741／列柱 6745／徴税、`cardCost` の行商人分岐（186 `t.phase === 'buy'`）。

■ 2) 正本の逐語
- docs/research/nocturne_rules.md:707 表#1「フェイズ順＝**アクション → 購入 → 夜 → クリンナップ**」＝**クリンナップは購入フェイズではない**。
- 同 741-747 §1-4-1「既存の `phase === 'buy'` 判定を全部洗い出し、夜フェイズを購入フェイズと誤認させないこと」＝公会堂・列柱・
  汚された神殿・徴税の `gainWasBuyPhase`／同 26-31「実装前に必読」に **行商人 peddler のコスト** も明記。
- 同 748-750 §1-4-3「`END_BUY_PHASE`(buy→night) を新設し…**手札に夜行カードが1枚も無ければ自動スキップ**」
  ＝設計上も「フェイズは進めた上で止まらない」であり、現実装の「フェイズを進めない」は正本と食い違う。

■ 3) node での再現（`_verify_night-phase-cross_1..4.tmp.js`／実行後に全削除済み・作業ツリー clean）
(A) 統制条件を完全に揃えた比較（inPlay=['improve','village','village','villag

FIX: 最小修正＝**js/engine.js:8063-8071 `maybeEnterNight`**。夜行カードの有無で「フェイズを進めるか」を決めるのをやめ、
**フェイズは常に `'night'` へ進め、止まる（＝ユーザー入力を待つ）かどうかだけを手札で判定する**
（正本 docs/research/nocturne_rules.md:748-750 §1-4-3 の「自動スキップ」＝既存の『アクションが無いとき購入へ自動スキップ』と同型）。

```js
function maybeEnterNight(state, pi) {
  const p = state.players[pi];
  if (state.turn.phase !== 'night') {
    state.turn.phase = 'night';                        // ← 夜行カードの有無に関わらず必ず夜フェイズへ移る
    if (p.hand.some((c) => DOM.isType(c, 'night'))) {  // 使える札があるときだけ止まる（無ければ通過＝自動スキップ）
      log(state, `${p.name} の夜フェイズ。`);
      return;
    }
  }
  endBuyTailBaths(state, pi);
}
```

これで片付け開始時の効果（js/engine.js:8070 `endBuyTailBaths` 以降＝浴場/隠遁者/トラベラー/増築/策謀）が
**常に `phase !== 'buy'`** で走り、公会堂(js/engine.js:6741)・列柱(6745)・徴税(`gainWasBuyPhase` js/engine.js:6359)・
行商人のコスト(js/engine.js:186)・石の銀貨先(js/engine.js:2672) が一貫し、かつ公式（クリンナップは購入フェイズではない）に一致する。

安全性の確認済み事項：
- `cleanupAndAdvance`（js/engine.js:7346）は `t.phase` を一切読まない（grep 済み）／`freshTurn`（js/engine.js:676）が次ターンで `'action'` に戻す。
- `END_TURN`（js/engine.js:9037）は `phase === 'night'` を既に受理済みなので、pending が立った場合の再入経路は現状と同じ。
- UI/CPU から見える状態は「夜行カードを持って夜フェイズに入った既存ケース」と同じなので新しい画面状態は生まれない
  （ただし UI の夜フェイズ表示が一瞬でも出ないよう、`維持: 手札に夜行カードが無ければ pending を立てずそのまま片付けへ抜ける` ことが前提）。

（任意・より根治的な代案）js/engine.js:8070 `endBuyTailBaths` の先頭で `state.turn.phase = 'cleanup'` を立てる。
夜想曲以前からある「増築の片付け中の獲得を購入フェイズ扱いする」既存バグも同時に直るが、
`t.phase !== 'buy'` を見る 9箇所（js/engine.js:127/275/558/1103/1169/2672/6359/6556/8319）と
`END_TURN` のガード（js/engine.js:9038）への影響確認が要るため、夜想曲の作業としては上の最小修正を推奨。
回帰テストは test/nocturne.test.js に「夜行カードの有無で増築の窓のフェイズ・公会堂VP・行商人コストが変わらない」を追加すること。

## VERDICT confirmed=True sev=low
【1. コードの実見（孫引きせず自分で Read）】
- js/engine.js:6992-6998 `removeBoonAnywhere(state, boon)` は deck / discard / **全プレイヤーの `p.boonsInFront`** / `p.boonHeld` から同じ id を取り除く（コメント「同じ祝福idは1枚しか存在しない＝どこにあっても取り除いてから置き直す（ピクシーの2回受けを冪等にする）」）。
- js/engine.js:7036-7042 `applyBoonEntry`：`if (!q.share) removeBoonAnywhere(state, boon);` → `if (BOON_KEEPERS.has(boon)) p.boonsInFront.push(boon);`。**2回目の entry が1回目に置いた自分の前の1枚を先に剥がしてから置き直す**＝常に1枚。
- js/engine.js:7501-7507 川の恵みの解決は `(pl.boonsInFront||[]).filter(b => b === 'the_rivers_gift').length` の**枚数**でドロー回数を決める（先引きの直後）。
- js/engine.js:14801-14811 `PIXIE_TRASH` は `queueBoon(...)` を2回積む（entry は2件走る）。
- js/engine.js:5640-5648 `case 'pixie'` はめくった祝福を先に `boons.discard` へ入れてから pending を立てる。
⇒ 報告者の「実装の主張」は**事実**。

【2. 正本の逐語（docs/research/nocturne_rules.md を自分で開いて確認）】
- 3122-3123（ピクシーの公式FAQ逐語）：`If you receive a Boon that says to keep it until Clean-up, move it to in front of you, and remember that you get it twice.`
- 3132-3134（実装注意）：「『クリーンアップまで手元に置く』祝福3種（Field's/Forest's/**River's**）を2回受ける場合は、捨て札置き場から自分の手前に移し、**2回ぶんとして記録する**（例: 森の恵み＝+1購入+1コイン → +2購入+2コイン）」。
- 999（機構3）：「**ピクシーで同じ祝福を2回受けると1枚で2回ぶん**」。
- 4093-4110（A-7 川の恵み）：`+1 Card at the end of this turn.` ＋「保持そのも

FIX: 最小修正は「ピクシーの2回目の受けで、受け手自身が前に置いている同じ祝福を剥がさない」＝枚数で2回ぶんを数える（正本 3132-3134 の『2回ぶんとして記録する』そのもの）。

1) js/engine.js:6992-6998 `removeBoonAnywhere` に除外席を足す
   `function removeBoonAnywhere(state, boon, keepFrontFor) { ... state.players.forEach((p, idx) => { if (p.boonsInFront && idx !== keepFrontFor) removeOne(p.boonsInFront, boon); ... }) }`
   （deck / discard / boonHeld / 他プレイヤーの前 からの除去は従来どおり＝「同じ祝福は1枚」の不変条件は保つ）

2) js/engine.js:7039 呼び出し側で、片付けまで前に置く祝福のときだけ自分を除外
   `if (!q.share) removeBoonAnywhere(state, boon, BOON_KEEPERS.has(boon) ? pi : undefined);`
   → 7040 の push で2枚目が積まれ、7502 の `filter(...).length` が 2 になって +2カードになる。

副作用の確認は済み：js/engine.js:7517-7524 のクリンナップ返却は `boons.discard.indexOf(b) < 0 && boons.deck.indexOf(b) < 0` の重複ガードがあるので**祝福カードは1枚しか戻らない**（増殖しない）。田畑/森は switch 側で既に2回効いているので挙動不変。test/invariants.test.js:70-75 の祝福12種チェックは Set 判定なので重複を許容する。

回帰テストは test/nocturne.test.js に1件：「ピクシーで川の恵みを2回受けたら、片付け後の手札が 5+2=7枚になる（`boonsInFront` の川の恵みが2枚）」を追加すれば固定できる（田畑＝+2アクション+2コイン、森＝+2購入+2コインの既存対照とセットで置くと分かりやすい）。

## VERDICT confirmed=True sev=high
確定（偽陽性ではない）。node で最小再現・自然発生・闇市場経路の3つとも再現した。

【1. ソースの事実確認（孫引きせず自分で Read/Grep）】
- `grep -n cantBuyActions js/*.js` → **js/engine.js の 6 箇所のみ。js/cpu.js は 0 件・js/ui.js も 0 件**（報告者の主張どおり）。
- js/engine.js:1392 `if (state.turn && state.turn.cantBuyActions && state.turn.active === pi && DOM.isType(id,'action')) return false;` ＝ canBuyCard で拒否。
- js/ui.js は 149 / 1227 / 1585 の3箇所で `DOM.engine.canBuyCard` を通す＝**盤面の購入ボタンは無効化されている**。
- js/cpu.js:854 `if (potions >= 1) { const pc = bestPotionBuy(state, real, potions); if (pc) return pc; }` ＝ 最終ガード（cpu.js:880 `const canBuy = ... canBuyCard(...)`）の**手前で early return**。
- js/cpu.js:839-846 `bestPotionBuy` の候補フィルタは `sup>0 / potion費用 / cost<=real / id!=='possession'` のみ＝**canBuyCard も NON_SUPPLY も splitBlocked も見ていない**。
→ ＝ engine 拒否 ○ ／ UI 無効化 ○ ／ **CPU 非提案 ✗** の 2/3。

【2. 正本の逐語（自分で開いて確認）】
docs/research/nocturne_rules.md:57（冒頭「実装前に必読」§4）
> 「錯乱の『アクションを購入できない』は **engine 拒否・CPU 非提案・UI ボタン無効化を同一コミットで**。」
同 :48
> 「**engine だけ締めて CPU を放置すると本番 livelock**（§0-2・§0-23 で実際に踏んだ型）。」
同 :1155-1157 で「禁止されるのは『アクションカードの購入』だけ／獲得はブロックしない」も確認。

【3. 最小再現（実測出力・HEAD の作業ツリー）】
王国 = alchemist,skulk,bard,tracker,ghost_town,cursed_village,crypt,village,market,smithy
players[0

FIX: 【本丸＝根治】js/cpu.js:839-846 `bestPotionBuy` の候補フィルタに engine の述語を入れる（候補段階で弾く。cpu.js:854 の early return を触るより良い＝候補が残れば「次善のポーション費用カード（ブドウ園等）」を買えて CPU が弱くならない）。

  const cands = (state.kingdom || []).filter((id) =>
    sup(state, id) > 0 && (C()[id].potion || 0) > 0 && (C()[id].potion || 0) <= potions &&
    cost(state, id) <= real && id !== 'possession' &&
    (!DOM.engine.canBuyCard || DOM.engine.canBuyCard(state, state.turn.active, id)));

これ1行で 錯乱(cantBuyActions) だけでなく NON_SUPPLY・splitLocked・高級市場 も同時に塞がる（canBuyCard がすべて内包）＝ 現状 `bestPotionBuy` はこの3つも素通ししている。

【第2】js/cpu.js:1630（闇市場ハンドラの `aff`）を engine.js:10148 と同じ述語に揃える。

  const aff = pd.revealed.filter((id) => cost(state, id) <= coins && !isType(id, 'curse') &&
    !((C()[id] && C()[id].debt) > 0) &&
    !(state.turn.cantBuyActions && pd.player === state.turn.active && isType(id, 'action')));

（`aff` が空になれば既存の `return pick ? ... : {type:'BLACK_MARKET_SKIP'}` で正しく終端する。）

【第3・low／UI 忠実性】js/ui.js:3558 modalBlackMarket の `can` にも同条件を足す（押せるのに無反応なボタンを消す）。

  const can = cst <= coins && !inDebt && !noBuy &&
    !(state.turn.cantBuyActions && pd.player === state.turn.active && DOM.CARDS[id].types.includes('action'));

【回帰テスト】test/nocturne.test.js に2件追加（どちらも本修正を外すと落ちる）。
 (1) 王国に alchemist を混ぜ、`p.deluded=true` → END_ACTION_PHASE → PLAY_ALL_TREASURES（coins3/potions1）の状態で
     `CPU.decide` が返す action を reduce して **state が必ず変化する**こと（＝拒否される手を返さない）。
 (2) 錯乱中に闇市場の公開3枚を全部アクションにして、`CPU.decide` が `BLACK_MARKET_SKIP` を返すこと。
さらに test/invariants.test.js の敵対王国に `mix:alchemy,nocturne` 相当（ポーション費用アクション × 呪われた村/スカルク）を1つ足しておくと、この型の再発を fuzz が拾う。

## VERDICT confirmed=True sev=medium
【結論】報告どおりの実バグ。ただし**検証中に別エージェントが修正を `5844726` としてコミットした**（レビュー開始時点の HEAD は `bde4688`）。以下は両方を実測した結果。

■ 1. コードの事実確認（孫引きせず自分で Read）
`bde4688:js/engine.js` を取り出して確認：報告者の「実装の主張」は**正確**。
- 5789 幽霊 `triggerOnDiscard(state, pi, rev, true)`
- 7203 飢饉 `triggerOnDiscard(state, pi, acts, true)`
- 7238 戦争 `triggerOnDiscard(state, pi, rev, true)`
- 14658 `LOOK_ARRANGE_RESOLVE`（太陽の恵み＋夜警）`triggerOnDiscard(state, pd.player, disc, true)`
`triggerOnDiscard`(6805) は `if (!noPrompt)` の中でしか `village_green_react` / `faithful_hound_react` を `onGainQueue` に積まない（6829/6834）ので、これら4経路では窓が構造的に開かない。

■ 2. 正本の逐語確認（docs/research/nocturne_rules.md を自分で開いた）
- 100行「**忠犬と夜警は「山札から捨てられても」発動する**ので、夜想曲の捨て札経路で自分で呼ぶこと。」
- 4677行 §E-8「**誘発する**（`triggerOnDiscard` を通す）＝大地・空・風・**太陽**・貧困・恐怖・**飢饉**」
- 4325行 飢饉「その中のアクションを捨て札へ（**`triggerOnDiscard` を通す**）」
- 4175行 太陽の恵み「捨てるので坑道／**忠犬**／村有緑地がリアクションできる（日本語wiki明記）」
- 誘発**しない**と明記されているのは**凶兆と憑依のみ**（4256/4394行）＝飢饉/戦争/太陽/夜警は誘発側。

■ 3. node での再現（`_verify_boons-hexes-states_fhound.tmp.js`・vm sandbox に cards/engine/cpu をロード・実行後削除済み）
同一スクリプトを PRE(`bde4688`) と HEAD(`5844726`) の engine.js に対して実行：

PRE-FIX（bde4688）＝**窓が開かなかったケース 6**
- (a) 飢饉：`BUY cursed_village` → hex=famine → 山札の忠犬を捨てる → `pending

FIX: 最小修正＝該当4箇所の第4引数 `noPrompt=true` を外すだけ（`triggerOnDiscard` 本体も呼び出し側の他経路も触らない）。**これは既に `5844726` として適用・コミット済み**なので追加作業は不要。

- js/engine.js:7203（飢饉）`triggerOnDiscard(state, pi, acts, true)` → `triggerOnDiscard(state, pi, acts)`
- js/engine.js:7238（戦争）`triggerOnDiscard(state, pi, rev, true)` → `triggerOnDiscard(state, pi, rev)`
- js/engine.js:14658（`LOOK_ARRANGE_RESOLVE`＝太陽の恵み／夜警）`triggerOnDiscard(state, pd.player, disc, true)` → `triggerOnDiscard(state, pd.player, disc)`
- js/engine.js:5789（幽霊）同様に外す（実害は無いが正本の「山札から捨てても誘発」に揃える防御的修正）
※行番号は修正前 `bde4688` のもの。修正後 HEAD では 7206 / 7241 / 14665 / 5792。

補足：`triggerOnDiscard` は `noPrompt` のとき織工(weaver)を「選択させず銀貨2枚に自動フォールバック」する仕様なので、この4箇所を外すと織工も正しく選択できるようになる（副作用は改善方向のみ）。坑道(tunnel)は `noPrompt` に関係なく自動なので元から影響なし。

再発防止として、`triggerOnDiscard` の呼び出しで `noPrompt=true` を渡してよいのは「**相手のアタックで捨てさせられた等、対話を出すと危険な経路**」だけ、というコメントを 6805 行の関数ヘッダに明記しておくと、次に夜想曲系の捨て札経路を足すときに地図職人(`cartographer`)からのコピペで同じ事故を繰り返さない。

## VERDICT confirmed=True sev=medium
■ 1. コードの事実確認（孫引きせず自分で Read）

- js/engine.js:6410 `if (cardId === 'cursed_village') receiveHex(state, pIndex);` — 報告どおり存在。
- `receiveHex`(js/engine.js:7139) は `t.currentHex` が無ければ **その場で** `takeHex`→`t.hexQueue=[pi]`→`runHexQueue`(7122)→`applyHexTo`(7149) を同期実行する。
- `applyHexTo` は 貧困(7168) `state.pending={type:'hex_poverty'}` / 恐怖(7172) / 憑依(7178) / 蝗害(7208) で **state.pending を直接代入**する。
- 獲得時リアクションの else-if 連鎖のゲートは js/engine.js:6655 `if (state.turn && pIndex === state.turn.active && state._gainDepth === 1 && !state.pending)`。中身＝望楼(6658)/ティアラ(6659)/国境の村/宿屋/スーク/公爵夫人/交易商人(6681)。
- 望楼は engine.js 全体で 3 箇所のみ（4744=カード効果 / 6658=窓 / 11774=reducer）＝**窓を後から開き直す再開網は存在しない**。

■ 2. 正本の逐語（docs/research/nocturne_rules.md を自分で開いて確認）

- 冒頭 #6（L124 付近）「獲得時／廃棄時の窓は必ずキューに積む。`state.pending` への直接代入は禁止…獲得時＝`state.onGainQueue`」
- **L1951**「**獲得時の対話が他と競合する**（望楼／そり／鷹匠／追放の払い戻し／墓地／**呪われた村**…）→ §0-26 の教訓どおり **`state.onGainQueue` に積む**（else-if 連鎖に足さない）」＝呪われた村を名指しで指定。
- **L2298**（Cursed Village 節「実装注意」）「呪詛の中には対話を伴うもの（疫病／飢饉／戦争 等）があるので **`state.onGainQueue` に積む**（§0-26）」
- **L2286**（日本語wiki 逐語の公式裁定）「呪詛を受ける効果は、獲得時効果である。…**望楼などタイミングが同じである獲得時効果によって先に移動された場合、呪われた村をデッキに含まず呪詛を受けることは可能。**」
  ＝公式が「望楼が先に動く」ケースを**明示的に成立するものとし

FIX: 最小修正＝**js/engine.js:6410 の1行**を、その場実行から既存の `state.hexSelfQueue` への遅延に変える。

  - 現状: `if (cardId === 'cursed_village') receiveHex(state, pIndex);`
  - 修正: `if (cardId === 'cursed_village') (state.hexSelfQueue = state.hexSelfQueue || []).push(pIndex);`

これで 6655 のゲート（`!state.pending`）を通過するので望楼/ティアラ/交易商人の窓が開き、呪詛は既存の再開網が後から降らせる。新しい配線は一切不要＝
  - 消化網＝**js/engine.js:8215-8220**（`!state.pending && !state.gameOver && state.turn && !state.turn.currentHex && state.hexSelfQueue.length` → `receiveHex(state, state.hexSelfQueue.shift())`）が既にある。
  - 「ターンを終わらせない」ガード＝**js/engine.js:8344**（`nocturneQueueBusy` が `state.hexSelfQueue` を既に見ている）。
  - `receiveHex`(7139) 自身が `t.currentHex` 在中に hexSelfQueue へ積む設計なので、アタック中の獲得（詐欺師/総督）は挙動不変。

検証済み（engine 未改変のまま模擬）：望楼 pending が開いている状態で `state.hexSelfQueue=[0]` を置き、`{type:'WATCHTOWER', choice:'topdeck'}` を解決すると、
  望楼解決後 pending = hex_poverty ／ 山札の一番上 = 購入したカード ／ hexSelfQueue = [] ／ ログ「呪詛「貧困」がめくられた。」「あなた は呪詛「貧困」を受けた。」
＝**「望楼で先に山札の上へ動かしてから呪詛を受ける」**という正本 L2286 の裁定どおりの挙動になる。CPU も望楼 pending に `{type:'WATCHTOWER',choice:'keep'}` を返す（null を返さない＝終端保証あり）。

注意点（PROGRESS に一行残す価値あり）：hexSelfQueue の消化(8215)は onGainQueue の消化(8263)より**前**なので、墓地/追跡者/恵みの村の窓と同時に立った場合は呪詛が先に解決される。「同時に起きる効果の順番は獲得者が選ぶ」に対する既存の許容簡略化（§0-26 と同型）の範囲内。

回帰テスト案（test/nocturne.test.js）：
  1. 呪詛=貧困 で 呪われた村 を購入 → `pending.type === 'watchtower'`、望楼を解決した後に `pending.type === 'hex_poverty'` が来ること。
  2. 望楼で topdeck を選ぶと 呪われた村 が `deck[0]` に乗り、その後に呪詛を受けること（正本 L2286 の裁定を固定）。
  3. 交易商人(trader) 版でも `trader_react` が開くこと。

## VERDICT confirmed=True sev=medium
■ コードを自分で読んで確認（孫引きしていない）
- js/engine.js:6992-6998 `removeBoonAnywhere(state, boon)` は `b.deck` / `b.discard` に加えて **全プレイヤーの `p.boonsInFront` からも `removeOne` する**。直前 6991 のコメントも「同じ祝福idは1枚しか存在しない＝どこにあっても取り除いてから置き直す（ピクシーの2回受けを冪等にする）」と明記＝意図的に冪等化している。
- js/engine.js:7039-7040 `applyBoonEntry`：`if (!q.share) removeBoonAnywhere(state, boon);` → `if (BOON_KEEPERS.has(boon)) p.boonsInFront.push(boon);`。よって同一プレイヤーが同じ KEEPER 祝福を2回受けても `boonsInFront` は常に1枚。
- js/engine.js:14802-14812 `PIXIE_TRASH` は `queueBoon` を2回積む（報告どおり正しい）。
- js/engine.js:7504 `const n = (pl.boonsInFront || []).filter((b) => b === 'the_rivers_gift').length;` ＝**川の恵みだけ回数を配列の枚数で数えている**ため 1 回ぶんになる。田畑/森は 7057-7062 で受領時に `addActions`/`t.buys`/`addCoins` を即適用するので2回とも効く。

■ 正本の逐語（自分で開いて確認）
- docs/research/nocturne_rules.md:3123（ピクシー公式FAQ 逐語）「If you receive a Boon that says to keep it until Clean-up, move it to in front of you, and **remember that you get it twice**」。
- 同 3133-3134「2回受ける場合は、捨て札置き場から自分の手前に移し、**2回ぶんとして記録する**（例: 森の恵み＝+1購入+1コイン → +2購入+2コイン）」。
- 同 4007「ピクシーで2回受けると **+2アクション +2コイン**」／同 999「ピクシーで同じ祝福を2回受けると**1枚で2回ぶん**」。
- 同 冒頭#11 で川の恵みは「ターン終了時 +1カード（先引きの後）」＝2回受ければ +2カード。

■ node で再現（`_verify_conservation-mask_pixie*.tmp.

FIX: 最小修正＝「受け手自身の前からは取り上げない」ようにして、KEEPER 祝福は同一プレイヤーの `boonsInFront` に2枚積めるようにする（回数＝枚数、というこの実装の既存の数え方をそのまま活かす）。

1. js/engine.js:6992 `function removeBoonAnywhere(state, boon)` → `function removeBoonAnywhere(state, boon, exceptPi)`
   js/engine.js:6995-6996 `state.players.forEach((p) => { if (p.boonsInFront) removeOne(...) ...`
     → `state.players.forEach((p, i) => { if (p.boonsInFront && i !== exceptPi) removeOne(...) ...`
2. js/engine.js:7039 `if (!q.share) removeBoonAnywhere(state, boon);`
     → `if (!q.share) removeBoonAnywhere(state, boon, pi);`
3. js/engine.js:6991 のコメント「ピクシーの2回受けを冪等にする」は誤りなので「受け手自身の前は2回ぶんとして残す（ピクシー）」に直す。

この修正で戻り側は既に安全：js/engine.js:7519-7525 のクリンナップ返却が `discard.indexOf(b) < 0 && deck.indexOf(b) < 0` で重複を弾くので、2枚積んでも祝福の捨て札には1枚しか戻らない（＝祝福12種の保存則は維持）。

パッチを sandbox に当てて実測した結果（node）:
  boonsInFront = ["the_rivers_gift","the_rivers_gift"] / hand after cleanup = **7** / boons.discard = ["the_rivers_gift"]（重複なし・front は空）
  退行なし：田畑の恵み×ピクシー = actions 3・coins 2、cleanup 後 discard は1枚のみ／聖なる木立ちの共有（share）は A・B が各1枚を保持し、cleanup 後 discard は1枚のみ。

回帰テストは test/nocturne.test.js:296-302（川の恵み）の隣に「ピクシー×川の恵みで END_TURN 後の手札が 5+2=7」と「ログの『+1カード（ターンの終了時）』が2回出る」を追加するのが最小。

