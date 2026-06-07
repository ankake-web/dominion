/* ============================================================
   js/carddata.js — カードデータ（UIとゲームロジックを分離するデータ層）
   ------------------------------------------------------------
   正本は data/cards.json。http配信時はそちらを優先読込し、
   file:// 等で fetch できない場合は下の埋め込みデータにフォールバックする。
   （data/cards.json と内容を同期させること）
   ============================================================ */
(function () {
  const DOM = (window.DOM = window.DOM || {});

  // data/cards.json と同じ内容（フォールバック用の埋め込み）
  const EMBEDDED = [
    { id: 'copper', name: '銅貨', cost: 0, type: 'treasure', typeLabel: '財宝 / Treasure', art: 'assets/art/copper.jpg', icon: '🥉', effects: ['+1 コイン'] },
    { id: 'silver', name: '銀貨', cost: 3, type: 'treasure', typeLabel: '財宝 / Treasure', art: 'assets/art/silver.jpg', icon: '🥈', effects: ['+2 コイン'] },
    { id: 'gold', name: '金貨', cost: 6, type: 'treasure', typeLabel: '財宝 / Treasure', art: 'assets/art/gold.jpg', icon: '🥇', effects: ['+3 コイン'] },
    { id: 'estate', name: '屋敷', cost: 2, type: 'victory', typeLabel: '勝利点 / Victory', art: 'assets/art/estate.jpg', icon: '🏡', effects: ['勝利点 1'] },
    { id: 'duchy', name: '公領', cost: 5, type: 'victory', typeLabel: '勝利点 / Victory', art: 'assets/art/duchy.jpg', icon: '🏰', effects: ['勝利点 3'] },
    { id: 'province', name: '属州', cost: 8, type: 'victory', typeLabel: '勝利点 / Victory', art: 'assets/art/province.jpg', icon: '👑', effects: ['勝利点 6'] },
    { id: 'curse', name: '呪い', cost: 0, type: 'curse', typeLabel: '呪い / Curse', art: 'assets/art/curse.jpg', icon: '☠️', effects: ['勝利点 −1'] },
    { id: 'cellar', name: '地下貯蔵庫', cost: 2, type: 'action', typeLabel: 'アクション / Action', art: 'assets/art/cellar.jpg', icon: '🛢️', effects: ['+1 アクション', '手札を捨て、同じ数引く'] },
    { id: 'market', name: '市場', cost: 5, type: 'action', typeLabel: 'アクション / Action', art: 'assets/art/market.jpg', icon: '🛒', effects: ['+1 カード', '+1 アクション', '+1 購入', '+1 コイン'] },
    { id: 'militia', name: '民兵', cost: 4, type: 'attack', typeLabel: 'アクション・アタック / Attack', art: 'assets/art/militia.jpg', icon: '⚔️', effects: ['+2 コイン', '他は手札3枚まで捨てる'] },
    { id: 'mine', name: '鉱山', cost: 5, type: 'action', typeLabel: 'アクション / Action', art: 'assets/art/mine.jpg', icon: '⛏️', effects: ['財宝1枚を廃棄', 'コスト+3以下の財宝を獲得'] },
    { id: 'moat', name: '堀', cost: 2, type: 'reaction', typeLabel: 'アクション・リアクション / Reaction', art: 'assets/art/moat.jpg', icon: '🛡️', effects: ['+2 カード', 'アタックを無効化できる'] },
    { id: 'remodel', name: '改築', cost: 4, type: 'action', typeLabel: 'アクション / Action', art: 'assets/art/remodel.jpg', icon: '🏗️', effects: ['手札1枚を廃棄', 'コスト+2以下を獲得'] },
    { id: 'smithy', name: '鍛冶屋', cost: 4, type: 'action', typeLabel: 'アクション / Action', art: 'assets/art/smithy.jpg', icon: '⚒️', effects: ['+3 カード'] },
    { id: 'village', name: '村', cost: 3, type: 'action', typeLabel: 'アクション / Action', art: 'assets/art/village.jpg', icon: '🏘️', effects: ['+1 カード', '+2 アクション'] },
    { id: 'woodcutter', name: '木こり', cost: 3, type: 'action', typeLabel: 'アクション / Action', art: 'assets/art/woodcutter.jpg', icon: '🪓', effects: ['+1 購入', '+2 コイン'] },
    { id: 'workshop', name: '工房', cost: 3, type: 'action', typeLabel: 'アクション / Action', art: 'assets/art/workshop.jpg', icon: '🛠️', effects: ['コスト4以下を1枚獲得'] },
  ];

  function indexById(list) {
    const map = {};
    list.forEach((c) => { map[c.id] = c; });
    return map;
  }

  DOM.CARD_DATA_LIST = EMBEDDED;
  DOM.CARD_DATA = indexById(EMBEDDED);

  // http配信時は data/cards.json を読み直して反映（編集が効くように）。
  DOM.loadCards = function () {
    const httpLike = typeof location !== 'undefined' && /^https?:$/.test(location.protocol);
    if (httpLike && typeof fetch === 'function') {
      return fetch('data/cards.json')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('cards.json 取得失敗'))))
        .then((list) => {
          if (Array.isArray(list) && list.length) {
            DOM.CARD_DATA_LIST = list;
            DOM.CARD_DATA = indexById(list);
          }
          return DOM.CARD_DATA;
        })
        .catch(() => DOM.CARD_DATA);
    }
    return Promise.resolve(DOM.CARD_DATA);
  };
})();
