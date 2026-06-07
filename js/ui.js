/* ============================================================
   ドミニオン — UI（画面描画とタップ操作）
   ============================================================ */
(function () {
  const DOM = (window.DOM = window.DOM || {});
  const E = () => DOM.engine;
  const LEVEL_JP = { easy: '弱', normal: '普通', hard: '強' };

  /* ---------- UI 状態 ---------- */
  const UI = {
    view: 'home',
    mode: 'local',
    mySeat: null,
    localViewer: 0,
    store: null,
    roomCode: null,
    prefillCode: '',
    sheet: null,
    selection: [],
    _selKey: '',
    toast: null,
    _t: null,
    _cpuTimer: null,
    lastConfigs: null,
    setup: {
      seats: [
        { name: 'あなた', type: 'human', level: 'normal' },
        { name: 'CPU', type: 'cpu', level: 'normal' },
      ],
    },
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
  function typeLabel(id) { return DOM.CARDS[id].types.map((t) => TYPE_JP[t]).join('・'); }
  function cardArt(id) {
    return h('img', {
      class: 'card-art', src: 'assets/' + id + '.jpg', alt: DOM.CARDS[id].name, loading: 'lazy',
      onerror: function () { this.style.display = 'none'; if (this.parentElement) this.parentElement.classList.add('art-failed'); },
    });
  }

  // 手札・一覧用カード。opts: {onClick, count, size('lg'|'sm'), dim, badge}
  function cardEl(id, opts) {
    opts = opts || {};
    const c = DOM.CARDS[id];
    const cls = 'card has-art ' + (opts.size === 'sm' ? 'sm ' : '') + typeClass(id) +
      (c.types.includes('attack') ? ' attack-mark' : '') + (opts.dim ? ' dim' : '') +
      (opts.extra ? ' ' + opts.extra : '');
    return h('div', { class: cls, onclick: opts.onClick },
      h('div', { class: 'ccost' }, c.cost),
      h('div', { class: 'cname' }, c.name),
      h('div', { class: 'ctype' }, typeLabel(id)),
      h('div', { class: 'ctext' }, c.text || ''),
      cardArt(id),
      opts.count && opts.count > 1 ? h('div', { class: 'count-badge' }, '×' + opts.count) : null
    );
  }
  // サプライの山。opts: {onClick, buyable, gainable, size}
  function pileEl(id, state, opts) {
    opts = opts || {};
    const c = DOM.CARDS[id];
    const n = state.supply[id] || 0;
    const cls = 'pile has-art ' + (opts.size === 'sm' ? 'sm ' : '') + typeClass(id) +
      (n <= 0 ? ' empty' : '') + (opts.buyable ? ' buyable' : '') + (opts.gainable ? ' gainable' : '');
    return h('div', { class: cls, onclick: opts.onClick },
      h('div', { class: 'pcost' }, c.cost),
      h('div', { class: 'pname' }, c.name),
      cardArt(id),
      h('div', { class: 'pile-count' }, '残' + n)
    );
  }

  /* ---------- 共通操作 ---------- */
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
  function firstHuman(state) {
    const i = state.players.findIndex((p) => !p.isCpu);
    return i >= 0 ? i : 0;
  }
  function clampHumanViewer(state) {
    const lv = UI.localViewer;
    if (state.players[lv] && !state.players[lv].isCpu) return lv;
    return firstHuman(state);
  }

  /* ============================================================
     ホーム / メニュー
     ============================================================ */
  function viewHome() {
    return h('div', { class: 'home' },
      h('div', { class: 'crest' }, '👑'),
      h('h1', null, 'Dominion'),
      h('p', { class: 'sub' }, 'ドミニオン  基本セット'),
      h('div', { class: 'menu' },
        h('button', { class: 'btn btn-primary btn-block', onclick: () => go('setup') }, '対戦をはじめる'),
        h('button', { class: 'btn btn-block', onclick: () => go('localSetup') }, '1台で2人プレイ（クイック）'),
        h('button', { class: 'btn btn-block', onclick: () => go('onlineMenu') }, 'オンラインで対戦（2台）'),
        h('div', { class: 'menu-split' },
          h('button', { class: 'btn btn-ghost', onclick: () => go('rules') }, '📖 遊び方'),
          h('button', { class: 'btn btn-ghost', onclick: () => { UI._listReturn = 'home'; go('cardList'); } }, '🃏 カード一覧')
        )
      ),
      DOM.db ? null : h('p', { class: 'muted', style: 'font-size:12px;max-width:300px' },
        'オンライン対戦には Firebase の設定が必要です（手順は README）。それ以外は今すぐ遊べます。')
    );
  }

  /* ---------- セグメント切替UI ---------- */
  function segmented(options, current, onPick, extraCls) {
    return h('div', { class: 'seg ' + (extraCls || '') },
      options.map((o) =>
        h('button', { class: 'seg-btn' + (o.value === current ? ' on' : ''), onclick: () => onPick(o.value) }, o.label)));
  }

  /* ---------- 対戦設定（2〜4人・人間/CPU・強さ） ---------- */
  function viewSetup() {
    const seats = UI.setup.seats;
    const countSeg = segmented(
      [{ value: 2, label: '2人' }, { value: 3, label: '3人' }, { value: 4, label: '4人' }],
      seats.length,
      (n) => {
        while (seats.length < n) seats.push({ name: 'CPU' + (seats.length), type: 'cpu', level: 'normal' });
        while (seats.length > n) seats.pop();
        render();
      }, 'count-seg');

    const rows = seats.map((st, i) =>
      h('div', { class: 'seat-row' },
        h('div', { class: 'seat-head' },
          h('span', { class: 'seat-no' }, (i + 1)),
          h('input', { type: 'text', value: st.name, oninput: (e) => { st.name = e.target.value; } })
        ),
        h('div', { class: 'seat-opts' },
          segmented([{ value: 'human', label: '人間' }, { value: 'cpu', label: 'CPU' }], st.type, (v) => { st.type = v; render(); }),
          st.type === 'cpu'
            ? segmented([{ value: 'easy', label: '弱' }, { value: 'normal', label: '普通' }, { value: 'hard', label: '強' }], st.level, (v) => { st.level = v; render(); })
            : null
        )
      ));

    return h('div', { class: 'home setup' },
      h('h2', null, '対戦をはじめる'),
      h('p', { class: 'muted', style: 'font-size:13px' }, '人数と、各プレイヤーが人間かCPU（強さ）かを選びます。'),
      h('div', { class: 'panel' },
        h('div', { class: 'field' }, h('label', null, '人数'), countSeg),
        h('div', { class: 'seat-list' }, rows),
        h('button', { class: 'btn btn-primary btn-block', onclick: () => startConfigured() }, 'この設定で開始')
      ),
      h('button', { class: 'btn btn-ghost', onclick: () => go('home') }, '戻る')
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
        h('button', { class: 'btn btn-primary btn-block', onclick: () => startConfigured([{ name: n1 || 'プレイヤー1', type: 'human' }, { name: n2 || 'プレイヤー2', type: 'human' }]) }, 'ゲーム開始')
      ),
      h('button', { class: 'btn btn-ghost', onclick: () => go('home') }, '戻る')
    );
  }

  /* ---------- オンライン ---------- */
  function viewOnlineMenu() {
    return h('div', { class: 'home' },
      h('h2', null, 'オンラインで対戦'),
      h('div', { class: 'panel' },
        h('button', { class: 'btn btn-primary btn-block', onclick: () => go('createRoom') }, '部屋を作る（ホスト）'),
        h('button', { class: 'btn btn-block', onclick: () => go('joinRoom') }, '部屋に参加する'),
        DOM.db ? null : h('p', { class: 'muted', style: 'font-size:12px' }, '※ いまは Firebase 未設定のため使えません。設定後にご利用ください。')
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
        h('button', { class: 'btn btn-primary btn-block', onclick: () => createRoom(name) }, '部屋を作成')
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
        h('button', { class: 'btn btn-primary btn-block', onclick: () => joinRoom(code, name) }, '参加する')
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
     遊び方 / カード一覧
     ============================================================ */
  function viewRules() {
    const back = UI._rulesReturn || 'home';
    const sec = (title, body) => h('div', { class: 'rules-section' }, h('h3', null, title), body);
    return h('div', { class: 'page' },
      h('div', { class: 'page-top' },
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => go(back) }, '← 戻る'),
        h('h2', null, '遊び方')),
      h('div', { class: 'rules' },
        sec('目的', h('p', null, 'カードを買い集めて「勝利点」をいちばん多く集めた人が勝ちです。同点ならターン数が少ない方の勝ち。')),
        sec('はじめの状態', h('p', null, '各自、銅貨7枚＋屋敷3枚の10枚でスタート。毎ターン、山札から5枚引いて手札にします。')),
        sec('ターンの流れ', h('ol', null,
          h('li', null, h('b', null, '①アクション'), '：手札のアクションカードを使います（最初は1回）。村などで回数が増えます。'),
          h('li', null, h('b', null, '②購入'), '：「財宝を全部出す」でコインにし、その範囲でカードを買います（最初は1枚）。'),
          h('li', null, h('b', null, '③片付け'), '：場と手札を捨て札にし、新たに5枚引いて相手の番へ。'))),
        sec('勝利点（ゲーム終了時に数える）', h('ul', null,
          h('li', null, '屋敷=1点／公領=3点／属州=6点／呪い=−1点'),
          h('li', null, '※ 勝利点・呪いは手札では何もしません。早く集めるとデッキが重くなる点に注意。'))),
        sec('ゲームの終わり', h('p', null, '「属州」の山が尽きるか、任意の3種類の山が尽きたターンの終了時に終了します。')),
        sec('このアプリの操作', h('ul', null,
          h('li', null, 'カードをタップすると拡大表示。アクションは「使う」、財宝は「出す」、サプライは「購入」。'),
          h('li', null, '同じカードは重ねて枚数（×N）で表示。種類ごとにまとまっています。'),
          h('li', null, 'CPUの番は自動で進み、画面下のログに何をしたか表示されます。'))),
        sec('王国カード（このセット）', h('div', { class: 'cardlist-grid' },
          DOM.KINGDOM.map((id) => miniCard(id))))
      )
    );
  }

  function miniCard(id) {
    return cardEl(id, { size: 'sm', onClick: () => showSheet(id, null) });
  }

  function viewCardList() {
    const back = UI._listReturn || 'home';
    const group = (title, ids) => h('div', { class: 'list-group' },
      h('div', { class: 'section-h' }, title),
      h('div', { class: 'cardlist-grid' }, ids.map((id) => miniCard(id))));
    return h('div', { class: 'page' },
      h('div', { class: 'page-top' },
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => go(back) }, '← 戻る'),
        h('h2', null, 'カード一覧')),
      h('p', { class: 'muted', style: 'font-size:12px;padding:0 4px' }, 'タップで拡大（コスト・効果つき）。'),
      group('財宝', DOM.TREASURES),
      group('勝利点・呪い', DOM.VICTORY.concat(['curse'])),
      group('王国カード（アクション）', DOM.KINGDOM)
    );
  }

  /* ============================================================
     ゲーム画面
     ============================================================ */
  function viewGameDispatch() {
    const state = UI.store.state;
    if (!state) return h('div', { class: 'home' }, h('p', { class: 'muted' }, '読み込み中…'));
    if (state.gameOver) return viewGameOver(state);

    const actor = E().actor(state);
    const actorIsCpu = !!state.players[actor].isCpu;
    let viewer, interactive;
    if (UI.mode === 'local') {
      if (!actorIsCpu && actor !== UI.localViewer) return viewPassGate(state, actor);
      viewer = actorIsCpu ? clampHumanViewer(state) : actor;
      interactive = !actorIsCpu && actor === viewer;
    } else {
      viewer = UI.mySeat;
      interactive = actor === viewer && !actorIsCpu;
    }

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

    const top = h('div', { class: 'topbar' },
      h('div', { class: 'turn-tag' },
        h('div', { class: 'who' }, active.name + ' の番' + (active.isCpu ? '（CPU・' + LEVEL_JP[active.cpuLevel] + '）' : '')),
        h('div', { class: 'phase' }, phaseLabel(t.phase))),
      h('div', { class: 'resources' },
        h('div', { class: 'badge act' }, h('div', { class: 'v' }, t.actions), h('div', { class: 'k' }, 'アクション')),
        h('div', { class: 'badge buy' }, h('div', { class: 'v' }, t.buys), h('div', { class: 'k' }, '購入')),
        h('div', { class: 'badge coin' }, h('div', { class: 'v' }, t.coins), h('div', { class: 'k' }, 'コイン')))
    );

    // 他プレイヤー（複数対応）
    const others = state.players.map((p, i) => i).filter((i) => i !== viewer);
    const othersStrip = h('div', { class: 'others' },
      others.map((i) => {
        const p = state.players[i];
        const isAct = i === t.active;
        return h('div', { class: 'opp-chip' + (isAct ? ' on' : '') },
          h('div', { class: 'opp-name' }, (isAct ? '▶ ' : '') + p.name + (p.isCpu ? ' 🤖' : '')),
          h('div', { class: 'opp-mini' }, '山' + p.deck.length + ' 手' + p.hand.length + ' 捨' + p.discard.length));
      }));

    // CPU進行中バナー
    const banner = state.players[actor].isCpu
      ? h('div', { class: 'cpu-banner' }, '🤖 ' + state.players[actor].name + ' が考えています…')
      : null;

    // サプライ（種類ごと）
    const buyableId = (id) => interactive && t.phase === 'buy' && !state.pending &&
      (state.supply[id] || 0) > 0 && t.buys > 0 && DOM.CARDS[id].cost <= t.coins;
    const supSection = (title, ids, size) =>
      h('div', { class: 'supply-section' },
        h('div', { class: 'sup-title' }, title),
        h('div', { class: 'supply-grid ' + size },
          ids.map((id) => pileEl(id, state, { size: size === 'small' ? 'sm' : 'lg', buyable: buyableId(id), onClick: () => onPileTap(state, id, interactive) }))));

    const supply = h('div', null,
      supSection('財宝', DOM.TREASURES, 'small'),
      supSection('勝利点', DOM.VICTORY.concat(['curse']), 'small'),
      supSection('王国カード（アクション）', state.kingdom, 'big'));

    // 場（プレイ済み）
    const playArea = active.inPlay.length
      ? h('div', { class: 'play-area' }, active.inPlay.map((id) => h('div', { class: 'chip-card ' + typeClass(id) }, DOM.CARDS[id].name)))
      : h('div', { class: 'play-area' }, h('div', { class: 'empty-note' }, 'まだ場にカードはありません'));

    // 手札（種類でグループ化・重ね表示）
    const hg = handGroups(me.hand, state.kingdom);
    const handTile = (id) => cardEl(id, {
      size: hg.counts[id] && DOM.isType(id, 'action') ? 'lg' : 'sm',
      count: hg.counts[id],
      dim: !handCardPlayable(state, id, interactive),
      onClick: () => onHandTap(state, id, interactive),
    });
    const handBlocks = [];
    if (hg.actions.length) handBlocks.push(h('div', { class: 'hand-group' },
      h('div', { class: 'hg-label' }, 'アクション'),
      h('div', { class: 'hand-cards big' }, hg.actions.map((id) => cardEl(id, { size: 'lg', count: hg.counts[id], dim: !handCardPlayable(state, id, interactive), onClick: () => onHandTap(state, id, interactive) })))));
    const compact = hg.coins.concat(hg.vp);
    if (compact.length) handBlocks.push(h('div', { class: 'hand-group' },
      h('div', { class: 'hg-label' }, '財宝・勝利点'),
      h('div', { class: 'hand-cards small' }, compact.map((id) => cardEl(id, { size: 'sm', count: hg.counts[id], dim: !handCardPlayable(state, id, interactive), onClick: () => onHandTap(state, id, interactive) })))));
    if (!me.hand.length) handBlocks.push(h('div', { class: 'empty-note' }, '手札がありません'));

    const logLines = state.log.slice(-6);
    const logBox = h('div', { class: 'log' }, logLines.map((l, i) => h('div', { class: i === logLines.length - 1 ? 'latest' : '' }, l)));

    return h('div', { class: 'board' },
      top,
      othersStrip,
      UI.mode === 'online' ? h('div', { class: 'muted', style: 'font-size:11px;text-align:center;margin:-2px 0 4px' }, '部屋 ' + UI.roomCode + '　/　あなた: ' + me.name) : null,
      banner,
      h('div', { class: 'section-h' }, 'サプライ（場の山札）'),
      supply,
      h('div', { class: 'zone-h' }, h('span', { class: 't' }, '場')),
      playArea,
      h('div', { class: 'zone-h' }, h('span', { class: 't' }, me.name + ' の手札'), h('span', { class: 'c' }, me.hand.length + ' 枚')),
      h('div', { class: 'hand-zone' }, handBlocks),
      logBox,
      viewActionBar(state, viewer, actor, interactive)
    );
  }

  function handGroups(hand, kingdom) {
    const order = DOM.SUPPLY_ORDER(kingdom);
    const counts = {};
    hand.forEach((c) => (counts[c] = (counts[c] || 0) + 1));
    const present = order.filter((id) => counts[id]);
    return {
      counts,
      actions: present.filter((id) => DOM.isType(id, 'action')),
      coins: present.filter((id) => DOM.isType(id, 'treasure')),
      vp: present.filter((id) => DOM.isType(id, 'victory') || DOM.isType(id, 'curse')),
    };
  }

  function handCardPlayable(state, id, interactive) {
    if (!interactive || state.pending) return false;
    const t = state.turn;
    if (t.phase === 'action') return DOM.CARDS[id].types.includes('action') && t.actions > 0;
    if (t.phase === 'buy') return DOM.CARDS[id].types.includes('treasure');
    return false;
  }

  function onHandTap(state, id, interactive) {
    const c = DOM.CARDS[id];
    const t = state.turn;
    if (interactive && !state.pending && t.phase === 'action' && c.types.includes('action') && t.actions > 0) {
      showSheet(id, { label: '使う', cls: 'btn-primary', on: () => dispatch({ type: 'PLAY_ACTION', card: id }) });
    } else if (interactive && !state.pending && t.phase === 'buy' && c.types.includes('treasure')) {
      showSheet(id, { label: '財宝を出す', cls: 'btn-primary', on: () => dispatch({ type: 'PLAY_TREASURE', card: id }) });
    } else {
      showSheet(id, null);
    }
  }
  function onPileTap(state, id, interactive) {
    const t = state.turn;
    const cost = DOM.CARDS[id].cost;
    const canBuy = interactive && !state.pending && t.phase === 'buy' && (state.supply[id] || 0) > 0 && t.buys > 0 && cost <= t.coins;
    if (canBuy) showSheet(id, { label: '購入する（' + cost + 'コイン）', cls: 'btn-primary', on: () => dispatch({ type: 'BUY', card: id }) });
    else showSheet(id, null);
  }

  function viewActionBar(state, viewer, actor, interactive) {
    const t = state.turn;
    if (state.pending) {
      const who = state.players[state.pending.player].name;
      if (interactive && state.pending.player === viewer)
        return h('div', { class: 'actions-bar' }, h('div', { class: 'btn btn-ghost btn-block', style: 'pointer-events:none' }, '↑ 選択してください'));
      return h('div', { class: 'actions-bar' }, h('div', { class: 'btn btn-ghost btn-block', style: 'pointer-events:none' }, who + ' の対応を待っています…'));
    }
    if (!interactive) {
      const who = state.players[actor].name;
      return h('div', { class: 'actions-bar' }, h('div', { class: 'btn btn-ghost btn-block', style: 'pointer-events:none' }, who + ' の番です…'));
    }
    if (t.phase === 'action') {
      return h('div', { class: 'actions-bar' },
        h('button', { class: 'btn btn-primary btn-block', onclick: () => dispatch({ type: 'END_ACTION_PHASE' }) }, '購入フェーズへ ▶'));
    }
    const hasTreasure = state.players[viewer].hand.some((c) => DOM.CARDS[c].types.includes('treasure'));
    return h('div', { class: 'actions-bar' },
      h('button', { class: 'btn btn-block', disabled: hasTreasure ? null : 'disabled', onclick: () => dispatch({ type: 'PLAY_ALL_TREASURES' }) }, '財宝を全部出す'),
      h('button', { class: 'btn btn-primary btn-block', onclick: () => dispatch({ type: 'END_TURN' }) }, 'ターンを終える'));
  }

  /* ---------- パスゲート ---------- */
  function viewPassGate(state, actor) {
    const name = state.players[actor].name;
    return h('div', { class: 'gate' },
      h('div', { class: 'crest' }, '🤝'),
      h('h2', null, name + ' さんの番です'),
      h('p', null, '端末を ' + name + ' さんに渡してください'),
      h('button', { class: 'btn btn-primary', onclick: () => { UI.localViewer = actor; render(); } }, 'タップして手札を見る'));
  }

  /* ---------- 選択モーダル ---------- */
  function viewPendingModal(state, pd) {
    const key = pd.type + (pd.stage || '');
    if (UI._selKey !== key) { UI.selection = []; UI._selKey = key; }
    const p = state.players[pd.player];

    if (pd.type === 'cellar') return modalMultiHand(p, '地下貯蔵庫', '捨てるカードを選び、同じ枚数を引きます。（0枚でもOK）',
      (n) => '確定（' + n + '枚 捨てる）', true, (cards) => dispatch({ type: 'CELLAR_RESOLVE', cards }));
    if (pd.type === 'militia') return modalMilitia(p, p.hand.length - 3, p.hand.includes('moat'));
    if (pd.type === 'mine' && pd.stage === 'trash') return modalSingleHand(p, '鉱山 — 廃棄', '廃棄する財宝を選びます（しなくてもよい）。',
      (id) => DOM.CARDS[id].types.includes('treasure'),
      (id) => dispatch({ type: 'MINE_TRASH', card: id }), { label: '廃棄しない', on: () => dispatch({ type: 'MINE_TRASH', card: null }) });
    if (pd.type === 'mine' && pd.stage === 'gain') return modalGainSupply(state, '鉱山 — 獲得', 'コスト ' + pd.maxCost + ' 以下の財宝を手札に獲得します。',
      (id) => DOM.CARDS[id].types.includes('treasure') && DOM.CARDS[id].cost <= pd.maxCost,
      (id) => dispatch({ type: 'MINE_GAIN', card: id }), () => dispatch({ type: 'MINE_GAIN', card: null }));
    if (pd.type === 'remodel' && pd.stage === 'trash') return modalSingleHand(p, '改築 — 廃棄', '廃棄するカードを選びます。',
      () => true, (id) => dispatch({ type: 'REMODEL_TRASH', card: id }), null);
    if (pd.type === 'remodel' && pd.stage === 'gain') return modalGainSupply(state, '改築 — 獲得', 'コスト ' + pd.maxCost + ' 以下のカードを獲得します。',
      (id) => DOM.CARDS[id].cost <= pd.maxCost, (id) => dispatch({ type: 'REMODEL_GAIN', card: id }), () => dispatch({ type: 'REMODEL_GAIN', card: null }));
    if (pd.type === 'workshop') return modalGainSupply(state, '工房 — 獲得', 'コスト 4 以下のカードを獲得します。',
      (id) => DOM.CARDS[id].cost <= 4, (id) => dispatch({ type: 'WORKSHOP_GAIN', card: id }), () => dispatch({ type: 'WORKSHOP_GAIN', card: null }));
    return h('div');
  }

  function handChip(id, idx, on, onClick) {
    const c = DOM.CARDS[id];
    return h('div', { class: 'chip ' + typeClass(id) + (on ? ' on' : ''), onclick: onClick }, h('span', { class: 'cc' }, c.cost), c.name);
  }
  function modalMultiHand(p, title, desc, confirmLabel, allowZero, onConfirm) {
    const chips = p.hand.map((id, idx) =>
      handChip(id, idx, UI.selection.includes(idx), () => {
        const i = UI.selection.indexOf(idx);
        if (i >= 0) UI.selection.splice(i, 1); else UI.selection.push(idx);
        render();
      }));
    const n = UI.selection.length;
    return modalShell(title, desc, chips,
      h('button', { class: 'btn btn-primary btn-block', disabled: (!allowZero && n === 0) ? 'disabled' : null,
        onclick: () => onConfirm(UI.selection.map((i) => p.hand[i])) }, confirmLabel(n)));
  }
  function modalMilitia(p, need, hasMoat) {
    const chips = p.hand.map((id, idx) =>
      handChip(id, idx, UI.selection.includes(idx), () => {
        const i = UI.selection.indexOf(idx);
        if (i >= 0) UI.selection.splice(i, 1); else if (UI.selection.length < need) UI.selection.push(idx);
        render();
      }));
    const remain = need - UI.selection.length;
    const buttons = h('div', null,
      hasMoat ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'MOAT_REVEAL' }) }, '🛡 堀を公開して無効化') : null,
      h('button', { class: 'btn btn-primary btn-block', disabled: remain === 0 ? null : 'disabled',
        onclick: () => dispatch({ type: 'MILITIA_RESOLVE', cards: UI.selection.map((i) => p.hand[i]) }) },
        remain === 0 ? '確定（捨てる）' : 'あと ' + remain + ' 枚 選ぶ'));
    return modalShell('民兵を受ける', '手札が3枚になるまで捨てます。' + (hasMoat ? '「堀」で無効化もできます。' : ''), chips, buttons);
  }
  function modalSingleHand(p, title, desc, filter, onPick, skip) {
    const elig = p.hand.map((id, idx) => ({ id, idx })).filter((x) => filter(x.id));
    const chips = elig.length ? elig.map((x) => handChip(x.id, x.idx, false, () => onPick(x.id))) : [h('p', { class: 'muted' }, '対象のカードがありません')];
    const btn = skip ? h('button', { class: 'btn btn-block', onclick: skip.on }, skip.label) : null;
    return modalShell(title, desc, chips, btn);
  }
  function modalGainSupply(state, title, desc, filter, onPick, skipOnEmpty) {
    const order = DOM.SUPPLY_ORDER(state.kingdom);
    const elig = order.filter((id) => filter(id) && (state.supply[id] || 0) > 0);
    const chips = elig.length
      ? elig.map((id) => h('div', { class: 'chip ' + typeClass(id), onclick: () => onPick(id) },
          h('span', { class: 'cc' }, DOM.CARDS[id].cost), DOM.CARDS[id].name, h('span', { class: 'muted', style: 'font-size:11px' }, '残' + state.supply[id])))
      : [h('p', { class: 'muted' }, '獲得できるカードがありません')];
    const footer = (!elig.length && skipOnEmpty) ? h('button', { class: 'btn btn-block', onclick: skipOnEmpty }, '獲得せずに進む') : null;
    return modalShell(title, desc, chips, footer);
  }
  function modalShell(title, desc, chips, footer) {
    return h('div', { class: 'modal-scrim', onclick: (e) => { if (e.target.classList.contains('modal-scrim')) { /* 選択は閉じない */ } } },
      h('div', { class: 'modal' },
        h('h3', null, title),
        h('p', { class: 'desc' }, desc),
        h('div', { class: 'chip-grid' }, chips),
        footer || null));
  }

  /* ---------- 拡大表示（タップで拡大） ---------- */
  function viewSheet() {
    const id = UI.sheet.cardId;
    const c = DOM.CARDS[id];
    const p = UI.sheet.primary;
    const state = UI.store && UI.store.state;
    const remain = state && state.supply && state.supply[id] != null ? state.supply[id] : null;
    return h('div', { class: 'scrim', onclick: (e) => { if (e.target.classList.contains('scrim')) closeSheet(); } },
      h('div', { class: 'sheet' },
        h('div', { class: 'grip' }),
        h('div', { class: 'zoom-wrap ' + typeClass(id) },
          h('img', { class: 'zoom-img', src: 'assets/' + id + '.jpg', alt: c.name, onerror: function () { this.style.display = 'none'; if (this.parentElement) this.parentElement.classList.add('noimg'); } }),
          h('div', { class: 'zoom-fallback' }, c.name)),
        h('div', { class: 'zoom-info' },
          h('div', { class: 'zoom-head' },
            h('span', { class: 'zoom-cost' }, c.cost),
            h('div', null, h('h3', { class: 'zoom-name' }, c.name), h('div', { class: 'zoom-type' }, typeLabel(id)))),
          h('div', { class: 'zoom-text' }, c.text || ''),
          remain != null ? h('div', { class: 'zoom-remain' }, 'サプライ残り ' + remain + ' 枚') : null),
        p ? h('button', { class: 'btn ' + (p.cls || '') + ' btn-block', onclick: p.on }, p.label) : null,
        h('button', { class: 'btn btn-ghost btn-block', style: 'margin-top:8px', onclick: closeSheet }, 'とじる')));
  }

  /* ---------- 勝敗画面 ---------- */
  function viewGameOver(state) {
    const r = state.result;
    const winNames = r.winners.map((i) => state.players[i].name).join('・');
    const tie = r.winners.length > 1;
    const order = state.players.map((p, i) => ({ p, i, s: r.scores[i] })).sort((a, b) => b.s.vp - a.s.vp || a.s.turns - b.s.turns);
    return h('div', { class: 'result' },
      h('div', { class: 'trophy' }, tie ? '🤝' : '🏆'),
      h('h1', null, tie ? '引き分け' : winNames + ' の勝ち！'),
      h('p', { class: 'muted' }, r.reason + 'ため終了'),
      h('div', { class: 'score-table' },
        order.map((row) =>
          h('div', { class: 'score-row ' + (r.winners.includes(row.i) ? 'win' : '') },
            h('div', null,
              h('div', { class: 'nm' }, row.p.name + (row.p.isCpu ? '（CPU・' + LEVEL_JP[row.p.cpuLevel] + '）' : '')),
              h('div', { class: 'tn' }, row.s.turns + ' ターン')),
            h('div', { class: 'vp' }, row.s.vp + ' 点')))),
      h('div', { class: 'row center' },
        UI.mode === 'local' ? h('button', { class: 'btn btn-primary', onclick: () => restartLocal() }, 'もう一度（同設定）') : null,
        h('button', { class: 'btn btn-ghost', onclick: () => leaveOnline() }, 'ホームへ')));
  }

  /* ============================================================
     ゲーム開始・部屋管理・CPU駆動
     ============================================================ */
  function startConfigured(configs) {
    configs = configs || UI.setup.seats.map((s) => ({ name: s.name, isCpu: s.type === 'cpu', level: s.level }));
    // 名前の空欄を補完
    configs = configs.map((c, i) => ({ name: (c.name && c.name.trim()) || ('プレイヤー' + (i + 1)), isCpu: !!c.isCpu, level: c.level || 'normal' }));
    UI.lastConfigs = configs;
    const st = E().createInitialState(configs);
    UI.mode = 'local'; UI.mySeat = null; UI.localViewer = firstHuman(st);
    UI.store = DOM.LocalStore(st);
    UI.store.subscribe(onStoreChange);
    UI.view = 'game';
    render();
  }
  function restartLocal() {
    const st = E().createInitialState(UI.lastConfigs);
    UI.localViewer = firstHuman(st);
    UI.store.dispatch({ type: 'NEW_GAME', players: UI.lastConfigs, kingdom: st.kingdom });
  }

  function createRoom(name) {
    if (!DOM.db) { toast('Firebase が未設定です'); return; }
    const code = DOM.makeRoomCode();
    const st = E().createInitialState([name || 'ホスト', '対戦相手']);
    st.seats = [name || 'ホスト', null]; st.online = true; st.version = 1;
    DOM.db.ref('rooms/' + code + '/state').set(st).then(() => {
      UI.mode = 'online'; UI.mySeat = 0; UI.roomCode = code;
      UI.store = DOM.OnlineStore(DOM.db, code, 0);
      UI.store.subscribe(onStoreChange);
      UI.view = 'waitGuest'; render();
    }).catch((e) => toast('作成に失敗: ' + e.message));
  }
  function joinRoom(code, name) {
    if (!DOM.db) { toast('Firebase が未設定です'); return; }
    code = (code || '').toUpperCase().trim();
    if (code.length !== 4) { toast('コードは4文字です'); return; }
    const myName = name || '対戦相手';
    const ref = DOM.db.ref('rooms/' + code + '/state');
    ref.transaction((st) => {
      if (st === null) return null;
      if (st.seats && st.seats[1]) return;
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
      if (!committed || !st.seats || st.seats[1] !== myName) { toast('この部屋は満員です'); return; }
      UI.mode = 'online'; UI.mySeat = 1; UI.roomCode = code;
      UI.store = DOM.OnlineStore(DOM.db, code, 1);
      UI.store.subscribe(onStoreChange);
      UI.view = 'game'; render();
    });
  }
  function leaveOnline() {
    if (UI.store && UI.store.detach) UI.store.detach();
    if (UI._cpuTimer) { clearTimeout(UI._cpuTimer); UI._cpuTimer = null; }
    UI.store = null; UI.mode = 'local'; UI.mySeat = null; UI.roomCode = null;
    go('home');
  }

  // CPUの自動進行（局面が変わるたびに呼ぶ）
  function maybeRunCpu() {
    const s = UI.store && UI.store.state;
    if (UI.mode !== 'local' || !s || s.gameOver || UI.view !== 'game') return;
    const seat = E().actor(s);
    const pl = s.players[seat];
    if (!pl || !pl.isCpu) return;
    if (UI._cpuTimer) return;
    const action = DOM.cpu.decide(s);
    UI._cpuTimer = setTimeout(() => {
      UI._cpuTimer = null;
      const cur = UI.store && UI.store.state;
      if (UI.mode !== 'local' || !cur || cur.gameOver) return;
      const se = E().actor(cur);
      if (!cur.players[se] || !cur.players[se].isCpu) return;
      UI.store.dispatch(DOM.cpu.decide(cur));
    }, DOM.cpu.delayFor(action));
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
      case 'setup': root = viewSetup(); break;
      case 'localSetup': root = viewLocalSetup(); break;
      case 'onlineMenu': root = viewOnlineMenu(); break;
      case 'createRoom': root = viewCreateRoom(); break;
      case 'joinRoom': root = viewJoinRoom(); break;
      case 'waitGuest': root = viewWaitGuest(); break;
      case 'rules': root = viewRules(); break;
      case 'cardList': root = viewCardList(); break;
      case 'game': root = viewGameDispatch(); break;
      default: root = viewHome();
    }
    app.appendChild(root);
    if (UI.sheet) app.appendChild(viewSheet());
    if (UI.toast) app.appendChild(h('div', { class: 'toast' }, UI.toast));
    maybeRunCpu();
  }
  DOM.render = render;

  /* ---------- 起動 ---------- */
  function boot() {
    const params = new URLSearchParams(location.search);
    const room = params.get('room');
    if (room) { UI.prefillCode = room.toUpperCase().slice(0, 4); UI.view = DOM.db ? 'joinRoom' : 'onlineMenu'; }
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
