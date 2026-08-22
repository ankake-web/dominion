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
                     /* 現行（陰謀第二版）の英語カード文＝`Each player with any cards in hand passes one to
                        the next such player to their left, at once.` ＝渡す側も受け取る側も
                        **手札のあるプレイヤーだけ**（公式FAQ＝手札0枚の人は飛ばされ、渡しも受け取りもしない／
                        手札があるのが1人だけならその人は自分自身に渡す）。旧文「左隣に渡す」だと挙動と食い違う。 */
                     text: '+2 カード\n手札のある各プレイヤーは同時に、手札を1枚、\n左隣の手札のあるプレイヤーに渡す。\nその後、あなたは手札を1枚廃棄してもよい。' },
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
                    text: '+1 カード\n+1 アクション\n+1 コイン\nこれを場から捨てるとき、このターンの購入フェイズに勝利点カードを1枚も獲得していなければ、これを山札の上に置いてよい。' },
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
                 text: '略奪品置き場から略奪品1枚を獲得する。\n他のプレイヤーは各自、廃墟1枚を獲得する。' },
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
                 text: '+1 カード\n+2 アクション\n略奪品置き場から略奪品1枚を獲得する。' },
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
                 text: 'これを廃棄する。そうしたら、略奪品置き場から略奪品2枚を獲得し、手札が5枚以上の他のプレイヤーは各自、手札を公開し、あなたが選んだカード1枚を捨て札にする。' },
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

    // ===== 非サプライ（略奪品/狂人/傭兵・段階1）=====
    spoils: { id: 'spoils', name: '略奪品', cost: 0, types: ['treasure'], coin: 3,
                 text: '3 コイン\nこれを使用したとき、このカードを略奪品置き場に戻す。' },
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
                 text: 'サプライにあるコスト5以下の、命令ではないアクションカード1枚を、サプライに残したまま使用する。' },
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
    plunder: { id: 'plunder', name: '鹵獲品', cost: 5, types: ['treasure'], coin: 2,
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
    rocks: { id: 'rocks', name: '石', cost: 4, types: ['treasure'], coin: 1,
                 text: '+1 コイン\nこれを獲得または廃棄したとき、銀貨を1枚獲得する。あなたの購入フェイズ中ならそれを山札の上に置き、そうでなければ手札に加える。' },
    gladiator: { id: 'gladiator', name: '剣闘士', cost: 3, types: ['action'],
                 text: '+2 コイン\nあなたの手札からカード1枚を公開する。あなたの左隣のプレイヤーは手札から同じカードを公開してもよい。公開されなかった場合、+1 コイン、サプライから剣闘士1枚を廃棄する。' },
    fortune: { id: 'fortune', name: '大金', cost: 8, debt: 8, types: ['treasure'],
                 text: '+1 購入\nこのターンにまだ大金をプレイしていない場合、あなたのコインを2倍にする。\nこれを獲得したとき、あなたのプレイエリアにある剣闘士1枚につき金貨1枚を獲得する。' },
    humble_castle: { id: 'humble_castle', name: '粗末な城', cost: 3, types: ['treasure', 'victory', 'castle'], coin: 1,
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
    // 帝国：城の混合山の「山キー」（騎士 knights と同型のプレースホルダ）。実カードは state.castles（8種を昇順に積む）。
    //   一番上（最も安い城）だけ購入/獲得できる。cardCost('castles') は engine が先頭の実コストで解決する。
    castles: { id: 'castles', name: '城', cost: 3, types: ['victory', 'castle'],
                 text: '城の混合山（8種）。一番上（最も安い城）だけ購入/獲得できる。' },

    /* ---------- ルネサンス（Renaissance）王国25種 ----------
       新機構＝村人(Villagers＝p.villagers・アクションフェイズに +1アクション)／
       アーティファクト(state.artifacts＝1人しか持てない・奪い合う非カード)／
       プロジェクト(横型＝DOM.LANDSCAPES の kind:'project')。財源(Coffers)はギルドの既存機構を流用。
       負債・ポーション・夜フェイズ・分割山・混合山は無い。テキストは現行（エラッタ後）。
       正本＝docs/research/renaissance_rules.md */
    border_guard: { id: 'border_guard', name: '国境警備隊', cost: 2, types: ['action'],
                 text: '+1 アクション\n山札の上から2枚を公開する。1枚を手札に加え、残りを捨て札にする。\n両方ともアクションカードの場合、ランタンか角笛を受け取る。' },
    ducat: { id: 'ducat', name: 'ドゥカート金貨', cost: 2, types: ['treasure'], coin: 0,
                 text: '+1 財源\n+1 購入\n————\nこれを獲得したとき、手札の銅貨1枚を廃棄してもよい。' },
    lackeys: { id: 'lackeys', name: '追従者', cost: 2, types: ['action'],
                 text: '+2 カード\n————\nこれを獲得したとき、+2 村人。' },
    acting_troupe: { id: 'acting_troupe', name: '劇団', cost: 3, types: ['action'],
                 text: '+4 村人\nこれを廃棄する。' },
    cargo_ship: { id: 'cargo_ship', name: '貨物船', cost: 3, types: ['action', 'duration'],
                 text: '+2 コイン\nこのターン中1回、あなたがカード1枚を獲得したとき、それを表向きでこの上に置いてもよい。\n次のあなたの手番開始時、それを手札に加える。' },
    experiment: { id: 'experiment', name: '実験', cost: 3, types: ['action'],
                 text: '+2 カード\n+1 アクション\nこれをその山に戻す。\n————\nこれを獲得したとき、実験をもう1枚獲得する（この2枚目では誘発しない）。' },
    improve: { id: 'improve', name: '増築', cost: 3, types: ['action'],
                 text: '+2 コイン\nクリーンアップフェイズ開始時、このターンに場から捨て札にするアクションカード1枚を廃棄してもよい。\nそうしたら、それよりちょうど1コイン高いカード1枚を獲得する。' },
    flag_bearer: { id: 'flag_bearer', name: '旗手', cost: 4, types: ['action'],
                 text: '+2 コイン\n————\nこれを獲得または廃棄したとき、旗を受け取る。' },
    hideout: { id: 'hideout', name: '根城', cost: 4, types: ['action'],
                 text: '+1 カード\n+2 アクション\n手札1枚を廃棄する。それが勝利点カードの場合、呪い1枚を獲得する。' },
    inventor: { id: 'inventor', name: '発明家', cost: 4, types: ['action'],
                 text: 'コスト4コイン以下のカード1枚を獲得する。\nその後このターン、すべてのカードのコストが1コイン安くなる（0未満にはならない）。' },
    mountain_village: { id: 'mountain_village', name: '山村', cost: 4, types: ['action'],
                 text: '+2 アクション\n捨て札置き場をすべて見て、その中から1枚を手札に加える。\nそれができない場合、+1 カード。' },
    patron: { id: 'patron', name: 'パトロン', cost: 4, types: ['action', 'reaction'],
                 text: '+1 村人\n+2 コイン\n————\nアクションフェイズ中に、何らかの効果によりあなたがこれを公開したとき、+1 財源。' },
    priest: { id: 'priest', name: '司祭', cost: 4, types: ['action'],
                 text: '+2 コイン\n手札1枚を廃棄する。\nこのターンの残りの間、あなたがカード1枚を廃棄するたびに +2 コイン。' },
    research: { id: 'research', name: '研究', cost: 4, types: ['action', 'duration'],
                 text: '+1 アクション\n手札1枚を廃棄する。そのコスト1コインにつき1枚を、山札の上から裏向きでこの上に置く。\n次のあなたの手番開始時、それらを手札に加える。' },
    silk_merchant: { id: 'silk_merchant', name: '絹商人', cost: 4, types: ['action'],
                 text: '+2 カード\n+1 購入\n————\nこれを獲得または廃棄したとき、+1 財源、+1 村人。' },
    old_witch: { id: 'old_witch', name: '老魔女', cost: 5, types: ['action', 'attack'],
                 text: '+3 カード\n他のプレイヤーは各自、呪い1枚を獲得する。\nその後、他のプレイヤーは各自、手札の呪い1枚を廃棄してもよい。' },
    recruiter: { id: 'recruiter', name: '徴募官', cost: 5, types: ['action'],
                 text: '+2 カード\n手札1枚を廃棄する。そのコスト1コインにつき +1 村人。' },
    scepter: { id: 'scepter', name: '王笏', cost: 5, types: ['treasure', 'command'], coin: 0,
                 text: '以下から1つを選ぶ:\n・+2 コイン\n・このターンにあなたが使用し場に残っている、命令でないアクションカード1枚を、再度使用する。' },
    scholar: { id: 'scholar', name: '学者', cost: 5, types: ['action'],
                 text: '手札をすべて捨て札にする。\n+7 カード' },
    sculptor: { id: 'sculptor', name: '彫刻家', cost: 5, types: ['action'],
                 text: 'コスト4コイン以下のカード1枚を獲得し、手札に加える。\nそれが財宝カードの場合、+1 村人。' },
    seer: { id: 'seer', name: '先見者', cost: 5, types: ['action'],
                 text: '+1 カード\n+1 アクション\n山札の上から3枚を公開する。コストが2〜4コインのカードを手札に加える。\n残りを好きな順番で山札の上に戻す。' },
    spices: { id: 'spices', name: '香辛料', cost: 5, types: ['treasure'], coin: 2,
                 text: '+2 コイン\n+1 購入\n————\nこれを獲得したとき、+2 財源。' },
    swashbuckler: { id: 'swashbuckler', name: '剣客', cost: 5, types: ['action'],
                 text: '+3 カード\n捨て札置き場にカードがある場合、+1 財源。\nその後、財源を4個以上持っている場合、宝箱を受け取る。' },
    treasurer: { id: 'treasurer', name: '出納官', cost: 5, types: ['action'],
                 text: '+3 コイン\n以下から1つを選ぶ:\n・手札の財宝カード1枚を廃棄する\n・廃棄置き場から財宝カード1枚を獲得し、手札に加える\n・鍵を受け取る' },
    villain: { id: 'villain', name: '悪党', cost: 5, types: ['action', 'attack'],
                 text: '+2 財源\n手札が5枚以上の他のプレイヤーは各自、手札からコスト2コイン以上のカード1枚を捨て札にする\n（できない場合、手札を公開する）。' },

    /* ---------- 移動動物園（Menagerie）王国30種＋馬 ----------
       新機構＝追放(Exile＝`p.exile` マット・公開・所有者の得点に数える)／
       馬(Horse＝非サプライ30枚・使用したら山へ戻る＝獲得でも廃棄でもない)／
       習性(Way＝横型 DOM.LANDSCAPES の kind:'way'＝アクションの記載効果の代わりに使う)。
       夜フェイズ・負債・ポーション・分割山・混合山は無い。テキストは現行（2025エラッタ後）。
       コスト欄に * が付く5枚（馬/動物見本市/デストリエ/漁師/行人）は「別の払い方がある」「コストが動く」の
       目印であって cost 成分ではない＝cost は素の数値を入れる。
       正本＝docs/research/menagerie_rules.md */
    animal_fair:     { id: 'animal_fair', name: '動物見本市', cost: 7, types: ['action'],
                 text: '+4 コイン\n空のサプライの山1つにつき、+1 購入。\n————\nこれのコストを支払う代わりに、手札のアクションカード1枚を廃棄してもよい。' },
    barge:           { id: 'barge', name: '艀', cost: 5, types: ['action', 'duration'],
                 text: '今、または次の自分のターンの開始時に、+3 カード、+1 購入。' },
    black_cat:       { id: 'black_cat', name: '黒猫', cost: 2, types: ['action', 'attack', 'reaction'],
                 text: '+2 カード\n自分のターンでない場合、他のプレイヤーは各自、呪い1枚を獲得する。\n————\n他のプレイヤーが勝利点カードを獲得したとき、これを手札から使用してもよい。' },
    bounty_hunter:   { id: 'bounty_hunter', name: '賞金稼ぎ', cost: 4, types: ['action'],
                 text: '+1 アクション\n手札1枚を追放する。それと同名のカードが追放マットに無かった場合、+3 コイン。' },
    camel_train:     { id: 'camel_train', name: 'ラクダの隊列', cost: 3, types: ['action'],
                 text: 'サプライから勝利点カード以外のカード1枚を追放する。\n————\nこれを獲得したとき、サプライから金貨1枚を追放する。' },
    cardinal:        { id: 'cardinal', name: '枢機卿', cost: 4, types: ['action', 'attack'],
                 text: '+2 コイン\n他のプレイヤーは各自、山札の上から2枚を公開し、コスト3コインから6コインのカード1枚を追放し、残りを捨て札にする。' },
    cavalry:         { id: 'cavalry', name: '騎兵隊', cost: 4, types: ['action'],
                 text: '馬2枚を獲得する。\n————\nこれを獲得したとき、+2 カード、+1 購入。自分の購入フェイズ中なら、アクションフェイズに戻る。' },
    coven:           { id: 'coven', name: '魔女の集会', cost: 5, types: ['action', 'attack'],
                 text: '+1 アクション\n+2 コイン\n他のプレイヤーは各自、サプライから呪い1枚を追放する。できない場合、そのプレイヤーは追放マットの呪いをすべて捨て札にする。' },
    destrier:        { id: 'destrier', name: 'デストリエ', cost: 6, types: ['action'],
                 text: '+2 カード\n+1 アクション\n————\n自分のターン中、これはこのターンに獲得したカード1枚につきコストが1コイン安くなる。' },
    displace:        { id: 'displace', name: '強制退去', cost: 5, types: ['action'],
                 text: '手札1枚を追放する。それよりコストが最大2コイン高い、名前の異なるカード1枚を獲得する。' },
    falconer:        { id: 'falconer', name: '鷹匠', cost: 5, types: ['action', 'reaction'],
                 text: 'これより安いカード1枚を手札に獲得する。\n————\n誰かが種別（アクション、アタックなど）を2つ以上持つカード1枚を獲得したとき、手札からこれを使用してもよい。' },
    fisherman:       { id: 'fisherman', name: '漁師', cost: 5, types: ['action'],
                 text: '+1 カード\n+1 アクション\n+1 コイン\n————\nあなたのターン中、あなたの捨て札置き場にカードが1枚もない場合、これのコストは3コイン安くなる。' },
    gatekeeper:      { id: 'gatekeeper', name: '門番', cost: 5, types: ['action', 'duration', 'attack'],
                 text: 'あなたの次のターンの開始時に、+3 コイン。それまでの間、他のプレイヤーは各自、自分の追放マットに同名のカードがないアクションカードか財宝カード1枚を獲得したとき、それを追放する。' },
    goatherd:        { id: 'goatherd', name: 'ヤギ飼い', cost: 3, types: ['action'],
                 text: '+1 アクション\n手札のカード1枚を廃棄してもよい。\n右隣のプレイヤーが自分の直前のターンに廃棄したカード1枚につき、+1 カード。' },
    groom:           { id: 'groom', name: '馬丁', cost: 4, types: ['action'],
                 text: 'コスト4コイン以下のカード1枚を獲得する。獲得したカードが……\nアクションカードの場合、馬1枚を獲得する。\n財宝カードの場合、銀貨1枚を獲得する。\n勝利点カードの場合、+1 カード、+1 アクション。' },
    hostelry:        { id: 'hostelry', name: '旅籠', cost: 4, types: ['action'],
                 text: '+1 カード\n+2 アクション\n————\nこれを獲得したとき、手札から好きな枚数の財宝カードを公開して捨て札にしてもよい。そうした場合、捨て札にした枚数と同じ枚数の馬を獲得する。' },
    hunting_lodge:   { id: 'hunting_lodge', name: '狩猟小屋', cost: 5, types: ['action'],
                 text: '+1 カード\n+2 アクション\n手札をすべて捨て札にしてもよい。そうした場合、+5 カード。' },
    kiln:            { id: 'kiln', name: '炉', cost: 5, types: ['action'],
                 text: '+2 コイン\nこのターン、次にカード1枚を使用するとき、その解決前に、それと同じカード1枚を獲得してもよい。' },
    livery:          { id: 'livery', name: '貸し馬屋', cost: 5, types: ['action'],
                 text: '+3 コイン\nこのターン、あなたがコスト4コイン以上のカード1枚を獲得したとき、馬1枚を獲得する。' },
    mastermind:      { id: 'mastermind', name: '首謀者', cost: 5, types: ['action', 'duration'],
                 text: 'あなたの次のターンの開始時に、手札のアクションカード1枚を3回使用してもよい。' },
    paddock:         { id: 'paddock', name: 'パドック', cost: 5, types: ['action'],
                 text: '+2 コイン\n馬2枚を獲得する。\n空のサプライの山1つにつき、+1 アクション。' },
    sanctuary:       { id: 'sanctuary', name: '聖域', cost: 5, types: ['action'],
                 text: '+1 カード\n+1 アクション\n+1 購入\n手札1枚を追放してよい。' },
    scrap:           { id: 'scrap', name: 'がらくた', cost: 3, types: ['action'],
                 text: '手札1枚を廃棄する。そのコスト1コインにつき1つ、以下から異なるものを選ぶ：\n+1 カード／+1 アクション／+1 購入／+1 コイン／銀貨1枚を獲得する／馬1枚を獲得する。' },
    sheepdog:        { id: 'sheepdog', name: '牧羊犬', cost: 3, types: ['action', 'reaction'],
                 text: '+2 カード\n————\nあなたがカードを獲得したとき、これを手札から使用してもよい。' },
    sleigh:          { id: 'sleigh', name: 'そり', cost: 2, types: ['action', 'reaction'],
                 text: '馬2枚を獲得する。\n————\nあなたがカードを獲得したとき、これを捨て札にしてもよい。そうした場合、獲得したカードを手札に加えるか山札の上に置く。' },
    snowy_village:   { id: 'snowy_village', name: '雪深い村', cost: 3, types: ['action'],
                 text: '+1 カード\n+4 アクション\n+1 購入\nこのターン、これ以降に得る +アクション をすべて無視する。' },
    stockpile:       { id: 'stockpile', name: '備蓄品', cost: 3, types: ['treasure'], coin: 3,
                 text: '+3 コイン\n+1 購入\nこれを追放する。' },
    supplies:        { id: 'supplies', name: '配給品', cost: 2, types: ['treasure'], coin: 1,
                 text: '+1 コイン\n馬1枚を獲得し、山札の上に置く。' },
    village_green:   { id: 'village_green', name: '村有緑地', cost: 4, types: ['action', 'duration', 'reaction'],
                 text: '今、または次のターンの開始時に、+1 カード および +2 アクション。\n————\nクリンナップフェイズ以外でこれを捨て札にしたとき、これを使用してもよい。' },
    wayfarer:        { id: 'wayfarer', name: '行人', cost: 6, types: ['action'],
                 text: '+3 カード\n銀貨1枚を獲得してもよい。\n————\nこれのコストは、このターンに獲得された直前の他のカード1枚と同じになる。' },
    // 馬（Horse）＝非サプライ30枚。「馬を獲得する」効果でのみ得られる（購入・汎用獲得の対象外）。
    horse:           { id: 'horse', name: '馬', cost: 3, types: ['action'],
                 text: '+2 カード\n+1 アクション\nこれをその山に戻す。' },
    /* ===== 夜想曲（Nocturne）縦型48種 ＝ 王国33＋家宝7＋非サプライ5＋ゾンビ3 =====
       正本＝docs/research/nocturne_rules.md（多エージェント研究＋敵対検証で確定）。
       新機構＝夜フェイズ（Night＝購入フェイズの後に使う）／家宝（Heirloom＝開始デッキの銅貨と置き換わる）／
       幸運(Fate)→祝福(Boon)・不運(Doom)→呪詛(Hex) の横型デッキ／状態(State)／精霊(Spirit)の非サプライ山。
       負債・ポーション費用・分割山・混合山は無い。テキストは**現行（最新エラッタ後）**。
       【HJ日本語版の印刷カードから意図的に変えた点＝差し戻し禁止】
        1. 取り替え子(changeling) の区切り線の下：HJ印刷「代わりに取り替え子1枚を獲得してもよい」は公式に誤訳
           （日本語版マニュアル側は「交換」と正しく書いてある）。印刷どおり「獲得の置換」にすると獲得時トリガーが
           一切発火せず壊れるので、訂正版＝「それを取り替え子と交換してもよい。」を採用。
        2. 納骨堂(crypt)＝2022年の**機能**エラッタ（脇に置けるのは「持続でない」財宝だけ）を反映。
        3. ネクロマンサー(necromancer)＝2021年印刷の**機能**エラッタ（裏返してから使用する）を反映。
        4. 追跡者(tracker)＝2022年の**機能**エラッタ（「これが場にある間」→「このターン」）を反映。
        5. 2021年印刷で削除された "from its pile"（悪魔の工房／迫害者／レプラコーン／沼の恵み 等）は落とす＝機能差ゼロ。
       家宝を持つ王国カードは末尾に「（家宝：X）」を付ける（実カードでは枠外の帯なので区切り線は入れない）。
       非サプライ札の "(This is not in the Supply.)" は既存カタログ（馬/略奪品/狂人/賞品）と同じく書かない。 */
    bard:            { id: 'bard', name: '詩人', cost: 4, types: ['action', 'fate'],
                 text: '+2 コイン\n祝福を1つ受ける。' },
    blessed_village: { id: 'blessed_village', name: '恵みの村', cost: 4, types: ['action', 'fate'],
                 text: '+1 カード\n+2 アクション\n————\nこのカードを獲得するとき、祝福を1つ取り、それを今か次のあなたのターンの開始時に受ける。' },
    cemetery:        { id: 'cemetery', name: '墓地', cost: 4, types: ['victory'], vp: 2,
                 text: '2 勝利点\n————\nこのカードを獲得したとき、あなたの手札から最大4枚までのカードを廃棄する。\n（家宝：呪いの鏡）' },
    changeling:      { id: 'changeling', name: '取り替え子', cost: 3, types: ['night'],
                 text: 'このカードを廃棄する。あなたの場に出ているカード1枚と同じカード1枚を獲得する。\n————\n取り替え子を使用するゲームで、コスト3以上のカード1枚を獲得するとき、それを取り替え子と交換してもよい。' },
    cobbler:         { id: 'cobbler', name: 'カブラー', cost: 5, types: ['night', 'duration'],
                 text: 'あなたの次のターンの開始時、コスト4以下のカードを1枚獲得し、手札に加える。' },
    conclave:        { id: 'conclave', name: 'コンクラーベ', cost: 4, types: ['action'],
                 text: '+2 コイン\nあなたの場に出ていないアクションカード1枚を手札から使用してもよい。\nそうした場合、+1 アクション。' },
    crypt:           { id: 'crypt', name: '納骨堂', cost: 5, types: ['night', 'duration'],
                 text: 'あなたの場に出ている、持続でない財宝カードを好きな枚数、（このカードの下に）裏向きで脇に置く。\n残りがある限り、あなたの各ターンの開始時に、その中の1枚を手札に加える。' },
    cursed_village:  { id: 'cursed_village', name: '呪われた村', cost: 5, types: ['action', 'doom'],
                 text: '+2 アクション\nあなたの手札が6枚になるまでカードを引く。\n————\nこのカードを獲得するとき、呪詛を1つ受ける。' },
    den_of_sin:      { id: 'den_of_sin', name: '悪人のアジト', cost: 5, types: ['night', 'duration'],
                 text: 'あなたの次のターンの開始時、+2 カード。\n————\nこのカードを獲得するとき、（捨て札に置く代わりに）手札に加える。' },
    devils_workshop: { id: 'devils_workshop', name: '悪魔の工房', cost: 4, types: ['night'],
                 text: 'このターンにあなたが獲得したカードの枚数が：\n2枚以上の場合、インプ1枚を獲得する。\n1枚の場合、コスト4以下のカード1枚を獲得する。\n0枚の場合、金貨1枚を獲得する。' },
    druid:           { id: 'druid', name: 'ドルイド', cost: 2, types: ['action', 'fate'],
                 text: '+1 購入\n脇に置かれた祝福1つを受ける（その祝福はそのまま置いておく）。\n————\n準備：祝福3枚を表向きにして脇に置く。' },
    exorcist:        { id: 'exorcist', name: '悪魔祓い', cost: 4, types: ['night'],
                 text: '手札1枚を廃棄する。廃棄したカードよりコストの低い精霊カード1枚を、精霊の山のいずれか1つから獲得する。' },
    faithful_hound:  { id: 'faithful_hound', name: '忠犬', cost: 2, types: ['action', 'reaction'],
                 text: '+2 カード\n————\nこれをクリーンアップフェイズ以外で捨て札にするとき、これを脇に置いてもよい。そうした場合、このターンの終了時にこれを手札に加える。' },
    fool:            { id: 'fool', name: '愚者', cost: 3, types: ['action', 'fate'],
                 text: 'あなたが森の迷子を持っていない場合、それを受け取り、祝福3枚を取り、好きな順番でその祝福を受ける。\n（家宝：幸運のコイン）' },
    ghost_town:      { id: 'ghost_town', name: 'ゴーストタウン', cost: 3, types: ['night', 'duration'],
                 text: 'あなたの次のターンの開始時に、+1 カード および +1 アクション。\n————\nこのカードを獲得するとき、（捨て札に置く代わりに）手札に加える。' },
    guardian:        { id: 'guardian', name: '守護者', cost: 2, types: ['night', 'duration'],
                 text: 'あなたの次のターンの開始時に、+1 コイン。それまでの間、他のプレイヤーがアタックカードを使用するとき、あなたはその影響を受けない。\n————\nこのカードを獲得するとき、（捨て札に置く代わりに）手札に加える。' },
    idol:            { id: 'idol', name: '偶像', cost: 5, types: ['treasure', 'attack', 'fate'], coin: 2,
                 text: '+2 コイン\n場にある偶像（これを含む）が奇数枚の場合、祝福1つを受ける。そうでない場合、他のプレイヤーは全員、呪い1枚を獲得する。' },
    leprechaun:      { id: 'leprechaun', name: 'レプラコーン', cost: 3, types: ['action', 'doom'],
                 text: '金貨1枚を獲得する。場にあるカードがちょうど7枚の場合、願い1枚を獲得する。そうでない場合、呪詛1つを受ける。' },
    monastery:       { id: 'monastery', name: '修道院', cost: 2, types: ['night'],
                 text: 'このターンにあなたが獲得したカード1枚につき、手札1枚または場にある銅貨1枚を廃棄してもよい。' },
    necromancer:     { id: 'necromancer', name: 'ネクロマンサー', cost: 4, types: ['action'],
                 text: '廃棄置き場にある、表向きで持続ではないアクションカード1枚を選ぶ。それをこのターンの間裏向きにし、廃棄置き場に置いたまま使用する。\n————\n準備：ゾンビ3枚を廃棄置き場に置く。' },
    night_watchman:  { id: 'night_watchman', name: '夜警', cost: 3, types: ['night'],
                 text: 'あなたの山札の上から5枚を見る。好きな枚数を捨て札にし、残りを好きな順番で山札の上に戻す。\n————\nこのカードを獲得するとき、（捨て札に置く代わりに）手札に加える。' },
    pixie:           { id: 'pixie', name: 'ピクシー', cost: 2, types: ['action', 'fate'],
                 text: '+1 カード\n+1 アクション\n祝福の山の一番上を捨て札にする。これを廃棄して、その祝福を2回受けてもよい。\n（家宝：ヤギ）' },
    pooka:           { id: 'pooka', name: 'プーカ', cost: 5, types: ['action'],
                 text: 'あなたの手札から呪われた金貨以外の財宝カード1枚を廃棄してもよい。そうした場合、+4 カード。\n（家宝：呪われた金貨）' },
    raider:          { id: 'raider', name: '夜襲', cost: 6, types: ['night', 'duration', 'attack'],
                 text: '手札が5枚以上ある他のプレイヤーは全員、あなたの場に出ているいずれかのカードと同じカード1枚を捨て札にする（それができない場合、手札を公開する）。\nあなたの次のターンの開始時に、+3 コイン。' },
    sacred_grove:    { id: 'sacred_grove', name: '聖なる木立ち', cost: 5, types: ['action', 'fate'],
                 text: '+1 購入\n+3 コイン\n祝福を1つ受ける。それにより +1 コイン を得なければ、他のプレイヤーも全員、それを受けてもよい。' },
    secret_cave:     { id: 'secret_cave', name: '秘密の洞窟', cost: 3, types: ['action', 'duration'],
                 text: '+1 カード\n+1 アクション\nあなたの手札からカード3枚を捨て札にしてもよい。そうした場合、あなたの次のターンの開始時、+3 コイン。\n（家宝：魔法のランプ）' },
    shepherd:        { id: 'shepherd', name: '羊飼い', cost: 4, types: ['action'],
                 text: '+1 アクション\n好きな枚数の勝利点カードを公開して捨て札にする。捨て札にしたカード1枚につき、+2 カード。\n（家宝：牧草地）' },
    skulk:           { id: 'skulk', name: '暗躍者', cost: 4, types: ['action', 'attack', 'doom'],
                 text: '+1 購入\n他のプレイヤーは全員、次の呪詛を1つ受ける。\n————\nこのカードを獲得するとき、金貨1枚を獲得する。' },
    tormentor:       { id: 'tormentor', name: '迫害者', cost: 5, types: ['action', 'attack', 'doom'],
                 text: '+2 コイン\n他のカードがあなたの場に出ていなければ、インプ1枚を獲得する。そうでない場合、他のプレイヤーは全員、次の呪詛を1つ受ける。' },
    tracker:         { id: 'tracker', name: '追跡者', cost: 2, types: ['action', 'fate'],
                 text: '+1 コイン\nこのターン、カード1枚を獲得したとき、それを山札の上に置いてもよい。\n祝福を1つ受ける。\n（家宝：革袋）' },
    tragic_hero:     { id: 'tragic_hero', name: '悲劇のヒーロー', cost: 5, types: ['action'],
                 text: '+3 カード\n+1 購入\nカードを引いた後にあなたの手札が8枚以上あるなら、これを廃棄して財宝カード1枚を獲得する。' },
    vampire:         { id: 'vampire', name: '吸血鬼', cost: 5, types: ['night', 'attack', 'doom'],
                 text: '他のプレイヤーは全員、次の呪詛を1つ受ける。\nコスト5以下の吸血鬼以外のカード1枚を獲得する。\nこれをコウモリ1枚と交換する。' },
    werewolf:        { id: 'werewolf', name: '人狼', cost: 5, types: ['action', 'night', 'attack', 'doom'],
                 text: 'あなたの夜フェイズである場合、他のプレイヤーは全員、次の呪詛を1つ受ける。そうでない場合、+3 カード。' },
    // ----- 家宝（Heirloom）7種＝開始デッキの銅貨と置き換わる非サプライ財宝（山が存在しない） -----
    cursed_gold:       { id: 'cursed_gold', name: '呪われた金貨', cost: 4, types: ['treasure', 'heirloom'], coin: 3,
                 text: '+3 コイン\n呪い1枚を獲得する。' },
    goat:              { id: 'goat', name: 'ヤギ', cost: 2, types: ['treasure', 'heirloom'], coin: 1,
                 text: '+1 コイン\n手札からカード1枚を廃棄してもよい。' },
    haunted_mirror:    { id: 'haunted_mirror', name: '呪いの鏡', cost: 0, types: ['treasure', 'heirloom'], coin: 1,
                 text: '+1 コイン\n————\nこれを廃棄したとき、手札からアクションカード1枚を捨て札にし、幽霊1枚を獲得してもよい。' },
    lucky_coin:        { id: 'lucky_coin', name: '幸運のコイン', cost: 4, types: ['treasure', 'heirloom'], coin: 1,
                 text: '+1 コイン\n銀貨1枚を獲得する。' },
    magic_lamp:        { id: 'magic_lamp', name: '魔法のランプ', cost: 0, types: ['treasure', 'heirloom'], coin: 1,
                 text: '+1 コイン\nあなたの場にちょうど1枚だけ出ているカードが（これを含めて）6種類以上ある場合、これを廃棄する。そうした場合、願い3枚を獲得する。' },
    pasture:           { id: 'pasture', name: '牧草地', cost: 2, types: ['treasure', 'victory', 'heirloom'], coin: 1,
                 text: '+1 コイン\n（勝利点：所有する屋敷1枚につき1点）' },
    pouch:             { id: 'pouch', name: '革袋', cost: 2, types: ['treasure', 'heirloom'], coin: 1,
                 text: '+1 コイン\n+1 購入' },

    // ----- 非サプライ5種（精霊3＝ウィル・オ・ウィスプ/インプ/幽霊、願い、コウモリ） -----
    will_o_wisp:       { id: 'will_o_wisp', name: 'ウィル・オ・ウィスプ', cost: 0, types: ['action', 'spirit'],
                 text: '+1 カード\n+1 アクション\nあなたのデッキの一番上のカードを公開する。そのカードのコストが2コイン以下なら、それを手札に加える。' },
    imp:               { id: 'imp', name: 'インプ', cost: 2, types: ['action', 'spirit'],
                 text: '+2 カード\nあなたの場に出ていないアクションカード1枚をあなたの手札から使用してもよい。' },
    ghost:             { id: 'ghost', name: '幽霊', cost: 4, types: ['night', 'duration', 'spirit'],
                 text: 'アクションカードが公開されるまで、あなたのデッキを上から公開する。公開したアクションカードを脇に置き、残りのカードを捨て札にする。\nあなたの次のターンの開始時、そのアクションカードを2度使用する。' },
    wish:              { id: 'wish', name: '願い', cost: 0, types: ['action'],
                 text: '+1 アクション\nこのカードを願いの山に戻す。そうした場合、コスト6コイン以下のカード1枚を獲得し、あなたの手札に加える。' },
    bat:               { id: 'bat', name: 'コウモリ', cost: 2, types: ['night'],
                 text: 'あなたの手札から最大2枚までのカードを廃棄する。\nこれにより1枚以上廃棄した場合、このカードを吸血鬼1枚と交換する。' },

    // ----- ゾンビ3種＝ネクロマンサーを使うゲームの準備で廃棄置き場に表向きで置く（各1枚・山が存在しない） -----
    zombie_apprentice: { id: 'zombie_apprentice', name: 'ゾンビの弟子', cost: 3, types: ['action', 'zombie'],
                 text: 'あなたの手札にあるアクションカード1枚を廃棄して、+3 カード、+1 アクションを得てもよい。' },
    zombie_mason:      { id: 'zombie_mason', name: 'ゾンビの石工', cost: 3, types: ['action', 'zombie'],
                 text: 'あなたのデッキの一番上のカードを廃棄する。そのカードよりコストが最大1コイン多いカード1枚を獲得してもよい。' },
    zombie_spy:        { id: 'zombie_spy', name: 'ゾンビの密偵', cost: 3, types: ['action', 'zombie'],
                 text: '+1 カード\n+1 アクション\nあなたのデッキの一番上のカードを見る。そのカードを捨て札にするか元に戻す。' },

    /* ---------- 同盟（Allies）王国49種＝非分割25種＋分割山6組（4種×4枚）24種 ＋ 山のプレースホルダ6種 ----------
       正本＝docs/research/allies_rules.md（多エージェント22体の研究＋敵対検証で確定・現行＝2023年12月 第2刷）。
       新種別＝連携(liaison)／町民(townsfolk)／卜占官(augur)／衝突(clash)／城砦(fort)／叙事詩(odyssey)／魔法使い(wizard)。
       ⚠ 分割山は帝国の2段 DOM.SPLIT_PILES では表現できない（4種×4枚＝16枚）。混合山 castles/knights と同型にすること
         （実カードid配列を state に持ち、一番上だけ購入/獲得可。「循環(Rotate)」で先頭の連続同名ブロックが末尾へ回る）。
       ⚠ 山のコスト・種別は randomizer（＝最安カード）で固定。「買うときのコスト」＝今の一番上、とは別物。 */
    // --- 非分割の王国カード25種 ---
    bauble: { id: 'bauble', name: '道化棒', cost: 2, types: ['treasure', 'liaison'],
                 text: '次から異なる2つを選ぶ：\n+1 購入／+1 コイン／+1 好意／このターン、あなたがカード1枚を獲得するとき、それを山札の一番上に置いてもよい。' },
    sycophant: { id: 'sycophant', name: 'ごますり', cost: 2, types: ['action', 'liaison'],
                 text: '+1 アクション\nカード3枚を捨て札にする。1枚以上を捨て札にした場合、+3 コイン。\n————\nこのカードを獲得または廃棄するとき、+2 好意。' },
    importer: { id: 'importer', name: '輸入者', cost: 3, types: ['action', 'duration', 'liaison'],
                 text: 'あなたの次のターンの開始時、コスト5以下のカード1枚を獲得する。\n————\n準備：各プレイヤーは +4 好意 を得る。' },
    merchant_camp: { id: 'merchant_camp', name: '商人の野営地', cost: 3, types: ['action'],
                 text: '+2 アクション\n+1 コイン\n————\nあなたがこのカードを場から捨て札にするとき、このカードを山札の一番上に置いてもよい。' },
    sentinel: { id: 'sentinel', name: '歩哨', cost: 3, types: ['action'],
                 text: 'あなたの山札の上から5枚のカードを見る。\nその中から最大2枚までを廃棄してもよい。\n残りを好きな順番で山札の上に戻す。' },
    underling: { id: 'underling', name: '下役', cost: 3, types: ['action', 'liaison'],
                 text: '+1 カード\n+1 アクション\n+1 好意' },
    broker: { id: 'broker', name: '仲買人', cost: 4, types: ['action', 'liaison'],
                 text: '手札1枚を廃棄する。次から1つを選ぶ：\n・そのコスト$1につき +1 カード\n・そのコスト$1につき +1 アクション\n・そのコスト$1につき +1 コイン\n・そのコスト$1につき +1 好意' },
    carpenter: { id: 'carpenter', name: '大工', cost: 4, types: ['action'],
                 text: '空のサプライの山が1つもない場合、+1 アクション、およびコスト4以下のカード1枚を獲得する。\nそうでない場合、あなたの手札からカード1枚を廃棄し、それよりコストが最大2コイン高いカード1枚を獲得する。' },
    courier: { id: 'courier', name: '急使', cost: 4, types: ['action'],
                 text: '+1 コイン\nあなたの山札の一番上のカードを捨て札にする。あなたの捨て札すべてを見る。その中のアクションカード1枚または財宝カード1枚を使用してもよい。' },
    innkeeper: { id: 'innkeeper', name: '宿屋の主人', cost: 4, types: ['action'],
                 text: '+1 アクション\n次から1つを選ぶ：\n・+1 カード\n・+3 カード、その後カード3枚を捨て札にする\n・+5 カード、その後カード6枚を捨て札にする' },
    royal_galley: { id: 'royal_galley', name: '王家のガレー船', cost: 4, types: ['action', 'duration'],
                 text: '+1 カード\nあなたの手札から持続ではないアクションカード1枚を使用してもよい。そのカードを脇に置く。そうした場合、あなたの次のターンの開始時、それを使用する。' },
    town: { id: 'town', name: '町', cost: 4, types: ['action'],
                 text: '次から1つを選ぶ：\n・+1 カード および +2 アクション\n・+1 購入 および +2 コイン' },
    barbarian: { id: 'barbarian', name: '蛮族', cost: 5, types: ['action', 'attack'],
                 text: '+2 コイン\n他のプレイヤーは全員、自分の山札の一番上のカードを廃棄する。そのカードのコストが3以上の場合、そのカードと同じ種別を1つ以上持ち、それよりコストが少ないカード1枚を獲得する。それ以外の場合、呪い1枚を獲得する。' },
    capital_city: { id: 'capital_city', name: '首都', cost: 5, types: ['action'],
                 text: '+1 カード\n+2 アクション\nカード2枚を捨て札にしてもよい。そうした場合、+2 コイン。\n2コインを支払ってもよい。そうした場合、+2 カード。' },
    contract: { id: 'contract', name: '契約書', cost: 5, types: ['treasure', 'duration', 'liaison'], coin: 2,
                 text: '+2 コイン\n+1 好意\n手札からアクションカード1枚を脇に置いてもよい。そうした場合、あなたの次のターンの開始時に、それを使用する。' },
    emissary: { id: 'emissary', name: '密使', cost: 5, types: ['action', 'liaison'],
                 text: '+3 カード\nこのカードで（少なくとも1枚のカードを）シャッフルした場合、+1 アクションと +2 好意。' },
    galleria: { id: 'galleria', name: 'ガレリア', cost: 5, types: ['action'],
                 text: '+3 コイン\nこのターン、コスト3または4のカード1枚を獲得するとき、+1 購入。' },
    guildmaster: { id: 'guildmaster', name: 'ギルドマスター', cost: 5, types: ['action', 'liaison'],
                 text: '+3 コイン\nこのターン、カード1枚を獲得するとき、+1 好意。' },
    highwayman: { id: 'highwayman', name: '追いはぎ', cost: 5, types: ['action', 'duration', 'attack'],
                 text: 'あなたの次のターンの開始時、このカードを捨て札にし、+3 カード。\nそれまでは、他のプレイヤーが各ターンに最初に使用する財宝は、何もしない。' },
    hunter: { id: 'hunter', name: '狩人', cost: 5, types: ['action'],
                 text: '+1 アクション\nあなたの山札の上から3枚を公開する。それらのカードからアクション1枚と財宝1枚と勝利点1枚をあなたの手札に加える。残りを捨て札にする。' },
    modify: { id: 'modify', name: '改造', cost: 5, types: ['action'],
                 text: 'あなたの手札から1枚を廃棄する。次から1つを選ぶ：\n・+1 カード と +1 アクション\n・廃棄したカードよりコストが最大2コイン高いカード1枚を獲得する' },
    skirmisher: { id: 'skirmisher', name: '散兵', cost: 5, types: ['action', 'attack'],
                 text: '+1 カード\n+1 アクション\n+1 コイン\nこのターン、あなたがアタックカード1枚を獲得するとき、他のプレイヤーは全員、手札が3枚になるように捨て札にする。' },
    specialist: { id: 'specialist', name: '専門家', cost: 5, types: ['action'],
                 text: 'あなたの手札からアクションカード1枚、または財宝カード1枚を使用してもよい。次から1つを選ぶ：\n・そのカードを再度使用する\n・そのカードと同じカード1枚を獲得する' },
    swap: { id: 'swap', name: '交換', cost: 5, types: ['action'],
                 text: '+1 カード\n+1 アクション\nあなたの手札からアクションカード1枚を、その山に戻してもよい。そうした場合、コスト5以下の、名前の異なるアクションカード1枚を獲得し、手札に加える。' },
    marquis: { id: 'marquis', name: '侯爵', cost: 6, types: ['action'],
                 text: '+1 購入\nあなたの手札1枚につき +1 カード。\n手札が10枚になるように捨て札にする。' },
    // --- 卜占官（augurs）の分割山＝薬草集め$3→侍祭$4→女魔導士$5→女予言者$6 ---
    augurs: { id: 'augurs', name: '卜占官', cost: 3, types: ['action', 'augur'],
                 text: '（卜占官の山）\n薬草集め・侍祭・女魔導士・女予言者 を各4枚、この順（安い順）に積んだ16枚の分割山。一番上の1枚だけ購入・獲得できる。' },
    herb_gatherer: { id: 'herb_gatherer', name: '薬草集め', cost: 3, types: ['action', 'augur'],
                 text: '+1 購入\nあなたの山札を捨て札に置く。捨て札置き場を見て、その中から財宝カード1枚を使用してもよい。\nあなたは卜占官を循環させてもよい。' },
    acolyte: { id: 'acolyte', name: '侍祭', cost: 4, types: ['action', 'augur'],
                 text: 'あなたの手札からアクションカードまたは勝利点カード1枚を廃棄してもよい。そうした場合、金貨1枚を獲得する。\nあなたはこれを廃棄してもよい。そうした場合、卜占官1枚を獲得する。' },
    sorceress: { id: 'sorceress', name: '女魔導士', cost: 5, types: ['action', 'attack', 'augur'],
                 text: '+1 アクション\nカード1枚を指定する。あなたの山札の一番上のカードを公開し、あなたの手札に加える。\nそれが指定したカードの場合、他のプレイヤーは全員、呪い1枚を獲得する。' },
    sibyl: { id: 'sibyl', name: '女予言者', cost: 6, types: ['action', 'augur'],
                 text: '+4 カード\n+1 アクション\nあなたの手札からカード1枚を山札の一番上に置き、もう1枚を山札の一番下に置く。' },
    // --- 衝突（clashes）の分割山＝戦闘計画$3→射手$4→将軍$5→領土$6 ---
    clashes: { id: 'clashes', name: '衝突', cost: 3, types: ['action', 'clash'],
                 text: '（衝突の山）\n戦闘計画・射手・将軍・領土 を各4枚、この順（安い順）に積んだ16枚の分割山。一番上の1枚だけ購入・獲得できる。' },
    battle_plan: { id: 'battle_plan', name: '戦闘計画', cost: 3, types: ['action', 'clash'],
                 text: '+1 カード\n+1 アクション\nあなたの手札からアタックカード1枚を公開してもよい。そうした場合、+1 カード。\nサプライのいずれかの山を循環させてもよい。' },
    archer: { id: 'archer', name: '射手', cost: 4, types: ['action', 'attack', 'clash'],
                 text: '+2 コイン\n手札が5枚以上の他のプレイヤーは全員、1枚を除きすべてのカードを公開し、その中の1枚をあなたが選んで捨て札にする。' },
    warlord: { id: 'warlord', name: '将軍', cost: 5, types: ['action', 'duration', 'attack', 'clash'],
                 text: '+1 アクション\nあなたの次のターンの開始時、+2 カード。\nそれまで、他のプレイヤーは全員、場に2枚以上同じカードがあるアクションカードを自分の手札から使用できない。' },
    territory: { id: 'territory', name: '領土', cost: 6, types: ['victory', 'clash'],
                 text: 'あなたが持つ異なる名前の勝利点カード1種類につき 1 勝利点。\n————\nあなたがこれを獲得するとき、サプライの空の山1つにつき金貨1枚を獲得する。' },
    // --- 城砦（forts）の分割山＝天幕$3→駐屯地$4→堡塁$5→要塞$6 ---
    forts: { id: 'forts', name: '城砦', cost: 3, types: ['action', 'fort'],
                 text: '（城砦の山）\n天幕・駐屯地・堡塁・要塞 を各4枚、この順（安い順）に積んだ16枚の分割山。一番上の1枚だけ購入・獲得できる。' },
    tent: { id: 'tent', name: '天幕', cost: 3, types: ['action', 'fort'],
                 text: '+2 コイン\nあなたは城砦を循環させてもよい。\n————\nあなたがこのカードを場から捨て札にするとき、このカードを山札の一番上に置いてもよい。' },
    garrison: { id: 'garrison', name: '駐屯地', cost: 4, types: ['action', 'duration', 'fort'],
                 text: '+2 コイン\nこのターン、あなたがカード1枚を獲得するとき、ここにトークン1枚を加える。\nあなたの次のターンの開始時、この上のトークンをすべて取り除き、取り除いたトークン1枚につき +1 カード。' },
    hill_fort: { id: 'hill_fort', name: '堡塁', cost: 5, types: ['action', 'fort'],
                 text: 'コスト4以下のカード1枚を獲得する。次から1つを選ぶ：\n・それをあなたの手札に加える\n・+1 カード と +1 アクション' },
    stronghold: { id: 'stronghold', name: '要塞', cost: 6, types: ['action', 'victory', 'duration', 'fort'], vp: 2,
                 text: '次から1つを選ぶ：\n・+3 コイン\n・あなたの次のターンの開始時、+3 カード\n————\n2 勝利点' },
    // --- 叙事詩（odysseys）の分割山＝古地図$3→航海$4→沈没船の財宝$5→遠い海岸$6 ---
    odysseys: { id: 'odysseys', name: '叙事詩', cost: 3, types: ['action', 'odyssey'],
                 text: '（叙事詩の山）\n古地図・航海・沈没船の財宝・遠い海岸 を各4枚、この順（安い順）に積んだ16枚の分割山。一番上の1枚だけ購入・獲得できる。' },
    old_map: { id: 'old_map', name: '古地図', cost: 3, types: ['action', 'odyssey'],
                 text: '+1 カード\n+1 アクション\nカード1枚を捨て札にする。\n+1 カード\nあなたは叙事詩を循環させてもよい。' },
    voyage: { id: 'voyage', name: '航海', cost: 4, types: ['action', 'duration', 'odyssey'],
                 text: '+1 アクション\nこのターンの後に追加の1ターンを得る（ただし、連続3ターンとなる場合は得られない）。そのターン、あなたが手札から使用できるカードは3枚までである。' },
    sunken_treasure: { id: 'sunken_treasure', name: '沈没船の財宝', cost: 5, types: ['treasure', 'odyssey'], coin: 0,
                 text: 'あなたが同じカードを場に出していないアクションカード1枚を獲得する。' },
    distant_shore: { id: 'distant_shore', name: '遠い海岸', cost: 6, types: ['action', 'victory', 'odyssey'], vp: 2,
                 text: '+2 カード\n+1 アクション\n屋敷1枚を獲得する。\n————\n2 勝利点' },
    // --- 町民（townsfolk）の分割山＝触れ役$2→蹄鉄工$3→粉屋$4→長老$5 ---
    townsfolk: { id: 'townsfolk', name: '町民', cost: 2, types: ['action', 'townsfolk'],
                 text: '（町民の山）\n触れ役・蹄鉄工・粉屋・長老 を各4枚、この順（安い順）に積んだ16枚の分割山。一番上の1枚だけ購入・獲得できる。' },
    town_crier: { id: 'town_crier', name: '触れ役', cost: 2, types: ['action', 'townsfolk'],
                 text: '次から1つを選ぶ：\n・+2 コイン\n・銀貨1枚を獲得する\n・+1 カード と +1 アクション\nあなたは町民を循環させてもよい。' },
    blacksmith: { id: 'blacksmith', name: '蹄鉄工', cost: 3, types: ['action', 'townsfolk'],
                 text: '次から1つを選ぶ：\n・手札が6枚になるまで引く\n・+2 カード\n・+1 カード と +1 アクション' },
    miller: { id: 'miller', name: '粉屋', cost: 4, types: ['action', 'townsfolk'],
                 text: '+1 アクション\n山札の上から4枚を見る。その中の1枚を手札に加え、残りを捨て札にする。' },
    elder: { id: 'elder', name: '長老', cost: 5, types: ['action', 'townsfolk'],
                 text: '+2 コイン\n手札のアクションカード1枚を使用してもよい。それによりこのターンに（「選ぶ」という指示で）能力を選ぶとき、追加で異なるもの1つを選んでもよい。' },
    // --- 魔法使い（wizards）の分割山＝生徒$3→霊術師$4→魔導士$5→リッチ$6 ---
    wizards: { id: 'wizards', name: '魔法使い', cost: 3, types: ['action', 'wizard'],
                 text: '（魔法使いの山）\n生徒・霊術師・魔導士・リッチ を各4枚、この順（安い順）に積んだ16枚の分割山。一番上の1枚だけ購入・獲得できる。' },
    student: { id: 'student', name: '生徒', cost: 3, types: ['action', 'liaison', 'wizard'],
                 text: '+1 アクション\nあなたは魔法使いを循環させてもよい。\n手札1枚を廃棄する。それが財宝カードの場合、+1 好意、そしてこれを山札の上に置く。' },
    conjurer: { id: 'conjurer', name: '霊術師', cost: 4, types: ['action', 'duration', 'wizard'],
                 text: 'コスト4以下のカード1枚を獲得する。\nあなたの次のターンの開始時、これを手札に加える。' },
    sorcerer: { id: 'sorcerer', name: '魔導士', cost: 5, types: ['action', 'attack', 'wizard'],
                 text: '+1 カード\n+1 アクション\n他のプレイヤーは全員、カード名を1つ指定し、その後に自分の山札の一番上のカードを公開する。それが指定したカードでない場合、そのプレイヤーは呪い1枚を獲得する。' },
    lich: { id: 'lich', name: 'リッチ', cost: 6, types: ['action', 'wizard'],
                 text: '+6 カード\n+2 アクション\n1ターンスキップする。\n————\nあなたがこれを廃棄するとき、これを捨て札にし、廃棄置き場からこれよりコストの低いカード1枚を獲得する。' },

    /* ===== 略奪（Plunder・2022年12月）＝段階1（画像とカタログのみ。CARD_SETS 未参照＝実プレイには出ない） =====
       正本＝docs/research/plunder_rules.md（一次資料の収集＋敵対検証済み。冒頭「実装前に必読」を先に読む）。
       新種別＝戦利品(loot)。新機構＝Loot（伏せた非サプライ山・15種×2枚＝30枚）／特性(Trait)（横型・山に付く）／
       "next time"（次に〜したとき）型の持続（ちょうど7枚）。
       ⚠ 英語id `plunder` は帝国の分割山「鹵獲品」で使用済み＝この拡張のプール名/セットIDは `plunderexp`。
       ⚠ 日本語文面は Dominion Online 訳（PROGRESS §4 の決定。印刷版と照合する手段が無い＝許容簡略化）。 */
    // --- 王国カード40種 ---
    /* ---------- 略奪（Plunder）王国カード 1/3 ＝ $2〜$4 の13枚 ----------
       正本＝docs/research/plunder_rules.md 第2章（多エージェント研究＋敵対検証2体・章末の訂正を反映済み）。
       現行＝2022年12月の初版テキスト（13枚ともエラッタ・再版なし＝Versions 表は Plunder / December 2022 の1行だけ）。
       日本語文面は Dominion Online 訳で統一（ユーザー決定）。※印刷版（ホビージャパン2023年3月）とは
         シャーマン／セイレーン／現場監督／密航者 の4枚で文言が違うことを実物写真で確認済み。
       新種別は無い（loot は第5章）。'command' は既存（王笏/大君主/はみだし者/船長/王子）。
       ⚠ Loot（戦利品）を獲得する札が2枚ある（宝飾卵・調査）＝第5章の Loot 山が要る。
         暗黒時代の spoils＝「略奪品」とは別物（ea0c091 で改名済み）。
       ⚠ 検証で訂正: 旧="「次に〜したとき」型の持続が4枚（檻／調査／秘境の社／豊穣）" → **旗艦(Flagship)が落ちていた**。
         正＝**この13枚の中では5枚（檻／調査／秘境の社／豊穣／旗艦）**。拡張全体では **ちょうど7枚**
         （＋切り裂き魔 Cutthroat $5・上陸部隊 Landing Party $4＝第3/4章）。正本＝研究doc 第2章 §A ＋
         章末 敵対検証レポート[high]「the next time 型は5枚」（英語wiki `Duration > Triggered effects` の公式カテゴリ）。
         ＝条件が満たされるまで場に残り続ける（満たされなければ永久に場に残る）。
         p.delayedEffects（1ターンぶんの予約）では表現できない。§0-9 Batch5c の applyLingerOnBuy と同型の
         イベント駆動の予約が要る。**その誘発事象の解決中に場に出た予約は、その事象では発火しない**
         （＝檻／調査／秘境の社／豊穣 の4枚に公式の明文がある。密航者は逆に自分自身の獲得にも反応できる＝別機構）。
       ⚠ 旗艦は命令(Command)＝**命令カードを再演してはいけない**（無限ループ防止のための必須条件）。
         公式の Command は8つで、**js/cards.js の静的 types だけを見ると足りない**＝
         `inheritedEstate`（相続した屋敷）は動的に Command 扱いなので除外述語に含めること。 */
    // --- コスト$2（5種） ---
    // Set aside up to 4 cards from your hand face down (on this). / The next time you gain a Victory card, trash this, and put / the set aside cards into your hand at end of turn.
    cage: { id: 'cage', name: '檻', cost: 2, types: ['treasure', 'duration'], coin: 0,
                 text: '手札を最大4枚（このカードの）脇に伏せて置いてもよい。\n次に勝利点カード1枚を獲得したとき、このカードを場から廃棄し、脇に置いたカードをターン終了時に手札に加える。' },
    // +1 Action / Set aside up to 4 cards from your hand face down (on this). At the start of your next turn, discard / them, then draw as many.
    grotto: { id: 'grotto', name: '岩屋', cost: 2, types: ['action', 'duration'],
                 text: '+1 アクション\n手札を最大4枚（このカードの）上に伏せて置いてもよい。\nあなたの次のターンの開始時、それらを捨て札にし、同じ枚数のカードを引く。' },
    // [$1] / +1 Buy / --- / When you trash this, gain a Loot.
    jewelled_egg: { id: 'jewelled_egg', name: '宝飾卵', cost: 2, types: ['treasure'], coin: 1,
                 text: '+1 コイン\n+1 購入\n————\nこれを廃棄したとき、戦利品1枚を獲得する。' },
    // +[$2] / The next time a Supply pile empties, trash this and gain a Loot.
    search: { id: 'search', name: '調査', cost: 2, types: ['action', 'duration'],
                 text: '+2 コイン\n次にサプライ1山が空になったとき、これを場から廃棄し、戦利品1枚を獲得する。' },
    // +1 Action / +[$1] / You may trash a card from your hand. / --- / In games using this, at the start of your turn, gain a card from the trash costing up to [$6].
    shaman: { id: 'shaman', name: 'シャーマン', cost: 2, types: ['action'],
                 text: '+1 アクション\n+1 コイン\n手札1枚を廃棄してもよい。\n————\nシャーマンを使うゲームでは、あなたは自分の各ターンの開始時に、廃棄置き場からコスト6以下のカード1枚を獲得する。' },
    // --- コスト$3（4種） ---
    // +[$1] / The next time you gain a Treasure, trash up to 2 cards from your hand.
    secluded_shrine: { id: 'secluded_shrine', name: '秘境の社', cost: 3, types: ['action', 'duration'],
                 text: '+1 コイン\n次に財宝カード1枚を獲得したとき、手札を最大2枚廃棄してもよい。' },
    // Each other player gains a Curse. At the start of your next turn, draw until you have 8 cards in hand. / --- / When you gain this, trash it unless you trash an Action from your hand.
    siren: { id: 'siren', name: 'セイレーン', cost: 3, types: ['action', 'duration', 'attack'],
                 text: '他のプレイヤーは全員、呪い1枚を獲得する。\nあなたの次のターンの開始時、あなたは手札が8枚になるようにカードを引く。\n————\nこれを獲得したとき、手札からアクションカード1枚を廃棄してもよい。廃棄しない場合、これを廃棄する。' },
    // At the start of your next turn, +2 Cards. / --- / When anyone gains a Duration card, you may play this from your hand.
    stowaway: { id: 'stowaway', name: '密航者', cost: 3, types: ['action', 'duration', 'reaction'],
                 text: 'あなたの次のターンの開始時、+2 カード。\n————\n誰かが持続カード1枚を獲得したとき、あなたは手札からこれを使用してもよい。' },
    // +1 Action, +[$1], and if you gain a card costing exactly [$5] this turn, then at the start of your next turn, repeat this ability.
    taskmaster: { id: 'taskmaster', name: '現場監督', cost: 3, types: ['action', 'duration'],
                 text: '+1 アクション\n+1 コイン\nこのターン、これより後にあなたがコスト5のカードを獲得した場合、あなたの次のターンの開始時に、このカードの能力を冒頭から繰り返す。' },
    // --- コスト$4（4種） ---
    // The next time you gain an Action card: +1 Buy and +[$3].
    abundance: { id: 'abundance', name: '豊穣', cost: 4, types: ['treasure', 'duration'], coin: 0,
                 text: '次にアクションカード1枚を獲得したとき、\n+1 購入、+3 コイン' },
    // +1 Card / +1 Action / At the start of your next turn, choose one: +[$2]; or trash this to gain a Duration card.
    // ⚠ 検証で訂正: 旧='・持続カード1枚を獲得するために、…' → 正本(DO訳)は「持続カードを1枚獲得するために、…」（を の位置）
    cabin_boy: { id: 'cabin_boy', name: 'キャビンボーイ', cost: 4, types: ['action', 'duration'],
                 text: '+1 カード\n+1 アクション\nあなたの次のターンの開始時、次から1つを選ぶ：\n・+2 コイン\n・持続カードを1枚獲得するために、これを場から廃棄する' },
    // Trash a card from your hand. +[$1] per [$1] it costs.
    crucible: { id: 'crucible', name: '坩堝', cost: 4, types: ['treasure'], coin: 0,
                 text: '手札1枚を廃棄する。\nそのコスト$1につき +1 コイン。' },
    // +[$2] / The next time you play a non-Command Action card, replay it.
    flagship: { id: 'flagship', name: '旗艦', cost: 4, types: ['action', 'duration', 'command'],
                 text: '+2 コイン\n次に命令カード以外のアクションカード1枚を使用したとき、それを再使用する。' },
    /* ---------- 略奪（Plunder）王国カード 2/3 ＝ $4〜$5 の13枚 ----------
       正本＝docs/research/plunder_rules.md 第3章（多エージェント研究＋敵対検証で確定・現行＝2022年12月の初版のみ／13枚ともエラッタ無し）。
       日本語のカード文面は Dominion Online 訳（＝日本語wiki 掲載）を既存カタログの言い回しへ寄せたもの。
       ⚠ 区切り線（————）を持つのは gondola / mapmaker / buried_treasure の3枚だけ。
         cutthroat の「次に〜戦利品」は**線の下ではなく持続能力そのもの**（英語wiki の Card text の <hr> を機械カウントして確認）。
         これを取り違えると習性(Way)で使ったときの挙動が逆になる。
       ⚠ 段階2で決める必要がある未決事項（カタログの文面自体には影響しない・研究doc §3/§L）：
         「港の村」の追加効果を **習性(Way)由来の +コイン でも得るか**（英語wiki 公式FAQ＝得る／
         日本語wiki＋2025年エラッタ・Discord 裁定＝得ない）。mix-all でしか同居しないので出荷セットへの影響はゼロ。 */
    // +[$2] / Look at the top 3 cards of your deck. You may play a Treasure from them. Put the rest back in any order.
    fortune_hunter: { id: 'fortune_hunter', name: '財産目当て', cost: 4, types: ['action'],
                 text: '+2 コイン\n山札の上から3枚を見る。\nその中の財宝カード1枚を使用してもよい。\n残りを好きな順番で山札の上に戻す。' },
    // Either now or at the start of your next turn: +[$2]. / — / When you gain this, you may play an Action card from your hand.
    // ⚠ coin: 0 ＝「今 or 次のターン開始時」の選択制なので基本コインは持たせない（御守り charm と同じ扱い）。
    gondola: { id: 'gondola', name: 'ゴンドラ', cost: 4, types: ['treasure', 'duration'], coin: 0,
                 text: '現在またはあなたの次のターンの開始時に、+2 コイン\n————\nこれを獲得したとき、手札のアクションカード1枚を使用してもよい。' },
    // +1 Card / +2 Actions / After the next Action you play this turn, if it gave you +[$], +[$1].
    harbor_village: { id: 'harbor_village', name: '港の村', cost: 4, types: ['action'],
                 // ⚠ 検証で訂正: 旧='その効果で +コイン を得ていた場合'（+コイン の前後に空白）
                 //   → 研究doc の和訳は 'その効果で+コインを得ていた場合'（空白なし）。逐語に戻した。
                 //   ※既存カタログで空白を入れているのは「+1 カード」のような +数値 トークンだけで、'+コイン' の前例は無い。
                 text: '+1 カード\n+2 アクション\nこのターン次にアクションカード1枚を使用した後、その効果で+コインを得ていた場合、+1 コイン。' },
    // +2 Cards / +2 Actions / The next time the first card you play on a turn is a Treasure, put this onto your deck afterwards.
    landing_party: { id: 'landing_party', name: '上陸部隊', cost: 4, types: ['action', 'duration'],
                 text: '+2 カード\n+2 アクション\n次にターン中最初に使用するカードが財宝カードであるとき、その後にこれを山札の上に置く。' },
    // Look at the top 4 cards of your deck. Put 2 into your hand and discard the rest. / — / When any player gains a Victory card, you may play this from your hand.
    mapmaker: { id: 'mapmaker', name: '地図作り', cost: 4, types: ['action', 'reaction'],
                 text: '山札の上から4枚を見る。\nその中の2枚を手札に加え、残りを捨て札にする。\n————\n誰かが勝利点カード1枚を獲得したとき、あなたはこれを手札から使用してもよい。' },
    // Trash a card from your hand. +2 Cards per type it has (Action, Attack, etc.).
    maroon: { id: 'maroon', name: '置き去り', cost: 4, types: ['action'],
                 text: '手札1枚を廃棄する。\nそれが持つ種別（アクション、アタックなど）1つにつき +2 カード。' },
    // [$1] / +1 Buy / At the start of your next turn, +1 Card and you may trash a card from your hand.
    rope: { id: 'rope', name: '縄', cost: 4, types: ['treasure', 'duration'], coin: 1,
                 text: '+1 コイン\n+1 購入\nあなたの次のターンの開始時に、+1 カード、手札1枚を廃棄してもよい。' },
    // +2 Actions / +1 Card per 3 cards you have in play (round down).
    swamp_shacks: { id: 'swamp_shacks', name: '沼地の小屋', cost: 4, types: ['action'],
                 text: '+2 アクション\nあなたが場に出しているカード3枚（端数切り捨て）につき、+1 カード。' },
    // Gain a copy of a card anyone has in play.
    tools: { id: 'tools', name: '工具', cost: 4, types: ['treasure'], coin: 0,
                 text: '（自分を含む）誰かが場に出しているのと同じカード1枚を獲得する。' },
    // At the start of your next turn, +1 Buy and +[$3]. / — / When you gain this, play it.
    // ⚠ coin: 0 ＝ コインは「次のターンの開始時」にしか出ない（使用した瞬間には $0）。
    buried_treasure: { id: 'buried_treasure', name: '埋められた財宝', cost: 5, types: ['treasure', 'duration'], coin: 0,
                 text: 'あなたの次のターンの開始時、+1 購入、+3 コイン。\n————\nこれを獲得したとき、使用する。' },
    // +3 Cards / At the start of your next turn, put this onto your deck.
    // ⚠ 参考（方針で決着済み）: 日本語文面が2系統ある。日本語wiki（Dominion Online 訳）＝「これを場から山札の上に置く。」／
    //   英語wiki の Japanese 行＝「これをあなたのデッキの上に置く。」。カード名『乗組員』は両者一致。
    //   本カタログは決定方針どおり Dominion Online 訳を採用（印刷版との実物照合は未実施）。
    crew: { id: 'crew', name: '乗組員', cost: 5, types: ['action', 'duration'],
                 text: '+3 カード\nあなたの次のターンの開始時、これを場から山札の上に置く。' },
    // Each other player discards down to 3 cards in hand. / The next time anyone gains a Treasure costing [$5] or more, gain a Loot.
    // ⚠ 区切り線は無い（2行目も持続能力そのもの）。習性(Way)で使うとアタックも予約も両方発生しない。
    cutthroat: { id: 'cutthroat', name: '切り裂き魔', cost: 5, types: ['action', 'duration', 'attack'],
                 text: '他のプレイヤーは全員、手札が3枚になるように捨て札にする。\n次に（自分を含む）誰かがコスト5以上の財宝カード1枚を獲得したとき、あなたは戦利品1枚を獲得する。' },
    // Now and at the start of your next turn: Trash a card from your hand, and gain one costing up to [$2] more.
    enlarge: { id: 'enlarge', name: '拡大', cost: 5, types: ['action', 'duration'],
                 text: '現在とあなたの次のターンの開始時：\n手札1枚を廃棄し、それよりコストが最大2コイン高いカード1枚を獲得する。' },
    /* ===== 略奪（Plunder）王国カード 3/3 ＝ $5〜$7 の14枚 =====
       正本＝docs/research/plunder_rules.md 第4章（英語wiki 14ページ＋日本語wiki 14ページを敵対検証済み）。
       14件とも Versions 表は「First edition / December 2022」の1行のみ＝エラッタなし。
       14件とも負債・ポーション費用は持たない（costIsPlainCoin が真）。
       日本語文面＝Dominion Online 訳（PROGRESS §4 の2026-08-15 決定3）。研究doc の逐語からの
       意図的な差分は次の4種だけ（それ以外は1文字も変えていない＝逐語検証で機械照合済み）：
         (1) 資源行を既存676枚の慣習へ正規化＝「+N カードを引く」→「+N カード」／「1 コイン」→「+1 コイン」。
         (2) 区切り線を既存カタログの形へ＝「--------------------」→「————」（U+2014×4・cards.js の52箇所と同一）。
         (3) 「選ぶ」の書式を既存カタログの形へ＝「次のうち1つを選ぶ：」＋「〜」→「次から1つを選ぶ：」＋「・〜」
             （quartermaster のみ。cards.js は選択肢に「」を使わず ・ で並べる）。
         (4) 半角読点「,」→全角「、」（figurine のみ＝wikiwiki 側の表記ゆれ。語は置換していない）。
       カード文中の改行は「1文＝1行」の既存慣習に合わせて折り返し位置を詰めた（frigate）。意味は不変。
       Loot＝戦利品（暗黒時代 spoils は 略奪品 に改名済み＝衝突なし）。 */
    // --- コスト5（12枚） ---
    // +2 Cards / You may discard an Action card for +1 Buy and +$1.
    figurine: { id: 'figurine', name: '小像', cost: 5, types: ['treasure'], coin: 0,
                 // ⚠ 検証で訂正: 旧='そうした場合、+1 購入 と +1 コイン。'（"と" は研究doc に無い語の追加）
                 //   → 研究doc 逐語 'そうした場合、+1 購入, +1 コイン。' の半角読点だけを全角化する形に戻した。
                 text: '+2 カード\n手札のアクションカード1枚を捨て札にしてもよい。そうした場合、+1 購入、+1 コイン。' },
    // Play any number of Action cards with the same name from your hand, / then draw until you have 6 cards in hand.
    first_mate: { id: 'first_mate', name: '一等航海士', cost: 5, types: ['action'],
                 text: '手札から、名前が互いに一致するアクションカードを好きな枚数使用してもよい。\nその後、手札が6枚になるようにカードを引く。' },
    // +$3 / Until the start of your next turn, each time another player plays an Action card, / they discard down to 4 cards in hand afterwards.
    frigate: { id: 'frigate', name: 'フリゲート船', cost: 5, types: ['action', 'duration', 'attack'],
                 text: '+3 コイン\nあなたの次のターンの開始時まで、他のプレイヤーはアクションカード1枚を使用するたび、その後に、手札が4枚になるように捨て札にする。' },
    // +2 Actions / At the start of your next turn, +2 Cards.
    longship: { id: 'longship', name: 'ロングシップ', cost: 5, types: ['action', 'duration'],
                 text: '+2 アクション\nあなたの次のターンの開始時、+2 カード。' },
    // +1 Action / +1 Buy / +$2 / Once this turn, when you gain a Treasure, you may play it.
    mining_road: { id: 'mining_road', name: '鉱山道路', cost: 5, types: ['action'],
                 text: '+1 アクション\n+1 購入\n+2 コイン\nこのターンに1度、財宝カード1枚を獲得したとき、それを使用してもよい。' },
    // +$1 per differently named Treasure you have in play.
    pendant: { id: 'pendant', name: 'ペンダント', cost: 5, types: ['treasure'], coin: 0,
                 text: 'あなたが場に出している異なる財宝カード1種類につき、+1 コイン。' },
    // $1 / Trash a card from your hand. / If it costs $3 or more, gain a Loot to your hand.
    pickaxe: { id: 'pickaxe', name: 'つるはし', cost: 5, types: ['treasure'], coin: 1,
                 text: '+1 コイン\n手札1枚を廃棄する。\nそのコストが3以上の場合、戦利品1枚を手札に獲得する。' },
    // +4 Cards / Put a card from your hand onto your deck.
    pilgrim: { id: 'pilgrim', name: '巡礼者', cost: 5, types: ['action'],
                 text: '+4 カード\n手札1枚を山札の上に置く。' },
    // At the start of each of your turns for the rest of the game, choose one: / Gain a card costing up to $4, setting it aside on this; / or put a card from this into your hand.
    quartermaster: { id: 'quartermaster', name: '操舵手', cost: 5, types: ['action', 'duration'],
                 // ⚠ 検証で訂正: 旧='・コスト4以下のカード1枚を、このカードの脇に獲得する'（読点は研究doc に無い挿入）
                 //   → 研究doc 逐語「コスト4以下のカード1枚を(このカードの)脇に獲得する」に合わせて読点を削除。
                 text: 'ゲーム終了まで、あなたの各ターンの開始時、次から1つを選ぶ：\n・コスト4以下のカード1枚をこのカードの脇に獲得する\n・このカードの脇にあるカード1枚を手札に加える' },
    // Gain a Treasure costing less than this to your hand.
    silver_mine: { id: 'silver_mine', name: '銀山', cost: 5, types: ['treasure'], coin: 0,
                 text: 'これより安い財宝カード1枚を手札に獲得する。' },
    // Each other player gains a Curse. / Once this turn, when you discard a Treasure from play, you may set it aside. / Put it in your hand at end of turn.
    trickster: { id: 'trickster', name: 'トリックスター', cost: 5, types: ['action', 'attack'],
                 text: '他のプレイヤーは全員、呪い1枚を獲得する。\nこのターンに1度、財宝カード1枚を場から捨て札にしたとき、それを脇に置いてもよい。\nターン終了時、それを手札に加える。' },
    // +1 Card / +2 Actions / -------------------- / When you gain this, if you have at least 3 differently named Treasures in play, gain a Loot.
    wealthy_village: { id: 'wealthy_village', name: '価値ある村', cost: 5, types: ['action'],
                 text: '+1 カード\n+2 アクション\n————\nこれを獲得したとき、異なる財宝カードを3種類以上場に出している場合、戦利品1枚を獲得する。' },
    // --- コスト6 ---
    // $1 / +1 Buy / Gain a Loot.
    sack_of_loot: { id: 'sack_of_loot', name: '戦利品の袋', cost: 6, types: ['treasure'], coin: 1,
                 text: '+1 コイン\n+1 購入\n戦利品1枚を獲得する。' },
    // --- コスト7 ---
    // You may play a Treasure from your hand 3 times.
    kings_cache: { id: 'kings_cache', name: '王の隠し財産', cost: 7, types: ['treasure'], coin: 0,
                 text: '手札の財宝カード1枚を3回使用してもよい。' },
    // --- 戦利品(Loot) 15種＝非サプライ。15種×2枚＝30枚を1山にシャッフルして伏せる（獲得したら公開） ---
    /* ===== 略奪（Plunder）＝戦利品(Loot) 15種 =====
       正本＝docs/research/plunder_rules.md 第5章（＋章末の敵対検証レポートの訂正を反映）。
       ・コストは公式では全15種 `$7*`（星付き＝非サプライ）。本カタログでは cost: 7 のみを書く
         （賞品 prizes・略奪品 spoils と同じ扱い＝星は cards.js では表現していない）。
       ・山は30枚（15種×2）で非サプライ・中身も順序も完全に伏せる（廃墟と違い一番上も見えない）。
       ・新種別 'loot'（戦利品）＝carddata.js の typeLabel/typeLabelEn、integrity の JP/EN マップ、
         ui.js の TYPE_JP に追加が必要。
       ・【重要】暗黒時代の Spoils は公式訳「略奪品」に改名済み（js/cards.js:601）＝
         「戦利品」は Loot が名乗る。（検証で実確認：cards.js に「戦利品」という name は現存しない）
       ・⚠ 検証で追記＝統合時に必須（無いと integrity テストが即赤 / CPU が無限ループ）：
         (1) `DOM.POOLS.loot = [...15件]`（賞品 prizes・略奪品 darkages_np と同じ非サプライ用の孤立プール）、
         (2) `GAIN_ORDER` に15件（全カード網羅が整合性テストの要件）、
         (3) engine の `NON_SUPPLY` と cpu の `NON_SUPPLY_SET` に15件
             ＝§0-2 の「4系統除外チェックリスト」（3山終了／購入／闇市場デッキ母集団／汎用獲得）を必ず通す。
       ・⚠ 表記メモ（検証・未変更）＝船首像の「+2 カードを引く」は研究doc の Dominion Online 訳どおり。
         既存カタログでは「+2 カード。」が優勢（209件 vs 「カードを引く」3件・例＝js/cards.js:922）。
         ユーザー決定「日本語文面は Dominion Online 訳で統一」を優先して**doc のまま残した**。 */

    // Either now or at the start of your next turn: / +1 Buy and +$3.
    // ※ +$3 は選択肢の中にあるので静的な coin にしない（研究doc 第5章「機械的な整合」）。
    amphora: { id: 'amphora', name: 'アンフォラ', cost: 7, types: ['treasure', 'duration', 'loot'], coin: 0,
                 text: '現在またはあなたの次のターンの開始時に、\n+1 購入、+3 コイン。' },

    // $3 / ――― / When you gain this, gain a Gold.
    doubloons: { id: 'doubloons', name: 'ダブロン金貨', cost: 7, types: ['treasure', 'loot'], coin: 3,
                 text: '3 コイン\n————\nこれを獲得したとき、金貨1枚を獲得する。' },

    // Now and at the start of each of your turns for the rest of the game: / $1 / +1 Buy
    // ※ coin:1 は「現在」ぶん（＝香辛料 spices と同じ形＝コインは coin フィールド／+1購入は効果側）。
    // ⚠ 実装メモ: **「現在」ぶんの +1 購入も効果側で足す必要がある**。coin:1 とあわせて
    //    「現在」の +1 コインを効果側でも足すと二重計上になる（coin フィールドが既に払っている）。
    //    各ターン開始時の 1 コイン/+1 購入 は永続持続（p.hirelings/p.champions と同型）で engine 側に持つ。
    endless_chalice: { id: 'endless_chalice', name: '尽きぬ杯', cost: 7, types: ['treasure', 'duration', 'loot'], coin: 1,
                 text: '現在と、ゲーム終了まであなたの各ターンの開始時に、\n1 コイン\n+1 購入' },

    // $3 / ――― / At the start of your next turn, +2 Cards.
    figurehead: { id: 'figurehead', name: '船首像', cost: 7, types: ['treasure', 'duration', 'loot'], coin: 3,
                 text: '3 コイン\n————\nあなたの次のターンの開始時、+2 カードを引く。' },

    // $3 / ――― / Gain a card costing up to $4.
    hammer: { id: 'hammer', name: 'ハンマー', cost: 7, types: ['treasure', 'loot'], coin: 3,
                 text: '3 コイン\n————\nコスト4以下のカード1枚を獲得する。' },

    // $3 / ――― / This turn, when you gain a card, you may put it onto your deck.
    insignia: { id: 'insignia', name: '勲章', cost: 7, types: ['treasure', 'loot'], coin: 3,
                 text: '3 コイン\n————\nこのターン、カード1枚を獲得したとき、それを山札の上に置いてもよい。' },

    // $3 / +1 Buy / ――― / At the start of your next turn, put this on the bottom of your deck.
    jewels: { id: 'jewels', name: '宝石', cost: 7, types: ['treasure', 'duration', 'loot'], coin: 3,
                 text: '3 コイン\n+1 購入\n————\nあなたの次のターンの開始時に、これを山札の一番下に置く。' },

    // Look through your discard pile. Choose one: Play an Action or Treasure from it; or / +1 Buy and +$3.
    // ※ +$3 は選択肢の中にあるので静的な coin にしない。「捨て札をすべて見る」は選択の前に必ず行う前段。
    orb: { id: 'orb', name: '宝珠', cost: 7, types: ['treasure', 'loot'], coin: 0,
                 // ⚠ 検証で訂正: 旧="・+1 購入 と +3 コイン"（研究doc は「+1 購入、+3 コイン」＝アンフォラと同じ表記）。
                 // ※箇条書き（次から1つを選ぶ：＋「・」）は既存カタログの表記（js/cards.js:168 待ち伏せ等）に合わせたもの。
                 //   研究doc の表は wiki のインライン表記（「…」;「…」）なので、そのままカード文にはしない。
                 // ⚠ 実装メモ: 宝珠は choose-one＝長老(Elder)の追加選択対象（研究doc 第5章 落とし穴13）。
                 //   ELDER_CHOICE_ORDER に載せるか、載せないなら許容簡略化として PROGRESS に明記すること。
                 text: '捨て札置き場のカードをすべて見る。次から1つを選ぶ：\n・その中のアクションカードか財宝カード1枚を使用する\n・+1 購入、+3 コイン' },

    // $3 / +1 Buy / ――― / You may trash a card from your hand.
    prize_goat: { id: 'prize_goat', name: '賞品のヤギ', cost: 7, types: ['treasure', 'loot'], coin: 3,
                 text: '3 コイン\n+1 購入\n————\n手札1枚を廃棄してもよい。' },

    // $3 / +1 Buy / ――― / You may set aside a card from your hand face down. Put it into your hand at end of turn.
    puzzle_box: { id: 'puzzle_box', name: 'パズルボックス', cost: 7, types: ['treasure', 'loot'], coin: 3,
                 text: '3 コイン\n+1 購入\n————\n手札1枚を脇に伏せて置いてもよい。ターン終了時にそれを手札に加える。' },

    // $3 / +1 Buy / ――― / Look at the top 5 cards of your deck. Discard any number. Put the rest back in any order.
    sextant: { id: 'sextant', name: '六分儀', cost: 7, types: ['treasure', 'loot'], coin: 3,
                 text: '3 コイン\n+1 購入\n————\n山札の上から5枚を見る。その中の好きな枚数を捨て札にする。残りを好きな順番で山札の上に戻す。' },

    // $3 / +1 Buy / ――― / When another player plays an Attack, you may first reveal this from your hand to be unaffected.
    shield: { id: 'shield', name: '盾', cost: 7, types: ['treasure', 'reaction', 'loot'], coin: 3,
                 text: '3 コイン\n+1 購入\n————\n他のプレイヤーがアタックカードを使用するとき、その解決前に、手札からこれを公開してもよい。公開した場合、そのアタックカードの影響を受けない。' },

    // Trash this to gain a cheaper card. If it's an Action or Treasure, you may play it.
    // ※ 日本語の印刷版「これを廃棄して、これよりもコストの少ないカード1枚を獲得する」は
    //    ルールミスを誘発する誤訳（日本語wiki が名指しで警告）＝差し戻し禁止。
    //    英語原文は「廃棄できた場合にだけ獲得する」＝命令(Command)経由では廃棄が失敗し獲得も起きない。
    spell_scroll: { id: 'spell_scroll', name: '呪符の巻物', cost: 7, types: ['action', 'treasure', 'loot'], coin: 0,
                 text: 'これを廃棄する。廃棄した場合、これより安いカード1枚を獲得する。それがアクションカードか財宝カードの場合、使用してもよい。' },

    // $3 / +1 Buy / ――― / You may play an Action from your hand.
    staff: { id: 'staff', name: '杖', cost: 7, types: ['treasure', 'loot'], coin: 3,
                 text: '3 コイン\n+1 購入\n————\n手札からアクションカード1枚を使用してもよい。' },

    // $3 / +1 Buy / ――― / Each other player discards down to 4 cards in hand.
    sword: { id: 'sword', name: '剣', cost: 7, types: ['treasure', 'attack', 'loot'], coin: 3,
                 text: '3 コイン\n+1 購入\n————\n他のプレイヤーは全員、手札が4枚になるように捨て札にする。' },

    /* ========== 旭日（Rising Sun）王国カード 1/? ＝ $2〜$3 の6枚 ==========
       正本＝docs/research/risingsun_rules.md 第2章（1756行〜。多エージェント研究＋敵対検証＋完全性の批評を反映した第2稿）。
       日本語のカード文面は Dominion Online 訳（＝日本語wiki 掲載。§4 決定3の方針）を既存カタログの言い回しへ寄せたもの
       （「+N カードを引く」→「+N カード」の正規化。EN/JP 対応表＝C:/tmp/risingsun_research/g0_jp_pairs.md）。
       6枚とも Versions 表は `First edition / August 2024` の1行のみ＝**機能エラッタ無し・刷りは初版のみ**。
       ⚠ Aristocrat／Craftsman の Secret history にある「$4 → $3 にした」は**開発中の話でエラッタではない**。
       ⚠ 区切り線（————）を持つのは fishmonger / riverboat の2枚だけ（英語wiki の生HTML の <hr> をカード文の中だけ数えて確認）。
         snake_witch / aristocrat / craftsman / root_cellar の行間は段落の切れ目であって区切り線ではない。
       ⚠ **新種別 `shadow`（影）** をここで初めて使う（魚屋）。表示ラベルの登録は**この作業ツリーで既に済んでいる**
         （検証時に実測＝`js/carddata.js:116-117` の ALLIES_TYPE_JP/EN・`js/ui.js:130` の TYPE_JP・
          `test/integrity.test.js:120-121` の JP/EN の4箇所すべてに `shadow: '影'` / `omen: '前兆'` が入っている）
         ＝**二重に足さないこと**（登録漏れは §A2 の「全カード種別が TYPE_JP にあるか」の恒久検査が捕まえる）。
         影カードは**裏面が5種とも違う絵**＝webp の扱いを別途決める（研究doc 第2章 Fishmonger の ⚠2）。
       ⚠ `+2 負債` / `+3 負債`（名匠・室）＝**効果で負債を得る新しい入口**。カタログ上は表示テキストだけ。
         **表記は「+N 負債」に統一した**＝既存761枚の資源行が `+N コイン` / `+N カード` 形で
         **696箇所すべてこの語順**（`+資源N` 形は0箇所）＋文中形は `+8 勝利点を得て`（mountain_pass）。
         コスト$5群の起草（金山＝`+4 負債` / 勅使＝`+2 負債` / 駕籠＝`+1 負債`）とも一致させてある。
         ※研究doc の例示は `+負債2` だが、同doc 自身が「表記は実装時に統一を決めること」と保留している箇所。
         既存の負債は「コスト」だけだったので `debt:` フィールドは**付けない**（`debt:` はコスト用＝技術者/大金と同じ意味）。
         段階2では `takeDebt`（カードの負債"コスト"を読む関数）を流用せず `addDebt` を新設すること（研究doc 第2章 Craftsman ⚠1）。
       ⚠ 川船は `Setup:` を持つ唯一の王国カード＝`state.riverboatCard`（サプライに載せない脇の1枚）が要る。
         前例＝ハツカネズミの習性の `state.mouseCard`（若き魔女の災いカード Bane とは構造が違う＝あちらは11山目）。
       ⚠ 公家は「場に出している公家の枚数」であって「このターン使用した回数」ではない（公式FAQ）。 */
    // --- コスト$2（2種） ---
    // +1 Buy / +[$1] / --- / You can play this from your deck as if in your hand.
    fishmonger: { id: 'fishmonger', name: '魚屋', cost: 2, types: ['action', 'shadow'],
                 text: '+1 購入\n+1 コイン\n————\nこれは手札からと同様に山札からも使用できる。' },
    // +1 Card / +1 Action / If your hand has no duplicate cards, you may reveal it and return this to its pile, to have each other player gain a Curse.
    snake_witch: { id: 'snake_witch', name: '濡女', cost: 2, types: ['action', 'attack'],
                 text: '+1 カード\n+1 アクション\n手札のカードがすべて異なる場合、手札を公開しこれをこのカードの山に戻してもよい。\nそうした場合、他のプレイヤーは全員、呪い1枚を獲得する。' },
    // --- コスト$3（4種） ---
    // If the number of Aristocrats you have in play is: / 1 or 5: +3 Actions; / 2 or 6: +3 Cards; / 3 or 7: +[$3]; / 4 or 8: +3 Buys.
    aristocrat: { id: 'aristocrat', name: '公家', cost: 3, types: ['action'],
                 // ⚠ 行頭に全角空白を置かない（webp のレンダラが「折返しの継続行」に同じ U+3000 を使うため紛れる）。
                 text: '場に出している公家の枚数が\n1枚か5枚の場合、+3 アクション\n2枚か6枚の場合、+3 カード\n3枚か7枚の場合、+3 コイン\n4枚か8枚の場合、+3 購入' },
    // +[2D] / Gain a card costing up to [$5].
    craftsman: { id: 'craftsman', name: '名匠', cost: 3, types: ['action'],
                 text: '+2 負債\nコスト5以下のカード1枚を獲得する。' },
    // +3 Cards / +1 Action / +[3D]
    root_cellar: { id: 'root_cellar', name: '室', cost: 3, types: ['action'],
                 text: '+3 カード\n+1 アクション\n+3 負債' },
    // At the start of your next turn, play the set aside card, leaving it there. / --- / Setup: Set aside an unused non-Duration Action card costing [$5].
    riverboat: { id: 'riverboat', name: '川船', cost: 3, types: ['action', 'duration'],
                 text: 'あなたの次のターンの開始時に、脇に準備したカードを動かさずに使用する。\n————\n準備：このゲームで使わない、持続ではなくアクションであるコスト5の王国カード1枚を脇に置く。' },
    /* ---------- 旭日（Rising Sun）王国カード ＝ コスト$4 の6枚 ----------
       正本＝docs/research/risingsun_rules.md 第3章（2611行〜。多エージェント研究＋敵対検証＋完全性の批評で確定）。
       日本語のカード文面は Dominion Online 訳（＝日本語wiki 掲載。決定D1）を既存カタログの言い回しへ寄せたもの。
       6枚とも 2024年8月の初版のみ＝**機能エラッタ 0件**（各カードページの Errata 出現数 0 を機械確認）。
       ⚠ 区切り線（————）を持つのは alley / ninja の2枚だけ（＝影(Shadow)の裏面ではなく表の線の下に
         「これは手札からと同様に山札からも使用できる。」が入る）。change / poet / river_shrine /
         rustic_village は <hr> が0本。
       ⚠ 新種別は **omen（前兆）／shadow（影）** の2つ。表示ラベルの登録先は**5箇所**＝js/carddata.js の
         `ALLIES_TYPE_JP`／`ALLIES_TYPE_EN`・js/ui.js の `TYPE_JP`・test/integrity.test.js の `JP`／`EN`
         （登録漏れは恒久検査が即赤にする）。**枠スキンの新設は不要**＝`frameType` が ninja→attack・他4枚→action に落とす。
       ⚠ 「+1 Sun」は前兆カードの記載の**一番最初**に必ず来る（poet / river_shrine / rustic_village）。
         ＝予言(Prophecy)がそのカードの残りの効果より前に有効化されうる（段階2で効く。カタログ文の順序は変えないこと）。 */
    // +1 Card / +1 Action / Discard a card. / --- / You can play this from your deck as if in your hand.
    alley: { id: 'alley', name: '小路', cost: 4, types: ['action', 'shadow'],
                 text: '+1 カード\n+1 アクション\n手札1枚を捨て札にする。\n————\nこれは手札からと同様に山札からも使用できる。' },
    // If you have any [D], +[$3]. Otherwise, trash a card from your hand, and gain a card costing more [$] than it. +[D] equal to the difference in [$].
    // ⚠ 段階2: 「more [$]」は**コイン成分だけの厳密比較**（公式FAQ逐語 `This ignores other special aspects of cost`
    //   ＝屋敷$2 を廃棄して 錬金術師$3+P を獲得できる）。既存の costUnder/costUpTo/costLE は3成分すべてを見るので使えない。
    //   → `gainableBase(state, id) && cardCost(state, id) > cardCost(state, 廃棄したid)` と書く。
    // ⚠ 段階2: 負債の差は**獲得を完全に解決した後に両方を測り直す**（Other rules clarifications 1・2）。本アプリは
    //   行人(wayfarer)／漁師(fisherman)／デストリエ(destrier) の動的コストで実際に踏む＝廃棄時に差を確定すると壊れる。
    //   **獲得できなければ負債は取らない**（支配で獲得者が別人になった場合も0）。
    // ⚠ 段階2: `takeDebt(state, pi, cardId)` は **cardId から `C()[cardId].debt` を読む**（engine.js:1938）＝
    //   change に debt 欄が無いので**黙って0**になる。個数を渡す汎用版を作ること（支配の振り分けは engine.js:1942 に倣う）。
    change: { id: 'change', name: '交替', cost: 4, types: ['action'],
                 // ⚠ 改行は2行（公式カードは改行なしの1段落）。「コインコストの差だけ負債」は**獲得できた場合だけ**＝
                 //    3行に割ると無条件の効果に見える（公式FAQ＝`You don't take any [D] if you don't gain a card`）。
                 text: '負債を持っている場合、+3 コイン。\nそれ以外の場合、手札1枚を廃棄し、それよりコインコストが高いカード1枚を獲得する。コインコストの差に等しい数だけ負債を得る。' },
    // +1 Card / Each other player discards down to 3 cards in hand. / --- / You can play this from your deck as if in your hand.
    ninja: { id: 'ninja', name: '忍者', cost: 4, types: ['action', 'attack', 'shadow'],
                 text: '+1 カード\n他のプレイヤーは全員、手札が3枚になるように捨て札にする。\n————\nこれは手札からと同様に山札からも使用できる。' },
    // +1 [Sun] / +1 Card / +1 Action / Reveal the top card of your deck. If it costs [$3] or less, put it into your hand.
    // ⚠ 段階2: 「コスト3以下」に **`costUpTo` を使ってはいけない**（`gainableBase` 込み＝非サプライ・在庫切れを弾く。
    //   見るのは山札の一番上＝サプライと無関係）。`costLE(costOf(state, top), { coin: 3, pot: 0, debt: 0 })` と書く
    //   ＝**ウィル・オ・ウィスプ（`will_o_wisp`）の case が文面まで同型**なのでコピーして 2→3 にするのが最短。
    //   手札に入れなかった1枚は**山札の上に残る**（捨て札置き場を経由しない）＝pending 不要。
    poet: { id: 'poet', name: '歌人', cost: 4, types: ['action', 'omen'],
                 text: '+1 Sun\n+1 カード\n+1 アクション\n山札の一番上のカードを公開する。それがコスト3以下の場合、手札に加える。' },
    // +1 [Sun] / Trash up to 2 cards from your hand. At the start of Clean-up, if you didn't gain any cards in your Buy phase this turn, gain a card costing up to [$4].
    // ⚠ 段階2: 「購入フェイズに獲得したか」は**既存の `t.buyPhaseGained`（ターン単位）**を使う。**新しい旗を作らない**。
    //   隣の `t.bpGained` は `END_ACTION_PHASE` で0に戻るので掴むと公式違反（ヴィラ／発進／継続で購入フェイズに
    //   入り直すと不当に獲得する）。クリンナップ開始時の窓は増築(Improve)と同型＝`t.cleanupWaiting` の再入に乗せる。
    //   **累積する**（2枚使えば2枚獲得）＝場の枚数ではなく `t.improvePlays` と同型の**プレイ回数**で数える。
    river_shrine: { id: 'river_shrine', name: '川の社', cost: 4, types: ['action', 'omen'],
                 text: '+1 Sun\n手札を最大2枚廃棄してもよい。\nクリーンアップフェイズの開始時、このターン購入フェイズにカードを獲得しなかった場合、コスト4以下のカード1枚を獲得する。' },
    // +1 [Sun] / +1 Card / +2 Actions / You may discard 2 cards for +1 Card.
    // ⚠ 段階2: 「**ちょうど2枚**」＝手札1枚以下では窓を開かない。民兵型の `discardDownEnter`（N枚に*なるまで*捨てる）
    //   を流用してはいけない（剣・切り裂き魔の `down` 指定とも別物）。任意なので「やめる」ボタン必須。
    //   順序＝**捨てる → `triggerOnDiscard` を解決 → その後に +1 カードを引く**（逆順だと坑道の金貨がリシャッフルに入らない）。
    rustic_village: { id: 'rustic_village', name: '田舎の村', cost: 4, types: ['action', 'omen'],
                 text: '+1 Sun\n+1 カード\n+2 アクション\n+1 カードを引くために手札2枚を捨て札にしてもよい。' },
    /* ===== 旭日（Rising Sun）王国カード ＝ コスト$5 の8枚 =====
       ⚠ この$5群は **Tea House（茶屋）** を含む。**Kabuki というカードは Rising Sun に存在しない**
         （英語wiki・日本語wiki・研究doc 第4章・g0_jp_pairs.md のいずれにも無い）＝起草時に混入した誤りで、
         `DOM.POOLS.risingsun` / `GAIN_ORDER` とも `tea_house` で確定済み。次に触るとき戻さないこと。
       正本＝docs/research/risingsun_rules.md 第4章（英語wiki 8ページ＋日本語wiki 8ページを敵対検証済み）。
       8枚とも Versions 表は「First edition / August 2024」の1行のみ＝**機能エラッタ 0件**。
       8枚とも素のコイン費用$5（負債コスト・ポーション費用は持たない＝`costIsPlainCoin` が真）。
       ⚠ 金山／勅使／駕籠 の負債は**コスト欄ではなく使用時に負う負債**＝`debt:` フィールドは付けない
         （既存 `takeDebt(state, pIndex, cardId)` は `C()[cardId].debt`＝コスト欄を読むので 0 になる。
          段階2で「金額を引数で受ける on-play 版」を新設すること。支配(Possession)の振り分けは必ず引き継ぐ）。
       日本語文面＝Dominion Online 訳（PROGRESS §4 の2026-08-15 決定3／研究doc の決定D1）。
       研究doc の逐語からの意図的な差分は次の4種だけ：
         (1) 資源行を既存761枚の慣習へ正規化＝「+N カードを引く」→「+N カード」。
         (2) 負債の記号 `+<N>` を文字へ＝**「+N 負債」**（既存の資源行 `+1 コイン` と同じ形。
             文中に置く場合は `+8 勝利点を得て`＝mountain_pass の書き方に合わせ、助詞の前に空白を入れない）。
         (3) 区切り線を既存カタログの形へ＝「--------------------」→「————」（U+2014×4・cards.js の73箇所と同一）。
         (4) 「選ぶ」の書式を既存カタログの形へ＝「次のうち異なる2つを選ぶ：」＋「「〜」：」
             → **「次から異なる2つを選ぶ：」＋「／」区切りの1行**（狐）。
             ＝「異なる2つを選ぶ」を持つ既存3枚（従者 js/cards.js:96／執事:386／道化棒:1015）が**3枚とも「／」1行**で、
               道化棒は長い節（「このターン、あなたがカード1枚を獲得するとき、…」）を含んでなお「／」＝その系統に揃えた。
             ⚠ 検証で訂正＝**pawn は「・」ではない**（旧コメントの「pawn/cabin_boy と同じ house style」は誤り）。
               ・見出し「次から異なる2つを選ぶ：」は **pawn（js/cards.js:96）と一字一句同じ**＝ここは正しい。
               ・箇条書き「・」の前例は **cabin_boy(1193) / 待ち伏せ(168) / 宝珠(1379) / 町民(1112) 等16件以上**＝
                 「選択肢が節（文）になっているカード」はすべてこの形。狐は4択のうち2つが節なのでこの形を採った。
               ・⚠ ただし**「異なる2つを選ぶ」を持つ既存3枚（pawn:96／386／道化棒:1015）は3枚とも「／」区切りの1行形式**。
                 道化棒は長い節を含んでいてなお「／」なので、**その系統に揃えるなら「／」1行が正解**。
                 ＝忠実性には無関係な表記の選択。**変えるならこの4行を消して1行に畳むだけ**（機能・検査に影響なし）。
       ⚠ 区切り線（————）を持つのは **浪人(ronin) と 狸(tanuki) の2枚だけ**
         （研究doc 第4章の `<hr>` 機械検算＝カード文セル内の `<hr style="width:66%;...">` を8ファイル全部で実測。
          Ronin/Tanuki は本文と Shadow の但し書きの間に1本。他6枚は0本）。
       ⚠ 狐(kitsune) の選択肢の並びは**英語原文の順**（+2 アクション → +2 コイン → 呪い → 銀貨）に揃えてある。
         日本語wiki の訳文だけが `+2 コイン` を先に置いているが、公式FAQ が「**カード記載順**に解決する」と定めており、
         その記載順は英語原文の順（研究doc 第4章 Kitsune ⚠1／⚠4）。
       ⚠ 新種別＝**`omen`（前兆）** と **`shadow`（影）**。表示ラベルは js/carddata.js の ALLIES_TYPE_JP/EN・
         js/ui.js の TYPE_JP・test/integrity.test.js の JP/EN の**計5箇所**へ登録すること（1つでも漏れると恒久検査が赤）。 */
    // +1 Card / +1 Action / +1 Buy / You may gain a Gold and get +4D.
    // ⚠ 「You may」は「金貨獲得」と「+4負債」の**セット**に掛かる（公式FAQ＝`You can't gain a Gold without taking 4D.`）。
    //   DO訳は「金貨1枚と +4負債 を*獲得*してもよい」と書くが、原文は `gain a Gold and **get** +4D`＝負債は負う側。
    //   ⚠ サプライに金貨が無くても「やる」を選べる（＝負債4だけ負う。日本語wiki の裁定。交替(Change) との併用で実利がある）。
    gold_mine: { id: 'gold_mine', name: '金山', cost: 5, types: ['action'],
                 text: '+1 カード\n+1 アクション\n+1 購入\n金貨1枚と +4 負債を獲得してもよい。' },
    // +5 Cards / +1 Buy / +2D
    // ⚠ 強制（"may" 無し）＝窓を開かず自動で負う。記載順（+5カード → +1購入 → +2負債）を守ること。
    imperial_envoy: { id: 'imperial_envoy', name: '勅使', cost: 5, types: ['action'],
                 text: '+5 カード\n+1 購入\n+2 負債' },
    // +1 Sun / Choose two different options: +2 Actions; +$2; each other player gains a Curse; gain a Silver.
    // ⚠ 区切り線なし（+1 Sun の後は同じカード文の続き）。⚠ アタックのリアクション窓は**選択より前**に開く
    //   （呪いを選ばなかった場合でも開く＝日本語wiki の裁定）。呪いの山が空でも他の3択は普通に働く。
    kitsune: { id: 'kitsune', name: '狐', cost: 5, types: ['action', 'attack', 'omen'],
                 text: '+1 Sun\n次から異なる2つを選ぶ：\n+2 アクション／+2 コイン／他のプレイヤーは全員、呪い1枚を獲得する／銀貨1枚を獲得する' },
    // +2 Cards / +2 Actions / +1D
    // ⚠ 強制（"may" 無し）。⚠ 支配(Possession)では負債を負うのは**支配者**（英語wiki `Debt` ページに明文あり）。
    litter: { id: 'litter', name: '駕籠', cost: 5, types: ['action'],
                 text: '+2 カード\n+2 アクション\n+1 負債' },
    // +1 Action / Trash a card from your hand. If it's a Treasure, +2 Cards. If it's an Action, +5 Cards.
    // ⚠ 「財宝かつアクション」なら +2 と +5 の**両方**（合計7枚）＝排他の if/else で書くと壊れる（公式FAQ 明記）。
    //   静的に該当するのは全761枚中 crown（帝国）と spell_scroll（略奪）の2枚＋資本主義＋予言 Enlightenment
    //   （検証で機械確認＝`types` に action と treasure を両方持つ既存カードはこの2枚ちょうど）。
    // ⚠ 表記メモ（検証・未変更）＝DO訳は「+2 カードを引く、…、+5 カードを引く。」だが「を引く」を落とした。
    //   根拠＝同型の条件つきボーナスは既存カタログでも「を引く」を落とすのが優勢
    //   （馬丁 js/cards.js:856「勝利点カードの場合、+1 カード、+1 アクション。」＝種別で分岐する完全な同型／
    //    寂れた村:98「アクションが無ければ +2 カード。」ほか計8件。付ける側は封土:598・内気な:2477 の3件）。
    //   ⚠ **旭日の他の群も同じ判断で揃っている**（山の社＝「…ある場合、+2 カード。」）＝ここだけ戻すと不揃いになる。
    rice_broker: { id: 'rice_broker', name: '札差', cost: 5, types: ['action'],
                 text: '+1 アクション\n手札1枚を廃棄する。\nそれが財宝カードの場合、+2 カード。\nそれがアクションカードの場合、+5 カード。' },
    // Draw until you have 7 cards in hand. / ———— / You can play this from your deck as if in your hand.
    // ⚠ 区切り線 **1本**（実測）。⚠ 専用の裏面を持つ（Info に `Card back` 行あり）。
    //   ⚠ Secret history＝元はアタック枠だったが差し替え済み＝**現行にアタック要素は無い**（`ATTACKS` に登録しない）。
    ronin: { id: 'ronin', name: '浪人', cost: 5, types: ['action', 'shadow'],
                 text: '手札が7枚になるようにカードを引く。\n————\nこれは手札からと同様に山札からも使用できる。' },
    // Trash a card from your hand. Gain a card costing up to $2 more than it. / ———— / You can play this from your deck as if in your hand.
    // ⚠ 区切り線 **1本**（実測）。⚠ 専用の裏面を持つ。効果は改築(remodel)と同型＝既存 REMODEL_TRASH/GAIN と `costUpTo` の
    //   `spec` 引数をそのまま流用すること（Artist[$0+負債8] を廃棄して Daimyo[$0+負債6] を取れるのが公式例）。
    tanuki: { id: 'tanuki', name: '狸', cost: 5, types: ['action', 'shadow'],
                 text: '手札1枚を廃棄する。\nそれよりコストが最大2コイン高いカード1枚を獲得する。\n————\nこれは手札からと同様に山札からも使用できる。' },
    // +1 Sun / +1 Card / +1 Action / +$2
    // ⚠ 区切り線なし。⚠ +1 Sun は「may」ではない＝強制（Sun を進めたくない局面があっても避けられない）。
    tea_house: { id: 'tea_house', name: '茶屋', cost: 5, types: ['action', 'omen'],
                 text: '+1 Sun\n+1 カード\n+1 アクション\n+2 コイン' },
    /* ---------- 旭日（Rising Sun）王国カード ＝ 負債コスト3枚 ＋ $6 ＋ $7 の5枚 ----------
       正本＝docs/research/risingsun_rules.md 第5章（4230〜4930行）＋ C:/tmp/risingsun_research/g0_jp_pairs.md。
       日本語のカード文面は Dominion Online 訳（＝日本語wiki 掲載）を既存カタログの言い回しへ寄せたもの（決定D1）。
       5枚とも初版（2024年8月）のみ＝**機能エラッタ無し**。
       ⚠ 区切り線（————）は**5枚とも0本**（研究doc が生HTMLの <hr> を機械カウント／侍は実物カード画像でも横線なしを確認）。
         侍は持続カードなので線が入っていそうに見えるが実際は無い。取り違えないこと。
       ✅ 表示ラベルは**この5枚については追加作業ゼロ**（実際に carddata.js を通して機械確認した）：
         山の社＝「アクション・前兆 / Action - Omen」／大名＝「アクション・命令 / Action - Command」／
         侍＝「アクション・持続・アタック / Action - Duration - Attack」／米＝「財宝 / Treasure」／絵師＝「アクション / Action」。
         `omen`/`shadow` は js/carddata.js の ALLIES_TYPE_JP/EN・js/ui.js の TYPE_JP・test/integrity.test.js の
         JP/EN マップに**登録済み**（同盟の「types 配列の順に連ねる」汎用規則にそのまま乗る）。
         枠スキンも frameType が既存の action/treasure/duration に落ちるので新設不要。
       🛑 **ただし「表示以外」で1つだけテストが赤くなる＝資本主義(Capitalism)の財宝集合が 140 → 142 になる**
         （`DOM.engine.capitalismTreasures()` を実行して機械確認した。増えるのは
          **`mountain_shrine`（+2 コイン）と `samurai`（+1 コイン）の2枚**＝どちらもカード文に「+N コイン」を持つアクション）。
         `test/integrity.test.js` の「資本主義：財宝になるアクションの集合が固定されている」は**期待集合と枚数を直書きで固定している**
         ので、**組み立て時に必ずこの2枚と枚数を追記すること**（PROGRESS §0-22 の「カタログ文を1文字触ると集合が静かに変わる」）。
         ⚠ **これは公式どおり＝除外してはいけない**。侍の +$1 は「次のターン以降の開始時」だが、
         既存カタログも隊商の護衛/魔除け/ワイン商など**将来ターンの +$ を持つアクションを資本主義の対象に入れている**
         （§0-22 の `CAPITALISM_EXTRA`）＝侍だけ外すと非対称になる。
         ※ 米は元から財宝／大名・絵師はカード文に「コイン」が無い＝この3枚は集合に入らない（確認済み）。
       ⚠ **`+1 Sun` の "Sun" は英語のまま**が正（DO訳＝日本語wiki のカード文がそのまま `+1 Sun`。
         正本の §1-4 の前兆6種の表も6枚すべて `+1 Sun` で統一されている）。訳語は「Sunトークン」。
         **前兆は6種あり別の担当群に散っている**（山の社＝この群／歌人・川の社・田舎の村・茶屋・狐＝別群）ので、
         組み立て時に**6枚とも `+1 Sun` で揃っているか**を必ず突き合わせること（1枚だけ「+1 日の出」等になると表記が割れる）。
       ⚠ 負債コストは cost:0 + debt:N（帝国の技術者/大君主と同じ形）。**コイン成分ゼロ**なので
         costUpTo の既定（debt:0）で自動的に「コスト$N以下」の候補から外れる＝公式どおり
         （rulebook が名指し＝`Craftsman can't gain a Mountain Shrine` / `Poet cannot draw a Mountain Shrine` /
          `Change can't gain a Mountain Shrine`）。段階2で素の `cardCost(state,id) <= N` を書くと壊れる。
       ⚠ 逆に「$2高いカードまで」「これより安い」系（狸 Tanuki／金継ぎ Kintsugi／石工／墓暴き…）は
         `spec`（pot/debt の3成分）を渡さないと Artist(8D) を廃棄しても Daimyo(6D) が候補から消える
         （公式例＝`Tanuki trashing an Artist can gain a Daimyo`）。段階2の必読事項。
       ※ 並びはコスト昇順→負債の順にしてあるが、最終的な js/cards.js への配置順は組み立て側で自由に変えてよい。 */
    // --- コスト$6（1種） ---
    // Each other player discards down to 3 cards in hand (once). / At the start of each of your turns this game, +[$1]. / (This stays in play.)
    // ⚠ 種別は「アクション-持続-アタック」＝実物カードの種別行 `Action - Duration - Attack`（研究doc が m_samurai.jpg で目視確認）。
    //   日本語wiki のヘッダ表は「アクション-アタック」と書きカード文の途中に「持続」を挟んでいるが、それは表の作りの都合。
    //   ＝米(Rice)の「異なる種別」の数え上げに直結するので取り違えないこと（侍1枚で3種別を供給する）。
    // ⚠ 永続持続（ゲーム終了まで場に残る）＝段階2では armDuration ではなく p.samurais のカウンタで持つ
    //   （雇人/チャンピオン/尽きぬ杯/操舵手と同型。`permanentDurationCounts` に足す）。
    samurai: { id: 'samurai', name: '侍', cost: 6, types: ['action', 'duration', 'attack'],
                 text: '他のプレイヤーは全員、手札が3枚になるように捨て札にする（1度のみ）。\nゲーム終了まで、あなたのターンの開始時に、+1 コイン。\n（このカードは場に残り続ける。）' },
    // --- コスト$7（1種） ---
    // +1 Buy / +[$1] per different type among cards you have in play.
    // ⚠ coin: 0 ＝コイン量が動的（場のカードの異なる種別数）なので静的コインは持たせない（坩堝 crucible と同じ扱い）。
    //   段階2では applyTreasureEffect に書くこと（applyEffect に書くと財宝では呼ばれず空振りする）。
    // ⚠ 数えるのは「種別」であってカードではない（大名＝Action+Command／魚屋＝Action+Shadow／侍＝Action+Duration+Attack）。
    //   米自身の Treasure も数える。公式例＝大名・駕籠・魚屋・銅貨×3・米 で {Action, Command, Shadow, Treasure} ＝ +$4。
    rice: { id: 'rice', name: '米', cost: 7, types: ['treasure'], coin: 0,
                 text: '+1 購入\n場に出しているカードの異なる種別1つにつき、+1 コイン。' },
    // --- 負債コスト（3種） ---
    // +1 [Sun] / +[$2] / You may trash a card from your hand. Then if there are any Action cards in the trash, +2 Cards.
    // ⚠ 前兆(Omen)＝「+1 Sun」は必ず記載の一番最初に来る（公式逐語）。予言(Prophecy)が有効化されるのはこの位置。
    // ⚠ 廃棄は任意だが判定は廃棄しなくても必ず走る（手札0枚でも廃棄置き場にアクションがあれば +2 カード）。
    mountain_shrine: { id: 'mountain_shrine', name: '山の社', cost: 0, debt: 5, types: ['action', 'omen'],
                 text: '+1 Sun\n+2 コイン\n手札1枚を廃棄してもよい。\nその後、廃棄置き場にアクションカードがある場合、+2 カード。' },
    // +1 Card / +1 Action / The next time you play a non-Command Action card this turn, replay it afterwards.
    // ⚠ 略奪の旗艦(Flagship)とほぼ同型だが **DO訳の言い回しが原文どおり違う**
    //   （旗艦＝「命令カード以外のアクションカード1枚」／大名＝「命令でないアクションカード」）＝誤記ではないので揃えない。
    // ⚠ 旗艦は「次に〜したとき」で何ターンでも持ち越すが、**大名は "this turn" ＝そのターン限り**
    //   （公式FAQ逐語＝`or fails to do anything more if the turn ends before you play one`）。
    //   段階2で armNextTime の器をそのまま流用すると翌ターンへ漏れて存在しない再演が湧く。
    daimyo: { id: 'daimyo', name: '大名', cost: 0, debt: 6, types: ['action', 'command'],
                 text: '+1 カード\n+1 アクション\nこのターン、次に命令でないアクションカードを使用したとき、それを再使用する。' },
    // +1 Action / +1 Card per card you have exactly one copy of in play.
    // ⚠ 数えるのは「ちょうど1枚だけ場にあるカードの種類数」（種別は問わない＝銅貨も数える）。自分自身も数える。
    //   0枚ドローは正常系（場が銅貨3枚だけなら +0 カード）＝「候補ゼロだから窓を開かない」補正を入れてはいけない。
    //   ⚠ 米(Rice)の「異なる種別」とはまったく別の数え方＝ヘルパを共用しないこと。
    // ⚠ ホビージャパン印刷版は「あなたの場に1枚だけ出ているカード1種類につき、＋1 カードを引く。」＝
    //   「1枚につき」／「1種類につき」の1語違いだけで機能差ゼロ。方針どおり DO訳を採用。
    artist: { id: 'artist', name: '絵師', cost: 0, debt: 8, types: ['action'],
                 text: '+1 アクション\n1枚だけ場に出しているカード1枚につき +1 カード。' },
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
  // 帝国 推奨10種（自作＝公式の固定10種は無い）。帝国の新機構6系統をひと通り味わえる構成：
  //   負債(技術者=獲得系・大君主=命令)／集合＝山上VPトークン(神殿・ワイルドハント)／分割山2組(開拓者-騒がしい村・投石機-石)／
  //   城の混合山(castles)／命令(大君主)＋フェイズで対象が変わる玉座(冠)／獲得で手札に入りアクションフェイズに戻る(ヴィラ)。
  //   アタック＝投石機、on-gain＝公共広場(+1購入)/神殿(山上VP強奪)/石(銀貨)/城。
  //   ※大君主と「自己移動する札（農家の市場＝自己廃棄・陣地＝自己脇置き）」は意図的に同居させない
  //     （命令の「自身が動く」clause は未実装＝§6の既知簡略化。random-empires でのみ同居し得る）。
  DOM.KINGDOM_EMPIRES = ['engineer', 'overlord', 'settlers', 'catapult', 'castles',
                         'temple', 'villa', 'forum', 'wild_hunt', 'crown'];
  // ルネサンス 推奨10種（自作＝公式の固定10種は無い）。新機構をひと通り味わえる構成：
  //   村人(追従者・パトロン)／財源(ドゥカート金貨・パトロン・剣客)／アーティファクト4種
  //   （国境警備隊＝角笛・ランタン／出納官＝鍵／剣客＝宝箱）／持続(研究)／クリンナップの格上げ(増築)／
  //   公開リアクション(パトロン)／アタック(老魔女)／山に戻る(実験)。
  DOM.KINGDOM_RENAISSANCE = ['border_guard', 'ducat', 'lackeys', 'experiment', 'improve',
                             'patron', 'research', 'old_witch', 'swashbuckler', 'treasurer'];
  /* 夜想曲 推奨10種（自作＝公式の固定10種は確認できていない）。夜想曲の新機構6系統をひと通り味わえる構成：
       夜フェイズ（守護者/取り替え子/納骨堂/吸血鬼）／家宝（ピクシー＝ヤギ・墓地＝呪いの鏡）／
       幸運→祝福（ドルイド＝準備で3枚脇／ピクシー／詩人）／不運→呪詛→状態（暗躍者／吸血鬼）／
       非サプライ山（墓地＝幽霊／吸血鬼＝コウモリ／幸運＝ウィル・オ・ウィスプ／ネクロマンサー＝ゾンビ3枚）／
       交換（取り替え子＝$3以上の獲得すべてに窓・吸血鬼↔コウモリ）。 */
  DOM.KINGDOM_NOCTURNE = ['druid', 'guardian', 'pixie', 'changeling', 'bard',
                          'necromancer', 'cemetery', 'skulk', 'crypt', 'vampire'];
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
  DOM.POOLS.darkages_np = ['spoils', 'madman', 'mercenary']; // 略奪品/狂人/傭兵（非サプライ）
  // 冒険（Adventures）＝王国30種（抽選母集団。「冒険セット」固定10種と「冒険から」ランダムが参照。page/peasant はサプライ）。
  DOM.POOLS.adventures = ['coin_of_the_realm', 'page', 'peasant', 'ratcatcher', 'raze', 'amulet', 'caravan_guard', 'dungeon', 'gear', 'guide', 'duplicate', 'magpie', 'messenger', 'miser', 'port', 'ranger', 'transmogrify', 'artificer', 'bridge_troll', 'distant_lands', 'giant', 'haunted_woods', 'lost_city', 'relic', 'royal_carriage', 'storyteller', 'swamp_hag', 'treasure_trove', 'wine_merchant', 'hireling'];
  // 冒険：トラベラーの成長先8種＝非サプライ（page/peasant の交換でのみ得る・各5枚）。賞品(prizes)と同型で
  //   ランダム抽選の母集団には入れない（POOLS.adventures から分離）。整合性テストの「全カードがどれかのプールに属す」は満たす。
  DOM.POOLS.travellers = ['treasure_hunter', 'warrior', 'hero', 'champion', 'soldier', 'fugitive', 'disciple', 'teacher'];
  // 帝国（Empires）＝段階1。非分割18＋分割両面10＋城（混合山1枠）。城の8種は POOLS.castles（混合山の中身・非選択）。
  //   random-empires 等の抽選母集団には「城の山＝'castles'」を1枠として入れる（分割山の下段が normalize されるのと同型）。
  DOM.POOLS.empires = ['engineer', 'city_quarter', 'overlord', 'royal_blacksmith', 'farmers_market', 'chariot_race', 'enchantress', 'sacrifice', 'temple', 'villa', 'archive', 'capital', 'charm', 'forum', 'groundskeeper', 'legionary', 'wild_hunt', 'crown', 'encampment', 'plunder', 'patrician', 'emporium', 'settlers', 'bustling_village', 'catapult', 'rocks', 'gladiator', 'fortune', 'castles'];
  // 帝国：城の混合山の中身＝8種を昇順（安い順）に並べた正本。createInitialState が人数別に state.castles を積む。
  DOM.POOLS.castles = ['humble_castle', 'crumbling_castle', 'small_castle', 'haunted_castle', 'opulent_castle', 'sprawling_castle', 'grand_castle', 'kings_castle'];
  // ルネサンス（Renaissance）＝王国25種（抽選母集団）。特殊山（分割山/混合山/非サプライ）は無い＝25種すべてが普通のサプライ山。
  //   プロジェクト20種とアーティファクト5種は「カードではない横型」＝DOM.LANDSCAPES 側（POOLS には入れない）。
  DOM.POOLS.renaissance = ['border_guard', 'ducat', 'lackeys', 'acting_troupe', 'cargo_ship', 'experiment', 'improve',
                           'flag_bearer', 'hideout', 'inventor', 'mountain_village', 'patron', 'priest', 'research', 'silk_merchant',
                           'old_witch', 'recruiter', 'scepter', 'scholar', 'sculptor', 'seer', 'spices', 'swashbuckler', 'treasurer', 'villain'];
  // 移動動物園（Menagerie）＝王国30種（抽選母集団）。特殊山は「馬」だけ＝POOLS.horse に分離（非サプライ）。
  //   イベント20種・習性20種は「カードではない横型」＝DOM.LANDSCAPES 側（POOLS には入れない）。
  DOM.POOLS.menagerie = ['animal_fair', 'barge', 'black_cat', 'bounty_hunter', 'camel_train', 'cardinal', 'cavalry', 'coven',
                         'destrier', 'displace', 'falconer', 'fisherman', 'gatekeeper', 'goatherd', 'groom', 'hostelry',
                         'hunting_lodge', 'kiln', 'livery', 'mastermind', 'paddock', 'sanctuary', 'scrap', 'sheepdog',
                         'sleigh', 'snowy_village', 'stockpile', 'supplies', 'village_green', 'wayfarer'];
  // 移動動物園：馬＝非サプライ30枚（「馬を獲得する」効果でのみ得る）。賞品/トラベラー成長先と同型で
  //   ランダム抽選の母集団には入れない。整合性テストの「全カードがどれかのプールに属す」は満たす。
  DOM.POOLS.horse = ['horse'];
  /* 夜想曲（Nocturne）＝段階1（カタログのみ。CARD_SETS 未参照＝実サプライには出ない）。
     正本＝docs/research/nocturne_rules.md。 */
  DOM.POOLS.nocturne = ['bard', 'blessed_village', 'cemetery', 'changeling', 'cobbler', 'conclave',
                         'crypt', 'cursed_village', 'den_of_sin', 'devils_workshop', 'druid', 'exorcist',
                         'faithful_hound', 'fool', 'ghost_town', 'guardian', 'idol', 'leprechaun',
                         'monastery', 'necromancer', 'night_watchman', 'pixie', 'pooka', 'raider',
                         'sacred_grove', 'secret_cave', 'shepherd', 'skulk', 'tormentor', 'tracker',
                         'tragic_hero', 'vampire', 'werewolf'];
  // 家宝＝開始デッキの銅貨と置き換わる非サプライ財宝。**山が存在しない**（購入も汎用獲得も不可）。
  DOM.POOLS.heirlooms = ['cursed_gold', 'goat', 'haunted_mirror', 'lucky_coin', 'magic_lamp', 'pasture', 'pouch'];
  /* 家宝（Heirloom）の対応表＝「この王国カードが使われていれば、各プレイヤーの開始デッキの銅貨1枚を
     この家宝に置き換える」。複数該当すれば複数枚が置き換わる（銅貨7枚＋屋敷3枚が基本）。
     家宝はサプライに山を作らない＝購入も汎用獲得もできない（engine の NON_SUPPLY で一括除外）。 */
  DOM.HEIRLOOM_OF = {
    cemetery: 'haunted_mirror', fool: 'lucky_coin', pixie: 'goat', pooka: 'cursed_gold',
    secret_cave: 'magic_lamp', shepherd: 'pasture', tracker: 'pouch',
  };
  // 精霊3種＋願い＋コウモリ＝非サプライ山（それぞれ専用の効果でのみ得る）。
  DOM.POOLS.nocturne_np = ['will_o_wisp', 'imp', 'ghost', 'wish', 'bat'];
  // ゾンビ3種＝ネクロマンサーを使うゲームの準備で廃棄置き場に置く（山ではない）。
  DOM.POOLS.zombies = ['zombie_apprentice', 'zombie_mason', 'zombie_spy'];

  /* 同盟（Allies）＝段階1（画像・カタログのみ。CARD_SETS からは未参照＝実プレイには出ない）。
     正本＝docs/research/allies_rules.md。王国の「山」は31個＝非分割25＋分割山6。
     DOM.POOLS.allies が抽選/闇市場の母集団になる枠で、**分割山の中身24種は山にならない**ので別プールにする
     （混合山 knights/ruins/castles と同じ扱い＝engine の mixedContents で闇市場からも除外する）。 */
  DOM.POOLS.allies = ['bauble', 'sycophant', 'importer', 'merchant_camp', 'sentinel', 'underling',
    'broker', 'carpenter', 'courier', 'innkeeper', 'royal_galley', 'town',
    'barbarian', 'capital_city', 'contract', 'emissary', 'galleria', 'guildmaster',
    'highwayman', 'hunter', 'modify', 'skirmisher', 'specialist', 'swap', 'marquis',
    'augurs', 'clashes', 'forts', 'odysseys', 'townsfolk', 'wizards'];
  // 分割山6組の中身（各4種×4枚＝16枚。一番上の1枚だけ購入/獲得できる）。**山の並び順そのもの**なので順序に意味がある。
  DOM.ALLIES_SPLIT_PILES = {
    augurs:    ['herb_gatherer', 'acolyte', 'sorceress', 'sibyl'],
    clashes:   ['battle_plan', 'archer', 'warlord', 'territory'],
    forts:     ['tent', 'garrison', 'hill_fort', 'stronghold'],
    odysseys:  ['old_map', 'voyage', 'sunken_treasure', 'distant_shore'],
    townsfolk: ['town_crier', 'blacksmith', 'miller', 'elder'],
    wizards:   ['student', 'conjurer', 'sorcerer', 'lich'],
  };
  DOM.POOLS.allies_split = [].concat.apply([], Object.keys(DOM.ALLIES_SPLIT_PILES).map((k) => DOM.ALLIES_SPLIT_PILES[k]));
  // 連携(Liaison)＝これが王国に1枚でもあると同盟(Ally)カードが1枚配られ、全員が好意を得る。
  //   ⚠ 生徒(student) は魔法使い(wizards)の分割山の中に居る＝**山IDだけを見る判定では取りこぼす**。
  DOM.ALLIES_LIAISONS = ['bauble', 'sycophant', 'importer', 'student', 'underling', 'broker', 'contract', 'emissary', 'guildmaster'];
  /* 同盟の固定10種（自作 showcase＝公式の同盟専用10種は存在しない）。同盟の新機構をひと通り味わえる構成：
       好意(Favor)と同盟(Ally)カード … 連携3系統（道化棒＝財宝／仲買人＝廃棄して4択／生徒＝**分割山の中**）
       分割山＋循環(Rotate) ……… 町民($2)・叙事詩($3)・魔法使い($3) の3組（循環は触れ役/古地図/生徒）
       持続 ……………………………… 航海（追加ターン＋そのターンは手札から3枚まで）／霊術師（次のターン手札へ）
       アタック ……………………… 蛮族（廃棄＋同種別の格下げ獲得）／魔導士（指定を外すと呪い）
       長老(Elder)の「追加でもう1つ選ぶ」… 町・宿屋の主人・仲買人 が対象になる
       ほか ……………………………… リッチ（1ターンスキップ）／商人の野営地（場から捨てるとき山札の上）
     コスト分布＝$2×2／$3×3／$4×3／$5×1／$6×1（分割山は買い進むと $5/$6 まで上がる）。 */
  DOM.KINGDOM_ALLIES = ['bauble', 'townsfolk', 'merchant_camp', 'odysseys', 'wizards',
                        'broker', 'innkeeper', 'town', 'barbarian', 'marquis'];
  /* 略奪（Plunder）＝段階1（画像・カタログのみ）。
     ⚠ プール名は `plunderexp`＝英語id `plunder` が帝国の分割山「鹵獲品」で使用済みのため衝突を避ける。
     王国40種が抽選/闇市場の母集団になる枠。**戦利品(Loot) 15種は非サプライ**なので別プール（賞品/馬と同じ扱い）。 */
  DOM.POOLS.plunderexp = ['cage', 'grotto', 'jewelled_egg', 'search', 'shaman', 'secluded_shrine', 'siren', 'stowaway', 'taskmaster', 'abundance', 'cabin_boy', 'crucible', 'flagship', 'fortune_hunter', 'gondola', 'harbor_village', 'landing_party', 'mapmaker', 'maroon', 'rope', 'swamp_shacks', 'tools', 'buried_treasure', 'crew', 'cutthroat', 'enlarge', 'figurine', 'first_mate', 'frigate', 'longship', 'mining_road', 'pendant', 'pickaxe', 'pilgrim', 'quartermaster', 'silver_mine', 'trickster', 'wealthy_village', 'sack_of_loot', 'kings_cache'];
  // 戦利品(Loot)＝非サプライ（15種×2枚＝30枚を1山に伏せる）。ランダム抽選の母集団には入れない。
  DOM.POOLS.loot = ['amphora', 'doubloons', 'endless_chalice', 'figurehead', 'hammer', 'insignia', 'jewels', 'orb', 'prize_goat', 'puzzle_box', 'sextant', 'shield', 'spell_scroll', 'staff', 'sword'];
  /* 「戦利品を配る」カード＝これが1枚でも対局にあるときだけ戦利品の山（30枚）を作る。
     RGG ルールブック逐語 `Shuffle them into a face-down pile before the game if any cards refer to Loot.`
     正本＝英語wiki `Loot > Ways to gain Loot`（王国7・イベント5・特性1）。**横型（イベント/特性）も含む**ので
     `createInitialState` では kingdom だけでなく events / traits も走査すること。 */
  DOM.LOOT_GIVERS = ['jewelled_egg', 'search', 'pickaxe', 'wealthy_village', 'cutthroat', 'sack_of_loot', // 王国
    'peril', 'foray', 'looting', 'invasion', 'prosper', // イベント
    'cursed']; // 特性
  /* 略奪の固定10種（自作 showcase・公式の略奪専用10種は無い）。新機構をひと通り味わえる構成＝
     戦利品を配る4種（宝飾卵/調査/切り裂き魔/戦利品の袋）／"next time" 持続（調査/切り裂き魔）／
     シャーマンの常設ルール（宝飾卵とシナジー）／現場監督の繰り返し／乗組員の topdeck 持続／
     一等航海士のループ／港の村（村枠＋$判定）。コスト分布＝$2×3・$3×1・$4×1・$5×4・$6×1。 */
  DOM.KINGDOM_PLUNDER = ['jewelled_egg', 'search', 'shaman', 'taskmaster', 'harbor_village',
                         'cutthroat', 'crew', 'pilgrim', 'first_mate', 'sack_of_loot'];
  /* 旭日の固定10種（自作 showcase。公式の旭日専用10種は存在しない）＝新機構をひと通り味わえる構成。
     - **前兆(Omen) 2種**（茶屋 $5／歌人 $4）＝これがあるので**予言が必ず1枚配られる**（＝Sunトークンが出る）。
     - **影(Shadow) 2種**（魚屋 $2／忍者 $4）＝山札から使える裏面違いのカード。忍者はアタックでもある。
     - **命令**＝大名（6D）／**準備を持つ持続**＝川船（$3）／**永続持続＋アタック**＝侍（$6）。
     - **負債コスト**＝大名（6D）＝帝国の負債機構がそのまま効く。
     - 素直な村枠＝駕籠（$5＝+1カード+2アクション相当）／trash-to-gain＝狸（$5）／ドロー＝札差（$5）。
     コスト分布＝$2×1／$3×1／$4×2／$5×4／$6×1／6D×1。 */
  DOM.KINGDOM_RISINGSUN = ['fishmonger', 'riverboat', 'ninja', 'poet', 'litter',
                           'rice_broker', 'tanuki', 'tea_house', 'samurai', 'daimyo'];
  /* 旭日（Rising Sun）＝段階1（画像・カタログのみ）。王国25種が抽選/闇市場の母集団になる枠。
     ⚠ プール名は `risingsun`（既存プール名と衝突しない）。横型＝イベント10＋予言15 は `DOM.LANDSCAPES` 側。
     新種別＝**前兆(omen) 6種**（山の社/歌人/川の社/田舎の村/茶屋/狐）＝予言を1枚配る条件になる／
     **影(shadow) 5種**（魚屋/小路/忍者/浪人/狸）＝裏面が違い山札から使える。 */
  DOM.POOLS.risingsun = ['fishmonger', 'snake_witch', 'aristocrat', 'craftsman', 'root_cellar', 'riverboat',
    'change', 'alley', 'ninja', 'poet', 'river_shrine', 'rustic_village',
    'gold_mine', 'imperial_envoy', 'tea_house', 'kitsune', 'litter', 'rice_broker', 'ronin', 'tanuki',
    'mountain_shrine', 'daimyo', 'artist', 'rice', 'samurai'];
  // 段階1（効果が未実装）のプール＝闇市場デッキに入れない（買っても何も起きない死に札になるため）。
  //   実プレイ化（段階2＝CARD_SET 昇格）のときに、この配列から外す。
  //   略奪は P7 で昇格済み＝空に戻した（戦利品 Loot は NON_SUPPLY なので闇市場には元々入らない）。
  //   旭日は段階1（2026-08-20）＝ここに入れる。**段階2の R7 で外すこと**。
  DOM.STAGE1_POOLS = [];
  // 移動動物園の固定10種（自作 showcase）。追放（ラクダの隊列）・馬（そり/騎兵隊/馬丁/貸し馬屋）・
  //   持続（艀/村有緑地）・アタック（魔女の集会）・獲得に反応するリアクション（牧羊犬/村有緑地）を一通り味わえる。
  //   コスト分布＝$2×1／$3×3／$4×3／$5×3。
  DOM.KINGDOM_MENAGERIE = ['sleigh', 'camel_train', 'scrap', 'sheepdog', 'cavalry', 'groom', 'village_green',
                           'barge', 'coven', 'livery'];
  // 馬の山（30枚）を準備するかの判定＝「馬を獲得する」王国カード／イベント（公式：馬を使うカードがある場合だけ用意）。
  //   習性のハツカネズミで脇に置いたカードが馬を使う場合もあるので、engine 側は脇カードも見る。
  DOM.HORSE_GIVERS = ['cavalry', 'groom', 'hostelry', 'livery', 'paddock', 'scrap', 'sleigh', 'supplies',
                      'bargain', 'demand', 'ride', 'stampede'];
  // 画面で選べるセット（id はサーバ検証・保存にも使う）。
  //   kingdom 固定 … おすすめ10種をそのまま使う
  //   randomFrom  … 指定した拡張プールを合わせた中から毎回10種を抽選
  // 拡張を増やすときは POOLS に足し、ここに固定/ランダムのセットを追記するだけ。
  //   kind … UIの分類。standard=王国基本/陰謀基本、recommend=おすすめ（テーマ別）、random=ランダム。
  //   desc … おすすめタイルに出す一行説明。
  //   ※ UI は kind:'standard' のうち basic/intrigue 以外を「拡張」タイルとして出す（desc が一行説明）。
  DOM.CARD_SETS = [
    // ---- 標準（第二版の王国基本・陰謀基本）----
    { id: 'basic',           kind: 'standard', name: '王国基本セット（第二版）', kingdom: DOM.KINGDOM },
    { id: 'intrigue',        kind: 'standard', name: '陰謀セット（第二版）', kingdom: DOM.KINGDOM_INTRIGUE },
    { id: 'seaside',         kind: 'standard', name: '海辺セット（第二版）', desc: '持続カード・マット・追加ターン', kingdom: DOM.KINGDOM_SEASIDE },
    { id: 'alchemy',         kind: 'standard', name: '錬金術セット（第二版）', desc: 'ポーション経済・ブドウ園・支配', kingdom: DOM.KINGDOM_ALCHEMY },
    { id: 'prosperity',      kind: 'standard', name: '繁栄セット（第二版）', desc: '勝利点トークン・植民地/プラチナ貨', kingdom: DOM.KINGDOM_PROSPERITY },
    { id: 'cornucopia',      kind: 'standard', name: '収穫祭セット', desc: '賞品・災いカード・カードの多様性', kingdom: DOM.KINGDOM_CORNUCOPIA },
    { id: 'guilds',          kind: 'standard', name: 'ギルドセット', desc: '財源（コイントークン）・過払い', kingdom: DOM.KINGDOM_GUILDS },
    { id: 'hinterlands',     kind: 'standard', name: '異郷セット', desc: '獲得した瞬間に働くカード・可変勝利点', kingdom: DOM.KINGDOM_HINTERLANDS },
    // 暗黒時代セット（固定10種＝Grim Parade）。このセットのみ避難所を使用（createInitialState が
    //   王国内容の一致で自動判定＝opts不要。random-darkages は避難所OFF）。
    { id: 'darkages',        kind: 'standard', name: '暗黒時代セット', desc: '廃墟・騎士の混合山・避難所・廃棄で得', kingdom: DOM.KINGDOM_DARKAGES },
    { id: 'adventures',      kind: 'standard', name: '冒険セット', desc: 'トラベラー・酒場マット・各種トークン', kingdom: DOM.KINGDOM_ADVENTURES },
    // 冒険＋イベント（横型）。固定10王国に、冒険イベント20種から2枚を無作為に付ける（購入フェイズに買う横型・トークン中心）。
    { id: 'adventures-events', kind: 'standard', name: '冒険＋イベント', desc: '冒険10種＋イベント2枚（旅/山トークン・追加ターン・相続）', kingdom: DOM.KINGDOM_ADVENTURES, eventsFrom: 'adventures' },
    // 帝国セット（固定10種）。分割山（開拓者/騒がしい村・投石機/石）と城の混合山は createInitialState が
    //   下段/山の中身を自動で用意する（王国枠は1山ぶん）。
    { id: 'empires',         kind: 'standard', name: '帝国セット', desc: '負債・山上の勝利点・分割山・城・命令', kingdom: DOM.KINGDOM_EMPIRES },
    // 帝国＋ランドマーク（横型）。固定10王国に、帝国ランドマーク21種から2枚を無作為に付ける（得点ルールが変わる）。
    { id: 'empires-landmarks', kind: 'standard', name: '帝国＋ランドマーク', desc: '帝国10種＋ランドマーク2枚（得点や獲得の仕方が変わる横型）', kingdom: DOM.KINGDOM_EMPIRES, landmarksFrom: 'empires' },
    // 帝国＋イベント（横型）。固定10王国に、帝国イベント13種から2枚を無作為に付ける（購入フェイズにコイン/負債で買う横型）。
    { id: 'empires-events',  kind: 'standard', name: '帝国＋イベント', desc: '帝国10種＋イベント2枚（購入フェイズに買う横型・負債経済）', kingdom: DOM.KINGDOM_EMPIRES, eventsFrom: 'empires' },
    // ルネサンスセット（固定10種）。村人・財源・アーティファクトの3機構。
    { id: 'renaissance',     kind: 'standard', name: 'ルネサンスセット', desc: '村人・財源・アーティファクト（奪い合う）', kingdom: DOM.KINGDOM_RENAISSANCE },
    // ルネサンス＋プロジェクト（横型）。固定10王国に、プロジェクト20種から2枚を無作為に付ける（1人2つまで買える永続効果）。
    { id: 'renaissance-projects', kind: 'standard', name: 'ルネサンス＋プロジェクト', desc: 'ルネサンス10種＋プロジェクト2枚（買うと永続する横型・1人2つまで）', kingdom: DOM.KINGDOM_RENAISSANCE, projectsFrom: 'renaissance' },
    // 移動動物園セット（固定10種）。追放マット（Exile）と馬（非サプライ30枚）の2機構。
    { id: 'menagerie',       kind: 'standard', name: '移動動物園セット', desc: '追放マット・馬・獲得した瞬間に反応するカード', kingdom: DOM.KINGDOM_MENAGERIE },
    { id: 'nocturne',        kind: 'standard', name: '夜想曲セット', desc: '夜フェイズ・家宝・祝福/呪詛・精霊', kingdom: DOM.KINGDOM_NOCTURNE },
    // 移動動物園＋習性（横型）。固定10王国に、習性20種から2枚を無作為に付ける（アクションの効果を置き換える）。
    { id: 'menagerie-ways',  kind: 'standard', name: '移動動物園＋習性', desc: '移動動物園10種＋習性2枚（アクションの効果を置き換える横型・買わない）', kingdom: DOM.KINGDOM_MENAGERIE, waysFrom: 'menagerie' },
    // 移動動物園＋イベント（横型）。固定10王国に、移動動物園イベント20種から2枚を無作為に付ける（購入フェイズに買う横型）。
    { id: 'menagerie-events', kind: 'standard', name: '移動動物園＋イベント', desc: '移動動物園10種＋イベント2枚（購入フェイズに買う横型・馬/追放/追加ターン）', kingdom: DOM.KINGDOM_MENAGERIE, eventsFrom: 'menagerie' },
    // 同盟セット（固定10種）。王国に連携(Liaison)があるので createInitialState が同盟(Ally)カード1枚を自動で選び、
    //   全員に好意トークンを配る。分割山3組（町民/叙事詩/魔法使い）は16枚の混合山として自動で用意される。
    { id: 'allies',          kind: 'standard', name: '同盟セット', desc: '好意トークン・同盟カード・分割山と循環', kingdom: DOM.KINGDOM_ALLIES },
    { id: 'plunder',         kind: 'standard', name: '略奪セット', desc: '戦利品・"次に〜したとき"の持続・シャーマンの廃棄置き場ルール', kingdom: DOM.KINGDOM_PLUNDER },
    { id: 'plunder-events',  kind: 'standard', name: '略奪＋イベント', desc: '略奪10種＋イベント2枚（旅行の追加ターン・戦利品を買う横型）', kingdom: DOM.KINGDOM_PLUNDER, eventsFrom: 'plunderexp' },
    { id: 'plunder-traits',  kind: 'standard', name: '略奪＋特性', desc: '略奪10種＋特性2枚（サプライの山に付く横型＝山ごと性格が変わる）', kingdom: DOM.KINGDOM_PLUNDER, traitsFrom: 'plunderexp' },
    { id: 'risingsun',       kind: 'standard', name: '旭日セット', desc: '前兆と予言（Sunトークン）・裏面の違う影カード・命令の大名', kingdom: DOM.KINGDOM_RISINGSUN },
    { id: 'risingsun-events', kind: 'standard', name: '旭日＋イベント', desc: '旭日10種＋イベント2枚（稽古の2回使用・継続のアクションフェイズ復帰）', kingdom: DOM.KINGDOM_RISINGSUN, eventsFrom: 'risingsun' },
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
    // 帝国から＝POOLS.empires（29枠）。分割山の下段は randomKingdom が上段へ正規化し、城は 'castles' の1枠で抽選される。
    { id: 'random-empires',  kind: 'random', name: '帝国から',     randomFrom: ['empires'] },
    { id: 'random-renaissance', kind: 'random', name: 'ルネサンスから', randomFrom: ['renaissance'] },
    { id: 'random-nocturne', kind: 'random', name: '夜想曲から',     randomFrom: ['nocturne'] },
    { id: 'random-menagerie', kind: 'random', name: '移動動物園から', randomFrom: ['menagerie'] },
    // 同盟から＝POOLS.allies（31枠＝非分割25＋分割山6）。分割山は「山キー」1枠で抽選され、中身4種は
    //   createInitialState が16枚積む（＝混合山なので randomKingdom の2段分割山の正規化は通らない）。
    { id: 'random-allies',   kind: 'random', name: '同盟から',       randomFrom: ['allies'] },
    { id: 'random-plunder',  kind: 'random', name: '略奪から',       randomFrom: ['plunderexp'] },
    { id: 'random-risingsun', kind: 'random', name: '旭日から',      randomFrom: ['risingsun'] },
    { id: 'random-intrigue', kind: 'random', name: '陰謀のみから',   randomFrom: ['intrigue'] },
    { id: 'random-basic',    kind: 'random', name: '基本のみから',   randomFrom: ['basic'] },
    { id: 'random-promo',    kind: 'random', name: 'プロモ込みから',  randomFrom: ['basic', 'intrigue', 'promo'] },
    { id: 'random-1e',       kind: 'random', name: '初版から',        randomFrom: ['basic1e', 'intrigue1e'] },
  ];
  // 分割山（Split pile）＝1つの山枠に「上段カード5枚＋下段カード5枚」。下段は上段が尽きるまで購入/獲得できない。
  //   下段id → 上段id のマップ（唯一の正本）。engine.js（gain/canBuyCard/emptyPileCount 等）と cpu.js（splitBlocked）が参照。
  //   プロモ：サウナ/アヴァント（両$4）／帝国：陣地-鹵獲品・パトリキ-エンポリウム・開拓者-騒がしい村・投石機-石・剣闘士-大金（上が安い）。
  DOM.SPLIT_PILES = {
    avanto: 'sauna',
    plunder: 'encampment', emporium: 'patrician', bustling_village: 'settlers', rocks: 'catapult', fortune: 'gladiator',
  };
  // プールから重複なく n 種を選ぶ（コスト順に並べて返す）
  DOM.randomKingdom = function (n, pool) {
    let src = (pool || DOM.KINGDOM_POOL).slice();
    // 分割山は抽選で「上段（安い方）」に一本化して1山ぶんだけ枠を使う（上段が選ばれたら createInitialState が下段を自動追加する）。
    Object.keys(DOM.SPLIT_PILES).forEach((bottom) => {
      const top = DOM.SPLIT_PILES[bottom];
      if (src.includes(bottom)) { src = src.filter((id) => id !== bottom); if (!src.includes(top)) src.push(top); }
    });
    for (let i = src.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = src[i]; src[i] = src[j]; src[j] = t; }
    return src.slice(0, n || 10).sort((a, b) => DOM.CARDS[a].cost - DOM.CARDS[b].cost || a.localeCompare(b));
  };
  /* ============================================================
     mix モード（拡張を自由に混ぜるランダム対戦）
     ------------------------------------------------------------
     セットIDを **1本の文字列** にエンコードする（サーバ/永続化/再戦の protocol を変えずに済む）。
       `mix:<王国プール,カンマ区切り>[:<横型の枚数 0-2>[:<横型プール,カンマ区切り>]]`
       例) mix:basic,intrigue,seaside
           mix:seaside,empires,renaissance:2:ev-empires,pj-renaissance
     - 王国プール ＝ MIX_KINGDOM_POOLS のキー（実プレイ可能な15拡張＋プロモ＝16プール）。選んだプールの**和集合から10種を抽選**（公式どおり）。
     - 横型プール ＝ MIX_LANDSCAPE_POOLS のキー。選んだプールを**まとめてシャッフルし、合計で最大2枚**だけ引く
       （公式：イベント＋ランドマーク＋プロジェクトの合算で最大2枚。王国山は常に10）。
     - サーバは正規表現＋プール実在チェックで検証する（gameServer.js の isValidKingdomSet）。
     ============================================================ */
  // mix で選べる王国プール（＝実プレイ可能な拡張だけ。孤立プール/非サプライ/混合山の中身は入れない）。
  DOM.MIX_KINGDOM_POOLS = {
    basic: '基本', intrigue: '陰謀', seaside: '海辺', alchemy: '錬金術', prosperity: '繁栄',
    cornucopia: '収穫祭', guilds: 'ギルド', hinterlands: '異郷', darkages: '暗黒時代',
    adventures: '冒険', empires: '帝国', renaissance: 'ルネサンス', menagerie: '移動動物園',
    nocturne: '夜想曲', allies: '同盟', plunderexp: '略奪', risingsun: '旭日', promo: 'プロモ',
  };
  // mix で選べる横型プール（kind ごとに分けて選べる）。
  DOM.MIX_LANDSCAPE_POOLS = {
    'lm-empires': { label: 'ランドマーク（帝国）', get: () => DOM.LANDMARKS_EMPIRES || [] },
    'ev-empires': { label: 'イベント（帝国）', get: () => DOM.EVENTS_EMPIRES || [] },
    'ev-adventures': { label: 'イベント（冒険）', get: () => DOM.EVENTS_ADVENTURES || [] },
    'pj-renaissance': { label: 'プロジェクト（ルネサンス）', get: () => DOM.PROJECTS_RENAISSANCE || [] },
    'way-menagerie': { label: '習性（移動動物園）', get: () => DOM.WAYS_MENAGERIE || [] },
    'ev-menagerie': { label: 'イベント（移動動物園）', get: () => DOM.EVENTS_MENAGERIE || [] },
    'ev-plunder': { label: 'イベント（略奪）', get: () => DOM.EVENTS_PLUNDER || [] },
    'trait-plunder': { label: '特性（略奪）', get: () => DOM.TRAITS_PLUNDER || [] },
    'ev-risingsun': { label: 'イベント（旭日）', get: () => DOM.EVENTS_RISINGSUN || [] },
  };
  DOM.isMixSet = function (setId) { return typeof setId === 'string' && setId.indexOf('mix:') === 0; };
  // mix セットIDを分解する。不正なプール名は捨てる（サーバ側の検証と同じ挙動）。
  DOM.parseMixSet = function (setId) {
    if (!DOM.isMixSet(setId)) return null;
    const parts = String(setId).slice(4).split(':');
    const pools = (parts[0] || '').split(',').map((s) => s.trim())
      .filter((p) => p && Object.prototype.hasOwnProperty.call(DOM.MIX_KINGDOM_POOLS, p));
    let count = parseInt(parts[1], 10);
    if (!(count >= 0 && count <= 2)) count = 0;
    const lsPools = (parts[2] || '').split(',').map((s) => s.trim())
      .filter((p) => p && Object.prototype.hasOwnProperty.call(DOM.MIX_LANDSCAPE_POOLS, p));
    if (!lsPools.length) count = 0;
    return { pools, count, lsPools };
  };
  DOM.makeMixSet = function (pools, count, lsPools) {
    let id = 'mix:' + (pools || []).join(',');
    if (count > 0 && (lsPools || []).length) id += ':' + count + ':' + lsPools.join(',');
    return id;
  };
  // セットID → 王国カード配列（ランダム系は毎回その場で10種を確定）
  DOM.kingdomForSet = function (setId) {
    if (DOM.isMixSet(setId)) {
      const m = DOM.parseMixSet(setId);
      const pool = m.pools.reduce((a, ex) => a.concat(DOM.POOLS[ex] || []), []);
      if (!pool.length) return DOM.KINGDOM.slice(); // プール未選択＝フォールバック
      return DOM.randomKingdom(10, pool);
    }
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
  // プールから重複なく n 種のランドマーク（横型）を選ぶ（順不同）。
  DOM.pickLandmarks = function (n, pool) {
    const src = (pool || []).slice();
    for (let i = src.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = src[i]; src[i] = src[j]; src[j] = t; }
    return src.slice(0, n || 0);
  };
  // セットID → 使用するランドマークid列（横型・0〜2枚）。landmarksFrom を持つセットのみ抽選する。
  DOM.landmarksForSet = function (setId) {
    const set = DOM.CARD_SETS.find((s) => s.id === setId);
    if (set && set.landmarksFrom === 'empires') return DOM.pickLandmarks(2, DOM.LANDMARKS_EMPIRES || []);
    return [];
  };
  // セットID → 使用するイベントid列（横型・0〜2枚）。eventsFrom（拡張id）を持つセットのみ抽選する
  //   （pickLandmarks は汎用シャッフル選択）。新しい拡張のイベントを足すときは EVENTS_* を1行足すだけでよい。
  DOM.eventPoolFor = function (expansion) {
    if (expansion === 'empires') return DOM.EVENTS_EMPIRES || [];
    if (expansion === 'adventures') return DOM.EVENTS_ADVENTURES || [];
    if (expansion === 'menagerie') return DOM.EVENTS_MENAGERIE || [];
    if (expansion === 'plunderexp') return DOM.EVENTS_PLUNDER || [];
    if (expansion === 'risingsun') return DOM.EVENTS_RISINGSUN || [];
    return [];
  };
  DOM.eventsForSet = function (setId) {
    const set = DOM.CARD_SETS.find((s) => s.id === setId);
    if (set && set.eventsFrom) return DOM.pickLandmarks(2, DOM.eventPoolFor(set.eventsFrom));
    return [];
  };
  // セットID → 使用するプロジェクトid列（横型・0〜2枚）。projectsFrom（拡張id）を持つセットのみ抽選する。
  DOM.projectPoolFor = function (expansion) {
    if (expansion === 'renaissance') return DOM.PROJECTS_RENAISSANCE || [];
    return [];
  };
  DOM.projectsForSet = function (setId) {
    const set = DOM.CARD_SETS.find((s) => s.id === setId);
    if (set && set.projectsFrom) return DOM.pickLandmarks(2, DOM.projectPoolFor(set.projectsFrom));
    return [];
  };
  // セットID → 使用する習性id列（横型・0〜2枚）。習性は**買わない**のでコスト/購入まわりの配線は不要。
  DOM.wayPoolFor = function (expansion) {
    if (expansion === 'menagerie') return DOM.WAYS_MENAGERIE || [];
    return [];
  };
  DOM.waysForSet = function (setId) {
    const set = DOM.CARD_SETS.find((s) => s.id === setId);
    if (set && set.waysFrom) return DOM.pickLandmarks(2, DOM.wayPoolFor(set.waysFrom));
    return [];
  };
  /* セットID → 使用する横型3種を**一度に**確定する唯一の入口（ui.js の startConfigured／server の startGame が呼ぶ）。
     ※ landmarksForSet / eventsForSet / projectsForSet を別々に呼ぶと mix で「合計最大2枚」を超えてしまう
       （3つとも独立に2枚ずつ引いてしまう）。**mix では必ずこの関数を使うこと**。 */
  // セットID → 使用する特性id列（横型・0〜2枚）。traitsFrom（拡張id）を持つセットのみ抽選する。
  DOM.traitPoolFor = function (expansion) {
    if (expansion === 'plunderexp') return DOM.TRAITS_PLUNDER || [];
    return [];
  };
  DOM.traitsForSet = function (setId) {
    const set = DOM.CARD_SETS.find((s) => s.id === setId);
    if (set && set.traitsFrom) return DOM.pickLandmarks(2, DOM.traitPoolFor(set.traitsFrom));
    return [];
  };
  DOM.landscapesForSet = function (setId) {
    if (DOM.isMixSet(setId)) {
      const m = DOM.parseMixSet(setId);
      const out = { landmarks: [], events: [], projects: [], ways: [], traits: [] };
      if (!m.count || !m.lsPools.length) return out;
      // 選んだ横型プールを1つの束にまとめてシャッフルし、合計 count 枚だけ引く（公式：横型は合算で最大2枚）。
      let bag = [];
      m.lsPools.forEach((k) => { bag = bag.concat(DOM.MIX_LANDSCAPE_POOLS[k].get()); });
      DOM.pickLandmarks(m.count, bag).forEach((id) => {
        const kind = (DOM.LANDSCAPES[id] || {}).kind;
        if (kind === 'landmark') out.landmarks.push(id);
        else if (kind === 'event') out.events.push(id);
        else if (kind === 'project') out.projects.push(id);
        else if (kind === 'way') out.ways.push(id);
        else if (kind === 'trait') out.traits.push(id);   // 略奪：特性（買わない横型・山に付く）
      });
      return out;
    }
    return {
      landmarks: DOM.landmarksForSet(setId),
      events: DOM.eventsForSet(setId),
      projects: DOM.projectsForSet(setId),
      ways: DOM.waysForSet(setId),
      traits: DOM.traitsForSet(setId),   // 略奪：特性
    };
  };
  // 表示名（mix はプール名から組み立てる。ロビー/セット選択の見出しに使う）。
  DOM.setDisplayName = function (setId) {
    if (DOM.isMixSet(setId)) {
      const m = DOM.parseMixSet(setId);
      const names = m.pools.map((p) => DOM.MIX_KINGDOM_POOLS[p]).join('＋');
      const ls = (m.count && m.lsPools.length) ? '＋横型' + m.count + '枚' : '';
      return names ? 'ミックス：' + names + ls : 'ミックス（未選択）';
    }
    const set = DOM.CARD_SETS.find((s) => s.id === setId);
    return (set && set.name) || '王国基本セット（第二版）';
  };

  DOM.TREASURES = ['copper', 'silver', 'gold'];
  DOM.VICTORY   = ['estate', 'duchy', 'province'];

  // サプライ（場の山札）の表示順。プラチナ貨/植民地は繁栄が場にあるときだけ supply に存在し、
  // 各表示・獲得処理は supply[id] の有無でフィルタするので、ここでは常に並べておいてよい。
  DOM.SUPPLY_ORDER = function (kingdom) {
    return ['copper', 'silver', 'gold', 'platinum', 'estate', 'duchy', 'province', 'colony', 'curse'].concat(kingdom);
  };

  /* ============================================================
     横型ランドスケープ（Landscape）＝イベント／ランドマーク
     ------------------------------------------------------------
     **サプライ山ではない**ので `DOM.CARDS` には入れない（＝整合性テストの
     GAIN_ORDER網羅・POOL所属・3山終了・闇市場デッキ に一切混ざらない）。
     1対局に 0〜2枚だけ使う（公式：Events と Landmarks の合算で最大2枚。
     王国山は常に10のまま）。画像は `tools/build-landscape.js` が
     `asset/cards/<id>.webp`（1152×768）に生成する。
     正本の裁定＝docs/research/landscape_cards.md ／ landscape_gaps.md
     ============================================================ */
  // 帝国（Empires）ランドマーク 21種。買えない・場に出ない・得点ルールを変えるだけ。
  //   text は「準備：」行を最後に置く（カード面の体裁）。
  DOM.LANDSCAPES = {
    aqueduct: { name: '水道橋', nameEn: 'Aqueduct', kind: 'landmark', expansion: 'empires', cost: 0, debt: 0,
      text: '財宝を獲得したとき、その山から勝利点トークン1個をこの上に移す。\n勝利点カードを獲得したとき、この上にあるすべての勝利点トークンを受け取る。\n準備：銀貨と金貨の山に勝利点トークンを8個ずつ置く。' },
    arena: { name: '闘技場', nameEn: 'Arena', kind: 'landmark', expansion: 'empires', cost: 0, debt: 0,
      text: 'あなたの購入フェイズの開始時、アクションカード1枚を捨て札にしてもよい。そうした場合、ここから勝利点トークン2個を受け取る。\n準備：プレイヤー1人につき勝利点トークン6個をここに置く。' },
    bandit_fort: { name: '山賊の砦', nameEn: 'Bandit Fort', kind: 'landmark', expansion: 'empires', cost: 0, debt: 0,
      text: '得点計算時、あなたが持っている銀貨と金貨1枚につき -2 勝利点。' },
    basilica: { name: '公会堂', nameEn: 'Basilica', kind: 'landmark', expansion: 'empires', cost: 0, debt: 0,
      text: 'あなたの購入フェイズ中にカードを獲得したとき、コインが2以上残っていれば、ここから勝利点トークン2個を受け取る。\n準備：プレイヤー1人につき勝利点トークン6個をここに置く。' },
    baths: { name: '浴場', nameEn: 'Baths', kind: 'landmark', expansion: 'empires', cost: 0, debt: 0,
      text: 'カードを1枚も獲得せずにターンを終えたとき、ここから勝利点トークン2個を受け取る。\n準備：プレイヤー1人につき勝利点トークン6個をここに置く。' },
    battlefield: { name: '戦場', nameEn: 'Battlefield', kind: 'landmark', expansion: 'empires', cost: 0, debt: 0,
      text: '勝利点カードを獲得したとき、ここから勝利点トークン2個を受け取る。\n準備：プレイヤー1人につき勝利点トークン6個をここに置く。' },
    colonnade: { name: '列柱', nameEn: 'Colonnade', kind: 'landmark', expansion: 'empires', cost: 0, debt: 0,
      text: 'あなたの購入フェイズ中にアクションカードを獲得したとき、同名のカードが場に出ていれば、ここから勝利点トークン2個を受け取る。\n準備：プレイヤー1人につき勝利点トークン6個をここに置く。' },
    defiled_shrine: { name: '汚された神殿', nameEn: 'Defiled Shrine', kind: 'landmark', expansion: 'empires', cost: 0, debt: 0,
      text: 'アクションを獲得したとき、その山から勝利点トークン1個をこの上に移す。\nあなたの購入フェイズ中に呪いを獲得したとき、この上の勝利点トークンをすべて受け取る。\n準備：集合を持たない各アクションのサプライ山に勝利点トークンを2個ずつ置く。' },
    fountain: { name: '噴水', nameEn: 'Fountain', kind: 'landmark', expansion: 'empires', cost: 0, debt: 0,
      text: '得点計算時、銅貨を10枚以上持っていれば 15 勝利点。' },
    keep: { name: '砦', nameEn: 'Keep', kind: 'landmark', expansion: 'empires', cost: 0, debt: 0,
      text: '得点計算時、他のどのプレイヤーよりも多く持っている（同数なら全員が得る）名前の異なる財宝1種につき 5 勝利点。' },
    labyrinth: { name: '迷宮', nameEn: 'Labyrinth', kind: 'landmark', expansion: 'empires', cost: 0, debt: 0,
      text: '自分のターン中に2枚目のカードを獲得したとき、ここから勝利点トークン2個を受け取る。\n準備：プレイヤー1人につき勝利点トークン6個をここに置く。' },
    mountain_pass: { name: '峠', nameEn: 'Mountain Pass', kind: 'landmark', expansion: 'empires', cost: 0, debt: 0,
      text: 'いずれかのプレイヤーが最初に属州を獲得したとき、そのターンの後、各プレイヤーは1回ずつ、最大40負債まで競りを行う（獲得者で終わる）。\n最高額の入札者は +8 勝利点を得て、入札した額の負債を負う。' },
    museum: { name: '博物館', nameEn: 'Museum', kind: 'landmark', expansion: 'empires', cost: 0, debt: 0,
      text: '得点計算時、あなたが持つ名前の異なるカード1種類につき 2 勝利点。' },
    obelisk: { name: 'オベリスク', nameEn: 'Obelisk', kind: 'landmark', expansion: 'empires', cost: 0, debt: 0,
      text: '得点計算時、選ばれた山から得たカード1枚につき 2 勝利点。\n準備：アクションのサプライ山を無作為に1つ選ぶ。' },
    orchard: { name: '果樹園', nameEn: 'Orchard', kind: 'landmark', expansion: 'empires', cost: 0, debt: 0,
      text: '得点計算時、3枚以上持っている名前の異なるアクションカード1種類につき 4 勝利点。' },
    palace: { name: '宮殿', nameEn: 'Palace', kind: 'landmark', expansion: 'empires', cost: 0, debt: 0,
      text: '得点計算時、銅貨・銀貨・金貨のセット1組につき 3 勝利点。' },
    tomb: { name: '墓標', nameEn: 'Tomb', kind: 'landmark', expansion: 'empires', cost: 0, debt: 0,
      text: 'カードを廃棄するたび、+1 勝利点。' },
    tower: { name: '塔', nameEn: 'Tower', kind: 'landmark', expansion: 'empires', cost: 0, debt: 0,
      text: '得点計算時、空になったサプライ山に由来する、勝利点でないカード1枚につき 1 勝利点。' },
    triumphal_arch: { name: '凱旋門', nameEn: 'Triumphal Arch', kind: 'landmark', expansion: 'empires', cost: 0, debt: 0,
      text: '得点計算時、あなたのカードのうち2番目に多いアクションカード（同数なら好きな方）1枚につき 3 勝利点。' },
    wall: { name: '壁', nameEn: 'Wall', kind: 'landmark', expansion: 'empires', cost: 0, debt: 0,
      text: '得点計算時、最初の15枚を超えて持っているカード1枚につき -1 勝利点。' },
    wolf_den: { name: '狼の巣', nameEn: 'Wolf Den', kind: 'landmark', expansion: 'empires', cost: 0, debt: 0,
      text: '得点計算時、ちょうど1枚だけ持っているカード1種類につき -3 勝利点。' },
    // 帝国（Empires）イベント 13種（買う横型・cost=コイン／debt=負債）。カタログ文は現行エラッタ。
    //   BUY_EVENT で購入＝購入権1消費・イベント自体は獲得しない・同じイベントを1ターンに複数回買える・負債>0では買えない。
    advance: { name: '昇進', nameEn: 'Advance', kind: 'event', expansion: 'empires', cost: 0, debt: 0,
      text: '手札のアクションカード1枚を廃棄してもよい。\nそうしたなら、コスト$6以下のアクションカード1枚を獲得する。' },
    annex: { name: '併合', nameEn: 'Annex', kind: 'event', expansion: 'empires', cost: 0, debt: 8,
      text: '捨て札置き場を見る。そこから最大5枚を選び、残りを山札に加えてシャッフルする。\n公領1枚を獲得する。' },
    banquet: { name: '宴会', nameEn: 'Banquet', kind: 'event', expansion: 'empires', cost: 3, debt: 0,
      text: '銅貨2枚と、コスト$5以下の勝利点でないカード1枚を獲得する。' },
    conquest: { name: '征服', nameEn: 'Conquest', kind: 'event', expansion: 'empires', cost: 6, debt: 0,
      text: '銀貨2枚を獲得する。このターンにあなたが獲得した銀貨1枚につき +1 勝利点。' },
    delve: { name: '掘進', nameEn: 'Delve', kind: 'event', expansion: 'empires', cost: 2, debt: 0,
      text: '＋購入1。銀貨1枚を獲得する。' },
    dominate: { name: '制圧', nameEn: 'Dominate', kind: 'event', expansion: 'empires', cost: 14, debt: 0,
      text: '属州1枚を獲得する。そうしたなら、+9 勝利点。' },
    donate: { name: '寄付', nameEn: 'Donate', kind: 'event', expansion: 'empires', cost: 0, debt: 8,
      text: 'あなたの次のターンの開始時、まず山札と捨て札置き場をすべて手札に加える。\nその中から好きな枚数を廃棄し、残りを山札に混ぜてシャッフルして5枚引く。' },
    ritual: { name: '儀式', nameEn: 'Ritual', kind: 'event', expansion: 'empires', cost: 4, debt: 0,
      text: '呪い1枚を獲得する。そうしたなら、手札から1枚を廃棄する。\nそのコスト $1 につき +1 勝利点。' },
    salt_the_earth: { name: '大地への塩まき', nameEn: 'Salt the Earth', kind: 'event', expansion: 'empires', cost: 4, debt: 0,
      text: '+1 勝利点。サプライの勝利点カード1枚を廃棄する。' },
    tax: { name: '徴税', nameEn: 'Tax', kind: 'event', expansion: 'empires', cost: 2, debt: 0,
      text: 'サプライの山1つに負債トークンを2個置く。\n準備：各サプライの山に負債トークンを1個ずつ置く。プレイヤーが自分の購入フェイズにカードを獲得したとき、その山の負債トークンをすべて受け取る。' },
    triumph: { name: '凱旋', nameEn: 'Triumph', kind: 'event', expansion: 'empires', cost: 0, debt: 5,
      text: '屋敷1枚を獲得する。そうしたなら、\nこのターンにあなたが獲得したカード1枚につき +1 勝利点。' },
    wedding: { name: '結婚式', nameEn: 'Wedding', kind: 'event', expansion: 'empires', cost: 4, debt: 3,
      text: '+1 勝利点。金貨1枚を獲得する。' },
    windfall: { name: '意外な授かり物', nameEn: 'Windfall', kind: 'event', expansion: 'empires', cost: 5, debt: 0,
      text: '山札と捨て札置き場が両方とも空の場合、金貨3枚を獲得する。' },

    /* ---- 冒険（Adventures）イベント 20種（買う横型・負債は無し＝すべてコインのみ）。カタログ文は現行エラッタ。
       トークン中心（旅トークン／-1カード／-$1／山トークン6種）＝帝国イベント（負債経済）と主題が異なる。 ---- */
    alms: { name: '施し', nameEn: 'Alms', kind: 'event', expansion: 'adventures', cost: 0, debt: 0,
      text: '1ターンに1回：場に財宝がない場合、コスト$4以下のカード1枚を獲得する。' },
    borrow: { name: '借入', nameEn: 'Borrow', kind: 'event', expansion: 'adventures', cost: 0, debt: 0,
      text: '＋購入1。\n1ターンに1回：あなたの-1カードトークンが山札の上になければ、それを山札の上に置き、+$1。' },
    quest: { name: '探索', nameEn: 'Quest', kind: 'event', expansion: 'adventures', cost: 0, debt: 0,
      text: 'アタックカード1枚、呪い2枚、または任意のカード6枚を捨て札にしてもよい。\nそうしたなら、金貨1枚を獲得する。' },
    save: { name: '保存', nameEn: 'Save', kind: 'event', expansion: 'adventures', cost: 1, debt: 0,
      text: '1ターンに1回：＋購入1。手札1枚を脇に置き、\nこのターンの終了時（手札を引いた後）にそれを手札に加える。' },
    scouting_party: { name: '偵察隊', nameEn: 'Scouting Party', kind: 'event', expansion: 'adventures', cost: 2, debt: 0,
      text: '＋購入1。山札の上から5枚を見る。そのうち3枚を捨て札にし、\n残りを好きな順番で山札の上に戻す。' },
    travelling_fair: { name: '移動遊園地', nameEn: 'Travelling Fair', kind: 'event', expansion: 'adventures', cost: 2, debt: 0,
      text: '＋購入2。\nこのターン、カードを獲得するたび、それを山札の上に置いてもよい。' },
    bonfire: { name: '焚火', nameEn: 'Bonfire', kind: 'event', expansion: 'adventures', cost: 3, debt: 0,
      text: '場にある銅貨を2枚まで廃棄する。' },
    expedition: { name: '探検', nameEn: 'Expedition', kind: 'event', expansion: 'adventures', cost: 3, debt: 0,
      text: '次の手札を引くとき、追加で2枚引く。' },
    ferry: { name: '渡し船', nameEn: 'Ferry', kind: 'event', expansion: 'adventures', cost: 3, debt: 0,
      text: 'あなたの-$2コストトークンを、アクションのサプライ山1つに移す。\n（あなたのターン中、その山のカードのコストが$2安くなる。）' },
    plan: { name: '立案', nameEn: 'Plan', kind: 'event', expansion: 'adventures', cost: 3, debt: 0,
      text: 'あなたの廃棄トークンを、アクションのサプライ山1つに移す。\n（その山からカードを獲得したとき、手札1枚を廃棄してもよい。）' },
    mission: { name: '使節団', nameEn: 'Mission', kind: 'event', expansion: 'adventures', cost: 4, debt: 0,
      text: 'このターンの後に追加のターンを1回行う（3ターン連続にはできない）。\nその追加ターン中はカードを購入できない。' },
    pilgrimage: { name: '巡礼', nameEn: 'Pilgrimage', kind: 'event', expansion: 'adventures', cost: 4, debt: 0,
      text: '1ターンに1回：あなたの旅トークンを裏返す（開始時は表向き）。\nそれが表向きになったなら、場にある名前の異なるカードを3枚まで選び、\nそれぞれのコピーを1枚ずつ獲得する。' },
    ball: { name: '舞踏会', nameEn: 'Ball', kind: 'event', expansion: 'adventures', cost: 5, debt: 0,
      text: 'あなたの-$1トークンを受け取る。コスト$4以下のカードを2枚獲得する。' },
    raid: { name: '奇襲', nameEn: 'Raid', kind: 'event', expansion: 'adventures', cost: 5, debt: 0,
      text: '場にある銀貨1枚につき、銀貨1枚を獲得する。\n他のプレイヤーは全員、自分の-1カードトークンを山札の上に置く。' },
    seaway: { name: '海路', nameEn: 'Seaway', kind: 'event', expansion: 'adventures', cost: 5, debt: 0,
      text: 'コスト$4以下のアクションカード1枚を獲得する。\nあなたの+1購入トークンを、その山に移す。' },
    trade: { name: '交易', nameEn: 'Trade', kind: 'event', expansion: 'adventures', cost: 5, debt: 0,
      text: '手札を2枚まで廃棄する。廃棄した枚数だけ、銀貨を獲得する。' },
    lost_arts: { name: '失われた技術', nameEn: 'Lost Arts', kind: 'event', expansion: 'adventures', cost: 6, debt: 0,
      text: 'あなたの+1アクショントークンを、アクションのサプライ山1つに移す。\n（その山のカードをプレイするたび、まず +1アクション。）' },
    training: { name: '鍛錬', nameEn: 'Training', kind: 'event', expansion: 'adventures', cost: 6, debt: 0,
      text: 'あなたの+$1トークンを、アクションのサプライ山1つに移す。\n（その山のカードをプレイするたび、まず +$1。）' },
    inheritance: { name: '相続', nameEn: 'Inheritance', kind: 'event', expansion: 'adventures', cost: 7, debt: 0,
      text: 'ゲーム中に1回：サプライから、命令でないコスト$4以下のアクションカード1枚を脇に置き、\nあなたの屋敷トークンをその上に置く。\n（あなたのターン中、あなたの屋敷は「屋敷トークンの置かれたカードを、\nそこに置いたまま使用する」能力を持つ命令アクションにもなる。）' },
    pathfinding: { name: '誘導', nameEn: 'Pathfinding', kind: 'event', expansion: 'adventures', cost: 8, debt: 0,
      text: 'あなたの+1カードトークンを、アクションのサプライ山1つに移す。\n（その山のカードをプレイするたび、まず +1カード。）' },

    /* ---- ルネサンス（Renaissance）プロジェクト 20種（買う横型・コインのみ）。カタログ文は現行エラッタ。
       BUY_PROJECT で購入＝購入権1消費・カードは獲得しない・**1人につき2つまで**・**同じものを2回は買えない**・
       複数のプレイヤーが同じプロジェクトを買える・コスト軽減を受けない・購入時トリガーも誘発しない。
       正本＝docs/research/renaissance_rules.md §3 ---- */
    cathedral: { name: '大聖堂', nameEn: 'Cathedral', kind: 'project', expansion: 'renaissance', cost: 3, debt: 0,
      text: 'あなたのターンの開始時、手札1枚を廃棄する。' },
    city_gate: { name: '城門', nameEn: 'City Gate', kind: 'project', expansion: 'renaissance', cost: 3, debt: 0,
      text: 'あなたのターンの開始時、+1 カード。\nその後、手札1枚を山札の上に置く。' },
    pageant: { name: '野外劇', nameEn: 'Pageant', kind: 'project', expansion: 'renaissance', cost: 3, debt: 0,
      text: 'あなたの購入フェイズの終了時、1コインを支払ってもよい。\nそうしたら、+1 財源。' },
    sewers: { name: '下水道', nameEn: 'Sewers', kind: 'project', expansion: 'renaissance', cost: 3, debt: 0,
      text: 'あなたがこの効果以外でカードを廃棄するたび、\n追加で手札1枚を廃棄してもよい。' },
    star_chart: { name: '星図', nameEn: 'Star Chart', kind: 'project', expansion: 'renaissance', cost: 3, debt: 0,
      text: 'あなたがシャッフルするとき、シャッフルするカードから1枚を選び、\nシャッフルした束の一番上に置いてもよい。' },
    exploration: { name: '探査', nameEn: 'Exploration', kind: 'project', expansion: 'renaissance', cost: 4, debt: 0,
      text: 'あなたの購入フェイズの終了時、その購入フェイズにカードを1枚も獲得していない場合、\n+1 財源、+1 村人。' },
    fair: { name: '縁日', nameEn: 'Fair', kind: 'project', expansion: 'renaissance', cost: 4, debt: 0,
      text: 'あなたのターンの開始時、+1 購入。' },
    silos: { name: 'サイロ', nameEn: 'Silos', kind: 'project', expansion: 'renaissance', cost: 4, debt: 0,
      text: 'あなたのターンの開始時、好きな枚数の銅貨を公開して捨て札にする。\nその後、捨て札にした枚数だけカードを引く。' },
    sinister_plot: { name: '悪巧み', nameEn: 'Sinister Plot', kind: 'project', expansion: 'renaissance', cost: 4, debt: 0,
      text: 'あなたのターンの開始時、この上にトークンを1個置く。または、\nこの上のあなたのトークンをすべて取り除き、取り除いた1個につき +1 カード。' },
    academy: { name: '学園', nameEn: 'Academy', kind: 'project', expansion: 'renaissance', cost: 5, debt: 0,
      text: 'あなたがアクションカードを獲得したとき、+1 村人。' },
    capitalism: { name: '資本主義', nameEn: 'Capitalism', kind: 'project', expansion: 'renaissance', cost: 5, debt: 0,
      text: 'あなたのターン中、テキストに「+○ コイン」を含むアクションカードは、財宝カードでもある。' },
    fleet: { name: '艦隊', nameEn: 'Fleet', kind: 'project', expansion: 'renaissance', cost: 5, debt: 0,
      text: 'ゲームの終了後、これを持つプレイヤーは全員、追加の1ターンを行う。' },
    guildhall: { name: 'ギルド集会所', nameEn: 'Guildhall', kind: 'project', expansion: 'renaissance', cost: 5, debt: 0,
      text: 'あなたが財宝カードを獲得したとき、+1 財源。' },
    piazza: { name: 'ピアッツァ', nameEn: 'Piazza', kind: 'project', expansion: 'renaissance', cost: 5, debt: 0,
      text: 'あなたのターンの開始時、山札の一番上のカードを公開する。\nそれがアクションカードの場合、それを使用する。' },
    road_network: { name: '道路網', nameEn: 'Road Network', kind: 'project', expansion: 'renaissance', cost: 5, debt: 0,
      text: '他のプレイヤーが勝利点カードを獲得したとき、+1 カード。' },
    barracks: { name: '兵舎', nameEn: 'Barracks', kind: 'project', expansion: 'renaissance', cost: 6, debt: 0,
      text: 'あなたのターンの開始時、+1 アクション。' },
    crop_rotation: { name: '輪作', nameEn: 'Crop Rotation', kind: 'project', expansion: 'renaissance', cost: 6, debt: 0,
      text: 'あなたのターンの開始時、手札の勝利点カード1枚を捨て札にしてもよい。\nそうしたら、+2 カード。' },
    innovation: { name: '技術革新', nameEn: 'Innovation', kind: 'project', expansion: 'renaissance', cost: 6, debt: 0,
      text: 'あなたの各ターンに1回、アクションカードを獲得したとき、それを使用してもよい。' },
    canal: { name: '運河', nameEn: 'Canal', kind: 'project', expansion: 'renaissance', cost: 7, debt: 0,
      text: 'あなたのターン中、すべてのカードのコストが1コイン安くなる（0未満にはならない）。' },
    citadel: { name: '山砦', nameEn: 'Citadel', kind: 'project', expansion: 'renaissance', cost: 8, debt: 0,
      text: 'あなたのターン中に最初にアクションカードを使用したとき、その後それを再演する。' },

    /* ---- ルネサンス アーティファクト 5種（横型・**カードではない**）。
       買えない・獲得しない・場に出ない・得点にも3山終了にも無関係。**同時に持てるのは1人だけ**（取ると相手から奪う）。
       state.artifacts = { flag: 席番号|null, ... }（トップレベルの公開スカラー＝保存則 tally に数えない）。
       王国に付与カード（旗手／国境警備隊／剣客／出納官）があるときだけ盤面に出る。 ---- */
    flag: { name: '旗', nameEn: 'Flag', kind: 'artifact', expansion: 'renaissance', cost: 0, debt: 0, grantedBy: ['flag_bearer'],
      text: 'あなたが手札を引くとき、+1 カード。' },
    horn: { name: '角笛', nameEn: 'Horn', kind: 'artifact', expansion: 'renaissance', cost: 0, debt: 0, grantedBy: ['border_guard'],
      text: '各ターンに1度、あなたが場から国境警備隊1枚を捨て札にするとき、\n代わりに山札の上に置いてもよい。' },
    key: { name: '鍵', nameEn: 'Key', kind: 'artifact', expansion: 'renaissance', cost: 0, debt: 0, grantedBy: ['treasurer'],
      text: 'あなたのターンの開始時、+1 コイン。' },
    lantern: { name: 'ランタン', nameEn: 'Lantern', kind: 'artifact', expansion: 'renaissance', cost: 0, debt: 0, grantedBy: ['border_guard'],
      text: 'あなたが使用する国境警備隊は、カードを3枚公開して2枚を捨て札にする。\n（角笛を受け取るには、3枚すべてがアクションカードである必要がある。）' },
    treasure_chest: { name: '宝箱', nameEn: 'Treasure Chest', kind: 'artifact', expansion: 'renaissance', cost: 0, debt: 0, grantedBy: ['swashbuckler'],
      text: 'あなたの購入フェイズの開始時、金貨1枚を獲得する。' },

    /* ---------- 移動動物園（Menagerie）イベント20種 ---------- */
    alliance: { name: '同盟', nameEn: 'Alliance', kind: 'event', expansion: 'menagerie', cost: 10, debt: 0,
      text: '属州、公領、屋敷、金貨、銀貨、銅貨 各1枚を獲得する。' },
    banish: { name: '放逐', nameEn: 'Banish', kind: 'event', expansion: 'menagerie', cost: 4, debt: 0,
      text: '手札から同じ名前のカードを好きな枚数追放する。' },
    bargain: { name: '特価品', nameEn: 'Bargain', kind: 'event', expansion: 'menagerie', cost: 4, debt: 0,
      text: 'コスト5コイン以下の勝利点でないカード1枚を獲得する。\n他のプレイヤーは各自、馬1枚を獲得する。' },
    commerce: { name: '商売', nameEn: 'Commerce', kind: 'event', expansion: 'menagerie', cost: 5, debt: 0,
      text: 'このターンにあなたが獲得したカードの異なる名前1種類につき、金貨1枚を獲得する。' },
    delay: { name: '遅延', nameEn: 'Delay', kind: 'event', expansion: 'menagerie', cost: 0, debt: 0,
      text: '手札からアクションカード1枚を脇に置いてもよい。\nあなたの次のターンの開始時、それを使用する。' },
    demand: { name: '要求', nameEn: 'Demand', kind: 'event', expansion: 'menagerie', cost: 5, debt: 0,
      text: '馬1枚とコスト4コイン以下のカード1枚を獲得し、2枚ともあなたの山札の上に置く。' },
    desperation: { name: '絶望', nameEn: 'Desperation', kind: 'event', expansion: 'menagerie', cost: 0, debt: 0,
      text: '1ターンに1回：呪い1枚を獲得してもよい。\nそうした場合、+1 購入、+2 コイン。' },
    enclave: { name: '包領', nameEn: 'Enclave', kind: 'event', expansion: 'menagerie', cost: 8, debt: 0,
      text: '金貨1枚を獲得する。サプライから公領1枚を追放する。' },
    enhance: { name: '増大', nameEn: 'Enhance', kind: 'event', expansion: 'menagerie', cost: 3, debt: 0,
      text: '手札から勝利点でないカード1枚を廃棄してもよい。\nそうした場合、そのカードよりコストが最大2コイン多いカード1枚を獲得する。' },
    gamble: { name: '博打', nameEn: 'Gamble', kind: 'event', expansion: 'menagerie', cost: 2, debt: 0,
      text: '+1 購入\n山札の一番上のカードを捨て札にする。\nそれがアクションカードか財宝カードの場合、それを使用してもよい。' },
    invest: { name: '投資', nameEn: 'Invest', kind: 'event', expansion: 'menagerie', cost: 4, debt: 0,
      text: 'サプライからアクションカード1枚を追放する。\nそのカードが追放されている間、他のプレイヤーがそれと同じカード1枚を獲得または投資したとき、+2 カード。' },
    march: { name: '進軍', nameEn: 'March', kind: 'event', expansion: 'menagerie', cost: 3, debt: 0,
      text: '捨て札置き場を見る。\nその中のアクションカード1枚を使用してもよい。' },
    populate: { name: '植民', nameEn: 'Populate', kind: 'event', expansion: 'menagerie', cost: 10, debt: 0,
      text: 'サプライのアクションカードの山それぞれから、カード1枚を獲得する。' },
    pursue: { name: '追求', nameEn: 'Pursue', kind: 'event', expansion: 'menagerie', cost: 2, debt: 0,
      text: '+1 購入\nカード名を1つ指定する。山札の上から4枚を公開する。\nそのうち指定したカードを山札の上に戻し、残りを捨て札にする。' },
    reap: { name: '刈り入れ', nameEn: 'Reap', kind: 'event', expansion: 'menagerie', cost: 7, debt: 0,
      text: '金貨1枚を獲得し、それを脇に置く。\n次のあなたの手番開始時、それを使用する。' },
    ride: { name: '乗馬', nameEn: 'Ride', kind: 'event', expansion: 'menagerie', cost: 2, debt: 0,
      text: '馬1枚を獲得する。' },
    seize_the_day: { name: '今を生きる', nameEn: 'Seize the Day', kind: 'event', expansion: 'menagerie', cost: 4, debt: 0,
      text: 'ゲーム中に1回：このターンの後に、追加のターンを1回行う。' },
    stampede: { name: '暴走', nameEn: 'Stampede', kind: 'event', expansion: 'menagerie', cost: 5, debt: 0,
      text: '場にあるあなたのカードが5枚以下の場合、馬5枚を獲得し、山札の上に置く。' },
    toil: { name: '苦労', nameEn: 'Toil', kind: 'event', expansion: 'menagerie', cost: 2, debt: 0,
      text: '+1 購入\n手札からアクションカード1枚を使用してもよい。' },
    transport: { name: '輸送', nameEn: 'Transport', kind: 'event', expansion: 'menagerie', cost: 3, debt: 0,
      text: '次から1つを選ぶ：\n・サプライからアクションカード1枚を追放する\n・追放されているあなたのアクションカード1枚を山札の上に置く' },

    /* ---------- 移動動物園（Menagerie）習性（Way）20種 ----------
       買わない横型。**アクションカードを使用するとき、その記載効果の代わりに習性の効果を使ってよい**
       （区切り線の下のテキストは影響を受けない）。コスト欄は無い。 */
    way_of_the_butterfly: { name: 'チョウの習性', nameEn: 'Way of the Butterfly', kind: 'way', expansion: 'menagerie', cost: 0, debt: 0,
      text: 'これをこのカードの山に戻してもよい。そうした場合、これよりコストがちょうど1コイン多いカード1枚を獲得する。' },
    way_of_the_camel: { name: 'ラクダの習性', nameEn: 'Way of the Camel', kind: 'way', expansion: 'menagerie', cost: 0, debt: 0,
      text: 'サプライから金貨1枚を追放する。' },
    way_of_the_chameleon: { name: 'カメレオンの習性', nameEn: 'Way of the Chameleon', kind: 'way', expansion: 'menagerie', cost: 0, debt: 0,
      text: 'このカードの指示に従う。ただしこのターン、それにより「+カード」を得るなら、代わりに同じ数の「+コイン」を得る。逆も同様。' },
    way_of_the_frog: { name: 'カエルの習性', nameEn: 'Way of the Frog', kind: 'way', expansion: 'menagerie', cost: 0, debt: 0,
      text: '+1 アクション\nこのターン、これを場から捨て札にするとき、これを山札の上に置く。' },
    way_of_the_goat: { name: 'ヤギの習性', nameEn: 'Way of the Goat', kind: 'way', expansion: 'menagerie', cost: 0, debt: 0,
      text: '手札からカード1枚を廃棄する。' },
    way_of_the_horse: { name: '馬の習性', nameEn: 'Way of the Horse', kind: 'way', expansion: 'menagerie', cost: 0, debt: 0,
      text: '+2 カード\n+1 アクション\nこれをこのカードの山に戻す。' },
    way_of_the_mole: { name: 'モグラの習性', nameEn: 'Way of the Mole', kind: 'way', expansion: 'menagerie', cost: 0, debt: 0,
      text: '+1 アクション\n手札をすべて捨て札にする。+3 カード。' },
    way_of_the_monkey: { name: 'サルの習性', nameEn: 'Way of the Monkey', kind: 'way', expansion: 'menagerie', cost: 0, debt: 0,
      text: '+1 購入\n+1 コイン' },
    way_of_the_mouse: { name: 'ハツカネズミの習性', nameEn: 'Way of the Mouse', kind: 'way', expansion: 'menagerie', cost: 0, debt: 0,
      text: '脇に置かれているカードを使用する。そのカードは脇に置いたままにする。\n————\n準備：このゲームで使わない、コスト2コインまたは3コインの、持続でないアクションの王国カード1枚を脇に置く。' },
    way_of_the_mule: { name: 'ラバの習性', nameEn: 'Way of the Mule', kind: 'way', expansion: 'menagerie', cost: 0, debt: 0,
      text: '+1 アクション\n+1 コイン' },
    way_of_the_otter: { name: 'カワウソの習性', nameEn: 'Way of the Otter', kind: 'way', expansion: 'menagerie', cost: 0, debt: 0,
      text: '+2 カード' },
    way_of_the_owl: { name: 'フクロウの習性', nameEn: 'Way of the Owl', kind: 'way', expansion: 'menagerie', cost: 0, debt: 0,
      text: '手札が6枚になるまで引く。' },
    way_of_the_ox: { name: '雄牛の習性', nameEn: 'Way of the Ox', kind: 'way', expansion: 'menagerie', cost: 0, debt: 0,
      text: '+2 アクション' },
    way_of_the_pig: { name: '豚の習性', nameEn: 'Way of the Pig', kind: 'way', expansion: 'menagerie', cost: 0, debt: 0,
      text: '+1 カード\n+1 アクション' },
    way_of_the_rat: { name: 'ドブネズミの習性', nameEn: 'Way of the Rat', kind: 'way', expansion: 'menagerie', cost: 0, debt: 0,
      text: '財宝カード1枚を捨て札にしてもよい。そうした場合、これと同じカード1枚を獲得する。' },
    way_of_the_seal: { name: 'アザラシの習性', nameEn: 'Way of the Seal', kind: 'way', expansion: 'menagerie', cost: 0, debt: 0,
      text: '+1 コイン\nこのターン、カード1枚を獲得したとき、それを山札の上に置いてもよい。' },
    way_of_the_sheep: { name: '羊の習性', nameEn: 'Way of the Sheep', kind: 'way', expansion: 'menagerie', cost: 0, debt: 0,
      text: '+2 コイン' },
    way_of_the_squirrel: { name: 'リスの習性', nameEn: 'Way of the Squirrel', kind: 'way', expansion: 'menagerie', cost: 0, debt: 0,
      text: 'このターンの終了時に、+2 カード。' },
    way_of_the_turtle: { name: 'ウミガメの習性', nameEn: 'Way of the Turtle', kind: 'way', expansion: 'menagerie', cost: 0, debt: 0,
      text: 'これを脇に置く。脇に置いた場合、次のターンの開始時にそれを使用する。' },
    way_of_the_worm: { name: 'ミミズの習性', nameEn: 'Way of the Worm', kind: 'way', expansion: 'menagerie', cost: 0, debt: 0,
      text: 'サプライの屋敷1枚を追放する。' },
    /* ===== 夜想曲（Nocturne）横型29種 ＝ 祝福12・呪詛12・状態5 =====
       いずれも**カードではない**（`DOM.CARDS` に入れない／得点にも所有カードにも数えない）。買えない。
       祝福＝幸運(Fate)カードから「受ける」／呪詛＝不運(Doom)カードから「受ける」／状態＝プレイヤーが「取る」。
       正本＝docs/research/nocturne_rules.md。 */
    the_earths_gift: { name: '大地の恵み', nameEn: 'The Earth\'s Gift', kind: 'boon', expansion: 'nocturne', cost: 0, debt: 0,
      text: '手札の財宝カード1枚を捨て札にして、コスト4コイン以下のカード1枚を獲得してもよい。' },
    the_fields_gift: { name: '田畑の恵み', nameEn: 'The Field\'s Gift', kind: 'boon', expansion: 'nocturne', cost: 0, debt: 0,
      text: '+1 アクション\n+1 コイン\n（これをクリーンアップフェイズまで持っておく。）' },
    the_flames_gift: { name: '炎の恵み', nameEn: 'The Flame\'s Gift', kind: 'boon', expansion: 'nocturne', cost: 0, debt: 0,
      text: '手札のカード1枚を廃棄してもよい。' },
    the_forests_gift: { name: '森の恵み', nameEn: 'The Forest\'s Gift', kind: 'boon', expansion: 'nocturne', cost: 0, debt: 0,
      text: '+1 購入\n+1 コイン\n（これをクリーンアップフェイズまで持っておく。）' },
    the_moons_gift: { name: '月の恵み', nameEn: 'The Moon\'s Gift', kind: 'boon', expansion: 'nocturne', cost: 0, debt: 0,
      text: '捨て札置き場をすべて見る。\nその中のカード1枚を山札の上に置いてもよい。' },
    the_mountains_gift: { name: '山の恵み', nameEn: 'The Mountain\'s Gift', kind: 'boon', expansion: 'nocturne', cost: 0, debt: 0,
      text: '銀貨1枚を獲得する。' },
    the_rivers_gift: { name: '川の恵み', nameEn: 'The River\'s Gift', kind: 'boon', expansion: 'nocturne', cost: 0, debt: 0,
      text: 'このターンの終了時、+1 カード。\n（これをクリーンアップフェイズまで持っておく。）' },
    the_seas_gift: { name: '海の恵み', nameEn: 'The Sea\'s Gift', kind: 'boon', expansion: 'nocturne', cost: 0, debt: 0,
      text: '+1 カード' },
    the_skys_gift: { name: '空の恵み', nameEn: 'The Sky\'s Gift', kind: 'boon', expansion: 'nocturne', cost: 0, debt: 0,
      text: '手札3枚を捨て札にして、金貨1枚を獲得してもよい。' },
    the_suns_gift: { name: '太陽の恵み', nameEn: 'The Sun\'s Gift', kind: 'boon', expansion: 'nocturne', cost: 0, debt: 0,
      text: '山札の上から4枚を見る。\n好きな枚数を捨て札にし、残りを好きな順番で山札の上に戻す。' },
    the_swamps_gift: { name: '沼の恵み', nameEn: 'The Swamp\'s Gift', kind: 'boon', expansion: 'nocturne', cost: 0, debt: 0,
      text: 'ウィル・オ・ウィスプ1枚を獲得する。' },
    the_winds_gift: { name: '風の恵み', nameEn: 'The Wind\'s Gift', kind: 'boon', expansion: 'nocturne', cost: 0, debt: 0,
      text: '+2 カード\n手札からカード2枚を捨て札にする。' },

    /* ---- 夜想曲（Nocturne）呪詛（Hex）12種。横型・コスト無し・買えない。
       不運(Doom)カードが1枚でもあれば、12枚をシャッフルして裏向きの山にする。
       このとき 錯乱／嫉妬 と 生活苦／二重苦 も一緒に置く＝幻惑・羨望・みじめな生活の配布先（RB 準備 逐語）。
       「他のプレイヤーは各自、次の呪詛を受ける」＝呪詛は1枚だけめくり、全員が同じ1枚に従う（人数分めくらない）。
       解決後は必ず呪詛の捨て札へ（＝前に置き続ける呪詛は無い。状態カードは別物）。
       12種すべて強制＝任意("you may")は1つも無い。 ---- */
    bad_omens: { name: '凶兆', nameEn: 'Bad Omens', kind: 'hex', expansion: 'nocturne', cost: 0, debt: 0,
      text: '山札を捨て札置き場に置く。\n捨て札置き場をすべて見て、その中から銅貨2枚を山札の上に置く。\n（それができない場合、捨て札置き場をすべて公開する。）' },
    delusion: { name: '幻惑', nameEn: 'Delusion', kind: 'hex', expansion: 'nocturne', cost: 0, debt: 0,
      text: 'あなたが錯乱も嫉妬も持っていなければ、錯乱を取る。' },
    envy: { name: '羨望', nameEn: 'Envy', kind: 'hex', expansion: 'nocturne', cost: 0, debt: 0,
      text: 'あなたが錯乱も嫉妬も持っていなければ、嫉妬を取る。' },
    famine: { name: '飢饉', nameEn: 'Famine', kind: 'hex', expansion: 'nocturne', cost: 0, debt: 0,
      text: '山札の上から3枚を公開し、そのうちのアクションカードをすべて捨て札にする。\n残りを山札に加えてシャッフルする。' },
    fear: { name: '恐怖', nameEn: 'Fear', kind: 'hex', expansion: 'nocturne', cost: 0, debt: 0,
      text: '手札が5枚以上の場合、手札からアクションカードか財宝カード1枚を捨て札にする。\n（それができない場合、手札を公開する。）' },
    greed: { name: '貪欲', nameEn: 'Greed', kind: 'hex', expansion: 'nocturne', cost: 0, debt: 0,
      text: '銅貨1枚を獲得し、山札の上に置く。' },
    haunting: { name: '憑依', nameEn: 'Haunting', kind: 'hex', expansion: 'nocturne', cost: 0, debt: 0,
      text: '手札が4枚以上の場合、その中のカード1枚を山札の上に置く。' },
    locusts: { name: '蝗害', nameEn: 'Locusts', kind: 'hex', expansion: 'nocturne', cost: 0, debt: 0,
      text: '山札の一番上のカード1枚を廃棄する。\nそれが銅貨か屋敷の場合、呪い1枚を獲得する。\nそうでない場合、廃棄したカードと同じ種別を1つ以上持ち、それよりコストが少ないカード1枚を獲得する。' },
    misery: { name: 'みじめな生活', nameEn: 'Misery', kind: 'hex', expansion: 'nocturne', cost: 0, debt: 0,
      text: 'このゲーム中にあなたが初めてみじめな生活の効果を受けた場合、生活苦を取る。\nそうでない場合、生活苦を裏返して二重苦にする。' },
    plague: { name: '疫病', nameEn: 'Plague', kind: 'hex', expansion: 'nocturne', cost: 0, debt: 0,
      text: '呪い1枚を獲得し、手札に加える。' },
    poverty: { name: '貧困', nameEn: 'Poverty', kind: 'hex', expansion: 'nocturne', cost: 0, debt: 0,
      text: '手札が3枚になるように捨て札にする。' },
    war: { name: '戦争', nameEn: 'War', kind: 'hex', expansion: 'nocturne', cost: 0, debt: 0,
      text: 'コスト3コインまたは4コインのカードが公開されるまで、山札の上からカードを公開する。\nそのカードを廃棄し、残りを捨て札にする。' },

    /* ---- 夜想曲（Nocturne）状態（State）5種。横型・コスト無し・買えない・「取る」もの（獲得ではない）。
       物理的には3種類の札＝錯乱／嫉妬（両面・各プレイヤー1枚）、生活苦／二重苦（両面・各プレイヤー1枚）、
       森の迷子（ゲーム中1枚だけ・両面同文）。カタログでは表示用に5件の独立エントリとして持つ。
       錯乱・嫉妬は「持っている間は何も起きない」＝購入フェイズの開始時に返して初めて発動し、そのターンの残り全部に効く。 ---- */
    deluded: { name: '錯乱', nameEn: 'Deluded', kind: 'state', expansion: 'nocturne', cost: 0, debt: 0,
      text: 'あなたの購入フェイズの開始時、このカードを返し、あなたはこのターンが終わるまでアクションカードを購入できない。' },
    envious: { name: '嫉妬', nameEn: 'Envious', kind: 'state', expansion: 'nocturne', cost: 0, debt: 0,
      text: 'あなたの購入フェイズの開始時、このカードを返し、このターンが終わるまで銀貨と金貨は1コインのみ生み出す。' },
    miserable: { name: '生活苦', nameEn: 'Miserable', kind: 'state', expansion: 'nocturne', cost: 0, debt: 0,
      text: '-2 勝利点' },
    twice_miserable: { name: '二重苦', nameEn: 'Twice Miserable', kind: 'state', expansion: 'nocturne', cost: 0, debt: 0,
      text: '-4 勝利点' },
    lost_in_the_woods: { name: '森の迷子', nameEn: 'Lost in the Woods', kind: 'state', expansion: 'nocturne', cost: 0, debt: 0,
      text: 'あなたのターンの開始時、あなたは手札1枚を捨て札にして祝福を1つ受けてもよい。' },

    /* ---------- 同盟（Allies）＝同盟(Ally)カード23種（横型・1ゲームに1枚だけ使う） ----------
       王国に連携(Liaison)カードが1枚でもあるとき、23枚から1枚だけ無作為に決まる（横型の合計2枚制限には数えない）。
       ⚠ 連携は分割山の中にも居る（生徒＝魔法使いの山）＝山IDだけ見ると Ally が出ないゲームになる。
       ⚠ Ally が起こす攻撃は「アタックカードのプレイ」ではない＝堀で防げない（ATTACKS に登録してはいけない）。 */
    architects_guild: { name: '建築家ギルド', nameEn: 'Architects\' Guild', kind: 'ally', expansion: 'allies', cost: 0, debt: 0,
      text: 'あなたがカード1枚を獲得するとき、好意2を使ってもよい。\nそうした場合、そのカードよりコストの低い、勝利点でないカード1枚を獲得する。' },
    band_of_nomads: { name: '遊牧民団', nameEn: 'Band of Nomads', kind: 'ally', expansion: 'allies', cost: 0, debt: 0,
      text: 'あなたがコスト3コイン以上のカード1枚を獲得するとき、好意1を使ってもよい。\nそうした場合、+1 カード、または +1 アクション、または +1 購入。' },
    cave_dwellers: { name: '穴居民', nameEn: 'Cave Dwellers', kind: 'ally', expansion: 'allies', cost: 0, debt: 0,
      text: 'あなたのターンの開始時、好意1を使ってもよい。\nそうした場合、カード1枚を捨て札にして、カード1枚を引く。これを好きな回数繰り返す。' },
    circle_of_witches: { name: '魔女の輪', nameEn: 'Circle of Witches', kind: 'ally', expansion: 'allies', cost: 0, debt: 0,
      text: '連携カード1枚を使用した後、あなたは好意3を使ってもよい。\nそうした場合、他のプレイヤーは全員、呪い1枚を獲得する。' },
    city_state: { name: '都市国家', nameEn: 'City-state', kind: 'ally', expansion: 'allies', cost: 0, debt: 0,
      text: 'あなたが自分のターンにアクションカード1枚を獲得するとき、好意2を使ってもよい。\nそうした場合、それを使用する。' },
    coastal_haven: { name: '沿岸の避難港', nameEn: 'Coastal Haven', kind: 'ally', expansion: 'allies', cost: 0, debt: 0,
      text: 'クリーンアップにあなたの手札を捨て札にするとき、好きな数の好意を使ってもよい。\nそうした場合、使った好意と同じ枚数の手札を捨て札にせずに保持する（その後カード5枚を引く）。' },
    crafters_guild: { name: '工芸家ギルド', nameEn: 'Crafters\' Guild', kind: 'ally', expansion: 'allies', cost: 0, debt: 0,
      text: 'あなたのターンの開始時、好意2を使ってもよい。\nそうした場合、コスト4コイン以下のカード1枚を獲得し、あなたの山札の上に置く。' },
    desert_guides: { name: '砂漠の案内人', nameEn: 'Desert Guides', kind: 'ally', expansion: 'allies', cost: 0, debt: 0,
      text: 'あなたのターンの開始時、好意1を使ってもよい。\nそうした場合、あなたの手札をすべて捨て札にして、カード5枚を引く。これを好きな回数繰り返す。' },
    family_of_inventors: { name: '発明家の家族', nameEn: 'Family of Inventors', kind: 'ally', expansion: 'allies', cost: 0, debt: 0,
      text: 'あなたの購入フェイズの開始時、あなたの好意トークン1枚を、サプライの勝利点でない山1つの上に置いてもよい。\nカードのコストは、そのカードの山の上にある好意トークン1枚につき1コイン少なくなる。' },
    fellowship_of_scribes: { name: '写本士の仲間たち', nameEn: 'Fellowship of Scribes', kind: 'ally', expansion: 'allies', cost: 0, debt: 0,
      text: 'アクションカード1枚を使用した後、あなたの手札が4枚以下の場合、好意1を使ってもよい。\nそうした場合、+1 カード。' },
    forest_dwellers: { name: '森の居住者', nameEn: 'Forest Dwellers', kind: 'ally', expansion: 'allies', cost: 0, debt: 0,
      text: 'あなたのターンの開始時、好意1を使ってもよい。\nそうした場合、あなたの山札の上から3枚を見て、その中の好きな枚数を捨て札にし、残りを好きな順番で山札の上に戻す。' },
    gang_of_pickpockets: { name: 'すり師団', nameEn: 'Gang of Pickpockets', kind: 'ally', expansion: 'allies', cost: 0, debt: 0,
      text: 'あなたのターンの開始時、好意1を使わないかぎり、手札が4枚になるように捨て札にする。' },
    island_folk: { name: '島民', nameEn: 'Island Folk', kind: 'ally', expansion: 'allies', cost: 0, debt: 0,
      text: 'あなたのターンの終了時、好意5を使ってもよい。\nそうした場合、このターンの後に追加のターンを1回行う（3ターン連続にはできない）。' },
    league_of_bankers: { name: '銀行家連盟', nameEn: 'League of Bankers', kind: 'ally', expansion: 'allies', cost: 0, debt: 0,
      text: 'あなたの購入フェイズの開始時、あなたが持つ好意4につき +1 コイン（端数切捨て）。' },
    league_of_shopkeepers: { name: '小売店主連盟', nameEn: 'League of Shopkeepers', kind: 'ally', expansion: 'allies', cost: 0, debt: 0,
      text: '連携カード1枚を使用した後、あなたが好意を5以上持っている場合は +1 コイン、好意を10以上持っている場合は +1 アクション、+1 購入。' },
    market_towns: { name: '市場の町', nameEn: 'Market Towns', kind: 'ally', expansion: 'allies', cost: 0, debt: 0,
      text: 'あなたの購入フェイズの開始時、好意1を使ってもよい。そうした場合、あなたの手札からアクションカード1枚を使用する。\nこれを好きな回数繰り返す。' },
    mountain_folk: { name: '山の民', nameEn: 'Mountain Folk', kind: 'ally', expansion: 'allies', cost: 0, debt: 0,
      text: 'あなたのターンの開始時、好意5を使ってもよい。そうした場合、+3 カード。' },
    order_of_astrologers: { name: '占星術師団', nameEn: 'Order of Astrologers', kind: 'ally', expansion: 'allies', cost: 0, debt: 0,
      text: 'あなたがシャッフルするとき、あなたが使う好意1につきカード1枚を取り出してもよい。\nそうした場合、そのカードをシャッフルした束の一番上に置く。' },
    order_of_masons: { name: 'メイソン団', nameEn: 'Order of Masons', kind: 'ally', expansion: 'allies', cost: 0, debt: 0,
      text: 'あなたがシャッフルするとき、あなたが使う好意1につきカード2枚までを取り出してもよい。\nそうした場合、そのカードを捨て札置き場に置く。' },
    peaceful_cult: { name: '平和的教団', nameEn: 'Peaceful Cult', kind: 'ally', expansion: 'allies', cost: 0, debt: 0,
      text: 'あなたの購入フェイズの開始時、好きな数の好意を使ってもよい。\nそうした場合、あなたの手札から使った好意と同じ枚数のカードを廃棄する。' },
    plateau_shepherds: { name: '高原の羊飼い', nameEn: 'Plateau Shepherds', kind: 'ally', expansion: 'allies', cost: 0, debt: 0,
      text: '得点計算時、あなたの持つ好意1とコスト2コインのカード1枚のペア1組につき 2 勝利点。' },
    trappers_lodge: { name: '罠師の小屋', nameEn: 'Trappers\' Lodge', kind: 'ally', expansion: 'allies', cost: 0, debt: 0,
      text: 'あなたがカード1枚を獲得するとき、好意1を使ってもよい。そうした場合、そのカードを山札の上に置く。' },
    woodworkers_guild: { name: '木工ギルド', nameEn: 'Woodworkers\' Guild', kind: 'ally', expansion: 'allies', cost: 0, debt: 0,
      text: 'あなたの購入フェイズの開始時、好意1を使ってもよい。そうした場合、あなたの手札からアクションカード1枚を廃棄する。\n廃棄したなら、アクションカード1枚を獲得する。' },

    /* ===== 略奪（Plunder）の横型＝イベント15＋特性(Trait)15。段階1（CARD_SETS 未参照） =====
       特性(Trait)は新 kind＝ゲームの準備でサプライの王国の山1つに付ける（付いた山のカード全部に効く）。 */
    /* ---------- 略奪（Plunder）イベント 15種 ----------
       買う横型（`DOM.LANDSCAPES` 側）。**負債コスト・ポーション費用は1枚も無い＝すべてプレーンなコインのみ**。
       種別は15枚とも `Event` だけ（Attack でも Duration でもない＝堀では防げない／持続の予約を張らない）。
       ⚠ 英語id `plunder` は帝国の分割山カード「鹵獲品」で使用済みなので、プール名は **`plunderexp`**。
       ⚠ `journey`（旅行）は **2023年9月の Extra turn errata 側**を採用（決定 D1＝研究doc 冒頭）。
          ＝`Once per turn:` の前置句は無く、「ただし連続3ターンとなる場合は得られない」を持つ。
          根拠＝本アプリは**同じ2023エラッタの `mission`（使節団）を既に採用済み**（`ONCE_PER_TURN_EVENTS` に
          `mission` が無い＝§0-26）で**旅行はその完全な同型**／**日本語文面は Dominion Online 訳で統一（D2）**
          しており DO の `旅行` は**エラッタ側の文面**なので、旧版を採ると「表示は新版・挙動は旧版」になる。
          **反転は1行**（`ONCE_PER_TURN_EVENTS` に journey を足し、この text を旧版へ戻す）。
       ⚠ 検証で追記（研究doc 第6章 §4-H）：`ONCE_PER_TURN_EVENTS` に入れるのは **`launch` の1枚だけ**。
          launch＝`"Once per turn" applies to the whole Event.`（journey はエラッタで前置句が消えたので入れない）。
          **`deliver` は入れてはいけない**＝Donald X. 明言 `Deliver doesn't have "once per turn," even though
          it does nothing when bought multiple times.`（＝何回でも買えて2枚目以降が空振り）。
          他の12枚も once per turn 表記なし＝同じリストに入れないこと。
       正本＝docs/research/plunder_rules.md 第6章 ---- */
    // +1 Buy / Put any card from your discard pile on the bottom of your deck.
    bury: { name: '埋葬', nameEn: 'Bury', kind: 'event', expansion: 'plunderexp', cost: 1, debt: 0,
      text: '+1 購入\n捨て札置き場のカード1枚を山札の一番下に置く。' },
    // +1 Buy / The next time you shuffle this turn, pick up to 3 of those cards to put into your discard pile.
    avoid: { name: '回避', nameEn: 'Avoid', kind: 'event', expansion: 'plunderexp', cost: 2, debt: 0,
      text: '+1 購入\nこのターン次にシャッフルするとき、カードを最大3枚シャッフルから取り出し捨て札に置く。' },
    // +1 Buy / This turn, each time you gain a card, set it aside, and put it into your hand at end of turn.
    deliver: { name: '配達', nameEn: 'Deliver', kind: 'event', expansion: 'plunderexp', cost: 2, debt: 0,
      text: '+1 購入\nこのターン、カード1枚を獲得するたびにそれを脇に置き、ターン終了時に手札に加える。' },
    // You may trash an Action card from your hand to gain a Loot.
    peril: { name: '危難', nameEn: 'Peril', kind: 'event', expansion: 'plunderexp', cost: 2, debt: 0,
      text: '戦利品1枚を獲得するために、手札からアクションカード1枚を廃棄してもよい。' },
    // +1 Buy / The next time you gain an Action card this turn, play it.
    rush: { name: '突貫', nameEn: 'Rush', kind: 'event', expansion: 'plunderexp', cost: 2, debt: 0,
      text: '+1 購入\nこのターン次にアクションカード1枚を獲得したとき、それを使用する。' },
    // Discard 3 cards, revealing them. If they have 3 different names, gain a Loot.
    foray: { name: '襲撃', nameEn: 'Foray', kind: 'event', expansion: 'plunderexp', cost: 3, debt: 0,
      text: '手札3枚を公開して捨て札にする。その3枚が異なるカードの場合、戦利品1枚を獲得する。' },
    // Once per turn: Return to your Action phase. / +1 Card, +1 Action, and +1 Buy.
    // ⚠ 検証で訂正: 旧=`1ターンに1度のみ：`（研究doc の Dominion Online 訳の字面）
    //    → 既存カタログは "Once per turn:" を **5/5 すべて `1ターンに1回：`** と書いている
    //      （施し／借入／保存／巡礼／絶望）ので house style に揃えた。意味の差はゼロ。
    //    ※ 2行目の `+1 カードを引く、…、+1 購入。` も既存の列挙表記（js/cards.js:305
    //      `+1 カード、+2 アクション、+1 購入`＝「を引く」なし・末尾句点なし）に合わせてある。
    launch: { name: '発進', nameEn: 'Launch', kind: 'event', expansion: 'plunderexp', cost: 3, debt: 0,
      text: '1ターンに1回：アクションフェイズに戻る。\n+1 カード、+1 アクション、+1 購入' },
    // +1 Buy / The next time you gain an Action card this turn, gain a copy of it.
    mirror: { name: '鏡映', nameEn: 'Mirror', kind: 'event', expansion: 'plunderexp', cost: 3, debt: 0,
      text: '+1 購入\nこのターン次にアクションカード1枚を獲得したとき、追加で同じカード1枚を獲得する。' },
    // Set aside your hand face up. / At the start of your next turn, play those Actions and Treasures in any order, then discard the rest.
    prepare: { name: '準備', nameEn: 'Prepare', kind: 'event', expansion: 'plunderexp', cost: 3, debt: 0,
      text: '手札をすべて表向きに脇に置く。\nあなたの次のターンの開始時、その中のアクションカードと財宝カードを好きな順番で使用し、その後、残りを捨て札にする。' },
    // Choose one: Trash a card from your hand; / or gain an Estate from the trash, and if you did, gain a card costing up to [$5].
    scrounge: { name: '物色', nameEn: 'Scrounge', kind: 'event', expansion: 'plunderexp', cost: 3, debt: 0,
      text: '次から1つを選ぶ：\n・手札1枚を廃棄する\n・廃棄置き場から屋敷1枚を獲得する。獲得した場合、コスト5以下のカード1枚を獲得する' },
    // You don't discard cards from play in Clean-up this turn. Take an extra turn after this one (but not a 3rd turn in a row).
    // ⚠ 版＝**2023年9月の Extra turn errata 側を採用**（決定 D1・PROGRESS §4）。engine もこの版
    //    （`ONCE_PER_TURN_EVENTS` に journey は入れない／「3ターン連続不可」は島民・航海と同じ共通機構）。
    //    **`Once per turn:` の前置句が付いていたらそれは 2022印刷版＝誤り**（ここには無い＝正しい）。
    journey: { name: '旅行', nameEn: 'Journey', kind: 'event', expansion: 'plunderexp', cost: 4, debt: 0,
      text: 'このターン、あなたはクリーンアップフェイズに場のカードを捨て札にしない。\nこのターンの後に追加の1ターンを得る（ただし、連続3ターンとなる場合は得られない）。' },
    // Trash 3 cards from your hand. Each other player with 5 or more cards in hand trashes one of them.
    // ⚠ 要確認: 日本語文面だけ Dominion Online 訳（＝日本語wiki）ではなく **印刷版の逐語**を採った。
    //    理由＝この1枚だけ日本語wiki 側の記載が拡張ページの一覧表の省略形（`手札3枚を廃棄する、手札を5枚以上持つ
    //    他プレイヤーは手札1枚を廃棄`＝句点なし・体言止め）でカード文の体をなしていないため。
    //    採用したのは英語wiki `Other language versions` の Japanese 行（日本語版カード実物の書き起こし）で、
    //    wiki 側の誤字 `施棄` は `廃棄` に直してある。他の14枚は Dominion Online 訳のまま。
    maelstrom: { name: '大渦巻', nameEn: 'Maelstrom', kind: 'event', expansion: 'plunderexp', cost: 4, debt: 0,
      text: 'あなたの手札からカード3枚を廃棄する。\n手札が5枚以上ある他のプレイヤーは全員、手札からカード1枚を廃棄する。' },
    // Gain a Loot.
    looting: { name: '略奪行為', nameEn: 'Looting', kind: 'event', expansion: 'plunderexp', cost: 6, debt: 0,
      text: '戦利品1枚を獲得する。' },
    // You may play an Attack from your hand. / Gain a Duchy. Gain an Action onto your deck. / Gain a Loot; play it.
    invasion: { name: '侵略', nameEn: 'Invasion', kind: 'event', expansion: 'plunderexp', cost: 10, debt: 0,
      text: '手札からアタックカード1枚を使用してもよい。\n公領1枚を獲得する。アクションカード1枚を山札の上に獲得する。\n戦利品1枚を獲得し、使用する。' },
    // Gain a Loot, plus any number of differently named Treasures.
    prosper: { name: '繁栄', nameEn: 'Prosper', kind: 'event', expansion: 'plunderexp', cost: 10, debt: 0,
      text: '戦利品1枚と、好きな枚数の互いに異なる財宝カードを獲得する。' },
    /* ---------- 略奪（Plunder）＝特性(Trait) 15種（横型・買わない・獲得しない） ----------
       ⚠ プール名/expansion は 'plunderexp'（英語id `plunder` は帝国の分割山カード「鹵獲品」で使用済み）。
       特性はサプライの「王国カードかつアクションまたは財宝」の山1つに付き、その山に由来するカード全部に効く
       （分割山なら4種すべて／山が空になっても効き続ける／同じ山に2枚は付けない）。
       ⚠ 特性は「カード」ではない＝コスト無し・種別を増やさない（研究doc 逐語＝「廷臣や鷹匠が参照した場合でも
          【カード種別】が増えるわけではない」）。
          // ⚠ 検証で訂正: 旧=「（廷臣/鷹匠/品評会/蛮族の種別判定に混ぜない）」。品評会は"種別"ではなく"カード名"を
          //    数えるカードで、蛮族と併せて研究doc に記載が無い＝推測の追記だったので削った。
       ⚠ 選出は準備手順の最後（災いカードの山も候補に入る）。
          // ⚠ 検証で訂正: 旧=「特性の効果は準備中には効かない。」＝誤り。準備中に効かないのは Cheap だけ
          //    （研究doc §4-1 逐語 `This does not apply during setup`）。Inherited は逆に「準備(Setup)」で働く特性。
       横型の合計2枚枠に数える（イベント/ランドマーク/プロジェクト/習性と同じ）。
       日本語文面は Dominion Online 訳（＝研究doc `docs/research/plunder_rules.md` 第7章 §1 の一覧表）。
       ⚠ 無謀な(Reckless) はホビージャパン印刷版が公式に誤訳（「2回使用する」）＝**採らない**。
          英語原文どおり「1度の使用で2回指示に従う」を採用する（夜想曲の取り替え子と同じ判断）。 */
    // Cheap cards cost [$1] less.
    cheap: { name: '安価な', nameEn: 'Cheap', kind: 'trait', expansion: 'plunderexp', cost: 0, debt: 0,
      text: '安価なカードのコストは1コイン下がる。' },
    // When you gain a Cursed card, gain a Loot and a Curse.
    cursed: { name: '呪われた', nameEn: 'Cursed', kind: 'trait', expansion: 'plunderexp', cost: 0, debt: 0,
      text: '呪われたカード1枚を獲得したとき、戦利品1枚と呪い1枚を獲得する。' },
    // When shuffling, you may look through the cards and reveal Fated cards to put them on the top or bottom.
    fated: { name: '運命の', nameEn: 'Fated', kind: 'trait', expansion: 'plunderexp', cost: 0, debt: 0,
      text: 'シャッフルするとき、それらのカードをすべて見て、その中の運命のカードを何枚でも公開してもよい。\n公開した各カードをシャッフルしたカードの一番上か一番下に置く。' },
    // When you gain a Province, gain a Fawning card.
    fawning: { name: 'へつらう', nameEn: 'Fawning', kind: 'trait', expansion: 'plunderexp', cost: 0, debt: 0,
      text: '属州1枚を獲得したとき、へつらうカード1枚を獲得する。' },
    // At the start of your Clean-up phase, you may discard a Friendly card to gain a Friendly card.
    friendly: { name: '友好的な', nameEn: 'Friendly', kind: 'trait', expansion: 'plunderexp', cost: 0, debt: 0,
      text: 'あなたのクリーンアップフェイズの開始時、手札の友好的なカードのうち1枚を捨て札にしてもよい。\nそうした場合、友好的なカード1枚を獲得する。' },
    // When you gain a Hasty card, set it aside, and play it at the start of your next turn.
    hasty: { name: 'せっかちな', nameEn: 'Hasty', kind: 'trait', expansion: 'plunderexp', cost: 0, debt: 0,
      text: 'せっかちなカード1枚を獲得したとき、それを脇に置き、あなたの次のターンの開始時に使用する。' },
    // Setup: You start the game with an Inherited card in place of a starting card you choose.
    inherited: { name: '受け継がれた', nameEn: 'Inherited', kind: 'trait', expansion: 'plunderexp', cost: 0, debt: 0,
      text: '準備：ゲーム開始時の自分のカード1枚を選び、受け継がれたカード1枚と入れ替える。' },
    // After playing an Inspiring card on your turn, you may play an Action from your hand that you don't have a copy of in play.
    inspiring: { name: '鼓舞する', nameEn: 'Inspiring', kind: 'trait', expansion: 'plunderexp', cost: 0, debt: 0,
      text: 'あなたのターンに鼓舞するカードを使用した後、あなたが場に出していないアクションカード1枚を手札から使用してもよい。' },
    // When you gain a Nearby card, +1 Buy.
    nearby: { name: '近隣の', nameEn: 'Nearby', kind: 'trait', expansion: 'plunderexp', cost: 0, debt: 0,
      text: '近隣のカード1枚を獲得したとき、+1 購入。' },
    // At the start of your Clean-up phase, you may set aside Patient cards from your hand to play them at the start of your next turn.
    patient: { name: '忍耐強い', nameEn: 'Patient', kind: 'trait', expansion: 'plunderexp', cost: 0, debt: 0,
      text: 'あなたのクリーンアップフェイズの開始時に、手札から忍耐強いカードを何枚でも脇に置いてもよい。\nそうした場合、あなたの次のターンの開始時にそれらを使用する。' },
    // When you gain a Pious card, you may trash a card from your hand.
    pious: { name: '敬虔な', nameEn: 'Pious', kind: 'trait', expansion: 'plunderexp', cost: 0, debt: 0,
      text: '敬虔なカード1枚を獲得したとき、手札1枚を廃棄してもよい。' },
    // Follow the instructions of played Reckless cards twice. When discarding one from play, return it to its pile.
    reckless: { name: '無謀な', nameEn: 'Reckless', kind: 'trait', expansion: 'plunderexp', cost: 0, debt: 0,
      text: '無謀なカードは1度の使用で2回指示に従う。\n無謀なカードを場から捨て札にしたとき、それをそのカードの山に戻す。' },
    // When you gain a Rich card, gain a Silver.
    rich: { name: '豊かな', nameEn: 'Rich', kind: 'trait', expansion: 'plunderexp', cost: 0, debt: 0,
      text: '豊かなカード1枚を獲得したとき、銀貨1枚を獲得する。' },
    // At the start of your turn, you may discard one Shy card for +2 Cards.
    shy: { name: '内気な', nameEn: 'Shy', kind: 'trait', expansion: 'plunderexp', cost: 0, debt: 0,
      // ⚠ 検証で訂正: 旧='そうした場合、+2 カード。'（「を引く」が脱落）。
      //    研究doc 第7章 §1 の和文は `そうした場合、+2 カードを引く。`。既存カタログにも
      //    「このカードを廃棄したとき、+1 カードを引く。」（封土）の同型があり、文中に埋まる +N カードは「を引く」を付ける。
      text: 'あなたのターンの開始時に、手札の内気なカードのうち1枚を捨て札にしてもよい。\nそうした場合、+2 カードを引く。' },
    // When you discard a Tireless card from play, set it aside, and put it onto your deck at end of turn.
    tireless: { name: '疲れ知らずの', nameEn: 'Tireless', kind: 'trait', expansion: 'plunderexp', cost: 0, debt: 0,
      text: '疲れ知らずのカードを場から捨て札にしたとき、それを脇に置き、ターン終了時に山札の上に置く。' },

    /* ---------- 旭日（Rising Sun）イベント 10種（横型・購入フェイズに買う） ----------
       正本＝docs/research/risingsun_rules.md 第6章（英語wiki 全10ページ＋日本語wiki 全10ページを敵対検証済み）。
       日本語のカード文面は Dominion Online 訳（＝日本語wiki 掲載）を既存カタログの言い回しへ寄せたもの（決定D1）。

       ⚠ **`expansion: 'risingsun'` を書き忘れると `DOM.EVENTS_RISINGSUN` が空になる**（しかもテストは赤にならない）。
          `DOM.EVENTS_*` は `kind === 'event' && expansion === '<プール名>'` の filter で派生する
          （js/cards.js の `DOM.EVENTS_PLUNDER` を参照）。段階1で必要なのは**この派生1行だけ**（登録済み）。
       🛑 **段階1では `DOM.eventPoolFor` にも `DOM.MIX_LANDSCAPE_POOLS` にも足さないこと**。
          この10種は**まだ効果が未実装**なので、配線すると mix-all の横型抽選に出て
          「買っても何も起きない死に札イベント」を$2〜$7で買わされる（縦型を `DOM.STAGE1_POOLS` で
          闇市場から塞いでいるのと同じ理由）。**配線は段階2の R7（CARD_SET 昇格）で、効果を実装してから**行う。
          （起草時のコメントは「段階1で3箇所配線せよ」と誤って書いていた＝独立監査2件が指摘して訂正）
       ⚠ 横型 kind `event` のスキンは既存（茶褐色・コスト円あり）＝`tools/build-landscape.js` の新設は不要。
          **新スキンが要るのは予言(Prophecy) だけ**（kind: 'prophecy'）。ここを混同しないこと。

       ⚠ 版＝10枚とも `First edition / August 2024` の1行のみ＝**機能エラッタ ゼロ**
          （略奪の Journey のような「版の選択」問題はこの10枚には無い）。
       ⚠ 区切り線（————）＝**10枚とも0本**。英語wiki の生HTML 10ファイルで `<hr` が 0
          （同じ手法で旭日の王国カードは 4〜5本を返す＝取りこぼしではないことを対照実験で確認済み。
           正本の第6章 §0-3 逐語＝`Alley=4／Ninja=4／Ronin=4／Tanuki=4／Fishmonger=5／Riverboat=4`）。
          ＋ `g0_jp_pairs.md` のイベント10行にも `--------------------` が1つも無い（独立2ソースで一致）。
          `Foresight` の "at end of turn"、`Kintsugi` の "If you've gained a Gold this game" も
          **区切り線では分かれていない**（＝1つの文の連なり）。
       ⚠ 改行＝**洞察 が2行／継続 が3行／残り8枚は1行**。
          英語wiki の "Event text" セルは改行を落とすことがある（`Launch` も英語wiki では0改行だが
          既存カタログは `\n` を入れている）ので、**日本語wiki のカード文表（`<br>` を保つ）を正とした**。
          `g0_jp_pairs.md` の EN/JP 両行の区切り位置とも一致する。
       ⚠ 負債コストを持つのは **継続(Continue)＝`cost: 0, debt: 8`** の1枚だけ。他9枚はプレーンなコインのみ。
       ⚠ `ONCE_PER_TURN_EVENTS` に足すのは **`continue` の1枚だけ**（生HTML 10枚を `Once per turn` で
          機械検索＝Continue のみヒット／他9枚は0）。残り9種は購入権と $ がある限り同じターンに何度でも買える。

       ⚠ id の注意（既存761枚と機械照合済み＝衝突ゼロ）：
        - **`continue` は JavaScript の予約語**なので **キーを引用符で囲む**（`'continue': { … }`）。
          参照も `DOM.LANDSCAPES['continue']` / `case 'continue':` とブラケット記法で統一する。
        - `sea_trade`（海上交易）は冒険のイベント `trade`（交易・$5）と**別物**。id は衝突しないが、
          カード一覧の全文検索で「交易」が2件出る。
        - `gather`（参集・イベント）と `DOM.GATHERING_CARDS`（帝国の「集合」＝山の上にVPトークンを貯める機構）は
          **まったくの別物**。英語wiki も Gather ページ冒頭で注記している。取り違えないこと。 ---- */
    // If you have no Action cards in play, gain an Action card costing up to [$5].
    // ⚠ 「場にアクションが無い」の判定は p.inPlay ＋ p.durationCards の両方を見る（公式FAQ が
    //    「前のターンに使った持続カードが場にあると獲得できない」と名指し）。段階2の注意点。
    amass: { name: '蓄積', nameEn: 'Amass', kind: 'event', expansion: 'risingsun', cost: 2, debt: 0,
      text: 'アクションカードを1枚も場に出していない場合、コスト5以下のアクションカード1枚を獲得する。' },
    // Pay any amount of [$] to trash that many cards from your hand.
    asceticism: { name: '苦行', nameEn: 'Asceticism', kind: 'event', expansion: 'risingsun', cost: 2, debt: 0,
      text: 'コインを好きなだけ支払い、それと同じ枚数の手札を廃棄する。' },
    // Gain an Action or Treasure costing up to [$8]. +[D] equal to its cost.
    // ⚠ DO訳の末尾は「そのコストに等しい数だけ、+〈負債トークンのアイコン〉。」＝アイコンを文字で書けないため、
    //    既存カタログの言い回し（元手 capital＝「負債6を得て」／峠 mountain_pass＝「入札した額の負債を負う」）に
    //    合わせて **「負債を得る」** と語で表記した。**本アプリでカード文が負債を与える最初の1枚**。
    credit: { name: '信用', nameEn: 'Credit', kind: 'event', expansion: 'risingsun', cost: 2, debt: 0,
      text: 'コスト8以下のアクションカードまたは財宝カードを獲得する。そのコストに等しい数だけ負債を得る。' },
    // Reveal cards from your deck until revealing an Action. / Set it aside and discard the rest. Put it into your hand at end of turn.
    // ⚠ 「ターン終了時に手札へ」＝本アプリでは**次の手札を先引きした後**（公式FAQ＝`added to your hand after
    //    drawing your next hand`）。既存の同型＝配達 deliver／パズルボックス／トリックスター／疲れ知らずの。
    foresight: { name: '洞察', nameEn: 'Foresight', kind: 'event', expansion: 'risingsun', cost: 2, debt: 0,
      text: 'アクションカード1枚が公開されるまで山札を上から公開する。\nその1枚を脇に置き、残りを捨て札にする。ターン終了時、そのカードを手札に加える。' },
    // Trash a card from your hand. If you've gained a Gold this game, gain a card costing up to [$2] more than the trashed card.
    kintsugi: { name: '金継ぎ', nameEn: 'Kintsugi', kind: 'event', expansion: 'risingsun', cost: 3, debt: 0,
      text: '手札1枚を廃棄する。このゲーム中に金貨1枚を獲得していた場合、廃棄したカードよりコストが最大2コイン高いカード1枚を獲得する。' },
    // You may play an Action card from your hand twice.
    practice: { name: '稽古', nameEn: 'Practice', kind: 'event', expansion: 'risingsun', cost: 3, debt: 0,
      text: '手札のアクションカード1枚を2回使用してもよい。' },
    // +1 Card per Action card you have in play. Trash up to that many cards from your hand.
    // ⚠ DO訳は「+1 カードを引く」＝既存カタログの表記（沼地の小屋／市街 と同じ「〜につき、+1 カード。」）に正規化した。
    //    「場に出しているアクション」は DO訳の逐語（英語原文は "per Action card you have in play"）。
    sea_trade: { name: '海上交易', nameEn: 'Sea Trade', kind: 'event', expansion: 'risingsun', cost: 4, debt: 0,
      text: '場に出しているアクション1枚につき、+1 カード。その枚数以下の手札を廃棄してもよい。' },
    // If you've gained at least 3 cards this turn, gain up to 3 differently named Action cards you don't have copies of in play.
    receive_tribute: { name: '賛辞', nameEn: 'Receive Tribute', kind: 'event', expansion: 'risingsun', cost: 5, debt: 0,
      text: 'このターン3枚以上カードを獲得していた場合、場に出していないアクションカードを1枚ずつ3種類まで獲得してもよい。' },
    // Gain a card costing exactly [$3], a card costing exactly [$4], and a card costing exactly [$5].
    // ⚠ DO訳に "exactly" に当たる語は無いが、日本語ドミニオンでは「コスト3のカード」＝**ちょうど$3**
    //    （「コスト3以下」と書き分ける）＝訳の欠落ではない。段階2は英語原文どおり costExact で書くこと。
    gather: { name: '参集', nameEn: 'Gather', kind: 'event', expansion: 'risingsun', cost: 7, debt: 0,
      text: 'コスト3、コスト4、コスト5のカードを1枚ずつ獲得する。' },
    // Once per turn: Gain a non-Attack Action card costing up to [$4]. / Return to your Action phase and play it. / +1 Action and +1 Buy.
    // ⚠ キーは予約語なので引用符付き（上の注意を参照）。**この10枚で唯一の負債コスト**（$0＋負債8）。
    // ⚠ "Once per turn:" は既存カタログ **6/6**（施し／借入／保存／巡礼／絶望／**発進**）と同じ **`1ターンに1回：`** に揃えた
    //    （逐語検証で機械確認＝`kind:'event'` の既存68種のうち `1ターンに1回：` を持つのはこの6枚だけ・
    //      `1ターンに1度のみ：` を持つカード文は0件）
    //    （DO訳の字面は「1ターンに1度のみ：」。意味の差はゼロ）。末尾の `+1 アクション、+1 購入` を句点なしに
    //    したのも既存の発進 launch（`+1 カード、+1 アクション、+1 購入`）に合わせたもの。
    'continue': { name: '継続', nameEn: 'Continue', kind: 'event', expansion: 'risingsun', cost: 0, debt: 8,
      text: '1ターンに1回：アタックでないコスト4以下のアクションカード1枚を獲得する。\nアクションフェイズに戻り、それを使用する。\n+1 アクション、+1 購入' },
    /* ---------- 旭日（Rising Sun）＝予言(Prophecy) 15種（横型・買わない・獲得しない） ----------
       ⚠ プール名/expansion は 'risingsun'（`rising_sun` ではない＝既存の expansion 名は全部1語＝
          empires / adventures / renaissance / menagerie / nocturne / allies / plunderexp）。
       ⚠ `kind: 'prophecy'` は**新 kind**。段階1で `tools/build-landscape.js` に3行足すこと：
          `SKIN` に `prophecy: { base: [...] }`＝**iris blue（菖蒲色＝青紫）**（研究doc 逐語
          `the Prophecy effects are printed on cards in a landscape orientation with iris blue frames.`）／
          `WITH_COIN` に `prophecy: false`（**コスト欄なし**）／`KIND_LABEL` に `prophecy: '予言 / Prophecy'`。
          直近の前例＝同盟の `ally`（濃い藍）／略奪の `trait`（深い臙脂）。
          ⚠ 既存の landmark(深い青緑) / artifact(灰青) / ally(濃い藍) / hex(濃い紫) と**混ざらない**色にすること。
       ⚠ 予言は「カード」ではない（英語wiki `Prophecy` 導入文 逐語＝
          `In fact, Prophecies are not considered "cards" at all; any text referring to a "card"
          (such as instructions to "name a card") does not apply to Prophecies.`）
          ＝**`DOM.CARDS` に入れない**／保存則 tally・`allCards`・庭園/品評会・
          「カード名を宣言」（建て直し/秘術師/医者/熟練工）から除外する。＝`ally` / `trait` と同じ扱い。
       ⚠ **1ゲームに使う予言は必ず1枚だけ**（前兆(Omen)が何枚あっても1つ。ルールブック逐語
          `Only use one Prophecy no matter how many Omens you have.`）
          ＝**予言どうしは絶対に同居しない＝相互作用の実装もテストも不要**。
       ⚠ 横型の「合計2枚まで」には**数えない**（ルールブックの2枚制限の列挙は
          `Events, Traits, Landmarks, Projects, and Ways` で予言は入っておらず、
          別段落の「オーメンがあれば1枚配る」手順に乗る）＝**同盟の Ally と同型と判断**。
          ⚠ ただし「予言は数えない」という**否定形の明文は取れていない**＝PROGRESS にそう明記すること。
       ⚠ Sunトークン＝2人5／3人8／4人10／5人12／6人13。「+1 Sun」で1個取り除き、
          **最後の1個を取り除いた瞬間**に予言の効果が有効になり、以後ずっと有効
          （全部取り除いた後の「+1 Sun」は何もしない）。**予言のテキストはそれまで一切効かない**。
          例外＝**来寇(Approaching Army) の `準備：` だけはゲーム開始時から効く**（下記）。
       ✅ **15種とも英語wiki の Versions 表は `First edition / August 2024` の1行だけ＝機能エラッタ 0件**
          （研究doc 第7章 §7-1 で機械確認済み）。
       日本語文面＝Dominion Online 訳（＝日本語wiki／`C:/tmp/risingsun_research/g0_jp_pairs.md`。決定D1）。
       研究doc の逐語からの**意図的な差分は次の5種だけ**（(1)〜(3) は略奪の段階1と同じ正規化規則）。
       **15件を機械照合し、下記の4枚以外は DO訳と1文字も違わないことを確認済み**：
         (1) 「+N カードを引く」→「+N カード」（悟り 1枚のみ該当）。
             ⚠ **【逐語検証で訂正】起草時の理由づけ（「既存は『+N カード』が多数派だから」）は根拠として弱い**。
             `js/cards.js` L2474-2476 に**逆のこと**を書いた既存コメント（「文中に埋まる +N カードは
             『を引く』を付ける」＝略奪の検証時に足されたもの）があり、多数決だけを理由にすると
             統合者がそのコメントを読んで「を引く」に戻してしまう。**実測した本当の規則は単複で決まる**：
               ・**文中の資源が1つだけ** → 「+N カードを引く」（実在3件＝封土 L598／船首像 L1357／内気な L2477。
                 `grep -P "text: '.*\+[0-9] カードを引く"` ＝ちょうどこの3件）。
               ・**文中の資源が読点区切りの2つ以上の並び** → 「+N カード」（＝「を引く」なし）。
                 実在6件。**反例ゼロ**（`grep -c "カードを引く、+"` ＝ **0**）。
             悟りの `…代わりに、+1 カード、+1 アクション。` は**後者の形**＝「を引く」なしが正しい。
             **完全に同形の既存カード＝花婿(groom, L856)『勝利点カードの場合、+1 カード、+1 アクション。』**
             （ほか 馬上槍試合(tournament, L364)『公開しなければ、+1 カード、+1 コイン。』）。
         (2) 区切り線を既存カタログの形へ＝「--------------------」→「————」（U+2014×4。来寇 1枚のみ該当）。
         (3) 「選ぶ」の書式を既存カタログの形へ＝「次のうち1つを選ぶ：」＋「「〜」」
             → 「次から1つを選ぶ：」＋「・〜」（病 1枚のみ該当。cards.js は選択肢に「」を使わず ・ で並べる）。
         (4) 半角コロン「準備:」→全角「準備：」（来寇 1枚のみ該当＝wikiwiki 側の表記ゆれ。
             既存カタログは 16/16 すべて全角＝半角は0件）。
         (5) 厳冬 1枚のみ該当。**⚠【逐語検証で訂正】ここは1つではなく2つの変更がある**
             （起草時の記載はアイコンの件しか挙げておらず、差分の棚卸しとして不完全だった）：
               (5a) 負債トークンのアイコン `<X>` / `<2>` を語に開いた（カタログにアイコンを出す手段が無い）。
               (5b) **「それを得る」→「それを受け取る」**（DO訳の字面からの変更）。
             どちらも**徴税(tax・帝国イベント／同じ `state.pileDebt` を使う唯一の既存機構）の言い回しに揃えたもの**＝
             `js/cards.js` L2019-2020 逐語 `サプライの山1つに負債トークンを2個置く。` /
             `その山の負債トークンをすべて受け取る。`（「山から負債を取る」を **受け取る** と書く既存の唯一の前例）。
             ＝**山へ置く側・山から取る側の両方が徴税と同じ動詞になる**ので、この2枚を並べても表記がぶれない。
       ⚠ 区切り線があるのは **来寇(Approaching Army) の1枚だけ**（残り14枚は生HTML の `<hr` = 0 を機械計数済み）。
       ⚠ 本15枚に「ホビージャパン印刷版との文面差」は**1枚も確認されていない**
          （日本語wiki の `※ホビージャパン…版のテキストについては余談を参照` 注記が付くのは川船 1枚だけ）。
       ⚠ **【要判断・書式】この15件は指示どおり `cost` / `debt` を書いていない**が、
          **既存の横型は 201/201 が `cost` と `debt` を両方持っている**（逐語検証で実測。
          起草時の「171枚」は略奪を入れる前の古い数字だった）。コスト欄が無い kind も例外ではない＝
          landmark 21／event 68／project 20／artifact 5／way 20／boon 12／hex 12／state 5／ally 23／trait 15
          ＝**全 kind で 100%**。
          省略しても**機能は同じ**ことは実コードで確認済み＝コスト円を描くかは `WITH_COIN[kind]` が決め、
          `tools/build-landscape.js` の参照は `card.cost > 0`(L319) / `card.debt > 0`(L327) / `c.cost || 0`(L419)
          ＝いずれも `undefined` で false / 0 に落ちる。`js/ui.js` 側も `ls.cost || 0`。
          **統合時に house style へ揃えるなら `cost: 0, debt: 0,` を各行に足すだけでよい（挙動は1ビットも変わらない）。**
       正本＝docs/research/risingsun_rules.md 第7章（前半8種）・第8章（後半7種） ---- */
    // After you play an Attack card, +[$1]. / --- / Setup: Add an Attack kingdom card pile to the Supply.
    // ⚠ 15種で唯一 `Setup:` を持つ＝**予言が有効になっていなくてもゲーム開始時から効く**（11山目を作る）。
    //    山がアタックかは「randomizer（山キー）の種別」で判定（分割山も randomizer で見る）＝`isTypeSupply` ではない。
    //    既にアタックが王国に居ても追加する（`even if there already is one`）。
    approaching_army: { name: '来寇', nameEn: 'Approaching Army', kind: 'prophecy', expansion: 'risingsun', cost: 0, debt: 0,
      text: 'アタックカード1枚を使用したとき、+1 コイン。\n————\n準備：ゲームにアタックである王国カードの山1つを追加する。' },
    // At the start of your Clean-up, set aside your hand face down. At the start of your next turn, put those cards into your hand.
    biding_time: { name: '好機到来', nameEn: 'Biding Time', kind: 'prophecy', expansion: 'risingsun', cost: 0, debt: 0,
      text: 'クリーンアップフェイズの開始時に、手札をすべて伏せて脇に置く。\nあなたの次のターンの開始時に、それらのカードを手札に加える。' },
    // When you gain a card that doesn't cost [$0], gain a Copper.
    // ⚠ 既存の `bureaucrat`（役人・基本）と id が紛らわしい（日本語名は 官僚制／役人 で別）。
    bureaucracy: { name: '官僚制', nameEn: 'Bureaucracy', kind: 'prophecy', expansion: 'risingsun', cost: 0, debt: 0,
      text: 'コスト0でないカードを1枚獲得したとき、銅貨1枚を獲得する。' },
    // When you remove the last [Sun], remove all Kingdom card piles from the Supply, and set up 10 new random piles.
    // ⚠ 旭日 最大の難所（本アプリに前例が無い破壊的な操作＝王国10山を丸ごと入れ替える）。段階2で最後に実装すること。
    divine_wind: { name: '神風', nameEn: 'Divine Wind', kind: 'prophecy', expansion: 'risingsun', cost: 0, debt: 0,
      text: '最後のSunトークンを取り除いたとき、サプライにある王国カードの山をすべて取り除き、新しくランダムに王国カードの山10個を追加する。' },
    // Treasures are also Actions. When you play a Treasure in an Action phase, instead of following its instructions, +1 Card and +1 Action.
    // ⚠ 正規化(1)＝DO訳は「…代わりに、+1 カードを引く、+1 アクション。」。「を引く」を落とした。意味は不変。
    //    根拠＝**読点区切りで資源を2つ以上並べる文中では既存カタログは必ず「を引く」を書かない**
    //    （反例0＝`grep -c "カードを引く、+" js/cards.js` が 0）。完全に同形の前例＝
    //    **花婿(groom, js/cards.js:856)『勝利点カードの場合、+1 カード、+1 アクション。』**。
    //    ⚠ `js/cards.js` L2474-2476 の既存コメントは「文中に埋まる +N カードは『を引く』を付ける」と書いているが、
    //    それは**資源が1つだけの文**の規則（封土/船首像/内気な の3件）＝この行に適用してはいけない。
    enlightenment: { name: '悟り', nameEn: 'Enlightenment', kind: 'prophecy', expansion: 'risingsun', cost: 0, debt: 0,
      text: '財宝カードはアクションカードでもある。\nアクションフェイズに財宝カードを使用するとき、その指示に従う代わりに、+1 カード、+1 アクション。' },
    // Cards cost [$1] less. You may use Action plays as Buys.
    // ⚠ 既存の `trade`（交易・冒険イベント）／`trader`（交易商人・異郷）と id が紛らわしい。
    flourishing_trade: { name: '盛大な取引', nameEn: 'Flourishing Trade', kind: 'prophecy', expansion: 'risingsun', cost: 0, debt: 0,
      text: 'すべてのカードのコストは1コイン下がる。アクション権を購入権として使ってよい。' },
    // The first time you play each differently named Treasure each turn, first, +1 Buy and +[$1].
    // ⚠ 既存の `harvest`（収穫・収穫祭）と id が紛らわしい。
    good_harvest: { name: '豊作', nameEn: 'Good Harvest', kind: 'prophecy', expansion: 'risingsun', cost: 0, debt: 0,
      text: '各ターン中、名前の異なる財宝カードを初めて使用するたび、先に、+1 購入、+1 コイン。' },
    // After each Action card you play, +1 Action.
    // ⚠ 既存の `great_hall`（大広間・陰謀）と id が紛らわしい。
    great_leader: { name: '偉大な指導者', nameEn: 'Great Leader', kind: 'prophecy', expansion: 'risingsun', cost: 0, debt: 0,
      text: 'アクションカード1枚を使用するたび、その後に、+1 アクション。' },
    // When you gain a Treasure, gain a cheaper card.
    growth: { name: '成長', nameEn: 'Growth', kind: 'prophecy', expansion: 'risingsun', cost: 0, debt: 0,
      text: '財宝カード1枚を獲得したとき、それより安いカード1枚を獲得する。' },
    // When you gain a card on your turn, if there's [D] on its pile, take it; otherwise put [2D] on its pile.
    // ⚠ 正規化(5)＝DO訳「その山に〈負債〉がある場合、**それを得る**／その山に〈負債2〉を置く」からの変更が**2つ**ある
    //    （(5a) アイコン `<X>`/`<2>` を語に開いた ／ (5b) **「得る」→「受け取る」**）。どちらも意味は不変。
    //    根拠＝**徴税(tax・帝国イベント)＝同じ `state.pileDebt` を使う唯一の既存機構**の言い回しに揃えた。
    //    `js/cards.js` L2019-2020 逐語＝`サプライの山1つに負債トークンを2個置く。` /
    //    `その山の負債トークンをすべて受け取る。`（「山から負債を取る」は既存では **受け取る** の1例のみ）。
    //    ⚠ この2枚は mix-all で同居しうる（徴税×厳冬）＝表記を揃えておかないと同じ操作が2通りの語で出る。
    harsh_winter: { name: '厳冬', nameEn: 'Harsh Winter', kind: 'prophecy', expansion: 'risingsun', cost: 0, debt: 0,
      text: 'あなたのターンにカード1枚を獲得したとき、その山に負債トークンがある場合、それを受け取る。\nそれ以外の場合、その山に負債トークンを2個置く。' },
    // At the start of your turn, and when you remove the last [Sun]: Gain an Action to your hand.
    // ⚠ 「最後の Sun を取り除いた瞬間」に**その場で即発火する**（`in the middle of resolving the Omen`）＝
    //    「次のターン開始時にまとめて」に遅延させる実装は公式違反。取り除いた本人だけが獲得する。
    kind_emperor: { name: '神器', nameEn: 'Kind Emperor', kind: 'prophecy', expansion: 'risingsun', cost: 0, debt: 0,
      text: 'あなたのターンの開始時とあなたが最後のSunトークンを取り除いたとき、アクションカード1枚を手札に獲得する。' },
    // When you play a Treasure, +2 Buys, and when you discard one from play, return it to its pile.
    // ⚠⚠ **表示は DO訳のままだが、実装はこの訳のとおりに読んではいけない**（決定D1＝日本語文面は DO訳で統一）。
    //    DO訳の「そのカードを場から捨て札にしたとき」は原文 `when you discard one from play` の `one`
    //    （＝a Treasure＝**任意の財宝**）の訳で、「+2 購入 を得たその1枚」ではない。日本語wiki が明記＝
    //    「【狼狽+2購入】が適用されていないカードでも【狼狽戻り処理】が行われる」
    //    ＝**有効化より前に場に出した財宝も含め、場から捨てられる財宝はすべて山へ戻る**。
    //    ⚠ 表示文だけを「そのカード」→「財宝カード」に直す案もある（1語）。統合時に判断すること。
    panic: { name: '狼狽', nameEn: 'Panic', kind: 'prophecy', expansion: 'risingsun', cost: 0, debt: 0,
      text: '財宝カード1枚を使用したとき、+2 購入。そのカードを場から捨て札にしたとき、それをそのカードの山に戻す。' },
    // When you gain a card, put it onto your deck.
    // ⚠ engine の内部フラグ名（`t.progress` 等）と紛れやすい＝段階2で命名に注意（研究doc 第8章 §5）。
    progress: { name: '進歩', nameEn: 'Progress', kind: 'prophecy', expansion: 'risingsun', cost: 0, debt: 0,
      text: 'カード1枚を獲得したとき、それを山札の上に置く。' },
    // When you gain an Action or Treasure, set it aside, and play it at the start of your next turn.
    // ⚠ 略奪の特性「せっかちな(Hasty)」そのもの＝既存機構（`p.eventSetAside` ＋ `event_play`）を流用する。
    //    （カタログ文も hasty と同一構文：'…1枚を獲得したとき、それを脇に置き、あなたの次のターンの開始時に使用する。'）
    rapid_expansion: { name: '急速拡大', nameEn: 'Rapid Expansion', kind: 'prophecy', expansion: 'risingsun', cost: 0, debt: 0,
      text: 'アクションカードか財宝カード1枚を獲得したとき、それを脇に置き、あなたの次のターンの開始時に使用する。' },
    // At the start of your turn, choose one: Gain a Curse onto your deck; or discard 3 cards.
    // ⚠ 正規化(3)＝DO訳は「次のうち1つを選ぶ：「呪い1枚を…」「手札3枚を…」」。既存カタログは選択肢を
    //    「」で囲まず `・` で並べる（quartermaster と同じ直し方）ので ・ 形式へ。
    // ⚠ 「**ちょうど3枚捨てる**」＝民兵型の `discardDownEnter`（N枚に**なるまで**捨てる）を流用してはいけない。
    //    正しい前例は `FORUM_DISCARD` の `Math.min(3, hand.length)`。呪い山が空でも「獲得する」側を選べる。
    sickness: { name: '病', nameEn: 'Sickness', kind: 'prophecy', expansion: 'risingsun', cost: 0, debt: 0,
      text: 'あなたのターンの開始時に、次から1つを選ぶ：\n・呪い1枚を山札の上に獲得する\n・手札3枚を捨て札にする' },
  };
  // 帝国ランドマーク21種（抽選元）。イベントは未実装（docs/research/landscape_cards.md §2 にデータあり）。
  DOM.LANDMARKS_EMPIRES = Object.keys(DOM.LANDSCAPES).filter((id) => DOM.LANDSCAPES[id].kind === 'landmark');
  // 帝国イベント13種（抽選元）。買う横型＝BUY_EVENT で発火。
  DOM.EVENTS_EMPIRES = Object.keys(DOM.LANDSCAPES).filter((id) => DOM.LANDSCAPES[id].kind === 'event' && DOM.LANDSCAPES[id].expansion === 'empires');
  // 冒険イベント20種（抽選元）。負債は無し＝コインのみ。トークン中心。
  DOM.EVENTS_ADVENTURES = Object.keys(DOM.LANDSCAPES).filter((id) => DOM.LANDSCAPES[id].kind === 'event' && DOM.LANDSCAPES[id].expansion === 'adventures');
  // 移動動物園イベント20種（抽選元）。負債は無し＝コインのみ。追放・馬・追加ターンが中心。
  DOM.EVENTS_MENAGERIE = Object.keys(DOM.LANDSCAPES).filter((id) => DOM.LANDSCAPES[id].kind === 'event' && DOM.LANDSCAPES[id].expansion === 'menagerie');
  // 移動動物園 習性（Way）20種（抽選元）。買わない横型＝アクションの記載効果の代わりに使う。
  DOM.WAYS_MENAGERIE = Object.keys(DOM.LANDSCAPES).filter((id) => DOM.LANDSCAPES[id].kind === 'way');
  // 夜想曲：祝福12種（幸運カードから受ける横型・買わない）。
  DOM.BOONS_NOCTURNE = Object.keys(DOM.LANDSCAPES).filter((id) => DOM.LANDSCAPES[id].kind === 'boon');
  // 夜想曲：呪詛12種（不運カードから受ける横型・買わない）。
  DOM.HEXES_NOCTURNE = Object.keys(DOM.LANDSCAPES).filter((id) => DOM.LANDSCAPES[id].kind === 'hex');
  // 夜想曲：状態5種（プレイヤーが「取る」横型。獲得ではない）。
  DOM.STATES_NOCTURNE = Object.keys(DOM.LANDSCAPES).filter((id) => DOM.LANDSCAPES[id].kind === 'state');
  // 同盟：同盟(Ally)カード23種（抽選元）。**王国に連携(Liaison)が1枚でもあるとき1枚だけ**選ばれる。
  //   他の横型（イベント/ランドマーク/プロジェクト/習性）の「合計2枚まで」には数えない＝別デッキ。
  DOM.ALLIES_ALLY = Object.keys(DOM.LANDSCAPES).filter((id) => DOM.LANDSCAPES[id].kind === 'ally');
  // 略奪：イベント15種／特性(Trait)15種（段階1＝どの CARD_SET からも参照していない）。
  DOM.EVENTS_PLUNDER = Object.keys(DOM.LANDSCAPES).filter((id) => DOM.LANDSCAPES[id].kind === 'event' && DOM.LANDSCAPES[id].expansion === 'plunderexp');
  DOM.TRAITS_PLUNDER = Object.keys(DOM.LANDSCAPES).filter((id) => DOM.LANDSCAPES[id].kind === 'trait');
  /* 旭日：イベント10種／予言(Prophecy)15種（段階1＝どの CARD_SET からも参照していない）。
     予言は**王国に前兆(Omen)が1枚でもあれば1枚だけ**配る（Ally と同じ扱い＝横型の「合計2枚まで」に数えない）。 */
  DOM.EVENTS_RISINGSUN = Object.keys(DOM.LANDSCAPES).filter((id) => DOM.LANDSCAPES[id].kind === 'event' && DOM.LANDSCAPES[id].expansion === 'risingsun');
  DOM.PROPHECIES_RISINGSUN = Object.keys(DOM.LANDSCAPES).filter((id) => DOM.LANDSCAPES[id].kind === 'prophecy');
  // ルネサンス プロジェクト20種（抽選元）。買う横型＝BUY_PROJECT で発火（1人2つまで・同じものは1回だけ）。
  DOM.PROJECTS_RENAISSANCE = Object.keys(DOM.LANDSCAPES).filter((id) => DOM.LANDSCAPES[id].kind === 'project' && DOM.LANDSCAPES[id].expansion === 'renaissance');
  // ルネサンス アーティファクト5種（抽選しない＝付与カードが王国にあれば自動で盤面に出る）。
  DOM.ARTIFACTS_RENAISSANCE = Object.keys(DOM.LANDSCAPES).filter((id) => DOM.LANDSCAPES[id].kind === 'artifact');
  // 王国 → その対局で使うアーティファクトid列（付与カードが1枚でもあれば置く）。engine.createInitialState が参照。
  DOM.artifactsForKingdom = function (kingdom) {
    const k = kingdom || [];
    return DOM.ARTIFACTS_RENAISSANCE.filter((id) => (DOM.LANDSCAPES[id].grantedBy || []).some((c) => k.includes(c)));
  };
  // 「準備で山に勝利点トークンを置く」集合(Gathering)カード＝汚された神殿はこの山には置かない。
  DOM.GATHERING_CARDS = ['temple', 'farmers_market', 'wild_hunt'];

  // 補助
  DOM.isType = function (cardId, t) {
    const c = DOM.CARDS[cardId];
    return c && c.types.indexOf(t) >= 0;
  };
  DOM.isLandscape = function (id) { return !!(DOM.LANDSCAPES && DOM.LANDSCAPES[id]); };

  if (typeof module !== 'undefined' && module.exports) module.exports = DOM;
})();
