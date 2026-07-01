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
    // 繁栄：基本サプライに加わる高額財宝・高額勝利点（繁栄が場にあるときだけ供給される）
    platinum:  { id: 'platinum',  name: 'プラチナ貨', cost: 9, types: ['treasure'],            coin: 5,
                 text: 'コイン +5' },
    colony:    { id: 'colony',    name: '植民地',     cost: 11, types: ['victory'],            vp: 10,
                 text: '勝利点 10' },

    // 王国カード（初回おすすめセット）
    cellar:    { id: 'cellar',    name: '地下貯蔵庫', cost: 2, types: ['action'],
                 text: '+1 アクション\n手札を好きな枚数捨て、同じ枚数引く。' },
    market:    { id: 'market',    name: '市場',       cost: 5, types: ['action'],
                 text: '+1 カード\n+1 アクション\n+1 購入\n+1 コイン' },
    militia:   { id: 'militia',   name: '民兵',       cost: 4, types: ['action', 'attack'],
                 text: '+2 コイン\n他のプレイヤーは手札が3枚になるまで捨てる。' },
    mine:      { id: 'mine',      name: '鉱山',       cost: 5, types: ['action'],
                 text: '手札の財宝1枚を廃棄してよい。\n廃棄した財宝のコスト +3 以下の財宝を手札に獲得する。' },
    moat:      { id: 'moat',      name: '堀',         cost: 2, types: ['action', 'reaction'],
                 text: '+2 カード\n（リアクション）他人のアタックを受けたとき、\nこれを公開して無効化できる。' },
    remodel:   { id: 'remodel',   name: '改築',       cost: 4, types: ['action'],
                 text: '手札1枚を廃棄し、\n廃棄したカードのコスト +2 以下のカードを獲得する。' },
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
                 text: '手札の銅貨1枚を廃棄してよい。\nその場合 +3 コイン。' },
    chancellor:{ id: 'chancellor', name: '宰相',     cost: 3, types: ['action'],
                 text: '+2 コイン\n自分の山札をすべて捨て札にしてもよい。' },
    chapel:    { id: 'chapel',     name: '礼拝堂',     cost: 2, types: ['action'],
                 text: '手札を最大4枚まで廃棄する。' },
    gardens:   { id: 'gardens',    name: '庭園',       cost: 4, types: ['victory'],
                 text: '（勝利点）\nデッキ10枚につき 1 勝利点（端数切り捨て）。' },
    witch:     { id: 'witch',      name: '魔女',       cost: 5, types: ['action', 'attack'],
                 text: '+2 カード\n他のプレイヤーは各自、呪い1枚を獲得する。' },
    bureaucrat:{ id: 'bureaucrat', name: '役人',       cost: 4, types: ['action', 'attack'],
                 text: '銀貨1枚を獲得し、山札の上に置く。\n他のプレイヤーは各自、手札の勝利点1枚を\n山札の上に置く（無ければ手札を公開）。' },
    council_room:{ id: 'council_room', name: '議会', cost: 5, types: ['action'],
                 text: '+4 カード\n+1 購入\n他のプレイヤーは各自、1枚引く。' },
    feast:     { id: 'feast',      name: '祝宴',       cost: 4, types: ['action'],
                 text: 'このカードを廃棄する。\nコスト5以下のカードを1枚獲得する。' },
    adventurer:{ id: 'adventurer', name: '冒険者',     cost: 6, types: ['action'],
                 text: '財宝が2枚出るまで山札の上を公開する。\nその2枚を手札に加え、残りは捨てる。' },
    library:   { id: 'library',    name: '書庫',       cost: 5, types: ['action'],
                 text: '手札が7枚になるまで引く。\n引いたアクションは脇に置いてもよい\n（脇に置いたものは最後に捨てる）。' },
    spy:       { id: 'spy',        name: '密偵',       cost: 4, types: ['action', 'attack'],
                 text: '+1 カード\n+1 アクション\n全員が山札の上を公開。各自について、\nあなたが捨てるか戻すかを決める。' },
    thief:     { id: 'thief',      name: '泥棒',       cost: 4, types: ['action', 'attack'],
                 text: '他のプレイヤーは山札の上2枚を公開する。\nその中の財宝1枚をあなたが選んで廃棄し、\nそれを獲得してもよい。残りは捨てる。' },
    throne_room:{ id: 'throne_room', name: '玉座の間', cost: 4, types: ['action'],
                 text: '手札のアクションカードを1枚選び、\nそれを2回使う。' },

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
                     text: '+1 カード\n+1 アクション\nカード名を1つ宣言し、山札の一番上を公開。\n当たれば手札に加える。' },
    baron:         { id: 'baron',         name: '男爵',       cost: 4, types: ['action'],
                     text: '+1 購入\n屋敷1枚を捨ててもよい。捨てたら +4 コイン。\n捨てなければ屋敷1枚を獲得する。' },
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
                     text: 'このターン中、銅貨の価値は +1 コイン。\n（銅貨が $1 → $2 になる）' },
    trading_post:  { id: 'trading_post',  name: '交易場',     cost: 5, types: ['action'],
                     text: '手札を2枚廃棄し、銀貨1枚を手札に獲得する。' },
    upgrade:       { id: 'upgrade',       name: '改良',       cost: 5, types: ['action'],
                     text: '+1 カード\n+1 アクション\n手札を1枚廃棄する。\nそれよりちょうど1コイン高いカードを1枚獲得する。' },
    scout:         { id: 'scout',         name: '斥候',       cost: 4, types: ['action'],
                     text: '+1 アクション\n山札の上4枚を公開する。\n勝利点は手札に加え、\n残りを好きな順で山札の上に戻す。' },
    tribute:       { id: 'tribute',       name: '貢物',       cost: 5, types: ['action'],
                     text: '左隣のプレイヤーは山札の上2枚を公開して捨てる。\n公開された異なる名前ごとに：\nアクション＝+2アクション／財宝＝+2コイン／勝利点＝+2カード。' },
    swindler:      { id: 'swindler',      name: '詐欺師',     cost: 3, types: ['action', 'attack'],
                     text: '+2 コイン\n他のプレイヤーは各自、山札の上1枚を廃棄する。\n廃棄したカードと同じコストのカードを、\nあなたが選んで与える。' },
    saboteur:      { id: 'saboteur',      name: '破壊工作員', cost: 5, types: ['action', 'attack'],
                     text: '他のプレイヤーは各自、コスト3以上のカードが出るまで\n山札の上を公開し、それを廃棄する。\nそれより2コイン以上安いカードを獲得してもよい。\n残りは捨てる。' },
    minion:        { id: 'minion',        name: '手先',       cost: 5, types: ['action', 'attack'],
                     text: '+1 アクション\n次のうち1つを選ぶ：\n・+2 コイン\n・手札を捨てて4枚引く。さらに手札5枚以上の\n　他のプレイヤーも手札を捨てて4枚引く。' },
    masquerade:    { id: 'masquerade',    name: '仮面舞踏会', cost: 3, types: ['action'],
                     text: '+2 カード\n各プレイヤーは同時に手札を1枚、左隣に渡す。\nその後、あなたは手札を1枚廃棄してもよい。' },
    secret_chamber:{ id: 'secret_chamber',name: '秘密の小部屋', cost: 2, types: ['action', 'reaction'],
                     text: '手札を好きな枚数捨て、捨てた1枚につき +1 コイン。\n（リアクション）他人がアタックを使ったとき公開してよい。\nその場合 +2 カードし、手札2枚を山札の上に戻す。' },

    /* ===== 基本セット 第二版で追加された7種 ===== */
    harbinger:  { id: 'harbinger',  name: '前駆者',     cost: 3, types: ['action'],
                  text: '+1 カード\n+1 アクション\n捨て札を見て、その中から1枚を山札の上に置いてもよい。' },
    merchant:   { id: 'merchant',   name: '商人',       cost: 3, types: ['action'],
                  text: '+1 カード\n+1 アクション\nこのターンに最初に銀貨を出したとき、+1 コイン。' },
    vassal:     { id: 'vassal',     name: '家臣',       cost: 3, types: ['action'],
                  text: '+2 コイン\n山札の一番上を捨てる。それがアクションカードなら、使ってもよい。' },
    poacher:    { id: 'poacher',    name: '密猟者',     cost: 4, types: ['action'],
                  text: '+1 カード\n+1 アクション\n+1 コイン\n空になっているサプライの山1つにつき、手札を1枚捨てる。' },
    bandit:     { id: 'bandit',     name: '山賊',       cost: 5, types: ['action', 'attack'],
                  text: '金貨1枚を獲得する。\n他のプレイヤーは各自、山札の上2枚を公開し、\n銅貨以外の財宝1枚を廃棄し、残りを捨てる。' },
    sentry:     { id: 'sentry',     name: '衛兵',       cost: 5, types: ['action'],
                  text: '+1 カード\n+1 アクション\n山札の上2枚を見る。好きな枚数を廃棄／捨て札にし、\n残りを好きな順で山札の上に戻す。' },
    artisan:    { id: 'artisan',    name: '職人',       cost: 6, types: ['action'],
                  text: 'コスト5以下のカード1枚を手札に獲得する。\n手札のカード1枚を山札の上に置く。' },

    /* ===== 陰謀 第二版で追加された7種 ===== */
    courtier:     { id: 'courtier',     name: '廷臣',       cost: 5, types: ['action'],
                    text: '手札のカード1枚を公開する。\nそのカードの持つ種類の数だけ、次から選ぶ（異なるもの）：\n+1 アクション／+1 購入／+3 コイン／金貨1枚を獲得。' },
    diplomat:     { id: 'diplomat',     name: '外交官',     cost: 4, types: ['action', 'reaction'],
                    text: '+2 カード\n引いた後、手札が5枚以下なら +2 アクション。\n（リアクション）他人がアタックを使ったとき、手札5枚以上で\nこれを公開→2枚引き、その後手札3枚を捨てる。' },
    lurker:       { id: 'lurker',       name: '待ち伏せ',   cost: 2, types: ['action'],
                    text: '+1 アクション\n次から1つを選ぶ：\n・サプライのアクションカード1枚を廃棄する\n・廃棄置き場のアクションカード1枚を獲得する' },
    mill:         { id: 'mill',         name: '風車',       cost: 4, types: ['action', 'victory'], vp: 1,
                    text: '+1 カード\n+1 アクション\n手札を2枚捨ててもよい。捨てたら +2 コイン。\n（勝利点 1）' },
    patrol:       { id: 'patrol',       name: 'パトロール', cost: 5, types: ['action'],
                    text: '+3 カード\n山札の上4枚を公開する。勝利点と呪いを手札に加え、\n残りを好きな順で山札の上に戻す。' },
    replace:      { id: 'replace',      name: '身代わり',   cost: 5, types: ['action', 'attack'],
                    text: '手札1枚を廃棄する。それより最大$2高いカード1枚を獲得する。\nそれがアクション／財宝なら山札の上に置く。\n勝利点なら他のプレイヤーは各自、呪い1枚を獲得する。' },
    secret_passage:{ id: 'secret_passage', name: '隠し通路', cost: 4, types: ['action'],
                    text: '+2 カード\n+1 アクション\n手札のカード1枚を、山札の好きな位置に入れる。' },

    /* ===== プロモカード ===== */
    walled_village:{ id: 'walled_village', name: '城壁のある村', cost: 4, types: ['action'],
                    text: '+1 カード\n+2 アクション\nクリーンアップ開始時、場に出ているアクションが\nこれを含め2枚以下なら、これを山札の上に置いてよい。' },
    envoy:        { id: 'envoy',        name: '使者',       cost: 4, types: ['action'],
                    text: '山札の上5枚を公開する。左隣のプレイヤーが1枚を選び、\nそれを捨てる。残りを手札に加える。' },
    governor:     { id: 'governor',     name: '総督',       cost: 5, types: ['action'],
                    text: '+1 アクション\n次から1つを選ぶ（自分はカッコ内の強い方）：\n・全員 +1（+3）カード\n・全員 銀貨（金貨）を獲得\n・全員 任意で手札1枚を廃棄し、ちょうど$1（$2）高いカードを獲得' },
    dismantle:    { id: 'dismantle',    name: '取り壊し',   cost: 4, types: ['action'],
                    text: '手札1枚を廃棄する。そのコストが$1以上なら、\nそれより安いカード1枚と金貨1枚を獲得する。' },
    black_market: { id: 'black_market', name: '闇市場',     cost: 3, types: ['action'],
                    text: '+2 コイン\n闇市場デッキの上3枚を公開する。\n手札から財宝を好きなだけ出してよい。\n公開した1枚を購入してもよい。残りは闇市場デッキの底へ。' },
    hoard:        { id: 'hoard',        name: '隠し財産',   cost: 6, types: ['treasure'], coin: 2,
                    text: 'コイン +2\nこれが場にある間、勝利点カードを獲得したとき、金貨1枚を獲得する。' },

    /* ===== 拡張: 海辺（Seaside 第二版）27種 =====
       いまは「完成形カード画像(asset/cards/<id>.webp)を作る」ためのカタログ追加のみ。
       実ゲームロジック（持続機構・島/原住民マット等）は未実装で、どのプレイ可能セット
       （DOM.CARD_SETS / DOM.KINGDOM 系）にも入れていない（後述の孤立プール seaside に隔離）。
       => ゲーム挙動は不変。表示(cards.html)とカード画像合成(build-cards.js)だけが参照する。 */
    // --- コスト2 ---
    native_village: { id: 'native_village', name: '原住民の村', cost: 2, types: ['action'],
                      text: '+2 アクション\nデッキの一番上を原住民マットに置く\nまたは原住民マットの全カードを手札に' },
    haven:        { id: 'haven',        name: '停泊所',     cost: 2, types: ['action', 'duration'],
                    text: '+1 カード\n+1 アクション\n手札1枚を脇に置き、次のターン開始時に手札へ' },
    lighthouse:   { id: 'lighthouse',   name: '灯台',       cost: 2, types: ['action', 'duration'],
                    text: '+1 アクション\n+1 コイン\n次のターン +1 コイン\n場にある間、他人のアタックを受けない' },
    // --- コスト3 ---
    warehouse:    { id: 'warehouse',    name: '倉庫',       cost: 3, types: ['action'],
                    text: '+3 カード\n+1 アクション\n手札を3枚捨てる' },
    smugglers:    { id: 'smugglers',    name: '密輸人',     cost: 3, types: ['action'],
                    text: '直前の手番で右隣が獲得した\n6コスト以下のカード1枚を獲得' },
    lookout:      { id: 'lookout',      name: '見張り',     cost: 3, types: ['action'],
                    text: '+1 アクション\n山札の上3枚を見て\n1枚廃棄・1枚捨て・1枚を戻す' },
    fishing_village:{ id: 'fishing_village', name: '漁村',  cost: 3, types: ['action', 'duration'],
                    text: '+2 アクション\n+1 コイン\n次のターン +1 アクション +1 コイン' },
    sea_chart:    { id: 'sea_chart',    name: '海図',       cost: 3, types: ['action'],
                    text: '+1 カード\n+1 アクション\n山札の上を公開し、同名が場にあれば手札に' },
    monkey:       { id: 'monkey',       name: 'サル',       cost: 3, types: ['action', 'duration'],
                    text: '次の自分の手番まで、右隣の獲得ごとに +1 カード\n次のターン +1 カード' },
    astrolabe:    { id: 'astrolabe',    name: 'アストロラーベ', cost: 3, types: ['treasure', 'duration'],
                    text: 'このターンと次のターン\n+1 コイン\n+1 購入' },
    // --- コスト4 ---
    treasure_map: { id: 'treasure_map', name: '宝の地図',   cost: 4, types: ['action'],
                    text: 'これと手札の宝の地図をもう1枚廃棄できれば\n金貨4枚を獲得し山札の上に置く' },
    salvager:     { id: 'salvager',     name: '引揚水夫',   cost: 4, types: ['action'],
                    text: '+1 購入\n手札1枚を廃棄\n+（廃棄したカードのコスト）コイン' },
    cutpurse:     { id: 'cutpurse',     name: '巾着切り',   cost: 4, types: ['action', 'attack'],
                    text: '+2 コイン\n他は銅貨1枚を捨てる' },
    caravan:      { id: 'caravan',      name: '隊商',       cost: 4, types: ['action', 'duration'],
                    text: '+1 カード\n+1 アクション\n次のターン +1 カード' },
    island:       { id: 'island',       name: '島',         cost: 4, types: ['action', 'victory'], vp: 2,
                    text: 'これと手札1枚を島マットに置く\n（勝利点 2）' },
    sailor:       { id: 'sailor',       name: '船乗り',     cost: 4, types: ['action', 'duration'],
                    text: '+1 アクション\nこのターン1度、獲得した持続カードを使える\n次のターン +2 コイン、手札1枚を廃棄してよい' },
    tide_pools:   { id: 'tide_pools',   name: '潮だまり',   cost: 4, types: ['action', 'duration'],
                    text: '+3 カード\n+1 アクション\n次のターン開始時、手札を2枚捨てる' },
    // --- コスト5 ---
    bazaar:       { id: 'bazaar',       name: 'バザー',     cost: 5, types: ['action'],
                    text: '+1 カード\n+2 アクション\n+1 コイン' },
    treasury:     { id: 'treasury',     name: '宝物庫',     cost: 5, types: ['action'],
                    text: '+1 カード\n+1 アクション\n+1 コイン\n勝利点カードを購入していなければ山札の上に戻せる' },
    outpost:      { id: 'outpost',      name: '前哨地',     cost: 5, types: ['action', 'duration'],
                    text: 'このターン1度だけ、手札3枚の追加ターンを得る' },
    tactician:    { id: 'tactician',    name: '策士',       cost: 5, types: ['action', 'duration'],
                    text: '手札を全て捨てる\n1枚でも捨てたら次のターン\n+5 カード +1 購入 +1 アクション' },
    merchant_ship:{ id: 'merchant_ship', name: '商船',      cost: 5, types: ['action', 'duration'],
                    text: 'このターンと次のターン\n+2 コイン' },
    wharf:        { id: 'wharf',        name: '船着場',     cost: 5, types: ['action', 'duration'],
                    text: 'このターンと次のターン\n+2 カード +1 購入' },
    blockade:     { id: 'blockade',     name: '封鎖',       cost: 5, types: ['action', 'duration', 'attack'],
                    text: '4コスト以下を獲得して脇に置き、次のターン手札へ\n場にある間、他人が同名を獲得するたび呪いを獲得させる' },
    corsair:      { id: 'corsair',      name: '私掠船',     cost: 5, types: ['action', 'duration', 'attack'],
                    text: '+2 コイン\n次のターン +1 カード\n他は各ターン最初の銀貨か金貨を廃棄' },
    sea_witch:    { id: 'sea_witch',    name: '海の魔女',   cost: 5, types: ['action', 'duration', 'attack'],
                    text: '+2 カード\n他は呪いを獲得\n次のターン +2 カード後、手札を2枚捨てる' },
    pirate:       { id: 'pirate',       name: '海賊',       cost: 5, types: ['treasure', 'duration', 'reaction'],
                    text: '次のターン、6コスト以下の財宝1枚を手札に獲得\n（リアクション）誰かが財宝を獲得時、手札から使える' },

    /* ===== 拡張: 錬金術（Alchemy 第二版）13種 =====
       いまは「完成形カード画像」用のカタログ追加のみ（実ゲームロジックは別途・未実装）。
       どのプレイ可能セットにも入れていない（孤立プール alchemy に隔離）＝ゲーム挙動は不変。
       potion = ポーション費用（コスト円の下に紫のポーション記号で表示）。cost はコイン費用。 */
    potion:       { id: 'potion',       name: 'ポーション',   cost: 4, types: ['treasure'],
                    text: 'ポーション +1\n（ポーション費用の支払いに使う）' },
    transmute:    { id: 'transmute',    name: '変成',         cost: 0, potion: 1, types: ['action'],
                    text: '手札1枚を廃棄する。\nアクション→公領／財宝→変成／勝利点→金貨 を獲得。' },
    vineyard:     { id: 'vineyard',     name: 'ブドウ園',     cost: 0, potion: 1, types: ['victory'],
                    text: '（勝利点）\n所持するアクションカード3枚につき 1 勝利点（端数切捨て）。' },
    herbalist:    { id: 'herbalist',    name: '薬草商',       cost: 2, types: ['action'],
                    text: '+1 購入\n+1 コイン\nこのターンの片付けで、場の財宝1枚を山札の上に置いてよい。' },
    apothecary:   { id: 'apothecary',   name: '薬剤師',       cost: 2, potion: 1, types: ['action'],
                    text: '+1 カード\n+1 アクション\n山札の上4枚を公開し、銅貨とポーションを手札に。残りを好きな順で山札の上に戻す。' },
    scrying_pool: { id: 'scrying_pool', name: '念視の泉',     cost: 2, potion: 1, types: ['action', 'attack'],
                    text: '+1 アクション\n全員の山札の上を公開し、捨てるか戻すかをあなたが選ぶ。\n自分はアクション以外が出るまで公開し、全て手札に加える。' },
    university:   { id: 'university',   name: '大学',         cost: 2, potion: 1, types: ['action'],
                    text: '+2 アクション\nコスト5以下のアクションカード1枚を獲得してもよい。' },
    alchemist:    { id: 'alchemist',    name: '錬金術師',     cost: 3, potion: 1, types: ['action'],
                    text: '+2 カード\n+1 アクション\n片付け開始時、場にポーションがあればこれを山札の上に置いてよい。' },
    familiar:     { id: 'familiar',     name: '使い魔',       cost: 3, potion: 1, types: ['action', 'attack'],
                    text: '+1 カード\n+1 アクション\n他のプレイヤーは各自、呪い1枚を獲得する。' },
    philosophers_stone: { id: 'philosophers_stone', name: '賢者の石', cost: 3, potion: 1, types: ['treasure'],
                    text: 'これを使うとき、山札と捨て札の合計を数える。\n5枚につき +1 コイン（端数切捨て）。' },
    golem:        { id: 'golem',        name: 'ゴーレム',     cost: 4, potion: 1, types: ['action'],
                    text: 'ゴーレム以外のアクションが2枚出るまで山札を公開する。\n残りを捨て、その2枚を好きな順で使う。' },
    apprentice:   { id: 'apprentice',   name: '徒弟',         cost: 5, types: ['action'],
                    text: '+1 アクション\n手札1枚を廃棄する。\nそのコスト$1につき +1 カード（ポーション費用ありなら +2 カード）。' },
    possession:   { id: 'possession',   name: '支配',         cost: 6, potion: 2, types: ['action'],
                    text: '左隣はこのターンの後に追加ターンを行い、その間あなたが全ての決定を行う。\n獲得・廃棄したカードはあなたが受け取る。' },

    // ===== 繁栄（Prosperity 第二版）王国カード 25種 =====
    anvil:        { id: 'anvil',        name: '金床',         cost: 3, types: ['treasure'], coin: 1,
                    text: 'コイン +1\n財宝1枚を捨ててよい。捨てたなら、コスト4以下のカード1枚を獲得する。' },
    watchtower:   { id: 'watchtower',   name: '物見やぐら',   cost: 3, types: ['action', 'reaction'],
                    text: '手札が6枚になるまで引く。\n（リアクション）カードを獲得したとき、これを手札から公開してよい。公開したら、そのカードを廃棄するか山札の上に置く。' },
    bishop:       { id: 'bishop',       name: '司教',         cost: 4, types: ['action'],
                    text: '+1 コイン、+1 勝利点\n手札1枚を廃棄する。そのコスト$2につき +1 勝利点（端数切捨て）。\n他のプレイヤーは各自、手札1枚を廃棄してよい。' },
    clerk:        { id: 'clerk',        name: '会計士',       cost: 4, types: ['action', 'attack', 'reaction'],
                    text: '+2 コイン\n手札が5枚以上の他のプレイヤーは各自、手札1枚を山札の上に置く。\n自分の手番開始時、これを手札から使ってよい。' },
    investment:   { id: 'investment',   name: '投資',         cost: 4, types: ['treasure'],
                    text: 'これを廃棄する。次のうち1つ：\n「+1 コイン」／「手札の財宝1枚を廃棄し、場の財宝の種類1つにつき +1 勝利点」。' },
    monument:     { id: 'monument',     name: '記念碑',       cost: 4, types: ['action'],
                    text: '+2 コイン、+1 勝利点' },
    quarry:       { id: 'quarry',       name: '石切場',       cost: 4, types: ['treasure'], coin: 1,
                    text: 'コイン +1\nこれが場にある間、アクションカードのコストは $2 少なくなる（$0未満にはならない）。' },
    tiara:        { id: 'tiara',        name: 'ティアラ',     cost: 4, types: ['treasure'],
                    text: '+1 購入\nこのターン、カードを獲得したとき山札の上に置いてよい。\n手札の財宝1枚を2回使ってよい。' },
    workers_village: { id: 'workers_village', name: '労働者の村', cost: 4, types: ['action'],
                    text: '+1 カード、+2 アクション、+1 購入' },
    charlatan:    { id: 'charlatan',    name: 'ペテン師',     cost: 5, types: ['treasure', 'attack'], coin: 3,
                    text: 'コイン +3\n他のプレイヤーは各自、銅貨1枚を獲得する。' },
    city:         { id: 'city',         name: '都市',         cost: 5, types: ['action'],
                    text: '+1 カード、+2 アクション\n空のサプライ山が1つあれば +1 カード。2つ以上なら さらに +1 購入・+1 コイン。' },
    collection:   { id: 'collection',   name: '収集',         cost: 5, types: ['treasure'], coin: 2,
                    text: 'コイン +2、+1 購入\nこのターン、アクションカードを獲得するたびに +1 勝利点。' },
    crystal_ball: { id: 'crystal_ball', name: '水晶玉',       cost: 5, types: ['treasure'], coin: 1,
                    text: 'コイン +1\n山札の一番上を見る。廃棄／捨て札にする／（アクションか財宝なら）使う のいずれかをしてよい。' },
    magnate:      { id: 'magnate',      name: '富豪',         cost: 5, types: ['action'],
                    text: '手札を公開する。その中の財宝1枚につき +1 カード。' },
    mint:         { id: 'mint',         name: '造幣所',       cost: 5, types: ['action'],
                    text: '手札の財宝1枚を公開してよい。公開したなら、そのコピーを獲得する。\n（購入時）これを購入したとき、場の財宝をすべて廃棄する。' },
    rabble:       { id: 'rabble',       name: '群衆',         cost: 5, types: ['action', 'attack'],
                    text: '+3 カード\n他のプレイヤーは各自、山札の上3枚を公開し、アクションと財宝を捨て、残りを好きな順で山札の上に戻す。' },
    vault:        { id: 'vault',        name: '金庫室',       cost: 5, types: ['action'],
                    text: '+2 カード\n手札を好きな枚数捨て、1枚につき +1 コイン。\n他のプレイヤーは各自、手札2枚を捨ててよい。捨てたなら1枚引く。' },
    war_chest:    { id: 'war_chest',    name: '軍用金',       cost: 5, types: ['action'],
                    text: '左隣がカード名を1つ指定する。\nコスト$5以下で、このターンに軍用金で指定されていないカード1枚を獲得する。' },
    grand_market: { id: 'grand_market', name: '高級市場',     cost: 6, types: ['action'],
                    text: '+1 カード、+1 アクション、+1 購入、+2 コイン\n場に銅貨があるとき、これは購入できない。' },
    bank:         { id: 'bank',         name: '銀行',         cost: 7, types: ['treasure'],
                    text: 'これを使うとき、場の財宝1枚につき +1 コイン（これ自身も数える）。' },
    expand:       { id: 'expand',       name: '拡張',         cost: 7, types: ['action'],
                    text: '手札1枚を廃棄する。そのコストより $3 多いコストまでのカード1枚を獲得する。' },
    forge:        { id: 'forge',        name: '溶鉱炉',       cost: 7, types: ['action'],
                    text: '手札を好きな枚数廃棄する。廃棄したコストの合計とちょうど等しいコストのカード1枚を獲得する。' },
    kings_court:  { id: 'kings_court',  name: '王の宮廷',     cost: 7, types: ['action'],
                    text: '手札のアクションカード1枚を3回使ってよい。' },
    peddler:      { id: 'peddler',      name: '行商人',       cost: 8, types: ['action'],
                    text: '+1 カード、+1 アクション、+1 コイン\n（購入フェイズ中）場のアクションカード1枚につき、これのコストは $2 少なくなる（$0未満にはならない）。' },
  };

  /* ---------- 王国カードのセット ----------
     第二版をデフォルトに。第二版で廃止された初版カードは実装を残し「初版」セットで遊べる。 */
  // 基本（第二版）「はじめてのゲーム」推奨10種＝デフォルト。商人(新カード)入り。
  DOM.KINGDOM = ['cellar', 'market', 'merchant', 'militia', 'mine',
                 'moat', 'remodel', 'smithy', 'village', 'workshop'];
  // 陰謀（第二版）推奨10種。新カード（待ち伏せ・風車・隠し通路）入り。
  DOM.KINGDOM_INTRIGUE = ['courtyard', 'pawn', 'lurker', 'shanty_town', 'steward',
                          'conspirator', 'mill', 'secret_passage', 'swindler', 'nobles'];
  // 海辺（第二版）推奨10種。持続・マット・追加ターン・アタックをひと通り味わえる構成。
  DOM.KINGDOM_SEASIDE = ['haven', 'lighthouse', 'native_village', 'fishing_village', 'warehouse',
                         'merchant_ship', 'wharf', 'treasury', 'sea_witch', 'island'];
  // 繁栄（第二版）推奨10種。VPトークン・植民地/プラチナ貨・王の宮廷・アタック・スケール札を味わえる構成。
  DOM.KINGDOM_PROSPERITY = ['watchtower', 'monument', 'workers_village', 'bishop', 'city',
                            'rabble', 'vault', 'grand_market', 'kings_court', 'peddler'];
  // 錬金術（第二版）推奨10種。ポーション経済・変動VP(ブドウ園)・アタック(使い魔)・支配を味わえる構成。
  DOM.KINGDOM_ALCHEMY = ['vineyard', 'herbalist', 'apothecary', 'university', 'alchemist',
                         'familiar', 'philosophers_stone', 'golem', 'apprentice', 'possession'];
  // 初版（第二版で廃止されたカードを含む懐かしのセット）
  DOM.KINGDOM_1E = ['cellar', 'chancellor', 'woodcutter', 'feast', 'militia',
                    'spy', 'thief', 'council_room', 'adventurer', 'market'];
  DOM.KINGDOM_INTRIGUE_1E = ['courtyard', 'great_hall', 'pawn', 'steward', 'scout',
                             'baron', 'conspirator', 'coppersmith', 'tribute', 'nobles'];

  // 第二版で「廃止された」初版カード（初版プールに足して懐かしの抽選母集団を作る）
  const BASE_REMOVED_1E = ['woodcutter', 'chancellor', 'feast', 'adventurer', 'spy', 'thief'];
  const INTRIGUE_REMOVED_1E = ['great_hall', 'coppersmith', 'scout', 'tribute', 'saboteur', 'secret_chamber'];
  // 第二版で「追加された」新カード
  const BASE_NEW_2E = ['harbinger', 'merchant', 'vassal', 'poacher', 'bandit', 'sentry', 'artisan'];
  const INTRIGUE_NEW_2E = ['courtier', 'diplomat', 'lurker', 'mill', 'patrol', 'replace', 'secret_passage'];

  // 拡張ごとの王国カードプール（ランダム抽選の母集団）。将来の拡張はここに足す。
  DOM.POOLS = {
    // 基本 第二版（26種）= 初版から廃止6種を除き、新7種を足したもの
    basic: ['cellar', 'village', 'workshop', 'moat', 'militia', 'smithy', 'remodel', 'market', 'mine',
            'laboratory', 'festival', 'moneylender', 'chapel', 'gardens', 'witch', 'bureaucrat',
            'council_room', 'library', 'throne_room'].concat(BASE_NEW_2E),
    // 陰謀 第二版（26種）
    intrigue: ['courtyard', 'pawn', 'shanty_town', 'steward', 'wishing_well', 'baron', 'bridge',
               'conspirator', 'ironworks', 'mining_village', 'torturer', 'duke', 'nobles', 'harem',
               'trading_post', 'upgrade', 'swindler', 'minion', 'masquerade'].concat(INTRIGUE_NEW_2E),
    // プロモ（6種）
    promo: ['walled_village', 'envoy', 'governor', 'dismantle', 'black_market', 'hoard'],
    // 海辺 第二版（27種）= 抽選母集団。「海辺セット」(固定10種)と「海辺から」(ランダム)が参照する。
    seaside: ['native_village', 'haven', 'lighthouse', 'warehouse', 'smugglers', 'lookout',
              'fishing_village', 'sea_chart', 'monkey', 'astrolabe', 'treasure_map', 'salvager',
              'cutpurse', 'caravan', 'island', 'sailor', 'tide_pools', 'bazaar', 'treasury',
              'outpost', 'tactician', 'merchant_ship', 'wharf', 'blockade', 'corsair', 'sea_witch', 'pirate'],
    // 錬金術 第二版（王国カード12種）= 抽選母集団。「錬金術セット」(固定10種)と「錬金術から」(ランダム)が参照する。
    //   ポーション(potion)は王国カードではなく共通サプライ＝ここには入れない（potion 費用カードが場にあると
    //   initSupply が自動でポーション山を足す）。整合性テストは potion を呪い同様の共通カードとして扱う。
    alchemy: ['transmute', 'vineyard', 'herbalist', 'apothecary', 'scrying_pool', 'university',
              'alchemist', 'familiar', 'philosophers_stone', 'golem', 'apprentice', 'possession'],
    // 繁栄 第二版（王国カード25種）= 抽選母集団。「繁栄セット」(固定10種)と「繁栄から」(ランダム)が参照する。
    //   プラチナ貨/植民地は王国カードではなく共通サプライ＝ここには入れない（繁栄の王国カードが場にあると
    //   initSupply が自動で platinum/colony 山を足す）。hoard は元々プロモにもあるが本来は繁栄のカード。
    prosperity: ['anvil', 'watchtower', 'bishop', 'clerk', 'investment', 'monument', 'quarry', 'tiara',
                 'workers_village', 'charlatan', 'city', 'collection', 'crystal_ball', 'magnate', 'mint',
                 'rabble', 'vault', 'war_chest', 'grand_market', 'hoard', 'bank', 'expand', 'forge',
                 'kings_court', 'peddler'],
  };
  // 初版プール＝第二版プールから新カードを除き、廃止された初版カードを戻したもの
  DOM.POOLS.basic1e = DOM.POOLS.basic.filter((id) => !BASE_NEW_2E.includes(id)).concat(BASE_REMOVED_1E);
  DOM.POOLS.intrigue1e = DOM.POOLS.intrigue.filter((id) => !INTRIGUE_NEW_2E.includes(id)).concat(INTRIGUE_REMOVED_1E);

  // 全王国カードのプール（後方互換: 'random' の既定母集団 = 基本＋陰謀 第二版）
  DOM.KINGDOM_POOL = DOM.POOLS.basic.concat(DOM.POOLS.intrigue);
  // 画面で選べるセット（id はサーバ検証・保存にも使う）。
  //   kingdom 固定 … おすすめ10種をそのまま使う
  //   randomFrom  … 指定した拡張プールを合わせた中から毎回10種を抽選
  // 拡張を増やすときは POOLS に足し、ここに固定/ランダムのセットを追記するだけ。
  //   kind … UIの分類。standard=王国基本/陰謀基本、recommend=おすすめ（テーマ別）、random=ランダム。
  //   desc … おすすめタイルに出す一行説明。
  DOM.CARD_SETS = [
    // ---- 標準（第二版の王国基本・陰謀基本）----
    { id: 'basic',           kind: 'standard', name: '王国基本セット（第二版）', kingdom: DOM.KINGDOM },
    { id: 'intrigue',        kind: 'standard', name: '陰謀セット（第二版）', kingdom: DOM.KINGDOM_INTRIGUE },
    { id: 'seaside',         kind: 'standard', name: '海辺セット（第二版）', kingdom: DOM.KINGDOM_SEASIDE },
    { id: 'alchemy',         kind: 'standard', name: '錬金術セット（第二版）', kingdom: DOM.KINGDOM_ALCHEMY },
    { id: 'prosperity',      kind: 'standard', name: '繁栄セット（第二版）', kingdom: DOM.KINGDOM_PROSPERITY },
    // ---- おすすめ（テーマ別・固定10種）----
    { id: 'big-money',       kind: 'recommend', name: 'ビッグマネー', desc: 'お金を伸ばして属州を狙う王道',
      kingdom: ['chapel', 'moneylender', 'harbinger', 'throne_room', 'bureaucrat', 'poacher', 'market', 'mine', 'laboratory', 'sentry'] },
    { id: 'interaction',     kind: 'recommend', name: '対戦・妨害', desc: 'アタックと妨害が多い対戦的セット',
      kingdom: ['moat', 'village', 'bureaucrat', 'vassal', 'militia', 'bandit', 'witch', 'council_room', 'festival', 'library'] },
    { id: 'size-distortion', kind: 'recommend', name: 'デッキ膨張', desc: '庭園・魔女などデッキ枚数が絡む',
      kingdom: ['cellar', 'chapel', 'harbinger', 'workshop', 'gardens', 'village', 'merchant', 'artisan', 'laboratory', 'witch'] },
    { id: 'victory-dance',   kind: 'recommend', name: '勝利点レース（陰謀）', desc: '勝利点の取り合いが激しい',
      kingdom: ['mill', 'pawn', 'masquerade', 'patrol', 'ironworks', 'bridge', 'duke', 'harem', 'nobles', 'upgrade'] },
    { id: 'secret-schemes',  kind: 'recommend', name: '策謀コンボ（陰謀）', desc: 'アクション連鎖・コンボ重視',
      kingdom: ['courtyard', 'pawn', 'shanty_town', 'steward', 'wishing_well', 'baron', 'conspirator', 'mining_village', 'swindler', 'torturer'] },
    { id: 'starter-mix',     kind: 'recommend', name: '入門ミックス', desc: '基本＋陰謀をやさしく混ぜた入門',
      kingdom: ['moat', 'pawn', 'courtyard', 'village', 'steward', 'militia', 'smithy', 'baron', 'bridge', 'market'] },
    // ---- 初版（第二版で廃止された懐かしのカード入り）----
    { id: 'classic-basic',    kind: 'recommend', name: '初版・王国基本', desc: '宰相・木こり・祝宴・密偵・泥棒・冒険者＝廃止カード入り',
      kingdom: DOM.KINGDOM_1E },
    { id: 'classic-intrigue', kind: 'recommend', name: '初版・陰謀', desc: '大広間・斥候・銅細工師・貢物＝廃止カード入り',
      kingdom: DOM.KINGDOM_INTRIGUE_1E },
    // ---- プロモ ----
    { id: 'promo-pack',       kind: 'recommend', name: 'プロモ全部入り', desc: 'プロモ6種＋基本4種',
      kingdom: ['cellar', 'walled_village', 'envoy', 'dismantle', 'militia', 'hoard', 'governor', 'market', 'black_market', 'witch'] },
    // ---- ランダム（毎回その場で10種を抽選）----
    { id: 'random',          kind: 'random', name: '基本＋陰謀から', randomFrom: ['basic', 'intrigue'] },
    { id: 'random-seaside',  kind: 'random', name: '海辺から',       randomFrom: ['seaside'] },
    { id: 'random-alchemy',  kind: 'random', name: '錬金術から',     randomFrom: ['alchemy'] },
    { id: 'random-prosperity', kind: 'random', name: '繁栄から',     randomFrom: ['prosperity'] },
    { id: 'random-intrigue', kind: 'random', name: '陰謀のみから',   randomFrom: ['intrigue'] },
    { id: 'random-basic',    kind: 'random', name: '基本のみから',   randomFrom: ['basic'] },
    { id: 'random-promo',    kind: 'random', name: 'プロモ込みから',  randomFrom: ['basic', 'intrigue', 'promo'] },
    { id: 'random-1e',       kind: 'random', name: '初版から',        randomFrom: ['basic1e', 'intrigue1e'] },
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

  // サプライ（場の山札）の表示順。プラチナ貨/植民地は繁栄が場にあるときだけ supply に存在し、
  // 各表示・獲得処理は supply[id] の有無でフィルタするので、ここでは常に並べておいてよい。
  DOM.SUPPLY_ORDER = function (kingdom) {
    return ['copper', 'silver', 'gold', 'platinum', 'estate', 'duchy', 'province', 'colony', 'curse'].concat(kingdom);
  };

  // 補助
  DOM.isType = function (cardId, t) {
    const c = DOM.CARDS[cardId];
    return c && c.types.indexOf(t) >= 0;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DOM;
})();
