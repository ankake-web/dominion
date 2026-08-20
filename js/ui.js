/* ============================================================
   ドミニオン — UI（画面描画とタップ操作）
   ============================================================ */
(function () {
  const DOM = (window.DOM = window.DOM || {});
  const E = () => DOM.engine;
  const LEVEL_JP = { easy: '弱', normal: '普通', hard: '強' };
  // E8：倒壊/死の荷車の「これ(this)を廃棄できるか」＝engine と同じ述語を見る（engine が拒否する選択肢を出さない）。
  const pendingSelf = (state, pd, cardId) => (E() && E().pendingSelf ? E().pendingSelf(state, pd, cardId) : !!(pd && pd.self));

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
    cardSearch: '',     // カード一覧の検索語
    _searchActive: false, // 検索欄を編集中か（render の全再構築でフォーカスを戻す判定）
    _imeComposing: false, // 日本語入力(IME)の変換中か（変換中は再描画しない＝入力が壊れるため）
    _noAutoSkipOnce: false, // 「1手もどす」直後に自動スキップを1回だけ抑止する（対局をまたいで残さない）
    deckView: null,     // 終局後にデッキ内訳を見ている席（null=閉じている）
    netCanUndo: false,  // オンライン：サーバが「この席は今1手もどせる」と言っているか
    netUndoFree: false, // オンライン：その巻き戻しは相手の同意なしで通せるか（＝買い物だけ）
    undoPending: false, // オンライン：自分の要求が相手の返事待ちか
    undoAskOpen: false, // オンライン：相手から頼まれた確認を出しているか
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
  /* 【実バグ修正】ここに無い種別は `typeLabel` が undefined になり「アクション・アタック・」のように
     末尾が欠けたラベルが出る（略奪者・人狼・家宝・精霊・ゾンビ・同盟の7種別で実際に出ていた）。
     **新しい種別を `DOM.CARDS` に足したら必ずここにも足すこと**（`js/carddata.js` の
     BASE_TYPE_JP / ALLIES_TYPE_JP と対になる表）。 */
  const TYPE_JP = { treasure: '財宝', victory: '勝利点', curse: '呪い', action: 'アクション', attack: 'アタック', reaction: 'リアクション',
    duration: '持続', command: '命令', knight: '騎士', ruins: '廃墟', shelter: '避難所', reserve: 'リザーブ', traveller: 'トラベラー', castle: '城',
    looter: '略奪者', // 暗黒時代
    night: '夜行', fate: '幸運', doom: '不運', heirloom: '家宝', spirit: '精霊', zombie: 'ゾンビ', // 夜想曲
    liaison: '連携', townsfolk: '町民', augur: '卜占官', clash: '衝突', fort: '城砦', odyssey: '叙事詩', wizard: '魔法使い', // 同盟
    loot: '戦利品', // 略奪（Loot。⚠ 暗黒時代の looter＝「略奪者」・spoils＝「略奪品」と別物）
    omen: '前兆', shadow: '影' }; // 旭日（Omen＝予言の Sun を減らす／Shadow＝裏面が違い山札から使える）
  function typeClass(id) {
    const c = DOM.CARDS[id];
    if (c.types.includes('treasure')) return 'type-treasure';
    if (c.types.includes('victory')) return 'type-victory';
    if (c.types.includes('curse')) return 'type-curse';
    if (c.types.includes('reaction')) return 'type-reaction';
    return 'type-action';
  }
  UI.TYPE_JP = TYPE_JP; // テストが「全カード種別を網羅しているか」を検査する（新種別の足し忘れ防止）
  function typeLabel(id) { return DOM.CARDS[id].types.map((t) => TYPE_JP[t] || t).join('・'); }
  /* 混合山（廃墟/騎士/城/同盟の分割山6組）の**表示用id**＝一番上の実カード。
     山キーはプレースホルダなので、そのまま描くとコスト・名前・種別が実際に手に入るカードと食い違う。
     ※engine へ送る id（購入/獲得の dispatch）は**山キーのまま**にすること。 */
  function mixTop(state, id) {
    return (state && DOM.engine.mixedTopCard ? DOM.engine.mixedTopCard(state, id) : null) || id;
  }
  // 財宝は枚数で色分け（場のチップで金貨/銀貨/銅貨を見分けやすく）
  function coinClass(id) { return (id === 'copper' || id === 'silver' || id === 'gold') ? ' c-' + id : ''; }
  // 実コスト（「橋」等のこのターンのコスト軽減を反映）。表示・購入判定で共通利用。
  function effCost(state, id) { return (state && E() && E().cardCost) ? E().cardCost(state, id) : DOM.CARDS[id].cost; }
  /* ---------- mix-all 硬化：獲得候補の述語は **engine の正本** を見る ----------
     engine が拒否する札をモーダルのチップに出すと人間が詰む（選んでも state が変わらない）。
     コスト比較は coin/potion/debt の成分別＋非サプライ（賞品/略奪品/成長先）とロック中の分割山下段を除外。
     spec = { pot, debt }（省略時0）＝廃棄/購入した札のポーション・負債成分を引き継ぐときに渡す（pending に焼き込み済み）。 */
  const canBase = (state, id) => !E() || !E().gainableBase || E().gainableBase(state, id);
  /* 「サプライから獲得/廃棄するカードの種別」＝混合山（廃墟/騎士/城/同盟の分割山）は**一番上の実カード**で判定。
     **engine の isTypeSupply が正本**（engine拒否・CPU候補・UIフィルタの3面が一致していないと人間が詰む）。
     ※手札/場のカードの種別は従来どおり `DOM.isType`（山ではないので解決不要）。 */
  const isTypeSup = (state, id, ty) => ((E() && E().isTypeSupply) ? E().isTypeSupply(state, id, ty) : DOM.isType(id, ty));
  const canUpTo = (state, id, coin, spec) => (E() && E().costUpTo) ? E().costUpTo(state, id, coin, spec) : effCost(state, id) <= coin;
  const canUnder = (state, id, coin, spec) => (E() && E().costUnder) ? E().costUnder(state, id, coin, spec) : effCost(state, id) < coin;
  const canExact = (state, id, coin, pot, debt) => (E() && E().costExact) ? E().costExact(state, id, coin, pot, debt) : effCost(state, id) === coin;
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
    // 盤面（手札・サプライ）・カード一覧で共通のカード画像。
    // loading=lazy＝画面に入るまで読み込まない（カード一覧の761枚一括描画で全量DLしない）。
    //   盤面に見えている札は lazy でも即読み込まれるので表示は変わらない。
    // width/height＝webp の実寸（768×1152）を先に伝えてレイアウトシフトを防ぐ（表示サイズはCSSが決める）。
    // ※属性の適用順に意味がある：loading を src より**前**に置く（後だと eager で読み始めてから lazy になる）。
    return h('img', {
      class: 'card-art', loading: 'lazy', decoding: 'async', width: '768', height: '1152',
      src: 'asset/cards/' + id + '.webp', alt: DOM.CARDS[id].name,
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
    // 混合山（騎士/城/同盟の分割山6組）は一番上の実カードを表示する（購入対象は山キーのまま）。
    const dispId = mixTop(state, id);
    const isMix = dispId !== id;
    const c = DOM.CARDS[dispId] || DOM.CARDS[id];
    const n = state.supply[id] || 0;
    const ec = effCost(state, id);
    const cls = 'pile has-art ' + (opts.size === 'sm' ? 'sm ' : '') + typeClass(dispId) +
      (n <= 0 ? ' empty' : '') + (opts.buyable ? ' buyable' : '') + (opts.gainable ? ' gainable' : '') +
      (opts.recommended ? ' recommended' : '') +
      (ec < c.cost ? ' discounted' : '');
    const aria = c.name + (isMix && DOM.CARDS[id] ? '（' + DOM.CARDS[id].name + 'の山の一番上）' : '') + '、コスト' + ec + (potCost(id) ? '＋ポーション' : '') + '、残り' + n + '枚' + (opts.recommended ? '、おすすめ' : '');
    return h('div', a11yBtn({ class: cls, onclick: opts.onClick, 'data-pile': id }, opts.onClick, aria),
      h('div', { class: 'pcost' }, ec),
      h('div', { class: 'pname' }, c.name),
      cardArt(dispId),
      opts.recommended ? h('div', { class: 'rec-badge' }, 'おすすめ') : null,
      pileTokenBadge(state, id),
      pileVpBadge(state, id),
      pileDebtBadge(state, id),
      pileFavorBadge(state, id),
      h('div', { class: 'pile-count' + (n <= 2 ? ' lo' : n <= 5 ? ' mid' : '') }, '残' + n)
    );
  }
  // 帝国：徴税（Tax）＝サプライ山の上に置かれた負債トークン数を表示（公開・全員共有）。購入フェイズの獲得で受け取る。
  function pileDebtBadge(state, id) {
    const n = (state.pileDebt && state.pileDebt[id]) || 0;
    if (n <= 0) return null;
    return h('div', { class: 'pile-debt', title: '山上の負債トークン（購入フェイズに獲得すると受け取る）' }, '🟠' + n);
  }
  // 帝国：集合（Gathering）＝サプライ山の上に置かれた勝利点トークン数を表示（公開・全員共有）。
  function pileVpBadge(state, id) {
    const n = (state.pileVP && state.pileVP[id]) || 0;
    if (n <= 0) return null;
    return h('div', { class: 'pile-vp', title: '山上の勝利点トークン' }, '⭐' + n);
  }
  /* 同盟：発明家の家族（Family of Inventors）＝山の上に置かれた好意トークン数（公開・全員共有）。
     その山のカードは**全員に・常時・累積で** $1 安い（表示コストは effCost が cardCost 経由で既に反映している）。 */
  function pileFavorBadge(state, id) {
    const n = (state.pileFavor && state.pileFavor[id]) || 0;
    if (n <= 0) return null;
    return h('div', { class: 'pile-favor', title: '山上の好意トークン（この山のカードは全員に $' + n + ' 安い）' }, '🤝' + n);
  }
  // 冒険：山トークンを山に小さく表示（各プレイヤーのトークンは公開情報）。
  //   +1系4種＝教師／失われた技術・鍛錬・誘導・海路（プレイ時ボーナス）。
  //   -$2＝渡し船（自分のターン中その山が安い）／🗑＝立案（その山から獲得したとき手札1枚を廃棄してよい）。
  function pileTokenBadge(state, id) {
    const SYM = { card: '+1🃏', action: '+1▶', buy: '+1🛒', coin: '+1$', cost: '-$2', trash: '🗑' };
    const chips = [];
    (state.players || []).forEach((pl, pi) => {
      const toks = pl.pileTokens || {};
      Object.keys(toks).forEach((tk) => { if (toks[tk] === id && SYM[tk]) chips.push((state.players.length > 2 ? 'P' + (pi + 1) + ':' : '') + SYM[tk]); });
    });
    if (!chips.length) return null;
    return h('div', { class: 'pile-tokens', title: '山トークン（教師／イベント）' }, chips.join(' '));
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
  function go(view) { UI.view = view; UI.sheet = null; UI.logModal = false; UI.revealView = null; UI.deckView = null; render(); }
  // 人間の操作はここを通る（CPU駆動・自動スキップは UI.store.dispatch を直接呼ぶ＝戻れる地点にしない）。
  // ローカルでは「誰の操作か」を store に渡し、初心者モードの「1手もどす」の戻り先として積む。
  function dispatch(action) {
    UI.sheet = null;
    UI._noAutoSkipOnce = false; // 何か操作したら自動スキップの一時停止は解除
    const st = UI.store && UI.store.state;
    const seat = (UI.mode === 'local' && st && !st.gameOver) ? E().actor(st) : null;
    if (seat != null) UI.store.dispatch(action, { undoSeat: seat });
    else UI.store.dispatch(action);
  }

  /* ---------- 1手もどす（初心者モード） ----------
     ローカル＝クライアントに履歴があるのでその場で巻き戻す（LocalStore.undo）。
     オンライン＝サーバ権威なので「相手に取り消しをお願いする」＝承認制（requestUndoOnline）。
     どちらも「自分が最後にした操作の直前」まで戻る（間のCPUの手番はまとめて巻き戻る）。 */
  function canUndoNow(state, viewer, interactive) {
    if (!UI.beginner) return false;              // 初心者モードの機能
    if (!state || state.gameOver) return false;
    if (!interactive) return false;              // 自分が操作できる場面だけ
    if (UI.mode === 'online') return canRequestUndoOnline(state);
    return !!(UI.store && UI.store.canUndo && UI.store.canUndo(viewer));
  }
  function doUndo() {
    const st = UI.store && UI.store.state;
    if (!st || st.gameOver) return;
    if (UI.mode === 'online') { requestUndoOnline(); return; }
    const seat = E().actor(st);
    if (!UI.store.canUndo || !UI.store.canUndo(seat)) return;
    // 予約済みのCPU/自動スキップのタイマーは巻き戻し前に捨てる（古い局面向けの予約を残さない）
    if (UI._cpuTimer) { clearTimeout(UI._cpuTimer); UI._cpuTimer = null; }
    if (UI._autoSkipTimer) { clearTimeout(UI._autoSkipTimer); UI._autoSkipTimer = null; }
    // 開きっぱなしの選択・確認・拡大は全部たたむ（巻き戻し後の局面と食い違うため）
    UI.sheet = null; UI.selection = []; UI._selKey = ''; UI.amount = null; UI.sentryChoice = null;
    UI.confirm = null; UI.pickZoom = null; UI.lmZoom = null; UI.coffersOpen = false; UI.villagersOpen = false;
    // 戻した直後に「手札にアクションが無い」自動スキップで即飛ばされないよう1回だけ抑止する
    UI._noAutoSkipOnce = true;
    if (UI.store.undo(seat)) { sfx('tap'); toast('↩ 1手もどしました'); }
  }
  // 盤面ヘッダ／選択モーダルに出す「1手もどす」ボタン（出せないときは null）
  function undoBtn(state, viewer, interactive, cls) {
    if (!canUndoNow(state, viewer, interactive)) return null;
    // オンラインは基本「相手に確認」。ただし**買い物（カードの購入）だけは同意なしで戻せる**ので、
    //   その場合はローカルと同じ文言にする（サーバが undoFree で教えてくれる）。
    const label = (UI.mode === 'online' && !UI.netUndoFree)
      ? (UI.undoPending ? '↩ 相手の返事を待っています…' : '↩ 1手もどす（相手に確認）')
      : '↩ 1手もどす';
    return h('button', {
      class: cls || 'btn btn-ghost btn-sm undo-btn',
      'aria-label': '1手もどす',
      disabled: UI.undoPending ? 'disabled' : null,
      onclick: () => doUndo(),
    }, label);
  }
  /* オンラインの「1手もどす」＝サーバ権威なので勝手に巻き戻せない。
     サーバが配信する canUndo（＝この席が今頼めるか）を見てボタンを出し、
     押すと他の接続中の人間 全員に確認 → 全員が許可したときだけサーバが巻き戻す。 */
  function canRequestUndoOnline(state) {
    return !!UI.netCanUndo && !UI.undoAskOpen;
  }
  function requestUndoOnline() {
    if (!UI.netClient || UI.undoPending) return;
    UI.undoPending = true;
    UI.netClient.send({ t: 'undo' });
    render();
  }
  // 相手から「1手もどしたい」と頼まれたときの確認（許可/断るの両方を必ずサーバへ返す）
  function askUndoApproval(msg) {
    UI.undoAskOpen = true;
    const vote = (okFlag) => {
      UI.undoAskOpen = false; UI.confirm = null;
      if (UI.netClient) UI.netClient.send({ t: 'undoVote', ok: !!okFlag });
      render();
    };
    UI.confirm = {
      message: (msg.name || '相手') + ' さんが「1手もどす」をお願いしています。\n許可すると、その人の直前の操作が取り消されます（間に入ったCPUの手番も巻き戻ります）。',
      yesLabel: '許可する', noLabel: '断る', sticky: true,
      onYes: () => vote(true), onNo: () => vote(false),
    };
    render();
  }
  function closeSheet() { UI.sheet = null; render(); }
  // カード拡大を開くときは検索欄の「入力中」を解除する（閉じたあとにスマホのキーボードが開き直さない）
  function showSheet(cardId, primary) { UI.sheet = { cardId, primary }; UI._searchActive = false; UI._imeComposing = false; sfx('tap'); render(); }
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
      h('p', { class: 'sub' }, '基本＋15拡張を収録／CPU・2〜4人・オンライン対戦'),
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
    const isMix = DOM.isMixSet && DOM.isMixSet(current);
    const cur = (!isMix && byId(current)) || byId('basic');
    const recommend = sets.filter((s) => s.kind === 'recommend');
    const randoms = sets.filter((s) => s.kind === 'random');
    // 拡張の固定セット（海辺〜ルネサンス）＝ kind:'standard' のうち 王国基本/陰謀 以外。
    //   これを出さないと「海辺セット」「帝国セット」等の固定10種が画面から選べない。
    const expansions = sets.filter((s) => s.kind === 'standard' && s.id !== 'basic' && s.id !== 'intrigue');
    // 現在のトップ分類
    let top = 'basic';
    if (isMix) top = 'mix';
    else if (cur.id === 'intrigue') top = 'intrigue';
    else if (expansions.some((s) => s.id === cur.id)) top = 'expansion';
    else if (cur.kind === 'recommend') top = 'recommend';
    else if (cur.kind === 'random') top = 'random';
    // 分類を切り替えたときに飛ぶ既定ID
    const defaults = { basic: 'basic', intrigue: 'intrigue', expansion: (expansions[0] || {}).id,
      recommend: (recommend[0] || {}).id, random: 'random', mix: 'mix:basic,intrigue' };
    const topSeg = segmented(
      [{ value: 'basic', label: '王国基本' }, { value: 'intrigue', label: '陰謀' }, { value: 'expansion', label: '拡張' },
       { value: 'recommend', label: 'おすすめ' }, { value: 'random', label: 'ランダム' }, { value: 'mix', label: 'ミックス' }],
      top, (v) => { if (v !== top && defaults[v]) onChange(defaults[v]); }, 'set-top-seg');

    const tiles = (list) => h('div', { class: 'set-tiles' }, list.map((s) =>
      h('button', { class: 'set-tile' + (s.id === current ? ' on' : ''), onclick: () => onChange(s.id) },
        h('div', { class: 'set-tile-name' }, s.name),
        h('div', { class: 'set-tile-desc' }, s.desc || ''))));

    let sub = null;
    if (top === 'expansion') {
      sub = tiles(expansions);
    } else if (top === 'recommend') {
      sub = tiles(recommend);
    } else if (top === 'random') {
      sub = h('div', { class: 'set-sub' },
        segmented(randoms.map((s) => ({ value: s.id, label: s.name.replace('から', '') })), current, (v) => onChange(v), 'seg-wrap'),
        h('p', { class: 'muted set-note' }, '毎回ランダムに10種を選びます。'));
    } else if (top === 'mix') {
      sub = mixPicker(current, onChange);
    }
    // 固定セットは収録カード名をプレビュー
    const preview = (!isMix && cur.kingdom)
      ? h('p', { class: 'muted set-note' }, '収録：' + cur.kingdom.map((id) => (DOM.CARDS[id] ? DOM.CARDS[id].name : id)).join('・'))
      : null;
    return h('div', { class: 'set-picker' }, topSeg, sub, preview);
  }

  /* ミックス（拡張を自由に混ぜるランダム対戦）の選択UI。
     - 王国：選んだ拡張の王国カードを**全部混ぜて10種抽選**（公式どおり）。最低1つ選ぶ。
     - 横型：イベント/ランドマーク/プロジェクトを**合計0〜2枚**（公式）。抽選元も選べる。
     セットIDは `mix:<王国プール>[:<枚数>:<横型プール>]` の1文字列にエンコードされ、
     オンラインでもそのままサーバへ送られる（サーバは形式とプール名を検証してから受理する）。 */
  function mixPicker(current, onChange) {
    const m = DOM.parseMixSet(current) || { pools: [], count: 0, lsPools: [] };
    const KP = DOM.MIX_KINGDOM_POOLS || {};
    const LP = DOM.MIX_LANDSCAPE_POOLS || {};
    const emit = (pools, count, lsPools) => onChange(DOM.makeMixSet(pools, count, lsPools));
    const toggle = (arr, v) => (arr.indexOf(v) >= 0 ? arr.filter((x) => x !== v) : arr.concat([v]));

    const poolChips = h('div', { class: 'mix-chips' }, Object.keys(KP).map((k) => {
      const on = m.pools.indexOf(k) >= 0;
      return h('button', {
        class: 'mix-chip' + (on ? ' on' : ''),
        onclick: () => {
          const next = toggle(m.pools, k);
          if (!next.length) return; // 最低1つは必要（engine が王国を作れない）
          emit(next, m.count, m.lsPools);
        },
      }, (on ? '✓ ' : '') + KP[k]);
    }));
    const total = m.pools.reduce((a, p) => a + ((DOM.POOLS[p] || []).length), 0);

    const countSeg = segmented(
      [{ value: 0, label: 'なし' }, { value: 1, label: '1枚' }, { value: 2, label: '2枚' }],
      m.count, (v) => emit(m.pools, v, (v > 0 && !m.lsPools.length) ? Object.keys(LP) : m.lsPools), 'seg-wrap');

    const lsChips = m.count > 0
      ? h('div', { class: 'mix-chips' }, Object.keys(LP).map((k) => {
          const on = m.lsPools.indexOf(k) >= 0;
          return h('button', {
            class: 'mix-chip' + (on ? ' on' : ''),
            onclick: () => {
              const next = toggle(m.lsPools, k);
              if (!next.length) return; // 横型を使うなら抽選元が最低1つ必要
              emit(m.pools, m.count, next);
            },
          }, (on ? '✓ ' : '') + LP[k].label);
        }))
      : null;

    return h('div', { class: 'set-sub mix-picker' },
      h('div', { class: 'mix-label' }, '混ぜる拡張（王国カード）'),
      poolChips,
      h('p', { class: 'muted set-note' }, '選んだ拡張の王国カード ' + total + '種 から毎回10種を抽選します。'),
      h('div', { class: 'mix-label' }, '横型カード（イベント／ランドマーク／プロジェクト）'),
      countSeg,
      lsChips,
      h('p', { class: 'muted set-note' }, m.count > 0
        ? '選んだ抽選元から合計 ' + m.count + '枚 を無作為に使います（公式：横型は合計2枚まで）。'
        : '横型カードは使いません。'));
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

    // 王国セット名・手番順の表示用（ゲストの読み取り専用表示に使う）。mix はプール名から組み立てる。
    const setName = (() => {
      const id = (lb && lb.kingdomSet) || 'basic';
      return DOM.setDisplayName ? DOM.setDisplayName(id) : id;
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
        sec('ゲームの終わり', h('p', null, '「属州」の山が尽きるか、任意の3種類の山が尽きたターンの終了時に終了します。'
          + '（繁栄の「植民地」を使うゲームでは、植民地の山が尽きたときも終了します。）')),
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

  // 横型（ランドマーク／イベント／プロジェクト／アーティファクト）の種別アイコンとラベル。
  const LS_ICON = { landmark: '🏛 ', event: '🎫 ', project: '🏗 ', artifact: '🗝 ',
    way: '🦉 ', boon: '🌟 ', hex: '🌑 ', state: '🎭 ', ally: '🤝 ', trait: '🏷 ', prophecy: '🔮 ' };
  /* ⚠ **DOM.LANDSCAPES に新しい kind を足したらここにも足す**（無いと拡大表示で「ランドマーク」と誤表示される）。
     ally/trait/boon/hex/state は長らく抜けていた（＝この4種は「ランドマーク / Landmark」と出ていた）。 */
  const LS_KIND_LABEL = {
    landmark: 'ランドマーク / Landmark', event: 'イベント / Event',
    project: 'プロジェクト / Project', artifact: 'アーティファクト / Artifact',
    way: '習性 / Way', // 移動動物園：買わない横型（アクションの記載効果の代わりに使う）
    boon: '祝福 / Boon', hex: '呪詛 / Hex', state: '状態 / State', // 夜想曲
    ally: '同盟 / Ally', // 同盟：1ゲームに1枚・好意トークンの使い道
    trait: '特性 / Trait', // 略奪：サプライの山1つに付く
    prophecy: '予言 / Prophecy', // 旭日：前兆があれば1枚配る（Sun トークンが尽きると発動）
  };
  UI.LS_KIND_LABEL = LS_KIND_LABEL; // テストが「全 kind を網羅しているか」を検査する（新 kind の足し忘れ防止）
  // 横型ランドマークは DOM.CARDS に無い（DOM.LANDSCAPES が正本・cardEl/viewSheet は使えない）ので専用のミニ表示＋拡大を持つ。
  function landmarkMini(id) {
    const ls = (DOM.LANDSCAPES || {})[id] || { name: id };
    return h('div', { class: 'landmark-mini', role: 'button', tabindex: '0',
        style: 'cursor:pointer;text-align:center',
        onclick: () => openLandmarkZoom(id),
        onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLandmarkZoom(id); } } },
      h('img', { src: 'asset/cards/' + id + '.webp', alt: ls.name, loading: 'lazy',
        style: 'width:100%;border-radius:6px;display:block',
        onerror: function () { this.style.display = 'none'; } }),
      h('div', { style: 'font-size:12px;margin-top:3px' }, ls.name));
  }
  function openLandmarkZoom(id) { UI.lmZoom = id; UI._searchActive = false; UI._imeComposing = false; render(); }
  function viewLandmarkZoom() {
    const id = UI.lmZoom;
    const ls = (DOM.LANDSCAPES || {})[id] || { name: id, text: '' };
    return h('div', { class: 'scrim', onclick: (e) => { if (e.target.classList.contains('scrim')) { UI.lmZoom = null; render(); } } },
      h('div', { class: 'sheet', style: 'max-width:600px' },
        h('button', { class: 'sheet-close', 'aria-label': '閉じる', onclick: () => { UI.lmZoom = null; render(); } }, '✕'),
        h('img', { src: 'asset/cards/' + id + '.webp', alt: ls.name,
          style: 'width:100%;border-radius:12px;display:block;margin:0 auto',
          onerror: function () { this.style.display = 'none'; } }),
        h('h3', { style: 'margin:12px 0 2px;color:var(--gold-bright)' }, (LS_ICON[ls.kind] || '🏛 ') + ls.name),
        h('div', { class: 'muted', style: 'font-size:12px;margin-bottom:8px' },
          (LS_KIND_LABEL[ls.kind] || 'ランドマーク / Landmark') +
          // コストを持つ横型（イベント/プロジェクト）だけコストを出す。アーティファクトは買えない＝コスト無し。
          ((ls.kind === 'event' || ls.kind === 'project') ? '（💰' + (ls.cost || 0) + (ls.debt ? ' 🟠' + ls.debt : '') + '）' : '')),
        h('div', { style: 'white-space:pre-line;font-size:14px;line-height:1.55' }, ls.text || '')));
  }

  /* ---------- カード一覧の検索 ----------
     ひらがな→カタカナ／全角→半角／大文字→小文字 に寄せて「ゆるく」当てる。
     空白区切りは AND（例: 「アタック 繁栄」）。検索対象＝カード名・id（英語）・効果テキスト・
     種別ラベル・コスト・その群の見出し（＝拡張名）。 */
  function searchNorm(s) {
    return String(s == null ? '' : s)
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
      .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
      .toLowerCase();
  }
  // 縦型カード（DOM.CARDS）の検索用テキスト
  function cardHaystack(id) {
    const c = DOM.CARDS[id];
    if (!c) return '';
    const types = (c.types || []).map((t) => (TYPE_JP[t] || '') + ' ' + t).join(' ');
    const cost = 'コスト' + c.cost + ' $' + c.cost + (c.potion ? ' ポーション potion' : '') + (c.debt ? ' 負債' + c.debt + ' debt' : '');
    return searchNorm([id, c.name, c.text || '', types, cost].join(' '));
  }
  // 横型（ランドマーク/イベント/プロジェクト/アーティファクト）の検索用テキスト
  function landscapeHaystack(id) {
    const ls = (DOM.LANDSCAPES || {})[id];
    if (!ls) return '';
    const cost = (ls.kind === 'event' || ls.kind === 'project') ? ('コスト' + (ls.cost || 0) + ' $' + (ls.cost || 0) + (ls.debt ? ' 負債' + ls.debt : '')) : '';
    return searchNorm([id, ls.name, ls.text || '', LS_KIND_LABEL[ls.kind] || '', ls.kind || '', cost].join(' '));
  }
  function matchesTerms(hay, terms) { return terms.every((t) => hay.indexOf(t) >= 0); }

  function viewCardList() {
    const back = UI._listReturn || 'home';
    const terms = searchNorm(UI.cardSearch || '').split(/\s+/).filter(Boolean);
    const byCost = (ids) => ids.slice().sort((a, b) => DOM.CARDS[a].cost - DOM.CARDS[b].cost || a.localeCompare(b));
    // 群の定義（表示順は従来どおり）。landscape=true は横型（DOM.CARDS に無い＝専用の描画経路）。
    const groups = [];
    const addC = (title, ids) => { if (ids && ids.length) groups.push({ title, ids, landscape: false }); };
    const addL = (title, ids) => { if (ids && ids.length) groups.push({ title, ids, landscape: true }); };
    const P = DOM.POOLS || {};
    addC('財宝', DOM.TREASURES);
    addC('勝利点・呪い', DOM.VICTORY.concat(['curse']));
    addC('王国カード（基本・第二版）', byCost(P.basic || DOM.KINGDOM));
    addC('王国カード（陰謀・第二版）', byCost(P.intrigue || []));
    addC('王国カード（海辺・第二版）', P.seaside ? byCost(P.seaside) : null);
    addC('王国カード（錬金術・第二版）', P.alchemy ? byCost(P.alchemy) : null);
    addC('王国カード（繁栄・第二版）', P.prosperity ? byCost(P.prosperity) : null);
    addC('王国カード（収穫祭）', P.cornucopia ? byCost(P.cornucopia) : null);
    addC('賞品（褒賞・馬上槍試合）', P.prizes ? byCost(P.prizes) : null);
    addC('王国カード（ギルド）', P.guilds ? byCost(P.guilds) : null);
    addC('王国カード（異郷）', P.hinterlands ? byCost(P.hinterlands) : null);
    addC('王国カード（暗黒時代）', P.darkages ? byCost(P.darkages) : null);
    addC('騎士（暗黒時代）', P.knights ? byCost(P.knights) : null);
    addC('廃墟（暗黒時代）', P.ruins ? byCost(P.ruins) : null);
    addC('避難所（暗黒時代）', P.shelters ? byCost(P.shelters) : null);
    addC('非サプライ（略奪品・狂人・傭兵）', P.darkages_np ? byCost(P.darkages_np) : null);
    addC('王国カード（冒険）', P.adventures ? byCost(P.adventures) : null);
    addC('トラベラー成長先（冒険・非サプライ）', P.travellers ? byCost(P.travellers) : null);
    addC('王国カード（帝国）', P.empires ? byCost(P.empires) : null);
    addC('城（帝国・混合山）', P.castles ? P.castles.slice() : null);
    addC('王国カード（ルネサンス）', P.renaissance ? byCost(P.renaissance) : null);
    addC('王国カード（移動動物園）', P.menagerie ? byCost(P.menagerie) : null);
    addC('馬（移動動物園・非サプライ）', P.horse ? P.horse.slice() : null);
    addC('王国カード（夜想曲）', P.nocturne ? byCost(P.nocturne) : null);
    addC('家宝（夜想曲・開始デッキの銅貨と置き換わる）', P.heirlooms ? byCost(P.heirlooms) : null);
    addC('非サプライ（夜想曲：精霊・願い・コウモリ）', P.nocturne_np ? byCost(P.nocturne_np) : null);
    addC('ゾンビ（夜想曲・準備で廃棄置き場に置く）', P.zombies ? byCost(P.zombies) : null);
    // 同盟：分割山6組は「山」（augurs 等）と「中身24種」を分けて出す（中身は単体では買えない＝山の一番上のみ）。
    addC('王国カード（同盟）', P.allies ? byCost(P.allies) : null);
    addC('分割山の中身（同盟・4種×4枚。一番上の1枚だけ購入できる）', P.allies_split ? P.allies_split.slice() : null);
    // 略奪：戦利品(Loot)は非サプライ（15種×2枚＝30枚を1山に伏せる）＝王国とは別の群に出す。
    addC('王国カード（略奪）', P.plunderexp ? byCost(P.plunderexp) : null);
    addC('戦利品（略奪・非サプライ。15種×2枚を1山に伏せ、獲得したら公開する）', P.loot ? byCost(P.loot) : null);
    addC('王国カード（旭日）', P.risingsun ? byCost(P.risingsun) : null);
    addL('ランドマーク（帝国・横型）', DOM.LANDMARKS_EMPIRES);
    addL('イベント（帝国・横型・購入フェイズに買う）', DOM.EVENTS_EMPIRES);
    addL('イベント（冒険・横型・購入フェイズに買う）', DOM.EVENTS_ADVENTURES);
    addL('イベント（移動動物園・横型・購入フェイズに買う）', DOM.EVENTS_MENAGERIE);
    addL('習性（移動動物園・横型・アクションの効果の代わりに使う）', DOM.WAYS_MENAGERIE);
    addL('祝福（夜想曲・横型・幸運カードから受ける）', DOM.BOONS_NOCTURNE);
    addL('呪詛（夜想曲・横型・不運カードから受ける）', DOM.HEXES_NOCTURNE);
    addL('状態（夜想曲・横型・プレイヤーが取る）', DOM.STATES_NOCTURNE);
    addL('同盟（同盟拡張・横型・1ゲームに1枚だけ／好意トークンの使い道を決める）', DOM.ALLIES_ALLY);
    addL('イベント（略奪・横型・購入フェイズに買う）', DOM.EVENTS_PLUNDER);
    addL('特性（略奪・横型・準備でサプライの王国の山1つに付ける／その山のカード全部に効く）', DOM.TRAITS_PLUNDER);
    addL('イベント（旭日・横型・購入フェイズに買う）', DOM.EVENTS_RISINGSUN);
    addL('予言（旭日・横型・王国に前兆があれば1枚だけ／Sunトークンが尽きると発動する）', DOM.PROPHECIES_RISINGSUN);
    addL('プロジェクト（ルネサンス・横型・1人2つまで）', DOM.PROJECTS_RENAISSANCE);
    addL('アーティファクト（ルネサンス・横型・1人だけが持てる）', DOM.ARTIFACTS_RENAISSANCE);
    addC('プロモカード', P.promo ? byCost(P.promo) : null);
    addC('初版のみ（第二版で廃止）', P.basic1e ? byCost(
      P.basic1e.filter((id) => P.basic.indexOf(id) < 0)
        .concat(P.intrigue1e.filter((id) => P.intrigue.indexOf(id) < 0))) : null);

    // 絞り込み（見出し＝拡張名も検索対象に含めるので「繁栄」「帝国」で群ごと出る）
    let hits = 0;
    const blocks = [];
    groups.forEach((g) => {
      const titleHay = searchNorm(g.title);
      const hay = g.landscape ? landscapeHaystack : cardHaystack;
      const ids = terms.length ? g.ids.filter((id) => matchesTerms(titleHay + ' ' + hay(id), terms)) : g.ids;
      if (!ids.length) return;
      hits += ids.length;
      blocks.push(h('div', { class: 'list-group' },
        h('div', { class: 'section-h' }, g.title + (terms.length ? '（' + ids.length + '）' : '')),
        g.landscape
          ? h('div', { class: 'landmark-list-grid', style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px' },
            ids.map((id) => landmarkMini(id)))
          : h('div', { class: 'cardlist-grid' }, ids.map((id) => miniCard(id)))));
    });

    const setQuery = (v) => { UI.cardSearch = v; UI._searchActive = false; render(); };
    const chip = (label, q) => h('button', {
      class: 'mix-chip' + (searchNorm(UI.cardSearch || '') === searchNorm(q) ? ' on' : ''),
      onclick: () => setQuery(searchNorm(UI.cardSearch || '') === searchNorm(q) ? '' : q),
    }, label);
    const searchBar = h('div', { class: 'card-search' },
      h('div', { class: 'card-search-row' },
        // 【重要】日本語入力(IME)対応：render() は app.innerHTML='' で <input> ごと作り直すため、
        //   変換中（composition 中）に再描画すると未確定文字列が壊れる（「むら」→「むむら村」等）。
        //   変換中は UI.cardSearch だけ更新して**再描画しない**。確定(compositionend)で描き直す。
        h('input', {
          type: 'text', class: 'card-search-input', value: UI.cardSearch || '',
          placeholder: 'カード名・効果・拡張で検索',
          'aria-label': 'カードを検索',
          oninput: (e) => {
            UI.cardSearch = e.target.value; UI._searchCaret = e.target.selectionStart;
            if (UI._imeComposing) return; // 変換中は作り直さない（入力が壊れる）
            UI._searchActive = true; render();
          },
          oncompositionstart: () => { UI._imeComposing = true; },
          oncompositionend: (e) => {
            UI._imeComposing = false;
            UI.cardSearch = e.target.value; UI._searchCaret = e.target.selectionStart;
            UI._searchActive = true; render();
          },
          onfocus: () => { UI._searchActive = true; },
          onblur: () => { UI._imeComposing = false; },
        }),
        (UI.cardSearch || '') ? h('button', { class: 'btn btn-ghost btn-sm card-search-clear', 'aria-label': '検索をクリア', onclick: () => setQuery('') }, '✕') : null),
      h('div', { class: 'mix-chips' },
        chip('アクション', 'アクション'), chip('財宝', '財宝'), chip('勝利点', '勝利点'),
        chip('アタック', 'アタック'), chip('リアクション', 'リアクション'), chip('持続', '持続')),
      terms.length
        ? h('div', { class: 'muted', style: 'font-size:12px' }, hits ? ('見つかったカード：' + hits + '枚') : '該当するカードがありません')
        : null);

    return h('div', { class: 'page' },
      h('div', { class: 'page-top' },
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { UI._searchActive = false; go(back); } }, '← 戻る'),
        h('h2', null, 'カード一覧')),
      h('p', { class: 'muted', style: 'font-size:12px;padding:0 4px' }, 'タップで拡大（コスト・効果つき）。'),
      searchBar,
      blocks.length ? blocks : h('p', { class: 'muted', style: 'padding:18px 4px' }, '見つかりませんでした。別の言葉で試してください（例：ティアラ／アタック／繁栄）。')
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
      const pm = viewPendingModal(state, state.pending);
      if (pm) {
        // 選択モーダルはヘッダを覆うので、同じ「1手もどす」をモーダル内にも挿し込む
        // （全 pending 分岐に手を入れず、共通の外枠 .modal に後付けする）。
        const ub = undoBtn(state, viewer, interactive, 'btn btn-ghost btn-block undo-btn-modal');
        if (ub) (pm.querySelector('.modal') || pm).appendChild(ub);
        frag.appendChild(pm);
      }
    }
    // ギルド：財源を使うオーバーレイ（pending ではない。購入フェイズ・自分の操作中のみ）。
    if (interactive && UI.coffersOpen && !state.pending && state.turn.phase === 'buy' && state.turn.active === viewer) {
      frag.appendChild(modalCoffersSpend(state, viewer));
    } else if (UI.coffersOpen) {
      UI.coffersOpen = false; // 条件を満たさなくなったら閉じる（フェイズ移行など）
    }
    // ルネサンス：村人を使うオーバーレイ（pending ではない。アクションフェイズ・自分の操作中のみ）。
    if (interactive && UI.villagersOpen && !state.pending && state.turn.phase === 'action' && state.turn.active === viewer) {
      frag.appendChild(modalVillagerSpend(state, viewer));
    } else if (UI.villagersOpen) {
      UI.villagersOpen = false; // 条件を満たさなくなったら閉じる（購入フェイズへ移行など）
    }
    return frag;
  }

  // 夜想曲：夜フェイズ（購入フェイズの**後**）を足した。購入フェイズではないので買い物のUIは出さない。
  function phaseLabel(ph) { return ph === 'action' ? 'アクション フェーズ' : ph === 'night' ? '夜 フェーズ' : '購入 フェーズ'; }
  // ギルド／ルネサンス：財源(Coffers)を使う王国か（財源を付与するカード/プロジェクトがあればバッジ/使用ボタンを出す）。
  const COFFERS_CARDS = ['candlestick_maker', 'plaza', 'baker', 'butcher', 'merchant_guild',
    'ducat', 'spices', 'patron', 'silk_merchant', 'swashbuckler', 'villain'];
  const COFFERS_PROJECTS = ['pageant', 'exploration', 'guildhall'];
  function usesCoffers(kingdom, projects) {
    return (kingdom || []).some((id) => COFFERS_CARDS.includes(id)) ||
      (projects || []).some((id) => COFFERS_PROJECTS.includes(id));
  }
  // ルネサンス：村人(Villagers)を使う王国か（村人を付与するカード/プロジェクトがあればバッジ/使用ボタンを出す）。
  const VILLAGER_CARDS = ['lackeys', 'acting_troupe', 'patron', 'recruiter', 'silk_merchant', 'sculptor'];
  const VILLAGER_PROJECTS = ['academy', 'exploration'];
  function usesVillagers(kingdom, projects) {
    return (kingdom || []).some((id) => VILLAGER_CARDS.includes(id)) ||
      (projects || []).some((id) => VILLAGER_PROJECTS.includes(id));
  }
  // 帝国：負債(Debt)を使う王国か（負債コストのカード or capital があれば負債バッジ/返済ボタンを出す）。
  function usesDebt(kingdom) { return (kingdom || []).some((id) => DOM.CARDS[id] && ((DOM.CARDS[id].debt || 0) > 0 || id === 'capital')); }
  /* 同盟：好意(Favor)を使う対局か＝**同盟(Ally)カードが場に出ているゲームだけ**（王国に連携があるとき）。
     好意は財源/村人とは完全に別枠（混ぜて使えない）。得点にならない（例外＝高原の羊飼い）。 */
  function usesFavors(state) { return !!(state && state.ally); }

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
    // 夜想曲：夜フェイズ＝購入の後。夜行カードを好きなだけ使える（アクション権も購入権も要らない）。
    if (t.phase === 'night') {
      return me.hand.some((c) => DOM.isType(c, 'night'))
        ? '🔰 夜フェーズ：光っている夜行カードをタップして使えます（何枚でも使えます）。終わったら「ターンを終える」。'
        : '🔰 夜フェーズ：使える夜行カードはありません。「ターンを終える」で片付けに進みます。';
    }
    const hasTreasure = me.hand.some((c) => DOM.CARDS[c].types.includes('treasure') && c !== 'cursed_gold');
    if (hasTreasure) return '🔰 購入フェーズ：まず「財宝を全部出す」でコインを出しましょう。';
    if (me.hand.includes('cursed_gold')) return '🔰 購入フェーズ：呪われた金貨は「財宝を全部出す」では出ません（出すと呪いを1枚獲得します）。カードをタップして使います。';
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
        usesCoffers(state.kingdom, state.projects)
          ? h('div', { class: 'badge coffers', style: 'background:#b8860b' }, h('div', { class: 'v' }, active.coffers || 0), h('div', { class: 'k' }, '財源'))
          : null,
        // ルネサンス：村人(Villagers)を使う王国のときだけ 村人 を表示（緑）。アクションフェイズに1個=+1アクション。
        usesVillagers(state.kingdom, state.projects)
          ? h('div', { class: 'badge villagers', style: 'background:#3f8f5a' }, h('div', { class: 'v' }, active.villagers || 0), h('div', { class: 'k' }, '村人'))
          : null,
        // 帝国：負債(Debt)を使う王国 or 負債を持つときだけ 負債 を表示（オレンジ）。負債があると購入不可。
        (usesDebt(state.kingdom) || (active.debt || 0) > 0)
          ? h('div', { class: 'badge debt', style: 'background:#d2691e' }, h('div', { class: 'v' }, active.debt || 0), h('div', { class: 'k' }, '負債'))
          : null,
        // 同盟：好意(Favor)＝同盟カードがあるゲームだけ表示（財源/村人とは別枠・使い道は同盟カードが定める）。
        usesFavors(state)
          ? h('div', { class: 'badge favors', style: 'background:#7a5c2e' }, h('div', { class: 'v' }, active.favors || 0), h('div', { class: 'k' }, '好意'))
          : null,
        /* 同盟：リッチ＝「1ターンスキップする」。**公開情報**なのに表示が無いと、自分の手番が飛んでから
           ログで気づくことになる（次に取ろうとするターンが飛ぶ）。 */
        (active.skipTurns || 0) > 0
          ? h('div', { class: 'badge skipturns', style: 'background:#5a4a6e' }, h('div', { class: 'v' }, active.skipTurns), h('div', { class: 'k' }, 'スキップ'))
          : null,
        /* 同盟：航海の追加ターンは**手札から3枚まで**しか使えない。engine は `canPlayHandCard` で弾くが、
           理由が画面に出ていないと「押しても何も起きない」ように見える（残り枚数を出す）。 */
        t.voyageTurn
          ? h('div', { class: 'badge voyage', style: 'background:#2e5c7a' }, h('div', { class: 'v' }, Math.max(0, 3 - (t.handPlays || 0))), h('div', { class: 'k' }, '航海'))
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
    const buyableId = (id) => interactive && t.phase === 'buy' && !state.pending && !t.noBuyCards && // 冒険：使節団の追加ターンはカード購入不可
      (state.players[t.active].debt || 0) === 0 && // 帝国：負債があると購入不可
      (state.supply[id] || 0) > 0 && t.buys > 0 && affordable(state, id) && DOM.engine.canBuyCard(state, t.active, id); // コイン・ポーション・繁栄制約＋購入可否（非サプライ/高級市場/分割山下段を弾く）
    // 横型イベントの購入可否（購入フェイズ・負債0・購入権あり・コインが足りる。イベントはコスト軽減を受けない）。
    //   冒険：1ターン1回／1ゲーム1回のイベント（施し/借入/保存/巡礼/使節団/相続）は engine の canBuyEvent が正本。
    const buyableEvent = (id) => {
      const ev = (DOM.LANDSCAPES || {})[id];
      return !!ev && interactive && t.phase === 'buy' && !state.pending &&
        (DOM.engine.canBuyEvent ? DOM.engine.canBuyEvent(state, t.active, id) : true) &&
        (state.players[t.active].debt || 0) === 0 && t.buys > 0 && (ev.cost || 0) <= t.coins;
    };
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
    // 非サプライの数値キー山（購入不可＝交換/専用獲得のみ）：冒険のトラベラー成長先・収穫祭の賞品・暗黒時代の略奪品/狂人/傭兵。
    //   王国枠に無く供給されている（state.supply に在る）ものを表示して、残枚数を可視化する。
    //   夜想曲の精霊3種／願い／コウモリ、移動動物園の馬も同じ扱い（残枚数が見えないと戦略が立たない）。
    const nonSupplyIds = [].concat((DOM.POOLS && DOM.POOLS.travellers) || [], (DOM.POOLS && DOM.POOLS.prizes) || [],
      (DOM.POOLS && DOM.POOLS.darkages_np) || [], (DOM.POOLS && DOM.POOLS.nocturne_np) || [], (DOM.POOLS && DOM.POOLS.horse) || [])
      .filter((id) => state.supply[id] != null);
    const nonSupplyPile = nonSupplyIds.length
      ? h('div', { class: 'supply-section' }, h('div', { class: 'sup-title' }, '非サプライ（交換・専用で獲得／購入不可）'),
          h('div', { class: 'supply-grid small' }, nonSupplyIds.map((id) => pileEl(id, state, { size: 'sm', onClick: () => onPileTap(state, id, interactive) }))))
      : null;
    // 帝国：横型ランドスケープ（ランドマーク）＝買わない・場に常設。得点/獲得ルールを変える。残VP/溜VP/対象を可視化。
    const landscapeBlock = (state.landmarks && state.landmarks.length)
      ? h('div', { class: 'supply-section' },
          h('div', { class: 'sup-title' }, 'ランドマーク（横型・得点や獲得のルール）'),
          h('div', { class: 'mats' }, state.landmarks.map((id) => {
            const ls = (DOM.LANDSCAPES || {})[id] || { name: id, text: '' };
            const bits = [];
            const rv = state.landmarkVP && state.landmarkVP[id];
            const sv = state.landmarkStash && state.landmarkStash[id];
            if (rv != null) bits.push('残VP ' + rv);
            if (sv) bits.push('溜VP ' + sv);
            if (id === 'obelisk' && state.obeliskPile) bits.push('対象: ' + (DOM.CARDS[state.obeliskPile] ? DOM.CARDS[state.obeliskPile].name : state.obeliskPile));
            return h('div', { class: 'mat-row landmark-row', title: (ls.text || ''),
                role: 'button', tabindex: '0', style: 'cursor:pointer',
                onclick: () => openLandmarkZoom(id),
                onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLandmarkZoom(id); } } },
              h('img', { class: 'landmark-thumb', src: 'asset/cards/' + id + '.webp', alt: ls.name, loading: 'lazy',
                style: 'height:40px;width:60px;object-fit:cover;border-radius:4px;flex:0 0 auto',
                onerror: function () { this.style.display = 'none'; } }),
              h('span', { class: 'mat-label' }, '🏛 ' + ls.name + (bits.length ? '（' + bits.join(' / ') + '）' : '')),
              h('span', { class: 'muted', style: 'font-size:12px;margin-left:8px' }, (ls.text || '').replace(/\n/g, ' ')));
          })))
      : null;
    // 帝国：横型イベント（買う横型）＝購入フェイズにコイン(＋負債)を払って買う・購入権を1消費・複数回可。
    const eventBlock = (state.events && state.events.length)
      ? h('div', { class: 'supply-section' },
          h('div', { class: 'sup-title' }, 'イベント（横型・購入フェイズに買う）'),
          h('div', { class: 'mats' }, state.events.map((id) => {
            const ev = (DOM.LANDSCAPES || {})[id] || { name: id, text: '', cost: 0, debt: 0 };
            const costStr = '💰' + (ev.cost || 0) + (ev.debt ? ' 🟠' + ev.debt : '');
            const canBuy = buyableEvent(id);
            return h('div', { class: 'mat-row event-row', title: (ev.text || '') },
              h('img', { class: 'landmark-thumb', src: 'asset/cards/' + id + '.webp', alt: ev.name, loading: 'lazy',
                style: 'height:40px;width:60px;object-fit:cover;border-radius:4px;flex:0 0 auto;cursor:pointer',
                onclick: () => openLandmarkZoom(id),
                onerror: function () { this.style.display = 'none'; } }),
              h('span', { class: 'mat-label', role: 'button', tabindex: '0', style: 'cursor:pointer',
                  onclick: () => openLandmarkZoom(id),
                  onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLandmarkZoom(id); } } },
                '🎫 ' + ev.name + '（' + costStr + '）'),
              h('span', { class: 'muted', style: 'font-size:12px;margin-left:8px' }, (ev.text || '').replace(/\n/g, ' ')),
              h('button', { class: 'btn btn-sm' + (canBuy ? ' btn-primary' : ''), style: 'margin-left:auto',
                  disabled: canBuy ? null : 'disabled',
                  onclick: canBuy ? () => dispatch({ type: 'BUY_EVENT', event: id }) : null }, '買う'));
          })))
      : null;
    // ルネサンス：横型プロジェクト（買う横型）＝購入フェイズにコインを払って買う・購入権1消費・**1人2つまで**・
    //   同じものは1回だけ・以後ずっと効果が続く（キューブ●で誰が買ったかを表示）。engine の canBuyProject が正本。
    const buyableProject = (id) => interactive && !state.pending &&
      !!(DOM.engine.canBuyProject && DOM.engine.canBuyProject(state, t.active, id));
    const projectBlock = (state.projects && state.projects.length)
      ? h('div', { class: 'supply-section' },
          h('div', { class: 'sup-title' }, 'プロジェクト（横型・購入フェイズに買う／1人2つまで）'),
          h('div', { class: 'mats' }, state.projects.map((id) => {
            const pr = (DOM.LANDSCAPES || {})[id] || { name: id, text: '', cost: 0 };
            const owners = state.players.filter((p) => (p.projects || []).indexOf(id) >= 0);
            // 悪巧み（sinister_plot）はプレイヤーごとのトークン数もこの上に表示する。
            const cubes = owners.length
              ? owners.map((p) => '●' + p.name + (id === 'sinister_plot' && (p.sinisterPlot || 0) > 0 ? '(🔘' + p.sinisterPlot + ')' : '')).join(' ')
              : '';
            const canBuy = buyableProject(id);
            return h('div', { class: 'mat-row project-row', title: (pr.text || '') },
              h('img', { class: 'landmark-thumb', src: 'asset/cards/' + id + '.webp', alt: pr.name, loading: 'lazy',
                style: 'height:40px;width:60px;object-fit:cover;border-radius:4px;flex:0 0 auto;cursor:pointer',
                onclick: () => openLandmarkZoom(id),
                onerror: function () { this.style.display = 'none'; } }),
              h('span', { class: 'mat-label', role: 'button', tabindex: '0', style: 'cursor:pointer',
                  onclick: () => openLandmarkZoom(id),
                  onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLandmarkZoom(id); } } },
                '🏗 ' + pr.name + '（💰' + (pr.cost || 0) + '）' + (cubes ? ' ' + cubes : '')),
              h('span', { class: 'muted', style: 'font-size:12px;margin-left:8px' }, (pr.text || '').replace(/\n/g, ' ')),
              h('button', { class: 'btn btn-sm' + (canBuy ? ' btn-primary' : ''), style: 'margin-left:auto',
                  disabled: canBuy ? null : 'disabled',
                  onclick: canBuy ? () => dispatch({ type: 'BUY_PROJECT', project: id }) : null }, '買う'));
          })))
      : null;
    // ルネサンス：アーティファクト（非カード）＝買えない・1人しか持てない・条件を満たすと相手から奪う。
    const artifactIds = Object.keys(state.artifacts || {});
    const artifactBlock = artifactIds.length
      ? h('div', { class: 'supply-section' },
          h('div', { class: 'sup-title' }, 'アーティファクト（横型・1人だけが持てる／奪い合う）'),
          h('div', { class: 'mats' }, artifactIds.map((id) => {
            const af = (DOM.LANDSCAPES || {})[id] || { name: id, text: '' };
            const owner = state.artifacts[id];
            const who = owner == null ? '（誰も持っていない）' : state.players[owner].name + ' が所持';
            return h('div', { class: 'mat-row artifact-row' + (owner === viewer ? ' mine' : ''), title: (af.text || '') },
              h('img', { class: 'landmark-thumb', src: 'asset/cards/' + id + '.webp', alt: af.name, loading: 'lazy',
                style: 'height:40px;width:60px;object-fit:cover;border-radius:4px;flex:0 0 auto;cursor:pointer',
                onclick: () => openLandmarkZoom(id),
                onerror: function () { this.style.display = 'none'; } }),
              h('span', { class: 'mat-label', role: 'button', tabindex: '0', style: 'cursor:pointer',
                  onclick: () => openLandmarkZoom(id),
                  onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLandmarkZoom(id); } } },
                '🗝 ' + af.name + '：' + who),
              h('span', { class: 'muted', style: 'font-size:12px;margin-left:8px' }, (af.text || '').replace(/\n/g, ' ')));
          })))
      : null;
    // 移動動物園：習性（Way）＝買わない横型。アクションを使うとき「記載効果の代わり」に選べる。
    //   ハツカネズミの習性は脇に置いた1枚（state.mouseCard）も併記する。
    const wayBlock = (state.ways && state.ways.length)
      ? h('div', { class: 'supply-section' },
          h('div', { class: 'sup-title' }, '習性（横型・アクションの効果の代わりに使う）'),
          h('div', { class: 'mats' }, state.ways.map((id) => {
            const wy = (DOM.LANDSCAPES || {})[id] || { name: id, text: '' };
            const extra = (id === 'way_of_the_mouse' && state.mouseCard)
              ? '（脇：' + ((DOM.CARDS[state.mouseCard] || {}).name || state.mouseCard) + '）' : '';
            return h('div', { class: 'mat-row way-row', title: (wy.text || '') },
              h('img', { class: 'landmark-thumb', src: 'asset/cards/' + id + '.webp', alt: wy.name, loading: 'lazy',
                style: 'height:40px;width:60px;object-fit:cover;border-radius:4px;flex:0 0 auto;cursor:pointer',
                onclick: () => openLandmarkZoom(id),
                onerror: function () { this.style.display = 'none'; } }),
              h('span', { class: 'mat-label', role: 'button', tabindex: '0', style: 'cursor:pointer',
                  onclick: () => openLandmarkZoom(id),
                  onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLandmarkZoom(id); } } },
                '🐾 ' + wy.name + extra),
              h('span', { class: 'muted', style: 'font-size:12px;margin-left:8px' }, (wy.text || '').replace(/\n/g, ' ')));
          })))
      : null;
    /* 同盟：Ally（横型・1ゲームに1枚だけ・買わない）＝好意トークンの使い道を定める。
       王国に連携(Liaison)が1枚でもあるときだけ登場し、全員の好意の枚数もここに出す（公開情報）。 */
    const allyBlock = state.ally
      ? (() => {
        const al = (DOM.LANDSCAPES || {})[state.ally] || { name: state.ally, text: '' };
        const favs = state.players.map((pl) => pl.name + ' 🤝' + (pl.favors || 0)).join(' / ');
        return h('div', { class: 'supply-section' },
          h('div', { class: 'sup-title' }, '同盟（横型・好意トークンの使い道）'),
          h('div', { class: 'mats' },
            h('div', { class: 'mat-row ally-row', title: (al.text || '') },
              h('img', { class: 'landmark-thumb', src: 'asset/cards/' + state.ally + '.webp', alt: al.name, loading: 'lazy',
                style: 'height:40px;width:60px;object-fit:cover;border-radius:4px;flex:0 0 auto;cursor:pointer',
                onclick: () => openLandmarkZoom(state.ally),
                onerror: function () { this.style.display = 'none'; } }),
              h('span', { class: 'mat-label', role: 'button', tabindex: '0', style: 'cursor:pointer',
                  onclick: () => openLandmarkZoom(state.ally),
                  onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLandmarkZoom(state.ally); } } },
                '🤝 ' + al.name + '（' + favs + '）'),
              h('span', { class: 'muted', style: 'font-size:12px;margin-left:8px' }, (al.text || '').replace(/\n/g, ' ')))));
      })()
      : null;
    /* 旭日：予言（横型・1ゲームに1枚だけ・買わない）＝王国に前兆(Omen)があるときだけ登場する。
       **残りの Sun トークン数は公開情報**（誰が「+1 Sun」を出すと発動するかは全員の戦略に直結する）。
       最後の1個を取り除くとテキストが有効になり、以後ゲーム終了までずっと効く。 */
    const prophecyBlock = state.prophecy
      ? (() => {
        const pr = (DOM.LANDSCAPES || {})[state.prophecy] || { name: state.prophecy, text: '' };
        const sun = state.sunTokens || 0;
        const status = state.prophecyOn ? '発動中（ゲーム終了まで有効）' : '残り ' + sun + '個';
        return h('div', { class: 'supply-section' },
          h('div', { class: 'sup-title' }, '予言（横型・Sunトークンが尽きると発動）'),
          h('div', { class: 'mats' },
            h('div', { class: 'mat-row prophecy-row', title: (pr.text || '') },
              h('img', { class: 'landmark-thumb', src: 'asset/cards/' + state.prophecy + '.webp', alt: pr.name, loading: 'lazy',
                style: 'height:40px;width:60px;object-fit:cover;border-radius:4px;flex:0 0 auto;cursor:pointer',
                onclick: () => openLandmarkZoom(state.prophecy),
                onerror: function () { this.style.display = 'none'; } }),
              h('span', { class: 'mat-label', role: 'button', tabindex: '0', style: 'cursor:pointer',
                  onclick: () => openLandmarkZoom(state.prophecy),
                  onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLandmarkZoom(state.prophecy); } } },
                '🔮 ' + pr.name + '（☀' + status + '）'),
              h('span', { class: 'muted', style: 'font-size:12px;margin-left:8px' }, (pr.text || '').replace(/\n/g, ' ')))));
      })()
      : null;
    const supply = h('div', null,
      allyBlock,
      prophecyBlock,
      landscapeBlock,
      eventBlock,
      projectBlock,
      artifactBlock,
      wayBlock,
      // 財宝・勝利点は基本カード。デスクトップでは横並びにして縦スペースを節約。
      h('div', { class: 'supply-basics' },
        supSection('財宝', treasureRow, 'small'),
        supSection('勝利点', victoryRow, 'small')),
      supSection('王国カード（アクション）', kingdomByCost, 'big'),
      ruinsPile,
      nonSupplyPile);

    // 場（プレイ済み）＋持続カード（⏳付き・場に残る）＋王子の脇（👑・毎ターン開始時に使用）
    /* 同盟：駐屯地（garrison）の上に載ったトークン数を場のチップに出す（**好意ではない**＝自前のカウンタ）。
       トークン1個＝次のターンの +1カード／0個ならそのターンの片付けで普通に捨てられる（条件つき持続）＝
       公開情報なので見えないと人間が判断できない。 */
    const gTok = (state.turn && state.turn.garrisonTokens) || [];
    let gTokI = 0;
    const inPlayChips = active.inPlay.map((id) => h('div', { class: 'chip-card ' + typeClass(id) + coinClass(id) },
      DOM.CARDS[id].name + (id === 'garrison' && gTok[gTokI] != null ? ' ●' + gTok[gTokI++] : '')));
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
    // 移動動物園：追放マット（公開・自分のカード＝得点にも数える。同名を獲得すると好きな枚数を捨て札に戻せる）
    if ((me.exile || []).length) {
      const ex = {}; me.exile.forEach((id) => { ex[id] = (ex[id] || 0) + 1; });
      matRows.push(h('div', { class: 'mat-row' },
        h('span', { class: 'mat-label' }, '🚫 追放マット: '),
        Object.keys(ex).map((id) => h('span', { class: 'chip-card ' + typeClass(id) },
          DOM.CARDS[id].name + (ex[id] > 1 ? '×' + ex[id] : '')))));
    }
    // 移動動物園：投資（Invest）で追放したカード（そのカードを**他プレイヤー**が獲得すると投資者が +2カード）。
    //   **全員ぶんを出す**＝相手の投資は「自分がそのカードを買うと相手が2枚引く」＝購入判断を直接변える公開情報。
    //   自分のぶんだけ出すと、買ってから相手が引いて初めて気づくことになる。
    state.players.forEach((pl) => {
      if (!Object.keys(pl.exileInvested || {}).length) return;
      matRows.push(h('div', { class: 'mat-row' },
        h('span', { class: 'mat-label' }, '📈 ' + (pl === me ? '投資' : pl.name + ' の投資') + '（獲得されると +2カード）: '),
        Object.keys(pl.exileInvested).map((id) => h('span', { class: 'chip-card ' + typeClass(id) },
          ((DOM.CARDS[id] || {}).name || id) + (pl.exileInvested[id] > 1 ? '×' + pl.exileInvested[id] : '')))));
    });
    // 移動動物園：遅延／刈り入れで脇に置いたカード（次の自分のターン開始時に使用する。公開）
    if ((me.eventSetAside || []).length) matRows.push(h('div', { class: 'mat-row' },
      h('span', { class: 'mat-label' }, '⏳ 次のターン開始時に使う: '),
      me.eventSetAside.map((id) => h('span', { class: 'chip-card ' + typeClass(id) }, (DOM.CARDS[id] || {}).name || id))));
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
    /* 夜想曲：状態（錯乱/嫉妬/生活苦/二重苦/森の迷子）・受け手の前に置かれた祝福・保持中の祝福・
       脇札（幽霊＝公開／納骨堂＝所有者のみ枚数）を可視化する。どれも非カードだが盤面の判断材料になる。 */
    const lsName = (id) => ((DOM.LANDSCAPES || {})[id] || {}).name || id;
    state.players.forEach((pl, idx) => {
      const bits = [];
      if (pl.deluded) bits.push('🌀 錯乱');
      if (pl.envious) bits.push('😖 嫉妬');
      if (pl.misery === 1) bits.push('💀 生活苦(-2点)');
      else if (pl.misery >= 2) bits.push('💀 二重苦(-4点)');
      if (state.lostInTheWoods === idx) bits.push('🌲 森の迷子');
      (pl.boonsInFront || []).forEach((b) => bits.push('✨ ' + lsName(b)));
      (pl.boonsHeld || []).forEach((b) => bits.push('🎁 ' + lsName(b) + '（次のターンに受ける）'));
      if ((pl.ghostSetAside || []).length) bits.push('👻 幽霊の脇: ' + pl.ghostSetAside.map((c) => DOM.CARDS[c].name).join('・'));
      if ((pl.cryptSetAside || []).length) {
        bits.push('⚰️ 納骨堂の脇: ' + (idx === viewer ? pl.cryptSetAside.map((c) => DOM.CARDS[c].name).join('・') : pl.cryptSetAside.length + '枚'));
      }
      // 略奪：檻の脇札（伏せ札＝自分には中身・相手には枚数だけ見せる）
      if ((pl.cage || []).length) {
        bits.push('🗜️ 檻の脇: ' + (idx === viewer ? pl.cage.map((c) => (DOM.CARDS[c] || {}).name || '？').join('・') : pl.cage.length + '枚'));
      }
      if (bits.length) matRows.push(h('div', { class: 'mat-row' },
        h('span', { class: 'mat-label' }, pl.name + ': '),
        bits.map((b) => h('span', { class: 'chip-card' }, b))));
    });
    // 略奪：特性(Trait)＝どの山にどの特性が付いているか（公開・対局中不変）。
    if (state.traits && Object.keys(state.traits).length) {
      const bits = Object.keys(state.traits).map((tid) => {
        const tn = (DOM.LANDSCAPES[tid] || {}).name || tid;
        const pn = (DOM.CARDS[state.traits[tid]] || {}).name || state.traits[tid];
        return h('span', { class: 'chip-card', onclick: () => openLandmarkZoom(tid) }, '🏷️ ' + tn + '：' + pn);
      });
      matRows.push(h('div', { class: 'mat-row' }, h('span', { class: 'mat-label' }, '特性: '), bits));
    }
    // 夜想曲：祝福/呪詛の山の残枚数と、捨て札の一番上（公開情報）。
    if (state.boons || state.hexes) {
      const bits = [];
      if (state.boons) {
        bits.push('✨ 祝福 山' + state.boons.deck.length + '・捨' + state.boons.discard.length);
        const top = state.boons.discard[state.boons.discard.length - 1];
        if (top && top !== 'back') bits.push('直前: ' + lsName(top));
        (state.boons.druid || []).forEach((b) => bits.push('🌿 ' + lsName(b)));
      }
      if (state.hexes) {
        bits.push('☠️ 呪詛 山' + state.hexes.deck.length + '・捨' + state.hexes.discard.length);
        const top = state.hexes.discard[state.hexes.discard.length - 1];
        if (top && top !== 'back') bits.push('直前: ' + lsName(top));
      }
      matRows.push(h('div', { class: 'mat-row' },
        h('span', { class: 'mat-label' }, '祝福／呪詛: '),
        bits.map((b) => h('span', { class: 'chip-card' }, b))));
    }
    /* 略奪：戦利品(Loot)の山＝**非サプライ・中身は完全に秘密**（廃墟と違い一番上も見えない）。
       残枚数だけ出す（見えないと「あと何枚あるか」が分からず戦略が立たない＝§0-28 の非サプライ5山と同じ理由）。
       獲得した1枚は公開演出（reveals）側に出るのでここには出さない。 */
    if (Array.isArray(state.loot)) {
      matRows.push(h('div', { class: 'mat-row' },
        h('span', { class: 'mat-label' }, '戦利品: '),
        h('span', { class: 'chip-card' }, '🎁 山 ' + state.loot.length + '枚（裏向き・中身は非公開）')));
    }
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
    // 夜想曲：夜行カード（アクションでない night）は専用群で大きく出す（夜フェイズでのみ光る）。
    if (hg.nights.length) handBlocks.push(h('div', { class: 'hand-group' },
      h('div', { class: 'hg-label' }, '夜行'),
      h('div', { class: 'hand-cards big' }, hg.nights.map((id) => cardEl(id, { size: 'lg', count: hg.counts[id], dim: !handCardPlayable(state, id, interactive), onClick: () => onHandTap(state, id, interactive) })))));
    const compact = hg.coins.concat(hg.vp);
    if (compact.length) handBlocks.push(h('div', { class: 'hand-group' },
      h('div', { class: 'hg-label' }, '財宝・勝利点'),
      h('div', { class: 'hand-cards small' }, compact.map((id) => cardEl(id, { size: 'sm', count: hg.counts[id], dim: !handCardPlayable(state, id, interactive), onClick: () => onHandTap(state, id, interactive) })))));
    if (!handP.hand.length) handBlocks.push(h('div', { class: 'empty-note' }, '手札がありません'));
    /* 旭日：影(Shadow)＝**山札のどこにあっても手札と同じように使える**（裏面が違うので位置は自分に見えている）。
       ⚠ **手札ではない**ので手札の群には混ぜず、専用の群に出す（小路の捨て札・民兵・書庫の手札枚数には数えない）。
       アクション権を普通に消費するので、光る条件は手札のアクションと同じ（`handCardPlayable`）。 */
    {
      const shadows = (handP.deck || []).filter((c) => DOM.isType(c, 'shadow'));
      if (shadows.length) {
        const uniq = [...new Set(shadows)];
        const cnt = {}; shadows.forEach((c) => { cnt[c] = (cnt[c] || 0) + 1; });
        handBlocks.push(h('div', { class: 'hand-group shadow-group' },
          h('div', { class: 'hg-label' }, '影（山札から使える・手札ではない）'),
          h('div', { class: 'hand-cards big' }, uniq.map((id) => cardEl(id, {
            size: 'lg', count: cnt[id] > 1 ? cnt[id] : 0,
            dim: !handCardPlayable(state, id, interactive),
            onClick: () => onHandTap(state, id, interactive),
          })))));
      }
    }

    const logLines = state.log.slice(-6);
    const logBox = h('div', { class: 'log', onclick: () => { UI.logModal = true; sfx('tap'); render(); } },
      logLines.map((l, i) => h('div', { class: i === logLines.length - 1 ? 'latest' : '' }, l)),
      h('div', { class: 'log-more' }, '📜 タップで全履歴'));

    const moveLine = lastMove(state.log);
    // 初心者モードの「1手もどす」はヘッダ（常に見える位置）に置く。選択モーダル中は
    // viewGameDispatch がモーダル内にも同じボタンを挿し込む（モーダルで詰まっても戻れるように）。
    const undoTop = undoBtn(state, viewer, interactive, 'btn btn-ghost btn-sm undo-btn');
    const moveBar = h('div', { class: 'last-move' + (undoTop ? ' with-undo' : '') },
      moveLine ? h('span', null, '🃏 ' + moveLine) : h('span', { class: 'muted' }, 'まだ動きはありません'),
      undoTop);

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
      // ※ここは「手札の表示グループ分け」＝静的種別でよい（資本主義でアクションが財宝になっても
      //   アクション群に入れて表示し、購入フェイズでは playable() が動的述語で光らせる）。state を持たない関数。
      // 夜想曲：純粋な夜行カード（アクションでない night）は上の3群のどれにも入らない＝**専用の群が無いと
      //   手札に1枚も描画されず人間が操作不能**になる（人狼のようにアクションでもある夜行はアクション群に出る）。
      nights: present.filter((id) => DOM.isType(id, 'night') && !DOM.isType(id, 'action')),
      coins: present.filter((id) => DOM.isType(id, 'treasure') && !DOM.isType(id, 'action') && !DOM.isType(id, 'night')),
      vp: present.filter((id) => (DOM.isType(id, 'victory') || DOM.isType(id, 'curse')) && !DOM.isType(id, 'action') && !DOM.isType(id, 'treasure') && !DOM.isType(id, 'night')),
    };
  }

  // 冒険：相続＝自分のターン中、屋敷はアクション（命令）としてもプレイできる。engine と同じ述語を見る。
  function inheritedEstate(state, id) {
    const t = state.turn;
    const subj = state.players[t.active];
    return !!(DOM.engine.inheritedEstate && DOM.engine.inheritedEstate(subj, id));
  }
  function handCardPlayable(state, id, interactive) {
    if (!interactive || state.pending) return false;
    const t = state.turn;
    /* 同盟：航海の追加ターン＝手札から3枚まで／将軍＝場に2枚以上ある同名のアクションは手札から使えない。
       **engine拒否・CPU非提案・UI（見た目とタップの両方）が同じ述語を見る**（見た目だけ明るいと
       「押したのに何も起きない＝バグ」に見える）。 */
    if (DOM.engine.canPlayFromHand && !DOM.engine.canPlayFromHand(state, t.active)) return false;
    if (t.phase === 'action') return (DOM.CARDS[id].types.includes('action') || inheritedEstate(state, id)) && t.actions > 0
      && !(DOM.engine.warlordBlocks && DOM.engine.warlordBlocks(state, t.active, id));
    // 公式：一度でも購入したら、そのターンはもう財宝を出せない（t.treasuresLocked）。
    // ルネサンス：資本主義＝「+$を含むアクション」も自分のターン中は財宝＝engine の isTreasureFor が正本。
    if (t.phase === 'buy') return isTreasureNow(state, id) && !t.treasuresLocked;
    // 夜想曲：夜フェイズは夜行カードだけ使える（アクション権も購入権も要らない＝何枚でも使える）。
    if (t.phase === 'night') return DOM.isType(id, 'night');
    return false;
  }
  // engine と同じ財宝判定（資本主義の動的な財宝化を含む）。engine が拒否する手をUIに出さない。
  function isTreasureNow(state, id) {
    return DOM.engine.isTreasureFor ? DOM.engine.isTreasureFor(state, id) : DOM.CARDS[id].types.includes('treasure');
  }

  function onHandTap(state, id, interactive) {
    const c = DOM.CARDS[id];
    const t = state.turn;
    /* 同盟：航海（Voyage）の追加ターンは**手札から3枚まで**しか使えない（engine が拒否する手をUIに出さない）。 */
    if (interactive && DOM.engine.canPlayFromHand && !DOM.engine.canPlayFromHand(state, t.active)) {
      showSheet(id, null);
      return;
    }
    // 同盟：将軍＝場に2枚以上ある同名のアクションは手札から使えない（engine が拒否する手をUIに出さない）。
    const warlordBlocked = DOM.engine.warlordBlocks && DOM.engine.warlordBlocks(state, t.active, id);
    if (interactive && !state.pending && t.phase === 'action' && !warlordBlocked
        && (c.types.includes('action') || inheritedEstate(state, id)) && t.actions > 0) {
      // 移動動物園：習性（Way）が採用されていれば「記載効果の代わりに習性で使う」ボタンも並べる。
      const wayList = (state.ways || []).filter((w) => (DOM.LANDSCAPES || {})[w]);
      const btns = [{ label: wayList.length ? '使う（カードの効果）' : '使う', cls: 'btn-primary', on: () => dispatch({ type: 'PLAY_ACTION', card: id }) }];
      wayList.forEach((w) => {
        btns.push({ label: '「' + DOM.LANDSCAPES[w].name + '」で使う', on: () => dispatch({ type: 'PLAY_ACTION', card: id, way: w }) });
      });
      showSheet(id, btns.length > 1 ? btns : btns[0]);
    } else if (interactive && !state.pending && t.phase === 'buy' && isTreasureNow(state, id) && !t.treasuresLocked) {
      showSheet(id, { label: '財宝を出す', cls: 'btn-primary', on: () => dispatch({ type: 'PLAY_TREASURE', card: id }) });
    } else if (interactive && !state.pending && t.phase === 'night' && DOM.isType(id, 'night')) {
      // 夜想曲：夜フェイズの使用。習性（Way）は「アクションカードを使うとき」なので夜行カードには選ばせない。
      showSheet(id, { label: '使う（夜）', cls: 'btn-primary', on: () => dispatch({ type: 'PLAY_NIGHT', card: id }) });
    } else {
      showSheet(id, null);
    }
  }
  function onPileTap(state, id, interactive) {
    const t = state.turn;
    const cost = effCost(state, id);
    const pc = potCost(id); // 錬金術：ポーション費用（あれば）
    // 冒険：使節団（Mission）の追加ターンはカードを購入できない（イベントは買える）＝engine の拒否と揃える。
    const canBuy = interactive && !state.pending && t.phase === 'buy' && !t.noBuyCards && (state.players[t.active].debt || 0) === 0 && (state.supply[id] || 0) > 0 && t.buys > 0 && affordable(state, id) && DOM.engine.canBuyCard(state, t.active, id);
    const label = '購入する（' + cost + 'コイン' + (pc ? '＋ポーション' + (pc > 1 ? pc : '') : '') + '）';
    // 混合山は拡大シートも一番上の実カードを見せる（購入の dispatch は山キーのまま）。
    if (canBuy) showSheet(mixTop(state, id), { label, cls: 'btn-primary', on: () => dispatch({ type: 'BUY', card: id }) });
    else showSheet(mixTop(state, id), null);
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
    /* 同盟：占星術師団／メイソン団＝**シャッフルのたび**に好意を払って札を選び出す Ally。
       シャッフルは効果解決の途中で同期的に起きて対話を挟めないので（星図/へそくりと同じ難所）、
       **「1回のシャッフルに好意を何個まで使うか」だけ**を常設方針として本人が決め、
       どの札を選ぶかはエンジンが最善を自動で選ぶ（§0-29 の決定）。 */
    const favorShuffleBtn = (() => {
      if (t.active !== viewer) return null;
      if (state.ally !== 'order_of_astrologers' && state.ally !== 'order_of_masons') return null;
      const mp = state.players[viewer];
      const cur = mp.favorShuffle || 0;
      const nm = (DOM.LANDSCAPES[state.ally] || {}).name || state.ally;
      return h('button', { class: 'btn btn-block', onclick: () => dispatch({ type: 'FAVOR_SHUFFLE_SETTING', player: viewer, value: (cur + 1) % 4 }) },
        '🤝 ' + nm + '：1回のシャッフルに使う好意 ' + cur + '個（タップで変更・持っている好意 ' + (mp.favors || 0) + '）');
    })();
    /* 帝国：負債(Debt)の返済ボタン。
       【2024エラッタ】負債は **そのターン中ならいつでも** 返済できる（購入フェイズ限定ではない）。
       アクションフェイズで +$ を出したあと闇市場を使う、といった手のために全フェイズで出す
       （engine の `REPAY_DEBT` も同じ条件＝3面を揃える）。 */
    const debtNow0 = state.players[viewer].debt || 0;
    const repayBtn = (t.active === viewer && debtNow0 > 0 && t.coins > 0)
      ? h('button', { class: 'btn btn-block', style: 'background:#d2691e;color:#fff', onclick: () => dispatch({ type: 'REPAY_DEBT', amount: Math.min(debtNow0, t.coins) }) },
          '🟠 負債を返済（' + Math.min(debtNow0, t.coins) + '返済／残' + debtNow0 + '）')
      : null;
    if (t.phase === 'action') {
      // ルネサンス：村人(Villagers)を持っていれば「村人を使う」ボタン（アクションフェイズ・1個=+1アクション）。
      const villagerBtn = (t.active === viewer && (state.players[viewer].villagers || 0) > 0)
        ? h('button', { class: 'btn btn-block', style: 'background:#3f8f5a;color:#fff', onclick: () => { UI.villagersOpen = true; UI.amount = null; render(); } },
            '🧑 村人を使う（' + state.players[viewer].villagers + '）')
        : null;
      return h('div', { class: 'actions-bar' },
        villagerBtn,
        repayBtn,
        stashBtn,
        favorShuffleBtn,
        h('button', { class: 'btn btn-primary btn-block', onclick: () => endActionPhase(state, viewer) }, '購入フェーズへ ▶'));
    }
    /* 夜想曲：夜フェイズ＝購入フェイズは終わっている。財宝/財源/購入はできず、
       できるのは「夜行カードを使う」（手札のカードをタップ）と「ターンを終える」だけ。
       ⚠ ただし**負債の返済だけは 2024エラッタで「ターン中いつでも」**になったので夜でも出す。 */
    if (t.phase === 'night') {
      return h('div', { class: 'actions-bar' },
        repayBtn,
        stashBtn,
        favorShuffleBtn,
        h('button', { class: 'btn btn-primary btn-block', onclick: () => endTurnTap(state, viewer) }, 'ターンを終える'));
    }
    // 支配中は操作対象（被支配者=t.active）の手札で判定する（財宝を出すのも engine では被支配者の手札）。
    const hp = (t.possessedBy != null && t.possessedBy === viewer) ? state.players[t.active] : state.players[viewer];
    // 公式：一度でも購入（カード/イベント）したら、そのターンはもう財宝を出せない（engine が拒否する＝ボタンも無効化）。
    // 夜想曲：呪われた金貨は engine 側で「財宝を全部出す」の対象外（出すと呪いを獲得する）＝ボタン条件も揃える。
    // 同盟：航海の追加ターンは手札から3枚まで（engine が拒否する手をボタンに出さない）。
    const hasTreasure = hp.hand.some((c) => isTreasureNow(state, c) && c !== 'cursed_gold') && !t.treasuresLocked
      && (!DOM.engine.canPlayFromHand || DOM.engine.canPlayFromHand(state, t.active));
    // ギルド：財源(Coffers)を持っていれば「財源を使う」ボタン（購入フェイズ・1枚=+1コイン）。
    const cofferBtn = (t.active === viewer && (state.players[viewer].coffers || 0) > 0)
      ? h('button', { class: 'btn btn-block', style: 'background:#b8860b;color:#fff', onclick: () => { UI.coffersOpen = true; UI.amount = null; render(); } }, '💰 財源を使う（' + state.players[viewer].coffers + '）')
      : null;
    // （負債の返済ボタン `repayBtn` は上でフェイズ共通に作ってある＝$1=負債1個。負債0にしないと購入できない）
    return h('div', { class: 'actions-bar' },
      h('button', { class: 'btn btn-block', disabled: hasTreasure ? null : 'disabled', onclick: () => dispatch({ type: 'PLAY_ALL_TREASURES' }) }, '財宝を全部出す'),
      repayBtn,
      cofferBtn,
      stashBtn,
      favorShuffleBtn,
      h('button', { class: 'btn btn-primary btn-block', onclick: () => endTurnTap(state, viewer) }, 'ターンを終える'));
  }
  // ギルド：財源を何枚使うか選ぶ（購入フェイズの任意タイミング。1枚=+1コイン）。pending ではない独立オーバーレイ。
  function modalCoffersSpend(state, viewer) {
    const coffers = state.players[viewer].coffers || 0;
    return modalAmount('財源を使う', '財源を1枚使うごとに +1コイン になります（現在 ' + state.turn.coins + ' コイン）。', coffers, 0,
      (n) => (n > 0 ? '財源を ' + n + '枚 使う（+' + n + 'コイン）' : '使わない'),
      (n) => { UI.coffersOpen = false; if (n > 0) dispatch({ type: 'COFFERS_SPEND', amount: n }); else render(); });
  }
  // ルネサンス：村人を何人使うか選ぶ（アクションフェイズの任意タイミング。1人=+1アクション）。pending ではない独立オーバーレイ。
  function modalVillagerSpend(state, viewer) {
    const villagers = state.players[viewer].villagers || 0;
    return modalAmount('村人を使う', '村人を1人使うごとに +1アクション になります（現在 ' + state.turn.actions + ' アクション）。', villagers, 0,
      (n) => (n > 0 ? '村人を ' + n + '人 使う（+' + n + 'アクション）' : '使わない'),
      (n) => { UI.villagersOpen = false; if (n > 0) dispatch({ type: 'SPEND_VILLAGER', amount: n }); else render(); });
  }

  // 買い忘れ防止: 財宝を出していない／2コイン以上残して購入権があるときは確認を挟む
  function endTurnTap(state, viewer) {
    const t = state.turn;
    // 支配中は操作対象（被支配者=t.active）の手札で判定する（財宝を出すのも engine では被支配者の手札）。
    const hp = (t.possessedBy != null && t.possessedBy === viewer) ? state.players[t.active] : state.players[viewer];
    // 夜想曲：夜フェイズの「ターンを終える」＝夜フェイズの終了。財宝/コインの案内は的外れなので、
    //   まだ使える夜行カードが残っているときだけ確認する。
    if (t.phase === 'night') {
      if (hp.hand.some((c) => DOM.isType(c, 'night'))) {
        UI.confirm = {
          message: 'まだ夜行カードが使えます。使わずにターンを終えますか？',
          yesLabel: 'ターンを終える',
          onYes: () => { UI.confirm = null; dispatch({ type: 'END_TURN' }); },
        };
        render();
      } else dispatch({ type: 'END_TURN' });
      return;
    }
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
      (id) => canUpTo(state, id, pd.maxCost, pd) && isTreasureNow(state, id),
      (id) => dispatch({ type: 'MINE_GAIN', card: id }), () => dispatch({ type: 'MINE_GAIN', card: null }));
    if (pd.type === 'remodel' && pd.stage === 'trash') return modalSingleHand(p, '改築 — 廃棄', '廃棄するカードを選びます。',
      () => true, (id) => dispatch({ type: 'REMODEL_TRASH', card: id }), null);
    if (pd.type === 'remodel' && pd.stage === 'gain') return modalGainSupply(state, '改築 — 獲得', 'コスト ' + pd.maxCost + ' 以下のカードを獲得します。',
      (id) => canUpTo(state, id, pd.maxCost, pd), (id) => dispatch({ type: 'REMODEL_GAIN', card: id }), () => dispatch({ type: 'REMODEL_GAIN', card: null }));
    if (pd.type === 'workshop') return modalGainSupply(state, '工房 — 獲得', 'コスト 4 以下のカードを獲得します。',
      (id) => canUpTo(state, id, 4), (id) => dispatch({ type: 'WORKSHOP_GAIN', card: id }), () => dispatch({ type: 'WORKSHOP_GAIN', card: null }));

    /* ===== 拡張: 略奪（Plunder）＝戦利品(Loot) ===== */
    // 賞品のヤギ＝手札1枚を廃棄してもよい（**任意**＝「廃棄しない」で必ず閉じられる）。
    if (pd.type === 'prize_goat') return modalSingleHand(p, '賞品のヤギ — 廃棄', '手札から1枚を廃棄できます（しなくてもよい）。',
      () => true, (id) => dispatch({ type: 'PRIZE_GOAT_TRASH', card: id }),
      { label: '廃棄しない', on: () => dispatch({ type: 'PRIZE_GOAT_TRASH', card: null }) });
    // ハンマー＝コスト4以下を**強制**獲得（engine は候補ゼロなら窓を開かない＝辞退ボタンは保険）。
    if (pd.type === 'hammer_gain') return modalGainSupply(state, 'ハンマー — 獲得', 'コスト 4 以下のカード1枚を獲得します（強制）。',
      (id) => canUpTo(state, id, 4), (id) => dispatch({ type: 'HAMMER_GAIN', card: id }), () => dispatch({ type: 'HAMMER_GAIN', card: null }));
    // 六分儀＝上5枚から捨てる札をタップで選ぶ（残りは公開順のまま山札の上へ）＝地図職人と同じ操作。
    if (pd.type === 'sextant') return modalSextant(pd);
    // パズルボックス＝手札1枚を裏向きに脇へ置いてよい（ターン終了時に手札へ戻る）。
    if (pd.type === 'puzzle_box') return modalSingleHand(p, 'パズルボックス — 脇に置く', '手札から1枚を裏向きに脇へ置けます（ターン終了時に手札に加わります）。',
      () => true, (id) => dispatch({ type: 'PUZZLE_BOX_SET', card: id }),
      { label: '置かない', on: () => dispatch({ type: 'PUZZLE_BOX_SET', card: null }) }, '脇に置く');
    // 杖＝手札のアクション1枚を（購入フェイズのまま）使用してよい。
    if (pd.type === 'staff_play') return modalSingleHand(p, '杖 — アクションを使う', '手札からアクションカード1枚を使用できます（アクション権は消費しません）。',
      (id) => DOM.CARDS[id] && DOM.CARDS[id].types.includes('action'),
      (id) => dispatch({ type: 'STAFF_PLAY', card: id }),
      { label: '使わない', on: () => dispatch({ type: 'STAFF_PLAY', card: null }) }, '使う', DOM.engine.handPlayable(state, pd.player));
    // アンフォラ＝「今」か「次のターンの開始時」を選ぶ（プレイのたびに独立に選べる）。
    if (pd.type === 'amphora') return modalOptions('アンフォラ', '+1 購入 と +3 コインを、今もらうか次のターンの開始時にもらうかを選びます。', [
      { label: '今もらう（+$3 +1購入）', cls: 'btn-primary', on: () => dispatch({ type: 'AMPHORA_CHOOSE', now: true }) },
      { label: '次のターンの開始時にもらう', on: () => dispatch({ type: 'AMPHORA_CHOOSE', now: false }) },
    ]);
    // 宝珠＝捨て札を全部見てから、「捨て札からアクション/財宝を1枚使う」か「+1購入 +$3」を選ぶ。
    if (pd.type === 'orb') return modalOrb(p);
    // 呪符の巻物＝これより安いカード1枚を獲得（強制）→ アクション/財宝なら使ってよい。
    if (pd.type === 'spell_scroll_gain') return modalGainSupply(state, '呪符の巻物 — 獲得',
      'これ（コスト ' + pd.limit + '）より安いカード1枚を獲得します（強制）。',
      (id) => canUnder(state, id, pd.limit), (id) => dispatch({ type: 'SPELL_SCROLL_GAIN', card: id }),
      () => dispatch({ type: 'SPELL_SCROLL_GAIN', card: null }));
    if (pd.type === 'spell_scroll_play') return modalOptions('呪符の巻物 — 使う？',
      '獲得した「' + (DOM.CARDS[pd.card] ? DOM.CARDS[pd.card].name : pd.card) + '」を使用できます（アクション権は消費しません）。', [
      { label: '使う', cls: 'btn-primary', on: () => dispatch({ type: 'SPELL_SCROLL_PLAY', play: true }) },
      { label: '使わない', cls: 'btn-ghost', on: () => dispatch({ type: 'SPELL_SCROLL_PLAY', play: false }) },
    ]);
    /* ===== 略奪P2："next time" 型持続 ===== */
    // 檻＝手札を最大4枚まで伏せて置いてよい（0枚でもOK＝檻は勝利点を獲得するまで場に残る）。
    if (pd.type === 'cage_set') return modalMultiHand(p, '檻 — 脇に伏せて置く',
      '手札から最大4枚を檻の上に伏せて置けます。次に勝利点カードを獲得したとき、檻を廃棄してそのターンの終了時に手札へ戻ります。0枚でもOK。',
      (n) => '確定（' + n + '枚 置く）', true, (cards) => dispatch({ type: 'CAGE_SET', cards }), 4);
    // 秘境の社＝手札を最大2枚廃棄してもよい（任意＝0枚で「廃棄しない」）。
    if (pd.type === 'shrine_trash') return modalMultiHand(p, '秘境の社 — 廃棄（任意）',
      '財宝カードを獲得したので、手札から最大2枚を廃棄できます（しなくてもよい）。',
      (n) => (n ? '廃棄する（' + n + '枚）' : '廃棄しない'), true, (cards) => dispatch({ type: 'SHRINE_TRASH', cards }), 2);
    /* ===== 略奪P3 ===== */
    if (pd.type === 'grotto_set') return modalMultiHand(p, '岩屋 — 伏せて置く',
      '手札から最大4枚を岩屋の上に伏せて置けます。次のあなたのターンの開始時、それらを捨て札にして同じ枚数を引きます。0枚でもOK。',
      (n) => '確定（' + n + '枚 置く）', true, (cards) => dispatch({ type: 'GROTTO_SET', cards }), 4);
    if (pd.type === 'shaman_trash') return modalSingleHand(p, 'シャーマン — 廃棄（任意）',
      '手札1枚を廃棄できます（しなくてもよい）。', () => true,
      (id) => dispatch({ type: 'SHAMAN_TRASH', card: id }),
      { label: '廃棄しない', on: () => dispatch({ type: 'SHAMAN_TRASH', card: null }) });
    if (pd.type === 'shaman_gain') {
      const targets = DOM.engine.shamanTargets ? DOM.engine.shamanTargets(state) : [];
      return modalPickList(state, 'シャーマン — 廃棄置き場から獲得', 'ターンの開始時：廃棄置き場からコスト6以下のカード1枚を獲得します（強制）。',
        targets, '獲得する', (id) => dispatch({ type: 'SHAMAN_GAIN', card: id }),
        targets.length ? null : { label: '獲得できるカードがない（閉じる）', on: () => dispatch({ type: 'SHAMAN_GAIN', card: null }) });
    }
    if (pd.type === 'siren' && pd.stage === 'react') return modalOptions('セイレーンを受ける', '呪い1枚を獲得します。', reactOptions(p, pd, { type: 'SIREN_REACT' }));
    if (pd.type === 'siren_gain') return modalSingleHand(p, 'セイレーン — 獲得時',
      '手札からアクションカード1枚を廃棄すればセイレーンは残ります。廃棄しない場合、セイレーンを廃棄します。',
      (id) => DOM.CARDS[id] && DOM.CARDS[id].types.includes('action'),
      (id) => dispatch({ type: 'SIREN_GAIN', card: id }),
      { label: '廃棄しない（セイレーンを廃棄する）', on: () => dispatch({ type: 'SIREN_GAIN', card: null }) }, '廃棄してセイレーンを守る');
    if (pd.type === 'stowaway_react') return modalOptions('密航者 — リアクション',
      '持続カードが獲得されました。手札の密航者を使用できます（次のあなたのターンの開始時 +2カード）。', [
      { label: '使う', cls: 'btn-primary', on: () => dispatch({ type: 'STOWAWAY_REACT', play: true }) },
      { label: '使わない', on: () => dispatch({ type: 'STOWAWAY_REACT', play: false }) },
    ]);
    if (pd.type === 'maroon_trash') return modalSingleHand(p, '置き去り — 廃棄',
      '手札1枚を廃棄します（強制）。そのカードが持つ種別1つにつき +2カード引きます。',
      () => true, (id) => dispatch({ type: 'MAROON_TRASH', card: id }), null, '廃棄する');
    if (pd.type === 'crucible_trash') return modalSingleHand(p, '坩堝 — 廃棄',
      '手札1枚を廃棄します（強制）。そのコスト$1につき +$1。',
      () => true, (id) => dispatch({ type: 'CRUCIBLE_TRASH', card: id }), null, '廃棄する');
    if (pd.type === 'pilgrim_put') return modalSingleHand(p, '巡礼者 — 山札の上に置く',
      '手札1枚を山札の上に置きます（強制・引いたカードでなくてもよい）。',
      () => true, (id) => dispatch({ type: 'PILGRIM_PUT', card: id }), null, '山札の上に置く');
    if (pd.type === 'figurine_discard') return modalSingleHand(p, '小像 — 捨て札（任意）',
      '手札のアクションカード1枚を捨てると +1購入 +$1。',
      (id) => DOM.CARDS[id] && DOM.CARDS[id].types.includes('action'),
      (id) => dispatch({ type: 'FIGURINE_DISCARD', card: id }),
      { label: '捨てない', on: () => dispatch({ type: 'FIGURINE_DISCARD', card: null }) }, '捨てて +1購入 +$1');
    if (pd.type === 'gondola_choose') return modalOptions('ゴンドラ', '+2 コインを、今もらうか次のあなたのターンの開始時にもらうかを選びます。', [
      { label: '今もらう（+$2）', cls: 'btn-primary', on: () => dispatch({ type: 'GONDOLA_CHOOSE', now: true }) },
      { label: '次のターンの開始時にもらう', on: () => dispatch({ type: 'GONDOLA_CHOOSE', now: false }) },
    ]);
    if (pd.type === 'gondola_play') return modalSingleHand(p, 'ゴンドラ — 獲得時（任意）',
      'ゴンドラを獲得したので、手札のアクションカード1枚を使用できます（アクション権は消費しません）。',
      (id) => DOM.CARDS[id] && DOM.CARDS[id].types.includes('action'),
      (id) => dispatch({ type: 'GONDOLA_PLAY', card: id }),
      { label: '使わない', on: () => dispatch({ type: 'GONDOLA_PLAY', card: null }) }, '使う', DOM.engine.handPlayable(state, pd.player));
    if (pd.type === 'tools_gain') {
      const targets = DOM.engine.toolsTargets ? DOM.engine.toolsTargets(state) : [];
      return modalPickList(state, '工具 — 同じカードを獲得', '（自分を含む）誰かが場に出しているのと同じカード1枚を獲得します（強制）。サプライに山が無いカードは選んでも獲得できません。',
        targets, '獲得する', (id) => dispatch({ type: 'TOOLS_GAIN', card: id }),
        targets.length ? null : { label: '対象がない（閉じる）', on: () => dispatch({ type: 'TOOLS_GAIN', card: null }) });
    }
    if (pd.type === 'pickaxe_trash') return modalSingleHand(p, 'つるはし — 廃棄',
      '手札1枚を廃棄します（強制）。廃棄後のコストが3以上なら、戦利品1枚を手札に獲得します。',
      () => true, (id) => dispatch({ type: 'PICKAXE_TRASH', card: id }), null, '廃棄する');
    if (pd.type === 'silver_mine_gain') return modalGainSupply(state, '銀山 — 手札に獲得',
      '銀山（コスト ' + DOM.engine.cardCost(state, 'silver_mine') + '）より安い財宝カード1枚を手札に獲得します（強制）。',
      (id) => canUnder(state, id, DOM.engine.cardCost(state, 'silver_mine')) && DOM.engine.isTypeSupply(state, id, 'treasure'),
      (id) => dispatch({ type: 'SILVER_MINE_GAIN', card: id }), () => dispatch({ type: 'SILVER_MINE_GAIN', card: null }));
    if (pd.type === 'cabin_boy') return modalOptions('キャビンボーイ', 'ターンの開始時：次のうち1つを選びます。', [
      { label: '+$2', cls: 'btn-primary', on: () => dispatch({ type: 'CABIN_BOY_RESOLVE', choice: 'coin' }) },
      { label: 'これを廃棄して持続カード1枚を獲得', on: () => dispatch({ type: 'CABIN_BOY_RESOLVE', choice: 'gain' }) },
    ]);
    if (pd.type === 'cabin_boy_gain') return modalGainSupply(state, 'キャビンボーイ — 持続カードを獲得',
      '持続カード1枚を獲得します（コストの上限はありません）。',
      (id) => DOM.engine.gainableBase(state, id) && DOM.engine.isTypeSupply(state, id, 'duration'),
      (id) => dispatch({ type: 'CABIN_BOY_GAIN', card: id }), () => dispatch({ type: 'CABIN_BOY_GAIN', card: null }));
    if (pd.type === 'rope_trash') return modalSingleHand(p, '縄 — 廃棄（任意）',
      '手札1枚を廃棄できます（しなくてもよい）。', () => true,
      (id) => dispatch({ type: 'ROPE_TRASH', card: id }),
      { label: '廃棄しない', on: () => dispatch({ type: 'ROPE_TRASH', card: null }) });
    /* ===== 略奪P4：特性(Trait) ===== */
    if (pd.type === 'pious_trash') return modalSingleHand(p, '敬虔な — 廃棄（任意）',
      '敬虔なカードを獲得したので、手札1枚を廃棄できます（しなくてもよい）。', () => true,
      (id) => dispatch({ type: 'PIOUS_TRASH', card: id }),
      { label: '廃棄しない', on: () => dispatch({ type: 'PIOUS_TRASH', card: null }) });
    if (pd.type === 'friendly_discard') return modalSingleHand(p, '友好的な — 捨てて獲得（任意）',
      'クリンナップの開始時：手札の友好的なカード1枚を捨てると、友好的なカード1枚を獲得します。',
      (id) => DOM.engine.hasTrait(state, id, 'friendly'),
      (id) => dispatch({ type: 'FRIENDLY_DISCARD', card: id }),
      { label: '捨てない', on: () => dispatch({ type: 'FRIENDLY_DISCARD', card: null }) }, '捨てて1枚獲得');
    if (pd.type === 'patient_set') return modalMultiHand(p, '忍耐強い — 脇に置く（任意）',
      'クリンナップの開始時：手札の忍耐強いカードを何枚でも脇に置けます。次のあなたのターンの開始時にそれらを使用します（強制）。',
      (n) => '確定（' + n + '枚 置く）', true, (cards) => dispatch({ type: 'PATIENT_SET', cards }), null,
      (id) => DOM.engine.hasTrait(state, id, 'patient'));
    if (pd.type === 'shy_discard') return modalSingleHand(p, '内気な — 捨てて +2カード（任意）',
      'ターンの開始時：手札の内気なカード1枚を捨てると +2カード引きます。',
      (id) => DOM.engine.hasTrait(state, id, 'shy'),
      (id) => dispatch({ type: 'SHY_DISCARD', card: id }),
      { label: '捨てない', on: () => dispatch({ type: 'SHY_DISCARD', card: null }) }, '捨てて +2カード');
    if (pd.type === 'inspiring_play') return modalSingleHand(p, '鼓舞する — アクションを使う（任意）',
      '鼓舞するカードを使用したので、場に出していないアクションカード1枚を手札から使用できます（アクション権は消費しません）。',
      (id) => (DOM.engine.inspiringTargets ? DOM.engine.inspiringTargets(state, pd.player) : []).indexOf(id) >= 0,
      (id) => dispatch({ type: 'INSPIRING_PLAY', card: id }),
      { label: '使わない', on: () => dispatch({ type: 'INSPIRING_PLAY', card: null }) }, '使う', DOM.engine.handPlayable(state, pd.player));
    /* ===== 略奪P5：イベント ===== */
    if (pd.type === 'bury_put') return modalPickList(state, '埋葬 — 山札の一番下へ',
      '捨て札のカード1枚を山札の一番下に置きます（強制）。',
      [...new Set(p.discard)], '一番下に置く', (id) => dispatch({ type: 'BURY_PUT', card: id }));
    if (pd.type === 'peril_trash') return modalSingleHand(p, '危難 — 廃棄（任意）',
      '手札のアクションカード1枚を廃棄すると、戦利品1枚を獲得します。',
      (id) => DOM.CARDS[id] && DOM.CARDS[id].types.includes('action'),
      (id) => dispatch({ type: 'PERIL_TRASH', card: id }),
      { label: '廃棄しない', on: () => dispatch({ type: 'PERIL_TRASH', card: null }) }, '廃棄して戦利品');
    if (pd.type === 'foray_discard') return modalTrashHand(p, '襲撃 — ' + pd.need + '枚 捨てる',
      '手札' + pd.need + '枚を公開して捨てます。3枚が互いに異なる名前なら戦利品1枚を獲得します。',
      pd.need, (cards) => dispatch({ type: 'FORAY_DISCARD', cards }));
    if (pd.type === 'scrounge' && pd.stage === 'choose') return modalOptions('物色', '次のうち1つを選びます。', [
      { label: '手札1枚を廃棄する', on: () => dispatch({ type: 'SCROUNGE_CHOOSE', choice: 'trash' }) },
      { label: '廃棄置き場から屋敷1枚を獲得（獲得したら $5以下を1枚獲得）' + (state.trash.indexOf('estate') < 0 ? '（屋敷が無いので何も起きません）' : ''),
        on: () => dispatch({ type: 'SCROUNGE_CHOOSE', choice: 'estate' }) },
    ]);
    if (pd.type === 'scrounge' && pd.stage === 'trash') return modalSingleHand(p, '物色 — 廃棄',
      '手札1枚を廃棄します。', () => true, (id) => dispatch({ type: 'SCROUNGE_TRASH', card: id }), null, '廃棄する');
    if (pd.type === 'scrounge' && pd.stage === 'gain') return modalGainSupply(state, '物色 — 獲得',
      'コスト5以下のカード1枚を獲得します（強制）。',
      (id) => canUpTo(state, id, 5), (id) => dispatch({ type: 'SCROUNGE_GAIN', card: id }), () => dispatch({ type: 'SCROUNGE_GAIN', card: null }));
    if (pd.type === 'maelstrom' && pd.stage === 'trash') return modalTrashHand(p, '大渦巻 — ' + pd.need + '枚 廃棄',
      '手札' + pd.need + '枚を廃棄します（強制）。', pd.need, (cards) => dispatch({ type: 'MAELSTROM_TRASH', cards }));
    if (pd.type === 'maelstrom' && pd.stage === 'victim') return modalSingleHand(p, '大渦巻 — 廃棄',
      '手札が5枚以上あるので、手札1枚を廃棄します（強制・堀では防げません）。',
      () => true, (id) => dispatch({ type: 'MAELSTROM_VICTIM', card: id }), null, '廃棄する');
    if (pd.type === 'invasion' && pd.stage === 'attack') return modalSingleHand(p, '侵略 — アタックを使う（任意）',
      '手札のアタックカード1枚を使用できます（アクション権は消費しません）。',
      (id) => DOM.CARDS[id] && DOM.CARDS[id].types.includes('attack'),
      (id) => dispatch({ type: 'INVASION_ATTACK', card: id }),
      { label: '使わない', on: () => dispatch({ type: 'INVASION_ATTACK', card: null }) }, '使う',
      DOM.engine.handPlayable(state, pd.player)); // 旭日：山札の影札（忍者）も選べる
    if (pd.type === 'invasion' && pd.stage === 'action') return modalGainSupply(state, '侵略 — アクションを山札の上に獲得',
      'アクションカード1枚を山札の上に獲得します（強制・コストの上限はありません）。',
      (id) => DOM.engine.gainableBase(state, id) && DOM.engine.isTypeSupply(state, id, 'action'),
      (id) => dispatch({ type: 'INVASION_ACTION', card: id }), () => dispatch({ type: 'INVASION_ACTION', card: null }));
    /* 繁栄＝**任意・何枚でも**（公式＝`You don't have to gain any Treasures you don't want`）。
       ⚠ 第7引数 `alwaysSkip=true` が必須。無いと `modalGainSupply` は「候補が尽きたときだけ」辞退ボタンを出す＝
          サプライの財宝を全部押し付けられて人間だけが止められない（CPU は card:null でやめられる）。 */
    if (pd.type === 'prosper_gain') return modalGainSupply(state, '繁栄 — 財宝を獲得（任意・何枚でも）',
      '互いに名前の異なる財宝カードを1枚ずつ獲得できます（もうやめてもかまいません）。',
      (id) => DOM.engine.gainableBase(state, id) && DOM.engine.isTreasureFor(state, id) && (pd.gained || []).indexOf(id) < 0,
      (id) => dispatch({ type: 'PROSPER_GAIN', card: id }), () => dispatch({ type: 'PROSPER_GAIN', card: null }), true);
    if (pd.type === 'prepare_play') {
      const aside = p.prepareAside || [];
      const playable = [...new Set(aside.filter((id) => (DOM.CARDS[id] && DOM.CARDS[id].types.includes('action')) || DOM.engine.isTreasureFor(state, id)))];
      return modalPickList(state, '準備 — 使用する', '脇に置いたアクションと財宝を好きな順で全部使用します（強制）。',
        playable, '使う', (id) => dispatch({ type: 'PREPARE_PLAY', card: id }),
        playable.length ? null : { label: '残りを捨てる', on: () => dispatch({ type: 'PREPARE_PLAY', card: null }) });
    }
    /* ===== 略奪P6 ===== */
    if (pd.type === 'kings_cache_play') return modalSingleHand(p, '王の隠し財産 — 財宝を3回使う（任意）',
      '手札の財宝カード1枚を3回使用できます。',
      (id) => DOM.engine.isTreasureFor(state, id) && id !== 'kings_cache',
      (id) => dispatch({ type: 'KINGS_CACHE_PLAY', card: id }),
      { label: '使わない', on: () => dispatch({ type: 'KINGS_CACHE_PLAY', card: null }) }, '3回使う');
    if (pd.type === 'fortune_hunter' && pd.stage === 'play') {
      const tre = [...new Set((pd.cards || []).filter((id) => DOM.engine.isTreasureFor(state, id)))];
      return modalPickList(state, '財産目当て — 財宝を使う（任意）',
        '山札の上から見た3枚：' + (pd.cards || []).map((c) => (DOM.CARDS[c] || {}).name || c).join('・') + '。この中の財宝1枚を使用できます。',
        tre, '使う', (id) => dispatch({ type: 'FORTUNE_HUNTER_PLAY', card: id }),
        { label: '使わない（残りを山札に戻す）', on: () => dispatch({ type: 'FORTUNE_HUNTER_PLAY', card: null }) });
    }
    if (pd.type === 'fortune_hunter' && pd.stage === 'arrange') return modalMultiCards(pd.cards, '財産目当て — 山札の上に戻す',
      '残りを好きな順番で山札の上に戻します（**先に選んだ札が一番上**になります）。全部選んで確定してください。',
      (n) => '確定（' + n + '/' + pd.cards.length + '枚）', pd.cards.length,
      (top) => dispatch({ type: 'FORTUNE_HUNTER_ARRANGE', top }), pd.cards.length);
    if (pd.type === 'mapmaker') return modalMultiCards(pd.cards, '地図作り — 2枚を手札へ',
      '山札の上から見た' + pd.cards.length + '枚のうち ' + pd.take + '枚 を手札に加え、残りを捨てます。',
      (n) => '手札に加える（' + n + '枚）', pd.take, (cards) => dispatch({ type: 'MAPMAKER_PICK', cards }), pd.take);
    if (pd.type === 'mapmaker_react') return modalOptions('地図作り — リアクション',
      '勝利点カードが獲得されました。手札の地図作りを使用できます。', [
      { label: '使う', cls: 'btn-primary', on: () => dispatch({ type: 'MAPMAKER_REACT', play: true }) },
      { label: '使わない', on: () => dispatch({ type: 'MAPMAKER_REACT', play: false }) },
    ]);
    // 拡大＝廃棄は強制だが、**手札が空**なら閉じられないと人間が詰む（engine 側にも終端保証あり）。
    if (pd.type === 'enlarge_trash') return modalSingleHand(p, '拡大 — 廃棄',
      '手札1枚を廃棄します（強制）。それよりコストが最大2高いカード1枚を獲得します。',
      () => true, (id) => dispatch({ type: 'ENLARGE_TRASH', card: id }),
      p.hand.length ? null : { label: '手札が無い（閉じる）', on: () => dispatch({ type: 'ENLARGE_TRASH', card: null }) },
      '廃棄する');
    if (pd.type === 'enlarge_gain') return modalGainSupply(state, '拡大 — 獲得',
      'コスト ' + pd.maxCost + ' 以下のカード1枚を獲得します（強制）。',
      (id) => canUpTo(state, id, pd.maxCost, pd), (id) => dispatch({ type: 'ENLARGE_GAIN', card: id }),
      () => dispatch({ type: 'ENLARGE_GAIN', card: null }));
    if (pd.type === 'first_mate') return modalSingleHand(p, '一等航海士 — 同名のアクションを使う',
      pd.name ? ('「' + ((DOM.CARDS[pd.name] || {}).name || pd.name) + '」をもう1枚使えます（やめてもよい＝手札が6枚になるように引きます）。')
        : '手札のアクションカード1枚を使用できます（以後は同じ名前だけ続けて使えます。使わずに引いてもOK）。',
      (id) => DOM.CARDS[id] && DOM.CARDS[id].types.includes('action') && (!pd.name || id === pd.name),
      (id) => dispatch({ type: 'FIRST_MATE_PLAY', card: id }),
      { label: '使わない（手札が6枚になるように引く）', on: () => dispatch({ type: 'FIRST_MATE_PLAY', card: null }) }, '使う', DOM.engine.handPlayable(state, pd.player));
    if (pd.type === 'frigate' && pd.stage === 'react') return modalOptions('フリゲート船を受ける',
      '次の相手のターンの開始時まで、あなたがアクションカードを使用するたび、その後に手札が4枚になるように捨てます。',
      reactOptions(p, pd, { type: 'LINGER_REACT' }));
    if (pd.type === 'trickster' && pd.stage === 'react') return modalOptions('トリックスターを受ける', '呪い1枚を獲得します。',
      reactOptions(p, pd, { type: 'TRICKSTER_REACT' }));
    if (pd.type === 'quartermaster') {
      const inst = (p.quartermasters || []).find((q) => q.id === pd.qmId) || { cards: [] };
      const gains = Object.keys(state.supply).filter((id) => DOM.CARDS[id] && canUpTo(state, id, 4) && DOM.engine.gainableBase(state, id));
      const chips = gains.map((id) => cardEl(id, { size: 'sm', extra: 'selectable',
        onClick: () => openPickZoom(id, '脇に獲得', () => dispatch({ type: 'QUARTERMASTER_RESOLVE', mode: 'gain', card: id })) }));
      const buttons = [];
      [...new Set(inst.cards || [])].forEach((id) => buttons.push(h('button', { class: 'btn btn-block', style: 'margin-bottom:8px',
        onclick: () => dispatch({ type: 'QUARTERMASTER_RESOLVE', mode: 'take', card: id }) },
        '脇の「' + ((DOM.CARDS[id] || {}).name || id) + '」を手札に加える')));
      if (!chips.length && !buttons.length) buttons.push(h('button', { class: 'btn btn-block',
        onclick: () => dispatch({ type: 'QUARTERMASTER_RESOLVE', mode: 'skip' }) }, '何もできない（閉じる）'));
      return modalShell('操舵手 — ターンの開始時',
        '下のサプライから「コスト4以下を1枚 脇に獲得」するか、脇のカードを手札に加えます。' +
        ((inst.cards || []).length ? '（脇：' + inst.cards.map((c) => (DOM.CARDS[c] || {}).name || c).join('・') + '）' : ''),
        chips, h('div', null, buttons));
    }
    if (pd.type === 'trickster_aside') {
      const tre = p.inPlay.filter((id) => DOM.engine.isTreasureFor(state, id));
      return modalMultiCards(tre, 'トリックスター — 財宝を脇に置く（任意）',
        '場から捨てる財宝を最大' + pd.max + '枚 脇に置き、ターン終了時に手札へ加えます（0枚でもOK）。',
        (n) => '確定（' + n + '枚）', pd.max, (cards) => dispatch({ type: 'TRICKSTER_ASIDE', cards }));
    }
    if (pd.type === 'mining_road_play') return modalOptions('鉱山道路 — 使う？',
      '獲得した「' + ((DOM.CARDS[pd.card] || {}).name || pd.card) + '」を使用できます（このターンの残り回数：' + (state.turn.miningRoad || 0) + '）。', [
      { label: '使う', cls: 'btn-primary', on: () => dispatch({ type: 'MINING_ROAD_PLAY', play: true }) },
      { label: '使わない（権利は残る）', on: () => dispatch({ type: 'MINING_ROAD_PLAY', play: false }) },
    ]);

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
      (id) => canUpTo(state, id, 4), (id) => dispatch({ type: 'IRONWORKS_GAIN', card: id }), () => dispatch({ type: 'IRONWORKS_GAIN', card: null }));
    if (pd.type === 'mining_village') return modalOptions('鉱山の村', '場のこのカードを廃棄すると +2 コインになります。', [
      { label: '廃棄して +2 コイン', cls: 'btn-primary', on: () => dispatch({ type: 'MINING_VILLAGE_RESOLVE', trash: true }) },
      { label: '廃棄しない', on: () => dispatch({ type: 'MINING_VILLAGE_RESOLVE', trash: false }) },
    ]);
    // 帝国：技術者＝コスト4以下を獲得（1枚目=強制／自己廃棄後の2枚目=強制）。
    if (pd.type === 'engineer' && (pd.stage === 'gain1' || pd.stage === 'gain2'))
      return modalGainSupply(state, '技術者 — 獲得', 'コスト4以下のカードを1枚獲得します。',
        (id) => canUpTo(state, id, 4), (id) => dispatch({ type: 'ENGINEER_GAIN', card: id }));
    if (pd.type === 'engineer' && pd.stage === 'maytrash') return modalOptions('技術者', 'この技術者を廃棄すると、もう1枚コスト4以下のカードを獲得できます。', [
      { label: '廃棄してもう1枚獲得', cls: 'btn-primary', on: () => dispatch({ type: 'ENGINEER_TRASH', trash: true }) },
      { label: '廃棄しない', on: () => dispatch({ type: 'ENGINEER_TRASH', trash: false }) },
    ]);
    // 帝国：生贄＝手札1枚を廃棄（種別ごとにボーナス）。
    if (pd.type === 'sacrifice' && pd.stage === 'trash') return modalSingleHand(p, '生贄 — 廃棄',
      '手札から1枚を廃棄します。アクション=+2カード+2アクション／財宝=+$2／勝利点=+2勝利点（複数種別は全適用）。',
      () => true, (id) => dispatch({ type: 'SACRIFICE_TRASH', card: id }), null, '廃棄');
    // 帝国：公共広場＝手札をちょうど2枚（2枚未満なら全て）捨てる。
    if (pd.type === 'forum') { const need = Math.min(2, p.hand.length); return modalSelectN(p, '公共広場 — 手札2枚を捨てる',
      '手札から' + need + '枚を選んで捨てます。', need, '確定（捨てる）', (cards) => dispatch({ type: 'FORUM_DISCARD', cards })); }
    // 帝国：御守り＝二択。
    if (pd.type === 'charm_mode') return modalOptions('御守り', '次から1つを選びます。', [
      { label: '+1 購入 と +$2', cls: 'btn-primary', on: () => dispatch({ type: 'CHARM_MODE', mode: 'coins' }) },
      { label: '次にカードを獲得したとき、同コストで名前の異なるカードを1枚獲得してよい', on: () => dispatch({ type: 'CHARM_MODE', mode: 'gain' }) },
    ]);
    // 帝国：御守り（モードB）＝獲得したカードと同コストで名前の異なるカードを1枚獲得（任意）。
    if (pd.type === 'charm_gain') return modalGainSupply(state, '御守り — 同コストで別名を獲得',
      'コストが同じ（$・負債・ポーション一致）で名前の異なるカードを1枚獲得できます（しなくてもよい）。',
      (id) => id !== pd.trig && canExact(state, id, pd.coin, pd.pot, pd.debt),
      (id) => dispatch({ type: 'CHARM_GAIN', card: id }), () => dispatch({ type: 'CHARM_GAIN', card: null }), true);
    // 帝国：軍団兵＝手札の金貨を公開してアタックするか選ぶ（金貨は手札に残る）。
    if (pd.type === 'legionary_reveal') return modalOptions('軍団兵 — 金貨を公開', '手札の金貨を公開すると、各相手は手札が2枚になるまで捨て、その後1枚引きます（金貨は手札に残ります）。', [
      { label: '金貨を公開する（アタック）', cls: 'btn-primary', on: () => dispatch({ type: 'LEGIONARY_REVEAL', reveal: true }) },
      { label: '公開しない', on: () => dispatch({ type: 'LEGIONARY_REVEAL', reveal: false }) },
    ]);
    // 帝国：資料庫＝脇に置いた3枚から1枚を選んで手札に加える（タップで選択）。
    if (pd.type === 'archive_pick') {
      const st = (p.archives || []).find((a) => a.id === pd.archiveId);
      const cards = (st && st.cards) || [];
      const chips = cards.map((id) => cardEl(id, { size: 'sm', extra: 'selectable', onClick: () => dispatch({ type: 'ARCHIVE_PICK', card: id }) }));
      return modalShell('資料庫 — 手札に加える', '脇に置いた ' + cards.length + ' 枚から1枚を選んで手札に加えます。', chips, null);
    }
    // 帝国：神殿＝手札から名前の異なる1〜3枚を廃棄（強制）。名前ごとに1チップ表示。
    if (pd.type === 'temple_trash') {
      // 玉座/王の宮廷/行進や神殿2枚で temple_trash が同一ターンに連続すると _selKey が不変で選択が持ち越される。
      // 前回廃棄して手札に無くなった名前（幽霊選択）は外す導線が無くソフトロックするため、手札に在る名前だけに間引く。
      UI.selection = (UI.selection || []).filter((id) => p.hand.includes(id));
      const names = [...new Set(p.hand)];
      const chips = names.map((id) => cardEl(id, { size: 'sm', extra: UI.selection.includes(id) ? 'selected' : 'selectable', badge: UI.selection.includes(id) ? '廃' : null,
        onClick: () => { const i = UI.selection.indexOf(id); if (i >= 0) UI.selection.splice(i, 1); else if (UI.selection.length < 3) UI.selection.push(id); render(); } }));
      const k = UI.selection.length;
      const footer = h('button', { class: 'btn btn-primary btn-block', disabled: (k >= 1 && k <= 3) ? null : 'disabled',
        onclick: () => dispatch({ type: 'TEMPLE_TRASH', cards: UI.selection.slice() }) },
        k === 0 ? '廃棄するカードを選ぶ（1〜3枚・名前は異なること）' : '確定（' + k + '枚 廃棄）');
      return modalShell('神殿 — 廃棄', '手札から名前の異なるカードを1〜3枚 廃棄します（強制・その後 神殿の山に勝利点1個）。', chips, footer);
    }
    // 帝国：ワイルドハント＝二択。
    if (pd.type === 'wild_hunt') return modalOptions('ワイルドハント', '次から1つを選びます。', [
      { label: '+3 カード（この山に勝利点1個を置く）', cls: 'btn-primary', on: () => dispatch({ type: 'WILD_HUNT_RESOLVE', choice: 'cards' }) },
      { label: '屋敷を1枚獲得（獲得したら この山上の勝利点をすべて得る）', on: () => dispatch({ type: 'WILD_HUNT_RESOLVE', choice: 'estate' }) },
    ]);
    // 帝国：陣地＝金貨か鹵獲品を公開して場に残す／公開しない（片付けで分割山に戻る）。
    if (pd.type === 'encampment_reveal') {
      const opts = [];
      if (p.hand.includes('gold')) opts.push({ label: '金貨を公開（陣地を場に残す）', cls: 'btn-primary', on: () => dispatch({ type: 'ENCAMPMENT_REVEAL', card: 'gold' }) });
      if (p.hand.includes('plunder')) opts.push({ label: '鹵獲品を公開（陣地を場に残す）', cls: 'btn-primary', on: () => dispatch({ type: 'ENCAMPMENT_REVEAL', card: 'plunder' }) });
      opts.push({ label: '公開しない（陣地は片付けで分割山に戻る）', on: () => dispatch({ type: 'ENCAMPMENT_REVEAL', card: null }) });
      return modalOptions('陣地 — 公開', '手札から金貨か鹵獲品を公開すると陣地は場に残ります。公開しないと片付けで分割山に戻ります。', opts);
    }
    // 帝国：開拓者/騒がしい村＝捨て札から 銅貨/開拓者 を手札に加えるか。
    if (pd.type === 'settlers' || pd.type === 'bustling_village') {
      const want = pd.type === 'settlers' ? 'copper' : 'settlers';
      return modalOptions(pd.type === 'settlers' ? '開拓者' : '騒がしい村', '捨て札から「' + DOM.CARDS[want].name + '」1枚を手札に加えますか？', [
        { label: '「' + DOM.CARDS[want].name + '」を手札に加える', cls: 'btn-primary', on: () => dispatch({ type: 'SETTLERS_RESOLVE', take: true }) },
        { label: '加えない', on: () => dispatch({ type: 'SETTLERS_RESOLVE', take: false }) },
      ]);
    }
    // 帝国：投石機＝手札1枚を廃棄（強制・アタック）。
    if (pd.type === 'catapult' && pd.stage === 'trash') return modalSingleHand(p, '投石機 — 廃棄',
      '手札から1枚を廃棄します。コスト3以上なら他の各プレイヤーは呪いを獲得、財宝なら手札3枚まで捨てます。',
      () => true, (id) => dispatch({ type: 'CATAPULT_TRASH', card: id }), null, '廃棄');
    if (pd.type === 'catapult' && pd.stage === 'react') return modalOptions('投石機を受ける', 'コスト3以上の廃棄なら呪い、財宝の廃棄なら手札3枚まで捨てます。', reactOptions(p, pd, { type: 'CATAPULT_REACT' }));
    // 帝国：剣闘士＝手札1枚を公開（左隣が同名を公開しなければ +$1＋剣闘士廃棄）。
    if (pd.type === 'gladiator' && pd.stage === 'reveal') return modalSingleHand(p, '剣闘士 — 公開',
      '手札から1枚を公開します（左隣が同じカードを公開しなければ +$1、サプライから剣闘士1枚を廃棄）。',
      () => true, (id) => dispatch({ type: 'GLADIATOR_REVEAL', card: id }), null, '公開');
    if (pd.type === 'gladiator' && pd.stage === 'match') return modalOptions('剣闘士 — 左隣の対応',
      '相手が公開した「' + DOM.CARDS[pd.card].name + '」と同じカードを手札から公開しますか？（公開すると相手はボーナスを得ません）', [
        { label: '同じカードを公開する', cls: 'btn-primary', on: () => dispatch({ type: 'GLADIATOR_MATCH', reveal: true }) },
        { label: '公開しない（相手が +$1＋剣闘士1枚廃棄）', on: () => dispatch({ type: 'GLADIATOR_MATCH', reveal: false }) },
      ]);
    // 帝国E5：小さい城＝これ（場）か手札の城1枚を廃棄→城1枚を獲得。
    if (pd.type === 'small_castle') {
      const handCastles = [...new Set(p.hand.filter((c) => DOM.isType(c, 'castle')))];
      const buttons = [h('button', { class: 'btn btn-primary btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'SMALL_CASTLE_RESOLVE', card: 'small_castle' }) }, '小さい城（これ）を廃棄 → 城1枚を獲得')];
      handCastles.forEach((id) => buttons.push(h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'SMALL_CASTLE_RESOLVE', card: id }) }, '手札の「' + DOM.CARDS[id].name + '」を廃棄 → 城1枚を獲得')));
      buttons.push(h('button', { class: 'btn btn-block', onclick: () => dispatch({ type: 'SMALL_CASTLE_RESOLVE', card: null }) }, '廃棄しない（城を獲得しない）'));
      return modalShell('小さい城 — 廃棄', 'これ（場の小さい城）か手札の城1枚を廃棄すると、城1枚（山の一番上）を獲得します。', [], h('div', null, buttons));
    }
    // 帝国E5：華やかな城＝手札の勝利点カードを好きな枚数捨てて +$2/枚。
    if (pd.type === 'opulent_castle') return modalMultiHand(p, '華やかな城 — 勝利点を捨てる',
      '手札の勝利点カードを好きな枚数 公開して捨てます（1枚につき +$2・0枚でもよい）。',
      (n) => '確定（' + n + '枚 捨てて +$' + (2 * n) + '）', true, (cards) => dispatch({ type: 'OPULENT_CASTLE_DISCARD', cards }), null, (id) => DOM.isType(id, 'victory'));
    // 帝国E5：幽霊城＝手札2枚を山札の上へ（被害者）。
    if (pd.type === 'haunted_topdeck') { const need = Math.min(2, p.hand.length); return modalSelectN(p, '幽霊城 — 手札2枚を山札の上へ',
      '手札から' + need + '枚を選び、山札の上に置きます（最初にタップ＝一番上）。', need, '確定（山札の上へ）', (cards) => dispatch({ type: 'HAUNTED_TOPDECK', cards })); }
    // 帝国E5：広大な城＝公領1枚か屋敷3枚を獲得。
    if (pd.type === 'sprawling_castle') return modalOptions('広大な城 — 獲得', '公領1枚か屋敷3枚を獲得します。', [
      { label: '公領1枚を獲得（3点・1枚）', cls: 'btn-primary', on: () => dispatch({ type: 'SPRAWLING_CASTLE_CHOOSE', choice: 'duchy' }) },
      { label: '屋敷3枚を獲得（3点・3枚）', on: () => dispatch({ type: 'SPRAWLING_CASTLE_CHOOSE', choice: 'estates' }) },
    ]);
    /* ===== 移動動物園（Menagerie）===== */
    // 追放マットの払い戻し＝同名のカードを獲得したので、追放してあるぶんを好きな枚数 捨て札に戻せる（任意）。
    if (pd.type === 'exile_discard') {
      const have = DOM.engine.exileCount(state.players[pd.player], pd.card);
      const nm = (DOM.CARDS[pd.card] || {}).name || pd.card;
      // 公式：「全部捨てる」か「1枚も捨てない」の二択（一部だけは捨てられない）。
      return modalOptions('追放マット — 捨て札に戻す',
        '「' + nm + '」を獲得しました。追放マットにある「' + nm + '」' + have + '枚を、すべて捨て札に戻せます（一部だけは戻せません）。', [
        { label: have + '枚すべてを捨て札に戻す', cls: 'btn-primary', on: () => dispatch({ type: 'EXILE_DISCARD', n: have }) },
        { label: '戻さない（追放したままにする）', on: () => dispatch({ type: 'EXILE_DISCARD', n: 0 }) },
      ]);
    }
    // 艀＝「今」か「次の自分のターンの開始時」に +3カード +1購入。
    if (pd.type === 'barge_choose') return modalOptions('艀 — いつ受け取るか', '+3 カード と +1 購入 を、今すぐ受け取るか、次の自分のターンの開始時に受け取るかを選びます。', [
      { label: '次のターンの開始時に受け取る', cls: 'btn-primary', on: () => dispatch({ type: 'BARGE_CHOOSE', choice: 'next' }) },
      { label: '今すぐ受け取る（+3 カード +1 購入）', on: () => dispatch({ type: 'BARGE_CHOOSE', choice: 'now' }) },
    ]);
    // 賞金稼ぎ＝手札1枚を追放（強制）。追放マットに同名が無ければ +$3。
    if (pd.type === 'bounty_hunter_exile') return modalSingleHand(p, '賞金稼ぎ — 追放', '手札から1枚を追放します。追放マットに同名のカードが無ければ +3 コイン。',
      () => true, (card) => dispatch({ type: 'BOUNTY_HUNTER_EXILE', card }), false, '追放する');
    // ラクダの隊列＝サプライから勝利点でないカード1枚を追放（強制）。
    // ※混合山（廃墟/騎士/城）の一番上は state.supply にキーが無く modalGainSupply では出せないので modalPickIds を使う
    //   （これらしか候補が無い局面で「選択肢ゼロの閉じられないモーダル」になるのを防ぐ）。
    if (pd.type === 'camel_train_exile') return modalPickIds('ラクダの隊列 — 追放', 'サプライから勝利点でないカード1枚を追放します（獲得ではありません）。',
      DOM.engine.exilableSupplyIds(state).filter((id) => !DOM.isType(id, 'victory')),
      (id) => dispatch({ type: 'CAMEL_TRAIN_EXILE', card: id }), '追放する', null, state);
    // 黒猫／枢機卿／魔女の集会（アタック）。
    if (pd.type === 'black_cat' && pd.stage === 'react') return modalOptions('黒猫を受ける', '呪い1枚を獲得します。', reactOptions(p, pd, { type: 'BLACK_CAT_REACT' }));
    if (pd.type === 'cardinal' && pd.stage === 'react') return modalOptions('枢機卿を受ける', '山札の上2枚を公開し、コスト3〜6コインの1枚が追放されます。', reactOptions(p, pd, { type: 'CARDINAL_REACT' }));
    if (pd.type === 'cardinal' && pd.stage === 'pick') return modalOptions('枢機卿 — 追放するカードを選ぶ', '公開した2枚のうち、追放する1枚を選びます（残りは捨て札になります）。',
      (pd.cands || []).map((id) => ({ label: DOM.CARDS[id].name + 'を追放する', on: () => dispatch({ type: 'CARDINAL_PICK', card: id }) })));
    if (pd.type === 'coven' && pd.stage === 'react') return modalOptions('魔女の集会を受ける', 'サプライから呪い1枚を追放します（できない場合、追放マットの呪いをすべて捨て札にします）。', reactOptions(p, pd, { type: 'COVEN_REACT' }));
    // 強制退去＝手札1枚を追放 → それより最大2コイン高い「名前の異なる」カードを獲得。
    if (pd.type === 'displace_exile') return modalSingleHand(p, '強制退去 — 追放', '手札から1枚を追放します（そのあと、それより最大2コイン高い別のカードを獲得します）。',
      () => true, (card) => dispatch({ type: 'DISPLACE_EXILE', card }), false, '追放する');
    if (pd.type === 'displace_gain') return modalGainSupply(state, '強制退去 — 獲得', '追放したカードより最大2コイン高い、名前の異なるカード1枚を獲得します。',
      (id) => id !== pd.from && canUpTo(state, id, pd.maxCost, { pot: pd.pot, debt: pd.debt }), (id) => dispatch({ type: 'DISPLACE_GAIN', card: id }));
    // 鷹匠＝これより安いカード1枚を手札に獲得。
    if (pd.type === 'falconer_gain') return modalGainSupply(state, '鷹匠 — 獲得', '鷹匠より安いカード1枚を手札に獲得します。',
      (id) => DOM.engine.costUnder(state, id, pd.under), (id) => dispatch({ type: 'FALCONER_GAIN', card: id }));
    if (pd.type === 'falconer_react') return modalOptions('鷹匠 — 使いますか', '種別を2つ以上持つカードが獲得されました。手札の鷹匠を使用できます（アクション権は使いません）。', [
      { label: '鷹匠を使用する', cls: 'btn-primary', on: () => dispatch({ type: 'FALCONER_REACT', play: true }) },
      { label: '使用しない', on: () => dispatch({ type: 'FALCONER_REACT', play: false }) },
    ]);
    // ヤギ飼い＝手札1枚を廃棄してもよい。
    if (pd.type === 'goatherd_trash') return modalSingleHand(p, 'ヤギ飼い — 廃棄', '手札から1枚を廃棄してもよい（しなくてもかまいません）。',
      () => true, (card) => dispatch({ type: 'GOATHERD_TRASH', card }),
      { label: '廃棄しない', on: () => dispatch({ type: 'GOATHERD_TRASH', card: null }) }); // skip=true は死にボタン（首謀者と同型）
    // 馬丁＝$4以下を獲得（種別ごとにボーナス）。
    if (pd.type === 'groom_gain') return modalGainSupply(state, '馬丁 — 獲得', 'コスト4コイン以下のカード1枚を獲得します（アクション＝馬1枚／財宝＝銀貨1枚／勝利点＝+1カード +1アクション）。',
      (id) => canUpTo(state, id, 4), (id) => dispatch({ type: 'GROOM_GAIN', card: id }));
    // 旅籠（獲得時）＝手札の財宝を好きな枚数捨てて、その枚数の馬を獲得。
    if (pd.type === 'hostelry_discard') return modalMultiHand(p, '旅籠 — 財宝を捨てる',
      '手札の財宝を好きな枚数 公開して捨て、その枚数だけ馬を獲得します（0枚でもかまいません）。',
      (n) => '確定（' + n + '枚 捨てて 馬' + n + '枚）', true, (cards) => dispatch({ type: 'HOSTELRY_DISCARD', cards }), null,
      (id) => isTreasureNow(state, id));
    // 狩猟小屋＝手札を全部捨てて +5カード してもよい。
    if (pd.type === 'hunting_lodge_choose') return modalOptions('狩猟小屋 — 引き直しますか', '手札（' + p.hand.length + '枚）をすべて捨てて、+5 カード を引くことができます。', [
      { label: '手札を捨てて +5 カード', cls: 'btn-primary', on: () => dispatch({ type: 'HUNTING_LODGE_CHOOSE', discard: true }) },
      { label: 'そのままにする', on: () => dispatch({ type: 'HUNTING_LODGE_CHOOSE', discard: false }) },
    ]);
    // 首謀者＝手札のアクション1枚を3回使用してよい。
    if (pd.type === 'mastermind_play') return modalSingleHand(p, '首謀者 — 3回使用', '手札のアクションカード1枚を3回使用できます（使わなくてもかまいません）。',
      (id) => (DOM.isType(id, 'action') || inheritedEstate(state, id)) && DOM.engine.canPlayHandCard(state, pd.player, id), // 航海の3枚制限／将軍（engine と同じ述語）
      (card) => dispatch({ type: 'MASTERMIND_PLAY', card }),
      // ⚠ skip は {label,on} オブジェクト必須（true を渡すと label/onclick が undefined の**死にボタン**になり、
      //   候補ゼロのとき閉じる手段が無く人間が詰む＝敵対レビュー [high]。engine は null 辞退を受理する）。
      { label: '使わない', on: () => dispatch({ type: 'MASTERMIND_PLAY', card: null }) }, '3回使用する', DOM.engine.handPlayable(state, pd.player));
    // 聖域＝手札1枚を追放してもよい。
    if (pd.type === 'sanctuary_exile') return modalSingleHand(p, '聖域 — 追放', '手札から1枚を追放してもよい（しなくてもかまいません）。追放したカードは追放マットに置かれ、同名を獲得したときに戻せます。',
      () => true, (card) => dispatch({ type: 'SANCTUARY_EXILE', card }),
      { label: '追放しない', on: () => dispatch({ type: 'SANCTUARY_EXILE', card: null }) }, '追放する'); // skip=true は死にボタン（首謀者と同型）
    // がらくた＝手札1枚を廃棄 → そのコスト分だけ異なる効果を選ぶ。
    if (pd.type === 'scrap_trash') return modalSingleHand(p, 'がらくた — 廃棄', '手札から1枚を廃棄します。そのコスト1コインにつき1つ、異なる効果を選べます。',
      () => true, (card) => dispatch({ type: 'SCRAP_TRASH', card }), false, '廃棄する');
    if (pd.type === 'scrap_choose') {
      const OPTS = [{ k: 'card', label: '+1 カード' }, { k: 'action', label: '+1 アクション' }, { k: 'buy', label: '+1 購入' },
        { k: 'coin', label: '+1 コイン' }, { k: 'silver', label: '銀貨1枚を獲得' }, { k: 'horse', label: '馬1枚を獲得' }];
      const need = Math.min(pd.count || 0, OPTS.length);
      if (!Array.isArray(UI.selection)) UI.selection = [];
      const chips = OPTS.map((o, i) => h('button', {
        class: 'btn' + (UI.selection.indexOf(i) >= 0 ? ' btn-primary' : ''), style: 'margin:4px',
        onclick: () => {
          const at = UI.selection.indexOf(i);
          if (at >= 0) UI.selection.splice(at, 1); else if (UI.selection.length < need) UI.selection.push(i);
          render();
        },
      }, o.label));
      const footer = h('button', { class: 'btn btn-primary btn-block', disabled: UI.selection.length !== need ? 'disabled' : null,
        onclick: () => { const picks = UI.selection.map((i) => OPTS[i].k); UI.selection = []; dispatch({ type: 'SCRAP_CHOOSE', choices: picks }); } },
        '確定（' + UI.selection.length + '/' + need + '）');
      return modalShell('がらくた — 効果を選ぶ', '異なる効果を ' + need + '個 選びます。', chips, footer);
    }
    // 牧羊犬＝獲得したときに手札から使用してよい。
    if (pd.type === 'sheepdog_react') return modalOptions('牧羊犬 — 使いますか', 'カードを獲得しました。手札の牧羊犬を使用できます（+2 カード。アクション権は使いません）。', [
      { label: '牧羊犬を使用する（+2 カード）', cls: 'btn-primary', on: () => dispatch({ type: 'SHEEPDOG_REACT', play: true }) },
      { label: '使用しない', on: () => dispatch({ type: 'SHEEPDOG_REACT', play: false }) },
    ]);
    // そり＝これを捨てて、獲得したカードを手札か山札の上へ。
    if (pd.type === 'sleigh_react') return modalOptions('そり — 使いますか',
      '「' + ((DOM.CARDS[pd.card] || {}).name || pd.card) + '」を獲得しました。そりを捨て札にすると、このカードを手札に加えるか山札の上に置けます。', [
        { label: '手札に加える（そりを捨てる）', cls: 'btn-primary', on: () => dispatch({ type: 'SLEIGH_REACT', where: 'hand' }) },
        { label: '山札の上に置く（そりを捨てる）', on: () => dispatch({ type: 'SLEIGH_REACT', where: 'deck' }) },
        { label: '使わない', on: () => dispatch({ type: 'SLEIGH_REACT', where: null }) },
      ]);
    // 村有緑地＝「今」か「次のターンの開始時」に +1カード +2アクション／捨て札にしたときの使用。
    if (pd.type === 'village_green_choose') return modalOptions('村有緑地 — いつ受け取るか', '+1 カード と +2 アクション を、今すぐ受け取るか、次のターンの開始時に受け取るかを選びます。', [
      { label: '次のターンの開始時に受け取る', cls: 'btn-primary', on: () => dispatch({ type: 'VILLAGE_GREEN_CHOOSE', choice: 'next' }) },
      { label: '今すぐ受け取る（+1 カード +2 アクション）', on: () => dispatch({ type: 'VILLAGE_GREEN_CHOOSE', choice: 'now' }) },
    ]);
    if (pd.type === 'village_green_react') return modalOptions('村有緑地 — 使いますか', '捨て札にした村有緑地を使用できます（クリンナップ以外で捨てたとき）。', [
      { label: '村有緑地を使用する', cls: 'btn-primary', on: () => dispatch({ type: 'VILLAGE_GREEN_REACT', play: true }) },
      { label: '使用しない', on: () => dispatch({ type: 'VILLAGE_GREEN_REACT', play: false }) },
    ]);
    // 行人＝銀貨1枚を獲得してもよい。
    if (pd.type === 'wayfarer_gain') return modalOptions('行人 — 銀貨', '銀貨1枚を獲得できます。', [
      { label: '銀貨を獲得する', cls: 'btn-primary', on: () => dispatch({ type: 'WAYFARER_GAIN', gain: true }) },
      { label: '獲得しない', on: () => dispatch({ type: 'WAYFARER_GAIN', gain: false }) },
    ]);
    // 炉＝いま使ったカードの解決前に、同じカードを獲得してもよい。
    if (pd.type === 'kiln_gain') return modalOptions('炉 — コピーを獲得しますか',
      '「' + ((DOM.CARDS[pd.card] || {}).name || pd.card) + '」を使用します。解決する前に、同じカード1枚を獲得できます。', [
        { label: '「' + ((DOM.CARDS[pd.card] || {}).name || pd.card) + '」を獲得する', cls: 'btn-primary', on: () => dispatch({ type: 'KILN_GAIN', gain: true }) },
        { label: '獲得しない', on: () => dispatch({ type: 'KILN_GAIN', gain: false }) },
      ]);
    /* ===== 移動動物園：習性（Way）の選択待ち ===== */
    if (pd.type === 'way_butterfly') return modalOptions('チョウの習性', '「' + ((DOM.CARDS[pd.card] || {}).name || pd.card) + '」をその山に戻すと、ちょうど1コイン高いカード1枚を獲得できます。', [
      { label: '山に戻して 1コイン高いカードを獲得', cls: 'btn-primary', on: () => dispatch({ type: 'WAY_BUTTERFLY', ret: true }) },
      { label: '戻さない（何も起きない）', on: () => dispatch({ type: 'WAY_BUTTERFLY', ret: false }) },
    ]);
    if (pd.type === 'way_butterfly_gain') return modalGainSupply(state, 'チョウの習性 — 獲得', '戻したカードよりちょうど1コイン高いカード1枚を獲得します。',
      (id) => canExact(state, id, pd.exactCost, pd.pot, pd.debt), (id) => dispatch({ type: 'WAY_BUTTERFLY_GAIN', card: id }));
    if (pd.type === 'way_goat_trash') return modalSingleHand(p, 'ヤギの習性 — 廃棄', '手札から1枚を廃棄します。',
      () => true, (card) => dispatch({ type: 'WAY_GOAT_TRASH', card }), false, '廃棄する');
    if (pd.type === 'way_rat_discard') return modalSingleHand(p, 'ドブネズミの習性 — 財宝を捨てる',
      '手札の財宝1枚を捨て札にすると、「' + ((DOM.CARDS[pd.card] || {}).name || pd.card) + '」をもう1枚獲得できます（しなくてもかまいません）。',
      (id) => isTreasureNow(state, id), (card) => dispatch({ type: 'WAY_RAT_DISCARD', card }),
      { label: '捨てない', on: () => dispatch({ type: 'WAY_RAT_DISCARD', card: null }) }, '捨てて獲得する'); // skip=true は死にボタン（首謀者と同型）
    if (pd.type === 'way_seal_topdeck') return modalOptions('アザラシの習性', '「' + ((DOM.CARDS[pd.card] || {}).name || pd.card) + '」を獲得しました。山札の上に置けます。', [
      { label: '山札の上に置く', cls: 'btn-primary', on: () => dispatch({ type: 'WAY_SEAL_TOPDECK', top: true }) },
      { label: 'そのまま（捨て札へ）', on: () => dispatch({ type: 'WAY_SEAL_TOPDECK', top: false }) },
    ]);
    /* ===== 移動動物園：イベント20種の選択待ち ===== */
    // 特価品＝$5以下の勝利点でないカード1枚を獲得（強制）。そのあと他の各プレイヤーが馬1枚を獲得する。
    if (pd.type === 'bargain_gain') return modalGainSupply(state, '特価品 — 獲得',
      'コスト5コイン以下の、勝利点でないカード1枚を獲得します（そのあと、他のプレイヤーは各自 馬1枚を獲得します）。',
      (id) => DOM.engine.bargainCanGain(state, id), (id) => dispatch({ type: 'BARGAIN_GAIN', card: id }));
    // 要求＝$4以下のカード1枚を山札の上に獲得（馬は既に山札の上に置かれている）。
    if (pd.type === 'demand_gain') return modalGainSupply(state, '要求 — 獲得',
      'コスト4コイン以下のカード1枚を、山札の上に獲得します（馬はすでに山札の上に置きました＝このカードが一番上になります）。',
      (id) => canUpTo(state, id, 4), (id) => dispatch({ type: 'DEMAND_GAIN', card: id }));
    // 絶望＝呪い1枚を獲得してもよい。獲得したなら +1購入 +$2。
    if (pd.type === 'desperation') return modalOptions('絶望 — 呪いを獲得しますか', '呪い1枚を獲得すると、+1 購入 と +2 コイン を得ます。', [
      { label: '呪いを獲得する（+1 購入 +2 コイン）', cls: 'btn-primary', on: () => dispatch({ type: 'DESPERATION', gain: true }) },
      { label: '獲得しない（何も得ない）', on: () => dispatch({ type: 'DESPERATION', gain: false }) },
    ]);
    // 放逐＝手札から同じ名前のカードを好きな枚数 追放する（2種類は不可）。
    if (pd.type === 'banish') {
      const names = [];
      p.hand.forEach((c) => { if (names.indexOf(c) < 0) names.push(c); });
      if (UI.selection && typeof UI.selection === 'string' && names.indexOf(UI.selection) < 0) UI.selection = null;
      if (typeof UI.selection === 'string') { // 2段目＝枚数を選ぶ
        const nm = UI.selection;
        const have = p.hand.filter((c) => c === nm).length;
        // 誤タップから戻れるように「別のカードを選ぶ」を必ず出す（1段目は確認を挟まないため）。
        const back = h('button', { class: 'btn btn-block', style: 'margin-top:8px',
          onclick: () => { UI.selection = []; UI.amount = null; render(); } }, '別のカードを選ぶ／追放しない');
        const body = modalAmount('放逐 — 枚数', '「' + ((DOM.CARDS[nm] || {}).name || nm) + '」を何枚 追放しますか（追放マットに置きます）。',
          have, 1, (n) => n + '枚を追放する',
          (n) => { UI.selection = []; dispatch({ type: 'BANISH_EXILE', card: nm, n }); });
        // modalAmount の footer の下に「もどる」を差し込む
        const modalEl = body.childNodes && body.childNodes[0];
        if (modalEl && modalEl.appendChild) modalEl.appendChild(back);
        return body;
      }
      const chips = names.map((id) => cardEl(id, { size: 'sm', extra: 'selectable',
        onClick: () => { UI.selection = id; render(); } }));
      const footer = h('button', { class: 'btn btn-block', onclick: () => { UI.selection = null; dispatch({ type: 'BANISH_EXILE', card: null }); } }, '追放しない');
      return modalShell('放逐 — 追放するカード', '手札から「同じ名前」のカードを好きな枚数 追放します（2種類はまとめられません）。', chips, footer);
    }
    // 投資＝サプライからアクション1枚を追放する（以後、他プレイヤーがそれを獲得/投資すると +2カード）。
    if (pd.type === 'invest') return modalPickIds('投資 — 追放',
      'サプライからアクションカード1枚を追放します（獲得ではありません）。追放されている間、他のプレイヤーがそれと同名のカードを獲得または投資すると、あなたは +2 カード を引きます。',
      DOM.engine.exilableSupplyIds(state).filter((id) => DOM.isType(id, 'action')),
      (id) => dispatch({ type: 'INVEST_EXILE', card: id }), '投資する', null, state);
    // 輸送＝二択（実行できない方も選べる＝公式）。
    if (pd.type === 'transport' && pd.stage === 'mode') return modalOptions('輸送 — どちらかを選ぶ', '次から1つを選びます。', [
      { label: 'サプライからアクション1枚を追放する', cls: 'btn-primary', on: () => dispatch({ type: 'TRANSPORT_MODE', mode: 'exile' }) },
      { label: '追放してあるアクション1枚を山札の上に置く', on: () => dispatch({ type: 'TRANSPORT_MODE', mode: 'return' }) },
    ]);
    if (pd.type === 'transport' && pd.stage === 'exile') return modalPickIds('輸送 — 追放',
      'サプライからアクションカード1枚を追放します（獲得ではありません）。',
      DOM.engine.exilableSupplyIds(state).filter((id) => DOM.isType(id, 'action')),
      (id) => dispatch({ type: 'TRANSPORT_PICK', card: id }), '追放する', null, state);
    if (pd.type === 'transport' && pd.stage === 'return') {
      const names = [];
      (p.exile || []).forEach((c) => { if (DOM.isType(c, 'action') && names.indexOf(c) < 0) names.push(c); });
      const chips = names.length
        ? names.map((id) => cardEl(id, { size: 'sm', extra: 'selectable', onClick: () => openPickZoom(id, '山札の上に置く', () => dispatch({ type: 'TRANSPORT_PICK', card: id })) }))
        : [h('p', { class: 'muted' }, '対象のカードがありません')];
      return modalShell('輸送 — 山札の上に置く', '追放マットにある自分のアクションカード1枚を、山札の上に置きます。', chips, null);
    }
    // 苦労／進軍／博打／脇に置いたカード＝「アクション権を消費しない使用」（習性を選べる）。
    if (pd.type === 'toil') return modalPlayCardEvent(state, p, '苦労 — アクションを使う',
      '手札からアクションカード1枚を使用できます（山札の影カードも選べます／アクション権は使いません）。', DOM.engine.handPlayable(state, pd.player),
      (id) => DOM.isType(id, 'action') || inheritedEstate(state, id), 'TOIL_PLAY',
      { label: '使用しない', on: () => dispatch({ type: 'TOIL_PLAY', card: null }) });
    if (pd.type === 'march') return modalPlayCardEvent(state, p, '進軍 — 捨て札から使う',
      '捨て札置き場を見て、その中のアクションカード1枚を使用できます（アクション権は使いません）。', p.discard,
      (id) => DOM.isType(id, 'action'), 'MARCH_PLAY',
      { label: '使用しない', on: () => dispatch({ type: 'MARCH_PLAY', card: null }) });
    if (pd.type === 'gamble') {
      const nm = (DOM.CARDS[pd.card] || {}).name || pd.card;
      const ways = (state.ways || []).filter((w) => (DOM.LANDSCAPES || {})[w] && DOM.isType(pd.card, 'action'));
      const btns = [{ label: '「' + nm + '」を使う', cls: 'btn-primary', on: () => dispatch({ type: 'GAMBLE_PLAY', play: true }) }];
      ways.forEach((w) => btns.push({ label: '「' + DOM.LANDSCAPES[w].name + '」で使う', on: () => dispatch({ type: 'GAMBLE_PLAY', play: true, way: w }) }));
      btns.push({ label: '使わない（捨て札のまま）', on: () => dispatch({ type: 'GAMBLE_PLAY', play: false }) });
      return modalOptions('博打 — 使いますか', '山札の上の「' + nm + '」を捨て札にしました。これを使用できます（アクション権は使いません）。', btns);
    }
    // 遅延＝手札のアクション1枚を脇に置いてもよい（次のターン開始時に使用する）。
    if (pd.type === 'delay') return modalSingleHand(p, '遅延 — 脇に置く',
      '手札からアクションカード1枚を脇に置けます。次の自分のターンの開始時に、それを（アクション権を使わずに）使用します。',
      (id) => DOM.isType(id, 'action'), (card) => dispatch({ type: 'DELAY_SETASIDE', card }),
      { label: '脇に置かない', on: () => dispatch({ type: 'DELAY_SETASIDE', card: null }) }, '脇に置く');
    // 遅延／刈り入れ＝ターン開始時に脇のカードを使用する（強制）。
    if (pd.type === 'event_play') {
      const card = (p.eventSetAside || [])[0];
      // 脇が空（他の効果で動かされた等）でも押せるボタンを出す＝engine 側が自己修復して窓を閉じる。
      if (card == null) return modalOptions('脇に置いたカード', '脇に置いたカードはもうありません。', [
        { label: '進む', cls: 'btn-primary', on: () => dispatch({ type: 'EVENT_PLAY' }) }]);
      const nm = (DOM.CARDS[card] || {}).name || card;
      const ways = (state.ways || []).filter((w) => (DOM.LANDSCAPES || {})[w] && DOM.isType(card, 'action'));
      const btns = [{ label: '「' + nm + '」を使う', cls: 'btn-primary', on: () => dispatch({ type: 'EVENT_PLAY' }) }];
      ways.forEach((w) => btns.push({ label: '「' + DOM.LANDSCAPES[w].name + '」で使う', on: () => dispatch({ type: 'EVENT_PLAY', way: w }) }));
      return modalOptions('脇に置いたカードを使う', '遅延／刈り入れで脇に置いた「' + nm + '」を使用します（アクション権は使いません）。', btns);
    }
    // 増大＝勝利点でない手札1枚を廃棄してもよい → それより最大$2高いカード1枚を獲得（強制）。
    if (pd.type === 'enhance' && pd.stage === 'trash') return modalSingleHand(p, '増大 — 廃棄',
      '手札から勝利点でないカード1枚を廃棄できます。廃棄したら、それより最大2コイン高いカード1枚を獲得します。',
      (id) => !DOM.isType(id, 'victory'), (card) => dispatch({ type: 'ENHANCE_TRASH', card }),
      { label: '廃棄しない', on: () => dispatch({ type: 'ENHANCE_TRASH', card: null }) }, '廃棄する');
    if (pd.type === 'enhance' && pd.stage === 'gain') return modalGainSupply(state, '増大 — 獲得',
      '廃棄したカードより最大2コイン高いカード1枚を獲得します。',
      (id) => canUpTo(state, id, pd.maxCost, { pot: pd.pot, debt: pd.debt }), (id) => dispatch({ type: 'ENHANCE_GAIN', card: id }));
    // 追求＝カード名を1つ指定（山札の上4枚のうち、その名前だけを山札の上に戻す）。
    //   候補は「今このゲームに存在するカード名」＝サプライの山（空でも可）＋混合山（廃墟/騎士/城）の中身。
    //   **混合山はプレースホルダ（'castles'/'knights'）が山キーなので、そのまま出すと絶対に一致しない死に指名になる**
    //   （かつ本物の「粗末な城」等を指名できない）。中身を展開して出す。
    if (pd.type === 'pursue') {
      const names = [];
      const push = (id) => { if (DOM.CARDS[id] && names.indexOf(id) < 0) names.push(id); };
      const MIX = DOM.engine.MIXED_PILE_KEYS || [];
      Object.keys(state.supply).forEach((id) => { if (MIX.indexOf(id) < 0) push(id); });
      MIX.forEach((k) => { (state[k] || []).forEach(push); });
      return modalPickIds('追求 — カード名を指定',
        'カード名を1つ指定します。山札の上4枚を公開し、指定した名前のカードだけを山札の上に戻し、残りを捨て札にします。',
        names, (id) => dispatch({ type: 'PURSUE_NAME', card: id }), '指定する');
    }
    // 植民＝アクションのサプライ山それぞれから1枚ずつ獲得（獲得順は自分で選べる／おまかせも可）。
    if (pd.type === 'populate') {
      const piles = (state.turn.populateQueue || []).filter((k) => (DOM.engine.populatePiles(state) || []).indexOf(k) >= 0);
      const chips = piles.map((k) => {
        const shown = (DOM.engine.mixedTopCard ? DOM.engine.mixedTopCard(state, k) : null) || k;
        return cardEl(shown, { size: 'sm', extra: 'selectable', onClick: () => dispatch({ type: 'POPULATE_GAIN', pile: k }) });
      });
      const footer = h('button', { class: 'btn btn-primary btn-block', onclick: () => dispatch({ type: 'POPULATE_GAIN', auto: true }) },
        'おまかせで残り ' + piles.length + '枚 を獲得');
      return modalShell('植民 — 獲得する山を選ぶ', 'アクションのサプライ山それぞれから1枚ずつ獲得します（残り ' + piles.length + '山）。獲得する順番は選べます。', chips, footer);
    }
    /* ===== 夜想曲（Nocturne）：祝福／呪詛／状態 ===== */
    if (pd.type === 'boon_wind') {
      const n = Math.min(2, p.hand.length);
      return modalSelectN(p, '風の恵み — 2枚捨てる', '手札を' + n + '枚選んで捨てます（強制）。', n, '確定（捨てる）',
        (cards) => dispatch({ type: 'BOON_WIND_DISCARD', cards }));
    }
    if (pd.type === 'boon_flame') {
      return modalSingleHand(p, '炎の恵み — 廃棄', '手札から1枚を廃棄できます（しなくてもよい）。', () => true,
        (card) => dispatch({ type: 'BOON_FLAME_TRASH', card }),
        { label: '廃棄しない', on: () => dispatch({ type: 'BOON_FLAME_TRASH', card: null }) });
    }
    if (pd.type === 'boon_earth') {
      return modalSingleHand(p, '大地の恵み — 財宝を捨てる', '手札の財宝1枚を捨てると、コスト4以下のカードを1枚獲得できます（しなくてもよい）。',
        (id) => isTreasureNow(state, id), (card) => dispatch({ type: 'BOON_EARTH_DISCARD', card }),
        { label: '捨てない', on: () => dispatch({ type: 'BOON_EARTH_DISCARD', card: null }) }, '捨てる');
    }
    if (pd.type === 'boon_earth_gain') {
      return modalGainSupply(state, '大地の恵み — 獲得', 'コスト4以下のカードを1枚獲得します。',
        (id) => DOM.engine.costUpTo(state, id, 4), (id) => dispatch({ type: 'BOON_EARTH_GAIN', card: id }));
    }
    if (pd.type === 'boon_sky') {
      pruneSelection(p.hand.length);
      const n = Math.min(3, p.hand.length);
      const chips = p.hand.map((id, idx) => {
        const pos = UI.selection.indexOf(idx);
        return cardEl(id, { size: 'sm', extra: pos >= 0 ? 'selected' : 'selectable', badge: pos >= 0 ? String(pos + 1) : null,
          onClick: () => { const i = UI.selection.indexOf(idx); if (i >= 0) UI.selection.splice(i, 1); else if (UI.selection.length < n) UI.selection.push(idx); render(); } });
      });
      const remain = n - UI.selection.length;
      const footer = h('div', null,
        h('button', { class: 'btn btn-primary btn-block', disabled: remain === 0 ? null : 'disabled', style: 'margin-bottom:8px',
          onclick: () => dispatch({ type: 'BOON_SKY_DISCARD', cards: takeSelection(p.hand) }) },
          remain === 0 ? (n === 3 ? '確定（3枚捨てて金貨を獲得）' : '確定（' + n + '枚捨てる／金貨は得られません）') : ('あと ' + remain + ' 枚')),
        h('button', { class: 'btn btn-block', onclick: () => dispatch({ type: 'BOON_SKY_DISCARD', cards: null }) }, '捨てない'));
      return modalShell('空の恵み — 3枚捨てて金貨', '手札を' + n + '枚選んで捨てると金貨1枚を獲得します（手札が3枚未満なら捨てるだけで金貨は得られません）。', chips, footer);
    }
    if (pd.type === 'boon_moon') {
      const ids = [...new Set(p.discard)];
      return modalPickIds('月の恵み — 捨て札から山札の上へ', '捨て札（' + p.discard.length + '枚）の中から1枚を山札の上に置けます（置かなくてもよい）。',
        ids, (id) => dispatch({ type: 'BOON_MOON_TOPDECK', card: id }), '山札の上に置く',
        { label: '置かない', on: () => dispatch({ type: 'BOON_MOON_TOPDECK', card: null }) });
    }
    if (pd.type === 'look_arrange') {
      const cards = pd.cards || [];
      pruneSelection(cards.length);
      const src = (DOM.LANDSCAPES[pd.source] && DOM.LANDSCAPES[pd.source].name) || (DOM.CARDS[pd.source] && DOM.CARDS[pd.source].name) || '';
      const chips = cards.map((id, idx) =>
        cardEl(id, { size: 'sm', extra: UI.selection.includes(idx) ? 'selected' : 'selectable',
          badge: UI.selection.includes(idx) ? '捨' : null,
          onClick: () => { const i = UI.selection.indexOf(idx); if (i >= 0) UI.selection.splice(i, 1); else UI.selection.push(idx); render(); } }));
      const footer = h('button', { class: 'btn btn-primary btn-block',
        onclick: () => { const sel = UI.selection.slice(); UI.selection = []; const disc = sel.map((i) => cards[i]); const top = cards.filter((c, i) => sel.indexOf(i) < 0); dispatch({ type: 'LOOK_ARRANGE_RESOLVE', discard: disc, top }); } },
        '確定（' + UI.selection.length + '枚 捨て、残り ' + (cards.length - UI.selection.length) + '枚 を山札の上へ）');
      return modalShell(src + ' — 山札の上' + cards.length + '枚', 'タップして捨てるカードを選びます（選ばなかったカードはこの順のまま山札の上に戻ります）。', chips, footer);
    }
    if (pd.type === 'hex' && pd.stage === 'react') {
      return modalOptions('呪詛を受ける', '呪詛が1枚めくられ、防げなかった全員が同じ呪詛を受けます。', reactOptions(p, pd, { type: 'HEX_REACT' }));
    }
    if (pd.type === 'hex_poverty') {
      const n = Math.max(0, p.hand.length - 3);
      return modalSelectN(p, '貧困 — 手札3枚まで捨てる', '手札が3枚になるように' + n + '枚 選んで捨てます。', n, '確定（捨てる）',
        (cards) => dispatch({ type: 'HEX_POVERTY_DISCARD', cards }));
    }
    if (pd.type === 'hex_fear') {
      return modalSingleHand(p, '恐怖 — アクションか財宝を捨てる', '手札からアクションカードか財宝カード1枚を捨てます（強制）。',
        (id) => DOM.isType(id, 'action') || isTreasureNow(state, id),
        (card) => dispatch({ type: 'HEX_FEAR_DISCARD', card }), null, '捨てる');
    }
    if (pd.type === 'hex_haunting') {
      return modalSingleHand(p, '憑依 — 手札を山札の上へ', '手札から1枚を選んで山札の上に置きます（強制）。', () => true,
        (card) => dispatch({ type: 'HEX_HAUNTING_TOPDECK', card }), null, '山札の上に置く');
    }
    if (pd.type === 'hex_locusts') {
      return modalGainSupply(state, '蝗害 — 獲得', '廃棄した「' + (DOM.CARDS[pd.ref] ? DOM.CARDS[pd.ref].name : '') + '」と同じ種別を持ち、それより安いカードを1枚獲得します。',
        (id) => DOM.engine.costUnder(state, id, pd.coin, { pot: pd.pot || 0, debt: pd.debt || 0 }) && DOM.engine.sharesType(id, pd.ref),
        (id) => dispatch({ type: 'HEX_LOCUSTS_GAIN', card: id }));
    }
    if (pd.type === 'blessed_village_boon') {
      const b = DOM.LANDSCAPES[pd.boon] || {};
      return modalOptions('恵みの村 — 祝福「' + (b.name || '') + '」', (b.text || '') + '\n\n今すぐ受けるか、次のあなたのターンの開始時に受けるかを選びます。', [
        { label: '今すぐ受ける', cls: 'btn-primary', on: () => dispatch({ type: 'BLESSED_VILLAGE_BOON', now: true }) },
        { label: '次の自分のターンの開始時に受ける', on: () => dispatch({ type: 'BLESSED_VILLAGE_BOON', now: false }) }]);
    }
    if (pd.type === 'cemetery_trash') {
      return modalMultiHand(p, '墓地 — 最大4枚を廃棄', '手札から最大4枚を選んで廃棄します（0枚でもよい＝廃棄しない）。',
        (n) => (n > 0 ? '確定（' + n + '枚 廃棄する）' : '廃棄しない'), true,
        (cards) => dispatch({ type: 'CEMETERY_TRASH', cards }), 4);
    }
    if (pd.type === 'conclave') {
      const cand = DOM.engine.conclaveTargets(state, pd.player);
      return modalSingleHand(p, 'コンクラーベ — 手札のアクションを使う', 'あなたの場に同じカードが出ていないアクションカード1枚を使えます（使えば +1アクション）。',
        (id) => cand.indexOf(id) >= 0, (card) => dispatch({ type: 'CONCLAVE_PLAY', card }),
        { label: '使わない', on: () => dispatch({ type: 'CONCLAVE_PLAY', card: null }) }, '使う', DOM.engine.handPlayable(state, pd.player));
    }
    if (pd.type === 'druid_boon' || pd.type === 'boon_choose') {
      const isDruid = pd.type === 'druid_boon';
      const set = isDruid ? ((state.boons && state.boons.druid) || [])
        : ((state.turn.boonChoice && state.turn.boonChoice.boons) || []);
      return modalOptions(isDruid ? 'ドルイド — 祝福を1つ受ける' : '愚者 — 受ける祝福を選ぶ',
        isDruid ? '脇に置かれた3枚から1つを受けます（祝福はそのまま脇に残ります）。' : '取った祝福を好きな順番で1つずつ受けます。',
        set.map((id) => ({
          label: (DOM.LANDSCAPES[id] || {}).name + '：' + ((DOM.LANDSCAPES[id] || {}).text || '').replace(/\n/g, ' '),
          on: () => dispatch({ type: isDruid ? 'DRUID_BOON' : 'BOON_CHOOSE', boon: id }),
        })));
    }
    if (pd.type === 'grove_offer') {
      const b = DOM.LANDSCAPES[pd.boon] || {};
      return modalOptions('聖なる木立ち — 祝福「' + (b.name || '') + '」を受けますか？', (b.text || '') + '\n\n受けるかどうかは任意です。', [
        { label: '受ける', cls: 'btn-primary', on: () => dispatch({ type: 'GROVE_OFFER', take: true }) },
        { label: '受けない', on: () => dispatch({ type: 'GROVE_OFFER', take: false }) }]);
    }
    if (pd.type === 'pixie_trash') {
      const b = DOM.LANDSCAPES[pd.boon] || {};
      return modalOptions('ピクシー — 祝福「' + (b.name || '') + '」', (b.text || '') + '\n\nピクシーを廃棄すると、この祝福を2回受けられます。', [
        { label: 'ピクシーを廃棄して2回受ける', cls: 'btn-primary', on: () => dispatch({ type: 'PIXIE_TRASH', trash: true }) },
        { label: '廃棄しない（祝福は捨てられる）', on: () => dispatch({ type: 'PIXIE_TRASH', trash: false }) }]);
    }
    if (pd.type === 'pooka_trash') {
      return modalSingleHand(p, 'プーカ — 財宝を廃棄', '呪われた金貨以外の財宝カード1枚を廃棄すると +4カード（しなくてもよい）。',
        (id) => isTreasureNow(state, id) && id !== 'cursed_gold', (card) => dispatch({ type: 'POOKA_TRASH', card }),
        { label: '廃棄しない', on: () => dispatch({ type: 'POOKA_TRASH', card: null }) });
    }
    if (pd.type === 'secret_cave') {
      pruneSelection(p.hand.length);
      const chips = p.hand.map((id, idx) => {
        const pos = UI.selection.indexOf(idx);
        return cardEl(id, { size: 'sm', extra: pos >= 0 ? 'selected' : 'selectable', badge: pos >= 0 ? String(pos + 1) : null,
          onClick: () => { const i = UI.selection.indexOf(idx); if (i >= 0) UI.selection.splice(i, 1); else if (UI.selection.length < 3) UI.selection.push(idx); render(); } });
      });
      const remain = 3 - UI.selection.length;
      const footer = h('div', null,
        h('button', { class: 'btn btn-primary btn-block', disabled: (remain === 0 && p.hand.length >= 3) ? null : 'disabled', style: 'margin-bottom:8px',
          onclick: () => dispatch({ type: 'SECRET_CAVE_DISCARD', cards: takeSelection(p.hand) }) },
          remain === 0 ? '確定（3枚捨てる → 次のターン +3コイン）' : (p.hand.length < 3 ? '手札が3枚未満です' : 'あと ' + remain + ' 枚')),
        h('button', { class: 'btn btn-block', onclick: () => dispatch({ type: 'SECRET_CAVE_DISCARD', cards: null }) }, '捨てない'));
      return modalShell('秘密の洞窟 — 3枚捨てる', '手札3枚を捨てると、次のあなたのターンの開始時に +3コイン になります。', chips, footer);
    }
    if (pd.type === 'shepherd_discard') {
      return modalMultiHand(p, '羊飼い — 勝利点を捨てる', '手札の勝利点カードを好きな枚数、公開して捨てます（1枚につき +2カード）。',
        (n) => (n > 0 ? '確定（' + n + '枚 捨てて +' + (n * 2) + 'カード）' : '捨てない'), true,
        (cards) => dispatch({ type: 'SHEPHERD_DISCARD', cards }), null, (id) => DOM.isType(id, 'victory'));
    }
    if (pd.type === 'tragic_hero_gain') {
      return modalGainSupply(state, '悲劇のヒーロー — 財宝を獲得', '財宝カード1枚を獲得します。',
        (id) => DOM.engine.gainableBase(state, id) && isTreasureNow(state, id), (id) => dispatch({ type: 'TRAGIC_HERO_GAIN', card: id }));
    }
    if (pd.type === 'goat_trash') {
      return modalSingleHand(p, 'ヤギ — 廃棄', '手札から1枚を廃棄できます（しなくてもよい）。', () => true,
        (card) => dispatch({ type: 'GOAT_TRASH', card }),
        { label: '廃棄しない', on: () => dispatch({ type: 'GOAT_TRASH', card: null }) });
    }
    if (pd.type === 'haunted_mirror') {
      return modalSingleHand(p, '呪いの鏡 — アクションを捨てて幽霊', '手札のアクションカード1枚を捨てると幽霊1枚を獲得できます（しなくてもよい）。',
        (id) => DOM.isType(id, 'action'), (card) => dispatch({ type: 'HAUNTED_MIRROR_GHOST', card }),
        { label: '何もしない', on: () => dispatch({ type: 'HAUNTED_MIRROR_GHOST', card: null }) }, '捨てる');
    }
    if (pd.type === 'faithful_hound_react') {
      return modalOptions('忠犬 — 脇に置きますか？', '捨て札にした忠犬を脇に置くと、このターンの終了時に手札へ戻ります。', [
        { label: '脇に置く（ターン終了時に手札へ）', cls: 'btn-primary', on: () => dispatch({ type: 'FAITHFUL_HOUND_REACT', setAside: true }) },
        { label: 'そのまま捨てる', on: () => dispatch({ type: 'FAITHFUL_HOUND_REACT', setAside: false }) }]);
    }
    if (pd.type === 'cobbler_gain') {
      return modalGainSupply(state, 'カブラー — 手札に獲得', 'コスト4以下のカード1枚を獲得し、手札に加えます。',
        (id) => DOM.engine.costUpTo(state, id, 4), (id) => dispatch({ type: 'COBBLER_GAIN', card: id }));
    }
    if (pd.type === 'crypt_setaside') {
      pruneSelection(p.inPlay.length);
      const elig = p.inPlay.map((id, idx) => ({ id, idx })).filter((x) => isTreasureNow(state, x.id) && !DOM.isType(x.id, 'duration'));
      const chips = elig.map((x) => cardEl(x.id, { size: 'sm', extra: UI.selection.includes(x.idx) ? 'selected' : 'selectable',
        onClick: () => { const i = UI.selection.indexOf(x.idx); if (i >= 0) UI.selection.splice(i, 1); else UI.selection.push(x.idx); render(); } }));
      const footer = h('button', { class: 'btn btn-primary btn-block',
        onclick: () => dispatch({ type: 'CRYPT_SETASIDE', cards: takeSelection(p.inPlay) }) },
        UI.selection.length ? '確定（' + UI.selection.length + '枚 を脇に置く）' : '脇に置かない');
      return modalShell('納骨堂 — 場の財宝を脇に置く', '場に出ている「持続でない財宝」を好きな枚数、裏向きで脇に置きます。以後あなたの各ターンの開始時に1枚ずつ手札へ加わります（0枚でもよい）。', chips, footer);
    }
    if (pd.type === 'crypt_pick') {
      return modalPickIds('納骨堂 — 手札に加える', '脇に置いた財宝から1枚を手札に加えます。',
        [...new Set(p.cryptSetAside || [])], (id) => dispatch({ type: 'CRYPT_PICK', card: id }), '手札に加える');
    }
    if (pd.type === 'devils_workshop_gain') {
      return modalGainSupply(state, '悪魔の工房 — 獲得', 'このターンに1枚だけ獲得していたので、コスト4以下のカード1枚を獲得します。',
        (id) => DOM.engine.costUpTo(state, id, 4), (id) => dispatch({ type: 'DEVILS_WORKSHOP_GAIN', card: id }));
    }
    if (pd.type === 'exorcist_trash') {
      return modalSingleHand(p, '悪魔祓い — 廃棄', '手札から1枚を廃棄します（その後、それより安い精霊カードを1枚獲得します）。', () => true,
        (card) => dispatch({ type: 'EXORCIST_TRASH', card }), null);
    }
    if (pd.type === 'exorcist_gain') {
      // 精霊は非サプライ＝engine と同じ述語（exorcistSpirits）を見る（costUnder だと候補ゼロで人間が詰む）。
      const ids = DOM.engine.exorcistSpirits(state, { coin: pd.coin, pot: pd.pot || 0, debt: pd.debt || 0 });
      return modalPickIds('悪魔祓い — 精霊を獲得', '廃棄したカードより安い精霊カード1枚を獲得します。',
        ids, (id) => dispatch({ type: 'EXORCIST_GAIN', card: id }), '獲得する', null, state);
    }
    if (pd.type === 'monastery') {
      const chips = [...new Set(p.hand)].map((id) => cardEl(id, { size: 'sm', extra: 'selectable',
        onClick: () => openPickZoom(id, '廃棄する', () => dispatch({ type: 'MONASTERY_TRASH', card: id })) }));
      const btns = [];
      if (p.inPlay.includes('copper')) btns.push(h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'MONASTERY_TRASH', card: 'copper', fromPlay: true }) }, '場の銅貨1枚を廃棄する'));
      btns.push(h('button', { class: 'btn btn-block', onclick: () => dispatch({ type: 'MONASTERY_TRASH', card: null }) }, 'やめる'));
      return modalShell('修道院 — 廃棄（あと ' + (pd.remaining || 1) + '回）', '手札1枚、または場にある銅貨1枚を廃棄できます（任意・1枚ずつ）。', chips, h('div', null, btns));
    }
    if (pd.type === 'raider' && pd.stage === 'react') {
      return modalOptions('夜襲を受ける', '相手の場にあるカードと同じカード1枚を手札から捨てます（できなければ手札を公開します）。', reactOptions(p, pd, { type: 'RAIDER_REACT' }));
    }
    if (pd.type === 'raider' && pd.stage === 'discard') {
      const src = state.players[pd.source];
      const inPlay = new Set(src.inPlay.concat(src.durationCards || []));
      return modalSingleHand(p, '夜襲 — 捨てる', src.name + ' の場にあるカードと同じカード1枚を捨てます（強制）。',
        (id) => inPlay.has(id), (card) => dispatch({ type: 'RAIDER_DISCARD', card }), null, '捨てる');
    }
    if (pd.type === 'imp_play') {
      const cand = DOM.engine.conclaveTargets(state, pd.player);
      return modalSingleHand(p, 'インプ — 手札のアクションを使う', 'あなたの場に同じカードが出ていないアクションカード1枚を使えます（任意）。',
        (id) => cand.indexOf(id) >= 0, (card) => dispatch({ type: 'IMP_PLAY', card }),
        { label: '使わない', on: () => dispatch({ type: 'IMP_PLAY', card: null }) }, '使う', DOM.engine.handPlayable(state, pd.player));
    }
    if (pd.type === 'wish_gain') {
      return modalGainSupply(state, '願い — 手札に獲得', 'コスト6以下のカード1枚を獲得し、手札に加えます。',
        (id) => DOM.engine.costUpTo(state, id, 6), (id) => dispatch({ type: 'WISH_GAIN', card: id }));
    }
    if (pd.type === 'changeling_gain') {
      const cand = [...new Set(p.inPlay.concat(p.durationCards || []))];
      return modalPickIds('取り替え子 — 場のカードのコピーを獲得', '場に出ているカード1枚と同じカードを獲得します（サプライの山に無いカードを選んでも何も得られません）。',
        cand, (id) => dispatch({ type: 'CHANGELING_GAIN', card: id }), '獲得する',
        { label: '獲得しない', on: () => dispatch({ type: 'CHANGELING_GAIN', card: null }) }, state);
    }
    if (pd.type === 'changeling_exchange') {
      const nm = DOM.CARDS[pd.card] ? DOM.CARDS[pd.card].name : '';
      return modalOptions('取り替え子と交換しますか？', '獲得した「' + nm + '」を山に戻して、代わりに取り替え子1枚を捨て札に得られます（交換は獲得ではありません）。', [
        { label: '取り替え子と交換する', cls: 'btn-primary', on: () => dispatch({ type: 'CHANGELING_EXCHANGE', exchange: true }) },
        { label: 'そのままにする', on: () => dispatch({ type: 'CHANGELING_EXCHANGE', exchange: false }) }]);
    }
    if (pd.type === 'bat_trash') {
      return modalMultiHand(p, 'コウモリ — 最大2枚を廃棄', '手札から最大2枚を廃棄します。1枚以上廃棄すると、このコウモリを吸血鬼と交換します。',
        (n) => (n > 0 ? '確定（' + n + '枚 廃棄して吸血鬼と交換）' : '廃棄しない'), true,
        (cards) => dispatch({ type: 'BAT_TRASH', cards }), 2);
    }
    if (pd.type === 'vampire_gain') {
      return modalGainSupply(state, '吸血鬼 — 獲得', 'コスト5以下の（吸血鬼以外の）カード1枚を獲得します。その後、吸血鬼をコウモリと交換します。',
        (id) => DOM.engine.costUpTo(state, id, 5) && id !== 'vampire', (id) => dispatch({ type: 'VAMPIRE_GAIN', card: id }));
    }
    if (pd.type === 'necromancer') {
      const idxs = DOM.engine.necromancerTargets(state);
      const chips = idxs.map((i) => cardEl(state.trash[i], { size: 'sm', extra: 'selectable',
        onClick: () => openPickZoom(state.trash[i], '使用する', () => dispatch({ type: 'NECROMANCER_PLAY', index: i })) }));
      return modalShell('ネクロマンサー — 廃棄置き場から使用', '廃棄置き場にある「表向き・持続でない」アクションカード1枚を、廃棄置き場に置いたまま使用します（このターンは裏向きになります）。', chips, null);
    }
    if (pd.type === 'ghost_play') {
      const nm = DOM.CARDS[pd.card] ? DOM.CARDS[pd.card].name : '';
      return modalOptions('幽霊 — 2度使用する', '脇に置いた「' + nm + '」を2度使用します（強制）。', [
        { label: '「' + nm + '」を2度使用する', cls: 'btn-primary', on: () => dispatch({ type: 'GHOST_PLAY' }) }]);
    }
    if (pd.type === 'zombie_apprentice') {
      return modalSingleHand(p, 'ゾンビの弟子 — アクションを廃棄', '手札のアクションカード1枚を廃棄すると +3カード +1アクション（しなくてもよい）。',
        (id) => DOM.isType(id, 'action'), (card) => dispatch({ type: 'ZOMBIE_APPRENTICE', card }),
        { label: '廃棄しない', on: () => dispatch({ type: 'ZOMBIE_APPRENTICE', card: null }) });
    }
    if (pd.type === 'zombie_mason_gain') {
      return modalGainSupply(state, 'ゾンビの石工 — 獲得', '廃棄したカードより最大1コイン高いカード1枚を獲得できます（しなくてもよい）。',
        (id) => DOM.engine.costUpTo(state, id, pd.coin, { pot: pd.pot || 0, debt: pd.debt || 0 }),
        (id) => dispatch({ type: 'ZOMBIE_MASON_GAIN', card: id }),
        () => dispatch({ type: 'ZOMBIE_MASON_GAIN', card: null }), true);
    }
    if (pd.type === 'zombie_spy') {
      const nm = DOM.CARDS[pd.card] ? DOM.CARDS[pd.card].name : '';
      return modalOptions('ゾンビの密偵 — 山札の一番上', '山札の一番上は「' + nm + '」です。捨てるか、そのまま戻します。', [
        { label: '捨てる', cls: 'btn-primary', on: () => dispatch({ type: 'ZOMBIE_SPY', discard: true }) },
        { label: 'そのまま戻す', on: () => dispatch({ type: 'ZOMBIE_SPY', discard: false }) }]);
    }
    /* ========== 同盟（Allies）A3：Ally カード23種の選択モーダル ==========
       ⚠ **押せる選択肢が必ず1つ以上ある**こと（好意の支払いは常に任意＝「使わない」で必ず閉じられる）。
       ⚠ Ally が起こす攻撃（魔女の輪／すり師団）は堀で防げない＝リアクションの選択肢は出さない。 */
    if (pd.type === 'ally_mountain_folk') {
      return modalOptions('山の民', '好意5 を使うと +3カード（好意 ' + (p.favors || 0) + ' 個）。', [
        { label: '好意5を使う（+3カード）', cls: 'btn-primary', on: () => dispatch({ type: 'ALLY_SIMPLE', ok: true }) },
        { label: '使わない', on: () => dispatch({ type: 'ALLY_SIMPLE', ok: false }) }]);
    }
    if (pd.type === 'ally_desert') {
      return modalOptions('砂漠の案内人', '好意1 を使うと手札をすべて捨てて5枚引きます（好意が続く限り繰り返せますが、'
        + '一度やめると このターンは戻れません）。現在の手札 ' + p.hand.length + '枚 ／ 好意 ' + (p.favors || 0) + ' 個。', [
        { label: '好意1を使う（引き直す）', cls: 'btn-primary', on: () => dispatch({ type: 'ALLY_SIMPLE', ok: true }) },
        { label: 'やめる', on: () => dispatch({ type: 'ALLY_SIMPLE', ok: false }) }]);
    }
    if (pd.type === 'ally_scribes') {
      return modalOptions('写本士の仲間たち', '手札が ' + p.hand.length + '枚（4枚以下）です。好意1 を使うと +1カード。', [
        { label: '好意1を使う（+1カード）', cls: 'btn-primary', on: () => dispatch({ type: 'ALLY_SIMPLE', ok: true }) },
        { label: '使わない', on: () => dispatch({ type: 'ALLY_SIMPLE', ok: false }) }]);
    }
    if (pd.type === 'ally_circle') {
      return modalOptions('魔女の輪', '好意3 を使うと 他のプレイヤー全員が呪い1枚を獲得します（アタックではないので堀で防げません）。', [
        { label: '好意3を使う（全員に呪い）', cls: 'btn-primary', on: () => dispatch({ type: 'ALLY_SIMPLE', ok: true }) },
        { label: '使わない', on: () => dispatch({ type: 'ALLY_SIMPLE', ok: false }) }]);
    }
    if (pd.type === 'ally_island_folk') {
      return modalOptions('島民', '好意5 を使うと このターンの後にもう1回ターンを行えます（3ターン連続にはできません）。', [
        { label: '好意5を使う（追加ターン）', cls: 'btn-primary', on: () => dispatch({ type: 'ALLY_SIMPLE', ok: true }) },
        { label: '使わない', on: () => dispatch({ type: 'ALLY_SIMPLE', ok: false }) }]);
    }
    if (pd.type === 'ally_city_state') {
      const nm = (DOM.CARDS[pd.card] || {}).name || pd.card;
      const wayList = (state.ways || []).filter((w) => (DOM.LANDSCAPES || {})[w]);
      return modalOptions('都市国家', '獲得した「' + nm + '」を、好意2 を使って今すぐ使用できます（アクション権は使いません）。',
        [{ label: '好意2を使う（' + nm + 'を使用）', cls: 'btn-primary', on: () => dispatch({ type: 'ALLY_SIMPLE', ok: true }) }]
          .concat(wayList.map((w) => ({ label: '好意2を使う（「' + DOM.LANDSCAPES[w].name + '」で使用）', on: () => dispatch({ type: 'ALLY_SIMPLE', ok: true, way: w }) })))
          .concat([{ label: '使わない', on: () => dispatch({ type: 'ALLY_SIMPLE', ok: false }) }]));
    }
    if (pd.type === 'ally_trappers') {
      const nm = (DOM.CARDS[pd.card] || {}).name || pd.card;
      return modalOptions('罠師の小屋', '獲得した「' + nm + '」を、好意1 を使って山札の一番上に置けます。', [
        { label: '好意1を使う（山札の上へ）', cls: 'btn-primary', on: () => dispatch({ type: 'ALLY_SIMPLE', ok: true }) },
        { label: '使わない', on: () => dispatch({ type: 'ALLY_SIMPLE', ok: false }) }]);
    }
    if (pd.type === 'ally_forest') {
      return modalOptions('森の居住者', '好意1 を使うと 山札の上3枚を見て、好きな枚数を捨て、残りを好きな順で山札の上に戻せます。', [
        { label: '好意1を使う（上3枚を見る）', cls: 'btn-primary', on: () => dispatch({ type: 'ALLY_SIMPLE', ok: true }) },
        { label: '使わない', on: () => dispatch({ type: 'ALLY_SIMPLE', ok: false }) }]);
    }
    if (pd.type === 'ally_gang') {
      if (pd.stage === 'pay') {
        return modalOptions('すり師団', '好意1 を使わないと 手札が4枚になるように捨てます（今の手札 ' + p.hand.length + '枚）。'
          + 'アタックではないので堀では防げません。', [
          { label: '好意1を使う（捨てない）', cls: 'btn-primary', on: () => dispatch({ type: 'ALLY_GANG', ok: true }) },
          { label: '使わずに捨てる', on: () => dispatch({ type: 'ALLY_GANG', ok: false }) }]);
      }
      const need = Math.max(0, p.hand.length - 4);
      return modalSelectN(p, 'すり師団 — 手札を捨てる', '手札が4枚になるように ' + need + '枚 を選んで捨てます。',
        need, '捨てる', (cards) => dispatch({ type: 'ALLY_GANG', cards }));
    }
    if (pd.type === 'ally_cave') {
      if (p.hand.length === 0) {
        return modalOptions('穴居民', '手札がありません。好意1 を使うと（捨てられなくても）+1カード。', [
          { label: '好意1を使う（+1カード）', cls: 'btn-primary', on: () => dispatch({ type: 'ALLY_CAVE', ok: true, card: null }) },
          { label: 'やめる', on: () => dispatch({ type: 'ALLY_CAVE', ok: false }) }]);
      }
      return modalSingleHand(p, '穴居民 — 1枚捨てて1枚引く',
        '好意1 を使って 手札1枚を捨て、1枚引きます（好意 ' + (p.favors || 0) + ' 個。好きな回数くり返せます）。',
        () => true, (card) => dispatch({ type: 'ALLY_CAVE', ok: true, card }),
        { label: 'やめる', on: () => dispatch({ type: 'ALLY_CAVE', ok: false }) }, '捨てる');
    }
    if (pd.type === 'ally_crafters') {
      return modalGainSupply(state, '工芸家ギルド — 獲得', '好意2 を使って コスト4コイン以下のカード1枚を山札の上に獲得します（しなくてもよい）。',
        (id) => DOM.engine.costUpTo(state, id, 4), (id) => dispatch({ type: 'ALLY_CRAFTERS', card: id }),
        () => dispatch({ type: 'ALLY_CRAFTERS', card: null }), true);
    }
    if (pd.type === 'ally_inventors') {
      const targets = DOM.engine.favorPileTargets(state);
      /* トークンは「山」に置く＝**分割山はプレースホルダ（山の名前）のまま出すのが正しい**。
         一番上の実カードに描き替えると「その1種だけ安くなる」と誤解させる（実際は4種すべてが安くなる）。
         盤面の山は一番上の実カードを描くので、食い違って見えないよう説明文で補う。 */
      return modalPickIds('発明家の家族 — 好意を山に置く',
        '好意1 を 勝利点でないサプライの山1つに置けます（その山のカードは全員に $1 安くなります・戻ってきません）。'
        + '分割山（町民・卜占官など）に置くと、その山の4種すべてが安くなります。',
        targets, (id) => dispatch({ type: 'ALLY_INVENTORS', pile: id }), '置く',
        { label: '置かない', on: () => dispatch({ type: 'ALLY_INVENTORS', pile: null }) }, state);
    }
    if (pd.type === 'ally_market_towns') {
      return modalPlayCardEvent(state, p, '市場の町 — アクションを使う',
        '好意1 を使って 手札のアクションカード1枚を使用できます（アクションフェイズには戻りません＝+アクションは無意味）。'
        + '好意 ' + (p.favors || 0) + ' 個。好きな回数くり返せます。',
        DOM.engine.handPlayable(state, pd.player), (id) => (DOM.isType(id, 'action') || DOM.engine.inheritedEstate(p, id)) && DOM.engine.canPlayHandCard(state, pd.player, id), 'ALLY_MARKET_TOWNS',
        { label: 'やめる', on: () => dispatch({ type: 'ALLY_MARKET_TOWNS', card: null }) });
    }
    if (pd.type === 'ally_peaceful_cult') {
      return modalMultiHand(p, '平和的教団 — 廃棄', '好意1 につき手札1枚を廃棄できます（好意 ' + (p.favors || 0) + ' 個・0枚でもよい）。',
        (n) => (n === 0 ? '廃棄しない' : '好意' + n + 'を使って' + n + '枚を廃棄'), true,
        (cards) => dispatch({ type: 'ALLY_PEACEFUL_CULT', cards }), p.favors || 0);
    }
    if (pd.type === 'ally_woodworkers') {
      if (pd.stage === 'trash') {
        return modalSingleHand(p, '木工ギルド — 廃棄', '好意1 を使って 手札のアクションカード1枚を廃棄できます（廃棄したらアクションカード1枚を獲得）。',
          (id) => DOM.isType(id, 'action') || DOM.engine.inheritedEstate(p, id),
          (card) => dispatch({ type: 'ALLY_WOODWORKERS', card }),
          { label: '使わない', on: () => dispatch({ type: 'ALLY_WOODWORKERS', card: null }) });
      }
      return modalGainSupply(state, '木工ギルド — 獲得', 'アクションカード1枚を獲得します（コストの上限はありません）。',
        (id) => DOM.engine.woodworkersCanGain(state)(id), (id) => dispatch({ type: 'ALLY_WOODWORKERS', card: id }));
    }
    if (pd.type === 'ally_coastal_haven') {
      return modalMultiHand(p, '沿岸の避難港 — 手札を残す',
        '好意1 につき手札1枚を次のターンへ残せます（好意 ' + (p.favors || 0) + ' 個・引く枚数は変わりません）。',
        (n) => (n === 0 ? '残さない' : '好意' + n + 'を使って' + n + '枚を残す'), true,
        (cards) => dispatch({ type: 'ALLY_COASTAL_HAVEN', cards }), p.favors || 0);
    }
    if (pd.type === 'ally_architects') {
      const nm = (DOM.CARDS[pd.card] || {}).name || pd.card;
      return modalGainSupply(state, '建築家ギルド — 獲得',
        '好意2 を使って「' + nm + '」より安い、勝利点でないカード1枚を獲得できます（しなくてもよい）。',
        DOM.engine.architectsCanGain(state, pd.card), (id) => dispatch({ type: 'ALLY_ARCHITECTS', card: id }),
        () => dispatch({ type: 'ALLY_ARCHITECTS', card: null }), true);
    }
    if (pd.type === 'ally_nomads') {
      const nm = (DOM.CARDS[pd.card] || {}).name || pd.card;
      return modalOptions('遊牧民団', '「' + nm + '」（コスト3コイン以上）を獲得しました。好意1 を使って次から1つを選べます。', [
        { label: '+1 カード', cls: 'btn-primary', on: () => dispatch({ type: 'ALLY_NOMADS', choice: 'card' }) },
        { label: '+1 アクション', on: () => dispatch({ type: 'ALLY_NOMADS', choice: 'action' }) },
        { label: '+1 購入', on: () => dispatch({ type: 'ALLY_NOMADS', choice: 'buy' }) },
        { label: '使わない', on: () => dispatch({ type: 'ALLY_NOMADS', choice: null }) }]);
    }
    /* 同盟 A4：循環(Rotate)＝**常に任意**。一番上のカードとその直下の連続同名だけが山の一番下へ回る。
       pd.any（戦闘計画）＝任意のサプライ山／それ以外＝自分の山を名指し（Yes/No）。 */
    if (pd.type === 'rotate_pile') {
      const nameOf = (id) => ((DOM.CARDS[id] || {}).name || id);
      const topsOf = (pileId) => {
        const arr = state[pileId];
        if (!Array.isArray(arr) || !arr.length) return null;
        return { top: arr[0], next: arr.find((c) => c !== arr[0]) || null };
      };
      if (pd.any) {
        const piles = DOM.engine.rotatableSupplyPiles(state);
        return modalPickIds('戦闘計画 — 山を循環させる',
          'サプライの山を1つ循環させられます（一番上のカードと、その下に続く同名のカードが山の一番下へ回ります）。しなくてもよい。',
          piles, (id) => dispatch({ type: 'ROTATE_PILE', pile: id }), '循環させる',
          { label: '循環させない', on: () => dispatch({ type: 'ROTATE_PILE', pile: null }) }, state);
      }
      const tn = topsOf(pd.pile);
      const detail = tn && tn.next
        ? '今の一番上は「' + nameOf(tn.top) + '」です。循環させると「' + nameOf(tn.next) + '」が一番上になります。'
        : '';
      return modalOptions(nameOf(pd.pile) + ' — 山を循環させる',
        '「' + nameOf(pd.pile) + '」の山を循環させられます（しなくてもよい）。' + detail, [
        { label: '循環させる', cls: 'btn-primary', on: () => dispatch({ type: 'ROTATE_PILE', pile: pd.pile }) },
        { label: '循環させない', on: () => dispatch({ type: 'ROTATE_PILE', pile: null }) }]);
    }
    /* ===== 同盟 A4：王国カード49種のモーダル ===== */
    if (pd.type === 'bauble_choose') {
      const OPTS = [{ k: 'buy', label: '+1 購入' }, { k: 'coin', label: '+1 コイン' },
        { k: 'favor', label: '+1 好意' }, { k: 'topdeck', label: 'このターン、獲得したカードを山札の上に置いてよい' }];
      pruneSelection(OPTS.length);
      const chips = OPTS.map((o, idx) => {
        const pos = UI.selection.indexOf(idx);
        return h('button', { class: 'btn btn-block ' + (pos >= 0 ? 'btn-primary' : ''), style: 'margin-bottom:6px',
          onclick: () => { const i = UI.selection.indexOf(idx); if (i >= 0) UI.selection.splice(i, 1); else if (UI.selection.length < 2) UI.selection.push(idx); render(); } },
        (pos >= 0 ? '✓ ' : '') + o.label);
      });
      const ready = UI.selection.length === 2;
      const footer = h('button', { class: 'btn btn-primary btn-block', disabled: ready ? null : 'disabled',
        onclick: () => dispatch({ type: 'BAUBLE_CHOOSE', picks: takeSelection(OPTS).map((o) => o.k) }) },
      ready ? '確定' : ('あと ' + (2 - UI.selection.length) + ' つ選ぶ'));
      return modalShell('道化棒 — 異なる2つを選ぶ', '4つのうち異なる2つを選びます（先に2つ選んでから解決します）。', chips, footer);
    }
    if (pd.type === 'contract_setaside') {
      return modalSingleHand(p, '契約書 — 脇に置く',
        '手札のアクションカード1枚を脇に置けます（次のターンの開始時に使用します）。しなくてもよい。',
        (id) => DOM.isType(id, 'action') || DOM.engine.inheritedEstate(p, id),
        (card) => dispatch({ type: 'CONTRACT_SETASIDE', card }),
        { label: '脇に置かない', on: () => dispatch({ type: 'CONTRACT_SETASIDE', card: null }) }, '脇に置く');
    }
    if (pd.type === 'contract_play') {
      const nm = ((DOM.CARDS[(p.contractSetAside || [])[0]] || {}).name || '');
      const wayList = (state.ways || []).filter((w) => (DOM.LANDSCAPES || {})[w]);
      return modalOptions('契約書 — 脇札を使用', '契約書で脇に置いた「' + nm + '」を使用します（アクション権は使いません）。',
        [{ label: '使用する', cls: 'btn-primary', on: () => dispatch({ type: 'CONTRACT_PLAY' }) }]
          .concat(wayList.map((w) => ({ label: '「' + DOM.LANDSCAPES[w].name + '」で使用する', on: () => dispatch({ type: 'CONTRACT_PLAY', way: w }) }))));
    }
    if (pd.type === 'importer_gain') {
      return modalGainSupply(state, '輸入者 — 獲得', 'コスト5コイン以下のカード1枚を獲得します。',
        (id) => DOM.engine.costUpTo(state, id, 5), (id) => dispatch({ type: 'IMPORTER_GAIN', card: id }));
    }
    if (pd.type === 'broker_trash') {
      return modalSingleHand(p, '仲買人 — 廃棄', '手札から1枚を廃棄します（その後、そのコスト$1につき1つを選びます）。',
        () => true, (card) => dispatch({ type: 'BROKER_TRASH', card }));
    }
    if (pd.type === 'broker_choose') {
      const n = pd.n || 0;
      return modalChoice(pd, '仲買人', 'BROKER_CHOOSE',
        [{ k: 'cards', label: '+' + n + ' カード' }, { k: 'actions', label: '+' + n + ' アクション' },
          { k: 'coins', label: '+' + n + ' コイン' }, { k: 'favors', label: '+' + n + ' 好意' }],
        '廃棄したカードのコストは $' + n + ' でした。');
    }
    if (pd.type === 'student_trash') {
      return modalSingleHand(p, '生徒 — 廃棄', '手札から1枚を廃棄します（財宝なら +1 好意、そして生徒を山札の一番上に置きます）。',
        () => true, (card) => dispatch({ type: 'STUDENT_TRASH', card }));
    }
    if (pd.type === 'town_crier_choose') return modalChoice(pd, '触れ役', 'TOWN_CRIER_CHOOSE',
      [{ k: 'coins', label: '+2 コイン' }, { k: 'silver', label: '銀貨1枚を獲得' },
        { k: 'cantrip', label: '+1 カード と +1 アクション' }], 'その後、町民の山を循環させるか選べます。');
    if (pd.type === 'herb_gatherer_play') {
      const names = [];
      (p.discard || []).forEach((c) => { if (DOM.engine.isTreasureFor(state, c) && names.indexOf(c) < 0) names.push(c); });
      return modalPickIds('薬草集め — 捨て札から財宝を使う', '捨て札置き場から財宝カード1枚を使用できます（しなくてもよい）。',
        names, (id) => dispatch({ type: 'HERB_GATHERER_PLAY', card: id }), '使う',
        { label: '使わない', on: () => dispatch({ type: 'HERB_GATHERER_PLAY', card: null }) });
    }
    if (pd.type === 'old_map_discard') {
      return modalSingleHand(p, '古地図 — 捨てる', '手札から1枚を捨てます（その後 +1 カード）。',
        () => true, (card) => dispatch({ type: 'OLD_MAP_DISCARD', card }), null, '捨てる');
    }
    if (pd.type === 'battle_plan_reveal') {
      return modalSingleHand(p, '戦闘計画 — アタックを公開', '手札のアタックカード1枚を公開すると +1 カード（しなくてもよい）。',
        (id) => DOM.isType(id, 'attack'), (card) => dispatch({ type: 'BATTLE_PLAN_REVEAL', card }),
        { label: '公開しない', on: () => dispatch({ type: 'BATTLE_PLAN_REVEAL', card: null }) }, '公開する');
    }
    if (pd.type === 'town_choose') return modalChoice(pd, '町', 'TOWN_CHOOSE',
      [{ k: 'cards', label: '+1 カード と +2 アクション' }, { k: 'coins', label: '+1 購入 と +2 コイン' }]);
    if (pd.type === 'blacksmith_choose') return modalChoice(pd, '蹄鉄工', 'BLACKSMITH_CHOOSE',
      [{ k: 'six', label: '手札が6枚になるまで引く（今 ' + p.hand.length + '枚）' },
        { k: 'two', label: '+2 カード' }, { k: 'cantrip', label: '+1 カード と +1 アクション' }]);
    /* ===== 同盟 A4：残り5種のモーダル ===== */
    if (pd.type === 'sentinel' && pd.stage === 'trash') {
      pruneSelection(pd.cards.length);
      const chips = pd.cards.map((id, idx) => {
        const pos = UI.selection.indexOf(idx);
        return cardEl(id, { size: 'sm', extra: pos >= 0 ? 'selected' : 'selectable',
          onClick: () => { const i = UI.selection.indexOf(idx); if (i >= 0) UI.selection.splice(i, 1); else if (UI.selection.length < 2) UI.selection.push(idx); render(); } });
      });
      const k = UI.selection.length;
      const footer = h('button', { class: 'btn btn-primary btn-block',
        onclick: () => dispatch({ type: 'SENTINEL_TRASH', cards: takeSelection(pd.cards) }) },
      k === 0 ? '廃棄しない' : (k + '枚 廃棄する'));
      return modalShell('歩哨 — 廃棄（最大2枚）', '山札の上から見た ' + pd.cards.length + '枚 から、最大2枚まで廃棄できます（残りは好きな順で山札の上に戻します）。', chips, footer);
    }
    if (pd.type === 'sentinel' && pd.stage === 'order') {
      return modalReorder('歩哨 — 山札の上に戻す', '山札の上に戻す順番をタップで選びます（最初にタップ＝一番上）。',
        pd.cards, (order) => dispatch({ type: 'SENTINEL_ORDER', order }));
    }
    if (pd.type === 'carpenter_gain') {
      return modalGainSupply(state, '大工 — 獲得', '空のサプライの山が1つもないので、コスト4コイン以下のカード1枚を獲得します。',
        (id) => DOM.engine.costUpTo(state, id, 4), (id) => dispatch({ type: 'CARPENTER_GAIN', card: id }));
    }
    if (pd.type === 'carpenter_trash') {
      return modalSingleHand(p, '大工 — 廃棄', '空のサプライの山があるので、手札から1枚を廃棄し、それよりコストが最大2コイン高いカードを獲得します。',
        () => true, (card) => dispatch({ type: 'CARPENTER_TRASH', card }));
    }
    if (pd.type === 'carpenter_upgrade') {
      return modalGainSupply(state, '大工 — 獲得', '廃棄したカードよりコストが最大2コイン高いカード1枚を獲得します。',
        DOM.engine.modifyCanGain(state, pd), (id) => dispatch({ type: 'CARPENTER_UPGRADE', card: id }));
    }
    if (pd.type === 'courier_play') {
      const names = [];
      (p.discard || []).forEach((c) => {
        if ((DOM.isType(c, 'action') || DOM.engine.isTreasureFor(state, c)) && names.indexOf(c) < 0) names.push(c);
      });
      return modalPickIds('急使 — 捨て札から使う', '捨て札置き場からアクションカード1枚または財宝カード1枚を使用できます（しなくてもよい）。',
        names, (id) => dispatch({ type: 'COURIER_PLAY', card: id }), '使う',
        { label: '使わない', on: () => dispatch({ type: 'COURIER_PLAY', card: null }) });
    }
    if (pd.type === 'swap_return') {
      return modalSingleHand(p, '交換 — 山に戻す',
        '手札のアクションカード1枚をその山に戻せます（廃棄ではありません）。戻したら、コスト5コイン以下で名前の異なるアクションカード1枚を手札に獲得します。しなくてもよい。',
        (id) => DOM.isType(id, 'action') && DOM.engine.canReturnToPile(state, id),
        (card) => dispatch({ type: 'SWAP_RETURN', card }),
        { label: '戻さない', on: () => dispatch({ type: 'SWAP_RETURN', card: null }) }, '山に戻す');
    }
    if (pd.type === 'swap_gain') {
      const nm = ((DOM.CARDS[pd.returned] || {}).name || pd.returned);
      return modalGainSupply(state, '交換 — 獲得', '「' + nm + '」とは名前の異なる、コスト5コイン以下のアクションカード1枚を手札に獲得します。',
        DOM.engine.swapCanGain(state, pd.returned), (id) => dispatch({ type: 'SWAP_GAIN', card: id }));
    }
    if (pd.type === 'acolyte_trash') {
      return modalSingleHand(p, '侍祭 — 廃棄（任意）', '手札のアクションカードまたは勝利点カード1枚を廃棄できます（廃棄したら金貨1枚を獲得）。',
        (id) => DOM.isType(id, 'action') || DOM.isType(id, 'victory'),
        (card) => dispatch({ type: 'ACOLYTE_TRASH', card }),
        { label: '廃棄しない', on: () => dispatch({ type: 'ACOLYTE_TRASH', card: null }) });
    }
    if (pd.type === 'acolyte_self') {
      const top = (state.augurs || [])[0];
      const nm = top ? ((DOM.CARDS[top] || {}).name || top) : null;
      return modalOptions('侍祭 — これを廃棄する？',
        '侍祭自身を廃棄すると、卜占官の山の一番上を1枚獲得できます' + (nm ? '（廃棄後の一番上：' + nm + '）' : '（山が空です）') + '。', [
        { label: '侍祭を廃棄して卜占官を獲得', cls: 'btn-primary', on: () => dispatch({ type: 'ACOLYTE_SELF', ok: true }) },
        { label: '廃棄しない', on: () => dispatch({ type: 'ACOLYTE_SELF', ok: false }) }]);
    }
    /* ===== 同盟 A4：アタック7種のモーダル ===== */
    if (pd.type === 'barbarian' && pd.stage === 'react') {
      return modalOptions('蛮族を受ける', '山札の一番上が廃棄されます（コスト$3以上なら種別を共有するより安いカードを獲得、そうでなければ呪い）。',
        reactOptions(p, pd, { type: 'BARBARIAN_REACT' }));
    }
    if (pd.type === 'barbarian' && pd.stage === 'gain') {
      const nm = ((DOM.CARDS[pd.trashed] || {}).name || pd.trashed);
      return modalGainSupply(state, '蛮族 — 獲得', '廃棄した「' + nm + '」と種別を1つ以上共有し、それより安いカード1枚を獲得します。',
        DOM.engine.barbarianCanGain(state, pd.trashed), (id) => dispatch({ type: 'BARBARIAN_GAIN', card: id }));
    }
    if (pd.type === 'archer' && pd.stage === 'react') {
      return modalOptions('射手を受ける', '1枚を除いて手札を公開し、相手が選んだ1枚を捨てます。', reactOptions(p, pd, { type: 'ARCHER_REACT' }));
    }
    if (pd.type === 'archer' && pd.stage === 'hide') {
      return modalSingleHand(p, '射手 — 公開しない1枚を選ぶ',
        '手札から1枚を選ぶと、その1枚だけ公開せずに済みます（残りは公開され、相手がその中から1枚を選んで捨てさせます）。',
        () => true, (card) => dispatch({ type: 'ARCHER_HIDE', card }), null, '隠す');
    }
    if (pd.type === 'archer' && pd.stage === 'pick') {
      return modalPickIds('射手 — 捨てさせる1枚',
        state.players[pd.victim].name + ' が公開したカードから1枚を選んで捨てさせます。',
        pd.revealed, (id) => dispatch({ type: 'ARCHER_PICK', card: id }), '捨てさせる');
    }
    if (pd.type === 'sorceress' && pd.stage === 'name') {
      return modalNameCard(state, '女魔導士 — カード名を宣言', 'カード名を1つ宣言します。あなたの山札の一番上を公開して手札に加え、それが宣言したカードなら他のプレイヤー全員が呪いを獲得します。',
        (id) => dispatch({ type: 'SORCERESS_NAME', card: id }));
    }
    if (pd.type === 'sorceress' && pd.stage === 'react') {
      return modalOptions('女魔導士を受ける', '呪い1枚を獲得します。', reactOptions(p, pd, { type: 'SORCERESS_REACT' }));
    }
    if (pd.type === 'sorcerer' && pd.stage === 'react') {
      return modalOptions('魔導士を受ける', 'カード名を宣言してから山札の一番上を公開します（外れなら呪いを獲得）。',
        reactOptions(p, pd, { type: 'SORCERER_REACT' }));
    }
    if (pd.type === 'sorcerer' && pd.stage === 'name') {
      return modalNameCard(state, '魔導士 — カード名を宣言', 'カード名を1つ宣言してから、あなたの山札の一番上を公開します。宣言と違えば呪い1枚を獲得します（公開したカードは山札の上に戻します）。',
        (id) => dispatch({ type: 'SORCERER_NAME', card: id }));
    }
    if (pd.type === 'skirmisher' && pd.stage === 'react') {
      return modalOptions('散兵を受ける', 'このターン、相手がアタックカードを獲得するたびに手札3枚になるように捨てます（今は何も起きません）。',
        reactOptions(p, pd, { type: 'SKIRMISHER_REACT' }));
    }
    // 追いはぎ／将軍＝「相手のターンをフックする持続アタック」（呪いの森／沼の妖婆と同じ受理経路）。
    if (pd.type === 'highwayman' && pd.stage === 'react') {
      return modalOptions('追いはぎを受ける', '相手の次の手番まで、あなたが各ターンに最初に使用する財宝は何もしなくなります（堀を公開すればこの持続から免疫）。',
        reactOptions(p, pd, { type: 'LINGER_REACT' }));
    }
    if (pd.type === 'warlord' && pd.stage === 'react') {
      return modalOptions('将軍を受ける', '相手の次の手番まで、あなたは「場に2枚以上ある同名のアクションカード」を手札から使用できなくなります（堀を公開すればこの持続から免疫）。',
        reactOptions(p, pd, { type: 'LINGER_REACT' }));
    }
    if (pd.type === 'royal_galley_play') {
      return modalPlayCardEvent(state, p, '王家のガレー船 — カードを使う',
        '手札の**持続でない**アクションカード1枚を使用できます（脇に置き、次のターンの開始時にもう一度使用します）。しなくてもよい。',
        DOM.engine.handPlayable(state, pd.player), (id) => (DOM.isType(id, 'action') || DOM.engine.inheritedEstate(p, id)) && !DOM.isType(id, 'duration') && DOM.engine.canPlayHandCard(state, pd.player, id),
        'ROYAL_GALLEY_PLAY', { label: '使わない', on: () => dispatch({ type: 'ROYAL_GALLEY_PLAY', card: null }) });
    }
    if (pd.type === 'conjurer_gain') {
      return modalGainSupply(state, '霊術師 — 獲得', 'コスト4コイン以下のカード1枚を獲得します。',
        (id) => DOM.engine.costUpTo(state, id, 4), (id) => dispatch({ type: 'CONJURER_GAIN', card: id }));
    }
    if (pd.type === 'specialist_play') {
      return modalPlayCardEvent(state, p, '専門家 — カードを使う',
        '手札のアクションカードまたは財宝カード1枚を使用できます（その後、もう一度使うか同じカードを獲得するかを選びます）。しなくてもよい。',
        DOM.engine.handPlayable(state, pd.player), (id) => DOM.isType(id, 'action') || DOM.engine.isTreasureFor(state, id) || DOM.engine.inheritedEstate(p, id),
        'SPECIALIST_PLAY', { label: '使わない', on: () => dispatch({ type: 'SPECIALIST_PLAY', card: null }) });
    }
    if (pd.type === 'specialist_choose') {
      const nm = ((DOM.CARDS[pd.card] || {}).name || pd.card);
      /* 「同じカード1枚を獲得する」は**サプライからのみ**＝闇市場で買った札・非サプライ札・山が空のときは獲得できない。
         公式は「遂行できない選択肢も選べる」（§0-21 の探索と同じ）ので選択肢は消さず、
         押しても何も起きないことを**ラベルで明示**して事故（もう一度使う権利を無駄にする）を防ぐ。 */
      const canCopy = DOM.engine.gainableBase(state, pd.card) || !!DOM.engine.mixedPileWithTop(state, pd.card);
      return modalChoice(pd, '専門家', 'SPECIALIST_CHOOSE',
        [{ k: 'again', label: '「' + nm + '」をもう一度使う' },
          { k: 'copy', label: '「' + nm + '」1枚を獲得する' + (canCopy ? '' : '（サプライに山が無いので獲得できません）') }]);
    }
    if (pd.type === 'elder_play') {
      return modalPlayCardEvent(state, p, '長老 — アクションを使う',
        '手札のアクションカード1枚を使用できます（アクション権は使いません）。そのカードが「次から1つを選ぶ」なら、追加で異なるもの1つも選べます。しなくてもよい。',
        DOM.engine.handPlayable(state, pd.player), (id) => (DOM.isType(id, 'action') || DOM.engine.inheritedEstate(p, id)) && DOM.engine.canPlayHandCard(state, pd.player, id),
        'ELDER_PLAY', { label: '使わない', on: () => dispatch({ type: 'ELDER_PLAY', card: null }) });
    }
    if (pd.type === 'modify_trash') {
      return modalSingleHand(p, '改造 — 廃棄', '手札から1枚を廃棄します（その後、キャントリップか格上げ獲得を選びます）。',
        () => true, (card) => dispatch({ type: 'MODIFY_TRASH', card }));
    }
    if (pd.type === 'modify_choose') {
      return modalChoice(pd, '改造', 'MODIFY_CHOOSE',
        [{ k: 'cantrip', label: '+1 カード と +1 アクション' },
          { k: 'gain', label: (pd.noTrash ? '獲得する（廃棄していないので何も得られません）' : '廃棄したカードより最大2コイン高いカード1枚を獲得する') }]);
    }
    if (pd.type === 'modify_gain') {
      return modalGainSupply(state, '改造 — 獲得', '廃棄したカードよりコストが最大2コイン高いカード1枚を獲得します。',
        DOM.engine.modifyCanGain(state, pd), (id) => dispatch({ type: 'MODIFY_GAIN', card: id }));
    }
    if (pd.type === 'lich_gain') {
      /* 候補ゼロで開くことがある（1回の蛮族で2人以上がリッチを廃棄し、先の1人が廃棄置き場の安い札を取り切った）。
         獲得は「可能なら強制」なので、そのときだけ閉じるボタンを出す（engine 側にも終端保証がある）。 */
      const lichCands = DOM.engine.lichTrashTargets(state);
      return modalPickIds('リッチ — 廃棄置き場から獲得', 'リッチよりコストの低いカード1枚を廃棄置き場から獲得します。',
        lichCands, (id) => dispatch({ type: 'LICH_GAIN', card: id }), '獲得する',
        lichCands.length ? null : { label: '獲得できるカードがない（閉じる）', on: () => dispatch({ type: 'LICH_GAIN', card: null }) });
    }
    if (pd.type === 'miller_pick') {
      return modalPickIds('粉屋 — 手札に加える', '山札の上から見た ' + pd.cards.length + '枚 から1枚を手札に加えます（残りは捨てます）。',
        pd.cards, (id) => dispatch({ type: 'MILLER_PICK', card: id }), '手札に加える');
    }
    if (pd.type === 'marquis_discard') {
      const need = Math.max(0, p.hand.length - 10);
      return modalSelectN(p, '侯爵 — 手札を捨てる', '手札が10枚になるように ' + need + '枚 を選んで捨てます。',
        need, '捨てる', (cards) => dispatch({ type: 'MARQUIS_DISCARD', cards }));
    }
    if (pd.type === 'sycophant_discard') {
      const need = Math.min(3, p.hand.length);
      return modalSelectN(p, 'ごますり — 手札を捨てる', 'カード ' + need + '枚 を選んで捨てます（1枚以上捨てれば +3 コイン）。',
        need, '捨てる', (cards) => dispatch({ type: 'SYCOPHANT_DISCARD', cards }));
    }
    if (pd.type === 'sibyl_place') {
      return modalSingleHand(p, '女予言者 — ' + (pd.stage === 'top' ? '山札の一番上へ' : '山札の一番下へ'),
        pd.stage === 'top' ? '手札から1枚を山札の一番上に置きます。' : 'もう1枚を山札の一番下に置きます。',
        () => true, (card) => dispatch({ type: 'SIBYL_PLACE', card }), null,
        pd.stage === 'top' ? '一番上へ' : '一番下へ');
    }
    if (pd.type === 'capital_city') {
      if (pd.stage === 'discard') {
        const need = Math.min(2, p.hand.length);
        if (need === 0) return modalOptions('首都', '手札がありません（2枚捨てられないので +2 コインは得られません）。', [
          { label: '次へ', cls: 'btn-primary', on: () => dispatch({ type: 'CAPITAL_CITY', ok: false }) }]);
        return modalSelectN(p, '首都 — 2枚捨てて +2 コイン',
          'カード ' + need + '枚 を捨てると +2 コイン' + (need < 2 ? '（2枚ちょうど捨てないとコインは得られません）' : '') + '。しなくてもよい。',
          need, '捨てる（+2 コイン）', (cards) => dispatch({ type: 'CAPITAL_CITY', ok: true, cards }),
          { label: '捨てない', on: () => dispatch({ type: 'CAPITAL_CITY', ok: false }) });
      }
      return modalOptions('首都 — 2コインを払って +2 カード', '2 コインを払うと +2 カード（今のコイン ' + (state.turn.coins || 0) + '）。しなくてもよい。', [
        { label: '2 コインを払う（+2 カード）', cls: 'btn-primary', on: () => dispatch({ type: 'CAPITAL_CITY', ok: true }) },
        { label: '払わない', on: () => dispatch({ type: 'CAPITAL_CITY', ok: false }) }]);
    }
    if (pd.type === 'innkeeper_choose') return modalChoice(pd, '宿屋の主人', 'INNKEEPER_CHOOSE',
      [{ k: 'one', label: '+1 カード' }, { k: 'three', label: '+3 カード、その後 3枚 捨てる' },
        { k: 'five', label: '+5 カード、その後 6枚 捨てる' }], '引く前に選びます。');
    if (pd.type === 'innkeeper_discard') {
      const need = Math.min(pd.n, p.hand.length);
      return modalSelectN(p, '宿屋の主人 — 手札を捨てる', 'カード ' + need + '枚 を選んで捨てます。',
        need, '捨てる', (cards) => dispatch({ type: 'INNKEEPER_DISCARD', cards }));
    }
    if (pd.type === 'hunter_pick') {
      const label = pd.stage === 'action' ? 'アクション' : (pd.stage === 'treasure' ? '財宝' : '勝利点');
      const cands = pd.cards.filter((c) => (pd.stage === 'treasure'
        ? DOM.engine.isTreasureFor(state, c) : DOM.isType(c, pd.stage)));
      return modalPickIds('狩人 — ' + label + 'カードを手札に', '公開したカードから ' + label + 'カード1枚を手札に加えます（アクション→財宝→勝利点 の順）。',
        cands, (id) => dispatch({ type: 'HUNTER_PICK', card: id }), '手札に加える');
    }
    if (pd.type === 'stronghold_choose') return modalChoice(pd, '要塞', 'STRONGHOLD_CHOOSE',
      [{ k: 'coins', label: '+3 コイン' }, { k: 'cards', label: '次のターンの開始時に +3 カード' }]);
    if (pd.type === 'hill_fort_gain') {
      return modalGainSupply(state, '堡塁 — 獲得', 'コスト4コイン以下のカード1枚を獲得します。',
        (id) => DOM.engine.costUpTo(state, id, 4), (id) => dispatch({ type: 'HILL_FORT_GAIN', card: id }));
    }
    if (pd.type === 'hill_fort_choose') {
      const nm = pd.card ? ((DOM.CARDS[pd.card] || {}).name || pd.card) : null;
      return modalChoice(pd, '堡塁', 'HILL_FORT_CHOOSE',
        [{ k: 'hand', label: nm ? '「' + nm + '」を手札に加える' : '獲得したカードを手札に加える（獲得できていません）' },
          { k: 'cantrip', label: '+1 カード と +1 アクション' }]);
    }
    if (pd.type === 'allies_topdeck') {
      const names = pd.cards.map((c) => (DOM.CARDS[c] || {}).name || c);
      return modalPickSubset('山札の上に置く', '場から捨てる代わりに、山札の一番上に置けます（' + names.join('・') + '）。しなくてもよい。',
        pd.cards, (cards) => dispatch({ type: 'ALLIES_TOPDECK', cards }), '置く');
    }
    if (pd.type === 'sunken_treasure') {
      return modalGainSupply(state, '沈没船の財宝 — 獲得', 'あなたの場に同じカードが無いアクションカード1枚を獲得します（コストの上限はありません）。',
        DOM.engine.sunkenTreasureCanGain(state, pd.player), (id) => dispatch({ type: 'SUNKEN_TREASURE_GAIN', card: id }));
    }
    if (pd.type === 'attack_window' && pd.stage === 'react') {
      return modalOptions('アタックを受ける', '相手がアタックカードを使いました（このアタック自体はあなたに何もしませんが、リアクションは使えます）。',
        reactOptions(p, pd, { type: 'ATTACK_WINDOW_REACT' }));
    }
    if (pd.type === 'idol' && pd.stage === 'react') {
      return modalOptions('偶像を受ける', '呪い1枚を獲得します。', reactOptions(p, pd, { type: 'IDOL_REACT' }));
    }
    if (pd.type === 'lost_in_the_woods') {
      return modalSingleHand(p, '森の迷子 — 捨てて祝福', '手札1枚を捨てると祝福を1つ受けられます（しなくてもよい）。', () => true,
        (card) => dispatch({ type: 'LOST_IN_WOODS', card }),
        { label: '何もしない', on: () => dispatch({ type: 'LOST_IN_WOODS', card: null }) }, '捨てる');
    }
    if (pd.type === 'nobles') return modalOptions('貴族', '次から1つを選びます。', [
      { label: '+3 カード', on: () => dispatch({ type: 'NOBLES_RESOLVE', choice: 'cards' }) },
      { label: '+2 アクション', on: () => dispatch({ type: 'NOBLES_RESOLVE', choice: 'actions' }) },
    ]);
    if (pd.type === 'torturer') return modalTorturer(p, p.hand.includes('secret_chamber') && !pd.reacted, canDiplomatReact(p, pd));
    if (pd.type === 'trading_post') return modalTrashHand(p, '交易場 — 廃棄', '手札から2枚を選んで廃棄します（2枚廃棄できたら銀貨を手札に獲得）。', Math.min(2, p.hand.length), (cards) => dispatch({ type: 'TRADING_POST_RESOLVE', cards }));
    if (pd.type === 'upgrade' && pd.stage === 'trash') return modalSingleHand(p, '改良 — 廃棄', '手札から1枚を廃棄します（その後、ちょうど1コイン高いカードを獲得）。', () => true, (card) => dispatch({ type: 'UPGRADE_TRASH', card }));
    if (pd.type === 'upgrade' && pd.stage === 'gain') return modalGainSupply(state, '改良 — 獲得', '廃棄したカードよりちょうど1コイン高いカードを1枚獲得します。', (id) => canExact(state, id, pd.exactCost, pd.pot, pd.debt), (id) => dispatch({ type: 'UPGRADE_GAIN', card: id }));
    if (pd.type === 'scout') return modalReorder('斥候 — 山札の上に戻す', '山札の上に戻す順番をタップで選びます（最初にタップ＝一番上）。', pd.cards, (order) => dispatch({ type: 'SCOUT_RESOLVE', order }));
    if (pd.type === 'swindler' && pd.stage === 'react') return modalOptions('詐欺師を受ける', '山札の上1枚が廃棄され、相手が選んだ同コストのカードに置き換わります。', reactOptions(p, pd, { type: 'SWINDLER_REACT' }));
    if (pd.type === 'swindler' && pd.stage === 'gain') return modalGainSupply(state, '詐欺師 — 相手に与える', state.players[pd.victim].name + ' に コスト ' + pd.cost + ' のカードを与えます。', (id) => canExact(state, id, pd.cost, pd.pot, pd.debt), (id) => dispatch({ type: 'SWINDLER_GAIN', card: id }));
    if (pd.type === 'saboteur' && pd.stage === 'react') return modalOptions('破壊工作員を受ける', 'コスト3以上のカードが1枚廃棄されます。', reactOptions(p, pd, { type: 'SABOTEUR_REACT' }));
    if (pd.type === 'saboteur' && pd.stage === 'gain') return modalGainSupply(state, '破壊工作員 — 獲得（任意）', 'コスト ' + pd.maxCost + ' 以下のカードを1枚獲得できます（しなくてもよい）。', (id) => canUpTo(state, id, pd.maxCost, pd), (id) => dispatch({ type: 'SABOTEUR_GAIN', card: id }), () => dispatch({ type: 'SABOTEUR_GAIN', card: null }), true);
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
    if (pd.type === 'feast') return modalGainSupply(state, '祝宴 — 獲得', 'コスト5以下のカードを1枚獲得します。', (id) => canUpTo(state, id, 5), (id) => dispatch({ type: 'FEAST_GAIN', card: id }), () => dispatch({ type: 'FEAST_GAIN', card: null }));
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
    // 同盟：航海の3枚制限／将軍で使えない札は候補に出さない（engine が拒否する死に選択肢を作らない）＋辞退できる。
    if (pd.type === 'throne') return modalSingleHand(p, '玉座の間 — 2回使うアクションを選ぶ', '手札のアクションカードを1枚選ぶと、それを2回使います。', (id) => DOM.isType(id, 'action') && DOM.engine.canPlayHandCard(state, pd.player, id), (card) => dispatch({ type: 'THRONE_CHOOSE', card }), { label: '使わない', on: () => dispatch({ type: 'THRONE_CHOOSE', card: null }) }, '2回使う', DOM.engine.handPlayable(state, pd.player));
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
    if (pd.type === 'artisan' && pd.stage === 'gain') return modalGainSupply(state, '職人 — 獲得', 'コスト5以下のカードを手札に獲得します。', (id) => canUpTo(state, id, 5), (id) => dispatch({ type: 'ARTISAN_GAIN', card: id }));
    if (pd.type === 'artisan' && pd.stage === 'put') return modalSingleHand(p, '職人 — 山札の上に置く', '手札から1枚を選び、山札の上に置きます。', () => true, (card) => dispatch({ type: 'ARTISAN_PUT', card }), null, '山札の上に置く');

    /* ===== 陰謀 第二版 ===== */
    if (pd.type === 'courtier' && pd.stage === 'reveal') return modalSingleHand(p, '廷臣 — 公開', '公開するカードを1枚選びます（持つ種類の数だけ効果を選べます）。', () => true, (card) => dispatch({ type: 'COURTIER_REVEAL', card }), null, '公開する');
    if (pd.type === 'courtier' && pd.stage === 'choose') return modalChooseN('廷臣 — 効果を選ぶ', '「' + DOM.CARDS[pd.card].name + '」の種類数 = ' + pd.n + ' 個を選びます。', COURTIER_OPTS, pd.n, (choices) => dispatch({ type: 'COURTIER_CHOOSE', choices }));
    if (pd.type === 'lurker' && pd.stage === 'choose') return modalOptions('待ち伏せ', '次から1つを選びます。', [
      { label: 'サプライのアクションを廃棄', on: () => dispatch({ type: 'LURKER_CHOOSE', choice: 'trash' }) },
      { label: '廃棄置き場からアクションを獲得', on: () => dispatch({ type: 'LURKER_CHOOSE', choice: 'gain' }) }]);
    if (pd.type === 'lurker' && pd.stage === 'trash') return modalGainSupply(state, '待ち伏せ — 廃棄', 'サプライのアクションカード1枚を廃棄します。', (id) => canBase(state, id) && isTypeSup(state, id, 'action'), (id) => dispatch({ type: 'LURKER_TRASH', card: id }), null, false, '廃棄する');
    if (pd.type === 'lurker' && pd.stage === 'gain') return modalPickList(state, '待ち伏せ — 獲得', '廃棄置き場からアクションカード1枚を獲得します。', state.trash.filter((id) => DOM.CARDS[id].types.includes('action')), '獲得する', (id) => dispatch({ type: 'LURKER_GAIN', card: id }));
    if (pd.type === 'mill') return modalMill(p, (cards) => dispatch({ type: 'MILL_RESOLVE', cards }));
    if (pd.type === 'patrol') return modalReorder('パトロール — 山札の上に戻す', '山札の上に戻す順番をタップで選びます（最初が一番上）。', pd.cards, (order) => dispatch({ type: 'PATROL_RESOLVE', order }));
    if (pd.type === 'replace' && pd.stage === 'react') return modalOptions('身代わりを受ける', '相手が勝利点を獲得した場合、呪いを受けます。', reactOptions(p, pd, { type: 'REPLACE_REACT' }));
    if (pd.type === 'replace' && pd.stage === 'trash') return modalSingleHand(p, '身代わり — 廃棄', '廃棄するカードを1枚選びます（その後、最大$2高いカードを獲得）。', () => true, (card) => dispatch({ type: 'REPLACE_TRASH', card }));
    if (pd.type === 'replace' && pd.stage === 'gain') return modalGainSupply(state, '身代わり — 獲得', '廃棄したカードより最大$2高いカードを1枚獲得します。', (id) => canUpTo(state, id, pd.maxCost, pd), (id) => dispatch({ type: 'REPLACE_GAIN', card: id }));
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
    if (pd.type === 'governor_remodel' && pd.stage === 'gain') return modalGainSupply(state, '総督 — 獲得', 'ちょうどコスト ' + pd.exact + ' のカードを獲得します。', (id) => canExact(state, id, pd.exact, pd.pot, pd.debt), (id) => dispatch({ type: 'GOVERNOR_REMODEL_GAIN', card: id }));
    if (pd.type === 'dismantle' && pd.stage === 'trash') return modalSingleHand(p, '取り壊し — 廃棄', '廃棄するカードを1枚選びます（$1以上なら 安いカード＋金貨を獲得）。', () => true, (card) => dispatch({ type: 'DISMANTLE_TRASH', card }));
    if (pd.type === 'dismantle' && pd.stage === 'gain') return modalGainSupply(state, '取り壊し — 獲得', '廃棄したカードより安いカードを1枚獲得します。',
      (id) => canUnder(state, id, (pd.coin != null ? pd.coin : (pd.maxCost || 0) + 1), pd), (id) => dispatch({ type: 'DISMANTLE_GAIN', card: id }));
    if (pd.type === 'black_market') return modalBlackMarket(state, pd, p);
    /* ===== 新プロモ（王子/船長/教会/サウナ/アヴァント）===== */
    if (pd.type === 'prince') return modalSingleHand(p, '王子 — 脇に置く',
      'コスト4以下の（持続・命令以外の）アクション1枚を王子の脇に置けます。以降あなたの毎ターン開始時、脇に置いたまま使用します（置かなくてもよい）。',
      // engine の princeEligible と同じ述語＝持続/命令でないアクション・**ポーション費用も負債コストも無い**・$4以下。
      //   debt を見落とすと mix（プロモ＋帝国）で技術者等が光るのに engine が拒否＝押しても閉じない死に選択肢になる。
      (id) => E() && E().cardCost ? (DOM.CARDS[id].types.includes('action') && !DOM.CARDS[id].types.includes('duration') && !DOM.CARDS[id].types.includes('command') && !DOM.CARDS[id].potion && !DOM.CARDS[id].debt && effCost(state, id) <= 4) : false,
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
    if (pd.type === 'overlord') {
      const cands = (E() && E().overlordTargets) ? E().overlordTargets(state) : [];
      return modalGainSupply(state, '大君主 — サプライのカードを使う',
        'サプライにあるコスト5以下の（持続・命令以外の）アクション1枚を、サプライに残したまま使用します。',
        (id) => cands.includes(id),
        (id) => dispatch({ type: 'OVERLORD_PLAY', card: id }),
        () => dispatch({ type: 'OVERLORD_PLAY', card: null }), false, '使う');
    }
    if (pd.type === 'crown' && pd.mode === 'action') return modalSingleHand(p, '冠 — 2回使うアクション', '手札のアクションカードを1枚選ぶと、それを2回使います（使わなくてもよい）。', (id) => DOM.isType(id, 'action') && DOM.engine.canPlayHandCard(state, pd.player, id), (card) => dispatch({ type: 'CROWN_CHOOSE', card }), { label: '使わない', on: () => dispatch({ type: 'CROWN_CHOOSE', card: null }) }, '2回使う', DOM.engine.handPlayable(state, pd.player));
    if (pd.type === 'crown' && pd.mode === 'treasure') return modalSingleHand(p, '冠 — 2回使う財宝', '手札の財宝カードを1枚選ぶと、それを2回使います（使わなくてもよい）。', (id) => isTreasureNow(state, id) && DOM.engine.canPlayHandCard(state, pd.player, id), (card) => dispatch({ type: 'CROWN_CHOOSE', card }), { label: '使わない', on: () => dispatch({ type: 'CROWN_CHOOSE', card: null }) }, '2回使う');
    /* ===== 帝国：横型ランドスケープ（ランドマーク＝闘技場・峠）===== */
    if (pd.type === 'arena') return modalSingleHand(p, '闘技場', 'アクションカード1枚を捨ててもよい（捨てたら +2勝利点）。捨てても廃棄ではありません。',
      (id) => DOM.CARDS[id].types.includes('action'),
      (id) => dispatch({ type: 'ARENA_RESOLVE', card: id }),
      { label: '捨てない', on: () => dispatch({ type: 'ARENA_RESOLVE', card: null }) }, '捨てる');
    if (pd.type === 'mountain_pass_bid') {
      const hi = pd.highest || 0;
      const hiName = pd.highBidder != null ? state.players[pd.highBidder].name : 'なし';
      return modalAmount('峠 — 競り', '最大40負債まで入札できます。最高額の入札者が +8勝利点と、入札した額の負債を得ます。現在の最高額：' + hi + '（' + hiName + '）。',
        40, 0, (n) => (n > 0 ? n + ' 負債で入札する' : '入札しない（0）'),
        (n) => dispatch({ type: 'MOUNTAIN_PASS_BID', amount: n }));
    }
    // 帝国：横型イベントの選択待ち
    if (pd.type === 'salt_the_earth') return modalGainSupply(state, '大地への塩まき — 廃棄', 'サプライの勝利点カード1枚を選んで廃棄します（その山が1枚減ります）。',
      (id) => DOM.CARDS[id] && isTypeSup(state, id, 'victory'),
      (id) => dispatch({ type: 'SALT_TRASH', card: id }), null, null, '廃棄する');
    if (pd.type === 'banquet') return modalGainSupply(state, '宴会 — 獲得', 'コスト$5以下の、勝利点でないカード1枚を獲得します。',
      (id) => canUpTo(state, id, 5) && !isTypeSup(state, id, 'victory'),
      (id) => dispatch({ type: 'BANQUET_GAIN', card: id }));
    if (pd.type === 'advance' && pd.stage === 'trash') return modalSingleHand(p, '昇進 — 廃棄（任意）',
      '手札のアクションカード1枚を廃棄できます（廃棄すると、$6以下のアクションカードを1枚獲得します）。',
      (id) => DOM.CARDS[id].types.includes('action'),
      (id) => dispatch({ type: 'ADVANCE_TRASH', card: id }),
      { label: '廃棄しない', on: () => dispatch({ type: 'ADVANCE_TRASH', card: null }) });
    if (pd.type === 'advance' && pd.stage === 'gain') return modalGainSupply(state, '昇進 — 獲得', 'コスト$6以下のアクションカード1枚を獲得します。',
      (id) => canUpTo(state, id, 6) && isTypeSup(state, id, 'action'),
      (id) => dispatch({ type: 'ADVANCE_GAIN', card: id }));
    if (pd.type === 'ritual') return modalSingleHand(p, '儀式 — 廃棄', '手札から1枚を廃棄します（その廃棄カードのコスト$1につき +1勝利点）。',
      () => true, (id) => dispatch({ type: 'RITUAL_TRASH', card: id }), null, '廃棄する');
    if (pd.type === 'tax_pile') return modalGainSupply(state, '徴税 — 山を選ぶ', 'サプライの山を1つ選び、負債トークンを2個置きます（その山から次に購入フェイズで獲得したプレイヤーが、負債をすべて受け取ります）。空の山にも置けます。',
      (id) => !(DOM.SPLIT_PILES && DOM.SPLIT_PILES[id]), (id) => dispatch({ type: 'TAX_PILE', pile: id }), null, null, '負債を置く', true); // allowEmpty＝公式は空の山にも置ける（教師の山トークンと同じ）
    if (pd.type === 'donate_trash') return modalMultiHand(p, '寄付 — 廃棄（任意）',
      '山札と捨て札をすべて手札に集めました。好きな枚数を廃棄できます（残りをシャッフルして山札に戻し、5枚引きます）。0枚でもOK。',
      (n) => '確定（' + n + '枚 廃棄）', true, (cards) => dispatch({ type: 'DONATE_TRASH', cards }), p.hand.length);
    if (pd.type === 'annex_keep') return modalMultiCards(p.discard, '併合 — 捨て札に残す（最大5枚）',
      '捨て札から最大5枚を選んで捨て札に残します（選ばなかった残りは山札に混ぜてシャッフルされます）。その後、公領1枚を獲得します。',
      (n) => '確定（' + n + '枚 残す）', 5, (cards) => dispatch({ type: 'ANNEX_KEEP', cards }));

    /* ===== 冒険（Adventures）の横型イベント ===== */
    if (pd.type === 'alms_gain') return modalGainSupply(state, '施し — 獲得', 'コスト$4以下のカード1枚を獲得します（場に財宝が無いときだけ買えたイベントです）。',
      (id) => canUpTo(state, id, 4),
      (id) => dispatch({ type: 'ALMS_GAIN', card: id }));
    if (pd.type === 'ball_gain') return modalGainSupply(state, '舞踏会 — 獲得（残り' + (pd.left || 1) + '枚）', 'コスト$4以下のカードを獲得します（合計2枚）。',
      (id) => canUpTo(state, id, 4),
      (id) => dispatch({ type: 'BALL_GAIN', card: id }));
    if (pd.type === 'seaway') return modalGainSupply(state, '海路 — 獲得', 'コスト$4以下のアクションカード1枚を獲得します。その山にあなたの +1購入トークンを置きます。',
      (id) => canUpTo(state, id, 4) && isTypeSup(state, id, 'action'),
      (id) => dispatch({ type: 'SEAWAY_GAIN', card: id }));
    if (pd.type === 'quest' && pd.stage === 'mode') {
      // 公式：条件を満たさない選択肢も選べる（捨てるだけで金貨は出ない）。engine は忠実に受理するので、
      //   UIでは「金貨が出ない」ことを明示して事故を防ぐ（選択肢自体は消さない＝トンネル等で捨てたい場合もあるため）。
      const curses = p.hand.filter((c) => DOM.isType(c, 'curse')).length;
      const atks = p.hand.filter((c) => DOM.isType(c, 'attack')).length;
      const ng = '（金貨は得られません）';
      return modalOptions('探索 — 何を捨てますか', 'いずれか1つを選んで「ちょうど」捨てられたら、金貨1枚を獲得できます。', [
        { label: 'アタック1枚を捨てる' + (atks ? '' : ng), cls: atks ? 'btn-primary' : 'btn-ghost', on: () => dispatch({ type: 'QUEST_MODE', mode: 'attack' }) },
        { label: '呪い2枚を捨てる（手札の呪い：' + curses + '枚）' + (curses >= 2 ? '' : ng), cls: curses >= 2 ? 'btn-primary' : 'btn-ghost', on: () => dispatch({ type: 'QUEST_MODE', mode: 'curses' }) },
        { label: '手札6枚を捨てる（手札：' + p.hand.length + '枚）' + (p.hand.length >= 6 ? '' : ng), cls: p.hand.length >= 6 ? 'btn-primary' : 'btn-ghost', on: () => dispatch({ type: 'QUEST_MODE', mode: 'six' }) },
        { label: '何もしない', cls: 'btn-ghost', on: () => dispatch({ type: 'QUEST_MODE', mode: 'skip' }) },
      ]);
    }
    if (pd.type === 'quest' && pd.stage === 'attack') return modalSingleHand(p, '探索 — アタックを捨てる', '手札のアタックカード1枚を捨てます（→金貨1枚）。',
      (id) => DOM.CARDS[id].types.includes('attack'), (card) => dispatch({ type: 'QUEST_DISCARD', cards: [card] }), null, '捨てる');
    if (pd.type === 'quest' && pd.stage === 'six') return modalSelectN(p, '探索 — 6枚捨てる', '手札から' + Math.min(6, p.hand.length) + '枚を選んで捨てます（6枚捨てられたときだけ金貨1枚）。',
      Math.min(6, p.hand.length), '捨てる', (cards) => dispatch({ type: 'QUEST_DISCARD', cards }));
    if (pd.type === 'save') return modalSingleHand(p, '保存 — 脇に置く', '手札1枚を脇に置きます（このターンの終了時、次の手札を引いた後に手札へ加わります）。',
      () => true, (card) => dispatch({ type: 'SAVE_SETASIDE', card }), null, '脇に置く');
    if (pd.type === 'scouting_party' && pd.stage === 'discard') return modalMultiCards(pd.cards, '偵察隊 — 3枚捨てる',
      '山札の上5枚です。3枚を選んで捨て、残りを好きな順で山札の上に戻します。', (n) => '捨てる（' + n + '/3）', 3,
      (cards) => dispatch({ type: 'SCOUTING_DISCARD', cards }), 3);
    if (pd.type === 'scouting_party' && pd.stage === 'order') return modalReorder('偵察隊 — 山札の上に戻す',
      '戻す順番をタップで選びます（最初のタップが一番上）。', pd.cards, (order) => dispatch({ type: 'SCOUTING_ORDER', order }));
    if (pd.type === 'bonfire') {
      const coppers = p.inPlay.filter((c) => c === 'copper').length;
      const max = Math.min(2, coppers);
      return modalOptions('焚火 — 場の銅貨を廃棄', '場にある銅貨を最大2枚まで廃棄できます（場の銅貨：' + coppers + '枚）。',
        [2, 1, 0].filter((n) => n <= max).map((n) => ({ label: n + '枚 廃棄する', cls: n ? 'btn-primary' : 'btn-ghost', on: () => dispatch({ type: 'BONFIRE_TRASH', count: n }) })));
    }
    if (pd.type === 'trade') return modalMultiHand(p, '交易 — 廃棄（最大2枚）',
      '手札から2枚まで廃棄します。廃棄した枚数だけ銀貨を獲得します。0枚でもOK。',
      (n) => '確定（' + n + '枚 廃棄）', true, (cards) => dispatch({ type: 'TRADE_TRASH', cards }), 2);
    if (pd.type === 'pilgrimage') {
      const choices = DOM.engine.pilgrimageChoices(state, pd.player) || [];
      return modalMultiCards(choices, '巡礼 — コピーを獲得（最大3枚）',
        '場にある「名前の異なるカード」を最大3枚選び、それぞれのコピーを1枚ずつ獲得します。',
        (n) => '獲得する（' + n + '枚）', 3, (cards) => dispatch({ type: 'PILGRIMAGE_GAIN', cards }));
    }
    if (pd.type === 'event_token') {
      const LABEL = { action: '+1アクション', coin: '+$1', card: '+1カード', cost: '-$2コスト', trash: '廃棄' };
      const DESC = {
        action: 'その山のカードをプレイするたび、まず +1アクション を得ます。',
        coin: 'その山のカードをプレイするたび、まず +$1 を得ます。',
        card: 'その山のカードをプレイするたび、まず +1カード を引きます。',
        cost: 'あなたのターン中、その山のカードのコストが $2 安くなります。',
        trash: 'その山からカードを獲得したとき、手札1枚を廃棄してもよくなります。',
      };
      const piles = DOM.engine.actionSupplyPiles(state) || [];
      return modalPickList(state, LABEL[pd.token] + 'トークン — 置く山を選ぶ', DESC[pd.token], piles, '置く',
        (id) => dispatch({ type: 'EVENT_TOKEN_PILE', pile: id }));
    }
    if (pd.type === 'plan_trash') return modalSingleHand(p, '立案 — 廃棄（任意）',
      '廃棄トークンを置いた山からカードを獲得しました。手札1枚を廃棄できます（しなくてもよい）。', () => true,
      (card) => dispatch({ type: 'PLAN_TRASH', card }),
      { label: '廃棄しない', on: () => dispatch({ type: 'PLAN_TRASH', card: null }) }, '廃棄する');
    // 同盟：道化棒の4つ目の選択肢も同じ窓を使う（`source` で表示だけ分ける）。
    if (pd.type === 'travelling_fair') return modalOptions((pd.source === 'bauble' ? '道化棒' : pd.source === 'insignia' ? '勲章' : '移動遊園地') + ' — 山札の上に置く？',
      '獲得した「' + (DOM.CARDS[pd.card] ? DOM.CARDS[pd.card].name : pd.card) + '」を山札の上に置けます。', [
      { label: '山札の上に置く', cls: 'btn-primary', on: () => dispatch({ type: 'TRAVELLING_FAIR_TOPDECK', topdeck: true }) },
      { label: 'そのまま（捨て札）', cls: 'btn-ghost', on: () => dispatch({ type: 'TRAVELLING_FAIR_TOPDECK', topdeck: false }) },
    ]);
    if (pd.type === 'inheritance') {
      const targets = DOM.engine.inheritanceTargets(state) || [];
      return modalPickList(state, '相続 — 脇に置くカードを選ぶ',
        'サプライから、命令でないコスト$4以下のアクションカード1枚を脇に置き、屋敷トークンを載せます（以後、あなたのターン中は屋敷がこのカードを使用するアクションになります）。',
        targets, '脇に置く', (id) => dispatch({ type: 'INHERITANCE_SET', card: id }));
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
      if (mat.includes('teacher') && DOM.engine.validTeacherPiles(state, pd.player).length) opts.push({ label: '教師を呼ぶ（アクション山にトークンを置く）', on: () => dispatch({ type: 'TAVERN_START_CALL', card: 'teacher' }) });
      opts.push({ label: '呼び出さない', on: () => dispatch({ type: 'TAVERN_START_CALL', card: null }) });
      return modalOptions('酒場マット — 呼び出し（ターン開始）', '呼び出す Reserve カードを選びます（呼び出したカードは場に出ます）。', opts);
    }
    if (pd.type === 'ratcatcher_trash') return modalSingleHand(p, '鼠取り — 廃棄', '手札から廃棄するカードを1枚選びます。', () => true, (card) => dispatch({ type: 'RATCATCHER_TRASH', card }));
    if (pd.type === 'transmogrify_trash') return modalSingleHand(p, '変容 — 廃棄', '手札から廃棄するカードを1枚選びます（そのコスト+$1以下を手札に獲得）。', () => true, (card) => dispatch({ type: 'TRANSMOGRIFY_TRASH', card }));
    if (pd.type === 'transmogrify_gain') return modalGainSupply(state, '変容 — 獲得', 'コスト ' + pd.maxCost + ' 以下のカードを1枚 手札に獲得します。',
      (id) => canUpTo(state, id, pd.maxCost, pd), (id) => dispatch({ type: 'TRANSMOGRIFY_GAIN', card: id }));
    if (pd.type === 'wine_merchant') return modalOptions('ワイン商 — 捨てる？', '未使用の$2以上が残っています。ワイン商を酒場マットから捨てられます（捨てると再度購入して使えます）。', [
      { label: '酒場マットから捨てる', cls: 'btn-primary', on: () => dispatch({ type: 'WINE_MERCHANT_DISCARD', discard: true }) },
      { label: 'マットに残す', on: () => dispatch({ type: 'WINE_MERCHANT_DISCARD', discard: false }) }]);
    if (pd.type === 'after_action') {
      const mat = p.tavern || [];
      const opts = [];
      if (mat.includes('coin_of_the_realm')) opts.push({ label: '法貨を呼ぶ（+2アクション）', on: () => dispatch({ type: 'AFTER_ACTION_CALL', card: 'coin_of_the_realm' }) });
      if (mat.includes('royal_carriage') && p.inPlay.includes(pd.card)) opts.push({ label: '御料車を呼ぶ（「' + DOM.CARDS[pd.card].name + '」を再演）', on: () => dispatch({ type: 'AFTER_ACTION_CALL', card: 'royal_carriage' }) });
      opts.push({ label: '呼び出さない', on: () => dispatch({ type: 'AFTER_ACTION_CALL', card: null }) });
      return modalOptions('酒場マット — 呼び出し（アクション解決直後）', '「' + DOM.CARDS[pd.card].name + '」を解決しました。呼び出す Reserve を選びます。', opts);
    }
    if (pd.type === 'duplicate') return modalOptions('複製 — コピーする？', '「' + DOM.CARDS[pd.card].name + '」を獲得しました。複製を呼び出して同じカードのコピーを獲得できます。', [
      { label: '複製を呼んでコピーを獲得', cls: 'btn-primary', on: () => dispatch({ type: 'DUPLICATE_CALL', call: true }) },
      { label: '呼び出さない', on: () => dispatch({ type: 'DUPLICATE_CALL', call: false }) }]);
    // 冒険：トラベラー（page/peasant＋成長先）
    if (pd.type === 'traveller_exchange') {
      const TN = { page: 'treasure_hunter', treasure_hunter: 'warrior', warrior: 'hero', hero: 'champion', peasant: 'soldier', soldier: 'fugitive', fugitive: 'disciple', disciple: 'teacher' };
      const cur = pd.queue[0], nx = TN[cur];
      return modalOptions('トラベラー — 交換する？', '場から捨てる「' + DOM.CARDS[cur].name + '」を「' + DOM.CARDS[nx].name + '」と交換できます（交換は獲得ではありません）。', [
        { label: '「' + DOM.CARDS[nx].name + '」と交換する', cls: 'btn-primary', on: () => dispatch({ type: 'TRAVELLER_EXCHANGE_RESOLVE', exchange: true }) },
        { label: '交換しない（そのまま捨てる）', on: () => dispatch({ type: 'TRAVELLER_EXCHANGE_RESOLVE', exchange: false }) }]);
    }
    if (pd.type === 'warrior' && pd.stage === 'react') return modalOptions('ウォリアーを受ける', '山札の一番上を捨て、コストが$3か$4なら廃棄します（場のトラベラー数だけ繰り返し）。', reactOptions(p, pd, { type: 'WARRIOR_REACT' }));
    if (pd.type === 'soldier' && pd.stage === 'react') return modalOptions('兵士を受ける', '手札からカード1枚を捨てます。', reactOptions(p, pd, { type: 'SOLDIER_REACT' }));
    if (pd.type === 'soldier' && pd.stage === 'discard') return modalSingleHand(p, '兵士 — 手札を1枚捨てる', '手札からカード1枚を選んで捨てます。', () => true, (card) => dispatch({ type: 'SOLDIER_DISCARD', card }), null, '捨てる');
    if (pd.type === 'hero_gain') return modalGainSupply(state, 'ヒーロー — 財宝を獲得', '財宝カード1枚を獲得します。', (id) => isTreasureNow(state, id), (id) => dispatch({ type: 'HERO_GAIN', card: id }));
    if (pd.type === 'fugitive_discard') return modalSingleHand(p, '脱走兵 — 手札を1枚捨てる', '手札からカード1枚を選んで捨てます。', () => true, (card) => dispatch({ type: 'FUGITIVE_DISCARD', card }), null, '捨てる');
    // 冒険：相続した屋敷もアクション（命令）＝門下生の対象にできる（engine と同じ述語 inheritedEstate を見る）。
    if (pd.type === 'disciple_play') return modalSingleHand(p, '門下生 — 2回使うアクションを選ぶ', '手札のアクション1枚を選ぶと、それを2回使い、同じカード1枚を獲得します。',
      (id) => (DOM.isType(id, 'action') || (DOM.engine.inheritedEstate && DOM.engine.inheritedEstate(p, id))) && DOM.engine.canPlayHandCard(state, pd.player, id), // 航海の3枚制限／将軍
      (card) => dispatch({ type: 'DISCIPLE_PLAY', card }), { label: '使わない', on: () => dispatch({ type: 'DISCIPLE_PLAY', card: null }) }, '2回使う', DOM.engine.handPlayable(state, pd.player));
    if (pd.type === 'teacher_call' && pd.stage === 'token') {
      const TL = { card: '+1 カード', action: '+1 アクション', buy: '+1 購入', coin: '+1 コイン' };
      const tk = p.pileTokens || {};
      const opts = ['card', 'action', 'buy', 'coin'].map((k) => ({ label: TL[k] + '（現在：' + (tk[k] ? DOM.CARDS[tk[k]].name : 'どこにも無い') + '）', on: () => dispatch({ type: 'TEACHER_TOKEN', token: k }) }));
      return modalOptions('教師 — 移動するトークンを選ぶ', 'いずれかのトークンを、あなたのトークンが無いアクション山に移動します。', opts);
    }
    if (pd.type === 'teacher_call' && pd.stage === 'pile') {
      const TL = { card: 'カード', action: 'アクション', buy: '購入', coin: 'コイン' };
      const piles = DOM.engine.validTeacherPiles(state, pd.player);
      // 公式：教師のトークンは**空になったアクション山にも置ける**＝allowEmpty（engine の validTeacherPiles と同じ候補）。
      return modalGainSupply(state, '教師 — トークンを置く山', '+1' + TL[pd.token] + 'トークンを置くアクション山を選びます（その山のカードをプレイするたびに +1' + TL[pd.token] + '）。', (id) => piles.includes(id), (id) => dispatch({ type: 'TEACHER_PILE', card: id }), null, false, '置く', true);
    }
    // 冒険：複雑系（倒壊/工匠/語り部/使者）
    // 「これ（倒壊自身）」を廃棄できるか＝engine の pendingSelf と同じ述語（命令で動かさずに使った場合は不可）。
    if (pd.type === 'raze' && pd.stage === 'trash') {
      const self = pendingSelf(state, pd, 'raze');
      return modalSingleHand(p, '倒壊 — 廃棄', (self ? 'これか手札1枚' : '手札1枚') + 'を廃棄します。廃棄したカードのコイン分だけ山札の上を見て1枚を手札に加えます。', () => true, (card) => dispatch({ type: 'RAZE_TRASH', card }), self ? { label: '倒壊自身を廃棄する（$2＝山札の上2枚を見る）', on: () => dispatch({ type: 'RAZE_TRASH', card: 'raze' }) } : null, '廃棄する');
    }
    if (pd.type === 'raze' && pd.stage === 'look') return modalPickList(state, '倒壊 — 手札に加える', '見たカードから1枚を手札に加えます（残りは捨て札）。', pd.cards, '手札に加える', (card) => dispatch({ type: 'RAZE_LOOK', card }));
    if (pd.type === 'artificer' && pd.stage === 'discard') return modalMultiHand(p, '工匠 — 捨てる', '好きな枚数を捨て、捨てた枚数ちょうどのコストのカードを1枚 山札の上に獲得できます（0枚でもOK）。', (n) => '確定（' + n + '枚捨て）', true, (cards) => dispatch({ type: 'ARTIFICER_DISCARD', cards }));
    if (pd.type === 'artificer' && pd.stage === 'gain') return modalGainSupply(state, '工匠 — 山札の上に獲得', 'ちょうどコスト $' + pd.exact + ' のカードを1枚、山札の上に獲得できます（しなくてもよい）。', (id) => canExact(state, id, pd.exact, 0, 0), (id) => dispatch({ type: 'ARTIFICER_GAIN', card: id }), () => dispatch({ type: 'ARTIFICER_GAIN', card: null }), true);
    if (pd.type === 'storyteller') return modalMultiHand(p, '語り部 — 財宝をプレイ', '手札から最大3枚の財宝を選んでプレイします。その後、+1カード＋所持コイン$1につき+1カード（コインは全て使い切ります）。', (n) => '確定（' + n + '枚プレイ）', true, (cards) => dispatch({ type: 'STORYTELLER_PLAY', cards }), 3, (id) => isTreasureNow(state, id));
    if (pd.type === 'messenger_play') return modalOptions('使者 — 山札を捨てる？', '自分の山札を捨て札にできます（任意）。', [
      { label: '山札を捨て札にする', on: () => dispatch({ type: 'MESSENGER_PLAY', discard: true }) },
      { label: '捨てない', cls: 'btn-primary', on: () => dispatch({ type: 'MESSENGER_PLAY', discard: false }) }]);
    if (pd.type === 'messenger_gain') return modalGainSupply(state, '使者 — 獲得（全員に配布）', 'コスト$4以下のカードを1枚獲得します。他の各プレイヤーもそのコピーを獲得します。', (id) => canUpTo(state, id, 4), (id) => dispatch({ type: 'MESSENGER_GAIN', card: id }));
    if (pd.type === 'cutpurse' && pd.stage === 'react') return modalOptions('巾着切りを受ける', '銅貨1枚を捨てます（無ければ手札を公開）。', reactOptions(p, pd, { type: 'CUTPURSE_REACT' }));
    if (pd.type === 'sea_witch' && pd.stage === 'react') return modalOptions('海の魔女を受ける', '呪い1枚を獲得します。', reactOptions(p, pd, { type: 'SEA_WITCH_REACT' }));
    if (pd.type === 'sea_witch_discard') return modalSelectN(p, '海の魔女 — 手札を捨てる', '手札を2枚選んで捨てます。', Math.min(2, p.hand.length), '確定（捨てる）', (cards) => dispatch({ type: 'SEA_WITCH_DISCARD', cards }));
    if (pd.type === 'smugglers') return modalOptions('密輸人 — 獲得', '右隣が直前の手番に獲得したカード（6コスト以下）を1枚獲得します。', pd.candidates.map((c) => ({ label: DOM.CARDS[c].name + ' を獲得', on: () => dispatch({ type: 'SMUGGLERS_GAIN', card: c }) })));
    if (pd.type === 'blockade' && pd.stage === 'gain') return modalGainSupply(state, '封鎖 — 獲得して脇に置く', 'コスト4以下を1枚獲得して脇に置きます（次の手番に手札へ。場にある間、他人が同名を獲得すると呪い）。', (id) => canUpTo(state, id, 4), (id) => dispatch({ type: 'BLOCKADE_GAIN', card: id }));
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
    if (pd.type === 'pirate_gain') return modalGainSupply(state, '海賊 — 財宝を獲得', 'コスト6以下の財宝1枚を手札に獲得します。', (id) => isTreasureNow(state, id) && canUpTo(state, id, 6), (id) => dispatch({ type: 'PIRATE_GAIN', card: id }), () => dispatch({ type: 'PIRATE_GAIN', card: null }));

    /* ===== 拡張: 錬金術（Alchemy 第二版）===== */
    if (pd.type === 'transmute') return modalSingleHand(p, '変成 — 廃棄', '手札から1枚を廃棄します（アクション→公領／財宝→変成／勝利点→金貨。多重タイプは各ぶん獲得）。', () => true, (card) => dispatch({ type: 'TRANSMUTE_TRASH', card }), null, '廃棄する');
    if (pd.type === 'apothecary') return modalReorder('薬剤師 — 山札の上に戻す', '残ったカードを山札の上に戻す順をタップで選びます（最初のタップが一番上）。', pd.cards, (order) => dispatch({ type: 'APOTHECARY_RESOLVE', order }));
    if (pd.type === 'scrying_pool' && pd.stage === 'react') return modalOptions('念視の泉を受ける', '山札の上が公開され、相手が捨てるか戻すか決めます。', reactOptions(p, pd, { type: 'SCRYING_REACT' }));
    if (pd.type === 'scrying_pool' && pd.stage === 'decide') return modalOptions('念視の泉 — ' + state.players[pd.victim].name + ' の山札の上「' + DOM.CARDS[pd.card].name + '」',
      (pd.victim === pd.source ? '自分の山札の上です。アクション以外を捨てると次のアクションまで掘れます。' : '相手の山札の上です。良い札を捨てさせられます。'), [
      { label: '捨てさせる', cls: 'btn-primary', on: () => dispatch({ type: 'SCRYING_DECIDE', discard: true }) },
      { label: '山札の上に残す', on: () => dispatch({ type: 'SCRYING_DECIDE', discard: false }) },
    ]);
    if (pd.type === 'university') return modalGainSupply(state, '大学 — 獲得（任意）', 'コスト5以下のアクションカードを1枚獲得できます（ポーション費用カードは不可・しなくてもよい）。', (id) => canUpTo(state, id, 5) && isTypeSup(state, id, 'action'), (id) => dispatch({ type: 'UNIVERSITY_GAIN', card: id }), () => dispatch({ type: 'UNIVERSITY_GAIN', card: null }), true);
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
    if (pd.type === 'mint') return modalSingleHand(p, '造幣所 — 財宝を公開', '手札の財宝1枚を公開し、そのコピーを獲得します（任意）。', (id) => isTreasureNow(state, id), (card) => dispatch({ type: 'MINT_REVEAL', card }), { label: '公開しない', on: () => dispatch({ type: 'MINT_REVEAL', card: null }) }, '公開して獲得');
    if (pd.type === 'expand' && pd.stage === 'trash') return modalSingleHand(p, '拡張 — 廃棄', '廃棄するカードを1枚選びます（その後 +$3 までを獲得）。', () => true, (card) => dispatch({ type: 'EXPAND_TRASH', card }), null, '廃棄する');
    if (pd.type === 'expand' && pd.stage === 'gain') return modalGainSupply(state, '拡張 — 獲得', 'コスト ' + pd.maxCost + ' 以下のカードを1枚獲得します。', (id) => canUpTo(state, id, pd.maxCost, pd), (id) => dispatch({ type: 'EXPAND_GAIN', card: id }));
    if (pd.type === 'forge' && pd.stage === 'trash') return modalMultiHand(p, '溶鉱炉 — 廃棄', '好きな枚数を廃棄します（合計コストちょうどのカードを獲得）。', (n) => '確定（' + n + '枚廃棄）', true, (cards) => dispatch({ type: 'FORGE_TRASH', cards }));
    if (pd.type === 'forge' && pd.stage === 'gain') return modalGainSupply(state, '溶鉱炉 — 獲得', 'ちょうどコスト $' + pd.exact + ' のカードを1枚獲得します。', (id) => canExact(state, id, pd.exact, 0, 0), (id) => dispatch({ type: 'FORGE_GAIN', card: id }));
    if (pd.type === 'kings_court') return modalSingleHand(p, '王の宮廷 — 3回使う', '3回使うアクションカードを選びます。', (id) => DOM.isType(id, 'action') && DOM.engine.canPlayHandCard(state, pd.player, id), (card) => dispatch({ type: 'KINGS_COURT_CHOOSE', card }), { label: '使わない', on: () => dispatch({ type: 'KINGS_COURT_CHOOSE', card: null }) }, '3回使う', DOM.engine.handPlayable(state, pd.player));
    if (pd.type === 'war_chest' && pd.stage === 'name') return modalGainSupply(state, '軍用金 — カードを指定', state.players[pd.source].name + ' が獲得できないカードを1つ指定します。', () => true, (id) => dispatch({ type: 'WAR_CHEST_NAME', card: id }));
    if (pd.type === 'war_chest' && pd.stage === 'gain') return modalGainSupply(state, '軍用金 — 獲得', 'コスト$5以下で、指定されていないカードを1枚獲得します。', (id) => canUpTo(state, id, 5) && (state.turn.warChestNamed || []).indexOf(id) < 0, (id) => dispatch({ type: 'WAR_CHEST_GAIN', card: id }));
    if (pd.type === 'watchtower') return modalOptions('物見やぐら', '獲得した「' + DOM.CARDS[pd.card].name + '」をどうしますか？', [
      { label: 'そのまま受け取る', cls: 'btn-primary', on: () => dispatch({ type: 'WATCHTOWER', choice: 'keep' }) },
      { label: '山札の上に置く', on: () => dispatch({ type: 'WATCHTOWER', choice: 'topdeck' }) },
      { label: '廃棄する', on: () => dispatch({ type: 'WATCHTOWER', choice: 'trash' }) },
    ]);
    if (pd.type === 'tiara_topdeck') return modalOptions('ティアラ', '獲得した「' + DOM.CARDS[pd.card].name + '」を山札の上に置きますか？', [
      { label: '山札の上に置く', cls: 'btn-primary', on: () => dispatch({ type: 'TIARA_TOPDECK', topdeck: true }) },
      { label: '置かない', on: () => dispatch({ type: 'TIARA_TOPDECK', topdeck: false }) },
    ]);
    if (pd.type === 'tiara_play') return modalSingleHand(p, 'ティアラ — 財宝を2回使う', '2回使う財宝を1枚選びます（任意）。', (id) => isTreasureNow(state, id), (card) => dispatch({ type: 'TIARA_PLAY', card }), { label: '使わない', on: () => dispatch({ type: 'TIARA_PLAY', card: null }) }, '2回使う');
    if (pd.type === 'anvil' && pd.stage === 'discard') return modalSingleHand(p, '金床 — 財宝を捨てる', '財宝1枚を捨てると、コスト4以下を獲得できます（任意）。', (id) => isTreasureNow(state, id), (card) => dispatch({ type: 'ANVIL_DISCARD', card }), { label: '捨てない', on: () => dispatch({ type: 'ANVIL_DISCARD', card: null }) }, '捨てる');
    if (pd.type === 'anvil' && pd.stage === 'gain') return modalGainSupply(state, '金床 — 獲得', 'コスト4以下のカードを1枚獲得します。', (id) => canUpTo(state, id, 4), (id) => dispatch({ type: 'ANVIL_GAIN', card: id }));
    if (pd.type === 'investment' && !pd.stage) return modalOptions('投資', '次のどちらかを選びます。', [
      { label: '+1 コイン', cls: 'btn-primary', on: () => dispatch({ type: 'INVESTMENT', choice: 'coin' }) },
      { label: '財宝1枚を廃棄して、場の財宝の種類ぶん +勝利点', on: () => dispatch({ type: 'INVESTMENT', choice: 'vp' }) },
    ]);
    if (pd.type === 'investment' && pd.stage === 'trash') return modalSingleHand(p, '投資 — 財宝を廃棄', '廃棄する財宝を1枚選びます（場の財宝の種類ぶん +勝利点）。', (id) => isTreasureNow(state, id), (card) => dispatch({ type: 'INVESTMENT_TRASH', card }), null, '廃棄する');
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
    if (pd.type === 'remake' && pd.stage === 'gain') return modalGainSupply(state, 'リメイク — 獲得', '廃棄したカードよりちょうど$1高いカードを1枚獲得します。', (id) => canExact(state, id, pd.exactCost, pd.pot, pd.debt), (id) => dispatch({ type: 'REMAKE_GAIN', card: id }));
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
    if (pd.type === 'horn_of_plenty') return modalGainSupply(state, '豊穣の角 — 獲得', 'コスト ' + pd.maxCost + ' 以下のカードを1枚獲得します（勝利点なら豊穣の角を廃棄）。', (id) => canUpTo(state, id, pd.maxCost), (id) => dispatch({ type: 'HORN_OF_PLENTY_GAIN', card: id }));

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
    if (pd.type === 'stonemason_overpay') return modalGainSupply(state, '石工（過払い） — アクションを獲得', 'ちょうどコスト $' + pd.exact + ' のアクションカードを獲得します（残り ' + pd.remaining + ' 枚）。', (id) => canExact(state, id, pd.exact, 0, 0) && isTypeSup(state, id, 'action'), (id) => dispatch({ type: 'STONEMASON_OVERPAY_GAIN', card: id }));
    if (pd.type === 'doctor_overpay') return modalOptions('医者（過払い） — 山札の上「' + DOM.CARDS[pd.card].name + '」', '残り ' + pd.remaining + ' 回。この札をどうしますか？', [
      { label: 'そのまま（山札の上に戻す）', cls: 'btn-primary', on: () => dispatch({ type: 'DOCTOR_OVERPAY', choice: 'topdeck' }) },
      { label: '捨て札にする', on: () => dispatch({ type: 'DOCTOR_OVERPAY', choice: 'discard' }) },
      { label: '廃棄する', on: () => dispatch({ type: 'DOCTOR_OVERPAY', choice: 'trash' }) },
    ]);
    if (pd.type === 'herald_overpay') return modalPickList(state, '伝令官（過払い） — 山札の上に置く', '捨て札から1枚を選んで山札の上に置きます（残り ' + pd.remaining + ' 回）。', p.discard, '山札の上に置く', (id) => dispatch({ type: 'HERALD_OVERPAY', card: id }));
    if (pd.type === 'stonemason' && pd.stage === 'trash') return modalSingleHand(p, '石工 — 廃棄', '手札から1枚を廃棄します（その後、それより安いカードを2枚獲得）。', () => true, (card) => dispatch({ type: 'STONEMASON_TRASH', card }), null, '廃棄する');
    if (pd.type === 'stonemason' && pd.stage === 'gain') return modalGainSupply(state, '石工 — 獲得', 'コスト $' + (pd.maxCost - 1) + ' 以下のカードを獲得します（残り ' + pd.remaining + ' 枚）。', (id) => canUnder(state, id, pd.maxCost, pd), (id) => dispatch({ type: 'STONEMASON_GAIN', card: id }));
    if (pd.type === 'doctor' && pd.stage === 'name') return modalNameCard(state, '医者 — カードを指定', '山札の上3枚を公開し、指定と同名を全て廃棄します。1種を指定してください。', (id) => dispatch({ type: 'DOCTOR_NAME', card: id }));
    if (pd.type === 'doctor' && pd.stage === 'order') return modalReorder('医者 — 山札の上に戻す', '廃棄しなかったカードを山札の上に戻す順番をタップで選びます（最初のタップが一番上）。', pd.cards, (order) => dispatch({ type: 'DOCTOR_ORDER', order }));
    if (pd.type === 'advisor') return modalPickList(state, '助言者 — 捨てさせるカードを選ぶ', state.players[pd.source].name + ' が公開した ' + pd.cards.length + '枚 から、捨てさせる1枚を選びます（残りは ' + state.players[pd.source].name + ' の手札へ）。', pd.cards, '捨てさせる', (id) => dispatch({ type: 'ADVISOR_CHOOSE', card: id }));
    if (pd.type === 'plaza') return modalSingleHand(p, '広場 — 財宝を捨てる', '財宝1枚を捨てると +1財源（しなくてもよい）。', (id) => isTreasureNow(state, id), (card) => dispatch({ type: 'PLAZA_DISCARD', card }), { label: '捨てない', on: () => dispatch({ type: 'PLAZA_DISCARD', card: null }) }, '捨てる');
    if (pd.type === 'taxman' && pd.stage === 'trash') return modalSingleHand(p, '収税吏 — 財宝を廃棄', '手札の財宝1枚を廃棄できます（廃棄すると、そのコスト+$3までの財宝を山札の上に獲得し、相手に同名を捨てさせます）。', (id) => isTreasureNow(state, id), (card) => dispatch({ type: 'TAXMAN_TRASH', card }), { label: '廃棄しない', on: () => dispatch({ type: 'TAXMAN_TRASH', card: null }) }, '廃棄する');
    if (pd.type === 'taxman' && pd.stage === 'gain') return modalGainSupply(state, '収税吏 — 財宝を獲得', 'コスト $' + pd.maxCost + ' 以下の財宝を山札の上に獲得します。', (id) => isTreasureNow(state, id) && canUpTo(state, id, pd.maxCost, pd), (id) => dispatch({ type: 'TAXMAN_GAIN', card: id }), () => dispatch({ type: 'TAXMAN_GAIN', card: null }));
    if (pd.type === 'taxman' && pd.stage === 'react') return modalOptions('収税吏を受ける', '手札が5枚以上なら「' + DOM.CARDS[pd.trashedName].name + '」を1枚捨てます（無ければ手札を公開）。', reactOptions(p, pd, { type: 'TAXMAN_REACT' }));
    if (pd.type === 'butcher' && pd.stage === 'trash') return modalSingleHand(p, '肉屋 — 廃棄', '手札1枚を廃棄できます（廃棄すると、財源を払って格上げ獲得）。', () => true, (card) => dispatch({ type: 'BUTCHER_TRASH', card }), { label: '廃棄しない', on: () => dispatch({ type: 'BUTCHER_TRASH', card: null }) }, '廃棄する');
    if (pd.type === 'butcher' && pd.stage === 'pay') return modalAmount('肉屋 — 財源を支払う', '財源を支払うと、獲得できるカードのコスト上限が上がります（廃棄したカードのコスト $' + pd.trashedCost + ' ＋ 支払った財源）。', p.coffers || 0, 0,
      (n) => '財源を ' + n + '枚 支払う（獲得上限 $' + (pd.trashedCost + n) + '）', (n) => dispatch({ type: 'BUTCHER_PAY', amount: n }));
    if (pd.type === 'butcher' && pd.stage === 'gain') return modalGainSupply(state, '肉屋 — 獲得', 'コスト $' + pd.maxCost + ' 以下のカードを1枚獲得します。', (id) => canUpTo(state, id, pd.maxCost, pd), (id) => dispatch({ type: 'BUTCHER_GAIN', card: id }), () => dispatch({ type: 'BUTCHER_GAIN', card: null }));
    if (pd.type === 'journeyman') return modalNameCard(state, '熟練工 — カードを指定', '指定したカード以外が3枚公開されるまで山札を公開し、その3枚を手札に加えます。1種を指定してください。', (id) => dispatch({ type: 'JOURNEYMAN_NAME', card: id }));
    if (pd.type === 'soothsayer' && pd.stage === 'react') return modalOptions('予言者を受ける', '呪い1枚を獲得します（獲得したら +1カード）。', reactOptions(p, pd, { type: 'SOOTHSAYER_REACT' }));

    /* ===== 拡張: 異郷（Hinterlands）===== */
    if (pd.type === 'oasis') return modalSingleHand(p, 'オアシス — 捨てる', '手札1枚を捨てます。', () => true, (card) => dispatch({ type: 'OASIS_RESOLVE', card }), null, '捨てる');
    /* ===== 旭日（Rising Sun）R3 =====
       ⚠ **手札から「捨てる／廃棄する」窓（群B）には `pool` を渡さない**＝山札の影札は選べない（公式）。 */
    if (pd.type === 'alley') return modalSingleHand(p, '小路 — 捨てる', '手札1枚を捨てます（強制）。山札の影カードは捨てられません。',
      () => true, (card) => dispatch({ type: 'ALLEY_DISCARD', card }), null, '捨てる');
    if (pd.type === 'rustic_village') return modalMultiHand(p, '田舎の村 — 2枚捨てて1枚引く（任意）',
      '手札を**ちょうど2枚**捨てると +1 カード引けます（捨てなくてもかまいません）。',
      (n) => (n === 2 ? '2枚捨てて1枚引く' : '捨てない'), false,
      (cards) => dispatch({ type: 'RUSTIC_VILLAGE_DISCARD', cards: cards.length === 2 ? cards : [] }), 2);
    if (pd.type === 'mountain_shrine') return modalSingleHand(p, '山の社 — 廃棄（任意）',
      '手札1枚を廃棄してもよい。その後、廃棄置き場にアクションカードがあれば +2 カード。',
      () => true, (card) => dispatch({ type: 'MOUNTAIN_SHRINE_TRASH', card }),
      { label: '廃棄しない', on: () => dispatch({ type: 'MOUNTAIN_SHRINE_TRASH', card: null }) }, '廃棄する');
    if (pd.type === 'snake_witch') return modalOptions('濡女 — 山に戻す（任意）',
      '手札のカードがすべて異なるので、手札を公開してこれをこのカードの山に戻せます。そうすると他のプレイヤー全員が呪い1枚を獲得します。', [
        { label: '公開して山に戻す（相手に呪い）', cls: 'btn-primary', on: () => dispatch({ type: 'SNAKE_WITCH_RESOLVE', doIt: true }) },
        { label: '戻さない', on: () => dispatch({ type: 'SNAKE_WITCH_RESOLVE', doIt: false }) },
      ]);
    if (pd.type === 'snake_witch_attack' && pd.stage === 'react') return modalOptions('濡女を受ける', '呪い1枚を獲得します。',
      reactOptions(p, pd, { type: 'SNAKE_WITCH_REACT' }));
    if (pd.type === 'craftsman') return modalGainSupply(state, '名匠 — 獲得', 'コスト5以下のカード1枚を獲得します（強制）。',
      (id) => canUpTo(state, id, 5), (id) => dispatch({ type: 'CRAFTSMAN_GAIN', card: id }));
    if (pd.type === 'gold_mine') return modalOptions('金山 — 金貨と負債4（任意）',
      '金貨1枚を獲得し、負債4を得ます（金貨だけを得ることはできません）。負債はこのターン中いつでも返済できます。', [
        { label: '金貨1枚と 負債4 を得る', cls: 'btn-primary', on: () => dispatch({ type: 'GOLD_MINE_CHOOSE', doIt: true }) },
        { label: '何もしない', on: () => dispatch({ type: 'GOLD_MINE_CHOOSE', doIt: false }) },
      ]);
    if (pd.type === 'rice_broker') return modalSingleHand(p, '札差 — 廃棄',
      '手札1枚を廃棄します（財宝なら +2 カード／アクションなら +5 カード。両方なら両方）。',
      () => true, (card) => dispatch({ type: 'RICE_BROKER_TRASH', card }), null, '廃棄する');
    if (pd.type === 'change' && pd.stage === 'trash') return modalSingleHand(p, '交替 — 廃棄',
      '手札1枚を廃棄します（その後、コインコストが高いカード1枚を獲得し、差の数だけ負債を得ます）。',
      () => true, (card) => dispatch({ type: 'CHANGE_TRASH', card }), null, '廃棄する');
    if (pd.type === 'change' && pd.stage === 'gain') return modalGainSupply(state, '交替 — 獲得',
      '廃棄したカードよりコインコストが高いカード1枚を獲得します（差の数だけ負債を得ます）。',
      (id) => DOM.engine.gainableBase(state, id) && DOM.engine.costOf(state, id).coin > pd.ref,
      (id) => dispatch({ type: 'CHANGE_GAIN', card: id }));
    if (pd.type === 'tanuki' && pd.stage === 'trash') return modalSingleHand(p, '狸 — 廃棄',
      '廃棄するカードを1枚選びます（その後、最大2コイン高いカードを獲得）。',
      () => true, (card) => dispatch({ type: 'TANUKI_TRASH', card }), null, '廃棄する');
    if (pd.type === 'tanuki' && pd.stage === 'gain') return modalGainSupply(state, '狸 — 獲得',
      'コスト ' + pd.maxCost + ' 以下のカードを1枚獲得します。',
      (id) => canUpTo(state, id, pd.maxCost, pd), (id) => dispatch({ type: 'TANUKI_GAIN', card: id }));
    if (pd.type === 'duchess_look') {
      const top = p.deck[0];
      return modalOptions('公爵夫人 — 山札の上' + (top ? '「' + DOM.CARDS[top].name + '」' : ''), '自分の山札の一番上を捨てられます（捨てると次に引く札が変わります）。', [
        { label: '捨てる', cls: 'btn-primary', on: () => dispatch({ type: 'DUCHESS_LOOK', discard: true }) },
        { label: 'そのまま', on: () => dispatch({ type: 'DUCHESS_LOOK', discard: false }) }]);
    }
    if (pd.type === 'develop' && pd.stage === 'trash') return modalSingleHand(p, '開発 — 廃棄', '廃棄するカードを1枚選びます（その後、ちょうど+1コスト/−1コストのカードを獲得）。', () => true, (card) => dispatch({ type: 'DEVELOP_TRASH', card }), null, '廃棄する');
    if (pd.type === 'develop' && pd.stage === 'gain') return modalGainSupply(state, '開発 — 獲得', 'ちょうどコスト $' + (pd.hiDone ? pd.lo : pd.hi) + (!pd.hiDone && !pd.loDone ? '（または $' + pd.lo + '）' : '') + ' のカードを1枚、山札の上に獲得します。',
      (id) => (!pd.hiDone && canExact(state, id, pd.hi, pd.pot, pd.debt)) || (!pd.loDone && canExact(state, id, pd.lo, pd.pot, pd.debt)), (id) => dispatch({ type: 'DEVELOP_GAIN', card: id }));
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
    if (pd.type === 'jack' && pd.stage === 'trash') return modalSingleHand(p, '何でも屋 — 廃棄（任意）', '財宝でないカードを1枚廃棄できます（しなくてもよい）。', (id) => !isTreasureNow(state, id), (card) => dispatch({ type: 'JACK_TRASH', card }), { label: '廃棄しない', on: () => dispatch({ type: 'JACK_TRASH', card: null }) }, '廃棄する');
    if (pd.type === 'noble_brigand' && pd.stage === 'react') return modalOptions('高貴な山賊を受ける', '山札の上2枚から、公開された銀貨/金貨1枚が廃棄され相手に奪われます。', reactOptions(p, pd, { type: 'NOBLE_BRIGAND_REACT' }));
    if (pd.type === 'noble_brigand' && pd.stage === 'pick') {
      const cands = []; (pd.revealed || []).forEach((c) => { if ((c === 'silver' || c === 'gold') && cands.indexOf(c) < 0) cands.push(c); });
      return modalOptions('高貴な山賊 — 廃棄する財宝を選ぶ', state.players[pd.victim].name + ' の公開財宝から、廃棄して獲得する1枚を選びます。', cands.map((c) => ({ label: DOM.CARDS[c].name, on: () => dispatch({ type: 'NOBLE_BRIGAND_PICK', card: c }) })));
    }
    if (pd.type === 'spice_merchant' && pd.stage === 'trash') return modalSingleHand(p, '香辛料商人 — 財宝を廃棄（任意）', '手札の財宝1枚を廃棄できます（廃棄するとボーナスを選べます）。', (id) => isTreasureNow(state, id), (card) => dispatch({ type: 'SPICE_MERCHANT_TRASH', card }), { label: '廃棄しない', on: () => dispatch({ type: 'SPICE_MERCHANT_TRASH', card: null }) }, '廃棄する');
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
    if (pd.type === 'stables') return modalSingleHand(p, '厩舎 — 財宝を捨てる（任意）', '財宝1枚を捨てると +3カード +1アクション（しなくてもよい）。', (id) => isTreasureNow(state, id), (card) => dispatch({ type: 'STABLES_DISCARD', card }), { label: '捨てない', on: () => dispatch({ type: 'STABLES_DISCARD', card: null }) }, '捨てる');
    if (pd.type === 'border_village') return modalGainSupply(state, '国境の村 — 獲得', 'コスト ' + pd.maxCost + ' 以下のカードを1枚獲得します。', (id) => canUnder(state, id, (pd.maxCost || 0) + 1), (id) => dispatch({ type: 'BORDER_VILLAGE_GAIN', card: id }));
    if (pd.type === 'weaver' && pd.stage === 'gain') return modalGainSupply(state, '織工 — 獲得', 'コスト4以下のカードを1枚獲得します。', (id) => canUpTo(state, id, 4), (id) => dispatch({ type: 'WEAVER_GAIN', card: id }));
    if (pd.type === 'weaver') return modalOptions('織工', 'どちらかを選びます。', [
      { label: '銀貨2枚を獲得', cls: 'btn-primary', on: () => dispatch({ type: 'WEAVER_MODE', mode: 'silver' }) },
      { label: 'コスト4以下のカード1枚を獲得', on: () => dispatch({ type: 'WEAVER_MODE', mode: 'card' }) }]);
    if (pd.type === 'souk_trash') return modalMultiHand(p, 'スーク — 廃棄', '手札から最大2枚を廃棄します（0枚でもよい）。', (n) => '確定（' + n + '枚 廃棄）', true, (cards) => dispatch({ type: 'SOUK_TRASH', cards }), 2);
    if (pd.type === 'berserker' && pd.stage === 'react') return modalOptions('狂戦士を受ける', '手札が3枚になるまで捨てます。', reactOptions(p, pd, { type: 'BERSERKER_REACT' }));
    if (pd.type === 'berserker' && pd.stage === 'discard') return modalSelectN(p, '狂戦士 — 手札を捨てる', '手札が3枚になるまで（' + (p.hand.length - 3) + '枚）捨てます。', Math.max(0, p.hand.length - 3), '確定（捨てる）', (cards) => dispatch({ type: 'BERSERKER_DISCARD', cards }));
    if (pd.type === 'berserker' && pd.stage === 'gain') return modalGainSupply(state, '狂戦士 — 獲得', 'コスト ' + pd.maxCost + ' 以下のカードを1枚獲得します。', (id) => canUpTo(state, id, pd.maxCost), (id) => dispatch({ type: 'BERSERKER_GAIN', card: id }));
    if (pd.type === 'wheelwright' && pd.stage === 'discard') return modalSingleHand(p, '車大工 — 捨てる（任意）', '手札1枚を捨てると、そのコスト以下のアクションカードを獲得できます（しなくてもよい）。', () => true, (card) => dispatch({ type: 'WHEELWRIGHT_DISCARD', card }), { label: '捨てない', on: () => dispatch({ type: 'WHEELWRIGHT_DISCARD', card: null }) }, '捨てる');
    if (pd.type === 'wheelwright' && pd.stage === 'gain') return modalGainSupply(state, '車大工 — 獲得', 'コスト ' + pd.maxCost + ' 以下のアクションカードを1枚獲得します。', (id) => isTypeSup(state, id, 'action') && canUpTo(state, id, pd.maxCost, pd), (id) => dispatch({ type: 'WHEELWRIGHT_GAIN', card: id }));
    if (pd.type === 'witchs_hut' && pd.stage === 'react') return modalOptions('魔女の小屋を受ける', '呪い1枚を獲得します。', reactOptions(p, pd, { type: 'WITCHS_HUT_REACT' }));
    if (pd.type === 'witchs_hut' && pd.stage === 'discard') return modalSelectN(p, '魔女の小屋 — 公開して捨てる', '手札を' + Math.min(2, p.hand.length) + '枚選んで公開・捨てます（両方アクションなら相手に呪い）。', Math.min(2, p.hand.length), '確定（捨てる）', (cards) => dispatch({ type: 'WITCHS_HUT_DISCARD', cards }));
    if (pd.type === 'cauldron' && pd.stage === 'react') return modalOptions('大釜を受ける', '呪い1枚を獲得します。', reactOptions(p, pd, { type: 'CAULDRON_REACT' }));
    if (pd.type === 'duchess_gain') return modalOptions('公爵夫人を獲得?', '公領を獲得しました。公爵夫人1枚を獲得できます。', [
      { label: '公爵夫人を獲得する', cls: 'btn-primary', on: () => dispatch({ type: 'DUCHESS_GAIN', gain: true }) },
      { label: '獲得しない', on: () => dispatch({ type: 'DUCHESS_GAIN', gain: false }) }]);
    if (pd.type === 'farmland' && pd.stage === 'trash') return modalSingleHand(p, '農地 — 廃棄', '手札から1枚を廃棄し、ちょうど$2高いカードを獲得します。', () => true, (card) => dispatch({ type: 'FARMLAND_TRASH', card }), p.hand.length === 0 ? { label: '廃棄できるカードが無い（何もしない）', on: () => dispatch({ type: 'FARMLAND_TRASH', card: null }) } : null, '廃棄する');
    if (pd.type === 'farmland' && pd.stage === 'gain') return modalGainSupply(state, '農地 — 獲得', 'ちょうどコスト $' + pd.exactCost + ' のカードを1枚獲得します。', (id) => canExact(state, id, pd.exactCost, pd.pot, pd.debt), (id) => dispatch({ type: 'FARMLAND_GAIN', card: id }));
    if (pd.type === 'haggler') return modalGainSupply(state, '値切り屋 — 獲得', 'コスト ' + pd.maxCost + ' 以下の、勝利点でないカードを1枚獲得します。',
      (id) => !isTypeSup(state, id, 'victory') && canUnder(state, id, (pd.coin != null ? pd.coin : (pd.maxCost || 0) + 1), pd), (id) => dispatch({ type: 'HAGGLER_GAIN', card: id }));
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
    if (pd.type === 'armory') return modalGainSupply(state, '武器庫 — 獲得', 'コスト4以下のカードを1枚、山札の上に獲得します。', (id) => canUpTo(state, id, 4), (id) => dispatch({ type: 'ARMORY_GAIN', card: id }), () => dispatch({ type: 'ARMORY_GAIN', card: null }));
    if (pd.type === 'forager') return modalSingleHand(p, '採集者 — 廃棄', '手札1枚を廃棄します（廃棄置き場の異なる財宝の種類ぶん +$1）。', () => true, (card) => dispatch({ type: 'FORAGER_TRASH', card }));
    if (pd.type === 'squire') return modalOptions('従者', '次から1つを選びます。', [
      { label: '+2 アクション', on: () => dispatch({ type: 'SQUIRE_RESOLVE', choice: 'actions' }) },
      { label: '+2 購入', on: () => dispatch({ type: 'SQUIRE_RESOLVE', choice: 'buys' }) },
      { label: '銀貨を獲得', on: () => dispatch({ type: 'SQUIRE_RESOLVE', choice: 'silver' }) }]);
    if (pd.type === 'squire_trash_gain') return modalGainSupply(state, '従者 — アタックを獲得', '（廃棄された従者）サプライのアタックカードを1枚獲得します。', (id) => isTypeSup(state, id, 'attack'), (id) => dispatch({ type: 'SQUIRE_TRASH_GAIN', card: id }), () => dispatch({ type: 'SQUIRE_TRASH_GAIN', card: null }));
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
    if (pd.type === 'altar' && pd.stage === 'gain') return modalGainSupply(state, '祭壇 — 獲得', 'コスト5以下のカードを1枚獲得します。', (id) => canUpTo(state, id, 5), (id) => dispatch({ type: 'ALTAR_GAIN', card: id }), () => dispatch({ type: 'ALTAR_GAIN', card: null }));
    if (pd.type === 'catacombs') return modalOptions('地下墓所 — 山札の上3枚', '「' + pd.cards.map((c) => DOM.CARDS[c].name).join('・') + '」をどうしますか？', [
      { label: '3枚を手札に加える', cls: 'btn-primary', on: () => dispatch({ type: 'CATACOMBS_RESOLVE', choice: 'hand' }) },
      { label: '3枚を捨てて +3カード', on: () => dispatch({ type: 'CATACOMBS_RESOLVE', choice: 'discard' }) }]);
    if (pd.type === 'catacombs_trash') return modalGainSupply(state, '地下墓所 — 獲得', '（廃棄された地下墓所）これより安いカードを1枚獲得します。', (id) => canUnder(state, id, pd.under), (id) => dispatch({ type: 'CATACOMBS_TRASH_GAIN', card: id }), () => dispatch({ type: 'CATACOMBS_TRASH_GAIN', card: null }));
    if (pd.type === 'hunting_grounds_trash') return modalOptions('狩場 — 廃棄時の獲得', '（廃棄された狩場）公領1枚か屋敷3枚を獲得します。', [
      { label: '公領を獲得', cls: 'btn-primary', on: () => dispatch({ type: 'HUNTING_GROUNDS_TRASH', choice: 'duchy' }) },
      { label: '屋敷3枚を獲得', on: () => dispatch({ type: 'HUNTING_GROUNDS_TRASH', choice: 'estates' }) }]);
    // --- Group B ---
    if (pd.type === 'graverobber' && pd.stage === 'choose') return modalOptions('墓暴き', '次から1つを選びます。', [
      { label: '廃棄置き場の$3〜$6を山札の上に獲得', cls: 'btn-primary', on: () => dispatch({ type: 'GRAVEROBBER_MODE', mode: 'from_trash' }) },
      { label: '手札のアクションを廃棄→+$3までを獲得', on: () => dispatch({ type: 'GRAVEROBBER_MODE', mode: 'trash_gain' }) }]);
    if (pd.type === 'graverobber' && pd.stage === 'from_trash') return modalPickList(state, '墓暴き — 廃棄置き場から獲得', '廃棄置き場のコスト$3〜$6のカードを1枚、山札の上に獲得します。', (state.trash || []).filter((c) => { const cc = effCost(state, c); return cc >= 3 && cc <= 6 && !DOM.CARDS[c].potion; }), '獲得する', (id) => dispatch({ type: 'GRAVEROBBER_FROM_TRASH', card: id }));
    if (pd.type === 'graverobber' && pd.stage === 'trash') return modalSingleHand(p, '墓暴き — アクションを廃棄', '手札のアクション1枚を廃棄します（その後、+$3までを獲得）。', (id) => DOM.isType(id, 'action'), (card) => dispatch({ type: 'GRAVEROBBER_TRASH', card }));
    if (pd.type === 'graverobber' && pd.stage === 'gain') return modalGainSupply(state, '墓暴き — 獲得', 'コスト ' + pd.maxCost + ' 以下のカードを1枚獲得します。', (id) => canUpTo(state, id, pd.maxCost, pd), (id) => dispatch({ type: 'GRAVEROBBER_GAIN', card: id }), () => dispatch({ type: 'GRAVEROBBER_GAIN', card: null }));
    if (pd.type === 'rebuild' && pd.stage === 'name') return modalNameCard(state, '建て直し — 指定', '勝利点カードを1種指定します（指定しなかった勝利点を廃棄→格上げ）。', (id) => dispatch({ type: 'REBUILD_NAME', card: id }));
    if (pd.type === 'rebuild' && pd.stage === 'gain') return modalGainSupply(state, '建て直し — 獲得', 'コスト ' + pd.maxCost + ' 以下の勝利点カードを1枚獲得します。', (id) => isTypeSup(state, id, 'victory') && canUpTo(state, id, pd.maxCost, pd), (id) => dispatch({ type: 'REBUILD_GAIN', card: id }), () => dispatch({ type: 'REBUILD_GAIN', card: null }));
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
    if (pd.type === 'death_cart') return modalDeathCart(state, p, pd);
    if (pd.type === 'band_of_misfits') {
      const cands = (E() && E().bandOfMisfitsTargets) ? E().bandOfMisfitsTargets(state) : [];
      return modalGainSupply(state, 'はみだし者 — サプライのカードを使う', 'サプライにある「これより安い・非命令・非持続のアクション」を、サプライに残したまま使用します。', (id) => cands.includes(id), (id) => dispatch({ type: 'BAND_OF_MISFITS_PLAY', card: id }), () => dispatch({ type: 'BAND_OF_MISFITS_PLAY', card: null }), false, '使う');
    }
    if (pd.type === 'hermit' && pd.stage === 'trash') return modalHermitTrash(p, state);
    if (pd.type === 'hermit' && pd.stage === 'gain') return modalGainSupply(state, '隠遁者 — 獲得', 'コスト3以下のカードを1枚獲得します。', (id) => canUpTo(state, id, 3), (id) => dispatch({ type: 'HERMIT_GAIN', card: id }), () => dispatch({ type: 'HERMIT_GAIN', card: null }));
    if (pd.type === 'procession') return modalSingleHand(p, '行進 — 2回使うアクション', '手札の非持続アクション1枚を選ぶと2回使い、廃棄して、ちょうど+$1高いアクションを獲得します（使わなくてもよい）。', (id) => DOM.isType(id, 'action') && !DOM.isType(id, 'duration') && DOM.engine.canPlayHandCard(state, pd.player, id), (card) => dispatch({ type: 'PROCESSION_CHOOSE', card }), { label: '使わない', on: () => dispatch({ type: 'PROCESSION_CHOOSE', card: null }) }, '2回使う', DOM.engine.handPlayable(state, pd.player));
    if (pd.type === 'procession_gain') return modalGainSupply(state, '行進 — 獲得', 'ちょうどコスト $' + pd.exact + (pd.pot ? 'P' : '') + ' のアクションを1枚獲得します。', (id) => isTypeSup(state, id, 'action') && canExact(state, id, pd.exact, pd.pot, pd.debt), (id) => dispatch({ type: 'PROCESSION_GAIN', card: id }));
    if (pd.type === 'counterfeit') return modalSingleHand(p, '偽造通貨 — 2回使う財宝', '手札の非持続財宝1枚を選ぶと2回使い、それを廃棄します（使わなくてもよい）。', (id) => isTreasureNow(state, id) && !DOM.isType(id, 'duration'), (card) => dispatch({ type: 'COUNTERFEIT_PLAY', card }), { label: '使わない', on: () => dispatch({ type: 'COUNTERFEIT_PLAY', card: null }) }, '2回使う');
    // --- Group D（アタック）---
    if (pd.type === 'relic' && pd.stage === 'react') return modalOptions('遺物を受ける', '-1カードトークンを受け取ります（次に引く手札が1枚少なくなります）。', reactOptions(p, pd, { type: 'RELIC_REACT' }));
    if (pd.type === 'giant' && pd.stage === 'react') return modalOptions('巨人を受ける', '山札の一番上を公開し、コスト$3〜$6なら廃棄、そうでなければ捨てて呪い1枚を獲得します。', reactOptions(p, pd, { type: 'GIANT_REACT' }));
    if (pd.type === 'bridge_troll' && pd.stage === 'react') return modalOptions('橋の下のトロルを受ける', '-$1トークンを受け取ります（次の購入フェイズに使えるコインが$1減ります）。', reactOptions(p, pd, { type: 'BRIDGE_TROLL_REACT' }));
    if (pd.type === 'haunted_woods' && pd.stage === 'react') return modalOptions('呪いの森を受ける', '相手の次の手番まで、あなたがカードを購入すると手札を全て山札の上に置きます（堀を公開すればこの持続から免疫）。', reactOptions(p, pd, { type: 'LINGER_REACT' }));
    if (pd.type === 'swamp_hag' && pd.stage === 'react') return modalOptions('沼の妖婆を受ける', '相手の次の手番まで、あなたがカードを購入すると呪い1枚を獲得します（堀を公開すればこの持続から免疫）。', reactOptions(p, pd, { type: 'LINGER_REACT' }));
    if (pd.type === 'gatekeeper' && pd.stage === 'react') return modalOptions('門番を受ける', '相手の次の手番まで、あなたが「追放マットに同名の無いアクション／財宝」を獲得すると、それが追放されます（堀を公開すればこの持続から免疫）。', reactOptions(p, pd, { type: 'LINGER_REACT' }));
    if (pd.type === 'enchantress' && pd.stage === 'react') return modalOptions('女魔術師を受ける', 'あなたの次の手番で最初にプレイするアクションは、記載の効果の代わりに +1カード +1アクション になります（堀を公開すれば無効化）。', reactOptions(p, pd, { type: 'ENCHANTRESS_REACT' }));
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
    if (pd.type === 'dame_natalie_gain') return modalGainSupply(state, 'デイム・ナタリー — 獲得（任意）', 'コスト3以下のカードを1枚獲得できます（しなくてもよい）。', (id) => canUpTo(state, id, 3), (id) => dispatch({ type: 'DAME_NATALIE_GAIN', card: id }), () => dispatch({ type: 'DAME_NATALIE_GAIN', card: null }), true);
    // リアクション（青空市場＝廃棄時に金貨／納屋＝勝利点獲得時に廃棄）
    if (pd.type === 'market_square_react') return modalOptions('青空市場 — リアクション', 'あなたのカードが廃棄されました。手札の青空市場を捨てて金貨1枚を獲得できます。', [
      { label: '青空市場を捨てて金貨を獲得', cls: 'btn-primary', on: () => dispatch({ type: 'MARKET_SQUARE_REACT', discard: true }) },
      { label: 'しない', on: () => dispatch({ type: 'MARKET_SQUARE_REACT', discard: false }) }]);
    if (pd.type === 'hovel_react') return modalOptions('納屋 — リアクション', '勝利点カードを獲得しました。手札の納屋を廃棄できます（圧縮）。', [
      { label: '納屋を廃棄する', cls: 'btn-primary', on: () => dispatch({ type: 'HOVEL_REACT', trash: true }) },
      { label: 'しない', on: () => dispatch({ type: 'HOVEL_REACT', trash: false }) }]);

    /* ===== ルネサンス（Renaissance）R2 ===== */
    if (pd.type === 'hideout_trash') return modalSingleHand(p, '根城 — 廃棄',
      '手札から1枚を廃棄します（強制）。廃棄したのが勝利点カードなら、呪い1枚を獲得します。',
      () => true, (card) => dispatch({ type: 'HIDEOUT_TRASH', card }), null, '廃棄する');
    if (pd.type === 'inventor_gain') return modalGainSupply(state, '発明家 — 獲得',
      'コスト$4以下のカード1枚を獲得します。その後、このターン すべてのカードのコストが$1安くなります（この獲得には効きません）。',
      (id) => canUpTo(state, id, 4),
      (id) => dispatch({ type: 'INVENTOR_GAIN', card: id }), () => dispatch({ type: 'INVENTOR_GAIN', card: null }));
    if (pd.type === 'mountain_village') return modalPickList(state, '山村 — 捨て札から手札へ',
      '捨て札置き場から1枚を選んで手札に加えます（捨て札があるときは必ず1枚取ります）。',
      p.discard, '手札に加える', (id) => dispatch({ type: 'MOUNTAIN_VILLAGE_TAKE', card: id }));
    if (pd.type === 'priest_trash') return modalSingleHand(p, '司祭 — 廃棄',
      '手札から1枚を廃棄します（強制）。この廃棄には +2コインは付きませんが、このターンの残りの間、カードを廃棄するたびに +2コインを得ます。',
      () => true, (card) => dispatch({ type: 'PRIEST_TRASH', card }), null, '廃棄する');
    if (pd.type === 'recruiter_trash') return modalSingleHand(p, '徴募官 — 廃棄',
      '手札から1枚を廃棄します（強制）。そのカードのコイン費用$1につき +1村人を得ます。',
      () => true, (card) => dispatch({ type: 'RECRUITER_TRASH', card }), null, '廃棄する');
    if (pd.type === 'sculptor_gain') return modalGainSupply(state, '彫刻家 — 手札に獲得',
      'コスト$4以下のカード1枚を獲得し、手札に加えます。それが財宝カードなら +1村人。',
      (id) => canUpTo(state, id, 4),
      (id) => dispatch({ type: 'SCULPTOR_GAIN', card: id }), () => dispatch({ type: 'SCULPTOR_GAIN', card: null }), false, '手札に獲得する');
    if (pd.type === 'seer_order') return modalReorder('先見者 — 山札の上に戻す',
      '手札に入らなかったカードを山札の上に戻す順番をタップで選びます（最初のタップが一番上）。',
      pd.cards, (order) => dispatch({ type: 'SEER_ORDER', cards: order }));
    if (pd.type === 'old_witch' && pd.stage === 'react') return modalOptions('老魔女を受ける',
      '呪い1枚を獲得します。その後、手札に呪いがあれば1枚を廃棄できます。',
      reactOptions(p, pd, { type: 'OLD_WITCH_REACT' }));
    if (pd.type === 'old_witch_trash') return modalOptions('老魔女 — 手札の呪いを廃棄',
      '手札の呪い1枚を廃棄できます（任意）。※いま獲得した呪いは捨て札に入るので対象外です。', [
        { label: '呪いを1枚廃棄する', cls: 'btn-primary', on: () => dispatch({ type: 'OLD_WITCH_TRASH', card: 'curse' }) },
        { label: '廃棄しない', on: () => dispatch({ type: 'OLD_WITCH_TRASH', card: null }) }]);
    if (pd.type === 'villain' && pd.stage === 'react') return modalOptions('悪党を受ける',
      '手札からコスト$2以上のカード1枚を捨てます（無ければ手札を公開します）。',
      reactOptions(p, pd, { type: 'VILLAIN_REACT' }));
    if (pd.type === 'villain_discard') return modalSingleHand(p, '悪党 — 捨てる',
      '手札からコスト$2以上のカード1枚を選んで捨てます（強制）。',
      (id) => effCost(state, id) >= 2, (card) => dispatch({ type: 'VILLAIN_DISCARD', card }), null, '捨てる');
    /* --- R5：プロジェクト（横型）--- */
    if (pd.type === 'cathedral') return modalSingleHand(p, '大聖堂 — 廃棄',
      'ターン開始時：手札から1枚を廃棄します（強制）。', () => true,
      (card) => dispatch({ type: 'CATHEDRAL_TRASH', card }), null, '廃棄する');
    if (pd.type === 'city_gate') return modalSingleHand(p, '城門 — 山札の上に置く',
      'ターン開始時：+1カードを引きました。手札から1枚を山札の上に置きます（強制。引いたカードをそのまま戻してもOK）。',
      () => true, (card) => dispatch({ type: 'CITY_GATE_TOPDECK', card }), null, '山札の上に置く');
    if (pd.type === 'silos') {
      const coppers = p.hand.filter((c) => c === 'copper').length;
      return modalAmount('サイロ — 銅貨を捨てる', 'ターン開始時：好きな枚数の銅貨を公開して捨て、その後 捨てた枚数だけカードを引きます（手札の銅貨：' + coppers + '枚）。',
        coppers, 0, (n) => (n > 0 ? '銅貨 ' + n + '枚 を捨てて ' + n + '枚 引く' : '捨てない'),
        (n) => dispatch({ type: 'SILOS_DISCARD', count: n }));
    }
    if (pd.type === 'sinister_plot') {
      const k = p.sinisterPlot || 0;
      return modalOptions('悪巧み', 'ターン開始時：トークンを1個置くか、置いたトークンを全部取り除いて 1個につき +1カード を選びます（現在 ' + k + '個）。', [
        { label: 'トークンを1個置く（計 ' + (k + 1) + '個）', cls: 'btn-primary', on: () => dispatch({ type: 'SINISTER_PLOT_RESOLVE', mode: 'add' }) },
        { label: 'トークン ' + k + '個 を取り除いて +' + k + 'カード', on: () => dispatch({ type: 'SINISTER_PLOT_RESOLVE', mode: 'take' }) }]);
    }
    if (pd.type === 'crop_rotation') return modalSingleHand(p, '輪作 — 勝利点を捨てる（任意）',
      'ターン開始時：手札の勝利点カード1枚を捨てると +2カード（しなくてもよい）。',
      (id) => DOM.isType(id, 'victory'), (card) => dispatch({ type: 'CROP_ROTATION_RESOLVE', card }),
      { label: '捨てない', on: () => dispatch({ type: 'CROP_ROTATION_RESOLVE', card: null }) }, '捨てる');
    if (pd.type === 'pageant') return modalOptions('野外劇 — $1を支払う？',
      '購入フェイズの終了時：$1を支払うと +1財源（残りコイン ' + state.turn.coins + '）。', [
        { label: '$1 を支払って +1財源', cls: 'btn-primary', on: () => dispatch({ type: 'PAGEANT_PAY', pay: true }) },
        { label: '支払わない', on: () => dispatch({ type: 'PAGEANT_PAY', pay: false }) }]);
    if (pd.type === 'sewers_trash') return modalSingleHand(p, '下水道 — 追加で廃棄（任意）',
      'カードを廃棄しました。追加で手札1枚を廃棄できます（しなくてもよい）。', () => true,
      (card) => dispatch({ type: 'SEWERS_TRASH', card }),
      { label: '廃棄しない', on: () => dispatch({ type: 'SEWERS_TRASH', card: null }) }, '廃棄する');
    if (pd.type === 'innovation') return modalOptions('技術革新 — 獲得したアクションを使用？',
      '獲得した「' + DOM.CARDS[pd.card].name + '」を、いま使用できます（アクション権を消費しません。各ターン1回）。', [
        { label: '使用する', cls: 'btn-primary', on: () => dispatch({ type: 'INNOVATION_PLAY', play: true }) },
        { label: '使用しない（権利は残る）', on: () => dispatch({ type: 'INNOVATION_PLAY', play: false }) }]);
    /* --- R4：持続・クリンナップ・再演 --- */
    if (pd.type === 'research_trash') return modalSingleHand(p, '研究 — 廃棄',
      '手札から1枚を廃棄します（強制）。そのカードのコイン費用$1につき1枚、山札の上から裏向きで脇に置き、次のあなたの手番開始時に手札へ加えます。',
      () => true, (card) => dispatch({ type: 'RESEARCH_TRASH', card }), null, '廃棄する');
    if (pd.type === 'cargo_ship_setaside') return modalOptions('貨物船 — 脇に置く？',
      '獲得した「' + DOM.CARDS[pd.card].name + '」を表向きで脇に置けます（次のあなたの手番開始時に手札へ加わります）。', [
        { label: '脇に置く（次の手番に手札へ）', cls: 'btn-primary', on: () => dispatch({ type: 'CARGO_SHIP_SETASIDE', set: true }) },
        { label: '置かない', on: () => dispatch({ type: 'CARGO_SHIP_SETASIDE', set: false }) }]);
    if (pd.type === 'improve' && pd.stage === 'trash') {
      const targets = (DOM.engine.improveTargets ? DOM.engine.improveTargets(state, pd.player) : []);
      return modalPickList(state, '増築 — 場のアクションを廃棄（任意）',
        'このターン場から捨て札にするアクションカード1枚を廃棄できます。廃棄したら、ちょうど$1高いカードを1枚獲得します。',
        targets, '廃棄する', (id) => dispatch({ type: 'IMPROVE_TRASH', card: id }),
        { label: '廃棄しない', on: () => dispatch({ type: 'IMPROVE_TRASH', card: null }) });
    }
    if (pd.type === 'improve' && pd.stage === 'gain') return modalGainSupply(state, '増築 — 獲得',
      '廃棄したカードよりちょうど$1高いカードを1枚獲得します。',
      (id) => canExact(state, id, pd.exact, pd.pot, pd.dbt),
      (id) => dispatch({ type: 'IMPROVE_GAIN', card: id }));
    if (pd.type === 'scepter' && pd.stage === 'choose') {
      const cand = (DOM.engine.scepterTargets ? DOM.engine.scepterTargets(state, pd.player) : []);
      return modalOptions('王笏', '次から1つを選びます（実行できない選択肢も選べます）。', [
        { label: '+2 コイン', cls: 'btn-primary', on: () => dispatch({ type: 'SCEPTER_CHOOSE', mode: 'coins' }) },
        { label: '場のアクションを再度使用する' + (cand.length ? '（' + cand.length + '種）' : '（対象なし）'),
          on: () => dispatch({ type: 'SCEPTER_CHOOSE', mode: 'replay' }) }]);
    }
    if (pd.type === 'scepter' && pd.stage === 'replay') {
      const cand = (DOM.engine.scepterTargets ? DOM.engine.scepterTargets(state, pd.player) : []);
      return modalPickList(state, '王笏 — 再度使用する',
        'このターンに使用し、場に出たままの（命令でない）アクションカード1枚を、もう一度使用します。',
        cand, '再度使用する', (id) => dispatch({ type: 'SCEPTER_REPLAY', card: id }));
    }
    /* --- R3：アーティファクト絡み --- */
    if (pd.type === 'ducat_trash') return modalOptions('ドゥカート金貨 — 銅貨を廃棄',
      'ドゥカート金貨を獲得しました。手札の銅貨1枚を廃棄できます（任意・デッキ圧縮）。', [
        { label: '銅貨1枚を廃棄する', cls: 'btn-primary', on: () => dispatch({ type: 'DUCAT_TRASH', trash: true }) },
        { label: '廃棄しない', on: () => dispatch({ type: 'DUCAT_TRASH', trash: false }) }]);
    if (pd.type === 'border_guard') return modalPickList(state, '国境警備隊 — 手札に加える',
      '公開した' + (pd.cards || []).length + '枚から1枚を手札に加えます（残りは捨て札）。' +
      (pd.allAction ? (pd.lantern ? '※すべてアクション＝この後、角笛を受け取れます。' : '※2枚ともアクション＝この後、ランタンか角笛を受け取ります。') : ''),
      pd.cards, '手札に加える', (id) => dispatch({ type: 'BORDER_GUARD_KEEP', card: id }));
    if (pd.type === 'border_guard_artifact') {
      if (pd.only) return modalOptions('国境警備隊 — 角笛',
        '公開した3枚がすべてアクションカードでした。角笛を受け取れます（任意）。\n角笛：各ターン1度、場の国境警備隊を捨てる代わりに山札の上に置けます。', [
          { label: '角笛を受け取る', cls: 'btn-primary', on: () => dispatch({ type: 'BORDER_GUARD_ARTIFACT', artifact: 'horn' }) },
          { label: '受け取らない', on: () => dispatch({ type: 'BORDER_GUARD_ARTIFACT', artifact: null }) }]);
      return modalOptions('国境警備隊 — アーティファクト',
        '2枚ともアクションカードでした。ランタンか角笛のどちらかを受け取ります（相手が持っていれば奪います）。', [
          { label: '角笛（場の国境警備隊を山札の上に戻せる）', cls: 'btn-primary', on: () => dispatch({ type: 'BORDER_GUARD_ARTIFACT', artifact: 'horn' }) },
          { label: 'ランタン（国境警備隊が3枚公開・2枚捨てになる）', on: () => dispatch({ type: 'BORDER_GUARD_ARTIFACT', artifact: 'lantern' }) }]);
    }
    if (pd.type === 'treasurer' && pd.stage === 'choose') return modalOptions('出納官', '次から1つを選びます（実行できない選択肢を選ぶこともできます）。', [
      { label: '手札の財宝1枚を廃棄する', on: () => dispatch({ type: 'TREASURER_CHOOSE', mode: 'trash' }) },
      { label: '廃棄置き場から財宝1枚を手札に獲得する', cls: 'btn-primary', on: () => dispatch({ type: 'TREASURER_CHOOSE', mode: 'gain' }) },
      { label: '鍵を受け取る（毎ターン開始時 +1コイン）', on: () => dispatch({ type: 'TREASURER_CHOOSE', mode: 'key' }) }]);
    if (pd.type === 'treasurer' && pd.stage === 'trash') return modalSingleHand(p, '出納官 — 財宝を廃棄',
      '手札の財宝カード1枚を廃棄します。', (id) => isTreasureNow(state, id),
      (card) => dispatch({ type: 'TREASURER_TRASH', card }), null, '廃棄する');
    if (pd.type === 'treasurer' && pd.stage === 'gain') return modalPickList(state, '出納官 — 廃棄置き場から獲得',
      '廃棄置き場の財宝カード1枚を手札に獲得します（獲得時の効果も発動します）。',
      (state.trash || []).filter((c) => isTreasureNow(state, c)), '手札に獲得する',
      (id) => dispatch({ type: 'TREASURER_GAIN', card: id }));

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
    // 略奪：盾（戦利品）＝堀と完全に同型（公式FAQ逐語 `exactly as with Moat.`）。公開しても手札に残る。
    if (p.hand.includes('shield')) opts.push({ label: '🛡 盾を公開して無効化（手札に残る）', cls: 'btn-primary', on: () => dispatch({ type: 'SHIELD_REVEAL' }) });
    if (p.hand.includes('secret_chamber') && !pd.reacted) opts.push({ label: '🔮 秘密の小部屋を公開（+2引いて2枚戻す）', on: () => dispatch({ type: 'SECRET_CHAMBER_REVEAL' }) });
    if (canDiplomatReact(p, pd)) opts.push({ label: '🤝 外交官を公開（+2引いて3枚捨てる）', on: () => dispatch({ type: 'DIPLOMAT_REVEAL' }) });
    if (p.hand.includes('horse_traders')) opts.push({ label: '🐴 馬商人を脇に置く（次の手番に +1カードで戻る／攻撃は受ける）', on: () => dispatch({ type: 'HORSE_TRADERS_REACT' }) });
    if (p.hand.includes('guard_dog')) opts.push({ label: '🐕 番犬を先に使う（+2〜4カード／攻撃は受ける）', on: () => dispatch({ type: 'GUARD_DOG_REACT' }) });
    if (p.hand.includes('caravan_guard')) opts.push({ label: '🛡 隊商の護衛を先にプレイ（+1カード／次手番+$1／攻撃は受ける）', on: () => dispatch({ type: 'CARAVAN_GUARD_REACT' }) });
    if (p.hand.includes('beggar')) opts.push({ label: '🥺 物乞いを捨てて銀貨2枚を獲得（1枚は山札の上／攻撃は受ける）', on: () => dispatch({ type: 'BEGGAR_REACT' }) });
    opts.push({ label: 'そのまま受ける', on: () => dispatch(proceed) });
    return opts;
  }
  // 異郷：地図職人＝山札の上4枚から捨てる札をタップで選ぶ（残りは公開順のまま山札の上へ）。
  function modalCartographer(pd) {
    pruneSelection((pd.cards || []).length);
    const cards = pd.cards || [];
    const chips = cards.map((id, idx) =>
      cardEl(id, { size: 'sm', extra: UI.selection.includes(idx) ? 'selected' : 'selectable',
        badge: UI.selection.includes(idx) ? '捨' : null,
        onClick: () => { const i = UI.selection.indexOf(idx); if (i >= 0) UI.selection.splice(i, 1); else UI.selection.push(idx); render(); } }));
    const footer = h('button', { class: 'btn btn-primary btn-block',
      onclick: () => { const sel = UI.selection.slice(); UI.selection = []; const discard = sel.map((i) => cards[i]); const top = cards.filter((c, i) => sel.indexOf(i) < 0); dispatch({ type: 'CARTOGRAPHER_RESOLVE', discard, top }); } },
      '確定（' + UI.selection.length + '枚 捨て、残り ' + (cards.length - UI.selection.length) + '枚 を山札の上へ）');
    return modalShell('地図職人 — 山札の上4枚', 'タップして捨てるカードを選びます（選ばなかったカードは公開順のまま山札の上に戻ります）。', chips, footer);
  }
  /* 略奪：宝珠＝捨て札置き場を**すべて見た上で**、「その中のアクション/財宝1枚を使用」か「+1購入 +$3」を選ぶ。
     ⚠ 「見る」は選択の前に必ず行う（engine 側で処理済み）＝ここでは捨て札を一覧して選ばせる。 */
  function modalOrb(p) {
    const cand = (p.discard || []).map((id, idx) => ({ id, idx }))
      .filter((x) => DOM.isType(x.id, 'action') || DOM.isType(x.id, 'treasure'));
    const seen = [];
    const chips = cand.filter((x) => { if (seen.indexOf(x.id) >= 0) return false; seen.push(x.id); return true; })
      .map((x) => cardEl(x.id, { size: 'sm', extra: 'selectable',
        onClick: () => dispatch({ type: 'ORB_RESOLVE', mode: 'play', card: x.id }) }));
    const footer = h('button', { class: 'btn btn-primary btn-block',
      onclick: () => dispatch({ type: 'ORB_RESOLVE', mode: 'coin' }) }, '+1 購入 と +3 コインをもらう');
    return modalShell('宝珠 — 捨て札置き場（' + (p.discard || []).length + '枚）',
      cand.length ? 'タップすると捨て札からそのカードを使用します（アクション権は消費しません）。または下のボタンで +1購入 +$3。'
                  : '捨て札に使えるアクション/財宝がありません。+1購入 +$3 を選んでください。', chips, footer);
  }
  // 略奪：六分儀＝山札の上5枚から捨てる札をタップで選ぶ（残りは公開順のまま山札の上へ）＝地図職人と同じ操作。
  function modalSextant(pd) {
    pruneSelection((pd.cards || []).length);
    const cards = pd.cards || [];
    const chips = cards.map((id, idx) =>
      cardEl(id, { size: 'sm', extra: UI.selection.includes(idx) ? 'selected' : 'selectable',
        badge: UI.selection.includes(idx) ? '捨' : null,
        onClick: () => { const i = UI.selection.indexOf(idx); if (i >= 0) UI.selection.splice(i, 1); else UI.selection.push(idx); render(); } }));
    const footer = h('button', { class: 'btn btn-primary btn-block',
      onclick: () => { const sel = takeSelection(); const discard = sel.map((i) => cards[i]); const top = cards.filter((c, i) => sel.indexOf(i) < 0); dispatch({ type: 'SEXTANT_RESOLVE', discard, top }); } },
      '確定（' + UI.selection.length + '枚 捨て、残り ' + (cards.length - UI.selection.length) + '枚 を山札の上へ）');
    return modalShell('六分儀 — 山札の上5枚', 'タップして捨てるカードを選びます（選ばなかったカードは公開順のまま山札の上に戻ります）。', chips, footer);
  }
  // 異郷：策謀＝場のアクション（非持続）を最大 max 枚、山札の上に置く（タップで選択・0枚でもよい）。
  function modalSchemeCleanup(p, max) {
    pruneSelection(p.inPlay.length);
    const elig = p.inPlay.map((id, idx) => ({ id, idx })).filter((x) => DOM.isType(x.id, 'action') && !DOM.isType(x.id, 'duration'));
    const chips = elig.map((x) =>
      cardEl(x.id, { size: 'sm', extra: UI.selection.includes(x.idx) ? 'selected' : 'selectable',
        onClick: () => { const i = UI.selection.indexOf(x.idx); if (i >= 0) UI.selection.splice(i, 1); else if (UI.selection.length < max) UI.selection.push(x.idx); render(); } }));
    const footer = h('button', { class: 'btn btn-primary btn-block',
      onclick: () => dispatch({ type: 'SCHEME_CLEANUP', cards: takeSelection(p.inPlay) }) },
      '確定（' + UI.selection.length + '枚 を山札の上へ）');
    return modalShell('策謀 — 山札の上に置く', '最大 ' + max + ' 枚まで、場のアクションを山札の上に置けます（次のターンに引きます・0枚でもよい）。', chips, footer);
  }
  // 暗黒時代：死の荷車＝これ自身か手札のアクション1枚を廃棄→+$5（しなくてもよい）。
  // 「これ（死の荷車自身）」を廃棄できるか＝engine の pendingSelf と同じ述語（命令で動かさずに使った場合／玉座2回目は不可）。
  function modalDeathCart(state, p, pd) {
    const self = pendingSelf(state, pd, 'death_cart');
    const acts = [...new Set(p.hand.filter((id) => DOM.isType(id, 'action')))];
    const buttons = [];
    if (self) buttons.push(h('button', { class: 'btn btn-primary btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'DEATH_CART_RESOLVE', mode: 'this' }) }, '死の荷車自身を廃棄（+$5）'));
    acts.forEach((id) => buttons.push(h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'DEATH_CART_RESOLVE', mode: 'hand', card: id }) }, '「' + DOM.CARDS[id].name + '」を廃棄（+$5）')));
    buttons.push(h('button', { class: 'btn btn-block', onclick: () => dispatch({ type: 'DEATH_CART_RESOLVE', mode: 'none' }) }, '廃棄しない'));
    return modalShell('死の荷車', (self ? 'これ自身か手札のアクション1枚' : '手札のアクション1枚') + 'を廃棄すると +$5（しなくてもよい）。', [], h('div', null, buttons));
  }
  // 暗黒時代：隠遁者＝手札か捨て札の非財宝を1枚廃棄できる（任意）。
  function modalHermitTrash(p, state) {
    const handNT = [...new Set(p.hand.filter((id) => !isTreasureNow(state, id)))];
    const discNT = [...new Set(p.discard.filter((id) => !isTreasureNow(state, id)))];
    const buttons = [];
    handNT.forEach((id) => buttons.push(h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'HERMIT_TRASH', from: 'hand', card: id }) }, '手札「' + DOM.CARDS[id].name + '」を廃棄')));
    discNT.forEach((id) => buttons.push(h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'HERMIT_TRASH', from: 'discard', card: id }) }, '捨て札「' + DOM.CARDS[id].name + '」を廃棄')));
    buttons.push(h('button', { class: 'btn btn-block', onclick: () => dispatch({ type: 'HERMIT_TRASH', card: null }) }, '廃棄しない'));
    return modalShell('隠遁者 — 廃棄（任意）', '手札か捨て札の非財宝を1枚廃棄できます（その後、コスト3以下を1枚獲得）。', [], h('div', null, buttons));
  }
  // 暗黒時代：手札N枚まで捨てる汎用アタック（浮浪児/傭兵/サー・マイケル）。堀・馬商人・番犬で反応可。
  function modalDiscardDown(p, pd) {
    pruneSelection(p.hand.length);
    const need = p.hand.length - Math.min(pd.down, p.hand.length);
    const hasMoat = p.hand.includes('moat');
    const chips = p.hand.map((id, idx) =>
      cardEl(id, { size: 'sm', extra: UI.selection.includes(idx) ? 'selected' : 'selectable',
        onClick: () => { const i = UI.selection.indexOf(idx); if (i >= 0) UI.selection.splice(i, 1); else if (UI.selection.length < need) UI.selection.push(idx); render(); } }));
    const remain = need - UI.selection.length;
    const footer = h('div', null,
      hasMoat ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'MOAT_REVEAL' }) }, '🛡 堀を公開して無効化') : null,
      // 略奪：盾（戦利品）＝堀と同型の免疫（公開しても手札に残る）。**embedded 型のアタック用モーダルは
      //   `reactOptions` を通らないので、ここに手で足さないと人間が盾を使えない。**
      p.hand.includes('shield') ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'SHIELD_REVEAL' }) }, '🛡 盾を公開して無効化（手札に残る）') : null,
      p.hand.includes('horse_traders') ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'HORSE_TRADERS_REACT' }) }, '🐴 馬商人を脇に置く（次の手番に +1カードで戻る／攻撃は受ける）') : null,
      p.hand.includes('beggar') ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'BEGGAR_REACT' }) }, '🥺 物乞いを捨てて銀貨2枚を獲得（1枚は山札の上／攻撃は受ける）') : null,
      p.hand.includes('caravan_guard') ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'CARAVAN_GUARD_REACT' }) }, '🛡 隊商の護衛を先にプレイ（+1カード／次手番+$1／攻撃は受ける）') : null,
      p.hand.includes('guard_dog') ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'GUARD_DOG_REACT' }) }, '🐕 番犬を先に使う（+2〜4カード／攻撃は受ける）') : null,
      h('button', { class: 'btn btn-primary btn-block', disabled: remain === 0 ? null : 'disabled',
        onclick: () => dispatch({ type: 'DISCARD_DOWN_RESOLVE', cards: takeSelection(p.hand) }) },
        remain === 0 ? '確定（捨てる）' : 'あと ' + remain + ' 枚 選ぶ'));
    return modalShell('攻撃を受ける — 手札' + pd.down + '枚まで捨てる', '手札が' + pd.down + '枚になるまで捨てます。' + (hasMoat ? '「堀」で無効化もできます。' : ''), chips, footer);
  }
  // 暗黒時代：傭兵＝ちょうど2枚を廃棄すると効果発動（0枚＝廃棄しない）。
  function modalMercenaryTrash(p) {
    pruneSelection(p.hand.length);
    const chips = p.hand.map((id, idx) =>
      cardEl(id, { size: 'sm', extra: UI.selection.includes(idx) ? 'selected' : 'selectable',
        onClick: () => { const i = UI.selection.indexOf(idx); if (i >= 0) UI.selection.splice(i, 1); else if (UI.selection.length < 2) UI.selection.push(idx); render(); } }));
    const k = UI.selection.length;
    const footer = h('div', null,
      h('button', { class: 'btn btn-primary btn-block', disabled: k >= 1 ? null : 'disabled', style: 'margin-bottom:8px',
        onclick: () => dispatch({ type: 'MERCENARY_TRASH', cards: takeSelection(p.hand) }) },
        k === 2 ? '2枚廃棄（+2カード +$2＋アタック）' : (k === 1 ? '1枚だけ廃棄（効果は不発）' : '廃棄する2枚を選ぶ')),
      h('button', { class: 'btn btn-block', onclick: () => dispatch({ type: 'MERCENARY_TRASH', cards: [] }) }, '廃棄しない'));
    return modalShell('傭兵 — 廃棄', '手札からちょうど2枚を廃棄すると +2カード +$2、各相手が手札3枚まで捨てます（1枚だけの廃棄も可・その場合は効果なし・しなくてもよい）。', chips, footer);
  }
  // 手札から n 枚をタップ順に選ぶ（秘密の小部屋の戻し）。最初のタップが一番上。
  /* 【重要】選択（UI.selection）は **確定した時点で必ず捨てる**。
     `viewPendingModal` の選択リセットは「pending のキー（type+stage）が変わったとき」だけ走るので、
     **毎ターン同じキーで開く窓**（同盟の 沿岸の避難港／平和的教団／すり師団、地下貯蔵庫 等）では
     前回の**手札インデックス**が残る。手札の枚数はターンごとに変わるので、残ったインデックスが
     範囲外になると「そのチップが描画されない＝外す手段が無い」うえ、送信すると `cards:[undefined]`
     になって engine が状態不変で拒否し続ける＝**人間が完全に詰む**（A3 の敵対レビューで再現）。
     modalAmount が `UI.amount = null` でやっているのと同じ扱いを、選択系すべてに揃える。
     さらに描画時にも範囲外インデックスを間引く（旧スナップショット復元などの自己修復）。 */
  function takeSelection(list) {
    const v = (UI.selection || []).slice();
    UI.selection = [];
    return list ? v.map((i) => list[i]) : v;
  }
  function pruneSelection(len) {
    UI.selection = (UI.selection || []).filter((i) => typeof i === 'number' && i >= 0 && i < len);
  }
  // skip を渡すと「やらない」ボタンが付く（任意の N枚選択＝首都など）。
  function modalSelectN(p, title, desc, n, confirmLabel, onConfirm, skip) {
    pruneSelection(p.hand.length);
    const chips = p.hand.map((id, idx) => {
      const pos = UI.selection.indexOf(idx);
      return cardEl(id, { size: 'sm', extra: pos >= 0 ? 'selected' : 'selectable', badge: pos >= 0 ? String(pos + 1) : null,
        onClick: () => { const i = UI.selection.indexOf(idx); if (i >= 0) UI.selection.splice(i, 1); else if (UI.selection.length < n) UI.selection.push(idx); render(); } });
    });
    const remain = n - UI.selection.length;
    const confirm = h('button', { class: 'btn btn-primary btn-block', disabled: remain === 0 ? null : 'disabled',
      style: skip ? 'margin-bottom:8px' : null,
      onclick: () => onConfirm(takeSelection(p.hand)) }, remain === 0 ? confirmLabel : ('あと ' + remain + ' 枚'));
    const footer = skip
      ? h('div', null, confirm, h('button', { class: 'btn btn-block', onclick: () => { UI.selection = []; skip.on(); } }, skip.label))
      : confirm;
    return modalShell(title, desc, chips, footer);
  }
  /* 「次から1つを選ぶ」の共通モーダル。同盟の長老(Elder)が付いている pending（`pd.elder`）では
     **異なる2つ**を選ばせる（解決は engine がカード記載順に行う）。
     opts = [{ k:'<選択肢キー>', label:'<表示>' }, ...]（カード記載順に並べること）。 */
  function modalChoice(pd, title, actionType, opts, extraDesc) {
    const desc = (pd.elder ? '長老の効果で、次から**異なる2つ**を選べます（カード記載順に解決します）。' : '次から1つを選びます。')
      + (extraDesc ? extraDesc : '');
    if (!pd.elder) {
      return modalOptions(title, desc, opts.map((o, i) => ({
        label: o.label, cls: i === 0 ? 'btn-primary' : '',
        on: () => dispatch({ type: actionType, choices: [o.k] }),
      })));
    }
    pruneSelection(opts.length);
    const chips = opts.map((o, idx) => {
      const pos = UI.selection.indexOf(idx);
      return h('button', { class: 'btn btn-block ' + (pos >= 0 ? 'btn-primary' : ''), style: 'margin-bottom:6px',
        onclick: () => { const i = UI.selection.indexOf(idx); if (i >= 0) UI.selection.splice(i, 1); else if (UI.selection.length < 2) UI.selection.push(idx); render(); } },
      (pos >= 0 ? '✓ ' : '') + o.label);
    });
    const k = UI.selection.length;
    const footer = h('button', { class: 'btn btn-primary btn-block', disabled: k >= 1 ? null : 'disabled',
      onclick: () => dispatch({ type: actionType, choices: takeSelection(opts).map((o) => o.k) }) },
    k === 0 ? '選んでください' : (k === 1 ? '1つだけで確定' : '2つで確定'));
    return modalShell(title, desc, chips, footer);
  }
  /* 任意の並び（手札とは限らない）から**部分集合**を選ぶ（同盟：天幕/商人の野営地の山札上置き）。
     0枚も合法＝確定ボタンは常に押せる。 */
  function modalPickSubset(title, desc, cards, onConfirm, confirmLabel) {
    pruneSelection(cards.length);
    const chips = cards.map((id, idx) => {
      const pos = UI.selection.indexOf(idx);
      return cardEl(id, { size: 'sm', extra: pos >= 0 ? 'selected' : 'selectable', badge: pos >= 0 ? String(pos + 1) : null,
        onClick: () => { const i = UI.selection.indexOf(idx); if (i >= 0) UI.selection.splice(i, 1); else UI.selection.push(idx); render(); } });
    });
    const k = UI.selection.length;
    const footer = h('button', { class: 'btn btn-primary btn-block',
      onclick: () => onConfirm(takeSelection(cards)) }, k === 0 ? '置かない' : (confirmLabel + '（' + k + '枚）'));
    return modalShell(title, desc, chips, footer);
  }

  // 複数カードを「置く順」に並べ替える（斥候など）。最初にタップしたカードが一番上。
  function modalReorder(title, desc, cards, onConfirm) {
    pruneSelection(cards.length);
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
      onclick: () => onConfirm(takeSelection(cards)) },
      remain === 0 ? '確定（上から順に戻す）' : 'あと ' + remain + ' 枚 順番を選ぶ');
    return modalShell(title, desc, chips, footer);
  }

  function modalMultiHand(p, title, desc, confirmLabel, allowZero, onConfirm, maxN, filter) {
    pruneSelection(p.hand.length);
    const chips = p.hand.map((id, idx) => ({ id, idx })).filter((x) => !filter || filter(x.id)).map(({ id, idx }) =>
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
        onclick: () => onConfirm(takeSelection(p.hand)) }, confirmLabel(n)));
  }
  // 任意のカード配列（手札に限らない・併合の捨て札など）から最大 maxN 枚を選ぶ。onConfirm には選んだカードid配列を渡す。
  //   requireN を渡すと「ちょうどその枚数」でないと確定できない（偵察隊＝3枚ちょうど捨てる）。
  function modalMultiCards(cards, title, desc, confirmLabel, maxN, onConfirm, requireN) {
    pruneSelection(cards.length);
    const chips = cards.map((id, idx) =>
      cardEl(id, {
        size: 'sm',
        extra: UI.selection.includes(idx) ? 'selected' : 'selectable',
        onClick: () => {
          const i = UI.selection.indexOf(idx);
          if (i >= 0) UI.selection.splice(i, 1); else if (maxN == null || UI.selection.length < maxN) UI.selection.push(idx);
          render();
        },
      }));
    const body = chips.length ? chips : [h('p', { class: 'muted' }, 'カードがありません')];
    return modalShell(title, desc, body,
      h('button', { class: 'btn btn-primary btn-block',
        disabled: (requireN != null && UI.selection.length !== requireN) ? 'disabled' : null,
        onclick: () => onConfirm(takeSelection(cards)) }, confirmLabel(UI.selection.length)));
  }
  function modalMilitia(p, need, hasMoat, hasSecret, hasDiplomat) {
    pruneSelection(p.hand.length);
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
      // 略奪：盾（戦利品）＝堀と同型の免疫（公開しても手札に残る）。**embedded 型のアタック用モーダルは
      //   `reactOptions` を通らないので、ここに手で足さないと人間が盾を使えない。**
      p.hand.includes('shield') ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'SHIELD_REVEAL' }) }, '🛡 盾を公開して無効化（手札に残る）') : null,
      hasSecret ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'SECRET_CHAMBER_REVEAL' }) }, '🔮 秘密の小部屋を公開（+2引いて2枚戻す）') : null,
      hasDiplomat ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'DIPLOMAT_REVEAL' }) }, '🤝 外交官を公開（+2引いて3枚捨てる）') : null,
      p.hand.includes('horse_traders') ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'HORSE_TRADERS_REACT' }) }, '🐴 馬商人を脇に置く（次の手番に +1カードで戻る／攻撃は受ける）') : null,
      p.hand.includes('beggar') ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'BEGGAR_REACT' }) }, '🥺 物乞いを捨てて銀貨2枚を獲得（1枚は山札の上／攻撃は受ける）') : null,
      p.hand.includes('caravan_guard') ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'CARAVAN_GUARD_REACT' }) }, '🛡 隊商の護衛を先にプレイ（+1カード／次手番+$1／攻撃は受ける）') : null,
      h('button', { class: 'btn btn-primary btn-block', disabled: remain === 0 ? null : 'disabled',
        onclick: () => dispatch({ type: 'MILITIA_RESOLVE', cards: takeSelection(p.hand) }) },
        remain === 0 ? '確定（捨てる）' : 'あと ' + remain + ' 枚 選ぶ'));
    return modalShell('民兵を受ける', '手札が3枚になるまで捨てます。' + (hasMoat ? '「堀」で無効化もできます。' : ''), chips, buttons);
  }
  /* pool＝候補の差し替え（旭日 R2：**手札から「使用する」窓だけ** `DOM.engine.handPlayable(state, pi)`＝
     手札＋山札の影札 を渡す）。**渡さなければ従来どおり手札だけ**＝「捨てる/廃棄する/脇に置く」窓（群B）は
     1ビットも変わらない（影札は手札ではないので選ばせてはいけない）。 */
  function modalSingleHand(p, title, desc, filter, onPick, skip, pickLabel, pool) {
    const lbl = pickLabel || '廃棄する';
    const elig = (pool || p.hand).map((id, idx) => ({ id, idx })).filter((x) => filter(x.id));
    const chips = elig.length
      ? elig.map((x) => cardEl(x.id, { size: 'sm', extra: 'selectable', onClick: () => openPickZoom(x.id, lbl, () => onPick(x.id)) }))
      : [h('p', { class: 'muted' }, '対象のカードがありません')];
    const btn = skip ? h('button', { class: 'btn btn-block', onclick: skip.on }, skip.label) : null;
    return modalShell(title, desc, chips, btn);
  }

  /* 指定した id 群から1枚選ぶモーダル。**サプライの山キーに無いカードも出せる**のが modalGainSupply との違い
     （混合山＝廃墟/騎士/城 の一番上は state.supply にキーが無いため、追放の候補に出せず人間が詰むことがある）。 */
  function modalPickIds(title, desc, ids, onPick, pickLabel, skip, state) {
    // state を渡すと山の残り枚数も出す（追放はサプライの山を1枚減らす＝3山終了に影響するので見えたほうがよい）。
    const remainOf = (id) => {
      if (!state) return null;
      if ((state.supply[id] || 0) > 0) return state.supply[id];
      const k = (DOM.engine.MIXED_PILE_KEYS || []).find((m) => Array.isArray(state[m]) && state[m][0] === id);
      return k ? state[k].length : null;
    };
    const chips = (ids || []).length
      ? ids.map((id) => {
        const el = cardEl(id, { size: 'sm', extra: 'selectable', onClick: () => openPickZoom(id, pickLabel || '選ぶ', () => onPick(id)) });
        const n = remainOf(id);
        return n == null ? el : h('div', { class: 'pick-supply' }, el, h('div', { class: 'pick-remain' }, '残' + n));
      })
      : [h('p', { class: 'muted' }, '対象のカードがありません')];
    const btn = skip ? h('button', { class: 'btn btn-block', onclick: skip.on }, skip.label) : null;
    return modalShell(title, desc, chips, btn);
  }

  /* 移動動物園：苦労（Toil）／進軍（March）＝「アクション権を消費せずにアクション1枚を使用する」選択モーダル。
     zone（手札 or 捨て札）から使えるカードを名前ごとに1枚ずつ並べ、タップで拡大→確定。
     習性（Way）が採用されていれば「記載効果の代わりに習性で使う」も選べる（公式：カードを使用するときはいつでも選べる）。 */
  function modalPlayCardEvent(state, p, title, desc, zone, filter, actionType, skip) {
    const names = [];
    (zone || []).forEach((c) => { if (DOM.CARDS[c] && filter(c) && names.indexOf(c) < 0) names.push(c); });
    const wayList = (state.ways || []).filter((w) => (DOM.LANDSCAPES || {})[w]);
    const chips = names.length
      ? names.map((id) => cardEl(id, { size: 'sm', extra: 'selectable', onClick: () => openPickZoom(id,
          wayList.length ? '使う（カードの効果）' : '使う',
          () => dispatch({ type: actionType, card: id }),
          wayList.map((w) => ({ label: '「' + DOM.LANDSCAPES[w].name + '」で使う', on: () => dispatch({ type: actionType, card: id, way: w }) }))) }))
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
    pruneSelection(p.hand.length);
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
        onclick: () => onConfirm(takeSelection(p.hand)) }, k === 2 ? '2枚捨てて +2 コイン' : ('捨てる2枚を選ぶ（あと ' + (2 - k) + '）')),
      h('button', { class: 'btn btn-block', onclick: () => onConfirm([]) }, '捨てない'));
    return modalShell('風車', '手札を2枚捨てると +2 コイン（しなくてもよい）。', chips, footer);
  }

  // 衛兵: 山札の上2枚を「山札の上／捨て札／廃棄」に振り分ける（タップで切替）。
  function modalSentry(p, cards, onConfirm) {
    pruneSelection((cards || []).length);
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
    const inDebt = (p.debt || 0) > 0; // 帝国：負債があると闇市場でも購入不可
    const noBuy = !!state.turn.noBuyCards; // 冒険：使節団の追加ターンはカードを購入できない（闇市場の購入も購入）
    // 夜想曲：錯乱を返したターンは闇市場でもアクションカードを買えない（engine が拒否＝押せるチップにしない）。
    const noAct = !!state.turn.cantBuyActions && pd.player === state.turn.active;
    const chips = pd.revealed.length ? pd.revealed.map((id) => {
      const cst = effCost(state, id);
      const can = cst <= coins && !inDebt && !noBuy && !(noAct && DOM.isType(id, 'action'));
      return h('div', { class: 'pick-supply' },
        cardEl(id, { size: 'sm', extra: can ? 'selectable' : 'disabled', onClick: can ? () => openPickZoom(id, '購入する（$' + cst + '）', () => dispatch({ type: 'BLACK_MARKET_BUY', card: id })) : null }),
        h('div', { class: 'pick-remain' }, '$' + cst));
    }) : [h('p', { class: 'muted' }, '公開カードがありません')];
    const footer = h('div', null,
      hasTreasure ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'BLACK_MARKET_PLAY_TREASURES' }) }, '💰 手札の財宝を全て出す') : null,
      h('button', { class: 'btn btn-block', onclick: () => dispatch({ type: 'BLACK_MARKET_SKIP' }) }, '買わずに進む'));
    return modalShell('闇市場（所持 ' + coins + ' コイン）',
      inDebt ? '負債があるため購入できません（買わずに進んでください）。'
        : noBuy ? '使節団の追加ターンなので、カードは購入できません（買わずに進んでください）。'
          : '財宝を出してから、公開3枚のうち1枚を購入できます（任意・1枚まで）。', chips, footer);
  }
  // 手札からちょうど n 枚を選んで廃棄
  function modalTrashHand(p, title, desc, n, onConfirm) {
    pruneSelection(p.hand.length);
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
      onclick: () => onConfirm(takeSelection(p.hand)) },
      remain === 0 ? '確定（廃棄）' : 'あと ' + remain + ' 枚 選ぶ');
    return modalShell(title, desc, chips, footer);
  }
  // 願いの井戸: このゲームのカードから1種を宣言
  /* カード名を1つ宣言する（秘術師／医者／熟練工／建て直し）。
     **混合山（廃墟/騎士/城/同盟の分割山）はプレースホルダ（山キー）を出すと絶対に一致しない死に宣言になる**
     （かつ本物の「領地」「要塞」等を名指しできない）＝中身を展開して出す（追求 pursue と同じ扱い）。 */
  function modalNameCard(state, title, desc, onPick) {
    const MIX = (DOM.engine.MIXED_PILE_KEYS || []);
    const names = [];
    const push = (id) => { if (DOM.CARDS[id] && names.indexOf(id) < 0) names.push(id); };
    DOM.SUPPLY_ORDER(state.kingdom).forEach((id) => { if (MIX.indexOf(id) < 0) push(id); });
    MIX.forEach((k) => { (state[k] || []).forEach(push); });
    const chips = names.map((id) =>
      cardEl(id, { size: 'sm', extra: 'selectable', onClick: () => openPickZoom(id, '宣言する', () => onPick(id)) }));
    return modalShell(title, desc, chips, null);
  }
  // 拷問人を受ける: 手札2枚を捨てる / 呪いを受け取る / 堀で無効化
  function modalTorturer(p, hasSecret, hasDiplomat) {
    pruneSelection(p.hand.length);
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
      // 略奪：盾（戦利品）＝堀と同型の免疫（公開しても手札に残る）。**embedded 型のアタック用モーダルは
      //   `reactOptions` を通らないので、ここに手で足さないと人間が盾を使えない。**
      p.hand.includes('shield') ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'SHIELD_REVEAL' }) }, '🛡 盾を公開して無効化（手札に残る）') : null,
      hasSecret ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'SECRET_CHAMBER_REVEAL' }) }, '🔮 秘密の小部屋を公開（+2引いて2枚戻す）') : null,
      hasDiplomat ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'DIPLOMAT_REVEAL' }) }, '🤝 外交官を公開（+2引いて3枚捨てる）') : null,
      p.hand.includes('horse_traders') ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'HORSE_TRADERS_REACT' }) }, '🐴 馬商人を脇に置く（次の手番に +1カードで戻る／攻撃は受ける）') : null,
      p.hand.includes('beggar') ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'BEGGAR_REACT' }) }, '🥺 物乞いを捨てて銀貨2枚を獲得（1枚は山札の上／攻撃は受ける）') : null,
      p.hand.includes('caravan_guard') ? h('button', { class: 'btn btn-block', style: 'margin-bottom:8px', onclick: () => dispatch({ type: 'CARAVAN_GUARD_REACT' }) }, '🛡 隊商の護衛を先にプレイ（+1カード／次手番+$1／攻撃は受ける）') : null,
      h('button', { class: 'btn btn-primary btn-block', disabled: remain === 0 ? null : 'disabled',
        onclick: () => dispatch({ type: 'TORTURER_RESOLVE', choice: 'discard', cards: takeSelection(p.hand) }) },
        remain === 0 ? '手札を捨てる（確定）' : '捨てる ' + remain + ' 枚 を選ぶ'),
      h('button', { class: 'btn btn-block', style: 'margin-top:8px', onclick: () => dispatch({ type: 'TORTURER_RESOLVE', choice: 'curse' }) }, '☠️ 呪いを手札に受け取る'));
    return modalShell('拷問人を受ける', '手札を2枚捨てるか、呪い1枚を手札に受け取ります。' + (hasMoat ? '「堀」で無効化もできます。' : ''), chips, footer);
  }
  // skipOnEmpty: 関数を渡すと「獲得せずに進む」を出す。alwaysSkip=true で候補があっても常時表示（任意獲得）。
  function modalGainSupply(state, title, desc, filter, onPick, skipOnEmpty, alwaysSkip, pickLabel, allowEmpty) {
    // SUPPLY_ORDER は「基本の財宝/勝利点＋王国10種」しか返さない＝**ポーションの山（錬金術）が漏れる**。
    //   engine はポーションを獲得候補として受理するので、チップに出さないと「ちょうど$4を獲得」等の強制獲得で
    //   選択肢0のモーダルになり人間が詰む。supply の残りキーも後ろに足す（非サプライは gainableBase が弾く）。
    const order = DOM.SUPPLY_ORDER(state.kingdom);
    const extra = Object.keys(state.supply).filter((id) => DOM.CARDS[id] && order.indexOf(id) < 0);
    const all = order.concat(extra);
    // 安全網：呼び出し側の filter に書き漏れがあっても、**engine が獲得を拒否する山はチップに出さない**
    //   （非サプライ＝賞品/略奪品/成長先・ロック中の分割山下段・在庫切れ）＝人間が詰む選択肢を1か所で吸収する。
    //   allowEmpty＝「山が空でもよい」用途（教師の山トークン置き先＝公式は空の山にも置ける）。
    const elig = all.filter((id) => filter(id) &&
      // allowEmpty でも**非サプライ山（賞品/成長先/馬/戦利品等）は弾く**＝engine（徴税の TAX_PILE 等）が
      //   NON_SUPPLY を拒否するので、出すと「押しても何も起きない」死にチップになる（敵対レビュー）。
      (allowEmpty ? (state.supply[id] != null && !(E() && E().isNonSupplyPile && E().isNonSupplyPile(id)))
        : ((state.supply[id] || 0) > 0 && canBase(state, id))));
    /* 混合山（騎士/城/同盟の分割山）は**一番上の実カード**を描く（プレースホルダを出すと
       「卜占官 $3」と表示して実際には「巫女 $6」を獲得する、という食い違いになる）。
       dispatch は山キーのまま＝engine は山から一番上を配る（盤面の pileEl・植民のチップと同じ扱い）。 */
    const chips = elig.length
      ? elig.map((id) => h('div', { class: 'pick-supply' },
          cardEl(mixTop(state, id), { size: 'sm', extra: 'selectable', onClick: () => openPickZoom(mixTop(state, id), pickLabel || '獲得する', () => onPick(id)) }),
          h('div', { class: 'pick-remain' }, '残' + (state.supply[id] || 0))))
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
  // extra＝追加の選択肢ボタン（移動動物園：習性で使う／苦労・進軍の「習性で使う」）。省略可。
  function openPickZoom(id, label, onConfirm, extra) { UI.pickZoom = { id, label, onConfirm, extra: extra || null }; render(); }
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
          ...(pz.extra || []).map((b) => h('button', { class: 'btn btn-block', style: 'margin-top:8px', onclick: () => { const f = b.on; UI.pickZoom = null; if (f) f(); } }, b.label)),
          h('button', { class: 'btn btn-ghost btn-block', style: 'margin-top:8px', onclick: () => { UI.pickZoom = null; render(); } }, 'もどる'))));
  }

  /* ---------- 拡大表示（タップで拡大） ---------- */
  function viewSheet() {
    const id = UI.sheet.cardId;
    const c = DOM.CARDS[id];
    const p = UI.sheet.primary;
    const state = UI.store && UI.store.state;
    /* 山の残枚数。混合山（騎士/城/同盟の分割山）は**一番上の実カード**を拡大表示しているので
       その実カードidには supply キーが無い＝山キーの残数を出す（出さないと残枚数だけ消える）。 */
    const remain = (() => {
      if (!state || !state.supply) return null;
      if (state.supply[id] != null) return state.supply[id];
      const k = (DOM.engine.MIXED_PILE_KEYS || []).find((m) => Array.isArray(state[m]) && state[m][0] === id);
      return k ? state[k].length : null;
    })();
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
        // primary は1個でも配列でもよい（移動動物園：習性を使う選択肢を並べる）。
        p ? (Array.isArray(p) ? p : [p]).map((b) =>
          h('button', { class: 'btn ' + (b.cls || '') + ' btn-block', style: 'margin-top:6px', onclick: b.on }, b.label)) : null));
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
              bd ? h('div', { class: 'vbd' }, bd.map((t) => h('div', null, t))) : null,
              // 終了後は全員のデッキ中身を見られる（対戦中は相手の山札/捨て札はマスクされている）。
              row.s.deckCards
                ? h('button', { class: 'btn btn-ghost btn-sm deck-view-btn', onclick: () => { UI.deckView = row.i; sfx('tap'); render(); } },
                  '🃏 デッキを見る（' + (row.s.deckSize || 0) + '枚）')
                : null),
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

  /* ---------- 終局後：各プレイヤーのデッキ内訳（全員ぶんをタブで切り替え） ----------
     対戦中は相手の山札・捨て札・脇置きが maskStateFor で伏せられており、クライアントからは復元できない。
     そこで engine の scoreGame が result.scores[i].deckCards に所有カード全部の枚数を確定して載せている
     （＝オンラインでも「終了後だけ」全員に見せられる。対戦中の情報は一切増えない）。 */
  function viewDeckModal() {
    const s = UI.store && UI.store.state;
    const r = s && s.result;
    if (!r || !r.scores || !r.scores.length) return null;
    const seat = Math.max(0, Math.min(UI.deckView | 0, r.scores.length - 1));
    const sc = r.scores[seat];
    const close = () => { UI.deckView = null; render(); };
    const counts = (sc && sc.deckCards) || {};
    // アクション → 財宝 → 勝利点/呪い の順、その中はコストの高い順（デッキの中身を読み取りやすく）
    const rank = (id) => ((DOM.isType(id, 'victory') || DOM.isType(id, 'curse')) ? 2 : (DOM.isType(id, 'treasure') ? 1 : 0));
    const ids = Object.keys(counts).filter((id) => DOM.CARDS[id])
      .sort((a, b) => rank(a) - rank(b) || DOM.CARDS[b].cost - DOM.CARDS[a].cost || a.localeCompare(b));
    const total = ids.reduce((n, id) => n + counts[id], 0);
    return h('div', { class: 'modal-scrim deck-scrim', onclick: (e) => { if (e.target.classList.contains('modal-scrim')) close(); } },
      h('div', { class: 'modal deck-modal' },
        h('h3', null, '🃏 ' + ((sc && sc.name) || '') + ' のデッキ（' + total + '枚）'),
        h('div', { class: 'mix-chips' }, r.scores.map((x, i) =>
          h('button', { class: 'mix-chip' + (i === seat ? ' on' : ''), onclick: () => { UI.deckView = i; render(); } }, x.name))),
        ids.length
          ? h('div', { class: 'cardlist-grid deck-grid' }, ids.map((id) => cardEl(id, { size: 'sm', count: counts[id], onClick: () => showSheet(id, null) })))
          : h('p', { class: 'muted' }, 'カードがありません'),
        h('p', { class: 'muted', style: 'font-size:11px' },
          '※ 終了時点で持っていたカードすべて（山札・手札・捨て札・場・マット・脇置きを合算）。タップで拡大。'),
        h('button', { class: 'btn btn-block', onclick: close }, 'とじる')));
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
    // 横型ランドスケープ（ランドマーク/イベント/プロジェクト）もこの場で確定して以後固定。
    //   **必ず landscapesForSet（3種を一度に決める唯一の入口）を使う**＝mix モードで「合計最大2枚」を守るため。
    const ls = (DOM.landscapesForSet ? DOM.landscapesForSet(UI.setup.kingdomSet) : { landmarks: [], events: [], projects: [], ways: [] });
    const landmarks = opts.landmarks || ls.landmarks;
    const events = opts.events || ls.events;
    const projects = opts.projects || ls.projects;
    const ways = opts.ways || ls.ways || [];   // 移動動物園：習性（買わない横型）
    const traits = opts.traits || ls.traits || []; // 略奪：特性（買わない横型・山に付く）
    UI.lastConfigs = configs;
    UI.lastKingdom = kingdom;
    UI.lastLandmarks = landmarks;
    UI.lastEvents = events;
    UI.lastProjects = projects;
    UI.lastWays = ways;
    UI.lastTraits = traits;
    const st = E().createInitialState(configs, kingdom, { landmarks, events, projects, ways, traits });
    UI.mode = 'local'; UI.mySeat = null; UI.localViewer = firstHuman(st);
    UI._noAutoSkipOnce = false; // 前の対局で「1手もどす」を押した名残を持ち越さない
    UI.store = DOM.LocalStore(st);
    UI.store.subscribe(onStoreChange);
    UI.view = 'game';
    render();
  }
  function restartLocal() {
    const st = E().createInitialState(UI.lastConfigs, UI.lastKingdom, { landmarks: UI.lastLandmarks || [], events: UI.lastEvents || [], projects: UI.lastProjects || [], ways: UI.lastWays || [], traits: UI.lastTraits || [] });
    UI.localViewer = firstHuman(st);
    UI.store.dispatch({ type: 'NEW_GAME', players: UI.lastConfigs, kingdom: UI.lastKingdom, landmarks: UI.lastLandmarks || [], events: UI.lastEvents || [], projects: UI.lastProjects || [], ways: UI.lastWays || [], traits: UI.lastTraits || [] });
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
        UI.netCanUndo = !!msg.canUndo; UI.netUndoFree = !!msg.undoFree; UI.undoPending = false; UI.undoAskOpen = false;
        UI.store.setState(msg.state);
        UI.view = 'game';
        saveSession();
        render();
        break;
      case 'state':
        // canUndo＝サーバが判定した「この席が今1手もどすを頼めるか」（判定の正本はサーバ）
        // undoFree＝相手の同意なしで戻せるか（＝買い物だけ。ボタンの文言に使う）
        UI.netCanUndo = !!msg.canUndo; UI.netUndoFree = !!msg.undoFree;
        UI.store.setState(msg.state);
        if (msg.state && msg.state.gameOver) clearSession(); // 対戦終了→以後の自動復帰は不要
        else touchSession();
        render();
        break;
      // ---- 1手もどす（オンライン＝承認制） ----
      case 'undoAsk':      // 相手からの要求 → 許可/断るを選ぶ
        askUndoApproval(msg);
        break;
      case 'undoPending':  // 自分の要求がサーバに受理され、相手の返事待ち
        UI.undoPending = true; toast('相手に「1手もどす」を確認しています…'); break;
      case 'undoDone':     // 巻き戻し成立（state は別途配信される）
        UI.undoPending = false; UI.undoAskOpen = false; if (UI.confirm && UI.confirm.sticky) UI.confirm = null;
        toast('↩ ' + (msg.name || '') + ' が1手もどしました');
        render();
        break;
      case 'undoDenied':   // 断られた／時間切れ／局面が動いた
        UI.undoPending = false; UI.undoAskOpen = false; if (UI.confirm && UI.confirm.sticky) UI.confirm = null;
        toast(msg.reason === 'rejected' ? '「1手もどす」は断られました'
          : msg.reason === 'timeout' ? '「1手もどす」は返事がなく取り消しました'
          : '「1手もどす」は成立しませんでした');
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
    UI.netCanUndo = false; UI.netUndoFree = false; UI.undoPending = false; UI.undoAskOpen = false; // 1手もどす（オンライン）の状態も戻す
  }
  function clearGameTimers() {
    if (UI._cpuTimer) { clearTimeout(UI._cpuTimer); UI._cpuTimer = null; }
    if (UI._autoSkipTimer) { clearTimeout(UI._autoSkipTimer); UI._autoSkipTimer = null; }
    // 「1手もどす」直後の自動スキップ抑止は**その対局限り**（次の対局へ持ち越すと、
    //   アクション0枚の1ターン目が自動で購入フェイズへ進まなくなる＝既存機能の退行）。
    UI._noAutoSkipOnce = false;
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
    // sticky＝背景タップで閉じない（必ず返事が要る確認。例＝オンラインの「1手もどす」の許可）
    return h('div', { class: 'modal-scrim', onclick: (e) => { if (!c.sticky && e.target.classList.contains('modal-scrim')) { UI.confirm = null; render(); } } },
      h('div', { class: 'modal confirm-modal' },
        h('p', { class: 'confirm-msg' }, c.message),
        h('button', { class: 'btn btn-primary btn-block', onclick: c.onYes }, c.yesLabel || 'OK'),
        h('button', { class: 'btn btn-ghost btn-block', style: 'margin-top:8px', onclick: c.onNo || (() => { UI.confirm = null; render(); }) }, c.noLabel || '戻る')));
  }

  /* ---------- アクションフェーズの自動スキップ ----------
     手札にアクションカードが1枚も無ければ選択肢はゼロなので、
     少し間を置いて自動で購入フェーズへ進める（毎ターンの無駄タップをなくす）。 */
  function maybeAutoSkipAction() {
    const s = UI.store && UI.store.state;
    if (!s || s.gameOver || UI.view !== 'game' || s.pending) return;
    if (UI.sheet || UI.pickZoom || UI.confirm) return; // 何か見ている間は送らない
    // 「1手もどす」の直後は自動スキップしない（戻した瞬間に購入フェイズへ飛ばされて戻せなくなるため）。
    // 次に何か操作すれば（dispatch）解除される。
    if (UI._noAutoSkipOnce) return;
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
     対戦に入ったら**その対局で実際に使うカードだけ**（サプライの山＋混合山の中身＋横型＝30枚前後）を
     手すきの時間に裏で読み込む（SWがあればキャッシュにも残る）。
     ※以前は DOM.CARDS 全部（560枚≒80MB）を先読みしていたが通信量が過大なのでやめた。
       盤面に出ない札（闇市場・戦利品など）は表示時に読み込まれ、SW が表示したものだけキャッシュする。 */
  function preloadFullArt() {
    const s = UI.store && UI.store.state;
    if (!s || !s.supply || !DOM.CARDS) return;
    const ids = new Set();
    // サプライの山＝supply のキー（基本財宝/勝利点/呪い＋王国10種＋ポーション/植民地/非サプライ山など）
    Object.keys(s.supply).forEach((id) => { if (DOM.CARDS[id]) ids.add(id); });
    // 混合山（廃墟/騎士/城/同盟の分割山6組）は山キーだけでなく中身の実カードも盤面に出る
    ((DOM.engine && DOM.engine.MIXED_PILE_KEYS) || []).forEach((k) => {
      if (Array.isArray(s[k])) s[k].forEach((id) => { if (DOM.CARDS[id]) ids.add(id); });
    });
    // 横型（イベント/ランドマーク/プロジェクト/習性/同盟カード）＋災いカード。'back' 等の非カードidは除外。
    [].concat(s.events || [], s.landmarks || [], s.projects || [], s.ways || [],
      s.ally ? [s.ally] : [], s.baneCard ? [s.baneCard] : [])
      .forEach((id) => { if (DOM.CARDS[id] || (DOM.LANDSCAPES || {})[id]) ids.add(id); });
    // 同じ対局（同じカード集合）では一度だけ。再戦で王国が変われば読み直す。
    const key = Array.from(ids).sort().join(',');
    if (UI._artPreloadKey === key) return;
    UI._artPreloadKey = key;
    const kick = () => {
      try {
        ids.forEach((id) => { const im = new Image(); im.src = 'asset/cards/' + id + '.webp'; });
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
    // カード一覧の検索欄：render() は毎回 DOM を作り直すのでフォーカスとカーソル位置が失われる。
    // 「入力中（UI._searchActive）」のときだけ戻す＝初回表示でスマホのキーボードが勝手に開かない。
    // **カード拡大シート等を開いている間は戻さない**（検索欄にフォーカスを引き戻すと、カードを見た瞬間に
    //   スマホのキーボードが開き直して画面の半分が隠れる）。
    if (UI.view === 'cardList' && UI._searchActive && !UI.sheet && !UI.lmZoom) {
      const si = app.querySelector('.card-search-input');
      if (si) {
        si.focus();
        const pos = (UI._searchCaret == null) ? si.value.length : UI._searchCaret;
        try { si.setSelectionRange(pos, pos); } catch (e) { /* 非対応環境は無視 */ }
      }
    }
    // ログ欄は常に最新行が見える位置へ（全再構築で scrollTop が0に戻るため毎回合わせる）
    const logEl = app.querySelector('.log');
    if (logEl) logEl.scrollTop = logEl.scrollHeight;
    if (UI.revealView != null) { const rm = viewRevealModal(); if (rm) app.appendChild(rm); }
    syncSheet(); // カード説明は専用ホスト常駐（再描画でスクロール位置・画像を保つ）
    if (UI.logModal) app.appendChild(viewLogModal());
    // 終局後のデッキ確認（結果画面でのみ・カード拡大シートより下の層＝タップ拡大が前に出る）
    if (UI.deckView != null) {
      const gs = UI.store && UI.store.state;
      if (UI.view === 'game' && gs && gs.gameOver) { const dm = viewDeckModal(); if (dm) app.appendChild(dm); }
      else UI.deckView = null;
    }
    if (UI.pickZoom) app.appendChild(viewPickZoom()); // 廃棄/獲得カードの拡大確認（最前面）
    if (UI.lmZoom) app.appendChild(viewLandmarkZoom()); // 横型ランドマークの拡大
    if (UI.confirm) app.appendChild(viewConfirm());
    // 対戦中/ロビーで切断〜再接続中はオーバーレイで操作を一旦無効化
    if (UI.reconnecting && (UI.view === 'game' || UI.view === 'lobby')) app.appendChild(viewReconnectOverlay());
    if (UI.toast) app.appendChild(h('div', { class: 'toast' }, UI.toast));
    const histEl = app.querySelector('.log-history');
    if (histEl) histEl.scrollTop = histEl.scrollHeight;
    // モーダル表示中は背面（盤面）のスクロールをロックする
    const modalOpen = !!(UI.sheet || UI.revealView != null || UI.logModal || UI.pickZoom || UI.confirm || UI.lmZoom || UI.deckView != null);
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
