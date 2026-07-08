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
    /* ===== 追加拡張カタログ（収穫祭/異郷/暗黒時代/新プロモ）＝段階1: 画像は出るがゲーム未参加 ===== */
    stash: { id: 'stash', name: 'へそくり', cost: 5, types: ['treasure'], coin: 2,
                 text: 'コイン +2\nこれを含めてシャッフルするとき、シャッフル後の山札の好きな位置にこれを置いてよい' },
    // 王子/船長は現行エラッタ版（王子=2022年改訂/2024年再版・船長=2019年改訂）の
    // テキスト・種別（アクション-持続-命令）を採用。和訳は日本語wikiの定訳（Dominion Online訳）ベース。
    prince: { id: 'prince', name: '王子', cost: 8, types: ['action', 'duration', 'command'],
                 text: '手札からコスト4以下の、\n持続でも命令でもない\nアクションカード1枚を、\nこのカードの脇に置いてもよい。\nあなたの各ターンの開始時、\nそれを動かさずに使用する。' },
    captain: { id: 'captain', name: '船長', cost: 6, types: ['action', 'duration', 'command'],
                 text: '現在と、あなたの次のターンの開始時に\nサプライにある、持続でも命令でもない\nコスト4以下のアクションカード1枚を、\n動かさずに使用する。' },
    church: { id: 'church', name: '教会', cost: 3, types: ['action', 'duration'],
                 text: '+1 アクション\n手札から最大3枚を裏向きで脇に置く\n次のターン開始時、それらを手札に加え、その後手札1枚を廃棄してよい' },
    sauna: { id: 'sauna', name: 'サウナ', cost: 4, types: ['action'],
                 text: '+1 カード\n+1 アクション\n手札のアヴァント1枚を使ってよい\nこのターン、銀貨を使うたび手札1枚を廃棄してよい' },
    avanto: { id: 'avanto', name: 'アヴァント', cost: 5, types: ['action'],
                 text: '+3 カード\n手札のサウナ1枚を使ってよい' },
    hamlet: { id: 'hamlet', name: '小村', cost: 2, types: ['action'],
                 text: '+1 カード\n+1 アクション\nカード1枚を捨て札にしてよい。そうしたら +1 アクション。\nカード1枚を捨て札にしてよい。そうしたら +1 購入。' },
    fortune_teller: { id: 'fortune_teller', name: '占い師', cost: 3, types: ['action', 'attack'],
                 text: '+2 コイン\n他のプレイヤーは全員、勝利点カードかのろいカードが出るまで自分の山札の上のカードを公開する。それを山札の上に戻し、残りを捨て札にする。' },
    menagerie: { id: 'menagerie', name: '移動動物園', cost: 3, types: ['action'],
                 text: '+1 アクション\n手札を公開する。その中に同じ名前のカードが無ければ +3 カード。あれば +1 カード。' },
    farming_village: { id: 'farming_village', name: '農村', cost: 4, types: ['action'],
                 text: '+2 アクション\nアクションカードか財宝カードが出るまで、山札の上のカードを公開する。そのカードを手札に加え、残りを捨て札にする。' },
    horse_traders: { id: 'horse_traders', name: '馬商人', cost: 4, types: ['action', 'reaction'],
                 text: '+1 購入\n+3 コイン\nカード2枚を捨て札にする。\n————\n他のプレイヤーがアタックカードをプレイしたとき、これを手札から脇に置いてよい。そうしたら次の自分のターン開始時に、+1 カードしてこれを手札に戻す。' },
    remake: { id: 'remake', name: 'リメイク', cost: 4, types: ['action'],
                 text: '以下を2回行う：手札のカード1枚を廃棄し、それよりちょうどコスト1コイン高いカード1枚を獲得する。' },
    tournament: { id: 'tournament', name: '馬上槍試合', cost: 4, types: ['action'],
                 text: '+1 アクション\n各プレイヤーは手札から属州を公開してよい。あなたが公開したら、それを捨て札にして賞品1枚（賞品の山から）または公領1枚を山札の上に獲得する。あなた以外の誰も公開しなければ、+1 カード、+1 コイン。' },
    young_witch: { id: 'young_witch', name: '若き魔女', cost: 4, types: ['action', 'attack'],
                 text: '+2 カード\nカード2枚を捨て札にする。他のプレイヤーは全員、手札から災いカードを公開して影響を受けないようにしてよい。公開しなければ、のろい1枚を獲得する。' },
    harvest: { id: 'harvest', name: '収穫', cost: 5, types: ['action'],
                 text: '山札の上から4枚を公開し、それらを捨て札にする。公開されたカードの異なる名前1種類につき +1 コイン。' },
    horn_of_plenty: { id: 'horn_of_plenty', name: '豊穣の角', cost: 5, types: ['treasure'], coin: 0,
                 text: 'これをプレイしたとき、場に出ている異なる名前のカード（これを含む）1種類につき、コスト1コインまでのカード1枚を獲得する。それが勝利点カードなら、これを廃棄する。' },
    hunting_party: { id: 'hunting_party', name: '狩猟団', cost: 5, types: ['action'],
                 text: '+1 カード\n+1 アクション\n手札を公開する。手札にあるカードと同じ名前でないカードが出るまで、山札の上のカードを公開する。そのカードを手札に加え、残りを捨て札にする。' },
    jester: { id: 'jester', name: '道化師', cost: 5, types: ['action', 'attack'],
                 text: '+2 コイン\n他のプレイヤーは全員、自分の山札の上のカードを捨て札にする。それが勝利点カードなら、そのプレイヤーはのろい1枚を獲得する。そうでなければ、あなたが選んで、そのプレイヤーかあなたのどちらかがそのカードのコピー1枚を獲得する。' },
    fairgrounds: { id: 'fairgrounds', name: '品評会', cost: 6, types: ['victory'],
                 text: 'あなたの持つカードの異なる名前5種類につき、2勝利点（端数切り捨て）。' },
    bag_of_gold: { id: 'bag_of_gold', name: '金貨袋', cost: 0, types: ['action'],
                 text: '+1 アクション\n金貨1枚を獲得し、山札の一番上に置く。' },
    diadem: { id: 'diadem', name: '宝冠', cost: 0, types: ['treasure'], coin: 2,
                 text: '+2 コイン\n未使用のアクション1つにつき+1 コイン。' },
    followers: { id: 'followers', name: '家臣団', cost: 0, types: ['action', 'attack'],
                 text: '+2 カード\n屋敷1枚を獲得する。\n他のプレイヤーは呪い1枚を獲得し、手札が3枚になるまで捨てる。' },
    princess: { id: 'princess', name: '王女', cost: 0, types: ['action'],
                 text: '+1 購入\nこれが場に出ている間、カードのコストは2コイン安くなる（0コイン未満にはならない）。' },
    trusty_steed: { id: 'trusty_steed', name: '頼もしい乗騎', cost: 0, types: ['action'],
                 text: '以下から異なる2つを選ぶ：\n+2 カード / +2 アクション / +2 コイン / 銀貨4枚を獲得し山札を捨て札に置く。' },
    crossroads: { id: 'crossroads', name: '岐路', cost: 2, types: ['action'],
                 text: '手札を公開する。\n公開した勝利点カード1枚につき +1 カード\nこのターンに最初にプレイしたクロスロードであれば、+3 アクション' },
    duchess: { id: 'duchess', name: '公爵夫人', cost: 2, types: ['action'],
                 text: '+2 コイン\n各プレイヤー（あなたを含む）は自分の山札の一番上のカードを見て、それを捨て札にしてもよい。' },
    fools_gold: { id: 'fools_gold', name: '愚者の黄金', cost: 2, types: ['treasure', 'reaction'], coin: 1,
                 text: 'このターンに最初にプレイした愚者の黄金なら 1 コイン、そうでなければ 4 コインを生む。\n他のプレイヤーが属州を獲得したとき、このカードを手札から廃棄してもよい。そうした場合、金貨1枚を獲得し山札の一番上に置く。' },
    develop: { id: 'develop', name: '開発', cost: 3, types: ['action'],
                 text: '手札のカード1枚を廃棄する。\nそのコストちょうど1コイン高いカードと、ちょうど1コイン安いカードを1枚ずつ獲得し、好きな順で山札の一番上に置く。' },
    oasis: { id: 'oasis', name: 'オアシス', cost: 3, types: ['action'],
                 text: '+1 カード\n+1 アクション\n+1 コイン\n手札を1枚捨てる。' },
    oracle: { id: 'oracle', name: '神託', cost: 3, types: ['action', 'attack'],
                 text: '各プレイヤー（あなたを含む）は自分の山札の上から2枚を公開する。あなたはプレイヤーごとに、それらを捨て札にさせるか、好きな順で山札の一番上に戻させるかを選ぶ。\nその後、+2 カード' },
    scheme: { id: 'scheme', name: '策謀', cost: 3, types: ['action'],
                 text: '+1 カード\n+1 アクション\nこのターンのクリンナップ時、場に出ているアクションカード1枚を選び、山札の一番上に置いてもよい。' },
    tunnel: { id: 'tunnel', name: 'トンネル', cost: 3, types: ['victory', 'reaction'], vp: 2,
                 text: '2 勝利点\nクリンナップ以外でこのカードを捨てたとき、これを公開してもよい。そうした場合、金貨1枚を獲得する。' },
    jack_of_all_trades: { id: 'jack_of_all_trades', name: '何でも屋', cost: 4, types: ['action'],
                 text: '銀貨1枚を獲得する。\n山札の一番上のカードを見て、捨ててもよい。\n手札が5枚になるまで引く。\n手札から財宝でないカード1枚を廃棄してもよい。' },
    noble_brigand: { id: 'noble_brigand', name: '高貴な山賊', cost: 4, types: ['action', 'attack'],
                 text: '+1 コイン\nこのカードを購入またはプレイしたとき、他のプレイヤーは各自山札の上から2枚を公開し、あなたが選んだ公開された銀貨または金貨1枚を廃棄し、残りを捨てる。財宝を1枚も公開しなかったプレイヤーは銅貨1枚を獲得する。あなたは廃棄されたカードをすべて獲得する。' },
    nomad_camp: { id: 'nomad_camp', name: '遊牧民の野営地', cost: 4, types: ['action'],
                 text: '+1 購入\n+2 コイン\nこのカードを獲得したとき、山札の一番上に置く。' },
    silk_road: { id: 'silk_road', name: '絹の道', cost: 4, types: ['victory'],
                 text: '自分のデッキの勝利点カード4枚につき 1 勝利点（端数切り捨て）。' },
    spice_merchant: { id: 'spice_merchant', name: '香辛料商人', cost: 4, types: ['action'],
                 text: '手札から財宝1枚を廃棄してもよい。そうした場合、次のいずれかを選ぶ：\n＋2 カードと ＋1 アクション、または ＋2 コインと ＋1 購入。' },
    trader: { id: 'trader', name: '交易商人', cost: 4, types: ['action', 'reaction'],
                 text: '手札のカード1枚を廃棄する。そのコスト（コイン）と同じ枚数の銀貨を獲得する。\nカードを獲得するとき、このカードを手札から公開してもよい。そうした場合、そのカードの代わりに銀貨1枚を獲得する。' },
    cache: { id: 'cache', name: 'キャッシュ', cost: 5, types: ['treasure'], coin: 3,
                 text: '3 コイン\nこのカードを獲得したとき、銅貨2枚を獲得する。' },
    cartographer: { id: 'cartographer', name: '地図職人', cost: 5, types: ['action'],
                 text: '+1 カード\n+1 アクション\n山札の上から4枚を見る。好きな枚数を捨て、残りを好きな順で山札の一番上に戻す。' },
    embassy: { id: 'embassy', name: '大使館', cost: 5, types: ['action'],
                 text: '+5 カード\n手札を3枚捨てる。\nこのカードを獲得したとき、他のプレイヤーは各自銀貨1枚を獲得する。' },
    haggler: { id: 'haggler', name: '値切り屋', cost: 5, types: ['action'],
                 text: '+2 コイン\nこのカードが場にある間、カードを購入したとき、そのコスト未満の勝利点でないカード1枚を獲得する。' },
    highway: { id: 'highway', name: '街道', cost: 5, types: ['action'],
                 text: '+1 カード\n+1 アクション\nこのカードが場にある間、すべてのカードのコストは 1 コイン安くなる（ただし 0 コイン未満にはならない）。' },
    ill_gotten_gains: { id: 'ill_gotten_gains', name: '不正利得', cost: 5, types: ['treasure'], coin: 1,
                 text: '1 コイン\nこのカードをプレイしたとき、銅貨1枚を獲得して手札に加えてもよい。\nこのカードを獲得したとき、他のプレイヤーは各自呪い1枚を獲得する。' },
    inn: { id: 'inn', name: '宿屋', cost: 5, types: ['action'],
                 text: '+2 カード\n+2 アクション\n手札を2枚捨てる。\nこのカードを獲得したとき、自分の捨て札（このカードを含む）を見て、その中のアクションカードを好きな枚数公開し、山札に混ぜてシャッフルする。' },
    mandarin: { id: 'mandarin', name: '役人', cost: 5, types: ['action'],
                 text: '+3 コイン\n手札のカード1枚を山札の一番上に置く。\nこのカードを獲得したとき、場に出ているすべての財宝を好きな順で山札の一番上に置く。' },
    margrave: { id: 'margrave', name: '辺境伯', cost: 5, types: ['action', 'attack'],
                 text: '+3 カード\n+1 購入\n他のプレイヤーは各自カードを1枚引き、その後手札が3枚になるまで捨てる。' },
    stables: { id: 'stables', name: '厩舎', cost: 5, types: ['action'],
                 text: '手札から財宝1枚を捨ててもよい。そうした場合、+3 カードと +1 アクション。' },
    border_village: { id: 'border_village', name: '国境の村', cost: 6, types: ['action'],
                 text: '+1 カード\n+2 アクション\nこのカードを獲得したとき、そのコスト未満のカード1枚を獲得する。' },
    farmland: { id: 'farmland', name: '農地', cost: 6, types: ['victory'], vp: 2,
                 text: '2 勝利点\nこのカードを購入したとき、手札のカード1枚を廃棄し、そのコストちょうど2コイン高いカード1枚を獲得する。' },
    nomads: { id: 'nomads', name: '遊牧民', cost: 4, types: ['action'],
                 text: '+1 購入、+2 コイン\nこれを獲得または廃棄したとき、+2 コイン。' },
    trail: { id: 'trail', name: '小道', cost: 4, types: ['action', 'reaction'],
                 text: '+1 カード、+1 アクション\n（リアクション）クリーンアップ以外でこれを獲得・廃棄・捨て札にしたとき、これを使ってよい。' },
    weaver: { id: 'weaver', name: '織工', cost: 4, types: ['action', 'reaction'],
                 text: '銀貨2枚、またはコスト4以下のカード1枚を獲得する。\n（リアクション）クリーンアップ以外でこれを捨て札にしたとき、これを使ってよい。' },
    souk: { id: 'souk', name: 'スーク', cost: 5, types: ['action'],
                 text: '+1 購入、+7 コイン\n手札1枚につき -1 コイン（$0未満にはならない）。\nこれを獲得したとき、手札から最大2枚を廃棄する。' },
    cauldron: { id: 'cauldron', name: '大釜', cost: 5, types: ['treasure', 'attack'], coin: 2,
                 text: '+2 コイン、+1 購入\nこのターンに3回目のアクションカードを獲得したとき、他のプレイヤーは各自、呪い1枚を獲得する。' },
    guard_dog: { id: 'guard_dog', name: '番犬', cost: 3, types: ['action', 'reaction'],
                 text: '+2 カード\n手札が5枚以下なら、さらに +2 カード。\n（リアクション）他のプレイヤーがアタックを使ったとき、これを手札から先に使ってよい。' },
    berserker: { id: 'berserker', name: '狂戦士', cost: 5, types: ['action', 'attack'],
                 text: 'このカードよりコストの低いカード1枚を獲得する。\n他のプレイヤーは各自、手札が3枚になるまで捨てる。\nこれを獲得したとき、場にアクションカードがあれば、これを使う。' },
    wheelwright: { id: 'wheelwright', name: '車大工', cost: 5, types: ['action'],
                 text: '+1 カード、+1 アクション\n手札1枚を捨ててよい。捨てたなら、そのコスト以下のアクションカード1枚を獲得する。' },
    witchs_hut: { id: 'witchs_hut', name: '魔女の小屋', cost: 5, types: ['action', 'attack'],
                 text: '+4 カード\n手札2枚を公開して捨てる。それが両方アクションカードなら、他のプレイヤーは各自、呪い1枚を獲得する。' },
    poor_house: { id: 'poor_house', name: '救貧院', cost: 1, types: ['action'],
                 text: '+4 コイン\n手札を公開する。\n手札の財宝1枚につき −1 コイン（コインは0未満にはならない）。' },
    squire: { id: 'squire', name: '従者', cost: 2, types: ['action'],
                 text: '+1 コイン\n以下から1つ選ぶ：+2 アクション／+2 購入／銀貨1枚を獲得。\nこれを廃棄したとき、アタックカード1枚を獲得する。' },
    vagrant: { id: 'vagrant', name: '放浪者', cost: 2, types: ['action'],
                 text: '+1 カード\n+1 アクション\n山札の一番上を公開する。それが呪い・廃墟・避難所・勝利点カードなら手札に加える。' },
    beggar: { id: 'beggar', name: '物乞い', cost: 2, types: ['action', 'reaction'],
                 text: '銅貨3枚を獲得し、手札に加える。\n（リアクション）他人がアタックカードをプレイしたとき、先にこれを捨て札にして銀貨2枚を獲得できる（うち1枚は山札の上に置く）。' },
    hermit: { id: 'hermit', name: '隠遁者', cost: 3, types: ['action'],
                 text: '捨て札置き場を見る。そこか手札から財宝以外のカード1枚を廃棄してよい。\nコスト3以下のカードを1枚獲得する。\nこのターンの購入フェイズ終了時、そのフェイズ中にカードを1枚も獲得していなければ、これを狂人1枚と交換する。' },
    sage: { id: 'sage', name: '賢者', cost: 3, types: ['action'],
                 text: '+1 アクション\nコスト3以上のカードが出るまで山札の一番上を公開し続ける。そのカードを手札に加え、残りを捨て札にする。' },
    forager: { id: 'forager', name: '探索者', cost: 3, types: ['action'],
                 text: '+1 アクション\n+1 購入\n手札1枚を廃棄する。\n廃棄置き場にある異なる名前の財宝1種につき +1 コイン。' },
    storeroom: { id: 'storeroom', name: '物置', cost: 3, types: ['action'],
                 text: '+1 購入\n手札を好きな枚数捨て、同じ枚数引く。\nその後、手札を好きな枚数捨て、1枚につき +1 コイン。' },
    urchin: { id: 'urchin', name: '浮浪児', cost: 3, types: ['action', 'attack'],
                 text: '+1 カード\n+1 アクション\n他のプレイヤーは各自、手札が4枚になるまで捨てる。\nこれが場にあるとき別のアタックカードをプレイしたら、先にこれを廃棄して傭兵1枚を獲得してよい。' },
    market_square: { id: 'market_square', name: '青空市場', cost: 3, types: ['action', 'reaction'],
                 text: '+1 カード\n+1 アクション\n+1 購入\n（リアクション）自分のカードが廃棄されたとき、これを手札から捨て札にして金貨1枚を獲得できる。' },
    ironmonger: { id: 'ironmonger', name: '金物商', cost: 4, types: ['action'],
                 text: '+1 カード\n+1 アクション\n山札の一番上を公開する。捨ててもよい。\nそれがアクションなら +1 アクション、財宝なら +1 コイン、勝利点なら +1 カード。' },
    wandering_minstrel: { id: 'wandering_minstrel', name: '旅の楽団', cost: 4, types: ['action'],
                 text: '+1 カード\n+2 アクション\n山札の上から3枚を公開する。アクションカードを好きな順で山札の上に戻し、残りを捨て札にする。' },
    procession: { id: 'procession', name: '行進', cost: 4, types: ['action'],
                 text: '手札の持続でないアクションカード1枚を2回プレイしてよい。\nその後それを廃棄し、それよりコストがちょうど $1 多いアクションカード1枚を獲得する。' },
    scavenger: { id: 'scavenger', name: '拾い屋', cost: 4, types: ['action'],
                 text: '+2 コイン\n自分の山札を捨て札にしてもよい。\n捨て札置き場を見て、その中の1枚を山札の上に置く。' },
    fortress: { id: 'fortress', name: '城塞', cost: 4, types: ['action'],
                 text: '+1 カード\n+2 アクション\nこれを廃棄したとき、これを手札に加える。' },
    rats: { id: 'rats', name: 'ネズミ', cost: 4, types: ['action'],
                 text: '+1 カード\n+1 アクション\nネズミ1枚を獲得する。\n手札のネズミ以外のカード1枚を廃棄する（手札がすべてネズミなら手札を公開する）。\n————\nこれを廃棄したとき、+1 カード。' },
    armory: { id: 'armory', name: '武器庫', cost: 4, types: ['action'],
                 text: 'コスト4以下のカード1枚を獲得し、山札の上に置く。' },
    death_cart: { id: 'death_cart', name: '死の荷車', cost: 4, types: ['action', 'looter'],
                 text: 'これか手札のアクションカード1枚を廃棄してもよい。廃棄したなら +5 コイン。\n————\nこれを獲得したとき、廃墟2枚を獲得する。' },
    marauder: { id: 'marauder', name: '略奪者', cost: 4, types: ['action', 'attack', 'looter'],
                 text: '戦利品置き場から戦利品1枚を獲得する。\n他のプレイヤーは各自、廃墟1枚を獲得する。' },
    feodum: { id: 'feodum', name: '封土', cost: 4, types: ['victory'],
                 text: '（勝利点）\n所持している銀貨3枚につき 1 勝利点（端数切り捨て）。\nこれを廃棄したとき、銀貨3枚を獲得する。' },

    // ===== ギルド（Guilds・段階1: 画像/カタログのみ）=====
    candlestick_maker: { id: 'candlestick_maker', name: '蝋燭職人', cost: 2, types: ['action'],
                 text: '+1 アクション\n+1 購入\n+1 財源' },
    stonemason: { id: 'stonemason', name: '石工', cost: 2, types: ['action'],
                 text: '手札からカード1枚を廃棄する。それよりコストの低いカードを2枚獲得する。\n————\nこれを購入する際、追加で支払ってよい。そうしたら、追加で支払った分のコストのアクションカードを2枚獲得する。' },
    doctor: { id: 'doctor', name: '医者', cost: 3, types: ['action'],
                 text: 'カード1枚を指定する。デッキの上から3枚を公開し、指定したものと同じカードをすべて廃棄する。残りを好きな順でデッキの上に戻す。\n————\nこれを購入する際、追加で支払ってよい。追加で支払った1コインにつき、デッキの一番上のカードを見て、それを廃棄するか、捨て札にするか、デッキの上に戻す。' },
    masterpiece: { id: 'masterpiece', name: '名品', cost: 3, types: ['treasure'], coin: 1,
                 text: '1 コイン\n————\nこれを購入する際、追加で支払ってよい。追加で支払った1コインにつき、銀貨1枚を獲得する。' },
    advisor: { id: 'advisor', name: '助言者', cost: 4, types: ['action'],
                 text: '+1 アクション\nデッキの上から3枚を公開する。左隣のプレイヤーがそのうち1枚を選ぶ。それを捨て札にし、残りを手札に加える。' },
    plaza: { id: 'plaza', name: '広場', cost: 4, types: ['action'],
                 text: '+1 カード\n+2 アクション\n財宝カード1枚を捨て札にしてよい。そうしたら、+1 財源。' },
    taxman: { id: 'taxman', name: '収税吏', cost: 4, types: ['action', 'attack'],
                 text: '手札から財宝カード1枚を廃棄してよい。そうしたら、手札が5枚以上の他のプレイヤーは各自、それと同じ財宝を1枚捨て札にする（持っていなければ手札を公開する）。廃棄した財宝よりコストが最大3コイン高い財宝カード1枚を獲得し、デッキの上に置く。' },
    herald: { id: 'herald', name: '伝令官', cost: 4, types: ['action'],
                 text: '+1 カード\n+1 アクション\nデッキの一番上のカードを公開する。それがアクションカードなら、それをプレイする。\n————\nこれを購入する際、追加で支払ってよい。追加で支払った1コインにつき、捨て札置き場を見て、その中のカード1枚をデッキの上に置く。' },
    baker: { id: 'baker', name: 'パン屋', cost: 5, types: ['action'],
                 text: '+1 カード\n+1 アクション\n+1 財源\n————\nゲーム開始時、各プレイヤーは財源1枚を得る。' },
    butcher: { id: 'butcher', name: '肉屋', cost: 5, types: ['action'],
                 text: '+2 財源\n手札からカード1枚を廃棄してよい。そうしたら、財源を好きな枚数支払い、廃棄したカードのコストに支払った財源の枚数を加えたコスト以下のカード1枚を獲得する。' },
    journeyman: { id: 'journeyman', name: '熟練工', cost: 5, types: ['action'],
                 text: 'カード1枚を指定する。指定したカード以外のカードを3枚公開するまで、デッキの上からカードを公開する。公開したその3枚を手札に加え、残りを捨て札にする。' },
    merchant_guild: { id: 'merchant_guild', name: '商人ギルド', cost: 5, types: ['action'],
                 text: '+1 購入\n+1 コイン\nこれが場に出ている間、あなたがカードを購入するたびに、+1 財源。' },
    soothsayer: { id: 'soothsayer', name: '予言者', cost: 5, types: ['action', 'attack'],
                 text: '金貨1枚を獲得する。\n他のプレイヤーは各自、呪い1枚を獲得する。獲得したなら、カードを1枚引く。' },

    // ===== 暗黒時代（Dark Ages・残り王国＋騎士の山・段階1）=====
    junk_dealer: { id: 'junk_dealer', name: '屑屋', cost: 5, types: ['action'],
                 text: '+1 カード\n+1 アクション\n+1 コイン\n手札のカード1枚を廃棄する。' },
    bandit_camp: { id: 'bandit_camp', name: '山賊の宿営地', cost: 5, types: ['action'],
                 text: '+1 カード\n+2 アクション\n戦利品置き場から戦利品1枚を獲得する。' },
    rebuild: { id: 'rebuild', name: '建て直し', cost: 5, types: ['action'],
                 text: '+1 アクション\nカード名を1つ指定する。指定したカード以外の勝利点カードが出るまで、自分の山札の上からカードを公開する。\n公開した他のカードを捨て札にし、その勝利点カードを廃棄する。\nそのコストより $3 多いコストまでの勝利点カード1枚を獲得する。' },
    catacombs: { id: 'catacombs', name: '地下墓所', cost: 5, types: ['action'],
                 text: '自分の山札の上から3枚を見る。次から1つを選ぶ：\nそれらを手札に加える／それらを捨て札にし +3 カード。\nこれを廃棄したとき、これよりコストの低いカード1枚を獲得する。' },
    graverobber: { id: 'graverobber', name: '墓暴き', cost: 5, types: ['action'],
                 text: '次から1つを選ぶ：\n廃棄置き場からコスト3～6のカード1枚を獲得し、山札の一番上に置く／手札のアクションカード1枚を廃棄し、そのコストより $3 多いコストまでのカード1枚を獲得する。' },
    count: { id: 'count', name: '伯爵', cost: 5, types: ['action'],
                 text: '次から1つを選ぶ：\n手札のカード2枚を捨て札にする／手札のカード1枚を山札の一番上に置く／銅貨1枚を獲得する。\nその後、次から1つを選ぶ：\n+3 コイン／手札をすべて廃棄する／公領1枚を獲得する。' },
    band_of_misfits: { id: 'band_of_misfits', name: 'はみだし者', cost: 5, types: ['action', 'command'],
                 text: 'サプライにある、これよりコストの低い、命令ではないアクションカード1枚を、サプライに置いたまま使用する。' },
    mystic: { id: 'mystic', name: '秘術師', cost: 5, types: ['action'],
                 text: '+1 アクション\n+2 コイン\nカード名を1つ宣言し、自分の山札の一番上を公開する。\nそれが宣言したカードなら手札に加える。' },
    rogue: { id: 'rogue', name: '盗賊', cost: 5, types: ['action', 'attack'],
                 text: '+2 コイン\n廃棄置き場にコスト3～6のカードがあれば、その中から1枚を獲得する。\n無ければ、他のプレイヤーは各自、自分の山札の上から2枚を公開し、その中のコスト3～6のカード1枚を廃棄し、残りを捨て札にする。' },
    pillage: { id: 'pillage', name: '略奪', cost: 5, types: ['action', 'attack'],
                 text: 'これを廃棄する。そうしたら、戦利品置き場から戦利品2枚を獲得し、手札が5枚以上の他のプレイヤーは各自、手札を公開し、あなたが選んだカード1枚を捨て札にする。' },
    cultist: { id: 'cultist', name: '狂信者', cost: 5, types: ['action', 'attack', 'looter'],
                 text: '+2 カード\n他のプレイヤーは各自、廃墟1枚を獲得する。\n手札の狂信者1枚を使用してよい。\nこれを廃棄したとき、+3 カード。' },
    counterfeit: { id: 'counterfeit', name: '偽造通貨', cost: 5, types: ['treasure'], coin: 1,
                 text: '1 コイン\n+1 購入\nこれを使用したとき、手札の持続でない財宝カード1枚を2回使用してよい。そうしたら、その財宝を廃棄する。' },
    hunting_grounds: { id: 'hunting_grounds', name: '狩場', cost: 6, types: ['action'],
                 text: '+4 カード\nこれを廃棄したとき、公領1枚または屋敷3枚を獲得する。' },
    altar: { id: 'altar', name: '祭壇', cost: 6, types: ['action'],
                 text: '手札のカード1枚を廃棄する。\nコスト5以下のカード1枚を獲得する。' },
    knights: { id: 'knights', name: '騎士', cost: 5, types: ['action', 'attack', 'knight'],
                 text: '（騎士の山）\n10種類の騎士（デイム/サー）を混ぜてシャッフルし、一番上の1枚だけ購入・獲得できる。' },

    // ===== 騎士10種（Knights・混合山の中身・段階1）=====
    dame_anna: { id: 'dame_anna', name: 'デイム・アンナ', cost: 5, types: ['action', 'attack', 'knight'],
                 text: '手札からカードを2枚まで廃棄してもよい。\n他のプレイヤーは全員、自分の山札の上からカードを2枚公開し、その中からコスト3～6のカード1枚を廃棄し、残りを捨て札にする。これにより騎士が廃棄された場合、このカードを廃棄する。' },
    dame_josephine: { id: 'dame_josephine', name: 'デイム・ジョセフィーヌ', cost: 5, types: ['action', 'attack', 'knight', 'victory'], vp: 2,
                 text: '他のプレイヤーは全員、自分の山札の上からカードを2枚公開し、その中からコスト3～6のカード1枚を廃棄し、残りを捨て札にする。これにより騎士が廃棄された場合、このカードを廃棄する。\n————\n2 勝利点' },
    dame_molly: { id: 'dame_molly', name: 'デイム・モリー', cost: 5, types: ['action', 'attack', 'knight'],
                 text: '+2 アクション\n他のプレイヤーは全員、自分の山札の上からカードを2枚公開し、その中からコスト3～6のカード1枚を廃棄し、残りを捨て札にする。これにより騎士が廃棄された場合、このカードを廃棄する。' },
    dame_natalie: { id: 'dame_natalie', name: 'デイム・ナタリー', cost: 5, types: ['action', 'attack', 'knight'],
                 text: 'コスト3以下のカード1枚を獲得してもよい。\n他のプレイヤーは全員、自分の山札の上からカードを2枚公開し、その中からコスト3～6のカード1枚を廃棄し、残りを捨て札にする。これにより騎士が廃棄された場合、このカードを廃棄する。' },
    dame_sylvia: { id: 'dame_sylvia', name: 'デイム・シルビア', cost: 5, types: ['action', 'attack', 'knight'],
                 text: '+2 コイン\n他のプレイヤーは全員、自分の山札の上からカードを2枚公開し、その中からコスト3～6のカード1枚を廃棄し、残りを捨て札にする。これにより騎士が廃棄された場合、このカードを廃棄する。' },
    sir_bailey: { id: 'sir_bailey', name: 'サー・ベイリー', cost: 5, types: ['action', 'attack', 'knight'],
                 text: '+1 カード\n+1 アクション\n他のプレイヤーは全員、自分の山札の上からカードを2枚公開し、その中からコスト3～6のカード1枚を廃棄し、残りを捨て札にする。これにより騎士が廃棄された場合、このカードを廃棄する。' },
    sir_destry: { id: 'sir_destry', name: 'サー・デストリー', cost: 5, types: ['action', 'attack', 'knight'],
                 text: '+2 カード\n他のプレイヤーは全員、自分の山札の上からカードを2枚公開し、その中からコスト3～6のカード1枚を廃棄し、残りを捨て札にする。これにより騎士が廃棄された場合、このカードを廃棄する。' },
    sir_martin: { id: 'sir_martin', name: 'サー・マーティン', cost: 4, types: ['action', 'attack', 'knight'],
                 text: '+2 購入\n他のプレイヤーは全員、自分の山札の上からカードを2枚公開し、その中からコスト3～6のカード1枚を廃棄し、残りを捨て札にする。これにより騎士が廃棄された場合、このカードを廃棄する。' },
    sir_michael: { id: 'sir_michael', name: 'サー・マイケル', cost: 5, types: ['action', 'attack', 'knight'],
                 text: '他のプレイヤーは全員、手札が3枚になるように捨て札にする。\n他のプレイヤーは全員、自分の山札の上からカードを2枚公開し、その中からコスト3～6のカード1枚を廃棄し、残りを捨て札にする。これにより騎士が廃棄された場合、このカードを廃棄する。' },
    sir_vander: { id: 'sir_vander', name: 'サー・ヴァンダー', cost: 5, types: ['action', 'attack', 'knight'],
                 text: '他のプレイヤーは全員、自分の山札の上からカードを2枚公開し、その中からコスト3～6のカード1枚を廃棄し、残りを捨て札にする。これにより騎士が廃棄された場合、このカードを廃棄する。\n————\nサー・ヴァンダーが廃棄されたとき、金貨1枚を獲得する。' },

    // ===== 廃墟5種（Ruins・段階1）=====
    abandoned_mine: { id: 'abandoned_mine', name: '廃坑', cost: 0, types: ['action', 'ruins'],
                 text: '+1 コイン' },
    ruined_library: { id: 'ruined_library', name: '図書館跡地', cost: 0, types: ['action', 'ruins'],
                 text: '+1 カード' },
    ruined_market: { id: 'ruined_market', name: '市場跡地', cost: 0, types: ['action', 'ruins'],
                 text: '+1 購入' },
    ruined_village: { id: 'ruined_village', name: '廃村', cost: 0, types: ['action', 'ruins'],
                 text: '+1 アクション' },
    survivors: { id: 'survivors', name: '生存者', cost: 0, types: ['action', 'ruins'],
                 text: 'あなたのデッキの一番上のカード2枚を見る。それらを捨て札にするか、好きな順番でデッキの上に戻す。' },

    // ===== 避難所3種（Shelters・段階1）=====
    hovel: { id: 'hovel', name: '納屋', cost: 1, types: ['reaction', 'shelter'],
                 text: '勝利点カードを獲得したとき、手札からこのカードを廃棄してよい。' },
    necropolis: { id: 'necropolis', name: '共同墓地', cost: 1, types: ['action', 'shelter'],
                 text: '+2 アクション' },
    overgrown_estate: { id: 'overgrown_estate', name: '草茂る屋敷', cost: 1, types: ['victory', 'shelter'],
                 text: '0 勝利点\n————\nこのカードを廃棄したとき、+1 カードを引く。' },

    // ===== 非サプライ（戦利品/狂人/傭兵・段階1）=====
    spoils: { id: 'spoils', name: '戦利品', cost: 0, types: ['treasure'], coin: 3,
                 text: '3 コイン\nこれを使用したとき、このカードを戦利品置き場に戻す。' },
    madman: { id: 'madman', name: '狂人', cost: 0, types: ['action'],
                 text: '+2 アクション\nこのカードを狂人置き場に戻す。そうしたら、あなたの手札1枚につき +1 カード。' },
    mercenary: { id: 'mercenary', name: '傭兵', cost: 0, types: ['action', 'attack'],
                 text: '手札からカード2枚を廃棄してよい。そうしたら、+2 カード、+2 コイン、他のプレイヤーは各自、手札が3枚になるように捨て札にする。' },
    /* ===== 冒険（Adventures）＝段階1（画像・カタログのみ。CARD_SETS 未参照＝実サプライに出ない）===== */
    coin_of_the_realm: { id: 'coin_of_the_realm', name: '法貨', cost: 2, types: ['treasure', 'reserve'], coin: 1,
                 text: '+$1\nこれをプレイしたら酒場マットに置く。\nアクションを解決した直後、これを呼び出して +2 アクションできる。' },
    page: { id: 'page', name: '騎士見習い', cost: 2, types: ['action', 'traveller'],
                 text: '+1 カード\n+1 アクション\nこれを場から捨てる時、トレジャーハンターと交換してよい。' },
    peasant: { id: 'peasant', name: '農民', cost: 2, types: ['action', 'traveller'],
                 text: '+1 購入\n+$1\nこれを場から捨てる時、兵士と交換してよい。' },
    ratcatcher: { id: 'ratcatcher', name: '鼠取り', cost: 2, types: ['action', 'reserve'],
                 text: '+1 カード\n+1 アクション\nこれを酒場マットに置く。\n自分のターン開始時、これを呼び出して手札1枚を廃棄してよい。' },
    raze: { id: 'raze', name: '倒壊', cost: 2, types: ['action'],
                 text: '+1 アクション\nこれか手札1枚を廃棄する。\n廃棄したカードのコインコスト分だけ山札の上を見て、1枚を手札に加え、残りを捨て札にする。' },
    amulet: { id: 'amulet', name: '魔除け', cost: 3, types: ['action', 'duration'],
                 text: '今と次のターン開始時にそれぞれ、以下から1つ選ぶ：\n+$1／手札1枚を廃棄／銀貨1枚を獲得。' },
    caravan_guard: { id: 'caravan_guard', name: '隊商の護衛', cost: 3, types: ['action', 'duration', 'reaction'],
                 text: '+1 カード\n+1 アクション\n次のターン開始時、+$1。\n他のプレイヤーがアタックカードをプレイした時、これを手札からプレイしてよい。（リアクション）' },
    dungeon: { id: 'dungeon', name: '地下牢', cost: 3, types: ['action', 'duration'],
                 text: '+1 アクション\n今と次のターン開始時にそれぞれ：+2 カードの後、手札2枚を捨てる。' },
    gear: { id: 'gear', name: '道具', cost: 3, types: ['action', 'duration'],
                 text: '+2 カード\n手札から最大2枚を裏向きに脇に置く。\n次のターン開始時、それらを手札に戻す。' },
    guide: { id: 'guide', name: '案内人', cost: 3, types: ['action', 'reserve'],
                 text: '+1 カード\n+1 アクション\nこれを酒場マットに置く。\n自分のターン開始時、これを呼び出して手札を全て捨て、5枚引いてよい。' },
    duplicate: { id: 'duplicate', name: '複製', cost: 4, types: ['action', 'reserve'],
                 text: 'これを酒場マットに置く。\nコスト$6以下のカードを獲得した時、これを呼び出してそのカードのコピーを獲得してよい。' },
    magpie: { id: 'magpie', name: 'カササギ', cost: 4, types: ['action'],
                 text: '+1 カード\n+1 アクション\n山札の一番上を公開する。\n財宝ならそれを手札に加える。\nアクションか勝利点なら、カササギ1枚を獲得する。' },
    messenger: { id: 'messenger', name: '使者', cost: 4, types: ['action'],
                 text: '+1 購入\n+$2\n自分の山札を捨て札にしてよい。\nこれがそのターン最初の購入の時、コスト$4以下のカード1枚を獲得し、他の各プレイヤーもそのコピーを獲得する。' },
    miser: { id: 'miser', name: '守銭奴', cost: 4, types: ['action'],
                 text: '以下から1つ選ぶ：\n手札の銅貨1枚を酒場マットに置く／酒場マットの銅貨1枚につき +$1。' },
    port: { id: 'port', name: '港町', cost: 4, types: ['action'],
                 text: '+1 カード\n+2 アクション\nこれを購入した時、もう1枚の港町を獲得する。' },
    ranger: { id: 'ranger', name: '山守', cost: 4, types: ['action'],
                 text: '+1 購入\n旅トークンを裏返す（表向きから始まる）。\nその後、表向きなら +5 カード。' },
    transmogrify: { id: 'transmogrify', name: '変容', cost: 4, types: ['action', 'reserve'],
                 text: '+1 アクション\nこれを酒場マットに置く。\n自分のターン開始時、これを呼び出して手札1枚を廃棄し、そのコスト+$1以下のカード1枚を手札に獲得してよい。' },
    artificer: { id: 'artificer', name: '工匠', cost: 5, types: ['action'],
                 text: '+1 カード\n+1 アクション\n+$1\n手札を好きな枚数捨てる。\n捨てた枚数と同じコインコストちょうどのカード1枚を山札の上に獲得してよい。' },
    bridge_troll: { id: 'bridge_troll', name: '橋の下のトロル', cost: 5, types: ['action', 'attack', 'duration'],
                 text: '他の各プレイヤーは -$1 トークンを受け取る。\n今と次のターン開始時にそれぞれ：+1 購入。\nこのターンと次のターン、カードのコストは$1安くなる。' },
    distant_lands: { id: 'distant_lands', name: '遠隔地', cost: 5, types: ['action', 'reserve', 'victory'],
                 text: 'これを酒場マットに置く。\nゲーム終了時に酒場マットにあれば4勝利点（そうでなければ0）。' },
    giant: { id: 'giant', name: '巨人', cost: 5, types: ['action', 'attack'],
                 text: '旅トークンを裏返す（表向きから始まる）。\n裏向きになったら +$1。\n表向きなら +$5、他の各プレイヤーは山札の一番上を公開し、コスト$3〜$6ならそれを廃棄、そうでなければ捨てて呪い1枚を獲得する。' },
    haunted_woods: { id: 'haunted_woods', name: '呪いの森', cost: 5, types: ['action', 'attack', 'duration'],
                 text: '次の自分のターンまで、他のプレイヤーがカードを購入した時、その手札を全て山札の上に置く。\n次のターン開始時：+3 カード。' },
    lost_city: { id: 'lost_city', name: '失われし都市', cost: 5, types: ['action'],
                 text: '+2 カード\n+2 アクション\nこれを獲得した時、他の各プレイヤーはカードを1枚引く。' },
    relic: { id: 'relic', name: '遺物', cost: 5, types: ['treasure', 'attack'], coin: 2,
                 text: '+$2\n他の各プレイヤーは -1 カードトークンを受け取る（次に引く手札が1枚少なくなる）。' },
    royal_carriage: { id: 'royal_carriage', name: '御料車', cost: 5, types: ['action', 'reserve'],
                 text: '+1 アクション\nこれを酒場マットに置く。\nアクションのプレイを終えた時、それがまだ場にあれば、これを呼び出してそのアクションを再度プレイしてよい。' },
    storyteller: { id: 'storyteller', name: '語り部', cost: 5, types: ['action'],
                 text: '+1 アクション\n手札から最大3枚の財宝をプレイする。\nその後、+1 カード。さらに所持コイン$1につき +1 カード（所持コインは全て使い切る）。' },
    swamp_hag: { id: 'swamp_hag', name: '沼の妖婆', cost: 5, types: ['action', 'attack', 'duration'],
                 text: '次の自分のターンまで、他のプレイヤーがカードを購入した時、呪い1枚を獲得する。\n次のターン開始時：+$3。' },
    treasure_trove: { id: 'treasure_trove', name: '掘出物', cost: 5, types: ['treasure'], coin: 2,
                 text: '+$2\nこれをプレイした時、金貨1枚と銅貨1枚を獲得する。' },
    wine_merchant: { id: 'wine_merchant', name: 'ワイン商', cost: 5, types: ['action', 'reserve'],
                 text: '+1 購入\n+$4\nこれを酒場マットに置く。\n購入フェイズ終了時、未使用の$2以上が残っていれば、これを酒場マットから捨ててよい。' },
    hireling: { id: 'hireling', name: '雇人', cost: 6, types: ['action', 'duration'],
                 text: 'ゲーム終了までの自分の各ターン開始時：+1 カード。' },
    treasure_hunter: { id: 'treasure_hunter', name: 'トレジャーハンター', cost: 3, types: ['action', 'traveller'],
                 text: '+1 アクション\n+1 コイン\n右隣のプレイヤーが直前のターンに獲得したカード1枚につき、銀貨1枚を獲得する。\n（場から捨てるときウォリアーと交換してよい。サプライには置かない。）' },
    warrior: { id: 'warrior', name: 'ウォリアー', cost: 4, types: ['action', 'attack', 'traveller'],
                 text: '+2 カード\nあなたが場に出しているトラベラー（このカードを含む）1枚につき、他のプレイヤーは全員自分の山札の一番上のカードを捨て、そのコストが3か4なら廃棄する。\n（場から捨てるときヒーローと交換してよい。サプライには置かない。）' },
    hero: { id: 'hero', name: 'ヒーロー', cost: 5, types: ['action', 'traveller'],
                 text: '+2 コイン\n財宝カード1枚を獲得する。\n（場から捨てるときチャンピオンと交換してよい。サプライには置かない。）' },
    champion: { id: 'champion', name: 'チャンピオン', cost: 6, types: ['action', 'duration'],
                 text: '+1 アクション\nゲーム終了時まで：他のプレイヤーがアタックカードを使用してもあなたは影響を受けない。あなたがアクションカードを使用するたびに +1 アクション。\n（このカードは場に残り続ける。サプライには置かない。）' },
    soldier: { id: 'soldier', name: '兵士', cost: 3, types: ['action', 'attack', 'traveller'],
                 text: '+2 コイン\nあなたが場に出している他のアタックカード1枚につき +1 コイン\n手札が4枚以上の他のプレイヤーは全員、カード1枚を捨てる。\n（場から捨てるとき脱走兵と交換してよい。サプライには置かない。）' },
    fugitive: { id: 'fugitive', name: '脱走兵', cost: 4, types: ['action', 'traveller'],
                 text: '+2 カード\n+1 アクション\nカード1枚を捨てる。\n（場から捨てるとき門下生と交換してよい。サプライには置かない。）' },
    disciple: { id: 'disciple', name: '門下生', cost: 5, types: ['action', 'traveller'],
                 text: '手札のアクションカード1枚を2度使用してもよい。\nそれと同じカード1枚を獲得する。\n（場から捨てるとき教師と交換してよい。サプライには置かない。）' },
    teacher: { id: 'teacher', name: '教師', cost: 6, types: ['action', 'reserve'],
                 text: 'このカードを酒場マットの上に置く。\nあなたのターン開始時、このカードを呼び出し、+1カード／+1アクション／+1購入／+1コインのいずれかのトークンを、あなたのトークンが無いアクションのサプライ山の上に置いてもよい。\n（サプライには置かない。）' },
    /* ===== 帝国（Empires）＝段階1（画像・カタログのみ）===== */
    engineer: { id: 'engineer', name: '技術者', cost: 0, debt: 4, types: ['action'],
                 text: 'コスト4以下のカードを1枚獲得する。\nこれを廃棄してもよい。廃棄したら、コスト4以下のカードをもう1枚獲得する。' },
    city_quarter: { id: 'city_quarter', name: '市街', cost: 0, debt: 8, types: ['action'],
                 text: '+2 アクション\n手札を公開し、公開したアクションカード1枚につき +1 カード。' },
    overlord: { id: 'overlord', name: '大君主', cost: 0, debt: 8, types: ['action', 'command'],
                 text: 'サプライにあるコスト5以下のアクションカード（命令カード以外）1枚を、そのカードとしてプレイする。\n（そのカードはサプライに残す）' },
    royal_blacksmith: { id: 'royal_blacksmith', name: '王室の鍛冶屋', cost: 0, debt: 8, types: ['action'],
                 text: '+5 カード\n手札を公開し、銅貨をすべて捨てる。' },
    farmers_market: { id: 'farmers_market', name: '農家の市場', cost: 3, types: ['action'],
                 text: '+1 購入\nこのサプライ上に勝利点トークンが4個以上あるなら、それらをすべて得てこれを廃棄する。\nそうでなければ、このサプライに勝利点トークン1個を置き、その後このサプライ上の勝利点トークン1個につき +1 コイン。' },
    chariot_race: { id: 'chariot_race', name: '戦車競走', cost: 3, types: ['action'],
                 text: '+1 アクション\n山札の一番上を公開して手札に加える。左隣のプレイヤーも山札の一番上を公開する。\nあなたのカードのコストが高ければ、+1 コイン と 勝利点トークン1個。' },
    enchantress: { id: 'enchantress', name: '女魔術師', cost: 3, types: ['action', 'attack', 'duration'],
                 text: 'あなたの次の手番まで、他の各プレイヤーがその手番で最初にプレイするアクションカードは、記載の効果の代わりに +1 カード +1 アクション となる。\n次の自分の手番開始時: +2 カード' },
    sacrifice: { id: 'sacrifice', name: '生贄', cost: 4, types: ['action'],
                 text: '手札1枚を廃棄する。廃棄したカードが\nアクションなら +2 カード +2 アクション\n財宝なら +2 コイン\n勝利点なら 勝利点トークン2個\n（複数の種別を持つ場合はすべて適用）' },
    temple: { id: 'temple', name: '神殿', cost: 4, types: ['action'],
                 text: '勝利点トークン1個を得る。\n手札から名前の異なるカードを1〜3枚廃棄する。\nこのサプライに勝利点トークン1個を置く。\n（獲得時: このサプライ上の勝利点トークンをすべて得る）' },
    villa: { id: 'villa', name: 'ヴィラ', cost: 4, types: ['action'],
                 text: '+2 アクション\n+1 購入\n+1 コイン\n（獲得時: これを手札に加えて +1 アクション。購入フェイズ中なら、アクションフェイズに戻る）' },
    archive: { id: 'archive', name: '資料庫', cost: 5, types: ['action', 'duration'],
                 text: '+1 アクション\n山札の上から3枚を裏向きに脇へ置く。\n今回と次の2回の自分の手番開始時に、脇のカードを見て1枚を手札に加える。' },
    capital: { id: 'capital', name: '元手', cost: 5, types: ['treasure'], coin: 6,
                 text: '+6 コイン\n+1 購入\nこれを場から捨て札にするとき、負債6を得て、可能な限り返済する。' },
    charm: { id: 'charm', name: '御守り', cost: 5, types: ['treasure'],
                 text: '以下から1つを選ぶ:\n・+1 購入 と +2 コイン\n・このターン、次にカードを獲得したとき、それと同じコストで名前の異なるカードを1枚獲得してもよい。' },
    forum: { id: 'forum', name: '公共広場', cost: 5, types: ['action'],
                 text: '+3 カード\n+1 アクション\n手札を2枚捨てる。\n（獲得時: +1 購入）' },
    groundskeeper: { id: 'groundskeeper', name: '庭師', cost: 5, types: ['action'],
                 text: '+1 カード\n+1 アクション\nこれが場にある間、勝利点カードを1枚獲得するたびに 勝利点トークン1個。' },
    legionary: { id: 'legionary', name: '軍団兵', cost: 5, types: ['action', 'attack'],
                 text: '+3 コイン\n手札の金貨1枚を公開してもよい。公開したら、他の各プレイヤーは手札が2枚になるまで捨て、その後カードを1枚引く。' },
    wild_hunt: { id: 'wild_hunt', name: 'ワイルドハント', cost: 5, types: ['action'],
                 text: '以下から1つを選ぶ:\n・+3 カード と このサプライに勝利点トークン1個を置く\n・屋敷を1枚獲得し、獲得したらこのサプライ上の勝利点トークンをすべて得る。' },
    crown: { id: 'crown', name: '冠', cost: 5, types: ['action', 'treasure'],
                 text: 'アクションフェイズなら、手札のアクションカード1枚を2回プレイしてよい。\n購入フェイズなら、手札の財宝カード1枚を2回プレイしてよい。' },
    encampment: { id: 'encampment', name: '陣地', cost: 2, types: ['action'],
                 text: '+2 カード\n+2 アクション\n手札から金貨か鹵獲品を公開してもよい。公開しない場合、これを脇に置き、クリーンアップフェイズ開始時にサプライに戻す。' },
    plunder: { id: 'plunder', name: '鹵獲品', cost: 5, types: ['treasure'],
                 text: '+2 コイン\n+1 勝利点' },
    patrician: { id: 'patrician', name: 'パトリキ', cost: 2, types: ['action'],
                 text: '+1 カード\n+1 アクション\nあなたの山札の一番上のカードを公開する。それのコストが5コイン以上の場合、それを手札に加える。' },
    emporium: { id: 'emporium', name: 'エンポリウム', cost: 5, types: ['action'],
                 text: '+1 カード\n+1 アクション\n+1 コイン\nこれを獲得したとき、あなたのプレイエリアにアクションカードが5枚以上ある場合、+2 勝利点。' },
    settlers: { id: 'settlers', name: '開拓者', cost: 2, types: ['action'],
                 text: '+1 カード\n+1 アクション\nあなたの捨て札置き場を見る。その中から銅貨1枚を公開して手札に加えてもよい。' },
    bustling_village: { id: 'bustling_village', name: '騒がしい村', cost: 5, types: ['action'],
                 text: '+1 カード\n+3 アクション\nあなたの捨て札置き場を見る。その中から開拓者1枚を公開して手札に加えてもよい。' },
    catapult: { id: 'catapult', name: '投石機', cost: 3, types: ['action', 'attack'],
                 text: '+1 コイン\n手札からカード1枚を廃棄する。それのコストが3コイン以上の場合、他のプレイヤー全員は呪いを1枚獲得する。それが財宝カードの場合、他のプレイヤー全員は手札が3枚になるまで捨て札にする。' },
    rocks: { id: 'rocks', name: '石', cost: 4, types: ['treasure'],
                 text: '+1 コイン\nこれを獲得または廃棄したとき、銀貨を1枚獲得する。あなたの購入フェイズ中ならそれを山札の上に置き、そうでなければ手札に加える。' },
    gladiator: { id: 'gladiator', name: '剣闘士', cost: 3, types: ['action'],
                 text: '+2 コイン\nあなたの手札からカード1枚を公開する。あなたの左隣のプレイヤーは手札から同じカードを公開してもよい。公開されなかった場合、+1 コイン、サプライから剣闘士1枚を廃棄する。' },
    fortune: { id: 'fortune', name: '大金', cost: 8, debt: 8, types: ['treasure'],
                 text: '+1 購入\nこのターンにまだ大金をプレイしていない場合、あなたのコインを2倍にする。\nこれを獲得したとき、あなたのプレイエリアにある剣闘士1枚につき金貨1枚を獲得する。' },
    humble_castle: { id: 'humble_castle', name: '粗末な城', cost: 3, types: ['treasure', 'victory', 'castle'],
                 text: '＋1 コイン\n（勝利点：所有する城1枚につき1点）' },
    crumbling_castle: { id: 'crumbling_castle', name: '崩れた城', cost: 4, types: ['victory', 'castle'], vp: 1,
                 text: '1 勝利点\nこのカードを獲得または廃棄したとき、+1 勝利点トークンを得て、銀貨1枚を獲得する。' },
    small_castle: { id: 'small_castle', name: '小さい城', cost: 5, types: ['action', 'victory', 'castle'], vp: 2,
                 text: '2 勝利点\nこのカードか手札の城1枚を廃棄する。そうした場合、城1枚を獲得する。' },
    haunted_castle: { id: 'haunted_castle', name: '幽霊城', cost: 6, types: ['victory', 'castle'], vp: 2,
                 text: '2 勝利点\n自分のターンにこのカードを獲得したとき、金貨1枚を獲得する。他のプレイヤーは全員、手札が5枚以上なら手札から2枚を山札の上に置く。' },
    opulent_castle: { id: 'opulent_castle', name: '華やかな城', cost: 7, types: ['action', 'victory', 'castle'], vp: 3,
                 text: '3 勝利点\n手札から任意の枚数の勝利点カードを公開して捨て札にする。捨てたカード1枚につき +2 コイン。' },
    sprawling_castle: { id: 'sprawling_castle', name: '広大な城', cost: 8, types: ['victory', 'castle'], vp: 4,
                 text: '4 勝利点\nこのカードを獲得したとき、公領1枚か屋敷3枚を獲得する。' },
    grand_castle: { id: 'grand_castle', name: '壮大な城', cost: 9, types: ['victory', 'castle'], vp: 5,
                 text: '5 勝利点\nこのカードを獲得したとき、手札を公開する。手札および場に出ている勝利点カード1枚につき +1 勝利点トークン。' },
    kings_castle: { id: 'kings_castle', name: '王城', cost: 10, types: ['victory', 'castle'],
                 text: '（勝利点：所有する城1枚につき2点）' },
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
  // 収穫祭 推奨10種。賞品山(馬上槍試合)・災いカード(若き魔女)・可変VP(品評会)・reveal系・アタックを味わえる構成。
  DOM.KINGDOM_CORNUCOPIA = ['hamlet', 'menagerie', 'farming_village', 'remake', 'young_witch',
                            'tournament', 'harvest', 'horn_of_plenty', 'jester', 'fairgrounds'];
  // ギルド 推奨10種。財源(Coffers)経済・過払い(overpay)・アタック2種・公開系・trash-to-gain を味わえる構成。
  //   財源札=蝋燭職人/パン屋/肉屋/商人ギルド、過払い=石工/医者/伝令官、アタック=収税吏/予言者、公開=助言者、
  //   セットアップ=パン屋(開始時 全員+1財源)、購入毎トリガー=商人ギルド。
  DOM.KINGDOM_GUILDS = ['candlestick_maker', 'stonemason', 'doctor', 'advisor', 'taxman',
                        'herald', 'baker', 'butcher', 'merchant_guild', 'soothsayer'];
  // 異郷 推奨10種。on-gain トリガー(国境の村/大使館系)・可変VP(絹の道)・on-discard リアクション(トンネル)・
  //   on-buy(値切り屋/農地)・獲得置換(交易商人は混成で登場)・アタック(辺境伯)・財宝リアクション(愚者の黄金) を味わえる構成。
  DOM.KINGDOM_HINTERLANDS = ['crossroads', 'fools_gold', 'develop', 'oasis', 'tunnel',
                             'jack_of_all_trades', 'silk_road', 'haggler', 'margrave', 'border_village'];
  // 暗黒時代 推奨10種＝公式「Grim Parade」（Dark Ages alone）。廃墟(狂信者=Looter)・騎士の混合山・
  //   命令(はみだし者)・on-trash(城塞/地下墓所/狩場)・避難所(このセットは常に避難所使用) を味わえる構成。
  DOM.KINGDOM_DARKAGES = ['armory', 'band_of_misfits', 'catacombs', 'cultist', 'forager',
                          'fortress', 'knights', 'market_square', 'procession', 'hunting_grounds'];
  // 冒険 推奨10種（自作＝公式の固定10種は無い）。トラベラー2系統(page→ウォリアー/チャンピオン・peasant→兵士/教師の山トークン)・
  //   Reserve/酒場マット(案内人)・旅トークン(山守)・持続の3択(魔除け)・持続＋リアクション(隊商の護衛)・
  //   相手の購入フック持続アタック(呪いの森)・強い村ドロー(失われし都市)・複雑系(工匠)・永続持続(雇人) を味わえる構成。
  DOM.KINGDOM_ADVENTURES = ['page', 'peasant', 'guide', 'ranger', 'amulet',
                            'caravan_guard', 'haunted_woods', 'lost_city', 'artificer', 'hireling'];
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
    promo: ['walled_village', 'envoy', 'governor', 'dismantle', 'black_market', 'hoard', 'stash', 'prince', 'captain', 'church', 'sauna', 'avanto'],
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
  // 収穫祭（実プレイ化＝段階2）。王国カード13種＝抽選母集団（「収穫祭セット」固定10種と「収穫祭から」ランダムが参照）。
  //   賞品（Prize）5種は王国カードではなく、馬上槍試合の専用山（各1枚・非サプライ）＝ POOLS.prizes に分離し、
  //   ランダム抽選に混ざらないようにする（賞品は購入もランダム選出もされない）。若き魔女の災いカード（Bane）は
  //   若き魔女が場にあるとき createInitialState が $2-3 の王国カードを1つ選んで11山目に足す（state.baneCard）。
  DOM.POOLS.cornucopia = ['hamlet', 'fortune_teller', 'menagerie', 'farming_village', 'horse_traders', 'remake', 'tournament', 'young_witch', 'harvest', 'horn_of_plenty', 'hunting_party', 'jester', 'fairgrounds'];
  DOM.POOLS.prizes = ['bag_of_gold', 'diadem', 'followers', 'princess', 'trusty_steed'];
  DOM.POOLS.hinterlands = ['crossroads', 'duchess', 'fools_gold', 'develop', 'oasis', 'oracle', 'scheme', 'tunnel', 'jack_of_all_trades', 'noble_brigand', 'nomad_camp', 'silk_road', 'spice_merchant', 'trader', 'cache', 'cartographer', 'embassy', 'haggler', 'highway', 'ill_gotten_gains', 'inn', 'mandarin', 'margrave', 'stables', 'border_village', 'farmland', 'nomads', 'trail', 'weaver', 'souk', 'cauldron', 'guard_dog', 'berserker', 'wheelwright', 'witchs_hut'];
  DOM.POOLS.darkages = ['poor_house', 'squire', 'vagrant', 'beggar', 'hermit', 'sage', 'forager', 'storeroom', 'urchin', 'market_square', 'ironmonger', 'wandering_minstrel', 'procession', 'scavenger', 'fortress', 'rats', 'armory', 'death_cart', 'marauder', 'feodum'];
  // 段階1（画像/カタログのみ・CARD_SETS 未参照＝実サプライには出さない）
  DOM.POOLS.guilds = ['candlestick_maker', 'stonemason', 'doctor', 'masterpiece', 'advisor', 'plaza', 'taxman', 'herald', 'baker', 'butcher', 'journeyman', 'merchant_guild', 'soothsayer'];
  // 暗黒時代の残り王国＋騎士の山を darkages プールへ合流（既存20種＋15種＝35種）
  DOM.POOLS.darkages = DOM.POOLS.darkages.concat(['junk_dealer', 'bandit_camp', 'rebuild', 'catacombs', 'graverobber', 'count', 'band_of_misfits', 'mystic', 'rogue', 'pillage', 'cultist', 'counterfeit', 'hunting_grounds', 'altar', 'knights']);
  DOM.POOLS.knights = ['dame_anna', 'dame_josephine', 'dame_molly', 'dame_natalie', 'dame_sylvia', 'sir_bailey', 'sir_destry', 'sir_martin', 'sir_michael', 'sir_vander'];   // 騎士の混合山の中身（非サプライ）
  DOM.POOLS.ruins = ['abandoned_mine', 'ruined_library', 'ruined_market', 'ruined_village', 'survivors'];       // 廃墟（特殊供給）
  DOM.POOLS.shelters = ['hovel', 'necropolis', 'overgrown_estate']; // 避難所（開始デッキ置換）
  DOM.POOLS.darkages_np = ['spoils', 'madman', 'mercenary']; // 戦利品/狂人/傭兵（非サプライ）
  // 冒険（Adventures）＝王国30種（抽選母集団。「冒険セット」固定10種と「冒険から」ランダムが参照。page/peasant はサプライ）。
  DOM.POOLS.adventures = ['coin_of_the_realm', 'page', 'peasant', 'ratcatcher', 'raze', 'amulet', 'caravan_guard', 'dungeon', 'gear', 'guide', 'duplicate', 'magpie', 'messenger', 'miser', 'port', 'ranger', 'transmogrify', 'artificer', 'bridge_troll', 'distant_lands', 'giant', 'haunted_woods', 'lost_city', 'relic', 'royal_carriage', 'storyteller', 'swamp_hag', 'treasure_trove', 'wine_merchant', 'hireling'];
  // 冒険：トラベラーの成長先8種＝非サプライ（page/peasant の交換でのみ得る・各5枚）。賞品(prizes)と同型で
  //   ランダム抽選の母集団には入れない（POOLS.adventures から分離）。整合性テストの「全カードがどれかのプールに属す」は満たす。
  DOM.POOLS.travellers = ['treasure_hunter', 'warrior', 'hero', 'champion', 'soldier', 'fugitive', 'disciple', 'teacher'];
  // 帝国（Empires）＝段階1。非分割18＋分割両面10＋城8。
  DOM.POOLS.empires = ['engineer', 'city_quarter', 'overlord', 'royal_blacksmith', 'farmers_market', 'chariot_race', 'enchantress', 'sacrifice', 'temple', 'villa', 'archive', 'capital', 'charm', 'forum', 'groundskeeper', 'legionary', 'wild_hunt', 'crown', 'encampment', 'plunder', 'patrician', 'emporium', 'settlers', 'bustling_village', 'catapult', 'rocks', 'gladiator', 'fortune', 'humble_castle', 'crumbling_castle', 'small_castle', 'haunted_castle', 'opulent_castle', 'sprawling_castle', 'grand_castle', 'kings_castle'];
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
    { id: 'cornucopia',      kind: 'standard', name: '収穫祭セット', kingdom: DOM.KINGDOM_CORNUCOPIA },
    { id: 'guilds',          kind: 'standard', name: 'ギルドセット', kingdom: DOM.KINGDOM_GUILDS },
    { id: 'hinterlands',     kind: 'standard', name: '異郷セット', kingdom: DOM.KINGDOM_HINTERLANDS },
    // 暗黒時代セット（固定10種＝Grim Parade）。このセットのみ避難所を使用（createInitialState が
    //   王国内容の一致で自動判定＝opts不要。random-darkages は避難所OFF）。
    { id: 'darkages',        kind: 'standard', name: '暗黒時代セット', kingdom: DOM.KINGDOM_DARKAGES },
    { id: 'adventures',      kind: 'standard', name: '冒険セット', kingdom: DOM.KINGDOM_ADVENTURES },
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
    // 新プロモ5山（サウナ/アヴァントは1つの分割山＝avanto は createInitialState が自動追加）＋基本5種。
    // 村/鍛冶屋/民兵/堀は 王子（$4以下を脇置き）と船長（サプライの$4以下を使用）の対象になる構成。
    { id: 'promo2-pack',      kind: 'recommend', name: '新プロモ全部入り', desc: '王子・船長・教会・サウナ/アヴァント・へそくり＋基本5種',
      kingdom: ['moat', 'village', 'militia', 'smithy', 'market', 'stash', 'prince', 'captain', 'church', 'sauna'] },
    // ---- ランダム（毎回その場で10種を抽選）----
    { id: 'random',          kind: 'random', name: '基本＋陰謀から', randomFrom: ['basic', 'intrigue'] },
    { id: 'random-seaside',  kind: 'random', name: '海辺から',       randomFrom: ['seaside'] },
    { id: 'random-alchemy',  kind: 'random', name: '錬金術から',     randomFrom: ['alchemy'] },
    { id: 'random-prosperity', kind: 'random', name: '繁栄から',     randomFrom: ['prosperity'] },
    { id: 'random-cornucopia', kind: 'random', name: '収穫祭から',   randomFrom: ['cornucopia'] },
    { id: 'random-guilds',   kind: 'random', name: 'ギルドから',     randomFrom: ['guilds'] },
    { id: 'random-hinterlands', kind: 'random', name: '異郷から',    randomFrom: ['hinterlands'] },
    { id: 'random-darkages', kind: 'random', name: '暗黒時代から',   randomFrom: ['darkages'] },
    { id: 'random-adventures', kind: 'random', name: '冒険から',     randomFrom: ['adventures'] },
    { id: 'random-intrigue', kind: 'random', name: '陰謀のみから',   randomFrom: ['intrigue'] },
    { id: 'random-basic',    kind: 'random', name: '基本のみから',   randomFrom: ['basic'] },
    { id: 'random-promo',    kind: 'random', name: 'プロモ込みから',  randomFrom: ['basic', 'intrigue', 'promo'] },
    { id: 'random-1e',       kind: 'random', name: '初版から',        randomFrom: ['basic1e', 'intrigue1e'] },
  ];
  // プールから重複なく n 種を選ぶ（コスト順に並べて返す）
  DOM.randomKingdom = function (n, pool) {
    let src = (pool || DOM.KINGDOM_POOL).slice();
    // プロモ：サウナ/アヴァントは1つの分割山（上5枚サウナ・下5枚アヴァント）。抽選ではサウナに
    // 一本化して1山ぶんだけ枠を使う（sauna が選ばれたら createInitialState が avanto を自動追加する）。
    if (src.includes('avanto')) { src = src.filter((id) => id !== 'avanto'); if (!src.includes('sauna')) src.push('sauna'); }
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
