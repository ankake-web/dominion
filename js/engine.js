/* ============================================================
   ドミニオン 基本セット - ゲームエンジン（純粋ロジック）
   状態は JSON シリアライズ可能（Firebase 同期のため）。
   reduce(state, action) -> newState という形で状態遷移する。
   ============================================================ */
(function () {
  const DOM = (window.DOM = window.DOM || {});

  const clone = (s) => JSON.parse(JSON.stringify(s));
  const C = () => DOM.CARDS;

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
     playerConfigs: 文字列(名前)または {name, isCpu, level} の配列（2〜4人） */
  function createInitialState(playerConfigs, kingdom) {
    kingdom = kingdom || DOM.KINGDOM;
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

    return {
      version: 0,
      kingdom,
      players,
      supply: initSupply(players.length, kingdom),
      trash: [],
      turn: { active: 0, phase: 'action', actions: 1, buys: 1, coins: 0 },
      pending: null, // 選択待ち {type, player, ...}
      log: [`ゲーム開始。${players[0].name} の番です。`],
      gameOver: false,
      result: null,
    };
  }

  /* ---------- ログ ---------- */
  function log(state, msg) {
    state.log.push(msg);
    if (state.log.length > 60) state.log = state.log.slice(-60);
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
        if (anyGainable(state, (id) => C()[id].cost <= 4))
          state.pending = { type: 'workshop', stage: 'gain', player: pi };
        break;
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
    return allCards(p).reduce((sum, c) => sum + (C()[c].vp || 0), 0);
  }
  function scoreGame(state) {
    const scores = state.players.map((p) => ({
      name: p.name,
      vp: vpOf(p),
      turns: p.turns,
    }));
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
    state.turn = { active: next, phase: 'action', actions: 1, buys: 1, coins: 0 };
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
        return createInitialState(action.players, action.kingdom);

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
        t.coins += C()[card].coin;
        return state;
      }
      case 'PLAY_ALL_TREASURES': {
        if (state.pending) return state;
        if (t.phase !== 'buy') return state;
        const treasures = me.hand.filter((c) => DOM.isType(c, 'treasure'));
        treasures.forEach((card) => {
          removeOne(me.hand, card);
          me.inPlay.push(card);
          t.coins += C()[card].coin;
        });
        if (treasures.length) log(state, `${me.name} は財宝を全て出した。`);
        return state;
      }

      /* ---- カードを買う ---- */
      case 'BUY': {
        if (state.pending) return state;
        if (t.phase !== 'buy') return state;
        const card = action.card;
        const cost = C()[card].cost;
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
        const discardCards = action.cards || [];
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
        const discardCards = action.cards || [];
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
        if (!pd || pd.type !== 'militia') return state;
        const p = state.players[pd.player];
        if (p.hand.indexOf('moat') < 0) return state;
        log(state, `${p.name} は「堀」を公開し、アタックを無効化した。`);
        advanceMilitia(state, pd);
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
        const mMax = C()[card].cost + 3;
        // 獲得できる財宝が無ければ選択待ちにせず終了（デッドロック回避）
        state.pending = anyGainable(state, (id) => DOM.isType(id, 'treasure') && C()[id].cost <= mMax)
          ? { type: 'mine', stage: 'gain', player: pd.player, maxCost: mMax }
          : null;
        return state;
      }
      case 'MINE_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'mine' || pd.stage !== 'gain') return state;
        const card = action.card;
        if (card == null) { state.pending = null; return state; } // 獲得しない
        if (!DOM.isType(card, 'treasure')) return state;
        if (C()[card].cost > pd.maxCost) return state;
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
        const rMax = C()[card].cost + 2;
        // 獲得できるカードが無ければ選択待ちにせず終了（デッドロック回避）
        state.pending = anyGainable(state, (id) => C()[id].cost <= rMax)
          ? { type: 'remodel', stage: 'gain', player: pd.player, maxCost: rMax }
          : null;
        return state;
      }
      case 'REMODEL_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'remodel' || pd.stage !== 'gain') return state;
        const card = action.card;
        if (card == null) { state.pending = null; return state; } // 獲得しない
        if (C()[card].cost > pd.maxCost) return state;
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
        if (card == null) { state.pending = null; return state; } // 獲得しない
        if (C()[card].cost > 4) return state;
        if ((state.supply[card] || 0) <= 0) return state;
        gain(state, pd.player, card, 'discard');
        log(state, `${state.players[pd.player].name} は「${C()[card].name}」を獲得した。`);
        state.pending = null;
        return state;
      }

      default:
        return state;
    }
  }

  /* ---------- 公開API ---------- */
  DOM.engine = {
    createInitialState,
    reduce,
    vpOf,
    scoreGame,
    isGameOver,
    emptyPileCount,
    // 「誰が今操作すべきか」: 選択待ちならその人、なければ手番のプレイヤー
    actor: (state) => (state.pending ? state.pending.player : state.turn.active),
  };
})();
