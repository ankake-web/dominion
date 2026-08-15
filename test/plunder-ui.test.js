/* 略奪（Plunder）UI スモーク（jsdom）
   使い方: node test/plunder-ui.test.js
   主目的＝**人間が詰まない／見えないと困るものが見えている**こと。
   P1a＝戦利品(Loot)の山の残枚数が盤面に出ること（中身は出さない＝完全に秘密）。 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = '<!DOCTYPE html><html><body><div id="app"></div></body></html>';
const dom = new JSDOM(html, { url: 'https://example.com/', runScripts: 'outside-only', pretendToBeVisual: true });
const win = dom.window;
const timers = []; let timerId = 1;
win.setTimeout = (fn) => { const id = timerId++; timers.push({ id, fn }); return id; };
win.clearTimeout = (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); };
win.requestAnimationFrame = (fn) => { fn(); return 1; };
let runtimeError = null;
win.addEventListener('error', (e) => { runtimeError = e.error || e.message; });
function load(f) { win.eval(fs.readFileSync(path.join(__dirname, '..', f), 'utf8')); }
['js/cards.js', 'js/engine.js', 'js/cpu.js', 'js/store.js', 'js/net.js', 'js/audio.js', 'js/ui.js'].forEach(load);
win.document.dispatchEvent(new win.Event('DOMContentLoaded'));

const doc = win.document;
const DOM = win.DOM;
const UI = DOM.UI;
const E = DOM.engine;
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; } else { fail++; console.log('  x FAIL: ' + m); } }
function showAs(s, viewer) {
  runtimeError = null;
  UI.view = 'game'; UI.mode = 'local'; UI.mySeat = null; UI.amount = null; UI.selection = [];
  UI.pickZoom = null; UI.sheet = null; UI.confirm = null; UI.lmZoom = null;
  UI.localViewer = viewer != null ? viewer : (s.pending ? s.pending.player : (s.turn ? s.turn.active : 0));
  UI.store = DOM.LocalStore(s);
  DOM.render();
  timers.length = 0;
}
const FILLER = ['village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'laboratory', 'festival'];
const LOOT = DOM.POOLS.loot;

console.log('=== P1a: 戦利品(Loot)の盤面表示 ===');
{
  // 戦利品を配る札（宝飾卵）がある王国＝山ができる
  const s = E.createInitialState(['あなた', '相手'], ['jewelled_egg'].concat(FILLER), { startActive: 0 });
  showAs(s, 0);
  ok(!runtimeError, '描画で例外が出ない: ' + (runtimeError || ''));
  const txt = doc.body.textContent;
  ok(txt.indexOf('戦利品') >= 0, '盤面に「戦利品」の行が出る');
  ok(txt.indexOf('30枚') >= 0, '残枚数（30枚）が見える');
  // 中身は1枚も名前が漏れていない（山は完全に秘密）
  const leaked = LOOT.filter((id) => txt.indexOf(DOM.CARDS[id].name) >= 0);
  ok(leaked.length === 0, '山の中身のカード名が盤面に漏れていない（漏れ=' + leaked.join(',') + '）');

  // 1枚獲得すると残枚数が減り、獲得した札は公開演出に出る
  const got = E.gainLoot(s, 0);
  showAs(s, 0);
  ok(!runtimeError, '獲得後も描画で例外が出ない: ' + (runtimeError || ''));
  ok(doc.body.textContent.indexOf('29枚') >= 0, '獲得すると残枚数が29枚になる');
  ok(doc.body.textContent.indexOf(DOM.CARDS[got].name) >= 0, '獲得した戦利品の名前は見える（公開されるため）');
}
{
  // 戦利品を配る札が無い王国＝行そのものを出さない
  const s = E.createInitialState(['あなた', '相手'], ['mine'].concat(FILLER), { startActive: 0 });
  showAs(s, 0);
  ok(!runtimeError, '描画で例外が出ない: ' + (runtimeError || ''));
  ok(doc.body.textContent.indexOf('戦利品') < 0, '戦利品を配る札が無ければ盤面に行を出さない');
}

console.log('\n=== P1b: 戦利品の pending にモーダルと押せる選択肢があるか（人間が詰まないこと） ===');
function $(s) { return doc.querySelector(s); }
function $all(s) { return Array.from(doc.querySelectorAll(s)); }
function actionable() {
  if (runtimeError || !$('.modal')) return false;
  const btns = $all('.modal button').filter((b) => !b.disabled);
  const chips = $all('.modal .chip-grid .card, .modal .chip-grid .pick-supply');
  return btns.length + chips.length > 0;
}
function mkP(kingdom) {
  const s = E.createInitialState(['あなた', '相手'], (kingdom || ['jewelled_egg']).concat(FILLER).slice(0, 10), { startActive: 0 });
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  s.turn.phase = 'buy';
  return s;
}
// 各 pending を直接立てて、モーダルが出て押せる選択肢があるかを見る
const CASES = [
  ['prize_goat', (s) => { s.players[0].hand = ['estate']; s.pending = { type: 'prize_goat', player: 0 }; }],
  ['hammer_gain', (s) => { s.pending = { type: 'hammer_gain', player: 0 }; }],
  ['sextant', (s) => { s.pending = { type: 'sextant', player: 0, cards: ['copper', 'estate', 'silver', 'gold', 'curse'] }; }],
  ['puzzle_box', (s) => { s.players[0].hand = ['gold']; s.pending = { type: 'puzzle_box', player: 0 }; }],
  ['staff_play', (s) => { s.players[0].hand = ['village']; s.pending = { type: 'staff_play', player: 0 }; }],
  ['travelling_fair(勲章)', (s) => { s.pending = { type: 'travelling_fair', player: 0, card: 'silver', dest: 'discard', source: 'insignia' }; }],
  ['discard_down(剣)', (s) => { s.players[0].hand = ['copper', 'copper', 'copper', 'copper', 'copper', 'copper']; s.pending = { type: 'discard_down', player: 0, source: 1, down: 4, queue: [] }; }],
  ['discard_down(剣)＋盾', (s) => { s.players[0].hand = ['shield', 'copper', 'copper', 'copper', 'copper', 'copper']; s.pending = { type: 'discard_down', player: 0, source: 1, down: 4, queue: [] }; }],
  ['amphora', (s) => { s.pending = { type: 'amphora', player: 0 }; }],
  ['orb（捨て札に使える札あり）', (s) => { s.players[0].discard = ['village', 'estate']; s.pending = { type: 'orb', player: 0 }; }],
  ['orb（捨て札が空＝+$3 しか選べない）', (s) => { s.players[0].discard = []; s.pending = { type: 'orb', player: 0 }; }],
  ['spell_scroll_gain', (s) => { s.pending = { type: 'spell_scroll_gain', player: 0, limit: 7 }; }],
  ['spell_scroll_play', (s) => { s.players[0].discard = ['gold']; s.pending = { type: 'spell_scroll_play', player: 0, card: 'gold' }; }],
  // P2："next time" 型持続
  ['cage_set（0枚でも確定できる）', (s) => { s.players[0].hand = ['estate', 'copper']; s.pending = { type: 'cage_set', player: 0 }; }],
  ['shrine_trash（廃棄しないでも閉じられる）', (s) => { s.players[0].hand = ['copper', 'curse', 'gold']; s.pending = { type: 'shrine_trash', player: 0 }; }],
  ['discard_down(切り裂き魔)', (s) => { s.players[0].hand = ['copper', 'copper', 'copper', 'copper', 'copper']; s.pending = { type: 'discard_down', player: 0, source: 1, down: 3, queue: [], next: 'cutthroat' }; }],
  // P3：王国カード
  ['grotto_set', (s) => { s.players[0].hand = ['estate', 'copper']; s.pending = { type: 'grotto_set', player: 0 }; }],
  ['shaman_trash', (s) => { s.players[0].hand = ['copper']; s.pending = { type: 'shaman_trash', player: 0 }; }],
  ['shaman_gain（廃棄置き場から選ぶ）', (s) => { s.trash = ['silver', 'estate']; s.pending = { type: 'shaman_gain', player: 0 }; }],
  ['shaman_gain（候補ゼロ＝閉じるボタン）', (s) => { s.trash = []; s.pending = { type: 'shaman_gain', player: 0 }; }],
  ['siren react（堀あり）', (s) => { s.players[0].hand = ['moat']; s.pending = { type: 'siren', stage: 'react', player: 0, source: 1, victim: 0, queue: [] }; }],
  ['siren_gain', (s) => { s.players[0].hand = ['village']; s.pending = { type: 'siren_gain', player: 0, dest: 'discard' }; }],
  ['stowaway_react', (s) => { s.players[0].hand = ['stowaway']; s.pending = { type: 'stowaway_react', player: 0 }; }],
  ['maroon_trash', (s) => { s.players[0].hand = ['estate', 'copper']; s.pending = { type: 'maroon_trash', player: 0 }; }],
  ['crucible_trash', (s) => { s.players[0].hand = ['estate', 'copper']; s.pending = { type: 'crucible_trash', player: 0 }; }],
  ['pilgrim_put', (s) => { s.players[0].hand = ['estate', 'copper']; s.pending = { type: 'pilgrim_put', player: 0 }; }],
  ['figurine_discard', (s) => { s.players[0].hand = ['village', 'copper']; s.pending = { type: 'figurine_discard', player: 0 }; }],
  ['gondola_choose', (s) => { s.pending = { type: 'gondola_choose', player: 0 }; }],
  ['gondola_play', (s) => { s.players[0].hand = ['village']; s.pending = { type: 'gondola_play', player: 0 }; }],
  ['tools_gain', (s) => { s.players[0].inPlay = ['tools', 'copper']; s.pending = { type: 'tools_gain', player: 0 }; }],
  ['pickaxe_trash', (s) => { s.players[0].hand = ['silver', 'copper']; s.pending = { type: 'pickaxe_trash', player: 0 }; }],
  ['silver_mine_gain', (s) => { s.players[0].inPlay = ['silver_mine']; s.pending = { type: 'silver_mine_gain', player: 0 }; }],
  ['cabin_boy（二択）', (s) => { s.players[0].durationCards = ['cabin_boy']; s.pending = { type: 'cabin_boy', player: 0 }; }],
  ['cabin_boy_gain', (s) => { s.pending = { type: 'cabin_boy_gain', player: 0 }; }],
  ['rope_trash', (s) => { s.players[0].hand = ['copper']; s.pending = { type: 'rope_trash', player: 0 }; }],
  // P5：イベント
  ['bury_put', (s) => { s.players[0].discard = ['copper', 'estate']; s.pending = { type: 'bury_put', player: 0 }; }],
  ['peril_trash', (s) => { s.players[0].hand = ['village']; s.pending = { type: 'peril_trash', player: 0 }; }],
  ['foray_discard', (s) => { s.players[0].hand = ['copper', 'silver', 'estate']; s.pending = { type: 'foray_discard', player: 0, need: 3 }; }],
  ['scrounge choose', (s) => { s.pending = { type: 'scrounge', stage: 'choose', player: 0 }; }],
  ['scrounge trash', (s) => { s.players[0].hand = ['copper']; s.pending = { type: 'scrounge', stage: 'trash', player: 0 }; }],
  ['scrounge gain', (s) => { s.pending = { type: 'scrounge', stage: 'gain', player: 0 }; }],
  ['maelstrom trash', (s) => { s.players[0].hand = ['copper', 'copper', 'estate']; s.pending = { type: 'maelstrom', stage: 'trash', player: 0, need: 3 }; }],
  ['maelstrom victim', (s) => { s.players[0].hand = ['copper', 'copper', 'copper', 'estate', 'estate']; s.pending = { type: 'maelstrom', stage: 'victim', player: 0, queue: [] }; }],
  ['invasion attack', (s) => { s.players[0].hand = ['militia']; s.pending = { type: 'invasion', stage: 'attack', player: 0 }; }],
  ['invasion action', (s) => { s.pending = { type: 'invasion', stage: 'action', player: 0 }; }],
  ['prosper_gain（やめられる）', (s) => { s.pending = { type: 'prosper_gain', player: 0, gained: [] }; }],
  ['prepare_play', (s) => { s.players[0].prepareAside = ['village', 'copper', 'estate']; s.pending = { type: 'prepare_play', player: 0 }; }],
  ['prepare_play（使える札なし＝捨てて閉じる）', (s) => { s.players[0].prepareAside = ['estate']; s.pending = { type: 'prepare_play', player: 0 }; }],
  // P6：複雑系
  ['kings_cache_play', (s) => { s.players[0].hand = ['gold']; s.players[0].inPlay = ['kings_cache']; s.pending = { type: 'kings_cache_play', player: 0 }; }],
  ['fortune_hunter play', (s) => { s.pending = { type: 'fortune_hunter', stage: 'play', player: 0, cards: ['silver', 'estate', 'copper'] }; }],
  ['fortune_hunter arrange', (s) => { s.pending = { type: 'fortune_hunter', stage: 'arrange', player: 0, cards: ['estate', 'copper'] }; }],
  ['mapmaker pick', (s) => { s.pending = { type: 'mapmaker', player: 0, cards: ['gold', 'silver', 'estate', 'curse'], take: 2 }; }],
  ['mapmaker_react', (s) => { s.players[0].hand = ['mapmaker']; s.pending = { type: 'mapmaker_react', player: 0 }; }],
  ['enlarge_trash', (s) => { s.players[0].hand = ['estate']; s.pending = { type: 'enlarge_trash', player: 0 }; }],
  ['enlarge_gain', (s) => { s.pending = { type: 'enlarge_gain', player: 0, maxCost: 4, pot: 0, debt: 0 }; }],
  ['first_mate（名前未確定）', (s) => { s.players[0].hand = ['village', 'smithy']; s.turn.firstMateStack = [{ player: 0, name: null }]; s.pending = { type: 'first_mate', player: 0, name: null }; }],
  ['first_mate（名前確定後もやめられる）', (s) => { s.players[0].hand = ['copper']; s.turn.firstMateStack = [{ player: 0, name: 'village' }]; s.pending = { type: 'first_mate', player: 0, name: 'village' }; }],
  ['frigate react（堀あり）', (s) => { s.players[0].hand = ['moat']; s.pending = { type: 'frigate', stage: 'react', player: 0, source: 1, victim: 0, queue: [], rid: 'x' }; }],
  ['trickster react（堀あり）', (s) => { s.players[0].hand = ['moat']; s.pending = { type: 'trickster', stage: 'react', player: 0, source: 1, victim: 0, queue: [] }; }],
  ['quartermaster（脇あり）', (s) => { s.players[0].quartermasters = [{ id: 1, cards: ['silver'] }]; s.pending = { type: 'quartermaster', player: 0, qmId: 1 }; }],
  ['trickster_aside', (s) => { s.players[0].inPlay = ['gold', 'copper', 'trickster']; s.pending = { type: 'trickster_aside', player: 0, max: 1 }; }],
  ['mining_road_play', (s) => { s.turn.miningRoad = 1; s.players[0].discard = ['silver']; s.pending = { type: 'mining_road_play', player: 0, card: 'silver', dest: 'discard' }; }],
  // P4：特性(Trait)
  ['pious_trash', (s) => { s.players[0].hand = ['copper']; s.pending = { type: 'pious_trash', player: 0 }; }],
  ['friendly_discard', (s) => { s.traits = { friendly: 'village' }; s.players[0].hand = ['village']; s.pending = { type: 'friendly_discard', player: 0 }; }],
  ['patient_set', (s) => { s.traits = { patient: 'village' }; s.players[0].hand = ['village', 'copper']; s.pending = { type: 'patient_set', player: 0 }; }],
  ['shy_discard', (s) => { s.traits = { shy: 'village' }; s.players[0].hand = ['village']; s.pending = { type: 'shy_discard', player: 0 }; }],
  ['inspiring_play', (s) => { s.traits = { inspiring: 'village' }; s.players[0].hand = ['smithy']; s.pending = { type: 'inspiring_play', player: 0 }; }],
];
CASES.forEach(([name, setup]) => {
  const s = mkP(); setup(s); showAs(s, 0);
  ok(actionable(), name + '：モーダルが出て押せる選択肢がある' + (runtimeError ? '（例外: ' + runtimeError + '）' : ''));
});
// 盾のボタンが実際に出ていること
{
  const s = mkP();
  s.players[0].hand = ['shield', 'copper', 'copper', 'copper', 'copper', 'copper'];
  s.pending = { type: 'discard_down', player: 0, source: 1, down: 4, queue: [] };
  showAs(s, 0);
  ok(doc.body.textContent.indexOf('盾を公開') >= 0, '盾を持っていると「盾を公開して無効化」ボタンが出る');
}
// 勲章のラベルが「勲章」になっている（移動遊園地と取り違えない）
{
  const s = mkP();
  s.pending = { type: 'travelling_fair', player: 0, card: 'silver', dest: 'discard', source: 'insignia' };
  showAs(s, 0);
  ok(doc.body.textContent.indexOf('勲章') >= 0, '勲章の窓は「勲章」と表示される');
}
// P2：檻の脇札の見え方（自分＝中身／相手＝枚数だけ）
{
  const s = mkP();
  s.players[0].cage = ['estate', 'estate'];
  showAs(s, 0);
  ok(!runtimeError && doc.body.textContent.indexOf('檻の脇') >= 0 && doc.body.textContent.indexOf('屋敷') >= 0,
    '檻の脇札：自分には中身（屋敷）が見える');
  // 相手（席1）の檻＝マスク済み state を「自分（席0）の視点」で描く＝枚数だけ見える
  const m = DOM.engine.maskStateFor(s, 0);
  m.players[1].cage = ['back', 'back'];  // 席1の檻（マスク後の形）
  showAs(m, 0);
  const txt = doc.body.textContent;
  ok(!runtimeError && txt.indexOf('檻の脇: 2枚') >= 0, '檻の脇札：相手のは枚数だけ見える');
  ok((DOM.engine.maskStateFor(s, 1).players[0].cage || []).every((c) => c === 'back'), 'maskStateFor は檻の中身を伏せる');
}
// CPU が全 pending で null を返さない（オンラインで reduce(state,null) が落ちるのを防ぐ）
{
  const CPUd = DOM.cpu;
  CASES.forEach(([name, setup]) => {
    const s = mkP(); setup(s);
    let a = null, err = null;
    try { a = CPUd.decidePending ? CPUd.decidePending(s) : CPUd.decide(s); } catch (e) { err = e.message; }
    ok(a && a.type, 'CPU：' + name + ' で有効な action を返す' + (err ? '（例外: ' + err + '）' : ''));
  });
}

console.log('\n========================================');
console.log(`略奪UIテスト結果: ${pass} 件成功, ${fail} 件失敗`);
console.log('========================================');
process.exit(fail ? 1 : 0);
