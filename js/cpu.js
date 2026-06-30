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

  function allCards(p) { return [].concat(p.deck, p.hand, p.discard, p.inPlay, p.durationCards || [], p.setAside || [], p.islandMat || [], p.nativeVillageMat || []); }
  function owned(p, id) { return allCards(p).filter((c) => c === id).length; }
  function sup(state, id) { return state.supply[id] || 0; }
  // 実コスト（「橋」等の軽減を反映）
  function cost(state, id) {
    if (DOM.engine && DOM.engine.cardCost) return DOM.engine.cardCost(state, id);
    return Math.max(0, C()[id].cost - ((state.turn && state.turn.costReduction) || 0));
  }

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

  /* 獲得したいカードの優先順（高いほど良い）。基本＋拡張(陰謀)の全王国カードを網羅。 */
  const GAIN_ORDER = ['province', 'gold', 'artisan', 'nobles', 'harem', 'duchy',
    'adventurer', 'laboratory', 'festival', 'witch', 'bandit', 'governor', 'council_room', 'patrol', 'library', 'market', 'minion', 'mine', 'sentry', 'courtier', 'replace', 'ironworks', 'bridge', 'conspirator', 'torturer', 'swindler', 'saboteur', 'spy', 'thief', 'upgrade', 'bureaucrat', 'feast', 'silver',
    'poacher', 'mining_village', 'smithy', 'mill', 'walled_village', 'dismantle', 'envoy', 'secret_passage', 'diplomat', 'courtyard', 'masquerade', 'throne_room', 'great_hall', 'tribute', 'militia', 'steward', 'trading_post', 'baron', 'scout',
    'remodel', 'moneylender', 'merchant', 'harbinger', 'vassal', 'village', 'shanty_town', 'wishing_well', 'woodcutter', 'workshop', 'coppersmith', 'chancellor', 'black_market', 'hoard',
    // 海辺（第二版）＝強さ/コストの目安順。CPUの購入優先度（サプライにある時だけ効く）。
    'wharf', 'sea_witch', 'bazaar', 'corsair', 'blockade', 'treasury', 'island', 'merchant_ship', 'fishing_village',
    'tactician', 'caravan', 'monkey', 'warehouse', 'salvager', 'cutpurse', 'sailor', 'outpost', 'lighthouse',
    'tide_pools', 'lookout', 'sea_chart', 'smugglers', 'native_village', 'haven', 'astrolabe', 'pirate', 'treasure_map',
    // 錬金術13種＝カード画像用カタログ。孤立プールで実サプライに出ないため並び順はCPU挙動に無影響
    //（整合性テストの「GAIN_ORDER=全カード」を満たすためだけ）。
    'potion', 'transmute', 'vineyard', 'herbalist', 'apothecary', 'scrying_pool', 'university',
    'alchemist', 'familiar', 'philosophers_stone', 'golem', 'apprentice', 'possession',
    'pawn', 'lurker', 'moat', 'secret_chamber', 'chapel', 'cellar', 'gardens', 'estate', 'duke', 'copper', 'curse'];
  function bestGain(state, maxCost, opts) {
    opts = opts || {};
    for (const id of GAIN_ORDER) {
      if (opts.treasureOnly && !isTreasure(id)) continue;
      if (opts.noVictory && (isType(id, 'victory') || isType(id, 'curse'))) continue;
      if (!C()[id]) continue;
      if (cost(state, id) <= maxCost && sup(state, id) > 0) return id;
    }
    return null;
  }
  // ちょうど exact コストの最善獲得（改良など）。GAIN_ORDER に無いカードも最後に拾い、
  // 候補があるのに null を返して engine の「強制獲得」と噛み合いCPUが無限ループするのを防ぐ。
  function bestGainExact(state, exact, opts) {
    opts = opts || {};
    for (const id of GAIN_ORDER) {
      if (opts.noVictory && (isType(id, 'victory') || isType(id, 'curse'))) continue;
      if (!C()[id]) continue;
      if (cost(state, id) === exact && sup(state, id) > 0) return id;
    }
    for (const id of Object.keys(state.supply)) {
      if (opts.noVictory && (isType(id, 'victory') || isType(id, 'curse'))) continue;
      if (C()[id] && cost(state, id) === exact && sup(state, id) > 0) return id;
    }
    return null;
  }

  /* ---------- アクションフェーズ：使うカードを選ぶ ---------- */
  function chooseAction(state, p) {
    const t = state.turn;
    if (t.actions <= 0) return null;
    const has = (id) => p.hand.includes(id);
    const dead = p.hand.some((c) => isDead(c));
    // --- 非ターミナル（+アクションが付く＝連鎖できる）を最優先 ---
    if (has('village')) return 'village';
    if (has('mining_village')) return 'mining_village';
    if (has('festival')) return 'festival';        // +2アクション+1購入+2コイン
    if (has('laboratory')) return 'laboratory';    // +2カード+1アクション
    if (has('market')) return 'market';
    if (has('wishing_well')) return 'wishing_well';
    if (has('shanty_town')) return 'shanty_town';
    if (has('great_hall')) return 'great_hall';    // +1カード+1アクションのキャントリップ（消費0）
    if (has('scout')) return 'scout';              // +1アクションのキャントリップ
    if (has('spy')) return 'spy';                  // +1カード+1アクション＋偵察
    if (has('minion')) return 'minion';            // +1アクション。選択で+2コイン/引き直し
    if (has('nobles')) return 'nobles';            // 状況により +2アクションも選べる
    // 第二版/プロモの非ターミナル（+アクションが付く＝連鎖できる）
    if (has('walled_village')) return 'walled_village'; // +1カード+2アクション（村）
    if (has('merchant')) return 'merchant';        // +1カード+1アクション（最初の銀貨で+1）
    if (has('harbinger')) return 'harbinger';      // +1カード+1アクション
    if (has('poacher')) return 'poacher';          // +1カード+1アクション+1コイン
    if (has('sentry')) return 'sentry';            // +1カード+1アクション（山札整理）
    if (has('mill')) return 'mill';                // +1カード+1アクション（任意で+2コイン）
    if (has('secret_passage')) return 'secret_passage'; // +2カード+1アクション
    if (has('lurker')) return 'lurker';            // +1アクション
    if (has('governor')) return 'governor';        // +1アクション（全員効果）
    if (has('cellar') && dead) return 'cellar';
    // 海辺：非ターミナル（+アクション付き）
    if (has('fishing_village')) return 'fishing_village'; // +2アクション+1コイン（持続）
    if (has('bazaar')) return 'bazaar';                   // +1カード+2アクション+1コイン
    if (has('native_village')) return 'native_village';   // +2アクション
    if (has('caravan')) return 'caravan';                 // +1カード+1アクション（持続）
    if (has('lighthouse')) return 'lighthouse';           // +1アクション+1コイン（持続・免疫）
    if (has('sea_chart')) return 'sea_chart';             // +1カード+1アクション
    if (has('warehouse')) return 'warehouse';             // +3カード+1アクション→3枚捨て
    if (has('tide_pools')) return 'tide_pools';           // +3カード+1アクション（次手番2捨て）
    if (has('haven')) return 'haven';                     // +1カード+1アクション（脇置き）
    // --- ターミナル（効果の大きい順）---
    if (has('wharf')) return 'wharf';                     // 2ターン +2カード+1購入
    if (has('sea_witch')) return 'sea_witch';             // +2カード＋全員に呪い
    if (has('merchant_ship')) return 'merchant_ship';     // 2ターン +2コイン
    if (has('corsair')) return 'corsair';                 // +2コイン＋相手の銀/金を廃棄
    if (has('blockade')) return 'blockade';               // 獲得＋呪い配布
    if (has('cutpurse')) return 'cutpurse';               // +2コイン＋相手の銅貨捨て
    if (has('lookout')) return 'lookout';                 // 山札整理
    if (has('monkey')) return 'monkey';                   // 相手獲得ごとに+カード
    if (has('island')) return 'island';                   // 勝利点退避
    if (has('outpost') && !t.isExtraTurn) return 'outpost'; // 追加ターン（連鎖不可）
    if (has('smugglers')) return 'smugglers';             // 右隣の獲得を真似る
    if (has('salvager') && p.hand.length > 1) return 'salvager'; // 廃棄→コイン
    if (has('treasure_map') && p.hand.filter((c) => c === 'treasure_map').length >= 2) return 'treasure_map'; // 2枚揃いで金貨4枚
    if (has('tactician')) { const hc = p.hand.reduce((s, c) => s + (isTreasure(c) ? (C()[c].coin || 0) : 0), 0); if (hc <= 3 && p.hand.length > 1) return 'tactician'; }
    // 玉座の間: 2回使える別アクションが手札にあるときだけ（無駄打ち回避）
    if (has('throne_room') && p.hand.some((c) => isType(c, 'action') && c !== 'throne_room')) return 'throne_room';
    if (has('council_room')) return 'council_room'; // +4カード+1購入
    if (has('library')) return 'library';           // 手札7枚まで
    if (has('adventurer')) return 'adventurer';     // 財宝2枚を手札へ
    if (has('smithy')) return 'smithy';
    if (has('thief')) return 'thief';               // 相手の財宝を奪う
    if (has('courtyard')) return 'courtyard';
    if (has('witch')) return 'witch';              // +2カード＋全員に呪い（強力）
    if (has('bandit')) return 'bandit';            // 金貨獲得＋相手の財宝を廃棄
    if (has('diplomat')) return 'diplomat';        // +2カード（手札次第で+2アクション）
    if (has('patrol')) return 'patrol';            // +3カード＋勝利点回収
    if (has('artisan')) return 'artisan';          // コスト5を手札に獲得
    if (has('courtier')) return 'courtier';        // 公開カードの種類数だけ効果
    if (has('replace')) return 'replace';          // 廃棄→格上げ（勝利点なら呪い配布）
    if (has('torturer')) return 'torturer';
    if (has('swindler')) return 'swindler';
    if (has('saboteur')) return 'saboteur';
    if (has('militia')) return 'militia';
    if (has('bureaucrat')) return 'bureaucrat';
    if (has('conspirator')) return 'conspirator';
    if (has('masquerade')) return 'masquerade'; // +2カード＋廃棄＋呪い押し付け
    if (has('bridge')) return 'bridge';
    if (has('steward')) return 'steward';
    if (has('baron')) return 'baron';
    if (has('ironworks')) return 'ironworks';
    if (has('moat')) return 'moat'; // +2ドロー。リアクションは公開制のため温存する理由が無い
    if (has('upgrade')) return 'upgrade';          // 廃棄→格上げ。手札が空でも+1カード+1アクションで損なし
    if (has('tribute')) return 'tribute';          // 左隣の山札次第でボーナス（ターミナル）
    // 交易場: 不要札(呪い/屋敷/銅貨/公爵)が2枚以上あるときだけ（良い札を捨てない）
    if (has('trading_post') && p.hand.filter((c) => trashValue(c) < 10).length >= 2) return 'trading_post';
    // 銅細工師: 手札に銅貨が2枚以上あるときだけ価値がある（ターミナルなので無駄打ち回避）
    if (has('coppersmith') && p.hand.filter((c) => c === 'copper').length >= 2) return 'coppersmith';
    if (has('mine') && p.hand.some((c) => isTreasure(c))) return 'mine';
    if (has('moneylender') && p.hand.includes('copper')) return 'moneylender'; // 銅貨→+3
    if (has('chapel') && pickChapelTrash(p).length > 0) return 'chapel';       // 圧縮対象があるとき
    if (has('chancellor')) return 'chancellor';                                // +2コイン
    if (has('feast')) return 'feast';                                          // 自身を廃棄→$5獲得
    if (has('envoy')) return 'envoy';              // 上5枚を公開して大量ドロー
    if (has('dismantle')) return 'dismantle';      // 廃棄→安いカード＋金貨
    if (has('remodel')) return 'remodel';
    if (has('vassal')) return 'vassal';            // +2コイン（山札の上がアクションなら使う）
    if (has('black_market')) return 'black_market'; // +2コイン＋闇市場
    if (has('workshop')) return 'workshop';
    if (has('woodcutter')) return 'woodcutter';
    if (has('pawn')) return 'pawn';
    // 秘密の小部屋: 手札に死に札(勝利点/呪い)があればコインに変える
    if (has('secret_chamber') && p.hand.some((c) => isDead(c))) return 'secret_chamber';
    return null;
  }

  /* ---------- 購入フェーズ：買うカードを選ぶ（難易度別） ---------- */
  function kingdomAffordable(state, coins) {
    return (state.kingdom || []).filter((id) => C()[id].cost <= coins && sup(state, id) > 0);
  }

  /* ---------- 終局認識（強CPU用） ----------
     「この1枚を買うとゲームが終わるか」「終わった場合に自分が勝つか」を判定する。
     これが無いと、負け確定でも最後の属州を買って自滅したり（不自然な介錯）、
     大差リード中に山切れで勝ち確で閉じられる手を逃したりする。 */
  // engine.vpOf と同等（公爵=公領数、庭園=デッキ10枚毎に1点 の変動得点も加算）。
  // これが無いと hard CPU の終局判定が庭園/公爵を 0 点と誤算し、勝ち/負けの読みを誤る。
  function vpOfPlayer(p) {
    const cards = allCards(p);
    let vp = cards.reduce((sum, c) => sum + (C()[c].vp || 0), 0);
    const dukes = cards.filter((c) => c === 'duke').length;
    if (dukes) vp += dukes * cards.filter((c) => c === 'duchy').length;
    const gardens = cards.filter((c) => c === 'gardens').length;
    if (gardens) vp += gardens * Math.floor(cards.length / 10);
    return vp;
  }
  function buyEndsGame(state, id) {
    const after = (k) => (state.supply[k] || 0) - (k === id ? 1 : 0);
    if (after('province') <= 0) return true;
    let empty = 0;
    Object.keys(state.supply).forEach((k) => { if (after(k) <= 0) empty++; });
    return empty >= 3;
  }
  // seat が id を獲得して即終了した場合に勝てる（同点の共同勝利を含む）か
  function winsIfEnds(state, seat, id) {
    // 獲得する1枚を加えた仮デッキで再計算（庭園のデッキ増・公爵の動的得点も反映）
    const me = state.players[seat];
    const hypo = { deck: allCards(me).concat(id), hand: [], discard: [], inPlay: [] };
    const myVp = vpOfPlayer(hypo);
    const myTurns = me.turns + 1; // 今のターンはクリーンアップで+1される
    return state.players.every((p, i) => {
      if (i === seat) return true;
      const v = vpOfPlayer(p);
      if (v > myVp) return false;
      if (v === myVp && p.turns < myTurns) return false;
      return true;
    });
  }

  function chooseBuyStrong(state, p, coins) {
    const seat = state.turn.active;
    // 1) 勝って終われる購入があれば最優先（得点→コストの高い順）
    let winningEnd = null, bestKey = -Infinity;
    Object.keys(state.supply).forEach((id) => {
      if (sup(state, id) <= 0 || C()[id].cost > coins) return;
      if (!buyEndsGame(state, id) || !winsIfEnds(state, seat, id)) return;
      const key = (C()[id].vp || 0) * 100 + C()[id].cost;
      if (key > bestKey) { bestKey = key; winningEnd = id; }
    });
    if (winningEnd) return winningEnd;

    const province = sup(state, 'province');
    let pick = null;
    if (coins >= 8 && province > 0) pick = 'province';
    else if (province <= 4 && coins >= 5 && sup(state, 'duchy') > 0) pick = 'duchy';
    else if (province <= 2 && coins >= 2 && sup(state, 'estate') > 0) pick = 'estate';
    else if (coins >= 6 && sup(state, 'gold') > 0) pick = 'gold';
    else if (coins >= 4 && sup(state, 'smithy') > 0 && owned(p, 'smithy') < 1) pick = 'smithy';
    else if (coins >= 3 && sup(state, 'silver') > 0) pick = 'silver';

    // 2) 負けて終わる購入は避ける（ゲームを閉じない次善手か、何も買わない）
    if (pick && buyEndsGame(state, pick) && !winsIfEnds(state, seat, pick)) {
      pick = ['gold', 'silver'].find((id) => coins >= C()[id].cost && sup(state, id) > 0 && !buyEndsGame(state, id)) || null;
    }
    return pick;
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
    const real = state.turn.coins;
    // 「橋」等の軽減は“使える額が増える”のと等価なので、判断はその換算額で行う
    const coins = real + ((state.turn.costReduction) || 0);
    let pick = null;
    if (level === 'hard') pick = chooseBuyStrong(state, p, coins);
    else if (level === 'easy') pick = chooseBuyWeak(state, p, coins);
    else pick = chooseBuyNormal(state, p, coins);
    // 念のため：買えない手は返さない（実コストで判定）
    if (pick && cost(state, pick) <= real && sup(state, pick) > 0) return pick;
    return null;
  }

  /* ---------- 選択待ちの解決 ---------- */
  function pickDiscards(hand, need) {
    const sorted = hand.map((c, i) => ({ c, i, v: keepValue(c) })).sort((a, b) => a.v - b.v);
    return sorted.slice(0, need).map((x) => x.c);
  }

  /* 廃棄に回す価値（低いほど先に廃棄）。執事の廃棄2枚で属州・金貨を捨てないように。 */
  function trashValue(id) {
    if (isType(id, 'curse')) return 0;
    if (id === 'estate') return 1;
    if (id === 'copper') return 2;
    if (id === 'duke') return 3;
    if (isType(id, 'victory')) return 100; // 属州/公領/貴族/後宮などは廃棄しない
    if (id === 'gold') return 95;
    if (id === 'silver') return 80;
    return 50;                              // アクション類
  }
  function pickTrash(hand, n) {
    return hand.map((c) => ({ c, v: trashValue(c) })).sort((a, b) => a.v - b.v).slice(0, n).map((x) => x.c);
  }
  // 礼拝堂で廃棄する札（最大4枚）: 呪い→屋敷→余剰銅貨（2枚は残す）。デッキ圧縮。
  function pickChapelTrash(p) {
    const out = [];
    p.hand.forEach((c) => { if (c === 'curse' && out.length < 4) out.push(c); });
    p.hand.forEach((c) => { if (c === 'estate' && out.length < 4) out.push(c); });
    const coppers = p.hand.filter((c) => c === 'copper').length;
    for (let i = 2; i < coppers && out.length < 4; i++) out.push('copper');
    return out;
  }
  // 詐欺師で相手に与えるカード（相手の利得が最小＝呪い→弱い財宝/アクション。勝利点は点を与えるので避ける）。
  function pickSwindlerGift(state, cst) {
    const cands = Object.keys(state.supply).filter((id) => C()[id] && cost(state, id) === cst && sup(state, id) > 0);
    if (!cands.length) return null;
    const harm = (id) => isType(id, 'curse') ? -1 : (isType(id, 'victory') ? 100 : keepValue(id));
    cands.sort((a, b) => harm(a) - harm(b));
    return cands[0];
  }
  /* 願いの井戸で宣言するカード（山札の上にありそうなもの＝手元で最も多い種類） */
  function mostLikelyTop(p) {
    const pool = [].concat(p.deck, p.discard);
    if (!pool.length) return 'copper';
    const cnt = {}; pool.forEach((c) => { cnt[c] = (cnt[c] || 0) + 1; });
    return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
  }

  /* 改築で廃棄するカードを選ぶ。
     keepValue は「民兵で捨てる」用（捨てても失点しない＝勝利点が最安）なので流用しない。
     廃棄は得点を失うため、公領/属州は他に何も無いときの最後の手段にする。 */
  function pickRemodelTrash(state, p) {
    if (p.hand.includes('curse')) return 'curse';
    // 終盤は金貨→属州の格上げが強い
    if (sup(state, 'province') > 0 && sup(state, 'province') <= 4 && p.hand.includes('gold')) return 'gold';
    if (p.hand.includes('estate')) return 'estate';
    if (p.hand.includes('copper')) return 'copper';
    // 安いアクションから1段上のカードへ
    const actions = p.hand.filter((c) => isType(c, 'action')).sort((a, b) => C()[a].cost - C()[b].cost);
    if (actions.length) return actions[0];
    if (p.hand.includes('silver')) return 'silver';
    if (p.hand.includes('gold')) return 'gold';
    if (p.hand.includes('duchy')) return 'duchy'; // 勝利点しか無い場合のみ
    return p.hand[0];
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
        if (pd.stage === 'trash') return { type: 'REMODEL_TRASH', card: pickRemodelTrash(state, p) };
        return { type: 'REMODEL_GAIN', card: bestGain(state, pd.maxCost) };
      case 'workshop':
        return { type: 'WORKSHOP_GAIN', card: bestGain(state, 4, { noVictory: true }) || bestGain(state, 4) };

      /* ===== 拡張: 陰謀 ===== */
      case 'courtyard': {
        // 山札の上に置く＝次に引く。手札で最も価値の低い（捨ててよい）カードを置いて手札を軽くする
        const order = p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b));
        return { type: 'COURTYARD_PUT', card: order[0] };
      }
      case 'pawn':
        // 「+1カード ＆ +1アクション」＝実質キャントリップで無難
        return { type: 'PAWN_RESOLVE', choices: ['card', 'action'] };
      case 'steward':
        if (pd.stage === 'trash') {
          return { type: 'STEWARD_TRASH', cards: pickTrash(p.hand, Math.min(2, p.hand.length)) };
        }
        // 廃棄したい不要札(呪い/屋敷)が2枚以上あれば廃棄、無ければ+2コイン
        if (p.hand.filter((c) => isType(c, 'curse') || c === 'estate').length >= 2)
          return { type: 'STEWARD_RESOLVE', choice: 'trash' };
        return { type: 'STEWARD_RESOLVE', choice: 'coins' };
      case 'wishing':
        return { type: 'WISHING_RESOLVE', card: mostLikelyTop(p) };
      case 'baron':
        // 屋敷があれば捨てて+4コインが得（屋敷は手札で死蔵）
        return { type: 'BARON_RESOLVE', discard: p.hand.includes('estate') };
      case 'ironworks':
        return { type: 'IRONWORKS_GAIN', card: bestGain(state, 4, { noVictory: true }) || bestGain(state, 4) };
      case 'mining_village':
        // 基本は廃棄せず村として使い回す
        return { type: 'MINING_VILLAGE_RESOLVE', trash: false };
      case 'nobles': {
        // 他にアクションが手札にあれば +2アクション、無ければ +3カード
        const otherAction = p.hand.some((c) => isType(c, 'action'));
        return { type: 'NOBLES_RESOLVE', choice: otherAction ? 'actions' : 'cards' };
      }
      case 'torturer': {
        // 拷問人の対象側。堀があれば無効化、無ければ呪いより手札2枚捨てを選ぶ
        if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' };
        return { type: 'TORTURER_RESOLVE', choice: 'discard', cards: pickDiscards(p.hand, Math.min(2, p.hand.length)) };
      }
      case 'scout':
        // 順序は戦術的に重要でないため公開順のまま戻す
        return { type: 'SCOUT_RESOLVE', order: pd.cards.slice() };
      case 'swindler':
        if (pd.stage === 'react') {
          // 犠牲者側。react ステージは堀持ちのときだけ作られるので無効化する
          if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' };
          return { type: 'SWINDLER_REACT' };
        }
        // gain ステージ（攻撃側）。相手の利得が最小のカードを与える（候補ありなら必ず非null）
        return { type: 'SWINDLER_GAIN', card: pickSwindlerGift(state, pd.cost) };
      case 'saboteur':
        if (pd.stage === 'react') {
          if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' };
          return { type: 'SABOTEUR_REACT' };
        }
        // gain ステージ（犠牲者・任意）。上限内で最善を拾う。無ければ獲得しない(null)
        return { type: 'SABOTEUR_GAIN', card: bestGain(state, pd.maxCost, { noVictory: true }) || bestGain(state, pd.maxCost) };
      case 'minion':
        // 攻撃側の選択。手札に他のアクションがあれば捨てたくない→+2コイン。
        // 手札が弱い(財宝が乏しい)なら引き直し（相手も妨害）。
        if (p.hand.some((c) => isType(c, 'action'))) return { type: 'MINION_RESOLVE', choice: 'coins' };
        {
          const handCoin = p.hand.reduce((sum, c) => sum + (isTreasure(c) ? (C()[c].coin || 0) : 0), 0);
          return { type: 'MINION_RESOLVE', choice: handCoin >= 4 ? 'coins' : 'attack' };
        }
      case 'minion_attack':
        // 犠牲者側。堀があれば無効化、無ければそのまま受ける
        if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' };
        return { type: 'MINION_ATTACK_REACT' };
      case 'masquerade':
        if (pd.stage === 'pass') {
          // 最も不要なカード（呪い/屋敷/銅貨）を左隣へ押し付ける
          return { type: 'MASQUERADE_PASS', card: pickTrash(p.hand, 1)[0] };
        }
        { // trash: 不要札があれば廃棄、無ければしない
          const junk = p.hand.find((c) => isType(c, 'curse') || c === 'estate' || c === 'copper');
          return { type: 'MASQUERADE_TRASH', card: junk || null };
        }
      case 'feast':
        return { type: 'FEAST_GAIN', card: bestGain(state, 5, { noVictory: true }) || bestGain(state, 5) };
      case 'throne': {
        // 2回使う価値が高いアクション（玉座以外で最も高コスト）を選ぶ
        const acts = p.hand.filter((c) => isType(c, 'action') && c !== 'throne_room').sort((a, b) => C()[b].cost - C()[a].cost);
        const pick = acts[0] || p.hand.filter((c) => isType(c, 'action'))[0];
        return { type: 'THRONE_CHOOSE', card: pick };
      }
      case 'library':
        // 単純CPUは引いたアクションをそのまま手札に（脇に置かない）
        return { type: 'LIBRARY_RESOLVE', setAside: false };
      case 'spy':
        if (pd.stage === 'react') { if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' }; return { type: 'SPY_REACT' }; }
        { // 自分=不要札を捨てて良い札を残す / 相手=良い札を捨てさせ不要札を残す
          const dead = isType(pd.card, 'victory') || isType(pd.card, 'curse');
          const mine = pd.victim === pd.source;
          return { type: 'SPY_DECIDE', discard: mine ? dead : !dead };
        }
      case 'thief':
        if (pd.stage === 'react') { if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' }; return { type: 'THIEF_REACT' }; }
        if (pd.stage === 'pick') {
          const best = pd.treasures.slice().sort((a, b) => (C()[b].coin || 0) - (C()[a].coin || 0))[0];
          return { type: 'THIEF_PICK', card: best };
        }
        // gain: 銀貨・金貨は獲得（銅貨はデッキを汚すので獲得しない）
        return { type: 'THIEF_GAIN', take: (C()[pd.trashed].coin || 0) >= 2 };
      case 'witch':
        // 呪いを受ける側。堀があれば無効化、無ければそのまま（CPUは秘密の小部屋を公開しない）
        if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' };
        return { type: 'WITCH_REACT' };
      case 'bureaucrat':
        if (pd.stage === 'react') {
          if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' };
          return { type: 'BUREAUCRAT_REACT' };
        }
        { // put: 最も安い勝利点（屋敷優先）を山札の上に置く
          const vics = p.hand.filter((c) => isType(c, 'victory')).sort((a, b) => C()[a].cost - C()[b].cost);
          return { type: 'BUREAUCRAT_PUT', card: vics[0] };
        }
      case 'moneylender':
        // 銅貨があれば廃棄して+3（デッキ圧縮にもなり常に得）
        return { type: 'MONEYLENDER_RESOLVE', trash: p.hand.includes('copper') };
      case 'chancellor':
        // 山札の入れ替えは状況依存。単純CPUはそのまま（山札を捨てない）
        return { type: 'CHANCELLOR_RESOLVE', discardDeck: false };
      case 'chapel':
        // 呪い・屋敷・余剰銅貨を廃棄してデッキ圧縮（最大4枚、銅貨は2枚まで残す）
        return { type: 'CHAPEL_RESOLVE', cards: pickChapelTrash(p) };
      case 'secret_chamber':
        // アクション: 死に札(勝利点/呪い)を捨ててコインに変える（手札では無駄なので得）
        return { type: 'SECRET_CHAMBER_RESOLVE', cards: p.hand.filter((c) => isDead(c)) };
      case 'secret_chamber_putback':
        // リアクションで引いた後、不要札2枚を山札の上へ（CPUは通常ここへ来ないが防御的に）
        return { type: 'SECRET_CHAMBER_PUTBACK', cards: pickTrash(p.hand, Math.min(2, p.hand.length)) };
      case 'trading_post':
        // 不要札を優先して2枚（手札が1枚なら1枚）廃棄
        return { type: 'TRADING_POST_RESOLVE', cards: pickTrash(p.hand, Math.min(2, p.hand.length)) };
      case 'upgrade':
        if (pd.stage === 'trash') return { type: 'UPGRADE_TRASH', card: pickRemodelTrash(state, p) };
        // ちょうど+1コストを獲得（勝利点を避けた最善→無ければ何でも。候補ありなら必ず非null）
        return { type: 'UPGRADE_GAIN', card: bestGainExact(state, pd.exactCost, { noVictory: true }) || bestGainExact(state, pd.exactCost) };

      /* ===== 基本セット 第二版 ===== */
      case 'harbinger': {
        // 捨て札から最も価値の高いカードを山札の上へ（死に札なら置かない）
        if (!p.discard.length) return { type: 'HARBINGER_PUT', card: null };
        const best = p.discard.slice().sort((a, b) => keepValue(b) - keepValue(a))[0];
        return { type: 'HARBINGER_PUT', card: isDead(best) ? null : best };
      }
      case 'vassal':
        return { type: 'VASSAL_PLAY', play: true }; // 無料で使えるアクションは常に使う
      case 'poacher':
        return { type: 'POACHER_DISCARD', cards: pickDiscards(p.hand, pd.need) };
      case 'bandit':
        if (pd.stage === 'react') { if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' }; return { type: 'BANDIT_REACT' }; }
        { // pick: 安い財宝を廃棄して高い財宝を残す
          const c = pd.cands.slice().sort((a, b) => (C()[a].coin || 0) - (C()[b].coin || 0))[0];
          return { type: 'BANDIT_PICK', card: c };
        }
      case 'sentry': {
        // 呪い・屋敷は廃棄、それ以外は山札の上に戻す（銅貨は安全のため残す）
        const tr = [], di = [], top = [];
        pd.cards.forEach((c) => { if (c === 'curse' || c === 'estate') tr.push(c); else top.push(c); });
        return { type: 'SENTRY_RESOLVE', trash: tr, discard: di, top };
      }
      case 'artisan':
        if (pd.stage === 'gain') return { type: 'ARTISAN_GAIN', card: bestGain(state, 5, { noVictory: true }) || bestGain(state, 5) };
        { // put: 強いアクションを山札の上に（次に引く）。無ければ最も不要な札
          const acts = p.hand.filter((c) => isType(c, 'action')).sort((a, b) => C()[b].cost - C()[a].cost);
          const card = acts[0] || p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b))[0];
          return { type: 'ARTISAN_PUT', card };
        }

      /* ===== 陰謀 第二版 ===== */
      case 'courtier':
        if (pd.stage === 'reveal') {
          const card = p.hand.slice().sort((a, b) => (C()[b].types || []).length - (C()[a].types || []).length)[0];
          return { type: 'COURTIER_REVEAL', card }; // 種類が多いカードを公開（選択肢が増える）
        }
        { const pri = ['coin', 'gold', 'action', 'buy']; return { type: 'COURTIER_CHOOSE', choices: pri.slice(0, pd.n) }; }
      case 'lurker':
        if (pd.stage === 'choose') {
          const good = state.trash.find((id) => isType(id, 'action') && cost(state, id) >= 4);
          return { type: 'LURKER_CHOOSE', choice: good ? 'gain' : 'trash' };
        }
        if (pd.stage === 'trash') {
          const acts = Object.keys(state.supply).filter((id) => isType(id, 'action') && sup(state, id) > 0).sort((a, b) => C()[a].cost - C()[b].cost);
          return { type: 'LURKER_TRASH', card: acts[0] };
        }
        { const acts = state.trash.filter((id) => isType(id, 'action')).sort((a, b) => C()[b].cost - C()[a].cost); return { type: 'LURKER_GAIN', card: acts[0] }; }
      case 'mill': {
        const junk = p.hand.filter((c) => isType(c, 'curse') || c === 'estate' || c === 'copper');
        return { type: 'MILL_RESOLVE', cards: junk.length >= 2 ? junk.slice(0, 2) : [] };
      }
      case 'patrol':
        return { type: 'PATROL_RESOLVE', order: pd.cards.slice() };
      case 'replace':
        if (pd.stage === 'react') { if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' }; return { type: 'REPLACE_REACT' }; }
        if (pd.stage === 'trash') return { type: 'REPLACE_TRASH', card: pickRemodelTrash(state, p) };
        return { type: 'REPLACE_GAIN', card: bestGain(state, pd.maxCost, { noVictory: true }) || bestGain(state, pd.maxCost) };
      case 'secret_passage':
        if (pd.stage === 'pick') {
          const junk = p.hand.find((c) => isType(c, 'curse') || c === 'estate');
          const card = junk || p.hand.slice().sort((a, b) => keepValue(b) - keepValue(a))[0];
          return { type: 'SECRET_PASSAGE_PICK', card };
        }
        { const c = pd.card; const j = isType(c, 'curse') || c === 'estate'; return { type: 'SECRET_PASSAGE_PLACE', pos: j ? p.deck.length : 0 }; }
      case 'diplomat_discard':
        return { type: 'DIPLOMAT_DISCARD', cards: pickDiscards(p.hand, Math.min(3, p.hand.length)) };

      /* ===== プロモ ===== */
      case 'envoy': {
        // 左隣として、使用者に最も価値の高いカードを捨てさせる
        const best = pd.revealed.slice().sort((a, b) => keepValue(b) - keepValue(a))[0];
        return { type: 'ENVOY_PICK', card: best };
      }
      case 'governor':
        return { type: 'GOVERNOR_CHOOSE', choice: 'silver' }; // 自分は金貨が得られる銀貨モード
      case 'governor_remodel':
        if (pd.stage === 'trash') {
          const tryT = (c) => p.hand.includes(c) && bestGainExact(state, cost(state, c) + pd.delta, { noVictory: true });
          let card = null;
          if (tryT('estate')) card = 'estate';
          else if (pd.delta >= 2 && tryT('copper')) card = 'copper';
          else { const acts = p.hand.filter((c) => isType(c, 'action')).sort((a, b) => C()[a].cost - C()[b].cost); if (acts.length && bestGainExact(state, cost(state, acts[0]) + pd.delta, { noVictory: true })) card = acts[0]; }
          return { type: 'GOVERNOR_REMODEL_TRASH', card };
        }
        return { type: 'GOVERNOR_REMODEL_GAIN', card: bestGainExact(state, pd.exact, { noVictory: true }) || bestGainExact(state, pd.exact) };
      case 'dismantle':
        if (pd.stage === 'trash') {
          let card;
          if (p.hand.includes('estate')) card = 'estate';
          else { const acts = p.hand.filter((c) => isType(c, 'action') && cost(state, c) >= 1).sort((a, b) => C()[a].cost - C()[b].cost); card = acts[0] || p.hand.slice().sort((a, b) => trashValue(a) - trashValue(b))[0]; }
          return { type: 'DISMANTLE_TRASH', card };
        }
        return { type: 'DISMANTLE_GAIN', card: bestGain(state, pd.maxCost, { noVictory: true }) || bestGain(state, pd.maxCost) };
      case 'black_market': {
        if (p.hand.some((c) => isTreasure(c))) return { type: 'BLACK_MARKET_PLAY_TREASURES' };
        const coins = state.turn.coins;
        const aff = pd.revealed.filter((id) => cost(state, id) <= coins && !isType(id, 'curse'));
        const premium = GAIN_ORDER.slice(0, GAIN_ORDER.indexOf('silver'));
        let pick = null;
        for (const id of premium) { if (aff.includes(id)) { pick = id; break; } }
        return pick ? { type: 'BLACK_MARKET_BUY', card: pick } : { type: 'BLACK_MARKET_SKIP' };
      }

      /* ===== 拡張: 海辺（Seaside 第二版）===== */
      case 'warehouse':
        return { type: 'WAREHOUSE_DISCARD', cards: pickDiscards(p.hand, Math.min(3, p.hand.length)) };
      case 'haven': {
        // 戻ってくるので損が無い＝最も価値の低い札を脇に置いて手札を軽くする
        const c = p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b))[0];
        return { type: 'HAVEN_SETASIDE', card: c };
      }
      case 'tactician': {
        const hc = p.hand.reduce((s, c) => s + (isTreasure(c) ? (C()[c].coin || 0) : 0), 0);
        return { type: 'TACTICIAN_RESOLVE', discard: p.hand.length > 0 && hc <= 3 };
      }
      case 'salvager': {
        // 不要札を廃棄（estate=+2コイン等）。trashValue が低い順、同値ならコスト高い順（コイン多い）。
        const order = p.hand.slice().sort((a, b) => (trashValue(a) - trashValue(b)) || (C()[b].cost - C()[a].cost));
        return { type: 'SALVAGER_TRASH', card: order[0] };
      }
      case 'lookout':
        if (pd.stage === 'trash') {
          const worst = pd.cards.slice().sort((a, b) => trashValue(a) - trashValue(b))[0];
          return { type: 'LOOKOUT_TRASH', card: worst };
        }
        { const worst = pd.cards.slice().sort((a, b) => keepValue(a) - keepValue(b))[0];
          return { type: 'LOOKOUT_DISCARD', card: worst }; }
      case 'island': {
        // 勝利点を島マットへ退避（VPは保持しつつデッキ圧縮）。無ければ最も不要な札。
        const vic = p.hand.filter((c) => isType(c, 'victory')).sort((a, b) => (C()[b].vp || 0) - (C()[a].vp || 0))[0];
        const c = vic || p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b))[0];
        return { type: 'ISLAND_PICK', card: c };
      }
      case 'native_village':
        return { type: 'NATIVE_VILLAGE_RESOLVE', mode: (p.nativeVillageMat && p.nativeVillageMat.length >= 2) ? 'take' : 'set' };
      case 'tide_pools_discard':
        return { type: 'TIDE_POOLS_DISCARD', cards: pickDiscards(p.hand, Math.min(2, p.hand.length)) };
      case 'cutpurse':
        if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' };
        return { type: 'CUTPURSE_REACT' };
      case 'sea_witch':
        if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' };
        return { type: 'SEA_WITCH_REACT' };
      case 'sea_witch_discard':
        return { type: 'SEA_WITCH_DISCARD', cards: pickDiscards(p.hand, Math.min(2, p.hand.length)) };
      case 'smugglers': {
        // 右隣の獲得の中で最も価値の高いものを真似る（GAIN_ORDER優先）
        let pick = pd.candidates[0];
        for (const id of GAIN_ORDER) { if (pd.candidates.includes(id)) { pick = id; break; } }
        return { type: 'SMUGGLERS_GAIN', card: pick };
      }
      case 'blockade':
        // 4コスト以下で最善（脇に置いて次手番手札へ＝銀貨など）。
        return { type: 'BLOCKADE_GAIN', card: bestGain(state, 4, { noVictory: true }) || bestGain(state, 4) };
      case 'sailor_trash': {
        // 不要札があれば廃棄、無ければしない
        const junk = p.hand.find((c) => isType(c, 'curse') || c === 'estate' || c === 'copper');
        return { type: 'SAILOR_TRASH', card: junk || null };
      }
      case 'sailor_play_gain':
        // 獲得した持続カードはほぼ常に即プレイが得（無料のテンポ）。常に使う。
        return { type: 'SAILOR_PLAY_GAIN', play: true };
      case 'pirate_gain':
        return { type: 'PIRATE_GAIN', card: bestGain(state, 6, { treasureOnly: true }) };

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
