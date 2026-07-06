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
  // 一度入力した自分の名前は端末に記憶し、部屋を作り直しても保持する。
  const MYNAME_KEY = 'dominion-myname';
  function loadMyName() { try { return (localStorage.getItem(MYNAME_KEY) || '').trim(); } catch (e) { return ''; } }
  function saveMyName(v) { v = (v || '').trim(); try { if (v) localStorage.setItem(MYNAME_KEY, v); } catch (e) { /* noop */ } }
  function defaultName(key, pool, excludeKey) {
    const saved = loadMyName();
    if (saved) return saved; // 記憶済みの名前を優先（リセットされない）
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

  /* ---------- 初心者モード（☰メニューでON/OFF・端末ごとに記憶。既定ON） ---------- */
  const BEGINNER_KEY = 'dominion-beginner';
  function loadBeginner() {
    try { const v = localStorage.getItem(BEGINNER_KEY); return v == null ? true : v === '1'; }
    catch (e) { return true; }
  }
  UI.beginner = loadBeginner();
  function setBeginner(v) {
    UI.beginner = !!v;
    try { localStorage.setItem(BEGINNER_KEY, v ? '1' : '0'); } catch (e) { /* noop */ }
    render();
  }

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
  const TYPE_JP = { treasure: '財宝', victory: '勝利点', curse: '呪い', action: 'アクション', attack: 'アタック', reaction: 'リアクション',
    duration: '持続', command: '命令', knight: '騎士', ruins: '廃墟', shelter: '避難所', reserve: 'リザーブ', traveller: 'トラベラー', castle: '城' };
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
  // 錬金術：ポーション費用（コスト円の下に紫のポーション記号で出る費用。コイン軽減では下がらない）。
  function potCost(id) { return (DOM.CARDS[id] && DOM.CARDS[id].potion) || 0; }
  // コイン・ポーション・繁栄の制約を全て満たして「いま買える」か。
  function affordable(state, id) {
    const t = state.turn;
    return effCost(state, id) <= t.coins && potCost(id) <= (t.potions || 0) &&
      (!E() || !E().canBuyCard || E().canBuyCard(state, t.active, id));
  }
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

  // 公開（reveal）ストリップ: 役人・密偵・泥棒・貢物・願いの井戸・斥候などで「表向きにされたカード」を
  // 実際の画像で大きく見せる。自分の盤面に変化が出ない公開（相手の山札の上に置く等）は、これが無いと
  // 「何も起きていない」ように見えるため。直近の公開だけを board-head（常時表示の上部）に出す。
  // 席ごとの公開バッジ：その席に公開があれば、表向きカードのミニ画像＋枚数を返す。
  // 直近に公開された席だけ点滅させて気づけるようにする（無関係な再描画では光らせない）。
  function revealBadge(state, seat) {
    const r = state && state.reveals && state.reveals[seat];
    if (!r || !r.cards || !r.cards.length) return null;
    const isNew = state.revealLatest === seat && state.revealSeq !== UI.lastRevealSeq;
    if (isNew) UI.lastRevealSeq = state.revealSeq;
    const id = r.cards[0];
    const def = DOM.CARDS[id] || { name: id };
    return h('div', { class: 'reveal-badge' + (isNew ? ' flash' : '') },
      h('span', { class: 'reveal-eye' }, '👁'),
      h('img', { class: 'reveal-badge-img', src: 'asset/cards/' + id + '.webp', alt: def.name,
        onerror: function () { this.style.display = 'none'; } }),
      r.cards.length > 1 ? h('span', { class: 'reveal-badge-n' }, '×' + r.cards.length) : null);
  }
  function openReveal(seat) { UI.revealView = seat; sfx('tap'); render(); }
  // 公開カードの一覧ポップアップ（その席が公開した全カードを画像で）
  function viewRevealModal() {
    const state = UI.store && UI.store.state;
    const seat = UI.revealView;
    const r = state && state.reveals && state.reveals[seat];
    const p = state && state.players && state.players[seat];
    if (!r || !p) { UI.revealView = null; return null; }
    const close = () => { UI.revealView = null; render(); };
    return h('div', { class: 'scrim', onclick: (e) => { if (e.target.classList.contains('scrim')) close(); } },
      h('div', { class: 'sheet reveal-modal' },
        h('button', { class: 'sheet-close', 'aria-label': '閉じる', onclick: close }, '✕'),
        h('div', { class: 'reveal-head' }, '👁 ' + p.name + '：' + (r.note || '公開')),
        h('div', { class: 'reveal-cards' }, r.cards.map((id) => {
          const def = DOM.CARDS[id] || { name: id };
          return h('div', { class: 'reveal-card' },
            h('img', { class: 'reveal-img', src: 'asset/cards/' + id + '.webp', alt: def.name,
              onerror: function () { this.style.display = 'none'; if (this.parentElement) this.parentElement.classList.add('art-failed'); } }),
            h('div', { class: 'reveal-name' }, def.name));
        })),
        h('button', { class: 'btn btn-ghost btn-block', style: 'margin-top:10px', onclick: close }, 'とじる')));
  }
  // アクセシビリティ：クリックできるカード/山をスクリーンリーダー＆キーボードでも操作できるようにする。
  function activateKey(fn) { return (e) => { if (fn && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fn(e); } }; }
  function a11yBtn(props, onClick, label) {
    if (!onClick) return props;
    props.role = 'button'; props.tabindex = '0'; if (label) props['aria-label'] = label; props.onkeydown = activateKey(onClick);
    return props;
  }
  function cardArt(id) {
    // 盤面（手札・サプライ）は軽量サムネを使う。拡大表示だけフル画像。
    // eager + async decode で「スマホでカードが表示されない」を防ぐ（サムネは軽いので一括読込でOK）。
    return h('img', {
      class: 'card-art', src: 'asset/cards/' + id + '.webp', alt: DOM.CARDS[id].name, decoding: 'async',
      onerror: function () { this.style.display = 'none'; if (this.parentElement) this.parentElement.classList.add('art-failed'); },
    });
  }

  // 手札・一覧用カード。opts: {onClick, count, size('lg'|'sm'), dim, badge}
  function cardEl(id, opts) {
    opts = opts || {};
    const c = DOM.CARDS[id];
    // 未知id（'back'=伏せ札 等）は伏せカードのプレースホルダで描画し、render 全体の巻き込みクラッシュを防ぐ（防御）。
    if (!c) {
      return h('div', a11yBtn({ class: 'card has-art facedown ' + (opts.size === 'sm' ? 'sm ' : '') + (opts.extra ? opts.extra : ''), onclick: opts.onClick }, opts.onClick, '伏せ札'),
        h('div', { class: 'cname' }, '？'));
    }
    const cls = 'card has-art ' + (opts.size === 'sm' ? 'sm ' : '') + typeClass(id) +
      (c.types.includes('attack') ? ' attack-mark' : '') + (opts.dim ? ' dim' : '') +
      (opts.extra ? ' ' + opts.extra : '');
    const aria = c.name + '、コスト' + c.cost + (potCost(id) ? '＋ポーション' : '') +
      (opts.count && opts.count > 1 ? '、' + opts.count + '枚' : '') + '、' + typeLabel(id);
    return h('div', a11yBtn({ class: cls, onclick: opts.onClick }, opts.onClick, aria),
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
    // 暗黒時代：騎士は混合山＝一番上の実騎士（state.knights[0]）を表示する（購入対象は 'knights' のまま）。
    const isKnightPile = id === 'knights' && Array.isArray(state.knights) && state.knights.length > 0;
    const dispId = isKnightPile ? state.knights[0] : id;
    const c = DOM.CARDS[dispId] || DOM.CARDS[id];
    const n = state.supply[id] || 0;
    const ec = effCost(state, id);
    const cls = 'pile has-art ' + (opts.size === 'sm' ? 'sm ' : '') + typeClass(dispId) +
      (n <= 0 ? ' empty' : '') + (opts.buyable ? ' buyable' : '') + (opts.gainable ? ' gainable' : '') +
      (opts.recommended ? ' recommended' : '') +
      (ec < c.cost ? ' discounted' : '');
    const aria = c.name + (isKnightPile ? '（騎士の山の一番上）' : '') + '、コスト' + ec + (potCost(id) ? '＋ポーション' : '') + '、残り' + n + '枚' + (opts.recommended ? '、おすすめ' : '');
    return h('div', a11yBtn({ class: cls, onclick: opts.onClick, 'data-pile': id }, opts.onClick, aria),
      h('div', { class: 'pcost' }, ec),
      h('div', { class: 'pname' }, c.name),
      cardArt(dispId),
      opts.recommended ? h('div', { class: 'rec-badge' }, 'おすすめ') : null,
      h('div', { class: 'pile-count' + (n <= 2 ? ' lo' : n <= 5 ? ' mid' : '') }, '残' + n)
    );
  }

  // 暗黒時代：廃墟の山（混合山・購入不可）。一番上の実廃墟の絵/名前と残枚数を表示（クリック不可）。
  function ruinsPileEl(state) {
    const top = state.ruins[0];
    const c = DOM.CARDS[top] || { name: '廃墟', cost: 0 };
    const n = state.ruins.length;
    return h('div', { class: 'pile has-art sm ' + typeClass(top) + (n <= 0 ? ' empty' : ''),
      'aria-label': c.name + '（廃墟の山の一番上）、残り' + n + '枚' },
      h('div', { class: 'pcost' }, 0),
      h('div', { class: 'pname' }, c.name),
      cardArt(top),
      h('div', { class: 'pile-count' + (n <= 2 ? ' lo' : n <= 5 ? ' mid' : '') }, '残' + n));
  }

  /* ---------- 共通操作 ---------- */
  function go(view) { UI.view = view; UI.sheet = null; UI.logModal = false; UI.revealView = null; render(); }
  function dispatch(action) { UI.sheet = null; UI.store.dispatch(action); }
  function closeSheet() { UI.sheet = null; render(); }
  function showSheet(cardId, primary) { UI.sheet = { cardId, primary }; sfx('tap'); render(); }
  // カード説明(sheet)は #sheet-host に常駐させ、同じ表示要求の間は作り直さない。
  // これで他人の行動などで盤面が再描画されても、スクロール位置とカード画像が保たれる
  // （毎回作り直すと画像の読込前に scrollTop が0付近へクランプされ、位置が飛んでいた）。
  function syncSheet() {
    let host = document.getElementById('sheet-host');
    if (!UI.sheet) { if (host) host.remove(); return; }
    if (!host) { host = document.createElement('div'); host.id = 'sheet-host'; document.body.appendChild(host); }
    if (host._sheetRef === UI.sheet) return; // 同じ表示要求＝作り直さない（スクロール保持）
    host.innerHTML = '';
    host.appendChild(viewSheet());
    host._sheetRef = UI.sheet;
  }
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

  // 王国カードのセット選択。上段に4分類のセグメント（王国基本／陰謀／おすすめ／ランダム）、
  // 「おすすめ」を選んだときだけテーマ別タイル、「ランダム」のときだけ抽選元チップを出す。
  // current は CARD_SETS の id。onChange(newId) で確定（ローカルは setup に保存、オンラインはサーバへ送信）。
  function kingdomSetPicker(current, onChange) {
    current = current || 'basic';
    const sets = DOM.CARD_SETS || [];
    const byId = (id) => sets.find((s) => s.id === id);
    const cur = byId(current) || byId('basic');
    const recommend = sets.filter((s) => s.kind === 'recommend');
    const randoms = sets.filter((s) => s.kind === 'random');
    // 現在のトップ分類
    let top = 'basic';
    if (cur.id === 'intrigue') top = 'intrigue';
    else if (cur.kind === 'recommend') top = 'recommend';
    else if (cur.kind === 'random') top = 'random';
    // 分類を切り替えたときに飛ぶ既定ID
    const defaults = { basic: 'basic', intrigue: 'intrigue', recommend: (recommend[0] || {}).id, random: 'random' };
    const topSeg = segmented(
      [{ value: 'basic', label: '王国基本' }, { value: 'intrigue', label: '陰謀' },
       { value: 'recommend', label: 'おすすめ' }, { value: 'random', label: 'ランダム' }],
      top, (v) => { if (v !== top) onChange(defaults[v]); }, 'set-top-seg');

    let sub = null;
    if (top === 'recommend') {
      sub = h('div', { class: 'set-tiles' }, recommend.map((s) =>
        h('button', { class: 'set-tile' + (s.id === current ? ' on' : ''), onclick: () => onChange(s.id) },
          h('div', { class: 'set-tile-name' }, s.name),
          h('div', { class: 'set-tile-desc' }, s.desc || ''))));
    } else if (top === 'random') {
      sub = h('div', { class: 'set-sub' },
        segmented(randoms.map((s) => ({ value: s.id, label: s.name.replace('から', '') })), current, (v) => onChange(v)),
        h('p', { class: 'muted set-note' }, '毎回ランダムに10種を選びます。'));
    }
    // 固定セットは収録カード名をプレビュー
    const preview = cur.kingdom
      ? h('p', { class: 'muted set-note' }, '収録：' + cur.kingdom.map((id) => (DOM.CARDS[id] ? DOM.CARDS[id].name : id)).join('・'))
      : null;
    return h('div', { class: 'set-picker' }, topSeg, sub, preview);
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
    const inp = h('input', { type: 'text', value: name, oninput: (e) => { name = e.target.value; saveMyName(name); } });
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
    const ni = h('input', { type: 'text', value: name, oninput: (e) => { name = e.target.value; saveMyName(name); } });
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

    // 王国セット名・手番順の表示用（ゲストの読み取り専用表示に使う）
    const setName = (() => {
      const id = (lb && lb.kingdomSet) || 'basic';
      const s = (DOM.CARD_SETS || []).find((x) => x.id === id);
      return s ? s.name : id;
    })();
    const orderLabel = (lb && lb.randomOrder === false) ? '上から順' : 'ランダム';

    let controls;
    if (lb && UI.isHost) {
      controls = h('div', { class: 'lobby-host' },
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
        h('div', { class: 'field' },
          h('label', null, '手番の順番'),
          segmented([{ value: false, label: '上から順' }, { value: true, label: 'ランダム' }],
            lb.randomOrder !== false, (v) => UI.netClient.send({ t: 'setConfig', randomOrder: v }))),
        h('button', { class: 'btn btn-primary btn-block', disabled: lb.canStart ? null : 'disabled', onclick: () => UI.netClient.send({ t: 'start' }) },
          lb.canStart ? 'ゲーム開始' : '人間1人以上・合計2〜4人で開始'));
    } else if (lb) {
      // ゲスト：ホストと同じ項目を読み取り専用で表示（設定変更はホストのみ）
      controls = h('div', { class: 'lobby-host lobby-readonly' },
        h('div', { class: 'field' }, h('label', null, 'CPUの人数'), h('div', { class: 'readonly-val' }, String(lb.cpuCount))),
        h('div', { class: 'field' }, h('label', null, 'CPUの強さ'), h('div', { class: 'readonly-val' }, LEVEL_JP[lb.cpuLevel || 'normal'])),
        h('div', { class: 'field' }, h('label', null, '使う王国カード'), h('div', { class: 'readonly-val' }, setName)),
        h('div', { class: 'field' }, h('label', null, '手番の順番'), h('div', { class: 'readonly-val' }, orderLabel)),
        h('p', { class: 'muted', style: 'text-align:center;margin-top:2px' }, 'ホストの開始を待っています…（設定の変更はホストのみ）'));
    } else {
      controls = h('p', { class: 'muted', style: 'text-align:center' }, 'ホストの開始を待っています…');
    }

    // 初心者モードは各自の端末ごとの表示設定。ホスト・ゲストともこのロビーで切替できる。
    const beginnerField = h('div', { class: 'field' },
      h('label', null, '🔰 初心者モード（あなたの画面だけ）'),
      segmented([{ value: true, label: 'オン' }, { value: false, label: 'オフ' }],
        UI.beginner, (v) => { setBeginner(v); render(); }));

    return h('div', { class: 'home lobby' },
      h('h2', null, '待機ロビー'),
      h('p', { class: 'muted', style: 'font-size:13px' }, 'コードまたは参加リンクを相手に送ってください'),
      h('div', { class: 'code-display' }, UI.roomCode || '----'),
      h('button', { class: 'btn btn-block', onclick: () => copy(link) }, '参加用リンクをコピー'),
      h('div', { class: 'panel', style: 'gap:14px' }, list, controls, beginnerField),
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
      group('王国カード（基本・第二版）', byCost((DOM.POOLS && DOM.POOLS.basic) || DOM.KINGDOM)),
      group('王国カード（陰謀・第二版）', byCost((DOM.POOLS && DOM.POOLS.intrigue) || [])),
      (DOM.POOLS && DOM.POOLS.seaside) ? group('王国カード（海辺・第二版）', byCost(DOM.POOLS.seaside)) : null,
      (DOM.POOLS && DOM.POOLS.alchemy) ? group('王国カード（錬金術・第二版）', byCost(DOM.POOLS.alchemy)) : null,
      (DOM.POOLS && DOM.POOLS.prosperity) ? group('王国カード（繁栄・第二版）', byCost(DOM.POOLS.prosperity)) : null,
      (DOM.POOLS && DOM.POOLS.cornucopia) ? group('王国カード（収穫祭）', byCost(DOM.POOLS.cornucopia)) : null,
      (DOM.POOLS && DOM.POOLS.prizes) ? group('賞品（褒賞・馬上槍試合）', byCost(DOM.POOLS.prizes)) : null,
      (DOM.POOLS && DOM.POOLS.guilds) ? group('王国カード（ギルド）', byCost(DOM.POOLS.guilds)) : null,
      (DOM.POOLS && DOM.POOLS.hinterlands) ? group('王国カード（異郷）', byCost(DOM.POOLS.hinterlands)) : null,
      (DOM.POOLS && DOM.POOLS.darkages) ? group('王国カード（暗黒時代）', byCost(DOM.POOLS.darkages)) : null,
      (DOM.POOLS && DOM.POOLS.knights) ? group('騎士（暗黒時代）', byCost(DOM.POOLS.knights)) : null,
      (DOM.POOLS && DOM.POOLS.ruins) ? group('廃墟（暗黒時代）', byCost(DOM.POOLS.ruins)) : null,
      (DOM.POOLS && DOM.POOLS.shelters) ? group('避難所（暗黒時代）', byCost(DOM.POOLS.shelters)) : null,
      (DOM.POOLS && DOM.POOLS.darkages_np) ? group('非サプライ（戦利品・狂人・傭兵）', byCost(DOM.POOLS.darkages_np)) : null,
      (DOM.POOLS && DOM.POOLS.adventures) ? group('王国カード（冒険・画像のみ）', byCost(DOM.POOLS.adventures)) : null,
      (DOM.POOLS && DOM.POOLS.empires) ? group('王国カード（帝国・画像のみ）', byCost(DOM.POOLS.empires)) : null,
      (DOM.POOLS && DOM.POOLS.promo) ? group('プロモカード', byCost(DOM.POOLS.promo)) : null,
      (DOM.POOLS && DOM.POOLS.basic1e) ? group('初版のみ（第二版で廃止）', byCost(
        DOM.POOLS.basic1e.filter((id) => DOM.POOLS.basic.indexOf(id) < 0)
          .concat(DOM.POOLS.intrigue1e.filter((id) => DOM.POOLS.intrigue.indexOf(id) < 0)))) : null
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
    // interactive は actor===viewer（＝この保留の決定者。支配中は支配者に委譲済み）を意味するので、
    // pending があれば必ずこの人が解決する。旧来の pending.player===viewer 判定は支配で詰むため撤廃。
    if (interactive && state.pending) {
      frag.appendChild(viewPendingModal(state, state.pending));
    }
    // ギルド：財源を使うオーバーレイ（pending ではない。購入フェイズ・自分の操作中のみ）。
    if (interactive && UI.coffersOpen && !state.pending && state.turn.phase === 'buy' && state.turn.active === viewer) {
      frag.appendChild(modalCoffersSpend(state, viewer));
    } else if (UI.coffersOpen) {
      UI.coffersOpen = false; // 条件を満たさなくなったら閉じる（フェイズ移行など）
    }
    return frag;
  }

  function phaseLabel(ph) { return ph === 'action' ? 'アクション フェーズ' : '購入 フェーズ'; }
  // ギルド：財源(Coffers)を使う王国か（財源を付与するカードが王国にあれば財源バッジ/使用ボタンを出す）。
  const COFFERS_CARDS = ['candlestick_maker', 'plaza', 'baker', 'butcher', 'merchant_guild'];
  function usesCoffers(kingdom) { return (kingdom || []).some((id) => COFFERS_CARDS.includes(id)); }

  /* ---------- 初心者モードの支援（案内・おすすめ買い物・カードのやさしい説明） ---------- */
  // 今のコインで買える中から、序盤に強い財宝＆勝ち筋を提案（盤面で黄色枠ハイライト）。
  function recommendedBuys(state) {
    const t = state.turn;
    if (t.phase !== 'buy' || t.buys <= 0) return [];
    const can = (id) => (state.supply[id] || 0) > 0 && effCost(state, id) <= t.coins && potCost(id) <= (t.potions || 0);
    const recs = [];
    if (can('colony')) recs.push('colony');       // 繁栄：植民地(10点)が買えるなら最優先
    if (can('province')) recs.push('province');
    if (can('platinum')) recs.push('platinum');   // 繁栄：プラチナ貨（強い財宝）
    if (can('gold')) recs.push('gold');
    else if (can('silver')) recs.push('silver');
    return recs;
  }
  // 画面下の操作と連動した「今やること」の一文。null なら出さない。
  function coachHint(state, viewer, interactive) {
    if (!interactive || state.pending) return null;
    const t = state.turn;
    // 支配中は操作対象＝被支配者(t.active)の手札を案内する（支配者自身の手札を見て誤誘導しない）。
    const me = (t.possessedBy != null && t.possessedBy === viewer) ? state.players[t.active] : state.players[viewer];
    if (t.phase === 'action') {
      const playable = t.actions > 0 && me.hand.some((c) => DOM.CARDS[c].types.includes('action'));
      return playable
        ? '🔰 アクションフェーズ：光っているアクションカードをタップして使えます（残り ' + t.actions + '）。終わったら「購入フェーズへ ▶」。'
        : '🔰 使えるアクションはありません。「購入フェーズへ ▶」で買い物に進みましょう。';
    }
    const hasTreasure = me.hand.some((c) => DOM.CARDS[c].types.includes('treasure'));
    if (hasTreasure) return '🔰 購入フェーズ：まず「財宝を全部出す」でコインを出しましょう。';
    if (t.buys > 0) {
      const recs = recommendedBuys(state);
      return recs.length
        ? '🔰 コイン' + t.coins + '・購入' + t.buys + '回。おすすめ＝' + recs.map((id) => DOM.CARDS[id].name).join('・') + '（黄色の枠）。買ったら「ターンを終える」。'
        : '🔰 コイン' + t.coins + '・購入' + t.buys + '回。買えるものを選ぶか「ターンを終える」。';
    }
    return '🔰 「ターンを終える」を押して相手の番にしましょう。';
  }
  // カードごとのやさしい一言。未登録は種別から自動で補う（全カード何かしら出る）。
  const TIPS = {
    copper: '基本の財宝。購入フェーズに出すと +1コイン。',
    silver: '序盤に増やしたい財宝。+2コイン。',
    gold: '強い財宝。+3コイン。買えるなら優先したい。',
    estate: '勝利点1。手札では使えないが、終了時に点になる。',
    duchy: '勝利点3。中盤以降に集めたい。',
    province: '勝利点6。これを買い集めると勝ちに近づく。',
    curse: '−1点の邪魔カード。基本は持ちたくない。',
    cellar: '+1アクション。いらない手札を捨てて同じ枚数引き直せる＝事故を減らせる。',
    chapel: 'いらないカードを最大4枚廃棄。デッキを薄くして強い札を引きやすくする。',
    village: '+1カード +2アクション。続けて他のアクションを使うための土台。',
    market: '+1カード +1アクション +1購入 +1コインの万能札。迷ったら強い。',
    smithy: '+3カード。手札を一気に厚くしたいときに。',
    woodcutter: '+1購入 +2コイン。1ターンに2枚買いたいとき。',
    laboratory: '+2カード +1アクション。手札が減らず引ける優秀札。',
    festival: '+2アクション +1購入 +2コイン。場を回しつつ買い物も。',
    moneylender: '銅貨1枚を廃棄して +3コイン。序盤の銅貨整理に。',
    militia: 'アタック。+2コインし、相手は手札を3枚まで捨てる。',
    witch: 'アタック。+2カードし、相手に呪い（−1点）を配る強力札。',
    moat: '+2カード。相手のアタックを受けたとき手札から見せると防げる。',
    mine: '財宝を1枚廃棄して、より高い財宝に持ち替えられる（銅貨→銀貨など）。',
    remodel: '手札1枚を廃棄して、+2コストまでのカードを獲得。札の入れ替えに。',
    workshop: 'コスト4以下を1枚ただで獲得。序盤の戦力補充に。',
    throne_room: 'アクション1枚を2回使える。強いアクションと組むと爆発的。',
    council_room: '+4カード +1購入。引きが一気に増える（相手も1枚引く）。',
    library: '手札が7枚になるまで引く。手札が少ないときに。',
    gardens: 'デッキ10枚ごとに1点。カードを多く買う作戦向け。',
    chancellor: '+2コイン。山札を一気に捨て札にして引き直しを早められる。',
    adventurer: '財宝が2枚出るまで山札をめくって手札に。コインを確保。',
    feast: 'このカードを廃棄して、コスト5以下を1枚獲得。',
    bureaucrat: 'アタック。銀貨を山札の上に得て、相手は勝利点を山札の上に戻す。',
    nobles: '勝利点2。使うと +3カード か +2アクションを選べる。',
    harem: '+2コインの財宝で、勝利点2も兼ねるお得カード。',
    great_hall: '+1カード +1アクションで、勝利点1も付く。',
  };
  function beginnerTip(id) {
    if (TIPS[id]) return TIPS[id];
    const ty = DOM.CARDS[id].types;
    if (ty.includes('attack')) return 'アタックカード。アクションフェーズに使うと相手を妨害できる。';
    if (ty.includes('reaction')) return 'リアクション。相手のアタック時に手札から見せて身を守れることがある。';
    if (ty.includes('treasure')) return '財宝カード。購入フェーズに出すとコインになる。';
    if (ty.includes('action')) return 'アクションカード。アクションフェーズに使う（+アクションがあれば続けて使える）。';
    if (ty.includes('victory')) return '勝利点カード。手札では使えないが、終了時に点数になる。';
    if (ty.includes('curse')) return '−1点。できれば避けたい。';
    return '';
  }

  // ハンバーガーメニュー（ホーム・BGM・効果音をまとめる）
  function viewTopMenu() {
    const items = [
      h('button', { class: 'menu-item', onclick: () => { UI.menuOpen = false; confirmLeaveGame(); } }, '🏠　TOPに戻る'),
      h('button', { class: 'menu-item' + (UI.beginner ? ' on' : ''), onclick: () => { UI.menuOpen = false; setBeginner(!UI.beginner); } },
        '🔰　初心者モード：' + (UI.beginner ? 'オン' : 'オフ')),
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
    // 錬金術・支配：自分が支配者としてこの被支配ターンを操作しているか。
    // その場合、手札・場・マット・点数の表示は「操作対象（被支配者=手番のactive）」のものにする。
    const possessing = t.possessedBy != null && t.possessedBy === viewer;
    const handP = possessing ? active : me;

    const top = h('div', { class: 'topbar' },
      h('div', { class: 'menu-wrap' },
        h('button', { class: 'menu-btn', title: 'メニュー', 'aria-label': 'メニュー', onclick: () => { UI.menuOpen = !UI.menuOpen; render(); } }, '☰'),
        UI.menuOpen ? viewTopMenu() : null),
      h('div', { class: 'turn-tag' },
        h('div', { class: 'who' }, active.name + ' の番' + (active.isCpu ? '（CPU・' + LEVEL_JP[active.cpuLevel] + '）' : '')),
        h('div', { class: 'phase' }, phaseLabel(t.phase))),
      h('div', { class: 'resources' },
        h('div', { class: 'badge act' }, h('div', { class: 'v' }, t.actions), h('div', { class: 'k' }, 'ACTION')),
        h('div', { class: 'badge buy' }, h('div', { class: 'v' }, t.buys), h('div', { class: 'k' }, 'BUY')),
        h('div', { class: 'badge coin' }, h('div', { class: 'v' }, t.coins), h('div', { class: 'k' }, 'COIN')),
        // 錬金術：ポーションが供給される王国のときだけ POTION 量を表示（紫）。
        state.supply.potion != null
          ? h('div', { class: 'badge potion', style: 'background:#6b3fa0' }, h('div', { class: 'v' }, t.potions || 0), h('div', { class: 'k' }, 'POTION'))
          : null,
        // ギルド：財源(Coffers)を使う王国のときだけ COFFERS を表示（金色）。手番プレイヤーの財源を出す。
        usesCoffers(state.kingdom)
          ? h('div', { class: 'badge coffers', style: 'background:#b8860b' }, h('div', { class: 'v' }, active.coffers || 0), h('div', { class: 'k' }, '財源'))
          : null)
    );

    // 他プレイヤー（複数対応）
    const others = state.players.map((p, i) => i).filter((i) => i !== viewer);
    const othersStrip = h('div', { class: 'others' },
      others.map((i) => {
        const p = state.players[i];
        const isAct = i === t.active;
        const hasReveal = state.reveals && state.reveals[i];
        return h('div', { class: 'opp-chip' + (isAct ? ' on' : '') + (p.dc ? ' dc' : '') + (hasReveal ? ' has-reveal' : ''),
            'data-seat': i, onclick: hasReveal ? () => openReveal(i) : null },
          h('div', { class: 'opp-name' }, (isAct ? '▶ ' : '') + p.name + (p.dc ? ' 🔌' : (p.isCpu ? ' 🤖' : ''))),
          h('div', { class: 'opp-mini' }, p.dc ? '再接続中…' : ('山' + p.deck.length + ' 手' + p.hand.length + ' 捨' + p.discard.length + (p.vpTokens ? ' ⭐' + p.vpTokens : ''))),
          revealBadge(state, i));
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
      (state.supply[id] || 0) > 0 && t.buys > 0 && affordable(state, id); // コイン・ポーション・繁栄制約を満たす
    // 初心者モード：おすすめ購入の山を黄色枠でハイライト（購入フェーズ・自分の操作中のみ）。
    const recSet = (UI.beginner && interactive && t.phase === 'buy' && !state.pending) ? new Set(recommendedBuys(state)) : new Set();
    const supSection = (title, ids, size) =>
      h('div', { class: 'supply-section' },
        h('div', { class: 'sup-title' }, title),
        h('div', { class: 'supply-grid ' + size },
          ids.map((id) => pileEl(id, state, { size: size === 'small' ? 'sm' : 'lg', buyable: buyableId(id), recommended: recSet.has(id), onClick: () => onPileTap(state, id, interactive) }))));

    // 王国カードはコストの安い順に並べる（同コストはid順で安定）。
    const kingdomByCost = state.kingdom.slice().sort((a, b) => DOM.CARDS[a].cost - DOM.CARDS[b].cost || a.localeCompare(b));
    // 繁栄：プラチナ貨/植民地／錬金術：ポーション が供給されていれば 財宝/勝利点 の列に加える。
    const treasureRow = (state.supply.platinum != null ? DOM.TREASURES.concat(['platinum']) : DOM.TREASURES)
      .concat(state.supply.potion != null ? ['potion'] : []);
    const victoryRow = (state.supply.colony != null ? DOM.VICTORY.concat(['colony']) : DOM.VICTORY).concat(['curse']);
    // 暗黒時代：廃墟の山（Looterがある時のみ・購入不可＝獲得専用）。一番上の実廃墟と残枚数を表示する。
    const ruinsPile = (Array.isArray(state.ruins) && state.ruins.length > 0)
      ? h('div', { class: 'supply-section' }, h('div', { class: 'sup-title' }, '廃墟の山（獲得専用）'),
          h('div', { class: 'supply-grid small' }, ruinsPileEl(state)))
      : null;
    const supply = h('div', null,
      // 財宝・勝利点は基本カード。デスクトップでは横並びにして縦スペースを節約。
      h('div', { class: 'supply-basics' },
        supSection('財宝', treasureRow, 'small'),
        supSection('勝利点', victoryRow, 'small')),
      supSection('王国カード（アクション）', kingdomByCost, 'big'),
      ruinsPile);

    // 場（プレイ済み）＋持続カード（⏳付き・場に残る）＋王子の脇（👑・毎ターン開始時に使用）
    const inPlayChips = active.inPlay.map((id) => h('div', { class: 'chip-card ' + typeClass(id) + coinClass(id) }, DOM.CARDS[id].name));
    const durChips = (active.durationCards || []).map((id) => h('div', { class: 'chip-card duration', title: '持続中（次の手番に効果）' }, '⏳ ' + DOM.CARDS[id].name));
    const princeChips = (active.princes || []).map((id) => h('div', { class: 'chip-card duration', title: '王子の脇（毎ターン開始時に使用）' }, '👑 ' + DOM.CARDS[id].name));
    const allPlayChips = inPlayChips.concat(durChips, princeChips);
    const playArea = allPlayChips.length
      ? h('div', { class: 'play-area' }, allPlayChips)
      : h('div', { class: 'play-area' }, h('div', { class: 'empty-note' }, 'まだ場にカードはありません'));
    // 海辺：島マット（公開・VPに数える）／原住民の村マット（自分のみ枚数表示）
    const matRows = [];
    if ((me.islandMat || []).length) matRows.push(h('div', { class: 'mat-row' },
      h('span', { class: 'mat-label' }, '🏝 島マット: '),
      me.islandMat.map((id) => h('span', { class: 'chip-card ' + typeClass(id) }, DOM.CARDS[id].name))));
    // 冒険：酒場マット（Reserve カード・守銭奴の銅貨。呼び出しで場へ戻す。公開）
    if ((me.tavern || []).length) matRows.push(h('div', { class: 'mat-row' },
      h('span', { class: 'mat-label' }, '🍺 酒場マット: '),
      me.tavern.map((id) => h('span', { class: 'chip-card ' + typeClass(id) }, DOM.CARDS[id].name))));
    if ((me.nativeVillageMat || []).length) matRows.push(h('div', { class: 'mat-row' },
      h('span', { class: 'mat-label' }, '🛖 原住民の村マット: ' + me.nativeVillageMat.length + '枚')));
    // 繁栄：勝利点トークン（司教・記念碑・収集・投資。終了時に得点へ加算）
    if (me.vpTokens) matRows.push(h('div', { class: 'mat-row' },
      h('span', { class: 'mat-label' }, '⭐ 勝利点トークン: ' + me.vpTokens + ' 点')));
    // 冒険：トークン（旅＝山守/巨人が共有・-1カード＝遺物・-$1＝橋の下のトロル。すべて公開情報）。
    const advTokens = [];
    if (me.journeyDown) advTokens.push('🧭 旅トークン: 裏向き（次の山守で+5カード／次の巨人で+$1）');
    if (me.minusCard) advTokens.push('🃏 -1カードトークン: 次に手札を1枚少なく引く');
    if (me.minusCoin) advTokens.push('🪙 -$1トークン: 次の購入フェイズにコイン$1減');
    advTokens.forEach((txt) => matRows.push(h('div', { class: 'mat-row' }, h('span', { class: 'mat-label' }, txt))));
    // 新プロモ：王子の脇（自分が手番でないときも自分の脇は常時見える。公開情報）
    if ((me.princes || []).length && me !== active) matRows.push(h('div', { class: 'mat-row' },
      h('span', { class: 'mat-label' }, '👑 王子の脇: '),
      me.princes.map((id) => h('span', { class: 'chip-card ' + typeClass(id) }, DOM.CARDS[id].name))));
    const matsBlock = matRows.length ? h('div', { class: 'mats' }, matRows) : null;

    // 手札（種類でグループ化・重ね表示）。支配中は操作対象（被支配者）の手札を出す。
    const hg = handGroups(handP.hand, state.kingdom);
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
    if (!handP.hand.length) handBlocks.push(h('div', { class: 'empty-note' }, '手札がありません'));

    const logLines = state.log.slice(-6);
    const logBox = h('div', { class: 'log', onclick: () => { UI.logModal = true; sfx('tap'); render(); } },
      logLines.map((l, i) => h('div', { class: i === logLines.length - 1 ? 'latest' : '' }, l)),
      h('div', { class: 'log-more' }, '📜 タップで全履歴'));

    const moveLine = lastMove(state.log);
    const moveBar = h('div', { class: 'last-move' }, moveLine ? h('span', null, '🃏 ' + moveLine) : h('span', { class: 'muted' }, 'まだ動きはありません'));

    // 初心者モード：今やることの案内（ヘッダー内に常時表示）
    const coach = UI.beginner ? coachHint(state, viewer, interactive) : null;
    return h('div', { class: 'board' },
      // スクロールしても常に見えるヘッダー（手番・残量・相手・直近の行動）
      h('div', { class: 'board-head' }, top, othersStrip, moveBar,
        coach ? h('div', { class: 'coach-bar' }, coach) : null),
      UI.mode === 'online' ? h('div', { class: 'muted', style: 'font-size:11px;text-align:center;margin:-2px 0 4px' }, '部屋 ' + UI.roomCode + '　/　あなた: ' + me.name) : null,
      banner,
      // 錬金術・支配：あなたが支配者として相手の追加ターンを操作している間の案内。
      possessing ? h('div', { class: 'cpu-banner', style: 'background:#6b3fa0;color:#fff' },
        '🎭 支配中：' + active.name + ' のターンをあなたが操作しています（獲得したカードはあなたが受け取ります）') : null,
      h('div', { class: 'section-h' }, 'サプライ（場の山札）'),
      supply,
      h('div', { class: 'zone-h' }, h('span', { class: 't' }, '場')),
      playArea,
      matsBlock,
      h('div', { class: 'zone-h' }, h('span', { class: 't' }, (possessing ? '🎭 ' + handP.name + ' の手札（支配中）' : handP.name + ' の手札')),
        h('span', { class: 'c', 'data-self-pile': '1' },
          '山' + handP.deck.length + '・捨' + handP.discard.length + '・手' + handP.hand.length + '｜' + E().vpOf(handP) + '点'),
        (state.reveals && state.reveals[viewer])
          ? h('span', { class: 'self-reveal-wrap', onclick: () => openReveal(viewer) }, revealBadge(state, viewer))
          : null),
      h('div', { class: 'hand-zone' }, handBlocks),
      logBox,
      viewActionBar(state, viewer, actor, interactive)
    );
  }

  function handGroups(hand, kingdom) {
    // 錬金術：ポーションは王国カードでも SUPPLY_ORDER にも入らない共通財宝なので、明示的に並びへ足す
    // （さもないと手札のポーションがどのグループにも入らず描画されない）。
    const order = DOM.SUPPLY_ORDER(kingdom).concat(['potion']);
    const counts = {};
    hand.forEach((c) => (counts[c] = (counts[c] || 0) + 1));
    // 手札の全idを網羅する（SUPPLY_ORDER 優先＋そこに無いid＝闇市場のサプライ外カード等を後ろに追加）。
    // さもないと order に無いカードがどのグループにも入らず手札に描画されず、操作不能になる。
    const present = order.filter((id) => counts[id]).concat(Object.keys(counts).filter((id) => DOM.CARDS[id] && order.indexOf(id) < 0));
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
    const pc = potCost(id); // 錬金術：ポーション費用（あれば）
    const canBuy = interactive && !state.pending && t.phase === 'buy' && (state.supply[id] || 0) > 0 && t.buys > 0 && affordable(state, id);
    const label = '購入する（' + cost + 'コイン' + (pc ? '＋ポーション' + (pc > 1 ? pc : '') : '') + '）';
    if (canBuy) showSheet(id, { label, cls: 'btn-primary', on: () => dispatch({ type: 'BUY', card: id }) });
    else showSheet(id, null);
  }

  function viewActionBar(state, viewer, actor, interactive) {
    const t = state.turn;
    if (state.pending) {
      const who = state.players[state.pending.player].name;
      if (interactive) // interactive はこの保留の決定者（支配中は支配者に委譲済み）を意味する
        return h('div', { class: 'actions-bar' }, h('div', { class: 'btn btn-ghost btn-block', style: 'pointer-events:none' }, '↑ 選択してください'));
      return h('div', { class: 'actions-bar' }, h('div', { class: 'btn btn-ghost btn-block', style: 'pointer-events:none' }, who + ' の対応を待っています…'));
    }
    if (!interactive) {
      const who = state.players[actor].name;
      return h('div', { class: 'actions-bar' }, h('div', { class: 'btn btn-ghost btn-block', style: 'pointer-events:none' }, who + ' の番です…'));
    }
    // プロモ：へそくり(Stash)の配置方針トグル（所持者が自分の手番中いつでも変更可・公開情報）。
    // シャッフルは効果解決中に同期で起こるため、事前に方針を決めておく方式（山札の上／混ぜる／一番下）。
    const stashBtn = (() => {
      if (t.active !== viewer) return null;
      const mp = state.players[viewer];
      const ownStash = [].concat(mp.hand, mp.deck, mp.discard, mp.inPlay, mp.setAside || []).includes('stash');
      if (!ownStash) return null;
      const cur = mp.stashPlacement || 'top';
      const label = { top: '山札の上', mix: '混ぜる', bottom: '一番下' };
      const next = { top: 'mix', mix: 'bottom', bottom: 'top' };
      return h('button', { class: 'btn btn-block', onclick: () => dispatch({ type: 'STASH_SETTING', player: viewer, value: next[cur] }) },
        '🧧 へそくり配置: ' + label[cur] + '（タップで変更）');
    })();
    if (t.phase === 'action') {
      return h('div', { class: 'actions-bar' },
        stashBtn,
        h('button', { class: 'btn btn-primary btn-block', onclick: () => endActionPhase(state, viewer) }, '購入フェーズへ ▶'));
    }
    // 支配中は操作対象（被支配者=t.active）の手札で判定する（財宝を出すのも engine では被支配者の手札）。
    const hp = (t.possessedBy != null && t.possessedBy === viewer) ? state.players[t.active] : state.players[viewer];
    const hasTreasure = hp.hand.some((c) => DOM.CARDS[c].types.includes('treasure'));
    // ギルド：財源(Coffers)を持っていれば「財源を使う」ボタン（購入フェイズ・1枚=+1コイン）。
    const cofferBtn = (t.active === viewer && (state.players[viewer].coffers || 0) > 0)
      ? h('button', { class: 'btn btn-block', style: 'background:#b8860b;color:#fff', onclick: () => { UI.coffersOpen = true; UI.amount = null; render(); } }, '💰 財源を使う（' + state.players[viewer].coffers + '）')
      : null;
    return h('div', { class: 'actions-bar' },
      h('button', { class: 'btn btn-block', disabled: hasTreasure ? null : 'disabled', onclick: () => dispatch({ type: 'PLAY_ALL_TREASURES' }) }, '財宝を全部出す'),
      cofferBtn,
      stashBtn,
      h('button', { class: 'btn btn-primary btn-block', onclick: () => endTurnTap(state, viewer) }, 'ターンを終える'));
  }
  // ギルド：財源を何枚使うか選ぶ（購入フェイズの任意タイミング。1枚=+1コイン）。pending ではない独立オーバーレイ。
  function modalCoffersSpend(state, viewer) {
    const coffers = state.players[viewer].coffers || 0;
    return modalAmount('財源を使う', '財源を1枚使うごとに +1コイン になります（現在 ' + state.turn.coins + ' コイン）。', coffers, 0,
      (n) => (n > 0 ? '財源を ' + n + '枚 使う（+' + n + 'コイン）' : '使わない'),
      (n) => { UI.coffersOpen = false; if (n > 0) dispatch({ type: 'COFFERS_SPEND', amount: n }); else render(); });
  }

  // 買い忘れ防止: 財宝を出していない／2コイン以上残して購入権があるときは確認を挟む
  function endTurnTap(state, viewer) {
    const t = state.turn;
    // 支配中は操作対象（被支配者=t.active）の手札で判定する（財宝を出すのも engine では被支配者の手札）。
    const hp = (t.possessedBy != null && t.possessedBy === viewer) ? state.players[t.active] : state.players[viewer];
    const hasTreasure = hp.hand.some((c) => DOM.CARDS[c].types.includes('treasure'));
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
    if (UI._selKey !== key) { UI.selection = []; UI.sentryChoice = null; UI.amount = null; UI._selKey = key; }
    const p = state.players[pd.player];

    if (pd.type === 'cellar') return modalMultiHand(p, '地下貯蔵庫', '捨てるカードを選び、同じ枚数を引きます。（0枚でもOK）',
      (n) => '確定（' + n + '枚 捨てる）', true, (cards) => dispatch({ type: 'CELLAR_RESOLVE', cards }));
    if (pd.type === 'militia') return modalMilitia(p, p.hand.length - 3, p.hand.includes('moat'), p.hand.includes('secret_chamber') && !pd.reacted, canDiplomatReact(p, pd));
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
    if (pd.type === 'torturer') return modalTorturer(p, p.hand.includes('secret_chamber') && !pd.reacted, canDiplomatReact(p, pd));
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
    if (pd.type === 'secret_chamber_putback') { const scn = Math.min(2, p.hand.length); return modalSelectN(p, '秘密の小部屋 — 山札の上に戻す', '手札から' + scn + '枚を選んで山札の上に戻します（最初のタップが一番上）。', scn, '確定（戻す）', (cards) => dispatch({ type: 'SECRET_CHAMBER_PUTBACK', cards })); }

    /* ===== 基本セット 第二版 ===== */
    if (pd.type === 'harbinger') return modalPickList(state, '前駆者 — 山札の上に置く', '捨て札から1枚を選んで山札の上に置けます（次のターンに引きます）。', p.discard, '山札の上に置く', (id) => dispatch({ type: 'HARBINGER_PUT', card: id }), { label: '置かない', on: () => dispatch({ type: 'HARBINGER_PUT', card: null }) });
    if (pd.type === 'vassal') return modalOptions('家臣 — 捨てたアクション', '捨てた「' + DOM.CARDS[pd.card].name + '」を使えます。', [
      { label: '使う', cls: 'btn-primary', on: () => dispatch({ type: 'VASSAL_PLAY', play: true }) },
      { label: '使わない', on: () => dispatch({ type: 'VASSAL_PLAY', play: false }) }]);
    if (pd.type === 'poacher') return modalSelectN(p, '密猟者 — 捨てる', '空のサプライの数（' + pd.need + '）だけ手札を捨てます。', pd.need, '確定（捨てる）', (cards) => dispatch({ type: 'POACHER_DISCARD', cards }));
    if (pd.type === 'bandit' && pd.stage === 'react') return modalOptions('山賊を受ける', '山札の上2枚から、銅貨でない財宝1枚が廃棄されます。', reactOptions(p, pd, { type: 'BANDIT_REACT' }));
    if (pd.type === 'bandit' && pd.stage === 'pick') return modalOptions('山賊 — 廃棄する財宝を選ぶ', '公開された財宝から、廃棄する1枚を選びます。', pd.cands.map((c) => ({ label: DOM.CARDS[c].name, on: () => dispatch({ type: 'BANDIT_PICK', card: c }) })));
    if (pd.type === 'sentry') return modalSentry(p, pd.cards, (res) => dispatch(Object.assign({ type: 'SENTRY_RESOLVE' }, res)));
    if (pd.type === 'artisan' && pd.stage === 'gain') return modalGainSupply(state, '職人 — 獲得', 'コスト5以下のカードを手札に獲得します。', (id) => effCost(state, id) <= 5, (id) => dispatch({ type: 'ARTISAN_GAIN', card: id }));
    if (pd.type === 'artisan' && pd.stage === 'put') return modalSingleHand(p, '職人 — 山札の上に置く', '手札から1枚を選び、山札の上に置きます。', () => true, (card) => dispatch({ type: 'ARTISAN_PUT', card }), null, '山札の上に置く');

    /* ===== 陰謀 第二版 ===== */
    if (pd.type === 'courtier' && pd.stage === 'reveal') return modalSingleHand(p, '廷臣 — 公開', '公開するカードを1枚選びます（持つ種類の数だけ効果を選べます）。', () => true, (card) => dispatch({ type: 'COURTIER_REVEAL', card }), null, '公開する');
    if (pd.type === 'courtier' && pd.stage === 'choose') return modalChooseN('廷臣 — 効果を選ぶ', '「' + DOM.CARDS[pd.card].name + '」の種類数 = ' + pd.n + ' 個を選びます。', COURTIER_OPTS, pd.n, (choices) => dispatch({ type: 'COURTIER_CHOOSE', choices }));
    if (pd.type === 'lurker' && pd.stage === 'choose') return modalOptions('待ち伏せ', '次から1つを選びます。', [
      { label: 'サプライのアクションを廃棄', on: () => dispatch({ type: 'LURKER_CHOOSE', choice: 'trash' }) },
      { label: '廃棄置き場からアクションを獲得', on: () => dispatch({ type: 'LURKER_CHOOSE', choice: 'gain' }) }]);
    if (pd.type === 'lurker' && pd.stage === 'trash') return modalGainSupply(state, '待ち伏せ — 廃棄', 'サプライのアクションカード1枚を廃棄します。', (id) => DOM.CARDS[id].types.includes('action'), (id) => dispatch({ type: 'LURKER_TRASH', card: id }), null, false, '廃棄する');
    if (pd.type === 'lurker' && pd.stage === 'gain') return modalPickList(state, '待ち伏せ — 獲得', '廃棄置き場からアクションカード1枚を獲得します。', state.trash.filter((id) => DOM.CARDS[id].types.includes('action')), '獲得する', (id) => dispatch({ type: 'LURKER_GAIN', card: id }));
    if (pd.type === 'mill') return modalMill(p, (cards) => dispatch({ type: 'MILL_RESOLVE', cards }));
    if (pd.type === 'patrol') return modalReorder('パトロール — 山札の上に戻す', '山札の上に戻す順番をタップで選びます（最初が一番上）。', pd.cards, (order) => dispatch({ type: 'PATROL_RESOLVE', order }));
    if (pd.type === 'replace' && pd.stage === 'react') return modalOptions('身代わりを受ける', '相手が勝利点を獲得した場合、呪いを受けます。', reactOptions(p, pd, { type: 'REPLACE_REACT' }));
    if (pd.type === 'replace' && pd.stage === 'trash') return modalSingleHand(p, '身代わり — 廃棄', '廃棄するカードを1枚選びます（その後、最大$2高いカードを獲得）。', () => true, (card) => dispatch({ type: 'REPLACE_TRASH', card }));
    if (pd.type === 'replace' && pd.stage === 'gain') return modalGainSupply(state, '身代わり — 獲得', '廃棄したカードより最大$2高いカードを1枚獲得します。', (id) => effCost(state, id) <= pd.maxCost, (id) => dispatch({ type: 'REPLACE_GAIN', card: id }));
    if (pd.type === 'secret_passage' && pd.stage === 'pick') return modalSingleHand(p, '隠し通路 — カードを選ぶ', '山札に入れるカードを1枚選びます。', () => true, (card) => dispatch({ type: 'SECRET_PASSAGE_PICK', card }), null, '選ぶ');
    if (pd.type === 'secret_passage' && pd.stage === 'place') return modalOptions('隠し通路 — 入れる位置', '「' + DOM.CARDS[pd.card].name + '」を山札のどこに入れますか？', [
      { label: '一番上（次に引く）', cls: 'btn-primary', on: () => dispatch({ type: 'SECRET_PASSAGE_PLACE', pos: 0 }) },
      { label: '真ん中', on: () => dispatch({ type: 'SECRET_PASSAGE_PLACE', pos: Math.floor(p.deck.length / 2) }) },
      { label: '一番下', on: () => dispatch({ type: 'SECRET_PASSAGE_PLACE', pos: p.deck.length }) }]);
    if (pd.type === 'diplomat_discard') return modalSelectN(p, '外交官 — 手札を捨てる', '手札を3枚捨てます。', Math.min(3, p.hand.length), '確定（捨てる）', (cards) => dispatch({ type: 'DIPLOMAT_DISCARD', cards }));

    /* ===== プロモ ===== */
    if (pd.type === 'envoy') return modalPickList(state, '使者 — 捨てさせる', state.players[pd.source].name + ' が公開した5枚から、捨てさせる1枚を選びます。', pd.revealed, '捨てさせる', (id) => dispatch({ type: 'ENVOY_PICK', card: id }));
    if (pd.type === 'governor' && pd.stage === 'choose') return modalOptions('総督', '全員に効果（自分はカッコ内の強い方）。1つ選びます。', [
      { label: 'カードを引く（自分 +3 / 他 +1）', on: () => dispatch({ type: 'GOVERNOR_CHOOSE', choice: 'cards' }) },
      { label: '財宝を獲得（自分=金貨 / 他=銀貨）', on: () => dispatch({ type: 'GOVERNOR_CHOOSE', choice: 'silver' }) },
      { label: '改築（自分=ちょうど$2高い / 他=$1高い）', on: () => dispatch({ type: 'GOVERNOR_CHOOSE', choice: 'remodel' }) }]);
    if (pd.type === 'governor_remodel' && pd.stage === 'trash') return modalSingleHand(p, '総督 — 廃棄（任意）', '廃棄してちょうど $' + pd.delta + ' 高いカードを獲得できます（しなくてもよい）。', () => true, (card) => dispatch({ type: 'GOVERNOR_REMODEL_TRASH', card }), { label: '廃棄しない', on: () => dispatch({ type: 'GOVERNOR_REMODEL_TRASH', card: null }) });
    if (pd.type === 'governor_remodel' && pd.stage === 'gain') return modalGainSupply(state, '総督 — 獲得', 'ちょうどコスト ' + pd.exact + ' のカードを獲得します。', (id) => effCost(state, id) === pd.exact, (id) => dispatch({ type: 'GOVERNOR_REMODEL_GAIN', card: id }));
    if (pd.type === 'dismantle' && pd.stage === 'trash') return modalSingleHand(p, '取り壊し — 廃棄', '廃棄するカードを1枚選びます（$1以上なら 安いカード＋金貨を獲得）。', () => true, (card) => dispatch({ type: 'DISMANTLE_TRASH', card }));
    if (pd.type === 'dismantle' && pd.stage === 'gain') return modalGainSupply(state, '取り壊し — 獲得', '廃棄したカードより安いカードを1枚獲得します。', (id) => effCost(state, id) <= pd.maxCost, (id) => dispatch({ type: 'DISMANTLE_GAIN', card: id }));
    if (pd.type === 'black_market') return modalBlackMarket(state, pd, p);
    /* ===== 新プロモ（王子/船長/教会/サウナ/アヴァント）===== */
    if (pd.type === 'prince') return modalSingleHand(p, '王子 — 脇に置く',
      'コスト4以下の（持続・命令以外の）アクション1枚を王子の脇に置けます。以降あなたの毎ターン開始時、脇に置いたまま使用します（置かなくてもよい）。',
      (id) => E() && E().cardCost ? (DOM.CARDS[id].types.includes('action') && !DOM.CARDS[id].types.includes('duration') && !DOM.CARDS[id].types.includes('command') && !DOM.CARDS[id].potion && effCost(state, id) <= 4) : false,
      (card) => dispatch({ type: 'PRINCE_SETASIDE', card }),
      { label: '脇に置かない', on: () => dispatch({ type: 'PRINCE_SETASIDE', card: null }) }, '脇に置く');
    if (pd.type === 'prince_play') return modalOptions('王子 — ターン開始時',
      '王子の脇の「' + (DOM.CARDS[pd.card] ? DOM.CARDS[pd.card].name : pd.card) + '」を（脇に置いたまま）使用します。',
      [{ label: '「' + (DOM.CARDS[pd.card] ? DOM.CARDS[pd.card].name : pd.card) + '」を使う', cls: 'btn-primary', on: () => dispatch({ type: 'PRINCE_PLAY' }) }]);
    if (pd.type === 'captain') {
      const cands = (E() && E().captainTargets) ? E().captainTargets(state) : [];
      return modalGainSupply(state, '船長 — サプライのカードを使う',
        'サプライにあるコスト4以下の（持続・命令以外の）アクション1枚を、サプライに残したまま使用します。',
        (id) => cands.includes(id),
        (id) => dispatch({ type: 'CAPTAIN_PLAY', card: id }),
        () => dispatch({ type: 'CAPTAIN_PLAY', card: null }), false, '使う');
    }
    if (pd.type === 'church') return modalMultiHand(p, '教会 — 脇に置く',
      '手札から最大3枚を裏向きで脇に置きます（次のあなたのターン開始時に手札へ戻り、その後1枚廃棄できます）。0枚でもOK。',
      (n) => '確定（' + n + '枚 置く）', true, (cards) => dispatch({ type: 'CHURCH_SETASIDE', cards }), 3);
    if (pd.type === 'church_trash') return modalSingleHand(p, '教会 — 廃棄（任意）',
      '手札1枚を廃棄できます（しなくてもよい）。', () => true,
      (card) => dispatch({ type: 'CHURCH_TRASH', card }),
      { label: '廃棄しない', on: () => dispatch({ type: 'CHURCH_TRASH', card: null }) });
    if (pd.type === 'sauna_chain') return modalOptions(pd.next === 'avanto' ? 'サウナ — アヴァントを使う？' : 'アヴァント — サウナを使う？',
      '手札の「' + (pd.next === 'avanto' ? 'アヴァント' : 'サウナ') + '」を（アクションを消費せず）使えます。',
      [{ label: '使う', cls: 'btn-primary', on: () => dispatch({ type: 'SAUNA_CHAIN', play: true }) },
       { label: '使わない', on: () => dispatch({ type: 'SAUNA_CHAIN', play: false }) }]);
    if (pd.type === 'sauna_trash') return modalSingleHand(p, 'サウナ — 廃棄（任意）',
      '銀貨を使ったので、手札1枚を廃棄できます（あと' + (pd.remaining || 1) + '回・しなくてもよい）。', () => true,
      (card) => dispatch({ type: 'SAUNA_TRASH', card }),
      { label: '廃棄しない', on: () => dispatch({ type: 'SAUNA_TRASH', card: null }) });

    /* ===== 拡張: 海辺（Seaside 第二版）===== */
    if (pd.type === 'warehouse') return modalSelectN(p, '倉庫 — 捨てる', '手札を3枚選んで捨てます。', Math.min(3, p.hand.length), '確定（捨てる）', (cards) => dispatch({ type: 'WAREHOUSE_DISCARD', cards }));
    if (pd.type === 'haven') return modalSingleHand(p, '停泊所 — 脇に置く', '手札1枚を脇に置きます（次の手番の開始時に手札へ戻ります）。', () => true, (card) => dispatch({ type: 'HAVEN_SETASIDE', card }), null, '脇に置く');
    if (pd.type === 'tactician') return modalOptions('策士', '手札を全て捨てると、次の手番に +5カード +1購入 +1アクション。', [
      { label: '手札を全て捨てる', cls: 'btn-primary', on: () => dispatch({ type: 'TACTICIAN_RESOLVE', discard: true }) },
      { label: '捨てない（持続しない）', on: () => dispatch({ type: 'TACTICIAN_RESOLVE', discard: false }) }]);
    if (pd.type === 'salvager') return modalSingleHand(p, '引揚水夫 — 廃棄', '廃棄するカードを1枚選びます（そのコストぶん +コイン）。', () => true, (card) => dispatch({ type: 'SALVAGER_TRASH', card }), null, '廃棄する');
    if (pd.type === 'lookout' && pd.stage === 'trash') return modalOptions('見張り — 廃棄', '見た上3枚から廃棄する1枚を選びます。', pd.cards.map((c) => ({ label: DOM.CARDS[c].name, on: () => dispatch({ type: 'LOOKOUT_TRASH', card: c }) })));
    if (pd.type === 'lookout' && pd.stage === 'discard') return modalOptions('見張り — 捨てる', '残りから捨てる1枚を選びます（最後の1枚は山札の上に戻ります）。', pd.cards.map((c) => ({ label: DOM.CARDS[c].name, on: () => dispatch({ type: 'LOOKOUT_DISCARD', card: c }) })));
    if (pd.type === 'island') return modalSingleHand(p, '島 — 島マットへ', '手札1枚を島マットに置きます（ゲーム終了まで取り出さず、勝利点に数えます）。', () => true, (card) => dispatch({ type: 'ISLAND_PICK', card }), null, '島マットへ');
    if (pd.type === 'native_village') return modalOptions('原住民の村', 'どちらかを選びます。', [
      { label: '山札の上1枚をマットに置く', cls: 'btn-primary', on: () => dispatch({ type: 'NATIVE_VILLAGE_RESOLVE', mode: 'set' }) },
      { label: 'マットの全カードを手札に加える（' + (p.nativeVillageMat || []).length + '枚）', on: () => dispatch({ type: 'NATIVE_VILLAGE_RESOLVE', mode: 'take' }) }]);
    if (pd.type === 'tide_pools_discard') return modalSelectN(p, '潮だまり — 手札を捨てる', '手札を2枚選んで捨てます。', Math.min(2, p.hand.length), '確定（捨てる）', (cards) => dispatch({ type: 'TIDE_POOLS_DISCARD', cards }));
    // 冒険：地下牢＝手札2枚を捨てる（今／次の手番）。道具＝手札から最大2枚を脇に置く（次の手番に戻る）。
    if (pd.type === 'dungeon_discard') return modalSelectN(p, '地下牢 — 手札を捨てる', '手札を2枚選んで捨てます。', Math.min(2, p.hand.length), '確定（捨てる）', (cards) => dispatch({ type: 'DUNGEON_DISCARD', cards }));
    if (pd.type === 'gear') return modalMultiHand(p, '道具 — 脇に置く', '手札から最大2枚を裏向きに脇に置きます（次の手番開始時に手札へ戻ります・0枚でもOK）。', (n) => '確定（' + n + '枚）', true, (cards) => dispatch({ type: 'GEAR_SETASIDE', cards }), 2);
    if (pd.type === 'amulet') return modalOptions('魔除け — 1つ選ぶ', '今／次の手番開始時それぞれ選びます。', [
      { label: '+$1', cls: 'btn-primary', on: () => dispatch({ type: 'AMULET_RESOLVE', mode: 'coin' }) },
      { label: '手札1枚を廃棄', on: () => dispatch({ type: 'AMULET_RESOLVE', mode: 'trash' }) },
      { label: '銀貨1枚を獲得', on: () => dispatch({ type: 'AMULET_RESOLVE', mode: 'silver' }) }]);
    if (pd.type === 'amulet_trash') return modalSingleHand(p, '魔除け — 廃棄', '廃棄するカードを1枚選びます。', () => true, (card) => dispatch({ type: 'AMULET_TRASH', card }));
    // 冒険：酒場マット（Reserve）の呼び出し・守銭奴
    if (pd.type === 'miser') {
      const matCu = (p.tavern || []).filter((c) => c === 'copper').length;
      const opts = [];
      if (p.hand.includes('copper')) opts.push({ label: '手札の銅貨1枚を酒場マットに置く', cls: 'btn-primary', on: () => dispatch({ type: 'MISER_RESOLVE', mode: 'bank' }) });
      opts.push({ label: '酒場マットの銅貨で +$' + matCu, on: () => dispatch({ type: 'MISER_RESOLVE', mode: 'coins' }) });
      return modalOptions('守銭奴 — 1つ選ぶ', '手札の銅貨を貯める／貯めた銅貨1枚につき +$1。', opts);
    }
    if (pd.type === 'tavern_start') {
      const mat = p.tavern || [];
      const opts = [];
      if (mat.includes('guide')) opts.push({ label: '案内人を呼ぶ（手札を全捨て5枚引く）', on: () => dispatch({ type: 'TAVERN_START_CALL', card: 'guide' }) });
      if (mat.includes('ratcatcher')) opts.push({ label: '鼠取りを呼ぶ（手札1枚を廃棄）', on: () => dispatch({ type: 'TAVERN_START_CALL', card: 'ratcatcher' }) });
      if (mat.includes('transmogrify')) opts.push({ label: '変容を呼ぶ（手札1枚を廃棄→格上げ獲得）', on: () => dispatch({ type: 'TAVERN_START_CALL', card: 'transmogrify' }) });
      opts.push({ label: '呼び出さない', on: () => dispatch({ type: 'TAVERN_START_CALL', card: null }) });
      return modalOptions('酒場マット — 呼び出し（ターン開始）', '呼び出す Reserve カードを選びます（呼び出したカードは場に出ます）。', opts);
    }
    if (pd.type === 'ratcatcher_trash') return modalSingleHand(p, '鼠取り — 廃棄', '手札から廃棄するカードを1枚選びます。', () => true, (card) => dispatch({ type: 'RATCATCHER_TRASH', card }));
    if (pd.type === 'transmogrify_trash') return modalSingleHand(p, '変容 — 廃棄', '手札から廃棄するカードを1枚選びます（そのコスト+$1以下を手札に獲得）。', () => true, (card) => dispatch({ type: 'TRANSMOGRIFY_TRASH', card }));
    if (pd.type === 'transmogrify_gain') return modalGainSupply(state, '変容 — 獲得', 'コスト ' + pd.maxCost + ' 以下のカードを1枚 手札に獲得します。',
      (id) => effCost(state, id) <= pd.maxCost && potCost(id) <= (pd.pot || 0), (id) => dispatch({ type: 'TRANSMOGRIFY_GAIN', card: id }));
    if (pd.type === 'wine_merchant') return modalOptions('ワイン商 — 捨てる？', '未使用の$2以上が残っています。ワイン商を酒場マットから捨てられます（捨てると再度購入して使えます）。', [
      { label: '酒場マットから捨てる', cls: 'btn-primary', on: () => dispatch({ type: 'WINE_MERCHANT_DISCARD', discard: true }) },
      { label: 'マットに残す', on: () => dispatch({ type: 'WINE_MERCHANT_DISCARD', discard: false }) }]);
    if (pd.type === 'cutpurse' && pd.stage === 'react') return modalOptions('巾着切りを受ける', '銅貨1枚を捨てます（無ければ手札を公開）。', reactOptions(p, pd, { type: 'CUTPURSE_REACT' }));
    if (pd.type === 'sea_witch' && pd.stage === 'react') return modalOptions('海の魔女を受ける', '呪い1枚を獲得します。', reactOptions(p, pd, { type: 'SEA_WITCH_REACT' }));
    if (pd.type === 'sea_witch_discard') return modalSelectN(p, '海の魔女 — 手札を捨てる', '手札を2枚選んで捨てます。', Math.min(2, p.hand.length), '確定（捨てる）', (cards) => dispatch({ type: 'SEA_WITCH_DISCARD', cards }));
    if (pd.type === 'smugglers') return modalOptions('密輸人 — 獲得', '右隣が直前の手番に獲得したカード（6コスト以下）を1枚獲得します。', pd.candidates.map((c) => ({ label: DOM.CARDS[c].name + ' を獲得', on: () => dispatch({ type: 'SMUGGLERS_GAIN', card: c }) })));
    if (pd.type === 'blockade' && pd.stage === 'gain') return modalGainSupply(state, '封鎖 — 獲得して脇に置く', 'コスト4以下を1枚獲得して脇に置きます（次の手番に手札へ。場にある間、他人が同名を獲得すると呪い）。', (id) => effCost(state, id) <= 4, (id) => dispatch({ type: 'BLOCKADE_GAIN', card: id }));
    if (pd.type === 'blockade' && pd.stage === 'react') return modalOptions('封鎖を受ける', '相手の封鎖が場にある間、封鎖された同名カードを獲得すると呪いを受けます（堀を公開すればこの封鎖から免疫）。', reactOptions(p, pd, { type: 'BLOCKADE_REACT' }));
    if (pd.type === 'pirate_react') return modalOptions('海賊 — 手札から使う？', '財宝が獲得されました。手札の「海賊」を今すぐ使えます（次の手番に6コスト以下の財宝を手札に獲得）。', [
      { label: '海賊を使う', cls: 'btn-primary', on: () => dispatch({ type: 'PIRATE_REACT', play: true }) },
      { label: '使わない', on: () => dispatch({ type: 'PIRATE_REACT', play: false }) },
    ]);
    if (pd.type === 'sailor_trash') return modalSingleHand(p, '船乗り — 廃棄（任意）', '手札1枚を廃棄できます（しなくてもよい）。', () => true, (card) => dispatch({ type: 'SAILOR_TRASH', card }), { label: '廃棄しない', on: () => dispatch({ type: 'SAILOR_TRASH', card: null }) }, '廃棄する');
    if (pd.type === 'sailor_play_gain') return modalOptions('船乗り — 獲得した持続カードを使う？', '「' + DOM.CARDS[pd.card].name + '」を今すぐ使えます（次の手番に持続効果）。', [
      { label: '「' + DOM.CARDS[pd.card].name + '」を使う', cls: 'btn-primary', on: () => dispatch({ type: 'SAILOR_PLAY_GAIN', play: true }) },
      { label: '使わない', on: () => dispatch({ type: 'SAILOR_PLAY_GAIN', play: false }) },
    ]);
    if (pd.type === 'pirate_gain') return modalGainSupply(state, '海賊 — 財宝を獲得', 'コスト6以下の財宝1枚を手札に獲得します。', (id) => DOM.isType(id, 'treasure') && effCost(state, id) <= 6, (id) => dispatch({ type: 'PIRATE_GAIN', card: id }), () => dispatch({ type: 'PIRATE_GAIN', card: null }));

    /* ===== 拡張: 錬金術（Alchemy 第二版）===== */
    if (pd.type === 'transmute') return modalSingleHand(p, '変成 — 廃棄', '手札から1枚を廃棄します（アクション→公領／財宝→変成／勝利点→金貨。多重タイプは各ぶん獲得）。', () => true, (card) => dispatch({ type: 'TRANSMUTE_TRASH', card }), null, '廃棄する');
    if (pd.type === 'apothecary') return modalReorder('薬剤師 — 山札の上に戻す', '残ったカードを山札の上に戻す順をタップで選びます（最初のタップが一番上）。', pd.cards, (order) => dispatch({ type: 'APOTHECARY_RESOLVE', order }));
    if (pd.type === 'scrying_pool' && pd.stage === 'react') return modalOptions('念視の泉を受ける', '山札の上が公開され、相手が捨てるか戻すか決めます。', reactOptions(p, pd, { type: 'SCRYING_REACT' }));
    if (pd.type === 'scrying_pool' && pd.stage === 'decide') return modalOptions('念視の泉 — ' + state.players[pd.victim].name + ' の山札の上「' + DOM.CARDS[pd.card].name + '」',
      (pd.victim === pd.source ? '自分の山札の上です。アクション以外を捨てると次のアクションまで掘れます。' : '相手の山札の上です。良い札を捨てさせられます。'), [
      { label: '捨てさせる', cls: 'btn-primary', on: () => dispatch({ type: 'SCRYING_DECIDE', discard: true }) },
      { label: '山札の上に残す', on: () => dispatch({ type: 'SCRYING_DECIDE', discard: false }) },
    ]);
    if (pd.type === 'university') return modalGainSupply(state, '大学 — 獲得（任意）', 'コスト5以下のアクションカードを1枚獲得できます（ポーション費用カードは不可・しなくてもよい）。', (id) => DOM.CARDS[id].types.includes('action') && effCost(state, id) <= 5 && (DOM.CARDS[id].potion || 0) === 0, (id) => dispatch({ type: 'UNIVERSITY_GAIN', card: id }), () => dispatch({ type: 'UNIVERSITY_GAIN', card: null }), true);
    if (pd.type === 'familiar' && pd.stage === 'react') return modalOptions('使い魔を受ける', '呪い1枚を獲得します。', reactOptions(p, pd, { type: 'FAMILIAR_REACT' }));
    if (pd.type === 'golem') return modalOptions('ゴーレム — 使う順', '見つけた2枚のアクションを、どちらから使うか選びます。', pd.cards.map((c) => ({ label: '「' + DOM.CARDS[c].name + '」を先に使う', on: () => dispatch({ type: 'GOLEM_ORDER', first: c }) })));
    if (pd.type === 'apprentice') return modalSingleHand(p, '徒弟 — 廃棄', '手札から1枚を廃棄します（コスト$1につき +1カード、ポーション費用ありなら +2カード）。', () => true, (card) => dispatch({ type: 'APPRENTICE_TRASH', card }), null, '廃棄する');

    /* ===== 繁栄（Prosperity）===== */
    if (pd.type === 'charlatan' && pd.stage === 'react') return modalOptions('ペテン師を受ける', '銅貨1枚を獲得します。', reactOptions(p, pd, { type: 'CHARLATAN_REACT' }));
    if (pd.type === 'rabble' && pd.stage === 'react') return modalOptions('群衆を受ける', '山札の上3枚を公開し、アクションと財宝を捨てます。', reactOptions(p, pd, { type: 'RABBLE_REACT' }));
    if (pd.type === 'clerk' && pd.stage === 'react') return modalOptions('会計士を受ける', '手札1枚を山札の上に置きます。', reactOptions(p, pd, { type: 'CLERK_REACT' }));
    if (pd.type === 'clerk' && pd.stage === 'topdeck') return modalSingleHand(p, '会計士 — 山札の上に置く', '手札1枚を選んで山札の上に置きます。', () => true, (card) => dispatch({ type: 'CLERK_TOPDECK', card }), null, '山札の上へ');
    if (pd.type === 'clerk_start') return modalOptions('会計士 — 手番開始時', '手札の会計士を使いますか？（アクションを消費せず +2コイン＆アタック）', [
      { label: '使う', cls: 'btn-primary', on: () => dispatch({ type: 'CLERK_START', play: true }) },
      { label: '使わない', on: () => dispatch({ type: 'CLERK_START', play: false }) },
    ]);
    if (pd.type === 'bishop' && pd.stage === 'trash') return modalSingleHand(p, '司教 — 廃棄', '手札1枚を廃棄します（コスト$2につき +1勝利点）。', () => true, (card) => dispatch({ type: 'BISHOP_TRASH', card }), null, '廃棄する');
    if (pd.type === 'bishop' && pd.stage === 'other') return modalSingleHand(p, '司教 — 廃棄（任意）', '手札1枚を廃棄できます（しなくてもよい）。', () => true, (card) => dispatch({ type: 'BISHOP_OTHER', card }), { label: '廃棄しない', on: () => dispatch({ type: 'BISHOP_OTHER', card: null }) }, '廃棄する');
    if (pd.type === 'vault' && pd.stage === 'discard') return modalMultiHand(p, '金庫室 — 捨てる', '好きな枚数を捨て、1枚につき +1コイン。', (n) => '確定（' + n + '枚捨てる）', true, (cards) => dispatch({ type: 'VAULT_DISCARD', cards }));
    if (pd.type === 'vault' && pd.stage === 'other') return modalMultiHand(p, '金庫室 — 2枚捨てて1枚引く？', '手札2枚を捨てると1枚引けます（任意）。', (n) => (n === 2 ? '2枚捨てて1枚引く' : '捨てない'), true, (cards) => dispatch({ type: 'VAULT_OTHER', cards }), 2);
    if (pd.type === 'mint') return modalSingleHand(p, '造幣所 — 財宝を公開', '手札の財宝1枚を公開し、そのコピーを獲得します（任意）。', (id) => DOM.isType(id, 'treasure'), (card) => dispatch({ type: 'MINT_REVEAL', card }), { label: '公開しない', on: () => dispatch({ type: 'MINT_REVEAL', card: null }) }, '公開して獲得');
    if (pd.type === 'expand' && pd.stage === 'trash') return modalSingleHand(p, '拡張 — 廃棄', '廃棄するカードを1枚選びます（その後 +$3 までを獲得）。', () => true, (card) => dispatch({ type: 'EXPAND_TRASH', card }), null, '廃棄する');
    if (pd.type === 'expand' && pd.stage === 'gain') return modalGainSupply(state, '拡張 — 獲得', 'コスト ' + pd.maxCost + ' 以下のカードを1枚獲得します。', (id) => effCost(state, id) <= pd.maxCost, (id) => dispatch({ type: 'EXPAND_GAIN', card: id }));
    if (pd.type === 'forge' && pd.stage === 'trash') return modalMultiHand(p, '溶鉱炉 — 廃棄', '好きな枚数を廃棄します（合計コストちょうどのカードを獲得）。', (n) => '確定（' + n + '枚廃棄）', true, (cards) => dispatch({ type: 'FORGE_TRASH', cards }));
    if (pd.type === 'forge' && pd.stage === 'gain') return modalGainSupply(state, '溶鉱炉 — 獲得', 'ちょうどコスト $' + pd.exact + ' のカードを1枚獲得します。', (id) => effCost(state, id) === pd.exact, (id) => dispatch({ type: 'FORGE_GAIN', card: id }));
    if (pd.type === 'kings_court') return modalSingleHand(p, '王の宮廷 — 3回使う', '3回使うアクションカードを選びます。', (id) => DOM.isType(id, 'action'), (card) => dispatch({ type: 'KINGS_COURT_CHOOSE', card }), null, '3回使う');
    if (pd.type === 'war_chest' && pd.stage === 'name') return modalGainSupply(state, '軍用金 — カードを指定', state.players[pd.source].name + ' が獲得できないカードを1つ指定します。', () => true, (id) => dispatch({ type: 'WAR_CHEST_NAME', card: id }));
    if (pd.type === 'war_chest' && pd.stage === 'gain') return modalGainSupply(state, '軍用金 — 獲得', 'コスト$5以下で、指定されていないカードを1枚獲得します。', (id) => effCost(state, id) <= 5 && (state.turn.warChestNamed || []).indexOf(id) < 0, (id) => dispatch({ type: 'WAR_CHEST_GAIN', card: id }));
    if (pd.type === 'watchtower') return modalOptions('物見やぐら', '獲得した「' + DOM.CARDS[pd.card].name + '」をどうしますか？', [
      { label: 'そのまま受け取る', cls: 'btn-primary', on: () => dispatch({ type: 'WATCHTOWER', choice: 'keep' }) },
      { label: '山札の上に置く', on: () => dispatch({ type: 'WATCHTOWER', choice: 'topdeck' }) },
      { label: '廃棄する', on: () => dispatch({ type: 'WATCHTOWER', choice: 'trash' }) },
    ]);
    if (pd.type === 'tiara_topdeck') return modalOptions('ティアラ', '獲得した「' + DOM.CARDS[pd.card].name + '」を山札の上に置きますか？', [
      { label: '山札の上に置く', cls: 'btn-primary', on: () => dispatch({ type: 'TIARA_TOPDECK', topdeck: true }) },
      { label: '置かない', on: () => dispatch({ type: 'TIARA_TOPDECK', topdeck: false }) },
    ]);
    if (pd.type === 'tiara_play') return modalSingleHand(p, 'ティアラ — 財宝を2回使う', '2回使う財宝を1枚選びます（任意）。', (id) => DOM.isType(id, 'treasure'), (card) => dispatch({ type: 'TIARA_PLAY', card }), { label: '使わない', on: () => dispatch({ type: 'TIARA_PLAY', card: null }) }, '2回使う');
    if (pd.type === 'anvil' && pd.stage === 'discard') return modalSingleHand(p, '金床 — 財宝を捨てる', '財宝1枚を捨てると、コスト4以下を獲得できます（任意）。', (id) => DOM.isType(id, 'treasure'), (card) => dispatch({ type: 'ANVIL_DISCARD', card }), { label: '捨てない', on: () => dispatch({ type: 'ANVIL_DISCARD', card: null }) }, '捨てる');
    if (pd.type === 'anvil' && pd.stage === 'gain') return modalGainSupply(state, '金床 — 獲得', 'コスト4以下のカードを1枚獲得します。', (id) => effCost(state, id) <= 4, (id) => dispatch({ type: 'ANVIL_GAIN', card: id }));
    if (pd.type === 'investment' && !pd.stage) return modalOptions('投資', '次のどちらかを選びます。', [
      { label: '+1 コイン', cls: 'btn-primary', on: () => dispatch({ type: 'INVESTMENT', choice: 'coin' }) },
      { label: '財宝1枚を廃棄して、場の財宝の種類ぶん +勝利点', on: () => dispatch({ type: 'INVESTMENT', choice: 'vp' }) },
    ]);
    if (pd.type === 'investment' && pd.stage === 'trash') return modalSingleHand(p, '投資 — 財宝を廃棄', '廃棄する財宝を1枚選びます（場の財宝の種類ぶん +勝利点）。', (id) => DOM.isType(id, 'treasure'), (card) => dispatch({ type: 'INVESTMENT_TRASH', card }), null, '廃棄する');
    if (pd.type === 'crystal_ball') {
      const c = pd.card; const opts = [];
      if (DOM.isType(c, 'action') || DOM.isType(c, 'treasure')) opts.push({ label: '使う', cls: 'btn-primary', on: () => dispatch({ type: 'CRYSTAL_BALL', choice: 'play' }) });
      opts.push({ label: '捨て札にする', on: () => dispatch({ type: 'CRYSTAL_BALL', choice: 'discard' }) });
      opts.push({ label: '廃棄する', on: () => dispatch({ type: 'CRYSTAL_BALL', choice: 'trash' }) });
      opts.push({ label: 'そのまま（山札の上に残す）', on: () => dispatch({ type: 'CRYSTAL_BALL', choice: 'keep' }) });
      return modalOptions('水晶玉 — 山札の上「' + DOM.CARDS[c].name + '」', 'どうしますか？', opts);
    }

    /* ===== 拡張: 収穫祭 ===== */
    if (pd.type === 'hamlet') return modalSingleHand(p, '小村 — ' + (pd.stage === 'action' ? '捨てて +1アクション' : '捨てて +1購入') + '（任意）',
      pd.stage === 'action' ? '手札1枚を捨てると +1アクション（しなくてもよい）。' : '手札1枚を捨てると +1購入（しなくてもよい）。',
      () => true, (card) => dispatch({ type: 'HAMLET_DISCARD', card }), { label: '捨てない', on: () => dispatch({ type: 'HAMLET_DISCARD', card: null }) }, '捨てる');
    if (pd.type === 'fortune_teller' && pd.stage === 'react') return modalOptions('占い師を受ける', '山札の上が勝利点/呪いまでめくられ、手前は捨てられます。', reactOptions(p, pd, { type: 'FORTUNE_TELLER_REACT' }));
    if (pd.type === 'horse_traders' && pd.stage === 'discard') return modalSelectN(p, '馬商人 — 手札を捨てる', '手札を' + Math.min(2, p.hand.length) + '枚選んで捨てます。', Math.min(2, p.hand.length), '確定（捨てる）', (cards) => dispatch({ type: 'HORSE_TRADERS_DISCARD', cards }));
    if (pd.type === 'remake' && pd.stage === 'trash') return modalSingleHand(p, 'リメイク — 廃棄（' + (pd.iter + 1) + '/2回目）', '手札から1枚を廃棄します（その後、ちょうど$1高いカードを獲得）。', () => true, (card) => dispatch({ type: 'REMAKE_TRASH', card }), null, '廃棄する');
    if (pd.type === 'remake' && pd.stage === 'gain') return modalGainSupply(state, 'リメイク — 獲得', '廃棄したカードよりちょうど$1高いカードを1枚獲得します。', (id) => effCost(state, id) === pd.exactCost, (id) => dispatch({ type: 'REMAKE_GAIN', card: id }));
    if (pd.type === 'tournament' && (pd.stage === 'reveal_self' || pd.stage === 'reveal_opp')) return modalOptions('馬上槍試合 — 属州を公開？',
      pd.stage === 'reveal_self' ? '手札の属州を公開すると、それを捨てて賞品または公領を山札の上に獲得します。'
        : '属州を公開すると、' + state.players[pd.source].name + ' のボーナス（+1カード +1コイン）を無効にできます。', [
      { label: '属州を公開する', cls: 'btn-primary', on: () => dispatch({ type: 'TOURNAMENT_REVEAL', reveal: true }) },
      { label: '公開しない', on: () => dispatch({ type: 'TOURNAMENT_REVEAL', reveal: false }) },
    ]);
    if (pd.type === 'tournament' && pd.stage === 'prize') {
      const prizeOpts = ['bag_of_gold', 'diadem', 'followers', 'princess', 'trusty_steed', 'duchy']
        .filter((id) => (state.supply[id] || 0) > 0)
        .map((id) => ({ label: DOM.CARDS[id].name + ' を山札の上に獲得', cls: id === 'duchy' ? '' : 'btn-primary', on: () => dispatch({ type: 'TOURNAMENT_PRIZE', card: id }) }));
      return modalOptions('馬上槍試合 — 賞品/公領を獲得', '賞品1枚または公領1枚を山札の上に獲得します。', prizeOpts);
    }
    if (pd.type === 'young_witch' && pd.stage === 'discard') return modalSelectN(p, '若き魔女 — 手札を捨てる', '手札を' + Math.min(2, p.hand.length) + '枚選んで捨てます。', Math.min(2, p.hand.length), '確定（捨てる）', (cards) => dispatch({ type: 'YOUNG_WITCH_DISCARD', cards }));
    if (pd.type === 'young_witch' && pd.stage === 'react') {
      const opts = reactOptions(p, pd, { type: 'YOUNG_WITCH_REACT' });
      if (pd.bane && p.hand.includes(pd.bane)) opts.unshift({ label: '🃏 災いカード「' + DOM.CARDS[pd.bane].name + '」を公開して免れる', cls: 'btn-primary', on: () => dispatch({ type: 'YOUNG_WITCH_BANE' }) });
      return modalOptions('若き魔女を受ける', '呪い1枚を獲得します。' + (pd.bane ? '災いカード「' + DOM.CARDS[pd.bane].name + '」を公開すれば免れます。' : ''), opts);
    }
    if (pd.type === 'jester' && pd.stage === 'react') return modalOptions('道化師を受ける', '山札の上が捨てられ、勝利点なら呪い、他は相手がコピーの獲得先を選びます。', reactOptions(p, pd, { type: 'JESTER_REACT' }));
    if (pd.type === 'jester' && pd.stage === 'choose') return modalOptions('道化師 — 「' + DOM.CARDS[pd.card].name + '」のコピー', 'どちらが「' + DOM.CARDS[pd.card].name + '」のコピーを獲得しますか？', [
      { label: state.players[pd.victim].name + ' に獲得させる', cls: 'btn-primary', on: () => dispatch({ type: 'JESTER_CHOOSE', who: 'victim' }) },
      { label: '自分が獲得する', on: () => dispatch({ type: 'JESTER_CHOOSE', who: 'me' }) },
    ]);
    if (pd.type === 'followers' && pd.stage === 'react') return modalOptions('家臣団を受ける', '呪い1枚を獲得し、手札が3枚になるまで捨てます。', reactOptions(p, pd, { type: 'FOLLOWERS_REACT' }));
    if (pd.type === 'followers' && pd.stage === 'discard') return modalSelectN(p, '家臣団 — 手札を捨てる', '手札が3枚になるまで（' + (p.hand.length - 3) + '枚）捨てます。', p.hand.length - 3, '確定（捨てる）', (cards) => dispatch({ type: 'FOLLOWERS_DISCARD', cards }));
    if (pd.type === 'trusty_steed') return modalChooseN('頼もしい乗騎 — 異なる2つを選ぶ', '次から異なる2つを選びます。', [
      { v: 'cards', label: '+2 カード' },
      { v: 'actions', label: '+2 アクション' },
      { v: 'coins', label: '+2 コイン' },
      { v: 'silver', label: '銀貨4枚を獲得し山札を捨て札に' },
    ], 2, (choices) => dispatch({ type: 'TRUSTY_STEED_RESOLVE', choices }));
    if (pd.type === 'horn_of_plenty') return modalGainSupply(state, '豊穣の角 — 獲得', 'コスト ' + pd.maxCost + ' 以下のカードを1枚獲得します（勝利点なら豊穣の角を廃棄）。', (id) => effCost(state, id) <= pd.maxCost, (id) => dispatch({ type: 'HORN_OF_PLENTY_GAIN', card: id }));

    /* ===== 拡張: ギルド（Guilds）===== */
    if (pd.type === 'overpay') {
      const info = {
        masterpiece: '過払い1コインにつき銀貨1枚を獲得します。',
        stonemason: '過払い額とちょうど同じコストのアクションカードを2枚獲得します。',
        doctor: '過払い1コインにつき、山札の上を1枚見て 廃棄/捨て/戻す を選べます。',
        herald: '過払い1コインにつき、捨て札から1枚を山札の上に置けます。',
      }[pd.card] || '';
      return modalAmount('過払い — 「' + DOM.CARDS[pd.card].name + '」', '追加で支払うコインを選びます（0＝過払いしない）。' + info, pd.max, 0,
        (n) => (n > 0 ? '+' + n + 'コイン 過払いする' : '過払いしない'), (n) => dispatch({ type: 'OVERPAY_RESOLVE', amount: n }));
    }
    if (pd.type === 'stonemason_overpay') return modalGainSupply(state, '石工（過払い） — アクションを獲得', 'ちょうどコスト $' + pd.exact + ' のアクションカードを獲得します（残り ' + pd.remaining + ' 枚）。', (id) => DOM.isType(id, 'action') && effCost(state, id) === pd.exact, (id) => dispatch({ type: 'STONEMASON_OVERPAY_GAIN', card: id }));
    if (pd.type === 'doctor_overpay') return modalOptions('医者（過払い） — 山札の上「' + DOM.CARDS[pd.card].name + '」', '残り ' + pd.remaining + ' 回。この札をどうしますか？', [
      { label: 'そのまま（山札の上に戻す）', cls: 'btn-primary', on: () => dispatch({ type: 'DOCTOR_OVERPAY', choice: 'topdeck' }) },
      { label: '捨て札にする', on: () => dispatch({ type: 'DOCTOR_OVERPAY', choice: 'discard' }) },
      { label: '廃棄する', on: () => dispatch({ type: 'DOCTOR_OVERPAY', choice: 'trash' }) },
    ]);
    if (pd.type === 'herald_overpay') return modalPickList(state, '伝令官（過払い） — 山札の上に置く', '捨て札から1枚を選んで山札の上に置きます（残り ' + pd.remaining + ' 回）。', p.discard, '山札の上に置く', (id) => dispatch({ type: 'HERALD_OVERPAY', card: id }));
    if (pd.type === 'stonemason' && pd.stage === 'trash') return modalSingleHand(p, '石工 — 廃棄', '手札から1枚を廃棄します（その後、それより安いカードを2枚獲得）。', () => true, (card) => dispatch({ type: 'STONEMASON_TRASH', card }), null, '廃棄する');
    if (pd.type === 'stonemason' && pd.stage === 'gain') return modalGainSupply(state, '石工 — 獲得', 'コスト $' + (pd.maxCost - 1) + ' 以下のカードを獲得します（残り ' + pd.remaining + ' 枚）。', (id) => effCost(state, id) < pd.maxCost, (id) => dispatch({ type: 'STONEMASON_GAIN', card: id }));
    if (pd.type === 'doctor' && pd.stage === 'name') return modalNameCard(state, '医者 — カードを指定', '山札の上3枚を公開し、指定と同名を全て廃棄します。1種を指定してください。', (id) => dispatch({ type: 'DOCTOR_NAME', card: id }));
    if (pd.type === 'doctor' && pd.stage === 'order') return modalReorder('医者 — 山札の上に戻す', '廃棄しなかったカードを山札の上に戻す順番をタップで選びます（最初のタップが一番上）。', pd.cards, (order) => dispatch({ type: 'DOCTOR_ORDER', order }));
    if (pd.type === 'advisor') return modalPickList(state, '助言者 — 捨てさせるカードを選ぶ', state.players[pd.source].name + ' が公開した ' + pd.cards.length + '枚 から、捨てさせる1枚を選びます（残りは ' + state.players[pd.source].name + ' の手札へ）。', pd.cards, '捨てさせる', (id) => dispatch({ type: 'ADVISOR_CHOOSE', card: id }));
    if (pd.type === 'plaza') return modalSingleHand(p, '広場 — 財宝を捨てる', '財宝1枚を捨てると +1財源（しなくてもよい）。', (id) => DOM.isType(id, 'treasure'), (card) => dispatch({ type: 'PLAZA_DISCARD', card }), { label: '捨てない', on: () => dispatch({ type: 'PLAZA_DISCARD', card: null }) }, '捨てる');
    if (pd.type === 'taxman' && pd.stage === 'trash') return modalSingleHand(p, '収税吏 — 財宝を廃棄', '手札の財宝1枚を廃棄できます（廃棄すると、そのコスト+$3までの財宝を山札の上に獲得し、相手に同名を捨てさせます）。', (id) => DOM.isType(id, 'treasure'), (card) => dispatch({ type: 'TAXMAN_TRASH', card }), { label: '廃棄しない', on: () => dispatch({ type: 'TAXMAN_TRASH', card: null }) }, '廃棄する');
    if (pd.type === 'taxman' && pd.stage === 'gain') return modalGainSupply(state, '収税吏 — 財宝を獲得', 'コスト $' + pd.maxCost + ' 以下の財宝を山札の上に獲得します。', (id) => DOM.isType(id, 'treasure') && effCost(state, id) <= pd.maxCost, (id) => dispatch({ type: 'TAXMAN_GAIN', card: id }), () => dispatch({ type: 'TAXMAN_GAIN', card: null }));
    if (pd.type === 'taxman' && pd.stage === 'react') return modalOptions('収税吏を受ける', '手札が5枚以上なら「' + DOM.CARDS[pd.trashedName].name + '」を1枚捨てます（無ければ手札を公開）。', reactOptions(p, pd, { type: 'TAXMAN_REACT' }));
    if (pd.type === 'butcher' && pd.stage === 'trash') return modalSingleHand(p, '肉屋 — 廃棄', '手札1枚を廃棄できます（廃棄すると、財源を払って格上げ獲得）。', () => true, (card) => dispatch({ type: 'BUTCHER_TRASH', card }), { label: '廃棄しない', on: () => dispatch({ type: 'BUTCHER_TRASH', card: null }) }, '廃棄する');
    if (pd.type === 'butcher' && pd.stage === 'pay') return modalAmount('肉屋 — 財源を支払う', '財源を支払うと、獲得できるカードのコスト上限が上がります（廃棄したカードのコスト $' + pd.trashedCost + ' ＋ 支払った財源）。', p.coffers || 0, 0,
      (n) => '財源を ' + n + '枚 支払う（獲得上限 $' + (pd.trashedCost + n) + '）', (n) => dispatch({ type: 'BUTCHER_PAY', amount: n }));
    if (pd.type === 'butcher' && pd.stage === 'gain') return modalGainSupply(state, '肉屋 — 獲得', 'コスト $' + pd.maxCost + ' 以下のカードを1枚獲得します。', (id) => effCost(state, id) <= pd.maxCost, (id) => dispatch({ type: 'BUTCHER_GAIN', card: id }), () => dispatch({ type: 'BUTCHER_GAIN', card: null }));
    if (pd.type === 'journeyman') return modalNameCard(state, '熟練工 — カードを指定', '指定したカード以外が3枚公開されるまで山札を公開し、その3枚を手札に加えます。1種を指定してください。', (id) => dispatch({ type: 'JOURNEYMAN_NAME', card: id }));
    if (pd.type === 'soothsayer' && pd.stage === 'react') return modalOptions('予言者を受ける', '呪い1枚を獲得します（獲得したら +1カード）。', reactOptions(p, pd, { type: 'SOOTHSAYER_REACT' }));

    /* ===== 拡張: 異郷（Hinterlands）===== */
    if (pd.type === 'oasis') return modalSingleHand(p, 'オアシス — 捨てる', '手札1枚を捨てます。', () => true, (card) => dispatch({ type: 'OASIS_RESOLVE', card }), null, '捨てる');
    if (pd.type === 'duchess_look') {
      const top = p.deck[0];
      return modalOptions('公爵夫人 — 山札の上' + (top ? '「' + DOM.CARDS[top].name + '」' : ''), '自分の山札の一番上を捨てられます（捨てると次に引く札が変わります）。', [
        { label: '捨てる', cls: 'btn-primary', on: () => dispatch({ type: 'DUCHESS_LOOK', discard: true }) },
        { label: 'そのまま', on: () => dispatch({ type: 'DUCHESS_LOOK', discard: false }) }]);
    }
    if (pd.type === 'develop' && pd.stage === 'trash') return modalSingleHand(p, '開発 — 廃棄', '廃棄するカードを1枚選びます（その後、ちょうど+1コスト/−1コストのカードを獲得）。', () => true, (card) => dispatch({ type: 'DEVELOP_TRASH', card }), null, '廃棄する');
    if (pd.type === 'develop' && pd.stage === 'gain') return modalGainSupply(state, '開発 — 獲得', 'ちょうどコスト $' + (pd.hiDone ? pd.lo : pd.hi) + (!pd.hiDone && !pd.loDone ? '（または $' + pd.lo + '）' : '') + ' のカードを1枚、山札の上に獲得します。',
      (id) => (!pd.hiDone && effCost(state, id) === pd.hi) || (!pd.loDone && effCost(state, id) === pd.lo), (id) => dispatch({ type: 'DEVELOP_GAIN', card: id }));
    if (pd.type === 'oracle' && pd.stage === 'react') return modalOptions('神託を受ける', '山札の上2枚が公開され、相手が捨てるか山札の上に戻すか決めます。', reactOptions(p, pd, { type: 'ORACLE_REACT' }));
    if (pd.type === 'oracle' && pd.stage === 'decide') {
      const who = pd.victim === pd.source ? '自分' : state.players[pd.victim].name;
      const names = (pd.cards || []).map((c) => DOM.CARDS[c].name).join('・');
      return modalOptions('神託 — ' + who + 'の上2枚「' + names + '」', who + 'の山札の上2枚をどうしますか？', [
        { label: '2枚とも捨てさせる', cls: 'btn-primary', on: () => dispatch({ type: 'ORACLE_DECIDE', discard: true }) },
        { label: '2枚とも山札の上に戻す', on: () => dispatch({ type: 'ORACLE_DECIDE', discard: false, order: (pd.cards || []).slice() }) }]);
    }
    if (pd.type === 'jack' && pd.stage === 'look') {
      const top = p.deck[0];
      return modalOptions('何でも屋 — 山札の上' + (top ? '「' + DOM.CARDS[top].name + '」' : ''), '山札の一番上を捨てられます。', [
        { label: '捨てる', cls: 'btn-primary', on: () => dispatch({ type: 'JACK_LOOK', discard: true }) },
        { label: 'そのまま', on: () => dispatch({ type: 'JACK_LOOK', discard: false }) }]);
    }
    if (pd.type === 'jack' && pd.stage === 'trash') return modalSingleHand(p, '何でも屋 — 廃棄（任意）', '財宝でないカードを1枚廃棄できます（しなくてもよい）。', (id) => !DOM.isType(id, 'treasure'), (card) => dispatch({ type: 'JACK_TRASH', card }), { label: '廃棄しない', on: () => dispatch({ type: 'JACK_TRASH', card: null }) }, '廃棄する');
    if (pd.type === 'noble_brigand' && pd.stage === 'react') return modalOptions('高貴な山賊を受ける', '山札の上2枚から、公開された銀貨/金貨1枚が廃棄され相手に奪われます。', reactOptions(p, pd, { type: 'NOBLE_BRIGAND_REACT' }));
    if (pd.type === 'noble_brigand' && pd.stage === 'pick') {
      const cands = []; (pd.revealed || []).forEach((c) => { if ((c === 'silver' || c === 'gold') && cands.indexOf(c) < 0) cands.push(c); });
      return modalOptions('高貴な山賊 — 廃棄する財宝を選ぶ', state.players[pd.victim].name + ' の公開財宝から、廃棄して獲得する1枚を選びます。', cands.map((c) => ({ label: DOM.CARDS[c].name, on: () => dispatch({ type: 'NOBLE_BRIGAND_PICK', card: c }) })));
    }
    if (pd.type === 'spice_merchant' && pd.stage === 'trash') return modalSingleHand(p, '香辛料商人 — 財宝を廃棄（任意）', '手札の財宝1枚を廃棄できます（廃棄するとボーナスを選べます）。', (id) => DOM.isType(id, 'treasure'), (card) => dispatch({ type: 'SPICE_MERCHANT_TRASH', card }), { label: '廃棄しない', on: () => dispatch({ type: 'SPICE_MERCHANT_TRASH', card: null }) }, '廃棄する');
    if (pd.type === 'spice_merchant' && pd.stage === 'choose') return modalOptions('香辛料商人', 'どちらかを選びます。', [
      { label: '+2 カード ＆ +1 アクション', cls: 'btn-primary', on: () => dispatch({ type: 'SPICE_MERCHANT_CHOOSE', choice: 'cards' }) },
      { label: '+2 コイン ＆ +1 購入', on: () => dispatch({ type: 'SPICE_MERCHANT_CHOOSE', choice: 'coins' }) }]);
    if (pd.type === 'trader' && pd.stage === 'trash') return modalSingleHand(p, '交易商人 — 廃棄', '手札から1枚を廃棄し、そのコスト（$）と同じ枚数の銀貨を獲得します。', () => true, (card) => dispatch({ type: 'TRADER_TRASH', card }), null, '廃棄する');
    if (pd.type === 'trader_react') return modalOptions('交易商人 — 銀貨に置き換える?', '獲得しようとしている「' + DOM.CARDS[pd.card].name + '」の代わりに、銀貨1枚を獲得できます。', [
      { label: '銀貨にする', cls: 'btn-primary', on: () => dispatch({ type: 'TRADER_REACT', reveal: true }) },
      { label: 'そのまま獲得', on: () => dispatch({ type: 'TRADER_REACT', reveal: false }) }]);
    if (pd.type === 'cartographer') return modalCartographer(pd);
    if (pd.type === 'embassy') return modalSelectN(p, '大使館 — 3枚捨てる', '手札を' + Math.min(3, p.hand.length) + '枚選んで捨てます。', Math.min(3, p.hand.length), '確定（捨てる）', (cards) => dispatch({ type: 'EMBASSY_DISCARD', cards }));
    if (pd.type === 'inn') return modalSelectN(p, '宿屋 — 2枚捨てる', '手札を' + Math.min(2, p.hand.length) + '枚選んで捨てます。', Math.min(2, p.hand.length), '確定（捨てる）', (cards) => dispatch({ type: 'INN_DISCARD', cards }));
    if (pd.type === 'inn_gain') {
      const acts = p.discard.filter((c) => DOM.isType(c, 'action'));
      return modalOptions('宿屋 — 捨て札のアクションを山札へ', '捨て札のアクション（' + acts.length + '枚）を山札に混ぜてシャッフルできます。', [
        { label: 'すべて山札に混ぜる（' + acts.length + '枚）', cls: 'btn-primary', on: () => dispatch({ type: 'INN_GAIN', cards: acts }) },
        { label: '混ぜない', on: () => dispatch({ type: 'INN_GAIN', cards: [] }) }]);
    }
    if (pd.type === 'mandarin') return modalSingleHand(p, '役人 — 山札の上に置く', '手札から1枚を選び、山札の一番上に置きます。', () => true, (card) => dispatch({ type: 'MANDARIN_TOPDECK', card }), null, '山札の上に置く');
    if (pd.type === 'margrave' && pd.stage === 'react') return modalOptions('辺境伯を受ける', '+1カードを引いた後、手札が3枚になるまで捨てます。', reactOptions(p, pd, { type: 'MARGRAVE_REACT' }));
    if (pd.type === 'margrave' && pd.stage === 'discard') return modalSelectN(p, '辺境伯 — 手札を捨てる', '手札が3枚になるまで（' + (p.hand.length - 3) + '枚）捨てます。', Math.max(0, p.hand.length - 3), '確定（捨てる）', (cards) => dispatch({ type: 'MARGRAVE_DISCARD', cards }));
    if (pd.type === 'stables') return modalSingleHand(p, '厩舎 — 財宝を捨てる（任意）', '財宝1枚を捨てると +3カード +1アクション（しなくてもよい）。', (id) => DOM.isType(id, 'treasure'), (card) => dispatch({ type: 'STABLES_DISCARD', card }), { label: '捨てない', on: () => dispatch({ type: 'STABLES_DISCARD', card: null }) }, '捨てる');
    if (pd.type === 'border_village') return modalGainSupply(state, '国境の村 — 獲得', 'コスト ' + pd.maxCost + ' 以下のカードを1枚獲得します。', (id) => effCost(state, id) <= pd.maxCost, (id) => dispatch({ type: 'BORDER_VILLAGE_GAIN', card: id }));
    if (pd.type === 'weaver' && pd.stage === 'gain') return modalGainSupply(state, '織工 — 獲得', 'コスト4以下のカードを1枚獲得します。', (id) => effCost(state, id) <= 4, (id) => dispatch({ type: 'WEAVER_GAIN', card: id }));
    if (pd.type === 'weaver') return modalOptions('織工', 'どちらかを選びます。', [
      { label: '銀貨2枚を獲得', cls: 'btn-primary', on: () => dispatch({ type: 'WEAVER_MODE', mode: 'silver' }) },
      { label: 'コスト4以下のカード1枚を獲得', on: () => dispatch({ type: 'WEAVER_MODE', mode: 'card' }) }]);
    if (pd.type === 'souk_trash') return modalMultiHand(p, 'スーク — 廃棄', '手札から最大2枚を廃棄します（0枚でもよい）。', (n) => '確定（' + n + '枚 廃棄）', true, (cards) => dispatch({ type: 'SOUK_TRASH', cards }), 2);
    if (pd.type === 'berserker' && pd.stage === 'react') return modalOptions('狂戦士を受ける', '手札が3枚になるまで捨てます。', reactOptions(p, pd, { type: 'BERSERKER_REACT' }));
    if (pd.type === 'berserker' && pd.stage === 'discard') return modalSelectN(p, '狂戦士 — 手札を捨てる', '手札が3枚になるまで（' + (p.hand.length - 3) + '枚）捨てます。', Math.max(0, p.hand.length - 3), '確定（捨てる）', (cards) => dispatch({ type: 'BERSERKER_DISCARD', cards }));
    if (pd.type === 'berserker' && pd.stage === 'gain') return modalGainSupply(state, '狂戦士 — 獲得', 'コスト ' + pd.maxCost + ' 以下のカードを1枚獲得します。', (id) => effCost(state, id) <= pd.maxCost, (id) => dispatch({ type: 'BERSERKER_GAIN', card: id }));
    if (pd.type === 'wheelwright' && pd.stage === 'discard') return modalSingleHand(p, '車大工 — 捨てる（任意）', '手札1枚を捨てると、そのコスト以下のアクションカードを獲得できます（しなくてもよい）。', () => true, (card) => dispatch({ type: 'WHEELWRIGHT_DISCARD', card }), { label: '捨てない', on: () => dispatch({ type: 'WHEELWRIGHT_DISCARD', card: null }) }, '捨てる');
    if (pd.type === 'wheelwright' && pd.stage === 'gain') return modalGainSupply(state, '車大工 — 獲得', 'コスト ' + pd.maxCost + ' 以下のアクションカードを1枚獲得します。', (id) => DOM.isType(id, 'action') && effCost(state, id) <= pd.maxCost, (id) => dispatch({ type: 'WHEELWRIGHT_GAIN', card: id }));
    if (pd.type === 'witchs_hut' && pd.stage === 'react') return modalOptions('魔女の小屋を受ける', '呪い1枚を獲得します。', reactOptions(p, pd, { type: 'WITCHS_HUT_REACT' }));
    if (pd.type === 'witchs_hut' && pd.stage === 'discard') return modalSelectN(p, '魔女の小屋 — 公開して捨てる', '手札を' + Math.min(2, p.hand.length) + '枚選んで公開・捨てます（両方アクションなら相手に呪い）。', Math.min(2, p.hand.length), '確定（捨てる）', (cards) => dispatch({ type: 'WITCHS_HUT_DISCARD', cards }));
    if (pd.type === 'cauldron' && pd.stage === 'react') return modalOptions('大釜を受ける', '呪い1枚を獲得します。', reactOptions(p, pd, { type: 'CAULDRON_REACT' }));
    if (pd.type === 'duchess_gain') return modalOptions('公爵夫人を獲得?', '公領を獲得しました。公爵夫人1枚を獲得できます。', [
      { label: '公爵夫人を獲得する', cls: 'btn-primary', on: () => dispatch({ type: 'DUCHESS_GAIN', gain: true }) },
      { label: '獲得しない', on: () => dispatch({ type: 'DUCHESS_GAIN', gain: false }) }]);
    if (pd.type === 'farmland' && pd.stage === 'trash') return modalSingleHand(p, '農地 — 廃棄', '手札から1枚を廃棄し、ちょうど$2高いカードを獲得します。', () => true, (card) => dispatch({ type: 'FARMLAND_TRASH', card }), null, '廃棄する');
    if (pd.type === 'farmland' && pd.stage === 'gain') return modalGainSupply(state, '農地 — 獲得', 'ちょうどコスト $' + pd.exactCost + ' のカードを1枚獲得します。', (id) => effCost(state, id) === pd.exactCost, (id) => dispatch({ type: 'FARMLAND_GAIN', card: id }));
    if (pd.type === 'haggler') return modalGainSupply(state, '値切り屋 — 獲得', 'コスト ' + pd.maxCost + ' 以下の、勝利点でないカードを1枚獲得します。', (id) => !DOM.isType(id, 'victory') && effCost(state, id) <= pd.maxCost, (id) => dispatch({ type: 'HAGGLER_GAIN', card: id }));
    if (pd.type === 'fools_gold_react') return modalOptions('愚者の黄金 — 反応', '相手が属州を獲得しました。手札の愚者の黄金を廃棄して金貨1枚を山札の上に獲得できます。', [
      { label: '愚者の黄金を廃棄して金貨を獲得', cls: 'btn-primary', on: () => dispatch({ type: 'FOOLS_GOLD_REACT', trash: true }) },
      { label: '何もしない', on: () => dispatch({ type: 'FOOLS_GOLD_REACT', trash: false }) }]);
    if (pd.type === 'igg_play') return modalOptions('不正利得', '銅貨1枚を手札に獲得できます。', [
      { label: '銅貨を手札に獲得', cls: 'btn-primary', on: () => dispatch({ type: 'IGG_PLAY', gain: true }) },
      { label: '獲得しない', on: () => dispatch({ type: 'IGG_PLAY', gain: false }) }]);
    if (pd.type === 'scheme_cleanup') return modalSchemeCleanup(p, pd.max || 0);

    /* ===== 暗黒時代（Dark Ages）===== */
    // --- 単純系（既存24枚のUIもここで実装）---
    if (pd.type === 'survivors') return modalOptions('生存者 — 山札の上' + pd.cards.length + '枚', '「' + pd.cards.map((c) => DOM.CARDS[c].name).join('・') + '」をどうしますか？', [
      { label: '両方 山札の上に戻す', cls: 'btn-primary', on: () => dispatch({ type: 'SURVIVORS_RESOLVE', choice: 'topdeck', order: pd.cards.slice() }) },
      { label: '両方 捨てる', on: () => dispatch({ type: 'SURVIVORS_RESOLVE', choice: 'discard' }) }]);
    if (pd.type === 'rats_trash') return modalSingleHand(p, 'ネズミ — 廃棄', 'ネズミ以外の手札を1枚廃棄します。', (id) => id !== 'rats', (card) => dispatch({ type: 'RATS_TRASH', card }));
    if (pd.type === 'armory') return modalGainSupply(state, '武器庫 — 獲得', 'コスト4以下のカードを1枚、山札の上に獲得します。', (id) => effCost(state, id) <= 4, (id) => dispatch({ type: 'ARMORY_GAIN', card: id }), () => dispatch({ type: 'ARMORY_GAIN', card: null }));
    if (pd.type === 'forager') return modalSingleHand(p, '採集者 — 廃棄', '手札1枚を廃棄します（廃棄置き場の異なる財宝の種類ぶん +$1）。', () => true, (card) => dispatch({ type: 'FORAGER_TRASH', card }));
    if (pd.type === 'squire') return modalOptions('従者', '次から1つを選びます。', [
      { label: '+2 アクション', on: () => dispatch({ type: 'SQUIRE_RESOLVE', choice: 'actions' }) },
      { label: '+2 購入', on: () => dispatch({ type: 'SQUIRE_RESOLVE', choice: 'buys' }) },
      { label: '銀貨を獲得', on: () => dispatch({ type: 'SQUIRE_RESOLVE', choice: 'silver' }) }]);
    if (pd.type === 'squire_trash_gain') return modalGainSupply(state, '従者 — アタックを獲得', '（廃棄された従者）サプライのアタックカードを1枚獲得します。', (id) => DOM.isType(id, 'attack'), (id) => dispatch({ type: 'SQUIRE_TRASH_GAIN', card: id }), () => dispatch({ type: 'SQUIRE_TRASH_GAIN', card: null }));
    if (pd.type === 'storeroom') return modalMultiHand(p, pd.stage === 'discard1' ? '倉庫 — 捨てて引く' : '倉庫 — 捨てて+$1', pd.stage === 'discard1' ? '好きな枚数を捨て、同じ枚数を引きます（0枚でもOK）。' : '好きな枚数を捨て、捨てた枚数ぶん +$1（0枚でもOK）。', (n) => '確定（' + n + '枚捨て）', true, (cards) => dispatch({ type: 'STOREROOM_DISCARD', cards }));
    if (pd.type === 'scavenger' && pd.stage === 'deck') return modalOptions('清掃', '山札をすべて捨て札にできます（その後、捨て札から1枚を山札の上に置きます）。', [
      { label: '山札を捨て札にする', cls: 'btn-primary', on: () => dispatch({ type: 'SCAVENGER_DECK', discardDeck: true }) },
      { label: 'そのまま', on: () => dispatch({ type: 'SCAVENGER_DECK', discardDeck: false }) }]);
    if (pd.type === 'scavenger' && pd.stage === 'topdeck') return modalPickList(state, '清掃 — 山札の上へ', '捨て札から1枚を選んで山札の上に置きます。', p.discard, '山札の上に置く', (id) => dispatch({ type: 'SCAVENGER_TOPDECK', card: id }));
    if (pd.type === 'ironmonger') return modalOptions('鉄物商 — 山札の上「' + DOM.CARDS[pd.card].name + '」', '公開したカードを捨てるか山札に残すか選びます（どちらでも種別ボーナスを得ます）。', [
      { label: '山札に残す', cls: 'btn-primary', on: () => dispatch({ type: 'IRONMONGER_RESOLVE', discard: false }) },
      { label: '捨てる', on: () => dispatch({ type: 'IRONMONGER_RESOLVE', discard: true }) }]);
    if (pd.type === 'minstrel') return modalReorder('旅の楽団 — 山札の上に戻す', 'アクションを山札の上に戻す順番をタップで選びます（最初が一番上）。', pd.cards, (order) => dispatch({ type: 'MINSTREL_RESOLVE', order }));
    // --- Group A ---
    if (pd.type === 'junk_dealer') return modalSingleHand(p, '屑屋 — 廃棄', '手札1枚を廃棄します。', () => true, (card) => dispatch({ type: 'JUNK_DEALER_TRASH', card }));
    if (pd.type === 'mystic') return modalNameCard(state, '秘術師 — 宣言', 'カードを1種宣言します。山札の一番上がそれなら手札に加わります。', (id) => dispatch({ type: 'MYSTIC_NAME', card: id }));
    if (pd.type === 'altar' && pd.stage === 'trash') return modalSingleHand(p, '祭壇 — 廃棄', '手札1枚を廃棄します（その後、コスト5以下を1枚獲得）。', () => true, (card) => dispatch({ type: 'ALTAR_TRASH', card }));
    if (pd.type === 'altar' && pd.stage === 'gain') return modalGainSupply(state, '祭壇 — 獲得', 'コスト5以下のカードを1枚獲得します。', (id) => effCost(state, id) <= 5, (id) => dispatch({ type: 'ALTAR_GAIN', card: id }), () => dispatch({ type: 'ALTAR_GAIN', card: null }));
    if (pd.type === 'catacombs') return modalOptions('地下墓所 — 山札の上3枚', '「' + pd.cards.map((c) => DOM.CARDS[c].name).join('・') + '」をどうしますか？', [
      { label: '3枚を手札に加える', cls: 'btn-primary', on: () => dispatch({ type: 'CATACOMBS_RESOLVE', choice: 'hand' }) },
      { label: '3枚を捨てて +3カード', on: () => dispatch({ type: 'CATACOMBS_RESOLVE', choice: 'discard' }) }]);
    if (pd.type === 'catacombs_trash') return modalGainSupply(state, '地下墓所 — 獲得', '（廃棄された地下墓所）これより安いカードを1枚獲得します。', (id) => effCost(state, id) < pd.under, (id) => dispatch({ type: 'CATACOMBS_TRASH_GAIN', card: id }), () => dispatch({ type: 'CATACOMBS_TRASH_GAIN', card: null }));
    if (pd.type === 'hunting_grounds_trash') return modalOptions('狩場 — 廃棄時の獲得', '（廃棄された狩場）公領1枚か屋敷3枚を獲得します。', [
      { label: '公領を獲得', cls: 'btn-primary', on: () => dispatch({ type: 'HUNTING_GROUNDS_TRASH', choice: 'duchy' }) },
      { label: '屋敷3枚を獲得', on: () => dispatch({ type: 'HUNTING_GROUNDS_TRASH', choice: 'estates' }) }]);
    // --- Group B ---
    if (pd.type === 'graverobber' && pd.stage === 'choose') return modalOptions('墓暴き', '次から1つを選びます。', [
      { label: '廃棄置き場の$3〜$6を山札の上に獲得', cls: 'btn-primary', on: () => dispatch({ type: 'GRAVEROBBER_MODE', mode: 'from_trash' }) },
      { label: '手札のアクションを廃棄→+$3までを獲得', on: () => dispatch({ type: 'GRAVEROBBER_MODE', mode: 'trash_gain' }) }]);
    if (pd.type === 'graverobber' && pd.stage === 'from_trash') return modalPickList(state, '墓暴き — 廃棄置き場から獲得', '廃棄置き場のコスト$3〜$6のカードを1枚、山札の上に獲得します。', (state.trash || []).filter((c) => { const cc = effCost(state, c); return cc >= 3 && cc <= 6 && !DOM.CARDS[c].potion; }), '獲得する', (id) => dispatch({ type: 'GRAVEROBBER_FROM_TRASH', card: id }));
    if (pd.type === 'graverobber' && pd.stage === 'trash') return modalSingleHand(p, '墓暴き — アクションを廃棄', '手札のアクション1枚を廃棄します（その後、+$3までを獲得）。', (id) => DOM.isType(id, 'action'), (card) => dispatch({ type: 'GRAVEROBBER_TRASH', card }));
    if (pd.type === 'graverobber' && pd.stage === 'gain') return modalGainSupply(state, '墓暴き — 獲得', 'コスト ' + pd.maxCost + ' 以下のカードを1枚獲得します。', (id) => effCost(state, id) <= pd.maxCost, (id) => dispatch({ type: 'GRAVEROBBER_GAIN', card: id }), () => dispatch({ type: 'GRAVEROBBER_GAIN', card: null }));
    if (pd.type === 'rebuild' && pd.stage === 'name') return modalNameCard(state, '建て直し — 指定', '勝利点カードを1種指定します（指定しなかった勝利点を廃棄→格上げ）。', (id) => dispatch({ type: 'REBUILD_NAME', card: id }));
    if (pd.type === 'rebuild' && pd.stage === 'gain') return modalGainSupply(state, '建て直し — 獲得', 'コスト ' + pd.maxCost + ' 以下の勝利点カードを1枚獲得します。', (id) => DOM.isType(id, 'victory') && effCost(state, id) <= pd.maxCost, (id) => dispatch({ type: 'REBUILD_GAIN', card: id }), () => dispatch({ type: 'REBUILD_GAIN', card: null }));
    if (pd.type === 'count' && pd.stage === 'part1') return modalOptions('伯爵 — 前半', '次から1つを選びます。', [
      { label: '手札2枚を捨てる', on: () => dispatch({ type: 'COUNT_PART1', mode: 'discard2' }) },
      { label: '手札1枚を山札の上に置く', on: () => dispatch({ type: 'COUNT_PART1', mode: 'topdeck' }) },
      { label: '銅貨を獲得', on: () => dispatch({ type: 'COUNT_PART1', mode: 'copper' }) }]);
    if (pd.type === 'count' && pd.stage === 'discard') return modalSelectN(p, '伯爵 — 2枚捨てる', '手札から ' + pd.need + '枚 を選んで捨てます。', pd.need, '確定（捨てる）', (cards) => dispatch({ type: 'COUNT_DISCARD', cards }));
    if (pd.type === 'count' && pd.stage === 'topdeck') return modalSingleHand(p, '伯爵 — 山札の上に置く', '手札1枚を山札の上に置きます。', () => true, (card) => dispatch({ type: 'COUNT_TOPDECK', card }), null, '山札の上に置く');
    if (pd.type === 'count' && pd.stage === 'part2') return modalOptions('伯爵 — 後半', '次から1つを選びます。', [
      { label: '+$3', cls: 'btn-primary', on: () => dispatch({ type: 'COUNT_PART2', mode: 'coins' }) },
      { label: '手札を全て廃棄', on: () => dispatch({ type: 'COUNT_PART2', mode: 'trashhand' }) },
      { label: '公領を獲得', on: () => dispatch({ type: 'COUNT_PART2', mode: 'duchy' }) }]);
    // --- Group C ---
    if (pd.type === 'death_cart') return modalDeathCart(p);
    if (pd.type === 'band_of_misfits') {
      const cands = (E() && E().bandOfMisfitsTargets) ? E().bandOfMisfitsTargets(state) : [];
      return modalGainSupply(state, 'はみだし者 — サプライのカードを使う', 'サプライにある「これより安い・非命令・非持続のアクション」を、サプライに残したまま使用します。', (id) => cands.includes(id), (id) => dispatch({ type: 'BAND_OF_MISFITS_PLAY', card: id }), () => dispatch({ type: 'BAND_OF_MISFITS_PLAY', card: null }), false, '使う');
    }
    if (pd.type === 'hermit' && pd.stage === 'trash') return modalHermitTrash(p);
    if (pd.type === 'hermit' && pd.stage === 'gain') return modalGainSupply(state, '隠遁者 — 獲得', 'コスト3以下のカードを1枚獲得します。', (id) => effCost(state, id) <= 3, (id) => dispatch({ type: 'HERMIT_GAIN', card: id }), () => dispatch({ type: 'HERMIT_GAIN', card: null }));
    if (pd.type === 'procession') return modalSingleHand(p, '行進 — 2回使うアクション', '手札の非持続アクション1枚を選ぶと2回使い、廃棄して、ちょうど+$1高いアクションを獲得します（使わなくてもよい）。', (id) => DOM.isType(id, 'action') && !DOM.isType(id, 'duration'), (card) => dispatch({ type: 'PROCESSION_CHOOSE', card }), { label: '使わない', on: () => dispatch({ type: 'PROCESSION_CHOOSE', card: null }) }, '2回使う');
    if (pd.type === 'procession_gain') return modalGainSupply(state, '行進 — 獲得', 'ちょうどコスト $' + pd.exact + (pd.pot ? 'P' : '') + ' のアクションを1枚獲得します。', (id) => DOM.isType(id, 'action') && effCost(state, id) === pd.exact && (DOM.CARDS[id].potion || 0) === (pd.pot || 0), (id) => dispatch({ type: 'PROCESSION_GAIN', card: id }));
    if (pd.type === 'counterfeit') return modalSingleHand(p, '偽造通貨 — 2回使う財宝', '手札の非持続財宝1枚を選ぶと2回使い、それを廃棄します（使わなくてもよい）。', (id) => DOM.isType(id, 'treasure') && !DOM.isType(id, 'duration'), (card) => dispatch({ type: 'COUNTERFEIT_PLAY', card }), { label: '使わない', on: () => dispatch({ type: 'COUNTERFEIT_PLAY', card: null }) }, '2回使う');
    // --- Group D（アタック）---
    if (pd.type === 'relic' && pd.stage === 'react') return modalOptions('遺物を受ける', '-1カードトークンを受け取ります（次に引く手札が1枚少なくなります）。', reactOptions(p, pd, { type: 'RELIC_REACT' }));
    if (pd.type === 'giant' && pd.stage === 'react') return modalOptions('巨人を受ける', '山札の一番上を公開し、コスト$3〜$6なら廃棄、そうでなければ捨てて呪い1枚を獲得します。', reactOptions(p, pd, { type: 'GIANT_REACT' }));
    if (pd.type === 'bridge_troll' && pd.stage === 'react') return modalOptions('橋の下のトロルを受ける', '-$1トークンを受け取ります（次の購入フェイズに使えるコインが$1減ります）。', reactOptions(p, pd, { type: 'BRIDGE_TROLL_REACT' }));
    if (pd.type === 'marauder' && pd.stage === 'react') return modalOptions('略奪者を受ける', '廃墟を1枚獲得します。', reactOptions(p, pd, { type: 'MARAUDER_REACT' }));
    if (pd.type === 'cultist' && pd.stage === 'react') return modalOptions('狂信者を受ける', '廃墟を1枚獲得します。', reactOptions(p, pd, { type: 'CULTIST_REACT' }));
    if (pd.type === 'cultist_chain') return modalOptions('狂信者 — 連鎖', '手札の狂信者を（アクションを消費せず）続けて使えます。', [
      { label: '狂信者を使う', cls: 'btn-primary', on: () => dispatch({ type: 'CULTIST_CHAIN', play: true }) },
      { label: '使わない', on: () => dispatch({ type: 'CULTIST_CHAIN', play: false }) }]);
    if (pd.type === 'pillage' && pd.stage === 'react') return modalOptions('略奪を受ける', '手札を公開し、相手が選んだ1枚を捨てます。', reactOptions(p, pd, { type: 'PILLAGE_REACT' }));
    if (pd.type === 'pillage' && pd.stage === 'pick') return modalOptions('略奪 — 捨てさせる', state.players[pd.victim].name + 'の公開手札から、捨てさせる1枚を選びます。', state.players[pd.victim].hand.map((c) => ({ label: DOM.CARDS[c].name, on: () => dispatch({ type: 'PILLAGE_PICK', card: c }) })));
    if (pd.type === 'rogue' && pd.stage === 'react') return modalOptions('盗賊を受ける', '山札の上2枚から$3〜$6の1枚を廃棄します。', reactOptions(p, pd, { type: 'ROGUE_REACT' }));
    if (pd.type === 'rogue' && pd.stage === 'pick') return modalOptions('盗賊 — 廃棄するカード', '公開した2枚のうち、廃棄する1枚を選びます。', (pd.trashable || []).map((c) => ({ label: DOM.CARDS[c].name, on: () => dispatch({ type: 'ROGUE_PICK', card: c }) })));
    if (pd.type === 'rogue' && pd.stage === 'gain_from_trash') return modalPickList(state, '盗賊 — 廃棄置き場から獲得', '廃棄置き場のコスト$3〜$6のカードを1枚獲得します。', (state.trash || []).filter((c) => { const cc = effCost(state, c); return cc >= 3 && cc <= 6 && !DOM.CARDS[c].potion; }), '獲得する', (id) => dispatch({ type: 'ROGUE_GAIN_FROM_TRASH', card: id }));
    if (pd.type === 'discard_down') return modalDiscardDown(p, pd);
    if (pd.type === 'mercenary' && pd.stage === 'trash') return modalMercenaryTrash(p);
    if (pd.type === 'urchin_trash') return modalOptions('浮浪児 — 傭兵化', '場の浮浪児を廃棄して傭兵を獲得できます（別のアタックの解決前）。', [
      { label: '浮浪児を廃棄して傭兵を獲得', cls: 'btn-primary', on: () => dispatch({ type: 'URCHIN_TRASH', trash: true }) },
      { label: 'そのまま', on: () => dispatch({ type: 'URCHIN_TRASH', trash: false }) }]);
    // --- Group E（騎士）---
    if (pd.type === 'knight' && pd.stage === 'react') return modalOptions('騎士を受ける', '山札の上2枚から$3〜$6の1枚を廃棄します。', reactOptions(p, pd, { type: 'KNIGHT_REACT' }));
    if (pd.type === 'knight' && pd.stage === 'pick') return modalOptions('騎士 — 廃棄するカード', '公開した2枚のうち、廃棄する1枚を選びます（騎士を廃棄すると相手の騎士も廃棄されます）。', (pd.trashable || []).map((c) => ({ label: DOM.CARDS[c].name, on: () => dispatch({ type: 'KNIGHT_PICK', card: c }) })));
    if (pd.type === 'dame_anna_trash') return modalMultiHand(p, 'デイム・アンナ — 廃棄', '手札から最大2枚を廃棄できます（0枚でもOK）。', (n) => '確定（' + n + '枚 廃棄）', true, (cards) => dispatch({ type: 'DAME_ANNA_TRASH', cards }), 2);
    if (pd.type === 'dame_natalie_gain') return modalGainSupply(state, 'デイム・ナタリー — 獲得（任意）', 'コスト3以下のカードを1枚獲得できます（しなくてもよい）。', (id) => effCost(state, id) <= 3, (id) => dispatch({ type: 'DAME_NATALIE_GAIN', card: id }), () => dispatch({ type: 'DAME_NATALIE_GAIN', card: null }), true);
    // リアクション（青空市場＝廃棄時に金貨／納屋＝勝利点獲得時に廃棄）
    if (pd.type === 'market_square_react') return modalOptions('青空市場 — リアクション', 'あなたのカードが廃棄されました。手札の青空市場を捨てて金貨1枚を獲得できます。', [
      { label: '青空市場を捨てて金貨を獲得', cls: 'btn-primary', on: () => dispatch({ type: 'MARKET_SQUARE_REACT', discard: true }) },
      { label: 'しない', on: () => dispatch({ type: 'MARKET_SQUARE_REACT', discard: false }) }]);
    if (pd.type === 'hovel_react') return modalOptions('納屋 — リアクション', '勝利点カードを獲得しました。手札の納屋を廃棄できます（圧縮）。', [
      { label: '納屋を廃棄する', cls: 'btn-primary', on: () => dispatch({ type: 'HOVEL_REACT', trash: true }) },
      { label: 'しない', on: () => dispatch({ type: 'HOVEL_REACT', trash: false }) }]);

    return h('div');
  }

  // 被攻撃側の反応オプション（堀・秘密の小部屋・そのまま受ける）。proceed は通すときのアクション。
  // 外交官のリアクションが可能か（手札5枚以上で公開→2引き3捨て。1アタックにつき1回）
  function canDiplomatReact(p, pd) {
    return p.hand.includes('diplomat') && p.hand.length >= 5 && !pd.diplomatReacted;
  }
  function reactOptions(p, pd, proceed) {
    const opts = [];
    if (p.hand.includes('moat')) opts.push({ label: '🛡 堀を公開して無効化', cls: 'btn-primary', on: () => dispatch({ type: 'MOAT_REVEAL' }) });
    if (p.hand.includes('secret_chamber') && !pd.reacted) opts.push({ label: '🔮 秘密の小部屋を公開（+2引いて2枚戻す）', on: () => dispatch({ type: 'SECRET_CHAMBER_REVEAL' }) });
    if (canDiplomatReact(p, pd)) opts.push({ label: '🤝 外交官を公開（+2引いて3枚捨てる）', on: () => dispatch({ type: 'DIPLOMAT_REVEAL' }) });
    if (p.hand.includes('horse_traders')) opts.push({ label: '🐴 馬商人を脇に置く（次の手番に +1カードで戻る／攻撃は受ける）', on: () => dispatch({ type: 'HORSE_TRADERS_REACT' }) });
    if (p.hand.includes('guard_dog')) opts.push({ label: '🐕 番犬を先に使う（+2〜4カード／攻撃は受ける）', on: () => dispatch({ type: 'GUARD_DOG_REACT' }) });
    if (p.hand.includes('beggar')) opts.push({ label: '🥺 物乞いを捨てて銀貨2枚を獲得（1枚は山札の上／攻撃は受ける）', on: () => dispatch({ type: 'BEGGAR_REACT' }) });
    opts.push({ label: 'そのまま受ける', on: () => dispatch(proceed) });
    return opts;
  }
  // 異郷：地図職人＝山札の上4枚から捨てる札をタップで選ぶ（残りは公開順のまま山札の上へ）。
  function modalCartographer(pd) {
    const cards = pd.cards || [];
    const chips = cards.map((id, idx) =>
      cardEl(id, { size: 'sm', extra: UI.selection.includes(idx) ? 'selected' : 'selectable',
        badge: UI.selection.includes(idx) ? '捨' : null,
        onClick: () => { const i = UI.selection.indexOf(idx); if (i >= 0) UI.selection.splice(i, 1); else UI.selection.push(idx); render(); } }));
    const footer = h('button', { class: 'btn btn-primary btn-block',
      onclick: () => { const discard = UI.selection.map((i) => cards[i]); const top = cards.filter((c, i) => UI.selection.indexOf(i) < 0); dispatch({ type: 'CARTOGRAPHER_RESOLVE', discard, top }); } },
      '確定（' + UI.selection.length + '枚 捨て、残り ' + (cards.length - UI.selection.length) + '枚 を山札の上へ）');
    return modalShell('地図職人 — 山札の上4枚', 'タップして捨てるカードを選びます（選ばなかったカードは公開順のまま山札の上に戻ります）。', chips, footer);
  }
  // 異郷：策謀＝場のアクション（非持続）を最大 max 枚、山札の上に置く（タップで選択・0枚でもよい）。
  function modalSchemeCleanup(p, max) {
    const elig = p.inPlay.map((id, idx) => ({ id, idx })).filter((x) => DOM.isType(x.id, 'action') && !DOM.isType(x.id, 'duration'));
    const chips = elig.map((x) =>
      cardEl(x.id, { size: 'sm', extra: UI.selection.includes(x.idx) ? 'selected' : 'selectable',
        onClick: () => { const i = UI.selection.indexOf(x.idx); if (i >= 0) UI.selection.splice(i, 1); else if (UI.selection.length < max) UI.selection.push(x.idx); render(); } }));
    const footer = h('button', { class: 'btn btn-primary btn-block',
      onclick: () => dispatch({ type: 'SCHEME_CLEANUP', cards: UI.selection.map((i) => p.inPlay[i]) }) },
      '確定（' + UI.selection.length + '枚 を山札の上へ）');
    return modalShell('策謀 — 山札の上に置く', '最大 ' + max + ' 枚まで、場のアクションを山札の上に置けます（次のターンに引きます・0枚でもよい）。', chips, footer);
  }
  // 暗黒時代：死の荷車＝これ自身か手札のアクション1枚を廃棄→+$5（しなくてもよい）。
  function modalDeathCart(p) {
    const acts = [...new Set(p.hand.filter((id) => DOM.isType(id, 'action')))];
    const buttons = [h('button', { class: 'btn btn-primary btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'DEATH_CART_RESOLVE', mode: 'this' }) }, '死の荷車自身を廃棄（+$5）')];
    acts.forEach((id) => buttons.push(h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'DEATH_CART_RESOLVE', mode: 'hand', card: id }) }, '「' + DOM.CARDS[id].name + '」を廃棄（+$5）')));
    buttons.push(h('button', { class: 'btn btn-block', onclick: () => dispatch({ type: 'DEATH_CART_RESOLVE', mode: 'none' }) }, '廃棄しない'));
    return modalShell('死の荷車', 'これ自身か手札のアクション1枚を廃棄すると +$5（しなくてもよい）。', [], h('div', null, buttons));
  }
  // 暗黒時代：隠遁者＝手札か捨て札の非財宝を1枚廃棄できる（任意）。
  function modalHermitTrash(p) {
    const handNT = [...new Set(p.hand.filter((id) => !DOM.isType(id, 'treasure')))];
    const discNT = [...new Set(p.discard.filter((id) => !DOM.isType(id, 'treasure')))];
    const buttons = [];
    handNT.forEach((id) => buttons.push(h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'HERMIT_TRASH', from: 'hand', card: id }) }, '手札「' + DOM.CARDS[id].name + '」を廃棄')));
    discNT.forEach((id) => buttons.push(h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'HERMIT_TRASH', from: 'discard', card: id }) }, '捨て札「' + DOM.CARDS[id].name + '」を廃棄')));
    buttons.push(h('button', { class: 'btn btn-block', onclick: () => dispatch({ type: 'HERMIT_TRASH', card: null }) }, '廃棄しない'));
    return modalShell('隠遁者 — 廃棄（任意）', '手札か捨て札の非財宝を1枚廃棄できます（その後、コスト3以下を1枚獲得）。', [], h('div', null, buttons));
  }
  // 暗黒時代：手札N枚まで捨てる汎用アタック（浮浪児/傭兵/サー・マイケル）。堀・馬商人・番犬で反応可。
  function modalDiscardDown(p, pd) {
    const need = p.hand.length - Math.min(pd.down, p.hand.length);
    const hasMoat = p.hand.includes('moat');
    const chips = p.hand.map((id, idx) =>
      cardEl(id, { size: 'sm', extra: UI.selection.includes(idx) ? 'selected' : 'selectable',
        onClick: () => { const i = UI.selection.indexOf(idx); if (i >= 0) UI.selection.splice(i, 1); else if (UI.selection.length < need) UI.selection.push(idx); render(); } }));
    const remain = need - UI.selection.length;
    const footer = h('div', null,
      hasMoat ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'MOAT_REVEAL' }) }, '🛡 堀を公開して無効化') : null,
      p.hand.includes('horse_traders') ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'HORSE_TRADERS_REACT' }) }, '🐴 馬商人を脇に置く（次の手番に +1カードで戻る／攻撃は受ける）') : null,
      p.hand.includes('beggar') ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'BEGGAR_REACT' }) }, '🥺 物乞いを捨てて銀貨2枚を獲得（1枚は山札の上／攻撃は受ける）') : null,
      p.hand.includes('guard_dog') ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'GUARD_DOG_REACT' }) }, '🐕 番犬を先に使う（+2〜4カード／攻撃は受ける）') : null,
      h('button', { class: 'btn btn-primary btn-block', disabled: remain === 0 ? null : 'disabled',
        onclick: () => dispatch({ type: 'DISCARD_DOWN_RESOLVE', cards: UI.selection.map((i) => p.hand[i]) }) },
        remain === 0 ? '確定（捨てる）' : 'あと ' + remain + ' 枚 選ぶ'));
    return modalShell('攻撃を受ける — 手札' + pd.down + '枚まで捨てる', '手札が' + pd.down + '枚になるまで捨てます。' + (hasMoat ? '「堀」で無効化もできます。' : ''), chips, footer);
  }
  // 暗黒時代：傭兵＝ちょうど2枚を廃棄すると効果発動（0枚＝廃棄しない）。
  function modalMercenaryTrash(p) {
    const chips = p.hand.map((id, idx) =>
      cardEl(id, { size: 'sm', extra: UI.selection.includes(idx) ? 'selected' : 'selectable',
        onClick: () => { const i = UI.selection.indexOf(idx); if (i >= 0) UI.selection.splice(i, 1); else if (UI.selection.length < 2) UI.selection.push(idx); render(); } }));
    const k = UI.selection.length;
    const footer = h('div', null,
      h('button', { class: 'btn btn-primary btn-block', disabled: k >= 1 ? null : 'disabled', style: 'margin-bottom:8px',
        onclick: () => dispatch({ type: 'MERCENARY_TRASH', cards: UI.selection.map((i) => p.hand[i]) }) },
        k === 2 ? '2枚廃棄（+2カード +$2＋アタック）' : (k === 1 ? '1枚だけ廃棄（効果は不発）' : '廃棄する2枚を選ぶ')),
      h('button', { class: 'btn btn-block', onclick: () => dispatch({ type: 'MERCENARY_TRASH', cards: [] }) }, '廃棄しない'));
    return modalShell('傭兵 — 廃棄', '手札からちょうど2枚を廃棄すると +2カード +$2、各相手が手札3枚まで捨てます（1枚だけの廃棄も可・その場合は効果なし・しなくてもよい）。', chips, footer);
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
  function modalMilitia(p, need, hasMoat, hasSecret, hasDiplomat) {
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
      hasDiplomat ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'DIPLOMAT_REVEAL' }) }, '🤝 外交官を公開（+2引いて3枚捨てる）') : null,
      p.hand.includes('horse_traders') ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'HORSE_TRADERS_REACT' }) }, '🐴 馬商人を脇に置く（次の手番に +1カードで戻る／攻撃は受ける）') : null,
      p.hand.includes('beggar') ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'BEGGAR_REACT' }) }, '🥺 物乞いを捨てて銀貨2枚を獲得（1枚は山札の上／攻撃は受ける）') : null,
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

  // 指定したカードid配列から1枚を選ぶ（任意でスキップ）。前駆者の捨て札・使者・待ち伏せ獲得など。
  function modalPickList(state, title, desc, cards, pickLabel, onPick, skip) {
    const chips = cards.length
      ? cards.map((id) => cardEl(id, { size: 'sm', extra: 'selectable', onClick: () => openPickZoom(id, pickLabel, () => onPick(id)) }))
      : [h('p', { class: 'muted' }, '対象のカードがありません')];
    const footer = skip ? h('button', { class: 'btn btn-block', onclick: skip.on }, skip.label) : null;
    return modalShell(title, desc, chips, footer);
  }

  // 4択から異なる n 個を選ぶ（廷臣）。
  const COURTIER_OPTS = [
    { v: 'action', label: '+1 アクション' }, { v: 'buy', label: '+1 購入' },
    { v: 'coin', label: '+3 コイン' }, { v: 'gold', label: '金貨を獲得' },
  ];
  function modalChooseN(title, desc, options, n, onConfirm) {
    const tiles = options.map((o) =>
      h('button', { class: 'choose-tile' + (UI.selection.includes(o.v) ? ' on' : ''),
        onclick: () => {
          const i = UI.selection.indexOf(o.v);
          if (i >= 0) UI.selection.splice(i, 1);
          else if (UI.selection.length < n) UI.selection.push(o.v);
          render();
        } }, o.label));
    const k = UI.selection.length;
    const footer = h('button', { class: 'btn btn-primary btn-block', disabled: k === n ? null : 'disabled',
      onclick: () => onConfirm(UI.selection.slice()) }, k === n ? '決定' : ('異なる ' + n + ' つを選ぶ（あと ' + (n - k) + '）'));
    return modalShell(title, desc, tiles, footer);
  }

  // 風車: 手札2枚を捨てて+2コイン、または捨てない。
  function modalMill(p, onConfirm) {
    const chips = p.hand.map((id, idx) =>
      cardEl(id, { size: 'sm', extra: UI.selection.includes(idx) ? 'selected' : 'selectable',
        onClick: () => {
          const i = UI.selection.indexOf(idx);
          if (i >= 0) UI.selection.splice(i, 1); else if (UI.selection.length < 2) UI.selection.push(idx);
          render();
        } }));
    const k = UI.selection.length;
    const footer = h('div', null,
      h('button', { class: 'btn btn-primary btn-block', disabled: k === 2 ? null : 'disabled', style: 'margin-bottom:8px',
        onclick: () => onConfirm(UI.selection.map((i) => p.hand[i])) }, k === 2 ? '2枚捨てて +2 コイン' : ('捨てる2枚を選ぶ（あと ' + (2 - k) + '）')),
      h('button', { class: 'btn btn-block', onclick: () => onConfirm([]) }, '捨てない'));
    return modalShell('風車', '手札を2枚捨てると +2 コイン（しなくてもよい）。', chips, footer);
  }

  // 衛兵: 山札の上2枚を「山札の上／捨て札／廃棄」に振り分ける（タップで切替）。
  function modalSentry(p, cards, onConfirm) {
    if (!Array.isArray(UI.sentryChoice) || UI.sentryChoice.length !== cards.length) UI.sentryChoice = cards.map(() => 'top');
    const labelOf = (s) => (s === 'top' ? '山札の上' : (s === 'discard' ? '捨て札' : '廃棄'));
    const nextOf = (s) => (s === 'top' ? 'discard' : (s === 'discard' ? 'trash' : 'top'));
    const chips = cards.map((id, idx) =>
      h('div', { style: 'display:inline-block;text-align:center;margin:4px' },
        cardEl(id, { size: 'sm', extra: 'selectable', onClick: () => { UI.sentryChoice[idx] = nextOf(UI.sentryChoice[idx]); render(); } }),
        h('div', { class: 'muted', style: 'font-size:12px;margin-top:2px' }, '→ ' + labelOf(UI.sentryChoice[idx]))));
    const footer = h('button', { class: 'btn btn-primary btn-block',
      onclick: () => {
        const res = { trash: [], discard: [], top: [] };
        cards.forEach((id, idx) => { res[UI.sentryChoice[idx]].push(id); });
        UI.sentryChoice = null;
        onConfirm(res);
      } }, '確定');
    return modalShell('衛兵 — 山札の上2枚', '各カードをタップして「山札の上／捨て札／廃棄」を切り替えます。', chips, footer);
  }

  // 闇市場: 財宝を出す→公開3枚のうち1枚を購入 or 買わない。
  function modalBlackMarket(state, pd, p) {
    const hasTreasure = p.hand.some((c) => DOM.CARDS[c].types.includes('treasure'));
    const coins = state.turn.coins;
    const chips = pd.revealed.length ? pd.revealed.map((id) => {
      const cst = effCost(state, id);
      const can = cst <= coins;
      return h('div', { class: 'pick-supply' },
        cardEl(id, { size: 'sm', extra: can ? 'selectable' : 'disabled', onClick: can ? () => openPickZoom(id, '購入する（$' + cst + '）', () => dispatch({ type: 'BLACK_MARKET_BUY', card: id })) : null }),
        h('div', { class: 'pick-remain' }, '$' + cst));
    }) : [h('p', { class: 'muted' }, '公開カードがありません')];
    const footer = h('div', null,
      hasTreasure ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'BLACK_MARKET_PLAY_TREASURES' }) }, '💰 手札の財宝を全て出す') : null,
      h('button', { class: 'btn btn-block', onclick: () => dispatch({ type: 'BLACK_MARKET_SKIP' }) }, '買わずに進む'));
    return modalShell('闇市場（所持 ' + coins + ' コイン）', '財宝を出してから、公開3枚のうち1枚を購入できます（任意・1枚まで）。', chips, footer);
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
  function modalTorturer(p, hasSecret, hasDiplomat) {
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
      hasDiplomat ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'DIPLOMAT_REVEAL' }) }, '🤝 外交官を公開（+2引いて3枚捨てる）') : null,
      p.hand.includes('horse_traders') ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'HORSE_TRADERS_REACT' }) }, '🐴 馬商人を脇に置く（次の手番に +1カードで戻る／攻撃は受ける）') : null,
      p.hand.includes('beggar') ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'BEGGAR_REACT' }) }, '🥺 物乞いを捨てて銀貨2枚を獲得（1枚は山札の上／攻撃は受ける）') : null,
      h('button', { class: 'btn btn-primary btn-block', disabled: remain === 0 ? null : 'disabled',
        onclick: () => dispatch({ type: 'TORTURER_RESOLVE', choice: 'discard', cards: UI.selection.map((i) => p.hand[i]) }) },
        remain === 0 ? '手札を捨てる（確定）' : '捨てる ' + remain + ' 枚 を選ぶ'),
      h('button', { class: 'btn btn-block', style: 'margin-top:8px', onclick: () => dispatch({ type: 'TORTURER_RESOLVE', choice: 'curse' }) }, '☠️ 呪いを手札に受け取る'));
    return modalShell('拷問人を受ける', '手札を2枚捨てるか、呪い1枚を手札に受け取ります。' + (hasMoat ? '「堀」で無効化もできます。' : ''), chips, footer);
  }
  // skipOnEmpty: 関数を渡すと「獲得せずに進む」を出す。alwaysSkip=true で候補があっても常時表示（任意獲得）。
  function modalGainSupply(state, title, desc, filter, onPick, skipOnEmpty, alwaysSkip, pickLabel) {
    const order = DOM.SUPPLY_ORDER(state.kingdom);
    const elig = order.filter((id) => filter(id) && (state.supply[id] || 0) > 0);
    const chips = elig.length
      ? elig.map((id) => h('div', { class: 'pick-supply' },
          cardEl(id, { size: 'sm', extra: 'selectable', onClick: () => openPickZoom(id, pickLabel || '獲得する', () => onPick(id)) }),
          h('div', { class: 'pick-remain' }, '残' + state.supply[id])))
      : [h('p', { class: 'muted' }, (pickLabel || '獲得') + 'できるカードがありません')];
    const footer = (skipOnEmpty && (!elig.length || alwaysSkip))
      ? h('button', { class: 'btn btn-block', onclick: skipOnEmpty }, '獲得せずに進む') : null;
    return modalShell(title, desc, chips, footer);
  }
  // ギルド：数量を −/＋ ステッパーで選ぶ（過払い額・肉屋の財源支払い）。UI.amount に現在値を保持。
  function modalAmount(title, desc, max, min, confirmLabel, onConfirm) {
    min = min || 0;
    if (typeof UI.amount !== 'number' || UI.amount < min || UI.amount > max) UI.amount = min;
    const stepper = h('div', { style: 'display:flex;align-items:center;justify-content:center;gap:18px;margin:14px 0' },
      h('button', { class: 'btn', style: 'width:56px;font-size:22px', disabled: UI.amount <= min ? 'disabled' : null, onclick: () => { if (UI.amount > min) { UI.amount--; render(); } } }, '−'),
      h('div', { style: 'font-size:30px;font-weight:700;min-width:52px;text-align:center' }, String(UI.amount)),
      h('button', { class: 'btn', style: 'width:56px;font-size:22px', disabled: UI.amount >= max ? 'disabled' : null, onclick: () => { if (UI.amount < max) { UI.amount++; render(); } } }, '＋'));
    const footer = h('div', null, stepper,
      // 確定時に UI.amount をクリア＝次の数量モーダル（同種の連続購入＝同一 pending キー）が前回値を引き継がない。
      h('button', { class: 'btn btn-primary btn-block', onclick: () => { const v = UI.amount; UI.amount = null; onConfirm(v); } }, confirmLabel(UI.amount)));
    return modalShell(title, desc, [], footer);
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
          h('img', { class: 'zoom-img', src: 'asset/cards/' + pz.id + '.webp', alt: c.name, onerror: function () { this.style.display = 'none'; if (this.parentElement) this.parentElement.classList.add('noimg'); } }),
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
        h('button', { class: 'sheet-close', 'aria-label': '閉じる', onclick: closeSheet }, '✕'),
        h('div', { class: 'grip' }),
        h('div', { class: 'zoom-wrap ' + typeClass(id) },
          h('img', { class: 'zoom-img', src: 'asset/cards/' + id + '.webp', alt: c.name, onerror: function () { this.style.display = 'none'; if (this.parentElement) this.parentElement.classList.add('noimg'); } }),
          h('div', { class: 'zoom-fallback' }, c.name)),
        h('div', { class: 'zoom-info' },
          h('div', { class: 'zoom-head' },
            h('span', { class: 'zoom-cost' }, c.cost),
            h('div', null, h('h3', { class: 'zoom-name' }, c.name), h('div', { class: 'zoom-type' }, typeLabel(id)))),
          h('div', { class: 'zoom-text' }, c.text || ''),
          UI.beginner ? h('div', { class: 'beginner-tip' }, '🔰 ' + beginnerTip(id)) : null,
          remain != null ? h('div', { class: 'zoom-remain' }, 'サプライ残り ' + remain + ' 枚') : null),
        p ? h('button', { class: 'btn ' + (p.cls || '') + ' btn-block', onclick: p.on }, p.label) : null));
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
  function createRoom(name) { name = name || defaultName('host'); saveMyName(name); startOnline('create', name); }
  function joinRoom(code, name) {
    code = (code || '').trim();
    if (!/^[0-9]{4}$/.test(code)) { toast('コードは数字4桁です'); return; }
    name = name || defaultName('guest'); saveMyName(name);
    startOnline('join', name, code);
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
    // 支配中は操作対象（被支配者）の手札で判定する。
    const hp = (t.possessedBy != null && t.possessedBy === viewer) ? state.players[t.active] : state.players[viewer];
    const hasAction = t.actions > 0 && hp.hand.some((c) => DOM.CARDS[c] && DOM.CARDS[c].types.includes('action'));
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
    // 支配中は操作対象＝被支配者(t.active)の手札でアクション有無を判定する（支配者の手札で誤って飛ばさない）。
    const handOf = (st, ac) => (st.turn.possessedBy != null && st.turn.possessedBy === ac) ? st.players[st.turn.active] : st.players[ac];
    if (handOf(s, actor).hand.some((c) => DOM.isType(c, 'action'))) return;
    if (UI._autoSkipTimer) return;
    UI._autoSkipTimer = setTimeout(() => {
      UI._autoSkipTimer = null;
      const cur = UI.store && UI.store.state;
      if (!cur || cur.gameOver || cur.pending || UI.view !== 'game') return;
      if (cur.turn.phase !== 'action') return;
      const a2 = E().actor(cur);
      if (!cur.players[a2] || cur.players[a2].isCpu) return;
      if (UI.mode === 'local' ? a2 !== UI.localViewer : a2 !== UI.mySeat) return;
      if (handOf(cur, a2).hand.some((c) => DOM.isType(c, 'action'))) return;
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
     盤面・拡大表示は完成カード asset/cards/<id>.webp（平均約147KB）。タップ時の初取得待ちを避け、
     対戦に入ったら手すきの時間に全カードを裏で読み込んでおく（SWがあればキャッシュにも残る）。 */
  function preloadFullArt() {
    if (UI._artPreloaded || !DOM.CARDS) return;
    UI._artPreloaded = true;
    const kick = () => {
      try {
        Object.keys(DOM.CARDS).forEach((id) => { const im = new Image(); im.src = 'asset/cards/' + id + '.webp'; });
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
    // カード拡大など（モーダル開閉）でページ先頭に飛ばないよう、開く直前のスクロール位置を覚えておく。
    const scroller = document.scrollingElement || document.documentElement;
    const prevScroll = (scroller && scroller.scrollTop) || 0;
    const wasModalOpen = document.documentElement.classList.contains('modal-open');
    const sameView = (UI._lastView === UI.view);
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
    if (UI.revealView != null) { const rm = viewRevealModal(); if (rm) app.appendChild(rm); }
    syncSheet(); // カード説明は専用ホスト常駐（再描画でスクロール位置・画像を保つ）
    if (UI.logModal) app.appendChild(viewLogModal());
    if (UI.pickZoom) app.appendChild(viewPickZoom()); // 廃棄/獲得カードの拡大確認（最前面）
    if (UI.confirm) app.appendChild(viewConfirm());
    // 対戦中/ロビーで切断〜再接続中はオーバーレイで操作を一旦無効化
    if (UI.reconnecting && (UI.view === 'game' || UI.view === 'lobby')) app.appendChild(viewReconnectOverlay());
    if (UI.toast) app.appendChild(h('div', { class: 'toast' }, UI.toast));
    const histEl = app.querySelector('.log-history');
    if (histEl) histEl.scrollTop = histEl.scrollHeight;
    // モーダル表示中は背面（盤面）のスクロールをロックする
    const modalOpen = !!(UI.sheet || UI.revealView != null || UI.logModal || UI.pickZoom || UI.confirm);
    document.documentElement.classList.toggle('modal-open', modalOpen);
    // モーダルを開いた瞬間の位置を記録し、閉じたら（同じ画面なら）その位置へ戻す＝先頭に飛ばない。
    if (modalOpen && !wasModalOpen) UI._pageScrollY = prevScroll;
    else if (!modalOpen && wasModalOpen && sameView && scroller) scroller.scrollTop = UI._pageScrollY || 0;
    UI._lastView = UI.view;
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
    const img = document.createElement('img'); img.className = 'gain-art'; img.src = 'asset/cards/' + id + '.webp'; img.alt = '';
    img.onerror = function () { this.style.display = 'none'; card.classList.add('noart'); };
    const fallback = document.createElement('div'); fallback.className = 'gain-fallback'; fallback.textContent = DOM.CARDS[id].name;
    const cap = document.createElement('div'); cap.className = 'gain-cap'; cap.textContent = DOM.CARDS[id].name;
    card.appendChild(img); card.appendChild(fallback); card.appendChild(cap);
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
