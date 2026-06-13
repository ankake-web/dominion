/* ============================================================
   ドミニオン — UI（画面描画とタップ操作）
   ============================================================ */
(function () {
  const DOM = (window.DOM = window.DOM || {});
  const E = () => DOM.engine;
  const LEVEL_JP = { easy: '弱', normal: '普通', hard: '強' };

  /* ---------- ランダムな初期名（普通の短い名前） ---------- */
  // 「あなた／対戦相手」だと盛り下がるので入力欄の初期値をランダムに。称号はつけない。
  const NAME_POOL = [
    'アン', 'ケン', 'ユイ', 'レオ', 'ミオ', 'ソラ', 'ハル', 'リク', 'エマ', 'ルカ',
    'ナオ', 'アヤ', 'カイ', 'メイ', 'ユウ', 'リオ', 'サラ', 'ニコ', 'ルナ', 'テオ',
    'マヤ', 'セナ', 'ジン', 'ノア', 'リン', 'コウ', 'モモ', 'ショウ', 'アオ', 'ヒロ',
  ];
  // CPUも普通の名前（盤面では🤖が付くので区別できる）。
  const CPU_NAME_POOL = NAME_POOL;
  function randPick(pool, exclude) {
    const avail = pool.filter((n) => !(exclude || []).includes(n));
    const list = avail.length ? avail : pool;
    return list[Math.floor(Math.random() * list.length)];
  }
  // キーごとに一度だけランダム名を決めて記憶（再描画でブレない）。excludeKeyの名前は避ける。
  function defaultName(key, pool, excludeKey) {
    UI._names = UI._names || {};
    if (!UI._names[key]) {
      const ex = excludeKey && UI._names[excludeKey] ? [UI._names[excludeKey]] : [];
      UI._names[key] = randPick(pool || NAME_POOL, ex);
    }
    return UI._names[key];
  }

  /* ---------- UI 状態 ---------- */
  const _humanName = randPick(NAME_POOL);
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
    // オンライン(WebSocket)用
    netClient: null,
    isHost: false,
    lobby: null,
    netToken: null,
    reconnecting: false,
    _reconnectTries: 0,
    setup: {
      randomOrder: false,
      kingdomSet: 'basic', // 'basic' | 'intrigue' | 'random'
      seats: [
        { name: _humanName, type: 'human', level: 'normal' },
        { name: CPU_NAME_POOL[Math.floor(Math.random() * CPU_NAME_POOL.length)], type: 'cpu', level: 'normal' },
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
  // 財宝は枚数で色分け（場のチップで金貨/銀貨/銅貨を見分けやすく）
  function coinClass(id) { return (id === 'copper' || id === 'silver' || id === 'gold') ? ' c-' + id : ''; }
  // 実コスト（「橋」等のこのターンのコスト軽減を反映）。表示・購入判定で共通利用。
  function effCost(state, id) { return (state && E() && E().cardCost) ? E().cardCost(state, id) : DOM.CARDS[id].cost; }
  // 直近の「誰が何をした」行（手番案内・ゲーム進行行は除く）。全員に見せる用。
  function lastMove(log) {
    if (!Array.isArray(log)) return null;
    for (let i = log.length - 1; i >= 0; i--) {
      const l = log[i];
      if (!l || /の番です|ゲーム開始|ゲーム終了|を引いた/.test(l)) continue;
      return l;
    }
    return null;
  }
  function cardArt(id) {
    // 盤面（手札・サプライ）は軽量サムネを使う。拡大表示だけフル画像。
    // eager + async decode で「スマホでカードが表示されない」を防ぐ（サムネは軽いので一括読込でOK）。
    return h('img', {
      class: 'card-art', src: 'asset/thumb/' + id + '.jpg', alt: DOM.CARDS[id].name, decoding: 'async',
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
      opts.count && opts.count > 1 ? h('div', { class: 'count-badge' }, '×' + opts.count) : null,
      opts.badge != null ? h('div', { class: 'count-badge order-badge' }, opts.badge) : null
    );
  }
  // サプライの山。opts: {onClick, buyable, gainable, size}
  function pileEl(id, state, opts) {
    opts = opts || {};
    const c = DOM.CARDS[id];
    const n = state.supply[id] || 0;
    const ec = effCost(state, id);
    const cls = 'pile has-art ' + (opts.size === 'sm' ? 'sm ' : '') + typeClass(id) +
      (n <= 0 ? ' empty' : '') + (opts.buyable ? ' buyable' : '') + (opts.gainable ? ' gainable' : '') +
      (ec < c.cost ? ' discounted' : '');
    return h('div', { class: cls, onclick: opts.onClick, 'data-pile': id },
      h('div', { class: 'pcost' }, ec),
      h('div', { class: 'pname' }, c.name),
      cardArt(id),
      h('div', { class: 'pile-count' + (n <= 2 ? ' lo' : n <= 5 ? ' mid' : '') }, '残' + n)
    );
  }

  /* ---------- 共通操作 ---------- */
  function go(view) { UI.view = view; UI.sheet = null; UI.logModal = false; render(); }
  function dispatch(action) { UI.sheet = null; UI.store.dispatch(action); }
  function closeSheet() { UI.sheet = null; render(); }
  function showSheet(cardId, primary) { UI.sheet = { cardId, primary }; sfx('tap'); render(); }
  function sfx(n) { if (DOM.audio) DOM.audio.sfx(n); }
  function toggleBgm() { if (DOM.audio) { DOM.audio.toggleBgm(); render(); } }
  function toggleSe() { if (DOM.audio) { DOM.audio.toggleSe(); render(); } }
  function cycleTrack() { if (DOM.audio) { DOM.audio.setTrack(DOM.audio.track() + 1); render(); } }
  // サウンド設定バー（ホーム用）
  function audioBar() {
    if (!DOM.audio) return null;
    const bgm = DOM.audio.isBgm(), se = DOM.audio.isSe();
    const trackName = DOM.audio.tracks()[DOM.audio.track()] || '';
    return h('div', { class: 'audio-bar' },
      h('button', { class: 'btn btn-sm' + (bgm ? ' on' : ''), onclick: toggleBgm }, (bgm ? '🎵' : '🔇') + ' BGM'),
      bgm ? h('button', { class: 'btn btn-sm', onclick: cycleTrack }, '♪ ' + trackName) : null,
      h('button', { class: 'btn btn-sm' + (se ? ' on' : ''), onclick: toggleSe }, (se ? '🔊' : '🔇') + ' 効果音'));
  }
  function toast(msg) {
    UI.toast = msg; render();
    clearTimeout(UI._t);
    UI._t = setTimeout(() => { UI.toast = null; render(); }, 2400);
  }
  function onStoreChange() { render(); }
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
      h('div', { class: 'flourish' }, h('span', null, '❖')),
      h('div', { class: 'menu' },
        h('button', { class: 'btn btn-primary btn-block', onclick: () => go('setup') }, 'CPUと対戦'),
        h('button', { class: 'btn btn-block', onclick: () => go('onlineMenu') }, 'オンラインで対戦'),
        h('div', { class: 'menu-split' },
          h('button', { class: 'btn btn-ghost', onclick: () => go('rules') }, '📖 遊び方'),
          h('button', { class: 'btn btn-ghost', onclick: () => { UI._listReturn = 'home'; go('cardList'); } }, '🃏 カード一覧')
        ),
        audioBar()
      )
    );
  }

  /* ---------- セグメント切替UI ---------- */
  function segmented(options, current, onPick, extraCls) {
    return h('div', { class: 'seg ' + (extraCls || '') },
      options.map((o) =>
        h('button', { class: 'seg-btn' + (o.value === current ? ' on' : ''), onclick: () => onPick(o.value) }, o.label)));
  }

  // 王国カードのセット選択。基本/陰謀/ランダムを選び、ランダム時は抽選元（基本＋陰謀／陰謀のみ／基本のみ）も出す。
  // current は CARD_SETS の id。onChange(newId) で確定（ローカルは setup に保存、オンラインはサーバへ送信）。
  function kingdomSetPicker(current, onChange) {
    current = current || 'basic';
    const isRandom = current.indexOf('random') === 0;
    const modeRow = segmented(
      [{ value: 'basic', label: '基本' }, { value: 'intrigue', label: '陰謀(拡張)' }, { value: 'random', label: 'ランダム' }],
      isRandom ? 'random' : current,
      (v) => onChange(v)); // 'ランダム' を選ぶと既定の「基本＋陰謀ランダム」へ
    if (!isRandom) return modeRow;
    const scopeRow = segmented(
      [{ value: 'random', label: '基本＋陰謀' }, { value: 'random-intrigue', label: '陰謀のみ' }, { value: 'random-basic', label: '基本のみ' }],
      current, (v) => onChange(v));
    return h('div', null,
      modeRow,
      h('div', { style: 'margin-top:8px' },
        h('div', { style: 'font-size:12px;color:var(--ink-dim);margin-bottom:4px' }, '抽選元'),
        scopeRow),
      h('p', { class: 'muted', style: 'font-size:12px;margin:6px 0 0' }, '毎回ランダムに10種を選びます。'));
  }

  /* ---------- 対戦設定（2〜4人・人間/CPU・強さ） ---------- */
  function viewSetup() {
    const seats = UI.setup.seats;
    const countSeg = segmented(
      [{ value: 2, label: '2人' }, { value: 3, label: '3人' }, { value: 4, label: '4人' }],
      seats.length,
      (n) => {
        while (seats.length < n) seats.push({ name: randPick(CPU_NAME_POOL, seats.map((s) => s.name)), type: 'cpu', level: 'normal' });
        while (seats.length > n) seats.pop();
        render();
      }, 'count-seg');

    const rows = seats.map((st, i) => {
      // 席1=あなた(人間)固定、他の席はCPU。人間/CPUの選択は廃止（人対人はオンラインで）。
      st.type = (i === 0) ? 'human' : 'cpu';
      return h('div', { class: 'seat-row' },
        h('div', { class: 'seat-head' },
          h('span', { class: 'seat-no' }, (i + 1)),
          h('input', { type: 'text', value: st.name, oninput: (e) => { st.name = e.target.value; } }),
          h('span', { class: 'seat-tag' }, i === 0 ? 'あなた' : 'CPU')
        ),
        i === 0 ? null : h('div', { class: 'seat-opts' },
          segmented([{ value: 'easy', label: '弱' }, { value: 'normal', label: '普通' }, { value: 'hard', label: '強' }], st.level, (v) => { st.level = v; render(); })
        )
      );
    });

    return h('div', { class: 'home setup' },
      h('h2', null, 'CPUと対戦'),
      h('p', { class: 'muted', style: 'font-size:13px' }, '人数とCPUの強さを選びます。席1はあなた、ほかはCPUです。'),
      h('div', { class: 'panel' },
        h('div', { class: 'field' }, h('label', null, '人数'), countSeg),
        h('div', { class: 'seat-list' }, rows),
        h('div', { class: 'field' }, h('label', null, '使う王国カード'),
          kingdomSetPicker(UI.setup.kingdomSet, (v) => { UI.setup.kingdomSet = v; render(); })),
        h('div', { class: 'field' }, h('label', null, '手番の順番'),
          segmented([{ value: false, label: '上から順' }, { value: true, label: 'ランダム' }], UI.setup.randomOrder, (v) => { UI.setup.randomOrder = v; render(); })),
        h('button', { class: 'btn btn-primary btn-block', onclick: () => startConfigured(null, { shuffle: UI.setup.randomOrder }) }, 'この設定で開始')
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
        h('p', { class: 'muted', style: 'font-size:12px' }, '2〜4人。空席はCPUで埋められます。')
      ),
      h('button', { class: 'btn btn-ghost', onclick: () => go('home') }, '戻る')
    );
  }
  function viewCreateRoom() {
    let name = defaultName('host');
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
    let name = defaultName('guest');
    let code = UI.prefillCode || '';
    const ci = h('input', { type: 'text', class: 'code-input', maxlength: '4', inputmode: 'numeric', pattern: '[0-9]*', value: code,
      oninput: (e) => { code = e.target.value.replace(/\D/g, '').slice(0, 4); e.target.value = code; } });
    const ni = h('input', { type: 'text', value: name, oninput: (e) => (name = e.target.value) });
    return h('div', { class: 'home' },
      h('h2', null, '部屋に参加'),
      h('div', { class: 'panel' },
        h('div', { class: 'field' }, h('label', null, '部屋コード（数字4桁）'), ci),
        h('div', { class: 'field' }, h('label', null, 'あなたの名前'), ni),
        h('button', { class: 'btn btn-primary btn-block', onclick: () => joinRoom(code, name) }, '参加する')
      ),
      h('button', { class: 'btn btn-ghost', onclick: () => go('onlineMenu') }, '戻る')
    );
  }
  function viewLobby() {
    const lb = UI.lobby;
    const link = location.origin + location.pathname + '?room=' + UI.roomCode;
    const players = lb ? lb.players : [];
    const list = h('div', { class: 'lobby-list' },
      players.map((p) =>
        h('div', { class: 'lobby-row' + (p.seat === UI.mySeat ? ' me' : '') },
          h('span', { class: 'seat-no' }, p.seat + 1),
          h('span', { class: 'lobby-name' }, p.name + (p.seat === UI.mySeat ? '（あなた）' : '')),
          h('span', { class: 'lobby-tag' },
            p.isCpu ? 'CPU・' + LEVEL_JP[p.level || 'normal'] : (p.isHost ? 'ホスト' : '') + (p.connected ? '' : ' 🔌')))));

    const hostControls = (lb && UI.isHost) ? h('div', { class: 'lobby-host' },
      h('div', { class: 'field' },
        h('label', null, 'CPUの人数（空席を埋める）'),
        h('div', { class: 'row center' },
          h('button', { class: 'btn btn-sm', onclick: () => setCpuCount(lb.cpuCount - 1) }, '−'),
          h('div', { class: 'cpu-count' }, lb.cpuCount),
          h('button', { class: 'btn btn-sm', onclick: () => setCpuCount(lb.cpuCount + 1) }, '＋'),
          h('span', { class: 'muted', style: 'font-size:11px' }, '（最大' + lb.maxCpu + '）'))),
      h('div', { class: 'field' },
        h('label', null, 'CPUの強さ'),
        segmented([{ value: 'easy', label: '弱' }, { value: 'normal', label: '普通' }, { value: 'hard', label: '強' }],
          lb.cpuLevel, (v) => UI.netClient.send({ t: 'setConfig', cpuLevel: v }))),
      h('div', { class: 'field' },
        h('label', null, '使う王国カード'),
        kingdomSetPicker(lb.kingdomSet || 'basic', (v) => UI.netClient.send({ t: 'setConfig', kingdomSet: v }))),
      h('button', { class: 'btn btn-primary btn-block', disabled: lb.canStart ? null : 'disabled', onclick: () => UI.netClient.send({ t: 'start' }) },
        lb.canStart ? 'ゲーム開始' : '人間1人以上・合計2〜4人で開始')
    ) : h('p', { class: 'muted', style: 'text-align:center' }, 'ホストの開始を待っています…');

    return h('div', { class: 'home lobby' },
      h('h2', null, '待機ロビー'),
      h('p', { class: 'muted', style: 'font-size:13px' }, 'コードまたは参加リンクを相手に送ってください'),
      h('div', { class: 'code-display' }, UI.roomCode || '----'),
      h('button', { class: 'btn btn-block', onclick: () => copy(link) }, '参加用リンクをコピー'),
      h('div', { class: 'panel', style: 'gap:14px' }, list, hostControls),
      h('button', { class: 'btn btn-ghost', onclick: () => leaveOnline() }, '退出')
    );
  }
  function setCpuCount(n) {
    if (!UI.lobby) return;
    const v = Math.max(0, Math.min(n, UI.lobby.maxCpu));
    UI.netClient.send({ t: 'setCpu', count: v });
  }
  function copy(text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('コピーしました'), () => toast(text));
    else toast(text);
  }

  function viewConnecting() {
    const cn = UI.connecting || {};
    return h('div', { class: 'home' },
      h('div', { class: 'crest' }, '🛡️'),
      h('h2', null, 'サーバーに接続中です'),
      h('div', { class: 'spinner' }),
      h('p', { class: 'muted', style: 'max-width:320px;font-size:13px;line-height:1.7' },
        '無料サーバーは初回アクセス時に起動します。混雑時や初回は30〜60秒ほどかかることがあります。そのままお待ちください…'),
      cn.tries > 0 ? h('p', { class: 'muted', style: 'font-size:12px' }, '再試行中…（' + cn.tries + '回目）') : null,
      h('button', { class: 'btn btn-ghost', onclick: () => cancelConnecting() }, 'キャンセル')
    );
  }

  // 対戦中の切断〜再接続オーバーレイ（操作を一旦無効化）
  function viewReconnectOverlay() {
    const tries = UI._reconnectTries || 0;
    return h('div', { class: 'reconnect-scrim' },
      h('div', { class: 'reconnect-box panel' },
        h('div', { class: 'spinner' }),
        h('h3', { style: 'margin:2px 0 0' }, '接続が切れました'),
        h('p', { class: 'muted', style: 'font-size:13px;line-height:1.6' }, '自動で再接続しています…' + (tries ? '（' + tries + '回目）' : '') + '\nスマホはロック解除すると戻ります。'),
        h('div', { class: 'row center' },
          h('button', { class: 'btn btn-sm btn-primary', onclick: () => manualReconnect() }, '今すぐ再接続'),
          h('button', { class: 'btn btn-sm btn-ghost', onclick: () => confirmLeaveGame() }, '対戦をやめる'))
      ));
  }

  // サーバ再起動などで対戦が消えた場合の案内
  function viewServerGone() {
    return h('div', { class: 'home' },
      h('div', { class: 'crest' }, '🧭'),
      h('h2', null, '対戦が終了しました'),
      h('p', { class: 'muted', style: 'max-width:320px;font-size:13px;line-height:1.7' },
        'サーバーが再起動したため、この対戦のデータが失われました。お手数ですが新しい部屋を作って遊び直してください。'),
      h('div', { class: 'menu' },
        h('button', { class: 'btn btn-primary btn-block', onclick: () => go('createRoom') }, '新しい部屋を作る'),
        h('button', { class: 'btn btn-block', onclick: () => go('joinRoom') }, '部屋に参加する'),
        h('button', { class: 'btn btn-ghost btn-block', onclick: () => go('home') }, 'ホームへ'))
    );
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
    const byCost = (ids) => ids.slice().sort((a, b) => DOM.CARDS[a].cost - DOM.CARDS[b].cost || a.localeCompare(b));
    return h('div', { class: 'page' },
      h('div', { class: 'page-top' },
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => go(back) }, '← 戻る'),
        h('h2', null, 'カード一覧')),
      h('p', { class: 'muted', style: 'font-size:12px;padding:0 4px' }, 'タップで拡大（コスト・効果つき）。'),
      group('財宝', DOM.TREASURES),
      group('勝利点・呪い', DOM.VICTORY.concat(['curse'])),
      group('王国カード（基本セット）', byCost((DOM.POOLS && DOM.POOLS.basic) || DOM.KINGDOM)),
      group('王国カード（陰謀・拡張）', byCost((DOM.POOLS && DOM.POOLS.intrigue) || []))
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

  // ハンバーガーメニュー（ホーム・BGM・効果音をまとめる）
  function viewTopMenu() {
    const items = [
      h('button', { class: 'menu-item', onclick: () => { UI.menuOpen = false; confirmLeaveGame(); } }, '🏠　TOPに戻る'),
    ];
    if (DOM.audio) {
      items.push(h('button', { class: 'menu-item', onclick: () => { DOM.audio.toggleBgm(); render(); } }, (DOM.audio.isBgm() ? '🎵' : '🔇') + '　BGM：' + (DOM.audio.isBgm() ? 'オン' : 'オフ')));
      items.push(h('button', { class: 'menu-item', onclick: () => { DOM.audio.toggleSe(); render(); } }, (DOM.audio.isSe() ? '🔊' : '🔈') + '　効果音：' + (DOM.audio.isSe() ? 'オン' : 'オフ')));
      if (DOM.audio.isBgm()) items.push(h('button', { class: 'menu-item', onclick: () => cycleTrack() }, '♪　曲：' + (DOM.audio.tracks()[DOM.audio.track()] || '')));
    }
    return h('div', null,
      h('div', { class: 'menu-scrim', onclick: () => { UI.menuOpen = false; render(); } }),
      h('div', { class: 'top-menu' }, items));
  }

  function viewBoard(state, viewer, actor, interactive) {
    const t = state.turn;
    const active = state.players[t.active];
    const me = state.players[viewer];

    const top = h('div', { class: 'topbar' },
      h('div', { class: 'menu-wrap' },
        h('button', { class: 'menu-btn', title: 'メニュー', onclick: () => { UI.menuOpen = !UI.menuOpen; render(); } }, '☰'),
        UI.menuOpen ? viewTopMenu() : null),
      h('div', { class: 'turn-tag' },
        h('div', { class: 'who' }, active.name + ' の番' + (active.isCpu ? '（CPU・' + LEVEL_JP[active.cpuLevel] + '）' : '')),
        h('div', { class: 'phase' }, phaseLabel(t.phase))),
      h('div', { class: 'resources' },
        h('div', { class: 'badge act' }, h('div', { class: 'v' }, t.actions), h('div', { class: 'k' }, 'ACTION')),
        h('div', { class: 'badge buy' }, h('div', { class: 'v' }, t.buys), h('div', { class: 'k' }, 'BUY')),
        h('div', { class: 'badge coin' }, h('div', { class: 'v' }, t.coins), h('div', { class: 'k' }, 'COIN')))
    );

    // 他プレイヤー（複数対応）
    const others = state.players.map((p, i) => i).filter((i) => i !== viewer);
    const othersStrip = h('div', { class: 'others' },
      others.map((i) => {
        const p = state.players[i];
        const isAct = i === t.active;
        return h('div', { class: 'opp-chip' + (isAct ? ' on' : '') + (p.dc ? ' dc' : ''), 'data-seat': i },
          h('div', { class: 'opp-name' }, (isAct ? '▶ ' : '') + p.name + (p.dc ? ' 🔌' : (p.isCpu ? ' 🤖' : ''))),
          h('div', { class: 'opp-mini' }, p.dc ? '再接続中…' : ('山' + p.deck.length + ' 手' + p.hand.length + ' 捨' + p.discard.length)));
      }));

    // 相手切断中バナー（dc席があれば「再接続中…」、無ければCPU進行中）
    const dcSeat = others.find((i) => state.players[i].dc);
    const banner = dcSeat != null
      ? h('div', { class: 'cpu-banner dc-banner' }, '🔌 ' + state.players[dcSeat].name + ' が再接続中です…そのままお待ちください')
      : (state.players[actor].isCpu
        ? h('div', { class: 'cpu-banner' }, '🤖 ' + state.players[actor].name + ' が考えています…')
        : null);

    // サプライ（種類ごと）
    const buyableId = (id) => interactive && t.phase === 'buy' && !state.pending &&
      (state.supply[id] || 0) > 0 && t.buys > 0 && effCost(state, id) <= t.coins;
    const supSection = (title, ids, size) =>
      h('div', { class: 'supply-section' },
        h('div', { class: 'sup-title' }, title),
        h('div', { class: 'supply-grid ' + size },
          ids.map((id) => pileEl(id, state, { size: size === 'small' ? 'sm' : 'lg', buyable: buyableId(id), onClick: () => onPileTap(state, id, interactive) }))));

    const supply = h('div', null,
      // 財宝・勝利点は基本カード。デスクトップでは横並びにして縦スペースを節約。
      h('div', { class: 'supply-basics' },
        supSection('財宝', DOM.TREASURES, 'small'),
        supSection('勝利点', DOM.VICTORY.concat(['curse']), 'small')),
      supSection('王国カード（アクション）', state.kingdom, 'big'));

    // 場（プレイ済み）
    const playArea = active.inPlay.length
      ? h('div', { class: 'play-area' }, active.inPlay.map((id) => h('div', { class: 'chip-card ' + typeClass(id) + coinClass(id) }, DOM.CARDS[id].name)))
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
    const logBox = h('div', { class: 'log', onclick: () => { UI.logModal = true; sfx('tap'); render(); } },
      logLines.map((l, i) => h('div', { class: i === logLines.length - 1 ? 'latest' : '' }, l)),
      h('div', { class: 'log-more' }, '📜 タップで全履歴'));

    const moveLine = lastMove(state.log);
    const moveBar = h('div', { class: 'last-move' }, moveLine ? h('span', null, '🃏 ' + moveLine) : h('span', { class: 'muted' }, 'まだ動きはありません'));

    return h('div', { class: 'board' },
      // スクロールしても常に見えるヘッダー（手番・残量・相手・直近の行動）
      h('div', { class: 'board-head' }, top, othersStrip, moveBar),
      UI.mode === 'online' ? h('div', { class: 'muted', style: 'font-size:11px;text-align:center;margin:-2px 0 4px' }, '部屋 ' + UI.roomCode + '　/　あなた: ' + me.name) : null,
      banner,
      h('div', { class: 'section-h' }, 'サプライ（場の山札）'),
      supply,
      h('div', { class: 'zone-h' }, h('span', { class: 't' }, '場')),
      playArea,
      h('div', { class: 'zone-h' }, h('span', { class: 't' }, me.name + ' の手札'),
        h('span', { class: 'c', 'data-self-pile': '1' },
          '山' + me.deck.length + '・捨' + me.discard.length + '・手' + me.hand.length + '｜' + E().vpOf(me) + '点')),
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
    // 多重タイプ（貴族=勝利点+アクション、後宮=財宝+勝利点）は1グループだけに入れる。
    // 優先: アクション → 財宝 → 勝利点/呪い（手札での操作はこの順で扱える）。
    return {
      counts,
      actions: present.filter((id) => DOM.isType(id, 'action')),
      coins: present.filter((id) => DOM.isType(id, 'treasure') && !DOM.isType(id, 'action')),
      vp: present.filter((id) => (DOM.isType(id, 'victory') || DOM.isType(id, 'curse')) && !DOM.isType(id, 'action') && !DOM.isType(id, 'treasure')),
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
    const cost = effCost(state, id);
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
        h('button', { class: 'btn btn-primary btn-block', onclick: () => endActionPhase(state, viewer) }, '購入フェーズへ ▶'));
    }
    const hasTreasure = state.players[viewer].hand.some((c) => DOM.CARDS[c].types.includes('treasure'));
    return h('div', { class: 'actions-bar' },
      h('button', { class: 'btn btn-block', disabled: hasTreasure ? null : 'disabled', onclick: () => dispatch({ type: 'PLAY_ALL_TREASURES' }) }, '財宝を全部出す'),
      h('button', { class: 'btn btn-primary btn-block', onclick: () => endTurnTap(state, viewer) }, 'ターンを終える'));
  }

  // 買い忘れ防止: 財宝を出していない／2コイン以上残して購入権があるときは確認を挟む
  function endTurnTap(state, viewer) {
    const t = state.turn;
    const hasTreasure = state.players[viewer].hand.some((c) => DOM.CARDS[c].types.includes('treasure'));
    if (t.buys > 0 && (hasTreasure || t.coins >= 2)) {
      UI.confirm = {
        message: hasTreasure
          ? 'まだ手札に財宝があります。出さずにターンを終えますか？'
          : 'まだ ' + t.coins + ' コインあります。購入せずにターンを終えますか？',
        yesLabel: 'ターンを終える',
        onYes: () => { UI.confirm = null; dispatch({ type: 'END_TURN' }); },
      };
      render();
    } else {
      dispatch({ type: 'END_TURN' });
    }
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
    if (pd.type === 'militia') return modalMilitia(p, p.hand.length - 3, p.hand.includes('moat'), p.hand.includes('secret_chamber') && !pd.reacted);
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
      (id) => effCost(state, id) <= 4, (id) => dispatch({ type: 'WORKSHOP_GAIN', card: id }), () => dispatch({ type: 'WORKSHOP_GAIN', card: null }));

    /* ===== 拡張: 陰謀 ===== */
    if (pd.type === 'courtyard') return modalSingleHand(p, '中庭 — 山札の上に置く', '手札から1枚を選び、山札の一番上に置きます（次のターンに引きます）。',
      () => true, (id) => dispatch({ type: 'COURTYARD_PUT', card: id }), null, '山札の上に置く');
    if (pd.type === 'pawn') return modalChooseTwo(p);
    if (pd.type === 'steward' && pd.stage === 'choose') return modalOptions('執事', '次から1つを選びます。', [
      { label: '+2 カード', on: () => dispatch({ type: 'STEWARD_RESOLVE', choice: 'cards' }) },
      { label: '+2 コイン', on: () => dispatch({ type: 'STEWARD_RESOLVE', choice: 'coins' }) },
      { label: '手札を2枚 廃棄', on: () => dispatch({ type: 'STEWARD_RESOLVE', choice: 'trash' }) },
    ]);
    if (pd.type === 'steward' && pd.stage === 'trash') return modalTrashHand(p, '執事 — 廃棄', '手札から2枚を選んで廃棄します。',
      Math.min(2, p.hand.length), (cards) => dispatch({ type: 'STEWARD_TRASH', cards }));
    if (pd.type === 'wishing') return modalNameCard(state, '願いの井戸 — 宣言', 'カードを1種宣言します。山札の一番上がそれなら手札に加わります。',
      (id) => dispatch({ type: 'WISHING_RESOLVE', card: id }));
    if (pd.type === 'baron') return modalOptions('男爵', '屋敷の使い方を選びます。', [
      { label: '屋敷を捨てて +4 コイン', cls: 'btn-primary', on: () => dispatch({ type: 'BARON_RESOLVE', discard: true }) },
      { label: '屋敷を獲得する（捨てない）', on: () => dispatch({ type: 'BARON_RESOLVE', discard: false }) },
    ]);
    if (pd.type === 'ironworks') return modalGainSupply(state, '鉄工所 — 獲得', 'コスト4以下を1枚獲得。アクション＝+1アクション／財宝＝+1コイン／勝利点＝+1カード。',
      (id) => effCost(state, id) <= 4, (id) => dispatch({ type: 'IRONWORKS_GAIN', card: id }), () => dispatch({ type: 'IRONWORKS_GAIN', card: null }));
    if (pd.type === 'mining_village') return modalOptions('鉱山の村', '場のこのカードを廃棄すると +2 コインになります。', [
      { label: '廃棄して +2 コイン', cls: 'btn-primary', on: () => dispatch({ type: 'MINING_VILLAGE_RESOLVE', trash: true }) },
      { label: '廃棄しない', on: () => dispatch({ type: 'MINING_VILLAGE_RESOLVE', trash: false }) },
    ]);
    if (pd.type === 'nobles') return modalOptions('貴族', '次から1つを選びます。', [
      { label: '+3 カード', on: () => dispatch({ type: 'NOBLES_RESOLVE', choice: 'cards' }) },
      { label: '+2 アクション', on: () => dispatch({ type: 'NOBLES_RESOLVE', choice: 'actions' }) },
    ]);
    if (pd.type === 'torturer') return modalTorturer(p, p.hand.includes('secret_chamber') && !pd.reacted);
    if (pd.type === 'trading_post') return modalTrashHand(p, '交易場 — 廃棄', '手札から2枚を選んで廃棄します（2枚廃棄できたら銀貨を手札に獲得）。', Math.min(2, p.hand.length), (cards) => dispatch({ type: 'TRADING_POST_RESOLVE', cards }));
    if (pd.type === 'upgrade' && pd.stage === 'trash') return modalSingleHand(p, '改良 — 廃棄', '手札から1枚を廃棄します（その後、ちょうど1コイン高いカードを獲得）。', () => true, (card) => dispatch({ type: 'UPGRADE_TRASH', card }));
    if (pd.type === 'upgrade' && pd.stage === 'gain') return modalGainSupply(state, '改良 — 獲得', '廃棄したカードよりちょうど1コイン高いカードを1枚獲得します。', (id) => effCost(state, id) === pd.exactCost, (id) => dispatch({ type: 'UPGRADE_GAIN', card: id }));
    if (pd.type === 'scout') return modalReorder('斥候 — 山札の上に戻す', '山札の上に戻す順番をタップで選びます（最初にタップ＝一番上）。', pd.cards, (order) => dispatch({ type: 'SCOUT_RESOLVE', order }));
    if (pd.type === 'swindler' && pd.stage === 'react') return modalOptions('詐欺師を受ける', '山札の上1枚が廃棄され、相手が選んだ同コストのカードに置き換わります。', reactOptions(p, pd, { type: 'SWINDLER_REACT' }));
    if (pd.type === 'swindler' && pd.stage === 'gain') return modalGainSupply(state, '詐欺師 — 相手に与える', state.players[pd.victim].name + ' に コスト ' + pd.cost + ' のカードを与えます。', (id) => effCost(state, id) === pd.cost, (id) => dispatch({ type: 'SWINDLER_GAIN', card: id }));
    if (pd.type === 'saboteur' && pd.stage === 'react') return modalOptions('破壊工作員を受ける', 'コスト3以上のカードが1枚廃棄されます。', reactOptions(p, pd, { type: 'SABOTEUR_REACT' }));
    if (pd.type === 'saboteur' && pd.stage === 'gain') return modalGainSupply(state, '破壊工作員 — 獲得（任意）', 'コスト ' + pd.maxCost + ' 以下のカードを1枚獲得できます（しなくてもよい）。', (id) => effCost(state, id) <= pd.maxCost, (id) => dispatch({ type: 'SABOTEUR_GAIN', card: id }), () => dispatch({ type: 'SABOTEUR_GAIN', card: null }), true);
    if (pd.type === 'minion' && pd.stage === 'choose') return modalOptions('手先', '次から1つを選びます。', [
      { label: '+2 コイン', cls: 'btn-primary', on: () => dispatch({ type: 'MINION_RESOLVE', choice: 'coins' }) },
      { label: '手札を捨てて4枚引く（相手も引き直し）', on: () => dispatch({ type: 'MINION_RESOLVE', choice: 'attack' }) }]);
    if (pd.type === 'minion_attack' && pd.stage === 'react') return modalOptions('手先を受ける', '手札5枚以上なら捨てて4枚引き直します。', reactOptions(p, pd, { type: 'MINION_ATTACK_REACT' }));
    if (pd.type === 'masquerade' && pd.stage === 'pass') return modalSingleHand(p, '仮面舞踏会 — 左隣へ渡す', '左隣のプレイヤーに渡すカードを1枚選びます。', () => true, (card) => dispatch({ type: 'MASQUERADE_PASS', card }), null, '渡す');
    if (pd.type === 'masquerade' && pd.stage === 'trash') return modalSingleHand(p, '仮面舞踏会 — 廃棄（任意）', '手札から1枚を廃棄できます（しなくてもよい）。', () => true, (card) => dispatch({ type: 'MASQUERADE_TRASH', card }), { label: '廃棄しない', on: () => dispatch({ type: 'MASQUERADE_TRASH', card: null }) }, '廃棄する');
    if (pd.type === 'secret_chamber' && pd.stage === 'discard') return modalMultiHand(p, '秘密の小部屋', '捨てる枚数だけ +1 コイン（0枚でもよい）。', (n) => '確定（' + n + '枚捨て→+' + n + 'コイン）', true, (cards) => dispatch({ type: 'SECRET_CHAMBER_RESOLVE', cards }));
    if (pd.type === 'moneylender') return modalOptions('金貸し', '手札の銅貨1枚を廃棄すると +3 コインになります。', [
      { label: '銅貨を廃棄して +3 コイン', cls: 'btn-primary', on: () => dispatch({ type: 'MONEYLENDER_RESOLVE', trash: true }) },
      { label: '廃棄しない', on: () => dispatch({ type: 'MONEYLENDER_RESOLVE', trash: false }) }]);
    if (pd.type === 'chancellor') return modalOptions('宰相', '自分の山札をすべて捨て札にできます（次に引くカードが新しくなります）。', [
      { label: '山札を捨て札にする', cls: 'btn-primary', on: () => dispatch({ type: 'CHANCELLOR_RESOLVE', discardDeck: true }) },
      { label: 'そのまま', on: () => dispatch({ type: 'CHANCELLOR_RESOLVE', discardDeck: false }) }]);
    if (pd.type === 'chapel') return modalMultiHand(p, '礼拝堂 — 廃棄', '手札を最大4枚まで廃棄します（0枚でもよい）。', (n) => '確定（' + n + '枚廃棄）', true, (cards) => dispatch({ type: 'CHAPEL_RESOLVE', cards }), 4);
    if (pd.type === 'witch' && pd.stage === 'react') return modalOptions('魔女を受ける', '呪い1枚を獲得します。', reactOptions(p, pd, { type: 'WITCH_REACT' }));
    if (pd.type === 'bureaucrat' && pd.stage === 'react') return modalOptions('役人を受ける', '手札の勝利点1枚を山札の上に置きます。', reactOptions(p, pd, { type: 'BUREAUCRAT_REACT' }));
    if (pd.type === 'bureaucrat' && pd.stage === 'put') return modalSingleHand(p, '役人 — 山札の上に置く', '手札の勝利点カードを1枚選び、山札の上に置きます。', (id) => DOM.isType(id, 'victory'), (card) => dispatch({ type: 'BUREAUCRAT_PUT', card }), null, '山札の上に置く');
    if (pd.type === 'feast') return modalGainSupply(state, '祝宴 — 獲得', 'コスト5以下のカードを1枚獲得します。', (id) => effCost(state, id) <= 5, (id) => dispatch({ type: 'FEAST_GAIN', card: id }), () => dispatch({ type: 'FEAST_GAIN', card: null }));
    if (pd.type === 'library') return modalOptions('書庫 — 「' + DOM.CARDS[pd.card].name + '」を引いた', 'このアクションカードを手札に加えますか、脇に置きますか？（脇に置くと最後に捨て、引き直します）', [
      { label: '手札に加える', cls: 'btn-primary', on: () => dispatch({ type: 'LIBRARY_RESOLVE', setAside: false }) },
      { label: '脇に置く（捨てる）', on: () => dispatch({ type: 'LIBRARY_RESOLVE', setAside: true }) }]);
    if (pd.type === 'spy' && pd.stage === 'react') return modalOptions('密偵を受ける', '山札の上が公開され、相手が捨てるか戻すか決めます。', reactOptions(p, pd, { type: 'SPY_REACT' }));
    if (pd.type === 'spy' && pd.stage === 'decide') {
      const who = pd.victim === pd.source ? '自分' : state.players[pd.victim].name;
      return modalOptions('密偵 — ' + who + 'の山札の上: 「' + DOM.CARDS[pd.card].name + '」', who + 'の山札の上のカードをどうしますか？', [
        { label: 'そのまま戻す', cls: 'btn-primary', on: () => dispatch({ type: 'SPY_DECIDE', discard: false }) },
        { label: '捨てさせる', on: () => dispatch({ type: 'SPY_DECIDE', discard: true }) }]);
    }
    if (pd.type === 'thief' && pd.stage === 'react') return modalOptions('泥棒を受ける', '山札の上2枚が公開され、財宝1枚が奪われます。', reactOptions(p, pd, { type: 'THIEF_REACT' }));
    if (pd.type === 'thief' && pd.stage === 'pick') return modalOptions('泥棒 — ' + state.players[pd.victim].name + 'の財宝を廃棄', '公開された財宝から1枚を選んで廃棄します。', pd.treasures.map((c) => ({ label: DOM.CARDS[c].name, on: () => dispatch({ type: 'THIEF_PICK', card: c }) })));
    if (pd.type === 'thief' && pd.stage === 'gain') return modalOptions('泥棒 — 「' + DOM.CARDS[pd.trashed].name + '」を獲得?', '廃棄した財宝を自分の捨て札に獲得できます。', [
      { label: '獲得する', cls: 'btn-primary', on: () => dispatch({ type: 'THIEF_GAIN', take: true }) },
      { label: '廃棄のまま', on: () => dispatch({ type: 'THIEF_GAIN', take: false }) }]);
    if (pd.type === 'throne') return modalSingleHand(p, '玉座の間 — 2回使うアクションを選ぶ', '手札のアクションカードを1枚選ぶと、それを2回使います。', (id) => DOM.isType(id, 'action'), (card) => dispatch({ type: 'THRONE_CHOOSE', card }), null, '2回使う');
    if (pd.type === 'secret_chamber_putback') return modalSelectN(p, '秘密の小部屋 — 山札の上に戻す', '手札から2枚を選んで山札の上に戻します（最初のタップが一番上）。', Math.min(2, p.hand.length), '確定（戻す）', (cards) => dispatch({ type: 'SECRET_CHAMBER_PUTBACK', cards }));

    return h('div');
  }

  // 被攻撃側の反応オプション（堀・秘密の小部屋・そのまま受ける）。proceed は通すときのアクション。
  function reactOptions(p, pd, proceed) {
    const opts = [];
    if (p.hand.includes('moat')) opts.push({ label: '🛡 堀を公開して無効化', cls: 'btn-primary', on: () => dispatch({ type: 'MOAT_REVEAL' }) });
    if (p.hand.includes('secret_chamber') && !pd.reacted) opts.push({ label: '🔮 秘密の小部屋を公開（+2引いて2枚戻す）', on: () => dispatch({ type: 'SECRET_CHAMBER_REVEAL' }) });
    opts.push({ label: 'そのまま受ける', on: () => dispatch(proceed) });
    return opts;
  }
  // 手札から n 枚をタップ順に選ぶ（秘密の小部屋の戻し）。最初のタップが一番上。
  function modalSelectN(p, title, desc, n, confirmLabel, onConfirm) {
    const chips = p.hand.map((id, idx) => {
      const pos = UI.selection.indexOf(idx);
      return cardEl(id, { size: 'sm', extra: pos >= 0 ? 'selected' : 'selectable', badge: pos >= 0 ? String(pos + 1) : null,
        onClick: () => { const i = UI.selection.indexOf(idx); if (i >= 0) UI.selection.splice(i, 1); else if (UI.selection.length < n) UI.selection.push(idx); render(); } });
    });
    const remain = n - UI.selection.length;
    const footer = h('button', { class: 'btn btn-primary btn-block', disabled: remain === 0 ? null : 'disabled',
      onclick: () => onConfirm(UI.selection.map((i) => p.hand[i])) }, remain === 0 ? confirmLabel : ('あと ' + remain + ' 枚'));
    return modalShell(title, desc, chips, footer);
  }

  // 複数カードを「置く順」に並べ替える（斥候など）。最初にタップしたカードが一番上。
  function modalReorder(title, desc, cards, onConfirm) {
    const chips = cards.map((id, idx) => {
      const pos = UI.selection.indexOf(idx);
      return cardEl(id, { size: 'sm', extra: pos >= 0 ? 'selected' : 'selectable',
        badge: pos >= 0 ? String(pos + 1) : null,
        onClick: () => {
          const i = UI.selection.indexOf(idx);
          if (i >= 0) UI.selection.splice(i, 1);
          else UI.selection.push(idx);
          render();
        } });
    });
    const remain = cards.length - UI.selection.length;
    const footer = h('button', { class: 'btn btn-primary btn-block', disabled: remain === 0 ? null : 'disabled',
      onclick: () => onConfirm(UI.selection.map((i) => cards[i])) },
      remain === 0 ? '確定（上から順に戻す）' : 'あと ' + remain + ' 枚 順番を選ぶ');
    return modalShell(title, desc, chips, footer);
  }

  function modalMultiHand(p, title, desc, confirmLabel, allowZero, onConfirm, maxN) {
    const chips = p.hand.map((id, idx) =>
      cardEl(id, {
        size: 'sm',
        extra: UI.selection.includes(idx) ? 'selected' : 'selectable',
        onClick: () => {
          const i = UI.selection.indexOf(idx);
          if (i >= 0) UI.selection.splice(i, 1); else if (maxN == null || UI.selection.length < maxN) UI.selection.push(idx);
          render();
        },
      }));
    const n = UI.selection.length;
    return modalShell(title, desc, chips,
      h('button', { class: 'btn btn-primary btn-block', disabled: (!allowZero && n === 0) ? 'disabled' : null,
        onclick: () => onConfirm(UI.selection.map((i) => p.hand[i])) }, confirmLabel(n)));
  }
  function modalMilitia(p, need, hasMoat, hasSecret) {
    const chips = p.hand.map((id, idx) =>
      cardEl(id, {
        size: 'sm',
        extra: UI.selection.includes(idx) ? 'selected' : 'selectable',
        onClick: () => {
          const i = UI.selection.indexOf(idx);
          if (i >= 0) UI.selection.splice(i, 1); else if (UI.selection.length < need) UI.selection.push(idx);
          render();
        },
      }));
    const remain = need - UI.selection.length;
    const buttons = h('div', null,
      hasMoat ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'MOAT_REVEAL' }) }, '🛡 堀を公開して無効化') : null,
      hasSecret ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'SECRET_CHAMBER_REVEAL' }) }, '🔮 秘密の小部屋を公開（+2引いて2枚戻す）') : null,
      h('button', { class: 'btn btn-primary btn-block', disabled: remain === 0 ? null : 'disabled',
        onclick: () => dispatch({ type: 'MILITIA_RESOLVE', cards: UI.selection.map((i) => p.hand[i]) }) },
        remain === 0 ? '確定（捨てる）' : 'あと ' + remain + ' 枚 選ぶ'));
    return modalShell('民兵を受ける', '手札が3枚になるまで捨てます。' + (hasMoat ? '「堀」で無効化もできます。' : ''), chips, buttons);
  }
  function modalSingleHand(p, title, desc, filter, onPick, skip, pickLabel) {
    const lbl = pickLabel || '廃棄する';
    const elig = p.hand.map((id, idx) => ({ id, idx })).filter((x) => filter(x.id));
    const chips = elig.length
      ? elig.map((x) => cardEl(x.id, { size: 'sm', extra: 'selectable', onClick: () => openPickZoom(x.id, lbl, () => onPick(x.id)) }))
      : [h('p', { class: 'muted' }, '対象のカードがありません')];
    const btn = skip ? h('button', { class: 'btn btn-block', onclick: skip.on }, skip.label) : null;
    return modalShell(title, desc, chips, btn);
  }

  /* ---------- 拡張用の選択モーダル ---------- */
  // 選択肢ボタンを縦に並べる（執事・男爵・鉱山の村・貴族など）
  function modalOptions(title, desc, buttons) {
    const btns = buttons.map((b) =>
      h('button', { class: 'btn btn-block ' + (b.cls || ''), style: 'margin-bottom:8px', onclick: b.on }, b.label));
    return modalShell(title, desc, [], h('div', null, btns));
  }
  // 従者: 4つから異なる2つを選ぶ
  const PAWN_OPTS = [
    { v: 'card', label: '+1 カード' }, { v: 'action', label: '+1 アクション' },
    { v: 'buy', label: '+1 購入' }, { v: 'coin', label: '+1 コイン' },
  ];
  function modalChooseTwo(p) {
    const tiles = PAWN_OPTS.map((o) =>
      h('button', { class: 'choose-tile' + (UI.selection.includes(o.v) ? ' on' : ''),
        onclick: () => {
          const i = UI.selection.indexOf(o.v);
          if (i >= 0) UI.selection.splice(i, 1);
          else if (UI.selection.length < 2) UI.selection.push(o.v);
          render();
        } }, o.label));
    const n = UI.selection.length;
    const footer = h('button', { class: 'btn btn-primary btn-block', disabled: n === 2 ? null : 'disabled',
      onclick: () => dispatch({ type: 'PAWN_RESOLVE', choices: UI.selection.slice() }) },
      n === 2 ? '決定' : '異なる2つを選ぶ（あと ' + (2 - n) + '）');
    return modalShell('従者', '次から異なる2つを選びます。', tiles, footer);
  }
  // 手札からちょうど n 枚を選んで廃棄
  function modalTrashHand(p, title, desc, n, onConfirm) {
    const chips = p.hand.map((id, idx) =>
      cardEl(id, { size: 'sm', extra: UI.selection.includes(idx) ? 'selected' : 'selectable',
        onClick: () => {
          const i = UI.selection.indexOf(idx);
          if (i >= 0) UI.selection.splice(i, 1);
          else if (UI.selection.length < n) UI.selection.push(idx);
          render();
        } }));
    const remain = n - UI.selection.length;
    const footer = h('button', { class: 'btn btn-primary btn-block', disabled: remain === 0 ? null : 'disabled',
      onclick: () => onConfirm(UI.selection.map((i) => p.hand[i])) },
      remain === 0 ? '確定（廃棄）' : 'あと ' + remain + ' 枚 選ぶ');
    return modalShell(title, desc, chips, footer);
  }
  // 願いの井戸: このゲームのカードから1種を宣言
  function modalNameCard(state, title, desc, onPick) {
    const order = DOM.SUPPLY_ORDER(state.kingdom);
    const chips = order.map((id) =>
      cardEl(id, { size: 'sm', extra: 'selectable', onClick: () => openPickZoom(id, '宣言する', () => onPick(id)) }));
    return modalShell(title, desc, chips, null);
  }
  // 拷問人を受ける: 手札2枚を捨てる / 呪いを受け取る / 堀で無効化
  function modalTorturer(p, hasSecret) {
    const need = Math.min(2, p.hand.length);
    const hasMoat = p.hand.includes('moat');
    const chips = p.hand.map((id, idx) =>
      cardEl(id, { size: 'sm', extra: UI.selection.includes(idx) ? 'selected' : 'selectable',
        onClick: () => {
          const i = UI.selection.indexOf(idx);
          if (i >= 0) UI.selection.splice(i, 1);
          else if (UI.selection.length < need) UI.selection.push(idx);
          render();
        } }));
    const remain = need - UI.selection.length;
    const footer = h('div', null,
      hasMoat ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'MOAT_REVEAL' }) }, '🛡 堀を公開して無効化') : null,
      hasSecret ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'SECRET_CHAMBER_REVEAL' }) }, '🔮 秘密の小部屋を公開（+2引いて2枚戻す）') : null,
      h('button', { class: 'btn btn-primary btn-block', disabled: remain === 0 ? null : 'disabled',
        onclick: () => dispatch({ type: 'TORTURER_RESOLVE', choice: 'discard', cards: UI.selection.map((i) => p.hand[i]) }) },
        remain === 0 ? '手札を捨てる（確定）' : '捨てる ' + remain + ' 枚 を選ぶ'),
      h('button', { class: 'btn btn-block', style: 'margin-top:8px', onclick: () => dispatch({ type: 'TORTURER_RESOLVE', choice: 'curse' }) }, '☠️ 呪いを手札に受け取る'));
    return modalShell('拷問人を受ける', '手札を2枚捨てるか、呪い1枚を手札に受け取ります。' + (hasMoat ? '「堀」で無効化もできます。' : ''), chips, footer);
  }
  // skipOnEmpty: 関数を渡すと「獲得せずに進む」を出す。alwaysSkip=true で候補があっても常時表示（任意獲得）。
  function modalGainSupply(state, title, desc, filter, onPick, skipOnEmpty, alwaysSkip) {
    const order = DOM.SUPPLY_ORDER(state.kingdom);
    const elig = order.filter((id) => filter(id) && (state.supply[id] || 0) > 0);
    const chips = elig.length
      ? elig.map((id) => h('div', { class: 'pick-supply' },
          cardEl(id, { size: 'sm', extra: 'selectable', onClick: () => openPickZoom(id, '獲得する', () => onPick(id)) }),
          h('div', { class: 'pick-remain' }, '残' + state.supply[id])))
      : [h('p', { class: 'muted' }, '獲得できるカードがありません')];
    const footer = (skipOnEmpty && (!elig.length || alwaysSkip))
      ? h('button', { class: 'btn btn-block', onclick: skipOnEmpty }, '獲得せずに進む') : null;
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
  // 廃棄/獲得のカードを拡大して確認してから確定する
  function openPickZoom(id, label, onConfirm) { UI.pickZoom = { id, label, onConfirm }; render(); }
  function viewPickZoom() {
    const pz = UI.pickZoom;
    const c = DOM.CARDS[pz.id];
    return h('div', { class: 'scrim pickzoom-scrim', onclick: (e) => { if (e.target.classList.contains('scrim')) { UI.pickZoom = null; render(); } } },
      h('div', { class: 'pickzoom' },
        h('div', { class: 'zoom-wrap ' + typeClass(pz.id) },
          h('img', { class: 'zoom-img', src: 'asset/' + pz.id + '.jpg', alt: c.name, onerror: function () { this.style.display = 'none'; if (this.parentElement) this.parentElement.classList.add('noimg'); } }),
          h('div', { class: 'zoom-fallback' }, c.name)),
        h('div', { class: 'pickzoom-actions' },
          h('button', { class: 'btn btn-primary btn-block', onclick: () => { const f = pz.onConfirm; UI.pickZoom = null; if (f) f(); } }, (pz.label || 'これにする') + 'を確定'),
          h('button', { class: 'btn btn-ghost btn-block', style: 'margin-top:8px', onclick: () => { UI.pickZoom = null; render(); } }, 'もどる'))));
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
          h('img', { class: 'zoom-img', src: 'asset/' + id + '.jpg', alt: c.name, onerror: function () { this.style.display = 'none'; if (this.parentElement) this.parentElement.classList.add('noimg'); } }),
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
    // 点数の内訳（属州2・公領1…）。scoreGame が vpCards で確定済み（マスク配信でも出せる）
    // 勝利点に絡むカードを全部、各カードの寄与点つきで並べる（貴族・後宮・公爵も含む。公爵=所持する公領の枚数）。
    const breakdown = (sc) => {
      const v = sc.vpCards || {};
      const duchies = v['duchy'] || 0;
      const ptOf = (id) => id === 'duke' ? (v['duke'] || 0) * duchies
        : id === 'gardens' ? (v['gardens'] || 0) * Math.floor((sc.deckSize || 0) / 10)
        : (DOM.CARDS[id].vp || 0) * v[id];
      const ids = Object.keys(v).filter((id) => v[id] > 0);
      // 寄与点の高い順。呪い（マイナス）は最後に。
      ids.sort((a, b) => (a === 'curse') - (b === 'curse') || ptOf(b) - ptOf(a) || DOM.CARDS[b].cost - DOM.CARDS[a].cost);
      return ids.length
        ? ids.map((id) => { const pt = ptOf(id); return DOM.CARDS[id].name + '×' + v[id] + '（' + (pt > 0 ? '+' + pt : pt) + '点）'; })
        : null;
    };
    return h('div', { class: 'result' },
      h('div', { class: 'trophy' }, tie ? '🤝' : '🏆'),
      h('h1', null, tie ? '引き分け' : winNames + ' の勝ち！'),
      h('p', { class: 'muted' }, r.reason + 'ため終了'),
      h('div', { class: 'score-table' },
        order.map((row) => {
          const bd = breakdown(row.s);
          return h('div', { class: 'score-row ' + (r.winners.includes(row.i) ? 'win' : '') },
            h('div', null,
              h('div', { class: 'nm' }, row.p.name + (row.p.isCpu ? '（CPU・' + LEVEL_JP[row.p.cpuLevel] + '）' : '')),
              h('div', { class: 'tn' }, row.s.turns + ' ターン'),
              bd ? h('div', { class: 'vbd' }, bd.map((t) => h('div', null, t))) : null),
            h('div', { class: 'vp' }, row.s.vp + ' 点'));
        })),
      h('div', { class: 'row center' },
        UI.mode === 'local' ? h('button', { class: 'btn btn-primary', onclick: () => restartLocal() }, 'もう一度（同設定）') : null,
        UI.mode === 'online' && UI.isHost
          ? h('button', { class: 'btn btn-primary', onclick: () => { sfx('tap'); if (UI.netClient) UI.netClient.send({ t: 'rematch' }); } }, 'もう一度（同じメンバー）')
          : null,
        h('button', { class: 'btn btn-ghost', onclick: () => leaveOnline() }, 'ホームへ')),
      UI.mode === 'online' && !UI.isHost
        ? h('p', { class: 'muted', style: 'font-size:12px' }, 'ホストが「もう一度」を押すとこのメンバーで再戦できます')
        : null);
  }

  /* ---------- ログ全履歴モーダル ---------- */
  function viewLogModal() {
    const s = UI.store && UI.store.state;
    const lines = (s && s.log) || [];
    const close = () => { UI.logModal = false; render(); };
    return h('div', { class: 'modal-scrim', onclick: (e) => { if (e.target.classList.contains('modal-scrim')) close(); } },
      h('div', { class: 'modal' },
        h('h3', null, 'これまでの記録'),
        h('div', { class: 'log-history' },
          lines.map((l, i) => h('div', { class: i === lines.length - 1 ? 'latest' : '' }, l))),
        h('button', { class: 'btn btn-block', onclick: close }, 'とじる')));
  }

  /* ============================================================
     ゲーム開始・部屋管理・CPU駆動
     ============================================================ */
  function startConfigured(configs, opts) {
    opts = opts || {};
    configs = configs || UI.setup.seats.map((s) => ({ name: s.name, isCpu: s.type === 'cpu', level: s.level }));
    // 名前の空欄を補完
    configs = configs.map((c, i) => ({ name: (c.name && c.name.trim()) || ('プレイヤー' + (i + 1)), isCpu: !!c.isCpu, level: c.level || 'normal' }));
    // 手番をランダムにする場合はシャッフル（Fisher-Yates）
    if (opts.shuffle) {
      for (let i = configs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = configs[i]; configs[i] = configs[j]; configs[j] = t; }
    }
    // 使う王国カード（基本/陰謀/ランダム）。ランダムはこの場で10種を確定して以後固定。
    const kingdom = opts.kingdom || (DOM.kingdomForSet ? DOM.kingdomForSet(UI.setup.kingdomSet) : DOM.KINGDOM);
    UI.lastConfigs = configs;
    UI.lastKingdom = kingdom;
    const st = E().createInitialState(configs, kingdom);
    UI.mode = 'local'; UI.mySeat = null; UI.localViewer = firstHuman(st);
    UI.store = DOM.LocalStore(st);
    UI.store.subscribe(onStoreChange);
    UI.view = 'game';
    render();
  }
  function restartLocal() {
    const st = E().createInitialState(UI.lastConfigs, UI.lastKingdom);
    UI.localViewer = firstHuman(st);
    UI.store.dispatch({ type: 'NEW_GAME', players: UI.lastConfigs, kingdom: UI.lastKingdom });
  }

  /* ---------- オンライン（WebSocket / サーバ権威） ---------- */
  // 接続→作成/参加。Render無料枠のコールドスタート（起動待ち）に備え、
  // 「サーバー接続中です」を表示しつつタイムアウト＋自動リトライする。
  function startOnline(mode, name, code) {
    UI.connecting = { mode, name, code, tries: 0 };
    UI.mode = 'online';
    UI.view = 'connecting';
    render();
    tryConnect();
  }
  function tryConnect() {
    const cn = UI.connecting;
    if (!cn) return;
    if (UI.netClient) { try { UI.netClient.close(); } catch (e) { /* noop */ } }
    const client = DOM.NetClient(onNetMessage);
    UI.netClient = client;
    UI.store = DOM.NetStore(client);
    let settled = false;
    const to = setTimeout(() => {
      if (settled) return; settled = true;
      try { client.close(); } catch (e) { /* noop */ }
      retryConnect();
    }, 13000); // 起動待ちでも応答しない場合は閉じて再試行
    client.connect().then(() => {
      if (settled) return; settled = true; clearTimeout(to);
      if (!UI.connecting) { try { client.close(); } catch (e) { /* noop */ } return; } // キャンセル済み
      if (cn.mode === 'create') client.send({ t: 'create', name: cn.name });
      else { UI.roomCode = cn.code; client.send({ t: 'join', code: cn.code, name: cn.name }); }
    }).catch(() => {
      if (settled) return; settled = true; clearTimeout(to);
      retryConnect();
    });
  }
  function retryConnect() {
    const cn = UI.connecting;
    if (!cn) return;
    cn.tries++;
    if (cn.tries >= 8) { toast('サーバーに接続できませんでした。少し待って再度お試しください'); cancelConnecting(); return; }
    render(); // 試行回数を表示更新
    setTimeout(tryConnect, Math.min(1500 + cn.tries * 800, 5000));
  }
  function cancelConnecting() {
    UI.connecting = null;
    resetOnline();
    go('home');
  }
  function createRoom(name) { startOnline('create', name || defaultName('host')); }
  function joinRoom(code, name) {
    code = (code || '').trim();
    if (!/^[0-9]{4}$/.test(code)) { toast('コードは数字4桁です'); return; }
    startOnline('join', name || defaultName('guest'), code);
  }

  // サーバ → クライアント メッセージ処理
  function onNetMessage(msg) {
    switch (msg.t) {
      case 'joined':
        UI.connecting = null; UI.reconnecting = false; UI._reconnectTries = 0; stopReconnect();
        UI.roomCode = msg.code; UI.mySeat = msg.you; UI.isHost = msg.isHost; UI.netToken = msg.token;
        if (UI.netClient) UI.netClient.setOnClose(() => onNetDisconnect());
        saveSession(); // 再読込/切断後も元の席へ戻れるよう永続化
        if (!msg.started && UI.view !== 'game') UI.view = 'lobby';
        render();
        break;
      case 'lobby':
        UI.connecting = null;
        UI.lobby = msg; UI.roomCode = msg.code;
        if (UI.view === 'connecting' || (UI.view !== 'game')) UI.view = 'lobby';
        render();
        break;
      case 'started':
        UI.connecting = null; UI.reconnecting = false; UI._reconnectTries = 0; stopReconnect();
        UI.mySeat = msg.you;
        UI.store.setState(msg.state);
        UI.view = 'game';
        saveSession();
        render();
        break;
      case 'state':
        UI.store.setState(msg.state);
        if (msg.state && msg.state.gameOver) clearSession(); // 対戦終了→以後の自動復帰は不要
        else touchSession();
        render();
        break;
      case 'error':
        if (UI.connecting) { toast(msg.message); UI.connecting = null; resetOnline(); go(msg.fatal ? 'home' : 'onlineMenu'); break; }
        if (msg.fatal) { showServerGone(); break; } // 再接続できない＝対戦が消えた
        toast(msg.message);
        break;
    }
  }

  /* ---------- セッション永続化（再読込/タブ破棄でも元の席へ戻る） ---------- */
  const SESSION_KEY = 'dom_online_session';
  function saveSession() {
    try {
      if (UI.roomCode && UI.netToken && UI.mySeat != null)
        localStorage.setItem(SESSION_KEY, JSON.stringify({ code: UI.roomCode, seat: UI.mySeat, token: UI.netToken, ts: Date.now() }));
    } catch (e) { /* noop */ }
  }
  function touchSession() {
    // ts を更新（猶予判定を新しく保つ）。書き込みは間引く。
    const now = Date.now();
    if (now - (UI._sessionTs || 0) < 20000) return;
    UI._sessionTs = now; saveSession();
  }
  function loadSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { return null; } }
  function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* noop */ } UI._sessionTs = 0; }

  /* ---------- 自動再接続（指数バックオフ＋復帰イベント） ---------- */
  function stopReconnect() { if (UI._reconnectTimer) { clearTimeout(UI._reconnectTimer); UI._reconnectTimer = null; } }
  // 予期しない切断 → 再接続ループ開始
  function onNetDisconnect() {
    if (UI.mode !== 'online' || UI.view === 'serverGone') return;
    if (!UI.netToken || !UI.roomCode) return;
    if (!UI.reconnecting) { UI.reconnecting = true; render(); }
    scheduleReconnect(false);
  }
  function scheduleReconnect(immediate) {
    stopReconnect();
    if (UI.mode !== 'online' || !UI.netToken || !UI.roomCode) return;
    const tries = UI._reconnectTries || 0;
    const delay = immediate ? 200 : Math.min(1000 * Math.pow(2, Math.min(tries, 4)), 15000); // 1,2,4,8,16→上限15s
    UI._reconnectTimer = setTimeout(doReconnect, delay);
  }
  function doReconnect() {
    UI._reconnectTimer = null;
    if (UI.mode !== 'online' || !UI.netToken || !UI.roomCode) return;
    UI._reconnectTries = (UI._reconnectTries || 0) + 1;
    if (UI.netClient) { try { UI.netClient.close(); } catch (e) { /* noop */ } }
    const client = DOM.NetClient(onNetMessage);
    UI.netClient = client;
    if (!UI.store || UI.store.mode !== 'online') UI.store = DOM.NetStore(client);
    else UI.store.client = client;
    client.setOnClose(() => onNetDisconnect());
    render();
    client.connect()
      .then(() => client.send({ t: 'resume', code: UI.roomCode, you: UI.mySeat, token: UI.netToken }))
      .catch(() => scheduleReconnect(false)); // 接続失敗→バックオフで粘る（あきらめない）
  }
  // ネット復帰・画面/タブ復帰で即再接続（スマホのロック解除など）
  function onResumeTrigger() {
    if (UI.mode !== 'online' || !UI.netToken || !UI.roomCode) return;
    if (UI.netClient && UI.netClient.isOpen() && !UI.reconnecting) return; // 健全
    UI._reconnectTries = 0;
    if (!UI.reconnecting) { UI.reconnecting = true; render(); }
    scheduleReconnect(true);
  }
  function manualReconnect() { UI._reconnectTries = 0; UI.reconnecting = true; scheduleReconnect(true); }
  // サーバ再起動などで対戦が消えた → 明示して新規部屋作成へ誘導（無限再接続にしない）
  function showServerGone() {
    stopReconnect();
    if (UI.netClient) { try { UI.netClient.close(); } catch (e) { /* noop */ } }
    clearSession();
    UI.netClient = null; UI.store = null; UI.mySeat = null; UI.roomCode = null;
    UI.netToken = null; UI.reconnecting = false; UI._reconnectTries = 0; UI.lobby = null;
    UI.mode = 'local'; UI.connecting = null; UI.view = 'serverGone';
    render();
  }

  function resetOnline() {
    stopReconnect();
    if (UI.netClient) { try { UI.netClient.close(); } catch (e) { /* noop */ } }
    clearSession();
    UI.netClient = null; UI.store = null; UI.mode = 'local';
    UI.mySeat = null; UI.roomCode = null; UI.isHost = false; UI.lobby = null;
    UI.netToken = null; UI.reconnecting = false; UI._reconnectTries = 0; UI.connecting = null;
  }
  function clearGameTimers() {
    if (UI._cpuTimer) { clearTimeout(UI._cpuTimer); UI._cpuTimer = null; }
    if (UI._autoSkipTimer) { clearTimeout(UI._autoSkipTimer); UI._autoSkipTimer = null; }
  }
  function leaveOnline() {
    clearGameTimers();
    resetOnline();
    go('home');
  }

  // 対戦を中断してTOPへ（オンラインは退室、オフラインは破棄）
  function quitToHome() {
    UI.confirm = null;
    if (UI.mode === 'online') { leaveOnline(); return; }
    clearGameTimers();
    UI.store = null; UI.mode = 'local'; UI.mySeat = null;
    go('home');
  }
  function confirmLeaveGame() {
    UI.confirm = {
      message: UI.mode === 'online' ? 'この対戦から退出してTOPに戻りますか？' : '対戦を中断してTOPに戻りますか？',
      yesLabel: 'TOPに戻る',
      onYes: quitToHome,
    };
    render();
  }
  // アクションがまだ使えるのに購入フェーズへ進もうとしたら確認する
  function endActionPhase(state, viewer) {
    const t = state.turn;
    const hasAction = t.actions > 0 && state.players[viewer].hand.some((c) => DOM.CARDS[c] && DOM.CARDS[c].types.includes('action'));
    if (hasAction) {
      UI.confirm = {
        message: 'まだアクションカードが使えます。購入フェーズに進みますか？',
        yesLabel: '購入フェーズへ進む',
        onYes: () => { UI.confirm = null; dispatch({ type: 'END_ACTION_PHASE' }); },
      };
      render();
    } else {
      dispatch({ type: 'END_ACTION_PHASE' });
    }
  }
  function viewConfirm() {
    const c = UI.confirm;
    return h('div', { class: 'modal-scrim', onclick: (e) => { if (e.target.classList.contains('modal-scrim')) { UI.confirm = null; render(); } } },
      h('div', { class: 'modal confirm-modal' },
        h('p', { class: 'confirm-msg' }, c.message),
        h('button', { class: 'btn btn-primary btn-block', onclick: c.onYes }, c.yesLabel || 'OK'),
        h('button', { class: 'btn btn-ghost btn-block', style: 'margin-top:8px', onclick: () => { UI.confirm = null; render(); } }, c.noLabel || '戻る')));
  }

  /* ---------- アクションフェーズの自動スキップ ----------
     手札にアクションカードが1枚も無ければ選択肢はゼロなので、
     少し間を置いて自動で購入フェーズへ進める（毎ターンの無駄タップをなくす）。 */
  function maybeAutoSkipAction() {
    const s = UI.store && UI.store.state;
    if (!s || s.gameOver || UI.view !== 'game' || s.pending) return;
    if (UI.sheet || UI.pickZoom || UI.confirm) return; // 何か見ている間は送らない
    if (s.turn.phase !== 'action') return;
    const actor = E().actor(s);
    const p = s.players[actor];
    if (!p || p.isCpu) return;
    // 操作者本人の画面でのみ（ローカル: パスゲート通過後 / オンライン: 自分の番）
    if (UI.mode === 'local' ? actor !== UI.localViewer : actor !== UI.mySeat) return;
    if (p.hand.some((c) => DOM.isType(c, 'action'))) return;
    if (UI._autoSkipTimer) return;
    UI._autoSkipTimer = setTimeout(() => {
      UI._autoSkipTimer = null;
      const cur = UI.store && UI.store.state;
      if (!cur || cur.gameOver || cur.pending || UI.view !== 'game') return;
      if (cur.turn.phase !== 'action') return;
      const a2 = E().actor(cur);
      if (!cur.players[a2] || cur.players[a2].isCpu) return;
      if (UI.mode === 'local' ? a2 !== UI.localViewer : a2 !== UI.mySeat) return;
      if (cur.players[a2].hand.some((c) => DOM.isType(c, 'action'))) return;
      UI.store.dispatch({ type: 'END_ACTION_PHASE' });
    }, 350);
  }

  /* ---------- 「あなたの番です」通知（バイブ＋専用音＋フラッシュ） ----------
     相手の長考中にスマホから目を離しても、自分の番が来たことに気づけるように。
     オンライン: 自分の番（民兵への対応含む）になった瞬間。
     ローカル: CPUの手番から自分に戻った瞬間のみ（パスゲートの手渡しでは鳴らさない）。 */
  function turnNoticeTick() {
    const s = UI.store && UI.store.state;
    let mine = false;
    let actorCpu = false;
    if (UI.view === 'game' && s && !s.gameOver) {
      const actor = E().actor(s);
      const p = s.players[actor];
      actorCpu = !!(p && p.isCpu);
      if (p && !p.isCpu) {
        mine = UI.mode === 'online' ? actor === UI.mySeat : actor === UI.localViewer;
      }
    }
    const was = UI._wasMyTurn;
    const prevCpu = UI._prevActorCpu;
    UI._wasMyTurn = mine;
    UI._prevActorCpu = actorCpu;
    if (!mine || was !== false) return; // false→true の遷移のみ通知
    if (UI.mode === 'local' && !prevCpu) return; // ローカルは「CPU→自分」のみ
    if (DOM.audio) DOM.audio.sfx('yourturn');
    try { if (navigator.vibrate) navigator.vibrate([120, 60, 120]); } catch (e) { /* 非対応は無視 */ }
    flashYourTurn();
  }
  function flashYourTurn() {
    const b = document.createElement('div');
    b.className = 'fx-turn-banner';
    b.textContent = '⚔ あなたの番です';
    fxLayer().appendChild(b);
    requestAnimationFrame(() => requestAnimationFrame(() => b.classList.add('go')));
    setTimeout(() => { try { b.remove(); } catch (e) { /* noop */ } }, 1500);
  }

  /* ---------- 画面スリープ防止（Wake Lock） ----------
     対戦中にスマホが自動ロックすると WebSocket が切れて「再接続中…」が出るため、
     対戦画面の間はスリープさせない（非対応環境では静かに何もしない）。 */
  function syncWakeLock() {
    try {
      const nav = (typeof navigator !== 'undefined') ? navigator : null;
      if (!nav || !nav.wakeLock || !nav.wakeLock.request) return;
      const want = UI.view === 'game' && !document.hidden;
      if (want && !UI._wakeLock && !UI._wakeLockPending) {
        UI._wakeLockPending = true;
        nav.wakeLock.request('screen').then((wl) => {
          UI._wakeLockPending = false;
          UI._wakeLock = wl;
          wl.addEventListener('release', () => { if (UI._wakeLock === wl) UI._wakeLock = null; });
          if (UI.view !== 'game') { try { wl.release(); } catch (e) { /* noop */ } }
        }).catch(() => { UI._wakeLockPending = false; });
      } else if (!want && UI._wakeLock) {
        const wl = UI._wakeLock; UI._wakeLock = null;
        try { wl.release(); } catch (e) { /* noop */ }
      }
    } catch (e) { /* 非対応環境は無視 */ }
  }

  /* ---------- フル画像の先読み ----------
     拡大表示(asset/<id>.jpg 約300KB)はタップ時に初取得だとモバイル回線で待たされる。
     対戦に入ったら手すきの時間に全カードを裏で読み込んでおく（SWがあればキャッシュにも残る）。 */
  function preloadFullArt() {
    if (UI._artPreloaded || !DOM.CARDS) return;
    UI._artPreloaded = true;
    const kick = () => {
      try {
        Object.keys(DOM.CARDS).forEach((id) => { const im = new Image(); im.src = 'asset/' + id + '.jpg'; });
      } catch (e) { /* noop */ }
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(kick, { timeout: 4000 });
    else setTimeout(kick, 1200);
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
    if (UI.view !== 'game') UI.menuOpen = false; // 対戦外ではメニューを閉じておく
    let root;
    switch (UI.view) {
      case 'home': root = viewHome(); break;
      case 'setup': root = viewSetup(); break;
      case 'onlineMenu': root = viewOnlineMenu(); break;
      case 'createRoom': root = viewCreateRoom(); break;
      case 'joinRoom': root = viewJoinRoom(); break;
      case 'connecting': root = viewConnecting(); break;
      case 'lobby': root = viewLobby(); break;
      case 'rules': root = viewRules(); break;
      case 'cardList': root = viewCardList(); break;
      case 'serverGone': root = viewServerGone(); break;
      case 'game': root = viewGameDispatch(); break;
      default: root = viewHome();
    }
    app.appendChild(root);
    // ログ欄は常に最新行が見える位置へ（全再構築で scrollTop が0に戻るため毎回合わせる）
    const logEl = app.querySelector('.log');
    if (logEl) logEl.scrollTop = logEl.scrollHeight;
    if (UI.sheet) app.appendChild(viewSheet());
    if (UI.logModal) app.appendChild(viewLogModal());
    if (UI.pickZoom) app.appendChild(viewPickZoom()); // 廃棄/獲得カードの拡大確認（最前面）
    if (UI.confirm) app.appendChild(viewConfirm());
    // 対戦中/ロビーで切断〜再接続中はオーバーレイで操作を一旦無効化
    if (UI.reconnecting && (UI.view === 'game' || UI.view === 'lobby')) app.appendChild(viewReconnectOverlay());
    if (UI.toast) app.appendChild(h('div', { class: 'toast' }, UI.toast));
    const histEl = app.querySelector('.log-history');
    if (histEl) histEl.scrollTop = histEl.scrollHeight;
    maybeRunCpu();
    maybeAutoSkipAction();
    turnNoticeTick();
    syncWakeLock();
    audioTick();
    boardFxTick();
    if (UI.view === 'game') preloadFullArt();
  }
  DOM.render = render;

  // 効果音: ゲーム中はログの更新に合わせて鳴らす。勝敗成立で勝利ファンファーレ。
  function audioTick() {
    if (!DOM.audio) return;
    const s = UI.store && UI.store.state;
    if (UI.view === 'game' && s) {
      DOM.audio.reactToLog(s.log || [], s.logSeq);
      if (s.gameOver && !UI._gameOverSounded) {
        UI._gameOverSounded = true;
        // オンラインで負けた側にはファンファーレではなく控えめな音
        const w = (s.result && s.result.winners) || [];
        if (UI.mode === 'online' && UI.mySeat != null && !w.includes(UI.mySeat)) DOM.audio.sfx('defeat');
        else DOM.audio.victory();
      }
      if (!s.gameOver) UI._gameOverSounded = false;
    } else {
      DOM.audio.resetLog();
      UI._gameOverSounded = false;
    }
  }

  /* ---------- 演出: 購入カードが捨札へ飛ぶ / アクション使用エフェクト ----------
     state差分（サプライ減・場の増加）から検知。描画後にDOM位置を取って動かす。 */
  function fxLayer() {
    let l = document.getElementById('dom-fx');
    if (!l) { l = document.createElement('div'); l.id = 'dom-fx'; document.body.appendChild(l); }
    return l;
  }
  function snapshotForFx(s) {
    const a = s.turn.active;
    return {
      supply: Object.assign({}, s.supply),
      active: a,
      inPlay: (s.players[a].inPlay || []).slice(),
      // 各プレイヤーの総枚数（山+手+捨+場）。獲得すると＋1されるので「誰が取ったか」を正確に検出できる。
      ownedLens: s.players.map((p) => (p.deck.length + p.hand.length + p.discard.length + p.inPlay.length)),
    };
  }
  function boardFxTick() {
    if (UI.view !== 'game' || !DOM.CARDS) { UI._fxSnap = null; return; }
    const s = UI.store && UI.store.state;
    if (!s || s.gameOver) { UI._fxSnap = s ? snapshotForFx(s) : null; return; }
    const cur = snapshotForFx(s);
    const prev = UI._fxSnap;
    UI._fxSnap = cur;
    if (!prev || UI.reconnecting) return;            // 初回/再接続直後は演出しない
    try { runBoardFx(prev, cur); } catch (e) { /* 演出失敗は無視 */ }
  }
  function runBoardFx(prev, cur) {
    // 1) 購入/獲得: サプライが減った山 → 総枚数が増えたプレイヤーへ「大きく見せてからデッキへ」演出
    const dec = []; let total = 0;
    for (const id in cur.supply) {
      const d = (prev.supply[id] || 0) - (cur.supply[id] || 0);
      if (d > 0) { dec.push(id); total += d; }
    }
    if (dec.length && total <= 3) {                  // 大量変化(初期配布/復元)は演出しない
      let gainer = -1, best = 0;
      for (let i = 0; i < cur.ownedLens.length; i++) {
        const g = cur.ownedLens[i] - (prev.ownedLens[i] || 0);
        if (g > best) { best = g; gainer = i; }
      }
      if (gainer < 0) gainer = cur.active;           // 廃棄＋獲得で総数不変のとき等は手番者へ
      dec.forEach((id, i) => flyGainBig(id, gainer, i));
    }
    // 2) アクション使用: 同じ手番で場(inPlay)が増え、追加がアクションなら演出
    if (prev.active === cur.active && cur.inPlay.length > prev.inPlay.length) {
      cur.inPlay.slice(prev.inPlay.length).forEach((id) => {
        const c = DOM.CARDS[id];
        if (c && c.types && c.types.includes('action')) actionCastFx(id);
      });
    }
  }
  function centerOf(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

  /* 獲得したカードを画面中央で大きく見せ、少し溜めてから、ゆっくりそのプレイヤーのデッキへ吸い込ませる。
     何を取ったかが一目で分かる。新カードで絵が無い場合はカード名（文字カード）で表示する。 */
  function flyGainBig(id, gainer, idx) {
    if (!DOM.CARDS[id]) return;
    const selfSeat = (UI.mode === 'online') ? UI.mySeat : UI.localViewer;
    const dst = (gainer === selfSeat)
      ? document.querySelector('[data-self-pile]')
      : (document.querySelector('[data-seat="' + gainer + '"]') || document.querySelector('[data-self-pile]'));
    const layer = fxLayer();
    // 複数同時獲得は少しずらして重なりを避ける
    const cx = (window.innerWidth || 360) / 2 + (idx || 0) * 18;
    const cy = (window.innerHeight || 640) * 0.42;

    const wrap = document.createElement('div');
    wrap.className = 'gain-fx';
    wrap.style.left = cx + 'px'; wrap.style.top = cy + 'px';

    const glow = document.createElement('div'); glow.className = 'gain-glow';
    const card = document.createElement('div'); card.className = 'gain-card ' + typeClass(id);
    const img = document.createElement('img'); img.className = 'gain-art'; img.src = 'asset/' + id + '.jpg'; img.alt = '';
    img.onerror = function () { this.style.display = 'none'; card.classList.add('noart'); };
    const cost = document.createElement('div'); cost.className = 'gain-cost'; cost.textContent = DOM.CARDS[id].cost;
    const fallback = document.createElement('div'); fallback.className = 'gain-fallback'; fallback.textContent = DOM.CARDS[id].name;
    const cap = document.createElement('div'); cap.className = 'gain-cap'; cap.textContent = DOM.CARDS[id].name;
    card.appendChild(img); card.appendChild(cost); card.appendChild(fallback); card.appendChild(cap);
    const note = document.createElement('div'); note.className = 'gain-note'; note.textContent = DOM.CARDS[id].name + ' を獲得！';
    wrap.appendChild(glow); wrap.appendChild(card); wrap.appendChild(note);
    layer.appendChild(wrap);

    // 出現（ふわっと大きく）
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('show')));
    // 溜めたあと、ゆっくりデッキへ
    setTimeout(() => {
      let dx = 0, dy = (window.innerHeight || 640) * 0.5;
      if (dst) { const r = dst.getBoundingClientRect(); dx = (r.left + r.width / 2) - cx; dy = (r.top + r.height / 2) - cy; }
      wrap.classList.add('go');
      wrap.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(0.16)';
      wrap.style.opacity = '0.05';
    }, 950);
    setTimeout(() => { try { wrap.remove(); } catch (e) { /* noop */ } }, 2200);
  }
  function actionCastFx(id) {
    if (!DOM.CARDS[id]) return;
    const chips = Array.prototype.slice.call(document.querySelectorAll('.play-area .chip-card'));
    const chip = chips.reverse().find((c) => c.textContent === DOM.CARDS[id].name) || chips[0];
    if (chip) { chip.classList.add('fx-cast'); setTimeout(() => chip.classList.remove('fx-cast'), 760); }
    // バーストは画面中央（盤面が縦長でも必ず見える位置）に出す
    const at = { x: (window.innerWidth || 360) / 2, y: (window.innerHeight || 640) * 0.4 };
    const burst = document.createElement('div');
    burst.className = 'fx-burst';
    burst.style.left = at.x + 'px'; burst.style.top = at.y + 'px';
    const back = document.createElement('div'); back.className = 'backdrop';
    const ring = document.createElement('div'); ring.className = 'ring';
    const lbl = document.createElement('div'); lbl.className = 'lbl'; lbl.textContent = DOM.CARDS[id].name + ' を使った！';
    burst.appendChild(back); burst.appendChild(ring); burst.appendChild(lbl);
    fxLayer().appendChild(burst);
    requestAnimationFrame(() => burst.classList.add('go'));
    setTimeout(() => { try { burst.remove(); } catch (e) { /* noop */ } }, 1080);
  }

  /* ---------- 起動 ---------- */
  function boot() {
    const params = new URLSearchParams(location.search);
    const room = params.get('room');
    if (room) {
      UI.prefillCode = room.replace(/\D/g, '').slice(0, 4); UI.view = 'joinRoom';
    } else {
      // 直前の対戦があり（猶予内）クリーンに抜けていなければ、自動で元の席へ復帰を試みる。
      const saved = loadSession();
      if (saved && saved.code && saved.token && saved.seat != null && Date.now() - (saved.ts || 0) < 15 * 60 * 1000) {
        UI.mode = 'online'; UI.roomCode = saved.code; UI.mySeat = saved.seat; UI.netToken = saved.token;
        UI.reconnecting = true; UI.view = 'game'; UI._reconnectTries = 0;
        scheduleReconnect(true);
      }
    }
    // 復帰イベントで即再接続（スマホのロック解除/タブ復帰/ネット復帰）
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('online', onResumeTrigger);
      window.addEventListener('focus', onResumeTrigger);
      window.addEventListener('pageshow', onResumeTrigger);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) { onResumeTrigger(); syncWakeLock(); } });
    }
    // 最初のタップで音声を解禁（ブラウザの自動再生制限対策）。BGMがオンなら開始。
    if (DOM.audio && typeof document.addEventListener === 'function') {
      const unlock = () => {
        DOM.audio.unlock();
        if (DOM.audio.isBgm()) DOM.audio.startBgm();
        document.removeEventListener('pointerdown', unlock);
        document.removeEventListener('click', unlock);
      };
      document.addEventListener('pointerdown', unlock);
      document.addEventListener('click', unlock);
    }
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
