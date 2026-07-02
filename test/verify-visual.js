/* 実ブラウザ(ヘッドレスChrome)で複数のモバイル幅の主要画面の「横はみ出し」を検査＋スクショ取得。
   自前で静的サーバを立てるため事前準備不要。CI(npm test)には含めない（puppeteer依存・低速）。
   使い方: node test/verify-visual.js   （スクショ出力先は環境変数 SHOTS で変更可） */
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = process.env.SHOTS || path.join(require('os').tmpdir(), 'dom-resp-shots');
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.map': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WIDTHS = [{ n: 'w320', w: 320, h: 700 }, { n: 'w360', w: 360, h: 740 }, { n: 'w390', w: 390, h: 780 }, { n: 'w414', w: 414, h: 896 }, { n: 'w768', w: 768, h: 1024 }];

(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port; const BASE = `http://127.0.0.1:${port}/`;
  let puppeteer; try { puppeteer = (await import('puppeteer')).default; } catch (e) { console.log('puppeteer 未導入のためスキップ'); server.close(); process.exit(0); }
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  const clickText = (page, t) => page.evaluate((t) => { const u = (e) => !e.disabled && e.offsetParent !== null; const els = [...document.querySelectorAll('button,.btn,.card,.pile,.seg-btn')].filter(u); const el = els.find((e) => e.textContent.trim() === t) || els.find((e) => e.textContent.includes(t)); if (el) { el.click(); return true; } return false; }, t);
  const overflow = (page) => page.evaluate(() => { const de = document.documentElement; const sw = Math.max(de.scrollWidth, document.body.scrollWidth); return sw - window.innerWidth; });
  const overflowers = (page) => page.evaluate(() => { const iw = window.innerWidth; const bad = []; for (const e of document.querySelectorAll('body *')) { const r = e.getBoundingClientRect(); if (r.width > 0 && r.right > iw + 2) bad.push((e.className || e.tagName) + ' right=' + Math.round(r.right)); } return [...new Set(bad)].slice(0, 6); });
  const results = []; let problems = 0;
  for (const v of WIDTHS) {
    const page = await browser.newPage();
    await page.setViewport({ width: v.w, height: v.h, deviceScaleFactor: 1 });
    await page.setBypassServiceWorker(true);
    async function check(label, full) {
      await sleep(300); const over = await overflow(page); const bad = over > 2;
      if (bad) problems++;
      results.push({ w: v.n, screen: label, over, ng: bad, who: bad ? await overflowers(page) : [] });
      try { await page.screenshot({ path: path.join(OUT, `${v.n}_${label}.png`), fullPage: !!full }); } catch (e) { /* noop */ }
    }
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 20000 }); await sleep(300);
    await check('home');
    await clickText(page, 'CPUと対戦'); await sleep(300); await check('setup');
    await clickText(page, 'この設定で開始'); await sleep(700); await check('board', true);
    await page.evaluate(() => { const p = document.querySelector('.pile') || document.querySelector('.supply-section .card'); if (p) p.click(); }); await sleep(300); await check('zoom');
    await page.evaluate(() => { const b = [...document.querySelectorAll('button,.btn')].find((x) => /とじる|閉じる|×/.test(x.textContent)); if (b) b.click(); });
    await page.goto(BASE, { waitUntil: 'networkidle2' }); await sleep(200);
    await clickText(page, 'カード一覧'); await sleep(600); await check('cardlist', true);
    await page.goto(BASE, { waitUntil: 'networkidle2' }); await sleep(200);
    await clickText(page, '遊び方'); await sleep(300); await check('rules', true);
    await page.close();
  }
  await browser.close(); server.close();
  console.log('=== 横はみ出し検査（over>2pxでNG）===');
  for (const r of results) console.log(`${r.ng ? '✗ NG' : '✓ OK'}  ${r.w.padEnd(6)} ${r.screen.padEnd(9)} over=${r.over}${r.who.length ? '  犯人=' + r.who.join(' / ') : ''}`);
  console.log(`\nスクショ: ${OUT}`);
  console.log(problems === 0 ? '✅ どの幅でも横はみ出しなし' : `❌ ${problems}件のはみ出し`);
  process.exit(problems === 0 ? 0 : 1);
})();
