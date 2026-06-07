/* ============================================================
   js/cardview.js — Cardコンポーネント（データ→HTML/CSS/SVGテンプレート）
   ------------------------------------------------------------
   DOM.cardView(card | id, opts) → カードのDOM要素を返す。
   - card.type に応じて色テーマを切替（theme-*）
   - effects 配列を効果欄に map 表示
   - 中央イラストは assets/art/<id>.png。未配置時はアイコンのプレースホルダ。
   - 効果テキストは画像に焼かず、すべて文字として描画。
   ============================================================ */
(function () {
  const DOM = (window.DOM = window.DOM || {});

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
  const KNOWN_THEMES = ['treasure', 'victory', 'curse', 'action', 'attack', 'reaction'];

  const FOOT_SVG =
    '<svg viewBox="0 0 120 12" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
    '<path d="M4 6 H46"/><path d="M74 6 H116"/>' +
    '<circle class="fill" cx="50" cy="6" r="2"/><circle class="fill" cx="70" cy="6" r="2"/>' +
    '<path class="fill" d="M60 1 L65 6 L60 11 L55 6 Z"/>' +
    '</svg>';

  // card: データオブジェクト or id文字列。opts.onClick で要素クリック時のコールバック。
  DOM.cardView = function (card, opts) {
    opts = opts || {};
    if (typeof card === 'string') card = (DOM.CARD_DATA || {})[card];
    if (!card) { const e = el('div', 'dcard'); return e; }

    const theme = KNOWN_THEMES.indexOf(card.type) >= 0 ? card.type : 'action';
    const root = el('div', 'dcard theme-' + theme);
    if (opts.onClick) { root.style.cursor = 'pointer'; root.addEventListener('click', () => opts.onClick(card)); }

    root.appendChild(el('div', 'dcard-frame'));

    const face = el('div', 'dcard-face');

    // コストバッジ
    const cost = el('div', 'dcard-cost');
    cost.appendChild(el('div', 'gem', String(card.cost)));
    face.appendChild(cost);

    // 名前（長い場合は縮小）
    const name = el('div', 'dcard-name' + (String(card.name).length > 5 ? ' long' : ''), card.name);
    face.appendChild(name);

    // 種別バナー
    face.appendChild(el('div', 'dcard-type', card.typeLabel || card.type));

    // 中央イラスト（PNG）。未配置時はアイコンのプレースホルダ。
    const art = el('div', 'dcard-art');
    const ph = el('div', 'ph');
    ph.appendChild(el('div', 'sym', card.icon || '🂠'));
    ph.appendChild(el('div', 'ph-label', card.name));
    art.appendChild(ph);
    if (card.art) {
      const img = el('img');
      img.alt = card.name; img.loading = 'lazy';
      img.addEventListener('error', () => { img.style.display = 'none'; });
      img.src = card.art;
      art.appendChild(img);
    }
    face.appendChild(art);

    // 効果欄（全カード共通デザイン・effects配列をmap）
    const effects = Array.isArray(card.effects) ? card.effects : [];
    const box = el('div', 'dcard-effects');
    box.setAttribute('data-count', String(Math.min(effects.length, 4)));
    effects.forEach((text) => {
      const row = el('div', 'dcard-eff');
      row.appendChild(el('span', 'diamond'));
      row.appendChild(el('span', 'eff-text', text));
      box.appendChild(row);
    });
    face.appendChild(box);

    // 下部の装飾（文章なし）
    const foot = el('div', 'dcard-foot');
    foot.innerHTML = FOOT_SVG;
    face.appendChild(foot);

    root.appendChild(face);

    if (opts.fit !== false) requestAnimationFrame(() => DOM.fitCardEffects(root));
    return root;
  };

  // 効果欄が枠からはみ出す場合はフォントを段階的に縮小（DOM接続後に測定）。
  DOM.fitCardEffects = function (cardEl) {
    const box = cardEl.querySelector('.dcard-effects');
    if (!box || !box.isConnected) return;
    const count = parseInt(box.getAttribute('data-count'), 10) || 1;
    let fs = count >= 4 ? 4 : count === 3 ? 4.4 : 5;
    box.style.setProperty('--eff-fs', fs + 'cqw');
    let guard = 0;
    while (box.scrollHeight > box.clientHeight + 1 && fs > 2.6 && guard < 24) {
      fs -= 0.25;
      box.style.setProperty('--eff-fs', fs + 'cqw');
      guard++;
    }
  };

  // 複数カードをまとめて整える（再レイアウト後の呼び出し用）
  DOM.fitAllCards = function (rootEl) {
    (rootEl || document).querySelectorAll('.dcard').forEach((c) => DOM.fitCardEffects(c));
  };
})();
