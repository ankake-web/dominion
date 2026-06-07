/* ============================================================
   ドミニオン — UI（画面描画とタップ操作）
   ============================================================ */
(function () {
  const DOM = (window.DOM = window.DOM || {});
  const E = () => DOM.engine;

  /* ---------- UI 状態 ---------- */
  const UI = {
    view: 'home',           // home / localSetup / onlineMenu / createRoom / joinRoom / waitGuest / game
    mode: 'local',          // local / online
    mySeat: null,           // online: 自分の座席
    localViewer: 0,         // local: いま手札を見ている人
    store: null,
    roomCode: null,
    prefillCode: '',
    sheet: null,            // {cardId, primary}
    selection: [],
    _selKey: '',
    toast: null,
    _t: null,
  };
  DOM.UI = UI;

  /* ---------- DOM ヘルパ ---------- */
  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k === 'style') e.setAttribute('style', v);
        else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
        else e.setAttribute(k, v);
      }
    }
    kids.flat().forEach((c) => {
      if (c == null || c === false) return;
      e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
    });
    return e;
  }

  /* ---------- カード見た目ヘルパ ---------- */
  const TYPE_JP = { treasure: '財宝', victory: '勝利点', curse: '呪い', action: 'アクション', attack: 'アタック', reaction: 'リアクション' };
  function typeClass(id) {
    const c = DOM.CARDS[id];
    if (c.types.includes('treasure')) return 'type-treasure';
    if (c.types.includes('victory')) return 'type-victory';
    if (c.types.includes('curse')) return 'type-curse';
    if (c.types.includes('reaction')) return 'type-reaction';
    return 'type-action';
  }
  function typeLabel(id) {
    return DOM.CARDS[id].types.map((t) => TYPE_JP[t]).join('・');
  }
  // カード画像（Web最適化JPEG）。読み込めなければCSS描画にフォールバック。
  function cardArt(id) {
    return h('img', {
      class: 'card-art',
      src: 'assets/' + id + '.jpg',
      alt: DOM.CARDS[id].name,
      loading: 'lazy',
      onerror: function () {
        this.style.display = 'none';
        if (this.parentElement) this.parentElement.classList.add('art-failed');
      },
    });
  }

  function cardEl(id, opts) {
    opts = opts || {};
    const c = DOM.CARDS[id];
    const cls = 'card has-art ' + typeClass(id) +
      (c.types.includes('attack') ? ' attack-mark' : '') +
      (opts.extra ? ' ' + opts.extra : '');
    return h('div', { class: cls, onclick: opts.onClick },
      h('div', { class: 'ccost' }, c.cost),
      h('div', { class: 'cname' }, c.name),
      h('div', { class: 'ctype' }, typeLabel(id)),
      h('div', { class: 'ctext' }, c.text || ''),
      cardArt(id)
    );
  }
  function pileEl(id, state, opts) {
    opts = opts || {};
    const c = DOM.CARDS[id];
    const n = state.supply[id] || 0;
    const cls = 'pile has-art ' + typeClass(id) + (n <= 0 ? ' empty' : '') +
      (opts.buyable ? ' buyable' : '') + (opts.gainable ? ' gainable' : '');
    return h('div', { class: cls, onclick: opts.onClick },
      h('div', { class: 'pcost' }, c.cost),
      h('div', { class: 'pname' }, c.name),
      cardArt(id),
      h('div', { class: 'pile-count' }, '残' + n)
    );
  }

  /* ---------- 共通操作 ---------- */
  function mount(node) {
    const app = document.getElementById('app');
    app.innerHTML = '';
    app.appendChild(node);
  }
  function go(view) { UI.view = view; UI.sheet = null; render(); }
  function dispatch(action) { UI.sheet = null; UI.store.dispatch(action); }
  function closeSheet() { UI.sheet = null; render(); }
  function showSheet(cardId, primary) { UI.sheet = { cardId, primary }; render(); }
  function toast(msg) {
    UI.toast = msg; render();
    clearTimeout(UI._t);
    UI._t = setTimeout(() => { UI.toast = null; render(); }, 2400);
  }

  function onStoreChange(state) {
    if (UI.view === 'waitGuest' && state && state.seats && state.seats[1]) UI.view = 'game';
    render();
  }

  /* ============================================================
     ホーム / 設定画面
     ============================================================ */
  function viewHome() {
    return h('div', { class: 'home' },
      h('div', { class: 'crest' }, '👑'),
      h('h1', null, 'Dominion'),
      h('p', { class: 'sub' }, 'ドミニオン  基本セット'),
      h('div', { class: 'menu' },
        h('button', { class: 'btn btn-primary btn-block', onclick: () => go('localSetup') }, '1台で2人プレイ'),
        h('button', { class: 'btn btn-block', onclick: () => go('onlineMenu') }, 'オンラインで対戦（2台）'),
      ),
      DOM.db ? null : h('p', { class: 'muted', style: 'font-size:12px;max-width:300px' },
        'オンライン対戦には Firebase の設定が必要です（手順は後で表示されます）。まずは「1台で2人プレイ」でルールを試せます。')
    );
  }

  function viewLocalSetup() {
    let n1 = 'プレイヤー1', n2 = 'プレイヤー2';
    const i1 = h('input', { type: 'text', value: n1, oninput: (e) => (n1 = e.target.value) });
    const i2 = h('input', { type: 'text', value: n2, oninput: (e) => (n2 = e.target.value) });
    return h('div', { class: 'home' },
      h('h2', null, '1台で2人プレイ'),
      h('p', { class: 'muted', style: 'font-size:13px;max-width:320px' }, '端末を回しながら遊びます。相手の番になると手札を隠す画面をはさみます。'),
      h('div', { class: 'panel' },
        h('div', { class: 'field' }, h('label', null, 'プレイヤー1（先攻）'), i1),
        h('div', { class: 'field' }, h('label', null, 'プレイヤー2'), i2),
        h('button', { class: 'btn btn-primary btn-block', onclick: () => startLocal(n1, n2) }, 'ゲーム開始'),
      ),
      h('button', { class: 'btn btn-ghost', onclick: () => go('home') }, '戻る')
    );
  }

  function viewOnlineMenu() {
    return h('div', { class: 'home' },
      h('h2', null, 'オンラインで対戦'),
      h('div', { class: 'panel' },
        h('button', { class: 'btn btn-primary btn-block', onclick: () => go('createRoom') }, '部屋を作る（ホスト）'),
        h('button', { class: 'btn btn-block', onclick: () => go('joinRoom') }, '部屋に参加する'),
        DOM.db ? null : h('p', { class: 'muted', style: 'font-size:12px' },
          '※ いまは Firebase 未設定のため使えません。設定後にご利用ください。')
      ),
      h('button', { class: 'btn btn-ghost', onclick: () => go('home') }, '戻る')
    );
  }

  function viewCreateRoom() {
    let name = 'あなた';
    const inp = h('input', { type: 'text', value: name, oninput: (e) => (name = e.target.value) });
    return h('div', { class: 'home' },
      h('h2', null, '部屋を作る'),
      h('div', { class: 'panel' },
        h('div', { class: 'field' }, h('label', null, 'あなたの名前'), inp),
        h('button', { class: 'btn btn-primary btn-block', onclick: () => createRoom(name) }, '部屋を作成'),
      ),
      h('button', { class: 'btn btn-ghost', onclick: () => go('onlineMenu') }, '戻る')
    );
  }

  function viewJoinRoom() {
    let name = '対戦相手';
    let code = UI.prefillCode || '';
    const ci = h('input', { type: 'text', class: 'code-input', maxlength: '4', value: code,
      oninput: (e) => { code = e.target.value.toUpperCase(); e.target.value = code; } });
    const ni = h('input', { type: 'text', value: name, oninput: (e) => (name = e.target.value) });
    return h('div', { class: 'home' },
      h('h2', null, '部屋に参加'),
      h('div', { class: 'panel' },
        h('div', { class: 'field' }, h('label', null, '部屋コード（4文字）'), ci),
        h('div', { class: 'field' }, h('label', null, 'あなたの名前'), ni),
        h('button', { class: 'btn btn-primary btn-block', onclick: () => joinRoom(code, name) }, '参加する'),
      ),
      h('button', { class: 'btn btn-ghost', onclick: () => go('onlineMenu') }, '戻る')
    );
  }

  function viewWaitGuest() {
    const link = location.origin + location.pathname + '?room=' + UI.roomCode;
    return h('div', { class: 'home' },
      h('div', { class: 'crest' }, '⏳'),
      h('h2', null, '相手の参加を待っています'),
      h('p', { class: 'muted' }, 'この部屋コードを相手に伝えてください'),
      h('div', { class: 'code-display' }, UI.roomCode),
      h('button', { class: 'btn btn-block', onclick: () => copy(link) }, '参加用リンクをコピー'),
      h('p', { class: 'muted', style: 'font-size:12px;word-break:break-all;max-width:320px' }, link),
      h('button', { class: 'btn btn-ghost', onclick: () => leaveOnline() }, 'キャンセル')
    );
  }

  function copy(text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('コピーしました'), () => toast(text));
    else toast(text);
  }

  /* ============================================================
     ゲーム画面
     ============================================================ */
  function viewGameDispatch() {
    const state = UI.store.state;
    if (!state) return h('div', { class: 'home' }, h('p', { class: 'muted' }, '読み込み中…'));
    if (state.gameOver) return viewGameOver(state);

    const actor = E().actor(state);
    if (UI.mode === 'local' && actor !== UI.localViewer) return viewPassGate(state, actor);

    const viewer = UI.mode === 'local' ? actor : UI.mySeat;
    const interactive = actor === viewer;

    const frag = document.createDocumentFragment();
    frag.appendChild(viewBoard(state, viewer, actor, interactive));
    if (interactive && state.pending && state.pending.player === viewer) {
      frag.appendChild(viewPendingModal(state, state.pending));
    }
    return frag;
  }

  function phaseLabel(ph) { return ph === 'action' ? 'アクション フェーズ' : '購入 フェーズ'; }

  function viewBoard(state, viewer, actor, interactive) {
    const t = state.turn;
    const active = state.players[t.active];
    const me = state.players[viewer];
    const opp = state.players[(viewer + 1) % state.players.length];

    // 上部バー
    const top = h('div', { class: 'topbar' },
      h('div', { class: 'turn-tag' },
        h('div', { class: 'who' }, active.name + ' の番'),
        h('div', { class: 'phase' }, phaseLabel(t.phase))
      ),
      h('div', { class: 'resources' },
        h('div', { class: 'badge act' }, h('div', { class: 'v' }, t.actions), h('div', { class: 'k' }, 'アクション')),
        h('div', { class: 'badge buy' }, h('div', { class: 'v' }, t.buys), h('div', { class: 'k' }, '購入')),
        h('div', { class: 'badge coin' }, h('div', { class: 'v' }, t.coins), h('div', { class: 'k' }, 'コイン'))
      )
    );

    // 相手バー
    const oppActive = state.players[t.active] === opp;
    const oppBar = h('div', { class: 'opp-bar' },
      h('span', { class: 'nm' }, opp.name),
      oppActive ? h('span', { class: 'turn-on' }, '◀ 手番') : null,
      h('div', { class: 'mini' },
        h('span', null, '山 ' + opp.deck.length),
        h('span', null, '手 ' + opp.hand.length),
        h('span', null, '捨 ' + opp.discard.length)
      )
    );

    // サプライ
    const order = DOM.SUPPLY_ORDER(state.kingdom);
    const supply = h('div', { class: 'supply-grid' },
      order.map((id) => {
        const cost = DOM.CARDS[id].cost;
        const buyable = interactive && t.phase === 'buy' && !state.pending &&
          (state.supply[id] || 0) > 0 && t.buys > 0 && cost <= t.coins;
        return pileEl(id, state, {
          buyable,
          onClick: () => onPileTap(state, id, viewer, interactive),
        });
      })
    );

    // 場（プレイ済み）
    const playArea = h('div', { class: 'play-area' },
      active.inPlay.length
        ? active.inPlay.map((id) => h('div', { class: 'chip-card ' + typeClass(id) }, DOM.CARDS[id].name))
        : h('div', { class: 'empty-note' }, 'まだ場にカードはありません')
    );

    // 手札
    const handCards = me.hand.length
      ? me.hand.map((id, idx) =>
          cardEl(id, {
            extra: handCardPlayable(state, id, interactive) ? '' : 'dim',
            onClick: () => onHandTap(state, id, viewer, interactive),
          }))
      : [h('div', { class: 'empty-note' }, '手札がありません')];

    // ログ
    const logLines = state.log.slice(-6);
    const logBox = h('div', { class: 'log' },
      logLines.map((l, i) =>
        h('div', { class: i === logLines.length - 1 ? 'latest' : '' }, l))
    );

    return h('div', null,
      top,
      oppBar,
      UI.mode === 'online' ? h('div', { class: 'muted', style: 'font-size:11px;text-align:center;margin:-4px 0 4px' }, '部屋 ' + UI.roomCode + '　/　あなた: ' + me.name) : null,
      h('div', { class: 'section-h' }, 'サプライ（場の山札）'),
      supply,
      h('div', { class: 'zone-h' }, h('span', { class: 't' }, '場'), ),
      playArea,
      h('div', { class: 'zone-h' },
        h('span', { class: 't' }, me.name + ' の手札'),
        h('span', { class: 'c' }, me.hand.length + ' 枚')),
      h('div', { class: 'hand-row' }, handCards),
      logBox,
      viewActionBar(state, viewer, actor, interactive)
    );
  }

  function handCardPlayable(state, id, interactive) {
    if (!interactive || state.pending) return false;
    const t = state.turn;
    if (t.phase === 'action') return DOM.CARDS[id].types.includes('action') && t.actions > 0;
    if (t.phase === 'buy') return DOM.CARDS[id].types.includes('treasure');
    return false;
  }

  function onHandTap(state, id, viewer, interactive) {
    const c = DOM.CARDS[id];
    const t = state.turn;
    if (interactive && !state.pending && t.phase === 'action' && c.types.includes('action') && t.actions > 0) {
      showSheet(id, { label: '使う', cls: 'btn-primary', on: () => dispatch({ type: 'PLAY_ACTION', card: id }) });
    } else if (interactive && !state.pending && t.phase === 'buy' && c.types.includes('treasure')) {
      showSheet(id, { label: '財宝を出す', cls: 'btn-primary', on: () => dispatch({ type: 'PLAY_TREASURE', card: id }) });
    } else {
      showSheet(id, null); // 説明だけ
    }
  }

  function onPileTap(state, id, viewer, interactive) {
    const t = state.turn;
    const cost = DOM.CARDS[id].cost;
    const canBuy = interactive && !state.pending && t.phase === 'buy' &&
      (state.supply[id] || 0) > 0 && t.buys > 0 && cost <= t.coins;
    if (canBuy) {
      showSheet(id, { label: '購入する（' + cost + 'コイン）', cls: 'btn-primary', on: () => dispatch({ type: 'BUY', card: id }) });
    } else {
      showSheet(id, null);
    }
  }

  function viewActionBar(state, viewer, actor, interactive) {
    const t = state.turn;
    // 選択待ち中
    if (state.pending) {
      const who = state.players[state.pending.player].name;
      if (interactive && state.pending.player === viewer) {
        return h('div', { class: 'actions-bar' }, h('div', { class: 'btn btn-ghost btn-block', style: 'pointer-events:none' }, '↑ 選択してください'));
      }
      return h('div', { class: 'actions-bar' }, h('div', { class: 'btn btn-ghost btn-block', style: 'pointer-events:none' }, who + ' の対応を待っています…'));
    }
    if (!interactive) {
      const who = state.players[actor].name;
      return h('div', { class: 'actions-bar' }, h('div', { class: 'btn btn-ghost btn-block', style: 'pointer-events:none' }, who + ' の番です…'));
    }
    if (t.phase === 'action') {
      return h('div', { class: 'actions-bar' },
        h('button', { class: 'btn btn-primary btn-block', onclick: () => dispatch({ type: 'END_ACTION_PHASE' }) }, '購入フェーズへ ▶')
      );
    }
    // buy phase
    const hasTreasure = state.players[viewer].hand.some((c) => DOM.CARDS[c].types.includes('treasure'));
    return h('div', { class: 'actions-bar' },
      h('button', { class: 'btn btn-block', disabled: hasTreasure ? null : 'disabled', onclick: () => dispatch({ type: 'PLAY_ALL_TREASURES' }) }, '財宝を全部出す'),
      h('button', { class: 'btn btn-primary btn-block', onclick: () => dispatch({ type: 'END_TURN' }) }, 'ターンを終える')
    );
  }

  /* ---------- パスゲート（端末の受け渡し） ---------- */
  function viewPassGate(state, actor) {
    const name = state.players[actor].name;
    return h('div', { class: 'gate' },
      h('div', { class: 'crest' }, '🤝'),
      h('h2', null, name + ' さんの番です'),
      h('p', null, '端末を ' + name + ' さんに渡してください'),
      h('button', { class: 'btn btn-primary', onclick: () => { UI.localViewer = actor; render(); } }, 'タップして手札を見る')
    );
  }

  /* ---------- 選択モーダル ---------- */
  function viewPendingModal(state, pd) {
    const key = pd.type + (pd.stage || '');
    if (UI._selKey !== key) { UI.selection = []; UI._selKey = key; }
    const p = state.players[pd.player];

    if (pd.type === 'cellar') return modalMultiHand(p, '地下貯蔵庫', '捨てるカードを選び、同じ枚数を引きます。（0枚でもOK）',
      (n) => '確定（' + n + '枚 捨てる）', true,
      (cards) => dispatch({ type: 'CELLAR_RESOLVE', cards }));

    if (pd.type === 'militia') {
      const need = p.hand.length - 3;
      const hasMoat = p.hand.includes('moat');
      return modalMilitia(p, need, hasMoat);
    }

    if (pd.type === 'mine' && pd.stage === 'trash') return modalSingleHand(p, '鉱山 — 廃棄', '廃棄する財宝を選びます（しなくてもよい）。',
      (id) => DOM.CARDS[id].types.includes('treasure'),
      (id) => dispatch({ type: 'MINE_TRASH', card: id }),
      { label: '廃棄しない', on: () => dispatch({ type: 'MINE_TRASH', card: null }) });

    if (pd.type === 'mine' && pd.stage === 'gain') return modalGainSupply(state, '鉱山 — 獲得', 'コスト ' + pd.maxCost + ' 以下の財宝を手札に獲得します。',
      (id) => DOM.CARDS[id].types.includes('treasure') && DOM.CARDS[id].cost <= pd.maxCost,
      (id) => dispatch({ type: 'MINE_GAIN', card: id }),
      () => dispatch({ type: 'MINE_GAIN', card: null }));

    if (pd.type === 'remodel' && pd.stage === 'trash') return modalSingleHand(p, '改築 — 廃棄', '廃棄するカードを選びます。',
      () => true,
      (id) => dispatch({ type: 'REMODEL_TRASH', card: id }), null);

    if (pd.type === 'remodel' && pd.stage === 'gain') return modalGainSupply(state, '改築 — 獲得', 'コスト ' + pd.maxCost + ' 以下のカードを獲得します。',
      (id) => DOM.CARDS[id].cost <= pd.maxCost,
      (id) => dispatch({ type: 'REMODEL_GAIN', card: id }),
      () => dispatch({ type: 'REMODEL_GAIN', card: null }));

    if (pd.type === 'workshop') return modalGainSupply(state, '工房 — 獲得', 'コスト 4 以下のカードを獲得します。',
      (id) => DOM.CARDS[id].cost <= 4,
      (id) => dispatch({ type: 'WORKSHOP_GAIN', card: id }),
      () => dispatch({ type: 'WORKSHOP_GAIN', card: null }));

    return h('div');
  }

  function handChip(id, idx, on, onClick) {
    const c = DOM.CARDS[id];
    return h('div', { class: 'chip ' + typeClass(id) + (on ? ' on' : ''), onclick: onClick },
      h('span', { class: 'cc' }, c.cost), c.name);
  }

  // 複数選択（地下貯蔵庫）
  function modalMultiHand(p, title, desc, confirmLabel, allowZero, onConfirm) {
    const chips = p.hand.map((id, idx) =>
      handChip(id, idx, UI.selection.includes(idx), () => {
        const i = UI.selection.indexOf(idx);
        if (i >= 0) UI.selection.splice(i, 1); else UI.selection.push(idx);
        render();
      }));
    const n = UI.selection.length;
    return modalShell(title, desc,
      chips,
      h('button', { class: 'btn btn-primary btn-block', disabled: (!allowZero && n === 0) ? 'disabled' : null,
        onclick: () => onConfirm(UI.selection.map((i) => p.hand[i])) }, confirmLabel(n))
    );
  }

  // 民兵
  function modalMilitia(p, need, hasMoat) {
    const chips = p.hand.map((id, idx) =>
      handChip(id, idx, UI.selection.includes(idx), () => {
        const i = UI.selection.indexOf(idx);
        if (i >= 0) UI.selection.splice(i, 1);
        else if (UI.selection.length < need) UI.selection.push(idx);
        render();
      }));
    const remain = need - UI.selection.length;
    const buttons = h('div', null,
      hasMoat ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px',
        onclick: () => dispatch({ type: 'MOAT_REVEAL' }) }, '🛡 堀を公開して無効化') : null,
      h('button', { class: 'btn btn-primary btn-block', disabled: remain === 0 ? null : 'disabled',
        onclick: () => dispatch({ type: 'MILITIA_RESOLVE', cards: UI.selection.map((i) => p.hand[i]) }) },
        remain === 0 ? '確定（捨てる）' : 'あと ' + remain + ' 枚 選ぶ')
    );
    return modalShell('民兵を受ける', '手札が3枚になるまで捨てます。' + (hasMoat ? '「堀」で無効化もできます。' : ''), chips, buttons);
  }

  // 単一選択（手札から）
  function modalSingleHand(p, title, desc, filter, onPick, skip) {
    const elig = p.hand.map((id, idx) => ({ id, idx })).filter((x) => filter(x.id));
    const chips = elig.length
      ? elig.map((x) => handChip(x.id, x.idx, false, () => onPick(x.id)))
      : [h('p', { class: 'muted' }, '対象のカードがありません')];
    const btn = skip
      ? h('button', { class: 'btn btn-block', onclick: skip.on }, skip.label)
      : null;
    return modalShell(title, desc, chips, btn);
  }

  // サプライから獲得（skipOnEmpty: 対象0件のとき抜けるための処理）
  function modalGainSupply(state, title, desc, filter, onPick, skipOnEmpty) {
    const order = DOM.SUPPLY_ORDER(state.kingdom);
    const elig = order.filter((id) => filter(id) && (state.supply[id] || 0) > 0);
    const chips = elig.length
      ? elig.map((id) =>
          h('div', { class: 'chip ' + typeClass(id), onclick: () => onPick(id) },
            h('span', { class: 'cc' }, DOM.CARDS[id].cost), DOM.CARDS[id].name,
            h('span', { class: 'muted', style: 'font-size:11px' }, '残' + state.supply[id])))
      : [h('p', { class: 'muted' }, '獲得できるカードがありません')];
    const footer = (!elig.length && skipOnEmpty)
      ? h('button', { class: 'btn btn-block', onclick: skipOnEmpty }, '獲得せずに進む')
      : null;
    return modalShell(title, desc, chips, footer);
  }

  function modalShell(title, desc, chips, footer) {
    return h('div', { class: 'modal-scrim' },
      h('div', { class: 'modal' },
        h('h3', null, title),
        h('p', { class: 'desc' }, desc),
        h('div', { class: 'chip-grid' }, chips),
        footer || null
      )
    );
  }

  /* ---------- カード詳細シート ---------- */
  function viewSheet() {
    const id = UI.sheet.cardId;
    const c = DOM.CARDS[id];
    const p = UI.sheet.primary;
    const state = UI.store && UI.store.state;
    const remain = state && state.supply[id] != null ? state.supply[id] : null;
    return h('div', { class: 'scrim', onclick: (e) => { if (e.target.classList.contains('scrim')) closeSheet(); } },
      h('div', { class: 'sheet' },
        h('div', { class: 'grip' }),
        h('div', { class: 'sheet-card has-art ' + typeClass(id) },
          h('div', { class: 'ccost' }, c.cost),
          h('div', { class: 'cname' }, c.name),
          h('div', { class: 'ctype' }, typeLabel(id)),
          h('div', { class: 'ctext' }, c.text || ''),
          cardArt(id)
        ),
        remain != null ? h('div', { class: 'info-line' }, 'サプライ残り ' + remain + ' 枚') : null,
        p ? h('button', { class: 'btn ' + (p.cls || '') + ' btn-block', onclick: p.on }, p.label) : null,
        h('button', { class: 'btn btn-ghost btn-block', style: 'margin-top:8px', onclick: closeSheet }, 'とじる')
      )
    );
  }

  /* ---------- 勝敗画面 ---------- */
  function viewGameOver(state) {
    const r = state.result;
    const maxVp = Math.max.apply(null, r.scores.map((s) => s.vp));
    const winNames = r.winners.map((i) => state.players[i].name).join('・');
    const tie = r.winners.length > 1;
    return h('div', { class: 'result' },
      h('div', { class: 'trophy' }, tie ? '🤝' : '🏆'),
      h('h1', null, tie ? '引き分け' : winNames + ' の勝ち！'),
      h('p', { class: 'muted' }, r.reason + 'ため終了'),
      h('div', { class: 'score-table' },
        state.players.map((pl, i) => {
          const s = r.scores[i];
          return h('div', { class: 'score-row ' + (r.winners.includes(i) ? 'win' : '') },
            h('div', null,
              h('div', { class: 'nm' }, pl.name),
              h('div', { class: 'tn' }, s.turns + ' ターン')),
            h('div', { class: 'vp' }, s.vp + ' 点'));
        })
      ),
      UI.mode === 'local'
        ? h('button', { class: 'btn btn-primary', onclick: () => restartLocal(state) }, 'もう一度遊ぶ')
        : h('button', { class: 'btn btn-primary', onclick: () => leaveOnline() }, 'ホームに戻る')
    );
  }

  /* ============================================================
     ゲーム開始・部屋管理
     ============================================================ */
  function startLocal(n1, n2) {
    const st = E().createInitialState([n1 || 'プレイヤー1', n2 || 'プレイヤー2']);
    UI.mode = 'local'; UI.mySeat = null; UI.localViewer = 0;
    UI.store = DOM.LocalStore(st);
    UI.store.subscribe(onStoreChange);
    UI.view = 'game';
    render();
  }
  function restartLocal(state) {
    const names = state.players.map((p) => p.name);
    UI.localViewer = 0;
    UI.store.dispatch({ type: 'NEW_GAME', players: names, kingdom: state.kingdom });
  }

  function createRoom(name) {
    if (!DOM.db) { toast('Firebase が未設定です'); return; }
    const code = DOM.makeRoomCode();
    const st = E().createInitialState([name || 'ホスト', '対戦相手']);
    st.seats = [name || 'ホスト', null];
    st.online = true;
    st.version = 1;
    DOM.db.ref('rooms/' + code + '/state').set(st).then(() => {
      UI.mode = 'online'; UI.mySeat = 0; UI.roomCode = code;
      UI.store = DOM.OnlineStore(DOM.db, code, 0);
      UI.store.subscribe(onStoreChange);
      UI.view = 'waitGuest';
      render();
    }).catch((e) => toast('作成に失敗: ' + e.message));
  }

  function joinRoom(code, name) {
    if (!DOM.db) { toast('Firebase が未設定です'); return; }
    code = (code || '').toUpperCase().trim();
    if (code.length !== 4) { toast('コードは4文字です'); return; }
    const myName = name || '対戦相手';
    const ref = DOM.db.ref('rooms/' + code + '/state');
    // トランザクションで席(seats[1])をアトミックに確保（同時参加の競合を防ぐ）
    ref.transaction((st) => {
      if (st === null) return null;             // 初回キャッシュ未取得 → null返しで再試行を促す
      if (st.seats && st.seats[1]) return;      // 既に満員 → 中断
      st.players[1].name = myName;
      st.seats = st.seats || [st.players[0].name, null];
      st.seats[1] = myName;
      st.log = st.log || [];
      st.log.push(myName + ' が参加しました。');
      st.version = (st.version || 0) + 1;
      return st;
    }, (err, committed, snap) => {
      if (err) { toast('参加に失敗: ' + err.message); return; }
      const st = snap && snap.val();
      if (!st) { toast('その部屋は見つかりません'); return; }
      // 自分が席を取れたか（取れなければ満員）
      if (!committed || !st.seats || st.seats[1] !== myName) { toast('この部屋は満員です'); return; }
      UI.mode = 'online'; UI.mySeat = 1; UI.roomCode = code;
      UI.store = DOM.OnlineStore(DOM.db, code, 1);
      UI.store.subscribe(onStoreChange);
      UI.view = 'game';
      render();
    });
  }

  function leaveOnline() {
    if (UI.store && UI.store.detach) UI.store.detach();
    UI.store = null; UI.mode = 'local'; UI.mySeat = null; UI.roomCode = null;
    go('home');
  }

  /* ============================================================
     ルート描画
     ============================================================ */
  function render() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    let root;
    switch (UI.view) {
      case 'home': root = viewHome(); break;
      case 'localSetup': root = viewLocalSetup(); break;
      case 'onlineMenu': root = viewOnlineMenu(); break;
      case 'createRoom': root = viewCreateRoom(); break;
      case 'joinRoom': root = viewJoinRoom(); break;
      case 'waitGuest': root = viewWaitGuest(); break;
      case 'game': root = viewGameDispatch(); break;
      default: root = viewHome();
    }
    app.appendChild(root);
    if (UI.sheet) app.appendChild(viewSheet());
    if (UI.toast) app.appendChild(h('div', { class: 'toast' }, UI.toast));
  }
  DOM.render = render;

  /* ---------- 起動 ---------- */
  function boot() {
    const params = new URLSearchParams(location.search);
    const room = params.get('room');
    if (room) {
      UI.prefillCode = room.toUpperCase().slice(0, 4);
      UI.view = DOM.db ? 'joinRoom' : 'onlineMenu';
    }
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
