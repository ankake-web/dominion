/* 暗黒時代（Dark Ages）ゲームロジックの検証（Node 単体実行）
   使い方: node test/darkages.test.js
   対象: 基盤機構（混合山=廃墟/騎士・非サプライ=略奪品/狂人/傭兵・避難所・封土VP）／
         経路別 on-trash（城塞×礼拝堂・狂信者×死の荷車・封土×騎士・地下墓所/狩場/寵臣/ネズミ/サー・ヴァンデル）／
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
// 混合山（廃墟/騎士/城＋同盟の分割山6組）は engine の MIXED_PILE_KEYS が正本＝新しい山を足しても二重計上しない。
const MIXKEYS = (DOM.engine && DOM.engine.MIXED_PILE_KEYS) || ['ruins', 'knights', 'castles'];
function tally(s) { const t = {}; const a = (id) => { if (id != null) t[id] = (t[id] || 0) + 1; }; Object.keys(s.supply).forEach((id) => { if (MIXKEYS.indexOf(id) >= 0) return; const n = s.supply[id] | 0; for (let i = 0; i < n; i++) a(id); }); MIXKEYS.forEach((k) => (s[k] || []).forEach(a)); (s.trash || []).forEach(a); (s.blackMarket || []).forEach(a); s.players.forEach((p) => ZONES.forEach((z) => (p[z] || []).forEach(a))); if (s.turn) { (s.turn.possessionGains || []).forEach(a); (s.turn.possessionTrash || []).forEach(a); } return t; }
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
  ok(s2.supply.spoils === 15, '襲撃者: 略奪品15枚（非サプライ）');
  // 非サプライは3山終了/購入/汎用獲得に数えない
  ok(DOM.CARDS.spoils && DOM.CARDS.madman && DOM.CARDS.mercenary, '略奪品/狂人/傭兵 カタログ在');
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

  // 寵臣 on-trash（礼拝堂で廃棄→アタックを獲得）
  s = setup(['squire', 'chapel', 'marauder', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine'], ['chapel', 'squire'], ['copper', 'copper']);
  s = play(s, 'chapel');
  s = reduce(s, { type: 'CHAPEL_RESOLVE', cards: ['squire'] });
  s = drive(s);
  ok(count(s.trash, 'squire') === 1 && s.players[0].discard.some((c) => DOM.isType(c, 'attack')), '従者 on-trash: アタックカードを獲得');

  // ネズミ on-trash（+1カード）／サー・ヴァンデル相討ちで金貨
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

  // bandit_camp＝略奪品獲得
  s = setup(['bandit_camp', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'workshop'], ['bandit_camp'], ['copper', 'copper']);
  s = play(s, 'bandit_camp');
  ok(count(s.players[0].discard, 'spoils') === 1 && s.turn.actions === 2, 'bandit_camp: 略奪品獲得＋2アクション');

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

  // 【回帰】命令カードの再演では「1回目に選んだカード」を必ずもう一度使う（公式ルーリング）。
  //   出荷 darkages セットは band_of_misfits と procession が同居する＝到達可能だった。
  s = setup(['band_of_misfits', 'procession', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel'],
    ['procession', 'band_of_misfits'], ['copper', 'copper', 'copper', 'copper']);
  s = play(s, 'procession');
  s = reduce(s, { type: 'PROCESSION_CHOOSE', card: 'band_of_misfits' });
  ok(s.pending && s.pending.type === 'band_of_misfits', '行進×はみだし者：1回目の対象選択が出る');
  const aBefore = s.turn.actions;
  s = reduce(s, { type: 'BAND_OF_MISFITS_PLAY', card: 'village' });
  ok(!s.pending || s.pending.type !== 'band_of_misfits', '行進の2回目は対象を選び直せない（同じ村を使う）');
  ok(s.turn.actions === aBefore + 4, '村を2回使った（+2アクション×2）');
  s = drive(s);

  // 【回帰】玉座の間×はみだし者も同様（再演では同じカード）
  s = setup(['band_of_misfits', 'throne_room', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel'],
    ['throne_room', 'band_of_misfits'], ['copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'copper']);
  s = play(s, 'throne_room');
  s = reduce(s, { type: 'THRONE_CHOOSE', card: 'band_of_misfits' });
  s = reduce(s, { type: 'BAND_OF_MISFITS_PLAY', card: 'smithy' });
  ok(!s.pending, '玉座×はみだし者：2回目は選び直せない');
  ok(s.players[0].hand.length === 6, '鍛冶屋を2回使った（+3カード×2）');

  // 【回帰】偽造通貨の2回目は「効果を丸ごと」再適用する（+購入等の副次効果を落とさない）＋2回のプレイ後に廃棄。
  s = setup(['counterfeit', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'workshop'],
    ['counterfeit', 'copper'], ['copper']);
  s = reduce(s, { type: 'END_ACTION_PHASE' });
  const buysB = s.turn.buys;
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'counterfeit' });
  ok(s.pending && s.pending.type === 'counterfeit', '偽造通貨：2回使う財宝を選ぶ');
  s = reduce(s, { type: 'COUNTERFEIT_PLAY', card: 'copper' });
  ok(!s.pending && s.turn.coins === 3, '偽造通貨$1＋銅貨$1×2＝$3');
  ok(s.turn.buys === buysB + 1, '偽造通貨の+1購入');
  ok(count(s.trash, 'copper') === 1 && count(s.players[0].inPlay, 'copper') === 0, '2回使った後に銅貨を廃棄');

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

  // counterfeit × spoils＝+$6・略奪品は山へ戻り廃棄されない
  s = setup(['bandit_camp', 'counterfeit', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel'], [], []);
  s.turn.phase = 'buy'; s.turn.coins = 0; s.turn.buys = 1;
  s.players[0].hand = ['counterfeit', 'spoils'];
  s = reduce(s, { type: 'PLAY_TREASURE', card: 'counterfeit' });
  s = reduce(s, { type: 'COUNTERFEIT_PLAY', card: 'spoils' });
  ok(s.turn.coins === 7 && count(s.trash, 'spoils') === 0 && count(s.players[0].inPlay, 'spoils') === 0, 'counterfeit×spoils: +$7・略奪品は山へ戻り（場に残らず）廃棄されない');

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
  // marauder＝自分が略奪品・相手が廃墟
  let s = setup(['marauder', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'workshop'], ['marauder'], ['copper'], { p1hand: ['copper', 'copper'] });
  s = play(s, 'marauder');
  s = drive(s);
  ok(count(s.players[0].discard, 'spoils') === 1 && s.players[1].discard.filter((c) => DOM.isType(c, 'ruins')).length === 1, 'marauder: 略奪品獲得＋相手に廃墟');

  // cultist 連鎖（手札に2枚）＝相手に廃墟2枚
  s = setup(['cultist', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'workshop'], ['cultist', 'cultist'], ['copper', 'copper', 'copper', 'copper'], { p1hand: ['copper'] });
  s = play(s, 'cultist');
  s = drive(s);
  ok(s.players[1].discard.filter((c) => DOM.isType(c, 'ruins')).length === 2, 'cultist: 連鎖で相手に廃墟2枚');

  // pillage＝廃棄→略奪品2枚＋相手の手札を捨てさせる
  s = setup(['pillage', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel', 'workshop'], ['pillage'], ['copper'], { p1hand: ['gold', 'copper', 'copper', 'copper', 'estate'] });
  const p1n = s.players[1].hand.length;
  s = play(s, 'pillage');
  s = drive(s);
  ok(count(s.trash, 'pillage') === 1 && count(s.players[0].discard, 'spoils') === 2, 'pillage: 廃棄成立→略奪品2枚');
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
  ok(s.pending && s.pending.type === 'death_cart' && s.pending.self === false, 'はみだし者×死の荷車: pending.self=false（「これ」は廃棄できない）');
  s = reduce(s, { type: 'DEATH_CART_RESOLVE', mode: 'this' }); // 自身廃棄（はみだし者コピー）
  ok(count(s.players[0].inPlay, 'death_cart') === 1 && count(s.trash, 'death_cart') === 0 && s.turn.coins === 0, 'はみだし者×死の荷車: 自身廃棄は不発（本物を巻き込まず+$5も出ない）');
  ok(count(s.trash, 'band_of_misfits') === 0 && count(s.players[0].inPlay, 'band_of_misfits') === 1, 'はみだし者×死の荷車: はみだし者も廃棄されない（E8＝命令カードは身代わりに動かない）');
}

/* ============ E8：命令（Command）＝プレイした札は動かない（2019エラッタ） ============ */
console.log('=== E8: はみだし者（サプライに残したまま使用） ===');
{
  // 「手札のアクションを廃棄して +$5」は場所が明示された移動なので生きている（公式）。
  let s = setup(['band_of_misfits', 'death_cart', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel'], ['band_of_misfits', 'village'], ['copper']);
  s = play(s, 'band_of_misfits');
  s = reduce(s, { type: 'BAND_OF_MISFITS_PLAY', card: 'death_cart' });
  s = reduce(s, { type: 'DEATH_CART_RESOLVE', mode: 'hand', card: 'village' });
  ok(s.turn.coins === 5 && count(s.trash, 'village') === 1, 'はみだし者×死の荷車: 手札のアクションを廃棄すれば +$5');
  ok(count(s.players[0].inPlay, 'band_of_misfits') === 1, 'はみだし者は場に残る');
}
{ // CPU：命令経由の死の荷車で無限ループしない（手札にアクションが無くても終端）
  let s = setup(['band_of_misfits', 'death_cart', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel'], ['band_of_misfits'], ['copper']);
  s = play(s, 'band_of_misfits');
  s = reduce(s, { type: 'BAND_OF_MISFITS_PLAY', card: 'death_cart' });
  let g = 0; while (s.pending && g++ < 20) s = reduce(s, CPU.decide(s, 0));
  ok(!s.pending, 'CPU: 命令経由の死の荷車で pending を閉じる（終端保証）');
  ok(count(s.trash, 'band_of_misfits') === 0, 'CPU: はみだし者を廃棄しない');
}
{ // はみだし者×隠遁者＝場に隠遁者は居ないので狂人と交換されない（片付け時の「場から捨てるとき」トリガー）
  let s = setup(['band_of_misfits', 'hermit', 'village', 'smithy', 'market', 'moat', 'cellar', 'militia', 'mine', 'remodel'], ['band_of_misfits'], ['copper']);
  const hermit0 = s.supply.hermit, madman0 = s.supply.madman;
  s = play(s, 'band_of_misfits');
  s = reduce(s, { type: 'BAND_OF_MISFITS_PLAY', card: 'hermit' });
  let g = 0; while (s.pending && g++ < 20) s = reduce(s, CPU.decide(s, 0));
  s = reduce(s, { type: 'END_ACTION_PHASE' }); s = reduce(s, { type: 'END_TURN' });
  ok(s.supply.hermit === hermit0 && s.supply.madman === madman0, 'はみだし者×隠遁者: 狂人と交換されない（場に隠遁者は居ない）');
  ok(count(s.players[0].discard, 'madman') === 0, '狂人を獲得しない');
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

// ==========================================================================
// §0-43 敵対レビュー②＝暗黒時代（騎士の捨て札トリガー／コスト$3〜$6は3成分）
// ==========================================================================
console.log('=== §0-43: 騎士の捨て札トリガー／コスト判定 ===');
{
  /* 公式FAQ＝`each other player reveals the top two cards of their deck, trashes one of them that they
     choose that costs from [$3] to [$6], and **discards the rest**.` ＝「捨てる」は本物の捨て札。
     構造が同型の枢機卿(cardinal)は最初から triggerOnDiscard を呼んでいた＝engine 内で不整合だった。 */
  let s = mk(['knights', 'tunnel', 'village', 'smithy', 'market', 'moat', 'cellar', 'workshop', 'laboratory', 'festival']);
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  const kn = s.knights[0];
  s.players[0].hand = [kn]; s.players[0].deck = ['copper', 'copper'];
  s.players[1].deck = ['tunnel', 'silver']; // 両方 $3 ＝被害者が選ぶ（銀貨を廃棄させて坑道は捨てさせる）
  s.turn.actions = 1;
  s = E.reduce(s, { type: 'PLAY_ACTION', card: kn });
  let g = 0;
  while (s.pending && g++ < 8) {
    const pd = s.pending;
    if (pd.type === 'knight' && pd.stage === 'pick') s = E.reduce(s, { type: 'KNIGHT_PICK', card: 'silver' });
    else if (pd.type === 'knight' && pd.stage === 'react') s = E.reduce(s, { type: 'KNIGHT_REACT' });
    else break;
  }
  ok(s.players[1].discard.indexOf('gold') >= 0, '騎士：公開して捨てた坑道が誘発する（捨て札トリガー）');
}
{
  // コスト$3〜$6 は3成分（公式FAQ＝`Cards with [P] or [D] in the cost do not cost from [$3] to [$6].`）
  let s = mk(['knights', 'fortune', 'village', 'smithy', 'market', 'moat', 'cellar', 'workshop', 'laboratory', 'festival']);
  s.turn.costReduction = 2; // 橋を2回＝大金($8+負債8)の coin 成分が 6 になる
  ok(!E.costRange3to6(s, 'fortune'), '負債コストのカードは「コスト$3〜$6」ではない（コスト軽減で coin が6でも）');
  ok(E.costRange3to6(s, 'gold') === false || E.costRange3to6(s, 'gold') === true, 'costRange3to6 が engine から使える');
}

// ==========================================================================
// §0-43 アタックのリアクション窓は「影響を受けるか」に関係なく全相手に開く
// ==========================================================================
console.log('=== §0-43: 手札が少なくてもリアクションの窓は開く ===');
{
  /* 公式＝`Beggar`／`Horse Traders`／`Moat` はいずれも
     `When another player **plays an Attack card**, you may first ...` ＝
     その攻撃で自分が影響を受けるかどうかは条件ではない。
     手札枚数で被害者リストを事前に絞ると、その席は窓を**一度も開けない**。 */
  let s = mk(['urchin', 'beggar', 'village', 'smithy', 'market', 'moat', 'cellar', 'workshop', 'laboratory', 'festival']);
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  s.players[0].hand = ['urchin']; s.players[0].deck = ['copper', 'copper'];
  s.players[1].hand = ['beggar', 'copper']; // 手札2枚＝浮浪児（4枚まで捨てる）の影響を受けない
  s.turn.actions = 1;
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'urchin' });
  ok(s.pending && s.pending.player === 1, '浮浪児：手札2枚の相手にも窓が開く');
  const before = s.supply.silver;
  s = E.reduce(s, { type: 'BEGGAR_REACT' });
  ok(before - s.supply.silver === 2, '物乞い：銀貨2枚を獲得できる（旧実装では取り逃していた）');
  ok(s.players[1].deck[0] === 'silver', '物乞い：1枚は山札の上に置く');
}
{
  // 傭兵＝「廃棄するか決める**前**に」相手が反応を決める（公式FAQ）
  let s = mk(['mercenary', 'urchin', 'moat', 'village', 'smithy', 'market', 'cellar', 'workshop', 'laboratory', 'festival']);
  s.supply.mercenary = 10;
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  s.players[0].hand = ['mercenary', 'copper', 'copper']; s.players[0].deck = ['copper', 'copper'];
  s.players[1].hand = ['moat', 'copper', 'estate']; // 手札3枚＝旧実装では窓ゼロ
  s.turn.actions = 1;
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'mercenary' });
  s = E.reduce(s, { type: 'MERCENARY_TRASH', cards: ['copper', 'copper'] });
  ok(s.pending && s.pending.type === 'discard_down' && s.pending.player === 1, '傭兵：手札3枚の相手にも窓が開く');
}

// ==========================================================================
// §0-43 青空市場＝廃棄時効果のドローで手札に来た札にも反応できる（公式）
// ==========================================================================
console.log('=== §0-43: 青空市場 × 狂信者（出荷 darkages 固定セット）===');
{
  /* Other rules clarifications 逐語＝`Market Square **doesn't have to have been in your hand when you trash
     a card**; you could trash Cultist, drawing one or more Market Squares, and still discard them.`
     ＝手札条件は「窓を積むとき」ではなく「解決するとき」に見る。 */
  let s = mk(['cultist', 'market_square', 'chapel', 'village', 'smithy', 'market', 'moat', 'cellar', 'workshop', 'laboratory']);
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  s.players[0].hand = ['chapel', 'cultist'];
  s.players[0].deck = ['market_square', 'copper', 'copper']; // 狂信者の廃棄で +3カード＝青空市場が手札に来る
  s.turn.actions = 1;
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'chapel' });
  s = E.reduce(s, { type: 'CHAPEL_RESOLVE', cards: ['cultist'] });
  ok(s.players[0].hand.indexOf('market_square') >= 0, '狂信者の廃棄で青空市場を引いている');
  ok(s.pending && s.pending.type === 'market_square_react', '青空市場：引いたばかりでも反応の窓が開く');
  const before = s.supply.gold;
  s = E.reduce(s, { type: 'MARKET_SQUARE_REACT', discard: true });
  ok(before - s.supply.gold === 1, '青空市場：金貨1枚を獲得できる');
}
{
  // 逆に、手札に無ければ窓を開かない（解決時の再検査）
  let s = mk(['cultist', 'market_square', 'chapel', 'village', 'smithy', 'market', 'moat', 'cellar', 'workshop', 'laboratory']);
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  s.players[0].hand = ['chapel', 'estate'];
  s.players[0].deck = ['copper', 'copper', 'copper'];
  s.turn.actions = 1;
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'chapel' });
  s = E.reduce(s, { type: 'CHAPEL_RESOLVE', cards: ['estate'] });
  ok(!(s.pending && s.pending.type === 'market_square_react'), '青空市場：手札に無ければ窓を開かない（解決時に再検査）');
}

// ==========================================================================
// §0-43 敵対レビュー④＝暗黒時代（浮浪児／サー・マイケル／盗賊／隠遁者／義賊）
// ==========================================================================
console.log('=== §0-43: 浮浪児・サー・マイケル・盗賊・隠遁者 ===');
{
  // 浮浪児＝場にある**各コピーが独立に**誘発する（公式カード文＝While this is in play）
  let s = mk(['urchin', 'militia', 'village', 'smithy', 'market', 'moat', 'cellar', 'workshop', 'laboratory', 'festival']);
  s.supply.mercenary = 10;
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  s.players[0].inPlay = ['urchin', 'urchin'];
  s.players[0].hand = ['militia']; s.players[0].deck = ['copper', 'copper'];
  s.players[1].hand = ['copper', 'copper', 'copper', 'copper', 'copper'];
  s.turn.actions = 1;
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'militia' });
  ok(s.pending && s.pending.type === 'urchin_trash', '浮浪児：別のアタックで窓が開く');
  const m0 = s.supply.mercenary;
  s = E.reduce(s, { type: 'URCHIN_TRASH', trash: true });
  ok(s.pending && s.pending.type === 'urchin_trash', '浮浪児：場に2枚目があればもう一度窓が開く');
  s = E.reduce(s, { type: 'URCHIN_TRASH', trash: true });
  ok(m0 - s.supply.mercenary === 2, '浮浪児：2枚とも廃棄して傭兵2枚（実際 ' + (m0 - s.supply.mercenary) + '枚）');
}
{
  // 浮浪児×命令＝はみだし者がサプライのアタックを使ったときも窓が開く（公式）
  let s = mk(['urchin', 'band_of_misfits', 'militia', 'village', 'smithy', 'market', 'moat', 'cellar', 'laboratory', 'festival']);
  s.supply.mercenary = 10;
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  s.players[0].inPlay = ['urchin'];
  s.players[0].hand = ['band_of_misfits']; s.players[0].deck = ['copper', 'copper'];
  s.players[1].hand = ['copper', 'copper', 'copper', 'copper', 'copper'];
  s.turn.actions = 1;
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'band_of_misfits' });
  s = E.reduce(s, { type: 'BAND_OF_MISFITS_PLAY', card: 'militia' });
  ok(s.pending && s.pending.type === 'urchin_trash', '浮浪児：命令がサプライのアタックを使ったときも窓が開く');
  s = E.reduce(s, { type: 'URCHIN_TRASH', trash: false });
  ok(s.pending && s.pending.type === 'militia', '浮浪児：辞退したら命令の続き（民兵）が解決される');
}
{
  // サー・マイケル＝1枚のアタックなので、捨て札段で堀を公開した席は廃棄段でも免疫
  let s = mk(['knights', 'moat', 'village', 'smithy', 'market', 'cellar', 'workshop', 'laboratory', 'festival', 'militia']);
  const idx = s.knights.indexOf('sir_michael');
  if (idx >= 0) {
    s.knights.splice(idx, 1); s.knights.unshift('sir_michael');
    s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
    s.players[0].hand = ['sir_michael']; s.players[0].deck = ['copper', 'copper'];
    s.players[1].hand = ['moat', 'copper', 'copper', 'copper', 'estate'];
    s.players[1].deck = ['gold', 'gold'];
    s.turn.actions = 1;
    s = E.reduce(s, { type: 'PLAY_ACTION', card: 'sir_michael' });
    s = E.reduce(s, { type: 'MOAT_REVEAL' });
    ok(!(s.pending && s.pending.type === 'knight'), 'サー・マイケル：捨て札段で堀を公開したら廃棄段でも免疫（窓が二度開かない）');
    ok((s.trash || []).indexOf('gold') < 0, 'サー・マイケル：金貨は廃棄されない');
  } else { ok(true, '（この盤面にサー・マイケルが居ない＝スキップ）'); }
}
{
  // 盗賊＝廃棄置き場から獲得する分岐でも「アタックの使用」＝反応窓は開く（公式FAQ）
  let s = mk(['rogue', 'beggar', 'village', 'smithy', 'market', 'moat', 'cellar', 'workshop', 'laboratory', 'festival']);
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  s.trash = ['silver'];
  s.players[0].hand = ['rogue']; s.players[0].deck = ['copper', 'copper'];
  s.players[1].hand = ['beggar', 'copper'];
  s.turn.actions = 1;
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'rogue' });
  ok(s.pending && s.pending.type === 'rogue' && s.pending.stage === 'react' && s.pending.player === 1,
    '盗賊：廃棄置き場から獲得する分岐でも相手に反応窓が開く');
  s = E.reduce(s, { type: 'BEGGAR_REACT' });
  ok(s.players[1].discard.filter((c) => c === 'silver').length + s.players[1].deck.filter((c) => c === 'silver').length === 2,
    '盗賊：誰も攻撃されない分岐でも物乞いが銀貨2枚を得られる');
  s = E.reduce(s, { type: 'ROGUE_REACT' }); // 反応を終える
  ok(s.pending && s.pending.type === 'rogue' && s.pending.stage === 'gain_from_trash',
    '盗賊：反応の後に廃棄置き場からの獲得へ進む');
}
{
  // 義賊＝本物の廃棄を通す（被害者の青空市場が反応できる）
  let s = mk(['noble_brigand', 'market_square', 'village', 'smithy', 'market', 'moat', 'cellar', 'workshop', 'laboratory', 'festival']);
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  s.players[0].hand = ['noble_brigand']; s.players[0].deck = ['copper'];
  s.players[1].hand = ['market_square']; s.players[1].deck = ['gold', 'estate'];
  s.turn.actions = 1;
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'noble_brigand' });
  let g = 0;
  while (s.pending && s.pending.type !== 'market_square_react' && g++ < 6) {
    if (s.pending.type === 'noble_brigand') s = E.reduce(s, { type: 'NOBLE_BRIGAND_PICK', card: null });
    else break;
  }
  ok(s.pending && s.pending.type === 'market_square_react',
    '義賊：本物の廃棄なので被害者の青空市場が反応できる');
  ok(s.players[0].discard.indexOf('gold') >= 0, '義賊：使用者が金貨を回収している');
}

console.log('========================================');
console.log('暗黒時代テスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
if (fail > 0) process.exit(1);
