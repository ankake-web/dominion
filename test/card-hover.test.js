/* カードに触れるだけで正本の効果を読む。タップ・クリック・伏せ札の境界も守る。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><div id="app"></div>', {
  url: 'https://example.com/', runScripts: 'outside-only', pretendToBeVisual: true,
});
const win = dom.window, doc = win.document;
let mouse = true, now = 0, nextTimer = 0;
const timers = new Map();
win.matchMedia = () => ({ matches: mouse });
win.setTimeout = (fn, ms = 0) => { const id = ++nextTimer; timers.set(id, { fn, due: now + ms }); return id; };
win.clearTimeout = (id) => timers.delete(id);
function advance(ms) {
  now += ms;
  for (const [id, t] of [...timers]) if (t.due <= now) { timers.delete(id); t.fn(); }
}
for (const f of ['cards', 'engine', 'cpu', 'store', 'net', 'audio', 'ui']) {
  win.eval(fs.readFileSync(path.join(__dirname, '../js/' + f + '.js'), 'utf8'));
}
doc.dispatchEvent(new win.Event('DOMContentLoaded'));
const D = win.DOM, UI = D.UI;
const state = D.engine.createInitialState([{ name: 'A' }, { name: 'B' }],
  ['village', 'smithy', 'market', 'moat', 'militia', 'cellar', 'knights', 'chapel', 'laboratory', 'festival'],
  { startActive: 0, events: ['borrow'] });
state.players[0].hand = ['village'];
state.players[0].inPlay = ['smithy'];
state.players[0].durationCards = ['wharf'];
UI.store = new D.LocalStore(state); UI.mode = 'local'; UI.view = 'game'; D.render();
timers.clear();
const $ = (selector) => doc.querySelector(selector);
const preview = () => $('.card-hover-preview');
const card = (id) => $('[data-pile="' + id + '"]');
function pointer(target, type = 'pointerover', relatedTarget = null, pointerType = 'mouse') {
  const e = new win.MouseEvent(type, { bubbles: true, relatedTarget });
  Object.defineProperty(e, 'pointerType', { value: pointerType });
  target.dispatchEvent(e);
}
function dismiss() { doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); }

const before = JSON.stringify(state);
const village = card('village');
village.setAttribute('aria-describedby', 'existing-description');
pointer(village); advance(259); assert(!preview(), '通過しただけでは表示しない');
advance(1);
assert(preview());
assert.equal($('.card-hover-name').textContent, '村');
assert.equal($('.card-hover-text').textContent, D.CARDS.village.text);
assert.equal(village.getAttribute('aria-describedby'), 'existing-description card-hover-preview');
assert.equal(JSON.stringify(state), before, '効果表示だけではゲームを操作しない');
pointer(village, 'pointerout', doc.body); pointer(doc.body); advance(140);
assert(!preview(), 'カードから離れると閉じる');
assert.equal(village.getAttribute('aria-describedby'), 'existing-description');

pointer(village); pointer(village, 'pointerout', doc.body); advance(300);
assert(!preview(), '表示前に離れたらタイマーを取り消す');
pointer(village); advance(260);
let panel = preview();
pointer(village, 'pointerout', panel); pointer(panel); advance(200);
assert.equal(preview(), panel, '説明欄へ移動しても読める');
pointer(panel, 'pointerout', doc.body); pointer(doc.body); advance(140);
assert(!preview());

pointer(village); advance(260);
pointer(card('smithy')); advance(260);
assert.equal($('.card-hover-name').textContent, '鍛冶屋');
assert.equal(doc.querySelectorAll('.card-hover-preview').length, 1);
dismiss(); assert(!preview());
village.focus();
assert(preview(), 'キーボードフォーカスでも説明を表示');
win.dispatchEvent(new win.Event('resize')); assert(!preview());
village.blur();

const mixed = card('knights');
assert.equal(mixed.dataset.cardPreview, state.knights[0], '混合山は現在の一番上のカード');
pointer(mixed); advance(260);
assert.equal($('.card-hover-text').textContent, D.CARDS[state.knights[0]].text);
D.render(); assert(!preview(), '再描画時に古い説明を消す'); timers.clear();
const event = $('.event-row');
const originalTitle = event.getAttribute('title');
pointer(event); advance(260);
assert.equal($('.card-hover-text').textContent, D.LANDSCAPES.borrow.text);
assert.equal(event.getAttribute('title'), null, 'ブラウザ標準の説明との二重表示を避ける');
dismiss(); assert.equal(event.getAttribute('title'), originalTitle);
for (const id of ['smithy', 'wharf']) {
  pointer($('.play-area [data-card-preview="' + id + '"]')); advance(260);
  assert.equal($('.card-hover-text').textContent, D.CARDS[id].text); dismiss();
}
const hand = $('.hand-cards [data-card-preview="village"]');
pointer(hand); advance(260); assert(preview());
doc.dispatchEvent(new win.Event('scroll')); assert(!preview());
mouse = false;
pointer(card('village')); advance(300); assert(!preview(), 'ホバー非対応端末では出さない');
mouse = true;
pointer(card('village'), 'pointerover', null, 'touch'); advance(300);
assert(!preview(), 'マウス接続端末でもタッチ操作には出さない');
const back = doc.createElement('div'); back.className = 'facedown'; doc.body.appendChild(back);
assert.equal(doc.querySelectorAll('[data-card-preview="back"]').length, 0);
assert(!back.hasAttribute('data-card-preview'), '伏せ札から効果を漏らさない');
pointer(back); advance(300); assert(!preview());
card('village').click();
assert(UI.sheet && $('.zoom-text'), '従来のクリック拡大も使える');
dom.window.close();
console.log('カードホバー: 効果正本・手札・山・場・混合山・横型・キーボード・タッチ・終了処理 OK');
