/* 英語wiki（wiki.dominionstrategy.com）を **本体から直読み**する（Anubis の bot 検知を自力で突破する）。
 *
 * 使い方:  node tools/wikidirect.js <PageName> [<PageName> ...]
 *   例:    node tools/wikidirect.js Search Cage "King's Cache" Loot Trait
 *   環境変数 RAW_DIR=<dir> を付けると生HTMLも <dir>/raw_<Page>.html に保存する（既定は保存しない）。
 *
 * なぜこれが要るか:
 *  - wiki.dominionstrategy.com は Anubis（proof-of-work 方式の bot 検知）の後ろにあり、素の GET だと
 *    "Making sure you're not a bot!" のページしか返ってこない。
 *  - 従来は `tools/wikifetch.py`（Wayback 経由）で回避していたが、Wayback には
 *    (a) 遅い・429/接続拒否が頻発する (b) **スナップショットが古いと拡張の発売前のページを読んでしまう**
 *    (c) 2025年12月以降のキャプチャは Anubis の画面そのものが保存されている、という3つの罠がある。
 *  - このスクリプトは Anubis のチャレンジ（sha256(randomData + nonce) が先頭 N 桁ゼロ）を解いて
 *    cookie を取り、**常に現行のライブページ**を読む。数秒で終わり、スナップショットの年を気にしなくてよい。
 *
 * 出力:
 *  - `<img alt="$4">` は `[$4]` の形で本文に埋め戻す（これをやらないと金額・VP記号が全部消えて読めない）。
 *  - 見るべき節＝`Info`(Cost/Type(s)/Set)・`Card text`・`Official FAQ`・`Other rules clarifications`・
 *    `Versions > English versions`（＝刷りの数＝エラッタの有無）・`Other language versions`・`Trivia`。
 *
 * ⚠ 日本語のカード名・文面は **wikiwiki.jp/dominiondeck が正本**（`tools/jpwiki.py`）。
 *   英語wiki の "Other language versions" の Japanese 行は当てにならない（夜想曲では17枚で実物と食い違った）。
 */
const crypto = require('crypto');
const https = require('https');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const HOST = 'wiki.dominionstrategy.com';
let COOKIE = '';

function get(p, extraHeaders) {
  return new Promise((res, rej) => {
    const req = https.request({
      host: HOST, path: p, method: 'GET',
      headers: Object.assign({
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
      }, COOKIE ? { Cookie: COOKIE } : {}, extraHeaders || {})
    }, r => {
      const chunks = [];
      r.on('data', c => chunks.push(c));
      r.on('end', () => {
        let buf = Buffer.concat(chunks);
        const enc = (r.headers['content-encoding'] || '').toLowerCase();
        try {
          if (enc === 'gzip') buf = zlib.gunzipSync(buf);
          else if (enc === 'deflate') buf = zlib.inflateSync(buf);
        } catch (e) { /* 非圧縮ならそのまま */ }
        res({ status: r.statusCode, headers: r.headers, body: buf.toString('utf8') });
      });
    });
    req.on('error', rej);
    req.setTimeout(60000, () => { req.destroy(new Error('timeout')); });
    req.end();
  });
}

// Anubis のチャレンジ＝sha256(randomData + nonce) が先頭 difficulty 桁ゼロになる nonce を探す。
function solve(randomData, difficulty) {
  const prefix = '0'.repeat(difficulty);
  for (let nonce = 0; nonce < 1e9; nonce++) {
    const h = crypto.createHash('sha256').update(randomData + nonce).digest('hex');
    if (h.startsWith(prefix)) return { hash: h, nonce };
  }
  throw new Error('no solution');
}

function setCookies(r) {
  const sc = r.headers['set-cookie'];
  if (!sc) return;
  const jar = {};
  COOKIE.split('; ').filter(Boolean).forEach(pp => { const i = pp.indexOf('='); jar[pp.slice(0, i)] = pp.slice(i + 1); });
  sc.forEach(c => {
    const kv = c.split(';')[0];
    const i = kv.indexOf('=');
    jar[kv.slice(0, i).trim()] = kv.slice(i + 1);
  });
  COOKIE = Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ');
}

async function authed(p) {
  let r = await get(p);
  setCookies(r);
  if (r.body.indexOf('anubis_challenge') === -1) return r;   // cookie が生きていれば1発で通る
  const m = r.body.match(/id="anubis_challenge" type="application\/json">([^<]*)</);
  if (!m) throw new Error('challenge JSON not found');
  const data = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
  const diff = data.rules.difficulty;
  const t0 = Date.now();
  const { hash, nonce } = solve(data.challenge.randomData, diff);
  const el = Date.now() - t0;
  const q = '/.within.website/x/cmd/anubis/api/pass-challenge?id=' + encodeURIComponent(data.challenge.id) +
    '&response=' + hash + '&nonce=' + nonce + '&redir=' + encodeURIComponent(p) + '&elapsedTime=' + el;
  const pass = await get(q, { Referer: 'https://' + HOST + p });
  setCookies(pass);
  process.stderr.write('[anubis] diff=' + diff + ' nonce=' + nonce + ' pass=' + pass.status + ' cookie=' + (COOKIE ? 'yes' : 'no') + '\n');
  r = await get(p);
  setCookies(r);
  return r;
}

// HTML → テキスト。コスト記号は <img alt> にしか無いので [$4] の形で残す。
function strip(s) {
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/g, '');
  s = s.replace(/<img[^>]*?alt="([^"]*)"[^>]*>/g, (m, a) =>
    /\.(jpg|png|gif)$/i.test(a) ? ' ' : '[' + a + ']');
  s = s.replace(/<[\s\S]*?>/g, '\n');
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(+d));
  s = s.replace(/[ \t ]+/g, ' ').replace(/\n[ ]*/g, '\n').replace(/\n{2,}/g, '\n');
  return s.trim();
}

(async () => {
  const pages = process.argv.slice(2);
  if (!pages.length) { console.log('使い方: node tools/wikidirect.js <PageName> [<PageName> ...]'); return; }
  const rawDir = process.env.RAW_DIR || '';
  if (rawDir) fs.mkdirSync(rawDir, { recursive: true });
  for (const page of pages) {
    /* ⚠ スペースは %20 ではなく `_`（アンダースコア）にする＝そうしないと 301 が返る。
       さらに **301/302 の Location を追いかける**（拡張の総論ページ `Rising Sun` などは
       正規URLへリダイレクトされるので、追わないと本文が1バイトも取れない）。 */
    let p = '/index.php/' + encodeURIComponent(page).replace(/%20/g, '_');
    let r, hops = 0, failed = false;
    while (hops++ < 6) {
      try { r = await authed(p); } catch (e) { console.log('\n=== PAGE: ' + page + ' FAILED: ' + e.message); failed = true; break; }
      if ([301, 302, 303, 307, 308].indexOf(r.status) >= 0 && r.headers.location) {
        const L = r.headers.location;
        p = L.indexOf('http') === 0 ? new URL(L).pathname : L;
        continue;
      }
      break;
    }
    if (failed) continue;
    console.log('\n' + '='.repeat(70));
    console.log('### PAGE: ' + page + '   final=' + p + '   (status=' + r.status + ')');
    console.log('='.repeat(70));
    if (rawDir) fs.writeFileSync(path.join(rawDir, 'raw_' + page.replace(/[^A-Za-z0-9_]/g, '') + '.html'), r.body);
    console.log(strip(r.body));
  }
})();
