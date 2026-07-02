/* 実ブラウザ(ヘッドレスChrome)でCPU戦を通しプレイし、JS例外/画像破損/リソース読込失敗を検出するE2Eスモーク。
   自前で静的サーバを立てて puppeteer で駆動するため事前準備不要。CI(npm test)には含めない（puppeteer依存・低速）。
   使い方: node test/verify-e2e.js */
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.map': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port; const BASE = `http://127.0.0.1:${port}/`;
  let puppeteer; try { puppeteer = (await import('puppeteer')).default; } catch (e) { console.log('puppeteer 未導入のためスキップ'); server.close(); process.exit(0); }
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 780, isMobile: true });
  await page.setBypassServiceWorker(true);
  const errors = [], failed = []; const webp = { ok: 0, bad: 0 };
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + (e.message || e).toString().slice(0, 200)));
  page.on('requestfailed', (r) => { const u = r.url(); if (!/favicon|sw\.js/.test(u)) failed.push(u.replace(BASE, '') + ' ' + (r.failure() && r.failure().errorText)); });
  page.on('response', (r) => { if (r.url().endsWith('.webp')) { (r.status() === 200 ? webp.ok++ : webp.bad++); } });

  const clickText = (t) => page.evaluate((t) => {
    const usable = (e) => !e.disabled && !e.hasAttribute('disabled') && e.offsetParent !== null;
    const els = [...document.querySelectorAll('button,.btn,.card,.pile,.seg-btn')].filter(usable);
    const el = els.find((e) => e.textContent.trim() === t) || els.find((e) => e.textContent.includes(t));
    if (el) { el.click(); return true; } return false;
  }, t);
  const stateInfo = () => page.evaluate(() => {
    const UI = window.DOM && window.DOM.UI; const s = UI && UI.store && UI.store.state;
    if (!s) return { none: true };
    const actor = window.DOM.engine.actor(s);
    return { over: !!s.gameOver, phase: s.turn && s.turn.phase, actorCpu: !!(s.players[actor] && s.players[actor].isCpu),
      modal: !!document.querySelector('.modal'), turns: (s.players[0] && s.players[0].turns) || 0,
      handCards: document.querySelectorAll('.hand-cards .card').length, boardImgs: document.querySelectorAll('.card-art').length };
  });

  let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ FAIL: ' + m); } };
  try {
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 20000 }); await sleep(400);
    ok(await page.$eval('.home h1', (e) => e.textContent).catch(() => '') === 'Dominion', 'ホーム画面が表示される');
    ok(await clickText('CPUと対戦'), 'CPUと対戦をタップ'); await sleep(300);
    ok(await clickText('この設定で開始'), '設定で開始をタップ'); await sleep(600);
    let si = await stateInfo();
    ok(!si.none && !si.over, 'CPU戦が開始（盤面stateがある）');
    ok(si.handCards > 0 && si.boardImgs > 0, `手札カードと盤面画像が描画される (手札${si.handCards}/画像${si.boardImgs})`);

    let steps = 0, humanActs = 0; const startTurns = si.turns;
    while (steps++ < 260) {
      si = await stateInfo();
      if (si.over) break;
      if (si.modal) { await page.evaluate(() => { const m = document.querySelector('.modal'); const b = m && (m.querySelector('.btn-primary') || m.querySelector('button,.card,.pile')); if (b) b.click(); }); await sleep(130); continue; }
      if (si.actorCpu) { await sleep(340); continue; }
      if (si.phase === 'action') { await clickText('購入フェーズへ'); humanActs++; await sleep(130); continue; }
      if (await clickText('財宝を全部出す')) { humanActs++; await sleep(150); continue; }
      if (await clickText('ターンを終える')) { humanActs++; await sleep(150); continue; }
      await sleep(130);
    }
    si = await stateInfo();
    ok(si.over || (si.turns - startTurns) >= 3, `ゲームが進行/終了する（描画ループが回る。進行ターン=${si.turns - startTurns} 終局=${si.over} 人間操作=${humanActs}）`);
    ok(errors.length === 0, 'コンソール/ページ例外なし' + (errors.length ? ' — ' + errors.slice(0, 3).join(' | ') : ''));
    ok(webp.bad === 0 && webp.ok > 0, `カード画像(webp)が読める（ok=${webp.ok} bad=${webp.bad}）`);
    ok(failed.filter((f) => /\.(js|css|webp|html|json)/.test(f)).length === 0, '主要リソースの読込失敗なし' + (failed.length ? ' — ' + failed.slice(0, 3).join(' | ') : ''));
  } catch (e) { fail++; console.log('  ✗ 例外: ' + (e.stack || e.message).slice(0, 400)); }

  console.log(`\nE2Eスモーク結果: ${pass} 件成功, ${fail} 件失敗`);
  await browser.close(); server.close();
  process.exit(fail ? 1 : 0);
})();
