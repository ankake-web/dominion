/* 未実装33種（§0-40）の段階2＝UI スモーク（jsdom）
   使い方: node test/missing33-ui.test.js
   主目的＝**engine と CPU は受理するのに UI に導線が無く人間だけ詰む**（本プロジェクト最頻の事故）を構造的に防ぐ。
   新 pending を**直接注入して**描画し、`.modal` が出て**押せるボタンかカードチップが1つ以上ある**ことを見る。 */
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

console.log('=== 第1バッチ：新 pending 10種にモーダルと押せる選択肢がある ===');
{
  const K = ['pearl_diver', 'navigator', 'explorer', 'ghost_ship', 'counting_house', 'mountebank', 'marchland', 'embargo', 'joust', 'ambassador'];
  const PENDINGS = [
    { p: { type: 'pearl_diver', player: 0, card: 'gold' }, jp: '真珠採り' },
    { p: { type: 'navigator', player: 0, cards: ['copper', 'estate', 'silver', 'gold', 'curse'] }, jp: '航海士' },
    { p: { type: 'explorer', player: 0 }, jp: '探検家' },
    { p: { type: 'ghost_ship', stage: 'react', player: 0, source: 1, victim: 0, queue: [] }, jp: '幽霊船（反応）' },
    { p: { type: 'ghost_ship', stage: 'put', player: 0, source: 1, victim: 0, queue: [] }, jp: '幽霊船（置く）' },
    { p: { type: 'counting_house', player: 0, max: 3 }, jp: '会計所' },
    { p: { type: 'loan', player: 0, card: 'silver' }, jp: '借金' },
    { p: { type: 'mountebank', stage: 'react', player: 0, source: 1, victim: 0, queue: [] }, jp: '香具師（反応）' },
    { p: { type: 'mountebank', stage: 'choose', player: 0, source: 1, victim: 0, queue: [] }, jp: '香具師（二択）' },
    { p: { type: 'marchland_discard', player: 0 }, jp: '境界地' },
    // 第2バッチ
    { p: { type: 'embargo_pile', player: 0 }, jp: '抑留（山を選ぶ）' },
    { p: { type: 'pirate_ship', stage: 'react', player: 0, source: 1, victim: 0, queue: [], immune: [] }, jp: '海賊船（反応）' },
    { p: { type: 'pirate_ship', stage: 'choose', player: 0, source: 0, immune: [] }, jp: '海賊船（二択）' },
    { p: { type: 'pirate_ship', stage: 'pick', player: 0, source: 0, victim: 1, revealed: ['silver', 'estate'], treasures: ['silver'], queue: [], anyTrashed: false }, jp: '海賊船（廃棄する財宝）' },
    { p: { type: 'sea_hag', stage: 'react', player: 0, source: 1, victim: 0, queue: [] }, jp: '海の妖婆（反応）' },
    { p: { type: 'ambassador', stage: 'reveal', player: 0 }, jp: '大使（公開）' },
    { p: { type: 'ambassador', stage: 'return', player: 0, card: 'estate', max: 1 }, jp: '大使（戻す枚数）' },
    { p: { type: 'ambassador', stage: 'react', player: 0, source: 1, victim: 0, queue: [], card: 'estate' }, jp: '大使（反応）' },
    { p: { type: 'trade_route_trash', player: 0 }, jp: '交易路（廃棄）' },
    { p: { type: 'contraband_name', player: 0, source: 1 }, jp: '禁制品（指定）' },
    { p: { type: 'summon_gain', player: 0 }, jp: '召喚（獲得）' },
    // 第3バッチ（収穫祭＆ギルド2版）
    { p: { type: 'joust_aside', player: 0 }, jp: '一騎討ち（属州を脇に）' },
    { p: { type: 'joust_reward', player: 0 }, jp: '一騎討ち（褒賞を選ぶ）' },
    { p: { type: 'coronet', stage: 'action', player: 0 }, jp: '宝冠（アクション）' },
    { p: { type: 'coronet', stage: 'treasure', player: 0 }, jp: '宝冠（財宝）' },
    { p: { type: 'courser', player: 0 }, jp: '駿馬' },
    { p: { type: 'courser', player: 0, elder: true }, jp: '駿馬（長老つき＝3つ選ぶ）' },
    { p: { type: 'infirmary_trash', player: 0 }, jp: '診療所（廃棄）' },
    { p: { type: 'shop', player: 0 }, jp: '店' },
    { p: { type: 'farmhands_aside', player: 0 }, jp: '耕作者（脇に置く）' },
    { p: { type: 'ferryman_discard', player: 0 }, jp: '渡し守（捨てる）' },
    { p: { type: 'overpay', player: 0, card: 'farrier', max: 3 }, jp: '装蹄師（過払い）' },
    { p: { type: 'overpay', player: 0, card: 'infirmary', max: 2 }, jp: '診療所（過払い）' },
  ];
  PENDINGS.forEach((row) => {
    const s = E.createInitialState(['あなた', '相手'], K.slice(), { startActive: 0 });
    s.players[0].hand = ['village', 'copper', 'estate', 'moat', 'curse'];
    s.players[0].discard = ['copper', 'copper', 'copper'];
    s.turn.phase = 'buy'; s.turn.coins = 8; s.turn.actions = 1;
    s.pending = row.p;
    showAs(s, 0);
    ok(!runtimeError, row.jp + '：描画で例外が出ない: ' + (runtimeError || ''));
    const modal = doc.querySelector('.modal');
    ok(modal != null, row.jp + '：モーダルが出る');
    if (modal) {
      const btns = modal.querySelectorAll('button:not([disabled])').length;
      const chips = modal.querySelectorAll('.card, .chip, .choose-tile').length;
      ok(btns + chips > 0, row.jp + '：押せる選択肢が1つ以上ある（ボタン' + btns + '／チップ' + chips + '）');
    }
  });
}

/* 2026-08-24: 駿馬(Courser)は公式に長老(Elder)の対象＝長老つきなら「異なる3つ」を選ばせる。
   見出しが「2つ」のままだと、人間は2つしか選べず engine が必ず拒否して詰む。 */
{
  const K = ['joust', 'ferryman', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'laboratory'];
  const s = E.createInitialState(['あなた', '相手'], K.slice(), { startActive: 0 });
  s.turn.phase = 'action'; s.turn.actions = 1;
  s.pending = { type: 'courser', player: 0, elder: true };
  showAs(s, 0);
  const m = doc.querySelector('.modal');
  ok(m && /異なる3つ/.test(m.textContent), '駿馬×長老：モーダルが「異なる3つを選ぶ」と出る');
  const tiles = m ? m.querySelectorAll('.choose-tile') : [];
  ok(tiles.length === 4, '選択肢は4つ（+2カード/+2アクション/+2コイン/銀貨4枚）実:' + tiles.length);
}

/* 任意の窓は**0枚選択のまま辞退できる**（§0-39 の田舎の村で踏んだ穴＝`allowZero:false` だと確定ボタンが無効のまま）。 */
console.log('=== 任意の窓（境界地・会計所）は最初から押せるボタンがある ===');
{
  const K = ['marchland', 'counting_house', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'laboratory'];
  [[{ type: 'marchland_discard', player: 0 }, '境界地'], [{ type: 'counting_house', player: 0, max: 2 }, '会計所']].forEach(([pend, jp]) => {
    const s = E.createInitialState(['あなた', '相手'], K.slice(), { startActive: 0 });
    s.players[0].hand = ['copper', 'estate', 'silver']; s.players[0].discard = ['copper', 'copper'];
    s.turn.phase = 'buy'; s.pending = pend;
    showAs(s, 0);
    const m = doc.querySelector('.modal');
    const btns = m ? Array.from(m.querySelectorAll('button')) : [];
    ok(btns.some((b) => !b.disabled), jp + '：1枚も選ばない状態で押せるボタンがある（実: ' + btns.map((b) => (b.textContent || '').trim() + (b.disabled ? '(無効)' : '')).join(' / ') + '）');
  });
}

/* 真珠採り・航海士・借金の「見ている札」は**相手には伏せる**（オンライン配信＝maskStateFor）＝
   UI 側も相手視点で描いたときにカード名を出さない。 */
console.log('=== 第2バッチ：盤面に 海賊船トークン／交易路マット／抑留トークン／交易路トークン が出る（公開情報）===');
{
  const K = ['pirate_ship', 'trade_route', 'embargo', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop'];
  const s = E.createInitialState(['あなた', '相手'], K.slice(), { startActive: 0 });
  s.players[0].pirateShipTokens = 3; s.tradeRouteMat = 2; s.pileEmbargo = { silver: 2 };
  showAs(s, 0);
  ok(!runtimeError, '描画で例外が出ない: ' + (runtimeError || ''));
  const txt = doc.body.textContent;
  ok(/海賊船/.test(txt) && /3/.test(txt), '海賊船トークンのバッジ（3個）');
  ok(/交易路/.test(txt), '交易路マットのバッジ');
  ok(doc.body.innerHTML.indexOf('⚓2') >= 0, '銀貨の山に抑留トークン2のバッジ');
  ok(doc.body.innerHTML.indexOf('🪙') >= 0, '勝利点の山に交易路トークンのバッジ');
}

console.log('=== 第3バッチ：渡し守の山／一騎討ちの脇／褒賞の山／アクションフェイズの財源ボタン が出る ===');
{
  const K = ['ferryman', 'joust', 'merchant_guild', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop'];
  const s = E.createInitialState(['あなた', '相手'], K.slice(), { startActive: 0 });
  s.players[0].joustAside = ['province']; s.players[0].coffers = 2; s.turn.phase = 'action';
  showAs(s, 0);
  ok(!runtimeError, '描画で例外が出ない: ' + (runtimeError || ''));
  const txt = doc.body.textContent;
  ok(/渡し守の山/.test(txt) && s.ferrymanPile && txt.indexOf(DOM.CARDS[s.ferrymanPile.cards[0]].name) >= 0, '渡し守の山（一番上のカード名）が盤面に出る');
  ok(/一騎討ちの脇/.test(txt), '一騎討ちの脇の属州が出る');
  ok(/名声|駿馬|宝冠/.test(txt), '褒賞の山（非サプライ）が盤面に出る');
  ok(/財源を使う/.test(txt), 'アクションフェイズでも「財源を使う」ボタンが出る（2021ルール）');
}

console.log('=== 相手視点では見ている札の名前が出ない（真珠採り／航海士）===');
{
  const K = ['pearl_diver', 'navigator', 'village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'laboratory'];
  const s = E.createInitialState(['あなた', '相手'], K.slice(), { startActive: 0 });
  s.players[0].hand = ['copper']; s.turn.phase = 'action';
  s.pending = { type: 'navigator', player: 0, cards: ['gold', 'gold', 'gold', 'gold', 'gold'] };
  const m = E.maskStateFor(s, 1);
  ok(m.pending.cards.every((x) => x === 'back'), '航海士：相手への配信では5枚が back');
  s.pending = { type: 'pearl_diver', player: 0, card: 'gold' };
  ok(E.maskStateFor(s, 1).pending.card === 'back', '真珠採り：相手への配信では1枚が back');
}

console.log('\n========================================');
console.log('未実装33種 UIテスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
process.exit(fail ? 1 : 0);
