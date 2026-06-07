/* ============================================================
   CPU 思考ルーチン（弱 / 普通 / 強）
   decide(state) は「今操作すべきプレイヤー(=CPU)」の次の1手を返す。
   常に合法かつ局面を前進させる手を返すので、繰り返し適用すると必ずターンが進む。
   ============================================================ */
(function () {
  const root = (typeof window !== 'undefined') ? window
    : (typeof global !== 'undefined') ? global : globalThis;
  const DOM = (root.DOM = root.DOM || {});
  const C = () => DOM.CARDS;
  const isType = (id, t) => DOM.isType(id, t);
  const isTreasure = (id) => isType(id, 'treasure');
  const isDead = (id) => isType(id, 'victory') || isType(id, 'curse'); // 手札では死蔵

  function allCards(p) { return [].concat(p.deck, p.hand, p.discard, p.inPlay); }
  function owned(p, id) { return allCards(p).filter((c) => c === id).length; }
  function sup(state, id) { return state.supply[id] || 0; }

  /* 手札に残す価値（民兵で捨てる順を決める。低いほど先に捨てる） */
  function keepValue(id) {
    if (isType(id, 'curse')) return 0;
    if (isType(id, 'victory')) return 1;     // 勝利点は手札では不要（捨てても得点は失わない）
    if (id === 'copper') return 40;
    if (id === 'silver') return 90;
    if (id === 'gold') return 100;
    if (isType(id, 'action')) return 60;
    return 50;
  }

  /* 獲得したいカードの優先順（高いほど良い） */
  const GAIN_ORDER = ['province', 'gold', 'duchy', 'market', 'mine', 'silver',
    'smithy', 'militia', 'remodel', 'village', 'woodcutter', 'workshop',
    'moat', 'cellar', 'estate', 'copper', 'curse'];
  function bestGain(state, maxCost, opts) {
    opts = opts || {};
    for (const id of GAIN_ORDER) {
      if (opts.treasureOnly && !isTreasure(id)) continue;
      if (opts.noVictory && (isType(id, 'victory') || isType(id, 'curse'))) continue;
      if (C()[id].cost <= maxCost && sup(state, id) > 0) return id;
    }
    return null;
  }

  /* ---------- アクションフェーズ：使うカードを選ぶ ---------- */
  function chooseAction(state, p) {
    const t = state.turn;
    if (t.actions <= 0) return null;
    const has = (id) => p.hand.includes(id);
    const dead = p.hand.some((c) => isDead(c));
    // +アクションが付くカード（連鎖できる）を最優先
    if (has('village')) return 'village';
    if (has('market')) return 'market';
    if (has('cellar') && dead) return 'cellar';
    // 効果の大きいターミナル
    if (has('smithy')) return 'smithy';
    if (has('militia')) return 'militia';
    if (has('mine') && p.hand.some((c) => isTreasure(c))) return 'mine';
    if (has('remodel')) return 'remodel';
    if (has('workshop')) return 'workshop';
    if (has('woodcutter')) return 'woodcutter';
    if (has('cellar') && dead) return 'cellar';
    return null;
  }

  /* ---------- 購入フェーズ：買うカードを選ぶ（難易度別） ---------- */
  function kingdomAffordable(state, coins) {
    return (state.kingdom || []).filter((id) => C()[id].cost <= coins && sup(state, id) > 0);
  }

  function chooseBuyStrong(state, p, coins) {
    const province = sup(state, 'province');
    if (coins >= 8 && province > 0) return 'province';
    if (province <= 4 && coins >= 5 && sup(state, 'duchy') > 0) return 'duchy';
    if (province <= 2 && coins >= 2 && sup(state, 'estate') > 0) return 'estate';
    if (coins >= 6 && sup(state, 'gold') > 0) return 'gold';
    if (coins >= 4 && sup(state, 'smithy') > 0 && owned(p, 'smithy') < 1) return 'smithy';
    if (coins >= 3 && sup(state, 'silver') > 0) return 'silver';
    return null;
  }

  function chooseBuyNormal(state, p, coins) {
    const province = sup(state, 'province');
    if (coins >= 8 && province > 0) return 'province';
    if (coins >= 6 && sup(state, 'gold') > 0) return 'gold';
    if (province <= 3 && coins >= 5 && sup(state, 'duchy') > 0) return 'duchy';
    if (coins >= 5 && sup(state, 'market') > 0 && owned(p, 'market') < 1) return 'market';
    if (coins >= 4 && sup(state, 'smithy') > 0 && owned(p, 'smithy') < 1) return 'smithy';
    if (coins >= 3 && sup(state, 'silver') > 0) return 'silver';
    return null;
  }

  // 弱：勝利点を早く買いすぎ・財宝が薄く・気まぐれ（人間が勝ちやすい）
  function chooseBuyWeak(state, p, coins) {
    const r = Math.random();
    if (coins >= 8 && sup(state, 'province') > 0 && r < 0.7) return 'province';
    if (coins >= 5 && sup(state, 'duchy') > 0 && r < 0.45) return 'duchy';   // 早すぎる公領
    if (coins >= 2 && sup(state, 'estate') > 0 && r < 0.3) return 'estate';  // 屋敷でデッキを濁す
    if (coins >= 6 && sup(state, 'gold') > 0 && r < 0.7) return 'gold';
    const aff = kingdomAffordable(state, coins);
    if (aff.length && r < 0.5) return aff[Math.floor(Math.random() * aff.length)];
    if (coins >= 3 && sup(state, 'silver') > 0) return 'silver';
    return null;
  }

  function chooseBuy(state, p, level) {
    if (state.turn.buys <= 0) return null;
    const coins = state.turn.coins;
    let pick = null;
    if (level === 'hard') pick = chooseBuyStrong(state, p, coins);
    else if (level === 'easy') pick = chooseBuyWeak(state, p, coins);
    else pick = chooseBuyNormal(state, p, coins);
    // 念のため：買えない手は返さない
    if (pick && C()[pick].cost <= coins && sup(state, pick) > 0) return pick;
    return null;
  }

  /* ---------- 選択待ちの解決 ---------- */
  function pickDiscards(hand, need) {
    const sorted = hand.map((c, i) => ({ c, i, v: keepValue(c) })).sort((a, b) => a.v - b.v);
    return sorted.slice(0, need).map((x) => x.c);
  }
  function lowestValueCard(hand) {
    let best = hand[0];
    let bv = keepValue(best);
    for (const c of hand) { const v = keepValue(c); if (v < bv) { bv = v; best = c; } }
    return best;
  }

  function decidePending(state, pd, p) {
    switch (pd.type) {
      case 'cellar':
        return { type: 'CELLAR_RESOLVE', cards: p.hand.filter((c) => isDead(c)) };
      case 'militia': {
        if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' };
        const need = p.hand.length - 3;
        return { type: 'MILITIA_RESOLVE', cards: pickDiscards(p.hand, need) };
      }
      case 'mine':
        if (pd.stage === 'trash') {
          if (p.hand.includes('silver') && sup(state, 'gold') > 0) return { type: 'MINE_TRASH', card: 'silver' };
          if (p.hand.includes('copper') && sup(state, 'silver') > 0) return { type: 'MINE_TRASH', card: 'copper' };
          return { type: 'MINE_TRASH', card: null };
        }
        return { type: 'MINE_GAIN', card: bestGain(state, pd.maxCost, { treasureOnly: true }) };
      case 'remodel':
        if (pd.stage === 'trash') {
          if (p.hand.includes('curse')) return { type: 'REMODEL_TRASH', card: 'curse' };
          if (sup(state, 'province') > 0 && sup(state, 'province') <= 4 && p.hand.includes('gold'))
            return { type: 'REMODEL_TRASH', card: 'gold' };
          if (p.hand.includes('estate')) return { type: 'REMODEL_TRASH', card: 'estate' };
          return { type: 'REMODEL_TRASH', card: lowestValueCard(p.hand) };
        }
        return { type: 'REMODEL_GAIN', card: bestGain(state, pd.maxCost) };
      case 'workshop':
        return { type: 'WORKSHOP_GAIN', card: bestGain(state, 4, { noVictory: true }) || bestGain(state, 4) };
      default:
        return { type: 'END_TURN' };
    }
  }

  /* ---------- 公開API ---------- */
  function decide(state) {
    const seat = DOM.engine.actor(state);
    const p = state.players[seat];
    if (state.pending && state.pending.player === seat) {
      return decidePending(state, state.pending, p);
    }
    const t = state.turn;
    if (t.phase === 'action') {
      const a = chooseAction(state, p);
      return a ? { type: 'PLAY_ACTION', card: a } : { type: 'END_ACTION_PHASE' };
    }
    // 購入フェーズ
    if (p.hand.some((c) => isTreasure(c))) return { type: 'PLAY_ALL_TREASURES' };
    const b = chooseBuy(state, p, p.cpuLevel || 'normal');
    return b ? { type: 'BUY', card: b } : { type: 'END_TURN' };
  }

  // この手の後にどれくらい「間」を置くか（ミリ秒）— 見て分かるように
  function delayFor(action) {
    switch (action.type) {
      case 'PLAY_ALL_TREASURES': return 650;
      case 'END_ACTION_PHASE': return 450;
      case 'END_TURN': return 700;
      case 'BUY': return 950;
      case 'PLAY_ACTION': return 900;
      default: return 800; // 選択解決
    }
  }

  DOM.cpu = { decide, delayFor };

  if (typeof module !== 'undefined' && module.exports) module.exports = DOM;
})();
