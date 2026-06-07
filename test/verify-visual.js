/* 実機(ヘッドレスChromium)でレスポンシブ＆はみ出しを検証＋スクショ取得
   前提: python3 -m http.server 8000 が起動していること
   使い方: node test/verify-visual.js
*/
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:8000/';
const OUT = '/tmp/dom-shots';
fs.mkdirSync(OUT, { recursive: true });

const widths = [
  { name: 'phone360', w: 360, h: 740 },
  { name: 'tablet768', w: 768, h: 1024 },
  { name: 'pc1280', w: 1280, h: 900 },
];

async function clickText(page, t) {
  const done = await page.evaluate((t) => {
    const els = [...document.querySelectorAll('button,.btn,.seg-btn,.pile,.card')];
    const el = els.find((e) => e.textContent.trim() === t) || els.find((e) => e.textContent.includes(t));
    if (el) { el.click(); return true; }
    return false;
  }, t);
  return done;
}
async function overflow(page) {
  return page.evaluate(() => {
    const sw = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    return { scrollW: sw, innerW: window.innerWidth, over: sw - window.innerWidth };
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const puppeteer = (await import('puppeteer')).default;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  const results = [];
  let problems = 0;

  for (const v of widths) {
    const page = await browser.newPage();
    await page.setViewport({ width: v.w, height: v.h, deviceScaleFactor: 1 });

    async function check(label, full) {
      await sleep(350);
      const o = await overflow(page);
      const bad = o.over > 2;
      if (bad) problems++;
      results.push({ width: v.name, screen: label, scrollW: o.scrollW, innerW: o.innerW, over: o.over, ng: bad });
      await page.screenshot({ path: path.join(OUT, `${v.name}_${label}.png`), fullPage: !!full });
    }

    // ホーム
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.home h1');
    await check('home');

    // 設定
    await clickText(page, '対戦をはじめる');
    await page.waitForSelector('.setup');
    await check('setup');

    // 盤面（人間 vs CPU で開始）
    await clickText(page, 'この設定で開始');
    await page.waitForSelector('.board');
    await sleep(500); // 画像ロード
    await check('board', true);

    // 拡大表示（サプライをタップ）
    await page.evaluate(() => { const p = document.querySelector('.supply-grid.big .pile'); if (p) p.click(); });
    await page.waitForSelector('.sheet');
    await check('zoom');
    await page.evaluate(() => { const b = [...document.querySelectorAll('.sheet .btn')].find((x) => x.textContent.includes('とじる')); if (b) b.click(); });

    // カード一覧
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.home');
    await clickText(page, 'カード一覧');
    await page.waitForSelector('.cardlist-grid');
    await sleep(500);
    await check('cardlist', true);

    // 遊び方
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await clickText(page, '遊び方');
    await page.waitForSelector('.rules');
    await check('rules', true);

    await page.close();
  }
  await browser.close();

  console.log('\n=== 横はみ出し検査（over>2pxでNG）===');
  for (const r of results) {
    console.log(`${r.ng ? '✗ NG' : '✓ OK'}  ${r.width.padEnd(10)} ${r.screen.padEnd(9)} scrollW=${r.scrollW} innerW=${r.innerW} over=${r.over}`);
  }
  console.log(`\nスクショ: ${OUT}`);
  console.log(problems === 0 ? '✅ どの幅でも横はみ出しなし' : `❌ ${problems}件のはみ出し`);
  process.exit(problems === 0 ? 0 : 1);
})();
