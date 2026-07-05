/* 暗黒時代（Dark Ages）UI スモーク（jsdom）
   各 pending の選択モーダルと混合山（騎士）の盤面表示がエラー無く描画できるかを確認。
   使い方: node test/darkages-ui.test.js */
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
function ok(c, m) { if (c) { pass++; } else { fail++; console.log('  ✗ FAIL: ' + m); } }
function $(s) { return doc.querySelector(s); }
function $all(s) { return Array.from(doc.querySelectorAll(s)); }
function byText(sel, t) { return $all(sel).find((e) => e.textContent.includes(t)); }
function showAs(s, viewer) {
  runtimeError = null;
  UI.view = 'game'; UI.mode = 'local'; UI.mySeat = null; UI.amount = null;
  UI.localViewer = viewer != null ? viewer : (s.pending ? s.pending.player : (s.turn ? s.turn.active : 0));
  UI.store = DOM.LocalStore(s);
  DOM.render();
  timers.length = 0;
}
// 暗黒時代の広めの王国（各モーダルの獲得候補・混合山を用意）
const K = ['knights', 'marauder', 'cultist', 'pillage', 'rogue', 'urchin', 'death_cart', 'band_of_misfits', 'hermit', 'count'];
function mk(opts) { return E.createInitialState(['あなた', '相手'], K.slice(), Object.assign({ startActive: 0 }, opts || {})); }
function showPend(pd, setup) {
  const s = mk();
  if (setup) setup(s);
  s.pending = pd;
  showAs(s, pd.player);
  return s;
}
function modalOk(label) { return $('.modal') && !runtimeError; }

try {
  console.log('=== 混合山（騎士）の盤面表示 ===');
  {
    const s = mk();
    s.turn.phase = 'buy';
    showAs(s, 0);
    ok(!runtimeError, '暗黒時代の盤面がエラー無く描画できる');
    // 騎士の山は一番上の実騎士の名前を表示する
    const topKnight = s.knights[0];
    ok(byText('.pname', DOM.CARDS[topKnight].name) != null, '騎士の山は一番上「' + DOM.CARDS[topKnight].name + '」を表示');
  }

  console.log('=== 単純系 pending モーダル ===');
  showPend({ type: 'survivors', player: 0, cards: ['copper', 'estate'] });
  ok(modalOk() && byText('*', '生存者'), 'survivors モーダル');
  showPend({ type: 'rats_trash', player: 0 }, (s) => { s.players[0].hand = ['rats', 'copper', 'estate']; });
  ok(modalOk() && byText('*', 'ネズミ'), 'rats_trash モーダル');
  showPend({ type: 'armory', player: 0 });
  ok(modalOk() && byText('*', '武器庫'), 'armory モーダル');
  showPend({ type: 'forager', player: 0 }, (s) => { s.players[0].hand = ['copper', 'estate']; });
  ok(modalOk() && byText('*', '採集者'), 'forager モーダル');
  showPend({ type: 'squire', player: 0 });
  ok(modalOk() && byText('*', '従者'), 'squire モーダル');
  showPend({ type: 'squire_trash_gain', player: 0 });
  ok(modalOk() && byText('*', 'アタック'), 'squire_trash_gain モーダル');
  showPend({ type: 'storeroom', stage: 'discard1', player: 0 }, (s) => { s.players[0].hand = ['copper', 'estate', 'silver']; });
  ok(modalOk() && byText('*', '倉庫'), 'storeroom モーダル');
  showPend({ type: 'scavenger', stage: 'deck', player: 0 });
  ok(modalOk() && byText('*', '清掃'), 'scavenger(deck) モーダル');
  showPend({ type: 'scavenger', stage: 'topdeck', player: 0 }, (s) => { s.players[0].discard = ['copper', 'gold']; });
  ok(modalOk(), 'scavenger(topdeck) モーダル');
  showPend({ type: 'ironmonger', player: 0, card: 'gold' });
  ok(modalOk() && byText('*', '鉄物商'), 'ironmonger モーダル');
  showPend({ type: 'minstrel', player: 0, cards: ['village', 'smithy'] });
  ok(modalOk() && byText('*', '旅の楽団'), 'minstrel モーダル');

  console.log('=== Group A pending モーダル ===');
  showPend({ type: 'junk_dealer', player: 0 }, (s) => { s.players[0].hand = ['copper', 'curse']; });
  ok(modalOk() && byText('*', '屑屋'), 'junk_dealer モーダル');
  showPend({ type: 'mystic', player: 0 });
  ok(modalOk() && byText('*', '秘術師'), 'mystic モーダル（名前宣言）');
  showPend({ type: 'altar', stage: 'trash', player: 0 }, (s) => { s.players[0].hand = ['copper', 'estate']; });
  ok(modalOk() && byText('*', '祭壇'), 'altar(trash) モーダル');
  showPend({ type: 'altar', stage: 'gain', player: 0 });
  ok(modalOk() && byText('*', '祭壇'), 'altar(gain) モーダル');
  showPend({ type: 'catacombs', player: 0, cards: ['gold', 'silver', 'copper'] });
  ok(modalOk() && byText('*', '地下墓所'), 'catacombs モーダル');
  showPend({ type: 'catacombs_trash', player: 0, under: 5 });
  ok(modalOk() && byText('*', '地下墓所'), 'catacombs_trash モーダル');
  showPend({ type: 'hunting_grounds_trash', player: 0 });
  ok(modalOk() && byText('*', '狩場'), 'hunting_grounds_trash モーダル');

  console.log('=== Group B pending モーダル ===');
  showPend({ type: 'graverobber', stage: 'choose', player: 0 });
  ok(modalOk() && byText('*', '墓暴き'), 'graverobber(choose) モーダル');
  showPend({ type: 'graverobber', stage: 'from_trash', player: 0 }, (s) => { s.trash = ['market', 'smithy']; });
  ok(modalOk(), 'graverobber(from_trash) モーダル');
  showPend({ type: 'graverobber', stage: 'trash', player: 0 }, (s) => { s.players[0].hand = ['village', 'copper']; });
  ok(modalOk(), 'graverobber(trash) モーダル');
  showPend({ type: 'graverobber', stage: 'gain', player: 0, maxCost: 5 });
  ok(modalOk(), 'graverobber(gain) モーダル');
  showPend({ type: 'rebuild', stage: 'name', player: 0 });
  ok(modalOk() && byText('*', '建て直し'), 'rebuild(name) モーダル');
  showPend({ type: 'rebuild', stage: 'gain', player: 0, maxCost: 5 });
  ok(modalOk(), 'rebuild(gain) モーダル');
  showPend({ type: 'count', stage: 'part1', player: 0 });
  ok(modalOk() && byText('*', '伯爵'), 'count(part1) モーダル');
  showPend({ type: 'count', stage: 'discard', player: 0, need: 2 }, (s) => { s.players[0].hand = ['copper', 'estate', 'silver']; });
  ok(modalOk(), 'count(discard) モーダル');
  showPend({ type: 'count', stage: 'topdeck', player: 0 }, (s) => { s.players[0].hand = ['copper', 'estate']; });
  ok(modalOk(), 'count(topdeck) モーダル');
  showPend({ type: 'count', stage: 'part2', player: 0 });
  ok(modalOk(), 'count(part2) モーダル');

  console.log('=== Group C pending モーダル ===');
  showPend({ type: 'death_cart', player: 0 }, (s) => { s.players[0].hand = ['village', 'copper']; s.players[0].inPlay = ['death_cart']; });
  ok(modalOk() && byText('*', '死の荷車'), 'death_cart モーダル');
  showPend({ type: 'band_of_misfits', player: 0 });
  ok(modalOk() && byText('*', 'はみだし者'), 'band_of_misfits モーダル');
  showPend({ type: 'hermit', stage: 'trash', player: 0 }, (s) => { s.players[0].hand = ['estate', 'copper']; s.players[0].discard = ['curse']; });
  ok(modalOk() && byText('*', '隠遁者'), 'hermit(trash) モーダル');
  showPend({ type: 'hermit', stage: 'gain', player: 0 });
  ok(modalOk(), 'hermit(gain) モーダル');
  showPend({ type: 'procession', player: 0 }, (s) => { s.players[0].hand = ['village', 'copper']; });
  ok(modalOk() && byText('*', '行進'), 'procession モーダル');
  showPend({ type: 'procession_gain', player: 0, exact: 5, pot: 0 });
  ok(modalOk(), 'procession_gain モーダル');
  showPend({ type: 'counterfeit', player: 0 }, (s) => { s.turn.phase = 'buy'; s.players[0].hand = ['counterfeit', 'copper']; });
  ok(modalOk() && byText('*', '偽造通貨'), 'counterfeit モーダル');

  console.log('=== Group D（アタック）pending モーダル ===');
  showPend({ type: 'marauder', stage: 'react', player: 0, source: 1, victim: 0, queue: [] }, (s) => { s.players[0].hand = ['moat']; });
  ok(modalOk() && byText('*', '略奪者'), 'marauder(react) モーダル');
  showPend({ type: 'cultist', stage: 'react', player: 0, source: 1, victim: 0, queue: [] }, (s) => { s.players[0].hand = ['moat']; });
  ok(modalOk() && byText('*', '狂信者'), 'cultist(react) モーダル');
  showPend({ type: 'cultist_chain', player: 0 });
  ok(modalOk(), 'cultist_chain モーダル');
  showPend({ type: 'pillage', stage: 'react', player: 0, source: 1, victim: 0, queue: [] }, (s) => { s.players[0].hand = ['moat']; });
  ok(modalOk() && byText('*', '略奪'), 'pillage(react) モーダル');
  showPend({ type: 'pillage', stage: 'pick', player: 0, source: 0, victim: 1, queue: [] }, (s) => { s.players[1].hand = ['gold', 'estate', 'copper']; });
  ok(modalOk() && byText('*', '捨てさせる'), 'pillage(pick) モーダル');
  showPend({ type: 'rogue', stage: 'react', player: 0, source: 1, victim: 0, queue: [] }, (s) => { s.players[0].hand = ['moat']; });
  ok(modalOk() && byText('*', '盗賊'), 'rogue(react) モーダル');
  showPend({ type: 'rogue', stage: 'pick', player: 0, source: 1, victim: 0, revealed: ['market', 'smithy'], trashable: ['market', 'smithy'], queue: [] });
  ok(modalOk(), 'rogue(pick) モーダル');
  showPend({ type: 'rogue', stage: 'gain_from_trash', player: 0 }, (s) => { s.trash = ['market', 'gold']; });
  ok(modalOk(), 'rogue(gain_from_trash) モーダル');
  showPend({ type: 'discard_down', player: 0, source: 1, down: 3, queue: [] }, (s) => { s.players[0].hand = ['copper', 'copper', 'estate', 'silver', 'gold']; });
  ok(modalOk() && byText('*', '捨てる'), 'discard_down モーダル');
  showPend({ type: 'mercenary', stage: 'trash', player: 0 }, (s) => { s.players[0].hand = ['copper', 'copper', 'estate']; });
  ok(modalOk() && byText('*', '傭兵'), 'mercenary モーダル');
  showPend({ type: 'urchin_trash', player: 0, deferred: 'cultist' });
  ok(modalOk() && byText('*', '浮浪児'), 'urchin_trash モーダル');

  console.log('=== Group E（騎士）pending モーダル ===');
  showPend({ type: 'knight', stage: 'react', player: 0, source: 1, sourceCard: 'sir_bailey', victim: 0, queue: [] }, (s) => { s.players[0].hand = ['moat']; });
  ok(modalOk() && byText('*', '騎士'), 'knight(react) モーダル');
  showPend({ type: 'knight', stage: 'pick', player: 0, source: 1, sourceCard: 'sir_bailey', victim: 0, revealed: ['market', 'smithy'], trashable: ['market', 'smithy'], queue: [] });
  ok(modalOk(), 'knight(pick) モーダル');
  showPend({ type: 'dame_anna_trash', player: 0 }, (s) => { s.players[0].hand = ['estate', 'curse', 'copper']; });
  ok(modalOk() && byText('*', 'デイム・アンナ'), 'dame_anna_trash モーダル');
  showPend({ type: 'dame_natalie_gain', player: 0 });
  ok(modalOk() && byText('*', 'デイム・ナタリー'), 'dame_natalie_gain モーダル');
} catch (e) {
  fail++;
  console.log('  ✗ EXCEPTION: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n'));
}

console.log('========================================');
console.log('暗黒時代UIスモーク結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
if (fail > 0) process.exit(1);
