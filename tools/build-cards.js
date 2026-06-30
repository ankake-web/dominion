/* 全77カードの完成形を合成して配信用 asset/cards/<id>.webp（768×1152・平均約147KB）に出力。
   masterフレーム(緑→種別色 / 金→種別メタルランプ / マゼンタ→透明 / クリーム羊皮紙=保持)を
   種別8スキンにrecolorしてキャッシュ → 各カードで 枠+絵(asset/art)+コード文字 を合成。
   コスト=Cinzel(均一ライニング数字)をインク基準で縦中央そろえ。名前/効果を大きめ・地の模様を強め。
   入力: images/ の master枠(…20_21_29.png) と asset/art/<id>.png（どちらも .gitignore でローカルのみ）。
   実行（プロジェクト直下を cwd に）:  node tools/build-cards.js
   ※ 色やテキストを変えたいときはこのファイルを編集して再実行→全77枚を再生成。 */
const fs = require('fs');
const path = require('path');
const ROOT = 'c:/Users/b1242/claude/game/dominion';
require(path.join(ROOT, 'js/cards.js'));
require(path.join(ROOT, 'js/carddata.js'));
const LIST = global.DOM.CARD_DATA_LIST;

// master 金枠（緑＋マゼンタ窓の元1枚）を images/ 以下から再帰的に探す。
// 置き場所が images/ 直下でも images/assets/ でも拾えるようにする（ローカル限定・.gitignore）。
function findMaster(dir) {
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    const st = fs.statSync(fp);
    if (st.isDirectory()) { const r = findMaster(fp); if (r) return r; }
    else if (f.includes('20_21_29') && f.endsWith('.png')) return fp;
  }
  return null;
}
const masterPath = findMaster('images');
if (!masterPath) throw new Error('master frame not found (images/ 以下に …20_21_29.png が必要)');
const du = p => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
const duW = p => 'data:image/webp;base64,' + fs.readFileSync(p).toString('base64');
const MASTER = du(masterPath);
console.log('master frame: ' + masterPath);

function skinOf(c) {
  if (c.id === 'copper') return 'copper';
  if (c.id === 'silver') return 'silver';
  if (c.id === 'gold') return 'gold';
  if (c.type === 'treasure') return 'gold';
  return c.type;
}
// 金トリム（基準カード準拠）：色地カードは地色だけ種別色にして、縁取り・四隅・コイン環・帯枠の
// 金レールは「金」のまま残す（＝基準 asset/<id>.jpg と同じ高級感）。財宝の銅/銀/金だけは専用メタル。
const GOLD_RAMP = { sh: [120, 82, 18], mid: [212, 165, 55], hi: [255, 238, 170] };
const SKIN = {
  // 財宝3種＝レールも専用メタル（基準どおり金を使わない／金貨だけ金）
  copper:  { base: [120, 72, 42],  ramp: { sh: [58, 30, 16],  mid: [152, 86, 46],  hi: [240, 188, 142] } },
  silver:  { base: [106, 112, 122],ramp: { sh: [60, 63, 70],  mid: [150, 154, 160],hi: [240, 242, 246] } },
  gold:    { base: [150, 112, 30], ramp: GOLD_RAMP },
  // 色地5種＝地色は種別色のまま、トリム（ramp）は金で統一（基準カードの体裁）
  victory: { base: [24, 84, 44],   ramp: GOLD_RAMP },
  curse:   { base: [64, 34, 104],  ramp: GOLD_RAMP },
  action:  { base: [30, 64, 116],  ramp: GOLD_RAMP },
  attack:  { base: [118, 36, 32],  ramp: GOLD_RAMP },
  reaction:{ base: [18, 88, 84],   ramp: GOLD_RAMP },
  // 海辺の持続＝本家同様オレンジ地＋金トリム
  duration:{ base: [176, 84, 20],  ramp: GOLD_RAMP },
};

(async () => {
  const pptr = await import('puppeteer');
  const browser = await pptr.default.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 1600 });
  await page.setContent(`<!doctype html><html><head>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;900&family=Shippori+Mincho:wght@500;600;700;800&display=swap" rel="stylesheet">
    </head><body></body></html>`);
  let fontsOk = false;
  try {
    await page.evaluate(async () => {
      await Promise.all([
        document.fonts.load('800 80px "Shippori Mincho"'),
        document.fonts.load('600 40px "Shippori Mincho"'),
        document.fonts.load('700 150px "Cinzel"'),
        document.fonts.load('900 150px "Cinzel"'),
      ]);
      await document.fonts.ready;
    });
    fontsOk = await page.evaluate(() =>
      document.fonts.check('800 80px "Shippori Mincho"') && document.fonts.check('700 150px "Cinzel"'));
  } catch (e) { fontsOk = false; }
  console.log('fontsOk=' + fontsOk);

  // ---- 1) 8スキンのフレームをrecolor（地の模様を強めに）----
  const recolorFn = `async (master, W, H, base, ramp) => {
    const img = new Image();
    await new Promise(r => { img.onload = r; img.onerror = r; img.src = master; });
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H), a = d.data;
    const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
    const lerp = (p, q, t) => [p[0]+(q[0]-p[0])*t, p[1]+(q[1]-p[1])*t, p[2]+(q[2]-p[2])*t];
    const ramp3 = (R, t) => t < 0.5 ? lerp(R.sh, R.mid, t*2) : lerp(R.mid, R.hi, (t-0.5)*2);
    const hash = (i, j) => { const h = Math.sin(i*127.1 + j*311.7) * 43758.5453; return h - Math.floor(h); };
    const sn = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x-xi, yf = y-yi;
      const u = xf*xf*(3-2*xf), v = yf*yf*(3-2*yf);
      const a0 = hash(xi, yi), b0 = hash(xi+1, yi), c0 = hash(xi, yi+1), d0 = hash(xi+1, yi+1);
      return a0*(1-u)*(1-v) + b0*u*(1-v) + c0*(1-u)*v + d0*u*v;
    };
    const fbm = (x, y) => sn(x, y)*0.5 + sn(x*2, y*2)*0.3 + sn(x*4, y*4)*0.2;
    const cx = W/2, cy = H/2, maxD = Math.hypot(cx, cy);
    const isGreen = (r, g, b) => g > 80 && g > r*1.12 && g > b*1.12;
    const isGold = (r, g, b) => r > 120 && b < 170 && (r-b) > 60 && (g-b) > 45 && r >= g-25;
    const isMag = (r, g, b) => (r > 170 && b > 170 && g < 130) || (r > 120 && b > 120 && r > g+28 && b > g+28);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y*W + x)*4;
      const r = a[i], g = a[i+1], b = a[i+2];
      if (isMag(r, g, b)) { a[i+3] = 0; continue; }
      if (r < 32 && g < 32 && b < 32) { a[i+3] = 0; continue; }
      if (isGold(r, g, b)) {
        const L = 0.299*r + 0.587*g + 0.114*b;
        const t = clamp((L-95)/120, 0, 1);
        const c = ramp3(ramp, t);
        const gr = (Math.random()*2 - 1)*2;
        a[i] = clamp(c[0]+gr, 0, 255); a[i+1] = clamp(c[1]+gr, 0, 255); a[i+2] = clamp(c[2]+gr, 0, 255);
        continue;
      }
      if (isGreen(r, g, b)) {
        const f = clamp(g/176, 0.6, 1.3);
        const dist = Math.hypot(x-cx, y-cy);
        const v = 1 - 0.30*Math.pow(dist/maxD, 1.4);
        // まだら：細かい革目(高周波) + 広いムラ(低周波) を重ねてはっきり濃く出す
        const fine = fbm(x/26, y/26) - 0.45;
        const broad = fbm(x/120, y/96) - 0.5;
        const p = 1 + 0.40*fine + 0.24*broad;
        const gr = (Math.random()*2 - 1)*6;
        a[i] = clamp(base[0]*f*v*p + gr, 0, 255);
        a[i+1] = clamp(base[1]*f*v*p + gr, 0, 255);
        a[i+2] = clamp(base[2]*f*v*p + gr, 0, 255);
        continue;
      }
      // それ以外（クリーム羊皮紙など）は保持
    }
    ctx.putImageData(d, 0, 0);
    return cv.toDataURL('image/png');
  }`;
  const W = 1024, H = 1536;
  const frameCache = {};
  for (const k of Object.keys(SKIN)) {
    frameCache[k] = await page.evaluate(eval('(' + recolorFn + ')'), MASTER, W, H, SKIN[k].base, SKIN[k].ramp);
    console.log('recolored skin: ' + k);
  }

  // ---- 2) 各カードを合成 ----
  const compositeFn = `async (frameURI, artURI, card, W, H, FF_JP, FF_NUM, discBase) => {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const load = uri => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = uri; });

    // 絵（窓にcover）
    const WR = { x: 54, y: 298, w: 914, h: 804 };
    const art = artURI ? await load(artURI) : null;
    if (art) {
      ctx.save();
      ctx.beginPath(); ctx.rect(WR.x, WR.y, WR.w, WR.h); ctx.clip();
      const s = Math.max(WR.w/art.naturalWidth, WR.h/art.naturalHeight);
      const iw = art.naturalWidth*s, ih = art.naturalHeight*s;
      ctx.drawImage(art, WR.x + (WR.w-iw)/2, WR.y + (WR.h-ih)/2, iw, ih);
      ctx.restore();
    }
    // フレーム（透明窓から絵が見える）
    const fr = await load(frameURI);
    if (fr) ctx.drawImage(fr, 0, 0, W, H);

    function outlined(txt, x, y, fill, lw, stroke) {
      ctx.lineJoin = 'round'; ctx.miterLimit = 2;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
      ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.strokeText(txt, x, y);
      ctx.restore();
      ctx.fillStyle = fill; ctx.fillText(txt, x, y);
    }

    // コイン中央を暗いメダルにする（基準カード準拠：暗い地色の円→金環は残る→白い数字が映える）
    const coinCx = 126, coinCy = 126;
    {
      const cR = 67; // 金環の内側に収める半径
      const dk = (i, f) => Math.max(0, Math.min(255, Math.round((discBase[i] || 0) * f)));
      const g = ctx.createRadialGradient(coinCx, coinCy - 18, 6, coinCx, coinCy, cR);
      g.addColorStop(0, 'rgb(' + dk(0, 0.55) + ',' + dk(1, 0.55) + ',' + dk(2, 0.55) + ')');
      g.addColorStop(1, 'rgb(' + dk(0, 0.30) + ',' + dk(1, 0.30) + ',' + dk(2, 0.30) + ')');
      ctx.save();
      ctx.beginPath(); ctx.arc(coinCx, coinCy, cR, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
      ctx.fillStyle = g; ctx.fillRect(coinCx - cR, coinCy - cR, cR * 2, cR * 2);
      // 内側のふち影で立体感（メダルが沈んで見える）
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.arc(coinCx, coinCy, cR - 1, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    // コスト：コイン数字（cost>0 のみ）。錬金術のポーション費用は紫のフラスコ記号で示す。
    const potionCost = card.potion || 0;
    // 紫のフラスコ（ポーション）を (cx,cy) に高さ目安 s で描く
    function drawPotion(cx, cy, s) {
      ctx.save(); ctx.translate(cx, cy); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const w = s;
      ctx.beginPath();
      ctx.moveTo(-0.22*w, -1.0*w); ctx.lineTo(-0.22*w, -0.4*w);
      ctx.lineTo(-0.82*w, 0.62*w); ctx.lineTo(0.82*w, 0.62*w);
      ctx.lineTo(0.22*w, -0.4*w); ctx.lineTo(0.22*w, -1.0*w); ctx.closePath();
      ctx.fillStyle = 'rgba(234,230,248,0.96)'; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = '#7a35b0'; ctx.fillRect(-0.9*w, 0.04*w, 1.8*w, 0.7*w);
      ctx.fillStyle = 'rgba(198,142,236,0.95)';
      ctx.beginPath(); ctx.arc(-0.12*w, 0.32*w, 0.09*w, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(0.22*w, 0.46*w, 0.06*w, 0, 7); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = '#241038'; ctx.lineWidth = Math.max(2.5, 0.12*w); ctx.stroke();
      ctx.fillStyle = '#9a6a38'; ctx.fillRect(-0.27*w, -1.2*w, 0.54*w, 0.26*w);
      ctx.lineWidth = Math.max(2, 0.09*w); ctx.strokeRect(-0.27*w, -1.2*w, 0.54*w, 0.26*w);
      ctx.restore();
    }
    function drawCostNumber(cs) {
      ctx.font = '700 150px ' + FF_NUM; ctx.letterSpacing = '0px';
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const cm = ctx.measureText(cs);
      const asc = cm.actualBoundingBoxAscent || 105, desc = cm.actualBoundingBoxDescent || 0;
      outlined(cs, coinCx, coinCy + (asc - desc) / 2 - 2, '#fbf7ee', 6, 'rgba(0,0,0,0.55)');
    }
    if (card.cost > 0) {
      drawCostNumber(String(card.cost));
      if (potionCost > 0) { // コインの下にポーション記号（複数なら ×N）
        drawPotion(112, 240, 26);
        if (potionCost > 1) { ctx.font = '700 40px ' + FF_NUM; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; outlined('×' + potionCost, 140, 240, '#f0e6ff', 4, 'rgba(40,16,56,0.9)'); }
      }
    } else if (potionCost > 0) { // ポーションのみ（ブドウ園・変成）：コイン中央にフラスコ（数字なし）
      drawPotion(coinCx, coinCy + 8, 48);
    } else {
      drawCostNumber('0');
    }

    // 名前（大きめ・幅に収まるよう自動縮小）
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let nfs = 96;
    for (; nfs >= 34; nfs -= 2) {
      ctx.font = '800 ' + nfs + 'px ' + FF_JP;
      ctx.letterSpacing = Math.round(nfs*0.12) + 'px';
      if (ctx.measureText(card.name).width <= 720) break;
    }
    ctx.font = '800 ' + nfs + 'px ' + FF_JP;
    ctx.letterSpacing = Math.round(nfs*0.12) + 'px';
    outlined(card.name, 600 + Math.round(nfs*0.06), 124, '#f6f1e6', 7, 'rgba(28,18,8,0.9)');

    // 種別（日英併記）
    const tlabel = card.typeLabel + ' / ' + card.typeLabelEn;
    let tfs = 38;
    for (; tfs >= 16; tfs -= 2) {
      ctx.font = '600 ' + tfs + 'px ' + FF_JP; ctx.letterSpacing = '0px';
      if (ctx.measureText(tlabel).width <= 600) break;
    }
    ctx.font = '600 ' + tfs + 'px ' + FF_JP; ctx.letterSpacing = '0px';
    outlined(tlabel, 520, 250, '#f3eede', 4, 'rgba(20,12,4,0.85)');

    // 効果（大きめ・左寄せ・自動縮小・日本語1文字単位で折返し・縦中央）
    const P = { x: 62, y: 1140, w: 903, h: 333 }, padX = 56;
    const maxW = P.w - padX*2;
    let chosen = null;
    for (let fs = 58; fs >= 18; fs -= 2) {
      ctx.font = '600 ' + fs + 'px ' + FF_JP; ctx.letterSpacing = '0px';
      const lineH = Math.round(fs*1.34);
      const rows = [];
      for (const eff of card.effects) {
        const prefix = '・';
        let cur = prefix;
        for (const ch of Array.from(eff)) {
          const t = cur + ch;
          if (ctx.measureText(t).width > maxW && cur !== prefix && cur !== '　') { rows.push(cur); cur = '　' + ch; }
          else cur = t;
        }
        rows.push(cur);
      }
      if (rows.length*lineH <= P.h) { chosen = { fs, lineH, rows }; break; }
      if (fs === 18) chosen = { fs, lineH, rows };
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = '600 ' + chosen.fs + 'px ' + FF_JP; ctx.letterSpacing = '0px';
    ctx.fillStyle = '#34250c';
    const total = chosen.rows.length*chosen.lineH;
    let yy = P.y + (P.h - total)/2 + chosen.fs;
    for (const row of chosen.rows) { ctx.fillText(row, P.x + padX, yy); yy += chosen.lineH; }

    // 1024で合成 → 768×1152へ縮小し WebP で返す（Web配信用に軽量化・角の透明は維持）
    const ow = 768, oh = 1152;
    const o = document.createElement('canvas'); o.width = ow; o.height = oh;
    const octx = o.getContext('2d'); octx.imageSmoothingEnabled = true; octx.imageSmoothingQuality = 'high';
    octx.drawImage(cv, 0, 0, ow, oh);
    return o.toDataURL('image/webp', 0.84);
  }`;

  const FF_JP = fontsOk ? '"Shippori Mincho",serif' : '"Yu Mincho","游明朝",serif';
  const FF_NUM = '"Cinzel","Georgia","Times New Roman",serif';
  // 出力先。既定は本番 asset/cards。CARDS_OUT を指定するとそこへ書く（デプロイ前のプレビュー用）。
  const OUTDIR = process.env.CARDS_OUT || 'asset/cards';
  if (!fs.existsSync(OUTDIR)) fs.mkdirSync(OUTDIR, { recursive: true });
  console.log('output dir: ' + OUTDIR);

  let done = 0;
  for (const c of LIST) {
    const artPath = path.join('asset/art', c.id + '.png');
    const artURI = fs.existsSync(artPath) ? du(artPath) : null;
    const png = await page.evaluate(eval('(' + compositeFn + ')'), frameCache[skinOf(c)], artURI, {
      id: c.id, name: c.name, cost: c.cost, typeLabel: c.typeLabel, typeLabelEn: c.typeLabelEn, effects: c.effects,
      potion: (DOM.CARDS[c.id] && DOM.CARDS[c.id].potion) || 0,
    }, W, H, FF_JP, FF_NUM, SKIN[skinOf(c)].base);
    fs.writeFileSync(path.join(OUTDIR, c.id + '.webp'), Buffer.from(png.split(',')[1], 'base64'));
    done++;
    if (done % 20 === 0) console.log('composited ' + done + '/' + LIST.length);
  }
  console.log('ALL composited: ' + done);

  // ---- 3) レビュー用モンタージュ ----（セッション非依存の一時フォルダへ。無ければ作る）
  const OUT = path.join(require('os').tmpdir(), 'dominion-cards-montage');
  fs.mkdirSync(OUT, { recursive: true });
  console.log('montage dir: ' + OUT);
  const CW = 300, CH = 450;
  const thumbs = [];
  for (const c of LIST) {
    const t = await page.evaluate(async (uri, CW, CH) => {
      const im = new Image(); await new Promise(r => { im.onload = r; im.onerror = r; im.src = uri; });
      const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
      const ctx = cv.getContext('2d'); ctx.fillStyle = '#222'; ctx.fillRect(0, 0, CW, CH);
      const s = Math.min(CW/im.naturalWidth, CH/im.naturalHeight) || 1;
      const iw = im.naturalWidth*s, ih = im.naturalHeight*s;
      ctx.drawImage(im, (CW-iw)/2, (CH-ih)/2, iw, ih);
      return cv.toDataURL('image/jpeg', 0.8);
    }, duW(path.join(OUTDIR, c.id + '.webp')), CW, CH);
    thumbs.push({ id: c.id, t });
  }
  const COLS = 8, PAD = 6;
  const half = Math.ceil(thumbs.length / 2);
  const sheets = [[0, half], [half, thumbs.length]];
  for (let si = 0; si < sheets.length; si++) {
    const sub = thumbs.slice(sheets[si][0], sheets[si][1]);
    const png = await page.evaluate(async (sub, COLS, CW, CH, PAD) => {
      const rows = Math.ceil(sub.length / COLS);
      const Wm = COLS*(CW+PAD)+PAD, Hm = rows*(CH+PAD)+PAD;
      const cv = document.createElement('canvas'); cv.width = Wm; cv.height = Hm;
      const ctx = cv.getContext('2d'); ctx.fillStyle = '#1b1b1b'; ctx.fillRect(0, 0, Wm, Hm);
      for (let k = 0; k < sub.length; k++) {
        const im = new Image(); await new Promise(r => { im.onload = r; im.onerror = r; im.src = sub[k].t; });
        const col = k % COLS, row = Math.floor(k / COLS);
        const x = PAD + col*(CW+PAD), y = PAD + row*(CH+PAD);
        ctx.drawImage(im, x, y, CW, CH);
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x, y, CW, 26);
        ctx.fillStyle = '#ffe14d'; ctx.font = 'bold 18px sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        ctx.fillText(sub[k].id, x + 6, y + 14);
      }
      return cv.toDataURL('image/jpeg', 0.82);
    }, sub, COLS, CW, CH, PAD);
    fs.writeFileSync(OUT + '/cards_' + si + '.jpg', Buffer.from(png.split(',')[1], 'base64'));
    console.log('wrote cards_' + si + '.jpg (' + sub.length + ')');
  }

  await browser.close();
})();
