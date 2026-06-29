/* ============================================================
   js/cardview.js — Cardコンポーネント（枠SVG合成方式 / プレミアム枠）
   ------------------------------------------------------------
   DOM.cardView(card | id, opts) → カードのDOM要素を返す。

   ★枠フォーマット＋はめ込み方式★
     - 枠（フレーム）は1つの精巧な SVG（DOM.cardFrameSVG）として描く。種別で6色に変色。
       温かみのある艶やかな金（鏡面ハイライト付き）の二重枠＋四隅金具＋
       同心円で彫り込んだコスト章（セリフ数字）＋単一の中央種別プレート＋羊皮紙パネル。
     - その「窓」に“絵だけ”の画像 asset/art/<id>.png をはめ込む（窓は枠SVGの下に置き、
       枠の窓部分は SVG <mask> で抜いてある＝絵が見える）。画像が無ければ 絵→絵文字→名前 に段階フォールバック。
     - 文字（コスト数字・名前・種別ラベル・効果）はコードで枠の所定位置に重ねる。
   レイアウトは枠SVGの viewBox(1000×1515) と同じ％でHTMLを重ねるので、どの表示幅でも一致する。

   merge元: C=温かい蜂蜜色の金＋深い宝石色の背景＋ヴィネット/微粒子、
            B=金レール/コスト章の鏡面メタル質感（控えめに）、
            D=同心円コスト章のセリフ数字＋名前プレート＋単一の中央種別プレート＋羊皮紙。

   ★枠は「SVG（コード描画）」と「画像（asset/frames/<type>.png）」の二段構え★
     - 既定で asset/frames/<type>.png を読みに行き、読めれば“絵画的な金枠画像”を使い SVG枠を隠す。
       無ければ SVG枠にフォールバック。画像枠は SVGと同じ配置（型紙）で作るので文字位置は共通。
       → ユーザーは種別ごとに枠画像6枚だけAI生成すればよい（中央の窓は透明、文字・数字は無し）。

   opts:
     - onClick(card)   … クリック時コールバック（指定時のみ pointer 化）
     - artSrc          … 中央画像のURLを明示指定（既定 asset/art/<id>.png を上書き）
     - noArt: true     … 画像を読み込まず常にフォールバック表示
     - frameSrc        … 枠画像のURLを明示指定（既定 asset/frames/<type>.png を上書き）
     - noFrameImg: true… 枠画像を読まず常に SVG枠を使う（型紙の確認・プレビュー用）
   ============================================================ */
(function () {
  const DOM = (window.DOM = window.DOM || {});
  const SVGNS = 'http://www.w3.org/2000/svg';

  function el(tag, cls, child) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (child != null) {
      if (Array.isArray(child)) child.forEach((c) => c && e.appendChild(c));
      else if (typeof child === 'object') e.appendChild(child);
      else e.textContent = String(child);
    }
    return e;
  }

  DOM.cardView = function (card, opts) {
    opts = opts || {};
    if (typeof card === 'string') card = (DOM.CARD_DATA || {})[card];
    if (!card) return el('div', 'dcard');

    const frame = card.type || 'action';            // 枠色キー（attack/reaction優先で導出済み）
    const root = el('div', 'dcard frame-' + frame);
    if (opts.onClick) {
      root.style.cursor = 'pointer';
      root.addEventListener('click', () => opts.onClick(card));
    }

    /* z0：中央の窓にはめ込む“絵だけ”（枠SVGの下に置く＝枠の窓から見える） */
    const win = el('div', 'dcard-art');
    const fbIcon = el('div', 'dcard-art-icon', card.icon || '🃏');
    const fbName = el('div', 'dcard-art-name', card.name || '');
    win.appendChild(el('div', 'dcard-art-fallback', [fbIcon, fbName]));
    if (!opts.noArt) {
      const img = el('img', 'dcard-art-img');
      img.alt = card.name || ''; img.loading = 'lazy'; img.decoding = 'async';
      img.addEventListener('error', () => { img.remove(); win.classList.add('noart'); });
      img.src = opts.artSrc || card.artSquare || ('asset/art/' + card.id + '.png');
      win.appendChild(img);
    } else {
      win.classList.add('noart');
    }
    root.appendChild(win);

    /* z1a：枠SVG（画像枠が無いときのフォールバック。型紙＝この配置に画像枠を合わせる） */
    const frameLayer = el('div', 'dcard-frame');
    frameLayer.innerHTML = DOM.cardFrameSVG(card.id);
    root.appendChild(frameLayer);

    /* z1b：枠画像（asset/frames/<type>.png）。読めたら has-frameimg を付けてSVG枠を隠す。
       窓（中央正方形）が透明な“絵だけの金枠”を種別ごとに1枚だけ用意すればよい。 */
    if (!opts.noFrameImg) {
      const frameImg = el('img', 'dcard-frameimg');
      frameImg.alt = ''; frameImg.setAttribute('aria-hidden', 'true'); frameImg.decoding = 'async';
      frameImg.addEventListener('load', () => root.classList.add('has-frameimg'));
      frameImg.addEventListener('error', () => frameImg.remove());
      frameImg.src = opts.frameSrc || ('asset/frames/' + frame + '.png');
      root.appendChild(frameImg);
    }

    /* z2：文字オーバーレイ（枠の所定位置に重ねる）。
       コスト数字は HTML で重ねる（SVG枠でも画像枠でも同じコイン位置に載る）。 */
    const cost = el('div', 'dcard-cost', el('span', null, String(card.cost == null ? '' : card.cost)));
    root.appendChild(cost);

    const title = el('div', 'dcard-title', el('span', null, card.name || '？'));
    root.appendChild(title);

    // 種別プレート：単一種別は日英併記、複合（・を含む）は幅の都合で日本語のみ。
    // どちらも中央1枚のプレートに収め、長い場合は CSS の自動縮小で枠内に収める。
    const compound = /・/.test(card.typeLabel || '');
    const plaqueSpan = el('span', compound ? 'compound' : null);
    if (!compound && card.typeLabelEn) {
      plaqueSpan.appendChild(el('span', 'jp', card.typeLabel || ''));
      plaqueSpan.appendChild(el('span', 'sep', '/'));
      plaqueSpan.appendChild(el('span', 'en', card.typeLabelEn));
    } else {
      plaqueSpan.textContent = card.typeLabel || '';
    }
    root.appendChild(el('div', 'dcard-plaque', plaqueSpan));

    const effList = el('ul', 'dcard-effects');
    (card.effects || []).forEach((line) => {
      if (line == null || line === '') return;
      effList.appendChild(el('li', null, String(line)));
    });
    root.appendChild(el('div', 'dcard-panel', effList));

    return root;
  };

  // 旧API互換（呼ばれても無害）
  DOM.fitCardEffects = function () {};
  DOM.fitAllCards = function () {};

  /* ============================================================
     枠SVG（フォーマット）。viewBox 1000×1515。種別色は CSS変数 var(--frame*) で変色。
     金（温かく艶やか／鏡面ハイライト）・羊皮紙のグラデと影/紙質フィルタは uid 付き
     （同一ページに複数枚あってもidが衝突しない）。
     窓（中央の正方形）は <mask> で抜いてある＝下のレイヤー(絵)が見える。
     コスト数字は同心円メダル内にセリフ体で彫り込む（cost を渡す）。
     ============================================================ */
  DOM.cardFrameSVG = function (uid, cost) {
    uid = String(uid || 'c').replace(/[^a-zA-Z0-9_-]/g, '');
    const g = 'g-' + uid;          // 金（基調・斜めグラデ）
    const gv = 'gv-' + uid;        // 金（縦グラデ：レール/プレート用）
    const gr = 'gr-' + uid;        // 金（放射：コスト外輪/章用）
    const p = 'p-' + uid;          // 羊皮紙
    const face = 'face-' + uid;    // コイン面（クリーム）
    const spec = 'spec-' + uid;    // 鏡面スイープ
    const hi = 'hi-' + uid;        // 上部ハイライト
    const sh = 'sh-' + uid;        // ドロップシャドウ
    const ns = 'ns-' + uid;        // ノイズ（紙質）
    const grain = 'grain-' + uid;  // 微粒子（盤面の質感）
    const win = 'win-' + uid;      // 窓抜きマスク

    // 四隅のロゼット金具（花弁＋金ボス＋種別色の宝玉）
    function rosette(cx, cy, r) {
      let petals = '';
      for (let k = 0; k < 8; k++) {
        petals += '<ellipse cx="' + cx + '" cy="' + (cy - r * 0.96) + '" rx="' + (r * 0.2) + '" ry="' + (r * 0.46) +
          '" fill="url(#' + g + ')" transform="rotate(' + (k * 45) + ' ' + cx + ' ' + cy + ')"/>';
      }
      return (
        '<g filter="url(#' + sh + ')">' + petals +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.74) + '" fill="url(#' + gr + ')"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.54) + '" fill="none" stroke="#2e2008" stroke-width="2"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.48) + '" class="df-gem"/>' +
        '<circle cx="' + (cx - r * 0.18) + '" cy="' + (cy - r * 0.18) + '" r="' + (r * 0.14) + '" fill="rgba(255,255,255,.6)"/>' +
        '</g>'
      );
    }

    return (
      '<svg viewBox="0 0 1000 1515" xmlns="' + SVGNS + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
      '<defs>' +
        // --- 温かい蜂蜜色の艶やかな金（斜め・多段グラデ）---
        '<linearGradient id="' + g + '" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#5a3d11"/><stop offset="0.13" stop-color="#9a6f25"/>' +
          '<stop offset="0.27" stop-color="#e9c668"/><stop offset="0.37" stop-color="#fff3cf"/>' +
          '<stop offset="0.5" stop-color="#caa03c"/><stop offset="0.62" stop-color="#8a611d"/>' +
          '<stop offset="0.78" stop-color="#e0bb55"/><stop offset="0.9" stop-color="#9c7126"/>' +
          '<stop offset="1" stop-color="#583c11"/>' +
        '</linearGradient>' +
        // --- 金（縦：レール／プレート枠用、鏡面の山が上に来る）---
        '<linearGradient id="' + gv + '" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#7a5417"/><stop offset="0.18" stop-color="#d9ad48"/>' +
          '<stop offset="0.33" stop-color="#fff3cf"/><stop offset="0.5" stop-color="#caa03c"/>' +
          '<stop offset="0.7" stop-color="#8a611d"/><stop offset="0.86" stop-color="#d9ad48"/>' +
          '<stop offset="1" stop-color="#5a3d11"/>' +
        '</linearGradient>' +
        // --- 金（放射：コスト外輪／章。中心が明るく彫りが立つ）---
        '<radialGradient id="' + gr + '" cx="0.38" cy="0.3" r="0.85">' +
          '<stop offset="0" stop-color="#fff3cf"/><stop offset="0.3" stop-color="#ecca6e"/>' +
          '<stop offset="0.62" stop-color="#c39a37"/><stop offset="0.85" stop-color="#8a611d"/>' +
          '<stop offset="1" stop-color="#5a3d11"/>' +
        '</radialGradient>' +
        // --- コスト面（彫り込んだクリームの座面）---
        '<radialGradient id="' + face + '" cx="0.4" cy="0.32" r="0.8">' +
          '<stop offset="0" stop-color="#fffdf6"/><stop offset="0.7" stop-color="#f8eed4"/>' +
          '<stop offset="1" stop-color="#e6d4ac"/>' +
        '</radialGradient>' +
        // --- 羊皮紙 ---
        '<linearGradient id="' + p + '" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#f5ecce"/><stop offset="0.55" stop-color="#e9d6a8"/>' +
          '<stop offset="1" stop-color="#dcc692"/>' +
        '</linearGradient>' +
        // --- 鏡面スイープ（金枠の上を斜めに走る細い光。控えめ）---
        '<linearGradient id="' + spec + '" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0.30" stop-color="rgba(255,255,255,0)"/>' +
          '<stop offset="0.45" stop-color="rgba(255,255,255,0.55)"/>' +
          '<stop offset="0.52" stop-color="rgba(255,255,255,0.05)"/>' +
          '<stop offset="0.62" stop-color="rgba(255,255,255,0)"/>' +
        '</linearGradient>' +
        '<radialGradient id="' + hi + '" cx="0.5" cy="0" r="1.1">' +
          '<stop offset="0" stop-color="rgba(255,247,220,0.16)"/><stop offset="0.55" stop-color="rgba(255,255,255,0)"/>' +
        '</radialGradient>' +
        '<radialGradient id="vig-' + uid + '" cx="0.5" cy="0.4" r="0.85">' +
          '<stop offset="0.5" stop-color="rgba(0,0,0,0)"/><stop offset="1" stop-color="rgba(0,0,0,0.45)"/>' +
        '</radialGradient>' +
        '<filter id="' + sh + '" x="-40%" y="-40%" width="180%" height="180%">' +
          '<feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.55)"/>' +
        '</filter>' +
        '<filter id="' + ns + '"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>' +
          '<feColorMatrix type="matrix" values="0 0 0 0 0.18  0 0 0 0 0.13  0 0 0 0 0.05  0 0 0 0.5 0"/></filter>' +
        '<filter id="' + grain + '"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>' +
          '<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0"/></filter>' +
        // 窓（中央の正方形）を本体から抜くマスク：白=残す／黒=透過。下の絵が見える。
        '<mask id="' + win + '" maskUnits="userSpaceOnUse">' +
          '<rect x="16" y="16" width="968" height="1483" rx="36" fill="#fff"/>' +
          '<rect x="126" y="378" width="748" height="748" rx="10" fill="#000"/>' +
        '</mask>' +
      '</defs>' +
      // 外周の黒縁＋枠本体（種別色の深い宝石色）＋ヴィネット＋微粒子＋上部ハイライト。
      // 窓部分はマスクで一括して抜く＝下の絵が見える。
      '<g mask="url(#' + win + ')">' +
        '<rect x="0" y="0" width="1000" height="1515" rx="46" fill="#0a0806"/>' +
        '<rect x="16" y="16" width="968" height="1483" rx="36" class="df-body"/>' +
        '<rect x="16" y="16" width="968" height="1483" rx="36" fill="url(#vig-' + uid + ')"/>' +
        '<rect x="16" y="16" width="968" height="1483" rx="36" fill="url(#' + grain + ')" opacity="0.05"/>' +
        '<rect x="16" y="16" width="968" height="1483" rx="36" fill="url(#' + hi + ')"/>' +
      '</g>' +
      // 金の二重枠（外側は太い艶金レール＋鏡面スイープ）
      '<rect x="38" y="38" width="924" height="1439" rx="30" fill="none" stroke="url(#' + gv + ')" stroke-width="16"/>' +
      '<rect x="38" y="38" width="924" height="1439" rx="30" fill="none" stroke="url(#' + spec + ')" stroke-width="16"/>' +
      '<rect x="49" y="49" width="902" height="1417" rx="23" fill="none" stroke="#2e2008" stroke-width="2.5"/>' +
      '<rect x="56" y="56" width="888" height="1403" rx="18" fill="none" stroke="url(#' + g + ')" stroke-width="5"/>' +
      // 四隅のロゼット金具
      rosette(78, 78, 26) + rosette(922, 78, 26) + rosette(78, 1437, 26) + rosette(922, 1437, 26) +
      // 名前プレート（右上・金縁／中身は種別色の深い座面。文字はHTMLで重ねる）
      '<rect x="270" y="44" width="660" height="200" rx="18" fill="url(#' + gv + ')" filter="url(#' + sh + ')"/>' +
      '<rect x="270" y="44" width="660" height="200" rx="18" fill="url(#' + spec + ')"/>' +
      '<rect x="284" y="58" width="632" height="172" rx="12" class="df-plate" stroke="#2e2008" stroke-width="2"/>' +
      '<rect x="284" y="58" width="632" height="172" rx="12" fill="url(#' + hi + ')"/>' +
      // 種別プレート帯（中央1枚・金縁＋種別色の座面。先端を斜めに）
      '<path d="M252 286 L748 286 L772 322 L748 358 L252 358 L228 322 Z" fill="url(#' + gv + ')" stroke="#2e2008" stroke-width="3" filter="url(#' + sh + ')"/>' +
      '<path d="M262 295 L738 295 L756 322 L738 349 L262 349 L244 322 Z" class="df-plaque" stroke="#2e2008" stroke-width="1.5"/>' +
      // 中央の窓（金の額縁。中身は空＝下の絵が見える）
      '<rect x="120" y="372" width="760" height="760" rx="14" fill="none" stroke="#2e2008" stroke-width="12"/>' +
      '<rect x="120" y="372" width="760" height="760" rx="14" fill="none" stroke="url(#' + gv + ')" stroke-width="8"/>' +
      '<rect x="120" y="372" width="760" height="760" rx="14" fill="none" stroke="rgba(255,247,220,0.4)" stroke-width="1.5"/>' +
      // コスト章（同心円で彫り込み：外輪→谷→内輪→クリーム座面。数字はセリフ体で彫り込む）
      '<g filter="url(#' + sh + ')">' +
        '<circle cx="150" cy="150" r="104" fill="url(#' + gr + ')"/>' +
        '<circle cx="150" cy="150" r="102" fill="none" stroke="rgba(255,247,220,0.65)" stroke-width="2"/>' +
        '<circle cx="150" cy="150" r="90" fill="none" stroke="#5a3d11" stroke-width="4"/>' +
        '<circle cx="150" cy="150" r="85" fill="url(#' + gr + ')"/>' +
        '<circle cx="150" cy="150" r="83" fill="none" stroke="rgba(255,247,220,0.55)" stroke-width="1.5"/>' +
        '<circle cx="150" cy="150" r="72" fill="none" stroke="#5a3d11" stroke-width="3"/>' +
        '<circle cx="150" cy="150" r="69" fill="url(#' + face + ')" stroke="#c39a37" stroke-width="2"/>' +
        // 数字は HTML オーバーレイ(.dcard-cost)で重ねる（画像枠でも同じ位置に載るように）。
      '</g>' +
      // 羊皮紙パネル（効果欄。文字はHTMLで重ねる）
      '<rect x="70" y="1168" width="860" height="278" rx="22" fill="url(#' + gv + ')" stroke="#2e2008" stroke-width="3" filter="url(#' + sh + ')"/>' +
      '<rect x="84" y="1182" width="832" height="250" rx="15" fill="url(#' + p + ')" stroke="#5a3d11" stroke-width="1.5"/>' +
      '<rect x="84" y="1182" width="832" height="250" rx="15" fill="url(#' + ns + ')" opacity="0.06"/>' +
      // パネル上部の装飾ライン
      '<rect x="120" y="1198" width="760" height="3" rx="1.5" fill="url(#' + g + ')" opacity="0.7"/>' +
      '</svg>'
    );
  };
})();
