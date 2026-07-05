/* ============================================================
   js/carddata.js — 表示用カードデータ（カードプレビュー cards.html 用）
   ------------------------------------------------------------
   ★単一ソース★ ルール定義 js/cards.js の DOM.CARDS が正本。
   ここは「表示専用の情報（アイコン・効果の短い箇条書き）」だけを持ち、
   名前・コスト・種別ラベル・枠色・画像パスは DOM.CARDS から自動導出する。
   → 名前/コスト等が二か所でズレる事故（例: 詐欺師のコスト）が原理的に起きない。
   ※ cards.js を先に読み込むこと（cards.html はそうしている）。
   ※ 新カードは js/cards.js に書けば、ここに何も足さなくても種別アイコン＋text から
     自動表示される。下の DISPLAY にアイコン/効果を足すのは“見栄えの任意上乗せ”。
   ============================================================ */
(function () {
  const root = (typeof window !== 'undefined') ? window
    : (typeof global !== 'undefined') ? global : globalThis;
  const DOM = (root.DOM = root.DOM || {});

  // 表示専用データ（アイコン＋効果の短い箇条書き）。ルール情報は一切持たない。
  const DISPLAY = {
    "copper": { icon: "🥉", effects: ["+1 コイン"] },
    "silver": { icon: "🥈", effects: ["+2 コイン"] },
    "gold": { icon: "🥇", effects: ["+3 コイン"] },
    "estate": { icon: "🏡", effects: ["勝利点 1"] },
    "duchy": { icon: "🏰", effects: ["勝利点 3"] },
    "province": { icon: "👑", effects: ["勝利点 6"] },
    "curse": { icon: "☠️", effects: ["勝利点 −1"] },
    "cellar": { icon: "🛢️", effects: ["+1 アクション", "手札を捨て、同じ数引く"] },
    "market": { icon: "🛒", effects: ["+1 カード", "+1 アクション", "+1 購入", "+1 コイン"] },
    "militia": { icon: "⚔️", effects: ["+2 コイン", "他は手札3枚まで捨てる"] },
    "mine": { icon: "⛏️", effects: ["財宝1枚を廃棄してよい", "廃棄した財宝のコスト+3以下を獲得"] },
    "moat": { icon: "🛡️", effects: ["+2 カード", "アタックを無効化できる"] },
    "remodel": { icon: "🏗️", effects: ["手札1枚を廃棄", "廃棄したカードのコスト+2以下を獲得"] },
    "smithy": { icon: "⚒️", effects: ["+3 カード"] },
    "village": { icon: "🏘️", effects: ["+1 カード", "+2 アクション"] },
    "woodcutter": { icon: "🪓", effects: ["+1 購入", "+2 コイン"] },
    "workshop": { icon: "🛠️", effects: ["コスト4以下を1枚獲得"] },
    "laboratory": { icon: "⚗️", effects: ["+2 カード", "+1 アクション"] },
    "festival": { icon: "🎉", effects: ["+2 アクション", "+1 購入", "+2 コイン"] },
    "moneylender": { icon: "💰", effects: ["銅貨1枚を廃棄してよい", "→ +3 コイン"] },
    "chancellor": { icon: "📜", effects: ["+2 コイン", "山札を捨て札にしてもよい"] },
    "chapel": { icon: "⛪", effects: ["手札を最大4枚廃棄"] },
    "gardens": { icon: "🌷", effects: ["デッキ10枚につき1勝利点"] },
    "witch": { icon: "🧙", effects: ["+2 カード", "他は呪いを獲得"] },
    "bureaucrat": { icon: "🧑‍💼", effects: ["銀貨を山札の上に獲得", "他は勝利点を山札の上に"] },
    "council_room": { icon: "🏛️", effects: ["+4 カード", "+1 購入", "他は各1枚引く"] },
    "feast": { icon: "🍖", effects: ["自身を廃棄", "コスト5以下を1枚獲得"] },
    "adventurer": { icon: "🧭", effects: ["財宝が2枚出るまで公開", "残りは捨てる"] },
    "library": { icon: "📚", effects: ["手札7枚まで引く", "アクションは脇に置ける"] },
    "spy": { icon: "🔎", effects: ["+1カード +1アクション", "全員の山札の上を捨/戻し選択"] },
    "thief": { icon: "🦝", effects: ["他は上2枚公開", "財宝1枚を廃棄→獲得してよい"] },
    "throne_room": { icon: "👑", effects: ["アクション1枚を2回使う"] },
    "courtyard": { icon: "🏛️", effects: ["+3 カード", "手札1枚を山札の上に置く"] },
    "pawn": { icon: "♟️", effects: ["異なる2つを選ぶ", "+1カード/+1アクション/+1購入/+1コイン"] },
    "shanty_town": { icon: "🏚️", effects: ["+2 アクション", "アクションが無ければ+2カード"] },
    "steward": { icon: "🤵", effects: ["+2カード / +2コイン / 2枚廃棄"] },
    "wishing_well": { icon: "⛲", effects: ["+1 カード", "+1 アクション", "宣言が当たれば手札に"] },
    "baron": { icon: "🎩", effects: ["+1 購入", "屋敷を捨てれば+4コイン", "捨てなければ屋敷を獲得"] },
    "bridge": { icon: "🌉", effects: ["+1 購入", "+1 コイン", "全カードのコスト-1"] },
    "conspirator": { icon: "🕵️", effects: ["+2 コイン", "アクション3回以上で+1カード+1アクション"] },
    "ironworks": { icon: "🏭", effects: ["コスト4以下を獲得", "種別ボーナス"] },
    "mining_village": { icon: "⛏️", effects: ["+1 カード", "+2 アクション", "廃棄した場合+2コイン"] },
    "torturer": { icon: "🗡️", effects: ["+3 カード", "他は2枚捨てるか呪い獲得"] },
    "duke": { icon: "🤴", effects: ["公領1枚につき1勝利点"] },
    "nobles": { icon: "🎖️", effects: ["勝利点 2", "+3カード または +2アクション"] },
    "harem": { icon: "💎", effects: ["コイン +2", "勝利点 2"] },
    "great_hall": { icon: "🏛️", effects: ["+1 カード", "+1 アクション", "勝利点 1"] },
    "coppersmith": { icon: "🔨", effects: ["このターン 銅貨の価値が+1コイン"] },
    "trading_post": { icon: "⚖️", effects: ["手札2枚を廃棄", "→ 銀貨を手札に獲得"] },
    "upgrade": { icon: "⬆️", effects: ["+1 カード", "+1 アクション", "1枚廃棄→ちょうど+1コストを獲得"] },
    "scout": { icon: "🔭", effects: ["+1 アクション", "上4枚公開→勝利点を手札に", "残りは好きな順で山札の上"] },
    "tribute": { icon: "🎁", effects: ["左隣が上2枚公開→捨てる", "異なる名前ごとに種別ボーナス"] },
    "swindler": { icon: "🎭", effects: ["+2 コイン", "他は山札の上を廃棄", "→ 廃棄と同コストをあなたが選んで与える"] },
    "saboteur": { icon: "💣", effects: ["他はコスト3以上を廃棄", "→ 2安いカードを獲得してよい"] },
    "minion": { icon: "🕴️", effects: ["+1 アクション", "+2コイン か 全員引き直し を選ぶ"] },
    "masquerade": { icon: "🎭", effects: ["+2 カード", "全員が左隣へ1枚渡す", "その後1枚廃棄してよい"] },
    "secret_chamber": { icon: "🔮", effects: ["捨てた1枚につき +1コイン", "(リアクション)アタック時に+2引き2枚戻す"] },
    "harbinger": { icon: "📯", effects: ["+1 カード", "+1 アクション", "捨て札1枚を山札の上に置いてよい"] },
    "merchant": { icon: "💱", effects: ["+1 カード", "+1 アクション", "最初の銀貨で +1 コイン"] },
    "vassal": { icon: "🧎", effects: ["+2 コイン", "山札の上を捨て、アクションなら使ってよい"] },
    "poacher": { icon: "🏹", effects: ["+1 カード", "+1 アクション", "+1 コイン", "空の山1つにつき手札1枚捨てる"] },
    "bandit": { icon: "🥷", effects: ["金貨を獲得", "他は上2枚公開→銅貨以外の財宝1枚を廃棄"] },
    "sentry": { icon: "💂", effects: ["+1 カード", "+1 アクション", "上2枚を廃棄/捨て/戻す"] },
    "artisan": { icon: "🎨", effects: ["コスト5以下を手札に獲得", "手札1枚を山札の上に置く"] },
    "courtier": { icon: "🥂", effects: ["手札1枚を公開", "種類数だけ：+1アクション/+1購入/+3コイン/金貨"] },
    "diplomat": { icon: "🤝", effects: ["+2 カード", "手札5枚以下なら +2 アクション", "(リアクション)アタック時に+2引き3枚捨てる"] },
    "lurker": { icon: "🕳️", effects: ["+1 アクション", "サプライのアクションを廃棄", "or 廃棄置場からアクションを獲得"] },
    "mill": { icon: "🌾", effects: ["+1 カード", "+1 アクション", "手札2枚を捨てれば +2コイン", "勝利点 1"] },
    "patrol": { icon: "🔦", effects: ["+3 カード", "上4枚公開→勝利点と呪いを手札に", "残りは好きな順で山札の上"] },
    "replace": { icon: "🔄", effects: ["手札1枚を廃棄→$2高いまでを獲得", "アクション/財宝は山札の上", "勝利点なら他全員が呪い獲得"] },
    "secret_passage": { icon: "🚪", effects: ["+2 カード", "+1 アクション", "手札1枚を山札の好きな位置に入れる"] },
    "walled_village": { icon: "🧱", effects: ["+1 カード", "+2 アクション", "場のアクションが2枚以下なら山札の上に戻せる"] },
    "envoy": { icon: "✉️", effects: ["上5枚公開→左隣が1枚捨てさせる", "残りを手札に"] },
    "governor": { icon: "👨‍⚖️", effects: ["+1 アクション", "全員に効果（自分は強い方）", "+3カード/金貨/改築 を選ぶ"] },
    "dismantle": { icon: "🪚", effects: ["手札1枚を廃棄", "それより安いカードと金貨を獲得"] },
    "black_market": { icon: "🏴", effects: ["+2 コイン", "闇市場デッキ上3枚から1枚を購入してよい"] },
    "hoard": { icon: "🤑", effects: ["コイン +2", "勝利点を獲得したとき金貨を獲得"] },
  };

  // 表示枠の色キー（持続を最優先＝本家ドミニオン同様オレンジ。次いで attack/reaction を優先。
  // 勝利点・アクション等の複合も1つに決める）
  function frameType(types) {
    if (types.includes('duration')) return 'duration'; // 海辺：持続はオレンジ（最優先）
    if (types.includes('attack')) return 'attack';
    if (types.includes('reaction')) return 'reaction';
    if (types.includes('treasure')) return 'treasure';
    if (types.includes('action')) return 'action';
    if (types.includes('victory')) return 'victory';
    if (types.includes('curse')) return 'curse';
    return 'action';
  }
  // 種別ラベル（日本語）
  function typeLabel(types) {
    const has = (t) => types.includes(t);
    // 海辺：持続の複合（本家の表記順に合わせる）
    if (has('duration')) {
      if (has('treasure') && has('reaction')) return '財宝・持続・リアクション'; // 海賊
      if (has('command')) return 'アクション・持続・命令';                       // プロモ：王子/船長
      if (has('attack')) return 'アクション・持続・アタック';                    // 封鎖/私掠船/海の魔女
      if (has('reaction')) return 'アクション・持続・リアクション';              // 冒険：隊商の護衛
      if (has('treasure')) return '財宝・持続';                                  // アストロラーベ
      return 'アクション・持続';
    }
    // 暗黒時代：騎士・廃墟・避難所（新種別。複合語を先に決めて全typeを落とさない）
    if (has('knight')) return has('victory') ? 'アクション・アタック・騎士・勝利点' : 'アクション・アタック・騎士';
    if (has('ruins')) return 'アクション・廃墟';
    if (has('shelter')) {
      if (has('victory')) return '勝利点・避難所';
      if (has('reaction')) return 'リアクション・避難所';
      return 'アクション・避難所';
    }
    // 冒険：トラベラー・リザーブ／帝国：命令・城（複合語を先に決めて全typeを落とさない）
    if (has('traveller')) return has('attack') ? 'アクション・アタック・トラベラー' : 'アクション・トラベラー';
    if (has('reserve')) {
      if (has('treasure')) return '財宝・リザーブ';           // 法貨
      if (has('victory')) return 'アクション・リザーブ・勝利点'; // 遠隔地
      return 'アクション・リザーブ';
    }
    if (has('command')) return 'アクション・命令';            // 大君主
    if (has('castle')) {
      if (has('treasure')) return '財宝・勝利点・城';         // 粗末な城
      if (has('action')) return 'アクション・勝利点・城';     // 小さい城/華やかな城
      return '勝利点・城';
    }
    if (has('treasure') && has('victory')) return '財宝・勝利点';
    if (has('victory') && has('action')) return '勝利点・アクション';
    if (has('treasure') && has('action')) return 'アクション・財宝';                   // 帝国：冠（action+treasure）
    if (has('attack') && has('reaction')) return 'アクション・アタック・リアクション'; // 会計士（action+attack+reaction）
    if (has('treasure') && has('attack')) return '財宝・アタック';                    // ペテン師（treasure+attack）
    if (has('treasure') && has('reaction')) return '財宝・リアクション';              // 愚者の黄金（treasure+reaction）
    if (has('victory') && has('reaction')) return '勝利点・リアクション';             // 抜け道（victory+reaction）
    if (has('reaction')) return 'アクション・リアクション';
    if (has('attack')) return 'アクション・アタック';
    if (has('treasure')) return '財宝';
    if (has('victory')) return '勝利点';
    if (has('curse')) return '呪い';
    return 'アクション';
  }
  // 種別ラベル（英語。プレートに日英併記する＝基準カードと同じ体裁）
  function typeLabelEn(types) {
    const has = (t) => types.includes(t);
    if (has('duration')) {
      if (has('treasure') && has('reaction')) return 'Treasure - Duration - Reaction'; // Pirate
      if (has('command')) return 'Action - Duration - Command';                        // Prince/Captain
      if (has('attack')) return 'Action - Duration - Attack';                          // Blockade/Corsair/Sea Witch
      if (has('reaction')) return 'Action - Duration - Reaction';                      // Caravan Guard
      if (has('treasure')) return 'Treasure - Duration';                               // Astrolabe
      return 'Action - Duration';
    }
    if (has('knight')) return has('victory') ? 'Action - Attack - Knight - Victory' : 'Action - Attack - Knight';
    if (has('ruins')) return 'Action - Ruins';
    if (has('shelter')) {
      if (has('victory')) return 'Victory - Shelter';
      if (has('reaction')) return 'Reaction - Shelter';
      return 'Action - Shelter';
    }
    if (has('traveller')) return has('attack') ? 'Action - Attack - Traveller' : 'Action - Traveller';
    if (has('reserve')) {
      if (has('treasure')) return 'Treasure - Reserve';
      if (has('victory')) return 'Action - Reserve - Victory';
      return 'Action - Reserve';
    }
    if (has('command')) return 'Action - Command';
    if (has('castle')) {
      if (has('treasure')) return 'Treasure - Victory - Castle';
      if (has('action')) return 'Action - Victory - Castle';
      return 'Victory - Castle';
    }
    if (has('treasure') && has('victory')) return 'Treasure - Victory';
    if (has('victory') && has('action')) return 'Victory - Action';
    if (has('treasure') && has('action')) return 'Action - Treasure'; // Crown
    if (has('attack') && has('reaction')) return 'Action - Attack - Reaction'; // 会計士
    if (has('treasure') && has('attack')) return 'Treasure - Attack';          // ペテン師
    if (has('treasure') && has('reaction')) return 'Treasure - Reaction';      // Fool's Gold
    if (has('victory') && has('reaction')) return 'Victory - Reaction';        // Tunnel
    if (has('reaction')) return 'Action - Reaction';
    if (has('attack')) return 'Action - Attack';
    if (has('treasure')) return 'Treasure';
    if (has('victory')) return 'Victory';
    if (has('curse')) return 'Curse';
    return 'Action';
  }
  // DISPLAY にアイコンが無い新カード用の既定アイコン（種別で代替）
  const TYPE_ICON = { treasure: '🪙', victory: '🏅', curse: '☠️', reaction: '🛡️', attack: '⚔️', duration: '⏳', action: '🃏' };

  // 正本 DOM.CARDS から表示用1件を組み立てる
  function buildDisplay(id) {
    const c = (DOM.CARDS || {})[id];
    if (!c) return null;
    const ex = DISPLAY[id] || {};
    const frame = frameType(c.types);
    return {
      id: id,
      name: c.name,
      cost: c.cost,
      potion: c.potion || 0, // 錬金術：ポーション費用（コストバッジに紫フラスコで表示）
      debt: c.debt || 0, // 帝国：負債コスト（コストバッジにオレンジの六角トークンで表示）
      type: frame,
      types: c.types.slice(),
      typeLabel: typeLabel(c.types),
      typeLabelEn: typeLabelEn(c.types),
      // 合成カード（cardview.js）が中央にはめ込む“絵だけ”の正方形画像。
      // ユーザーが生成AIで作って asset/art/<id>.png に置く。未配置なら絵文字＋名前に段階フォールバック。
      artSquare: 'asset/art/' + id + '.png',
      // 旧・完成画像（枠/文字まで焼き込み済み）。拡大表示など別系統が参照。
      art: 'asset/' + id + '.jpg',
      icon: ex.icon || TYPE_ICON[frame] || '🃏',
      effects: ex.effects || (c.text ? String(c.text).split('\n') : []),
    };
  }

  function rebuild() {
    const ids = DOM.CARDS ? Object.keys(DOM.CARDS) : [];
    const list = ids.map(buildDisplay).filter(Boolean);
    DOM.CARD_DATA_LIST = list;
    const map = {}; list.forEach((d) => { map[d.id] = d; });
    DOM.CARD_DATA = map;
    return DOM.CARD_DATA;
  }

  rebuild();

  // 後方互換 API。以前は data/cards.json を fetch していたが、いまは DOM.CARDS が正本なので
  // 取得は不要（導出済みデータをそのまま返す）。cards.html はこれを呼ぶ。
  DOM.loadCards = function () { return Promise.resolve(rebuild()); };
})();
