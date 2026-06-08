/* ============================================================
   js/cardview.js — Cardコンポーネント（完成カード画像をそのまま表示）
   ------------------------------------------------------------
   DOM.cardView(card | id, opts) → カードのDOM要素を返す。
   - カードは完成画像 asset/<id>.jpg（枠・コスト・名前・効果まで焼き込み済み）。
     枠やコスト/効果を別途CSSで描かず、画像1枚を表示するだけ。
   - 画像が無い時はカード名のプレースホルダを出す。
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

  DOM.cardView = function (card, opts) {
    opts = opts || {};
    if (typeof card === 'string') card = (DOM.CARD_DATA || {})[card];
    if (!card) return el('div', 'dcard');

    const root = el('div', 'dcard');
    if (opts.onClick) { root.style.cursor = 'pointer'; root.addEventListener('click', () => opts.onClick(card)); }

    const ph = el('div', 'dcard-ph', el('span', null, card.name || '？'));
    root.appendChild(ph);

    const img = el('img', 'dcard-full');
    img.alt = card.name || ''; img.loading = 'lazy';
    img.addEventListener('error', () => { img.style.display = 'none'; root.classList.add('noimg'); });
    img.src = card.art || ('asset/' + card.id + '.jpg');
    root.appendChild(img);

    return root;
  };

  // 旧API互換（呼ばれても無害）
  DOM.fitCardEffects = function () {};
  DOM.fitAllCards = function () {};
})();
