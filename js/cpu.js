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
  const GAIN_ORDER = ['colony', 'platinum', 'province', 'gold', 'artisan', 'nobles', 'harem', 'duchy',
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
    // 繁栄（第二版）王国カード25種＝強さ/コストの目安順。供給があるときだけ効く。
    'kings_court', 'grand_market', 'bank', 'expand', 'forge', 'peddler', 'city', 'vault', 'rabble',
    'magnate', 'mint', 'collection', 'crystal_ball', 'charlatan', 'war_chest', 'bishop',
    'monument', 'workers_village', 'watchtower', 'tiara', 'quarry', 'investment', 'anvil', 'clerk',
    // ギルド（実プレイ＝段階2）＝強さ/コストの目安順。供給があるときだけ効く（bestEngineBuy/bestGain が参照）。
    'soothsayer', 'taxman', 'butcher', 'merchant_guild', 'journeyman', 'baker', 'herald', 'advisor', 'plaza', 'doctor', 'candlestick_maker', 'stonemason', 'masterpiece',
    'pawn', 'lurker', 'moat', 'secret_chamber', 'chapel', 'cellar', 'gardens', 'estate', 'duke',
    // 追加拡張（収穫祭/異郷/暗黒時代/新プロモ）＝孤立プールで実サプライに出ないため並び順はCPU挙動に無影響
    'stash', 'prince', 'captain', 'church', 'sauna', 'avanto', 'hamlet', 'fortune_teller', 'menagerie', 'farming_village', 'horse_traders', 'remake', 'tournament', 'young_witch', 'harvest', 'horn_of_plenty', 'hunting_party', 'jester', 'fairgrounds', 'bag_of_gold', 'diadem', 'followers', 'princess', 'trusty_steed', 'crossroads', 'duchess', 'fools_gold', 'develop', 'oasis', 'oracle', 'scheme', 'tunnel', 'jack_of_all_trades', 'noble_brigand', 'nomad_camp', 'silk_road', 'spice_merchant', 'trader', 'cache', 'cartographer', 'embassy', 'haggler', 'highway', 'ill_gotten_gains', 'inn', 'mandarin', 'margrave', 'stables', 'border_village', 'farmland', 'nomads', 'trail', 'weaver', 'souk', 'cauldron', 'guard_dog', 'berserker', 'wheelwright', 'witchs_hut', 'poor_house', 'squire', 'vagrant', 'beggar', 'hermit', 'sage', 'forager', 'storeroom', 'urchin', 'market_square', 'ironmonger', 'wandering_minstrel', 'procession', 'scavenger', 'fortress', 'rats', 'armory', 'death_cart', 'marauder', 'feodum',
    // 段階1追加（暗黒時代残り。CARD_SETS 未参照＝実際には獲得されないが GAIN_ORDER=全カードの整合性を満たす）
    'junk_dealer', 'bandit_camp', 'rebuild', 'catacombs', 'graverobber', 'count', 'band_of_misfits', 'mystic', 'rogue', 'pillage', 'cultist', 'counterfeit', 'hunting_grounds', 'altar', 'knights', 'dame_anna', 'dame_josephine', 'dame_molly', 'dame_natalie', 'dame_sylvia', 'sir_bailey', 'sir_destry', 'sir_martin', 'sir_michael', 'sir_vander', 'abandoned_mine', 'ruined_library', 'ruined_market', 'ruined_village', 'survivors', 'hovel', 'necropolis', 'overgrown_estate', 'spoils', 'madman', 'mercenary',
    'copper', 'curse'];
  // 収穫祭：賞品(Prize)は馬上槍試合でのみ獲得する非サプライ札＝汎用の獲得効果(bestGain/bestGainExact)は
  // 絶対に賞品を選ばない（豊穣の角等で$0賞品を不正獲得しない／賞品を拒否する reducer と噛み合って無限ループしない）。
  const PRIZE_SET = new Set(['bag_of_gold', 'diadem', 'followers', 'princess', 'trusty_steed']);
  function bestGain(state, maxCost, opts) {
    opts = opts || {};
    for (const id of GAIN_ORDER) {
      if (PRIZE_SET.has(id)) continue;
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
      if (PRIZE_SET.has(id)) continue;
      if (opts.noVictory && (isType(id, 'victory') || isType(id, 'curse'))) continue;
      if (!C()[id]) continue;
      if (cost(state, id) === exact && sup(state, id) > 0) return id;
    }
    for (const id of Object.keys(state.supply)) {
      if (PRIZE_SET.has(id)) continue;
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
    // 錬金術：非ターミナル（+アクション付き）
    if (has('alchemist')) return 'alchemist';             // +2カード+1アクション
    if (has('apothecary')) return 'apothecary';           // +1カード+1アクション
    if (has('familiar')) return 'familiar';               // +1カード+1アクション＋全員に呪い
    if (has('scrying_pool')) return 'scrying_pool';       // +1アクション＋偵察＋連続ドロー
    if (has('university')) return 'university';           // +2アクション＋アクション獲得
    if (has('apprentice') && (has('estate') || has('curse'))) return 'apprentice'; // +1アクション（不要札を廃棄→ドロー）
    // 収穫祭：非ターミナル（+アクション付き）
    if (has('bag_of_gold')) return 'bag_of_gold';         // +1アクション＋金貨を山札の上に獲得（賞品）
    if (has('farming_village')) return 'farming_village'; // +2アクション
    if (has('hunting_party')) return 'hunting_party';     // +1カード+1アクション
    if (has('menagerie')) return 'menagerie';             // +1アクション（重複なしで+3カード）
    if (has('hamlet')) return 'hamlet';                   // +1カード+1アクション（任意で+アクション/+購入）
    if (has('tournament')) return 'tournament';           // +1アクション（属州で賞品獲得）
    // ギルド：非ターミナル（+アクション付き）
    if (has('candlestick_maker')) return 'candlestick_maker'; // +1アクション+1購入+1財源
    if (has('baker')) return 'baker';                     // +1カード+1アクション+1財源
    if (has('plaza')) return 'plaza';                     // +1カード+2アクション（財宝を捨てて財源）
    if (has('herald')) return 'herald';                   // +1カード+1アクション（山札の上がアクションなら使う）
    if (has('advisor')) return 'advisor';                 // +1アクション（上3枚→左隣が1枚捨てさせ、残りを手札へ）
    // 異郷：非ターミナル（+アクション付き）
    if (has('border_village')) return 'border_village';   // +1カード+2アクション
    if (has('crossroads') && (!t.crossroadsPlayed || p.hand.some((c) => isType(c, 'victory')))) return 'crossroads'; // 初回+3アクション/勝利点で+カード
    if (has('highway')) return 'highway';                 // +1カード+1アクション（全カード-1コスト）
    if (has('inn')) return 'inn';                         // +2カード+2アクション（2枚捨て）
    if (has('cartographer')) return 'cartographer';       // +1カード+1アクション（山札整理）
    if (has('oasis')) return 'oasis';                     // +1カード+1アクション+1コイン（1枚捨て）
    if (has('scheme')) return 'scheme';                   // +1カード+1アクション（片付けで山札の上へ）
    if (has('trail')) return 'trail';                     // +1カード+1アクション
    if (has('wheelwright')) return 'wheelwright';         // +1カード+1アクション（捨てて格上げ獲得）
    // --- ターミナル（効果の大きい順）---
    if (has('golem')) return 'golem';                     // 山札のアクション2枚を使う
    if (has('herbalist')) return 'herbalist';             // +1購入+1コイン
    if (has('transmute') && has('estate')) return 'transmute'; // 屋敷→公領
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
    // 収穫祭：ターミナル（アタック・格上げ・賞品）
    if (has('jester')) return 'jester';                 // +2コイン＋アタック
    if (has('young_witch')) return 'young_witch';       // +2カード＋全員に呪い
    if (has('fortune_teller')) return 'fortune_teller'; // +2コイン＋アタック
    if (has('followers')) return 'followers';           // +2カード＋屋敷＋呪い配布（賞品）
    if (has('harvest')) return 'harvest';               // 山札上4枚公開→コイン
    if (has('horse_traders')) return 'horse_traders';   // +3コイン+1購入（手札2枚捨て）
    if (has('remake') && p.hand.length > 1) return 'remake'; // 廃棄→格上げ2回（手札が1枚だと損なので温存）
    if (has('trusty_steed')) return 'trusty_steed';     // 異なる2つを選ぶ（賞品）
    if (has('princess')) return 'princess';             // +1購入＋このターン全カード-2コスト（賞品）
    // ギルド：ターミナル（アタック＞財源＞公開＞trash-to-gain）
    if (has('soothsayer')) return 'soothsayer';         // 金貨獲得＋全員に呪い（強力）
    if (has('taxman')) return 'taxman';                 // 財宝廃棄→格上げ＋相手に同名捨てさせる
    if (has('butcher')) return 'butcher';               // +2財源（任意で trash-to-gain）＝常に得
    if (has('merchant_guild')) return 'merchant_guild'; // +1購入+1コイン＋購入毎に財源
    if (has('journeyman')) return 'journeyman';         // 指定以外を3枚引く
    // 石工＝廃棄が必須。銅貨/呪いがあるときだけプレイ（純粋な圧縮＝獲得なし。屋敷は獲得で銅貨が増えるので温存）。
    if (has('stonemason') && (has('copper') || has('curse'))) return 'stonemason';
    // 医者＝不要札を山札から抜ける見込みがあるときだけ（ターミナルなので無駄打ち回避）。
    if (has('doctor') && (owned(p, 'curse') > 0 || owned(p, 'estate') > 0 || owned(p, 'copper') > 3)) return 'doctor';
    // 異郷：ターミナル（アタック＞ドロー＞財源系）
    if (has('margrave')) return 'margrave';               // +3カード+1購入＋アタック（強力）
    if (has('witchs_hut')) return 'witchs_hut';           // +4カード＋（両方アクション捨てで）呪い
    if (has('oracle')) return 'oracle';                   // 相手妨害＋2カード
    if (has('berserker')) return 'berserker';             // 格下げ獲得＋相手手札削り
    if (has('noble_brigand')) return 'noble_brigand';     // +1コイン＋相手の銀/金を奪う
    if (has('embassy')) return 'embassy';                 // +5カード→3枚捨て
    if (has('guard_dog')) return 'guard_dog';             // +2(〜4)カード
    if (has('jack_of_all_trades')) return 'jack_of_all_trades'; // 銀貨獲得＋圧縮
    if (has('mandarin')) return 'mandarin';               // +3コイン＋財宝を山札の上へ
    if (has('souk')) return 'souk';                       // +1購入＋大量コイン
    if (has('haggler')) return 'haggler';                 // +2コイン＋購入時に格下げ獲得
    if (has('duchess')) return 'duchess';                 // +2コイン
    if (has('nomad_camp')) return 'nomad_camp';           // +2コイン+1購入
    if (has('nomads')) return 'nomads';                   // +2コイン+1購入
    if (has('weaver')) return 'weaver';                   // 銀貨2枚/コスト4以下を獲得
    if (has('spice_merchant') && p.hand.includes('copper')) return 'spice_merchant'; // 銅貨を廃棄→ボーナス
    if (has('stables') && p.hand.includes('copper')) return 'stables';               // 銅貨を捨て→+3カード+1アクション
    if (has('develop') && p.hand.some((c) => c === 'estate' || c === 'copper' || isType(c, 'curse'))) return 'develop'; // 不要札を2枚に格上げ
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
    // 繁栄：非ターミナル（+アクション付き）を先に
    if (has('workers_village')) return 'workers_village'; // +1カード+2アクション+1購入
    if (has('city')) return 'city';                       // +1カード+2アクション（空山でさらに）
    if (has('grand_market')) return 'grand_market';       // +1カード+1アクション+1購入+2コイン
    if (has('peddler')) return 'peddler';                 // +1カード+1アクション+1コイン
    // 繁栄：ターミナル
    if (has('kings_court') && p.hand.some((c) => isType(c, 'action') && c !== 'kings_court')) return 'kings_court';
    if (has('rabble')) return 'rabble';                   // +3カード＋アタック
    if (has('vault')) return 'vault';                     // +2カード→捨ててコイン
    if (has('magnate') && p.hand.filter((c) => isTreasure(c)).length >= 2) return 'magnate';
    if (has('clerk')) return 'clerk';                     // +2コイン＋アタック
    if (has('monument')) return 'monument';               // +2コイン+1VP
    if (has('bishop')) return 'bishop';                   // +1コイン+1VP＋圧縮
    if (has('expand') && p.hand.length > 1) return 'expand';
    if (has('forge') && p.hand.filter((c) => trashValue(c) < 10).length >= 1) return 'forge';
    if (has('mint') && p.hand.some((c) => isTreasure(c))) return 'mint';
    if (has('war_chest')) return 'war_chest';
    if (has('watchtower') && p.hand.length < 6) return 'watchtower';
    // 秘密の小部屋: 手札に死に札(勝利点/呪い)があればコインに変える
    if (has('secret_chamber') && p.hand.some((c) => isDead(c))) return 'secret_chamber';
    return null;
  }

  /* ---------- 購入フェーズ：買うカードを選ぶ（難易度別） ---------- */
  function kingdomAffordable(state, coins) {
    const potions = (state.turn && state.turn.potions) || 0; // 錬金術：ポーション費用も満たすものだけ
    return (state.kingdom || []).filter((id) => C()[id].cost <= coins && (C()[id].potion || 0) <= potions && sup(state, id) > 0);
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
    const vineyards = cards.filter((c) => c === 'vineyard').length;
    if (vineyards) vp += vineyards * Math.floor(cards.filter((c) => isType(c, 'action')).length / 3);
    const fairgrounds = cards.filter((c) => c === 'fairgrounds').length; // 収穫祭：品評会（engine.vpOf と同等に）
    if (fairgrounds) vp += fairgrounds * 2 * Math.floor(new Set(cards).size / 5);
    const silkRoads = cards.filter((c) => c === 'silk_road').length; // 異郷：絹の道（勝利点カード4枚毎に1点）
    if (silkRoads) vp += silkRoads * Math.floor(cards.filter((c) => isType(c, 'victory')).length / 4);
    vp += p.vpTokens || 0; // 繁栄：VPトークン
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
    const hypo = { deck: allCards(me).concat(id), hand: [], discard: [], inPlay: [], vpTokens: me.vpTokens || 0 };
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

  /* 混成王国でビッグマネーに偏らないための「エンジン部品」買い。
     カードのテキストから「+Nアクション」を読み、非ターミナル(村・研究所型)は積み増し、
     ターミナルは村数に見合う範囲だけ買う（ターミナル衝突＝手札で腐るのを防ぐ）。
     GAIN_ORDER の強さ順で最良の1枚を返す。買うべき王国カードが無ければ null。 */
  function plusActions(id) {
    const t = (C()[id] && C()[id].text) || '';
    const m = t.match(/\+\s*(\d+)\s*アクション/);
    return m ? parseInt(m[1], 10) : 0;
  }
  function plusCards(id) {
    const t = (C()[id] && C()[id].text) || '';
    const m = t.match(/\+\s*(\d+)\s*カード/);
    return m ? parseInt(m[1], 10) : 0;
  }
  function isNonTerminalAction(id) { return isType(id, 'action') && plusActions(id) >= 1; }
  // 玉座の間/王の宮廷で「2回(3回)打つ価値」の目安。コスト順より賢く対象を選ぶために使う。
  // ドロー(+カード)＞アタック(複製で妨害倍増)＞獲得系＞+アクション/コイン、を反映。
  function throneValue(id) {
    let v = plusCards(id) * 3;
    if (isType(id, 'attack')) v += 6;
    if (/獲得/.test((C()[id] && C()[id].text) || '')) v += 2;
    v += plusActions(id) * 1.5 + ((C()[id] && C()[id].coin) || 0) + ((C()[id] && C()[id].cost) || 0) * 0.1;
    return v;
  }
  /* 王国の「エンジン成立度」を静的評価して ENGINE/MONEY を返す（B案）。
     実測（自己対戦A/B）で「半端なエンジンは無エンジン(ビッグマネー)より弱い」と判明した。
     ヒューリスティックな bestEngineBuy で確実に回せて勝てる王国だけ ENGINE と判定し、
     それ以外は純ビッグマネー(bestEngineBuy を呼ばない)に切り替える。判定基準は自己対戦A/Bで確定:

     (1) 海辺・繁栄の王国 … エンジンが本物で、現行 bestEngineBuy でも回せて勝てる。
         固定セットのA/Bで BM は海辺15%・繁栄23%＝エンジン圧勝（random系は互角なので ENGINE でも損無し）。
     (2) 基本/陰謀の「礼拝堂＋ドロー」王国 … 圧縮(chapel)＋+2カード級ドローが揃うと軽量エンジンが
         成立し、BMより強い（例: 推奨「ビッグマネー」セットは BM だと43%＝エンジンが勝つ）。
         ただし庭園(gardens)があれば大デッキ報酬＝圧縮エンジンと相反する“庭園ラッシュ”なので除外
         （size-distortion 等は BM が99%勝つのを守る）。
     上記以外（基本/陰謀/錬金術の大半）は純ビッグマネーが強い（BMが55〜96%勝ち）。
     村/ドロー等の一般特徴量で分離しようとすると固定繁栄エンジンを取りこぼす（実測）ため上記に絞った。
     王国は対局中不変なので内容キーで一度だけ評価してキャッシュする。 */
  const __engCache = {};
  function evaluateKingdom(kingdom) {
    const K = kingdom || [];
    const key = K.slice().sort().join(',');
    if (__engCache[key]) return __engCache[key];
    const POOLS = DOM.POOLS || {};
    const inPool = (pool) => K.some((id) => (POOLS[pool] || []).indexOf(id) >= 0);
    const hasChapelEngine = K.indexOf('chapel') >= 0 && K.indexOf('gardens') < 0 &&
      K.some((id) => C()[id] && plusCards(id) >= 2); // 圧縮＋ドロー、ただし庭園ラッシュは除く
    // ギルド＝財源経済＋キャントリップ(蝋燭職人/パン屋/広場/伝令官/助言者)でエンジンが組める拡張。
    const isEngine = inPool('seaside') || inPool('prosperity') || inPool('guilds') || hasChapelEngine;
    return (__engCache[key] = isEngine ? 'ENGINE' : 'MONEY');
  }
  function bestEngineBuy(state, p, coins) {
    const potions = (state.turn && state.turn.potions) || 0;
    const acts = allCards(p).filter((c) => isType(c, 'action'));
    const villages = acts.filter((c) => isNonTerminalAction(c)).length; // +アクションを供給する札
    const terminals = acts.length - villages;                          // アクションを消費する札
    for (const id of GAIN_ORDER) {
      if (!C()[id]) continue;
      if (!(state.kingdom || []).includes(id)) continue;         // 王国カードのみ（基本の財宝/勝利点は別ロジック）
      if (id === 'possession') continue;                          // CPUは支配を使いこなせないので買わない
      if (isType(id, 'victory') || isType(id, 'curse')) continue; // 勝利点は緑化ロジックで扱う
      if (sup(state, id) <= 0) continue;
      if (cost(state, id) > coins) continue;
      if ((C()[id].potion || 0) > potions) continue;              // ポーション費用を満たすものだけ
      const have = owned(p, id);
      if (isType(id, 'action')) {
        if (isNonTerminalAction(id)) { if (have < 4) return id; }  // 村/研究所型は積んでよい
        else if (have < 2 && terminals < villages + 1) return id;  // ターミナルは村数+1まで（衝突回避）
      } else if (isType(id, 'treasure')) {
        if (have < 2) return id;                                   // 銀行/隠し財産/賢者の石 等
      }
    }
    return null;
  }

  function chooseBuyStrong(state, p, coins) {
    const seat = state.turn.active;
    // 1) 勝って終われる購入があれば最優先（得点→コストの高い順）
    let winningEnd = null, bestKey = -Infinity;
    Object.keys(state.supply).forEach((id) => {
      if (sup(state, id) <= 0 || C()[id].cost > coins || (C()[id].potion || 0) > (state.turn.potions || 0)) return; // 錬金術：ポーション費用も満たす
      if (!buyEndsGame(state, id) || !winsIfEnds(state, seat, id)) return;
      const key = (C()[id].vp || 0) * 100 + C()[id].cost;
      if (key > bestKey) { bestKey = key; winningEnd = id; }
    });
    if (winningEnd) return winningEnd;

    const province = sup(state, 'province');
    let pick = null;
    if (coins >= 11 && sup(state, 'colony') > 0) pick = 'colony';          // 繁栄：植民地（10VP）
    else if (coins >= 9 && sup(state, 'platinum') > 0) pick = 'platinum';  // 繁栄：プラチナ貨（money engine）
    else if (coins >= 8 && province > 0) pick = 'province';
    else if (province <= 4 && coins >= 5 && sup(state, 'duchy') > 0) pick = 'duchy';
    else if (province <= 2 && coins >= 2 && sup(state, 'estate') > 0) pick = 'estate';
    else if (coins >= 6 && sup(state, 'gold') > 0) pick = 'gold';
    else {
      // 緑化フェーズに入る前は、強い王国カード（エンジン部品）を買って盤面を厚くする。
      // ただしエンジンが成立する王国のときだけ（不成立なら純ビッグマネー）。
      const eng = (province > 4 && evaluateKingdom(state.kingdom) === 'ENGINE') ? bestEngineBuy(state, p, coins) : null;
      if (eng) pick = eng;
      else if (coins >= 3 && sup(state, 'silver') > 0) pick = 'silver';
    }

    // 2) 負けて終わる購入は避ける（ゲームを閉じない次善手か、何も買わない）
    if (pick && buyEndsGame(state, pick) && !winsIfEnds(state, seat, pick)) {
      pick = ['gold', 'silver'].find((id) => coins >= C()[id].cost && sup(state, id) > 0 && !buyEndsGame(state, id)) || null;
    }
    return pick;
  }

  function chooseBuyNormal(state, p, coins) {
    const province = sup(state, 'province');
    if (coins >= 11 && sup(state, 'colony') > 0) return 'colony';         // 繁栄：植民地（10VP）
    if (coins >= 9 && sup(state, 'platinum') > 0) return 'platinum';      // 繁栄：プラチナ貨
    if (coins >= 8 && province > 0) return 'province';
    if (coins >= 6 && sup(state, 'gold') > 0) return 'gold';
    // 中盤：緑化前は強い王国カード（エンジン部品）を買う。エンジンが成立する王国のときだけ。
    const eng = (province > 3 && evaluateKingdom(state.kingdom) === 'ENGINE') ? bestEngineBuy(state, p, coins) : null;
    if (eng) return eng;
    if (province <= 3 && coins >= 5 && sup(state, 'duchy') > 0) return 'duchy';
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

  /* 錬金術：CPUがポーションを仕込む価値のある王国か（支配はCPUの操作が難しいので除外）。 */
  function wantsPotion(state) {
    return (state.kingdom || []).some((id) => (C()[id].potion || 0) > 0 && id !== 'possession' && sup(state, id) > 0);
  }
  /* 錬金術：このターンのポーション量で買える最善のポーション費用カード（GAIN_ORDER優先）。 */
  function bestPotionBuy(state, real, potions) {
    const cands = (state.kingdom || []).filter((id) =>
      sup(state, id) > 0 && (C()[id].potion || 0) > 0 && (C()[id].potion || 0) <= potions &&
      cost(state, id) <= real && id !== 'possession'); // 支配はCPUが扱いにくいので自動購入しない
    for (const id of GAIN_ORDER) { if (cands.includes(id)) return id; }
    return cands[0] || null;
  }

  function chooseBuy(state, p, level) {
    if (state.turn.buys <= 0) return null;
    const real = state.turn.coins;
    const potions = state.turn.potions || 0;
    // 「橋」等の軽減は“使える額が増える”のと等価なので、判断はその換算額で行う
    const coins = real + ((state.turn.costReduction) || 0);
    // 錬金術：このターンにポーションが余っているなら、ポーション費用カードを優先して買う（使い切る）。
    if (potions >= 1) { const pc = bestPotionBuy(state, real, potions); if (pc) return pc; }
    let pick = null;
    if (level === 'hard') pick = chooseBuyStrong(state, p, coins);
    else if (level === 'easy') pick = chooseBuyWeak(state, p, coins);
    else pick = chooseBuyNormal(state, p, coins);
    // 錬金術：ポーション未所持で王国にポーション費用カードがあり、属州/金貨を優先しない局面ならポーションを仕込む。
    if ((!pick || pick === 'silver') && owned(p, 'potion') === 0 && sup(state, 'potion') > 0 &&
        wantsPotion(state) && real >= 4 && !(coins >= 8 && sup(state, 'province') > 0)) {
      pick = 'potion';
    }
    // 経済崩壊の安全網：何も買わない判断になった局面でも、デッキの財宝が乏しければ最安の財宝を必ず買う。
    // 泥棒(thief)等でゲーム全体の財宝が枯れると、全員がコイン0・購入0の均衡に陥り、パイルも減らず
    // isGameOver が永久に false になる（＝CPU戦・オンラインCPU部屋が終わらない）。銅貨は$0で常に買えるので
    // これで経済を建て直しつつ確実にパイルを消化し、終局へ向かわせる。健全なデッキ（財宝が十分）では発動しない。
    if (!pick && state.turn.buys > 0) {
      const all = allCards(p);
      const deckCoin = all.reduce((s, c) => s + (isTreasure(c) ? (C()[c].coin || 0) : 0), 0);
      // 財宝の「密度」で判定：1枚あたりの平均コイン産出が薄い（＝手札が$3に届きにくく経済再建できない）
      // ときだけ発動。健全なデッキ（開始時7銅貨=密度0.7 やビッグマネー）では発動しない。
      if (deckCoin < all.length * 0.5) {
        if (cost(state, 'silver') <= real && sup(state, 'silver') > 0) pick = 'silver';
        else if (sup(state, 'copper') > 0) pick = 'copper';
      }
    }
    // 念のため：買えない手は返さない（実コストで判定。繁栄：高級市場は場に銅貨があると不可）。
    // 錬金術：ポーション費用も満たしていること（満たさない手を返すと reduce が no-op→CPU無限ループ）。
    const canBuy = !DOM.engine.canBuyCard || DOM.engine.canBuyCard(state, state.turn.active, pick);
    const potOk = !pick || (C()[pick].potion || 0) <= (state.turn.potions || 0);
    if (pick && cost(state, pick) <= real && potOk && sup(state, pick) > 0 && canBuy) return pick;
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
  // 銅貨の余剰廃棄は「デッキ全体の財宝が十分（≒初期量以上）あるとき」だけ行う。泥棒等で財宝が枯れた
  // 状態でさらに銅貨を削ると経済が崩壊して復帰不能になるため、財宝が乏しければ屋敷/呪いのみ圧縮する。
  function pickChapelTrash(p) {
    const out = [];
    p.hand.forEach((c) => { if (c === 'curse' && out.length < 4) out.push(c); });
    p.hand.forEach((c) => { if (c === 'estate' && out.length < 4) out.push(c); });
    const deckTreasure = allCards(p).filter((c) => isTreasure(c)).length;
    const coppers = p.hand.filter((c) => c === 'copper').length;
    if (deckTreasure >= 7) { for (let i = 2; i < coppers && out.length < 4; i++) out.push('copper'); }
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
    // 収穫祭：アタックの反応ステップで馬商人を持っていたら、まず脇に置く（次手番に+1カードで戻る＝常に得）。
    // 脇に置くと手札から消えるので、次回の呼び出しでは通常の判断（堀公開/受ける）に進む＝無限ループしない。
    // stage 'react' の各アタックに加え、embedded型（民兵/拷問人＝pending が反応窓を兼ねる）でも脇に置ける。
    if (pd && p.hand && p.hand.includes('horse_traders') &&
        (pd.stage === 'react' || pd.type === 'militia' || pd.type === 'torturer')) {
      return { type: 'HORSE_TRADERS_REACT' };
    }
    // 異郷：番犬＝アタックの反応窓で手札から先に使う（+2〜4カード・常に得。使うと手札から消え次回は通常判断）。
    if (pd && p.hand && p.hand.includes('guard_dog') &&
        (pd.stage === 'react' || pd.type === 'militia' || pd.type === 'torturer')) {
      return { type: 'GUARD_DOG_REACT' };
    }
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
        const acts = p.hand.filter((c) => isType(c, 'action') && c !== 'throne_room').sort((a, b) => throneValue(b) - throneValue(a));
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
        // 圧縮の主力：呪い/屋敷は廃棄。デッキに財宝が十分(≥7)あるとき銅貨も廃棄しデッキ密度を上げる。
        // その他の死に札(勝利点)は捨てて次を掘る。強い札は山札の上に戻す。
        const tr = [], di = [], top = [];
        const deckTreasure = allCards(p).filter((c) => isTreasure(c)).length;
        pd.cards.forEach((c) => {
          if (c === 'curse' || c === 'estate') tr.push(c);
          else if (c === 'copper' && deckTreasure >= 7) tr.push(c);
          else if (isDead(c)) di.push(c);
          else top.push(c);
        });
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
        if (pd.stage === 'react') {
          // 犠牲者側。堀があれば公開して免疫、無ければそのまま受ける。
          if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' };
          return { type: 'BLOCKADE_REACT' };
        }
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
      case 'pirate_react':
        // 財宝獲得のたびに海賊を使えば次の手番に財宝を手札へ＝実質タダのテンポ。常に使う。
        return { type: 'PIRATE_REACT', play: true };

      /* ===== 拡張: 錬金術（Alchemy 第二版）===== */
      case 'transmute': {
        // 屋敷→公領 が最強。無ければ呪い（デッキ圧縮）→最も不要な札。
        const c = p.hand.includes('estate') ? 'estate'
          : (p.hand.includes('curse') ? 'curse' : p.hand.slice().sort((a, b) => trashValue(a) - trashValue(b))[0]);
        return { type: 'TRANSMUTE_TRASH', card: c };
      }
      case 'apothecary': {
        // 残りを山札の上へ。引きたい札（アクション/財宝）を上に、勝利点/呪いを下に。
        const order = pd.cards.slice().sort((a, b) => keepValue(b) - keepValue(a));
        return { type: 'APOTHECARY_RESOLVE', order };
      }
      case 'scrying_pool':
        if (pd.stage === 'react') { if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' }; return { type: 'SCRYING_REACT' }; }
        { // 自分＝アクション以外を捨ててアクションまで掘る／相手＝良い札を捨てさせ死に札を残す
          const mine = pd.victim === pd.source;
          const isAct = isType(pd.card, 'action');
          const junk = isType(pd.card, 'curse') || pd.card === 'estate';
          return { type: 'SCRYING_DECIDE', discard: mine ? !isAct : !junk };
        }
      case 'university': {
        const actGain = GAIN_ORDER.find((id) => C()[id] && isType(id, 'action') && cost(state, id) <= 5 && (C()[id].potion || 0) === 0 && sup(state, id) > 0);
        return { type: 'UNIVERSITY_GAIN', card: actGain || null };
      }
      case 'familiar':
        if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' };
        return { type: 'FAMILIAR_REACT' };
      case 'golem': {
        // 順序はほぼ結果に影響しないため高コスト側を先に使う
        const first = pd.cards.slice().sort((a, b) => C()[b].cost - C()[a].cost)[0];
        return { type: 'GOLEM_ORDER', first };
      }
      case 'apprentice': {
        // 屋敷（+2カード）＞呪い（圧縮）＞最も不要な札。手札があれば必須。
        const c = p.hand.includes('estate') ? 'estate'
          : (p.hand.includes('curse') ? 'curse' : p.hand.slice().sort((a, b) => trashValue(a) - trashValue(b))[0]);
        return { type: 'APPRENTICE_TRASH', card: c };
      }

      /* ===== 繁栄（Prosperity）===== */
      case 'charlatan':
        if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' };
        return { type: 'CHARLATAN_REACT' };
      case 'rabble':
        if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' };
        return { type: 'RABBLE_REACT' };
      case 'clerk':
        if (pd.stage === 'react') {
          if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' };
          return { type: 'CLERK_REACT' };
        }
        { const c = p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b))[0]; return { type: 'CLERK_TOPDECK', card: c }; }
      case 'clerk_start':
        // 手番開始時の会計士は無料の +2コイン＋アタック＝常に使う。
        return { type: 'CLERK_START', play: true };
      case 'bishop':
        if (pd.stage === 'trash') {
          const c = p.hand.slice().sort((a, b) => trashValue(a) - trashValue(b))[0];
          return { type: 'BISHOP_TRASH', card: c };
        }
        { const junk = p.hand.find((c) => isType(c, 'curse') || c === 'estate'); return { type: 'BISHOP_OTHER', card: junk || null }; }
      case 'vault':
        if (pd.stage === 'discard') return { type: 'VAULT_DISCARD', cards: p.hand.filter((c) => isDead(c)) };
        { const dead = p.hand.filter((c) => isDead(c)); return { type: 'VAULT_OTHER', cards: dead.length >= 2 ? dead.slice(0, 2) : [] }; }
      case 'mint': {
        const tre = p.hand.filter((c) => isTreasure(c)).sort((a, b) => (C()[b].coin || 0) - (C()[a].coin || 0))[0];
        return { type: 'MINT_REVEAL', card: (tre && (C()[tre].coin || 0) >= 2) ? tre : null };
      }
      case 'expand':
        if (pd.stage === 'trash') { const c = p.hand.slice().sort((a, b) => trashValue(a) - trashValue(b))[0]; return { type: 'EXPAND_TRASH', card: c }; }
        return { type: 'EXPAND_GAIN', card: bestGain(state, pd.maxCost, { noVictory: true }) || bestGain(state, pd.maxCost) };
      case 'forge':
        if (pd.stage === 'trash') return { type: 'FORGE_TRASH', cards: p.hand.filter((c) => c === 'estate') };
        return { type: 'FORGE_GAIN', card: bestGainExact(state, pd.exact, { noVictory: true }) || bestGainExact(state, pd.exact) };
      case 'kings_court': {
        const acts = p.hand.filter((c) => isType(c, 'action'));
        const nonKc = acts.filter((c) => c !== 'kings_court').sort((a, b) => throneValue(b) - throneValue(a));
        const card = nonKc[0] || acts.slice().sort((a, b) => throneValue(b) - throneValue(a))[0];
        return { type: 'KINGS_COURT_CHOOSE', card };
      }
      case 'war_chest':
        if (pd.stage === 'name') return { type: 'WAR_CHEST_NAME', card: bestGain(state, 5, { noVictory: true }) || bestGain(state, 5) || 'curse' };
        { const named = (state.turn.warChestNamed) || []; let g = null; for (const id of GAIN_ORDER) { if (cost(state, id) <= 5 && sup(state, id) > 0 && named.indexOf(id) < 0) { g = id; break; } } return { type: 'WAR_CHEST_GAIN', card: g }; }
      case 'watchtower':
        return { type: 'WATCHTOWER', choice: (pd.card === 'curse' ? 'trash' : 'keep') };
      case 'tiara_topdeck':
        return { type: 'TIARA_TOPDECK', topdeck: false };
      case 'tiara_play': {
        const tre = p.hand.filter((c) => isTreasure(c)).sort((a, b) => (C()[b].coin || 0) - (C()[a].coin || 0))[0];
        return { type: 'TIARA_PLAY', card: tre || null };
      }
      case 'anvil':
        if (pd.stage === 'discard') return { type: 'ANVIL_DISCARD', card: p.hand.includes('copper') ? 'copper' : null };
        return { type: 'ANVIL_GAIN', card: bestGain(state, 4, { noVictory: true }) || bestGain(state, 4) };
      case 'investment':
        if (pd.stage === 'trash') { const c = p.hand.filter((x) => isTreasure(x)).sort((a, b) => (C()[a].coin || 0) - (C()[b].coin || 0))[0]; return { type: 'INVESTMENT_TRASH', card: c }; }
        return { type: 'INVESTMENT', choice: 'coin' };
      case 'crystal_ball': {
        const c = pd.card;
        let choice = 'keep';
        if (isType(c, 'curse')) choice = 'trash';
        else if (isType(c, 'victory')) choice = 'discard';
        else if (isType(c, 'action') || isType(c, 'treasure')) choice = 'play';
        return { type: 'CRYSTAL_BALL', choice };
      }

      /* ===== 拡張: 収穫祭 ===== */
      case 'hamlet': {
        const junk = p.hand.find((c) => isDead(c)); // 死に札(勝利点/呪い)を捨てて +アクション/+購入
        if (pd.stage === 'action') {
          const other = p.hand.some((c) => isType(c, 'action')); // 他にアクションがあるときだけ+アクションが活きる
          return { type: 'HAMLET_DISCARD', card: (other && junk) ? junk : null };
        }
        return { type: 'HAMLET_DISCARD', card: junk || null }; // 購入は常に有用＝死に札があれば捨てる
      }
      case 'fortune_teller':
        if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' };
        return { type: 'FORTUNE_TELLER_REACT' };
      case 'horse_traders':
        return { type: 'HORSE_TRADERS_DISCARD', cards: pickDiscards(p.hand, Math.min(2, p.hand.length)) };
      case 'remake':
        if (pd.stage === 'trash') return { type: 'REMAKE_TRASH', card: pickRemodelTrash(state, p) };
        return { type: 'REMAKE_GAIN', card: bestGainExact(state, pd.exactCost, { noVictory: true }) || bestGainExact(state, pd.exactCost) };
      case 'tournament':
        if (pd.stage === 'reveal_self') return { type: 'TOURNAMENT_REVEAL', reveal: true }; // 属州を公開して賞品を得る
        if (pd.stage === 'reveal_opp') return { type: 'TOURNAMENT_REVEAL', reveal: true };  // 相手のボーナスを打ち消す
        { // prize: 使える賞品を優先、無ければ公領
          const pref = ['trusty_steed', 'bag_of_gold', 'followers', 'diadem', 'princess'];
          let card = pref.find((id) => sup(state, id) > 0);
          if (!card && sup(state, 'duchy') > 0) card = 'duchy';
          return { type: 'TOURNAMENT_PRIZE', card };
        }
      case 'young_witch':
        if (pd.stage === 'discard') return { type: 'YOUNG_WITCH_DISCARD', cards: pickDiscards(p.hand, Math.min(2, p.hand.length)) };
        if (pd.bane && p.hand.includes(pd.bane)) return { type: 'YOUNG_WITCH_BANE' }; // 災いカードで免れる
        if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' };
        return { type: 'YOUNG_WITCH_REACT' };
      case 'jester':
        if (pd.stage === 'react') {
          if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' };
          return { type: 'JESTER_REACT' };
        }
        { // choose: 捨てられた札が良ければ自分が獲得、悪い(勝利点/呪い/銅貨)なら相手に押し付ける
          const c = pd.card;
          const bad = isType(c, 'victory') || isType(c, 'curse') || c === 'copper';
          return { type: 'JESTER_CHOOSE', who: bad ? 'victim' : 'me' };
        }
      case 'followers':
        if (pd.stage === 'react') {
          if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' };
          return { type: 'FOLLOWERS_REACT' };
        }
        return { type: 'FOLLOWERS_DISCARD', cards: pickDiscards(p.hand, p.hand.length - 3) };
      case 'trusty_steed':
        // 常に +2カードを軸に、他にアクションがあれば +2アクション、無ければ +2コイン
        return { type: 'TRUSTY_STEED_RESOLVE', choices: ['cards', p.hand.some((c) => isType(c, 'action')) ? 'actions' : 'coins'] };
      case 'horn_of_plenty':
        return { type: 'HORN_OF_PLENTY_GAIN', card: bestGain(state, pd.maxCost, { noVictory: true }) || bestGain(state, pd.maxCost) };

      /* ===== 拡張: ギルド（Guilds）===== */
      case 'overpay': {
        // いくら過払いするか。名品＝銀貨レートが良いので全額／石工＝2枚とれる最大コスト／伝令官＝捨て札の良札分／医者＝しない。
        const card = pd.card, max = pd.max;
        let amt = 0;
        if (card === 'masterpiece') amt = max; // 過払い1コイン→銀貨1枚は好レート。全額。
        else if (card === 'stonemason') {
          for (let x = max; x >= 1; x--) {
            if (Object.keys(state.supply).some((id) => C()[id] && isType(id, 'action') && !isType(id, 'victory') &&
                !PRIZE_SET.has(id) && cost(state, id) === x && sup(state, id) > 0)) { amt = x; break; }
          }
        } else if (card === 'herald') {
          const good = p.discard.filter((c) => keepValue(c) >= 60).length; // 良い札を山札の上へ
          amt = Math.min(max, good, 2);
        } // doctor は過払いしない（安全側＝amt=0）
        return { type: 'OVERPAY_RESOLVE', amount: amt };
      }
      case 'stonemason_overpay': {
        let g = null;
        for (const id of GAIN_ORDER) {
          if (C()[id] && isType(id, 'action') && !PRIZE_SET.has(id) && cost(state, id) === pd.exact && sup(state, id) > 0) { g = id; break; }
        }
        return { type: 'STONEMASON_OVERPAY_GAIN', card: g };
      }
      case 'doctor_overpay': {
        const c = pd.card;
        let choice = 'topdeck';
        if (isType(c, 'curse')) choice = 'trash';
        else if (isType(c, 'victory')) choice = 'discard'; // 勝利点は引きたくない→山札から除く
        else if (c === 'copper' && allCards(p).filter((x) => isTreasure(x)).length >= 8) choice = 'trash';
        return { type: 'DOCTOR_OVERPAY', choice };
      }
      case 'herald_overpay': {
        const best = p.discard.slice().sort((a, b) => keepValue(b) - keepValue(a))[0];
        return { type: 'HERALD_OVERPAY', card: best };
      }
      case 'stonemason':
        if (pd.stage === 'trash') {
          // 銅貨/呪いを廃棄（コスト0＝獲得なしの純圧縮）。無ければ最も不要な札。
          const c = p.hand.includes('copper') ? 'copper' : (p.hand.includes('curse') ? 'curse' : pickTrash(p.hand, 1)[0]);
          return { type: 'STONEMASON_TRASH', card: c };
        }
        return { type: 'STONEMASON_GAIN', card: bestGain(state, pd.maxCost - 1, { noVictory: true }) || bestGain(state, pd.maxCost - 1) };
      case 'doctor':
        if (pd.stage === 'name') {
          const named = owned(p, 'curse') > 0 ? 'curse' : (owned(p, 'estate') > 0 ? 'estate' : 'copper');
          return { type: 'DOCTOR_NAME', card: named };
        }
        { const order = pd.cards.slice().sort((a, b) => keepValue(b) - keepValue(a)); return { type: 'DOCTOR_ORDER', order }; }
      case 'advisor': {
        // 自分は左隣＝相手(source)の公開札から1枚を捨てさせる。相手に最も価値の高い札を捨てさせて損させる。
        const worstForOpp = pd.cards.slice().sort((a, b) => keepValue(b) - keepValue(a))[0];
        return { type: 'ADVISOR_CHOOSE', card: worstForOpp };
      }
      case 'plaza': {
        // 銅貨があれば捨てて +1財源（銀貨/金貨は捨てない）。
        const tre = p.hand.filter((c) => isTreasure(c)).sort((a, b) => (C()[a].coin || 0) - (C()[b].coin || 0))[0];
        return { type: 'PLAZA_DISCARD', card: tre === 'copper' ? 'copper' : null };
      }
      case 'taxman':
        if (pd.stage === 'react') { if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' }; return { type: 'TAXMAN_REACT' }; }
        if (pd.stage === 'trash') {
          if (p.hand.includes('copper') && sup(state, 'silver') > 0) return { type: 'TAXMAN_TRASH', card: 'copper' }; // 銅貨→銀貨（圧縮＋テンポ）
          if (p.hand.includes('silver') && sup(state, 'gold') > 0) return { type: 'TAXMAN_TRASH', card: 'silver' };  // 銀貨→金貨
          const tre = p.hand.filter((c) => isTreasure(c)).sort((a, b) => (C()[a].coin || 0) - (C()[b].coin || 0))[0];
          return { type: 'TAXMAN_TRASH', card: tre || null };
        }
        return { type: 'TAXMAN_GAIN', card: bestGain(state, pd.maxCost, { treasureOnly: true }) };
      case 'butcher':
        if (pd.stage === 'trash') {
          const junk = p.hand.includes('curse') ? 'curse' : (p.hand.includes('estate') ? 'estate' : (p.hand.includes('copper') ? 'copper' : null));
          return { type: 'BUTCHER_TRASH', card: junk };
        }
        if (pd.stage === 'pay') {
          const coffers = p.coffers || 0;
          const total = pd.trashedCost + coffers;
          const target = bestGain(state, total, { noVictory: true }) || bestGain(state, total);
          const need = target ? Math.max(0, cost(state, target) - pd.trashedCost) : 0;
          return { type: 'BUTCHER_PAY', amount: Math.min(coffers, need) };
        }
        return { type: 'BUTCHER_GAIN', card: bestGain(state, pd.maxCost, { noVictory: true }) || bestGain(state, pd.maxCost) };
      case 'journeyman': {
        const named = owned(p, 'curse') > 0 ? 'curse' : (owned(p, 'estate') > 0 ? 'estate' : (owned(p, 'copper') > 0 ? 'copper' : mostLikelyTop(p)));
        return { type: 'JOURNEYMAN_NAME', card: named };
      }
      case 'soothsayer':
        if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' };
        return { type: 'SOOTHSAYER_REACT' };

      /* ===== 拡張: 異郷（Hinterlands）===== */
      case 'oasis':
        return { type: 'OASIS_RESOLVE', card: pickDiscards(p.hand, 1)[0] };
      case 'duchess_look': {
        const look = p.deck[0] || p.discard[0];
        return { type: 'DUCHESS_LOOK', discard: !!look && (isType(look, 'victory') || isType(look, 'curse')) };
      }
      case 'develop':
        if (pd.stage === 'trash') return { type: 'DEVELOP_TRASH', card: pickRemodelTrash(state, p) };
        {
          const pickFor = (c) => bestGainExact(state, c, { noVictory: true }) || bestGainExact(state, c);
          if (!pd.hiDone && pickFor(pd.hi)) return { type: 'DEVELOP_GAIN', card: pickFor(pd.hi) };
          if (!pd.loDone && pickFor(pd.lo)) return { type: 'DEVELOP_GAIN', card: pickFor(pd.lo) };
          return { type: 'DEVELOP_GAIN', card: null };
        }
      case 'oracle':
        if (pd.stage === 'react') { if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' }; return { type: 'ORACLE_REACT' }; }
        {
          const good = (pd.cards || []).some((c) => isTreasure(c) || isType(c, 'action'));
          const mine = pd.victim === pd.source;
          return { type: 'ORACLE_DECIDE', discard: mine ? !good : good, order: (pd.cards || []).slice() };
        }
      case 'jack':
        if (pd.stage === 'look') { const top = p.deck[0]; return { type: 'JACK_LOOK', discard: !!top && (isType(top, 'victory') || isType(top, 'curse')) }; }
        { const junk = p.hand.find((c) => !isTreasure(c) && (isType(c, 'curse') || c === 'estate')); return { type: 'JACK_TRASH', card: junk || null }; }
      case 'noble_brigand':
        if (pd.stage === 'react') { if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' }; return { type: 'NOBLE_BRIGAND_REACT' }; }
        return { type: 'NOBLE_BRIGAND_PICK', card: (pd.revealed || []).includes('gold') ? 'gold' : 'silver' };
      case 'spice_merchant':
        if (pd.stage === 'trash') return { type: 'SPICE_MERCHANT_TRASH', card: p.hand.includes('copper') ? 'copper' : null };
        return { type: 'SPICE_MERCHANT_CHOOSE', choice: p.hand.some((c) => isType(c, 'action')) ? 'cards' : 'coins' };
      case 'trader':
        return { type: 'TRADER_TRASH', card: pickRemodelTrash(state, p) };
      case 'trader_react': {
        const c = pd.card;
        const worse = isType(c, 'curse') || c === 'copper' || c === 'estate' || (!isType(c, 'victory') && !isTreasure(c) && cost(state, c) < 3);
        return { type: 'TRADER_REACT', reveal: !!worse };
      }
      case 'cartographer': {
        const discard = (pd.cards || []).filter((c) => isDead(c));
        const top = (pd.cards || []).filter((c) => !isDead(c)).sort((a, b) => keepValue(b) - keepValue(a));
        return { type: 'CARTOGRAPHER_RESOLVE', discard, top };
      }
      case 'embassy':
        return { type: 'EMBASSY_DISCARD', cards: pickDiscards(p.hand, Math.min(3, p.hand.length)) };
      case 'inn':
        return { type: 'INN_DISCARD', cards: pickDiscards(p.hand, Math.min(2, p.hand.length)) };
      case 'inn_gain':
        return { type: 'INN_GAIN', cards: p.discard.filter((c) => isType(c, 'action')) };
      case 'mandarin':
        return { type: 'MANDARIN_TOPDECK', card: p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b))[0] };
      case 'margrave':
        if (pd.stage === 'react') { if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' }; return { type: 'MARGRAVE_REACT' }; }
        return { type: 'MARGRAVE_DISCARD', cards: pickDiscards(p.hand, Math.max(0, p.hand.length - 3)) };
      case 'stables':
        return { type: 'STABLES_DISCARD', card: p.hand.includes('copper') ? 'copper' : null };
      case 'border_village':
        return { type: 'BORDER_VILLAGE_GAIN', card: bestGain(state, pd.maxCost, { noVictory: true }) || bestGain(state, pd.maxCost) };
      case 'weaver':
        if (pd.stage === 'gain') return { type: 'WEAVER_GAIN', card: bestGain(state, 4, { noVictory: true }) || bestGain(state, 4) };
        return { type: 'WEAVER_MODE', mode: 'silver' }; // 銀貨2枚が堅実
      case 'souk_trash':
        return { type: 'SOUK_TRASH', cards: p.hand.filter((c) => isType(c, 'curse') || c === 'estate').slice(0, 2) };
      case 'berserker':
        if (pd.stage === 'react') { if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' }; return { type: 'BERSERKER_REACT' }; }
        if (pd.stage === 'discard') return { type: 'BERSERKER_DISCARD', cards: pickDiscards(p.hand, Math.max(0, p.hand.length - 3)) };
        return { type: 'BERSERKER_GAIN', card: bestGain(state, pd.maxCost, { noVictory: true }) || bestGain(state, pd.maxCost) };
      case 'wheelwright':
        if (pd.stage === 'discard') return { type: 'WHEELWRIGHT_DISCARD', card: p.hand.includes('estate') ? 'estate' : null };
        { const g = GAIN_ORDER.find((id) => C()[id] && isType(id, 'action') && !PRIZE_SET.has(id) && cost(state, id) <= pd.maxCost && sup(state, id) > 0); return { type: 'WHEELWRIGHT_GAIN', card: g || null }; }
      case 'witchs_hut': {
        if (pd.stage === 'react') { if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' }; return { type: 'WITCHS_HUT_REACT' }; }
        const acts = p.hand.filter((c) => isType(c, 'action')).sort((a, b) => cost(state, a) - cost(state, b));
        const cards = acts.length >= 2 ? acts.slice(0, 2) : pickDiscards(p.hand, Math.min(2, p.hand.length));
        return { type: 'WITCHS_HUT_DISCARD', cards };
      }
      case 'cauldron':
        if (p.hand.includes('moat')) return { type: 'MOAT_REVEAL' };
        return { type: 'CAULDRON_REACT' };
      case 'duchess_gain':
        return { type: 'DUCHESS_GAIN', gain: false }; // デッキを濁さないため受け取らない
      case 'farmland':
        if (pd.stage === 'trash') return { type: 'FARMLAND_TRASH', card: pickRemodelTrash(state, p) };
        return { type: 'FARMLAND_GAIN', card: bestGainExact(state, pd.exactCost, { noVictory: true }) || bestGainExact(state, pd.exactCost) };
      case 'haggler':
        // 兄弟(border_village/weaver/berserker/farmland)と同じく curse を含むフォールバックを持つ
        // （engine の canGain は非勝利点＝呪いを許可＝必須獲得。noVictory だけだと呪いのみの局面で null→無限ループ）。
        return { type: 'HAGGLER_GAIN', card: bestGain(state, pd.maxCost, { noVictory: true }) || bestGain(state, pd.maxCost) };
      case 'fools_gold_react':
        return { type: 'FOOLS_GOLD_REACT', trash: true };
      case 'igg_play':
        return { type: 'IGG_PLAY', gain: false };
      case 'scheme_cleanup': {
        const acts = p.inPlay.filter((c) => isType(c, 'action') && !isType(c, 'duration')).sort((a, b) => throneValue(b) - throneValue(a)).slice(0, pd.max || 0);
        return { type: 'SCHEME_CLEANUP', cards: acts };
      }

      default:
        return { type: 'END_TURN' };
    }
  }

  /* ---------- 公開API ---------- */
  function decide(state) {
    const ctrl = DOM.engine.actor(state); // 操作する人（支配中は支配者＝この CPU）
    if (state.pending) {
      // 決定の対象＝カードを持つ人（pending.player）。支配中の被支配者の選択も、判断材料は
      // その対象の手札/山札なので pending.player の player を渡す（操作者は ctrl だが中身は対象）。
      return decidePending(state, state.pending, state.players[state.pending.player]);
    }
    const t = state.turn;
    const subj = state.players[t.active]; // 手番の主体（支配中は被支配者）の手札を操作する
    if (t.phase === 'action') {
      const a = chooseAction(state, subj);
      return a ? { type: 'PLAY_ACTION', card: a } : { type: 'END_ACTION_PHASE' };
    }
    // 購入フェーズ（支配中は被支配者の手札の財宝を出し、獲得は支配者が受け取る）
    if (subj.hand.some((c) => isTreasure(c))) return { type: 'PLAY_ALL_TREASURES' };
    const level = (state.players[ctrl] && state.players[ctrl].cpuLevel) || 'normal';
    // ギルド：財源(Coffers)を使うか判断。財宝を出し切ったあと、財源を足すとより良い買いになるなら最小枚数だけ使う。
    const spend = coffersToSpend(state, subj, level);
    if (spend > 0) return { type: 'COFFERS_SPEND', amount: spend };
    const b = chooseBuy(state, subj, level);
    return b ? { type: 'BUY', card: b } : { type: 'END_TURN' };
  }
  // 財源を何枚使うか：現状の最善買いより価値の高い買いに届く最小の財源枚数を返す（届かなければ0＝温存）。
  function coffersToSpend(state, p, level) {
    const coffers = p.coffers || 0;
    if (coffers <= 0 || state.turn.buys <= 0) return 0;
    const buyValue = (id) => id ? ((C()[id].vp || 0) * 100 + cost(state, id) * 2 + (isTreasure(id) ? 1 : 0)) : -1;
    const saved = state.turn.coins;
    let baseVal;
    try {
      baseVal = buyValue(chooseBuy(state, p, level));
      let bestSpend = 0, bestVal = baseVal;
      for (let s = 1; s <= coffers; s++) {
        state.turn.coins = saved + s;
        const v = buyValue(chooseBuy(state, p, level));
        if (v > bestVal) { bestVal = v; bestSpend = s; } // より価値の高い買いに届く最小額を採用
      }
      return bestSpend;
    } finally { state.turn.coins = saved; } // 判定用の一時変更は必ず戻す（chooseBuy は読み取り専用）
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
