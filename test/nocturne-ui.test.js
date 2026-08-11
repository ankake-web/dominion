/* 夜想曲（Nocturne）UI スモーク（jsdom）
   使い方: node test/nocturne-ui.test.js
   主目的＝**人間が詰まない／操作できないカードが無い**こと：
   - 夜フェイズで夜行カードが手札に描画され、タップして使えること（純粋な夜行カードは
     アクション/財宝/勝利点のどの群にも入らない＝専用群が無いと1枚も描画されない）。
   - 夜フェイズに購入UI（財宝を出す/購入ボタン）が出ないこと（夜は購入フェイズではない）。
   - 夜想曲の全 pending にモーダルがあり、押せる選択肢が1つ以上あること。 */
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
function $(s) { return doc.querySelector(s); }
function $all(s) { return Array.from(doc.querySelectorAll(s)); }
function byText(sel, t) { return $all(sel).find((e) => e.textContent.includes(t)); }
function showAs(s, viewer) {
  runtimeError = null;
  UI.view = 'game'; UI.mode = 'local'; UI.mySeat = null; UI.amount = null; UI.selection = [];
  UI.pickZoom = null; UI.sheet = null; UI.confirm = null;
  UI.localViewer = viewer != null ? viewer : (s.pending ? s.pending.player : (s.turn ? s.turn.active : 0));
  UI.store = DOM.LocalStore(s);
  DOM.render();
  timers.length = 0;
}
const FILLER = ['village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'laboratory', 'festival', 'mine'];
function king(cards) { return cards.concat(FILLER).slice(0, 10); }
function mk(kingdom, opts) {
  const s = E.createInitialState(['あなた', '相手'], king(kingdom || []), Object.assign({ startActive: 0 }, opts || {}));
  s.players.forEach((p) => { p.hand = []; p.deck = []; p.discard = []; p.inPlay = []; });
  return s;
}
// モーダルが出ていて、押せるもの（ボタン or 選択チップ）が1つ以上あるか＝人間が詰まない
function actionable() {
  if (runtimeError || !$('.modal')) return false;
  const btns = $all('.modal button').filter((b) => !b.disabled);
  const chips = $all('.modal .chip-grid .card, .modal .chip-grid .pick-supply');
  return btns.length + chips.length > 0;
}

try {
  console.log('=== 夜フェイズの操作（N0b） ===');
  {
    const s = mk(['guardian', 'monastery', 'crypt']);
    s.players[0].hand = ['guardian', 'crypt', 'copper', 'estate'];
    s.turn.phase = 'night';
    showAs(s, 0);
    ok(!runtimeError, '夜フェイズの盤面が例外なく描画される');
    ok(byText('.phase', '夜'), 'フェーズ表示が「夜 フェーズ」になる');
    ok(byText('.hg-label', '夜行'), '手札に「夜行」の群が出る');
    // 純粋な夜行カード（守護者・納骨堂）が手札に描画されているか
    const names = $all('.hand-zone .card').map((e) => e.getAttribute('aria-label') || e.textContent);
    ok(names.some((n) => n && n.indexOf('守護者') >= 0), '守護者（純粋な夜行カード）が手札に描画される');
    ok(names.some((n) => n && n.indexOf('納骨堂') >= 0), '納骨堂（純粋な夜行カード）が手札に描画される');
    // 夜フェイズは購入フェイズではない＝財宝/購入のUIを出さない
    ok(!byText('.actions-bar button', '財宝を全部出す'), '夜フェイズに「財宝を全部出す」を出さない');
    ok(byText('.actions-bar button', 'ターンを終える'), '夜フェイズでも「ターンを終える」は押せる');
  }
  {
    // 夜行カードをタップ → 「使う（夜）」で PLAY_NIGHT が飛ぶ
    const s = mk(['guardian']);
    s.players[0].hand = ['guardian', 'copper'];
    s.turn.phase = 'night';
    showAs(s, 0);
    const tile = $all('.hand-zone .card').find((e) => (e.getAttribute('aria-label') || '').indexOf('守護者') >= 0);
    ok(!!tile, '夜行カードのタイルが取れる');
    if (tile) {
      tile.dispatchEvent(new win.Event('click', { bubbles: true }));
      const btn = byText('.sheet button', '使う（夜）') || byText('button', '使う（夜）');
      ok(!!btn, '夜行カードをタップすると「使う（夜）」が出る');
      if (btn) {
        btn.dispatchEvent(new win.Event('click', { bubbles: true }));
        const cur = UI.store.state;
        ok(cur.players[0].inPlay.includes('guardian'), '「使う（夜）」で夜行カードが場に出る（PLAY_NIGHT）');
        ok(cur.turn.actions === 1 && cur.turn.buys === 1, 'アクション権も購入権も減らない');
      }
    }
  }
  {
    // 財宝は夜フェイズでは光らない（engine が拒否する手をUIに出さない）
    const s = mk(['guardian']);
    s.players[0].hand = ['copper', 'guardian'];
    s.turn.phase = 'night';
    showAs(s, 0);
    const cop = $all('.hand-zone .card').find((e) => (e.getAttribute('aria-label') || '').indexOf('銅貨') >= 0);
    ok(cop && cop.className.indexOf('dim') >= 0, '夜フェイズでは財宝は暗く（押せない）表示される');
  }
  {
    // 人狼＝アクションでもある夜行カードはアクション群に出て、夜フェイズでも光る
    const s = mk(['werewolf']);
    s.players[0].hand = ['werewolf'];
    s.turn.phase = 'night';
    showAs(s, 0);
    const w = $all('.hand-zone .card').find((e) => (e.getAttribute('aria-label') || '').indexOf('人狼') >= 0);
    ok(!!w, '人狼が手札に描画される');
    ok(w && w.className.indexOf('dim') < 0, '人狼は夜フェイズで光る（使える）');
  }
  {
    // 初心者モードのコーチ文
    const s = mk(['guardian']);
    s.players[0].hand = ['guardian'];
    s.turn.phase = 'night';
    UI.beginner = true;
    showAs(s, 0);
    ok(byText('.coach-bar', '夜フェーズ'), '初心者モードの案内が夜フェイズ用になる');
    UI.beginner = false;
  }
  /* ============================================================
     N1＝祝福／呪詛／状態の全 pending にモーダルがあり、押せる選択肢が1つ以上あること
     （選択肢ゼロの閉じられないモーダル＝人間が詰む、を防ぐのがこのスイートの主目的）
     ============================================================ */
  console.log('\n=== 祝福／呪詛の選択モーダル（N1） ===');
  function showPend(pd, setup, kingdom) {
    const s = mk(kingdom || ['bard', 'skulk']);
    if (setup) setup(s);
    s.pending = pd;
    showAs(s, pd.player);
    return s;
  }
  const richHand = (s, seat) => {
    s.players[seat == null ? 0 : seat].hand = ['copper', 'estate', 'silver', 'village', 'gold'];
    s.players[seat == null ? 0 : seat].deck = ['gold', 'duchy', 'copper', 'estate'];
    s.players[seat == null ? 0 : seat].discard = ['militia', 'moat'];
  };
  [
    ['boon_wind', { type: 'boon_wind', player: 0 }, null],
    ['boon_flame', { type: 'boon_flame', player: 0 }, null],
    ['boon_earth', { type: 'boon_earth', player: 0 }, null],
    ['boon_earth_gain', { type: 'boon_earth_gain', player: 0 }, null],
    ['boon_sky', { type: 'boon_sky', player: 0 }, null],
    ['boon_moon', { type: 'boon_moon', player: 0 }, null],
    ['look_arrange', { type: 'look_arrange', player: 0, cards: ['copper', 'gold', 'estate', 'village'], source: 'the_suns_gift' }, null],
    ['hex(react)', { type: 'hex', stage: 'react', player: 0, source: 1, victim: 0, queue: [], accepted: [] }, null],
    ['hex_poverty', { type: 'hex_poverty', player: 0 }, null],
    ['hex_fear', { type: 'hex_fear', player: 0 }, null],
    ['hex_haunting', { type: 'hex_haunting', player: 0 }, null],
    ['hex_locusts', { type: 'hex_locusts', player: 0, ref: 'gold', coin: 6, pot: 0, debt: 0 }, null],
    ['lost_in_the_woods', { type: 'lost_in_the_woods', player: 0 }, null],
  ].forEach(([name, pd, kd]) => {
    showPend(pd, richHand, kd);
    ok(actionable(), name + ' のモーダルに押せる選択肢がある');
  });
  {
    // 夜想曲の全モーダルが「モーダルは出るが押せない」状態にならないか（空手札/空捨て札の極端値）
    showPend({ type: 'boon_moon', player: 0 }, (s) => { s.players[0].discard = []; });
    ok(actionable(), '月の恵み＝捨て札が空でも「置かない」で閉じられる');
    showPend({ type: 'boon_flame', player: 0 }, (s) => { s.players[0].hand = []; });
    ok(actionable(), '炎の恵み＝手札が空でも「廃棄しない」で閉じられる');
    showPend({ type: 'boon_earth', player: 0 }, (s) => { s.players[0].hand = ['estate']; });
    ok(actionable(), '大地の恵み＝財宝が無くても「捨てない」で閉じられる');
  }
  {
    // 空の恵み＝手札3枚未満でも「捨てる（金貨は得られません）」が押せる
    const s = showPend({ type: 'boon_sky', player: 0 }, (st) => { st.players[0].hand = ['copper', 'estate']; });
    UI.selection = [0, 1]; DOM.render();
    ok(byText('.modal button', '金貨は得られません'), '空の恵み＝3枚未満のときは「金貨は得られません」と明示する');
  }
  console.log('\n=== 王国カード／家宝／夜行／複雑系の選択モーダル（N2〜N4） ===');
  {
    const rich = (s, seat) => {
      const i = seat == null ? 0 : seat;
      s.players[i].hand = ['copper', 'estate', 'silver', 'village', 'gold'];
      s.players[i].deck = ['gold', 'duchy', 'copper', 'estate'];
      s.players[i].discard = ['militia', 'moat'];
      s.players[i].inPlay = ['copper', 'silver', 'gold'];
    };
    [
      ['blessed_village_boon', { type: 'blessed_village_boon', player: 0, boon: 'the_seas_gift' }, ['blessed_village']],
      ['cemetery_trash', { type: 'cemetery_trash', player: 0 }, ['cemetery']],
      ['conclave', { type: 'conclave', player: 0 }, ['conclave']],
      ['druid_boon', { type: 'druid_boon', player: 0 }, ['druid']],
      ['boon_choose', { type: 'boon_choose', player: 0 }, ['fool'], (st) => { st.turn.boonChoice = { player: 0, boons: ['the_seas_gift', 'the_mountains_gift'] }; }],
      ['grove_offer', { type: 'grove_offer', player: 0, boon: 'the_mountains_gift' }, ['sacred_grove']],
      ['pixie_trash', { type: 'pixie_trash', player: 0, boon: 'the_mountains_gift' }, ['pixie']],
      ['pooka_trash', { type: 'pooka_trash', player: 0 }, ['pooka']],
      ['secret_cave', { type: 'secret_cave', player: 0 }, ['secret_cave']],
      ['shepherd_discard', { type: 'shepherd_discard', player: 0 }, ['shepherd']],
      ['tragic_hero_gain', { type: 'tragic_hero_gain', player: 0 }, ['tragic_hero']],
      ['goat_trash', { type: 'goat_trash', player: 0 }, ['pixie']],
      ['haunted_mirror', { type: 'haunted_mirror', player: 0 }, ['cemetery']],
      ['faithful_hound_react', { type: 'faithful_hound_react', player: 0 }, ['faithful_hound']],
      ['idol(react)', { type: 'idol', stage: 'react', player: 0, source: 1, victim: 0, queue: [] }, ['idol']],
      ['cobbler_gain', { type: 'cobbler_gain', player: 0 }, ['cobbler']],
      ['crypt_setaside', { type: 'crypt_setaside', player: 0 }, ['crypt']],
      ['devils_workshop_gain', { type: 'devils_workshop_gain', player: 0 }, ['devils_workshop']],
      ['exorcist_trash', { type: 'exorcist_trash', player: 0 }, ['exorcist']],
      ['exorcist_gain', { type: 'exorcist_gain', player: 0, coin: 5, pot: 0, debt: 0 }, ['exorcist']],
      ['monastery', { type: 'monastery', player: 0, remaining: 2 }, ['monastery']],
      ['raider(react)', { type: 'raider', stage: 'react', player: 0, source: 1, victim: 0, queue: [] }, ['raider']],
      ['imp_play', { type: 'imp_play', player: 0 }, ['devils_workshop']],
      ['wish_gain', { type: 'wish_gain', player: 0 }, ['leprechaun']],
      ['changeling_gain', { type: 'changeling_gain', player: 0 }, ['changeling']],
      ['changeling_exchange', { type: 'changeling_exchange', player: 0, card: 'gold', dest: 'discard' }, ['changeling']],
      ['bat_trash', { type: 'bat_trash', player: 0 }, ['vampire']],
      ['vampire_gain', { type: 'vampire_gain', player: 0 }, ['vampire']],
      ['necromancer', { type: 'necromancer', player: 0 }, ['necromancer']],
      ['ghost_play', { type: 'ghost_play', player: 0, card: 'village' }, ['cemetery']],
      ['zombie_apprentice', { type: 'zombie_apprentice', player: 0 }, ['necromancer']],
      ['zombie_mason_gain', { type: 'zombie_mason_gain', player: 0, coin: 4, pot: 0, debt: 0 }, ['necromancer']],
      ['zombie_spy', { type: 'zombie_spy', player: 0, card: 'curse' }, ['necromancer']],
    ].forEach(([name, pd, kd, extra]) => {
      showPend(pd, (st) => { rich(st); if (extra) extra(st); }, kd);
      ok(actionable(), name + ' のモーダルに押せる選択肢がある');
    });
  }
  {
    // 夜襲の「捨てる」＝相手の場にあるカードと同名のものだけが選べる
    const s = mk(['raider']);
    s.players[1].inPlay = ['copper', 'silver'];
    s.players[0].hand = ['copper', 'estate', 'estate', 'estate', 'estate'];
    s.pending = { type: 'raider', stage: 'discard', player: 0, source: 1, victim: 0, queue: [] };
    showAs(s, 0);
    ok(actionable(), '夜襲の「捨てる」モーダルに押せる選択肢がある');
  }
  {
    // 修道院＝手札が空でも「場の銅貨」と「やめる」で閉じられる
    const s = mk(['monastery']);
    s.players[0].hand = []; s.players[0].inPlay = ['copper'];
    s.pending = { type: 'monastery', player: 0, remaining: 1 };
    showAs(s, 0);
    ok(actionable(), '修道院＝手札が空でも閉じられる');
  }
  console.log('\n=== 敵対レビュー回帰: 盤面表示と押せないボタン ===');
  {
    // 非サプライ5山（精霊3／願い／コウモリ）が盤面に出る
    const s = mk(['exorcist', 'vampire', 'leprechaun']);
    showAs(s, 0);
    ok(byText('.sup-title', '非サプライ'), '非サプライの節が出る');
    const pile = (id) => $all('.pile').find((e) => e.getAttribute('data-pile') === id);
    ['will_o_wisp', 'imp', 'ghost', 'wish', 'bat'].forEach((id) => ok(!!pile(id), id + ' の山が盤面に出る'));
  }
  {
    // 状態・保持中の祝福・脇札が盤面に出る
    const s = mk(['bard', 'skulk', 'crypt', 'cemetery']);
    s.players[0].deluded = true; s.players[0].misery = 2;
    s.players[0].boonsInFront = ['the_fields_gift'];
    s.players[0].boonsHeld = ['the_seas_gift'];
    s.players[0].ghostSetAside = ['village'];
    s.players[0].cryptSetAside = ['gold'];
    s.lostInTheWoods = 0;
    showAs(s, 0);
    ok(!runtimeError, '状態つきの盤面が例外なく描画される');
    ok(byText('.mat-row', '錯乱') && byText('.mat-row', '二重苦'), '状態が盤面に出る');
    ok(byText('.mat-row', '森の迷子'), '森の迷子が盤面に出る');
    ok(byText('.mat-row', '田畑の恵み') && byText('.mat-row', '次のターンに受ける'), '祝福（前に置く/保持）が盤面に出る');
    ok(byText('.mat-row', '幽霊の脇') && byText('.mat-row', '納骨堂の脇'), '脇札が盤面に出る');
    ok(byText('.mat-row', '祝福 山') && byText('.mat-row', '呪詛 山'), '祝福/呪詛の山の残枚数が出る');
  }
  {
    // 呪われた金貨しか無いときは「財宝を全部出す」を押せない（engine が出さない＝押せても何も起きない）
    const s = mk(['pooka']);
    s.players[0].hand = ['cursed_gold'];
    s.turn.phase = 'buy';
    showAs(s, 0);
    const btn = byText('.actions-bar button', '財宝を全部出す');
    ok(btn && btn.disabled, '呪われた金貨だけなら「財宝を全部出す」は押せない');
    UI.beginner = true; showAs(s, 0);
    ok(byText('.coach-bar', '呪われた金貨'), '初心者モードの案内が「タップして使う」に切り替わる');
    UI.beginner = false;
  }
  {
    // 錯乱中は闇市場のアクションカードも押せない
    const s = mk(['black_market', 'village']);
    s.turn.cantBuyActions = true; s.turn.coins = 8;
    s.pending = { type: 'black_market', stage: 'play', player: 0, revealed: ['village', 'silver'] };
    showAs(s, 0);
    ok(actionable(), '闇市場のモーダルは閉じられる');
    // 押せないチップは onClick が付かない＝aria-label も無いので、公開順（村・銀貨）とクラスで見る
    const chips = $all('.modal .pick-supply .card');
    ok(chips.length === 2 && chips[0].className.indexOf('disabled') >= 0,
      '錯乱中は闇市場のアクションカード（村）が押せない');
    ok(chips[1].className.indexOf('selectable') >= 0, '銀貨は買える');
  }
  {
    // 錯乱＝アクションカードの購入ボタンを出さない（engine 拒否とUIを揃える）
    const s = mk(['bard', 'skulk']);
    s.turn.phase = 'buy'; s.turn.coins = 8; s.turn.buys = 1; s.turn.cantBuyActions = true;
    showAs(s, 0);
    ok(!runtimeError, '錯乱が効いている盤面が例外なく描画される');
    const pile = (id) => $all('.pile').find((e) => e.getAttribute('data-pile') === id);
    ok(pile('village') && pile('village').className.indexOf('buyable') < 0, '錯乱中はアクションカードの山が「買える」表示にならない');
    ok(pile('silver') && pile('silver').className.indexOf('buyable') >= 0, '錯乱中でも銀貨は買える');
  }
} catch (e) {
  fail++; console.log('  x 例外: ' + (e && e.stack ? e.stack : e));
}

console.log('\n========================================');
console.log(`夜想曲UIテスト結果: ${pass} 件成功, ${fail} 件失敗`);
console.log('========================================');
process.exit(fail ? 1 : 0);
