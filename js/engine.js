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
    const base = (C()[id] && C()[id].cost) || 0;
    const red = (state.turn && state.turn.costReduction) || 0;
    return Math.max(0, base - red);
  }
  // 財宝1枚を出したときのコイン。銅細工師の「このターン銅貨+1」(t.copperBonus)を銅貨にだけ加算。
  // PLAY_TREASURE と PLAY_ALL_TREASURES の両方でこれを使い、計算を二重実装しない。
  function treasureCoins(state, id) {
    const base = (C()[id] && C()[id].coin) || 0;
    if (id === 'copper') return base + ((state.turn && state.turn.copperBonus) || 0);
    return base;
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

  /* ---------- サプライ初期化 ---------- */
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
    kingdom.forEach((k) => (supply[k] = 10));
    return supply;
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
      };
    });

    // 開始プレイヤー（公式: ランダム）。範囲外は席0に丸める。
    let startActive = 0;
    if (opts.startActive === 'random') startActive = Math.floor(Math.random() * players.length);
    else if (Number.isInteger(opts.startActive) && opts.startActive >= 0 && opts.startActive < players.length)
      startActive = opts.startActive;

    return {
      version: 0,
      kingdom,
      players,
      supply: initSupply(players.length, kingdom),
      trash: [],
      turn: { active: startActive, phase: 'action', actions: 1, buys: 1, coins: 0, costReduction: 0, actionsPlayed: 0, copperBonus: 0 },
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
    state.supply[cardId] -= 1;
    const p = state.players[pIndex];
    if (dest === 'hand') p.hand.push(cardId);
    else if (dest === 'deck') p.deck.unshift(cardId);
    else p.discard.push(cardId);
    return true;
  }

  // 条件に合う獲得可能なカードがサプライに1枚でもあるか
  function anyGainable(state, predicate) {
    return Object.keys(state.supply).some(
      (id) => (state.supply[id] || 0) > 0 && predicate(id)
    );
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
    const victim = queue[0];
    const rest = queue.slice(1);
    if (state.players[victim].hand.includes('moat')) {
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
    const victim = queue[0], rest = queue.slice(1);
    if (state.players[victim].hand.includes('moat')) {
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
    const victim = queue[0], rest = queue.slice(1);
    if (state.players[victim].hand.includes('moat')) {
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
          if (state.players[idx].hand.length > 3) others.push(idx);
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
          gain(state, pi, 'estate', 'discard');
          log(state, `${p.name} は屋敷を獲得した。`);
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
        // 他の全プレイヤーが対象（手番順）
        const to = [];
        for (let k = 1; k < state.players.length; k++) to.push((pi + k) % state.players.length);
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
    return [].concat(p.deck, p.hand, p.discard, p.inPlay);
  }
  function vpOf(p) {
    const cards = allCards(p);
    let vp = cards.reduce((sum, c) => sum + (C()[c].vp || 0), 0);
    // 公爵：所持する公領1枚につき1勝利点
    const dukes = cards.filter((c) => c === 'duke').length;
    if (dukes) vp += dukes * cards.filter((c) => c === 'duchy').length;
    return vp;
  }
  function scoreGame(state) {
    const scores = state.players.map((p) => {
      // 勝敗画面用の内訳（例: {province:2, duchy:1, estate:3, curse:1}）。
      // マスク配信後はクライアントから再計算できないため、ここで確定して持たせる。
      const vpCards = {};
      allCards(p).forEach((c) => { if (DOM.isType(c, 'victory') || DOM.isType(c, 'curse')) vpCards[c] = (vpCards[c] || 0) + 1; });
      return { name: p.name, vp: vpOf(p), turns: p.turns, vpCards };
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

  /* ---------- クリーンアップ＆次の番へ ---------- */
  function cleanupAndAdvance(state) {
    const pi = state.turn.active;
    const p = state.players[pi];
    p.discard.push(...p.inPlay, ...p.hand);
    p.inPlay = [];
    p.hand = [];
    draw(state, pi, 5);
    p.turns += 1;

    if (isGameOver(state)) {
      state.gameOver = true;
      state.result = scoreGame(state);
      log(state, `ゲーム終了：${state.result.reason}。`);
      return;
    }
    const next = (pi + 1) % state.players.length;
    state.turn = { active: next, phase: 'action', actions: 1, buys: 1, coins: 0, costReduction: 0, actionsPlayed: 0, copperBonus: 0 };
    log(state, `${state.players[next].name} の番です。`);
  }

  /* ============================================================
     reduce: 状態 + 操作 -> 新しい状態
     ============================================================ */
  function reduce(state, action) {
    state = clone(state);
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
        removeOne(me.hand, card);
        me.inPlay.push(card);
        t.coins += treasureCoins(state, card);
        return state;
      }
      case 'PLAY_ALL_TREASURES': {
        if (state.pending) return state;
        if (t.phase !== 'buy') return state;
        const treasures = me.hand.filter((c) => DOM.isType(c, 'treasure'));
        treasures.forEach((card) => {
          removeOne(me.hand, card);
          me.inPlay.push(card);
          t.coins += treasureCoins(state, card);
        });
        if (treasures.length) log(state, `${me.name} は財宝を全て出した。`);
        return state;
      }

      /* ---- カードを買う ---- */
      case 'BUY': {
        if (state.pending) return state;
        if (t.phase !== 'buy') return state;
        const card = action.card;
        if (!C()[card]) return state; // 未知のカードIDは状態不変で拒否（throwしない）
        const cost = cardCost(state, card); // 「橋」等のコスト軽減を反映
        if ((state.supply[card] || 0) <= 0) return state;
        if (t.buys <= 0) return state;
        if (cost > t.coins) return state;
        t.coins -= cost;
        t.buys -= 1;
        gain(state, pi, card, 'discard');
        log(state, `${me.name} は「${C()[card].name}」を購入した。`);
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
        const reactable = (pd.type === 'militia') || (pd.type === 'torturer') ||
          ((pd.type === 'swindler' || pd.type === 'saboteur' || pd.type === 'minion_attack') && pd.stage === 'react');
        if (!reactable) return state;
        log(state, `${p.name} は「堀」を公開し、アタックを無効化した。`);
        if (pd.type === 'militia') advanceMilitia(state, pd);
        else if (pd.type === 'torturer') advanceAttack(state, pd);
        else if (pd.type === 'swindler') swindlerEnterVictim(state, pd.source, pd.queue);
        else if (pd.type === 'saboteur') saboteurEnterVictim(state, pd.source, pd.queue);
        else if (pd.type === 'minion_attack') minionAttackEnterVictim(state, pd.source, pd.queue);
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
        const card = action.card;
        const canGain = (id) => DOM.isType(id, 'treasure') && cardCost(state, id) <= pd.maxCost;
        if (card == null) {
          // 獲得は強制（公式ルール）。獲得できる財宝が残っていない場合のみ辞退できる。
          if (anyGainable(state, canGain)) return state;
          state.pending = null; return state;
        }
        if (!canGain(card)) return state;
        if ((state.supply[card] || 0) <= 0) return state;
        gain(state, pd.player, card, 'hand');
        log(state, `${state.players[pd.player].name} は「${C()[card].name}」を手札に獲得した。`);
        state.pending = null;
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
        const card = action.card;
        const canGain = (id) => !!C()[id] && cardCost(state, id) <= pd.maxCost;
        if (card == null) {
          // 獲得は強制（公式ルール）。獲得できるカードが無い場合のみ辞退できる。
          if (anyGainable(state, canGain)) return state;
          state.pending = null; return state;
        }
        if (!canGain(card)) return state;
        if ((state.supply[card] || 0) <= 0) return state;
        gain(state, pd.player, card, 'discard');
        log(state, `${state.players[pd.player].name} は「${C()[card].name}」を獲得した。`);
        state.pending = null;
        return state;
      }

      /* ---- 工房 ---- */
      case 'WORKSHOP_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'workshop') return state;
        const card = action.card;
        const canGain = (id) => !!C()[id] && cardCost(state, id) <= 4;
        if (card == null) {
          // 獲得は強制（公式ルール）。獲得できるカードが無い場合のみ辞退できる。
          if (anyGainable(state, canGain)) return state;
          state.pending = null; return state;
        }
        if (!canGain(card)) return state;
        if ((state.supply[card] || 0) <= 0) return state;
        gain(state, pd.player, card, 'discard');
        log(state, `${state.players[pd.player].name} は「${C()[card].name}」を獲得した。`);
        state.pending = null;
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
        const p = state.players[pd.player];
        const want = Math.min(2, p.hand.length);
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (cards.length !== want) return state;
        const handCopy = p.hand.slice();
        for (const c of cards) if (!removeOne(handCopy, c)) return state;
        cards.forEach((c) => { removeOne(p.hand, c); state.trash.push(c); });
        log(state, `${p.name} は手札 ${cards.length}枚 を廃棄した。`);
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
          gain(state, pd.player, 'estate', 'discard');
          log(state, `${p.name} は屋敷を獲得した。`);
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
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (cards.length !== want) return state;
        const handCopy = p.hand.slice();
        for (const c of cards) if (!removeOne(handCopy, c)) return state;
        cards.forEach((c) => { removeOne(p.hand, c); state.trash.push(c); });
        log(state, `${p.name} は手札 ${cards.length}枚 を廃棄した。`);
        // 2枚廃棄できたときだけ銀貨を手札に獲得（公式: trash 2 → gain Silver to hand）
        if (cards.length === 2 && gain(state, pd.player, 'silver', 'hand')) {
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
        const card = action.card;
        const canGain = (id) => !!C()[id] && cardCost(state, id) === pd.exactCost;
        if (card == null) {
          if (anyGainable(state, canGain)) return state; // 候補があるなら獲得は強制
          state.pending = null; return state;
        }
        if (!canGain(card) || (state.supply[card] || 0) <= 0) return state;
        gain(state, pd.player, card, 'discard');
        log(state, `${state.players[pd.player].name} は「${C()[card].name}」を獲得した。`);
        state.pending = null;
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
      return Object.assign({}, p, {
        deck: new Array(p.deck.length).fill('back'),
        hand: new Array(p.hand.length).fill('back'),
        discard: new Array(p.discard.length).fill('back'),
        // inPlay は場に表向きで出ているカードなのでそのまま
      });
    });
    s.you = seat;
    return s;
  }

  /* ---------- 公開API ---------- */
  DOM.engine = {
    createInitialState,
    reduce,
    cardCost,
    vpOf,
    scoreGame,
    isGameOver,
    emptyPileCount,
    maskStateFor,
    // 「誰が今操作すべきか」: 選択待ちならその人、なければ手番のプレイヤー
    actor: (state) => (state.pending ? state.pending.player : state.turn.active),
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DOM;
})();
