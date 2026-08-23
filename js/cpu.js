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

  // 所有カード（全ゾーン）＝**engine の allCards をそのまま呼ぶ**。
  //   ここで同じゾーン列挙を手書きすると、新しいゾーン（追放マット/相続の脇/貨物船/遅延・刈り入れの脇）を
  //   足すたびに片方が漏れ、hard CPU の終局読みが engine の得点とずれる（＝勝てる終局を見送る／負ける終局を選ぶ）。
  //   engine 未ロード時のフォールバックだけ残す（テストが cpu.js 単体を読む場合の保険）。
  function allCards(p) {
    if (DOM.engine && DOM.engine.allCards) return DOM.engine.allCards(p);
    return [].concat(p.deck, p.hand, p.discard, p.inPlay, p.durationCards || [], p.setAside || [],
      p.islandMat || [], p.nativeVillageMat || [], p.princes || [], p.tavern || [],
      p.inherited || [], p.exile || [], p.cargo || [], p.eventSetAside || [],
      ...((p.archives || []).map((a) => a.cards || [])));
  }
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
  const GAIN_ORDER = ['colony', 'platinum', 'province', 'gold', 'artisan', 'nobles', 'harem', 'duchy', 'marchland',
    'adventurer', 'laboratory', 'ferryman', 'explorer', 'carnival', 'festival', 'witch', 'mountebank', 'sea_hag', 'bandit', 'governor', 'captain', 'council_room', 'patrol', 'avanto', 'library', 'market', 'joust', 'navigator', 'minion', 'mine', 'sentry', 'prince', 'courtier', 'replace', 'ironworks', 'bridge', 'conspirator', 'torturer', 'swindler', 'saboteur', 'spy', 'thief', 'upgrade', 'bureaucrat', 'feast', 'stash', 'silver',
    'sauna', 'poacher', 'mining_village', 'smithy', 'ghost_ship', 'mill', 'walled_village', 'dismantle', 'envoy', 'secret_passage', 'diplomat', 'courtyard', 'masquerade', 'ambassador', 'throne_room', 'great_hall', 'tribute', 'militia', 'pirate_ship', 'footpad', 'steward', 'church', 'trading_post', 'baron', 'scout',
    'remodel', 'royal_seal', 'talisman', 'moneylender', 'merchant', 'harbinger', 'vassal', 'village', 'farrier', 'farmhands', 'shop', 'pearl_diver', 'shanty_town', 'wishing_well', 'woodcutter', 'workshop', 'coppersmith', 'chancellor', 'black_market', 'hoard',
    // 海辺（第二版）＝強さ/コストの目安順。CPUの購入優先度（サプライにある時だけ効く）。
    'wharf', 'sea_witch', 'bazaar', 'corsair', 'blockade', 'treasury', 'island', 'merchant_ship', 'fishing_village',
    'tactician', 'caravan', 'monkey', 'warehouse', 'salvager', 'cutpurse', 'sailor', 'outpost', 'lighthouse',
    'tide_pools', 'lookout', 'sea_chart', 'smugglers', 'native_village', 'haven', 'astrolabe', 'pirate', 'treasure_map',
    // 錬金術13種＝カード画像用カタログ。孤立プールで実サプライに出ないため並び順はCPU挙動に無影響
    //（整合性テストの「GAIN_ORDER=全カード」を満たすためだけ）。
    'potion', 'transmute', 'vineyard', 'herbalist', 'apothecary', 'scrying_pool', 'university',
    'alchemist', 'familiar', 'philosophers_stone', 'golem', 'apprentice', 'possession',
    // 繁栄（第二版）王国カード25種＝強さ/コストの目安順。供給があるときだけ効く。
    'kings_court', 'grand_market', 'goons', 'bank', 'venture', 'contraband', 'expand', 'forge', 'peddler', 'city', 'vault', 'rabble',
    'magnate', 'mint', 'collection', 'crystal_ball', 'charlatan', 'war_chest', 'bishop',
    'monument', 'workers_village', 'watchtower', 'tiara', 'quarry', 'investment', 'anvil', 'clerk',
    // ギルド（実プレイ＝段階2）＝強さ/コストの目安順。供給があるときだけ効く（bestEngineBuy/bestGain が参照）。
    'soothsayer', 'taxman', 'butcher', 'merchant_guild', 'journeyman', 'baker', 'herald', 'advisor', 'plaza', 'doctor', 'candlestick_maker', 'stonemason', 'masterpiece',
    // ルネサンス（実プレイ＝段階2）＝強さ/コストの目安順。供給があるときだけ効く（bestEngineBuy/bestGain が参照）。
    'old_witch', 'scholar', 'swashbuckler', 'recruiter', 'treasurer', 'seer', 'sculptor', 'villain', 'scepter', 'spices',
    'research', 'silk_merchant', 'patron', 'priest', 'inventor', 'mountain_village', 'hideout', 'flag_bearer',
    'cargo_ship', 'improve', 'experiment', 'acting_troupe', 'lackeys', 'ducat', 'border_guard',
    // 移動動物園（実プレイ＝段階2）＝強さ/コストの目安順。供給があるときだけ効く（bestEngineBuy/bestGain が参照）。
    'animal_fair', 'wayfarer', 'destrier',
    'mastermind', 'barge', 'coven', 'gatekeeper', 'livery', 'paddock', 'hunting_lodge', 'displace', 'falconer', 'sanctuary', 'fisherman', 'kiln',
    'cavalry', 'village_green', 'groom', 'hostelry', 'cardinal', 'bounty_hunter',
    'snowy_village', 'sheepdog', 'scrap', 'goatherd', 'camel_train', 'stockpile',
    'black_cat', 'sleigh', 'supplies',
    /* 同盟（実プレイ＝段階2＝A5 で昇格）＝強さ/コストの目安順。供給があるときだけ効く（bestEngineBuy/bestGain が参照）。
       ⚠ **分割山6組は「山キー」だけが実際に獲得される**（中身24種はその山の一番上のときだけ手に入る）。
         山キーのコストは `cardCost` が今の一番上を返すので、掘り進むと自動で高コスト帯へ移る。
       ⚠ 中身24種もここに置く必要がある（整合性テストの「GAIN_ORDER＝全カード」）。山キーの後ろにまとめる。 */
    'marquis', 'barbarian', 'highwayman', 'skirmisher', 'guildmaster', 'galleria', 'emissary',
    'capital_city', 'hunter', 'specialist', 'modify', 'swap', 'contract',
    'innkeeper', 'royal_galley', 'broker', 'town', 'carpenter', 'courier',
    'wizards', 'clashes', 'odysseys', 'augurs', 'forts', 'townsfolk',
    'underling', 'merchant_camp', 'sentinel', 'importer', 'bauble', 'sycophant',
    // 分割山の中身（山の一番上のときだけ獲得できる）＝同コスト帯での相対順
    'lich', 'territory', 'sibyl', 'distant_shore', 'stronghold',
    'warlord', 'sorcerer', 'sorceress', 'elder', 'hill_fort', 'sunken_treasure',
    'garrison', 'miller', 'conjurer', 'archer', 'voyage', 'acolyte',
    'blacksmith', 'student', 'old_map', 'tent', 'herb_gatherer', 'battle_plan', 'town_crier',
    /* 略奪（実プレイ＝段階2＝P7 で昇格）＝強さ/コストの目安順。供給があるときだけ効く（bestEngineBuy/bestGain が参照）。 */
    'kings_cache', 'sack_of_loot', 'wealthy_village', 'pilgrim', 'crew', 'cutthroat', 'frigate', 'first_mate',
    /* 旭日（R7で実強度順へ移動）＝村＋ドロー＋アタック。
       米(rice)は場の種別数で伸びる財宝／侍(samurai)は永続 +$1＋1回アタック／大名(daimyo)は再演。 */
    'rice', 'samurai', 'rice_broker', 'litter', 'tanuki', 'kitsune', 'tea_house', 'ronin', 'imperial_envoy',
    'gold_mine', 'ninja', 'poet', 'rustic_village', 'river_shrine', 'change', 'alley', 'daimyo',
    'craftsman', 'riverboat', 'aristocrat', 'root_cellar', 'artist', 'mountain_shrine', 'snake_witch', 'fishmonger',
    'quartermaster', 'mining_road', 'trickster', 'silver_mine', 'pickaxe', 'pendant', 'enlarge', 'figurine',
    'longship', 'buried_treasure', 'harbor_village', 'landing_party', 'flagship', 'abundance', 'cabin_boy',
    'crucible', 'fortune_hunter', 'gondola', 'mapmaker', 'swamp_shacks', 'tools', 'rope', 'maroon',
    'taskmaster', 'secluded_shrine', 'siren', 'stowaway', 'shaman', 'search', 'jewelled_egg', 'grotto', 'cage',
    'pawn', 'lurker', 'moat', 'embargo', 'loan', 'trade_route', 'counting_house', 'infirmary', 'secret_chamber', 'chapel', 'cellar', 'gardens', 'estate', 'duke',
    // 追加拡張（収穫祭/異郷/暗黒時代）＝孤立プールで実サプライに出ないため並び順はCPU挙動に無影響
    // （新プロモ6種は実プレイ化済み＝上の実強度順の位置に配置済み）
    'hamlet', 'fortune_teller', 'menagerie', 'farming_village', 'horse_traders', 'remake', 'tournament', 'young_witch', 'harvest', 'horn_of_plenty', 'hunting_party', 'jester', 'fairgrounds', 'bag_of_gold', 'diadem', 'followers', 'princess', 'trusty_steed', 'crossroads', 'duchess', 'fools_gold', 'develop', 'oasis', 'oracle', 'scheme', 'tunnel', 'jack_of_all_trades', 'noble_brigand', 'nomad_camp', 'silk_road', 'spice_merchant', 'trader', 'cache', 'cartographer', 'embassy', 'haggler', 'highway', 'ill_gotten_gains', 'inn', 'mandarin', 'margrave', 'stables', 'border_village', 'farmland', 'nomads', 'trail', 'weaver', 'souk', 'cauldron', 'guard_dog', 'berserker', 'wheelwright', 'witchs_hut', 'poor_house', 'squire', 'vagrant', 'beggar', 'hermit', 'sage', 'forager', 'storeroom', 'urchin', 'market_square', 'ironmonger', 'wandering_minstrel', 'procession', 'scavenger', 'fortress', 'rats', 'armory', 'death_cart', 'marauder', 'feodum',
    // 段階1追加（暗黒時代残り。CARD_SETS 未参照＝実際には獲得されないが GAIN_ORDER=全カードの整合性を満たす）
    'junk_dealer', 'bandit_camp', 'rebuild', 'catacombs', 'graverobber', 'count', 'band_of_misfits', 'mystic', 'rogue', 'pillage', 'cultist', 'counterfeit', 'hunting_grounds', 'altar', 'knights', 'dame_anna', 'dame_josephine', 'dame_molly', 'dame_natalie', 'dame_sylvia', 'sir_bailey', 'sir_destry', 'sir_martin', 'sir_michael', 'sir_vander', 'abandoned_mine', 'ruined_library', 'ruined_market', 'ruined_village', 'survivors', 'hovel', 'necropolis', 'overgrown_estate', 'spoils', 'madman', 'mercenary',
    // 段階1追加（冒険＋帝国。CARD_SETS 未参照＝実際には獲得されないが GAIN_ORDER=全カードの整合性を満たす）
    'coin_of_the_realm', 'page', 'peasant', 'ratcatcher', 'raze', 'amulet', 'caravan_guard', 'dungeon', 'gear', 'guide', 'duplicate', 'magpie', 'messenger', 'miser', 'port', 'ranger', 'transmogrify', 'artificer', 'bridge_troll', 'distant_lands', 'giant', 'haunted_woods', 'lost_city', 'relic', 'royal_carriage', 'storyteller', 'swamp_hag', 'treasure_trove', 'wine_merchant', 'hireling', 'treasure_hunter', 'warrior', 'hero', 'champion', 'soldier', 'fugitive', 'disciple', 'teacher',
    'engineer', 'city_quarter', 'overlord', 'royal_blacksmith', 'farmers_market', 'chariot_race', 'enchantress', 'sacrifice', 'temple', 'villa', 'archive', 'capital', 'charm', 'forum', 'groundskeeper', 'legionary', 'wild_hunt', 'crown', 'encampment', 'plunder', 'patrician', 'emporium', 'settlers', 'bustling_village', 'catapult', 'rocks', 'gladiator', 'fortune', 'castles', 'humble_castle', 'crumbling_castle', 'small_castle', 'haunted_castle', 'opulent_castle', 'sprawling_castle', 'grand_castle', 'kings_castle',
    // 移動動物園：馬＝非サプライ（「馬を獲得する」効果でのみ得る）＝汎用獲得は選ばない（NON_SUPPLY_SET）。
    'horse',
    // 段階1追加（夜想曲。CARD_SETS 未参照＝実際には獲得されないが GAIN_ORDER=全カードの整合性を満たす）
    'bard', 'blessed_village', 'cemetery', 'changeling', 'cobbler', 'conclave', 'crypt', 'cursed_village', 'den_of_sin', 'devils_workshop', 'druid', 'exorcist', 'faithful_hound', 'fool', 'ghost_town', 'guardian', 'idol', 'leprechaun', 'monastery', 'necromancer', 'night_watchman', 'pixie', 'pooka', 'raider', 'sacred_grove', 'secret_cave', 'shepherd', 'skulk', 'tormentor', 'tracker', 'tragic_hero', 'vampire', 'werewolf',
    'cursed_gold', 'goat', 'haunted_mirror', 'lucky_coin', 'magic_lamp', 'pasture', 'pouch', 'will_o_wisp', 'imp', 'ghost', 'wish', 'bat', 'zombie_apprentice', 'zombie_mason', 'zombie_spy',
    // 戦利品(Loot)15種＝非サプライ（NON_SUPPLY_SET）＝汎用獲得の候補にならない（GAIN_ORDER=全カードの整合性のためだけ）。
    'amphora', 'doubloons', 'endless_chalice', 'figurehead', 'hammer', 'insignia', 'jewels', 'orb', 'prize_goat', 'puzzle_box',
    'sextant', 'shield', 'spell_scroll', 'staff', 'sword',
    // 褒賞6種＝非サプライ（NON_SUPPLY_SET）＝末尾のままでよい
    'coronet', 'courser', 'demesne', 'housecarl', 'huge_turnip', 'renown',
    'copper', 'curse'];
  /* 旭日：影(Shadow)は**山札のどこにあっても手札と同じように使える**＝「手札から使わせる」窓（群A）の
     候補は engine の handPlayable（手札＋山札の影札）と同じ集合を見る。
     ⚠ **群B（手札から捨てる／廃棄する／脇に置く／山に戻す窓）には使わない**（影札は手札ではない）。
     ⚠ engine が受理する集合より狭いのは安全（CPU が影を使わないだけ）だが、**広いと engine拒否×CPU提案の
        本番 livelock になる**ので必ず engine の述語を呼ぶこと。 */
  const playPool = (state, pi) => (DOM.engine.handPlayable ? DOM.engine.handPlayable(state, pi) : (state.players[pi].hand || []));
  /* 同盟：女魔導士／魔導士の「カード名を宣言する」＝自分の山札の一番上として**一番ありそうな名前**を推定する
     （山札が空なら捨て札から。どちらも空なら銅貨）。**null を返さない**（engine が拒否すると livelock）。 */
  function mostLikelyTop(p) {
    const pool = (p.deck && p.deck.length) ? p.deck : (p.discard || []);
    const cnt = {};
    pool.forEach((c) => { cnt[c] = (cnt[c] || 0) + 1; });
    let best = null, n = -1;
    Object.keys(cnt).forEach((c) => { if (cnt[c] > n) { n = cnt[c]; best = c; } });
    return best || 'copper';
  }
  // 収穫祭：賞品(Prize)は馬上槍試合でのみ獲得する非サプライ札＝汎用の獲得効果(bestGain/bestGainExact)は
  // 絶対に賞品を選ばない（豊穣の角等で$0賞品を不正獲得しない／賞品を拒否する reducer と噛み合って無限ループしない）。
  const PRIZE_SET = new Set(['bag_of_gold', 'diadem', 'followers', 'princess', 'trusty_steed']);
  // 暗黒時代：略奪品/狂人/傭兵も非サプライ＝汎用獲得(bestGain等)や獲得系pendingから除外する
  //（engine の NON_SUPPLY 拒否と噛み合い、提案し続けて無限ループするのを防ぐ）。
  // 冒険：トラベラーの成長先8種も非サプライ（page/peasant の交換でのみ得る）＝汎用獲得や獲得系pendingから除外。
  // 移動動物園：馬（horse）も非サプライ＝「馬を獲得する」効果でのみ得る（購入も汎用獲得もできない）。
  // 夜想曲：精霊3種/願い/コウモリ＝非サプライ山、家宝7種/ゾンビ3種＝山そのものが無い。いずれも汎用獲得の対象外。
  const NON_SUPPLY_SET = new Set([...PRIZE_SET, 'spoils', 'madman', 'mercenary',
    'coronet', 'courser', 'demesne', 'housecarl', 'huge_turnip', 'renown', // 収穫祭＆ギルド第2版：褒賞(Reward)＝engine の REWARDS と同じ集合
    'treasure_hunter', 'warrior', 'hero', 'champion', 'soldier', 'fugitive', 'disciple', 'teacher', 'horse',
    'will_o_wisp', 'imp', 'ghost', 'wish', 'bat',
    'cursed_gold', 'goat', 'haunted_mirror', 'lucky_coin', 'magic_lamp', 'pasture', 'pouch',
    'zombie_apprentice', 'zombie_mason', 'zombie_spy',
    // 略奪：戦利品(Loot) 15種＝非サプライ（「戦利品を獲得する」効果でのみ得る）。engine の NON_SUPPLY と同じ集合。
    ...((DOM.POOLS && DOM.POOLS.loot) || [])]);

  /* アタックの反応窓で「無効化して免れる」札を手札から出す共通述語（engine の hasReaction と対になる）。
     堀(moat)と**盾(shield・略奪の戦利品)は完全に同型**（公式FAQ逐語＝`exactly as with Moat.`）＝
     どちらも公開するだけで免疫になり、手札に残る。**新しい同型の札を足したらここに1行足すだけ**で
     51箇所のアタック分岐が一斉に追従する。 */
  function immuneReveal(p) {
    if (p.hand.indexOf('moat') >= 0) return { type: 'MOAT_REVEAL' };
    if (p.hand.indexOf('shield') >= 0) return { type: 'SHIELD_REVEAL' };
    return null;
  }
  // 新プロモ/帝国：2段分割山＝上段が残る間は下段を獲得できない（同盟の循環で上下が入れ替わることもある）。
  // **述語は engine の splitLocked が正本**（engine の gain/canBuyCard 拒否と必ず一致させる
  //  ＝提案すると強制獲得と噛み合って無限ループする）。
  function splitBlocked(state, id) {
    if (DOM.engine && DOM.engine.splitLocked) return DOM.engine.splitLocked(state, id);
    const top = (DOM.SPLIT_PILES || {})[id]; return !!(top && sup(state, top) > 0);
  }

  /* ---------- mix-all 硬化：獲得の述語は **engine の正本をそのまま呼ぶ** ----------
     engine が拒否する札を CPU が提案し続けると pending が閉じず無限ループ（本番 livelock）になる。
     コスト比較は coin/potion/debt の成分別（$4+P は "up to $4" でない／$0+負債8 は "exactly $0" でない）。
     spec = { pot, debt }（省略時 0）＝廃棄/購入した札のポーション・負債成分を引き継ぐときに渡す。 */
  /* 「サプライから獲得/廃棄するカードの種別」＝混合山（廃墟/騎士/城/同盟の分割山）は**一番上の実カード**で判定する。
     **engine の isTypeSupply が正本**（engine が拒否する札を CPU が提案し続けると本番 livelock になる）。
     ※手札/場のカードの種別判定は従来どおり `isType`（山ではないので解決不要）。 */
  const isTypeSup = (state, id, ty) => (DOM.engine.isTypeSupply ? DOM.engine.isTypeSupply(state, id, ty) : DOM.isType(id, ty));
  const gainableBase = (state, id) => DOM.engine.gainableBase(state, id);
  const costUpTo = (state, id, coin, spec) => DOM.engine.costUpTo(state, id, coin, spec);
  const costUnder = (state, id, coin, spec) => DOM.engine.costUnder(state, id, coin, spec);
  const costExact = (state, id, coin, pot, debt) => DOM.engine.costExact(state, id, coin, pot, debt);
  // GAIN_ORDER（強さ順）→ supply の順で pred を満たす獲得可能札を返す（候補があるのに null を返さない＝終端保証）。
  function firstGainable(state, pred) {
    for (const id of GAIN_ORDER) { if (gainableBase(state, id) && pred(id)) return id; }
    for (const id of Object.keys(state.supply)) { if (gainableBase(state, id) && pred(id)) return id; }
    return null;
  }
  const notVictory = (id) => !(isType(id, 'victory') || isType(id, 'curse'));
  // 「今この状態で財宝か」＝engine の正本（ルネサンス：資本主義で「+$」を持つアクションも財宝）。
  //   静的 isType('treasure') のままだと engine の受理（isTreasureFor）と食い違い、収税吏等で無限ループする。
  const isTreasureNow = (state, id) => (DOM.engine && DOM.engine.isTreasureFor)
    ? DOM.engine.isTreasureFor(state, id) : isTreasure(id);
  // 「コスト$N以下」の最善獲得。opts = { treasureOnly, noVictory, pot, debt }
  /* 移動動物園：このアクションを「習性」で使うか（使わないなら null）。engine の isUsableWay と同じ集合を見る。 */
  function chooseWay(state, p, card) {
    const ways = state.ways || [];
    if (!ways.length) return null;
    const t = state.turn;
    const txt = (C()[card] && C()[card].text) || '';
    const givesAction = /\+\s*\d+\s*アクション/.test(txt);
    const givesCards = /\+\s*\d+\s*カード/.test(txt);
    const otherActions = p.hand.filter((c) => c !== card && DOM.isType(c, 'action')).length;
    // ターミナル（+アクションが無い）を使うと手が止まるが、手札にまだアクションが残っている → 雄牛（+2アクション）。
    if (!givesAction && t.actions <= 1 && otherActions >= 2 && ways.indexOf('way_of_the_ox') >= 0) return 'way_of_the_ox';
    // ドローを持たないカードで手札が細い → カワウソ（+2カード）。
    if (!givesCards && p.hand.length <= 2 && ways.indexOf('way_of_the_otter') >= 0) return 'way_of_the_otter';
    return null;
  }
  function bestGain(state, maxCost, opts) {
    opts = opts || {};
    return firstGainable(state, (id) => costUpTo(state, id, maxCost, opts) &&
      (!opts.treasureOnly || isTreasureNow(state, id)) && (!opts.noVictory || notVictory(id)));
  }
  // 「これより安い」の最善獲得（地下墓所/石工/国境の村/値切り屋/取り壊し）。opts = { noVictory, pot, debt }
  function bestGainUnder(state, coin, opts) {
    opts = opts || {};
    return firstGainable(state, (id) => costUnder(state, id, coin, opts) &&
      (!opts.noVictory || notVictory(id)));
  }
  // 「ちょうど exact コスト（ポーション/負債も一致）」の最善獲得。opts = { noVictory, pot, debt }
  function bestGainExact(state, exact, opts) {
    opts = opts || {};
    return firstGainable(state, (id) => costExact(state, id, exact, opts.pot, opts.debt) &&
      (!opts.noVictory || notVictory(id)));
  }
  const plainCoin = (id) => !(C()[id] && (C()[id].potion || C()[id].debt));

  /* ---------- E8：倒壊/死の荷車の「これ(this)を廃棄できるか」＝engine と同じ述語を見る ---------- */
  //   engine が拒否する選択を CPU が提案し続けると無限ループになるので、必ず engine.pendingSelf を参照する。
  function pendingSelf(state, pd, cardId) {
    const E = DOM.engine;
    if (E && E.pendingSelf) return E.pendingSelf(state, pd, cardId);
    if (!pd) return false;
    if (pd.self !== undefined) return !!pd.self;
    if (pd.fromCommand) return false; // v43以前のスナップショット互換
    const p = state.players[pd.player];
    return !!p && p.inPlay.includes(cardId);
  }

  /* ---------- 新プロモ：王子の脇置き対象を選ぶ ---------- */
  // 対象＝持続/命令以外・負債/ポーション費用なし・コスト4以下のアクション（engine の princeEligible と同条件）。
  // 自分をマット等へ動かして空振りする札（島/宝の地図）は毎ターン再生の価値が無いので選ばない
  // （E8＝命令で動かさずに使うと自己移動は失敗する。島は手札1枚をマットに送れるが、CPUには扱いづらいので避ける）。
  const PRINCE_AVOID = new Set(['island', 'treasure_map']);
  function bestPrinceTarget(state, p) {
    const elig = p.hand.filter((c) =>
      isType(c, 'action') && !isType(c, 'duration') && !isType(c, 'command') &&
      !(C()[c] && (C()[c].potion || C()[c].debt)) && cost(state, c) <= 4 && !PRINCE_AVOID.has(c));
    if (!elig.length) return null;
    for (const id of GAIN_ORDER) { if (elig.includes(id)) return id; } // 実強度順で最良
    return elig[0];
  }

  /* ---------- アクションフェーズ：使うカードを選ぶ ---------- */
  /* 夜想曲：夜フェイズに使う夜行カードを1枚選ぶ（使うたびに手札から減る＝毎回呼ばれて終端する）。
     夜行カードはアクション権も購入権も消費しないので、基本は「出せるものは全部出す」。
     ただし空振りするだけの札（手札に廃棄したいものが無いコウモリ／場が空の取り替え子）は出さない。
     カード個別の判断は各実装バッチで足す。 */
  function chooseNight(state, p) {
    const cand = p.hand.filter((c) => isType(c, 'night'));
    if (!cand.length) return null;
    const bad = (c) => {
      if (c === 'bat') return !p.hand.some((h) => h === 'curse' || h === 'copper' || h === 'estate' || h === 'ruined_village');
      if (c === 'changeling') return !(p.inPlay || []).some((x) => (C()[x] || {}).cost >= 4);
      return false;
    };
    const good = cand.filter((c) => !bad(c));
    if (!good.length) return null;
    // 獲得系（悪魔の工房/カブラー/悪魔祓い/修道院）を先に、持続（次のターンに効く）を後に。
    const rank = (c) => (isType(c, 'duration') ? 1 : 0);
    return good.sort((a, b) => rank(a) - rank(b))[0];
  }
  function chooseAction(state, p) {
    const t = state.turn;
    if (t.actions <= 0) return null;
    /* 同盟：将軍（Warlord）＝場に2枚以上ある同名のアクションは手札から使えない。
       engine が拒否する手を返し続けると本番 livelock になるので、`has` の時点で弾く（1箇所で全カードに効く）。 */
    /* 旭日：影(Shadow)は**山札のどこにあっても手札と同じように使える**（アクション権は普通に消費する）＝
       ここに足すだけで全カードに効く（engine の `canPlayFromHandOrShadow` と同じ集合を見る）。 */
    const has = (id) => (p.hand.includes(id) ||
        (DOM.isType(id, 'shadow') && (p.deck || []).includes(id))) &&
      !(DOM.engine.warlordBlocks && DOM.engine.warlordBlocks(state, t.active, id));
    const dead = p.hand.some((c) => isDead(c));
    // --- 非ターミナル（+アクションが付く＝連鎖できる）を最優先 ---
    /* 旭日（Rising Sun）R3。⚠ `has` は山札の影札も拾う（R2）＝影5種はここに足すだけで山札経路も通る。
       足さないと **CPUソークで影札が1枚も使われず、山札からの使用経路の検証が0回になる**。 */
    if (has('tea_house')) return 'tea_house';           // +1 Sun +1カード +1アクション +2コイン（最強のキャントリップ）
    // 段階2 第1バッチ：キャントリップは先・ターミナルは後（既存の並びに合わせる）
    if (has('pearl_diver')) return 'pearl_diver';
    if (has('explorer') && p.hand.includes('province')) return 'explorer';
    // 段階2 第1・第2バッチのターミナル（🛑 登録しないと CPU が一度も使わず、ソークでその経路が検証されない）
    if (has('ghost_ship')) return 'ghost_ship';                 // +2カード＋アタック
    if (has('sea_hag')) return 'sea_hag';                       // 呪い配り
    if (has('mountebank')) return 'mountebank';                 // +$2＋呪い/銅貨配り
    if (has('goons')) return 'goons';                           // +1購入+$2＋民兵型＋購入VP
    if (has('pirate_ship')) return 'pirate_ship';               // 攻撃 or トークン換金
    if (has('navigator')) return 'navigator';                   // +$2＋上5枚を整える
    if (has('counting_house') && p.discard.some((c) => c === 'copper')) return 'counting_house';
    if (has('ambassador') && p.hand.some((c) => c !== 'ambassador' && (c === 'curse' || c === 'estate' || c === 'copper'))) return 'ambassador';
    if (has('trade_route') && p.hand.some((c) => c !== 'trade_route' && trashValue(c) < 10)) return 'trade_route';
    if (has('embargo')) return 'embargo';                       // +$2（自己廃棄）
    // 収穫祭＆ギルド2版（第3バッチ）：キャントリップ→村型→ターミナル／褒賞
    if (has('farrier')) return 'farrier';                       // +1カード+1アクション+1購入
    if (has('joust')) return 'joust';                           // +1カード+1アクション+$1（属州があれば褒賞）
    if (has('ferryman')) return 'ferryman';                     // +2カード+1アクション−1枚捨て
    if (has('farmhands')) return 'farmhands';                   // +1カード+2アクション
    if (has('demesne')) return 'demesne';                       // +2アクション+2購入+金貨
    if (has('renown')) return 'renown';                         // +1購入・このターン -2コスト
    if (has('shop') && (DOM.engine.conclaveTargets ? DOM.engine.conclaveTargets(state, t.active).some((c) => c !== 'shop') : false)) return 'shop';
    if (has('courser')) return 'courser';
    if (has('housecarl') && p.inPlay.some((c) => isType(c, 'action'))) return 'housecarl';
    if (has('coronet') && p.hand.some((c) => c !== 'coronet' && isType(c, 'action') && !isType(c, 'reward'))) return 'coronet';
    if (has('footpad')) return 'footpad';                       // +2財源＋民兵型
    if (has('carnival')) return 'carnival';                     // 4枚公開→異名を手札へ
    if (has('infirmary') && p.hand.some((c) => c !== 'infirmary' && trashValue(c) < 10)) return 'infirmary';
    if (has('rustic_village')) return 'rustic_village'; // +1 Sun +1カード +2アクション
    if (has('poet')) return 'poet';                     // +1 Sun +1カード +1アクション ＋山札の上を手札へ
    /* 🛑 R4a/R6 で足したカードを chooseAction に登録し忘れていた（R3 の20種だけ登録されていた）＝
       **CPU がそのカードを一度も使わない＝CPUソークがその経路を1度も検証しない**（§0-36 が名指しした罠）。
       CPU は旭日の王国カードを自発的には買わない（MONEY 方針）が、**神器／継続／参集／信用／蓄積／成長／
       急速拡大／闇市場 が CPU にこれらを配る**ので、登録しないと手札に来ても死に札になる。 */
    if (has('daimyo')) return 'daimyo';                 // +1カード +1アクション ＋次の非命令アクションを再演（負債6）
    if (has('kitsune')) return 'kitsune';               // +1 Sun ＋異なる2つ（呪い配布を含む）
    if (has('river_shrine')) return 'river_shrine';     // +1 Sun ＋最大2枚廃棄／クリンナップに $4以下を獲得
    if (has('mountain_shrine')) return 'mountain_shrine'; // +1 Sun +2コイン ＋廃棄置き場にアクションがあれば +2カード
    if (has('samurai')) return 'samurai';               // アタック1回＋**ゲーム終了まで**毎ターン +$1（早いほど得）
    if (has('riverboat')) return 'riverboat';           // 持続＝次のターンに脇の $5 を使う
    if (has('artist')) return 'artist';                 // +1アクション ＋場に1枚だけのカードの種類数ぶんドロー（負債8）
    if (has('litter')) return 'litter';                 // +2カード +2アクション（負債1）
    if (has('root_cellar')) return 'root_cellar';       // +3カード +1アクション（負債3）
    if (has('alley')) return 'alley';                   // +1カード +1アクション ＋1枚捨て
    if (has('gold_mine')) return 'gold_mine';           // +1カード +1アクション +1購入
    if (has('aristocrat')) return 'aristocrat';         // 場の枚数で分岐（1枚目は +3アクション）
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
    // 新プロモ：非ターミナル（+アクション付き）
    if (has('sauna')) return 'sauna';                     // +1カード+1アクション（アヴァント連鎖・銀貨で廃棄）
    // 教会＝+1アクションだが手札は増えない。呪いの処分か手札余剰があるときだけ使う（無駄打ち回避）。
    if (has('church') && (p.hand.includes('curse') || p.hand.length >= 6)) return 'church';
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
    // 暗黒時代：非ターミナル（+アクション付き）
    if (has('fortress')) return 'fortress';               // +1カード+2アクション（廃棄で手札に戻る）
    if (has('necropolis')) return 'necropolis';           // +2アクション（避難所）
    if (has('bandit_camp')) return 'bandit_camp';         // +1カード+2アクション＋略奪品
    if (has('junk_dealer')) return 'junk_dealer';         // +1カード+1アクション+$1＋圧縮
    if (has('mystic')) return 'mystic';                   // +1アクション+$2＋当てれば手札へ
    if (has('vagrant')) return 'vagrant';                 // +1カード+1アクション
    if (has('wandering_minstrel')) return 'wandering_minstrel'; // +1カード+2アクション
    if (has('ironmonger')) return 'ironmonger';           // +1カード+1アクション＋種別ボーナス
    if (has('sage')) return 'sage';                       // +1アクション（$3以上を手札へ）
    if (has('market_square')) return 'market_square';     // +1カード+1アクション+1購入
    if (has('dame_molly')) return 'dame_molly';           // +2アクション＋騎士アタック
    if (has('sir_bailey')) return 'sir_bailey';           // +1カード+1アクション＋騎士アタック
    if (has('urchin')) return 'urchin';                   // +1カード+1アクション＋手札削り（傭兵化トリガー）
    if (has('rats') && p.hand.some((c) => c !== 'rats' && isDead(c))) return 'rats'; // 圧縮対象があるとき
    // 帝国：非ターミナル（+アクション付き）
    if (has('city_quarter')) return 'city_quarter';       // +2アクション＋手札のアクション枚数ぶん+カード
    if (has('forum')) return 'forum';                     // +3カード+1アクション（手札2枚捨て）
    if (has('groundskeeper')) return 'groundskeeper';     // +1カード+1アクション（勝利点獲得毎VP）
    if (has('chariot_race')) return 'chariot_race';       // +1アクション（山札比較→+$1+VP）
    if (has('villa')) return 'villa';                     // +2アクション+1購入+1コイン
    if (has('archive')) return 'archive';                 // +1アクション（脇3枚→3手番かけ1枚ずつ手札・持続）
    // 帝国E4：分割山の非ターミナル（+アクション付き）
    if (has('bustling_village')) return 'bustling_village'; // +1カード+3アクション（捨て札から開拓者）
    if (has('encampment')) return 'encampment';           // +2カード+2アクション（金貨/鹵獲品公開で場に残す）
    if (has('patrician')) return 'patrician';             // +1カード+1アクション（山札上$5以上を手札へ）
    if (has('settlers')) return 'settlers';               // +1カード+1アクション（捨て札から銅貨）
    // 夜想曲：非ターミナル（+アクション付き）
    if (has('blessed_village')) return 'blessed_village'; // +1カード+2アクション（獲得時に祝福）
    if (has('cursed_village')) return 'cursed_village';   // +2アクション＋手札6枚まで補充
    if (has('secret_cave')) return 'secret_cave';         // +1カード+1アクション（3枚捨てて次ターン+3コイン）
    if (has('pixie')) return 'pixie';                     // +1カード+1アクション（廃棄して祝福2回）
    // 冒険：非ターミナル（+アクション付き）
    if (has('lost_city')) return 'lost_city';             // +2カード+2アクション
    if (has('port')) return 'port';                       // +1カード+2アクション
    if (has('magpie')) return 'magpie';                   // +1カード+1アクション（山札の上を公開）
    if (has('caravan_guard')) return 'caravan_guard';     // +1カード+1アクション（次手番+$1・持続・リアクション）
    if (has('artificer')) return 'artificer';             // +1カード+1アクション+$1（捨て→格上げ山札上獲得）
    if (has('raze') && (p.hand.some((c) => isDead(c)) || true)) return 'raze'; // +1アクション（これ/手札を廃棄→山札上を掘る）
    if (has('storyteller') && t.coins === 0) return 'storyteller'; // +1アクション（coins0のときだけ＝MONEYでコインを消費しない安全キャントリップ）
    if (has('dungeon')) return 'dungeon';                 // +1アクション（+2カード→2枚捨て・持続）
    if (has('ratcatcher')) return 'ratcatcher';           // +1カード+1アクション（酒場マット・開始時に廃棄）
    if (has('guide')) return 'guide';                     // +1カード+1アクション（酒場マット・開始時に引き直し）
    if (has('transmogrify')) return 'transmogrify';       // +1アクション（酒場マット・開始時に格上げ）
    if (has('royal_carriage')) return 'royal_carriage';   // +1アクション（酒場マット・アクション再演）
    // 冒険：トラベラー（+アクション付き＝非ターミナル。成長させるため毎ターン使うのが基本）
    if (has('champion')) return 'champion';               // +1アクション（永続＝アタック免疫＋アクション毎+1）＝最優先で場に出す
    if (has('page')) return 'page';                       // +1カード+1アクション（成長：→トレジャーハンター）
    if (has('treasure_hunter')) return 'treasure_hunter'; // +1アクション+$1（成長：→ウォリアー）
    if (has('fugitive')) return 'fugitive';               // +2カード+1アクション（成長：→門下生）
    // ルネサンス：非ターミナル（+アクション付き）
    if (has('border_guard')) return 'border_guard';       // +1アクション（山札上2〜3枚から1枚を手札へ＋アーティファクト）
    if (has('research')) return 'research';               // +1アクション（廃棄→コストぶん脇置き→次手番に手札へ）
    if (has('hideout')) return 'hideout';                 // +1カード+2アクション（手札1枚を廃棄＝圧縮。勝利点を廃棄すると呪い）
    if (has('mountain_village')) return 'mountain_village'; // +2アクション（捨て札から1枚回収）
    if (has('seer')) return 'seer';                       // +1カード+1アクション（山札上3枚から$2〜$4を手札へ）
    if (has('experiment')) return 'experiment';           // +2カード+1アクション（山に戻る＝実質タダ）
    // ルネサンス：相続と同じく engine の述語を見る必要は無い（素直な効果）
    // 冒険：相続＝自分のターン中、屋敷は「脇に置いたカードを使用する」アクション（命令）としてプレイできる。
    //   engine の述語（inheritedEstate）を見る＝engine が拒否する手を提案しない。脇の札が非ターミナルなら先に使う。
    if (has('estate') && DOM.engine.inheritedEstate(p, 'estate')) {
      const inh = p.inherited[0];
      if (NONTERMINAL_INHERIT.has(inh)) return 'estate';
    }
    /* 同盟（Allies）A4：非ターミナル（+アクションが必ず付く＝連鎖できる）。
       ⚠ 「選ぶ」で +アクション を取れる札（町/触れ役/蹄鉄工/仲買人/改造）は decidePending 側の選択と揃える。 */
    if (has('merchant_camp')) return 'merchant_camp';     // +2アクション+1コイン
    if (has('capital_city')) return 'capital_city';       // +1カード+2アクション
    if (has('underling')) return 'underling';             // +1カード+1アクション+1好意
    if (has('distant_shore')) return 'distant_shore';     // +2カード+1アクション（屋敷を獲得）
    if (has('sibyl')) return 'sibyl';                     // +4カード+1アクション
    if (has('innkeeper')) return 'innkeeper';             // +1アクション（3択のドロー）
    if (has('town')) return 'town';                       // 二択（+1カード+2アクションを取れる）
    if (has('blacksmith')) return 'blacksmith';           // 三択（ドロー）
    if (has('town_crier')) return 'town_crier';           // 三択（+1カード+1アクションを取れる）
    if (has('miller')) return 'miller';                   // +1アクション（山札上4枚から1枚）
    if (has('old_map')) return 'old_map';                 // +1カード+1アクション（1枚捨てて+1カード）
    if (has('battle_plan')) return 'battle_plan';         // +1カード+1アクション（アタック公開で+1カード）
    if (has('swap')) return 'swap';                       // +1カード+1アクション（山に戻して格上げ獲得）
    if (has('skirmisher')) return 'skirmisher';           // +1カード+1アクション+1コイン（アタック獲得で攻撃）
    if (has('sorcerer')) return 'sorcerer';               // +1カード+1アクション（相手に呪い）
    if (has('sorceress')) return 'sorceress';             // +1アクション（当たれば相手に呪い）
    if (has('hunter')) return 'hunter';                   // +1アクション（山札上3枚から種別ごとに1枚）
    if (has('warlord')) return 'warlord';                 // +1アクション（持続アタック・次ターン+2カード）
    if (has('student')) return 'student';                 // +1アクション（循環＋廃棄。財宝なら好意＋山札上へ）
    if (has('sycophant')) return 'sycophant';             // +1アクション（3枚捨てて+3コイン）
    if (has('voyage')) return 'voyage';                   // +1アクション（追加ターン・使用は3枚まで）
    // 略奪P2/P3/P6：非ターミナル
    if (has('landing_party')) return 'landing_party';     // +2カード+2アクション（次に財宝が最初の1枚なら山札の上へ）
    if (has('mining_road')) return 'mining_road';         // +1アクション+1購入+$2（獲得した財宝を使える）
    if (has('harbor_village')) return 'harbor_village';   // +1カード+2アクション（次のアクションが+$なら+$1）
    if (has('wealthy_village')) return 'wealthy_village'; // +1カード+2アクション
    if (has('swamp_shacks')) return 'swamp_shacks';       // +2アクション（場の枚数でドロー）
    if (has('longship')) return 'longship';               // +2アクション（次ターン+2カード・持続）
    if (has('cabin_boy')) return 'cabin_boy';             // +1カード+1アクション（次ターンに二択・持続）
    if (has('taskmaster')) return 'taskmaster';           // +1アクション+$1（$5獲得で繰り返し・持続）
    if (has('shaman')) return 'shaman';                   // +1アクション+$1（任意の廃棄）
    if (has('grotto') && dead) return 'grotto';           // +1アクション（不要札を伏せて次ターン引き直し）
    // --- ターミナル（効果の大きい順）---
    // 新プロモ：王子＝良い対象（$4以下の持続/命令以外）が手札にあるときだけ（毎ターン無料再生＝最優先）。
    if (has('prince') && bestPrinceTarget(state, p)) return 'prince';
    if (has('captain')) return 'captain';                 // サプライの$4以下アクションを今と次ターンに使う
    // 略奪P2/P3：ターミナル
    if (has('cutthroat')) return 'cutthroat';             // アタック（手札3枚まで）＋誰かの$5以上財宝の獲得で戦利品
    if (has('siren')) return 'siren';                     // アタック（全員に呪い）＋次ターン手札8枚まで補充
    if (has('crew')) return 'crew';                       // +3カード（次ターン開始時に山札の上へ）
    if (has('pilgrim')) return 'pilgrim';                 // +4カード（1枚を山札の上へ戻す）
    if (has('search')) return 'search';                   // +$2＋次にサプライ1山が空くと廃棄して戦利品
    if (has('flagship')) return 'flagship';               // +$2＋次の（命令でない）アクションを再使用
    if (has('secluded_shrine')) return 'secluded_shrine'; // +$1＋次の財宝獲得で最大2枚圧縮
    if (has('stowaway')) return 'stowaway';               // 次ターン+2カード（持続）
    if (has('maroon') && p.hand.some((c) => isDead(c))) return 'maroon'; // 不要札を廃棄して種別ぶんドロー
    if (has('trickster')) return 'trickster';             // アタック（全員に呪い）＋財宝を次ターンへ持ち越し
    if (has('frigate')) return 'frigate';                 // +$3＋持続アタック（相手のアクション使用で手札4枚まで）
    if (has('first_mate') && p.hand.some((c) => isType(c, 'action') && c !== 'first_mate')) return 'first_mate'; // 同名連打＋手札6枚まで
    if (has('quartermaster')) return 'quartermaster';     // 永続（毎ターン$4以下を貯める/取る）
    if (has('fortune_hunter')) return 'fortune_hunter';   // +$2＋上3枚から財宝を使える
    if (has('mapmaker')) return 'mapmaker';               // 上4枚から2枚を手札へ
    if (has('enlarge') && p.hand.some((c) => isDead(c))) return 'enlarge'; // 廃棄→格上げ×2ターン
    if (has('avanto')) return 'avanto';                   // +3カード（サウナ連鎖）
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
    // 冒険：ターミナル
    if (has('messenger')) return 'messenger';             // +1購入+$2（最初の購入なら配布・山札捨て任意）
    if (has('swamp_hag')) return 'swamp_hag';             // 持続アタック（相手の購入毎に呪い→次手番+$3）
    if (has('haunted_woods')) return 'haunted_woods';     // 持続アタック（相手の購入で手札を山札上へ→次手番+3カード）
    if (has('bridge_troll')) return 'bridge_troll';       // アタック＋全カード-$1＋今と次+1購入（持続）
    if (has('giant')) return 'giant';                     // アタック（表で+$5＋各相手の山札上を廃棄/呪い）
    if (has('hireling')) return 'hireling';               // 永続 +1カード/ターン（早く出すほど得）
    if (has('wine_merchant')) return 'wine_merchant';     // +1購入+$4（酒場マット）
    if (has('gear')) return 'gear';                        // +2カード（脇置き持続）
    if (has('ranger')) return 'ranger';                   // +1購入（旅トークン表で+5カード。裏なら次回に備える）
    if (has('amulet')) return 'amulet';                   // 3択（+$1／廃棄／銀貨獲得）×2ターン
    // 守銭奴＝手札に銅貨があれば貯め（デッキ圧縮）、無ければマットの銅貨を換金（貯めた銅貨0なら無駄なので打たない）。
    if (has('miser') && (p.hand.includes('copper') || (p.tavern || []).some((c) => c === 'copper'))) return 'miser';
    if (has('duplicate')) return 'duplicate';             // 酒場マットに置いて $6以下の獲得をコピー
    if (has('distant_lands')) return 'distant_lands';     // 酒場マットに置いて4勝利点（0点→4点）
    if (has('teacher')) return 'teacher';                 // 酒場マットに置いて開始時に山トークンを配置
    // 冒険：トラベラー（ターミナル）＝成長させるため使う
    if (has('warrior')) return 'warrior';                 // +2カード＋アタック（成長：→ヒーロー）
    if (has('soldier')) return 'soldier';                 // +$2＋アタック（成長：→脱走兵）
    if (has('hero')) return 'hero';                       // +$2＋財宝獲得（成長：→チャンピオン）
    if (has('disciple') && p.hand.some((c) => isType(c, 'action') && c !== 'disciple')) return 'disciple'; // アクションを2度使い＋コピー獲得（成長：→教師）
    if (has('peasant')) return 'peasant';                 // +1購入+$1（成長：→兵士）
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
    // ルネサンス：ターミナル（アタック＞ドロー＞村人/財源＞圧縮）
    if (has('old_witch')) return 'old_witch';             // +3カード＋全員に呪い（強力）
    if (has('villain')) return 'villain';                 // +2財源＋相手の手札から$2以上を捨てさせる
    if (has('swashbuckler')) return 'swashbuckler';       // +3カード（捨て札があれば+1財源→財源4個で宝箱＝毎ターン金貨）
    if (has('treasurer')) return 'treasurer';             // +3コイン＋3択（廃棄置き場から財宝回収／鍵）
    if (has('flag_bearer')) return 'flag_bearer';         // +2コイン（獲得/廃棄で旗＝毎ターン+1カード）
    if (has('patron')) return 'patron';                   // +1村人+2コイン（村人でアクション権を補える）
    if (has('cargo_ship')) return 'cargo_ship';           // +2コイン（このターンの獲得1枚を次の手札へ・持続）
    if (has('improve')) return 'improve';                 // +2コイン（クリンナップで場のアクションを格上げ）
    if (has('scholar')) return 'scholar';                 // 手札を捨てて +7カード
    if (has('recruiter')) return 'recruiter';             // +2カード＋廃棄して村人（圧縮＋村人）
    if (has('sculptor')) return 'sculptor';               // $4以下を手札に獲得（財宝なら+1村人）
    if (has('inventor')) return 'inventor';               // $4以下を獲得＋このターン全カード-$1
    if (has('lackeys')) return 'lackeys';                 // +2カード
    if (has('silk_merchant')) return 'silk_merchant';     // +2カード+1購入
    if (has('acting_troupe')) return 'acting_troupe';     // +4村人（自身を廃棄）
    if (has('priest')) return 'priest';                   // +2コイン＋以後の廃棄で+2コイン（圧縮と併せて強い）
    // 暗黒時代：ターミナル（アタック＞ドロー＞trash-to-gain＞その他）
    if (has('cultist')) return 'cultist';                   // +2カード＋廃墟配布＋連鎖（強力）
    if (has('marauder')) return 'marauder';                 // 略奪品＋廃墟配布
    if (has('pillage')) return 'pillage';                   // 廃棄→略奪品2枚＋手札を捨てさせる
    if (has('rogue')) return 'rogue';                       // +$2＋廃棄置き場回収 or 相手の$3-6廃棄
    // 騎士（ターミナル種）＝手札にあれば使う（混合山アタック）
    for (const kn of ['sir_destry', 'dame_sylvia', 'sir_martin', 'dame_natalie', 'sir_michael', 'dame_anna', 'dame_josephine', 'sir_vander']) { if (has(kn)) return kn; }
    // 傭兵＝手札に不要札が2枚以上あるとき（廃棄して+2カード+$2＋アタック）
    if (has('mercenary') && p.hand.filter((c) => trashValue(c) < 10).length >= 2) return 'mercenary';
    if (has('hunting_grounds')) return 'hunting_grounds';   // +4カード（強力）
    if (has('band_of_misfits') && (DOM.engine && DOM.engine.bandOfMisfitsTargets ? DOM.engine.bandOfMisfitsTargets(state).length : 0)) return 'band_of_misfits'; // サプライの安いアクションを使う
    if (has('death_cart')) return 'death_cart';             // +$5（廃墟/自身を廃棄）
    if (has('catacombs')) return 'catacombs';               // 上3枚を手札へ or 捨てて+3カード
    if (has('count')) return 'count';                       // +$3 or 公領獲得（前半で山札整理）
    if (has('hermit')) return 'hermit';                     // 非財宝廃棄→$3以下獲得（無獲得ターンで狂人化）
    // 行進＝アップグレード先(ちょうど+$1のアクション)がある非持続アクションが手札にあるとき
    if (has('procession')) {
      // 旭日：行進の対象には山札の影札も選べる（engine の handPlayable と同じ集合を見る）
      const cands = playPool(state, t.active).filter((c) => isType(c, 'action') && !isType(c, 'duration') && c !== 'procession');
      const upOK = cands.some((c) => {
        const mx = cost(state, c) + 1, pot = C()[c].potion || 0, dbt = C()[c].debt || 0;
        return !!firstGainable(state, (id) => costExact(state, id, mx, pot, dbt) && isTypeSup(state, id, 'action'));
      });
      if (upOK) return 'procession';
    }
    // 建て直し＝屋敷/公領を持っているとき（勝利点を格上げ）
    if (has('rebuild') && (owned(p, 'estate') > 0 || owned(p, 'duchy') > 0)) return 'rebuild';
    // 墓暴き＝廃棄置き場に$3-6があるか、手札にアクションがあるとき（不発の無駄打ち回避）
    if (has('graverobber') && ((state.trash || []).some((c) => { const cc = cost(state, c); return cc >= 3 && cc <= 6 && (C()[c].potion || 0) === 0; }) || p.hand.some((c) => isType(c, 'action')))) return 'graverobber';
    if (has('altar') && p.hand.some((c) => isDead(c))) return 'altar'; // 不要札を廃棄→$5獲得（捨てる札があるとき）
    if (has('storeroom')) return 'storeroom';               // +1購入（捨てて引き直し→捨ててコイン）
    if (has('forager')) return 'forager';                   // +1アクション+1購入＋廃棄→コイン
    if (has('scavenger')) return 'scavenger';               // +$2＋山札整理
    if (has('armory')) return 'armory';                     // コスト4以下を山札の上に獲得
    if (has('poor_house')) return 'poor_house';             // +$4（手札の財宝で減）
    if (has('squire')) return 'squire';                     // +$1＋選択
    if (has('beggar')) return 'beggar';                     // 銅貨3枚を手札に
    // 夜想曲：ネクロマンサー＝廃棄置き場に使えるアクションがあるときだけ（ゾンビ3枚は常にある）
    if (has('necromancer') && DOM.engine.necromancerTargets(state).length) return 'necromancer';
    // 夜想曲：ターミナル（アタック＞ドロー＞コイン＋祝福）
    if (has('werewolf') && t.phase === 'action') return 'werewolf'; // アクションフェイズなら +3カード（夜なら呪詛）
    if (has('tormentor')) return 'tormentor';               // +2コイン＋全員に呪詛（場が空ならインプ）
    if (has('skulk')) return 'skulk';                       // +1購入＋全員に呪詛（獲得時に金貨）
    if (has('tragic_hero') && p.hand.length >= 5) return 'tragic_hero'; // +3カード+1購入（手札8枚以上なら廃棄→財宝）
    if (has('shepherd') && p.hand.some((c) => isType(c, 'victory'))) return 'shepherd'; // 勝利点を捨てて大量ドロー
    if (has('pooka') && p.hand.some((c) => isTreasureNow(state, c) && c !== 'cursed_gold')) return 'pooka'; // 財宝を廃棄して +4カード
    if (has('conclave') && DOM.engine.conclaveTargets(state, state.turn.active).length) return 'conclave';
    if (has('leprechaun')) return 'leprechaun';             // 金貨＋（場7枚なら願い／そうでなければ呪詛）
    if (has('bard')) return 'bard';                         // +2コイン＋祝福を1つ受ける
    if (has('fool')) return 'fool';                         // 森の迷子＋祝福3つ
    if (has('faithful_hound')) return 'faithful_hound';     // +2カード（捨てられたら脇に置いて戻ってくる）
    if (has('tracker')) return 'tracker';                   // +1コイン＋祝福（このターンの獲得を山札の上に）
    if (has('druid')) return 'druid';                       // +1購入＋脇の祝福
    /* 同盟（Allies）A4：ターミナル（アタック＞ドロー／獲得＞コイン）。 */
    if (has('barbarian')) return 'barbarian';               // +2コイン＋相手の山札上を廃棄→格下げ or 呪い
    if (has('highwayman')) return 'highwayman';             // 持続アタック（相手の最初の財宝を無効化・次ターン+3カード）
    if (has('archer')) return 'archer';                     // +2コイン＋相手の手札から1枚捨てさせる
    if (has('marquis')) return 'marquis';                   // +1購入＋手札枚数ぶんドロー
    if (has('sentinel')) return 'sentinel';                 // 山札上5枚から最大2枚廃棄（圧縮）
    if (has('conjurer')) return 'conjurer';                 // $4以下を獲得（次ターン手札に戻る）
    if (has('carpenter')) return 'carpenter';               // 空山0なら$4以下を獲得、そうでなければ格上げ
    if (has('hill_fort')) return 'hill_fort';               // $4以下を獲得＋二択
    if (has('modify')) return 'modify';                     // 廃棄→二択（キャントリップ or 格上げ獲得）
    if (has('broker')) return 'broker';                     // 廃棄→コスト$1につき1つ（カード/アクション/コイン/好意）
    if (has('acolyte')) return 'acolyte';                   // 廃棄→金貨／自身を廃棄→卜占官
    if (has('specialist') && p.hand.some((c) => (isType(c, 'action') || isTreasureNow(state, c)) && c !== 'specialist')) return 'specialist';
    if (has('royal_galley') && p.hand.some((c) => isType(c, 'action') && !isType(c, 'duration'))) return 'royal_galley';
    if (has('elder') && p.hand.some((c) => isType(c, 'action') && c !== 'elder')) return 'elder';
    if (has('herb_gatherer')) return 'herb_gatherer';       // +1購入（山札を捨て札へ→財宝を1枚使う）
    if (has('courier')) return 'courier';                   // +1コイン（捨て札からアクション/財宝を1枚使う）
    if (has('guildmaster')) return 'guildmaster';           // +3コイン（獲得ごとに好意）
    if (has('galleria')) return 'galleria';                 // +3コイン（$3/$4の獲得で+1購入）
    if (has('tent')) return 'tent';                         // +2コイン（循環・山札の上に戻せる）
    if (has('garrison')) return 'garrison';                 // +2コイン（獲得ごとにトークン→次ターンドロー）
    if (has('stronghold')) return 'stronghold';             // 二択（+3コイン／次ターン+3カード）
    if (has('importer')) return 'importer';                 // 持続（次ターン開始時に$5以下を獲得）
    if (has('emissary')) return 'emissary';                 // +3カード（シャッフルすれば+1アクション+2好意）
    if (has('lich')) return 'lich';                         // +6カード+2アクション（ただし1ターンスキップ）
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
    // 旭日：ターミナル系（忍者＝民兵型アタック／浪人＝手札7枚まで／狸＝改築型／札差／濡女／名匠／勅使／交替）。
    if (has('ninja')) return 'ninja';                   // +1カード＋民兵型アタック（山札からも撃てる）
    if (has('ronin')) return 'ronin';                   // 手札が7枚になるまで引く
    if (has('rice_broker')) return 'rice_broker';       // 廃棄→財宝+2/アクション+5カード
    if (has('imperial_envoy')) return 'imperial_envoy'; // +5カード +1購入（負債2）
    if (has('snake_witch')) return 'snake_witch';       // 手札が全部異なれば山へ戻して呪い配布
    if (has('tanuki')) return 'tanuki';                 // 廃棄→最大+$2高いカードを獲得
    if (has('craftsman')) return 'craftsman';           // コスト5以下を獲得（負債2）
    if (has('change')) return 'change';                 // 負債があれば+$3／なければ廃棄→格上げ
    if (has('fishmonger')) return 'fishmonger';         // +1購入 +$1（山札からも出せる）
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
    // 帝国：ターミナル
    if (has('royal_blacksmith')) return 'royal_blacksmith'; // +5カード（手札の銅貨を捨てる）
    if (has('engineer')) return 'engineer';                 // コスト4以下を獲得（自己廃棄でもう1枚）
    // 生贄：廃棄する価値のある不要札（銅貨=+$2／屋敷=+2VP／呪い=圧縮／死に札）が手札にあるときだけ使う。
    if (has('sacrifice') && p.hand.some((c) => c !== 'sacrifice' && (c === 'copper' || c === 'estate' || c === 'curse' || isDead(c)))) return 'sacrifice';
    if (has('legionary')) return 'legionary';               // +$3＋アタック（金貨公開で相手手札2に）
    if (has('enchantress')) return 'enchantress';           // アタック持続（相手の最初のアクションを置換）＋次手番+2カード
    // 帝国E3：集合
    if (has('farmers_market')) return 'farmers_market';     // +1購入＋山VP/コイン
    if (has('wild_hunt')) return 'wild_hunt';               // +3カード or 屋敷でVP回収
    // 神殿：+1VP＋圧縮だが 1〜3枚の強制廃棄＝不要札があるときだけ使う（良カードを廃棄しない）。
    if (has('temple') && p.hand.some((c) => c !== 'temple' && (c === 'copper' || c === 'estate' || c === 'curse' || isDead(c)))) return 'temple';
    // 帝国E4：剣闘士（+$2＋左隣非公開なら+$1・剣闘士廃棄）／投石機（+$1＋強制廃棄＝不要札があるときだけ）。
    if (has('gladiator')) return 'gladiator';
    if (has('catapult') && p.hand.some((c) => c !== 'catapult' && (c === 'copper' || c === 'estate' || c === 'curse' || isDead(c)))) return 'catapult';
    // 帝国E5：華やかな城＝手札の勝利点カードを+$2/枚に換金（捨てるだけ＝VPは失わない）。手札に他の勝利点があるときだけ。
    if (has('opulent_castle') && p.hand.some((c) => c !== 'opulent_castle' && isType(c, 'victory'))) return 'opulent_castle';
    // 帝国E6：大君主＝対象（サプライの$5以下・非命令・非持続アクション）があれば必ず使用（公式＝mayではない）。
    if (has('overlord') && (DOM.engine && DOM.engine.overlordTargets ? DOM.engine.overlordTargets(state).length : 0)) return 'overlord';
    // 帝国E6：冠＝アクションフェイズに2回使う価値のある別アクションが手札にあるときだけ（無駄打ち回避・玉座と同型）。
    if (has('crown') && p.hand.some((c) => c !== 'crown' && isType(c, 'action'))) return 'crown';
    // 冒険：相続の屋敷（ターミナル系の脇札）＝他に使うアクションが無くなってから使う（アクション権を食うため）。
    if (has('estate') && DOM.engine.inheritedEstate(p, 'estate')) return 'estate';
    /* 旭日：悟り（予言）＝アクションフェイズに財宝を使うと **+1カード +1アクション**（＝完全なキャントリップ）。
       アクション権が減らないので**常に得**（デッキが薄くなるだけ）。他に使うアクションが無くなってから、
       手札の一番弱い財宝を出す。⚠ **コインは出ない**ので購入フェイズ用の財宝は温存する必要がある……が、
       キャントリップなので引いた枚数ぶん財宝も増える＝実測でも購入額は落ちない。 */
    if (DOM.engine.isActionFor && state.turn.actions > 0) {
      const ench = p.hand.filter((c) => !isType(c, 'action') && DOM.engine.isActionFor(state, c));
      if (ench.length) return ench.sort((a, b) => cost(state, a) - cost(state, b))[0];
    }
    return null;
  }
  // 相続の脇札が「+アクションが付く（非ターミナル）」なら、屋敷を早めに使ってよい。
  const NONTERMINAL_INHERIT = new Set(['village', 'fishing_village', 'walled_village', 'great_hall', 'market',
    'festival', 'laboratory', 'poacher', 'merchant', 'harbinger', 'lost_city', 'port', 'page', 'peasant',
    'shanty_town', 'wishing_well', 'sea_chart', 'magpie', 'city', 'workers_village', 'peddler', 'squire']);

  /* ---------- 購入フェーズ：買うカードを選ぶ（難易度別） ---------- */
  function kingdomAffordable(state, coins) {
    const potions = (state.turn && state.turn.potions) || 0; // 錬金術：ポーション費用も満たすものだけ
    // コストは engine の実コストで見る（橋等の軽減／混合山＝騎士・城は「一番上の実カードのコスト」）。
    // 静的な C()[id].cost だと城の山（プレースホルダ$3）を$3で買えると誤認し、engine 拒否と噛み合って買いを空振りする。
    return (state.kingdom || []).filter((id) =>
      sup(state, id) > 0 && cost(state, id) <= coins && (C()[id].potion || 0) <= potions &&
      !splitBlocked(state, id) &&
      (!DOM.engine || !DOM.engine.canBuyCard || DOM.engine.canBuyCard(state, state.turn.active, id)));
  }

  /* ---------- 終局認識（強CPU用） ----------
     「この1枚を買うとゲームが終わるか」「終わった場合に自分が勝つか」を判定する。
     これが無いと、負け確定でも最後の属州を買って自滅したり（不自然な介錯）、
     大差リード中に山切れで勝ち確で閉じられる手を逃したりする。 */
  // engine.vpOf と同等（公爵=公領数、庭園=デッキ10枚毎に1点 の変動得点も加算）。
  // これが無いと hard CPU の終局判定が庭園/公爵を 0 点と誤算し、勝ち/負けの読みを誤る。
  /* ⚠ 旭日：悟り(Enlightenment) が有効なら**得点計算でも財宝はアクション**（公式＝ブドウ園）。
     engine の vpOf と同じ判定にしないと **hard CPU の終局読みが実得点とズレる**（§0-19／§0-26 で2度直したクラス）。 */
  function vpOfPlayer(p, state) {
    const isActVP = (c) => (state && DOM.engine.isActionFor ? DOM.engine.isActionFor(state, c) : isType(c, 'action'));
    const cards = allCards(p);
    let vp = cards.reduce((sum, c) => sum + (C()[c].vp || 0), 0);
    const dukes = cards.filter((c) => c === 'duke').length;
    if (dukes) vp += dukes * cards.filter((c) => c === 'duchy').length;
    const gardens = cards.filter((c) => c === 'gardens').length;
    if (gardens) vp += gardens * Math.floor(cards.length / 10);
    const vineyards = cards.filter((c) => c === 'vineyard').length;
    if (vineyards) vp += vineyards * Math.floor(cards.filter(isActVP).length / 3);
    const fairgrounds = cards.filter((c) => c === 'fairgrounds').length; // 収穫祭：品評会（engine.vpOf と同等に）
    if (fairgrounds) vp += fairgrounds * 2 * Math.floor(new Set(cards).size / 5);
    const silkRoads = cards.filter((c) => c === 'silk_road').length; // 異郷：絹の道（勝利点カード4枚毎に1点）
    if (silkRoads) vp += silkRoads * Math.floor(cards.filter((c) => isType(c, 'victory')).length / 4);
    const demesnes = cards.filter((c) => c === 'demesne').length;    // 収穫祭＆ギルド2版：御料地（金貨1枚につき1点）＝engine.vpOf と同じ
    if (demesnes) vp += demesnes * cards.filter((c) => c === 'gold').length;
    const feoda = cards.filter((c) => c === 'feodum').length;        // 暗黒時代：封土（銀貨3枚毎に1点）
    if (feoda) vp += feoda * Math.floor(cards.filter((c) => c === 'silver').length / 3);
    // 帝国：粗末な城=所有する城1枚につき1点／王城=所有する城1枚につき2点（engine.vpOf と同等）。
    const humbleC = cards.filter((c) => c === 'humble_castle').length;
    const kingsC = cards.filter((c) => c === 'kings_castle').length;
    if (humbleC || kingsC) {
      const castleCount = cards.filter((c) => C()[c] && isType(c, 'castle')).length;
      vp += humbleC * castleCount + kingsC * 2 * castleCount;
    }
    const distantLands = (p.tavern || []).filter((c) => c === 'distant_lands').length; // 冒険：酒場マット上でのみ4点
    if (distantLands) vp += distantLands * 4;
    const pastures = cards.filter((c) => c === 'pasture').length; // 夜想曲：牧草地＝屋敷1枚につき1点
    if (pastures) vp += pastures * cards.filter((c) => c === 'estate').length;
    // 同盟：領土＝異なる名前の勝利点カード1種類につき1点（engine.vpOf と同じ式）。
    const territories = cards.filter((c) => c === 'territory').length;
    if (territories) {
      const vnames = new Set();
      cards.forEach((c) => { if (C()[c] && isType(c, 'victory')) vnames.add(c); });
      vp += territories * vnames.size;
    }
    vp += p.vpTokens || 0; // 繁栄：VPトークン
    // 夜想曲：生活苦(-2)/二重苦(-4)＝engine.vpOf と同じ式（片方だけだと「勝てると思って買って負ける」）。
    if (p.misery === 1) vp -= 2;
    else if (p.misery >= 2) vp -= 4;
    return vp;
  }
  // 混合山（暗黒時代=騎士/廃墟／帝国=城／同盟=分割山6組）を買うと実際に手に入るのは「一番上の実カード」。
  //   それ以外は id のまま。**述語は engine の mixedTopCard が正本**（山を足すたびに CPU 側が漏れるのを防ぐ）。
  function mixedTop(state, id) {
    return ((DOM.engine && DOM.engine.mixedTopCard) ? DOM.engine.mixedTopCard(state, id) : null) || id;
  }
  function buyEndsGame(state, id) {
    const after = (k) => (state.supply[k] || 0) - (k === id ? 1 : 0);
    if (after('province') <= 0) return true;
    // 繁栄：植民地を使うゲームは植民地が尽きても終了する（engine の isGameOver と同じ条件を見る）。
    if (state.supply.colony != null && after('colony') <= 0) return true;
    /* 3山終了は **engine の emptyPileCount が正本**（非サプライ＝賞品/略奪品/成長先を数えない・
       分割山は上下で1山・廃墟の混合山を state.ruins で数える）。ここで素朴に supply のキーを数えると
       非サプライ山や分割山下段まで「空」に数えてしまい、engine はまだ続くのに CPU だけ「買うと終わる」と
       誤判定して終盤ずっと買い控える（敵対レビューで実測）。 */
    const hypo = Object.assign({}, state, { supply: Object.assign({}, state.supply, { [id]: (state.supply[id] || 0) - 1 }) });
    return (DOM.engine && DOM.engine.emptyPileCount) ? DOM.engine.emptyPileCount(hypo) >= 3 : false;
  }
  // 帝国：ランドマーク得点は engine の正本 landmarkScoreForCards を仮デッキに当てて算出する
  //   （オベリスクの分割山両半分・塔の空山写像・砦の全員比較を engine と完全一致で見積る）。
  function landmarkVp(state, cards, seat) {
    return (DOM.engine && DOM.engine.landmarkScoreForCards) ? DOM.engine.landmarkScoreForCards(state, cards, seat) : 0;
  }
  /* 同盟：高原の羊飼い（好意×コストちょうど$2のカードのペア）も engine の正本で見積る
     （engine と CPU で算出が違うと「勝てると思って買って負ける」＝§0-26 で踏んだのと同型）。
     favors は仮デッキではなく**実プレイヤー**から読む（好意はカードではないので hypo に入らない）。 */
  function allyVp(state, cards, pl) {
    return (DOM.engine && DOM.engine.allyScoreForCards) ? DOM.engine.allyScoreForCards(state, cards, pl) : 0;
  }
  // seat が id を獲得して即終了した場合に勝てる（同点の共同勝利を含む）か
  function winsIfEnds(state, seat, id) {
    // 獲得する1枚を加えた仮デッキで再計算（庭園のデッキ増・公爵の動的得点も反映）
    const me = state.players[seat];
    const hypo = { deck: allCards(me).concat(id), hand: [], discard: [], inPlay: [], vpTokens: me.vpTokens || 0 };
    // 遠隔地（冒険）は「酒場マット上にあるときだけ4点」＝ゾーン依存の得点。hypo は全ゾーンを deck にまとめるので
    // vpOfPlayer では 0 点になる。相手は実オブジェクト（tavern あり）で評価されるため、足さないと自分だけ過小評価になる。
    // （hypo.tavern に入れ直すと allCards で二重に数えてしまう＝庭園/品評会/絹の道/城が狂う。ここで加算するのが正しい。）
    const myVp = vpOfPlayer(hypo, state) + 4 * (me.tavern || []).filter((c) => c === 'distant_lands').length
      + landmarkVp(state, allCards(me).concat(id), seat) // 帝国：ランドマーク得点（engineと同一算出）
      + allyVp(state, allCards(me).concat(id), me);      // 同盟：高原の羊飼い（engineと同一算出）
    // 同点決勝は**タイブレーク用のターン数**で比べる（engine の scoreGame と同じ算出＝食い違うと
    //   「勝てると思って買ったら負ける」/「勝てるのに買わない」が起きる）。
    //   移動動物園「今を生きる」の追加ターンは数えない（p.freeTurns）。今まさにそのターンなら、
    //   このターンぶんの +1 も数えない（クリーンアップで turns も freeTurns も同時に増えるため）。
    const seizeNow = (state.turn && state.turn.seizeTurn && state.turn.active === seat) ? 1 : 0;
    const myTurns = me.turns + 1 - (me.freeTurns || 0) - seizeNow; // 今のターンはクリーンアップで+1される
    return state.players.every((p, i) => {
      if (i === seat) return true;
      const v = vpOfPlayer(p, state) + landmarkVp(state, allCards(p), i) + allyVp(state, allCards(p), p);
      if (v > myVp) return false;
      if (v === myVp && (p.turns - (p.freeTurns || 0)) < myTurns) return false;
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
      if (id === 'prince') continue;                              // 王子($8)は属州優先のCPUには扱いが難しいので自動購入しない
      if (splitBlocked(state, id)) continue;                      // 分割山の下（アヴァント）はサウナが尽きるまで買えない
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
    // コストは実コスト（軽減・混合山の一番上）で判定し、購入不可（分割山の下段/高級市場/非サプライ）は除く。
    // 混合山（騎士/城）は実際に手に入るのは「一番上のカード」なので、得点計算もそのカードで行う。
    let winningEnd = null, bestKey = -Infinity;
    Object.keys(state.supply).forEach((id) => {
      if (sup(state, id) <= 0 || cost(state, id) > coins || (C()[id].potion || 0) > (state.turn.potions || 0)) return; // 錬金術：ポーション費用も満たす
      if (splitBlocked(state, id)) return;
      if (DOM.engine && DOM.engine.canBuyCard && !DOM.engine.canBuyCard(state, seat, id)) return;
      const realId = mixedTop(state, id);
      if (!buyEndsGame(state, id) || !winsIfEnds(state, seat, realId)) return;
      const key = (C()[realId].vp || 0) * 100 + cost(state, id);
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
      // 新プロモ：へそくり($5・+2コイン財宝)は銀貨の上位互換的な金量札＝$5で銀貨に落ちる前に確保（2枚まで）。
      else if (coins >= 5 && sup(state, 'stash') > 0 && owned(p, 'stash') < 2) pick = 'stash';
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
    if (coins >= 5 && sup(state, 'stash') > 0 && owned(p, 'stash') < 2) return 'stash'; // 新プロモ：$5の金量札
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
      cost(state, id) <= real && id !== 'possession' && // 支配はCPUが扱いにくいので自動購入しない
      // **engine が拒否する手を返さない**（この経路は chooseBuy の最終ガードを early return で飛び越えるため、
      //   ここで見ないと本番 livelock になる）。夜想曲の錯乱＝アクションカードを購入できない、が実例。
      !splitBlocked(state, id) &&
      (!DOM.engine || !DOM.engine.canBuyCard || DOM.engine.canBuyCard(state, state.turn.active, id)));
    for (const id of GAIN_ORDER) { if (cands.includes(id)) return id; }
    return cands[0] || null;
  }

  // 旭日：盛大な取引＝購入フェイズに残ったアクション権も購入権として使える（engine の buysAvailable と同じ）。
  function buysLeft(state) {
    return (DOM.engine.buysAvailable ? DOM.engine.buysAvailable(state, state.turn.active) : (state.turn.buys || 0));
  }
  function chooseBuy(state, p, level) {
    // 旭日：盛大な取引＝アクション権も購入権として使える（engine の述語と同じものを見る）。
    if (buysLeft(state) <= 0) return null;
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

  /* ルネサンス：横型プロジェクト（買う横型）を買うか判断。買うプロジェクトid か null を返す。
     ※ 返すのは必ず engine の `canBuyProject` が真のものだけ＝BUY_PROJECT が拒否しない（拒否すると無限ループ）。
       キューブは2個だけ＝「良いものから2つ」。序盤〜中盤に取り切る（終盤は属州/公領を優先）。 */
  const PROJECT_RANK = [
    // 恒久的にデッキを強くするもの＞経済＞得点補助 の順。コストは engine が見る（ここは優先度だけ）。
    'citadel',       // $8：毎ターン最初のアクションを再演＝最強クラス
    'innovation',    // $6：獲得したアクションを即使用
    'barracks',      // $6：毎ターン +1アクション
    'fair',          // $4：毎ターン +1購入
    'canal',         // $7：全カード $1安い
    'academy',       // $5：アクション獲得で村人
    'guildhall',     // $5：財宝獲得で財源
    'piazza',        // $5：ターン開始時に山札の上のアクションを使用
    'crop_rotation', // $6：手札の勝利点を +2カードに変える
    'sinister_plot',  // $4：溜めて一気に引く
    'city_gate',     // $3：毎ターン +1カード→1枚を山札の上へ（引きの安定）
    'star_chart',    // $3：シャッフルの一番上を選べる
    'silos',         // $4：銅貨を引き直す
    'exploration',   // $4：獲得なしの購入フェイズで財源+村人
    'pageant',       // $3：余りコインを財源に
    'sewers',        // $3：廃棄のたびに追加圧縮（廃棄札があるときだけ有効）
    'cathedral',     // $3：毎ターン強制廃棄（圧縮だが手札を失う）
    'road_network',  // $5：相手の勝利点獲得で+1カード
    'fleet',         // $5：終了後の追加ターン
    'capitalism',    // $5：+$を持つアクションが財宝にもなる
  ];
  function bestProjectBuy(state, p, level, cardBuy) {
    const t = state.turn;
    if (!state.projects || !state.projects.length) return null;
    if (buysLeft(state) <= 0 || (p.debt || 0) > 0) return null;
    if ((p.projects || []).length >= 2) return null; // キューブ切れ
    const canBuy = (id) => DOM.engine.canBuyProject && DOM.engine.canBuyProject(state, t.active, id);
    // 終盤（属州が残り少ない）＝プロジェクトより勝利点。ただし属州が買えないなら取ってよい。
    const endgame = sup(state, 'province') <= 3;
    const bigBuy = cardBuy && cost(state, cardBuy) >= 6;
    if (endgame && bigBuy) return null;
    if (cardBuy && isType(cardBuy, 'victory') && cost(state, cardBuy) >= 5) return null; // 公領/属州を優先
    for (const id of PROJECT_RANK) {
      if (!canBuy(id)) continue;
      // 下水道は廃棄手段が無いと死に札＝廃棄札が王国にあるときだけ買う。
      if (id === 'sewers' && !state.kingdom.some((k) => /廃棄/.test((C()[k] || {}).text || ''))) continue;
      return id;
    }
    return null;
  }

  // 帝国：横型イベント（買う横型）を買うか判断。買うイベントid（affordable・負債>0でない）か null を返す。
  //   cardBuy＝この局面で chooseBuy が返す最善のカード買い（イベントと比較して置き換え/併用を決める）。
  //   ※ 返すイベントは必ず「コスト≤coins・購入権>0・負債0・採用済み」＝BUY_EVENT が拒否しない（拒否すると無限ループ）。
  //     負債コストのイベントを買うと debt>0 になり、次の decide は返済/END_TURN 分岐に入る＝1ターン1回で有界。
  function bestEventBuy(state, p, level, cardBuy) {
    const t = state.turn;
    if (!state.events || !state.events.length) return null;
    if (buysLeft(state) <= 0 || (p.debt || 0) > 0) return null;
    const coins = t.coins;
    const has = (id) => state.events.indexOf(id) >= 0;
    const L = (id) => DOM.LANDSCAPES[id] || {};
    const afford = (id) => (L(id).cost || 0) <= coins; // 負債は debt==0 の今なら負ってよい
    // 勝利点を積みたい局面（属州が残り少ない or 既に空山がある＝終盤グリーニング）。
    const empties = Object.keys(state.supply).filter((id) => (state.supply[id] || 0) === 0).length;
    const wantVP = sup(state, 'province') <= 4 || empties >= 1;
    const cardCst = cardBuy ? cost(state, cardBuy) : -1;
    const junk = allCards(p).filter((c) => c === 'copper' || c === 'estate' || isType(c, 'curse')).length;

    // 1) 制圧：属州+9VP（$14）。属州が残っていれば最優先＝属州単体買い（6VP）より破格。
    if (has('dominate') && afford('dominate') && sup(state, 'province') > 0) return 'dominate';
    // 2) 征服：銀貨2＋今ターン獲得銀貨ぶんVP（$6）。VP局面で、属州級の大きな買いに届かないなら（銀貨2＝2VP以上）。
    if (has('conquest') && afford('conquest') && wantVP && !(cardBuy && isType(cardBuy, 'victory') && cardCst >= 6)) return 'conquest';
    // 3) 結婚式：+1VP＋金貨（$4＋負債3）。金貨を買う局面なら置き換える（金貨＋1VP・負債3は次ターンに返済）。
    if (has('wedding') && coins >= 4 && cardBuy === 'gold') return 'wedding';
    // 4) 併合：公領＋捨て札を山札へ混ぜる（$0＋負債8）。VP局面で公領が欲しく、属州級の買いに届かないなら。
    if (has('annex') && wantVP && sup(state, 'duchy') > 0 && !(cardBuy && cardCst >= 8)) return 'annex';
    // 5) 凱旋：屋敷＋今ターン獲得ぶんVP（$0＋負債5）。VP局面で今ターン既に2枚以上獲得しているなら（VP効率）。
    if (has('triumph') && wantVP && (t.gainedThisTurn || []).length >= 2) return 'triumph';
    // 6) 大地への塩まき：+1VP＋サプライ勝利点1枚廃棄（$4）。VP局面で他に大きな買いが無いなら。
    if (has('salt_the_earth') && afford('salt_the_earth') && wantVP && !(cardBuy && cardCst >= 5)) return 'salt_the_earth';
    // 7) 寄付：デッキ掃討（$0＋負債8）。序盤にジャンクが多いとき一度だけ（負債8は以後のターンで返済＝有界）。
    if (has('donate') && (p.turns || 0) <= 3 && junk >= 8 && (cardBuy == null || cardBuy === 'silver')) return 'donate';
    // 8) 掘進：$2で銀貨＋購入維持。他に買うものが無い余りコインで銀貨を拾う。
    if (has('delve') && coins >= 2 && cardBuy == null) return 'delve';
    // ritual/banquet/windfall/tax は CPU は買わない（呪い/銅貨のジャンク付与・条件依存・妨害で価値が読みにくい＝skip）。

    /* ---- 冒険イベント（負債なし・トークン中心）---- */
    // 1ターン1回／1ゲーム1回の制限は engine の canBuyEvent が正本（提案すると拒否され無限ループになるので必ず見る）。
    const buyable = (id) => has(id) && afford(id) && E().canBuyEvent(state, p.id, id);

    /* ---- 旭日イベント ----
       ⚠ CPU が買うのは**条件が機械的に判定できて必ず得な3種だけ**（残り7種は skip＝
          ritual/banquet/windfall/tax と同じ扱い）。**engine が受理しない手を提案すると本番 livelock**
          になるので、条件は engine 側の述語（`canBuyEvent` / `anyGainable`）と必ず揃える。 */
    // 参集（$7）＝ちょうど$3・$4・$5 を1枚ずつ＝**1回の購入で3枚**＝属州級の買いに届かないなら常に得。
    // プロモ：召喚＝$4以下のアクションを脇に置いて次ターン使う（$5の買い物が無いときだけ）
    if (buyable('summon') && !(cardBuy && cost(state, cardBuy) >= 5) && firstGainable(state, (id) => DOM.engine.summonCanGain(state, id))) return 'summon';
    if (buyable('gather') && !(cardBuy && cost(state, cardBuy) >= 8)) return 'gather';
    // 蓄積（$2）＝場にアクションが1枚も無いときだけ働く。余ったコインで$5以下のアクションを拾える。
    if (buyable('amass') && cardBuy == null &&
        !p.inPlay.concat(p.durationCards || []).some((c) => isType(c, 'action'))) return 'amass';
    /* 信用（$2）＝コスト8以下のアクション/財宝を獲得して同額の負債。**負債はターン中いつでも返せる**が
       返し切るまで購入が止まるので、**序盤（〜8ターン）で、そのターンに他に大きな買いが無いときだけ**。 */
    if (buyable('credit') && (p.turns || 0) <= 8 && (p.debt || 0) === 0 &&
        !(cardBuy && cost(state, cardBuy) >= 5)) return 'credit';
    const tok = p.pileTokens || {};
    const deckActions = allCards(p).filter((c) => isType(c, 'action')).length;
    // 相続（$7）＝屋敷がアクションになる（デッキの屋敷が多いほど強い）。序盤〜中盤に1回だけ。
    if (buyable('inheritance') && (p.turns || 0) <= 10 && allCards(p).filter((c) => c === 'estate').length >= 2 &&
        (DOM.engine.inheritanceTargets(state) || []).length && !(cardBuy && cost(state, cardBuy) >= 8)) return 'inheritance';
    // 奇襲（$5）＝場の銀貨ぶん銀貨獲得＋相手に-1カード。銀貨が2枚以上場にあるなら金貨より得。
    if (buyable('raid') && p.inPlay.filter((c) => c === 'silver').length >= 2 && !(cardBuy && cost(state, cardBuy) >= 6)) return 'raid';
    // 誘導（$8）／失われた技術（$6）／鍛錬（$6）＝山トークン。よく使うアクションがあり、まだそのトークンを置いていないなら。
    if (buyable('pathfinding') && !tok.card && deckActions >= 4 && !(cardBuy && cost(state, cardBuy) >= 8)) return 'pathfinding';
    if (buyable('lost_arts') && !tok.action && deckActions >= 4 && !(cardBuy && cost(state, cardBuy) >= 6)) return 'lost_arts';
    if (buyable('training') && !tok.coin && deckActions >= 4 && !(cardBuy && cost(state, cardBuy) >= 6)) return 'training';
    // 海路（$5）＝$4以下のアクション獲得＋その山に+1購入トークン（獲得できるときだけ）。
    if (buyable('seaway') && !tok.buy && firstGainable(state, (id) => costUpTo(state, id, 4) && isTypeSup(state, id, 'action')) &&
        !(cardBuy && cost(state, cardBuy) >= 6)) return 'seaway';
    // 舞踏会（$5）＝-$1トークンを受けて$4以下を2枚。金貨1枚より2枚のほうが得な序盤に。
    if (buyable('ball') && (p.turns || 0) <= 8 && !wantVP && !(cardBuy && cost(state, cardBuy) >= 6)) return 'ball';
    // 巡礼（$4）＝買うとまず旅トークンを裏返す（flip-then-check）。**今が裏向き（journeyDown=true）のときだけ**
    //   買えば表になって効果が出る。表のときに買うと裏返って必ず空振り＝買わない。
    if (buyable('pilgrimage') && p.journeyDown && (DOM.engine.pilgrimageChoices(state, p.id) || []).length >= 2 &&
        !(cardBuy && cost(state, cardBuy) >= 6)) return 'pilgrimage';
    // 交易（$5）＝手札の呪い/屋敷を銀貨に替える。
    if (buyable('trade') && p.hand.filter((c) => isType(c, 'curse') || c === 'estate').length >= 1 &&
        !(cardBuy && cost(state, cardBuy) >= 6)) return 'trade';
    // 探検（$3）＝次の手札+2枚（余りコインで買う）。
    if (buyable('expedition') && coins >= 3 && cardBuy == null) return 'expedition';
    // 焚火（$3）＝場の銅貨を廃棄して圧縮（財宝が十分あるときだけ）。
    if (buyable('bonfire') && p.inPlay.filter((c) => c === 'copper').length >= 2 &&
        allCards(p).filter((c) => isTreasure(c)).length >= 8 && cardBuy == null) return 'bonfire';
    // 偵察隊（$2）／施し（$0）／借入（$0）＝余りコイン・余り購入権の使い道。
    if (buyable('alms') && !p.inPlay.some((c) => isTreasure(c)) && firstGainable(state, (id) => costUpTo(state, id, 4))) return 'alms';
    if (buyable('scouting_party') && coins >= 2 && cardBuy == null) return 'scouting_party';
    // 保存/移動遊園地/使節団/渡し船/立案/探索 は CPU は買わない（価値が読みにくい／効果が薄い＝skip）。

    /* ---- 移動動物園イベント（負債なし・馬/追放/追加ターン）---- */
    // 同盟（$10）＝属州+公領+屋敷+金貨+銀貨+銅貨を一気に獲得（VP局面なら属州1枚より強い）。
    if (buyable('alliance') && wantVP && sup(state, 'province') > 0) return 'alliance';
    // 植民（$10）＝アクションの山それぞれから1枚ずつ。大量獲得＝3山切れが一気に近づくので終盤にリードしていれば強い。
    if (buyable('populate') && (DOM.engine.populatePiles(state) || []).length >= 4 &&
        !(cardBuy && cost(state, cardBuy) >= 8)) return 'populate';
    // 包領（$8）＝金貨＋公領を追放（3点を確保しつつデッキを汚さない）。VP局面で。
    if (buyable('enclave') && wantVP && sup(state, 'duchy') > 0 && !(cardBuy && cost(state, cardBuy) >= 8)) return 'enclave';
    // 今を生きる（$4）＝1ゲーム1回の追加ターン。終盤（属州が減ってきたら）に取ると1手番ぶん得。
    if (buyable('seize_the_day') && sup(state, 'province') <= 5 && !(cardBuy && cost(state, cardBuy) >= 5)) return 'seize_the_day';
    // 刈り入れ（$7）＝次のターンの頭に金貨1枚が場に出る（実質 金貨＋前借り）。金貨を買う局面より上。
    if (buyable('reap') && coins >= 7 && !(cardBuy && cost(state, cardBuy) >= 8)) return 'reap';
    // 商売（$5）＝今ターン獲得した異なる名前の数だけ金貨。3種類以上獲得しているときだけ買う。
    {
      const distinct = [];
      (t.gainedThisTurn || []).forEach((c) => { if (distinct.indexOf(c) < 0) distinct.push(c); });
      if (buyable('commerce') && distinct.length >= 3 && sup(state, 'gold') > 0) return 'commerce';
    }
    // 特価品（$4）＝$5以下の非勝利点を1枚（相手に馬を配るのが難点なので、良い$5が取れるときだけ）。
    if (buyable('bargain') && coins >= 4 && coins < 5 &&
        firstGainable(state, (id) => costUpTo(state, id, 5) && notVictory(id) && cost(state, id) === 5)) return 'bargain';
    // 要求（$5）＝馬＋$4以下を山札の上に（次の手番が強くなる）。金貨に届かない$5で。
    if (buyable('demand') && coins >= 5 && coins < 6 && sup(state, 'horse') > 0) return 'demand';
    // 暴走（$5）＝場が5枚以下なら馬5枚を山札の上に（次の手番が爆発する）。
    if (buyable('stampede') && (p.inPlay.length + (p.durationCards || []).length) <= 5 &&
        sup(state, 'horse') >= 5 && !wantVP) return 'stampede';
    // 増大（$3）＝要らない札を $2 高いカードに変える（圧縮＋強化）。
    if (buyable('enhance') && coins >= 3 && cardBuy == null &&
        p.hand.some((c) => c === 'copper' || c === 'estate' || isType(c, 'curse'))) return 'enhance';
    // 進軍（$3）＝捨て札の強いアクションをもう一度使う。
    if (buyable('march') && coins >= 3 && cardBuy == null &&
        p.discard.filter((c) => isType(c, 'action')).length >= 2) return 'march';
    // 輸送（$3）＝追放マットのアクションを山札の上に回収できるときだけ。
    if (buyable('transport') && coins >= 3 && cardBuy == null &&
        (p.exile || []).some((c) => isType(c, 'action'))) return 'transport';
    // 苦労（$2）＝手札に余ったアクションを使う（+1購入も付くので購入権は減らない）。
    if (buyable('toil') && coins >= 2 && cardBuy == null && p.hand.some((c) => isType(c, 'action'))) return 'toil';
    // 乗馬（$2）＝余りコインで馬1枚（次の手番が +2カード +1アクション）。
    if (buyable('ride') && coins >= 2 && cardBuy == null && sup(state, 'horse') > 0) return 'ride';
    // 博打（$2）＝+1購入つきで山札の上を1枚めくって使う（購入権は差し引きゼロ）。余りコインで。
    if (buyable('gamble') && coins >= 2 && cardBuy == null) return 'gamble';
    // 追求（$2）＝+1購入つき。金貨が多いデッキなら次の手番が強くなる。余りコインで。
    if (buyable('pursue') && coins >= 2 && cardBuy == null) return 'pursue';
    // 絶望（$0）＝呪い1枚と引き換えに +1購入 +$2。呪いはデッキを汚すので、**買うものが無い低コイン局面**
    //   （$0〜$2＝+$2 で銀貨に届く）の序盤だけ。$3以上ある局面では素直に買う（呪いを増やさない）。
    if (buyable('desperation') && sup(state, 'curse') > 0 && (p.turns || 0) <= 8 &&
        cardBuy == null && coins < 3) return 'desperation';
    // 遅延（$0）＝手札に余ったアクションを次のターンの頭で使う。余った購入権で。
    if (buyable('delay') && cardBuy == null && t.buys >= 2 && p.hand.some((c) => isType(c, 'action'))) return 'delay';
    // 放逐/投資 は CPU は買わない（追放の使いどころが読みにくい＝skip）。
    return null;
  }
  function E() { return DOM.engine; }

  /* ---------- 選択待ちの解決 ---------- */
  /* 夜想曲：受ける祝福を選ぶときの優先順（ドルイド／愚者）。強い順。 */
  const BOON_RANK = ['the_mountains_gift', 'the_swamps_gift', 'the_skys_gift', 'the_seas_gift',
    'the_suns_gift', 'the_earths_gift', 'the_fields_gift', 'the_forests_gift', 'the_rivers_gift',
    'the_moons_gift', 'the_flames_gift', 'the_winds_gift'];
  function bestBoonOf(set) {
    const list = (set || []).slice();
    if (!list.length) return null;
    list.sort((a, b) => {
      const ia = BOON_RANK.indexOf(a), ib = BOON_RANK.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return list[0];
  }
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
  //   コスト一致は3成分（engine の SWINDLER_GAIN と同じ述語＝拒否される札を提案しない）。
  function pickSwindlerGift(state, pd) {
    const cands = Object.keys(state.supply).filter((id) => costExact(state, id, pd.cost, pd.pot, pd.debt));
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
    // 帝国：闘技場＝購入フェイズのアクションはこのターン使えず、捨てても捨て札に行くだけ（廃棄ではない＝再び引ける）＝ほぼ純粋な+2VP。
    //   未使用の稼ぎ札になり得る財宝兼アクションは避け、無ければ捨てない。
    if (pd.type === 'arena') {
      const cand = p.hand.filter((c) => isType(c, 'action') && !isType(c, 'treasure')).sort((a, b) => (C()[a].cost || 0) - (C()[b].cost || 0));
      return { type: 'ARENA_RESOLVE', card: cand[0] || null };
    }
    // 帝国：峠＝競り。序盤ほど +8VP の価値が大きい（負債は購入を遅らせるだけ＝失点ではない）。真の価値を正直に入札し、
    //   現在の最高額を超えないなら 0（自分の価値を超えて負債を負わない）。
    if (pd.type === 'mountain_pass_bid') {
      const turns = p.turns || 0;
      const myValue = turns <= 4 ? 5 : turns <= 8 ? 3 : turns <= 12 ? 1 : 0;
      const bid = myValue > (pd.highest || 0) ? Math.min(40, myValue) : 0;
      return { type: 'MOUNTAIN_PASS_BID', amount: bid };
    }
    // 帝国：横型イベント（買う横型）の選択待ち。
    if (pd.type === 'salt_the_earth') {
      // サプライの勝利点山1つを廃棄（強制）。CPU＝最も安い勝利点（屋敷）を廃棄（自陣・終局への害が小さい）。
      const cand = Object.keys(state.supply).filter((id) => sup(state, id) > 0 && isTypeSup(state, id, 'victory'))
        .sort((a, b) => cost(state, a) - cost(state, b));
      return { type: 'SALT_TRASH', card: cand[0] || null };
    }
    if (pd.type === 'banquet') {
      return { type: 'BANQUET_GAIN', card: firstGainable(state, (id) => costUpTo(state, id, 5) && !isTypeSup(state, id, 'victory')) };
    }
    if (pd.type === 'advance') {
      if (pd.stage === 'trash') {
        // 手札のアクション1枚を廃棄してよい（may）。$6以下の最善アクションが「一番安い手札アクション」以上なら格上げ、無益なら辞退。
        const acts = p.hand.filter((c) => isType(c, 'action')).sort((a, b) => (C()[a].cost || 0) - (C()[b].cost || 0));
        const target = firstGainable(state, (id) => costUpTo(state, id, 6) && isTypeSup(state, id, 'action'));
        if (acts.length && target && (C()[target].cost || 0) >= (C()[acts[0]].cost || 0)) return { type: 'ADVANCE_TRASH', card: acts[0] };
        return { type: 'ADVANCE_TRASH', card: null };
      }
      return { type: 'ADVANCE_GAIN', card: firstGainable(state, (id) => costUpTo(state, id, 6) && isTypeSup(state, id, 'action')) };
    }
    if (pd.type === 'ritual') {
      // 手札1枚を廃棄（強制・手札があれば）。屋敷（+2VP＆ジャンク除去）＞呪い＞銅貨を優先、無ければ最安札。
      const h = p.hand;
      const pick = (h.includes('estate') && 'estate') || (h.includes('curse') && 'curse') || (h.includes('copper') && 'copper')
        || h.slice().sort((a, b) => (C()[a].cost || 0) - (C()[b].cost || 0))[0];
      return { type: 'RITUAL_TRASH', card: pick };
    }
    if (pd.type === 'tax_pile') {
      // サプライの山1つに負債2を置く（強制）。相手が買いそうな高コスト札（属州＞最高コスト）を狙う。
      // 分割山は上段キーで一元管理するので下段は候補から除く（engine 側でも正規化されるが候補も揃える）。
      const cand = Object.keys(state.supply).filter((id) => C()[id] && !NON_SUPPLY_SET.has(id) && sup(state, id) > 0 && !(DOM.SPLIT_PILES && DOM.SPLIT_PILES[id]));
      // 空の山にも置ける（engine は受理する）＝非空が1つも無ければ在庫条件を外して選ぶ
      //   （窓ゲートの緩和と対＝ここで null を返すと engine拒否×CPU再提案の livelock）。
      if (!cand.length) cand.push(...Object.keys(state.supply).filter((id) => C()[id] && !NON_SUPPLY_SET.has(id) && !(DOM.SPLIT_PILES && DOM.SPLIT_PILES[id])));
      cand.sort((a, b) => (C()[b].cost || 0) - (C()[a].cost || 0));
      const pick = (cand.indexOf('province') >= 0 ? 'province' : cand[0]) || null;
      return { type: 'TAX_PILE', pile: pick };
    }
    if (pd.type === 'donate_trash') {
      // 集めた手札から不要札を廃棄（呪い・屋敷は全部／余剰銅貨は経済を少し残して廃棄）。
      const hand = p.hand;
      const otherTreasure = hand.filter((c) => isTreasure(c) && c !== 'copper').length;
      const keepCopper = otherTreasure >= 3 ? 0 : Math.max(0, 3 - otherTreasure);
      const out = []; let kept = 0;
      hand.forEach((c) => {
        if (isType(c, 'curse') || c === 'estate') { out.push(c); return; }
        if (c === 'copper') { if (kept < keepCopper) kept++; else out.push(c); }
      });
      return { type: 'DONATE_TRASH', cards: out };
    }
    if (pd.type === 'annex_keep') {
      // 捨て札から不要札（trashValue≤2＝呪い/屋敷/銅貨）を最大5枚だけ捨て札に残し、良い札は山札に混ぜる。
      const keep = p.discard.filter((c) => trashValue(c) <= 2).slice(0, 5);
      return { type: 'ANNEX_KEEP', cards: keep };
    }
    /* ===== 冒険：横型イベント（買う横型）の選択待ち＝すべて終端保証（engine が拒否しない選択だけ返す） ===== */
    // 施し／舞踏会＝コスト$4以下を獲得（強制）。engine の upToCanGain と同じ述語で候補を選ぶ。
    if (pd.type === 'alms_gain' || pd.type === 'ball_gain') {
      const card = firstGainable(state, (id) => costUpTo(state, id, 4));
      return { type: pd.type === 'alms_gain' ? 'ALMS_GAIN' : 'BALL_GAIN', card };
    }
    // 海路＝コスト$4以下のアクションを獲得（強制）→ その山に+1購入トークン。
    if (pd.type === 'seaway') {
      return { type: 'SEAWAY_GAIN', card: firstGainable(state, (id) => costUpTo(state, id, 4) && isTypeSup(state, id, 'action')) };
    }
    // 探索＝3択。呪い2枚 → アタック1枚 → 手札7枚以上なら6枚捨て、どれも損なら辞退。
    if (pd.type === 'quest' && pd.stage === 'mode') {
      const curses = p.hand.filter((c) => isType(c, 'curse')).length;
      if (curses >= 2) return { type: 'QUEST_MODE', mode: 'curses' };
      if (p.hand.some((c) => isType(c, 'attack'))) return { type: 'QUEST_MODE', mode: 'attack' };
      if (p.hand.length >= 6 && p.hand.filter((c) => trashValue(c) <= 2).length >= 4) return { type: 'QUEST_MODE', mode: 'six' };
      return { type: 'QUEST_MODE', mode: 'skip' };
    }
    if (pd.type === 'quest' && pd.stage === 'attack') {
      const atk = p.hand.filter((c) => isType(c, 'attack')).sort((a, b) => keepValue(a) - keepValue(b))[0];
      return { type: 'QUEST_DISCARD', cards: atk ? [atk] : [] };
    }
    if (pd.type === 'quest' && pd.stage === 'six') {
      const need = Math.min(6, p.hand.length);
      return { type: 'QUEST_DISCARD', cards: pickDiscards(p.hand, need) };
    }
    // 保存＝手札1枚を脇に置く（次の手札に足せる＝最も価値の高い札を残す）。
    if (pd.type === 'save') {
      const best = p.hand.slice().sort((a, b) => keepValue(b) - keepValue(a))[0];
      return { type: 'SAVE_SETASIDE', card: best || p.hand[0] };
    }
    // 偵察隊＝5枚のうち価値の低い3枚を捨て、残りを価値の高い順に山札の上へ。
    if (pd.type === 'scouting_party' && pd.stage === 'discard') {
      return { type: 'SCOUTING_DISCARD', cards: pickDiscards(pd.cards, 3) };
    }
    if (pd.type === 'scouting_party' && pd.stage === 'order') {
      return { type: 'SCOUTING_ORDER', order: pd.cards.slice().sort((a, b) => keepValue(b) - keepValue(a)) };
    }
    // 焚火＝場の銅貨を（余っていれば）2枚まで廃棄してデッキ圧縮。財宝が乏しいときは削らない。
    if (pd.type === 'bonfire') {
      const deckTreasure = allCards(p).filter((c) => isTreasure(c)).length;
      const inPlayCoppers = p.inPlay.filter((c) => c === 'copper').length;
      const n = deckTreasure >= 7 ? Math.min(2, inPlayCoppers) : 0;
      return { type: 'BONFIRE_TRASH', count: n };
    }
    // 交易＝手札の不要札（呪い/屋敷/余剰銅貨）を最大2枚廃棄して銀貨に替える。
    if (pd.type === 'trade') {
      const deckTreasure = allCards(p).filter((c) => isTreasure(c)).length;
      const cands = p.hand.filter((c) => isType(c, 'curse') || c === 'estate' || (c === 'copper' && deckTreasure >= 7));
      return { type: 'TRADE_TRASH', cards: cands.slice(0, 2) };
    }
    // 巡礼＝場にある名前の異なるカードのうち、価値の高い順に最大3枚のコピーを獲得。
    if (pd.type === 'pilgrimage') {
      const choices = (DOM.engine.pilgrimageChoices(state, pd.player) || [])
        .sort((a, b) => (cost(state, b) - cost(state, a)) || keepValue(b) - keepValue(a));
      return { type: 'PILGRIMAGE_GAIN', cards: choices.slice(0, 3) };
    }
    // 山トークンの置き先＝自分が一番よく使う（一番強い）アクション山。engine の actionSupplyPiles と同じ候補から選ぶ。
    if (pd.type === 'event_token') {
      const piles = DOM.engine.actionSupplyPiles(state) || [];
      if (!piles.length) return { type: 'EVENT_TOKEN_PILE', pile: null };
      const mine = allCards(p);
      const score = (id) => mine.filter((c) => c === id).length * 10 + cost(state, id);
      const pick = piles.slice().sort((a, b) => score(b) - score(a))[0];
      return { type: 'EVENT_TOKEN_PILE', pile: pick };
    }
    // 立案の廃棄トークン＝手札の不要札があれば1枚廃棄（無ければ辞退）。
    if (pd.type === 'plan_trash') {
      const junk = p.hand.filter((c) => isType(c, 'curse') || c === 'estate' || c === 'copper')
        .sort((a, b) => trashValue(a) - trashValue(b))[0];
      return { type: 'PLAN_TRASH', card: junk || null };
    }
    // 移動遊園地＝獲得したカードが強ければ山札の上へ（弱い札＝呪い/銅貨/勝利点は捨て札のまま）。
    if (pd.type === 'travelling_fair') {
      const good = !isType(pd.card, 'curse') && pd.card !== 'copper' && !(isType(pd.card, 'victory') && !isType(pd.card, 'action'));
      return { type: 'TRAVELLING_FAIR_TOPDECK', topdeck: !!good };
    }
    // 相続＝脇に置くカード（コスト$4以下・非命令・非持続のアクション）。キャントリップ系の強い札を選ぶ。
    if (pd.type === 'inheritance') {
      const targets = DOM.engine.inheritanceTargets(state) || [];
      if (!targets.length) return { type: 'INHERITANCE_SET', card: null };
      const rank = (id) => (GAIN_ORDER.indexOf(id) < 0 ? 999 : GAIN_ORDER.indexOf(id));
      return { type: 'INHERITANCE_SET', card: targets.slice().sort((a, b) => rank(a) - rank(b))[0] };
    }
    // 収穫祭：アタックの反応ステップで馬商人を持っていたら、まず脇に置く（次手番に+1カードで戻る＝常に得）。
    // 脇に置くと手札から消えるので、次回の呼び出しでは通常の判断（堀公開/受ける）に進む＝無限ループしない。
    // stage 'react' の各アタックに加え、embedded型（民兵/拷問人＝pending が反応窓を兼ねる）でも脇に置ける。
    if (pd && p.hand && p.hand.includes('horse_traders') &&
        (pd.stage === 'react' || pd.type === 'militia' || pd.type === 'torturer' || pd.type === 'discard_down')) {
      return { type: 'HORSE_TRADERS_REACT' };
    }
    // 異郷：番犬＝アタックの反応窓で手札から先に使う（+2〜4カード・常に得。使うと手札から消え次回は通常判断）。
    if (pd && p.hand && p.hand.includes('guard_dog') &&
        (pd.stage === 'react' || pd.type === 'militia' || pd.type === 'torturer' || pd.type === 'discard_down')) {
      return { type: 'GUARD_DOG_REACT' };
    }
    // 冒険：隊商の護衛＝アタックの反応窓で手札から先にプレイ（+1カード＋次手番+$1・常に得。使うと手札から消え次回は通常判断）。
    if (pd && p.hand && p.hand.includes('caravan_guard') &&
        (pd.stage === 'react' || pd.type === 'militia' || pd.type === 'torturer' || pd.type === 'discard_down')) {
      return { type: 'CARAVAN_GUARD_REACT' };
    }
    // 暗黒時代：物乞い＝アタックの反応窓で手札から捨てて銀貨2枚を獲得（免疫にはならない・常に得。捨てると次回は通常判断）。
    if (pd && p.hand && p.hand.includes('beggar') && sup(state, 'silver') > 0 &&
        (pd.stage === 'react' || pd.type === 'militia' || pd.type === 'torturer' || pd.type === 'discard_down')) {
      return { type: 'BEGGAR_REACT' };
    }
    switch (pd.type) {
      case 'cellar':
        return { type: 'CELLAR_RESOLVE', cards: p.hand.filter((c) => isDead(c)) };
      case 'militia': {
        if (immuneReveal(p)) return immuneReveal(p);
        const need = p.hand.length - 3;
        return { type: 'MILITIA_RESOLVE', cards: pickDiscards(p.hand, need) };
      }
      case 'mine':
        if (pd.stage === 'trash') {
          if (p.hand.includes('silver') && sup(state, 'gold') > 0) return { type: 'MINE_TRASH', card: 'silver' };
          if (p.hand.includes('copper') && sup(state, 'silver') > 0) return { type: 'MINE_TRASH', card: 'copper' };
          return { type: 'MINE_TRASH', card: null };
        }
        return { type: 'MINE_GAIN', card: bestGain(state, pd.maxCost, { treasureOnly: true, pot: pd.pot, debt: pd.debt }) };
      case 'remodel':
        if (pd.stage === 'trash') return { type: 'REMODEL_TRASH', card: pickRemodelTrash(state, p) };
        return { type: 'REMODEL_GAIN', card: bestGain(state, pd.maxCost, pd) };
      case 'workshop':
        return { type: 'WORKSHOP_GAIN', card: bestGain(state, 4, { noVictory: true }) || bestGain(state, 4) };

      /* ===== 拡張: 略奪（Plunder）＝戦利品(Loot) ===== */
      // 賞品のヤギ＝手札1枚を廃棄してもよい（任意）。不要札があるときだけ廃棄する。
      case 'prize_goat': {
        const junk = p.hand.filter((c) => trashValue(c) < 10).sort((a, b) => trashValue(a) - trashValue(b));
        return { type: 'PRIZE_GOAT_TRASH', card: junk.length ? junk[0] : null };
      }
      // ハンマー＝コスト4以下を**強制**獲得（勝利点を避けて最善を取る。候補ゼロなら engine 側が窓を開かない）。
      case 'hammer_gain':
        return { type: 'HAMMER_GAIN', card: bestGain(state, 4, { noVictory: true }) || bestGain(state, 4) };
      // 六分儀＝上5枚のうち不要札を捨て、良い札を山札の上に戻す（地図職人と同じ評価）。
      case 'sextant': {
        const look = (pd.cards || []).slice();
        const disc = look.filter((c) => keepValue(c) < 10);
        const top = look.filter((c) => keepValue(c) >= 10).sort((a, b) => keepValue(b) - keepValue(a));
        return { type: 'SEXTANT_RESOLVE', discard: disc, top };
      }
      // パズルボックス＝良い札を1枚だけ次のターンに持ち越す（不要札しかなければ置かない）。
      case 'puzzle_box': {
        const best = p.hand.slice().sort((a, b) => keepValue(b) - keepValue(a))[0];
        return { type: 'PUZZLE_BOX_SET', card: (best != null && keepValue(best) >= 10) ? best : null };
      }
      // 杖＝手札のアクション1枚を購入フェイズに使用してよい（使えるものがあれば使う）。
      case 'staff_play': {
        const acts = playPool(state, pd.player).filter((c) => DOM.isType(c, 'action'));
        return { type: 'STAFF_PLAY', card: acts.length ? acts.sort((a, b) => keepValue(b) - keepValue(a))[0] : null };
      }
      // アンフォラ＝購入フェイズに出しているので基本は「今」もらう（次ターンに回すのは手番終了間際の判断が要る）。
      case 'amphora':
        return { type: 'AMPHORA_CHOOSE', now: true };
      // 宝珠＝捨て札に使えるアクション/財宝があればそれを使い、無ければ +$3 +1購入。
      case 'orb': {
        const cand = p.discard.filter((c) => DOM.isType(c, 'action') || DOM.isType(c, 'treasure'));
        if (cand.length) return { type: 'ORB_RESOLVE', mode: 'play', card: cand.sort((a, b) => keepValue(b) - keepValue(a))[0] };
        return { type: 'ORB_RESOLVE', mode: 'coin' };
      }
      // 呪符の巻物＝これより安いカードを1枚獲得（強制）。獲得したものは使えるなら使う。
      case 'spell_scroll_gain':
        return { type: 'SPELL_SCROLL_GAIN', card: bestGain(state, pd.limit - 1, { noVictory: true }) || bestGain(state, pd.limit - 1) };
      case 'spell_scroll_play':
        return { type: 'SPELL_SCROLL_PLAY', play: true };
      /* ===== 略奪P2："next time" 型持続 ===== */
      // 檻＝使い道の無い純勝利点カード（アクション/財宝を兼ねない）を最大4枚まで伏せる。呪いは入れない（廃棄機会を残す）。
      case 'cage_set': {
        const stash = p.hand.filter((c) => isType(c, 'victory') && !isType(c, 'action') && !isType(c, 'treasure') && !isType(c, 'curse')).slice(0, 4);
        return { type: 'CAGE_SET', cards: stash };
      }
      // 秘境の社＝不要札（呪い/銅貨/屋敷など trashValue の低い順）を最大2枚廃棄。無ければ廃棄しない。
      case 'shrine_trash': {
        const junk = p.hand.filter((c) => trashValue(c) < 10).sort((a, b) => trashValue(a) - trashValue(b)).slice(0, 2);
        return { type: 'SHRINE_TRASH', cards: junk };
      }
      /* ===== 略奪P3 ===== */
      // 岩屋＝不要札（keepValue の低い順）を最大4枚 伏せて引き直す。
      case 'grotto_set': {
        const junk = p.hand.filter((c) => keepValue(c) < 10).sort((a, b) => keepValue(a) - keepValue(b)).slice(0, 4);
        return { type: 'GROTTO_SET', cards: junk };
      }
      // シャーマン＝不要札があれば1枚廃棄。
      case 'shaman_trash': {
        const junk = p.hand.filter((c) => trashValue(c) < 10).sort((a, b) => trashValue(a) - trashValue(b));
        return { type: 'SHAMAN_TRASH', card: junk.length ? junk[0] : null };
      }
      /* シャーマン（常設）＝廃棄置き場から**必ず**1枚獲得（強制）。良い順＝コストが高く呪いでないもの。
         候補が枯れていたら null（engine 側の終端保証が閉じる）。 */
      case 'shaman_gain': {
        const targets = DOM.engine.shamanTargets(state);
        if (!targets.length) return { type: 'SHAMAN_GAIN', card: null };
        const best = targets.slice().sort((a, b) => {
          const ca = isType(a, 'curse') ? -1 : DOM.engine.cardCost(state, a);
          const cb = isType(b, 'curse') ? -1 : DOM.engine.cardCost(state, b);
          return cb - ca;
        })[0];
        return { type: 'SHAMAN_GAIN', card: best };
      }
      // セイレーン＝堀/盾があれば公開、なければ呪いを受ける。
      case 'siren':
        if (immuneReveal(p)) return immuneReveal(p);
        return { type: 'SIREN_REACT' };
      /* セイレーンの獲得時＝手札に不要なアクション（trashValue が低い）があればそれを廃棄してセイレーンを守る。
         無ければ最も価値の低いアクションを廃棄（セイレーンの方が強いことが多い）。アクションが無いときは
         engine 側が窓を開かない（自動で自己廃棄）。 */
      case 'siren_gain': {
        const acts = p.hand.filter((c) => isType(c, 'action')).sort((a, b) => keepValue(a) - keepValue(b));
        return { type: 'SIREN_GAIN', card: acts.length ? acts[0] : null };
      }
      // 密航者＝持続の獲得に反応して手札から使う（次ターン+2カード＝ほぼ常に得）。
      case 'stowaway_react':
        return { type: 'STOWAWAY_REACT', play: true };
      // 置き去り＝最も不要な札を廃棄（強制）。
      case 'maroon_trash': {
        const order = p.hand.slice().sort((a, b) => trashValue(a) - trashValue(b));
        return { type: 'MAROON_TRASH', card: order[0] };
      }
      // 坩堝＝不要札のうちコストが高いものを廃棄（+$が大きい）。不要札が無ければ最も価値の低い札。
      case 'crucible_trash': {
        const junk = p.hand.filter((c) => trashValue(c) < 10).sort((a, b) => DOM.engine.cardCost(state, b) - DOM.engine.cardCost(state, a));
        const pick = junk.length ? junk[0] : p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b))[0];
        return { type: 'CRUCIBLE_TRASH', card: pick };
      }
      // 巡礼者＝最も価値の低い札を山札の上へ（中庭と同じ発想）。
      case 'pilgrim_put': {
        const order = p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b));
        return { type: 'PILGRIM_PUT', card: order[0] };
      }
      // 小像＝購入フェイズのアクションは死に札＝最も価値の低いアクションを捨てて +1購入 +$1。
      case 'figurine_discard': {
        const acts = p.hand.filter((c) => isType(c, 'action')).sort((a, b) => keepValue(a) - keepValue(b));
        return { type: 'FIGURINE_DISCARD', card: acts.length ? acts[0] : null };
      }
      // ゴンドラ＝基本は「今」もらう。
      case 'gondola_choose':
        return { type: 'GONDOLA_CHOOSE', now: true };
      // ゴンドラの獲得時＝一番良いアクションを使う（無ければ使わない）。
      case 'gondola_play': {
        const acts = playPool(state, pd.player).filter((c) => isType(c, 'action')).sort((a, b) => keepValue(b) - keepValue(a));
        return { type: 'GONDOLA_PLAY', card: acts.length ? acts[0] : null };
      }
      // 工具＝場のカードのうち獲得できる最も高コストのものを取る（獲得できないものしか無ければ先頭＝空振り）。
      case 'tools_gain': {
        const targets = DOM.engine.toolsTargets(state);
        const gainable = targets.filter((c) => DOM.engine.gainableBase(state, c) || DOM.engine.mixedPileWithTop(state, c));
        const pool = gainable.length ? gainable : targets;
        const best = pool.slice().sort((a, b) => DOM.engine.cardCost(state, b) - DOM.engine.cardCost(state, a))[0];
        return { type: 'TOOLS_GAIN', card: best != null ? best : null }; // 候補ゼロなら null（engine が窓を閉じる）
      }
      // つるはし＝コスト3以上の不要札があればそれ（戦利品が付く）。無ければ最も不要な札（強制）。
      case 'pickaxe_trash': {
        const junk = p.hand.filter((c) => trashValue(c) < 10);
        const rich = junk.filter((c) => DOM.engine.cardCost(state, c) >= 3);
        const pick = rich[0] || (junk.length ? junk.sort((a, b) => trashValue(a) - trashValue(b))[0]
          : p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b))[0]);
        return { type: 'PICKAXE_TRASH', card: pick };
      }
      /* 銀山＝これより安い財宝のうち一番良いものを手札へ（銀貨があれば銀貨）。
         ⚠ **engine と同じ成分別比較（costUnder）を使う**。スカラーの `cardCost` で比べると
            賢者の石（$3+ポーション）を「$3<$5」で提案して engine が拒否し続ける＝mix-all（錬金術同居）で
            本番 livelock（レビューのソークで再現）。種別も `isTypeSupply`（混合山は一番上）で見る。 */
      case 'silver_mine_gain': {
        const ref = DOM.engine.cardCost(state, 'silver_mine');
        let best = null, bc = -1;
        Object.keys(state.supply).forEach((id) => {
          if (!DOM.engine.gainableBase(state, id)) return;
          if (!DOM.engine.isTypeSupply(state, id, 'treasure')) return;
          if (!DOM.engine.costUnder(state, id, ref)) return;
          const c = DOM.engine.cardCost(state, id);
          if (c > bc) { bc = c; best = id; }
        });
        return { type: 'SILVER_MINE_GAIN', card: best };
      }
      // キャビンボーイ＝コスト4以上の持続が取れるなら廃棄して獲得、そうでなければ +$2。
      case 'cabin_boy': {
        let good = false;
        Object.keys(state.supply).forEach((id) => {
          if (DOM.engine.gainableBase(state, id) && DOM.isType(id, 'duration') && DOM.engine.cardCost(state, id) >= 4) good = true;
        });
        return { type: 'CABIN_BOY_RESOLVE', choice: good ? 'gain' : 'coin' };
      }
      case 'cabin_boy_gain': {
        let best = null, bc = -1;
        Object.keys(state.supply).forEach((id) => {
          if (!DOM.engine.gainableBase(state, id) || !DOM.isType(id, 'duration')) return;
          const c = DOM.engine.cardCost(state, id);
          if (c > bc) { bc = c; best = id; }
        });
        return { type: 'CABIN_BOY_GAIN', card: best };
      }
      // 縄＝不要札があれば1枚廃棄。
      case 'rope_trash': {
        const junk = p.hand.filter((c) => trashValue(c) < 10).sort((a, b) => trashValue(a) - trashValue(b));
        return { type: 'ROPE_TRASH', card: junk.length ? junk[0] : null };
      }
      /* ===== 略奪P4：特性(Trait) ===== */
      // 敬虔な＝不要札があれば1枚廃棄。
      case 'pious_trash': {
        const junk = p.hand.filter((c) => trashValue(c) < 10).sort((a, b) => trashValue(a) - trashValue(b));
        return { type: 'PIOUS_TRASH', card: junk.length ? junk[0] : null };
      }
      // 友好的な＝手札の友好的なカードを捨てて同じ山から1枚獲得（どうせクリンナップで捨てる＝実質+1枚＝常に得）。
      case 'friendly_discard': {
        const c = p.hand.find((x) => DOM.engine.hasTrait(state, x, 'friendly'));
        return { type: 'FRIENDLY_DISCARD', card: c || null };
      }
      // 忍耐強い＝手札の忍耐強いアクション/財宝を全部脇へ（次のターンにアクション権なしで使える＝ほぼ常に得）。
      case 'patient_set': {
        const cards = p.hand.filter((x) => DOM.engine.hasTrait(state, x, 'patient') && (isType(x, 'action') || isTreasure(x)));
        return { type: 'PATIENT_SET', cards };
      }
      // 内気な＝最も価値の低い内気なカードを捨てて +2カード（純増＝常に得）。
      case 'shy_discard': {
        const shy = p.hand.filter((x) => DOM.engine.hasTrait(state, x, 'shy')).sort((a, b) => keepValue(a) - keepValue(b));
        return { type: 'SHY_DISCARD', card: shy.length ? shy[0] : null };
      }
      // 鼓舞する＝場に出していない一番良いアクションを使う。
      case 'inspiring_play': {
        const cand = (DOM.engine.inspiringTargets ? DOM.engine.inspiringTargets(state, pd.player) : []).slice()
          .sort((a, b) => keepValue(b) - keepValue(a));
        return { type: 'INSPIRING_PLAY', card: cand.length ? cand[0] : null };
      }
      /* ===== 略奪P5：イベント ===== */
      // 埋葬＝捨て札で最も価値の低い札を山札の一番下へ（次のシャッフルまで引かない）。
      case 'bury_put': {
        const order = p.discard.slice().sort((a, b) => keepValue(a) - keepValue(b));
        return { type: 'BURY_PUT', card: order[0] };
      }
      // 危難＝最も価値の低いアクションを廃棄して戦利品（ほぼ常に得）。
      case 'peril_trash': {
        const acts = p.hand.filter((c) => isType(c, 'action')).sort((a, b) => keepValue(a) - keepValue(b));
        return { type: 'PERIL_TRASH', card: acts.length ? acts[0] : null };
      }
      // 襲撃＝価値の低い順に必要枚数（3枚が異なる名前になるかは気にしない＝単純化）。
      case 'foray_discard': {
        const order = p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b));
        return { type: 'FORAY_DISCARD', cards: order.slice(0, pd.need) };
      }
      case 'scrounge':
        if (pd.stage === 'choose') {
          if (state.trash.indexOf('estate') >= 0) return { type: 'SCROUNGE_CHOOSE', choice: 'estate' };
          return { type: 'SCROUNGE_CHOOSE', choice: 'trash' };
        }
        if (pd.stage === 'trash') {
          const order = p.hand.slice().sort((a, b) => trashValue(a) - trashValue(b));
          return { type: 'SCROUNGE_TRASH', card: order[0] };
        }
        return { type: 'SCROUNGE_GAIN', card: bestGain(state, 5, { noVictory: true }) || bestGain(state, 5) };
      case 'maelstrom':
        if (pd.stage === 'trash') {
          const order = p.hand.slice().sort((a, b) => trashValue(a) - trashValue(b));
          return { type: 'MAELSTROM_TRASH', cards: order.slice(0, pd.need) };
        }
        return { type: 'MAELSTROM_VICTIM', card: p.hand.slice().sort((a, b) => trashValue(a) - trashValue(b))[0] };
      case 'invasion':
        if (pd.stage === 'attack') {
          const atk = playPool(state, pd.player).filter((c) => isType(c, 'attack')).sort((a, b) => keepValue(b) - keepValue(a));
          return { type: 'INVASION_ATTACK', card: atk.length ? atk[0] : null };
        }
        {
          let best = null, bc = -1;
          Object.keys(state.supply).forEach((id) => {
            if (!DOM.engine.gainableBase(state, id) || !DOM.engine.isTypeSupply(state, id, 'action')) return;
            const c = DOM.engine.cardCost(state, id);
            if (c > bc) { bc = c; best = id; }
          });
          return { type: 'INVASION_ACTION', card: best };
        }
      // 繁栄＝コスト3以上の（まだ取っていない名前の）財宝を高い順に取り続け、無くなったらやめる。
      case 'prosper_gain': {
        let best = null, bc = 2; // $3 未満（銅貨等）は取らない
        Object.keys(state.supply).forEach((id) => {
          if ((pd.gained || []).indexOf(id) >= 0) return;
          if (!DOM.engine.gainableBase(state, id)) return;
          if (!DOM.engine.isTreasureFor(state, id)) return;
          const c = DOM.engine.cardCost(state, id);
          if (c > bc) { bc = c; best = id; }
        });
        return { type: 'PROSPER_GAIN', card: best };
      }
      // 準備＝アクション（価値の高い順）→財宝 の順で全部使う。
      case 'prepare_play': {
        const aside = (p.prepareAside || []).filter((c) => isType(c, 'action') || DOM.engine.isTreasureFor(state, c));
        if (!aside.length) return { type: 'PREPARE_PLAY', card: null };
        const acts = aside.filter((c) => isType(c, 'action'));
        const pick = (acts.length ? acts : aside).sort((a, b) => keepValue(b) - keepValue(a))[0];
        return { type: 'PREPARE_PLAY', card: pick };
      }
      /* ===== 略奪P6 ===== */
      // 王の隠し財産＝一番価値の高い財宝を3回使う（無ければ使わない）。
      case 'kings_cache_play': {
        const tre = p.hand.filter((c) => DOM.engine.isTreasureFor(state, c) && c !== 'kings_cache')
          .sort((a, b) => keepValue(b) - keepValue(a));
        return { type: 'KINGS_CACHE_PLAY', card: tre.length ? tre[0] : null };
      }
      case 'fortune_hunter':
        if (pd.stage === 'play') {
          const tre = (pd.cards || []).filter((c) => DOM.engine.isTreasureFor(state, c)).sort((a, b) => keepValue(b) - keepValue(a));
          return { type: 'FORTUNE_HUNTER_PLAY', card: tre.length ? tre[0] : null };
        }
        return { type: 'FORTUNE_HUNTER_ARRANGE', top: (pd.cards || []).slice().sort((a, b) => keepValue(b) - keepValue(a)) };
      case 'mapmaker': {
        const order = (pd.cards || []).slice().sort((a, b) => keepValue(b) - keepValue(a));
        return { type: 'MAPMAKER_PICK', cards: order.slice(0, pd.take) };
      }
      case 'mapmaker_react':
        return { type: 'MAPMAKER_REACT', play: true };
      case 'enlarge_trash': {
        const junk = p.hand.filter((c) => trashValue(c) < 10).sort((a, b) => trashValue(a) - trashValue(b));
        const pick = junk.length ? junk[0] : p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b))[0];
        return { type: 'ENLARGE_TRASH', card: pick };
      }
      case 'enlarge_gain':
        return { type: 'ENLARGE_GAIN', card: bestGain(state, pd.maxCost, { noVictory: pd.maxCost < 8, pot: pd.pot, debt: pd.debt }) || bestGain(state, pd.maxCost, { pot: pd.pot, debt: pd.debt }) };
      /* 一等航海士＝同名を全部使う（名前未確定なら一番多く持っている良いアクション）。
         ⚠ **engine と同じ `canPlayHandCard` を通す**（同盟の航海＝手札から3枚まで／将軍＝場に2枚ある同名は
            手札から使えない）。ここを見ないと engine が拒否する手を返し続けて mix-all で本番 livelock になる
            （§0-29 A4 [high] 12番と同型。実際にレビューのソークで再現した）。 */
      case 'first_mate': {
        const canPlay = (c) => !DOM.engine.canPlayHandCard || DOM.engine.canPlayHandCard(state, pd.player, c);
        if (pd.name) {
          return { type: 'FIRST_MATE_PLAY', card: (DOM.engine.canPlayFromHandOrShadow(state, pd.player, pd.name) && canPlay(pd.name)) ? pd.name : null };
        }
        const acts = playPool(state, pd.player).filter((c) => isType(c, 'action') && c !== 'first_mate' && canPlay(c));
        if (!acts.length) return { type: 'FIRST_MATE_PLAY', card: null };
        const byCount = {};
        acts.forEach((c) => { byCount[c] = (byCount[c] || 0) + 1; });
        const pick = acts.slice().sort((a, b) => (byCount[b] - byCount[a]) || (keepValue(b) - keepValue(a)))[0];
        return { type: 'FIRST_MATE_PLAY', card: pick };
      }
      // フリゲート船のリアクション＝堀/盾があれば公開、無ければ受ける。
      case 'frigate':
        if (immuneReveal(p)) return immuneReveal(p);
        return { type: 'LINGER_REACT' };
      case 'trickster':
        if (immuneReveal(p)) return immuneReveal(p);
        return { type: 'TRICKSTER_REACT' };
      // 操舵手＝良い$4以下（銀貨など）が取れるなら貯める。脇に札があれば終盤は回収。単純に「取れるなら獲得」。
      case 'quartermaster': {
        const inst = (p.quartermasters || []).find((q) => q.id === pd.qmId) || { cards: [] };
        /* ⚠ 「取れるか」（＝engine が skip を受理するか）と「取りたいか」（好み）を分ける。
           勝利点/呪いを**実行可能判定からも**外すと、$4以下が屋敷/呪いだけになったとき CPU が skip を送り
           engine が拒否して livelock になる（engine の受理条件は `anyGainable(costUpTo<=4)` だけ）。 */
        let best = null, bc = -1, anyOk = false;
        Object.keys(state.supply).forEach((id) => {
          if (!DOM.engine.costUpTo(state, id, 4)) return;
          anyOk = true;
          if (isType(id, 'victory') || isType(id, 'curse')) return; // 好みとしては避ける
          const c = DOM.engine.cardCost(state, id);
          if (c > bc) { bc = c; best = id; }
        });
        if (best) return { type: 'QUARTERMASTER_RESOLVE', mode: 'gain', card: best };
        if ((inst.cards || []).length) {
          const take = inst.cards.slice().sort((a, b) => keepValue(b) - keepValue(a))[0];
          return { type: 'QUARTERMASTER_RESOLVE', mode: 'take', card: take };
        }
        if (anyOk) { // 脇が空で $4以下が勝利点/呪いしか無い＝skip は受理されないので仕方なく取る
          let any = null;
          Object.keys(state.supply).forEach((id) => { if (!any && DOM.engine.costUpTo(state, id, 4)) any = id; });
          return { type: 'QUARTERMASTER_RESOLVE', mode: 'gain', card: any };
        }
        return { type: 'QUARTERMASTER_RESOLVE', mode: 'skip' };
      }
      // トリックスター＝場の一番価値の高い財宝を（回数まで）持ち越す。
      case 'trickster_aside': {
        const tre = p.inPlay.filter((c) => DOM.engine.isTreasureFor(state, c))
          .sort((a, b) => keepValue(b) - keepValue(a)).slice(0, pd.max);
        return { type: 'TRICKSTER_ASIDE', cards: tre };
      }
      // 鉱山道路＝獲得した財宝は基本使う（コインが増えて損しない）。
      case 'mining_road_play':
        return { type: 'MINING_ROAD_PLAY', play: true };

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
      /* ===== 段階2 第1バッチ ===== */
      // ===== 段階2 第3バッチ（収穫祭＆ギルド2版） =====
      case 'joust_aside': {
        // 褒賞が残っていれば属州を脇に置く（次ターンに褒賞を使える＝ほぼ常に得。終盤は属州を温存しない＝脇置きは捨て札に戻るだけ）
        const any = ['renown', 'courser', 'demesne', 'coronet', 'housecarl', 'huge_turnip'].some((id) => (state.supply[id] || 0) > 0);
        return { type: 'JOUST_ASIDE', aside: any };
      }
      case 'joust_reward': {
        const pref = ['renown', 'courser', 'demesne', 'coronet', 'housecarl', 'huge_turnip'];
        return { type: 'JOUST_REWARD', card: pref.find((id) => (state.supply[id] || 0) > 0) || null };
      }
      case 'coronet': {
        const okC = (c) => DOM.engine.canPlayHandCard(state, pd.player, c);
        if (pd.stage === 'action') {
          const acts = playPool(state, pd.player).filter((c) => isType(c, 'action') && !isType(c, 'reward') && c !== 'coronet' && okC(c)).sort((a, b) => throneValue(b) - throneValue(a));
          return { type: 'CORONET_CHOOSE', card: acts[0] || null };
        }
        const tre = p.hand.filter((c) => isTreasure(c) && !isType(c, 'reward') && okC(c)).sort((a, b) => (C()[b].coin || 0) - (C()[a].coin || 0))[0];
        return { type: 'CORONET_CHOOSE', card: tre || null };
      }
      case 'courser':
        return { type: 'COURSER_RESOLVE', choices: ['cards', p.hand.some((c) => isType(c, 'action')) ? 'actions' : 'coins'] };
      case 'infirmary_trash': {
        const junk = pickTrash(p.hand, 1)[0];
        return { type: 'INFIRMARY_TRASH', card: (junk && trashValue(junk) < 10) ? junk : null };
      }
      case 'shop': {
        const cand = DOM.engine.conclaveTargets(state, pd.player).filter((c) => c !== 'shop');
        if (!cand.length) return { type: 'SHOP_PLAY', card: null };
        const fake = Object.assign({}, p, { hand: cand });
        const pick = chooseAction(Object.assign({}, state, { turn: Object.assign({}, state.turn, { actions: 1 }) }), fake);
        return { type: 'SHOP_PLAY', card: (pick && cand.indexOf(pick) >= 0) ? pick : cand[0] };
      }
      case 'farmhands_aside': {
        // 一番良いアクション（throneValue）→無ければ一番高い財宝（次ターン開始時に使える）→無ければ置かない
        const acts = p.hand.filter((c) => isType(c, 'action')).sort((a, b) => throneValue(b) - throneValue(a));
        if (acts.length) return { type: 'FARMHANDS_ASIDE', card: acts[0] };
        const tre = p.hand.filter((c) => isTreasure(c) && (C()[c].coin || 0) >= 2).sort((a, b) => (C()[b].coin || 0) - (C()[a].coin || 0));
        return { type: 'FARMHANDS_ASIDE', card: tre[0] || null };
      }
      case 'ferryman_discard':
        return { type: 'FERRYMAN_DISCARD', card: pickTrash(p.hand, 1)[0] || p.hand[0] };
      // ===== 段階2 第2バッチ =====
      case 'embargo_pile': {
        // 相手が買いそうで自分は買わない山＝雑に「属州以外の最高コスト」（徴税と同型＝必ず非 null）
        const cand = Object.keys(state.supply).filter((id) => C()[id] && !NON_SUPPLY_SET.has(id) && !(DOM.SPLIT_PILES && DOM.SPLIT_PILES[id]));
        cand.sort((a, b) => (C()[b].cost || 0) - (C()[a].cost || 0));
        const pick = cand.find((id) => id !== 'province' && id !== 'colony' && id !== 'curse') || cand[0] || null;
        return { type: 'EMBARGO_PILE', pile: pick };
      }
      case 'pirate_ship': {
        if (pd.stage === 'react') { if (immuneReveal(p)) return immuneReveal(p); return { type: 'PIRATE_SHIP_REACT' }; }
        if (pd.stage === 'choose') {
          const tok = p.pirateShipTokens || 0;
          // 免疫でない相手が居なければ換金。序盤（トークン<3）は攻撃、溜まったら換金。
          const n = state.players.length, imm = pd.immune || [];
          let targets = 0; for (let k = 1; k < n; k++) { const idx = (pd.source + k) % n; if (imm.indexOf(idx) < 0) targets++; }
          return { type: 'PIRATE_SHIP_CHOOSE', attack: targets > 0 && tok < 3 };
        }
        // pick：最高額の財宝を廃棄（強制・必ず非 null）
        const best = pd.treasures.slice().sort((a, b) => (C()[b].coin || 0) - (C()[a].coin || 0))[0];
        return { type: 'PIRATE_SHIP_PICK', card: best };
      }
      case 'sea_hag':
        if (immuneReveal(p)) return immuneReveal(p);
        return { type: 'SEA_HAG_REACT' };
      case 'ambassador': {
        if (pd.stage === 'react') { if (immuneReveal(p)) return immuneReveal(p); return { type: 'AMBASSADOR_REACT' }; }
        if (pd.stage === 'reveal') {
          const pick = ['curse', 'estate', 'copper'].find((c) => p.hand.includes(c)) || p.hand[0];
          return { type: 'AMBASSADOR_REVEAL', card: pick };
        }
        return { type: 'AMBASSADOR_RETURN', amount: pd.max }; // 屑は最大枚数戻す
      }
      case 'trade_route_trash':
        return { type: 'TRADE_ROUTE_TRASH', card: pickTrash(p.hand, 1)[0] || p.hand[0] };
      case 'contraband_name': {
        // 相手（pd.source）が買いそうな最強札＝属州（無ければ金貨）
        const pick = (state.supply.province || 0) > 0 ? 'province' : 'gold';
        return { type: 'CONTRABAND_NAME', card: pick };
      }
      case 'summon_gain':
        return { type: 'SUMMON_GAIN', card: firstGainable(state, (id) => DOM.engine.summonCanGain(state, id)) }; // firstGainable＝GAIN_ORDER 順＝最良
      case 'pearl_diver': {
        // 一番下のカードが良い札（アクション/銀貨以上）なら上へ
        const c = pd.card; const good = isType(c, 'action') || (isType(c, 'treasure') && c !== 'copper');
        return { type: 'PEARL_DIVER_RESOLVE', top: !!good };
      }
      case 'navigator': {
        // 5枚の中に良い札が2枚以上なければ全部捨てる。戻すなら良い札を上に。
        const cards = pd.cards.slice();
        const score = (c) => isType(c, 'curse') ? -2 : (c === 'copper' || isType(c, 'victory')) ? -1 : isType(c, 'action') ? 2 : 1;
        const goods = cards.filter((c) => score(c) > 0).length;
        if (goods < 2) return { type: 'NAVIGATOR_RESOLVE', discard: true };
        return { type: 'NAVIGATOR_RESOLVE', order: cards.sort((a, b) => score(b) - score(a)) };
      }
      case 'explorer': return { type: 'EXPLORER_RESOLVE', reveal: p.hand.includes('province') };
      case 'ghost_ship': {
        if (pd.stage === 'react') { if (immuneReveal(p)) return immuneReveal(p); return { type: 'GHOST_SHIP_REACT' }; }
        // 山札の上に置く＝次に引く札になる＝**良い札を置く**（民兵と逆）。無ければ一番弱い札。
        const h = p.hand.slice();
        const score = (c) => isType(c, 'curse') ? -2 : (c === 'copper' || isType(c, 'victory')) ? -1 : isType(c, 'action') ? 2 : 1;
        h.sort((a, b) => score(b) - score(a));
        return { type: 'GHOST_SHIP_PUT', card: h[0] };
      }
      case 'counting_house': return { type: 'COUNTING_HOUSE_RESOLVE', amount: pd.max }; // 全部手札へ（$ が増える）
      case 'loan': {
        // 銅貨なら廃棄（圧縮）、銀貨以上は捨てる
        return { type: 'LOAN_RESOLVE', trash: pd.card === 'copper' };
      }
      case 'mountebank': {
        if (pd.stage === 'react') { if (immuneReveal(p)) return immuneReveal(p); return { type: 'MOUNTEBANK_REACT' }; }
        return { type: 'MOUNTEBANK_CHOOSE', discardCurse: p.hand.includes('curse') };
      }
      case 'marchland_discard': {
        // 屑（呪い/銅貨/勝利点）だけ捨てて $ にする
        const junk = p.hand.filter((c) => isType(c, 'curse') || c === 'copper' || isType(c, 'victory'));
        return { type: 'MARCHLAND_DISCARD', cards: junk };
      }
      case 'torturer': {
        // 拷問人の対象側。堀があれば無効化、無ければ呪いより手札2枚捨てを選ぶ
        if (immuneReveal(p)) return immuneReveal(p);
        return { type: 'TORTURER_RESOLVE', choice: 'discard', cards: pickDiscards(p.hand, Math.min(2, p.hand.length)) };
      }
      case 'scout':
        // 順序は戦術的に重要でないため公開順のまま戻す
        return { type: 'SCOUT_RESOLVE', order: pd.cards.slice() };
      case 'swindler':
        if (pd.stage === 'react') {
          // 犠牲者側。react ステージは堀持ちのときだけ作られるので無効化する
          if (immuneReveal(p)) return immuneReveal(p);
          return { type: 'SWINDLER_REACT' };
        }
        // gain ステージ（攻撃側）。相手の利得が最小のカードを与える（候補ありなら必ず非null）
        return { type: 'SWINDLER_GAIN', card: pickSwindlerGift(state, pd) };
      case 'saboteur':
        if (pd.stage === 'react') {
          if (immuneReveal(p)) return immuneReveal(p);
          return { type: 'SABOTEUR_REACT' };
        }
        // gain ステージ（犠牲者・任意）。上限内で最善を拾う。無ければ獲得しない(null)
        return { type: 'SABOTEUR_GAIN', card: bestGain(state, pd.maxCost, { noVictory: true, pot: pd.pot, debt: pd.debt }) || bestGain(state, pd.maxCost, pd) };
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
        if (immuneReveal(p)) return immuneReveal(p);
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
        // ⚠ 同盟：航海の3枚制限／将軍で使えない札を返し続けると engine拒否×CPU提案の livelock になる。
        const ok2 = (c) => isType(c, 'action') && DOM.engine.canPlayHandCard(state, pd.player, c);
        const pool = playPool(state, pd.player);
        const acts = pool.filter((c) => ok2(c) && c !== 'throne_room').sort((a, b) => throneValue(b) - throneValue(a));
        const pick = acts[0] || pool.filter(ok2)[0] || null;
        return { type: 'THRONE_CHOOSE', card: pick };
      }
      case 'library':
        // 単純CPUは引いたアクションをそのまま手札に（脇に置かない）
        return { type: 'LIBRARY_RESOLVE', setAside: false };
      case 'spy':
        if (pd.stage === 'react') { if (immuneReveal(p)) return immuneReveal(p); return { type: 'SPY_REACT' }; }
        { // 自分=不要札を捨てて良い札を残す / 相手=良い札を捨てさせ不要札を残す
          const dead = isType(pd.card, 'victory') || isType(pd.card, 'curse');
          const mine = pd.victim === pd.source;
          return { type: 'SPY_DECIDE', discard: mine ? dead : !dead };
        }
      case 'thief':
        if (pd.stage === 'react') { if (immuneReveal(p)) return immuneReveal(p); return { type: 'THIEF_REACT' }; }
        if (pd.stage === 'pick') {
          const best = pd.treasures.slice().sort((a, b) => (C()[b].coin || 0) - (C()[a].coin || 0))[0];
          return { type: 'THIEF_PICK', card: best };
        }
        // gain: 銀貨・金貨は獲得（銅貨はデッキを汚すので獲得しない）
        return { type: 'THIEF_GAIN', take: (C()[pd.trashed].coin || 0) >= 2 };
      case 'witch':
        // 呪いを受ける側。堀があれば無効化、無ければそのまま（CPUは秘密の小部屋を公開しない）
        if (immuneReveal(p)) return immuneReveal(p);
        return { type: 'WITCH_REACT' };
      case 'bureaucrat':
        if (pd.stage === 'react') {
          if (immuneReveal(p)) return immuneReveal(p);
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
        return { type: 'UPGRADE_GAIN', card: bestGainExact(state, pd.exactCost, { noVictory: true, pot: pd.pot, debt: pd.debt }) || bestGainExact(state, pd.exactCost, pd) };

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
        if (pd.stage === 'react') { if (immuneReveal(p)) return immuneReveal(p); return { type: 'BANDIT_REACT' }; }
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
          // engine と同じ述語（非サプライ/ロック中の分割山下段は「サプライの山」ではない＝拒否される）
          const acts = Object.keys(state.supply).filter((id) => gainableBase(state, id) && isTypeSup(state, id, 'action'))
            .sort((a, b) => cost(state, a) - cost(state, b)); // コストも engine の実コスト（混合山＝一番上）で見る
          return { type: 'LURKER_TRASH', card: acts[0] || null };
        }
        { const acts = state.trash.filter((id) => isType(id, 'action')).sort((a, b) => C()[b].cost - C()[a].cost); return { type: 'LURKER_GAIN', card: acts[0] }; }
      case 'mill': {
        const junk = p.hand.filter((c) => isType(c, 'curse') || c === 'estate' || c === 'copper');
        return { type: 'MILL_RESOLVE', cards: junk.length >= 2 ? junk.slice(0, 2) : [] };
      }
      case 'patrol':
        return { type: 'PATROL_RESOLVE', order: pd.cards.slice() };
      case 'replace':
        if (pd.stage === 'react') { if (immuneReveal(p)) return immuneReveal(p); return { type: 'REPLACE_REACT' }; }
        if (pd.stage === 'trash') return { type: 'REPLACE_TRASH', card: pickRemodelTrash(state, p) };
        return { type: 'REPLACE_GAIN', card: bestGain(state, pd.maxCost, { noVictory: true, pot: pd.pot, debt: pd.debt }) || bestGain(state, pd.maxCost, pd) };
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
          // 「ちょうど +delta」＝廃棄する札のポーション/負債成分も一致していること（engine と同じ述語）。
          const specOf = (c) => ({ noVictory: true, pot: (C()[c] && C()[c].potion) || 0, debt: (C()[c] && C()[c].debt) || 0 });
          const tryT = (c) => p.hand.includes(c) && bestGainExact(state, cost(state, c) + pd.delta, specOf(c));
          let card = null;
          if (tryT('estate')) card = 'estate';
          else if (pd.delta >= 2 && tryT('copper')) card = 'copper';
          else { const acts = p.hand.filter((c) => isType(c, 'action')).sort((a, b) => C()[a].cost - C()[b].cost); if (acts.length && bestGainExact(state, cost(state, acts[0]) + pd.delta, specOf(acts[0]))) card = acts[0]; }
          return { type: 'GOVERNOR_REMODEL_TRASH', card };
        }
        return { type: 'GOVERNOR_REMODEL_GAIN', card: bestGainExact(state, pd.exact, { noVictory: true, pot: pd.pot, debt: pd.debt }) || bestGainExact(state, pd.exact, pd) };
      case 'dismantle':
        if (pd.stage === 'trash') {
          let card;
          if (p.hand.includes('estate')) card = 'estate';
          else { const acts = p.hand.filter((c) => isType(c, 'action') && cost(state, c) >= 1).sort((a, b) => C()[a].cost - C()[b].cost); card = acts[0] || p.hand.slice().sort((a, b) => trashValue(a) - trashValue(b))[0]; }
          return { type: 'DISMANTLE_TRASH', card };
        }
        // 取り壊し＝「廃棄した札より安い」（engine と同じ costUnder。旧スナップショット互換で maxCost+1 から復元）
        { const uc = (pd.coin != null) ? pd.coin : (pd.maxCost || 0) + 1;
          return { type: 'DISMANTLE_GAIN', card: bestGainUnder(state, uc, { noVictory: true, pot: pd.pot, debt: pd.debt }) || bestGainUnder(state, uc, pd) }; }
      /* ===== 新プロモ（王子/船長/教会/サウナ/アヴァント） ===== */
      case 'prince': {
        // 良い対象があれば脇置き、無ければ置かない（王子は普通に捨て札へ＝後で再挑戦できる）。
        return { type: 'PRINCE_SETASIDE', card: bestPrinceTarget(state, p) };
      }
      case 'prince_play':
        return { type: 'PRINCE_PLAY' }; // ターン開始時の強制プレイ（選択なし）
      // 旭日：川船＝ターン開始時に脇の札を動かさず使用（強制・選択なし）。
      case 'riverboat_play':
        return { type: 'RIVERBOAT_PLAY' };
      case 'captain': {
        // 対象があれば必ず使用（公式＝mayではない）。GAIN_ORDER の実強度順で最良を選ぶ。
        const cands = (DOM.engine && DOM.engine.captainTargets) ? DOM.engine.captainTargets(state) : [];
        if (!cands.length) return { type: 'CAPTAIN_PLAY', card: null };
        for (const id of GAIN_ORDER) { if (cands.includes(id)) return { type: 'CAPTAIN_PLAY', card: id }; }
        return { type: 'CAPTAIN_PLAY', card: cands[0] }; // 終端保証（GAIN_ORDER 外でも必ず選ぶ）
      }
      case 'overlord': {
        // 大君主：対象があれば必ず使用（公式＝mayではない）。GAIN_ORDER の実強度順で最良を選ぶ。
        const cands = (DOM.engine && DOM.engine.overlordTargets) ? DOM.engine.overlordTargets(state) : [];
        if (!cands.length) return { type: 'OVERLORD_PLAY', card: null };
        for (const id of GAIN_ORDER) { if (cands.includes(id)) return { type: 'OVERLORD_PLAY', card: id }; }
        return { type: 'OVERLORD_PLAY', card: cands[0] }; // 終端保証（GAIN_ORDER 外でも必ず選ぶ）
      }
      case 'crown': {
        // ⚠ 同盟：航海の3枚制限／将軍で使えない札を返し続けると engine拒否×CPU提案の livelock（玉座と同型）。
        const okC = (c) => DOM.engine.canPlayHandCard(state, pd.player, c);
        if (pd.mode === 'action') {
          // 2回使う価値が高いアクションを選ぶ（玉座と同じ throneValue）。無ければ辞退。
          const acts = playPool(state, pd.player).filter((c) => isType(c, 'action') && c !== 'crown' && okC(c)).sort((a, b) => throneValue(b) - throneValue(a));
          return { type: 'CROWN_CHOOSE', card: acts[0] || null };
        }
        // mode 'treasure'：最もコインの高い財宝を2回使う。無ければ辞退。
        const tre = p.hand.filter((c) => isTreasure(c) && okC(c)).sort((a, b) => (C()[b].coin || 0) - (C()[a].coin || 0))[0];
        return { type: 'CROWN_CHOOSE', card: tre || null };
      }
      case 'church':
        // 脇置きは0枚で確定（戻ってくるだけ＝CPUには利得が薄い）。次ターンの廃棄だけ活用する。
        return { type: 'CHURCH_SETASIDE', cards: [] };
      case 'church_trash': {
        if (p.hand.includes('curse')) return { type: 'CHURCH_TRASH', card: 'curse' };
        return { type: 'CHURCH_TRASH', card: null };
      }
      case 'sauna_chain':
        return { type: 'SAUNA_CHAIN', play: true }; // 相方は常に使う（+3カード/キャントリップ＝常に得）
      case 'sauna_trash': {
        if (p.hand.includes('curse')) return { type: 'SAUNA_TRASH', card: 'curse' };
        // 銅貨は所持が多いときだけ圧縮（財宝を削りすぎない）
        if (p.hand.includes('copper') && owned(p, 'copper') > 4) return { type: 'SAUNA_TRASH', card: 'copper' };
        return { type: 'SAUNA_TRASH', card: null };
      }

      case 'black_market': {
        if (p.hand.some((c) => isTreasure(c))) return { type: 'BLACK_MARKET_PLAY_TREASURES' };
        if ((p.debt || 0) > 0) return { type: 'BLACK_MARKET_SKIP' }; // 帝国：負債があると購入不可＝見送る（膠着回避）
        if (state.turn.noBuyCards) return { type: 'BLACK_MARKET_SKIP' }; // 冒険：使節団の追加ターンはカード購入不可（闇市場も購入）＝見送る
        const coins = state.turn.coins;
        // 負債カード（元手/技術者 等）は闇市場で買わない（余計な負債を負わない）。
        // 夜想曲：錯乱を返したターンは闇市場でもアクションカードを買えない（engine が拒否＝提案すると無限ループ）。
        const aff = pd.revealed.filter((id) => cost(state, id) <= coins && !isType(id, 'curse') && !((C()[id] && C()[id].debt) > 0) &&
          !(state.turn.cantBuyActions && pd.player === state.turn.active && isType(id, 'action')));
        const premium = GAIN_ORDER.slice(0, GAIN_ORDER.indexOf('silver'));
        let pick = null;
        for (const id of premium) { if (aff.includes(id)) { pick = id; break; } }
        return pick ? { type: 'BLACK_MARKET_BUY', card: pick } : { type: 'BLACK_MARKET_SKIP' };
      }

      /* ===== 拡張: 冒険（Adventures）===== */
      case 'dungeon_discard':
        return { type: 'DUNGEON_DISCARD', cards: pickDiscards(p.hand, Math.min(2, p.hand.length)) };
      case 'gear':
        return { type: 'GEAR_SETASIDE', cards: [] }; // 脇置きは戻ってくるだけ＝安全側で0枚（無駄置きしない）
      case 'amulet': {
        // 呪い/屋敷（属州未購入時）があれば廃棄、無ければ経済重視で銀貨を獲得。
        if (p.hand.includes('curse') || (p.hand.includes('estate') && owned(p, 'province') === 0)) return { type: 'AMULET_RESOLVE', mode: 'trash' };
        return { type: 'AMULET_RESOLVE', mode: 'silver' };
      }
      case 'amulet_trash': {
        const order = p.hand.slice().sort((a, b) => trashValue(a) - trashValue(b));
        return { type: 'AMULET_TRASH', card: order[0] };
      }
      // 冒険：酒場マット（Reserve）の呼び出し・守銭奴。
      case 'miser': {
        // 手札に銅貨があれば貯める（圧縮＋守銭奴強化）、無ければマットの銅貨を換金。
        if (p.hand.includes('copper')) return { type: 'MISER_RESOLVE', mode: 'bank' };
        return { type: 'MISER_RESOLVE', mode: 'coins' };
      }
      case 'tavern_start': {
        const mat = p.tavern || [];
        const junk = p.hand.slice().sort((a, b) => trashValue(a) - trashValue(b))[0];
        const hasJunk = junk != null && trashValue(junk) < 10; // 不要札（銅貨/屋敷/呪い等）があるか
        if (mat.includes('ratcatcher') && hasJunk) return { type: 'TAVERN_START_CALL', card: 'ratcatcher' };
        if (mat.includes('transmogrify') && hasJunk) return { type: 'TAVERN_START_CALL', card: 'transmogrify' };
        // 案内人＝手札が弱い（財宝価値≤2かつアクション無し、または呪い持ち）ときだけ引き直す。
        const handCoin = p.hand.reduce((s, c) => s + (isTreasure(c) ? (C()[c].coin || 0) : 0), 0);
        const weak = p.hand.includes('curse') || (handCoin <= 2 && !p.hand.some((c) => isType(c, 'action')));
        if (mat.includes('guide') && weak) return { type: 'TAVERN_START_CALL', card: 'guide' };
        // 教師＝置ける山があれば呼んでトークン配置（常に得）。
        if (mat.includes('teacher') && DOM.engine.validTeacherPiles && DOM.engine.validTeacherPiles(state, pd.player).length) return { type: 'TAVERN_START_CALL', card: 'teacher' };
        return { type: 'TAVERN_START_CALL', card: null }; // 呼び出さない
      }
      case 'teacher_call': {
        const piles = (DOM.engine.validTeacherPiles ? DOM.engine.validTeacherPiles(state, pd.player) : []);
        if (pd.stage === 'token') {
          // まだ置いていないトークンを優先（card→coin→action→buy の順）。全部置き済みなら card を移動。
          const placed = new Set(Object.keys(p.pileTokens || {}));
          const tk = ['card', 'coin', 'action', 'buy'].find((x) => !placed.has(x)) || 'card';
          return { type: 'TEACHER_TOKEN', token: tk };
        }
        // pile：自分のトークンが無いアクション山のうち、残っている山を優先し、最もコストの高い山（強いカード）へ。
        const pick = piles.slice().sort((a, b) => (sup(state, b) > 0) - (sup(state, a) > 0) || cost(state, b) - cost(state, a))[0];
        return { type: 'TEACHER_PILE', card: pick };
      }
      case 'ratcatcher_trash':
        return { type: 'RATCATCHER_TRASH', card: p.hand.slice().sort((a, b) => trashValue(a) - trashValue(b))[0] };
      case 'transmogrify_trash':
        return { type: 'TRANSMOGRIFY_TRASH', card: p.hand.slice().sort((a, b) => trashValue(a) - trashValue(b))[0] };
      case 'transmogrify_gain':
        return { type: 'TRANSMOGRIFY_GAIN', card: bestGain(state, pd.maxCost, pd) };
      case 'wine_merchant':
        return { type: 'WINE_MERCHANT_DISCARD', discard: true }; // マットから捨てて再利用（+$4を再演可能に）＝常に得
      case 'after_action': {
        const mat = p.tavern || [];
        // 御料車＝再演の価値が高いアクションを解決した直後なら再演（強力なドロー/アタック/経済）。
        if (mat.includes('royal_carriage') && p.inPlay.includes(pd.card) && throneValue(pd.card) >= 3)
          return { type: 'AFTER_ACTION_CALL', card: 'royal_carriage' };
        // 法貨＝アクション権が尽きていて手札にまだアクションがあるなら +2アクション。
        if (mat.includes('coin_of_the_realm') && state.turn.actions === 0 && p.hand.some((c) => isType(c, 'action')))
          return { type: 'AFTER_ACTION_CALL', card: 'coin_of_the_realm' };
        return { type: 'AFTER_ACTION_CALL', card: null }; // 呼び出さない
      }
      case 'duplicate': {
        // コスト$4以上の非ジャンク（呪い/銅貨/屋敷/廃墟でない）を獲得したときだけコピー＝常に得。
        const c = pd.card;
        const worth = cost(state, c) >= 4 && c !== 'curse' && !isType(c, 'ruins');
        return { type: 'DUPLICATE_CALL', call: worth };
      }
      // 冒険：アタックを受ける側（堀があれば無効化、無ければそのまま受ける＝react のみ・効果は自動）。
      case 'relic': // -1カードトークンは自動
        if (immuneReveal(p)) return immuneReveal(p);
        return { type: 'RELIC_REACT' };
      case 'giant': // 公開→廃棄/呪いは自動
        if (immuneReveal(p)) return immuneReveal(p);
        return { type: 'GIANT_REACT' };
      case 'bridge_troll': // -$1トークンは自動
        if (immuneReveal(p)) return immuneReveal(p);
        return { type: 'BRIDGE_TROLL_REACT' };
      case 'haunted_woods': // 呪いの森：堀で免疫、無ければそのまま受ける（購入時に手札が山札の上へ）
      case 'swamp_hag':     // 沼の妖婆：堀で免疫、無ければそのまま受ける（購入時に呪い獲得）
      case 'gatekeeper':    // 移動動物園：門番＝堀で免疫、無ければ受ける（獲得したアクション/財宝が追放される）
        if (immuneReveal(p)) return immuneReveal(p);
        return { type: 'LINGER_REACT' };
      // 冒険：トラベラー（page/peasant＋成長先）
      case 'warrior': // 山札上を捨て$3/$4廃棄（自動）＝堀があれば無効化
        if (immuneReveal(p)) return immuneReveal(p);
        return { type: 'WARRIOR_REACT' };
      case 'soldier': {
        if (pd.stage === 'react') {
          if (immuneReveal(p)) return immuneReveal(p);
          return { type: 'SOLDIER_REACT' };
        }
        // discard：最も手札に残す価値の低いカードを1枚捨てる。
        return { type: 'SOLDIER_DISCARD', card: p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b))[0] };
      }
      case 'fugitive_discard':
        return { type: 'FUGITIVE_DISCARD', card: p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b))[0] };
      case 'hero_gain': {
        let g = null;
        for (const id of ['platinum', 'gold', 'silver', 'copper']) { if (gainableBase(state, id)) { g = id; break; } }
        if (!g) g = firstGainable(state, (id) => isTreasureNow(state, id)); // 財宝ならコスト制限なし（engine と同じ isTreasureFor）
        return { type: 'HERO_GAIN', card: g };
      }
      case 'disciple_play': {
        // 手札のアクション（門下生自身以外）を2度使い＋コピー獲得。最も再演価値の高いものを選ぶ。
        //   冒険：相続した屋敷もアクション（命令）＝対象にできる（engine と同じ述語を見る）。
        //   ⚠ canPlayHandCard（航海の3枚制限／将軍）も engine と同じに見る（見ないと livelock）。
        const acts = playPool(state, pd.player).filter((c) => (isType(c, 'action') || DOM.engine.inheritedEstate(p, c)) && c !== 'disciple' && DOM.engine.canPlayHandCard(state, pd.player, c));
        if (!acts.length) return { type: 'DISCIPLE_PLAY', card: null };
        const best = acts.slice().sort((a, b) => throneValue(b) - throneValue(a))[0];
        return { type: 'DISCIPLE_PLAY', card: best };
      }
      case 'traveller_exchange':
        // 成長先は常により強い（→ヒーロー/チャンピオン/教師）＝常に交換して系列を進める。
        return { type: 'TRAVELLER_EXCHANGE_RESOLVE', exchange: true };
      // 冒険：複雑系
      case 'raze': {
        if (pd.stage === 'trash') {
          // 「これ」を廃棄できるか。命令（大君主/はみだし者/船長/王子）で動かさずに使った場合と
          // 玉座の2回目は false＝engine が拒否するので、CPU も提案しない（engine拒否とCPU非提案はセット）。
          if (pendingSelf(state, pd, 'raze')) return { type: 'RAZE_TRASH', card: 'raze' }; // 自身を廃棄（thin＋2枚掘る）
          return { type: 'RAZE_TRASH', card: p.hand.slice().sort((a, b) => trashValue(a) - trashValue(b))[0] }; // 玉座2回目/命令経由＝手札の最junk
        }
        // look：最も残す価値の高い1枚を手札へ
        return { type: 'RAZE_LOOK', card: pd.cards.slice().sort((a, b) => keepValue(b) - keepValue(a))[0] };
      }
      case 'artificer': {
        if (pd.stage === 'discard') {
          // 不要札（呪い/銅貨/屋敷/廃墟）を捨てて、その枚数ちょうどのカードを山札上に獲得（枚数が良い獲得先になるとき）。
          const junk = p.hand.filter((c) => isDead(c));
          // 捨て枚数=nで良い獲得先($2以上の非勝利点)があるnを探す（最大 junk 枚数まで）。無ければ0枚捨て。
          let best = 0;
          for (let x = junk.length; x >= 1; x--) { if (x >= 2 && bestGainExact(state, x, { noVictory: true })) { best = x; break; } }
          return { type: 'ARTIFICER_DISCARD', cards: junk.slice(0, best) };
        }
        // gain：ちょうど pd.exact の最良（$2以上のみ・$0/$1は獲得しない）
        const g = pd.exact >= 2 ? (bestGainExact(state, pd.exact, { noVictory: true }) || bestGainExact(state, pd.exact)) : null;
        return { type: 'ARTIFICER_GAIN', card: g };
      }
      case 'storyteller':
        // MONEY方針：財宝をカードに変えるとコインを失う＝0枚プレイ（基本+1カードのみ引く安全策）。
        return { type: 'STORYTELLER_PLAY', cards: [] };
      case 'messenger_play':
        return { type: 'MESSENGER_PLAY', discard: false }; // 山札は捨てない（既知の山札上を保持）
      case 'messenger_gain':
        return { type: 'MESSENGER_GAIN', card: bestGain(state, 4) };

      /* ===== 拡張: 帝国（Empires）Batch E1 ===== */
      case 'engineer': {
        if (pd.stage === 'gain1' || pd.stage === 'gain2')
          return { type: 'ENGINEER_GAIN', card: bestGain(state, 4, { noVictory: true }) || bestGain(state, 4) };
        // maytrash：良い獲得先（$4以下・非勝利点）があれば技術者を廃棄してもう1枚獲得する（ダブル工房）。
        return { type: 'ENGINEER_TRASH', trash: !!bestGain(state, 4, { noVictory: true }) };
      }

      /* ===== 拡張: 帝国（Empires）Batch E2 ===== */
      case 'sacrifice': {
        // 廃棄する不要札を価値順に選ぶ（屋敷=+2VP／銅貨=+$2／呪い=圧縮／その他 dead）。
        // 生贄は必須廃棄（手札があれば必ず1枚）＝最後は生贄自身でも廃棄する（玉座/王の宮廷/行進で手札が生贄だけになった時に
        //   card:null を返すと engine が拒否し pending が閉じず CPU 無限ループになる＝敵対レビュー確定バグの回避）。
        const h = p.hand.filter((c) => c !== 'sacrifice');
        const pick = h.find((c) => c === 'estate') || h.find((c) => c === 'copper') || h.find((c) => c === 'curse')
          || h.slice().sort((a, b) => trashValue(a) - trashValue(b))[0] || p.hand[0] || null;
        return { type: 'SACRIFICE_TRASH', card: pick };
      }
      case 'forum':
        return { type: 'FORUM_DISCARD', cards: pickDiscards(p.hand, Math.min(2, p.hand.length)) };
      case 'charm_mode':
        // MONEY方針＝確実な +1購入 +$2 を選ぶ（モードBの獲得コピーは使わない＝許容簡略化）。
        return { type: 'CHARM_MODE', mode: 'coins' };
      case 'charm_gain': {
        // モードBは通常選ばないが、万一立ったら同コスト・別名の最良カードを1枚（無ければ辞退＝count減少で終端）。
        const pick = firstGainable(state, (id) => id !== pd.trig && costExact(state, id, pd.coin, pd.pot, pd.debt));
        return { type: 'CHARM_GAIN', card: pick };
      }
      case 'legionary_reveal':
        // 金貨があれば常に公開（金貨は手札に残る＝ノーリスクでアタック）。
        return { type: 'LEGIONARY_REVEAL', reveal: p.hand.includes('gold') };
      case 'enchantress':
        // 反応ステップ：堀があれば無効化、なければそのまま受ける（enchanted される）。
        if (immuneReveal(p)) return immuneReveal(p);
        return { type: 'ENCHANTRESS_REACT' };
      case 'archive_pick': {
        // 脇の中から最も価値の高い札を先に手札へ（keepValue 高い順）。
        const st = (p.archives || []).find((a) => a.id === pd.archiveId);
        const cards = (st && st.cards) || [];
        const pick = cards.slice().sort((a, b) => keepValue(b) - keepValue(a))[0] || null;
        return { type: 'ARCHIVE_PICK', card: pick };
      }

      /* ===== 拡張: 帝国（Empires）Batch E3：集合 ===== */
      case 'temple_trash': {
        // 名前の異なる不要札を最大3枚（強制で最低1枚）。curse/estate/copper 等を優先。
        const seen = new Set(); const distinct = [];
        p.hand.slice().sort((a, b) => trashValue(a) - trashValue(b)).forEach((c) => { if (!seen.has(c)) { seen.add(c); distinct.push(c); } });
        const junk = distinct.filter((c) => trashValue(c) < 10);
        let pick = junk.slice(0, 3);
        if (pick.length === 0) pick = distinct.slice(0, 1); // 手札があれば強制1枚（最も価値の低い）
        return { type: 'TEMPLE_TRASH', cards: pick };
      }
      case 'wild_hunt': {
        // 山上VPが十分たまり屋敷が残っていれば回収（VPを得る）。それ以外は +3カード。
        const vp = (state.pileVP && state.pileVP.wild_hunt) || 0;
        if (vp >= 3 && sup(state, 'estate') > 0) return { type: 'WILD_HUNT_RESOLVE', choice: 'estate' };
        return { type: 'WILD_HUNT_RESOLVE', choice: 'cards' };
      }

      /* ===== 拡張: 帝国（Empires）Batch E4：分割山 ===== */
      case 'encampment_reveal':
        // 金貨か鹵獲品を公開して陣地を場に残す（キャントリップ村として得）。どちらも無ければ pending は立たない。
        return { type: 'ENCAMPMENT_REVEAL', card: p.hand.includes('gold') ? 'gold' : (p.hand.includes('plunder') ? 'plunder' : null) };
      case 'settlers':
      case 'bustling_village':
        // 捨て札から 銅貨/開拓者 を手札へ（このターンの economy／無料アクション＝常に得）。
        return { type: 'SETTLERS_RESOLVE', take: true };
      case 'catapult': {
        if (pd.stage === 'react') { if (immuneReveal(p)) return immuneReveal(p); return { type: 'CATAPULT_REACT' }; }
        // 廃棄（強制）＝最も価値の低い不要札。銅貨は財宝なので廃棄すると相手の手札も削れる（+圧縮）。
        const junk = p.hand.filter((c) => c !== 'catapult').sort((a, b) => trashValue(a) - trashValue(b));
        return { type: 'CATAPULT_TRASH', card: junk[0] || p.hand[0] || null };
      }
      case 'gladiator': {
        if (pd.stage === 'match') return { type: 'GLADIATOR_MATCH', reveal: true }; // 左隣＝同名を公開してボーナスを消す（ノーコスト）
        // reveal：左隣に持たれにくいカード（銅貨以外）を優先公開＝ボーナス(+$1・剣闘士廃棄)を得やすく。
        const nonCopper = p.hand.find((c) => c !== 'copper');
        return { type: 'GLADIATOR_REVEAL', card: nonCopper || p.hand[0] };
      }

      /* ===== 拡張: 帝国（Empires）Batch E5：城 ===== */
      case 'small_castle':
        // CPUは小さい城を積極プレイしない（VP温存）。万一立ったら空振り（廃棄せず＝2VP保持・終端）。
        return { type: 'SMALL_CASTLE_RESOLVE', card: null };
      case 'opulent_castle':
        // 手札の勝利点カードを全て捨てて +$2/枚（捨てるだけ＝所有VPは失わない）。
        return { type: 'OPULENT_CASTLE_DISCARD', cards: p.hand.filter((c) => isType(c, 'victory')) };
      case 'haunted_topdeck': {
        // 被害者：手札から2枚を山札の上へ（最も価値の低い2枚＝次手番の手札への影響を最小化）。
        const two = p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b)).slice(0, Math.min(2, p.hand.length));
        return { type: 'HAUNTED_TOPDECK', cards: two };
      }
      case 'sprawling_castle':
        // 公領（1枚3点・デッキ圧迫少）を優先。公領が無ければ屋敷3枚。
        return { type: 'SPRAWLING_CASTLE_CHOOSE', choice: sup(state, 'duchy') > 0 ? 'duchy' : 'estates' };

      /* ===== 拡張: 移動動物園（Menagerie）===== */
      // 追放マットの払い戻し＝同名を獲得したので、追放してあるぶんを捨て札に戻すか。
      //   デッキに入れたくない札（呪い/廃墟/避難所）は追放したままにするのが得＝戻さない。それ以外は全部戻す。
      case 'exile_discard': {
        const junk = DOM.isType(pd.card, 'curse') || DOM.isType(pd.card, 'ruins') || DOM.isType(pd.card, 'shelter');
        return { type: 'EXILE_DISCARD', n: junk ? 0 : DOM.engine.exileCount(state.players[pd.player], pd.card) };
      }
      // 艀＝次のターンに持ち越す（先引き5枚＋3枚で強い手番になる）。終盤で今すぐ買い足したいときだけ「今」。
      case 'barge_choose':
        return { type: 'BARGE_CHOOSE', choice: (sup(state, 'province') <= 2 || state.turn.phase === 'buy') ? 'now' : 'next' };
      // 賞金稼ぎ＝追放マットに同名が無い札のうち、最も要らないものを追放する（+$3 が付く）。
      case 'bounty_hunter_exile': {
        const ex = (c) => DOM.engine.exileCount(p, c) > 0;
        const fresh = p.hand.filter((c) => !ex(c));
        const pool = fresh.length ? fresh : p.hand;
        return { type: 'BOUNTY_HUNTER_EXILE', card: pool.slice().sort((a, b) => keepValue(a) - keepValue(b))[0] };
      }
      // ラクダの隊列＝金貨を追放しておく（後で金貨を獲得したときにまとめて回収できる）。
      case 'camel_train_exile': {
        const ids = DOM.engine.exilableSupplyIds(state).filter((id) => !DOM.isType(id, 'victory'));
        // 候補ゼロでも null を返さない（null は decide() の呼び出し側で TypeError になり、
        //   オンラインでは CPU の手番が二度と進まなくなる）。engine 側に終端保証があるので送れば窓が閉じる。
        if (!ids.length) return { type: 'CAMEL_TRAIN_EXILE', card: null };
        const pref = ['gold', 'silver'];
        const pick = pref.find((id) => ids.indexOf(id) >= 0) || ids.slice().sort((a, b) => cost(state, b) - cost(state, a))[0];
        return { type: 'CAMEL_TRAIN_EXILE', card: pick };
      }
      // 黒猫／枢機卿／魔女の集会のアタックを受ける（堀があれば公開して無効化）。
      case 'black_cat':
        return immuneReveal(p) ? immuneReveal(p) : { type: 'BLACK_CAT_REACT' };
      case 'cardinal':
        if (pd.stage === 'react') return immuneReveal(p) ? immuneReveal(p) : { type: 'CARDINAL_REACT' };
        // 追放されるのは自分のカード＝一番惜しくない方を選ぶ。
        return { type: 'CARDINAL_PICK', card: (pd.cands || []).slice().sort((a, b) => keepValue(a) - keepValue(b))[0] };
      case 'coven':
        return immuneReveal(p) ? immuneReveal(p) : { type: 'COVEN_REACT' };
      // 強制退去＝要らない手札を追放して、その +$2 で買えるものを取る。
      case 'displace_exile':
        return { type: 'DISPLACE_EXILE', card: p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b))[0] };
      case 'displace_gain': {
        const c = firstGainable(state, (id) => id !== pd.from && costUpTo(state, id, pd.maxCost, { pot: pd.pot, debt: pd.debt }));
        return { type: 'DISPLACE_GAIN', card: c };
      }
      // 鷹匠＝これより安いカードを手札に獲得（強いものを優先）。
      case 'falconer_gain':
        return { type: 'FALCONER_GAIN', card: bestGainUnder(state, pd.under) };
      case 'falconer_react':
        return { type: 'FALCONER_REACT', play: true };
      // ヤギ飼い＝要らない札があれば廃棄（呪い・銅貨・屋敷）。無ければ廃棄しない。
      case 'goatherd_trash': {
        const junk = p.hand.filter((c) => c === 'curse' || c === 'copper' || c === 'estate' || DOM.isType(c, 'ruins'));
        return { type: 'GOATHERD_TRASH', card: junk.length ? junk.sort((a, b) => keepValue(a) - keepValue(b))[0] : null };
      }
      // 馬丁＝$4以下で一番強いものを獲得（アクションなら馬・財宝なら銀貨も付く）。
      case 'groom_gain':
        return { type: 'GROOM_GAIN', card: bestGain(state, 4) };
      // 旅籠（獲得時）＝銅貨だけを捨てて馬に変える（銀貨/金貨は残す）。
      case 'hostelry_discard':
        return { type: 'HOSTELRY_DISCARD', cards: p.hand.filter((c) => c === 'copper') };
      // 狩猟小屋＝手札が細いときだけ引き直す。
      case 'hunting_lodge_choose':
        return { type: 'HUNTING_LODGE_CHOOSE', discard: p.hand.length <= 2 };
      // 首謀者＝手札で一番強いアクションを3回使う。
      case 'mastermind_play': {
        // ⚠ canPlayHandCard（航海の3枚制限／将軍）を engine と同じに見る（見ないと livelock）。
        const acts = playPool(state, pd.player).filter((c) => DOM.isType(c, 'action') && DOM.engine.canPlayHandCard(state, pd.player, c));
        if (!acts.length) return { type: 'MASTERMIND_PLAY', card: null };
        return { type: 'MASTERMIND_PLAY', card: acts.slice().sort((a, b) => throneValue(b) - throneValue(a))[0] };
      }
      // 聖域＝要らない札を追放（デッキから消える＝圧縮）。無ければ追放しない。
      case 'sanctuary_exile': {
        const junk = p.hand.filter((c) => c === 'curse' || c === 'copper' || c === 'estate' || DOM.isType(c, 'ruins'));
        return { type: 'SANCTUARY_EXILE', card: junk.length ? junk.sort((a, b) => keepValue(a) - keepValue(b))[0] : null };
      }
      // がらくた＝一番要らない札を廃棄し、コスト分だけ効果を選ぶ。
      case 'scrap_trash':
        return { type: 'SCRAP_TRASH', card: p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b))[0] };
      case 'scrap_choose': {
        // 有用な順（引く→アクション→コイン→銀貨→馬→購入）に、必要な個数だけ選ぶ。
        const order = ['card', 'action', 'coin', 'silver', 'horse', 'buy'];
        return { type: 'SCRAP_CHOOSE', choices: order.slice(0, Math.min(pd.count, 6)) };
      }
      // 牧羊犬＝+2カードは常に得。
      case 'sheepdog_react':
        return { type: 'SHEEPDOG_REACT', play: true };
      // そり＝強いカードを獲得したときだけ、そりを捨てて山札の上に置く（次の手番で使える）。
      case 'sleigh_react':
        return { type: 'SLEIGH_REACT', where: cost(state, pd.card) >= 5 ? 'deck' : null };
      // 村有緑地＝次のターンに持ち越す（自分の手番の頭で +1カード +2アクション）。
      case 'village_green_choose':
        return { type: 'VILLAGE_GREEN_CHOOSE', choice: 'next' };
      case 'village_green_react':
        return { type: 'VILLAGE_GREEN_REACT', play: true };
      // 行人＝銀貨は取っておく。
      case 'wayfarer_gain':
        return { type: 'WAYFARER_GAIN', gain: true };
      // 炉＝いま使ったカードが$3以上ならコピーを獲得する。
      case 'kiln_gain':
        return { type: 'KILN_GAIN', gain: cost(state, pd.card) >= 3 };
      /* --- 習性（Way）の選択待ち --- */
      // チョウ＝山に戻して1コイン高いカードを取れるなら常に得。
      case 'way_butterfly':
        return { type: 'WAY_BUTTERFLY', ret: true };
      case 'way_butterfly_gain':
        return { type: 'WAY_BUTTERFLY_GAIN', card: bestGainExact(state, pd.exactCost, { pot: pd.pot, debt: pd.debt }) };
      // ヤギ＝一番要らない手札を廃棄（強制）。
      case 'way_goat_trash':
        return { type: 'WAY_GOAT_TRASH', card: p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b))[0] };
      // ドブネズミ＝銅貨を捨てて同じカードをもう1枚もらえるなら得。銅貨が無ければ見送る。
      case 'way_rat_discard': {
        const t2 = p.hand.filter((c) => isTreasureNow(state, c)).sort((a, b) => keepValue(a) - keepValue(b))[0];
        return { type: 'WAY_RAT_DISCARD', card: (t2 === 'copper') ? t2 : null };
      }
      // アザラシ＝強いカードなら山札の上に置いて次の手番で使う。
      case 'way_seal_topdeck':
        return { type: 'WAY_SEAL_TOPDECK', top: cost(state, pd.card) >= 4 };

      /* --- 移動動物園：イベント20種の選択待ち（すべて終端保証＝engine が拒否しない値を返す） --- */
      // 特価品＝$5以下の勝利点でないカードで一番強いものを獲得（強制。候補ゼロなら engine 側で窓が開かない）。
      case 'bargain_gain':
        return { type: 'BARGAIN_GAIN', card: firstGainable(state, (id) => DOM.engine.bargainCanGain(state, id)) };
      // 要求＝$4以下で一番強いものを山札の上に獲得（強制）。
      case 'demand_gain':
        return { type: 'DEMAND_GAIN', card: bestGain(state, 4) };
      // 絶望＝呪い1枚と引き換えに +1購入 +$2。**そのコインで今すぐ買い足せるときだけ**取る（無駄な呪いを増やさない）。
      case 'desperation': {
        // 呪い（-1VP＋死に札）を取るのは「+$2 で実際に買えるものが増える」ときだけ＝$3未満のとき。
        //   $3以上なら既に銀貨が買えるので、+$2 のために呪いを増やす価値は薄い（判定はコインについて単調）。
        const want = state.turn.coins < 3 && (p.turns || 0) <= 12;
        return { type: 'DESPERATION', gain: !!want };
      }
      // 放逐＝手札の一番要らない札（呪い/銅貨/屋敷/廃墟）を全部まとめて追放する（デッキ圧縮）。無ければ追放しない。
      case 'banish': {
        const junk = p.hand.filter((c) => c === 'curse' || c === 'copper' || c === 'estate' || DOM.isType(c, 'ruins'));
        if (!junk.length) return { type: 'BANISH_EXILE', card: null };
        const pick = junk.slice().sort((a, b) => keepValue(a) - keepValue(b))[0];
        return { type: 'BANISH_EXILE', card: pick, n: p.hand.filter((c) => c === pick).length };
      }
      // 投資＝相手が使いそうな（＝相手のデッキに入りやすい）強いアクションに投資する。
      case 'invest': {
        const ids = DOM.engine.exilableSupplyIds(state).filter((id) => DOM.isType(id, 'action'));
        if (!ids.length) return { type: 'INVEST_EXILE', card: null }; // 候補ゼロでも null を返さない（engine が窓を閉じる）
        return { type: 'INVEST_EXILE', card: ids.slice().sort((a, b) => cost(state, b) - cost(state, a))[0] };
      }
      // 輸送＝追放マットに自分のアクションがあれば山札の上に回収、無ければサプライから強いアクションを追放。
      case 'transport': {
        if (pd.stage === 'mode') {
          const mine = (p.exile || []).some((c) => DOM.isType(c, 'action'));
          return { type: 'TRANSPORT_MODE', mode: mine ? 'return' : 'exile' };
        }
        if (pd.stage === 'return') {
          const mine = (p.exile || []).filter((c) => DOM.isType(c, 'action'));
          return { type: 'TRANSPORT_PICK', card: mine.slice().sort((a, b) => cost(state, b) - cost(state, a))[0] };
        }
        const ids = DOM.engine.exilableSupplyIds(state).filter((id) => DOM.isType(id, 'action'));
        if (!ids.length) return { type: 'TRANSPORT_PICK', card: null }; // 候補ゼロでも null を返さない（engine が窓を閉じる）
        return { type: 'TRANSPORT_PICK', card: ids.slice().sort((a, b) => cost(state, b) - cost(state, a))[0] };
      }
      // 苦労＝手札で一番強いアクションを使う（アクション権を消費しない）。
      case 'toil': {
        const acts = playPool(state, pd.player).filter((c) => DOM.isType(c, 'action'));
        if (!acts.length) return { type: 'TOIL_PLAY', card: null };
        return { type: 'TOIL_PLAY', card: acts.slice().sort((a, b) => throneValue(b) - throneValue(a))[0] };
      }
      // 進軍＝捨て札で一番強いアクションを使う。
      case 'march': {
        const acts = p.discard.filter((c) => DOM.isType(c, 'action'));
        if (!acts.length) return { type: 'MARCH_PLAY', card: null };
        return { type: 'MARCH_PLAY', card: acts.slice().sort((a, b) => throneValue(b) - throneValue(a))[0] };
      }
      // 博打＝めくれたアクション/財宝は基本的に使う（購入フェイズなので財宝はそのままコインになる）。
      case 'gamble':
        return { type: 'GAMBLE_PLAY', play: true };
      // 遅延＝手札で一番強いアクションを脇に置く（次のターンの頭でアクション権を使わずに使える）。
      case 'delay': {
        const acts = p.hand.filter((c) => DOM.isType(c, 'action'));
        if (!acts.length) return { type: 'DELAY_SETASIDE', card: null };
        return { type: 'DELAY_SETASIDE', card: acts.slice().sort((a, b) => throneValue(b) - throneValue(a))[0] };
      }
      // 遅延／刈り入れ＝ターン開始時の強制プレイ（選択なし）。
      case 'event_play':
        return { type: 'EVENT_PLAY' };
      // 増大＝要らない札を廃棄して $2 高いカードに変える。廃棄する価値が無ければ見送る。
      case 'enhance': {
        if (pd.stage === 'gain') {
          return { type: 'ENHANCE_GAIN', card: bestGain(state, pd.maxCost, { pot: pd.pot, debt: pd.debt }) };
        }
        const cands = p.hand.filter((c) => !DOM.isType(c, 'victory'));
        if (!cands.length) return { type: 'ENHANCE_TRASH', card: null };
        const pick = cands.slice().sort((a, b) => keepValue(a) - keepValue(b))[0];
        // 廃棄しても「+$2 で取れる何か」がある場合だけ廃棄する（無ければ丸損）。
        const ref = DOM.engine.costOf(state, pick);
        const got = firstGainable(state, (id) => costUpTo(state, id, ref.coin + 2, { pot: ref.pot, debt: ref.debt }));
        return { type: 'ENHANCE_TRASH', card: (got && keepValue(pick) <= 40) ? pick : null };
      }
      // 追求＝自分のデッキで一番多い「強い札」を指名する（山札の上4枚から拾える確率が高い）。
      case 'pursue': {
        const owned = allCards(p);
        const cand = ['gold', 'province', 'silver'].concat(owned.filter((c) => DOM.isType(c, 'action')));
        const cnt = {};
        owned.forEach((c) => { cnt[c] = (cnt[c] || 0) + 1; });
        const pick = cand.filter((c) => cnt[c]).sort((a, b) => (keepValue(b) * 100 + cnt[b]) - (keepValue(a) * 100 + cnt[a]))[0];
        return { type: 'PURSUE_NAME', card: pick || 'gold' };
      }
      // 植民＝残りをまとめて獲得する（獲得順にこだわらない＝engine が高コスト順に処理する）。
      case 'populate':
        return { type: 'POPULATE_GAIN', auto: true };

      /* ===== 拡張: 夜想曲（Nocturne）＝祝福／呪詛／状態 =====
         **どの分岐でも null を返さない**（オンラインで reduce(state,null) が TypeError →部屋が固まる）。
         任意効果は `{type:'X', card:null}`＝辞退を返す。 */
      case 'boon_wind': // 風の恵み＝手札2枚を捨てる（強制）
        return { type: 'BOON_WIND_DISCARD', cards: pickDiscards(p.hand, Math.min(2, p.hand.length)) };
      case 'boon_flame': { // 炎の恵み＝手札1枚を廃棄してもよい（呪い/銅貨/屋敷だけ捨てる）
        const junk = p.hand.slice().sort((a, b) => trashValue(a) - trashValue(b))[0];
        const worth = junk != null && trashValue(junk) <= 2;
        return { type: 'BOON_FLAME_TRASH', card: worth ? junk : null };
      }
      case 'boon_earth': { // 大地の恵み＝財宝1枚を捨てて $4以下を獲得してもよい（銅貨を捨てられるときだけ）
        const cop = p.hand.includes('copper') ? 'copper' : null;
        return { type: 'BOON_EARTH_DISCARD', card: cop };
      }
      case 'boon_earth_gain':
        return { type: 'BOON_EARTH_GAIN', card: bestGain(state, 4) };
      case 'boon_sky': { // 空の恵み＝手札3枚を捨てて金貨（手札が3枚以上あり、捨てる3枚が安いときだけ）
        if (p.hand.length < 3) return { type: 'BOON_SKY_DISCARD', cards: null };
        const cards = pickDiscards(p.hand, 3);
        const cheap = cards.every((c) => keepValue(c) <= 60);
        return { type: 'BOON_SKY_DISCARD', cards: cheap ? cards : null };
      }
      case 'boon_moon': { // 月の恵み＝捨て札の1枚を山札の上に（一番良い札を戻す）
        const best = p.discard.slice().sort((a, b) => keepValue(b) - keepValue(a))[0];
        return { type: 'BOON_MOON_TOPDECK', card: (best != null && keepValue(best) >= 60) ? best : null };
      }
      case 'look_arrange': { // 太陽の恵み／夜警＝要らない札を捨て、残りを良い順に山札の上へ
        const discard = (pd.cards || []).filter((c) => isDead(c));
        const top = (pd.cards || []).filter((c) => !isDead(c)).sort((a, b) => keepValue(b) - keepValue(a));
        return { type: 'LOOK_ARRANGE_RESOLVE', discard, top };
      }
      case 'hex': // 呪詛のリアクション窓（堀があれば公開して免れる）
        if (immuneReveal(p)) return immuneReveal(p);
        return { type: 'HEX_REACT' };
      case 'hex_poverty':
        return { type: 'HEX_POVERTY_DISCARD', cards: pickDiscards(p.hand, Math.max(0, p.hand.length - 3)) };
      case 'hex_fear': { // 恐怖＝アクションか財宝1枚を捨てる（強制。最も価値の低いものを）
        const cand = p.hand.filter((c) => isType(c, 'action') || isTreasureNow(state, c))
          .sort((a, b) => keepValue(a) - keepValue(b));
        return { type: 'HEX_FEAR_DISCARD', card: cand[0] != null ? cand[0] : null };
      }
      case 'hex_haunting': { // 憑依＝手札1枚を山札の上へ（強制。どうせ引き直すので価値の低い札）
        const c = p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b))[0];
        return { type: 'HEX_HAUNTING_TOPDECK', card: c != null ? c : null };
      }
      case 'hex_locusts': { // 蝗害＝同じ種別でより安いカードを獲得（強制）
        const okId = (id) => costUnder(state, id, pd.coin, { pot: pd.pot || 0, debt: pd.debt || 0 }) &&
          DOM.engine.sharesType(id, pd.ref);
        return { type: 'HEX_LOCUSTS_GAIN', card: firstGainable(state, okId) };
      }
      case 'lost_in_the_woods': { // 森の迷子＝手札1枚を捨てて祝福を1つ受けてもよい（要らない札があるときだけ）
        const junk = p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b))[0];
        const worth = junk != null && keepValue(junk) <= 40;
        return { type: 'LOST_IN_WOODS', card: worth ? junk : null };
      }
      case 'blessed_village_boon': // 恵みの村＝今受ける（次のターンまで持ち越す価値の判断は難しいので即時）
        return { type: 'BLESSED_VILLAGE_BOON', now: true };
      case 'cemetery_trash': { // 墓地＝手札の不要札（呪い/銅貨/屋敷）を最大4枚まとめて廃棄
        const junk = p.hand.filter((c) => trashValue(c) <= 2).slice(0, 4);
        return { type: 'CEMETERY_TRASH', cards: junk };
      }
      case 'conclave': { // コンクラーベ＝場に同名が無いアクションを1枚使う（chooseAction の優先順で選ぶ）
        const cand = DOM.engine.conclaveTargets(state, pd.player);
        if (!cand.length) return { type: 'CONCLAVE_PLAY', card: null };
        const hand = p.hand;
        const fake = Object.assign({}, p, { hand: cand });
        const pick = chooseAction(Object.assign({}, state, { turn: Object.assign({}, state.turn, { actions: 1 }) }), fake);
        return { type: 'CONCLAVE_PLAY', card: (pick && cand.indexOf(pick) >= 0) ? pick : cand[0] };
      }
      case 'druid_boon': { // ドルイド＝脇の祝福3枚から1つ（強制）
        const set = ((state.boons && state.boons.druid) || []);
        return { type: 'DRUID_BOON', boon: bestBoonOf(set) };
      }
      case 'boon_choose': { // 愚者＝取った祝福を1つずつ好きな順で受ける
        const set = ((state.turn.boonChoice && state.turn.boonChoice.boons) || []);
        return { type: 'BOON_CHOOSE', boon: bestBoonOf(set) };
      }
      case 'grove_offer': // 聖なる木立ち＝相手が配る祝福は基本もらう（デメリットのある祝福は無い）
        return { type: 'GROVE_OFFER', take: true };
      case 'pixie_trash': { // ピクシー＝良い祝福（銀貨/ウィル・オ・ウィスプ/金貨）なら廃棄して2回受ける
        const good = ['the_mountains_gift', 'the_swamps_gift', 'the_skys_gift', 'the_suns_gift', 'the_seas_gift'];
        return { type: 'PIXIE_TRASH', trash: good.indexOf(pd.boon) >= 0 };
      }
      case 'pooka_trash': { // プーカ＝銅貨があれば廃棄して +4カード（呪われた金貨は対象外）
        const cand = p.hand.filter((c) => isTreasureNow(state, c) && c !== 'cursed_gold')
          .sort((a, b) => trashValue(a) - trashValue(b));
        const pick = cand.find((c) => trashValue(c) <= 2) || null;
        return { type: 'POOKA_TRASH', card: pick };
      }
      case 'secret_cave': { // 秘密の洞窟＝手札3枚がすべて安ければ捨てて次ターン +3コイン
        if (p.hand.length < 3) return { type: 'SECRET_CAVE_DISCARD', cards: null };
        const cards = pickDiscards(p.hand, 3);
        const cheap = cards.every((c) => keepValue(c) <= 50);
        return { type: 'SECRET_CAVE_DISCARD', cards: cheap ? cards : null };
      }
      case 'shepherd_discard': { // 羊飼い＝手札の勝利点カードを全部捨てて +2カード/枚
        const vic = p.hand.filter((c) => isType(c, 'victory'));
        return { type: 'SHEPHERD_DISCARD', cards: vic };
      }
      case 'tragic_hero_gain': // 悲劇のヒーロー＝最も良い財宝を獲得（強制）
        return { type: 'TRAGIC_HERO_GAIN', card: bestGain(state, 99, { treasureOnly: true }) };
      case 'goat_trash': { // ヤギ＝不要札があれば廃棄
        const junk = p.hand.slice().sort((a, b) => trashValue(a) - trashValue(b))[0];
        return { type: 'GOAT_TRASH', card: (junk != null && trashValue(junk) <= 2) ? junk : null };
      }
      case 'haunted_mirror': { // 呪いの鏡＝アクション1枚を捨てて幽霊（強い）を獲得する
        const acts = p.hand.filter((c) => isType(c, 'action')).sort((a, b) => keepValue(a) - keepValue(b));
        return { type: 'HAUNTED_MIRROR_GHOST', card: acts[0] != null ? acts[0] : null };
      }
      case 'faithful_hound_react': // 忠犬＝脇に置いてターン終了時に手札へ戻す（常に得）
        return { type: 'FAITHFUL_HOUND_REACT', setAside: true };
      case 'idol': // 偶像（財宝アタック）のリアクション窓
        if (immuneReveal(p)) return immuneReveal(p);
        return { type: 'IDOL_REACT' };
      case 'attack_window': // 「アタックを使用した」ことだけに反応する窓（人狼のドロー側／迫害者のインプ側）
        if (immuneReveal(p)) return immuneReveal(p);
        return { type: 'ATTACK_WINDOW_REACT' };
      /* ---- 夜想曲：夜行カード ---- */
      case 'cobbler_gain': // カブラー＝コスト4以下を手札に獲得（強制）
        return { type: 'COBBLER_GAIN', card: bestGain(state, 4) };
      case 'crypt_setaside': { // 納骨堂＝場の持続でない財宝を全部脇に置く（次のターン以降に手札へ）
        const cand = p.inPlay.filter((c) => isTreasureNow(state, c) && !isType(c, 'duration'));
        return { type: 'CRYPT_SETASIDE', cards: cand };
      }
      case 'crypt_pick': { // 納骨堂＝脇から1枚（良い財宝から）
        const best = (p.cryptSetAside || []).slice().sort((a, b) => keepValue(b) - keepValue(a))[0];
        return { type: 'CRYPT_PICK', card: best != null ? best : null };
      }
      case 'devils_workshop_gain':
        return { type: 'DEVILS_WORKSHOP_GAIN', card: bestGain(state, 4) };
      case 'exorcist_trash': { // 悪魔祓い＝不要札を廃棄（精霊が取れるよう、なるべく高いコストの不要札）
        const junk = p.hand.slice().sort((a, b) => trashValue(a) - trashValue(b));
        const pick = junk.find((c) => trashValue(c) <= 3) || junk[0];
        return { type: 'EXORCIST_TRASH', card: pick != null ? pick : null };
      }
      case 'exorcist_gain': { // 悪魔祓い＝取れる中で一番強い精霊（幽霊＞インプ＞ウィル・オ・ウィスプ）
        // ⚠ 精霊は非サプライ＝costUnder（gainableBase 込み）では候補ゼロになる。engine と同じ述語を見ること。
        const cand = DOM.engine.exorcistSpirits(state, { coin: pd.coin, pot: pd.pot || 0, debt: pd.debt || 0 });
        const pick = ['ghost', 'imp', 'will_o_wisp'].find((id) => cand.indexOf(id) >= 0) || cand[0] || null;
        return { type: 'EXORCIST_GAIN', card: pick };
      }
      case 'monastery': { // 修道院＝呪い/銅貨/屋敷を1枚ずつ廃棄（無ければやめる）
        const junk = p.hand.slice().sort((a, b) => trashValue(a) - trashValue(b))[0];
        if (junk != null && trashValue(junk) <= 2) return { type: 'MONASTERY_TRASH', card: junk };
        if (p.inPlay.includes('copper')) return { type: 'MONASTERY_TRASH', card: 'copper', fromPlay: true };
        return { type: 'MONASTERY_TRASH', card: null };
      }
      case 'raider':
        if (pd.stage === 'react') { if (immuneReveal(p)) return immuneReveal(p); return { type: 'RAIDER_REACT' }; }
        { // 夜襲＝捨てる1枚は「最も価値の低い候補」
          const inPlay = new Set(state.players[pd.source].inPlay.concat(state.players[pd.source].durationCards || []));
          const cand = [...new Set(p.hand.filter((c) => inPlay.has(c)))].sort((a, b) => keepValue(a) - keepValue(b));
          return { type: 'RAIDER_DISCARD', card: cand[0] != null ? cand[0] : null };
        }
      case 'imp_play': { // インプ＝場に同名が無いアクションを1枚使う
        const cand = DOM.engine.conclaveTargets(state, pd.player);
        if (!cand.length) return { type: 'IMP_PLAY', card: null };
        const fake = Object.assign({}, p, { hand: cand });
        const pick = chooseAction(Object.assign({}, state, { turn: Object.assign({}, state.turn, { actions: 1, phase: 'action' }) }), fake);
        return { type: 'IMP_PLAY', card: (pick && cand.indexOf(pick) >= 0) ? pick : cand[0] };
      }
      case 'wish_gain': // 願い＝コスト6以下を手札に獲得（強制）
        return { type: 'WISH_GAIN', card: bestGain(state, 6) };
      /* ---- 夜想曲 N4：交換・廃棄置き場からのプレイ・2度使用 ---- */
      case 'changeling_gain': { // 取り替え子＝場のカードで一番良いものを獲得（山から取れるものを優先）
        const cand = [...new Set(p.inPlay.concat(p.durationCards || []))];
        if (!cand.length) return { type: 'CHANGELING_GAIN', card: null };
        const ok = cand.filter((id) => gainableBase(state, id)).sort((a, b) => cost(state, b) - cost(state, a));
        return { type: 'CHANGELING_GAIN', card: ok[0] != null ? ok[0] : cand[0] };
      }
      case 'changeling_exchange': { // 取り替え子＝いらない獲得（呪い以外の安い札）だけ交換する
        const c = pd.card;
        const worse = c === 'copper' || c === 'estate' || isType(c, 'curse') ||
          (!isType(c, 'victory') && !isTreasureNow(state, c) && cost(state, c) <= 3);
        return { type: 'CHANGELING_EXCHANGE', exchange: !!worse };
      }
      case 'bat_trash': { // コウモリ＝不要札を最大2枚廃棄して吸血鬼に交換する
        const junk = p.hand.filter((c) => trashValue(c) <= 2).slice(0, 2);
        return { type: 'BAT_TRASH', cards: junk };
      }
      case 'vampire_gain': // 吸血鬼＝コスト5以下（吸血鬼以外）で一番良いもの（強制）
        return { type: 'VAMPIRE_GAIN', card: firstGainable(state, (id) => costUpTo(state, id, 5) && id !== 'vampire') };
      case 'necromancer': { // ネクロマンサー＝廃棄置き場の一番強いアクションを使う
        const cand = DOM.engine.necromancerTargets(state);
        if (!cand.length) return { type: 'NECROMANCER_PLAY', index: null };
        const best = cand.slice().sort((a, b) => cost(state, state.trash[b]) - cost(state, state.trash[a]))[0];
        return { type: 'NECROMANCER_PLAY', index: best };
      }
      case 'ghost_play': // 幽霊＝強制（脇のアクションを2度使う）
        return { type: 'GHOST_PLAY' };
      case 'zombie_apprentice': { // ゾンビの弟子＝不要なアクションがあれば廃棄して +3カード+1アクション
        const acts = p.hand.filter((c) => isType(c, 'action')).sort((a, b) => trashValue(a) - trashValue(b));
        const pick = acts.find((c) => trashValue(c) <= 50) || null;
        return { type: 'ZOMBIE_APPRENTICE', card: pick };
      }
      case 'zombie_mason_gain':
        return { type: 'ZOMBIE_MASON_GAIN', card: bestGain(state, pd.coin, { pot: pd.pot || 0, debt: pd.debt || 0 }) };
      case 'zombie_spy': { // ゾンビの密偵＝山札の上が不要札なら捨てる
        const top = pd.card;
        return { type: 'ZOMBIE_SPY', discard: top != null && isDead(top) };
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
        if (immuneReveal(p)) return immuneReveal(p);
        return { type: 'CUTPURSE_REACT' };
      case 'sea_witch':
        if (immuneReveal(p)) return immuneReveal(p);
        return { type: 'SEA_WITCH_REACT' };
      case 'sea_witch_discard':
        return { type: 'SEA_WITCH_DISCARD', cards: pickDiscards(p.hand, Math.min(2, p.hand.length)) };
      case 'smugglers': {
        // 右隣の獲得の中で最も価値の高いものを真似る（GAIN_ORDER優先）。
        //   engine は受理時にも述語を再検査するので、CPU も同じ述語で絞る（拒否される札を提案しない）。
        const cands = (pd.candidates || []).filter((id) => costUpTo(state, id, 6));
        if (!cands.length) return { type: 'SMUGGLERS_GAIN', card: null };
        let pick = cands[0];
        for (const id of GAIN_ORDER) { if (cands.includes(id)) { pick = id; break; } }
        return { type: 'SMUGGLERS_GAIN', card: pick };
      }
      case 'blockade':
        if (pd.stage === 'react') {
          // 犠牲者側。堀があれば公開して免疫、無ければそのまま受ける。
          if (immuneReveal(p)) return immuneReveal(p);
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
        if (pd.stage === 'react') { if (immuneReveal(p)) return immuneReveal(p); return { type: 'SCRYING_REACT' }; }
        { // 自分＝アクション以外を捨ててアクションまで掘る／相手＝良い札を捨てさせ死に札を残す
          const mine = pd.victim === pd.source;
          const isAct = isType(pd.card, 'action');
          const junk = isType(pd.card, 'curse') || pd.card === 'estate';
          return { type: 'SCRYING_DECIDE', discard: mine ? !isAct : !junk };
        }
      case 'university': {
        // 非サプライ（賞品/成長先）とロック中の分割山下段は engine が獲得を拒否する＝提案すると無限ループになる
        //   （bestGain/bestGainExact/pickSwindlerGift には入っている除外の書き漏れ＝今回のレビューで発見した既存バグ）。
        const actGain = firstGainable(state, (id) => costUpTo(state, id, 5) && isTypeSup(state, id, 'action'));
        return { type: 'UNIVERSITY_GAIN', card: actGain || null };
      }
      case 'familiar':
        if (immuneReveal(p)) return immuneReveal(p);
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
        if (immuneReveal(p)) return immuneReveal(p);
        return { type: 'CHARLATAN_REACT' };
      case 'rabble':
        if (immuneReveal(p)) return immuneReveal(p);
        return { type: 'RABBLE_REACT' };
      case 'clerk':
        if (pd.stage === 'react') {
          if (immuneReveal(p)) return immuneReveal(p);
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
        return { type: 'EXPAND_GAIN', card: bestGain(state, pd.maxCost, { noVictory: true, pot: pd.pot, debt: pd.debt }) || bestGain(state, pd.maxCost, pd) };
      case 'forge':
        if (pd.stage === 'trash') return { type: 'FORGE_TRASH', cards: p.hand.filter((c) => c === 'estate') };
        return { type: 'FORGE_GAIN', card: bestGainExact(state, pd.exact, { noVictory: true }) || bestGainExact(state, pd.exact) };
      case 'kings_court': {
        const acts = playPool(state, pd.player).filter((c) => isType(c, 'action') && DOM.engine.canPlayHandCard(state, pd.player, c));
        const nonKc = acts.filter((c) => c !== 'kings_court').sort((a, b) => throneValue(b) - throneValue(a));
        const card = nonKc[0] || acts.slice().sort((a, b) => throneValue(b) - throneValue(a))[0] || null;
        return { type: 'KINGS_COURT_CHOOSE', card };
      }
      case 'war_chest':
        if (pd.stage === 'name') return { type: 'WAR_CHEST_NAME', card: bestGain(state, 5, { noVictory: true }) || bestGain(state, 5) || 'curse' };
        { const named = (state.turn.warChestNamed) || [];
          const g = firstGainable(state, (id) => costUpTo(state, id, 5) && named.indexOf(id) < 0);
          return { type: 'WAR_CHEST_GAIN', card: g }; }
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
        if (immuneReveal(p)) return immuneReveal(p);
        return { type: 'FORTUNE_TELLER_REACT' };
      case 'horse_traders':
        return { type: 'HORSE_TRADERS_DISCARD', cards: pickDiscards(p.hand, Math.min(2, p.hand.length)) };
      case 'remake':
        if (pd.stage === 'trash') return { type: 'REMAKE_TRASH', card: pickRemodelTrash(state, p) };
        return { type: 'REMAKE_GAIN', card: bestGainExact(state, pd.exactCost, { noVictory: true, pot: pd.pot, debt: pd.debt }) || bestGainExact(state, pd.exactCost, pd) };
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
        if (immuneReveal(p)) return immuneReveal(p);
        return { type: 'YOUNG_WITCH_REACT' };
      case 'jester':
        if (pd.stage === 'react') {
          if (immuneReveal(p)) return immuneReveal(p);
          return { type: 'JESTER_REACT' };
        }
        { // choose: 捨てられた札が良ければ自分が獲得、悪い(勝利点/呪い/銅貨)なら相手に押し付ける
          const c = pd.card;
          const bad = isType(c, 'victory') || isType(c, 'curse') || c === 'copper';
          return { type: 'JESTER_CHOOSE', who: bad ? 'victim' : 'me' };
        }
      case 'followers':
        if (pd.stage === 'react') {
          if (immuneReveal(p)) return immuneReveal(p);
          return { type: 'FOLLOWERS_REACT' };
        }
        return { type: 'FOLLOWERS_DISCARD', cards: pickDiscards(p.hand, p.hand.length - 3) };
      case 'trusty_steed':
        // 常に +2カードを軸に、他にアクションがあれば +2アクション、無ければ +2コイン
        return { type: 'TRUSTY_STEED_RESOLVE', choices: ['cards', p.hand.some((c) => isType(c, 'action')) ? 'actions' : 'coins'] };
      case 'horn_of_plenty':
        // 勝利点を獲得すると豊穣の角自身を廃棄する＝終盤（属州が残り少ない）以外は非勝利点を選ぶ。
        return { type: 'HORN_OF_PLENTY_GAIN', card: bestGain(state, pd.maxCost, { noVictory: true }) || bestGain(state, pd.maxCost) };

      /* ===== 拡張: ギルド（Guilds）===== */
      case 'overpay': {
        // いくら過払いするか。名品＝銀貨レートが良いので全額／石工＝2枚とれる最大コスト／伝令官＝捨て札の良札分／医者＝しない。
        const card = pd.card, max = pd.max;
        let amt = 0;
        if (card === 'masterpiece') amt = max; // 過払い1コイン→銀貨1枚は好レート。全額。
        else if (card === 'stonemason') {
          for (let x = max; x >= 1; x--) {
            if (firstGainable(state, (id) => costExact(state, id, x, 0, 0) && isTypeSup(state, id, 'action') && !isTypeSup(state, id, 'victory'))) { amt = x; break; }
          }
        } else if (card === 'farrier') amt = max; // 装蹄師：ターン終了時 +1カード/コイン＝全額（余ったコインは捨てるだけ）
        else if (card === 'infirmary') amt = Math.min(max, p.hand.filter((c) => trashValue(c) < 10).length + 1); // 診療所：廃棄したい屑の枚数ぶん
        else if (card === 'herald') {
          const good = p.discard.filter((c) => keepValue(c) >= 60).length; // 良い札を山札の上へ
          amt = Math.min(max, good, 2);
        } // doctor は過払いしない（安全側＝amt=0）
        return { type: 'OVERPAY_RESOLVE', amount: amt };
      }
      case 'stonemason_overpay': {
        const g = firstGainable(state, (id) => costExact(state, id, pd.exact, 0, 0) && isTypeSup(state, id, 'action'));
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
        // 石工＝「廃棄した札より安い」（pd.maxCost は**廃棄した札のコスト**＝その未満。engine と同じ costUnder）
        return { type: 'STONEMASON_GAIN', card: bestGainUnder(state, pd.maxCost, { noVictory: true, pot: pd.pot, debt: pd.debt }) || bestGainUnder(state, pd.maxCost, pd) };
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
        if (pd.stage === 'react') { if (immuneReveal(p)) return immuneReveal(p); return { type: 'TAXMAN_REACT' }; }
        if (pd.stage === 'trash') {
          if (p.hand.includes('copper') && sup(state, 'silver') > 0) return { type: 'TAXMAN_TRASH', card: 'copper' }; // 銅貨→銀貨（圧縮＋テンポ）
          if (p.hand.includes('silver') && sup(state, 'gold') > 0) return { type: 'TAXMAN_TRASH', card: 'silver' };  // 銀貨→金貨
          const tre = p.hand.filter((c) => isTreasure(c)).sort((a, b) => (C()[a].coin || 0) - (C()[b].coin || 0))[0];
          return { type: 'TAXMAN_TRASH', card: tre || null };
        }
        return { type: 'TAXMAN_GAIN', card: bestGain(state, pd.maxCost, { treasureOnly: true, pot: pd.pot, debt: pd.debt }) };
      case 'butcher':
        if (pd.stage === 'trash') {
          const junk = p.hand.includes('curse') ? 'curse' : (p.hand.includes('estate') ? 'estate' : (p.hand.includes('copper') ? 'copper' : null));
          return { type: 'BUTCHER_TRASH', card: junk };
        }
        if (pd.stage === 'pay') {
          const coffers = p.coffers || 0;
          const total = pd.trashedCost + coffers;
          const spec = { pot: pd.pot, debt: pd.debt };
          const target = bestGain(state, total, { noVictory: true, pot: pd.pot, debt: pd.debt }) || bestGain(state, total, spec);
          const need = target ? Math.max(0, cost(state, target) - pd.trashedCost) : 0;
          return { type: 'BUTCHER_PAY', amount: Math.min(coffers, need) };
        }
        return { type: 'BUTCHER_GAIN', card: bestGain(state, pd.maxCost, { noVictory: true, pot: pd.pot, debt: pd.debt }) || bestGain(state, pd.maxCost, pd) };
      case 'journeyman': {
        const named = owned(p, 'curse') > 0 ? 'curse' : (owned(p, 'estate') > 0 ? 'estate' : (owned(p, 'copper') > 0 ? 'copper' : mostLikelyTop(p)));
        return { type: 'JOURNEYMAN_NAME', card: named };
      }
      case 'soothsayer':
        if (immuneReveal(p)) return immuneReveal(p);
        return { type: 'SOOTHSAYER_REACT' };

      /* ===== 拡張: 異郷（Hinterlands）===== */
      case 'oasis':
        return { type: 'OASIS_RESOLVE', card: pickDiscards(p.hand, 1)[0] };
      /* ===== 旭日 R5：イベント10種 ===== */
      // 蓄積＝コスト5以下のアクション1枚を獲得（強制）。
      /* ⚠ engine は「コスト5以下**かつアクション**」しか受理しない＝`bestGain` が財宝/勝利点を返すと
         engine が拒否し続けて**本番 livelock**（強制購入ソークで実際に踏んだ）。engine と同じ述語を見る。 */
      case 'amass_gain': {
        const okAm = (id) => DOM.engine.costUpTo(state, id, 5) && DOM.engine.isTypeSupply(state, id, 'action');
        const cands = GAIN_ORDER.filter(okAm);
        return { type: 'AMASS_GAIN', card: cands.length ? cands[0] : null };
      }
      // 苦行①＝追加でいくら払うか。手札のゴミ（呪い/銅貨/屋敷）の枚数ぶんだけ払う（コインの余りの範囲で）。
      case 'asceticism_pay': {
        const junk = p.hand.filter((x) => trashValue(x) <= 2).length;
        return { type: 'ASCETICISM_PAY', amount: Math.max(0, Math.min(pd.max, junk)) };
      }
      // 苦行②＝ちょうど pd.need 枚を廃棄（強制）。
      case 'asceticism_trash': {
        const need = Math.min(pd.need, p.hand.length);
        return { type: 'ASCETICISM_TRASH', cards: p.hand.slice().sort((x, y) => trashValue(x) - trashValue(y)).slice(0, need) };
      }
      // 信用＝コスト8以下のアクションか財宝を獲得（負債を負う）。負債はターン中いつでも返せる。
      case 'credit_gain': {
        const okC = DOM.engine.creditCanGain(state);
        const cs = GAIN_ORDER.filter(okC);
        return { type: 'CREDIT_GAIN', card: cs.length ? cs[0] : null };
      }
      // 金継ぎ①＝手札1枚を廃棄（強制）。ゴミを優先。⚠ 候補ゼロで null を返さない。
      case 'kintsugi_trash': {
        const j = p.hand.slice().sort((x, y) => trashValue(x) - trashValue(y))[0];
        return { type: 'KINTSUGI_TRASH', card: j || p.hand[0] || null };
      }
      case 'kintsugi_gain':
        return { type: 'KINTSUGI_GAIN', card: bestGain(state, pd.coin, { noVictory: true, pot: pd.pot, debt: pd.debt })
          || bestGain(state, pd.coin, { pot: pd.pot, debt: pd.debt }) };
      /* 稽古＝手札のアクション1枚を2回使用してよい（任意）。⚠ 群A＝engine と同じ述語を見る。 */
      case 'practice_play': {
        const pt = DOM.engine.practiceTargets(state, pd.player);
        const best = pt.slice().sort((x, y) => throneValue(state, y) - throneValue(state, x))[0];
        return { type: 'PRACTICE_PLAY', card: best || null };
      }
      // 海上交易＝最大 pd.max 枚まで廃棄してよい（任意）。ゴミだけ捨てる。
      case 'sea_trade_trash':
        return { type: 'SEA_TRADE_TRASH', cards: p.hand.slice().sort((x, y) => trashValue(x) - trashValue(y)).filter((x) => trashValue(x) <= 2).slice(0, pd.max) };
      // 賛辞＝場に出していないアクションを最大3種類まで獲得してよい（強い順に取る）。
      case 'receive_tribute_gain': {
        const rt = DOM.engine.receiveTributeTargets(state, pd.player, pd.gained || []);
        const pick = GAIN_ORDER.filter((id) => rt.indexOf(id) >= 0)[0];
        return { type: 'RECEIVE_TRIBUTE_GAIN', card: pick || null };
      }
      // 参集＝ちょうど pd.need を1枚（強制）。
      case 'gather_gain':
        return { type: 'GATHER_GAIN', card: bestGainExact(state, pd.need, { noVictory: true }) || bestGainExact(state, pd.need) };
      // 継続＝アタックでないコスト4以下のアクションを獲得して使用（強制）。
      case 'continue_gain': {
        const okK = DOM.engine.continueCanGain(state);
        const ks = GAIN_ORDER.filter(okK);
        return { type: 'CONTINUE_GAIN', card: ks.length ? ks[0] : null };
      }
      // 旭日 R4：成長（予言）＝財宝を獲得したとき、それより安いカードを獲得（強制）。
      case 'growth_gain':
        return { type: 'GROWTH_GAIN', card: bestGain(state, pd.coin - 1, { noVictory: true, pot: pd.pot, debt: pd.debt })
          || bestGain(state, pd.coin - 1, { pot: pd.pot, debt: pd.debt }) };
      /* 旭日 R4：神器（予言）＝アクション1枚を**手札に**獲得（強制・**コスト上限なし**）。
         ⚠ 述語は engine と同じ `woodworkersCanGain`（片側だけずらすと本番 livelock）。 */
      case 'kind_emperor_gain': {
        const okKe = DOM.engine.woodworkersCanGain(state);
        const cands = GAIN_ORDER.filter(okKe);
        return { type: 'KIND_EMPEROR_GAIN', card: cands.length ? cands[0] : null };
      }
      /* 旭日 R4：病（予言）＝ターン開始時の二択（強制）。
         呪いを取ると得点が下がるので、**手札があるうちは3枚捨てる**方を選ぶ。
         ⚠ ただし手札3枚は重い＝手札が3枚未満なら「あるだけ捨てる」で済むのでそちらが得。
         呪いの山が空なら呪いを選んでも何も起きない＝タダで済むのでそちらを選ぶ。 */
      case 'sickness': {
        if ((state.supply.curse || 0) <= 0) return { type: 'SICKNESS_CHOOSE', mode: 'curse' };
        if (p.hand.length >= 4) return { type: 'SICKNESS_CHOOSE', mode: 'curse' };
        return { type: 'SICKNESS_CHOOSE', mode: 'discard', cards: pickDiscards(p.hand, Math.min(3, p.hand.length)) };
      }
      /* ===== 旭日（Rising Sun）R3 ===== */
      // 小路＝手札1枚を捨てる（強制）。⚠ 候補は**手札だけ**（山札の影札は捨てられない＝公式）。
      case 'alley':
        return { type: 'ALLEY_DISCARD', card: pickDiscards(p.hand, 1)[0] || p.hand[0] };
      // 田舎の村＝ちょうど2枚捨てて +1カード（任意）。手札が3枚以上あるときだけ得（1枚減る）。
      case 'rustic_village': {
        if (p.hand.length < 3) return { type: 'RUSTIC_VILLAGE_DISCARD', cards: [] };
        const junk = pickDiscards(p.hand, 2);
        return { type: 'RUSTIC_VILLAGE_DISCARD', cards: junk.length === 2 ? junk : [] };
      }
      // 山の社＝手札1枚を廃棄してもよい（ジャンクがあれば廃棄する）。判定は廃棄しなくても走る。
      case 'mountain_shrine': {
        const junk = p.hand.slice().sort((a, b) => trashValue(a) - trashValue(b))[0];
        return { type: 'MOUNTAIN_SHRINE_TRASH', card: (junk && trashValue(junk) <= 1) ? junk : null };
      }
      // 濡女＝手札が全部異なれば山に戻して相手に呪いを配る（呪いの山があるときだけ得）。
      case 'snake_witch':
        return { type: 'SNAKE_WITCH_RESOLVE', doIt: sup(state, 'curse') > 0 };
      case 'snake_witch_attack':
        return immuneReveal(p) || { type: 'SNAKE_WITCH_REACT' };
      /* 狐＝異なる2つを選ぶ。呪いを配れるなら配る＋残りは +2コイン（アクション権が余っていれば +2アクション）。 */
      case 'kitsune': {
        const opts = [];
        if (sup(state, 'curse') > 0) opts.push('curse');
        if (state.turn.actions > 0 && p.hand.some((c) => isType(c, 'action'))) opts.push('actions');
        opts.push('coins');
        if (sup(state, 'silver') > 0) opts.push('silver');
        opts.push('actions', 'coins'); // 保険（必ず2つ埋まる）
        const pick = [];
        opts.forEach((o) => { if (pick.length < 2 && pick.indexOf(o) < 0) pick.push(o); });
        return { type: 'KITSUNE_CHOOSE', choices: pick };
      }
      case 'kitsune_attack':
        return immuneReveal(p) || { type: 'KITSUNE_REACT' };
      // 川の社＝手札を最大2枚廃棄してよい（任意）。ゴミ（呪い/銅貨/屋敷）だけ捨てる。
      case 'river_shrine_trash': {
        const junk = p.hand.slice().sort((a, b) => trashValue(a) - trashValue(b)).filter((c) => trashValue(c) <= 2).slice(0, 2);
        return { type: 'RIVER_SHRINE_TRASH', cards: junk };
      }
      // 川の社（クリンナップ）＝コスト4以下を1枚獲得（強制）。engine が候補ゼロなら窓を開かない。
      case 'river_shrine_gain':
        return { type: 'RIVER_SHRINE_GAIN', card: bestGain(state, 4, { noVictory: true }) || bestGain(state, 4) };
      // 名匠＝コスト5以下を獲得（強制）。候補ゼロで null を返さない（engine が窓を開かないので到達しない）。
      case 'craftsman':
        return { type: 'CRAFTSMAN_GAIN', card: bestGain(state, 5, { noVictory: true }) || bestGain(state, 5) };
      // 金山＝金貨＋負債4。負債はターン中いつでも返せるので、コインに余裕がある序盤〜中盤は取る。
      case 'gold_mine':
        return { type: 'GOLD_MINE_CHOOSE', doIt: sup(state, 'gold') > 0 && (p.debt || 0) === 0 };
      // 札差＝手札1枚を廃棄（財宝なら+2／アクションなら+5カード）＝アクションを廃棄できると一番得。
      case 'rice_broker': {
        const act = p.hand.filter((c) => isType(c, 'action')).sort((a, b) => trashValue(a) - trashValue(b))[0];
        const any = p.hand.slice().sort((a, b) => trashValue(a) - trashValue(b))[0];
        return { type: 'RICE_BROKER_TRASH', card: act || any };
      }
      // 交替＝手札1枚を廃棄して「コインコストが厳密に高い」カードを獲得（負債は差ぶん）。
      case 'change': {
        if (pd.stage === 'trash') {
          const c = p.hand.slice().sort((a, b) => trashValue(a) - trashValue(b))[0];
          return { type: 'CHANGE_TRASH', card: c };
        }
        const cands = GAIN_ORDER.filter((id) => DOM.engine.gainableBase(state, id)
          && DOM.engine.costOf(state, id).coin > pd.ref);
        return { type: 'CHANGE_GAIN', card: cands[0] || null };
      }
      // 狸＝改築と同型（廃棄して最大+$2高いカードを獲得）。
      case 'tanuki':
        if (pd.stage === 'trash') { const c = p.hand.slice().sort((a, b) => trashValue(a) - trashValue(b))[0]; return { type: 'TANUKI_TRASH', card: c }; }
        return { type: 'TANUKI_GAIN', card: bestGain(state, pd.maxCost, { noVictory: true, pot: pd.pot, debt: pd.debt }) || bestGain(state, pd.maxCost, pd) };
      case 'duchess_look': {
        const look = p.deck[0] || p.discard[0];
        return { type: 'DUCHESS_LOOK', discard: !!look && (isType(look, 'victory') || isType(look, 'curse')) };
      }
      case 'develop':
        if (pd.stage === 'trash') return { type: 'DEVELOP_TRASH', card: pickRemodelTrash(state, p) };
        {
          const pickFor = (c) => bestGainExact(state, c, { noVictory: true, pot: pd.pot, debt: pd.debt }) || bestGainExact(state, c, pd);
          if (!pd.hiDone && pickFor(pd.hi)) return { type: 'DEVELOP_GAIN', card: pickFor(pd.hi) };
          if (!pd.loDone && pickFor(pd.lo)) return { type: 'DEVELOP_GAIN', card: pickFor(pd.lo) };
          return { type: 'DEVELOP_GAIN', card: null };
        }
      case 'oracle':
        if (pd.stage === 'react') { if (immuneReveal(p)) return immuneReveal(p); return { type: 'ORACLE_REACT' }; }
        {
          const good = (pd.cards || []).some((c) => isTreasure(c) || isType(c, 'action'));
          const mine = pd.victim === pd.source;
          return { type: 'ORACLE_DECIDE', discard: mine ? !good : good, order: (pd.cards || []).slice() };
        }
      case 'jack':
        if (pd.stage === 'look') { const top = p.deck[0]; return { type: 'JACK_LOOK', discard: !!top && (isType(top, 'victory') || isType(top, 'curse')) }; }
        { const junk = p.hand.find((c) => !isTreasure(c) && (isType(c, 'curse') || c === 'estate')); return { type: 'JACK_TRASH', card: junk || null }; }
      case 'noble_brigand':
        if (pd.stage === 'react') { if (immuneReveal(p)) return immuneReveal(p); return { type: 'NOBLE_BRIGAND_REACT' }; }
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
        if (pd.stage === 'react') { if (immuneReveal(p)) return immuneReveal(p); return { type: 'MARGRAVE_REACT' }; }
        return { type: 'MARGRAVE_DISCARD', cards: pickDiscards(p.hand, Math.max(0, p.hand.length - 3)) };
      case 'stables':
        return { type: 'STABLES_DISCARD', card: p.hand.includes('copper') ? 'copper' : null };
      case 'border_village':
        // 「国境の村より安い」＝engine と同じ costUnder（pd.maxCost は cost-1）
        { const uc = (pd.maxCost || 0) + 1;
          return { type: 'BORDER_VILLAGE_GAIN', card: bestGainUnder(state, uc, { noVictory: true }) || bestGainUnder(state, uc) }; }
      case 'weaver':
        if (pd.stage === 'gain') return { type: 'WEAVER_GAIN', card: bestGain(state, 4, { noVictory: true }) || bestGain(state, 4) };
        return { type: 'WEAVER_MODE', mode: 'silver' }; // 銀貨2枚が堅実
      case 'souk_trash':
        return { type: 'SOUK_TRASH', cards: p.hand.filter((c) => isType(c, 'curse') || c === 'estate').slice(0, 2) };
      case 'berserker':
        if (pd.stage === 'react') { if (immuneReveal(p)) return immuneReveal(p); return { type: 'BERSERKER_REACT' }; }
        if (pd.stage === 'discard') return { type: 'BERSERKER_DISCARD', cards: pickDiscards(p.hand, Math.max(0, p.hand.length - 3)) };
        return { type: 'BERSERKER_GAIN', card: bestGain(state, pd.maxCost, { noVictory: true }) || bestGain(state, pd.maxCost) };
      case 'wheelwright':
        if (pd.stage === 'discard') return { type: 'WHEELWRIGHT_DISCARD', card: p.hand.includes('estate') ? 'estate' : null };
        { const g = firstGainable(state, (id) => costUpTo(state, id, pd.maxCost, pd) && isTypeSup(state, id, 'action'));
          return { type: 'WHEELWRIGHT_GAIN', card: g || null }; }
      case 'witchs_hut': {
        if (pd.stage === 'react') { if (immuneReveal(p)) return immuneReveal(p); return { type: 'WITCHS_HUT_REACT' }; }
        const acts = p.hand.filter((c) => isType(c, 'action')).sort((a, b) => cost(state, a) - cost(state, b));
        const cards = acts.length >= 2 ? acts.slice(0, 2) : pickDiscards(p.hand, Math.min(2, p.hand.length));
        return { type: 'WITCHS_HUT_DISCARD', cards };
      }
      case 'cauldron':
        if (immuneReveal(p)) return immuneReveal(p);
        return { type: 'CAULDRON_REACT' };
      case 'duchess_gain':
        return { type: 'DUCHESS_GAIN', gain: false }; // デッキを濁さないため受け取らない
      case 'farmland':
        if (pd.stage === 'trash') return { type: 'FARMLAND_TRASH', card: pickRemodelTrash(state, p) };
        return { type: 'FARMLAND_GAIN', card: bestGainExact(state, pd.exactCost, { noVictory: true, pot: pd.pot, debt: pd.debt }) || bestGainExact(state, pd.exactCost, pd) };
      case 'haggler': {
        // 「購入した札より安い・勝利点でない」＝engine と同じ述語（勝利点は engine が拒否／呪いは可＝GAIN_ORDER の最後尾）。
        const uc = (pd.coin != null) ? pd.coin : (pd.maxCost || 0) + 1;
        return { type: 'HAGGLER_GAIN', card: firstGainable(state, (id) => costUnder(state, id, uc, pd) && !isTypeSup(state, id, 'victory')) };
      }
      case 'fools_gold_react':
        return { type: 'FOOLS_GOLD_REACT', trash: true };
      case 'igg_play':
        return { type: 'IGG_PLAY', gain: false };
      case 'scheme_cleanup': {
        const acts = p.inPlay.filter((c) => isType(c, 'action') && !isType(c, 'duration')).sort((a, b) => throneValue(b) - throneValue(a)).slice(0, pd.max || 0);
        return { type: 'SCHEME_CLEANUP', cards: acts };
      }

      /* ===== 拡張: 暗黒時代（Dark Ages）===== */
      case 'survivors': {
        const good = (pd.cards || []).some((c) => cost(state, c) >= 3 || isType(c, 'action'));
        return { type: 'SURVIVORS_RESOLVE', choice: good ? 'topdeck' : 'discard', order: (pd.cards || []).slice() };
      }
      case 'rats_trash': {
        const cand = p.hand.filter((c) => c !== 'rats');
        return { type: 'RATS_TRASH', card: pickTrash(cand, 1)[0] || cand[0] };
      }
      case 'armory':
        return { type: 'ARMORY_GAIN', card: bestGain(state, 4, { noVictory: true }) || bestGain(state, 4) };
      case 'forager':
        return { type: 'FORAGER_TRASH', card: pickTrash(p.hand, 1)[0] || p.hand[0] };
      case 'squire':
        return { type: 'SQUIRE_RESOLVE', choice: 'silver' };
      case 'squire_trash_gain': {
        const atk = firstGainable(state, (id) => isTypeSup(state, id, 'attack')); // アタックならコスト制限なし（engine と同じ）
        return { type: 'SQUIRE_TRASH_GAIN', card: atk || null };
      }
      case 'storeroom':
        return { type: 'STOREROOM_DISCARD', cards: p.hand.filter((c) => isDead(c)) };
      case 'scavenger':
        if (pd.stage === 'deck') return { type: 'SCAVENGER_DECK', discardDeck: false };
        return { type: 'SCAVENGER_TOPDECK', card: p.discard.slice().sort((a, b) => keepValue(b) - keepValue(a))[0] };
      case 'ironmonger':
        return { type: 'IRONMONGER_RESOLVE', discard: isDead(pd.card) };
      case 'minstrel':
        return { type: 'MINSTREL_RESOLVE', order: (pd.cards || []).slice() };
      case 'junk_dealer':
        return { type: 'JUNK_DEALER_TRASH', card: pickTrash(p.hand, 1)[0] || p.hand[0] };
      case 'mystic': {
        // 山札に見えない中身の最頻カードを指定して当てにいく（山札→捨て札の順で母集団）。
        const pool = p.deck.concat(p.discard);
        const counts = {}; pool.forEach((c) => { counts[c] = (counts[c] || 0) + 1; });
        let best = pool[0] || 'copper';
        for (const c in counts) if (counts[c] > (counts[best] || 0)) best = c;
        return { type: 'MYSTIC_NAME', card: best };
      }
      case 'altar':
        if (pd.stage === 'trash') return { type: 'ALTAR_TRASH', card: pickTrash(p.hand, 1)[0] || p.hand[0] };
        return { type: 'ALTAR_GAIN', card: bestGain(state, 5, { noVictory: true }) || bestGain(state, 5) };
      case 'catacombs': {
        // 上3枚に良い札（$3以上/アクション/財宝）が2枚以上あれば手札へ、そうでなければ捨てて+3。
        const look = pd.cards || [];
        const good = look.filter((c) => cost(state, c) >= 3 || isType(c, 'action') || isTreasure(c)).length;
        return { type: 'CATACOMBS_RESOLVE', choice: good >= 2 ? 'hand' : 'discard' };
      }
      case 'catacombs_trash': {
        // 「地下墓所より安い」＝engine と同じ costUnder
        const uc = (pd.under != null) ? pd.under : 5;
        return { type: 'CATACOMBS_TRASH_GAIN', card: bestGainUnder(state, uc, { noVictory: true }) || bestGainUnder(state, uc) };
      }
      case 'hunting_grounds_trash':
        return { type: 'HUNTING_GROUNDS_TRASH', choice: sup(state, 'duchy') > 0 ? 'duchy' : 'estates' };
      case 'graverobber': {
        const inRange = (c) => { const cc = cost(state, c); return cc >= 3 && cc <= 6 && (C()[c].potion || 0) === 0; };
        if (pd.stage === 'choose') {
          if ((state.trash || []).some(inRange)) return { type: 'GRAVEROBBER_MODE', mode: 'from_trash' };
          if (p.hand.some((c) => isType(c, 'action'))) return { type: 'GRAVEROBBER_MODE', mode: 'trash_gain' };
          return { type: 'GRAVEROBBER_MODE', mode: 'from_trash' }; // 不発でも終端
        }
        if (pd.stage === 'from_trash') {
          const pick = (state.trash || []).filter(inRange).sort((a, b) => cost(state, b) - cost(state, a))[0];
          return { type: 'GRAVEROBBER_FROM_TRASH', card: pick };
        }
        if (pd.stage === 'trash') {
          const acts = p.hand.filter((c) => isType(c, 'action')).sort((a, b) => cost(state, a) - cost(state, b));
          return { type: 'GRAVEROBBER_TRASH', card: acts[0] };
        }
        return { type: 'GRAVEROBBER_GAIN', card: bestGain(state, pd.maxCost, pd) }; // stage 'gain'
      }
      case 'rebuild': {
        if (pd.stage === 'name') return { type: 'REBUILD_NAME', card: 'province' }; // 属州を守り 屋敷/公領を格上げ
        const g = firstGainable(state, (id) => costUpTo(state, id, pd.maxCost, pd) && isTypeSup(state, id, 'victory'));
        return { type: 'REBUILD_GAIN', card: g };
      }
      case 'count': {
        if (pd.stage === 'part1') return { type: 'COUNT_PART1', mode: p.hand.length > 0 ? 'topdeck' : 'copper' };
        if (pd.stage === 'topdeck') return { type: 'COUNT_TOPDECK', card: p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b))[0] };
        if (pd.stage === 'discard') return { type: 'COUNT_DISCARD', cards: p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b)).slice(0, pd.need) };
        return { type: 'COUNT_PART2', mode: 'coins' }; // stage 'part2'
      }
      case 'death_cart': {
        const junk = p.hand.find((c) => isType(c, 'ruins')); // 廃墟を廃棄すれば+$5＋死の荷車を温存
        if (junk) return { type: 'DEATH_CART_RESOLVE', mode: 'hand', card: junk };
        if (pendingSelf(state, pd, 'death_cart')) return { type: 'DEATH_CART_RESOLVE', mode: 'this' }; // 自身を廃棄して+$5
        // 命令（はみだし者等）で動かさずに使った＝「これ」は廃棄できない。安い手札のアクションがあれば廃棄して+$5。
        const act = p.hand.slice().filter((c) => isType(c, 'action')).sort((a, b) => trashValue(a) - trashValue(b))[0];
        if (act != null && trashValue(act) <= 3) return { type: 'DEATH_CART_RESOLVE', mode: 'hand', card: act };
        return { type: 'DEATH_CART_RESOLVE', mode: 'none' };
      }
      case 'band_of_misfits': {
        const cands = (DOM.engine && DOM.engine.bandOfMisfitsTargets) ? DOM.engine.bandOfMisfitsTargets(state) : [];
        if (!cands.length) return { type: 'BAND_OF_MISFITS_PLAY', card: null };
        for (const id of GAIN_ORDER) { if (cands.includes(id)) return { type: 'BAND_OF_MISFITS_PLAY', card: id }; }
        return { type: 'BAND_OF_MISFITS_PLAY', card: cands[0] }; // 終端保証
      }
      case 'hermit': {
        if (pd.stage === 'trash') {
          const pickJunk = (arr) => { const nonT = arr.filter((c) => !isType(c, 'treasure')); return nonT.find((c) => isType(c, 'curse')) || nonT.find((c) => isType(c, 'victory')) || nonT.find((c) => isType(c, 'ruins')); };
          const h = pickJunk(p.hand); if (h) return { type: 'HERMIT_TRASH', from: 'hand', card: h };
          const d = pickJunk(p.discard); if (d) return { type: 'HERMIT_TRASH', from: 'discard', card: d };
          return { type: 'HERMIT_TRASH', card: null };
        }
        return { type: 'HERMIT_GAIN', card: bestGain(state, 3) }; // stage 'gain'（コスト3以下の最善＝通常は銀貨）
      }
      case 'procession': {
        const cands = playPool(state, pd.player).filter((c) => isType(c, 'action') && !isType(c, 'duration') && c !== 'procession');
        const upgradeable = (c) => {
          const mx = cost(state, c) + 1, pot = C()[c].potion || 0, dbt = C()[c].debt || 0;
          return !!firstGainable(state, (id) => costExact(state, id, mx, pot, dbt) && isTypeSup(state, id, 'action'));
        };
        const ok = cands.filter(upgradeable).sort((a, b) => ((isType(b, 'ruins') ? 1 : 0) - (isType(a, 'ruins') ? 1 : 0)) || (cost(state, a) - cost(state, b)));
        return { type: 'PROCESSION_CHOOSE', card: ok[0] || null };
      }
      case 'procession_gain': {
        const g = firstGainable(state, (id) => costExact(state, id, pd.exact, pd.pot, pd.debt) && isTypeSup(state, id, 'action'));
        return { type: 'PROCESSION_GAIN', card: g };
      }
      case 'counterfeit': {
        if (p.hand.includes('spoils')) return { type: 'COUNTERFEIT_PLAY', card: 'spoils' }; // +$6・山へ戻り廃棄されない
        if (p.hand.includes('copper')) return { type: 'COUNTERFEIT_PLAY', card: 'copper' }; // +$2＋銅貨圧縮
        return { type: 'COUNTERFEIT_PLAY', card: null }; // 良い財宝は温存
      }
      case 'marauder': // react のみ（廃墟獲得は自動）
        if (immuneReveal(p)) return immuneReveal(p);
        return { type: 'MARAUDER_REACT' };
      case 'cultist': // react のみ
        if (immuneReveal(p)) return immuneReveal(p);
        return { type: 'CULTIST_REACT' };
      case 'cultist_chain':
        return { type: 'CULTIST_CHAIN', play: true }; // 連鎖は無料＝常に使う
      case 'pillage':
        if (pd.stage === 'react') { if (immuneReveal(p)) return immuneReveal(p); return { type: 'PILLAGE_REACT' }; }
        // stage 'pick'：使用者として被害者の最も価値の高い手札を捨てさせる
        return { type: 'PILLAGE_PICK', card: state.players[pd.victim].hand.slice().sort((a, b) => keepValue(b) - keepValue(a))[0] };
      case 'rogue':
        if (pd.stage === 'react') { if (immuneReveal(p)) return immuneReveal(p); return { type: 'ROGUE_REACT' }; }
        if (pd.stage === 'gain_from_trash') {
          const cands = (state.trash || []).filter((c) => { const cc = cost(state, c); return cc >= 3 && cc <= 6 && (C()[c].potion || 0) === 0; }).sort((a, b) => cost(state, b) - cost(state, a));
          return { type: 'ROGUE_GAIN_FROM_TRASH', card: cands[0] };
        }
        // stage 'pick'：被害者として価値の低い方を廃棄（良い方を残す）
        return { type: 'ROGUE_PICK', card: (pd.trashable || []).slice().sort((a, b) => keepValue(a) - keepValue(b))[0] };
      case 'discard_down': {
        if (immuneReveal(p)) return immuneReveal(p); // 堀で無効化（民兵と同型・embedded反応窓）
        const target = Math.min(pd.down, p.hand.length);
        const toDiscard = p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b)).slice(0, p.hand.length - target);
        return { type: 'DISCARD_DOWN_RESOLVE', cards: toDiscard };
      }
      case 'mercenary': {
        const junk = p.hand.filter((c) => trashValue(c) < 10).sort((a, b) => trashValue(a) - trashValue(b));
        if (junk.length >= 2) return { type: 'MERCENARY_TRASH', cards: junk.slice(0, 2) };
        return { type: 'MERCENARY_TRASH', cards: [] }; // 不要札が2枚未満なら廃棄しない
      }
      case 'urchin_trash': {
        // 不要札が十分あれば浮浪児→傭兵に格上げ（傭兵は強力）。無ければ浮浪児を温存。
        const junkOwned = owned(p, 'copper') + owned(p, 'estate') + owned(p, 'curse');
        return { type: 'URCHIN_TRASH', trash: junkOwned >= 4 };
      }
      case 'knight':
        if (pd.stage === 'react') { if (immuneReveal(p)) return immuneReveal(p); return { type: 'KNIGHT_REACT' }; }
        // stage 'pick'：被害者として価値の低い方を廃棄（騎士は価値が高い＝残す＝相手の騎士を巻き込まない安全策）
        return { type: 'KNIGHT_PICK', card: (pd.trashable || []).slice().sort((a, b) => keepValue(a) - keepValue(b))[0] };
      case 'dame_anna_trash':
        return { type: 'DAME_ANNA_TRASH', cards: pickTrash(p.hand, 2) }; // 最大2枚の不要札
      case 'dame_natalie_gain':
        return { type: 'DAME_NATALIE_GAIN', card: bestGain(state, 3, { noVictory: true }) || null }; // 任意（≤$3の非勝利点）
      case 'market_square_react':
        return { type: 'MARKET_SQUARE_REACT', discard: true }; // 青空市場を捨てて金貨（MONEY方針＝常に得）
      case 'hovel_react':
        return { type: 'HOVEL_REACT', trash: true }; // 納屋を廃棄（純粋な圧縮＝常に得）

      /* ===== ルネサンス（Renaissance）R2 ===== */
      case 'hideout_trash': {
        // 手札1枚を廃棄（強制）。勝利点を廃棄すると呪いを得るので、勝利点でない不要札を優先する。
        const nonVic = p.hand.filter((c) => !isType(c, 'victory'));
        const pick = pickTrash(nonVic, 1)[0] || p.hand[0] || null;
        return { type: 'HIDEOUT_TRASH', card: pick };
      }
      case 'inventor_gain': {
        // コスト$4以下を1枚獲得（強制）。engine の inventorGainable と同じ述語で候補を選ぶ（拒否されない＝無限ループ防止）。
        const ok = (id) => costUpTo(state, id, 4);
        const pick = firstGainable(state, (id) => ok(id) && !isTypeSup(state, id, 'victory') && !isTypeSup(state, id, 'curse'))
          || firstGainable(state, ok);
        return { type: 'INVENTOR_GAIN', card: pick };
      }
      case 'mountain_village': {
        // 捨て札から1枚を手札へ（強制）。勝利点/呪い以外で最も価値の高い札を回収する。
        const good = p.discard.filter((c) => !isType(c, 'victory') && !isType(c, 'curse'));
        const src = good.length ? good : p.discard;
        const pick = src.slice().sort((a, b) => keepValue(b) - keepValue(a))[0] || null;
        return { type: 'MOUNTAIN_VILLAGE_TAKE', card: pick };
      }
      case 'priest_trash':
        return { type: 'PRIEST_TRASH', card: pickTrash(p.hand, 1)[0] || p.hand[0] || null };
      case 'recruiter_trash': {
        // コイン費用1につき+1村人。不要札の中で最も高コストなもの（屋敷=+2村人）を優先し、無ければ最も不要な札。
        const junky = p.hand.filter((c) => trashValue(c) < 10);
        const pick = junky.sort((a, b) => cost(state, b) - cost(state, a))[0] || pickTrash(p.hand, 1)[0] || p.hand[0] || null;
        return { type: 'RECRUITER_TRASH', card: pick };
      }
      case 'sculptor_gain': {
        const ok = (id) => costUpTo(state, id, 4);
        const pick = firstGainable(state, (id) => ok(id) && !isTypeSup(state, id, 'victory') && !isTypeSup(state, id, 'curse'))
          || firstGainable(state, ok);
        return { type: 'SCULPTOR_GAIN', card: pick };
      }
      case 'seer_order':
        // 山札の上に戻す順（cards[0]が一番上＝次に引く）。価値の高い札を上に。
        return { type: 'SEER_ORDER', cards: (pd.cards || []).slice().sort((a, b) => keepValue(b) - keepValue(a)) };
      case 'old_witch':
        if (immuneReveal(p)) return immuneReveal(p);
        return { type: 'OLD_WITCH_REACT' };
      case 'old_witch_trash':
        return { type: 'OLD_WITCH_TRASH', card: 'curse' }; // 手札の呪いを廃棄できるなら常に得
      case 'villain':
        if (immuneReveal(p)) return immuneReveal(p);
        return { type: 'VILLAIN_REACT' };
      case 'villain_discard': {
        // コスト$2以上の手札1枚を捨てる（強制）。最も価値の低いものを捨てる。
        const cand = p.hand.filter((c) => cost(state, c) >= 2);
        const pick = cand.slice().sort((a, b) => keepValue(a) - keepValue(b))[0] || null;
        return { type: 'VILLAIN_DISCARD', card: pick };
      }
      /* --- R5：プロジェクト（横型）--- */
      case 'cathedral':
        return { type: 'CATHEDRAL_TRASH', card: pickTrash(p.hand, 1)[0] || p.hand[0] || null };
      case 'city_gate': {
        // 手札1枚を山札の上に置く（強制）。次に引きたい＝最も価値の高い札を上に置く…のではなく、
        // 「今使わない良い札」を置くのが定石。ここでは最も価値の高い札を置く（次のターンに確実に来る）。
        const pick = p.hand.slice().sort((a, b) => keepValue(b) - keepValue(a))[0] || null;
        return { type: 'CITY_GATE_TOPDECK', card: pick };
      }
      case 'silos': {
        const coppers = p.hand.filter((c) => c === 'copper').length;
        return { type: 'SILOS_DISCARD', count: coppers }; // 銅貨は全部引き直す
      }
      case 'sinister_plot': {
        // 3個溜めたら引く（+3カード）。それまでは置く。
        const k = p.sinisterPlot || 0;
        return { type: 'SINISTER_PLOT_RESOLVE', mode: k >= 3 ? 'take' : 'add' };
      }
      case 'crop_rotation': {
        const vic = p.hand.filter((c) => isType(c, 'victory') && !isType(c, 'action') && !isType(c, 'treasure'));
        return { type: 'CROP_ROTATION_RESOLVE', card: vic[0] || null };
      }
      case 'pageant':
        return { type: 'PAGEANT_PAY', pay: true }; // 余りコイン$1を財源に（常に得）
      case 'sewers': {
        const junk = p.hand.filter((c) => trashValue(c) < 10).sort((a, b) => trashValue(a) - trashValue(b))[0];
        return { type: 'SEWERS_TRASH', card: junk || null };
      }
      case 'sewers_trash': {
        const junk = p.hand.filter((c) => trashValue(c) < 10).sort((a, b) => trashValue(a) - trashValue(b))[0];
        return { type: 'SEWERS_TRASH', card: junk || null };
      }
      case 'innovation':
        return { type: 'INNOVATION_PLAY', play: true }; // 獲得したアクションを即使用（ほぼ常に得）
      /* --- R4：持続・クリンナップ・再演 --- */
      case 'research_trash': {
        // 手札1枚を廃棄（強制）。コイン費用ぶん山札の上を脇に置く＝**高コストほど得**だが良い札を失う。
        // 不要札（呪い/屋敷/銅貨）の中で最も高コストなものを廃棄し、無ければ最も不要な札。
        const junky = p.hand.filter((c) => trashValue(c) < 10);
        const pick = junky.sort((a, b) => cost(state, b) - cost(state, a))[0] || pickTrash(p.hand, 1)[0] || p.hand[0] || null;
        return { type: 'RESEARCH_TRASH', card: pick };
      }
      case 'cargo_ship_setaside': {
        // 獲得したカードを脇に置く＝次の手番の手札が濃くなる。良い札（銀貨以上）なら置く。
        const good = keepValue(pd.card) >= keepValue('silver');
        return { type: 'CARGO_SHIP_SETASIDE', set: good };
      }
      case 'improve': {
        if (pd.stage === 'gain') {
          // engine の述語と完全に一致させる（コイン/ポーション/負債の成分がすべて一致）。
          //   ※bestGainExact は potion を見ない＝ポーション費用の札を廃棄した窓（大学→錬金術師 等）で
          //     engine に拒否され続けて CPU 無限ループになる（敵対レビュー M3）。
          const ok = (id) => cost(state, id) === pd.exact &&
            ((C()[id] || {}).potion || 0) === (pd.pot || 0) && ((C()[id] || {}).debt || 0) === (pd.dbt || 0);
          const pick = firstGainable(state, (id) => ok(id) && !isTypeSup(state, id, 'victory') && !isTypeSup(state, id, 'curse'))
            || firstGainable(state, ok);
          return { type: 'IMPROVE_GAIN', card: pick };
        }
        // クリンナップ開始時：ちょうど+$1の獲得先があり、格上げが得になる場のアクションを廃棄する。
        const targets = (DOM.engine.improveTargets ? DOM.engine.improveTargets(state, pd.player) : [])
          .filter((c) => bestGainExact(state, cost(state, c) + 1, { noVictory: true }));
        if (!targets.length) return { type: 'IMPROVE_TRASH', card: null };
        // 最も価値の低いアクションを格上げする（増築自身は最後の手段）
        const pick = targets.slice().sort((a, b) => keepValue(a) - keepValue(b))[0];
        return { type: 'IMPROVE_TRASH', card: pick };
      }
      case 'scepter': {
        if (pd.stage === 'replay') {
          const cand = (DOM.engine.scepterTargets ? DOM.engine.scepterTargets(state, pd.player) : []);
          return { type: 'SCEPTER_REPLAY', card: cand.slice().sort((a, b) => keepValue(b) - keepValue(a))[0] || null };
        }
        // 購入フェイズなので再演してもアクションは使えない＝コインを稼ぐ札が場にあるときだけ再演する。
        const cand = (DOM.engine.scepterTargets ? DOM.engine.scepterTargets(state, pd.player) : []);
        const coinCards = cand.filter((c) => /\+\d+\s*コイン/.test((C()[c] || {}).text || ''));
        if (coinCards.length) return { type: 'SCEPTER_CHOOSE', mode: 'replay' };
        return { type: 'SCEPTER_CHOOSE', mode: 'coins' };
      }
      /* --- R3：アーティファクト絡み --- */
      case 'ducat_trash': {
        // 銅貨1枚を廃棄してよい（圧縮）。財宝が枯れているときは経済が崩れるので廃棄しない（礼拝堂と同じ安全弁）。
        const deckTreasure = allCards(p).filter((c) => isTreasure(c)).length;
        return { type: 'DUCAT_TRASH', trash: deckTreasure >= 7 };
      }
      case 'border_guard':
        // 公開した中から1枚を手札へ（残りは捨て札）。最も価値の高い札を取る。
        return { type: 'BORDER_GUARD_KEEP', card: (pd.cards || []).slice().sort((a, b) => keepValue(b) - keepValue(a))[0] || null };
      case 'border_guard_artifact': {
        if (pd.only) return { type: 'BORDER_GUARD_ARTIFACT', artifact: pd.only }; // 角笛は常に得
        // 角笛（国境警備隊が毎ターン戻る）を優先。既に持っていればランタン。
        const hasHorn = DOM.engine.hasArtifact && DOM.engine.hasArtifact(state, pd.player, 'horn');
        return { type: 'BORDER_GUARD_ARTIFACT', artifact: hasHorn ? 'lantern' : 'horn' };
      }
      case 'treasurer': {
        if (pd.stage === 'trash') {
          const tre = p.hand.filter((c) => isTreasure(c)).sort((a, b) => keepValue(a) - keepValue(b));
          return { type: 'TREASURER_TRASH', card: tre[0] || null };
        }
        if (pd.stage === 'gain') {
          const tre = (state.trash || []).filter((c) => isTreasure(c)).sort((a, b) => keepValue(b) - keepValue(a));
          return { type: 'TREASURER_GAIN', card: tre[0] || null };
        }
        // stage 'choose'：廃棄置き場に良い財宝があれば回収、無ければ鍵（毎ターン+$1）、それも持っていれば銅貨を圧縮。
        const best = (state.trash || []).filter((c) => isTreasure(c)).sort((a, b) => keepValue(b) - keepValue(a))[0];
        if (best && keepValue(best) >= keepValue('silver')) return { type: 'TREASURER_CHOOSE', mode: 'gain' };
        const hasKey = DOM.engine.hasArtifact && DOM.engine.hasArtifact(state, pd.player, 'key');
        if (!hasKey) return { type: 'TREASURER_CHOOSE', mode: 'key' };
        if (p.hand.includes('copper')) return { type: 'TREASURER_CHOOSE', mode: 'trash' };
        return { type: 'TREASURER_CHOOSE', mode: 'key' }; // 既に持っていても選べる＝実質no-op（engineは拒否しない）
      }

      /* ========== 同盟（Allies）A3：Ally カード23種の窓 ==========
         ⚠ どの窓も **null を返さない**（オンラインで reduce(state,null) が TypeError → 部屋が固まる）。
         ⚠ engine が拒否する選択を返し続けると本番 livelock ＝ engine の述語（DOM.engine.*）をそのまま使う。 */
      case 'ally_mountain_folk': // 山の民＝好意5で +3カード（常に得なので使う）
        return { type: 'ALLY_SIMPLE', ok: (p.favors || 0) >= 5 };
      case 'ally_desert': {
        // 砂漠の案内人＝好意1で引き直す。手札が弱い（死蔵札が多い／枚数が少ない）ときだけ使う。
        const dead = p.hand.filter((c) => isDead(c)).length;
        return { type: 'ALLY_SIMPLE', ok: (p.favors || 0) >= 1 && (p.hand.length <= 3 || dead >= 3) };
      }
      case 'ally_scribes': // 写本士の仲間たち＝手札4枚以下で好意1→+1カード（常に得）
        return { type: 'ALLY_SIMPLE', ok: (p.favors || 0) >= 1 && p.hand.length <= 4 };
      case 'ally_circle': // 魔女の輪＝好意3で他の全員に呪い（呪いが残っていれば常に撃つ）
        return { type: 'ALLY_SIMPLE', ok: (p.favors || 0) >= 3 && (state.supply.curse || 0) > 0 };
      case 'ally_island_folk': // 島民＝好意5で追加ターン（常に得）
        return { type: 'ALLY_SIMPLE', ok: (p.favors || 0) >= 5 };
      case 'ally_city_state': // 都市国家＝好意2で獲得したアクションを即使用（ターミナル過多でなければ使う）
        return { type: 'ALLY_SIMPLE', ok: (p.favors || 0) >= 2 };
      case 'ally_trappers': { // 罠師の小屋＝好意1で獲得札を山札の上へ（良い札のときだけ）
        const good = keepValue(pd.card) >= keepValue('silver') || isType(pd.card, 'action');
        return { type: 'ALLY_SIMPLE', ok: (p.favors || 0) >= 1 && good && !isDead(pd.card) };
      }
      case 'ally_forest': // 森の居住者＝好意1で山札の上3枚を整理（常に得）
        return { type: 'ALLY_SIMPLE', ok: (p.favors || 0) >= 1 };
      case 'ally_gang': { // すり師団＝好意1を払って手札4枚捨てを免れる（好意があれば必ず払う）
        if (pd.stage === 'pay') return { type: 'ALLY_GANG', ok: (p.favors || 0) >= 1 };
        const drop = Math.max(0, p.hand.length - 4);
        const order = p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b));
        return { type: 'ALLY_GANG', cards: order.slice(0, drop) };
      }
      case 'ally_cave': { // 穴居民＝好意1で「1枚捨てて1枚引く」。死蔵札があるときだけ回す
        const junk = p.hand.filter((c) => isDead(c) || c === 'copper').sort((a, b) => keepValue(a) - keepValue(b));
        if ((p.favors || 0) < 1 || !junk.length) return { type: 'ALLY_CAVE', ok: false };
        return { type: 'ALLY_CAVE', ok: true, card: junk[0] };
      }
      case 'ally_crafters': { // 工芸家ギルド＝好意2でコスト$4以下を山札の上に獲得（強いので常に使う）
        const g = bestGain(state, 4, { noVictory: true }) || bestGain(state, 4);
        return { type: 'ALLY_CRAFTERS', card: (p.favors || 0) >= 2 ? g : null };
      }
      case 'ally_inventors': { // 発明家の家族＝好意1を山に置いてコストを恒久的に下げる（好意が余っているときだけ）
        const targets = DOM.engine.favorPileTargets(state);
        if ((p.favors || 0) < 2 || !targets.length) return { type: 'ALLY_INVENTORS', pile: null };
        // GAIN_ORDER の上位（＝自分が欲しい山）に置く
        for (const id of GAIN_ORDER) if (targets.indexOf(id) >= 0 && cost(state, id) >= 3) return { type: 'ALLY_INVENTORS', pile: id };
        return { type: 'ALLY_INVENTORS', pile: null };
      }
      case 'ally_market_towns': { // 市場の町＝好意1で手札のアクションを使う（購入フェイズなのでコインを増やす札を優先）
        if ((p.favors || 0) < 1) return { type: 'ALLY_MARKET_TOWNS', card: null };
        const acts = playPool(state, pd.player).filter((c) => (isType(c, 'action') || DOM.engine.inheritedEstate(p, c)) && DOM.engine.canPlayHandCard(state, pd.player, c));
        if (!acts.length) return { type: 'ALLY_MARKET_TOWNS', card: null };
        for (const id of GAIN_ORDER) if (acts.indexOf(id) >= 0) return { type: 'ALLY_MARKET_TOWNS', card: id };
        return { type: 'ALLY_MARKET_TOWNS', card: acts[0] };
      }
      case 'ally_peaceful_cult': { // 平和的教団＝好意で手札の死蔵札を廃棄（呪い/屋敷/銅貨を優先）
        const junk = p.hand.filter((c) => isType(c, 'curse') || c === 'estate' || c === 'copper')
          .sort((a, b) => keepValue(a) - keepValue(b));
        const n = Math.min(junk.length, p.favors || 0);
        return { type: 'ALLY_PEACEFUL_CULT', cards: junk.slice(0, n) };
      }
      case 'ally_woodworkers': { // 木工ギルド＝好意1で弱いアクションを廃棄して強いアクションを獲得
        if (pd.stage === 'gain') {
          const g = firstGainable(state, (id) => isTypeSup(state, id, 'action'));
          return { type: 'ALLY_WOODWORKERS', card: g };
        }
        if ((p.favors || 0) < 1) return { type: 'ALLY_WOODWORKERS', card: null };
        const acts = p.hand.filter((c) => isType(c, 'action')).sort((a, b) => cost(state, a) - cost(state, b));
        const best = firstGainable(state, (id) => isTypeSup(state, id, 'action'));
        if (!acts.length || !best) return { type: 'ALLY_WOODWORKERS', card: null };
        // 廃棄する札より明確に良いアクションが獲得できるときだけ
        return { type: 'ALLY_WOODWORKERS', card: cost(state, best) > cost(state, acts[0]) ? acts[0] : null };
      }
      case 'ally_coastal_haven': { // 沿岸の避難港＝好意で良い札を次のターンへ持ち越す（金貨/銀貨/アクションを残す）
        const keep = p.hand.filter((c) => !isDead(c) && c !== 'copper')
          .sort((a, b) => keepValue(b) - keepValue(a));
        const n = Math.min(keep.length, p.favors || 0, 2); // 使いすぎない（好意は他でも要る）
        return { type: 'ALLY_COASTAL_HAVEN', cards: keep.slice(0, n) };
      }
      case 'ally_architects': { // 建築家ギルド＝好意2で「より安い勝利点でないカード」を獲得（連鎖する）
        if ((p.favors || 0) < 2) return { type: 'ALLY_ARCHITECTS', card: null };
        const pred = DOM.engine.architectsCanGain(state, pd.card);
        const g = firstGainable(state, pred);
        return { type: 'ALLY_ARCHITECTS', card: g };
      }
      /* ========== 同盟（Allies）A4：王国カード49種 ========== */
      /* 循環(Rotate)＝**常に任意**。「回した後に一番上に来る札」が GAIN_ORDER で今の一番上より上位のときだけ回す。
         戦闘計画（pd.any）は任意のサプライ山が候補＝同じ基準で一番得をする山を選び、無ければ回さない。 */
      case 'rotate_pile': {
        const better = (pileId) => {
          const arr = state[pileId];
          if (!Array.isArray(arr) || !arr.length) return false;
          const top = arr[0];
          const nxt = arr.find((c) => c !== top);
          if (!nxt) return false;
          const ri = (c) => { const i = GAIN_ORDER.indexOf(c); return i < 0 ? 999 : i; };
          return ri(nxt) < ri(top);
        };
        if (pd.any) {
          const cands = DOM.engine.rotatableSupplyPiles(state).filter(better);
          return { type: 'ROTATE_PILE', pile: cands.length ? cands[0] : null };
        }
        return { type: 'ROTATE_PILE', pile: better(pd.pile) ? pd.pile : null };
      }

      /* 「選ぶ」カードは長老(Elder)が付くと**異なる2つ**を選べる（`pd.elder`）。
         CPU は主選択に加えて **2つ目を追加するだけ**（engine が記載順に解決する）。 */
      case 'town_choose': {
        const main = p.hand.some((c) => isType(c, 'action')) ? 'cards' : 'coins';
        return { type: 'TOWN_CHOOSE', choices: pd.elder ? ['cards', 'coins'] : [main] };
      }
      case 'blacksmith_choose': { // 蹄鉄工＝手札が少なければ「6枚まで」、多ければ +2カード
        const need = 6 - p.hand.length;
        const main = need >= 3 ? 'six' : 'two';
        return { type: 'BLACKSMITH_CHOOSE', choices: pd.elder ? [main, 'cantrip'] : [main] };
      }
      case 'miller_pick': { // 粉屋＝見た4枚から一番価値の高い1枚を手札へ（強制）
        const order = pd.cards.slice().sort((a, b) => keepValue(b) - keepValue(a));
        return { type: 'MILLER_PICK', card: order[0] };
      }
      case 'marquis_discard': { // 侯爵＝手札10枚まで、弱い札から捨てる
        const need = Math.max(0, p.hand.length - 10);
        const order = p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b));
        return { type: 'MARQUIS_DISCARD', cards: order.slice(0, need) };
      }
      case 'sycophant_discard': { // ごますり＝弱い札から3枚
        const need = Math.min(3, p.hand.length);
        const order = p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b));
        return { type: 'SYCOPHANT_DISCARD', cards: order.slice(0, need) };
      }
      case 'sibyl_place': { // 女予言者＝良い札を上に、弱い札を下に
        const order = p.hand.slice().sort((a, b) => keepValue(b) - keepValue(a));
        return { type: 'SIBYL_PLACE', card: pd.stage === 'top' ? order[0] : order[order.length - 1] };
      }
      case 'capital_city': { // 首都＝死蔵札が2枚あれば捨てて +2コイン／コインに余裕があれば +2カード
        if (pd.stage === 'discard') {
          const junk = p.hand.filter((c) => isDead(c) || c === 'copper').sort((a, b) => keepValue(a) - keepValue(b));
          if (junk.length >= 2 && p.hand.length >= 2) return { type: 'CAPITAL_CITY', ok: true, cards: junk.slice(0, 2) };
          return { type: 'CAPITAL_CITY', ok: false };
        }
        // 支払いは「$2 払っても買いたい札の水準が落ちない」ときだけ（素朴に $5 以上残るなら払う）
        return { type: 'CAPITAL_CITY', ok: (state.turn.coins || 0) >= 5 };
      }
      case 'innkeeper_choose': { // 宿屋の主人＝手札が少なければ大きく引く（捨てるのは死蔵札）
        const main = p.hand.length <= 2 ? 'five' : (p.hand.length <= 4 ? 'three' : 'one');
        return { type: 'INNKEEPER_CHOOSE', choices: (pd.elder && main !== 'one') ? ['one', main] : [main] };
      }
      case 'innkeeper_discard': {
        const need = Math.min(pd.n, p.hand.length);
        const order = p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b));
        return { type: 'INNKEEPER_DISCARD', cards: order.slice(0, need) };
      }
      case 'hunter_pick': { // 狩人＝その枠に合う中で一番価値の高い1枚（強制）
        const cands = pd.cards.filter((c) => (pd.stage === 'treasure'
          ? DOM.engine.isTreasureFor(state, c) : isType(c, pd.stage)));
        const order = cands.slice().sort((a, b) => keepValue(b) - keepValue(a));
        return { type: 'HUNTER_PICK', card: order[0] || cands[0] || pd.cards[0] };
      }
      case 'stronghold_choose': { // 要塞＝今のコインが伸びていれば +3コイン（$8に届かせる）、そうでなければ次ターンの +3カード
        const main = (state.turn.coins || 0) >= 3 ? 'coins' : 'cards';
        return { type: 'STRONGHOLD_CHOOSE', choices: pd.elder ? ['coins', 'cards'] : [main] };
      }
      case 'hill_fort_gain': { // 堡塁＝コスト4以下で一番良いカードを獲得（強制）
        const g = bestGain(state, 4, { noVictory: true }) || bestGain(state, 4) ||
          firstGainable(state, (id) => DOM.engine.costUpTo(state, id, 4));
        return { type: 'HILL_FORT_GAIN', card: g };
      }
      case 'hill_fort_choose': { // 堡塁＝獲得したのがアクションで手札に欲しければ手札へ、そうでなければ cantrip
        const main = (pd.card && isType(pd.card, 'action')) ? 'hand' : 'cantrip';
        return { type: 'HILL_FORT_CHOOSE', choices: pd.elder ? ['hand', 'cantrip'] : [main] };
      }
      case 'allies_topdeck': { // 天幕/商人の野営地＝場から捨てる代わりに山札の上へ（常に得なので全部置く）
        return { type: 'ALLIES_TOPDECK', cards: (pd.cards || []).slice() };
      }
      case 'sunken_treasure': { // 沈没船の財宝＝場に同名が無いアクションを1枚獲得（強制・コスト制限なし）
        const g = firstGainable(state, DOM.engine.sunkenTreasureCanGain(state, pd.player));
        return { type: 'SUNKEN_TREASURE_GAIN', card: g };
      }

      /* ===== 同盟 A4：残り5種 ===== */
      case 'sentinel': {
        if (pd.stage === 'trash') { // 死蔵札（呪い/銅貨/素の勝利点）を最大2枚まで廃棄
          const junk = pd.cards.filter((c) => isDead(c) || c === 'copper').sort((a, b) => keepValue(a) - keepValue(b));
          return { type: 'SENTINEL_TRASH', cards: junk.slice(0, 2) };
        }
        // 良い札から順に山札の上へ
        return { type: 'SENTINEL_ORDER', order: pd.cards.slice().sort((a, b) => keepValue(b) - keepValue(a)) };
      }
      case 'carpenter_gain': {
        const g = bestGain(state, 4, { noVictory: true }) || bestGain(state, 4) ||
          firstGainable(state, (id) => DOM.engine.costUpTo(state, id, 4));
        return { type: 'CARPENTER_GAIN', card: g };
      }
      case 'carpenter_trash': {
        const junk = p.hand.filter((c) => isDead(c) || c === 'copper').sort((a, b) => cost(state, b) - cost(state, a));
        if (junk.length) return { type: 'CARPENTER_TRASH', card: junk[0] };
        const order = p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b));
        return { type: 'CARPENTER_TRASH', card: order[0] };
      }
      case 'carpenter_upgrade':
        return { type: 'CARPENTER_UPGRADE', card: firstGainable(state, DOM.engine.modifyCanGain(state, pd)) };
      case 'courier_play': { // 急使＝捨て札から一番強いアクション/財宝を使う（辞退可）
        const cands = (p.discard || []).filter((c) => isType(c, 'action') || isTreasureNow(state, c));
        if (!cands.length) return { type: 'COURIER_PLAY', card: null };
        for (const id of GAIN_ORDER) if (cands.indexOf(id) >= 0) return { type: 'COURIER_PLAY', card: id };
        return { type: 'COURIER_PLAY', card: cands[0] };
      }
      case 'swap_return': { // 交換＝一番弱いアクションを山に戻す（強い札が獲得できるときだけ）
        const acts = p.hand.filter((c) => isType(c, 'action') && DOM.engine.canReturnToPile(state, c))
          .sort((a, b) => cost(state, a) - cost(state, b));
        if (!acts.length) return { type: 'SWAP_RETURN', card: null };
        const best = firstGainable(state, DOM.engine.swapCanGain(state, acts[0]));
        if (!best || cost(state, best) <= cost(state, acts[0])) return { type: 'SWAP_RETURN', card: null };
        return { type: 'SWAP_RETURN', card: acts[0] };
      }
      case 'swap_gain':
        return { type: 'SWAP_GAIN', card: firstGainable(state, DOM.engine.swapCanGain(state, pd.returned)) };
      case 'acolyte_trash': { // 侍祭＝手札の素の勝利点を廃棄して金貨（無ければ廃棄しない）
        const vic = p.hand.filter((c) => (isType(c, 'victory') && !isType(c, 'action')) || isDead(c));
        if (vic.length) return { type: 'ACOLYTE_TRASH', card: vic[0] };
        return { type: 'ACOLYTE_TRASH', card: null };
      }
      case 'acolyte_self': { // 侍祭＝卜占官の一番上が侍祭より良ければ自身を廃棄して獲得
        const top = (state.augurs || [])[0];
        return { type: 'ACOLYTE_SELF', ok: !!top && cost(state, top) >= 4 };
      }

      /* ===== 同盟 A4：アタック7種（堀があれば必ず公開して無効化する） ===== */
      case 'barbarian': {
        if (pd.stage === 'react') return immuneReveal(p) ? immuneReveal(p) : { type: 'BARBARIAN_REACT' };
        // 格下げ獲得は被害者が選ぶ（強制）＝一番良いものを取る
        const g = firstGainable(state, DOM.engine.barbarianCanGain(state, pd.trashed));
        return { type: 'BARBARIAN_GAIN', card: g };
      }
      case 'archer': {
        if (pd.stage === 'react') return immuneReveal(p) ? immuneReveal(p) : { type: 'ARCHER_REACT' };
        if (pd.stage === 'hide') { // 被害者＝一番大事な札を隠す
          const order = p.hand.slice().sort((a, b) => keepValue(b) - keepValue(a));
          return { type: 'ARCHER_HIDE', card: order[0] };
        }
        // 使用者＝公開された中で一番価値の高い札を捨てさせる
        const order = (pd.revealed || []).slice().sort((a, b) => keepValue(b) - keepValue(a));
        return { type: 'ARCHER_PICK', card: order[0] || (pd.revealed || [])[0] };
      }
      case 'sorceress': {
        if (pd.stage === 'react') return immuneReveal(p) ? immuneReveal(p) : { type: 'SORCERESS_REACT' };
        // 宣言＝自分の山札に一番多い名前（銅貨/屋敷が基本）
        return { type: 'SORCERESS_NAME', card: mostLikelyTop(p) };
      }
      case 'sorcerer': {
        if (pd.stage === 'react') return immuneReveal(p) ? immuneReveal(p) : { type: 'SORCERER_REACT' };
        return { type: 'SORCERER_NAME', card: mostLikelyTop(p) };
      }
      case 'skirmisher': return immuneReveal(p) ? immuneReveal(p) : { type: 'SKIRMISHER_REACT' };
      case 'highwayman': case 'warlord': // 相手のターンをフックする持続アタック（堀で免疫）
        return immuneReveal(p) ? immuneReveal(p) : { type: 'LINGER_REACT' };

      case 'royal_galley_play': { // 王家のガレー船＝手札の持続でないアクションを1枚（次のターンにもう一度使える）
        const cands = playPool(state, pd.player).filter((c) => isType(c, 'action') && !isType(c, 'duration') && DOM.engine.canPlayHandCard(state, pd.player, c));
        if (!cands.length) return { type: 'ROYAL_GALLEY_PLAY', card: null };
        for (const id of GAIN_ORDER) if (cands.indexOf(id) >= 0) return { type: 'ROYAL_GALLEY_PLAY', card: id };
        return { type: 'ROYAL_GALLEY_PLAY', card: cands[0] };
      }
      case 'conjurer_gain': { // 霊術師＝$4以下で一番良いカード（強制）
        const g = bestGain(state, 4, { noVictory: true }) || bestGain(state, 4) ||
          firstGainable(state, (id) => DOM.engine.costUpTo(state, id, 4));
        return { type: 'CONJURER_GAIN', card: g };
      }
      case 'specialist_play': { // 専門家＝手札のアクション/財宝で一番強いもの（辞退可）
        const cands = playPool(state, pd.player).filter((c) => (isType(c, 'action') || isTreasureNow(state, c)) && DOM.engine.canPlayHandCard(state, pd.player, c));
        if (!cands.length) return { type: 'SPECIALIST_PLAY', card: null };
        for (const id of GAIN_ORDER) if (cands.indexOf(id) >= 0) return { type: 'SPECIALIST_PLAY', card: id };
        return { type: 'SPECIALIST_PLAY', card: cands[0] };
      }
      case 'specialist_choose': { // 専門家＝もう一度使う（基本）／サプライに無ければ獲得も無意味なので again
        const canCopy = !!pd.card && gainableBase(state, pd.card);
        const main = 'again';
        return { type: 'SPECIALIST_CHOOSE', choices: (pd.elder && canCopy) ? ['again', 'copy'] : [main] };
      }
      case 'elder_play': { // 長老＝手札のアクションで一番強いもの（辞退可）
        const cands = playPool(state, pd.player).filter((c) => isType(c, 'action') && DOM.engine.canPlayHandCard(state, pd.player, c));
        if (!cands.length) return { type: 'ELDER_PLAY', card: null };
        for (const id of GAIN_ORDER) if (cands.indexOf(id) >= 0) return { type: 'ELDER_PLAY', card: id };
        return { type: 'ELDER_PLAY', card: cands[0] };
      }
      case 'modify_trash': { // 改造＝死蔵札があれば圧縮、無ければ一番安い札（強制）
        const junk = p.hand.filter((c) => isDead(c) || c === 'copper').sort((a, b) => cost(state, b) - cost(state, a));
        if (junk.length) return { type: 'MODIFY_TRASH', card: junk[0] };
        const order = p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b));
        return { type: 'MODIFY_TRASH', card: order[0] };
      }
      case 'modify_choose': { // 改造＝格上げできるなら獲得、できなければキャントリップ
        const canG = !pd.noTrash && firstGainable(state, DOM.engine.modifyCanGain(state, pd));
        const main = canG ? 'gain' : 'cantrip';
        return { type: 'MODIFY_CHOOSE', choices: (pd.elder && canG) ? ['cantrip', 'gain'] : [main] };
      }
      case 'modify_gain': { // 改造＝廃棄した札より最大2コイン高いカードを1枚（強制）
        const g = firstGainable(state, DOM.engine.modifyCanGain(state, pd));
        return { type: 'MODIFY_GAIN', card: g };
      }
      case 'lich_gain': { // リッチ＝廃棄置き場からこれより安いカードで一番良いもの（強制）
        const cands = DOM.engine.lichTrashTargets(state);
        const order = cands.slice().sort((a, b) => keepValue(b) - keepValue(a));
        return { type: 'LICH_GAIN', card: order[0] || cands[0] || null };
      }
      case 'bauble_choose': { // 道化棒＝異なる2つ（購入フェイズなので +$1 と +1購入 を基本にする）
        const wantFavor = !!state.ally; // Ally が居るゲームなら好意にも価値がある
        return { type: 'BAUBLE_CHOOSE', picks: wantFavor ? ['coin', 'favor'] : ['coin', 'buy'] };
      }
      case 'contract_setaside': { // 契約書＝次のターンの開始時に使う価値のあるアクションを脇に置く
        const acts = p.hand.filter((c) => isType(c, 'action'));
        if (!acts.length) return { type: 'CONTRACT_SETASIDE', card: null };
        for (const id of GAIN_ORDER) if (acts.indexOf(id) >= 0) return { type: 'CONTRACT_SETASIDE', card: id };
        return { type: 'CONTRACT_SETASIDE', card: acts[0] };
      }
      case 'contract_play': return { type: 'CONTRACT_PLAY' }; // 強制（脇札を使う）
      case 'importer_gain': { // 輸入者＝$5以下で一番良いカード（強制）
        const g = bestGain(state, 5, { noVictory: true }) || bestGain(state, 5) ||
          firstGainable(state, (id) => DOM.engine.costUpTo(state, id, 5));
        return { type: 'IMPORTER_GAIN', card: g };
      }
      case 'broker_trash': { // 仲買人＝死蔵札があれば圧縮、無ければ一番安い札（強制）
        const junk = p.hand.filter((c) => isDead(c) || c === 'copper').sort((a, b) => cost(state, b) - cost(state, a));
        if (junk.length) return { type: 'BROKER_TRASH', card: junk[0] };
        const order = p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b));
        return { type: 'BROKER_TRASH', card: order[0] };
      }
      case 'broker_choose': { // 仲買人＝アクション権が尽きていて手札にアクションがあれば+アクション、他はコイン
        let main = 'coins';
        if (state.turn.phase === 'action' && (state.turn.actions || 0) === 0 && p.hand.some((c) => isType(c, 'action'))) main = 'actions';
        else if ((pd.n || 0) >= 3) main = 'cards';
        return { type: 'BROKER_CHOOSE', choices: pd.elder ? [main, main === 'coins' ? 'cards' : 'coins'] : [main] };
      }
      case 'student_trash': { // 生徒＝財宝を廃棄すると好意＋山札の上に戻る。銅貨があれば銅貨、無ければ死蔵札
        if (p.hand.includes('copper')) return { type: 'STUDENT_TRASH', card: 'copper' };
        const tre = p.hand.filter((c) => isTreasureNow(state, c)).sort((a, b) => keepValue(a) - keepValue(b));
        if (tre.length) return { type: 'STUDENT_TRASH', card: tre[0] };
        const order = p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b));
        return { type: 'STUDENT_TRASH', card: order[0] };
      }
      case 'town_crier_choose': { // 触れ役＝アクション権が残っていれば cantrip、そうでなければ +2コイン
        const main = ((state.turn.actions || 0) > 0 && p.hand.some((c) => isType(c, 'action'))) ? 'cantrip' : 'coins';
        return { type: 'TOWN_CRIER_CHOOSE', choices: pd.elder ? ['coins', 'cantrip'] : [main] };
      }
      case 'herb_gatherer_play': { // 薬草集め＝捨て札から一番強い財宝を使う
        const tre = (p.discard || []).filter((c) => isTreasureNow(state, c)).sort((a, b) => keepValue(b) - keepValue(a));
        return { type: 'HERB_GATHERER_PLAY', card: tre[0] || null };
      }
      case 'old_map_discard': { // 古地図＝一番弱い札を捨てる（強制）
        const order = p.hand.slice().sort((a, b) => keepValue(a) - keepValue(b));
        return { type: 'OLD_MAP_DISCARD', card: order[0] };
      }
      case 'battle_plan_reveal': { // 戦闘計画＝手札にアタックがあれば公開して +1カード（純利得）
        const atk = p.hand.filter((c) => isType(c, 'attack'));
        return { type: 'BATTLE_PLAN_REVEAL', card: atk[0] || null };
      }

      case 'ally_nomads': { // 遊牧民団＝好意1で +1カード/+1アクション/+1購入（相手のターン中は +カード 一択）
        if ((p.favors || 0) < 1) return { type: 'ALLY_NOMADS', choice: null };
        const myTurn = state.turn && state.turn.active === pd.player;
        if (!myTurn) return { type: 'ALLY_NOMADS', choice: 'card' };
        if (state.turn.phase === 'action' && (state.turn.actions || 0) === 0 &&
            p.hand.some((c) => isType(c, 'action'))) return { type: 'ALLY_NOMADS', choice: 'action' };
        return { type: 'ALLY_NOMADS', choice: 'card' };
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
    /* 移動動物園：習性（Way）＝アクションの記載効果の「代わり」に使う。使いすぎると弱くなるので、
       CPU は「記載効果が今は活きない」局面だけ使う（engine/UI と違い候補を出す側なので保守的に）。 */
    /* 同盟：航海（Voyage）の追加ターンは**手札から3枚まで**しか使えない。engine が拒否する手を
       返し続けると本番 livelock になるので、CPU も同じ述語（`canPlayFromHand`）を見る。 */
    const canHandPlay = !DOM.engine.canPlayFromHand || DOM.engine.canPlayFromHand(state, t.active);
    if (t.phase === 'action') {
      const a = canHandPlay ? chooseAction(state, subj) : null;
      if (a) return { type: 'PLAY_ACTION', card: a, way: chooseWay(state, subj, a) };
      /* ルネサンス：村人（Villagers）＝アクション権が尽きたが手札にまだ使えるアクションがあるなら、村人を1人使う。
         engine は「アクションフェイズ・所持数以内・1個以上」でしか受理しないので、その条件下でだけ返す＝非ループ
         （村人は有限＝毎回1人ずつ減るので必ず終端する）。 */
      if ((t.actions || 0) === 0 && (subj.villagers || 0) > 0 &&
          subj.hand.some((c) => isType(c, 'action') || DOM.engine.inheritedEstate(subj, c))) {
        return { type: 'SPEND_VILLAGER', amount: 1 };
      }
      return { type: 'END_ACTION_PHASE' };
    }
    /* 夜想曲：夜フェイズ＝手札の夜行カードを使う（アクション権も購入権も消費しない＝出せるだけ出す）。
       ここに分岐が無いと END_TURN を返し続けて夜行カードを一生使わない（＝カードが死ぬ）。
       engine は phase==='night' でしか PLAY_NIGHT を受理しないので、拒否される手は返らない＝非ループ
       （毎回1枚ずつ手札から減るので必ず終端する）。 */
    if (t.phase === 'night') {
      const n = canHandPlay ? chooseNight(state, subj) : null;
      if (n) return { type: 'PLAY_NIGHT', card: n };
      return { type: 'END_TURN' };
    }
    // 購入フェーズ（支配中は被支配者の手札の財宝を出し、獲得は支配者が受け取る）
    //   ※ 一度でも購入すると engine は財宝プレイを拒否する（公式ルール）。拒否される手を返すと無限ループになるので
    //     t.treasuresLocked を必ず見る（イベントの効果で財宝が手札に入るケースがある）。
    //   ルネサンス：資本主義で「財宝になったアクション」も engine の isTreasureFor が受理する＝同じ述語を見る。
    //   夜想曲：呪われた金貨は「財宝を全部出す」の対象外（出すと必ず呪いを獲得する＝ボタン1つで事故になるため）。
    //     engine が出さない札を PLAY_ALL_TREASURES で出そうとすると**状態が変わらず無限ループ**になるので、
    //     CPU は 1枚ずつの PLAY_TREASURE で出す（+3コインの価値はあるので出す判断自体は同じ）。
    const isTre = (c) => (DOM.engine.isTreasureFor ? DOM.engine.isTreasureFor(state, c) : isTreasure(c));
    /* 略奪：坩堝/つるはし も PLAY_ALL_TREASURES の対象外（出すと手札1枚の廃棄が**強制**）＝呪われた金貨と同じく
       1枚ずつ PLAY_TREASURE で出す（engine の PLAY_ALL_EXCLUDE と同じ集合を見ないと無限ループになる）。 */
    const PLAY_ALL_SKIP = ['cursed_gold', 'crucible', 'pickaxe'];
    if (canHandPlay && !t.treasuresLocked && subj.hand.some((c) => isTre(c) && PLAY_ALL_SKIP.indexOf(c) < 0)) return { type: 'PLAY_ALL_TREASURES' };
    if (canHandPlay && !t.treasuresLocked) {
      // 除外財宝しか残っていない＝価値があるものだけ1枚ずつ出す（坩堝/つるはしは廃棄したい不要札があるときだけ）。
      if (subj.hand.includes('cursed_gold')) return { type: 'PLAY_TREASURE', card: 'cursed_gold' };
      const junkInHand = subj.hand.some((c) => trashValue(c) < 10);
      if (subj.hand.includes('crucible') && junkInHand) return { type: 'PLAY_TREASURE', card: 'crucible' };
      if (subj.hand.includes('pickaxe') && junkInHand) return { type: 'PLAY_TREASURE', card: 'pickaxe' };
    }
    // 帝国：負債があるとカードを購入できない。財宝を出し切った後、コインで可能な限り返済する。
    //   返済しきれない（コイン0）なら購入不可＝END_TURN（負債は次ターンに持ち越し。財宝を出せば返せる＝非ループ）。
    if ((subj.debt || 0) > 0) {
      if ((t.coins || 0) > 0) return { type: 'REPAY_DEBT', amount: Math.min(subj.debt, t.coins) };
      return { type: 'END_TURN' };
    }
    const level = (state.players[ctrl] && state.players[ctrl].cpuLevel) || 'normal';
    // ギルド：財源(Coffers)を使うか判断。財宝を出し切ったあと、財源を足すとより良い買いになるなら最小枚数だけ使う。
    const spend = coffersToSpend(state, subj, level);
    if (spend > 0) return { type: 'COFFERS_SPEND', amount: spend };
    // 冒険：使節団（Mission）の追加ターンはカードを購入できない（イベントは買える）。
    //   engine が BUY を拒否するので、ここで候補から外さないと無限ループになる。
    const b = t.noBuyCards ? null : chooseBuy(state, subj, level);
    // 横型イベント（買う横型）を、カード買いと比較して買うか判断（採用時のみ・affordable かつ 負債0・1ターン1回制限も見る）。
    const evBuy = bestEventBuy(state, subj, level, b);
    if (evBuy) return { type: 'BUY_EVENT', event: evBuy };
    // ルネサンス：横型プロジェクト（1人2つまで・同じものは1回だけ）。engine の canBuyProject が正本（拒否されない＝無限ループ防止）。
    const prBuy = bestProjectBuy(state, subj, level, b);
    if (prBuy) return { type: 'BUY_PROJECT', project: prBuy };
    return b ? { type: 'BUY', card: b } : { type: 'END_TURN' };
  }
  // 財源を何枚使うか：現状の最善買いより価値の高い買いに届く最小の財源枚数を返す（届かなければ0＝温存）。
  function coffersToSpend(state, p, level) {
    const coffers = p.coffers || 0;
    if (coffers <= 0 || buysLeft(state) <= 0) return 0;
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
