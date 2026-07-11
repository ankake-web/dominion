/* 帝国（Empires）UI スモーク（jsdom）
   各 pending の選択モーダルと盤面（負債バッジ・山上VPトークン・城の混合山・分割山）が
   エラー無く描画できるかを確認する。使い方: node test/empires-ui.test.js
   ※ Phase E（CARD_SET昇格）で本番に出るセット＝'empires' の全カードを網羅する。 */
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
  UI.view = 'game'; UI.mode = 'local'; UI.mySeat = null; UI.amount = null; UI.selection = [];
  UI.localViewer = viewer != null ? viewer : (s.pending ? s.pending.player : (s.turn ? s.turn.active : 0));
  UI.store = DOM.LocalStore(s);
  DOM.render();
  timers.length = 0;
}
// 出荷セット「帝国セット」の固定10種＝負債/集合(山上VP)/分割山2組/城/命令/冠/ヴィラ/アタックを網羅
const K = DOM.KINGDOM_EMPIRES.slice();
function mk(opts) { return E.createInitialState(['あなた', '相手'], K.slice(), Object.assign({ startActive: 0 }, opts || {})); }
function showPend(pd, setup) {
  const s = mk();
  if (setup) setup(s);
  s.pending = pd;
  showAs(s, pd.player);
  return s;
}
function modalOk() { return $('.modal') && !runtimeError; }

try {
  console.log('=== 盤面（負債バッジ・山上VPトークン・城の混合山・分割山）の描画 ===');
  {
    const s = mk(); s.turn.phase = 'buy';
    s.players[0].debt = 6; s.players[0].vpTokens = 3;
    s.pileVP = { temple: 2, wild_hunt: 1 };
    showAs(s, 0);
    ok(!runtimeError, '帝国の盤面（負債・山上VP・城・分割山）がエラー無く描画できる');
    ok($('.pile-vp') != null, 'サプライ山に山上VPトークンのバッジが出る');
    ok(byText('button', '返済') != null || byText('.badge', '負債') != null || doc.body.textContent.includes('負債'), '負債バッジ/返済ボタンが出る');
    ok(byText('.pname', DOM.CARDS.humble_castle.name) != null, '城の山は一番上（粗末な城）を表示する');
    ok(byText('.pname', DOM.CARDS.settlers.name) != null && byText('.pname', DOM.CARDS.catapult.name) != null, '分割山は上段（開拓者・投石機）を表示する');
  }
  {
    // 城を買い進めて一番上が変わると表示も変わる
    const s = mk(); s.turn.phase = 'buy';
    s.castles.shift(); s.castles.shift(); s.supply.castles = s.castles.length;
    showAs(s, 0);
    ok(!runtimeError && byText('.pname', DOM.CARDS.small_castle.name) != null, '城を2枚取ると一番上＝小さい城の表示になる');
  }
  {
    // 上段が尽きたら下段（騒がしい村・石）が見える
    const s = mk(); s.turn.phase = 'buy';
    s.supply.settlers = 0; s.supply.catapult = 0;
    showAs(s, 0);
    ok(!runtimeError && byText('.pname', DOM.CARDS.bustling_village.name) != null, '上段が尽きると下段（騒がしい村）が見える');
  }

  console.log('=== 各 pending のモーダル描画（帝国セットの全カード） ===');
  // 大君主（命令）
  showPend({ type: 'overlord', player: 0 });
  ok(modalOk() && $('.modal').textContent.includes('大君主'), '大君主：サプライから使うカードを選ぶモーダル');
  ok(!$('.modal').textContent.includes(DOM.CARDS.engineer.name), '大君主モーダルに負債カード（技術者）が出ない');
  ok($('.modal').textContent.includes(DOM.CARDS.forum.name), '大君主モーダルに $5以下の非負債アクション（公共広場）が出る');

  // 冠（アクション／財宝の2モード）
  showPend({ type: 'crown', mode: 'action', player: 0 }, (s) => { s.players[0].hand = ['crown', 'settlers', 'forum']; });
  ok(modalOk(), '冠（アクション）：手札のアクションを2回使うモーダル');
  showPend({ type: 'crown', mode: 'treasure', player: 0 }, (s) => { s.turn.phase = 'buy'; s.players[0].hand = ['crown', 'copper', 'silver']; });
  ok(modalOk(), '冠（財宝）：手札の財宝を2回使うモーダル');

  // 技術者（負債・多段）
  showPend({ type: 'engineer', stage: 'gain1', player: 0 });
  ok(modalOk(), '技術者：1枚目の獲得モーダル');
  showPend({ type: 'engineer', stage: 'maytrash', player: 0 }, (s) => { s.players[0].inPlay = ['engineer']; });
  ok(modalOk(), '技術者：自己廃棄の選択モーダル');
  showPend({ type: 'engineer', stage: 'gain2', player: 0 });
  ok(modalOk(), '技術者：2枚目の獲得モーダル');

  // 神殿（集合）
  showPend({ type: 'temple_trash', player: 0 }, (s) => { s.players[0].hand = ['copper', 'copper', 'estate', 'villa']; });
  ok(modalOk(), '神殿：名前の異なる1〜3枚を廃棄するモーダル');

  // ワイルドハント（集合の二択）
  showPend({ type: 'wild_hunt', player: 0 }, (s) => { s.pileVP = { wild_hunt: 3 }; });
  ok(modalOk(), 'ワイルドハント：二択モーダル');

  // 公共広場
  showPend({ type: 'forum', player: 0 }, (s) => { s.players[0].hand = ['copper', 'estate', 'villa', 'crown']; });
  ok(modalOk(), '公共広場：手札2枚を捨てるモーダル');

  // 投石機（アタック）
  showPend({ type: 'catapult', stage: 'trash', player: 0 }, (s) => { s.players[0].hand = ['copper', 'estate', 'silver']; });
  ok(modalOk(), '投石機：手札1枚を廃棄するモーダル');
  showPend({ type: 'catapult', stage: 'react', player: 1, queue: [1], source: 0 }, (s) => { s.players[1].hand = ['moat', 'copper']; });
  ok(modalOk() || !runtimeError, '投石機：被害者のリアクション窓');
  showPend({ type: 'discard_down', player: 1, target: 3, source: 0, queue: [] }, (s) => { s.players[1].hand = ['copper', 'copper', 'estate', 'silver', 'gold']; });
  ok(modalOk(), '投石機：手札3枚まで捨てるモーダル');

  // 開拓者／騒がしい村（分割山）
  showPend({ type: 'settlers', player: 0 }, (s) => { s.players[0].discard = ['copper', 'estate']; });
  ok(modalOk(), '開拓者：捨て札から銅貨を手札に加えるモーダル');
  showPend({ type: 'bustling_village', player: 0 }, (s) => { s.players[0].discard = ['settlers', 'estate']; });
  ok(modalOk(), '騒がしい村：捨て札から開拓者を手札に加えるモーダル');

  // 城（混合山の on-gain 対話）
  showPend({ type: 'small_castle', player: 0 }, (s) => { s.players[0].inPlay = ['small_castle']; s.players[0].hand = ['humble_castle']; });
  ok(modalOk(), '小さい城：これか手札の城を廃棄するモーダル');
  showPend({ type: 'opulent_castle', player: 0 }, (s) => { s.players[0].hand = ['estate', 'duchy', 'copper']; });
  ok(modalOk(), '華やかな城：勝利点カードを公開して捨てるモーダル');
  showPend({ type: 'sprawling_castle', player: 0 });
  ok(modalOk(), '広大な城：公領1枚か屋敷3枚の選択モーダル');
  showPend({ type: 'haunted_topdeck', player: 1, queue: [], source: 0 }, (s) => { s.players[1].hand = ['copper', 'copper', 'estate', 'silver', 'gold']; });
  ok(modalOk(), '幽霊城：手札2枚を山札の上に置くモーダル');

  console.log('=== 帝国セット外（random-empires で出る）主要 pending も描画できる ===');
  showPend({ type: 'sacrifice', stage: 'trash', player: 0 }, (s) => { s.players[0].hand = ['copper', 'estate']; });
  ok(modalOk(), '生贄：手札1枚を廃棄するモーダル');
  showPend({ type: 'charm_mode', player: 0 }, (s) => { s.turn.phase = 'buy'; });
  ok(modalOk(), '御守り：二択モーダル');
  showPend({ type: 'charm_gain', player: 0, coin: 3, debt: 0, pot: 0, gained: 'silver' });
  ok(modalOk(), '御守り：同コストのカードを獲得するモーダル');
  showPend({ type: 'archive_pick', player: 0, archiveId: 1 }, (s) => { s.players[0].archives = [{ id: 1, cards: ['copper', 'estate', 'gold'] }]; });
  ok(modalOk(), '資料庫：脇のカードから1枚を手札に加えるモーダル');
  showPend({ type: 'legionary_reveal', player: 0 }, (s) => { s.players[0].hand = ['gold', 'copper']; });
  ok(modalOk(), '軍団兵：金貨を公開するかのモーダル');
  showPend({ type: 'encampment_reveal', player: 0 }, (s) => { s.players[0].hand = ['gold']; s.players[0].inPlay = ['encampment']; });
  ok(modalOk(), '陣地：金貨/鹵獲品を公開するかのモーダル');
  showPend({ type: 'gladiator', stage: 'reveal', player: 0 }, (s) => { s.players[0].hand = ['copper', 'estate']; });
  ok(modalOk(), '剣闘士：手札1枚を公開するモーダル');
  showPend({ type: 'enchantress', player: 1, queue: [], source: 0 }, (s) => { s.players[1].hand = ['moat']; });
  ok(modalOk() || !runtimeError, '女魔術師：被害者のリアクション窓');

  console.log('=== カード一覧に帝国・城のグループが出る ===');
  {
    runtimeError = null;
    UI.view = 'cardList'; DOM.render();
    ok(!runtimeError, 'カード一覧がエラー無く描画できる');
    ok(doc.body.textContent.includes('王国カード（帝国）'), '「王国カード（帝国）」グループが出る');
    ok(doc.body.textContent.includes('城（帝国・混合山）'), '「城（帝国・混合山）」グループが出る');
    ok(doc.body.textContent.includes(DOM.CARDS.kings_castle.name), '城8種（王城）が一覧に出る');
  }

  console.log('=== セット選択に「帝国セット」「帝国から」が出る ===');
  {
    ok(DOM.CARD_SETS.some((s) => s.id === 'empires') && DOM.CARD_SETS.some((s) => s.id === 'random-empires'), 'CARD_SETS に empires / random-empires がある');
    // 「拡張」分類のタイル（kind:'standard' の basic/intrigue 以外）から選べること
    runtimeError = null;
    UI.view = 'setup'; UI.setup.kingdomSet = 'empires'; DOM.render();
    ok(!runtimeError, 'セットアップ画面がエラー無く描画できる');
    const txt = doc.body.textContent;
    ok(txt.includes('帝国セット'), '「拡張」タイルに帝国セットが出る');
    ok(txt.includes('海辺セット（第二版）') && txt.includes('冒険セット'), '「拡張」タイルに他の拡張固定セットも出る');
    ok(txt.includes(DOM.CARDS.overlord.name), '収録カードのプレビューに大君主が出る');
    // ランダム分類に「帝国から」
    runtimeError = null;
    UI.setup.kingdomSet = 'random-empires'; DOM.render();
    ok(!runtimeError && doc.body.textContent.includes('帝国'), '「ランダム」分類に帝国からが出る');
    UI.setup.kingdomSet = 'basic';
  }

  console.log('=== 帝国：横型ランドスケープ（ランドマーク）のUI ===');
  {
    // 盤面にランドマーク帯（名前・残VP・溜VP・オベリスク対象）が出る
    const s = mk({ landmarks: ['arena', 'aqueduct'] });
    s.turn.phase = 'buy'; s.landmarkStash = { aqueduct: 2 };
    showAs(s, 0);
    ok(!runtimeError, '盤面にランドマーク帯がエラー無く描画できる');
    ok(doc.body.textContent.includes('ランドマーク') && doc.body.textContent.includes(DOM.LANDSCAPES.arena.name), '盤面にランドマーク名（闘技場）が出る');
    ok(doc.body.textContent.includes('残VP') || doc.body.textContent.includes('溜VP'), 'ランドマーク帯に残VP/溜VPが出る');
    // 闘技場モーダル
    showPend({ type: 'arena', player: 0 }, (x) => { x.landmarks = ['arena']; x.landmarkVP = { arena: 12 }; x.players[0].hand = ['engineer', 'copper']; });
    ok(modalOk(), '闘技場：アクションを捨てるモーダル');
    // 峠の入札モーダル
    showPend({ type: 'mountain_pass_bid', player: 0, order: [1, 0], idx: 1, bids: { 1: 3 }, highest: 3, highBidder: 1 }, (x) => { x.landmarks = ['mountain_pass']; });
    ok(modalOk(), '峠：入札の数量モーダル');
    ok(doc.body.textContent.includes('競り') || doc.body.textContent.includes('入札'), '峠モーダルに競り/入札の文言が出る');
    // オベリスク対象の表示
    const s2 = mk({ landmarks: ['obelisk'] }); s2.turn.phase = 'buy'; showAs(s2, 0);
    ok(!runtimeError, 'オベリスクの盤面表示がエラー無く描画できる');
    // ランドマークのアート表示（盤面サムネ・タップ拡大・カード一覧）
    const s3 = mk({ landmarks: ['museum', 'arena'] }); s3.turn.phase = 'buy'; showAs(s3, 0);
    ok($('.landmark-thumb') != null, '盤面ランドマーク帯にアートのサムネ画像が出る');
    ok($('.landmark-thumb').getAttribute('src').indexOf('.webp') >= 0, 'サムネの src が webp を指す');
    UI.lmZoom = 'museum'; runtimeError = null; DOM.render();
    ok($('.scrim') != null && !runtimeError, 'ランドマークのタップ拡大オーバーレイが描画できる');
    ok(doc.body.textContent.includes(DOM.LANDSCAPES.museum.name), '拡大に博物館の名前が出る');
    UI.lmZoom = null;
    runtimeError = null; UI.view = 'cardList'; DOM.render();
    ok(!runtimeError && doc.body.textContent.includes('ランドマーク（帝国・横型）'), 'カード一覧にランドマーク群が出る');
    ok($all('.landmark-mini img').length === DOM.LANDMARKS_EMPIRES.length, 'カード一覧に全ランドマークのアートが並ぶ');
    UI.view = 'setup';
    // セット選択に empires-landmarks
    ok(DOM.CARD_SETS.some((x) => x.id === 'empires-landmarks'), 'CARD_SETS に empires-landmarks がある');
    runtimeError = null; UI.view = 'setup'; UI.setup.kingdomSet = 'empires-landmarks'; DOM.render();
    ok(!runtimeError && doc.body.textContent.includes('帝国＋ランドマーク'), '「拡張」タイルに帝国＋ランドマークが出る');
    UI.setup.kingdomSet = 'basic';
  }

  console.log('=== 帝国：横型イベント（買う横型）のUI ===');
  {
    const s = mk({ events: ['delve', 'wedding'] }); s.turn.phase = 'buy'; s.turn.coins = 8; s.turn.buys = 1;
    showAs(s, 0);
    ok(!runtimeError, 'イベント帯がエラー無く描画できる');
    ok(doc.body.textContent.includes('イベント') && doc.body.textContent.includes(DOM.LANDSCAPES.delve.name), '盤面にイベント名（掘進）が出る');
    ok(byText('button', '買う') != null, 'イベントに「買う」ボタンが出る');
    // 各イベント pending のモーダル
    showPend({ type: 'salt_the_earth', player: 0 }, (x) => { x.events = ['salt_the_earth']; });
    ok(modalOk(), '塩まき：廃棄モーダル');
    showPend({ type: 'banquet', player: 0 }, (x) => { x.events = ['banquet']; });
    ok(modalOk(), '宴会：獲得モーダル');
    showPend({ type: 'advance', stage: 'trash', player: 0 }, (x) => { x.events = ['advance']; x.players[0].hand = ['village', 'copper']; });
    ok(modalOk(), '昇進：廃棄モーダル');
    showPend({ type: 'advance', stage: 'gain', player: 0 }, (x) => { x.events = ['advance']; });
    ok(modalOk(), '昇進：獲得モーダル');
    showPend({ type: 'ritual', player: 0 }, (x) => { x.events = ['ritual']; x.players[0].hand = ['gold']; });
    ok(modalOk(), '儀式：廃棄モーダル');
    // EV2＝tax / donate / annex
    {
      const s2 = mk({ events: ['tax'] }); s2.turn.phase = 'buy';
      showAs(s2, 0);
      ok($('.pile-debt') != null, '徴税：サプライ山に負債トークンのバッジ（🟠）が出る');
    }
    showPend({ type: 'tax_pile', player: 0 }, (x) => { x.events = ['tax']; });
    ok(modalOk(), '徴税：山選択モーダル');
    showPend({ type: 'donate_trash', player: 0 }, (x) => { x.events = ['donate']; x.players[0].hand = ['copper', 'estate', 'silver', 'gold', 'curse']; });
    ok(modalOk(), '寄付：廃棄モーダル');
    showPend({ type: 'annex_keep', player: 0 }, (x) => { x.events = ['annex']; x.players[0].discard = ['copper', 'estate', 'silver', 'gold', 'curse', 'village']; });
    ok(modalOk() && doc.body.textContent.includes('併合'), '併合：捨て札から残す選択モーダル');
  }
} catch (e) {
  fail++;
  console.log('  ✗ 例外: ' + e.message + '\n' + (e.stack || '').split('\n').slice(1, 3).join('\n'));
}

console.log('\n' + (fail === 0 ? '✅ 帝国UI 全' + pass + '件 PASS' : '❌ 帝国UI ' + fail + '件 FAIL / ' + pass + '件 PASS'));
if (fail > 0) process.exit(1);
