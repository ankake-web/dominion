/* 暗黒時代（Dark Ages）ゲームロジックの検証（Node 単体実行）
   使い方: node test/darkages.test.js
   対象: 基盤機構（混合山=廃墟/騎士・非サプライ=戦利品/狂人/傭兵・避難所・封土VP）／
         経路別 on-trash（城塞×礼拝堂・狂信者×死の荷車・封土×騎士・地下墓所/狩場/従者/ネズミ/サー・ヴァンダー）／
         カード効果56枚の主要経路（アタック/命令/交換/財宝2回/騎士アタック）／CPU通し・カード保存則 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sandbox = { window: {}, Math: Math, JSON: JSON, console: console };
vm.createContext(sandbox);
let seed = 20260705;
sandbox.Math.random = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function load(f) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f }); }
load('js/cards.js'); load('js/engine.js'); load('js/cpu.js');
const DOM = sandbox.window.DOM, E = DOM.engine, CPU = DOM.cpu;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ FAIL: ' + msg); } }
function count(arr, id) { return (arr || []).filter((c) => c === id).length; }
const reduce = (s, a) => E.reduce(s, a);
function mk(kingdom, opts) { return E.createInitialState(['A', 'B'], kingdom, Object.assign({ startActive: 0 }, opts || {})); }
// 手番プレイヤー(席0)の手札/山札を設定し、行動フェーズにする
function setup(kingdom, hand, deck, opts) {
  const s = mk(kingdom, opts);
  s.players[0].hand = hand.slice();
  s.players[0].deck = (deck || []).slice();
  s.players[0].discard = [];
  if (opts && opts.p1hand) s.players[1].hand = opts.p1hand.slice();
  if (opts && opts.p1deck) s.players[1].deck = opts.p1deck.slice();
  if (opts && opts.p1discard) s.players[1].discard = opts.p1discard.slice();
  s.turn.phase = 'action'; s.turn.actions = 1; s.turn.buys = 1; s.turn.coins = 0;
  return s;
}
function play(s, card) { return reduce(s, { type: 'PLAY_ACTION', card }); }
function drive(s, max) { let g = 0; while (s.pending && g++ < (max || 80)) s = reduce(s, CPU.decide(s)); return s; }
const ZONES = ['deck', 'hand', 'discard', 'inPlay', 'durationCards', 'setAside', 'islandMat', 'nativeVillageMat', 'princes'];
function tally(s) { const t = {}; const a = (id) => { if (id != null) t[id] = (t[id] || 0) + 1; }; Object.keys(s.supply).forEach((id) => { if (id === 'ruins' || id === 'knights') return; const n = s.supply[id] | 0; for (let i = 0; i < n; i++) a(id); }); (s.ruins || []).forEach(a); (s.knights || []).forEach(a); (s.trash || []).forEach(a); (s.blackMarket || []).forEach(a); s.players.forEach((p) => ZONES.forEach((z) => (p[z] || []).forEach(a))); if (s.turn) { (s.turn.possessionGains || []).forEach(a); (s.turn.possessionTrash || []).forEach(a); } return t; }
function tdiff(a, b) { const ks = new Set([...Object.keys(a), ...Object.keys(b)]); const d = []; ks.forEach((k) => { if ((a[k] || 0) !== (b[k] || 0)) d.push(k + ':' + (a[k] || 0) + '→' + (b[k] || 0)); }); return d; }

const LOOTER_K = ['marauder', 'cultist', 'death_cart']; // 廃墟山を使うカード

/* ============ CARD_SET 昇格 ============ */
console.log('=== 暗黒時代: CARD_SET 昇格 ===');
{
  ok(DOM.CARD_SETS.some((x) => x.id === 'darkages' && x.kingdom.length === 10), 'darkages 固定セットが10種で存在');
  ok(DOM.CARD_SETS.some((x) => x.id === 'random-darkages' && (x.randomFrom || []).indexOf('darkages') >= 0), 'random-darkages が存在');
  ok(DOM.KINGDOM_DARKAGES.every((id) => DOM.POOLS.darkages.includes(id)) && DOM.KINGDOM_DARKAGES.length === 10, '固定10種は全て darkages プール内');
  // 固定セット＝避難所ON・random系＝避難所OFF（王国内容で自動判定）
  const sf = mk(DOM.kingdomForSet('darkages'));
  ok(count([].concat(sf.players[0].deck, sf.players[0].hand), 'hovel') === 1 && count([].concat(sf.players[0].deck, sf.players[0].hand), 'estate') === 0, '暗黒時代セット: 避難所ON（納屋在・開始屋敷なし）');
  const rf = mk(['squire', 'hermit', 'urchin', 'ironmonger', 'marauder', 'catacombs', 'counterfeit', 'cultist', 'graverobber', 'mystic']);
  ok(count([].concat(rf.players[0].deck, rf.players[0].hand), 'estate') === 3, 'random系darkages王国: 避難所OFF（開始屋敷3枚）');
}

/* ============ 基盤機構 ============ */
console.log('=== 暗黒時代: 基盤機構（混合山/非サプライ/避難所/封土VP）===');
{
  // 騎士＝混合山（supply.knights=10 ＋ state.knights=実カード10枚）
  const s = mk(['knights', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'workshop']);
  ok(s.supply.knights === 10 && Array.isArray(s.knights) && s.knights.length === 10, '騎士: supply.knights=10 かつ state.knights 実カード10枚');
  ok(s.knights.every((id) => DOM.POOLS.knights.includes(id)) && new Set(s.knights).size === 10, '騎士: 10種すべて別カード');
  ok(E.cardCost(s, 'knights') === DOM.CARDS[s.knights[0]].cost, '騎士: 山コスト=一番上の騎士のコスト');
  // 廃墟＝Looter があれば state.ruins 配列（supply キーは持たない）
  const s2 = mk(['marauder', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'workshop']);
  ok(Array.isArray(s2.ruins) && s2.ruins.length === 10 && s2.supply.ruins == null, '廃墟(2人): state.ruins=10枚・supply.ruins なし');
  ok(!E.canBuyCard(s2, 0, 'ruins'), '廃墟は購入できない');
  ok(s2.supply.spoils === 15, '略奪者: 戦利品15枚（非サプライ）');
  // 非サプライは3山終了/購入/汎用獲得に数えない
  ok(DOM.CARDS.spoils && DOM.CARDS.madman && DOM.CARDS.mercenary, '戦利品/狂人/傭兵 カタログ在');
  // Looter 無しなら廃墟山なし
  const s3 = mk(['knights', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'workshop']);
  ok(!Array.isArray(s3.ruins) || s3.ruins.length === 0, 'Looter 無し=廃墟山なし');
  // 避難所＝opts.shelters で開始デッキの屋敷3枚を置換
  const sh = mk(['knights', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'workshop'], { shelters: true });
  const start = [].concat(sh.players[0].deck, sh.players[0].hand);
  ok(count(start, 'estate') === 0 && count(start, 'hovel') === 1 && count(start, 'necropolis') === 1 && count(start, 'overgrown_estate') === 1, '避難所: 開始デッキ=銅貨7＋納屋/共同墓地/草茂る屋敷');
  ok(sh.supply.estate >= 8, '避難所使用でも屋敷サプライは残る（購入用）');
  const noSh = mk(['knights', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'workshop']);
  ok(count([].concat(noSh.players[0].deck, noSh.players[0].hand), 'estate') === 3, 'shelters OFF=開始デッキに屋敷3枚');
  // 封土VP＝銀貨3枚につき1VP
  const sv = mk(['feodum', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'workshop']);
  sv.players[0].deck = ['feodum', 'silver', 'silver', 'silver', 'silver', 'silver', 'silver', 'silver'];
  sv.players[0].hand = []; sv.players[0].discard = [];
  ok(E.vpOf(sv.players[0]) === 2, '封土VP: 銀貨7枚→2VP（floor(7/3)）');
}

/* ============ 経路別 on-trash（必須）============ */
console.log('=== 暗黒時代: 経路別 on-trash ===');
{
  // 城塞 × 礼拝堂＝廃棄成立するが手札に戻る
  let s = setup(['fortress', 'chapel', 'marauder', 'catacombs', 'hunting_grounds', 'squire', 'rats', 'feodum', 'village', 'smithy'], ['chapel', 'fortress', 'estate', 'estate'], ['copper', 'copper']);
  s = play(s, 'chapel');
  s = reduce(s, { type: 'CHAPEL_RESOLVE', cards: ['fortress', 'estate'] });
  s = drive(s);
  ok(count(s.players[0].hand, 'fortress') === 1 && count(s.trash, 'fortress') === 0, '城塞×礼拝堂: 廃棄したが手札に戻り trash に残らない');
  ok(count(s.trash, 'estate') === 1, '城塞×礼拝堂: 屋敷は通常どおり廃棄');

  // 狂信者 × 死の荷車＝廃棄で+3カード＋死の荷車+$5
  s = setup(['death_cart', 'cultist', 'marauder', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine'], ['death_cart', 'cultist'], ['copper', 'copper', 'copper', 'copper', 'copper']);
  s = play(s, 'death_cart');
  const before = s.players[0].hand.length;
  s = reduce(s, { type: 'DEATH_CART_RESOLVE', mode: 'hand', card: 'cultist' });
  s = drive(s);
  ok(count(s.trash, 'cultist') === 1, '狂信者×死の荷車: 狂信者が trash にある');
  ok(s.players[0].hand.length === before - 1 + 3, '狂信者×死の荷車: on-trash で+3カード（廃棄1枚ぶん減＋3ドロー）');
  ok(s.turn.coins === 5, '死の荷車: 廃棄で+$5');

  // 封土 × 騎士アタック＝被害者の封土が廃棄され銀貨3枚を獲得
  s = setup(['knights', 'feodum', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel'], ['sir_bailey'], ['copper', 'copper'], { p1hand: ['copper', 'copper'], p1deck: ['feodum', 'copper', 'copper'] });
  s = play(s, 'sir_bailey');
  s = drive(s);
  ok(count(s.trash, 'feodum') === 1, '封土×騎士: 封土が廃棄された');
  ok(count(s.players[1].discard, 'silver') === 3, '封土×騎士: 持ち主が銀貨3枚を獲得');

  // 地下墓所 on-trash（礼拝堂で廃棄→安いカード獲得）
  s = setup(['catacombs', 'chapel', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel'], ['chapel', 'catacombs'], ['copper', 'copper']);
  s = play(s, 'chapel');
  s = reduce(s, { type: 'CHAPEL_RESOLVE', cards: ['catacombs'] });
  s = drive(s);
  ok(count(s.trash, 'catacombs') === 1, '地下墓所 on-trash: 地下墓所が trash');
  const gained = s.players[0].discard.length;
  ok(gained >= 1, '地下墓所 on-trash: これより安いカードを1枚獲得（捨て札に）');

  // 狩場 on-trash（礼拝堂で廃棄→公領 or 屋敷3）
  s = setup(['hunting_grounds', 'chapel', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel'], ['chapel', 'hunting_grounds'], ['copper', 'copper']);
  s = play(s, 'chapel');
  s = reduce(s, { type: 'CHAPEL_RESOLVE', cards: ['hunting_grounds'] });
  s = drive(s);
  ok(count(s.trash, 'hunting_grounds') === 1 && (count(s.players[0].discard, 'duchy') === 1 || count(s.players[0].discard, 'estate') === 3), '狩場 on-trash: 公領1 or 屋敷3 を獲得');

  // 従者 on-trash（礼拝堂で廃棄→アタックを獲得）
  s = setup(['squire', 'chapel', 'marauder', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine'], ['chapel', 'squire'], ['copper', 'copper']);
  s = play(s, 'chapel');
  s = reduce(s, { type: 'CHAPEL_RESOLVE', cards: ['squire'] });
  s = drive(s);
  ok(count(s.trash, 'squire') === 1 && s.players[0].discard.some((c) => DOM.isType(c, 'attack')), '従者 on-trash: アタックカードを獲得');

  // ネズミ on-trash（+1カード）／サー・ヴァンダー相討ちで金貨
  s = setup(['rats', 'chapel', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel'], ['chapel', 'rats'], ['copper', 'copper', 'copper']);
  s = play(s, 'chapel');
  const hb = s.players[0].hand.length;
  s = reduce(s, { type: 'CHAPEL_RESOLVE', cards: ['rats'] });
  s = drive(s);
  ok(count(s.trash, 'rats') === 1 && s.players[0].hand.length === hb - 1 + 1, 'ネズミ on-trash: +1カード');
}

/* ============ カード効果（Group A/B/C）============ */
console.log('=== 暗黒時代: カード効果 A/B/C ===');
{
  // junk_dealer＝+1カード+1アクション+$1＋廃棄
  let s = setup(['junk_dealer', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'workshop'], ['junk_dealer', 'curse'], ['copper', 'copper']);
  s = play(s, 'junk_dealer');
  s = reduce(s, { type: 'JUNK_DEALER_TRASH', card: 'curse' });
  ok(s.turn.coins === 1 && s.turn.actions === 1 && count(s.trash, 'curse') === 1, 'junk_dealer: +$1 +1アクション＋呪い廃棄');

  // mystic＝当たれば手札へ
  s = setup(['mystic', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'workshop'], ['mystic'], ['gold', 'copper']);
  s = play(s, 'mystic');
  s = reduce(s, { type: 'MYSTIC_NAME', card: 'gold' });
  ok(count(s.players[0].hand, 'gold') === 1 && s.turn.coins === 2, 'mystic: 当てて金貨を手札へ＋$2');

  // catacombs＝上3枚を手札へ
  s = setup(['catacombs', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'workshop'], ['catacombs'], ['gold', 'silver', 'copper', 'estate']);
  s = play(s, 'catacombs');
  s = reduce(s, { type: 'CATACOMBS_RESOLVE', choice: 'hand' });
  ok(count(s.players[0].hand, 'gold') === 1 && count(s.players[0].hand, 'silver') === 1, 'catacombs: 上3枚を手札に加える');

  // graverobber（廃棄置き場から獲得＝山札の上へ）
  s = setup(['graverobber', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'workshop'], ['graverobber'], ['copper']);
  s.trash = ['smithy']; // $4
  s = play(s, 'graverobber');
  s = reduce(s, { type: 'GRAVEROBBER_MODE', mode: 'from_trash' });
  s = reduce(s, { type: 'GRAVEROBBER_FROM_TRASH', card: 'smithy' });
  ok(s.players[0].deck[0] === 'smithy' && count(s.trash, 'smithy') === 0, 'graverobber: 廃棄置き場の$3-6を山札の上に獲得');

  // rebuild＝属州を指名し 公領/屋敷 を格上げ
  s = setup(['rebuild', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'workshop'], ['rebuild'], ['estate', 'copper', 'copper']);
  s = play(s, 'rebuild');
  s = reduce(s, { type: 'REBUILD_NAME', card: 'province' });
  s = drive(s);
  ok(count(s.trash, 'estate') === 1 && s.players[0].discard.some((c) => DOM.isType(c, 'victory')), 'rebuild: 屋敷を廃棄→+$3までの勝利点を獲得');

  // count（後半+$3）
  s = setup(['count', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'workshop'], ['count', 'copper', 'copper'], ['copper']);
  s = play(s, 'count');
  s = reduce(s, { type: 'COUNT_PART1', mode: 'copper' });
  s = reduce(s, { type: 'COUNT_PART2', mode: 'coins' });
  ok(s.turn.coins === 3, 'count: 銅貨獲得→+$3');

  // altar＝廃棄→$5獲得
  s = setup(['altar', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'workshop'], ['altar', 'curse'], ['copper']);
  s = play(s, 'altar');
  s = reduce(s, { type: 'ALTAR_TRASH', card: 'curse' });
  s = reduce(s, { type: 'ALTAR_GAIN', card: 'market' });
  ok(count(s.trash, 'curse') === 1 && count(s.players[0].discard, 'market') === 1, 'altar: 呪い廃棄→コスト5のマーケット獲得');

  // bandit_camp＝戦利品獲得
  s = setup(['bandit_camp', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'workshop'], ['bandit_camp'], ['copper', 'copper']);
  s = play(s, 'bandit_camp');
  ok(count(s.players[0].discard, 'spoils') === 1 && s.turn.actions === 2, 'bandit_camp: 戦利品獲得＋2アクション');

  // death_cart on-gain＝廃墟2枚
  s = setup(LOOTER_K.concat(['village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine']).slice(0, 10), ['village'], ['copper']);
  E.reduce; // noop
  { const before2 = s.players[0].discard.length; const s2 = (function () { const st = s; st.supply.death_cart = st.supply.death_cart || 10; return reduce(st, { type: 'END_ACTION_PHASE' }); })();
    // 直接 gain をテスト: createInitialState 済みの state で gain 経由（BUYで確認）
  }
  s = mk(['death_cart', 'marauder', 'cultist', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine']);
  s.turn.phase = 'buy'; s.turn.coins = 4; s.turn.buys = 1;
  const ruinsBefore = s.ruins.length;
  s = reduce(s, { type: 'BUY', card: 'death_cart' });
  ok(count(s.players[0].discard, 'ruins') === 0 && s.players[0].discard.filter((c) => DOM.isType(c, 'ruins')).length === 2 && s.ruins.length === ruinsBefore - 2, 'death_cart on-gain: 廃墟2枚を獲得');

  // band_of_misfits＝サプライの安いアクションを使う（村＝+2アクション）
  s = setup(['band_of_misfits', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'workshop'], ['band_of_misfits'], ['copper']);
  const vBefore = s.supply.village;
  s = play(s, 'band_of_misfits');
  s = reduce(s, { type: 'BAND_OF_MISFITS_PLAY', card: 'village' });
  ok(s.turn.actions === 2 && s.supply.village === vBefore && count(s.players[0].inPlay, 'village') === 0, 'band_of_misfits: 村をサプライに残したまま使用（+2アクション）');

  // hermit 交換（購入フェイズで無獲得→狂人化）
  s = setup(['hermit', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'workshop'], ['hermit'], ['copper', 'copper', 'copper', 'copper', 'copper']);
  s = play(s, 'hermit');
  s = drive(s); // HERMIT_TRASH(null) → HERMIT_GAIN（≤$3）※アクションフェイズの獲得は交換条件に影響しない
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  const hermSupBefore = s.supply.hermit;
  s = reduce(s, { type: 'END_TURN' });
  ok(s.supply.hermit === hermSupBefore + 1, 'hermit: 購入フェイズ無獲得→隠遁者が山へ戻る（交換）');
  // 交換で狂人が持ち主の捨て札に
  ok(count([].concat(s.players[0].discard, s.players[0].deck, s.players[0].hand), 'madman') === 1, 'hermit: 狂人を1枚得た');

  // procession＝2回使う→廃棄→+$1高いアクション獲得
  s = setup(['procession', 'smithy', 'laboratory', 'village', 'market', 'moat', 'cellar', 'militia', 'mine', 'workshop'], ['procession', 'smithy'], ['copper', 'copper', 'copper', 'copper', 'copper', 'copper']);
  s = play(s, 'procession');
  s = reduce(s, { type: 'PROCESSION_CHOOSE', card: 'smithy' });
  s = drive(s); // 2回目のsmithy→procession_finish→PROCESSION_GAIN
  ok(count(s.trash, 'smithy') === 1, 'procession: smithyを廃棄');
  ok(count(s.players[0].discard, 'laboratory') === 1, 'procession: ちょうど+$1（$5）のlaboratoryを獲得');

  // counterfeit × spoils＝+$6・戦利品は山へ戻り廃棄されない
  s = setup(['bandit_camp', 'counterfeit', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel'], [], []);
  s.turn.phase = 'buy'; s.turn.coins = 0; s.turn.buys = 1;
  s.players[0].hand = ['counterfeit', 'spoils'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'counterfeit' });
  s = reduce(s, { type: 'COUNTERFEIT_PLAY', card: 'spoils' });
  ok(s.turn.coins === 7 && count(s.trash, 'spoils') === 0 && count(s.players[0].inPlay, 'spoils') === 0, 'counterfeit×spoils: +$7・戦利品は山へ戻り（場に残らず）廃棄されない');

  // counterfeit × copper＝銅貨を廃棄
  s = setup(['counterfeit', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'workshop'], [], []);
  s.turn.phase = 'buy'; s.turn.coins = 0; s.turn.buys = 1;
  s.players[0].hand = ['counterfeit', 'copper'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'counterfeit' });
  s = reduce(s, { type: 'COUNTERFEIT_PLAY', card: 'copper' });
  ok(s.turn.coins === 3 && count(s.trash, 'copper') === 1, 'counterfeit×copper: +$3（$1+$1×2）＋銅貨廃棄');
}

/* ============ アタック（Group D）============ */
console.log('=== 暗黒時代: アタック ===');
{
  // marauder＝自分が戦利品・相手が廃墟
  let s = setup(['marauder', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'workshop'], ['marauder'], ['copper'], { p1hand: ['copper', 'copper'] });
  s = play(s, 'marauder');
  s = drive(s);
  ok(count(s.players[0].discard, 'spoils') === 1 && s.players[1].discard.filter((c) => DOM.isType(c, 'ruins')).length === 1, 'marauder: 戦利品獲得＋相手に廃墟');

  // cultist 連鎖（手札に2枚）＝相手に廃墟2枚
  s = setup(['cultist', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'workshop'], ['cultist', 'cultist'], ['copper', 'copper', 'copper', 'copper'], { p1hand: ['copper'] });
  s = play(s, 'cultist');
  s = drive(s);
  ok(s.players[1].discard.filter((c) => DOM.isType(c, 'ruins')).length === 2, 'cultist: 連鎖で相手に廃墟2枚');

  // pillage＝廃棄→戦利品2枚＋相手の手札を捨てさせる
  s = setup(['pillage', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'workshop'], ['pillage'], ['copper'], { p1hand: ['gold', 'copper', 'copper', 'copper', 'estate'] });
  const p1n = s.players[1].hand.length;
  s = play(s, 'pillage');
  s = drive(s);
  ok(count(s.trash, 'pillage') === 1 && count(s.players[0].discard, 'spoils') === 2, 'pillage: 廃棄成立→戦利品2枚');
  ok(s.players[1].hand.length === p1n - 1, 'pillage: 相手が手札1枚を捨てた');

  // rogue（廃棄置き場から獲得）
  s = setup(['rogue', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'workshop'], ['rogue'], ['copper']);
  s.trash = ['market'];
  s = play(s, 'rogue');
  s = drive(s);
  ok(count(s.players[0].discard, 'market') === 1 && count(s.trash, 'market') === 0 && s.turn.coins === 2, 'rogue: +$2＋廃棄置き場の$5を（捨て札に）獲得');

  // rogue（アタック＝相手の$3-6を廃棄）
  s = setup(['rogue', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'workshop'], ['rogue'], ['copper'], { p1deck: ['smithy', 'copper', 'copper'] });
  s.trash = [];
  s = play(s, 'rogue');
  s = drive(s);
  ok(count(s.trash, 'smithy') === 1, 'rogue: 廃棄置き場に$3-6無し→相手の$4を廃棄');

  // urchin → mercenary（別アタックのプレイで浮浪児を廃棄→傭兵）
  s = setup(['urchin', 'cultist', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel'], ['urchin', 'cultist'], ['copper', 'copper', 'copper'], { p1hand: ['copper', 'copper', 'copper', 'copper', 'copper'] });
  s = play(s, 'urchin');
  s = drive(s); // 相手が手札4枚まで捨てる
  s = play(s, 'cultist'); // 別アタック→urchin_trash pending
  s = reduce(s, { type: 'URCHIN_TRASH', trash: true }); // 浮浪児を廃棄→傭兵
  s = drive(s); // cultist 解決
  ok(count(s.trash, 'urchin') === 1 && count([].concat(s.players[0].discard, s.players[0].deck, s.players[0].hand), 'mercenary') === 1, 'urchin: 別アタックで浮浪児を廃棄→傭兵を獲得');

  // mercenary＝2枚廃棄で+2カード+$2＋相手手札3枚まで
  s = setup(['urchin', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'workshop'], ['mercenary', 'copper', 'copper'], ['gold', 'gold', 'silver'], { p1hand: ['copper', 'copper', 'copper', 'copper', 'copper'] });
  s.supply.mercenary = 10;
  s = play(s, 'mercenary');
  s = reduce(s, { type: 'MERCENARY_TRASH', cards: ['copper', 'copper'] });
  s = drive(s);
  ok(count(s.trash, 'copper') === 2 && s.turn.coins === 2, 'mercenary: 2枚廃棄→+$2');
  ok(s.players[1].hand.length === 3, 'mercenary: 相手が手札3枚まで捨てた');
}

/* ============ 騎士（Group E）============ */
console.log('=== 暗黒時代: 騎士（混合山アタック）===');
{
  function knightGame(knightId, setupFn) {
    let s = mk(['knights', 'feodum', 'moat', 'village', 'smithy', 'market', 'cellar', 'militia', 'mine', 'remodel']);
    s.players[0].hand = [knightId]; s.players[0].deck = ['copper', 'copper', 'copper', 'copper'];
    s.turn.phase = 'action'; s.turn.actions = 1; s.turn.buys = 1; s.turn.coins = 0;
    setupFn(s);
    s = play(s, knightId);
    return drive(s);
  }
  // 単独$3-6（自動廃棄）
  let s = knightGame('sir_bailey', (st) => { st.players[1].deck = ['market', 'copper', 'copper']; });
  ok(count(s.trash, 'market') === 1, '騎士: 相手の$5(market)を廃棄');
  // 相討ち＝相手の騎士を廃棄すると攻撃騎士も廃棄
  s = knightGame('sir_destry', (st) => { st.players[1].deck = ['dame_molly', 'copper', 'copper']; });
  ok(count(s.trash, 'dame_molly') === 1 && count(s.trash, 'sir_destry') === 1, '騎士: 相手の騎士を廃棄→攻撃騎士も廃棄（相討ち）');
  // sir_vander 相討ちで金貨
  s = knightGame('sir_vander', (st) => { st.players[1].deck = ['dame_molly', 'copper', 'copper']; });
  ok(count(s.trash, 'sir_vander') === 1 && count(s.players[0].discard, 'gold') === 1, 'sir_vander: 相討ちで廃棄→持ち主が金貨');
  // dame_natalie＝獲得→アタック
  s = knightGame('dame_natalie', (st) => { st.players[1].deck = ['market', 'copper', 'copper']; });
  ok(count(s.trash, 'market') === 1 && s.players[0].discard.length >= 1, 'dame_natalie: ≤$3を獲得しつつアタック');
  // sir_michael＝相手手札3枚まで捨て→アタック
  s = knightGame('sir_michael', (st) => { st.players[1].hand = ['copper', 'copper', 'estate', 'estate', 'silver', 'village']; st.players[1].deck = ['market', 'copper', 'copper']; });
  ok(s.players[1].hand.length === 3 && count(s.trash, 'market') === 1, 'sir_michael: 手札3枚まで捨て→アタックで廃棄');
  // dame_anna＝手札2枚廃棄→アタック
  s = knightGame('dame_anna', (st) => { st.players[0].hand = ['dame_anna', 'estate', 'curse']; st.players[1].deck = ['market', 'copper', 'copper']; });
  ok(count(s.trash, 'estate') === 1 && count(s.trash, 'curse') === 1 && count(s.trash, 'market') === 1, 'dame_anna: 手札2枚廃棄＋アタックで廃棄');
  // 堀で免疫
  s = knightGame('dame_sylvia', (st) => { st.players[1].hand = ['moat', 'copper']; st.players[1].deck = ['market', 'copper']; });
  ok(count(s.trash, 'market') === 0 && s.turn.coins === 2, '騎士: 堀で相手は完全免疫（廃棄されない）');
}

/* ============ 敵対レビュー確定バグの回帰 ============ */
console.log('=== 暗黒時代: リアクション/命令/財宝の回帰（敵対レビュー修正）===');
{
  // 青空市場 on-trashリアクション：自分のカードが廃棄されたら手札の青空市場を捨てて金貨を獲得
  let s = setup(['market_square', 'chapel', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel'], ['chapel', 'market_square', 'copper'], ['copper', 'copper']);
  s = play(s, 'chapel');
  s = reduce(s, { type: 'CHAPEL_RESOLVE', cards: ['copper'] });
  s = drive(s);
  ok(count(s.players[0].discard, 'market_square') === 1 && count(s.players[0].discard, 'gold') === 1, '青空市場: 廃棄に反応して捨て→金貨を獲得');

  // 納屋 on-gainリアクション：勝利点を購入したら手札の納屋を廃棄できる
  s = setup(['catacombs', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'armory'], [], []);
  s.players[0].hand = ['hovel']; s.turn.phase = 'buy'; s.turn.coins = 2; s.turn.buys = 1;
  s = reduce(s, { type: 'BUY', card: 'estate' });
  s = drive(s);
  ok(count(s.trash, 'hovel') === 1 && count(s.players[0].hand, 'hovel') === 0, '納屋: 勝利点獲得に反応して廃棄（圧縮）');

  // 物乞い アタックリアクション：被弾時に捨てて銀貨2枚（免疫にはならない）
  s = setup(['market_square', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'armory'], ['militia'], ['copper'], { p1hand: ['beggar', 'copper', 'copper', 'copper', 'estate'] });
  s = play(s, 'militia');
  s = drive(s);
  ok(count(s.players[1].discard, 'beggar') === 1 && count(s.players[1].discard, 'silver') + count(s.players[1].deck, 'silver') === 2, '物乞い: 被弾時に捨てて銀貨2枚（1枚は山札の上）');
  ok(s.players[1].hand.length === 3, '物乞い: 免疫にはならず民兵の手札削りは受ける');

  // はみだし者：騎士の混合山は対象に出さない（sir_martinが一番上でも）
  s = mk(['band_of_misfits', 'knights', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel']);
  s.knights.unshift('sir_martin'); s.knights = ['sir_martin'].concat(s.knights.filter((c, i) => c !== 'sir_martin' || i > 0)); // 先頭を sir_martin に
  ok(!E.bandOfMisfitsTargets(s).includes('knights'), 'はみだし者: 騎士の山は対象外（無効果の死に選択肢を出さない）');

  // 偽造通貨×偽造通貨：2回目の+1購入も付く（合計+2購入ぶん）
  s = setup(['counterfeit', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'armory'], [], []);
  s.turn.phase = 'buy'; s.turn.coins = 0; s.turn.buys = 1;
  s.players[0].hand = ['counterfeit', 'counterfeit'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'counterfeit' });
  s = reduce(s, { type: 'COUNTERFEIT_PLAY', card: 'counterfeit' });
  s = drive(s);
  ok(s.turn.buys === 4, '偽造通貨×偽造通貨: +購入が正しく3つ（開始1＋外+1＋内1回目+1＋内2回目+1）');

  // 傭兵：手札1枚でも廃棄選択できる（効果は不発）
  s = setup(['urchin', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'armory'], ['mercenary', 'copper'], ['gold', 'gold']);
  s.supply.mercenary = 10;
  s = play(s, 'mercenary'); // 手札は copper 1枚
  s = reduce(s, { type: 'MERCENARY_TRASH', cards: ['copper'] });
  ok(count(s.trash, 'copper') === 1 && s.turn.coins === 0 && s.players[0].hand.length === 0, '傭兵: 1枚だけ廃棄（効果は不発＝+2カード+$2なし）');

  // はみだし者で使った死の荷車の「自身を廃棄」は不発（場の本物の死の荷車を巻き込まない）
  s = setup(['band_of_misfits', 'death_cart', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel'], ['band_of_misfits', 'death_cart'], ['copper']);
  s.turn.actions = 2;
  s = play(s, 'death_cart');
  s = reduce(s, { type: 'DEATH_CART_RESOLVE', mode: 'none' }); // 本物の死の荷車を場に残す
  s = play(s, 'band_of_misfits');
  s = reduce(s, { type: 'BAND_OF_MISFITS_PLAY', card: 'death_cart' });
  s = reduce(s, { type: 'DEATH_CART_RESOLVE', mode: 'this' }); // 自身廃棄（はみだし者コピー）
  ok(count(s.players[0].inPlay, 'death_cart') === 1 && count(s.trash, 'death_cart') === 0 && s.turn.coins === 0, 'はみだし者×死の荷車: 自身廃棄は不発（本物を巻き込まず+$5も出ない）');
}

/* ============ CPU通し・カード保存則 ============ */
console.log('=== 暗黒時代: CPU通し・カード保存則 ===');
{
  const KINGDOMS = [
    ['knights', 'marauder', 'cultist', 'death_cart', 'fortress', 'rats', 'catacombs', 'count', 'hermit', 'procession'],
    ['pillage', 'rogue', 'urchin', 'graverobber', 'junk_dealer', 'altar', 'mystic', 'band_of_misfits', 'feodum', 'hunting_grounds'],
    ['marauder', 'bandit_camp', 'counterfeit', 'sage', 'forager', 'storeroom', 'scavenger', 'ironmonger', 'squire', 'beggar'],
  ];
  let allOk = true;
  for (let ki = 0; ki < KINGDOMS.length; ki++) {
    for (let g = 0; g < 8; g++) {
      const players = [{ name: 'A', isCpu: true, level: 'hard' }, { name: 'B', isCpu: true, level: g % 2 ? 'normal' : 'easy' }];
      let s = E.createInitialState(players, KINGDOMS[ki].slice(), { startActive: 0, shelters: ki === 0 });
      const init = tally(s); let step = 0; let bad = false;
      while (!s.gameOver && step++ < 6000) {
        s = reduce(s, CPU.decide(s));
        if (s.pending) continue;
        const d = tdiff(init, tally(s));
        if (d.length) { bad = true; console.log('    保存則 k' + ki + ' g' + g + ' step' + step + ': ' + d.join(' ')); break; }
      }
      if (bad || (!s.gameOver && step >= 6000)) { allOk = false; if (!s.gameOver) console.log('    未終局 k' + ki + ' g' + g); }
    }
  }
  ok(allOk, '暗黒時代 CPU通し 24戦すべて保存則・終局');
}

console.log('========================================');
console.log('暗黒時代テスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
if (fail > 0) process.exit(1);
