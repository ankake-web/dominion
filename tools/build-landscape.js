/* 横型ランドスケープ（イベント／ランドマーク）カードの完成画像を合成して
   asset/cards/<id>.webp（1152×768）に出力する。

   縦型（tools/build-cards.js）は images/ の master 枠 PNG を recolor して使うが、
   横型の master は存在しない。そこで **縦型 master の「金レールの断面（1次元プロファイル）」を採取し**、
   同じ断面で任意サイズの丸角矩形／円を描くことで、横型 master をこのスクリプト内で組み立てる。
   （枠は丸角矩形＋金ベベルだけで出来ているので、断面さえ同じなら見た目が完全に揃う。）

   マスクの約束（縦型 build-cards.js と同じ）：
     緑    = 地色（recolor で種別色に置換＋まだら/ビネット）
     金    = トリム（recolor で輝度→金ランプ）
     マゼンタ = 絵の窓（透明に抜く）
     クリーム = 羊皮紙（そのまま保持）
     ほぼ黒 = カード外（透明）

   実行（プロジェクト直下を cwd に）:  node tools/build-landscape.js
     CARDS_ONLY=id1,id2  … その id だけ生成
     CARDS_OUT=dir       … 出力先を変更（既定 asset/cards）
     LANDSCAPE_PREVIEW=1 … カード定義がまだ無いときのサンプル2枚だけを描く（枠の目視確認用） */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const CARDS_ONLY = (process.env.CARDS_ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const PREVIEW = !!process.env.LANDSCAPE_PREVIEW;

// ---- カード定義（正本＝js/cards.js の DOM.LANDSCAPES。まだ無ければ PREVIEW のサンプルを使う）----
function loadList() {
  if (PREVIEW) {
    return [
      { id: '_preview_event', name: '巡礼', nameEn: 'Pilgrimage', kind: 'event', cost: 4, debt: 0,
        text: 'ターンに1回：これを裏返す（表向きなら）。\nそうしたら、場のカードから名前の異なるものを最大3枚選び、\nそれぞれ1枚ずつサプライから獲得する。' },
      { id: '_preview_landmark', name: '水道橋', nameEn: 'Aqueduct', kind: 'landmark', cost: 0, debt: 0,
        text: 'セットアップ：銀貨の山と金貨の山に、勝利点トークンを8個ずつ置く。\nあなたが財宝カードを獲得したとき、その山から勝利点トークン1個をこのカードへ移す。\nあなたが勝利点カードを獲得したとき、このカードの勝利点トークンをすべて得る。' },
      { id: '_preview_debt', name: '支配', nameEn: 'Dominate', kind: 'event', cost: 14, debt: 0,
        text: '属州1枚を獲得する。獲得したら +9 勝利点。' },
    ];
  }
  require(path.join(ROOT, 'js/cards.js'));
  const L = global.DOM.LANDSCAPES;
  if (!L) throw new Error('DOM.LANDSCAPES が未定義（js/cards.js に横型カードを追加してから実行）');
  let list = Object.keys(L).map((id) => Object.assign({ id }, L[id]));
  if (CARDS_ONLY.length) list = list.filter((c) => CARDS_ONLY.includes(c.id));
  return list;
}

// ---- 縦型 master から金レールの断面を採取 ----
const MASTER_MARK = '20_21_29';
function findMaster(dir) {
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) { const r = findMaster(fp); if (r) return r; }
    else if (f.includes(MASTER_MARK) && f.endsWith('.png')) return fp;
  }
  return null;
}

const GOLD_RAMP = { sh: [120, 82, 18], mid: [212, 165, 55], hi: [255, 238, 170] };
// 横型2種のスキン（本家：イベント＝茶褐色／ランドマーク＝深い青緑）。トリムは金で統一。
const SKIN = {
  event:    { base: [122, 84, 40] },
  landmark: { base: [26, 96, 92] },
};

const W = 1536, H = 1024;             // 合成解像度（縦型 1024×1536 の 90度相当）
const OW = 1152, OH = 768;            // 配信解像度
// レイアウト（1536×1024 基準）
const LAY = {
  outer:  { x: 6, y: 6, w: W - 12, h: H - 12, r: 58 },
  coin:   { cx: 122, cy: 122, r: 102 },              // イベントのみ
  banner: { x: 236, y: 34, w: W - 236 - 44, h: 158, r: 38 },
  bannerFull: { x: 44, y: 34, w: W - 88, h: 158, r: 38 }, // ランドマーク（コインなし）
  plate:  { x: (W - 860) / 2, y: 204, w: 860, h: 66, r: 28 },
  // 絵の窓は左（本家の横型と同じ）。縦横比 620:543≈1.14 は縦カードの窓（914×804）と同じ＝
  // 既存の 4:3 素材を cover 合成したときの切れ方が縦カードと揃う。効果文が長いので羊皮紙は広めに。
  art:    { x: 56, y: 357, w: 620, h: 543, r: 26 },
  panel:  { x: 708, y: 288, w: W - 708 - 56, h: 680, r: 26 },
};

(async () => {
  const masterPath = findMaster(path.join(ROOT, 'images'));
  if (!masterPath) throw new Error('master frame not found (images/ 以下に …' + MASTER_MARK + '.png が必要)');
  console.log('master frame: ' + masterPath);
  const masterURI = 'data:image/png;base64,' + fs.readFileSync(masterPath).toString('base64');

  const pptr = await import('puppeteer');
  const browser = await pptr.default.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1100 });
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
      ]);
      await document.fonts.ready;
    });
    fontsOk = await page.evaluate(() =>
      document.fonts.check('800 80px "Shippori Mincho"') && document.fonts.check('700 150px "Cinzel"'));
  } catch (e) { fontsOk = false; }
  console.log('fontsOk=' + fontsOk);

  /* ---- 1) 縦型 master から「金レール断面」を採取して、横型 master（マスク画像）を組み立てる ---- */
  const buildMasterFn = `async (masterURI, W, H, LAY, withCoin) => {
    const img = new Image();
    await new Promise(r => { img.onload = r; img.onerror = r; img.src = masterURI; });
    const mw = img.naturalWidth, mh = img.naturalHeight;
    const mc = document.createElement('canvas'); mc.width = mw; mc.height = mh;
    const mctx = mc.getContext('2d'); mctx.drawImage(img, 0, 0);
    const md = mctx.getImageData(0, 0, mw, mh).data;
    const at = (x, y) => { const i = (y*mw + x)*4; return [md[i], md[i+1], md[i+2]]; };

    // 絵の窓の左レール（x=41..63, y=700）＝外側の暗い縁 → 金のベベル → 内側の暗い縁。
    const RAIL = [];
    for (let x = 41; x <= 63; x++) RAIL.push(at(x, 700));
    const RW = RAIL.length; // 23px

    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    // カード外＝ほぼ黒（recolor で透明になる）
    ctx.fillStyle = 'rgb(8,12,2)'; ctx.fillRect(0, 0, W, H);

    const GREEN = 'rgb(3,176,44)';       // 地色（recolor が種別色に置換）
    const MAGENTA = 'rgb(251,3,227)';    // 絵の窓（透明に抜く）
    const CREAM = 'rgb(252,241,221)';    // 羊皮紙

    function rr(x, y, w, h, r) {
      r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
    }
    // 丸角矩形を「金レール（断面を内側に向かって1pxずつ）＋内側の塗り」で描く
    function railRect(b, fill) {
      for (let i = 0; i < RW; i++) {
        const c = RAIL[i];
        ctx.fillStyle = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
        rr(b.x + i, b.y + i, b.w - 2*i, b.h - 2*i, b.r - i); ctx.fill();
      }
      ctx.fillStyle = fill;
      rr(b.x + RW, b.y + RW, b.w - 2*RW, b.h - 2*RW, Math.max(0, b.r - RW)); ctx.fill();
    }
    // 円を同じ断面で（コインメダル）
    function railCircle(cx, cy, R, fill) {
      for (let i = 0; i < RW; i++) {
        const c = RAIL[i];
        ctx.fillStyle = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
        ctx.beginPath(); ctx.arc(cx, cy, R - i, 0, Math.PI*2); ctx.fill();
      }
      ctx.fillStyle = fill;
      ctx.beginPath(); ctx.arc(cx, cy, R - RW, 0, Math.PI*2); ctx.fill();
    }

    railRect(LAY.outer, GREEN);                                  // 外枠
    railRect(withCoin ? LAY.banner : LAY.bannerFull, GREEN);     // 名前バナー
    railRect(LAY.plate, GREEN);                                  // 種別プレート
    railRect(LAY.art, MAGENTA);                                  // 絵の窓
    railRect(LAY.panel, CREAM);                                  // 羊皮紙
    if (withCoin) railCircle(LAY.coin.cx, LAY.coin.cy, LAY.coin.r, GREEN);
    return cv.toDataURL('image/png');
  }`;

  /* ---- 2) 縦型と同じ recolor（緑→種別色＋まだら／金→ランプ／マゼンタ→透明）---- */
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
        const fine = fbm(x/26, y/26) - 0.45;
        const broad = fbm(x/120, y/96) - 0.5;
        const p = 1 + 0.40*fine + 0.24*broad;
        const gr = (Math.random()*2 - 1)*6;
        a[i] = clamp(base[0]*f*v*p + gr, 0, 255);
        a[i+1] = clamp(base[1]*f*v*p + gr, 0, 255);
        a[i+2] = clamp(base[2]*f*v*p + gr, 0, 255);
        continue;
      }
    }
    ctx.putImageData(d, 0, 0);
    return cv.toDataURL('image/png');
  }`;

  /* ---- 3) 1枚を合成（絵 → 枠 → コスト → 名前 → 種別 → 効果文）---- */
  const compositeFn = `async (frameURI, artURI, card, W, H, OW, OH, LAY, FF_JP, FF_NUM, discBase) => {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const load = uri => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = uri; });

    // 絵（窓に cover）。絵が無ければ暗い地の板を敷く（透明の穴が空いたままにしない）。
    const WR = LAY.art;
    const art = artURI ? await load(artURI) : null;
    ctx.save();
    ctx.beginPath(); ctx.rect(WR.x, WR.y, WR.w, WR.h); ctx.clip();
    if (art) {
      const s = Math.max(WR.w/art.naturalWidth, WR.h/art.naturalHeight);
      const iw = art.naturalWidth*s, ih = art.naturalHeight*s;
      ctx.drawImage(art, WR.x + (WR.w-iw)/2, WR.y + (WR.h-ih)/2, iw, ih);
    } else {
      const g = ctx.createLinearGradient(WR.x, WR.y, WR.x, WR.y+WR.h);
      const dk = (i, f) => Math.max(0, Math.min(255, Math.round((discBase[i]||0)*f)));
      g.addColorStop(0, 'rgb(' + dk(0,0.55) + ',' + dk(1,0.55) + ',' + dk(2,0.55) + ')');
      g.addColorStop(1, 'rgb(' + dk(0,0.25) + ',' + dk(1,0.25) + ',' + dk(2,0.25) + ')');
      ctx.fillStyle = g; ctx.fillRect(WR.x, WR.y, WR.w, WR.h);
    }
    ctx.restore();

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
    function drawDebt(cx, cy, num, size) {
      ctx.save();
      const r = size*0.66;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = Math.PI/2 + i*Math.PI/3; const x = cx + r*Math.cos(a), y = cy + r*Math.sin(a); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.closePath();
      ctx.fillStyle = '#d5872a'; ctx.fill();
      ctx.lineWidth = Math.max(3, size*0.05); ctx.strokeStyle = 'rgba(58,28,0,0.85)'; ctx.stroke();
      ctx.font = '700 ' + Math.round(size*0.74) + 'px ' + FF_NUM;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const cm = ctx.measureText(String(num));
      const asc = cm.actualBoundingBoxAscent || size*0.52, desc = cm.actualBoundingBoxDescent || 0;
      outlined(String(num), cx, cy + (asc-desc)/2 - 1, '#fff4e0', Math.max(3, size*0.05), 'rgba(58,28,0,0.9)');
      ctx.restore();
    }

    // コスト（イベントのみ）。負債のみのイベント（貢献/婚礼など）は六角トークンを中央に。
    if (card.kind === 'event') {
      const CC = LAY.coin;
      const cR = 67 * (CC.r / 106);
      const dk = (i, f) => Math.max(0, Math.min(255, Math.round((discBase[i]||0)*f)));
      const g = ctx.createRadialGradient(CC.cx, CC.cy - 18, 6, CC.cx, CC.cy, cR);
      g.addColorStop(0, 'rgb(' + dk(0,0.55) + ',' + dk(1,0.55) + ',' + dk(2,0.55) + ')');
      g.addColorStop(1, 'rgb(' + dk(0,0.30) + ',' + dk(1,0.30) + ',' + dk(2,0.30) + ')');
      ctx.save();
      ctx.beginPath(); ctx.arc(CC.cx, CC.cy, cR, 0, Math.PI*2); ctx.closePath(); ctx.clip();
      ctx.fillStyle = g; ctx.fillRect(CC.cx-cR, CC.cy-cR, cR*2, cR*2);
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.arc(CC.cx, CC.cy, cR-1, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
      if (card.cost > 0) {
        const cs = String(card.cost);
        ctx.font = '700 ' + (cs.length >= 2 ? 118 : 146) + 'px ' + FF_NUM; ctx.letterSpacing = '0px'; // 2桁（$14 支配など）は縮める
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        const cm = ctx.measureText(cs);
        const asc = cm.actualBoundingBoxAscent || 105, desc = cm.actualBoundingBoxDescent || 0;
        outlined(cs, CC.cx, CC.cy + (asc-desc)/2 - 2, '#fbf7ee', 6, 'rgba(0,0,0,0.55)');
        if (card.debt > 0) drawDebt(108, 228, card.debt, 64);
      } else if (card.debt > 0) {
        drawDebt(CC.cx, CC.cy + 4, card.debt, 150);
      } else {
        ctx.font = '700 150px ' + FF_NUM;
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        const cm = ctx.measureText('0');
        const asc = cm.actualBoundingBoxAscent || 105, desc = cm.actualBoundingBoxDescent || 0;
        outlined('0', CC.cx, CC.cy + (asc-desc)/2 - 2, '#fbf7ee', 6, 'rgba(0,0,0,0.55)');
      }
    }

    // 名前（バナー内・自動縮小）
    const B = card.kind === 'event' ? LAY.banner : LAY.bannerFull;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let nfs = 96;
    for (; nfs >= 34; nfs -= 2) {
      ctx.font = '800 ' + nfs + 'px ' + FF_JP;
      ctx.letterSpacing = Math.round(nfs*0.12) + 'px';
      if (ctx.measureText(card.name).width <= B.w - 90) break;
    }
    ctx.font = '800 ' + nfs + 'px ' + FF_JP;
    ctx.letterSpacing = Math.round(nfs*0.12) + 'px';
    outlined(card.name, B.x + B.w/2 + Math.round(nfs*0.06), B.y + B.h/2 + 2, '#f6f1e6', 7, 'rgba(28,18,8,0.9)');

    // 種別（日英併記）
    const tlabel = (card.kind === 'event' ? 'イベント / Event' : 'ランドマーク / Landmark');
    let tfs = 40;
    for (; tfs >= 16; tfs -= 2) {
      ctx.font = '600 ' + tfs + 'px ' + FF_JP; ctx.letterSpacing = '0px';
      if (ctx.measureText(tlabel).width <= LAY.plate.w - 80) break;
    }
    ctx.font = '600 ' + tfs + 'px ' + FF_JP; ctx.letterSpacing = '0px';
    outlined(tlabel, LAY.plate.x + LAY.plate.w/2, LAY.plate.y + LAY.plate.h/2 + 1, '#f3eede', 4, 'rgba(20,12,4,0.85)');

    // 効果文（羊皮紙・左寄せ・自動縮小・日本語1文字単位で折返し・縦中央）
    // 禁則処理：句読点・閉じ括弧・長音・小書き仮名は行頭に置かない（少しはみ出させて前行に残す）。
    const NO_START = new Set(Array.from('、。，．・：；！？）」』】〉》〕｝”’ーぁぃぅぇぉっゃゅょゎヵヶァィゥェォッャュョヮ％＋'));
    const P = LAY.panel, padX = 44, padY = 34;
    const maxW = P.w - padX*2, maxH = P.h - padY*2;
    const lines = String(card.text).split('\\n');
    let chosen = null;
    for (let fs = 54; fs >= 16; fs -= 2) {
      ctx.font = '600 ' + fs + 'px ' + FF_JP; ctx.letterSpacing = '0px';
      const lineH = Math.round(fs*1.34);
      const rows = [];
      for (const eff of lines) {
        const prefix = '・';
        let cur = prefix;
        for (const ch of Array.from(eff)) {
          const t = cur + ch;
          if (ctx.measureText(t).width > maxW && cur !== prefix && cur !== '　' && !NO_START.has(ch)) { rows.push(cur); cur = '　' + ch; }
          else cur = t;
        }
        rows.push(cur);
      }
      if (rows.length*lineH <= maxH) { chosen = { fs, lineH, rows }; break; }
      if (fs === 16) chosen = { fs, lineH, rows };
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = '600 ' + chosen.fs + 'px ' + FF_JP; ctx.letterSpacing = '0px';
    ctx.fillStyle = '#34250c';
    const total = chosen.rows.length*chosen.lineH;
    let yy = P.y + (P.h - total)/2 + chosen.fs;
    for (const row of chosen.rows) { ctx.fillText(row, P.x + padX, yy); yy += chosen.lineH; }

    const o = document.createElement('canvas'); o.width = OW; o.height = OH;
    const octx = o.getContext('2d'); octx.imageSmoothingEnabled = true; octx.imageSmoothingQuality = 'high';
    octx.drawImage(cv, 0, 0, OW, OH);
    return o.toDataURL('image/webp', 0.84);
  }`;

  // 横型 master（コインあり＝イベント／コインなし＝ランドマーク）を作り、スキンごとに recolor
  const masters = {
    event: await page.evaluate(eval('(' + buildMasterFn + ')'), masterURI, W, H, LAY, true),
    landmark: await page.evaluate(eval('(' + buildMasterFn + ')'), masterURI, W, H, LAY, false),
  };
  const frameCache = {};
  for (const k of Object.keys(SKIN)) {
    frameCache[k] = await page.evaluate(eval('(' + recolorFn + ')'), masters[k], W, H, SKIN[k].base, GOLD_RAMP);
    console.log('recolored landscape skin: ' + k);
  }

  const FF_JP = fontsOk ? '"Shippori Mincho",serif' : '"Yu Mincho","游明朝",serif';
  const FF_NUM = '"Cinzel","Georgia","Times New Roman",serif';
  const OUTDIR = process.env.CARDS_OUT || (PREVIEW ? path.join(require('os').tmpdir(), 'dominion-landscape-preview') : 'asset/cards');
  if (!fs.existsSync(OUTDIR)) fs.mkdirSync(OUTDIR, { recursive: true });
  console.log('output dir: ' + OUTDIR);

  const du = (p) => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
  let done = 0;
  for (const c of loadList()) {
    const artPath = path.join(ROOT, 'asset/art', c.id + '.png');
    const artURI = fs.existsSync(artPath) ? du(artPath) : null;
    const webp = await page.evaluate(eval('(' + compositeFn + ')'), frameCache[c.kind], artURI,
      { id: c.id, name: c.name, kind: c.kind, cost: c.cost || 0, debt: c.debt || 0, text: c.text },
      W, H, OW, OH, LAY, FF_JP, FF_NUM, SKIN[c.kind].base);
    fs.writeFileSync(path.join(OUTDIR, c.id + '.webp'), Buffer.from(webp.split(',')[1], 'base64'));
    done++;
  }
  console.log('landscape composited: ' + done);
  await browser.close();
})();
