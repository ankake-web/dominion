/* ============================================================
   ドミニオン — UI（画面描画とタップ操作）
   ============================================================ */
(function () {
  const DOM = (window.DOM = window.DOM || {});
  const E = () => DOM.engine;
  const LEVEL_JP = { easy: '弱', normal: '普通', hard: '強' };

  /* ---------- ランダムな初期名（世界観に合う領主名） ---------- */
  // 「あなた／対戦相手」だと盛り下がるので、入力欄の初期値をランダムな名前にする。
  const NAME_POOL = [
    'アルヴィス', 'セシリア', 'ガウェイン', 'イザベラ', 'ロドリク', 'エルザ', 'コンラート', 'フィオナ',
    'レオンハルト', 'マルグリット', 'ダリウス', 'ヴィオラ', 'ジークフリート', 'アデル', 'テオドール',
    'ミレーユ', 'ラインハルト', 'ユーフェミア', 'ギルベルト', 'ソフィア', 'エドガー', 'リーゼロット',
    'フェルナン', 'カトリーヌ', 'オズワルド', 'クラリス', 'バルトロ', 'ブリジット', 'ヴァレリー', 'ノエル',
  ];
  // CPUは少しキャラ立ちした称号つきの名前で（盤面では🤖も付く）。
  const CPU_NAME_POOL = [
    '鉄腕のゴラン', '賢者エルミ', '守銭奴バルト', '策士リオン', '黄金のドレイク', '辺境伯ノルド',
    '魔女セルマ', '女王アデル', '隠者カイル', '豪商メルカ', '騎士団長グレイ', '占星術師ニナ',
  ];
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
    return h('div', { class: cls, onclick: opts.onClick, 'data-pile': id },
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
        h('button', { class: 'btn btn-primary btn-block', onclick: () => go('setup') }, '対戦をはじめる'),
        h('button', { class: 'btn btn-block', onclick: () => go('localSetup') }, '1台で2人プレイ（クイック）'),
        h('button', { class: 'btn btn-block', onclick: () => go('onlineMenu') }, 'オンラインで対戦（2台）'),
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
    let n1 = defaultName('p1'), n2 = defaultName('p2', NAME_POOL, 'p1');
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
      h('button', { class: 'home-btn', title: 'TOPに戻る', onclick: () => confirmLeaveGame() }, '🏠'),
      DOM.audio ? h('button', { class: 'home-btn', title: 'BGM切替', onclick: toggleBgm }, DOM.audio.isBgm() ? '🎵' : '🔇') : null,
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
      h('div', { class: 'zone-h' }, h('span', { class: 't' }, me.name + ' の手札'),
        h('span', { class: 'c', 'data-self-pile': '1' }, '山' + me.deck.length + '・捨' + me.discard.length + '・手' + me.hand.length)),
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
  function leaveOnline() {
    if (UI._cpuTimer) { clearTimeout(UI._cpuTimer); UI._cpuTimer = null; }
    resetOnline();
    go('home');
  }

  // 対戦を中断してTOPへ（オンラインは退室、オフラインは破棄）
  function quitToHome() {
    UI.confirm = null;
    if (UI.mode === 'online') { leaveOnline(); return; }
    if (UI._cpuTimer) { clearTimeout(UI._cpuTimer); UI._cpuTimer = null; }
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
  function viewConfirm() {
    const c = UI.confirm;
    return h('div', { class: 'modal-scrim', onclick: (e) => { if (e.target.classList.contains('modal-scrim')) { UI.confirm = null; render(); } } },
      h('div', { class: 'modal confirm-modal' },
        h('p', { class: 'confirm-msg' }, c.message),
        h('button', { class: 'btn btn-primary btn-block', onclick: c.onYes }, c.yesLabel || 'OK'),
        h('button', { class: 'btn btn-ghost btn-block', style: 'margin-top:8px', onclick: () => { UI.confirm = null; render(); } }, 'つづける')));
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
      case 'connecting': root = viewConnecting(); break;
      case 'lobby': root = viewLobby(); break;
      case 'rules': root = viewRules(); break;
      case 'cardList': root = viewCardList(); break;
      case 'serverGone': root = viewServerGone(); break;
      case 'game': root = viewGameDispatch(); break;
      default: root = viewHome();
    }
    app.appendChild(root);
    if (UI.sheet) app.appendChild(viewSheet());
    if (UI.confirm) app.appendChild(viewConfirm());
    // 対戦中/ロビーで切断〜再接続中はオーバーレイで操作を一旦無効化
    if (UI.reconnecting && (UI.view === 'game' || UI.view === 'lobby')) app.appendChild(viewReconnectOverlay());
    if (UI.toast) app.appendChild(h('div', { class: 'toast' }, UI.toast));
    maybeRunCpu();
    audioTick();
    boardFxTick();
  }
  DOM.render = render;

  // 効果音: ゲーム中はログの更新に合わせて鳴らす。勝敗成立で勝利ファンファーレ。
  function audioTick() {
    if (!DOM.audio) return;
    const s = UI.store && UI.store.state;
    if (UI.view === 'game' && s) {
      DOM.audio.reactToLog(s.log || []);
      if (s.gameOver && !UI._gameOverSounded) { UI._gameOverSounded = true; DOM.audio.victory(); }
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
      discardLens: s.players.map((p) => (p.discard ? p.discard.length : 0)),
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
    // 1) 購入/獲得: サプライが減った山 → 捨札が増えた人へカードが飛ぶ
    const dec = []; let total = 0;
    for (const id in cur.supply) {
      const d = (prev.supply[id] || 0) - (cur.supply[id] || 0);
      if (d > 0) { dec.push(id); total += d; }
    }
    if (dec.length && total <= 3) {                  // 大量変化(初期配布/復元)は演出しない
      let buyer = -1, best = 0;
      for (let i = 0; i < cur.discardLens.length; i++) {
        const g = cur.discardLens[i] - (prev.discardLens[i] || 0);
        if (g > best) { best = g; buyer = i; }
      }
      if (buyer < 0) buyer = cur.active;
      dec.forEach((id) => flyPurchase(id, buyer));
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
  function flyPurchase(id, buyer) {
    const src = document.querySelector('[data-pile="' + id + '"]');
    const dst = document.querySelector('[data-seat="' + buyer + '"]') || document.querySelector('[data-self-pile]');
    if (!src || !dst || !DOM.CARDS[id]) return;
    const a = centerOf(src), b = centerOf(dst);
    const fly = document.createElement('div');
    fly.className = 'fly-card ' + typeClass(id);
    const img = document.createElement('img'); img.src = 'assets/' + id + '.jpg'; img.alt = '';
    img.onerror = function () { this.style.display = 'none'; };
    const nm = document.createElement('div'); nm.className = 'fln'; nm.textContent = DOM.CARDS[id].name;
    fly.appendChild(img); fly.appendChild(nm);
    fly.style.left = (a.x - 32) + 'px'; fly.style.top = (a.y - 45) + 'px';
    fxLayer().appendChild(fly);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fly.style.transform = 'translate(' + (b.x - a.x) + 'px,' + (b.y - a.y) + 'px) scale(.3) rotate(7deg)';
      fly.style.opacity = '0.12';
    }));
    setTimeout(() => { try { fly.remove(); } catch (e) { /* noop */ } }, 720);
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
      document.addEventListener('visibilitychange', () => { if (!document.hidden) onResumeTrigger(); });
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
