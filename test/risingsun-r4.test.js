/* 旭日（Rising Sun）R4＝予言(Prophecy) 15種の検証（Node 単体実行）
   使い方: node test/risingsun-r4.test.js
   正本＝docs/research/risingsun_rules.md（第7・8章＋§E「予言はその瞬間に有効になる」）。

   このスイートが構造的に守っていること：
   - **予言の効果は `prophecyActive` で書く**（`hasProphecy` はゲーム開始直後から真＝準備処理専用）。
     ＝どの予言も「発動前は一切効かない」ことを1件ずつ検査する。
   - **誘発点が「後」の予言（偉大な指導者／来寇）は、最後の Sun を取り除いた前兆自身も恩恵を受ける**／
     **「使用前誘発」の豊作は受けない**。この非対称が §E の最重要の一般則。
   - **病は「ちょうど3枚」**（民兵型の `discardDownEnter` 流用は公式違反）。
   - **好機到来はドロー5枚を普通に行う**（手札は空にならない）。
   - **狼狽の2つの効果は完全に独立**（旗を立てて片付けで見る実装は公式違反）。
   - **神風は `delete state.supply[k]`**（`= 0` にすると3山終了が即成立して即死する）。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sandbox = { window: {}, Math: Math, JSON: JSON, console: console };
vm.createContext(sandbox);
let seed = 20260821;
sandbox.Math.random = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function load(f) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f }); }
load('js/cards.js'); load('js/engine.js'); load('js/cpu.js');
const DOM = sandbox.window.DOM, E = DOM.engine;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ FAIL: ' + msg); } }

/* ⚠ **前兆(Omen)が1枚も無い王国では予言が配られない**（`hasOmen` が false＝`createInitialState` が
   prophecy を null にする）。R4 のテスト王国には必ず前兆を1枚入れること（茶屋を先頭に固定）。 */
const K_NONE = ['tea_house', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'mine', 'remodel'];
const KP = ['tea_house', 'poet', 'kitsune', 'river_shrine', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar'];
const mk = (kingdom, n, opts) => E.createInitialState(
  Array.from({ length: n }, (_, i) => ({ name: 'P' + i, isCpu: i > 0 })), kingdom.slice(), opts || {});
// 予言を「発動済み」にした state（Sun を全部取り除いた状態）。
const on = (pr, kingdom, n) => {
  const s = mk((kingdom || KP).slice(0, 10), n || 2, { prophecy: pr, startActive: 0 });
  s.prophecyOn = true; s.sunTokens = 0; s.prophecyOnBy = 0;
  return s;
};
const off = (pr, kingdom, n) => mk((kingdom || KP).slice(0, 10), n || 2, { prophecy: pr, startActive: 0 });
// 選択待ちを CPU で解決しきる（アタックの被害者処理など）。
const drain = (s) => { let g = 0; while (s.pending && g++ < 200) { const a = DOM.cpu.decide(s); if (!a) break; s = E.reduce(s, a); } return s; };

console.log('=== R4 共通：予言は「カード」ではない／発動前は一切効かない ===');
{
  const s = off('bureaucracy');
  ok(!DOM.CARDS.bureaucracy, '予言は DOM.CARDS に入っていない（カードではない）');
  ok(s.prophecy === 'bureaucracy' && s.prophecyOn === false, '配られてはいるが発動していない');
  s.turn.phase = 'buy'; s.turn.coins = 10; s.turn.buys = 1;
  const after = E.reduce(s, { type: 'BUY', card: 'silver' });
  ok(after.players[0].discard.filter((c) => c === 'copper').length === 0, '発動前は効かない');
  ok((DOM.PROPHECIES_RISINGSUN || []).length === 15, '予言は15種');
}

console.log('=== R4: 官僚制（Bureaucracy）===');
{
  let s = on('bureaucracy');
  s.turn.phase = 'buy'; s.turn.coins = 10; s.turn.buys = 2;
  s = E.reduce(s, { type: 'BUY', card: 'silver' });
  ok(s.players[0].discard.filter((c) => c === 'copper').length === 1, 'コスト0でない獲得で銅貨1枚');
  const c0 = s.players[0].discard.filter((c) => c === 'copper').length;
  s = E.reduce(s, { type: 'BUY', card: 'copper' });
  ok(s.players[0].discard.filter((c) => c === 'copper').length === c0 + 1,
    '銅貨($0)の獲得では配らない（コスト0＝対象外。獲得した1枚だけ増える）');
}

console.log('=== R4: 成長（Growth）＝財宝を獲得したとき、それより安いカード1枚を獲得（強制）===');
{
  let s = on('growth');
  s.turn.phase = 'buy'; s.turn.coins = 6; s.turn.buys = 1;
  s = E.reduce(s, { type: 'BUY', card: 'gold' });
  ok(s.pending && s.pending.type === 'growth_gain', '財宝の獲得で窓が開く');
  ok(s.pending.coin === 6, '基準は獲得した財宝のコスト（金貨＝$6）');
  const bad = E.reduce(s, { type: 'GROWTH_GAIN', card: 'gold' });
  ok(bad.pending && bad.pending.type === 'growth_gain', '同コストは受理しない（**厳密に安い**）');
  const good = E.reduce(s, { type: 'GROWTH_GAIN', card: 'silver' });
  ok(good.players[0].discard.indexOf('silver') >= 0, 'より安い財宝を獲得できる');
  /* ⚠ 獲得した銀貨自身がまた財宝＝成長がもう一度誘発する（**連鎖する**）。
     暴走は `triggerOnGain` の `_gainDepth > 6` ガードが止める（公式どおり＝止める必要は無い）。 */
  ok(good.pending && good.pending.type === 'growth_gain' && good.pending.coin === 3,
    '獲得した財宝がまた財宝なら連鎖する（次の基準＝銀貨の $3）');
  const cheap = E.reduce(good, { type: 'GROWTH_GAIN', card: 'copper' });
  ok(cheap.pending == null, '銅貨($0)を獲得すれば連鎖が止まる（$0 より安いカードは無い）');
  let s2 = on('growth');
  s2.turn.phase = 'buy'; s2.turn.coins = 6; s2.turn.buys = 1;
  s2 = E.reduce(s2, { type: 'BUY', card: 'estate' });
  ok(!(s2.pending && s2.pending.type === 'growth_gain'), '財宝でない獲得では窓を開かない');
}

console.log('=== R4: 進歩（Progress）＝獲得したカードを山札の上へ（強制・非対話）===');
{
  let s = on('progress');
  s.turn.phase = 'buy'; s.turn.coins = 3; s.turn.buys = 1;
  const d0 = s.players[0].deck.length;
  s = E.reduce(s, { type: 'BUY', card: 'silver' });
  ok(s.players[0].deck[0] === 'silver' && s.players[0].deck.length === d0 + 1, '獲得したカードが山札の一番上に乗る');
  ok(s.players[0].discard.indexOf('silver') < 0, '捨て札には行かない');
  ok(s.pending == null, '非対話＝窓を開かない');
}

console.log('=== R4: 偉大な指導者（Great Leader）＝アクションを使った「後」に +1アクション ===');
{
  let s = on('great_leader');
  s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['village']; s.players[0].inPlay = [];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'village' });
  ok(s.turn.actions === 3, '村＝1-1（使用）+2（村）+1（指導者）＝3アクション');
  let s2 = off('great_leader');
  s2.turn.phase = 'action'; s2.turn.actions = 1;
  s2.players[0].hand = ['village']; s2.players[0].inPlay = [];
  s2 = E.reduce(s2, { type: 'PLAY_ACTION', card: 'village' });
  ok(s2.turn.actions === 2, '発動前は +1アクションが付かない');
  /* 🛑 公式が名指しした唯一の例外＝雪深い村（このターン以降の +アクション をすべて無視）。
     日本語wiki の逐語＝「1アクション権所持の状態から雪深い村を使用した場合、残りアクション権は**4**」。
     ＝`t.actions += 1` を直書きすると落ちる（`addActions` を通している証明）。 */
  if (DOM.CARDS.snowy_village) {
    let s3 = on('great_leader', ['snowy_village'].concat(K_NONE).slice(0, 10), 2);
    s3.turn.phase = 'action'; s3.turn.actions = 1;
    s3.players[0].hand = ['snowy_village']; s3.players[0].inPlay = []; s3.players[0].deck = ['copper', 'copper'];
    s3 = E.reduce(s3, { type: 'PLAY_ACTION', card: 'snowy_village' });
    ok(s3.turn.actions === 4, '雪深い村＝1-1+4+0（指導者の+1は無視）＝4');
  }
  /* 🛑 最後の Sun を取り除いた前兆**自身も** +1アクションを受ける（公式 Other rules clarifications 逐語＝
     `the Omen that removed the last token will receive +1 Action.`）。
     ＝有効判定を「使用開始時にスナップショット」すると落ちる。 */
  let s4 = off('great_leader');
  s4.sunTokens = 1;
  s4.turn.phase = 'action'; s4.turn.actions = 1;
  s4.players[0].hand = ['tea_house']; s4.players[0].inPlay = []; s4.players[0].deck = ['copper', 'copper'];
  s4 = E.reduce(s4, { type: 'PLAY_ACTION', card: 'tea_house' });
  ok(s4.prophecyOn === true, '茶屋の +1 Sun で予言が有効になった');
  ok(s4.turn.actions === 2, 'その茶屋自身も +1アクションを受ける（1-1+1+1＝2）');
}

console.log('=== R4: 豊作（Good Harvest）＝名前の異なる財宝を初めて使うたび「先に」+1購入 +$1 ===');
{
  let s = on('good_harvest');
  s.turn.phase = 'buy'; s.players[0].hand = ['copper', 'copper', 'silver']; s.players[0].inPlay = [];
  const b0 = s.turn.buys;
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'copper' });
  ok(s.turn.buys === b0 + 1 && s.turn.coins === 2, '銅貨1枚目＝+1購入 +$1（＋銅貨の$1）');
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'copper' });
  ok(s.turn.buys === b0 + 1 && s.turn.coins === 3, '同名の2枚目は誘発しない（名前ごとに1ターン1回）');
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'silver' });
  ok(s.turn.buys === b0 + 2 && s.turn.coins === 6, '名前が違えば誘発する（$1+$1+$2＋豊作$2）');
  /* 🛑 豊作は「**使用前**誘発」なので、最後の Sun を取り除いた前兆自身は受けない（日本語wiki 逐語）。
     ＝偉大な指導者／来寇と**結論が逆**になる非対称。 */
  let s2 = off('good_harvest');
  s2.sunTokens = 1;
  s2.turn.phase = 'action'; s2.turn.actions = 1;
  s2.players[0].hand = ['tea_house']; s2.players[0].inPlay = []; s2.players[0].deck = ['copper', 'copper'];
  const b1 = s2.turn.buys;
  s2 = E.reduce(s2, { type: 'PLAY_ACTION', card: 'tea_house' });
  ok(s2.prophecyOn === true && s2.turn.buys === b1, '起動した前兆自身は豊作を受けない（使用前誘発）');
}

console.log('=== R4: 来寇（Approaching Army）＝準備の11山目＋アタックの後に +$1 ===');
{
  // ① 準備＝11山目。**予言が発動しなくても追加される**（公式逐語）。
  let found = null;
  for (let i = 0; i < 12 && !found; i++) {
    const s = off('approaching_army', K_NONE, 2);
    if (s.armyCard) found = s;
  }
  ok(!!found, '来寇の11山目が立つ');
  if (found) {
    ok(DOM.isType(found.armyCard, 'attack'), '11山目は**アタックの王国カード**（' + found.armyCard + '）');
    ok(found.kingdom.length === 11, '王国が11山になる');
    ok((found.supply[found.armyCard] || 0) > 0, '普通のサプライ山＝購入も獲得もできる');
    ok(found.prophecyOn === false, '**予言が発動していなくても**山は追加されている');
    ok(K_NONE.indexOf(found.armyCard) < 0, '既に王国にあるカードは選ばない');
  }
  // ② +$1＝アタックを使った「後」。
  let s = on('approaching_army', ['militia'].concat(K_NONE).slice(0, 10), 2);
  s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['militia']; s.players[0].inPlay = [];
  s.players[1].hand = ['copper', 'copper', 'copper', 'copper'];
  const c0 = s.turn.coins;
  s = drain(E.reduce(s, { type: 'PLAY_ACTION', card: 'militia' }));
  ok(s.turn.coins === c0 + 2 + 1, '民兵＝+$2 ＋来寇の +$1');
  // ③ アタックでないアクションでは出ない。
  let s2 = on('approaching_army');
  s2.turn.phase = 'action'; s2.turn.actions = 1;
  s2.players[0].hand = ['village']; s2.players[0].inPlay = [];
  const c1 = s2.turn.coins;
  s2 = E.reduce(s2, { type: 'PLAY_ACTION', card: 'village' });
  ok(s2.turn.coins === c1, 'アタックでなければ +$1 は出ない');
  // ④ 最後の Sun を取り除いた前兆自身がアタック（狐）なら +$1 を受ける（誘発点が「後」）。
  let s3 = off('approaching_army');
  s3.sunTokens = 1;
  s3.turn.phase = 'action'; s3.turn.actions = 1;
  s3.players[0].hand = ['kitsune']; s3.players[0].inPlay = [];
  const c2 = s3.turn.coins;
  s3 = E.reduce(s3, { type: 'PLAY_ACTION', card: 'kitsune' });
  s3 = drain(E.reduce(s3, { type: 'KITSUNE_CHOOSE', choices: ['actions', 'silver'] }));
  ok(s3.prophecyOn === true && s3.turn.coins === c2 + 1, '起動した狐自身も +$1 を受ける');
}

console.log('=== R4: 厳冬（Harsh Winter）＝山に負債があれば取る／無ければ2個置く ===');
{
  let s = on('harsh_winter');
  s.turn.phase = 'buy'; s.turn.coins = 10; s.turn.buys = 3;
  s = E.reduce(s, { type: 'BUY', card: 'silver' });
  ok((s.pileDebt || {}).silver === 2, '負債の無い山＝その山に負債2を置く');
  ok((s.players[0].debt || 0) === 0, 'このときプレイヤーは負債を負わない');
  s = E.reduce(s, { type: 'BUY', card: 'silver' });
  ok((s.pileDebt || {}).silver === 0 && (s.players[0].debt || 0) === 2, '次に同じ山から獲得＝山の負債を全部受け取る');
  // 🛑 「あなたのターン」＝相手のターンの獲得では置きも取りもしない（成長と共通化してはいけない）。
  let s2 = on('harsh_winter');
  s2.turn.active = 1;
  E.reduce(s2, { type: 'END_TURN' });
  ok(Object.keys(s2.pileDebt || {}).length === 0, '手番でないプレイヤーの獲得では何も起きない');
}

console.log('=== R4: 神器（Kind Emperor）＝ターン開始時＋最後の Sun を取り除いた瞬間 ===');
{
  // ① ターン開始時にアクション1枚を手札に獲得（コスト上限なし）。
  let s = on('kind_emperor');
  s = drain(E.reduce(s, { type: 'END_ACTION_PHASE' }));
  s = drain(E.reduce(s, { type: 'END_TURN' }));   // 相手の番
  s = drain(E.reduce(s, { type: 'END_ACTION_PHASE' }));
  s = E.reduce(s, { type: 'END_TURN' });          // 自分の番に戻る
  ok(s.pending && s.pending.type === 'kind_emperor_gain', 'ターン開始時に窓が開く');
  if (s.pending && s.pending.type === 'kind_emperor_gain') {
    const h0 = s.players[0].hand.length;
    const g = E.reduce(s, { type: 'KIND_EMPEROR_GAIN', card: 'market' });
    ok(g.players[0].hand.length === h0 + 1 && g.players[0].hand.indexOf('market') >= 0, '**手札に**獲得する');
    ok(g.players[0].discard.indexOf('market') < 0, '捨て札を経由しない');
    const bad = E.reduce(s, { type: 'KIND_EMPEROR_GAIN', card: 'silver' });
    ok(bad.pending && bad.pending.type === 'kind_emperor_gain', '財宝は受理しない（アクションだけ）');
  }
  // ② 最後の Sun を取り除いた瞬間にも1枚＝**同じターンに2枚あり得る**（1ターン1回のガードを入れてはいけない）。
  let s3 = off('kind_emperor');
  s3.sunTokens = 1;
  s3.turn.phase = 'action'; s3.turn.actions = 1;
  s3.players[0].hand = ['tea_house']; s3.players[0].inPlay = []; s3.players[0].deck = ['copper', 'copper'];
  s3 = E.reduce(s3, { type: 'PLAY_ACTION', card: 'tea_house' });
  ok(s3.prophecyOn === true, '茶屋で予言が有効になった');
  ok(s3.pending && s3.pending.type === 'kind_emperor_gain', 'その瞬間に窓が開く（prophecyQueue 経由＝上書きされない）');
}

console.log('=== R4: 病（Sickness）＝ちょうど3枚（民兵型の流用は公式違反）===');
{
  let s = on('sickness');
  s.turn.startQueue = null;
  s.pending = { type: 'sickness', player: 0 };
  s.players[0].hand = ['copper', 'copper', 'estate', 'estate', 'estate'];
  s.players[0].discard = [];
  const two = E.reduce(s, { type: 'SICKNESS_CHOOSE', mode: 'discard', cards: ['copper', 'copper'] });
  ok(two.pending && two.pending.type === 'sickness', '**2枚では受理しない**（ちょうど3枚）');
  const four = E.reduce(s, { type: 'SICKNESS_CHOOSE', mode: 'discard', cards: ['copper', 'copper', 'estate', 'estate'] });
  ok(four.pending && four.pending.type === 'sickness', '4枚でも受理しない');
  const three = E.reduce(s, { type: 'SICKNESS_CHOOSE', mode: 'discard', cards: ['copper', 'copper', 'estate'] });
  ok(three.players[0].hand.length === 2 && three.players[0].discard.length === 3,
    '3枚ちょうど捨てる（手札5→2。「3枚になるまで」なら手札3で止まる）');
  const curse = E.reduce(s, { type: 'SICKNESS_CHOOSE', mode: 'curse' });
  ok(curse.players[0].deck[0] === 'curse', '呪いは**山札の上に**獲得する');
  ok(curse.players[0].discard.indexOf('curse') < 0, '捨て札を経由しない');
  // 手札3枚未満なら「あるだけ」。
  let s2 = on('sickness');
  s2.turn.startQueue = null;
  s2.pending = { type: 'sickness', player: 0 };
  s2.players[0].hand = ['copper', 'estate']; s2.players[0].discard = [];
  const both = E.reduce(s2, { type: 'SICKNESS_CHOOSE', mode: 'discard', cards: ['copper', 'estate'] });
  ok(both.players[0].hand.length === 0 && both.pending == null, '手札が3枚未満なら**あるだけ**捨てる');
  // 呪いの山が空でも「呪いを獲得」を選べる（遂行できない選択肢も選べる＝終端保証）。
  let s3 = on('sickness');
  s3.turn.startQueue = null;
  s3.pending = { type: 'sickness', player: 0 };
  s3.supply.curse = 0;
  const empty = E.reduce(s3, { type: 'SICKNESS_CHOOSE', mode: 'curse' });
  ok(empty.pending == null, '呪いの山が空でも選べて窓は閉じる（人間が詰まない）');
}

console.log('=== R4: 急速拡大（Rapid Expansion）＝略奪の「せっかちな」と同じ器 ===');
{
  let s = on('rapid_expansion');
  s.turn.phase = 'buy'; s.turn.coins = 6; s.turn.buys = 1;
  s = E.reduce(s, { type: 'BUY', card: 'market' });
  ok((s.players[0].eventSetAside || []).indexOf('market') >= 0, 'アクションの獲得＝脇に置く');
  ok(s.players[0].discard.indexOf('market') < 0, '捨て札には行かない');
  let s2 = on('rapid_expansion');
  s2.turn.phase = 'buy'; s2.turn.coins = 6; s2.turn.buys = 1;
  s2 = E.reduce(s2, { type: 'BUY', card: 'estate' });
  ok((s2.players[0].eventSetAside || []).length === 0, '勝利点は対象外（アクションか財宝だけ）');
  let s3 = on('rapid_expansion');
  s3.turn.phase = 'buy'; s3.turn.coins = 6; s3.turn.buys = 1;
  s3 = E.reduce(s3, { type: 'BUY', card: 'silver' });
  ok((s3.players[0].eventSetAside || []).indexOf('silver') >= 0, '財宝も対象');
  // 次の自分のターンの開始時に使用する（既存の event_play が強制使用する）。
  s = drain(E.reduce(s, { type: 'END_TURN' }));
  s = drain(E.reduce(s, { type: 'END_ACTION_PHASE' }));
  s = E.reduce(s, { type: 'END_TURN' });
  ok(s.pending && s.pending.type === 'event_play', '次の自分のターンの開始時に「使用する」窓が開く');
}

console.log('=== R4: 好機到来（Biding Time）＝ドロー5枚は普通に行う ===');
{
  let s = on('biding_time');
  s.turn.phase = 'buy';
  s.players[0].hand = ['copper', 'copper', 'estate'];
  s = E.reduce(s, { type: 'END_TURN' });
  ok((s.players[0].bidingAside || []).length === 3, 'クリンナップ開始時に手札3枚が脇へ');
  ok(s.players[0].hand.length === 5, '🛑 **ドロー5枚は普通に行う**（手札は空にならない＝相手のターンもリアクションできる）');
  s = drain(E.reduce(s, { type: 'END_ACTION_PHASE' }));
  s = E.reduce(s, { type: 'END_TURN' });
  ok(s.players[0].hand.length === 8, '次の自分のターンの開始時に手札へ加える＝**5枚＋脇の枚数**');
  ok((s.players[0].bidingAside || []).length === 0, '脇は空になる');
  // 脇札は所有カード（保存則・得点に数える）。
  let s2 = on('biding_time');
  s2.players[0].bidingAside = ['province'];
  ok(E.allCards(s2.players[0]).indexOf('province') >= 0, '脇札は allCards に入る（保存則 tally の対象）');
  // 相手には伏せて配信される。
  const masked = E.maskStateFor(s2, 1);
  ok((masked.players[0].bidingAside || [])[0] === 'back', '相手には中身が見えない（伏せ札）');
}

console.log('=== R4: 狼狽（Panic）＝2つの効果は完全に独立 ===');
{
  let s = on('panic');
  s.turn.phase = 'buy'; s.players[0].hand = ['copper', 'copper']; s.players[0].inPlay = [];
  const b0 = s.turn.buys;
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'copper' });
  ok(s.turn.buys === b0 + 2, '財宝を使うたび +2購入');
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'copper' });
  ok(s.turn.buys === b0 + 4, '**毎回**（名前ごとではない）');
  const sup0 = s.supply.copper;
  s = E.reduce(s, { type: 'END_TURN' });
  ok(s.supply.copper === sup0 + 2, '場から捨てるとき**その山に戻る**');
  ok(s.players[0].discard.filter((c) => c === 'copper').length === 0, '捨て札には残らない');
  /* 🛑 2つの効果は独立＝場に出した**後**に発動しても「戻す」だけは起きる（公式FAQ逐語＝
     `you don't get the +2 Buys but do return the Treasure to its pile.`）。
     ＝「使用時に旗を立てて片付けで見る」実装だと落ちる。 */
  let s2 = off('panic');
  s2.turn.phase = 'buy'; s2.players[0].hand = ['copper']; s2.players[0].inPlay = [];
  s2 = E.reduce(s2, { type: 'PLAY_TREASURE', card: 'copper' });
  const b1 = s2.turn.buys;
  s2.prophecyOn = true; s2.sunTokens = 0;   // 場に出した**後**に発動
  const sup1 = s2.supply.copper;
  s2 = E.reduce(s2, { type: 'END_TURN' });
  ok(b1 === 1, '発動前に使った財宝には +2購入は付かない');
  ok(s2.supply.copper === sup1 + 1, 'それでも「山に戻す」だけは起きる（2つの効果は独立）');
}

console.log('=== R4: 盛大な取引（Flourishing Trade）===');
{
  const s = on('flourishing_trade');
  ok(E.cardCost(s, 'province') === 7, 'すべてのカードのコストが $1 下がる（属州 $8→$7）');
  ok(E.cardCost(s, 'copper') === 0, '$0未満にはならない');
  ok(E.scoringCost(s, 'estate').coin === 1, '**得点計算にも効く**（屋敷 $2→$1）＝高原の羊飼いが動く');
  const s0 = off('flourishing_trade');
  ok(E.cardCost(s0, 'province') === 8 && E.scoringCost(s0, 'estate').coin === 2, '発動前は下がらない');
  // アクション権を購入権として使う（置換型）。
  let s2 = on('flourishing_trade');
  s2.turn.phase = 'buy'; s2.turn.coins = 20; s2.turn.buys = 1; s2.turn.actions = 2;
  ok(E.buysAvailable(s2, 0) === 3, '購入権1＋アクション権2＝3回買える');
  s2 = E.reduce(s2, { type: 'BUY', card: 'silver' });
  ok(s2.turn.buys === 0 && s2.turn.actions === 2, '1回目は購入権から消費する');
  s2 = E.reduce(s2, { type: 'BUY', card: 'silver' });
  ok(s2.turn.buys === 0 && s2.turn.actions === 1, '購入権が尽きたらアクション権を消費する');
  s2 = E.reduce(s2, { type: 'BUY', card: 'silver' });
  s2 = E.reduce(s2, { type: 'BUY', card: 'silver' });
  ok(s2.players[0].discard.filter((c) => c === 'silver').length === 3, '4回目は拒否される（合計3回）');
  // アクションフェイズでは変換しない（購入フェイズだけ）。
  let s3 = on('flourishing_trade');
  s3.turn.phase = 'action'; s3.turn.buys = 0; s3.turn.actions = 3;
  ok(E.buysAvailable(s3, 0) === 0, 'アクションフェイズでは購入権に回せない');
}

console.log('=== R4: 悟り（Enlightenment）===');
{
  let s = on('enlightenment');
  s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['copper']; s.players[0].inPlay = []; s.players[0].deck = ['estate', 'estate'];
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'copper' });
  ok(s.players[0].inPlay.indexOf('copper') >= 0, '財宝をアクションフェイズに使える');
  ok(s.turn.coins === 0, '🛑 **コインは出ない**（指示に従う「代わりに」）');
  ok(s.turn.actions === 1 && s.players[0].hand.length === 1, '+1カード +1アクション（＝キャントリップ）');
  let s2 = off('enlightenment');
  s2.turn.phase = 'action'; s2.turn.actions = 1;
  s2.players[0].hand = ['copper']; s2.players[0].inPlay = [];
  const r = E.reduce(s2, { type: 'PLAY_ACTION', card: 'copper' });
  ok(r.players[0].inPlay.length === 0, '発動前は財宝をアクションとして使えない');
  // 購入フェイズでは通常どおり。
  let s3 = on('enlightenment');
  s3.turn.phase = 'buy'; s3.players[0].hand = ['copper']; s3.players[0].inPlay = [];
  s3 = E.reduce(s3, { type: 'PLAY_TREASURE', card: 'copper' });
  ok(s3.turn.coins === 1, '購入フェイズでは通常どおり +$1');
  ok(E.isActionFor(on('enlightenment'), 'copper') === true, '`isActionFor`＝悟り下では銅貨もアクション');
  ok(E.isActionFor(off('enlightenment'), 'copper') === false, '発動前は静的判定と同じ');
  // 得点計算＝ブドウ園が財宝も数える（資本主義とは真逆に「得点にも効く」）。
  if (DOM.CARDS.vineyard) {
    const score = (pr) => {
      const st = pr ? on(pr, ['vineyard'].concat(K_NONE).slice(0, 10), 2) : off('bureaucracy', ['vineyard'].concat(K_NONE).slice(0, 10), 2);
      st.players.forEach((pl) => { pl.deck = []; pl.hand = []; pl.discard = []; pl.inPlay = []; pl.durationCards = []; });
      st.players[0].discard = ['vineyard', 'copper', 'copper', 'copper', 'village', 'village', 'village'];
      return E.scoreGame(st).scores[0].vp;
    };
    ok(score('enlightenment') === 2, '悟り下＝アクション3＋財宝3＝6枚→2点');
    ok(score(null) === 1, '悟り無し＝アクション3枚→1点');
  }
}

console.log('=== R4: 神風（Divine Wind）＝準備手順がゲーム中に再走する唯一の機構 ===');
{
  const KD = ['tea_house', 'village', 'smithy', 'market', 'laboratory', 'festival', 'militia', 'moat', 'cellar', 'mine'];
  let s = off('divine_wind', KD, 2);
  s.sunTokens = 1;
  s.turn.phase = 'action'; s.turn.actions = 1;
  s.players[0].hand = ['tea_house']; s.players[0].inPlay = []; s.players[0].deck = ['copper', 'copper'];
  const old = s.kingdom.slice();
  s = E.reduce(s, { type: 'PLAY_ACTION', card: 'tea_house' });
  ok(s.kingdomEpoch === 1, '王国が入れ替わった印（保存則ハーネスが基準を取り直す）');
  ok(s.kingdom.length >= 10, '新しく10山が配られた');
  ok(old.every((k) => s.kingdom.indexOf(k) < 0), '旧10山は1つも残っていない');
  ok(old.every((k) => s.supply[k] === undefined),
    '🛑 `supply[k]=0` ではなく **delete**（0 だと `emptyPileCount` が「空」と数えて3山終了が即成立する）');
  ok(E.emptyPileCount(s) === 0, '撤去した山は「空の山」に数えない（公式）');
  ok(s.players[0].inPlay.indexOf('tea_house') >= 0, '既に自分のものになったカードはそのまま使い続けられる');
  ok(s.supply.copper != null && s.supply.province != null && s.supply.curse != null, '基本カードの山は撤去しない');
  ok(s.prophecy === 'divine_wind' && s.prophecyOn === true, '**予言は配り直さない**（公式は Ally しか名指ししていない）');
  ok(!E.canReturnToPile(s, old[1]), '撤去した山にはカードを戻せない（濡女／狼狽が湧かない）');
  // CPU が神風の後も最後まで走れる（人間が詰まない／livelock しない）。
  let done = 0;
  for (let np = 2; np <= 4; np++) {
    let g = E.createInitialState(Array.from({ length: np }, (_, i) => ({ name: 'P' + i, isCpu: true })), KD.slice(),
      { prophecy: 'divine_wind', startActive: 0 });
    g.sunTokens = 1;
    g.players[0].hand.push('tea_house'); g.turn.actions = Math.max(1, g.turn.actions);
    g = E.reduce(g, { type: 'PLAY_ACTION', card: 'tea_house' });
    if ((g.kingdomEpoch || 0) === 0) continue;
    let step = 0;
    while (!g.gameOver && step++ < 20000) { const a = DOM.cpu.decide(g); if (!a) break; g = E.reduce(g, a); }
    if (g.gameOver) done++;
  }
  ok(done === 3, '神風発動後に CPU が 2〜4人とも最後まで走れる（膠着0）');
}

console.log('\n========================================');
console.log('旭日R4テスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
process.exit(fail === 0 ? 0 : 1);
