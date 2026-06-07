/* ============================================================
   js/cardview.js — Cardコンポーネント（枠は画像／文字はHTML+CSSで重ねる）
   ------------------------------------------------------------
   DOM.cardView(card | id, opts) → カードのDOM要素を返す。
   - 種別ごとの枠画像 assets/frames/<type>.jpg を背景に敷く
   - 中央イラスト assets/art/<id>.jpg を枠の中央領域に重ねる（未配置時はアイコン）
   - コスト/カード名/種別/効果は枠の各領域に CSS で位置を合わせて重ねる
   - 効果テキストは画像に焼かず文字として描画（effects 配列から）
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

  DOM.cardView = function (card, opts) {
    opts = opts || {};
    if (typeof card === 'string') card = (DOM.CARD_DATA || {})[card];
    if (!card) return el('div', 'dcard');

    const theme = KNOWN_THEMES.indexOf(card.type) >= 0 ? card.type : 'action';
    const root = el('div', 'dcard theme-' + theme);
    if (opts.onClick) { root.style.cursor = 'pointer'; root.addEventListener('click', () => opts.onClick(card)); }

    // 枠画像（背景）。読めなければ .dcard の地色で代替。
    const frame = el('img', 'dcard-frame-img');
    frame.alt = ''; frame.setAttribute('aria-hidden', 'true'); frame.loading = 'lazy';
    frame.addEventListener('error', () => { frame.style.display = 'none'; root.classList.add('noframe'); });
    frame.src = 'assets/frames/' + theme + '.png';
    root.appendChild(frame);

    // 中央イラスト
    const art = el('div', 'dcard-art');
    const ph = el('div', 'ph');
    ph.appendChild(el('div', 'sym', card.icon || '🂠'));
    art.appendChild(ph);
    if (card.art) {
      const img = el('img');
      img.alt = card.name; img.loading = 'lazy';
      img.addEventListener('error', () => { img.style.display = 'none'; });
      img.src = card.art;
      art.appendChild(img);
    }
    root.appendChild(art);

    // コスト（枠左上のバッジ位置に重ねる）
    root.appendChild(el('div', 'dcard-cost', el('span', null, String(card.cost))));
    // カード名（上部バナー）
    root.appendChild(el('div', 'dcard-name' + (String(card.name).length > 5 ? ' long' : ''), el('span', null, card.name)));
    // 種別（名前下のバナー）
    root.appendChild(el('div', 'dcard-type', el('span', null, card.typeLabel || card.type)));

    // 効果欄（下部の羊皮紙領域。effects配列をmap）
    const effects = Array.isArray(card.effects) ? card.effects : [];
    const box = el('div', 'dcard-effects');
    box.setAttribute('data-count', String(Math.min(effects.length, 4)));
    effects.forEach((text) => {
      const row = el('div', 'dcard-eff');
      row.appendChild(el('span', 'diamond'));
      row.appendChild(el('span', 'eff-text', text));
      box.appendChild(row);
    });
    root.appendChild(box);

    if (opts.fit !== false) requestAnimationFrame(() => DOM.fitCardEffects(root));
    return root;
  };

  // 効果欄が枠からはみ出す場合はフォントを段階的に縮小（DOM接続後に測定）。
  DOM.fitCardEffects = function (cardEl) {
    const box = cardEl.querySelector('.dcard-effects');
    if (!box || !box.isConnected) return;
    const count = parseInt(box.getAttribute('data-count'), 10) || 1;
    let fs = count >= 4 ? 3.5 : count === 3 ? 4 : 4.6;
    box.style.setProperty('--eff-fs', fs + 'cqw');
    let guard = 0;
    while (box.scrollHeight > box.clientHeight + 1 && fs > 2.4 && guard < 24) {
      fs -= 0.2; box.style.setProperty('--eff-fs', fs + 'cqw'); guard++;
    }
  };

  DOM.fitAllCards = function (rootEl) {
    (rootEl || document).querySelectorAll('.dcard').forEach((c) => DOM.fitCardEffects(c));
  };
})();
