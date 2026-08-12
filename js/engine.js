/* ============================================================
   ドミニオン 基本セット - ゲームエンジン（純粋ロジック）
   状態は JSON シリアライズ可能（Firebase 同期のため）。
   reduce(state, action) -> newState という形で状態遷移する。
   ============================================================ */
(function () {
  const root = (typeof window !== 'undefined') ? window
    : (typeof global !== 'undefined') ? global : globalThis;
  const DOM = (root.DOM = root.DOM || {});

  const clone = (s) => JSON.parse(JSON.stringify(s));
  const C = () => DOM.CARDS;

  // 収穫祭：賞品（Prize）＝馬上槍試合の専用山。各1枚・購入不可・3山終了に数えない非サプライ。
  const PRIZES = ['bag_of_gold', 'diadem', 'followers', 'princess', 'trusty_steed'];
  // 冒険：トラベラーの成長先8種は非サプライ（各5枚・page/peasant が場にあるときだけ登場・購入不可・交換でのみ得る）。
  const TRAVELLER_GROWTH = ['treasure_hunter', 'warrior', 'hero', 'champion', 'soldier', 'fugitive', 'disciple', 'teacher'];
  const PRIZE_SET = new Set(PRIZES); // 馬上槍試合でのみ獲得できる「賞品」5種（NON_SUPPLY の部分集合＝混同すると mix で pending が閉じない）
  // 夜想曲：精霊3種＋願い＋コウモリ＝非サプライ山（枚数は人数によらない。専用の効果でのみ得る）。
  const SPIRITS = ['will_o_wisp', 'imp', 'ghost'];
  const NOCTURNE_NP = [].concat(SPIRITS, ['wish', 'bat']);
  // 夜想曲：家宝7種＝**山そのものが無い**（開始デッキの銅貨と置き換わるだけ）／ゾンビ3種＝準備で廃棄置き場へ。
  //   どちらも購入・汎用獲得・闇市場デッキの対象外＝NON_SUPPLY に入れて4系統から一括で除外する。
  const HEIRLOOMS = ['cursed_gold', 'goat', 'haunted_mirror', 'lucky_coin', 'magic_lamp', 'pasture', 'pouch'];
  const ZOMBIES = ['zombie_apprentice', 'zombie_mason', 'zombie_spy'];
  const NON_SUPPLY = new Set([].concat(PRIZES, ['spoils', 'madman', 'mercenary'], TRAVELLER_GROWTH, ['horse'], NOCTURNE_NP, HEIRLOOMS, ZOMBIES)); // supply の数値キーだが「山」としては数えない/買えないもの（賞品＋暗黒時代の戦利品/狂人/傭兵＋冒険のトラベラー成長先＋移動動物園の馬＋夜想曲の精霊/願い/コウモリ/家宝/ゾンビ）
  // 分割山（Split pile）：下段は上段が尽きるまで購入/獲得できない。正本は DOM.SPLIT_PILES（下段id→上段id）。
  const SPLIT_TOP = DOM.SPLIT_PILES || {};              // 下段id → 上段id（例 avanto→sauna）
  const SPLIT_BOTTOM = {}; Object.keys(SPLIT_TOP).forEach((b) => { SPLIT_BOTTOM[SPLIT_TOP[b]] = b; }); // 上段id → 下段id
  /* その id が「まだ山の一番上に出ていなくて獲得/購入できない」か。
     通常は下段が上段の下に隠れている。**同盟の循環(Rotate)で上下が入れ替わった山**（`state.splitRotated`）では
     逆に上段が隠れる（戦闘計画は「任意のサプライ山」を回せる＝サウナ/アヴァントや帝国の5組も対象）。 */
  function splitLocked(state, id) {
    const rot = (state && state.splitRotated) || {};
    const top = SPLIT_TOP[id];
    if (top) return !rot[top] && (state.supply[top] || 0) > 0;                            // 下段
    if (SPLIT_BOTTOM[id]) return !!rot[id] && (state.supply[SPLIT_BOTTOM[id]] || 0) > 0;  // 上段（回転中のみ隠れる）
    return false;
  }
  /* 同盟：分割山6組（卜占官/衝突/城砦/叙事詩/町民/魔法使い）＝4種×4枚＝16枚。**帝国の2段 SPLIT_PILES とは別物**で、
     混合山（castles/knights）と同じく state[pileId] に実カードid配列を持ち、一番上の1枚だけ購入/獲得できる。
     ALLIES_PILE_OF: 中身のカードid → その山id（'sorceress' → 'augurs'）。 */
  const ALLIES_SPLIT = DOM.ALLIES_SPLIT_PILES || {};
  const ALLIES_PILE_IDS = Object.keys(ALLIES_SPLIT);
  const ALLIES_PILE_OF = {};
  ALLIES_PILE_IDS.forEach((pileId) => { ALLIES_SPLIT[pileId].forEach((cid) => { ALLIES_PILE_OF[cid] = pileId; }); });
  /* 混合山（＝順序つきの実カードid配列 `state[山キー]` で管理する山）の**唯一の正本**。
     暗黒時代の廃墟/騎士・帝国の城・同盟の分割山6組がこれ。**ここに足せば**
       gain の isMixed／trashFromSupplyPile／returnToPile／availableInSupply／exileFromSupply／
       cardCost／populatePiles／封鎖(BLOCKADE_GAIN)／追放候補(exilableSupplyIds)
     が一斉に対応する。※同盟の前は ['ruins','knights','castles'] が7箇所にリテラルで散らばっていた。
     - 一番上の1枚だけ購入/獲得/廃棄できる（`state[k][0]`）。`supply[k]` は残数（配列長と同期）。
     - 「山のコスト・種別」は**プレースホルダのカード（＝randomizer＝最安カード）**が持ち、
       「買うときのコスト」は**今の一番上**（cardCost が解決する）。この2つを混同しないこと。 */
  const MIXED_PILE_KEYS = ['ruins', 'knights', 'castles'].concat(ALLIES_PILE_IDS);
  const MIXED_PILE_SET = new Set(MIXED_PILE_KEYS);
  /* 混合山の「中身」＝単体では山を持たないカード（廃墟5／騎士10／城8／同盟の分割山24）。
     **名指しで購入できない**（山の一番上でのみ買える）／**闇市場デッキに入れない**（$0で単体入手できてしまう）。 */
  const MIXED_PILE_CONTENTS = new Set([].concat(
    (DOM.POOLS && DOM.POOLS.knights) || [], (DOM.POOLS && DOM.POOLS.ruins) || [],
    (DOM.POOLS && DOM.POOLS.castles) || [], (DOM.POOLS && DOM.POOLS.allies_split) || []));
  /* 混合山のうち**中身と順序が秘密**の山＝無作為に積む廃墟と騎士だけ（maskStateFor が一番上以外を伏せる）。
     城は昇順で決定的、同盟の分割山6組は公式に「いつでも全部見てよい」＝どちらも全公開なのでここに入れない。
     ※サーバの「相手の同意なしで1手もどす」も この集合を見る（買うと次の1枚が見えてしまう山＝
       見てから無料で戻せると不正になるため、承認制へ落とす）。 */
  const HIDDEN_MIXED_PILE_KEYS = ['ruins', 'knights'];
  function isMixedPileKey(id) { return MIXED_PILE_SET.has(id); }
  // その混合山の「一番上の実カードid」（山が無い/空なら null）。
  function mixedTopCard(state, pileId) {
    return (isMixedPileKey(pileId) && Array.isArray(state[pileId]) && state[pileId].length) ? state[pileId][0] : null;
  }
  // その id が「今どこかの混合山の一番上にある実カード」なら、その山キーを返す（無ければ null）。
  function mixedPileWithTop(state, id) {
    return MIXED_PILE_KEYS.find((k) => Array.isArray(state[k]) && state[k][0] === id) || null;
  }
  /* 「サプライから**獲得／廃棄するカード**の種別」を見る述語。
     混合山（廃墟/騎士/城/同盟の分割山6組）はサプライにあるのが**一番上の1枚だけ**なので、
     山キーのプレースホルダ（randomizer）ではなく**今の一番上の実カード**の種別で判定する。
     例＝叙事詩の山の一番上が沈没した宝物（財宝）なら、待ち伏せは「アクションカード」として廃棄できないし、
         城砦の山の一番上が要塞（勝利点）なら、塩まきは「勝利点カード」として廃棄できる。
     ⚠ 「**山の**コスト・種別」を参照する効果（植民／若き魔女の災い／冒険の山トークンの置き先／
        発明家の家族／汚された神殿／オベリスク）は **randomizer を見るのが公式** ＝ そちらでは使わないこと。
     ⚠ engine拒否・CPU候補・UIフィルタの3面が必ず同じ述語を見ること（片側だけ直すと本番 livelock）。 */
  function isTypeSupply(state, id, ty) { return DOM.isType(mixedTopCard(state, id) || id, ty); }
  /* ===== 同盟：循環(Rotate) =====
     公式逐語＝`Rotating a pile means taking the top card, and all copies of it directly under it,
     and putting them on the bottom.` ＝**一番上のカードと、その直下に連続する同名のカードだけ**を
     まとめて山の一番下へ移す。**離れた位置にある同名は動かさない**（交換(Swap)や大使で順序が乱れた山の規定）。
     - **常に任意**（`You may rotate ...`）。**空の山・中身が1種類だけの山を回しても合法**（何も起きないだけ）。
       ＝選択肢ゼロの pending で詰ませない／拒否もしない。
     - **戦闘計画(Battle Plan) だけが「任意のサプライ山」を回せる**（騎士/廃墟/城/サウナも対象）。
       他5枚（触れ役/薬草集め/古地図/天幕/生徒）は自分の山を名指し＝サプライ外でも回せる。
     - 帝国/プロモの2段分割山（上段5＋下段5）は supply キーが2つで配列を持たないので、
       `state.splitRotated[上段id]` の真偽で「上下が入れ替わっている」ことを表す（splitLocked が見る）。
     戻り値＝実際に山の順序が変わったか（ログ用。false でも「回した」こと自体は合法）。 */
  function rotatePile(state, pileId) {
    if (!pileId) return false;
    const arr = state[pileId];
    if (Array.isArray(arr)) {                       // 混合山（廃墟/騎士/城/同盟の6山）
      if (arr.length === 0) return false;           // 空の山＝動かすカードが無い
      const top = arr[0];
      let n = 1;
      while (n < arr.length && arr[n] === top) n += 1;
      if (n >= arr.length) return false;            // 全部が同名＝下へ回しても見た目が変わらない
      const block = arr.splice(0, n);
      for (let i = 0; i < block.length; i += 1) arr.push(block[i]);
      return true;
    }
    // 2段分割山＝上段idで1山（下段を指定されたら上段に正規化）。片方が尽きていれば全部同名＝不変。
    const topId = SPLIT_TOP[pileId] || (SPLIT_BOTTOM[pileId] ? pileId : null);
    if (!topId) return false;                       // 普通の山＝中身が全部同名＝不変
    const bottomId = SPLIT_BOTTOM[topId];
    if ((state.supply[topId] || 0) <= 0 || (state.supply[bottomId] || 0) <= 0) return false;
    state.splitRotated = state.splitRotated || {};
    state.splitRotated[topId] = !state.splitRotated[topId];
    return true;
  }
  /* 戦闘計画(Battle Plan)＝**任意のサプライ山**を回せる（公式逐語：騎士・廃墟・城・サウナ/アヴァントも含む）。
     - 返すのは**山キー**（2段分割山は上段キーに正規化＝1山1エントリ）。
     - **サプライ山限定**（wiki 逐語：`As Battle Plan can only rotate Supply piles, it cannot rotate the Ferryman's pile`）
       ＝賞品/戦利品/馬/トラベラー成長先/精霊 などの非サプライ山は返さない。
     - **普通の山も空の山も合法な選択肢**として返す（回しても何も起きないだけ＝公式FAQ
       `Many piles won't do anything meaningful if you do this`）。残枚数で絞らない。
     ※他5枚（触れ役/薬草集め/古地図/天幕/生徒）は自分の山を**名指し**するのでこの述語を使わない
       （名指しならサプライ外の山でも回せる＝Ferryman）。 */
  function rotatableSupplyPiles(state) {
    const out = [];
    Object.keys(state.supply || {}).forEach((id) => {
      if (NON_SUPPLY.has(id)) return;
      if (SPLIT_TOP[id]) return;                       // 2段分割山の下段は上段キーで1山
      if (!C()[id]) return;
      out.push(id);
    });
    if (Array.isArray(state.ruins)) out.push('ruins'); // 廃墟は supply キーを持たない混合山
    return out;
  }
  // 王国に連携(Liaison)カードがあるか＝同盟(Ally)カードと好意を使うゲームか。**分割山は中身4種まで見る**（生徒）。
  function alliesHasLiaison(kingdom) {
    const LI = DOM.ALLIES_LIAISONS || [];
    return (kingdom || []).some((id) => LI.indexOf(id) >= 0 || (ALLIES_SPLIT[id] || []).some((c) => LI.indexOf(c) >= 0));
  }
  /* ========== 同盟（Allies）：Ally カード23種の共通基盤（A3） ==========
     Ally は**カードではない**横型ランドスケープ（`DOM.LANDSCAPES` の `kind:'ally'`）。
     1ゲームに**ちょうど1枚**だけ（王国に連携=Liaison があるときのみ）＝`state.ally`（対局中不変・公開）。
     好意(Favor)＝`p.favors`（非カード・公開・上限なし・**得点にならない**［例外＝高原の羊飼い］）。
     ⚠ **Ally が起こす攻撃は「アタックカードのプレイ」ではない＝堀で防げない**（魔女の輪・すり師団の公式FAQ逐語）。
        → `ATTACKS` に登録しない／リアクション窓を開かない／`attackImmune` を通さない。
     ⚠ **獲得したばかりの好意はその場で開いた窓に即使える**＝窓を開く前の値をスナップショットしない。
     ⚠ **好意の支払いは常に任意**。「1回の誘発につき1回だけ」（`Repeat as desired.` のある
        穴居民／砂漠の案内人／市場の町 だけが繰り返せる）。 */
  function hasAlly(state, id) { return !!state && state.ally === id; }
  // ALLY_SIMPLE（好意を使う／使わない だけの窓）が受け付ける pending 種別。
  const ALLY_SIMPLE_PENDINGS = new Set([
    'ally_mountain_folk', 'ally_desert', 'ally_scribes', 'ally_circle',
    'ally_island_folk', 'ally_city_state', 'ally_trappers', 'ally_forest',
  ]);
  // 好意を n 個使う（足りなければ何もせず false）。使うかどうかを決めるのは常に呼び出し側（＝プレイヤー）。
  function spendFavors(state, pi, n) {
    const p = state.players[pi];
    if ((p.favors || 0) < n) return false;
    p.favors -= n;
    return true;
  }
  /* 発明家の家族（Family of Inventors）＝購入フェイズの開始時、自分の好意トークン1個を
     「勝利点でないサプライの山」の上に置いてよい（マットから山へ移動＝戻ってこない）。
     ⚠ **判定は「山（randomizer）の種別」**であって今の一番上のカードの種別ではない（公式逐語＝
        騎士の一番上がデイム・ジョセフィーヌでも置ける／同盟の6分割山には置けるが 城(Castles) には置けない）。
     ※廃墟(ruins)の山は公式には置けるが、廃墟は $0 で購入もできず軽減が一切意味を持たない
       （かつ 'ruins' はカタログに無い山キーなので UI で描画できない）＝候補から外す（許容簡略化）。 */
  function favorPileTargets(state) {
    const out = [];
    Object.keys(state.supply || {}).forEach((id) => {
      if (NON_SUPPLY.has(id)) return;
      if (SPLIT_TOP[id]) return;             // 2段分割山の下段は上段キーで1山
      if (!C()[id]) return;
      if (DOM.isType(id, 'victory')) return; // ★山の種別（randomizer）で判定する
      out.push(id);
    });
    return out;
  }
  /* 占星術師団／メイソン団の自動選択に使う札の評価。星図（star_chart）の評価関数を共有する
     （§0-29 の決定＝「何個使うか」だけ本人が決め、どの札を選ぶかはエンジンが自動で最善を選ぶ）。 */
  function shuffleCardRank(c) {
    const card = C()[c] || {}; const ty = card.types || [];
    if (ty.indexOf('curse') >= 0) return -100;
    if (ty.indexOf('victory') >= 0 && ty.indexOf('action') < 0 && ty.indexOf('treasure') < 0) return -50 + (card.cost || 0);
    return (card.cost || 0) * 2 + (ty.indexOf('action') >= 0 ? 1 : 0);
  }
  // 冒険：トラベラーの成長系列（このカードを場から捨てる時、次の成長先と交換してよい）。champion/teacher は終端（次が無い）。
  const TRAVELLER_NEXT = { page: 'treasure_hunter', treasure_hunter: 'warrior', warrior: 'hero', hero: 'champion',
                           peasant: 'soldier', soldier: 'fugitive', fugitive: 'disciple', disciple: 'teacher' };
  // ギルド：過払い（overpay）できるカード＝購入時に追加でコインを払うと追加効果。BUY 後に overpay pending を立てる。
  const OVERPAY_CARDS = new Set(['stonemason', 'doctor', 'masterpiece', 'herald']);
  // 収穫祭：若き魔女の災いカード（Bane）を選ぶ。$2-3 の王国カードで、まだ場に無いものを1つ。
  //   まず収穫祭プールから、無ければ基本＋陰謀プールから抽選（公式は $2-3 の王国カードから任意の1山）。
  function pickBane(kingdom) {
    const inK = new Set(kingdom);
    const eligible = (id) => C()[id] && !inK.has(id) && !NON_SUPPLY.has(id) && !C()[id].potion &&
      (C()[id].cost === 2 || C()[id].cost === 3) &&
      (C()[id].types.includes('action') || C()[id].types.includes('treasure') || C()[id].types.includes('victory'));
    const pools = [(DOM.POOLS && DOM.POOLS.cornucopia) || [],
                   ((DOM.POOLS && DOM.POOLS.basic) || []).concat((DOM.POOLS && DOM.POOLS.intrigue) || [])];
    for (const pool of pools) {
      const cands = pool.filter(eligible);
      if (cands.length) return cands[Math.floor(Math.random() * cands.length)];
    }
    return null;
  }
  /* 移動動物園：ハツカネズミの習性（Way of the Mouse）の準備。
     「このゲームで使わない、コスト$2 か $3 の、**持続でない**アクションの王国カード1枚を脇に置く」
     （"non-Duration" は2025年2月エラッタで追加）。
     置くのは**1枚だけ**＝山ではない。サプライではないので購入も獲得もできず、3山終了にも数えない。
     コストは成分一致（ポーション費用・負債コストの札は対象外）。 */
  function pickMouseCard(kingdom) {
    const inK = new Set(kingdom);
    const eligible = (id) => {
      const c = C()[id];
      if (!c || inK.has(id) || NON_SUPPLY.has(id)) return false;
      if (c.potion || c.debt) return false;                       // 成分一致＝ちょうど$2/$3 のみ
      if (!(c.cost === 2 || c.cost === 3)) return false;
      if (!c.types.includes('action')) return false;
      if (c.types.includes('duration')) return false;             // 2025エラッタ：持続は選べない
      if (c.types.includes('command')) return false;              // 命令同士は互いにプレイできない
      if (SPLIT_TOP[id] || DOM.POOLS.castles.indexOf(id) >= 0 || (DOM.POOLS.knights || []).indexOf(id) >= 0) return false;
      return true;
    };
    const pools = [(DOM.POOLS && DOM.POOLS.menagerie) || [],
                   ((DOM.POOLS && DOM.POOLS.basic) || []).concat((DOM.POOLS && DOM.POOLS.intrigue) || [])];
    for (const pool of pools) {
      const cands = pool.filter(eligible);
      if (cands.length) return cands[Math.floor(Math.random() * cands.length)];
    }
    return null;
  }

  /* ---------- 帝国：横型ランドスケープ（ランドマーク）----------
     state.landmarks=[id...] は対局中不変（公開・maskで残る）。得点ルール／獲得・廃棄トリガーを変える。
     - state.landmarkVP={id:個数}：ランドマーク上の「有限リザーブ」（6×人数 等）。尽きたら以後得点できない。
     - state.landmarkStash={aqueduct:n, defiled_shrine:n}：山→ランドマークへ移した一時VP（最後に本人へ）。
     - state.pileVP：集合機構と共用（水道橋＝銀貨/金貨の山、汚された神殿＝各アクション山）。
     - state.obeliskPile：オベリスクで選ばれたアクション山id（得点計算で参照）。 */
  function hasLandmark(state, id) { return !!(state.landmarks && state.landmarks.indexOf(id) >= 0); }
  function hasEvent(state, id) { return !!(state.events && state.events.indexOf(id) >= 0); }
  /* ---------- ルネサンス：横型プロジェクト（Project）----------
     state.projects=[id...]＝この対局で採用しているプロジェクト（対局中不変・公開）。
     p.projects=[id...]＝そのプレイヤーが「買った」プロジェクト（キューブを置いた＝以後ずっと効果が続く）。
     - 各プレイヤーのキューブは2個＝**買えるのは最大2つ**・**同じプロジェクトは1回だけ**（イベントとの決定的な差）。
     - 複数のプレイヤーが同じプロジェクトを買える（各自に独立して効く）。
     - 効果は「そのプレイヤーが買っているか」で判定する＝必ず hasMyProject(state, pi, id) を見る（state.projects だけ見ないこと）。 */
  function isProjectInPlay(state, id) { return !!(state.projects && state.projects.indexOf(id) >= 0); }
  function hasMyProject(state, pi, id) {
    const p = state.players[pi];
    return !!(p && p.projects && p.projects.indexOf(id) >= 0 && isProjectInPlay(state, id));
  }
  const PROJECT_CUBES = 2; // 公式：各プレイヤーはキューブ2個＝プロジェクトは最大2つまで
  /* ---------- ルネサンス：アーティファクト（Artifact）----------
     state.artifacts = { flag|horn|key|lantern|treasure_chest: 席番号|null }（トップレベル・公開・**非カード**）。
     「取る(take)」は**獲得ではない**＝獲得/廃棄トリガーは一切発火しない。同時に持てるのは1人だけ＝取ると相手から奪う。
     付与カード（旗手／国境警備隊／剣客／出納官）が王国にあるときだけ createInitialState がキーを作る。 */
  function hasArtifact(state, pi, id) { return !!(state.artifacts && state.artifacts[id] === pi); }
  function takeArtifact(state, pi, id) {
    if (!state.artifacts || !Object.prototype.hasOwnProperty.call(state.artifacts, id)) return false;
    const prev = state.artifacts[id];
    const nm = (DOM.LANDSCAPES[id] && DOM.LANDSCAPES[id].name) || id;
    if (prev === pi) { log(state, `${state.players[pi].name} は既に${nm}を持っている。`); return true; }
    state.artifacts[id] = pi;
    log(state, `${state.players[pi].name} は${nm}を受け取った` +
      (prev != null ? `（${state.players[prev].name} から奪った）` : '') + '。');
    // 公式の明示例外：**ピアッツァでターン開始時に出納官がプレイされ、その解決中に鍵を取った場合**は、
    //   その開始時トリガーとして +$1 を得る（通常は「取ったターンには恩恵なし」＝開始時は既に過ぎている）。
    if (id === 'key' && state.turn && state.turn.inStartPhase && state.turn.active === pi) {
      addCoins(state, 1);
      log(state, `${state.players[pi].name} は鍵で +1コイン（ターン開始時に受け取った）。`);
    }
    return true;
  }
  // engine拒否・CPU非提案・UIボタン無効の3面が見る唯一の述語（片側だけずれると CPU 無限ループ）。
  function canBuyProject(state, pi, id) {
    const t = state.turn, p = state.players[pi];
    const pr = DOM.LANDSCAPES && DOM.LANDSCAPES[id];
    if (!pr || pr.kind !== 'project') return false;
    if (!isProjectInPlay(state, id)) return false;
    if (pi !== t.active) return false;                         // 買えるのは手番のプレイヤーだけ
    if (t.phase !== 'buy') return false;
    if ((p.debt || 0) > 0) return false;                       // 負債があるとカードもイベントもプロジェクトも買えない
    if (t.buys <= 0) return false;                             // 購入権を1消費する
    if ((pr.cost || 0) > t.coins) return false;                // プロジェクトはコスト軽減を受けない（定数コスト）
    if ((p.projects || []).indexOf(id) >= 0) return false;     // 同じプロジェクトに2個目のキューブは置けない
    if ((p.projects || []).length >= PROJECT_CUBES) return false; // キューブ切れ
    return true;
  }
  // 帝国：徴税＝獲得カードが属する「山キー」（負債は山に1個）。
  //   分割山は1山＝負債を上段キーで一元管理（下段を獲得しても上段キーの負債を受け取る）。
  //   混合山 castles/knights は実カードでなく山キーで負債を持つ。
  function pileKeyOf(state, cardId) {
    if (SPLIT_TOP[cardId]) return SPLIT_TOP[cardId]; // 下段id → 上段id（分割山は負債1個を上段キーに）
    if (state.supply && state.supply[cardId] != null) return cardId;
    if (DOM.POOLS && (DOM.POOLS.castles || []).indexOf(cardId) >= 0) return 'castles';
    if (DOM.POOLS && (DOM.POOLS.knights || []).indexOf(cardId) >= 0) return 'knights';
    // 同盟：分割山の中身24種 → その山キー（'sorceress' → 'augurs'）。山を名指しする効果は**その山の4種すべて**に効く
    //   （公式逐語＝冒険の山トークンを叙事詩の山に置くと財宝の沈没した宝物でも +$1）。
    if (ALLIES_PILE_OF[cardId]) return ALLIES_PILE_OF[cardId];
    return cardId;
  }
  // ランドマーク上のリザーブ landmarkVP[id] から per 個をプレイヤーの vpTokens へ移す（残りが per 未満なら残り全部）。移した個数を返す。
  function takeLandmarkVP(state, pIndex, id, per) {
    per = (per == null) ? 2 : per;
    if (!state.landmarkVP) state.landmarkVP = {};
    const have = state.landmarkVP[id] || 0;
    const take = Math.min(per, have);
    if (take <= 0) return 0;
    state.landmarkVP[id] = have - take;
    const p = state.players[pIndex];
    p.vpTokens = (p.vpTokens || 0) + take;
    return take;
  }

  // このターンのコスト軽減（「橋」など）を反映した実コスト
  function cardCost(state, id) {
    /* 混合山（騎士/城/同盟の分割山6組）は「山の一番上の実カード」のコストで判断する
       （騎士＝Sir Martinだけ$4／城＝一番上の最安城／同盟＝循環や購入で $3→$4→$5→$6 と動く）。
       ※これは**買うときのコスト**。「山のコスト・種別」を参照する効果はプレースホルダ（randomizer）を見る。 */
    const mixTop = mixedTopCard(state, id);
    let base = mixTop ? ((C()[mixTop] && C()[mixTop].cost) || 0) : ((C()[id] && C()[id].cost) || 0);
    const t = state.turn;
    const active = t ? state.players[t.active] : null;
    /* ===== 移動動物園：コストが動くカード3枚（コスト欄に * が付く）=====
       いずれも「あなたのターン中」＝**手番プレイヤー基準**（コストは全員に同じ値で見える＝公式FAQ）。
       効果解決の途中でも即座に変わる（獲得するたびに安くなる／捨て札が空でなくなれば戻る）ので、
       コスト比較は必ずこの cardCost を通すこと（素の DOM.CARDS[id].cost を見ると壊れる）。 */
    if (t && id === 'wayfarer') {
      // 行人＝このターンに獲得された「直前の他のカード」と同じコスト（無ければ素の$6）。
      //   コピー先の現在コスト（軽減込み）をそのまま返す＝二重に軽減しない。
      const last = t.lastGainedAny;
      if (last && last !== 'wayfarer') return cardCost(state, last);
    }
    if (t && id === 'destrier') base -= (t.gainedThisTurn || []).length; // このターン獲得した枚数ぶん安い
    if (t && id === 'fisherman' && active && (active.discard || []).length === 0) base -= 3; // 手番プレイヤーの捨て札が空なら$3安い
    // 繁栄：石切場が場にある間、アクションカードは1枚につき$2安い（$0未満にはならない）。
    if (active && DOM.isType(id, 'action')) {
      const quarries = (active.inPlay || []).filter((x) => x === 'quarry').length;
      if (quarries) base -= 2 * quarries;
    }
    // 繁栄：行商人は購入フェイズ中、場のアクションカード1枚につき$2安い。
    if (id === 'peddler' && active && t.phase === 'buy') {
      const actionsInPlay = (active.inPlay || []).filter((x) => DOM.isType(x, 'action')).length;
      if (actionsInPlay) base -= 2 * actionsInPlay;
    }
    // 収穫祭：王女が場にある間、全カードは1枚につき$2安くなる（$0未満にはならない・王女の枚数ぶん重なる）。
    if (active) {
      const princesses = (active.inPlay || []).filter((x) => x === 'princess').length;
      if (princesses) base -= 2 * princesses;
    }
    // 異郷：街道が場にある間、全カードは1枚につき$1安くなる（$0未満にはならない・街道の枚数ぶん重なる）。
    if (active) {
      const highways = (active.inPlay || []).filter((x) => x === 'highway').length;
      if (highways) base -= highways;
    }
    // 冒険：渡し船（Ferry）の -$2 コストトークン＝手番プレイヤーが自分のトークンを置いた山だけ$2安い
    //   （「あらゆる用途」に効く＝購入・改築等のコスト判定すべて。$0未満にはならない。他人の手番では効かない）。
    //   山キーは pileKeyOf で正規化する（分割山は1山＝上段キー。下段カードも同じ山なのでトークンが効く）。
    if (active && active.pileTokens && active.pileTokens.cost === pileKeyOf(state, id)) base -= 2;
    // ルネサンス：運河（Canal・プロジェクト）＝あなたのターン中、すべてのカードは$1安い（$0未満にはならない）。
    //   「あなたのターン」＝手番プレイヤーが運河を買っているとき（他人の手番では元のコストに戻る）。
    //   ※イベント/プロジェクトは「カード」ではないので安くならない（BUY_EVENT/BUY_PROJECT は cardCost を通さない）。
    if (active && t && hasMyProject(state, t.active, 'canal')) base -= 1;
    /* 同盟：発明家の家族（Family of Inventors）＝その山の上にある好意トークン1個につき $1 安い。
       **全員に・常時・累積で**効く（トークンを置いた本人だけ／手番中だけ ではない＝公式）。
       山キーは `pileKeyOf` で正規化する（分割山の中身も同じ山＝安くなる）。$0未満にはしない（末尾の Math.max）。 */
    if (state.pileFavor) base -= (state.pileFavor[pileKeyOf(state, id)] || 0);
    const red = (t && t.costReduction) || 0;
    return Math.max(0, base - red);
  }
  /* ========== ルネサンス：資本主義（Capitalism・プロジェクト）＝**財宝判定の唯一の正本** ==========
     「あなたのターン中、テキストに **+$（コイン）** を含むアクションカードは、（アクションであると同時に）財宝でもある。」
     - 「+$◯」というプラス表記が必要（公式例：増築[+$2]は財宝になるが、発明家[+$無し]はならない）。
     - **あなたのターン中は「どこにあるカードにも」適用**（相手のデッキ・廃棄置き場も）＝山賊で相手の増築を廃棄できる／
       出納官で廃棄置き場から増築を獲得できる。相手のターン中は無効。得点計算（砦）では適用しない。
     - 財宝になるので購入フェイズに何枚でも使え、**アクション権を消費しない。ただし効果は全て解決する**
       （アタックなら購入フェイズでもアタックが発動しリアクション窓も開く／持続なら場に残る）。
     実装：engine 内の財宝判定はすべて `isTreasureFor(state, id)` に集約した（DOM.isType(id,'treasure') を直接使わない）。
     判定表は日本語カードテキストから機械判定する（house style は「+N コイン」）。ただし英語原文に「+$」記号を
     持たない札（銅細工師＝"Copper produces an extra $1"）は日本語では「+1 コイン」と書いているため除外する。 */
  const CAPITALISM_RE = /[+＋]\s*\d+\s*コイン/;
  // 機械判定が取りこぼす札（本アプリのカタログ文が「+$N」表記／可変額のため）。公式英文には「+$」がある＝財宝になる。
  //   ※「+$1以下」のようなコスト参照は +$ トークンではない（変容 transmogrify は含めない）＝正規表現を広げず明示列挙する。
  const CAPITALISM_EXTRA = new Set([
    'salvager',      // +（廃棄したカードのコスト）コイン＝可変額の +$
    'artificer', 'peasant', 'messenger', 'wine_merchant', 'giant', 'swamp_hag', 'caravan_guard', 'miser', 'amulet',
  ]);
  // 機械判定に当たるが公式英文には「+$」記号が無い札（銅細工師＝"Copper produces an extra $1"）。
  const CAPITALISM_EXCLUDE = new Set(['coppersmith']);
  function isCapitalismTreasure(id) {
    const c = C()[id];
    if (!c) return false;
    if (CAPITALISM_EXCLUDE.has(id)) return false;
    if (!DOM.isType(id, 'action')) return false;
    if (DOM.isType(id, 'treasure')) return false; // 既に財宝
    if (CAPITALISM_EXTRA.has(id)) return true;
    return CAPITALISM_RE.test(c.text || '');
  }
  // 整合性テストが「集合が意図せず変わっていないか」を検査するために公開する（カタログ文を触ると静かに変わるため）。
  function capitalismTreasures() {
    return Object.keys(C()).filter((id) => isCapitalismTreasure(id));
  }
  function isTreasureFor(state, id) {
    // 混合山の山キーを渡されたら**一番上の実カード**で判定する（サプライにあるのはその1枚だけ）。
    //   手札/場のカードでは mixedTopCard が null を返すので素通り＝既存挙動は不変。
    id = mixedTopCard(state, id) || id;
    if (DOM.isType(id, 'treasure')) return true;
    const t = state && state.turn;
    if (!t || !state.projects || !state.projects.length) return false;
    if (!hasMyProject(state, t.active, 'capitalism')) return false; // 「あなたのターン中」＝手番プレイヤーが資本主義を持つ
    return isCapitalismTreasure(id);
  }
  // 錬金術：ポーション費用（「橋」等のコイン軽減では下がらない＝公式どおり固定）。
  function potionCost(id) { return (C()[id] && C()[id].potion) || 0; }
  // 財宝1枚を出したときのコイン。銅細工師の「このターン銅貨+1」(t.copperBonus)を銅貨にだけ加算。
  // PLAY_TREASURE と PLAY_ALL_TREASURES の両方でこれを使い、計算を二重実装しない。
  function treasureCoins(state, id) {
    const base = (C()[id] && C()[id].coin) || 0;
    if (id === 'copper') return base + ((state.turn && state.turn.copperBonus) || 0);
    /* 夜想曲：嫉妬(Envious)＝**返した後**このターンが終わるまで銀貨と金貨は $1 しか生まない（公式）。
       判定軸は「購入フェイズか」ではなく「嫉妬を返したか」＝語り部でアクションフェイズに出した銀貨/金貨は対象外。
       冠/ティアラ/偽造通貨で2回使っても各回 $1（applyTreasureEffect が毎回ここを通る）。
       銀貨/金貨の**付随効果は消えない**（商人の「最初の銀貨で +$1」等）。 */
    if (state.turn && state.turn.enviousActive && (id === 'silver' || id === 'gold')) return 1;
    return base;
  }
  // 冒険：-$1トークン（橋の下のトロル）は購入フェイズで最初に得る$1に食い込む。
  //   END_ACTION_PHASE で minusCoin→coinPenalty に変換し、その後コインが増えるたび（財宝/財源）ここで相殺する。
  //   コインは$0未満にならない（未消化ぶんは残るが毎ターン freshTurn でリセット）。
  function applyCoinPenalty(state) {
    const t = state.turn;
    if (!t) return;
    // 冒険：舞踏会（Ball）＝自分の購入フェイズ中に -$1トークンを受け取ることがある。END_ACTION_PHASE の変換は
    //   もう済んでいるので、ここで「購入フェイズ中に持っている -$1トークン」を食い込み分へ変換する
    //   （公式＝「次にコインを得るとき$1少なくなる」。この関数はコインが増えた直後に呼ばれる）。
    //   ※このターンにもうコインを得なければ変換されず、トークンは次のターンへ持ち越す（＝空振りしない）。
    const me = state.players && state.players[t.active];
    if (me && me.minusCoin && t.phase === 'buy' && t.coins > 0) {
      t.coinPenalty = (t.coinPenalty || 0) + 1; me.minusCoin = false;
      log(state, `${me.name} は -$1トークンを支払う（得たコインから $1）。`);
    }
    if (!(t.coinPenalty > 0)) return;
    const pay = Math.min(t.coinPenalty, t.coins);
    t.coins -= pay; t.coinPenalty -= pay;
  }
  /* 「財宝を全部出す」(PLAY_ALL_TREASURES) の並び順。
     ① **手札の財宝1枚を2回使う札（ティアラ／冠／偽造通貨）を最初に出す**。
        後回しにすると手札に財宝が残っておらず「2回使う」が空振りするため（＝出す順で強さが変わる札）。
     ② 商人の「このターン最初の銀貨」を確実に拾うため銀貨を早めに。
     ③ 帝国：大金（fortune）は最後（このターン最初の大金でコインが2倍＝合計を最大化）。 */
  const PLAY_TWICE_TREASURES = { tiara: 1, crown: 1, counterfeit: 1 };
  /* 夜想曲：「財宝を全部出す」で機械的に出してはいけない財宝（出すとデメリットが確定する）。
     呪われた金貨＝+3コインだが**必ず呪い1枚を獲得する**。1枚ずつタップして出す。 */
  const PLAY_ALL_EXCLUDE = new Set(['cursed_gold']);
  function playAllOrder(a, b) {
    const rank = (c) => (PLAY_TWICE_TREASURES[c] ? -2 : c === 'silver' ? -1 : c === 'fortune' ? 1 : 0);
    return rank(a) - rank(b);
  }
  // 財宝1枚を手札から場に出してコインを加算。「商人」の“このターン最初の銀貨で+1コイン（商人の数だけ）”もここで処理。
  // PLAY_TREASURE / PLAY_ALL_TREASURES / 闇市場 で共通利用。
  function playTreasureCard(state, pIndex, card) {
    const p = state.players[pIndex];
    removeOne(p.hand, card);
    p.inPlay.push(card);
    /* 冒険：山トークン＝「**その山のカード**を使ったとき」のボーナス＝**財宝でも乗る**（公式）。
       同盟の分割山の逐語＝`The token can be put on the Odyssey pile, and then Sunken Treasure will also
       make +[$1] when played.`（帝国の分割山も同型＝石／鹵獲品／大金が該当）。
       ※PLAY_ACTION 側と同じく「効果解決より前」に適用する。炉(kiln)で中断しても取りこぼさないよう先頭に置く。 */
    applyPileTokens(state, pIndex, card);
    // 同盟：「カードを使用した後」に働く Ally（道化棒/契約書＝**財宝の連携**なので購入フェイズでも誘発する）。
    noteAllyPlay(state, pIndex, card);
    // ルネサンス：資本主義で「財宝になったアクション」を購入フェイズに出した場合＝**アクションの効果を全て解決する**
    //   （アタックは発動しリアクション窓も開く／持続は場に残る）。アクション権は消費しない。
    //   「コインだけ加算」は必ず壊れる（公式）＝applyEffect を通す。
    if (!DOM.isType(card, 'treasure') && DOM.isType(card, 'action')) {
      state.turn.actionsPlayed = (state.turn.actionsPlayed || 0) + 1;
      log(state, `${p.name} は資本主義で「${C()[card].name}」を財宝として使った。`);
      maybeCitadel(state, pIndex, card);
      applyEffect(state, card, pIndex);
      // 冒険：-$1トークン（橋の下のトロル／舞踏会）は「最初に得る$1」に食い込む＝財宝の共通末尾と同じ処理を通す。
      applyCoinPenalty(state);
      return;
    }
    // 移動動物園：炉＝このターン、次に使うカードの**解決前**に同名を獲得してよい（財宝も対象）。
    //   窓を開いたら中断し、KILN_GAIN の解決で applyTreasureEffect を呼ぶ
    //   （PLAY_ALL_TREASURES 経由なら turn.playAllResume が残りの財宝を出し切る）。
    if (maybeKiln(state, card, pIndex, 'treasure')) return;
    applyTreasureEffect(state, pIndex, card);
  }
  /* 移動動物園：イベントで「アクション権を消費せずにカードを使用する」共通入口
     （苦労 Toil／進軍 March／博打 Gamble／遅延 Delay・刈り入れ Reap のターン開始時の使用）。
     - zone から card を取り除いて場に出し、効果を適用する。使用したカードは通常どおり片付けで捨て札になる
       （持続カードなら場に残る）。
     - **習性（Way）を指定できる**（公式：アクションカードを使用するときはいつでも代わりに習性を使える）。
     - 炉（kiln）の「次に使うカードの解決前に同名を獲得」も通す＝これも「カードの使用」だから。 */
  function playCardNoAction(state, pi, card, zone, note, way) {
    const p = state.players[pi];
    if (!removeOne(zone, card)) return false;
    p.inPlay.push(card);
    // 冒険：相続＝自分のターン中は屋敷もアクションとして使える（`applyEffect` の case 'estate' が脇札に委譲する）。
    const isAct = DOM.isType(card, 'action') || inheritedEstate(p, card);
    if (isAct) state.turn.actionsPlayed = (state.turn.actionsPlayed || 0) + 1; // 共謀者などの「このターンに使ったアクション数」
    /* 冒険：山トークン＝「その山のカードを**使った**とき」＝この経路（苦労/進軍/博打/遅延・刈り入れの
       ターン開始時の使用）も「カードの使用」なのでボーナスが乗る。PLAY_ACTION／playTreasureCard と同じく
       効果解決より前に適用する。相続の屋敷は「脇に置いたカードの山」のトークンを見る（公式）。 */
    applyPileTokens(state, pi, inheritedEstate(p, card) ? p.inherited[0] : card);
    noteAllyPlay(state, pi, card); // 同盟：「カードを使用した後」に働く Ally
    log(state, `${p.name} は${note}「${C()[card].name}」を使った。`);
    if (isAct) {
      const useWay = isUsableWay(state, way) ? way : null;
      if (useWay) log(state, `${p.name} は「${DOM.LANDSCAPES[useWay].name}」を使う。`);
      if (maybeKiln(state, card, pi, 'action', useWay)) return true;
      if (useWay) applyWay(state, useWay, card, pi);
      else applyEffect(state, card, pi);
    } else {
      if (maybeKiln(state, card, pi, 'treasure')) return true;
      applyTreasureEffect(state, pi, card);
    }
    return true;
  }
  // 移動動物園：炉（kiln）の窓。「次に使うカード1枚」ぶんの権利は、獲得しなくても・獲得できなくても消費する。
  //   サプライに無いカード（非サプライ札・在庫切れ・ロック中の分割山下段）では窓を開かない。
  function maybeKiln(state, card, pi, kind, way) {
    const t = state.turn;
    if (!t || !(t.kilnCharges > 0)) return false;
    t.kilnCharges -= 1;
    if (!gainableBase(state, card)) return false;
    state.pending = { type: 'kiln_gain', player: pi, card, kind: kind || 'action', way: way || null };
    return true;
  }
  // 財宝の「使ったとき」効果だけを適用する（カードは動かさない）。
  //   1回目＝playTreasureCard（手札→場に移してから呼ぶ）。2回目＝冠/ティアラ/偽造通貨の再演
  //   （state.replay の 'treasure_replay' から runReplays が呼ぶ＝1回目の選択待ちが解決してから走る）。
  //   自己移動する財宝（投資/戦利品/法貨/私掠船の廃棄）は removeOne ガードで2回目は自然に不発（lose track）。
  function applyTreasureEffect(state, pIndex, card) {
    const p = state.players[pIndex];
    const t = state.turn;
    addCoins(state, treasureCoins(state, card));
    // 錬金術：ポーション（特殊財宝）＝コインではなく「ポーション」を1つ得る（ポーション費用の支払いに使う）。
    if (card === 'potion') { t.potions = (t.potions || 0) + 1; }
    // 錬金術：賢者の石＝出したとき山札+捨て札の合計5枚につき +1コイン（端数切捨て）。
    if (card === 'philosophers_stone') {
      const n = p.deck.length + p.discard.length;
      const add = Math.floor(n / 5);
      addCoins(state, add);
      log(state, `${p.name} は賢者の石を使った（山札+捨て札 ${n}枚 → +${add}コイン）。`);
    }
    if (card === 'silver' && !t.silverPlayed) {
      if (t.merchants) { addCoins(state, t.merchants); log(state, `${p.name} は商人の効果で +${t.merchants} コイン。`); }
      t.silverPlayed = true;
    }
    /* ===== 移動動物園：財宝2枚（効果は必ずここに書く＝applyEffect は財宝では呼ばれない）===== */
    // 備蓄品＝+$3（coin）+1購入、これを追放する。
    //   命令経由（王子/大君主/ハツカネズミの習性）や再演（冠/ティアラ/偽造通貨の2回目）では
    //   場に無い＝takeSelf が null を返して追放されない（lose track＝公式）。
    if (card === 'stockpile') {
      t.buys += 1;
      if (takeSelf(state, pIndex, 'stockpile')) {
        (p.exile = p.exile || []).push('stockpile');
        log(state, `${p.name} は備蓄品を追放した。`);
      }
    }
    // 配給品＝+$1（coin）、馬1枚を獲得して山札の上に置く。
    if (card === 'supplies') gainHorse(state, pIndex, 'deck');
    // プロモ：サウナ＝このターンに使ったサウナ1枚につき、銀貨を使うたび手札1枚を廃棄してよい
    // （+2コインの計上後に解決＝公式）。別の選択待ちの最中（闇市場の財宝プレイ等）は上書きせず、
    // 同種の sauna_trash 中なら回数を合算する（ティアラ等で銀貨を連続プレイした場合）。
    if (card === 'silver' && (t.saunaPlays || 0) > 0 && p.hand.length > 0) {
      if (!state.pending) state.pending = { type: 'sauna_trash', player: pIndex, remaining: t.saunaPlays };
      else if (state.pending.type === 'sauna_trash' && state.pending.player === pIndex)
        state.pending.remaining += t.saunaPlays;
    }
    // 海辺：アストロラーベ（財宝・持続）＝このターン +1コイン +1購入、次の手番開始時も同じ。
    if (card === 'astrolabe') {
      addCoins(state, 1); t.buys += 1;
      armDuration(state, pIndex, 'astrolabe');
      log(state, `${p.name} はアストロラーベを使った（+1コイン +1購入。次の手番にも）。`);
    }
    // 海辺：海賊（財宝・持続）＝次の手番に6コスト以下の財宝1枚を手札に獲得。
    if (card === 'pirate') {
      armDuration(state, pIndex, 'pirate');
      log(state, `${p.name} は海賊を使った（次の手番に財宝を手札に獲得）。`);
    }
    // ===== 繁栄：財宝カードの「使ったとき」効果 =====
    // 銀行：場の財宝1枚につき +1コイン（これ自身も数える。inPlay には既に積んである）。
    if (card === 'bank') {
      const cnt = p.inPlay.filter((c) => isTreasureFor(state, c)).length;
      addCoins(state, cnt); log(state, `${p.name} は銀行を使った（場の財宝${cnt}枚 → +${cnt}コイン）。`);
    }
    // 収集：+1購入（コイン2は coin:2 で加算済み）。アクション獲得時の+VPは triggerOnGain が処理。
    if (card === 'collection') t.buys += 1;
    // ===== ルネサンス：財宝カードの「使ったとき」効果 =====
    // 香辛料：+1購入（コイン2は coin:2 で加算済み）。獲得時の +2財源 は triggerOnGain。
    if (card === 'spices') t.buys += 1;
    // ドゥカート金貨：**コインは出ない（coin:0）**。+1財源+1購入。獲得時の銅貨廃棄は triggerOnGain。
    if (card === 'ducat') {
      p.coffers = (p.coffers || 0) + 1; t.buys += 1;
      log(state, `${p.name} はドゥカート金貨を使った（+1財源 +1購入）。`);
    }
    /* 王笏（財宝・命令。2024エラッタで Command 種別を獲得）＝二択：
         「+2コイン」／「このターンに使用し**場に出たまま**の、**命令ではない**アクション1枚を再度使用する」。
       遂行できない選択肢も選べる（対象が無くても第2案を選べて何も起きない）＝engine は拒否しない。
       ※pending を立てる財宝なので、冠/ティアラ/偽造通貨の2回使用は applyTreasureEffect＋'treasure_replay' で正しく2回出る。 */
    if (card === 'scepter') {
      state.pending = { type: 'scepter', stage: 'choose', player: pIndex };
    }
    // ペテン師：他のプレイヤーは各自 銅貨1枚を獲得（アタック）。コイン3は coin:3 で加算済み。
    if (card === 'charlatan') {
      const q = [];
      for (let k = 1; k < state.players.length; k++) q.push((pIndex + k) % state.players.length);
      charlatanEnterVictim(state, pIndex, q);
    }
    // 金床：財宝1枚を捨ててコスト4以下を獲得してよい（コイン1は coin:1）。
    if (card === 'anvil' && p.hand.some((c) => isTreasureFor(state, c))) {
      state.pending = { type: 'anvil', stage: 'discard', player: pIndex };
    }
    // 投資：これを廃棄。+1コイン か 「財宝1枚を廃棄して場の財宝の種類ぶん +VP」を選ぶ。
    //   2回目のプレイ（冠/ティアラの再演）では既に場を離れている＝廃棄は不発（lose track）だが選択は行う。
    if (card === 'investment') {
      if (removeOne(p.inPlay, 'investment')) trashCard(state, pIndex, 'investment'); // 自己廃棄も trashCard 経由（墓標/司祭/下水道/支配の退避）
      state.pending = { type: 'investment', player: pIndex };
    }
    // 水晶玉：山札の上1枚を見て 廃棄／捨て札／（アクションか財宝なら）使う（コイン1は coin:1）。
    if (card === 'crystal_ball') {
      if (p.deck.length === 0 && p.discard.length > 0) { reshuffleDeck(p); }
      if (p.deck.length > 0) state.pending = { type: 'crystal_ball', player: pIndex, card: p.deck[0] };
    }
    // 暗黒時代：戦利品＝+$3（coin:3 で加算済み）。使ったら戦利品の山（非サプライ）へ戻す。
    //   2回目のプレイ（冠/ティアラ/偽造通貨の再演）では既に山へ戻っている＝返却は不発（lose track・コインは入る）。
    if (card === 'spoils') {
      if (removeOne(p.inPlay, 'spoils')) { state.supply.spoils = (state.supply.spoils || 0) + 1; log(state, `${p.name} は戦利品を使った（+$3）→山へ戻した。`); }
      else log(state, `${p.name} は戦利品をもう一度使った（+$3）。`);
    }
    // 冒険：掘出物＝+$2（coin:2 で加算済み）。プレイしたとき金貨1枚と銅貨1枚を獲得。
    if (card === 'treasure_trove') {
      const g1 = gain(state, pIndex, 'gold', 'discard'), g2 = gain(state, pIndex, 'copper', 'discard');
      if (g1 || g2) log(state, `${p.name} は掘出物で${g1 ? '金貨' : ''}${g1 && g2 ? '・' : ''}${g2 ? '銅貨' : ''}を獲得した。`);
    }
    // ティアラ：+1購入。手札の財宝1枚を2回使ってよい（獲得時の山札上置きは triggerOnGain が処理）。
    if (card === 'tiara') {
      t.buys += 1;
      if (p.hand.some((c) => isTreasureFor(state, c))) state.pending = { type: 'tiara_play', player: pIndex };
    }
    // 暗黒時代：偽造通貨＝+1購入（+$1は coin:1）。手札の非持続財宝を1枚選んで2回使い、それを廃棄してよい。
    if (card === 'counterfeit') {
      t.buys += 1;
      if (p.hand.some((c) => isTreasureFor(state, c) && !DOM.isType(c, 'duration'))) state.pending = { type: 'counterfeit', player: pIndex };
    }
    // 収穫祭：宝冠（賞品）＝+2コイン（coin:2 で加算済み）＋未使用アクション1つにつき +1コイン。
    if (card === 'diadem') {
      const bonus = (t.actions || 0);
      addCoins(state, bonus);
      log(state, `${p.name} は宝冠を使った（未使用アクション${bonus}→+${bonus}コイン）。`);
    }
    // 収穫祭：豊穣の角＝場の異なる名前（これ自身を含む）1種につきコスト1まで、カード1枚を獲得。勝利点ならこれを廃棄。
    if (card === 'horn_of_plenty') {
      const distinct = new Set(p.inPlay.concat(p.durationCards || [])).size;
      if (anyGainable(state, (id) => costUpTo(state, id, distinct))) {
        state.pending = { type: 'horn_of_plenty', player: pIndex, maxCost: distinct };
      }
    }
    // 異郷：愚者の黄金＝このターン最初なら$1（coin:1 で計上済）、2枚目以降は$4（+3コイン）。
    if (card === 'fools_gold') {
      if (t.foolsGoldPlayed) { addCoins(state, 3); log(state, `${p.name} は愚者の黄金を使った（+4コイン）。`); }
      t.foolsGoldPlayed = true;
    }
    // 異郷：大釜＝+2コイン（coin:2）＋1購入。3回目のアクション獲得の呪い配布は triggerOnGain。
    if (card === 'cauldron') { t.buys += 1; }
    // 異郷：不正利得＝銅貨1枚を手札に獲得してよい（$1 は coin:1 で計上済）。獲得時の呪い配布は triggerOnGain。
    if (card === 'ill_gotten_gains') { state.pending = { type: 'igg_play', player: pIndex }; }
    // 冒険：法貨＝+$1（coin:1 で計上済み）→ 酒場マットへ（アクション解決直後に呼び出して +2アクション）。
    if (card === 'coin_of_the_realm') putOnTavern(state, pIndex, 'coin_of_the_realm');
    // 冒険：遺物＝財宝アタック。+$2（coin:2 で計上済み）＋他の各プレイヤーは -1カードトークンを受け取る（堀で防げる）。
    if (card === 'relic') {
      const q = [];
      for (let k = 1; k < state.players.length; k++) q.push((pIndex + k) % state.players.length);
      relicEnterVictim(state, pIndex, q);
    }
    // 帝国：元手＝+6コイン（coin:6 で計上済み）＋1購入。場から捨てるときの負債6は cleanupAndAdvance で処理。
    if (card === 'capital') { t.buys += 1; }
    // 帝国：御守り（charm）＝二択（A: +1購入+$2 ／ B: このターン次にカードを獲得したとき、同コストで名前の異なるカードを1枚獲得してよい）。
    if (card === 'charm') { state.pending = { type: 'charm_mode', player: pIndex }; }
    // 帝国：鹵獲品（plunder）＝+$2（coin:2 で計上済み）＋1勝利点トークン（プレイ毎）。
    if (card === 'plunder') { p.vpTokens = (p.vpTokens || 0) + 1; log(state, `${p.name} は鹵獲品で +1勝利点。`); }
    // 帝国：大金（fortune）＝+1購入。このターンまだ大金をプレイしていなければコインを2倍（獲得時の金貨は triggerOnGain）。
    if (card === 'fortune') {
      t.buys += 1;
      if (!t.fortunePlayed) { t.coins = (t.coins || 0) * 2; t.fortunePlayed = true; log(state, `${p.name} は大金でコインを2倍にした（+1購入）。`); }
      else log(state, `${p.name} は大金（+1購入・このターン2枚目以降はコイン2倍なし）。`);
    }
    // 帝国：冠（crown）＝「現在のフェイズ」で対象種別が変わる（applyEffect の case 'crown' と共通の入口）。
    if (card === 'crown') crownOpenPending(state, pIndex);
    /* ===== 夜想曲：財宝（偶像＋家宝7種）。**効果は必ずここに書く**（applyEffect は財宝では呼ばれない） ===== */
    /* 偶像（財宝・アタック・幸運）＝+2コイン（coin:2 で計上済み）。
       **「場にある偶像の枚数」で判定する**（プレイした回数ではない＝偽造通貨で2回使っても場は1枚）。
       奇数なら祝福を1つ受ける／偶数なら他のプレイヤー全員が呪いを獲得（アタック＝堀/灯台/守護者で防げる）。 */
    if (card === 'idol') {
      const idols = p.inPlay.filter((c) => c === 'idol').length + (p.durationCards || []).filter((c) => c === 'idol').length;
      if (idols % 2 === 1) { log(state, `${p.name} は偶像（場に${idols}枚＝奇数）で祝福を受ける。`); receiveBoon(state, pIndex, 1); }
      else { log(state, `${p.name} は偶像（場に${idols}枚＝偶数）で他のプレイヤーに呪いを配る。`); idolEnterVictim(state, pIndex, othersInOrder(state, pIndex)); }
    }
    // 呪われた金貨（家宝）＝+3コイン（coin:3）、呪い1枚を獲得する（強制）。
    if (card === 'cursed_gold') { if (gain(state, pIndex, 'curse', 'discard')) log(state, `${p.name} は呪われた金貨で呪い1枚を獲得した。`); }
    // 幸運のコイン（家宝）＝+1コイン（coin:1）、銀貨1枚を獲得する。
    if (card === 'lucky_coin') { if (gain(state, pIndex, 'silver', 'discard')) log(state, `${p.name} は幸運のコインで銀貨1枚を獲得した。`); }
    // 革袋（家宝）＝+1コイン（coin:1）+1購入。
    if (card === 'pouch') t.buys += 1;
    // ヤギ（家宝）＝+1コイン（coin:1）、手札1枚を廃棄してもよい。
    if (card === 'goat' && p.hand.length) state.pending = { type: 'goat_trash', player: pIndex };
    /* 魔法のランプ（家宝）＝+1コイン（coin:1）。**場にちょうど1枚だけ出ているカードが（これを含めて）6種類以上**なら
       これを廃棄して願い3枚を獲得する。 */
    if (card === 'magic_lamp') {
      const cnt = {};
      p.inPlay.concat(p.durationCards || []).forEach((c) => { cnt[c] = (cnt[c] || 0) + 1; });
      const singles = Object.keys(cnt).filter((k) => cnt[k] === 1).length;
      if (singles >= 6 && takeSelf(state, pIndex, 'magic_lamp')) {
        trashCard(state, pIndex, 'magic_lamp');
        let g = 0; for (let i = 0; i < 3; i++) if (gain(state, pIndex, 'wish', 'discard')) g++;
        log(state, `${p.name} は魔法のランプを廃棄して願い ${g}枚 を獲得した（場に1枚だけのカードが${singles}種類）。`);
      }
    }
    // 海辺：私掠船マーク中なら、このターン最初の銀貨/金貨は出した後に廃棄される（コインは入る）。
    corsairOnPlayTreasure(state, pIndex, card);
    // 冒険：-$1トークンの相殺（購入フェイズでコインが増えたぶんに食い込む）。
    applyCoinPenalty(state);
  }
  // 帝国：冠（crown）＝「その時点のフェイズ」で対象種別が決まる（公式）。
  //   アクションフェイズ＝手札のアクション1枚を2回／購入フェイズ＝手札の財宝1枚を2回（どちらも任意）。
  //   アクションとして使う経路（PLAY_ACTION／大君主／玉座の再演／水晶玉）と、財宝として使う経路
  //   （PLAY_TREASURE／語り部／闇市場／ティアラの再演）の両方から呼ばれるので、必ず phase を見る。
  function crownOpenPending(state, pIndex) {
    const p = state.players[pIndex];
    const buyPhase = !!(state.turn && state.turn.phase === 'buy');
    const kind = buyPhase ? 'treasure' : 'action';
    // 財宝の候補判定は動的（資本主義で財宝になったアクションも対象＝受理側 CROWN_CHOOSE と同じ述語）。
    const has = kind === 'treasure'
      ? p.hand.some((c) => isTreasureFor(state, c))
      : p.hand.some((c) => DOM.isType(c, 'action'));
    if (has) state.pending = { type: 'crown', mode: kind, player: pIndex };
  }

  /* ---------- 乱数・シャッフル ---------- */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  // プロモ：へそくり(Stash)＝「これをシャッフルするとき、山札の好きな位置に置いてよい」。
  // シャッフルの多くはカード効果の解決中に同期で発生し対話を挟めない（業界最大手 Shuffle iT も
  // 未実装のままの難物）ため、各プレイヤーの常設方針 stashPlacement（'top'既定/'mix'/'bottom'）に
  // 従って自動配置する（本人はいつでも STASH_SETTING で変更可＝§6 許容簡略化）。
  // へそくりは裏面が異なる＝山札内の位置は公開情報（maskStateFor も位置を隠さない）。
  function placeStash(p) {
    const mode = p.stashPlacement || 'top';
    if (mode === 'mix') return;
    let n = 0;
    while (removeOne(p.deck, 'stash')) n++;
    for (let i = 0; i < n; i++) { if (mode === 'top') p.deck.unshift('stash'); else p.deck.push('stash'); }
  }
  // 捨て札を山札にシャッフルする共通入口（全リデューサはこれを使う＝へそくりの配置を一元処理）。
  // ※シャッフルした捨て札は既存の山札の「下」に足す（＝山札が空でない状態で呼んでも上の札を壊さない）。
  //   通常のリシャッフルは山札が空のとき呼ぶので append でも replace でも同じだが、
  //   「山札の上N枚を見る」系（旅の楽団/生存者/地下墓所）は残り<Nで非空のまま呼ぶため append 必須。
  /* ルネサンス：星図（Star Chart・プロジェクト）＝あなたがシャッフルするとき、シャッフルするカードから1枚を選び、
     **シャッフルした束の一番上**に置いてよい（2022ルールエラッタ：残りデッキがある状態では、シャッフルした束は
     残りデッキの下に付くので、選んだ札は残りデッキより下になる＝本エンジンの append 方式と一致）。
     シャッフルは効果解決の途中で同期的に起きるため対話を挟めない（へそくり Stash と同じ難所）。
     → **最良の札を自動で選ぶ**（へそくりの常設方針 stashPlacement と同型の許容簡略化）。 */
  function starChartPick(cards) {
    // 素の勝利点（アクション/財宝を兼ねない）は引きたくない＝shuffleCardRank が負にする。
    let best = null, bv = -Infinity;
    (cards || []).forEach((c) => { const v = shuffleCardRank(c); if (v > bv) { bv = v; best = c; } });
    return best;
  }
  /* 同盟：占星術師団(Order of Astrologers)／メイソン団(Order of Masons)＝**シャッフルするたび**に
     好意を払って、シャッフルする札を全部見て選び出す Ally。公式は「払うたびに選び直せる」対話だが、
     `reshuffleDeck` は同期・非対話（`draw()` の途中で起きる）＝星図/へそくりと同じ難所。
     → **「1回のシャッフルに好意を何個まで使うか」だけを本人の常設方針 `p.favorShuffle` で決め、
        どの札を選ぶかはエンジンが自動で最善を選ぶ**（§0-29 の決定＝許容簡略化。再議論しない）。
     - 占星術師団＝好意1につき1枚を「**シャッフルした束の一番上**」へ（＝残り山札の**下**＝本エンジンの concat の前）。
       `p.deck.unshift()` にすると公式より強くなるので**必ず `shuffled.unshift()`**（星図と同じ位置）。
     - メイソン団＝好意1につき**最大2枚**を捨て札置き場に残す（シャッフルに混ぜない）。
       **「捨て札置き場に置く」は「捨てる」ではない**＝`triggerOnDiscard`（村有緑地/坑道/忠犬）を通さない。
       ⚠ 全部を捨て札に残すと同じドローの中でもう一度シャッフルが走るので**必ず1枚は残す**。
     ※公式FAQ「密使(Emissary)・下役(Underling)は好意をくれる**前**にシャッフルを起こしうる＝
       まだ持っていない好意はそのシャッフルには使えない」は、この位置（シャッフル時点の p.favors を見る）で自動的に守られる。
     ※セットアップの初期山札シャッフルでは使えない（公式）＝createInitialState は reshuffleDeck を通さない。 */
  function reshuffleDeck(p, state) {
    const shuffled = shuffle(p.discard);
    p.discard.length = 0;
    if ((p.projects || []).indexOf('star_chart') >= 0 && shuffled.length > 1) {
      const pick = starChartPick(shuffled);
      if (pick != null && removeOne(shuffled, pick)) shuffled.unshift(pick);
    }
    if (p.shuffleAlly === 'order_of_masons' && (p.favorShuffle || 0) > 0 && (p.favors || 0) > 0) {
      let uses = Math.min(p.favorShuffle, p.favors);
      let moved = 0;
      while (uses-- > 0 && shuffled.length > 1) {
        // ジャンク（呪い/銅貨/素の勝利点/廃墟）が無いなら好意を無駄にしない
        const junk = shuffled.filter((c) => shuffleCardRank(c) <= 1);
        if (!junk.length) break;
        p.favors -= 1;
        junk.sort((a, b) => shuffleCardRank(a) - shuffleCardRank(b));
        for (let k = 0; k < 2 && shuffled.length > 1 && k < junk.length; k++) {
          if (removeOne(shuffled, junk[k])) { p.discard.push(junk[k]); moved++; }
        }
      }
      if (moved && state) log(state, `${p.name} はメイソン団で ${moved}枚 を捨て札置き場に残した（シャッフルに混ぜない）。`);
    }
    if (p.shuffleAlly === 'order_of_astrologers' && (p.favorShuffle || 0) > 0 && (p.favors || 0) > 0) {
      let uses = Math.min(p.favorShuffle, p.favors);
      const picks = [];
      while (uses-- > 0 && shuffled.length > 0) {
        const pick = starChartPick(shuffled);
        if (pick == null || shuffleCardRank(pick) < 5) break; // 銀貨/$3アクション未満を上に置くために好意は払わない
        if (!removeOne(shuffled, pick)) break;
        picks.push(pick); p.favors -= 1;
      }
      if (picks.length) {
        shuffled.unshift(...picks); // picks[0]（最良）がシャッフルした束の一番上
        if (state) log(state, `${p.name} は占星術師団で ${picks.length}枚 をシャッフルした束の上に置いた。`);
      }
    }
    p.deck = p.deck.concat(shuffled);
    placeStash(p);
  }

  /* ---------- サプライ初期化 ----------
     勝利点の山は人数で枚数が変わる（2人=8, 3-4人=12）。屋敷/公領/属州だけでなく
     王国の勝利点カード（庭園・公爵・貴族・大広間・後宮・製粉所 等、勝利点タイプを持つもの）
     も同じ枚数にする。それ以外の王国カードは常に10枚。 */
  function initSupply(numPlayers, kingdom) {
    const v = numPlayers <= 2 ? 8 : 12; // 勝利点の山（2人=8, 3-4人=12）
    const supply = {
      // 夜想曲：家宝は開始デッキの銅貨と置き換わる。**入れ替えた銅貨はサプライの山に戻す**（公式）ので、
      //   配らなかったぶんだけ銅貨の山が増える（createInitialState の開始デッキ算出と同じ数を使う）。
      copper: 60 - (7 - Object.keys(DOM.HEIRLOOM_OF || {}).filter((k) => kingdom.indexOf(k) >= 0).length) * numPlayers,
      silver: 40,
      gold: 30,
      estate: v,
      duchy: v,
      province: v,
      curse: 10 * (numPlayers - 1),
    };
    kingdom.forEach((k) => (supply[k] = DOM.isType(k, 'victory') ? v : 10));
    // 収穫祭：馬上槍試合が場にあれば、賞品（Prize）5種を各1枚ずつ専用山として加える。
    //   賞品は非サプライ扱い＝購入できず（canBuyCard）・3山終了に数えない（emptyPileCount）。獲得は馬上槍試合のみ。
    if (kingdom.includes('tournament')) PRIZES.forEach((id) => (supply[id] = 1));
    // プロモ/帝国：分割山＝10枚（上段5枚＋下段5枚）＝各5枚に上書き。下段は上段が尽きるまで購入/獲得できない（gain/canBuyCard がガード）。
    //   上段idが王国にあれば上下とも各5枚に（下段は createInitialState の相互補完で既に王国に居る）。
    Object.keys(SPLIT_BOTTOM).forEach((top) => { if (kingdom.includes(top)) { supply[top] = 5; supply[SPLIT_BOTTOM[top]] = 5; } });
    /* 同盟：分割山6組＝**4種×4枚＝16枚（人数によらず常に16枚）**。城のような人数別調整は無い。
       中身の並び（実カードid配列）は createInitialState が state[山キー] に作る＝ここは残数だけ。 */
    ALLIES_PILE_IDS.forEach((k) => { if (kingdom.includes(k)) supply[k] = 4 * (ALLIES_SPLIT[k] || []).length; });
    // 錬金術：王国にポーション費用カードがあれば、ポーション山（公式は16枚）を共通サプライに加える。
    if (kingdom.some((k) => C()[k] && C()[k].potion)) supply.potion = 16;
    // 繁栄：王国に繁栄の王国カードがあれば、プラチナ貨（12枚）と植民地（勝利点と同枚数）を共通サプライに加える。
    if (kingdom.some((k) => (DOM.POOLS.prosperity || []).indexOf(k) >= 0)) {
      supply.platinum = 12;
      supply.colony = v;
    }
    // 暗黒時代：特殊山の枚数（王国にトリガーカードがあるときだけ設定）。
    //   ネズミ＝常に20枚（通常10の上書き）。廃墟＝looter(死の荷車/略奪者/狂信者)があれば (人数-1)×10枚。
    //   騎士＝'knights' が王国にあれば上の kingdom.forEach で既に10枚。
    if (kingdom.includes('rats')) supply.rats = 20;
    // 廃墟(Ruins)山は supply の数値キーを持たず state.ruins（実カード配列）で管理する（createInitialState で生成）。
    //   ※'ruins' の山キーはカタログに無い＝supply に持つと CPU/UI の supply 走査が C()['ruins'] で落ちるため。
    //   騎士(knights)はカタログ有り・王国枠＝supply.knights（10枚・購入可）を kingdom.forEach で既に持つ。
    //   非サプライ山：戦利品(山賊の宿営地/略奪者/略奪)=15固定、狂人(隠遁者)=10、傭兵(浮浪児)=10。
    if (kingdom.some((k) => ['bandit_camp', 'marauder', 'pillage'].includes(k))) supply.spoils = 15;
    if (kingdom.includes('hermit')) supply.madman = 10;
    if (kingdom.includes('urchin')) supply.mercenary = 10;
    // 冒険：トラベラー＝page/peasant が王国にあれば、その成長先（非サプライ・各5枚）を supply の数値キーで加える。
    //   購入不可（canBuyCard）・3山終了に数えない（emptyPileCount）・獲得は「場から捨てる時の交換」のみ。
    if (kingdom.includes('page')) ['treasure_hunter', 'warrior', 'hero', 'champion'].forEach((id) => (supply[id] = 5));
    if (kingdom.includes('peasant')) ['soldier', 'fugitive', 'disciple', 'teacher'].forEach((id) => (supply[id] = 5));
    // 夜想曲：非サプライ山（**枚数は人数によらない**＝賞品/戦利品と同じ）。正本＝docs/research/nocturne_rules.md §6-2。
    //   ウィル・オ・ウィスプは「幸運(Fate)が1枚でもあれば」置く（沼の恵みの獲得先）／悪魔祓いは精霊3山すべてを要求する。
    if (kingdom.some((k) => DOM.isType(k, 'fate')) || kingdom.includes('exorcist')) supply.will_o_wisp = 12;
    if (kingdom.some((k) => ['devils_workshop', 'tormentor', 'exorcist'].includes(k))) supply.imp = 13;
    if (kingdom.includes('cemetery') || kingdom.includes('exorcist')) supply.ghost = 6;
    if (kingdom.includes('leprechaun') || kingdom.includes('secret_cave')) supply.wish = 12;
    if (kingdom.includes('vampire')) supply.bat = 10;
    return supply;
  }

  // 1ターン分の turn オブジェクトを作る（createInitialState と cleanupAndAdvance で共用＝フィールドのズレ防止）。
  // 海辺用に gainedThisTurn（このターン獲得したid列・密輸人/宝物庫用）/ outpostUsed / isExtraTurn / startQueue を追加。
  function freshTurn(active, isExtraTurn, extra) {
    extra = extra || {};
    return {
      active, phase: 'action', actions: 1, buys: 1, coins: 0, potions: 0, costReduction: 0,
      actionsPlayed: 0, copperBonus: 0, merchants: 0, silverPlayed: false, buysMade: 0,
      coinPenalty: 0, // 冒険：-$1トークンの未消化ぶん（購入フェイズで最初に得る$1に食い込む。毎ターンリセット）
      priestCount: 0, // ルネサンス：司祭＝このターン有効な司祭の数（廃棄1枚につき +2コイン × この数）
      cargoCharges: 0, // ルネサンス：貨物船＝このターン「獲得したカードを脇に置ける」残り回数（貨物船1枚につき1回）
      improvePlays: 0, // ルネサンス：増築＝このターンに使用した回数（玉座/山砦/王笏の再演も数える＝策謀 t.schemes と同型）
      improveLeft: null, // ルネサンス：増築＝クリンナップ開始時に残っている増築の回数（null=未初期化）
      cleanupWaiting: null, // ルネサンス：片付けを保留中の席（増築が誘発した対話を先に解決するため）
      inStartPhase: false, // ルネサンス：ターン開始時効果を解決中か（鍵をその場で取ったときの +$1 の判定用）
      afterActionCard: null, // 冒険：直前にプレイし解決したアクション（法貨/御料車の呼び出し窓の対象）
      // 冒険：横型イベント用のターン状態。
      eventsBought: [],   // このターンに購入したイベントid列（施し/借入/保存/巡礼＝1ターン1回の判定）
      extraDraw: 0,       // 探検（Expedition）＝このターンの片付けで引く枚数の追加ぶん（累積・前哨地の3枚にも加算）
      travellingFair: false, // 移動遊園地＝このターン、獲得したカードを山札の上に置いてよい
      savedCard: null,    // 保存（Save）＝脇に置いた1枚（片付けで次の手札を引いた「後」に手札へ戻す）
      noBuyCards: !!extra.noBuyCards, // 使節団（Mission）の追加ターン＝カードを購入できない（イベントは買える）
      seizeTurn: !!extra.seizeTurn, // 移動動物園：今を生きる／同盟：島民 の追加ターン（同点時のタイブレークに数えない）
      chain: extra.chain || 1,      // 同盟：島民の「3ターン連続にはできない」用＝同じ席が連続している回数（1=通常のターン）
      allyPlayed: null,             // 同盟：「カードを使用した後」に働く Ally の未処理キュー（reduce 末尾の再開網が消化する）
      populateQueue: null, populatePlayer: null, // 移動動物園：植民＝獲得が残っている山キー（reduce 末尾の再開網が使う）
      treasuresLocked: false, // 公式：一度でも購入（カード/イベント/闇市場）したら、そのターンはもう財宝を出せない
      /* 夜想曲。錯乱/嫉妬は「持っている＝効いている」ではない：**購入フェイズの開始時に返して初めて発動**し、
         そのターンの残り全部に効く。END_ACTION_PHASE は1ターンに複数回走り得る（ヴィラ/騎兵）ので、
         毎回 p.deluded / p.envious を見て返すが、**一度立った下の旗は同じターン中に下ろさない**。 */
      cantBuyActions: false, // 錯乱を返した＝このターンはアクションカードを購入できない
      enviousActive: false,  // 嫉妬を返した＝このターン、銀貨と金貨は $1 しか生まない
      currentHex: null,      // 配布中の呪詛id（リアクションを全部閉じてから1回だけ確定し、全員に同じ1枚を適用する）
      hexQueue: null,        // その呪詛をまだ受けていない被害者（手番順。reduce 末尾の再開網が1人ずつ消化する）
      nightPlayed: 0,        // このターンに使用した夜行カードの枚数（ログ/CPU用）

      gainedThisTurn: [], outpostUsed: false, isExtraTurn: !!isExtraTurn, startQueue: null,
      corsairTrashed: false, // 私掠船：このターンに最初の銀/金を廃棄済みか（被害者ごと）
      // 錬金術・支配：rotationSeat＝この手番が属する「通常の手番順の位置」（追加ターンでも回り順を崩さない）。
      // possessedBy＝この手番を操作している支配者の席（支配されていなければ null）。
      rotationSeat: extra.rotationSeat != null ? extra.rotationSeat : active,
      possessedBy: extra.possessedBy != null ? extra.possessedBy : null,
    };
  }

  /* ---------- 初期状態 ----------
     playerConfigs: 文字列(名前)または {name, isCpu, level} の配列（2〜4人）
     opts.startActive: 開始プレイヤー。整数(席番号) または 'random'。
       公式ルールは「ランダムに決める」。省略時は席0（既存テスト互換）。 */
  function createInitialState(playerConfigs, kingdom, opts) {
    kingdom = (kingdom || DOM.KINGDOM).slice(); // caller の配列を壊さない（Bane を push するため）
    opts = opts || {};
    const cfgs = (playerConfigs || []).map((x) =>
      typeof x === 'string'
        ? { name: x, isCpu: false, level: 'normal' }
        : { name: x.name, isCpu: !!x.isCpu, level: x.level || 'normal' }
    );
    // 暗黒時代：避難所(Shelters)使用時、開始デッキの屋敷3枚を 納屋/共同墓地/草茂る屋敷 に置換する。
    // 固定 darkages セット（＝王国が KINGDOM_DARKAGES と一致）のときのみ ON（決定事項）。opts.shelters でも上書き可。
    // 王国内容で判定するので local/再戦/オンラインの全経路で自動的に効く（opts の引き回し不要）。
    const isFixedDarkages = Array.isArray(DOM.KINGDOM_DARKAGES) && kingdom.length === DOM.KINGDOM_DARKAGES.length &&
      DOM.KINGDOM_DARKAGES.every((id) => kingdom.indexOf(id) >= 0);
    const useShelters = !!opts.shelters || isFixedDarkages;
    // 夜想曲：家宝（Heirloom）＝王国に対応するカードがあれば、開始デッキの**銅貨1枚**をその家宝に置き換える。
    //   複数該当すれば複数枚（例：愚者＋ピクシー＝銅貨5枚＋幸運のコイン＋ヤギ）。避難所（屋敷3枚の置換）と同時に成立する。
    //   家宝は山を持たない＝サプライには一切現れない（NON_SUPPLY で購入/汎用獲得/闇市場から除外済み）。
    const heirlooms = Object.keys(DOM.HEIRLOOM_OF || {})
      .filter((k) => kingdom.indexOf(k) >= 0).map((k) => DOM.HEIRLOOM_OF[k]).sort();
    const players = cfgs.map((cfg, i) => {
      const start = [];
      for (let n = 0; n < 7 - heirlooms.length; n++) start.push('copper');
      heirlooms.forEach((id) => start.push(id));
      if (useShelters) start.push('hovel', 'necropolis', 'overgrown_estate');
      else for (let n = 0; n < 3; n++) start.push('estate');
      const deck = shuffle(start);
      const hand = deck.splice(0, 5);
      return {
        id: i,
        name: cfg.name || `プレイヤー${i + 1}`,
        isCpu: cfg.isCpu,
        cpuLevel: cfg.level,
        deck,
        hand,
        discard: [],
        inPlay: [],
        turns: 0,
        // 海辺（持続/マット）用の状態。すべてJSONセーフ＝スナップショット/再接続でそのまま保存復元される。
        durationCards: [], // 場に残る持続カード（クリーンアップで捨てずに持ち越す。inPlay と同じく公開情報）
        delayedEffects: [], // 次の自分の手番開始時に解決する予約効果 {card, type, ...data}
        setAside: [],      // 伏せて脇に置く私的カード（停泊所/封鎖の獲得物など。相手には伏せる）
        archives: [],      // 帝国：資料庫の脇置き（各要素 {id, cards:[...]}＝1つの資料庫の脇3枚。所有者のみ中身を見られる＝maskで伏せる。allCardsに数える）
        islandMat: [],     // 島マット（ゲームから外れるが所有者のVPに数える。公開）
        nativeVillageMat: [], // 原住民の村マット（手札に回収できる。秘密）
        lastTurnGains: [], // 直前の自分の手番に獲得したカードid（密輸人が右隣のこれを参照）
        vpTokens: 0,       // 繁栄：勝利点トークンの累計（司教・記念碑・収集・投資。公開・終了時に加算）
        coffers: 0,        // ギルド：財源（Coffers）トークン。購入フェイズに1枚=+1コインで使える。公開・VPには数えない。
        villagers: 0,      // ルネサンス：村人（Villagers）トークン。アクションフェイズに1個=+1アクションで使える。公開・VPには数えない（財源と同型・別枠）。
        favors: 0,         // 同盟：好意（Favor）トークン。**財源/村人とは完全に別枠**。公開・VPには数えない・上限なし。
                           //   与えるのは連携(Liaison)カードだけ＋開始時1個（輸入者があるゲームは5個）。
                           //   使い道は「そのゲームの同盟(Ally)カードが定める1通りだけ」＝state.ally を見る。
        favorShuffle: 0,   // 同盟：占星術師団/メイソン団の常設方針＝「1回のシャッフルに使う好意の上限」（0=使わない）。
                           //   シャッフルは効果解決の途中で同期的に起きて対話を挟めない（星図/へそくりと同じ難所）ので、
                           //   **何個使うかだけ本人が決め、どの札を選ぶかはエンジンが最善を自動選択する**（§0-29 の許容簡略化）。
        projects: [],      // ルネサンス：このプレイヤーが買ったプロジェクトid列（キューブ＝各自2個まで＝最大2つ・同じものは1回だけ）。公開。
        cargo: [],         // ルネサンス：貨物船の脇置き（**表向き＝公開**。次の手番開始時に手札へ。allCards/保存則tally に数える）。
        sinisterPlot: 0,   // ルネサンス：悪巧み（プロジェクト）に置いた自分のトークン数（非カード・公開・VP無関係）。
        debt: 0,           // 帝国：負債（Debt）トークン。負債があるとカードを購入できない。購入フェイズに$1=1個返済。公開・VPには数えない（ターンを跨いで残る＝freshTurn非対象）。
        princes: [],       // プロモ：王子の脇に置いたカードid列（公開）。毎ターン開始時に脇のままプレイ。1要素=王子1枚が稼働中。
        tavern: [],        // 冒険：酒場マット（Reserve カードと守銭奴の銅貨。公開＝islandMat型。呼び出しで場へ戻す）。
        pileTokens: {},    // 冒険：山トークン（{card|action|buy|coin|cost|trash: 山id}・公開。各種別1個ずつ・置き直し可）。
                           //   +1系4種（教師／失われた技術・鍛錬・誘導・海路）＝その山のカードをプレイ時にボーナス（applyPileTokens）。
                           //   cost＝渡し船の-$2コストトークン（自分のターン中その山が$2安い＝cardCost）。trash＝立案の廃棄トークン。
        exile: [],         // 移動動物園：追放（Exile）マット。**公開**・所有者のカード（得点に数える＝allCards に入る）。
                           //   サプライから追放しても「獲得」ではない（獲得時能力は誘発しない）。同名のカードを獲得したとき、
                           //   ここから好きな枚数を捨て札にしてよい（一般ルール＝exile_discard の窓）。
        exileInvested: {}, // 移動動物園：投資（Invest）で追放したコピーの枚数（id→枚数）。**非カード**（保存則に数えない）。
                           //   公式は「投資したコピーはマットの下半分に差して区別せよ」＝他手段で追放した同名とは別管理。
                           //   投資したコピーが追放されている間だけ「他プレイヤーの獲得/投資」で +2カード。
        eventSetAside: [], // 移動動物園：遅延/刈り入れで脇に置いたカード（**公開**・物理カード＝allCards と保存則に数える）。
                           //   次の自分のターン開始時に「使用する」（強制）。
        inherited: [],     // 冒険：相続（Inheritance）で脇に置いたカード（＝屋敷トークンを載せたカード。公開・1枚だけ）。
                           //   「獲得」ではないが、得点計算では自分のデッキに数える（公式）＝allCards に入れる。
        stashPlacement: 'top', // プロモ：へそくり(Stash)のシャッフル時配置方針 'top'|'mix'|'bottom'（本人がいつでも変更可）。
        // 冒険：トークン（すべて公開情報・スカラー＝maskStateFor でそのまま残る・JSONセーフ）。
        journeyDown: false, // 旅トークンの向き（false=表向き／true=裏向き。山守/巨人が共有＝プレイのたびに裏返す）。
        minusCard: false,   // -1カードトークン（遺物）：次に1枚以上引くドローで1枚少なく引く（draw() 冒頭で消化）。
        minusCoin: false,   // -$1トークン（橋の下のトロル）：次の購入フェイズで最初の$1に食い込む（coinPenalty へ変換して消化）。
        /* 夜想曲。**祝福・呪詛・状態は「カード」ではない**＝allCards にも保存則 tally にも入れない
           （所有カードに数えないので庭園/品評会/絹の道/壁/博物館にも影響しない）。
           脇札2種（幽霊/納骨堂）だけは物理カード＝allCards と保存則に数える。 */
        boonsInFront: [],  // 田畑/森/川の恵み＝解決後もそのターンの片付けまで自分の前に置く祝福id（公開・非カード）
        boonsHeld: [],     // 恵みの村で保留した祝福id（次の自分のターン開始時に受ける。公開・非カード・複数可）
        riverDraws: 0,     // 川の恵みを受けた回数（このターンの終了時に引く枚数。非カード）
        houndsAside: 0,    // 夜想曲：脇に置いた忠犬の枚数（カード自体は p.setAside＝物理カード。ターン終了時に手札へ戻す）
        deluded: false,    // 状態：錯乱（**持っているだけでは効かない**＝購入フェイズ開始時に返して初めて発動）
        envious: false,    // 状態：嫉妬（同上。錯乱とは排他＝両面カード1枚）
        misery: 0,         // 状態：0=なし / 1=生活苦(-2VP) / 2=二重苦(-4VP)
        guardianActive: false, // 守護者：次の自分のターン開始時までアタックの影響を受けない（灯台とは窓が違う）
        ghostSetAside: [], // 幽霊の脇札（**公開**＝公開しながら掘るので全員が見ている。物理カード）
        cryptSetAside: [], // 納骨堂の脇札（**所有者のみ可視**＝裏向き。物理カード。納骨堂1枚につき1束だが枚数だけで足りる）
      };
    });
    // ギルド：パン屋（Baker）のセットアップ＝ゲーム開始時、各プレイヤーは財源1枚を得る。
    if (kingdom.includes('baker')) players.forEach((pl) => { pl.coffers = (pl.coffers || 0) + 1; });

    // 開始プレイヤー（公式: ランダム）。範囲外は席0に丸める。
    let startActive = 0;
    if (opts.startActive === 'random') startActive = Math.floor(Math.random() * players.length);
    else if (Number.isInteger(opts.startActive) && opts.startActive >= 0 && opts.startActive < players.length)
      startActive = opts.startActive;

    // 収穫祭：若き魔女が場にあれば、$2-3 の王国カードを1つ選んで11山目（災いカード＝Bane）を足す。
    //   Bane は購入可能な通常のサプライ山（3山終了にも数える）。攻撃を受けた相手は手札から公開して影響を免れる。
    let baneCard = null;
    if (kingdom.includes('young_witch')) {
      baneCard = pickBane(kingdom);
      if (baneCard) kingdom.push(baneCard);
    }
    /* 同盟：王国に連携(Liaison)カードが1枚でもあれば、同盟(Ally)カード23枚から**1枚だけ**無作為に決め、
       全員に好意マット（＝p.favors）を配る。開始時の好意は1個、**輸入者があるゲームは5個**
       （輸入者の `準備：各プレイヤーは +4 好意 を得る。`）。連携が1枚も無ければ Ally も好意も一切登場しない。
       ⚠ 連携は**分割山の中にも居る**（生徒＝魔法使いの山）。kingdom は山ID（'wizards'）を持つので、
         山IDだけを見る判定では取りこぼして「Ally が出ないゲーム」になる＝中身4種まで走査すること。
       ※Ally は横型の合計2枚制限（イベント/ランドマーク/プロジェクト/習性）には数えない＝別デッキ。
       ※若き魔女の災いカード(Bane)と同じく createInitialState で1回だけ決める＝サーバ権威・再戦も自動で安全。 */
    let ally = null;
    if (alliesHasLiaison(kingdom)) {
      const pool = DOM.ALLIES_ALLY || [];
      ally = (opts.ally && DOM.LANDSCAPES[opts.ally] && DOM.LANDSCAPES[opts.ally].kind === 'ally')
        ? opts.ally
        : (pool.length ? pool[Math.floor(Math.random() * pool.length)] : null);
      if (ally) {
        const start = kingdom.includes('importer') ? 5 : 1;
        players.forEach((pl) => { pl.favors = start; });
        /* 占星術師団／メイソン団＝シャッフルのたびに働く Ally。`reshuffleDeck` は非対話なので
           「1回のシャッフルに何個まで使うか」の常設方針（p.favorShuffle）＋自動選択で表現する（§0-29）。
           人間は既定 0（＝使わない。本人がいつでも FAVOR_SHUFFLE_SETTING で変更できる）／
           CPU は既定 1（対話できないので既定値がそのまま方針になる。1個ぶんは常に得なので）。 */
        if (ally === 'order_of_astrologers' || ally === 'order_of_masons') {
          players.forEach((pl) => { pl.shuffleAlly = ally; pl.favorShuffle = pl.isCpu ? 1 : 0; });
        }
      }
    }
    // プロモ/帝国：分割山＝1つの山枠（上段5＋下段5）。上段/下段どちらかが王国にあれば両方をサプライに
    // 置く（emptyPileCount では1山として数える）。抽選は上段に正規化済み（DOM.randomKingdom）だが、
    // 固定セットや外部指定に下段単独が来ても補正する。
    Object.keys(SPLIT_TOP).forEach((bottom) => {
      const top = SPLIT_TOP[bottom];
      if (kingdom.includes(bottom) && !kingdom.includes(top)) kingdom.push(top);
      if (kingdom.includes(top) && !kingdom.includes(bottom)) kingdom.push(bottom);
    });
    const supply = initSupply(players.length, kingdom);
    // 暗黒時代：混合山の中身（実カードid配列）。supply.ruins/knights（残枚数）と長さを同期させる。
    //   廃墟＝looterがあれば全50枚(5種×10)をシャッフルして (人数-1)×10 枚。騎士＝10種をシャッフルして1山。
    let ruins = null, knights = null;
    if (kingdom.some((k) => DOM.isType(k, 'looter'))) {
      const pool = [];
      (DOM.POOLS.ruins || []).forEach((id) => { for (let n = 0; n < 10; n++) pool.push(id); });
      ruins = shuffle(pool).slice(0, 10 * (players.length - 1));
    }
    if (kingdom.includes('knights')) knights = shuffle((DOM.POOLS.knights || []).slice());
    // 帝国：城の混合山＝8種を昇順（安い順）に積む。2人＝各1（8枚）／3-4人＝Humble/Small/Opulent/Kings を各2（計12枚）。
    //   一番上（最も安い城）だけ購入/獲得できる。state.castles = 実カードid配列、supply.castles = 残数（同期）。
    let castles = null;
    if (kingdom.includes('castles')) {
      castles = [];
      const dbl = players.length >= 3;
      const DBL = new Set(['humble_castle', 'small_castle', 'opulent_castle', 'kings_castle']);
      (DOM.POOLS.castles || []).forEach((id) => { castles.push(id); if (dbl && DBL.has(id)) castles.push(id); }); // 昇順維持・重複は隣接
      supply.castles = castles.length; // 山キーの残数を実配列に同期（8 or 12）
    }
    /* 同盟：分割山6組＝4種×4枚＝16枚を**コストの安い順**（最安が一番上）に積む。人数によらず常に16枚。
       公式逐語＝`The cards start the game in order by cost.`（卜占官＝薬草集め4枚 → 侍祭4枚 → 女魔導士4枚 → 巫女4枚）。
       循環(Rotate)・交換(Swap)・大使で順序が乱れることが公式に想定されている（`that's fine.`）。
       state[山キー] は**全公開**（`You can look through the cards in a split pile at any time`）＝maskStateFor で伏せない。 */
    const alliesPiles = {};
    ALLIES_PILE_IDS.forEach((pileId) => {
      if (!kingdom.includes(pileId)) return;
      const arr = [];
      (ALLIES_SPLIT[pileId] || []).forEach((cid) => { for (let n = 0; n < 4; n += 1) arr.push(cid); });
      alliesPiles[pileId] = arr;
      supply[pileId] = arr.length;
    });

    // 闇市場(Black Market)デッキ：使用中のサプライに無い王国カードを1枚ずつ集めてシャッフル。
    // 闇市場が王国に含まれるときだけ用意する。
    let blackMarket = null;
    if (kingdom.indexOf('black_market') >= 0) {
      const universe = Array.from(new Set([].concat.apply([], Object.values(DOM.POOLS || {}))));
      const inSupply = (id) => Object.prototype.hasOwnProperty.call(supply, id);
      // 混合山の「中身」（騎士/廃墟/城の実カード）は単体の王国カードではない＝闇市場デッキに入れない（山の一番上でのみ得る）。
      //   同盟の分割山6組の中身24種も同じ（4種×4枚の山の一番上でのみ購入/獲得できる）。
      const mixedContents = MIXED_PILE_CONTENTS;
      // 段階1（カタログと画像だけで効果が未実装）のプールは闇市場デッキに入れない
      //   ＝買っても何も起きない死に札になるため。実プレイ化（段階2）のときに DOM.STAGE1_POOLS から外す。
      const stage1 = new Set([].concat.apply([], (DOM.STAGE1_POOLS || []).map((k) => DOM.POOLS[k] || [])));
      // 収穫祭：賞品(NON_SUPPLY)は王国カードではない＝闇市場デッキに絶対に入れない（$0で買える不正防止）。
      /* 【実バグ修正】混合山の**山キー**（'knights'/'castles' と同盟の6山）は「実在する1枚のカード」ではなく
         山を表すプレースホルダ＝闇市場デッキに入れてはいけない（買うと存在しないカードが捨て札に湧き、
         終局後の deckCards にも出る）。中身(mixedContents)だけ塞いでいたので山キーが漏れていた。
         MIXED_PILE_KEYS が正本なので、新しい混合山を足しても自動で塞がる。 */
      blackMarket = shuffle(universe.filter((id) => DOM.CARDS[id] && id !== 'black_market' && !NON_SUPPLY.has(id) &&
        !inSupply(id) && !mixedContents.has(id) && !isMixedPileKey(id) && !stage1.has(id)));
    }

    // 帝国：横型ランドスケープ（ランドマーク）の準備。opts.landmarks で受け取る（DOM.LANDSCAPES にある id のみ）。
    const landmarks = (opts.landmarks || []).filter((id) => DOM.LANDSCAPES && DOM.LANDSCAPES[id] && DOM.LANDSCAPES[id].kind === 'landmark');
    // 帝国：横型イベント（買う横型）。opts.events で受け取る（DOM.LANDSCAPES の kind==='event' のみ）。対局中不変・公開。
    const events = (opts.events || []).filter((id) => DOM.LANDSCAPES && DOM.LANDSCAPES[id] && DOM.LANDSCAPES[id].kind === 'event');
    // 移動動物園：習性（Way）＝買わない横型。アクションを使うとき、その記載効果の代わりに使える（対局中不変・公開）。
    const ways = (opts.ways || []).filter((id) => DOM.LANDSCAPES && DOM.LANDSCAPES[id] && DOM.LANDSCAPES[id].kind === 'way');
    // 移動動物園：ハツカネズミの習性＝準備で「使わない $2/$3 の持続でないアクション」1枚を脇に置く（山ではない）。
    const mouseCard = ways.indexOf('way_of_the_mouse') >= 0 ? pickMouseCard(kingdom) : null;
    // 移動動物園：馬（Horse）＝非サプライ30枚。「馬を獲得する」カード／イベント（＋ハツカネズミの脇札）が
    //   あるときだけ用意する（公式）。
    if ((DOM.HORSE_GIVERS || []).some((id) => kingdom.includes(id) || events.includes(id) || id === mouseCard)) supply.horse = 30;
    const landmarkVP = {};    // ランドマーク上の有限リザーブ（6×人数 等）
    const landmarkStash = {}; // 水道橋/汚された神殿が山→ランドマークへ移した一時VP
    const pileVP = {};        // 集合＋水道橋(銀貨/金貨の山)/汚された神殿(各アクション山)の「山上VP」
    let obeliskPile = null;
    if (landmarks.length) {
      const np = players.length;
      const SIX = ['arena', 'basilica', 'baths', 'battlefield', 'colonnade', 'labyrinth']; // 各6×人数
      const gathering = new Set(DOM.GATHERING_CARDS || []);
      // 「集合を持たない、混合でない、素のアクションのサプライ山」か（汚された神殿/オベリスクの対象）。
      const plainActionPile = (id) => DOM.isType(id, 'action') && !gathering.has(id) && !NON_SUPPLY.has(id) &&
        !SPLIT_TOP[id] && id !== 'castles' && id !== 'knights' && id !== 'ruins';
      landmarks.forEach((lm) => {
        if (SIX.indexOf(lm) >= 0) landmarkVP[lm] = 6 * np;
        else if (lm === 'aqueduct') { pileVP.silver = 8; pileVP.gold = 8; }
        else if (lm === 'defiled_shrine') {
          Object.keys(supply).forEach((id) => { if (plainActionPile(id)) pileVP[id] = (pileVP[id] || 0) + 2; });
        } else if (lm === 'obelisk') {
          const cand = kingdom.filter(plainActionPile);
          if (cand.length) obeliskPile = cand[Math.floor(Math.random() * cand.length)];
        }
      });
    }

    // 帝国：徴税（Tax）＝新 state.pileDebt（サプライ山の上に置かれた負債トークン {[pileId]:個数}・公開・非カード＝保存則対象外）。
    //   採用時は準備で各サプライ山（非サプライ札は除く。混合山は castles/knights の numeric キーに置く）に負債1を置く。
    //   購入フェイズの獲得でその山の負債を全部その獲得者が受け取る（triggerOnGain）。Tax購入で山1つに+2（tax_pile pending）。
    const pileDebt = {};
    if (events.indexOf('tax') >= 0) {
      // 分割山は1山＝上段キーにだけ負債1（下段は SPLIT_TOP[id] を持つ＝スキップ）。混合山 castles/knights は各1山＝numericキーに1。
      Object.keys(supply).forEach((id) => { if (!NON_SUPPLY.has(id) && !SPLIT_TOP[id]) pileDebt[id] = 1; });
    }

    // ルネサンス：プロジェクト（買う横型）。opts.projects で受け取る（DOM.LANDSCAPES の kind==='project' のみ）。対局中不変・公開。
    //   各プレイヤーはキューブ2個＝最大2つまで買える（p.projects）。同じプロジェクトを2回は買えない。複数人が同じものを買える。
    const projects = (opts.projects || []).filter((id) => DOM.LANDSCAPES && DOM.LANDSCAPES[id] && DOM.LANDSCAPES[id].kind === 'project');
    // ルネサンス：アーティファクト（非カード・1人しか持てない・奪い合う）。付与カード（旗手/国境警備隊/剣客/出納官）が
    //   王国にあるときだけ盤面に出す。{[id]: 席番号|null}＝トップレベルの公開スカラーマップ（state.pileVP と同型＝保存則tally対象外）。
    const artifacts = {};
    (DOM.artifactsForKingdom ? DOM.artifactsForKingdom(kingdom) : []).forEach((id) => { artifacts[id] = null; });

    /* 夜想曲：祝福(Boon)／呪詛(Hex) のデッキ。**カードではない**（保存則 tally に数えない）。
       - 祝福＝王国に幸運(Fate)が1枚でもあれば12枚をシャッフル。ドルイドがあれば上から3枚を表向きで脇に置く（山は9枚）。
       - 呪詛＝王国に不運(Doom)が1枚でもあれば12枚をシャッフル。
       - 山の中身は**全員に対して完全に秘密**、捨て札は**一番上の1枚だけ**が公開情報（maskStateFor が担保）。 */
    let boons = null, hexes = null;
    if (kingdom.some((k) => DOM.isType(k, 'fate'))) {
      const deck = shuffle((DOM.BOONS_NOCTURNE || []).slice());
      // ドルイド＝準備で祝福3枚を表向きに脇へ（そのゲーム中ずっと使う3つ。山には戻らない）。
      const druid = kingdom.includes('druid') ? deck.splice(0, 3) : [];
      boons = { deck, discard: [], druid };
    }
    if (kingdom.some((k) => DOM.isType(k, 'doom'))) hexes = { deck: shuffle((DOM.HEXES_NOCTURNE || []).slice()), discard: [] };
    // 夜想曲：森の迷子（Lost in the Woods）＝ゲーム中1枚だけの状態。持ち主の席番号（誰も持っていなければ null）。
    // 夜想曲：ネクロマンサー＝準備でゾンビ3枚を**廃棄置き場に置く**（「廃棄」ではない＝墓所/下水道/青空市場は誘発しない）。
    //   廃棄置き場は既に保存則 tally の対象なので、総カード枚数が3枚増える。
    const trash = kingdom.includes('necromancer') ? ZOMBIES.slice() : [];

    return Object.assign({
      version: 0,
      kingdom,
      players,
      supply,
      splitRotated: {}, // 同盟：循環(Rotate)で上下が入れ替わった2段分割山 {上段id:true}（非カード・公開）。混合山は配列そのものが回る。
      ruins,    // 暗黒時代：廃墟の混合山（実カードid配列。無ければ null）。supply.ruins と長さ同期。
      knights,  // 暗黒時代：騎士の混合山（実カードid配列。無ければ null）。supply.knights と長さ同期。
      castles,  // 帝国：城の混合山（実カードid配列・昇順。無ければ null）。supply.castles と長さ同期。
      baneCard, // 収穫祭：若き魔女の災いカード（無ければ null）
      ally,     // 同盟：このゲームの同盟(Ally)カードid（王国に連携が無ければ null）。**公開・対局中不変**。
                //   好意(p.favors)の使い道はこの1枚が定める＝Ally が null なら好意は登場しない。
      // 同盟：発明家の家族＝サプライ山の上に置かれた好意トークン数 {[山キー]:個数}（**非カード**・公開＝
      //   state.pileVP / state.pileDebt と同型で保存則 tally に混ぜない）。その Ally のときだけ作る。
      pileFavor: ally === 'family_of_inventors' ? {} : null,
      trash,    // 廃棄置き場（夜想曲：ネクロマンサーがあればゾンビ3枚が最初から入っている）
      trashFaceDown: {}, // 夜想曲：ネクロマンサーで裏返した廃棄置き場のカード（id→枚数。ターン終了で全解除）
      blackMarket, // 闇市場デッキ（無ければ null）
      boons,          // 夜想曲：祝福デッキ {deck, discard, druid}（非カード。幸運が無ければ null）
      hexes,          // 夜想曲：呪詛デッキ {deck, discard}（非カード。不運が無ければ null）
      lostInTheWoods: null, // 夜想曲：森の迷子（状態）の持ち主の席番号（誰も持っていなければ null・非カード）
      pileVP, // 帝国：集合（Gathering）＝サプライ山の上に置かれた勝利点トークン数 {[pileId]:個数}（公開・非カード＝保存則に無関係）。水道橋/汚された神殿の準備分もここ。
      pileDebt, // 帝国：徴税（Tax）＝サプライ山の上に置かれた負債トークン数 {[pileId]:個数}（公開・非カード＝保存則に無関係）。
      landmarks,      // 帝国：使用中のランドマークid列（横型・公開・対局中不変）
      events,         // 帝国：使用中のイベントid列（横型・買う・公開・対局中不変）
      ways,           // 移動動物園：使用中の習性id列（横型・買わない・公開・対局中不変）
      mouseCard,      // 移動動物園：ハツカネズミの習性で脇に置いた1枚（サプライではない・公開・対局中不変）
      projects,       // ルネサンス：使用中のプロジェクトid列（横型・買う・公開・対局中不変）
      artifacts,      // ルネサンス：アーティファクトの現所有者 {[id]: 席番号|null}（非カード・公開。付与カードが王国に無ければ空）

      landmarkVP,     // 帝国：ランドマーク上の有限リザーブ {id:個数}（非カード＝保存則に無関係）
      landmarkStash,  // 帝国：水道橋/汚された神殿がランドマークへ移した一時VP {id:個数}（非カード）
      obeliskPile,    // 帝国：オベリスクで選ばれたアクション山id（無ければ null）
      turn: freshTurn(startActive),
      pending: null, // 選択待ち {type, player, ...}
      logSeq: 1, // ログの通し番号（効果音などが「新しい行」を確実に検知するため）
      log: [`ゲーム開始。${players[startActive].name} の番です。`],
      gameOver: false,
      result: null,
    }, alliesPiles); // 同盟：state.augurs / state.wizards … （混合山と同型のトップレベル配列）
  }

  /* ---------- ログ ---------- */
  function log(state, msg) {
    state.log.push(msg);
    state.logSeq = (state.logSeq || 0) + 1;
    if (state.log.length > 200) state.log = state.log.slice(-200);
  }

  /* ---------- 公開（reveal）チャネル ----------
     「カードを表向きにした」出来事を全員に見せるための公開情報。役人などは自分の盤面に
     見える変化が無いため、これが無いと「何も起きていない」ように見える。
     席ごと（state.reveals[席]）に保持するので、複数の相手が公開しても全員ぶんが残り、
     UI で各プレイヤーの表示をタップすればその人の公開カードを確認できる。
     seat=公開した席 / cards=公開カードid配列 / note=どの効果による公開か。
     revealLatest=直近に公開した席（点滅・通知用）。公開は公式どおり全員に見える情報なので
     maskStateFor でも伏せない（clone がそのまま運ぶ）。*/
  /* カードを「公開する」。表示（state.reveals）と、公開に反応するカードのフックを一箇所に集約する。
     ルネサンス：**パトロン（Patron）＝アクションフェイズ中に「公開する」の語であなたが公開したとき +1財源**（枚数ぶん・強制）。
       - 公開元はどこでもよい（手札／山札／捨て札）。相手のアタックで公開させられても、そのアタックが
         相手のアクションフェイズ中なら +1財源（「アクションフェイズ中」は“あなたの”とは限らない＝公式）。
       - 2022エラッタでフェイズ不問→アクションフェイズ限定に変更（購入フェイズの公開では得られない）。
     opts.notReveal=true ＝「公開」ではない表示（家臣の捨て札／闇市場デッキ／廃棄置き場からの獲得）＝パトロンは誘発しない。 */
  function reveal(state, seat, cards, note, opts) {
    const all = (cards || []).filter(Boolean);
    const list = all.slice(0, 8);
    if (!list.length) return;
    state.revealSeq = (state.revealSeq || 0) + 1;
    if (!state.reveals) state.reveals = {};
    state.reveals[seat] = { cards: list.slice(), note: note || '', seq: state.revealSeq };
    state.revealLatest = seat;
    if (opts && opts.notReveal) return;
    if (state.turn && state.turn.phase === 'action' && state.players[seat]) {
      const n = all.filter((c) => c === 'patron').length;
      if (n > 0) {
        const rp = state.players[seat];
        rp.coffers = (rp.coffers || 0) + n;
        log(state, `${rp.name} はパトロンを公開して +${n}財源。`);
      }
    }
  }

  /* ---------- カード操作 ---------- */
  function removeOne(arr, cardId) {
    const i = arr.indexOf(cardId);
    if (i >= 0) arr.splice(i, 1);
    return i >= 0;
  }

  /* 「+アクション」を与える唯一の入口（引数は turn オブジェクト）。
     移動動物園：**雪深い村（snowy_village）＝このターン、これ以降に得る +アクション をすべて無視する**。
     公式は「村人(Villagers)の使用・チャンピオン・山トークン由来のものも含めて全部無視」なので、
     engine 内で `t.actions += n` と直接書かず、必ずこの関数を通すこと（140箇所を一括置換済み）。
     ※アクション権の**消費**（`t.actions -= 1`）と freshTurn の初期値はボーナスではない＝対象外。 */
  function addActions(t, n) {
    if (!t) return;
    if (t.ignoreActionBonus) return;
    t.actions += n;
  }
  /* 「+コイン」を与える唯一の入口（引数は state）。
     移動動物園：**カメレオンの習性＝そのカードの「+カード」と「+コイン」を入れ替える**。
     engine 内で `t.coins += n` と直接書かず、必ずこの関数を通すこと（133箇所を一括置換済み）。
     ※コインの**消費**（購入・返済で `t.coins -= x`）はボーナスではない＝対象外。 */
  function addCoins(state, n) {
    const t = state && state.turn;
    if (!t) return;
    if (t.chameleon && !t._chamSwap) {   // +コイン → 同じ数の +カード
      t._chamSwap = true;
      draw(state, t.active, n);
      t._chamSwap = false;
      return;
    }
    t.coins += n;
  }
  // pIndex のプレイヤーが n 枚引く（山切れで捨て札をシャッフル）
  function draw(state, pIndex, n) {
    const p = state.players[pIndex];
    // 移動動物園：カメレオンの習性＝そのカードの「+カード」は代わりに「+コイン」になる（引かない）。
    //   ※クリンナップの先引きや「山札の上から見る」系は draw ではない/フラグが立っていないので影響しない。
    {
      const tt = state.turn;
      if (tt && tt.chameleon && !tt._chamSwap && n > 0 && pIndex === tt.active) {
        tt._chamSwap = true; tt.coins += n; tt._chamSwap = false;
        log(state, `${p.name} はカメレオンの習性で +${n}カード の代わりに +$${n}。`);
        return [];
      }
    }
    // 冒険：-1カードトークン（遺物）＝次にカードを1枚以上引くとき、1枚少なく引いてトークンを返す
    //   （cleanup先引きに限らず、手番開始の持続ドロー/ドローアクション等どの引きでも「次の1回」に効く）。
    if (p.minusCard && n > 0) { n -= 1; p.minusCard = false; log(state, `${p.name} は -1カードトークンで1枚少なく引く。`); }
    const drawn = [];
    for (let i = 0; i < n; i++) {
      if (p.deck.length === 0) {
        if (p.discard.length === 0) break;
        reshuffleDeck(p, state); // state はログ用（同盟：占星術師団/メイソン団）
      }
      if (p.deck.length === 0) break; // メイソン団が全部を捨て札に残した等（理論上は起きないが安全網）
      drawn.push(p.deck.shift());
    }
    p.hand.push(...drawn);
    return drawn;
  }

  /* ---------- 獲得の共通部品（支配 Possession の振り分けを1か所に集約）----------
     帝国：負債コスト（debt）は購入でも効果での獲得でも負う。
     **支配中は「獲得するのは支配者」＝負債も支配者が負う**（被支配者に負債を押し付けられない）。 */
  function takeDebt(state, pIndex, cardId) {
    const dbt = (C()[cardId] && C()[cardId].debt) || 0;
    if (dbt <= 0) return;
    const t = state.turn;
    const who = (t && t.possessedBy != null && pIndex === t.active) ? t.possessedBy : pIndex;
    const gp = state.players[who];
    gp.debt = (gp.debt || 0) + dbt;
    log(state, `${gp.name} は「${C()[cardId].name}」で 負債${dbt} を負った。`);
  }
  /* サプライ**以外**（廃棄置き場／闇市場デッキ）からの獲得。供給の減算が無いだけで「獲得」なので、
     **支配の振り分け**と**獲得トリガー**は gain() と同じに揃える（片方だけ素通りさせない）。
     呼び出し側は事前に元の場所（trash / 闇市場デッキ）から取り除き、**state.pending を閉じてから**呼ぶこと
     （物見やぐら/交易商人 等の獲得時対話が立てられるように）。 */
  function gainFromOutside(state, pIndex, cardId, dest) {
    const t = state.turn;
    takeDebt(state, pIndex, cardId);
    // 「サプライ由来でない獲得」を獲得トリガーに伝える＝交易商人（獲得を銀貨に置換して**山へ戻す**）の窓を開かない。
    //   開くと廃棄置き場/闇市場から得た札がサプライの山に生えて、空の山が復活する（3山終了が巻き戻る）。
    state._gainOutside = true;
    try {
      if (t && t.possessedBy != null && pIndex === t.active) {
        (t.possessionGains = t.possessionGains || []).push(cardId);
        log(state, `${state.players[pIndex].name} が獲得した「${C()[cardId].name}」は脇に置かれた（支配：${state.players[t.possessedBy].name} が受け取る）。`);
        triggerOnGain(state, t.possessedBy, cardId, dest); // 獲得するのは支配者（公式）＝トリガーも支配者に効く
        return true;
      }
      const p = state.players[pIndex];
      if (dest === 'hand') p.hand.push(cardId);
      else if (dest === 'deck') p.deck.unshift(cardId);
      else if (dest === 'setAside') p.setAside.push(cardId);
      else p.discard.push(cardId);
      if (t && pIndex === t.active) {
        (t.gainedThisTurn || (t.gainedThisTurn = [])).push(cardId);
        if (t.phase === 'buy') { t.buyPhaseGained = true; t.bpGained = (t.bpGained || 0) + 1; }
      }
      triggerOnGain(state, pIndex, cardId, dest);
      return true;
    } finally { delete state._gainOutside; }
  }

  // 夜想曲：獲得したとき（捨て札に置く代わりに）手札に加えるカード。
  const GAIN_TO_HAND = new Set(['den_of_sin', 'ghost_town', 'guardian', 'night_watchman']);
  // サプライから pIndex が dest('discard'|'hand'|'deck'|'setAside') にカードを獲得
  function gain(state, pIndex, cardId, dest) {
    // 混合山（廃墟/騎士/城/同盟の分割山6組）は state[cardId]（実カード配列）の在庫で判定・供給する。
    //   山キーを先頭の実カードid（'survivors'/'sir_martin'/'herb_gatherer'等）へ解決して獲得する。
    //   supply[山キー]（数値・王国枠）も同期させる。廃墟だけは supply キーを持たない（state.ruins のみ）。
    const isMixed = isMixedPileKey(cardId);
    if (isMixed) {
      if (!Array.isArray(state[cardId]) || state[cardId].length === 0) return false;
    } else {
      if ((state.supply[cardId] || 0) <= 0) return false;
      // プロモ：サウナ/アヴァント分割山＝山の一番上のカードしか獲得できない（サウナが残る間アヴァントは不可）。
      if (splitLocked(state, cardId)) return false; // 分割山：下段は上段が尽きるまで獲得できない
    }
    const realId = isMixed ? state[cardId][0] : cardId;
    /* 夜想曲：**既定の獲得先が手札**のカード（悪人のアジト／ゴーストタウン／守護者／夜警）。
       「捨て札置き場に置く代わりに手札に加える」＝**捨て札に獲得する場合だけ**置き換える
       （武器庫などで山札の上に獲得したときはそのまま＝公式）。相手のターンの獲得でも自分の手札に入る。 */
    if (dest === 'discard' && GAIN_TO_HAND.has(realId)) dest = 'hand';
    const t = state.turn;
    // 帝国：負債コスト（debt）を持つカードは、購入でも効果での獲得でも、その数だけ負債トークンを負う。
    //   gain() は全ての獲得の一元入口なので、ここで付与すれば購入/工房/密輸人/命令 等どの経路でも効く。
    //   支配中は「獲得するのは支配者」＝負債も支配者が負う（takeDebt が振り分ける）。
    takeDebt(state, pIndex, realId);
    // 錬金術・支配：被支配者（手番のactive）が獲得するカードは脇に避け、ターン終了時に
    // 支配者の捨て札へ渡す（獲得先が手札/山札でも脇に置く＝公式のルーリング）。
    //   **獲得するのは支配者**（公式：Possession＝"any cards they would gain, you gain instead"）＝
    //   獲得トリガーも**支配者を獲得者として**発火させる。これにより
    //     - 「他の各プレイヤー」句（大使館/不正利得/失われし都市/道路網）は被支配者を含み支配者を含まない（公式どおり）
    //     - VP/財源/村人/アーティファクト（神殿/城/香辛料/追従者/旗手 等）は支配者に入る
    //     - 「自分の手番」条件（ヴィラ/公共広場/隠し財産/庭師/収集/大釜/物見やぐら/ティアラ/交易商人/貨物船/技術革新）は
    //       支配者が手番プレイヤーではないので発火しない＝**獲得札を動かす on-gain が被支配者の同名コピーを動かす事故が起きない**
    //   入れ子の獲得（キャッシュの銅貨/死の荷車の廃墟 等）は支配者の獲得＝そのまま支配者の捨て札へ入る。
    if (t && t.possessedBy != null && pIndex === t.active) {
      if (isMixed) { state[cardId].shift(); if (state.supply[cardId] != null) state.supply[cardId] -= 1; }
      else state.supply[cardId] -= 1;
      (t.possessionGains = t.possessionGains || []).push(realId);
      log(state, `${state.players[pIndex].name} が獲得した「${C()[realId].name}」は脇に置かれた（支配：${state.players[t.possessedBy].name} が受け取る）。`);
      triggerOnGain(state, t.possessedBy, realId, dest);
      return true;
    }
    if (isMixed) { state[cardId].shift(); if (state.supply[cardId] != null) state.supply[cardId] -= 1; }
    else state.supply[cardId] -= 1;
    const p = state.players[pIndex];
    if (dest === 'hand') p.hand.push(realId);
    else if (dest === 'deck') p.deck.unshift(realId);
    else if (dest === 'setAside') p.setAside.push(realId); // 海辺：封鎖＝獲得して脇に置く（捨て札ではない）
    // 移動動物園：刈り入れ＝金貨を「獲得と同時に」脇へ（2025エラッタで捨て札置き場を経由しなくなった）。
    else if (dest === 'eventSetAside') (p.eventSetAside = p.eventSetAside || []).push(realId);
    else p.discard.push(realId);
    // 移動動物園：行人（wayfarer）＝「このターンに獲得された直前の**他の**カード」と同じコストになる。
    //   誰の獲得でも記録する（相手のターン中に自分が獲得した場合も含む＝公式は "the last other card gained this turn"）。
    if (state.turn && realId !== 'wayfarer') state.turn.lastGainedAny = realId;
    // 海辺：手番プレイヤーの獲得を記録（密輸人・宝物庫の「このターン勝利点を獲得したか」用）
    if (state.turn && pIndex === state.turn.active) {
      (state.turn.gainedThisTurn || (state.turn.gainedThisTurn = [])).push(realId);
      // 暗黒時代：隠遁者＝「購入フェイズ中に1枚でも獲得したか」（獲得すれば狂人と交換しない。**ターン単位**）。
      // ルネサンス：探査＝「**その**購入フェイズにカードを獲得したか」（ヴィラで購入フェイズに入り直すとリセット）。
      if (state.turn.phase === 'buy') {
        state.turn.buyPhaseGained = true;
        state.turn.bpGained = (state.turn.bpGained || 0) + 1;
      }
    }
    triggerOnGain(state, pIndex, realId, dest); // サル/封鎖/船乗りの「獲得時」フック（§手6で実装）
    return true;
  }

  // カードを廃棄置き場へ送る統一入口 trashCard(state, owner, card)。呼び出し側は事前に card を
  // 元の場所（手札/場/デッキ/サプライ）から取り除いておく。誰の廃棄でも「持ち主 owner」に
  // on-trash を発動する（城塞=手札へ戻る／ネズミ=+1カード／封土=銀貨3 等）。
  // 戻り値 = そのカードが廃棄置き場に残ったか（城塞は false）。
  // 支配(Possession)中に被支配者(active)が自分のカードを廃棄したときは廃棄置き場でなく脇
  // （possessionTrash）へ退避し、ターン終了時に本人の捨て札へ戻す（相手の良カードを永久廃棄
  // できない＝公式）。この場合 on-trash は発動しない（trashに入らないため）。
  // ※アタックで「他人」のカードを廃棄する処理（詐欺師/破壊工作員/山賊等）も owner=被害者 で
  //   本関数を通す（城塞が持ち主の手札へ戻る等のため）。
  //   opts.fromSupply=true ＝ **サプライの山から直接**廃棄した（塩まき/待ち伏せ/剣闘士）。被支配者の持ち物ではない
  //   ので支配中でも退避しない（退避すると「サプライの属州が被支配者にタダで湧く」＝保存則は保つが不正）。
  function trashCard(state, ownerIdx, card, opts) {
    const t = state.turn;
    if (!(opts && opts.fromSupply) && t && t.possessedBy != null && ownerIdx === t.active) {
      (t.possessionTrash = t.possessionTrash || []).push(card);
      return true; // 支配中の退避＝trashに入らず on-trash も発動しないが処理は完了
    }
    state.trash.push(card);
    // 移動動物園：ヤギ飼い＝「右隣が自分の直前のターンに廃棄した枚数」を数える（手番中の廃棄だけを数える）。
    if (t && ownerIdx === t.active) {
      const op = state.players[ownerIdx];
      op.trashedThisTurn = (op.trashedThisTurn || 0) + 1;
    }
    // 帝国：墓標（Tomb）＝カードを廃棄するたび、廃棄した本人が +1勝利点（城塞が手札に戻る場合も廃棄自体は起きている＝発火）。
    if (hasLandmark(state, 'tomb')) {
      const oi = (ownerIdx != null && state.players[ownerIdx]) ? ownerIdx : (t ? t.active : 0);
      state.players[oi].vpTokens = (state.players[oi].vpTokens || 0) + 1;
      log(state, `${state.players[oi].name} は墓標で +1勝利点（廃棄）。`);
    }
    // ルネサンス：司祭＝このターンの残りの間、「あなたが」カードを廃棄するたび（1枚につき）+2コイン × 有効な司祭の数。
    //   アタック（詐欺師/騎士/盗賊/山賊/破壊工作員/私掠船）は**被害者が廃棄者**＝owner=被害者≠手番 なので乗らない（公式）。
    //   サプライからの廃棄（塩まき/剣闘士）は owner=手番プレイヤー＝乗る（公式）。
    if (t && (t.priestCount || 0) > 0 && ownerIdx === t.active) {
      addCoins(state, 2 * t.priestCount);
      log(state, `${state.players[ownerIdx].name} は司祭で +${2 * t.priestCount}コイン（廃棄）。`);
    }
    /* ルネサンス：下水道（Sewers・プロジェクト）＝「あなたが」この効果**以外で**カードを廃棄するたび、
       追加で手札1枚を廃棄してよい（任意）。廃棄経路は問わない（司祭・老魔女の呪い・劇団の自己廃棄・
       サプライからの廃棄でも誘発）。**下水道自身の追加廃棄では再誘発しない**（_sewersTrash ガード）。
       アタック（詐欺師/騎士）では owner=被害者＝**被害者側の下水道**が誘発する（攻撃側は誘発しない＝公式）。
       対話＝onTrashQueue（reduce 末尾で1件ずつ pending 化＝複数枚同時廃棄なら枚数ぶん誘発）。 */
    if (!state._sewersTrash && ownerIdx != null && state.players[ownerIdx] &&
        hasMyProject(state, ownerIdx, 'sewers') && state.players[ownerIdx].hand.length > 0) {
      (state.onTrashQueue = state.onTrashQueue || []).push({ type: 'sewers_trash', player: ownerIdx });
    }
    return triggerOnTrash(state, ownerIdx, card, opts); // 城塞は手札へ戻り false／nomads等の副次効果も発動
  }

  // サプライの山から1枚を廃棄置き場へ（塩まき／待ち伏せ／剣闘士）。混合山（騎士/城/廃墟）は**一番上の実カード**を
  //   廃棄し、supply の残数と実カード配列（state.knights など）を同期する（プレースホルダを trash に積まない＝保存則）。
  //   廃棄トリガー（墓標/司祭/下水道/城塞などの on-trash）は trashCard 経由で通常どおり発火するが、
  //   **支配中でも退避しない**（fromSupply）。戻り値＝実際に廃棄した実カードid（できなければ null）。
  function trashFromSupplyPile(state, pi, pileId) {
    const isMixed = isMixedPileKey(pileId);
    if (isMixed) {
      if (!Array.isArray(state[pileId]) || state[pileId].length === 0) return null;
      const real = state[pileId].shift();
      if (state.supply[pileId] != null) state.supply[pileId] = state[pileId].length;
      trashCard(state, pi, real, { fromSupply: true });
      return real;
    }
    if ((state.supply[pileId] || 0) <= 0) return null;
    state.supply[pileId] -= 1;
    trashCard(state, pi, pileId, { fromSupply: true });
    return pileId;
  }
  // 交易商人：獲得しかけたカードを山へ戻す（混合山は山キーを正規化して実カード配列の先頭へ戻す）。
  //   サプライに存在しない札（闇市場デッキ由来）は戻せない＝呼び出し側が窓を開かないこと（gate と同じ述語）。
  function returnToPile(state, cardId) {
    const pile = pileKeyOf(state, cardId);
    if (isMixedPileKey(pile)) {
      if (!Array.isArray(state[pile])) return false;
      state[pile].unshift(cardId);
      if (state.supply[pile] != null) state.supply[pile] = state[pile].length;
      return true;
    }
    if (!Object.prototype.hasOwnProperty.call(state.supply, cardId)) return false;
    state.supply[cardId] += 1;
    return true;
  }
  // そのカードを「元の山へ戻せる」か（returnToPile と同じ述語＝交易商人/取り替え子のゲートが使う）。
  //   混合山の中身は山キーが在ればよい（家宝/ゾンビ/闇市場デッキ由来の札は山が無いので戻せない）。
  function canReturnToPile(state, cardId) {
    const pile = pileKeyOf(state, cardId);
    if (isMixedPileKey(pile)) return Array.isArray(state[pile]);
    return Object.prototype.hasOwnProperty.call(state.supply, cardId);
  }
  /* ===== 移動動物園：追放（Exile）=====
     追放マット `p.exile` は**公開**・所有者のカード（allCards に入る＝庭園/得点に数える）。
     - **「サプライから追放する」は獲得ではない**＝獲得時能力（on-gain）は一切誘発しない。ただしサプライの山は減る
       （＝3山終了に影響する）。
     - 追放マットから捨て札に戻すのは本物の「捨てる」＝ on-discard（坑道/村有緑地）が誘発する。
     - 一般ルール：**あなたがカードを獲得したとき、追放マットにある同名のカードを好きな枚数だけ捨て札にしてよい**
       （`exile_discard` の窓。任意・枚数任意）。 */
  // その id が「今サプライから取れる（＝山の一番上にある）」か。追放とサプライ廃棄で使う。
  //   分割山の下段は上段が残る間は「サプライにない」／混合山（廃墟/騎士/城）は一番上の実カードだけ。
  function availableInSupply(state, id) {
    if ((state.supply[id] || 0) > 0) return !splitLocked(state, id);
    return !!mixedPileWithTop(state, id);
  }
  // サプライの山から1枚取って追放マットへ置く（獲得ではない）。置けたら true。
  function exileFromSupply(state, pi, cardId) {
    if (!availableInSupply(state, cardId)) return false;
    const mixKey = ((state.supply[cardId] || 0) > 0) ? null : mixedPileWithTop(state, cardId);
    if (mixKey) { state[mixKey].shift(); if (state.supply[mixKey] != null) state.supply[mixKey] = state[mixKey].length; }
    else state.supply[cardId] -= 1;
    const p = state.players[pi];
    (p.exile = p.exile || []).push(cardId);
    log(state, `${p.name} はサプライから「${C()[cardId].name}」を追放した。`);
    return true;
  }
  // 任意のゾーン（手札など）の1枚を追放マットへ移す。移せたら true。
  function exileFromZone(state, pi, cardId, zone) {
    if (!removeOne(zone, cardId)) return false;
    const p = state.players[pi];
    (p.exile = p.exile || []).push(cardId);
    log(state, `${p.name} は「${C()[cardId].name}」を追放した。`);
    return true;
  }
  // 追放マットから同名を n 枚 捨て札にする（「捨てる」＝ on-discard を通す）。実際に捨てた枚数を返す。
  //   投資（Invest）で追放したコピーも同名なら一緒に捨てる＝その枚数ぶん exileInvested を減らす
  //   （＝以後その名前では「他プレイヤーの獲得で +2カード」が起きなくなる）。**捨てるのは投資していないコピーが先**
  //   （公式は全部捨てる/1枚も捨てない の二択なので、部分的に捨てるのは輸送(Transport)だけ）。
  function discardFromExile(state, pi, cardId, n) {
    const p = state.players[pi];
    let cnt = 0;
    for (let i = 0; i < (n == null ? Infinity : n); i++) {
      if (!removeOne(p.exile || [], cardId)) break;
      p.discard.push(cardId); cnt++;
    }
    if (cnt > 0) {
      // 残った追放枚数より投資枚数が多くなったら、そのぶん投資も消える（投資したコピーを捨てた）。
      const left = exileCount(p, cardId);
      if (investCount(p, cardId) > left) setInvestCount(p, cardId, left);
      log(state, `${p.name} は追放マットの「${C()[cardId].name}」を${cnt}枚 捨て札にした。`);
      triggerOnDiscard(state, pi, new Array(cnt).fill(cardId));
    }
    return cnt;
  }
  function exileCount(p, cardId) { return (p.exile || []).filter((c) => c === cardId).length; }
  // 門番（Gatekeeper）＝獲得したカードをそのまま追放マットへ移す（獲得ではない）。
  //   **獲得後にカードが動いていたら失敗する**（公式の stop-moving ルール＝そりで手札に移されていた等）。
  //   removeOne が false を返す＝もうその場所に無い、で自然に不発になる。
  function applyGatekeeperExile(state, pi, cardId, dest) {
    const gp = state.players[pi];
    if (!removeOne(zoneOf(gp, dest), cardId)) return false;
    (gp.exile = gp.exile || []).push(cardId);
    log(state, `${gp.name} は門番により「${C()[cardId].name}」を追放した。`);
    return true;
  }
  /* 移動動物園：投資（Invest）＝「投資で追放したコピー」の枚数を名前ごとに持つ（非カードのスカラーマップ）。
     公式は「投資したコピーはマットの下半分に差して区別する」＝他手段で追放した同名コピーは +2カード を生まない。 */
  function investCount(p, cardId) { return ((p.exileInvested || {})[cardId] || 0); }
  function setInvestCount(p, cardId, n) {
    p.exileInvested = p.exileInvested || {};
    if (n > 0) p.exileInvested[cardId] = n; else delete p.exileInvested[cardId];
  }
  // 「他のプレイヤーがそのカードを獲得した／そのカードに投資した」ときの +2カード（強制・累積）。
  //   actorIdx＝獲得/投資した人。その人以外で、その名前に投資しているプレイヤー全員が 2×投資枚数 引く。
  function triggerInvest(state, actorIdx, cardId) {
    if (!cardId) return;
    state.players.forEach((op, oi) => {
      if (oi === actorIdx) return;
      const n = investCount(op, cardId);
      if (n <= 0) return;
      const got = draw(state, oi, 2 * n);
      if (got.length) log(state, `${op.name} は投資（${C()[cardId].name}）で +${got.length}カード。`);
    });
  }
  // 「サプライから追放できる」候補（＝各山の一番上）。engine拒否・CPU候補・UIフィルタが同じ関数を見る。
  //   非サプライ山（馬/賞品/戦利品/トラベラー成長先）は「サプライにある」ではない＝対象外。
  //   ロック中の分割山の下段も対象外（availableInSupply）。混合山は一番上の実カードだけを候補に足す。
  function exilableSupplyIds(state) {
    const out = [];
    Object.keys(state.supply).forEach((id) => {
      if (MIXED_PILE_KEYS.indexOf(id) >= 0) return;   // 山キーそのものは追放対象にしない（中身を下で足す）
      if (!C()[id] || NON_SUPPLY.has(id)) return;
      if (!availableInSupply(state, id)) return;
      out.push(id);
    });
    MIXED_PILE_KEYS.forEach((k) => {
      if (Array.isArray(state[k]) && state[k].length && C()[state[k][0]]) out.push(state[k][0]);
    });
    return out;
  }
  function anyExilableSupply(state, pred) { return exilableSupplyIds(state).some((id) => !pred || pred(id)); }
  // 移動動物園：馬（Horse・非サプライ30枚）を1枚獲得する。山が無い/空なら獲得できない（gain が false を返す）。
  //   「馬を獲得する」効果でのみ得られる＝購入も汎用の「$N以下を獲得」も対象外（NON_SUPPLY）。
  function gainHorse(state, pi, dest) { return gain(state, pi, 'horse', dest || 'discard'); }
  // 獲得先（dest）に対応する実ゾーン。**'setAside'（封鎖）を忘れると、捨て札にある同名の別コピーを
  //   代わりに動かしてしまう**（ヴィラ/遊牧民の野営地/物見やぐら/ティアラ/貨物船/技術革新/交易商人）。
  function zoneOf(p, dest) {
    if (dest === 'hand') return p.hand;
    if (dest === 'deck') return p.deck;
    if (dest === 'setAside') return p.setAside;
    if (dest === 'eventSetAside') return (p.eventSetAside = p.eventSetAside || []);
    return p.discard;
  }
  // 条件に合う獲得可能なカードがサプライに1枚でもあるか
  function anyGainable(state, predicate) {
    return Object.keys(state.supply).some(
      (id) => (state.supply[id] || 0) > 0 && predicate(id)
    );
  }
  // 暗黒時代：採集者＝廃棄置き場にある「異なる名前の財宝」1種につき +$1。
  function foragerCoins(state) {
    return new Set((state.trash || []).filter((c) => isTreasureFor(state, c))).size;
  }
  // 繁栄：コスト/購入数/サプライ以外の「購入できない」追加制限。
  //   高級市場(grand_market)＝場に銅貨があるとき購入不可。CPU/UI もこれを参照して空振りを防ぐ。
  function canBuyCard(state, pi, id) {
    if (id === 'grand_market' && state.players[pi].inPlay.includes('copper')) return false;
    if (id === 'ruins') return false; // 暗黒時代：廃墟は購入できない（略奪者アタック/獲得でのみ配られる）
    // 混合山の中身（廃墟/騎士/城/同盟の分割山の各カード）は名指しで購入できない＝山キーで一番上だけ買える。
    //   ※そのカード自身が独立した山として置かれている場合（fuzz の全プール混成など）は普通に買える。
    if (MIXED_PILE_CONTENTS.has(id) && state.supply[id] == null) return false;
    if (NON_SUPPLY.has(id)) return false; // 収穫祭：賞品は購入できない（馬上槍試合でのみ獲得）
    if (splitLocked(state, id)) return false; // 分割山：下段は上段が尽きるまで購入できない
    /* 夜想曲：錯乱(Deluded)を返したターンは**アクションカードを購入できない**（獲得はできる／
       イベント・プロジェクトは「カードではない」ので買える／夜行カードはアクションでなければ買える）。
       手番プレイヤーにだけ効く（この述語は engine拒否・CPU非提案・UIボタン無効化の3面が共有する）。 */
    if (state.turn && state.turn.cantBuyActions && state.turn.active === pi && isTypeSupply(state, id, 'action')) return false;
    return true;
  }

  // 隠し財産(Hoard): いまは「獲得時」フック(triggerOnGain)で金貨を獲得する（購入に限らず faithful）。
  // 互換のため関数は残すが何もしない（BUY/闇市場の呼び出し側は変更不要）。
  function applyHoardOnBuy() { /* no-op: hoard は triggerOnGain で処理 */ }

  /* ---------- 選択リゾルバの共通部品（カードを足すほど効く再利用パーツ）----------
     手札からN枚を捨てる/廃棄する、強制つきでサプライから獲得する、の3定型を1か所に。
     検証（指定枚数・全て手札にある・在庫・コスト/種別条件・強制獲得時のデッドロック回避）を
     共通化し、各カードの *_RESOLVE は数行で書けるようにする。 */
  // 手札からちょうど want 枚を捨て札へ。検証OKなら実行して true、不正なら false（呼び出し側は state を据え置く）。
  function discardFromHand(state, pIndex, cards, want, note) {
    const p = state.players[pIndex];
    cards = Array.isArray(cards) ? cards : [];
    if (cards.length !== want) return false;
    const copy = p.hand.slice();
    for (const c of cards) if (!removeOne(copy, c)) return false; // 手札に無い指定は拒否
    cards.forEach((c) => { removeOne(p.hand, c); p.discard.push(c); });
    if (cards.length && note) log(state, `${p.name} は ${cards.length}枚 ${note}`);
    return true;
  }
  // 手札からちょうど want 枚を廃棄（trash）へ。検証つき。
  function trashFromHand(state, pIndex, cards, want, note) {
    const p = state.players[pIndex];
    cards = Array.isArray(cards) ? cards : [];
    if (cards.length !== want) return false;
    const copy = p.hand.slice();
    for (const c of cards) if (!removeOne(copy, c)) return false;
    cards.forEach((c) => { removeOne(p.hand, c); trashCard(state, pIndex, c); });
    if (cards.length && note) log(state, `${p.name} は ${cards.length}枚 ${note}`);
    return true;
  }
  // 「強制獲得つき」獲得解決。card が条件(canGain)を満たせば dest へ獲得し pending=null。
  //   card==null: 候補があるうちは獲得必須（pending据え置き）／候補ゼロなら辞退OK(pending=null)。
  //   不正な card: pending据え置き（再選択）。呼び出し側は本関数の後に return state するだけ。
  function finishGain(state, pd, card, canGain, dest, note) {
    if (card == null) {
      // 分割山のロック中の下段は獲得不可＝「候補あり」から除外（さもないと gain 拒否×辞退拒否で pending が閉じずデッドロック）。
      if (anyGainable(state, (id) => canGain(id) && !splitLocked(state, id))) return false; // 候補あり→獲得必須
      state.pending = null; return true;             // 候補なし→辞退
    }
    if (!canGain(card) || (state.supply[card] || 0) <= 0) return false;
    // gain が拒否するカード（分割山の下段アヴァント等）は「獲得したことになるが動かない」を防ぐため再選択に戻す
    if (!gain(state, pd.player, card, dest)) return false;
    if (note) log(state, `${state.players[pd.player].name} は「${C()[card].name}」を${note}`);
    state.pending = null;
    return true;
  }

  /* ---------- ギルド：財源(Coffers)・過払い(overpay)の共通部品 ---------- */
  // 商人ギルド：このターンに商人ギルドを使った回数ぶん、購入のたびに財源を得る（BUY / 闇市場の購入から呼ぶ）。
  //   公式（2E）＝「使うたびに累積」＝玉座の間で2回使えば購入毎に+2財源（＝場の枚数ではなくプレイ回数）。
  //   ※現行出荷セットでは玉座系と商人ギルドは同居しないため、場の枚数と結果は一致する（忠実性のためプレイ回数で数える）。
  function triggerMerchantGuild(state, pi) {
    const me = state.players[pi];
    const n = (state.turn && state.turn.merchantGuildPlays) || 0;
    if (n > 0) {
      me.coffers = (me.coffers || 0) + n;
      log(state, `${me.name} は商人ギルドで +${n} 財源。`);
    }
  }
  // 過払い：overpay 対象カードを購入した直後、残コインがあれば「いくら過払いするか」の選択待ちを立てる。
  function maybeStartOverpay(state, pi, card) {
    if (!OVERPAY_CARDS.has(card)) return;
    const t = state.turn;
    // 支配中の被支配者の購入では過払いも被支配者が選ぶ（gain は既に脇置き処理済み）。ここは通常どおり本人が選ぶ。
    if ((t.coins || 0) > 0) state.pending = { type: 'overpay', player: pi, card, max: t.coins };
  }
  // 過払い額を確定して、カードごとの過払い効果へ分岐する（OVERPAY_RESOLVE から呼ぶ）。
  function applyOverpayEffect(state, pi, card, amount) {
    const p = state.players[pi];
    if (amount <= 0) { state.pending = null; return; }
    if (card === 'masterpiece') {
      // 名品：過払い1コインにつき銀貨1枚を獲得。
      let g = 0;
      for (let i = 0; i < amount; i++) { if (gain(state, pi, 'silver', 'discard')) g++; }
      log(state, `${p.name} は名品の過払い（+${amount}コイン）で銀貨 ${g}枚 を獲得した。`);
      state.pending = null;
    } else if (card === 'stonemason') {
      // 石工：過払い額とちょうど同じコストのアクションカードを2枚獲得。
      if (anyGainable(state, (id) => costExact(state, id, amount, 0, 0) && isTypeSupply(state, id, 'action'))) {
        state.pending = { type: 'stonemason_overpay', player: pi, exact: amount, remaining: 2 };
      } else {
        log(state, `${p.name} は石工の過払い（$${amount}）で獲得できるアクションがなかった。`);
        state.pending = null;
      }
    } else if (card === 'doctor') {
      // 医者：過払い1コインにつき、山札の一番上を見て 廃棄／捨て札／山札の上に戻す を選ぶ。
      startDoctorOverpay(state, pi, amount);
    } else if (card === 'herald') {
      // 伝令官：過払い1コインにつき、捨て札置き場からカード1枚を選んで山札の上に置く。
      if (p.discard.length > 0) state.pending = { type: 'herald_overpay', player: pi, remaining: amount };
      else state.pending = null;
    } else {
      state.pending = null;
    }
  }
  // 医者の過払い：残り回数ぶん、山札の上を1枚ずつ見て処理する。次に見る札を pending.card に載せる（山札が尽きたら終了）。
  function startDoctorOverpay(state, pi, remaining) {
    const p = state.players[pi];
    if (remaining <= 0) { state.pending = null; return; }
    if (p.deck.length === 0 && p.discard.length > 0) { reshuffleDeck(p); }
    if (p.deck.length === 0) { state.pending = null; return; } // もう見る札が無い
    state.pending = { type: 'doctor_overpay', player: pi, remaining, card: p.deck[0] };
  }

  // 民兵：次の対象プレイヤーへ進む（いなければ選択待ち解除）
  function advanceMilitia(state, pd) {
    if (pd.queue && pd.queue.length) {
      state.pending = { type: 'militia', player: pd.queue[0], source: pd.source, queue: pd.queue.slice(1) };
    } else {
      state.pending = null;
    }
  }
  // アタック全般：キューの次の対象へ進む（pd.type を引き継ぐ）。拷問人など複数対象アタック共通。
  function advanceAttack(state, pd) {
    if (pd.queue && pd.queue.length) {
      state.pending = { type: pd.type, player: pd.queue[0], source: pd.source, queue: pd.queue.slice(1) };
    } else {
      state.pending = null;
    }
  }

  /* ---------- 詐欺師（複数対象＋攻撃側が獲得物を選ぶ段階アタック）---------- */
  // 次の犠牲者へ。堀持ちなら反応(react)を待ち、いなければ即廃棄処理へ。queue 空で終了。
  function swindlerEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v)); // 灯台：免疫の被害者は対象外
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0];
    const rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'swindler', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      swindlerTrash(state, source, victim, rest);
    }
  }
  // 犠牲者の山札の上1枚を廃棄→攻撃側が同コストの獲得物を選ぶ（候補が無ければ次へ）。
  function swindlerTrash(state, source, victim, queue) {
    const v = state.players[victim];
    if (v.deck.length === 0 && v.discard.length > 0) { reshuffleDeck(v); }
    if (v.deck.length === 0) {
      log(state, `${v.name} は山札が空で廃棄できなかった。`);
      swindlerEnterVictim(state, source, queue);
      return;
    }
    const trashed = v.deck.shift();
    trashCard(state, victim, trashed);
    log(state, `${v.name} は山札の上の「${C()[trashed].name}」を廃棄した。`);
    const ref = costOf(state, trashed);
    // 非サプライ（賞品/トラベラー成長先/戦利品等）は贈与対象にしない（交換/専用機構でのみ得るカード）。
    // コスト一致は3成分（銅貨$0 に 大君主$0+負債8 を押し付けられない＝公式）。
    if (anyGainable(state, (id) => costExact(state, id, ref.coin, ref.pot, ref.debt))) {
      state.pending = { type: 'swindler', stage: 'gain', player: source, source, victim, cost: ref.coin, pot: ref.pot, debt: ref.debt, queue };
    } else {
      swindlerEnterVictim(state, source, queue); // 同コストの獲得候補が無ければ獲得なしで次へ
    }
  }

  /* ---------- 破壊工作員（複数対象。$3以上を1枚廃棄→犠牲者が任意で格下げ獲得）---------- */
  function saboteurEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v)); // 灯台：免疫の被害者は対象外
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'saboteur', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      saboteurReveal(state, source, victim, rest);
    }
  }
  function saboteurReveal(state, source, victim, queue) {
    const v = state.players[victim];
    const setAside = [];
    let trashed = null;
    // $3以上が出るまで山札の上を公開（足りなければreshuffle、尽きたら終了）
    while (true) {
      if (v.deck.length === 0) {
        if (v.discard.length === 0) break;
        reshuffleDeck(v);
      }
      const c = v.deck.shift();
      if (cardCost(state, c) >= 3) { trashed = c; break; }
      setAside.push(c);
    }
    setAside.forEach((c) => v.discard.push(c)); // $3未満の公開札は捨てる
    if (trashed) {
      trashCard(state, victim, trashed);
      log(state, `${v.name} は山札の上から「${C()[trashed].name}」を廃棄した。`);
      const sref = costOf(state, trashed);
      const maxCost = Math.max(0, sref.coin - 2);
      state.pending = { type: 'saboteur', stage: 'gain', player: victim, source, victim, maxCost, pot: sref.pot, debt: sref.debt, queue };
    } else {
      log(state, `${v.name} は $3 以上のカードが無く、廃棄しなかった。`);
      saboteurEnterVictim(state, source, queue);
    }
  }

  /* ---------- 手先（攻撃側の選択＋全相手に作用するアタック）---------- */
  function minionAttackEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v)); // 灯台：免疫の被害者は対象外
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'minion_attack', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      minionAttackApply(state, source, victim, rest);
    }
  }
  function minionAttackApply(state, source, victim, queue) {
    const v = state.players[victim];
    if (v.hand.length >= 5) { // 解決時点で手札5枚以上の相手だけ捨てて4枚引く
      v.discard.push(...v.hand); v.hand = [];
      draw(state, victim, 4);
      log(state, `${v.name} は手札を捨てて4枚引いた（手先）。`);
    }
    minionAttackEnterVictim(state, source, queue);
  }

  /* ---------- 仮面舞踏会（全員が同時に手札1枚を左隣へ渡す）---------- */
  // 手札のあるプレイヤーを手番順（使用者から）に並べる。空手札の人は渡せない。
  function masqueradePassOrder(state, source) {
    const n = state.players.length, order = [];
    for (let k = 0; k < n; k++) { const idx = (source + k) % n; if (state.players[idx].hand.length > 0) order.push(idx); }
    return order;
  }
  // 集めた選択を一斉に適用（先に全員から取り除き→左隣へ配る＝同時）。左隣は (idx+1)%n。
  function masqueradeApplyPasses(state, order, picks) {
    const n = state.players.length;
    order.forEach((idx) => { removeOne(state.players[idx].hand, picks[idx]); });
    order.forEach((idx) => { state.players[(idx + 1) % n].hand.push(picks[idx]); });
    log(state, '仮面舞踏会：各プレイヤーが手札1枚を左隣へ渡した。');
  }
  function masqueradeAfterPass(state, source) {
    // 使用者は手札を1枚廃棄してよい（任意）
    state.pending = state.players[source].hand.length > 0
      ? { type: 'masquerade', stage: 'trash', player: source, source }
      : null;
  }

  // リアクション札（堀／秘密の小部屋）を持つか。被攻撃側に反応の機会を与えるか判定に使う。
  function hasReaction(player) {
    return player.hand.includes('moat') || player.hand.includes('secret_chamber') ||
      player.hand.includes('horse_traders') || // 収穫祭：馬商人（脇に置いて次手番に+1カードで戻す。免疫にはならない）
      player.hand.includes('guard_dog') || // 異郷：番犬（相手のアタック時に手札から先に使ってよい。免疫にはならない）
      player.hand.includes('caravan_guard') || // 冒険：隊商の護衛（相手のアタック時に手札から先にプレイしてよい。免疫にはならない）
      player.hand.includes('beggar') || // 暗黒時代：物乞い（捨てて銀貨2枚を獲得。免疫にはならない）
      (player.hand.includes('diplomat') && player.hand.length >= 5);
  }
  // 秘密の小部屋のリアクションを差し込める「被攻撃側の反応ステップ」か。
  /* ---------- アタック登録表（唯一の正本）----------
     新しいアタックを足すときは、ここに1行 ＋ 対応する EnterVictim と *_REACT リゾルバを書くだけ。
     堀(MOAT_REVEAL)・秘密の小部屋・外交官の反応窓口の判定と「無効化されたら次の被害者へ」は
     すべてこの表を引いて行う＝ MOAT_REVEAL に分岐を書き足し忘れて堀が効かない事故を防ぐ。
       embedded … 被攻撃者の解決ステップ自体が反応窓口（民兵・拷問人。'react'ステージを持たない）。
       onMoat  … 堀で無効化されたとき、その被害者を飛ばして次へ進める関数。
     test/integrity.test.js が「'react'ステージを作るアタックは全てここに登録済み」を自動検証する。 */
  const ATTACKS = {
    militia:       { embedded: true, onMoat: (s, pd) => advanceMilitia(s, pd) },
    torturer:      { embedded: true, onMoat: (s, pd) => advanceAttack(s, pd) },
    witch:         { onMoat: (s, pd) => witchEnterVictim(s, pd.source, pd.queue) },
    bureaucrat:    { onMoat: (s, pd) => bureaucratEnterVictim(s, pd.source, pd.queue) },
    spy:           { onMoat: (s, pd) => spyEnterTarget(s, pd.source, pd.queue) },
    thief:         { onMoat: (s, pd) => thiefEnterVictim(s, pd.source, pd.queue) },
    swindler:      { onMoat: (s, pd) => swindlerEnterVictim(s, pd.source, pd.queue) },
    saboteur:      { onMoat: (s, pd) => saboteurEnterVictim(s, pd.source, pd.queue) },
    minion_attack: { onMoat: (s, pd) => minionAttackEnterVictim(s, pd.source, pd.queue) },
    bandit:        { onMoat: (s, pd) => banditEnterVictim(s, pd.source, pd.queue) },
    replace:       { onMoat: (s, pd) => replaceEnterVictim(s, pd.source, pd.queue) },
    cutpurse:      { onMoat: (s, pd) => cutpurseEnterVictim(s, pd.source, pd.queue) },
    sea_witch:     { onMoat: (s, pd) => seaWitchEnterVictim(s, pd.source, pd.queue) },
    // 封鎖：プレイ時のアタック。堀を公開した相手はこの封鎖の呪い窓から免疫（immune 登録）＝以後同名を獲得しても呪いを受けない。
    blockade:      { onMoat: (s, pd) => { markBlockadeImmune(s, pd.source, pd.gained, pd.victim); blockadeEnterVictim(s, pd.source, pd.queue, pd.gained); } },
    familiar:      { onMoat: (s, pd) => familiarEnterVictim(s, pd.source, pd.queue) },
    fortune_teller:{ onMoat: (s, pd) => fortuneTellerEnterVictim(s, pd.source, pd.queue) },
    jester:        { onMoat: (s, pd) => jesterEnterVictim(s, pd.source, pd.queue) },
    followers:     { onMoat: (s, pd) => followersEnterVictim(s, pd.source, pd.queue) },
    young_witch:   { onMoat: (s, pd) => youngWitchEnterVictim(s, pd.source, pd.queue) },
    scrying_pool:  { onMoat: (s, pd) => scryingEnterTarget(s, pd.source, pd.queue) },
    charlatan:     { onMoat: (s, pd) => charlatanEnterVictim(s, pd.source, pd.queue) },
    rabble:        { onMoat: (s, pd) => rabbleEnterVictim(s, pd.source, pd.queue) },
    clerk:         { onMoat: (s, pd) => clerkEnterVictim(s, pd.source, pd.queue) },
    // ギルド：収税吏（廃棄財宝と同名を捨てさせる）・予言者（呪い配布＋引かせる）。
    taxman:        { onMoat: (s, pd) => taxmanEnterVictim(s, pd.source, pd.queue, pd.trashedName) },
    soothsayer:    { onMoat: (s, pd) => soothsayerEnterVictim(s, pd.source, pd.queue) },
    // 異郷：辺境伯（各相手 +1カード→手札3枚まで捨て）・神託（各相手の山札上2枚を使用者が捨て/戻す）・
    //       高貴な山賊（各相手の山札上2枚から銀/金を廃棄・使用者が獲得）・狂戦士/魔女の小屋/大釜（呪い配布）。
    margrave:      { onMoat: (s, pd) => margraveEnterVictim(s, pd.source, pd.queue) },
    oracle:        { onMoat: (s, pd) => oracleEnterTarget(s, pd.source, pd.queue) },
    noble_brigand: { onMoat: (s, pd) => nobleBrigandEnterVictim(s, pd.source, pd.queue) },
    berserker:     { onMoat: (s, pd) => berserkerEnterVictim(s, pd.source, pd.queue) },
    witchs_hut:    { onMoat: (s, pd) => witchsHutEnterVictim(s, pd.source, pd.queue) },
    cauldron:      { onMoat: (s, pd) => cauldronEnterVictim(s, pd.source, pd.queue) },
    // 暗黒時代：略奪者/狂信者（廃墟配布）・略奪（手札公開）・盗賊（山札上2枚廃棄）・手札削り（浮浪児/傭兵）。
    marauder:      { onMoat: (s, pd) => marauderEnterVictim(s, pd.source, pd.queue) },
    cultist:       { onMoat: (s, pd) => cultistEnterVictim(s, pd.source, pd.queue) },
    pillage:       { onMoat: (s, pd) => pillageEnterVictim(s, pd.source, pd.queue) },
    rogue:         { onMoat: (s, pd) => rogueEnterVictim(s, pd.source, pd.queue) },
    discard_down:  { embedded: true, onMoat: (s, pd) => advanceDiscardDown(s, pd) },
    // ルネサンス：老魔女（呪い配布＋手札の呪いを廃棄してよい）・悪党（$2以上を1枚捨て／無ければ手札公開）。
    old_witch:     { onMoat: (s, pd) => oldWitchEnterVictim(s, pd.source, pd.queue) },
    villain:       { onMoat: (s, pd) => villainEnterVictim(s, pd.source, pd.queue) },
    knight:        { onMoat: (s, pd) => knightAttackEnter(s, pd.source, pd.sourceCard, pd.queue) },
    /* 夜想曲：呪詛（不運アタック＝暗躍者/迫害者/吸血鬼/人狼）の共通リアクション窓。
       堀を公開した被害者は accepted に入らない＝呪詛を受けない。**呪詛は全員の窓を閉じてから1枚だけめくる**。 */
    hex:           { onMoat: (s, pd) => hexReactEnter(s, pd.source, pd.queue, pd.accepted || []) },
    idol:          { onMoat: (s, pd) => idolEnterVictim(s, pd.source, pd.queue) },
    raider:        { onMoat: (s, pd) => raiderEnterVictim(s, pd.source, pd.queue) },
    // 「アタックを使用した」ことだけに反応する窓（人狼のドロー側／迫害者のインプ側）。堀は無意味だが公開はできる。
    attack_window: { onMoat: (s, pd) => attackWindowEnter(s, pd.source, pd.queue, pd.after) },
    // 冒険：遺物（-1カードトークン）・巨人（公開廃棄/呪い）・橋の下のトロル（-$1トークン）。
    relic:         { onMoat: (s, pd) => relicEnterVictim(s, pd.source, pd.queue) },
    giant:         { onMoat: (s, pd) => giantEnterVictim(s, pd.source, pd.queue) },
    bridge_troll:  { onMoat: (s, pd) => bridgeTrollEnterVictim(s, pd.source, pd.queue) },
    // 冒険：トラベラーのアタック（ウォリアー＝山札上を捨て$3/$4廃棄／兵士＝手札4枚以上で1枚捨て）。
    warrior:       { onMoat: (s, pd) => warriorEnterVictim(s, pd.source, pd.queue, pd.count) },
    soldier:       { onMoat: (s, pd) => soldierEnterVictim(s, pd.source, pd.queue) },
    // 冒険：呪いの森/沼の妖婆＝相手の購入をフックする持続アタック（堀公開でこの予約[rid]から免疫）。
    haunted_woods: { onMoat: (s, pd) => { markLingerImmune(s, pd.source, 'haunted_woods', pd.victim, pd.rid); lingerAttackEnter(s, pd.source, 'haunted_woods', pd.queue, pd.rid); } },
    swamp_hag:     { onMoat: (s, pd) => { markLingerImmune(s, pd.source, 'swamp_hag', pd.victim, pd.rid); lingerAttackEnter(s, pd.source, 'swamp_hag', pd.queue, pd.rid); } },
    // 帝国：女魔術師（アタック持続）＝堀公開でこの相手は enchanted されず次へ。
    enchantress:   { onMoat: (s, pd) => enchantressEnterVictim(s, pd.source, pd.queue) },
    // 帝国：投石機（アタック）＝堀公開でこの相手は呪い/捨てを免れ次へ。
    catapult:      { onMoat: (s, pd) => catapultEnterVictim(s, pd.source, pd.queue, pd.giveCurse, pd.treasureDiscard, pd.discardQ) },
    // 移動動物園：黒猫（相手の手番に呪い）／枢機卿（山札上2枚から追放）／魔女の集会（呪いを追放）。
    black_cat:     { onMoat: (s, pd) => blackCatEnterVictim(s, pd.source, pd.queue) },
    cardinal:      { onMoat: (s, pd) => cardinalEnterVictim(s, pd.source, pd.queue) },
    coven:         { onMoat: (s, pd) => covenEnterVictim(s, pd.source, pd.queue) },
    // 移動動物園：門番＝相手の「獲得」をフックする持続アタック（堀公開でこの予約[rid]から免疫）。
    gatekeeper:    { onMoat: (s, pd) => { markLingerImmune(s, pd.source, 'gatekeeper', pd.victim, pd.rid); lingerAttackEnter(s, pd.source, 'gatekeeper', pd.queue, pd.rid); } },
  };
  // 被攻撃側の反応（堀／秘密の小部屋／外交官）を差し込める局面か。
  function isAttackReactPending(pd) {
    if (!pd) return false;
    const a = ATTACKS[pd.type];
    if (!a) return false;
    return !!a.embedded || pd.stage === 'react';
  }

  /* ---------- 書庫（手札が7枚になるまで引く。引いたアクションは脇に置ける）---------- */
  function libraryStep(state, pi, aside) {
    const p = state.players[pi];
    while (p.hand.length < 7) {
      if (p.deck.length === 0) {
        if (p.discard.length === 0) break;
        reshuffleDeck(p);
      }
      if (p.deck.length === 0) break;
      const c = p.deck.shift();
      p.hand.push(c);
      if (DOM.isType(c, 'action')) { // アクションは脇に置くか選ぶ
        state.pending = { type: 'library', player: pi, aside, card: c };
        return;
      }
    }
    aside.forEach((x) => p.discard.push(x));
    if (aside.length) log(state, `${p.name} は脇に置いた ${aside.length}枚 を捨てた（書庫）。`);
    state.pending = null;
  }

  /* ---------- 密偵（全員の山札の上を公開、使用者が各自について捨てる/戻すを決める）---------- */
  function spyEnterTarget(state, attacker, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => v === attacker || !attackImmune(state, v)); // 灯台：免疫の相手は対象外（自分は対象）
    if (!queue.length) { state.pending = null; return; }
    const target = queue[0], rest = queue.slice(1);
    if (target !== attacker && hasReaction(state.players[target])) {
      state.pending = { type: 'spy', stage: 'react', player: target, source: attacker, victim: target, queue: rest };
    } else {
      spyReveal(state, attacker, target, rest);
    }
  }
  function spyReveal(state, attacker, target, queue) {
    const tp = state.players[target];
    if (tp.deck.length === 0 && tp.discard.length > 0) { reshuffleDeck(tp); }
    if (tp.deck.length === 0) { // 公開する札が無い
      spyEnterTarget(state, attacker, queue);
      return;
    }
    reveal(state, target, [tp.deck[0]], '密偵で山札の上を公開');
    state.pending = { type: 'spy', stage: 'decide', player: attacker, source: attacker, victim: target, card: tp.deck[0], queue };
  }

  /* ---------- 泥棒（他の各自が上2枚公開、使用者が財宝1枚を廃棄→獲得してよい）---------- */
  function thiefEnterVictim(state, attacker, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v)); // 灯台：免疫の被害者は対象外
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'thief', stage: 'react', player: victim, source: attacker, victim, queue: rest };
    } else {
      thiefReveal(state, attacker, victim, rest);
    }
  }
  function thiefReveal(state, attacker, victim, queue) {
    const v = state.players[victim];
    const revealed = [];
    for (let i = 0; i < 2; i++) {
      if (v.deck.length === 0) { if (v.discard.length === 0) break; reshuffleDeck(v); }
      if (v.deck.length === 0) break;
      revealed.push(v.deck.shift());
    }
    if (revealed.length) reveal(state, victim, revealed, '泥棒で山札の上を公開');
    const treasures = revealed.filter((c) => isTreasureFor(state, c));
    if (treasures.length) {
      state.pending = { type: 'thief', stage: 'pick', player: attacker, source: attacker, victim, revealed, treasures, queue };
    } else {
      revealed.forEach((c) => v.discard.push(c)); // 財宝なし→全部捨てる
      if (revealed.length) log(state, `${v.name} は公開した ${revealed.length}枚 を捨てた（泥棒）。`);
      thiefEnterVictim(state, attacker, queue);
    }
  }

  /* ---------- 魔女（複数対象。各相手が呪いを獲得）---------- */
  function witchEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v)); // 灯台：免疫の被害者は対象外
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'witch', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      witchCurse(state, source, victim, rest);
    }
  }
  function witchCurse(state, source, victim, queue) {
    if ((state.supply.curse || 0) > 0) {
      gain(state, victim, 'curse', 'discard');
      log(state, `${state.players[victim].name} は呪いを獲得した（魔女）。`);
    }
    witchEnterVictim(state, source, queue);
  }

  /* ========== ルネサンス（Renaissance）：アタック2種 ========== */
  /* 老魔女（old_witch）＝呪いを配り、その後 各被害者は「手札の呪い1枚」を廃棄してもよい。
     公式：**免疫のプレイヤーは呪いを獲得もせず、呪いを廃棄することもできない**（魔女と違い「廃棄だけ許す」のは誤り）。
     呪い山が空でも「手札の呪いを廃棄してよい」は行える（獲得だけが起きない）＝呪い枯渇後も死に札にならない。
     廃棄できるのは「もともと手札にある呪い」だけ（獲得した呪いは捨て札に入る）。 */
  function oldWitchEnterVictim(state, source, queue) {
    queue = (queue || []).filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'old_witch', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      oldWitchApply(state, source, victim, rest);
    }
  }
  function oldWitchApply(state, source, victim, queue) {
    if ((state.supply.curse || 0) > 0) {
      gain(state, victim, 'curse', 'discard');
      log(state, `${state.players[victim].name} は呪いを獲得した（老魔女）。`);
    }
    // 手札に（もとから）呪いがあれば、1枚を廃棄してよい（任意）。
    if (state.players[victim].hand.includes('curse')) {
      state.pending = { type: 'old_witch_trash', player: victim, source, queue };
      return;
    }
    oldWitchEnterVictim(state, source, queue);
  }
  /* 悪党（villain）＝手札5枚以上の各相手は、手札からコスト$2以上のカード1枚を捨てる（無ければ手札を公開）。
     - 手札5枚以上の判定は**各プレイヤーの解決時点**（リアクションで手札が減れば対象外）。
     - 「$2以上」は解決時点の**現在コスト**（運河があると屋敷は$1＝捨てられない）。
     - 「捨て札にする」は公開(reveal)ではない＝パトロンは誘発しない。ただし**「手札を公開する」枝は reveal**。 */
  function villainEnterVictim(state, source, queue) {
    queue = (queue || []).filter((v) => !attackImmune(state, v));
    while (queue.length && state.players[queue[0]].hand.length < 5) queue = queue.slice(1); // 手札4枚以下は何も起きない
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'villain', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      villainApply(state, source, victim, rest);
    }
  }
  function villainApply(state, source, victim, queue) {
    const v = state.players[victim];
    if (v.hand.length < 5) { villainEnterVictim(state, source, queue); return; } // 反応で手札が減ったら対象外
    if (v.hand.some((c) => cardCost(state, c) >= 2)) {
      state.pending = { type: 'villain_discard', player: victim, source, queue };
      return;
    }
    reveal(state, victim, v.hand.slice(), '悪党：コスト$2以上が無いので手札を公開');
    log(state, `${v.name} はコスト$2以上のカードが無く、手札を公開した（悪党）。`);
    villainEnterVictim(state, source, queue);
  }
  // 発明家／彫刻家の「コスト$4以下」＝コイン成分のみ（負債/ポーション費用のカードは含まない・非サプライ/分割山下段は除く）。
  function inventorGainable(state, id) { return costUpTo(state, id, 4); }
  /* 王笏（scepter）の再演対象＝「このターンにあなたが使用し、**場に出たまま**の、**命令ではない**アクションカード」。
     - 場（inPlay）にあるアクション＝このターン使用したもの（前ターンの持続は durationCards にあり対象外）。
     - 命令（大君主/はみだし者/船長/王子）は 2024エラッタで対象外。**相続で命令になった屋敷**も対象外。
     - 島マット/自己廃棄/リザーブ/脇置き で場を離れた札は inPlay に無い＝自然に対象外（公式どおり）。
     engine拒否・CPU非提案・UI表示が同じ述語を見る（公開API）。 */
  function scepterTargets(state, pi) {
    const p = state.players[pi];
    const seen = {};
    return p.inPlay.filter((c) => {
      if (!DOM.isType(c, 'action')) return false;
      if (DOM.isType(c, 'command')) return false;
      if (inheritedEstate(p, c)) return false; // 相続の屋敷は命令
      if (seen[c]) return false; seen[c] = true; // 表示・選択は名前ごとに1つ
      return true;
    });
  }

  /* ========== 暗黒時代：アタック各種（廃墟配布/手札公開/山札上2枚廃棄/手札削り） ========== */
  // 略奪者：各相手が廃墟を1枚獲得（魔女型・非対話）。
  function marauderEnterVictim(state, source, queue) {
    queue = (queue || []).filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'marauder', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      if (gain(state, victim, 'ruins', 'discard')) log(state, `${state.players[victim].name} は廃墟を獲得した（略奪者）。`);
      marauderEnterVictim(state, source, rest);
    }
  }
  // 狂信者：各相手が廃墟を獲得→終端で「手札の狂信者を連鎖使用してよい」。
  function cultistEnterVictim(state, source, queue) {
    queue = (queue || []).filter((v) => !attackImmune(state, v));
    if (!queue.length) { cultistAfter(state, source); return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'cultist', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      if (gain(state, victim, 'ruins', 'discard')) log(state, `${state.players[victim].name} は廃墟を獲得した（狂信者）。`);
      cultistEnterVictim(state, source, rest);
    }
  }
  function cultistAfter(state, source) {
    if (state.players[source].hand.includes('cultist')) state.pending = { type: 'cultist_chain', player: source };
    else state.pending = null;
  }
  /* ========== 冒険：アタック（遺物＝-1カードトークン／巨人＝公開廃棄or呪い／橋の下のトロル＝-$1トークン） ========== */
  // 遺物：各相手が -1カードトークンを受け取る（略奪者型・非対話。堀で防げる）。
  function relicEnterVictim(state, source, queue) {
    queue = (queue || []).filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'relic', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      state.players[victim].minusCard = true;
      log(state, `${state.players[victim].name} は -1カードトークンを受け取った（遺物）。`);
      relicEnterVictim(state, source, rest);
    }
  }
  // 橋の下のトロル：各相手が -$1トークンを受け取る（略奪者型・非対話。堀で防げる）。
  function bridgeTrollEnterVictim(state, source, queue) {
    queue = (queue || []).filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'bridge_troll', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      state.players[victim].minusCoin = true;
      log(state, `${state.players[victim].name} は -$1トークンを受け取った（橋の下のトロル）。`);
      bridgeTrollEnterVictim(state, source, rest);
    }
  }
  // 巨人：各相手が山札の一番上を公開＝$3〜$6なら廃棄、そうでなければ捨てて呪いを獲得（略奪者型・自動解決）。
  function giantEnterVictim(state, source, queue) {
    queue = (queue || []).filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'giant', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      giantHit(state, victim);
      giantEnterVictim(state, source, rest);
    }
  }
  function giantHit(state, victim) {
    const v = state.players[victim];
    if (v.deck.length === 0 && v.discard.length > 0) reshuffleDeck(v);
    if (v.deck.length === 0) { // 公開する札が無い→呪いだけ獲得
      if ((state.supply.curse || 0) > 0) { gain(state, victim, 'curse', 'discard'); log(state, `${v.name} は山札が空なので呪いを獲得した（巨人）。`); }
      return;
    }
    const top = v.deck[0];
    reveal(state, victim, [top], '巨人で山札の上を公開');
    const cc = cardCost(state, top);
    if (cc >= 3 && cc <= 6) {
      v.deck.shift(); trashCard(state, victim, top);
      log(state, `${v.name} は「${C()[top].name}」を廃棄した（巨人）。`);
    } else {
      v.deck.shift(); v.discard.push(top);
      log(state, `${v.name} は「${C()[top].name}」を捨てた（巨人）。`);
      if ((state.supply.curse || 0) > 0) { gain(state, victim, 'curse', 'discard'); log(state, `${v.name} は呪いを獲得した（巨人）。`); }
    }
  }
  /* ========== 冒険：トラベラーのアタック（ウォリアー＝山札上を捨て$3/$4廃棄／兵士＝手札4枚以上で1枚捨て） ========== */
  // ウォリアー：各相手は「場のトラベラー数(count)」回、山札の一番上を捨て、$3か$4なら廃棄する（略奪者型・堀リアクション窓あり）。
  function warriorEnterVictim(state, source, queue, count) {
    queue = (queue || []).filter((v) => !attackImmune(state, v));
    if (!queue.length || count <= 0) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'warrior', stage: 'react', player: victim, source, victim, queue: rest, count };
    } else {
      warriorHit(state, victim, count);
      warriorEnterVictim(state, source, rest, count);
    }
  }
  function warriorHit(state, victim, count) {
    const v = state.players[victim];
    for (let i = 0; i < count; i++) {
      if (v.deck.length === 0 && v.discard.length > 0) reshuffleDeck(v);
      if (v.deck.length === 0) break; // 捨てる札が無い
      const top = v.deck.shift();
      reveal(state, victim, [top], 'ウォリアーで山札の上を公開');
      const cc = cardCost(state, top);
      // 公開したカードは常に捨てるが、コストがちょうど$3か$4（ポーション費用を含まない）なら廃棄する。
      if ((cc === 3 || cc === 4) && potionCost(top) === 0) { trashCard(state, victim, top); log(state, `${v.name} は「${C()[top].name}」を廃棄した（ウォリアー）。`); }
      else { v.discard.push(top); log(state, `${v.name} は「${C()[top].name}」を捨てた（ウォリアー）。`); }
    }
  }
  // 兵士：手札4枚以上の各相手はカード1枚を捨てる（本人が選ぶ・堀リアクション窓あり）。
  function soldierEnterVictim(state, source, queue) {
    queue = (queue || []).filter((v) => !attackImmune(state, v) && state.players[v].hand.length >= 4);
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'soldier', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      state.pending = { type: 'soldier', stage: 'discard', player: victim, source, victim, queue: rest };
    }
  }

  /* ========== 冒険：酒場マット（Reserve）＝呼び出し機構 ========== */
  // Reserve カードをプレイした直後、これを場（inPlay）から酒場マットへ置く。
  //   玉座/王の宮廷/行進で複製プレイされると applyEffect が複数回走る＝2回目以降は場にもう無い。
  //   島/祝宴/宝の地図と同じ「自己移動ガード」で、場から取り除けたときだけマットへ置く（＝マットには1枚だけ）。
  //   命令（大君主/はみだし者/船長/王子）が動かさずに使った Reserve は場に無い＝マットに乗らない（公式・E8）。
  function putOnTavern(state, pi, cardId) {
    const p = state.players[pi];
    if (takeSelf(state, pi, cardId)) {
      (p.tavern = p.tavern || []).push(cardId);
      log(state, `${p.name} は「${C()[cardId].name}」を酒場マットに置いた。`);
    } else if (playedByCommand(state, pi, cardId)) {
      log(state, `${p.name} の「${C()[cardId].name}」は動かないので酒場マットに置かれない。`);
    }
  }
  const TOKEN_LABEL = { card: 'カード', action: 'アクション', buy: '購入', coin: 'コイン', cost: '-$2コスト', trash: '廃棄' };
  // +1系の山トークン（プレイ時ボーナス）＝教師／失われた技術・鍛錬・誘導・海路。
  //   cost（渡し船）・trash（立案）は「プレイ時ボーナス」ではない別トークンなのでここでは扱わない。
  const BONUS_TOKENS = ['card', 'action', 'buy', 'coin'];
  // 冒険：山トークン＝プレイしたカードの山に自分の+1系トークンがあれば、まずそのボーナスを得る
  //   （カード自身の効果解決より前・1回のプレイにつき1回＝玉座で2回プレイすれば2回発火）。
  function applyPileTokens(state, pi, card) {
    const p = state.players[pi], toks = p.pileTokens || {}, t = state.turn;
    const key = pileKeyOf(state, card); // 分割山は1山＝上段キーで一元管理（下段のカードをプレイしても発火する）
    BONUS_TOKENS.forEach((tk) => {
      if (toks[tk] !== key) return;
      if (tk === 'card') draw(state, pi, 1);
      else if (tk === 'action') addActions(t, 1);
      else if (tk === 'buy') t.buys += 1;
      else if (tk === 'coin') { addCoins(state, 1); applyCoinPenalty(state); }
      log(state, `${p.name} は山トークンで +1${TOKEN_LABEL[tk]}（${C()[card].name}）。`);
    });
  }
  // ターン開始時に呼び出せる Reserve（案内人/鼠取り/変容／教師）。
  const TAVERN_START_CALLS = ['guide', 'ratcatcher', 'transmogrify', 'teacher'];
  // 冒険：教師の置き先＝「自分のトークンが無いアクションのサプライ山」。
  //   非サプライ/騎士/分割山下段/勝利点専用等を除く。トークンは公開情報（各山1つまで）。
  //   ※ 山が空でも「アクションのサプライ山」ならトークンを置ける（公式）＝残枚数は問わない。
  //   ※ 分割山は1山＝**上段キーだけ**を候補にする（下段キーに置くと READ 側の pileKeyOf 正規化と食い違い、
  //      トークンが孤児化して永久に発火しない＝帝国の徴税で踏んだのと同型の事故）。
  function actionSupplyPiles(state) {
    return Object.keys(state.supply).filter((id) =>
      state.supply[id] != null && !NON_SUPPLY.has(id) && C()[id] && DOM.isType(id, 'action') &&
      id !== 'knights' && !SPLIT_TOP[id]);
    /* ※ここで `!splitLocked` を見てはいけない。トークンを置けるかは「**山**がアクションのサプライ山か」の話で、
         「今その id を獲得できるか」ではない。循環(Rotate)で2段分割山の上下が入れ替わっている間も
         山は同じ1つの山＝トークンは置ける（山の種別は randomizer 固定）。
         `!SPLIT_TOP[id]` だけで上段キー1エントリに正規化できている。 */
  }
  function validTeacherPiles(state, pi) {
    const p = state.players[pi];
    const mine = new Set(Object.values(p.pileTokens || {})); // 自分のトークンが既に乗っている山（教師だけの制約＝公式）
    return actionSupplyPiles(state).filter((id) => !mine.has(id));
  }
  // 教師を呼べるか＝酒場マットにあり、置ける山が1つ以上あるとき（置き先が無ければ呼んでも無意味なので窓を開かない）。
  function teacherCallable(state, pi) {
    return (state.players[pi].tavern || []).includes('teacher') && validTeacherPiles(state, pi).length > 0;
  }
  // ターン開始の呼び出し窓を開くべきか（案内人/鼠取り/変容＝マットにあれば／教師＝置き先があれば）。
  function anyTavernStartCallable(state, pi) {
    const p = state.players[pi];
    return (p.tavern || []).some((c) => c === 'guide' || c === 'ratcatcher' || c === 'transmogrify') || teacherCallable(state, pi);
  }
  // ターン開始の呼び出し窓：まだ呼べる Reserve が酒場マットにあれば再オファー、無ければ次の開始時効果へ。
  function offerTavernStart(state, pi) {
    if (anyTavernStartCallable(state, pi)) state.pending = { type: 'tavern_start', player: pi };
    else popStartQueue(state);
  }
  // 略奪：手札5枚以上の各相手が手札を公開し、使用者が1枚選んで捨てさせる。
  function pillageEnterVictim(state, source, queue) {
    queue = (queue || []).filter((v) => !attackImmune(state, v) && state.players[v].hand.length >= 5);
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'pillage', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      reveal(state, victim, state.players[victim].hand.slice(), '略奪で手札公開');
      state.pending = { type: 'pillage', stage: 'pick', player: source, source, victim, queue: rest };
    }
  }
  // 盗賊：廃棄置き場に$3-6が無いとき＝各相手が山札の上2枚を公開し、$3-6の1枚を（本人が選んで）廃棄、残りを捨てる。
  function rogueEnterVictim(state, source, queue) {
    queue = (queue || []).filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'rogue', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      rogueReveal(state, source, victim, rest);
    }
  }
  function rogueReveal(state, source, victim, queue) {
    const v = state.players[victim];
    const revealed = [];
    for (let i = 0; i < 2; i++) { if (v.deck.length === 0) { if (v.discard.length === 0) break; reshuffleDeck(v); } if (v.deck.length === 0) break; revealed.push(v.deck.shift()); }
    if (revealed.length) reveal(state, victim, revealed, '盗賊で山札の上を公開');
    const trashable = revealed.filter((c) => { const cc = cardCost(state, c); return cc >= 3 && cc <= 6 && potionCost(c) === 0; });
    if (trashable.length === 0) {
      revealed.forEach((c) => v.discard.push(c));
      if (revealed.length) log(state, `${v.name} は公開した ${revealed.length}枚 を捨てた（盗賊）。`);
      rogueEnterVictim(state, source, queue);
    } else if (trashable.length === 1) {
      const tc = trashable[0]; const rest = revealed.slice(); removeOne(rest, tc);
      trashCard(state, victim, tc); rest.forEach((c) => v.discard.push(c));
      log(state, `${v.name} の「${C()[tc].name}」を廃棄した（盗賊）。`);
      rogueEnterVictim(state, source, queue);
    } else {
      state.pending = { type: 'rogue', stage: 'pick', player: victim, source, victim, revealed, trashable, queue };
    }
  }
  // 手札N枚まで捨てる汎用アタック（民兵型・embedded。浮浪児=4/傭兵=3/サー・マイケル=3）。
  //   next='knight:<id>' を渡すと、全員の捨てが終わったあとに騎士アタックへ連鎖する（サー・マイケル用）。
  function discardDownEnter(state, source, down, victims, next, drawAfter) {
    if (victims && victims.length) state.pending = { type: 'discard_down', player: victims[0], source, down, queue: victims.slice(1), next: next || null, drawAfter: drawAfter || 0 };
    else discardDownDone(state, source, next);
  }
  function advanceDiscardDown(state, pd) {
    const q = pd.queue || [];
    if (q.length) state.pending = { type: 'discard_down', player: q[0], source: pd.source, down: pd.down, queue: q.slice(1), next: pd.next || null, drawAfter: pd.drawAfter || 0 };
    else discardDownDone(state, pd.source, pd.next);
  }
  // 暗黒時代：浮浪児＝場に浮浪児がある状態で「別の」アタックをプレイしたとき、その解決前に
  //   場の浮浪児を廃棄して傭兵を獲得してよい。true を返したら card の効果適用は URCHIN_TRASH 後に遅延する。
  function maybeUrchinTrap(state, card, pi) {
    const p = state.players[pi];
    const priorUrchins = p.inPlay.filter((c) => c === 'urchin').length - (card === 'urchin' ? 1 : 0);
    if (DOM.isType(card, 'attack') && priorUrchins > 0 && (state.supply.mercenary || 0) > 0) {
      state.pending = { type: 'urchin_trash', player: pi, deferred: card };
      return true;
    }
    return false;
  }
  function discardDownDone(state, source, next) {
    if (next && next.indexOf('knight:') === 0) startKnightAttack(state, source, next.slice('knight:'.length));
    else state.pending = null;
  }

  /* ---------- 暗黒時代：騎士の共通アタック（混合山） ----------
     各相手が山札の上2枚を公開→$3-6の1枚を「本人が選んで」廃棄→残りを捨てる。
     騎士が廃棄されたら、攻撃した騎士（sourceCard）も廃棄する。 */
  function startKnightAttack(state, pi, sourceCard) {
    const q = []; for (let k = 1; k < state.players.length; k++) q.push((pi + k) % state.players.length);
    knightAttackEnter(state, pi, sourceCard, q);
  }
  function knightAttackEnter(state, source, sourceCard, queue) {
    queue = (queue || []).filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'knight', stage: 'react', player: victim, source, sourceCard, victim, queue: rest };
    } else {
      knightReveal(state, source, sourceCard, victim, rest);
    }
  }
  function knightReveal(state, source, sourceCard, victim, queue) {
    const v = state.players[victim];
    const revealed = [];
    for (let i = 0; i < 2; i++) { if (v.deck.length === 0) { if (v.discard.length === 0) break; reshuffleDeck(v); } if (v.deck.length === 0) break; revealed.push(v.deck.shift()); }
    if (revealed.length) reveal(state, victim, revealed, '騎士で山札の上を公開');
    const trashable = revealed.filter((c) => { const cc = cardCost(state, c); return cc >= 3 && cc <= 6 && potionCost(c) === 0; });
    if (trashable.length === 0) {
      revealed.forEach((c) => v.discard.push(c));
      if (revealed.length) log(state, `${v.name} は公開した ${revealed.length}枚 を捨てた（騎士）。`);
      knightAttackEnter(state, source, sourceCard, queue);
    } else if (trashable.length === 1) {
      knightDoTrash(state, source, sourceCard, victim, revealed, trashable[0], queue);
    } else {
      state.pending = { type: 'knight', stage: 'pick', player: victim, source, sourceCard, victim, revealed, trashable, queue };
    }
  }
  function knightDoTrash(state, source, sourceCard, victim, revealed, card, queue) {
    const v = state.players[victim];
    const rest = revealed.slice(); removeOne(rest, card);
    const wasKnight = DOM.isType(card, 'knight');
    trashCard(state, victim, card); // 被害者の廃棄（城塞/封土/騎士の on-trash も発動）
    rest.forEach((c) => v.discard.push(c));
    log(state, `${v.name} は騎士で「${C()[card].name}」を廃棄した。`);
    // 廃棄されたのが騎士なら、攻撃した騎士も廃棄（場にあれば。sir_vander なら on-trash で金貨）
    if (wasKnight && removeOne(state.players[source].inPlay, sourceCard)) {
      trashCard(state, source, sourceCard);
      log(state, `${state.players[source].name} の「${C()[sourceCard].name}」も廃棄された（騎士同士）。`);
    }
    knightAttackEnter(state, source, sourceCard, queue);
  }

  /* ---------- 錬金術：使い魔（魔女と同型。各相手が呪いを獲得）---------- */
  function familiarEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v)); // 灯台：免疫の被害者は対象外
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'familiar', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      familiarCurse(state, source, victim, rest);
    }
  }
  function familiarCurse(state, source, victim, queue) {
    if ((state.supply.curse || 0) > 0) {
      gain(state, victim, 'curse', 'discard');
      log(state, `${state.players[victim].name} は呪いを獲得した（使い魔）。`);
    }
    familiarEnterVictim(state, source, queue);
  }

  /* ---------- 錬金術：念視の泉（全員の山札の上を公開、使用者が捨てる/戻すを決める。
     その後、使用者はアクション以外が出るまで山札を公開して全て手札に加える）---------- */
  function scryingEnterTarget(state, attacker, queue) {
    while (queue && queue.length) {
      const target = queue[0];
      if (target !== attacker) { // 相手はアタック（灯台免疫・堀リアクション）
        if (attackImmune(state, target)) { queue = queue.slice(1); continue; }
        if (hasReaction(state.players[target])) {
          state.pending = { type: 'scrying_pool', stage: 'react', player: target, source: attacker, victim: target, queue: queue.slice(1) };
          return;
        }
      }
      scryingReveal(state, attacker, target, queue.slice(1));
      return;
    }
    scryingDraw(state, attacker); // 全員終わったら使用者の連続公開ドロー
  }
  function scryingReveal(state, attacker, target, queue) {
    const tp = state.players[target];
    if (tp.deck.length === 0 && tp.discard.length > 0) { reshuffleDeck(tp); }
    if (tp.deck.length === 0) { scryingEnterTarget(state, attacker, queue); return; } // 公開できる札なし
    reveal(state, target, [tp.deck[0]], '念視の泉で山札の上を公開');
    state.pending = { type: 'scrying_pool', stage: 'decide', player: attacker, source: attacker, victim: target, card: tp.deck[0], queue };
  }
  function scryingDraw(state, attacker) {
    const ap = state.players[attacker];
    const taken = [];
    let guard = 0;
    while (guard++ < 100) {
      if (ap.deck.length === 0) { if (ap.discard.length === 0) break; reshuffleDeck(ap); }
      if (ap.deck.length === 0) break;
      const c = ap.deck.shift();
      taken.push(c); ap.hand.push(c);
      if (!DOM.isType(c, 'action')) break; // アクション以外が出たら止める（それも手札に加わる）
    }
    if (taken.length) { reveal(state, attacker, taken, '念視の泉で公開'); log(state, `${ap.name} は念視の泉でアクション以外が出るまで公開し、${taken.length}枚を手札に加えた。`); }
    state.pending = null;
  }

  /* ---------- 錬金術：ゴーレム（見つけた2枚のアクションを好きな順で使う）----------
     first を即 applyEffect、second は玉座と同じ replay キューへ（pending 解消後に runReplays）。*/
  function golemPlay(state, pi, first, second) {
    const p = state.players[pi];
    state.pending = null;
    if (second != null) { state.replay = state.replay || []; state.replay.push({ player: pi, card: second, label: 'golem' }); }
    p.inPlay.push(first);
    state.turn.actionsPlayed = (state.turn.actionsPlayed || 0) + 1; // 使った扱い（共謀者等の「このターンに使ったアクション数」に数える）
    log(state, `${p.name} はゴーレムで「${C()[first].name}」を使った。`);
    applyEffect(state, first, pi);
  }

  /* ---------- 役人（複数対象。各相手が勝利点1枚を山札の上へ）---------- */
  function bureaucratEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v)); // 灯台：免疫の被害者は対象外
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'bureaucrat', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      bureaucratApply(state, source, victim, rest);
    }
  }
  function bureaucratApply(state, source, victim, queue) {
    const v = state.players[victim];
    const hasVictory = v.hand.some((c) => DOM.isType(c, 'victory'));
    if (hasVictory) {
      // どの勝利点を山札の上に置くか犠牲者が選ぶ
      state.pending = { type: 'bureaucrat', stage: 'put', player: victim, source, victim, queue };
    } else {
      log(state, `${v.name} は勝利点を持っておらず手札を公開した（役人）。`);
      reveal(state, victim, v.hand, '役人：勝利点なしの手札を公開');
      bureaucratEnterVictim(state, source, queue);
    }
  }

  /* ---------- 山賊（複数対象。各相手が上2枚公開→銅貨以外の財宝1枚を廃棄）---------- */
  function banditEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v)); // 灯台：免疫の被害者は対象外
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'bandit', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      banditReveal(state, source, victim, rest);
    }
  }
  function banditReveal(state, source, victim, queue) {
    const v = state.players[victim];
    const revealed = [];
    for (let i = 0; i < 2; i++) {
      if (v.deck.length === 0) { if (v.discard.length === 0) break; reshuffleDeck(v); }
      if (v.deck.length === 0) break;
      revealed.push(v.deck.shift());
    }
    if (revealed.length) reveal(state, victim, revealed, '山賊で山札の上を公開');
    const cands = revealed.filter((c) => isTreasureFor(state, c) && c !== 'copper');
    if (cands.length >= 2 && cands[0] !== cands[1]) {
      // 異なる財宝が2枚 → 犠牲者がどちらを廃棄するか選ぶ
      state.pending = { type: 'bandit', stage: 'pick', player: victim, source, victim, revealed, cands, queue };
    } else if (cands.length >= 1) {
      const trashed = cands[0];
      removeOne(revealed, trashed);
      trashCard(state, victim, trashed);
      log(state, `${v.name} は「${C()[trashed].name}」を廃棄した（山賊）。`);
      revealed.forEach((c) => v.discard.push(c));
      banditEnterVictim(state, source, queue);
    } else {
      revealed.forEach((c) => v.discard.push(c));
      if (revealed.length) log(state, `${v.name} は廃棄できる財宝がなく、公開札を捨てた（山賊）。`);
      banditEnterVictim(state, source, queue);
    }
  }

  /* ========== 移動動物園：アタック3種（黒猫／枢機卿／魔女の集会）========== */
  // 黒猫＝**自分のターンでないときに使った場合だけ**、他の全員が呪いを獲得（魔女と同型）。
  //   使用者以外の全員が対象＝手番プレイヤーも受ける。配る順はターンプレイヤーから（applyEffect 側でキューを作る）。
  function blackCatEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) state.pending = { type: 'black_cat', stage: 'react', player: victim, source, victim, queue: rest };
    else blackCatCurse(state, source, victim, rest);
  }
  function blackCatCurse(state, source, victim, queue) {
    if ((state.supply.curse || 0) > 0) {
      if (gain(state, victim, 'curse', 'discard')) log(state, `${state.players[victim].name} は黒猫で呪いを獲得した。`);
    }
    blackCatEnterVictim(state, source, queue);
  }
  // 枢機卿＝各相手が山札の上2枚を公開し、コスト$3〜$6 の1枚を**追放**して残りを捨てる（選ぶのは被害者）。
  //   追放はサプライからではなく「公開したその札」なので、追放マットへ直接置く（獲得ではない）。
  function cardinalEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) state.pending = { type: 'cardinal', stage: 'react', player: victim, source, victim, queue: rest };
    else cardinalReveal(state, source, victim, rest);
  }
  // 枢機卿の「$3〜$6」＝コイン成分だけで見る（ポーション費用・負債コストの札は範囲に含めない＝成分別比較）。
  function cardinalRange(state, id) {
    const c = costOf(state, id);
    return c.pot === 0 && c.debt === 0 && c.coin >= 3 && c.coin <= 6;
  }
  function cardinalReveal(state, source, victim, queue) {
    const v = state.players[victim];
    const revealed = [];
    for (let i = 0; i < 2; i++) {
      if (v.deck.length === 0) { if (v.discard.length === 0) break; reshuffleDeck(v); }
      if (v.deck.length === 0) break;
      revealed.push(v.deck.shift());
    }
    if (revealed.length) reveal(state, victim, revealed, '枢機卿で山札の上を公開');
    const cands = revealed.filter((c) => cardinalRange(state, c));
    if (cands.length >= 2 && cands[0] !== cands[1]) {
      state.pending = { type: 'cardinal', stage: 'pick', player: victim, source, victim, revealed, cands, queue };
    } else if (cands.length >= 1) {
      cardinalFinish(state, source, victim, revealed, cands[0], queue);
    } else {
      revealed.forEach((c) => v.discard.push(c));
      if (revealed.length) { triggerOnDiscard(state, victim, revealed.slice()); }
      cardinalEnterVictim(state, source, queue);
    }
  }
  function cardinalFinish(state, source, victim, revealed, exileId, queue) {
    const v = state.players[victim];
    if (removeOne(revealed, exileId)) {
      (v.exile = v.exile || []).push(exileId);
      log(state, `${v.name} は「${C()[exileId].name}」を追放した（枢機卿）。`);
    }
    revealed.forEach((c) => v.discard.push(c));
    // 残りを捨てる＝本物の「捨てる」＝坑道/村有緑地が誘発する（公式ルールブックが村有緑地の例として枢機卿を挙げている）。
    if (revealed.length) triggerOnDiscard(state, victim, revealed.slice());
    cardinalEnterVictim(state, source, queue);
  }
  // 魔女の集会＝各相手はサプライから呪い1枚を追放する。できない（呪いの山が空）場合、
  //   そのプレイヤーは**自分の追放マットの呪いをすべて捨て札にする**（選択なし＝自動）。
  function covenEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) state.pending = { type: 'coven', stage: 'react', player: victim, source, victim, queue: rest };
    else covenApply(state, source, victim, rest);
  }
  function covenApply(state, source, victim, queue) {
    if (!exileFromSupply(state, victim, 'curse')) discardFromExile(state, victim, 'curse', null);
    covenEnterVictim(state, source, queue);
  }
  // 門番＝持続アタック。相手の「獲得」をフックする（沼の妖婆＝購入フック と同型の予約＋rid）。
  function gatekeeperEnterVictim(state, source, queue, rid) {
    if (!queue || !queue.length) { state.pending = null; return; }
    lingerAttackEnter(state, source, 'gatekeeper', queue, rid);
  }

  /* ========== 移動動物園：習性（Way）＝アクションの「記載効果の代わり」に使う ==========
     - 「これ」＝習性を使ったそのカード（場にある）。**区切り線の下のテキスト（獲得時/廃棄時/準備）は影響を受けない**。
     - チャンピオンの +1アクション・冒険の山トークン・山砦などライン下の外部能力は普通に働く
       （PLAY_ACTION 側で先に処理済み＝公式）。
     - 玉座の間などで複数回プレイするとき、公式は「各プレイごとに習性を使うか選べる」が、
       このエンジンの再演（state.replay）は記載効果で解決する＝**再演では習性を選び直せない**（許容簡略化）。 */
  function applyWay(state, wayId, card, pi) {
    const t = state.turn, p = state.players[pi];
    switch (wayId) {
      // チョウ＝これをその山に戻してもよい。そうしたら ちょうど1コイン高いカード1枚を獲得する。
      case 'way_of_the_butterfly':
        if (p.inPlay.indexOf(card) >= 0 && Object.prototype.hasOwnProperty.call(state.supply, pileKeyOf(state, card))) {
          state.pending = { type: 'way_butterfly', player: pi, card };
        }
        break;
      // ラクダ＝サプライから金貨1枚を追放する。
      case 'way_of_the_camel':
        exileFromSupply(state, pi, 'gold');
        break;
      // カメレオン＝このカードの指示に従うが、このターン「+カード」と「+コイン」を入れ替える。
      //   ※選択待ちを挟むカードでは、解決が中断したぶんの入れ替えは効かない（許容簡略化）。
      case 'way_of_the_chameleon':
        t.chameleon = true;
        try { applyEffect(state, card, pi); } finally { t.chameleon = false; }
        break;
      // カエル＝+1アクション。このターン、これを場から捨てるとき山札の上に置く。
      case 'way_of_the_frog':
        addActions(t, 1);
        (t.frogTopdeck = t.frogTopdeck || []).push(card);
        break;
      // ヤギ＝手札から1枚を廃棄する（強制）。
      case 'way_of_the_goat':
        if (p.hand.length > 0) state.pending = { type: 'way_goat_trash', player: pi };
        break;
      // 馬＝+2カード +1アクション、これをその山に戻す（馬カードと同じ挙動）。
      case 'way_of_the_horse':
        draw(state, pi, 2); addActions(t, 1);
        if (takeSelf(state, pi, card)) { returnToPile(state, card); log(state, `${p.name} は「${C()[card].name}」をその山に戻した（馬の習性）。`); }
        break;
      // モグラ＝+1アクション、手札をすべて捨てて +3カード。
      case 'way_of_the_mole': {
        addActions(t, 1);
        const dumped = p.hand.slice(); p.hand = [];
        dumped.forEach((c) => p.discard.push(c));
        if (dumped.length) triggerOnDiscard(state, pi, dumped.slice());
        draw(state, pi, 3);
        break;
      }
      case 'way_of_the_monkey': t.buys += 1; addCoins(state, 1); break;
      // ハツカネズミ＝脇に置いてあるカードを使用する（そのカードは脇に置いたまま＝命令と同じ扱い）。
      case 'way_of_the_mouse':
        if (state.mouseCard) {
          log(state, `${p.name} はハツカネズミの習性で「${C()[state.mouseCard].name}」を使用する（脇に置いたまま）。`);
          playAsCommand(state, pi, card, state.mouseCard);
        }
        break;
      case 'way_of_the_mule': addActions(t, 1); addCoins(state, 1); break;
      case 'way_of_the_otter': draw(state, pi, 2); break;
      case 'way_of_the_owl': if (p.hand.length < 6) draw(state, pi, 6 - p.hand.length); break;
      case 'way_of_the_ox': addActions(t, 2); break;
      case 'way_of_the_pig': draw(state, pi, 1); addActions(t, 1); break;
      // ドブネズミ＝財宝1枚を捨て札にしてもよい。そうしたら これと同じカード1枚を獲得する。
      case 'way_of_the_rat':
        if (p.hand.some((c) => isTreasureFor(state, c)) && gainableBase(state, card)) {
          state.pending = { type: 'way_rat_discard', player: pi, card };
        }
        break;
      // アザラシ＝+$1。このターン、カードを獲得したとき それを山札の上に置いてもよい。
      case 'way_of_the_seal':
        addCoins(state, 1);
        t.sealActive = true;
        break;
      case 'way_of_the_sheep': addCoins(state, 2); break;
      // リス＝このターンの終了時（次の手札を引いた後）に +2カード。
      case 'way_of_the_squirrel':
        t.squirrelDraw = (t.squirrelDraw || 0) + 2;
        break;
      // ウミガメ＝これを脇に置く。置けたら次のターンの開始時にそれを使用する。
      case 'way_of_the_turtle':
        if (removeOne(p.inPlay, card)) {
          p.setAside.push(card);
          armDuration(state, pi, 'way_turtle', { setAsideCard: card });
          log(state, `${p.name} は「${C()[card].name}」を脇に置いた（次のターンの開始時に使用）。`);
        }
        break;
      // ミミズ＝サプライの屋敷1枚を追放する。
      case 'way_of_the_worm':
        exileFromSupply(state, pi, 'estate');
        break;
      default: break;
    }
  }
  // その対局で習性が使えるか（engine拒否・CPU非提案・UI表示が同じ述語を見る）。
  function isUsableWay(state, wayId) {
    return !!(wayId && Array.isArray(state.ways) && state.ways.indexOf(wayId) >= 0 &&
      DOM.LANDSCAPES && DOM.LANDSCAPES[wayId] && DOM.LANDSCAPES[wayId].kind === 'way');
  }

  /* ---------- 身代わり（勝利点を獲得したとき他全員が呪いを獲得＝アタック）---------- */
  function replaceEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v)); // 灯台：免疫の被害者は対象外
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'replace', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      replaceCurse(state, source, victim, rest);
    }
  }
  function replaceCurse(state, source, victim, queue) {
    if ((state.supply.curse || 0) > 0) {
      gain(state, victim, 'curse', 'discard');
      log(state, `${state.players[victim].name} は呪いを獲得した（身代わり）。`);
    }
    replaceEnterVictim(state, source, queue);
  }

  /* ---------- 海辺：巾着切り（各相手が銅貨1枚を捨てる／無ければ手札公開）---------- */
  function cutpurseEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'cutpurse', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      cutpurseApply(state, source, victim, rest);
    }
  }
  function cutpurseApply(state, source, victim, queue) {
    const v = state.players[victim];
    if (v.hand.includes('copper')) { removeOne(v.hand, 'copper'); v.discard.push('copper'); log(state, `${v.name} は銅貨1枚を捨てた（巾着切り）。`); }
    else { reveal(state, victim, v.hand, '巾着切り：銅貨なしの手札を公開'); log(state, `${v.name} は銅貨がなく手札を公開した（巾着切り）。`); }
    cutpurseEnterVictim(state, source, queue);
  }

  /* ---------- 海辺：海の魔女（各相手が呪いを獲得＝魔女と同型）---------- */
  function seaWitchEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'sea_witch', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      seaWitchCurse(state, source, victim, rest);
    }
  }
  function seaWitchCurse(state, source, victim, queue) {
    if ((state.supply.curse || 0) > 0) { gain(state, victim, 'curse', 'discard'); log(state, `${state.players[victim].name} は呪いを獲得した（海の魔女）。`); }
    seaWitchEnterVictim(state, source, queue);
  }

  /* ---------- 海辺：封鎖のアタック（プレイ時に相手へ「堀で免疫」窓を出す）----------
     封鎖はアタックカード。プレイ時に各相手へ反応窓を与え、堀を公開した相手は
     この封鎖の呪い窓（他人が同名を獲得→呪い）から免疫になる（source の封鎖予約の immune に登録）。
     灯台で免疫の相手は反応不要で即免疫。反応札を持たない相手はそのまま（免疫なし）。*/
  function markBlockadeImmune(state, source, gained, victim) {
    const e = (state.players[source].delayedEffects || [])
      .find((x) => x.type === 'blockade' && x.gained === gained);
    if (e) { e.immune = e.immune || []; if (!e.immune.includes(victim)) e.immune.push(victim); }
  }
  /* ========== 冒険：呪いの森/沼の妖婆＝「相手の購入をフックする持続アタック」 ==========
     プレイ時に即効果は無い（+3カード/+$3 は次の自分の手番）。次の自分の手番まで、他Pが購入するたびに発動。
     免疫は「プレイ時」に確定＝champion/灯台の受動免疫と、堀を公開した相手を予約(delayedEffects)の immune に記録し、
     BUY 側フック(applyLingerOnBuy)がその相手を飛ばす（封鎖と同型）。 */
  // 免疫は「この予約(rid)ひとつ」だけに付ける（玉座/王の宮廷で同型の予約が複数並ぶとき、堀を公開した窓の予約だけを免疫に）。
  //   ＝封鎖が gained で予約を区別するのと同型。全予約を走査すると『受けた予約まで遡って免疫』になる過剰付与バグを防ぐ。
  function markLingerImmune(state, source, card, victim, rid) {
    const e = (state.players[source].delayedEffects || []).find((x) => x.type === card && x.rid === rid);
    if (e) { e.immune = e.immune || []; if (!e.immune.includes(victim)) e.immune.push(victim); }
  }
  function lingerAttackEnter(state, source, card, queue, rid) {
    queue = (queue || []).slice();
    while (queue.length) {
      const victim = queue[0];
      if (attackImmune(state, victim)) { markLingerImmune(state, source, card, victim, rid); queue.shift(); continue; }
      if (hasReaction(state.players[victim])) {
        state.pending = { type: card, stage: 'react', player: victim, source, victim, queue: queue.slice(1), rid };
        return;
      }
      queue.shift(); // 反応札なし＝即効果は無い（免疫も付かない）
    }
    state.pending = null;
  }
  // 帝国：女魔術師（enchantress・アタック持続）＝免疫でない各相手に enchanted フラグを立てる
  //   （その手番で最初にプレイするアクションが +1カード+1アクション に置換される）。堀で防げる。
  function enchantressEnterVictim(state, source, queue) {
    queue = (queue || []).slice();
    while (queue.length) {
      const victim = queue[0];
      if (attackImmune(state, victim)) { queue.shift(); continue; } // 灯台/チャンピオン＝免疫（置換されない）
      if (hasReaction(state.players[victim])) {
        state.pending = { type: 'enchantress', stage: 'react', player: victim, source, victim, queue: queue.slice(1) };
        return;
      }
      state.players[victim].enchanted = true;
      queue.shift();
    }
    state.pending = null;
  }
  /* ===== 帝国 Batch E4：分割山カードの共通ヘルパ ===== */
  // 陣地：金貨/鹵獲品を公開しなかった陣地を場から脇へ（片付けで自分の分割山へ戻す）。玉座の2回目は場に無く不発（lose track）。
  function encampmentSetAside(state, pi) {
    const p = state.players[pi];
    if (takeSelf(state, pi, 'encampment')) {
      p.setAside.push('encampment');
      state.turn.encampmentReturn = (state.turn.encampmentReturn || 0) + 1;
      log(state, `${p.name} は陣地を脇に置いた（片付けで分割山に戻る）。`);
    }
  }
  // 投石機：廃棄カードの条件で 各相手に 呪い（コスト3以上）と 手札3枚まで捨て（財宝）を与える（アタック・堀で両方防げる）。
  function catapultEnterVictim(state, source, queue, giveCurse, treasureDiscard, discardQ) {
    discardQ = discardQ || [];
    queue = (queue || []).slice();
    while (queue.length) {
      const victim = queue[0];
      if (attackImmune(state, victim)) { queue.shift(); continue; }
      if (hasReaction(state.players[victim])) {
        state.pending = { type: 'catapult', stage: 'react', player: victim, source, victim, queue: queue.slice(1), giveCurse, treasureDiscard, discardQ };
        return;
      }
      if (giveCurse && (state.supply.curse || 0) > 0 && gain(state, victim, 'curse', 'discard')) log(state, `${state.players[victim].name} は投石機で呪い1枚を獲得した。`);
      if (treasureDiscard) discardQ.push(victim);
      queue.shift();
    }
    // 全員の反応窓が済んだ → 財宝だったなら手札3枚まで捨てさせる（手札4枚以上のみ）。
    const dd = treasureDiscard ? discardQ.filter((v) => state.players[v].hand.length > 3) : [];
    if (dd.length) discardDownEnter(state, source, 3, dd);
    else state.pending = null;
  }
  // 剣闘士：公開したカードを左隣が同名で公開できるか。公開できない/しなければ owner に +$1＋サプライから剣闘士1枚廃棄。
  function gladiatorLeftMatch(state, source, card) {
    const n = state.players.length, left = (source + 1) % n;
    if (card != null && n > 1 && state.players[left].hand.includes(card)) {
      state.pending = { type: 'gladiator', stage: 'match', player: left, source, card };
      return;
    }
    gladiatorBonus(state, source);
  }
  function gladiatorBonus(state, source) {
    addCoins(state, 1);
    if ((state.supply.gladiator || 0) > 0) { trashFromSupplyPile(state, source, 'gladiator'); log(state, `${state.players[source].name} は剣闘士で +$1、サプライから剣闘士1枚を廃棄した。`); }
    else log(state, `${state.players[source].name} は剣闘士で +$1（サプライに剣闘士なし）。`);
    state.pending = null;
  }
  // 石：獲得/廃棄したとき銀貨1枚を獲得（owner の購入フェイズ中なら山札の上、そうでなければ手札）。
  function rocksGainSilver(state, pi) {
    const t = state.turn;
    const dest = (t && t.active === pi && t.phase === 'buy') ? 'deck' : 'hand';
    if (gain(state, pi, 'silver', dest)) log(state, `${state.players[pi].name} は石で銀貨を${dest === 'deck' ? '山札の上に' : '手札に'}獲得した。`);
  }
  // 購入時フック：buyer 以外のプレイヤーの有効な呪いの森/沼の妖婆の予約を発火（免疫でない buyer に）。
  function applyLingerOnBuy(state, buyer) {
    const n = state.players.length;
    for (let o = 0; o < n; o++) {
      if (o === buyer) continue;
      const effs = state.players[o].delayedEffects || [];
      // 沼の妖婆：予約1つにつき呪い1枚（玉座で2枚＝2回獲得）。
      effs.forEach((e) => {
        if (e.type === 'swamp_hag' && !(e.immune || []).includes(buyer) && (state.supply.curse || 0) > 0) {
          if (gain(state, buyer, 'curse', 'discard')) log(state, `${state.players[buyer].name} は購入で呪い1枚を獲得した（沼の妖婆）。`);
        }
      });
      // 呪いの森：有効な予約が1つでもあれば手札を全て山札の上へ（重複は無意味＝1回）。
      const hw = effs.some((e) => e.type === 'haunted_woods' && !(e.immune || []).includes(buyer));
      const bp = state.players[buyer];
      if (hw && bp.hand.length) {
        const hand = bp.hand.slice(); bp.hand = [];
        for (let i = hand.length - 1; i >= 0; i--) bp.deck.unshift(hand[i]); // 手札の順のまま山札の上へ
        log(state, `${bp.name} は購入で手札 ${hand.length}枚 を山札の上に置いた（呪いの森）。`);
      }
    }
  }
  // 冒険：語り部＝選んだ財宝を順にプレイし（pending を立てる財宝＝遺物/法貨等は中断→解決後に reduce 末尾が再開）、
  //   全て出し終えたら所持コインを全てカードに変換する（+1カード/$1・コインを0に）。t.storytellerResume.queue が残財宝。
  function storytellerStep(state, pi) {
    const t = state.turn;
    const r = t && t.storytellerResume;
    if (!r || r.player !== pi) return;
    while (r.queue.length) {
      const c = r.queue.shift();
      if (state.players[pi].hand.indexOf(c) < 0) continue; // 保険：既に手札に無い
      playTreasureCard(state, pi, c);
      if (state.pending) return; // 財宝が選択待ちを立てた＝中断（reduce 末尾の安全網が解決後に再開）
    }
    // 全て出し終えた → +1カード（2022エラッタの基本ドロー）＋所持コインを全てカードに変換（コインを使い切る）。
    const coins = t.coins || 0;
    t.storytellerResume = null;
    draw(state, pi, 1 + coins); t.coins = 0;
    log(state, `${state.players[pi].name} は語り部で +${1 + coins}カード（基本+1＋所持コイン$${coins}）。`);
  }
  function blockadeEnterVictim(state, source, queue, gained) {
    queue = (queue || []).slice();
    while (queue.length) {
      const victim = queue[0];
      if (attackImmune(state, victim)) { markBlockadeImmune(state, source, gained, victim); queue.shift(); continue; }
      if (hasReaction(state.players[victim])) {
        state.pending = { type: 'blockade', stage: 'react', player: victim, source, victim, gained, queue: queue.slice(1) };
        return;
      }
      queue.shift(); // 反応札なし＝そのまま（免疫は付かない）
    }
    state.pending = null;
  }

  /* ---------- 繁栄：ペテン師（各相手が銅貨1枚を獲得）---------- */
  function charlatanEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'charlatan', stage: 'react', player: victim, source, victim, queue: rest };
    } else { charlatanApply(state, source, victim, rest); }
  }
  function charlatanApply(state, source, victim, queue) {
    if ((state.supply.copper || 0) > 0) { gain(state, victim, 'copper', 'discard'); log(state, `${state.players[victim].name} は銅貨1枚を獲得した（ペテン師）。`); }
    charlatanEnterVictim(state, source, queue);
  }

  /* ---------- ギルド：収税吏のアタック（他の各自[手札5枚以上]が、廃棄された財宝と同名を1枚捨てる）---------- */
  function taxmanEnterVictim(state, source, queue, trashedName) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v)); // 灯台：免疫の被害者は対象外
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'taxman', stage: 'react', player: victim, source, victim, queue: rest, trashedName };
    } else {
      taxmanApply(state, source, victim, rest, trashedName);
    }
  }
  function taxmanApply(state, source, victim, queue, trashedName) {
    const v = state.players[victim];
    // 手札5枚以上の相手のみ影響を受ける（公式）。
    if (v.hand.length >= 5) {
      if (v.hand.includes(trashedName)) {
        removeOne(v.hand, trashedName); v.discard.push(trashedName);
        log(state, `${v.name} は「${C()[trashedName].name}」を1枚捨てた（収税吏）。`);
      } else {
        reveal(state, victim, v.hand, '収税吏：同名の財宝なしの手札を公開');
        log(state, `${v.name} は「${C()[trashedName].name}」を持っておらず手札を公開した（収税吏）。`);
      }
    }
    taxmanEnterVictim(state, source, queue, trashedName);
  }

  /* ---------- ギルド：予言者のアタック（各相手が呪いを獲得→獲得したら+1カード）---------- */
  function soothsayerEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v)); // 灯台：免疫の被害者は対象外
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'soothsayer', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      soothsayerCurse(state, source, victim, rest);
    }
  }
  function soothsayerCurse(state, source, victim, queue) {
    if ((state.supply.curse || 0) > 0) {
      if (gain(state, victim, 'curse', 'discard')) {
        draw(state, victim, 1); // 呪いを獲得したなら+1カード
        log(state, `${state.players[victim].name} は呪いを獲得し、+1カードした（予言者）。`);
      }
    }
    soothsayerEnterVictim(state, source, queue);
  }

  /* ============================================================
     異郷（Hinterlands）：アタック各種（すべて witch 型の EnterVictim/Apply/REACT ＋ ATTACKS 登録）
     ============================================================ */
  // 辺境伯：+3カード +1購入（applyEffect）。各相手は +1カード → 手札3枚まで捨てる。
  function margraveEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'margrave', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      margraveApply(state, source, victim, rest);
    }
  }
  function margraveApply(state, source, victim, queue) {
    const v = state.players[victim];
    draw(state, victim, 1);
    log(state, `${v.name} は +1カード（辺境伯）。`);
    if (v.hand.length > 3) {
      state.pending = { type: 'margrave', stage: 'discard', player: victim, source, victim, queue };
    } else {
      margraveEnterVictim(state, source, queue);
    }
  }

  // 神託：各プレイヤー（使用者含む）の山札上2枚を公開し、使用者が「捨てる/好きな順で山札上に戻す」を決める。全員後 +2カード。
  function oracleEnterTarget(state, attacker, queue) {
    while (queue && queue.length) {
      const target = queue[0], rest = queue.slice(1);
      if (target !== attacker) { // 相手はアタック（灯台免疫・堀リアクション）
        if (attackImmune(state, target)) { queue = rest; continue; }
        if (hasReaction(state.players[target])) {
          state.pending = { type: 'oracle', stage: 'react', player: target, source: attacker, victim: target, queue: rest };
          return;
        }
      }
      oracleReveal(state, attacker, target, rest);
      return;
    }
    draw(state, attacker, 2); // 全員終わったら使用者 +2カード
    log(state, `${state.players[attacker].name} は神託で +2カード。`);
    state.pending = null;
  }
  function oracleReveal(state, attacker, target, queue) {
    const tp = state.players[target];
    const look = [];
    for (let i = 0; i < 2; i++) {
      if (tp.deck.length === 0) { if (tp.discard.length === 0) break; reshuffleDeck(tp); }
      if (tp.deck.length === 0) break;
      look.push(tp.deck.shift());
    }
    if (!look.length) { oracleEnterTarget(state, attacker, queue); return; } // 公開できる札なし
    reveal(state, target, look, '神託で山札の上2枚を公開');
    state.pending = { type: 'oracle', stage: 'decide', player: attacker, source: attacker, victim: target, cards: look, queue };
  }

  // 高貴な山賊：各相手は山札上2枚を公開。使用者が公開された銀貨/金貨1枚を廃棄して獲得、残りは捨てる。
  //   財宝(銀/金)を1枚も公開しなかった相手は銅貨1枚を獲得。（プレイ時＝+1コイン、購入時にも発動）
  function nobleBrigandAttack(state, source) {
    const q = [];
    for (let k = 1; k < state.players.length; k++) q.push((source + k) % state.players.length);
    nobleBrigandEnterVictim(state, source, q);
  }
  function nobleBrigandEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'noble_brigand', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      nobleBrigandReveal(state, source, victim, rest);
    }
  }
  function nobleBrigandReveal(state, source, victim, queue) {
    const v = state.players[victim];
    const revealed = [];
    for (let i = 0; i < 2; i++) {
      if (v.deck.length === 0) { if (v.discard.length === 0) break; reshuffleDeck(v); }
      if (v.deck.length === 0) break;
      revealed.push(v.deck.shift());
    }
    if (revealed.length) reveal(state, victim, revealed, '高貴な山賊で山札の上を公開');
    const cands = revealed.filter((c) => c === 'silver' || c === 'gold');
    if (cands.length >= 2 && cands[0] !== cands[1]) {
      state.pending = { type: 'noble_brigand', stage: 'pick', player: source, source, victim, revealed, queue };
    } else {
      nobleBrigandResolve(state, source, victim, revealed, cands[0] || null, queue);
    }
  }
  function nobleBrigandResolve(state, source, victim, revealed, trashed, queue) {
    const v = state.players[victim];
    const rest = revealed.slice();
    if (trashed) {
      removeOne(rest, trashed);
      // 廃棄された財宝は使用者が現物を獲得する（サプライは変えない＝廃棄→回収の合成）。
      state.players[source].discard.push(trashed);
      log(state, `${state.players[source].name} は ${v.name} の「${C()[trashed].name}」を廃棄して獲得した（高貴な山賊）。`);
    }
    rest.forEach((c) => v.discard.push(c));
    const hadTreasure = revealed.some((c) => c === 'silver' || c === 'gold');
    if (revealed.length && !hadTreasure) {
      if (gain(state, victim, 'copper', 'discard')) log(state, `${v.name} は財宝を公開せず銅貨1枚を獲得した（高貴な山賊）。`);
    }
    nobleBrigandEnterVictim(state, source, queue);
  }

  // 狂戦士：各相手は手札3枚まで捨てる（獲得＋攻撃は applyEffect / BERSERKER_GAIN 側で先行）。
  function berserkerEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'berserker', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      berserkerApply(state, source, victim, rest);
    }
  }
  function berserkerApply(state, source, victim, queue) {
    const v = state.players[victim];
    if (v.hand.length > 3) {
      state.pending = { type: 'berserker', stage: 'discard', player: victim, source, victim, queue };
    } else {
      berserkerEnterVictim(state, source, queue);
    }
  }
  function berserkerLaunchAttack(state, source) {
    const q = [];
    for (let k = 1; k < state.players.length; k++) q.push((source + k) % state.players.length);
    berserkerEnterVictim(state, source, q);
  }

  // 魔女の小屋：使用者が公開して捨てた手札2枚が両方アクションなら、各相手が呪いを獲得。
  function witchsHutEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'witchs_hut', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      witchsHutCurse(state, source, victim, rest);
    }
  }
  function witchsHutCurse(state, source, victim, queue) {
    if ((state.supply.curse || 0) > 0) {
      gain(state, victim, 'curse', 'discard');
      log(state, `${state.players[victim].name} は呪いを獲得した（魔女の小屋）。`);
    }
    witchsHutEnterVictim(state, source, queue);
  }

  // 大釜：このターン3回目のアクション獲得で、各相手が呪いを獲得（大釜が場にある間）。
  function cauldronEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'cauldron', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      cauldronCurse(state, source, victim, rest);
    }
  }
  function cauldronCurse(state, source, victim, queue) {
    if ((state.supply.curse || 0) > 0) {
      gain(state, victim, 'curse', 'discard');
      log(state, `${state.players[victim].name} は呪いを獲得した（大釜）。`);
    }
    cauldronEnterVictim(state, source, queue);
  }

  // 愚者の黄金：他プレイヤーが属州を獲得したとき、手札の愚者の黄金を廃棄して金貨を山札の上に獲得してよい（手番順に反応窓）。
  function foolsGoldReactWindow(state, gainerIndex) {
    const n = state.players.length;
    const start = (state.turn && state.turn.active != null) ? state.turn.active : gainerIndex;
    const queue = [];
    for (let k = 0; k < n; k++) {
      const seat = (start + k) % n;
      if (seat !== gainerIndex && state.players[seat].hand.includes('fools_gold')) queue.push(seat);
    }
    if (queue.length) foolsGoldReactEnter(state, queue);
  }
  function foolsGoldReactEnter(state, queue) {
    queue = (queue || []).slice();
    while (queue.length && !state.players[queue[0]].hand.includes('fools_gold')) queue.shift();
    if (!queue.length) { state.pending = null; return; }
    state.pending = { type: 'fools_gold_react', player: queue[0], queue: queue.slice(1) };
  }

  // 公爵夫人：各プレイヤー（あなたを含む）が自分の山札の一番上を見て、捨ててよい（アタックではない＝手番順の窓）。
  function duchessEnter(state, queue) {
    queue = (queue || []).slice();
    while (queue.length) {
      const seat = queue[0], rest = queue.slice(1);
      const sp = state.players[seat];
      if (sp.deck.length === 0 && sp.discard.length === 0) { queue = rest; continue; } // 見る札なし
      state.pending = { type: 'duchess_look', player: seat, queue: rest };
      return;
    }
    state.pending = null;
  }

  // 何でも屋：手札5枚まで引き、財宝でない札があれば任意で1枚廃棄。
  function jackDrawTo5(state, pi) {
    const p = state.players[pi];
    const need = Math.max(0, 5 - p.hand.length);
    if (need) draw(state, pi, need);
    if (p.hand.some((c) => !isTreasureFor(state, c))) state.pending = { type: 'jack', stage: 'trash', player: pi };
    else state.pending = null;
  }
  // 開発：ちょうど +1/-1 コストのカードを（獲得可能なものから）好きな順で山札の上へ。
  //   ポーション費用/負債コストは廃棄した札と一致していること（公式のコスト比較は成分別）。
  function developAdvance(state, pi, hi, lo, hiDone, loDone, pot, debt) {
    const gainable = (c) => c >= 0 && anyGainable(state, (id) => costExact(state, id, c, pot || 0, debt || 0));
    const hiOk = !hiDone && gainable(hi);
    const loOk = !loDone && gainable(lo);
    if (!hiOk && !loOk) { state.pending = null; return; }
    state.pending = { type: 'develop', stage: 'gain', player: pi, hi, lo, hiDone, loDone, pot: pot || 0, debt: debt || 0 };
  }

  /* ---------- 繁栄：群衆（各相手が山札の上3枚を公開→アクション/財宝を捨て、残りを上に戻す）---------- */
  function rabbleEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'rabble', stage: 'react', player: victim, source, victim, queue: rest };
    } else { rabbleApply(state, source, victim, rest); }
  }
  function rabbleApply(state, source, victim, queue) {
    const v = state.players[victim];
    const look = [];
    for (let i = 0; i < 3; i++) {
      if (v.deck.length === 0) { if (v.discard.length === 0) break; reshuffleDeck(v); }
      if (v.deck.length === 0) break;
      look.push(v.deck.shift());
    }
    reveal(state, victim, look, '群衆：山札の上3枚を公開');
    const keep = [];
    look.forEach((c) => {
      if (DOM.isType(c, 'action') || isTreasureFor(state, c)) v.discard.push(c);
      else keep.push(c);
    });
    for (let i = keep.length - 1; i >= 0; i--) v.deck.unshift(keep[i]); // 残りを公開順のまま山札の上へ
    if (look.length) log(state, `${v.name} は群衆で ${look.length}枚を公開し、アクション/財宝を捨てた。`);
    rabbleEnterVictim(state, source, queue);
  }

  /* ---------- 繁栄：会計士（手札5枚以上の各相手が、手札1枚を山札の上に置く）---------- */
  function clerkEnterVictim(state, source, queue) {
    // アタック連鎖の終端では popStartQueue で開始キューを進める（手番開始プレイの会計士が2枚以上ある場合、
    // 1枚目のアタックが pending を立てても2枚目以降が startQueue に取り残されないようにする）。
    // 通常プレイ/玉座経由では startQueue は null のため popStartQueue は pending=null と等価で無害。
    if (!queue || !queue.length) { popStartQueue(state); return; }
    queue = queue.filter((v) => !attackImmune(state, v));
    if (!queue.length) { popStartQueue(state); return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'clerk', stage: 'react', player: victim, source, victim, queue: rest };
    } else { clerkProceed(state, source, victim, rest); }
  }
  // 反応（堀等）を経た後／反応が無いとき：手札5枚以上なら本人が1枚選んで山札の上へ、未満なら飛ばす。
  function clerkProceed(state, source, victim, queue) {
    if (state.players[victim].hand.length >= 5) {
      state.pending = { type: 'clerk', stage: 'topdeck', player: victim, source, victim, queue };
    } else { clerkEnterVictim(state, source, queue); }
  }

  // 繁栄：司教「他プレイヤーは各自 任意で手札1枚を廃棄」を順に処理（手札が無い人は飛ばす）。
  function bishopOthersEnter(state, queue) {
    while (queue && queue.length) {
      const v = queue[0]; queue = queue.slice(1);
      if (state.players[v].hand.length > 0) { state.pending = { type: 'bishop', stage: 'other', player: v, queue }; return; }
    }
    state.pending = null;
  }
  // 繁栄：金庫室「他プレイヤーは各自 任意で手札2枚を捨てて1枚引く」を順に処理（手札2枚未満は飛ばす）。
  function vaultOthersEnter(state, queue) {
    while (queue && queue.length) {
      const v = queue[0]; queue = queue.slice(1);
      if (state.players[v].hand.length >= 2) { state.pending = { type: 'vault', stage: 'other', player: v, queue }; return; }
    }
    state.pending = null;
  }
  // ※「財宝1枚を2回使う」（冠/ティアラ/偽造通貨）の2回目は state.replay の 'treasure_replay' が
  //   applyTreasureEffect を呼ぶ＝カードを動かさず効果だけを完全に再適用する（旧 treasureReplayCoins を置換）。

  /* ---------- 総督（改築モード）：全員が順に「任意で廃棄→ちょうど+$Nを獲得」---------- */
  // queue 要素は { p: 席, delta: 自分=2/他=1 }。手札の無い人は飛ばす。
  function governorEnterRemodel(state, queue) {
    while (queue && queue.length) {
      const cur = queue[0], rest = queue.slice(1);
      if (state.players[cur.p].hand.length > 0) {
        state.pending = { type: 'governor_remodel', stage: 'trash', player: cur.p, delta: cur.delta, queue: rest };
        return;
      }
      queue = rest;
    }
    state.pending = null;
  }

  /* ---------- アクションカードの効果 ---------- */
  /* ============================================================
     収穫祭（Cornucopia）＝機構ヘルパ
     ============================================================ */
  // 山札の上から pred を満たすカードが出るまでめくる（山切れは捨て札をシャッフル）。
  //   返り値 {matched, skipped}: matched=条件を満たしためくり札（無ければ null）、skipped=手前のめくり札列。
  //   めくった札はすべて山札から取り除いて返す（呼び出し側が手札/捨て札/山札上へ振り分ける）。
  function revealFromDeck(state, pi, pred) {
    const p = state.players[pi];
    const skipped = [];
    let matched = null, guard = 0;
    while (guard++ < 300) {
      if (p.deck.length === 0) {
        if (p.discard.length === 0) break;
        reshuffleDeck(p);
      }
      if (p.deck.length === 0) break;
      const c = p.deck.shift();
      if (pred(c)) { matched = c; break; }
      skipped.push(c);
    }
    return { matched, skipped };
  }

  /* ---------- 占い師（アタック：勝利点/呪いが出るまで公開→上に戻し他は捨てる）---------- */
  function fortuneTellerEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'fortune_teller', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      fortuneTellerApply(state, source, victim, rest);
    }
  }
  function fortuneTellerApply(state, source, victim, queue) {
    const v = state.players[victim];
    const { matched, skipped } = revealFromDeck(state, victim, (c) => DOM.isType(c, 'victory') || DOM.isType(c, 'curse'));
    const shown = skipped.concat(matched ? [matched] : []);
    if (shown.length) reveal(state, victim, shown, '占い師で公開');
    skipped.forEach((c) => v.discard.push(c)); // 勝利点/呪いより手前の札は捨てる
    if (matched) v.deck.unshift(matched);       // 勝利点/呪いは山札の上に戻す
    log(state, `${v.name} は占い師で${matched ? `「${C()[matched].name}」を山札の上に戻し、` : ''}${skipped.length}枚を捨てた。`);
    fortuneTellerEnterVictim(state, source, queue);
  }

  /* ---------- 道化師（アタック：相手の山札上を捨て、勝利点なら呪い／他は攻撃側がコピー獲得先を選ぶ）---------- */
  function jesterEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'jester', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      jesterApply(state, source, victim, rest);
    }
  }
  function jesterApply(state, source, victim, queue) {
    const v = state.players[victim];
    if (v.deck.length === 0 && v.discard.length > 0) { reshuffleDeck(v); }
    if (v.deck.length === 0) { log(state, `${v.name} は山札が空だった（道化師）。`); jesterEnterVictim(state, source, queue); return; }
    const top = v.deck.shift();
    v.discard.push(top);
    reveal(state, victim, [top], '道化師で山札の上を公開');
    log(state, `${v.name} は山札の上の「${C()[top].name}」を捨てた（道化師）。`);
    if (DOM.isType(top, 'victory')) {
      if ((state.supply.curse || 0) > 0) { gain(state, victim, 'curse', 'discard'); log(state, `${v.name} は呪いを獲得した（道化師）。`); }
      jesterEnterVictim(state, source, queue);
    } else if (!NON_SUPPLY.has(top) && (state.supply[top] || 0) > 0) {
      // 攻撃側が「相手が獲得」か「自分が獲得」かを選ぶ
      state.pending = { type: 'jester', stage: 'choose', player: source, source, victim, card: top, queue };
    } else {
      log(state, `${v.name} の「${C()[top].name}」は獲得できる山が無かった（道化師）。`);
      jesterEnterVictim(state, source, queue);
    }
  }

  /* ---------- 家臣団（賞品・アタック：呪い＋手札3枚まで捨て）---------- */
  function followersEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'followers', stage: 'react', player: victim, source, victim, queue: rest };
    } else {
      followersApply(state, source, victim, rest);
    }
  }
  function followersApply(state, source, victim, queue) {
    const v = state.players[victim];
    if ((state.supply.curse || 0) > 0) { gain(state, victim, 'curse', 'discard'); log(state, `${v.name} は呪いを獲得した（家臣団）。`); }
    if (v.hand.length > 3) {
      state.pending = { type: 'followers', stage: 'discard', player: victim, source, victim, queue };
    } else {
      followersEnterVictim(state, source, queue);
    }
  }

  /* ---------- 若き魔女（アタック：災いカードを公開すれば免れる／しなければ呪い）---------- */
  function youngWitchLaunch(state, source) {
    const q = [];
    for (let k = 1; k < state.players.length; k++) q.push((source + k) % state.players.length);
    youngWitchEnterVictim(state, source, q);
  }
  function youngWitchEnterVictim(state, source, queue) {
    if (!queue || !queue.length) { state.pending = null; return; }
    queue = queue.filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    const bane = state.baneCard;
    const canReact = hasReaction(state.players[victim]) || (bane && state.players[victim].hand.includes(bane));
    if (canReact) {
      state.pending = { type: 'young_witch', stage: 'react', player: victim, source, victim, queue: rest, bane: bane || null };
    } else {
      youngWitchCurse(state, source, victim, rest);
    }
  }
  function youngWitchCurse(state, source, victim, queue) {
    if ((state.supply.curse || 0) > 0) { gain(state, victim, 'curse', 'discard'); log(state, `${state.players[victim].name} は呪いを獲得した（若き魔女）。`); }
    youngWitchEnterVictim(state, source, queue);
  }

  /* ---------- 馬上槍試合（属州公開→賞品/公領、他の誰も公開しなければ +1カード +1コイン）---------- */
  function tournamentStart(state, source) {
    if (state.players[source].hand.includes('province')) {
      state.pending = { type: 'tournament', stage: 'reveal_self', player: source, source };
    } else {
      tournamentOpponents(state, source);
    }
  }
  function tournamentOpponents(state, source) {
    const n = state.players.length, q = [];
    for (let k = 1; k < n; k++) { const idx = (source + k) % n; if (state.players[idx].hand.includes('province')) q.push(idx); }
    tournamentOppEnter(state, source, q, false);
  }
  function tournamentOppEnter(state, source, queue, revealedAny) {
    queue = (queue || []).slice();
    while (queue.length && !state.players[queue[0]].hand.includes('province')) queue.shift();
    if (!queue.length) {
      if (!revealedAny) { // 他の誰も属州を公開しなかった → +1カード +1コイン
        draw(state, source, 1); addCoins(state, 1);
        log(state, `${state.players[source].name} は馬上槍試合のボーナス（+1カード +1コイン）。`);
      }
      state.pending = null; return;
    }
    const opp = queue[0];
    state.pending = { type: 'tournament', stage: 'reveal_opp', player: opp, source, victim: opp, queue: queue.slice(1), revealedAny: !!revealedAny };
  }

  // リメイク：iter を1つ進める（2巡目まで。手札が尽きたら終了）。
  function remakeNext(state, pi, iter) {
    if (iter < 1 && state.players[pi].hand.length > 0) {
      state.pending = { type: 'remake', stage: 'trash', player: pi, iter: iter + 1 };
    } else {
      state.pending = null;
    }
  }

  /* ============================================================
     獲得コスト述語（mix-all 硬化の正本）
     ------------------------------------------------------------
     公式のコスト比較は **coin / potion / debt の成分別**（RGG Empires ルールブック）：
       - すべての成分が ≤ なら「以下」。$4+P は "up to $4" ではない。$0+負債8 は "exactly $0" ではない。
       - 「より安い」＝すべての成分が ≤ かつ どれか1つが厳密に < （component-wise strictly less）。
     **engine reducer / anyGainable ゲート / CPU の候補選び / UI のモーダル filter の4面が必ずこの関数を見る**こと。
     個別に `if` を足して回るのは禁止（過去の穴は全部「同じ条件を2箇所に手書きして片方で落とした」もの）。
     ※ 例外（コスト制限が無いのが公式）＝英雄(任意の財宝)／従者(任意のアタック)。それでも gainableBase は通す。
     ============================================================ */
  function costOf(state, id) {                       // コストの3成分（コスト軽減は coin にだけ効く）
    const c = C()[id] || {};
    return { coin: cardCost(state, id), pot: potionCost(id), debt: c.debt || 0 };
  }
  function costLE(a, b) { return a.coin <= b.coin && a.pot <= b.pot && a.debt <= b.debt; }
  function costLT(a, b) { return costLE(a, b) && (a.coin < b.coin || a.pot < b.pot || a.debt < b.debt); }
  // すべての「サプライから獲得する」効果の土台＝非サプライ（賞品/戦利品/狂人/傭兵/トラベラー成長先）・
  //   ロック中の分割山下段・在庫切れ・カタログ非在 を弾く。
  function gainableBase(state, id) {
    return !!C()[id] && !NON_SUPPLY.has(id) && !splitLocked(state, id) && (state.supply[id] || 0) > 0;
  }
  // 「コスト$N以下」（spec で {pot, debt} の上限も指定できる。既定は 0＝ポーション費用/負債コストは対象外）
  function costUpTo(state, id, coin, spec) {
    const s = spec || {};
    return gainableBase(state, id) && costLE(costOf(state, id), { coin: coin, pot: s.pot || 0, debt: s.debt || 0 });
  }
  // 「これより安い」（component-wise strictly less）
  function costUnder(state, id, coin, spec) {
    const s = spec || {};
    return gainableBase(state, id) && costLT(costOf(state, id), { coin: coin, pot: s.pot || 0, debt: s.debt || 0 });
  }
  // 「ちょうど$N（ポーション/負債も一致）」
  function costExact(state, id, coin, pot, debt) {
    const c = costOf(state, id);
    return gainableBase(state, id) && c.coin === coin && c.pot === (pot || 0) && c.debt === (debt || 0);
  }
  // 2枚のコストが完全一致か（詐欺師／御守り）。獲得可否は別途 gainableBase で見る。
  function sameCost(state, a, b) {
    const x = costOf(state, a), y = costOf(state, b);
    return x.coin === y.coin && x.pot === y.pot && x.debt === y.debt;
  }
  // 「これより安い」系 pending の基準コスト3成分（オンライン永続化の旧スナップショット互換＝
  //   coin 欠落なら under / maxCost+1 から復元。ポーション/負債は 0 とみなす＝旧挙動と同じ）。
  function underRef(pd) {
    const coin = (pd.coin != null) ? pd.coin
      : (pd.under != null ? pd.under : (pd.maxCost || 0) + 1);
    return { coin: coin, pot: pd.pot || 0, debt: pd.debt || 0 };
  }

  /* ---------- 新プロモ：王子/船長の対象判定 ---------- */
  // 「コストN以下」の判定＝公式のコスト比較（RGG Empires ルールブック）：コスト（コイン・負債・ポーション）は
  //   成分ごとに比較し、すべてが N 以下でなければ「N以下」ではない。よって負債コストやポーション費用を持つ
  //   カードは「コスト$N以下」に含まれない（例：技術者 $0+負債4 は "up to $5" ではない）。
  //   ＝王子/船長/はみだし者/大君主の対象、および「コストN以下を獲得」系（bestGain 等）で共通の除外条件。
  function costIsPlainCoin(id) { return !((C()[id] || {}).potion || (C()[id] || {}).debt); }
  // 王子：手札から脇に置ける対象＝持続でも命令でもない、コスト4以下（負債/ポーション費用なし）のアクション。
  // コストは判定時点の現在コスト（橋・街道等の軽減込み＝公式）。
  function princeEligible(state, id) {
    return DOM.isType(id, 'action') && !DOM.isType(id, 'duration') && !DOM.isType(id, 'command') &&
      C()[id] && costIsPlainCoin(id) && cardCost(state, id) <= 4;
  }
  // 船長：サプライで使える対象＝残数>0・非サプライ（賞品等）以外・持続/命令以外・
  // コスト4以下（負債/ポーション費用なし）のアクション。分割山は一番上のみ（アヴァントは$5なので自然に除外）。
  function captainTargets(state) {
    return Object.keys(state.supply).filter((id) =>
      (state.supply[id] || 0) > 0 && !NON_SUPPLY.has(id) && C()[id] &&
      DOM.isType(id, 'action') && !DOM.isType(id, 'duration') && !DOM.isType(id, 'command') &&
      costIsPlainCoin(id) && cardCost(state, id) <= 4 && !isMixedPileKey(id) && // 混合山（騎士/城/同盟の分割山）の山キーは対象外（プレースホルダ＝applyEffect が無く無効果の死に選択肢になる）
      !splitLocked(state, id));
  }
  function anyCaptainTarget(state) { return captainTargets(state).length > 0; }
  // 帝国：大君主（命令）＝サプライにある「コスト5以下・非命令・非持続のアクション」を、
  //   そのカードとしてサプライに残したまま使う（船長/はみだし者と同型・上限=コスト5固定）。
  //   負債コストのカード（技術者/市街/王室の鍛冶屋）は「コスト$5以下」ではない＝対象外（公式・costIsPlainCoin）。
  function overlordTargets(state) {
    return Object.keys(state.supply).filter((id) =>
      (state.supply[id] || 0) > 0 && !NON_SUPPLY.has(id) && C()[id] &&
      DOM.isType(id, 'action') && !DOM.isType(id, 'duration') && !DOM.isType(id, 'command') &&
      costIsPlainCoin(id) && cardCost(state, id) <= 5 && !isMixedPileKey(id) && // 混合山の山キーは対象外（プレースホルダ＝無効果）
      !splitLocked(state, id));
  }
  function anyOverlordTarget(state) { return overlordTargets(state).length > 0; }
  // 暗黒時代：はみだし者（命令）＝サプライにある「これより安い・非Command・非持続のアクション」を、
  //   サプライに残したまま使う。コスト比較ははみだし者の現在コスト（コスト軽減の影響あり）で動的判定。
  //   ※持続を対象にすると持続の追跡が要る（船長と同じ簡略化で除外）＝忠実性のわずかな簡略化。
  function bandOfMisfitsTargets(state) {
    const mx = cardCost(state, 'band_of_misfits');
    return Object.keys(state.supply).filter((id) =>
      (state.supply[id] || 0) > 0 && !NON_SUPPLY.has(id) && C()[id] &&
      DOM.isType(id, 'action') && !DOM.isType(id, 'duration') && !DOM.isType(id, 'command') &&
      costIsPlainCoin(id) && cardCost(state, id) < mx && !isMixedPileKey(id) && // 混合山の山キーは対象外（プレースホルダ＝applyEffect が無く無効果の死に選択肢になる）
      !splitLocked(state, id));
  }

  /* ---------- 命令（Command）の「再演では選び直さない」ルール ----------
     公式：大君主/はみだし者を玉座の間等で複数回使っても、何として使うかを選ぶのは1回目だけで、
     以降は同じカードとして使う。1回目の選択を state.turn.commandAs[命令id] に覚え、
     runReplays 経由の再演（state._replaying）ではその記憶を使って選択待ちを開かない。
     ※ ゴーレムの2枚目は「別のカードの新しいプレイ」なので _replaying を立てない（runReplays 側で除外）。 */
  function rememberCommandAs(state, commandId, card) {
    const t = state.turn;
    (t.commandAs = t.commandAs || {})[commandId] = card;
  }
  // 再演中なら記憶したカードをそのまま使い true を返す（＝呼び出し側は選択待ちを開かない）。
  function replayCommandAs(state, pi, commandId) {
    const t = state.turn;
    const card = state._replaying && t.commandAs && t.commandAs[commandId];
    if (!card) return false;
    log(state, `${state.players[pi].name} は${C()[commandId].name}で「${C()[card].name}」をもう一度使った（動かさずに使用）。`);
    playAsCommand(state, pi, commandId, card);
    return true;
  }

  /* ---------- 命令（Command）＝「プレイした札は動かない」ルール（2019エラッタ・現行） ----------
     大君主／はみだし者／船長は **サプライに残したまま**、王子は **脇に置いたまま** カードをプレイする。
     プレイされた札は「場(in play)」に居ないので、そのカードの
       「これ(this)を廃棄する／脇に置く／自分の山へ戻す／酒場マット・島マットに置く」
     という **自己移動は必ず失敗する**（lose track）。命令カード自身も身代わりに動かない。
     ※初版(2016 Empires ルールブック)は逆で「命令カードがそのカードになり、身代わりに動く」だったが、
       Donald X. の 2019エラッタで "play a card instead of becoming the card" に変更された。
       RGG Dark Ages(2022) ルールブック逐語：
         "The played Action card stays in the Supply; if an effect tries to move it, such as Death Cart
          trying to trash itself, it will fail to move it. If the card checks to see if it was trashed,
          like Death Cart does, that part will fail, but if it does not ... the rest of the effect will
          still happen."
     ＝ **移動そのもの（と「移動できたなら」で条件づけられたボーナス）だけが失われ、残りの効果は普通に解決する**。
        例：祝宴＝廃棄は失敗するが「コスト5以下を獲得」は行う／島＝島自身は動かないが手札1枚は島マットへ／
            死の荷車＝「これ」は廃棄できないが「手札のアクション」を廃棄すれば +$5／
            農家の市場＝山上VPは取れるが自身は廃棄されない／鉱山の村＝+$2 は出ない。

     実装：applyEffect(card) を呼ぶ間だけ state._cmd = { player, id, as } を立てる。
       - `as`（今まさに命令が代理でプレイしているカード）で識別する。伝令官/家臣/水晶玉のように
         applyEffect の内側で **別の本物のカード** をプレイする経路があり、そちらの「これ」は本物を指すため。
       - 後から解決する選択待ち（死の荷車／倒壊）は pending に「これを廃棄できるか」を載せて持ち回る。 */
  // 冒険：相続＝この屋敷は（自分のターン中）アクションとしてプレイできるか（脇にカードがあるか）。
  //   engine（PLAY_ACTION）・CPU（chooseAction）・UI（手札の再生ボタン）が同じ述語を見る。
  function inheritedEstate(p, cardId) { return cardId === 'estate' && ((p && p.inherited) || []).length > 0; }
  function playedByCommand(state, pi, cardId) {
    const c = state._cmd;
    return !!(c && c.player === pi && c.as === cardId);
  }
  // 「これ(this)」を場から取り除く。取り除けたら物理カードidを、取り除けなければ null（＝「If you did」が偽）。
  //   命令カードがプレイした札は場に無いので必ず null。玉座の2回目（1回目で既に動いた）も null。
  function takeSelf(state, pi, cardId) {
    if (playedByCommand(state, pi, cardId)) return null;
    return removeOne(state.players[pi].inPlay, cardId) ? cardId : null;
  }
  // 命令カードが代理で card をプレイする（applyEffect の間だけ _cmd を立てる）。
  function playAsCommand(state, pi, commandId, card) {
    const prev = state._cmd;
    state._cmd = { player: pi, id: commandId, as: card };
    try { applyEffect(state, card, pi); }
    finally { if (prev) state._cmd = prev; else delete state._cmd; }
  }
  // 選択待ち（倒壊/死の荷車）で「これ（this）」を廃棄できるか。**engine・CPU・UI はこの述語だけを見る**
  //   （片側だけ判定がずれると engine拒否×CPU再提案＝無限ループになる）。
  //   ※後方互換：pending.self は v44 で新設。オンライン対戦のスナップショット（v43以前）を復元すると
  //     self が欠落し undefined になるため、旧来の意味（場に本体があれば廃棄できる／
  //     v43 の命令フラグ fromCommand が立っていれば廃棄できない）へフォールバックする。
  function pendingSelf(state, pd, cardId) {
    if (!pd) return false;
    if (pd.self !== undefined) return !!pd.self;
    if (pd.fromCommand) return false;
    const p = state.players[pd.player];
    return !!p && p.inPlay.includes(cardId);
  }

  function applyEffect(state, cardId, pi) {
    const t = state.turn;
    const p = state.players[pi];
    switch (cardId) {
      /* ===== 冒険（Adventures）：相続＝自分のターン中、屋敷は「脇のカードを動かさずに使用する」命令アクション ===== */
      //   applyEffect に置くことで PLAY_ACTION だけでなく 玉座/王の宮廷/行進/御料車 の再演でも同じ挙動になる。
      case 'estate': {
        const inh = (p.inherited || [])[0];
        if (inh) { log(state, `${p.name} は相続の屋敷で「${C()[inh].name}」を使用する（脇に置いたまま）。`); playAsCommand(state, pi, 'estate', inh); }
        break;
      }
      /* ===== 帝国（Empires）Batch E1：負債（Debt）カード ===== */
      case 'engineer':
        // コスト4以下を1枚獲得（強制）。その後これを廃棄してよく、廃棄したらもう1枚コスト4以下を獲得（強制）。
        if (anyGainable(state, (id) => costUpTo(state, id, 4)))
          state.pending = { type: 'engineer', stage: 'gain1', player: pi };
        else
          state.pending = { type: 'engineer', stage: 'maytrash', player: pi }; // 獲得先ゼロでも自己廃棄の選択は出す
        break;
      case 'city_quarter':
        addActions(t, 2);
        { // 手札を公開し、公開したアクション1枚につき +1カード（city_quarter 自身は場に出ているので手札にない）。
          const acts = p.hand.filter((c) => DOM.isType(c, 'action')).length;
          if (acts > 0) draw(state, pi, acts);
          log(state, `${p.name} は市街で手札を公開しアクション${acts}枚 → +${acts}カード。`);
        }
        break;
      case 'royal_blacksmith':
        draw(state, pi, 5);
        { // 手札を公開し銅貨をすべて捨てる（強制・引いた後の手札から）。
          let n = 0;
          while (removeOne(p.hand, 'copper')) { p.discard.push('copper'); n++; }
          if (n) log(state, `${p.name} は王室の鍛冶屋で手札を公開し銅貨${n}枚を捨てた。`);
        }
        break;

      /* ===== 帝国（Empires）Batch E2：既存VPトークン＆単独カード ===== */
      // 公共広場：+3カード +1アクション → 手札2枚を捨てる（購入時の +1購入 は BUY 側）。
      case 'forum':
        draw(state, pi, 3); addActions(t, 1);
        if (p.hand.length > 0) state.pending = { type: 'forum', player: pi };
        break;
      // 生贄：手札1枚を廃棄→種別ごとにボーナス（アクション=+2カード+2アクション／財宝=+$2／勝利点=VPトークン2個。複数種別は全適用）。
      case 'sacrifice':
        if (p.hand.length > 0) state.pending = { type: 'sacrifice', stage: 'trash', player: pi };
        break;
      // 庭師：+1カード +1アクション（「場にある間、勝利点獲得毎にVPトークン1」は triggerOnGain で処理）。
      case 'groundskeeper':
        draw(state, pi, 1); addActions(t, 1);
        break;
      // 戦車競走：+1アクション。自分の山札の上を公開して手札に加える。左隣も山札の上を公開する（公開のみ＝山札に残す）。
      //   自分のカードのコストが左隣のより高ければ +$1 と VPトークン1個（同コスト/安いは無し・左隣が山札0枚ならこちらの勝ち）。
      // 帝国：戦車競走。**2025年2月エラッタで「山札の上を公開して手札に加える」→「+1カード（公開して引く）」に変更**。
      //   ＝通常のドローなので **-1カードトークン（遺物/借入）で1枚も引けない**ことがあり、カメレオンの習性の対象にもなる。
      //   そのため `p.deck.shift()` を直読みせず必ず `draw()` を通す（直読みするとトークンを無視して常に引けてしまう）。
      case 'chariot_race': {
        addActions(t, 1);
        let mine = null;
        {
          const got = draw(state, pi, 1); // -1カードトークン等はここで消化される（引けないこともある）
          if (got.length) { mine = got[0]; reveal(state, pi, [mine], '戦車競走で引いたカードを公開'); log(state, `${p.name} は戦車競走で「${C()[mine].name}」を引いて公開した。`); }
        }
        const n = state.players.length, left = (pi + 1) % n, lp = state.players[left];
        let theirs = null;
        if (lp.deck.length === 0 && lp.discard.length > 0) reshuffleDeck(lp);
        if (lp.deck.length > 0) { theirs = lp.deck[0]; reveal(state, left, [theirs], '戦車競走：左隣が山札の上を公開'); }
        // 公式ルーリング（BGG/wiki 裏取り）：どちらかが公開できない（山札0枚）なら「コストが高い」に該当しない＝ボーナス無し。
        //   同コスト（引き分け）も無し＝自分のカードが厳密に高いときだけ +$1 +VP。
        if (mine != null && theirs != null && cardCost(state, mine) > cardCost(state, theirs)) {
          addCoins(state, 1); p.vpTokens = (p.vpTokens || 0) + 1; log(state, `${p.name} は戦車競走で勝利（+$1 +1勝利点）。`);
        }
        break;
      }
      // ヴィラ：+2アクション +1購入 +1コイン（「これを手札に加える／購入フェイズ中ならアクションフェイズに戻る」は獲得時＝triggerOnGain）。
      case 'villa':
        addActions(t, 2); t.buys += 1; addCoins(state, 1);
        break;
      // 軍団兵：+$3。手札の金貨1枚を公開してよい（アタック）。公開したら各相手は手札2枚まで捨て、その後1枚引く。
      case 'legionary':
        addCoins(state, 3);
        if (p.hand.includes('gold')) state.pending = { type: 'legionary_reveal', player: pi };
        break;
      // 女魔術師：即時効果なし（アタック持続）。次の自分の手番まで、各相手がその手番で最初にプレイするアクションは
      //   記載効果の代わりに +1カード+1アクション になる（enchanted フラグ）。次の自分の手番開始時 +2カード。堀で防げる。
      case 'enchantress': {
        armDuration(state, pi, 'enchantress');
        const q = []; for (let k = 1; k < state.players.length; k++) q.push((pi + k) % state.players.length);
        enchantressEnterVictim(state, pi, q);
        break;
      }
      // 資料庫：+1アクション。山札の上から3枚を裏向きに脇へ置く。今回と次の2回の手番開始時に、脇から1枚を手札へ（持続）。
      case 'archive': {
        addActions(t, 1);
        const cards = [];
        for (let i = 0; i < 3; i++) {
          if (p.deck.length === 0) { if (p.discard.length === 0) break; reshuffleDeck(p); }
          if (p.deck.length === 0) break;
          cards.push(p.deck.shift());
        }
        if (cards.length > 0) {
          const aid = (state._archiveSeq = (state._archiveSeq | 0) + 1);
          (p.archives = p.archives || []).push({ id: aid, cards });
          log(state, `${p.name} は資料庫で山札の上${cards.length}枚を脇に置いた。`);
          state.pending = { type: 'archive_pick', player: pi, archiveId: aid }; // 今回のぶんを1枚 手札へ
        }
        break;
      }

      /* ===== 帝国（Empires）Batch E3：集合（Gathering）＝サプライ山上のVPトークン ===== */
      // 神殿：+1勝利点（本人）→ 手札から名前の異なる1〜3枚を廃棄（強制・手札があれば最低1枚）→ 神殿の山に勝利点1個。
      //   （獲得時: 神殿の山上の勝利点をすべて得る＝triggerOnGain）。
      case 'temple':
        p.vpTokens = (p.vpTokens || 0) + 1;
        log(state, `${p.name} は神殿で +1勝利点。`);
        if (p.hand.length > 0) state.pending = { type: 'temple_trash', player: pi };
        else { state.pileVP.temple = (state.pileVP.temple || 0) + 1; log(state, `${p.name} は神殿の山に勝利点トークン1個を置いた（計${state.pileVP.temple}個）。`); }
        break;
      // 農家の市場：+1購入。山のVPが4個以上なら全部得てこれを廃棄。そうでなければ山にVP+1、その後 山のVP1個につき+1コイン。
      case 'farmers_market': {
        t.buys += 1;
        const cur = state.pileVP.farmers_market || 0;
        if (cur >= 4) {
          // 勝利点の取得は廃棄に条件づかない（公式）。命令が動かさずに使った場合は廃棄だけが失敗する。
          p.vpTokens = (p.vpTokens || 0) + cur; state.pileVP.farmers_market = 0;
          const trashed = takeSelf(state, pi, 'farmers_market');
          if (trashed) trashCard(state, pi, 'farmers_market');
          log(state, `${p.name} は農家の市場で 山上の勝利点${cur}個 を得た${trashed ? '（これを廃棄）' : ''}。`);
        } else {
          state.pileVP.farmers_market = cur + 1; addCoins(state, (cur + 1));
          log(state, `${p.name} は農家の市場（山に勝利点1個→計${cur + 1}個・+$${cur + 1}）。`);
        }
        break;
      }
      // ワイルドハント：二択（+3カード＆山にVP+1／屋敷を獲得し 獲得したら山上のVPを全部得る）。
      case 'wild_hunt':
        state.pending = { type: 'wild_hunt', player: pi };
        break;

      /* ===== 帝国（Empires）Batch E4：分割山5組 ===== */
      // 陣地：+2カード+2アクション。手札から金貨か鹵獲品を公開してよい。公開しないなら脇へ→片付けで自分の分割山へ戻す。
      //   命令が動かさずに使った陣地は「これを脇に置く」に失敗する＝公開してもしなくても同じなので選択を出さない（E8）。
      case 'encampment':
        draw(state, pi, 2); addActions(t, 2);
        if (playedByCommand(state, pi, 'encampment')) {
          log(state, `${p.name} の陣地はサプライに残ったまま（脇に置かれない）。`);
        } else if (p.hand.includes('gold') || p.hand.includes('plunder')) {
          state.pending = { type: 'encampment_reveal', player: pi };
        } else encampmentSetAside(state, pi);
        break;
      // パトリキ：+1カード+1アクション。山札の一番上を公開（強制）＝コスト5以上なら手札へ、未満なら山札に残す。
      case 'patrician':
        draw(state, pi, 1); addActions(t, 1);
        if (p.deck.length === 0 && p.discard.length > 0) reshuffleDeck(p);
        if (p.deck.length > 0) {
          const top = p.deck[0];
          reveal(state, pi, [top], 'パトリキ：山札の上を公開');
          if (cardCost(state, top) >= 5) { p.deck.shift(); p.hand.push(top); log(state, `${p.name} はパトリキで「${C()[top].name}」を手札に加えた（$5以上）。`); }
          else log(state, `${p.name} はパトリキで「${C()[top].name}」を公開（$5未満・山札に残す）。`);
        }
        break;
      // 開拓者：+1カード+1アクション。捨て札から銅貨1枚を公開して手札に加えてよい（任意）。
      case 'settlers':
        draw(state, pi, 1); addActions(t, 1);
        if (p.discard.includes('copper')) state.pending = { type: 'settlers', player: pi };
        break;
      // 騒がしい村：+1カード+3アクション。捨て札から開拓者1枚を公開して手札に加えてよい（任意）。
      case 'bustling_village':
        draw(state, pi, 1); addActions(t, 3);
        if (p.discard.includes('settlers')) state.pending = { type: 'bustling_village', player: pi };
        break;
      // 投石機：+$1。手札1枚を廃棄（強制）＝コスト3以上なら他全Pが呪い、財宝なら他全Pが手札3枚まで捨て（両方満たせば両方・アタック）。
      case 'catapult':
        addCoins(state, 1);
        if (p.hand.length > 0) state.pending = { type: 'catapult', stage: 'trash', player: pi };
        break;
      // 剣闘士：+$2。手札1枚を公開→左隣が同じカードを公開してよい。公開されなければ +$1＋サプライから剣闘士1枚を廃棄。
      case 'gladiator':
        addCoins(state, 2);
        if (p.hand.length > 0) state.pending = { type: 'gladiator', stage: 'reveal', player: pi };
        else gladiatorLeftMatch(state, pi, null); // 手札空＝公開できない→左隣もマッチ不可→ボーナス
        break;

      /* ===== 帝国（Empires）Batch E5：城（混合山）のプレイ効果 ===== */
      // 小さい城：これ（場）か手札の城1枚を廃棄→廃棄したら城1枚を獲得（山の一番上）。手札に城が無くても「これ」を廃棄できる。
      case 'small_castle':
        state.pending = { type: 'small_castle', player: pi };
        break;
      // 華やかな城：手札から任意の枚数の勝利点カードを公開して捨てる→1枚につき +$2（0枚でもよい）。
      case 'opulent_castle':
        if (p.hand.some((c) => DOM.isType(c, 'victory'))) state.pending = { type: 'opulent_castle', player: pi };
        break;

      /* ===== 帝国（Empires）Batch E6：命令（overlord/crown） ===== */
      // 大君主：サプライのコスト5以下・非命令アクション1枚を、そのカードとしてサプライに残したまま使う
      //   （船長/はみだし者と同型・上限=コスト5固定。持続は対象外＝場に残らないと持続予約が宙に浮くため）。
      //   玉座/王の宮廷/行進/御料車/冠で再演されたときは「1回目に選んだカード」を必ずもう一度使う（公式ルーリング）。
      case 'overlord':
        if (replayCommandAs(state, pi, 'overlord')) break;
        if (anyOverlordTarget(state)) state.pending = { type: 'overlord', player: pi };
        break;
      // 冠：その時点のフェイズで対象種別が変わる（アクションフェイズ→手札のアクション1枚を2回／
      //   購入フェイズ→手札の財宝1枚を2回）。財宝として使う経路も同じ crownOpenPending を通る。
      case 'crown':
        crownOpenPending(state, pi);
        break;

      /* ===== ルネサンス（Renaissance）R2：素直な王国15枚 ===== */
      // 追従者：+2カード。獲得時 +2村人（triggerOnGain）。
      case 'lackeys':
        draw(state, pi, 2);
        break;
      // 劇団：+4村人。これを廃棄する（廃棄は村人の条件ではない＝命令経由で廃棄に失敗しても村人は得る）。
      case 'acting_troupe': {
        p.villagers = (p.villagers || 0) + 4;
        log(state, `${p.name} は劇団で +4村人。`);
        const self = takeSelf(state, pi, 'acting_troupe'); // 命令(大君主/はみだし者/船長/王子)経由なら null＝廃棄は失敗
        if (self) trashCard(state, pi, self);
        break;
      }
      // 実験：+2カード+1アクション。これをその山に戻す（獲得でも捨て札でも廃棄でもない＝トリガー一切なし）。
      //   玉座/王の宮廷の2回目は既に場に無い＝戻せないが +2カード+1アクションは得る。闇市場由来（山が無い）も戻せない。
      case 'experiment':
        draw(state, pi, 2); addActions(t, 1);
        if (state.supply.experiment != null && takeSelf(state, pi, 'experiment')) {
          state.supply.experiment += 1;
          log(state, `${p.name} は実験を山に戻した。`);
        }
        break;
      // 根城：+1カード+2アクション。手札1枚を廃棄（強制）。それが勝利点カードなら呪い1枚を獲得。
      case 'hideout':
        draw(state, pi, 1); addActions(t, 2);
        if (p.hand.length > 0) state.pending = { type: 'hideout_trash', player: pi };
        break;
      // 発明家：コスト$4以下を1枚獲得 → **その後** このターン すべてのカードが$1安くなる（自分の獲得には効かない＝順序が肝）。
      case 'inventor':
        if (anyGainable(state, (id) => inventorGainable(state, id))) state.pending = { type: 'inventor_gain', player: pi };
        else { t.costReduction += 1; log(state, `${p.name} は発明家：獲得できるカードが無く、コストが$1安くなった。`); }
        break;
      // 山村：+2アクション。捨て札から1枚を手札へ（捨て札があれば強制）。できない場合だけ +1カード。
      case 'mountain_village':
        addActions(t, 2);
        if (p.discard.length > 0) state.pending = { type: 'mountain_village', player: pi };
        else { draw(state, pi, 1); log(state, `${p.name} は山村：捨て札が無いので +1カード。`); }
        break;
      // 司祭：+2コイン。手札1枚を廃棄（強制）。このターンの残りの間、廃棄するたびに +2コイン
      //   （※司祭自身が指示したこの廃棄には乗らない＝予約の設置がその廃棄の「後」）。
      case 'priest':
        addCoins(state, 2);
        if (p.hand.length > 0) state.pending = { type: 'priest_trash', player: pi };
        else { t.priestCount = (t.priestCount || 0) + 1; log(state, `${p.name} は司祭：手札が無く廃棄なし（以後の廃棄で +2コイン）。`); }
        break;
      // 絹商人：+2カード+1購入。獲得時/廃棄時 +1財源+1村人（triggerOnGain / triggerOnTrash）。
      case 'silk_merchant':
        draw(state, pi, 2); t.buys += 1;
        break;
      // 老魔女：+3カード。他の各プレイヤーは呪い1枚を獲得し、その後 手札の呪い1枚を廃棄してもよい
      //   （免疫のプレイヤーは獲得も廃棄もしない＝公式）。
      case 'old_witch': {
        draw(state, pi, 3);
        const vics = [];
        for (let k = 1; k < state.players.length; k++) vics.push((pi + k) % state.players.length);
        oldWitchEnterVictim(state, pi, vics);
        break;
      }
      // 徴募官：+2カード。手札1枚を廃棄（強制）。そのコイン費用1につき +1村人（行商人はアクションフェイズでは$8＝+8村人）。
      case 'recruiter':
        draw(state, pi, 2);
        if (p.hand.length > 0) state.pending = { type: 'recruiter_trash', player: pi };
        break;
      // 学者：手札をすべて捨て、その後 +7カード（捨てた札もリシャッフルに混ざる＝先に捨てるのが肝）。
      case 'scholar': {
        const disc = p.hand.slice();
        p.hand.length = 0;
        disc.forEach((c) => p.discard.push(c));
        if (disc.length) { log(state, `${p.name} は学者で手札 ${disc.length}枚 を捨てた。`); triggerOnDiscard(state, pi, disc); }
        draw(state, pi, 7);
        break;
      }
      // 彫刻家：コスト$4以下を1枚「手札に」獲得（強制）。それが財宝なら +1村人。
      case 'sculptor':
        if (anyGainable(state, (id) => inventorGainable(state, id))) state.pending = { type: 'sculptor_gain', player: pi };
        break;
      // 先見者：+1カード+1アクション（先に引く）→ 山札の上3枚を公開し、コスト$2〜$4を手札へ（強制）・残りを好きな順で山札の上に戻す。
      case 'seer': {
        draw(state, pi, 1); addActions(t, 1);
        const revealed = [];
        for (let i = 0; i < 3; i++) {
          if (p.deck.length === 0) { if (p.discard.length === 0) break; reshuffleDeck(p); }
          revealed.push(p.deck.shift());
        }
        if (revealed.length) reveal(state, pi, revealed.slice(), '先見者：山札の上3枚を公開');
        const keep = [], rest = [];
        revealed.forEach((c) => {
          const cc = cardCost(state, c);
          if (costIsPlainCoin(c) && cc >= 2 && cc <= 4) keep.push(c); else rest.push(c);
        });
        if (keep.length) { p.hand.push(...keep); log(state, `${p.name} は先見者で ${keep.length}枚（$2〜$4）を手札に加えた。`); }
        if (rest.length > 1) state.pending = { type: 'seer_order', player: pi, cards: rest };
        else if (rest.length === 1) p.deck.unshift(rest[0]);
        break;
      }
      /* ===== ルネサンス R4：持続・クリンナップ・再演 ===== */
      // 貨物船（持続）：+2コイン。このターン中1回、カードを獲得したとき、それを表向きで脇（この上）に置いてよい。
      //   次の自分の手番開始時に手札へ。**1枚も脇に置かなければ持続として場に残らずクリンナップで捨て札**
      //   （＝脇に置いたときだけ armDuration する）。玉座で複数回使えば「このターン1回」の権利が回数ぶん。
      case 'cargo_ship':
        addCoins(state, 2);
        t.cargoCharges = (t.cargoCharges || 0) + 1;
        log(state, `${p.name} は貨物船を使った（+2コイン。このターンの獲得1枚を脇に置ける）。`);
        break;
      // 研究（持続）：+1アクション。手札1枚を廃棄し、そのコイン費用1につき1枚を山札の上から**裏向きで**脇へ。
      //   次の自分の手番開始時にそれらを手札へ。**銅貨（$0）を廃棄すると脇置き0枚＝持続として場に残らない**。
      case 'research':
        addActions(t, 1);
        if (p.hand.length > 0) state.pending = { type: 'research_trash', player: pi };
        break;
      // 増築：+2コイン。クリンナップ開始時の廃棄→格上げ獲得は endBuyTailSchemeOrCleanup の窓で処理する。
      //   **窓の回数は「このターンに使用した回数」**（玉座/山砦/王笏の再演も数える＝策謀 t.schemes と同型）。
      //   場の物理枚数で数えると再演ぶんが落ちる（公式：玉座で2回使えば格上げも2回）。
      case 'improve':
        addCoins(state, 2);
        t.improvePlays = (t.improvePlays || 0) + 1;
        break;

      /* ===== ルネサンス R3：アーティファクトが絡む王国4枚 ===== */
      // 国境警備隊：+1アクション。山札の上2枚（**ランタン所持なら3枚**）を公開し、1枚を手札へ・残りを捨て札へ。
      //   公開したカードが**すべてアクション**なら、ランタンか角笛を受け取る
      //   （非ランタン＝2枚とも→強制の二択／ランタン＝3枚とも→角笛を任意で）。
      case 'border_guard': {
        addActions(t, 1);
        const n2 = hasArtifact(state, pi, 'lantern') ? 3 : 2;
        const rev = [];
        for (let i = 0; i < n2; i++) {
          if (p.deck.length === 0) { if (p.discard.length === 0) break; reshuffleDeck(p); }
          rev.push(p.deck.shift());
        }
        if (rev.length) reveal(state, pi, rev.slice(), '国境警備隊：山札の上を公開');
        // 公開枚数が足りなければアーティファクトは取れない（公式）。
        const allAction = rev.length === n2 && rev.every((c) => DOM.isType(c, 'action'));
        if (rev.length === 0) break;
        if (rev.length === 1) { p.hand.push(rev[0]); log(state, `${p.name} は国境警備隊で1枚を手札に加えた。`); break; }
        state.pending = { type: 'border_guard', player: pi, cards: rev, allAction: allAction, lantern: n2 === 3 };
        break;
      }
      // 旗手：+2コイン。獲得時/廃棄時に旗を受け取る（triggerOnGain / triggerOnTrash）。
      case 'flag_bearer':
        addCoins(state, 2);
        break;
      // パトロン：+1村人+2コイン。「アクションフェイズ中に公開されたら +1財源」は reveal() の共通フック（リアクション）。
      case 'patron':
        p.villagers = (p.villagers || 0) + 1;
        addCoins(state, 2);
        log(state, `${p.name} はパトロンを使った（+1村人 +2コイン）。`);
        break;
      // 剣客：+3カード。**その後**捨て札置き場にカードがあれば +1財源。**その後**財源4個以上なら宝箱を受け取る。
      //   （3枚引く途中でシャッフルが起きて捨て札が空になったら、+1財源も宝箱も得られない＝順序が肝）。
      case 'swashbuckler':
        draw(state, pi, 3);
        if (p.discard.length > 0) {
          p.coffers = (p.coffers || 0) + 1;
          log(state, `${p.name} は剣客で +1財源（捨て札にカードがある）。`);
          if ((p.coffers || 0) >= 4) takeArtifact(state, pi, 'treasure_chest');
        }
        break;
      // 出納官：+3コイン。3択（手札の財宝1枚を廃棄／廃棄置き場から財宝1枚を手札に獲得／鍵を受け取る）。
      //   **遂行できない選択肢も選べる**（公式）＝engine は3択をいつでも受理し、実行不能なら効果なしで閉じる。
      case 'treasurer':
        addCoins(state, 3);
        state.pending = { type: 'treasurer', stage: 'choose', player: pi };
        break;
      // 悪党：+2財源。手札5枚以上の他の各プレイヤーは、手札からコスト$2以上のカード1枚を捨てる（無ければ手札を公開）。
      case 'villain': {
        p.coffers = (p.coffers || 0) + 2;
        log(state, `${p.name} は悪党で +2財源。`);
        const vics = [];
        for (let k = 1; k < state.players.length; k++) vics.push((pi + k) % state.players.length);
        villainEnterVictim(state, pi, vics);
        break;
      }

      case 'cellar':
        addActions(t, 1);
        // 手札を好きな枚数捨て、同じだけ引く（選択待ち）
        if (p.hand.length > 0) state.pending = { type: 'cellar', player: pi };
        break;
      case 'market':
        draw(state, pi, 1);
        addActions(t, 1);
        t.buys += 1;
        addCoins(state, 1);
        break;
      case 'militia': {
        addCoins(state, 2);
        // 他の全プレイヤーは手札3枚まで捨てる（手番順に処理）
        const others = [];
        for (let k = 1; k < state.players.length; k++) {
          const idx = (pi + k) % state.players.length;
          if (state.players[idx].hand.length > 3 && !attackImmune(state, idx)) others.push(idx);
        }
        if (others.length) {
          state.pending = { type: 'militia', player: others[0], source: pi, queue: others.slice(1) };
        }
        break;
      }
      case 'mine':
        // 財宝を廃棄してよい → ある場合のみ選択待ち
        if (p.hand.some((c) => isTreasureFor(state, c))) {
          state.pending = { type: 'mine', stage: 'trash', player: pi };
        }
        break;
      case 'moat':
        draw(state, pi, 2);
        break;
      case 'remodel':
        // 手札があれば1枚廃棄（必須）→獲得
        if (p.hand.length > 0) {
          state.pending = { type: 'remodel', stage: 'trash', player: pi };
        }
        break;
      case 'smithy':
        draw(state, pi, 3);
        break;
      case 'village':
        draw(state, pi, 1);
        addActions(t, 2);
        break;
      case 'woodcutter':
        t.buys += 1;
        addCoins(state, 2);
        break;
      case 'workshop':
        // コスト4以下が獲得できる場合のみ選択待ち（無ければ何もしない）
        if (anyGainable(state, (id) => costUpTo(state, id, 4)))
          state.pending = { type: 'workshop', stage: 'gain', player: pi };
        break;

      /* ===== 拡張: 陰謀 ===== */
      case 'courtyard':
        draw(state, pi, 3);
        // 手札1枚を山札の上に置く（手札があるときのみ）
        if (p.hand.length > 0) state.pending = { type: 'courtyard', player: pi };
        break;
      case 'pawn':
        // 4つから異なる2つを選ぶ
        state.pending = { type: 'pawn', player: pi };
        break;
      case 'shanty_town':
        addActions(t, 2);
        // 手札を公開し、アクションが無ければ +2 カード（このカードは既に場にある）
        if (!p.hand.some((c) => DOM.isType(c, 'action'))) draw(state, pi, 2);
        break;
      case 'steward':
        state.pending = { type: 'steward', stage: 'choose', player: pi };
        break;
      case 'wishing_well':
        draw(state, pi, 1);
        addActions(t, 1);
        state.pending = { type: 'wishing', player: pi };
        break;
      case 'baron':
        t.buys += 1;
        if (p.hand.indexOf('estate') >= 0) {
          state.pending = { type: 'baron', player: pi };
        } else {
          if (gain(state, pi, 'estate', 'discard')) log(state, `${p.name} は屋敷を獲得した。`);
          else log(state, `${p.name} は屋敷を獲得しようとしたが山が空だった。`);
        }
        break;
      case 'bridge':
        t.buys += 1;
        addCoins(state, 1);
        t.costReduction = (t.costReduction || 0) + 1;
        break;
      case 'conspirator':
        addCoins(state, 2);
        if ((t.actionsPlayed || 0) >= 3) { draw(state, pi, 1); addActions(t, 1); }
        break;
      case 'ironworks':
        if (anyGainable(state, (id) => costUpTo(state, id, 4)))
          state.pending = { type: 'ironworks', player: pi };
        break;
      case 'mining_village':
        draw(state, pi, 1);
        addActions(t, 2);
        // 場のこのカードを廃棄して +2 コイン（任意）。
        //   命令が動かさずに使った鉱山の村は「これ」を廃棄できない＝+$2 も出ない（公式・E8）。
        //   玉座の2回目（1回目で既に廃棄済み）も同様。どちらも死に選択肢なので pending を立てない。
        if (!playedByCommand(state, pi, 'mining_village') && p.inPlay.includes('mining_village'))
          state.pending = { type: 'mining_village', player: pi };
        break;
      case 'nobles':
        // +3 カード か +2 アクション を選ぶ
        state.pending = { type: 'nobles', player: pi };
        break;
      case 'torturer': {
        draw(state, pi, 3);
        // 他の全プレイヤーが対象（手番順・灯台免疫は除外）
        const to = [];
        for (let k = 1; k < state.players.length; k++) { const idx = (pi + k) % state.players.length; if (!attackImmune(state, idx)) to.push(idx); }
        if (to.length) state.pending = { type: 'torturer', player: to[0], source: pi, queue: to.slice(1) };
        break;
      }
      case 'great_hall':
        // +1カード +1アクション（勝利点1は vpOf が一律加算するので別処理不要）
        draw(state, pi, 1);
        addActions(t, 1);
        break;
      case 'coppersmith':
        // このターン、銅貨は出すと +1 コイン（treasureCoins で加算）
        t.copperBonus = (t.copperBonus || 0) + 1;
        break;
      case 'trading_post':
        // 手札を2枚廃棄→銀貨を手札に。手札があるときだけ選択待ち
        if (p.hand.length > 0) state.pending = { type: 'trading_post', player: pi };
        break;
      case 'upgrade':
        draw(state, pi, 1);
        addActions(t, 1);
        // 手札があれば1枚廃棄→ちょうど+1コストを獲得
        if (p.hand.length > 0) state.pending = { type: 'upgrade', stage: 'trash', player: pi };
        break;
      case 'scout': {
        addActions(t, 1);
        // 山札の上4枚を公開（足りなければ捨て札をシャッフル）
        const revealed = [];
        for (let i = 0; i < 4; i++) {
          if (p.deck.length === 0) {
            if (p.discard.length === 0) break;
            reshuffleDeck(p);
          }
          revealed.push(p.deck.shift());
        }
        if (revealed.length) reveal(state, pi, revealed, '斥候で山札の上を公開');
        // 勝利点は手札へ、それ以外は山札の上へ戻す（順序は選択）
        const vics = revealed.filter((c) => DOM.isType(c, 'victory'));
        const rest = revealed.filter((c) => !DOM.isType(c, 'victory'));
        vics.forEach((c) => p.hand.push(c));
        if (vics.length) log(state, `${p.name} は斥候で勝利点 ${vics.length}枚 を手札に加えた。`);
        if (rest.length > 1) {
          state.pending = { type: 'scout', player: pi, cards: rest };
        } else {
          rest.forEach((c) => p.deck.unshift(c)); // 0/1枚は順序選択不要
        }
        break;
      }
      case 'swindler': {
        addCoins(state, 2);
        // 他の全プレイヤーが対象（手番順）。段階アタック（react→gain）を犠牲者ごとに処理
        const vics = [];
        for (let k = 1; k < state.players.length; k++) vics.push((pi + k) % state.players.length);
        swindlerEnterVictim(state, pi, vics);
        break;
      }
      case 'saboteur': {
        const vics = [];
        for (let k = 1; k < state.players.length; k++) vics.push((pi + k) % state.players.length);
        saboteurEnterVictim(state, pi, vics);
        break;
      }
      case 'minion':
        addActions(t, 1);
        // 攻撃側が「+2コイン」か「手札を捨てて+4＆相手も」を選ぶ
        state.pending = { type: 'minion', stage: 'choose', player: pi };
        break;
      case 'masquerade': {
        draw(state, pi, 2);
        // 全員が同時に手札1枚を左隣へ渡す（手札のある人を順に集めてから一斉適用）
        const order = masqueradePassOrder(state, pi);
        if (order.length) {
          state.pending = { type: 'masquerade', stage: 'pass', player: order[0], source: pi, order, pos: 0, picks: {} };
        } else {
          masqueradeAfterPass(state, pi);
        }
        break;
      }
      case 'secret_chamber':
        // アクション: 手札を好きな枚数捨て、捨てた枚数だけ +1コイン（リアクションは別途 SECRET_CHAMBER_REVEAL）
        if (p.hand.length > 0) state.pending = { type: 'secret_chamber', stage: 'discard', player: pi };
        break;

      /* ===== 基本セット（追加分） ===== */
      case 'laboratory':
        draw(state, pi, 2);
        addActions(t, 1);
        break;
      case 'festival':
        addActions(t, 2);
        t.buys += 1;
        addCoins(state, 2);
        break;
      case 'moneylender':
        // 手札に銅貨があれば「廃棄して+3」か否かを選ぶ
        if (p.hand.includes('copper')) state.pending = { type: 'moneylender', player: pi };
        break;
      case 'chancellor':
        addCoins(state, 2);
        // 山札を捨て札にするか選ぶ（山札が空なら選択不要）
        if (p.deck.length > 0) state.pending = { type: 'chancellor', player: pi };
        break;
      case 'chapel':
        if (p.hand.length > 0) state.pending = { type: 'chapel', player: pi };
        break;
      // gardens は勝利点カード（プレイ不可）。得点は vpOf で計算。
      case 'witch': {
        draw(state, pi, 2);
        const vics = [];
        for (let k = 1; k < state.players.length; k++) vics.push((pi + k) % state.players.length);
        witchEnterVictim(state, pi, vics);
        break;
      }
      case 'bureaucrat': {
        // 銀貨を山札の上に獲得（山切れ時は獲得できないのでログもガード）
        if (gain(state, pi, 'silver', 'deck')) log(state, `${p.name} は銀貨を山札の上に獲得した。`);
        const vics = [];
        for (let k = 1; k < state.players.length; k++) vics.push((pi + k) % state.players.length);
        bureaucratEnterVictim(state, pi, vics);
        break;
      }
      case 'council_room':
        draw(state, pi, 4);
        t.buys += 1;
        for (let k = 1; k < state.players.length; k++) draw(state, (pi + k) % state.players.length, 1);
        break;
      case 'feast':
        // 自身を廃棄（場にあれば）→ コスト5以下を獲得。獲得は廃棄に条件づかない（命令経由なら廃棄だけが失敗する）。
        if (takeSelf(state, pi, 'feast')) { trashCard(state, pi, 'feast'); log(state, `${p.name} は祝宴を廃棄した。`); }
        if (anyGainable(state, (id) => costUpTo(state, id, 5))) state.pending = { type: 'feast', player: pi };
        break;
      case 'adventurer': {
        let found = 0; const aside = [];
        while (found < 2) {
          if (p.deck.length === 0) { if (p.discard.length === 0) break; reshuffleDeck(p); }
          if (p.deck.length === 0) break;
          const c = p.deck.shift();
          if (isTreasureFor(state, c)) { p.hand.push(c); found++; } else aside.push(c);
        }
        aside.forEach((c) => p.discard.push(c));
        log(state, `${p.name} は冒険者で財宝 ${found}枚 を手札に加えた。`);
        break;
      }
      case 'library':
        libraryStep(state, pi, []);
        break;
      case 'spy': {
        draw(state, pi, 1);
        addActions(t, 1);
        const q = [pi];
        for (let k = 1; k < state.players.length; k++) q.push((pi + k) % state.players.length);
        spyEnterTarget(state, pi, q);
        break;
      }
      case 'thief': {
        const vics = [];
        for (let k = 1; k < state.players.length; k++) vics.push((pi + k) % state.players.length);
        thiefEnterVictim(state, pi, vics);
        break;
      }
      case 'throne_room':
        // 手札にアクションがあれば、2回使うカードを選ぶ
        if (p.hand.some((c) => DOM.isType(c, 'action'))) state.pending = { type: 'throne', player: pi };
        break;
      case 'tribute': {
        // 左隣のプレイヤーが山札の上2枚を公開して捨てる
        const left = state.players[(pi + 1) % state.players.length];
        const revealed = [];
        for (let i = 0; i < 2; i++) {
          if (left.deck.length === 0) {
            if (left.discard.length === 0) break;
            reshuffleDeck(left);
          }
          revealed.push(left.deck.shift());
        }
        if (revealed.length) reveal(state, (pi + 1) % state.players.length, revealed, '貢物で山札の上を公開');
        revealed.forEach((c) => left.discard.push(c));
        if (revealed.length) log(state, `${left.name} は山札の上 ${revealed.length}枚 を公開して捨てた。`);
        // 異なる名前ごとにボーナス（同名2枚は1回ぶん。多重タイプは各該当を独立に付与）
        const distinct = revealed.filter((c, i, a) => a.indexOf(c) === i);
        let addCard = 0, addA = 0, addC = 0;
        distinct.forEach((c) => {
          if (DOM.isType(c, 'action')) { addActions(t, 2); addA += 2; }
          if (isTreasureFor(state, c)) { addCoins(state, 2); addC += 2; }
          if (DOM.isType(c, 'victory')) { draw(state, pi, 2); addCard += 2; }
        });
        const parts = [];
        if (addCard) parts.push(`+${addCard}カード`);
        if (addA) parts.push(`+${addA}アクション`);
        if (addC) parts.push(`+${addC}コイン`);
        if (parts.length) log(state, `${p.name} は貢物で ${parts.join(' ')} を得た。`);
        break;
      }

      /* ===== 基本セット 第二版で追加された7種 ===== */
      case 'harbinger':
        draw(state, pi, 1);
        addActions(t, 1);
        // 捨て札があれば、その中から1枚を山札の上に置いてよい
        if (p.discard.length > 0) state.pending = { type: 'harbinger', player: pi };
        break;
      case 'merchant':
        draw(state, pi, 1);
        addActions(t, 1);
        t.merchants = (t.merchants || 0) + 1; // このターン最初の銀貨で +1（商人の数だけ）
        break;
      case 'vassal': {
        addCoins(state, 2);
        if (p.deck.length === 0 && p.discard.length > 0) { reshuffleDeck(p); }
        if (p.deck.length > 0) {
          const top = p.deck.shift();
          p.discard.push(top); // 一旦捨てる（公式どおり：捨ててから使うなら捨て札から場へ）
          // 家臣は「捨てる」であって「公開する」ではない（公式）＝パトロンは誘発しない（表示のみ）。
          reveal(state, pi, [top], '家臣で山札の上を公開', { notReveal: true });
          log(state, `${p.name} は山札の上の「${C()[top].name}」を捨てた（家臣）。`);
          if (DOM.isType(top, 'action')) state.pending = { type: 'vassal', player: pi, card: top };
        }
        break;
      }
      case 'poacher': {
        draw(state, pi, 1);
        addActions(t, 1);
        addCoins(state, 1);
        const need = Math.min(emptyPileCount(state), p.hand.length); // 空のサプライ1つにつき手札1枚捨て
        if (need > 0) state.pending = { type: 'poacher', player: pi, need };
        break;
      }
      case 'bandit': {
        if (gain(state, pi, 'gold', 'discard')) log(state, `${p.name} は金貨を獲得した（山賊）。`);
        const vics = [];
        for (let k = 1; k < state.players.length; k++) vics.push((pi + k) % state.players.length);
        banditEnterVictim(state, pi, vics);
        break;
      }
      case 'sentry': {
        draw(state, pi, 1);
        addActions(t, 1);
        const look = []; // 山札の上2枚を「見る」（他者には公開しない）
        for (let i = 0; i < 2; i++) {
          if (p.deck.length === 0) { if (p.discard.length === 0) break; reshuffleDeck(p); }
          if (p.deck.length === 0) break;
          look.push(p.deck.shift());
        }
        if (look.length > 0) state.pending = { type: 'sentry', player: pi, cards: look };
        break;
      }
      case 'artisan':
        // コスト5以下を手札に獲得（銅貨があるので常に可能）→ その後、手札1枚を山札の上へ
        state.pending = { type: 'artisan', stage: 'gain', player: pi };
        break;

      /* ===== 陰謀 第二版で追加された7種 ===== */
      case 'courtier':
        // 手札1枚を公開→その種類数だけ効果を選ぶ
        if (p.hand.length > 0) state.pending = { type: 'courtier', stage: 'reveal', player: pi };
        break;
      case 'diplomat':
        draw(state, pi, 2);
        if (p.hand.length <= 5) addActions(t, 2); // 引いた後の手札が5枚以下なら +2 アクション
        break;
      case 'lurker':
        addActions(t, 1);
        state.pending = { type: 'lurker', stage: 'choose', player: pi };
        break;
      case 'mill':
        draw(state, pi, 1);
        addActions(t, 1);
        // 手札を2枚捨てれば +2 コイン（任意）。2枚なければ選択不要
        if (p.hand.length >= 2) state.pending = { type: 'mill', player: pi };
        break;
      case 'patrol': {
        draw(state, pi, 3);
        const revealed = [];
        for (let i = 0; i < 4; i++) {
          if (p.deck.length === 0) { if (p.discard.length === 0) break; reshuffleDeck(p); }
          if (p.deck.length === 0) break;
          revealed.push(p.deck.shift());
        }
        if (revealed.length) reveal(state, pi, revealed, 'パトロールで山札の上を公開');
        const toHand = revealed.filter((c) => DOM.isType(c, 'victory') || DOM.isType(c, 'curse'));
        const rest = revealed.filter((c) => !(DOM.isType(c, 'victory') || DOM.isType(c, 'curse')));
        toHand.forEach((c) => p.hand.push(c));
        if (toHand.length) log(state, `${p.name} はパトロールで ${toHand.length}枚（勝利点/呪い）を手札に加えた。`);
        if (rest.length > 1) state.pending = { type: 'patrol', player: pi, cards: rest };
        else rest.forEach((c) => p.deck.unshift(c));
        break;
      }
      case 'replace':
        // 手札1枚を廃棄（必須）→ +$2まで獲得
        if (p.hand.length > 0) state.pending = { type: 'replace', stage: 'trash', player: pi };
        break;
      case 'secret_passage':
        draw(state, pi, 2);
        addActions(t, 1);
        if (p.hand.length > 0) state.pending = { type: 'secret_passage', stage: 'pick', player: pi };
        break;

      /* ===== プロモカード ===== */
      case 'walled_village':
        draw(state, pi, 1);
        addActions(t, 2);
        break; // 山札の上に戻す処理はクリーンアップ時
      case 'envoy': {
        const revealed = [];
        for (let i = 0; i < 5; i++) {
          if (p.deck.length === 0) { if (p.discard.length === 0) break; reshuffleDeck(p); }
          if (p.deck.length === 0) break;
          revealed.push(p.deck.shift());
        }
        if (revealed.length) {
          reveal(state, pi, revealed, '使者で山札の上を公開');
          const left = (pi + 1) % state.players.length;
          if (left === pi) { revealed.forEach((c) => p.hand.push(c)); } // 1人用フォールバック
          else state.pending = { type: 'envoy', player: left, source: pi, revealed };
        }
        break;
      }
      case 'governor':
        addActions(t, 1);
        state.pending = { type: 'governor', stage: 'choose', player: pi };
        break;
      case 'dismantle':
        if (p.hand.length > 0) state.pending = { type: 'dismantle', stage: 'trash', player: pi };
        break;
      case 'black_market': {
        addCoins(state, 2);
        const bm = state.blackMarket || [];
        const revealed = bm.splice(0, 3); // 上3枚（買わなかったぶんは後で底へ）
        state.blackMarket = bm;
        if (revealed.length) {
          // 闇市場デッキのカードは「あなたのカード」ではない＝パトロンは誘発しない（表示のみ）。
          reveal(state, pi, revealed, '闇市場デッキの上を公開', { notReveal: true });
          state.pending = { type: 'black_market', stage: 'play', player: pi, revealed };
        }
        break;
      }

      /* ===== 新プロモ（王子/船長/教会/サウナ/アヴァント。へそくりは財宝＝placeStash/STASH_SETTING）===== */
      case 'prince': {
        // 王子（2022年エラッタ版）：手札のコスト4以下・持続/命令以外のアクション1枚を王子の脇に
        // 置いてよい。以降あなたの各ターン開始時、それを脇に置いたまま使用する（場には出ない）。
        // 置いた王子は持続としてゲーム終了まで場に残る（cleanupAndAdvance が princes の数だけ保持）。
        // 玉座の間×王子＝2回解決で2枚まで脇置きできる（現行公式ルール）。
        if (p.inPlay.includes('prince') && p.hand.some((c) => princeEligible(state, c))) {
          state.pending = { type: 'prince', player: pi };
        } else if (p.inPlay.includes('prince')) {
          log(state, `${p.name} の王子：脇に置けるカードが手札にない。`);
        }
        break;
      }
      case 'captain':
        // 船長：このターンと次のターン開始時、サプライのコスト4以下・持続/命令以外のアクションを
        // サプライに残したまま使用する。
        armDuration(state, pi, 'captain');
        if (anyCaptainTarget(state)) state.pending = { type: 'captain', player: pi };
        else log(state, `${p.name} の船長：サプライに使えるアクションがない。`);
        break;
      case 'church':
        // 教会：+1アクション。手札から最大3枚を裏向きで脇に置く。次のターン開始時に手札へ戻し、
        // その後 手札1枚を廃棄してよい（脇0枚でも廃棄の機会はある＝公式）。
        addActions(t, 1);
        if (p.hand.length > 0) state.pending = { type: 'church', player: pi };
        else armDuration(state, pi, 'church', { stashed: [] });
        break;
      case 'sauna':
        // サウナ：+1カード+1アクション。手札のアヴァント1枚を使ってよい。
        // このターン、銀貨を使うたび（このターンのサウナ使用回数ぶん）手札1枚を廃棄してよい。
        draw(state, pi, 1); addActions(t, 1);
        t.saunaPlays = (t.saunaPlays || 0) + 1;
        if (p.hand.includes('avanto')) state.pending = { type: 'sauna_chain', player: pi, next: 'avanto' };
        break;
      case 'avanto':
        // アヴァント：+3カード。手札のサウナ1枚を使ってよい。
        draw(state, pi, 3);
        if (p.hand.includes('sauna')) state.pending = { type: 'sauna_chain', player: pi, next: 'sauna' };
        break;

      /* ===== 拡張: 暗黒時代（Dark Ages）===== */
      // --- 単純（即時・非対話）---
      case 'necropolis': // 避難所：+2アクション
        addActions(t, 2);
        break;
      case 'fortress': // +1カード +2アクション（on-trashで手札に戻る＝triggerOnTrash）
        draw(state, pi, 1); addActions(t, 2);
        break;
      case 'market_square': // +1カード +1アクション +1購入（リアクションは hasReaction/market_square_react）
        draw(state, pi, 1); addActions(t, 1); t.buys += 1;
        break;
      case 'poor_house': {
        // +$4、手札を公開し手札の財宝1枚につき-$1（コイン合計は$0未満にならない）。
        addCoins(state, 4);
        reveal(state, pi, p.hand.slice(), '貧民街');
        const tr = p.hand.filter((c) => isTreasureFor(state, c)).length;
        t.coins = Math.max(0, t.coins - tr);
        log(state, `${p.name} は貧民街（+$4、手札の財宝${tr}枚で-$${tr}）。`);
        break;
      }
      case 'vagrant': {
        // +1カード +1アクション。山札の一番上を公開し、呪い/廃墟/避難所/勝利点なら手札へ。
        draw(state, pi, 1); addActions(t, 1);
        if (p.deck.length === 0 && p.discard.length > 0) reshuffleDeck(p);
        if (p.deck.length > 0) {
          const top = p.deck[0];
          reveal(state, pi, [top], '放浪者');
          if (['curse', 'ruins', 'shelter', 'victory'].some((ty) => DOM.isType(top, ty))) {
            p.deck.shift(); p.hand.push(top);
            log(state, `${p.name} は放浪者で「${C()[top].name}」を手札に加えた。`);
          }
        }
        break;
      }
      case 'sage': {
        // +1アクション。$3以上が出るまで山札の上を公開→それを手札へ、残りは捨て札。
        addActions(t, 1);
        const rev = []; let found = null;
        while (true) {
          if (p.deck.length === 0) { if (p.discard.length === 0) break; reshuffleDeck(p); }
          const c = p.deck.shift();
          if (cardCost(state, c) >= 3) { found = c; break; }
          rev.push(c);
        }
        reveal(state, pi, rev.concat(found ? [found] : []), '賢者');
        if (found) { p.hand.push(found); log(state, `${p.name} は賢者で「${C()[found].name}」を手札に加えた。`); }
        rev.forEach((c) => p.discard.push(c));
        break;
      }
      case 'beggar': {
        // 銅貨3枚を手札に獲得（リアクションは hasReaction/beggar_react）。
        let g = 0; for (let i = 0; i < 3; i++) if (gain(state, pi, 'copper', 'hand')) g++;
        log(state, `${p.name} は物乞いで銅貨${g}枚を手札に獲得した。`);
        break;
      }
      case 'madman': {
        // +2アクション。狂人を山へ戻せたら、その時点の手札枚数ぶん +1カード（王子で動かさずに使うと戻せない＝引けない）。
        addActions(t, 2);
        if (takeSelf(state, pi, 'madman')) {
          state.supply.madman = (state.supply.madman || 0) + 1; // 非サプライ山へ返却
          const n = p.hand.length;
          if (n) draw(state, pi, n);
          log(state, `${p.name} は狂人を山へ戻し +${n}カード。`);
        }
        break;
      }
      // 廃墟（Ruins・混合山の中身。全て$0のアクション）
      case 'abandoned_mine':
        addCoins(state, 1);
        break;
      case 'ruined_library':
        draw(state, pi, 1);
        break;
      case 'ruined_market':
        t.buys += 1;
        break;
      case 'ruined_village':
        addActions(t, 1);
        break;
      // --- 対話（pending）---
      case 'survivors': {
        // 山札の上2枚を見て、両方捨てるか、両方（好きな順で）山札の上に戻す。
        if (p.deck.length < 2 && p.discard.length > 0) reshuffleDeck(p);
        const look = p.deck.slice(0, 2);
        if (look.length > 0) state.pending = { type: 'survivors', player: pi, cards: look.slice() };
        break;
      }
      case 'rats': {
        // +1カード +1アクション。ネズミを1枚獲得。手札のネズミ以外を1枚廃棄（全部ネズミなら公開して廃棄しない）。
        draw(state, pi, 1); addActions(t, 1);
        gain(state, pi, 'rats', 'discard');
        if (p.hand.some((c) => c !== 'rats')) state.pending = { type: 'rats_trash', player: pi };
        else { reveal(state, pi, p.hand.slice(), 'ネズミ'); log(state, `${p.name} は手札が全てネズミで廃棄しなかった。`); }
        break;
      }
      case 'armory': // コスト4以下を1枚、山札の上に獲得
        if (anyGainable(state, (id) => costUpTo(state, id, 4))) state.pending = { type: 'armory', player: pi };
        break;
      case 'forager':
        // +1アクション +1購入。手札1枚廃棄（可能なら強制）→ 廃棄置き場の異なる財宝の種類ぶん +$1。
        addActions(t, 1); t.buys += 1;
        if (p.hand.length > 0) state.pending = { type: 'forager', player: pi };
        else { const add = foragerCoins(state); addCoins(state, add); log(state, `${p.name} は採集者（廃棄なし・+$${add}）。`); }
        break;
      case 'squire': // +$1、+2アクション / +2購入 / 銀貨獲得 を選ぶ（on-trashはアタック獲得）
        addCoins(state, 1);
        state.pending = { type: 'squire', player: pi };
        break;
      case 'storeroom': // +1購入。好きな枚数捨てて同数ドロー→さらに好きな枚数捨てて+$1ずつ
        t.buys += 1;
        state.pending = { type: 'storeroom', stage: 'discard1', player: pi };
        break;
      case 'scavenger': // +$2。山札を捨ててよい→捨て札から1枚を山札の上へ
        addCoins(state, 2);
        state.pending = { type: 'scavenger', stage: 'deck', player: pi };
        break;
      case 'ironmonger': {
        // +1カード +1アクション。山札の一番上を公開→捨てる/戻すを選び、種別に応じたボーナス。
        draw(state, pi, 1); addActions(t, 1);
        if (p.deck.length === 0 && p.discard.length > 0) reshuffleDeck(p);
        if (p.deck.length > 0) state.pending = { type: 'ironmonger', player: pi, card: p.deck[0] };
        break;
      }
      case 'wandering_minstrel': {
        // +1カード +2アクション。山札の上3枚を公開し、アクションを好きな順で山札の上へ戻し、残りを捨てる。
        draw(state, pi, 1); addActions(t, 2);
        while (p.deck.length < 3 && p.discard.length > 0) reshuffleDeck(p);
        const look = p.deck.splice(0, Math.min(3, p.deck.length));
        if (look.length) reveal(state, pi, look.slice(), '吟遊詩人');
        const acts = look.filter((c) => DOM.isType(c, 'action'));
        look.filter((c) => !DOM.isType(c, 'action')).forEach((c) => p.discard.push(c));
        if (acts.length > 1) state.pending = { type: 'minstrel', player: pi, cards: acts };
        else if (acts.length === 1) p.deck.unshift(acts[0]);
        break;
      }
      case 'junk_dealer': // +1カード +1アクション +$1、手札1枚を廃棄（可能なら強制）
        draw(state, pi, 1); addActions(t, 1); addCoins(state, 1);
        if (p.hand.length > 0) state.pending = { type: 'junk_dealer', player: pi };
        break;
      case 'mystic': // +1アクション +$2、カード名を指定→山札の上を公開→当たれば手札へ
        addActions(t, 1); addCoins(state, 2);
        if (p.deck.length === 0 && p.discard.length > 0) reshuffleDeck(p);
        if (p.deck.length > 0) state.pending = { type: 'mystic', player: pi };
        break;
      case 'altar': // 手札1枚を廃棄（可能なら強制）→ コスト5以下を1枚獲得（廃棄の可否に関わらず）
        state.pending = p.hand.length > 0
          ? { type: 'altar', stage: 'trash', player: pi }
          : (anyGainable(state, (id) => costUpTo(state, id, 5)) ? { type: 'altar', stage: 'gain', player: pi } : null);
        break;
      case 'bandit_camp': // +1カード +2アクション、戦利品を1枚獲得（非サプライ）
        draw(state, pi, 1); addActions(t, 2);
        if (gain(state, pi, 'spoils', 'discard')) log(state, `${p.name} は山賊の宿営地で戦利品を獲得した。`);
        break;
      case 'hunting_grounds': // +4カード（on-trashは公領or屋敷3＝triggerOnTrash）
        draw(state, pi, 4);
        break;
      case 'catacombs': { // 山札の上3枚を見て、手札に加える or 捨てて+3カード（on-trashは安い獲得）
        if (p.deck.length < 3 && p.discard.length > 0) reshuffleDeck(p);
        const look = p.deck.slice(0, 3);
        if (look.length > 0) state.pending = { type: 'catacombs', player: pi, cards: look.slice() };
        break;
      }
      case 'graverobber': // 二択：廃棄置き場の$3-6を山札の上へ／手札のアクション廃棄→+$3まで獲得
        state.pending = { type: 'graverobber', stage: 'choose', player: pi };
        break;
      case 'rebuild': // +1アクション。カード名を指定→指定以外の勝利点を廃棄→+$3まで高い勝利点を獲得
        addActions(t, 1);
        state.pending = { type: 'rebuild', stage: 'name', player: pi };
        break;
      case 'count': // 独立2段階の三択（前半：2枚捨て/1枚山札上/銅貨獲得、後半：+$3/手札全廃棄/公領獲得）
        state.pending = { type: 'count', stage: 'part1', player: pi };
        break;
      case 'death_cart': // これ自身か手札のアクション1枚を廃棄してよい→廃棄したら+$5（on-gainは廃墟2枚）
        //   self＝「これ」を廃棄できるか。命令で動かさずに使った場合と、玉座の2回目（既に廃棄済み）は false。
        //   「手札のアクションを廃棄して +$5」は場所が明示されているので命令経由でも可能（公式・E8）。
        state.pending = { type: 'death_cart', player: pi, self: !playedByCommand(state, pi, 'death_cart') && p.inPlay.includes('death_cart') };
        break;
      case 'band_of_misfits': // 命令：サプライの「これより安い・非Command・非持続アクション」をサプライに残したまま使う
        // 玉座/王の宮廷/行進/御料車で再演されたときは「1回目に選んだカード」を必ずもう一度使う（公式ルーリング）。
        if (replayCommandAs(state, pi, 'band_of_misfits')) break;
        if (bandOfMisfitsTargets(state).length) state.pending = { type: 'band_of_misfits', player: pi };
        break;
      case 'hermit': // 捨て札/手札の非財宝1枚を廃棄してよい→コスト3以下を獲得（購入フェイズ終了時に無獲得なら狂人と交換）
        state.pending = { type: 'hermit', stage: 'trash', player: pi };
        break;
      case 'procession': // 手札の非持続アクションを2回使う→廃棄→ちょうど+$1高いアクションを獲得（使わなくてよい）
        if (p.hand.some((c) => DOM.isType(c, 'action') && !DOM.isType(c, 'duration'))) state.pending = { type: 'procession', player: pi };
        break;
      case 'marauder': { // 戦利品を獲得（自分）＋各相手が廃墟を獲得（アタック）
        if (gain(state, pi, 'spoils', 'discard')) log(state, `${p.name} は略奪者で戦利品を獲得した。`);
        const q = []; for (let k = 1; k < state.players.length; k++) q.push((pi + k) % state.players.length);
        marauderEnterVictim(state, pi, q);
        break;
      }
      case 'cultist': { // +2カード。各相手が廃墟を獲得。手札の狂信者を連鎖使用してよい（on-trashで+3カード）
        draw(state, pi, 2);
        const q = []; for (let k = 1; k < state.players.length; k++) q.push((pi + k) % state.players.length);
        cultistEnterVictim(state, pi, q);
        break;
      }
      case 'pillage': { // これを廃棄→戦利品2枚＋手札5枚以上の各相手が手札公開→使用者が1枚捨てさせる
        if (!takeSelf(state, pi, 'pillage')) break; // 場に無い（玉座2回目/命令で動かさずに使用）＝If you did が偽
        trashCard(state, pi, 'pillage');
        let g = 0; for (let i = 0; i < 2; i++) if (gain(state, pi, 'spoils', 'discard')) g++;
        if (g) log(state, `${p.name} は略奪で戦利品 ${g}枚 を獲得した。`);
        const q = []; for (let k = 1; k < state.players.length; k++) q.push((pi + k) % state.players.length);
        pillageEnterVictim(state, pi, q);
        break;
      }
      case 'rogue': { // +$2。廃棄置き場に$3-6があれば1枚獲得（使用者）／無ければ各相手の山札上2枚から$3-6を廃棄
        addCoins(state, 2);
        const inRange = (state.trash || []).some((c) => { const cc = cardCost(state, c); return cc >= 3 && cc <= 6 && potionCost(c) === 0; });
        if (inRange) {
          state.pending = { type: 'rogue', stage: 'gain_from_trash', player: pi };
        } else {
          const q = []; for (let k = 1; k < state.players.length; k++) q.push((pi + k) % state.players.length);
          rogueEnterVictim(state, pi, q);
        }
        break;
      }
      case 'urchin': { // +1カード +1アクション。各相手が手札4枚まで捨てる（別アタックのプレイで傭兵化トリガー）
        draw(state, pi, 1); addActions(t, 1);
        const others = [];
        for (let k = 1; k < state.players.length; k++) { const idx = (pi + k) % state.players.length; if (state.players[idx].hand.length > 4 && !attackImmune(state, idx)) others.push(idx); }
        discardDownEnter(state, pi, 4, others);
        break;
      }
      case 'mercenary': // 手札からちょうど2枚廃棄してよい→+2カード +$2＋各相手が手札3枚まで捨てる（1枚しかなくても廃棄選択は可・効果は不発）
        if (p.hand.length >= 1) state.pending = { type: 'mercenary', stage: 'trash', player: pi };
        break;
      // 騎士10種（混合山アタック）＝共通アタックの前に各自の追加効果。
      case 'dame_josephine': startKnightAttack(state, pi, 'dame_josephine'); break; // 2VPは vpOf 自動
      case 'sir_vander':     startKnightAttack(state, pi, 'sir_vander'); break;     // on-trashで金貨（既存）
      case 'dame_molly': addActions(t, 2); startKnightAttack(state, pi, 'dame_molly'); break;
      case 'dame_sylvia': addCoins(state, 2); startKnightAttack(state, pi, 'dame_sylvia'); break;
      case 'sir_bailey': draw(state, pi, 1); addActions(t, 1); startKnightAttack(state, pi, 'sir_bailey'); break;
      case 'sir_destry': draw(state, pi, 2); startKnightAttack(state, pi, 'sir_destry'); break;
      case 'sir_martin': t.buys += 2; startKnightAttack(state, pi, 'sir_martin'); break;
      case 'dame_anna': // 手札から最大2枚を廃棄してよい→アタック
        state.pending = { type: 'dame_anna_trash', player: pi };
        break;
      case 'dame_natalie': // コスト3以下を獲得してよい→アタック
        if (anyGainable(state, (id) => costUpTo(state, id, 3))) state.pending = { type: 'dame_natalie_gain', player: pi };
        else startKnightAttack(state, pi, 'dame_natalie');
        break;
      case 'sir_michael': { // 各相手が手札3枚まで捨てる→（連鎖して）騎士アタック
        const others = [];
        for (let k = 1; k < state.players.length; k++) { const idx = (pi + k) % state.players.length; if (state.players[idx].hand.length > 3 && !attackImmune(state, idx)) others.push(idx); }
        discardDownEnter(state, pi, 3, others, 'knight:sir_michael');
        break;
      }

      /* ===== 拡張: 海辺（Seaside 第二版）===== */
      // --- バニラ系（即時のみ・非対話）---
      case 'bazaar':
        draw(state, pi, 1); addActions(t, 2); addCoins(state, 1);
        break;
      // --- バニラ持続（即時＋次手番予約）---
      case 'fishing_village':
        addActions(t, 2); addCoins(state, 1);
        armDuration(state, pi, 'fishing_village');
        break;
      case 'caravan':
        draw(state, pi, 1); addActions(t, 1);
        armDuration(state, pi, 'caravan');
        break;
      case 'merchant_ship':
        addCoins(state, 2);
        armDuration(state, pi, 'merchant_ship');
        break;
      case 'wharf':
        draw(state, pi, 2); t.buys += 1;
        armDuration(state, pi, 'wharf');
        break;
      case 'lighthouse':
        addActions(t, 1); addCoins(state, 1);
        armDuration(state, pi, 'lighthouse'); // 次手番 +1コイン。場/持続にある間アタック無効（attackImmune）
        break;
      case 'tide_pools':
        draw(state, pi, 3); addActions(t, 1);
        armDuration(state, pi, 'tide_pools'); // 次手番開始時に手札2枚を捨てる（対話）
        break;

      // --- 対話系（手札の選択を伴う）---
      case 'warehouse':
        draw(state, pi, 3); addActions(t, 1);
        if (p.hand.length > 0) state.pending = { type: 'warehouse', player: pi };
        break;
      case 'haven':
        draw(state, pi, 1); addActions(t, 1);
        if (p.hand.length > 0) state.pending = { type: 'haven', player: pi };
        else armDuration(state, pi, 'haven'); // 手札が空でも持続として残る（脇置きなし）
        break;
      case 'tactician':
        if (p.hand.length > 0) state.pending = { type: 'tactician', player: pi };
        // 手札が空なら何もしない＝持続化しない（捨て札へ）
        break;
      case 'salvager':
        t.buys += 1;
        if (p.hand.length > 0) state.pending = { type: 'salvager', stage: 'trash', player: pi };
        break;
      case 'lookout': {
        addActions(t, 1);
        // 山札の上3枚を見る（足りなければある分）
        const look = [];
        for (let i = 0; i < 3; i++) {
          if (p.deck.length === 0) { if (p.discard.length === 0) break; reshuffleDeck(p); }
          if (p.deck.length === 0) break;
          look.push(p.deck.shift());
        }
        if (look.length) state.pending = { type: 'lookout', stage: 'trash', player: pi, cards: look };
        break;
      }
      case 'treasure_map': {
        // これ（場のtreasure_map 1枚）と手札のtreasure_map をもう1枚廃棄できれば金貨4枚を山札の上へ。
        // 「これ」が場に無い（玉座の間/王の宮廷の2回目＝1回目で既に廃棄済み／命令で動かさずに使用）ときは何もしない。
        // ※無条件に trash へ push すると存在しないカードを生成してしまう（カード保存則違反）。
        // ※命令経由で「手札のコピーだけ空しく廃棄されるか」は公式裁定が取れていない＝廃棄しない側に倒す（§6）。
        if (!takeSelf(state, pi, 'treasure_map')) break;
        trashCard(state, pi, 'treasure_map');
        let trashedTwo = false;
        if (removeOne(p.hand, 'treasure_map')) { trashCard(state, pi, 'treasure_map'); trashedTwo = true; }
        log(state, `${p.name} は宝の地図を廃棄した${trashedTwo ? '（2枚）' : ''}。`);
        if (trashedTwo) {
          let g = 0; for (let i = 0; i < 4; i++) { if (gain(state, pi, 'gold', 'deck')) g++; }
          if (g) log(state, `${p.name} は金貨${g}枚を山札の上に獲得した（宝の地図）。`);
        }
        break;
      }
      case 'sea_chart': {
        draw(state, pi, 1); addActions(t, 1);
        // 山札の上を公開。同名カードが場（inPlay/durationCards）にあれば手札に。
        if (p.deck.length === 0 && p.discard.length > 0) { reshuffleDeck(p); }
        if (p.deck.length > 0) {
          const top = p.deck[0];
          reveal(state, pi, [top], '海図で山札の上を公開');
          if (p.inPlay.includes(top) || (p.durationCards || []).includes(top)) {
            p.deck.shift(); p.hand.push(top);
            log(state, `${p.name} は同名が場にあったため「${C()[top].name}」を手札に加えた（海図）。`);
          }
        }
        break;
      }
      case 'island':
        // 島自身を島マットへ（場のこのカードを取り除く）＋手札1枚を島マットへ。
        // 命令（王子/船長/大君主/はみだし者）で「動かさず使用」した場合、島自身は動かないが
        //   「手札から1枚」は場所が明示されているので島マットへ行く（公式・E8）。
        {
          const moved = takeSelf(state, pi, 'island');
          if (moved) p.islandMat.push('island');
          if (p.hand.length > 0) state.pending = { type: 'island', player: pi };
          else if (moved) log(state, `${p.name} は島を島マットに置いた。`);
        }
        break;
      case 'native_village':
        addActions(t, 2);
        state.pending = { type: 'native_village', player: pi };
        break;

      // --- アタック・追加ターン・フック系 ---
      case 'cutpurse': {
        addCoins(state, 2);
        const q = [];
        for (let k = 1; k < state.players.length; k++) q.push((pi + k) % state.players.length);
        cutpurseEnterVictim(state, pi, q);
        break;
      }
      case 'sea_witch': {
        draw(state, pi, 2);
        armDuration(state, pi, 'sea_witch'); // 次手番 +2カード→手札2枚捨て
        const q = [];
        for (let k = 1; k < state.players.length; k++) q.push((pi + k) % state.players.length);
        seaWitchEnterVictim(state, pi, q);
        break;
      }
      case 'monkey':
        p.monkeyActive = true; // 次の自分の手番まで、右隣の獲得ごとに +1カード
        armDuration(state, pi, 'monkey'); // 次手番 +1カード（＆窓を閉じる）
        break;
      case 'smugglers': {
        const n = state.players.length;
        const right = (pi - 1 + n) % n;
        const gains = Array.from(new Set(state.players[right].lastTurnGains || []))
          .filter((id) => costUpTo(state, id, 6)); // 非サプライ/ロック中の分割山下段/ポーション費用/負債コストは密輸できない
        if (gains.length) state.pending = { type: 'smugglers', player: pi, candidates: gains };
        else log(state, `${p.name} は密輸できるカードがなかった。`);
        break;
      }
      case 'treasury':
        draw(state, pi, 1); addActions(t, 1); addCoins(state, 1);
        // クリーンアップ時、勝利点を獲得していなければ山札の上に戻す（cleanupAndAdvance で自動処理）
        break;
      case 'outpost':
        // このターン1度だけ・追加ターン中でなければ、手札3枚の追加ターン。
        if (!t.outpostUsed && !t.isExtraTurn) {
          t.outpostUsed = true; p.outpostExtra = true;
          armDuration(state, pi, 'outpost'); // 追加ターン中、場に残すための予約（効果は無し）
          log(state, `${p.name} は前哨地で追加ターンを得る（次の手札は3枚）。`);
        }
        break;
      case 'sailor':
        addActions(t, 1);
        t.sailorPlays = (t.sailorPlays || 0) + 1; // このターン1度、獲得した持続カードを即プレイできる（船乗り1枚につき1回）
        armDuration(state, pi, 'sailor'); // 次手番 +2コイン＋任意で手札1枚廃棄
        break;
      case 'blockade':
        // 4コスト以下を獲得して脇に置く（次手番に手札へ）。場にある間、他人の同名獲得で呪い。
        if (anyGainable(state, (id) => costUpTo(state, id, 4)))
          state.pending = { type: 'blockade', stage: 'gain', player: pi };
        else armDuration(state, pi, 'blockade', { gained: null, immune: [] });
        break;
      case 'corsair':
        addCoins(state, 2);
        armDuration(state, pi, 'corsair'); // 次手番 +1カード。窓の間、相手の最初の銀/金を廃棄
        break;

      // ===== 繁栄（Prosperity 第二版）アクションカード =====
      case 'monument':
        addCoins(state, 2); p.vpTokens = (p.vpTokens || 0) + 1;
        log(state, `${p.name} は記念碑で +1勝利点。`);
        break;
      case 'workers_village':
        draw(state, pi, 1); addActions(t, 2); t.buys += 1;
        break;
      case 'magnate': {
        reveal(state, pi, p.hand, '富豪：手札を公開');
        const tre = p.hand.filter((c) => isTreasureFor(state, c)).length;
        if (tre) draw(state, pi, tre);
        log(state, `${p.name} は富豪で手札を公開（財宝${tre}枚）→ +${tre}カード。`);
        break;
      }
      case 'city': {
        draw(state, pi, 1); addActions(t, 2);
        const empties = emptyPileCount(state);
        if (empties >= 1) draw(state, pi, 1);
        if (empties >= 2) { t.buys += 1; addCoins(state, 1); }
        break;
      }
      case 'grand_market':
        draw(state, pi, 1); addActions(t, 1); t.buys += 1; addCoins(state, 2);
        break;
      case 'peddler':
        draw(state, pi, 1); addActions(t, 1); addCoins(state, 1);
        break;
      case 'watchtower':
        // 手札が6枚になるまで引く（空なら止める）
        { let g = 0; while (p.hand.length < 6 && g++ < 30) { const b = p.hand.length; draw(state, pi, 1); if (p.hand.length === b) break; } }
        break;
      case 'bishop':
        addCoins(state, 1); p.vpTokens = (p.vpTokens || 0) + 1;
        log(state, `${p.name} は司教で +1勝利点。`);
        // 手札1枚を廃棄（コスト$2につき+VP）。その後 他プレイヤーが任意で手札1枚廃棄。
        // 手札が空なら廃棄は飛ばして「他プレイヤーの廃棄」へ（空手札でデッドロックさせない）。
        if (p.hand.length > 0) { state.pending = { type: 'bishop', stage: 'trash', player: pi }; }
        else { const q = []; for (let k = 1; k < state.players.length; k++) q.push((pi + k) % state.players.length); bishopOthersEnter(state, q); }
        break;
      case 'vault':
        draw(state, pi, 2);
        state.pending = { type: 'vault', stage: 'discard', player: pi }; // 好きな枚数捨てて+コイン
        break;
      case 'mint':
        if (p.hand.some((c) => isTreasureFor(state, c))) state.pending = { type: 'mint', player: pi };
        break;
      case 'expand':
        if (p.hand.length > 0) state.pending = { type: 'expand', stage: 'trash', player: pi };
        break;
      case 'forge':
        state.pending = { type: 'forge', stage: 'trash', player: pi }; // 任意枚数廃棄→合計コストちょうどを獲得
        break;
      case 'kings_court':
        if (p.hand.some((c) => DOM.isType(c, 'action'))) state.pending = { type: 'kings_court', player: pi };
        break;
      case 'rabble': {
        draw(state, pi, 3);
        const q = [];
        for (let k = 1; k < state.players.length; k++) q.push((pi + k) % state.players.length);
        rabbleEnterVictim(state, pi, q);
        break;
      }
      case 'clerk': {
        addCoins(state, 2);
        const q = [];
        for (let k = 1; k < state.players.length; k++) q.push((pi + k) % state.players.length);
        clerkEnterVictim(state, pi, q);
        break;
      }
      case 'war_chest': {
        // 左隣がカード名を1つ指定 → コスト$5以下で「このターン軍用金で指定されていない」カードを1枚獲得
        const left = (pi + 1) % state.players.length;
        state.pending = { type: 'war_chest', stage: 'name', player: left, source: pi };
        break;
      }

      /* ===== 拡張: 錬金術（Alchemy 第二版）===== */
      case 'transmute':
        // 手札1枚を廃棄→種類ごとに獲得（アクション→公領／財宝→変成／勝利点→金貨）。
        if (p.hand.length > 0) state.pending = { type: 'transmute', player: pi };
        break;
      case 'herbalist':
        t.buys += 1; addCoins(state, 1);
        // このターンの片付けで、場の財宝を（薬草商の数だけ）山札の上に置いてよい（cleanupで自動処理）。
        t.herbalists = (t.herbalists || 0) + 1;
        break;
      case 'apothecary': {
        draw(state, pi, 1); addActions(t, 1);
        // 山札の上4枚を公開し、銅貨とポーションを手札に、残りを好きな順で山札の上に戻す。
        const revealed = [];
        for (let i = 0; i < 4; i++) {
          if (p.deck.length === 0) { if (p.discard.length === 0) break; reshuffleDeck(p); }
          if (p.deck.length === 0) break;
          revealed.push(p.deck.shift());
        }
        if (revealed.length) reveal(state, pi, revealed, '薬剤師で山札の上を公開');
        const rest = [];
        revealed.forEach((c) => { if (c === 'copper' || c === 'potion') p.hand.push(c); else rest.push(c); });
        if (revealed.length) log(state, `${p.name} は薬剤師で ${revealed.length}枚 を公開し、銅貨・ポーションを手札に加えた。`);
        if (rest.length >= 2) state.pending = { type: 'apothecary', player: pi, cards: rest }; // 2枚以上は並べ替え
        else if (rest.length === 1) p.deck.unshift(rest[0]);
        break;
      }
      case 'scrying_pool': {
        addActions(t, 1);
        const q = [pi];
        for (let k = 1; k < state.players.length; k++) q.push((pi + k) % state.players.length);
        scryingEnterTarget(state, pi, q);
        break;
      }
      case 'university':
        addActions(t, 2);
        // コスト5以下のアクションカードを獲得してよい（任意）。ポーション費用/負債コストのカードは$5に含めない（公式）。
        if (anyGainable(state, (id) => costUpTo(state, id, 5) && isTypeSupply(state, id, 'action')))
          state.pending = { type: 'university', player: pi };
        break;
      case 'alchemist':
        draw(state, pi, 2); addActions(t, 1);
        // 片付け開始時、場にポーションがあればこれを山札の上に置く（cleanupで自動処理）。
        break;
      case 'familiar': {
        draw(state, pi, 1); addActions(t, 1);
        const vics = [];
        for (let k = 1; k < state.players.length; k++) vics.push((pi + k) % state.players.length);
        familiarEnterVictim(state, pi, vics);
        break;
      }
      case 'golem': {
        // ゴーレム以外のアクションが2枚出るまで山札を公開。残りを捨て、その2枚を好きな順で使う。
        const found = []; const aside = []; let guard = 0;
        while (found.length < 2 && guard++ < 200) {
          if (p.deck.length === 0) { if (p.discard.length === 0) break; reshuffleDeck(p); }
          if (p.deck.length === 0) break;
          const c = p.deck.shift();
          if (c !== 'golem' && DOM.isType(c, 'action')) found.push(c);
          else aside.push(c); // ゴーレム自身・非アクションは脇へ→捨てる
        }
        if (found.concat(aside).length) reveal(state, pi, found.concat(aside), 'ゴーレムで公開');
        aside.forEach((c) => p.discard.push(c));
        log(state, `${p.name} はゴーレムでアクション ${found.length}枚 を見つけた。`);
        if (found.length === 2) state.pending = { type: 'golem', player: pi, cards: found }; // 使う順を選ぶ
        else if (found.length === 1) golemPlay(state, pi, found[0], null);
        break;
      }
      case 'apprentice':
        addActions(t, 1);
        // 手札1枚を廃棄→コスト$1につき+1カード（ポーション費用ありなら+2カード）。
        if (p.hand.length > 0) state.pending = { type: 'apprentice', player: pi };
        break;
      case 'possession': {
        // 支配：左隣がこのターンの後に追加ターンを行い、その間あなたが全ての決定を行う。
        const victim = (pi + 1) % state.players.length;
        // 連鎖支配：既に被支配中のターンで支配をプレイした場合も、操作は「元の支配者」が続ける
        // （pi=被支配者ではなく現在の操作者 t.possessedBy を引き継ぐ）。
        const controller = t.possessedBy != null ? t.possessedBy : pi;
        (state.extraTurns = state.extraTurns || []).push({ seat: victim, possessedBy: controller, rotationSeat: t.rotationSeat != null ? t.rotationSeat : pi });
        log(state, `${p.name} は支配を使った（${state.players[victim].name} の追加ターンを ${state.players[controller].name} が操作する）。`);
        break;
      }

      /* ===== 拡張: 収穫祭 ===== */
      case 'hamlet':
        draw(state, pi, 1);
        addActions(t, 1);
        // 手札1枚を捨てて+1アクション、もう1枚を捨てて+1購入（それぞれ任意）
        if (p.hand.length > 0) state.pending = { type: 'hamlet', stage: 'action', player: pi };
        break;
      case 'fortune_teller': {
        addCoins(state, 2);
        const q = [];
        for (let k = 1; k < state.players.length; k++) q.push((pi + k) % state.players.length);
        fortuneTellerEnterVictim(state, pi, q);
        break;
      }
      case 'menagerie': {
        addActions(t, 1);
        reveal(state, pi, p.hand.slice(), '移動動物園で手札を公開');
        const dup = p.hand.length !== new Set(p.hand).size;
        draw(state, pi, dup ? 1 : 3);
        log(state, `${p.name} は移動動物園で手札を公開（${dup ? '同名あり→+1カード' : '同名なし→+3カード'}）。`);
        break;
      }
      case 'farming_village': {
        addActions(t, 2);
        const { matched, skipped } = revealFromDeck(state, pi, (c) => DOM.isType(c, 'action') || isTreasureFor(state, c));
        const shown = skipped.concat(matched ? [matched] : []);
        if (shown.length) reveal(state, pi, shown, '農村で公開');
        skipped.forEach((c) => p.discard.push(c));
        if (matched) { p.hand.push(matched); log(state, `${p.name} は農村で「${C()[matched].name}」を手札に加え、${skipped.length}枚を捨てた。`); }
        else log(state, `${p.name} は農村でアクション/財宝が出ず、${skipped.length}枚を捨てた。`);
        break;
      }
      case 'horse_traders':
        t.buys += 1;
        addCoins(state, 3);
        // 手札2枚を捨てる（手札があれば必須）
        if (p.hand.length > 0) state.pending = { type: 'horse_traders', stage: 'discard', player: pi };
        break;
      case 'remake':
        if (p.hand.length > 0) state.pending = { type: 'remake', stage: 'trash', player: pi, iter: 0 };
        break;
      case 'tournament':
        addActions(t, 1);
        tournamentStart(state, pi);
        break;
      case 'young_witch':
        draw(state, pi, 2);
        // 自分の手札を2枚捨てる → その後アタック
        if (p.hand.length > 0) state.pending = { type: 'young_witch', stage: 'discard', player: pi, source: pi };
        else youngWitchLaunch(state, pi);
        break;
      case 'harvest': {
        const revealed = [];
        for (let i = 0; i < 4; i++) {
          if (p.deck.length === 0) { if (p.discard.length === 0) break; reshuffleDeck(p); }
          if (p.deck.length === 0) break;
          revealed.push(p.deck.shift());
        }
        if (revealed.length) reveal(state, pi, revealed.slice(), '収穫で公開');
        revealed.forEach((c) => p.discard.push(c));
        const distinct = new Set(revealed).size;
        addCoins(state, distinct);
        log(state, `${p.name} は収穫で${revealed.length}枚公開（異なる名前${distinct}種→+${distinct}コイン）。`);
        break;
      }
      case 'hunting_party': {
        draw(state, pi, 1);
        addActions(t, 1);
        const handNames = new Set(p.hand);
        reveal(state, pi, p.hand.slice(), '狩猟団で手札を公開');
        const { matched, skipped } = revealFromDeck(state, pi, (c) => !handNames.has(c));
        const shown = skipped.concat(matched ? [matched] : []);
        if (shown.length) reveal(state, pi, shown, '狩猟団で公開');
        skipped.forEach((c) => p.discard.push(c));
        if (matched) { p.hand.push(matched); log(state, `${p.name} は狩猟団で「${C()[matched].name}」を手札に加え、${skipped.length}枚を捨てた。`); }
        else log(state, `${p.name} は狩猟団で手札に無い札が出ず、${skipped.length}枚を捨てた。`);
        break;
      }
      case 'jester': {
        addCoins(state, 2);
        const q = [];
        for (let k = 1; k < state.players.length; k++) q.push((pi + k) % state.players.length);
        jesterEnterVictim(state, pi, q);
        break;
      }

      /* ===== 賞品（Prize・馬上槍試合の専用山） ===== */
      case 'bag_of_gold':
        addActions(t, 1);
        if (gain(state, pi, 'gold', 'deck')) log(state, `${p.name} は金貨を山札の上に獲得した（金貨袋）。`);
        break;
      case 'followers':
        draw(state, pi, 2);
        if (gain(state, pi, 'estate', 'discard')) log(state, `${p.name} は屋敷を獲得した（家臣団）。`);
        {
          const q = [];
          for (let k = 1; k < state.players.length; k++) q.push((pi + k) % state.players.length);
          followersEnterVictim(state, pi, q);
        }
        break;
      case 'princess':
        t.buys += 1;
        // 「場にある間、全カードのコスト -2」は cardCost が princess の場残数で処理（このカードは既に inPlay）。
        log(state, `${p.name} は王女を使った（このターン、場にある間 全カードのコスト -2）。`);
        break;
      case 'trusty_steed':
        state.pending = { type: 'trusty_steed', player: pi };
        break;

      /* ===== ギルド（Guilds）===== */
      case 'candlestick_maker':
        addActions(t, 1); t.buys += 1;
        p.coffers = (p.coffers || 0) + 1;
        log(state, `${p.name} は蝋燭職人で +1財源。`);
        break;
      case 'stonemason':
        // 手札1枚を廃棄→それより安いカードを2枚獲得（手札があれば必須）。
        if (p.hand.length > 0) state.pending = { type: 'stonemason', stage: 'trash', player: pi };
        break;
      case 'doctor':
        // カードを1つ指定→山札の上3枚を公開→同名を全て廃棄→残りを好きな順で山札の上へ。
        state.pending = { type: 'doctor', stage: 'name', player: pi };
        break;
      case 'advisor': {
        addActions(t, 1);
        const look = [];
        for (let i = 0; i < 3; i++) {
          if (p.deck.length === 0) { if (p.discard.length === 0) break; reshuffleDeck(p); }
          if (p.deck.length === 0) break;
          look.push(p.deck.shift());
        }
        if (look.length) {
          reveal(state, pi, look, '助言者で山札の上を公開');
          // 左隣（次の席）が1枚を選んで捨てさせる。残りは使用者の手札へ。
          const left = (pi + 1) % state.players.length;
          state.pending = { type: 'advisor', player: left, source: pi, cards: look };
        }
        break;
      }
      case 'plaza':
        draw(state, pi, 1); addActions(t, 2);
        if (p.hand.some((c) => isTreasureFor(state, c))) state.pending = { type: 'plaza', player: pi };
        break;
      case 'taxman':
        // 手札に財宝があれば「廃棄してよい」選択を出す（無ければ何も起きない）。
        if (p.hand.some((c) => isTreasureFor(state, c))) state.pending = { type: 'taxman', stage: 'trash', player: pi };
        break;
      case 'herald': {
        draw(state, pi, 1); addActions(t, 1);
        // 山札の一番上を公開。アクションならそれをプレイする（アクション権は消費しない）。
        if (p.deck.length === 0 && p.discard.length > 0) { reshuffleDeck(p); }
        if (p.deck.length > 0) {
          const top = p.deck[0];
          reveal(state, pi, [top], '伝令官で山札の上を公開');
          if (DOM.isType(top, 'action')) {
            p.deck.shift();
            p.inPlay.push(top);
            t.actionsPlayed = (t.actionsPlayed || 0) + 1;
            log(state, `${p.name} は伝令官で「${C()[top].name}」をプレイした。`);
            applyEffect(state, top, pi); // 別の選択待ちが立つこともある
          }
        }
        break;
      }
      case 'baker':
        draw(state, pi, 1); addActions(t, 1);
        p.coffers = (p.coffers || 0) + 1;
        log(state, `${p.name} はパン屋で +1財源。`);
        break;
      case 'butcher':
        p.coffers = (p.coffers || 0) + 2;
        log(state, `${p.name} は肉屋で +2財源。`);
        if (p.hand.length > 0) state.pending = { type: 'butcher', stage: 'trash', player: pi };
        break;
      case 'journeyman':
        state.pending = { type: 'journeyman', stage: 'name', player: pi };
        break;
      case 'merchant_guild':
        t.buys += 1; addCoins(state, 1);
        // 「使うたびに累積」＝このターンの使用回数を記録。購入のたびに triggerMerchantGuild が回数ぶん財源を付与。
        t.merchantGuildPlays = (t.merchantGuildPlays || 0) + 1;
        break;
      case 'soothsayer': {
        if (gain(state, pi, 'gold', 'discard')) log(state, `${p.name} は金貨を獲得した（予言者）。`);
        const q = [];
        for (let k = 1; k < state.players.length; k++) q.push((pi + k) % state.players.length);
        soothsayerEnterVictim(state, pi, q);
        break;
      }

      /* ===== 拡張: 異郷（Hinterlands）===== */
      case 'crossroads': {
        reveal(state, pi, p.hand, '岐路で手札を公開');
        const vics = p.hand.filter((c) => DOM.isType(c, 'victory')).length;
        if (vics) draw(state, pi, vics);
        const first = !t.crossroadsPlayed;
        if (first) addActions(t, 3);
        t.crossroadsPlayed = (t.crossroadsPlayed || 0) + 1;
        log(state, `${p.name} は岐路（勝利点${vics}枚 → +${vics}カード${first ? '、初回 +3アクション' : ''}）。`);
        break;
      }
      case 'duchess': {
        addCoins(state, 2);
        const q = [];
        for (let k = 0; k < state.players.length; k++) q.push((pi + k) % state.players.length);
        duchessEnter(state, q);
        break;
      }
      case 'develop':
        if (p.hand.length > 0) state.pending = { type: 'develop', stage: 'trash', player: pi };
        break;
      case 'oasis':
        draw(state, pi, 1); addActions(t, 1); addCoins(state, 1);
        if (p.hand.length > 0) state.pending = { type: 'oasis', player: pi };
        break;
      case 'oracle': {
        const q = [];
        for (let k = 0; k < state.players.length; k++) q.push((pi + k) % state.players.length);
        oracleEnterTarget(state, pi, q);
        break;
      }
      case 'scheme':
        draw(state, pi, 1); addActions(t, 1);
        t.schemes = (t.schemes || 0) + 1;
        break;
      case 'jack_of_all_trades': {
        if (gain(state, pi, 'silver', 'discard')) log(state, `${p.name} は銀貨を獲得した（何でも屋）。`);
        if (p.deck.length === 0 && p.discard.length > 0) { reshuffleDeck(p); }
        if (p.deck.length > 0) state.pending = { type: 'jack', stage: 'look', player: pi, card: p.deck[0] };
        else jackDrawTo5(state, pi);
        break;
      }
      case 'noble_brigand':
        addCoins(state, 1);
        nobleBrigandAttack(state, pi);
        break;
      case 'nomad_camp':
        t.buys += 1; addCoins(state, 2);
        break;
      case 'spice_merchant':
        if (p.hand.some((c) => isTreasureFor(state, c))) state.pending = { type: 'spice_merchant', stage: 'trash', player: pi };
        break;
      case 'trader':
        if (p.hand.length > 0) state.pending = { type: 'trader', stage: 'trash', player: pi };
        break;
      case 'cartographer': {
        draw(state, pi, 1); addActions(t, 1);
        const look = [];
        for (let i = 0; i < 4; i++) { if (p.deck.length === 0) { if (p.discard.length === 0) break; reshuffleDeck(p); } if (p.deck.length === 0) break; look.push(p.deck.shift()); }
        if (look.length) state.pending = { type: 'cartographer', player: pi, cards: look };
        break;
      }
      case 'embassy':
        draw(state, pi, 5);
        if (p.hand.length > 0) state.pending = { type: 'embassy', player: pi };
        break;
      case 'haggler':
        addCoins(state, 2);
        break;
      case 'highway':
        draw(state, pi, 1); addActions(t, 1);
        break;
      case 'inn':
        draw(state, pi, 2); addActions(t, 2);
        if (p.hand.length > 0) state.pending = { type: 'inn', player: pi };
        break;
      case 'mandarin':
        addCoins(state, 3);
        if (p.hand.length > 0) state.pending = { type: 'mandarin', player: pi };
        break;
      case 'margrave': {
        draw(state, pi, 3); t.buys += 1;
        const q = [];
        for (let k = 1; k < state.players.length; k++) q.push((pi + k) % state.players.length);
        margraveEnterVictim(state, pi, q);
        break;
      }
      case 'stables':
        if (p.hand.some((c) => isTreasureFor(state, c))) state.pending = { type: 'stables', player: pi };
        break;
      case 'border_village':
        draw(state, pi, 1); addActions(t, 2);
        break;
      case 'nomads':
        t.buys += 1; addCoins(state, 2);
        break;
      case 'trail':
        draw(state, pi, 1); addActions(t, 1);
        break;
      case 'weaver':
        state.pending = { type: 'weaver', player: pi };
        break;
      case 'souk': {
        t.buys += 1;
        const add = Math.max(0, 7 - p.hand.length);
        addCoins(state, add);
        log(state, `${p.name} はスーク（+1購入、+${add}コイン）。`);
        break;
      }
      case 'guard_dog':
        draw(state, pi, 2);
        if (p.hand.length <= 5) draw(state, pi, 2);
        break;
      case 'berserker': {
        const maxC = cardCost(state, 'berserker') - 1;
        if (anyGainable(state, (id) => costUpTo(state, id, maxC))) {
          state.pending = { type: 'berserker', stage: 'gain', player: pi, maxCost: maxC };
        } else {
          berserkerLaunchAttack(state, pi);
        }
        break;
      }
      case 'wheelwright':
        draw(state, pi, 1); addActions(t, 1);
        if (p.hand.length > 0) state.pending = { type: 'wheelwright', stage: 'discard', player: pi };
        break;
      case 'witchs_hut':
        draw(state, pi, 4);
        state.pending = { type: 'witchs_hut', stage: 'discard', player: pi };
        break;

      /* ===== 拡張: 冒険（Adventures）段階2 ===== */
      // 港町：+1カード +2アクション（購入時にもう1枚獲得＝BUY で処理）。
      case 'port':
        draw(state, pi, 1); addActions(t, 2);
        break;
      // 失われし都市：+2カード +2アクション（獲得時に他の各プレイヤー+1カード＝triggerOnGain で処理）。
      case 'lost_city':
        draw(state, pi, 2); addActions(t, 2);
        break;
      // カササギ：+1カード +1アクション。山札の上を公開＝財宝なら手札へ／アクションか勝利点ならカササギを獲得。
      case 'magpie': {
        draw(state, pi, 1); addActions(t, 1);
        if (p.deck.length === 0 && p.discard.length > 0) reshuffleDeck(p);
        if (p.deck.length > 0) {
          const top = p.deck[0];
          reveal(state, pi, [top], 'カササギで山札の上を公開');
          if (isTreasureFor(state, top)) { p.deck.shift(); p.hand.push(top); log(state, `${p.name} は「${C()[top].name}」を手札に加えた（カササギ）。`); }
          if (DOM.isType(top, 'action') || DOM.isType(top, 'victory')) { if (gain(state, pi, 'magpie', 'discard')) log(state, `${p.name} はカササギを1枚獲得した。`); }
        }
        break;
      }
      // 雇人：ゲーム終了までの自分の各ターン開始時 +1カード（永続持続。princes と同型で cnt に加算し場に残す）。
      //   即時効果は無い（「各ターン開始時」＝次の手番から）。armDuration は使わず p.hirelings で稼働数を持つ。
      case 'hireling':
        p.hirelings = (p.hirelings || 0) + 1;
        break;
      // 地下牢：+1アクション。今と次のターン開始時にそれぞれ +2カードの後 手札2枚を捨てる。
      case 'dungeon':
        addActions(t, 1);
        draw(state, pi, 2);
        armDuration(state, pi, 'dungeon');
        if (p.hand.length > 0) state.pending = { type: 'dungeon_discard', player: pi };
        break;
      // 道具：+2カード。手札から最大2枚を裏向きに脇へ→次のターン開始時に手札へ戻す。
      case 'gear':
        draw(state, pi, 2);
        if (p.hand.length > 0) state.pending = { type: 'gear', player: pi };
        break;
      // 魔除け：今と次のターン開始時にそれぞれ、+$1／手札1枚を廃棄／銀貨1枚を獲得 から1つ選ぶ（持続）。
      case 'amulet':
        armDuration(state, pi, 'amulet');
        state.pending = { type: 'amulet', player: pi };
        break;
      // 隊商の護衛：+1カード +1アクション。次の手番開始時 +$1（持続）。他Pのアタック時は手札から先にプレイできる（リアクション＝hasReaction/CARAVAN_GUARD_REACT）。
      case 'caravan_guard':
        draw(state, pi, 1); addActions(t, 1);
        armDuration(state, pi, 'caravan_guard');
        break;
      // 呪いの森：即効果なし。次の手番まで他Pの購入時に手札を全て山札の上へ（アタック持続）。次の手番開始時 +3カード。
      case 'haunted_woods': {
        const rid = (state._lingerSeq = (state._lingerSeq | 0) + 1); // 予約の一意id（玉座で複数並ぶときの免疫スコープ用）
        armDuration(state, pi, 'haunted_woods', { immune: [], rid });
        const q = []; for (let k = 1; k < state.players.length; k++) q.push((pi + k) % state.players.length);
        lingerAttackEnter(state, pi, 'haunted_woods', q, rid);
        break;
      }
      // 沼の妖婆：即効果なし。次の手番まで他Pの購入時に呪い1枚を獲得させる（アタック持続）。次の手番開始時 +$3。
      case 'swamp_hag': {
        const rid = (state._lingerSeq = (state._lingerSeq | 0) + 1);
        armDuration(state, pi, 'swamp_hag', { immune: [], rid });
        const q = []; for (let k = 1; k < state.players.length; k++) q.push((pi + k) % state.players.length);
        lingerAttackEnter(state, pi, 'swamp_hag', q, rid);
        break;
      }
      /* ========== 冒険：複雑系（倒壊/工匠/語り部/使者） ========== */
      // 倒壊raze：+1アクション。これか手札1枚を廃棄→廃棄カードのコイン分だけ山札の上を見て1枚を手札・残りを捨てる。
      //   廃棄対象が無い（玉座2回目で raze が場に無く手札も空）ときは何もしない＝pending を立てない。
      //   self＝「これ」を廃棄できるか（命令で動かさずに使った場合は false＝手札からしか廃棄できない・公式）。
      case 'raze': {
        addActions(t, 1);
        const canSelf = !playedByCommand(state, pi, 'raze') && p.inPlay.includes('raze');
        if (canSelf || p.hand.length > 0) state.pending = { type: 'raze', stage: 'trash', player: pi, self: canSelf };
        break;
      }
      // 工匠artificer：+1カード +1アクション +$1。手札を好きな枚数捨て→捨てた枚数ちょうどのコストのカード1枚を山札の上に獲得してよい。
      case 'artificer':
        draw(state, pi, 1); addActions(t, 1); addCoins(state, 1);
        state.pending = { type: 'artificer', stage: 'discard', player: pi };
        break;
      // 語り部storyteller：+1アクション。手札から最大3枚の財宝をプレイ→その後 所持コイン$1につき+1カード（コインを全て使い切る）。
      case 'storyteller':
        addActions(t, 1);
        if (p.hand.some((c) => isTreasureFor(state, c))) state.pending = { type: 'storyteller', player: pi };
        else { t.storytellerResume = { player: pi, queue: [] }; storytellerStep(state, pi); } // 財宝が無ければ即コイン→カード
        break;
      // 使者messenger：+1購入 +$2。自分の山札を捨て札にしてよい（購入時の配布は BUY 側）。
      case 'messenger':
        t.buys += 1; addCoins(state, 2);
        if (p.deck.length > 0) state.pending = { type: 'messenger_play', player: pi };
        break;
      // 山守：+1購入。旅トークンを裏返す（表向きから始まる）。その後、表向きなら +5カード。
      //   ＝先に裏返してから判定するので、初回プレイは裏になり+5なし、2回目は表になり+5（以後交互）。
      case 'ranger':
        t.buys += 1;
        p.journeyDown = !p.journeyDown;
        if (!p.journeyDown) { draw(state, pi, 5); log(state, `${p.name} は山守で旅トークンを表にして +5カード。`); }
        else log(state, `${p.name} は山守で旅トークンを裏にした（+5カードは無し）。`);
        break;
      // 巨人：旅トークンを裏返す。裏向きになったら +$1。表向きなら +$5＋アタック
      //   （他の各プレイヤーは山札の一番上を公開し、$3〜$6なら廃棄・そうでなければ捨てて呪いを獲得）。
      case 'giant':
        p.journeyDown = !p.journeyDown;
        if (p.journeyDown) { addCoins(state, 1); log(state, `${p.name} は巨人で旅トークンを裏にして +$1。`); }
        else {
          addCoins(state, 5); log(state, `${p.name} は巨人で旅トークンを表にして +$5（アタック）。`);
          const vics = [];
          for (let k = 1; k < state.players.length; k++) vics.push((pi + k) % state.players.length);
          giantEnterVictim(state, pi, vics);
        }
        break;
      // 橋の下のトロル：他の各プレイヤーは -$1トークンを受け取る（アタック）。今と次のターン開始時にそれぞれ +1購入。
      //   このターンと次のターン、カードのコストは$1安くなる（$0未満にはならない・持続）。
      case 'bridge_troll': {
        t.buys += 1;
        t.costReduction = (t.costReduction || 0) + 1;
        armDuration(state, pi, 'bridge_troll'); // 次の手番開始時：+1購入＋コスト軽減の継続
        const vics = [];
        for (let k = 1; k < state.players.length; k++) vics.push((pi + k) % state.players.length);
        bridgeTrollEnterVictim(state, pi, vics);
        break;
      }
      // 冒険：Reserve（酒場マット）カード。プレイ時の効果の後、これを酒場マットへ置く。呼び出しは別タイミング。
      // 鼠取り：+1カード +1アクション → マットへ（開始時に呼び出して手札1枚廃棄）。
      case 'ratcatcher':
        draw(state, pi, 1); addActions(t, 1);
        putOnTavern(state, pi, 'ratcatcher');
        break;
      // 案内人：+1カード +1アクション → マットへ（開始時に呼び出して手札を全捨て5枚引く）。
      case 'guide':
        draw(state, pi, 1); addActions(t, 1);
        putOnTavern(state, pi, 'guide');
        break;
      // 変容：+1アクション → マットへ（開始時に呼び出して手札1枚廃棄→コスト+$1以下を手札に獲得）。
      case 'transmogrify':
        addActions(t, 1);
        putOnTavern(state, pi, 'transmogrify');
        break;
      // 遠隔地：効果なし → マットへ（ゲーム終了時にマットにあれば4勝利点＝vpOf で判定）。
      case 'distant_lands':
        putOnTavern(state, pi, 'distant_lands');
        break;
      // ワイン商：+1購入 +$4 → マットへ（購入フェイズ終了時、$2以上残っていればマットから捨ててよい）。
      case 'wine_merchant':
        t.buys += 1; addCoins(state, 4);
        putOnTavern(state, pi, 'wine_merchant');
        break;
      // 守銭奴：手札の銅貨1枚を酒場マットへ置く／酒場マットの銅貨1枚につき +$1 を選ぶ。
      case 'miser':
        state.pending = { type: 'miser', player: pi };
        break;
      // 御料車：+1アクション → マットへ（アクションのプレイ完了時、それがまだ場にあれば呼び出して再演）。
      case 'royal_carriage':
        addActions(t, 1);
        putOnTavern(state, pi, 'royal_carriage');
        break;
      // 複製：効果なし → マットへ（コスト$6以下のカードを獲得したとき呼び出してコピーを獲得）。
      case 'duplicate':
        putOnTavern(state, pi, 'duplicate');
        break;

      /* ========== 冒険：トラベラー（page/peasant＋成長先。場から捨てる時に次の成長先と交換） ========== */
      // 騎士見習い：+1カード +1アクション（キャントリップ）。捨てる時にトレジャーハンターと交換可（交換は cleanup 窓）。
      case 'page':
        draw(state, pi, 1); addActions(t, 1);
        break;
      // 農民：+1購入 +$1。捨てる時に兵士と交換可。
      case 'peasant':
        t.buys += 1; addCoins(state, 1);
        break;
      // トレジャーハンター：+1アクション +$1。右隣が直前の手番に獲得したカード1枚につき銀貨1枚を獲得。
      case 'treasure_hunter': {
        addActions(t, 1); addCoins(state, 1);
        const n = state.players.length, right = (pi - 1 + n) % n;
        const cnt = (state.players[right].lastTurnGains || []).length;
        let g = 0; for (let i = 0; i < cnt; i++) { if (gain(state, pi, 'silver', 'discard')) g++; }
        if (g) log(state, `${p.name} はトレジャーハンターで銀貨${g}枚を獲得した（右隣の直前の獲得${cnt}枚）。`);
        break;
      }
      // ウォリアー：+2カード。場のトラベラー（自身含む）1枚につき、他の各プレイヤーは山札の一番上を捨て、$3か$4なら廃棄（アタック）。
      case 'warrior': {
        draw(state, pi, 2);
        const travs = p.inPlay.filter((c) => DOM.isType(c, 'traveller')).length; // このウォリアー自身も inPlay にあり traveller
        const vics = []; for (let k = 1; k < state.players.length; k++) vics.push((pi + k) % state.players.length);
        warriorEnterVictim(state, pi, vics, travs);
        break;
      }
      // ヒーロー：+$2。財宝カード1枚を獲得する（強制）。
      case 'hero':
        addCoins(state, 2);
        if (anyGainable(state, (id) => gainableBase(state, id) && isTreasureFor(state, id))) state.pending = { type: 'hero_gain', player: pi };
        break;
      // チャンピオン：+1アクション。永続持続＝ゲーム終了までアタック免疫（attackImmune）＋アクション使用ごとに+1アクション。
      case 'champion':
        addActions(t, 1);
        p.champions = (p.champions || 0) + 1;
        log(state, `${p.name} はチャンピオンを場に出した（以後アタック免疫・アクション毎に+1アクション）。`);
        break;
      // 兵士：+$2。場の他のアタックカード1枚につき +$1。手札4枚以上の他の各プレイヤーはカード1枚を捨てる（アタック）。
      case 'soldier': {
        addCoins(state, 2);
        // 自身を除く「場の他のアタックカード」＝ inPlay＋durationCards（持続アタック=橋の下のトロル等も場に残る）。
        const others = p.inPlay.filter((c) => DOM.isType(c, 'attack')).length + (p.durationCards || []).filter((c) => DOM.isType(c, 'attack')).length - 1;
        if (others > 0) { addCoins(state, others); log(state, `${p.name} は兵士で +$${others}（場の他のアタック${others}枚）。`); }
        const vics = []; for (let k = 1; k < state.players.length; k++) vics.push((pi + k) % state.players.length);
        soldierEnterVictim(state, pi, vics);
        break;
      }
      // 脱走兵：+2カード +1アクション。カード1枚を捨てる。
      case 'fugitive':
        draw(state, pi, 2); addActions(t, 1);
        if (p.hand.length > 0) state.pending = { type: 'fugitive_discard', player: pi };
        break;
      // 門下生：手札のアクションカード1枚を2度使用してよい。それと同じカード1枚を獲得する。
      //   冒険：相続した屋敷もアクション（命令）＝対象になる（公式）。
      case 'disciple':
        if (p.hand.some((c) => DOM.isType(c, 'action') || inheritedEstate(p, c))) state.pending = { type: 'disciple_play', player: pi };
        break;
      // 教師（Reserve）：効果なし → 酒場マットへ。ターン開始時に呼び出してトークンをアクション山に置く。
      case 'teacher':
        putOnTavern(state, pi, 'teacher');
        break;

      /* ===== 移動動物園（Menagerie）=====
         追放(Exile)＝p.exile／馬(Horse)＝非サプライ30枚／習性(Way)＝横型。正本＝docs/research/menagerie_rules.md */
      // 馬＝+2カード +1アクション、これをその山に戻す（獲得でも廃棄でもない＝山が10枚に戻るだけ）。
      //   命令経由（王子/大君主/ハツカネズミの習性）は場に無いので戻せない＝lose track（公式）。
      case 'horse':
        draw(state, pi, 2); addActions(t, 1);
        if (takeSelf(state, pi, 'horse')) state.supply.horse = (state.supply.horse || 0) + 1;
        break;
      // 動物見本市＝+$4、空のサプライ山1つにつき +1購入（数えるのはプレイした瞬間の空山数）。
      case 'animal_fair': {
        addCoins(state, 4);
        const emp = emptyPileCount(state);
        if (emp > 0) { t.buys += emp; log(state, `${p.name} は動物見本市で +${emp}購入（空の山 ${emp}）。`); }
        break;
      }
      // 艀＝「今」か「次の自分のターンの開始時」に +3カード +1購入（強制の二択）。
      case 'barge':
        state.pending = { type: 'barge_choose', player: pi };
        break;
      // 黒猫＝+2カード。**自分のターンでない場合のみ**、他のプレイヤーは各自 呪い1枚を獲得（アタック）。
      //   配る順はターンプレイヤーから始まるターン順（使用者は飛ばす）＝公式。
      case 'black_cat': {
        draw(state, pi, 2);
        if (t && t.active !== pi) {
          const n = state.players.length; const q = [];
          for (let k = 0; k < n; k++) { const idx = (t.active + k) % n; if (idx !== pi) q.push(idx); }
          blackCatEnterVictim(state, pi, q);
        }
        break;
      }
      // 賞金稼ぎ＝+1アクション、手札1枚を追放（強制）。追放マットに同名が無かったなら +$3。
      case 'bounty_hunter':
        addActions(t, 1);
        if (p.hand.length > 0) state.pending = { type: 'bounty_hunter_exile', player: pi };
        break;
      // ラクダの隊列＝サプライから勝利点でないカード1枚を追放（強制）。獲得時＝サプライから金貨1枚を追放。
      case 'camel_train':
        if (anyExilableSupply(state, (cid) => !DOM.isType(cid, 'victory'))) state.pending = { type: 'camel_train_exile', player: pi };
        break;
      // 枢機卿＝+$2。他の各プレイヤーは山札の上2枚を公開し、コスト$3〜$6の1枚を追放して残りを捨てる（アタック）。
      case 'cardinal': {
        addCoins(state, 2);
        const vics = []; for (let k = 1; k < state.players.length; k++) vics.push((pi + k) % state.players.length);
        cardinalEnterVictim(state, pi, vics);
        break;
      }
      // 騎兵隊＝馬2枚を獲得。獲得時＝+2カード +1購入（購入フェイズならアクションフェイズに戻る）。
      case 'cavalry':
        gainHorse(state, pi); gainHorse(state, pi);
        break;
      // 魔女の集会＝+1アクション +$2。他の各プレイヤーはサプライから呪い1枚を追放する。
      //   できない（呪いの山が空）場合、そのプレイヤーは追放マットの呪いをすべて捨て札にする（アタック）。
      case 'coven': {
        addActions(t, 1); addCoins(state, 2);
        const vics = []; for (let k = 1; k < state.players.length; k++) vics.push((pi + k) % state.players.length);
        covenEnterVictim(state, pi, vics);
        break;
      }
      // デストリエ＝+2カード +1アクション（コストは動的＝cardCost 側で処理）。
      case 'destrier':
        draw(state, pi, 2); addActions(t, 1);
        break;
      // 強制退去＝手札1枚を追放し、それより最大2コイン高い「名前の異なる」カード1枚を獲得（強制）。
      case 'displace':
        if (p.hand.length > 0) state.pending = { type: 'displace_exile', player: pi };
        break;
      // 鷹匠＝これより安いカード1枚を「手札に」獲得する。
      case 'falconer':
        if (anyGainable(state, (cid) => costUnder(state, cid, cardCost(state, 'falconer')))) {
          state.pending = { type: 'falconer_gain', player: pi, under: cardCost(state, 'falconer') };
        }
        break;
      // 漁師＝+1カード +1アクション +$1（コストは動的＝cardCost 側で処理）。
      case 'fisherman':
        draw(state, pi, 1); addActions(t, 1); addCoins(state, 1);
        break;
      // 門番＝持続アタック。次の自分のターン開始時 +$3。それまでの間、他のプレイヤーが
      //   「自分の追放マットに同名が無いアクション/財宝」を獲得したとき、それを追放する。
      case 'gatekeeper': {
        const rid = (state._lingerSeq = (state._lingerSeq | 0) + 1);
        armDuration(state, pi, 'gatekeeper', { immune: [], rid });
        const vics = []; for (let k = 1; k < state.players.length; k++) vics.push((pi + k) % state.players.length);
        gatekeeperEnterVictim(state, pi, vics, rid);
        break;
      }
      // ヤギ飼い＝+1アクション、手札1枚を廃棄してもよい。右隣が直前の自分のターンに廃棄した枚数だけ +カード。
      case 'goatherd': {
        addActions(t, 1);
        const right = state.players[(pi - 1 + state.players.length) % state.players.length];
        const n = right.trashedLastTurn || 0;
        if (n > 0) { draw(state, pi, n); log(state, `${p.name} はヤギ飼いで +${n}カード（右隣が直前の手番に廃棄した枚数）。`); }
        if (p.hand.length > 0) state.pending = { type: 'goatherd_trash', player: pi };
        break;
      }
      // 馬丁＝コスト$4以下のカード1枚を獲得。獲得したカードの種別ごとにボーナス（複合なら全部）。
      case 'groom':
        if (anyGainable(state, (cid) => costUpTo(state, cid, 4))) state.pending = { type: 'groom_gain', player: pi };
        break;
      // 旅籠＝+1カード +2アクション。獲得時＝手札の財宝を好きな枚数 公開して捨て、その枚数だけ馬を獲得。
      case 'hostelry':
        draw(state, pi, 1); addActions(t, 2);
        break;
      // 狩猟小屋＝+1カード +2アクション。手札をすべて捨てて +5カード してもよい。
      case 'hunting_lodge':
        draw(state, pi, 1); addActions(t, 2);
        state.pending = { type: 'hunting_lodge_choose', player: pi };
        break;
      // 炉＝+$2。このターン、次にカードを使用するとき、その解決の前に同名のカード1枚を獲得してもよい。
      case 'kiln':
        addCoins(state, 2);
        t.kilnCharges = (t.kilnCharges || 0) + 1;
        break;
      // 貸し馬屋＝+$3。場にある間、コスト$4以上のカードを獲得するたびに馬1枚（triggerOnGain 側）。
      case 'livery':
        addCoins(state, 3);
        break;
      // 首謀者＝持続。次の自分のターン開始時、手札のアクションカード1枚を3回使用してもよい。
      case 'mastermind':
        armDuration(state, pi, 'mastermind');
        break;
      // パドック＝+$2、馬2枚を獲得、空のサプライ山1つにつき +1アクション。
      case 'paddock': {
        addCoins(state, 2);
        gainHorse(state, pi); gainHorse(state, pi);
        const emp = emptyPileCount(state);
        if (emp > 0) { addActions(t, emp); log(state, `${p.name} はパドックで +${emp}アクション（空の山 ${emp}）。`); }
        break;
      }
      // 聖域＝+1カード +1アクション +1購入、手札1枚を追放してもよい（任意）。
      case 'sanctuary':
        draw(state, pi, 1); addActions(t, 1); t.buys += 1;
        if (p.hand.length > 0) state.pending = { type: 'sanctuary_exile', player: pi };
        break;
      // がらくた＝手札1枚を廃棄（強制）。そのコスト$1につき1つ、6種の効果から「異なるもの」を選ぶ。
      case 'scrap':
        if (p.hand.length > 0) state.pending = { type: 'scrap_trash', player: pi };
        break;
      // 牧羊犬＝+2カード（リアクション＝自分がカードを獲得したとき手札から使用してよい）。
      case 'sheepdog':
        draw(state, pi, 2);
        break;
      // そり＝馬2枚を獲得（リアクション＝自分がカードを獲得したとき、これを捨てて獲得物を手札か山札の上へ）。
      case 'sleigh':
        gainHorse(state, pi); gainHorse(state, pi);
        break;
      // 雪深い村＝+1カード +4アクション +1購入。**このターン、これ以降に得る +アクション をすべて無視する**
      //   （自身の +4 は得る＝先に加算してから旗を立てる。村人の使用・チャンピオン・山トークンも以後は無視＝公式）。
      case 'snowy_village':
        draw(state, pi, 1); addActions(t, 4); t.buys += 1;
        t.ignoreActionBonus = true;
        log(state, `${p.name} は雪深い村で このターン以降の +アクション をすべて無視する。`);
        break;
      // ※備蓄品(stockpile)／配給品(supplies)は**財宝**＝効果は applyTreasureEffect に書く（applyEffect は通らない）。
      // 村有緑地＝持続。「今」か「次のターンの開始時」に +1カード +2アクション（強制の二択）。
      //   リアクション＝クリンナップ以外でこれを捨て札にしたとき、これを使用してよい（triggerOnDiscard 側）。
      case 'village_green':
        state.pending = { type: 'village_green_choose', player: pi };
        break;
      // 行人＝+3カード、銀貨1枚を獲得してもよい（コストは動的＝cardCost 側で処理）。
      case 'wayfarer':
        draw(state, pi, 3);
        if ((state.supply.silver || 0) > 0) state.pending = { type: 'wayfarer_gain', player: pi };
        break;

      /* ===== 夜想曲（Nocturne）：王国カード ===== */
      // 詩人（幸運）＝+2コイン、祝福を1つ受ける。
      case 'bard':
        addCoins(state, 2);
        receiveBoon(state, pi, 1);
        break;
      /* 暗躍者（不運・アタック）＝+1購入、他のプレイヤーは全員「次の呪詛」を1つ受ける。
         獲得時に金貨1枚（triggerOnGain 側）。**呪詛は全員のリアクション窓を閉じてから1枚だけめくる**。 */
      case 'skulk':
        t.buys += 1;
        startHexAttack(state, pi, othersInOrder(state, pi));
        break;
      // 恵みの村（幸運）＝+1カード+2アクション。獲得時に祝福を1つ「取る」（triggerOnGain 側）。
      case 'blessed_village':
        draw(state, pi, 1); addActions(t, 2);
        break;
      /* コンクラーベ＝+2コイン、**場に同名が無い**アクション1枚を手札から使ってよい（アクション権不要）。
         使ったら**その解決が全部終わった後で** +1アクション（雪深い村を使うと +1アクションは得られない＝公式）。 */
      case 'conclave':
        addCoins(state, 2);
        if (conclaveTargets(state, pi).length) state.pending = { type: 'conclave', player: pi };
        break;
      // 呪われた村（不運）＝+2アクション、手札が6枚になるまで引く。獲得時に自分が呪詛を1つ受ける（triggerOnGain 側）。
      case 'cursed_village':
        addActions(t, 2);
        while (p.hand.length < 6) { if (!draw(state, pi, 1).length) break; }
        break;
      /* ドルイド（幸運）＝+1購入、**脇に置かれた祝福3枚から1つを受ける**（その祝福は脇に置いたまま）。
         強制。玉座で複数回使うと1回ごとに選び直せる（命令の commandAs 流儀は適用しない）。 */
      case 'druid':
        t.buys += 1;
        if ((state.boons && state.boons.druid || []).length) state.pending = { type: 'druid_boon', player: pi };
        break;
      // 忠犬（リアクション）＝+2カード。捨て札にされたときの脇置きは triggerOnDiscard 側。
      case 'faithful_hound':
        draw(state, pi, 2);
        break;
      /* 愚者（幸運）＝森の迷子を持っていなければ、それを取り（相手からでも）、祝福3枚を取って好きな順番で受ける。
         **すでに自分が持っていたら完全に空振り**（祝福も取らない）。 */
      case 'fool': {
        if (state.lostInTheWoods === pi) { log(state, `${p.name} はすでに森の迷子を持っている（愚者は何も起きない）。`); break; }
        state.lostInTheWoods = pi;
        log(state, `${p.name} は森の迷子を受け取った。`);
        const three = [];
        for (let i = 0; i < 3; i++) { const b = takeBoon(state); if (!b) break; three.push(b); }
        if (three.length) { t.boonChoice = { player: pi, boons: three }; state.pending = { type: 'boon_choose', player: pi }; }
        break;
      }
      /* レプラコーン（不運）＝金貨1枚を獲得。**その後**場のカードがちょうど7枚なら願い1枚、そうでなければ呪詛1つ。
         枚数は「獲得時リアクション（牧羊犬など）を解決し終えてから」数える＝再開網に委ねる。 */
      case 'leprechaun':
        if (gain(state, pi, 'gold', 'discard')) log(state, `${p.name} はレプラコーンで金貨1枚を獲得した。`);
        t.leprechaunCheck = (t.leprechaunCheck || []).concat([pi]);
        break;
      /* ピクシー（幸運）＝+1カード+1アクション。祝福の山の一番上を捨て、これを廃棄してその祝福を2回受けてもよい。
         廃棄しなければ祝福は捨てられるだけで**受けない**。 */
      case 'pixie': {
        draw(state, pi, 1); addActions(t, 1);
        const b = takeBoon(state);
        if (b) {
          if (state.boons) state.boons.discard.push(b);
          log(state, `${p.name} はピクシーで祝福「${lsName(b)}」を捨てた。`);
          state.pending = { type: 'pixie_trash', player: pi, boon: b };
        }
        break;
      }
      // プーカ＝手札から「呪われた金貨以外の財宝」1枚を廃棄してよい。そうしたら +4カード。
      case 'pooka':
        if (p.hand.some((c) => isTreasureFor(state, c) && c !== 'cursed_gold')) state.pending = { type: 'pooka_trash', player: pi };
        break;
      /* 聖なる木立ち（幸運）＝+1購入+3コイン、祝福を1つ受ける。
         **その祝福が +コイン を与えないなら**、他のプレイヤーも全員それを受けてよい（任意・同じ1枚）。 */
      case 'sacred_grove': {
        t.buys += 1; addCoins(state, 3);
        const b = takeBoon(state);
        if (b) {
          queueBoon(state, pi, b);
          if (!BOON_GIVES_COIN.has(b)) t.groveShare = { boon: b, queue: othersInOrder(state, pi) };
        }
        break;
      }
      // 秘密の洞窟（持続）＝+1カード+1アクション。手札3枚を捨てたら、次のターン開始時に +3コイン。
      case 'secret_cave':
        draw(state, pi, 1); addActions(t, 1);
        if (p.hand.length) state.pending = { type: 'secret_cave', player: pi };
        break;
      // 羊飼い＝+1アクション。好きな枚数の勝利点カードを公開して捨て、1枚につき +2カード。
      case 'shepherd':
        addActions(t, 1);
        if (p.hand.some((c) => DOM.isType(c, 'victory'))) state.pending = { type: 'shepherd_discard', player: pi };
        else log(state, `${p.name} は羊飼いで捨てる勝利点カードが無かった。`);
        break;
      /* 迫害者（不運・アタック）＝+2コイン。**他のカードが場に無ければ**インプ1枚を獲得、
         そうでなければ他のプレイヤーは全員「次の呪詛」を1つ受ける。 */
      case 'tormentor': {
        addCoins(state, 2);
        // **「使用したその迫害者以外のカードが場にあるか」で判定する**（同名か否かは関係ない）。
        //   今プレイした1枚は inPlay の末尾にあるので、枚数から1を引くだけでよい。
        const othersInPlay = Math.max(0, p.inPlay.length - 1) + (p.durationCards || []).length;
        // インプを獲得する側でも「アタックカードを使用した」ことへのリアクション窓は開く（公式）。
        if (othersInPlay === 0) attackWindowEnter(state, pi, othersInOrder(state, pi), 'tormentor_imp');
        else startHexAttack(state, pi, othersInOrder(state, pi));
        break;
      }
      /* 追跡者（幸運）＝+1コイン。**このターン**、カードを獲得したとき山札の上に置いてよい（2022エラッタ）。
         その後、祝福を1つ受ける。 */
      case 'tracker':
        addCoins(state, 1);
        t.trackerTurn = true;
        receiveBoon(state, pi, 1);
        break;
      /* ===== 夜想曲：夜行（Night）カード ===== */
      // カブラー（夜行・持続）＝次の自分のターン開始時、コスト4以下のカードを1枚**手札に**獲得（強制）。
      case 'cobbler':
        armDuration(state, pi, 'cobbler');
        break;
      /* 納骨堂（夜行・持続）＝場の「持続でない財宝」を好きな枚数、裏向きで脇に置く。
         残りがある限り、**あなたの各ターンの開始時**に1枚を手札に加える。0枚なら持続にならない。 */
      case 'crypt':
        if (p.inPlay.some((c) => isTreasureFor(state, c) && !DOM.isType(c, 'duration'))) {
          state.pending = { type: 'crypt_setaside', player: pi };
        }
        break;
      // 悪人のアジト（夜行・持続）＝次の自分のターン開始時 +2カード。獲得時は手札へ（gain の GAIN_TO_HAND）。
      case 'den_of_sin':
        armDuration(state, pi, 'den_of_sin');
        break;
      /* 悪魔の工房（夜行）＝**このターンに獲得した枚数**で自動的に決まる（選ぶ余地は無い）。
         2枚以上＝インプ／1枚＝コスト4以下を1枚（選ぶ）／0枚＝金貨。 */
      case 'devils_workshop': {
        const n = (t.gainedThisTurn || []).length;
        if (n >= 2) { if (gain(state, pi, 'imp', 'discard')) log(state, `${p.name} は悪魔の工房でインプ1枚を獲得した（このターン${n}枚獲得）。`); }
        else if (n === 1) { if (anyGainable(state, (id) => costUpTo(state, id, 4))) state.pending = { type: 'devils_workshop_gain', player: pi }; }
        else { if (gain(state, pi, 'gold', 'discard')) log(state, `${p.name} は悪魔の工房で金貨1枚を獲得した（このターン獲得なし）。`); }
        break;
      }
      // 悪魔祓い（夜行）＝手札1枚を廃棄し、それより**厳密に安い**精霊カード1枚を獲得（強制）。
      case 'exorcist':
        if (p.hand.length) state.pending = { type: 'exorcist_trash', player: pi };
        break;
      // ゴーストタウン（夜行・持続）＝次の自分のターン開始時 +1カード +1アクション。獲得時は手札へ。
      case 'ghost_town':
        armDuration(state, pi, 'ghost_town');
        break;
      /* 守護者（夜行・持続）＝次の自分のターン**開始時**に +1コイン。**それまで**他プレイヤーのアタックを受けない。
         灯台と違い「次のターン中」は守られない（開始時に窓が閉じる）＝別フラグで管理する。 */
      case 'guardian':
        p.guardianActive = true;
        armDuration(state, pi, 'guardian');
        break;
      /* 修道院（夜行）＝**このターンに獲得した枚数**まで、手札1枚か場の銅貨1枚を廃棄してよい（任意・1枚ずつ）。
         上限は使用時点で固定（廃棄の途中で獲得が起きても増えない）。 */
      case 'monastery': {
        const n = (t.gainedThisTurn || []).length;
        if (n > 0 && (p.hand.length || p.inPlay.includes('copper'))) {
          state.pending = { type: 'monastery', player: pi, remaining: n };
        }
        break;
      }
      /* 夜警（夜行）＝山札の上5枚を**見る**（公開ではない＝reveal を通さない）。好きな枚数を捨て、残りを好きな順で戻す。
         獲得時は手札へ（gain の GAIN_TO_HAND）。 */
      case 'night_watchman': {
        const look = [];
        for (let i = 0; i < 5; i++) {
          if (p.deck.length === 0) { if (p.discard.length === 0) break; reshuffleDeck(p); }
          if (p.deck.length === 0) break;
          look.push(p.deck.shift());
        }
        if (look.length) state.pending = { type: 'look_arrange', player: pi, cards: look, source: 'night_watchman' };
        break;
      }
      /* 夜襲（夜行・持続・アタック）＝手札5枚以上の他プレイヤーは、使用者の場にあるカードと同名の1枚を捨てる
         （できなければ手札を公開）。次の自分のターン開始時 +3コイン。 */
      case 'raider':
        armDuration(state, pi, 'raider');
        raiderEnterVictim(state, pi, othersInOrder(state, pi));
        break;
      /* 人狼（アクション・夜行・アタック・不運）＝**あなたの夜フェイズなら**他プレイヤー全員が次の呪詛を受ける。
         そうでなければ +3カード。 */
      case 'werewolf':
        // 夜フェイズ以外（+3カード）でも**アタックカードなのでリアクション窓は開く**（公式）。窓はドローより前。
        if (t.phase === 'night') startHexAttack(state, pi, othersInOrder(state, pi));
        else attackWindowEnter(state, pi, othersInOrder(state, pi), 'werewolf_draw');
        break;
      /* 取り替え子（夜行）＝これを廃棄し、**場に出ているカード**と同じカード1枚を獲得する。
         獲得できるのは「サプライの山の一番上が同名」のときだけ（非サプライ/空山/分割山の下段は選べても何も獲得しない）。
         廃棄は必ず起きる（獲得できなくても）。 */
      case 'changeling': {
        if (takeSelf(state, pi, 'changeling')) {
          trashCard(state, pi, 'changeling');
          log(state, `${p.name} は取り替え子を廃棄した。`);
        }
        const cand = [...new Set(p.inPlay.concat(p.durationCards || []))];
        if (cand.length) state.pending = { type: 'changeling_gain', player: pi };
        break;
      }
      /* 幽霊（夜行・持続・精霊）＝アクションが公開されるまでデッキを上から公開し、そのアクションを脇に置いて
         残りを捨てる。次の自分のターン開始時にそのアクションを**2度使用する**（強制）。
         アクションが見つからなければ持続にならない（そのターンの片付けで捨て札）。 */
      case 'ghost': {
        const rev = [];
        let found = null, guard = 0;
        while (guard++ < 200) {
          if (p.deck.length === 0) { if (p.discard.length === 0) break; reshuffleDeck(p); }
          if (p.deck.length === 0) break;
          const c = p.deck.shift();
          if (DOM.isType(c, 'action')) { found = c; break; }
          rev.push(c);
        }
        if (rev.length || found) reveal(state, pi, (found ? rev.concat([found]) : rev).slice(-8), '幽霊');
        rev.forEach((c) => p.discard.push(c));
        if (rev.length) triggerOnDiscard(state, pi, rev);
        if (found) {
          (p.ghostSetAside = p.ghostSetAside || []).push(found);
          armDuration(state, pi, 'ghost', { setAsideCard: found });
          log(state, `${p.name} は幽霊で「${C()[found].name}」を脇に置いた（次のターンに2度使用する）。`);
        } else log(state, `${p.name} は幽霊でアクションカードを見つけられなかった。`);
        break;
      }
      /* 吸血鬼（夜行・アタック・不運）＝他プレイヤー全員が次の呪詛を受ける → コスト5以下の吸血鬼以外を1枚獲得 →
         これをコウモリ1枚と交換する。 */
      case 'vampire':
        t.vampireAfterHex = (t.vampireAfterHex || []).concat([pi]); // 呪詛の解決後に「獲得→交換」へ進む（再開網）
        startHexAttack(state, pi, othersInOrder(state, pi));
        break;
      /* コウモリ（夜行・非サプライ）＝手札から最大2枚を廃棄する。1枚以上廃棄したらこれを吸血鬼と交換する。 */
      case 'bat':
        state.pending = { type: 'bat_trash', player: pi };
        break;
      /* ネクロマンサー＝廃棄置き場の「表向き・持続でない」アクション1枚を選び、**裏返してから**
         廃棄置き場に置いたまま使用する（2021エラッタ＝無限ループ防止）。
         ⚠ ネクロマンサーは Command 種別を**持たない**ので、廃棄置き場の大君主/はみだし者/船長/王子も使える。 */
      case 'necromancer':
        if (necromancerTargets(state).length) state.pending = { type: 'necromancer', player: pi };
        break;
      /* ===== 夜想曲：ゾンビ3種（準備で廃棄置き場に置かれる。ネクロマンサーでのみ使われる） ===== */
      // ゾンビの弟子＝手札のアクション1枚を廃棄して +3カード +1アクション を得てもよい。
      case 'zombie_apprentice':
        if (p.hand.some((c) => DOM.isType(c, 'action'))) state.pending = { type: 'zombie_apprentice', player: pi };
        break;
      // ゾンビの石工＝山札の一番上を廃棄し、それより最大 $1 高いカード1枚を獲得してもよい。
      case 'zombie_mason': {
        if (p.deck.length === 0 && p.discard.length) reshuffleDeck(p);
        if (!p.deck.length) { log(state, `${p.name} はゾンビの石工を使ったが山札が空だった。`); break; }
        const top = p.deck.shift();
        trashCard(state, pi, top);
        log(state, `${p.name} はゾンビの石工で「${C()[top].name}」を廃棄した。`);
        const ref = costOf(state, top);
        if (anyGainable(state, (id) => costUpTo(state, id, ref.coin + 1, { pot: ref.pot, debt: ref.debt }))) {
          state.pending = { type: 'zombie_mason_gain', player: pi, coin: ref.coin + 1, pot: ref.pot, debt: ref.debt };
        }
        break;
      }
      // ゾンビの密偵＝+1カード +1アクション、山札の一番上を見て捨てるか戻す。
      case 'zombie_spy': {
        draw(state, pi, 1); addActions(t, 1);
        if (p.deck.length === 0 && p.discard.length) reshuffleDeck(p);
        if (p.deck.length) state.pending = { type: 'zombie_spy', player: pi, card: p.deck[0] };
        break;
      }
      /* ===== 夜想曲：非サプライのアクション（精霊2種＋願い） ===== */
      // ウィル・オ・ウィスプ（精霊）＝+1カード+1アクション、山札の上を公開しコスト2以下なら手札へ。
      case 'will_o_wisp': {
        draw(state, pi, 1); addActions(t, 1);
        if (p.deck.length === 0 && p.discard.length) reshuffleDeck(p);
        if (p.deck.length) {
          const top = p.deck[0];
          reveal(state, pi, [top], 'ウィル・オ・ウィスプ');
          // **3成分で比較する**（公式FAQ："Cards with [P] or [D] in the cost … do not cost [$2] or less."）。
          //   `costUpTo` は非サプライ除外＋在庫>0 を含むのでここでは使わない（山札の上のカードはサプライと無関係）。
          if (costLE(costOf(state, top), { coin: 2, pot: 0, debt: 0 })) {
            p.deck.shift(); p.hand.push(top);
            log(state, `${p.name} はウィル・オ・ウィスプで「${C()[top].name}」を手札に加えた。`);
          }
        }
        break;
      }
      // インプ（精霊）＝+2カード、場に同名が無いアクション1枚を手札から使ってよい（コンクラーベと同じ述語）。
      case 'imp':
        draw(state, pi, 2);
        if (conclaveTargets(state, pi).length) state.pending = { type: 'imp_play', player: pi };
        break;
      /* 願い＝+1アクション、これを願いの山に戻す。戻せたらコスト6以下のカード1枚を**手札に**獲得する。
         「山に戻す」は獲得でも廃棄でもない（交換と同じ扱い）。 */
      case 'wish': {
        addActions(t, 1);
        if (removeOne(p.inPlay, 'wish')) {
          state.supply.wish = (state.supply.wish || 0) + 1;
          log(state, `${p.name} は願いを山に戻した。`);
          if (anyGainable(state, (id) => costUpTo(state, id, 6))) state.pending = { type: 'wish_gain', player: pi };
        }
        break;
      }
      /* 悲劇のヒーロー＝+3カード+1購入。**引いた後**に手札が8枚以上なら、これを廃棄して財宝1枚を獲得（強制）。 */
      case 'tragic_hero':
        draw(state, pi, 3); t.buys += 1;
        if (p.hand.length >= 8) {
          if (takeSelf(state, pi, 'tragic_hero')) {
            trashCard(state, pi, 'tragic_hero');
            log(state, `${p.name} は悲劇のヒーローを廃棄した（手札8枚以上）。`);
          }
          /* **財宝の獲得は廃棄の成否に条件づかない**（ルールブック逐語 "If you cannot trash Tragic Hero …
             you still gain the Treasure."）＝ネクロマンサー／玉座・幽霊の2回目でも獲得する。
             倒壊・死の荷車の pendingSelf パターンとは**逆**なので self を持ち回らないこと。 */
          if (anyGainable(state, (id) => gainableBase(state, id) && isTreasureFor(state, id))) state.pending = { type: 'tragic_hero_gain', player: pi };
        }
        break;

      default:
        break;
    }
  }

  /* ---------- ゲーム終了判定・得点 ---------- */
  function emptyPileCount(state) {
    // 賞品（Prize）は非サプライ＝空でも「3山終了」に数えない。
    // 分割山（サウナ/アヴァント・帝国5組）は1つの山＝上段側で「上下とも尽きたら空」と数え、下段キーは数えない。
    let n = Object.keys(state.supply).filter((k) => {
      if (NON_SUPPLY.has(k)) return false;
      if (SPLIT_TOP[k]) return false; // 分割山の下段は上段側で数える（重複しない）
      if (SPLIT_BOTTOM[k]) return (state.supply[k] || 0) <= 0 && (state.supply[SPLIT_BOTTOM[k]] || 0) <= 0; // 分割山は上下とも尽きて空
      return state.supply[k] <= 0;
    }).length;
    // 暗黒時代：廃墟(Ruins)山はサプライだが supply の数値キーを持たない（state.ruins で管理）。空なら3山終了に数える。
    if (Array.isArray(state.ruins) && state.ruins.length === 0) n += 1;
    return n;
  }
  function isGameOver(state) {
    if (state.supply.province <= 0 || emptyPileCount(state) >= 3) return true;
    // 繁栄：植民地を使うゲームは「植民地の山が尽きた」ときも終了する（公式＝属州と並ぶ独立の終了条件）。
    //   植民地/プラチナは繁栄の王国カードが場にあるときだけ initSupply が足すので、
    //   キーが無い（＝使っていない）ゲームでは判定しない。
    if (state.supply.colony != null && state.supply.colony <= 0) return true;
    // 安全網：ルール上あり得ない超長期化を打ち切る。例＝泥棒(thief)で全財宝が枯れ、銅貨の山も尽き、
    // 全員コイン0で誰も購入できず山も減らない膠着（実カードでも起こり得る degenerate 盤面）。
    // オンラインCPU部屋やCPU戦が永久に終わらないのを構造的に防ぐ。通常のゲームは遥か手前で終わる。
    const maxTurns = state.players.reduce((m, p) => Math.max(m, p.turns || 0), 0);
    if (maxTurns >= 150) return true;
    return false;
  }
  function allCards(p) {
    // 海辺：持続カード・脇置き・島/原住民マットも所有カード＝VP（島の2点・庭園の枚数等）に数える。
    // 新プロモ：王子の脇に置いたカード（princes）も所有カード（ゲーム終了時はデッキに戻して数える＝公式）。
    return [].concat(p.deck, p.hand, p.discard, p.inPlay,
      p.durationCards || [], p.setAside || [], p.islandMat || [], p.nativeVillageMat || [],
      p.princes || [], p.tavern || [], // 冒険：酒場マット（Reserve/守銭奴の銅貨。公開・所有カードに数える）
      p.inherited || [],  // 冒険：相続の脇置き（獲得ではないが「得点計算時は自分のデッキに含める」＝公式）
      p.eventSetAside || [], // 移動動物園：遅延/刈り入れの脇置き（次の手番開始時に使用する。所有カード）
      p.exile || [],      // 移動動物園：追放マット（公開・所有カード＝VPに数える。ゲーム終了時もデッキに含める＝公式）
      p.cargo || [],      // ルネサンス：貨物船の脇置き（表向き＝公開。所有カード＝VPに数える）
      p.ghostSetAside || [], // 夜想曲：幽霊の脇札（公開。幽霊が場を離れても孤児化するだけで所有カードのまま）
      p.cryptSetAside || [], // 夜想曲：納骨堂の脇札（所有者のみ可視。同上）
      ...((p.archives || []).map((a) => a.cards || []))); // 帝国：資料庫の脇置き（所有カード＝VPに数える）
  }
  function vpOf(p) {
    const cards = allCards(p);
    let vp = cards.reduce((sum, c) => sum + (C()[c].vp || 0), 0);
    // 公爵：所持する公領1枚につき1勝利点
    const dukes = cards.filter((c) => c === 'duke').length;
    if (dukes) vp += dukes * cards.filter((c) => c === 'duchy').length;
    // 庭園：デッキ10枚につき1勝利点（端数切り捨て）
    const gardens = cards.filter((c) => c === 'gardens').length;
    if (gardens) vp += gardens * Math.floor(cards.length / 10);
    // 錬金術：ブドウ園＝所持アクションカード3枚につき1勝利点（端数切り捨て）
    const vineyards = cards.filter((c) => c === 'vineyard').length;
    if (vineyards) vp += vineyards * Math.floor(cards.filter((c) => DOM.isType(c, 'action')).length / 3);
    // 収穫祭：品評会＝所持カードの異なる名前5種類につき2勝利点（端数切り捨て・品評会1枚ごと）
    const fairgrounds = cards.filter((c) => c === 'fairgrounds').length;
    if (fairgrounds) vp += fairgrounds * 2 * Math.floor(new Set(cards).size / 5);
    // 異郷：絹の道＝所持する勝利点カード4枚につき1勝利点（端数切り捨て・絹の道自身も数える・絹の道1枚ごと）
    const silkRoads = cards.filter((c) => c === 'silk_road').length;
    if (silkRoads) vp += silkRoads * Math.floor(cards.filter((c) => DOM.isType(c, 'victory')).length / 4);
    // 暗黒時代：封土＝所持する銀貨3枚につき1勝利点（端数切り捨て・封土1枚ごと）
    const feoda = cards.filter((c) => c === 'feodum').length;
    if (feoda) vp += feoda * Math.floor(cards.filter((c) => c === 'silver').length / 3);
    // 帝国：粗末な城(humble)=所有する城1枚につき1点／王城(kings)=所有する城1枚につき2点（自身を含む全ての「城」種別カードを数える）。
    const humbleC = cards.filter((c) => c === 'humble_castle').length;
    const kingsC = cards.filter((c) => c === 'kings_castle').length;
    if (humbleC || kingsC) {
      const castleCount = cards.filter((c) => C()[c] && DOM.isType(c, 'castle')).length;
      vp += humbleC * castleCount + kingsC * 2 * castleCount;
    }
    // 冒険：遠隔地＝ゲーム終了時に酒場マットにあれば1枚4勝利点（マット以外にあれば0点＝固定vpは持たせない）。
    const distantOnMat = (p.tavern || []).filter((c) => c === 'distant_lands').length;
    if (distantOnMat) vp += distantOnMat * 4;
    // 夜想曲：牧草地（家宝）＝所有する屋敷1枚につき1勝利点（牧草地1枚ごと）。
    const pastures = cards.filter((c) => c === 'pasture').length;
    if (pastures) vp += pastures * cards.filter((c) => c === 'estate').length;
    // 繁栄：VPトークン（司教・記念碑・収集・投資で貯めた勝利点）を加算
    vp += p.vpTokens || 0;
    // 夜想曲：状態＝生活苦(-2) / 二重苦(-4)。**得点は負になり得る＝下限クランプ禁止**（misery は非カード）。
    if (p.misery === 1) vp -= 2;
    else if (p.misery >= 2) vp -= 4;
    return vp;
  }
  // 帝国：あるカードが「空になったサプライ山」に由来するか（塔の得点用）。
  function isFromEmptySupplyPile(state, cardId) {
    if (NON_SUPPLY.has(cardId)) return false; // 賞品/成長先/戦利品/狂人/傭兵 は非サプライ
    // 混合山（廃墟/騎士/城）の中身は個別の supply キーを持たない＝集約キーで空判定
    if ((DOM.POOLS.ruins || []).indexOf(cardId) >= 0) return Array.isArray(state.ruins) && state.ruins.length === 0;
    if ((DOM.POOLS.knights || []).indexOf(cardId) >= 0) return (state.supply.knights || 0) <= 0;
    if ((DOM.POOLS.castles || []).indexOf(cardId) >= 0) return (state.supply.castles || 0) <= 0;
    // 同盟：分割山の中身24種も個別の supply キーを持たない＝**16枚すべてが無くなって初めて空**（山キーで判定）。
    if (ALLIES_PILE_OF[cardId] && state.supply[cardId] == null) return (state.supply[ALLIES_PILE_OF[cardId]] || 0) <= 0;
    if (!Object.prototype.hasOwnProperty.call(state.supply, cardId)) return false; // サプライに無い＝対象外
    if (SPLIT_TOP[cardId]) return (state.supply[cardId] || 0) <= 0 && (state.supply[SPLIT_TOP[cardId]] || 0) <= 0; // 分割山下段
    if (SPLIT_BOTTOM[cardId]) return (state.supply[cardId] || 0) <= 0 && (state.supply[SPLIT_BOTTOM[cardId]] || 0) <= 0; // 分割山上段
    return (state.supply[cardId] || 0) <= 0;
  }
  // 帝国：得点計算専用ランドマーク11種の合計VP（seat のぶん）。得点は負になり得る＝下限クランプしない。
  // ある seat のカード列 cards に対する得点計算専用ランドマーク11種の合計VP。
  //   cards は「終局時の全所持カード列」（CPUは獲得後の仮デッキを渡す＝engine と完全一致の見積り）。
  //   keep（全プレイヤー横断比較）は seat 以外を state.players から見るので、cards は seat 自身のぶんを渡すこと。
  function landmarkScoreForCards(state, cards, seat) {
    if (!state.landmarks || !state.landmarks.length) return 0;
    const has = (id) => state.landmarks.indexOf(id) >= 0;
    const cnt = (pred) => cards.filter(pred).length;
    const names = {}; cards.forEach((c) => { names[c] = (names[c] || 0) + 1; });
    let vp = 0;
    if (has('bandit_fort')) vp += -2 * cnt((c) => c === 'silver' || c === 'gold');
    if (has('fountain') && cnt((c) => c === 'copper') >= 10) vp += 15;
    if (has('museum')) vp += 2 * Object.keys(names).length;
    if (has('orchard')) Object.keys(names).forEach((c) => { if (DOM.isType(c, 'action') && names[c] >= 3) vp += 4; });
    if (has('palace')) vp += 3 * Math.min(cnt((c) => c === 'copper'), cnt((c) => c === 'silver'), cnt((c) => c === 'gold'));
    if (has('wall')) vp += -1 * Math.max(0, cards.length - 15);
    if (has('wolf_den')) Object.keys(names).forEach((c) => { if (names[c] === 1) vp += -3; });
    if (has('triumphal_arch')) {
      const cs = Object.keys(names).filter((c) => DOM.isType(c, 'action')).map((c) => names[c]).sort((a, b) => b - a);
      vp += 3 * (cs.length >= 2 ? cs[1] : 0);
    }
    /* オベリスク：「その山から出たカード」＝分割山なら**その山の全種**を同一山として数える
       （帝国の2段は両半分＝settlers⇔bustling_village／同盟の分割山は4種すべて）。
       数え落とすと勝者が変わり得るので、山→中身の写像は1箇所（obeliskNames）に集約する。 */
    if (has('obelisk') && state.obeliskPile) {
      const op = state.obeliskPile;
      const obeliskNames = new Set([op]);
      if (SPLIT_BOTTOM[op]) obeliskNames.add(SPLIT_BOTTOM[op]);
      if (SPLIT_TOP[op]) obeliskNames.add(SPLIT_TOP[op]);
      (ALLIES_SPLIT[op] || []).forEach((c) => obeliskNames.add(c));
      vp += 2 * cnt((c) => obeliskNames.has(c));
    }
    if (has('tower')) cards.forEach((c) => { if (!DOM.isType(c, 'victory') && isFromEmptySupplyPile(state, c)) vp += 1; });
    if (has('keep')) {
      // 各財宝名について、他のどのプレイヤーよりも多く（同数含む）持っていれば +5。seat 自身は cards、他は state.players。
      // ※得点計算は「ターン中」ではない＝資本主義の動的な財宝化は適用しない（静的な種別で数える）。
      const treasureNames = new Set();
      cards.forEach((c) => { if (DOM.isType(c, 'treasure')) treasureNames.add(c); });
      state.players.forEach((pp, i) => { if (i !== seat) allCards(pp).forEach((c) => { if (DOM.isType(c, 'treasure')) treasureNames.add(c); }); });
      treasureNames.forEach((tn) => {
        const mine = names[tn] || 0;
        if (mine === 0) return;
        let maxOther = 0;
        state.players.forEach((pp, i) => { if (i !== seat) maxOther = Math.max(maxOther, allCards(pp).filter((c) => c === tn).length); });
        if (mine >= maxOther) vp += 5;
      });
    }
    return vp;
  }
  // scoreGame 用の薄いラッパ：seat の全所持カードで採点する。
  function landmarkScore(state, seat) {
    return landmarkScoreForCards(state, allCards(state.players[seat]), seat);
  }
  function scoreGame(state) {
    const scores = state.players.map((p, i) => {
      // 勝敗画面用の内訳（例: {province:2, duchy:1, estate:3, curse:1}）。
      // マスク配信後はクライアントから再計算できないため、ここで確定して持たせる。
      const cards = allCards(p);
      const vpCards = {};
      // deckCards＝終了後に「全員のデッキ」を見せるための所有カード全部の枚数。
      //   相手の山札/捨て札は maskStateFor で伏せられ、クライアントからは復元できない。
      //   ここ（権威state）で確定して result に載せれば、オンラインでも終了後だけ全員に見せられる。
      const deckCards = {};
      cards.forEach((c) => {
        deckCards[c] = (deckCards[c] || 0) + 1;
        if (DOM.isType(c, 'victory') || DOM.isType(c, 'curse')) vpCards[c] = (vpCards[c] || 0) + 1;
      });
      const lmVp = landmarkScore(state, i); // 帝国：ランドマーク得点（負にもなり得る）
      const alVp = allyScoreForCards(state, cards, p); // 同盟：高原の羊飼い（好意×コスト$2ちょうどのカードのペア）
      // deckSize は庭園の得点表示用（デッキ10枚につき1点）
      // tieTurns＝同点時のタイブレーク用のターン数。移動動物園「今を生きる」の追加ターンは数えない（公式）。
      return { name: p.name, vp: vpOf(p) + lmVp + alVp, landmarkVp: lmVp, allyVp: alVp, turns: p.turns,
        tieTurns: p.turns - (p.freeTurns || 0), vpCards, deckCards, deckSize: cards.length };
    });
    // 勝者判定：勝利点が多い → 同点ならターン数が少ない（今を生きるの追加ターンは数えない＝tieTurns）
    let best = null;
    let winners = [];
    state.players.forEach((p, i) => {
      const s = scores[i];
      if (
        !best ||
        s.vp > best.vp ||
        (s.vp === best.vp && s.tieTurns < best.tieTurns)
      ) {
        best = s;
        winners = [i];
      } else if (s.vp === best.vp && s.tieTurns === best.tieTurns) {
        winners.push(i);
      }
    });
    const reason = state.supply.province <= 0 ? '属州の山が尽きた'
      // 繁栄：植民地を使うゲームは植民地が尽きても終了する（isGameOver と同じ条件・同じ順序で判定する）。
      : (state.supply.colony != null && state.supply.colony <= 0) ? '植民地の山が尽きた'
      : emptyPileCount(state) >= 3 ? '3つの山が尽きた'
      : '膠着のため打ち切り';
    return { scores, winners, reason };
  }

  /* ============================================================
     海辺：持続（Duration）機構
     - armDuration: カードを使ったとき「次の自分の手番開始時に解決する予約」を積む。
     - DURATION_RESOLVERS[type]: 次手番開始時の効果。非対話はその場で適用、対話は
       state.turn.startQueue に pending 仕様を push（cleanup 後に順番に pending 化）。
     - resolveDurationStartEffects: 手番開始時に予約を全消化し、対話分を startQueue→pending に。
     - 物理カードは cleanupAndAdvance の仕分けで durationCards に持ち越し、予約を出し切ったら捨て札へ。
     ============================================================ */
  function armDuration(state, pi, cardId, extra) {
    const p = state.players[pi];
    if (!p.delayedEffects) p.delayedEffects = [];
    p.delayedEffects.push(Object.assign({ card: cardId, type: cardId }, extra || {}));
  }
  // 次手番開始時に1つ進める：startQueue があれば先頭を pending に、無ければ pending=null。
  function popStartQueue(state) {
    const q = state.turn && state.turn.startQueue;
    if (q && q.length) { state.pending = q.shift(); }
    else { if (state.turn) state.turn.startQueue = null; state.pending = null; }
  }
  function resolveDurationStartEffects(state, pi) {
    const p = state.players[pi];
    // ルネサンス：ターン開始時効果の解決中フラグ（鍵をその場で取ったときの +$1 の判定用。
    //   PLAY_ACTION / END_ACTION_PHASE / BUY で降ろす＝「開始時効果が終わった」とみなす）。
    if (state.turn) state.turn.inStartPhase = true;
    // 帝国：寄付（Donate）＝この手番開始時に「まず」（他の開始時効果より前に）デッキと捨て札を全部手札に集める。
    //   → 任意枚数廃棄（donate_trash pending）→ 残りをシャッフルして5枚引く → その後で通常の開始時効果を続行（再入）。
    if (p.donateNext) {
      p.donateNext = false;
      while (p.deck.length) p.hand.push(p.deck.pop());
      while (p.discard.length) p.hand.push(p.discard.pop());
      state.pending = { type: 'donate_trash', player: pi };
      log(state, `${p.name} は寄付：山札と捨て札をすべて手札に集めた（好きな枚数を廃棄できる）。`);
      return; // 残りの開始時効果は DONATE_TRASH の解決後に resolveDurationStartEffects を再入して処理する
    }
    const entries = (p.delayedEffects || []);
    p.delayedEffects = [];
    state.turn.startQueue = [];
    for (const e of entries) {
      const r = DURATION_RESOLVERS[e.type];
      if (r) r(state, pi, e); // 非対話はここで適用、対話は state.turn.startQueue に積む
    }
    // 冒険：雇人＝永続持続。稼働数ぶん、各ターン開始時に +1カード（非対話）。
    if (p.hirelings) { for (let i = 0; i < p.hirelings; i++) draw(state, pi, 1); log(state, `${p.name} は雇人の持続効果（+${p.hirelings}カード）。`); }
    // 新プロモ：王子＝脇に置いたカードを毎ターン開始時に（脇に置いたまま）使用する（強制・アクション権不要）。
    (p.princes || []).forEach((card, i) => {
      state.turn.startQueue.push({ type: 'prince_play', player: pi, idx: i, card });
    });
    // 移動動物園：遅延／刈り入れ＝脇に置いたカードを、このターンの開始時に使用する（強制・アクション権不要）。
    //   脇（p.eventSetAside）から1枚ずつ。使用するとカードは場に出る（持続なら通常どおり場に残る）。
    (p.eventSetAside || []).forEach(() => { state.turn.startQueue.push({ type: 'event_play', player: pi }); });
    // 帝国：資料庫＝脇にカードが残っている各資料庫につき、手番開始時に脇から1枚を手札へ（対話＝startQueueへ）。
    (p.archives || []).forEach((a) => { if (a.cards && a.cards.length) state.turn.startQueue.push({ type: 'archive_pick', player: pi, archiveId: a.id }); });
    // 繁栄：会計士＝手番開始時、手札の会計士を（アクションを消費せず）使ってよい。startQueue の最後に積む。
    const clerks = p.hand.filter((c) => c === 'clerk').length;
    for (let i = 0; i < clerks; i++) state.turn.startQueue.push({ type: 'clerk_start', player: pi });
    // 冒険：ターン開始時に呼び出せる Reserve（案内人/鼠取り/変容／教師）が酒場マットにあれば呼び出し窓を開く。
    if (anyTavernStartCallable(state, pi)) state.turn.startQueue.push({ type: 'tavern_start', player: pi });
    /* 夜想曲：森の迷子（状態・ゲーム中1枚）＝自分のターン開始時、手札1枚を捨てて祝福を1つ受けてもよい（任意）。
       愚者を持ち主自身が使っても何も起きない＝この窓だけが祝福の入口になる。 */
    if (state.lostInTheWoods === pi && p.hand.length > 0) state.turn.startQueue.push({ type: 'lost_in_the_woods', player: pi });
    /* 夜想曲：恵みの村＝獲得時に取っておいた祝福を「次の自分のターンの開始時」に受ける（複数持ち得る）。 */
    if ((p.boonsHeld || []).length) {
      const held = p.boonsHeld.slice();
      p.boonsHeld = [];
      held.forEach((b) => queueBoon(state, pi, b));
    }
    // ルネサンス：ターン開始時のプロジェクト（自動＝縁日/兵舎／対話＝大聖堂・城門・サイロ・悪巧み・輪作／ピアッツァ＝プレイ）。
    startOfTurnProjects(state, pi);
    // 同盟：ターン開始時に働く Ally（穴居民/工芸家ギルド/砂漠の案内人/森の居住者/すり師団/山の民）。
    allyStartOfTurn(state, pi);
    // ピアッツァのプレイが選択待ちを立てた場合はそれを優先し、残りは reduce 末尾の startQueue 安全網が拾う。
    if (!state.pending) popStartQueue(state);
  }
  /* ルネサンス：ターン開始時に働くプロジェクト。
     - 自動：縁日(+1購入)／兵舎(+1アクション)。
     - 対話：大聖堂(手札1枚を廃棄・強制)／城門(+1カード→手札1枚を山札の上へ)／サイロ(銅貨を捨てて同数引く)／
             悪巧み(トークンを置く or 全部取り除いて同数引く)／輪作(手札の勝利点1枚を捨てて+2カード・任意)＝startQueue へ。
     - ピアッツァ：山札の一番上を公開し、アクションなら**使用する**（アクション権を消費しない）。
       ターン開始時は**アクションフェイズの一部**＝turn.phase は 'action' のまま（帝国の冠がフェイズでモードを決めるため重要）。 */
  function startOfTurnProjects(state, pi) {
    const t = state.turn, p = state.players[pi];
    if (!state.projects || !state.projects.length) return;
    if (hasMyProject(state, pi, 'fair')) { t.buys += 1; log(state, `${p.name} は縁日で +1購入（ターン開始時）。`); }
    if (hasMyProject(state, pi, 'barracks')) { addActions(t, 1); log(state, `${p.name} は兵舎で +1アクション（ターン開始時）。`); }
    if (hasMyProject(state, pi, 'cathedral') && p.hand.length > 0) t.startQueue.push({ type: 'cathedral', player: pi });
    if (hasMyProject(state, pi, 'city_gate')) {
      draw(state, pi, 1); // 先に引く（引いたカードをそのまま山札に戻してもよい）
      log(state, `${p.name} は城門で +1カード（ターン開始時）。`);
      if (p.hand.length > 0) t.startQueue.push({ type: 'city_gate', player: pi }); // 山札に置くのは強制
    }
    if (hasMyProject(state, pi, 'silos')) t.startQueue.push({ type: 'silos', player: pi });
    if (hasMyProject(state, pi, 'sinister_plot')) t.startQueue.push({ type: 'sinister_plot', player: pi });
    if (hasMyProject(state, pi, 'crop_rotation') && p.hand.some((c) => DOM.isType(c, 'victory'))) {
      t.startQueue.push({ type: 'crop_rotation', player: pi });
    }
    if (hasMyProject(state, pi, 'piazza')) {
      if (p.deck.length === 0 && p.discard.length > 0) reshuffleDeck(p);
      if (p.deck.length > 0) {
        const top = p.deck[0];
        reveal(state, pi, [top], 'ピアッツァ：山札の一番上を公開');
        if (DOM.isType(top, 'action')) {
          p.deck.shift();
          p.inPlay.push(top);
          t.actionsPlayed = (t.actionsPlayed || 0) + 1;
          log(state, `${p.name} はピアッツァで「${C()[top].name}」を使用した（アクション権は消費しない）。`);
          maybeCitadel(state, pi, top); // 山砦：そのターン最初のアクション使用なら再演
          applyEffect(state, top, pi);
        } else {
          log(state, `${p.name} はピアッツァ：山札の一番上は「${C()[top].name}」（アクションでないので山札に残す）。`);
        }
      }
    }
  }
  /* ルネサンス：山砦（Citadel・プロジェクト）＝あなたのターン中に**最初にアクションカードを使用**したとき、
     その後それを**再演**する（2022エラッタで "play it again" → "replay it"＝玉座の2回目と同じ扱い＝自己移動は失敗する）。
     フェイズは問わない（ピアッツァのターン開始時／技術革新の獲得時／資本主義で購入フェイズ に使ったアクションも数える）。
     ※許容簡略化：PLAY_ACTION／ピアッツァ／技術革新 の3経路のみ（家臣/伝令官/ゴーレム/命令 等の「別カードがプレイする」
       経路では発火しない＝チャンピオン/教師トークンと同型の既存簡略化。出荷セット（ルネサンス単独）では到達しない）。 */
  function maybeCitadel(state, pi, card) {
    const t = state.turn;
    if (!t || t.active !== pi) return;
    if (!hasMyProject(state, pi, 'citadel')) return;
    if (t.citadelUsed) return;
    if (!DOM.isType(card, 'action')) return;
    t.citadelUsed = true;
    (state.replay = state.replay || []).push({ player: pi, card: card, label: 'citadel' });
    log(state, `${state.players[pi].name} は山砦で「${C()[card].name}」を再演する（このターン最初のアクション）。`);
  }
  /* ========== 同盟：Ally の誘発窓（1ゲームに Ally は1枚だけなので下の分岐はすべて排他）==========
     窓はすべて `t.startQueue` に積む（＝reduce 末尾の安全網が「選択待ちが無くなったら1件ずつ pending 化」する）。
     ターン開始時だけでなく購入フェイズ開始時の窓もここに積んでよい（キューは phase 非依存）。
     ※**複数の開始時効果の解決順は公式ではプレイヤーが選べる**が、本エンジンは先入れ順の既存簡略化に従う
       （すり師団だけは手札が少ないほど得なので **先頭に unshift** して最初に解決させる）。 */
  function allyHandHasAction(state, pi) {
    const p = state.players[pi];
    return p.hand.some((c) => DOM.isType(c, 'action') || inheritedEstate(p, c));
  }
  function queueAllyWindow(state, pd, front) {
    const t = state.turn;
    if (!t) return;
    if (!t.startQueue) t.startQueue = [];
    if (front) t.startQueue.unshift(pd); else t.startQueue.push(pd);
  }
  // 自分のターンの開始時に開く Ally の窓。
  function allyStartOfTurn(state, pi) {
    if (!state.ally) return;
    const p = state.players[pi];
    const fav = p.favors || 0;
    /* すり師団（Gang of Pickpockets）＝好意1を使わないかぎり手札4枚まで捨てる。
       **アタックではない**（堀/灯台/リアクションで防げない）。既に4枚以下なら何も起きない。 */
    if (state.ally === 'gang_of_pickpockets' && p.hand.length > 4) {
      queueAllyWindow(state, fav >= 1
        ? { type: 'ally_gang', stage: 'pay', player: pi }
        : { type: 'ally_gang', stage: 'discard', player: pi }, true);
      return;
    }
    if (state.ally === 'mountain_folk' && fav >= 5) queueAllyWindow(state, { type: 'ally_mountain_folk', player: pi }, true);
    if (state.ally === 'cave_dwellers' && fav >= 1) queueAllyWindow(state, { type: 'ally_cave', player: pi }, true);
    if (state.ally === 'desert_guides' && fav >= 1) queueAllyWindow(state, { type: 'ally_desert', player: pi }, true);
    if (state.ally === 'forest_dwellers' && fav >= 1) queueAllyWindow(state, { type: 'ally_forest', player: pi }, true);
    if (state.ally === 'crafters_guild' && fav >= 2 && anyGainable(state, (id) => costUpTo(state, id, 4))) {
      queueAllyWindow(state, { type: 'ally_crafters', player: pi }, true);
    }
  }
  /* 自分の購入フェイズの開始時に開く Ally の窓。**1ターンに複数回起こり得る**（ヴィラ/騎兵で
     アクションフェイズに戻り再び購入フェイズに入るたび）＝1ターン1回のフラグを立てない（公式）。 */
  function allyBuyPhaseStart(state, pi) {
    if (!state.ally) return;
    const p = state.players[pi];
    const fav = p.favors || 0;
    // 銀行家連盟（League of Bankers）＝好意4個につき +$1（端数切捨て）。**好意は消費しない**・強制（自動）。
    if (state.ally === 'league_of_bankers') {
      const add = Math.floor(fav / 4);
      if (add > 0) { addCoins(state, add); log(state, `${p.name} は銀行家連盟で +$${add}（好意${fav}個）。`); }
      return;
    }
    if (state.ally === 'family_of_inventors' && fav >= 1 && favorPileTargets(state).length) {
      queueAllyWindow(state, { type: 'ally_inventors', player: pi });
    }
    if (state.ally === 'market_towns' && fav >= 1 && allyHandHasAction(state, pi)) {
      queueAllyWindow(state, { type: 'ally_market_towns', player: pi });
    }
    if (state.ally === 'peaceful_cult' && fav >= 1 && p.hand.length > 0) {
      queueAllyWindow(state, { type: 'ally_peaceful_cult', player: pi });
    }
    if (state.ally === 'woodworkers_guild' && fav >= 1 && allyHandHasAction(state, pi)) {
      queueAllyWindow(state, { type: 'ally_woodworkers', stage: 'trash', player: pi });
    }
  }
  /* 「カードを使用した後」に働く Ally（魔女の輪／小売店主連盟＝連携／写本士の仲間たち＝アクション）。
     **そのカードのプレイを完全に解決してから**判定する（公式逐語）ので、`t.allyPlayed` に積んで
     reduce 末尾の再開網が1件ずつ処理する（連携が選択待ちを出しても取りこぼさない）。
     ※このエンジンは「同時に誘発した効果の解決順を選べない」（既存の横断簡略化）＝
       小売店主連盟は御料車/山砦の再演より**先**に解決する（公式なら順番を選んで +$2 にできる＝許容簡略化）。 */
  function noteAllyPlay(state, pi, card) {
    const a = state.ally;
    if (!a || !card) return;
    const isLiaison = DOM.isType(card, 'liaison');
    const isAction = DOM.isType(card, 'action') || inheritedEstate(state.players[pi], card);
    if ((a === 'circle_of_witches' || a === 'league_of_shopkeepers') && !isLiaison) return;
    if (a === 'fellowship_of_scribes' && !isAction) return;
    if (a !== 'circle_of_witches' && a !== 'league_of_shopkeepers' && a !== 'fellowship_of_scribes') return;
    const t = state.turn;
    if (!t) return;
    (t.allyPlayed = t.allyPlayed || []).push({ player: pi, card });
  }
  // reduce 末尾の再開網。選択待ちが立つまで1件ずつ消化する。
  function drainAllyPlayed(state) {
    let g = 0;
    while (!state.pending && !state.gameOver && state.turn && (state.turn.allyPlayed || []).length && g++ < 40) {
      runAllyPlayed(state);
    }
  }
  // 1件ぶんの処理（選択待ちを立てたら drainAllyPlayed のループが止まる）。
  function runAllyPlayed(state) {
    const t = state.turn;
    const e = t.allyPlayed.shift();
    if (!t.allyPlayed.length) t.allyPlayed = null;
    const pi = e.player, p = state.players[pi];
    if (state.ally === 'league_of_shopkeepers') {
      // 小売店主連盟＝好意5以上で +$1、10以上ならさらに +1アクション +1購入（**排他ではなく累積**）。好意は消費しない。
      const fav = p.favors || 0;
      if (fav >= 5) {
        addCoins(state, 1);
        if (fav >= 10) { addActions(t, 1); t.buys += 1; }
        log(state, `${p.name} は小売店主連盟（好意${fav}個）で +$1${fav >= 10 ? ' +1アクション +1購入' : ''}。`);
      }
      return;
    }
    if (state.ally === 'circle_of_witches') {
      // 魔女の輪＝好意3を使うと他の全員が呪いを獲得。**アタックではない＝堀で防げない**（公式逐語）。
      if ((p.favors || 0) >= 3 && (state.supply.curse || 0) > 0) state.pending = { type: 'ally_circle', player: pi };
      return;
    }
    if (state.ally === 'fellowship_of_scribes') {
      // 写本士の仲間たち＝アクションを使い切った後、手札4枚以下なら好意1で +1カード。
      if ((p.favors || 0) >= 1 && p.hand.length <= 4) state.pending = { type: 'ally_scribes', player: pi };
    }
  }
  /* 木工ギルド＝廃棄したら「アクションカード1枚を獲得」＝**コストの上限が無い**（負債コスト[D]でも
     ポーション費用[P]でもよい＝公式FAQ逐語）。`costUpTo`/`costIsPlainCoin` を掛けてはいけない。
     昇進(Advance・帝国イベント)には $6以下の上限があるので「同型」と書き写すと静かに壊れる。 */
  function woodworkersCanGain(state) {
    return (id) => gainableBase(state, id) && isTypeSupply(state, id, 'action');
  }
  /* 建築家ギルド＝「獲得したカードより安い、勝利点でないカード」の候補述語（engine拒否・CPU候補・UIフィルタ共通）。
     ⚠ 判定は「**2枚目を獲得しようとしている時点**」の1枚目のコスト（公式：捨て札に入ってコストが変わっていれば
        変わった後のコストで比べる）＝窓を積むときではなく解決するときに測る。遊牧民団とは基準時点が逆。 */
  function architectsCanGain(state, refCard) {
    const ref = costOf(state, refCard);
    return (id) => costUnder(state, id, ref.coin, { pot: ref.pot, debt: ref.debt }) && !isTypeSupply(state, id, 'victory');
  }
  /* 獲得時に開く Ally の窓が「まだ開けるか」。onGainQueue に積んでから解決するまでに好意が減る／
     獲得した札が別の効果で動く（望楼/交易商人/そり）ことがあるので、**キューを消化する直前に再検査する**
     （＝選択肢ゼロの窓を人間に出さない／CPU が null を返して詰まない）。 */
  function allyGainWindowOpen(state, q) {
    const p = state.players[q.player];
    const fav = p.favors || 0;
    if (q.type === 'ally_architects') return fav >= 2 && anyGainable(state, architectsCanGain(state, q.card));
    if (q.type === 'ally_nomads') return fav >= 1;
    if (q.type === 'ally_city_state') {
      return fav >= 2 && !!state.turn && q.player === state.turn.active && zoneOf(p, q.dest).indexOf(q.card) >= 0;
    }
    if (q.type === 'ally_trappers') return fav >= 1 && zoneOf(p, q.dest).indexOf(q.card) >= 0;
    return true;
  }
  /* 高原の羊飼い（Plateau Shepherds）＝得点計算時、好意1と「コストちょうど$2のカード」1枚のペア1組につき 2VP。
     **好意は消費しない**（マット上の枚数をそのまま使う）。「ちょうど$2」は3成分の厳密一致
     （薬草商＝$2+ポーション は数えない＝公式FAQ）。得点計算時はコスト軽減が効かない＝素のコストで判定する。
     cards＝そのプレイヤーの全所持カード（allCards 相当。CPU は仮デッキを渡して engine と一致させる）。 */
  function allyScoreForCards(state, cards, p) {
    if (!state || state.ally !== 'plateau_shepherds') return 0;
    const two = (cards || []).filter((c) => {
      const cd = C()[c];
      return cd && cd.cost === 2 && !cd.potion && !cd.debt;
    }).length;
    return 2 * Math.min(p.favors || 0, two);
  }
  // 各持続カードの「次の手番開始時」効果（カードidをキーに登録）。対話分は §手5/手6 で startQueue に積む。
  const DURATION_RESOLVERS = {
    // 夜想曲：秘密の洞窟＝手札3枚を捨てたときだけ持続になり、次の自分のターン開始時に +3コイン。
    secret_cave: (s, pi) => { addCoins(s, 3); log(s, `${s.players[pi].name} は秘密の洞窟の持続効果（+3コイン）。`); },
    // 夜想曲：悪人のアジト＝次の自分のターン開始時 +2カード。
    den_of_sin: (s, pi) => { draw(s, pi, 2); log(s, `${s.players[pi].name} は悪人のアジトの持続効果（+2カード）。`); },
    // 夜想曲：ゴーストタウン＝次の自分のターン開始時 +1カード +1アクション。
    ghost_town: (s, pi) => { draw(s, pi, 1); addActions(s.turn, 1); log(s, `${s.players[pi].name} はゴーストタウンの持続効果（+1カード +1アクション）。`); },
    // 夜想曲：守護者＝次の自分のターン開始時 +1コイン。**このとき免疫の窓が閉じる**（灯台と違い次のターン中は守られない）。
    guardian: (s, pi) => { s.players[pi].guardianActive = false; addCoins(s, 1); log(s, `${s.players[pi].name} は守護者の持続効果（+1コイン。アタック免疫はここで終わる）。`); },
    // 夜想曲：夜襲＝次の自分のターン開始時 +3コイン。
    raider: (s, pi) => { addCoins(s, 3); log(s, `${s.players[pi].name} は夜襲の持続効果（+3コイン）。`); },
    // 夜想曲：カブラー＝次の自分のターン開始時、コスト4以下のカードを1枚**手札に**獲得する（強制）。
    cobbler: (s, pi) => {
      if (anyGainable(s, (id) => costUpTo(s, id, 4))) s.turn.startQueue.push({ type: 'cobbler_gain', player: pi });
    },
    /* 夜想曲：幽霊＝次の自分のターン開始時、脇に置いたアクションカードを**2度使用する**（強制）。
       カードは場に出る＝玉座の2回目と同じ扱い（命令ではない）。 */
    ghost: (s, pi, e) => {
      const p = s.players[pi];
      const card = e.setAsideCard;
      if (card && removeOne(p.ghostSetAside || [], card)) s.turn.startQueue.push({ type: 'ghost_play', player: pi, card });
    },
    /* 夜想曲：納骨堂＝脇に残っている限り、**あなたの各ターンの開始時**に1枚を手札に加える
       （納骨堂1枚につき1束＝予約に残り枚数 n を持たせ、残っていれば再武装する）。 */
    crypt: (s, pi, e) => {
      const p = s.players[pi];
      const n = e.n || 0;
      if (n > 0 && (p.cryptSetAside || []).length) {
        s.turn.startQueue.push({ type: 'crypt_pick', player: pi, n });
      }
    },
    fishing_village: (s, pi) => { addActions(s.turn, 1); addCoins(s, 1); log(s, `${s.players[pi].name} は漁村の持続効果（+1アクション +1コイン）。`); },
    caravan: (s, pi) => { draw(s, pi, 1); log(s, `${s.players[pi].name} は隊商の持続効果（+1カード）。`); },
    merchant_ship: (s, pi) => { addCoins(s, 2); log(s, `${s.players[pi].name} は商船の持続効果（+2コイン）。`); },
    wharf: (s, pi) => { draw(s, pi, 2); s.turn.buys += 1; log(s, `${s.players[pi].name} は船着場の持続効果（+2カード +1購入）。`); },
    astrolabe: (s, pi) => { addCoins(s, 1); s.turn.buys += 1; log(s, `${s.players[pi].name} はアストロラーベの持続効果（+1コイン +1購入）。`); },
    lighthouse: (s, pi) => { addCoins(s, 1); log(s, `${s.players[pi].name} は灯台の持続効果（+1コイン）。`); },
    haven: (s, pi, e) => { // 脇に置いたカードを手札へ戻す
      const p = s.players[pi];
      if (e.stashed && removeOne(p.setAside, e.stashed)) { p.hand.push(e.stashed); log(s, `${p.name} は停泊所で脇に置いたカードを手札に戻した。`); }
    },
    // ルネサンス：貨物船＝表向きで脇（p.cargo）に置いたカードを手札へ（貨物船1枚につき1枚）。
    cargo_ship: (s, pi) => {
      const p = s.players[pi];
      if ((p.cargo || []).length) {
        const c = p.cargo.shift();
        p.hand.push(c);
        log(s, `${p.name} は貨物船で脇に置いた「${C()[c].name}」を手札に加えた。`);
      }
    },
    // ルネサンス：研究＝裏向きで脇（setAside）に置いたカードをすべて手札へ。
    research: (s, pi, e) => {
      const p = s.players[pi];
      const list = (e.stashed || []).slice();
      let n = 0;
      list.forEach((c) => { if (removeOne(p.setAside, c)) { p.hand.push(c); n++; } });
      if (n) log(s, `${p.name} は研究で脇に置いた ${n}枚 を手札に加えた。`);
    },
    tactician: (s, pi) => { draw(s, pi, 5); s.turn.buys += 1; addActions(s.turn, 1); log(s, `${s.players[pi].name} は策士の持続効果（+5カード +1購入 +1アクション）。`); },
    tide_pools: (s, pi) => { // 次手番開始時に手札2枚を捨てる（対話＝startQueueへ）
      if (s.players[pi].hand.length > 0) (s.turn.startQueue = s.turn.startQueue || []).push({ type: 'tide_pools_discard', player: pi });
    },
    sea_witch: (s, pi) => { // 次手番 +2カード→その後手札2枚を捨てる
      draw(s, pi, 2); log(s, `${s.players[pi].name} は海の魔女の持続効果（+2カード）。`);
      if (s.players[pi].hand.length > 0) (s.turn.startQueue = s.turn.startQueue || []).push({ type: 'sea_witch_discard', player: pi });
    },
    monkey: (s, pi) => { draw(s, pi, 1); s.players[pi].monkeyActive = false; log(s, `${s.players[pi].name} はサルの持続効果（+1カード）。`); },
    outpost: () => { /* 追加ターン中、場に残すためだけの予約（効果なし） */ },
    sailor: (s, pi) => { // 次手番 +2コイン＋任意で手札1枚廃棄
      addCoins(s, 2); log(s, `${s.players[pi].name} は船乗りの持続効果（+2コイン）。`);
      if (s.players[pi].hand.length > 0) (s.turn.startQueue = s.turn.startQueue || []).push({ type: 'sailor_trash', player: pi });
    },
    blockade: (s, pi, e) => { // 脇に置いたカードを手札へ戻す（呪いの窓も閉じる）
      const p = s.players[pi];
      if (e.gained && removeOne(p.setAside, e.gained)) { p.hand.push(e.gained); log(s, `${p.name} は封鎖で脇に置いた「${C()[e.gained].name}」を手札に加えた。`); }
    },
    corsair: (s, pi) => { draw(s, pi, 1); log(s, `${s.players[pi].name} は私掠船の持続効果（+1カード）。`); },
    pirate: (s, pi) => { // 次手番に6コスト以下の財宝1枚を手札に獲得
      (s.turn.startQueue = s.turn.startQueue || []).push({ type: 'pirate_gain', player: pi });
    },
    horse_traders: (s, pi) => { // 収穫祭：脇に置いた馬商人を手札に戻し +1カード
      const p = s.players[pi];
      if (removeOne(p.setAside, 'horse_traders')) {
        p.hand.push('horse_traders');
        draw(s, pi, 1);
        log(s, `${p.name} は脇に置いた馬商人を手札に戻し +1カード。`);
      }
    },
    church: (s, pi, e) => { // 新プロモ：脇に伏せたカードを手札へ戻し、その後 手札1枚を廃棄してよい（対話＝startQueueへ）
      const p = s.players[pi];
      const back = (e.stashed || []).filter((c) => removeOne(p.setAside, c));
      back.forEach((c) => p.hand.push(c));
      if (back.length) log(s, `${p.name} は教会で脇に置いた ${back.length}枚 を手札に戻した。`);
      if (p.hand.length > 0) (s.turn.startQueue = s.turn.startQueue || []).push({ type: 'church_trash', player: pi });
    },
    captain: (s, pi) => { // 新プロモ：次のターン開始時も、サプライのコスト4以下アクションを使う（対話＝startQueueへ）
      (s.turn.startQueue = s.turn.startQueue || []).push({ type: 'captain', player: pi });
    },
    // 冒険：地下牢＝次の手番も +2カードの後 手札2枚を捨てる（対話＝startQueueへ）。
    dungeon: (s, pi) => {
      draw(s, pi, 2); log(s, `${s.players[pi].name} は地下牢の持続効果（+2カード）。`);
      if (s.players[pi].hand.length > 0) (s.turn.startQueue = s.turn.startQueue || []).push({ type: 'dungeon_discard', player: pi, viaStart: true });
    },
    // 冒険：道具＝脇に置いたカードを手札へ戻す（haven/blockade と同型）。
    gear: (s, pi, e) => {
      const p = s.players[pi];
      const back = (e.stashed || []).filter((c) => removeOne(p.setAside, c));
      back.forEach((c) => p.hand.push(c));
      if (back.length) log(s, `${p.name} は道具で脇に置いた ${back.length}枚 を手札に戻した。`);
    },
    // 冒険：魔除け＝次の手番開始時も 3択（対話＝startQueueへ）。
    amulet: (s, pi) => { (s.turn.startQueue = s.turn.startQueue || []).push({ type: 'amulet', player: pi, viaStart: true }); },
    // 冒険：橋の下のトロル＝次の手番開始時に +1購入、その手番もカードのコストは$1安い（アタックは初回のみ）。
    bridge_troll: (s, pi) => {
      s.turn.buys += 1; s.turn.costReduction = (s.turn.costReduction || 0) + 1;
      log(s, `${s.players[pi].name} は橋の下のトロルの持続効果（+1購入・全カード$1安い）。`);
    },
    // 冒険：隊商の護衛＝次の手番開始時 +$1。
    caravan_guard: (s, pi) => { addCoins(s, 1); log(s, `${s.players[pi].name} は隊商の護衛の持続効果（+$1）。`); },
    // 冒険：呪いの森＝次の手番開始時 +3カード（購入フックはこの予約が消えると自然に無効化）。
    haunted_woods: (s, pi) => { draw(s, pi, 3); log(s, `${s.players[pi].name} は呪いの森の持続効果（+3カード）。`); },
    // 冒険：沼の妖婆＝次の手番開始時 +$3。
    swamp_hag: (s, pi) => { addCoins(s, 3); log(s, `${s.players[pi].name} は沼の妖婆の持続効果（+$3）。`); },
    // 帝国：女魔術師＝次の自分の手番開始時 +2カード（相手のアクション置換フックはこの予約とは独立に enchanted で処理済み）。
    enchantress: (s, pi) => { draw(s, pi, 2); log(s, `${s.players[pi].name} は女魔術師の持続効果（+2カード）。`); },
    /* ===== 移動動物園：持続4種 ===== */
    // 艀＝「次の自分のターンの開始時」を選んだぶん。+3カード +1購入。
    barge: (s, pi) => { draw(s, pi, 3); s.turn.buys += 1; log(s, `${s.players[pi].name} は艀の持続効果（+3カード +1購入）。`); },
    // 門番＝次の自分のターン開始時 +$3（相手の獲得を追放するフックはこの予約が消えると自然に無効化）。
    gatekeeper: (s, pi) => { addCoins(s, 3); log(s, `${s.players[pi].name} は門番の持続効果（+$3）。`); },
    // 村有緑地＝「次のターンの開始時」を選んだぶん。+1カード +2アクション。
    village_green: (s, pi) => { draw(s, pi, 1); addActions(s.turn, 2); log(s, `${s.players[pi].name} は村有緑地の持続効果（+1カード +2アクション）。`); },
    // ウミガメの習性＝脇に置いたカードを、次のターンの開始時にそのまま使用する（習性ではなく記載効果で）。
    way_turtle: (s, pi, e) => {
      const card = e && e.setAsideCard;
      const pl = s.players[pi];
      if (!card || !removeOne(pl.setAside, card)) return;
      pl.inPlay.push(card);
      s.turn.actionsPlayed = (s.turn.actionsPlayed || 0) + 1;
      log(s, `${pl.name} はウミガメの習性で脇の「${C()[card].name}」を使用する。`);
      applyEffect(s, card, pi);
    },
    // 首謀者＝次の自分のターン開始時、手札のアクション1枚を3回使用してよい（対話＝startQueue に積む）。
    mastermind: (s, pi) => {
      if (s.players[pi].hand.some((c) => DOM.isType(c, 'action') || inheritedEstate(s.players[pi], c))) {
        (s.turn.startQueue = s.turn.startQueue || []).push({ type: 'mastermind_play', player: pi });
      }
    },
  };

  // 「獲得時」フック（サル＝右隣の獲得で+1カード／封鎖＝同名獲得で呪い）。gain から常に呼ばれる。
  function triggerOnGain(state, pIndex, cardId, dest) {
    state._gainDepth = (state._gainDepth || 0) + 1;
    if (state._gainDepth > 6) { state._gainDepth--; return; } // 連鎖の暴走防止
    const n = state.players.length;
    // 帝国：ランドマークの購入フェイズ判定は「獲得が起きた時点のフェイズ」で見る。
    //   ヴィラの獲得時効果はこの関数の途中で phase を 'buy'→'action' に変えるので、それより前の値を捕まえておく
    //   （さもないと購入フェイズ中のヴィラ獲得で公会堂/列柱/汚された神殿の呪い が発火しない＝過小得点）。
    const gainWasBuyPhase = !!(state.turn && state.turn.phase === 'buy');
    // 移動動物園：**獲得した瞬間**に追放マットにあった同名の枚数。門番（追放するか）と
    //   追放マットの払い戻し（同名を全部捨て札に戻せるか）は、どちらもこの値で判定する＝両者は排他になる。
    const exiledBefore = exileCount(state.players[pIndex], cardId);
    for (let o = 0; o < n; o++) {
      const op = state.players[o];
      // サル：右隣（手番が自分の1つ前）の獲得ごとに +1カード
      if (op.monkeyActive && o !== pIndex && pIndex === (o - 1 + n) % n) {
        draw(state, o, 1); log(state, `${op.name} はサルの効果で +1カード（右隣の獲得）。`);
      }
      // 封鎖：他人が「自分の手番で」封鎖された同名カードを獲得したら呪いを獲得。
      // 同じプレイヤーが同名に複数の封鎖を伏せている（玉座/王の宮廷）なら、封鎖1枚につき呪い1枚。
      if (o !== pIndex && state.turn && pIndex === state.turn.active) {
        const bls = (op.delayedEffects || []).filter((e) => e.type === 'blockade' && e.gained === cardId);
        for (const bl of bls) {
          // 堀/灯台で免疫の相手（immune 登録済み）は呪いを受けない。
          if (!((bl.immune || []).includes(pIndex)) && (state.supply.curse || 0) > 0) { gain(state, pIndex, 'curse', 'discard'); log(state, `${state.players[pIndex].name} は封鎖により呪いを獲得した。`); }
        }
      }
    }
    // ===== 異郷：獲得時の「自動」効果（対話不要＝pending を立てない。連鎖は _gainDepth ガードで安全）=====
    const gp = state.players[pIndex];
    // 帝国：徴税（Tax）＝自分の購入フェイズにサプライから獲得したカードの山に負債があれば、その山の負債を全部受け取る。
    //   （「獲得時点のフェイズ」で見る＝ヴィラの phase 変更に負けない。誰の獲得でも「その人の購入フェイズ」＝手番プレイヤーのみ。）
    //   支配中は「獲得するのは支配者」＝支配者が山の負債を受け取る（gainer が possessedBy として渡ってくる）。
    if (state.pileDebt && state.turn && gainWasBuyPhase &&
        (pIndex === state.turn.active || (state.turn.possessedBy != null && pIndex === state.turn.possessedBy))) {
      const pk = pileKeyOf(state, cardId);
      const d = state.pileDebt[pk] || 0;
      if (d > 0) {
        gp.debt = (gp.debt || 0) + d; state.pileDebt[pk] = 0;
        log(state, `${gp.name} は徴税：${(C()[pk] && C()[pk].name) || pk}の山の負債${d}個 を受け取った。`);
      }
    }
    // キャッシュ：獲得したとき銅貨2枚を獲得。
    if (cardId === 'cache') { let g = 0; for (let i = 0; i < 2; i++) if (gain(state, pIndex, 'copper', 'discard')) g++; log(state, `${gp.name} はキャッシュで銅貨 ${g}枚 を獲得した。`); }
    // 大使館：獲得したとき、他の各プレイヤーは銀貨1枚を獲得。
    if (cardId === 'embassy') { for (let o = 0; o < n; o++) if (o !== pIndex && gain(state, o, 'silver', 'discard')) log(state, `${state.players[o].name} は銀貨1枚を獲得した（大使館）。`); }
    // 不正利得：獲得したとき、他の各プレイヤーは呪い1枚を獲得（アタックではない＝堀では防げない）。
    if (cardId === 'ill_gotten_gains') { for (let o = 0; o < n; o++) if (o !== pIndex && (state.supply.curse || 0) > 0 && gain(state, o, 'curse', 'discard')) log(state, `${state.players[o].name} は呪い1枚を獲得した（不正利得）。`); }
    // 遊牧民の野営地：獲得したとき、山札の一番上に置く。
    //   ※「手札に獲得する」効果（彫刻家/出納官/職人 等）で得た場合は手札に残す（獲得置換が2つ競合＝獲得者が選ぶ。
    //     RGG は彫刻家×遊牧民の野営地で「手札に入る」と明記）。
    if (cardId === 'nomad_camp' && dest !== 'hand') { const z = zoneOf(gp, dest); if (removeOne(z, 'nomad_camp')) { gp.deck.unshift('nomad_camp'); log(state, `${gp.name} は遊牧民の野営地を山札の上に置いた。`); } }
    /* ===== 夜想曲：獲得時の効果 ===== */
    /* 取り替え子＝取り替え子を使うゲームでは、**コスト$3以上のカードを獲得したとき**それを取り替え子と
       交換してよい（全プレイヤー・自分のターン以外でも・任意）。公式は「同時に起きる効果の順番は選べる」ので
       **交換の窓を先に開く**（後に回すとヴィラ/暗躍者/望楼が先に動いて lose-track で交換できなくなる）。 */
    if (changelingCanExchange(state, pIndex, cardId, dest)) {
      (state.onGainQueue = state.onGainQueue || []).unshift({ type: 'changeling_exchange', player: pIndex, card: cardId, dest: dest || 'discard' });
    }
    // 暗躍者：これを獲得したとき、金貨1枚を獲得する（あらゆる獲得経路。獲得の窓が2段になる）。
    if (cardId === 'skulk') { if (gain(state, pIndex, 'gold', 'discard')) log(state, `${gp.name} は暗躍者の獲得で金貨1枚を獲得した。`); }
    // 呪われた村：これを獲得したとき、**獲得した本人**が呪詛を1つ受ける（相手のターンの獲得でも）。
    if (cardId === 'cursed_village') receiveHex(state, pIndex);
    /* 恵みの村：これを獲得したとき祝福を1つ「取る」（＝山から抜いて中身を見せる）→
       今受けるか、次の自分のターンの開始時に受けるかを選ぶ。**取る時点で見せる**のが公式。 */
    if (cardId === 'blessed_village') {
      const b = takeBoon(state);
      if (b) (state.onGainQueue = state.onGainQueue || []).push({ type: 'blessed_village_boon', player: pIndex, boon: b });
    }
    // 墓地：これを獲得したとき、手札から最大4枚を廃棄する（0枚でもよい・**まとめて同時に**廃棄する）。
    if (cardId === 'cemetery') (state.onGainQueue = state.onGainQueue || []).push({ type: 'cemetery_trash', player: pIndex });
    /* 追跡者：**このターン**、カードを獲得したとき山札の上に置いてよい（2022エラッタ＝「これが場にある間」ではない）。
       移動遊園地と同じ窓＝onGainQueue に積む（既に山札の上に置かれた獲得は対象外）。 */
    if (state.turn && state.turn.trackerTurn && pIndex === state.turn.active && dest !== 'deck') {
      (state.onGainQueue = state.onGainQueue || []).push({ type: 'travelling_fair', player: pIndex, card: cardId, dest: dest || 'discard', src: 'tracker' });
    }
    /* ===== ルネサンス：獲得時の「自動」効果（対話不要＝pending を立てない）===== */
    // 追従者：獲得したとき +2村人（購入以外の獲得でも・相手のターンの獲得でも）。
    if (cardId === 'lackeys') { gp.villagers = (gp.villagers || 0) + 2; log(state, `${gp.name} は追従者の獲得で +2村人。`); }
    // 香辛料：獲得したとき +2財源（あらゆる獲得経路）。
    if (cardId === 'spices') { gp.coffers = (gp.coffers || 0) + 2; log(state, `${gp.name} は香辛料の獲得で +2財源。`); }
    // 絹商人：獲得または廃棄したとき +1財源+1村人（廃棄時は triggerOnTrash）。
    if (cardId === 'silk_merchant') {
      gp.coffers = (gp.coffers || 0) + 1; gp.villagers = (gp.villagers || 0) + 1;
      log(state, `${gp.name} は絹商人の獲得で +1財源+1村人。`);
    }
    // 実験：獲得したとき、実験をもう1枚獲得する（この2枚目では誘発しない＝フラグで抑止）。2枚目は必ず捨て札へ。
    if (cardId === 'experiment' && !state._experimentGain) {
      state._experimentGain = true;
      const g = gain(state, pIndex, 'experiment', 'discard');
      delete state._experimentGain;
      if (g) log(state, `${gp.name} は実験の獲得で もう1枚の実験を獲得した。`);
    }
    // 旗手：獲得したとき（および廃棄したとき＝triggerOnTrash）旗を受け取る（誰の獲得でも本人が取る）。
    if (cardId === 'flag_bearer') takeArtifact(state, pIndex, 'flag');
    // ドゥカート金貨：獲得したとき、手札の銅貨1枚を廃棄してもよい（任意・相手のターンの獲得でも本人が選ぶ）。
    //   対話＝onGainQueue（工房/改築等の *_GAIN 経由の獲得でも取りこぼさない）。
    if (cardId === 'ducat' && gp.hand.includes('copper')) {
      (state.onGainQueue = state.onGainQueue || []).push({ type: 'ducat_trash', player: pIndex });
    }
    // 貨物船：このターン中1回（貨物船1枚につき1回）、獲得したカードを表向きで脇に置いてよい（任意）。
    //   獲得先が置換されたカード（手札に獲得/山札の上に獲得）も、その場所から脇に置ける。
    if (state.turn && pIndex === state.turn.active && (state.turn.cargoCharges || 0) > 0) {
      (state.onGainQueue = state.onGainQueue || []).push({ type: 'cargo_ship_setaside', player: pIndex, card: cardId, dest: dest || 'discard' });
    }
    /* ===== ルネサンス：獲得時のプロジェクト ===== */
    if (state.projects && state.projects.length) {
      // 学園：アクションカードを獲得したとき +1村人（購入でも効果でも・相手のターン中に自分が獲得した場合も）。
      if (hasMyProject(state, pIndex, 'academy') && DOM.isType(cardId, 'action')) {
        gp.villagers = (gp.villagers || 0) + 1;
        log(state, `${gp.name} は学園で +1村人（アクション獲得）。`);
      }
      // ギルド集会所：財宝カードを獲得したとき +1財源（銅貨/銀貨/金貨も・サプライ外からの獲得でも）。
      if (hasMyProject(state, pIndex, 'guildhall') && isTreasureFor(state, cardId)) {
        gp.coffers = (gp.coffers || 0) + 1;
        log(state, `${gp.name} はギルド集会所で +1財源（財宝獲得）。`);
      }
      // 道路網：**他の**プレイヤーが勝利点カードを獲得したとき +1カード（自分のターン中の相手の獲得でも引く）。
      //   複数人が道路網を持ち得る＝獲得者以外の全員がそれぞれ引く。
      if (DOM.isType(cardId, 'victory')) {
        for (let o = 0; o < n; o++) {
          if (o !== pIndex && hasMyProject(state, o, 'road_network')) {
            const d = draw(state, o, 1);
            if (d.length) log(state, `${state.players[o].name} は道路網で +1カード（他のプレイヤーの勝利点獲得）。`);
          }
        }
      }
      // 技術革新：**あなたの各ターンに1回**、アクションカードを獲得したとき、そのカードを使用してもよい（2022エラッタ＝
      //   「最初に獲得した」ではなく「そのターン獲得したアクションのうち任意の1枚」）。使わなければ権利は消費しない。
      if (state.turn && pIndex === state.turn.active && hasMyProject(state, pIndex, 'innovation') &&
          !state.turn.innovationUsed && DOM.isType(cardId, 'action')) {
        (state.onGainQueue = state.onGainQueue || []).push({ type: 'innovation', player: pIndex, card: cardId, dest: dest || 'discard' });
      }
    }
    // 遊牧民：獲得したとき +2コイン（自分の手番のときのみ意味がある）。廃棄時の+2は triggerOnTrash。
    if (cardId === 'nomads' && state.turn && pIndex === state.turn.active) { addCoins(state, 2); log(state, `${gp.name} は遊牧民の獲得で +2コイン。`); }
    // 暗黒時代：死の荷車＝獲得したとき廃墟を2枚獲得（山の一番上から。足りなければあるだけ・非サプライではない配布）。
    if (cardId === 'death_cart') { let g = 0; for (let i = 0; i < 2; i++) if (gain(state, pIndex, 'ruins', 'discard')) g++; if (g) log(state, `${gp.name} は死の荷車の獲得で廃墟 ${g}枚 を獲得した。`); }
    // 冒険：失われし都市＝獲得したとき、他の各プレイヤーはカードを1枚引く（誰の獲得でも発動）。
    if (cardId === 'lost_city') { for (let o = 0; o < n; o++) if (o !== pIndex) { const d = draw(state, o, 1); if (d.length) log(state, `${state.players[o].name} は失われし都市の獲得で +1カード。`); } }
    // 帝国：ヴィラ＝獲得したとき手札に加え、自分の手番なら +1アクション。自分の購入フェイズ中の獲得ならアクションフェイズに戻る（何度でも）。
    if (cardId === 'villa') {
      if (dest !== 'hand') { const z = zoneOf(gp, dest); if (removeOne(z, 'villa')) gp.hand.push('villa'); }
      if (state.turn && pIndex === state.turn.active) {
        addActions(state.turn, 1);
        // 帝国：ヴィラで購入フェイズ→アクションフェイズに戻ると、次に購入フェイズへ入るとき闘技場が再度発動できる
        //   （公式：闘技場は購入フェイズ開始のたびに発動）。arenaFired を解除して再武装する。
        if (state.turn.phase === 'buy') { state.turn.phase = 'action'; state.turn.arenaFired = false; log(state, `${gp.name} はヴィラを獲得し手札に加え +1アクション（アクションフェイズに戻る）。`); }
        else log(state, `${gp.name} はヴィラを獲得し手札に加え +1アクション。`);
      }
    }
    // 帝国：公共広場（forum）＝獲得したとき +1購入（2022エラッタ＝「購入時」から「獲得時」に変更）。自分の手番でのみ意味がある。
    if (cardId === 'forum' && state.turn && pIndex === state.turn.active) { state.turn.buys += 1; log(state, `${gp.name} は公共広場の獲得で +1購入。`); }
    // 帝国：神殿（集合）＝獲得したとき（誰の獲得でも・購入含む・非購入獲得も）、神殿の山上の勝利点トークンをすべて得る。
    if (cardId === 'temple') {
      const vp = (state.pileVP && state.pileVP.temple) || 0;
      if (vp > 0) { gp.vpTokens = (gp.vpTokens || 0) + vp; state.pileVP.temple = 0; log(state, `${gp.name} は神殿の獲得で 山上の勝利点${vp}個 を得た。`); }
    }
    // 帝国：エンポリウム（emporium・分割山下）＝獲得したとき、場（inPlay＋durationCards）にアクション5枚以上なら +2勝利点。
    if (cardId === 'emporium') {
      const acts = gp.inPlay.filter((c) => DOM.isType(c, 'action')).length + (gp.durationCards || []).filter((c) => DOM.isType(c, 'action')).length;
      if (acts >= 5) { gp.vpTokens = (gp.vpTokens || 0) + 2; log(state, `${gp.name} はエンポリウムの獲得で +2勝利点（場のアクション${acts}枚）。`); }
    }
    // 帝国：石（rocks・分割山下）＝獲得したとき、銀貨1枚を獲得（購入フェイズ中なら山札の上・そうでなければ手札）。
    if (cardId === 'rocks') rocksGainSilver(state, pIndex);
    // 帝国：大金（fortune・分割山下）＝獲得したとき、場（inPlay＋durationCards）にある剣闘士1枚につき金貨1枚を獲得。
    if (cardId === 'fortune') {
      const glads = gp.inPlay.filter((c) => c === 'gladiator').length + (gp.durationCards || []).filter((c) => c === 'gladiator').length;
      let g = 0; for (let i = 0; i < glads; i++) if (gain(state, pIndex, 'gold', 'discard')) g++;
      if (g) log(state, `${gp.name} は大金の獲得で 剣闘士${glads}枚ぶん 金貨${g}枚を獲得した。`);
    }
    /* ===== 帝国 Batch E5：城の獲得時/廃棄時の自動効果 ===== */
    // 崩れた城（crumbling_castle）＝獲得または廃棄したとき +1勝利点トークン＋銀貨1枚（誰の獲得/廃棄でも）。廃棄時は triggerOnTrash。
    if (cardId === 'crumbling_castle') {
      gp.vpTokens = (gp.vpTokens || 0) + 1;
      const gs = gain(state, pIndex, 'silver', 'discard');
      log(state, `${gp.name} は崩れた城の獲得で +1勝利点${gs ? '＋銀貨1枚' : ''}。`);
    }
    // 壮大な城（grand_castle）＝獲得したとき手札を公開し、手札および場（inPlay+durationCards）の勝利点カード1枚につき +1勝利点（自身は捨て札で数えない）。
    if (cardId === 'grand_castle') {
      reveal(state, pIndex, gp.hand.slice(), '壮大な城：手札を公開');
      const vics = gp.hand.filter((c) => DOM.isType(c, 'victory')).length
        + gp.inPlay.filter((c) => DOM.isType(c, 'victory')).length
        + (gp.durationCards || []).filter((c) => DOM.isType(c, 'victory')).length;
      if (vics) { gp.vpTokens = (gp.vpTokens || 0) + vics; log(state, `${gp.name} は壮大な城の獲得で +${vics}勝利点（手札+場の勝利点${vics}枚）。`); }
    }
    // 幽霊城（haunted_castle）＝自分のターンに獲得したとき、金貨1枚を獲得（他Pの手札上げは下の pending 節で処理）。
    if (cardId === 'haunted_castle' && state.turn && pIndex === state.turn.active) {
      if (gain(state, pIndex, 'gold', 'discard')) log(state, `${gp.name} は幽霊城の獲得で金貨1枚を獲得した。`);
    }
    // 幽霊城＝各相手（手札5枚以上）は手札から2枚を山札の上へ（アタックではない＝堀では防げない）。
    //   対話＝onGainQueue（remodel/工房等の *_GAIN 経由で獲得しても取りこぼさない・reduce末尾で発火）。
    if (cardId === 'haunted_castle' && state.turn && pIndex === state.turn.active) {
      const q = [];
      for (let k = 1; k < n; k++) { const idx = (pIndex + k) % n; if (state.players[idx].hand.length >= 5) q.push(idx); }
      if (q.length) (state.onGainQueue = state.onGainQueue || []).push({ type: 'haunted_topdeck', player: q[0], source: pIndex, queue: q.slice(1) });
    }
    // 広大な城（sprawling_castle）＝獲得したとき、公領1枚か屋敷3枚を獲得（獲得者の選択）。対話＝onGainQueue。
    if (cardId === 'sprawling_castle') {
      (state.onGainQueue = state.onGainQueue || []).push({ type: 'sprawling_castle', player: pIndex });
    }
    /* ===== 移動動物園：獲得時 ===== */
    // 騎兵隊＝これを獲得したとき +2カード +1購入。自分の購入フェイズ中ならアクションフェイズに戻る（ヴィラと同型）。
    if (cardId === 'cavalry' && state.turn && pIndex === state.turn.active) {
      draw(state, pIndex, 2); state.turn.buys += 1;
      if (gainWasBuyPhase && state.turn.phase === 'buy') {
        state.turn.phase = 'action'; state.turn.arenaFired = false;
        log(state, `${gp.name} は騎兵隊の獲得で +2カード +1購入（アクションフェイズに戻る）。`);
      } else log(state, `${gp.name} は騎兵隊の獲得で +2カード +1購入。`);
    }
    // ラクダの隊列＝これを獲得したとき、サプライから金貨1枚を追放する（獲得ではない・誰の手番でも）。
    if (cardId === 'camel_train') exileFromSupply(state, pIndex, 'gold');
    // 貸し馬屋＝場にある間、コスト$4以上のカードを獲得するたびに馬1枚（場にある貸し馬屋の枚数ぶん）。
    //   馬自身は$3なので連鎖しない。
    if (state.turn && pIndex === state.turn.active) {
      const liveries = gp.inPlay.filter((c) => c === 'livery').length + (gp.durationCards || []).filter((c) => c === 'livery').length;
      if (liveries > 0 && costOf(state, cardId).coin >= 4) {
        for (let i = 0; i < liveries; i++) gainHorse(state, pIndex);
        log(state, `${gp.name} は貸し馬屋で 馬${liveries}枚 を獲得した。`);
      }
    }
    // 旅籠＝これを獲得したとき、手札の財宝を好きな枚数 公開して捨て、その枚数だけ馬を獲得してよい（対話）。
    if (cardId === 'hostelry' && state.turn && pIndex === state.turn.active && gp.hand.some((c) => isTreasureFor(state, c))) {
      (state.onGainQueue = state.onGainQueue || []).push({ type: 'hostelry_discard', player: pIndex });
    }
    // 門番（相手が使った持続アタック）＝「自分の追放マットに同名が無いアクション/財宝」を獲得したら、それを追放する（強制）。
    //   **条件（同名が追放マットに1枚も無い）は獲得した瞬間に見る**（公式：既に同名を追放していれば門番は働かず、
    //   通常どおり「同名を全部捨て札に戻す」窓が開く＝両者は排他）。
    //   **実行はそり/アザラシの窓の後**にする（公式の stop-moving ルール＝そりで手札に移すと門番は追放に失敗する）。
    const gkExile = (DOM.isType(cardId, 'action') || isTreasureFor(state, cardId)) && exiledBefore === 0 &&
      state.players.some((op, o) => o !== pIndex &&
        (op.delayedEffects || []).some((e) => e.type === 'gatekeeper' && !((e.immune || []).includes(pIndex))));
    // 牧羊犬＝あなたがカードを獲得したとき、手札からこれを使用してよい（相手のターン中の獲得でも使える＝公式）。
    if (gp.hand.includes('sheepdog')) {
      (state.onGainQueue = state.onGainQueue || []).push({ type: 'sheepdog_react', player: pIndex });
    }
    // そり＝あなたがカードを獲得したとき、これを捨て札にしてよい。そうしたら獲得したカードを手札か山札の上へ。
    if (gp.hand.includes('sleigh')) {
      (state.onGainQueue = state.onGainQueue || []).push({ type: 'sleigh_react', player: pIndex, card: cardId, dest: dest || 'discard' });
    }
    // 鷹匠＝**誰か**が種別を2つ以上持つカードを獲得したとき、手札からこれを使用してよい（全プレイヤーが対象）。
    if (((C()[cardId] || {}).types || []).length >= 2) {
      for (let o = 0; o < n; o++) {
        if (state.players[o].hand.includes('falconer')) {
          (state.onGainQueue = state.onGainQueue || []).push({ type: 'falconer_react', player: o });
        }
      }
    }
    // アザラシの習性＝このターン、カードを獲得したとき それを山札の上に置いてもよい（任意）。
    if (state.turn && state.turn.sealActive && pIndex === state.turn.active && dest !== 'deck') {
      (state.onGainQueue = state.onGainQueue || []).push({ type: 'way_seal_topdeck', player: pIndex, card: cardId, dest: dest || 'discard' });
    }
    // 門番の追放をここで実行する。**獲得したカードを動かせる窓（そり/アザラシの習性）が先に積まれているなら、
    //   それを解決してから**追放する（公式：そりで手札に移すと門番の追放は失敗する＝lose track）。
    //   動かす窓が無ければその場で追放する（従来どおり）。キューの `gatekeeper_exile` は**非対話**＝
    //   reduce 末尾のキュー消化がその場で適用する（pending にしない＝人間に無意味な確認を出さない）。
    if (gkExile) {
      const mover = (state.onGainQueue || []).some((q) =>
        q.player === pIndex && (q.type === 'sleigh_react' || q.type === 'way_seal_topdeck'));
      if (mover) state.onGainQueue.push({ type: 'gatekeeper_exile', player: pIndex, card: cardId, dest: dest || 'discard' });
      else applyGatekeeperExile(state, pIndex, cardId, dest);
    }
    // 一般ルール：**カードを獲得したとき、追放マットにある同名のカードを好きな枚数 捨て札にしてよい**（任意）。
    //   ラクダの隊列で追放した金貨を、金貨を獲得した瞬間にまとめて回収する、が典型。
    //   対話＝onGainQueue（工房/改築等の *_GAIN 経由の獲得でも取りこぼさない・複数の獲得時対話と共存できる）。
    //   ※相手のターン中に自分が獲得した場合（黒猫の呪いなど）は窓を開かない＝許容簡略化（呪いを戻したい場面が無い）。
    //   ※**門番が今まさに追放したカードは対象外**（`exiledBefore` ＝獲得した瞬間の枚数で判定する）。
    //     ここで現在の枚数を見ると、門番が追放した1枚をその場で捨て札に戻せてしまい、門番のアタックが
    //     自分の手番の購入に対して完全に無効化される（公式は "discard the **other** copies"＝門番のぶんは対象外）。
    if (state.turn && pIndex === state.turn.active && exiledBefore > 0) {
      (state.onGainQueue = state.onGainQueue || []).push({ type: 'exile_discard', player: pIndex, card: cardId });
    }
    // 移動動物園：投資（Invest・イベント）＝**他の**プレイヤーがそのカードを獲得したとき、投資した人が +2カード（強制・累積）。
    //   自分の獲得では誘発しない。追放は獲得ではないので、追放（門番/ラクダの隊列など）では誘発しない。
    triggerInvest(state, pIndex, cardId);
    // 役人：獲得したとき、場のすべての財宝を山札の上に置く（置いた順＝そのまま／簡略に選択なし）。
    if (cardId === 'mandarin') { const tre = gp.inPlay.filter((c) => isTreasureFor(state, c)); tre.forEach((c) => { removeOne(gp.inPlay, c); gp.deck.unshift(c); }); if (tre.length) log(state, `${gp.name} は役人で場の財宝 ${tre.length}枚 を山札の上に置いた。`); }
    // 大釜：自分の手番にアクションを獲得した回数を数え、3回目で（大釜が場にあれば）各相手が呪いを獲得。
    if (state.turn && pIndex === state.turn.active && DOM.isType(cardId, 'action')) {
      state.turn.actionsGainedThisTurn = (state.turn.actionsGainedThisTurn || 0) + 1;
      if (state.turn.actionsGainedThisTurn === 3 && gp.inPlay.includes('cauldron') && state._gainDepth === 1 && !state.pending) {
        log(state, `${gp.name} は大釜で このターン3回目のアクション獲得（各相手に呪い）。`);
        const cq = []; for (let k = 1; k < n; k++) cq.push((pIndex + k) % n);
        cauldronEnterVictim(state, pIndex, cq);
      }
    }
    // 繁栄：自分の手番に勝利点カードを獲得 → 場の隠し財産1枚につき金貨1枚（hoard）。
    if (state.turn && pIndex === state.turn.active && DOM.isType(cardId, 'victory')) {
      const hoards = state.players[pIndex].inPlay.filter((c) => c === 'hoard').length;
      for (let i = 0; i < hoards; i++) {
        if (gain(state, pIndex, 'gold', 'discard')) log(state, `${state.players[pIndex].name} は隠し財産で金貨を獲得した。`);
      }
    }
    // 帝国：庭師（groundskeeper）＝場にある庭師1枚につき、自分の手番に勝利点カードを獲得するたびVPトークン1個。
    if (state.turn && pIndex === state.turn.active && DOM.isType(cardId, 'victory')) {
      const gks = state.players[pIndex].inPlay.filter((c) => c === 'groundskeeper').length;
      if (gks) { state.players[pIndex].vpTokens = (state.players[pIndex].vpTokens || 0) + gks; log(state, `${state.players[pIndex].name} は庭師で +${gks} 勝利点。`); }
    }
    // 繁栄：自分の手番にアクションカードを獲得 → 場の収集1枚につき +1勝利点（collection）。
    if (state.turn && pIndex === state.turn.active && DOM.isType(cardId, 'action')) {
      const cols = state.players[pIndex].inPlay.filter((c) => c === 'collection').length;
      if (cols) { state.players[pIndex].vpTokens = (state.players[pIndex].vpTokens || 0) + cols; log(state, `${state.players[pIndex].name} は収集で +${cols} 勝利点。`); }
    }
    // 繁栄：物見やぐら（手札から公開→獲得物を廃棄か山札上へ）／ティアラ（獲得物を山札上へ）。
    // 安全側＝自分の手番・トップレベル獲得・他の対話が無いときだけ確認（船乗りと同方針）。
    if (state.turn && pIndex === state.turn.active && state._gainDepth === 1 && !state.pending) {
      const me = state.players[pIndex];
      if (me.hand.includes('watchtower')) state.pending = { type: 'watchtower', player: pIndex, card: cardId, dest: dest || 'discard' };
      else if (me.inPlay.includes('tiara')) state.pending = { type: 'tiara_topdeck', player: pIndex, card: cardId, dest: dest || 'discard' };
      // 異郷：国境の村＝獲得したとき、それより安いカード1枚を獲得（必須・獲得先があるときのみ）。
      else if (cardId === 'border_village' && anyGainable(state, (id) => costUnder(state, id, cardCost(state, 'border_village')))) {
        state.pending = { type: 'border_village', player: pIndex, maxCost: cardCost(state, 'border_village') - 1 };
      }
      // 異郷：宿屋＝獲得したとき、捨て札（これ自身含む）のアクションを好きな枚数、山札に混ぜてシャッフル。
      else if (cardId === 'inn' && me.discard.some((c) => DOM.isType(c, 'action'))) {
        state.pending = { type: 'inn_gain', player: pIndex };
      }
      // 異郷：スーク＝獲得したとき、手札から最大2枚を廃棄。
      else if (cardId === 'souk' && me.hand.length > 0) {
        state.pending = { type: 'souk_trash', player: pIndex };
      }
      // 異郷：公爵夫人＝公領を獲得したとき、公爵夫人1枚を獲得してよい（公爵夫人がサプライにあれば）。
      else if (cardId === 'duchy' && (state.supply.duchess || 0) > 0) {
        state.pending = { type: 'duchess_gain', player: pIndex };
      }
      // 異郷：交易商人のリアクション＝獲得したカードの代わりに銀貨を獲得してよい（自分の手番の獲得・銀貨自身は対象外）。
      //   **サプライ由来でない獲得（闇市場デッキ／廃棄置き場からの獲得＝gainFromOutside）は「山に戻す」ことができない**
      //   ＝窓を開かない（開くと supply に新キーが生える／廃棄した札が山に復活して3山終了が巻き戻る）。
      else if (me.hand.includes('trader') && cardId !== 'silver' && !state._gainOutside &&
               Object.prototype.hasOwnProperty.call(state.supply, pileKeyOf(state, cardId))) {
        state.pending = { type: 'trader_react', player: pIndex, card: cardId, dest: dest || 'discard' };
      }
    }
    // 異郷：狂戦士＝獲得したとき、場にアクションがあればこれを（獲得先の捨て札から場へ移して）使う。
    if (cardId === 'berserker' && state.turn && pIndex === state.turn.active && state._gainDepth === 1 && !state.pending &&
        state.players[pIndex].inPlay.some((c) => DOM.isType(c, 'action'))) {
      const bp = state.players[pIndex];
      if (removeOne(bp.discard, 'berserker')) {
        bp.inPlay.push('berserker');
        state.turn.actionsPlayed = (state.turn.actionsPlayed || 0) + 1;
        log(state, `${bp.name} は獲得した狂戦士を使った。`);
        applyEffect(state, 'berserker', pIndex);
      }
    }
    // 異郷：愚者の黄金＝他プレイヤーが属州を獲得したとき、手札の愚者の黄金を廃棄して金貨を山札の上に獲得してよい。
    if (cardId === 'province' && state._gainDepth === 1 && !state.pending) {
      foolsGoldReactWindow(state, pIndex);
    }
    // 船乗り：自分の手番に持続カードを獲得したら、このターン1度だけ即プレイしてよい（確認ダイアログ）。
    // 別の対話(pending)の最中に起きた獲得では出さない（安全側＝主に「購入」時に発動）。
    if (state.turn && pIndex === state.turn.active && (state.turn.sailorPlays || 0) > 0 &&
        DOM.isType(cardId, 'duration') && !state.pending) {
      state.turn.sailorPlays -= 1;
      state.pending = { type: 'sailor_play_gain', player: pIndex, card: cardId, dest: dest || 'discard' };
    }
    // 海辺：財宝を獲得したとき、手札に海賊を持つプレイヤーは反応して使ってよい（安全側＝トップレベル獲得・他の対話が無いとき）。
    if (isTreasureFor(state, cardId) && state._gainDepth === 1 && !state.pending) {
      pirateReactWindow(state, pIndex);
    }
    // 暗黒時代：納屋（避難所・リアクション）＝勝利点カードを獲得したとき、手札の納屋を廃棄してよい（圧縮）。
    //   主用途＝自分の手番に属州/公領/屋敷を購入したとき（トップレベル獲得・他の対話が無いとき）。
    if (DOM.isType(cardId, 'victory') && state.turn && pIndex === state.turn.active &&
        state._gainDepth === 1 && !state.pending && gp.hand.includes('hovel')) {
      state.pending = { type: 'hovel_react', player: pIndex };
    }
    // 冒険：複製＝$6以下のカードを獲得したとき、酒場マットの複製を呼び出してコピーを獲得してよい（自分の手番・トップレベル獲得のみ）。
    if (state.turn && pIndex === state.turn.active && state._gainDepth === 1 && !state.pending &&
        (gp.tavern || []).includes('duplicate') && costUpTo(state, cardId, 6)) { // 成分別比較＋非サプライ/ロック中の下段を除外
      state.pending = { type: 'duplicate', player: pIndex, card: cardId };
    }
    // 帝国：御守り（charm）のモードB＝このターン「次に」カードを獲得したとき、同コスト（$・負債・ポーション一致）で名前の異なるカードを1枚獲得してよい（積んだ枚数ぶん）。
    if (state.turn && pIndex === state.turn.active && state._gainDepth === 1 && !state.pending && (state.turn.charmNextGain || 0) > 0) {
      const cnt = state.turn.charmNextGain; state.turn.charmNextGain = 0; // 「次の獲得」で消費（対象が無くても消化）
      const trigCoin = cardCost(state, cardId), trigDebt = (C()[cardId] && C()[cardId].debt) || 0, trigPot = potionCost(cardId);
      const canGain = (id) => id !== cardId && costExact(state, id, trigCoin, trigPot, trigDebt);
      if (anyGainable(state, canGain)) state.pending = { type: 'charm_gain', player: pIndex, coin: trigCoin, debt: trigDebt, pot: trigPot, trig: cardId, count: cnt };
    }
    /* ===== 帝国：横型ランドスケープ（ランドマーク）の獲得トリガー（VPトークンのみ＝pendingを立てない）===== */
    if (state.landmarks && state.landmarks.length) {
      const active = state.turn ? state.turn.active : -1;
      const inBuy = gainWasBuyPhase; // ヴィラが phase を戻しても「獲得時点」の購入フェイズ判定を使う
      // 戦場：勝利点カードを獲得したとき、ここから +2勝利点（誰の獲得でも本人へ）。
      if (hasLandmark(state, 'battlefield') && DOM.isType(cardId, 'victory')) {
        if (takeLandmarkVP(state, pIndex, 'battlefield', 2)) log(state, `${gp.name} は戦場で +2勝利点（勝利点カード獲得）。`);
      }
      // 迷宮：自分のターンに2枚目のカードを獲得したとき、+2勝利点。
      if (hasLandmark(state, 'labyrinth') && pIndex === active && (state.turn.gainedThisTurn || []).length === 2) {
        if (takeLandmarkVP(state, pIndex, 'labyrinth', 2)) log(state, `${gp.name} は迷宮で +2勝利点（このターン2枚目の獲得）。`);
      }
      // 公会堂：購入フェイズ中にカードを獲得したとき、コインが2以上残っていれば +2勝利点。
      if (hasLandmark(state, 'basilica') && pIndex === active && inBuy && (state.turn.coins || 0) >= 2) {
        if (takeLandmarkVP(state, pIndex, 'basilica', 2)) log(state, `${gp.name} は公会堂で +2勝利点（購入フェイズ・$${state.turn.coins}残）。`);
      }
      // 列柱：購入フェイズ中にアクションカードを獲得したとき、同名が場に出ていれば +2勝利点。
      if (hasLandmark(state, 'colonnade') && pIndex === active && inBuy && DOM.isType(cardId, 'action') &&
          (gp.inPlay.includes(cardId) || (gp.durationCards || []).includes(cardId))) {
        if (takeLandmarkVP(state, pIndex, 'colonnade', 2)) log(state, `${gp.name} は列柱で +2勝利点（同名アクションが場に）。`);
      }
      // 水道橋：財宝を獲得→その山から1VPを水道橋へ移す（銀貨/金貨の山にのみVPがある）。勝利点カードを獲得→水道橋上の全VPを受け取る。
      if (hasLandmark(state, 'aqueduct')) {
        if (isTreasureFor(state, cardId) && (state.pileVP[cardId] || 0) > 0) {
          state.pileVP[cardId] -= 1; state.landmarkStash.aqueduct = (state.landmarkStash.aqueduct || 0) + 1;
          log(state, `${gp.name} の獲得で ${C()[cardId].name}の山から勝利点1個が水道橋へ移った（計${state.landmarkStash.aqueduct}個）。`);
        }
        if (DOM.isType(cardId, 'victory')) {
          const got = state.landmarkStash.aqueduct || 0;
          if (got > 0) { gp.vpTokens = (gp.vpTokens || 0) + got; state.landmarkStash.aqueduct = 0; log(state, `${gp.name} は水道橋から +${got}勝利点（勝利点カード獲得）。`); }
        }
      }
      // 汚された神殿：アクションを獲得→その山から1VPを汚された神殿へ移す。購入フェイズ中に呪いを獲得→神殿上の全VPを受け取る。
      if (hasLandmark(state, 'defiled_shrine')) {
        /* 【実バグ修正】山上VPは**山キー**に載っている＝獲得した実カードidで引くと取れない。
           分割山の下段（帝国：騒がしい村/石/大金…）と同盟の分割山の2枚目以降は、
           VPが山の上に置かれたまま永久に孤児化していた（徴税で踏んだのと同型＝§0-20）。 */
        const shrinePile = pileKeyOf(state, cardId);
        if (DOM.isType(cardId, 'action') && (state.pileVP[shrinePile] || 0) > 0) {
          state.pileVP[shrinePile] -= 1; state.landmarkStash.defiled_shrine = (state.landmarkStash.defiled_shrine || 0) + 1;
          log(state, `${gp.name} の獲得で ${C()[shrinePile].name}の山から勝利点1個が汚された神殿へ移った（計${state.landmarkStash.defiled_shrine}個）。`);
        }
        if (cardId === 'curse' && pIndex === active && inBuy) {
          const got = state.landmarkStash.defiled_shrine || 0;
          if (got > 0) { gp.vpTokens = (gp.vpTokens || 0) + got; state.landmarkStash.defiled_shrine = 0; log(state, `${gp.name} は汚された神殿から +${got}勝利点（購入フェイズに呪いを獲得）。`); }
        }
      }
      // 峠：最初に属州が獲得されたとき（誰の獲得でも）、そのターンの後に競りを行う（1ゲーム1回・endBuyTail で起動）。
      if (hasLandmark(state, 'mountain_pass') && cardId === 'province' && !state.mountainPassArmed && !state.mountainPassDone) {
        state.mountainPassArmed = { gainer: pIndex };
      }
    }
    /* ===== 冒険：立案（Plan）の廃棄トークン＝そのトークンを置いた山からカードを獲得したとき、手札1枚を廃棄してよい =====
       2022エラッタで「購入したとき」→「獲得したとき」に変更。トークンの持ち主が獲得したかどうかだけで判定する
       （相手のターン中の獲得でも発火する／購入以外の獲得＝工房等でも発火する）。分割山の下段は上段キーに正規化。 */
    if (gp.pileTokens && gp.pileTokens.trash && gp.hand.length > 0 && gp.pileTokens.trash === pileKeyOf(state, cardId)) {
      (state.onGainQueue = state.onGainQueue || []).push({ type: 'plan_trash', player: pIndex });
    }
    /* ===== 冒険：移動遊園地＝このターン、獲得したカードを山札の上に置いてよい（獲得のたびに任意）=====
       gainer の pending 中の獲得（工房/改築等）でも取りこぼさないよう onGainQueue に積む（城の on-gain 対話と同型）。
       既に山札の上に置かれた獲得（dest==='deck'）は対象外。 */
    if (state.turn && state.turn.travellingFair && pIndex === state.turn.active && dest !== 'deck') {
      (state.onGainQueue = state.onGainQueue || []).push({ type: 'travelling_fair', player: pIndex, card: cardId, dest: dest || 'discard' });
    }
    /* ===== 同盟：「カードを獲得したとき」に働く Ally（1ゲームに1枚だけなので下は排他）=====
       獲得時の対話は**必ず `onGainQueue` に積む**（`state.pending` 直代入は望楼/牧羊犬/交易商人の窓を握りつぶす）。
       ⚠ **その獲得で得た好意もその場で使える**（公式FAQ）＝窓を開く時点ではなく**解決時点**の p.favors を見る
         （下の各 reducer が改めて枚数を検査する＝ここでは「使える可能性がある」ことだけを見る）。 */
    if (state.ally) {
      const myTurn = !!(state.turn && pIndex === state.turn.active);
      /* 建築家ギルド＝好意2で「そのカードより安い、勝利点でないカード」1枚を獲得（**自己連鎖する**）。
         判定するコストは「**2枚目を獲得しようとしている時点**」の1枚目のコスト（＝獲得先に入った後）＝
         cardCost をここで焼き込まず、解決時に測り直す（遊牧民団とは基準時点が違う＝取り違えない）。
         テキストに自ターン限定が無い＝相手のターン中の獲得でも使える。 */
      if (state.ally === 'architects_guild') {
        (state.onGainQueue = state.onGainQueue || []).push({ type: 'ally_architects', player: pIndex, card: cardId });
      }
      /* 遊牧民団＝**獲得した瞬間**のコストが$3以上なら好意1で +1カード / +1アクション / +1購入 のどれか1つ。
         公式FAQ：後でコストが変わっても関係ない＝ここで焼き込む。相手のターン中でも使える（+アクション/+購入は無意味だが合法）。 */
      if (state.ally === 'band_of_nomads' && cardCost(state, cardId) >= 3) {
        (state.onGainQueue = state.onGainQueue || []).push({ type: 'ally_nomads', player: pIndex, card: cardId });
      }
      /* 都市国家＝**自分のターン中に**アクションカードを獲得したとき、好意2でそれを使用する（アクション権は消費しない）。
         公式が名指しで「遊牧民団と違い自分のターンだけ」と対比している＝相手のターンでは絶対に開かない。 */
      if (state.ally === 'city_state' && myTurn && DOM.isType(cardId, 'action')) {
        (state.onGainQueue = state.onGainQueue || []).push({ type: 'ally_city_state', player: pIndex, card: cardId, dest: dest || 'discard' });
      }
      // 罠師の小屋＝好意1で、獲得したカードを山札の上に置く（望楼/移動遊園地と同型。相手のターンの獲得でも使える）。
      if (state.ally === 'trappers_lodge' && dest !== 'deck') {
        (state.onGainQueue = state.onGainQueue || []).push({ type: 'ally_trappers', player: pIndex, card: cardId, dest: dest || 'discard' });
      }
    }
    state._gainDepth--;
  }
  /* ---------- 異郷：捨て札にしたとき／廃棄したときのフック ---------- */
  // 小道／織工を（捨て札や廃棄置き場から）場に出して使う共通処理。反応で使うので +アクションは自分の手番のときだけ。
  function trailPlay(state, pi, fromZone) {
    const p = state.players[pi];
    const z = fromZone === 'trash' ? state.trash : p.discard;
    if (!removeOne(z, 'trail')) return;
    p.inPlay.push('trail');
    if (state.turn && pi === state.turn.active) state.turn.actionsPlayed = (state.turn.actionsPlayed || 0) + 1;
    draw(state, pi, 1);
    if (state.turn && pi === state.turn.active) addActions(state.turn, 1);
    log(state, `${p.name} は小道を使った（+1カード${state.turn && pi === state.turn.active ? ' +1アクション' : ''}）。`);
  }
  // クリンナップ以外でカードを捨てたとき（tunnel=金貨獲得／trail=使う／weaver=使って獲得）。
  //   discardedCards = 今捨てたカードの配列。tunnel/trail は常に自動（純利得）。weaver は安全なときだけ選択、
  //   それ以外（相手のアタックで捨てさせられた等）は銀貨2枚（安全側・pending を立てない）。
  function triggerOnDiscard(state, pIndex, discardedCards, noPrompt) {
    const p = state.players[pIndex];
    let weaverN = 0;
    (discardedCards || []).forEach((c) => {
      if (c === 'tunnel') { if (gain(state, pIndex, 'gold', 'discard')) log(state, `${p.name} はトンネルを公開して金貨1枚を獲得した。`); }
      else if (c === 'trail') { trailPlay(state, pIndex, 'discard'); }
      else if (c === 'weaver') weaverN++;
    });
    for (let i = 0; i < weaverN; i++) {
      if (!removeOne(p.discard, 'weaver')) continue;
      p.inPlay.push('weaver');
      if (state.turn && pIndex === state.turn.active) state.turn.actionsPlayed = (state.turn.actionsPlayed || 0) + 1;
      if (!noPrompt && state.turn && pIndex === state.turn.active && !state.pending) {
        state.pending = { type: 'weaver', player: pIndex }; // 自分の手番・対話が無いときは獲得選択
      } else {
        let g = 0; for (let s = 0; s < 2; s++) if (gain(state, pIndex, 'silver', 'discard')) g++;
        log(state, `${p.name} は捨てた織工を使い、銀貨 ${g}枚 を獲得した。`);
      }
    }
    // 移動動物園：村有緑地＝**クリンナップ以外で**これを捨て札にしたとき、これを使用してよい（任意）。
    //   自分の手札から捨てても、山札から捨てても、相手のターン中でも誘発する（公式）。
    //   対話はキューに積む（他の捨て札トリガーや獲得時対話と競合させない）。
    if (!noPrompt) {
      const vg = (discardedCards || []).filter((c) => c === 'village_green').length;
      for (let i = 0; i < vg; i++) (state.onGainQueue = state.onGainQueue || []).push({ type: 'village_green_react', player: pIndex });
      /* 夜想曲：忠犬＝**クリンナップ以外で**これを捨て札にするとき、脇に置いてよい（任意）。
         そうしたら**そのターンの終了時**に手札に加える（＝相手のターンに捨てても、その相手のターンの終わりに戻る）。
         手札からとは限らず山札から捨てられても誘発する（本アプリの捨て札トリガーの配線範囲＝§0-25 の既知簡略化）。 */
      const fh = (discardedCards || []).filter((c) => c === 'faithful_hound').length;
      for (let i = 0; i < fh; i++) (state.onGainQueue = state.onGainQueue || []).push({ type: 'faithful_hound_react', player: pIndex });
    }
  }
  // カードを廃棄したときのフック（誰の廃棄でも「持ち主」に発動）。trashCard から呼ぶ。
  //   戻り値 = そのカードが廃棄置き場に残ったか（城塞＝手札に戻るので false）。
  //   ※対話（pending）を要する on-trash（地下墓所/狩場/従者）は §カード実装バッチで on-trash キューとして追加する。
  function triggerOnTrash(state, pIndex, card, opts) {
    const p = state.players[pIndex];
    const fromSupply = !!(opts && opts.fromSupply); // サプライの山からの廃棄（塩まき/待ち伏せ/剣闘士）＝「あなたのカード」ではない
    /* 夜想曲：呪いの鏡（家宝）＝これを廃棄したとき、手札のアクション1枚を捨てて幽霊1枚を獲得してもよい（任意）。
       対話なので onTrashQueue に積む（アタック中の廃棄や、廃棄札の続きの獲得と競合させない）。 */
    if (card === 'haunted_mirror' && !fromSupply && p.hand.some((c) => DOM.isType(c, 'action')) && (state.supply.ghost || 0) > 0) {
      (state.onTrashQueue = state.onTrashQueue || []).push({ type: 'haunted_mirror', player: pIndex });
    }
    // 異郷：遊牧民＝廃棄したとき +2コイン（自分の手番のときのみ意味がある）。
    if (card === 'nomads' && state.turn && pIndex === state.turn.active) {
      addCoins(state, 2);
      log(state, `${p.name} は遊牧民の廃棄で +2コイン。`);
    }
    // 暗黒時代：城塞＝廃棄されたとき手札に戻る（廃棄自体は成立＝死の荷車の+$5や行進の獲得は満たされる）。
    if (card === 'fortress') {
      removeOne(state.trash, 'fortress');
      p.hand.push('fortress');
      log(state, `${p.name} は城塞を廃棄したが手札に戻した。`);
      return false;
    }
    // 暗黒時代：ネズミ／草茂る屋敷＝廃棄されたとき +1カード（持ち主が引く）。
    if (card === 'rats') { draw(state, pIndex, 1); log(state, `${p.name} はネズミの廃棄で +1カード。`); }
    if (card === 'overgrown_estate') { draw(state, pIndex, 1); log(state, `${p.name} は草茂る屋敷の廃棄で +1カード。`); }
    // 暗黒時代：封土＝廃棄されたとき銀貨3枚を獲得。
    if (card === 'feodum') { let g = 0; for (let i = 0; i < 3; i++) if (gain(state, pIndex, 'silver', 'discard')) g++; log(state, `${p.name} は封土の廃棄で銀貨 ${g}枚 を獲得した。`); }
    // 暗黒時代：サー・ヴァンダー＝廃棄されたとき金貨1枚を獲得。
    if (card === 'sir_vander') { if (gain(state, pIndex, 'gold', 'discard')) log(state, `${p.name} はサー・ヴァンダーの廃棄で金貨1枚を獲得した。`); }
    // 暗黒時代：狂信者＝廃棄されたとき +3カード（持ち主が引く。相手のアタックで廃棄されても発動）。
    if (card === 'cultist') { draw(state, pIndex, 3); log(state, `${p.name} は狂信者の廃棄で +3カード。`); }
    // 暗黒時代：従者＝廃棄されたときサプライのアタックカードを1枚獲得（対話＝onTrashQueue へ）。
    if (card === 'squire' && anyGainable(state, (id) => gainableBase(state, id) && isTypeSupply(state, id, 'attack'))) {
      (state.onTrashQueue = state.onTrashQueue || []).push({ type: 'squire_trash_gain', player: pIndex });
    }
    // 暗黒時代：地下墓所＝廃棄されたとき、これより安いカード1枚を獲得（対話＝onTrashQueue へ）。
    if (card === 'catacombs') {
      const under = cardCost(state, 'catacombs');
      if (anyGainable(state, (id) => costUnder(state, id, under))) {
        (state.onTrashQueue = state.onTrashQueue || []).push({ type: 'catacombs_trash', player: pIndex, under });
      }
    }
    // 暗黒時代：狩場＝廃棄されたとき、公領1枚 or 屋敷3枚 を選んで獲得（対話＝onTrashQueue へ）。
    if (card === 'hunting_grounds') {
      (state.onTrashQueue = state.onTrashQueue || []).push({ type: 'hunting_grounds_trash', player: pIndex });
    }
    // ルネサンス：絹商人＝獲得または廃棄したとき +1財源+1村人。
    //   公式＝「廃棄を実行したプレイヤー」が得る。本エンジンの trashCard は owner=被害者 で呼ぶので、
    //   詐欺師/騎士/盗賊などのアタックでは**被害者**が得る（＝攻撃側の利敵）＝公式と一致。
    if (card === 'silk_merchant') {
      p.coffers = (p.coffers || 0) + 1; p.villagers = (p.villagers || 0) + 1;
      log(state, `${p.name} は絹商人の廃棄で +1財源+1村人。`);
    }
    // ルネサンス：旗手＝獲得または廃棄したとき旗を受け取る（廃棄を実行したプレイヤー＝owner）。
    if (card === 'flag_bearer') takeArtifact(state, pIndex, 'flag');
    // 帝国：石（rocks）＝獲得または廃棄したとき銀貨1枚を獲得（購入フェイズ中なら山札の上・そうでなければ手札）。
    if (card === 'rocks') rocksGainSilver(state, pIndex);
    // 帝国：崩れた城（crumbling_castle）＝獲得または廃棄したとき +1勝利点トークン＋銀貨1枚（獲得は triggerOnGain）。
    if (card === 'crumbling_castle') {
      p.vpTokens = (p.vpTokens || 0) + 1;
      const gs = gain(state, pIndex, 'silver', 'discard');
      log(state, `${p.name} は崩れた城の廃棄で +1勝利点${gs ? '＋銀貨1枚' : ''}。`);
    }
    // 暗黒時代：青空市場（リアクション）＝**自分のカード**が廃棄されたとき、手札の青空市場を捨てて金貨を獲得してよい
    //   （誰のターンでも・相手のアタックでの廃棄でも発動。1廃棄に複数枚反応可）。対話＝onTrashQueue へ。
    //   **サプライの山からの廃棄（待ち伏せ/剣闘士/塩まき）は「自分のカード」ではない＝反応しない**（公式）。
    if (!fromSupply && p.hand.includes('market_square') && (state.supply.gold || 0) > 0) {
      (state.onTrashQueue = state.onTrashQueue || []).push({ type: 'market_square_react', player: pIndex });
    }
    return true;
  }
  // 異郷：値切り屋＝場にある間、カードを購入するたびに、そのコスト未満の勝利点でないカード1枚を獲得（枚数ぶん）。
  //   「より安い」は成分別比較（ポーション費用/負債コストの札を購入した場合も正しく効く）。
  //   pending には購入した札のコスト3成分を焼き込む（旧スナップショットは coin 欠落 → maxCost から復元）。
  function hagglerCanGain(state, ref, id) {
    return costUnder(state, id, ref.coin, ref) && !isTypeSupply(state, id, 'victory');
  }
  function maybeHagglerGains(state, pi, ref) {
    const hagglers = state.players[pi].inPlay.filter((c) => c === 'haggler').length;
    if (hagglers > 0 && !state.pending &&
        anyGainable(state, (id) => hagglerCanGain(state, ref, id))) {
      state.pending = { type: 'haggler', player: pi, remaining: hagglers, maxCost: ref.coin - 1, coin: ref.coin, pot: ref.pot, debt: ref.debt };
    }
  }

  // 「財宝を出したとき」フック（私掠船＝相手のターン最初の銀/金を廃棄。コインは入る）。
  function corsairOnPlayTreasure(state, pIndex, card) {
    if (card !== 'silver' && card !== 'gold') return;
    const t = state.turn;
    if (!t || t.corsairTrashed || pIndex !== t.active) return; // このターン最初の銀/金のみ・出した本人の手番中
    const someoneElse = state.players.some((p, i) => i !== pIndex && (p.delayedEffects || []).some((e) => e.type === 'corsair'));
    if (!someoneElse) return;
    if (removeOne(state.players[pIndex].inPlay, card)) {
      trashCard(state, pIndex, card); t.corsairTrashed = true;
      log(state, `${state.players[pIndex].name} は私掠船により「${C()[card].name}」を廃棄した。`);
    }
  }
  // 海辺：海賊のリアクション（誰かが財宝を獲得したとき、手札の海賊を使ってよい）。
  // 手番順（獲得者を含む）に、手札に海賊を持つプレイヤーへ「使う/使わない」窓を出す。
  // 使うと海賊を場に出して持続予約（次の手番に6コスト以下の財宝を手札へ）。相手の手番中でも予約は本人の次手番開始で発火する。
  function pirateReactWindow(state, gainerIndex) {
    const n = state.players.length;
    const start = (state.turn && state.turn.active != null) ? state.turn.active : gainerIndex;
    const queue = [];
    for (let k = 0; k < n; k++) {
      const seat = (start + k) % n;
      if (state.players[seat].hand.includes('pirate')) queue.push(seat);
    }
    if (queue.length) pirateReactEnter(state, queue);
  }
  function pirateReactEnter(state, queue) {
    queue = (queue || []).slice();
    while (queue.length && !state.players[queue[0]].hand.includes('pirate')) queue.shift();
    if (!queue.length) { state.pending = null; return; }
    const seat = queue[0];
    state.pending = { type: 'pirate_react', player: seat, queue: queue.slice(1) };
  }
  // アタック無効化（灯台が場/持続にある被害者はアタックを受けない）。§手6で各アタックに配線。
  function attackImmune(state, victim) {
    const v = state.players[victim];
    // 冒険：チャンピオン＝場にある間（永続持続）、他プレイヤーのアタックの影響を受けない。
    /* 夜想曲：守護者＝使用してから**次の自分のターンの開始時まで**アタックの影響を受けない。
       灯台（"While this is in play"＝次の自分のターン中も守られる）とは窓が違うので、
       灯台の述語を流用してはいけない（1ターンぶん過剰に守ってしまう）＝専用フラグで管理する。 */
    return v.inPlay.includes('lighthouse') || (v.durationCards || []).includes('lighthouse')
        || v.inPlay.includes('champion') || (v.durationCards || []).includes('champion')
        || !!v.guardianActive;
  }

  /* ============================================================
     夜想曲（Nocturne）：祝福(Boon) / 呪詛(Hex) / 状態(State) の共通機構
     正本＝docs/research/nocturne_rules.md §機構3・4・5（冒頭の「実装前に必読」4〜6も参照）。
     - 祝福・呪詛・状態は**カードではない**（allCards にも invariants の ZONES にも入れない）。
     - 「祝福を受ける」＝山の一番上をめくって従う。山が空なら捨て札をシャッフルして作り直す。
       **山も捨て札も空なら受けられない**（pending を開かずに終端する）。
     - **「1つの効果で複数の祝福を順に受ける」が普通に起きる**（ドルイド／愚者3枚／恵みの村／ピクシー2回）ので、
       `state.pending` に直接代入せず **`state.boonQueue` に積む**（§0-26 の要求(demand)で望楼の窓を
       握りつぶした事故と同型）。reduce 末尾の再開網が1件ずつ解決する。
     - 「他のプレイヤーは各自、次の呪詛を受ける」＝**リアクションを全員ぶん閉じてから呪詛を1枚だけめくり**、
       免疫でない全員が**同じ1枚**に従う（被害者ごとにめくり直さない＝ルール違反になりやすい最頻の事故）。
     ============================================================ */
  const LS = () => DOM.LANDSCAPES || {};
  const lsName = (id) => (LS()[id] && LS()[id].name) || id;
  // 「他のプレイヤー全員」を手番順（手番プレイヤーの左隣から）で並べる。
  function othersInOrder(state, pi) {
    const out = [];
    for (let k = 1; k < state.players.length; k++) out.push((pi + k) % state.players.length);
    return out;
  }
  // クリンナップまで受け手の前に置く祝福3種（残りは解決後すぐ祝福の捨て札へ）。
  const BOON_KEEPERS = new Set(['the_fields_gift', 'the_forests_gift', 'the_rivers_gift']);
  // 「+コイン を与える」祝福＝聖なる木立ちで他プレイヤーと共有できない2種（公式）。
  const BOON_GIVES_COIN = new Set(['the_fields_gift', 'the_forests_gift']);
  // 同じ祝福idは1枚しか存在しない＝どこにあっても取り除いてから置き直す（ピクシーの2回受けを冪等にする）。
  function removeBoonAnywhere(state, boon) {
    const b = state.boons; if (!b) return;
    removeOne(b.deck, boon); removeOne(b.discard, boon);
    state.players.forEach((p) => {
      if (p.boonsInFront) removeOne(p.boonsInFront, boon);
      if (p.boonsHeld) removeOne(p.boonsHeld, boon);
    });
  }
  // 祝福の山から1枚めくる（空なら捨て札をシャッフルして作り直す。両方空なら null＝受けられない）。
  //   **ドルイドの脇3枚と、各プレイヤーが保持中の祝福は新しい山に入れない**（公式）。
  function takeBoon(state) {
    const b = state.boons; if (!b) return null;
    if (!b.deck.length) {
      if (!b.discard.length) return null;
      b.deck = shuffle(b.discard.slice()); b.discard = [];
      log(state, '祝福の捨て札をシャッフルして山を作り直した。');
    }
    return b.deck.shift() || null;
  }
  // 呪詛の山から1枚めくる（祝福と違い「任意で作り直す」節は無い＝空なら必ず作り直す）。
  function takeHex(state) {
    const h = state.hexes; if (!h) return null;
    if (!h.deck.length) {
      if (!h.discard.length) return null;
      h.deck = shuffle(h.discard.slice()); h.discard = [];
      log(state, '呪詛の捨て札をシャッフルして山を作り直した。');
    }
    return h.deck.shift() || null;
  }
  // 祝福をキューに積む（opts.aside＝ドルイドの脇に置いたまま／opts.place===false＝置き直さない）。
  function queueBoon(state, pi, boon, opts) {
    if (!boon) return false;
    (state.boonQueue = state.boonQueue || []).push(Object.assign({ player: pi, boon: boon }, opts || {}));
    return true;
  }
  // 「祝福を n つ受ける」＝山からめくってキューに積む（受けられない分は静かに終わる）。
  function receiveBoon(state, pi, n) {
    let got = 0;
    for (let i = 0; i < (n || 1); i++) { const b = takeBoon(state); if (!b) break; queueBoon(state, pi, b); got++; }
    return got;
  }
  /* 祝福1件の解決。**置き場所を先に確定してから効果を適用する**（途中で選択待ちが立っても状態が破綻しない）。 */
  function applyBoonEntry(state, q) {
    const pi = q.player, boon = q.boon, p = state.players[pi], t = state.turn;
    if (!p) return;
    if (!q.aside && q.place !== false) {
      // 聖なる木立ちの共有（q.share）＝**同じ1枚を複数人が受ける**ので、先に受けた人の前から取り上げない。
      if (!q.share) removeBoonAnywhere(state, boon);
      if (BOON_KEEPERS.has(boon)) (p.boonsInFront = p.boonsInFront || []).push(boon);
      else if (state.boons && !q.share) state.boons.discard.push(boon);
    }
    log(state, `${p.name} は祝福「${lsName(boon)}」を受けた。`);
    switch (boon) {
      case 'the_seas_gift': // +1 カード
        draw(state, pi, 1);
        break;
      /* ターン資源（+アクション/+コイン/+購入）は**手番プレイヤーが受けたときだけ**入る
         （聖なる木立ちで他プレイヤーが受けても手番プレイヤーの資源にしない）。 */
      case 'the_fields_gift': // +1 アクション +1 コイン（クリンナップまで前に置く）
        if (pi === t.active) { addActions(t, 1); addCoins(state, 1); }
        break;
      case 'the_forests_gift': // +1 購入 +1 コイン（クリンナップまで前に置く）
        if (pi === t.active) { t.buys += 1; addCoins(state, 1); }
        break;
      /* 川の恵み＝「このターンの終了時 +1カード」。**受けた回数**で数える（非カードのカウンタ）＝
         ドルイドで脇から受けた場合（前に置かない）やピクシーで2回受けた場合も正しく効く。 */
      case 'the_rivers_gift':
        p.riverDraws = (p.riverDraws || 0) + 1;
        break;
      case 'the_mountains_gift': // 銀貨1枚を獲得
        if (gain(state, pi, 'silver', 'discard')) log(state, `${p.name} は山の恵みで銀貨1枚を獲得した。`);
        break;
      case 'the_swamps_gift': // ウィル・オ・ウィスプ1枚を獲得（山が空なら何も起きない）
        if (gain(state, pi, 'will_o_wisp', 'discard')) log(state, `${p.name} は沼の恵みでウィル・オ・ウィスプ1枚を獲得した。`);
        break;
      case 'the_winds_gift': // +2カード → 手札2枚を捨てる（**強制**・実際に引けたかに関わらず）
        draw(state, pi, 2);
        if (p.hand.length) state.pending = { type: 'boon_wind', player: pi };
        break;
      case 'the_flames_gift': // 手札1枚を廃棄してもよい
        if (p.hand.length) state.pending = { type: 'boon_flame', player: pi };
        break;
      case 'the_earths_gift': // 手札の財宝1枚を捨てて、コスト$4以下を1枚獲得してもよい
        if (p.hand.some((c) => isTreasureFor(state, c))) state.pending = { type: 'boon_earth', player: pi };
        break;
      case 'the_skys_gift': // 手札3枚を捨てて金貨1枚を獲得してもよい（3枚未満なら捨てるだけで金貨は得られない）
        if (p.hand.length) state.pending = { type: 'boon_sky', player: pi };
        break;
      case 'the_moons_gift': // 捨て札を全部見て、その中の1枚を山札の上に置いてもよい（見るのは強制・置くのは任意）
        if (p.discard.length) state.pending = { type: 'boon_moon', player: pi };
        break;
      case 'the_suns_gift': { // 山札の上から4枚を見て、好きな枚数を捨て、残りを好きな順で戻す
        const look = [];
        for (let i = 0; i < 4; i++) {
          if (p.deck.length === 0) { if (p.discard.length === 0) break; reshuffleDeck(p); }
          if (p.deck.length === 0) break;
          look.push(p.deck.shift());
        }
        if (look.length) state.pending = { type: 'look_arrange', player: pi, cards: look, source: 'the_suns_gift' };
        break;
      }
      default: break;
    }
  }
  /* 呪詛。**リアクションを全員ぶん閉じてから1枚だけめくる**（hexReactEnter → dealHex）。 */
  function startHexAttack(state, source, victims) {
    hexReactEnter(state, source, (victims || []).slice(), []);
  }
  function hexReactEnter(state, source, queue, accepted) {
    queue = (queue || []).slice();
    while (queue.length) {
      const v = queue.shift();
      if (attackImmune(state, v)) continue; // 灯台/チャンピオン/守護者＝影響を受けない
      if (hasReaction(state.players[v])) {
        state.pending = { type: 'hex', stage: 'react', player: v, source, victim: v, queue: queue.slice(), accepted: accepted.slice() };
        return;
      }
      accepted.push(v);
    }
    dealHex(state, source, accepted);
  }
  /* 全員のリアクション窓を閉じた後で、はじめて呪詛を1枚めくる。
     **免疫者しかいなくてもカードの指示があれば1枚めくって捨てる**（jwiki 明文・confidence medium）。 */
  function dealHex(state, source, victims) {
    const hex = takeHex(state);
    state.pending = null;
    if (!hex) return;
    log(state, `呪詛「${lsName(hex)}」がめくられた。`);
    const t = state.turn;
    t.currentHex = hex;
    t.hexQueue = (victims || []).slice();
    if (!t.hexQueue.length) { finishHex(state); return; }
    runHexQueue(state);
  }
  // キューの被害者へ同じ1枚を手番順に適用する（選択待ちが立ったら止まり、reduce 末尾の再開網が続きを回す）。
  function runHexQueue(state) {
    const t = state.turn;
    let guard = 0;
    while (!state.pending && t.hexQueue && t.hexQueue.length && guard++ < 20) {
      const v = t.hexQueue.shift();
      applyHexTo(state, v, t.currentHex);
    }
    // 被害者が尽きたら（キューが null でも）必ず後始末する＝currentHex が残ると再演が永久に止まる。
    if (!state.pending && !(t.hexQueue && t.hexQueue.length)) finishHex(state);
  }
  function finishHex(state) {
    const t = state.turn;
    if (!t.currentHex) { t.hexQueue = null; return; }
    if (state.hexes) state.hexes.discard.push(t.currentHex);
    t.currentHex = null; t.hexQueue = null;
  }
  /* 「自分が呪詛を1つ受ける」（呪われた村の獲得時／レプラコーン＝非アタック）。
     **別の呪詛の配布中に呼ばれ得る**（蝗害の獲得で呪われた村を取る等）ので、その場合は
     `state.hexSelfQueue` に積んで reduce 末尾の再開網に譲る（現在の呪詛を上書きしない）。 */
  function receiveHex(state, pi) {
    const t = state.turn;
    if (!state.hexes) return;
    /* 別の呪詛の配布中（currentHex）や**獲得の処理中**（_gainDepth>0＝呪われた村の獲得時など）は、
       その場で pending を立てると同じ獲得で開くはずの窓（望楼/そり/取り替え子の交換…）を握りつぶす。
       reduce 末尾の再開網に譲る（§0-26 の教訓）。 */
    if ((t && t.currentHex) || (state._gainDepth || 0) > 0) { (state.hexSelfQueue = state.hexSelfQueue || []).push(pi); return; }
    const hex = takeHex(state);
    if (!hex) return;
    log(state, `呪詛「${lsName(hex)}」がめくられた。`);
    t.currentHex = hex; t.hexQueue = [pi];
    runHexQueue(state);
  }
  function applyHexTo(state, pi, hex) {
    const p = state.players[pi];
    if (!p) return;
    log(state, `${p.name} は呪詛「${lsName(hex)}」を受けた。`);
    switch (hex) {
      case 'delusion': // 錯乱も嫉妬も持っていなければ錯乱を取る（**持っているだけでは効かない**＝購入フェイズ開始時に返して発動）
        if (!p.deluded && !p.envious) { p.deluded = true; log(state, `${p.name} は錯乱を取った。`); }
        break;
      case 'envy':
        if (!p.deluded && !p.envious) { p.envious = true; log(state, `${p.name} は嫉妬を取った。`); }
        break;
      case 'misery': // 1回目＝生活苦(-2VP)／2回目＝二重苦(-4VP)／3回目以降は何も起きない
        if (!p.misery) { p.misery = 1; log(state, `${p.name} は生活苦を取った（-2勝利点）。`); }
        else if (p.misery === 1) { p.misery = 2; log(state, `${p.name} は二重苦になった（-4勝利点）。`); }
        break;
      case 'greed': // 銅貨1枚を獲得し山札の上に置く（捨て札置き場を経由しない）
        if (gain(state, pi, 'copper', 'deck')) log(state, `${p.name} は銅貨1枚を山札の上に獲得した（貪欲）。`);
        break;
      case 'plague': // 呪い1枚を手札に獲得（呪い山が空なら何も起きない）
        if (gain(state, pi, 'curse', 'hand')) log(state, `${p.name} は呪い1枚を手札に獲得した（疫病）。`);
        break;
      case 'poverty': // 手札が3枚になるように捨てる
        if (p.hand.length > 3) state.pending = { type: 'hex_poverty', player: pi };
        break;
      case 'fear': // 手札5枚以上ならアクションか財宝1枚を捨てる（できなければ手札を公開）
        if (p.hand.length >= 5) {
          if (p.hand.some((c) => DOM.isType(c, 'action') || isTreasureFor(state, c))) state.pending = { type: 'hex_fear', player: pi };
          else reveal(state, pi, p.hand.slice(), '恐怖：捨てられるアクション/財宝がない');
        }
        break;
      case 'haunting': // 手札4枚以上なら手札1枚を山札の上に置く
        if (p.hand.length >= 4) state.pending = { type: 'hex_haunting', player: pi };
        break;
      case 'bad_omens': { // 山札を捨て札に置き、捨て札から銅貨2枚を山札の上へ（できなければ捨て札を公開）
        // 「山札を捨て札置き場に置く」は**捨て札トリガーを誘発しない**（公式・英語wiki 明記）。
        while (p.deck.length) p.discard.push(p.deck.shift());
        let got = 0;
        for (let i = 0; i < 2; i++) { if (removeOne(p.discard, 'copper')) { p.deck.unshift('copper'); got++; } }
        if (got < 2) reveal(state, pi, p.discard.slice(0, 8), '凶兆：銅貨が足りない（捨て札を公開）');
        log(state, `${p.name} は山札を捨て札にし、銅貨 ${got}枚 を山札の上に置いた（凶兆）。`);
        break;
      }
      case 'famine': { // 山札の上3枚を公開し、アクションを全部捨てる。残りを山札に加えてシャッフル
        const rev = [];
        for (let i = 0; i < 3; i++) {
          if (p.deck.length === 0) { if (p.discard.length === 0) break; reshuffleDeck(p); }
          if (p.deck.length === 0) break;
          rev.push(p.deck.shift());
        }
        if (rev.length) reveal(state, pi, rev.slice(), '飢饉');
        const acts = rev.filter((c) => DOM.isType(c, 'action'));
        const rest = rev.filter((c) => !DOM.isType(c, 'action'));
        acts.forEach((c) => p.discard.push(c));
        // 「残りを山札に加えてシャッフル」＝その場でシャッフルが発生する（対話は挟めない＝既存の許容簡略化と同型）。
        p.deck = shuffle(p.deck.concat(rest));
        placeStash(p);
        log(state, `${p.name} は飢饉でアクション ${acts.length}枚 を捨て、残りを山札に混ぜた。`);
        if (acts.length) triggerOnDiscard(state, pi, acts);
        break;
      }
      case 'locusts': { // 山札の一番上を廃棄。銅貨か屋敷なら呪い／そうでなければ「同じ種別を持ちコストが少ないカード」を獲得
        if (p.deck.length === 0 && p.discard.length) reshuffleDeck(p);
        if (!p.deck.length) { log(state, `${p.name} は蝗害を受けたが山札が空だった。`); break; }
        const top = p.deck.shift();
        reveal(state, pi, [top], '蝗害', { notReveal: true });
        trashCard(state, pi, top);
        log(state, `${p.name} は蝗害で「${C()[top].name}」を廃棄した。`);
        if (top === 'copper' || top === 'estate') {
          if (gain(state, pi, 'curse', 'discard')) log(state, `${p.name} は呪い1枚を獲得した（蝗害）。`);
        } else {
          const ref = costOf(state, top);
          // **成分別のコスト比較**（素の `cost <` は禁止＝mix-all で livelock する）＋種別の共有。
          const okId = (id) => costUnder(state, id, ref.coin, ref) && sharesType(id, top);
          if (anyGainable(state, okId)) state.pending = { type: 'hex_locusts', player: pi, ref: top, coin: ref.coin, pot: ref.pot, debt: ref.debt };
        }
        break;
      }
      case 'war': { // コスト$3か$4のカードが公開されるまで山札の上から公開し、それを廃棄して残りを捨てる
        const rev = [];
        let found = null, guard = 0;
        while (guard++ < 200) {
          if (p.deck.length === 0) { if (p.discard.length === 0) break; reshuffleDeck(p); }
          if (p.deck.length === 0) break;
          const c = p.deck.shift();
          const cc = costOf(state, c);
          // ポーション費用/負債コストを持つカードは「コスト$3/$4」ではない（成分別に比較する）。
          if ((cc.coin === 3 || cc.coin === 4) && cc.pot === 0 && cc.debt === 0) { found = c; break; }
          rev.push(c);
        }
        if (rev.length || found) reveal(state, pi, (found ? rev.concat([found]) : rev).slice(-8), '戦争');
        // 公式の順序＝「そのカードを廃棄し、残りを捨てる」（廃棄時ドローの結果が変わる）。
        if (found) { trashCard(state, pi, found); log(state, `${p.name} は戦争で「${C()[found].name}」を廃棄した。`); }
        else log(state, `${p.name} は戦争でコスト3〜4のカードを見つけられなかった（廃棄なし）。`);
        rev.forEach((c) => p.discard.push(c));
        if (rev.length) triggerOnDiscard(state, pi, rev);
        break;
      }
      default: break;
    }
  }
  // 蝗害用：2枚のカードが種別（カード下部の種別欄の語）を1つ以上共有するか。
  function sharesType(a, b) {
    const ta = (C()[a] && C()[a].types) || [], tb = (C()[b] && C()[b].types) || [];
    return ta.some((x) => tb.indexOf(x) >= 0);
  }
  /* コンクラーベ／インプ＝「あなたの場に**同名が出ていない**アクションカード1枚を手札から使用してもよい」。
     - 判定は「今その名前が場にあるか」だけ（このターンに使ったかは無関係）。
     - **前のターンから残っている持続カードも「場にある」**＝その名前は選べない。
     - **持続アクションもプレイできる**（王子/船長/大君主/はみだし者/行進の non-Duration 制限を流用してはいけない）。 */
  function conclaveTargets(state, pi) {
    const p = state.players[pi];
    const inPlay = new Set(p.inPlay.concat(p.durationCards || []));
    return [...new Set(p.hand.filter((c) => (DOM.isType(c, 'action') || inheritedEstate(p, c)) && !inPlay.has(c)))];
  }
  /* ===== 夜想曲：交換（exchange）＝**獲得でも廃棄でもない** =====
     - `triggerOnGain` も `triggerOnTrash` も呼ばない（望楼/そり/追跡者/追放の払い戻し等は発火しない）。
     - ただし `supply` は増減する＝**3山終了には影響する**。
     - 「戻す山が無いカード」は交換できない（闇市場で買った札／家宝／ゾンビ）。
     戻り値＝交換できたか。 */
  function exchangeCard(state, pi, fromId, toId, zone) {
    if (!canReturnToPile(state, fromId)) return false; // 戻す山が無い＝交換できない
    if ((state.supply[toId] || 0) <= 0) return false;  // 交換先の山が空
    if (zone && !removeOne(zone, fromId)) return false;
    returnToPile(state, fromId);                       // 混合山（騎士/城/同盟の分割山）は一番上に載せる
    state.supply[toId] -= 1;
    state.players[pi].discard.push(toId);             // 交換で得たカードは**どこから交換しても捨て札へ**
    log(state, `${state.players[pi].name} は「${C()[fromId].name}」を「${C()[toId].name}」と交換した。`);
    return true;
  }
  /* 取り替え子の交換窓＝「取り替え子を使うゲームで、**コスト$3以上**のカードを獲得したとき、
     それを取り替え子と交換してもよい」（全プレイヤー・自分のターン以外でも）。
     成立条件は3つとも必要：①獲得したカードがまだ獲得先にある ②由来する山に戻せる ③取り替え子の在庫がある。
     コスト判定は**獲得した瞬間**の実コストのコイン成分が3以上か（ポーション/負債は常に0以上＝コインだけ見れば同値）。 */
  function changelingCanExchange(state, pi, cardId, dest) {
    if ((state.supply.changeling || 0) <= 0) return false;
    if (cardId === 'changeling') return false;
    if (!canReturnToPile(state, cardId)) return false; // 山を持たない（家宝/ゾンビ/闇市場由来）＝戻せない
    //   ※混合山（騎士/城/同盟の分割山）の中身は山キーで戻せる＝交換できる（公式：その山の一番上に載る）
    if (cardCost(state, cardId) < 3) return false;
    const z = zoneOf(state.players[pi], dest);
    return !!z && z.indexOf(cardId) >= 0;           // 獲得先にまだあること（stop-moving）
  }
  /* ネクロマンサーの対象＝廃棄置き場の「**表向き**・持続でない」アクションカード（インデックス列を返す）。
     裏向きフラグは**廃棄置き場の物理カード1枚ずつ**に付く（同名が2枚あれば片方だけ裏向きにできる）。 */
  function necromancerTargets(state) {
    /* 裏向きフラグは**廃棄置き場の物理カード1枚ずつ**に付くが、`state.trash` は id 配列で、
       墓暴き/待ち伏せ/盗賊/城塞 などで**途中から抜ける**ため「添字」で覚えるとズレる
       （ズレると同じゾンビを同一ターンに2回使えてしまう）。**id ごとの枚数**で持つ。 */
    const fd = state.trashFaceDown || {};
    const used = {};
    const out = [];
    (state.trash || []).forEach((c, i) => {
      if (!DOM.isType(c, 'action') || DOM.isType(c, 'duration')) return;
      const down = fd[c] || 0;
      const seen = used[c] || 0;
      used[c] = seen + 1;
      if (seen < down) return; // このidの裏向きぶんを先に消費する
      out.push(i);
    });
    return out;
  }
  /* 悪魔祓い＝「廃棄したカードより**厳密に安い**精霊カード」の候補（engine/CPU/UI が必ずこれを見る）。
     ⚠ 精霊は**非サプライ**なので `costUnder`（＝`gainableBase` を含む）では常に候補ゼロになる。
        それに気づかず CPU が null を返し続けて本番 livelock になった（fuzz が検出）。 */
  function exorcistSpirits(state, ref) {
    const r = { coin: (ref && ref.coin) || 0, pot: (ref && ref.pot) || 0, debt: (ref && ref.debt) || 0 };
    return SPIRITS.filter((id) => (state.supply[id] || 0) > 0 && costLT(costOf(state, id), r));
  }
  // 偶像（財宝アタック）＝偶数枚なら他のプレイヤー全員が呪いを獲得。堀/灯台/守護者で防げる。
  function idolEnterVictim(state, source, queue) {
    queue = (queue || []).filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'idol', stage: 'react', player: victim, source, victim, queue: rest };
    } else idolCurse(state, source, victim, rest);
  }
  function idolCurse(state, source, victim, queue) {
    if (gain(state, victim, 'curse', 'discard')) log(state, `${state.players[victim].name} は呪いを獲得した（偶像）。`);
    idolEnterVictim(state, source, queue);
  }
  /* 「アタックカードを使用した」こと自体に反応するリアクション（番犬/隊商の護衛/物乞い/馬商人/外交官）は、
     そのアタックが**相手に何もしない場合でも**窓が開く（公式）。人狼をアクションフェイズで使う（+3カード）／
     迫害者が場が空でインプを獲得する ケースがこれに当たる。窓を全部閉じてから本体の効果を解決する。 */
  function attackWindowEnter(state, source, queue, after) {
    queue = (queue || []).filter((v) => !attackImmune(state, v));
    while (queue.length) {
      const v = queue[0];
      if (hasReaction(state.players[v])) {
        state.pending = { type: 'attack_window', stage: 'react', player: v, source, victim: v, queue: queue.slice(1), after };
        return;
      }
      queue = queue.slice(1);
    }
    state.pending = null;
    finishAttackWindow(state, source, after);
  }
  function finishAttackWindow(state, source, after) {
    const p = state.players[source];
    if (after === 'werewolf_draw') draw(state, source, 3);
    else if (after === 'tormentor_imp') {
      if (gain(state, source, 'imp', 'discard')) log(state, `${p.name} は迫害者でインプ1枚を獲得した。`);
    }
  }
  /* 夜襲（夜行・持続・アタック）＝手札5枚以上の他プレイヤーは「使用者の場にあるカードと同名の1枚」を捨てる。
     捨てられなければ手札を公開する（**本物の「捨てる」**＝忠犬/坑道などの捨て札トリガーが誘発する）。 */
  function raiderEnterVictim(state, source, queue) {
    queue = (queue || []).filter((v) => !attackImmune(state, v));
    if (!queue.length) { state.pending = null; return; }
    const victim = queue[0], rest = queue.slice(1);
    if (hasReaction(state.players[victim])) {
      state.pending = { type: 'raider', stage: 'react', player: victim, source, victim, queue: rest };
    } else raiderApply(state, source, victim, rest);
  }
  function raiderTargets(state, source, victim) {
    const sp = state.players[source], vp = state.players[victim];
    const inPlay = new Set(sp.inPlay.concat(sp.durationCards || []));
    return [...new Set(vp.hand.filter((c) => inPlay.has(c)))];
  }
  function raiderApply(state, source, victim, queue) {
    const vp = state.players[victim];
    if (vp.hand.length >= 5) {
      const cand = raiderTargets(state, source, victim);
      if (cand.length) { state.pending = { type: 'raider', stage: 'discard', player: victim, source, victim, queue }; return; }
      reveal(state, victim, vp.hand.slice(), '夜襲：捨てられるカードがない');
    }
    raiderEnterVictim(state, source, queue);
  }

  /* ---------- クリーンアップ＆次の番へ ---------- */
  function cleanupAndAdvance(state) {
    state.replay = []; // 玉座の間の保留分が万一残っても次手番に持ち越さない
    state.reveals = {}; state.revealLatest = null; // 公開表示は手番をまたいで持ち越さない
    // 夜想曲：ネクロマンサーで裏返した廃棄置き場のカードは**ターン終了時にすべて表向きに戻す**（毎ターン使える）。
    state.trashFaceDown = {};
    const pi = state.turn.active;
    const p = state.players[pi];
    // 帝国：女魔術師の enchanted（「その手番で最初のアクションが置換」）は、その相手の手番が終われば消える。
    p.enchanted = false;
    // 帝国：陣地＝金貨/鹵獲品を公開しなかった陣地を脇から自分の分割山（サプライ）へ戻す（片付け開始時）。
    //   分割山が場に無い（黒市場経由など supply.encampment 未定義）なら戻せず脇に残る＝所有カードとして数える。
    {
      const encReturn = state.turn.encampmentReturn || 0;
      for (let i = 0; i < encReturn; i++) {
        if (state.supply.encampment != null && removeOne(p.setAside, 'encampment')) state.supply.encampment += 1;
      }
    }
    // 城壁のある村: クリーンアップ開始時、場のアクションが（自身を含め）2枚以下なら山札の上に戻せる。
    // 村を山札に戻すのはほぼ常に得なので自動で戻す。
    if (p.inPlay.includes('walled_village')) {
      const actionsInPlay = p.inPlay.filter((c) => DOM.isType(c, 'action')).length;
      if (actionsInPlay <= 2) {
        let n = 0;
        while (removeOne(p.inPlay, 'walled_village')) { p.deck.unshift('walled_village'); n++; }
        if (n) log(state, `${p.name} は城壁のある村 ${n}枚 を山札の上に戻した。`);
      }
    }
    // 宝物庫：このターンに勝利点カードを獲得していなければ、場の宝物庫を山札の上に戻せる（常に得なので自動）。
    if (p.inPlay.includes('treasury') && !(state.turn.gainedThisTurn || []).some((id) => DOM.isType(id, 'victory'))) {
      let n = 0;
      while (removeOne(p.inPlay, 'treasury')) { p.deck.unshift('treasury'); n++; }
      if (n) log(state, `${p.name} は宝物庫 ${n}枚 を山札の上に戻した。`);
    }
    // 錬金術：錬金術師＝片付け開始時、場にポーションがあれば山札の上に戻す（毎ターン使い回せて強いので自動）。
    // ※薬草商より先に処理（薬草商がポーションを先に戻すと錬金術師の条件が崩れるため）。
    if (p.inPlay.includes('alchemist') && p.inPlay.includes('potion')) {
      let n = 0;
      while (removeOne(p.inPlay, 'alchemist')) { p.deck.unshift('alchemist'); n++; }
      if (n) log(state, `${p.name} は錬金術師 ${n}枚 を山札の上に戻した。`);
    }
    // 錬金術：薬草商＝この片付けで、場の財宝を（薬草商の数だけ）山札の上に置いてよい。
    // 銀貨以上の価値ある財宝（ポーション/賢者の石/金貨/銀貨）を自動で戻す（銅貨はデッキを濁すので戻さない）。
    if (state.turn.herbalists) {
      let remain = state.turn.herbalists;
      const rank = (c) => ({ potion: 5, philosophers_stone: 4, gold: 3, silver: 2 }[c] || 0);
      while (remain-- > 0) {
        const cand = p.inPlay.filter((c) => isTreasureFor(state, c) && rank(c) > 0).sort((a, b) => rank(b) - rank(a))[0];
        if (!cand) break;
        removeOne(p.inPlay, cand); p.deck.unshift(cand);
        log(state, `${p.name} は薬草商で「${C()[cand].name}」を山札の上に置いた。`);
      }
    }
    // 移動動物園：カエルの習性＝このターン、これを場から捨てるとき山札の上に置く（片付けで捨てる直前に抜き取る）。
    if ((state.turn.frogTopdeck || []).length) {
      let n = 0;
      state.turn.frogTopdeck.forEach((c) => { if (removeOne(p.inPlay, c)) { p.deck.unshift(c); n++; } });
      if (n) log(state, `${p.name} はカエルの習性で ${n}枚 を山札の上に置いた。`);
    }
    // 密輸人用：このターンに獲得したカードを「直前の手番の獲得」として保存（右隣がこれを参照）。
    p.lastTurnGains = (state.turn.gainedThisTurn || []).slice();
    // 移動動物園：ヤギ飼い用＝このターンに廃棄した枚数を「直前の手番の廃棄数」として保存（左隣がこれを参照）。
    p.trashedLastTurn = p.trashedThisTurn || 0;
    p.trashedThisTurn = 0;

    // --- 海辺：持続カードの仕分け（捨てずに持ち越す）---
    // 予約（delayedEffects）が残っている枚数ぶんだけ durationCards に保持。出し切った持続は捨て札へ。
    const cnt = {}; (p.delayedEffects || []).forEach((e) => { cnt[e.card] = (cnt[e.card] || 0) + 1; });
    // 新プロモ：王子＝カードを脇に置いた王子は（毎ターン開始時効果を持つ持続として）ゲーム終了まで
    // 場に残り続ける。稼働中の王子（princes の要素数）ぶんだけ物理カードを保持する。
    if ((p.princes || []).length) cnt.prince = (cnt.prince || 0) + p.princes.length;
    // 冒険：雇人＝永続持続。稼働数ぶん物理カードを durationCards に残す（princes と同型）。
    if (p.hirelings) cnt.hireling = (cnt.hireling || 0) + p.hirelings;
    // 冒険：チャンピオン＝永続持続（ゲーム終了まで場に残る）。稼働数ぶん物理カードを durationCards に残す。
    if (p.champions) cnt.champion = (cnt.champion || 0) + p.champions;
    // 帝国：資料庫＝脇にカードが残っている資料庫の数ぶん、物理カードを durationCards に残す（stashが尽きたら捨て札へ）。
    if ((p.archives || []).length) cnt.archive = (cnt.archive || 0) + p.archives.length;
    const used = {}; const newDur = [];
    for (const c of (p.durationCards || [])) {
      if ((used[c] || 0) < (cnt[c] || 0)) { newDur.push(c); used[c] = (used[c] || 0) + 1; }
      else p.discard.push(c); // 効果を出し切った持続 → 捨て札へ
    }
    const restInPlay = [];
    for (const c of p.inPlay) {
      if (DOM.isType(c, 'duration') && (used[c] || 0) < (cnt[c] || 0)) { newDur.push(c); used[c] = (used[c] || 0) + 1; }
      else restInPlay.push(c);
    }
    // 帝国：元手（capital）＝場から捨てるとき、それ1枚につき負債6を負い、そのターンの残コインで可能な限り即返済。
    //   （通常はコインを使い切っているので負債6が残り次の購入フェイズに持ち越す。玉座/冠で2回使っても物理1枚＝1回発火。）
    {
      const caps = restInPlay.filter((c) => c === 'capital').length;
      if (caps > 0) {
        p.debt = (p.debt || 0) + 6 * caps;
        const r = Math.min(p.debt, state.turn.coins || 0);
        if (r > 0) { p.debt -= r; state.turn.coins -= r; }
        log(state, `${p.name} は元手を捨て 負債${6 * caps} を負った${r > 0 ? `（うち${r}を即返済）` : ''}。`);
      }
    }
    /* ルネサンス：角笛（Horn・アーティファクト）＝各ターンに1度、場から国境警備隊を捨て札にするとき、
       代わりに山札の上に置いてよい。**この「置き換え」は必ず“次の手札の先引き”より前に処理する**
       （後にすると1ターン遅れて引かれる＝角笛がほぼ無効化される。本エンジンは片付けで次の手札を先引きするため）。
       「ほぼ常に得」なので自動で置く（城壁のある村／宝物庫の自動返却と同じ扱い＝許容簡略化）。 */
    if (hasArtifact(state, pi, 'horn') && removeOne(restInPlay, 'border_guard')) {
      p.deck.unshift('border_guard');
      log(state, `${p.name} は角笛で国境警備隊を山札の上に置いた。`);
    }
    /* 同盟：沿岸の避難港＝好意を払って残した手札は**捨てない**（この後の先引き5枚に合流して手札7枚等になる）。
       引く枚数は変わらない（前哨地の3枚でも3枚引いて、残した札はそれに加算される＝公式）。 */
    const coastalKeep = [];
    (state.turn.coastalKeep || []).forEach((c) => { if (removeOne(p.hand, c)) coastalKeep.push(c); });
    p.discard.push(...restInPlay, ...p.hand);
    p.durationCards = newDur;
    p.inPlay = [];
    p.hand = coastalKeep;

    // 支配：この手番が被支配ターンなら精算する。
    //   獲得したカード → 支配者の捨て札へ（支配者が受け取る）／廃棄したカード → 被支配者の捨て札へ戻す（実際には廃棄されない）。
    if (state.turn.possessedBy != null) {
      const possIdx = state.turn.possessedBy;
      const gains = state.turn.possessionGains || [];
      const back = state.turn.possessionTrash || [];
      gains.forEach((c) => state.players[possIdx].discard.push(c));
      back.forEach((c) => p.discard.push(c));
      if (gains.length) log(state, `${state.players[possIdx].name} は支配で獲得された ${gains.length}枚 を受け取った。`);
      if (back.length) log(state, `${p.name} は支配で廃棄されかけた ${back.length}枚 を取り戻した。`);
    }

    // 前哨地：このプレイヤーの追加ターンか（手札3枚で同一プレイヤー続行）。
    const extra = !!p.outpostExtra;
    p.outpostExtra = false;
    // 冒険：使節団＝追加ターン（手札は通常5枚だが、そのターンはカードを購入できない）。
    //   前哨地と同時に立った場合は前哨地を優先し、使節団ぶんは不発（＝3連続ターンにはできない・公式）。
    const missionExtra = !!p.missionExtra && !extra;
    p.missionExtra = false;
    // 移動動物園：今を生きる＝1ゲーム1回の追加ターン。前哨地/使節団が先に発動したら**旗は消さず**次のターンへ持ち越す
    //   （公式：今を生きるは「直前が他プレイヤーのターンか」を見ない＝3連続ターンも認められている）。
    //   このターンは同点時のタイブレーク（ターン数）に数えない＝freshTurn に seizeTurn を立てる。
    const seizeExtra = !!p.seizeExtra && !extra && !missionExtra;
    if (seizeExtra) p.seizeExtra = false;
    // 冒険：-1カードトークン（遺物）は draw() 内で「次のドロー」に効く（この先引きが次のドローなら1枚減）。
    //   冒険：探検（Expedition）＝このターンに買ったぶんだけ追加で引く（累積・前哨地の3枚にも加算）。
    //   ルネサンス：旗（Flag・アーティファクト）＝**手札を引くとき +1カード**（＝この片付けの先引きと前哨地の3枚引き）。
    //     学者/手先/寄付のような「引く」効果には効かない（手札そのものを引く場面のみ＝公式）。
    //     先引きの瞬間の保持者に適用する（その後に旗が奪われても引いた枚数は返さない）。
    const flagBonus = hasArtifact(state, pi, 'flag') ? 1 : 0;
    draw(state, pi, (extra ? 3 : 5) + (state.turn.extraDraw || 0) + flagBonus);
    // 冒険：保存（Save）＝脇に置いた1枚を「次の手札を引いた後」に手札へ加える（＝この片付けの中で戻す）。
    if (state.turn.savedCard) {
      const sv = state.turn.savedCard;
      if (removeOne(p.setAside, sv)) { p.hand.push(sv); log(state, `${p.name} は保存で脇に置いた1枚を手札に加えた。`); }
    }
    // 移動動物園：リスの習性＝「このターンの終了時に +2カード」＝**次の手札を引いた後**に追加で引く。
    if (state.turn.squirrelDraw) {
      const got = draw(state, pi, state.turn.squirrelDraw);
      if (got.length) log(state, `${p.name} はリスの習性で +${got.length}カード（ターンの終了時）。`);
    }
    /* 夜想曲：川の恵み＝「このターンの終了時、+1カード」＝**次の手札を先引きした後**に引く
       （§0-25 のリス／§0-21 の保存 と同じ位置。角笛は逆に先引きの前）。
       聖なる木立ちで**他のプレイヤーも持ち得る**（公式：あなたと同時に引く）ので全員ぶん見る。
       引き終えたら、前に置かれている祝福（田畑/森/川）を全員ぶん祝福の捨て札へ戻す＝「クリンナップまで持つ」の終わり。 */
    state.players.forEach((pl, idx) => {
      const n = pl.riverDraws || 0;
      pl.riverDraws = 0;
      for (let i = 0; i < n; i++) {
        const got = draw(state, idx, 1);
        if (got.length) log(state, `${pl.name} は川の恵みで +1カード（ターンの終了時）。`);
      }
    });
    /* 夜想曲：忠犬＝「このターンの終了時に手札へ」＝**先引きの後**（角笛は逆に先引きの前なので取り違えない）。
       相手のターンに捨てた忠犬も**そのターンの終了時**に戻る＝全プレイヤーぶん回収する。 */
    state.players.forEach((pl, idx) => {
      let n = pl.houndsAside || 0;
      while (n-- > 0) {
        if (removeOne(pl.setAside || [], 'faithful_hound')) { pl.hand.push('faithful_hound'); log(state, `${pl.name} は忠犬を手札に戻した（ターンの終了時）。`); }
      }
      pl.houndsAside = 0;
    });
    state.players.forEach((pl) => {
      while ((pl.boonsInFront || []).length) {
        const b = pl.boonsInFront.shift();
        // 聖なる木立ちで複数人が同じ祝福を前に置いていることがある＝**祝福デッキに二重に戻さない**。
        if (state.boons && state.boons.discard.indexOf(b) < 0 && state.boons.deck.indexOf(b) < 0) state.boons.discard.push(b);
      }
    });
    /* 同盟：島民（Island Folk）＝**あなたのターンの終了時**、好意5を使って追加のターンを行ってよい
       （2023年12月の第2刷で「直前が自分のターンでなければ」→「**ただし3ターン連続にはできない**」に変更。
        日本語版カードは旧文面だが本アプリは現行を採用する）。
       公式「**次の手札を見てから決めてよい**」＝このエンジンの「片付けで次の手札を先引きする」構造では
       **先引きの後**に窓を開くのが正しい（§0-25 のリス／§0-21 の保存と同じ位置）。
       前哨地/使節団/今を生きる が既に立っているときは offer しない（それらが優先＝3連続を作らない）。 */
    if (hasAlly(state, 'island_folk') && (p.favors || 0) >= 5 && !extra && !missionExtra && !seizeExtra &&
        (state.turn.chain || 1) < 2 && !state.turn.islandAsked && !isGameOver(state)) {
      state.turn.islandAsked = true;
      state.turn.advanceCtx = { pi, extra, missionExtra, seizeExtra };
      state.pending = { type: 'ally_island_folk', player: pi };
      return;
    }
    finishTurnAdvance(state, pi, extra, missionExtra, seizeExtra, false);
  }
  /* 片付けの最後（手番数の加算 → 艦隊 → 次の手番の決定）。同盟：島民の窓を挟むために cleanupAndAdvance から切り出した。
     islandExtra＝島民で好意5を払った（＝この人がもう1ターン行う。**同点時のタイブレークには数えない**）。 */
  function finishTurnAdvance(state, pi, extra, missionExtra, seizeExtra, islandExtra) {
    const p = state.players[pi];
    p.turns += 1;
    // 移動動物園：今を生きる／同盟：島民 の追加ターンは同点時のタイブレーク（ターン数の少なさ）に数えない（公式）。
    if (state.turn.seizeTurn) p.freeTurns = (p.freeTurns || 0) + 1;

    /* ルネサンス：艦隊（Fleet・プロジェクト）＝**ゲームの終了後**、艦隊を持つプレイヤーは全員、追加の1ターンを得る。
       - 追加ラウンドは通常の手番順で**1周だけ**（艦隊を持たない人は飛ばす）。開始席＝ゲームを終わらせた
         プレイヤーの**次**から（＝終わらせた本人が艦隊を持っていれば最後になる）。
       - **最後の艦隊ターンの後は他の追加ターン（前哨地/使節団）は一切発生しない**（公式）。
       - 艦隊ターン後に終了条件が満たされなくなってもゲームは終了する（公式）。 */
    const n = state.players.length;
    if (isGameOver(state) || state.fleetQueue != null) {
      if (state.fleetQueue == null) {
        const q = [];
        for (let k = 1; k <= n; k++) {
          const seat = (pi + k) % n;
          if (hasMyProject(state, seat, 'fleet')) q.push(seat);
        }
        state.fleetQueue = q;
        if (q.length) log(state, `ゲームの終了条件を満たした。艦隊を持つプレイヤーが追加の1ターンを行う。`);
      }
      if (state.fleetQueue.length) {
        const next = state.fleetQueue.shift();
        state.turn = freshTurn(next, true, { rotationSeat: next });
        if (hasArtifact(state, next, 'key')) { addCoins(state, 1); log(state, `${state.players[next].name} は鍵で +1コイン（ターン開始時）。`); }
        log(state, `${state.players[next].name} の艦隊による追加ターンです。`);
        resolveDurationStartEffects(state, next);
        return;
      }
      state.gameOver = true;
      state.result = scoreGame(state);
      log(state, `ゲーム終了：${state.result.reason}。`);
      return;
    }
    // 次の手番を決める：1)前哨地=同一プレイヤー 2)支配などの追加ターン待ち行列 3)通常=rotationSeatの次。
    const anchor = state.turn.rotationSeat != null ? state.turn.rotationSeat : pi;
    const prevChain = state.turn.chain || 1;
    let next, isExtra = false, possessedBy = null, rotationSeat, noBuyCards = false, seizeTurn = false, islandTurn = false;
    if (extra) {
      next = pi; isExtra = true; rotationSeat = anchor;
    } else if (missionExtra) {
      next = pi; isExtra = true; rotationSeat = anchor; noBuyCards = true; // 冒険：使節団の追加ターン（カード購入不可・イベントは可）
    } else if (seizeExtra) {
      next = pi; isExtra = true; rotationSeat = anchor; seizeTurn = true;  // 移動動物園：今を生きるの追加ターン（通常のターンと同じ）
    } else if (islandExtra) {
      next = pi; isExtra = true; rotationSeat = anchor; seizeTurn = true; islandTurn = true; // 同盟：島民（タイブレークに数えない）
    } else if (state.extraTurns && state.extraTurns.length) {
      const et = state.extraTurns.shift();
      next = et.seat; isExtra = true; possessedBy = et.possessedBy; rotationSeat = et.rotationSeat;
    } else {
      next = (anchor + 1) % n; rotationSeat = next;
    }
    // 同盟：島民の「3ターン連続にはできない」を数えるための連続手番カウンタ（同じ席が続いた回数。1=通常のターン）。
    const chain = (isExtra && next === pi) ? prevChain + 1 : 1;
    state.turn = freshTurn(next, isExtra, { rotationSeat, possessedBy, noBuyCards, seizeTurn, chain });
    // ルネサンス：鍵（Key・アーティファクト）＝あなたのターンの開始時 +$1（取ったターンには恩恵なし＝開始時は過ぎている）。
    if (hasArtifact(state, next, 'key')) {
      addCoins(state, 1);
      log(state, `${state.players[next].name} は鍵で +1コイン（ターン開始時）。`);
    }
    log(state, possessedBy != null
      ? `${state.players[possessedBy].name} が ${state.players[next].name} の追加ターンを操作します（支配）。`
      : (extra ? `${state.players[next].name} の追加ターンです（前哨地）。`
        : (missionExtra ? `${state.players[next].name} の追加ターンです（使節団：カードは購入できません）。`
          : (islandTurn ? `${state.players[next].name} の追加ターンです（島民）。`
            : (seizeTurn ? `${state.players[next].name} の追加ターンです（今を生きる）。`
              : `${state.players[next].name} の番です。`)))));
    // 海辺：次の手番開始時の予約効果を解決（非対話は即適用、対話は startQueue→pending）。
    resolveDurationStartEffects(state, next);
  }

  // 購入フェイズ終了の後処理（隠遁者交換→策謀のクリンナップ→片付け）。冒険：ワイン商の呼び出し窓を挟んでから呼ぶ。
  // 帝国：闘技場＝購入フェイズ開始時、手札のアクション1枚を捨ててよい（捨てたら +2勝利点）。1ターン1回だけ判定する
  //   （villa等でアクションフェイズに戻り再び購入フェイズに入っても再発火しない＝許容簡略化）。
  /* ========== 帝国：横型イベント（買う横型・BUY_EVENT で発火） ==========
     applyEventEffect(state, pi, id)＝購入したイベントの効果を適用する本体。
     一部は選択待ち（pending）を立てる＝4点セット（reducer＋PLAYER_ACTIONS＋CPU＋UI）必須。
     イベントは「カード」ではないので、コスト軽減（橋/街道）を受けず、購入時トリガー
     （商人ギルド/値切り屋/過払い）も発動しない（BUY_EVENT 側で呼ばない）。 */
  function anyVictorySupply(state) {
    return Object.keys(state.supply).some((id) => (state.supply[id] || 0) > 0 && isTypeSupply(state, id, 'victory'));
  }
  // 冒険：1ターンに1回しか買えないイベント（施し/借入/保存/巡礼）＝2回目の購入は engine が拒否する
  //   （公式ルールブック "You can only buy this once per turn."＝購入自体ができない＝購入権を無駄にしない）。
  //   移動動物園：絶望（desperation）も同じ "Once per turn:" 前置句を持つ＝同じ枠に載せる。
  //   （※一次資料の扱い：施し/保存/借入/巡礼は公式FAQに "You can only buy this once per turn." が明記されているが、
  //     絶望の個別FAQには同文が無い。カード文が完全に同一テンプレートなので同じ解釈を採用した。
  //     反対解釈＝「買えるが2回目は空振り」でも購入権1つを無駄にするだけの差＝どちらでも致命的な差は出ない。）
  //   ※**使節団（mission）は現行エラッタで前置句が消えている**＝1ターンに複数回買える（2枚目以降は空振り
  //     ＝`me.missionExtra` が既に true なので何も起きない）。ここに入れてはいけない。
  const ONCE_PER_TURN_EVENTS = new Set(['alms', 'borrow', 'save', 'pilgrimage', 'desperation']);
  // 相続は1ゲーム1回（既に脇置きを持っていれば買えない）。移動動物園：今を生きる（seize_the_day）も1ゲーム1回。
  function canBuyEvent(state, pi, id) {
    const t = state.turn, p = state.players[pi];
    if (ONCE_PER_TURN_EVENTS.has(id) && (t.eventsBought || []).indexOf(id) >= 0) return false;
    if (id === 'inheritance' && (p.inherited || []).length > 0) return false;
    if (id === 'seize_the_day' && p.seizedTheDay) return false;
    return true;
  }
  function applyEventEffect(state, pi, id) {
    const me = state.players[pi];
    const t = state.turn;
    switch (id) {
      case 'delve': { t.buys += 1; gain(state, pi, 'silver', 'discard'); break; }
      case 'wedding': { me.vpTokens = (me.vpTokens || 0) + 1; log(state, `${me.name} は結婚式で +1勝利点。`); gain(state, pi, 'gold', 'discard'); break; }
      case 'dominate': {
        if (gain(state, pi, 'province', 'discard')) { me.vpTokens = (me.vpTokens || 0) + 9; log(state, `${me.name} は制圧で +9勝利点。`); }
        break;
      }
      case 'windfall': {
        if (me.deck.length === 0 && me.discard.length === 0) {
          for (let k = 0; k < 3; k++) gain(state, pi, 'gold', 'discard');
          log(state, `${me.name} は意外な授かり物で金貨3枚を獲得した。`);
        }
        break;
      }
      case 'conquest': {
        gain(state, pi, 'silver', 'discard'); gain(state, pi, 'silver', 'discard');
        const silvers = (t.gainedThisTurn || []).filter((c) => c === 'silver').length;
        if (silvers > 0) { me.vpTokens = (me.vpTokens || 0) + silvers; log(state, `${me.name} は征服で +${silvers}勝利点（今ターン獲得の銀貨${silvers}枚）。`); }
        break;
      }
      case 'triumph': {
        if (gain(state, pi, 'estate', 'discard')) {
          const n = (t.gainedThisTurn || []).length;
          me.vpTokens = (me.vpTokens || 0) + n; log(state, `${me.name} は凱旋で +${n}勝利点（今ターン獲得${n}枚）。`);
        }
        break;
      }
      case 'salt_the_earth': {
        me.vpTokens = (me.vpTokens || 0) + 1; log(state, `${me.name} は塩まきで +1勝利点。`);
        if (anyVictorySupply(state)) state.pending = { type: 'salt_the_earth', player: pi };
        break;
      }
      case 'banquet': {
        gain(state, pi, 'copper', 'discard'); gain(state, pi, 'copper', 'discard');
        if (anyGainable(state, (cid) => banquetCanGain(state, cid) && !splitLocked(state, cid))) state.pending = { type: 'banquet', player: pi };
        break;
      }
      case 'advance': {
        if (me.hand.some((c) => DOM.isType(c, 'action'))) state.pending = { type: 'advance', stage: 'trash', player: pi };
        break;
      }
      case 'ritual': {
        if (gain(state, pi, 'curse', 'discard') && me.hand.length > 0) state.pending = { type: 'ritual', player: pi };
        break;
      }
      // 帝国：徴税＝サプライの山1つに負債トークンを2個置く（強制。準備で全山に1個ずつ・購入フェイズの獲得で受け取る）。
      case 'tax': {
        // 対象山があるうちは選択必須。全山が空という事はまず無いが、候補ゼロなら何もしない。
        if (Object.keys(state.supply).some((sid) => !NON_SUPPLY.has(sid) && (state.supply[sid] || 0) > 0)) {
          state.pending = { type: 'tax_pile', player: pi };
        }
        break;
      }
      // 帝国：寄付＝次の自分のターン開始時（他の開始時効果より前）にデッキ＋捨て札を全部手札に集め、任意枚数廃棄→残りをシャッフルして5枚引く。
      case 'donate': {
        me.donateNext = true;
        log(state, `${me.name} は寄付を購入した（次の自分のターン開始時にデッキを掃討する）。`);
        break;
      }
      // 帝国：併合＝捨て札から最大5枚を選んで捨て札に残し、残りを山札に混ぜてシャッフル。その後、公領1枚を獲得。
      case 'annex': {
        if (me.discard.length > 0) state.pending = { type: 'annex_keep', player: pi };
        else gain(state, pi, 'duchy', 'discard'); // 捨て札が空でも公領は獲得する
        break;
      }
      /* ========== 冒険（Adventures）イベント 20種 ==========
         負債は無し（コインのみ）。トークン中心＝旅トークン(journeyDown)／-1カード(minusCard)／
         -$1(minusCoin)／山トークン(pileTokens) を再利用する。
         1ターン1回のイベント（施し/借入/保存/巡礼）は BUY_EVENT 側で2回目の購入を拒否する。 */
      // 施し＝場に財宝が1枚も無いなら、コスト$4以下のカード1枚を獲得（強制・条件を満たさなければ何も起きない）。
      case 'alms': {
        if (me.inPlay.some((c) => isTreasureFor(state, c))) { log(state, `${me.name} は施しを買ったが、場に財宝があるので何も獲得できない。`); break; }
        if (anyGainable(state, (cid) => upToCanGain(state, cid, 4))) state.pending = { type: 'alms_gain', player: pi };
        break;
      }
      // 借入＝+1購入。-1カードトークンを持っていなければ、それを受け取って +$1。
      case 'borrow': {
        t.buys += 1;
        if (!me.minusCard) {
          me.minusCard = true;
          addCoins(state, 1); applyCoinPenalty(state);
          log(state, `${me.name} は借入で -1カードトークンを受け取り +$1。`);
        }
        break;
      }
      // 探索＝アタック1枚／呪い2枚／任意6枚 のどれかを捨ててよい。捨てられたなら金貨1枚。
      case 'quest': {
        if (me.hand.length > 0) state.pending = { type: 'quest', stage: 'mode', player: pi };
        break;
      }
      // 保存＝+1購入。手札1枚を脇に置き、このターンの終了時（次の手札を引いた後）に手札へ加える。
      case 'save': {
        t.buys += 1;
        if (me.hand.length > 0 && !t.savedCard) state.pending = { type: 'save', player: pi };
        break;
      }
      // 偵察隊＝+1購入。山札の上5枚を見て3枚捨て、残りを好きな順で山札の上に戻す。
      case 'scouting_party': {
        t.buys += 1;
        const look = [];
        for (let i = 0; i < 5; i++) {
          if (me.deck.length === 0) { if (me.discard.length === 0) break; reshuffleDeck(me); }
          look.push(me.deck.shift());
        }
        if (look.length === 0) break;
        if (look.length <= 3) { // 3枚以下なら全部捨てる（戻すカードは無い）
          look.forEach((c) => me.discard.push(c));
          log(state, `${me.name} は偵察隊で ${look.length}枚 を捨て札にした。`);
          triggerOnDiscard(state, pi, look);
          break;
        }
        state.pending = { type: 'scouting_party', stage: 'discard', player: pi, cards: look };
        break;
      }
      // 移動遊園地＝+2購入。このターン、獲得したカードを山札の上に置いてよい（獲得のたびに任意）。
      case 'travelling_fair': { t.buys += 2; t.travellingFair = true; break; }
      // 焚火＝場にある銅貨を2枚まで廃棄（2022エラッタ＝銅貨限定）。
      case 'bonfire': {
        if (me.inPlay.includes('copper')) state.pending = { type: 'bonfire', player: pi };
        break;
      }
      // 探検＝次の手札を引くとき、追加で2枚引く（同一ターンに複数回買えば累積）。
      case 'expedition': { t.extraDraw = (t.extraDraw || 0) + 2; break; }
      // 渡し船＝-$2コストトークンをアクションのサプライ山1つへ移す。
      case 'ferry': {
        if (actionSupplyPiles(state).length) state.pending = { type: 'event_token', token: 'cost', player: pi };
        break;
      }
      // 立案＝廃棄トークンをアクションのサプライ山1つへ移す。
      case 'plan': {
        if (actionSupplyPiles(state).length) state.pending = { type: 'event_token', token: 'trash', player: pi };
        break;
      }
      // 使節団＝このターンの後に追加ターン（3連続は不可＝今が追加ターンなら得られない）。追加ターン中はカードを購入できない。
      case 'mission': {
        if (t.isExtraTurn) { log(state, `${me.name} は使節団を買ったが、このターンは追加ターンなので追加ターンは得られない。`); break; }
        if (me.missionExtra) break; // 既に予約済み（同一ターンに複数回買っても追加ターンは1回）
        me.missionExtra = true;
        log(state, `${me.name} は使節団で追加ターンを得る（そのターンはカードを購入できない）。`);
        break;
      }
      // 巡礼＝旅トークンを裏返す。表向きになったら、場にある名前の異なるカードを3枚まで選びコピーを獲得。
      case 'pilgrimage': {
        me.journeyDown = !me.journeyDown;
        if (me.journeyDown) { log(state, `${me.name} は巡礼で旅トークンを裏にした（効果なし）。`); break; }
        log(state, `${me.name} は巡礼で旅トークンを表にした。`);
        if (pilgrimageChoices(state, pi).length) state.pending = { type: 'pilgrimage', player: pi };
        break;
      }
      // 舞踏会＝-$1トークンを受け取り、コスト$4以下のカードを2枚獲得。
      case 'ball': {
        if (!me.minusCoin) { me.minusCoin = true; log(state, `${me.name} は舞踏会で -$1トークンを受け取った。`); }
        if (anyGainable(state, (cid) => upToCanGain(state, cid, 4))) state.pending = { type: 'ball_gain', player: pi, left: 2 };
        break;
      }
      // 奇襲＝場の銀貨1枚につき銀貨1枚を獲得。他の各プレイヤーは -1カードトークンを受け取る（アタックではない＝堀不可）。
      case 'raid': {
        const silvers = me.inPlay.filter((c) => c === 'silver').length;
        let g = 0; for (let i = 0; i < silvers; i++) if (gain(state, pi, 'silver', 'discard')) g++;
        if (g) log(state, `${me.name} は奇襲で銀貨 ${g}枚 を獲得した（場の銀貨${silvers}枚）。`);
        for (let o = 0; o < state.players.length; o++) {
          if (o === pi) continue;
          const op = state.players[o];
          if (!op.minusCard) { op.minusCard = true; log(state, `${op.name} は -1カードトークンを受け取った（奇襲）。`); }
        }
        break;
      }
      // 海路＝コスト$4以下のアクション1枚を獲得し、その山に +1購入トークンを移す（獲得できなければ何も起きない）。
      case 'seaway': {
        if (anyGainable(state, (cid) => seawayCanGain(state, cid))) state.pending = { type: 'seaway', player: pi };
        break;
      }
      // 交易＝手札を2枚まで廃棄し、廃棄した枚数だけ銀貨を獲得。
      case 'trade': {
        if (me.hand.length > 0) state.pending = { type: 'trade', player: pi };
        break;
      }
      // 失われた技術／鍛錬／誘導＝+1アクション／+$1／+1カードトークンをアクションのサプライ山1つへ移す。
      case 'lost_arts': case 'training': case 'pathfinding': {
        const tok = id === 'lost_arts' ? 'action' : (id === 'training' ? 'coin' : 'card');
        if (actionSupplyPiles(state).length) state.pending = { type: 'event_token', token: tok, player: pi };
        break;
      }
      // 相続＝1ゲーム1回。サプライから 命令でないコスト$4以下のアクション1枚を脇に置き、屋敷トークンを載せる。
      case 'inheritance': {
        if (inheritanceTargets(state).length) state.pending = { type: 'inheritance', player: pi };
        break;
      }
      /* ========== 移動動物園（Menagerie）イベント 20種 ==========
         負債コストは無い（すべてコインのみ）。基盤（BUY_EVENT／canBuyEvent／treasuresLocked／buysMade）は
         帝国・冒険と完全に共通で、Menagerie 固有の新しい購入ルールは無い（公式ルールブック）。
         主な機構＝追放（Exile）／馬（Horse・非サプライ30枚）／「アクション権を消費しないカードの使用」／
         脇に置いて次のターン開始時に使用（p.eventSetAside）。 */
      // 同盟（$10）＝属州・公領・屋敷・金貨・銀貨・銅貨を各1枚 獲得する。
      //   強制・記載順に1枚ずつ（望楼などで山札の上に置くと 銅貨が一番上になる）。空の山は飛ばすだけ。
      case 'alliance': {
        ['province', 'duchy', 'estate', 'gold', 'silver', 'copper'].forEach((cid) => gain(state, pi, cid, 'discard'));
        log(state, `${me.name} は同盟で 属州/公領/屋敷/金貨/銀貨/銅貨 を獲得した（サプライにあるもの）。`);
        break;
      }
      // 乗馬（$2）＝馬1枚を獲得する。
      case 'ride': { if (gainHorse(state, pi)) log(state, `${me.name} は乗馬で馬1枚を獲得した。`); break; }
      // 商売（$5）＝このターンに獲得したカードの「異なる名前」1種類につき金貨1枚を獲得する。
      //   **先に数えてからまとめて獲得する**（獲得した金貨で増えた分は数えない＝公式FAQ）。
      case 'commerce': {
        const names = [];
        (t.gainedThisTurn || []).forEach((c) => { if (names.indexOf(c) < 0) names.push(c); });
        let cg = 0;
        for (let i = 0; i < names.length; i++) if (gain(state, pi, 'gold', 'discard')) cg++;
        log(state, `${me.name} は商売で金貨 ${cg}枚 を獲得した（今ターン獲得の異なる名前 ${names.length}種）。`);
        break;
      }
      // 包領（$8）＝金貨1枚を獲得し、サプライから公領1枚を追放する（独立した2処理・どちらも強制）。
      //   サプライからの追放は「獲得」ではない＝獲得時能力は誘発しないが、公領の山は1枚減る（3山終了に影響）。
      case 'enclave': {
        gain(state, pi, 'gold', 'discard');
        exileFromSupply(state, pi, 'duchy');
        break;
      }
      // 特価品（$4）＝コスト$5以下の勝利点でないカード1枚を獲得（強制）。その後、他の各プレイヤーが馬1枚を獲得する。
      //   アタックではない（堀・灯台で防げない）。馬は購入者の左隣から手番順（山が足りなければ先着）。
      case 'bargain': {
        if (anyGainable(state, (cid) => bargainCanGain(state, cid))) state.pending = { type: 'bargain_gain', player: pi };
        else bargainHorses(state, pi);
        break;
      }
      // 要求（$5）＝馬1枚とコスト$4以下のカード1枚を獲得し、2枚とも山札の上に置く（強制）。
      //   **馬が先**＝$4以下のカードが一番上になる。馬を先に獲得するのでデストリエ（獲得枚数でコストが下がる）の
      //   コストは馬の獲得を反映した後で判定する（公式）。
      case 'demand': {
        if (gainHorse(state, pi, 'deck')) log(state, `${me.name} は要求で馬1枚を山札の上に獲得した。`);
        if (anyGainable(state, (cid) => upToCanGain(state, cid, 4))) {
          // 馬の獲得が獲得時リアクション（望楼/ティアラ/交易商人）の窓を開いていることがある。
          //   そこへ直接 pending を代入すると**その窓を握りつぶす**ので、開いていればキューに積む。
          const pdDemand = { type: 'demand_gain', player: pi };
          if (state.pending) (state.onGainQueue = state.onGainQueue || []).push(pdDemand);
          else state.pending = pdDemand;
        }
        break;
      }
      // 絶望（$0）＝呪い1枚を獲得してもよい。獲得したなら +1購入 +$2（呪いが無くて獲得できなければ何も得ない）。
      //   "Once per turn:" ＝ canBuyEvent の「1ターン1回」枠（2回目の購入自体を拒否＝購入権を無駄にしない）。
      case 'desperation': {
        if ((state.supply.curse || 0) > 0) state.pending = { type: 'desperation', player: pi };
        break;
      }
      // 今を生きる（$4）＝1ゲーム1回。このターンの後に追加のターンを1回行う。
      //   前哨地/使節団と違い「直前が他プレイヤーのターンか」を見ない＝3連続ターンもあり得る（公式）。
      //   終了条件のチェックは追加ターンより前に行う（cleanupAndAdvance が isGameOver を先に見る）＝終局なら追加ターンは無い。
      //   この追加ターンは同点時のタイブレーク（ターン数）に数えない（p.freeTurns）。
      case 'seize_the_day': {
        me.seizedTheDay = true;
        me.seizeExtra = true;
        log(state, `${me.name} は今を生きるで追加ターンを得る（1ゲーム1回）。`);
        break;
      }
      // 暴走（$5）＝場にある自分のカードが5枚以下なら、馬5枚を獲得して山札の上に置く。
      //   判定は「購入した時点で場にある枚数」（このターンに何枚プレイしたかではない）。持続カードも場のカードに数える。
      case 'stampede': {
        const inPlayN = me.inPlay.length + (me.durationCards || []).length;
        if (inPlayN <= 5) {
          let sg = 0; for (let i = 0; i < 5; i++) if (gainHorse(state, pi, 'deck')) sg++;
          log(state, `${me.name} は暴走で馬 ${sg}枚 を山札の上に獲得した。`);
        } else log(state, `${me.name} は暴走を買ったが、場のカードが ${inPlayN}枚（6枚以上）なので馬を得られない。`);
        break;
      }
      // 放逐（$4）＝手札から「同じ名前」のカードを好きな枚数 追放する（0枚でもよい／2種類は不可）。
      case 'banish': {
        if (me.hand.length > 0) state.pending = { type: 'banish', stage: 'pick', player: pi };
        break;
      }
      // 投資（$4）＝サプライからアクションカード1枚を追放する。そのカードが追放されている間、
      //   **他の**プレイヤーがその同名を獲得/投資したとき +2カード（強制・累積・相手のターン中に引く）。
      //   投資で追放したコピーだけが対象＝他の手段で追放した同名とは別管理（p.exileInvested）。
      case 'invest': {
        if (anyExilableSupply(state, (cid) => DOM.isType(cid, 'action'))) state.pending = { type: 'invest', player: pi };
        break;
      }
      // 輸送（$3）＝二択。①サプライからアクション1枚を追放する ②追放マットの自分のアクション1枚を山札の上に置く。
      //   ドミニオンの原則どおり**実行できない選択肢も選べる**（engine は拒否せず、何も起きないだけ）。
      case 'transport': { state.pending = { type: 'transport', stage: 'mode', player: pi }; break; }
      // 苦労（$2）＝+1購入。手札からアクションカード1枚を使用してよい（アクション権を消費しない）。
      case 'toil': {
        t.buys += 1;
        if (me.hand.some((c) => DOM.isType(c, 'action') || inheritedEstate(me, c))) state.pending = { type: 'toil', player: pi };
        break;
      }
      // 進軍（$3）＝捨て札置き場を見て、その中のアクションカード1枚を使用してよい（アクション権を消費しない）。
      case 'march': {
        if (me.discard.some((c) => DOM.isType(c, 'action'))) state.pending = { type: 'march', player: pi };
        break;
      }
      // 博打（$2・2025エラッタ）＝+1購入。山札の一番上を**公開せずに**捨て札にし、
      //   それがアクションか財宝なら使用してよい（アクション権を消費しない）。
      //   ・先に捨てるので捨て札トリガー（坑道/村有緑地/忠犬/織工）が誘発する。
      //   ・「公開」ではないのでパトロン等の公開トリガーは誘発しない（そもそも購入フェイズなので元から誘発しない）。
      //   ・使用しない場合はそのまま捨て札に残る。
      case 'gamble': {
        t.buys += 1;
        if (me.deck.length === 0 && me.discard.length > 0) reshuffleDeck(me);
        if (me.deck.length > 0) {
          const top = me.deck.shift();
          me.discard.push(top);
          log(state, `${me.name} は博打で山札の上の「${C()[top].name}」を捨てた。`);
          triggerOnDiscard(state, pi, [top]);
          // 捨て札トリガーが選択待ちを開いていることがあるので、使用の窓はキューに積む（順序も公式どおり後）。
          if (DOM.isType(top, 'action') || isTreasureFor(state, top)) {
            (state.onGainQueue = state.onGainQueue || []).push({ type: 'gamble', player: pi, card: top });
          }
        }
        break;
      }
      // 遅延（$0）＝手札からアクションカード1枚を脇に置いてもよい。次の自分のターン開始時、それを使用する（強制）。
      case 'delay': {
        if (me.hand.some((c) => DOM.isType(c, 'action'))) state.pending = { type: 'delay', player: pi };
        break;
      }
      // 刈り入れ（$7・2025エラッタ）＝金貨1枚を獲得し**そのまま脇に置く**（捨て札置き場を経由しない）。
      //   次の自分のターン開始時、それを使用する。金貨の山が空なら何も起きない。
      case 'reap': {
        if (gain(state, pi, 'gold', 'eventSetAside')) log(state, `${me.name} は刈り入れで金貨1枚を獲得して脇に置いた（次のターン開始時に使用する）。`);
        break;
      }
      // 増大（$3）＝手札から勝利点でないカード1枚を廃棄してもよい。廃棄したら、それより最大$2高いカード1枚を獲得（強制）。
      case 'enhance': {
        if (me.hand.some((c) => !DOM.isType(c, 'victory'))) state.pending = { type: 'enhance', stage: 'trash', player: pi };
        break;
      }
      // 追求（$2）＝+1購入。カード名を1つ指定し、山札の上4枚を公開。指定した名前のカードを山札の上に戻し、残りを捨てる。
      //   名前の指定は公開の**前**に行う（ゲームに無い名前も指定できる）。
      case 'pursue': { t.buys += 1; state.pending = { type: 'pursue', player: pi }; break; }
      // 植民（$10）＝サプライの「アクションの山」それぞれから1枚ずつ獲得する（獲得順はプレイヤーが選ぶ）。
      //   山がアクションの山かは**山の種別**で決まる（今の一番上のカードの種別ではない）＝分割山は上段で判定し、
      //   上段が尽きていれば下段（財宝でも）を獲得する。城の山は勝利点の山なので対象外。廃墟/騎士はアクションの山。
      case 'populate': {
        const piles = populatePiles(state);
        if (piles.length) {
          t.populateQueue = piles;
          t.populatePlayer = pi;
          state.pending = { type: 'populate', player: pi };
        }
        break;
      }
      default: break;
    }
  }
  // 特価品＝コスト$5以下の勝利点でないカード（勝利点と兼ねるカードも不可）。
  function bargainCanGain(state, cid) { return costUpTo(state, cid, 5) && !isTypeSupply(state, cid, 'victory'); }
  // 特価品＝他の各プレイヤーが馬1枚を獲得する（購入者の左隣から手番順）。アタックではない。
  function bargainHorses(state, pi) {
    const n = state.players.length;
    for (let k = 1; k < n; k++) {
      const o = (pi + k) % n;
      if (gainHorse(state, o)) log(state, `${state.players[o].name} は特価品で馬1枚を獲得した。`);
    }
  }
  /* 植民（Populate）＝獲得元になる「アクションのサプライ山」の一覧（山キー）。
     - 山の種別で判定する（分割山は**上段カード**の種別＝上段が尽きていても下段を獲得する）。
     - 混合山：廃墟/騎士はアクションの山（一番上の1枚を獲得）／城は勝利点の山＝対象外。
     - 非サプライ山（馬/賞品/戦利品/トラベラー成長先）は対象外。空の山は対象外。 */
  function populatePiles(state) {
    const out = [];
    Object.keys(state.supply).forEach((id) => {
      if (NON_SUPPLY.has(id)) return;
      if ((state.supply[id] || 0) <= 0) return;
      if (SPLIT_TOP[id]) return;                       // 分割山の下段は独立した山ではない（上段キーで1山）
      if (MIXED_PILE_KEYS.indexOf(id) >= 0) return;    // 混合山は下で扱う
      if (splitLocked(state, id)) return;              // 循環で上下が入れ替わった山の上段は今は取れない
      if (!C()[id] || !DOM.isType(id, 'action')) return;
      out.push(id);
    });
    // 分割山：今 獲得できる側が下段（上段が尽きた／循環で入れ替わった）なら下段キーで数える。種別は上段＝randomizer で判定。
    Object.keys(SPLIT_TOP).forEach((bottom) => {
      const top = SPLIT_TOP[bottom];
      if (!C()[top] || !DOM.isType(top, 'action')) return;
      if (!splitLocked(state, top) && (state.supply[top] || 0) > 0) return; // 上のループで拾っている
      if (!splitLocked(state, bottom) && (state.supply[bottom] || 0) > 0) out.push(bottom);
    });
    /* 混合山：山の**種別**（＝プレースホルダ／randomizer）がアクションの山だけが対象。
       廃墟だけはカタログにプレースホルダを持たない（supply キーも無い）ので明示的に足す。
       騎士＝アクション○／城＝勝利点×／同盟の6山＝randomizer が全部アクション○（叙事詩に勝利点が
       入っていても「勝利点の山」ではない＝公式の Family of Inventors 逐語と同じ考え方）。 */
    if (Array.isArray(state.ruins) && state.ruins.length) out.push('ruins');
    MIXED_PILE_KEYS.forEach((k) => {
      if (k === 'ruins') return;
      if (!Array.isArray(state[k]) || !state[k].length) return;
      if (!C()[k] || !DOM.isType(k, 'action')) return;
      out.push(k);
    });
    return out;
  }
  // コスト$N以下の獲得候補（負債/ポーション費用は除外＝成分ごと比較の公式ルール）。
  function upToCanGain(state, cid, max) { return costUpTo(state, cid, max); }
  function seawayCanGain(state, cid) { return costUpTo(state, cid, 4) && isTypeSupply(state, cid, 'action'); }
  // 巡礼＝場（inPlay＋持続カード）にある名前の異なるカードのうち、サプライから獲得できるもの。
  function pilgrimageChoices(state, pi) {
    const p = state.players[pi];
    const names = [];
    p.inPlay.concat(p.durationCards || []).forEach((c) => { if (names.indexOf(c) < 0) names.push(c); });
    return names.filter((c) => !NON_SUPPLY.has(c) && !splitLocked(state, c) && (state.supply[c] || 0) > 0);
  }
  // 相続の対象＝サプライにある「命令でない・コスト$4以下（負債/ポーション費用なし）のアクション」。
  //   ※持続は除外（屋敷が持続として場に残る追跡が要るため＝船長/大君主と同じ許容簡略化）。
  function inheritanceTargets(state) {
    return Object.keys(state.supply).filter((id) =>
      (state.supply[id] || 0) > 0 && !NON_SUPPLY.has(id) && C()[id] &&
      DOM.isType(id, 'action') && !DOM.isType(id, 'duration') && !DOM.isType(id, 'command') &&
      costIsPlainCoin(id) && cardCost(state, id) <= 4 && !isMixedPileKey(id) && !splitLocked(state, id));
    // ※混合山（騎士/城/同盟の分割山6組）の山キーは**実在する1枚のカードではない**＝脇に置くと
    //   supply だけ減って実カード配列が減らず、カードが1枚湧く（保存則違反）。プレースホルダは常に除外する。
  }
  function banquetCanGain(state, cid) {
    return costUpTo(state, cid, 5) && !isTypeSupply(state, cid, 'victory');
  }
  function advanceCanGain(state, cid) {
    return costUpTo(state, cid, 6) && isTypeSupply(state, cid, 'action');
  }

  function maybeArena(state, pi) {
    const t = state.turn;
    if (t.arenaFired) return;
    t.arenaFired = true;
    if (!hasLandmark(state, 'arena')) return;
    if (((state.landmarkVP && state.landmarkVP.arena) || 0) < 2) return;
    const me = state.players[pi];
    if (!me.hand.some((c) => DOM.isType(c, 'action'))) return;
    state.pending = { type: 'arena', player: pi };
  }
  function endBuyTail(state) {
    const pi = state.turn.active;
    const me = state.players[pi];
    /* ルネサンス：購入フェイズ終了時のプロジェクト。
       - 野外劇（Pageant）＝$1を支払ってもよい（+1財源）。1回の誘発で払えるのは$1だけ。購入権は消費しない。
       - 探査（Exploration）＝その購入フェイズで**カードを1枚も獲得していない**なら +1財源+1村人
         （2022エラッタで「購入していない」→「獲得していない」。イベント/プロジェクトの購入は妨げにならない）。
       ワイン商（冒険）と同時誘発なら解決順は本人が選ぶ（ここでは ワイン商→野外劇→探査 の順に固定）。 */
    if (hasMyProject(state, pi, 'pageant') && !state.turn.pageantDone && (state.turn.coins || 0) >= 1) {
      state.turn.pageantDone = true;
      state.pending = { type: 'pageant', player: pi };
      return;
    }
    endBuyTailExploration(state, pi);
  }
  function endBuyTailExploration(state, pi) {
    const me = state.players[pi];
    if (hasMyProject(state, pi, 'exploration') && (state.turn.bpGained || 0) === 0) {
      me.coffers = (me.coffers || 0) + 1;
      me.villagers = (me.villagers || 0) + 1;
      log(state, `${me.name} は探査で +1財源+1村人（この購入フェイズにカードを獲得しなかった）。`);
    }
    maybeEnterNight(state, pi);
  }
  /* 夜想曲：購入フェイズの**後**に夜フェイズがある（アクション→購入→**夜**→片付け）。
     手札に夜行カードが1枚も無ければ夜フェイズで出来ることが何も無いので、止めずに片付けへ進む
     （公式でも夜フェイズ自体は常に存在するが、何もしないなら通過するだけ）。
     夜フェイズに入ったら END_TURN をもう一度受けて endBuyTailBaths（片付け開始時の効果）へ進む。 */
  function maybeEnterNight(state, pi) {
    const p = state.players[pi];
    const wasNight = state.turn.phase === 'night';
    /* **夜フェイズは常に存在する**（公式）。ここで必ず phase を 'night' にすることで、
       この後に走る「片付け開始時の効果」（増築の格上げ獲得など）が**購入フェイズ扱いにならない**
       ＝公会堂/列柱/汚された神殿/徴税/行商人のコスト が誤発火しない。
       止まる（＝人間/CPU の入力を待つ）のは手札に夜行カードがあるときだけ。 */
    state.turn.phase = 'night';
    if (!wasNight && p.hand.some((c) => DOM.isType(c, 'night'))) {
      log(state, `${p.name} の夜フェイズ。`);
      return;
    }
    endBuyTailBaths(state, pi);
  }
  function endBuyTailBaths(state, pi) {
    const me = state.players[pi];
    // 帝国：浴場（Baths）＝このターンに1枚もカードを獲得せずに手番を終えたら、ここから +2勝利点（1ターン1回）。
    if (hasLandmark(state, 'baths') && (state.turn.gainedThisTurn || []).length === 0) {
      if (takeLandmarkVP(state, pi, 'baths', 2)) log(state, `${me.name} は浴場で +2勝利点（獲得なしで手番終了）。`);
    }
    // 暗黒時代：隠遁者＝購入フェイズ中に1枚も獲得していなければ、場の隠遁者を狂人と交換する。
    if (me.inPlay.includes('hermit') && !state.turn.buyPhaseGained) {
      let ex = 0;
      while (me.inPlay.includes('hermit') && (state.supply.madman || 0) > 0) {
        removeOne(me.inPlay, 'hermit');
        state.supply.hermit = (state.supply.hermit || 0) + 1;
        state.supply.madman -= 1; me.discard.push('madman'); ex++;
      }
      if (ex) log(state, `${me.name} は購入フェイズで何も獲得しなかったので隠遁者 ${ex}枚 を狂人と交換した。`);
    }
    // 帝国：峠＝このターンに最初の属州が獲得されていたら、片付け前に全員の競りを行う（1ゲーム1回）。
    //   競りが立ったら endBuyTailTravellers はその完了後（MOUNTAIN_PASS_BID）から呼ばれる。
    if (startMountainPassBid(state, pi)) return;
    endBuyTailTravellers(state, pi);
  }
  // 峠の競りの後（または不要なとき）＝トラベラー交換窓→策謀→片付け。
  function endBuyTailTravellers(state, pi) {
    // 冒険：トラベラー交換窓＝場のトラベラーを、次の成長先（山が残っていれば）と交換してよい（対話）。
    const travQ = travellerExchangeQueue(state, pi);
    if (travQ.length) { state.pending = { type: 'traveller_exchange', player: pi, queue: travQ }; return; }
    endBuyTailSchemeOrCleanup(state, pi);
  }
  // 帝国：峠（Mountain Pass）＝最初の属州が獲得されたターンの後、全員が1回ずつ最大40負債で競る（獲得者で終わる）。
  //   最高額の入札者が +8勝利点と同額の負債を得る。競りを開始したら true（呼び出し側は return する）。
  function startMountainPassBid(state, pi) {
    if (!hasLandmark(state, 'mountain_pass')) return false;
    if (!state.mountainPassArmed || state.mountainPassDone) return false;
    state.mountainPassDone = true;
    const gainer = state.mountainPassArmed.gainer;
    state.mountainPassArmed = null;
    const n = state.players.length;
    const order = []; for (let k = 1; k <= n; k++) order.push((gainer + k) % n); // 獲得者の左隣から始め、獲得者で終わる
    state.pending = { type: 'mountain_pass_bid', player: order[0], order, idx: 0, bids: {}, highest: 0, highBidder: null };
    log(state, `峠：最初の属州が獲得されたので、各プレイヤーが1回ずつ最大40負債で競りを行う。`);
    return true;
  }
  // 冒険：場にあり「次の成長先の山が残っている」トラベラーの id 列（交換オファーの対象）。
  function travellerExchangeQueue(state, pi) {
    const p = state.players[pi];
    return (p.inPlay || []).filter((c) => TRAVELLER_NEXT[c] && (state.supply[TRAVELLER_NEXT[c]] || 0) > 0);
  }
  // トラベラー交換窓の後（または交換窓が不要なとき）＝策謀のクリンナップ→片付け。
  /* ルネサンス：増築（Improve）＝**クリンナップフェイズの開始時**、このターンに場から捨て札にするアクション
     カード1枚を廃棄してよい。そうしたら、ちょうど$1高いカード1枚を獲得する（廃棄したら獲得は強制）。
     - 対象＝「このターン場から捨て札になるアクション」＝場（inPlay）＋前ターンからの持続（durationCards）のうち、
       **予約が残っていて場に残り続けるもの以外**。増築自身も対象。
     - 場から直接 廃棄置き場へ行く＝「（場から）捨てたとき」の効果は発動しない（トラベラー交換/封土の銀貨 等）。
       「廃棄されたとき」の効果は発動する（城塞は手札に戻る＝廃棄して$5を獲得できる）。 */
  function stayingCounts(state, pi) {
    const p = state.players[pi];
    const cnt = {};
    (p.delayedEffects || []).forEach((e) => { cnt[e.card] = (cnt[e.card] || 0) + 1; });
    if ((p.princes || []).length) cnt.prince = (cnt.prince || 0) + p.princes.length;
    if (p.hirelings) cnt.hireling = (cnt.hireling || 0) + p.hirelings;
    if (p.champions) cnt.champion = (cnt.champion || 0) + p.champions;
    if ((p.archives || []).length) cnt.archive = (cnt.archive || 0) + p.archives.length;
    return cnt;
  }
  function improveTargets(state, pi) {
    const p = state.players[pi];
    const stay = stayingCounts(state, pi);
    const byId = {};
    [].concat(p.inPlay, p.durationCards || []).forEach((c) => { byId[c] = (byId[c] || 0) + 1; });
    return Object.keys(byId).filter((id) => DOM.isType(id, 'action') && (byId[id] - (stay[id] || 0)) > 0);
  }
  function endBuyTailSchemeOrCleanup(state, pi) {
    const me = state.players[pi];
    // ルネサンス：増築（クリンナップ開始時の廃棄→ちょうど+$1の獲得）。場の増築1枚につき1回。
    if (state.turn.improveLeft == null) state.turn.improveLeft = state.turn.improvePlays || 0;
    if (state.turn.improveLeft > 0 && improveTargets(state, pi).length) {
      state.pending = { type: 'improve', stage: 'trash', player: pi };
      return;
    }
    // 異郷：策謀＝クリンナップ開始時、場のアクション（非持続）を最大(このターンの策謀の数)枚 山札の上に置ける。
    const schemes = state.turn.schemes || 0;
    if (schemes > 0 && me.inPlay.some((c) => DOM.isType(c, 'action') && !DOM.isType(c, 'duration'))) {
      state.pending = { type: 'scheme_cleanup', player: pi, max: schemes };
      return;
    }
    /* 【重要】増築の廃棄/獲得が誘発した対話（技術革新／下水道／貨物船／ドゥカート＝onGain/onTrashQueue）は、
       **片付け（手札を捨てる・次の手札を先引きする・手番を渡す）より前**に解決しなければならない。
       キューが残っているうちは片付けを保留し、reduce 末尾のキュー消化に譲る（storytellerResume と同型の再入）。
       これを怠ると「相手の手番中に技術革新でアクションを使う」「先引きした次の手札を下水道で廃棄する」等が起きる。 */
    if ((state.onGainQueue && state.onGainQueue.length) || (state.onTrashQueue && state.onTrashQueue.length)) {
      state.turn.cleanupWaiting = pi;
      return;
    }
    state.turn.cleanupWaiting = null;
    /* 同盟：沿岸の避難港（Coastal Haven）＝**クリンナップで手札を捨てるとき**、好きな数の好意を使って
       同じ枚数を手札に残せる（残した札は捨てられない＝捨て札トリガーも起きない。引く枚数は変わらない）。
       ⚠ **クリンナップの通常の手札捨てだけ**（戦術家/Sailor 等の「手札を捨てる」には使えない＝公式）。
       本エンジンは片付けで次の手札を先引きするので、**捨てる直前**（＝ここ）に窓を開く。 */
    if (hasAlly(state, 'coastal_haven') && (me.favors || 0) >= 1 && me.hand.length > 0 && !state.turn.coastalDone) {
      state.turn.coastalDone = true;
      state.pending = { type: 'ally_coastal_haven', player: pi };
      return;
    }
    cleanupAndAdvance(state);
  }

  /* ============================================================
     reduce: 状態 + 操作 -> 新しい状態
     ============================================================ */
  function reduce(state, action) {
    state = clone(state);
    state = applyAction(state, action);
    // 冒険：語り部＝中断していた財宝プレイ→コイン変換を、玉座/王の宮廷の再演(runReplays)より先に完了させる。
    //   （順次玉座の意味論＝1回目の語り部が基本+1カード＋コイン変換まで完全に解決してから2回目が始まる。
    //    ここで解決しないと、割り込み財宝の解決後に runReplays が2回目を先に立て、1回目の基本ドローが失われる。）
    if (!state.pending && !state.gameOver && state.turn && state.turn.storytellerResume) {
      storytellerStep(state, state.turn.storytellerResume.player);
    }
    /* 同盟：「カードを使用した後」に働く Ally（魔女の輪／小売店主連盟／写本士の仲間たち）を
       **そのプレイが完全に解決してから**1件ずつ処理する。runReplays（玉座の2回目）より前に置くのは、
       「1回目のプレイの誘発 → 2回目のプレイ → その誘発」という公式の逐次順に合わせるため
       （小売店主連盟×玉座の間＝好意3個からだと +$1 になる＝公式FAQと一致する）。 */
    drainAllyPlayed(state);
    state = runReplays(state);
    drainAllyPlayed(state); // 再演で新たに積まれたぶん
    // 開始時キューの安全網：選択待ちが無いのに startQueue に項目が残っていたら次を進める。
    // （王子/船長がターン開始時にアタック等を使うと、そのアタック連鎖の終端は pending=null で
    //   閉じるだけで popStartQueue を呼ばない＝後続の開始時効果が取り残されるのを防ぐ。
    //   通常時は startQueue が null/空なので何もしない。）
    if (!state.pending && !state.gameOver && state.turn && state.turn.startQueue && state.turn.startQueue.length) {
      popStartQueue(state);
      state = runReplays(state); // 念のため（開始時効果が replay を積むことは無いが無害）
    }
    /* 夜想曲：祝福(Boon)を1件ずつ解決する再開網。**1つの効果で複数の祝福を順に受ける**（ドルイド／愚者3枚／
       恵みの村／ピクシー2回／聖なる木立ちの共有）ので、pending を直接代入せず boonQueue に積んである。
       自動で終わる祝福（海/山/沼/川）は選択待ちを立てないので **while で続けて消化する**
       （1件ずつ止めると、誰も操作しないまま残りの祝福が宙に浮く）。 */
    if (!state.pending && !state.gameOver && state.boonQueue && state.boonQueue.length) {
      let bguard = 0;
      while (!state.pending && state.boonQueue.length && bguard++ < 40) applyBoonEntry(state, state.boonQueue.shift());
      state = runReplays(state);
    }
    /* 夜想曲：呪詛(Hex)を被害者へ順に適用する再開網（同じ1枚を手番順に適用し、全員終わったら捨て札へ）。 */
    if (!state.pending && !state.gameOver && state.turn && (state.turn.hexQueue || state.turn.currentHex)) {
      runHexQueue(state);
      state = runReplays(state);
    }
    /* 夜想曲：吸血鬼＝呪詛の配布が終わってから「コスト5以下（吸血鬼以外）を1枚獲得 → これをコウモリと交換」。 */
    if (!state.pending && !state.gameOver && state.turn && (state.turn.vampireAfterHex || []).length &&
        !state.turn.hexQueue && !(state.hexSelfQueue && state.hexSelfQueue.length)) {
      const seat = state.turn.vampireAfterHex.shift();
      if (anyGainable(state, (id) => costUpTo(state, id, 5) && id !== 'vampire')) {
        state.pending = { type: 'vampire_gain', player: seat };
      } else {
        // 獲得できるものが無くても交換は行う（獲得と交換は独立した指示）。
        exchangeCard(state, seat, 'vampire', 'bat', state.players[seat].inPlay);
      }
      state = runReplays(state);
    }
    /* 夜想曲：呪詛の配布中に「自分が呪詛を受ける」が起きたぶん（呪われた村を蝗害で獲得した等）を後から解決する。 */
    if (!state.pending && !state.gameOver && state.turn && !state.turn.currentHex &&
        state.hexSelfQueue && state.hexSelfQueue.length) {
      receiveHex(state, state.hexSelfQueue.shift());
      state = runReplays(state);
    }
    /* 夜想曲：愚者＝取った祝福3枚を**好きな順番で**受ける（1つ解決してから次を選ぶ＝公式）。 */
    if (!state.pending && !state.gameOver && state.turn && state.turn.boonChoice &&
        (state.turn.boonChoice.boons || []).length && !(state.boonQueue || []).length) {
      state.pending = { type: 'boon_choose', player: state.turn.boonChoice.player };
    }
    /* 夜想曲：聖なる木立ち＝受けた祝福が +コイン を与えないなら、他のプレイヤーも**同じ1枚**を受けてよい（任意）。
       自分の祝福を解決し終えてから手番順に窓を開く。 */
    if (!state.pending && !state.gameOver && state.turn && state.turn.groveShare &&
        !(state.boonQueue || []).length) {
      const gs = state.turn.groveShare;
      if ((gs.queue || []).length) {
        const seat = gs.queue.shift();
        state.pending = { type: 'grove_offer', player: seat, boon: gs.boon };
      } else state.turn.groveShare = null;
      state = runReplays(state);
    }
    /* 夜想曲：レプラコーン＝**金貨の獲得（とその獲得時リアクション）を全部解決してから**場の枚数を数える。
       ちょうど7枚なら願い1枚、そうでなければ呪詛1つ（牧羊犬が7枚目になる公式裁定に対応する）。 */
    if (!state.pending && !state.gameOver && state.turn && (state.turn.leprechaunCheck || []).length &&
        !(state.onGainQueue && state.onGainQueue.length)) {
      const seat = state.turn.leprechaunCheck.shift();
      const lp = state.players[seat];
      const inPlayN = lp.inPlay.length + (lp.durationCards || []).length;
      if (inPlayN === 7) {
        if (gain(state, seat, 'wish', 'discard')) log(state, `${lp.name} はレプラコーン（場にちょうど7枚）で願い1枚を獲得した。`);
      } else {
        log(state, `${lp.name} はレプラコーン（場に${inPlayN}枚）で呪詛を受ける。`);
        receiveHex(state, seat);
      }
      state = runReplays(state);
    }
    // 暗黒時代：on-trash の「対話つき」効果（地下墓所＝安い獲得／狩場＝公領or屋敷3／従者＝アタック獲得）は
    //   トリガー時点で別の pending（アタック処理中・廃棄札の続きの獲得等）が走っていることがあるため、
    //   state.onTrashQueue に貯めておき、選択待ちが無くなったタイミングで1件ずつ pending 化する。
    //   誰のターンでも card の持ち主(player)が選ぶ（actor が pending.player を返す）。
    if (!state.pending && !state.gameOver && state.onTrashQueue && state.onTrashQueue.length) {
      state.pending = state.onTrashQueue.shift();
      state = runReplays(state);
    }
    // 帝国：城の「獲得時の対話」（広大な城＝公領/屋敷3の選択／幽霊城＝相手の手札上げ）は、gainer 自身の pending 中に
    //   獲得すると（remodel/工房等の *_GAIN 経由）その場で立てられないため onGainQueue に貯め、選択待ちが無くなったら 1件ずつ pending 化する。
    if (!state.pending && !state.gameOver && state.onGainQueue && state.onGainQueue.length) {
      // 移動動物園：門番の追放（gatekeeper_exile）は**非対話**＝pending にせずその場で適用して次へ進む。
      //   キューに積むのは「獲得したカードを動かせる窓（そり/アザラシ）が先にある」ときだけなので、
      //   ここまで来た時点でそれらは解決済み＝公式どおり「先に動かせば門番は失敗する」になる。
      while (state.onGainQueue.length) {
        const q = state.onGainQueue.shift();
        if (q.type === 'gatekeeper_exile') { applyGatekeeperExile(state, q.player, q.card, q.dest); continue; }
        // 同盟：獲得時の Ally 窓は、積んでから解決までに条件が崩れることがある（好意が減った／札が動いた）＝再検査。
        if (String(q.type).indexOf('ally_') === 0 && !allyGainWindowOpen(state, q)) continue;
        state.pending = q; break;
      }
      state = runReplays(state);
    }
    // 移動動物園：植民（Populate）＝アクションのサプライ山それぞれから1枚ずつ獲得する。
    //   1枚獲得するたびに獲得時対話（望楼/そり/追放の払い戻し等）が挟まるので、それを解決してから次の選択待ちを開く。
    //   空になった山・獲得できなくなった山はここで落とす（残りゼロなら窓を閉じる）。
    if (!state.pending && !state.gameOver && state.turn && state.turn.populateQueue && state.turn.populateQueue.length) {
      const t3 = state.turn;
      const left = t3.populateQueue.filter((k) => populatePiles(state).indexOf(k) >= 0);
      if (left.length && t3.populatePlayer != null) {
        t3.populateQueue = left;
        state.pending = { type: 'populate', player: t3.populatePlayer };
      } else t3.populateQueue = null;
      state = runReplays(state);
    }
    // ルネサンス：増築の廃棄/獲得が誘発した対話（技術革新/下水道/貨物船/ドゥカート）を解決し終えたら、
    //   保留していた片付け（endBuyTailSchemeOrCleanup）に戻る。＝「片付けは対話の後」を保証する再入。
    if (!state.pending && !state.gameOver && state.turn && state.turn.cleanupWaiting != null &&
        !(state.onGainQueue && state.onGainQueue.length) && !(state.onTrashQueue && state.onTrashQueue.length)) {
      const cw = state.turn.cleanupWaiting;
      state.turn.cleanupWaiting = null;
      endBuyTailSchemeOrCleanup(state, cw);
      state = runReplays(state);
    }
    // 冒険：語り部の中断再開は runReplays より前（上）で処理済み。ここでは onTrashQueue 由来などで再度残っていれば拾う保険。
    if (!state.pending && !state.gameOver && state.turn && state.turn.storytellerResume) {
      storytellerStep(state, state.turn.storytellerResume.player);
      state = runReplays(state);
    }
    // 冒険：アクションを解決した直後の呼び出し窓（法貨＝+2アクション／御料車＝再演）。
    //   afterActionCard が立っていて呼べる Reserve が酒場マットにあれば after_action pending を開く。
    //   呼び出しは afterActionCard を保持したまま（再演/複数コール対応）、辞退か候補ゼロで消す。
    // 夜想曲：**夜フェイズの人狼**でもこの窓は開く（`t.afterActionCard` は PLAY_NIGHT でも
    //   「アクションでもある夜行カード」のときだけ立つ＝純粋な夜行カードでは開かない）。
    if (!state.pending && !state.gameOver && state.turn && state.turn.afterActionCard &&
        (state.turn.phase === 'action' || state.turn.phase === 'night')) {
      const pi2 = state.turn.active, p2 = state.players[pi2], ac = state.turn.afterActionCard;
      const callable = (p2.tavern || []).some((c) => c === 'coin_of_the_realm' || (c === 'royal_carriage' && p2.inPlay.includes(ac)));
      if (callable) state.pending = { type: 'after_action', player: pi2, card: ac };
      else state.turn.afterActionCard = null;
    }
    /* 「財宝を全部出す」の続き。ティアラ/冠/偽造通貨/金床/水晶玉/投資/ペテン師(堀) 等で選択待ちが立つと
       途中で止まるので、解決したら**自動で残りを出し切る**（ボタンを押し直させない）。
       ・その手番の購入フェイズ限定（freshTurn で turn ごと消える／購入すると treasuresLocked で止まる）。
       ・支配中も t.active（＝手札の持ち主）の財宝を出す＝PLAY_ALL_TREASURES 本体と同じ。 */
    if (!state.pending && !state.gameOver && state.turn && state.turn.playAllResume) {
      const t2 = state.turn;
      const r = t2.playAllResume;
      // 中断したときのキューをそのまま出し切る（手札の再スキャンはしない＝下記の理由）。
      //   ・途中で手札に入った財宝を勝手に出さない（高級市場が買えなくなる／資本主義でアタックが無断発動する）
      //   ・購入したら treasuresLocked で止まる／ヴィラ等でアクションフェイズへ戻ったら止まる／手番が変われば止まる
      if (t2.phase !== 'buy' || t2.treasuresLocked || !r || r.player !== t2.active || !Array.isArray(r.queue)) {
        t2.playAllResume = null;
      } else {
        const p2 = state.players[r.player];
        while (r.queue.length) {
          const card = r.queue.shift();
          if (!p2.hand.includes(card)) continue;         // 途中で手札から消えた札は飛ばす（廃棄/捨てられた等）
          if (!isTreasureFor(state, card)) continue;     // もう財宝でない（資本主義が外れた等）なら飛ばす
          playTreasureCard(state, r.player, card);
          if (state.pending) break;
        }
        // 選択待ちが立たずに抜けた＝キューを出し切った。立っていれば残りは r.queue に残したまま次回へ。
        if (!state.pending) t2.playAllResume = null;
        state = runReplays(state);
      }
    }
    return state;
  }
  // 玉座の間の「2回目の適用」（および錬金術ゴーレムの2枚目）を、選択待ちが解消したタイミングで実行する。
  /* 夜想曲：祝福/呪詛の解決が途中のあいだは「再演（玉座の間の2回目など）」を割り込ませてはいけない。
     呪詛は `t.currentHex` と `t.hexQueue` を1枚ぶん占有するので、割り込むと**残りの被害者と呪詛カード自体が消える**
     （玉座の間×迫害者の3人戦で実際に踏んだ）。祝福も「1回目の効果を完全に解決してから2回目」が公式。 */
  function nocturneQueueBusy(state) {
    const t = state.turn;
    if (state.boonQueue && state.boonQueue.length) return true;
    if (state.hexSelfQueue && state.hexSelfQueue.length) return true;
    if (!t) return false;
    if (t.hexQueue && t.hexQueue.length) return true;
    if (t.currentHex) return true;
    if (t.boonChoice && (t.boonChoice.boons || []).length) return true;
    if (t.groveShare && ((t.groveShare.queue || []).length)) return true;
    return false;
  }
  function runReplays(state) {
    let guard = 0;
    while (!state.pending && !nocturneQueueBusy(state) && state.replay && state.replay.length && !state.gameOver && guard++ < 200) {
      const r = state.replay.shift();
      if (r.label === 'procession_finish') {
        // 暗黒時代：行進＝2回のプレイが終わった後、対象を場から廃棄し、ちょうど+$1高いアクションを獲得（強制）。
        //   対象が自己移動していれば廃棄は不発だが獲得は行う（公式）。廃棄の on-trash は先に解決される。
        const p = state.players[r.player];
        const tref = costOf(state, r.card);
        if (removeOne(p.inPlay, r.card)) { trashCard(state, r.player, r.card); log(state, `${p.name} は行進で「${C()[r.card].name}」を廃棄した。`); }
        else log(state, `${p.name} は行進で対象を廃棄できなかった（場に無い）。`);
        const mx = tref.coin + 1;
        if (anyGainable(state, (id) => costExact(state, id, mx, tref.pot, tref.debt) && isTypeSupply(state, id, 'action'))) {
          state.pending = { type: 'procession_gain', player: r.player, exact: mx, pot: tref.pot, debt: tref.debt };
        }
        continue; // applyEffect は行わない（制御項目）。pending を立てたら while が停止する。
      }
      /* 夜想曲：コンクラーベ＝手札のアクションを使ったら**その解決が全部終わった後で** +1アクション（公式）。
         `addActions` を通すので、コンクラーベで雪深い村を使った場合は +1アクションが無視される（＝公式どおり）。 */
      if (r.label === 'conclave_bonus') {
        addActions(state.turn, 1);
        log(state, `${state.players[r.player].name} はコンクラーベで +1アクション。`);
        continue;
      }
      if (r.label === 'treasure_replay') {
        // 帝国：冠／繁栄：ティアラ／暗黒時代：偽造通貨＝「手札の財宝1枚を2回使う」の2回目。
        //   カードは動かさず（既に場にある）効果だけをもう一度適用する。1回目が選択待ちを立てた場合は
        //   それが解決してからここに来る（＝御守り/金床/水晶玉などの選択が2回とも正しく出る）。
        log(state, `${state.players[r.player].name} は「${C()[r.card].name}」をもう一度使った。`);
        // ルネサンス：資本主義で「財宝になったアクション」を2回使う場合は、**アクションの効果**をもう一度適用する
        //   （applyTreasureEffect ではコインもどの分岐にも当たらず完全に不発になる）。
        if (!DOM.isType(r.card, 'treasure') && DOM.isType(r.card, 'action')) {
          state.turn.actionsPlayed = (state.turn.actionsPlayed || 0) + 1;
          applyEffect(state, r.card, r.player);
        } else {
          applyTreasureEffect(state, r.player, r.card);
        }
        continue; // applyEffect（アクションの効果）は行わない
      }
      if (r.label === 'counterfeit_trash') {
        // 暗黒時代：偽造通貨＝2回のプレイが終わった後、その財宝を場から廃棄する。
        //   対象が自己移動していれば（戦利品が山へ戻る等）廃棄は不発（lose track）。
        const p = state.players[r.player];
        if (removeOne(p.inPlay, r.card)) { trashCard(state, r.player, r.card); log(state, `${p.name} は偽造通貨で「${C()[r.card].name}」を廃棄した。`); }
        continue;
      }
      if (r.label === 'golem') {
        // ゴーレムで見つけた2枚目：場に置いてから使う（クリーンアップで場から片付く）。
        // アクション権は消費しないが「使った」扱い＝共謀者等の「このターンに使ったアクション数」には数える。
        state.players[r.player].inPlay.push(r.card);
        state.turn.actionsPlayed = (state.turn.actionsPlayed || 0) + 1;
        log(state, `${state.players[r.player].name} はゴーレムで「${C()[r.card].name}」を使った。`);
      } else if (r.label === 'procession2') {
        state.turn.actionsPlayed = (state.turn.actionsPlayed || 0) + 1;
        log(state, `${state.players[r.player].name} は行進で「${C()[r.card].name}」をもう一度使った。`);
      } else if (r.label === 'royal_carriage') {
        // 冒険：御料車＝場のアクションを再演する（アクション権は消費しない・共謀者判定には数える）。
        state.turn.actionsPlayed = (state.turn.actionsPlayed || 0) + 1;
        log(state, `${state.players[r.player].name} は御料車で「${C()[r.card].name}」を再演した。`);
      } else if (r.label === 'crown') {
        // 帝国：冠（アクションモード）＝玉座と同じくもう一度使う（アクション権は消費しない）。
        state.turn.actionsPlayed = (state.turn.actionsPlayed || 0) + 1;
        log(state, `${state.players[r.player].name} は冠で「${C()[r.card].name}」をもう一度使った。`);
      } else if (r.label === 'ghost') {
        // 夜想曲：幽霊＝脇に置いたアクションを2度使用する（2回目。命令ではないのでカードは場に出たまま）。
        state.turn.actionsPlayed = (state.turn.actionsPlayed || 0) + 1;
        log(state, `${state.players[r.player].name} は幽霊で「${C()[r.card].name}」をもう一度使った。`);
      } else {
        state.turn.actionsPlayed = (state.turn.actionsPlayed || 0) + 1;
        log(state, `${state.players[r.player].name} は玉座の間で「${C()[r.card].name}」をもう一度使った。`);
      }
      // 同盟：再演（玉座/王の宮廷/行進/御料車/冠/幽霊/山砦）も「カードの使用」＝Ally の窓が開く
      //   （公式逐語 "once per **time you play** an Action card"）。ゴーレムの2枚目も新しいプレイ。
      noteAllyPlay(state, r.player, r.card);
      // 命令（大君主/はみだし者）の「再演では選び直さない」判定に使う。
      //   ゴーレムの2枚目だけは「別カードの新しいプレイ」なので再演扱いにしない。
      state._replaying = (r.label !== 'golem');
      applyEffect(state, r.card, r.player);
      delete state._replaying;
    }
    return state;
  }
  function applyAction(state, action) {
    const t = state.turn;
    const pi = t.active;
    const me = state.players[pi];

    if (state.gameOver && action.type !== 'NEW_GAME') return state;

    switch (action.type) {
      /* ---- 新規ゲーム ---- */
      case 'NEW_GAME':
        return createInitialState(action.players, action.kingdom, { startActive: action.startActive, landmarks: action.landmarks, events: action.events, projects: action.projects, ways: action.ways });

      /* ---- アクションカードを使う ---- */
      case 'PLAY_ACTION': {
        if (state.pending) return state;
        if (t.phase !== 'action') return state;
        if (t.actions <= 0) return state;
        t.inStartPhase = false; // ルネサンス：自分でアクションを使い始めたら「ターン開始時効果」は終わり
        const card = action.card;
        // 冒険：相続＝自分のターン中、屋敷はアクション（命令）としてもプレイできる（脇のカードを動かさずに使用）。
        const asInherited = inheritedEstate(me, card);
        if (!DOM.isType(card, 'action') && !asInherited) return state;
        if (me.hand.indexOf(card) < 0) return state;
        removeOne(me.hand, card);
        me.inPlay.push(card);
        t.actions -= 1;
        t.actionsPlayed = (t.actionsPlayed || 0) + 1; // 共謀者の判定用（このターンに使ったアクション数）
        // 冒険：チャンピオン＝場にある間、アクションを使うたびに +1アクション（このカード自身のプレイは除く）。
        //   ※玉座/王の宮廷/門下生の再演（applyEffect経由・カードは動かない）は対象外＝許容簡略化。
        {
          const champs = me.inPlay.filter((c) => c === 'champion').length + (me.durationCards || []).filter((c) => c === 'champion').length - (card === 'champion' ? 1 : 0);
          if (champs > 0) { addActions(t, champs); log(state, `${me.name} はチャンピオンで +${champs}アクション。`); }
        }
        // 冒険：山トークン＝この山のカードをプレイしたとき、まず該当ボーナスを得る（アクションの効果解決より前）。
        //   ※玉座/王の宮廷/門下生の再演（applyEffect経由）は対象外＝champion と同じ許容簡略化。
        //   相続の屋敷でプレイする場合は「脇に置いたカードの山」のトークンを見る（公式）。
        applyPileTokens(state, pi, asInherited ? me.inherited[0] : card);
        t.afterActionCard = card; // 冒険：法貨/御料車の「アクション解決直後」の呼び出し窓の対象
        // 同盟：「カードを使用した後」に働く Ally（魔女の輪／小売店主連盟／写本士の仲間たち）＝解決後に判定する。
        noteAllyPlay(state, pi, asInherited ? 'estate' : card);
        log(state, `${me.name} は「${C()[card].name}」を使った。`);
        // 帝国：女魔術師（enchantress）＝この手番で最初にプレイしたアクションは、記載効果の代わりに +1カード +1アクション。
        //   （チャンピオン/教師トークンなどの「アクションをプレイしたとき」の外部トリガーは先に適用済み＝ラインより下の能力は機能する[公式]。
        //    持続カードを置換した場合は持続予約を張らない＝そのターンに捨てられる[片付けで cnt=0]。）
        // 移動動物園：習性（Way）＝このカードの記載効果の代わりに使う（action.way で指定。採用外のidは無視）。
        const useWay = isUsableWay(state, action.way) ? action.way : null;
        if (useWay) log(state, `${me.name} は「${DOM.LANDSCAPES[useWay].name}」を使う。`);
        if (me.enchanted) {
          me.enchanted = false;
          // 公式：女魔術師の影響下でも、+1カード+1アクション の代わりに習性を使ってよい。
          if (useWay) { applyWay(state, useWay, card, pi); return state; }
          draw(state, pi, 1); addActions(t, 1);
          log(state, `${me.name} は女魔術師の効果で 記載効果の代わりに +1カード +1アクション。`);
          return state;
        }
        // ルネサンス：山砦＝このターン最初のアクション使用なら、効果解決の「後」に再演する（replay キューに積む）。
        maybeCitadel(state, pi, asInherited ? 'estate' : card);
        // 暗黒時代：浮浪児＝別アタックのプレイ時に場の浮浪児を廃棄→傭兵。効果は URCHIN_TRASH 解決後に適用。
        if (maybeUrchinTrap(state, card, pi)) return state;
        // 移動動物園：炉＝このターン、次に使うカードの**解決前**に同名を獲得してよい。
        //   窓を開いたら中断し、KILN_GAIN の解決で applyEffect（習性を使うなら applyWay）を呼ぶ。
        if (maybeKiln(state, card, pi, 'action', useWay)) return state;
        if (useWay) { applyWay(state, useWay, card, pi); return state; }
        applyEffect(state, card, pi);
        return state;
      }

      /* ---- 夜想曲：夜フェイズに夜行（Night）カードを使う ----
         夜フェイズは購入フェイズの**後**にあり、**アクション権も購入権も消費しない**（何枚でも使える）。
         夜行カードは普通に場に出るので、持続なら持ち越し・そうでなければ片付けで捨て札になる（既存の仕分けがそのまま働く）。
         「アクションカードを使用したとき」の外部トリガー（共謀者の数え／チャンピオンの +1アクション／山トークン）は、
         人狼のように **Action でもある**夜行カードを夜に使った場合には普通に働く（公式）。
         習性（Way）は「アクションカードを使用するとき」なので夜行カードには使えない＝ここでは選ばせない。 */
      case 'PLAY_NIGHT': {
        if (state.pending) return state;
        if (t.phase !== 'night') return state;
        const ncard = action.card;
        if (!DOM.isType(ncard, 'night')) return state;
        if (me.hand.indexOf(ncard) < 0) return state;
        /* **アクションでもある夜行カード（人狼）は「アクションカードを使用した」でもある**（公式）。
           習性(Way)・女魔術師の置換・御料車の呼び出し窓・浮浪児のトラップ・チャンピオン・山トークン は
           すべて「アクションカードの使用」に反応するので、夜フェイズでも同じように働かせる。
           純粋な夜行カード（アクションでないもの）では働かせない。 */
        const nIsAction = DOM.isType(ncard, 'action');
        const nWay = nIsAction && isUsableWay(state, action.way) ? action.way : null;
        // 帝国：女魔術師＝そのターン最初に使うアクションカードは記載効果の代わりに +1カード +1アクション。
        if (nIsAction && me.enchanted) {
          me.enchanted = false;
          removeOne(me.hand, ncard); me.inPlay.push(ncard);
          t.nightPlayed = (t.nightPlayed || 0) + 1;
          t.actionsPlayed = (t.actionsPlayed || 0) + 1;
          draw(state, pi, 1); addActions(t, 1);
          log(state, `${me.name} は女魔術師の効果で 記載効果の代わりに +1カード +1アクション（夜フェイズ）。`);
          return state;
        }
        // 暗黒時代：浮浪児＝場に浮浪児があるときに**別のアタック**を使うと、解決前に廃棄して傭兵を獲得できる。
        if (DOM.isType(ncard, 'attack') && maybeUrchinTrap(state, ncard, pi)) {
          state.pending.deferredNight = ncard; // 解決は URCHIN_TRASH の後（PLAY_NIGHT 経路であることを覚える）
          removeOne(me.hand, ncard);
          return state;
        }
        removeOne(me.hand, ncard);
        me.inPlay.push(ncard);
        t.nightPlayed = (t.nightPlayed || 0) + 1;
        if (nIsAction) {
          t.actionsPlayed = (t.actionsPlayed || 0) + 1; // 共謀者の「このターンに使ったアクション数」
          t.afterActionCard = ncard; // 冒険：御料車/法貨の「アクション解決直後」の呼び出し窓（人狼が唯一の合法経路）
          const champs = me.inPlay.filter((c) => c === 'champion').length +
            (me.durationCards || []).filter((c) => c === 'champion').length;
          if (champs > 0) { addActions(t, champs); log(state, `${me.name} はチャンピオンで +${champs}アクション。`); }
        }
        applyPileTokens(state, pi, ncard); // 冒険：山トークン（その山のカードを使ったときのボーナス）
        noteAllyPlay(state, pi, ncard);    // 同盟：「使用した後」に働く Ally（人狼＝アクションでもある夜行カードだけ対象）
        log(state, `${me.name} は「${C()[ncard].name}」を使った（夜フェイズ）。`);
        if (nWay) log(state, `${me.name} は「${DOM.LANDSCAPES[nWay].name}」を使う。`);
        // 移動動物園：炉＝「このターン次に使うカードの解決前に同名を獲得してよい」＝夜行カードも「カードの使用」。
        if (maybeKiln(state, ncard, pi, nWay ? 'action' : 'night', nWay)) return state;
        if (nWay) applyWay(state, nWay, ncard, pi);
        else applyEffect(state, ncard, pi);
        return state;
      }

      /* ---- 財宝を出す ---- */
      // 公式の基本ルール：「先に財宝を出し、それから買う」＝**一度でも購入したら、そのターンはもう財宝を出せない**
      //   （基本ルールブック "You cannot go back and play more Treasures after buying a card"。
      //    冒険ルールブックは「イベントを買った後も同様」と明記＝t.treasuresLocked で3経路（BUY/BUY_EVENT/闇市場）を塞ぐ）。
      //   これが無いと「施し（場に財宝が無ければ$4以下を獲得）を先に買ってから財宝を出す」抜け道ができる。
      case 'PLAY_TREASURE': {
        if (state.pending) return state;
        if (t.phase !== 'buy') return state;
        if (t.treasuresLocked) return state;
        const card = action.card;
        if (!isTreasureFor(state, card)) return state;
        if (me.hand.indexOf(card) < 0) return state;
        playTreasureCard(state, pi, card);
        return state;
      }
      case 'PLAY_ALL_TREASURES': {
        if (state.pending) return state;
        if (t.phase !== 'buy') return state;
        if (t.treasuresLocked) return state;
        // 並び順は playAllOrder が正本（ティアラ/冠/偽造通貨を最初・銀貨を早め・大金を最後）。
        /* 夜想曲：**呪われた金貨（家宝）は「財宝を全部出す」の対象から外す**。
           出すと必ず呪い1枚を獲得する＝ボタン1つで事故になるため、1枚ずつタップして出してもらう
           （公式でも財宝を出すかどうかは1枚ずつの任意。PROGRESS に許容簡略化として記録）。 */
        const treasures = me.hand.filter((c) => isTreasureFor(state, c) && !PLAY_ALL_EXCLUDE.has(c)).sort(playAllOrder);
        // 繁栄：金床/投資/水晶玉/ティアラ/ペテン師(堀)は使ったとき選択が出る。pending が立ったら残りは止める。
        //   止まった残りは reduce 末尾の playAllResume が、選択の解決後に自動で出し切る。
        //   **残りは「ボタンを押した時点の手札」で固定する**（再開時に手札を再スキャンすると、
        //   途中で手札に入ってきた財宝＝収税吏/彫刻家の獲得・資本主義で財宝になったアクション まで
        //   勝手に出してしまう＝高級市場が買えなくなる／アタックが無断で発動する）。
        for (let i = 0; i < treasures.length; i++) {
          playTreasureCard(state, pi, treasures[i]);
          if (state.pending) { t.playAllResume = { player: pi, queue: treasures.slice(i + 1) }; break; }
        }
        if (treasures.length) log(state, `${me.name} は財宝を出した。`);
        return state;
      }

      /* ---- カードを買う ---- */
      case 'BUY': {
        if (state.pending) return state;
        if (t.phase !== 'buy') return state;
        if ((me.debt || 0) > 0) return state; // 帝国：負債があるとカードを購入できない（先に REPAY_DEBT で返済する）
        if (t.noBuyCards) return state;       // 冒険：使節団の追加ターン＝カードは購入できない（イベントは買える）
        const card = action.card;
        if (!C()[card]) return state; // 未知のカードIDは状態不変で拒否（throwしない）
        const cost = cardCost(state, card); // 「橋」等のコスト軽減を反映
        const pot = potionCost(card);       // 錬金術：ポーション費用（あれば）
        const boughtRef = costOf(state, card); // 値切り屋の基準＝**購入時点**のコスト3成分（混合山は gain 後に変わる）
        if ((state.supply[card] || 0) <= 0) return state;
        if (t.buys <= 0) return state;
        if (cost > t.coins) return state;
        if (pot > (t.potions || 0)) return state; // ポーションが足りなければ買えない
        if (!canBuyCard(state, pi, card)) return state; // 繁栄：高級市場は場に銅貨があると買えない
        t.coins -= cost;
        t.potions = (t.potions || 0) - pot;
        t.buys -= 1;
        t.buysMade = (t.buysMade || 0) + 1; // 冒険：使者の「そのターン最初の購入か」判定用（購入回数）
        t.treasuresLocked = true;           // 公式：購入したら、そのターンはもう財宝を出せない
        gain(state, pi, card, 'discard');
        log(state, `${me.name} は「${C()[card].name}」を購入した。`);
        // 繁栄：造幣所を購入したとき、場の財宝をすべて廃棄する。
        if (card === 'mint') {
          const inPlayT = me.inPlay.filter((c) => isTreasureFor(state, c));
          inPlayT.forEach((c) => { removeOne(me.inPlay, c); trashCard(state, pi, c); });
          if (inPlayT.length) log(state, `${me.name} は造幣所の購入で場の財宝 ${inPlayT.length}枚 を廃棄した。`);
        }
        // 冒険：港町を購入したとき、もう1枚の港町を獲得する（獲得＝BUY再帰しないので二重購入にならない）。
        if (card === 'port') { if (gain(state, pi, 'port', 'discard')) log(state, `${me.name} は港町の購入でもう1枚の港町を獲得した。`); }
        // ギルド：商人ギルドが場にある間、カードを購入するたびに財源(Coffers)を得る（場の枚数ぶん）。
        triggerMerchantGuild(state, pi);
        // ギルド：過払い（overpay）＝購入時に追加でコインを払える。残コインがあれば選択待ちを立てる。
        maybeStartOverpay(state, pi, card);
        // 異郷：農地＝購入したとき、手札1枚を廃棄し、ちょうど$2高いカード1枚を獲得。
        if (card === 'farmland' && me.hand.length > 0 && !state.pending) {
          state.pending = { type: 'farmland', stage: 'trash', player: pi };
        }
        // 冒険：使者＝そのターン最初の購入なら $4以下1枚を獲得し他の各Pもコピーを獲得。
        if (card === 'messenger' && t.buysMade === 1 && !state.pending && anyGainable(state, (id) => costUpTo(state, id, 4))) {
          state.pending = { type: 'messenger_gain', player: pi };
        }
        // 異郷：高貴な山賊＝購入したときもアタック（プレイ時の+1コインは付かない）。
        if (card === 'noble_brigand' && !state.pending) nobleBrigandAttack(state, pi);
        // 異郷：値切り屋＝場にある間、購入のたびに そのコスト未満の勝利点でないカード1枚を獲得。
        //   基準は**購入時点**のコスト3成分（混合山は gain() の shift で一番上が変わるので gain 後に測ってはいけない）。
        maybeHagglerGains(state, pi, boughtRef);
        // 冒険：呪いの森/沼の妖婆＝他Pの持続がある間、購入のたびに手札を山札の上へ/呪い獲得（購入した以上フックは必ず発動）。
        //   農地の廃棄pendingが立ったまま呪いの森が手札を空にしても、FARMLAND_TRASH が空手札を終端処理する（詰まない）。
        applyLingerOnBuy(state, pi);
        return state;
      }

      /* ---- 帝国：横型イベントの購入（BUY_EVENT）＝購入権1消費・イベント自体は獲得しない・同じイベントを複数回可 ---- */
      case 'BUY_EVENT': {
        if (state.pending) return state;
        if (t.phase !== 'buy') return state;
        if ((me.debt || 0) > 0) return state; // 負債があるとカードもイベントも購入できない
        const id = action.event;
        const ev = DOM.LANDSCAPES && DOM.LANDSCAPES[id];
        if (!ev || ev.kind !== 'event') return state;   // イベントでない/未知
        if (!hasEvent(state, id)) return state;         // この対局で採用されていない
        const cost = ev.cost || 0, debt = ev.debt || 0;
        if (t.buys <= 0) return state;                  // 購入権が必要
        if (cost > t.coins) return state;               // コイン不足（イベントはコスト軽減を受けない）
        if (!canBuyEvent(state, pi, id)) return state;  // 1ターン1回／1ゲーム1回の制限
        t.coins -= cost;
        t.buys -= 1;
        t.treasuresLocked = true; // 公式：イベントを買った後も、そのターンはもう財宝を出せない
        t.buysMade = (t.buysMade || 0) + 1; // 冒険：使者の「そのターン最初に買ったもの」＝イベントも「買ったもの」に数える
        (t.eventsBought = t.eventsBought || []).push(id);
        // 負債コストのイベントは負債を負う。**支配中は負債も支配者が負う**（カードと同じ扱い＝公式）。
        if (debt > 0) {
          const dwho = (t.possessedBy != null && pi === t.active) ? t.possessedBy : pi;
          state.players[dwho].debt = (state.players[dwho].debt || 0) + debt;
        }
        log(state, `${me.name} はイベント「${ev.name}」を購入した。` + (debt ? `（負債+${debt}）` : ''));
        applyEventEffect(state, pi, id);
        return state;
      }

      /* ---- ルネサンス：横型プロジェクトの購入（BUY_PROJECT）----
         購入権1消費・コインを支払う・**カードは獲得しない**・キューブを置いて以後ずっと効果が続く。
         1人2つまで／同じものは1回だけ（canBuyProject が正本）。イベント同様、購入時トリガー（商人ギルド/値切り屋/
         公会堂 等）は発動しない＝「カードの購入」ではないため。コスト軽減（橋/街道/運河）も受けない。 */
      case 'BUY_PROJECT': {
        if (state.pending) return state;
        const id = action.project;
        if (!canBuyProject(state, pi, id)) return state;
        const pr = DOM.LANDSCAPES[id];
        t.coins -= (pr.cost || 0);
        t.buys -= 1;
        t.treasuresLocked = true; // 公式：何かを買った後は、そのターンもう財宝を出せない
        t.buysMade = (t.buysMade || 0) + 1; // 冒険：使者の「そのターン最初に買ったもの」に数える
        (me.projects = me.projects || []).push(id);
        log(state, `${me.name} はプロジェクト「${pr.name}」を購入した。`);
        return state;
      }

      /* ===== 冒険：横型イベントの選択待ち（すべて 4点セット＝reducer＋PLAYER_ACTIONS＋CPU＋UI） ===== */
      // 施し＝コスト$4以下を1枚獲得（強制）。
      case 'ALMS_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'alms_gain') return state;
        const card = action.card;
        // 終端保証：候補が尽きていれば「獲得せず解決」（CPUの無限ループ／人間の詰みを防ぐ）
        if (!anyGainable(state, (cid) => upToCanGain(state, cid, 4))) { state.pending = null; return state; }
        if (!card || !upToCanGain(state, card, 4) || (state.supply[card] || 0) <= 0) return state;
        state.pending = null;
        gain(state, pd.player, card, 'discard');
        log(state, `${state.players[pd.player].name} は施しで「${C()[card].name}」を獲得した。`);
        return state;
      }
      // 探索＝3択（アタック1枚／呪い2枚／任意6枚）。捨てられたら金貨。辞退も可。
      case 'QUEST_MODE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'quest' || pd.stage !== 'mode') return state;
        const p = state.players[pd.player];
        const mode = action.mode;
        if (mode === 'skip') { state.pending = null; return state; }
        if (mode === 'curses') { // 呪いは選択の余地なし＝その場で解決（2枚捨てられたときだけ金貨）
          const n = Math.min(2, p.hand.filter((c) => c === 'curse').length);
          const disc = [];
          for (let i = 0; i < n; i++) { removeOne(p.hand, 'curse'); p.discard.push('curse'); disc.push('curse'); }
          state.pending = null;
          if (disc.length) { log(state, `${p.name} は探索で呪い${disc.length}枚を捨てた。`); triggerOnDiscard(state, pd.player, disc); }
          if (n === 2 && gain(state, pd.player, 'gold', 'discard')) log(state, `${p.name} は探索で金貨1枚を獲得した。`);
          return state;
        }
        // 公式：条件を満たせない選択肢も選べるが、その場合は捨てられず金貨も得られない（＝ここで終端させる）。
        if (mode === 'attack') {
          if (!p.hand.some((c) => DOM.isType(c, 'attack'))) { state.pending = null; return state; }
          pd.stage = 'attack'; return state;
        }
        if (mode === 'six') {
          if (p.hand.length === 0) { state.pending = null; return state; }
          pd.stage = 'six'; return state;
        }
        return state;
      }
      case 'QUEST_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'quest' || (pd.stage !== 'attack' && pd.stage !== 'six')) return state;
        const p = state.players[pd.player];
        const cards = (action.cards || []).slice();
        const need = pd.stage === 'attack' ? 1 : Math.min(6, p.hand.length);
        if (cards.length !== need) return state;
        // 手札に無いカードを含む選択は拒否（多重度も検査）
        const pool = p.hand.slice();
        for (const c of cards) { if (!removeOne(pool, c)) return state; }
        if (pd.stage === 'attack' && !DOM.isType(cards[0], 'attack')) return state;
        cards.forEach((c) => { removeOne(p.hand, c); p.discard.push(c); });
        state.pending = null;
        log(state, `${p.name} は探索で ${cards.length}枚 を捨てた。`);
        triggerOnDiscard(state, pd.player, cards);
        // 「アタック1枚」＝成立／「任意6枚」＝ちょうど6枚捨てられたときだけ金貨
        const okQuest = pd.stage === 'attack' ? true : cards.length === 6;
        if (okQuest && gain(state, pd.player, 'gold', 'discard')) log(state, `${p.name} は探索で金貨1枚を獲得した。`);
        return state;
      }
      // 保存＝手札1枚を脇に置く（このターンの終了時＝次の手札を引いた後に手札へ戻す）。
      case 'SAVE_SETASIDE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'save') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (!card || p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card);
        p.setAside.push(card);
        t.savedCard = card;
        state.pending = null;
        log(state, `${p.name} は保存でカード1枚を脇に置いた（ターン終了時に手札へ）。`);
        return state;
      }
      // 偵察隊＝5枚のうち3枚を捨て、残り2枚を好きな順で山札の上へ。
      case 'SCOUTING_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'scouting_party' || pd.stage !== 'discard') return state;
        const p = state.players[pd.player];
        const cards = (action.cards || []).slice();
        if (cards.length !== 3) return state;
        const pool = pd.cards.slice();
        for (const c of cards) { if (!removeOne(pool, c)) return state; }
        cards.forEach((c) => p.discard.push(c));
        log(state, `${p.name} は偵察隊で 3枚 を捨て札にした。`);
        triggerOnDiscard(state, pd.player, cards);
        if (pool.length === 0) { state.pending = null; return state; }
        if (pool.length === 1) { p.deck.unshift(pool[0]); state.pending = null; return state; }
        pd.stage = 'order'; pd.cards = pool;
        return state;
      }
      case 'SCOUTING_ORDER': {
        const pd = state.pending;
        if (!pd || pd.type !== 'scouting_party' || pd.stage !== 'order') return state;
        const p = state.players[pd.player];
        const order = (action.order || []).slice();
        if (order.length !== pd.cards.length) return state;
        const pool = pd.cards.slice();
        for (const c of order) { if (!removeOne(pool, c)) return state; }
        for (let i = order.length - 1; i >= 0; i--) p.deck.unshift(order[i]); // 先頭が一番上
        state.pending = null;
        log(state, `${p.name} は偵察隊で ${order.length}枚 を山札の上に戻した。`);
        return state;
      }
      // 焚火＝場の銅貨を2枚まで廃棄（任意）。
      case 'BONFIRE_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'bonfire') return state;
        const p = state.players[pd.player];
        const n = Math.max(0, Math.min(2, (action.count || 0), p.inPlay.filter((c) => c === 'copper').length));
        for (let i = 0; i < n; i++) { removeOne(p.inPlay, 'copper'); trashCard(state, pd.player, 'copper'); }
        state.pending = null;
        if (n) log(state, `${p.name} は焚火で場の銅貨 ${n}枚 を廃棄した。`);
        return state;
      }
      // 舞踏会＝コスト$4以下を2枚獲得（強制・候補が尽きたら終わる）。
      case 'BALL_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'ball_gain') return state;
        const card = action.card;
        if (!anyGainable(state, (cid) => upToCanGain(state, cid, 4))) { state.pending = null; return state; } // 終端保証
        if (!card || !upToCanGain(state, card, 4) || (state.supply[card] || 0) <= 0) return state;
        const holder = pd.player, left = (pd.left || 1) - 1;
        state.pending = null; // gain の獲得時対話（望楼等）を通すため先に閉じる
        gain(state, holder, card, 'discard');
        log(state, `${state.players[holder].name} は舞踏会で「${C()[card].name}」を獲得した。`);
        if (left > 0 && !state.pending && anyGainable(state, (cid) => upToCanGain(state, cid, 4))) {
          state.pending = { type: 'ball_gain', player: holder, left };
        } else if (left > 0) {
          (state.onGainQueue = state.onGainQueue || []).push({ type: 'ball_gain', player: holder, left });
        }
        return state;
      }
      // 海路＝コスト$4以下のアクション1枚を獲得し、その山に +1購入トークンを移す。
      case 'SEAWAY_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'seaway') return state;
        const card = action.card;
        if (!anyGainable(state, (cid) => seawayCanGain(state, cid))) { state.pending = null; return state; } // 終端保証
        if (!card || !seawayCanGain(state, card) || (state.supply[card] || 0) <= 0) return state;
        const holder = pd.player;
        state.pending = null;
        if (gain(state, holder, card, 'discard')) {
          const p = state.players[holder];
          p.pileTokens = p.pileTokens || {};
          p.pileTokens.buy = pileKeyOf(state, card); // 分割山は上段キーに正規化（下段だと READ 側と食い違い孤児化する）
          log(state, `${p.name} は海路で「${C()[card].name}」を獲得し、その山に +1購入トークンを置いた。`);
        }
        return state;
      }
      // 交易＝手札を2枚まで廃棄し、廃棄した枚数だけ銀貨を獲得。
      case 'TRADE_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'trade') return state;
        const p = state.players[pd.player];
        const cards = (action.cards || []).slice();
        if (cards.length > 2) return state;
        const pool = p.hand.slice();
        for (const c of cards) { if (!removeOne(pool, c)) return state; }
        state.pending = null;
        cards.forEach((c) => { removeOne(p.hand, c); trashCard(state, pd.player, c); });
        if (cards.length) log(state, `${p.name} は交易で ${cards.length}枚 を廃棄した。`);
        let g = 0; for (let i = 0; i < cards.length; i++) if (gain(state, pd.player, 'silver', 'discard')) g++;
        if (g) log(state, `${p.name} は交易で銀貨 ${g}枚 を獲得した。`);
        return state;
      }
      // 巡礼＝場にある名前の異なるカードを3枚まで選び、それぞれのコピーを獲得。
      case 'PILGRIMAGE_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'pilgrimage') return state;
        const cards = (action.cards || []).slice();
        if (cards.length > 3) return state;
        const valid = pilgrimageChoices(state, pd.player);
        const seen = {};
        for (const c of cards) { if (valid.indexOf(c) < 0 || seen[c]) return state; seen[c] = 1; } // 名前は異なること
        state.pending = null;
        cards.forEach((c) => { if (gain(state, pd.player, c, 'discard')) log(state, `${state.players[pd.player].name} は巡礼で「${C()[c].name}」を獲得した。`); });
        return state;
      }
      // 山トークンの移動（失われた技術=+1アクション／鍛錬=+$1／誘導=+1カード／渡し船=-$2コスト／立案=廃棄）。
      case 'EVENT_TOKEN_PILE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'event_token') return state;
        const pile = action.pile;
        if (!actionSupplyPiles(state).length) { state.pending = null; return state; } // 終端保証（置き先ゼロ）
        if (!pile || actionSupplyPiles(state).indexOf(pile) < 0) return state;
        const p = state.players[pd.player];
        p.pileTokens = p.pileTokens || {};
        p.pileTokens[pd.token] = pileKeyOf(state, pile); // 各種別1個＝元の山からは自動的に外れる（分割山は上段キー）
        state.pending = null;
        log(state, `${p.name} は ${TOKEN_LABEL[pd.token]}トークンを「${C()[pile].name}」の山に置いた。`);
        return state;
      }
      // 立案＝廃棄トークンの山からカードを購入したとき、手札1枚を廃棄してよい（任意）。
      case 'PLAN_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'plan_trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        state.pending = null;
        if (card && p.hand.indexOf(card) >= 0) {
          removeOne(p.hand, card);
          trashCard(state, pd.player, card);
          log(state, `${p.name} は立案の廃棄トークンで「${C()[card].name}」を廃棄した。`);
        }
        return state;
      }
      // 移動遊園地＝獲得したカードを山札の上に置いてよい。
      case 'TRAVELLING_FAIR_TOPDECK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'travelling_fair') return state;
        const p = state.players[pd.player];
        state.pending = null;
        if (action.topdeck) {
          // 獲得先（dest）はヒント。ヴィラ等の獲得時効果が獲得先を変える（捨て札→手札）ので、
          //   実際にカードが在るゾーンを 獲得先→捨て札→手札 の順で探して移す（見つからなければ黙って不発＝lose track）。
          //   **`zoneOf(p, dest)` を先に見る**＝封鎖の 'setAside'／刈り入れの 'eventSetAside' に獲得した札も拾える。
          const zones = [zoneOf(p, pd.dest), p.discard, p.hand];
          const zone = zones.find((z) => z && z.indexOf(pd.card) >= 0);
          if (zone && removeOne(zone, pd.card)) { p.deck.unshift(pd.card); log(state, `${p.name} は移動遊園地で「${C()[pd.card].name}」を山札の上に置いた。`); }
        }
        return state;
      }
      // 相続＝サプライから 命令でないコスト$4以下のアクション1枚を脇に置き、屋敷トークンを載せる（1ゲーム1回）。
      case 'INHERITANCE_SET': {
        const pd = state.pending;
        if (!pd || pd.type !== 'inheritance') return state;
        const card = action.card;
        if (!inheritanceTargets(state).length) { state.pending = null; return state; } // 終端保証（対象ゼロ）
        if (!card || inheritanceTargets(state).indexOf(card) < 0) return state;
        const p = state.players[pd.player];
        if ((p.inherited || []).length) { state.pending = null; return state; }
        state.supply[card] -= 1;           // サプライから1枚取り出して脇に置く（獲得ではない＝獲得トリガーは起きない）
        p.inherited = [card];
        state.pending = null;
        log(state, `${p.name} は相続で「${C()[card].name}」を脇に置き、屋敷トークンを載せた（以後、自分のターンの屋敷はこれを使用するアクションになる）。`);
        return state;
      }
      // 帝国：塩まき＝サプライの勝利点カード1枚を廃棄（山を選ぶ・強制）。廃棄はサプライから直接（Tomb は発火）。
      case 'SALT_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'salt_the_earth') return state;
        if (!anyVictorySupply(state)) { state.pending = null; return state; } // 終端保証（勝利点の山がゼロ）
        const id = action.card;
        if (!id || (state.supply[id] || 0) <= 0 || !isTypeSupply(state, id, 'victory')) return state;
        // 城の混合山（castles）＝一番上の実カードを廃棄（trashFromSupplyPile が supply と同期）。
        const trashed = trashFromSupplyPile(state, pd.player, id);
        if (!trashed) return state;
        log(state, `${state.players[pd.player].name} は塩まきでサプライの「${C()[trashed].name}」1枚を廃棄した。`);
        state.pending = null;
        return state;
      }
      // 帝国：宴会＝$5以下の勝利点でないカード1枚を獲得（強制）。
      case 'BANQUET_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'banquet') return state;
        if (!finishGain(state, pd, action.card, (cid) => banquetCanGain(state, cid), 'discard', '宴会で獲得した。')) return state;
        return state;
      }
      // 帝国：昇進＝手札のアクション1枚を廃棄してよい（may）→ 廃棄したら$6以下アクション獲得（強制）。
      case 'ADVANCE_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'advance' || pd.stage !== 'trash') return state;
        if (action.card == null) { state.pending = null; return state; } // 辞退（may）
        if (!DOM.isType(action.card, 'action') || !state.players[pd.player].hand.includes(action.card)) return state;
        if (!trashFromHand(state, pd.player, [action.card], 1, 'を昇進で廃棄した。')) return state;
        if (anyGainable(state, (cid) => advanceCanGain(state, cid) && !splitLocked(state, cid))) state.pending = { type: 'advance', stage: 'gain', player: pd.player };
        else state.pending = null; // $6以下アクションの候補が無ければ終端
        return state;
      }
      case 'ADVANCE_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'advance' || pd.stage !== 'gain') return state;
        if (!finishGain(state, pd, action.card, (cid) => advanceCanGain(state, cid), 'discard', '昇進で獲得した。')) return state;
        return state;
      }
      // 帝国：儀式＝手札1枚を廃棄（強制・手札があれば）→ そのコスト$1につき+1勝利点。
      case 'RITUAL_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'ritual') return state;
        const rp = state.players[pd.player];
        if (rp.hand.length === 0) { state.pending = null; return state; }
        const c = action.card;
        if (!c || !rp.hand.includes(c)) return state;
        if (!trashFromHand(state, pd.player, [c], 1, 'を儀式で廃棄した。')) return state;
        // 2025年2月エラッタ：`+1 VP per $1 it cost` → `it costs`（＝**廃棄した「後」の現在コスト**を参照する）。
        //   他の「廃棄したカードのコスト」参照（改築/拡張など）と同じ扱いになった。
        const cost = cardCost(state, c);
        if (cost > 0) { rp.vpTokens = (rp.vpTokens || 0) + cost; log(state, `${rp.name} は儀式で +${cost}勝利点（廃棄カードのコスト）。`); }
        state.pending = null;
        return state;
      }
      // 帝国：徴税＝サプライの山1つを選び、負債トークンを2個置く（強制）。
      case 'TAX_PILE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'tax_pile') return state;
        const raw = action.pile;
        if (!raw || NON_SUPPLY.has(raw) || (state.supply[raw] || 0) <= 0) return state;
        // 分割山の下段を選んでも上段キーに正規化して置く（読み取り側 triggerOnGain の pileKeyOf と一致＝負債の孤児化を防ぐ）。
        const id = pileKeyOf(state, raw);
        state.pileDebt = state.pileDebt || {};
        state.pileDebt[id] = (state.pileDebt[id] || 0) + 2;
        log(state, `${state.players[pd.player].name} は徴税：${(C()[id] && C()[id].name) || id}の山に負債トークンを2個置いた（計${state.pileDebt[id]}個）。`);
        state.pending = null;
        return state;
      }
      // 帝国：寄付＝集めた手札から好きな枚数を廃棄→残りをシャッフルして山札に戻し、5枚引く。その後 通常の開始時効果を続行。
      case 'DONATE_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'donate_trash') return state;
        const dp = state.players[pd.player];
        const toTrash = Array.isArray(action.cards) ? action.cards : [];
        let tn = 0;
        for (const c of toTrash) { if (removeOne(dp.hand, c)) { trashCard(state, pd.player, c); tn++; } }
        while (dp.hand.length) dp.discard.push(dp.hand.pop()); // 残りを捨て札へ
        reshuffleDeck(dp);                                     // シャッフルして山札に戻す（へそくり配置も一元処理）
        state.pending = null;
        draw(state, pd.player, 5);
        log(state, `${dp.name} は寄付：${tn}枚 を廃棄し、山札をシャッフルして5枚引いた。`);
        resolveDurationStartEffects(state, pd.player);         // 寄付の後で通常の開始時効果（持続ドロー/王子など）を続行
        return state;
      }
      // 帝国：併合＝捨て札から最大5枚を選んで捨て札に残し、残りを山札に混ぜてシャッフル→公領1枚を獲得。
      case 'ANNEX_KEEP': {
        const pd = state.pending;
        if (!pd || pd.type !== 'annex_keep') return state;
        const ap = state.players[pd.player];
        const keepReq = (Array.isArray(action.cards) ? action.cards : []).slice(0, 5);
        const rest = ap.discard.slice();
        const kept = [];
        for (const c of keepReq) { const i = rest.indexOf(c); if (i >= 0) { kept.push(c); rest.splice(i, 1); } }
        ap.discard = kept;                       // keep した分だけ捨て札に残す
        ap.deck = shuffle(ap.deck.concat(rest)); // 残りを山札に混ぜてシャッフル
        placeStash(ap);                          // へそくりの位置を一元処理
        log(state, `${ap.name} は併合：捨て札${kept.length}枚 を残し、${rest.length}枚 を山札に混ぜてシャッフルした。`);
        state.pending = null;
        gain(state, pd.player, 'duchy', 'discard'); // その後 公領1枚を獲得
        return state;
      }

      /* ---- フェーズ移行 ---- */
      case 'END_ACTION_PHASE': {
        if (state.pending) return state;
        if (t.phase !== 'action') return state;
        t.phase = 'buy';
        t.inStartPhase = false; // ルネサンス：ターン開始時効果はもう終わっている
        // 公式：「購入したら財宝を出せない」は**その購入フェイズ内**の制限。ヴィラ等でアクションフェイズに戻り、
        //   再び購入フェイズに入った場合は「購入フェイズの最初から」＝財宝を出し直せる（ロックを解除する）。
        t.treasuresLocked = false;
        t.afterActionCard = null; // 冒険：アクションフェイズを抜けたら法貨/御料車の呼び出し窓は閉じる
        // ルネサンス：探査／野外劇は「その購入フェイズ」単位＝購入フェイズに入り直すたびにリセット（ヴィラ対応）。
        t.bpGained = 0;
        t.pageantDone = false;
        /* 夜想曲：錯乱(Deluded)／嫉妬(Envious)＝**購入フェイズの開始時に「返す」ことで初めて発動**し、
           そのターンの残り全部に効く（持っているだけでは何も起きない＝最頻の事故）。
           `END_ACTION_PHASE` は1ターンに複数回走り得る（ヴィラ/騎兵）ので**毎回 返す判定をする**が、
           一度立った `t.cantBuyActions` / `t.enviousActive` は**同じターン中は下ろさない**（公式）。
           ＝購入フェイズ中に得た錯乱はその購入フェイズでは発動せず、次に購入フェイズへ入るときに返す。 */
        if (me.deluded) { me.deluded = false; t.cantBuyActions = true; log(state, `${me.name} は錯乱を返した（このターンはアクションカードを購入できない）。`); }
        if (me.envious) { me.envious = false; t.enviousActive = true; log(state, `${me.name} は嫉妬を返した（このターン、銀貨と金貨は $1 しか生まない）。`); }
        // 冒険：-$1トークンを消化（購入フェイズ開始時に食い込み分へ変換。財宝を出すとそのコインに食い込む）。
        if (me.minusCoin) { t.coinPenalty = (t.coinPenalty || 0) + 1; me.minusCoin = false; log(state, `${me.name} は -$1トークンを支払う（このターンのコイン $1分）。`); applyCoinPenalty(state); }
        // ルネサンス：宝箱（Treasure Chest・アーティファクト）＝**購入フェイズの開始時**に金貨1枚を獲得（強制）。
        //   公式（2022エラッタ）：「購入フェイズの開始時」は1ターンに複数回起こり得る（ヴィラでアクションフェイズに
        //   戻り再び購入フェイズに入るたびに再発動する）＝1ターン1回のフラグを立てない。
        if (hasArtifact(state, pi, 'treasure_chest')) {
          if (gain(state, pi, 'gold', 'discard')) log(state, `${me.name} は宝箱で金貨1枚を獲得した（購入フェイズ開始時）。`);
        }
        // 帝国：闘技場＝購入フェイズ開始時、手札のアクション1枚を捨ててよい（捨てたら +2勝利点）。
        maybeArena(state, pi);
        /* 同盟：購入フェイズ開始時に働く Ally（銀行家連盟＝自動／発明家の家族・市場の町・平和的教団・木工ギルド＝窓）。
           窓は startQueue に積む＝闘技場が pending を立てていても、それを解決してから reduce 末尾の安全網が開く。 */
        allyBuyPhaseStart(state, pi);
        return state;
      }
      case 'END_TURN': {
        if (state.pending) return state;
        // 夜想曲：夜フェイズ中の「ターン終了」＝夜フェイズを終えて片付けへ進む（購入フェイズ終了時の効果は済んでいる）。
        if (t.phase === 'night') { endBuyTailBaths(state, pi); return state; }
        if (t.phase !== 'buy') return state;
        // 冒険：ワイン商＝購入フェイズ終了時、未使用$2以上が残っていれば酒場マットから捨ててよい（呼び出し窓）。
        if (t.coins >= 2 && (me.tavern || []).includes('wine_merchant')) {
          state.pending = { type: 'wine_merchant', player: pi };
          return state;
        }
        endBuyTail(state);
        return state;
      }

      /* ---- 帝国：闘技場（Arena）＝購入フェイズ開始時にアクション1枚を捨てて +2勝利点 ---- */
      case 'ARENA_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'arena') return state;
        const p = state.players[pd.player];
        if (action.card == null) { state.pending = null; return state; } // 捨てない
        const card = action.card;
        if (p.hand.indexOf(card) < 0 || !DOM.isType(card, 'action')) return state; // 不正な指定は据え置き
        removeOne(p.hand, card); p.discard.push(card);
        const got = takeLandmarkVP(state, pd.player, 'arena', 2);
        log(state, `${p.name} は闘技場で「${C()[card].name}」を捨て +${got}勝利点。`);
        state.pending = null;
        return state;
      }
      /* ---- 帝国：峠（Mountain Pass）＝最初の属州獲得後の逐次入札 ---- */
      case 'MOUNTAIN_PASS_BID': {
        const pd = state.pending;
        if (!pd || pd.type !== 'mountain_pass_bid') return state;
        let amount = Math.floor(Number(action.amount) || 0);
        if (amount < 0) amount = 0;
        if (amount > 40) amount = 40;
        pd.bids = pd.bids || {};
        pd.bids[pd.player] = amount;
        if (amount > (pd.highest || 0)) { pd.highest = amount; pd.highBidder = pd.player; } // 同額は先着（更新しない）
        log(state, `${state.players[pd.player].name} は峠の競りで ${amount}負債 を入札した。`);
        pd.idx = (pd.idx || 0) + 1;
        if (pd.idx < pd.order.length) { pd.player = pd.order[pd.idx]; return state; } // 次の入札者へ
        // 全員入札完了 → 最高額の入札者が +8勝利点＋同額の負債
        if (pd.highBidder != null && pd.highest > 0) {
          const w = state.players[pd.highBidder];
          w.vpTokens = (w.vpTokens || 0) + 8;
          w.debt = (w.debt || 0) + pd.highest;
          log(state, `${w.name} は峠の競りに勝ち +8勝利点／負債${pd.highest} を得た。`);
        } else {
          log(state, `峠の競りは全員0で誰も勝たなかった。`);
        }
        state.pending = null;
        endBuyTailTravellers(state, state.turn.active); // 競り後、通常の手番終了処理（トラベラー交換→策謀→片付け）へ
        return state;
      }

      /* ---- 地下貯蔵庫：捨てて引く ---- */
      case 'CELLAR_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'cellar') return state;
        const p = state.players[pd.player];
        const discardCards = Array.isArray(action.cards) ? action.cards : [];
        let count = 0;
        discardCards.forEach((c) => {
          if (removeOne(p.hand, c)) {
            p.discard.push(c);
            count++;
          }
        });
        draw(state, pd.player, count);
        if (count) log(state, `${p.name} は ${count}枚 捨てて ${count}枚 引いた。`);
        state.pending = null;
        return state;
      }

      /* ---- 民兵：手札3枚まで捨てる / 堀で無効化 ---- */
      case 'MILITIA_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'militia') return state;
        const p = state.players[pd.player];
        const discardCards = Array.isArray(action.cards) ? action.cards : [];
        // 指定カードがすべて手札にあり、捨てた後ちょうど3枚になること
        const target = Math.min(3, p.hand.length);
        if (p.hand.length - discardCards.length !== target) return state;
        const handCopy = p.hand.slice();
        for (const c of discardCards) {
          if (!removeOne(handCopy, c)) return state; // 手札に無いカード指定は拒否
        }
        discardCards.forEach((c) => {
          removeOne(p.hand, c);
          p.discard.push(c);
        });
        log(state, `${p.name} は手札を ${discardCards.length}枚 捨てた。`);
        advanceMilitia(state, pd);
        return state;
      }
      case 'MOAT_REVEAL': {
        const pd = state.pending;
        if (!pd) return state;
        const p = state.players[pd.player];
        if (p.hand.indexOf('moat') < 0) return state;
        // 堀で無効化できるのは「アタックを受ける側の反応ステップ」だけ。
        // 段階アタック(詐欺師など)の gain ステップ(攻撃側が操作)では撃てない。
        if (!isAttackReactPending(pd)) return state;
        log(state, `${p.name} は「堀」を公開し、アタックを無効化した。`);
        ATTACKS[pd.type].onMoat(state, pd); // 登録表を引いて「この被害者を飛ばして次へ」
        return state;
      }

      /* ---- 鉱山 ---- */
      case 'MINE_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'mine' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        if (action.card == null) {
          // 廃棄しない → 終了
          state.pending = null;
          return state;
        }
        const card = action.card;
        if (!isTreasureFor(state, card) || p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card); trashCard(state, pd.player, card);
        log(state, `${p.name} は「${C()[card].name}」を廃棄した。`);
        const ref = costOf(state, card); // 廃棄した財宝のコスト3成分（ポーション費用の財宝＝賢者の石なら +$3 かつ同ポーション）
        const mMax = ref.coin + 3;
        // 獲得できる財宝が無ければ選択待ちにせず終了（デッドロック回避）
        state.pending = anyGainable(state, (id) => costUpTo(state, id, mMax, ref) && isTreasureFor(state, id))
          ? { type: 'mine', stage: 'gain', player: pd.player, maxCost: mMax, pot: ref.pot, debt: ref.debt }
          : null;
        return state;
      }
      case 'MINE_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'mine' || pd.stage !== 'gain') return state;
        finishGain(state, pd, action.card, (id) => costUpTo(state, id, pd.maxCost, pd) && isTreasureFor(state, id), 'hand', '手札に獲得した。');
        return state;
      }

      /* ---- 改築 ---- */
      case 'REMODEL_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'remodel' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card); trashCard(state, pd.player, card);
        log(state, `${p.name} は「${C()[card].name}」を廃棄した。`);
        const ref = costOf(state, card);
        const rMax = ref.coin + 2;
        // 獲得できるカードが無ければ選択待ちにせず終了（デッドロック回避）
        state.pending = anyGainable(state, (id) => costUpTo(state, id, rMax, ref))
          ? { type: 'remodel', stage: 'gain', player: pd.player, maxCost: rMax, pot: ref.pot, debt: ref.debt }
          : null;
        return state;
      }
      case 'REMODEL_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'remodel' || pd.stage !== 'gain') return state;
        finishGain(state, pd, action.card, (id) => costUpTo(state, id, pd.maxCost, pd), 'discard', '獲得した。');
        return state;
      }

      /* ---- 工房 ---- */
      case 'WORKSHOP_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'workshop') return state;
        finishGain(state, pd, action.card, (id) => costUpTo(state, id, 4), 'discard', '獲得した。');
        return state;
      }

      /* ===== 拡張: 陰謀 の選択解決 ===== */

      /* ---- 中庭：手札1枚を山札の上へ ---- */
      case 'COURTYARD_PUT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'courtyard') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card);
        p.deck.unshift(card);
        log(state, `${p.name} は手札1枚を山札の上に置いた。`);
        state.pending = null;
        return state;
      }

      /* ---- 従者：4つから異なる2つ ---- */
      case 'PAWN_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'pawn') return state;
        const valid = ['card', 'action', 'buy', 'coin'];
        const ch = Array.isArray(action.choices)
          ? action.choices.filter((c, i, a) => valid.includes(c) && a.indexOf(c) === i) : [];
        if (ch.length !== 2) return state; // 異なる2つ必須
        ch.forEach((c) => {
          if (c === 'card') draw(state, pd.player, 1);
          else if (c === 'action') addActions(t, 1);
          else if (c === 'buy') t.buys += 1;
          else if (c === 'coin') addCoins(state, 1);
        });
        log(state, `${state.players[pd.player].name} は従者の効果を選んだ。`);
        state.pending = null;
        return state;
      }

      /* ---- 執事：選択 / 廃棄2 ---- */
      case 'STEWARD_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'steward' || pd.stage !== 'choose') return state;
        const p = state.players[pd.player];
        if (action.choice === 'cards') { draw(state, pd.player, 2); log(state, `${p.name} は執事で2枚引いた。`); state.pending = null; }
        else if (action.choice === 'coins') { addCoins(state, 2); log(state, `${p.name} は執事で +2 コイン。`); state.pending = null; }
        else if (action.choice === 'trash') {
          state.pending = p.hand.length > 0 ? { type: 'steward', stage: 'trash', player: pd.player } : null;
        }
        return state;
      }
      case 'STEWARD_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'steward' || pd.stage !== 'trash') return state;
        const want = Math.min(2, state.players[pd.player].hand.length);
        if (!trashFromHand(state, pd.player, action.cards, want, '廃棄した。')) return state;
        state.pending = null;
        return state;
      }

      /* ---- 願いの井戸：宣言して山札の上を公開 ---- */
      case 'WISHING_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'wishing') return state;
        const p = state.players[pd.player];
        const named = action.card;
        if (!C()[named]) return state;
        if (p.deck.length === 0 && p.discard.length > 0) { reshuffleDeck(p); }
        const top = p.deck.length ? p.deck[0] : null;
        if (top != null) {
          reveal(state, pd.player, [top], '願いの井戸で山札の上を公開');
          log(state, `${p.name} は「${C()[named].name}」を宣言。山札の上は「${C()[top].name}」。`);
          if (top === named) { p.hand.push(p.deck.shift()); log(state, '当たり！ 手札に加えた。'); }
        } else {
          log(state, `${p.name} は「${C()[named].name}」を宣言したが山札が空だった。`);
        }
        state.pending = null;
        return state;
      }

      /* ---- 男爵：屋敷を捨てて+4 / 屋敷を獲得 ---- */
      case 'BARON_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'baron') return state;
        const p = state.players[pd.player];
        if (action.discard && p.hand.indexOf('estate') >= 0) {
          removeOne(p.hand, 'estate');
          p.discard.push('estate');
          addCoins(state, 4);
          log(state, `${p.name} は屋敷を捨てて +4 コイン。`);
        } else {
          if (gain(state, pd.player, 'estate', 'discard')) log(state, `${p.name} は屋敷を獲得した。`);
          else log(state, `${p.name} は屋敷を獲得しようとしたが山が空だった。`);
        }
        state.pending = null;
        return state;
      }

      /* ---- 鉄工所：コスト4以下を獲得＋種別ボーナス ---- */
      case 'IRONWORKS_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'ironworks') return state;
        const card = action.card;
        const canGain = (id) => costUpTo(state, id, 4);
        if (card == null) {
          if (anyGainable(state, canGain)) return state; // 獲得は強制
          state.pending = null; return state;
        }
        if (!canGain(card)) return state;
        gain(state, pd.player, card, 'discard');
        log(state, `${state.players[pd.player].name} は「${C()[card].name}」を獲得した。`);
        // 該当する種別すべてのボーナス（後宮=財宝+勝利点 等は両方）
        if (DOM.isType(card, 'action')) addActions(t, 1);
        if (isTreasureFor(state, card)) addCoins(state, 1);
        if (DOM.isType(card, 'victory')) draw(state, pd.player, 1);
        state.pending = null;
        return state;
      }

      /* ---- 鉱山の村：場のこれを廃棄して+2コイン（任意）---- */
      case 'MINING_VILLAGE_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'mining_village') return state;
        const p = state.players[pd.player];
        if (action.trash && removeOne(p.inPlay, 'mining_village')) {
          trashCard(state, pd.player, 'mining_village');
          addCoins(state, 2);
          log(state, `${p.name} は鉱山の村を廃棄して +2 コイン。`);
        }
        state.pending = null;
        return state;
      }

      /* ---- 貴族：+3カード or +2アクション ---- */
      case 'NOBLES_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'nobles') return state;
        if (action.choice === 'actions') addActions(t, 2);
        else draw(state, pd.player, 3);
        log(state, `${state.players[pd.player].name} は貴族の効果を選んだ。`);
        state.pending = null;
        return state;
      }

      /* ---- 拷問人（アタック）：手札2枚を捨てる or 呪いを手札に ---- */
      case 'TORTURER_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'torturer') return state;
        const p = state.players[pd.player];
        if (action.choice === 'curse') {
          if ((state.supply.curse || 0) > 0) { gain(state, pd.player, 'curse', 'hand'); log(state, `${p.name} は呪いを手札に受け取った。`); }
          else log(state, `${p.name} は呪いを受けようとしたが、呪いの山が空だった。`);
        } else {
          const want = Math.min(2, p.hand.length);
          const cards = Array.isArray(action.cards) ? action.cards : [];
          if (cards.length !== want) return state;
          const handCopy = p.hand.slice();
          for (const c of cards) if (!removeOne(handCopy, c)) return state;
          cards.forEach((c) => { removeOne(p.hand, c); p.discard.push(c); });
          log(state, `${p.name} は手札 ${cards.length}枚 を捨てた。`);
        }
        advanceAttack(state, pd);
        return state;
      }

      /* ---- 詐欺師：犠牲者の反応 / 攻撃側が獲得物を選ぶ ---- */
      case 'SWINDLER_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'swindler' || pd.stage !== 'react') return state;
        // 反応者が堀を出さずに通す（堀を出す場合は MOAT_REVEAL 経由）
        swindlerTrash(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'SWINDLER_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'swindler' || pd.stage !== 'gain') return state;
        const card = action.card;
        const canGain = (id) => costExact(state, id, pd.cost, pd.pot, pd.debt); // 3成分一致（負債コスト札の押し付けを塞ぐ）
        if (card == null || !canGain(card)) return state; // 候補ありなら必ず選ぶ
        gain(state, pd.victim, card, 'discard');
        log(state, `${state.players[pd.victim].name} は「${C()[card].name}」を獲得した（詐欺師）。`);
        swindlerEnterVictim(state, pd.source, pd.queue);
        return state;
      }

      /* ---- 仮面舞踏会：各自が左隣へ1枚渡す→使用者は任意で1枚廃棄 ---- */
      /* ---- 魔女：反応せず受ける（→呪い獲得）---- */
      case 'WITCH_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'witch' || pd.stage !== 'react') return state;
        witchCurse(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      /* ---- 役人：反応せず受ける / 勝利点を山札の上へ ---- */
      case 'BUREAUCRAT_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'bureaucrat' || pd.stage !== 'react') return state;
        bureaucratApply(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'BUREAUCRAT_PUT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'bureaucrat' || pd.stage !== 'put') return state;
        const v = state.players[pd.victim];
        const card = action.card;
        if (v.hand.indexOf(card) < 0 || !DOM.isType(card, 'victory')) return state; // 勝利点のみ
        removeOne(v.hand, card);
        v.deck.unshift(card);
        reveal(state, pd.victim, [card], '役人で公開し山札の上へ');
        log(state, `${v.name} は「${C()[card].name}」を山札の上に置いた（役人）。`);
        bureaucratEnterVictim(state, pd.source, pd.queue);
        return state;
      }

      /* ---- 玉座の間：選んだアクションを2回使う ---- */
      case 'THRONE_CHOOSE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'throne') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0 || !DOM.isType(card, 'action')) return state;
        removeOne(p.hand, card);
        p.inPlay.push(card);
        t.actionsPlayed = (t.actionsPlayed || 0) + 1;
        state.pending = null;
        log(state, `${p.name} は玉座の間で「${C()[card].name}」を使った（1回目）。`);
        applyEffect(state, card, pd.player);     // 1回目
        state.replay = state.replay || [];
        state.replay.push({ player: pd.player, card }); // 2回目は pending 解消後に runReplays が適用
        return state;
      }

      /* ---- 書庫：引いたアクションを脇に置く/手札に ---- */
      case 'LIBRARY_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'library') return state;
        const p = state.players[pd.player];
        const aside = pd.aside.slice();
        if (action.setAside) {
          if (removeOne(p.hand, pd.card)) { aside.push(pd.card); log(state, `${p.name} は「${C()[pd.card].name}」を脇に置いた（書庫）。`); }
        }
        libraryStep(state, pd.player, aside);
        return state;
      }

      /* ---- 密偵：公開した山札の上を捨てる/戻す ---- */
      case 'SPY_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'spy' || pd.stage !== 'react') return state;
        spyReveal(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'SPY_DECIDE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'spy' || pd.stage !== 'decide') return state;
        const tp = state.players[pd.victim];
        if (action.discard && tp.deck.length > 0) {
          const c = tp.deck.shift(); tp.discard.push(c);
          log(state, `${tp.name} は山札の上の「${C()[c].name}」を捨てた（密偵）。`);
        } else {
          log(state, `${tp.name} は山札の上をそのままにした（密偵）。`);
        }
        spyEnterTarget(state, pd.source, pd.queue);
        return state;
      }

      /* ---- 泥棒：財宝1枚を廃棄→獲得してよい ---- */
      case 'THIEF_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'thief' || pd.stage !== 'react') return state;
        thiefReveal(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'THIEF_PICK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'thief' || pd.stage !== 'pick') return state;
        const v = state.players[pd.victim];
        const card = action.card;
        if (pd.treasures.indexOf(card) < 0) return state; // 公開された財宝のみ
        // 選んだ財宝を廃棄、その他の公開札は犠牲者の捨て札へ
        const rest = pd.revealed.slice();
        const i = rest.indexOf(card); rest.splice(i, 1);
        trashCard(state, pd.victim, card);
        rest.forEach((c) => v.discard.push(c));
        log(state, `${v.name} の「${C()[card].name}」を廃棄した（泥棒）。`);
        state.pending = { type: 'thief', stage: 'gain', player: pd.source, source: pd.source, victim: pd.victim, trashed: card, queue: pd.queue };
        return state;
      }
      case 'THIEF_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'thief' || pd.stage !== 'gain') return state;
        if (action.take && removeOne(state.trash, pd.trashed)) {
          // pending 保持中に呼ぶ＝入れ子の獲得時対話（物見やぐら等）は抑止し、自動の獲得時効果と支配の振り分けだけを効かせる
          //   （この後 thiefEnterVictim が次の pending を立てるため）。
          gainFromOutside(state, pd.source, pd.trashed, 'discard');
          log(state, `${state.players[pd.source].name} は廃棄された「${C()[pd.trashed].name}」を獲得した（泥棒）。`);
        }
        thiefEnterVictim(state, pd.source, pd.queue);
        return state;
      }

      /* ---- 祝宴：コスト5以下を獲得 ---- */
      case 'FEAST_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'feast') return state;
        finishGain(state, pd, action.card, (id) => costUpTo(state, id, 5), 'discard', '獲得した（祝宴）。');
        return state;
      }

      /* ---- 金貸し：銅貨を廃棄して +3 ---- */
      case 'MONEYLENDER_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'moneylender') return state;
        const p = state.players[pd.player];
        if (action.trash && removeOne(p.hand, 'copper')) {
          trashCard(state, pd.player, 'copper');
          addCoins(state, 3);
          log(state, `${p.name} は銅貨を廃棄して +3 コイン（金貸し）。`);
        }
        state.pending = null;
        return state;
      }
      /* ---- 宰相：山札を捨て札にしてもよい ---- */
      case 'CHANCELLOR_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'chancellor') return state;
        const p = state.players[pd.player];
        if (action.discardDeck && p.deck.length > 0) {
          p.discard.push(...p.deck); p.deck = [];
          log(state, `${p.name} は山札をすべて捨て札にした（宰相）。`);
        }
        state.pending = null;
        return state;
      }
      /* ---- 礼拝堂：手札を最大4枚廃棄 ---- */
      case 'CHAPEL_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'chapel') return state;
        const p = state.players[pd.player];
        const cards = (Array.isArray(action.cards) ? action.cards : []).slice(0, 4);
        const handCopy = p.hand.slice();
        for (const c of cards) if (!removeOne(handCopy, c)) return state; // 手札に無い指定は拒否
        let n = 0;
        cards.forEach((c) => { if (removeOne(p.hand, c)) { trashCard(state, pd.player, c); n++; } });
        if (n) log(state, `${p.name} は手札 ${n}枚 を廃棄した（礼拝堂）。`);
        state.pending = null;
        return state;
      }

      /* ---- 秘密の小部屋 ---- */
      // アクション: 捨てた枚数だけ +1コイン
      case 'SECRET_CHAMBER_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'secret_chamber' || pd.stage !== 'discard') return state;
        const p = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        const handCopy = p.hand.slice();
        for (const c of cards) if (!removeOne(handCopy, c)) return state; // 手札に無い指定は拒否
        let n = 0;
        cards.forEach((c) => { if (removeOne(p.hand, c)) { p.discard.push(c); n++; } });
        addCoins(state, n);
        log(state, `${p.name} は ${n}枚 捨てて +${n} コイン（秘密の小部屋）。`);
        state.pending = null;
        return state;
      }
      // リアクション: 他人のアタックに対し公開→+2カード→2枚を山札の上に戻す。アタックは無効化しない。
      case 'SECRET_CHAMBER_REVEAL': {
        const pd = state.pending;
        if (!isAttackReactPending(pd) || pd.reacted) return state; // reacted ガード（無限公開を防ぐ）
        const p = state.players[pd.player];
        if (p.hand.indexOf('secret_chamber') < 0) return state;
        draw(state, pd.player, 2);
        log(state, `${p.name} は秘密の小部屋を公開して2枚引いた。`);
        // 元のアタックpendingを reacted=true で保存し、戻し終えたら復帰
        state.pending = { type: 'secret_chamber_putback', player: pd.player, saved: Object.assign({}, pd, { reacted: true }) };
        return state;
      }
      case 'SECRET_CHAMBER_PUTBACK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'secret_chamber_putback') return state;
        const p = state.players[pd.player];
        const want = Math.min(2, p.hand.length);
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (cards.length !== want) return state;
        const handCopy = p.hand.slice();
        for (const c of cards) if (!removeOne(handCopy, c)) return state;
        cards.forEach((c) => removeOne(p.hand, c));
        for (let i = cards.length - 1; i >= 0; i--) p.deck.unshift(cards[i]); // 先頭が一番上
        log(state, `${p.name} は手札2枚を山札の上に戻した。`);
        state.pending = pd.saved; // 元のアタック解決へ復帰（reacted=true で再公開不可）
        return state;
      }

      case 'MASQUERADE_PASS': {
        const pd = state.pending;
        if (!pd || pd.type !== 'masquerade' || pd.stage !== 'pass') return state;
        const cur = pd.order[pd.pos];
        const card = action.card;
        if (state.players[cur].hand.indexOf(card) < 0) return state;
        const picks = Object.assign({}, pd.picks); picks[cur] = card;
        const nextPos = pd.pos + 1;
        if (nextPos < pd.order.length) {
          state.pending = { type: 'masquerade', stage: 'pass', player: pd.order[nextPos], source: pd.source, order: pd.order, pos: nextPos, picks };
        } else {
          masqueradeApplyPasses(state, pd.order, picks);
          masqueradeAfterPass(state, pd.source);
        }
        return state;
      }
      case 'MASQUERADE_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'masquerade' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (card != null) {
          if (p.hand.indexOf(card) < 0) return state;
          removeOne(p.hand, card); trashCard(state, pd.player, card);
          log(state, `${p.name} は「${C()[card].name}」を廃棄した。`);
        } else {
          log(state, `${p.name} は廃棄しなかった。`);
        }
        state.pending = null;
        return state;
      }

      /* ---- 手先：攻撃側の選択（+2コイン or 全員引き直し）---- */
      case 'MINION_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'minion' || pd.stage !== 'choose') return state;
        const p = state.players[pd.player];
        if (action.choice === 'coins') {
          addCoins(state, 2);
          log(state, `${p.name} は手先で +2 コイン。`);
          state.pending = null;
        } else if (action.choice === 'attack') {
          p.discard.push(...p.hand); p.hand = [];
          draw(state, pd.player, 4);
          log(state, `${p.name} は手札を捨てて4枚引いた（手先）。`);
          // 手札5枚以上の他プレイヤーも引き直し（堀で無効化可）
          const vics = [];
          for (let k = 1; k < state.players.length; k++) vics.push((pd.player + k) % state.players.length);
          minionAttackEnterVictim(state, pd.player, vics);
        } else {
          return state;
        }
        return state;
      }
      case 'MINION_ATTACK_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'minion_attack' || pd.stage !== 'react') return state;
        minionAttackApply(state, pd.source, pd.victim, pd.queue);
        return state;
      }

      /* ---- 破壊工作員：犠牲者の反応 / 任意で格下げ獲得 ---- */
      case 'SABOTEUR_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'saboteur' || pd.stage !== 'react') return state;
        saboteurReveal(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'SABOTEUR_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'saboteur' || pd.stage !== 'gain') return state;
        const card = action.card;
        if (card != null) {
          // 獲得は任意。コスト上限を超える/在庫切れの指定は無視して再選択
          if (!costUpTo(state, card, pd.maxCost, pd)) return state;
          gain(state, pd.victim, card, 'discard');
          log(state, `${state.players[pd.victim].name} は「${C()[card].name}」を獲得した（破壊工作員）。`);
        } else {
          log(state, `${state.players[pd.victim].name} は獲得しなかった。`);
        }
        saboteurEnterVictim(state, pd.source, pd.queue);
        return state;
      }

      /* ---- 交易場：手札2枚廃棄→銀貨を手札に ---- */
      case 'TRADING_POST_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'trading_post') return state;
        const p = state.players[pd.player];
        const want = Math.min(2, p.hand.length);
        if (!trashFromHand(state, pd.player, action.cards, want, '廃棄した。')) return state;
        // 2枚廃棄できたときだけ銀貨を手札に獲得（公式: trash 2 → gain Silver to hand）
        if (want === 2 && gain(state, pd.player, 'silver', 'hand')) {
          log(state, `${p.name} は銀貨を手札に獲得した。`);
        }
        state.pending = null;
        return state;
      }

      /* ---- 斥候：非勝利点カードを好きな順で山札の上へ戻す ---- */
      case 'SCOUT_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'scout') return state;
        const p = state.players[pd.player];
        const order = Array.isArray(action.order) ? action.order : [];
        // order は pd.cards の並べ替え（同じ多重集合）でなければ拒否
        const a = pd.cards.slice().sort(), b = order.slice().sort();
        if (a.length !== b.length || a.some((c, i) => c !== b[i])) return state;
        // order[0] が一番上になるよう、後ろから unshift
        for (let i = order.length - 1; i >= 0; i--) p.deck.unshift(order[i]);
        log(state, `${p.name} は山札の上を並べ替えた。`);
        state.pending = null;
        return state;
      }

      /* ---- 改良：1枚廃棄→ちょうど+1コストを獲得 ---- */
      case 'UPGRADE_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'upgrade' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card); trashCard(state, pd.player, card);
        log(state, `${p.name} は「${C()[card].name}」を廃棄した。`);
        const ref = costOf(state, card);
        const exact = ref.coin + 1;
        // ちょうど exact コストの獲得候補が無ければ獲得なしで終了（デッドロック回避）。非サプライ（トラベラー成長先等）は除外。
        // 「ちょうど$1多い」＝ポーション費用/負債コストは廃棄した札と一致していること（公式のコスト比較は成分別）。
        state.pending = anyGainable(state, (id) => costExact(state, id, exact, ref.pot, ref.debt))
          ? { type: 'upgrade', stage: 'gain', player: pd.player, exactCost: exact, pot: ref.pot, debt: ref.debt }
          : null;
        if (!state.pending) log(state, `ちょうど ${exact} コストのカードが無く、獲得できなかった。`);
        return state;
      }
      case 'UPGRADE_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'upgrade' || pd.stage !== 'gain') return state;
        finishGain(state, pd, action.card, (id) => costExact(state, id, pd.exactCost, pd.pot, pd.debt), 'discard', '獲得した。');
        return state;
      }

      /* ===== 基本セット 第二版 の選択解決 ===== */
      /* ---- 前駆者：捨て札1枚を山札の上へ（任意）---- */
      case 'HARBINGER_PUT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'harbinger') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (card != null && removeOne(p.discard, card)) {
          p.deck.unshift(card);
          log(state, `${p.name} は捨て札の「${C()[card].name}」を山札の上に置いた（前駆者）。`);
        }
        state.pending = null;
        return state;
      }
      /* ---- 家臣：捨てたアクションを使う/使わない ---- */
      case 'VASSAL_PLAY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'vassal') return state;
        const p = state.players[pd.player];
        state.pending = null;
        if (action.play && removeOne(p.discard, pd.card)) {
          p.inPlay.push(pd.card);
          t.actionsPlayed = (t.actionsPlayed || 0) + 1;
          log(state, `${p.name} は家臣で「${C()[pd.card].name}」を使った。`);
          applyEffect(state, pd.card, pd.player); // 別の選択待ちが立つこともある
        }
        return state;
      }
      /* ---- 密猟者：空の山1つにつき手札1枚を捨てる ---- */
      case 'POACHER_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'poacher') return state;
        if (!discardFromHand(state, pd.player, action.cards, pd.need, '捨てた（密猟者）。')) return state;
        state.pending = null;
        return state;
      }
      /* ---- 山賊：犠牲者の反応 / 廃棄する財宝を選ぶ ---- */
      case 'BANDIT_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'bandit' || pd.stage !== 'react') return state;
        banditReveal(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'BANDIT_PICK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'bandit' || pd.stage !== 'pick') return state;
        const v = state.players[pd.victim];
        const card = action.card;
        if (pd.cands.indexOf(card) < 0) return state;
        const rest = pd.revealed.slice();
        rest.splice(rest.indexOf(card), 1);
        trashCard(state, pd.victim, card);
        rest.forEach((c) => v.discard.push(c));
        log(state, `${v.name} は「${C()[card].name}」を廃棄した（山賊）。`);
        banditEnterVictim(state, pd.source, pd.queue);
        return state;
      }
      /* ---- 衛兵：上2枚を 廃棄/捨て/山札の上 に振り分ける ---- */
      case 'SENTRY_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'sentry') return state;
        const p = state.players[pd.player];
        const tr = Array.isArray(action.trash) ? action.trash : [];
        const di = Array.isArray(action.discard) ? action.discard : [];
        const top = Array.isArray(action.top) ? action.top : [];
        const all = tr.concat(di, top).slice().sort();
        const want = pd.cards.slice().sort();
        if (all.length !== want.length || all.some((c, i) => c !== want[i])) return state; // 同じ多重集合のみ
        tr.forEach((c) => trashCard(state, pd.player, c));
        di.forEach((c) => p.discard.push(c));
        for (let i = top.length - 1; i >= 0; i--) p.deck.unshift(top[i]); // top[0] が一番上
        if (tr.length) log(state, `${p.name} は ${tr.length}枚 廃棄した（衛兵）。`);
        if (di.length) log(state, `${p.name} は ${di.length}枚 捨てた（衛兵）。`);
        state.pending = null;
        return state;
      }
      /* ---- 職人：コスト5以下を手札に獲得→手札1枚を山札の上へ ---- */
      case 'ARTISAN_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'artisan' || pd.stage !== 'gain') return state;
        const card = action.card;
        const canGain = (id) => costUpTo(state, id, 5);
        if (card == null || !canGain(card)) return state; // 獲得は強制
        gain(state, pd.player, card, 'hand');
        log(state, `${state.players[pd.player].name} は「${C()[card].name}」を手札に獲得した（職人）。`);
        state.pending = { type: 'artisan', stage: 'put', player: pd.player };
        return state;
      }
      case 'ARTISAN_PUT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'artisan' || pd.stage !== 'put') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card);
        p.deck.unshift(card);
        log(state, `${p.name} は手札1枚を山札の上に置いた（職人）。`);
        state.pending = null;
        return state;
      }

      /* ===== 陰謀 第二版 の選択解決 ===== */
      /* ---- 廷臣：手札1枚を公開→種類数だけ効果を選ぶ ---- */
      case 'COURTIER_REVEAL': {
        const pd = state.pending;
        if (!pd || pd.type !== 'courtier' || pd.stage !== 'reveal') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        reveal(state, pd.player, [card], '廷臣で手札を公開');
        const nTypes = (C()[card].types || []).length;
        const n = Math.min(nTypes, 4);
        log(state, `${p.name} は「${C()[card].name}」を公開した（種類 ${nTypes}）。`);
        state.pending = { type: 'courtier', stage: 'choose', player: pd.player, n, card };
        return state;
      }
      case 'COURTIER_CHOOSE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'courtier' || pd.stage !== 'choose') return state;
        const valid = ['action', 'buy', 'coin', 'gold'];
        const ch = Array.isArray(action.choices)
          ? action.choices.filter((c, i, a) => valid.includes(c) && a.indexOf(c) === i) : [];
        if (ch.length !== pd.n) return state; // 異なる n 個を選ぶ
        ch.forEach((c) => {
          if (c === 'action') addActions(t, 1);
          else if (c === 'buy') t.buys += 1;
          else if (c === 'coin') addCoins(state, 3);
          else if (c === 'gold') { if (gain(state, pd.player, 'gold', 'discard')) log(state, `${state.players[pd.player].name} は金貨を獲得した（廷臣）。`); }
        });
        log(state, `${state.players[pd.player].name} は廷臣の効果を選んだ。`);
        state.pending = null;
        return state;
      }

      /* ---- 外交官（リアクション）：アタック時に公開→2枚引き3枚捨てる ---- */
      case 'DIPLOMAT_REVEAL': {
        const pd = state.pending;
        if (!isAttackReactPending(pd) || pd.diplomatReacted) return state;
        const p = state.players[pd.player];
        if (!p.hand.includes('diplomat') || p.hand.length < 5) return state;
        draw(state, pd.player, 2);
        log(state, `${p.name} は外交官を公開して2枚引いた。`);
        // 元のアタック反応ステップを diplomatReacted=true で退避し、3枚捨ててから復帰
        state.pending = { type: 'diplomat_discard', player: pd.player, saved: Object.assign({}, pd, { diplomatReacted: true }) };
        return state;
      }
      case 'DIPLOMAT_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'diplomat_discard') return state;
        const want = Math.min(3, state.players[pd.player].hand.length);
        if (!discardFromHand(state, pd.player, action.cards, want, '捨てた（外交官）。')) return state;
        state.pending = pd.saved; // 元のアタック反応ステップへ戻る
        return state;
      }

      /* ---- 待ち伏せ：サプライのアクションを廃棄 / 廃棄置場からアクションを獲得 ---- */
      case 'LURKER_CHOOSE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'lurker' || pd.stage !== 'choose') return state;
        if (action.choice === 'trash') {
          // ゲートと受理（LURKER_TRASH）は同じ述語＝gainableBase（非サプライ・ロック中の分割山下段・在庫切れを除外）。
          //   片方だけだと「候補ありと判定→受理が拒否」で pending が閉じない（CPU無限ループ／人間が詰む）。
          const canTrash = (id) => gainableBase(state, id) && isTypeSupply(state, id, 'action');
          state.pending = Object.keys(state.supply).some(canTrash)
            ? { type: 'lurker', stage: 'trash', player: pd.player } : null;
        } else if (action.choice === 'gain') {
          state.pending = state.trash.some((id) => DOM.isType(id, 'action'))
            ? { type: 'lurker', stage: 'gain', player: pd.player } : null;
        } else return state;
        return state;
      }
      case 'LURKER_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'lurker' || pd.stage !== 'trash') return state;
        const card = action.card;
        // 非サプライ（賞品/トラベラー成長先/戦利品）とロック中の分割山下段は「サプライの山」ではない＝対象外。
        if (!gainableBase(state, card) || !isTypeSupply(state, card, 'action')) return state;
        const trashed = trashFromSupplyPile(state, pd.player, card); // 混合山は一番上の実カード
        if (!trashed) return state;
        log(state, `${state.players[pd.player].name} はサプライの「${C()[trashed].name}」を廃棄した（待ち伏せ）。`);
        state.pending = null;
        return state;
      }
      case 'LURKER_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'lurker' || pd.stage !== 'gain') return state;
        const card = action.card;
        // 廃棄置き場にある実カードのみ（混合山のプレースホルダ 'knights'/'castles'/'ruins' は trash に入らない）。
        if (!C()[card] || !DOM.isType(card, 'action') || !removeOne(state.trash, card)) return state;
        state.pending = null; // 先に閉じてから獲得＝獲得時対話（物見やぐら等）を立てられる
        gainFromOutside(state, pd.player, card, 'discard'); // 支配中は支配者へ振り分け＋獲得トリガー
        log(state, `${state.players[pd.player].name} は廃棄置き場の「${C()[card].name}」を獲得した（待ち伏せ）。`);
        return state;
      }

      /* ---- 風車：手札2枚を捨てて +2 コイン（任意）---- */
      case 'MILL_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'mill') return state;
        const p = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (cards.length === 0) { state.pending = null; return state; } // 捨てない
        if (cards.length !== 2) return state;
        const handCopy = p.hand.slice();
        for (const c of cards) if (!removeOne(handCopy, c)) return state;
        cards.forEach((c) => { removeOne(p.hand, c); p.discard.push(c); });
        addCoins(state, 2);
        log(state, `${p.name} は手札2枚を捨てて +2 コイン（風車）。`);
        state.pending = null;
        return state;
      }

      /* ---- パトロール：非（勝利点/呪い）カードを好きな順で山札の上へ ---- */
      case 'PATROL_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'patrol') return state;
        const p = state.players[pd.player];
        const order = Array.isArray(action.order) ? action.order : [];
        const a = pd.cards.slice().sort(), b = order.slice().sort();
        if (a.length !== b.length || a.some((c, i) => c !== b[i])) return state;
        for (let i = order.length - 1; i >= 0; i--) p.deck.unshift(order[i]);
        log(state, `${p.name} は山札の上を並べ替えた（パトロール）。`);
        state.pending = null;
        return state;
      }

      /* ---- 身代わり：廃棄→+$2まで獲得（ア/財は山札上、勝利点は他全員に呪い）---- */
      case 'REPLACE_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'replace' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card); trashCard(state, pd.player, card);
        log(state, `${p.name} は「${C()[card].name}」を廃棄した（身代わり）。`);
        const ref = costOf(state, card);
        const maxCost = ref.coin + 2;
        state.pending = anyGainable(state, (id) => costUpTo(state, id, maxCost, ref))
          ? { type: 'replace', stage: 'gain', player: pd.player, source: pd.player, maxCost, pot: ref.pot, debt: ref.debt }
          : null;
        return state;
      }
      case 'REPLACE_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'replace' || pd.stage !== 'gain') return state;
        const card = action.card;
        const canGain = (id) => costUpTo(state, id, pd.maxCost, pd);
        if (card == null || !canGain(card)) return state; // 獲得は強制
        const toDeck = DOM.isType(card, 'action') || isTreasureFor(state, card);
        gain(state, pd.player, card, toDeck ? 'deck' : 'discard');
        log(state, `${state.players[pd.player].name} は「${C()[card].name}」を獲得した（身代わり）。`);
        if (DOM.isType(card, 'victory')) {
          const vics = [];
          for (let k = 1; k < state.players.length; k++) vics.push((pd.player + k) % state.players.length);
          replaceEnterVictim(state, pd.player, vics); // 勝利点獲得時は他全員が呪い（アタック）
        } else {
          state.pending = null;
        }
        return state;
      }
      case 'REPLACE_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'replace' || pd.stage !== 'react') return state;
        replaceCurse(state, pd.source, pd.victim, pd.queue);
        return state;
      }

      /* ---- 隠し通路：手札1枚を山札の好きな位置へ ---- */
      case 'SECRET_PASSAGE_PICK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'secret_passage' || pd.stage !== 'pick') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        state.pending = { type: 'secret_passage', stage: 'place', player: pd.player, card };
        return state;
      }
      case 'SECRET_PASSAGE_PLACE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'secret_passage' || pd.stage !== 'place') return state;
        const p = state.players[pd.player];
        if (p.hand.indexOf(pd.card) < 0) return state;
        let pos = Number.isInteger(action.pos) ? action.pos : 0;
        pos = Math.max(0, Math.min(pos, p.deck.length)); // 0=一番上, deck.length=一番下
        removeOne(p.hand, pd.card);
        p.deck.splice(pos, 0, pd.card);
        log(state, `${p.name} は手札1枚を山札に入れた（隠し通路）。`);
        state.pending = null;
        return state;
      }

      /* ===== プロモカード の選択解決 ===== */
      /* ---- 使者：左隣が公開5枚から1枚を選び、使用者がそれを捨てる ---- */
      case 'ENVOY_PICK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'envoy') return state;
        const card = action.card;
        if (pd.revealed.indexOf(card) < 0) return state;
        const src = state.players[pd.source];
        const rest = pd.revealed.slice();
        rest.splice(rest.indexOf(card), 1);
        src.discard.push(card);
        rest.forEach((c) => src.hand.push(c));
        log(state, `${state.players[pd.player].name} は使者で ${src.name} の「${C()[card].name}」を捨てさせた。`);
        state.pending = null;
        return state;
      }

      /* ---- 総督：モード選択（自分は強い方、他は弱い方）---- */
      case 'GOVERNOR_CHOOSE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'governor' || pd.stage !== 'choose') return state;
        const src = pd.player;
        const others = [];
        for (let k = 1; k < state.players.length; k++) others.push((src + k) % state.players.length);
        if (action.choice === 'cards') {
          draw(state, src, 3);
          others.forEach((o) => draw(state, o, 1));
          log(state, `${state.players[src].name} は総督で +3カード（他は各 +1カード）。`);
          state.pending = null;
        } else if (action.choice === 'silver') {
          if (gain(state, src, 'gold', 'discard')) log(state, `${state.players[src].name} は総督で金貨を獲得（他は銀貨）。`);
          others.forEach((o) => gain(state, o, 'silver', 'discard'));
          state.pending = null;
        } else if (action.choice === 'remodel') {
          const queue = [{ p: src, delta: 2 }].concat(others.map((o) => ({ p: o, delta: 1 })));
          governorEnterRemodel(state, queue);
        } else return state;
        return state;
      }
      case 'GOVERNOR_REMODEL_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'governor_remodel' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (card == null) { governorEnterRemodel(state, pd.queue); return state; } // 廃棄しない
        if (p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card); trashCard(state, pd.player, card);
        log(state, `${p.name} は「${C()[card].name}」を廃棄した（総督）。`);
        const gref = costOf(state, card);
        const exact = gref.coin + pd.delta;
        if (anyGainable(state, (id) => costExact(state, id, exact, gref.pot, gref.debt))) {
          state.pending = { type: 'governor_remodel', stage: 'gain', player: pd.player, exact, pot: gref.pot, debt: gref.debt, queue: pd.queue };
        } else {
          log(state, `ちょうど ${exact} コストのカードが無く、獲得できなかった（総督）。`);
          governorEnterRemodel(state, pd.queue);
        }
        return state;
      }
      case 'GOVERNOR_REMODEL_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'governor_remodel' || pd.stage !== 'gain') return state;
        const card = action.card;
        const canGain = (id) => costExact(state, id, pd.exact, pd.pot, pd.debt);
        if (card == null) { if (anyGainable(state, canGain)) return state; governorEnterRemodel(state, pd.queue); return state; }
        if (!canGain(card)) return state;
        gain(state, pd.player, card, 'discard');
        log(state, `${state.players[pd.player].name} は「${C()[card].name}」を獲得した（総督）。`);
        governorEnterRemodel(state, pd.queue);
        return state;
      }

      /* ---- 取り壊し：廃棄→（$1以上なら）安いカード＋金貨を獲得 ---- */
      case 'DISMANTLE_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'dismantle' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card); trashCard(state, pd.player, card);
        log(state, `${p.name} は「${C()[card].name}」を廃棄した（取り壊し）。`);
        const ref = costOf(state, card);
        if (ref.coin >= 1) {
          if (gain(state, pd.player, 'gold', 'discard')) log(state, `${p.name} は金貨を獲得した（取り壊し）。`);
          state.pending = anyGainable(state, (id) => costUnder(state, id, ref.coin, ref))
            ? { type: 'dismantle', stage: 'gain', player: pd.player, maxCost: ref.coin - 1, coin: ref.coin, pot: ref.pot, debt: ref.debt } : null;
        } else {
          state.pending = null;
        }
        return state;
      }
      case 'DISMANTLE_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'dismantle' || pd.stage !== 'gain') return state;
        const ref = underRef(pd);
        finishGain(state, pd, action.card, (id) => costUnder(state, id, ref.coin, ref), 'discard', '獲得した（取り壊し）。');
        return state;
      }

      /* ---- 闇市場：財宝を出してよい→公開3枚の1枚を購入してよい ---- */
      case 'BLACK_MARKET_PLAY_TREASURES': {
        const pd = state.pending;
        if (!pd || pd.type !== 'black_market' || pd.stage !== 'play') return state;
        const p = state.players[pd.player];
        const treasures = p.hand.filter((c) => isTreasureFor(state, c))
          .sort((a, b) => (a === 'silver' ? -1 : 0) - (b === 'silver' ? -1 : 0));
        // 財宝を順に出す。投資/金床/水晶玉/ティアラ/ペテン師(堀) 等が「使ったとき」の pending を立てて
        // 闇市場 pending を上書きした場合、公開中のカードを闇市場デッキへ戻してから、その財宝 pending の解決に譲る
        // （さもないと公開中のカードが取りこぼされ消失する＝カード保存則違反）。今回の闇市場購入は中断。
        for (const card of treasures) {
          playTreasureCard(state, pd.player, card);
          if (state.pending !== pd) { state.blackMarket = (state.blackMarket || []).concat(pd.revealed); return state; }
        }
        if (treasures.length) log(state, `${p.name} は闇市場で財宝を出した。`);
        return state; // 同じ pending のまま（購入ステップへ）
      }
      case 'BLACK_MARKET_BUY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'black_market' || pd.stage !== 'play') return state;
        if ((state.players[pd.player].debt || 0) > 0) return state; // 帝国：負債があると闇市場でも購入できない（購入は購入）
        if (t.noBuyCards) return state; // 冒険：使節団の追加ターン＝カードは購入できない（闇市場の購入も「購入」）
        const card = action.card;
        if (pd.revealed.indexOf(card) < 0) return state;
        /* 混合山のプレースホルダ（山キー）と中身は闇市場では買えない＝**実在する1枚のカードではない**。
           デッキ構築側（createInitialState）でも除外しているが、**v63 以前に始まってオンラインで永続化された
           対局を復元すると、既にデッキへ入ってしまっている**ので受理側にも同じガードを置く
           （§0-17 の `pending.self` と同型＝旧スナップショットの互換は受理側で守る）。 */
        if (isMixedPileKey(card) || MIXED_PILE_CONTENTS.has(card)) return state;
        /* 夜想曲：錯乱を**返した後**なら闇市場でもアクションカードは買えない（公式）。
           まだ返していない＝アクションフェイズで闇市場を使うぶんには普通に買える（`t.cantBuyActions` が立っていない）。 */
        if (t.cantBuyActions && pd.player === t.active && DOM.isType(card, 'action')) return state;
        const cost = cardCost(state, card);
        if (cost > t.coins) return state; // 払えない
        t.coins -= cost; // 闇市場の購入は購入回数を消費しない
        // ※闇市場はアクションフェイズに解決する（自前の財宝プレイ手順を持つ）ので、ここで treasuresLocked は立てない
        //   （立てると購入フェイズで財宝を出せなくなる＝実プレイが壊れる）。
        log(state, `${state.players[pd.player].name} は闇市場で「${C()[card].name}」を購入した。`);
        applyHoardOnBuy(state, pd.player, card);
        triggerMerchantGuild(state, pd.player); // ギルド：闇市場の購入でも商人ギルドの財源が付く
        const rest = pd.revealed.filter((c) => c !== card);
        state.blackMarket = (state.blackMarket || []).concat(rest); // 残りは底へ（過払い前に片付ける）
        state.pending = null;
        // 闇市場の獲得は「サプライ外からの獲得」＝gainFromOutside（負債の付与・**支配の振り分け**・獲得トリガーを
        //   gain() と同じ経路で通す）。ヴィラ＝手札に加え+1アクション／公共広場＝+1購入／庭師＝VP／御守り＝次の獲得コピー 等。
        gainFromOutside(state, pd.player, card, 'discard');
        // ギルド：闇市場でも過払い対象カード(名品/石工/医者/伝令官)を買えば過払いできる（promo込みセットで到達可）。
        maybeStartOverpay(state, pd.player, card);
        // 冒険：呪いの森/沼の妖婆＝闇市場の購入でも「購入した」トリガーが発動する。
        applyLingerOnBuy(state, pd.player);
        return state;
      }
      case 'BLACK_MARKET_SKIP': {
        const pd = state.pending;
        if (!pd || pd.type !== 'black_market' || pd.stage !== 'play') return state;
        state.blackMarket = (state.blackMarket || []).concat(pd.revealed); // 全部底へ
        log(state, `${state.players[pd.player].name} は闇市場で何も買わなかった。`);
        state.pending = null;
        return state;
      }

      /* ===== 新プロモ（王子/船長/教会/サウナ/アヴァント/へそくり）の選択解決 ===== */
      /* ---- 王子：手札のコスト4以下（持続/命令以外）のアクション1枚を王子の脇に置いてよい ---- */
      case 'PRINCE_SETASIDE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'prince') return state;
        const p = state.players[pd.player];
        if (action.card == null) { state.pending = null; return state; } // 置かない（王子は普通に捨て札へ）
        const card = action.card;
        if (p.hand.indexOf(card) < 0 || !princeEligible(state, card)) return state;
        if (p.inPlay.indexOf('prince') < 0) return state; // 場の王子が母体（玉座×王子は2回解決で2枚置ける＝公式）
        removeOne(p.hand, card);
        p.princes = p.princes || [];
        p.princes.push(card); // 王子自身は場に残り続ける（クリンナップが princes の数だけ保持）
        log(state, `${p.name} は「${C()[card].name}」を王子の脇に置いた（毎ターン開始時に使用）。`);
        state.pending = null;
        return state;
      }
      /* ---- 王子：ターン開始時＝脇のカードを（脇に置いたまま）使用する（強制・1ボタン） ---- */
      case 'PRINCE_PLAY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'prince_play') return state;
        const p = state.players[pd.player];
        const card = (p.princes || [])[pd.idx];
        state.pending = null; // 先に閉じる（applyEffect が新たな選択待ちを立てることがある）
        if (card) {
          t.actionsPlayed = (t.actionsPlayed || 0) + 1; // アクションの使用に数える（共謀者等）。カードは場に出ない。
          log(state, `${p.name} は王子で「${C()[card].name}」を使った（脇に置いたまま）。`);
          playAsCommand(state, pd.player, 'prince', card);
        }
        return state; // 残りの開始時キューは reduce の startQueue 安全網が進める
      }
      /* ---- 船長：サプライのコスト4以下（持続/命令以外）のアクションを、サプライに残したまま使用 ---- */
      case 'CAPTAIN_PLAY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'captain') return state;
        const cands = captainTargets(state);
        if (action.card == null) {
          if (cands.length) return state; // 対象があるうちは使用必須（公式：mayではない）
          state.pending = null;
          return state;
        }
        const card = action.card;
        if (cands.indexOf(card) < 0) return state;
        state.pending = null; // 先に閉じる（applyEffect が新たな選択待ちを立てることがある）
        t.actionsPlayed = (t.actionsPlayed || 0) + 1; // 使用に数えるが、カードはサプライに残る（場に出ない）
        log(state, `${state.players[pd.player].name} は船長でサプライの「${C()[card].name}」を使った（サプライに残る）。`);
        playAsCommand(state, pd.player, 'captain', card);
        return state; // ターン開始時ぶんの後続は startQueue 安全網が進める
      }
      /* ---- 教会：手札から最大3枚を裏向きで脇に置く ---- */
      case 'CHURCH_SETASIDE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'church') return state;
        const p = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (cards.length > 3) return state;
        const copy = p.hand.slice();
        for (const c of cards) if (!removeOne(copy, c)) return state; // 手札に無い指定は拒否
        cards.forEach((c) => { removeOne(p.hand, c); p.setAside.push(c); });
        armDuration(state, pd.player, 'church', { stashed: cards.slice() });
        if (cards.length) log(state, `${p.name} は教会で ${cards.length}枚 を裏向きで脇に置いた。`);
        state.pending = null;
        return state;
      }
      /* ---- 教会：次のターン開始時＝手札1枚を廃棄してよい ---- */
      case 'CHURCH_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'church_trash') return state;
        const p = state.players[pd.player];
        if (action.card != null) {
          if (p.hand.indexOf(action.card) < 0) return state;
          removeOne(p.hand, action.card);
          trashCard(state, pd.player, action.card);
          log(state, `${p.name} は「${C()[action.card].name}」を廃棄した（教会）。`);
        }
        popStartQueue(state); // 開始時キューの次へ（無ければ通常の手番へ）
        return state;
      }
      /* ---- サウナ/アヴァント：手札の相方を使ってよい（連鎖） ---- */
      case 'SAUNA_CHAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'sauna_chain') return state;
        const p = state.players[pd.player];
        state.pending = null;
        if (action.play && p.hand.includes(pd.next)) {
          removeOne(p.hand, pd.next);
          p.inPlay.push(pd.next);
          t.actionsPlayed = (t.actionsPlayed || 0) + 1; // アクション権は消費しない（「使ってよい」）
          log(state, `${p.name} は${pd.next === 'avanto' ? 'サウナ' : 'アヴァント'}で「${C()[pd.next].name}」を使った。`);
          applyEffect(state, pd.next, pd.player);
        }
        return state;
      }
      /* ---- サウナ：銀貨を使ったとき、手札1枚を廃棄してよい（サウナの使用回数ぶん） ---- */
      case 'SAUNA_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'sauna_trash') return state;
        const p = state.players[pd.player];
        if (action.card == null) { state.pending = null; return state; } // 残り回数ぶんまとめて辞退
        if (p.hand.indexOf(action.card) < 0) return state;
        removeOne(p.hand, action.card);
        trashCard(state, pd.player, action.card);
        log(state, `${p.name} は「${C()[action.card].name}」を廃棄した（サウナ）。`);
        pd.remaining = (pd.remaining || 1) - 1;
        if (pd.remaining <= 0 || p.hand.length === 0) state.pending = null; // 使い切り or 手札切れで終了
        return state;
      }
      /* ---- へそくり：シャッフル時の配置方針を変更（本人の手番/選択窓でのみ・公開情報） ---- */
      case 'STASH_SETTING': {
        // オンラインはサーバが「actor（手番 or 選択中の人）」しか dispatch できない。ここでは
        // action.player がその actor 本人（支配中は被支配者=山札の持ち主）であることを検証し、
        // 他人の配置方針を書き換えられないようにする。
        const actorSeat = state.pending ? state.pending.player : t.active;
        if (action.player !== actorSeat) return state;
        const pl = state.players[action.player];
        const v = action.value;
        if (!pl || (v !== 'top' && v !== 'mix' && v !== 'bottom')) return state;
        pl.stashPlacement = v;
        return state;
      }

      /* ===== 拡張: 暗黒時代（Dark Ages）の選択解決 ===== */
      case 'SURVIVORS_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'survivors') return state;
        const p = state.players[pd.player];
        const n = pd.cards.length;
        if (action.choice === 'discard') {
          for (let i = 0; i < n; i++) { const c = p.deck.shift(); if (c != null) p.discard.push(c); }
          log(state, `${p.name} は生存者で上${n}枚を捨てた。`);
        } else { // 両方を山札の上へ（順序 action.order を採用可・不正なら公開順）
          const cur = [];
          for (let i = 0; i < n; i++) { const c = p.deck.shift(); if (c != null) cur.push(c); }
          let order = cur;
          if (Array.isArray(action.order) && action.order.length === cur.length) {
            const a = action.order.slice().sort(), b = cur.slice().sort();
            if (a.every((x, i) => x === b[i])) order = action.order;
          }
          for (let i = order.length - 1; i >= 0; i--) p.deck.unshift(order[i]);
          log(state, `${p.name} は生存者で上${n}枚を山札の上に戻した。`);
        }
        state.pending = null;
        return state;
      }
      case 'RATS_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'rats_trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (card === 'rats' || p.hand.indexOf(card) < 0) return state; // ネズミ以外を廃棄（強制）
        removeOne(p.hand, card); trashCard(state, pd.player, card);
        log(state, `${p.name} はネズミで「${C()[card].name}」を廃棄した。`);
        state.pending = null;
        return state;
      }
      case 'ARMORY_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'armory') return state;
        finishGain(state, pd, action.card, (id) => costUpTo(state, id, 4), 'deck', '山札の上に獲得した（武器庫）。');
        return state;
      }
      case 'FORAGER_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'forager') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (card == null || p.hand.indexOf(card) < 0) return state; // 廃棄は可能なら強制
        removeOne(p.hand, card); trashCard(state, pd.player, card);
        const add = foragerCoins(state);
        addCoins(state, add);
        log(state, `${p.name} は採集者で「${C()[card].name}」を廃棄し +$${add}（廃棄置き場の財宝${add}種）。`);
        state.pending = null;
        return state;
      }
      case 'SQUIRE_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'squire') return state;
        const p = state.players[pd.player];
        const c = action.choice;
        if (c === 'actions') { addActions(t, 2); }
        else if (c === 'buys') { t.buys += 2; }
        else if (c === 'silver') { if (gain(state, pd.player, 'silver', 'discard')) { /* log下 */ } }
        else return state;
        log(state, `${p.name} は従者で ${c === 'actions' ? '+2アクション' : c === 'buys' ? '+2購入' : '銀貨獲得'} を選んだ。`);
        state.pending = null;
        return state;
      }
      case 'SQUIRE_TRASH_GAIN': { // on-trash：サプライのアタックカードを1枚獲得
        const pd = state.pending;
        if (!pd || pd.type !== 'squire_trash_gain') return state;
        finishGain(state, pd, action.card, (id) => isTypeSupply(state, id, 'attack') && !NON_SUPPLY.has(id), 'discard', 'アタックカードを獲得した（従者）。');
        return state;
      }
      case 'STOREROOM_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'storeroom') return state;
        const p = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        const copy = p.hand.slice();
        for (const c of cards) if (!removeOne(copy, c)) return state; // 手札に無い指定は拒否
        if (pd.stage === 'discard1') {
          cards.forEach((c) => { removeOne(p.hand, c); p.discard.push(c); });
          draw(state, pd.player, cards.length);
          if (cards.length) log(state, `${p.name} は倉庫で${cards.length}枚捨てて${cards.length}枚引いた。`);
          state.pending = { type: 'storeroom', stage: 'discard2', player: pd.player };
        } else { // discard2：捨てた枚数ぶん +$1
          cards.forEach((c) => { removeOne(p.hand, c); p.discard.push(c); });
          if (cards.length) { addCoins(state, cards.length); log(state, `${p.name} は倉庫で${cards.length}枚捨てて +$${cards.length}。`); }
          state.pending = null;
        }
        return state;
      }
      case 'SCAVENGER_DECK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'scavenger' || pd.stage !== 'deck') return state;
        const p = state.players[pd.player];
        if (action.discardDeck && p.deck.length > 0) {
          p.discard.push(...p.deck); p.deck = [];
          log(state, `${p.name} は清掃で山札を全て捨て札にした。`);
        }
        state.pending = p.discard.length > 0 ? { type: 'scavenger', stage: 'topdeck', player: pd.player } : null;
        return state;
      }
      case 'SCAVENGER_TOPDECK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'scavenger' || pd.stage !== 'topdeck') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.discard.indexOf(card) < 0) return state;
        removeOne(p.discard, card); p.deck.unshift(card);
        log(state, `${p.name} は清掃で「${C()[card].name}」を山札の上に置いた。`);
        state.pending = null;
        return state;
      }
      case 'IRONMONGER_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'ironmonger') return state;
        const p = state.players[pd.player];
        const top = p.deck[0];
        if (top !== pd.card) { state.pending = null; return state; } // 山札が変わっていたら何もしない
        reveal(state, pd.player, [top], '鉄物商');
        if (action.discard) { p.deck.shift(); p.discard.push(top); log(state, `${p.name} は鉄物商で「${C()[top].name}」を捨てた。`); }
        // 種別ボーナス（捨てても戻しても得る。複合種別は全て得る）
        if (DOM.isType(top, 'action')) addActions(t, 1);
        if (isTreasureFor(state, top)) addCoins(state, 1);
        if (DOM.isType(top, 'victory')) draw(state, pd.player, 1);
        state.pending = null;
        return state;
      }
      case 'MINSTREL_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'minstrel') return state;
        const p = state.players[pd.player];
        const order = Array.isArray(action.order) ? action.order : pd.cards;
        const a = order.slice().sort(), b = pd.cards.slice().sort();
        if (a.length !== b.length || !a.every((x, i) => x === b[i])) return state; // 同じ多重集合のみ
        for (let i = order.length - 1; i >= 0; i--) p.deck.unshift(order[i]);
        log(state, `${p.name} は吟遊詩人でアクション${order.length}枚を山札の上に戻した。`);
        state.pending = null;
        return state;
      }
      case 'JUNK_DEALER_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'junk_dealer') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (card == null || p.hand.indexOf(card) < 0) return state; // 廃棄は可能なら強制
        removeOne(p.hand, card); trashCard(state, pd.player, card);
        log(state, `${p.name} は屑屋で「${C()[card].name}」を廃棄した。`);
        state.pending = null;
        return state;
      }
      case 'MYSTIC_NAME': {
        const pd = state.pending;
        if (!pd || pd.type !== 'mystic') return state;
        const p = state.players[pd.player];
        const named = action.card; // 指定したカード名（山札の中身を見ずに宣言）
        if (p.deck.length === 0 && p.discard.length > 0) reshuffleDeck(p);
        const top = p.deck[0];
        if (top != null) {
          reveal(state, pd.player, [top], '秘術師で山札の上を公開');
          if (named === top) { p.deck.shift(); p.hand.push(top); log(state, `${p.name} は秘術師で「${C()[top].name}」を当てて手札に加えた。`); }
          else log(state, `${p.name} は秘術師で「${C()[named] ? C()[named].name : named}」を指定したが外れた。`);
        }
        state.pending = null;
        return state;
      }
      case 'ALTAR_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'altar' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (card == null || p.hand.indexOf(card) < 0) return state; // 手札があれば廃棄は強制
        removeOne(p.hand, card); trashCard(state, pd.player, card);
        log(state, `${p.name} は祭壇で「${C()[card].name}」を廃棄した。`);
        // 廃棄の可否に関わらず、この後コスト5以下を1枚獲得（獲得候補が無ければ辞退）。
        // ※廃棄の on-trash が対話を onTrashQueue に積んでいても、祭壇の獲得を先に立てる（獲得後に reduce 末尾で消化）。
        state.pending = anyGainable(state, (id) => costUpTo(state, id, 5))
          ? { type: 'altar', stage: 'gain', player: pd.player }
          : null;
        return state;
      }
      case 'ALTAR_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'altar' || pd.stage !== 'gain') return state;
        finishGain(state, pd, action.card, (id) => costUpTo(state, id, 5), 'discard', '獲得した（祭壇）。');
        return state;
      }
      case 'CATACOMBS_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'catacombs') return state;
        const p = state.players[pd.player];
        const n = pd.cards.length;
        if (action.choice === 'hand') {
          for (let i = 0; i < n; i++) { const c = p.deck.shift(); if (c != null) p.hand.push(c); }
          log(state, `${p.name} は地下墓所で上${n}枚を手札に加えた。`);
        } else { // 捨てて +3カード
          for (let i = 0; i < n; i++) { const c = p.deck.shift(); if (c != null) p.discard.push(c); }
          draw(state, pd.player, 3);
          log(state, `${p.name} は地下墓所で上${n}枚を捨てて +3カード。`);
        }
        state.pending = null;
        return state;
      }
      case 'CATACOMBS_TRASH_GAIN': { // on-trash：これより安いカード1枚を獲得（強制）
        const pd = state.pending;
        if (!pd || pd.type !== 'catacombs_trash') return state;
        finishGain(state, pd, action.card, (id) => costUnder(state, id, underRef(pd).coin, underRef(pd)), 'discard', '獲得した（地下墓所）。');
        return state;
      }
      case 'HUNTING_GROUNDS_TRASH': { // on-trash：公領1枚 or 屋敷3枚
        const pd = state.pending;
        if (!pd || pd.type !== 'hunting_grounds_trash') return state;
        const p = state.players[pd.player];
        if (action.choice === 'estates') {
          let g = 0; for (let i = 0; i < 3; i++) if (gain(state, pd.player, 'estate', 'discard')) g++;
          log(state, `${p.name} は狩場で屋敷 ${g}枚 を獲得した。`);
        } else { // duchy（既定）
          if (gain(state, pd.player, 'duchy', 'discard')) log(state, `${p.name} は狩場で公領を獲得した。`);
          else log(state, `${p.name} は狩場で公領を選んだが獲得できなかった。`);
        }
        state.pending = null;
        return state;
      }
      // 暗黒時代：$3〜$6 の判定（ポーション/負債コストは該当外）。廃棄置き場から数える。
      case 'GRAVEROBBER_MODE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'graverobber' || pd.stage !== 'choose') return state;
        const p = state.players[pd.player];
        if (action.mode === 'from_trash') {
          const has = (state.trash || []).some((c) => { const cc = cardCost(state, c); return cc >= 3 && cc <= 6 && potionCost(c) === 0; });
          state.pending = has ? { type: 'graverobber', stage: 'from_trash', player: pd.player } : null; // 該当なし＝不発
        } else if (action.mode === 'trash_gain') {
          state.pending = p.hand.some((c) => DOM.isType(c, 'action')) ? { type: 'graverobber', stage: 'trash', player: pd.player } : null;
        } else return state;
        return state;
      }
      case 'GRAVEROBBER_FROM_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'graverobber' || pd.stage !== 'from_trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        const cc = card != null ? cardCost(state, card) : -1;
        if (card == null || state.trash.indexOf(card) < 0 || cc < 3 || cc > 6 || potionCost(card) !== 0) return state;
        removeOne(state.trash, card);
        // 「獲得」は公開ではない＝パトロンは誘発しない（何を取ったかの表示のみ）。
        reveal(state, pd.player, [card], '墓暴きで廃棄置き場から獲得', { notReveal: true });
        state.pending = null; // 先に閉じてから獲得＝獲得時対話（物見やぐら等）を立てられる
        gainFromOutside(state, pd.player, card, 'deck'); // 支配の振り分け＋獲得トリガー
        log(state, `${p.name} は墓暴きで廃棄置き場の「${C()[card].name}」を山札の上に獲得した。`);
        return state;
      }
      case 'GRAVEROBBER_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'graverobber' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (card == null || p.hand.indexOf(card) < 0 || !DOM.isType(card, 'action')) return state;
        removeOne(p.hand, card); trashCard(state, pd.player, card);
        const gr = costOf(state, card);
        const mx = gr.coin + 3;
        log(state, `${p.name} は墓暴きで「${C()[card].name}」を廃棄した。`);
        state.pending = anyGainable(state, (id) => costUpTo(state, id, mx, gr))
          ? { type: 'graverobber', stage: 'gain', player: pd.player, maxCost: mx, pot: gr.pot, debt: gr.debt }
          : null;
        return state;
      }
      case 'GRAVEROBBER_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'graverobber' || pd.stage !== 'gain') return state;
        finishGain(state, pd, action.card, (id) => costUpTo(state, id, pd.maxCost, pd), 'discard', '獲得した（墓暴き）。');
        return state;
      }
      case 'REBUILD_NAME': {
        const pd = state.pending;
        if (!pd || pd.type !== 'rebuild' || pd.stage !== 'name') return state;
        const p = state.players[pd.player];
        const named = action.card; // 指定は任意のカード名（ゲーム外/非勝利点でもよい）
        const revealed = []; let found = null;
        while (true) {
          if (p.deck.length === 0) { if (p.discard.length === 0) break; reshuffleDeck(p); }
          if (p.deck.length === 0) break;
          const c = p.deck.shift();
          if (DOM.isType(c, 'victory') && c !== named) { found = c; break; }
          revealed.push(c);
        }
        reveal(state, pd.player, revealed.concat(found ? [found] : []), '建て直し');
        revealed.forEach((c) => p.discard.push(c)); // 残りを捨てる
        if (found) {
          trashCard(state, pd.player, found);
          const fr = costOf(state, found);
          const fc = fr.coin + 3;
          log(state, `${p.name} は建て直しで「${C()[found].name}」を廃棄した。`);
          state.pending = anyGainable(state, (id) => costUpTo(state, id, fc, fr) && isTypeSupply(state, id, 'victory'))
            ? { type: 'rebuild', stage: 'gain', player: pd.player, maxCost: fc, pot: fr.pot, debt: fr.debt }
            : null;
        } else {
          log(state, `${p.name} は建て直しで対象の勝利点が見つからなかった。`);
          state.pending = null;
        }
        return state;
      }
      case 'REBUILD_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'rebuild' || pd.stage !== 'gain') return state;
        finishGain(state, pd, action.card, (id) => costUpTo(state, id, pd.maxCost, pd) && isTypeSupply(state, id, 'victory'), 'discard', '獲得した（建て直し）。');
        return state;
      }
      case 'COUNT_PART1': {
        const pd = state.pending;
        if (!pd || pd.type !== 'count' || pd.stage !== 'part1') return state;
        const p = state.players[pd.player];
        const m = action.mode;
        if (m === 'discard2') {
          const need = Math.min(2, p.hand.length);
          if (need > 0) { state.pending = { type: 'count', stage: 'discard', player: pd.player, need }; return state; }
        } else if (m === 'topdeck') {
          if (p.hand.length > 0) { state.pending = { type: 'count', stage: 'topdeck', player: pd.player }; return state; }
        } else if (m === 'copper') {
          if (gain(state, pd.player, 'copper', 'discard')) log(state, `${p.name} は伯爵で銅貨を獲得した。`);
        } else return state;
        state.pending = { type: 'count', stage: 'part2', player: pd.player }; // 前半が空振りでも後半へ
        return state;
      }
      case 'COUNT_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'count' || pd.stage !== 'discard') return state;
        if (!discardFromHand(state, pd.player, action.cards, pd.need, '捨てた（伯爵）。')) return state;
        state.pending = { type: 'count', stage: 'part2', player: pd.player };
        return state;
      }
      case 'COUNT_TOPDECK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'count' || pd.stage !== 'topdeck') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card); p.deck.unshift(card);
        log(state, `${p.name} は伯爵で手札1枚を山札の上に置いた。`);
        state.pending = { type: 'count', stage: 'part2', player: pd.player };
        return state;
      }
      case 'COUNT_PART2': {
        const pd = state.pending;
        if (!pd || pd.type !== 'count' || pd.stage !== 'part2') return state;
        const p = state.players[pd.player];
        const m = action.mode;
        if (m === 'coins') { addCoins(state, 3); log(state, `${p.name} は伯爵で +$3。`); }
        else if (m === 'trashhand') {
          const hand = p.hand.slice(); p.hand.length = 0;
          hand.forEach((c) => trashCard(state, pd.player, c)); // 城塞は手札へ戻る／catacombs等の対話はキューへ
          log(state, `${p.name} は伯爵で手札 ${hand.length}枚 を廃棄した。`);
        } else if (m === 'duchy') {
          if (gain(state, pd.player, 'duchy', 'discard')) log(state, `${p.name} は伯爵で公領を獲得した。`);
        } else return state;
        state.pending = null;
        return state;
      }
      case 'DEATH_CART_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'death_cart') return state;
        const p = state.players[pd.player];
        if (action.mode === 'this') {
          // 命令（大君主/はみだし者/船長/王子）で動かさずにプレイした死の荷車は「これ」が場に無い＝自身の廃棄は不発（+$0・lose-track）。
          // 場に別の（本物の）死の荷車があってもそれは対象外＝pd.self が false なら何もしない。
          if (pendingSelf(state, pd, 'death_cart') && removeOne(p.inPlay, 'death_cart')) { trashCard(state, pd.player, 'death_cart'); addCoins(state, 5); log(state, `${p.name} は死の荷車を廃棄した（+$5）。`); }
        } else if (action.mode === 'hand') {
          const card = action.card;
          if (card == null || p.hand.indexOf(card) < 0 || !DOM.isType(card, 'action')) return state;
          removeOne(p.hand, card); trashCard(state, pd.player, card); addCoins(state, 5);
          log(state, `${p.name} は死の荷車で「${C()[card].name}」を廃棄した（+$5）。`);
        } // else 'none' → 何もしない
        state.pending = null;
        return state;
      }
      case 'BAND_OF_MISFITS_PLAY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'band_of_misfits') return state;
        const cands = bandOfMisfitsTargets(state);
        if (action.card == null) { if (cands.length) return state; state.pending = null; return state; } // 対象があるうちは使用必須
        const card = action.card;
        if (cands.indexOf(card) < 0) return state;
        state.pending = null; // 先に閉じる（applyEffect が新たな選択待ちを立てることがある）
        t.actionsPlayed = (t.actionsPlayed || 0) + 1; // 使用に数えるがカードはサプライに残る
        rememberCommandAs(state, 'band_of_misfits', card); // 再演（玉座/行進等）では選び直さない
        log(state, `${state.players[pd.player].name} ははみだし者でサプライの「${C()[card].name}」を使った（サプライに残る）。`);
        playAsCommand(state, pd.player, 'band_of_misfits', card);
        return state;
      }
      case 'HERMIT_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'hermit' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (card != null) {
          const from = action.from === 'discard' ? p.discard : p.hand;
          if (from.indexOf(card) < 0 || isTreasureFor(state, card)) return state; // 非財宝のみ・捨て札/手札から
          removeOne(from, card); trashCard(state, pd.player, card);
          log(state, `${p.name} は隠遁者で「${C()[card].name}」を廃棄した。`);
        }
        // 廃棄の有無に関わらず コスト3以下を1枚獲得（強制）。
        state.pending = anyGainable(state, (id) => costUpTo(state, id, 3))
          ? { type: 'hermit', stage: 'gain', player: pd.player }
          : null;
        return state;
      }
      case 'HERMIT_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'hermit' || pd.stage !== 'gain') return state;
        finishGain(state, pd, action.card, (id) => costUpTo(state, id, 3), 'discard', '獲得した（隠遁者）。');
        return state;
      }
      case 'PROCESSION_CHOOSE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'procession') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (card == null) { state.pending = null; return state; } // 使わない
        if (p.hand.indexOf(card) < 0 || !DOM.isType(card, 'action') || DOM.isType(card, 'duration')) return state;
        removeOne(p.hand, card); p.inPlay.push(card);
        t.actionsPlayed = (t.actionsPlayed || 0) + 1;
        state.pending = null;
        log(state, `${p.name} は行進で「${C()[card].name}」を使った（1回目）。`);
        applyEffect(state, card, pd.player); // 1回目
        state.replay = state.replay || [];
        state.replay.push({ player: pd.player, card, label: 'procession2' });       // 2回目
        state.replay.push({ player: pd.player, card, label: 'procession_finish' }); // 2回後に廃棄＋獲得
        return state;
      }
      case 'PROCESSION_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'procession_gain') return state;
        finishGain(state, pd, action.card, (id) => costExact(state, id, pd.exact, pd.pot, pd.debt) && isTypeSupply(state, id, 'action'), 'discard', '獲得した（行進）。');
        return state;
      }
      case 'COUNTERFEIT_PLAY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'counterfeit') return state;
        const p = state.players[pd.player];
        const card = action.card; // null = しない
        state.pending = null;
        if (card != null && p.hand.indexOf(card) >= 0 && isTreasureFor(state, card) && !DOM.isType(card, 'duration')) {
          // 冠/ティアラと同型：2回目は 'treasure_replay'、その後の廃棄は 'counterfeit_trash' として
          //   state.replay に順に積む（行進の procession2/procession_finish と同じ形）。
          //   これで1回目/2回目が立てる選択待ちが解決してから廃棄が走る。
          log(state, `${p.name} は偽造通貨で「${C()[card].name}」を2回使う。`);
          playTreasureCard(state, pd.player, card); // 1回目（移動＋効果。戦利品は山へ戻る）
          state.replay = state.replay || [];
          state.replay.push({ player: pd.player, card, label: 'treasure_replay' });  // 2回目（効果のみ）
          state.replay.push({ player: pd.player, card, label: 'counterfeit_trash' }); // 2回のプレイ後に廃棄
        }
        return state;
      }
      /* ===== 暗黒時代：アタックの選択解決 ===== */
      case 'MARAUDER_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'marauder' || pd.stage !== 'react') return state;
        if (gain(state, pd.victim, 'ruins', 'discard')) log(state, `${state.players[pd.victim].name} は廃墟を獲得した（略奪者）。`);
        marauderEnterVictim(state, pd.source, pd.queue);
        return state;
      }
      /* ===== 冒険：アタックの「そのまま受ける」解決（堀を公開しない被害者） ===== */
      case 'RELIC_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'relic' || pd.stage !== 'react') return state;
        state.players[pd.victim].minusCard = true;
        log(state, `${state.players[pd.victim].name} は -1カードトークンを受け取った（遺物）。`);
        relicEnterVictim(state, pd.source, pd.queue);
        return state;
      }
      case 'BRIDGE_TROLL_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'bridge_troll' || pd.stage !== 'react') return state;
        state.players[pd.victim].minusCoin = true;
        log(state, `${state.players[pd.victim].name} は -$1トークンを受け取った（橋の下のトロル）。`);
        bridgeTrollEnterVictim(state, pd.source, pd.queue);
        return state;
      }
      case 'GIANT_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'giant' || pd.stage !== 'react') return state;
        giantHit(state, pd.victim);
        giantEnterVictim(state, pd.source, pd.queue);
        return state;
      }
      // 冒険：ウォリアー／兵士のアタックを受ける（堀を出さなかった＝そのまま受ける）。
      case 'WARRIOR_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'warrior' || pd.stage !== 'react') return state;
        warriorHit(state, pd.victim, pd.count);
        warriorEnterVictim(state, pd.source, pd.queue, pd.count);
        return state;
      }
      case 'SOLDIER_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'soldier' || pd.stage !== 'react') return state;
        // 堀を出さなかった＝手札1枚を捨てるステップへ（手札4枚以上は EnterVictim で保証済み）。
        state.pending = { type: 'soldier', stage: 'discard', player: pd.victim, source: pd.source, victim: pd.victim, queue: pd.queue };
        return state;
      }
      case 'SOLDIER_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'soldier' || pd.stage !== 'discard') return state;
        const v = state.players[pd.victim];
        const card = action.card;
        if (v.hand.indexOf(card) < 0) return state; // 手札に無い指定は拒否
        removeOne(v.hand, card); v.discard.push(card);
        log(state, `${v.name} は手札1枚を捨てた（兵士）。`);
        soldierEnterVictim(state, pd.source, pd.queue);
        return state;
      }
      // 冒険：ヒーロー＝財宝カード1枚を獲得（強制）。
      case 'HERO_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'hero_gain') return state;
        finishGain(state, pd, action.card, (id) => isTreasureFor(state, id) && !NON_SUPPLY.has(id), 'discard', '獲得した（ヒーロー）。');
        return state;
      }
      // 冒険：脱走兵＝カード1枚を捨てる（強制・手札があるとき）。
      case 'FUGITIVE_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'fugitive_discard') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card); p.discard.push(card);
        log(state, `${p.name} はカード1枚を捨てた（脱走兵）。`);
        state.pending = null;
        return state;
      }
      // 冒険：門下生＝手札のアクション1枚を2度使用してよい。それと同じカード1枚を獲得する。
      case 'DISCIPLE_PLAY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'disciple_play') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (card == null) { state.pending = null; return state; } // 使わない
        // 冒険：相続＝自分のターン中、屋敷もアクション（命令）＝門下生の対象にできる（公式）。
        if (p.hand.indexOf(card) < 0 || !(DOM.isType(card, 'action') || inheritedEstate(p, card))) return state;
        removeOne(p.hand, card); p.inPlay.push(card);
        t.actionsPlayed = (t.actionsPlayed || 0) + 1;
        state.pending = null;
        log(state, `${p.name} は門下生で「${C()[card].name}」を使った（1回目）。`);
        applyEffect(state, card, pd.player);            // 1回目
        state.replay = state.replay || [];
        state.replay.push({ player: pd.player, card }); // 2回目は pending 解消後に runReplays が適用
        // それと同じカード1枚を獲得（コピー。サプライに残っていれば。非サプライ札＝トラベラー等は獲得できない＝何も得ない）。
        if (gainableBase(state, card) && gain(state, pd.player, card, 'discard')) log(state, `${p.name} は門下生で「${C()[card].name}」のコピーを獲得した。`);
        return state;
      }
      // 冒険：トラベラー交換＝場から捨てる時、次の成長先と交換してよい（獲得ではない＝on-gain不発）。
      case 'TRAVELLER_EXCHANGE_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'traveller_exchange') return state;
        const p = state.players[pd.player];
        const queue = pd.queue.slice();
        const trav = queue.shift();          // 今回判定するトラベラー
        const next = TRAVELLER_NEXT[trav];
        if (action.exchange && next && (state.supply[next] || 0) > 0 && p.inPlay.includes(trav)) {
          removeOne(p.inPlay, trav);
          state.supply[trav] = (state.supply[trav] || 0) + 1; // トラベラーは自分の山へ返す
          state.supply[next] -= 1;
          p.discard.push(next);              // 交換で得たカードは捨て札へ（獲得ではない）
          log(state, `${p.name} は「${C()[trav].name}」を「${C()[next].name}」と交換した。`);
        }
        // 交換しなかったトラベラーは場に残す（この後 cleanup で捨て札へ）。
        if (queue.length) { state.pending = { type: 'traveller_exchange', player: pd.player, queue }; return state; }
        state.pending = null;
        endBuyTailSchemeOrCleanup(state, pd.player); // 交換窓の後、策謀→片付けへ
        return state;
      }
      case 'CULTIST_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'cultist' || pd.stage !== 'react') return state;
        if (gain(state, pd.victim, 'ruins', 'discard')) log(state, `${state.players[pd.victim].name} は廃墟を獲得した（狂信者）。`);
        cultistEnterVictim(state, pd.source, pd.queue);
        return state;
      }
      case 'CULTIST_CHAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'cultist_chain') return state;
        const p = state.players[pd.player];
        if (action.play && p.hand.includes('cultist')) {
          removeOne(p.hand, 'cultist'); p.inPlay.push('cultist');
          t.actionsPlayed = (t.actionsPlayed || 0) + 1; // アクション権は消費しない（連鎖は無料）
          state.pending = null;
          log(state, `${p.name} は狂信者を連鎖して使った（アクション消費なし）。`);
          // 浮浪児トリガー：連鎖した狂信者も「別アタックのプレイ」＝場の浮浪児を廃棄→傭兵の機会（効果は後で適用）。
          if (!maybeUrchinTrap(state, 'cultist', pd.player)) applyEffect(state, 'cultist', pd.player);
        } else { state.pending = null; }
        return state;
      }
      case 'PILLAGE_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'pillage' || pd.stage !== 'react') return state;
        reveal(state, pd.victim, state.players[pd.victim].hand.slice(), '略奪で手札公開');
        state.pending = { type: 'pillage', stage: 'pick', player: pd.source, source: pd.source, victim: pd.victim, queue: pd.queue };
        return state;
      }
      case 'PILLAGE_PICK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'pillage' || pd.stage !== 'pick') return state;
        const v = state.players[pd.victim];
        const card = action.card;
        if (v.hand.indexOf(card) < 0) return state;
        removeOne(v.hand, card); v.discard.push(card);
        log(state, `${state.players[pd.source].name} は略奪で ${v.name} の「${C()[card].name}」を捨てさせた。`);
        pillageEnterVictim(state, pd.source, pd.queue);
        return state;
      }
      case 'ROGUE_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'rogue' || pd.stage !== 'react') return state;
        rogueReveal(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'ROGUE_PICK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'rogue' || pd.stage !== 'pick') return state;
        const v = state.players[pd.victim];
        const card = action.card;
        if ((pd.trashable || []).indexOf(card) < 0) return state; // 公開された$3-6のみ
        const rest = pd.revealed.slice(); removeOne(rest, card);
        trashCard(state, pd.victim, card);
        rest.forEach((c) => v.discard.push(c));
        log(state, `${v.name} は盗賊で「${C()[card].name}」を廃棄した。`);
        rogueEnterVictim(state, pd.source, pd.queue);
        return state;
      }
      case 'ROGUE_GAIN_FROM_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'rogue' || pd.stage !== 'gain_from_trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        const cc = card != null ? cardCost(state, card) : -1;
        if (card == null || state.trash.indexOf(card) < 0 || cc < 3 || cc > 6 || potionCost(card) !== 0) return state; // 獲得は強制
        removeOne(state.trash, card);
        // 「獲得」は公開ではない＝パトロンは誘発しない（表示のみ）。
        reveal(state, pd.player, [card], '盗賊で廃棄置き場から獲得', { notReveal: true });
        state.pending = null; // 先に閉じてから獲得＝獲得時対話を立てられる
        gainFromOutside(state, pd.player, card, 'discard'); // 支配の振り分け＋獲得トリガー
        log(state, `${p.name} は盗賊で廃棄置き場の「${C()[card].name}」を獲得した。`);
        return state;
      }
      case 'DISCARD_DOWN_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'discard_down') return state;
        const p = state.players[pd.player];
        const target = Math.min(pd.down, p.hand.length);
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (p.hand.length - cards.length !== target) return state;
        const copy = p.hand.slice();
        for (const c of cards) if (!removeOne(copy, c)) return state;
        cards.forEach((c) => { removeOne(p.hand, c); p.discard.push(c); });
        log(state, `${p.name} は手札を ${cards.length}枚 捨てた。`);
        // 帝国：軍団兵＝手札2枚まで捨てた各相手は、その後カードを1枚引く（drawAfter）。
        if (pd.drawAfter) { draw(state, pd.player, pd.drawAfter); log(state, `${p.name} は +${pd.drawAfter}カード。`); }
        advanceDiscardDown(state, pd);
        return state;
      }
      case 'MERCENARY_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'mercenary' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (cards.length === 0) { state.pending = null; return state; } // 廃棄しない＝何も起きない
        if (cards.length > 2) return state; // 最大2枚
        const copy = p.hand.slice();
        for (const c of cards) if (!removeOne(copy, c)) return state;
        cards.forEach((c) => { removeOne(p.hand, c); trashCard(state, pd.player, c); });
        log(state, `${p.name} は傭兵で手札${cards.length}枚を廃棄した。`);
        if (cards.length < 2) { state.pending = null; return state; } // ちょうど2枚でなければ「If you did」不成立＝効果なし
        // If you did：+2カード +$2、各相手が手札3枚まで捨てる
        draw(state, pd.player, 2); addCoins(state, 2);
        const others = [];
        for (let k = 1; k < state.players.length; k++) { const idx = (pd.player + k) % state.players.length; if (state.players[idx].hand.length > 3 && !attackImmune(state, idx)) others.push(idx); }
        discardDownEnter(state, pd.player, 3, others);
        return state;
      }
      case 'URCHIN_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'urchin_trash') return state;
        const p = state.players[pd.player];
        if (action.trash && removeOne(p.inPlay, 'urchin')) {
          trashCard(state, pd.player, 'urchin');
          if (gain(state, pd.player, 'mercenary', 'discard')) log(state, `${p.name} は浮浪児を廃棄して傭兵を獲得した。`);
        }
        state.pending = null;
        /* 夜想曲：夜フェイズの人狼/吸血鬼/夜襲から来た場合は、**カードを場に出してから**効果を解決する
           （PLAY_NIGHT は浮浪児の窓を開く時点でまだ場に出していない）。 */
        if (pd.deferredNight) {
          const t2 = state.turn;
          p.inPlay.push(pd.deferredNight);
          t2.nightPlayed = (t2.nightPlayed || 0) + 1;
          if (DOM.isType(pd.deferredNight, 'action')) {
            t2.actionsPlayed = (t2.actionsPlayed || 0) + 1;
            t2.afterActionCard = pd.deferredNight;
          }
          applyPileTokens(state, pd.player, pd.deferredNight);
          log(state, `${p.name} は「${C()[pd.deferredNight].name}」を使った（夜フェイズ）。`);
          applyEffect(state, pd.deferredNight, pd.player);
          return state;
        }
        applyEffect(state, pd.deferred, pd.player); // 保留していたアタックの効果を解決
        return state;
      }
      /* ===== 暗黒時代：騎士（混合山アタック）の選択解決 ===== */
      case 'KNIGHT_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'knight' || pd.stage !== 'react') return state;
        knightReveal(state, pd.source, pd.sourceCard, pd.victim, pd.queue);
        return state;
      }
      case 'KNIGHT_PICK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'knight' || pd.stage !== 'pick') return state;
        const card = action.card;
        if ((pd.trashable || []).indexOf(card) < 0) return state; // 公開された$3-6のみ
        knightDoTrash(state, pd.source, pd.sourceCard, pd.victim, pd.revealed, card, pd.queue);
        return state;
      }
      case 'DAME_ANNA_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'dame_anna_trash') return state;
        const p = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (cards.length > 2) return state; // 最大2枚
        const copy = p.hand.slice();
        for (const c of cards) if (!removeOne(copy, c)) return state;
        cards.forEach((c) => { removeOne(p.hand, c); trashCard(state, pd.player, c); });
        if (cards.length) log(state, `${p.name} はデイム・アンナで ${cards.length}枚 を廃棄した。`);
        startKnightAttack(state, pd.player, 'dame_anna');
        return state;
      }
      case 'DAME_NATALIE_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'dame_natalie_gain') return state;
        const card = action.card; // 任意（up to $3）。null なら獲得せずアタックへ。
        if (card != null) {
          if (!costUpTo(state, card, 3)) return state;
          gain(state, pd.player, card, 'discard');
          log(state, `${state.players[pd.player].name} はデイム・ナタリーで「${C()[card].name}」を獲得した。`);
        }
        startKnightAttack(state, pd.player, 'dame_natalie');
        return state;
      }

      /* ===== 拡張: 海辺（Seaside 第二版）の選択解決 ===== */
      case 'WAREHOUSE_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'warehouse') return state;
        const p = state.players[pd.player];
        const want = Math.min(3, p.hand.length);
        if (!discardFromHand(state, pd.player, action.cards, want, '捨てた（倉庫）。')) return state;
        state.pending = null;
        return state;
      }
      case 'HAVEN_SETASIDE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'haven') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card); p.setAside.push(card);
        armDuration(state, pd.player, 'haven', { stashed: card });
        log(state, `${p.name} は手札1枚を脇に置いた（停泊所）。`);
        state.pending = null;
        return state;
      }
      /* ---- 冒険：地下牢＝手札2枚を捨てる（今／次の手番。次の手番ぶんは startQueue 経由） ---- */
      case 'DUNGEON_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'dungeon_discard') return state;
        const p = state.players[pd.player];
        const want = Math.min(2, p.hand.length);
        if (!discardFromHand(state, pd.player, action.cards, want, '捨てた（地下牢）。')) return state;
        if (pd.viaStart) popStartQueue(state); else state.pending = null;
        return state;
      }
      /* ---- 冒険：魔除け＝今／次の手番に 3択（+$1／手札1枚廃棄／銀貨獲得） ---- */
      case 'AMULET_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'amulet') return state;
        const p = state.players[pd.player];
        const mode = action.mode;
        if (mode === 'coin') { addCoins(state, 1); log(state, `${p.name} は魔除けで +$1。`); }
        else if (mode === 'silver') { if (gain(state, pd.player, 'silver', 'discard')) log(state, `${p.name} は魔除けで銀貨を獲得した。`); }
        else if (mode === 'trash') {
          if (p.hand.length > 0) { state.pending = { type: 'amulet_trash', player: pd.player, viaStart: pd.viaStart }; return state; }
          log(state, `${p.name} は魔除けで廃棄する手札が無かった。`);
        } else return state; // 不正モード＝状態不変
        if (pd.viaStart) popStartQueue(state); else state.pending = null;
        return state;
      }
      case 'AMULET_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'amulet_trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card); trashCard(state, pd.player, card);
        log(state, `${p.name} は「${C()[card].name}」を廃棄した（魔除け）。`);
        if (pd.viaStart) popStartQueue(state); else state.pending = null;
        return state;
      }
      /* ---- 冒険：道具＝手札から最大2枚を脇に置く（次の手番開始時に手札へ戻る） ---- */
      case 'GEAR_SETASIDE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'gear') return state;
        const p = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards.slice(0, 2) : [];
        const tmp = p.hand.slice();
        for (const c of cards) { const i = tmp.indexOf(c); if (i < 0) return state; tmp.splice(i, 1); } // 全て手札にあること
        cards.forEach((c) => { removeOne(p.hand, c); p.setAside.push(c); });
        if (cards.length > 0) { armDuration(state, pd.player, 'gear', { stashed: cards.slice() }); log(state, `${p.name} は手札 ${cards.length}枚 を脇に置いた（道具。次の手番に戻す）。`); }
        else log(state, `${p.name} は道具で脇に置かなかった。`);
        state.pending = null;
        return state;
      }
      /* ---- 冒険：酒場マット（Reserve）の呼び出し ---- */
      // 守銭奴：手札の銅貨1枚を酒場マットへ置く／酒場マットの銅貨1枚につき +$1。
      case 'MISER_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'miser') return state;
        const p = state.players[pd.player];
        if (action.mode === 'bank') {
          if (removeOne(p.hand, 'copper')) { (p.tavern = p.tavern || []).push('copper'); log(state, `${p.name} は守銭奴で銅貨1枚を酒場マットに置いた。`); }
          else log(state, `${p.name} は守銭奴で置く銅貨が手札に無かった。`);
        } else { // coins（既定）：マットの銅貨1枚につき +$1
          const n = (p.tavern || []).filter((c) => c === 'copper').length;
          addCoins(state, n); log(state, `${p.name} は守銭奴で酒場マットの銅貨 ${n}枚 → +$${n}。`);
        }
        state.pending = null;
        return state;
      }
      // ターン開始の呼び出し窓：案内人/鼠取り/変容 を1枚呼び出す（card=null で呼び出さず次へ）。
      case 'TAVERN_START_CALL': {
        const pd = state.pending;
        if (!pd || pd.type !== 'tavern_start') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (card == null) { popStartQueue(state); return state; } // 呼び出さない＝次の開始時効果へ
        if (!TAVERN_START_CALLS.includes(card) || (p.tavern || []).indexOf(card) < 0) return state; // 不正
        removeOne(p.tavern, card); p.inPlay.push(card); // マット→場（cleanup で捨て札へ）
        t.actionsPlayed = (t.actionsPlayed || 0) + 1; // 呼び出しもプレイ（共謀者等の判定）
        log(state, `${p.name} は酒場マットから「${C()[card].name}」を呼び出した。`);
        if (card === 'guide') {
          const n = p.hand.length; if (n) { p.discard.push(...p.hand); p.hand = []; }
          draw(state, pd.player, 5);
          log(state, `${p.name} は案内人で手札${n}枚を捨てて5枚引いた。`);
          offerTavernStart(state, pd.player); // 続けて呼び出せるか
        } else if (card === 'ratcatcher') {
          if (p.hand.length > 0) state.pending = { type: 'ratcatcher_trash', player: pd.player };
          else { log(state, `${p.name} は鼠取りで廃棄する手札が無かった。`); offerTavernStart(state, pd.player); }
        } else if (card === 'transmogrify') {
          if (p.hand.length > 0) state.pending = { type: 'transmogrify_trash', player: pd.player };
          else { log(state, `${p.name} は変容で廃棄する手札が無かった。`); offerTavernStart(state, pd.player); }
        } else if (card === 'teacher') {
          // 置ける山があればトークン種別→山 の順で選ぶ。無ければトークン移動なし（稀）。
          if (validTeacherPiles(state, pd.player).length) state.pending = { type: 'teacher_call', stage: 'token', player: pd.player };
          else { log(state, `${p.name} は教師でトークンを置ける山が無かった。`); offerTavernStart(state, pd.player); }
        }
        return state;
      }
      // 冒険：教師＝移動するトークンの種別を選ぶ（+1カード/+1アクション/+1購入/+1コイン）。
      case 'TEACHER_TOKEN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'teacher_call' || pd.stage !== 'token') return state;
        const token = action.token;
        if (['card', 'action', 'buy', 'coin'].indexOf(token) < 0) return state;
        state.pending = { type: 'teacher_call', stage: 'pile', player: pd.player, token };
        return state;
      }
      // 冒険：教師＝トークンを置くアクション山を選ぶ（自分のトークンが無い山）。
      case 'TEACHER_PILE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'teacher_call' || pd.stage !== 'pile') return state;
        const p = state.players[pd.player];
        const pile = action.card;
        if (validTeacherPiles(state, pd.player).indexOf(pile) < 0) return state; // 不正な山は再選択
        p.pileTokens = p.pileTokens || {};
        p.pileTokens[pd.token] = pile; // トークンを移動（元の山からは自動的に外れる＝各種別1つ）
        log(state, `${p.name} は「${C()[pile].name}」の山に +1${TOKEN_LABEL[pd.token]}トークンを置いた（教師）。`);
        offerTavernStart(state, pd.player); // 続けて呼び出せるか
        return state;
      }
      case 'RATCATCHER_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'ratcatcher_trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card); trashCard(state, pd.player, card);
        log(state, `${p.name} は鼠取りで「${C()[card].name}」を廃棄した。`);
        offerTavernStart(state, pd.player);
        return state;
      }
      case 'TRANSMOGRIFY_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'transmogrify_trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        const tr = costOf(state, card);
        const maxCost = tr.coin + 1;
        removeOne(p.hand, card); trashCard(state, pd.player, card);
        log(state, `${p.name} は変容で「${C()[card].name}」を廃棄した。`);
        // そのコスト+$1以下のカード1枚を手札に獲得（強制。獲得先が無ければ呼び出し窓へ戻る）。
        if (anyGainable(state, (id) => costUpTo(state, id, maxCost, tr)))
          state.pending = { type: 'transmogrify_gain', player: pd.player, maxCost, pot: tr.pot, debt: tr.debt };
        else offerTavernStart(state, pd.player);
        return state;
      }
      case 'TRANSMOGRIFY_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'transmogrify_gain') return state;
        // 手札に獲得（finishGain は pending を閉じるので、その後 呼び出し窓へ戻す）。
        finishGain(state, pd, action.card, (id) => costUpTo(state, id, pd.maxCost, pd), 'hand', '獲得した（変容）。');
        if (!state.pending) offerTavernStart(state, pd.player); // 獲得が成立して pending が閉じたら次の呼び出しへ
        return state;
      }
      // ワイン商：購入フェイズ終了時、酒場マットから捨ててよい（$2以上残っているとき）。
      case 'WINE_MERCHANT_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'wine_merchant') return state;
        const p = state.players[pd.player];
        state.pending = null;
        if (action.discard && removeOne(p.tavern, 'wine_merchant')) {
          p.discard.push('wine_merchant');
          log(state, `${p.name} はワイン商を酒場マットから捨てた。`);
          // まだ$2以上残り＆マットにワイン商があれば続けて捨ててよい。
          if (t.coins >= 2 && (p.tavern || []).includes('wine_merchant')) { state.pending = { type: 'wine_merchant', player: pd.player }; return state; }
        }
        endBuyTail(state); // 呼び出し窓を抜けたら購入フェイズ終了の後処理へ
        return state;
      }
      // アクション解決直後の呼び出し窓：法貨（+2アクション）／御料車（場のアクションを再演）。
      case 'AFTER_ACTION_CALL': {
        const pd = state.pending;
        if (!pd || pd.type !== 'after_action') return state;
        const p = state.players[pd.player];
        const card = action.card; // 'coin_of_the_realm' | 'royal_carriage' | null
        if (card == null) { t.afterActionCard = null; state.pending = null; return state; } // 呼び出さない
        if (card === 'coin_of_the_realm' && (p.tavern || []).includes('coin_of_the_realm')) {
          removeOne(p.tavern, 'coin_of_the_realm'); p.inPlay.push('coin_of_the_realm');
          addActions(t, 2);
          log(state, `${p.name} は法貨を呼び出した（+2アクション）。`);
          state.pending = null; // afterActionCard は保持＝reduce末尾の窓が再オファー（別の法貨/御料車）
          return state;
        }
        if (card === 'royal_carriage' && (p.tavern || []).includes('royal_carriage') && p.inPlay.includes(pd.card)) {
          removeOne(p.tavern, 'royal_carriage'); p.inPlay.push('royal_carriage');
          state.replay = state.replay || [];
          state.replay.push({ player: pd.player, card: pd.card, label: 'royal_carriage' });
          log(state, `${p.name} は御料車を呼び出して「${C()[pd.card].name}」を再演する。`);
          state.pending = null; // runReplays が再演。afterActionCard 保持＝再演後に窓が再オファー
          return state;
        }
        return state; // 不正な card は据え置き（再選択）
      }
      // 複製：$6以下のカードを獲得したとき、酒場マットの複製を呼び出してコピーを獲得してよい。
      case 'DUPLICATE_CALL': {
        const pd = state.pending;
        if (!pd || pd.type !== 'duplicate') return state;
        const p = state.players[pd.player];
        // 受理側も同じ述語で締める（オンライン永続化の旧スナップショットから復元した pending も弾く）。
        if (action.call && (p.tavern || []).includes('duplicate') && costUpTo(state, pd.card, 6)) {
          removeOne(p.tavern, 'duplicate'); p.inPlay.push('duplicate');
          // pending を保持したままコピーを獲得＝入れ子の複製オファーを抑止（!state.pending ゲートが働く）。
          gain(state, pd.player, pd.card, 'discard');
          log(state, `${p.name} は複製を呼び出して「${C()[pd.card].name}」のコピーを獲得した。`);
          // 別の複製がまだあり、コピー先も残っていれば同じカードに対して再オファー。
          if ((p.tavern || []).includes('duplicate') && costUpTo(state, pd.card, 6)) return state; // pending 保持で再オファー
        }
        state.pending = null;
        return state;
      }
      case 'TACTICIAN_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'tactician') return state;
        const p = state.players[pd.player];
        if (action.discard && p.hand.length > 0) {
          const n = p.hand.length;
          p.discard.push(...p.hand); p.hand = [];
          armDuration(state, pd.player, 'tactician');
          log(state, `${p.name} は手札${n}枚を全て捨てた（策士。次の手番に +5カード等）。`);
        } else {
          log(state, `${p.name} は策士で手札を捨てなかった（持続しない）。`);
        }
        state.pending = null;
        return state;
      }
      case 'SALVAGER_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'salvager' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (card == null) { state.pending = null; return state; } // 廃棄しない（手札があるが任意ではないが安全に）
        if (p.hand.indexOf(card) < 0) return state;
        const gainCoins = cardCost(state, card);
        removeOne(p.hand, card); trashCard(state, pd.player, card);
        addCoins(state, gainCoins);
        log(state, `${p.name} は「${C()[card].name}」を廃棄し +${gainCoins}コイン（引揚水夫）。`);
        state.pending = null;
        return state;
      }
      case 'LOOKOUT_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'lookout' || pd.stage !== 'trash') return state;
        const card = action.card;
        if (pd.cards.indexOf(card) < 0) return state;
        const rest = pd.cards.slice(); removeOne(rest, card);
        trashCard(state, pd.player, card);
        log(state, `${state.players[pd.player].name} は「${C()[card].name}」を廃棄した（見張り）。`);
        if (rest.length === 0) { state.pending = null; return state; }
        state.pending = { type: 'lookout', stage: 'discard', player: pd.player, cards: rest };
        return state;
      }
      case 'LOOKOUT_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'lookout' || pd.stage !== 'discard') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (pd.cards.indexOf(card) < 0) return state;
        const rest = pd.cards.slice(); removeOne(rest, card);
        p.discard.push(card);
        log(state, `${p.name} は「${C()[card].name}」を捨てた（見張り）。`);
        // 残りは山札の上へ（順序維持）
        for (let i = rest.length - 1; i >= 0; i--) p.deck.unshift(rest[i]);
        state.pending = null;
        return state;
      }
      case 'ISLAND_PICK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'island') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card); p.islandMat.push(card);
        log(state, `${p.name} は「${C()[card].name}」を島マットに置いた。`);
        state.pending = null;
        return state;
      }
      case 'NATIVE_VILLAGE_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'native_village') return state;
        const p = state.players[pd.player];
        if (action.mode === 'take') {
          if (p.nativeVillageMat.length) { p.hand.push(...p.nativeVillageMat); log(state, `${p.name} は原住民の村マットの ${p.nativeVillageMat.length}枚 を手札に加えた。`); p.nativeVillageMat = []; }
        } else { // 'set'：山札の上1枚を見ずにマットへ
          if (p.deck.length === 0 && p.discard.length > 0) { reshuffleDeck(p); }
          if (p.deck.length > 0) { p.nativeVillageMat.push(p.deck.shift()); log(state, `${p.name} は山札の上1枚を原住民の村マットに置いた。`); }
        }
        state.pending = null;
        return state;
      }
      case 'TIDE_POOLS_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'tide_pools_discard') return state;
        const p = state.players[pd.player];
        const want = Math.min(2, p.hand.length);
        if (!discardFromHand(state, pd.player, action.cards, want, '捨てた（潮だまり）。')) return state;
        popStartQueue(state); // 開始時キューの次へ（無ければ通常の手番へ）
        return state;
      }
      case 'CUTPURSE_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'cutpurse' || pd.stage !== 'react') return state;
        cutpurseApply(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'SEA_WITCH_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'sea_witch' || pd.stage !== 'react') return state;
        seaWitchCurse(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'SEA_WITCH_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'sea_witch_discard') return state;
        const p = state.players[pd.player];
        const want = Math.min(2, p.hand.length);
        if (!discardFromHand(state, pd.player, action.cards, want, '捨てた（海の魔女）。')) return state;
        popStartQueue(state);
        return state;
      }
      case 'SMUGGLERS_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'smugglers') return state;
        const card = action.card;
        // 受理時にも述語を再検査する（pending の候補配列は永続化スナップショットから無変換で復元されるため）。
        const valid = (pd.candidates || []).filter((id) => costUpTo(state, id, 6));
        if (!valid.length) { state.pending = null; return state; } // 終端保証（候補が全て無効化された）
        if (valid.indexOf(card) < 0) return state;
        // gain が拒否したら（分割山の下段アヴァント等）獲得無しで解決（候補は他に無い前提の安全側）
        if (gain(state, pd.player, card, 'discard')) {
          log(state, `${state.players[pd.player].name} は密輸人で「${C()[card].name}」を獲得した。`);
        }
        state.pending = null;
        return state;
      }
      case 'BLOCKADE_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'blockade' || pd.stage !== 'gain') return state;
        const card = action.card;
        if (card == null || !costUpTo(state, card, 4)) return state;
        // 混合山（騎士/城/同盟の分割山）は「一番上の実カード」を獲得する＝封鎖が見張るのもその実カード。
        const realId = isMixedPileKey(card) ? (state[card] || [])[0] : card;
        if (!realId) return state;
        // **必ず gain() を通す**（混合山の shift・負債の付与・分割山ガード・獲得トリガー・支配の振り分けが一括で効く）。
        if (!gain(state, pd.player, card, 'setAside')) return state;
        armDuration(state, pd.player, 'blockade', { gained: realId, immune: [] });
        log(state, `${state.players[pd.player].name} は封鎖で「${C()[realId].name}」を獲得し脇に置いた。`);
        // アタック：各相手に「堀で免疫」窓を出す（堀公開者はこの封鎖の呪いから免疫）。
        const bq = [];
        for (let k = 1; k < state.players.length; k++) bq.push((pd.player + k) % state.players.length);
        state.pending = null;
        blockadeEnterVictim(state, pd.player, bq, realId);
        return state;
      }
      case 'BLOCKADE_REACT': {
        // 封鎖のアタックを堀を出さずに受ける（免疫は付かず、次の被害者へ進む）。
        const pd = state.pending;
        if (!pd || pd.type !== 'blockade' || pd.stage !== 'react') return state;
        blockadeEnterVictim(state, pd.source, pd.queue, pd.gained);
        return state;
      }
      case 'PIRATE_REACT': {
        // 海賊のリアクション：手札の海賊を使う/使わない。使うと場に出して持続予約。
        const pd = state.pending;
        if (!pd || pd.type !== 'pirate_react') return state;
        const p = state.players[pd.player];
        if (action.play && removeOne(p.hand, 'pirate')) {
          p.inPlay.push('pirate');
          armDuration(state, pd.player, 'pirate');
          log(state, `${p.name} は海賊をリアクションで使った（次の手番に財宝を手札に獲得）。`);
        }
        pirateReactEnter(state, pd.queue);
        return state;
      }
      case 'SAILOR_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'sailor_trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (card != null && p.hand.indexOf(card) >= 0) {
          removeOne(p.hand, card); trashCard(state, pd.player, card);
          log(state, `${p.name} は「${C()[card].name}」を廃棄した（船乗り）。`);
        }
        popStartQueue(state);
        return state;
      }
      case 'SAILOR_PLAY_GAIN': {
        // 船乗り：獲得した持続カードを即プレイする/しない。
        const pd = state.pending;
        if (!pd || pd.type !== 'sailor_play_gain') return state;
        const p = state.players[pd.player];
        state.pending = null; // 先に解除（プレイで新たな pending が立つ場合に上書きされないように）
        if (action.play) {
          const zone = zoneOf(p, pd.dest);
          if (removeOne(zone, pd.card)) {
            p.inPlay.push(pd.card); // 場へ。持続効果は applyEffect→armDuration で予約され、cleanup で durationCards へ移る
            log(state, `${p.name} は船乗りで獲得した「${C()[pd.card].name}」を使った。`);
            applyEffect(state, pd.card, pd.player);
          }
        }
        return state;
      }
      case 'PIRATE_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'pirate_gain') return state;
        const card = action.card;
        const canGain = (id) => costUpTo(state, id, 6) && isTreasureFor(state, id);
        if (card == null) { // 候補が無ければスキップ可
          if (anyGainable(state, canGain)) return state;
          popStartQueue(state); return state;
        }
        if (!canGain(card) || (state.supply[card] || 0) <= 0) return state;
        gain(state, pd.player, card, 'hand');
        log(state, `${state.players[pd.player].name} は海賊で「${C()[card].name}」を手札に獲得した。`);
        popStartQueue(state);
        return state;
      }

      /* ===== 拡張: 錬金術（Alchemy 第二版）の選択解決 ===== */
      /* ---- 変成：廃棄1枚→種類ごとに獲得 ---- */
      case 'TRANSMUTE_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'transmute') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card);
        trashCard(state, pd.player, card);
        log(state, `${p.name} は「${C()[card].name}」を廃棄した（変成）。`);
        // 多重タイプは各該当ぶん獲得（例：大広間=アクション+勝利点→公領+金貨）。
        if (DOM.isType(card, 'action') && gain(state, pd.player, 'duchy', 'discard')) log(state, `${p.name} は公領を獲得した（変成）。`);
        if (isTreasureFor(state, card) && gain(state, pd.player, 'transmute', 'discard')) log(state, `${p.name} は変成を獲得した（変成）。`);
        if (DOM.isType(card, 'victory') && gain(state, pd.player, 'gold', 'discard')) log(state, `${p.name} は金貨を獲得した（変成）。`);
        state.pending = null;
        return state;
      }
      /* ---- 薬剤師：残りを好きな順で山札の上に戻す ---- */
      case 'APOTHECARY_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'apothecary') return state;
        const p = state.players[pd.player];
        const order = Array.isArray(action.order) && action.order.length ? action.order : pd.cards.slice();
        // 検証：order が pd.cards の並べ替えであること（不正なら据え置き）
        const a = order.slice().sort(), b = pd.cards.slice().sort();
        if (a.length !== b.length || !a.every((x, i) => x === b[i])) return state;
        for (let i = order.length - 1; i >= 0; i--) p.deck.unshift(order[i]); // order[0] が一番上
        log(state, `${p.name} は残り ${order.length}枚 を山札の上に戻した（薬剤師）。`);
        state.pending = null;
        return state;
      }
      /* ---- 念視の泉：相手のリアクション／使用者が捨てるか戻すか ---- */
      case 'SCRYING_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'scrying_pool' || pd.stage !== 'react') return state;
        scryingReveal(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'SCRYING_DECIDE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'scrying_pool' || pd.stage !== 'decide') return state;
        const tp = state.players[pd.victim];
        if (action.discard && tp.deck.length > 0) {
          const c = tp.deck.shift(); tp.discard.push(c);
          log(state, `${tp.name} は山札の上の「${C()[c].name}」を捨てた（念視の泉）。`);
        } else {
          log(state, `${tp.name} は山札の上をそのままにした（念視の泉）。`);
        }
        scryingEnterTarget(state, pd.source, pd.queue);
        return state;
      }
      /* ---- 大学：コスト5以下のアクションを獲得（任意）---- */
      case 'UNIVERSITY_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'university') return state;
        if (action.card == null) { state.pending = null; return state; } // 獲得しない
        finishGain(state, pd, action.card, (id) => costUpTo(state, id, 5) && isTypeSupply(state, id, 'action'), 'discard', '獲得した（大学）。');
        return state;
      }
      /* ---- 使い魔：呪いを受ける ---- */
      case 'FAMILIAR_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'familiar' || pd.stage !== 'react') return state;
        familiarCurse(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      /* ---- ゴーレム：見つけた2枚を使う順を選ぶ ---- */
      case 'GOLEM_ORDER': {
        const pd = state.pending;
        if (!pd || pd.type !== 'golem') return state;
        const first = action.first;
        const idx = pd.cards.indexOf(first);
        if (idx < 0) return state;
        const second = pd.cards[idx === 0 ? 1 : 0];
        golemPlay(state, pd.player, first, second);
        return state;
      }
      /* ---- 徒弟：廃棄1枚→コイン費用ぶん引く（ポーション費用ありは+2）---- */
      case 'APPRENTICE_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'apprentice') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (card == null || p.hand.indexOf(card) < 0) return state; // 手札があれば廃棄必須
        removeOne(p.hand, card);
        trashCard(state, pd.player, card);
        const n = cardCost(state, card) + (potionCost(card) ? 2 : 0);
        draw(state, pd.player, n);
        log(state, `${p.name} は「${C()[card].name}」を廃棄して ${n}枚 引いた（徒弟）。`);
        state.pending = null;
        return state;
      }

      /* ===== 繁栄（Prosperity）の選択解決 ===== */
      case 'CHARLATAN_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'charlatan' || pd.stage !== 'react') return state;
        charlatanApply(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'RABBLE_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'rabble' || pd.stage !== 'react') return state;
        rabbleApply(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'CLERK_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'clerk' || pd.stage !== 'react') return state;
        clerkProceed(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'CLERK_TOPDECK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'clerk' || pd.stage !== 'topdeck') return state;
        const v = state.players[pd.victim];
        const card = action.card;
        if (v.hand.indexOf(card) < 0) return state;
        removeOne(v.hand, card); v.deck.unshift(card);
        log(state, `${v.name} は手札1枚を山札の上に置いた（会計士）。`);
        clerkEnterVictim(state, pd.source, pd.queue);
        return state;
      }
      case 'CLERK_START': {
        // 繁栄：会計士の手番開始時リアクション＝手札から（アクション消費せず）使う/使わない。
        const pd = state.pending;
        if (!pd || pd.type !== 'clerk_start') return state;
        const p = state.players[pd.player];
        if (action.play && p.hand.includes('clerk')) {
          removeOne(p.hand, 'clerk'); p.inPlay.push('clerk');
          t.actionsPlayed = (t.actionsPlayed || 0) + 1;
          log(state, `${p.name} は手番開始時に会計士を使った。`);
          applyEffect(state, 'clerk', pd.player); // +2コイン＋アタック
          // 開始キューの進行は clerkEnterVictim の終端が popStartQueue で行う（アタックが pending を立てた
          // 場合はその解決後に、立たなければ即座に）。ここでは何もしない＝2枚目以降の会計士も確実に使える。
        } else {
          popStartQueue(state);
        }
        return state;
      }
      case 'BISHOP_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'bishop' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card); trashCard(state, pd.player, card);
        const add = Math.floor(cardCost(state, card) / 2);
        if (add) p.vpTokens = (p.vpTokens || 0) + add;
        log(state, `${p.name} は「${C()[card].name}」を廃棄し +${add}勝利点（司教）。`);
        const others = [];
        for (let k = 1; k < state.players.length; k++) others.push((pd.player + k) % state.players.length);
        bishopOthersEnter(state, others);
        return state;
      }
      case 'BISHOP_OTHER': {
        const pd = state.pending;
        if (!pd || pd.type !== 'bishop' || pd.stage !== 'other') return state;
        const v = state.players[pd.player];
        const card = action.card; // null = 廃棄しない
        if (card != null) {
          if (v.hand.indexOf(card) < 0) return state;
          removeOne(v.hand, card); trashCard(state, pd.player, card);
          log(state, `${v.name} は「${C()[card].name}」を廃棄した（司教）。`);
        }
        bishopOthersEnter(state, pd.queue);
        return state;
      }
      case 'VAULT_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'vault' || pd.stage !== 'discard') return state;
        const p = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        const copy = p.hand.slice();
        for (const c of cards) if (!removeOne(copy, c)) return state;
        cards.forEach((c) => { removeOne(p.hand, c); p.discard.push(c); });
        addCoins(state, cards.length);
        if (cards.length) log(state, `${p.name} は金庫室で ${cards.length}枚捨てて +${cards.length}コイン。`);
        const others = [];
        for (let k = 1; k < state.players.length; k++) others.push((pd.player + k) % state.players.length);
        vaultOthersEnter(state, others);
        return state;
      }
      case 'VAULT_OTHER': {
        const pd = state.pending;
        if (!pd || pd.type !== 'vault' || pd.stage !== 'other') return state;
        const v = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (cards.length === 2) {
          const copy = v.hand.slice();
          let okk = true;
          for (const c of cards) if (!removeOne(copy, c)) okk = false;
          if (okk) {
            cards.forEach((c) => { removeOne(v.hand, c); v.discard.push(c); });
            draw(state, pd.player, 1);
            log(state, `${v.name} は金庫室で2枚捨てて1枚引いた。`);
          }
        }
        vaultOthersEnter(state, pd.queue);
        return state;
      }
      case 'MINT_REVEAL': {
        const pd = state.pending;
        if (!pd || pd.type !== 'mint') return state;
        const p = state.players[pd.player];
        const card = action.card; // null = 公開しない
        if (card != null && p.hand.indexOf(card) >= 0 && isTreasureFor(state, card)) {
          reveal(state, pd.player, [card], '造幣所：財宝を公開');
          // 非サプライ（戦利品/宝冠 等）のコピーは造幣所では獲得できない（サプライに山が無い＝gainableBase）。
          if (gainableBase(state, card)) { gain(state, pd.player, card, 'discard'); log(state, `${p.name} は造幣所で「${C()[card].name}」を獲得した。`); }
        }
        state.pending = null;
        return state;
      }
      case 'EXPAND_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'expand' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0) return state;
        removeOne(p.hand, card); trashCard(state, pd.player, card);
        const er = costOf(state, card);
        const maxCost = er.coin + 3;
        log(state, `${p.name} は「${C()[card].name}」を廃棄した（拡張）。`);
        if (anyGainable(state, (id) => costUpTo(state, id, maxCost, er))) state.pending = { type: 'expand', stage: 'gain', player: pd.player, maxCost, pot: er.pot, debt: er.debt };
        else state.pending = null;
        return state;
      }
      case 'EXPAND_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'expand' || pd.stage !== 'gain') return state;
        const card = action.card;
        if (!costUpTo(state, card, pd.maxCost, pd)) return state;
        gain(state, pd.player, card, 'discard');
        log(state, `${state.players[pd.player].name} は「${C()[card].name}」を獲得した（拡張）。`);
        state.pending = null;
        return state;
      }
      case 'FORGE_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'forge' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        const copy = p.hand.slice();
        for (const c of cards) if (!removeOne(copy, c)) return state;
        let total = 0;
        cards.forEach((c) => { total += cardCost(state, c); });
        cards.forEach((c) => { removeOne(p.hand, c); trashCard(state, pd.player, c); });
        log(state, `${p.name} は溶鉱炉で ${cards.length}枚を廃棄（合計$${total}）。`);
        if (anyGainable(state, (id) => costExact(state, id, total, 0, 0))) state.pending = { type: 'forge', stage: 'gain', player: pd.player, exact: total };
        else { log(state, `${p.name} はちょうど$${total}のカードが無く、何も獲得しなかった（溶鉱炉）。`); state.pending = null; }
        return state;
      }
      case 'FORGE_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'forge' || pd.stage !== 'gain') return state;
        const card = action.card;
        if (!costExact(state, card, pd.exact, 0, 0)) return state;
        gain(state, pd.player, card, 'discard');
        log(state, `${state.players[pd.player].name} は「${C()[card].name}」を獲得した（溶鉱炉）。`);
        state.pending = null;
        return state;
      }
      case 'KINGS_COURT_CHOOSE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'kings_court') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0 || !DOM.isType(card, 'action')) return state;
        removeOne(p.hand, card); p.inPlay.push(card);
        t.actionsPlayed = (t.actionsPlayed || 0) + 1;
        state.pending = null;
        log(state, `${p.name} は王の宮廷で「${C()[card].name}」を使った（1回目）。`);
        applyEffect(state, card, pd.player); // 1回目
        state.replay = state.replay || [];
        state.replay.push({ player: pd.player, card }); // 2回目
        state.replay.push({ player: pd.player, card }); // 3回目（runReplays が pending 解消ごとに消化）
        return state;
      }
      case 'WAR_CHEST_NAME': {
        const pd = state.pending;
        if (!pd || pd.type !== 'war_chest' || pd.stage !== 'name') return state;
        const card = action.card;
        if (!C()[card]) return state;
        t.warChestNamed = t.warChestNamed || [];
        t.warChestNamed.push(card);
        log(state, `${state.players[pd.player].name} は軍用金で「${C()[card].name}」を指定した。`);
        const named = t.warChestNamed;
        if (anyGainable(state, (id) => costUpTo(state, id, 5) && named.indexOf(id) < 0)) state.pending = { type: 'war_chest', stage: 'gain', player: pd.source, source: pd.source };
        else state.pending = null;
        return state;
      }
      case 'WAR_CHEST_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'war_chest' || pd.stage !== 'gain') return state;
        const card = action.card;
        const named = t.warChestNamed || [];
        if (!costUpTo(state, card, 5) || named.indexOf(card) >= 0) return state;
        gain(state, pd.player, card, 'discard');
        log(state, `${state.players[pd.player].name} は軍用金で「${C()[card].name}」を獲得した。`);
        state.pending = null;
        return state;
      }
      case 'WATCHTOWER': {
        const pd = state.pending;
        if (!pd || pd.type !== 'watchtower') return state;
        const p = state.players[pd.player];
        const choice = action.choice; // 'trash' | 'topdeck' | 'keep'
        const zone = zoneOf(p, pd.dest);
        if (choice === 'trash') { if (removeOne(zone, pd.card)) { trashCard(state, pd.player, pd.card); log(state, `${p.name} は物見やぐらで「${C()[pd.card].name}」を廃棄した。`); } }
        else if (choice === 'topdeck') { if (removeOne(zone, pd.card)) { p.deck.unshift(pd.card); log(state, `${p.name} は物見やぐらで「${C()[pd.card].name}」を山札の上に置いた。`); } }
        state.pending = null;
        return state;
      }
      case 'TIARA_TOPDECK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'tiara_topdeck') return state;
        const p = state.players[pd.player];
        if (action.topdeck) {
          const zone = zoneOf(p, pd.dest);
          if (removeOne(zone, pd.card)) { p.deck.unshift(pd.card); log(state, `${p.name} はティアラで「${C()[pd.card].name}」を山札の上に置いた。`); }
        }
        state.pending = null;
        return state;
      }
      case 'TIARA_PLAY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'tiara_play') return state;
        const p = state.players[pd.player];
        const card = action.card; // null = しない
        state.pending = null;
        if (card != null && p.hand.indexOf(card) >= 0 && isTreasureFor(state, card)) {
          // 冠と同型：2回目は state.replay に積み、1回目が立てた選択待ちが解決してから
          //   runReplays が「効果だけ」もう一度適用する（2回目の選択・副次効果も正しく出る）。
          log(state, `${p.name} はティアラで「${C()[card].name}」を2回使う。`);
          playTreasureCard(state, pd.player, card); // 1回目（移動＋効果）
          state.replay = state.replay || [];
          state.replay.push({ player: pd.player, card, label: 'treasure_replay' }); // 2回目（効果のみ）
        }
        return state;
      }
      case 'ANVIL_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'anvil' || pd.stage !== 'discard') return state;
        const p = state.players[pd.player];
        const card = action.card; // null = しない
        if (card == null) { state.pending = null; return state; }
        if (p.hand.indexOf(card) < 0 || !isTreasureFor(state, card)) return state;
        removeOne(p.hand, card); p.discard.push(card);
        log(state, `${p.name} は金床で「${C()[card].name}」を捨てた。`);
        if (anyGainable(state, (id) => costUpTo(state, id, 4))) state.pending = { type: 'anvil', stage: 'gain', player: pd.player };
        else state.pending = null;
        return state;
      }
      case 'ANVIL_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'anvil' || pd.stage !== 'gain') return state;
        const card = action.card;
        if (!costUpTo(state, card, 4)) return state;
        gain(state, pd.player, card, 'discard');
        log(state, `${state.players[pd.player].name} は金床で「${C()[card].name}」を獲得した。`);
        state.pending = null;
        return state;
      }
      case 'INVESTMENT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'investment' || pd.stage) return state;
        const p = state.players[pd.player];
        if (action.choice === 'vp' && p.hand.some((c) => isTreasureFor(state, c))) {
          state.pending = { type: 'investment', stage: 'trash', player: pd.player };
        } else {
          addCoins(state, 1); log(state, `${p.name} は投資で +1コイン。`);
          state.pending = null;
        }
        return state;
      }
      case 'INVESTMENT_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'investment' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (p.hand.indexOf(card) < 0 || !isTreasureFor(state, card)) return state;
        removeOne(p.hand, card); trashCard(state, pd.player, card);
        const add = new Set(p.inPlay.filter((c) => isTreasureFor(state, c))).size;
        if (add) p.vpTokens = (p.vpTokens || 0) + add;
        log(state, `${p.name} は投資で「${C()[card].name}」を廃棄し +${add}勝利点（場の財宝${add}種）。`);
        state.pending = null;
        return state;
      }
      case 'CRYSTAL_BALL': {
        const pd = state.pending;
        if (!pd || pd.type !== 'crystal_ball') return state;
        const p = state.players[pd.player];
        const top = p.deck[0];
        const choice = action.choice; // 'trash' | 'discard' | 'play' | 'keep'
        if (top !== pd.card) { state.pending = null; return state; } // 山札が変わっていたら何もしない
        state.pending = null;
        if (choice === 'trash') { p.deck.shift(); trashCard(state, pd.player, top); log(state, `${p.name} は水晶玉で「${C()[top].name}」を廃棄した。`); }
        else if (choice === 'discard') { p.deck.shift(); p.discard.push(top); log(state, `${p.name} は水晶玉で「${C()[top].name}」を捨てた。`); }
        else if (choice === 'play' && (DOM.isType(top, 'action') || isTreasureFor(state, top))) {
          p.deck.shift();
          if (isTreasureFor(state, top)) {
            // 財宝は playTreasureCard に委譲し「使ったとき」の効果を完全再現する
            // （銀行/賢者の石の動的コイン、ポーショントークン、ペテン師のアタック等を取りこぼさない）。
            // playTreasureCard は手札からの除去を前提とするので一旦手札を経由してから呼ぶ。
            p.hand.push(top);
            log(state, `${p.name} は水晶玉で「${C()[top].name}」を使った。`);
            playTreasureCard(state, pd.player, top);
          } else {
            p.inPlay.push(top);
            t.actionsPlayed = (t.actionsPlayed || 0) + 1;
            log(state, `${p.name} は水晶玉で「${C()[top].name}」を使った。`);
            applyEffect(state, top, pd.player);
          }
        }
        return state;
      }

      /* ===== 拡張: 収穫祭 ===== */
      case 'HAMLET_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'hamlet') return state;
        const p = state.players[pd.player];
        if (action.card != null) {
          if (p.hand.indexOf(action.card) < 0) return state;
          removeOne(p.hand, action.card); p.discard.push(action.card);
          if (pd.stage === 'action') { addActions(t, 1); log(state, `${p.name} は1枚捨てて +1アクション（小村）。`); }
          else { t.buys += 1; log(state, `${p.name} は1枚捨てて +1購入（小村）。`); }
        }
        if (pd.stage === 'action' && p.hand.length > 0) state.pending = { type: 'hamlet', stage: 'buy', player: pd.player };
        else state.pending = null;
        return state;
      }
      case 'FORTUNE_TELLER_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'fortune_teller' || pd.stage !== 'react') return state;
        fortuneTellerApply(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'HORSE_TRADERS_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'horse_traders' || pd.stage !== 'discard') return state;
        const want = Math.min(2, state.players[pd.player].hand.length);
        if (!discardFromHand(state, pd.player, action.cards, want, '捨てた（馬商人）')) return state;
        state.pending = null;
        return state;
      }
      case 'HORSE_TRADERS_REACT': {
        // 収穫祭：他プレイヤーがアタックを使ったとき、馬商人を手札から脇に置く（免疫にはならない）。
        // アタックの反応ステップでのみ有効。pending は据え置き＝この後さらに堀公開/受けるを選べる。
        const pd = state.pending;
        if (!pd || !isAttackReactPending(pd)) return state;
        const p = state.players[pd.player];
        if (!removeOne(p.hand, 'horse_traders')) return state;
        (p.setAside = p.setAside || []).push('horse_traders');
        armDuration(state, pd.player, 'horse_traders');
        log(state, `${p.name} は馬商人を脇に置いた（次の自分の手番開始時に +1カードで手札に戻る）。`);
        return state;
      }
      case 'REMAKE_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'remake' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        if (action.card == null || p.hand.indexOf(action.card) < 0) return state; // 廃棄は必須
        removeOne(p.hand, action.card); trashCard(state, pd.player, action.card);
        log(state, `${p.name} は「${C()[action.card].name}」を廃棄した（リメイク）。`);
        const rr = costOf(state, action.card);
        const exact = rr.coin + 1;
        if (anyGainable(state, (id) => costExact(state, id, exact, rr.pot, rr.debt))) {
          state.pending = { type: 'remake', stage: 'gain', player: pd.player, iter: pd.iter, exactCost: exact, pot: rr.pot, debt: rr.debt };
        } else {
          remakeNext(state, pd.player, pd.iter);
        }
        return state;
      }
      case 'REMAKE_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'remake' || pd.stage !== 'gain') return state;
        const card = action.card;
        if (card == null || !costExact(state, card, pd.exactCost, pd.pot, pd.debt)) return state;
        gain(state, pd.player, card, 'discard');
        log(state, `${state.players[pd.player].name} は「${C()[card].name}」を獲得した（リメイク）。`);
        remakeNext(state, pd.player, pd.iter);
        return state;
      }
      case 'TOURNAMENT_REVEAL': {
        const pd = state.pending;
        if (!pd || pd.type !== 'tournament') return state;
        const doReveal = !!action.reveal;
        const player = state.players[pd.player];
        if (pd.stage === 'reveal_self') {
          if (doReveal && player.hand.includes('province')) {
            removeOne(player.hand, 'province'); player.discard.push('province');
            reveal(state, pd.player, ['province'], '馬上槍試合で属州を公開');
            log(state, `${player.name} は属州を公開・捨てた（馬上槍試合）。`);
            // 賞品は PRIZES（5種）だけ＝NON_SUPPLY（戦利品/狂人/傭兵/トラベラー成長先も含む）で数えてはいけない。
            //   mix で戦利品等が同居すると「賞品を獲得」の pending が開いたまま閉じない（CPU無限ループ／人間が詰む）。
            if (anyGainable(state, (id) => PRIZE_SET.has(id) || id === 'duchy')) {
              state.pending = { type: 'tournament', stage: 'prize', player: pd.player, source: pd.source };
            } else {
              tournamentOpponents(state, pd.source);
            }
          } else {
            tournamentOpponents(state, pd.source);
          }
        } else if (pd.stage === 'reveal_opp') {
          let any = !!pd.revealedAny;
          if (doReveal && player.hand.includes('province')) {
            reveal(state, pd.player, ['province'], '馬上槍試合で属州を公開（相手）');
            log(state, `${player.name} は属州を公開した（馬上槍試合＝ボーナス無効）。`);
            any = true;
          }
          tournamentOppEnter(state, pd.source, pd.queue, any);
        }
        return state;
      }
      case 'TOURNAMENT_PRIZE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'tournament' || pd.stage !== 'prize') return state;
        const card = action.card;
        // 終端保証：賞品も公領も残っていなければ獲得せず次へ（pending が閉じないのを防ぐ）。
        if (!anyGainable(state, (id) => PRIZE_SET.has(id) || id === 'duchy')) { tournamentOpponents(state, pd.source); return state; }
        if (!card || !(PRIZE_SET.has(card) || card === 'duchy') || (state.supply[card] || 0) <= 0) return state;
        gain(state, pd.player, card, 'deck');
        log(state, `${state.players[pd.player].name} は「${C()[card].name}」を山札の上に獲得した（馬上槍試合）。`);
        tournamentOpponents(state, pd.source);
        return state;
      }
      case 'YOUNG_WITCH_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'young_witch' || pd.stage !== 'discard') return state;
        const p = state.players[pd.player];
        const want = Math.min(2, p.hand.length);
        if (!discardFromHand(state, pd.player, action.cards, want, '捨てた（若き魔女）')) return state;
        youngWitchLaunch(state, pd.source);
        return state;
      }
      case 'YOUNG_WITCH_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'young_witch' || pd.stage !== 'react') return state;
        youngWitchCurse(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'YOUNG_WITCH_BANE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'young_witch' || pd.stage !== 'react') return state;
        const p = state.players[pd.player];
        if (!pd.bane || !p.hand.includes(pd.bane)) return state;
        reveal(state, pd.player, [pd.bane], '災いカードを公開（若き魔女）');
        log(state, `${p.name} は災いカード「${C()[pd.bane].name}」を公開し、若き魔女の影響を免れた。`);
        youngWitchEnterVictim(state, pd.source, pd.queue);
        return state;
      }
      case 'JESTER_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'jester' || pd.stage !== 'react') return state;
        jesterApply(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'JESTER_CHOOSE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'jester' || pd.stage !== 'choose') return state;
        const who = action.who === 'me' ? pd.source : pd.victim; // 'me'=攻撃側 / 'victim'=相手
        if ((state.supply[pd.card] || 0) > 0) {
          gain(state, who, pd.card, 'discard');
          log(state, `${state.players[who].name} は「${C()[pd.card].name}」のコピーを獲得した（道化師）。`);
        }
        jesterEnterVictim(state, pd.source, pd.queue);
        return state;
      }
      case 'FOLLOWERS_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'followers' || pd.stage !== 'react') return state;
        followersApply(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'FOLLOWERS_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'followers' || pd.stage !== 'discard') return state;
        const p = state.players[pd.player];
        const target = Math.min(3, p.hand.length);
        const discardCards = Array.isArray(action.cards) ? action.cards : [];
        if (p.hand.length - discardCards.length !== target) return state;
        const handCopy = p.hand.slice();
        for (const c of discardCards) if (!removeOne(handCopy, c)) return state;
        discardCards.forEach((c) => { removeOne(p.hand, c); p.discard.push(c); });
        log(state, `${p.name} は手札を ${discardCards.length}枚 捨てた（家臣団）。`);
        followersEnterVictim(state, pd.source, pd.queue);
        return state;
      }
      case 'TRUSTY_STEED_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'trusty_steed') return state;
        const valid = ['cards', 'actions', 'coins', 'silver'];
        let ch = Array.isArray(action.choices) ? action.choices.filter((c) => valid.includes(c)) : [];
        // 公式ルール：「以下から異なる2つ」はカードの記載順（上から）で解決する。選択順ではない。
        // これで「+2カード→銀貨で山札を捨て札に」の順が保たれ、山札の上2枚を先に引く（捨てる前に引く）。
        ch = valid.filter((c) => ch.includes(c));
        if (ch.length !== 2) return state; // 異なる2つを選ぶ
        const p = state.players[pd.player];
        ch.forEach((c) => {
          if (c === 'cards') draw(state, pd.player, 2);
          else if (c === 'actions') addActions(t, 2);
          else if (c === 'coins') addCoins(state, 2);
          else if (c === 'silver') {
            for (let i = 0; i < 4; i++) gain(state, pd.player, 'silver', 'discard');
            if (p.deck.length) { p.discard.push(...p.deck); p.deck = []; } // 山札を捨て札へ
          }
        });
        log(state, `${p.name} は頼もしい乗騎の効果（${ch.join('/')}）を選んだ。`);
        state.pending = null;
        return state;
      }
      case 'HORN_OF_PLENTY_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'horn_of_plenty') return state;
        const card = action.card;
        // 賞品(NON_SUPPLY)は馬上槍試合でのみ獲得＝豊穣の角では獲得できない（$0賞品の不正獲得防止）。
        if (card == null || !costUpTo(state, card, pd.maxCost)) return state;
        gain(state, pd.player, card, 'discard');
        log(state, `${state.players[pd.player].name} は「${C()[card].name}」を獲得した（豊穣の角）。`);
        if (DOM.isType(card, 'victory')) {
          if (removeOne(state.players[pd.player].inPlay, 'horn_of_plenty')) {
            trashCard(state, pd.player, 'horn_of_plenty');
            log(state, `${state.players[pd.player].name} は豊穣の角を廃棄した（勝利点を獲得したため）。`);
          }
        }
        state.pending = null;
        return state;
      }

      /* ============ ギルド（Guilds）============ */
      // 財源(Coffers)を使う：購入フェイズに任意枚数の財源を +1コインずつ に変える。
      case 'COFFERS_SPEND': {
        if (state.pending) return state;
        if (t.phase !== 'buy') return state;
        const amount = action.amount | 0;
        if (amount <= 0) return state;
        if (amount > (me.coffers || 0)) return state;
        me.coffers -= amount;
        addCoins(state, amount);
        // 冒険：-$1トークンは「最初に得る$1」に食い込む＝財宝を出さず財源で賄うターンでも消化する。
        applyCoinPenalty(state);
        log(state, `${me.name} は財源 ${amount}枚 を使った（+${amount}コイン）。`);
        return state;
      }
      /* ルネサンス：村人（Villagers）を使う。**アクションフェイズ中**にいつでも・好きな個数＝1個で +1アクション。
         財源（購入フェイズ・+$1）と同じトークンだが別枠＝混ぜて使えない。アクション権0でも使える
         （このエンジンは END_ACTION_PHASE が明示 action ＝アクション権0で自動終了しない）。 */
      case 'SPEND_VILLAGER': {
        if (state.pending) return state;
        if (t.phase !== 'action') return state;
        const amount = action.amount | 0;
        if (amount <= 0) return state;
        if (amount > (me.villagers || 0)) return state;
        me.villagers -= amount;
        addActions(t, amount);
        log(state, `${me.name} は村人 ${amount}人 を使った（+${amount}アクション）。`);
        return state;
      }

      /* ---- ルネサンス R2：王国カードの選択待ち ---- */
      // 根城：手札1枚を廃棄（強制）。勝利点カードなら呪い1枚を獲得（呪い山が空なら獲得しない）。
      case 'HIDEOUT_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'hideout_trash') return state;
        const pl = state.players[pd.player];
        if (!pl.hand.length) { state.pending = null; return state; } // 終端保証
        const card = action.card;
        if (!card || pl.hand.indexOf(card) < 0) return state;
        const isVic = DOM.isType(card, 'victory');
        if (!trashFromHand(state, pd.player, [card], 1, `廃棄した（根城）。`)) return state;
        if (isVic && (state.supply.curse || 0) > 0) {
          gain(state, pd.player, 'curse', 'discard');
          log(state, `${pl.name} は勝利点カードを廃棄したので呪い1枚を獲得した（根城）。`);
        }
        state.pending = null;
        return state;
      }
      // 発明家：コスト$4以下を1枚獲得 →「その後」このターン すべてのカードが$1安くなる（順序が肝＝自分の獲得には効かない）。
      case 'INVENTOR_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'inventor_gain') return state;
        if (!finishGain(state, pd, action.card, (id) => inventorGainable(state, id), 'discard', '獲得した（発明家）。')) return state;
        t.costReduction += 1;
        log(state, `${state.players[pd.player].name} は発明家：このターン すべてのカードが$1安くなる。`);
        return state;
      }
      // 山村：捨て札から1枚を手札へ（捨て札があれば強制。獲得でも捨て札でも廃棄でもない＝トリガーなし）。
      case 'MOUNTAIN_VILLAGE_TAKE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'mountain_village') return state;
        const pl = state.players[pd.player];
        if (!pl.discard.length) { draw(state, pd.player, 1); state.pending = null; return state; } // 終端保証
        const card = action.card;
        if (!card || !removeOne(pl.discard, card)) return state;
        pl.hand.push(card);
        log(state, `${pl.name} は山村で捨て札から「${C()[card].name}」を手札に加えた。`);
        state.pending = null;
        return state;
      }
      // 司祭：手札1枚を廃棄（強制）。**この廃棄には +2コインは乗らない**（予約の設置がこの廃棄の後）。
      case 'PRIEST_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'priest_trash') return state;
        const pl = state.players[pd.player];
        if (!pl.hand.length) { t.priestCount = (t.priestCount || 0) + 1; state.pending = null; return state; } // 終端保証
        const card = action.card;
        if (!card || pl.hand.indexOf(card) < 0) return state;
        if (!trashFromHand(state, pd.player, [card], 1, `廃棄した（司祭）。`)) return state;
        t.priestCount = (t.priestCount || 0) + 1; // 以後この手番の廃棄に +2コイン
        state.pending = null;
        return state;
      }
      // 徴募官：手札1枚を廃棄（強制）。そのコイン費用1につき +1村人（廃棄前の現在コストで数える）。
      case 'RECRUITER_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'recruiter_trash') return state;
        const pl = state.players[pd.player];
        if (!pl.hand.length) { state.pending = null; return state; } // 終端保証
        const card = action.card;
        if (!card || pl.hand.indexOf(card) < 0) return state;
        const n = cardCost(state, card); // 行商人はアクションフェイズでは$8＝+8村人（公式コンボ）
        if (!trashFromHand(state, pd.player, [card], 1, `廃棄した（徴募官）。`)) return state;
        if (n > 0) { pl.villagers = (pl.villagers || 0) + n; log(state, `${pl.name} は徴募官で +${n}村人。`); }
        state.pending = null;
        return state;
      }
      // 彫刻家：コスト$4以下を1枚「手札に」獲得（強制）。それが財宝なら +1村人。
      case 'SCULPTOR_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'sculptor_gain') return state;
        const card = action.card;
        if (!finishGain(state, pd, card, (id) => inventorGainable(state, id), 'hand', '手札に獲得した（彫刻家）。')) return state;
        if (card && isTreasureFor(state, card)) {
          const pl = state.players[pd.player];
          pl.villagers = (pl.villagers || 0) + 1;
          log(state, `${pl.name} は財宝を獲得したので +1村人（彫刻家）。`);
        }
        return state;
      }
      // 先見者：公開して手札に入らなかったカードを、好きな順番で山札の上に戻す（cards[0] が一番上）。
      case 'SEER_ORDER': {
        const pd = state.pending;
        if (!pd || pd.type !== 'seer_order') return state;
        const want = (pd.cards || []).slice();
        const order = Array.isArray(action.cards) ? action.cards.slice() : null;
        if (!order || order.length !== want.length) return state;
        const copy = want.slice();
        for (const c of order) if (!removeOne(copy, c)) return state; // 並べ替えは元の集合の置換でなければ拒否
        const pl = state.players[pd.player];
        for (let i = order.length - 1; i >= 0; i--) pl.deck.unshift(order[i]); // order[0] が一番上になる
        log(state, `${pl.name} は先見者で ${order.length}枚 を山札の上に戻した。`);
        state.pending = null;
        return state;
      }
      // 老魔女：堀を出さずにアタックを受ける（呪い獲得 → 手札の呪いを廃棄してよい）。
      case 'OLD_WITCH_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'old_witch' || pd.stage !== 'react') return state;
        oldWitchApply(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      // 老魔女：手札の呪い1枚を廃棄してもよい（任意。card:null で辞退）。
      case 'OLD_WITCH_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'old_witch_trash') return state;
        const pl = state.players[pd.player];
        if (action.card === 'curse' && pl.hand.includes('curse')) {
          removeOne(pl.hand, 'curse');
          trashCard(state, pd.player, 'curse');
          log(state, `${pl.name} は手札の呪い1枚を廃棄した（老魔女）。`);
        } else if (action.card != null) {
          return state; // 呪い以外は廃棄できない
        }
        oldWitchEnterVictim(state, pd.source, pd.queue);
        return state;
      }
      // 悪党：堀を出さずにアタックを受ける。
      case 'VILLAIN_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'villain' || pd.stage !== 'react') return state;
        villainApply(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      /* ---- ルネサンス R5：プロジェクト（横型）の選択待ち ---- */
      // 大聖堂：ターン開始時、手札1枚を廃棄する（**強制**・キューブは取り除けない）。
      case 'CATHEDRAL_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'cathedral') return state;
        const pl = state.players[pd.player];
        if (!pl.hand.length) { state.pending = null; return state; } // 終端保証
        const card = action.card;
        if (!card || pl.hand.indexOf(card) < 0) return state;
        if (!trashFromHand(state, pd.player, [card], 1, `廃棄した（大聖堂）。`)) return state;
        state.pending = null;
        return state;
      }
      // 城門：ターン開始時 +1カード（startOfTurnProjects で引き済み）→ その後 手札1枚を山札の上に置く（強制）。
      case 'CITY_GATE_TOPDECK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'city_gate') return state;
        const pl = state.players[pd.player];
        if (!pl.hand.length) { state.pending = null; return state; }
        const card = action.card;
        if (!card || !removeOne(pl.hand, card)) return state;
        pl.deck.unshift(card);
        log(state, `${pl.name} は城門で手札1枚を山札の上に置いた。`);
        state.pending = null;
        return state;
      }
      // サイロ：ターン開始時、好きな枚数の銅貨を公開して捨て、**その後**捨てた枚数だけ引く。
      case 'SILOS_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'silos') return state;
        const pl = state.players[pd.player];
        const want = Math.max(0, action.count | 0);
        const have = pl.hand.filter((c) => c === 'copper').length;
        if (want > have) return state;
        if (want > 0) {
          const cards = [];
          for (let i = 0; i < want; i++) cards.push('copper');
          reveal(state, pd.player, cards.slice(), 'サイロ：銅貨を公開して捨てる');
          if (!discardFromHand(state, pd.player, cards, want, `銅貨を捨てた（サイロ）。`)) return state;
          triggerOnDiscard(state, pd.player, cards, true);
          draw(state, pd.player, want); // 先に全部捨ててから引く（捨てた銅貨もリシャッフルに混ざる）
          log(state, `${pl.name} はサイロで 銅貨${want}枚 を捨てて ${want}枚 引いた。`);
        }
        state.pending = null;
        return state;
      }
      // 悪巧み：ターン開始時、トークンを1個置く／または自分のトークンを全部取り除き、1個につき +1カード（強制の二択）。
      case 'SINISTER_PLOT_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'sinister_plot') return state;
        const pl = state.players[pd.player];
        if (action.mode === 'add') {
          pl.sinisterPlot = (pl.sinisterPlot || 0) + 1;
          log(state, `${pl.name} は悪巧みにトークンを置いた（計${pl.sinisterPlot}個）。`);
        } else if (action.mode === 'take') {
          const k = pl.sinisterPlot || 0;
          pl.sinisterPlot = 0;
          if (k > 0) { draw(state, pd.player, k); log(state, `${pl.name} は悪巧みのトークン${k}個を取り除いて +${k}カード。`); }
        } else return state;
        state.pending = null;
        return state;
      }
      // 輪作：ターン開始時、手札の勝利点カード1枚を捨ててもよい（捨てたら +2カード）。**捨ててから引く**。
      case 'CROP_ROTATION_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'crop_rotation') return state;
        const pl = state.players[pd.player];
        const card = action.card;
        if (card != null) {
          if (pl.hand.indexOf(card) < 0 || !DOM.isType(card, 'victory')) return state;
          if (!discardFromHand(state, pd.player, [card], 1, `捨てた（輪作）。`)) return state;
          triggerOnDiscard(state, pd.player, [card], true);
          draw(state, pd.player, 2);
          log(state, `${pl.name} は輪作で勝利点1枚を捨てて +2カード。`);
        }
        state.pending = null;
        return state;
      }
      // 野外劇：購入フェイズ終了時、$1を支払ってもよい（+1財源）。購入権は消費しない。
      case 'PAGEANT_PAY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'pageant') return state;
        const pl = state.players[pd.player];
        if (action.pay && (t.coins || 0) >= 1) {
          t.coins -= 1;
          pl.coffers = (pl.coffers || 0) + 1;
          log(state, `${pl.name} は野外劇で $1 を支払い +1財源。`);
        }
        state.pending = null;
        endBuyTailExploration(state, pd.player);
        return state;
      }
      // 下水道：あなたがカードを廃棄したとき、追加で手札1枚を廃棄してよい（この追加廃棄では再誘発しない）。
      case 'SEWERS_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'sewers_trash') return state;
        const pl = state.players[pd.player];
        const card = action.card;
        if (card != null) {
          if (pl.hand.indexOf(card) < 0) return state;
          state._sewersTrash = true;
          const okT = trashFromHand(state, pd.player, [card], 1, `追加で廃棄した（下水道）。`);
          delete state._sewersTrash;
          if (!okT) return state;
        }
        state.pending = null;
        return state;
      }
      // 技術革新：各ターン1回、獲得したアクションカードを使用してよい（アクション権を消費しない）。
      case 'INNOVATION_PLAY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'innovation') return state;
        state.pending = null;
        // 「各ターンに1回」＝**解決時に権利を再検査**する（実験の on-gain のように1回の獲得で窓が2件積まれ得るため）。
        if (t.innovationUsed) return state;
        if (!action.play) return state;
        const pl = state.players[pd.player];
        const z = zoneOf(pl, pd.dest);
        if (!removeOne(z, pd.card)) return state; // 既に動かされていた＝lose track（使用できない）
        pl.inPlay.push(pd.card);
        t.innovationUsed = true;
        t.actionsPlayed = (t.actionsPlayed || 0) + 1;
        log(state, `${pl.name} は技術革新で 獲得した「${C()[pd.card].name}」を使用した（アクション権は消費しない）。`);
        maybeCitadel(state, pd.player, pd.card);
        applyEffect(state, pd.card, pd.player);
        return state;
      }

      /* ---- ルネサンス R4：持続・クリンナップ・再演 ---- */
      // 研究：手札1枚を廃棄し、そのコイン費用1につき1枚を山札の上から裏向きで脇へ（強制）。
      case 'RESEARCH_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'research_trash') return state;
        const pl = state.players[pd.player];
        if (!pl.hand.length) { state.pending = null; return state; } // 終端保証
        const card = action.card;
        if (!card || pl.hand.indexOf(card) < 0) return state;
        const n = cardCost(state, card); // 廃棄時点のコイン費用（コスト軽減が乗る／ポーション・負債は数えない）
        if (!trashFromHand(state, pd.player, [card], 1, `廃棄した（研究）。`)) return state;
        const aside = [];
        for (let i = 0; i < n; i++) {
          if (pl.deck.length === 0) { if (pl.discard.length === 0) break; reshuffleDeck(pl); }
          aside.push(pl.deck.shift());
        }
        state.pending = null;
        if (aside.length) {
          aside.forEach((c) => pl.setAside.push(c)); // 裏向き＝相手にはマスクされる
          armDuration(state, pd.player, 'research', { stashed: aside.slice() });
          log(state, `${pl.name} は研究で ${aside.length}枚 を裏向きで脇に置いた（次の手番開始時に手札へ）。`);
        } else {
          log(state, `${pl.name} は研究：脇に置くカードが0枚（持続として場に残らない）。`);
        }
        return state;
      }
      // 貨物船：獲得したカードを表向きで脇に置いてよい（このターン中1回・貨物船1枚につき1回）。
      case 'CARGO_SHIP_SETASIDE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'cargo_ship_setaside') return state;
        const pl = state.players[pd.player];
        // 「このターン1回」＝**解決時に残回数を再検査**する（実験の on-gain のように1回の獲得で窓が2件積まれ得るため）。
        if ((t.cargoCharges || 0) <= 0) { state.pending = null; return state; }
        if (action.set) {
          const z = zoneOf(pl, pd.dest);
          if (removeOne(z, pd.card)) {
            pl.cargo.push(pd.card);
            armDuration(state, pd.player, 'cargo_ship'); // 脇に置いたときだけ持続になる（置かなければ捨て札）
            t.cargoCharges = Math.max(0, (t.cargoCharges || 0) - 1);
            log(state, `${pl.name} は貨物船で「${C()[pd.card].name}」を脇に置いた（次の手番開始時に手札へ）。`);
          }
        }
        state.pending = null;
        return state;
      }
      // 増築：クリンナップ開始時、このターン場から捨て札にするアクション1枚を廃棄してよい（任意）。
      case 'IMPROVE_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'improve' || pd.stage !== 'trash') return state;
        const pl = state.players[pd.player];
        const card = action.card;
        if (card == null) { // 辞退＝この増築の窓を閉じる
          t.improveLeft = 0;
          state.pending = null;
          endBuyTailSchemeOrCleanup(state, pd.player);
          return state;
        }
        if (improveTargets(state, pd.player).indexOf(card) < 0) return state;
        if (!removeOne(pl.inPlay, card) && !removeOne(pl.durationCards, card)) return state;
        const exact = cardCost(state, card) + 1;
        const pot = potionCost(card), dbt = (C()[card] && C()[card].debt) || 0;
        trashCard(state, pd.player, card); // 場から直接 廃棄置き場へ（「捨てたとき」は発動しない／「廃棄されたとき」は発動する）
        log(state, `${pl.name} は増築で「${C()[card].name}」を廃棄した。`);
        t.improveLeft = Math.max(0, (t.improveLeft || 0) - 1);
        const can = (id) => costExact(state, id, exact, pot, dbt);
        if (anyGainable(state, can)) {
          state.pending = { type: 'improve', stage: 'gain', player: pd.player, exact, pot, dbt };
          return state;
        }
        state.pending = null; // ちょうど+$1のカードが無ければ獲得できない（廃棄は成立）
        endBuyTailSchemeOrCleanup(state, pd.player);
        return state;
      }
      case 'IMPROVE_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'improve' || pd.stage !== 'gain') return state;
        const can = (id) => costExact(state, id, pd.exact, pd.pot, pd.dbt);
        if (!finishGain(state, pd, action.card, can, 'discard', '獲得した（増築）。')) return state;
        endBuyTailSchemeOrCleanup(state, pd.player);
        return state;
      }
      // 王笏：二択（+2コイン／このターン使用し場に残っている非命令アクション1枚を再度使用）。
      case 'SCEPTER_CHOOSE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'scepter' || pd.stage !== 'choose') return state;
        if (action.mode === 'coins') {
          addCoins(state, 2);
          log(state, `${me.name} は王笏で +2コイン。`);
          state.pending = null;
          return state;
        }
        if (action.mode === 'replay') {
          // 遂行できない選択肢も選べる（対象が無ければ何も起きない）
          if (!scepterTargets(state, pd.player).length) { state.pending = null; return state; }
          state.pending = { type: 'scepter', stage: 'replay', player: pd.player };
          return state;
        }
        return state;
      }
      case 'SCEPTER_REPLAY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'scepter' || pd.stage !== 'replay') return state;
        const card = action.card;
        if (!card || scepterTargets(state, pd.player).indexOf(card) < 0) return state;
        state.pending = null;
        log(state, `${state.players[pd.player].name} は王笏で「${C()[card].name}」を再度使用する。`);
        (state.replay = state.replay || []).push({ player: pd.player, card: card, label: 'scepter' });
        return state;
      }

      /* ---- ルネサンス R3：アーティファクト絡み ---- */
      // ドゥカート金貨：獲得したとき、手札の銅貨1枚を廃棄してもよい（任意）。
      case 'DUCAT_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'ducat_trash') return state;
        const pl = state.players[pd.player];
        if (action.trash && pl.hand.includes('copper')) {
          removeOne(pl.hand, 'copper');
          trashCard(state, pd.player, 'copper');
          log(state, `${pl.name} はドゥカート金貨の獲得で銅貨1枚を廃棄した。`);
        }
        state.pending = null;
        return state;
      }
      // 国境警備隊：公開したカードから1枚を手札へ・残りを捨て札へ。すべてアクションならアーティファクトを取る。
      case 'BORDER_GUARD_KEEP': {
        const pd = state.pending;
        if (!pd || pd.type !== 'border_guard') return state;
        const pl = state.players[pd.player];
        const card = action.card;
        const rest = (pd.cards || []).slice();
        if (!card || !removeOne(rest, card)) return state;
        pl.hand.push(card);
        const disc = rest.slice();
        disc.forEach((c) => pl.discard.push(c));
        log(state, `${pl.name} は国境警備隊で「${C()[card].name}」を手札に加え、${disc.length}枚を捨てた。`);
        state.pending = null;
        if (disc.length) triggerOnDiscard(state, pd.player, disc, true); // トンネル等（対話は出さない＝安全側）
        if (pd.allAction) {
          if (pd.lantern) {
            // ランタン所持＝3枚すべてアクション → 角笛を「取ってもよい」（任意）。
            if (!hasArtifact(state, pd.player, 'horn')) {
              state.pending = { type: 'border_guard_artifact', player: pd.player, only: 'horn' };
            }
          } else {
            // 非ランタン＝2枚ともアクション → ランタンか角笛を受け取る（強制の二択）。
            state.pending = { type: 'border_guard_artifact', player: pd.player };
          }
        }
        return state;
      }
      case 'BORDER_GUARD_ARTIFACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'border_guard_artifact') return state;
        const want = action.artifact;
        if (pd.only) {
          // 任意（角笛を取るか取らないか）
          if (want === pd.only) takeArtifact(state, pd.player, pd.only);
          else if (want != null) return state;
          state.pending = null;
          return state;
        }
        if (want !== 'horn' && want !== 'lantern') return state; // 強制の二択
        takeArtifact(state, pd.player, want);
        state.pending = null;
        return state;
      }
      // 出納官：3択（遂行できない選択肢も選べる＝engine は拒否しない・実行不能なら効果なしで閉じる）。
      case 'TREASURER_CHOOSE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'treasurer' || pd.stage !== 'choose') return state;
        const pl = state.players[pd.player];
        const mode = action.mode;
        if (mode === 'key') { takeArtifact(state, pd.player, 'key'); state.pending = null; return state; }
        if (mode === 'trash') {
          if (!pl.hand.some((c) => isTreasureFor(state, c))) { state.pending = null; return state; } // 実行不能＝効果なし
          state.pending = { type: 'treasurer', stage: 'trash', player: pd.player };
          return state;
        }
        if (mode === 'gain') {
          if (!(state.trash || []).some((c) => isTreasureFor(state, c))) { state.pending = null; return state; }
          state.pending = { type: 'treasurer', stage: 'gain', player: pd.player };
          return state;
        }
        return state;
      }
      case 'TREASURER_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'treasurer' || pd.stage !== 'trash') return state;
        const pl = state.players[pd.player];
        if (!pl.hand.some((c) => isTreasureFor(state, c))) { state.pending = null; return state; } // 終端保証
        const card = action.card;
        if (!card || pl.hand.indexOf(card) < 0 || !isTreasureFor(state, card)) return state;
        if (!trashFromHand(state, pd.player, [card], 1, `廃棄した（出納官）。`)) return state;
        state.pending = null;
        return state;
      }
      // 廃棄置き場から財宝1枚を「手札に」獲得（サプライ山は減らない＝3山終了に影響しない）。
      //   これは通常の**獲得**＝獲得時能力が誘発する（ドゥカートの銅貨廃棄／香辛料の +2財源 など）。
      case 'TREASURER_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'treasurer' || pd.stage !== 'gain') return state;
        const pl = state.players[pd.player];
        if (!(state.trash || []).some((c) => isTreasureFor(state, c))) { state.pending = null; return state; } // 終端保証
        const card = action.card;
        if (!card || !isTreasureFor(state, card) || (state.trash || []).indexOf(card) < 0) return state;
        removeOne(state.trash, card);
        state.pending = null;
        gainFromOutside(state, pd.player, card, 'hand'); // 通常の獲得＝獲得時能力は誘発する（支配の振り分けも通る）
        log(state, `${pl.name} は廃棄置き場から「${C()[card].name}」を手札に獲得した（出納官）。`);
        return state;
      }
      // 悪党：手札からコスト$2以上のカード1枚を捨てる（強制・被害者が選ぶ）。
      case 'VILLAIN_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'villain_discard') return state;
        const pl = state.players[pd.player];
        const card = action.card;
        if (!card || pl.hand.indexOf(card) < 0 || cardCost(state, card) < 2) return state;
        if (!discardFromHand(state, pd.player, [card], 1, `捨てた（悪党）。`)) return state;
        triggerOnDiscard(state, pd.player, [card], true); // トンネル等（相手のアタックによる捨て札＝対話は出さない）
        villainEnterVictim(state, pd.source, pd.queue);
        return state;
      }
      // 帝国：負債（Debt）を返済する。購入フェイズに $1=1個。購入権は消費しない（購入の前でも後でも・交互でも可）。
      case 'REPAY_DEBT': {
        if (state.pending) return state;
        if (t.phase !== 'buy') return state;
        // amount 未指定なら可能な限り返済（min(負債, コイン)）。
        const want = (action.amount == null) ? Infinity : (action.amount | 0);
        const amount = Math.min(me.debt || 0, t.coins || 0, want);
        if (amount <= 0) return state;
        me.debt -= amount;
        t.coins -= amount;
        log(state, `${me.name} は 負債${amount} を返済した（残り負債 ${me.debt}）。`);
        return state;
      }
      // 帝国：技術者＝コスト4以下を獲得（1枚目=強制／自己廃棄後の2枚目=強制）。
      case 'ENGINEER_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'engineer' || (pd.stage !== 'gain1' && pd.stage !== 'gain2')) return state;
        const canGain = (id) => costUpTo(state, id, 4);
        if (pd.stage === 'gain1') {
          if (!finishGain(state, pd, action.card, canGain, 'discard', '技術者で獲得した。')) return state;
          // 1枚目の獲得完了 → 自己廃棄の任意選択（maytrash）へ。
          state.pending = { type: 'engineer', stage: 'maytrash', player: pd.player };
          return state;
        }
        finishGain(state, pd, action.card, canGain, 'discard', '技術者の廃棄でもう1枚獲得した。');
        return state;
      }
      // 帝国：技術者を廃棄してよい（廃棄したらもう1枚コスト4以下を獲得）。
      case 'ENGINEER_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'engineer' || pd.stage !== 'maytrash') return state;
        const owner = state.players[pd.player];
        if (action.trash) {
          if (removeOne(owner.inPlay, 'engineer')) {
            trashCard(state, pd.player, 'engineer');
            log(state, `${owner.name} は技術者を廃棄した。`);
            const canGain = (id) => costUpTo(state, id, 4);
            if (anyGainable(state, canGain)) { state.pending = { type: 'engineer', stage: 'gain2', player: pd.player }; return state; }
          }
          // 場に技術者が無い（玉座2回目で既に廃棄済み等）or 追加獲得の候補ゼロ → 終了。
        }
        state.pending = null;
        return state;
      }
      /* ===== 帝国（Empires）Batch E2 ===== */
      // 生贄：廃棄したカードの種別ごとにボーナス（複数種別は全適用）。手札があるとき廃棄は必須。
      case 'SACRIFICE_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'sacrifice' || pd.stage !== 'trash') return state;
        const owner = state.players[pd.player];
        const card = action.card;
        if (card == null || owner.hand.indexOf(card) < 0) return state;
        removeOne(owner.hand, card); trashCard(state, pd.player, card);
        const bonus = [];
        if (DOM.isType(card, 'action')) { draw(state, pd.player, 2); addActions(t, 2); bonus.push('+2カード +2アクション'); }
        if (isTreasureFor(state, card)) { addCoins(state, 2); bonus.push('+$2'); }
        if (DOM.isType(card, 'victory')) { owner.vpTokens = (owner.vpTokens || 0) + 2; bonus.push('+2勝利点'); }
        log(state, `${owner.name} は生贄で「${C()[card].name}」を廃棄（${bonus.join(' ') || 'ボーナス無し'}）。`);
        state.pending = null;
        return state;
      }
      // 公共広場：+3カード+1アクションの後、手札をちょうど2枚（手札が2枚未満なら全て）捨てる。
      case 'FORUM_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'forum') return state;
        const owner = state.players[pd.player];
        const need = Math.min(2, owner.hand.length);
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (cards.length !== need) return state;
        const copy = owner.hand.slice();
        for (const c of cards) if (!removeOne(copy, c)) return state;
        cards.forEach((c) => { removeOne(owner.hand, c); owner.discard.push(c); });
        log(state, `${owner.name} は公共広場で手札${cards.length}枚を捨てた。`);
        state.pending = null;
        return state;
      }
      // 資料庫：脇の3枚（この資料庫の stash）から1枚を選んで手札へ（必須＝1枚）。空になった資料庫は除去。
      case 'ARCHIVE_PICK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'archive_pick') return state;
        const owner = state.players[pd.player];
        const stash = (owner.archives || []).find((a) => a.id === pd.archiveId);
        if (!stash) { state.pending = null; return state; } // 保険：見つからなければ終端
        const card = action.card;
        if (card == null || !stash.cards.includes(card)) return state; // 脇の1枚を必ず手札へ
        removeOne(stash.cards, card); owner.hand.push(card);
        log(state, `${owner.name} は資料庫で「${C()[card].name}」を手札に加えた。`);
        if (stash.cards.length === 0) owner.archives = owner.archives.filter((a) => a.id !== pd.archiveId);
        state.pending = null; // 手番開始時の複数資料庫は reduce 末尾の startQueue 安全網が順に進める
        return state;
      }
      // 神殿：手札から名前の異なる1〜3枚を廃棄（強制・手札があれば最低1枚）。その後 神殿の山に勝利点1個。
      case 'TEMPLE_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'temple_trash') return state;
        const owner = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (cards.length < 1 || cards.length > 3) return state; // 手札があるとき廃棄は必須（1〜3枚）
        if (new Set(cards).size !== cards.length) return state; // 名前がすべて異なる（同名の重複不可）
        const copy = owner.hand.slice();
        for (const c of cards) if (!removeOne(copy, c)) return state;
        cards.forEach((c) => { removeOne(owner.hand, c); trashCard(state, pd.player, c); });
        log(state, `${owner.name} は神殿で ${cards.length}枚 を廃棄した。`);
        state.pileVP.temple = (state.pileVP.temple || 0) + 1;
        log(state, `${owner.name} は神殿の山に勝利点トークン1個を置いた（計${state.pileVP.temple}個）。`);
        state.pending = null;
        return state;
      }
      // ワイルドハント：二択（+3カード＆山にVP+1／屋敷を獲得し 獲得したら山上のVPを全部得る）。
      case 'WILD_HUNT_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'wild_hunt') return state;
        const owner = state.players[pd.player];
        if (action.choice === 'estate') {
          state.pending = null; // 先に閉じる（屋敷獲得の on-gain 対話が立つことがある）
          if (gain(state, pd.player, 'estate', 'discard')) {
            const vp = state.pileVP.wild_hunt || 0;
            if (vp > 0) { owner.vpTokens = (owner.vpTokens || 0) + vp; state.pileVP.wild_hunt = 0; log(state, `${owner.name} はワイルドハントで屋敷を獲得し 山上の勝利点${vp}個 を得た。`); }
            else log(state, `${owner.name} はワイルドハントで屋敷を獲得した（山上の勝利点なし）。`);
          } else log(state, `${owner.name} はワイルドハント：屋敷の山が空で獲得できなかった。`);
        } else {
          draw(state, pd.player, 3);
          state.pileVP.wild_hunt = (state.pileVP.wild_hunt || 0) + 1;
          log(state, `${owner.name} はワイルドハント（+3カード・山に勝利点1個→計${state.pileVP.wild_hunt}個）。`);
          state.pending = null;
        }
        return state;
      }

      /* ===== 帝国（Empires）Batch E4：分割山カードの選択解決 ===== */
      // 陣地：金貨か鹵獲品を公開して場に残す／公開しないなら脇へ（片付けで分割山へ戻す）。
      case 'ENCAMPMENT_REVEAL': {
        const pd = state.pending;
        if (!pd || pd.type !== 'encampment_reveal') return state;
        const owner = state.players[pd.player];
        if (action.card === 'gold' || action.card === 'plunder') {
          if (owner.hand.indexOf(action.card) < 0) return state; // 無効な公開
          reveal(state, pd.player, [action.card], '陣地：公開');
          log(state, `${owner.name} は陣地で「${C()[action.card].name}」を公開した（場に残す）。`);
          state.pending = null;
          return state;
        }
        // 公開しない → 脇へ
        state.pending = null;
        encampmentSetAside(state, pd.player);
        return state;
      }
      // 開拓者/騒がしい村：捨て札から 銅貨/開拓者 1枚を公開して手札に加えてよい（任意）。
      case 'SETTLERS_RESOLVE': {
        const pd = state.pending;
        if (!pd || (pd.type !== 'settlers' && pd.type !== 'bustling_village')) return state;
        const owner = state.players[pd.player];
        const want = pd.type === 'settlers' ? 'copper' : 'settlers';
        if (action.take && removeOne(owner.discard, want)) {
          reveal(state, pd.player, [want], pd.type === 'settlers' ? '開拓者：捨て札から銅貨' : '騒がしい村：捨て札から開拓者');
          owner.hand.push(want);
          log(state, `${owner.name} は捨て札から「${C()[want].name}」を手札に加えた。`);
        }
        state.pending = null;
        return state;
      }
      // 投石機：手札1枚を廃棄（強制）→コスト3以上なら呪い、財宝なら手札3枚まで捨て（両方満たせば両方・アタック）。
      case 'CATAPULT_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'catapult' || pd.stage !== 'trash') return state;
        const owner = state.players[pd.player];
        const card = action.card;
        if (card == null || owner.hand.indexOf(card) < 0) return state; // 手札があれば廃棄必須
        const cc = cardCost(state, card), isTre = isTreasureFor(state, card);
        removeOne(owner.hand, card); trashCard(state, pd.player, card);
        log(state, `${owner.name} は投石機で「${C()[card].name}」を廃棄した。`);
        state.pending = null;
        const vics = [];
        for (let k = 1; k < state.players.length; k++) vics.push((pd.player + k) % state.players.length);
        if (cc >= 3 || isTre) catapultEnterVictim(state, pd.player, vics, cc >= 3, isTre);
        return state;
      }
      // 投石機：アタックを「そのまま受ける」＝この相手に呪い/捨てを適用して次へ。
      case 'CATAPULT_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'catapult' || pd.stage !== 'react') return state;
        const victim = pd.victim;
        if (pd.giveCurse && (state.supply.curse || 0) > 0 && gain(state, victim, 'curse', 'discard')) log(state, `${state.players[victim].name} は投石機で呪い1枚を獲得した。`);
        const dq = (pd.discardQ || []).slice(); if (pd.treasureDiscard) dq.push(victim);
        catapultEnterVictim(state, pd.source, pd.queue, pd.giveCurse, pd.treasureDiscard, dq);
        return state;
      }
      // 剣闘士：手札から1枚を公開→左隣が同名を公開できるか判定。
      case 'GLADIATOR_REVEAL': {
        const pd = state.pending;
        if (!pd || pd.type !== 'gladiator' || pd.stage !== 'reveal') return state;
        const owner = state.players[pd.player];
        const card = action.card;
        if (card == null || owner.hand.indexOf(card) < 0) return state;
        reveal(state, pd.player, [card], '剣闘士：手札から公開');
        log(state, `${owner.name} は剣闘士で「${C()[card].name}」を公開した。`);
        state.pending = null;
        gladiatorLeftMatch(state, pd.player, card);
        return state;
      }
      // 剣闘士：左隣が同じカードを公開するか（公開しなければ owner に +$1＋サプライから剣闘士廃棄）。
      case 'GLADIATOR_MATCH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'gladiator' || pd.stage !== 'match') return state;
        const left = state.players[pd.player];
        if (action.reveal && left.hand.includes(pd.card)) {
          reveal(state, pd.player, [pd.card], '剣闘士：左隣が同じカードを公開');
          log(state, `${left.name} は剣闘士で同じ「${C()[pd.card].name}」を公開した（ボーナスなし）。`);
          state.pending = null;
        } else {
          gladiatorBonus(state, pd.source);
        }
        return state;
      }

      /* ===== 帝国（Empires）Batch E5：城の選択解決 ===== */
      // 小さい城：これ（場）か手札の城1枚を廃棄→廃棄したら城1枚を獲得。card='small_castle'（場）／手札の城id／null（手札の城枝で城なし＝空振り）。
      case 'SMALL_CASTLE_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'small_castle') return state;
        const owner = state.players[pd.player];
        const card = action.card;
        let trashed = false;
        if (card === 'small_castle') {
          if (removeOne(owner.inPlay, 'small_castle')) { trashCard(state, pd.player, 'small_castle'); trashed = true; log(state, `${owner.name} は小さい城（これ）を廃棄した。`); }
        } else if (card != null && DOM.isType(card, 'castle') && owner.hand.includes(card)) {
          removeOne(owner.hand, card); trashCard(state, pd.player, card); trashed = true; log(state, `${owner.name} は手札の「${C()[card].name}」を廃棄した（小さい城）。`);
        }
        // card == null ＝「手札の城」を選んだが城が無い→空振り（廃棄なし・獲得なし＝公式ルーリング）。
        if (trashed && Array.isArray(state.castles) && state.castles.length > 0) {
          if (gain(state, pd.player, 'castles', 'discard')) log(state, `${owner.name} は城1枚を獲得した（小さい城）。`);
        }
        state.pending = null;
        return state;
      }
      // 華やかな城：手札の勝利点カードを任意枚数 公開して捨てる→1枚につき +$2。
      case 'OPULENT_CASTLE_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'opulent_castle') return state;
        const owner = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        const copy = owner.hand.slice();
        for (const c of cards) { if (!DOM.isType(c, 'victory') || !removeOne(copy, c)) return state; } // 全て勝利点で手札にあること
        if (cards.length) reveal(state, pd.player, cards, '華やかな城：勝利点を公開して捨てる');
        cards.forEach((c) => { removeOne(owner.hand, c); owner.discard.push(c); });
        addCoins(state, 2 * cards.length);
        log(state, `${owner.name} は華やかな城で勝利点${cards.length}枚を捨てて +$${2 * cards.length}。`);
        state.pending = null;
        return state;
      }
      // 幽霊城：手札から2枚を山札の上へ（手番順に処理・アタックではない）。
      case 'HAUNTED_TOPDECK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'haunted_topdeck') return state;
        const owner = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        const need = Math.min(2, owner.hand.length);
        if (cards.length !== need) return state;
        const copy = owner.hand.slice();
        for (const c of cards) if (!removeOne(copy, c)) return state;
        cards.forEach((c) => removeOne(owner.hand, c));
        for (let i = cards.length - 1; i >= 0; i--) owner.deck.unshift(cards[i]); // 選んだ順で山札の上へ
        log(state, `${owner.name} は幽霊城で手札${cards.length}枚を山札の上に置いた。`);
        const q = pd.queue || [];
        if (q.length) state.pending = { type: 'haunted_topdeck', player: q[0], source: pd.source, queue: q.slice(1) };
        else state.pending = null;
        return state;
      }
      // 広大な城：公領1枚か屋敷3枚を獲得。
      case 'SPRAWLING_CASTLE_CHOOSE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'sprawling_castle') return state;
        if (action.choice === 'estates') {
          let g = 0; for (let i = 0; i < 3; i++) if (gain(state, pd.player, 'estate', 'discard')) g++;
          log(state, `${state.players[pd.player].name} は広大な城で屋敷${g}枚を獲得した。`);
        } else {
          if (gain(state, pd.player, 'duchy', 'discard')) log(state, `${state.players[pd.player].name} は広大な城で公領1枚を獲得した。`);
        }
        state.pending = null;
        return state;
      }
      /* ===== 帝国（Empires）Batch E6：命令（overlord/crown）の選択解決 ===== */
      // 大君主：サプライのコスト5以下（非命令・非持続）のアクションを、サプライに残したまま使用（船長と同型）。
      case 'OVERLORD_PLAY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'overlord') return state;
        const cands = overlordTargets(state);
        if (action.card == null) {
          if (cands.length) return state; // 対象があるうちは使用必須（公式＝mayではない）
          state.pending = null;
          return state;
        }
        const card = action.card;
        if (cands.indexOf(card) < 0) return state;
        state.pending = null; // 先に閉じる（applyEffect が新たな選択待ちを立てることがある）
        t.actionsPlayed = (t.actionsPlayed || 0) + 1; // 使用に数えるが、カードはサプライに残る（場に出ない）
        rememberCommandAs(state, 'overlord', card); // 再演（玉座/王の宮廷/冠等）では選び直さない
        log(state, `${state.players[pd.player].name} は大君主でサプライの「${C()[card].name}」を使った（サプライに残る）。`);
        playAsCommand(state, pd.player, 'overlord', card);
        return state;
      }
      // 冠：mode='action'＝手札のアクション1枚を選び玉座と同型で2回使う。
      //     mode='treasure'＝手札の財宝1枚を選び2回使う（1回目 playTreasureCard・2回目は 'treasure_replay'）。
      //     どちらも2回目は state.replay に積む＝1回目が立てた選択待ち（御守り/金床/水晶玉など）が
      //     解決してから runReplays が適用する＝2回目の選択・副次効果も正しく発生する。
      //     どちらも「してよい」＝action.card===null で辞退できる。
      case 'CROWN_CHOOSE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'crown') return state;
        const p2 = state.players[pd.player];
        const card = action.card; // null = 使わない
        state.pending = null;
        if (pd.mode === 'action') {
          if (card != null && p2.hand.indexOf(card) >= 0 && DOM.isType(card, 'action')) {
            removeOne(p2.hand, card); p2.inPlay.push(card);
            t.actionsPlayed = (t.actionsPlayed || 0) + 1;
            log(state, `${p2.name} は冠で「${C()[card].name}」を使った（1回目）。`);
            applyEffect(state, card, pd.player); // 1回目
            state.replay = state.replay || [];
            state.replay.push({ player: pd.player, card, label: 'crown' }); // 2回目は選択待ち解消後に runReplays が適用
          }
        } else { // mode === 'treasure'
          if (card != null && p2.hand.indexOf(card) >= 0 && isTreasureFor(state, card)) {
            log(state, `${p2.name} は冠で「${C()[card].name}」を2回使う。`);
            playTreasureCard(state, pd.player, card); // 1回目（移動＋効果）
            state.replay = state.replay || [];
            state.replay.push({ player: pd.player, card, label: 'treasure_replay' }); // 2回目（効果のみ）
          }
        }
        return state;
      }
      // 御守り（charm）のモード選択：A=+1購入+$2 ／ B=このターン次の獲得で同コスト別名を1枚獲得できる（積む）。
      case 'CHARM_MODE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'charm_mode') return state;
        if (action.mode === 'coins') { t.buys += 1; addCoins(state, 2); log(state, `${state.players[pd.player].name} は御守り（+1購入 +$2）。`); }
        else { t.charmNextGain = (t.charmNextGain || 0) + 1; log(state, `${state.players[pd.player].name} は御守り（次の獲得で同コスト別名を1枚獲得）。`); }
        state.pending = null;
        return state;
      }
      // 軍団兵：手札の金貨を公開してよい。公開したら各相手は手札2枚まで捨て→1枚引く（アタック・drawAfter=1）。
      case 'LEGIONARY_REVEAL': {
        const pd = state.pending;
        if (!pd || pd.type !== 'legionary_reveal') return state;
        const owner = state.players[pd.player];
        if (action.reveal && owner.hand.includes('gold')) {
          reveal(state, pd.player, ['gold'], '軍団兵：金貨を公開');
          log(state, `${owner.name} は軍団兵で金貨を公開した（各相手は手札2枚まで捨て→1枚引く）。`);
          const vics = [];
          for (let k = 1; k < state.players.length; k++) { const idx = (pd.player + k) % state.players.length; if (!attackImmune(state, idx)) vics.push(idx); }
          state.pending = null;
          discardDownEnter(state, pd.player, 2, vics, null, 1);
        } else {
          state.pending = null;
        }
        return state;
      }
      // 御守り（charm）のモードB＝獲得したカードと同コスト（$・負債・ポーション一致）で名前の異なるカード1枚を獲得してよい（任意・積んだ枚数ぶん）。
      case 'CHARM_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'charm_gain') return state;
        const owner = pd.player;
        const canGain = (id) => id !== pd.trig && costExact(state, id, pd.coin, pd.pot, pd.debt);
        const card = action.card; // null = 獲得しない（辞退＝機会1つを消費）
        if (card != null && !canGain(card)) return state; // 無効な選択（同名/コスト不一致/在庫なし）は拒否＝pending維持
        if (card != null) { gain(state, owner, card, 'discard'); log(state, `${state.players[owner].name} は御守りで「${C()[card].name}」を獲得した。`); }
        const remaining = (pd.count || 1) - 1;
        if (remaining > 0 && anyGainable(state, canGain)) { state.pending = { type: 'charm_gain', player: owner, coin: pd.coin, debt: pd.debt, pot: pd.pot, trig: pd.trig, count: remaining }; return state; }
        state.pending = null;
        return state;
      }
      // 過払い額を確定する（0でもよい）。カードごとの過払い効果へ分岐。
      case 'OVERPAY_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'overpay') return state;
        let amount = action.amount | 0;
        if (amount < 0) amount = 0;
        if (amount > pd.max) return state; // 過払いは残コインの範囲
        t.coins -= amount;
        if (amount > 0) log(state, `${state.players[pd.player].name} は「${C()[pd.card].name}」に +${amount}コイン 過払いした。`);
        applyOverpayEffect(state, pd.player, pd.card, amount);
        return state;
      }
      // 石工の過払い：ちょうど exact コストのアクションを2枚獲得（順に）。
      case 'STONEMASON_OVERPAY_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'stonemason_overpay') return state;
        const card = action.card;
        const canGain = (id) => costExact(state, id, pd.exact, 0, 0) && isTypeSupply(state, id, 'action');
        if (card == null || !canGain(card)) return state; // 獲得は必須
        gain(state, pd.player, card, 'discard');
        log(state, `${state.players[pd.player].name} は石工の過払いで「${C()[card].name}」を獲得した。`);
        const remaining = pd.remaining - 1;
        if (remaining > 0 && anyGainable(state, canGain)) state.pending = { type: 'stonemason_overpay', player: pd.player, exact: pd.exact, remaining };
        else state.pending = null;
        return state;
      }
      // 医者の過払い：山札の上1枚を 廃棄／捨て札／山札の上に戻す。残り回数だけ繰り返す。
      case 'DOCTOR_OVERPAY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'doctor_overpay') return state;
        const pl = state.players[pd.player];
        if (pl.deck[0] !== pd.card) return state; // 表示していた札と山札の上が一致すること
        const choice = action.choice;
        if (choice !== 'trash' && choice !== 'discard' && choice !== 'topdeck') return state;
        if (choice === 'topdeck') {
          log(state, `${pl.name} は医者の過払いで山札の上をそのままにした。`);
        } else {
          const c = pl.deck.shift();
          if (choice === 'trash') { trashCard(state, pd.player, c); log(state, `${pl.name} は医者の過払いで「${C()[c].name}」を廃棄した。`); }
          else { pl.discard.push(c); log(state, `${pl.name} は医者の過払いで「${C()[c].name}」を捨てた。`); }
        }
        startDoctorOverpay(state, pd.player, pd.remaining - 1);
        return state;
      }
      // 伝令官の過払い：捨て札置き場からカード1枚を山札の上に置く。残り回数だけ繰り返す。
      case 'HERALD_OVERPAY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'herald_overpay') return state;
        const pl = state.players[pd.player];
        const card = action.card;
        if (card == null || !removeOne(pl.discard, card)) return state; // 捨て札に実在する札のみ
        pl.deck.unshift(card);
        log(state, `${pl.name} は伝令官の過払いで「${C()[card].name}」を山札の上に置いた。`);
        const remaining = pd.remaining - 1;
        if (remaining > 0 && pl.discard.length > 0) state.pending = { type: 'herald_overpay', player: pd.player, remaining };
        else state.pending = null;
        return state;
      }
      // 石工：手札1枚を廃棄→それより安いカードを2枚獲得。
      case 'STONEMASON_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'stonemason' || pd.stage !== 'trash') return state;
        const card = action.card;
        if (me.hand.indexOf(card) < 0) return state; // 廃棄は必須（手札に実在する札のみ）
        const sm = costOf(state, card);
        removeOne(me.hand, card); trashCard(state, pi, card);
        log(state, `${me.name} は石工で「${C()[card].name}」を廃棄した。`);
        // ※ 石工の pending の maxCost は「廃棄した札のコスト」＝**その未満**（他の pending の maxCost と意味が違う）。
        if (anyGainable(state, (id) => costUnder(state, id, sm.coin, sm))) {
          state.pending = { type: 'stonemason', stage: 'gain', player: pi, maxCost: sm.coin, pot: sm.pot, debt: sm.debt, remaining: 2 };
        } else { state.pending = null; }
        return state;
      }
      case 'STONEMASON_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'stonemason' || pd.stage !== 'gain') return state;
        const card = action.card;
        const ref = { coin: pd.maxCost, pot: pd.pot || 0, debt: pd.debt || 0 };
        const canGain = (id) => costUnder(state, id, ref.coin, ref);
        if (card == null || !canGain(card)) return state; // 獲得は必須
        gain(state, pi, card, 'discard');
        log(state, `${me.name} は石工で「${C()[card].name}」を獲得した。`);
        const remaining = pd.remaining - 1;
        if (remaining > 0 && anyGainable(state, canGain)) state.pending = { type: 'stonemason', stage: 'gain', player: pi, maxCost: pd.maxCost, pot: ref.pot, debt: ref.debt, remaining };
        else state.pending = null;
        return state;
      }
      // 医者：カードを1つ指定→山札の上3枚を公開→指定と同名を全て廃棄→残りを好きな順で山札の上へ。
      case 'DOCTOR_NAME': {
        const pd = state.pending;
        if (!pd || pd.type !== 'doctor' || pd.stage !== 'name') return state;
        const named = action.card;
        if (!C()[named]) return state; // 実在するカード名のみ
        const look = [];
        for (let i = 0; i < 3; i++) {
          if (me.deck.length === 0) { if (me.discard.length === 0) break; reshuffleDeck(me); }
          if (me.deck.length === 0) break;
          look.push(me.deck.shift());
        }
        if (look.length) reveal(state, pi, look, '医者で山札の上を公開');
        const rest = [];
        look.forEach((c) => { if (c === named) { trashCard(state, pi, c); } else rest.push(c); });
        const trashed = look.length - rest.length;
        if (trashed) log(state, `${me.name} は医者で「${C()[named].name}」を ${trashed}枚 廃棄した。`);
        if (rest.length >= 2) {
          state.pending = { type: 'doctor', stage: 'order', player: pi, cards: rest };
        } else {
          rest.forEach((c) => me.deck.unshift(c)); // 0〜1枚はそのまま山札の上へ
          state.pending = null;
        }
        return state;
      }
      case 'DOCTOR_ORDER': {
        const pd = state.pending;
        if (!pd || pd.type !== 'doctor' || pd.stage !== 'order') return state;
        const order = Array.isArray(action.order) ? action.order.slice() : [];
        const a = order.slice().sort(); const b = pd.cards.slice().sort();
        if (a.length !== b.length || a.some((c, i) => c !== b[i])) return state; // 同じ多重集合のみ
        for (let i = order.length - 1; i >= 0; i--) me.deck.unshift(order[i]); // order[0] が一番上
        log(state, `${me.name} は医者で残り ${order.length}枚 を山札の上に戻した。`);
        state.pending = null;
        return state;
      }
      // 助言者：山札の上3枚を公開→左隣が1枚を選んで捨て、残りは手札へ。
      case 'ADVISOR_CHOOSE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'advisor') return state;
        const card = action.card;
        if (pd.cards.indexOf(card) < 0) return state;
        const src = state.players[pd.source];
        const rest = pd.cards.slice();
        rest.splice(rest.indexOf(card), 1);
        src.discard.push(card);
        rest.forEach((c) => src.hand.push(c));
        log(state, `${state.players[pd.player].name} は助言者で「${C()[card].name}」を捨てさせ、${src.name} は残り ${rest.length}枚 を手札に加えた。`);
        state.pending = null;
        return state;
      }
      // 広場：財宝1枚を捨てて +1財源（任意）。
      case 'PLAZA_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'plaza') return state;
        const card = action.card;
        if (card != null) {
          if (me.hand.indexOf(card) < 0 || !isTreasureFor(state, card)) return state;
          removeOne(me.hand, card); me.discard.push(card);
          me.coffers = (me.coffers || 0) + 1;
          log(state, `${me.name} は広場で財宝1枚を捨てて +1財源。`);
        }
        state.pending = null;
        return state;
      }
      // 収税吏：手札の財宝1枚を廃棄してよい→そのコスト+3までの財宝を山札の上に獲得→他の各自(手札5枚以上)は同名を捨てる。
      case 'TAXMAN_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'taxman' || pd.stage !== 'trash') return state;
        const card = action.card;
        if (card == null) { state.pending = null; return state; } // 廃棄しない＝何も起きない
        if (me.hand.indexOf(card) < 0 || !isTreasureFor(state, card)) return state;
        const tx = costOf(state, card); // 賢者の石（$3+P）を廃棄したら「$6+P まで」＝ポーション成分も引き継ぐ（成分別比較）
        removeOne(me.hand, card); trashCard(state, pi, card);
        log(state, `${me.name} は収税吏で「${C()[card].name}」を廃棄した。`);
        state.pending = { type: 'taxman', stage: 'gain', player: pi, trashedName: card, maxCost: tx.coin + 3, pot: tx.pot, debt: tx.debt };
        return state;
      }
      case 'TAXMAN_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'taxman' || pd.stage !== 'gain') return state;
        const card = action.card;
        const canGain = (id) => costUpTo(state, id, pd.maxCost, pd) && isTreasureFor(state, id);
        // アタック：他の各プレイヤー（手札5枚以上）は廃棄した財宝と同名を1枚捨てる。獲得の可否に関わらず必ず行う。
        const launchAttack = () => {
          const vics = [];
          for (let k = 1; k < state.players.length; k++) vics.push((pi + k) % state.players.length);
          taxmanEnterVictim(state, pi, vics, pd.trashedName);
        };
        if (card == null) {
          if (anyGainable(state, canGain)) return state; // 獲得できる財宝があるのに辞退＝拒否（必須）
          launchAttack(); return state;                  // 獲得できる財宝が無い＝獲得せずにアタックへ
        }
        if (!canGain(card)) return state;
        gain(state, pi, card, 'deck');
        log(state, `${me.name} は収税吏で「${C()[card].name}」を山札の上に獲得した。`);
        launchAttack();
        return state;
      }
      case 'TAXMAN_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'taxman' || pd.stage !== 'react') return state;
        taxmanApply(state, pd.source, pd.victim, pd.queue, pd.trashedName);
        return state;
      }
      // 肉屋：+2財源→手札1枚を廃棄してよい→財源を任意枚数払い、(廃棄コスト+払った財源)以下のカードを獲得。
      case 'BUTCHER_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'butcher' || pd.stage !== 'trash') return state;
        const card = action.card;
        if (card == null) { state.pending = null; return state; } // 廃棄しない
        if (me.hand.indexOf(card) < 0) return state;
        const bt = costOf(state, card);
        removeOne(me.hand, card); trashCard(state, pi, card);
        log(state, `${me.name} は肉屋で「${C()[card].name}」を廃棄した。`);
        state.pending = { type: 'butcher', stage: 'pay', player: pi, trashedCost: bt.coin, pot: bt.pot, debt: bt.debt };
        return state;
      }
      case 'BUTCHER_PAY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'butcher' || pd.stage !== 'pay') return state;
        let amount = action.amount | 0;
        if (amount < 0) amount = 0;
        if (amount > (me.coffers || 0)) return state;
        me.coffers -= amount;
        if (amount > 0) log(state, `${me.name} は肉屋で財源 ${amount}枚 を支払った。`);
        state.pending = { type: 'butcher', stage: 'gain', player: pi, maxCost: pd.trashedCost + amount, pot: pd.pot || 0, debt: pd.debt || 0 };
        return state;
      }
      case 'BUTCHER_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'butcher' || pd.stage !== 'gain') return state;
        const card = action.card;
        const canGain = (id) => costUpTo(state, id, pd.maxCost, pd);
        if (card == null) {
          if (anyGainable(state, canGain)) return state; // 獲得できるカードがあるのに辞退＝拒否（廃棄したので必須）
          state.pending = null; return state;            // 獲得先が無い＝獲得せず終了
        }
        if (!canGain(card)) return state;
        gain(state, pi, card, 'discard');
        log(state, `${me.name} は肉屋で「${C()[card].name}」を獲得した。`);
        state.pending = null;
        return state;
      }
      // 熟練工：カードを1つ指定→指定以外が3枚公開されるまで山札を公開→その3枚を手札へ、残りを捨てる。
      case 'JOURNEYMAN_NAME': {
        const pd = state.pending;
        if (!pd || pd.type !== 'journeyman' || pd.stage !== 'name') return state;
        const named = action.card;
        if (!C()[named]) return state;
        const toHand = []; const toDiscard = []; const revealed = [];
        let guard = 0;
        while (toHand.length < 3 && guard++ < 200) {
          if (me.deck.length === 0) { if (me.discard.length === 0) break; reshuffleDeck(me); }
          if (me.deck.length === 0) break;
          const c = me.deck.shift(); revealed.push(c);
          if (c === named) toDiscard.push(c); else toHand.push(c);
        }
        if (revealed.length) reveal(state, pi, revealed, '熟練工で山札の上を公開');
        toHand.forEach((c) => me.hand.push(c));
        toDiscard.forEach((c) => me.discard.push(c));
        log(state, `${me.name} は熟練工で ${toHand.length}枚 を手札に加え、${toDiscard.length}枚 を捨てた（指定＝${C()[named].name}）。`);
        state.pending = null;
        return state;
      }
      // 予言者：金貨を獲得→他の各自は呪いを獲得（獲得したら+1カード）。
      case 'SOOTHSAYER_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'soothsayer' || pd.stage !== 'react') return state;
        soothsayerCurse(state, pd.source, pd.victim, pd.queue);
        return state;
      }

      /* ===== 拡張: 異郷（Hinterlands）の選択解決 ===== */
      case 'OASIS_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'oasis') return state;
        const pl = state.players[pd.player];
        const card = action.card;
        if (card == null || pl.hand.indexOf(card) < 0) return state; // 1枚捨てる（必須）
        removeOne(pl.hand, card); pl.discard.push(card);
        log(state, `${pl.name} は手札1枚を捨てた（オアシス）。`);
        state.pending = null;
        triggerOnDiscard(state, pd.player, [card]);
        return state;
      }
      case 'DUCHESS_LOOK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'duchess_look') return state;
        const sp = state.players[pd.player];
        let discarded = null;
        if (action.discard) {
          if (sp.deck.length === 0 && sp.discard.length > 0) { reshuffleDeck(sp); }
          if (sp.deck.length > 0) { discarded = sp.deck.shift(); sp.discard.push(discarded); log(state, `${sp.name} は公爵夫人で山札の上を捨てた。`); }
        }
        // ★pending は 'duchess_look' のまま保持して捨て処理＝tunnel の金貨獲得等が獲得時対話を立てて
        //   残りのプレイヤーの窓キューを潰すのを防ぐ。織工は noPrompt で自動（銀貨）。
        if (discarded) triggerOnDiscard(state, pd.player, [discarded], true);
        state.pending = null;
        duchessEnter(state, pd.queue);
        return state;
      }
      case 'DEVELOP_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'develop' || pd.stage !== 'trash') return state;
        const pl = state.players[pd.player];
        const card = action.card;
        if (card == null || pl.hand.indexOf(card) < 0) return state; // 廃棄必須
        removeOne(pl.hand, card); trashCard(state, pd.player, card);
        log(state, `${pl.name} は「${C()[card].name}」を廃棄した（開発）。`);
        const ref = costOf(state, card);
        developAdvance(state, pd.player, ref.coin + 1, ref.coin - 1, false, false, ref.pot, ref.debt);
        return state;
      }
      case 'DEVELOP_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'develop' || pd.stage !== 'gain') return state;
        const card = action.card;
        if (card == null || !gainableBase(state, card)) return state;
        let hiDone = pd.hiDone, loDone = pd.loDone;
        if (!hiDone && costExact(state, card, pd.hi, pd.pot, pd.debt)) hiDone = true;
        else if (!loDone && costExact(state, card, pd.lo, pd.pot, pd.debt)) loDone = true;
        else return state; // どちらのコスト帯とも一致しない
        gain(state, pd.player, card, 'deck');
        log(state, `${state.players[pd.player].name} は「${C()[card].name}」を山札の上に獲得した（開発）。`);
        developAdvance(state, pd.player, pd.hi, pd.lo, hiDone, loDone, pd.pot, pd.debt);
        return state;
      }
      case 'ORACLE_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'oracle' || pd.stage !== 'react') return state;
        oracleReveal(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'ORACLE_DECIDE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'oracle' || pd.stage !== 'decide') return state;
        const tp = state.players[pd.victim];
        const cards = (pd.cards || []).slice();
        // ★pending は 'oracle' のまま保持したまま捨て処理する＝tunnel の金貨獲得等が trader_react 等の
        //   獲得時対話を立てて攻撃キュー（残りの被害者・使用者の+2カード）を潰すのを防ぐ。
        if (action.discard) {
          cards.forEach((c) => tp.discard.push(c));
          log(state, `${state.players[pd.source].name} は ${tp.name} の公開2枚を捨てさせた（神託）。`);
          triggerOnDiscard(state, pd.victim, cards, true);
        } else {
          let order = Array.isArray(action.order) && action.order.length === cards.length ? action.order.slice() : cards.slice();
          const chk = cards.slice(); let okOrder = true;
          for (const c of order) { const i = chk.indexOf(c); if (i < 0) { okOrder = false; break; } chk.splice(i, 1); }
          if (!okOrder) order = cards.slice();
          for (let i = order.length - 1; i >= 0; i--) tp.deck.unshift(order[i]); // order[0] が一番上
          log(state, `${state.players[pd.source].name} は ${tp.name} の公開2枚を山札の上に戻した（神託）。`);
        }
        state.pending = null;
        oracleEnterTarget(state, pd.source, pd.queue);
        return state;
      }
      case 'JACK_LOOK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'jack' || pd.stage !== 'look') return state;
        const pl = state.players[pd.player];
        let discarded = null;
        if (action.discard && pl.deck.length > 0) { discarded = pl.deck.shift(); pl.discard.push(discarded); log(state, `${pl.name} は何でも屋で山札の上を捨てた。`); }
        if (discarded) triggerOnDiscard(state, pd.player, [discarded], true); // この後 draw/trash が続くので織工は自動
        jackDrawTo5(state, pd.player);
        return state;
      }
      case 'JACK_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'jack' || pd.stage !== 'trash') return state;
        const pl = state.players[pd.player];
        const card = action.card;
        if (card == null) { state.pending = null; return state; } // 廃棄しない（任意）
        if (pl.hand.indexOf(card) < 0 || isTreasureFor(state, card)) return state; // 財宝でない札のみ
        removeOne(pl.hand, card); trashCard(state, pd.player, card);
        log(state, `${pl.name} は「${C()[card].name}」を廃棄した（何でも屋）。`);
        state.pending = null;
        return state;
      }
      case 'NOBLE_BRIGAND_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'noble_brigand' || pd.stage !== 'react') return state;
        nobleBrigandReveal(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'NOBLE_BRIGAND_PICK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'noble_brigand' || pd.stage !== 'pick') return state;
        const card = action.card;
        if ((card !== 'silver' && card !== 'gold') || (pd.revealed || []).indexOf(card) < 0) return state;
        nobleBrigandResolve(state, pd.source, pd.victim, pd.revealed, card, pd.queue);
        return state;
      }
      case 'SPICE_MERCHANT_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'spice_merchant' || pd.stage !== 'trash') return state;
        const pl = state.players[pd.player];
        const card = action.card;
        if (card == null) { state.pending = null; return state; } // 廃棄しない＝効果なし
        if (pl.hand.indexOf(card) < 0 || !isTreasureFor(state, card)) return state;
        removeOne(pl.hand, card); trashCard(state, pd.player, card);
        log(state, `${pl.name} は「${C()[card].name}」を廃棄した（香辛料商人）。`);
        state.pending = { type: 'spice_merchant', stage: 'choose', player: pd.player };
        return state;
      }
      case 'SPICE_MERCHANT_CHOOSE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'spice_merchant' || pd.stage !== 'choose') return state;
        if (action.choice === 'cards') { draw(state, pd.player, 2); addActions(t, 1); log(state, `${me.name} は香辛料商人（+2カード +1アクション）。`); }
        else { addCoins(state, 2); t.buys += 1; log(state, `${me.name} は香辛料商人（+2コイン +1購入）。`); }
        state.pending = null;
        return state;
      }
      case 'TRADER_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'trader' || pd.stage !== 'trash') return state;
        const pl = state.players[pd.player];
        const card = action.card;
        if (card == null || pl.hand.indexOf(card) < 0) return state; // 廃棄必須
        removeOne(pl.hand, card); trashCard(state, pd.player, card);
        const cst = cardCost(state, card);
        let g = 0; for (let i = 0; i < cst; i++) if (gain(state, pd.player, 'silver', 'discard')) g++;
        log(state, `${pl.name} は「${C()[card].name}」を廃棄し 銀貨 ${g}枚 を獲得した（交易商人）。`);
        state.pending = null;
        return state;
      }
      case 'TRADER_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'trader_react') return state;
        const pl = state.players[pd.player];
        if (action.reveal && pl.hand.includes('trader')) {
          const zone = zoneOf(pl, pd.dest);
          if (removeOne(zone, pd.card)) {
            // 獲得しかけたカードを山へ戻す（混合山は山キーを正規化して実カード配列の先頭へ）。
            //   サプライに山が無い札（闇市場デッキ由来）は戻せない＝そもそも窓を開かない（gate と同じ述語）。
            if (returnToPile(state, pd.card)) {
              log(state, `${pl.name} は交易商人を公開し、「${C()[pd.card].name}」の代わりに銀貨を獲得した。`);
              gain(state, pd.player, 'silver', 'discard');
            } else {
              zone.push(pd.card); // 戻せない＝獲得は取り消せない（安全側＝カードを消さない）
            }
          }
        }
        state.pending = null;
        return state;
      }
      case 'CARTOGRAPHER_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'cartographer') return state;
        const pl = state.players[pd.player];
        const look = (pd.cards || []).slice();
        const discard = Array.isArray(action.discard) ? action.discard : [];
        const top = Array.isArray(action.top) ? action.top : [];
        const chk = look.slice();
        for (const c of discard.concat(top)) { const i = chk.indexOf(c); if (i < 0) return state; chk.splice(i, 1); }
        if (chk.length !== 0) return state; // discard+top が look の並べ替えであること
        discard.forEach((c) => pl.discard.push(c));
        for (let i = top.length - 1; i >= 0; i--) pl.deck.unshift(top[i]); // top[0] が一番上
        log(state, `${pl.name} は地図職人（${discard.length}枚 捨て、${top.length}枚 を山札の上へ）。`);
        state.pending = null;
        if (discard.length) triggerOnDiscard(state, pd.player, discard, true);
        return state;
      }
      case 'EMBASSY_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'embassy') return state;
        const pl = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (cards.length !== Math.min(3, pl.hand.length)) return state;
        const copy = pl.hand.slice();
        for (const c of cards) if (!removeOne(copy, c)) return state;
        cards.forEach((c) => { removeOne(pl.hand, c); pl.discard.push(c); });
        log(state, `${pl.name} は ${cards.length}枚 捨てた（大使館）。`);
        state.pending = null;
        triggerOnDiscard(state, pd.player, cards);
        return state;
      }
      case 'INN_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'inn') return state;
        const pl = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (cards.length !== Math.min(2, pl.hand.length)) return state;
        const copy = pl.hand.slice();
        for (const c of cards) if (!removeOne(copy, c)) return state;
        cards.forEach((c) => { removeOne(pl.hand, c); pl.discard.push(c); });
        log(state, `${pl.name} は ${cards.length}枚 捨てた（宿屋）。`);
        state.pending = null;
        triggerOnDiscard(state, pd.player, cards);
        return state;
      }
      case 'INN_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'inn_gain') return state;
        const pl = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        const copy = pl.discard.slice();
        for (const c of cards) { if (!DOM.isType(c, 'action') || !removeOne(copy, c)) return state; }
        cards.forEach((c) => removeOne(pl.discard, c));
        pl.deck = shuffle(pl.deck.concat(cards));
        placeStash(pl); // 山札全体のシャッフル＝へそくりも配置方針に従い再配置
        log(state, `${pl.name} は宿屋で 捨て札のアクション ${cards.length}枚 を山札に混ぜてシャッフルした。`);
        state.pending = null;
        return state;
      }
      case 'MANDARIN_TOPDECK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'mandarin') return state;
        const pl = state.players[pd.player];
        const card = action.card;
        if (card == null || pl.hand.indexOf(card) < 0) return state; // 手札1枚を山札の上へ（必須）
        removeOne(pl.hand, card); pl.deck.unshift(card);
        log(state, `${pl.name} は手札1枚を山札の上に置いた（役人）。`);
        state.pending = null;
        return state;
      }
      case 'MARGRAVE_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'margrave' || pd.stage !== 'react') return state;
        margraveApply(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'MARGRAVE_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'margrave' || pd.stage !== 'discard') return state;
        const v = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (v.hand.length - cards.length !== Math.min(3, v.hand.length)) return state;
        const copy = v.hand.slice();
        for (const c of cards) if (!removeOne(copy, c)) return state;
        cards.forEach((c) => { removeOne(v.hand, c); v.discard.push(c); });
        log(state, `${v.name} は手札を ${cards.length}枚 捨てた（辺境伯）。`);
        state.pending = null;
        triggerOnDiscard(state, pd.player, cards);
        if (state.pending) return state;
        margraveEnterVictim(state, pd.source, pd.queue);
        return state;
      }
      case 'STABLES_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'stables') return state;
        const pl = state.players[pd.player];
        const card = action.card;
        if (card == null) { state.pending = null; return state; } // 捨てない＝効果なし
        if (pl.hand.indexOf(card) < 0 || !isTreasureFor(state, card)) return state;
        removeOne(pl.hand, card); pl.discard.push(card);
        draw(state, pd.player, 3); addActions(t, 1);
        log(state, `${pl.name} は財宝1枚を捨てて +3カード +1アクション（厩舎）。`);
        state.pending = null;
        return state;
      }
      case 'BORDER_VILLAGE_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'border_village') return state;
        finishGain(state, pd, action.card, (id) => costUnder(state, id, underRef(pd).coin, underRef(pd)), 'discard', '獲得した（国境の村）。');
        return state;
      }
      case 'WEAVER_MODE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'weaver' || pd.stage) return state; // 初期段階のみ（モード選択）
        if (action.mode === 'silver') {
          let g = 0; for (let i = 0; i < 2; i++) if (gain(state, pd.player, 'silver', 'discard')) g++;
          log(state, `${state.players[pd.player].name} は織工で 銀貨 ${g}枚 を獲得した。`);
          state.pending = null;
        } else {
          state.pending = { type: 'weaver', stage: 'gain', player: pd.player };
        }
        return state;
      }
      case 'WEAVER_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'weaver' || pd.stage !== 'gain') return state;
        finishGain(state, pd, action.card, (id) => costUpTo(state, id, 4), 'discard', '獲得した（織工）。');
        return state;
      }
      case 'SOUK_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'souk_trash') return state;
        const pl = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (cards.length > 2) return state; // 最大2枚
        const copy = pl.hand.slice();
        for (const c of cards) if (!removeOne(copy, c)) return state;
        cards.forEach((c) => { removeOne(pl.hand, c); trashCard(state, pd.player, c); });
        if (cards.length) log(state, `${pl.name} はスークの獲得で 手札 ${cards.length}枚 を廃棄した。`);
        state.pending = null;
        return state;
      }
      case 'GUARD_DOG_REACT': {
        // 異郷：他プレイヤーがアタックを使ったとき、手札の番犬を先に使う（免疫にはならず、pending は据え置き）。
        const pd = state.pending;
        if (!pd || !isAttackReactPending(pd)) return state;
        const pl = state.players[pd.player];
        if (!removeOne(pl.hand, 'guard_dog')) return state;
        pl.inPlay.push('guard_dog');
        draw(state, pd.player, 2);
        const extra = pl.hand.length <= 5;
        if (extra) draw(state, pd.player, 2);
        log(state, `${pl.name} は番犬を先に使った（+2カード${extra ? '、さらに+2カード' : ''}）。`);
        return state; // pending 据え置き＝この後さらに堀公開/受けるを選べる
      }
      case 'CARAVAN_GUARD_REACT': {
        // 冒険：他プレイヤーがアタックを使ったとき、手札の隊商の護衛を先にプレイする（免疫にはならず、pending 据え置き）。
        const pd = state.pending;
        if (!pd || !isAttackReactPending(pd)) return state;
        const pl = state.players[pd.player];
        if (!removeOne(pl.hand, 'caravan_guard')) return state;
        pl.inPlay.push('caravan_guard');
        // +1カードは反応した本人が引く。+1アクションは「相手の手番」なので無意味＝現在ターン(攻撃側)には加えない（相手に手番を与えない）。
        draw(state, pd.player, 1);
        armDuration(state, pd.player, 'caravan_guard'); // 自分の次の手番開始時 +$1
        log(state, `${pl.name} は隊商の護衛を先にプレイした（+1カード／次の手番に+$1）。`);
        return state; // pending 据え置き＝この後さらに堀公開/受けるを選べる
      }
      // 冒険：呪いの森/沼の妖婆を堀を出さずに受ける（免疫は付かず・即効果は無い＝次の被害者へ）。
      case 'LINGER_REACT': {
        const pd = state.pending;
        // 相手のターンをフックする持続アタック（呪いの森／沼の妖婆／移動動物園の門番）を「そのまま受ける」。
        if (!pd || (pd.type !== 'haunted_woods' && pd.type !== 'swamp_hag' && pd.type !== 'gatekeeper') || pd.stage !== 'react') return state;
        lingerAttackEnter(state, pd.source, pd.type, pd.queue, pd.rid);
        return state;
      }
      // 帝国：女魔術師のアタックを「そのまま受ける」＝この相手を enchanted にして次の相手へ。
      case 'ENCHANTRESS_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'enchantress' || pd.stage !== 'react') return state;
        state.players[pd.victim].enchanted = true;
        enchantressEnterVictim(state, pd.source, pd.queue);
        return state;
      }
      /* ========== 冒険：複雑系の選択解決 ========== */
      // 倒壊：これ（場）か手札1枚を廃棄→そのコイン分だけ山札の上を見る。
      case 'RAZE_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'raze' || pd.stage !== 'trash') return state;
        const p = state.players[pd.player];
        const card = action.card;
        let trashed = null;
        if (card === 'raze') { if (!pendingSelf(state, pd, 'raze') || !removeOne(p.inPlay, 'raze')) return state; trashCard(state, pd.player, 'raze'); trashed = 'raze'; }
        else { if (p.hand.indexOf(card) < 0) return state; removeOne(p.hand, card); trashCard(state, pd.player, card); trashed = card; }
        const n = cardCost(state, trashed);
        log(state, `${p.name} は「${C()[trashed].name}」を廃棄した（倒壊：山札の上${n}枚を見る）。`);
        const look = [];
        for (let i = 0; i < n; i++) {
          if (p.deck.length === 0) { if (p.discard.length === 0) break; reshuffleDeck(p); }
          if (p.deck.length === 0) break;
          look.push(p.deck.shift());
        }
        if (look.length) state.pending = { type: 'raze', stage: 'look', player: pd.player, cards: look };
        else state.pending = null; // 見る札が無い（コスト0廃棄/山札空）
        return state;
      }
      // 倒壊：見た札から1枚を手札に加え、残りを捨てる。
      case 'RAZE_LOOK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'raze' || pd.stage !== 'look') return state;
        const p = state.players[pd.player];
        const card = action.card;
        if (pd.cards.indexOf(card) < 0) return state;
        const rest = pd.cards.slice(); removeOne(rest, card);
        p.hand.push(card);
        rest.forEach((c) => p.discard.push(c));
        log(state, `${p.name} は倒壊で「${C()[card].name}」を手札に加え、残り${rest.length}枚を捨てた。`);
        state.pending = null;
        return state;
      }
      // 工匠：手札を好きな枚数捨て→捨てた枚数ちょうどのコストのカード1枚を山札の上に獲得してよい。
      case 'ARTIFICER_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'artificer' || pd.stage !== 'discard') return state;
        const p = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        const copy = p.hand.slice();
        for (const c of cards) if (!removeOne(copy, c)) return state; // 全て手札にあること
        cards.forEach((c) => { removeOne(p.hand, c); p.discard.push(c); });
        const n = cards.length;
        if (n) log(state, `${p.name} は工匠で ${n}枚 捨てた。`);
        // ちょうど n コストのカードを山札の上に獲得してよい（非サプライは除外）。
        if (anyGainable(state, (id) => costExact(state, id, n, 0, 0)))
          state.pending = { type: 'artificer', stage: 'gain', player: pd.player, exact: n };
        else state.pending = null;
        return state;
      }
      case 'ARTIFICER_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'artificer' || pd.stage !== 'gain') return state;
        const card = action.card;
        if (card == null) { state.pending = null; return state; } // 獲得しない（任意）
        if (!costExact(state, card, pd.exact, 0, 0)) return state;
        gain(state, pd.player, card, 'deck'); // 山札の上に獲得
        log(state, `${state.players[pd.player].name} は工匠で「${C()[card].name}」を山札の上に獲得した。`);
        state.pending = null;
        return state;
      }
      // 語り部：手札から最大3枚の財宝を選んでプレイ→所持コインを全てカードに変換。
      case 'STORYTELLER_PLAY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'storyteller') return state;
        const p = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (cards.length > 3) return state;
        const copy = p.hand.slice();
        for (const c of cards) { if (!isTreasureFor(state, c) || !removeOne(copy, c)) return state; } // 全て手札の財宝・最大3枚
        state.pending = null;
        t.storytellerResume = { player: pd.player, queue: cards.slice() };
        storytellerStep(state, pd.player);
        return state;
      }
      // 使者：山札を捨て札にしてよい（プレイ効果）。
      case 'MESSENGER_PLAY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'messenger_play') return state;
        const p = state.players[pd.player];
        if (action.discard && p.deck.length) {
          const n = p.deck.length;
          p.discard.push(...p.deck); p.deck = [];
          log(state, `${p.name} は使者で山札 ${n}枚 を捨て札にした。`);
        }
        state.pending = null;
        return state;
      }
      // 使者：そのターン最初の購入だったとき、$4以下1枚を獲得し他の各Pもコピーを獲得（購入時＝BUY から）。
      case 'MESSENGER_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'messenger_gain') return state;
        const card = action.card;
        const canGain = (id) => costUpTo(state, id, 4);
        if (card == null) { if (anyGainable(state, canGain)) return state; state.pending = null; return state; } // 候補あれば必須
        if (!canGain(card)) return state;
        gain(state, pd.player, card, 'discard');
        log(state, `${state.players[pd.player].name} は使者で「${C()[card].name}」を獲得した。`);
        // 他の各Pが手番順にコピーを獲得（在庫がある限り）。pending 保持中なので入れ子の獲得時対話は抑止。
        const n = state.players.length;
        for (let k = 1; k < n; k++) {
          const o = (pd.player + k) % n;
          if ((state.supply[card] || 0) > 0 && gain(state, o, card, 'discard')) log(state, `${state.players[o].name} は使者で「${C()[card].name}」のコピーを獲得した。`);
        }
        state.pending = null;
        return state;
      }
      case 'BEGGAR_REACT': {
        // 暗黒時代：他プレイヤーがアタックを使ったとき、手札の物乞いを捨てて銀貨2枚を獲得（1枚は山札の上・免疫にはならない）。
        const pd = state.pending;
        if (!pd || !isAttackReactPending(pd)) return state;
        const p = state.players[pd.player];
        if (!removeOne(p.hand, 'beggar')) return state;
        p.discard.push('beggar');
        let g = 0;
        if (gain(state, pd.player, 'silver', 'deck')) g++;      // 1枚目は山札の上
        if (gain(state, pd.player, 'silver', 'discard')) g++;   // 2枚目は捨て札
        log(state, `${p.name} は物乞いを捨てて銀貨${g}枚を獲得した（1枚は山札の上）。`);
        return state; // pending 据え置き＝この後さらに堀公開/受けるを選べる
      }
      case 'MARKET_SQUARE_REACT': {
        // 暗黒時代：青空市場（on-trashリアクション）＝手札の青空市場を捨てて金貨を獲得してよい。1廃棄に複数枚反応可。
        const pd = state.pending;
        if (!pd || pd.type !== 'market_square_react') return state;
        const p = state.players[pd.player];
        if (action.discard && removeOne(p.hand, 'market_square')) {
          p.discard.push('market_square');
          if (gain(state, pd.player, 'gold', 'discard')) log(state, `${p.name} は青空市場を捨てて金貨を獲得した。`);
        }
        // まだ手札に青空市場があり金貨も残っていれば、もう1枚反応できる
        state.pending = (action.discard && p.hand.includes('market_square') && (state.supply.gold || 0) > 0)
          ? { type: 'market_square_react', player: pd.player } : null;
        return state;
      }
      case 'HOVEL_REACT': {
        // 暗黒時代：納屋（避難所・on-gainリアクション）＝勝利点を獲得したとき、手札の納屋を廃棄してよい（圧縮）。
        const pd = state.pending;
        if (!pd || pd.type !== 'hovel_react') return state;
        const p = state.players[pd.player];
        if (action.trash && removeOne(p.hand, 'hovel')) {
          trashCard(state, pd.player, 'hovel');
          log(state, `${p.name} は納屋を廃棄した（勝利点獲得）。`);
        }
        state.pending = (action.trash && p.hand.includes('hovel')) ? { type: 'hovel_react', player: pd.player } : null;
        return state;
      }
      case 'BERSERKER_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'berserker' || pd.stage !== 'gain') return state;
        const canGain = (id) => costUpTo(state, id, pd.maxCost);
        if (action.card == null) {
          if (anyGainable(state, canGain)) return state; // 獲得先があるのに辞退＝拒否（必須）
          berserkerLaunchAttack(state, pd.player); return state;
        }
        if (!canGain(action.card)) return state;
        gain(state, pd.player, action.card, 'discard');
        log(state, `${state.players[pd.player].name} は「${C()[action.card].name}」を獲得した（狂戦士）。`);
        berserkerLaunchAttack(state, pd.player);
        return state;
      }
      case 'BERSERKER_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'berserker' || pd.stage !== 'react') return state;
        berserkerApply(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'BERSERKER_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'berserker' || pd.stage !== 'discard') return state;
        const v = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (v.hand.length - cards.length !== Math.min(3, v.hand.length)) return state;
        const copy = v.hand.slice();
        for (const c of cards) if (!removeOne(copy, c)) return state;
        cards.forEach((c) => { removeOne(v.hand, c); v.discard.push(c); });
        log(state, `${v.name} は手札を ${cards.length}枚 捨てた（狂戦士）。`);
        state.pending = null;
        triggerOnDiscard(state, pd.player, cards);
        if (state.pending) return state;
        berserkerEnterVictim(state, pd.source, pd.queue);
        return state;
      }
      case 'WHEELWRIGHT_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'wheelwright' || pd.stage !== 'discard') return state;
        const pl = state.players[pd.player];
        const card = action.card;
        if (card == null) { state.pending = null; return state; } // 捨てない
        if (pl.hand.indexOf(card) < 0) return state;
        removeOne(pl.hand, card); pl.discard.push(card);
        const wr = costOf(state, card);
        log(state, `${pl.name} は「${C()[card].name}」を捨てた（車大工）。`);
        triggerOnDiscard(state, pd.player, [card], true); // この後 獲得ステップがあるので織工は自動
        if (anyGainable(state, (id) => costUpTo(state, id, wr.coin, wr) && isTypeSupply(state, id, 'action'))) {
          state.pending = { type: 'wheelwright', stage: 'gain', player: pd.player, maxCost: wr.coin, pot: wr.pot, debt: wr.debt };
        } else {
          state.pending = null;
        }
        return state;
      }
      case 'WHEELWRIGHT_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'wheelwright' || pd.stage !== 'gain') return state;
        finishGain(state, pd, action.card, (id) => costUpTo(state, id, pd.maxCost, pd) && isTypeSupply(state, id, 'action'), 'discard', 'アクションを獲得した（車大工）。');
        return state;
      }
      case 'WITCHS_HUT_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'witchs_hut' || pd.stage !== 'discard') return state;
        const pl = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (cards.length !== Math.min(2, pl.hand.length)) return state;
        const copy = pl.hand.slice();
        for (const c of cards) if (!removeOne(copy, c)) return state;
        if (cards.length) reveal(state, pd.player, cards, '魔女の小屋で公開して捨てる');
        cards.forEach((c) => { removeOne(pl.hand, c); pl.discard.push(c); });
        const bothActions = cards.length === 2 && cards.every((c) => DOM.isType(c, 'action'));
        log(state, `${pl.name} は魔女の小屋で ${cards.length}枚 を公開して捨てた${bothActions ? '（両方アクション→呪い配布）' : ''}。`);
        state.pending = null;
        triggerOnDiscard(state, pd.player, cards, true);
        if (bothActions && !state.pending) {
          const q = [];
          for (let k = 1; k < state.players.length; k++) q.push((pd.player + k) % state.players.length);
          witchsHutEnterVictim(state, pd.player, q);
        }
        return state;
      }
      case 'WITCHS_HUT_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'witchs_hut' || pd.stage !== 'react') return state;
        witchsHutCurse(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'CAULDRON_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'cauldron' || pd.stage !== 'react') return state;
        cauldronCurse(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      case 'DUCHESS_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'duchess_gain') return state;
        if (action.gain && (state.supply.duchess || 0) > 0) {
          gain(state, pd.player, 'duchess', 'discard');
          log(state, `${state.players[pd.player].name} は公領の獲得で 公爵夫人1枚 を獲得した。`);
        }
        state.pending = null;
        return state;
      }
      case 'FARMLAND_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'farmland' || pd.stage !== 'trash') return state;
        const pl = state.players[pd.player];
        // 手札が空なら廃棄できない＝何もせず解決（公式：手札が無ければ農地は何も廃棄しない）。
        //   ※呪いの森で購入時に手札が山札の上へ流れた稀ケース(全プール混成fuzz)の終端保証＝デッドロック回避。
        if (pl.hand.length === 0) { state.pending = null; return state; }
        const card = action.card;
        if (card == null || pl.hand.indexOf(card) < 0) return state; // 廃棄必須（購入時）
        removeOne(pl.hand, card); trashCard(state, pd.player, card);
        const fl = costOf(state, card);
        const exact = fl.coin + 2;
        log(state, `${pl.name} は「${C()[card].name}」を廃棄した（農地）。`);
        if (anyGainable(state, (id) => costExact(state, id, exact, fl.pot, fl.debt))) {
          state.pending = { type: 'farmland', stage: 'gain', player: pd.player, exactCost: exact, pot: fl.pot, debt: fl.debt };
        } else {
          state.pending = null;
        }
        return state;
      }
      case 'FARMLAND_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'farmland' || pd.stage !== 'gain') return state;
        finishGain(state, pd, action.card, (id) => costExact(state, id, pd.exactCost, pd.pot, pd.debt), 'discard', '獲得した（農地）。');
        return state;
      }
      case 'HAGGLER_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'haggler') return state;
        const ref = underRef(pd);
        const canGain = (id) => hagglerCanGain(state, ref, id);
        if (action.card == null) {
          if (anyGainable(state, canGain)) return state; // 獲得先があるのに辞退＝拒否（値切り屋は必須）
          state.pending = null; return state;
        }
        if (!canGain(action.card)) return state;
        gain(state, pd.player, action.card, 'discard');
        log(state, `${state.players[pd.player].name} は値切り屋で「${C()[action.card].name}」を獲得した。`);
        const remaining = (pd.remaining || 1) - 1;
        state.pending = (remaining > 0 && anyGainable(state, canGain))
          ? { type: 'haggler', player: pd.player, remaining, maxCost: pd.maxCost, coin: ref.coin, pot: ref.pot, debt: ref.debt } : null;
        return state;
      }
      case 'FOOLS_GOLD_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'fools_gold_react') return state;
        const pl = state.players[pd.player];
        if (action.trash && pl.hand.includes('fools_gold')) {
          removeOne(pl.hand, 'fools_gold'); trashCard(state, pd.player, 'fools_gold');
          gain(state, pd.player, 'gold', 'deck');
          log(state, `${pl.name} は愚者の黄金を廃棄し、金貨1枚を山札の上に獲得した。`);
        }
        foolsGoldReactEnter(state, pd.queue);
        return state;
      }
      case 'IGG_PLAY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'igg_play') return state;
        if (action.gain) { if (gain(state, pd.player, 'copper', 'hand')) log(state, `${state.players[pd.player].name} は不正利得で 銅貨1枚を手札に獲得した。`); }
        state.pending = null;
        return state;
      }
      case 'SCHEME_CLEANUP': {
        const pd = state.pending;
        if (!pd || pd.type !== 'scheme_cleanup') return state;
        const pl = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (cards.length > (pd.max || 0)) return state;
        const copy = pl.inPlay.slice();
        for (const c of cards) { if (!DOM.isType(c, 'action') || DOM.isType(c, 'duration') || !removeOne(copy, c)) return state; }
        cards.forEach((c) => { removeOne(pl.inPlay, c); pl.deck.unshift(c); });
        if (cards.length) log(state, `${pl.name} は策謀で ${cards.length}枚 を山札の上に置いた。`);
        state.pending = null;
        cleanupAndAdvance(state);
        return state;
      }

      /* ===== 移動動物園（Menagerie）===== */
      // 追放マットの払い戻し（一般ルール）＝獲得したカードと同名のカードを、追放マットから捨て札にしてよい。
      //   **「全部捨てる」か「1枚も捨てない」の二択**（公式ルールブック "You cannot discard just one of them."）。
      //   n 省略＝全部。0＝戻さない。中途半端な枚数は状態不変で拒否する。
      case 'EXILE_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'exile_discard') return state;
        const have = exileCount(state.players[pd.player], pd.card);
        const n = (action.n == null) ? have : (action.n | 0);
        if (n !== 0 && n !== have) return state; // 一部だけ捨てることはできない
        state.pending = null;                    // 先に閉じる（捨て札が坑道/村有緑地の窓を開け得るため）
        if (n > 0) discardFromExile(state, pd.player, pd.card, n);
        return state;
      }
      // 艀＝「今」か「次の自分のターンの開始時」に +3カード +1購入（強制の二択）。
      case 'BARGE_CHOOSE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'barge_choose') return state;
        if (action.choice !== 'now' && action.choice !== 'next') return state;
        state.pending = null;
        if (action.choice === 'now') {
          draw(state, pd.player, 3); t.buys += 1;
          log(state, `${state.players[pd.player].name} は艀で +3カード +1購入（今）。`);
        } else {
          armDuration(state, pd.player, 'barge');
          log(state, `${state.players[pd.player].name} は艀を次のターンに持ち越した。`);
        }
        return state;
      }
      // 賞金稼ぎ＝手札1枚を追放（強制）。**追放する前に**同名が追放マットに無かったなら +$3。
      case 'BOUNTY_HUNTER_EXILE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'bounty_hunter_exile') return state;
        const pl = state.players[pd.player];
        const card = action.card;
        if (pl.hand.indexOf(card) < 0) return state;
        const had = exileCount(pl, card) > 0;
        exileFromZone(state, pd.player, card, pl.hand);
        if (!had) { addCoins(state, 3); log(state, `${pl.name} は賞金稼ぎで +$3（追放マットに同名が無かった）。`); }
        state.pending = null;
        return state;
      }
      // ラクダの隊列＝サプライから勝利点でないカード1枚を追放（強制）。
      case 'CAMEL_TRAIN_EXILE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'camel_train_exile') return state;
        const id = action.card;
        // 終端保証：追放できる山が1つも無くなっていたら窓を閉じる（強制効果でも詰ませない）。
        if (!anyExilableSupply(state, (cid) => !DOM.isType(cid, 'victory'))) { state.pending = null; return state; }
        if (!id || DOM.isType(id, 'victory') || exilableSupplyIds(state).indexOf(id) < 0) return state;
        exileFromSupply(state, pd.player, id);
        state.pending = null;
        return state;
      }
      // 黒猫＝アタックを受ける（呪い1枚）。
      case 'BLACK_CAT_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'black_cat' || pd.stage !== 'react') return state;
        state.pending = null;
        blackCatCurse(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      // 枢機卿＝アタックを受ける（山札の上2枚を公開）。
      case 'CARDINAL_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'cardinal' || pd.stage !== 'react') return state;
        state.pending = null;
        cardinalReveal(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      // 枢機卿＝公開した2枚のうち $3〜$6 のどちらを追放するか（被害者が選ぶ）。
      case 'CARDINAL_PICK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'cardinal' || pd.stage !== 'pick') return state;
        const card = action.card;
        if ((pd.cands || []).indexOf(card) < 0) return state;
        state.pending = null;
        cardinalFinish(state, pd.source, pd.victim, (pd.revealed || []).slice(), card, pd.queue);
        return state;
      }
      // 魔女の集会＝アタックを受ける（呪いを追放／できなければ追放マットの呪いを全部捨てる）。
      case 'COVEN_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'coven' || pd.stage !== 'react') return state;
        state.pending = null;
        covenApply(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      // 強制退去＝手札1枚を追放（強制）→ それより最大2コイン高い「名前の異なる」カード1枚を獲得（強制）。
      case 'DISPLACE_EXILE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'displace_exile') return state;
        const pl = state.players[pd.player];
        const card = action.card;
        if (pl.hand.indexOf(card) < 0) return state;
        const c = costOf(state, card);
        exileFromZone(state, pd.player, card, pl.hand);
        const canGet = (id) => id !== card && costUpTo(state, id, c.coin + 2, { pot: c.pot, debt: c.debt });
        if (anyGainable(state, canGet)) state.pending = { type: 'displace_gain', player: pd.player, from: card, maxCost: c.coin + 2, pot: c.pot, debt: c.debt };
        else state.pending = null;
        return state;
      }
      case 'DISPLACE_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'displace_gain') return state;
        const canGet = (id) => id !== pd.from && costUpTo(state, id, pd.maxCost, { pot: pd.pot, debt: pd.debt });
        finishGain(state, pd, action.card, canGet, 'discard', 'を強制退去で獲得した。');
        return state;
      }
      // 鷹匠＝これより安いカード1枚を「手札に」獲得する。
      case 'FALCONER_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'falconer_gain') return state;
        finishGain(state, pd, action.card, (id) => costUnder(state, id, pd.under), 'hand', 'を鷹匠で手札に獲得した。');
        return state;
      }
      // 鷹匠（リアクション）＝誰かが種別2つ以上のカードを獲得したとき、手札からこれを使用してよい。
      //   相手のターン中でもよい＝アクション権は消費しない（場に出たカードは自分の次のクリンナップで捨てる＝隊商の護衛と同型）。
      case 'FALCONER_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'falconer_react') return state;
        state.pending = null;
        if (!action.play) return state;
        const pl = state.players[pd.player];
        if (!removeOne(pl.hand, 'falconer')) return state;
        pl.inPlay.push('falconer');
        if (t && pd.player === t.active) t.actionsPlayed = (t.actionsPlayed || 0) + 1;
        log(state, `${pl.name} は鷹匠を手札から使用した。`);
        applyEffect(state, 'falconer', pd.player);
        return state;
      }
      // ヤギ飼い＝手札1枚を廃棄してもよい（任意）。
      case 'GOATHERD_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'goatherd_trash') return state;
        const card = action.card;
        if (card == null) { state.pending = null; return state; }
        if (!trashFromHand(state, pd.player, [card], 1, 'をヤギ飼いで廃棄した。')) return state;
        state.pending = null;
        return state;
      }
      // 馬丁＝コスト$4以下のカード1枚を獲得。獲得したカードの種別ごとにボーナス（複合種別なら全部得る）。
      case 'GROOM_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'groom_gain') return state;
        const card = action.card;
        if (!finishGain(state, pd, card, (id) => costUpTo(state, id, 4), 'discard', 'を馬丁で獲得した。')) return state;
        if (card != null) {
          if (DOM.isType(card, 'action')) { if (gainHorse(state, pd.player)) log(state, `${state.players[pd.player].name} は馬丁で馬1枚を獲得した。`); }
          if (isTreasureFor(state, card)) { if (gain(state, pd.player, 'silver', 'discard')) log(state, `${state.players[pd.player].name} は馬丁で銀貨1枚を獲得した。`); }
          if (DOM.isType(card, 'victory')) { draw(state, pd.player, 1); addActions(t, 1); log(state, `${state.players[pd.player].name} は馬丁で +1カード +1アクション。`); }
        }
        return state;
      }
      // 旅籠（獲得時）＝手札の財宝を好きな枚数 公開して捨て、その枚数だけ馬を獲得する。
      case 'HOSTELRY_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'hostelry_discard') return state;
        const pl = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        const copy = pl.hand.slice();
        for (const c of cards) { if (!isTreasureFor(state, c) || !removeOne(copy, c)) return state; }
        state.pending = null;
        if (cards.length) {
          reveal(state, pd.player, cards.slice(), '旅籠で財宝を公開');
          cards.forEach((c) => { removeOne(pl.hand, c); pl.discard.push(c); });
          triggerOnDiscard(state, pd.player, cards.slice());
          let got = 0; for (let i = 0; i < cards.length; i++) if (gainHorse(state, pd.player)) got++;
          log(state, `${pl.name} は旅籠で 財宝${cards.length}枚 を捨て、馬${got}枚 を獲得した。`);
        }
        return state;
      }
      // 狩猟小屋＝手札をすべて捨てて +5カード してもよい。
      case 'HUNTING_LODGE_CHOOSE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'hunting_lodge_choose') return state;
        state.pending = null;
        if (!action.discard) return state;
        const pl = state.players[pd.player];
        const dumped = pl.hand.slice();
        pl.hand = [];
        dumped.forEach((c) => pl.discard.push(c));
        if (dumped.length) triggerOnDiscard(state, pd.player, dumped.slice());
        draw(state, pd.player, 5);
        log(state, `${pl.name} は狩猟小屋で 手札${dumped.length}枚 を捨てて +5カード。`);
        return state;
      }
      // 首謀者＝次の自分のターン開始時、手札のアクション1枚を3回使用してよい（玉座の間と同型＝replay に2回積む）。
      case 'MASTERMIND_PLAY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'mastermind_play') return state;
        const pl = state.players[pd.player];
        const card = action.card;
        if (card != null) {
          if (pl.hand.indexOf(card) < 0) return state;
          if (!DOM.isType(card, 'action') && !inheritedEstate(pl, card)) return state;
        }
        state.pending = null;
        if (card == null) return state;
        removeOne(pl.hand, card); pl.inPlay.push(card);
        t.actionsPlayed = (t.actionsPlayed || 0) + 1;
        log(state, `${pl.name} は首謀者で「${C()[card].name}」を3回使用する。`);
        applyEffect(state, card, pd.player);
        (state.replay = state.replay || []).push({ player: pd.player, card });
        state.replay.push({ player: pd.player, card });
        return state;
      }
      // 聖域＝手札1枚を追放してもよい（任意）。
      case 'SANCTUARY_EXILE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'sanctuary_exile') return state;
        const pl = state.players[pd.player];
        const card = action.card;
        if (card == null) { state.pending = null; return state; }
        if (pl.hand.indexOf(card) < 0) return state;
        exileFromZone(state, pd.player, card, pl.hand);
        state.pending = null;
        return state;
      }
      // がらくた＝手札1枚を廃棄（強制）→ そのコスト$1につき1つ、6種から「異なるもの」を選ぶ。
      case 'SCRAP_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'scrap_trash') return state;
        const card = action.card;
        if (state.players[pd.player].hand.indexOf(card) < 0) return state;
        const n = Math.min(6, costOf(state, card).coin);
        if (!trashFromHand(state, pd.player, [card], 1, 'をがらくたで廃棄した。')) return state;
        if (n > 0) state.pending = { type: 'scrap_choose', player: pd.player, count: n };
        else state.pending = null;
        return state;
      }
      case 'SCRAP_CHOOSE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'scrap_choose') return state;
        const picks = Array.isArray(action.choices) ? action.choices : [];
        const VALID = ['card', 'action', 'buy', 'coin', 'silver', 'horse'];
        if (picks.length !== Math.min(pd.count, VALID.length)) return state;      // ちょうど count 個（上限6）
        if (new Set(picks).size !== picks.length) return state;                    // 異なるものを選ぶ
        for (const k of picks) if (VALID.indexOf(k) < 0) return state;
        state.pending = null;
        const pl = state.players[pd.player];
        // カード面の並び順で解決する（クリック順に依存しない＝選び方で結果が変わらない）。
        VALID.forEach((k) => {
          if (picks.indexOf(k) < 0) return;
          if (k === 'card') draw(state, pd.player, 1);
          else if (k === 'action') addActions(t, 1);
          else if (k === 'buy') t.buys += 1;
          else if (k === 'coin') addCoins(state, 1);
          else if (k === 'silver') gain(state, pd.player, 'silver', 'discard');
          else if (k === 'horse') gainHorse(state, pd.player);
        });
        log(state, `${pl.name} はがらくたで ${picks.length}種の効果を選んだ。`);
        return state;
      }
      // 牧羊犬（リアクション）＝自分がカードを獲得したとき、手札からこれを使用してよい（相手のターン中でも）。
      case 'SHEEPDOG_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'sheepdog_react') return state;
        state.pending = null;
        if (!action.play) return state;
        const pl = state.players[pd.player];
        if (!removeOne(pl.hand, 'sheepdog')) return state;
        pl.inPlay.push('sheepdog');
        if (t && pd.player === t.active) t.actionsPlayed = (t.actionsPlayed || 0) + 1;
        log(state, `${pl.name} は牧羊犬を手札から使用した。`);
        applyEffect(state, 'sheepdog', pd.player);
        return state;
      }
      // そり（リアクション）＝自分がカードを獲得したとき、これを捨て札にしてよい。
      //   そうしたら獲得したカードを手札に加えるか山札の上に置く。
      case 'SLEIGH_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'sleigh_react') return state;
        const where = action.where;
        if (where == null) { state.pending = null; return state; }
        if (where !== 'hand' && where !== 'deck') return state;
        const pl = state.players[pd.player];
        if (!removeOne(pl.hand, 'sleigh')) { state.pending = null; return state; }
        pl.discard.push('sleigh');
        state.pending = null;
        const z = zoneOf(pl, pd.dest);
        if (removeOne(z, pd.card)) {
          if (where === 'hand') pl.hand.push(pd.card); else pl.deck.unshift(pd.card);
          log(state, `${pl.name} はそりを捨て、「${C()[pd.card].name}」を${where === 'hand' ? '手札に加えた' : '山札の上に置いた'}。`);
        }
        triggerOnDiscard(state, pd.player, ['sleigh']);
        return state;
      }
      // 村有緑地＝「今」か「次のターンの開始時」に +1カード +2アクション（強制の二択）。
      case 'VILLAGE_GREEN_CHOOSE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'village_green_choose') return state;
        if (action.choice !== 'now' && action.choice !== 'next') return state;
        state.pending = null;
        if (action.choice === 'now') {
          draw(state, pd.player, 1);
          if (t && pd.player === t.active) addActions(t, 2); // 相手の手番中に使った場合、アクション権は意味を持たない
          log(state, `${state.players[pd.player].name} は村有緑地で +1カード +2アクション（今）。`);
        } else {
          armDuration(state, pd.player, 'village_green');
          log(state, `${state.players[pd.player].name} は村有緑地を次のターンに持ち越した。`);
        }
        return state;
      }
      // 村有緑地（リアクション）＝クリンナップ以外でこれを捨て札にしたとき、これを使用してよい。
      case 'VILLAGE_GREEN_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'village_green_react') return state;
        state.pending = null;
        if (!action.play) return state;
        const pl = state.players[pd.player];
        if (!removeOne(pl.discard, 'village_green')) return state;
        pl.inPlay.push('village_green');
        if (t && pd.player === t.active) t.actionsPlayed = (t.actionsPlayed || 0) + 1;
        log(state, `${pl.name} は捨て札にした村有緑地を使用した。`);
        applyEffect(state, 'village_green', pd.player);
        return state;
      }
      // 炉＝次に使うカードの解決前に、それと同じカード1枚を獲得してもよい（獲得しなくても権利は消費済み）。
      case 'KILN_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'kiln_gain') return state;
        state.pending = null;
        if (action.gain) {
          if (gain(state, pd.player, pd.card, 'discard')) log(state, `${state.players[pd.player].name} は炉で「${C()[pd.card].name}」を獲得した。`);
        }
        // 中断していた「使用」の解決をここで再開する（習性を使うなら記載効果の代わりに習性を解決）。
        if (pd.kind === 'treasure') { applyTreasureEffect(state, pd.player, pd.card); applyCoinPenalty(state); }
        else if (pd.way && isUsableWay(state, pd.way)) applyWay(state, pd.way, pd.card, pd.player);
        else applyEffect(state, pd.card, pd.player);
        return state;
      }
      // 行人＝銀貨1枚を獲得してもよい。
      case 'WAYFARER_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'wayfarer_gain') return state;
        state.pending = null;
        if (action.gain) { if (gain(state, pd.player, 'silver', 'discard')) log(state, `${state.players[pd.player].name} は行人で銀貨1枚を獲得した。`); }
        return state;
      }

      /* ===== 移動動物園：習性（Way）の選択待ち ===== */
      // チョウの習性＝これをその山に戻してもよい。そうしたら ちょうど1コイン高いカード1枚を獲得する。
      case 'WAY_BUTTERFLY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'way_butterfly') return state;
        state.pending = null;
        if (!action.ret) return state;
        const pl = state.players[pd.player];
        const c = costOf(state, pd.card);
        if (!removeOne(pl.inPlay, pd.card)) return state;
        returnToPile(state, pd.card);
        log(state, `${pl.name} は「${C()[pd.card].name}」をその山に戻した（チョウの習性）。`);
        const canGet = (id) => costExact(state, id, c.coin + 1, c.pot, c.debt);
        if (anyGainable(state, canGet)) state.pending = { type: 'way_butterfly_gain', player: pd.player, exactCost: c.coin + 1, pot: c.pot, debt: c.debt };
        return state;
      }
      case 'WAY_BUTTERFLY_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'way_butterfly_gain') return state;
        finishGain(state, pd, action.card, (id) => costExact(state, id, pd.exactCost, pd.pot, pd.debt), 'discard', 'をチョウの習性で獲得した。');
        return state;
      }
      // ヤギの習性＝手札から1枚を廃棄する（強制）。
      case 'WAY_GOAT_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'way_goat_trash') return state;
        if (!trashFromHand(state, pd.player, [action.card], 1, 'をヤギの習性で廃棄した。')) return state;
        state.pending = null;
        return state;
      }
      // ドブネズミの習性＝財宝1枚を捨て札にしてもよい。そうしたら これと同じカード1枚を獲得する。
      case 'WAY_RAT_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'way_rat_discard') return state;
        const card = action.card;
        if (card == null) { state.pending = null; return state; }
        const pl = state.players[pd.player];
        if (!isTreasureFor(state, card) || pl.hand.indexOf(card) < 0) return state;
        removeOne(pl.hand, card); pl.discard.push(card);
        state.pending = null;
        triggerOnDiscard(state, pd.player, [card]);
        if (gain(state, pd.player, pd.card, 'discard')) log(state, `${pl.name} はドブネズミの習性で「${C()[pd.card].name}」を獲得した。`);
        return state;
      }
      // アザラシの習性＝このターン、獲得したカードを山札の上に置いてもよい。
      case 'WAY_SEAL_TOPDECK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'way_seal_topdeck') return state;
        state.pending = null;
        if (!action.top) return state;
        const pl = state.players[pd.player];
        const z = zoneOf(pl, pd.dest);
        if (removeOne(z, pd.card)) {
          pl.deck.unshift(pd.card);
          log(state, `${pl.name} はアザラシの習性で「${C()[pd.card].name}」を山札の上に置いた。`);
        }
        return state;
      }

      /* ===== 移動動物園：イベント20種の選択待ち ===== */
      // 特価品＝コスト$5以下の勝利点でないカード1枚を獲得（強制）。その後、他の各プレイヤーが馬1枚を獲得する。
      case 'BARGAIN_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'bargain_gain') return state;
        const id = action.card;
        if (!id || !bargainCanGain(state, id)) return state;
        state.pending = null;
        gain(state, pd.player, id, 'discard');
        bargainHorses(state, pd.player);
        return state;
      }
      // 要求＝コスト$4以下のカード1枚を山札の上に獲得（強制。馬は購入時に獲得済み＝この1枚が一番上になる）。
      case 'DEMAND_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'demand_gain') return state;
        const id = action.card;
        if (!id || !upToCanGain(state, id, 4)) return state;
        state.pending = null;
        gain(state, pd.player, id, 'deck');
        return state;
      }
      // 絶望＝呪い1枚を獲得してもよい。獲得したなら +1購入 +$2。
      case 'DESPERATION': {
        const pd = state.pending;
        if (!pd || pd.type !== 'desperation') return state;
        state.pending = null;
        if (!action.gain) return state;
        // 支配（Possession）中は獲得するのが支配者＝購入した本人は「獲得していない」ので +1購入 +$2 を得ない（公式）。
        const possessed = (t.possessedBy != null && pd.player === t.active);
        if (gain(state, pd.player, 'curse', 'discard') && !possessed) {
          t.buys += 1; addCoins(state, 2); applyCoinPenalty(state);
          log(state, `${state.players[pd.player].name} は絶望で呪い1枚を獲得し +1購入 +$2。`);
        }
        return state;
      }
      // 放逐＝手札から「同じ名前」のカードを好きな枚数 追放する（0枚＝追放しないも可／2種類は不可）。
      case 'BANISH_EXILE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'banish') return state;
        const pl = state.players[pd.player];
        const id = action.card;
        if (id == null) { state.pending = null; return state; } // 追放しない
        const have = pl.hand.filter((c) => c === id).length;
        const n = (action.n == null) ? have : (action.n | 0);
        if (have <= 0 || n < 1 || n > have) return state;
        state.pending = null;
        for (let i = 0; i < n; i++) exileFromZone(state, pd.player, id, pl.hand);
        return state;
      }
      // 投資＝サプライからアクション1枚を追放する（強制）。以後、他プレイヤーがその同名を獲得/投資すると +2カード。
      case 'INVEST_EXILE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'invest') return state;
        const id = action.card;
        // 終端保証：追放できるアクションが無くなっていたら窓を閉じる。
        if (!anyExilableSupply(state, (cid) => DOM.isType(cid, 'action'))) { state.pending = null; return state; }
        if (!id || !DOM.isType(id, 'action') || exilableSupplyIds(state).indexOf(id) < 0) return state;
        const pl = state.players[pd.player];
        state.pending = null;
        if (exileFromSupply(state, pd.player, id)) {
          setInvestCount(pl, id, investCount(pl, id) + 1);
          log(state, `${pl.name} は「${C()[id].name}」に投資した（他プレイヤーがこれを獲得/投資すると +2カード）。`);
          // 「他のプレイヤーがそのカードを**投資**したとき」も +2カード（公式）。
          triggerInvest(state, pd.player, id);
        }
        return state;
      }
      // 輸送＝二択（実行できない選択肢も選べる＝公式）。
      case 'TRANSPORT_MODE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'transport' || pd.stage !== 'mode') return state;
        if (action.mode !== 'exile' && action.mode !== 'return') return state;
        const pl = state.players[pd.player];
        if (action.mode === 'exile') {
          if (!anyExilableSupply(state, (cid) => DOM.isType(cid, 'action'))) { state.pending = null; return state; }
          state.pending = { type: 'transport', stage: 'exile', player: pd.player };
        } else {
          if (!(pl.exile || []).some((c) => DOM.isType(c, 'action'))) { state.pending = null; return state; }
          state.pending = { type: 'transport', stage: 'return', player: pd.player };
        }
        return state;
      }
      case 'TRANSPORT_PICK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'transport' || (pd.stage !== 'exile' && pd.stage !== 'return')) return state;
        const pl = state.players[pd.player];
        const id = action.card;
        // 終端保証：対象が無くなっていたら窓を閉じる（輸送は「実行できない選択肢も選べる」＝何も起きずに終わる）。
        const stillOk = pd.stage === 'exile'
          ? anyExilableSupply(state, (cid) => DOM.isType(cid, 'action'))
          : (pl.exile || []).some((c) => DOM.isType(c, 'action'));
        if (!stillOk) { state.pending = null; return state; }
        if (!id || !DOM.isType(id, 'action')) return state;
        if (pd.stage === 'exile') {
          if (exilableSupplyIds(state).indexOf(id) < 0) return state;
          state.pending = null;
          exileFromSupply(state, pd.player, id);
        } else {
          if (!removeOne(pl.exile || [], id)) return state;
          state.pending = null;
          pl.deck.unshift(id);
          // 投資したコピーと投資していないコピーが両方あるなら「投資していない方」を動かす
          //   （公式はどちらか選べるが、投資を残すほうが常に得なので自動で最善を選ぶ）。
          const left = exileCount(pl, id);
          if (investCount(pl, id) > left) setInvestCount(pl, id, left);
          log(state, `${pl.name} は輸送で追放マットの「${C()[id].name}」を山札の上に置いた。`);
        }
        return state;
      }
      // 苦労＝手札のアクション1枚を使用してよい（アクション権を消費しない）。
      case 'TOIL_PLAY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'toil') return state;
        const pl = state.players[pd.player];
        const card = action.card;
        state.pending = null;
        if (card == null) return state;
        if (pl.hand.indexOf(card) < 0) return state;
        if (!DOM.isType(card, 'action') && !inheritedEstate(pl, card)) return state;
        playCardNoAction(state, pd.player, card, pl.hand, '苦労で', action.way);
        return state;
      }
      // 進軍＝捨て札置き場のアクション1枚を使用してよい（アクション権を消費しない）。
      case 'MARCH_PLAY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'march') return state;
        const pl = state.players[pd.player];
        const card = action.card;
        state.pending = null;
        if (card == null) return state;
        if (pl.discard.indexOf(card) < 0 || !DOM.isType(card, 'action')) return state;
        playCardNoAction(state, pd.player, card, pl.discard, '進軍で', action.way);
        return state;
      }
      // 博打＝捨てたカードがアクション/財宝なら使用してよい（アクション権を消費しない）。
      case 'GAMBLE_PLAY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'gamble') return state;
        const pl = state.players[pd.player];
        state.pending = null;
        if (!action.play) return state;
        if (pl.discard.indexOf(pd.card) < 0) return state; // 既に動かされていたら使えない（lose track）
        playCardNoAction(state, pd.player, pd.card, pl.discard, '博打で', action.way);
        return state;
      }
      // 遅延＝手札のアクション1枚を脇に置いてもよい（次の自分のターン開始時に使用する）。
      case 'DELAY_SETASIDE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'delay') return state;
        const pl = state.players[pd.player];
        const card = action.card;
        state.pending = null;
        if (card == null) return state;
        if (pl.hand.indexOf(card) < 0 || !DOM.isType(card, 'action')) return state;
        removeOne(pl.hand, card);
        (pl.eventSetAside = pl.eventSetAside || []).push(card);
        log(state, `${pl.name} は遅延で「${C()[card].name}」を脇に置いた（次のターン開始時に使用する）。`);
        return state;
      }
      // 遅延／刈り入れ＝ターン開始時に脇のカードを使用する（強制・アクション権を消費しない）。
      case 'EVENT_PLAY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'event_play') return state;
        const pl = state.players[pd.player];
        const card = (pl.eventSetAside || [])[0];
        state.pending = null; // 先に閉じる（使用が新たな選択待ちを立てることがある）
        if (card == null) { popStartQueue(state); return state; }
        playCardNoAction(state, pd.player, card, pl.eventSetAside, '脇に置いた', action.way);
        return state; // 残りの開始時キューは reduce 末尾の startQueue 安全網が進める
      }
      // 増大＝手札から勝利点でないカード1枚を廃棄してもよい → 廃棄したら、それより最大$2高いカード1枚を獲得（強制）。
      case 'ENHANCE_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'enhance' || pd.stage !== 'trash') return state;
        const pl = state.players[pd.player];
        const card = action.card;
        if (card == null) { state.pending = null; return state; } // 廃棄しない
        if (pl.hand.indexOf(card) < 0 || DOM.isType(card, 'victory')) return state;
        const ref = costOf(state, card); // 廃棄時点の現在コスト（橋/街道/行商人の影響を受ける）
        removeOne(pl.hand, card);
        trashCard(state, pd.player, card);
        const max = { coin: ref.coin + 2, pot: ref.pot, debt: ref.debt };
        if (anyGainable(state, (cid) => costUpTo(state, cid, max.coin, { pot: max.pot, debt: max.debt }))) {
          state.pending = { type: 'enhance', stage: 'gain', player: pd.player, maxCost: max.coin, pot: max.pot, debt: max.debt };
        } else state.pending = null;
        return state;
      }
      case 'ENHANCE_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'enhance' || pd.stage !== 'gain') return state;
        const id = action.card;
        if (!id || !costUpTo(state, id, pd.maxCost, { pot: pd.pot, debt: pd.debt })) return state;
        state.pending = null;
        gain(state, pd.player, id, 'discard');
        return state;
      }
      // 追求＝カード名を1つ指定 → 山札の上4枚を公開 → 指定した名前を山札の上に戻し、残りを捨てる。
      case 'PURSUE_NAME': {
        const pd = state.pending;
        if (!pd || pd.type !== 'pursue') return state;
        const named = action.card;
        if (!named || !C()[named]) return state; // ゲームに無い名前も指定できるが、実在するカード名であること
        const pl = state.players[pd.player];
        state.pending = null;
        const look = [];
        for (let i = 0; i < 4; i++) {
          if (pl.deck.length === 0) { if (pl.discard.length === 0) break; reshuffleDeck(pl); }
          if (pl.deck.length === 0) break;
          look.push(pl.deck.shift());
        }
        log(state, `${pl.name} は追求で「${C()[named].name}」を指定した。`);
        if (!look.length) return state;
        reveal(state, pd.player, look, '追求で山札の上4枚を公開');
        const keep = look.filter((c) => c === named);
        const rest = look.filter((c) => c !== named);
        for (let i = keep.length - 1; i >= 0; i--) pl.deck.unshift(keep[i]); // 公開順のまま山札の上へ戻す
        rest.forEach((c) => pl.discard.push(c));
        log(state, `${pl.name} は ${keep.length}枚 を山札の上に戻し、${rest.length}枚 を捨て札にした。`);
        if (rest.length) triggerOnDiscard(state, pd.player, rest);
        return state;
      }
      // 植民＝アクションのサプライ山それぞれから1枚ずつ獲得する（獲得順はプレイヤーが選ぶ／おまかせも可）。
      case 'POPULATE_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'populate') return state;
        const avail = populatePiles(state);
        const q = (t.populateQueue || []).filter((k) => avail.indexOf(k) >= 0);
        if (!q.length) { state.pending = null; t.populateQueue = null; return state; }
        if (action.auto) { // 残りをまとめて獲得（コストの高い山から）。獲得時対話は onGainQueue が拾う。
          state.pending = null; t.populateQueue = null;
          q.slice().sort((a, b) => cardCost(state, b) - cardCost(state, a))
            .forEach((k) => { if (populatePiles(state).indexOf(k) >= 0) gain(state, pd.player, k, 'discard'); });
          return state;
        }
        const pile = action.pile;
        if (q.indexOf(pile) < 0) return state;
        state.pending = null;
        t.populateQueue = q.filter((k) => k !== pile);
        gain(state, pd.player, pile, 'discard');
        return state; // 残りは reduce 末尾の再開網が（獲得時対話を解決してから）次の選択待ちを開く
      }

      /* ============================================================
         夜想曲（Nocturne）：祝福 / 呪詛 / 状態 の選択待ち
         ============================================================ */
      // 風の恵み＝+2カードの後、手札2枚を捨てる（**強制**・複数枚は「同時に」捨てる）。
      case 'BOON_WIND_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'boon_wind') return state;
        const pl = state.players[pd.player];
        const want = Math.min(2, pl.hand.length);
        if (want === 0) { state.pending = null; return state; }
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (!discardFromHand(state, pd.player, cards, want, 'を捨てた（風の恵み）。')) return state;
        state.pending = null;
        triggerOnDiscard(state, pd.player, cards);
        return state;
      }
      // 炎の恵み＝手札1枚を廃棄してもよい。
      case 'BOON_FLAME_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'boon_flame') return state;
        const pl = state.players[pd.player];
        const c = action.card;
        if (c == null) { state.pending = null; return state; }
        if (pl.hand.indexOf(c) < 0) return state;
        if (!trashFromHand(state, pd.player, [c], 1, 'を廃棄した（炎の恵み）。')) return state;
        state.pending = null;
        return state;
      }
      // 大地の恵み＝手札の財宝1枚を捨てて、コスト$4以下を1枚獲得してもよい（捨てたら獲得は強制）。
      case 'BOON_EARTH_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'boon_earth') return state;
        const pl = state.players[pd.player];
        const c = action.card;
        if (c == null) { state.pending = null; return state; }
        if (pl.hand.indexOf(c) < 0 || !isTreasureFor(state, c)) return state;
        if (!discardFromHand(state, pd.player, [c], 1, 'を捨てた（大地の恵み）。')) return state;
        state.pending = null;
        // この後すぐ獲得の窓を開くので、捨て札トリガーの**対話**は開かない（地図職人と同じ noPrompt 運用）。
        triggerOnDiscard(state, pd.player, [c], true);
        // 終端保証：獲得できる山が無ければ窓を開かずに終わる。
        if (!state.pending && anyGainable(state, (id) => costUpTo(state, id, 4))) state.pending = { type: 'boon_earth_gain', player: pd.player };
        return state;
      }
      case 'BOON_EARTH_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'boon_earth_gain') return state;
        if (!anyGainable(state, (id) => costUpTo(state, id, 4))) { state.pending = null; return state; } // 終端保証
        const id = action.card;
        if (!id || !costUpTo(state, id, 4)) return state;
        state.pending = null;
        if (gain(state, pd.player, id, 'discard')) log(state, `${state.players[pd.player].name} は大地の恵みで「${C()[id].name}」を獲得した。`);
        return state;
      }
      // 空の恵み＝手札3枚を捨てて金貨1枚を獲得してもよい（3枚未満なら手札を全部捨てるだけ＝金貨は得られない・公式）。
      case 'BOON_SKY_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'boon_sky') return state;
        const pl = state.players[pd.player];
        if (action.cards == null) { state.pending = null; return state; } // 捨てない
        const want = Math.min(3, pl.hand.length);
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (!discardFromHand(state, pd.player, cards, want, 'を捨てた（空の恵み）。')) return state;
        state.pending = null;
        if (cards.length === 3) { if (gain(state, pd.player, 'gold', 'discard')) log(state, `${pl.name} は空の恵みで金貨1枚を獲得した。`); }
        else log(state, `${pl.name} は手札が3枚未満だったので金貨を得られなかった（空の恵み）。`);
        triggerOnDiscard(state, pd.player, cards);
        return state;
      }
      // 月の恵み＝捨て札を全部見て、その中の1枚を山札の上に置いてもよい。
      case 'BOON_MOON_TOPDECK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'boon_moon') return state;
        const pl = state.players[pd.player];
        const c = action.card;
        if (c == null) { state.pending = null; return state; }
        if (!removeOne(pl.discard, c)) return state;
        pl.deck.unshift(c);
        state.pending = null;
        log(state, `${pl.name} は月の恵みで捨て札の「${C()[c].name}」を山札の上に置いた。`);
        return state;
      }
      /* 汎用「山札の上からN枚を見て、好きな枚数を捨て、残りを好きな順で山札の上に戻す」
         （太陽の恵み＝4枚／夜警＝5枚）。地図職人と同型だが夜想曲の複数カードで共有する。 */
      case 'LOOK_ARRANGE_RESOLVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'look_arrange') return state;
        const pl = state.players[pd.player];
        const look = (pd.cards || []).slice();
        const disc = Array.isArray(action.discard) ? action.discard : [];
        const top = Array.isArray(action.top) ? action.top : [];
        const chk = look.slice();
        for (const c of disc.concat(top)) { const i = chk.indexOf(c); if (i < 0) return state; chk.splice(i, 1); }
        if (chk.length !== 0) return state; // discard+top が look の並べ替えであること
        disc.forEach((c) => pl.discard.push(c));
        for (let i = top.length - 1; i >= 0; i--) pl.deck.unshift(top[i]); // top[0] が一番上
        log(state, `${pl.name} は${lsName(pd.source) || ''}（${disc.length}枚 捨て、${top.length}枚 を山札の上へ）。`);
        state.pending = null;
        // **山札から捨てられても捨て札トリガーは誘発する**（忠犬は夜警で捨てられても脇に置ける＝公式）。
        if (disc.length) triggerOnDiscard(state, pd.player, disc);
        return state;
      }
      // 呪詛のリアクション窓＝「受ける」。**全員ぶん閉じてから呪詛を1枚めくる**（dealHex）。
      case 'HEX_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'hex' || pd.stage !== 'react') return state;
        hexReactEnter(state, pd.source, pd.queue, (pd.accepted || []).concat([pd.victim]));
        return state;
      }
      // 貧困＝手札が3枚になるように捨てる（呪詛の効果＝免疫判定は配布時点で済んでいる）。
      case 'HEX_POVERTY_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'hex_poverty') return state;
        const pl = state.players[pd.player];
        const want = Math.max(0, pl.hand.length - 3);
        if (want === 0) { state.pending = null; return state; }
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (!discardFromHand(state, pd.player, cards, want, 'を捨てた（貧困）。')) return state;
        state.pending = null;
        triggerOnDiscard(state, pd.player, cards);
        return state;
      }
      // 恐怖＝手札5枚以上ならアクションか財宝1枚を捨てる（強制）。
      case 'HEX_FEAR_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'hex_fear') return state;
        const pl = state.players[pd.player];
        const okc = (c) => DOM.isType(c, 'action') || isTreasureFor(state, c);
        if (!pl.hand.some(okc)) { state.pending = null; return state; } // 終端保証
        const c = action.card;
        if (!c || pl.hand.indexOf(c) < 0 || !okc(c)) return state;
        if (!discardFromHand(state, pd.player, [c], 1, 'を捨てた（恐怖）。')) return state;
        state.pending = null;
        triggerOnDiscard(state, pd.player, [c]);
        return state;
      }
      // 憑依＝手札4枚以上なら手札1枚を山札の上に置く（強制）。
      case 'HEX_HAUNTING_TOPDECK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'hex_haunting') return state;
        const pl = state.players[pd.player];
        if (!pl.hand.length) { state.pending = null; return state; } // 終端保証
        const c = action.card;
        if (!c || !removeOne(pl.hand, c)) return state;
        pl.deck.unshift(c);
        state.pending = null;
        log(state, `${pl.name} は憑依で手札1枚を山札の上に置いた。`);
        return state;
      }
      // 蝗害＝廃棄したカードと同じ種別を持ち、それより安いカード1枚を獲得（強制）。
      case 'HEX_LOCUSTS_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'hex_locusts') return state;
        const okId = (id) => costUnder(state, id, pd.coin, { pot: pd.pot || 0, debt: pd.debt || 0 }) && sharesType(id, pd.ref);
        if (!anyGainable(state, okId)) { state.pending = null; return state; } // 終端保証
        const id = action.card;
        if (!id || !okId(id)) return state;
        state.pending = null;
        if (gain(state, pd.player, id, 'discard')) log(state, `${state.players[pd.player].name} は蝗害で「${C()[id].name}」を獲得した。`);
        return state;
      }
      // 恵みの村＝獲得時に取った祝福を「今受ける」か「次の自分のターンの開始時に受ける」か選ぶ（中身は見えている）。
      case 'BLESSED_VILLAGE_BOON': {
        const pd = state.pending;
        if (!pd || pd.type !== 'blessed_village_boon') return state;
        const pl = state.players[pd.player];
        state.pending = null;
        if (action.now) queueBoon(state, pd.player, pd.boon);
        else { (pl.boonsHeld = pl.boonsHeld || []).push(pd.boon); log(state, `${pl.name} は祝福「${lsName(pd.boon)}」を次の自分のターンまで取っておいた。`); }
        return state;
      }
      // 墓地＝獲得時に手札から最大4枚を廃棄する（0枚可・**まとめて同時に**廃棄する）。
      case 'CEMETERY_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'cemetery_trash') return state;
        const pl = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (cards.length > 4) return state;
        const copy = pl.hand.slice();
        for (const c of cards) if (!removeOne(copy, c)) return state;
        state.pending = null;
        cards.forEach((c) => removeOne(pl.hand, c));           // 先に全部手札から抜く＝「同時に廃棄」
        cards.forEach((c) => trashCard(state, pd.player, c));  // その後で廃棄時トリガーを解決する
        if (cards.length) log(state, `${pl.name} は墓地の獲得で ${cards.length}枚 を廃棄した。`);
        return state;
      }
      /* コンクラーベ＝場に同名が無いアクション1枚を手札から使用してよい（任意・アクション権不要）。
         使ったら**解決が全部終わった後に** +1アクション（`state.replay` の 'conclave_bonus' で遅らせる）。 */
      case 'CONCLAVE_PLAY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'conclave') return state;
        const pl = state.players[pd.player];
        const card = action.card;
        state.pending = null;
        if (card == null) return state;
        if (conclaveTargets(state, pd.player).indexOf(card) < 0) return state;
        (state.replay = state.replay || []).push({ label: 'conclave_bonus', player: pd.player });
        playCardNoAction(state, pd.player, card, pl.hand, 'コンクラーベで', action.way);
        return state;
      }
      // ドルイド＝脇に置かれた祝福3枚から1つを受ける（強制。祝福は脇に置いたまま）。
      case 'DRUID_BOON': {
        const pd = state.pending;
        if (!pd || pd.type !== 'druid_boon') return state;
        const set = (state.boons && state.boons.druid) || [];
        if (!set.length) { state.pending = null; return state; } // 終端保証
        const b = action.boon;
        if (!b || set.indexOf(b) < 0) return state;
        state.pending = null;
        queueBoon(state, pd.player, b, { aside: true }); // 脇から動かさない
        return state;
      }
      // 愚者＝取った祝福を1つずつ好きな順番で受ける（残りは reduce 末尾の再開網が再度開く）。
      case 'BOON_CHOOSE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'boon_choose') return state;
        const bc = t.boonChoice;
        if (!bc || !(bc.boons || []).length) { state.pending = null; t.boonChoice = null; return state; }
        const b = action.boon;
        if (!b || bc.boons.indexOf(b) < 0) return state;
        state.pending = null;
        bc.boons = bc.boons.filter((x) => x !== b);
        if (!bc.boons.length) t.boonChoice = null;
        queueBoon(state, pd.player, b);
        return state;
      }
      // 聖なる木立ち＝他のプレイヤーも同じ祝福を受けてよい（任意）。
      case 'GROVE_OFFER': {
        const pd = state.pending;
        if (!pd || pd.type !== 'grove_offer') return state;
        state.pending = null;
        if (action.take) queueBoon(state, pd.player, pd.boon, { share: true });
        return state;
      }
      // ピクシー＝これを廃棄して、捨てた祝福を2回受けてもよい（任意）。
      case 'PIXIE_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'pixie_trash') return state;
        state.pending = null;
        if (!action.trash) return state;
        if (!takeSelf(state, pd.player, 'pixie')) return state; // 命令経由/再演では場に無い＝廃棄できない（lose track）
        trashCard(state, pd.player, 'pixie');
        log(state, `${state.players[pd.player].name} はピクシーを廃棄して祝福「${lsName(pd.boon)}」を2回受ける。`);
        queueBoon(state, pd.player, pd.boon);
        queueBoon(state, pd.player, pd.boon);
        return state;
      }
      // プーカ＝手札から「呪われた金貨以外の財宝」1枚を廃棄してよい。そうしたら +4カード。
      case 'POOKA_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'pooka_trash') return state;
        const pl = state.players[pd.player];
        const c = action.card;
        if (c == null) { state.pending = null; return state; }
        if (pl.hand.indexOf(c) < 0 || !isTreasureFor(state, c) || c === 'cursed_gold') return state;
        if (!trashFromHand(state, pd.player, [c], 1, 'をプーカで廃棄した。')) return state;
        state.pending = null;
        draw(state, pd.player, 4);
        return state;
      }
      // 秘密の洞窟＝手札3枚を捨ててよい。そうしたら次の自分のターン開始時に +3コイン（＝そのときだけ持続になる）。
      case 'SECRET_CAVE_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'secret_cave') return state;
        const pl = state.players[pd.player];
        if (action.cards == null) { state.pending = null; return state; }
        /* **手札が3枚未満でも「3枚捨てる」を選べる**（公式：残りを全部捨てるが +3コイン は得られない）。
           捨て札トリガー（坑道/忠犬/村有緑地）を狙って捨てる選択肢を engine が奪ってはいけない。 */
        const want = Math.min(3, pl.hand.length);
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (cards.length !== want) return state;
        if (!discardFromHand(state, pd.player, cards, want, 'を捨てた（秘密の洞窟）。')) return state;
        state.pending = null;
        if (cards.length === 3) {
          armDuration(state, pd.player, 'secret_cave');
          log(state, `${pl.name} は秘密の洞窟で手札3枚を捨てた（次のターン開始時 +3コイン）。`);
        } else log(state, `${pl.name} は手札が3枚未満だったので +3コイン は得られない（秘密の洞窟）。`);
        triggerOnDiscard(state, pd.player, cards);
        return state;
      }
      // 羊飼い＝好きな枚数の勝利点カードを公開して捨て、1枚につき +2カード。
      case 'SHEPHERD_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'shepherd_discard') return state;
        const pl = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        const copy = pl.hand.slice();
        for (const c of cards) { if (!DOM.isType(c, 'victory')) return state; if (!removeOne(copy, c)) return state; }
        state.pending = null;
        if (cards.length) {
          reveal(state, pd.player, cards.slice(), '羊飼い');
          discardFromHand(state, pd.player, cards, cards.length, 'を捨てた（羊飼い）。');
          // **順序厳守**：捨て札トリガー（坑道の金貨獲得など）を全部解決してから引く。
          //   逆にすると坑道で得た金貨がリシャッフルに入らない（公式裁定）。
          triggerOnDiscard(state, pd.player, cards);
          draw(state, pd.player, cards.length * 2);
          log(state, `${pl.name} は羊飼いで勝利点${cards.length}枚を捨てて +${cards.length * 2}カード。`);
        }
        return state;
      }
      // 悲劇のヒーロー＝廃棄したあと財宝カード1枚を獲得（強制）。
      case 'TRAGIC_HERO_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'tragic_hero_gain') return state;
        if (!anyGainable(state, (id) => gainableBase(state, id) && isTreasureFor(state, id))) { state.pending = null; return state; }
        const id = action.card;
        if (!id || !gainableBase(state, id) || !isTreasureFor(state, id)) return state;
        state.pending = null;
        if (gain(state, pd.player, id, 'discard')) log(state, `${state.players[pd.player].name} は悲劇のヒーローで「${C()[id].name}」を獲得した。`);
        return state;
      }
      // ヤギ（家宝）＝手札1枚を廃棄してもよい。
      case 'GOAT_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'goat_trash') return state;
        const pl = state.players[pd.player];
        const c = action.card;
        if (c == null) { state.pending = null; return state; }
        if (pl.hand.indexOf(c) < 0) return state;
        if (!trashFromHand(state, pd.player, [c], 1, 'をヤギで廃棄した。')) return state;
        state.pending = null;
        return state;
      }
      // 呪いの鏡（家宝）＝これを廃棄したとき、手札のアクション1枚を捨てて幽霊1枚を獲得してもよい。
      case 'HAUNTED_MIRROR_GHOST': {
        const pd = state.pending;
        if (!pd || pd.type !== 'haunted_mirror') return state;
        const pl = state.players[pd.player];
        const c = action.card;
        if (c == null) { state.pending = null; return state; }
        if (pl.hand.indexOf(c) < 0 || !DOM.isType(c, 'action')) return state;
        if (!discardFromHand(state, pd.player, [c], 1, 'を捨てた（呪いの鏡）。')) return state;
        state.pending = null;
        if (gain(state, pd.player, 'ghost', 'discard')) log(state, `${pl.name} は呪いの鏡で幽霊1枚を獲得した。`);
        triggerOnDiscard(state, pd.player, [c]);
        return state;
      }
      // 忠犬＝クリンナップ以外で捨て札にしたとき、脇に置いてよい（このターンの終了時に手札へ戻る）。
      case 'FAITHFUL_HOUND_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'faithful_hound_react') return state;
        const pl = state.players[pd.player];
        state.pending = null;
        if (!action.setAside) return state;
        if (!removeOne(pl.discard, 'faithful_hound')) return state; // 既に動いていたら不発（lose track）
        (pl.setAside = pl.setAside || []).push('faithful_hound');
        pl.houndsAside = (pl.houndsAside || 0) + 1;
        log(state, `${pl.name} は忠犬を脇に置いた（このターンの終了時に手札へ戻る）。`);
        return state;
      }
      // カブラー＝次のターン開始時、コスト4以下のカードを**手札に**獲得（強制）。
      case 'COBBLER_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'cobbler_gain') return state;
        if (!anyGainable(state, (id) => costUpTo(state, id, 4))) { popStartQueue(state); return state; }
        const id = action.card;
        if (!id || !costUpTo(state, id, 4)) return state;
        state.pending = null;
        if (gain(state, pd.player, id, 'hand')) log(state, `${state.players[pd.player].name} はカブラーで「${C()[id].name}」を手札に獲得した。`);
        if (!state.pending) popStartQueue(state);
        return state;
      }
      /* 納骨堂＝場の「持続でない財宝」を好きな枚数、裏向きで脇に置く（0枚なら持続にならない）。 */
      case 'CRYPT_SETASIDE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'crypt_setaside') return state;
        const pl = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        const copy = pl.inPlay.slice();
        for (const c of cards) {
          if (!isTreasureFor(state, c) || DOM.isType(c, 'duration')) return state;
          if (!removeOne(copy, c)) return state;
        }
        state.pending = null;
        if (!cards.length) { log(state, `${pl.name} は納骨堂で脇に置かなかった（このターンの片付けで捨て札になる）。`); return state; }
        cards.forEach((c) => { removeOne(pl.inPlay, c); (pl.cryptSetAside = pl.cryptSetAside || []).push(c); });
        armDuration(state, pd.player, 'crypt', { n: cards.length });
        log(state, `${pl.name} は納骨堂で財宝 ${cards.length}枚 を裏向きで脇に置いた。`);
        return state;
      }
      // 納骨堂＝ターン開始時、脇の1枚を手札に加える（残っていれば次のターンも続く）。
      case 'CRYPT_PICK': {
        const pd = state.pending;
        if (!pd || pd.type !== 'crypt_pick') return state;
        const pl = state.players[pd.player];
        const c = action.card;
        if (!(pl.cryptSetAside || []).length) { popStartQueue(state); return state; }
        if (!c || !removeOne(pl.cryptSetAside, c)) return state;
        pl.hand.push(c);
        log(state, `${pl.name} は納骨堂から「${C()[c].name}」を手札に加えた。`);
        // まだ残っていれば次のターンも続く（残り枚数を予約に持たせて再武装する）。
        if ((pd.n || 1) - 1 > 0 && pl.cryptSetAside.length) armDuration(state, pd.player, 'crypt', { n: (pd.n || 1) - 1 });
        popStartQueue(state);
        return state;
      }
      // 悪魔の工房＝このターン1枚だけ獲得していた場合＝コスト4以下を1枚獲得（強制）。
      case 'DEVILS_WORKSHOP_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'devils_workshop_gain') return state;
        if (!anyGainable(state, (id) => costUpTo(state, id, 4))) { state.pending = null; return state; }
        const id = action.card;
        if (!id || !costUpTo(state, id, 4)) return state;
        state.pending = null;
        if (gain(state, pd.player, id, 'discard')) log(state, `${state.players[pd.player].name} は悪魔の工房で「${C()[id].name}」を獲得した。`);
        return state;
      }
      // 悪魔祓い＝手札1枚を廃棄（強制）→ それより**厳密に安い**精霊カード1枚を獲得（強制）。
      case 'EXORCIST_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'exorcist_trash') return state;
        const pl = state.players[pd.player];
        if (!pl.hand.length) { state.pending = null; return state; } // 終端保証
        const c = action.card;
        if (!c || pl.hand.indexOf(c) < 0) return state;
        const ref = costOf(state, c);
        if (!trashFromHand(state, pd.player, [c], 1, 'を悪魔祓いで廃棄した。')) return state;
        state.pending = null;
        if (exorcistSpirits(state, ref).length) {
          state.pending = { type: 'exorcist_gain', player: pd.player, coin: ref.coin, pot: ref.pot, debt: ref.debt };
        } else log(state, `${pl.name} は悪魔祓いで獲得できる精霊がなかった。`);
        return state;
      }
      case 'EXORCIST_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'exorcist_gain') return state;
        const cand = exorcistSpirits(state, { coin: pd.coin, pot: pd.pot || 0, debt: pd.debt || 0 });
        if (!cand.length) { state.pending = null; return state; } // 終端保証
        const id = action.card;
        if (!id || cand.indexOf(id) < 0) return state;
        state.pending = null;
        if (gain(state, pd.player, id, 'discard')) log(state, `${state.players[pd.player].name} は悪魔祓いで「${C()[id].name}」を獲得した。`);
        return state;
      }
      /* 修道院＝このターン獲得した枚数まで、手札1枚か場の銅貨1枚を廃棄してよい（任意・**1枚ずつ**）。
         途中でドローが起きたらその引いたカードも廃棄対象にできる＝ループ pending にする。 */
      case 'MONASTERY_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'monastery') return state;
        const pl = state.players[pd.player];
        const c = action.card;
        if (c == null) { state.pending = null; return state; } // やめる
        if (action.fromPlay) {
          if (c !== 'copper' || !removeOne(pl.inPlay, 'copper')) return state;
          trashCard(state, pd.player, 'copper');
          log(state, `${pl.name} は修道院で場の銅貨1枚を廃棄した。`);
        } else {
          if (pl.hand.indexOf(c) < 0) return state;
          if (!trashFromHand(state, pd.player, [c], 1, 'を修道院で廃棄した。')) return state;
        }
        const left = (pd.remaining || 1) - 1;
        state.pending = (left > 0 && (pl.hand.length || pl.inPlay.includes('copper')))
          ? { type: 'monastery', player: pd.player, remaining: left } : null;
        return state;
      }
      // 「アタックを使用した」ことだけに反応する窓（人狼のドロー側／迫害者のインプ側）＝受ける。
      case 'ATTACK_WINDOW_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'attack_window' || pd.stage !== 'react') return state;
        attackWindowEnter(state, pd.source, pd.queue, pd.after);
        return state;
      }
      // 夜襲＝リアクション窓（受ける）。
      case 'RAIDER_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'raider' || pd.stage !== 'react') return state;
        raiderApply(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      // 夜襲＝使用者の場にあるカードと同名の1枚を捨てる（被害者が選ぶ・強制）。
      case 'RAIDER_DISCARD': {
        const pd = state.pending;
        if (!pd || pd.type !== 'raider' || pd.stage !== 'discard') return state;
        const cand = raiderTargets(state, pd.source, pd.victim);
        if (!cand.length) { raiderEnterVictim(state, pd.source, pd.queue); return state; } // 終端保証
        const c = action.card;
        if (!c || cand.indexOf(c) < 0) return state;
        state.pending = null;
        discardFromHand(state, pd.victim, [c], 1, 'を捨てた（夜襲）。');
        triggerOnDiscard(state, pd.victim, [c]);
        const keep = state.pending;                 // 捨て札トリガー（忠犬など）が窓を開けたら先に解決する
        state.pending = null;
        raiderEnterVictim(state, pd.source, pd.queue);
        if (keep) { (state.onGainQueue = state.onGainQueue || []).push(keep); }
        return state;
      }
      // インプ＝場に同名が無いアクション1枚を手札から使ってよい（コンクラーベと同じ述語。+1アクションは無い）。
      case 'IMP_PLAY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'imp_play') return state;
        const pl = state.players[pd.player];
        const card = action.card;
        state.pending = null;
        if (card == null) return state;
        if (conclaveTargets(state, pd.player).indexOf(card) < 0) return state;
        playCardNoAction(state, pd.player, card, pl.hand, 'インプで', action.way);
        return state;
      }
      // 願い＝山に戻せたらコスト6以下のカード1枚を**手札に**獲得する（強制）。
      case 'WISH_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'wish_gain') return state;
        if (!anyGainable(state, (id) => costUpTo(state, id, 6))) { state.pending = null; return state; }
        const id = action.card;
        if (!id || !costUpTo(state, id, 6)) return state;
        state.pending = null;
        if (gain(state, pd.player, id, 'hand')) log(state, `${state.players[pd.player].name} は願いで「${C()[id].name}」を手札に獲得した。`);
        return state;
      }
      /* ===== 夜想曲 N4：交換・廃棄置き場からのプレイ・2度使用 ===== */
      // 取り替え子＝場に出ているカードと同じカード1枚を獲得する（サプライの山の一番上が同名のときだけ実際に得られる）。
      case 'CHANGELING_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'changeling_gain') return state;
        const pl = state.players[pd.player];
        const cand = [...new Set(pl.inPlay.concat(pl.durationCards || []))];
        if (!cand.length) { state.pending = null; return state; } // 終端保証
        const id = action.card;
        state.pending = null;
        if (id == null) return state;               // 場のカードが全部「山が無い」ときは何も得られない
        if (cand.indexOf(id) < 0) { state.pending = pd; return state; }
        if (gainableBase(state, id)) {
          if (gain(state, pd.player, id, 'discard')) log(state, `${pl.name} は取り替え子で「${C()[id].name}」を獲得した。`);
        } else log(state, `${pl.name} は取り替え子で「${C()[id].name}」を選んだが山から獲得できなかった。`);
        return state;
      }
      // 取り替え子＝獲得したカード（コスト$3以上）を取り替え子と交換してもよい（任意・獲得ではない）。
      case 'CHANGELING_EXCHANGE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'changeling_exchange') return state;
        state.pending = null;
        if (!action.exchange) return state;
        if (!changelingCanExchange(state, pd.player, pd.card, pd.dest)) return state; // 条件が崩れていたら不発
        exchangeCard(state, pd.player, pd.card, 'changeling', zoneOf(state.players[pd.player], pd.dest));
        return state;
      }
      // コウモリ＝手札から最大2枚を廃棄。1枚以上廃棄したらこれを吸血鬼と交換する。
      case 'BAT_TRASH': {
        const pd = state.pending;
        if (!pd || pd.type !== 'bat_trash') return state;
        const pl = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (cards.length > 2) return state;
        const copy = pl.hand.slice();
        for (const c of cards) if (!removeOne(copy, c)) return state;
        state.pending = null;
        cards.forEach((c) => removeOne(pl.hand, c));
        cards.forEach((c) => trashCard(state, pd.player, c));
        if (cards.length) {
          log(state, `${pl.name} はコウモリで ${cards.length}枚 を廃棄した。`);
          exchangeCard(state, pd.player, 'bat', 'vampire', pl.inPlay);
        }
        return state;
      }
      // 吸血鬼＝コスト5以下（吸血鬼以外）を1枚獲得 → これをコウモリと交換する（獲得は強制）。
      case 'VAMPIRE_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'vampire_gain') return state;
        const okId = (id) => costUpTo(state, id, 5) && id !== 'vampire';
        if (!anyGainable(state, okId)) {
          state.pending = null;
          exchangeCard(state, pd.player, 'vampire', 'bat', state.players[pd.player].inPlay);
          return state;
        }
        const id = action.card;
        if (!id || !okId(id)) return state;
        state.pending = null;
        if (gain(state, pd.player, id, 'discard')) log(state, `${state.players[pd.player].name} は吸血鬼で「${C()[id].name}」を獲得した。`);
        exchangeCard(state, pd.player, 'vampire', 'bat', state.players[pd.player].inPlay);
        return state;
      }
      /* ネクロマンサー＝廃棄置き場の表向き・持続でないアクション1枚を選び、**先に裏返してから**
         廃棄置き場に置いたまま使用する（2021エラッタ＝無限ループ防止）。 */
      case 'NECROMANCER_PLAY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'necromancer') return state;
        const cand = necromancerTargets(state);
        if (!cand.length) { state.pending = null; return state; } // 終端保証
        const idx = action.index;
        if (idx == null || cand.indexOf(idx) < 0) return state;
        const card = state.trash[idx];
        state.pending = null;
        state.trashFaceDown = state.trashFaceDown || {};
        state.trashFaceDown[card] = (state.trashFaceDown[card] || 0) + 1; // **裏返してから**使用する
        log(state, `${state.players[pd.player].name} はネクロマンサーで廃棄置き場の「${C()[card].name}」を使用した。`);
        // ⚠ ネクロマンサーは Command 種別を持たない＝「命令は命令をプレイできない」ガードを適用しない。
        //    カードは動かさないので「これ」の自己移動は失敗する（＝命令機構の _cmd をそのまま使う）。
        playAsCommand(state, pd.player, 'necromancer', card);
        return state;
      }
      // 幽霊＝脇に置いたアクションカードを2度使用する（強制・アクション権を消費しない）。
      case 'GHOST_PLAY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'ghost_play') return state;
        const pl = state.players[pd.player];
        state.pending = null;
        const card = pd.card;
        if (!card) { popStartQueue(state); return state; }
        // 2回目は玉座の2回目と同じ扱い（`state.replay`）＝命令ではないのでカードは場に出る。
        (state.replay = state.replay || []).push({ label: 'ghost', player: pd.player, card });
        playCardNoAction(state, pd.player, card, [card], '幽霊で');
        return state;
      }
      // ゾンビの弟子＝手札のアクション1枚を廃棄して +3カード +1アクション（任意）。
      case 'ZOMBIE_APPRENTICE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'zombie_apprentice') return state;
        const pl = state.players[pd.player];
        const c = action.card;
        if (c == null) { state.pending = null; return state; }
        if (pl.hand.indexOf(c) < 0 || !DOM.isType(c, 'action')) return state;
        if (!trashFromHand(state, pd.player, [c], 1, 'をゾンビの弟子で廃棄した。')) return state;
        state.pending = null;
        draw(state, pd.player, 3); addActions(state.turn, 1);
        return state;
      }
      // ゾンビの石工＝廃棄したカードより最大 $1 高いカード1枚を獲得してもよい。
      case 'ZOMBIE_MASON_GAIN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'zombie_mason_gain') return state;
        const okId = (id) => costUpTo(state, id, pd.coin, { pot: pd.pot || 0, debt: pd.debt || 0 });
        if (!anyGainable(state, okId)) { state.pending = null; return state; }
        const id = action.card;
        if (id == null) { state.pending = null; return state; } // 任意
        if (!okId(id)) return state;
        state.pending = null;
        if (gain(state, pd.player, id, 'discard')) log(state, `${state.players[pd.player].name} はゾンビの石工で「${C()[id].name}」を獲得した。`);
        return state;
      }
      // ゾンビの密偵＝山札の一番上を見て、捨てるか元に戻す。
      case 'ZOMBIE_SPY': {
        const pd = state.pending;
        if (!pd || pd.type !== 'zombie_spy') return state;
        const pl = state.players[pd.player];
        state.pending = null;
        if (!action.discard || !pl.deck.length) return state;
        const c = pl.deck.shift();
        pl.discard.push(c);
        log(state, `${pl.name} はゾンビの密偵で「${C()[c].name}」を捨てた。`);
        triggerOnDiscard(state, pd.player, [c]);
        return state;
      }
      // 偶像（財宝アタック）のリアクション窓＝「受ける」。
      case 'IDOL_REACT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'idol' || pd.stage !== 'react') return state;
        idolCurse(state, pd.source, pd.victim, pd.queue);
        return state;
      }
      // 森の迷子＝ターン開始時、手札1枚を捨てて祝福を1つ受けてもよい（任意）。
      case 'LOST_IN_WOODS': {
        const pd = state.pending;
        if (!pd || pd.type !== 'lost_in_the_woods') return state;
        const pl = state.players[pd.player];
        const c = action.card;
        if (c == null) { state.pending = null; return state; } // 使わない（任意効果）
        if (pl.hand.indexOf(c) < 0) return state;
        if (!discardFromHand(state, pd.player, [c], 1, 'を捨てた（森の迷子）。')) return state;
        state.pending = null;
        triggerOnDiscard(state, pd.player, [c]);
        receiveBoon(state, pd.player, 1);
        // 残りのターン開始時効果は reduce 末尾の startQueue 安全網が拾う（祝福の解決が先に入ってよい）。
        return state;
      }

      /* ==========================================================================
         同盟（Allies）A3：Ally カード23種の選択待ち reducer
         ⚠ 好意の支払いは**常に任意**＝どの窓も必ず「使わない」で終端できること（CPU は null を返さない）。
         ⚠ **Ally が起こす攻撃は「アタックカードのプレイ」ではない＝堀で防げない**（魔女の輪／すり師団）。
            ATTACKS に登録しない／リアクション窓を開かない／attackImmune を通さない。
         ========================================================================== */
      // 単純な「好意を使う／使わない」の窓をまとめて処理する（Ally は1ゲーム1枚なので分岐は排他）。
      case 'ALLY_SIMPLE': {
        const pd = state.pending;
        if (!pd || !ALLY_SIMPLE_PENDINGS.has(pd.type)) return state;
        const pl = state.players[pd.player];
        const ok = !!action.ok;
        // 山の民＝好意ちょうど5で +3カード（4個以下では部分的にも使えない）。
        if (pd.type === 'ally_mountain_folk') {
          if (ok) {
            if (!spendFavors(state, pd.player, 5)) return state;
            const got = draw(state, pd.player, 3);
            log(state, `${pl.name} は山の民で 好意5 を使って +${got.length}カード。`);
          }
          state.pending = null;
          return state;
        }
        /* 砂漠の案内人＝好意1で手札を全部捨てて5枚引く。**Repeat as desired**（好意が続く限り）。
           ⚠ 公式：**一度「やめる」と言ったら、他のターン開始時効果を解決した後に戻ってくることはできない**
              （案内人 Guide と違う）＝辞退したら再オファーしない。 */
        if (pd.type === 'ally_desert') {
          if (!ok) { state.pending = null; return state; }
          if (!spendFavors(state, pd.player, 1)) return state;
          state.pending = null;
          const dis = pl.hand.slice();
          pl.hand = [];
          dis.forEach((c) => pl.discard.push(c));
          const got = draw(state, pd.player, 5); // 引く枚数は常に5（前哨地でも5枚）
          log(state, `${pl.name} は砂漠の案内人で 好意1 を使って手札${dis.length}枚を捨て +${got.length}カード。`);
          if (dis.length) triggerOnDiscard(state, pd.player, dis);
          if ((pl.favors || 0) >= 1) queueAllyWindow(state, { type: 'ally_desert', player: pd.player }, true);
          return state;
        }
        // 写本士の仲間たち＝アクションを使い切った後、手札4枚以下なら好意1で +1カード。
        if (pd.type === 'ally_scribes') {
          if (ok) {
            if (pl.hand.length > 4) { state.pending = null; return state; }
            if (!spendFavors(state, pd.player, 1)) return state;
            const got = draw(state, pd.player, 1);
            log(state, `${pl.name} は写本士の仲間たちで 好意1 を使って +${got.length}カード。`);
          }
          state.pending = null;
          return state;
        }
        /* 魔女の輪＝連携を使い切った後、好意3で他の全員が呪いを獲得。
           **アタックではない＝堀/灯台/チャンピオン/守護者で防げない**（公式逐語）。呪い山が尽きたら手番順に先着。 */
        if (pd.type === 'ally_circle') {
          if (ok) {
            if (!spendFavors(state, pd.player, 3)) return state;
            const n2 = state.players.length;
            let g = 0;
            for (let k = 1; k < n2; k++) {
              const idx = (pd.player + k) % n2;
              if ((state.supply.curse || 0) > 0 && gain(state, idx, 'curse', 'discard')) g++;
            }
            log(state, `${pl.name} は魔女の輪で 好意3 を使い、他のプレイヤー ${g}人 が呪いを獲得した（アタックではない）。`);
          }
          state.pending = null;
          return state;
        }
        // 島民＝ターンの終了時、好意5で追加のターン（3ターン連続にはできない）。片付けの続きへ合流する。
        if (pd.type === 'ally_island_folk') {
          const ctx = (t && t.advanceCtx) || { pi: pd.player, extra: false, missionExtra: false, seizeExtra: false };
          let island = false;
          if (ok && spendFavors(state, pd.player, 5)) {
            island = true;
            log(state, `${pl.name} は島民で 好意5 を使って追加のターンを行う。`);
          }
          if (t) t.advanceCtx = null;
          state.pending = null;
          finishTurnAdvance(state, ctx.pi, ctx.extra, ctx.missionExtra, ctx.seizeExtra, island);
          return state;
        }
        /* 都市国家＝自分のターンにアクションを獲得したとき、好意2でそれを**獲得した場所から**使用する
           （アクション権は消費しない／「カードの使用」なので習性・炉・浮浪児のトラップ等は通常どおり働く）。
           **既に別の効果で動かされていたら使えない**（lose track＝黙って不発）。 */
        if (pd.type === 'ally_city_state') {
          if (!ok) { state.pending = null; return state; }
          const z = zoneOf(pl, pd.dest);
          if (z.indexOf(pd.card) < 0) { state.pending = null; return state; }
          if ((pl.favors || 0) < 2) return state;
          spendFavors(state, pd.player, 2);
          state.pending = null;
          playCardNoAction(state, pd.player, pd.card, z, '都市国家で', action.way);
          return state;
        }
        // 罠師の小屋＝獲得したカードを好意1で山札の上に置く（相手のターンの獲得でも使える）。
        if (pd.type === 'ally_trappers') {
          if (!ok) { state.pending = null; return state; }
          const z = zoneOf(pl, pd.dest);
          if ((pl.favors || 0) < 1 || z.indexOf(pd.card) < 0) { state.pending = null; return state; }
          spendFavors(state, pd.player, 1);
          removeOne(z, pd.card);
          pl.deck.unshift(pd.card);
          log(state, `${pl.name} は罠師の小屋で 好意1 を使って「${C()[pd.card].name}」を山札の上に置いた。`);
          state.pending = null;
          return state;
        }
        /* 森の居住者＝好意1で山札の上3枚を**見て**（公開ではない＝reveal を通さない）、
           好きな枚数を捨て、残りを好きな順で山札の上に戻す＝汎用 look_arrange に委譲する。1ターン1回。 */
        if (pd.type === 'ally_forest') {
          if (!ok) { state.pending = null; return state; }
          if (!spendFavors(state, pd.player, 1)) return state;
          const look = [];
          for (let i = 0; i < 3; i++) {
            if (pl.deck.length === 0) { if (pl.discard.length === 0) break; reshuffleDeck(pl, state); }
            if (pl.deck.length === 0) break;
            look.push(pl.deck.shift());
          }
          log(state, `${pl.name} は森の居住者で 好意1 を使って山札の上${look.length}枚を見た。`);
          state.pending = look.length ? { type: 'look_arrange', player: pd.player, cards: look, source: 'forest_dwellers' } : null;
          return state;
        }
        return state;
      }
      /* すり師団＝ターン開始時、好意1を使わないかぎり手札4枚まで捨てる。**アタックではない**。 */
      case 'ALLY_GANG': {
        const pd = state.pending;
        if (!pd || pd.type !== 'ally_gang') return state;
        const pl = state.players[pd.player];
        if (pd.stage === 'pay') {
          if (action.ok) {
            if (!spendFavors(state, pd.player, 1)) return state;
            log(state, `${pl.name} は好意1を使って すり師団の手札捨てを免れた。`);
            state.pending = null;
            return state;
          }
          if (pl.hand.length <= 4) { state.pending = null; return state; }
          pd.stage = 'discard';
          return state;
        }
        const cards = Array.isArray(action.cards) ? action.cards : [];
        const target = Math.min(4, pl.hand.length);
        if (pl.hand.length - cards.length !== target) return state;
        const copy = pl.hand.slice();
        for (const c of cards) if (!removeOne(copy, c)) return state;
        cards.forEach((c) => { removeOne(pl.hand, c); pl.discard.push(c); });
        log(state, `${pl.name} はすり師団で 手札を ${cards.length}枚 捨てた。`);
        state.pending = null;
        if (cards.length) triggerOnDiscard(state, pd.player, cards);
        return state;
      }
      /* 穴居民＝ターン開始時、好意1で「1枚捨てて1枚引く」。**Repeat as desired**。
         ⚠ **手札が0枚でも好意を払えば1枚引ける**（公式FAQ "You draw a card even if you failed to discard one."）。
         ⚠ **1枚ずつ交互に**（まとめて捨ててからまとめて引くのではない）＝捨て札トリガーと引いた札が相互作用する。 */
      case 'ALLY_CAVE': {
        const pd = state.pending;
        if (!pd || pd.type !== 'ally_cave') return state;
        const pl = state.players[pd.player];
        if (!action.ok) { state.pending = null; return state; }
        if ((pl.favors || 0) < 1) return state;
        const c = action.card;
        if (pl.hand.length > 0 && (c == null || pl.hand.indexOf(c) < 0)) return state; // 手札があるなら捨てるのは強制
        spendFavors(state, pd.player, 1);
        state.pending = null;
        if (c != null) { removeOne(pl.hand, c); pl.discard.push(c); }
        if (c != null) triggerOnDiscard(state, pd.player, [c]);
        const got = draw(state, pd.player, 1);
        log(state, `${pl.name} は穴居民で 好意1 を使って ${c != null ? '1枚捨てて ' : ''}+${got.length}カード。`);
        if ((pl.favors || 0) >= 1) queueAllyWindow(state, { type: 'ally_cave', player: pd.player }, true);
        return state;
      }
      // 工芸家ギルド＝ターン開始時、好意2でコスト$4以下のカード1枚を**山札の上に**獲得する（捨て札を経由しない）。
      case 'ALLY_CRAFTERS': {
        const pd = state.pending;
        if (!pd || pd.type !== 'ally_crafters') return state;
        const pl = state.players[pd.player];
        const c = action.card;
        if (c == null) { state.pending = null; return state; }
        if (!costUpTo(state, c, 4)) return state;
        if ((pl.favors || 0) < 2) return state;
        const nm = (C()[mixedTopCard(state, c) || c] || {}).name || c;
        spendFavors(state, pd.player, 2);
        state.pending = null;
        if (gain(state, pd.player, c, 'deck')) log(state, `${pl.name} は工芸家ギルドで 好意2 を使って「${nm}」を山札の上に獲得した。`);
        return state;
      }
      /* 発明家の家族＝購入フェイズの開始時、自分の好意トークン1個を「勝利点でないサプライ山」の上に置く。
         その山のカードは**全員に・常時・累積で** $1 安くなる（$0未満にはならない）。トークンは戻ってこない。 */
      case 'ALLY_INVENTORS': {
        const pd = state.pending;
        if (!pd || pd.type !== 'ally_inventors') return state;
        const pl = state.players[pd.player];
        const k = action.pile;
        if (k == null) { state.pending = null; return state; }
        if (favorPileTargets(state).indexOf(k) < 0) return state;
        if (!spendFavors(state, pd.player, 1)) return state;
        state.pileFavor = state.pileFavor || {};
        state.pileFavor[k] = (state.pileFavor[k] || 0) + 1;
        log(state, `${pl.name} は発明家の家族で 好意1 を「${(C()[k] || {}).name || k}」の山に置いた（この山のカードは全員に $${state.pileFavor[k]} 安い）。`);
        state.pending = null;
        return state;
      }
      /* 市場の町＝購入フェイズの開始時、好意1で手札のアクション1枚を使用する。**Repeat as desired**。
         ⚠ **アクションフェイズに戻るわけではない**（`turn.phase` は 'buy' のまま）＝村などの +アクションは無意味。 */
      case 'ALLY_MARKET_TOWNS': {
        const pd = state.pending;
        if (!pd || pd.type !== 'ally_market_towns') return state;
        const pl = state.players[pd.player];
        const c = action.card;
        if (c == null) { state.pending = null; return state; }
        if (pl.hand.indexOf(c) < 0) return state;
        if (!(DOM.isType(c, 'action') || inheritedEstate(pl, c))) return state;
        if ((pl.favors || 0) < 1) return state;
        spendFavors(state, pd.player, 1);
        state.pending = null;
        playCardNoAction(state, pd.player, c, pl.hand, '市場の町で', action.way);
        // 途中で得た好意もそのまま使える（公式FAQ＝仲買人で好意を得たら続けて使ってよい）。
        if ((pl.favors || 0) >= 1 && allyHandHasAction(state, pd.player)) {
          queueAllyWindow(state, { type: 'ally_market_towns', player: pd.player }, true);
        }
        return state;
      }
      /* 平和的教団＝購入フェイズの開始時、好きな数の好意を使って同じ枚数を手札から廃棄する。
         公式の順序＝①好意をまとめて払う ②廃棄する札を全部選ぶ ③まとめて廃棄 ④廃棄トリガーを解決。
         ＝**廃棄の途中で増えた好意/手札は使えない**（枚数は最初に固定される）。 */
      case 'ALLY_PEACEFUL_CULT': {
        const pd = state.pending;
        if (!pd || pd.type !== 'ally_peaceful_cult') return state;
        const pl = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (cards.length === 0) { state.pending = null; return state; }
        if (cards.length > (pl.favors || 0)) return state;
        const copy = pl.hand.slice();
        for (const c of cards) if (!removeOne(copy, c)) return state;
        spendFavors(state, pd.player, cards.length);
        state.pending = null;
        cards.forEach((c) => { removeOne(pl.hand, c); trashCard(state, pd.player, c); });
        log(state, `${pl.name} は平和的教団で 好意${cards.length} を使って手札${cards.length}枚を廃棄した。`);
        return state;
      }
      /* 木工ギルド＝購入フェイズの開始時、好意1で手札のアクション1枚を廃棄してよい。
         廃棄したなら**アクションカード1枚を獲得**（**コスト上限なし**＝負債/ポーション費用でもよい＝公式FAQ）。 */
      case 'ALLY_WOODWORKERS': {
        const pd = state.pending;
        if (!pd || pd.type !== 'ally_woodworkers') return state;
        const pl = state.players[pd.player];
        if (pd.stage === 'trash') {
          const c = action.card;
          if (c == null) { state.pending = null; return state; }
          if (pl.hand.indexOf(c) < 0) return state;
          if (!(DOM.isType(c, 'action') || inheritedEstate(pl, c))) return state;
          if (!spendFavors(state, pd.player, 1)) return state;
          removeOne(pl.hand, c); trashCard(state, pd.player, c);
          log(state, `${pl.name} は木工ギルドで 好意1 を使って「${C()[c].name}」を廃棄した。`);
          state.pending = anyGainable(state, woodworkersCanGain(state))
            ? { type: 'ally_woodworkers', stage: 'gain', player: pd.player } : null;
          return state;
        }
        const g = action.card;
        if (!anyGainable(state, woodworkersCanGain(state))) { state.pending = null; return state; } // 終端保証
        if (g == null || !woodworkersCanGain(state)(g)) return state; // 廃棄したなら獲得は強制
        const gn = (C()[mixedTopCard(state, g) || g] || {}).name || g;
        state.pending = null;
        if (gain(state, pd.player, g, 'discard')) log(state, `${pl.name} は木工ギルドで「${gn}」を獲得した。`);
        return state;
      }
      /* 沿岸の避難港＝クリンナップで手札を捨てるとき、好きな数の好意を使って同じ枚数を手札に残す
         （**引く枚数は変わらない**＝残した札は次の手札5枚に合流する）。残した札は「捨てていない」。 */
      case 'ALLY_COASTAL_HAVEN': {
        const pd = state.pending;
        if (!pd || pd.type !== 'ally_coastal_haven') return state;
        const pl = state.players[pd.player];
        const cards = Array.isArray(action.cards) ? action.cards : [];
        if (cards.length > (pl.favors || 0)) return state;
        const copy = pl.hand.slice();
        for (const c of cards) if (!removeOne(copy, c)) return state;
        if (cards.length) {
          spendFavors(state, pd.player, cards.length);
          t.coastalKeep = cards.slice();
          log(state, `${pl.name} は沿岸の避難港で 好意${cards.length} を使って手札${cards.length}枚を残す。`);
        }
        state.pending = null;
        cleanupAndAdvance(state);
        return state;
      }
      /* 建築家ギルド＝カードを獲得したとき、好意2で「それより安い、勝利点でないカード」1枚を獲得。
         **自己連鎖する**（属州→金貨→研究所→… 好意が続く限り）＝gain がまた同じ窓を積む。
         判定するコストは「**2枚目を獲得しようとしている時点**」の1枚目のコスト（公式）。 */
      case 'ALLY_ARCHITECTS': {
        const pd = state.pending;
        if (!pd || pd.type !== 'ally_architects') return state;
        const pl = state.players[pd.player];
        const c = action.card;
        if (c == null) { state.pending = null; return state; }
        if (!architectsCanGain(state, pd.card)(c)) return state;
        if ((pl.favors || 0) < 2) return state;
        const nm = (C()[mixedTopCard(state, c) || c] || {}).name || c;
        spendFavors(state, pd.player, 2);
        state.pending = null;
        if (gain(state, pd.player, c, 'discard')) log(state, `${pl.name} は建築家ギルドで 好意2 を使って「${nm}」を獲得した。`);
        return state;
      }
      /* 遊牧民団＝**獲得した瞬間**のコストが$3以上のカードを獲得したとき、好意1で
         +1カード / +1アクション / +1購入 のどれか1つ。相手のターン中の獲得でも使える
         （その場合 +アクション/+購入 は無意味だが、選ぶこと自体は合法＝公式）。 */
      case 'ALLY_NOMADS': {
        const pd = state.pending;
        if (!pd || pd.type !== 'ally_nomads') return state;
        const pl = state.players[pd.player];
        const ch = action.choice;
        if (ch == null) { state.pending = null; return state; }
        if (ch !== 'card' && ch !== 'action' && ch !== 'buy') return state;
        if (!spendFavors(state, pd.player, 1)) return state;
        state.pending = null;
        if (ch === 'card') {
          const got = draw(state, pd.player, 1);
          log(state, `${pl.name} は遊牧民団で 好意1 を使って +${got.length}カード。`);
        } else if (t && pd.player === t.active) {
          if (ch === 'action') addActions(t, 1); else t.buys += 1;
          log(state, `${pl.name} は遊牧民団で 好意1 を使って +1${ch === 'action' ? 'アクション' : '購入'}。`);
        } else {
          log(state, `${pl.name} は遊牧民団で 好意1 を使った（相手のターン中なので +1${ch === 'action' ? 'アクション' : '購入'} は働かない）。`);
        }
        return state;
      }
      /* 同盟：占星術師団／メイソン団の常設方針＝「1回のシャッフルに好意を何個まで使うか」。
         シャッフルは効果解決の途中で同期的に起きて対話を挟めないので、**何個使うかだけ**を本人が決め、
         どの札を選ぶかはエンジンが自動で最善を選ぶ（§0-29 の決定＝許容簡略化）。STASH_SETTING と同型。 */
      case 'FAVOR_SHUFFLE_SETTING': {
        const actorSeat = state.pending ? state.pending.player : t.active;
        if (action.player !== actorSeat) return state;
        const pl = state.players[action.player];
        const v = Math.floor(Number(action.value));
        if (!pl || !isFinite(v) || v < 0 || v > 9) return state;
        if ((pl.favorShuffle || 0) === v) return state;
        pl.favorShuffle = v;
        return state;
      }

      default:
        return state;
    }
  }

  /* ---------- 視点別マスク（サーバ→各クライアント配信用） ----------
     seat 番のプレイヤーから見て、自分の手札・山札・捨て札は見えるが、
     他人の手札・山札・捨て札は中身を伏せる（枚数だけ保つ）。場(inPlay)・廃棄・サプライは公開。
     捨て札も伏せるのは、クリーンアップ直後は捨て札の末尾＝相手が使わなかった手札そのもので、
     配信JSONを覗けば事後的に手札が分かってしまうため（公式でも捨て札の中身は確認不可）。
     技術的にも覗けないよう、配列の中身を 'back' に置換して配信する。 */
  function maskStateFor(state, seat) {
    const s = clone(state);
    s.players = s.players.map((p, i) => {
      // 自分：手札・捨て札・場・自分の山札の「中身(構成)」は見えてよい（公式でも自分のデッキ構成は既知）。
      // ただし山札の「順序」＝次に引く札は公式でも不可視。配信JSONを覗く改造クライアントの山札透視を防ぐため、
      // 自席の deck は id をソートして順序情報を消す（中身と枚数は保持＝自分の得点 vpOf 計算やUI表示は不変）。
      // 権威stateはサーバが完全な順序で保持し reduce もそこで行う（クライアントは reduce しない）ので実害なし。
      // 山札上を見る/並べ替える効果（薬剤師・衛兵・見張り・水晶玉等）は pending 側で本人にだけ明示公開する。
      // 例外＝へそくり(Stash)：裏面が異なる＝山札内の「位置」は公式でも公開情報。位置だけ保存してソートする。
      if (i === seat) {
        const rest = p.deck.filter((c) => c !== 'stash').sort();
        let ri = 0;
        return Object.assign({}, p, { deck: p.deck.map((c) => (c === 'stash' ? 'stash' : rest[ri++])) });
      }
      // 錬金術・支配：支配者は被支配者（手番のactive）の手札を見て操作する（山札は伏せたまま）。
      const revealHand = state.turn && state.turn.possessedBy === seat && i === state.turn.active;
      // 海辺：脇置き(setAside)・原住民の村マットは秘密＝枚数だけ。島マット・持続カードは公開（公式どおり）。
      // delayedEffects（次手番の予約）は種別は見せるが、隠し札id（停泊所の脇置き・封鎖の獲得物）は伏せる。
      const maskedDelayed = (p.delayedEffects || []).map((e) => {
        const c = Object.assign({}, e);
        delete c.stashed; delete c.setAsideCard; delete c.gained; delete c.pirateTarget;
        return c;
      });
      return Object.assign({}, p, {
        // へそくり(Stash)は裏面が異なる＝相手の山札内の位置も公開情報（公式）。stash だけ晒して残りは伏せる。
        deck: p.deck.map((c) => (c === 'stash' ? 'stash' : 'back')),
        hand: revealHand ? p.hand.slice() : p.hand.map((c) => (c === 'stash' ? 'stash' : 'back')),
        discard: new Array(p.discard.length).fill('back'),
        setAside: (p.setAside || []).map((c) => (c === 'stash' ? 'stash' : 'back')),
        nativeVillageMat: new Array((p.nativeVillageMat || []).length).fill('back'),
        delayedEffects: maskedDelayed,
        // 帝国：資料庫の脇置きは所有者だけが中身を見られる＝相手には伏せる（枚数=idは残す）。
        archives: (p.archives || []).map((a) => ({ id: a.id, cards: revealHand ? (a.cards || []).slice() : (a.cards || []).map(() => 'back') })),
        // 夜想曲：納骨堂の脇札は裏向き＝所有者だけが見られる（公式逐語「other players may not」）。
        //   幽霊の脇札は**公開**（公開しながら掘るので全員が見ている）＝伏せない。
        cryptSetAside: revealHand ? (p.cryptSetAside || []).slice() : (p.cryptSetAside || []).map(() => 'back'),
        // inPlay / durationCards / islandMat / princes（王子の脇＝公開）/ ghostSetAside は表向き＝そのまま
      });
    });
    // 闇市場デッキは伏せ札。中身は誰にも見えないよう枚数だけ残す（公開された3枚は pending.revealed 側に出る）。
    if (Array.isArray(s.blackMarket)) s.blackMarket = new Array(s.blackMarket.length).fill('back');
    /* 混合山のうち**中身が秘密**の山（暗黒時代の廃墟/騎士＝無作為に積むので順序が情報になる）は
       一番上の1枚だけ公開情報。残りは裏向き（枚数のみ見せる）。
       ※城（昇順で決定的）と同盟の分割山6組は**全公開**が公式（`You can look through the cards in a split pile
         at any time, without changing the order.`）＝ここで伏せてはいけない。
       集合は HIDDEN_MIXED_PILE_KEYS が正本（サーバの「同意なしの1手もどす」もこれを見る）。 */
    HIDDEN_MIXED_PILE_KEYS.forEach((k) => {
      if (Array.isArray(s[k])) s[k] = s[k].map((c, i) => (i === 0 ? c : 'back'));
    });
    /* 夜想曲：祝福/呪詛の山は**中身も順序も完全に秘密**（枚数だけ見せる）。捨て札は**一番上の1枚だけ**が
       公開情報＝それ以外を見てはいけない（日本語wiki 逐語）。順序が漏れると残りの祝福/呪詛が全部読めてしまう。
       ドルイドの脇3枚は表向き＝公開。 */
    if (s.boons) {
      s.boons.deck = new Array(s.boons.deck.length).fill('back');
      s.boons.discard = s.boons.discard.map((c, i, a) => (i === a.length - 1 ? c : 'back'));
    }
    if (s.hexes) {
      s.hexes.deck = new Array(s.hexes.deck.length).fill('back');
      s.hexes.discard = s.hexes.discard.map((c, i, a) => (i === a.length - 1 ? c : 'back'));
    }
    // 仮面舞踏会のパスは「同時・秘密」。逐次解決中の picks(他席が渡したカード)を
    // 後手席に配信すると情報優位になるため、自分の選択分以外は伏せる。
    if (s.pending && s.pending.type === 'masquerade' && s.pending.stage === 'pass' && s.pending.picks) {
      const masked = {};
      if (s.pending.picks[seat] != null) masked[seat] = s.pending.picks[seat];
      s.pending = Object.assign({}, s.pending, { picks: masked });
    }
    // 衛兵・見張り・水晶玉で「見た」山札上の札は私的な看破（reveal していない）。
    // 見てよいのは「本人」と、支配中ならその決定者＝支配者(possessedBy)。それ以外の席には中身を伏せる（枚数は残す）。
    // ※支配中に決定者(支配者)へ配信しないと、UIが未知id 'back' を描画して render 例外→操作不能になる。
    const secretSeer = (s.turn && s.turn.possessedBy != null && s.pending && s.pending.player === s.turn.active)
      ? s.turn.possessedBy : (s.pending ? s.pending.player : -1);
    // 冒険：偵察隊（scouting_party）の「山札の上5枚を見る」も私的な看破＝本人と支配者以外には伏せる。
    // 夜想曲：`look_arrange`（夜警＝山札の上5枚／太陽の恵み＝4枚）は「**見る**」＝本人だけの私的情報。
    if (s.pending && (s.pending.type === 'sentry' || s.pending.type === 'lookout' || s.pending.type === 'catacombs' || s.pending.type === 'survivors' || s.pending.type === 'scouting_party' || s.pending.type === 'look_arrange') && Array.isArray(s.pending.cards) && seat !== s.pending.player && seat !== secretSeer) {
      // 暗黒時代：地下墓所/生存者の「山札の上N枚を見る」は私的（公開ではない）＝本人と支配者以外には伏せる。
      s.pending = Object.assign({}, s.pending, { cards: new Array(s.pending.cards.length).fill('back') });
    }
    // 夜想曲：ゾンビの密偵の「山札の一番上を見る」も私的情報（水晶玉と同型）。
    if (s.pending && (s.pending.type === 'crystal_ball' || s.pending.type === 'zombie_spy') && s.pending.card != null && seat !== s.pending.player && seat !== secretSeer) {
      s.pending = Object.assign({}, s.pending, { card: 'back' });
    }
    // ギルド：医者の過払いで「見た」山札の上1枚は私的（本人と支配者のみ）。他席には伏せる。
    if (s.pending && s.pending.type === 'doctor_overpay' && s.pending.card != null && seat !== s.pending.player && seat !== secretSeer) {
      s.pending = Object.assign({}, s.pending, { card: 'back' });
    }
    // 冒険：保存（Save）で脇に置いた1枚は**裏向き**（公式）＝p.setAside は伏せているので turn.savedCard も伏せる。
    //   （手番プレイヤー本人と、支配中の決定者だけが見てよい。engine の権威 state は元の id を保持する。）
    if (s.turn && s.turn.savedCard) {
      const owner = s.turn.active;
      const decider = (s.turn.possessedBy != null) ? s.turn.possessedBy : owner;
      if (seat !== owner && seat !== decider) s.turn = Object.assign({}, s.turn, { savedCard: 'back' });
    }
    s.you = seat;
    return s;
  }

  /* ---------- プレイヤーが送れるアクション種別（唯一の正本）----------
     reduce() が処理する action.type のうち、対戦中にプレイヤー/CPUが送るもの（NEW_GAME を除く）。
     サーバ(server/gameServer.js)はこれを唯一の許可リストとして使う＝二重管理しない。
     新しい選択ステップ（*_RESOLVE 等）を reduce に足したら、ここにも必ず追加すること。
     test/integrity.test.js が「reduce の switch case と完全一致」を自動検証するので、
     追加漏れ・綴り違いはテストで即わかる（オンラインだけ壊れる事故を防ぐ）。 */
  const PLAYER_ACTIONS = new Set([
    'PLAY_ACTION', 'PLAY_TREASURE', 'PLAY_ALL_TREASURES', 'BUY', 'END_ACTION_PHASE', 'END_TURN',
    'PLAY_NIGHT', // 夜想曲：夜フェイズに夜行カードを使う（アクション権も購入権も消費しない）
    'CELLAR_RESOLVE', 'MILITIA_RESOLVE', 'MOAT_REVEAL',
    'MINE_TRASH', 'MINE_GAIN', 'REMODEL_TRASH', 'REMODEL_GAIN', 'WORKSHOP_GAIN',
    'COURTYARD_PUT', 'PAWN_RESOLVE', 'STEWARD_RESOLVE', 'STEWARD_TRASH',
    'WISHING_RESOLVE', 'BARON_RESOLVE', 'IRONWORKS_GAIN',
    'MINING_VILLAGE_RESOLVE', 'NOBLES_RESOLVE', 'TORTURER_RESOLVE',
    'TRADING_POST_RESOLVE', 'UPGRADE_TRASH', 'UPGRADE_GAIN', 'SCOUT_RESOLVE',
    'SWINDLER_REACT', 'SWINDLER_GAIN', 'SABOTEUR_REACT', 'SABOTEUR_GAIN',
    'MINION_RESOLVE', 'MINION_ATTACK_REACT', 'MASQUERADE_PASS', 'MASQUERADE_TRASH',
    'SECRET_CHAMBER_RESOLVE', 'SECRET_CHAMBER_REVEAL', 'SECRET_CHAMBER_PUTBACK',
    'MONEYLENDER_RESOLVE', 'CHANCELLOR_RESOLVE', 'CHAPEL_RESOLVE',
    'WITCH_REACT', 'BUREAUCRAT_REACT', 'BUREAUCRAT_PUT', 'FEAST_GAIN',
    'LIBRARY_RESOLVE', 'SPY_REACT', 'SPY_DECIDE', 'THIEF_REACT', 'THIEF_PICK', 'THIEF_GAIN',
    'THRONE_CHOOSE',
    // 基本 第二版
    'HARBINGER_PUT', 'VASSAL_PLAY', 'POACHER_DISCARD', 'BANDIT_REACT', 'BANDIT_PICK',
    'SENTRY_RESOLVE', 'ARTISAN_GAIN', 'ARTISAN_PUT',
    // 陰謀 第二版
    'COURTIER_REVEAL', 'COURTIER_CHOOSE', 'DIPLOMAT_REVEAL', 'DIPLOMAT_DISCARD',
    'LURKER_CHOOSE', 'LURKER_TRASH', 'LURKER_GAIN', 'MILL_RESOLVE', 'PATROL_RESOLVE',
    'REPLACE_TRASH', 'REPLACE_GAIN', 'REPLACE_REACT', 'SECRET_PASSAGE_PICK', 'SECRET_PASSAGE_PLACE',
    // プロモ
    'ENVOY_PICK', 'GOVERNOR_CHOOSE', 'GOVERNOR_REMODEL_TRASH', 'GOVERNOR_REMODEL_GAIN',
    'DISMANTLE_TRASH', 'DISMANTLE_GAIN', 'BLACK_MARKET_PLAY_TREASURES', 'BLACK_MARKET_BUY', 'BLACK_MARKET_SKIP',
    // 新プロモ（王子/船長/教会/サウナ/アヴァント/へそくり）
    'PRINCE_SETASIDE', 'PRINCE_PLAY', 'CAPTAIN_PLAY', 'CHURCH_SETASIDE', 'CHURCH_TRASH',
    'SAUNA_CHAIN', 'SAUNA_TRASH', 'STASH_SETTING',
    // 冒険（Adventures）
    'DUNGEON_DISCARD', 'GEAR_SETASIDE', 'AMULET_RESOLVE', 'AMULET_TRASH',
    'RELIC_REACT', 'GIANT_REACT', 'BRIDGE_TROLL_REACT',
    'MISER_RESOLVE', 'TAVERN_START_CALL', 'RATCATCHER_TRASH', 'TRANSMOGRIFY_TRASH', 'TRANSMOGRIFY_GAIN', 'WINE_MERCHANT_DISCARD',
    'AFTER_ACTION_CALL', 'DUPLICATE_CALL',
    // 冒険：トラベラー（page/peasant＋成長先＋教師の山トークン）
    'WARRIOR_REACT', 'SOLDIER_REACT', 'SOLDIER_DISCARD', 'HERO_GAIN', 'FUGITIVE_DISCARD', 'DISCIPLE_PLAY', 'TRAVELLER_EXCHANGE_RESOLVE',
    'TEACHER_TOKEN', 'TEACHER_PILE',
    // 冒険：純持続/アタック（隊商の護衛リアクション／呪いの森・沼の妖婆）
    'CARAVAN_GUARD_REACT', 'LINGER_REACT',
    // 冒険：複雑系（倒壊/工匠/語り部/使者）
    'RAZE_TRASH', 'RAZE_LOOK', 'ARTIFICER_DISCARD', 'ARTIFICER_GAIN', 'STORYTELLER_PLAY', 'MESSENGER_PLAY', 'MESSENGER_GAIN',
    // 帝国（Empires）Batch E1：負債経済
    'REPAY_DEBT', 'ENGINEER_GAIN', 'ENGINEER_TRASH',
    // 帝国（Empires）Batch E2
    'SACRIFICE_TRASH', 'FORUM_DISCARD', 'CHARM_MODE', 'CHARM_GAIN', 'LEGIONARY_REVEAL', 'ENCHANTRESS_REACT', 'ARCHIVE_PICK',
    // 帝国（Empires）Batch E3：集合
    'TEMPLE_TRASH', 'WILD_HUNT_RESOLVE',
    // 帝国（Empires）Batch E4：分割山
    'ENCAMPMENT_REVEAL', 'SETTLERS_RESOLVE', 'CATAPULT_TRASH', 'CATAPULT_REACT', 'GLADIATOR_REVEAL', 'GLADIATOR_MATCH',
    // 帝国（Empires）Batch E5：城（混合山）
    'SMALL_CASTLE_RESOLVE', 'OPULENT_CASTLE_DISCARD', 'HAUNTED_TOPDECK', 'SPRAWLING_CASTLE_CHOOSE',
    // 帝国（Empires）Batch E6：命令（overlord/crown）
    'OVERLORD_PLAY', 'CROWN_CHOOSE',
    'ARENA_RESOLVE', 'MOUNTAIN_PASS_BID',
    // 帝国：横型イベント（買う横型）
    'BUY_EVENT', 'SALT_TRASH', 'BANQUET_GAIN', 'ADVANCE_TRASH', 'ADVANCE_GAIN', 'RITUAL_TRASH',
    'TAX_PILE', 'DONATE_TRASH', 'ANNEX_KEEP',
    // 冒険：横型イベント（買う横型）
    'ALMS_GAIN', 'QUEST_MODE', 'QUEST_DISCARD', 'SAVE_SETASIDE', 'SCOUTING_DISCARD', 'SCOUTING_ORDER',
    'BONFIRE_TRASH', 'BALL_GAIN', 'SEAWAY_GAIN', 'TRADE_TRASH', 'PILGRIMAGE_GAIN', 'EVENT_TOKEN_PILE',
    'PLAN_TRASH', 'TRAVELLING_FAIR_TOPDECK', 'INHERITANCE_SET',
    // 同盟（Allies）A3：Ally カード23種の窓＋占星術師団/メイソン団の常設方針
    'ALLY_SIMPLE', 'ALLY_GANG', 'ALLY_CAVE', 'ALLY_CRAFTERS', 'ALLY_INVENTORS', 'ALLY_MARKET_TOWNS',
    'ALLY_PEACEFUL_CULT', 'ALLY_WOODWORKERS', 'ALLY_COASTAL_HAVEN', 'ALLY_ARCHITECTS', 'ALLY_NOMADS',
    'FAVOR_SHUFFLE_SETTING',
    // ルネサンス（Renaissance）：村人（アクションフェイズ）／プロジェクト（買う横型・1人2つまで）／王国カード
    'SPEND_VILLAGER', 'BUY_PROJECT',
    'HIDEOUT_TRASH', 'INVENTOR_GAIN', 'MOUNTAIN_VILLAGE_TAKE', 'PRIEST_TRASH', 'RECRUITER_TRASH',
    'SCULPTOR_GAIN', 'SEER_ORDER', 'OLD_WITCH_REACT', 'OLD_WITCH_TRASH', 'VILLAIN_REACT', 'VILLAIN_DISCARD',
    'DUCAT_TRASH', 'BORDER_GUARD_KEEP', 'BORDER_GUARD_ARTIFACT',
    'TREASURER_CHOOSE', 'TREASURER_TRASH', 'TREASURER_GAIN',
    'RESEARCH_TRASH', 'CARGO_SHIP_SETASIDE', 'IMPROVE_TRASH', 'IMPROVE_GAIN',
    'SCEPTER_CHOOSE', 'SCEPTER_REPLAY',
    // ルネサンス：プロジェクト（横型）
    'CATHEDRAL_TRASH', 'CITY_GATE_TOPDECK', 'SILOS_DISCARD', 'SINISTER_PLOT_RESOLVE', 'CROP_ROTATION_RESOLVE',
    'PAGEANT_PAY', 'SEWERS_TRASH', 'INNOVATION_PLAY',
    // 暗黒時代（Dark Ages）
    'SURVIVORS_RESOLVE', 'RATS_TRASH', 'ARMORY_GAIN', 'FORAGER_TRASH', 'SQUIRE_RESOLVE', 'SQUIRE_TRASH_GAIN',
    'STOREROOM_DISCARD', 'SCAVENGER_DECK', 'SCAVENGER_TOPDECK', 'IRONMONGER_RESOLVE', 'MINSTREL_RESOLVE',
    'JUNK_DEALER_TRASH', 'MYSTIC_NAME', 'ALTAR_TRASH', 'ALTAR_GAIN', 'CATACOMBS_RESOLVE', 'CATACOMBS_TRASH_GAIN',
    'HUNTING_GROUNDS_TRASH', 'GRAVEROBBER_MODE', 'GRAVEROBBER_FROM_TRASH', 'GRAVEROBBER_TRASH', 'GRAVEROBBER_GAIN',
    'REBUILD_NAME', 'REBUILD_GAIN', 'COUNT_PART1', 'COUNT_DISCARD', 'COUNT_TOPDECK', 'COUNT_PART2',
    'DEATH_CART_RESOLVE', 'BAND_OF_MISFITS_PLAY', 'HERMIT_TRASH', 'HERMIT_GAIN',
    'PROCESSION_CHOOSE', 'PROCESSION_GAIN', 'COUNTERFEIT_PLAY',
    'MARAUDER_REACT', 'CULTIST_REACT', 'CULTIST_CHAIN', 'PILLAGE_REACT', 'PILLAGE_PICK',
    'ROGUE_REACT', 'ROGUE_PICK', 'ROGUE_GAIN_FROM_TRASH', 'DISCARD_DOWN_RESOLVE', 'MERCENARY_TRASH', 'URCHIN_TRASH',
    'KNIGHT_REACT', 'KNIGHT_PICK', 'DAME_ANNA_TRASH', 'DAME_NATALIE_GAIN',
    'BEGGAR_REACT', 'MARKET_SQUARE_REACT', 'HOVEL_REACT',
    // 海辺（第二版）
    'WAREHOUSE_DISCARD', 'HAVEN_SETASIDE', 'TACTICIAN_RESOLVE', 'SALVAGER_TRASH',
    'LOOKOUT_TRASH', 'LOOKOUT_DISCARD', 'ISLAND_PICK', 'NATIVE_VILLAGE_RESOLVE', 'TIDE_POOLS_DISCARD',
    'CUTPURSE_REACT', 'SEA_WITCH_REACT', 'SEA_WITCH_DISCARD', 'SMUGGLERS_GAIN', 'BLOCKADE_GAIN', 'BLOCKADE_REACT',
    'SAILOR_TRASH', 'SAILOR_PLAY_GAIN', 'PIRATE_GAIN', 'PIRATE_REACT',
    // 錬金術（第二版）
    'TRANSMUTE_TRASH', 'APOTHECARY_RESOLVE', 'SCRYING_REACT', 'SCRYING_DECIDE',
    'UNIVERSITY_GAIN', 'FAMILIAR_REACT', 'GOLEM_ORDER', 'APPRENTICE_TRASH',
    // 繁栄（第二版）
    'CHARLATAN_REACT', 'RABBLE_REACT', 'CLERK_REACT', 'CLERK_TOPDECK', 'CLERK_START',
    'BISHOP_TRASH', 'BISHOP_OTHER', 'VAULT_DISCARD', 'VAULT_OTHER', 'MINT_REVEAL',
    'EXPAND_TRASH', 'EXPAND_GAIN', 'FORGE_TRASH', 'FORGE_GAIN', 'KINGS_COURT_CHOOSE',
    'WAR_CHEST_NAME', 'WAR_CHEST_GAIN', 'WATCHTOWER', 'TIARA_TOPDECK', 'TIARA_PLAY',
    'ANVIL_DISCARD', 'ANVIL_GAIN', 'INVESTMENT', 'INVESTMENT_TRASH', 'CRYSTAL_BALL',
    // 収穫祭
    'HAMLET_DISCARD', 'FORTUNE_TELLER_REACT', 'HORSE_TRADERS_DISCARD', 'HORSE_TRADERS_REACT',
    'REMAKE_TRASH', 'REMAKE_GAIN', 'TOURNAMENT_REVEAL', 'TOURNAMENT_PRIZE',
    'YOUNG_WITCH_DISCARD', 'YOUNG_WITCH_REACT', 'YOUNG_WITCH_BANE',
    'JESTER_REACT', 'JESTER_CHOOSE', 'FOLLOWERS_REACT', 'FOLLOWERS_DISCARD',
    'TRUSTY_STEED_RESOLVE', 'HORN_OF_PLENTY_GAIN',
    // ギルド
    'COFFERS_SPEND', 'OVERPAY_RESOLVE', 'STONEMASON_OVERPAY_GAIN', 'DOCTOR_OVERPAY', 'HERALD_OVERPAY',
    'STONEMASON_TRASH', 'STONEMASON_GAIN', 'DOCTOR_NAME', 'DOCTOR_ORDER', 'ADVISOR_CHOOSE',
    'PLAZA_DISCARD', 'TAXMAN_TRASH', 'TAXMAN_GAIN', 'TAXMAN_REACT',
    'BUTCHER_TRASH', 'BUTCHER_PAY', 'BUTCHER_GAIN', 'JOURNEYMAN_NAME', 'SOOTHSAYER_REACT',
    // 異郷
    'OASIS_RESOLVE', 'DUCHESS_LOOK', 'DEVELOP_TRASH', 'DEVELOP_GAIN', 'ORACLE_REACT', 'ORACLE_DECIDE',
    'JACK_LOOK', 'JACK_TRASH', 'NOBLE_BRIGAND_REACT', 'NOBLE_BRIGAND_PICK',
    'SPICE_MERCHANT_TRASH', 'SPICE_MERCHANT_CHOOSE', 'TRADER_TRASH', 'TRADER_REACT',
    'CARTOGRAPHER_RESOLVE', 'EMBASSY_DISCARD', 'INN_DISCARD', 'INN_GAIN', 'MANDARIN_TOPDECK',
    'MARGRAVE_REACT', 'MARGRAVE_DISCARD', 'STABLES_DISCARD', 'BORDER_VILLAGE_GAIN',
    'WEAVER_MODE', 'WEAVER_GAIN', 'SOUK_TRASH', 'GUARD_DOG_REACT',
    'BERSERKER_GAIN', 'BERSERKER_REACT', 'BERSERKER_DISCARD',
    'WHEELWRIGHT_DISCARD', 'WHEELWRIGHT_GAIN', 'WITCHS_HUT_DISCARD', 'WITCHS_HUT_REACT', 'CAULDRON_REACT',
    'DUCHESS_GAIN', 'FARMLAND_TRASH', 'FARMLAND_GAIN', 'HAGGLER_GAIN', 'FOOLS_GOLD_REACT', 'IGG_PLAY', 'SCHEME_CLEANUP',
    // 移動動物園（Menagerie）：追放（Exile）＋王国カード30種
    'EXILE_DISCARD', 'BARGE_CHOOSE', 'BOUNTY_HUNTER_EXILE', 'CAMEL_TRAIN_EXILE',
    'BLACK_CAT_REACT', 'CARDINAL_REACT', 'CARDINAL_PICK', 'COVEN_REACT',
    'DISPLACE_EXILE', 'DISPLACE_GAIN', 'FALCONER_GAIN', 'FALCONER_REACT',
    'GOATHERD_TRASH', 'GROOM_GAIN', 'HOSTELRY_DISCARD', 'HUNTING_LODGE_CHOOSE',
    'MASTERMIND_PLAY', 'SANCTUARY_EXILE', 'SCRAP_TRASH', 'SCRAP_CHOOSE',
    'SHEEPDOG_REACT', 'SLEIGH_REACT', 'VILLAGE_GREEN_CHOOSE', 'VILLAGE_GREEN_REACT',
    'WAYFARER_GAIN', 'KILN_GAIN',
    // 移動動物園：習性（Way）＝横型・買わない（PLAY_ACTION に action.way を添えて使う）
    'WAY_BUTTERFLY', 'WAY_BUTTERFLY_GAIN', 'WAY_GOAT_TRASH', 'WAY_RAT_DISCARD', 'WAY_SEAL_TOPDECK',
    // 移動動物園：イベント20種（横型・購入して使う）
    'BARGAIN_GAIN', 'DEMAND_GAIN', 'DESPERATION', 'BANISH_EXILE', 'INVEST_EXILE',
    'TRANSPORT_MODE', 'TRANSPORT_PICK', 'TOIL_PLAY', 'MARCH_PLAY', 'GAMBLE_PLAY',
    'DELAY_SETASIDE', 'EVENT_PLAY', 'ENHANCE_TRASH', 'ENHANCE_GAIN', 'PURSUE_NAME', 'POPULATE_GAIN',
    // 夜想曲：祝福／呪詛／状態
    'BOON_WIND_DISCARD', 'BOON_FLAME_TRASH', 'BOON_EARTH_DISCARD', 'BOON_EARTH_GAIN',
    'BOON_SKY_DISCARD', 'BOON_MOON_TOPDECK', 'LOOK_ARRANGE_RESOLVE',
    'HEX_REACT', 'HEX_POVERTY_DISCARD', 'HEX_FEAR_DISCARD', 'HEX_HAUNTING_TOPDECK', 'HEX_LOCUSTS_GAIN',
    'LOST_IN_WOODS',
    // 夜想曲：王国カード（非夜行）＋家宝
    'BLESSED_VILLAGE_BOON', 'CEMETERY_TRASH', 'CONCLAVE_PLAY', 'DRUID_BOON', 'BOON_CHOOSE', 'GROVE_OFFER',
    'PIXIE_TRASH', 'POOKA_TRASH', 'SECRET_CAVE_DISCARD', 'SHEPHERD_DISCARD', 'TRAGIC_HERO_GAIN',
    'GOAT_TRASH', 'HAUNTED_MIRROR_GHOST', 'FAITHFUL_HOUND_REACT', 'IDOL_REACT',
    // 夜想曲：夜行カードと非サプライのアクション
    'COBBLER_GAIN', 'CRYPT_SETASIDE', 'CRYPT_PICK', 'DEVILS_WORKSHOP_GAIN',
    'EXORCIST_TRASH', 'EXORCIST_GAIN', 'MONASTERY_TRASH', 'RAIDER_REACT', 'RAIDER_DISCARD',
    'IMP_PLAY', 'WISH_GAIN', 'ATTACK_WINDOW_REACT',
    // 夜想曲：交換／廃棄置き場からのプレイ／2度使用
    'CHANGELING_GAIN', 'CHANGELING_EXCHANGE', 'BAT_TRASH', 'VAMPIRE_GAIN', 'NECROMANCER_PLAY', 'GHOST_PLAY',
    'ZOMBIE_APPRENTICE', 'ZOMBIE_MASON_GAIN', 'ZOMBIE_SPY',
  ]);

  /* ---------- 公開API ---------- */
  DOM.engine = {
    createInitialState,
    reduce,
    cardCost,
    vpOf,
    scoreGame,
    landmarkScoreForCards, // 帝国：ランドマーク得点（CPUが仮デッキで engine と完全一致の見積りに使う）
    isGameOver,
    emptyPileCount,
    canBuyCard,
    // mix-all 硬化：獲得コスト述語の正本（engine reducer / CPU 候補選び / UI モーダル filter が同じ関数を見る）
    costOf,        // コストの3成分 {coin, pot, debt}（コスト軽減込み）
    gainableBase,  // サプライから獲得できる土台（非サプライ・ロック中の分割山下段・在庫切れを弾く）
    costUpTo,      // 「コスト$N以下」（成分別比較。ポーション/負債を持つ札は既定で対象外）
    costUnder,     // 「これより安い」（成分別 strictly less）
    costExact,     // 「ちょうど$N（ポーション/負債も一致）」
    sameCost,      // 2枚のコストが完全一致か（詐欺師/御守り）
    captainTargets, // 新プロモ：船長の対象（CPU/UIが同じ候補を参照＝engine拒否とCPU非提案のセット）
    bandOfMisfitsTargets, // 暗黒時代：はみだし者の対象（CPU/UIが同じ候補を参照）
    overlordTargets, // 帝国：大君主の対象（CPU/UIが同じ候補を参照）
    pendingSelf, // E8：倒壊/死の荷車の「これを廃棄できるか」（CPU/UIが同じ述語を参照＝engine拒否とCPU非提案のセット）
    validTeacherPiles, // 冒険：教師のトークン置き先（CPU/UIが同じ候補を参照）
    actionSupplyPiles, // 冒険：山トークン（渡し船/立案/失われた技術/鍛錬/誘導）の置き先＝アクションのサプライ山
    inheritanceTargets, // 冒険：相続の対象（CPU/UIが同じ候補を参照）
    inheritedEstate,   // 冒険：相続＝この屋敷はアクションとしてプレイできるか（engine/CPU/UI が同じ述語）
    pilgrimageChoices, // 冒険：巡礼で獲得できる「場にある名前の異なるカード」
    canBuyEvent,       // 冒険：1ターン1回／1ゲーム1回のイベントを今買えるか（engine拒否とCPU/UI非提案のセット）
    canBuyProject,     // ルネサンス：このプロジェクトを今買えるか（1人2つまで／同じものは1回だけ。engine拒否とCPU/UI非提案のセット）
    hasMyProject,      // ルネサンス：そのプレイヤーがそのプロジェクトを買っているか（効果判定の正本）
    hasArtifact,       // ルネサンス：そのプレイヤーがそのアーティファクトを持っているか（engine/CPU/UI が同じ述語）
    scepterTargets,    // ルネサンス：王笏の再演対象（engine/CPU/UI が同じ候補を参照）
    // 移動動物園：追放（Exile）。engine/CPU/UI が同じ述語を見る（片側だけずれると CPU 無限ループ／人間が詰む）。
    availableInSupply, // 「今サプライから取れる（＝山の一番上にある）」か。追放・サプライ廃棄の候補選びの正本
    exilableSupplyIds, // 「サプライから追放できる」候補id列（非サプライ山・ロック中の分割山下段を除く）
    allCards,          // そのプレイヤーの所有カード全部（全ゾーン）。**CPU の得点見積りはこれを使う**
                       //   （CPU 側で同じゾーン列挙を手書きすると、新ゾーンを足すたびに片方が漏れて終局読みが狂う）
    exileCount,        // そのプレイヤーの追放マットにある同名カードの枚数
    investCount,       // 移動動物園：投資（Invest）で追放したコピーの枚数（表示用・+2カードの判定はengine内）
    bargainCanGain,    // 移動動物園：特価品の獲得候補（$5以下・勝利点でない）
    populatePiles,     // 移動動物園：植民で獲得できる「アクションのサプライ山」の一覧（engine/CPU/UI が同じ候補を参照）
    isUsableWay,       // 移動動物園：その習性がこの対局で採用されているか（イベントの「使用」でも習性を選べる）
    // 夜想曲：祝福/呪詛/状態（CPU/UI が engine と同じ述語を見る）
    sharesType,        // 蝗害＝2枚が種別を1つ以上共有するか（獲得候補の絞り込みに CPU/UI も使う）
    conclaveTargets,   // コンクラーベ／インプ＝「場に同名が無い手札のアクション」（engine/CPU/UI が同じ候補を見る）
    exorcistSpirits,   // 悪魔祓い＝廃棄したカードより安い精霊の候補（**非サプライなので costUnder では取れない**）
    necromancerTargets, // ネクロマンサー＝廃棄置き場の「表向き・持続でない」アクションの位置（engine/CPU/UI 共通）
    changelingCanExchange, // 取り替え子＝この獲得を取り替え子と交換できるか（engine/CPU/UI 共通）
    // 同盟：分割山6組（混合山モデル）と循環(Rotate)。engine/CPU/UI/テストが同じ正本を見る。
    splitLocked,       // その id が「まだ山の一番上に出ていない」か（2段分割山＋循環）。CPU/UI はこれを見る
    MIXED_PILE_KEYS,   // 混合山の山キー一覧（廃墟/騎士/城＋同盟の6山）＝**この配列が唯一の正本**
    HIDDEN_MIXED_PILE_KEYS, // そのうち中身が秘密の山（廃墟/騎士）＝マスクとオンラインUndoの同意判定が見る
    isMixedPileKey,    // その id が混合山の山キーか
    isTypeSupply,      // 「サプライから獲得/廃棄するカードの種別」＝混合山は**一番上の実カード**で判定（CPU/UI も同じ述語を見る）
    pileKeyOf,         // カードid → その山キー（分割山の中身 → 山／山を名指しする効果は4種すべてに効く）
    mixedTopCard,      // その混合山の一番上の実カードid（無ければ null）＝CPU/UI の表示・コスト評価はこれを見る
    rotatePile,        // 循環＝先頭からの「連続」同名ブロックを末尾へ（空の山・1種類だけの山でも合法＝無効果）
    rotatableSupplyPiles, // 戦闘計画＝「任意のサプライ山」を回す候補（engine拒否・CPU候補・UIフィルタが共有）
    trashFromSupplyPile,  // サプライの山から1枚を廃棄（塩まき/待ち伏せ/剣闘士）。混合山は一番上の実カードを抜く
    // 同盟 A3：Ally カード23種（engine拒否・CPU候補・UIフィルタが同じ述語を見る）
    hasAlly,             // このゲームの Ally がその1枚か
    favorPileTargets,    // 発明家の家族：好意トークンを置ける山（**randomizer の種別**で判定＝勝利点の山は不可）
    architectsCanGain,   // 建築家ギルド：獲得したカードより安い・勝利点でないカードの候補（解決時に測り直す）
    woodworkersCanGain,  // 木工ギルド：獲得できるアクション（**コスト上限なし**＝負債/ポーション費用でもよい）
    allyScoreForCards,   // 高原の羊飼い：得点計算（CPU も同じ算出を使う）
    returnToPile,         // 獲得しかけたカードを山へ戻す（交易商人）。混合山は一番上に載せる
    improveTargets,    // ルネサンス：増築の廃棄対象（engine/CPU/UI が同じ候補を参照）
    isTreasureFor,     // ルネサンス：資本主義を含む「今この状態で財宝か」＝**財宝判定の正本**（engine/CPU/UI が同じ述語）
    capitalismTreasures, // ルネサンス：資本主義で財宝になるアクションの集合（整合性テストで固定する）
    maskStateFor,
    PLAYER_ACTIONS,
    // 「誰が今操作すべきか」: 選択待ちならその人、なければ手番のプレイヤー
    // 「誰が今操作すべきか」。支配中は、被支配者(active)自身の決定を支配者が代行する。
    // 他プレイヤーのリアクション（pending.player が active 以外）は本人が行う。
    actor: (state) => {
      const t = state.turn;
      if (state.pending) {
        if (t && t.possessedBy != null && state.pending.player === t.active) return t.possessedBy;
        return state.pending.player;
      }
      if (t && t.possessedBy != null) return t.possessedBy;
      return t.active;
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DOM;
})();
