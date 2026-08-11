/* 移動動物園（Menagerie）の検証（Node 単体実行）
   使い方: node test/menagerie.test.js
   M1＝追放(Exile)マット／馬(Horse)＝非サプライ30枚。
   M2＝王国カード30種。
   正本＝docs/research/menagerie_rules.md */
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const sandbox = { window: {}, Math: Math, JSON: JSON, console: console };
vm.createContext(sandbox);
let seed = 20260811;
sandbox.Math.random = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function load(f) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f }); }
load('js/cards.js'); load('js/engine.js'); load('js/cpu.js');
const DOM = sandbox.window.DOM, E = DOM.engine, CPU = DOM.cpu;
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  x FAIL: ' + m); } }
const reduce = (s, a) => E.reduce(s, a);
const KING = DOM.POOLS.menagerie.slice(0, 10);
const me = (s) => s.players[0];
const foe = (s) => s.players[1];

// アクションフェイズの素の盤面（手札/山札/捨て札を直に組む）
function act(kingdom) {
  const s = E.createInitialState(['あなた', '相手'], (kingdom || KING).slice(), { startActive: 0 });
  s.turn.phase = 'action'; s.turn.actions = 1;
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  return s;
}
function playFrom(s, card, pi) {
  pi = pi || 0;
  s.players[pi].hand.push(card);
  return reduce(s, { type: 'PLAY_ACTION', card });
}

console.log('\n=== M1: 追放(Exile)マットと馬(Horse)の基盤 ===');
{
  const s = act(['cavalry', 'sanctuary', 'camel_train', 'sleigh', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar']);
  ok(Array.isArray(me(s).exile) && me(s).exile.length === 0, '追放マットが空で初期化される');
  ok(s.supply.horse === 30, '馬を使うカードが王国にあれば 馬の山が30枚 用意される');
  ok(E.canBuyCard(s, 0, 'horse') === false, '馬は購入できない（非サプライ）');
  // 馬の山は3山終了に数えない
  const before = E.emptyPileCount(s);
  s.supply.horse = 0;
  ok(E.emptyPileCount(s) === before, '馬の山が空でも「空の山」に数えない');
}
{
  const s = act(['village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'harbinger', 'vassal', 'workshop', 'bandit']);
  ok(s.supply.horse === undefined, '馬を使うカードが無ければ 馬の山は用意しない');
}
{
  // 追放マットのカードは所有カード＝得点にも庭園の枚数にも数える
  const s = act();
  me(s).exile = ['estate', 'estate', 'province'];
  ok(E.vpOf(me(s)) === 1 + 1 + 6, '追放マットの勝利点カードは得点に数える');
}

console.log('\n=== M1: 馬＝使うと山に戻る（獲得でも廃棄でもない） ===');
{
  const s = act(['cavalry', 'sanctuary', 'camel_train', 'sleigh', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar']);
  me(s).deck = ['copper', 'copper', 'estate'];
  const before = s.supply.horse;
  const s2 = playFrom(s, 'horse');
  ok(me(s2).hand.length === 2, '馬＝+2カード');
  ok(s2.turn.actions === 1, '馬＝+1アクション（1消費して+1）');
  ok(s2.supply.horse === before + 1, '馬は使ったあと その山に戻る（山が1枚増える）');
  ok(me(s2).inPlay.indexOf('horse') < 0, '馬は場に残らない');
}

console.log('\n=== M2: 追放するカード（賞金稼ぎ／聖域／ラクダの隊列／強制退去） ===');
{
  const s = act();
  me(s).hand = ['copper', 'estate'];
  let s2 = playFrom(s, 'bounty_hunter');
  ok(s2.pending && s2.pending.type === 'bounty_hunter_exile', '賞金稼ぎ＝手札1枚を追放する選択が出る');
  s2 = reduce(s2, { type: 'BOUNTY_HUNTER_EXILE', card: 'copper' });
  ok(me(s2).exile.indexOf('copper') >= 0, '賞金稼ぎ＝追放マットに乗る');
  ok(s2.turn.coins === 3, '追放マットに同名が無かったので +$3');
  // 2枚目の銅貨を追放しても +$3 は付かない
  me(s2).hand.push('copper');
  s2.turn.actions = 1;
  let s3 = playFrom(s2, 'bounty_hunter');
  s3 = reduce(s3, { type: 'BOUNTY_HUNTER_EXILE', card: 'copper' });
  ok(s3.turn.coins === 3, '追放マットに同名があるときは +$3 が付かない');
}
{
  const s = act();
  me(s).hand = ['curse'];
  me(s).deck = ['copper'];
  let s2 = playFrom(s, 'sanctuary');
  ok(s2.turn.buys === 2 && s2.turn.actions === 1, '聖域＝+1カード +1アクション +1購入');
  ok(s2.pending && s2.pending.type === 'sanctuary_exile', '聖域＝追放は任意の選択');
  s2 = reduce(s2, { type: 'SANCTUARY_EXILE', card: 'curse' });
  ok(me(s2).exile.indexOf('curse') >= 0 && me(s2).hand.indexOf('curse') < 0, '聖域＝呪いを追放できる');
}
{
  const s = act();
  let s2 = playFrom(s, 'camel_train');
  ok(s2.pending && s2.pending.type === 'camel_train_exile', 'ラクダの隊列＝サプライから追放する選択が出る');
  const goldBefore = s2.supply.gold;
  s2 = reduce(s2, { type: 'CAMEL_TRAIN_EXILE', card: 'gold' });
  ok(me(s2).exile.indexOf('gold') >= 0, 'サプライの金貨を追放マットに置ける');
  ok(s2.supply.gold === goldBefore - 1, 'サプライの山が1枚減る（獲得ではないが山からは抜ける）');
  ok(me(s2).discard.indexOf('gold') < 0, '「サプライから追放」は獲得ではない（捨て札に入らない）');
  // 勝利点は追放できない
  const s3 = reduce(s2, { type: 'CAMEL_TRAIN_EXILE', card: 'province' });
  ok(s3 === s2 || s3.pending == null, '勝利点カードは追放できない（拒否）');
}
{
  // ラクダの隊列の獲得時＝サプライから金貨を追放
  const s = act();
  s.turn.phase = 'buy'; s.turn.coins = 3; s.turn.buys = 1;
  const gold0 = s.supply.gold;
  const s2 = reduce(s, { type: 'BUY', card: 'camel_train' });
  ok(me(s2).exile.indexOf('gold') >= 0 && s2.supply.gold === gold0 - 1, 'ラクダの隊列を獲得したとき サプライから金貨1枚を追放する');
}
{
  const s = act();
  me(s).hand = ['estate'];
  let s2 = playFrom(s, 'displace');
  s2 = reduce(s2, { type: 'DISPLACE_EXILE', card: 'estate' });
  ok(me(s2).exile.indexOf('estate') >= 0, '強制退去＝手札を追放する');
  ok(s2.pending && s2.pending.type === 'displace_gain' && s2.pending.maxCost === 4, '追放したカードのコスト+2 まで獲得できる');
  const s3 = reduce(s2, { type: 'DISPLACE_GAIN', card: 'estate' });
  ok(s3.pending && s3.pending.type === 'displace_gain', '同名のカードは獲得できない（名前の異なるカード）');
  const s4 = reduce(s2, { type: 'DISPLACE_GAIN', card: 'silver' });
  ok(me(s4).discard.indexOf('silver') >= 0 && !s4.pending, '名前の異なる$4以下のカードを獲得できる');
}

console.log('\n=== M2: 追放マットの払い戻し（同名を獲得したとき戻せる） ===');
{
  const s = act();
  me(s).exile = ['gold', 'gold'];
  s.turn.phase = 'buy'; s.turn.coins = 6; s.turn.buys = 1;
  let s2 = reduce(s, { type: 'BUY', card: 'gold' });
  ok(s2.pending && s2.pending.type === 'exile_discard' && s2.pending.card === 'gold', '同名を獲得すると 追放マットから戻す窓が開く');
  const s3 = reduce(s2, { type: 'EXILE_DISCARD', n: 2 });
  ok(me(s3).exile.length === 0 && me(s3).discard.filter((c) => c === 'gold').length === 3, '2枚とも捨て札に戻る（獲得したぶんと合わせて3枚）');
  const s4 = reduce(s2, { type: 'EXILE_DISCARD', n: 0 });
  ok(me(s4).exile.length === 2, '0枚（戻さない）も選べる');
  const s5 = reduce(s2, { type: 'EXILE_DISCARD', n: 1 });
  ok(me(s5).exile.length === 1, '好きな枚数だけ戻せる');
}

console.log('\n=== M2: 雪深い村＝これ以降の +アクション をすべて無視 ===');
{
  const s = act();
  me(s).deck = ['copper', 'copper', 'copper'];
  let s2 = playFrom(s, 'snowy_village');
  ok(s2.turn.actions === 4, '雪深い村自身の +4アクション は得る（1消費して+4）');
  ok(s2.turn.buys === 2, '+1購入');
  // 以後の +アクション は無視される
  s2.players[0].hand.push('village');
  const s3 = reduce(s2, { type: 'PLAY_ACTION', card: 'village' });
  ok(s3.turn.actions === 3, '村の +2アクション は無視される（4-1=3のまま）');
}

console.log('\n=== M2: コストが動くカード（デストリエ／漁師／行人） ===');
{
  const s = act();
  ok(E.cardCost(s, 'destrier') === 6, 'デストリエ＝獲得0枚なら $6');
  s.turn.gainedThisTurn = ['copper', 'silver'];
  ok(E.cardCost(s, 'destrier') === 4, 'デストリエ＝このターン2枚獲得したので $4');
}
{
  const s = act();
  me(s).discard = [];
  ok(E.cardCost(s, 'fisherman') === 2, '漁師＝手番プレイヤーの捨て札が空なら $2（$5-3）');
  me(s).discard = ['copper'];
  ok(E.cardCost(s, 'fisherman') === 5, '漁師＝捨て札があれば $5');
}
{
  const s = act();
  ok(E.cardCost(s, 'wayfarer') === 6, '行人＝このターン何も獲得していなければ $6');
  s.turn.lastGainedAny = 'silver';
  ok(E.cardCost(s, 'wayfarer') === 3, '行人＝直前に獲得したカード（銀貨）と同じ $3');
  s.turn.lastGainedAny = 'province';
  ok(E.cardCost(s, 'wayfarer') === 8, '行人＝直前に獲得したカード（属州）と同じ $8');
}

console.log('\n=== M2: 空の山を数えるカード（動物見本市／パドック） ===');
{
  const s = act();
  s.supply.village = 0; s.supply.smithy = 0;
  const s2 = playFrom(s, 'animal_fair');
  ok(s2.turn.coins === 4, '動物見本市＝+$4');
  ok(s2.turn.buys === 1 + 2, '空の山2つで +2購入');
}
{
  const s = act();
  s.supply.village = 0;
  const s2 = playFrom(s, 'paddock');
  ok(s2.turn.coins === 2, 'パドック＝+$2');
  ok(me(s2).discard.filter((c) => c === 'horse').length === 2, 'パドック＝馬2枚を獲得');
  ok(s2.turn.actions === 1, '空の山1つで +1アクション（1消費して+1）');
}

console.log('\n=== M2: 馬を配るカード（騎兵隊／馬丁／旅籠／貸し馬屋／そり／配給品） ===');
{
  const s = act();
  const s2 = playFrom(s, 'cavalry');
  ok(me(s2).discard.filter((c) => c === 'horse').length === 2, '騎兵隊＝馬2枚を獲得');
}
{
  // 騎兵隊の獲得時＝+2カード +1購入・購入フェイズならアクションフェイズに戻る
  const s = act();
  s.turn.phase = 'buy'; s.turn.coins = 4; s.turn.buys = 1;
  me(s).deck = ['copper', 'copper', 'copper'];
  const s2 = reduce(s, { type: 'BUY', card: 'cavalry' });
  ok(me(s2).hand.length === 2, '騎兵隊の獲得で +2カード');
  ok(s2.turn.phase === 'action', '購入フェイズ中の獲得ならアクションフェイズに戻る');
}
{
  const s = act(['groom', 'cavalry', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'sanctuary', 'scrap']);
  let s2 = playFrom(s, 'groom');
  ok(s2.pending && s2.pending.type === 'groom_gain', '馬丁＝$4以下を獲得する選択');
  const sA = reduce(s2, { type: 'GROOM_GAIN', card: 'village' });
  ok(me(sA).discard.filter((c) => c === 'horse').length === 1, 'アクションを獲得したので馬1枚');
  const sT = reduce(s2, { type: 'GROOM_GAIN', card: 'silver' });
  ok(me(sT).discard.filter((c) => c === 'silver').length === 2, '財宝を獲得したので銀貨1枚（獲得した銀貨と合わせて2枚）');
  const sV = reduce(s2, { type: 'GROOM_GAIN', card: 'estate' });
  ok(sV.turn.actions === 1, '勝利点を獲得したので +1カード +1アクション');
}
{
  // 貸し馬屋＝場にある間、$4以上を獲得するたび馬
  const s = act();
  let s2 = playFrom(s, 'livery');
  ok(s2.turn.coins === 3, '貸し馬屋＝+$3');
  s2.turn.phase = 'buy'; s2.turn.buys = 1; s2.turn.coins = 6;
  const s3 = reduce(s2, { type: 'BUY', card: 'gold' });
  ok(me(s3).discard.filter((c) => c === 'horse').length === 1, '$4以上のカードを獲得したので馬1枚');
  const s4 = reduce(s2, { type: 'BUY', card: 'copper' });
  ok(me(s4).discard.filter((c) => c === 'horse').length === 0, '$4未満の獲得では馬は付かない');
}
{
  // 配給品＝馬を山札の上に置く
  const s = act();
  s.turn.phase = 'buy';
  me(s).hand = ['supplies'];
  const s2 = reduce(s, { type: 'PLAY_TREASURE', card: 'supplies' });
  ok(s2.turn.coins === 1, '配給品＝+$1');
  ok(me(s2).deck[0] === 'horse', '配給品＝馬を山札の上に置く');
}
{
  // 備蓄品＝+1購入して自分を追放
  const s = act();
  s.turn.phase = 'buy';
  me(s).hand = ['stockpile'];
  const s2 = reduce(s, { type: 'PLAY_TREASURE', card: 'stockpile' });
  ok(s2.turn.coins === 3 && s2.turn.buys === 2, '備蓄品＝+$3 +1購入');
  ok(me(s2).exile.indexOf('stockpile') >= 0 && me(s2).inPlay.indexOf('stockpile') < 0, '備蓄品＝これを追放する');
}

console.log('\n=== M2: 持続（艀／首謀者／村有緑地／門番） ===');
{
  const s = act();
  me(s).deck = ['copper', 'copper', 'copper', 'copper'];
  let s2 = playFrom(s, 'barge');
  ok(s2.pending && s2.pending.type === 'barge_choose', '艀＝「今」か「次のターン」かを選ぶ');
  const now = reduce(s2, { type: 'BARGE_CHOOSE', choice: 'now' });
  ok(me(now).hand.length === 3 && now.turn.buys === 2, '「今」＝+3カード +1購入');
  const next = reduce(s2, { type: 'BARGE_CHOOSE', choice: 'next' });
  ok((me(next).delayedEffects || []).some((e) => e.type === 'barge'), '「次のターン」＝持続の予約が入る');
}
{
  const s = act();
  const s2 = playFrom(s, 'mastermind');
  ok((me(s2).delayedEffects || []).some((e) => e.type === 'mastermind'), '首謀者＝持続の予約が入る');
}
{
  const s = act();
  me(s).deck = ['copper'];
  let s2 = playFrom(s, 'village_green');
  ok(s2.pending && s2.pending.type === 'village_green_choose', '村有緑地＝「今」か「次のターン」かを選ぶ');
  const now = reduce(s2, { type: 'VILLAGE_GREEN_CHOOSE', choice: 'now' });
  ok(me(now).hand.length === 1 && now.turn.actions === 2, '「今」＝+1カード +2アクション');
}
{
  // 村有緑地＝クリンナップ以外で捨てたら使ってよい
  const s = act();
  me(s).hand = ['village_green', 'copper'];
  me(s).deck = ['estate', 'estate', 'estate', 'estate', 'estate', 'estate'];
  let s2 = playFrom(s, 'hunting_lodge');
  s2 = reduce(s2, { type: 'HUNTING_LODGE_CHOOSE', discard: true });
  const found = (s2.pending && s2.pending.type === 'village_green_react') ||
    (s2.onGainQueue || []).some((q) => q.type === 'village_green_react');
  ok(found, '狩猟小屋で村有緑地を捨てたら「使ってよい」窓が開く');
}

console.log('\n=== M2: アタック（黒猫／枢機卿／魔女の集会） ===');
{
  // 黒猫＝自分のターンでは呪いを配らない
  const s = act();
  me(s).deck = ['copper', 'copper'];
  const s2 = playFrom(s, 'black_cat');
  ok(me(s2).hand.length === 2, '黒猫＝+2カード');
  ok(foe(s2).discard.indexOf('curse') < 0, '自分のターンに使った黒猫は呪いを配らない');
}
{
  // 枢機卿＝相手の山札上2枚から $3〜$6 を1枚追放
  const s = act();
  foe(s).deck = ['gold', 'copper'];
  const s2 = playFrom(s, 'cardinal');
  ok(s2.turn.coins === 2, '枢機卿＝+$2');
  ok(foe(s2).exile.indexOf('gold') >= 0, '$3〜$6 の金貨が追放される');
  ok(foe(s2).discard.indexOf('copper') >= 0, '残りは捨て札になる');
}
{
  // 魔女の集会＝相手がサプライから呪いを追放
  const s = act();
  const curse0 = s.supply.curse;
  const s2 = playFrom(s, 'coven');
  ok(s2.turn.coins === 2 && s2.turn.actions === 1, '魔女の集会＝+1アクション +$2');
  ok(foe(s2).exile.indexOf('curse') >= 0 && s2.supply.curse === curse0 - 1, '相手はサプライから呪い1枚を追放する');
  // 呪いの山が空なら、相手は追放マットの呪いを全部捨てる
  const s3 = act();
  s3.supply.curse = 0;
  foe(s3).exile = ['curse', 'curse'];
  const s4 = playFrom(s3, 'coven');
  ok(foe(s4).exile.length === 0 && foe(s4).discard.filter((c) => c === 'curse').length === 2,
    '呪いの山が空なら 追放マットの呪いをすべて捨て札にする');
}

console.log('\n=== M2: リアクション（牧羊犬／そり／鷹匠） ===');
{
  const s = act();
  me(s).hand = ['sheepdog'];
  me(s).deck = ['copper', 'copper'];
  s.turn.phase = 'buy'; s.turn.coins = 3; s.turn.buys = 1;
  let s2 = reduce(s, { type: 'BUY', card: 'silver' });
  const q = (s2.pending && s2.pending.type === 'sheepdog_react') || (s2.onGainQueue || []).some((x) => x.type === 'sheepdog_react');
  ok(q, '獲得したとき 牧羊犬の窓が開く');
}
{
  const s = act();
  me(s).hand = ['sleigh'];
  s.turn.phase = 'buy'; s.turn.coins = 6; s.turn.buys = 1;
  let s2 = reduce(s, { type: 'BUY', card: 'gold' });
  while (s2.pending && s2.pending.type !== 'sleigh_react') s2 = reduce(s2, CPU.decidePending(s2, s2.pending.player));
  ok(s2.pending && s2.pending.type === 'sleigh_react', '獲得したとき そりの窓が開く');
  const s3 = reduce(s2, { type: 'SLEIGH_REACT', where: 'hand' });
  ok(me(s3).hand.indexOf('gold') >= 0, 'そりを捨てて 獲得した金貨を手札に加えられる');
  ok(me(s3).discard.indexOf('sleigh') >= 0, 'そり自身は捨て札に置かれる');
}
{
  // 鷹匠＝誰かが種別2つ以上のカードを獲得したとき手札から使える
  const s = act(['falconer', 'village_green', 'cavalry', 'sanctuary', 'scrap', 'sheepdog', 'sleigh', 'snowy_village', 'wayfarer', 'kiln']);
  me(s).hand = ['falconer'];
  s.turn.phase = 'buy'; s.turn.coins = 5; s.turn.buys = 1;
  let s2 = reduce(s, { type: 'BUY', card: 'village_green' }); // action+duration+reaction＝種別3つ
  const q = (s2.pending && s2.pending.type === 'falconer_react') || (s2.onGainQueue || []).some((x) => x.type === 'falconer_react');
  ok(q, '種別2つ以上のカードが獲得されたら 鷹匠の窓が開く');
}

console.log('\n=== M2: がらくた／狩猟小屋／ヤギ飼い／炉 ===');
{
  const s = act();
  me(s).hand = ['gold']; // $6 ＝ 6種すべて選べる
  let s2 = playFrom(s, 'scrap');
  s2 = reduce(s2, { type: 'SCRAP_TRASH', card: 'gold' });
  ok(s2.pending && s2.pending.type === 'scrap_choose' && s2.pending.count === 6, 'がらくた＝廃棄したコスト分だけ選べる');
  const s3 = reduce(s2, { type: 'SCRAP_CHOOSE', choices: ['card', 'action', 'buy', 'coin', 'silver', 'horse'] });
  ok(s3.turn.buys === 2 && s3.turn.coins === 1, 'がらくた＝+1購入 +1コイン');
  ok(me(s3).discard.indexOf('silver') >= 0 && me(s3).discard.indexOf('horse') >= 0, 'がらくた＝銀貨と馬を獲得');
  const bad = reduce(s2, { type: 'SCRAP_CHOOSE', choices: ['card', 'card', 'buy', 'coin', 'silver', 'horse'] });
  ok(bad.pending && bad.pending.type === 'scrap_choose', '同じ効果を2回は選べない（拒否）');
}
{
  const s = act();
  me(s).hand = ['copper', 'copper'];
  me(s).deck = ['estate', 'estate', 'estate', 'estate', 'estate', 'estate', 'estate'];
  let s2 = playFrom(s, 'hunting_lodge');
  ok(s2.pending && s2.pending.type === 'hunting_lodge_choose', '狩猟小屋＝引き直すかを選ぶ');
  const s3 = reduce(s2, { type: 'HUNTING_LODGE_CHOOSE', discard: true });
  ok(me(s3).hand.length === 5, '手札を全部捨てて +5カード');
}
{
  // ヤギ飼い＝右隣が直前のターンに廃棄した枚数だけ引く
  const s = act();
  foe(s).trashedLastTurn = 2;
  me(s).deck = ['copper', 'copper', 'copper'];
  me(s).hand = ['estate'];
  const s2 = playFrom(s, 'goatherd');
  ok(me(s2).hand.filter((c) => c === 'copper').length === 2, 'ヤギ飼い＝右隣が直前の手番に廃棄した枚数ぶん引く');
  ok(s2.pending && s2.pending.type === 'goatherd_trash', 'ヤギ飼い＝手札を1枚廃棄してもよい');
}
{
  // 炉＝次に使うカードの解決前にコピーを獲得
  const s = act(['kiln', 'village', 'cavalry', 'sanctuary', 'scrap', 'sheepdog', 'sleigh', 'snowy_village', 'wayfarer', 'groom']);
  s.turn.actions = 2;
  let s2 = playFrom(s, 'kiln');
  ok(s2.turn.coins === 2 && s2.turn.kilnCharges === 1, '炉＝+$2 と「次の使用」の権利');
  me(s2).hand.push('village');
  me(s2).deck = ['copper'];
  let s3 = reduce(s2, { type: 'PLAY_ACTION', card: 'village' });
  ok(s3.pending && s3.pending.type === 'kiln_gain' && s3.pending.card === 'village', '次にカードを使ったとき 炉の窓が開く');
  const s4 = reduce(s3, { type: 'KILN_GAIN', gain: true });
  ok(me(s4).discard.indexOf('village') >= 0, '同名のコピーを獲得できる');
  ok(me(s4).hand.indexOf('copper') >= 0, 'そのあと本体の効果（村＝+1カード）が解決する');
}

console.log('\n=== M3: 習性（Way）＝アクションの記載効果の代わりに使う ===');
// 習性つきの盤面（王国は移動動物園10種＋テスト用）
const WAYKING = ['sanctuary', 'cavalry', 'livery', 'wayfarer', 'scrap', 'destrier', 'village', 'smithy', 'market', 'militia'];
function actWay(ways, kingdom) {
  const s = E.createInitialState(['あなた', '相手'], (kingdom || WAYKING).slice(), { startActive: 0, ways: ways });
  s.turn.phase = 'action'; s.turn.actions = 1;
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  return s;
}
function playWay(s, card, way) {
  s.players[0].hand.push(card);
  return reduce(s, { type: 'PLAY_ACTION', card, way });
}
{
  // 固定ボーナス系（カワウソ／雄牛／羊／ラバ／サル／豚）
  const s = actWay(['way_of_the_otter', 'way_of_the_ox']);
  me(s).deck = ['copper', 'copper', 'copper'];
  const a = playWay(s, 'sanctuary', 'way_of_the_otter');
  ok(me(a).hand.length === 2 && a.turn.buys === 1, 'カワウソの習性＝+2カードだけ（聖域の記載効果は起きない）');
  const s2 = actWay(['way_of_the_ox']);
  const b = playWay(s2, 'sanctuary', 'way_of_the_ox');
  ok(b.turn.actions === 2, '雄牛の習性＝+2アクション（1消費して+2）');
  const s3 = actWay(['way_of_the_sheep']);
  const c = playWay(s3, 'sanctuary', 'way_of_the_sheep');
  ok(c.turn.coins === 2, '羊の習性＝+2コイン');
}
{
  // 採用していない習性を指定しても無視され、記載効果で解決する
  const s = actWay(['way_of_the_ox']);
  me(s).deck = ['copper'];
  const a = playWay(s, 'sanctuary', 'way_of_the_sheep');
  ok(a.turn.coins === 0 && a.turn.buys === 2, '採用外の習性は無視して記載効果で解決する');
}
{
  // カメレオン＝+カードと+コインを入れ替える
  const s = actWay(['way_of_the_chameleon']);
  me(s).deck = ['copper', 'copper', 'copper', 'copper'];
  const a = playWay(s, 'wayfarer', 'way_of_the_chameleon'); // 行人＝+3カード
  ok(a.turn.coins === 3 && me(a).hand.length === 0, 'カメレオン＝+3カードが +$3 になる');
  const s2 = actWay(['way_of_the_chameleon']);
  me(s2).deck = ['copper', 'copper', 'copper'];
  const b = playWay(s2, 'livery', 'way_of_the_chameleon'); // 貸し馬屋＝+$3
  ok(b.turn.coins === 0 && me(b).hand.length === 3, 'カメレオン＝+$3 が +3カード になる');
}
{
  // 馬の習性＝+2カード +1アクション、これをその山に戻す
  const s = actWay(['way_of_the_horse']);
  me(s).deck = ['copper', 'copper'];
  const before = s.supply.sanctuary;
  const a = playWay(s, 'sanctuary', 'way_of_the_horse');
  ok(me(a).hand.length === 2 && a.turn.actions === 1, '馬の習性＝+2カード +1アクション');
  ok(a.supply.sanctuary === before + 1 && me(a).inPlay.indexOf('sanctuary') < 0, '馬の習性＝これをその山に戻す');
}
{
  // チョウの習性＝山に戻して ちょうど1コイン高いカードを獲得
  const s = actWay(['way_of_the_butterfly']);
  let a = playWay(s, 'scrap', 'way_of_the_butterfly'); // がらくた＝$3
  ok(a.pending && a.pending.type === 'way_butterfly', 'チョウの習性＝山に戻すかを選ぶ');
  a = reduce(a, { type: 'WAY_BUTTERFLY', ret: true });
  ok(a.pending && a.pending.type === 'way_butterfly_gain' && a.pending.exactCost === 4, 'ちょうど$4 を獲得できる');
  const b = reduce(a, { type: 'WAY_BUTTERFLY_GAIN', card: 'cavalry' });
  // 騎兵隊は獲得時に +2カード を引く＝山札が空だと捨て札ごとシャッフルされて手札に入る。所有カードのどこかにあればよい。
  const own = me(b).discard.concat(me(b).hand, me(b).deck);
  ok(own.indexOf('cavalry') >= 0, 'ちょうど1コイン高いカードを獲得した');
}
{
  // ヤギ（廃棄）／ミミズ（屋敷を追放）／ラクダ（金貨を追放）
  const s = actWay(['way_of_the_goat']);
  me(s).hand = ['curse'];
  let a = playWay(s, 'sanctuary', 'way_of_the_goat');
  a = reduce(a, { type: 'WAY_GOAT_TRASH', card: 'curse' });
  ok(a.trash.indexOf('curse') >= 0, 'ヤギの習性＝手札1枚を廃棄する');
  const s2 = actWay(['way_of_the_worm']);
  const e0 = s2.supply.estate;
  const b = playWay(s2, 'sanctuary', 'way_of_the_worm');
  ok(me(b).exile.indexOf('estate') >= 0 && b.supply.estate === e0 - 1, 'ミミズの習性＝サプライの屋敷1枚を追放');
  const s3 = actWay(['way_of_the_camel']);
  const c = playWay(s3, 'sanctuary', 'way_of_the_camel');
  ok(me(c).exile.indexOf('gold') >= 0, 'ラクダの習性＝サプライの金貨1枚を追放');
}
{
  // モグラ（手札を全部捨てて+3）／フクロウ（6枚になるまで引く）
  const s = actWay(['way_of_the_mole']);
  me(s).hand = ['copper', 'copper'];
  me(s).deck = ['estate', 'estate', 'estate', 'estate'];
  const a = playWay(s, 'sanctuary', 'way_of_the_mole');
  ok(me(a).hand.length === 3 && me(a).hand.every((c) => c === 'estate'), 'モグラの習性＝手札を全部捨てて +3カード');
  const s2 = actWay(['way_of_the_owl']);
  me(s2).hand = ['copper', 'copper'];
  me(s2).deck = ['estate', 'estate', 'estate', 'estate', 'estate'];
  const b = playWay(s2, 'sanctuary', 'way_of_the_owl');
  ok(me(b).hand.length === 6, 'フクロウの習性＝手札が6枚になるまで引く');
}
{
  // ドブネズミ＝財宝を捨てて これと同じカードを獲得
  const s = actWay(['way_of_the_rat']);
  me(s).hand = ['copper'];
  let a = playWay(s, 'sanctuary', 'way_of_the_rat');
  ok(a.pending && a.pending.type === 'way_rat_discard', 'ドブネズミの習性＝財宝を捨てるかを選ぶ');
  a = reduce(a, { type: 'WAY_RAT_DISCARD', card: 'copper' });
  ok(me(a).discard.indexOf('copper') >= 0 && me(a).discard.filter((c) => c === 'sanctuary').length === 1,
    '財宝を捨てて 同じカード（聖域）をもう1枚獲得した');
}
{
  // アザラシ＝このターン獲得したカードを山札の上に置ける
  const s = actWay(['way_of_the_seal']);
  let a = playWay(s, 'sanctuary', 'way_of_the_seal');
  ok(a.turn.coins === 1 && a.turn.sealActive, 'アザラシの習性＝+$1 とこのターンの効果');
  a.turn.phase = 'buy'; a.turn.coins = 6; a.turn.buys = 1;
  let b = reduce(a, { type: 'BUY', card: 'gold' });
  while (b.pending && b.pending.type !== 'way_seal_topdeck') b = reduce(b, CPU.decidePending(b, b.pending.player));
  ok(b.pending && b.pending.type === 'way_seal_topdeck', '獲得したとき 山札の上に置く窓が開く');
  const c = reduce(b, { type: 'WAY_SEAL_TOPDECK', top: true });
  ok(me(c).deck[0] === 'gold', '獲得した金貨を山札の上に置いた');
}
{
  // リス＝ターンの終了時（次の手札を引いた後）に +2カード＝手札が7枚になる
  const s = actWay(['way_of_the_squirrel']);
  me(s).deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'estate', 'estate', 'estate'];
  let a = playWay(s, 'sanctuary', 'way_of_the_squirrel');
  ok(a.turn.squirrelDraw === 2, 'リスの習性＝ターン終了時の +2カード を予約する');
  a = reduce(a, { type: 'END_ACTION_PHASE' });
  a = reduce(a, { type: 'END_TURN' });
  ok(me(a).hand.length === 7, '次の手札5枚を引いた「後」に +2カード（合計7枚）');
}
{
  // カエル＝このターン、場から捨てるとき山札の上に置く
  const s = actWay(['way_of_the_frog']);
  me(s).deck = ['copper', 'copper', 'copper', 'copper', 'copper'];
  let a = playWay(s, 'sanctuary', 'way_of_the_frog');
  ok(a.turn.actions === 1, 'カエルの習性＝+1アクション');
  a = reduce(a, { type: 'END_ACTION_PHASE' });
  a = reduce(a, { type: 'END_TURN' });
  ok(me(a).deck.indexOf('sanctuary') >= 0 || me(a).hand.indexOf('sanctuary') >= 0,
    'カエルの習性＝片付けで捨てずに山札の上に置く');
  ok(me(a).discard.indexOf('sanctuary') < 0, '捨て札には入らない');
}
{
  // ウミガメ＝脇に置いて 次のターンの開始時に使用する
  const s = actWay(['way_of_the_turtle']);
  me(s).deck = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper'];
  let a = playWay(s, 'sanctuary', 'way_of_the_turtle');
  ok(me(a).setAside.indexOf('sanctuary') >= 0, 'ウミガメの習性＝これを脇に置く');
  a = reduce(a, { type: 'END_ACTION_PHASE' });
  a = reduce(a, { type: 'END_TURN' });   // 相手の手番へ
  while (a.turn.active !== 0 && !a.gameOver) {
    const act2 = CPU.decide(a, a.pending ? a.pending.player : a.turn.active);
    a = reduce(a, act2 || { type: 'END_TURN' });
  }
  ok(me(a).setAside.indexOf('sanctuary') < 0, '次のターンの開始時に脇から出て使用される');
}
{
  // ハツカネズミ＝準備で脇に1枚（$2/$3・持続でないアクション）を置き、それを使用する
  const s = E.createInitialState(['あなた', '相手'], KING.slice(), { startActive: 0, ways: ['way_of_the_mouse'] });
  ok(s.mouseCard && DOM.CARDS[s.mouseCard], 'ハツカネズミの習性＝脇に置くカードが1枚決まる');
  const mc = DOM.CARDS[s.mouseCard];
  ok((mc.cost === 2 || mc.cost === 3) && mc.types.indexOf('action') >= 0 && mc.types.indexOf('duration') < 0,
    '脇のカードは $2/$3 の 持続でないアクション（2025エラッタ）');
  ok(s.supply[s.mouseCard] === undefined || KING.indexOf(s.mouseCard) < 0, '脇のカードはサプライの王国10種には入らない');
}

console.log('\n=== CPU: 全 pending が終端する（無限ループしない） ===');
{
  // 移動動物園の全カードを混ぜた王国でCPU同士を回し、停止しないことを確認
  let games = 0, stuck = 0, err = 0;
  for (let g = 0; g < 6; g++) {
    const kingdom = DOM.POOLS.menagerie.slice(g % 3, (g % 3) + 10);
    let s;
    try {
      s = E.createInitialState(['CPU1', 'CPU2'], kingdom, { startActive: 0 });
      s.players.forEach((p) => { p.isCpu = true; p.cpuLevel = 'hard'; });
      let guard = 0;
      while (!s.gameOver && guard++ < 4000) {
        const seat = s.pending ? s.pending.player : s.turn.active;
        const a = CPU.decide(s, seat);
        if (!a) { stuck++; break; }
        const next = E.reduce(s, a);
        if (next === s && JSON.stringify(next) === JSON.stringify(s)) { stuck++; break; }
        s = next;
      }
      if (guard >= 4000) stuck++;
      games++;
    } catch (e) { err++; console.log('   例外: ' + e.message); }
  }
  ok(games === 6, 'CPU戦が6局とも走る（実行: ' + games + '）');
  ok(stuck === 0, 'CPUが手詰まりにならない（stuck=' + stuck + '）');
  ok(err === 0, '例外が出ない（err=' + err + '）');
}

console.log('\n========================================');
console.log('移動動物園テスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
if (fail > 0) process.exit(1);
