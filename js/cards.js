/* ============================================================
   ドミニオン 基本セット - カード定義
   ============================================================ */
(function () {
  // ブラウザ(window)でもNode(global)でも同じ DOM 名前空間に載せる（サーバと共有）
  const root = (typeof window !== 'undefined') ? window
    : (typeof global !== 'undefined') ? global : globalThis;
  const DOM = (root.DOM = root.DOM || {});

  // 各カードの定義
  // types: treasure(財宝) / victory(勝利点) / curse(呪い) / action(アクション) / attack / reaction
  // coin: 財宝として出したときのコイン
  // vp:   勝利点（呪いは負）
  DOM.CARDS = {
    copper:    { id: 'copper',    name: '銅貨',       cost: 0, types: ['treasure'],            coin: 1,
                 text: 'コイン +1' },
    silver:    { id: 'silver',    name: '銀貨',       cost: 3, types: ['treasure'],            coin: 2,
                 text: 'コイン +2' },
    gold:      { id: 'gold',      name: '金貨',       cost: 6, types: ['treasure'],            coin: 3,
                 text: 'コイン +3' },

    estate:    { id: 'estate',    name: '屋敷',       cost: 2, types: ['victory'],             vp: 1,
                 text: '勝利点 1' },
    duchy:     { id: 'duchy',     name: '公領',       cost: 5, types: ['victory'],             vp: 3,
                 text: '勝利点 3' },
    province:  { id: 'province',  name: '属州',       cost: 8, types: ['victory'],             vp: 6,
                 text: '勝利点 6' },
    curse:     { id: 'curse',     name: '呪い',       cost: 0, types: ['curse'],               vp: -1,
                 text: '勝利点 −1' },

    // 王国カード（初回おすすめセット）
    cellar:    { id: 'cellar',    name: '地下貯蔵庫', cost: 2, types: ['action'],
                 text: '+1 アクション\n手札を好きな枚数捨て、同じ枚数引く。' },
    market:    { id: 'market',    name: '市場',       cost: 5, types: ['action'],
                 text: '+1 カード\n+1 アクション\n+1 購入\n+1 コイン' },
    militia:   { id: 'militia',   name: '民兵',       cost: 4, types: ['action', 'attack'],
                 text: '+2 コイン\n他のプレイヤーは手札が3枚になるまで捨てる。' },
    mine:      { id: 'mine',      name: '鉱山',       cost: 5, types: ['action'],
                 text: '手札の財宝1枚を廃棄してよい。\nそのコスト+3以下の財宝を手札に獲得する。' },
    moat:      { id: 'moat',      name: '堀',         cost: 2, types: ['action', 'reaction'],
                 text: '+2 カード\n（リアクション）他人のアタックを受けたとき、\nこれを公開して無効化できる。' },
    remodel:   { id: 'remodel',   name: '改築',       cost: 4, types: ['action'],
                 text: '手札1枚を廃棄し、\nそのコスト+2以下のカードを獲得する。' },
    smithy:    { id: 'smithy',    name: '鍛冶屋',     cost: 4, types: ['action'],
                 text: '+3 カード' },
    village:   { id: 'village',   name: '村',         cost: 3, types: ['action'],
                 text: '+1 カード\n+2 アクション' },
    woodcutter:{ id: 'woodcutter',name: '木こり',     cost: 3, types: ['action'],
                 text: '+1 購入\n+2 コイン' },
    workshop:  { id: 'workshop',  name: '工房',       cost: 3, types: ['action'],
                 text: 'コスト4以下のカードを1枚獲得する。' },

    /* ===== 基本セット（追加分） ===== */
    laboratory:{ id: 'laboratory',name: '研究所',     cost: 5, types: ['action'],
                 text: '+2 カード\n+1 アクション' },
    festival:  { id: 'festival',  name: '祝祭',       cost: 5, types: ['action'],
                 text: '+2 アクション\n+1 購入\n+2 コイン' },
    moneylender:{ id: 'moneylender', name: '金貸し',  cost: 4, types: ['action'],
                 text: '手札の銅貨1枚を廃棄してよい。\nそうしたら +3 コイン。' },
    chancellor:{ id: 'chancellor', name: '宰相',     cost: 3, types: ['action'],
                 text: '+2 コイン\n望むなら、自分の山札をすべて捨て札にしてよい。' },
    chapel:    { id: 'chapel',     name: '礼拝堂',     cost: 2, types: ['action'],
                 text: '手札を最大4枚まで廃棄する。' },
    gardens:   { id: 'gardens',    name: '庭園',       cost: 4, types: ['victory'],
                 text: '（勝利点）\nデッキ10枚につき 1 勝利点（端数切り捨て）。' },
    witch:     { id: 'witch',      name: '魔女',       cost: 5, types: ['action', 'attack'],
                 text: '+2 カード\n他のプレイヤーは各自、呪い1枚を獲得する。' },
    bureaucrat:{ id: 'bureaucrat', name: '役人',       cost: 4, types: ['action', 'attack'],
                 text: '銀貨1枚を獲得し、山札の上に置く。\n他のプレイヤーは各自、手札の勝利点1枚を\n山札の上に置く（無ければ手札を公開）。' },

    /* ===== 拡張: 陰謀 (Intrigue) =====
       絵(asset/<id>.jpg・asset/thumb/<id>.jpg)は未用意。置けば自動で表示される。
       未配置の間は文字カード(フォールバック)で表示される。 */
    courtyard:     { id: 'courtyard',     name: '中庭',       cost: 2, types: ['action'],
                     text: '+3 カード\n手札のカード1枚を山札の上に置く。' },
    pawn:          { id: 'pawn',          name: '従者',       cost: 2, types: ['action'],
                     text: '次から異なる2つを選ぶ：\n+1 カード／+1 アクション／+1 購入／+1 コイン' },
    shanty_town:   { id: 'shanty_town',   name: '寂れた村',   cost: 3, types: ['action'],
                     text: '+2 アクション\n手札を公開し、アクションが無ければ +2 カード。' },
    steward:       { id: 'steward',       name: '執事',       cost: 3, types: ['action'],
                     text: '次から1つを選ぶ：\n+2 カード／+2 コイン／手札を2枚廃棄。' },
    wishing_well:  { id: 'wishing_well',  name: '願いの井戸', cost: 3, types: ['action'],
                     text: '+1 カード\n+1 アクション\nカードを1種宣言し、山札の一番上を公開。\n当たれば手札に加える。' },
    baron:         { id: 'baron',         name: '男爵',       cost: 4, types: ['action'],
                     text: '+1 購入\n屋敷1枚を捨てて +4 コイン。\n捨てないなら屋敷1枚を獲得する。' },
    bridge:        { id: 'bridge',        name: '橋',         cost: 4, types: ['action'],
                     text: '+1 購入\n+1 コイン\nこのターン、全てのカードのコストが1少なくなる。' },
    conspirator:   { id: 'conspirator',   name: '共謀者',     cost: 4, types: ['action'],
                     text: '+2 コイン\nこのターンにアクションを3回以上使っていれば、\n+1 カード +1 アクション。' },
    ironworks:     { id: 'ironworks',     name: '鉄工所',     cost: 4, types: ['action'],
                     text: 'コスト4以下のカードを1枚獲得する。\nそれがアクションなら +1 アクション、\n財宝なら +1 コイン、勝利点なら +1 カード。' },
    mining_village:{ id: 'mining_village',name: '鉱山の村',   cost: 4, types: ['action'],
                     text: '+1 カード\n+2 アクション\nこれを廃棄してもよい。\nその場合 +2 コイン。' },
    torturer:      { id: 'torturer',      name: '拷問人',     cost: 5, types: ['action', 'attack'],
                     text: '+3 カード\n他のプレイヤーは各自、\n手札を2枚捨てるか、呪い1枚を手札に獲得する。' },
    duke:          { id: 'duke',          name: '公爵',       cost: 5, types: ['victory'],
                     text: '（勝利点）\n所持する公領1枚につき 1 勝利点。' },
    nobles:        { id: 'nobles',        name: '貴族',       cost: 6, types: ['victory', 'action'], vp: 2,
                     text: '（勝利点 2）\n次から1つを選ぶ：+3 カード／+2 アクション。' },
    harem:         { id: 'harem',         name: '後宮',       cost: 6, types: ['treasure', 'victory'], coin: 2, vp: 2,
                     text: 'コイン +2\n（勝利点 2）' },

    /* ===== 拡張: 陰謀（追加分） ===== */
    great_hall:    { id: 'great_hall',    name: '大広間',     cost: 3, types: ['action', 'victory'], vp: 1,
                     text: '+1 カード\n+1 アクション\n（勝利点 1）' },
    coppersmith:   { id: 'coppersmith',   name: '銅細工師',   cost: 4, types: ['action'],
                     text: 'このターン、銅貨は+1コイン多く出る。\n（銅貨1枚が2コインになる）' },
    trading_post:  { id: 'trading_post',  name: '交易場',     cost: 5, types: ['action'],
                     text: '手札を2枚廃棄する。\nそうしたら銀貨1枚を手札に獲得する。' },
    upgrade:       { id: 'upgrade',       name: '改良',       cost: 5, types: ['action'],
                     text: '+1 カード\n+1 アクション\n手札を1枚廃棄する。\nそれよりちょうど1コイン高いカードを1枚獲得する。' },
    scout:         { id: 'scout',         name: '斥候',       cost: 4, types: ['action'],
                     text: '+1 アクション\n山札の上4枚を公開する。\n勝利点は手札に加え、\n残りを好きな順で山札の上に戻す。' },
    tribute:       { id: 'tribute',       name: '貢物',       cost: 5, types: ['action'],
                     text: '左隣のプレイヤーは山札の上2枚を公開して捨てる。\n公開された異なる名前ごとに：\nアクション＝+2アクション／財宝＝+2コイン／勝利点＝+2カード。' },
    swindler:      { id: 'swindler',      name: '詐欺師',     cost: 5, types: ['action', 'attack'],
                     text: '+2 コイン\n他のプレイヤーは各自、山札の上1枚を廃棄し、\nあなたが選んだ同じコストのカードを獲得する。' },
    saboteur:      { id: 'saboteur',      name: '破壊工作員', cost: 5, types: ['action', 'attack'],
                     text: '他のプレイヤーは各自、コスト3以上のカードが出るまで\n山札の上を公開し、それを廃棄する。\nそれより2コイン以上安いカードを獲得してもよい。\n残りは捨てる。' },
    minion:        { id: 'minion',        name: '手先',       cost: 5, types: ['action', 'attack'],
                     text: '+1 アクション\n次のうち1つを選ぶ：\n・+2 コイン\n・手札を捨てて4枚引く。さらに手札5枚以上の\n　他のプレイヤーも手札を捨てて4枚引く。' },
    masquerade:    { id: 'masquerade',    name: '仮面舞踏会', cost: 3, types: ['action'],
                     text: '+2 カード\n各プレイヤーは同時に手札を1枚、左隣に渡す。\nその後、あなたは手札を1枚廃棄してもよい。' },
    secret_chamber:{ id: 'secret_chamber',name: '秘密の小部屋', cost: 2, types: ['action', 'reaction'],
                     text: '手札を好きな枚数捨てる。捨てた枚数だけ +1 コイン。\n（リアクション）他人がアタックを使ったとき公開してよい。\nその場合 +2 カードし、手札2枚を山札の上に戻す。' },
  };

  /* ---------- 王国カードのセット ---------- */
  // 基本セット（初回おすすめの10種）
  DOM.KINGDOM = ['cellar', 'village', 'woodcutter', 'workshop', 'moat',
                 'militia', 'smithy', 'remodel', 'market', 'mine'];
  // 陰謀（拡張）おすすめの10種
  DOM.KINGDOM_INTRIGUE = ['courtyard', 'pawn', 'shanty_town', 'steward', 'baron',
                          'bridge', 'conspirator', 'ironworks', 'mining_village', 'nobles'];
  // 拡張ごとの王国カードプール（ランダム抽選の母集団）。将来の拡張はここに足す。
  DOM.POOLS = {
    basic:    DOM.KINGDOM.concat(['laboratory', 'festival', 'moneylender', 'chancellor', 'chapel', 'gardens', 'witch', 'bureaucrat']),
    intrigue: ['courtyard', 'pawn', 'shanty_town', 'steward', 'wishing_well', 'baron',
               'bridge', 'conspirator', 'ironworks', 'mining_village', 'torturer', 'duke', 'nobles', 'harem',
               'great_hall', 'coppersmith', 'trading_post', 'upgrade', 'scout', 'tribute', 'swindler', 'saboteur', 'minion', 'masquerade', 'secret_chamber'],
  };
  // 全王国カードのプール（後方互換: 'random' の既定母集団 = 基本＋陰謀）
  DOM.KINGDOM_POOL = DOM.POOLS.basic.concat(DOM.POOLS.intrigue);
  // 画面で選べるセット（id はサーバ検証・保存にも使う）。
  //   kingdom 固定 … おすすめ10種をそのまま使う
  //   randomFrom  … 指定した拡張プールを合わせた中から毎回10種を抽選
  // 拡張を増やすときは POOLS に足し、ここに固定/ランダムのセットを追記するだけ。
  DOM.CARD_SETS = [
    { id: 'basic',           name: '基本セット',             kingdom: DOM.KINGDOM },
    { id: 'intrigue',        name: '陰謀（拡張）',           kingdom: DOM.KINGDOM_INTRIGUE },
    { id: 'random',          name: 'ランダム（基本＋陰謀）', randomFrom: ['basic', 'intrigue'] },
    { id: 'random-intrigue', name: 'ランダム（陰謀のみ）',   randomFrom: ['intrigue'] },
    { id: 'random-basic',    name: 'ランダム（基本のみ）',   randomFrom: ['basic'] },
  ];
  // プールから重複なく n 種を選ぶ（コスト順に並べて返す）
  DOM.randomKingdom = function (n, pool) {
    const src = (pool || DOM.KINGDOM_POOL).slice();
    for (let i = src.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = src[i]; src[i] = src[j]; src[j] = t; }
    return src.slice(0, n || 10).sort((a, b) => DOM.CARDS[a].cost - DOM.CARDS[b].cost || a.localeCompare(b));
  };
  // セットID → 王国カード配列（ランダム系は毎回その場で10種を確定）
  DOM.kingdomForSet = function (setId) {
    const set = DOM.CARD_SETS.find((s) => s.id === setId);
    if (set && set.randomFrom) {
      const pool = set.randomFrom.reduce((a, ex) => a.concat(DOM.POOLS[ex] || []), []);
      return DOM.randomKingdom(10, pool);
    }
    if (set && set.kingdom) return set.kingdom.slice();
    // 後方互換 / 不明なIDのフォールバック
    if (setId === 'random') return DOM.randomKingdom(10);
    if (setId === 'intrigue') return DOM.KINGDOM_INTRIGUE.slice();
    return DOM.KINGDOM.slice();
  };

  DOM.TREASURES = ['copper', 'silver', 'gold'];
  DOM.VICTORY   = ['estate', 'duchy', 'province'];

  // サプライ（場の山札）の表示順
  DOM.SUPPLY_ORDER = function (kingdom) {
    return ['copper', 'silver', 'gold', 'estate', 'duchy', 'province', 'curse'].concat(kingdom);
  };

  // 補助
  DOM.isType = function (cardId, t) {
    const c = DOM.CARDS[cardId];
    return c && c.types.indexOf(t) >= 0;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DOM;
})();
