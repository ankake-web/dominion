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
  // potion/白金貨/植民地は王国カードではなく共通サプライ（呪い同様）＝プール所属を要求しない。
  const base = ['copper', 'silver', 'gold', 'estate', 'duchy', 'province', 'curse', 'potion', 'platinum', 'colony'];
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

/* 5b. 種別ラベルが全 type を落とさない（複合カードの表記漏れ検知＝charlatan/clerk 型のバグを構造的に防ぐ） */
console.log('=== 種別ラベルが全 type を含む（表記漏れ検知）===');
{
  const cd = DOM.CARD_DATA || {};
  const JP = { treasure: '財宝', victory: '勝利点', curse: '呪い', action: 'アクション', attack: 'アタック', reaction: 'リアクション', duration: '持続', knight: '騎士', ruins: '廃墟', shelter: '避難所', looter: '略奪者', reserve: 'リザーブ', traveller: 'トラベラー', castle: '城', command: '命令', night: '夜行', fate: '幸運', doom: '不運', heirloom: '家宝', spirit: '精霊', zombie: 'ゾンビ', liaison: '連携', townsfolk: '町民', augur: '卜占官', clash: '衝突', fort: '城砦', odyssey: '叙事詩', wizard: '魔法使い', loot: '戦利品', omen: '前兆', shadow: '影', reward: '褒賞' };
  const EN = { treasure: 'Treasure', victory: 'Victory', curse: 'Curse', action: 'Action', attack: 'Attack', reaction: 'Reaction', duration: 'Duration', knight: 'Knight', ruins: 'Ruins', shelter: 'Shelter', looter: 'Looter', reserve: 'Reserve', traveller: 'Traveller', castle: 'Castle', command: 'Command', night: 'Night', fate: 'Fate', doom: 'Doom', heirloom: 'Heirloom', spirit: 'Spirit', zombie: 'Zombie', liaison: 'Liaison', townsfolk: 'Townsfolk', augur: 'Augur', clash: 'Clash', fort: 'Fort', odyssey: 'Odyssey', wizard: 'Wizard', loot: 'Loot', omen: 'Omen', shadow: 'Shadow', reward: 'Reward' };
  Object.keys(DOM.CARDS).forEach((id) => {
    const d = cd[id]; if (!d) return;
    (DOM.CARDS[id].types || []).forEach((t) => {
      ok((d.typeLabel || '').includes(JP[t]), id + ' の日本語ラベルに ' + t + '(' + JP[t] + ') が含まれる（実: ' + d.typeLabel + '）');
      ok((d.typeLabelEn || '').includes(EN[t]), id + ' の英語ラベルに ' + t + '(' + EN[t] + ') が含まれる（実: ' + d.typeLabelEn + '）');
    });
    // ポーション費用の単一ソース透過
    ok((d.potion || 0) === (DOM.CARDS[id].potion || 0), id + ' のポーション費用が表示データに透過（実 ' + (d.potion || 0) + ' / 定義 ' + (DOM.CARDS[id].potion || 0) + '）');
  });
}

/* 6. ルネサンス：資本主義で「財宝にもなるアクション」の集合を固定する。
      判定は日本語カードテキストからの機械判定＋明示リスト（engine の isCapitalismTreasure）なので、
      カタログ文を1文字触るだけで集合が静かに変わり得る。ここで期待集合とサイズを固定して検知する。 */
console.log('=== 資本主義：財宝になるアクションの集合が固定されている ===');
{
  const set = DOM.engine.capitalismTreasures().sort();
  // 「+$」を持たない代表例は含まれてはいけない
  //   移動動物園：強制退去(displace)は「それよりコストが最大2コイン高い」＝コスト参照であって +$ ではない。
  //   カタログ文を「コスト+2コイン以下」と書くと機械判定に誤ヒットするので、この2枚を番人として置く。
  ['coppersmith', 'transmogrify', 'inventor', 'village', 'smithy', 'chapel', 'upgrade', 'remake', 'develop', 'highway', 'raze', 'sculptor', 'seer', 'research', 'recruiter',
    'displace', 'groom', 'destrier', 'wayfarer', 'sanctuary', 'snowy_village',
    //   同盟：大工/改造も「それよりコストが最大2コイン高い」＝コスト参照であって +$ ではない（同じ罠の番人）。
    //   薬草集め/堡塁/交換/専門家/侯爵/歩哨/狩人 も +$ を持たない。
    'carpenter', 'modify', 'herb_gatherer', 'hill_fort', 'swap', 'specialist', 'marquis', 'sentinel', 'hunter']
    .forEach((id) => ok(set.indexOf(id) < 0, '資本主義：' + id + ' は財宝にならない（+$ 記号を持たない）'));
  // 「+$」を持つ代表例は必ず含まれる（機械判定ぶん＋明示リストぶん）
  ['market', 'militia', 'improve', 'festival', 'woodcutter', 'monument', 'poacher', 'steward', 'baron', 'clerk',
    'salvager', 'artificer', 'peasant', 'messenger', 'wine_merchant', 'giant', 'swamp_hag', 'caravan_guard', 'miser', 'amulet',
    // 移動動物園（+$ を持つアクション10枚）。門番は持続の「次のターン開始時 +$3」だが カード文に +$ があるので対象。
    'animal_fair', 'bounty_hunter', 'cardinal', 'coven', 'fisherman', 'gatekeeper', 'kiln', 'livery', 'paddock', 'scrap',
    // 夜想曲（+$ を持つアクション6枚）。秘密の洞窟は持続の「次のターン開始時 +$3」だがカード文に +$ があるので対象。
    'bard', 'conclave', 'sacred_grove', 'secret_cave', 'tormentor', 'tracker',
    // 同盟（+$ を持つアクション16枚）。仲買人は「そのコスト$1につき +$1」なので対象／
    //   触れ役・町・要塞は「選ぶ」の選択肢に +$ があるので対象／天幕・駐屯地・要塞は分割山の中身。
    'sycophant', 'merchant_camp', 'broker', 'courier', 'town', 'barbarian', 'capital_city', 'galleria',
    'guildmaster', 'skirmisher', 'archer', 'tent', 'garrison', 'stronghold', 'town_crier', 'elder',
    // 旭日（+$ を持つアクション7枚）。公家/狐は「選ぶ」や条件分岐の中に +$ があるので対象／
    //   侍・山の社は「次のターン以降の開始時 +$」だがカード文に +$ があるので対象（隊商の護衛・秘密の洞窟と同じ扱い）。
    'fishmonger', 'aristocrat', 'change', 'kitsune', 'tea_house', 'samurai', 'mountain_shrine']
    .forEach((id) => ok(set.indexOf(id) >= 0, '資本主義：' + id + ' は財宝になる（+$ を持つ）'));
  // 旭日：金山/勅使/駕籠は「+N 負債」であって +$ ではない／米は元から財宝／大名・絵師は +$ を持たない（番人）。
  ['gold_mine', 'imperial_envoy', 'litter', 'rice', 'daimyo', 'artist', 'craftsman', 'root_cellar']
    .forEach((id) => ok(set.indexOf(id) < 0, '資本主義：' + id + ' は財宝にならない（+$ 記号を持たない）'));
  // 夜想曲の夜行カード（守護者 +$1／夜襲 +$3）は**アクションではない**ので資本主義の対象にならない。
  ['guardian', 'raider', 'werewolf', 'vampire', 'changeling', 'monastery', 'night_watchman', 'exorcist', 'devils_workshop']
    .forEach((id) => ok(set.indexOf(id) < 0, '資本主義：' + id + ' は財宝にならない（夜行カード＝アクションではない）'));
  ok(set.every((id) => DOM.isType(id, 'action') && !DOM.isType(id, 'treasure')), '資本主義の対象は「財宝でないアクション」だけ');
  ok(set.length === 156, '資本主義で財宝になるアクションは156枚（段階1の33種で+9＝抑留/航海士/海賊船/交易路/香具師/ならず者/店/一騎討ち/駿馬）（カタログ文を変えたらこの数を見直す。実: ' + set.length + '）');
}

/* ===== 4点セットの機械検算＝「engine が立てる全 pending に CPU と UI の分岐があるか」 =====
   本プロジェクトで**最も再発する事故**が「engine に窓を足したのに CPU / UI に分岐を書き忘れる」
   （CPU に無い＝**本番 livelock**／UI に無い＝**人間が完全に詰む**）。
   §0-30 P7（略奪）で pending 54種を手で数えたが**恒久検査にしていなかった**ので、ここで機械化する。
   ⚠ ソースの文字列走査＝「1文字も出てこない」ことだけを見る保守的な検査。
      分岐の中身が正しいかは各拡張のテストが担保する（この検査は**足し忘れ**だけを構造的に防ぐ）。
   ⚠ `onGainQueue` に積む**非対話項目**（進歩／せっかちな／突貫／配達／鏡映／侵略の再開網／
      アタックの継続 など＝消化側がその場で適用する）は `state.pending` にならないので対象外。 */
console.log('=== 全 pending に CPU decidePending と UI viewPendingModal の分岐がある（4点セット）===');
{
  const fsx = require('fs'), pathx = require('path');
  const R = (f) => fsx.readFileSync(pathx.join(__dirname, '..', 'js', f), 'utf8').replace(/\r\n/g, '\n');
  const eng = R('engine.js'), cpuSrc = R('cpu.js'), uiSrc = R('ui.js');
  const ids = new Set();
  [/state\.pending\s*=\s*\{\s*type:\s*'([a-z0-9_]+)'/g,
    /startQueue\.push\(\{\s*type:\s*'([a-z0-9_]+)'/g,
    /queueProphecy\(state,\s*\{\s*type:\s*'([a-z0-9_]+)'/g].forEach((re) => {
    let m; while ((m = re.exec(eng))) ids.add(m[1]);
  });
  const all = Array.from(ids).sort();
  ok(all.length > 400, 'pending 型を十分に抽出できている（実: ' + all.length + '）');
  const noCpu = all.filter((id) => cpuSrc.indexOf("'" + id + "'") < 0);
  const noUi = all.filter((id) => uiSrc.indexOf("'" + id + "'") < 0);
  ok(noCpu.length === 0, 'CPU decidePending に分岐が無い pending（本番 livelock）: ' + noCpu.join(','));
  ok(noUi.length === 0, 'UI viewPendingModal に分岐が無い pending（人間が詰む）: ' + noUi.join(','));
}

console.log('\n========================================');
console.log('整合性テスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
if (fail > 0) process.exit(1);
