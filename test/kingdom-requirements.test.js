/* 王国抽選の必須条件：抽選・CPU戦UI・オンラインUIの回帰テスト。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const DOM = require('../js/cards');
const keys = ['actions', 'cards', 'buys'];
const off = { actions: false, cards: false, buys: false };
const meets = (id, key) => DOM.kingdomCardMeetsRequirement(id, key);
assert.deepEqual(DOM.normalizeKingdomRequirements(), { actions: true, cards: true, buys: true });
assert(meets('village', 'actions'));
assert(!meets('market', 'actions'));
assert(meets('smithy', 'cards')); // ＋3カードも対象。
assert(!meets('village', 'cards'));
assert(meets('festival', 'buys'));
assert(meets('nobles', 'actions') && meets('nobles', 'cards')); // 選択式。
assert(meets('sauna', 'cards')); // 下段アヴァントも同じ山。
assert(meets('wizards', 'actions')); // 同盟の4種混合山。
keys.forEach((key) => assert(meets('knights', key))); // 騎士10種の混合山。
assert.deepEqual(DOM.randomKingdom(3, ['village', 'smithy', 'market'], off).sort(), ['market', 'smithy', 'village']);
assert.throws(() => DOM.randomKingdom(10, ['village'], { cards: true }), /必須条件/);
assert.throws(() => DOM.randomKingdom(1, ['village', 'smithy'], { actions: true, cards: true, buys: false }), /必須条件/);
assert.deepEqual(DOM.randomKingdom(2, ['village', 'village', 'smithy'], off).sort(), ['smithy', 'village']);

const sets = DOM.CARD_SETS.filter((s) => s.randomFrom).map((s) => s.id)
  .concat(Object.keys(DOM.MIX_KINGDOM_POOLS).map((p) => 'mix:' + p),
    'mix:basic,intrigue:2:ev-empires,pj-renaissance', 'mix:basic,basic,intrigue');
const originalRandom = Math.random;
let seed = 72819;
try {
  Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (const set of sets) {
    const pool = DOM.kingdomPoolForSet(set);
    for (let mask = 0; mask < 8; mask++) {
      const options = Object.fromEntries(keys.map((key, i) => [key, !!(mask & (1 << i))]));
      const missing = DOM.missingKingdomRequirements(set, options);
      if (missing.length) {
        assert.throws(() => DOM.kingdomForSet(set, options), /必須条件/, set);
        continue;
      }
      for (let sample = 0; sample < 8; sample++) {
        const kingdom = DOM.kingdomForSet(set, options);
        assert.equal(kingdom.length, Math.min(10, pool.length), set);
        assert.equal(new Set(kingdom).size, kingdom.length, set);
        assert(kingdom.every((id) => pool.includes(id)), set + ': 抽選元を守る');
        for (const key of keys) if (options[key]) assert(kingdom.some((id) => meets(id, key)), set + ':' + key);
      }
    }
    if (!DOM.missingKingdomRequirements(set).length) {
      const kingdom = DOM.kingdomForSet(set, DOM.normalizeKingdomRequirements());
      keys.forEach((key) => assert(kingdom.some((id) => meets(id, key)), set + ': 初期値'));
    }
  }
  // チェックを外すと、本当に条件を満たさない王国も抽選できる。
  for (const key of keys) {
    const options = Object.assign({}, off, { [key]: true });
    const pool = DOM.POOLS.basic.filter((id) => !meets(id, key));
    assert(DOM.randomKingdom(10, pool, off).every((id) => !meets(id, key)));
    assert.throws(() => DOM.randomKingdom(10, pool, options), /必須条件/);
  }
  Math.random = () => 0;
  assert.deepEqual(DOM.randomKingdom(3, ['village', 'smithy', 'market'], DOM.normalizeKingdomRequirements()),
    DOM.randomKingdom(3, ['village', 'smithy', 'market'], off), '最初から条件を満たす抽選は変えない');
  const constant = DOM.kingdomForSet('random', DOM.normalizeKingdomRequirements());
  keys.forEach((key) => assert(constant.some((id) => meets(id, key))));
} finally { Math.random = originalRandom; }
for (const set of DOM.CARD_SETS.filter((s) => s.kingdom)) {
  assert.deepEqual(DOM.kingdomForSet(set.id), set.kingdom, set.id + ': 固定セットを維持');
}

const dom = new JSDOM('<!doctype html><div id="app"></div>', {
  url: 'https://example.com/', runScripts: 'outside-only', pretendToBeVisual: true,
});
const win = dom.window;
win.setTimeout = () => 1;
win.clearTimeout = () => {};
for (const f of ['cards', 'engine', 'cpu', 'store', 'net', 'audio', 'ui']) {
  win.eval(fs.readFileSync(path.join(__dirname, '../js/' + f + '.js'), 'utf8'));
}
win.document.dispatchEvent(new win.Event('DOMContentLoaded'));
const UI = win.DOM.UI;
const render = () => win.DOM.render();
const boxes = () => Array.from(win.document.querySelectorAll('[data-kingdom-requirement]'));
const button = (text) => Array.from(win.document.querySelectorAll('button')).find((b) => b.textContent.trim() === text);
UI.view = 'setup';
UI.setup.kingdomSet = 'random';
render();
assert.equal(boxes().length, 3);
assert(boxes().every((b) => b.checked && !b.disabled));
boxes()[0].click();
assert.equal(UI.setup.kingdomRequirements.actions, false);
assert.equal(UI.setup.kingdomRequirements.cards, true);
button('ミックス').click();
assert.equal(boxes()[0].checked, false, 'モード変更でも個別設定を維持');
assert(boxes()[1].checked && boxes()[2].checked);
UI.setup.kingdomRequirements = win.DOM.normalizeKingdomRequirements();
UI.setup.kingdomSet = 'mix:guilds';
render();
assert(win.document.querySelector('[role="alert"]'));
assert(button('この設定で開始').disabled);
boxes()[1].click();
assert(!win.document.querySelector('[role="alert"]'));
assert(!button('この設定で開始').disabled);
UI.setup.kingdomSet = 'random';
UI.setup.kingdomRequirements = win.DOM.normalizeKingdomRequirements();
render();
button('この設定で開始').click();
keys.forEach((key) => assert(UI.store.state.kingdom.some((id) => meets(id, key)), '実際のCPU戦:' + key));

const sent = [];
UI.netClient = { send: (msg) => sent.push(msg) };
UI.view = 'lobby';
UI.isHost = true;
UI.lobby = { kingdomSet: 'random', players: [], cpuCount: 1, maxCpu: 3, cpuLevel: 'normal', canStart: true,
  kingdomRequirements: { actions: true, cards: false, buys: true } };
render();
assert.equal(boxes().length, 3);
assert.equal(boxes()[1].checked, false);
boxes()[2].click();
assert.equal(sent.at(-1).t, 'setConfig');
assert.equal(sent.at(-1).kingdomRequirements.buys, false);
UI.isHost = false;
render();
assert(boxes().every((b) => b.disabled));
assert.equal(boxes()[1].checked, false, 'ゲストにもホストの設定を表示');
dom.window.close();
console.log('王国カード必須条件: 全抽選元・8通りの条件・CPU戦・オンラインUI OK');
