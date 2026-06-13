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
    { id: 'copper', name: '銅貨', cost: 0, type: 'treasure', typeLabel: '財宝', art: 'asset/copper.jpg', icon: '🥉', effects: ['+1 コイン'] },
    { id: 'silver', name: '銀貨', cost: 3, type: 'treasure', typeLabel: '財宝', art: 'asset/silver.jpg', icon: '🥈', effects: ['+2 コイン'] },
    { id: 'gold', name: '金貨', cost: 6, type: 'treasure', typeLabel: '財宝', art: 'asset/gold.jpg', icon: '🥇', effects: ['+3 コイン'] },
    { id: 'estate', name: '屋敷', cost: 2, type: 'victory', typeLabel: '勝利点', art: 'asset/estate.jpg', icon: '🏡', effects: ['勝利点 1'] },
    { id: 'duchy', name: '公領', cost: 5, type: 'victory', typeLabel: '勝利点', art: 'asset/duchy.jpg', icon: '🏰', effects: ['勝利点 3'] },
    { id: 'province', name: '属州', cost: 8, type: 'victory', typeLabel: '勝利点', art: 'asset/province.jpg', icon: '👑', effects: ['勝利点 6'] },
    { id: 'curse', name: '呪い', cost: 0, type: 'curse', typeLabel: '呪い', art: 'asset/curse.jpg', icon: '☠️', effects: ['勝利点 −1'] },
    { id: 'cellar', name: '地下貯蔵庫', cost: 2, type: 'action', typeLabel: 'アクション', art: 'asset/cellar.jpg', icon: '🛢️', effects: ['+1 アクション', '手札を捨て、同じ数引く'] },
    { id: 'market', name: '市場', cost: 5, type: 'action', typeLabel: 'アクション', art: 'asset/market.jpg', icon: '🛒', effects: ['+1 カード', '+1 アクション', '+1 購入', '+1 コイン'] },
    { id: 'militia', name: '民兵', cost: 4, type: 'attack', typeLabel: 'アクション', art: 'asset/militia.jpg', icon: '⚔️', effects: ['+2 コイン', '他は手札3枚まで捨てる'] },
    { id: 'mine', name: '鉱山', cost: 5, type: 'action', typeLabel: 'アクション', art: 'asset/mine.jpg', icon: '⛏️', effects: ['財宝1枚を廃棄', 'コスト+3以下の財宝を獲得'] },
    { id: 'moat', name: '堀', cost: 2, type: 'reaction', typeLabel: 'アクション', art: 'asset/moat.jpg', icon: '🛡️', effects: ['+2 カード', 'アタックを無効化できる'] },
    { id: 'remodel', name: '改築', cost: 4, type: 'action', typeLabel: 'アクション', art: 'asset/remodel.jpg', icon: '🏗️', effects: ['手札1枚を廃棄', 'コスト+2以下を獲得'] },
    { id: 'smithy', name: '鍛冶屋', cost: 4, type: 'action', typeLabel: 'アクション', art: 'asset/smithy.jpg', icon: '⚒️', effects: ['+3 カード'] },
    { id: 'village', name: '村', cost: 3, type: 'action', typeLabel: 'アクション', art: 'asset/village.jpg', icon: '🏘️', effects: ['+1 カード', '+2 アクション'] },
    { id: 'woodcutter', name: '木こり', cost: 3, type: 'action', typeLabel: 'アクション', art: 'asset/woodcutter.jpg', icon: '🪓', effects: ['+1 購入', '+2 コイン'] },
    { id: 'workshop', name: '工房', cost: 3, type: 'action', typeLabel: 'アクション', art: 'asset/workshop.jpg', icon: '🛠️', effects: ['コスト4以下を1枚獲得'] },
    { id: 'laboratory', name: '研究所', cost: 5, type: 'action', typeLabel: 'アクション', art: 'asset/laboratory.jpg', icon: '⚗️', effects: ['+2 カード', '+1 アクション'] },
    { id: 'festival', name: '祝祭', cost: 5, type: 'action', typeLabel: 'アクション', art: 'asset/festival.jpg', icon: '🎉', effects: ['+2 アクション', '+1 購入', '+2 コイン'] },
    { id: 'moneylender', name: '金貸し', cost: 4, type: 'action', typeLabel: 'アクション', art: 'asset/moneylender.jpg', icon: '💰', effects: ['銅貨1枚を廃棄してよい', '→ +3 コイン'] },
    { id: 'chancellor', name: '宰相', cost: 3, type: 'action', typeLabel: 'アクション', art: 'asset/chancellor.jpg', icon: '📜', effects: ['+2 コイン', '山札を捨て札にしてよい'] },
    { id: 'chapel', name: '礼拝堂', cost: 2, type: 'action', typeLabel: 'アクション', art: 'asset/chapel.jpg', icon: '⛪', effects: ['手札を最大4枚廃棄'] },
    { id: 'gardens', name: '庭園', cost: 4, type: 'victory', typeLabel: '勝利点', art: 'asset/gardens.jpg', icon: '🌷', effects: ['デッキ10枚につき1勝利点'] },
    { id: 'witch', name: '魔女', cost: 5, type: 'attack', typeLabel: 'アクション', art: 'asset/witch.jpg', icon: '🧙', effects: ['+2 カード', '他は呪いを獲得'] },
    { id: 'bureaucrat', name: '役人', cost: 4, type: 'attack', typeLabel: 'アクション', art: 'asset/bureaucrat.jpg', icon: '🧑‍💼', effects: ['銀貨を山札の上に獲得', '他は勝利点を山札の上に'] },
    { id: 'council_room', name: '議事堂', cost: 5, type: 'action', typeLabel: 'アクション', art: 'asset/council_room.jpg', icon: '🏛️', effects: ['+4 カード', '+1 購入', '他は各1枚引く'] },
    { id: 'feast', name: '祝宴', cost: 4, type: 'action', typeLabel: 'アクション', art: 'asset/feast.jpg', icon: '🍖', effects: ['自身を廃棄', 'コスト5以下を1枚獲得'] },
    { id: 'adventurer', name: '冒険者', cost: 6, type: 'action', typeLabel: 'アクション', art: 'asset/adventurer.jpg', icon: '🧭', effects: ['財宝2枚を引くまで公開', '残りは捨てる'] },
    { id: 'library', name: '書庫', cost: 5, type: 'action', typeLabel: 'アクション', art: 'asset/library.jpg', icon: '📚', effects: ['手札7枚まで引く', 'アクションは脇に置ける'] },
    { id: 'spy', name: '密偵', cost: 4, type: 'attack', typeLabel: 'アクション', art: 'asset/spy.jpg', icon: '🔎', effects: ['+1カード +1アクション', '全員の山札の上を捨/戻し選択'] },
    { id: 'thief', name: '泥棒', cost: 4, type: 'attack', typeLabel: 'アクション', art: 'asset/thief.jpg', icon: '🦝', effects: ['他は上2枚公開', '財宝1枚を廃棄→獲得してよい'] },

    // 拡張: 陰謀（Intrigue）。絵は未用意（asset/<id>.jpg を置けば自動表示）。
    { id: 'courtyard', name: '中庭', cost: 2, type: 'action', typeLabel: 'アクション', art: 'asset/courtyard.jpg', icon: '🏛️', effects: ['+3 カード', '手札1枚を山札の上に置く'] },
    { id: 'pawn', name: '従者', cost: 2, type: 'action', typeLabel: 'アクション', art: 'asset/pawn.jpg', icon: '♟️', effects: ['異なる2つを選ぶ', '+1カード/+1アクション/+1購入/+1コイン'] },
    { id: 'shanty_town', name: '寂れた村', cost: 3, type: 'action', typeLabel: 'アクション', art: 'asset/shanty_town.jpg', icon: '🏚️', effects: ['+2 アクション', 'アクションが無ければ+2カード'] },
    { id: 'steward', name: '執事', cost: 3, type: 'action', typeLabel: 'アクション', art: 'asset/steward.jpg', icon: '🤵', effects: ['+2カード / +2コイン / 2枚廃棄'] },
    { id: 'wishing_well', name: '願いの井戸', cost: 3, type: 'action', typeLabel: 'アクション', art: 'asset/wishing_well.jpg', icon: '⛲', effects: ['+1 カード', '+1 アクション', '宣言が当たれば手札に'] },
    { id: 'baron', name: '男爵', cost: 4, type: 'action', typeLabel: 'アクション', art: 'asset/baron.jpg', icon: '🎩', effects: ['+1 購入', '屋敷を捨てて+4コイン'] },
    { id: 'bridge', name: '橋', cost: 4, type: 'action', typeLabel: 'アクション', art: 'asset/bridge.jpg', icon: '🌉', effects: ['+1 購入', '+1 コイン', '全カードのコスト-1'] },
    { id: 'conspirator', name: '共謀者', cost: 4, type: 'action', typeLabel: 'アクション', art: 'asset/conspirator.jpg', icon: '🕵️', effects: ['+2 コイン', 'アクション3回以上で+1カード+1アクション'] },
    { id: 'ironworks', name: '鉄工所', cost: 4, type: 'action', typeLabel: 'アクション', art: 'asset/ironworks.jpg', icon: '🏭', effects: ['コスト4以下を獲得', '種別ボーナス'] },
    { id: 'mining_village', name: '鉱山の村', cost: 4, type: 'action', typeLabel: 'アクション', art: 'asset/mining_village.jpg', icon: '⛏️', effects: ['+1 カード', '+2 アクション', '廃棄した場合+2コイン'] },
    { id: 'torturer', name: '拷問人', cost: 5, type: 'attack', typeLabel: 'アクション', art: 'asset/torturer.jpg', icon: '🗡️', effects: ['+3 カード', '他は2枚捨てるか呪い獲得'] },
    { id: 'duke', name: '公爵', cost: 5, type: 'victory', typeLabel: '勝利点', art: 'asset/duke.jpg', icon: '🤴', effects: ['公領1枚につき1勝利点'] },
    { id: 'nobles', name: '貴族', cost: 6, type: 'action', typeLabel: '勝利点・アクション', art: 'asset/nobles.jpg', icon: '🎖️', effects: ['勝利点 2', '+3カード または +2アクション'] },
    { id: 'harem', name: '後宮', cost: 6, type: 'treasure', typeLabel: '財宝・勝利点', art: 'asset/harem.jpg', icon: '💎', effects: ['コイン +2', '勝利点 2'] },
    { id: 'great_hall', name: '大広間', cost: 3, type: 'action', typeLabel: '勝利点・アクション', art: 'asset/great_hall.jpg', icon: '🏛️', effects: ['+1 カード', '+1 アクション', '勝利点 1'] },
    { id: 'coppersmith', name: '銅細工師', cost: 4, type: 'action', typeLabel: 'アクション', art: 'asset/coppersmith.jpg', icon: '🔨', effects: ['このターン銅貨が+1コイン'] },
    { id: 'trading_post', name: '交易場', cost: 5, type: 'action', typeLabel: 'アクション', art: 'asset/trading_post.jpg', icon: '⚖️', effects: ['手札2枚を廃棄', '→ 銀貨を手札に獲得'] },
    { id: 'upgrade', name: '改良', cost: 5, type: 'action', typeLabel: 'アクション', art: 'asset/upgrade.jpg', icon: '⬆️', effects: ['+1 カード', '+1 アクション', '1枚廃棄→ちょうど+1コストを獲得'] },
    { id: 'scout', name: '斥候', cost: 4, type: 'action', typeLabel: 'アクション', art: 'asset/scout.jpg', icon: '🔭', effects: ['+1 アクション', '上4枚公開→勝利点を手札に', '残りは好きな順で山札の上'] },
    { id: 'tribute', name: '貢物', cost: 5, type: 'action', typeLabel: 'アクション', art: 'asset/tribute.jpg', icon: '🎁', effects: ['左隣が上2枚公開→捨てる', '異なる名前ごとに種別ボーナス'] },
    { id: 'swindler', name: '詐欺師', cost: 5, type: 'attack', typeLabel: 'アクション', art: 'asset/swindler.jpg', icon: '🎭', effects: ['+2 コイン', '他は山札の上を廃棄', '→ あなたが選んだ同コストを獲得'] },
    { id: 'saboteur', name: '破壊工作員', cost: 5, type: 'attack', typeLabel: 'アクション', art: 'asset/saboteur.jpg', icon: '💣', effects: ['他はコスト3以上を廃棄', '→ 2安いカードを獲得してよい'] },
    { id: 'minion', name: '手先', cost: 5, type: 'attack', typeLabel: 'アクション', art: 'asset/minion.jpg', icon: '🕴️', effects: ['+1 アクション', '+2コイン か 全員引き直し を選ぶ'] },
    { id: 'masquerade', name: '仮面舞踏会', cost: 3, type: 'action', typeLabel: 'アクション', art: 'asset/masquerade.jpg', icon: '🎭', effects: ['+2 カード', '全員が左隣へ1枚渡す', 'その後1枚廃棄してよい'] },
    { id: 'secret_chamber', name: '秘密の小部屋', cost: 2, type: 'reaction', typeLabel: 'アクション・リアクション', art: 'asset/secret_chamber.jpg', icon: '🔮', effects: ['捨てた枚数だけ +1コイン', '(リアクション)アタック時に+2引き2枚戻す'] },
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
