/* 整合性テスト（Node 単体実行）— カードを足すたびに壊れがちな“沈黙する地雷”を機械的に防ぐ。
   使い方: node test/integrity.test.js
   検査:
   1. reduce() の action case と engine.PLAYER_ACTIONS が完全一致（オンライン許可リストの抜け/綴り違い防止）
   2. サーバは engine.PLAYER_ACTIONS を唯一の許可リストに使う（二重管理していない）
   3. CPU の GAIN_ORDER が全カードを過不足なく網羅（買えない/詰まるカードが無い）
   4. POOLS / CARD_SETS の id が全て実在、固定セットはちょうど10種
   5. 表示データ(CARD_DATA) が DOM.CARDS と id・名前・コストで一致（コスト二重管理の事故防止）
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = { window: {}, Math: Math, JSON: JSON, console: console };
vm.createContext(sandbox);
function read(f) { return fs.readFileSync(path.join(__dirname, '..', f), 'utf8'); }
function load(f) { vm.runInContext(read(f), sandbox, { filename: f }); }
load('js/cards.js'); load('js/engine.js'); load('js/cpu.js'); load('js/carddata.js');
const DOM = sandbox.window.DOM;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ FAIL: ' + msg); } }
function setEq(a, b) { return a.length === b.length && a.every((x) => b.includes(x)); }

/* 1. reduce の switch case（大文字アクション）と PLAYER_ACTIONS が一致 */
console.log('=== reduce の action case と engine.PLAYER_ACTIONS が一致 ===');
{
  const eng = read('js/engine.js');
  const cases = new Set(); let m; const re = /case '([A-Z][A-Z0-9_]+)'/g;
  while ((m = re.exec(eng))) cases.add(m[1]);
  cases.delete('NEW_GAME'); // NEW_GAME はサーバが内部生成（プレイヤーは送らない）
  const pa = DOM.engine.PLAYER_ACTIONS;
  ok(pa && typeof pa.has === 'function' && typeof pa[Symbol.iterator] === 'function', 'engine.PLAYER_ACTIONS が Set 相当');
  const caseList = [...cases];
  const missing = caseList.filter((x) => !pa.has(x));
  const extra = [...pa].filter((x) => !cases.has(x));
  ok(missing.length === 0, 'reduce にあるが PLAYER_ACTIONS に無い: ' + missing.join(','));
  ok(extra.length === 0, 'PLAYER_ACTIONS にあるが reduce case が無い（綴り違い等）: ' + extra.join(','));
}

/* 2. サーバは engine.PLAYER_ACTIONS を許可リストに使っている（独自リストを持たない） */
console.log('=== サーバが engine.PLAYER_ACTIONS を使う ===');
{
  const srv = read('server/gameServer.js');
  ok(/ALLOWED\s*=\s*\(?\s*E[\s\S]{0,60}PLAYER_ACTIONS/.test(srv), 'サーバの ALLOWED は E.PLAYER_ACTIONS から作る');
  // 旧来のように大量のアクション文字列をベタ書きしていないこと（再発防止）
  const hardcoded = (srv.match(/'[A-Z][A-Z0-9_]+_RESOLVE'/g) || []).length;
  ok(hardcoded === 0, 'サーバにアクション文字列のベタ書きが残っていない（' + hardcoded + '件）');
}

/* 2b. 'react'ステージを作るアタックは全て ATTACKS 登録表に載っている
      （堀の無効化を MOAT_REVEAL に繋ぎ忘れて“堀が効かない”事故を防ぐ） */
console.log('=== react ステージを作るアタックが ATTACKS に登録済み ===');
{
  const eng = read('js/engine.js');
  const mm = eng.match(/const ATTACKS = \{([\s\S]*?)\n  \};/);
  ok(!!mm, 'ATTACKS 登録表が見つかる');
  const keys = new Set((mm ? mm[1] : '').match(/^\s*([a-z_]+):/gm).map((s) => s.trim().replace(':', '')));
  // pending を {type:'X', stage:'react'} で作っている箇所の type を収集
  const reactTypes = new Set(); let m; const re = /type:\s*'([a-z_]+)',\s*stage:\s*'react'/g;
  while ((m = re.exec(eng))) reactTypes.add(m[1]);
  ok(reactTypes.size > 0, 'react ステージのアタックを検出できた（' + reactTypes.size + '種）');
  const unregistered = [...reactTypes].filter((t) => !keys.has(t));
  ok(unregistered.length === 0, 'ATTACKS 未登録の react アタック: ' + unregistered.join(','));
  // MOAT_REVEAL は登録表を引いている（個別分岐を復活させていない）
  ok(/ATTACKS\[pd\.type\]\.onMoat/.test(eng), 'MOAT_REVEAL は ATTACKS[pd.type].onMoat を使う');
}

/* 3. CPU の GAIN_ORDER が全カードを過不足なく網羅 */
console.log('=== CPU GAIN_ORDER が全カードを網羅 ===');
{
  const cpu = read('js/cpu.js');
  const mm = cpu.match(/GAIN_ORDER\s*=\s*\[([\s\S]*?)\]/);
  ok(!!mm, 'GAIN_ORDER 定義が見つかる');
  const ids = (mm[1].match(/'[a-z_]+'/g) || []).map((s) => s.replace(/'/g, ''));
  const cards = Object.keys(DOM.CARDS);
  ok(setEq(ids, cards), 'GAIN_ORDER と DOM.CARDS が同一集合（差分: ' +
    cards.filter((c) => !ids.includes(c)).concat(ids.filter((c) => !cards.includes(c))).join(',') + '）');
  ok(ids.length === new Set(ids).size, 'GAIN_ORDER に重複が無い');
}

/* 4. POOLS / CARD_SETS の id 健全性 */
console.log('=== POOLS / CARD_SETS の id が実在・固定セットは10種 ===');
{
  const bad = [];
  Object.keys(DOM.POOLS).forEach((p) => DOM.POOLS[p].forEach((id) => { if (!DOM.CARDS[id]) bad.push(p + ':' + id); }));
  DOM.CARD_SETS.forEach((s) => (s.kingdom || []).forEach((id) => { if (!DOM.CARDS[id]) bad.push(s.id + ':' + id); }));
  ok(bad.length === 0, '存在しない id を参照していない: ' + bad.join(','));
  DOM.CARD_SETS.filter((s) => s.kingdom).forEach((s) =>
    ok(s.kingdom.length === 10, 'セット ' + s.id + ' は10種（実際 ' + s.kingdom.length + '）'));
  // ランダムセットの randomFrom が実在プールを指す
  DOM.CARD_SETS.filter((s) => s.randomFrom).forEach((s) =>
    s.randomFrom.forEach((p) => ok(!!DOM.POOLS[p], 'random ' + s.id + ' の母集団 ' + p + ' が存在')));
  // 各カードは少なくとも1つのプールに含まれる（一覧/抽選から漏れない）
  const inPool = new Set([].concat.apply([], Object.values(DOM.POOLS)));
  const base = ['copper', 'silver', 'gold', 'estate', 'duchy', 'province', 'curse'];
  Object.keys(DOM.CARDS).filter((id) => !base.includes(id)).forEach((id) =>
    ok(inPool.has(id), '王国カード ' + id + ' がどこかのプールに含まれる'));
}

/* 5. 表示データ(CARD_DATA) と DOM.CARDS の整合（id・名前・コスト） */
console.log('=== 表示データと DOM.CARDS の id/名前/コストが一致 ===');
{
  const cd = DOM.CARD_DATA || {};
  Object.keys(DOM.CARDS).forEach((id) => {
    ok(!!cd[id], '表示データに ' + id + ' がある');
    if (cd[id]) {
      ok(cd[id].name === DOM.CARDS[id].name, id + ' の名前一致（表示 ' + cd[id].name + ' / 定義 ' + DOM.CARDS[id].name + '）');
      ok(cd[id].cost === DOM.CARDS[id].cost, id + ' のコスト一致（表示 ' + cd[id].cost + ' / 定義 ' + DOM.CARDS[id].cost + '）');
    }
  });
  Object.keys(cd).forEach((id) => ok(!!DOM.CARDS[id], '表示データの ' + id + ' が DOM.CARDS にもある'));
}

console.log('\n========================================');
console.log('整合性テスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
if (fail > 0) process.exit(1);
