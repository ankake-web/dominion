/* 実ブラウザ2つでオンライン対戦をローカル確認（puppeteer）
   前提: node server/index.js（:8787）と python3 -m http.server 8000 が起動中
   使い方: node test/verify-online.js
*/
const fs = require('fs');
const BASE = 'http://localhost:8000/';
const OUT = '/tmp/dom-shots';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ FAIL: ' + m); } }

async function clickText(page, t) {
  return page.evaluate((t) => {
    const els = [...document.querySelectorAll('button,.btn,.seg-btn')];
    const el = els.find((e) => e.textContent.trim() === t) || els.find((e) => e.textContent.includes(t));
    if (el) { el.click(); return true; } return false;
  }, t);
}
async function waitUI(page, fn, ms = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await sleep(80); }
  return false;
}

(async () => {
  const puppeteer = (await import('puppeteer')).default;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  try {
    const host = await browser.newPage();
    const guest = await browser.newPage();
    await host.setViewport({ width: 390, height: 780 });
    await guest.setViewport({ width: 390, height: 780 });

    console.log('— ホストが部屋作成 —');
    await host.goto(BASE, { waitUntil: 'networkidle2' });
    await clickText(host, 'オンラインで対戦');
    await clickText(host, '部屋を作る（ホスト）');
    await clickText(host, '部屋を作成');
    ok(await waitUI(host, () => window.DOM.UI.view === 'lobby' && !!window.DOM.UI.roomCode), 'ホストがロビーへ');
    const code = await host.evaluate(() => window.DOM.UI.roomCode);
    console.log('   部屋コード:', code);
    ok(/^[0-9]{4}$/.test(code), '数字4桁コード');

    console.log('— ゲスト参加 —');
    await guest.goto(BASE + '?room=' + code, { waitUntil: 'networkidle2' });
    // ?room= 付きで参加画面・コード自動入力される
    ok(await waitUI(guest, () => window.DOM.UI.view === 'joinRoom'), '参加リンクで参加画面へ');
    await guest.evaluate(() => {
      const ni = [...document.querySelectorAll('.panel input[type="text"]')].pop();
      ni.value = 'つま'; ni.dispatchEvent(new Event('input'));
    });
    await clickText(guest, '参加する');
    ok(await waitUI(guest, () => window.DOM.UI.view === 'lobby' && window.DOM.UI.mySeat === 1), 'ゲストがロビー(席1)');
    ok(await waitUI(host, () => window.DOM.UI.lobby && window.DOM.UI.lobby.players.length >= 2), 'ホストに2人表示');

    console.log('— CPU0で2人開始 —');
    await clickText(host, '−');
    ok(await waitUI(host, () => window.DOM.UI.lobby && window.DOM.UI.lobby.cpuCount === 0 && window.DOM.UI.lobby.canStart), 'CPU0・開始可');
    await clickText(host, 'ゲーム開始');
    ok(await waitUI(host, () => window.DOM.UI.view === 'game' && !!window.DOM.UI.store.state), 'ホスト対戦画面');
    ok(await waitUI(guest, () => window.DOM.UI.view === 'game' && !!window.DOM.UI.store.state), 'ゲスト対戦画面');

    console.log('— 手札の秘匿（相手手札がクライアントに無い）—');
    const hostSees = await host.evaluate(() => {
      const s = window.DOM.UI.store.state;
      return { own: s.players[0].hand, opp: s.players[1].hand };
    });
    ok(hostSees.own.every((c) => c !== 'back') && hostSees.own.length === 5, 'ホスト: 自分の手札は実物5枚（' + hostSees.own.join(',') + '）');
    ok(hostSees.opp.every((c) => c === 'back'), 'ホスト: 相手の手札はすべて back（中身が届かない）');
    const guestSees = await guest.evaluate(() => {
      const s = window.DOM.UI.store.state;
      return { own: s.players[1].hand, opp: s.players[0].hand };
    });
    ok(guestSees.own.every((c) => c !== 'back'), 'ゲスト: 自分の手札は実物');
    ok(guestSees.opp.every((c) => c === 'back'), 'ゲスト: 相手の手札は back');

    console.log('— 手番同期 —');
    await clickText(host, '購入フェーズへ');
    await waitUI(host, () => window.DOM.UI.store.state.turn.phase === 'buy');
    await clickText(host, 'ターンを終える');
    ok(await waitUI(guest, () => window.DOM.UI.store.state.turn.active === 1), 'ゲストに手番交代が同期');

    await sleep(400);
    await host.screenshot({ path: OUT + '/online_host.png', fullPage: true });
    await guest.screenshot({ path: OUT + '/online_guest.png', fullPage: true });
    console.log('   スクショ: ' + OUT + '/online_host.png, online_guest.png');
  } catch (e) {
    fail++; console.log('  ✗ 例外: ' + (e.stack || e.message));
  }
  await browser.close();
  console.log(`\nオンライン実機確認: ${pass} OK / ${fail} NG`);
  process.exit(fail ? 1 : 0);
})();
