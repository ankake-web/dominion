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
    "copper": { icon: "🥉" },
    "silver": { icon: "🥈" },
    "gold": { icon: "🥇" },
    "estate": { icon: "🏡" },
    "duchy": { icon: "🏰" },
    "province": { icon: "👑" },
    "curse": { icon: "☠️" },
    "cellar": { icon: "🛢️" },
    "market": { icon: "🛒" },
    "militia": { icon: "⚔️" },
    "mine": { icon: "⛏️" },
    "moat": { icon: "🛡️" },
    "remodel": { icon: "🏗️" },
    "smithy": { icon: "⚒️" },
    "village": { icon: "🏘️" },
    "woodcutter": { icon: "🪓" },
    "workshop": { icon: "🛠️" },
    "laboratory": { icon: "⚗️" },
    "festival": { icon: "🎉" },
    "moneylender": { icon: "💰" },
    "chancellor": { icon: "📜" },
    "chapel": { icon: "⛪" },
    "gardens": { icon: "🌷" },
    "witch": { icon: "🧙" },
    "bureaucrat": { icon: "🧑‍💼" },
    "council_room": { icon: "🏛️" },
    "feast": { icon: "🍖" },
    "adventurer": { icon: "🧭" },
    "library": { icon: "📚" },
    "spy": { icon: "🔎" },
    "thief": { icon: "🦝" },
    "throne_room": { icon: "👑" },
    "courtyard": { icon: "🏛️" },
    "pawn": { icon: "♟️" },
    "shanty_town": { icon: "🏚️" },
    "steward": { icon: "🤵" },
    "wishing_well": { icon: "⛲" },
    "baron": { icon: "🎩" },
    "bridge": { icon: "🌉" },
    "conspirator": { icon: "🕵️" },
    "ironworks": { icon: "🏭" },
    "mining_village": { icon: "⛏️" },
    "torturer": { icon: "🗡️" },
    "duke": { icon: "🤴" },
    "nobles": { icon: "🎖️" },
    "harem": { icon: "💎" },
    "great_hall": { icon: "🏛️" },
    "coppersmith": { icon: "🔨" },
    "trading_post": { icon: "⚖️" },
    "upgrade": { icon: "⬆️" },
    "scout": { icon: "🔭" },
    "tribute": { icon: "🎁" },
    "swindler": { icon: "🎭" },
    "saboteur": { icon: "💣" },
    "minion": { icon: "🕴️" },
    // ⚠ 渡す先は「左隣の**手札のある**プレイヤー」（公式FAQ＝手札0枚の人は渡しも受け取りもしない）。
    "masquerade": { icon: "🎭" },
    "secret_chamber": { icon: "🔮" },
    "harbinger": { icon: "📯" },
    "merchant": { icon: "💱" },
    "vassal": { icon: "🧎" },
    "poacher": { icon: "🏹" },
    "bandit": { icon: "🥷" },
    "sentry": { icon: "💂" },
    "artisan": { icon: "🎨" },
    "courtier": { icon: "🥂" },
    "diplomat": { icon: "🤝" },
    "lurker": { icon: "🕳️" },
    "mill": { icon: "🌾" },
    "patrol": { icon: "🔦" },
    "replace": { icon: "🔄" },
    "secret_passage": { icon: "🚪" },
    "walled_village": { icon: "🧱" },
    "envoy": { icon: "✉️" },
    "governor": { icon: "👨‍⚖️" },
    "dismantle": { icon: "🪚" },
    "black_market": { icon: "🏴" },
    "hoard": { icon: "🤑" },
  };

  // 表示枠の色キー（持続を最優先＝本家ドミニオン同様オレンジ。次いで attack/reaction を優先。
  // 勝利点・アクション等の複合も1つに決める）
  function frameType(types) {
    if (types.includes('night')) return 'night';       // 夜想曲：夜行は黒（持続より優先＝本家も夜行カードは黒地）
    if (types.includes('duration')) return 'duration'; // 海辺：持続はオレンジ
    if (types.includes('attack')) return 'attack';
    if (types.includes('reaction')) return 'reaction';
    if (types.includes('treasure')) return 'treasure';
    if (types.includes('action')) return 'action';
    if (types.includes('victory')) return 'victory';
    if (types.includes('curse')) return 'curse';
    return 'action';
  }
  // 同盟（Allies）の新種別＝連携(Liaison)＋分割山6組の専用種別（町民/卜占官/衝突/城砦/叙事詩/魔法使い）。
  //   これらを持つカードは「types 配列の順にラベルを連ねる」汎用規則で表記する（本家の印刷順＝カタログの types 順）。
  //   公式訳の出典＝日本語wiki（ホビージャパン印刷版）。docs/research/allies_rules.md §g11。
  //   略奪(Plunder)の 戦利品(loot) も同じ汎用規則に乗せる（財宝・戦利品／財宝・持続・戦利品 のように types 順で連ねる）。
  //   旭日(Rising Sun)の 前兆(omen)／影(shadow) も同じ規則（アクション・前兆／アクション・アタック・影 など）。
  const ALLIES_TYPE_JP = { liaison: '連携', townsfolk: '町民', augur: '卜占官', clash: '衝突', fort: '城砦', odyssey: '叙事詩', wizard: '魔法使い', loot: '戦利品', omen: '前兆', shadow: '影', reward: '褒賞' }; // 収穫祭＆ギルド第2版：褒賞(Reward)＝一騎討ちでのみ獲得する非サプライ6種
  const ALLIES_TYPE_EN = { liaison: 'Liaison', townsfolk: 'Townsfolk', augur: 'Augur', clash: 'Clash', fort: 'Fort', odyssey: 'Odyssey', wizard: 'Wizard', loot: 'Loot', omen: 'Omen', shadow: 'Shadow', reward: 'Reward' };
  const BASE_TYPE_JP = { action: 'アクション', treasure: '財宝', victory: '勝利点', curse: '呪い', attack: 'アタック', reaction: 'リアクション', duration: '持続' };
  const BASE_TYPE_EN = { action: 'Action', treasure: 'Treasure', victory: 'Victory', curse: 'Curse', attack: 'Attack', reaction: 'Reaction', duration: 'Duration' };
  // 種別ラベル（日本語）
  function typeLabel(types) {
    const has = (t) => types.includes(t);
    // 夜想曲：夜行（Night）の複合は持続より先に決める（夜行＋持続があるため）
    if (has('night')) {
      if (has('action') && has('attack') && has('doom')) return 'アクション・夜行・アタック・不運'; // 人狼
      if (has('attack') && has('doom')) return '夜行・アタック・不運';                              // 吸血鬼
      if (has('duration') && has('attack')) return '夜行・持続・アタック';                          // 夜襲
      if (has('duration') && has('spirit')) return '夜行・持続・精霊';                              // 幽霊
      if (has('duration')) return '夜行・持続';           // カブラー/納骨堂/悪人のアジト/ゴーストタウン/守護者
      return '夜行';                                      // 取り替え子/悪魔の工房/悪魔祓い/修道院/夜警/コウモリ
    }
    // 夜想曲：家宝／精霊／ゾンビ／幸運／不運（いずれも夜行ではない側）
    if (has('heirloom')) return has('victory') ? '財宝・勝利点・家宝' : '財宝・家宝'; // 牧草地 / 他6種
    if (has('spirit')) return 'アクション・精霊';                                     // ウィル・オ・ウィスプ/インプ
    if (has('zombie')) return 'アクション・ゾンビ';
    if (has('fate')) {
      if (has('treasure')) return has('attack') ? '財宝・アタック・幸運' : '財宝・幸運'; // 偶像
      return 'アクション・幸運';                                                         // 詩人/恵みの村/ドルイド/愚者/ピクシー/聖なる木立ち/追跡者
    }
    if (has('doom')) return has('attack') ? 'アクション・アタック・不運' : 'アクション・不運'; // 暗躍者・迫害者 / 呪われた村・レプラコーン
    // 同盟：連携(Liaison)と分割山6種の専用種別。持続との複合が多い（輸入者/契約書/駐屯地/航海/将軍/要塞/霊術師）ので
    //   duration 判定より前に決める（夜行/幸運/不運と同じ位置）。**types 配列の順＝本家の印刷順**をそのまま並べる。
    if (types.some((t) => ALLIES_TYPE_JP[t])) return types.map((t) => ALLIES_TYPE_JP[t] || BASE_TYPE_JP[t] || t).join('・');
    // 海辺：持続の複合（本家の表記順に合わせる）
    if (has('duration')) {
      if (has('treasure') && has('reaction')) return '財宝・持続・リアクション'; // 海賊
      if (has('command')) return 'アクション・持続・命令';                       // プロモ：王子/船長
      if (has('attack')) return 'アクション・持続・アタック';                    // 封鎖/コルセア/海の魔女
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
    if (has('looter')) return has('attack') ? 'アクション・アタック・略奪者' : 'アクション・略奪者'; // 暗黒時代：略奪者/狂信者/死の荷車
    // 冒険：トラベラー・リザーブ／帝国：命令・城（複合語を先に決めて全typeを落とさない）
    if (has('traveller')) return has('attack') ? 'アクション・アタック・トラベラー' : 'アクション・トラベラー';
    if (has('reserve')) {
      if (has('treasure')) return '財宝・リザーブ';           // 法貨
      if (has('victory')) return 'アクション・リザーブ・勝利点'; // 遠隔地
      return 'アクション・リザーブ';
    }
    if (has('command')) {
      if (has('treasure')) return '財宝・命令';               // ルネサンス：王笏（2024エラッタで Command 追加）
      return 'アクション・命令';                              // 大君主
    }
    if (has('castle')) {
      if (has('treasure')) return '財宝・勝利点・城';         // 粗末な城
      if (has('action')) return 'アクション・勝利点・城';     // 小さい城/華やかな城
      return '勝利点・城';
    }
    if (has('treasure') && has('victory')) return '財宝・勝利点';
    if (has('victory') && has('action')) return '勝利点・アクション';
    if (has('treasure') && has('action')) return 'アクション・財宝';                   // 帝国：冠（action+treasure）
    if (has('attack') && has('reaction')) return 'アクション・アタック・リアクション'; // 書記（action+attack+reaction）
    if (has('treasure') && has('attack')) return '財宝・アタック';                    // 山師（treasure+attack）
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
    if (has('night')) {
      if (has('action') && has('attack') && has('doom')) return 'Action - Night - Attack - Doom'; // Werewolf
      if (has('attack') && has('doom')) return 'Night - Attack - Doom';                           // Vampire
      if (has('duration') && has('attack')) return 'Night - Duration - Attack';                   // Raider
      if (has('duration') && has('spirit')) return 'Night - Duration - Spirit';                   // Ghost
      if (has('duration')) return 'Night - Duration';
      return 'Night';
    }
    if (has('heirloom')) return has('victory') ? 'Treasure - Victory - Heirloom' : 'Treasure - Heirloom';
    if (has('spirit')) return 'Action - Spirit';
    if (has('zombie')) return 'Action - Zombie';
    if (has('fate')) {
      if (has('treasure')) return has('attack') ? 'Treasure - Attack - Fate' : 'Treasure - Fate';
      return 'Action - Fate';
    }
    if (has('doom')) return has('attack') ? 'Action - Attack - Doom' : 'Action - Doom';
    // 同盟：連携＋分割山6種（日本語側と同じ規則＝types 配列の順に連ねる）
    if (types.some((t) => ALLIES_TYPE_EN[t])) return types.map((t) => ALLIES_TYPE_EN[t] || BASE_TYPE_EN[t] || t).join(' - ');
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
    if (has('looter')) return has('attack') ? 'Action - Attack - Looter' : 'Action - Looter';
    if (has('traveller')) return has('attack') ? 'Action - Attack - Traveller' : 'Action - Traveller';
    if (has('reserve')) {
      if (has('treasure')) return 'Treasure - Reserve';
      if (has('victory')) return 'Action - Reserve - Victory';
      return 'Action - Reserve';
    }
    if (has('command')) {
      if (has('treasure')) return 'Treasure - Command';   // Scepter
      return 'Action - Command';
    }
    if (has('castle')) {
      if (has('treasure')) return 'Treasure - Victory - Castle';
      if (has('action')) return 'Action - Victory - Castle';
      return 'Victory - Castle';
    }
    if (has('treasure') && has('victory')) return 'Treasure - Victory';
    if (has('victory') && has('action')) return 'Victory - Action';
    if (has('treasure') && has('action')) return 'Action - Treasure'; // Crown
    if (has('attack') && has('reaction')) return 'Action - Attack - Reaction'; // 書記
    if (has('treasure') && has('attack')) return 'Treasure - Attack';          // 山師
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
