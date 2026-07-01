/* ============================================================
   ドミニオン 基本セット - ゲームエンジン（純粋ロジック）
   状態は JSON シリアライズ可能（Firebase 同期のため）。
   reduce(state, action) -> newState という形で状態遷移する。
   ============================================================ */
(function () {
  const root = (typeof window !== 'undefined') ? window
    : (typeof global !== 'undefined') ? global : globalThis;
  const DOM = (root.DOM = root.DOM || {});

  const clone = (s) => JSON.parse(JSON.stringify(s));
  const C = () => DOM.CARDS;

  // このターンのコスト軽減（「橋」など）を反映した実コスト
  function cardCost(state, id) {
    let base = (C()[id] && C()[id].cost) || 0;
    const t = state.turn;
    const active = t ? state.players[t.active] : null;
    // 繁栄：石切場が場にある間、アクションカードは1枚につき$2安い（$0未満にはならない）。
    if (active && DOM.isType(id, 'action')) {
      const quarries = (active.inPlay || []).filter((x) => x === 'quarry').length;
      if (quarries) base -= 2 * quarries;
    }
    // 繁栄：行商人は購入フェイズ中、場のアクションカード1枚につき$2安い。
    if (id === 'peddler' && active && t.phase === 'buy') {
      const actionsInPlay = (active.inPlay || []).filter((x) => DOM.isType(x, 'action')).length;
      if (actionsInPlay) base -= 2 * actionsInPlay;
    }
    const red = (t && t.costReduction) || 0;
    return Math.max(0, base - red);
  }
  // 錬金術：ポーション費用（「橋」等のコイン軽減では下がらない＝公式どおり固定）。
  function potionCost(id) { return (C()[id] && C()[id].potion) || 0; }
  // 財宝1枚を出したときのコイン。銅細工師の「このターン銅貨+1」(t.copperBonus)を銅貨にだけ加算。
  // PLAY_TREASURE と PLAY_ALL_TREASURES の両方でこれを使い、計算を二重実装しない。
  function treasureCoins(state, id) {
    const base = (C()[id] && C()[id].coin) || 0;
    if (id === 'copper') return base + ((state.turn && state.turn.copperBonus) || 0);
    return base;
  }
  // 財宝1枚を手札から場に出してコインを加算。「商人」の“このターン最初の銀貨で+1コイン（商人の数だけ）”もここで処理。
  // PLAY_TREASURE / PLAY_ALL_TREASURES / 闇市場 で共通利用。
  function playTreasureCard(state, pIndex, card) {
    const p = state.players[pIndex];
    const t = state.turn;
    removeOne(p.hand, card);
    p.inPlay.push(card);
    t.coins += treasureCoins(state, card);
    // 錬金術：ポーション（特殊財宝）＝コインではなく「ポーション」を1つ得る（ポーション費用の支払いに使う）。
    if (card === 'potion') { t.potions = (t.potions || 0) + 1; }
    // 錬金術：賢者の石＝出したとき山札+捨て札の合計5枚につき +1コイン（端数切捨て）。
    if (card === 'philosophers_stone') {
      const n = p.deck.length + p.discard.length;
      const add = Math.floor(n / 5);
      t.coins += add;
      log(state, `${p.name} は賢者の石を使った（山札+捨て札 ${n}枚 → +${add}コイン）。`);
    }
    if (card === 'silver' && !t.silverPlayed) {
      if (t.merchants) { t.coins += t.merchants; log(state, `${p.name} は商人の効果で +${t.merchants} コイン。`); }
      t.silverPlayed = true;
    }
    // 海辺：アストロラーベ（財宝・持続）＝このターン +1コイン +1購入、次の手番開始時も同じ。
    if (card === 'astrolabe') {
      t.coins += 1; t.buys += 1;
      armDuration(state, pIndex, 'astrolabe');
      log(state, `${p.name} はアストロラーベを使った（+1コイン +1購入。次の手番にも）。`);
    }
    // 海辺：海賊（財宝・持続）＝次の手番に6コスト以下の財宝1枚を手札に獲得。
    if (card === 'pirate') {
      armDuration(state, pIndex, 'pirate');
      log(state, `${p.name} は海賊を使った（次の手番に財宝を手札に獲得）。`);
    }
    // ===== 繁栄：財宝カードの「使ったとき」効果 =====
    // 銀行：場の財宝1枚につき +1コイン（これ自身も数える。inPlay には既に積んである）。
    if (card === 'bank') {
      const cnt = p.inPlay.filter((c) => DOM.isType(c, 'treasure')).length;
      t.coins += cnt; log(state, `${p.name} は銀行を使った（場の財宝${cnt}枚 → +${cnt}コイン）。`);
    }
    // 収集：+1購入（コイン2は coin:2 で加算済み）。アクション獲得時の+VPは triggerOnGain が処理。
    if (card === 'collection') t.buys += 1;
    // ペテン師：他のプレイヤーは各自 銅貨1枚を獲得（アタック）。コイン3は coin:3 で加算済み。
    if (card === 'charlatan') {
      const q = [];
      for (let k = 1; k < state.players.length; k++) q.push((pIndex + k) % state.players.length);
      charlatanEnterVictim(state, pIndex, q);
    }
    // 金床：財宝1枚を捨ててコスト4以下を獲得してよい（コイン1は coin:1）。
    if (card === 'anvil' && p.hand.some((c) => DOM.isType(c, 'treasure'))) {
      state.pending = { type: 'anvil', stage: 'discard', player: pIndex };
    }
    // 投資：これを廃棄。+1コイン か 「財宝1枚を廃棄して場の財宝の種類ぶん +VP」を選ぶ。
    if (card === 'investment') {
      removeOne(p.inPlay, 'investment'); state.trash.push('investment');
      state.pending = { type: 'investment', player: pIndex };
    }
    // 水晶玉：山札の上1枚を見て 廃棄／捨て札／（アクションか財宝なら）使う（コイン1は coin:1）。
    if (card === 'crystal_ball') {
      if (p.deck.length === 0 && p.discard.length > 0) { p.deck = shuffle(p.discard); p.discard = []; }
      if (p.deck.length > 0) state.pending = { type: 'crystal_ball', player: pIndex, card: p.deck[0] };
    }
    // ティアラ：+1購入。手札の財宝1枚を2回使ってよい（獲得時の山札上置きは triggerOnGain が処理）。
    if (card === 'tiara') {
      t.buys += 1;
      if (p.hand.some((c) => DOM.isType(c, 'treasure'))) state.pending = { type: 'tiara_play', player: pIndex };
    }
    // 海辺：私掠船マーク中なら、このターン最初の銀貨/金貨は出した後に廃棄される（コインは入る）。
    corsairOnPlayTreasure(state, pIndex, card);
  }

  /* ---------- 乱数・シャッフル ---------- */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------- サプライ初期化 ----------
     勝利点の山は人数で枚数が変わる（2人=8, 3-4人=12）。屋敷/公領/属州だけでなく
     王国の勝利点カード（庭園・公爵・貴族・大広間・後宮・製粉所 等、勝利点タイプを持つもの）
     も同じ枚数にする。それ以外の王国カードは常に10枚。 */
  function initSupply(numPlayers, kingdom) {
    const v = numPlayers <= 2 ? 8 : 12; // 勝利点の山（2人=8, 3-4人=12）
    const supply = {
      copper: 60 - 7 * numPlayers,
      silver: 40,
      gold: 30,
      estate: v,
      duchy: v,
      province: v,
      curse: 10 * (numPlayers - 1),
    };
    kingdom.forEach((k) => (supply[k] = DOM.isType(k, 'victory') ? v : 10));
    // 錬金術：王国にポーション費用カードがあれば、ポーション山（公式は16枚）を共通サプライに加える。
    if (kingdom.some((k) => C()[k] && C()[k].potion)) supply.potion = 16;
    // 繁栄：王国に繁栄の王国カードがあれば、プラチナ貨（12枚）と植民地（勝利点と同枚数）を共通サプライに加える。
    if (kingdom.some((k) => (DOM.POOLS.prosperity || []).indexOf(k) >= 0)) {
      supply.platinum = 12;
      supply.colony = v;
    }
    return supply;
  }

  // 1ターン分の turn オブジェクトを作る（createInitialState と cleanupAndAdvance で共用＝フィールドのズレ防止）。
  // 海辺用に gainedThisTurn（このターン獲得したid列・密輸人/宝物庫用）/ outpostUsed / isExtraTurn / startQueue を追加。
  function freshTurn(active, isExtraTurn, extra) {
    extra = extra || {};
    return {
      active, phase: 'action', actions: 1, buys: 1, coins: 0, potions: 0, costReduction: 0,
      actionsPlayed: 0, copperBonus: 0, merchants: 0, silverPlayed: false,
      gainedThisTurn: [], outpostUsed: false, isExtraTurn: !!isExtraTurn, startQueue: null,
      corsairTrashed: false, // 私掠船：このターンに最初の銀/金を廃棄済みか（被害者ごと）
      // 錬金術・支配：rotationSeat＝この手番が属する「通常の手番順の位置」（追加ターンでも回り順を崩さない）。
      // possessedBy＝この手番を操作している支配者の席（支配されていなければ null）。
      rotationSeat: extra.rotationSeat != null ? extra.rotationSeat : active,
      possessedBy: extra.possessedBy != null ? extra.possessedBy : null,
    };
  }

  /* ---------- 初期状態 ----------
     playerConfigs: 文字列(名前)または {name, isCpu, level} の配列（2〜4人）
     opts.startActive: 開始プレイヤー。整数(席番号) または 'random'。
       公式ルールは「ランダムに決める」。省略時は席0（既存テスト互換）。 */
  function createInitialState(playerConfigs, kingdom, opts) {
    kingdom = kingdom || DOM.KINGDOM;
    opts = opts || {};
    const cfgs = (playerConfigs || []).map((x) =>
      typeof x === 'string'
        ? { name: x, isCpu: false, level: 'normal' }
        : { name: x.name, isCpu: !!x.isCpu, level: x.level || 'normal' }
    );
    const players = cfgs.map((cfg, i) => {
      const start = [];
      for (let n = 0; n < 7; n++) start.push('copper');
      for (let n = 0; n < 3; n++) start.push('estate');
      const deck = shuffle(start);
      const hand = deck.splice(0, 5);
      return {
        id: i,
        name: cfg.name || `プレイヤー${i + 1}`,
        isCpu: cfg.isCpu,
        cpuLevel: cfg.level,
        deck,
        hand,
        discard: [],
        inPlay: [],
        turns: 0,
        // 海辺（持続/マット）用の状態。すべてJSONセーフ＝スナップショット/再接続でそのまま保存復元される。
        durationCards: [], // 場に残る持続カード（クリーンアップで捨てずに持ち越す。inPlay と同じく公開情報）
        delayedEffects: [], // 次の自分の手番開始時に解決する予約効果 {card, type, ...data}
        setAside: [],      // 伏せて脇に置く私的カード（停泊所/封鎖の獲得物など。相手には伏せる）
        islandMat: [],     // 島マット（ゲームから外れるが所有者のVPに数える。公開）
        nativeVillageMat: [], // 原住民の村マット（手札に回収できる。秘密）
        lastTurnGains: [], // 直前の自分の手番に獲得したカードid（密輸人が右隣のこれを参照）
        vpTokens: 0,       // 繁栄：勝利点トークンの累計（司教・記念碑・収集・投資。公開・終了時に加算）
      };
    });

    // 開始プレイヤー（公式: ランダム）。範囲外は席0に丸める。
    let startActive = 0;
    if (opts.startActive === 'random') startActive = Math.floor(Math.random() * players.length);
    else if (Number.isInteger(opts.startActive) && opts.startActive >= 0 && opts.startActive < players.length)
      startActive = opts.startActive;

    const supply = initSupply(players.length, kingdom);

    // 闇市場(Black Market)デッキ：使用中のサプライに無い王国カードを1枚ずつ集めてシャッフル。
    // 闇市場が王国に含まれるときだけ用意する。
    let blackMarket = null;
    if (kingdom.indexOf('black_market') >= 0) {
      const universe = Array.from(new Set([].concat.apply([], Object.values(DOM.POOLS || {}))));
      const inSupply = (id) => Object.prototype.hasOwnProperty.call(supply, id);
      blackMarket = shuffle(universe.filter((id) => DOM.CARDS[id] && id !== 'black_market' && !inSupply(id)));
    }

    return {
      version: 0,
      kingdom,
      players,
      supply,
      trash: [],
      blackMarket, // 闇市場デッキ（無ければ null）
      turn: freshTurn(startActive),
      pending: null, // 選択待ち {type, player, ...}
      logSeq: 1, // ログの通し番号（効果音などが「新しい行」を確実に検知するため）
      log: [`ゲーム開始。${players[startActive].name} の番です。`],
      gameOver: false,
      result: null,
    };
  }

  /* ---------- ログ ---------- */
  function log(state, msg) {
    state.log.push(msg);
    state.logSeq = (state.logSeq || 0) + 1;
    if (state.log.length > 200) state.log = state.log.slice(-200);
  }

  /* ---------- 公開（reveal）チャネル ----------
     「カードを表向きにした」出来事を全員に見せるための公開情報。役人などは自分の盤面に
     見える変化が無いため、これが無いと「何も起きていない」ように見える。
     席ごと（state.reveals[席]）に保持するので、複数の相手が公開しても全員ぶんが残り、
     UI で各プレイヤーの表示をタップすればその人の公開カードを確認できる。
     seat=公開した席 / cards=公開カードid配列 / note=どの効果による公開か。
     revealLatest=直近に公開した席（点滅・通知用）。公開は公式どおり全員に見える情報なので
     maskStateFor でも伏せない（clone がそのまま運ぶ）。*/
  function reveal(state, seat, cards, note) {
    const list = (cards || []).filter(Boolean).slice(0, 8);
    if (!list.length) return;
    state.revealSeq = (state.revealSeq || 0) + 1;
    if (!state.reveals) state.reveals = {};
    state.reveals[seat] = { cards: list.slice(), note: note || '', seq: state.revealSeq };
    state.revealLatest = seat;
  }

  /* ---------- カード操作 ---------- */
  function removeOne(arr, cardId) {
    const i = arr.indexOf(cardId);
    if (i >= 0) arr.splice(i, 1);
    return i >= 0;
  }

  // pIndex のプレイヤーが n 枚引く（山切れで捨て札をシャッフル）
  function draw(state, pIndex, n) {
    const p = state.players[pIndex];
    const drawn = [];
    for (let i = 0; i < n; i++) {
      if (p.deck.length === 0) {
        if (p.discard.length === 0) break;
        p.deck = shuffle(p.discard);
        p.discard = [];
      }
      drawn.push(p.deck.shift());
    }
    p.hand.push(...drawn);
    return drawn;
  }

  // サプライから pIndex が dest('discard'|'hand'|'deck') にカードを獲得
  function gain(state, pIndex, cardId, dest) {
    if ((state.supply[cardId] || 0) <= 0) return false;
    const t = state.turn;
    // 錬金術・支配：被支配者（手番のactive）が獲得するカードは脇に避け、ターン終了時に
    // 支配者の捨て札へ渡す（獲得先が手札/山札でも脇に置く＝公式のルーリング）。獲得フックも動かさない。
    if (t && t.possessedBy != null && pIndex === t.active) {
      state.supply[cardId] -= 1;
      (t.possessionGains = t.possessionGains || []).push(cardId);
      log(state, `${state.players[pIndex].name} が獲得した「${C()[cardId].name}」は脇に置かれた（支配：${state.players[t.possessedBy].name} が受け取る）。`);
      return true;
    }
    state.supply[cardId] -= 1;
    const p = state.players[pIndex];
    if (dest === 'hand') p.hand.push(cardId);
    else if (dest === 'deck') p.deck.unshift(cardId);
    else p.discard.push(cardId);
    // 海辺：手番プレイヤーの獲得を記録（密輸人・宝物庫の「このターン勝利点を獲得したか」用）
    if (state.turn && pIndex === state.turn.active) {
      (state.turn.gainedThisTurn || (state.turn.gainedThisTurn = [])).push(cardId);
    }
    triggerOnGain(state, pIndex, cardId, dest); // サル/封鎖/船乗りの「獲得時」フック（§手6で実装）
    return true;
  }

  // 「自分のカード」を廃棄置き場へ送る共通入口。錬金術・支配：支配中は被支配者（手番の
  // active）が廃棄した自分のカードを脇に避け、ターン終了時に被支配者の捨て札へ戻す
  // （支配では相手の良いカードを永久に廃棄できない＝公式どおり）。それ以外は通常どおり廃棄。
  // ※アタックで「他人」のカードを廃棄する処理（詐欺師/破壊工作員/山賊）はこれを通さない。
  function trashOwn(state, ownerIdx, card) {
    const t = state.turn;
    if (t && t.possessedBy != null && ownerIdx === t.active) {
      (t.possessionTrash = t.possessionTrash || []).push(card);
    } else {
      state.trash.push(card);
    }
  }

  // 条件に合う獲得可能なカードがサプライに1枚でもあるか
  function anyGainable(state, predicate) {
    return Object.keys(state.supply).some(
      (id) => (state.supply[id] || 0) > 0 && predicate(id)
    );
  }
  // 繁栄：コスト/購入数/サプライ以外の「購入できない」追加制限。
  //   高級市場(grand_market)＝場に銅貨があるとき購入不可。CPU/UI もこれを参照して空振りを防ぐ。
  function canBuyCard(state, pi, id) {
    if (id === 'grand_market' && state.players[pi].inPlay.includes('copper')) return false;
    return true;
  }

  // 隠し財産(Hoard): いまは「獲得時」フック(triggerOnGain)で金貨を獲得する（購入に限らず faithful）。
  // 互換のため関数は残すが何もしない（BUY/闇市場の呼び出し側は変更不要）。
  function applyHoardOnBuy() { /* no-op: hoard は triggerOnGain で処理 */ }

  /* ---------- 選択リゾルバの共通部品（カードを足すほど効く再利用パーツ）----------
     手札からN枚を捨てる/廃棄する、強制つきでサプライから獲得する、の3定型を1か所に。
     検証（指定枚数・全て手札にある・在庫・コスト/種別条件・強制獲得時のデッドロック回避）を
     共通化し、各カードの *_RESOLVE は数行で書けるようにする。 */
  // 手札からちょうど want 枚を捨て札へ。検証OKなら実行して true、不正なら false（呼び出し側は state を据え置く）。
  function discardFromHand(state, pIndex, cards, want, note) {
    const p = state.players[pIndex];
    cards = Array.isArray(cards) ? cards : [];
    if (cards.length !== want) return false;
    const copy = p.hand.slice();
    for (const c of cards) if (!removeOne(copy, c)) return false; // 手札に無い指定は拒否
    cards.forEach((c) => { removeOne(p.hand, c); p.discard.push(c); });
    if (cards.length && note) log(state, `${p.name} は ${cards.length}枚 ${note}`);
    return true;
  }
  // 手札からちょうど want 枚を廃棄（trash）へ。検証つき。
  function trashFromHand(state, pIndex, cards, want, note) {
    const p = state.players[pIndex];
    cards = Array.isArray(cards) ? cards : [];
    if (cards.length !== want) return false;
    const copy = p.hand.slice();
    for (const c of cards) if (!removeOne(copy, c)) return false;
    cards.forEach((c) => { removeOne(p.hand, c); state.trash.push(c); });
    if (cards.length && note) log(state, `${p.name} は ${cards.length}枚 ${note}`);
    return true;
  }
  // 「強制獲得つき」獲得解決。card が条件(canGain)を満たせば dest へ獲得し pending=null。
  //   card==null: 候補があるうちは獲得必須（pending据え置き）／候補ゼロなら辞退OK(pending=null)。
  //   不正な card: pending据え置き（再選択）。呼び出し側は本関数の後に return state するだけ。
  function finishGain(state, pd, card, canGain, dest, note) {
    if (card == null) {
      if (anyGainable(state, canGain)) return false; // 候補あり→獲得必須
      state.pending = null; return true;             // 候補なし→辞退
    }
    if (!canGain(card) || (state.supply[card] || 0) <= 0) return false;
    gain(state, pd.player, card, dest);
    if (note) log(state, `${state.players[pd.player].name} は「${C()[card].name}」を${note}`);
    state.pending = null;
    return true;
  }

  // 民兵：次の対象プレイヤーへ進む（いなければ選択待ち解除）
  function advanceMilitia(state, pd) {
    if (pd.queue && pd.queue.length) {
      state.pending = { type: 'militia', player: pd.queue[0], source: pd.source, queue: pd.queue.slice(1) };
    } else {
      state.pending = null;
    }
  }
  // アタック全般：キューの次の対象へ進む（pd.type を引き継ぐ）。拷問人など複数対象アタック共通。
  function advanceAttack(state, pd) {
    if (pd.queue && pd.queue.length) {
      state.pending = { type: pd.type, player: pd.queue[0], source: pd.source, queue: pd.queue.slice(1) };
    } else {
      state.pending = null;
    }
  }

  /* ---------- 詐欺師（複数対象＋攻撃側が獲得物を選ぶ段階アタック）---------- */
  // 次の犠牲者へ。堀持ちなら反応(react)を待ち、いなければ即廃棄処理へ。queue 空で終了。
  function swindlerEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v)); // 灯台：免疫の被害者は対象外
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0];
    const rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'swindler', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      swindlerTrash(state, source, victim, rest);
    }
  }
  // 犠牲者の山札の上1枚を廃棄→攻撃側が同コストの獲得物を選ぶ（候補が無ければ次へ）。
  function swindlerTrash(state, source, victim, queue) {
    const v = state.players[victim];
    if (v.deck.length === 0 && v.discard.length > 0) { v.deck = shuffle(v.discard); v.discard = []; }
    if (v.deck.length === 0) {
      log(state, `${v.name} は山札が空で廃棄できなかった。`);
      swindlerEnterVictim(state, source, queue);
      return;
    }
    const trashed = v.deck.shift();
    state.trash.push(trashed);
    log(state, `${v.name} は山札の上の「${C()[trashed].name}」を廃棄した。`);
    const cst = cardCost(state, trashed);
    if (anyGainable(state, (id) => cardCost(state, id) === cst)) {
      state.pending = { type: 'swindler', stage: 'gain', player: source, source, victim, cost: cst, queue };
    } else {
      swindlerEnterVictim(state, source, queue); // 同コストの獲得候補が無ければ獲得なしで次へ
    }
  }

  /* ---------- 破壊工作員（複数対象。$3以上を1枚廃棄→犠牲者が任意で格下げ獲得）---------- */
  function saboteurEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v)); // 灯台：免疫の被害者は対象外
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'saboteur', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      saboteurReveal(state, source, victim, rest);
    }
  }
  function saboteurReveal(state, source, victim, queue) {
    const v = state.players[victim];
    const setAside = [];
    let trashed = null;
    // $3以上が出るまで山札の上を公開（足りなければreshuffle、尽きたら終了）
    while (true) {
      if (v.deck.length === 0) {
        if (v.discard.length === 0) break;
        v.deck = shuffle(v.discard); v.discard = [];
      }
      const c = v.deck.shift();
      if (cardCost(state, c) >= 3) { trashed = c; break; }
      setAside.push(c);
    }
    setAside.forEach((c) => v.discard.push(c)); // $3未満の公開札は捨てる
    if (trashed) {
      state.trash.push(trashed);
      log(state, `${v.name} は山札の上から「${C()[trashed].name}」を廃棄した。`);
      const maxCost = Math.max(0, cardCost(state, trashed) - 2);
      state.pending = { type: 'saboteur', stage: 'gain', player: victim, source, victim, maxCost, queue };
    } else {
      log(state, `${v.name} は $3 以上のカードが無く、廃棄しなかった。`);
      saboteurEnterVictim(state, source, queue);
    }
  }

  /* ---------- 手先（攻撃側の選択＋全相手に作用するアタック）---------- */
  function minionAttackEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v)); // 灯台：免疫の被害者は対象外
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'minion_attack', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      minionAttackApply(state, source, victim, rest);
    }
  }
  function minionAttackApply(state, source, victim, queue) {
    const v = state.players[victim];
    if (v.hand.length >= 5) { // 解決時点で手札5枚以上の相手だけ捨てて4枚引く
      v.discard.push(...v.hand); v.hand = [];
      draw(state, victim, 4);
      log(state, `${v.name} は手札を捨てて4枚引いた（手先）。`);
    }
    minionAttackEnterVictim(state, source, queue);
  }

  /* ---------- 仮面舞踏会（全員が同時に手札1枚を左隣へ渡す）---------- */
  // 手札のあるプレイヤーを手番順（使用者から）に並べる。空手札の人は渡せない。
  function masqueradePassOrder(state, source) {
    const n = state.players.length, order = [];
    for (let k = 0; k < n; k++) { const idx = (source + k) % n; if (state.players[idx].hand.length > 0) order.push(idx); }
    return order;
  }
  // 集めた選択を一斉に適用（先に全員から取り除き→左隣へ配る＝同時）。左隣は (idx+1)%n。
  function masqueradeApplyPasses(state, order, picks) {
    const n = state.players.length;
    order.forEach((idx) => { removeOne(state.players[idx].hand, picks[idx]); });
    order.forEach((idx) => { state.players[(idx + 1) % n].hand.push(picks[idx]); });
    log(state, '仮面舞踏会：各プレイヤーが手札1枚を左隣へ渡した。');
  }
  function masqueradeAfterPass(state, source) {
    // 使用者は手札を1枚廃棄してよい（任意）
    state.pending = state.players[source].hand.length > 0
      ? { type: 'masquerade', stage: 'trash', player: source, source }
      : null;
  }

  // リアクション札（堀／秘密の小部屋）を持つか。被攻撃側に反応の機会を与えるか判定に使う。
  function hasReaction(player) {
    return player.hand.includes('moat') || player.hand.includes('secret_chamber') ||
      (player.hand.includes('diplomat') && player.hand.length >= 5);
  }
  // 秘密の小部屋のリアクションを差し込める「被攻撃側の反応ステップ」か。
  /* ---------- アタック登録表（唯一の正本）----------
     新しいアタックを足すときは、ここに1行 ＋ 対応する EnterVictim と *_REACT リゾルバを書くだけ。
     堀(MOAT_REVEAL)・秘密の小部屋・外交官の反応窓口の判定と「無効化されたら次の被害者へ」は
     すべてこの表を引いて行う＝ MOAT_REVEAL に分岐を書き足し忘れて堀が効かない事故を防ぐ。
       embedded … 被攻撃者の解決ステップ自体が反応窓口（民兵・拷問人。'react'ステージを持たない）。
       onMoat  … 堀で無効化されたとき、その被害者を飛ばして次へ進める関数。
     test/integrity.test.js が「'react'ステージを作るアタックは全てここに登録済み」を自動検証する。 */
  const ATTACKS = {
    militia:       { embedded: true, onMoat: (s, pd) => advanceMilitia(s, pd) },
    torturer:      { embedded: true, onMoat: (s, pd) => advanceAttack(s, pd) },
    witch:         { onMoat: (s, pd) => witchEnterVictim(s, pd.source, pd.queue) },
    bureaucrat:    { onMoat: (s, pd) => bureaucratEnterVictim(s, pd.source, pd.queue) },
    spy:           { onMoat: (s, pd) => spyEnterTarget(s, pd.source, pd.queue) },
    thief:         { onMoat: (s, pd) => thiefEnterVictim(s, pd.source, pd.queue) },
    swindler:      { onMoat: (s, pd) => swindlerEnterVictim(s, pd.source, pd.queue) },
    saboteur:      { onMoat: (s, pd) => saboteurEnterVictim(s, pd.source, pd.queue) },
    minion_attack: { onMoat: (s, pd) => minionAttackEnterVictim(s, pd.source, pd.queue) },
    bandit:        { onMoat: (s, pd) => banditEnterVictim(s, pd.source, pd.queue) },
    replace:       { onMoat: (s, pd) => replaceEnterVictim(s, pd.source, pd.queue) },
    cutpurse:      { onMoat: (s, pd) => cutpurseEnterVictim(s, pd.source, pd.queue) },
    sea_witch:     { onMoat: (s, pd) => seaWitchEnterVictim(s, pd.source, pd.queue) },
    // 封鎖：プレイ時のアタック。堀を公開した相手はこの封鎖の呪い窓から免疫（immune 登録）＝以後同名を獲得しても呪いを受けない。
    blockade:      { onMoat: (s, pd) => { markBlockadeImmune(s, pd.source, pd.gained, pd.victim); blockadeEnterVictim(s, pd.source, pd.queue, pd.gained); } },
    familiar:      { onMoat: (s, pd) => familiarEnterVictim(s, pd.source, pd.queue) },
    scrying_pool:  { onMoat: (s, pd) => scryingEnterTarget(s, pd.source, pd.queue) },
    charlatan:     { onMoat: (s, pd) => charlatanEnterVictim(s, pd.source, pd.queue) },
    rabble:        { onMoat: (s, pd) => rabbleEnterVictim(s, pd.source, pd.queue) },
    clerk:         { onMoat: (s, pd) => clerkEnterVictim(s, pd.source, pd.queue) },
  };
  // 被攻撃側の反応（堀／秘密の小部屋／外交官）を差し込める局面か。
  function isAttackReactPending(pd) {
    if (!pd) return false;
    const a = ATTACKS[pd.type];
    if (!a) return false;
    return !!a.embedded || pd.stage === 'react';
  }

  /* ---------- 書庫（手札が7枚になるまで引く。引いたアクションは脇に置ける）---------- */
  function libraryStep(state, pi, aside) {
    const p = state.players[pi];
    while (p.hand.length < 7) {
      if (p.deck.length === 0) {
        if (p.discard.length === 0) break;
        p.deck = shuffle(p.discard); p.discard = [];
      }
      if (p.deck.length === 0) break;
      const c = p.deck.shift();
      p.hand.push(c);
      if (DOM.isType(c, 'action')) { // アクションは脇に置くか選ぶ
        state.pending = { type: 'library', player: pi, aside, card: c };
        return;
      }
    }
    aside.forEach((x) => p.discard.push(x));
    if (aside.length) log(state, `${p.name} は脇に置いた ${aside.length}枚 を捨てた（書庫）。`);
    state.pending = null;
  }

  /* ---------- 密偵（全員の山札の上を公開、使用者が各自について捨てる/戻すを決める）---------- */
  function spyEnterTarget(state, attacker, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => v === attacker || !attackImmune(state, v)); // 灯台：免疫の相手は対象外（自分は対象）
    if (!queue.length) { state.pending = null; return; }
    const target = queue[0], rest = queue.slice(1);
    if (target !== attacker && hasReaction(state.players[target])) {
      state.pending = { type: 'spy', stage: 'react', player: target, source: attacker, victim: target, queue: rest };
    } else {
      spyReveal(state, attacker, target, rest);
    }
  }
  function spyReveal(state, attacker, target, queue) {
    const tp = state.players[target];
    if (tp.deck.length === 0 && tp.discard.length > 0) { tp.deck = shuffle(tp.discard); tp.discard = []; }
    if (tp.deck.length === 0) { // 公開する札が無い
      spyEnterTarget(state, attacker, queue);
      return;
    }
    reveal(state, target, [tp.deck[0]], '密偵で山札の上を公開');
    state.pending = { type: 'spy', stage: 'decide', player: attacker, source: attacker, victim: target, card: tp.deck[0], queue };
  }

  /* ---------- 泥棒（他の各自が上2枚公開、使用者が財宝1枚を廃棄→獲得してよい）---------- */
  function thiefEnterVictim(state, attacker, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v)); // 灯台：免疫の被害者は対象外
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'thief', stage: 'react', player: victim, source: attacker, victim, queue: rest };
    } else {
      thiefReveal(state, attacker, victim, rest);
    }
  }
  function thiefReveal(state, attacker, victim, queue) {
    const v = state.players[victim];
    const revealed = [];
    for (let i = 0; i < 2; i++) {
      if (v.deck.length === 0) { if (v.discard.length === 0) break; v.deck = shuffle(v.discard); v.discard = []; }
      if (v.deck.length === 0) break;
      revealed.push(v.deck.shift());
    }
    if (revealed.length) reveal(state, victim, revealed, '泥棒で山札の上を公開');
    const treasures = revealed.filter((c) => DOM.isType(c, 'treasure'));
    if (treasures.length) {
      state.pending = { type: 'thief', stage: 'pick', player: attacker, source: attacker, victim, revealed, treasures, queue };
    } else {
      revealed.forEach((c) => v.discard.push(c)); // 財宝なし→全部捨てる
      if (revealed.length) log(state, `${v.name} は公開した ${revealed.length}枚 を捨てた（泥棒）。`);
      thiefEnterVictim(state, attacker, queue);
    }
  }

  /* ---------- 魔女（複数対象。各相手が呪いを獲得）---------- */
  function witchEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v)); // 灯台：免疫の被害者は対象外
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'witch', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      witchCurse(state, source, victim, rest);
    }
  }
  function witchCurse(state, source, victim, queue) {
    if ((state.supply.curse || 0) > 0) {
      gain(state, victim, 'curse', 'discard');
      log(state, `${state.players[victim].name} は呪いを獲得した（魔女）。`);
    }
    witchEnterVictim(state, source, queue);
  }

  /* ---------- 錬金術：使い魔（魔女と同型。各相手が呪いを獲得）---------- */
  function familiarEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v)); // 灯台：免疫の被害者は対象外
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'familiar', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      familiarCurse(state, source, victim, rest);
    }
  }
  function familiarCurse(state, source, victim, queue) {
    if ((state.supply.curse || 0) > 0) {
      gain(state, victim, 'curse', 'discard');
      log(state, `${state.players[victim].name} は呪いを獲得した（使い魔）。`);
    }
    familiarEnterVictim(state, source, queue);
  }

  /* ---------- 錬金術：念視の泉（全員の山札の上を公開、使用者が捨てる/戻すを決める。
     その後、使用者はアクション以外が出るまで山札を公開して全て手札に加える）---------- */
  function scryingEnterTarget(state, attacker, queue) {
    while (queue && queue.length) {
      const target = queue[0];
      if (target !== attacker) { // 相手はアタック（灯台免疫・堀リアクション）
        if (attackImmune(state, target)) { queue = queue.slice(1); continue; }
        if (hasReaction(state.players[target])) {
          state.pending = { type: 'scrying_pool', stage: 'react', player: target, source: attacker, victim: target, queue: queue.slice(1) };
          return;
        }
      }
      scryingReveal(state, attacker, target, queue.slice(1));
      return;
    }
    scryingDraw(state, attacker); // 全員終わったら使用者の連続公開ドロー
  }
  function scryingReveal(state, attacker, target, queue) {
    const tp = state.players[target];
    if (tp.deck.length === 0 && tp.discard.length > 0) { tp.deck = shuffle(tp.discard); tp.discard = []; }
    if (tp.deck.length === 0) { scryingEnterTarget(state, attacker, queue); return; } // 公開できる札なし
    reveal(state, target, [tp.deck[0]], '念視の泉で山札の上を公開');
    state.pending = { type: 'scrying_pool', stage: 'decide', player: attacker, source: attacker, victim: target, card: tp.deck[0], queue };
  }
  function scryingDraw(state, attacker) {
    const ap = state.players[attacker];
    const taken = [];
    let guard = 0;
    while (guard++ < 100) {
      if (ap.deck.length === 0) { if (ap.discard.length === 0) break; ap.deck = shuffle(ap.discard); ap.discard = []; }
      if (ap.deck.length === 0) break;
      const c = ap.deck.shift();
      taken.push(c); ap.hand.push(c);
      if (!DOM.isType(c, 'action')) break; // アクション以外が出たら止める（それも手札に加わる）
    }
    if (taken.length) { reveal(state, attacker, taken, '念視の泉で公開'); log(state, `${ap.name} は念視の泉でアクション以外が出るまで公開し、${taken.length}枚を手札に加えた。`); }
    state.pending = null;
  }

  /* ---------- 錬金術：ゴーレム（見つけた2枚のアクションを好きな順で使う）----------
     first を即 applyEffect、second は玉座と同じ replay キューへ（pending 解消後に runReplays）。*/
  function golemPlay(state, pi, first, second) {
    const p = state.players[pi];
    state.pending = null;
    if (second != null) { state.replay = state.replay || []; state.replay.push({ player: pi, card: second, label: 'golem' }); }
    p.inPlay.push(first);
    state.turn.actionsPlayed = (state.turn.actionsPlayed || 0) + 1; // 使った扱い（共謀者等の「このターンに使ったアクション数」に数える）
    log(state, `${p.name} はゴーレムで「${C()[first].name}」を使った。`);
    applyEffect(state, first, pi);
  }

  /* ---------- 役人（複数対象。各相手が勝利点1枚を山札の上へ）---------- */
  function bureaucratEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v)); // 灯台：免疫の被害者は対象外
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'bureaucrat', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      bureaucratApply(state, source, victim, rest);
    }
  }
  function bureaucratApply(state, source, victim, queue) {
    const v = state.players[victim];
    const hasVictory = v.hand.some((c) => DOM.isType(c, 'victory'));
    if (hasVictory) {
      // どの勝利点を山札の上に置くか犠牲者が選ぶ
      state.pending = { type: 'bureaucrat', stage: 'put', player: victim, source, victim, queue };
    } else {
      log(state, `${v.name} は勝利点を持っておらず手札を公開した（役人）。`);
      reveal(state, victim, v.hand, '役人：勝利点なしの手札を公開');
      bureaucratEnterVictim(state, source, queue);
    }
  }

  /* ---------- 山賊（複数対象。各相手が上2枚公開→銅貨以外の財宝1枚を廃棄）---------- */
  function banditEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v)); // 灯台：免疫の被害者は対象外
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'bandit', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      banditReveal(state, source, victim, rest);
    }
  }
  function banditReveal(state, source, victim, queue) {
    const v = state.players[victim];
    const revealed = [];
    for (let i = 0; i < 2; i++) {
      if (v.deck.length === 0) { if (v.discard.length === 0) break; v.deck = shuffle(v.discard); v.discard = []; }
      if (v.deck.length === 0) break;
      revealed.push(v.deck.shift());
    }
    if (revealed.length) reveal(state, victim, revealed, '山賊で山札の上を公開');
    const cands = revealed.filter((c) => DOM.isType(c, 'treasure') && c !== 'copper');
    if (cands.length >= 2 && cands[0] !== cands[1]) {
      // 異なる財宝が2枚 → 犠牲者がどちらを廃棄するか選ぶ
      state.pending = { type: 'bandit', stage: 'pick', player: victim, source, victim, revealed, cands, queue };
    } else if (cands.length >= 1) {
      const trashed = cands[0];
      removeOne(revealed, trashed);
      state.trash.push(trashed);
      log(state, `${v.name} は「${C()[trashed].name}」を廃棄した（山賊）。`);
      revealed.forEach((c) => v.discard.push(c));
      banditEnterVictim(state, source, queue);
    } else {
      revealed.forEach((c) => v.discard.push(c));
      if (revealed.length) log(state, `${v.name} は廃棄できる財宝がなく、公開札を捨てた（山賊）。`);
      banditEnterVictim(state, source, queue);
    }
  }

  /* ---------- 身代わり（勝利点を獲得したとき他全員が呪いを獲得＝アタック）---------- */
  function replaceEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v)); // 灯台：免疫の被害者は対象外
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'replace', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      replaceCurse(state, source, victim, rest);
    }
  }
  function replaceCurse(state, source, victim, queue) {
    if ((state.supply.curse || 0) > 0) {
      gain(state, victim, 'curse', 'discard');
      log(state, `${state.players[victim].name} は呪いを獲得した（身代わり）。`);
    }
    replaceEnterVictim(state, source, queue);
  }

  /* ---------- 海辺：巾着切り（各相手が銅貨1枚を捨てる／無ければ手札公開）---------- */
  function cutpurseEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'cutpurse', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      cutpurseApply(state, source, victim, rest);
    }
  }
  function cutpurseApply(state, source, victim, queue) {
    const v = state.players[victim];
    if (v.hand.includes('copper')) { removeOne(v.hand, 'copper'); v.discard.push('copper'); log(state, `${v.name} は銅貨1枚を捨てた（巾着切り）。`); }
    else { reveal(state, victim, v.hand, '巾着切り：銅貨なしの手札を公開'); log(state, `${v.name} は銅貨がなく手札を公開した（巾着切り）。`); }
    cutpurseEnterVictim(state, source, queue);
  }

  /* ---------- 海辺：海の魔女（各相手が呪いを獲得＝魔女と同型）---------- */
  function seaWitchEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'sea_witch', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      seaWitchCurse(state, source, victim, rest);
    }
  }
  function seaWitchCurse(state, source, victim, queue) {
    if ((state.supply.curse || 0) > 0) { gain(state, victim, 'curse', 'discard'); log(state, `${state.players[victim].name} は呪いを獲得した（海の魔女）。`); }
    seaWitchEnterVictim(state, source, queue);
  }

  /* ---------- 海辺：封鎖のアタック（プレイ時に相手へ「堀で免疫」窓を出す）----------
     封鎖はアタックカード。プレイ時に各相手へ反応窓を与え、堀を公開した相手は
     この封鎖の呪い窓（他人が同名を獲得→呪い）から免疫になる（source の封鎖予約の immune に登録）。
     灯台で免疫の相手は反応不要で即免疫。反応札を持たない相手はそのまま（免疫なし）。*/
  function markBlockadeImmune(state, source, gained, victim) {
    const e = (state.players[source].delayedEffects || [])
      .find((x) => x.type === 'blockade' && x.gained === gained);
    if (e) { e.immune = e.immune || []; if (!e.immune.includes(victim)) e.immune.push(victim); }
  }
  function blockadeEnterVictim(state, source, queue, gained) {
    queue = (queue || []).slice();
    while (queue.length) {
      const victim = queue[0];
      if (attackImmune(state, victim)) { markBlockadeImmune(state, source, gained, victim); queue.shift(); continue; }
      if (hasReaction(state.players[victim])) {
        state.pending = { type: 'blockade', stage: 'react', player: victim, source, victim, gained, queue: queue.slice(1) };
        return;
      }
      queue.shift(); // 反応札なし＝そのまま（免疫は付かない）
    }
    state.pending = null;
  }

  /* ---------- 繁栄：ペテン師（各相手が銅貨1枚を獲得）---------- */
  function charlatanEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'charlatan', stage: 'react', player: victim, source, victim, queue: rest };
    } else { charlatanApply(state, source, victim, rest); }
  }
  function charlatanApply(state, source, victim, queue) {
    if ((state.supply.copper || 0) > 0) { gain(state, victim, 'copper', 'discard'); log(state, `${state.players[victim].name} は銅貨1枚を獲得した（ペテン師）。`); }
    charlatanEnterVictim(state, source, queue);
  }

  /* ---------- 繁栄：群衆（各相手が山札の上3枚を公開→アクション/財宝を捨て、残りを上に戻す）---------- */
  function rabbleEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'rabble', stage: 'react', player: victim, source, victim, queue: rest };
    } else { rabbleApply(state, source, victim, rest); }
  }
  function rabbleApply(state, source, victim, queue) {
    const v = state.players[victim];
    const look = [];
    for (let i = 0; i < 3; i++) {
      if (v.deck.length === 0) { if (v.discard.length === 0) break; v.deck = shuffle(v.discard); v.discard = []; }
      if (v.deck.length === 0) break;
      look.push(v.deck.shift());
    }
    reveal(state, victim, look, '群衆：山札の上3枚を公開');
    const keep = [];
    look.forEach((c) => {
      if (DOM.isType(c, 'action') || DOM.isType(c, 'treasure')) v.discard.push(c);
      else keep.push(c);
    });
    for (let i = keep.length - 1; i >= 0; i--) v.deck.unshift(keep[i]); // 残りを公開順のまま山札の上へ
    if (look.length) log(state, `${v.name} は群衆で ${look.length}枚を公開し、アクション/財宝を捨てた。`);
    rabbleEnterVictim(state, source, queue);
  }

  /* ---------- 繁栄：会計士（手札5枚以上の各相手が、手札1枚を山札の上に置く）---------- */
  function clerkEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'clerk', stage: 'react', player: victim, source, victim, queue: rest };
    } else { clerkProceed(state, source, victim, rest); }
  }
  // 反応（堀等）を経た後／反応が無いとき：手札5枚以上なら本人が1枚選んで山札の上へ、未満なら飛ばす。
  function clerkProceed(state, source, victim, queue) {
    if (state.players[victim].hand.length >= 5) {
      state.pending = { type: 'clerk', stage: 'topdeck', player: victim, source, victim, queue };
    } else { clerkEnterVictim(state, source, queue); }
  }

  // 繁栄：司教「他プレイヤーは各自 任意で手札1枚を廃棄」を順に処理（手札が無い人は飛ばす）。
  function bishopOthersEnter(state, queue) {
    while (queue && queue.length) {
      const v = queue[0]; queue = queue.slice(1);
      if (state.players[v].hand.length > 0) { state.pending = { type: 'bishop', stage: 'other', player: v, queue }; return; }
    }
    state.pending = null;
  }
  // 繁栄：金庫室「他プレイヤーは各自 任意で手札2枚を捨てて1枚引く」を順に処理（手札2枚未満は飛ばす）。
  function vaultOthersEnter(state, queue) {
    while (queue && queue.length) {
      const v = queue[0]; queue = queue.slice(1);
      if (state.players[v].hand.length >= 2) { state.pending = { type: 'vault', stage: 'other', player: v, queue }; return; }
    }
    state.pending = null;
  }
  // 繁栄：ティアラ「財宝1枚を2回使う」の2回目＝コイン分を再適用（移動はしない。複雑財宝の追加効果は割愛）。
  function treasureReplayCoins(state, pi, card) {
    const p = state.players[pi];
    const t = state.turn;
    if (card === 'bank') { const cnt = p.inPlay.filter((c) => DOM.isType(c, 'treasure')).length; t.coins += cnt; return cnt; }
    const add = treasureCoins(state, card);
    t.coins += add;
    return add;
  }

  /* ---------- 総督（改築モード）：全員が順に「任意で廃棄→ちょうど+$Nを獲得」---------- */
  // queue 要素は { p: 席, delta: 自分=2/他=1 }。手札の無い人は飛ばす。
  function governorEnterRemodel(state, queue) {
    while (queue && queue.length) {
      const cur = queue[0], rest = queue.slice(1);
      if (state.players[cur.p].hand.length > 0) {
        state.pending = { type: 'governor_remodel', stage: 'trash', player: cur.p, delta: cur.delta, queue: rest };
        return;
      }
      queue = rest;
    }
    state.pending = null;
  }

  /* ---------- アクションカードの効果 ---------- */
  function applyEffect(state, cardId, pi) {
    const t = state.turn;
    const p = state.players[pi];
    switch (cardId) {
      case 'cellar':
        t.actions += 1;
        // 手札を好きな枚数捨て、同じだけ引く（選択待ち）
        if (p.hand.length > 0) state.pending = { type: 'cellar', player: pi };
        break;
      case 'market':
        draw(state, pi, 1);
        t.actions += 1;
        t.buys += 1;
        t.coins += 1;
        break;
      case 'militia': {
        t.coins += 2;
        // 他の全プレイヤーは手札3枚まで捨てる（手番順に処理）
        const others = [];
        for (let k = 1; k < state.players.length; k++) {
          const idx = (pi + k) % state.players.length;
          if (state.players[idx].hand.length > 3 && !attackImmune(state, idx)) others.push(idx);
        }
        if (others.length) {
          state.pending = { type: 'militia', player: others[0], source: pi, queue: others.slice(1) };
        }
        break;
      }
      case 'mine':
        // 財宝を廃棄してよい → ある場合のみ選択待ち
        if (p.hand.some((c) => DOM.isType(c, 'treasure'))) {
          state.pending = { type: 'mine', stage: 'trash', player: pi };
        }
        break;
      case 'moat':
        draw(state, pi, 2);
        break;
      case 'remodel':
        // 手札があれば1枚廃棄（必須）→獲得
        if (p.hand.length > 0) {
          state.pending = { type: 'remodel', stage: 'trash', player: pi };
        }
        break;
      case 'smithy':
        draw(state, pi, 3);
        break;
      case 'village':
        draw(state, pi, 1);
        t.actions += 2;
        break;
      case 'woodcutter':
        t.buys += 1;
        t.coins += 2;
        break;
      case 'workshop':
        // コスト4以下が獲得できる場合のみ選択待ち（無ければ何もしない）
        if (anyGainable(state, (id) => cardCost(state, id) <= 4))
          state.pending = { type: 'workshop', stage: 'gain', player: pi };
        break;

      /* ===== 拡張: 陰謀 ===== */
      case 'courtyard':
        draw(state, pi, 3);
        // 手札1枚を山札の上に置く（手札があるときのみ）
        if (p.hand.length > 0) state.pending = { type: 'courtyard', player: pi };
        break;
      case 'pawn':
        // 4つから異なる2つを選ぶ
        state.pending = { type: 'pawn', player: pi };
        break;
      case 'shanty_town':
        t.actions += 2;
        // 手札を公開し、アクションが無ければ +2 カード（このカードは既に場にある）
        if (!p.hand.some((c) => DOM.isType(c, 'action'))) draw(state, pi, 2);
        break;
      case 'steward':
        state.pending = { type: 'steward', stage: 'choose', player: pi };
        break;
      case 'wishing_well':
        draw(state, pi, 1);
        t.actions += 1;
        state.pending = { type: 'wishing', player: pi };
        break;
      case 'baron':
        t.buys += 1;
        if (p.hand.indexOf('estate') >= 0) {
          state.pending = { type: 'baron', player: pi };
        } else {
          if (gain(state, pi, 'estate', 'discard')) log(state, `${p.name} は屋敷を獲得した。`);
          else log(state, `${p.name} は屋敷を獲得しようとしたが山が空だった。`);
        }
        break;
      case 'bridge':
        t.buys += 1;
        t.coins += 1;
        t.costReduction = (t.costReduction || 0) + 1;
        break;
      case 'conspirator':
        t.coins += 2;
        if ((t.actionsPlayed || 0) >= 3) { draw(state, pi, 1); t.actions += 1; }
        break;
      case 'ironworks':
        if (anyGainable(state, (id) => cardCost(state, id) <= 4))
          state.pending = { type: 'ironworks', player: pi };
        break;
      case 'mining_village':
        draw(state, pi, 1);
        t.actions += 2;
        // 場のこのカードを廃棄して +2 コイン（任意）
        state.pending = { type: 'mining_village', player: pi };
        break;
      case 'nobles':
        // +3 カード か +2 アクション を選ぶ
        state.pending = { type: 'nobles', player: pi };
        break;
      case 'torturer': {
        draw(state, pi, 3);
        // 他の全プレイヤーが対象（手番順・灯台免疫は除外）
        const to = [];
        for (let k = 1; k < state.players.length; k++) { const idx = (pi + k) % state.players.length; if (!attackImmune(state, idx)) to.push(idx); }
        if (to.length) state.pending = { type: 'torturer', player: to[0], source: pi, queue: to.slice(1) };
        break;
      }
      case 'great_hall':
        // +1カード +1アクション（勝利点1は vpOf が一律加算するので別処理不要）
        draw(state, pi, 1);
        t.actions += 1;
        break;
      case 'coppersmith':
        // このターン、銅貨は出すと +1 コイン（treasureCoins で加算）
        t.copperBonus = (t.copperBonus || 0) + 1;
        break;
      case 'trading_post':
        // 手札を2枚廃棄→銀貨を手札に。手札があるときだけ選択待ち
        if (p.hand.length > 0) state.pending = { type: 'trading_post', player: pi };
        break;
      case 'upgrade':
        draw(state, pi, 1);
        t.actions += 1;
        // 手札があれば1枚廃棄→ちょうど+1コストを獲得
        if (p.hand.length > 0) state.pending = { type: 'upgrade', stage: 'trash', player: pi };
        break;
      case 'scout': {
        t.actions += 1;
        // 山札の上4枚を公開（足りなければ捨て札をシャッフル）
        const revealed = [];
        for (let i = 0; i < 4; i++) {
          if (p.deck.length === 0) {
            if (p.discard.length === 0) break;
            p.deck = shuffle(p.discard); p.discard = [];
          }
          revealed.push(p.deck.shift());
        }
        if (revealed.length) reveal(state, pi, revealed, '斥候で山札の上を公開');
        // 勝利点は手札へ、それ以外は山札の上へ戻す（順序は選択）
        const vics = revealed.filter((c) => DOM.isType(c, 'victory'));
        const rest = revealed.filter((c) => !DOM.isType(c, 'victory'));
        vics.forEach((c) => p.hand.push(c));
        if (vics.length) log(state, `${p.name} は斥候で勝利点 ${vics.length}枚 を手札に加えた。`);
        if (rest.length > 1) {
          state.pending = { type: 'scout', player: pi, cards: rest };
        } else {
          rest.forEach((c) => p.deck.unshift(c)); // 0/1枚は順序選択不要
        }
        break;
      }
      case 'swindler': {
        t.coins += 2;
        // 他の全プレイヤーが対象（手番順）。段階アタック（react→gain）を犠牲者ごとに処理
        const vics = [];
        for (let k = 1; k < state.players.length; k++) vics.push((pi + k) % state.players.length);
        swindlerEnterVictim(state, pi, vics);
        break;
      }
      case 'saboteur': {
        const vics = [];
        for (let k = 1; k < state.players.length; k++) vics.push((pi + k) % state.players.length);
        saboteurEnterVictim(state, pi, vics);
        break;
      }
      case 'minion':
        t.actions += 1;
        // 攻撃側が「+2コイン」か「手札を捨てて+4＆相手も」を選ぶ
        state.pending = { type: 'minion', stage: 'choose', player: pi };
        break;
      case 'masquerade': {
        draw(state, pi, 2);
        // 全員が同時に手札1枚を左隣へ渡す（手札のある人を順に集めてから一斉適用）
        const order = masqueradePassOrder(state, pi);
        if (order.length) {
          state.pending = { type: 'masquerade', stage: 'pass', player: order[0], source: pi, order, pos: 0, picks: {} };
        } else {
          masqueradeAfterPass(state, pi);
        }
        break;
      }
      case 'secret_chamber':
        // アクション: 手札を好きな枚数捨て、捨てた枚数だけ +1コイン（リアクションは別途 SECRET_CHAMBER_REVEAL）
        if (p.hand.length > 0) state.pending = { type: 'secret_chamber', stage: 'discard', player: pi };
        break;

      /* ===== 基本セット（追加分） ===== */
      case 'laboratory':
        draw(state, pi, 2);
        t.actions += 1;
        break;
      case 'festival':
        t.actions += 2;
        t.buys += 1;
        t.coins += 2;
        break;
      case 'moneylender':
        // 手札に銅貨があれば「廃棄して+3」か否かを選ぶ
        if (p.hand.includes('copper')) state.pending = { type: 'moneylender', player: pi };
        break;
      case 'chancellor':
        t.coins += 2;
        // 山札を捨て札にするか選ぶ（山札が空なら選択不要）
        if (p.deck.length > 0) state.pending = { type: 'chancellor', player: pi };
        break;
      case 'chapel':
        if (p.hand.length > 0) state.pending = { type: 'chapel', player: pi };
        break;
      // gardens は勝利点カード（プレイ不可）。得点は vpOf で計算。
      case 'witch': {
        draw(state, pi, 2);
        const vics = [];
        for (let k = 1; k < state.players.length; k++) vics.push((pi + k) % state.players.length);
        witchEnterVictim(state, pi, vics);
        break;
      }
      case 'bureaucrat': {
        // 銀貨を山札の上に獲得（山切れ時は獲得できないのでログもガード）
        if (gain(state, pi, 'silver', 'deck')) log(state, `${p.name} は銀貨を山札の上に獲得した。`);
        const vics = [];
        for (let k = 1; k < state.players.length; k++) vics.push((pi + k) % state.players.length);
        bureaucratEnterVictim(state, pi, vics);
        break;
      }
      case 'council_room':
        draw(state, pi, 4);
        t.buys += 1;
        for (let k = 1; k < state.players.length; k++) draw(state, (pi + k) % state.players.length, 1);
        break;
      case 'feast':
        // 自身を廃棄（場にあれば）→ コスト5以下を獲得
        if (removeOne(p.inPlay, 'feast')) { state.trash.push('feast'); log(state, `${p.name} は祝宴を廃棄した。`); }
        if (anyGainable(state, (id) => cardCost(state, id) <= 5)) state.pending = { type: 'feast', player: pi };
        break;
      case 'adventurer': {
        let found = 0; const aside = [];
        while (found < 2) {
          if (p.deck.length === 0) { if (p.discard.length === 0) break; p.deck = shuffle(p.discard); p.discard = []; }
          if (p.deck.length === 0) break;
          const c = p.deck.shift();
          if (DOM.isType(c, 'treasure')) { p.hand.push(c); found++; } else aside.push(c);
        }
        aside.forEach((c) => p.discard.push(c));
        log(state, `${p.name} は冒険者で財宝 ${found}枚 を手札に加えた。`);
        break;
      }
      case 'library':
        libraryStep(state, pi, []);
        break;
      case 'spy': {
        draw(state, pi, 1);
        t.actions += 1;
        const q = [pi];
        for (let k = 1; k < state.players.length; k++) q.push((pi + k) % state.players.length);
        spyEnterTarget(state, pi, q);
        break;
      }
      case 'thief': {
        const vics = [];
        for (let k = 1; k < state.players.length; k++) vics.push((pi + k) % state.players.length);
        thiefEnterVictim(state, pi, vics);
        break;
      }
      case 'throne_room':
        // 手札にアクションがあれば、2回使うカードを選ぶ
        if (p.hand.some((c) => DOM.isType(c, 'action'))) state.pending = { type: 'throne', player: pi };
        break;
      case 'tribute': {
        // 左隣のプレイヤーが山札の上2枚を公開して捨てる
        const left = state.players[(pi + 1) % state.players.length];
        const revealed = [];
        for (let i = 0; i < 2; i++) {
          if (left.deck.length === 0) {
            if (left.discard.length === 0) break;
            left.deck = shuffle(left.discard); left.discard = [];
          }
          revealed.push(left.deck.shift());
        }
        if (revealed.length) reveal(state, (pi + 1) % state.players.length, revealed, '貢物で山札の上を公開');
        revealed.forEach((c) => left.discard.push(c));
        if (revealed.length) log(state, `${left.name} は山札の上 ${revealed.length}枚 を公開して捨てた。`);
        // 異なる名前ごとにボーナス（同名2枚は1回ぶん。多重タイプは各該当を独立に付与）
        const distinct = revealed.filter((c, i, a) => a.indexOf(c) === i);
        let addCard = 0, addA = 0, addC = 0;
        distinct.forEach((c) => {
          if (DOM.isType(c, 'action')) { t.actions += 2; addA += 2; }
          if (DOM.isType(c, 'treasure')) { t.coins += 2; addC += 2; }
          if (DOM.isType(c, 'victory')) { draw(state, pi, 2); addCard += 2; }
        });
        const parts = [];
        if (addCard) parts.push(`+${addCard}カード`);
        if (addA) parts.push(`+${addA}アクション`);
        if (addC) parts.push(`+${addC}コイン`);
        if (parts.length) log(state, `${p.name} は貢物で ${parts.join(' ')} を得た。`);
        break;
      }

      /* ===== 基本セット 第二版で追加された7種 ===== */
      case 'harbinger':
        draw(state, pi, 1);
        t.actions += 1;
        // 捨て札があれば、その中から1枚を山札の上に置いてよい
        if (p.discard.length > 0) state.pending = { type: 'harbinger', player: pi };
        break;
      case 'merchant':
        draw(state, pi, 1);
        t.actions += 1;
        t.merchants = (t.merchants || 0) + 1; // このターン最初の銀貨で +1（商人の数だけ）
        break;
      case 'vassal': {
        t.coins += 2;
        if (p.deck.length === 0 && p.discard.length > 0) { p.deck = shuffle(p.discard); p.discard = []; }
        if (p.deck.length > 0) {
          const top = p.deck.shift();
          p.discard.push(top); // 一旦捨てる（公式どおり：捨ててから使うなら捨て札から場へ）
          reveal(state, pi, [top], '家臣で山札の上を公開');
          log(state, `${p.name} は山札の上の「${C()[top].name}」を捨てた（家臣）。`);
          if (DOM.isType(top, 'action')) state.pending = { type: 'vassal', player: pi, card: top };
        }
        break;
      }
      case 'poacher': {
        draw(state, pi, 1);
        t.actions += 1;
        t.coins += 1;
        const need = Math.min(emptyPileCount(state), p.hand.length); // 空のサプライ1つにつき手札1枚捨て
        if (need > 0) state.pending = { type: 'poacher', player: pi, need };
        break;
      }
      case 'bandit': {
        if (gain(state, pi, 'gold', 'discard')) log(state, `${p.name} は金貨を獲得した（山賊）。`);
        const vics = [];
        for (let k = 1; k < state.players.length; k++) vics.push((pi + k) % state.players.length);
        banditEnterVictim(state, pi, vics);
        break;
      }
      case 'sentry': {
        draw(state, pi, 1);
        t.actions += 1;
        const look = []; // 山札の上2枚を「見る」（他者には公開しない）
        for (let i = 0; i < 2; i++) {
          if (p.deck.length === 0) { if (p.discard.length === 0) break; p.deck = shuffle(p.discard); p.discard = []; }
          if (p.deck.length === 0) break;
          look.push(p.deck.shift());
        }
        if (look.length > 0) state.pending = { type: 'sentry', player: pi, cards: look };
        break;
      }
      case 'artisan':
        // コスト5以下を手札に獲得（銅貨があるので常に可能）→ その後、手札1枚を山札の上へ
        state.pending = { type: 'artisan', stage: 'gain', player: pi };
        break;

      /* ===== 陰謀 第二版で追加された7種 ===== */
      case 'courtier':
        // 手札1枚を公開→その種類数だけ効果を選ぶ
        if (p.hand.length > 0) state.pending = { type: 'courtier', stage: 'reveal', player: pi };
        break;
      case 'diplomat':
        draw(state, pi, 2);
        if (p.hand.length <= 5) t.actions += 2; // 引いた後の手札が5枚以下なら +2 アクション
        break;
      case 'lurker':
        t.actions += 1;
        state.pending = { type: 'lurker', stage: 'choose', player: pi };
        break;
      case 'mill':
        draw(state, pi, 1);
        t.actions += 1;
        // 手札を2枚捨てれば +2 コイン（任意）。2枚なければ選択不要
        if (p.hand.length >= 2) state.pending = { type: 'mill', player: pi };
        break;
      case 'patrol': {
        draw(state, pi, 3);
        const revealed = [];
        for (let i = 0; i < 4; i++) {
          if (p.deck.length === 0) { if (p.discard.length === 0) break; p.deck = shuffle(p.discard); p.discard = []; }
          if (p.deck.length === 0) break;
          revealed.push(p.deck.shift());
        }
        if (revealed.length) reveal(state, pi, revealed, 'パトロールで山札の上を公開');
        const toHand = revealed.filter((c) => DOM.isType(c, 'victory') || DOM.isType(c, 'curse'));
        const rest = revealed.filter((c) => !(DOM.isType(c, 'victory') || DOM.isType(c, 'curse')));
        toHand.forEach((c) => p.hand.push(c));
        if (toHand.length) log(state, `${p.name} はパトロールで ${toHand.length}枚（勝利点/呪い）を手札に加えた。`);
        if (rest.length > 1) state.pending = { type: 'patrol', player: pi, cards: rest };
        else rest.forEach((c) => p.deck.unshift(c));
        break;
      }
      case 'replace':
        // 手札1枚を廃棄（必須）→ +$2まで獲得
        if (p.hand.length > 0) state.pending = { type: 'replace', stage: 'trash', player: pi };
        break;
      case 'secret_passage':
        draw(state, pi, 2);
        t.actions += 1;
        if (p.hand.length > 0) state.pending = { type: 'secret_passage', stage: 'pick', player: pi };
        break;

      /* ===== プロモカード ===== */
      case 'walled_village':
        draw(state, pi, 1);
        t.actions += 2;
        break; // 山札の上に戻す処理はクリーンアップ時
      case 'envoy': {
        const revealed = [];
        for (let i = 0; i < 5; i++) {
          if (p.deck.length === 0) { if (p.discard.length === 0) break; p.deck = shuffle(p.discard); p.discard = []; }
          if (p.deck.length === 0) break;
          revealed.push(p.deck.shift());
        }
        if (revealed.length) {
          reveal(state, pi, revealed, '使者で山札の上を公開');
          const left = (pi + 1) % state.players.length;
          if (left === pi) { revealed.forEach((c) => p.hand.push(c)); } // 1人用フォールバック
          else state.pending = { type: 'envoy', player: left, source: pi, revealed };
        }
        break;
      }
      case 'governor':
        t.actions += 1;
        state.pending = { type: 'governor', stage: 'choose', player: pi };
        break;
      case 'dismantle':
        if (p.hand.length > 0) state.pending = { type: 'dismantle', stage: 'trash', player: pi };
        break;
      case 'black_market': {
        t.coins += 2;
        const bm = state.blackMarket || [];
        const revealed = bm.splice(0, 3); // 上3枚（買わなかったぶんは後で底へ）
        state.blackMarket = bm;
        if (revealed.length) {
          reveal(state, pi, revealed, '闇市場デッキの上を公開');
          state.pending = { type: 'black_market', stage: 'play', player: pi, revealed };
        }
        break;
      }

      /* ===== 拡張: 海辺（Seaside 第二版）===== */
      // --- バニラ系（即時のみ・非対話）---
      case 'bazaar':
        draw(state, pi, 1); t.actions += 2; t.coins += 1;
        break;
      // --- バニラ持続（即時＋次手番予約）---
      case 'fishing_village':
        t.actions += 2; t.coins += 1;
        armDuration(state, pi, 'fishing_village');
        break;
      case 'caravan':
        draw(state, pi, 1); t.actions += 1;
        armDuration(state, pi, 'caravan');
        break;
      case 'merchant_ship':
        t.coins += 2;
        armDuration(state, pi, 'merchant_ship');
        break;
      case 'wharf':
        draw(state, pi, 2); t.buys += 1;
        armDuration(state, pi, 'wharf');
        break;
      case 'lighthouse':
        t.actions += 1; t.coins += 1;
        armDuration(state, pi, 'lighthouse'); // 次手番 +1コイン。場/持続にある間アタック無効（attackImmune）
        break;
      case 'tide_pools':
        draw(state, pi, 3); t.actions += 1;
        armDuration(state, pi, 'tide_pools'); // 次手番開始時に手札2枚を捨てる（対話）
        break;

      // --- 対話系（手札の選択を伴う）---
      case 'warehouse':
        draw(state, pi, 3); t.actions += 1;
        if (p.hand.length > 0) state.pending = { type: 'warehouse', player: pi };
        break;
      case 'haven':
        draw(state, pi, 1); t.actions += 1;
        if (p.hand.length > 0) state.pending = { type: 'haven', player: pi };
        else armDuration(state, pi, 'haven'); // 手札が空でも持続として残る（脇置きなし）
        break;
      case 'tactician':
        if (p.hand.length > 0) state.pending = { type: 'tactician', player: pi };
        // 手札が空なら何もしない＝持続化しない（捨て札へ）
        break;
      case 'salvager':
        t.buys += 1;
        if (p.hand.length > 0) state.pending = { type: 'salvager', stage: 'trash', player: pi };
        break;
      case 'lookout': {
        t.actions += 1;
        // 山札の上3枚を見る（足りなければある分）
        const look = [];
        for (let i = 0; i < 3; i++) {
          if (p.deck.length === 0) { if (p.discard.length === 0) break; p.deck = shuffle(p.discard); p.discard = []; }
          if (p.deck.length === 0) break;
          look.push(p.deck.shift());
        }
        if (look.length) state.pending = { type: 'lookout', stage: 'trash', player: pi, cards: look };
        break;
      }
      case 'treasure_map': {
        // これ（場のtreasure_map 1枚）と手札のtreasure_map をもう1枚廃棄できれば金貨4枚を山札の上へ。
        removeOne(p.inPlay, 'treasure_map'); state.trash.push('treasure_map');
        let trashedTwo = false;
        if (removeOne(p.hand, 'treasure_map')) { state.trash.push('treasure_map'); trashedTwo = true; }
        log(state, `${p.name} は宝の地図を廃棄した${trashedTwo ? '（2枚）' : ''}。`);
        if (trashedTwo) {
          let g = 0; for (let i = 0; i < 4; i++) { if (gain(state, pi, 'gold', 'deck')) g++; }
          if (g) log(state, `${p.name} は金貨${g}枚を山札の上に獲得した（宝の地図）。`);
        }
        break;
      }
      case 'sea_chart': {
        draw(state, pi, 1); t.actions += 1;
        // 山札の上を公開。同名カードが場（inPlay/durationCards）にあれば手札に。
        if (p.deck.length === 0 && p.discard.length > 0) { p.deck = shuffle(p.discard); p.discard = []; }
        if (p.deck.length > 0) {
          const top = p.deck[0];
          reveal(state, pi, [top], '海図で山札の上を公開');
          if (p.inPlay.includes(top) || (p.durationCards || []).includes(top)) {
            p.deck.shift(); p.hand.push(top);
            log(state, `${p.name} は同名が場にあったため「${C()[top].name}」を手札に加えた（海図）。`);
          }
        }
        break;
      }
      case 'island':
        // 島自身を島マットへ（場のこのカードを取り除く）＋手札1枚を島マットへ
        removeOne(p.inPlay, 'island'); p.islandMat.push('island');
        if (p.hand.length > 0) state.pending = { type: 'island', player: pi };
        else log(state, `${p.name} は島を島マットに置いた。`);
        break;
      case 'native_village':
        t.actions += 2;
        state.pending = { type: 'native_village', player: pi };
        break;

      // --- アタック・追加ターン・フック系 ---
      case 'cutpurse': {
        t.coins += 2;
        const q = [];
        for (let k = 1; k < state.players.length; k++) q.push((pi + k) % state.players.length);
        cutpurseEnterVictim(state, pi, q);
        break;
      }
      case 'sea_witch': {
        draw(state, pi, 2);
        armDuration(state, pi, 'sea_witch'); // 次手番 +2カード→手札2枚捨て
        const q = [];
        for (let k = 1; k < state.players.length; k++) q.push((pi + k) % state.players.length);
        seaWitchEnterVictim(state, pi, q);
        break;
      }
      case 'monkey':
        p.monkeyActive = true; // 次の自分の手番まで、右隣の獲得ごとに +1カード
        armDuration(state, pi, 'monkey'); // 次手番 +1カード（＆窓を閉じる）
        break;
      case 'smugglers': {
        const n = state.players.length;
        const right = (pi - 1 + n) % n;
        const gains = Array.from(new Set(state.players[right].lastTurnGains || []))
          .filter((id) => C()[id] && cardCost(state, id) <= 6 && (state.supply[id] || 0) > 0);
        if (gains.length) state.pending = { type: 'smugglers', player: pi, candidates: gains };
        else log(state, `${p.name} は密輸できるカードがなかった。`);
        break;
      }
      case 'treasury':
        draw(state, pi, 1); t.actions += 1; t.coins += 1;
        // クリーンアップ時、勝利点を獲得していなければ山札の上に戻す（cleanupAndAdvance で自動処理）
        break;
      case 'outpost':
        // このターン1度だけ・追加ターン中でなければ、手札3枚の追加ターン。
        if (!t.outpostUsed && !t.isExtraTurn) {
          t.outpostUsed = true; p.outpostExtra = true;
          armDuration(state, pi, 'outpost'); // 追加ターン中、場に残すための予約（効果は無し）
          log(state, `${p.name} は前哨地で追加ターンを得る（次の手札は3枚）。`);
        }
        break;
      case 'sailor':
        t.actions += 1;
        t.sailorPlays = (t.sailorPlays || 0) + 1; // このターン1度、獲得した持続カードを即プレイできる（船乗り1枚につき1回）
        armDuration(state, pi, 'sailor'); // 次手番 +2コイン＋任意で手札1枚廃棄
        break;
      case 'blockade':
        // 4コスト以下を獲得して脇に置く（次手番に手札へ）。場にある間、他人の同名獲得で呪い。
        if (anyGainable(state, (id) => cardCost(state, id) <= 4))
          state.pending = { type: 'blockade', stage: 'gain', player: pi };
        else armDuration(state, pi, 'blockade', { gained: null, immune: [] });
        break;
      case 'corsair':
        t.coins += 2;
        armDuration(state, pi, 'corsair'); // 次手番 +1カード。窓の間、相手の最初の銀/金を廃棄
        break;

      // ===== 繁栄（Prosperity 第二版）アクションカード =====
      case 'monument':
        t.coins += 2; p.vpTokens = (p.vpTokens || 0) + 1;
        log(state, `${p.name} は記念碑で +1勝利点。`);
        break;
      case 'workers_village':
        draw(state, pi, 1); t.actions += 2; t.buys += 1;
        break;
      case 'magnate': {
        reveal(state, pi, p.hand, '富豪：手札を公開');
        const tre = p.hand.filter((c) => DOM.isType(c, 'treasure')).length;
        if (tre) draw(state, pi, tre);
        log(state, `${p.name} は富豪で手札を公開（財宝${tre}枚）→ +${tre}カード。`);
        break;
      }
      case 'city': {
        draw(state, pi, 1); t.actions += 2;
        const empties = emptyPileCount(state);
        if (empties >= 1) draw(state, pi, 1);
        if (empties >= 2) { t.buys += 1; t.coins += 1; }
        break;
      }
      case 'grand_market':
        draw(state, pi, 1); t.actions += 1; t.buys += 1; t.coins += 2;
        break;
      case 'peddler':
        draw(state, pi, 1); t.actions += 1; t.coins += 1;
        break;
      case 'watchtower':
        // 手札が6枚になるまで引く（空なら止める）
        { let g = 0; while (p.hand.length < 6 && g++ < 30) { const b = p.hand.length; draw(state, pi, 1); if (p.hand.length === b) break; } }
        break;
      case 'bishop':
        t.coins += 1; p.vpTokens = (p.vpTokens || 0) + 1;
        log(state, `${p.name} は司教で +1勝利点。`);
        // 手札1枚を廃棄（コスト$2につき+VP）。その後 他プレイヤーが任意で手札1枚廃棄。
        // 手札が空なら廃棄は飛ばして「他プレイヤーの廃棄」へ（空手札でデッドロックさせない）。
        if (p.hand.length > 0) { state.pending = { type: 'bishop', stage: 'trash', player: pi }; }
        else { const q = []; for (let k = 1; k < state.players.length; k++) q.push((pi + k) % state.players.length); bishopOthersEnter(state, q); }
        break;
      case 'vault':
        draw(state, pi, 2);
        state.pending = { type: 'vault', stage: 'discard', player: pi }; // 好きな枚数捨てて+コイン
        break;
      case 'mint':
        if (p.hand.some((c) => DOM.isType(c, 'treasure'))) state.pending = { type: 'mint', player: pi };
        break;
      case 'expand':
        if (p.hand.length > 0) state.pending = { type: 'expand', stage: 'trash', player: pi };
        break;
      case 'forge':
        state.pending = { type: 'forge', stage: 'trash', player: pi }; // 任意枚数廃棄→合計コストちょうどを獲得
        break;
      case 'kings_court':
        if (p.hand.some((c) => DOM.isType(c, 'action'))) state.pending = { type: 'kings_court', player: pi };
        break;
      case 'rabble': {
        draw(state, pi, 3);
        const q = [];
        for (let k = 1; k < state.players.length; k++) q.push((pi + k) % state.players.length);
        rabbleEnterVictim(state, pi, q);
        break;
      }
      case 'clerk': {
        t.coins += 2;
        const q = [];
        for (let k = 1; k < state.players.length; k++) q.push((pi + k) % state.players.length);
        clerkEnterVictim(state, pi, q);
        break;
      }
      case 'war_chest': {
        // 左隣がカード名を1つ指定 → コスト$5以下で「このターン軍用金で指定されていない」カードを1枚獲得
        const left = (pi + 1) % state.players.length;
        state.pending = { type: 'war_chest', stage: 'name', player: left, source: pi };
        break;
      }

      /* ===== 拡張: 錬金術（Alchemy 第二版）===== */
      case 'transmute':
        // 手札1枚を廃棄→種類ごとに獲得（アクション→公領／財宝→変成／勝利点→金貨）。
        if (p.hand.length > 0) state.pending = { type: 'transmute', player: pi };
        break;
      case 'herbalist':
        t.buys += 1; t.coins += 1;
        // このターンの片付けで、場の財宝を（薬草商の数だけ）山札の上に置いてよい（cleanupで自動処理）。
        t.herbalists = (t.herbalists || 0) + 1;
        break;
      case 'apothecary': {
        draw(state, pi, 1); t.actions += 1;
        // 山札の上4枚を公開し、銅貨とポーションを手札に、残りを好きな順で山札の上に戻す。
        const revealed = [];
        for (let i = 0; i < 4; i++) {
          if (p.deck.length === 0) { if (p.discard.length === 0) break; p.deck = shuffle(p.discard); p.discard = []; }
          if (p.deck.length === 0) break;
          revealed.push(p.deck.shift());
        }
        if (revealed.length) reveal(state, pi, revealed, '薬剤師で山札の上を公開');
        const rest = [];
        revealed.forEach((c) => { if (c === 'copper' || c === 'potion') p.hand.push(c); else rest.push(c); });
        if (revealed.length) log(state, `${p.name} は薬剤師で ${revealed.length}枚 を公開し、銅貨・ポーションを手札に加えた。`);
        if (rest.length >= 2) state.pending = { type: 'apothecary', player: pi, cards: rest }; // 2枚以上は並べ替え
        else if (rest.length === 1) p.deck.unshift(rest[0]);
        break;
      }
      case 'scrying_pool': {
        t.actions += 1;
        const q = [pi];
        for (let k = 1; k < state.players.length; k++) q.push((pi + k) % state.players.length);
        scryingEnterTarget(state, pi, q);
        break;
      }
      case 'university':
        t.actions += 2;
        // コスト5以下のアクションカードを獲得してよい（任意）。ポーション費用カードは$5に含めない（公式）。
        if (anyGainable(state, (id) => DOM.isType(id, 'action') && cardCost(state, id) <= 5 && potionCost(id) === 0))
          state.pending = { type: 'university', player: pi };
        break;
      case 'alchemist':
        draw(state, pi, 2); t.actions += 1;
        // 片付け開始時、場にポーションがあればこれを山札の上に置く（cleanupで自動処理）。
        break;
      case 'familiar': {
        draw(state, pi, 1); t.actions += 1;
        const vics = [];
        for (let k = 1; k < state.players.length; k++) vics.push((pi + k) % state.players.length);
        familiarEnterVictim(state, pi, vics);
        break;
      }
      case 'golem': {
        // ゴーレム以外のアクションが2枚出るまで山札を公開。残りを捨て、その2枚を好きな順で使う。
        const found = []; const aside = []; let guard = 0;
        while (found.length < 2 && guard++ < 200) {
          if (p.deck.length === 0) { if (p.discard.length === 0) break; p.deck = shuffle(p.discard); p.discard = []; }
          if (p.deck.length === 0) break;
          const c = p.deck.shift();
          if (c !== 'golem' && DOM.isType(c, 'action')) found.push(c);
          else aside.push(c); // ゴーレム自身・非アクションは脇へ→捨てる
        }
        if (found.concat(aside).length) reveal(state, pi, found.concat(aside), 'ゴーレムで公開');
        aside.forEach((c) => p.discard.push(c));
        log(state, `${p.name} はゴーレムでアクション ${found.length}枚 を見つけた。`);
        if (found.length === 2) state.pending = { type: 'golem', player: pi, cards: found }; // 使う順を選ぶ
        else if (found.length === 1) golemPlay(state, pi, found[0], null);
        break;
      }
      case 'apprentice':
        t.actions += 1;
        // 手札1枚を廃棄→コスト$1につき+1カード（ポーション費用ありなら+2カード）。
        if (p.hand.length > 0) state.pending = { type: 'apprentice', player: pi };
        break;
      case 'possession': {
        // 支配：左隣がこのターンの後に追加ターンを行い、その間あなたが全ての決定を行う。
        const victim = (pi + 1) % state.players.length;
        // 連鎖支配：既に被支配中のターンで支配をプレイした場合も、操作は「元の支配者」が続ける
        // （pi=被支配者ではなく現在の操作者 t.possessedBy を引き継ぐ）。
        const controller = t.possessedBy != null ? t.possessedBy : pi;
        (state.extraTurns = state.extraTurns || []).push({ seat: victim, possessedBy: controller, rotationSeat: t.rotationSeat != null ? t.rotationSeat : pi });
        log(state, `${p.name} は支配を使った（${state.players[victim].name} の追加ターンを ${state.players[controller].name} が操作する）。`);
        break;
      }

      default:
        break;
    }
  }

  /* ---------- ゲーム終了判定・得点 ---------- */
  function emptyPileCount(state) {
    return Object.keys(state.supply).filter((k) => state.supply[k] <= 0).length;
  }
  function isGameOver(state) {
    return state.supply.province <= 0 || emptyPileCount(state) >= 3;
  }
  function allCards(p) {
    // 海辺：持続カード・脇置き・島/原住民マットも所有カード＝VP（島の2点・庭園の枚数等）に数える。
    return [].concat(p.deck, p.hand, p.discard, p.inPlay,
      p.durationCards || [], p.setAside || [], p.islandMat || [], p.nativeVillageMat || []);
  }
  function vpOf(p) {
    const cards = allCards(p);
    let vp = cards.reduce((sum, c) => sum + (C()[c].vp || 0), 0);
    // 公爵：所持する公領1枚につき1勝利点
    const dukes = cards.filter((c) => c === 'duke').length;
    if (dukes) vp += dukes * cards.filter((c) => c === 'duchy').length;
    // 庭園：デッキ10枚につき1勝利点（端数切り捨て）
    const gardens = cards.filter((c) => c === 'gardens').length;
    if (gardens) vp += gardens * Math.floor(cards.length / 10);
    // 錬金術：ブドウ園＝所持アクションカード3枚につき1勝利点（端数切り捨て）
    const vineyards = cards.filter((c) => c === 'vineyard').length;
    if (vineyards) vp += vineyards * Math.floor(cards.filter((c) => DOM.isType(c, 'action')).length / 3);
    // 繁栄：VPトークン（司教・記念碑・収集・投資で貯めた勝利点）を加算
    vp += p.vpTokens || 0;
    return vp;
  }
  function scoreGame(state) {
    const scores = state.players.map((p) => {
      // 勝敗画面用の内訳（例: {province:2, duchy:1, estate:3, curse:1}）。
      // マスク配信後はクライアントから再計算できないため、ここで確定して持たせる。
      const vpCards = {};
      allCards(p).forEach((c) => { if (DOM.isType(c, 'victory') || DOM.isType(c, 'curse')) vpCards[c] = (vpCards[c] || 0) + 1; });
      // deckSize は庭園の得点表示用（デッキ10枚につき1点）
      return { name: p.name, vp: vpOf(p), turns: p.turns, vpCards, deckSize: allCards(p).length };
    });
    // 勝者判定：勝利点が多い → 同点ならターン数が少ない
    let best = null;
    let winners = [];
    state.players.forEach((p, i) => {
      const s = scores[i];
      if (
        !best ||
        s.vp > best.vp ||
        (s.vp === best.vp && s.turns < best.turns)
      ) {
        best = s;
        winners = [i];
      } else if (s.vp === best.vp && s.turns === best.turns) {
        winners.push(i);
      }
    });
    return { scores, winners, reason: state.supply.province <= 0 ? '属州の山が尽きた' : '3つの山が尽きた' };
  }

  /* ============================================================
     海辺：持続（Duration）機構
     - armDuration: カードを使ったとき「次の自分の手番開始時に解決する予約」を積む。
     - DURATION_RESOLVERS[type]: 次手番開始時の効果。非対話はその場で適用、対話は
       state.turn.startQueue に pending 仕様を push（cleanup 後に順番に pending 化）。
     - resolveDurationStartEffects: 手番開始時に予約を全消化し、対話分を startQueue→pending に。
     - 物理カードは cleanupAndAdvance の仕分けで durationCards に持ち越し、予約を出し切ったら捨て札へ。
     ============================================================ */
  function armDuration(state, pi, cardId, extra) {
    const p = state.players[pi];
    if (!p.delayedEffects) p.delayedEffects = [];
    p.delayedEffects.push(Object.assign({ card: cardId, type: cardId }, extra || {}));
  }
  // 次手番開始時に1つ進める：startQueue があれば先頭を pending に、無ければ pending=null。
  function popStartQueue(state) {
    const q = state.turn && state.turn.startQueue;
    if (q && q.length) { state.pending = q.shift(); }
    else { if (state.turn) state.turn.startQueue = null; state.pending = null; }
  }
  function resolveDurationStartEffects(state, pi) {
    const p = state.players[pi];
    const entries = (p.delayedEffects || []);
    p.delayedEffects = [];
    state.turn.startQueue = [];
    for (const e of entries) {
      const r = DURATION_RESOLVERS[e.type];
      if (r) r(state, pi, e); // 非対話はここで適用、対話は state.turn.startQueue に積む
    }
    // 繁栄：会計士＝手番開始時、手札の会計士を（アクションを消費せず）使ってよい。startQueue の最後に積む。
    const clerks = p.hand.filter((c) => c === 'clerk').length;
    for (let i = 0; i < clerks; i++) state.turn.startQueue.push({ type: 'clerk_start', player: pi });
    popStartQueue(state); // 最初の対話 pending をセット（無ければ null）
  }
  // 各持続カードの「次の手番開始時」効果（カードidをキーに登録）。対話分は §手5/手6 で startQueue に積む。
  const DURATION_RESOLVERS = {
    fishing_village: (s, pi) => { s.turn.actions += 1; s.turn.coins += 1; log(s, `${s.players[pi].name} は漁村の持続効果（+1アクション +1コイン）。`); },
    caravan: (s, pi) => { draw(s, pi, 1); log(s, `${s.players[pi].name} は隊商の持続効果（+1カード）。`); },
    merchant_ship: (s, pi) => { s.turn.coins += 2; log(s, `${s.players[pi].name} は商船の持続効果（+2コイン）。`); },
    wharf: (s, pi) => { draw(s, pi, 2); s.turn.buys += 1; log(s, `${s.players[pi].name} は船着場の持続効果（+2カード +1購入）。`); },
    astrolabe: (s, pi) => { s.turn.coins += 1; s.turn.buys += 1; log(s, `${s.players[pi].name} はアストロラーベの持続効果（+1コイン +1購入）。`); },
    lighthouse: (s, pi) => { s.turn.coins += 1; log(s, `${s.players[pi].name} は灯台の持続効果（+1コイン）。`); },
    haven: (s, pi, e) => { // 脇に置いたカードを手札へ戻す
      const p = s.players[pi];
      if (e.stashed && removeOne(p.setAside, e.stashed)) { p.hand.push(e.stashed); log(s, `${p.name} は停泊所で脇に置いたカードを手札に戻した。`); }
    },
    tactician: (s, pi) => { draw(s, pi, 5); s.turn.buys += 1; s.turn.actions += 1; log(s, `${s.players[pi].name} は策士の持続効果（+5カード +1購入 +1アクション）。`); },
    tide_pools: (s, pi) => { // 次手番開始時に手札2枚を捨てる（対話＝startQueueへ）
      if (s.players[pi].hand.length > 0) (s.turn.startQueue = s.turn.startQueue || []).push({ type: 'tide_pools_discard', player: pi });
    },
    sea_witch: (s, pi) => { // 次手番 +2カード→その後手札2枚を捨てる
      draw(s, pi, 2); log(s, `${s.players[pi].name} は海の魔女の持続効果（+2カード）。`);
      if (s.players[pi].hand.length > 0) (s.turn.startQueue = s.turn.startQueue || []).push({ type: 'sea_witch_discard', player: pi });
    },
    monkey: (s, pi) => { draw(s, pi, 1); s.players[pi].monkeyActive = false; log(s, `${s.players[pi].name} はサルの持続効果（+1カード）。`); },
    outpost: () => { /* 追加ターン中、場に残すためだけの予約（効果なし） */ },
    sailor: (s, pi) => { // 次手番 +2コイン＋任意で手札1枚廃棄
      s.turn.coins += 2; log(s, `${s.players[pi].name} は船乗りの持続効果（+2コイン）。`);
      if (s.players[pi].hand.length > 0) (s.turn.startQueue = s.turn.startQueue || []).push({ type: 'sailor_trash', player: pi });
    },
    blockade: (s, pi, e) => { // 脇に置いたカードを手札へ戻す（呪いの窓も閉じる）
      const p = s.players[pi];
      if (e.gained && removeOne(p.setAside, e.gained)) { p.hand.push(e.gained); log(s, `${p.name} は封鎖で脇に置いた「${C()[e.gained].name}」を手札に加えた。`); }
    },
    corsair: (s, pi) => { draw(s, pi, 1); log(s, `${s.players[pi].name} は私掠船の持続効果（+1カード）。`); },
    pirate: (s, pi) => { // 次手番に6コスト以下の財宝1枚を手札に獲得
      (s.turn.startQueue = s.turn.startQueue || []).push({ type: 'pirate_gain', player: pi });
    },
  };

  // 「獲得時」フック（サル＝右隣の獲得で+1カード／封鎖＝同名獲得で呪い）。gain から常に呼ばれる。
  function triggerOnGain(state, pIndex, cardId, dest) {
    state._gainDepth = (state._gainDepth || 0) + 1;
    if (state._gainDepth > 6) { state._gainDepth--; return; } // 連鎖の暴走防止
    const n = state.players.length;
    for (let o = 0; o < n; o++) {
      const op = state.players[o];
      // サル：右隣（手番が自分の1つ前）の獲得ごとに +1カード
      if (op.monkeyActive && o !== pIndex && pIndex === (o - 1 + n) % n) {
        draw(state, o, 1); log(state, `${op.name} はサルの効果で +1カード（右隣の獲得）。`);
      }
      // 封鎖：他人が「自分の手番で」封鎖された同名カードを獲得したら呪いを獲得
      if (o !== pIndex && state.turn && pIndex === state.turn.active) {
        const bl = (op.delayedEffects || []).find((e) => e.type === 'blockade' && e.gained === cardId);
        // 堀/灯台で免疫の相手（immune 登録済み）は呪いを受けない。
        if (bl && !((bl.immune || []).includes(pIndex)) && (state.supply.curse || 0) > 0) { gain(state, pIndex, 'curse', 'discard'); log(state, `${state.players[pIndex].name} は封鎖により呪いを獲得した。`); }
      }
    }
    // 繁栄：自分の手番に勝利点カードを獲得 → 場の隠し財産1枚につき金貨1枚（hoard）。
    if (state.turn && pIndex === state.turn.active && DOM.isType(cardId, 'victory')) {
      const hoards = state.players[pIndex].inPlay.filter((c) => c === 'hoard').length;
      for (let i = 0; i < hoards; i++) {
        if (gain(state, pIndex, 'gold', 'discard')) log(state, `${state.players[pIndex].name} は隠し財産で金貨を獲得した。`);
      }
    }
    // 繁栄：自分の手番にアクションカードを獲得 → 場の収集1枚につき +1勝利点（collection）。
    if (state.turn && pIndex === state.turn.active && DOM.isType(cardId, 'action')) {
      const cols = state.players[pIndex].inPlay.filter((c) => c === 'collection').length;
      if (cols) { state.players[pIndex].vpTokens = (state.players[pIndex].vpTokens || 0) + cols; log(state, `${state.players[pIndex].name} は収集で +${cols} 勝利点。`); }
    }
    // 繁栄：物見やぐら（手札から公開→獲得物を廃棄か山札上へ）／ティアラ（獲得物を山札上へ）。
    // 安全側＝自分の手番・トップレベル獲得・他の対話が無いときだけ確認（船乗りと同方針）。
    if (state.turn && pIndex === state.turn.active && state._gainDepth === 1 && !state.pending) {
      const me = state.players[pIndex];
      if (me.hand.includes('watchtower')) state.pending = { type: 'watchtower', player: pIndex, card: cardId, dest: dest || 'discard' };
      else if (me.inPlay.includes('tiara')) state.pending = { type: 'tiara_topdeck', player: pIndex, card: cardId, dest: dest || 'discard' };
    }
    // 船乗り：自分の手番に持続カードを獲得したら、このターン1度だけ即プレイしてよい（確認ダイアログ）。
    // 別の対話(pending)の最中に起きた獲得では出さない（安全側＝主に「購入」時に発動）。
    if (state.turn && pIndex === state.turn.active && (state.turn.sailorPlays || 0) > 0 &&
        DOM.isType(cardId, 'duration') && !state.pending) {
      state.turn.sailorPlays -= 1;
      state.pending = { type: 'sailor_play_gain', player: pIndex, card: cardId, dest: dest || 'discard' };
    }
    // 海辺：財宝を獲得したとき、手札に海賊を持つプレイヤーは反応して使ってよい（安全側＝トップレベル獲得・他の対話が無いとき）。
    if (DOM.isType(cardId, 'treasure') && state._gainDepth === 1 && !state.pending) {
      pirateReactWindow(state, pIndex);
    }
    state._gainDepth--;
  }
  // 「財宝を出したとき」フック（私掠船＝相手のターン最初の銀/金を廃棄。コインは入る）。
  function corsairOnPlayTreasure(state, pIndex, card) {
    if (card !== 'silver' && card !== 'gold') return;
    const t = state.turn;
    if (!t || t.corsairTrashed || pIndex !== t.active) return; // このターン最初の銀/金のみ・出した本人の手番中
    const someoneElse = state.players.some((p, i) => i !== pIndex && (p.delayedEffects || []).some((e) => e.type === 'corsair'));
    if (!someoneElse) return;
    if (removeOne(state.players[pIndex].inPlay, card)) {
      state.trash.push(card); t.corsairTrashed = true;
      log(state, `${state.players[pIndex].name} は私掠船により「${C()[card].name}」を廃棄した。`);
    }
  }
  // 海辺：海賊のリアクション（誰かが財宝を獲得したとき、手札の海賊を使ってよい）。
  // 手番順（獲得者を含む）に、手札に海賊を持つプレイヤーへ「使う/使わない」窓を出す。
  // 使うと海賊を場に出して持続予約（次の手番に6コスト以下の財宝を手札へ）。相手の手番中でも予約は本人の次手番開始で発火する。
  function pirateReactWindow(state, gainerIndex) {
    const n = state.players.length;
    const start = (state.turn && state.turn.active != null) ? state.turn.active : gainerIndex;
    const queue = [];
    for (let k = 0; k < n; k++) {
      const seat = (start + k) % n;
      if (state.players[seat].hand.includes('pirate')) queue.push(seat);
    }
    if (queue.length) pirateReactEnter(state, queue);
  }
  function pirateReactEnter(state, queue) {
    queue = (queue || []).slice();
    while (queue.length && !state.players[queue[0]].hand.includes('pirate')) queue.shift();
    if (!queue.length) { state.pending = null; return; }
    const seat = queue[0];
    state.pending = { type: 'pirate_react', player: seat, queue: queue.slice(1) };
  }
  // アタック無効化（灯台が場/持続にある被害者はアタックを受けない）。§手6で各アタックに配線。
  function attackImmune(state, victim) {
    const v = state.players[victim];
    return v.inPlay.includes('lighthouse') || (v.durationCards || []).includes('lighthouse');
  }

  /* ---------- クリーンアップ＆次の番へ ---------- */
  function cleanupAndAdvance(state) {
    state.replay = []; // 玉座の間の保留分が万一残っても次手番に持ち越さない
    state.reveals = {}; state.revealLatest = null; // 公開表示は手番をまたいで持ち越さない
    const pi = state.turn.active;
    const p = state.players[pi];
    // 城壁のある村: クリーンアップ開始時、場のアクションが（自身を含め）2枚以下なら山札の上に戻せる。
    // 村を山札に戻すのはほぼ常に得なので自動で戻す。
    if (p.inPlay.includes('walled_village')) {
      const actionsInPlay = p.inPlay.filter((c) => DOM.isType(c, 'action')).length;
      if (actionsInPlay <= 2) {
        let n = 0;
        while (removeOne(p.inPlay, 'walled_village')) { p.deck.unshift('walled_village'); n++; }
        if (n) log(state, `${p.name} は城壁のある村 ${n}枚 を山札の上に戻した。`);
      }
    }
    // 宝物庫：このターンに勝利点カードを獲得していなければ、場の宝物庫を山札の上に戻せる（常に得なので自動）。
    if (p.inPlay.includes('treasury') && !(state.turn.gainedThisTurn || []).some((id) => DOM.isType(id, 'victory'))) {
      let n = 0;
      while (removeOne(p.inPlay, 'treasury')) { p.deck.unshift('treasury'); n++; }
      if (n) log(state, `${p.name} は宝物庫 ${n}枚 を山札の上に戻した。`);
    }
    // 錬金術：錬金術師＝片付け開始時、場にポーションがあれば山札の上に戻す（毎ターン使い回せて強いので自動）。
    // ※薬草商より先に処理（薬草商がポーションを先に戻すと錬金術師の条件が崩れるため）。
    if (p.inPlay.includes('alchemist') && p.inPlay.includes('potion')) {
      let n = 0;
      while (removeOne(p.inPlay, 'alchemist')) { p.deck.unshift('alchemist'); n++; }
      if (n) log(state, `${p.name} は錬金術師 ${n}枚 を山札の上に戻した。`);
    }
    // 錬金術：薬草商＝この片付けで、場の財宝を（薬草商の数だけ）山札の上に置いてよい。
    // 銀貨以上の価値ある財宝（ポーション/賢者の石/金貨/銀貨）を自動で戻す（銅貨はデッキを濁すので戻さない）。
    if (state.turn.herbalists) {
      let remain = state.turn.herbalists;
      const rank = (c) => ({ potion: 5, philosophers_stone: 4, gold: 3, silver: 2 }[c] || 0);
      while (remain-- > 0) {
        const cand = p.inPlay.filter((c) => DOM.isType(c, 'treasure') && rank(c) > 0).sort((a, b) => rank(b) - rank(a))[0];
        if (!cand) break;
        removeOne(p.inPlay, cand); p.deck.unshift(cand);
        log(state, `${p.name} は薬草商で「${C()[cand].name}」を山札の上に置いた。`);
      }
    }
    // 密輸人用：このターンに獲得したカードを「直前の手番の獲得」として保存（右隣がこれを参照）。
    p.lastTurnGains = (state.turn.gainedThisTurn || []).slice();

    // --- 海辺：持続カードの仕分け（捨てずに持ち越す）---
    // 予約（delayedEffects）が残っている枚数ぶんだけ durationCards に保持。出し切った持続は捨て札へ。
    const cnt = {}; (p.delayedEffects || []).forEach((e) => { cnt[e.card] = (cnt[e.card] || 0) + 1; });
    const used = {}; const newDur = [];
    for (const c of (p.durationCards || [])) {
      if ((used[c] || 0) < (cnt[c] || 0)) { newDur.push(c); used[c] = (used[c] || 0) + 1; }
      else p.discard.push(c); // 効果を出し切った持続 → 捨て札へ
    }
    const restInPlay = [];
    for (const c of p.inPlay) {
      if (DOM.isType(c, 'duration') && (used[c] || 0) < (cnt[c] || 0)) { newDur.push(c); used[c] = (used[c] || 0) + 1; }
      else restInPlay.push(c);
    }
    p.discard.push(...restInPlay, ...p.hand);
    p.durationCards = newDur;
    p.inPlay = [];
    p.hand = [];

    // 支配：この手番が被支配ターンなら精算する。
    //   獲得したカード → 支配者の捨て札へ（支配者が受け取る）／廃棄したカード → 被支配者の捨て札へ戻す（実際には廃棄されない）。
    if (state.turn.possessedBy != null) {
      const possIdx = state.turn.possessedBy;
      const gains = state.turn.possessionGains || [];
      const back = state.turn.possessionTrash || [];
      gains.forEach((c) => state.players[possIdx].discard.push(c));
      back.forEach((c) => p.discard.push(c));
      if (gains.length) log(state, `${state.players[possIdx].name} は支配で獲得された ${gains.length}枚 を受け取った。`);
      if (back.length) log(state, `${p.name} は支配で廃棄されかけた ${back.length}枚 を取り戻した。`);
    }

    // 前哨地：このプレイヤーの追加ターンか（手札3枚で同一プレイヤー続行）。
    const extra = !!p.outpostExtra;
    p.outpostExtra = false;
    draw(state, pi, extra ? 3 : 5);
    p.turns += 1;

    if (isGameOver(state)) {
      state.gameOver = true;
      state.result = scoreGame(state);
      log(state, `ゲーム終了：${state.result.reason}。`);
      return;
    }
    // 次の手番を決める：1)前哨地=同一プレイヤー 2)支配などの追加ターン待ち行列 3)通常=rotationSeatの次。
    const n = state.players.length;
    const anchor = state.turn.rotationSeat != null ? state.turn.rotationSeat : pi;
    let next, isExtra = false, possessedBy = null, rotationSeat;
    if (extra) {
      next = pi; isExtra = true; rotationSeat = anchor;
    } else if (state.extraTurns && state.extraTurns.length) {
      const et = state.extraTurns.shift();
      next = et.seat; isExtra = true; possessedBy = et.possessedBy; rotationSeat = et.rotationSeat;
    } else {
      next = (anchor + 1) % n; rotationSeat = next;
    }
    state.turn = freshTurn(next, isExtra, { rotationSeat, possessedBy });
    log(state, possessedBy != null
      ? `${state.players[possessedBy].name} が ${state.players[next].name} の追加ターンを操作します（支配）。`
      : (extra ? `${state.players[next].name} の追加ターンです（前哨地）。` : `${state.players[next].name} の番です。`));
    // 海辺：次の手番開始時の予約効果を解決（非対話は即適用、対話は startQueue→pending）。
    resolveDurationStartEffects(state, next);
  }

  /* ============================================================
     reduce: 状態 + 操作 -> 新しい状態
     ============================================================ */
  function reduce(state, action) {
    state = clone(state);
    state = applyAction(state, action);
    return runReplays(state);
  }
  // 玉座の間の「2回目の適用」（および錬金術ゴーレムの2枚目）を、選択待ちが解消したタイミングで実行する。
  function runReplays(state) {
    let guard = 0;
    while (!state.pending && state.replay && state.replay.length && !state.gameOver && guard++ < 200) {
      const r = state.replay.shift();
      if (r.label === 'golem') {
        // ゴーレムで見つけた2枚目：場に置いてから使う（クリーンアップで場から片付く）。
        // アクション権は消費しないが「使った」扱い＝共謀者等の「このターンに使ったアクション数」には数える。
        state.players[r.player].inPlay.push(r.card);
        state.turn.actionsPlayed = (state.turn.actionsPlayed || 0) + 1;
        log(state, `${state.players[r.player].name} はゴーレムで「${C()[r.card].name}」を使った。`);
      } else {
        state.turn.actionsPlayed = (state.turn.actionsPlayed || 0) + 1;
        log(state, `${state.players[r.player].name} は玉座の間で「${C()[r.card].name}」をもう一度使った。`);
      }
      applyEffect(state, r.card, r.player);
    }
    return state;
  }
  function applyAction(state, action) {
    const t = state.turn;
    const pi = t.active;
    const me = state.players[pi];

    if (state.gameOver && action.type !== 'NEW_GAME') return state;

    switch (action.type) {
      /* ---- 新規ゲーム ---- */
      case 'NEW_GAME':
        return createInitialState(action.players, action.kingdom, { startActive: action.startActive });

      /* ---- アクションカードを使う ---- */
      case 'PLAY_ACTION': {
        if (state.pending) return state;
        if (t.phase !== 'action') return state;
        if (t.actions <= 0) return state;
        const card = action.card;
        if (!DOM.isType(card, 'action')) return state;
        if (me.hand.indexOf(card) < 0) return state;
        removeOne(me.hand, card);
        me.inPlay.push(card);
        t.actions -= 1;
        t.actionsPlayed = (t.actionsPlayed || 0) + 1; // 共謀者の判定用（このターンに使ったアクション数）
        log(state, `${me.name} は「${C()[card].name}」を使った。`);
        applyEffect(state, card, pi);
        return state;
      }

      /* ---- 財宝を出す ---- */
      case 'PLAY_TREASURE': {
        if (state.pending) return state;
        if (t.phase !== 'buy') return state;
        const card = action.card;
        if (!DOM.isType(card, 'treasure')) return state;
        if (me.hand.indexOf(card) < 0) return state;
        playTreasureCard(state, pi, card);
        return state;
      }
      case 'PLAY_ALL_TREASURES': {
        if (state.pending) return state;
        if (t.phase !== 'buy') return state;
        // 商人の「最初の銀貨」を確実に最初に出すため、銀貨を先に出す
        const treasures = me.hand.filter((c) => DOM.isType(c, 'treasure'))
          .sort((a, b) => (a === 'silver' ? -1 : 0) - (b === 'silver' ? -1 : 0));
        // 繁栄：金床/投資/水晶玉/ティアラ/ペテン師(堀)は使ったとき選択が出る。pending が立ったら残りは止める。
        for (const card of treasures) { playTreasureCard(state, pi, card); if (state.pending) break; }
        if (treasures.length) log(state, `${me.name} は財宝を出した。`);
        return state;
      }

      /* ---- カードを買う ---- */
      case 'BUY': {
        if (state.pending) return state;
        if (t.phase !== 'buy') return state;
        const card = action.card;
        if (!C()[card]) return state; // 未知のカードIDは状態不変で拒否（throwしない）
        const cost = cardCost(state, card); // 「橋」等のコスト軽減を反映
        const pot = potionCost(card);       // 錬金術：ポーション費用（あれば）
        if ((state.supply[card] || 0) <= 0) return state;
        if (t.buys <= 0) return state;
        if (cost > t.coins) return state;
        if (pot > (t.potions || 0)) return state; // ポーションが足りなければ買えない
        if (!canBuyCard(state, pi, card)) return state; // 繁栄：高級市場は場に銅貨があると買えない
        t.coins -= cost;
        t.potions = (t.potions || 0) - pot;
        t.buys -= 1;
        gain(state, pi, card, 'discard');
        log(state, `${me.name} は「${C()[card].name}」を購入した。`);
        // 繁栄：造幣所を購入したとき、場の財宝をすべて廃棄する。
        if (card === 'mint') {
          const inPlayT = me.inPlay.filter((c) => DOM.isType(c, 'treasure'));
          inPlayT.forEach((c) => { removeOne(me.inPlay, c); state.trash.push(c); });
          if (inPlayT.length) log(state, `${me.name} は造幣所の購入で場の財宝 ${inPlayT.length}枚 を廃棄した。`);
        }
        return state;
      }

      /* ---- フェーズ移行 ---- */
      case 'END_ACTION_PHASE': {
        if (state.pending) return state;
        if (t.phase !== 'action') return state;
        t.phase = 'buy';
        return state;
      }
      case 'END_TURN': {
        if (state.pending) return state;
        if (t.phase !== 'buy') return state;
        cleanupAndAdvance(state);
        return state;
      }

      /* ---- 地下貯蔵庫：捨てて引く ---- */
      case 'CELLAR_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'cellar') return state;
        const p = state.players[pd.player];
        const discardCards = Array.isArray(action.cards) ? action.cards : [];
        let count = 0;
        discardCards.forEach((c) => {
          if (removeOne(p.hand, c)) {
            p.discard.push(c);
            count++;
          }
        });
        draw(state, pd.player, count);
        if (count) log(state, `${p.name} は ${count}枚 捨てて ${count}枚 引いた。`);
        state.pending = null;
        return state;
      }

      /* ---- 民兵：手札3枚まで捨てる / 堀で無効化 ---- */
      case 'MILITIA_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'militia') return state;
        const p = state.players[pd.player];
        const discardCards = Array.isArray(action.cards) ? action.cards : [];
        // 指定カードがすべて手札にあり、捨てた後ちょうど3枚になること
        const target = Math.min(3, p.hand.length);
        if (p.hand.length - discardCards.length !== target) return state;
        const handCopy = p.hand.slice();
        for (const c of discardCards) {
          if (!removeOne(handCopy, c)) return state; // 手札に無いカード指定は拒否
        }
        discardCards.forEach((c) => {
          removeOne(p.hand, c);
          p.discard.push(c);
        });
        log(state, `${p.name} は手札を ${discardCards.length}枚 捨てた。`);
        advanceMilitia(state, pd);
        return state;
      }
      case 'MOAT_REVEAL': {
        const pd = state.pending;
        if (!pd) return state;
        const p = state.players[pd.player];
        if (p.hand.indexOf('moat') < 0) return state;
        // 堀で無効化できるのは「アタックを受ける側の反応ステップ」だけ。
        // 段階アタック(詐欺師など)の gain ステップ(攻撃側が操作)では撃てない。
        if (!isAttackReactPending(pd)) return state;
        log(state, `${p.name} は「堀」を公開し、アタックを無効化した。`);
        ATTACKS[pd.type].onMoat(state, pd); // 登録表を引いて「この被害者を飛ばして次へ」
        return state;
      }

      /* ---- 鉱山 ---- */
      case 'MINE_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'mine' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        if (action.card == null) {
          // 廃棄しない → 終了
          state.pending = null;
          return state;
        }
        const card = action.card;
        if (!DOM.isType(card, 'treasure') || p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card);
        state.trash.push(card);
        log(state, `${p.name} は「${C()[card].name}」を廃棄した。`);
        const mMax = cardCost(state, card) + 3;
        // 獲得できる財宝が無ければ選択待ちにせず終了（デッドロック回避）
        state.pending = anyGainable(state, (id) => DOM.isType(id, 'treasure') && cardCost(state, id) <= mMax)
          ? { type: 'mine', stage: 'gain', player: pd.player, maxCost: mMax }
          : null;
        return state;
      }
      case 'MINE_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'mine' || pd.stage !== 'gain') return state;
        finishGain(state, pd, action.card, (id) => DOM.isType(id, 'treasure') && cardCost(state, id) <= pd.maxCost, 'hand', '手札に獲得した。');
        return state;
      }

      /* ---- 改築 ---- */
      case 'REMODEL_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'remodel' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card);
        state.trash.push(card);
        log(state, `${p.name} は「${C()[card].name}」を廃棄した。`);
        const rMax = cardCost(state, card) + 2;
        // 獲得できるカードが無ければ選択待ちにせず終了（デッドロック回避）
        state.pending = anyGainable(state, (id) => cardCost(state, id) <= rMax)
          ? { type: 'remodel', stage: 'gain', player: pd.player, maxCost: rMax }
          : null;
        return state;
      }
      case 'REMODEL_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'remodel' || pd.stage !== 'gain') return state;
        finishGain(state, pd, action.card, (id) => !!C()[id] && cardCost(state, id) <= pd.maxCost, 'discard', '獲得した。');
        return state;
      }

      /* ---- 工房 ---- */
      case 'WORKSHOP_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'workshop') return state;
        finishGain(state, pd, action.card, (id) => !!C()[id] && cardCost(state, id) <= 4, 'discard', '獲得した。');
        return state;
      }

      /* ===== 拡張: 陰謀 の選択解決 ===== */

      /* ---- 中庭：手札1枚を山札の上へ ---- */
      case 'COURTYARD_PUT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'courtyard') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card);
        p.deck.unshift(card);
        log(state, `${p.name} は手札1枚を山札の上に置いた。`);
        state.pending = null;
        return state;
      }

      /* ---- 従者：4つから異なる2つ ---- */
      case 'PAWN_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'pawn') return state;
        const valid = ['card', 'action', 'buy', 'coin'];
        const ch = Array.isArray(action.choices)
          ? action.choices.filter((c, i, a) => valid.includes(c) && a.indexOf(c) === i) : [];
        if (ch.length !== 2) return state; // 異なる2つ必須
        ch.forEach((c) => {
          if (c === 'card') draw(state, pd.player, 1);
          else if (c === 'action') t.actions += 1;
          else if (c === 'buy') t.buys += 1;
          else if (c === 'coin') t.coins += 1;
        });
        log(state, `${state.players[pd.player].name} は従者の効果を選んだ。`);
        state.pending = null;
        return state;
      }

      /* ---- 執事：選択 / 廃棄2 ---- */
      case 'STEWARD_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'steward' || pd.stage !== 'choose') return state;
        const p = state.players[pd.player];
        if (action.choice === 'cards') { draw(state, pd.player, 2); log(state, `${p.name} は執事で2枚引いた。`); state.pending = null; }
        else if (action.choice === 'coins') { t.coins += 2; log(state, `${p.name} は執事で +2 コイン。`); state.pending = null; }
        else if (action.choice === 'trash') {
          state.pending = p.hand.length > 0 ? { type: 'steward', stage: 'trash', player: pd.player } : null;
        }
        return state;
      }
      case 'STEWARD_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'steward' || pd.stage !== 'trash') return state;
        const want = Math.min(2, state.players[pd.player].hand.length);
        if (!trashFromHand(state, pd.player, action.cards, want, '廃棄した。')) return state;
        state.pending = null;
        return state;
      }

      /* ---- 願いの井戸：宣言して山札の上を公開 ---- */
      case 'WISHING_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'wishing') return state;
        const p = state.players[pd.player];
        const named = action.card;
        if (!C()[named]) return state;
        if (p.deck.length === 0 && p.discard.length > 0) { p.deck = shuffle(p.discard); p.discard = []; }
        const top = p.deck.length ? p.deck[0] : null;
        if (top != null) {
          reveal(state, pd.player, [top], '願いの井戸で山札の上を公開');
          log(state, `${p.name} は「${C()[named].name}」を宣言。山札の上は「${C()[top].name}」。`);
          if (top === named) { p.hand.push(p.deck.shift()); log(state, '当たり！ 手札に加えた。'); }
        } else {
          log(state, `${p.name} は「${C()[named].name}」を宣言したが山札が空だった。`);
        }
        state.pending = null;
        return state;
      }

      /* ---- 男爵：屋敷を捨てて+4 / 屋敷を獲得 ---- */
      case 'BARON_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'baron') return state;
        const p = state.players[pd.player];
        if (action.discard && p.hand.indexOf('estate') >= 0) {
          removeOne(p.hand, 'estate');
          p.discard.push('estate');
          t.coins += 4;
          log(state, `${p.name} は屋敷を捨てて +4 コイン。`);
        } else {
          if (gain(state, pd.player, 'estate', 'discard')) log(state, `${p.name} は屋敷を獲得した。`);
          else log(state, `${p.name} は屋敷を獲得しようとしたが山が空だった。`);
        }
        state.pending = null;
        return state;
      }

      /* ---- 鉄工所：コスト4以下を獲得＋種別ボーナス ---- */
      case 'IRONWORKS_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'ironworks') return state;
        const card = action.card;
        const canGain = (id) => !!C()[id] && cardCost(state, id) <= 4;
        if (card == null) {
          if (anyGainable(state, canGain)) return state; // 獲得は強制
          state.pending = null; return state;
        }
        if (!canGain(card) || (state.supply[card] || 0) <= 0) return state;
        gain(state, pd.player, card, 'discard');
        log(state, `${state.players[pd.player].name} は「${C()[card].name}」を獲得した。`);
        // 該当する種別すべてのボーナス（後宮=財宝+勝利点 等は両方）
        if (DOM.isType(card, 'action')) t.actions += 1;
        if (DOM.isType(card, 'treasure')) t.coins += 1;
        if (DOM.isType(card, 'victory')) draw(state, pd.player, 1);
        state.pending = null;
        return state;
      }

      /* ---- 鉱山の村：場のこれを廃棄して+2コイン（任意）---- */
      case 'MINING_VILLAGE_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'mining_village') return state;
        const p = state.players[pd.player];
        if (action.trash && removeOne(p.inPlay, 'mining_village')) {
          state.trash.push('mining_village');
          t.coins += 2;
          log(state, `${p.name} は鉱山の村を廃棄して +2 コイン。`);
        }
        state.pending = null;
        return state;
      }

      /* ---- 貴族：+3カード or +2アクション ---- */
      case 'NOBLES_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'nobles') return state;
        if (action.choice === 'actions') t.actions += 2;
        else draw(state, pd.player, 3);
        log(state, `${state.players[pd.player].name} は貴族の効果を選んだ。`);
        state.pending = null;
        return state;
      }

      /* ---- 拷問人（アタック）：手札2枚を捨てる or 呪いを手札に ---- */
      case 'TORTURER_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'torturer') return state;
        const p = state.players[pd.player];
        if (action.choice === 'curse') {
          if ((state.supply.curse || 0) > 0) { gain(state, pd.player, 'curse', 'hand'); log(state, `${p.name} は呪いを手札に受け取った。`); }
          else log(state, `${p.name} は呪いを受けようとしたが、呪いの山が空だった。`);
        } else {
          const want = Math.min(2, p.hand.length);
          const cards = Array.isArray(action.cards) ? action.cards : [];
          if (cards.length !== want) return state;
          const handCopy = p.hand.slice();
          for (const c of cards) if (!removeOne(handCopy, c)) return state;
          cards.forEach((c) => { removeOne(p.hand, c); p.discard.push(c); });
          log(state, `${p.name} は手札 ${cards.length}枚 を捨てた。`);
        }
        advanceAttack(state, pd);
        return state;
      }

      /* ---- 詐欺師：犠牲者の反応 / 攻撃側が獲得物を選ぶ ---- */
      case 'SWINDLER_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'swindler' || pd.stage !== 'react') return state;
        // 反応者が堀を出さずに通す（堀を出す場合は MOAT_REVEAL 経由）
        swindlerTrash(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'SWINDLER_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'swindler' || pd.stage !== 'gain') return state;
        const card = action.card;
        const canGain = (id) => !!C()[id] && cardCost(state, id) === pd.cost;
        if (card == null || !canGain(card) || (state.supply[card] || 0) <= 0) return state; // 候補ありなら必ず選ぶ
        gain(state, pd.victim, card, 'discard');
        log(state, `${state.players[pd.victim].name} は「${C()[card].name}」を獲得した（詐欺師）。`);
        swindlerEnterVictim(state, pd.source, pd.queue);
        return state;
      }

      /* ---- 仮面舞踏会：各自が左隣へ1枚渡す→使用者は任意で1枚廃棄 ---- */
      /* ---- 魔女：反応せず受ける（→呪い獲得）---- */
      case 'WITCH_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'witch' || pd.stage !== 'react') return state;
        witchCurse(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      /* ---- 役人：反応せず受ける / 勝利点を山札の上へ ---- */
      case 'BUREAUCRAT_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'bureaucrat' || pd.stage !== 'react') return state;
        bureaucratApply(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'BUREAUCRAT_PUT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'bureaucrat' || pd.stage !== 'put') return state;
        const v = state.players[pd.victim];
        const card = action.card;
        if (v.hand.indexOf(card) < 0 || !DOM.isType(card, 'victory')) return state; // 勝利点のみ
        removeOne(v.hand, card);
        v.deck.unshift(card);
        reveal(state, pd.victim, [card], '役人で公開し山札の上へ');
        log(state, `${v.name} は「${C()[card].name}」を山札の上に置いた（役人）。`);
        bureaucratEnterVictim(state, pd.source, pd.queue);
        return state;
      }

      /* ---- 玉座の間：選んだアクションを2回使う ---- */
      case 'THRONE_CHOOSE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'throne') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0 || !DOM.isType(card, 'action')) return state;
        removeOne(p.hand, card);
        p.inPlay.push(card);
        t.actionsPlayed = (t.actionsPlayed || 0) + 1;
        state.pending = null;
        log(state, `${p.name} は玉座の間で「${C()[card].name}」を使った（1回目）。`);
        applyEffect(state, card, pd.player);     // 1回目
        state.replay = state.replay || [];
        state.replay.push({ player: pd.player, card }); // 2回目は pending 解消後に runReplays が適用
        return state;
      }

      /* ---- 書庫：引いたアクションを脇に置く/手札に ---- */
      case 'LIBRARY_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'library') return state;
        const p = state.players[pd.player];
        const aside = pd.aside.slice();
        if (action.setAside) {
          if (removeOne(p.hand, pd.card)) { aside.push(pd.card); log(state, `${p.name} は「${C()[pd.card].name}」を脇に置いた（書庫）。`); }
        }
        libraryStep(state, pd.player, aside);
        return state;
      }

      /* ---- 密偵：公開した山札の上を捨てる/戻す ---- */
      case 'SPY_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'spy' || pd.stage !== 'react') return state;
        spyReveal(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'SPY_DECIDE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'spy' || pd.stage !== 'decide') return state;
        const tp = state.players[pd.victim];
        if (action.discard && tp.deck.length > 0) {
          const c = tp.deck.shift(); tp.discard.push(c);
          log(state, `${tp.name} は山札の上の「${C()[c].name}」を捨てた（密偵）。`);
        } else {
          log(state, `${tp.name} は山札の上をそのままにした（密偵）。`);
        }
        spyEnterTarget(state, pd.source, pd.queue);
        return state;
      }

      /* ---- 泥棒：財宝1枚を廃棄→獲得してよい ---- */
      case 'THIEF_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'thief' || pd.stage !== 'react') return state;
        thiefReveal(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'THIEF_PICK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'thief' || pd.stage !== 'pick') return state;
        const v = state.players[pd.victim];
        const card = action.card;
        if (pd.treasures.indexOf(card) < 0) return state; // 公開された財宝のみ
        // 選んだ財宝を廃棄、その他の公開札は犠牲者の捨て札へ
        const rest = pd.revealed.slice();
        const i = rest.indexOf(card); rest.splice(i, 1);
        state.trash.push(card);
        rest.forEach((c) => v.discard.push(c));
        log(state, `${v.name} の「${C()[card].name}」を廃棄した（泥棒）。`);
        state.pending = { type: 'thief', stage: 'gain', player: pd.source, source: pd.source, victim: pd.victim, trashed: card, queue: pd.queue };
        return state;
      }
      case 'THIEF_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'thief' || pd.stage !== 'gain') return state;
        if (action.take && removeOne(state.trash, pd.trashed)) {
          state.players[pd.source].discard.push(pd.trashed);
          log(state, `${state.players[pd.source].name} は廃棄された「${C()[pd.trashed].name}」を獲得した（泥棒）。`);
        }
        thiefEnterVictim(state, pd.source, pd.queue);
        return state;
      }

      /* ---- 祝宴：コスト5以下を獲得 ---- */
      case 'FEAST_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'feast') return state;
        finishGain(state, pd, action.card, (id) => !!C()[id] && cardCost(state, id) <= 5, 'discard', '獲得した（祝宴）。');
        return state;
      }

      /* ---- 金貸し：銅貨を廃棄して +3 ---- */
      case 'MONEYLENDER_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'moneylender') return state;
        const p = state.players[pd.player];
        if (action.trash && removeOne(p.hand, 'copper')) {
          state.trash.push('copper');
          t.coins += 3;
          log(state, `${p.name} は銅貨を廃棄して +3 コイン（金貸し）。`);
        }
        state.pending = null;
        return state;
      }
      /* ---- 宰相：山札を捨て札にしてもよい ---- */
      case 'CHANCELLOR_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'chancellor') return state;
        const p = state.players[pd.player];
        if (action.discardDeck && p.deck.length > 0) {
          p.discard.push(...p.deck); p.deck = [];
          log(state, `${p.name} は山札をすべて捨て札にした（宰相）。`);
        }
        state.pending = null;
        return state;
      }
      /* ---- 礼拝堂：手札を最大4枚廃棄 ---- */
      case 'CHAPEL_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'chapel') return state;
        const p = state.players[pd.player];
        const cards = (Array.isArray(action.cards) ? action.cards : []).slice(0, 4);
        const handCopy = p.hand.slice();
        for (const c of cards) if (!removeOne(handCopy, c)) return state; // 手札に無い指定は拒否
        let n = 0;
        cards.forEach((c) => { if (removeOne(p.hand, c)) { state.trash.push(c); n++; } });
        if (n) log(state, `${p.name} は手札 ${n}枚 を廃棄した（礼拝堂）。`);
        state.pending = null;
        return state;
      }

      /* ---- 秘密の小部屋 ---- */
      // アクション: 捨てた枚数だけ +1コイン
      case 'SECRET_CHAMBER_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'secret_chamber' || pd.stage !== 'discard') return state;
        const p = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        const handCopy = p.hand.slice();
        for (const c of cards) if (!removeOne(handCopy, c)) return state; // 手札に無い指定は拒否
        let n = 0;
        cards.forEach((c) => { if (removeOne(p.hand, c)) { p.discard.push(c); n++; } });
        t.coins += n;
        log(state, `${p.name} は ${n}枚 捨てて +${n} コイン（秘密の小部屋）。`);
        state.pending = null;
        return state;
      }
      // リアクション: 他人のアタックに対し公開→+2カード→2枚を山札の上に戻す。アタックは無効化しない。
      case 'SECRET_CHAMBER_REVEAL': {
        const pd = state.pending;
        if (!isAttackReactPending(pd) || pd.reacted) return state; // reacted ガード（無限公開を防ぐ）
        const p = state.players[pd.player];
        if (p.hand.indexOf('secret_chamber') < 0) return state;
        draw(state, pd.player, 2);
        log(state, `${p.name} は秘密の小部屋を公開して2枚引いた。`);
        // 元のアタックpendingを reacted=true で保存し、戻し終えたら復帰
        state.pending = { type: 'secret_chamber_putback', player: pd.player, saved: Object.assign({}, pd, { reacted: true }) };
        return state;
      }
      case 'SECRET_CHAMBER_PUTBACK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'secret_chamber_putback') return state;
        const p = state.players[pd.player];
        const want = Math.min(2, p.hand.length);
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (cards.length !== want) return state;
        const handCopy = p.hand.slice();
        for (const c of cards) if (!removeOne(handCopy, c)) return state;
        cards.forEach((c) => removeOne(p.hand, c));
        for (let i = cards.length - 1; i >= 0; i--) p.deck.unshift(cards[i]); // 先頭が一番上
        log(state, `${p.name} は手札2枚を山札の上に戻した。`);
        state.pending = pd.saved; // 元のアタック解決へ復帰（reacted=true で再公開不可）
        return state;
      }

      case 'MASQUERADE_PASS': {
        const pd = state.pending;
        if (!pd || pd.type !== 'masquerade' || pd.stage !== 'pass') return state;
        const cur = pd.order[pd.pos];
        const card = action.card;
        if (state.players[cur].hand.indexOf(card) < 0) return state;
        const picks = Object.assign({}, pd.picks); picks[cur] = card;
        const nextPos = pd.pos + 1;
        if (nextPos < pd.order.length) {
          state.pending = { type: 'masquerade', stage: 'pass', player: pd.order[nextPos], source: pd.source, order: pd.order, pos: nextPos, picks };
        } else {
          masqueradeApplyPasses(state, pd.order, picks);
          masqueradeAfterPass(state, pd.source);
        }
        return state;
      }
      case 'MASQUERADE_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'masquerade' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (card != null) {
          if (p.hand.indexOf(card) < 0) return state;
          removeOne(p.hand, card); state.trash.push(card);
          log(state, `${p.name} は「${C()[card].name}」を廃棄した。`);
        } else {
          log(state, `${p.name} は廃棄しなかった。`);
        }
        state.pending = null;
        return state;
      }

      /* ---- 手先：攻撃側の選択（+2コイン or 全員引き直し）---- */
      case 'MINION_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'minion' || pd.stage !== 'choose') return state;
        const p = state.players[pd.player];
        if (action.choice === 'coins') {
          t.coins += 2;
          log(state, `${p.name} は手先で +2 コイン。`);
          state.pending = null;
        } else if (action.choice === 'attack') {
          p.discard.push(...p.hand); p.hand = [];
          draw(state, pd.player, 4);
          log(state, `${p.name} は手札を捨てて4枚引いた（手先）。`);
          // 手札5枚以上の他プレイヤーも引き直し（堀で無効化可）
          const vics = [];
          for (let k = 1; k < state.players.length; k++) vics.push((pd.player + k) % state.players.length);
          minionAttackEnterVictim(state, pd.player, vics);
        } else {
          return state;
        }
        return state;
      }
      case 'MINION_ATTACK_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'minion_attack' || pd.stage !== 'react') return state;
        minionAttackApply(state, pd.source, pd.victim, pd.queue);
        return state;
      }

      /* ---- 破壊工作員：犠牲者の反応 / 任意で格下げ獲得 ---- */
      case 'SABOTEUR_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'saboteur' || pd.stage !== 'react') return state;
        saboteurReveal(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'SABOTEUR_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'saboteur' || pd.stage !== 'gain') return state;
        const card = action.card;
        if (card != null) {
          // 獲得は任意。コスト上限を超える/在庫切れの指定は無視して再選択
          if (!C()[card] || cardCost(state, card) > pd.maxCost || (state.supply[card] || 0) <= 0) return state;
          gain(state, pd.victim, card, 'discard');
          log(state, `${state.players[pd.victim].name} は「${C()[card].name}」を獲得した（破壊工作員）。`);
        } else {
          log(state, `${state.players[pd.victim].name} は獲得しなかった。`);
        }
        saboteurEnterVictim(state, pd.source, pd.queue);
        return state;
      }

      /* ---- 交易場：手札2枚廃棄→銀貨を手札に ---- */
      case 'TRADING_POST_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'trading_post') return state;
        const p = state.players[pd.player];
        const want = Math.min(2, p.hand.length);
        if (!trashFromHand(state, pd.player, action.cards, want, '廃棄した。')) return state;
        // 2枚廃棄できたときだけ銀貨を手札に獲得（公式: trash 2 → gain Silver to hand）
        if (want === 2 && gain(state, pd.player, 'silver', 'hand')) {
          log(state, `${p.name} は銀貨を手札に獲得した。`);
        }
        state.pending = null;
        return state;
      }

      /* ---- 斥候：非勝利点カードを好きな順で山札の上へ戻す ---- */
      case 'SCOUT_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'scout') return state;
        const p = state.players[pd.player];
        const order = Array.isArray(action.order) ? action.order : [];
        // order は pd.cards の並べ替え（同じ多重集合）でなければ拒否
        const a = pd.cards.slice().sort(), b = order.slice().sort();
        if (a.length !== b.length || a.some((c, i) => c !== b[i])) return state;
        // order[0] が一番上になるよう、後ろから unshift
        for (let i = order.length - 1; i >= 0; i--) p.deck.unshift(order[i]);
        log(state, `${p.name} は山札の上を並べ替えた。`);
        state.pending = null;
        return state;
      }

      /* ---- 改良：1枚廃棄→ちょうど+1コストを獲得 ---- */
      case 'UPGRADE_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'upgrade' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card);
        state.trash.push(card);
        log(state, `${p.name} は「${C()[card].name}」を廃棄した。`);
        const exact = cardCost(state, card) + 1;
        // ちょうど exact コストの獲得候補が無ければ獲得なしで終了（デッドロック回避）
        state.pending = anyGainable(state, (id) => cardCost(state, id) === exact)
          ? { type: 'upgrade', stage: 'gain', player: pd.player, exactCost: exact }
          : null;
        if (!state.pending) log(state, `ちょうど ${exact} コストのカードが無く、獲得できなかった。`);
        return state;
      }
      case 'UPGRADE_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'upgrade' || pd.stage !== 'gain') return state;
        finishGain(state, pd, action.card, (id) => !!C()[id] && cardCost(state, id) === pd.exactCost, 'discard', '獲得した。');
        return state;
      }

      /* ===== 基本セット 第二版 の選択解決 ===== */
      /* ---- 前駆者：捨て札1枚を山札の上へ（任意）---- */
      case 'HARBINGER_PUT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'harbinger') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (card != null && removeOne(p.discard, card)) {
          p.deck.unshift(card);
          log(state, `${p.name} は捨て札の「${C()[card].name}」を山札の上に置いた（前駆者）。`);
        }
        state.pending = null;
        return state;
      }
      /* ---- 家臣：捨てたアクションを使う/使わない ---- */
      case 'VASSAL_PLAY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'vassal') return state;
        const p = state.players[pd.player];
        state.pending = null;
        if (action.play && removeOne(p.discard, pd.card)) {
          p.inPlay.push(pd.card);
          t.actionsPlayed = (t.actionsPlayed || 0) + 1;
          log(state, `${p.name} は家臣で「${C()[pd.card].name}」を使った。`);
          applyEffect(state, pd.card, pd.player); // 別の選択待ちが立つこともある
        }
        return state;
      }
      /* ---- 密猟者：空の山1つにつき手札1枚を捨てる ---- */
      case 'POACHER_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'poacher') return state;
        if (!discardFromHand(state, pd.player, action.cards, pd.need, '捨てた（密猟者）。')) return state;
        state.pending = null;
        return state;
      }
      /* ---- 山賊：犠牲者の反応 / 廃棄する財宝を選ぶ ---- */
      case 'BANDIT_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'bandit' || pd.stage !== 'react') return state;
        banditReveal(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'BANDIT_PICK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'bandit' || pd.stage !== 'pick') return state;
        const v = state.players[pd.victim];
        const card = action.card;
        if (pd.cands.indexOf(card) < 0) return state;
        const rest = pd.revealed.slice();
        rest.splice(rest.indexOf(card), 1);
        state.trash.push(card);
        rest.forEach((c) => v.discard.push(c));
        log(state, `${v.name} は「${C()[card].name}」を廃棄した（山賊）。`);
        banditEnterVictim(state, pd.source, pd.queue);
        return state;
      }
      /* ---- 衛兵：上2枚を 廃棄/捨て/山札の上 に振り分ける ---- */
      case 'SENTRY_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'sentry') return state;
        const p = state.players[pd.player];
        const tr = Array.isArray(action.trash) ? action.trash : [];
        const di = Array.isArray(action.discard) ? action.discard : [];
        const top = Array.isArray(action.top) ? action.top : [];
        const all = tr.concat(di, top).slice().sort();
        const want = pd.cards.slice().sort();
        if (all.length !== want.length || all.some((c, i) => c !== want[i])) return state; // 同じ多重集合のみ
        tr.forEach((c) => state.trash.push(c));
        di.forEach((c) => p.discard.push(c));
        for (let i = top.length - 1; i >= 0; i--) p.deck.unshift(top[i]); // top[0] が一番上
        if (tr.length) log(state, `${p.name} は ${tr.length}枚 廃棄した（衛兵）。`);
        if (di.length) log(state, `${p.name} は ${di.length}枚 捨てた（衛兵）。`);
        state.pending = null;
        return state;
      }
      /* ---- 職人：コスト5以下を手札に獲得→手札1枚を山札の上へ ---- */
      case 'ARTISAN_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'artisan' || pd.stage !== 'gain') return state;
        const card = action.card;
        const canGain = (id) => !!C()[id] && cardCost(state, id) <= 5;
        if (card == null || !canGain(card) || (state.supply[card] || 0) <= 0) return state; // 獲得は強制
        gain(state, pd.player, card, 'hand');
        log(state, `${state.players[pd.player].name} は「${C()[card].name}」を手札に獲得した（職人）。`);
        state.pending = { type: 'artisan', stage: 'put', player: pd.player };
        return state;
      }
      case 'ARTISAN_PUT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'artisan' || pd.stage !== 'put') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card);
        p.deck.unshift(card);
        log(state, `${p.name} は手札1枚を山札の上に置いた（職人）。`);
        state.pending = null;
        return state;
      }

      /* ===== 陰謀 第二版 の選択解決 ===== */
      /* ---- 廷臣：手札1枚を公開→種類数だけ効果を選ぶ ---- */
      case 'COURTIER_REVEAL': {
        const pd = state.pending;
        if (!pd || pd.type !== 'courtier' || pd.stage !== 'reveal') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        reveal(state, pd.player, [card], '廷臣で手札を公開');
        const nTypes = (C()[card].types || []).length;
        const n = Math.min(nTypes, 4);
        log(state, `${p.name} は「${C()[card].name}」を公開した（種類 ${nTypes}）。`);
        state.pending = { type: 'courtier', stage: 'choose', player: pd.player, n, card };
        return state;
      }
      case 'COURTIER_CHOOSE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'courtier' || pd.stage !== 'choose') return state;
        const valid = ['action', 'buy', 'coin', 'gold'];
        const ch = Array.isArray(action.choices)
          ? action.choices.filter((c, i, a) => valid.includes(c) && a.indexOf(c) === i) : [];
        if (ch.length !== pd.n) return state; // 異なる n 個を選ぶ
        ch.forEach((c) => {
          if (c === 'action') t.actions += 1;
          else if (c === 'buy') t.buys += 1;
          else if (c === 'coin') t.coins += 3;
          else if (c === 'gold') { if (gain(state, pd.player, 'gold', 'discard')) log(state, `${state.players[pd.player].name} は金貨を獲得した（廷臣）。`); }
        });
        log(state, `${state.players[pd.player].name} は廷臣の効果を選んだ。`);
        state.pending = null;
        return state;
      }

      /* ---- 外交官（リアクション）：アタック時に公開→2枚引き3枚捨てる ---- */
      case 'DIPLOMAT_REVEAL': {
        const pd = state.pending;
        if (!isAttackReactPending(pd) || pd.diplomatReacted) return state;
        const p = state.players[pd.player];
        if (!p.hand.includes('diplomat') || p.hand.length < 5) return state;
        draw(state, pd.player, 2);
        log(state, `${p.name} は外交官を公開して2枚引いた。`);
        // 元のアタック反応ステップを diplomatReacted=true で退避し、3枚捨ててから復帰
        state.pending = { type: 'diplomat_discard', player: pd.player, saved: Object.assign({}, pd, { diplomatReacted: true }) };
        return state;
      }
      case 'DIPLOMAT_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'diplomat_discard') return state;
        const want = Math.min(3, state.players[pd.player].hand.length);
        if (!discardFromHand(state, pd.player, action.cards, want, '捨てた（外交官）。')) return state;
        state.pending = pd.saved; // 元のアタック反応ステップへ戻る
        return state;
      }

      /* ---- 待ち伏せ：サプライのアクションを廃棄 / 廃棄置場からアクションを獲得 ---- */
      case 'LURKER_CHOOSE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'lurker' || pd.stage !== 'choose') return state;
        if (action.choice === 'trash') {
          const canTrash = (id) => DOM.isType(id, 'action') && (state.supply[id] || 0) > 0;
          state.pending = Object.keys(state.supply).some(canTrash)
            ? { type: 'lurker', stage: 'trash', player: pd.player } : null;
        } else if (action.choice === 'gain') {
          state.pending = state.trash.some((id) => DOM.isType(id, 'action'))
            ? { type: 'lurker', stage: 'gain', player: pd.player } : null;
        } else return state;
        return state;
      }
      case 'LURKER_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'lurker' || pd.stage !== 'trash') return state;
        const card = action.card;
        if (!C()[card] || !DOM.isType(card, 'action') || (state.supply[card] || 0) <= 0) return state;
        state.supply[card] -= 1;
        state.trash.push(card);
        log(state, `${state.players[pd.player].name} はサプライの「${C()[card].name}」を廃棄した（待ち伏せ）。`);
        state.pending = null;
        return state;
      }
      case 'LURKER_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'lurker' || pd.stage !== 'gain') return state;
        const card = action.card;
        if (!DOM.isType(card, 'action') || !removeOne(state.trash, card)) return state;
        state.players[pd.player].discard.push(card);
        log(state, `${state.players[pd.player].name} は廃棄置き場の「${C()[card].name}」を獲得した（待ち伏せ）。`);
        state.pending = null;
        return state;
      }

      /* ---- 風車：手札2枚を捨てて +2 コイン（任意）---- */
      case 'MILL_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'mill') return state;
        const p = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (cards.length === 0) { state.pending = null; return state; } // 捨てない
        if (cards.length !== 2) return state;
        const handCopy = p.hand.slice();
        for (const c of cards) if (!removeOne(handCopy, c)) return state;
        cards.forEach((c) => { removeOne(p.hand, c); p.discard.push(c); });
        t.coins += 2;
        log(state, `${p.name} は手札2枚を捨てて +2 コイン（風車）。`);
        state.pending = null;
        return state;
      }

      /* ---- パトロール：非（勝利点/呪い）カードを好きな順で山札の上へ ---- */
      case 'PATROL_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'patrol') return state;
        const p = state.players[pd.player];
        const order = Array.isArray(action.order) ? action.order : [];
        const a = pd.cards.slice().sort(), b = order.slice().sort();
        if (a.length !== b.length || a.some((c, i) => c !== b[i])) return state;
        for (let i = order.length - 1; i >= 0; i--) p.deck.unshift(order[i]);
        log(state, `${p.name} は山札の上を並べ替えた（パトロール）。`);
        state.pending = null;
        return state;
      }

      /* ---- 身代わり：廃棄→+$2まで獲得（ア/財は山札上、勝利点は他全員に呪い）---- */
      case 'REPLACE_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'replace' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card);
        state.trash.push(card);
        log(state, `${p.name} は「${C()[card].name}」を廃棄した（身代わり）。`);
        const maxCost = cardCost(state, card) + 2;
        state.pending = anyGainable(state, (id) => cardCost(state, id) <= maxCost)
          ? { type: 'replace', stage: 'gain', player: pd.player, source: pd.player, maxCost }
          : null;
        return state;
      }
      case 'REPLACE_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'replace' || pd.stage !== 'gain') return state;
        const card = action.card;
        const canGain = (id) => !!C()[id] && cardCost(state, id) <= pd.maxCost;
        if (card == null || !canGain(card) || (state.supply[card] || 0) <= 0) return state; // 獲得は強制
        const toDeck = DOM.isType(card, 'action') || DOM.isType(card, 'treasure');
        gain(state, pd.player, card, toDeck ? 'deck' : 'discard');
        log(state, `${state.players[pd.player].name} は「${C()[card].name}」を獲得した（身代わり）。`);
        if (DOM.isType(card, 'victory')) {
          const vics = [];
          for (let k = 1; k < state.players.length; k++) vics.push((pd.player + k) % state.players.length);
          replaceEnterVictim(state, pd.player, vics); // 勝利点獲得時は他全員が呪い（アタック）
        } else {
          state.pending = null;
        }
        return state;
      }
      case 'REPLACE_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'replace' || pd.stage !== 'react') return state;
        replaceCurse(state, pd.source, pd.victim, pd.queue);
        return state;
      }

      /* ---- 隠し通路：手札1枚を山札の好きな位置へ ---- */
      case 'SECRET_PASSAGE_PICK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'secret_passage' || pd.stage !== 'pick') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        state.pending = { type: 'secret_passage', stage: 'place', player: pd.player, card };
        return state;
      }
      case 'SECRET_PASSAGE_PLACE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'secret_passage' || pd.stage !== 'place') return state;
        const p = state.players[pd.player];
        if (p.hand.indexOf(pd.card) < 0) return state;
        let pos = Number.isInteger(action.pos) ? action.pos : 0;
        pos = Math.max(0, Math.min(pos, p.deck.length)); // 0=一番上, deck.length=一番下
        removeOne(p.hand, pd.card);
        p.deck.splice(pos, 0, pd.card);
        log(state, `${p.name} は手札1枚を山札に入れた（隠し通路）。`);
        state.pending = null;
        return state;
      }

      /* ===== プロモカード の選択解決 ===== */
      /* ---- 使者：左隣が公開5枚から1枚を選び、使用者がそれを捨てる ---- */
      case 'ENVOY_PICK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'envoy') return state;
        const card = action.card;
        if (pd.revealed.indexOf(card) < 0) return state;
        const src = state.players[pd.source];
        const rest = pd.revealed.slice();
        rest.splice(rest.indexOf(card), 1);
        src.discard.push(card);
        rest.forEach((c) => src.hand.push(c));
        log(state, `${state.players[pd.player].name} は使者で ${src.name} の「${C()[card].name}」を捨てさせた。`);
        state.pending = null;
        return state;
      }

      /* ---- 総督：モード選択（自分は強い方、他は弱い方）---- */
      case 'GOVERNOR_CHOOSE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'governor' || pd.stage !== 'choose') return state;
        const src = pd.player;
        const others = [];
        for (let k = 1; k < state.players.length; k++) others.push((src + k) % state.players.length);
        if (action.choice === 'cards') {
          draw(state, src, 3);
          others.forEach((o) => draw(state, o, 1));
          log(state, `${state.players[src].name} は総督で +3カード（他は各 +1カード）。`);
          state.pending = null;
        } else if (action.choice === 'silver') {
          if (gain(state, src, 'gold', 'discard')) log(state, `${state.players[src].name} は総督で金貨を獲得（他は銀貨）。`);
          others.forEach((o) => gain(state, o, 'silver', 'discard'));
          state.pending = null;
        } else if (action.choice === 'remodel') {
          const queue = [{ p: src, delta: 2 }].concat(others.map((o) => ({ p: o, delta: 1 })));
          governorEnterRemodel(state, queue);
        } else return state;
        return state;
      }
      case 'GOVERNOR_REMODEL_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'governor_remodel' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (card == null) { governorEnterRemodel(state, pd.queue); return state; } // 廃棄しない
        if (p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card);
        state.trash.push(card);
        log(state, `${p.name} は「${C()[card].name}」を廃棄した（総督）。`);
        const exact = cardCost(state, card) + pd.delta;
        if (anyGainable(state, (id) => cardCost(state, id) === exact)) {
          state.pending = { type: 'governor_remodel', stage: 'gain', player: pd.player, exact, queue: pd.queue };
        } else {
          log(state, `ちょうど ${exact} コストのカードが無く、獲得できなかった（総督）。`);
          governorEnterRemodel(state, pd.queue);
        }
        return state;
      }
      case 'GOVERNOR_REMODEL_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'governor_remodel' || pd.stage !== 'gain') return state;
        const card = action.card;
        const canGain = (id) => !!C()[id] && cardCost(state, id) === pd.exact;
        if (card == null) { if (anyGainable(state, canGain)) return state; governorEnterRemodel(state, pd.queue); return state; }
        if (!canGain(card) || (state.supply[card] || 0) <= 0) return state;
        gain(state, pd.player, card, 'discard');
        log(state, `${state.players[pd.player].name} は「${C()[card].name}」を獲得した（総督）。`);
        governorEnterRemodel(state, pd.queue);
        return state;
      }

      /* ---- 取り壊し：廃棄→（$1以上なら）安いカード＋金貨を獲得 ---- */
      case 'DISMANTLE_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'dismantle' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card);
        state.trash.push(card);
        log(state, `${p.name} は「${C()[card].name}」を廃棄した（取り壊し）。`);
        const c = cardCost(state, card);
        if (c >= 1) {
          if (gain(state, pd.player, 'gold', 'discard')) log(state, `${p.name} は金貨を獲得した（取り壊し）。`);
          const maxCost = c - 1; // それより安い（cost < 廃棄カード）
          state.pending = anyGainable(state, (id) => cardCost(state, id) <= maxCost)
            ? { type: 'dismantle', stage: 'gain', player: pd.player, maxCost } : null;
        } else {
          state.pending = null;
        }
        return state;
      }
      case 'DISMANTLE_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'dismantle' || pd.stage !== 'gain') return state;
        finishGain(state, pd, action.card, (id) => !!C()[id] && cardCost(state, id) <= pd.maxCost, 'discard', '獲得した（取り壊し）。');
        return state;
      }

      /* ---- 闇市場：財宝を出してよい→公開3枚の1枚を購入してよい ---- */
      case 'BLACK_MARKET_PLAY_TREASURES': {
        const pd = state.pending;
        if (!pd || pd.type !== 'black_market' || pd.stage !== 'play') return state;
        const p = state.players[pd.player];
        const treasures = p.hand.filter((c) => DOM.isType(c, 'treasure'))
          .sort((a, b) => (a === 'silver' ? -1 : 0) - (b === 'silver' ? -1 : 0));
        treasures.forEach((card) => playTreasureCard(state, pd.player, card));
        if (treasures.length) log(state, `${p.name} は闇市場で財宝を出した。`);
        return state; // 同じ pending のまま（購入ステップへ）
      }
      case 'BLACK_MARKET_BUY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'black_market' || pd.stage !== 'play') return state;
        const card = action.card;
        if (pd.revealed.indexOf(card) < 0) return state;
        const cost = cardCost(state, card);
        if (cost > t.coins) return state; // 払えない
        t.coins -= cost; // 闇市場の購入は購入回数を消費しない
        state.players[pd.player].discard.push(card); // サプライ外のカードを獲得（捨て札へ）
        log(state, `${state.players[pd.player].name} は闇市場で「${C()[card].name}」を購入した。`);
        applyHoardOnBuy(state, pd.player, card);
        const rest = pd.revealed.filter((c) => c !== card);
        state.blackMarket = (state.blackMarket || []).concat(rest); // 残りは底へ
        state.pending = null;
        return state;
      }
      case 'BLACK_MARKET_SKIP': {
        const pd = state.pending;
        if (!pd || pd.type !== 'black_market' || pd.stage !== 'play') return state;
        state.blackMarket = (state.blackMarket || []).concat(pd.revealed); // 全部底へ
        log(state, `${state.players[pd.player].name} は闇市場で何も買わなかった。`);
        state.pending = null;
        return state;
      }

      /* ===== 拡張: 海辺（Seaside 第二版）の選択解決 ===== */
      case 'WAREHOUSE_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'warehouse') return state;
        const p = state.players[pd.player];
        const want = Math.min(3, p.hand.length);
        if (!discardFromHand(state, pd.player, action.cards, want, '捨てた（倉庫）。')) return state;
        state.pending = null;
        return state;
      }
      case 'HAVEN_SETASIDE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'haven') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card); p.setAside.push(card);
        armDuration(state, pd.player, 'haven', { stashed: card });
        log(state, `${p.name} は手札1枚を脇に置いた（停泊所）。`);
        state.pending = null;
        return state;
      }
      case 'TACTICIAN_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'tactician') return state;
        const p = state.players[pd.player];
        if (action.discard && p.hand.length > 0) {
          const n = p.hand.length;
          p.discard.push(...p.hand); p.hand = [];
          armDuration(state, pd.player, 'tactician');
          log(state, `${p.name} は手札${n}枚を全て捨てた（策士。次の手番に +5カード等）。`);
        } else {
          log(state, `${p.name} は策士で手札を捨てなかった（持続しない）。`);
        }
        state.pending = null;
        return state;
      }
      case 'SALVAGER_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'salvager' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (card == null) { state.pending = null; return state; } // 廃棄しない（手札があるが任意ではないが安全に）
        if (p.hand.indexOf(card) < 0) return state;
        const gainCoins = cardCost(state, card);
        removeOne(p.hand, card); state.trash.push(card);
        t.coins += gainCoins;
        log(state, `${p.name} は「${C()[card].name}」を廃棄し +${gainCoins}コイン（引揚水夫）。`);
        state.pending = null;
        return state;
      }
      case 'LOOKOUT_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'lookout' || pd.stage !== 'trash') return state;
        const card = action.card;
        if (pd.cards.indexOf(card) < 0) return state;
        const rest = pd.cards.slice(); removeOne(rest, card);
        state.trash.push(card);
        log(state, `${state.players[pd.player].name} は「${C()[card].name}」を廃棄した（見張り）。`);
        if (rest.length === 0) { state.pending = null; return state; }
        state.pending = { type: 'lookout', stage: 'discard', player: pd.player, cards: rest };
        return state;
      }
      case 'LOOKOUT_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'lookout' || pd.stage !== 'discard') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (pd.cards.indexOf(card) < 0) return state;
        const rest = pd.cards.slice(); removeOne(rest, card);
        p.discard.push(card);
        log(state, `${p.name} は「${C()[card].name}」を捨てた（見張り）。`);
        // 残りは山札の上へ（順序維持）
        for (let i = rest.length - 1; i >= 0; i--) p.deck.unshift(rest[i]);
        state.pending = null;
        return state;
      }
      case 'ISLAND_PICK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'island') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card); p.islandMat.push(card);
        log(state, `${p.name} は「${C()[card].name}」を島マットに置いた。`);
        state.pending = null;
        return state;
      }
      case 'NATIVE_VILLAGE_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'native_village') return state;
        const p = state.players[pd.player];
        if (action.mode === 'take') {
          if (p.nativeVillageMat.length) { p.hand.push(...p.nativeVillageMat); log(state, `${p.name} は原住民の村マットの ${p.nativeVillageMat.length}枚 を手札に加えた。`); p.nativeVillageMat = []; }
        } else { // 'set'：山札の上1枚を見ずにマットへ
          if (p.deck.length === 0 && p.discard.length > 0) { p.deck = shuffle(p.discard); p.discard = []; }
          if (p.deck.length > 0) { p.nativeVillageMat.push(p.deck.shift()); log(state, `${p.name} は山札の上1枚を原住民の村マットに置いた。`); }
        }
        state.pending = null;
        return state;
      }
      case 'TIDE_POOLS_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'tide_pools_discard') return state;
        const p = state.players[pd.player];
        const want = Math.min(2, p.hand.length);
        if (!discardFromHand(state, pd.player, action.cards, want, '捨てた（潮だまり）。')) return state;
        popStartQueue(state); // 開始時キューの次へ（無ければ通常の手番へ）
        return state;
      }
      case 'CUTPURSE_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'cutpurse' || pd.stage !== 'react') return state;
        cutpurseApply(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'SEA_WITCH_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'sea_witch' || pd.stage !== 'react') return state;
        seaWitchCurse(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'SEA_WITCH_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'sea_witch_discard') return state;
        const p = state.players[pd.player];
        const want = Math.min(2, p.hand.length);
        if (!discardFromHand(state, pd.player, action.cards, want, '捨てた（海の魔女）。')) return state;
        popStartQueue(state);
        return state;
      }
      case 'SMUGGLERS_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'smugglers') return state;
        const card = action.card;
        if ((pd.candidates || []).indexOf(card) < 0) return state;
        if ((state.supply[card] || 0) <= 0) { state.pending = null; return state; }
        gain(state, pd.player, card, 'discard');
        log(state, `${state.players[pd.player].name} は密輸人で「${C()[card].name}」を獲得した。`);
        state.pending = null;
        return state;
      }
      case 'BLOCKADE_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'blockade' || pd.stage !== 'gain') return state;
        const card = action.card;
        const canGain = (id) => !!C()[id] && cardCost(state, id) <= 4;
        if (card == null || !canGain(card) || (state.supply[card] || 0) <= 0) return state;
        state.supply[card] -= 1;
        state.players[pd.player].setAside.push(card); // 脇に置く（捨て札ではない）
        if (state.turn) (state.turn.gainedThisTurn || (state.turn.gainedThisTurn = [])).push(card);
        armDuration(state, pd.player, 'blockade', { gained: card, immune: [] });
        log(state, `${state.players[pd.player].name} は封鎖で「${C()[card].name}」を獲得し脇に置いた。`);
        // アタック：各相手に「堀で免疫」窓を出す（堀公開者はこの封鎖の呪いから免疫）。
        const bq = [];
        for (let k = 1; k < state.players.length; k++) bq.push((pd.player + k) % state.players.length);
        blockadeEnterVictim(state, pd.player, bq, card);
        return state;
      }
      case 'BLOCKADE_REACT': {
        // 封鎖のアタックを堀を出さずに受ける（免疫は付かず、次の被害者へ進む）。
        const pd = state.pending;
        if (!pd || pd.type !== 'blockade' || pd.stage !== 'react') return state;
        blockadeEnterVictim(state, pd.source, pd.queue, pd.gained);
        return state;
      }
      case 'PIRATE_REACT': {
        // 海賊のリアクション：手札の海賊を使う/使わない。使うと場に出して持続予約。
        const pd = state.pending;
        if (!pd || pd.type !== 'pirate_react') return state;
        const p = state.players[pd.player];
        if (action.play && removeOne(p.hand, 'pirate')) {
          p.inPlay.push('pirate');
          armDuration(state, pd.player, 'pirate');
          log(state, `${p.name} は海賊をリアクションで使った（次の手番に財宝を手札に獲得）。`);
        }
        pirateReactEnter(state, pd.queue);
        return state;
      }
      case 'SAILOR_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'sailor_trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (card != null && p.hand.indexOf(card) >= 0) {
          removeOne(p.hand, card); state.trash.push(card);
          log(state, `${p.name} は「${C()[card].name}」を廃棄した（船乗り）。`);
        }
        popStartQueue(state);
        return state;
      }
      case 'SAILOR_PLAY_GAIN': {
        // 船乗り：獲得した持続カードを即プレイする/しない。
        const pd = state.pending;
        if (!pd || pd.type !== 'sailor_play_gain') return state;
        const p = state.players[pd.player];
        state.pending = null; // 先に解除（プレイで新たな pending が立つ場合に上書きされないように）
        if (action.play) {
          const zone = pd.dest === 'deck' ? p.deck : (pd.dest === 'hand' ? p.hand : p.discard);
          if (removeOne(zone, pd.card)) {
            p.inPlay.push(pd.card); // 場へ。持続効果は applyEffect→armDuration で予約され、cleanup で durationCards へ移る
            log(state, `${p.name} は船乗りで獲得した「${C()[pd.card].name}」を使った。`);
            applyEffect(state, pd.card, pd.player);
          }
        }
        return state;
      }
      case 'PIRATE_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'pirate_gain') return state;
        const card = action.card;
        const canGain = (id) => DOM.isType(id, 'treasure') && cardCost(state, id) <= 6;
        if (card == null) { // 候補が無ければスキップ可
          if (anyGainable(state, canGain)) return state;
          popStartQueue(state); return state;
        }
        if (!canGain(card) || (state.supply[card] || 0) <= 0) return state;
        gain(state, pd.player, card, 'hand');
        log(state, `${state.players[pd.player].name} は海賊で「${C()[card].name}」を手札に獲得した。`);
        popStartQueue(state);
        return state;
      }

      /* ===== 拡張: 錬金術（Alchemy 第二版）の選択解決 ===== */
      /* ---- 変成：廃棄1枚→種類ごとに獲得 ---- */
      case 'TRANSMUTE_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'transmute') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card);
        trashOwn(state, pd.player, card);
        log(state, `${p.name} は「${C()[card].name}」を廃棄した（変成）。`);
        // 多重タイプは各該当ぶん獲得（例：大広間=アクション+勝利点→公領+金貨）。
        if (DOM.isType(card, 'action') && gain(state, pd.player, 'duchy', 'discard')) log(state, `${p.name} は公領を獲得した（変成）。`);
        if (DOM.isType(card, 'treasure') && gain(state, pd.player, 'transmute', 'discard')) log(state, `${p.name} は変成を獲得した（変成）。`);
        if (DOM.isType(card, 'victory') && gain(state, pd.player, 'gold', 'discard')) log(state, `${p.name} は金貨を獲得した（変成）。`);
        state.pending = null;
        return state;
      }
      /* ---- 薬剤師：残りを好きな順で山札の上に戻す ---- */
      case 'APOTHECARY_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'apothecary') return state;
        const p = state.players[pd.player];
        const order = Array.isArray(action.order) && action.order.length ? action.order : pd.cards.slice();
        // 検証：order が pd.cards の並べ替えであること（不正なら据え置き）
        const a = order.slice().sort(), b = pd.cards.slice().sort();
        if (a.length !== b.length || !a.every((x, i) => x === b[i])) return state;
        for (let i = order.length - 1; i >= 0; i--) p.deck.unshift(order[i]); // order[0] が一番上
        log(state, `${p.name} は残り ${order.length}枚 を山札の上に戻した（薬剤師）。`);
        state.pending = null;
        return state;
      }
      /* ---- 念視の泉：相手のリアクション／使用者が捨てるか戻すか ---- */
      case 'SCRYING_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'scrying_pool' || pd.stage !== 'react') return state;
        scryingReveal(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'SCRYING_DECIDE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'scrying_pool' || pd.stage !== 'decide') return state;
        const tp = state.players[pd.victim];
        if (action.discard && tp.deck.length > 0) {
          const c = tp.deck.shift(); tp.discard.push(c);
          log(state, `${tp.name} は山札の上の「${C()[c].name}」を捨てた（念視の泉）。`);
        } else {
          log(state, `${tp.name} は山札の上をそのままにした（念視の泉）。`);
        }
        scryingEnterTarget(state, pd.source, pd.queue);
        return state;
      }
      /* ---- 大学：コスト5以下のアクションを獲得（任意）---- */
      case 'UNIVERSITY_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'university') return state;
        if (action.card == null) { state.pending = null; return state; } // 獲得しない
        finishGain(state, pd, action.card, (id) => DOM.isType(id, 'action') && cardCost(state, id) <= 5 && potionCost(id) === 0, 'discard', '獲得した（大学）。');
        return state;
      }
      /* ---- 使い魔：呪いを受ける ---- */
      case 'FAMILIAR_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'familiar' || pd.stage !== 'react') return state;
        familiarCurse(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      /* ---- ゴーレム：見つけた2枚を使う順を選ぶ ---- */
      case 'GOLEM_ORDER': {
        const pd = state.pending;
        if (!pd || pd.type !== 'golem') return state;
        const first = action.first;
        const idx = pd.cards.indexOf(first);
        if (idx < 0) return state;
        const second = pd.cards[idx === 0 ? 1 : 0];
        golemPlay(state, pd.player, first, second);
        return state;
      }
      /* ---- 徒弟：廃棄1枚→コイン費用ぶん引く（ポーション費用ありは+2）---- */
      case 'APPRENTICE_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'apprentice') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (card == null || p.hand.indexOf(card) < 0) return state; // 手札があれば廃棄必須
        removeOne(p.hand, card);
        trashOwn(state, pd.player, card);
        const n = cardCost(state, card) + (potionCost(card) ? 2 : 0);
        draw(state, pd.player, n);
        log(state, `${p.name} は「${C()[card].name}」を廃棄して ${n}枚 引いた（徒弟）。`);
        state.pending = null;
        return state;
      }

      /* ===== 繁栄（Prosperity）の選択解決 ===== */
      case 'CHARLATAN_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'charlatan' || pd.stage !== 'react') return state;
        charlatanApply(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'RABBLE_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'rabble' || pd.stage !== 'react') return state;
        rabbleApply(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'CLERK_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'clerk' || pd.stage !== 'react') return state;
        clerkProceed(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'CLERK_TOPDECK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'clerk' || pd.stage !== 'topdeck') return state;
        const v = state.players[pd.victim];
        const card = action.card;
        if (v.hand.indexOf(card) < 0) return state;
        removeOne(v.hand, card); v.deck.unshift(card);
        log(state, `${v.name} は手札1枚を山札の上に置いた（会計士）。`);
        clerkEnterVictim(state, pd.source, pd.queue);
        return state;
      }
      case 'CLERK_START': {
        // 繁栄：会計士の手番開始時リアクション＝手札から（アクション消費せず）使う/使わない。
        const pd = state.pending;
        if (!pd || pd.type !== 'clerk_start') return state;
        const p = state.players[pd.player];
        if (action.play && p.hand.includes('clerk')) {
          removeOne(p.hand, 'clerk'); p.inPlay.push('clerk');
          t.actionsPlayed = (t.actionsPlayed || 0) + 1;
          log(state, `${p.name} は手番開始時に会計士を使った。`);
          applyEffect(state, 'clerk', pd.player); // +2コイン＋アタック
          // アタックの pending が立たなかった（相手不在/全員5枚未満）ときだけ開始キューを進める。
          // 立った場合は解決後に pending=null となり、そのまま手番（アクションフェイズ）へ進む。
          if (!state.pending) popStartQueue(state);
        } else {
          popStartQueue(state);
        }
        return state;
      }
      case 'BISHOP_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'bishop' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card); state.trash.push(card);
        const add = Math.floor(cardCost(state, card) / 2);
        if (add) p.vpTokens = (p.vpTokens || 0) + add;
        log(state, `${p.name} は「${C()[card].name}」を廃棄し +${add}勝利点（司教）。`);
        const others = [];
        for (let k = 1; k < state.players.length; k++) others.push((pd.player + k) % state.players.length);
        bishopOthersEnter(state, others);
        return state;
      }
      case 'BISHOP_OTHER': {
        const pd = state.pending;
        if (!pd || pd.type !== 'bishop' || pd.stage !== 'other') return state;
        const v = state.players[pd.player];
        const card = action.card; // null = 廃棄しない
        if (card != null) {
          if (v.hand.indexOf(card) < 0) return state;
          removeOne(v.hand, card); state.trash.push(card);
          log(state, `${v.name} は「${C()[card].name}」を廃棄した（司教）。`);
        }
        bishopOthersEnter(state, pd.queue);
        return state;
      }
      case 'VAULT_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'vault' || pd.stage !== 'discard') return state;
        const p = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        const copy = p.hand.slice();
        for (const c of cards) if (!removeOne(copy, c)) return state;
        cards.forEach((c) => { removeOne(p.hand, c); p.discard.push(c); });
        t.coins += cards.length;
        if (cards.length) log(state, `${p.name} は金庫室で ${cards.length}枚捨てて +${cards.length}コイン。`);
        const others = [];
        for (let k = 1; k < state.players.length; k++) others.push((pd.player + k) % state.players.length);
        vaultOthersEnter(state, others);
        return state;
      }
      case 'VAULT_OTHER': {
        const pd = state.pending;
        if (!pd || pd.type !== 'vault' || pd.stage !== 'other') return state;
        const v = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (cards.length === 2) {
          const copy = v.hand.slice();
          let okk = true;
          for (const c of cards) if (!removeOne(copy, c)) okk = false;
          if (okk) {
            cards.forEach((c) => { removeOne(v.hand, c); v.discard.push(c); });
            draw(state, pd.player, 1);
            log(state, `${v.name} は金庫室で2枚捨てて1枚引いた。`);
          }
        }
        vaultOthersEnter(state, pd.queue);
        return state;
      }
      case 'MINT_REVEAL': {
        const pd = state.pending;
        if (!pd || pd.type !== 'mint') return state;
        const p = state.players[pd.player];
        const card = action.card; // null = 公開しない
        if (card != null && p.hand.indexOf(card) >= 0 && DOM.isType(card, 'treasure')) {
          reveal(state, pd.player, [card], '造幣所：財宝を公開');
          if ((state.supply[card] || 0) > 0) { gain(state, pd.player, card, 'discard'); log(state, `${p.name} は造幣所で「${C()[card].name}」を獲得した。`); }
        }
        state.pending = null;
        return state;
      }
      case 'EXPAND_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'expand' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card); state.trash.push(card);
        const maxCost = cardCost(state, card) + 3;
        log(state, `${p.name} は「${C()[card].name}」を廃棄した（拡張）。`);
        if (anyGainable(state, (id) => cardCost(state, id) <= maxCost)) state.pending = { type: 'expand', stage: 'gain', player: pd.player, maxCost };
        else state.pending = null;
        return state;
      }
      case 'EXPAND_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'expand' || pd.stage !== 'gain') return state;
        const card = action.card;
        if (!C()[card] || cardCost(state, card) > pd.maxCost || (state.supply[card] || 0) <= 0) return state;
        gain(state, pd.player, card, 'discard');
        log(state, `${state.players[pd.player].name} は「${C()[card].name}」を獲得した（拡張）。`);
        state.pending = null;
        return state;
      }
      case 'FORGE_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'forge' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        const copy = p.hand.slice();
        for (const c of cards) if (!removeOne(copy, c)) return state;
        let total = 0;
        cards.forEach((c) => { total += cardCost(state, c); });
        cards.forEach((c) => { removeOne(p.hand, c); state.trash.push(c); });
        log(state, `${p.name} は溶鉱炉で ${cards.length}枚を廃棄（合計$${total}）。`);
        if (anyGainable(state, (id) => cardCost(state, id) === total)) state.pending = { type: 'forge', stage: 'gain', player: pd.player, exact: total };
        else { log(state, `${p.name} はちょうど$${total}のカードが無く、何も獲得しなかった（溶鉱炉）。`); state.pending = null; }
        return state;
      }
      case 'FORGE_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'forge' || pd.stage !== 'gain') return state;
        const card = action.card;
        if (!C()[card] || cardCost(state, card) !== pd.exact || (state.supply[card] || 0) <= 0) return state;
        gain(state, pd.player, card, 'discard');
        log(state, `${state.players[pd.player].name} は「${C()[card].name}」を獲得した（溶鉱炉）。`);
        state.pending = null;
        return state;
      }
      case 'KINGS_COURT_CHOOSE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'kings_court') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0 || !DOM.isType(card, 'action')) return state;
        removeOne(p.hand, card); p.inPlay.push(card);
        t.actionsPlayed = (t.actionsPlayed || 0) + 1;
        state.pending = null;
        log(state, `${p.name} は王の宮廷で「${C()[card].name}」を使った（1回目）。`);
        applyEffect(state, card, pd.player); // 1回目
        state.replay = state.replay || [];
        state.replay.push({ player: pd.player, card }); // 2回目
        state.replay.push({ player: pd.player, card }); // 3回目（runReplays が pending 解消ごとに消化）
        return state;
      }
      case 'WAR_CHEST_NAME': {
        const pd = state.pending;
        if (!pd || pd.type !== 'war_chest' || pd.stage !== 'name') return state;
        const card = action.card;
        if (!C()[card]) return state;
        t.warChestNamed = t.warChestNamed || [];
        t.warChestNamed.push(card);
        log(state, `${state.players[pd.player].name} は軍用金で「${C()[card].name}」を指定した。`);
        const named = t.warChestNamed;
        if (anyGainable(state, (id) => cardCost(state, id) <= 5 && named.indexOf(id) < 0)) state.pending = { type: 'war_chest', stage: 'gain', player: pd.source, source: pd.source };
        else state.pending = null;
        return state;
      }
      case 'WAR_CHEST_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'war_chest' || pd.stage !== 'gain') return state;
        const card = action.card;
        const named = t.warChestNamed || [];
        if (!C()[card] || cardCost(state, card) > 5 || named.indexOf(card) >= 0 || (state.supply[card] || 0) <= 0) return state;
        gain(state, pd.player, card, 'discard');
        log(state, `${state.players[pd.player].name} は軍用金で「${C()[card].name}」を獲得した。`);
        state.pending = null;
        return state;
      }
      case 'WATCHTOWER': {
        const pd = state.pending;
        if (!pd || pd.type !== 'watchtower') return state;
        const p = state.players[pd.player];
        const choice = action.choice; // 'trash' | 'topdeck' | 'keep'
        const zone = pd.dest === 'deck' ? p.deck : (pd.dest === 'hand' ? p.hand : p.discard);
        if (choice === 'trash') { if (removeOne(zone, pd.card)) { state.trash.push(pd.card); log(state, `${p.name} は物見やぐらで「${C()[pd.card].name}」を廃棄した。`); } }
        else if (choice === 'topdeck') { if (removeOne(zone, pd.card)) { p.deck.unshift(pd.card); log(state, `${p.name} は物見やぐらで「${C()[pd.card].name}」を山札の上に置いた。`); } }
        state.pending = null;
        return state;
      }
      case 'TIARA_TOPDECK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'tiara_topdeck') return state;
        const p = state.players[pd.player];
        if (action.topdeck) {
          const zone = pd.dest === 'deck' ? p.deck : (pd.dest === 'hand' ? p.hand : p.discard);
          if (removeOne(zone, pd.card)) { p.deck.unshift(pd.card); log(state, `${p.name} はティアラで「${C()[pd.card].name}」を山札の上に置いた。`); }
        }
        state.pending = null;
        return state;
      }
      case 'TIARA_PLAY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'tiara_play') return state;
        const p = state.players[pd.player];
        const card = action.card; // null = しない
        state.pending = null;
        if (card != null && p.hand.indexOf(card) >= 0 && DOM.isType(card, 'treasure')) {
          playTreasureCard(state, pd.player, card); // 1回目（移動＋効果。ペテン師+堀などで pending が立つことがある）
          // 2回目のコインは反応待ちに関係なく確定で入る（pending の有無で取りこぼさない）。
          const add = treasureReplayCoins(state, pd.player, card);
          log(state, `${p.name} はティアラで「${C()[card].name}」をもう一度使った（+${add}コイン）。`);
        }
        return state;
      }
      case 'ANVIL_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'anvil' || pd.stage !== 'discard') return state;
        const p = state.players[pd.player];
        const card = action.card; // null = しない
        if (card == null) { state.pending = null; return state; }
        if (p.hand.indexOf(card) < 0 || !DOM.isType(card, 'treasure')) return state;
        removeOne(p.hand, card); p.discard.push(card);
        log(state, `${p.name} は金床で「${C()[card].name}」を捨てた。`);
        if (anyGainable(state, (id) => cardCost(state, id) <= 4)) state.pending = { type: 'anvil', stage: 'gain', player: pd.player };
        else state.pending = null;
        return state;
      }
      case 'ANVIL_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'anvil' || pd.stage !== 'gain') return state;
        const card = action.card;
        if (!C()[card] || cardCost(state, card) > 4 || (state.supply[card] || 0) <= 0) return state;
        gain(state, pd.player, card, 'discard');
        log(state, `${state.players[pd.player].name} は金床で「${C()[card].name}」を獲得した。`);
        state.pending = null;
        return state;
      }
      case 'INVESTMENT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'investment' || pd.stage) return state;
        const p = state.players[pd.player];
        if (action.choice === 'vp' && p.hand.some((c) => DOM.isType(c, 'treasure'))) {
          state.pending = { type: 'investment', stage: 'trash', player: pd.player };
        } else {
          t.coins += 1; log(state, `${p.name} は投資で +1コイン。`);
          state.pending = null;
        }
        return state;
      }
      case 'INVESTMENT_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'investment' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0 || !DOM.isType(card, 'treasure')) return state;
        removeOne(p.hand, card); state.trash.push(card);
        const add = new Set(p.inPlay.filter((c) => DOM.isType(c, 'treasure'))).size;
        if (add) p.vpTokens = (p.vpTokens || 0) + add;
        log(state, `${p.name} は投資で「${C()[card].name}」を廃棄し +${add}勝利点（場の財宝${add}種）。`);
        state.pending = null;
        return state;
      }
      case 'CRYSTAL_BALL': {
        const pd = state.pending;
        if (!pd || pd.type !== 'crystal_ball') return state;
        const p = state.players[pd.player];
        const top = p.deck[0];
        const choice = action.choice; // 'trash' | 'discard' | 'play' | 'keep'
        if (top !== pd.card) { state.pending = null; return state; } // 山札が変わっていたら何もしない
        state.pending = null;
        if (choice === 'trash') { p.deck.shift(); state.trash.push(top); log(state, `${p.name} は水晶玉で「${C()[top].name}」を廃棄した。`); }
        else if (choice === 'discard') { p.deck.shift(); p.discard.push(top); log(state, `${p.name} は水晶玉で「${C()[top].name}」を捨てた。`); }
        else if (choice === 'play' && (DOM.isType(top, 'action') || DOM.isType(top, 'treasure'))) {
          p.deck.shift(); p.inPlay.push(top);
          if (DOM.isType(top, 'treasure')) { t.coins += treasureCoins(state, top); log(state, `${p.name} は水晶玉で「${C()[top].name}」を使った（+${treasureCoins(state, top)}コイン）。`); }
          else { t.actionsPlayed = (t.actionsPlayed || 0) + 1; log(state, `${p.name} は水晶玉で「${C()[top].name}」を使った。`); applyEffect(state, top, pd.player); }
        }
        return state;
      }

      default:
        return state;
    }
  }

  /* ---------- 視点別マスク（サーバ→各クライアント配信用） ----------
     seat 番のプレイヤーから見て、自分の手札・山札・捨て札は見えるが、
     他人の手札・山札・捨て札は中身を伏せる（枚数だけ保つ）。場(inPlay)・廃棄・サプライは公開。
     捨て札も伏せるのは、クリーンアップ直後は捨て札の末尾＝相手が使わなかった手札そのもので、
     配信JSONを覗けば事後的に手札が分かってしまうため（公式でも捨て札の中身は確認不可）。
     技術的にも覗けないよう、配列の中身を 'back' に置換して配信する。 */
  function maskStateFor(state, seat) {
    const s = clone(state);
    s.players = s.players.map((p, i) => {
      if (i === seat) return p; // 自分は全部見える
      // 錬金術・支配：支配者は被支配者（手番のactive）の手札を見て操作する（山札は伏せたまま）。
      const revealHand = state.turn && state.turn.possessedBy === seat && i === state.turn.active;
      // 海辺：脇置き(setAside)・原住民の村マットは秘密＝枚数だけ。島マット・持続カードは公開（公式どおり）。
      // delayedEffects（次手番の予約）は種別は見せるが、隠し札id（停泊所の脇置き・封鎖の獲得物）は伏せる。
      const maskedDelayed = (p.delayedEffects || []).map((e) => {
        const c = Object.assign({}, e);
        delete c.stashed; delete c.setAsideCard; delete c.gained; delete c.pirateTarget;
        return c;
      });
      return Object.assign({}, p, {
        deck: new Array(p.deck.length).fill('back'),
        hand: revealHand ? p.hand.slice() : new Array(p.hand.length).fill('back'),
        discard: new Array(p.discard.length).fill('back'),
        setAside: new Array((p.setAside || []).length).fill('back'),
        nativeVillageMat: new Array((p.nativeVillageMat || []).length).fill('back'),
        delayedEffects: maskedDelayed,
        // inPlay / durationCards / islandMat は場に表向き＝そのまま
      });
    });
    // 闇市場デッキは伏せ札。中身は誰にも見えないよう枚数だけ残す（公開された3枚は pending.revealed 側に出る）。
    if (Array.isArray(s.blackMarket)) s.blackMarket = new Array(s.blackMarket.length).fill('back');
    // 仮面舞踏会のパスは「同時・秘密」。逐次解決中の picks(他席が渡したカード)を
    // 後手席に配信すると情報優位になるため、自分の選択分以外は伏せる。
    if (s.pending && s.pending.type === 'masquerade' && s.pending.stage === 'pass' && s.pending.picks) {
      const masked = {};
      if (s.pending.picks[seat] != null) masked[seat] = s.pending.picks[seat];
      s.pending = Object.assign({}, s.pending, { picks: masked });
    }
    // 衛兵・見張りで「見た」山札の上の数枚は本人だけの秘密情報。相手席への配信では中身を伏せる（枚数は残す）。
    if (s.pending && (s.pending.type === 'sentry' || s.pending.type === 'lookout') && Array.isArray(s.pending.cards) && seat !== s.pending.player) {
      s.pending = Object.assign({}, s.pending, { cards: new Array(s.pending.cards.length).fill('back') });
    }
    s.you = seat;
    return s;
  }

  /* ---------- プレイヤーが送れるアクション種別（唯一の正本）----------
     reduce() が処理する action.type のうち、対戦中にプレイヤー/CPUが送るもの（NEW_GAME を除く）。
     サーバ(server/gameServer.js)はこれを唯一の許可リストとして使う＝二重管理しない。
     新しい選択ステップ（*_RESOLVE 等）を reduce に足したら、ここにも必ず追加すること。
     test/integrity.test.js が「reduce の switch case と完全一致」を自動検証するので、
     追加漏れ・綴り違いはテストで即わかる（オンラインだけ壊れる事故を防ぐ）。 */
  const PLAYER_ACTIONS = new Set([
    'PLAY_ACTION', 'PLAY_TREASURE', 'PLAY_ALL_TREASURES', 'BUY', 'END_ACTION_PHASE', 'END_TURN',
    'CELLAR_RESOLVE', 'MILITIA_RESOLVE', 'MOAT_REVEAL',
    'MINE_TRASH', 'MINE_GAIN', 'REMODEL_TRASH', 'REMODEL_GAIN', 'WORKSHOP_GAIN',
    'COURTYARD_PUT', 'PAWN_RESOLVE', 'STEWARD_RESOLVE', 'STEWARD_TRASH',
    'WISHING_RESOLVE', 'BARON_RESOLVE', 'IRONWORKS_GAIN',
    'MINING_VILLAGE_RESOLVE', 'NOBLES_RESOLVE', 'TORTURER_RESOLVE',
    'TRADING_POST_RESOLVE', 'UPGRADE_TRASH', 'UPGRADE_GAIN', 'SCOUT_RESOLVE',
    'SWINDLER_REACT', 'SWINDLER_GAIN', 'SABOTEUR_REACT', 'SABOTEUR_GAIN',
    'MINION_RESOLVE', 'MINION_ATTACK_REACT', 'MASQUERADE_PASS', 'MASQUERADE_TRASH',
    'SECRET_CHAMBER_RESOLVE', 'SECRET_CHAMBER_REVEAL', 'SECRET_CHAMBER_PUTBACK',
    'MONEYLENDER_RESOLVE', 'CHANCELLOR_RESOLVE', 'CHAPEL_RESOLVE',
    'WITCH_REACT', 'BUREAUCRAT_REACT', 'BUREAUCRAT_PUT', 'FEAST_GAIN',
    'LIBRARY_RESOLVE', 'SPY_REACT', 'SPY_DECIDE', 'THIEF_REACT', 'THIEF_PICK', 'THIEF_GAIN',
    'THRONE_CHOOSE',
    // 基本 第二版
    'HARBINGER_PUT', 'VASSAL_PLAY', 'POACHER_DISCARD', 'BANDIT_REACT', 'BANDIT_PICK',
    'SENTRY_RESOLVE', 'ARTISAN_GAIN', 'ARTISAN_PUT',
    // 陰謀 第二版
    'COURTIER_REVEAL', 'COURTIER_CHOOSE', 'DIPLOMAT_REVEAL', 'DIPLOMAT_DISCARD',
    'LURKER_CHOOSE', 'LURKER_TRASH', 'LURKER_GAIN', 'MILL_RESOLVE', 'PATROL_RESOLVE',
    'REPLACE_TRASH', 'REPLACE_GAIN', 'REPLACE_REACT', 'SECRET_PASSAGE_PICK', 'SECRET_PASSAGE_PLACE',
    // プロモ
    'ENVOY_PICK', 'GOVERNOR_CHOOSE', 'GOVERNOR_REMODEL_TRASH', 'GOVERNOR_REMODEL_GAIN',
    'DISMANTLE_TRASH', 'DISMANTLE_GAIN', 'BLACK_MARKET_PLAY_TREASURES', 'BLACK_MARKET_BUY', 'BLACK_MARKET_SKIP',
    // 海辺（第二版）
    'WAREHOUSE_DISCARD', 'HAVEN_SETASIDE', 'TACTICIAN_RESOLVE', 'SALVAGER_TRASH',
    'LOOKOUT_TRASH', 'LOOKOUT_DISCARD', 'ISLAND_PICK', 'NATIVE_VILLAGE_RESOLVE', 'TIDE_POOLS_DISCARD',
    'CUTPURSE_REACT', 'SEA_WITCH_REACT', 'SEA_WITCH_DISCARD', 'SMUGGLERS_GAIN', 'BLOCKADE_GAIN', 'BLOCKADE_REACT',
    'SAILOR_TRASH', 'SAILOR_PLAY_GAIN', 'PIRATE_GAIN', 'PIRATE_REACT',
    // 錬金術（第二版）
    'TRANSMUTE_TRASH', 'APOTHECARY_RESOLVE', 'SCRYING_REACT', 'SCRYING_DECIDE',
    'UNIVERSITY_GAIN', 'FAMILIAR_REACT', 'GOLEM_ORDER', 'APPRENTICE_TRASH',
    // 繁栄（第二版）
    'CHARLATAN_REACT', 'RABBLE_REACT', 'CLERK_REACT', 'CLERK_TOPDECK', 'CLERK_START',
    'BISHOP_TRASH', 'BISHOP_OTHER', 'VAULT_DISCARD', 'VAULT_OTHER', 'MINT_REVEAL',
    'EXPAND_TRASH', 'EXPAND_GAIN', 'FORGE_TRASH', 'FORGE_GAIN', 'KINGS_COURT_CHOOSE',
    'WAR_CHEST_NAME', 'WAR_CHEST_GAIN', 'WATCHTOWER', 'TIARA_TOPDECK', 'TIARA_PLAY',
    'ANVIL_DISCARD', 'ANVIL_GAIN', 'INVESTMENT', 'INVESTMENT_TRASH', 'CRYSTAL_BALL',
  ]);

  /* ---------- 公開API ---------- */
  DOM.engine = {
    createInitialState,
    reduce,
    cardCost,
    vpOf,
    scoreGame,
    isGameOver,
    emptyPileCount,
    canBuyCard,
    maskStateFor,
    PLAYER_ACTIONS,
    // 「誰が今操作すべきか」: 選択待ちならその人、なければ手番のプレイヤー
    // 「誰が今操作すべきか」。支配中は、被支配者(active)自身の決定を支配者が代行する。
    // 他プレイヤーのリアクション（pending.player が active 以外）は本人が行う。
    actor: (state) => {
      const t = state.turn;
      if (state.pending) {
        if (t && t.possessedBy != null && state.pending.player === t.active) return t.possessedBy;
        return state.pending.player;
      }
      if (t && t.possessedBy != null) return t.possessedBy;
      return t.active;
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DOM;
})();
