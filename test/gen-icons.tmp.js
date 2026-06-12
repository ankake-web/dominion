// favicon.svg から PWA/ホーム画面用 PNG アイコンを生成（puppeteer 利用）
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
(async () => {
  const svg = fs.readFileSync(path.join(__dirname, '..', 'favicon.svg'), 'utf8')
    .replace('width="64" height="64"', 'width="512" height="512"');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 512, height: 512, deviceScaleFactor: 1 });
  await page.setContent(`<!DOCTYPE html><html><body style="margin:0">${svg}</body></html>`);
  const el = await page.$('svg');
  await el.screenshot({ path: path.join(__dirname, '..', 'icon-512.png'), omitBackground: true });
  await browser.close();
  console.log('icon-512.png generated');
})();
