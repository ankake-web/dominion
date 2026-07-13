# 進捗（PROGRESS） — ドミニオン Webアプリ

---

## 0-22. 新拡張＝**ルネサンス（Renaissance）全50枚**（R1〜R6 全完了・**未push**・2026-07-13）

**発売順では夜想曲が次だが、技術的相性でルネサンスを先に実装**（ユーザー決定）。夜フェイズ・負債・分割山・混合山・
非サプライ山が**一つも無い**＝新機構は3つだけ（村人／アーティファクト／プロジェクト）で、財源（ギルド）と
横型ランドスケープ基盤（帝国/冒険）をそのまま流用できる。`sw.js` v48→**v49**。

### 規模：**王国25枚（縦型）＋プロジェクト20種（横型）＋アーティファクト5種（横型・非カード）＝50枚**
- 新セット3つ：**`renaissance`**（固定10種）／**`renaissance-projects`**（固定10＋プロジェクト2枚抽選）／`random-renaissance`。
- 固定10種 `DOM.KINGDOM_RENAISSANCE` ＝ border_guard / ducat / lackeys / experiment / improve / patron / research /
  old_witch / swashbuckler / treasurer（村人・財源・アーティファクト4種・持続・クリンナップ格上げ・公開リアクション・アタックを網羅）。
- **webp 50枚生成済み**（枠＋文字。**絵は未回収＝暗い板**）。横型は project＝赤茶（コスト円あり）／artifact＝灰青（コスト無し）の新スキン。

### 正本＝`docs/research/renaissance_rules.md`（多エージェント研究＋1枚ずつ敵対検証）
**RGG公式ルールブックPDFを実DL＋pdftotextで逐語確認**し、**2019/2022/2024エラッタ**まで反映。日本語版カード（2020年2月）は
パトロン/技術革新/探査/山砦/王笏が**旧テキストで印刷**されているので、本アプリの表示は**現行（エラッタ後）**を採用。
カタログ投入用 JSON＝`docs/research/renaissance_catalog.json`。

### 新機構（3つ）
1. **村人（Villagers）＝`p.villagers`**：財源の完全同型だが、消費は**アクションフェイズ**で `t.actions += n`（新 action `SPEND_VILLAGER`）。
   公開・VP無関係・ターン跨ぎで持ち越す。財源とは**別枠**（混ぜて使えない）。
2. **アーティファクト＝`state.artifacts = {flag|horn|key|lantern|treasure_chest: 席番号|null}`**（トップレベルの公開スカラー
   マップ＝`state.pileVP` と同型＝**保存則 tally 対象外**・maskは素通し）。**同時に持てるのは1人**＝「取る」と相手から奪う。
   **「取る」は「獲得」ではない**＝獲得/廃棄トリガーは一切発火しない。付与カード（旗手/国境警備隊/剣客/出納官）が
   王国にあるときだけ `createInitialState` がキーを作る（`DOM.artifactsForKingdom`）。
3. **プロジェクト（Projects）＝横型の第3種別**：`state.projects`（採用2枚まで）＋`p.projects`（買ったもの）。新 action
   **`BUY_PROJECT`**（`BUY_EVENT` を雛形）＝購入権1消費・コイン払い・**カードは獲得しない**・`treasuresLocked`＋`buysMade++`。
   **キューブは各自2個＝1人2つまで／同じものは1回だけ／複数人が同じものを買える／コスト軽減を受けない／負債>0では買えない**。
   **`DOM.engine.canBuyProject` が正本**（engine拒否・CPU非提案・UIボタン無効の3面が同じ述語を見る）。

### 【重要】既存エンジンへの2つの横断リファクタ（trashCard 統一と同じ質のもの）
1. **`reveal()` に「公開」の共通フックを集約**（パトロン＝アクションフェイズ中に公開されたら +1財源）。engine 内の
   **約72の公開サイトが一度に対応**。「公開ではない表示」（家臣＝捨てる／闇市場デッキ／廃棄置き場からの獲得）は
   `opts.notReveal` で除外。**新しく「公開する」カードを足すときは `reveal()` を通せば自動でパトロンが効く**。
2. **財宝判定を `isTreasureFor(state, id)` に集約**（資本主義＝自分のターン中「+$」を含むアクションは財宝でもある）。
   **engine 内の `DOM.isType(x,'treasure')` 69箇所すべてを置換**。資本主義が無ければ `DOM.isType` と同値＝既存挙動は不変。
   **得点計算（砦 keep）だけは静的判定に戻す**（「ターン中」ではないため）。判定表＝日本語テキストの `+N コイン` 正規表現
   ＋除外リスト（**銅細工師**＝英語原文に「+$」記号が無い）。**新しい財宝参照を書くときは必ず `isTreasureFor` を使う**。

### 【本エンジン固有の罠】クリンナップの「先引き」順序（§0-22 の最重要）
このエンジンは**自分の手番終了時に次の手札を先引きする**。したがって：
- **角笛（Horn）＝場の国境警備隊を山札の上に置く処理は、必ず先引きより前**（後にすると1ターン遅れてほぼ無効化される）。
- **旗（Flag）＝「手札を引くとき +1カード」はその先引きに乗せる**（前哨地の3枚→4枚にも効く。学者/寄付には効かない）。
- **増築（Improve）＝クリンナップ**開始時**の窓**（`endBuyTailSchemeOrCleanup` の先頭に pending を挟む）。
- **ピアッツァ＝ターン開始時は `turn.phase === 'action'`**（ドミニオンに「開始フェイズ」は無い。ここを 'buy'/'none' に
  すると**帝国の冠（フェイズでモードを決める）が壊れる**）。

### 実装バッチ（各末で `node test/invariants.test.js` 緑＋`npm test` 全緑＋コミット）
- **R1（`7507647`）共通基盤**：カタログ50件＋村人＋プロジェクト＋アーティファクトの器（効果ゼロ＝既存挙動不変）。
- **R2（`4712098`）素直な王国15枚**：追従者/劇団/実験/根城/発明家/山村/司祭/絹商人/学者/徴募官/彫刻家/先見者/香辛料/悪党/老魔女。
- **R3（`3d0c7b7`）アーティファクト5種＋パトロン**：国境警備隊（角笛/ランタン）/旗手（旗）/剣客（宝箱）/出納官（鍵）/ドゥカート/パトロン。
- **R4（`68e7e60`）持続・クリンナップ・再演**：貨物船（新ゾーン `p.cargo`＝表向き）/研究（裏向き脇置き＝マスク必須）/増築/王笏。
- **R5＋R5b＋R6（`d00d0d3`）プロジェクト20種＋CARD_SET昇格**：資本主義を含む全20種／`bestProjectBuy`／sw.js v49。

### 主な公式裁定（実装で踏んだもの）
- **発明家**＝「獲得 → **その後**コスト減」（自分の獲得には効かない・累積する）。
- **司祭**＝`t.priestCount`。**自身が指示した廃棄には +2コインが乗らない**（予約の設置がその廃棄の後）。アタックの廃棄は
  owner=被害者≠手番＝乗らない（公式）。礼拝堂で4枚廃棄＝+$8。
- **徴募官**＝廃棄したカードの**現在**コイン費用ぶん村人（**行商人はアクションフェイズでは$8＝+8村人**）。
- **老魔女**＝**免疫者は呪いを獲得もせず、呪いを廃棄することもできない**（魔女と違う）。呪い山が空でも「手札の呪いを廃棄」は行える。
- **剣客**＝3枚引く**途中でシャッフルして捨て札が空になったら +1財源も宝箱も得られない**。財源4個以上の判定は +1財源の**後**。
- **宝箱**＝「購入フェイズの開始時」は1ターンに複数回起こり得る（ヴィラで戻れば再発動＝2022エラッタ）。
- **出納官**＝3択。**遂行できない選択肢も選べる**（engine は拒否しない＝人間が詰まない/CPUが無限ループしない）。
  廃棄置き場からの獲得は通常の「獲得」＝獲得時能力が誘発する（香辛料の+2財源など）。
- **貨物船**＝**脇に置いたときだけ持続になる**（1枚も置かなければクリンナップで捨て札）。獲得は最初の1枚でなくてよい。
- **研究**＝銅貨($0)を廃棄すると脇置き0枚＝持続にならない（最も踏みやすい分岐）。
- **技術革新**＝2022エラッタで「最初に獲得したアクション」→「そのターン獲得したアクションのうち任意の1枚（ターン1回）」。
  **使わなければ権利は消費しない**。／**探査**＝2022エラッタで「購入していない」→「**その購入フェイズ**に1枚も獲得していない」。
- **艦隊**＝ゲーム終了後、艦隊持ちが**通常の手番順で1周だけ**追加ターン（**終わらせた人の次から**＝本人が持っていれば最後）。
  その後は前哨地/使節団の追加ターンは一切起きない。
- **山砦**＝2022エラッタで「もう一度 play」→「**再演（replay）**」＝玉座の2回目と同じ扱い（自己移動は stop-moving で失敗）。
- **彫刻家**＝手札に獲得。**遊牧民の野営地も手札に入る**（獲得置換の競合＝獲得者が選ぶ／RGG明記）→ `triggerOnGain` の
  nomad_camp 句に `dest !== 'hand'` を追加した（既存挙動の小変更）。

### 検証
- `test/renaissance.test.js` **新設290件**（36スイート目）／`test/renaissance-ui.test.js` **新設62件**（37スイート目）。
- `invariants` に**ルネサンス節**（全20プロジェクトのペア＋全プール混成 fuzz＋**資本主義×全プール混成**）＝**不変条件 7→8件**。
  出荷セット検証に `renaissance` / `renaissance-projects` / `random-renaissance` を追加。ZONES に `cargo` を追加。
- **npm test 全37スイート緑（exit 0・整合性 3149→3364）**／`verify:e2e` 9/9（**webp 371枚すべて200**）。
- **CPUソーク 108戦（出荷3セット×2〜4人×全難易度）＝完走108・膠着0・例外0・保存則違反0**（プロジェクト購入201回・資本主義4戦）。

### 【次にやること】敵対レビューの確定バグ修正 → push（ユーザー確認）
- **多エージェント敵対レビュー（5観点＝ルール忠実性/プロジェクト/保存則・マスク/CPU非ループ/資本主義リファクタの退行）を実施中**。
  確定 finding を修正して回帰テストを足す → **ユーザー確認の上で** `git push`（`sw.js` v49 が本番に出る）。
- その後の候補：**ルネサンスの絵（webp）回収**（王国25＋プロジェクト20＋アーティファクト5＝50枚。現在は枠＋文字）／
  冒険イベント20種の絵／**発売順の未着手拡張**（夜想曲/移動動物園/同盟/略奪/日の出づる国）。

### 注意（次セッションが知らないと事故る・ルネサンス固有）
- **新しく「公開する」効果を書くときは `reveal(state, seat, cards, note)` を通す**（パトロンが自動で効く）。
  「公開ではない表示」（捨てる/獲得の可視化）は `{ notReveal: true }` を付ける。
- **新しく「財宝か」を見るときは `isTreasureFor(state, id)` を使う**（`DOM.isType(id,'treasure')` を直接書かない）。
  例外＝**得点計算**（ターン中ではないので静的判定）。
- **新しいプロジェクトの効果は `hasMyProject(state, pi, id)` で判定する**（`state.projects` に入っているだけでは効かない＝
  そのプレイヤーがキューブを置いたかどうか）。
- **`p.cargo`（貨物船の脇置き）は物理カード**＝`allCards` と invariants の ZONES に入れる。`p.villagers` / `p.sinisterPlot` /
  `state.artifacts` / `p.projects` は**非カード**＝tally に混ぜない。
- **ターン開始時の対話は `t.startQueue` に push する**（`state.pending` を直接立てない）。ピアッツァだけは「カードをプレイ
  する」ので pending を直接立て得る＝`resolveDurationStartEffects` 末尾で `if (!state.pending) popStartQueue(state)` にしてある。
- **山砦（citadel）は PLAY_ACTION／ピアッツァ／技術革新 の3経路のみ**で発火（家臣/伝令官/ゴーレム/命令 経由では発火しない
  ＝チャンピオン/教師トークンと同型の**許容簡略化**。出荷セット＝ルネサンス単独では到達しない）。
- **星図（star_chart）はシャッフル中に対話を挟めない**ので**最良の札を自動で選ぶ**（へそくり `stashPlacement` と同型の許容簡略化）。
- **角笛（horn）の「山札の上に置く」も自動**（城壁のある村/宝物庫の自動返却と同じ扱い＝許容簡略化）。

---

## 0-21. 横型ランドスケープ 第3弾＝**冒険イベント20種**（AE0〜AE4 全完了・**push済 `aa0c185`**・2026-07-12）

### push＝完了（2026-07-12・`eacda63..aa0c185`）＝本番反映を実機確認済み
- **GitHub Pages**（Deploy ワークフロー success）：`sw.js` **v48**／`js/cards.js` に `adventures-events`・`EVENTS_ADVENTURES`／`js/engine.js` に `treasuresLocked`・`inheritedEstate`・`EVENT_TOKEN_PILE`／`js/cpu.js` に `noBuyCards`・`bestEventBuy`／イベント webp（`inheritance`/`ferry` 等）すべて 200。
- **Render（オンライン）**：`GET /status` = `{"persist":true,...}`。push で自動再デプロイ（サーバは `DOM.CARD_SETS`/`eventsForSet` から `adventures-events` を自動受理＝サーバ側コード変更なし）。


帝国イベント13種（§0-20・push済）に続き、**冒険（Adventures）イベント20種**を実装＝**冒険拡張が「縦型38枚＋横型20枚」で完全に本番実プレイ可能**になる。新セット **`adventures-events`**（冒険固定10王国＋イベント2枚抽選）。`sw.js` v47→**v48**。**イベント webp 20種 生成済み**（枠＋文字・絵は未回収＝暗い板）。

### 実装した20種（負債は無し＝コインのみ。トークン中心）
- **軽量**：alms(施し・$0)／borrow(借入・$0)／quest(探索・$0)／trade(交易・$5)／bonfire(焚火・$3)／raid(奇襲・$5)／ball(舞踏会・$5)／scouting_party(偵察隊・$2)／pilgrimage(巡礼・$4)／expedition(探検・$3)／travelling_fair(移動遊園地・$2)
- **山トークン6種**：lost_arts(+1アクション)／training(+$1)／pathfinding(+1カード)／seaway(+1購入・$4以下アクション獲得つき)／**ferry(-$2コストトークン＝新種別)**／**plan(廃棄トークン＝新種別)**
- **重量3種**：save(保存＝先引きの「後」に手札へ戻す)／mission(使節団＝追加ターン・3連続不可・カード購入不可)／**inheritance(相続＝屋敷が命令アクションになる)**

### 【重要】公式ルールの裏取りで判明した「既存エンジンの穴」＝全体ルールを2つ修正
1. **「一度でも購入したら、そのターンはもう財宝を出せない」（基本ルール）を実装していなかった** → `t.treasuresLocked`（`BUY`／`BUY_EVENT` で立てる）。これが無いと **施し（場に財宝が無ければ$4以下を獲得）を先に買ってから財宝を出す**抜け道ができる。**ロックは「購入フェイズ単位」**＝`END_ACTION_PHASE` で解除する（ヴィラで購入フェイズに入り直したら財宝を出し直せる＝公式。敵対レビューで踏んだ）。**闇市場はアクションフェイズなので立てない**。
2. **使者（messenger）の「そのターン最初の購入」にイベント購入が数えられていなかった** → `BUY_EVENT` でも `t.buysMade++`。

### 公式裁定（研究5体＋矛盾裁定1体で確定。`docs/research/landscape_cards.md` の記述より**新しい**）
- **焚火＝場の「銅貨」限定2枚まで**（2022エラッタ。旧＝場の任意カード＝無限コンボで廃止）。**立案＝「獲得したとき」**（2022エラッタ。購入以外の獲得でも／相手のターンの獲得でも発火）。※RGG がホストする Adventures ルールブックPDF（2021年版）は**2022エラッタ前**＝そのまま読むと必ず間違える。
- **施し/借入/保存/巡礼/使節団は1ターンに1回しか買えない**（"You can only buy this once per turn."＝**2回目の購入自体を拒否**＝購入権を無駄にしない）。**相続は1ゲーム1回**。
- **奇襲はアタックではない**（堀で防げない）。-1カード/-$1/旅トークンは各1個・**非スタック**。**-$1は「次にコインを得るとき$1少ない」**（手持ちを即減らさない＝`applyCoinPenalty` を購入フェイズでも変換）。
- **相続の脇置きカードは「獲得」ではないが、得点計算では自分のデッキに数える**（公式）＝`p.inherited`（新ゾーン・`allCards` と保存則 tally に入る・**サプライから1枚抜く**＝3山終了に影響）。

### 敵対レビュー（多エージェント4観点＝ルール忠実性/保存則・状態整合/CPU非ループ/既存機能への退行。各finding を node 再現）＝**確定9件→全修正・回帰テスト付き（F1〜F9）**
1. **[high] ヴィラ×財宝ロック（出荷済みセットの退行）**：`empires`/`empires-events` で **ヴィラを買った瞬間そのターン財宝を1枚も出せなくなる**（購入フェイズに入り直しても解除されない）→ `END_ACTION_PHASE` で解除。
2. **[high] 使節団の追加ターン×闇市場＝CPU無限ループ**：engine は `BLACK_MARKET_BUY` を拒否するのに CPU が買い続ける → CPU/UI に `noBuyCards` ガード。
3. **[med] 偵察隊の「見た山札の上5枚」がオンラインで相手に丸見え**（私的看破なのに `maskStateFor` の対象外）→ マスク対象に追加。
4. **[med] 保存の脇置き札の正体が `turn.savedCard` で相手に漏れる**（`setAside` は伏せているのに）→ 相手席には `'back'`。
5. **[med] 山トークンが分割山の下段に置かれると孤児化して永久に発火しない**（帝国の徴税で踏んだのと同型の再発）→ READ/WRITE 両方に `pileKeyOf`＋候補から下段を除外。
6. **[low] 移動遊園地×ヴィラ**（獲得先が捨て札→手札に変わる札）で山札上置きが黙って不発 → 実在ゾーンを探して移す。
7. **[low] 使者×イベント購入**（上記の全体ルール修正2）。
8. **[low] 門下生が相続の屋敷を対象にできない**（`adventures-events` の固定王国＝peasant があるので実プレイで踏む）→ `disciple` の対象述語に `inheritedEstate` を追加。
9. **[low] CPU の巡礼購入条件が反転**（買うと必ず旅トークンが裏返って効果ゼロ）→ 反転を修正。
- **副産物＝既存バグ1件**：CPU `case 'university'` に `NON_SUPPLY`/`splitBlocked` の除外が無く、ロック中の分割山下段（アヴァント等）を提案し続けて**無限ループ**（全プール混成 fuzz で到達・HEAD でも再現）→ 修正。

### 検証
- `test/events.test.js` 69→**149件**（冒険20種の裁定・1ターン1回/1ゲーム1回・財宝ロック・敵対レビュー回帰F1〜F9・CPU終端保証20種・CPUソーク12戦[全完走・イベント購入あり]）。`test/adventures-ui.test.js` 40→**67件**（全15 pending のモーダル・イベント帯・使節団の購入禁止・財宝ロック・相続の屋敷が光る・セット選択）。`test/empires-ui.test.js` は一覧の横型枚数を 34→54 に更新。
- `invariants` に **冒険イベント節（全20種ペア＋全部乗せ＋全プール混成fuzz＋帝国イベントとの混成）** を追加＝**不変条件 6→7件**（相続の脇置きはカード＝tally に数える／山トークン・旅/-1カード/-$1 は非カード）。出荷セット検証に `adventures-events` を追加。
- **npm test 全35スイート緑（exit 0・整合性3149・不変条件7・イベント149・冒険UI67）**／`verify:e2e` 9/9（webp 346/0・例外なし）。

### 【次にやること】push（ユーザー確認）→ その後の拡張
- **push**：`adventures-events` が本番 Pages/Render に出る（`sw.js` v48）。**ユーザー確認の上で** `git push`。
- その後の候補：**発売順の未着手拡張**（夜想曲/ルネサンス/移動動物園/同盟/略奪/日の出づる国＝段階1すら未着手）／冒険イベントの**絵（webp）回収**（現在は枠＋文字のみ）。

### 注意（次セッションが知らないと事故る・冒険イベント固有）
- **財宝ロックは「購入フェイズ単位」**（`t.treasuresLocked` は `END_ACTION_PHASE` で解除）。新しく「購入」を作るときは `treasuresLocked` を立てる／新しく購入フェイズへ入る経路を作るときは解除すること。**闇市場（アクションフェイズ）では立てない**。
- **1ターン1回/1ゲーム1回のイベントは `DOM.engine.canBuyEvent` が正本**（engine拒否・CPU非提案・UIボタン無効の3面が同じ述語を見る）。
- **山トークンの山キーは `pileKeyOf` で正規化**（分割山は上段キー）。**READ（`applyPileTokens`／`cardCost` の渡し船）/WRITE（`EVENT_TOKEN_PILE`／`SEAWAY_GAIN`／`TEACHER_PILE`）の両方**に通し、候補（`actionSupplyPiles`）から下段を除くこと。
- **相続（inheritance）の許容簡略化（意図的）**：(1)**持続カードは対象外**（船長/大君主/王子と同じ＝屋敷が持続として場に残る追跡が要るため。公式は対象にできる＝`adventures-events` では amulet/caravan_guard が候補から落ちる）。(2)屋敷が「アクション」として見えるのは **PLAY_ACTION・門下生・CPU・UI の4経路のみ**（玉座の間/家臣/王子/ゴーレム/伝令官 等の `DOM.isType(card,'action')` ゲートは屋敷を弾く）。いずれも保存則OK・非ループ。
- **`p.inherited` はサプライから抜いた物理カード**＝保存則 tally に数える（`invariants` の ZONES に追加済み）。`allCards` にも入る（庭園/品評会/博物館等に数える＝公式）が **VPは屋敷のまま**（脇のアクションは0VP）。
- **探索（quest）は条件を満たさない選択肢も選べる**（公式：呪い1枚しかなくても「呪い2枚」を選べて、その1枚を捨てて金貨は得られない）＝engine は忠実に受理する。UIは「（金貨は得られません）」と明示して事故を防ぐ（選択肢は消さない）。


最終更新: 2026-07-13 / branch `main`（最新は `git log` で確認）。**§0-22＝新拡張ルネサンス（Renaissance）全50枚＝王国25＋プロジェクト20＋アーティファクト5 を R1〜R6 で全実装（未push・`sw.js` v49・新セット `renaissance`／`renaissance-projects`／`random-renaissance`）。既存エンジンに横断リファクタ2件（`reveal()` に公開フック集約＝パトロン／財宝判定を `isTreasureFor` に集約69箇所＝資本主義）。npm test 全37スイート緑・CPUソーク108戦クリーン。次＝敵対レビューの確定バグ修正→push。**
（以下は §0-21 までの旧サマリ）
**帝国（Empires）は 縦型36枚＋E8命令＋ランドマーク21＋イベント13 まで push済（§0-16〜§0-20・`sw.js` v47・本番反映確認済）。**§0-21＝横型ランドスケープ第3弾＝**冒険イベント20種は AE0〜AE4 全完了・push済（`aa0c185`・`sw.js` v48・本番反映確認済）**（新セット `adventures-events`＝冒険固定10＋イベント2抽選）＝これで**冒険拡張が「縦型38＋横型20」で完全に実プレイ可能**。この作業で**既存エンジンの全体ルールの穴を2つ修正**（①購入したらそのターンは財宝を出せない＝`t.treasuresLocked`／②使者の「最初の購入」にイベント購入を数える）。敵対レビュー4観点で**確定9件＋既存バグ1件を修正**（ヴィラ×財宝ロックの退行[high]・使節団×闇市場のCPU無限ループ[high]・偵察隊/保存のオンライン情報漏洩 等）。**次にやること＝push（ユーザー確認）**。以後の拡張も 完成→CARD_SET昇格→全テスト緑→**都度ユーザー確認の上で** push（勝手に push しない）。
公開: GitHub Pages https://ankake-web.github.io/dominion/ （クライアント）＋ Render（オンライン対戦サーバ）。
**新セッションは まず `npm test` を実行し 35スイート・オールグリーン（exit 0・整合性3149件・不変条件7・帝国269件＋UI75件・ランドマーク80件・横型イベント149件（events＝帝国13＋冒険20）・冒険59件＋UI67件・暗黒時代87件＋UI57件・新プロモ165件＋UI22件・繁栄69件・異郷83件＋UI44件・収穫祭107件・ギルド81件＋UI25件・CPU序列 強vs弱100/強vs普通64/普通vs弱95）を確認**してから着手すること。
実ブラウザ検証（puppeteer・手動）: `npm run verify:e2e`（通しプレイスモーク＝9/9・webp346/0）／`npm run verify:visual`（320〜768pxはみ出し検査）。

---

## 0-20. 横型ランドスケープ 第2弾＝**帝国イベント13種**（EV0〜EV3 全完了・**push済**・2026-07-11）

ランドマーク（§0-19・push済）に続き、**帝国イベント13種**（ユーザー決定＝負債/VPトークン既実装で相性最高・帝国拡張の仕上げ）を **EV0〜EV3 まで全実装完了＝push済（`d1a7b34`・本番 v47 反映確認済）**。正本＝`docs/research/landscape_cards.md` §2/§3/§4＋`landscape_gaps.md`。ランドマークと違い**イベントは「買う」**＝新機構 `BUY_EVENT`（購入ディスパッチャ）＋CPUのイベント購入評価 `bestEventBuy`＋UIの購入ボタン。**これで帝国拡張（縦型36＋E8＋ランドマーク21＋イベント13）は完全に本番実プレイ可能**。

### 確定した方針（研究＋PROGRESS §0-18 で裁定済み）
- **13種**＝advance/annex/banquet/conquest/delve/dominate/donate/ritual/salt_the_earth/tax/triumph/wedding＋**windfall**（研究データに欠落＝$5・山札と捨て札が両方空なら金貨3枚／手札・場は判定外）。
- **`BUY_EVENT`**：購入フェイズで発火・**購入権を1消費・イベント自体は獲得しない・同じイベントを1ターンに複数回買える**（Delve等）・負債コストは `p.debt += debt`。**負債>0 の間はカードもイベントも購入不可**（`BUY` と同じ拒否を入れる）。**返済は購入権を消費しない**（既存 `REPAY_DEBT`）。`PLAYER_ACTIONS` に登録必須。
- **横型は `DOM.LANDSCAPES` が正本**（`DOM.CARDS` に入れない＝整合性テストに混ざらない）。イベントは `kind:'event'`・cost/debt あり。カタログ文は**現行エラッタ**（tax/basilica等の「購入時→購入フェイズの獲得時」）。
- **進め方＝帝国方式**（効果をバッチ実装→**最後に CARD_SET `empires-events` 昇格**）。実装中は `state.events=[id]` を直接セットしてテスト。新pendingは4点セット＋終端保証。**「≤$N/相手に獲得」系は engine述語とCPU候補の両側に `!NON_SUPPLY`・`!splitLocked`・`costIsPlainCoin`**。
- **カウンタ新設**（`freshTurn`）：Conquest＝今ターン獲得した銀貨数／Triumph＝今ターン獲得したカード数（`gain`/`triggerOnGain` でインクリメント・`actionsGainedThisTurn` と同型）。
- **重量順**：T3/T4＝delve/wedding/dominate/windfall/salt_the_earth/banquet/conquest/triumph/advance/ritual（先）→ T1＝tax(`state.pileDebt`)/donate(次ターン全掃討)/annex(捨て札選択＋reshuffle)（後）。

### 進捗
- **✅ EV0＝共通基盤（完了・未push）**：13イベントを `DOM.LANDSCAPES`（`kind:'event'`）＋`DOM.EVENTS_EMPIRES`＋`DOM.eventsForSet`。engine に `state.events` スロット（landmarks 同型・clone で mask 保持）＋`hasEvent`＋**`BUY_EVENT` reducer**（購入権1消費・イベント自体は獲得しない・複数回可・負債>0拒否・コスト軽減を受けない・負債コストは `p.debt+=`）＋`applyEventEffect` ディスパッチャ。`PLAYER_ACTIONS` に登録。
- **✅ EV1＝簡単イベント10種（完了・未push）**：delve/wedding/dominate/windfall/conquest/triumph（pending無し・カウンタは既存 `t.gainedThisTurn` を流用＝新カウンタ不要）＋salt_the_earth/banquet/advance/ritual（新pending4種＝4点セット完備：engine reducer[SALT_TRASH/BANQUET_GAIN/ADVANCE_TRASH/ADVANCE_GAIN/RITUAL_TRASH]＋PLAYER_ACTIONS＋CPU decidePending[終端保証]＋UI viewPendingModal）。CPU用 `firstGainable`/`plainCoin` を新設（engine の canGain と食い違わない獲得候補選び）。UI＝盤面イベント帯（買う横型・購入ボタン）＋拡大オーバーレイの種別/コスト表示。
- **検証**：`test/events.test.js` 新設**34件**（BUY_EVENT基盤・各イベント裁定・新pending・CPU終端）を package.json 登録（**35スイート目**）。`test/empires-ui.test.js` 60→**68件**（イベント帯＋pendingモーダル）。**全35スイート緑（exit 0）**。
- **注意**：イベントは「カード」でないのでコスト軽減（橋/街道）を受けず、購入時トリガー（商人ギルド/値切り屋/過払い）も発動しない。salt はサプライから直接廃棄（Tomb 発火のため `trashCard(state,pi,card)` を通す・保存則OK）。conquest/triumph の「今ターン獲得数」は `t.gainedThisTurn`（手番プレイヤーの獲得id列）で足りる。

### ✅ EV2＝重量イベント3種（完了・`52f7e7f`）
- **tax**：新 `state.pileDebt`（山上の負債トークン・公開・非カード＝保存則対象外・`maskStateFor` で残る）。準備で各サプライ山に負債1（**分割山は1山＝上段キーにのみ1**・混合山 castles/knights は numeric キーに1・非サプライ除外）。**自分の購入フェイズにサプライから獲得したとき、その山の負債を全部受け取る**（`triggerOnGain` で `gainWasBuyPhase`＆手番プレイヤー・**購入フェイズの非購入獲得＝delve/conquest の銀貨等でも取る**・アクションフェイズ/他人ターンは取らない）。Tax購入で山1つに+2（`tax_pile` pending）。UI に山負債バッジ `.pile-debt`（🟠）。**山キーの正規化 `pileKeyOf`**（分割山下段→上段・混合山→numericキー）を READ(triggerOnGain)/WRITE(TAX_PILE) の両方で通す。
- **donate**（負債8）：次の自分のターン開始時に「**最初に**」（持続効果より前）＝`resolveDurationStartEffects` 冒頭で `p.donateNext` を見て デッキ＋捨て札を全部手札に集約→`donate_trash` pending（任意枚数廃棄）→残りをシャッフルして5枚引く→**その後 `resolveDurationStartEffects` を再入**して通常の開始時効果を続行。
- **annex**（負債8）：`annex_keep` pending＝捨て札から最大5枚を残し、残りを山札に混ぜてシャッフル→公領獲得（捨て札/公領が空でも実行）。
- 新pending3種は4点セット完備。現行エラッタを研究エージェントで裏取り。`test/events.test.js` 34→69件。

### ✅ EV3＝CARD_SET昇格（完了・`39d3129`・`sw.js` v47）
- **CARD_SET `empires-events`**（帝国固定10＋`eventsFrom:'empires'` で2抽選・`kind:'standard'`）。ui(startLocal/restartLocal)・server(startGame)・NEW_GAME で events を landmarks と同型にサーバ権威で1度だけ確定・全席共有・再戦引き継ぎ。UI picker の「拡張」タイルに出る。
- **CPU `bestEventBuy`**：カード買いと比較してイベントを買う。**返すのは affordable かつ 負債0 のみ**＝BUY_EVENT が拒否しない＝無限ループ防止。負債イベントは購入後 debt>0 の返済分岐で1ターン1回に有界。dominate/conquest/wedding/annex/triumph/salt/donate/delve を評価（ritual/banquet/windfall/tax は買わない）。
- **敵対レビュー（多エージェント4観点＝ルール忠実性/保存則/CPU非ループ/UI・オンライン。各finding を node 再現）＝確定バグ3件→全修正・回帰テスト付き**：
  1. **[med] salt_the_earth × 城の混合山**＝プレースホルダ 'castles' を trash に積み `state.castles` を減らさず保存則違反（invariants soak が捕捉）→ 一番上の実カードを廃棄（`state.castles.shift()`＋`supply.castles` 同期）。
  2. **[low-fidelity] 分割山 × tax**＝上下段の両 supply キーに負債1ずつ乗る（公式は1山=1個）→ seeding で下段（`SPLIT_TOP[id]`）をスキップ＋`pileKeyOf` で下段→上段写像。
  3. **[low] TAX_PILE reducer が下段選択を正規化せず負債が孤児化**（2観点が独立検出）→ `pileKeyOf` で正規化＋UI/CPU 候補から分割山下段を除外。
- **CPUソーク**＝empires-events 40戦全完走・108回イベント購入（別レビューでは462戦 livelock 0・全8種発火）。invariants に empires-events soak（全13種ペア＋全部乗せ＋混成fuzz）で不変条件 5→6件。
- **イベント webp 13種を生成**（枠＋文字・絵は未回収＝暗い板／`build-landscape.js` の event スキン）。カード一覧に「イベント（帝国・横型）」群を追加。`test/empires-ui.test.js` 68→75件。**全35スイート緑（exit 0・整合性3148・不変条件6・events 69・帝国UI 75）**・`verify:e2e` 9/9（webp 346/0）。

### push＝完了（2026-07-11・`3cbe91b..d1a7b34`）＝本番反映を実機確認済み
- **GitHub Pages**：`sw.js` v47／`js/cards.js` に `empires-events`／`js/engine.js` に `BUY_EVENT`・`pileDebt`／イベント webp（`tax`/`donate`/`annex`/`delve`/`conquest` … すべて 200）を実機確認。Deploy ワークフロー success。
- **Render（オンライン）**：push で自動再デプロイ（サーバは `DOM.CARD_SETS`/`eventsForSet` から `empires-events` を自動受理＝サーバ側コード変更は §0-20 の startGame 配線ぶんが再デプロイで反映）。

### 【次にやること】次の拡張候補（着手前に `docs/adding-cards.md` 必読）
- **冒険のイベント20種**（横型枠は §0-18 対応済・カタログ研究は `docs/research/landscape_cards.md`・トークン中心/負債なし＝相性は別）。BUY_EVENT 基盤は帝国イベントで完成済みなので流用できる。
- **発売順の未着手拡張**（段階1すら未着手＝画像・カタログとも無し）：夜想曲/ルネサンス/移動動物園/同盟/略奪/日の出づる国。

### 注意（次セッションが知らないと事故る・イベント固有）
- **イベントは「カード」でない**＝コスト軽減（橋/街道）を受けず、購入時トリガー（商人ギルド/値切り屋/過払い）も発動しない。**負債>0 の間はカードもイベントも購入不可**。返済は購入権を消費しない。横型は `DOM.LANDSCAPES` が正本（`DOM.CARDS` に無い＝整合性テストに混ざらない）。
- **徴税の山キーは `pileKeyOf` で正規化**（分割山下段→上段・混合山→numericキー）。**READ(triggerOnGain の tax ブロック)/WRITE(TAX_PILE reducer) の両方で通すこと**（片方だけだと負債が孤児化＝敵対レビューで踏んだ）。準備 seeding は分割山下段をスキップ（`!SPLIT_TOP[id]`）。
- **`state.pileDebt`／`p.donateNext` は非カード＝保存則 tally に混ぜない**（`state.pileVP` と同型）。`triggerOnGain` の tax は `if (state.pileDebt && …)`、donate は `if (p.donateNext)`、`pileDebtBadge` は `(state.pileDebt && …)` で旧スナップショット（pre-EV2）でも壊れないようガード済み。
- **donate は「次ターン開始時に最初に」**＝`resolveDurationStartEffects` 冒頭で処理し、`DONATE_TRASH` 末尾で同関数を再入して残りの開始時効果を続行する（持続ドローより donate が先＝公式）。
- **salt はサプライから直接廃棄**するが `trashCard(state,pi,card)` を通す（Tomb 発火・保存則OK）。**城の混合山を salt する場合は一番上の実カードを廃棄**（プレースホルダ 'castles' を積まない）。

---

## 0-19. 横型ランドスケープ 第1弾＝帝国ランドマーク21種の **engine 実装 完了**（2026-07-11・WIP・未push・`sw.js` v45）

**§0-18 の土台（横型枠パイプライン・研究・カタログ21枚）の上に engine を全実装**。新セット `empires-landmarks`（帝国固定10王国＋ランドマーク2枚抽選）を足し、**ランドマークが実プレイに影響する**（得点・獲得/廃棄トリガーが変わる）。**カタログ/webp変更なし**（`DOM.LANDSCAPES` は §0-18 で追加済み）。**残タスクは webp 回収のみ**（engine は完成・絵が無くても盤面は名前＋説明文で成立）。

### 実装（段0〜5）
- **段0＝共通基盤**：`state.landmarks=[id]`（対局中不変・公開・maskで残る）／`state.landmarkVP={id:個数}`（ランドマーク上の**有限リザーブ**6×人数・非カード＝保存則tally対象外）／`state.landmarkStash`（水道橋/汚された神殿の一時VP）／`state.obeliskPile`。`createInitialState` で準備（6×人数のリザーブ・水道橋=銀貨/金貨山に`pileVP`8ずつ・汚された神殿=集合以外の素のアクション山に2ずつ・オベリスク=素のアクション山を無作為選択）。ヘルパ `hasLandmark`／`takeLandmarkVP(state,pi,id,per)`。`maskStateFor` は clone でこれらを公開のまま残す（変更不要）。
- **段1＝得点計算専用11種**：`landmarkScoreForCards(state, cards, seat)` を新設し `scoreGame` から呼ぶ（**vpOf は state を持たないので scoreGame 側に加点**）。bandit_fort/fountain/keep/museum/orchard/palace/wall/wolf_den/tower/triumphal_arch/obelisk。**得点は負になり得る＝下限クランプ禁止**。keep=全員のデッキを同時比較（同数は各自+5）。tower=`isFromEmptySupplyPile`（分割山は上下とも空・混合山=廃墟/騎士/城は集約キー・非サプライ除外・勝利点除外）。obelisk=**分割山を選んだら両半分を数える**（敵対レビュー修正）。
- **段2＝簡単トリガー8種**：tomb（`trashCard` の push 直後・廃棄した本人・支配退避では非発火・城塞が戻っても発火）／battlefield・labyrinth・basilica・colonnade・aqueduct・defiled_shrine（`triggerOnGain` 末尾のランドマークブロック）／baths（`endBuyTail` 冒頭・1ターン1回）。**購入フェイズ判定は「獲得時点」のフェイズ（`gainWasBuyPhase`）**＝ヴィラの phase 変更に負けない（敵対レビュー修正）。
- **段3＝闘技場 arena（新pending・4点セット）**：`maybeArena`（END_ACTION_PHASE＝購入フェイズ開始・`t.arenaFired` で1ターン1回・ただし**ヴィラで購入→アクションに戻ると再武装**＝敵対レビュー修正）＋`ARENA_RESOLVE`（手札アクション1枚を**捨て札へ**[廃棄でない]→+2VP・任意）。CPU=購入フェイズの手札アクション（財宝兼を避け）を捨てる。UI=modalSingleHand。
- **段4＝峠 mountain_pass（新pending・逐次入札）**：最初の属州獲得で `state.mountainPassArmed`→endBuyTail で `startMountainPassBid`（獲得者の左隣から始め獲得者が最後・最大40負債）。`MOUNTAIN_PASS_BID` が逐次に入札を集約し、最高額（同額は先着）が **+8VP＋同額の負債**。完了後 `endBuyTailTravellers` へ合流（baths/hermit の二重発火なし）。1ゲーム1回（`mountainPassDone`）。CPU=手番数で価値を見て正直入札（超えないなら0）。UI=modalAmount(0..40)。
- **段5＝セット選択**：`DOM.landmarksForSet(setId)`／`DOM.pickLandmarks(n,pool)` を cards.js に新設。CARD_SET に **`empires-landmarks`**（`kind:'standard'`・`landmarksFrom:'empires'`）。NEW_GAME→`opts.landmarks`→`createInitialState`。ui.js の startLocal/restartLocal と server の startGame で landmarks をサーバ権威/ローカルで1度だけ確定して共有。**盤面にランドマーク帯**（名前・残VP・溜VP・オベリスク対象。`viewBoard` の `landscapeBlock`＝既存の supply-section/mats クラス再利用）。

### 敵対レビュー（多エージェント6次元→各finding node再現で確定）＝**確定6件（偽陽性0）→全修正・回帰テスト付き**
- **[medium] オベリスク×分割山の得点漏れ**（2次元で二重報告）：obeliskPile が settlers/catapult（分割山上段）のとき、同一山の相方（bustling_village/rocks）由来カードを数え落とし最終スコアが過小＝**勝者が変わり得る**。→ `landmarkScoreForCards` の obelisk 句で `SPLIT_BOTTOM[op]||SPLIT_TOP[op]` の相方も数える。
- **[medium] ヴィラ獲得のフェイズ変更が公会堂/列柱を握りつぶす**：購入フェイズにヴィラを獲得すると villa の on-gain が phase を 'buy'→'action' に変え、その後のランドマークブロックの `inBuy` 判定が偽になり **basilica/colonnade/汚された神殿(呪い) が発火しない**（過小得点）。→ triggerOnGain 冒頭で `gainWasBuyPhase` を捕まえ、それを使う。
- **[low] 闘技場がヴィラ再入場で再発火しない**：公式は購入フェイズ開始のたび。→ villa の action 復帰で `arenaFired=false` に再武装。
- **[low] CPU の tower 近似が分割山/混合山で engine 実得点と乖離**／**[low] CPU が keep を完全省略**：→ CPU `winsIfEnds` を近似 `landmarkVpApprox` から **engine 公開の `landmarkScoreForCards` 呼び出し**に置換（オベリスク分割山・塔の空山写像・砦の全員比較を engine と完全一致で見積る）。`DOM.engine.landmarkScoreForCards` を公開。

### 検証
- `test/landmarks.test.js` **新設80件**（共通基盤・得点11種[負得点含む]・トリガー8種・闘技場/峠の全裁定・セット選択・後方互換[landmarksフィールド無しの旧スナップショット]・敵対レビュー回帰6件・CPUソーク[膠着0/例外0・峠pending到達・闘技場の強制終端]）を package.json 登録（**34スイート目**）。`test/empires-ui.test.js` を **45→54件**（ランドマーク盤面帯・闘技場/峠モーダル・オベリスク表示・empires-landmarks picker）。
- `invariants` の出荷セット検証に **empires-landmarks（landmarks付き）** を追加＋新節「ランドマーク（全21種ペア＋全プール混成にランドマーク付与）」＝**landmarkVP/pileVP/landmarkStash は非カード＝保存則の tally に混ざらない**ことと、arena/mountain_pass の新pendingが CPU で終端することを確認（不変条件 4→**5件**）。
- **npm test 全34スイート緑（exit 0・整合性3147・CPU序列 100/64/95 維持）**／`verify:e2e` 9/9（webp 346/0・例外なし）。

### ✅ 絵(webp)回収＋絵表示 完了（2026-07-11・追記）→ 次は push（ユーザー確認）
- **絵の回収**：ユーザーが `images/` に21枚投入 → 3グループ×7をタイムスタンプで分割し、多エージェント視覚判別（各グループ別エージェント・全21候補から bijection）で**全21種を1対1確定（全 high confidence・`DOM.LANDMARKS_EMPIRES` と完全一致）** → `asset/art/<id>.png` 回収 → `node tools/build-landscape.js`（`CARDS_ONLY` で21種）で webp 生成。枠＋絵＋テキスト正常（峠/水道橋/狼の巣を目視確認）。
- **絵の表示**：`js/ui.js` に横型専用の `landmarkMini`／拡大 `viewLandmarkZoom`／`openLandmarkZoom` を新設（横型は `DOM.CARDS` に無く `cardEl`/`viewSheet` が使えないので別経路）。**盤面ランドマーク帯にアートのサムネ＋タップ拡大オーバーレイ**（`.landmark-thumb`）、**カード一覧に「ランドマーク（帝国・横型）」群**（全21枚）。render にオーバーレイ hook＋scroll-lock。`sw.js` v45→**v46**。
- **検証**：`test/empires-ui.test.js` を54→**60件**（サムネ／拡大／一覧の3経路）。**全34スイート緑（exit 0）**・`verify:e2e` 9/9（webp 346/0）・`verify:visual` 全幅はみ出し0・実ブラウザで拡大の `aqueduct.webp` が naturalWidth=1152 でロード確認・webp404ゼロ。一覧サムネは `loading=lazy`（遅延読込＝正常）。
- **push＝完了（2026-07-11・`13a4401`）**：`cb89e2a..13a4401` を push（枠パイプライン＝`c10cf47`／カタログ＝`4ef4ca8`／engine＝`c9f4863`／webp＋絵表示＝`13a4401` を一括）。**GitHub Pages デプロイ success・本番 `sw.js` v46・`aqueduct/wolf_den/mountain_pass/obelisk` の webp すべて 200** を実機確認。Render は push で自動再デプロイ（サーバは `DOM.CARD_SETS`/`landmarksForSet` から empires-landmarks を自動受理＝サーバ側変更は §0-19 の startGame 配線ぶんが再デプロイで反映）。

### （旧）【次にやること】絵(webp)の回収 → push（ユーザー確認）
1. **絵**：ユーザーがチャッピーでランドマーク21枚生成中（前セッションで3バッチの指示文を出した）。`C:\Users\b1242\Downloads` に来たら判別して `asset/art/<id>.png` に回収 → **`node tools/build-landscape.js`（縦型 build-cards.js とは別スクリプト）** で webp 生成 → 一覧/盤面の画像表示は今は名前＋説明文なので webp が無くても動くが、あれば `carddata`/`cards.html`/`ui.js` の別経路（`DOM.LANDSCAPES` 参照）で出す。`sw.js` は既に v45。※現時点で Downloads にあるのは 7/5 の旧・帝国縦カードバッチのみ＝ランドマークの絵は未着。
2. **push**：webp 回収後（or engine だけでも）**ユーザー確認の上で** `git push`。empires-landmarks が本番 Pages/Render に出る（サーバは `DOM.CARD_SETS`/`landmarksForSet` から自動で受理）。

### 注意（次セッションが知らないと事故る）
- **ランドマークのVPは3系統**：`state.landmarkVP`（ランドマーク上の有限リザーブ6×人数＝闘技場/公会堂/浴場/戦場/列柱/迷宮）／`state.pileVP`（山の上＝集合と共用・水道橋は銀貨/金貨山、汚された神殿は各アクション山）／`state.landmarkStash`（山→ランドマークへ移した一時VP＝水道橋/汚された神殿）。最終得点になるのは `p.vpTokens` に移った分だけ。
- **得点は負になり得る**（山賊の砦/壁/狼の巣）＝`landmarkScoreForCards` で下限クランプ禁止。**新しいランドマーク得点を足すなら `landmarkScoreForCards` に書けば CPU の終局読みも自動で一致**（CPU は `DOM.engine.landmarkScoreForCards` を呼ぶ）。
- **購入フェイズ依存のトリガー（basilica/colonnade/汚された神殿の呪い）は `gainWasBuyPhase`（獲得時点のフェイズ）を使う**＝ヴィラ等が途中で phase を変えても正しい。新しい「購入フェイズ限定」トリガーを足すときも同様に。
- **新pendingは4点セット必須**（engine reducer＋PLAYER_ACTIONS＋CPU decidePending＋UI viewPendingModal）＋終端保証。arena/mountain_pass が該当済み。
- **横型カードは `DOM.CARDS` に無い**ので整合性テスト（GAIN_ORDER網羅/POOL所属/3山終了/闇市場）に一切混ざらない。表示は `DOM.LANDSCAPES` を見る別経路。
- **イベント13種は未実装**（`BUY_EVENT`＋CPU購入AI＋負債経済連動が要る＝別の大仕事）。ランドマークだけ先行。

---

## 0-18. 横型ランドスケープ（イベント／ランドマーク）**着手：横型枠パイプライン＋研究＋カタログ21枚**（2026-07-10・進行中）

**第1弾＝帝国ランドマーク21種**（ユーザー決定）。ランドマークは「買わない」ので `BUY_EVENT` もCPUの購入判断も要らず、得点ルールを変えるだけ＝出荷単位として最もリスクが低い。

### 完了（`c10cf47` ＋本コミット）
- **横型枠パイプライン `tools/build-landscape.js`（新規）**。横型 master は存在しなかったが、**縦型 master が「丸角矩形＋一定断面の金ベベル」だけで出来ている**ことを利用し、**金レールの断面（`x=41..63, y=700` の23px 1次元プロファイル）を採取して任意サイズの丸角矩形／円に同じレールを描く**方式にした＝**枠のAI画像を新規生成せずに縦カードと同じ質感が出る**。
  - 出力 1152×768。イベント＝茶褐色＋コインメダル／ランドマーク＝深い青緑（コイン欄なし）。負債の六角トークン・2桁コスト・禁則処理（句読点を行頭に置かない）に対応。絵の窓は 620×543（縦横比1.14＝縦カードの窓と同じ＝既存の4:3素材の切れ方が揃う）。絵が無ければ暗い地の板を敷く。
  - `LANDSCAPE_PREVIEW=1` でサンプル3枚だけ描画（枠の目視確認）。`CARDS_ONLY` / `CARDS_OUT` は縦型と同じ。
- **研究（多エージェント・1枚ずつ敵対検証）** → `docs/research/landscape_cards.md`（54枚の公式データ＋機構分類＋重さティア）／`docs/research/landscape_gaps.md`（未確定事項の回答集）。**ランドマークは20ではなく21種**（依頼側の誤り）。和名2件訂正＝**basilica＝公会堂**（「バシリカ」は読み仮名）／**keep＝砦**（「天守」は誤り。`bandit_fort`＝山賊の砦 と別カード）。
- **`js/cards.js` に `DOM.LANDSCAPES`（帝国ランドマーク21）＋`DOM.LANDMARKS_EMPIRES`＋`DOM.GATHERING_CARDS`＋`DOM.isLandscape`**。**`DOM.CARDS` には入れない**＝GAIN_ORDER網羅・POOL所属・3山終了・闇市場デッキ に一切混ざらない（整合性3146・invariants ともに不変を確認）。

### 確定した公式ルール（`docs/research/landscape_gaps.md` が正本）
- **1対局に使う横型は 0〜2枚**（Events と Landmarks の**合算**で最大2）。**王国山は常に10のまま**＝`emptyPileCount`／3山終了に影響しない。若き魔女のBaneにはできない。
- **負債トークンがある間は カードもイベントも購入できない**（RGG 帝国ルールブック逐語）。イベント購入は**購入権を1消費**、同じイベントを1ターンに複数回買える、**返済は購入権を消費しない**。
- **Windfall（意外な授かり物・帝国イベント第13）＝$5「山札と捨て札が**両方**空なら金貨3枚を獲得」**（手札・場は判定に含めない）。研究データに欠落していた1枚。
- **Tomb の +1VP は「廃棄した本人」**に入る（相手ターンの詐欺師でも・塩まきのサプライ廃棄でも・複数枚は1枚ごと）。→ `trashCard`(engine.js) 本体の `state.trash.push` 直後にフック（城塞が手札に戻る場合も廃棄自体は起きているので発火）。
- **6VP型ランドマーク6種**（闘技場/公会堂/浴場/戦場/列柱/迷宮）＝準備で **6×人数**。**水道橋**＝銀貨に8・金貨に8（人数非依存）。**汚された神殿**＝**集合を持たない**各アクション山に2ずつ。ランドマーク上のVPが尽きたら以後そのランドマークでは得点できない。
- **峠**＝誰かが最初に属州を獲得した**そのターンの後**、各プレイヤーが1回ずつ最大40負債で入札（獲得者が最後）。最高額が +8VP＋その額の負債。

### 【次にやること】engine 実装（この順）
1. **共通基盤**：`state.landmarks = [id...]`（公開・maskで残す）／新スカラー `state.landmarkVP = {id:個数}`（ランドマーク上の有限リザーブ・**非カード＝保存則tally対象外**）／`state.landmarkStash = {aqueduct:n, defiled_shrine:n}`（山から移したVPの一時置き）／`state.obeliskPile`。`createInitialState` で準備処理（`pickBane` と同型）。**山に置くVPは既存 `state.pileVP` を再利用**（集合機構と同じマップ）。
2. **得点専用11種**（`museum`/`fountain`/`palace`/`bandit_fort`/`wall`/`wolf_den`/`orchard`/`triumphal_arch`/`keep`/`tower`/`obelisk`）＝`scoreGame(state)` に**横断採点ブロック**を追加（`vpOf(p)` は `state` を持たないので署名を変えず scoreGame 側に足す）。**得点が負になり得る**ので下限クランプ禁止。`keep` は全員のデッキを同時に見る。`tower`/`obelisk` は「カード→由来山」の写像が要る（分割山は両名・混合山は length 判定）。CPU `vpOfPlayer` にも同じ加点。
3. **トリガー型10種**：`tomb`(trashCard)／`battlefield`(triggerOnGain・勝利点)／`labyrinth`(そのターン2枚目の獲得)／`baths`(END_TURN・獲得0)／`basilica`(購入フェイズの獲得＋残コイン≥2)／`colonnade`(購入フェイズのアクション獲得＋場に同名)／`aqueduct`・`defiled_shrine`(pileVP→landmarkStash→vpTokens)／`arena`(購入フェイズ開始の任意捨て＝**新pending＝4点セット必須**)／`mountain_pass`(**新pending＝逐次入札**・CPU入札評価・UI入札モーダル)。
4. **セット選択**：`empires` の固定10王国に**ランドマーク2枚を付ける新セット**か、セット選択UIの**トグル**か（設計判断・未決）。**新しい CARD_SET を足したら UI の picker にも出す**（`test/ui.test.js` が守る）。
5. **テスト**：`test/landmarks.test.js` 新設＋`invariants` に「ランドマークVPは非カード」「得点が負になり得る」検証＋CPUソーク。
6. **絵**：ユーザーがチャッピーで21枚生成中（3バッチ）。`Downloads` から判別して `asset/art/<id>.png` に回収 → `node tools/build-landscape.js` で webp 生成 → `sw.js` VERSION を上げる。

### 注意（次セッションが知らないと事故る）
- **2022エラッタで `basilica`/`colonnade`/`defiled_shrine`/`tax` は「購入したとき」→「購入フェイズ中に獲得したとき」に変わっている**。カタログ文は現行を採用済み。研究の2文書で一部この点の記述が食い違うので、**実装時に `docs/research/landscape_cards.md` §6-4 の現行文を正とする**。
- **ランドマークのVPトークンは供給から取る有限リザーブ**＝`state.pileVP`（集合＝山の上・実質無制限）とは**別物**。水道橋/汚された神殿だけが両方を使う（山＝pileVP、ランドマーク上＝landmarkStash）。
- 横型カードは `DOM.CARDS` に無いので、`carddata.js` の `buildDisplay`／`cards.html` の一覧／`ui.js` の盤面表示は**別経路**が要る（`DOM.LANDSCAPES` を見る）。`verify:e2e` の webp404 検査は「ページが要求した webp」しか見ないので、一覧に出すまでは影響しない。

---

## 0-17. E8＝命令（Command）の忠実化＝**「命令がプレイした札は動かない」**（2026-07-10・**push済（`52bba46`）**）

**⚠️ 前セッションの E8 計画は誤りだった（廃止済みの2016年ルールを実装しようとしていた）。実装前に多エージェント研究WFで一次資料を取り直し、方針を反転させた。**

### 何が誤りだったか
- §0-16・旧KICKOFF は「**公式2022では命令カードが身代わりに動く**（大君主×陣地＝大君主が脇→大君主の山へ／大君主×農家の市場＝大君主自身を廃棄／船長×鉱山の村＝船長を廃棄して+$2／王子×島＝王子が島マットへ）」と書いていた。
- これは **RGG が今もホストしている 2016年版 Empires ルールブックPDF の記述**（"Overlord also gets the chosen card's cost, name, and types, until it leaves play. If you play Overlord as a card that moves itself somewhere ... Overlord will do that"）。**2019年エラッタで廃止済み**。
- **現行（2019エラッタ・2021以降の刷）＝逆**。Donald X. Vaccarino の公式エラッタ：shapeshifter 4枚（band_of_misfits / overlord / inheritance / prince）は「**play a card instead of becoming the card**」に変更。カード文も `"... leaving it there."` になった。
- **RGG Dark Ages(2022) ルールブックPDF の逐語**（検証エージェントが pdftotext で単語一致を確認）：
  > "Command is a type that appears on cards like this; it has no meaning beyond stopping these cards from playing each other. ... **The played Action card stays in the Supply; if an effect tries to move it, such as Death Cart trying to trash itself, it will fail to move it.** If the card checks to see if it was trashed, like Death Cart does, that part will fail, but if it does not, like Acting Troupe, **the rest of the effect will still happen**. Since the played card is not in play, "while this is in play" abilities (such as Highway's) will not do anything."
- **決定打**：我々のカタログ文は既に現行エラッタ側だった（大君主「そのカードはサプライに残す」／船長・王子「動かさずに使用する」）。旧ルールを実装すると自分のカード画像と矛盾する。→ ユーザー確認の上で **現行エラッタ準拠** に決定。

### 実装（＝現行ルール。旧 no-op はほぼ正しかったが3種類の取りこぼしがあった）
- **`state._cmd = { player, id, as }`** を、命令カードが代理で `applyEffect(card)` を呼ぶ間だけ立てる（新 `playAsCommand`。`finally` で削除＝state に残らない）。
  - **`as` で「今まさに命令が代理でプレイしているカード」を識別する**のが要。`herald`（山札上の本物のアクションを同期プレイ）/`vassal`/`crystal_ball`/`berserker`(on-gain) のように **applyEffect の内側で別の本物のカードをプレイする経路**があり、そちらの「これ(this)」は本物を指すため。
- **`playedByCommand(state,pi,cardId)`** ／ **`takeSelf(state,pi,cardId)`**（命令経由なら必ず `null`＝lose track。そうでなければ `removeOne(p.inPlay, cardId)`）。自己移動サイトを全部これに置換＝
  `feast` / `island` / `treasure_map` / `pillage` / `farmers_market` / `madman` / `encampmentSetAside` / `putOnTavern`（Reserve 全部）。
- **後から解決する選択待ちは pending に `self`（＝「これ」を廃棄できるか）を載せる**：`death_cart` / `raze`。`mining_village` と `encampment` は命令経由だと**選択自体が無意味なので pending を立てない**（死に選択肢を出さない）。旧 `pd.fromCommand` は廃止（大君主/はみだし者にしか付いておらず船長/王子で漏れていた）。
- **OVERLORD_PLAY / BAND_OF_MISFITS_PLAY / CAPTAIN_PLAY / PRINCE_PLAY / replayCommandAs** をすべて `playAsCommand` 経由に統一。
- **`DOM.engine.pendingSelf(state, pd, cardId)` を新設・公開**＝engine拒否・CPU非提案・UI表示が**同じ述語**を見る。後方互換（下記レビュー確定バグ）も内包。

### これで直った実バグ（現行ルール基準・すべて回帰テスト付き）
1. **【MED・出荷到達】「これ」が場の *同名の本物のコピー* を巻き込む**：船長/王子で `mining_village` を使うと、**場に出してある本物の鉱山の村が廃棄され +$2 が出た**（`random-promo` は captain と mining_village が同居）。同型で `raze`（場の本物の倒壊を廃棄）・`death_cart`（fromCommand が船長/王子に無い）・`encampment` も。
2. **【MED】倒壊の死に選択肢**：命令経由の `raze` で「これを廃棄」を選ぶと engine が state 不変で拒否＝pending が閉じない。UI にボタンが出ており、CPU も条件次第で提案し得た。
3. **【LOW・忠実性】取りこぼし**：`farmers_market` の「山上VPを取る」は廃棄に条件づかない（取れる）。`feast` の獲得も条件づかない（獲得できる）。`island` の「手札から1枚を島マットへ」は場所が明示されているので起きる。`death_cart` の「手札のアクションを廃棄して+$5」も起きる。← 現実装はいずれも正しく動くようになった。
- **`empires` 固定セットの「大君主と自己移動札を同居させない」制約の根拠（永久VPループ）は旧ルール前提の誤診だった**。現行ルールでは大君主×農家の市場は「山上VPを取るが何も廃棄しない」＝強コンボだが合法・非ループ。固定セットは今回いじっていない（変更する必要は無い）。

### 敵対レビュー（多エージェント6次元→各findingを node 再現で確定）＝**確定2件（偽陽性0・5次元クリーン）→修正済み**
- **【MED】`pending.self` を新設したことによる後方互換バグ（オンライン永続化）**：`server/gameServer.js` は `state.pending` を含む全 state をそのまま Upstash に保存し、再デプロイ後 `restoreRoom` が**無変換で復元**する。v43 で作られた pending には `self` が無く、v44 が読むと `undefined`（falsy）＝「これを廃棄できない」に化ける。
  - `raze`：**手札0枚の廃棄 pending が永久に閉じない**（CPU が無効 action を再送し続ける全体ソフトロック／人間は提出手段ゼロ）。
  - `death_cart`：「自身を廃棄して+$5」が黙って消える。
  - → **`pendingSelf` が旧来の意味へフォールバック**（`self` 欠落なら「場に本体があれば廃棄可」＋v43 の `fromCommand` も尊重）。engine/CPU/UI が同じ述語を見るので3面同時に直る。回帰テストを `adventures.test.js` に追加（JSON round-trip で v43 の pending 形状を再現）。
- 他5次元（`_cmd` のスコープ・自己移動サイト・CPU ソーク・ルール忠実性・拡張間相互作用）は**クリーン**。

### 意図的な据え置き（現行ルールとの差。E9 候補）
- **大君主/はみだし者は持続カードもプレイできる**（現行カード文に "non-Duration" が無い）。実装は除外したまま。公式は「プレイした札が場を離れたであろうターンの片付けまで命令カードを場に残す」＝`armDuration(state,pi,命令id,{type:対象id})` で表現できる見込み。
- **命令は混合山（騎士/城）の一番上もプレイできる**が除外したまま。
- **チャンピオンの+1アクション／教師の山トークン／浮浪児のトラップ**は命令がプレイしたアクションで発火しない（`PLAY_ACTION` のみ＝既存の簡略化）。
- **宝の地図**を命令でプレイした場合、手札のコピーも廃棄しない（公式裁定が取れず、廃棄しない側に倒した）。

### 検証
- `test/empires.test.js` **269件**（E8＝大君主×農家の市場/陣地/祝宴/略奪/倒壊/ワイン商/島/宝の地図・玉座×大君主×祝宴・大君主×伝令官の識別）／`test/promo2.test.js` **165件**（船長×鉱山の村の誤爆回帰・王子×島/鼠取り/鉱山の村/狂人）／`test/darkages.test.js` **87件**（はみだし者×死の荷車の self=false・手札ルート・CPU終端・×隠遁者）／`test/adventures.test.js` **59件**（`pendingSelf` の後方互換3件）。
- `invariants` の敵対王国に **+2種**（命令4枚×自己移動札×Reserve×玉座/王の宮廷）。**npm test 全33スイート緑（exit 0・整合性3146不変・CPU序列 100/64/95 維持）**／`verify:e2e` 9/9（webp 346枚）／`verify:visual` 全幅はみ出し0。
- カタログ：大君主の表示文を現行文言（「サプライにあるコスト5以下の、命令ではないアクションカード1枚を、サプライに残したまま使用する。」）に修正し **`overlord.webp` を再生成**（このPCのみ）。`sw.js` v43→**v44**。

### push＝完了（2026-07-10・`52bba46`）＝本番反映を確認済み
- **GitHub Pages**：`sw.js` v44 を配信／`js/engine.js` に `pendingSelf`・`playAsCommand`／`js/cpu.js`・`js/ui.js` が `pendingSelf` を参照／`js/cards.js` の大君主が現行文言／`asset/cards/overlord.webp` 200・ローカルとバイト一致（148292）。
- **Render（オンライン）**：WS `wss://dominion-server-1hc9.onrender.com/ws`（`/ws` パス＋Origin 必須・メッセージは `t:` キー）で `setConfig kingdomSet=darkages` を受理し、対戦開始で 王国にはみだし者・廃墟の山10枚・避難所ON・相手手札マスク すべて正常。`GET /status` ＝ `{"persist":true,...}`＝**永続化は本当に有効**（＝敵対レビューが見つけた「復元スナップショットの `pd.self` 欠落」は実在の到達経路だった）。
  ※サーバは `js/engine.js` を require するので、Render の再デプロイで E8 がオンラインにも効く（サーバ側コードの変更は無し）。

### 【次にやること】横型ランドスケープ or E9
- 候補：**横型ランドスケープ**（帝国イベント13＋ランドマーク20／冒険イベント20＝縦枠パイプライン未対応で段階1すら未着手）／**E9＝命令が持続カードをプレイできるようにする**（大君主/はみだし者。公式カード文に "non-Duration" が無い。`armDuration(state,pi,命令id,{type:対象id})` で「対象が場を離れたであろう手番の片付けまで命令カードを場に残す」を表現できる見込み）／CPU購入AIの拡張別チューニング。

---

## 0-16. 段階2＝帝国（Empires）E7＝Phase E＝CARD_SET昇格 **完了・push済（`15b605e`）**（2026-07-10）

**帝国が実プレイ可能に**（`empires` 固定10種＋`random-empires`）。`sw.js` v42→**v43**。**カタログ変更なし・webp は `castles.webp` 1枚を新規生成**（E5で作り忘れ＝下記⑤）。これで **縦型カードの実プレイ化は帝国まで完了**（残りは横型ランドスケープのみ＝§5）。

### 昇格の配線
- **`DOM.KINGDOM_EMPIRES` 固定10種（自作 showcase・公式の帝国専用10種は無い）**＝`engineer, overlord, settlers, catapult, castles, temple, villa, forum, wild_hunt, crown`。新機構6系統を全部味わえる＝負債(engineer/overlord)・集合＝山上VP(temple/wild_hunt)・分割山2組(settlers/騒がしい村・catapult/石)・城の混合山(castles)・命令(overlord)＋冠・villa。アタック＝投石機。on-gain＝公共広場(+1購入)/神殿(山上VP強奪)/石(銀貨)/城。
- **【重要】固定セットは 大君主 と「自己移動する札」（農家の市場＝自己廃棄・陣地＝自己脇置き）を意図的に同居させない**。命令の「自身が動く」clause 未実装（下記E8）のため、同居すると *大君主→農家の市場で山上4VPを回収しても何も失わない* 永久VPループになる。`random-empires` では同居し得る（保存則OK・非ループ・許容簡略化）。
- `DOM.CARD_SETS` に `empires`（kind:standard）と `random-empires` を追加。`initSupply`/`createInitialState` は既存の分割山補完・城の人数別セットアップで自動対応。サーバは `DOM.CARD_SETS` から許可IDを導出するのでオンラインも自動対応。

### 【実バグ修正①】大君主は負債コストのカードをプレイできない（公式）＝E7で初めて同居
- 研究WFで RGG 公式 Empires ルールブック(2022) 本文を確認：**コストは coin/負債/ポーション を成分ごとに比較**し、`$0+負債4` は "up to $5" では**ない**（`Examples: [$0+4D] is not "up to [$5]."`）。Workshop で技術者を獲得できないのと同じ理屈。
- engine に **`costIsPlainCoin(id)`（負債もポーション費用も持たない）** を新設し、**`overlordTargets` / `captainTargets` / `bandOfMisfitsTargets` / `princeEligible`** の4述語に適用（従来は `!potion` だけ）。CPU `bestPrinceTarget` も同条件に。
- 王子×技術者は**闇市場経由で到達可能**（random-promo）だったので、これも同時に塞がった。

### 【実バグ修正②③】UI：出荷済みの固定セットが画面から選べなかった（本番の実害）
- **② `3e0794f`（6/14「セット選択を4分類に整理」）以降、`kind:'standard'` の拡張セット8つ（海辺/錬金術/繁栄/収穫祭/ギルド/異郷/暗黒時代/冒険）が picker のどの分類にも出ておらず、ローカル/オンラインとも選択不能だった**（ランダム系でしか遊べない状態）。→ **「拡張」分類を新設**（`kind:'standard'` の basic/intrigue 以外をタイル表示・各セットに一行 `desc` を追加）。帝国セットもここに出る。
- **③「ランダム」分類の抽選元セグメントが 13→14個で `overflow:hidden` に切られ、320px 幅では「暗黒時代から」以降（冒険/帝国/初版など）が画面外で押せなかった**（実ブラウザで scrollWidth 405 vs clientWidth 248 を計測）。→ `.seg.seg-wrap`（折り返すチップ）を新設。`.seg` が後方定義なので**特異度を上げないと効かない**点に注意。
- 恒久回帰：`test/ui.test.js` に **「全 CARD_SETS がセット選択画面から選べる」**（各 id を描画して選択済み表示が出るか）を追加。

### 【実バグ修正④】CPU：混合山のコストを静的値で見ていた／終局判定の得点漏れ
- `kingdomAffordable`（弱CPUの購入候補）と `chooseBuyStrong` の「勝って終われる購入」ループが **`C()[id].cost` の静的コスト**で判定していた。城の山 `castles` はプレースホルダが$3（＝最安）なので、一番上が$10の王城でも「$3で買える」と誤認→engine が拒否→買いを空振り（最終ガードのおかげで無限ループにはならないが弱くなる）。→ **engine の実コスト `cardCost`＋`splitBlocked`＋`canBuyCard`** で判定し、混合山は新ヘルパ **`mixedTop`（一番上の実カード）**で得点も評価。
- CPU `allCards` に **`princes`/`tavern`/`archives`** を追加（engine.allCards と同じゾーン）＋`vpOfPlayer` に **城（粗末な城=城の枚数×1／王城=×2）・封土・遠隔地** を追加＝hard CPU の終局読みが正しくなる。

### 【実バグ修正⑤】`asset/cards/castles.webp` が存在しなかった（E5の作り忘れ）
- 城の混合山プレースホルダ `DOM.CARDS.castles` を E5 で足したのに webp を生成していなかった＝**カード一覧と（山が空のときの）盤面で 404**。`npm run verify:e2e` が検出（`ok=345 bad=1`）。→ `asset/art/castles.png`（王城の絵を流用）＋`CARDS_ONLY=castles node tools/build-cards.js` で生成。**この webp 再生成はこのPCでしかできない**（入力は gitignore）。

### 敵対レビュー（多エージェント6次元→node再現検証）＝**確定1件（偽陽性0）→修正**
- **[LOW] `winsIfEnds` の hypo デッキに酒場マットが無く、自分の遠隔地(4点)だけ消える**（相手は実オブジェクトで4点計上＝非対称に自己過小評価→勝てる終局購入を見送る）。今回 `vpOfPlayer` に遠隔地句を足したことで生じた新規バグ。→ **hypo に tavern を入れ直すと `allCards` で二重計上になる**（庭園/品評会/絹の道/城が狂う）ので、`winsIfEnds` で `+4×マット上の遠隔地枚数` を明示加算。回帰テストを `adventures.test.js` に追加（fix を外すと落ちることを確認済み）。
- 他5次元（配線／コスト述語の回帰／CPU／UI／固定セットの相互作用／オンライン・マスク）は**クリーン**。

### 検証
- `test/empires.test.js` **226件**（E7の配線・大君主×負債・出荷セットCPUソーク36戦）／`test/empires-ui.test.js` **45件 新設**（全pendingモーダル＋負債バッジ＋山上VP＋城の混合山＋分割山＋「拡張」タイル）。`invariants` の出荷セット検証に `empires`/`random-empires` 追加。
- 追加ソーク（empires / random-empires・2〜4人・全難易度 60戦）＝完走60・膠着0・例外0・保存則0（平均総手番60.3＝負債で膠着しない）。
- **npm test 全33スイート緑（exit 0・整合性3146・CPU序列 100/64/95 維持）**／`verify:visual` 全幅はみ出し0／`verify:e2e` 9/9（webp 346枚すべて読める）／実ブラウザで「押せないボタン」0。

### push＝完了（2026-07-10・`15b605e`）＝本番反映を実機確認済み
- GitHub Pages：`sw.js` v43／`js/cards.js` に `KINGDOM_EMPIRES`・`random-empires`／`js/ui.js` に「拡張」分類／`asset/cards/castles.webp` が 200。
- Render（オンライン）：WS `/ws`（Origin 必須）で `setConfig kingdomSet=empires` を受理し、対戦開始で 城8枚（先頭=粗末な城）・分割山下段（騒がしい村/石 各5）・`p.debt`・`state.pileVP`・相手手札マスク がすべて正常。
  ※ **サーバは `DOM.CARD_SETS` から許可IDを導出**するので、新セットを足せば自動で受理される（サーバ側の変更不要）。Render の反映は push から数分かかる。

### 【次にやること】E8 → 完了（§0-17）
- ~~E8＝命令(Command)の「自身が動く」clause~~ → **この節に書いていた「公式2022では命令カードが身代わりに動く」は 2016年初版ルールで、2019エラッタで廃止済みだった**。正しくは「命令がプレイした札は動かない／命令カード自身も動かない」。§0-17 で現行ルールに合わせて実装済み。
- 公式では **大君主/はみだし者は持続カードもプレイできる**（命令カードが場に残る）＝現実装は除外（船長/王子は "non-Duration" が card text にあるので正しく除外）。E9 候補。

---

## 0-15. 段階2＝帝国（Empires）Batch E6＝命令（overlord/crown）**完了**（2026-07-10・WIP・未push）

**Batch E6 完了＝帝国の新機構6系統すべて実装済み**。設計正本＝`docs/research/empires_rules.md` §1-5。`sw.js` v41→**v42**。**カタログ/webp変更なし**。**帝国はまだ CARD_SET 未昇格＝本番挙動は不変**。次は **E7＝Phase E＝CARD_SET昇格**。

### 実装（4点セット＝engine reducer＋PLAYER_ACTIONS＋CPU decidePending＋UI viewPendingModal）
- **大君主（overlord・$0+負債8・命令）**：`overlordTargets(state)`（captainTargets 同型・上限コスト5固定・非命令/非持続/非ポーション/非NON_SUPPLY/非splitLocked/非knights）＋`OVERLORD_PLAY`。サプライに残したまま使用（場に出ない・獲得しない）。対象があるうちは使用必須。DOM.engine に `overlordTargets` を公開（engine/CPU/UI で同じ候補を参照）。
- **冠（crown・$5・アクション＋財宝）**：新ヘルパ `crownOpenPending(state,pi)` が **その時点の `turn.phase`** を見てモードを決める（action＝手札のアクション1枚を2回／buy＝手札の財宝1枚を2回・どちらも任意）。`CROWN_CHOOSE` は玉座と同型で `state.replay` に2回目を積む。

### 【重要】財宝の「2回使う」を根治（冠＝新規／ティアラ・偽造通貨＝既存バグも同時修正）
- 旧実装は2回目を **`treasureReplayCoins`（コイン再計算＋3件の特例だけ）** で済ませており、**pending を立てる財宝・+購入/+VP を持つ財宝の2回目を丸ごと落としていた**。
- **`playTreasureCard` を「移動」と「効果」に分離**し、新 **`applyTreasureEffect(state,pi,card)`**（＝カードを動かさず効果だけ適用）を新設。2回目は **`state.replay` の新ラベル `'treasure_replay'`** に積み、**1回目が立てた選択待ちが解決してから** `runReplays` が適用する（行進の procession2/procession_finish と同じ形）。偽造通貨の廃棄は新ラベル `'counterfeit_trash'` で2回のプレイ後に走る。`treasureReplayCoins` は削除。
- 自己移動する財宝（**投資**＝`removeOne` ガードを追加／戦利品／法貨／私掠船の廃棄）は 2回目に removeOne が失敗して**自然に不発（lose track）**。
- これで **冠×御守り（二択が2回出る）／元手・大金の+1購入×2／鹵獲品の+1VP×2／愚者の黄金の動的$4／掘出物の獲得×2／水晶玉・金床・不正利得・豊穣の角の2回目の選択** が正しく出る。
- **副産物＝繁栄/暗黒時代の実バグ修正**：旧 `TIARA_PLAY`/`COUNTERFEIT_PLAY` は「1回目が反応待ち（相手の堀）なら2回目のアタックを丸ごと飛ばす」実装で、**3人戦で堀を持たない相手が銅貨を1枚しか受けなかった**（回帰テスト追加）。2回目のコイン計上タイミングも「1回目の完全解決後」に変わった（公式挙動・取りこぼしは無し）。

### 【重要】命令（Command）の「再演では選び直さない」ルール（公式）
- 公式：大君主/はみだし者を玉座の間等で複数回使っても、**何として使うかを選ぶのは1回目だけ**で以降は同じカード。
- `state.turn.commandAs[命令id]` に1回目の選択を記憶（`rememberCommandAs`）。`runReplays` が `state._replaying` を立て、`applyEffect` の `case 'overlord'` / `case 'band_of_misfits'` が `replayCommandAs` で記憶を再利用して**選択待ちを開かない**。
- **`_replaying` はゴーレムの2枚目では立てない**（＝「別カードの新しいプレイ」なので選び直せる）。
- **副産物＝暗黒時代の実バグ修正**：出荷 `darkages` 固定セットは **band_of_misfits と procession が同居**＝行進/玉座の2回目で別カードを選べてしまっていた（回帰テスト追加）。

### 敵対レビュー（多エージェント5次元→node再現検証）＝**確定9件（偽陽性0）→全件修正**
- 冠の2回目が 御守り/元手/大金/鹵獲品/愚者の黄金 の効果を落とす（high×1・medium×3・low×1）→ 上記 `applyTreasureEffect` で根治。
- 大君主が再演のたびに対象を選び直せる（medium）→ `commandAs` で根治（band_of_misfits も同時修正）。
- 語り部（アクションフェイズに財宝を出す）経由の冠が財宝モードになる（low）→ `crownOpenPending` が `turn.phase` を見るよう統一。
- UI：大君主モーダルの説明文が「持続除外」を書いていない（low）→ 船長モーダルと同文に修正。
- **既存バグも1件発見・修正（CPU）**：`pickSwindlerGift`（詐欺師）に `!splitBlocked` が無く、**ロック中の分割山下段（鹵獲品等）を贈与候補に出し続けて engine 拒否と噛み合いCPU無限ループ**（全プール混成fuzzで到達）。兄弟の `bestGain`/`bestGainExact` は持っていた書き漏れ。

### 検証
- `test/empires.test.js` を **全197件**に拡張（E6の裁定＋敵対レビュー回帰3群＋CPUソーク24戦）。`test/darkages.test.js` 79件（命令再演×行進/玉座＋偽造通貨の回帰）／`test/prosperity.test.js` 69件（ティアラ×ペテン師の3人回帰）／`test/promo2.test.js` 142件。
- **invariants の敵対王国に4つ追加**（冠×pending財宝×負債×分割山×城／命令の再演×玉座・王の宮廷／ティアラ×水晶玉・金床・投資・ペテン師／偽造通貨×戦利品×はみだし者×行進）。
- 追加ソーク（財宝再演×命令再演の敵対王国10種×12シード＝**120戦**）＝完走120・膠着0・例外0・保存則0・負リソース0。
- **npm test 全32スイート緑（exit 0・整合性3144不変・CPU序列 100/64/95 維持）**。

### 【次にやること】E7＝Phase E＝CARD_SET昇格（**ここで初めて本番に帝国が出る**）
- `DOM.KINGDOM_EMPIRES` 固定10種を選定＋`DOM.CARD_SETS` に `empires` / `random-empires` の2行。`POOLS.empires` から `castles`（混合山プレースホルダ）と分割山下段の扱いに注意（`randomKingdom` は下段→上段に正規化済み）。
- `test/empires-ui.test.js`（UIスモーク）新設＋`invariants` の出荷セット検証に `empires`/`random-empires` 追加＋CPUソーク（2〜4人・全難易度）。横型ランドスケープ（イベント/ランドマーク）は縦枠パイプライン未対応で対象外。

---

## 0-14. 段階2＝帝国（Empires）Batch E5＝城8（混合山・knights流用）**完了**（2026-07-08・WIP・未push）

**Batch E5 完了**＝城8種を1つの混合山（`state.castles`）として実装。設計正本＝`docs/research/empires_rules.md` §1-4/§3。`sw.js` v40→**v41**。**カタログ/webp変更なし**（研究WFで全8枚のカタログ＝公式一致・humble/plunder/rocksに続き humble_castle に coin:1 のみ追加＝表示文不変）。**帝国はまだ CARD_SET 未昇格＝本番挙動は不変**。次は E6（命令＝overlord/crown）＝帝国の最後の新機構。

### 城の混合山（`state.castles`＝knights 混合山流用）
- **pile-id `castles`**（knights 同型のプレースホルダ card を cards.js に追加＝`DOM.CARDS.castles`＋`POOLS.empires` に 'castles'／8種は `POOLS.castles`＝混合山の中身[非選択・昇順]）。`state.castles`＝実カードid配列を**コスト昇順**に積む（index0＝最安＝一番上）。`supply.castles`＝残数（同期）。**一番上だけ購入/獲得**（gain の `isMixed` に castles 追加＝先頭を shift・cardCost('castles')＝先頭の実コスト）。
- **人数別セットアップ**：2人＝各1（8枚）／3-4人＝**Humble/Small/Opulent/Kings を各2**（計12・昇順・重複隣接）＝createInitialState で構築。
- **公開情報**（昇順で決定的）＝maskStateFor で伏せない。**invariants/empires tally は state.castles を数え supply.castles はスキップ**（二重計上防止）。**混合山の中身（騎士/廃墟/城）を闇市場デッキから除外**（単体流出防止＝§6の既知リークも同時解消）。
- **可変VP（vpOf）**：粗末な城(humble)＝所有する城1枚につき1点／王城(kings)＝所有する城1枚につき2点（**自身を含む全ての「城」種別カードを数える**）。他6種は固定vp（crumbling1/small2/haunted2/opulent3/sprawling4/grand5）。

### 各カード（研究WFで公式裁定を裏取り・全カタログ一致）
- **粗末な城(humble・$3・財宝)**：+$1（coin:1）＋可変VP。**崩れた城(crumbling・$4)**：固定1VP＋**獲得または廃棄したとき +1勝利点トークン＋銀貨1枚**（triggerOnGain＋triggerOnTrash）。
- **小さい城(small・$5・アクション)**：固定2VP。プレイ＝これ（場）か手札の城1枚を廃棄→廃棄したら城1枚（一番上）を獲得（手札の城枝で城なし＝空振り可）。**華やかな城(opulent・$7・アクション)**：固定3VP。プレイ＝手札の勝利点カードを任意枚数 公開して捨て、1枚につき+$2（捨てるだけ＝VP保持・0枚可）。
- **幽霊城(haunted・$6)**：固定2VP。**自分のターンに獲得したとき 金貨1枚（自動）＋各相手（手札5枚以上）が手札2枚を山札の上へ**（非アタック＝堀不可）。**広大な城(sprawling・$8)**：固定4VP。獲得時 公領1枚か屋敷3枚を獲得（選択）。**壮大な城(grand・$9)**：固定5VP。獲得時 手札公開＋手札および場の勝利点1枚につき+1VP（自身は捨て札で数えない）。**王城(kings・$10)**：可変VP。

### 敵対レビュー（多エージェント6次元→node再現検証）＝確定バグ1件[MED]→修正
- **[修正] gainer（remodel/工房/拡張等の *_GAIN）経由で sprawling_castle/haunted_castle を獲得すると、獲得時効果が発火しない**：`finishGain` が gain() を呼ぶ時点で gainer 自身の pending が残っており、sprawling/haunted の on-gain が `!state.pending` ゲートで抑止される（BUY 経由は pending が null なので正常。crumbling/grand は自動効果でゲートなし＝無影響）。→ **新 `state.onGainQueue`（onTrashQueue 同型）を導入**＝sprawling/haunted の対話をキューに積み、reduce 末尾で選択待ちが空いたら発火（**border_village 等の意図的簡略化＝§6 の !pending on-gain対話ゲートは温存**）。他5次元クリーン（偽陽性0）。

### 検証
- 狙い撃ちテスト28/28（混合山の人数別/購入順/可変VP・全8枚・非アタックの堀不可・空振り・マスク）＋修正検証7/7。`test/empires.test.js` を **全140件**に拡張（E5裁定＋レビュー回帰＋CPUソークを42戦[E5城王国含む・全ゲーム完走で可変VP/混合山枯渇も検証]に拡大＝膠着0/例外0/保存則0）。
- **integrity 3134→3144**（'castles' プレースホルダ card 追加ぶん）。invariants は state.castles を数え supply.castles をスキップ（混合山の保存則）。**npm test 全32スイート緑（exit 0・knights 回帰なし）**。

### 【次にやること】Batch E6（命令＝overlord/crown）＝帝国 最後の新機構
- `docs/research/empires_rules.md` §1-5：**overlord**（負債d8・band_of_misfits/captain 流用＝サプライのコスト5以下・非命令アクションを、サプライに残したまま使う）／**crown**（$5・action+treasure・玉座同型だが現在フェイズで対象種別が変わる＝アクションフェイズ→手札のアクション1枚を2回／購入フェイズ→手札の財宝1枚を2回）。その後 **E7＝Phase E＝CARD_SET昇格**（`DOM.KINGDOM_EMPIRES` 固定10種＋`empires`/`random-empires`）＝**ここで初めて本番に帝国が出る**。横型ランドスケープ（イベント/ランドマーク）は縦枠パイプライン未対応で対象外。

---

## 0-13. 段階2＝帝国（Empires）Batch E4＝分割山5組（10枚）＋分割山機構の一般化 **完了**（2026-07-08・WIP・未push）

**Batch E4 完了**＝分割山5組の10枚を4点セットで実装＋**分割山機構を sauna/avanto 専用から一般化**。設計正本＝`docs/research/empires_rules.md` §1-3/§3。`sw.js` v39→**v40**。**カタログ変更なし・webp再生成なし**（研究WFで全10枚のカタログ文＝公式一致を確認。plunder/rocks に `coin:` フィールドのみ追加＝表示文不変）。**帝国はまだ CARD_SET 未昇格＝本番挙動は不変**。次は E5（城8・knights混合山流用）。

### 分割山機構を一般化（`DOM.SPLIT_PILES`）
- **`DOM.SPLIT_PILES`（cards.js・下段id→上段id の唯一の正本）**＝`{avanto:sauna（プロモ・両$4）, plunder:encampment, emporium:patrician, bustling_village:settlers, rocks:catapult, fortune:gladiator}`（安い方が上）。engine.js に `SPLIT_TOP`（下→上）/`SPLIT_BOTTOM`（上→下）/`splitLocked(state,id)`（下段が上段残存中で獲得不可か）を定義。
- **従来の sauna/avanto 専用ハードコードを全て一般化**：initSupply（各5+5）／createInitialState の相互補完（上下どちらかが王国にあれば両方置く）／gain() ガード／canBuyCard／validTeacherPiles／captainTargets／bandOfMisfitsTargets／emptyPileCount（分割山＝1山・上下とも0で空）／cpu.js `splitBlocked`／cards.js `randomKingdom`（下段→上段に正規化）。**sauna/avanto（promo2-pack）は回帰なし**（新プロモテスト緑）。

### 各カード（研究WFで公式裁定を裏取り・全カタログ一致）
- **陣地(encampment・$2上)**：+2カ+2ア。手札から金貨か鹵獲品を公開してよい→公開しないと脇へ→**片付け開始時に自分の分割山へ戻す**（`supply.encampment++`・捨て/廃棄ではない・玉座2回目は場に無く不発＝lose track・黒市経由で山が無ければ脇に残り所有カードとして数える）。**鹵獲品(plunder・$5下・財宝)**：+$2（coin:2）+1勝利点トークン/プレイ。
- **パトリキ(patrician・$2上)**：+1カ+1ア（+1カードが先に山札上を引く）→**新しい山札上を公開しコスト5以上なら手札へ**（未満は残す）。**エンポリウム(emporium・$5下)**：+1カ+1ア+$1。**獲得時（任意経路）場のアクション5枚以上なら+2VP**（inPlay+durationCards）。
- **開拓者(settlers・$2上)**：+1カ+1ア・捨て札から銅貨1枚を手札へ（任意）。**騒がしい村(bustling_village・$5下)**：+1カ+3ア・捨て札から開拓者1枚を手札へ（任意）。
- **投石機(catapult・$3上・アタック)**：+$1・手札1枚廃棄（強制）→**コスト3以上なら他全Pが呪い／財宝なら他全Pが手札3枚まで捨て（両方満たせば両方）**・堀/灯台で全防御・空手札なら副効果なし。**石(rocks・$4下・財宝)**：+$1（coin:1）・**獲得または廃棄したとき銀貨1枚**（購入フェイズ中なら山札上・そうでなければ手札＝triggerOnGain＋triggerOnTrash）。
- **剣闘士(gladiator・$3上・非アタック)**：+$2・手札1枚公開→左隣が同名を公開してよい→**公開されなければ+$1＋サプライから剣闘士1枚を廃棄**（分割山の上段が減る→尽きたら大金が見える）。**大金(fortune・$8+負債8・下・財宝)**：+1購入・**このターン初回の大金ならコイン2倍**（`t.fortunePlayed`・PLAY_ALL_TREASURESは大金を最後に出す）・**獲得時 場の剣闘士1枚につき金貨1枚**（負債は通常機構）。

### 敵対レビュー（多エージェント6次元→node再現検証）＝確定バグ1件[MED]→修正
- **[修正] exact-cost強制獲得が「ロック中の分割山下段を唯一の候補」として掴んで無限ループ/人間詰み**：gain()/canBuyCard は splitLocked を見るが、**「ちょうど$N獲得が必須か」を判定するゲート述語が splitLocked を除外していなかった**。**rocks は$4の分割山下段だが基本サプライに$4札が無い**ため、upgrade/remake（$3廃棄→ちょうど$4）や procession（$4アクション廃棄→ちょうど$5アクション＝emporium/bustling_village）で下段がロック中だと唯一候補になり、engineが拒否×ゲートは必須→pending不閉→CPU無限ループ/人間詰み。全プールfuzz（intrigue/dark ages×帝国）で到達可。→ **全ての exact-cost 強制獲得述語（upgrade/remake/procession/forge/farmland/governor/stonemason/swindler/develop/artificer/charm のゲート＋手動獲得）に `!splitLocked(state, id)` を追加**＋finishGain の辞退経路も splitLocked 除外（≤N/＜N は copper 等の基本札があり詰まないため対象外）。他5次元クリーン（偽陽性0）。

### 検証
- 狙い撃ちテスト41/41（分割山の初期化/購入ガード/sauna回帰・全10枚・アタック/堀・獲得時/廃棄時）＋修正検証7/7。`test/empires.test.js` を **全122件**に拡張（E4裁定＋レビュー回帰4件＋CPUソークを36戦[E4王国含む・2〜3人]に拡大＝膠着0/例外0/保存則0）。
- **invariants**：分割山カードは通常カード（保存則はsupply/trash経由）＝tally変更不要。全プール混成fuzz緑（exit0・exact-cost×ロック下段のデッドロックも解消）。**npm test 全32スイート緑（exit 0・整合性3134不変・新プロモのsauna/avanto回帰OK）**。

### 【次にやること】Batch E5（城8＝混合山）
- `docs/research/empires_rules.md` §1-4 の城8＝**knights 混合山流用**（`state.castles` = top-level id配列・コスト昇順に積む・一番上だけ購入/獲得・`isMixed` 分岐に castles 追加・invariants tally に forEach・maskで先頭のみ・emptyPileCount）。**2人＝各1枚計8／3人以上＝計12（Humble/Small/Opulent/Kings 各2）**。可変VP（humble=城数×1／kings=城数×2）＋各on-gain（small=trash→城獲得・crumbling=獲得/廃棄で+1VP&銀貨・haunted=自手番獲得で金貨&他P手札上げ・sprawling=公領1or屋敷3・grand=手札公開VP・opulent=勝利点捨てて+2コイン/枚）。以降 E6命令(overlord/crown)→E7=CARD_SET昇格。

---

## 0-12. 段階2＝帝国（Empires）Batch E3＝集合（Gathering・サプライ山上VPトークン）3枚 **完了**（2026-07-08・WIP・未push）

**Batch E3 完了**＝集合機構 `state.pileVP` ＋ temple/farmers_market/wild_hunt を4点セットで実装。設計正本＝`docs/research/empires_rules.md` §1-2/§3。`sw.js` v38→**v39**（js/css変更）。**カタログ/webp変更なし**（研究WFで全3枚のカタログ文＝公式一致を確認）。**帝国はまだ CARD_SET 未昇格＝本番挙動は不変**。次は E4（分割山5組・sauna/avanto流用）。

### 新機構＝集合（Gathering）＝`state.pileVP`
- **`state.pileVP = {[pileId]:個数}`**（トップレベル state・公開・**非カード＝保存則tallyに数えない**・createInitialState で `{}` 初期化・maskStateFor は clone でそのまま残る＝全員に見える）。サプライ山の上に置かれた勝利点トークン数＝**全プレイヤーで共有・累積**。UI＝山の右上に金色バッジ `⭐N`（`pileVpBadge`＋`.pile-vp` CSS）。プレイヤーVPトークン `p.vpTokens`（繁栄で既存・vpOfに加算済）へ移した時だけ得点になる。

### 各カード（研究WFで公式裁定を裏取り・全カタログ一致）
- **temple（神殿・$4）**：プレイ＝+1勝利点（本人）→**手札から名前の異なる1〜3枚を廃棄（強制・手札があれば最低1枚・同名重複不可）**→神殿の山にVP+1（`TEMPLE_TRASH`）。空手札なら廃棄0でも+1VP・山にVP。**獲得時（triggerOnGain・誰の獲得でも/購入含む/非購入獲得も）＝神殿の山上VPを全部自分の vpTokens へ**（山→0）。
- **farmers_market（農家の市場・$3）**：+1購入。**山のVPが4個以上なら全部得てこれを廃棄**（コインなし・場から trash へ）。そうでなければ山にVP+1、その後**山のVP1個につき+1コイン（置いた後に数える）**＝空山から +$1/+$2/+$3/+$4、5回目（山=4）で4VP取得＋廃棄。**4以上判定は置く前**。
- **wild_hunt（ワイルドハント・$5）**：二択（強制・`WILD_HUNT_RESOLVE`）。(a)+3カード＆山にVP+1。(b)屋敷1枚を獲得し、**獲得したら**山上VPを全部得る（屋敷山が空なら選べるが獲得もVPも無し＝合法だが無意味）。

### 敵対レビュー（多エージェント5次元→node再現検証）＝確定バグ1件[MED]→修正
- **[修正] temple_trash のUIソフトロック**：同一ターンに temple_trash が2回開く（玉座/王の宮廷/行進の再演・村＋神殿2枚）と、モーダルのリセットキー `pd.type+(pd.stage||'')` が `temple_trash` で不変のため `UI.selection` が持ち越される。1回目で廃棄して手札から消えた名前（幽霊選択）はチップが描画されず外す導線が無く、確定しても engine が `removeOne` 失敗で no-op 拒否→**人間が詰む**（engine は正しく拒否＝保存則OK・UI専用バグ）。**出荷帝国セット未昇格のため本番未到達**（Medium）。→ **temple_trash モーダル先頭で `UI.selection` を「現在の手札にある名前」だけに間引く**（幽霊選択を自己修復）。他4次元（rulings/保存則/CPU非ループ/cross-card＝玉座・闇市場・相手の神殿獲得）はクリーン（偽陽性0）。

### 検証
- 狙い撃ちテスト22/22（temple の同名拒否/0枚拒否・farmers_market の累積と4以上廃棄・wild_hunt の二択と屋敷空・獲得時全取得・マスク）。`test/empires.test.js` を **全95件**に拡張（E3裁定＋CPUソークを30戦[E3王国2種含む・2〜3人]に拡大＝膠着0/例外0/保存則0）。
- **invariants**：pileVP は非カードなので tally 変更不要（全プール混成fuzzで temple/farmers_market/wild_hunt を引いても保存則OK）。**npm test 全32スイート緑（exit 0・整合性3134不変）**。

### 【次にやること】Batch E4（分割山5組）
- `docs/research/empires_rules.md` §1-3/§2 の分割山＝**sauna/avanto と同型**（`js/engine.js` の分割山ガード4系統：gain冒頭/canBuyCard/emptyPileCount ペアで1山/CPU splitBlocked）。5組＝encampment/plunder・patrician/emporium・settlers/bustling_village・catapult/rocks・gladiator/fortune。**上下でコストが違う**点だけ sauna/avanto（両$4）と異なる。fortune は負債(E1)＋剣闘士on-gain金貨、emporium は on-gain VP(場アクション5枚以上)、rocks は on-gain/trash銀貨、catapult はアタック。以降 E5城8→E6命令→E7=CARD_SET昇格。

---

## 0-11. 段階2＝帝国（Empires）Batch E2＝既存VPトークン＆単独カード9枚 **完了**（2026-07-08・WIP・未push）

**Batch E2 完了**＝forum/sacrifice/groundskeeper/chariot_race/villa/charm/legionary/enchantress/archive の9枚を4点セット（engine reducer＋PLAYER_ACTIONS＋CPU decidePending＋UI viewPendingModal）＋終端保証で実装。設計正本＝`docs/research/empires_rules.md` §3。`sw.js` v37→**v38**。**帝国はまだ CARD_SET 未昇格＝本番挙動は不変**。次は E3（集合＝山上VPトークン）。

### 研究WF（9エージェント・web裏取り）でカタログ誤り2件を検出→修正（重要）
- **villa（ヴィラ）**：カタログの**プレイ時**効果に「これを手札に加える」が誤って入っていた（公式は**獲得時**のみ。プレイ時に手札へ戻すと無限コンボ）。→ カタログ修正（プレイ＝+2アクション+1購入+1コインのみ）＋**webp再生成**。実装は on-gain（triggerOnGain）で「手札に加え+1アクション・購入フェイズ中ならアクションフェイズに戻る」。
- **forum（公共広場）**：2022エラッタで「購入時+1購入」→**「獲得時+1購入」**に変更。→ カタログ「獲得時」に修正＋**webp再生成**、実装も on-gain（triggerOnGain）で+1購入。
- **chariot_race（戦車競走）**：**左隣が山札0枚のときは勝ちにならない**（`empires_rules.md` §3の「左隣0枚＝こちらの勝ち」は誤り。BGGスレ等4ソースで確認）。→ 実装は「**両者が公開でき、かつ自分のコストが厳密に高い**」時だけ +$1+VP（同コスト・どちらか空は無し）。

### 各カードの実装要点
- **forum**：+3カード+1アクション→手札2枚捨て（FORUM_DISCARD）。on-buyでなく**on-gain**で+1購入。
- **sacrifice**：手札1枚廃棄→**種別ごとに全適用**（アクション=+2カ+2ア／財宝=+$2／勝利点=VPトークン2）。空手札なら pending 無し。
- **groundskeeper**：+1カ+1ア。**場にある物理枚数ぶん**、勝利点獲得毎にVPトークン（triggerOnGainの隠し財産と同型・自手番のみ）。
- **chariot_race**：+1アクション。自分の山札上を公開して手札へ、左隣は公開のみ（山札に残す）。上記の厳密比較で +$1+VP。
- **villa**：プレイ＝+2アクション+1購入+1コイン（手札に戻らない）。**獲得時**（triggerOnGain）＝手札に加え+1アクション、**自分の購入フェイズ中の獲得ならアクションフェイズに戻る**（`state.turn.phase='action'`）。engineer等での獲得やBUYどちらも同じ入口。
- **charm**：財宝の二択（`charm_mode`）。A=+1購入+$2／B=`t.charmNextGain` を積み、このターン**次の獲得**でその獲得札と**同コスト（$・負債・ポーション一致）で名前の異なる**カード1枚を獲得（`charm_gain`・複数チャームは積む・無効な選択は拒否してpending維持）。
- **legionary**：+$3。金貨公開の選択（`legionary_reveal`）→公開したら各相手が手札2枚まで捨て**その後1枚引く**。**`discard_down` に `drawAfter` を追加**（捨て後に+1引き・免疫でない全相手が対象＝手札≤2でも引く）。アタック（堀/灯台で全無効）。
- **enchantress**：即時効果なしのアタック持続。免疫でない各相手に `p.enchanted` を立て、**その手番で最初にプレイするアクションを +1カード+1アクションに置換**（PLAY_ACTIONで消費・記載効果=アタックも抑止・チャンピオン/教師トークン等ライン下能力は先に適用済みで機能）。次の自分の手番開始時 +2カード（DURATION_RESOLVERS）。`enchanted` は相手の cleanup で消える。置換された持続は予約を張らずそのターン捨て。堀react（ENCHANTRESS_REACT/MOAT_REVEAL）。
- **archive**：+1アクション。山札上3枚を裏で脇へ＝新ゾーン **`p.archives = [{id, cards}]`**（所有者のみ可視＝**maskStateForで相手にback**・**allCards/invariants tally/empires tally に加算**・cleanupは `p.archives.length` ぶん物理カードを保持）。今回と次の2手番開始時に1枚ずつ手札へ（`archive_pick`。手番開始ぶんは resolveDurationStartEffects→startQueue）。玉座で2脇（各id独立）。

### 敵対レビュー（多エージェント6次元→node再現検証）＝確定バグ3種→修正2件＋据え置き1件
- **[修正] 生贄×玉座/王の宮廷/行進でCPU無限ループ**：`sacrifice` を2回プレイし1回目で最後の非生贄札を廃棄→2回目が手札=['sacrifice']で開くと、CPU `decidePending` が生贄を除外して `card:null` を返し続ける（engineは手札>0で廃棄必須＝null拒否でpending不閉）。**全プールfuzz（玉座+生贄）／闇市場経由（出荷promoで到達可）**。→ CPU sacrifice に `|| p.hand[0]` フォールバック（手札があれば必ず非null＝最後は生贄自身を廃棄＝アクション種別で+2カ+2ア）。回帰テスト2件。
- **[修正] 闇市場でvilla/forum等を獲得→on-gain効果が飛ぶ**：`BLACK_MARKET_BUY` はサプライ外札のため gain() 非経由で discard 直挿し＝**`triggerOnGain` を呼んでいなかった**（villaの手札化/+1ア/フェイズ復帰・forumの+1購入・庭師VP・御守り次獲得が消失）。→ BLACK_MARKET_BUY 末尾に `triggerOnGain(state, pd.player, card, 'discard')` を追加（**従来から闇市場に在った on-gain 欠落＝キャッシュ/大使館/国境の村等も併せて解消**・負債は従来どおり手動付与で二重にならない）。回帰テスト2件。
- **[据え置き＝許容簡略化] enchantress×追加ターン**：outpost（前哨地）/possession（支配）で相手が追加ターンを取ると、`enchanted` が再付与されず追加ターンの最初のアクションが置換されない（過小適用）。**出荷帝国セットに追加ターン源は無く到達不能**（全プールfuzzでのみ seaside/alchemy と同居し得るが、保存則/非ループ/クラッシュは無し＝fuzz緑を維持）。champion/教師トークンの「玉座再演では発火しない」と同種の意図的簡略化。

### 検証
- **狙い撃ちテスト（各カード）＝合計140件超 全緑**（実行後に一時ファイル削除）。`test/empires.test.js` を **全79件**に拡張（E1=39＋E2＝カード裁定＋敵対レビュー回帰5件＋E2 CPUソーク24戦[2〜3人・E2重点王国3種・膠着0/例外0/保存則0]）。
- **invariants**：tally/hasBack に `archives` ゾーンを追加（脇置きも保存則に数える）。全プール混成fuzz緑（exit0）。
- **npm test 全32スイート緑（exit 0・整合性3134不変）**。

### 【次にやること】Batch E3（集合＝サプライ山上のVPトークン）
- `docs/research/empires_rules.md` §1-2 の集合機構＝新スカラー `state.pileVP = {[pileId]:個数}`（公開・非カード）＋temple/farmers_market/wild_hunt。§3 の個別裁定を着手時に再確認。以降 E4分割山5組（sauna/avanto流用）→E5城8（knights混合山流用）→E6命令(overlord/crown)→E7=CARD_SET昇格。

---

## 0-10. 段階2＝帝国（Empires）実プレイ化 **着手・Batch E1＝負債経済の基盤 完了**（2026-07-08・WIP・未push）

**帝国段階2に着手**。段階1（画像/カタログ/GAIN_ORDER）は §0-6 で完了済み。設計＝**`docs/research/empires_rules.md`**（公式ルール裏取り＋6機構＋バッチ計画）を必読。新機構6系統＝負債Debt／集合=山上VPトークン／命令overlord・crown／分割山5組／城8混合山／villa。横型ランドスケープ（イベント/ランドマーク）は対象外（縦枠パイプライン未対応）。

### バッチ計画（安全順・`docs/research/empires_rules.md` §2）
- **E1＝負債経済の基盤＋純負債4枚**（✅完了）／E2＝既存VPトークン＆単独カード（sacrifice/chariot_race/groundskeeper/forum/legionary/enchantress/archive/charm/villa）／E3＝集合（山上VP＝farmers_market/temple/wild_hunt）／E4＝分割山5組（sauna/avanto流用）／E5＝城8（knights混合山流用）／E6＝命令（overlord/crown）／E7＝Phase E＝CARD_SET昇格。

### Batch E1 完了（負債(Debt)経済の基盤＋engineer/city_quarter/royal_blacksmith/capital）
- **負債スカラー `p.debt`**（公開・VP無関係・ターンを跨いで残る＝freshTurn非対象・maskStateForで公開）。**負債コストのカードを購入/獲得すると `gain()` 末尾でその数だけ負債を負う**（購入も効果獲得も gain() 一元入口を通る）。**負債>0 の間は BUY を拒否**（購入ブロック）。返済＝新 action **`REPAY_DEBT`**（購入フェイズ・$1=負債1個・購入権消費なし・amount未指定で可能な限り）。
- **カード効果**：engineer（≤$4を1枚獲得[強制]→自己廃棄してもう1枚[強制]。多段pending gain1/maytrash/gain2＋4点セット。玉座2回目は removeOne 失敗で自己廃棄不発＝保存則OK）／city_quarter（+2アクション＋手札のアクション枚数ぶん+カード）／royal_blacksmith（+5カード＋手札の銅貨を全捨て）／capital（財宝 coin:6＋1購入。**cleanupで場から捨てるとき負債6＋残コインで即返済**＝コイン使い切れば負債6残・使わなければ0）。
- **重要ルール（裏取り済・`docs/research/empires_rules.md`）**：負債は「購入」だけをブロック（獲得は可・終了時減点なし）。**「コストN以下/ちょうどN の獲得」は負債コストのカードを取れない**（負債は追加コスト）＝engineer/messenger の canGain と CPU `bestGain`/`bestGainExact`・UIモーダルに負債除外を追加。
- **CPU**：decide の購入フェイズで財宝後に debt>0 なら REPAY_DEBT（コイン0なら END_TURN＝非ループ）。chooseAction に city_quarter/royal_blacksmith/engineer。decidePending に engineer 全段。**UI**：負債バッジ（オレンジ）＋返済ボタン＋購入ボタンの負債>0無効化（buyableId/onPileTap 両方）＋viewPendingModal の engineer 3段＋黒市モーダルの負債ガード。`sw.js` v36→**v37**。
- **多エージェント敵対レビュー（5次元→各自 node で再現検証）＝確定バグ1クラスタ（闇市場×負債）→修正**：
  - **[MED] 闇市場(BLACK_MARKET_BUY)が負債を完全に無視**＝(1)負債>0でも購入可・(2)`discard.push` 直挿し（gain()非経由）で負債カードを買っても負債が付かない。黒市デッキ母集団は全POOLS（empires含む）＝promo-pack等で到達可。E1で負債カードが実効果を持ったため『働くカードを負債ゼロで不正入手』に。→ BLACK_MARKET_BUY に負債>0拒否＋負債カード購入時の負債付与、CPU黒市ハンドラに負債>0でSKIP＋負債カード除外、UI黒市に負債ガード。
- **意図的な据え置き（非到達＝ポーション費用と同型）**：workshop/ironworks/armory/feast/altar/remodel等の**汎用「≤$N獲得」reducer の canGain は負債カードを除外していない**（engineer/messengerのみ除外）。**どの出荷 CARD_SET でも負債カードとこれらの汎用gainerは同居しない**（empires固定/random-empiresは empires のみ・mix-allセットは無し）＋**fuzzはCPU駆動で `bestGain` が負債カードを提案しない**ため到達不能。将来 mix-all モードを足すときに共通ヘルパ `costUpTo` へ集約して**ポーション費用問題と一緒に**対応する方針（§6）。
- **検証**：狙い撃ち/回帰 `test/empires.test.js`（39件・package.json登録＝**32スイート目**）＝負債の購入ブロック/返済/gain付与・capitalのon-discardと即返済・engineerの多段と玉座耐性と負債除外・闇市場×負債の回帰・CPUソーク16戦（膠着/例外/保存則違反0）。`node test/invariants.test.js` 緑（全プール混成fuzzで帝国カードを引いても保存則OK）／**npm test 全32スイート緑（exit 0）**。

### 【次にやること】Batch E2（既存VPトークン＆単独カード）
- `docs/research/empires_rules.md` §2 の E2＝sacrifice（廃棄→種別別ボーナス・VPも）/chariot_race（コスト比較→VP）/groundskeeper（場にある間 勝利点獲得毎VP）/forum（+3カード-2捨て・on-buy+1購入）/legionary（アタック）/enchantress（持続アタック＝相手の最初のアクションを+1c+1aに置換）/archive（3手番持続・脇3枚→1枚ずつ）/charm（財宝の二択＝獲得コピー）/villa（獲得で手札＋アクションフェイズ復帰）。プレイヤーVPトークン `p.vpTokens` は既存（繁栄）。個別裁定は §3 を着手時に再確認。

---

## 0-9. 段階2＝冒険（Adventures）実プレイ化 **全38枚＋Phase E昇格 完了・push待ち**（2026-07-08・WIP・未push）

**冒険は実プレイ可能（CARD_SET昇格済）＝残りは push（ユーザー確認）のみ**。着手前に `docs/adding-cards.md` と本節を必読。**未pushコミット（Batch1a〜6＋各レビュー修正＋Phase E）**。push すれば本番に反映。

### Phase E 完了（2026-07-08・CARD_SET昇格）＝`5fe688a`＋`09193bc`(UI誤購入修正)
- **配線**（js/cards.js）：`DOM.KINGDOM_ADVENTURES` 固定10種（page/peasant/guide/ranger/amulet/caravan_guard/haunted_woods/lost_city/artificer/hireling＝自作showcase）／`POOLS.adventures` から成長先8種を `POOLS.travellers` に分離（賞品prizesと同型＝random抽選から外す・page/peasant はサプライで adventures に残す）／`DOM.CARD_SETS` に `adventures`＋`random-adventures` の2行。成長山は page/peasant があるとき initSupply が各5枚設置（既存）。
- **UI**（js/ui.js）：非サプライの数値キー山（成長先/賞品/戦利品）を盤面に表示（`nonSupplyPile` セクション＝残枚数可視化・購入不可）。**Phase E自己検出のUXバグ修正**＝非サプライ山タップで誤購入ボタンが出た（`onPileTap`/`buyableId` が `canBuyCard` 未参照）→両方に `canBuyCard` 追加（高級市場/分割山下段の誤ハイライトも解消）。カード一覧に成長先グループ追加。
- **テスト新設**：`adventures.test.js`（44件）＋`adventures-ui.test.js`（40件）を package.json 登録。invariants の出荷セット検証に adventures/random-adventures 追加。
  - **回帰テスト（永続）**：玉座/王の宮廷/行進×Reserve 保存則／page/peasant×upgrade で$4が成長先のみ→獲得なし終了（デッドロック回帰）／swindler×成長先の贈与拒否／呪いの森×農地で詰まない・沼の妖婆×名品(過払い)で呪い発動・玉座×沼の妖婆の免疫が反応順独立／玉座×語り部×水晶玉で基本+1×2／使者の初回配布。
- **webp**：storyteller 再生成（2022エラッタ＝+1カード基本・目視確認済）。`sw.js` v35→**v36**。
- **多エージェント敵対レビュー（3次元＝配線/UI盤面/CPU出荷セット→敵対検証）＝確定バグ0件**（カード効果は Batch5/5c/6 で既にレビュー済み）。
- **検証**：npm test 全31緑（整合性3134・冒険44・冒険UI40）／Phase E CPUソーク（adventures/random-adventures・2〜4人・全難易度）**240戦=完走240・deadlock0・例外0・保存則0**（champion保持28P）／emptyPileCount が成長先の空を3山終了に数えないことを確認。

### 【次にやること】push（ユーザー確認）→ その後 帝国（Empires）段階2
- **push**：冒険を push すると本番 Pages/Render に「冒険セット」「冒険から」が出る（sw.js v36）。**ユーザー確認の上で** `git push`。
- **その後＝帝国（Empires）段階2**（別の大仕事・段階1[画像/カタログ]は §0-6 で完了済み）：負債Debt経済／集合=VPトークン山（農民の市場/神殿/野生の狩り）／命令(overlord/crown)／分割山5組（サウナ/アヴァント機構流用）／城8（騎士の混合山流用・勝利点）／villa(手札に獲得しアクションフェイズに戻る)。横型ランドスケープ（イベント/ランドマーク）は縦枠パイプライン未対応で段階1すら未着手。

### Batch6 完了（2026-07-08・複雑系4枚）＝`0b9c9d7`＋`92bb666`(レビュー修正)＝**これで冒険 全38枚 実装完了**
- **倒壊raze**($2)：+1アクション。これ（場のraze）か手札1枚を廃棄（強制・空手札でもraze自身を廃棄可）→廃棄カードの**現在コイン費用**分だけ山札の上を見て1枚を手札・残りを捨てる（`deck.shift` 直読み＝**-1カードトークンの影響を受けない**[公式ruling]）。玉座2回目で raze が場に無く手札も空なら pending を立てない。
- **工匠artificer**($5)：+1カード+1アクション+$1。手札を好きな枚数捨て→捨てた枚数**ちょうどの現在コスト**のカード1枚を**山札の上に**獲得してよい（任意・0枚→$0可・`!NON_SUPPLY.has(id)` を両側[anyGainable/canGain]で除外＝Batch5の教訓）。
- **語り部storyteller**($5・**2022エラッタ**)：+1アクション。手札から最大3枚の財宝をプレイ→**+1カード（基本）**＋所持コイン$1につき+1カード（既存＋財宝のコインを全て使い切る＝coins=0）。財宝が pending を立てる（遺物/法貨/掘出物/混成の水晶玉等）と中断→**reduce末尾の安全網 `t.storytellerResume` が解決後に残り財宝→変換を再開**。カタログ文を2022エラッタ（+1カード基本）に更新＝**Phase E で storyteller の webp 再生成が必要**（このPCのみ）。
- **使者messenger**($4)：+1購入+$2＋山札を捨て札にしてよい（プレイ効果・`triggerOnDiscard` を通さない＝Tunnel不発[公式]）。**そのターン最初の購入（`t.buysMade===1`）で買った**とき$4以下1枚を獲得し他の各Pが手番順にコピーを獲得（在庫がある限り）。購入以外の獲得では発動しない。
- 公式ルール研究（RGGルールブック逐語＋2022エラッタ）で裏取り＝storyteller の欠けていた基本+1ドロー／raze のコスト基準・玉座耐性・-1カードトークン無効を修正。新pending7種＋4点セット。UI: `modalMultiHand` に filter 追加（語り部の財宝限定選択）＋`t.buysMade` を freshTurn に追加。
- **多エージェント敵対レビュー（4次元→敵対検証・空試験で再現）＝確定バグ1件（偽陽性0）→修正（`92bb666`）**：
  - **[MED] 玉座/王の宮廷×語り部×割り込み財宝**：reduce末尾で runReplays（玉座の再演）が storytellerResume の再開より先に走り、1回目の語り部の財宝が pending を立てると、解決後に runReplays が2回目を先に発火→1回目の再開スキップ＋storytellerResume 上書きで**1回目の基本+1カード（王の宮廷なら最大2枚）＋残り財宝のコイン変換が失われる**（引き枚数誤り・保存則は保つ・CPU未到達＝人間操作限定）。→ **語り部の中断再開を runReplays より前で処理**（順次玉座＝1回目が完全解決してから2回目）。
- **許容簡略化**：champion/teacher/caravan_guard のボーナスは玉座/王の宮廷/門下生の再演では発火しない（PLAY_ACTION のみ）。
- **検証**：狙い撃ち32/32／invariants に「倒壊/工匠/語り部×遺物/使者×玉座/王の宮廷」の敵対王国追加＝全4緑／npm test 全29緑（整合性3132不変）／Batch6ソーク210戦=完走210・deadlock0・例外0・保存則0／throne×storyteller×水晶玉の回帰（基本+1×2＝正しいドロー）確認。

### Batch5c 完了（2026-07-08・純持続/アタック3枚）＝`b6424f6`＋`edbd8a4`(レビュー修正)
- **新機構＝「相手の購入をフックする持続」`applyLingerOnBuy`**：各Pの `delayedEffects` に発動元の予約（type＝swamp_hag/haunted_woods, immune[], **一意 rid**）を張り、`BUY`／`BLACK_MARKET_BUY` 末尾で「購入者≠発動元」の有効予約を発火。**無条件発動**（購入した以上フックは必ず効く）。予約は次の自分の手番開始時に `DURATION_RESOLVERS` で消費され窓が閉じる。物理カードは cleanup の持続保持で durationCards に残り予約消費後に捨て札へ。
- **沼の妖婆swamp_hag**（アタック持続）：即効果なし。次の自分の手番まで他Pの購入毎に呪い1枚（**予約1つにつき1枚**＝玉座で2枚）。次手番+$3。
- **呪いの森haunted_woods**（アタック持続）：即効果なし。次の自分の手番まで他Pの購入で手札を全て山札の上へ（複数予約でも1回）。次手番+3カード。
- **隊商の護衛caravan_guard**（持続＋リアクション）：+1カード+1アクション・次手番+$1。他Pのアタック時に手札から先にプレイしてよい（`hasReaction`＋`CARAVAN_GUARD_REACT`＝番犬/馬商人型・免疫にはならない）。**リアクションプレイ時の+1アクションは相手の手番なので加算しない**（相手に手番を与えない＝+1カードのみ効く）。相手の手番にプレイした caravan_guard は反応者の inPlay に残り、反応者の次の手番開始で+$1発火→その後の反応者の cleanup で捨て札へ（保存則OK）。
- **免疫**：プレイ時に確定＝champion/灯台の受動免疫(`attackImmune`)と堀公開者を予約の immune[] に記録（`markLingerImmune` は**その予約[rid]1つだけ**＝封鎖の gained と同型）。購入フックが immune の購入者を飛ばす。
- ATTACKS に haunted_woods/swamp_hag（onMoat＝免疫記録＋続行）＋新pending react（`LINGER_REACT`）。DURATION_RESOLVERS 3種。4点セット（CARAVAN_GUARD_REACT/LINGER_REACT＋PLAYER_ACTIONS＋CPU＋UI[reactOptions＋embedded窓3＋react モーダル]）。
- **多エージェント敵対レビュー（4次元→敵対検証・全件 空試験で再現）＝確定バグ2件（偽陽性0）→修正（`edbd8a4`）**：
  - **[HIGH] 呪いの森×農地のデッドロック＋素朴ガードの空振り**：購入フックが農地の廃棄pending成立後に手札を空にし FARMLAND_TRASH が解決不能→CPU無限ループ/人間詰み。素朴な `!state.pending` ガードは逆に「過払い/農地/高貴な山賊 購入時にフックを丸ごと免れる」空振りを生む。→ 根治：**FARMLAND_TRASH を手札空で終端**（公式：手札無しなら農地は何も廃棄しない）＋**applyLingerOnBuy を無条件化**＋UI農地に手札空スキップ。呪いの森×農地は農地が空振りするが詰まない（fuzz限定・許容簡略化）。
  - **[LOW] 玉座/王の宮廷×沼の妖婆/呪いの森の免疫過剰付与**：markLingerImmune が同型の予約を全走査し、後から堀を公開すると『既に受けた予約』まで遡って免疫化＝反応順で結果が0/1に割れた。→ 予約に**一意 rid**を付与し、堀公開はその予約1つだけを免疫に（per-window モデル維持＝受け→受けなら呪い2枚）。
- **許容簡略化**：champion/teacher/caravan_guard のボーナスは玉座/王の宮廷/門下生の再演では発火しない（PLAY_ACTION のみ）。呪いの森×農地の同時購入時は農地が空振り（fuzz限定＝出荷セットで両者は同居しない）。
- **検証**：狙い撃ち28/28＋レビュー回帰17/17／invariants に「呪いの森/沼の妖婆/隊商の護衛×玉座/王の宮廷」の敵対王国追加＝全4緑／npm test 全29緑（整合性3132不変）／持続中心ソーク240戦＋混成ソーク180戦（呪いの森/沼の妖婆×農地/名品/watchtower/闇市場）＝完走・deadlock0・例外0・保存則0。

### Batch5 完了（2026-07-07・トラベラー全10枚）＝`7c790b9`(5a)＋`86ab97c`(5b)＋`7cda556`(レビュー修正)
- **Batch5a（page/peasant＋成長先7枚）**：
  - **非サプライ山**：成長先8種（treasure_hunter/warrior/hero/champion/soldier/fugitive/disciple/teacher）を `NON_SUPPLY`／cpu `NON_SUPPLY_SET` に追加。`initSupply` が page あれば treasure_hunter/warrior/hero/champion を各5枚、peasant あれば soldier/fugitive/disciple/teacher を各5枚 supply に追加（**page/peasant のみサプライ・購入可**）。
  - **トラベラー交換窓**：`endBuyTail` を `endBuyTailSchemeOrCleanup` に分割し、その手前に `traveller_exchange` pending を挟む。交換＝場のトラベラーを supply へ返し次の成長先を supply から取り**捨て札へ**（`TRAVELLER_NEXT` 系列。**獲得でも廃棄でもない**＝on-gain/on-trash不発・treasure_hunter に数えない・次の山が空なら不可）。`TRAVELLER_EXCHANGE_RESOLVE`。
  - **champion＝永続持続**（hireling/prince型＝`p.champions` を cleanup の `cnt.champion` に加算し durationCards に残す）＋`attackImmune` に champion 条件追加＋`PLAY_ACTION` で**アクション使用毎に+1アクション**（自身のプレイは除外）。
  - **カード効果7枚**：page(+1c+1a)／peasant(+1購入+$1)／treasure_hunter(+1a+$1・右隣[pi-1]の直前手番の獲得数だけ銀貨・多重度カウント)／warrior(+2c・場のトラベラー数[自身含む]だけ各相手の山札上を捨て**ちょうど$3/$4[非ポーション]なら廃棄**・アタック)／hero(+$2・財宝1枚を強制獲得)／soldier(+$2・場の他アタック[inPlay+durationCards・自身除く]毎+$1・**手札4枚以上の各相手が1枚捨て**・アタック)／fugitive(+2c+1a・1枚捨て)／disciple(手札のアクション1枚を2度使い＋そのコピーを獲得・**非サプライ札はコピー獲得せず**)。
  - **新pending7種＋4点セット**：warrior/soldier react・soldier/fugitive discard・hero_gain・disciple_play・traveller_exchange。CPU decidePending 全分岐（交換は常に実施＝終端保証）＋UI viewPendingModal 全分岐。
- **Batch5b（teacher＝Reserve＋山トークン）**：
  - teacher プレイ→酒場マットへ。`TAVERN_START_CALLS` に teacher 追加＋呼び出し窓の開閉を `anyTavernStartCallable` に集約（teacher は置き先がある時のみ開く）。
  - **山トークン新機構 `p.pileTokens = {card|action|buy|coin: 山id}`**（各種別1つ・各山1つまで・**公開情報＝非カードで保存則に無関係**・maskStateFor の Object.assign で残る）。呼び出し＝`teacher_call`（stage token→pile）でトークン1つを「自分のトークンが無いアクションのサプライ山」へ移動。**`validTeacherPiles(state,pi)`＝置き先候補**（非サプライ/騎士/分割山下段除外・**山が空でも可**＝公式）＝engine/CPU/UI で共有（公開API）。
  - **ボーナス `applyPileTokens`**：その山のカードをプレイしたとき、**効果解決より前に** +1カード/アクション/購入/コイン（`PLAY_ACTION` 内）。UI：サプライ山に教師トークンのバッジ（`pileTokenBadge`＋`.pile-tokens` CSS）。
- **公式ルール研究（wiki/RGG裏取り）で事前修正2点**：disciple のコピー獲得は非サプライ札を除外／warrior の廃棄は非ポーション$3/$4のみ。
- **多エージェント敵対レビュー（6次元→敵対検証・全件 空試験で再現）＝確定バグ4件（偽陽性0）→全修正（`7cda556`）**：
  - **[HIGH] exact-cost 強制獲得のCPUデッドロック**＝upgrade/remake/governor_remodel/forge が anyGainable/canGain で NON_SUPPLY を除外せず、ちょうど$Nの受け皿が成長先(warrior/fugitive=$4等)しか無いと CPU の bestGainExact が card:null を返し続け pending が閉じない無限ループ（$4は基本カードに受け皿が無く確実に嵌る）＋人間の不正獲得。両側述語に `!NON_SUPPLY.has(id)` 追加（farmland と同型）。
  - **[MED] 詐欺師(swindler) の贈与**＝pickSwindlerGift＋swindlerTrash の anyGainable＋SWINDLER_GAIN の canGain が NON_SUPPLY 未除外で同コストの成長先(champion/teacher等)を被害者に贈与できた（**賞品Prizes にも波及する潜在バグ**）。3箇所そろえて除外。
  - **[LOW] soldier の「+$1/他アタック」が durationCards を無視**＝inPlay＋durationCards の両方から数える。
  - **[LOW] validTeacherPiles が空アクション山を不当に除外**＝公式は空の山にも置ける。残枚数条件を外す。
- **許容簡略化（意図的・研究で公式挙動を確認済だが未対応）**：**champion の+1アクション／teacher の山トークンのボーナスは、玉座/王の宮廷/門下生の再演では発火しない**（`PLAY_ACTION` のみ・再演は `applyEffect` 経由）。公式は各再演で発火するが、冒険の固定出荷セットに玉座/王の宮廷は入らない見込み＝shipping影響ゼロ・保存則影響なし。
- **検証**：狙い撃ち 5a=54/54・5b=15/15・レビュー修正 12/12／invariants に「page/peasant×玉座/王の宮廷」「page/peasant×upgrade/remake/forge/swindler」の敵対王国2つ追加＝全4緑／npm test 全29緑（整合性3132不変）／トラベラー中心ソーク 5a=250戦・5b=220戦（完走・stuck0・例外0・保存則0）。

### 残り＝push（ユーザー確認）→ 帝国段階2　※Phase E は完了済み（上の「Phase E 完了」節が詳細）
冒険は**全38枚＋CARD_SET昇格まで完了**＝実プレイ可能。残るは push（本番反映・ユーザー確認）のみ。その後は帝国（Empires）段階2。

### Batch3 完了（2026-07-07・トークン基盤＋トークン系4枚）
- **トークン基盤3種**（すべてスカラー公開情報・`maskStateFor` の `Object.assign` でそのまま残る・JSONセーフ・旧スナップショット後方互換）：
  - **旅トークン `p.journeyDown`**（false=表向き。山守/巨人が**共有**・プレイ毎に裏返す＝per-player）。
  - **-1カードトークン `p.minusCard`**（遺物。単一boolean・非スタック）＝**`draw()` 冒頭にフック**して「次に1枚以上引くドロー」を1枚減らして返す（cleanup先引き限定でなく開始時持続ドロー等どの引きにも効く＝公式忠実。研究エージェントの指摘で cleanup限定案から変更）。
  - **-$1トークン `p.minusCoin`**（橋の下のトロル。単一boolean・非スタック）＝`END_ACTION_PHASE` で `t.coinPenalty` に変換し、`applyCoinPenalty(state)` が**購入フェイズで最初に得る$1に食い込む**（財宝＝`playTreasureCard` 末尾／財源＝`COFFERS_SPEND`／行動フェイズ稼ぎ＝END_ACTION_PHASE時に相殺）。**$0未満にならない**（`max(0,...)` 相当）。素朴な「buy開始時に coins-1」は財宝ぶんに効かず**トークンを空振り消化する誤り**＝回避済み（研究＆敵対レビューで確認）。`freshTurn` に `coinPenalty:0`。
- **4枚**（各 engine reducer＋PLAYER_ACTIONS＋CPU decidePending＋UI viewPendingModal＋新pendingの終端保証）：
  - **山守ranger**($4)：+1購入・旅トークンを裏返してから判定（**flip-then-check**＝初回は+5なし・2回目に+5カード・以後交互）。
  - **巨人giant**($5・アタック)：旅トークンを裏返す。裏で+$1／表で+$5＋アタック（各相手の山札上を公開＝$3-6は `trashCard` で廃棄[城塞/ネズミ等on-trash発火]・他は捨てて呪い。**山札空でも呪いを獲得**）。marauder型＝ATTACKS登録＋堀react窓（GIANT_REACT）。
  - **遺物relic**($5・財宝アタック・`coin:2`)：+$2＋各相手に-1カードトークン。marauder型（RELIC_REACT）。`playTreasureCard` で発火＝PLAY_ALL_TREASURES は pending で停止し残り財宝は再発行で継続（charlatan と同型）。
  - **橋の下のトロルbridge_troll**($5・持続アタック)：各相手に-$1トークン＋今と次+1購入＋**このターンと次ターン全カード$1安い**（`t.costReduction`。**コスト軽減はスタック**・-$1トークンは非スタック）。`DURATION_RESOLVERS.bridge_troll` が次手番開始時に +1購入＋costReduction を再付与（アタックは初回のみ）。玉座×トロルも seaside 持続の armDuration+cnt 機構でそのまま動く。
- **CPU**：chooseAction に bridge_troll/giant/ranger（冒険ターミナル群）。decidePending に relic/giant/bridge_troll の react（堀→MOAT_REVEAL／無ければ X_REACT・効果は自動）。relic は財宝＝chooseAction不要。GAIN_ORDER は既に全id網羅。
- **UI**：viewPendingModal に relic/giant/bridge_troll の react モーダル（reactOptions）。盤面に冒険トークンのバッジ表示（旅=裏向き時のみ・-1カード・-$1）。
- **検証**：狙い撃ち60/60（flip-then-check・空山呪い・-$1が財宝/財源に食い込む・堀防御・持続の持ち越しとコスト軽減継続・旅トークン共有）／invariants全プール混成fuzz緑（exit0）／npm test 全29緑（整合性3132不変）／冒険中心120戦ソーク=膠着0・保存則0・例外0・トークン異常0。
- **敵対レビュー（多エージェント5次元→敵対検証）＝確定バグ1件（偽陽性0）→修正済**：**-$1トークン×財源**＝財宝を出さず財源(Coffers)だけで賄うターンで `COFFERS_SPEND` が `applyCoinPenalty` を呼ばず、トークンが空振り（保存則は保つが ruling#3 逸脱・全プールfuzzで到達可）→ COFFERS_SPEND に `applyCoinPenalty(state)` を追加＋回帰テスト。
- **許容簡略化**：-1カードトークンの「相手ターン中のリアクションドロー（隊商の護衛等）で先に消化される」厳密タイミングは未対応（隊商の護衛は未実装・研究でも relic への反応ドローはトークン付与前に解決＝影響なしと確認）。書庫の `p.deck.shift()` 直接ドローは draw() を通らないので -1カードが効かない（書庫は冒険外・稀）。

### Batch4 完了（2026-07-07・酒場マット/Reserve 全9枚）＝`34aa8c4`(4a)＋`98e483b`(4b)＋レビュー修正
- **酒場マット `p.tavern[]` ゾーン基盤**（公開＝islandMat型）：player初期化・`allCards`（VP/庭園/公爵に数える）・**invariants の ZONES に `'tavern'` 追加**・maskStateFor は Object.assign で公開のまま。cleanupAndAdvance はマットに触れない（呼び出しまで残る）。`putOnTavern()`＝Reserve をプレイ直後に場→マットへ移す共通入口（**island/祝宴と同じ自己移動ガード必須**＝下記バグ参照）。
- **Batch4a（6枚・自己完結トリガー）**：守銭奴miser(手札の銅貨をマットへ／マットの銅貨1枚+$1・非Reserve)／遠隔地distant_lands(マット上で4VP＝`vpOf`専用clause・固定vpは持たせない)／鼠取りratcatcher・案内人guide・変容transmogrify(ターン開始コール＝`resolveDurationStartEffects`で`tavern_start`をstartQueueへ→`TAVERN_START_CALL`で1枚ずつ→効果→`offerTavernStart`で再オファー)／ワイン商wine_merchant(購入フェイズ終了コール＝END_TURNの後処理を`endBuyTail()`に抽出しその前に窓を挟む)。
- **Batch4b（3枚・外部トリガー）**：法貨coin_of_the_realm(財宝・`coin:1`)／御料車royal_carriage(アクション再演＝`state.replay`にlabel:'royal_carriage')＝**アクション解決直後フック**（PLAY_ACTIONで`t.afterActionCard`を記録→reduce()末尾ネットが`after_action`窓→`AFTER_ACTION_CALL`が保持したまま再オファー・辞退/候補ゼロ/END_ACTION_PHASEでクリア）。複製duplicate＝**獲得時フック**（triggerOnGainの対話ゲート末尾・$6以下・自手番・トップレベル→`DUPLICATE_CALL`はpending保持でコピーgain＝入れ子オファー抑止→別の複製で再オファー）。
- **新pending8種**（miser/tavern_start/ratcatcher_trash/transmogrify_trash/transmogrify_gain/wine_merchant/after_action/duplicate）＝すべて engine reducer＋PLAYER_ACTIONS＋CPU decidePending＋UI viewPendingModal＋終端保証（呼び出しでReserveが場へ移り消費＝有限）。
- **敵対レビュー（多エージェント6次元→敵対検証）＝確定バグ1件[HIGH]（偽陽性0・空試験で再現確認）→修正済**：**`putOnTavern` が `removeOne(inPlay)` の成否を無視して push**＝玉座/王の宮廷/行進でReserveを複製プレイすると2回目の`applyEffect`で「場に無いのにマットへ push」→**マットに幻のカードが増殖（保存則違反）**。→ island/祝宴/宝の地図と同じ `if(removeOne(p.inPlay,cardId)){...push...}` ガードに修正。行進×Reserve は「マットへ移動＝lose track で廃棄不発・格上げは獲得」で公式どおり。invariants に玉座/王の宮廷/行進×Reserve の敵対王国を追加（CPU駆動＝ベストエフォート）。**Phase E の adventures.test.js で throne/KC/procession×Reserve の強制保存則テストを必ず入れること**（CPUが必ずしもReserveを玉座対象に選ばないため）。
- **許容簡略化（意図的）**：(1)1獲得につき on-gain 対話は1つだけ（複製の窓は他の on-gain 対話が立たない獲得でのみ）(2)複製のコピー gain は「コピー自身の on-gain 対話」を抑止（pending保持のため。border_village等をコピーしても格下げ獲得の対話は出ない・自動on-gainは発火）(3)アクション解決直後の窓は**トップレベルの PLAY_ACTION のみ**（呼び出したReserveや玉座サブプレイでは開かない）。いずれも保存則OK・非ループ。
- **検証**：狙い撃ち 4a=40/40・4b=34/34・回帰(玉座/KC/行進×Reserve)=17/17／invariants全プール混成fuzz緑／npm test 全29緑（整合性3132不変）／酒場マット中心ソーク 4a=135戦・4b=135戦・全機構混成200戦（膠着0/保存則0/例外0/tavern異常0）。

### この着手順の理由（重要）
- **冒険/帝国は fuzz（invariants.test.js §B「全プール混成」）が引く**＝1枚実装した瞬間から「完全な4点セット（engine reducer＋PLAYER_ACTIONS＋CPU decidePending＋UI viewPendingModal）＋新pendingの終端保証＋新ゾーンの保存則tally配線」が必須。段階1の無効果カードのうち一部だけ効果化すると fuzz が壊れる。
- そこで**新ゾーン不要・既存機構だけで足せるカードから**着手中（安全順）：単純→純粋な持続→（次）トークン→（次）酒場マット/Reserve→（次）トラベラー→複雑。

### 完了（各バッチ＝fuzz緑＋狙い撃ちテスト＋全29スイート緑でコミット済み）
- **Batch1a**（`9d60c22`）単純4枚：**港町port**(+1c+2act・on-buyでもう1枚＝BUY内)／**失われし都市lost_city**(+2c+2act・on-gainで他全P+1カード)／**カササギmagpie**(公開→財宝は手札・アクション/勝利点でカササギ獲得)／**掘出物treasure_trove**(財宝・`coin:2`追加・金貨+銅貨獲得)。
- **Batch2**（`71d93f5`）純粋な持続3枚：**雇人hireling**(永続持続＝princes同型。`p.hirelings`稼働数を cleanup cnt に加算し durationCards に残す／resolveDurationStartEffects で各手番開始時+1カード)／**地下牢dungeon**(+1act・今と次の手番に+2カード→2枚捨て・次ぶんは startQueue)／**道具gear**(+2c・手札最大2枚を脇→次手番に戻す＝haven型)。
- **Batch2b**（`5b094a3`）**魔除けamulet**(持続・今と次の手番にそれぞれ +$1／手札1枚廃棄／銀貨獲得 の3択。次ぶん startQueue=viaStart・trashは amulet_trash サブpending)。

### 重要な設計事実（次セッションが知らないと事故る）
- **このエンジンの手番タイミング**＝`cleanupAndAdvance` は「自分の手番終了時に**自分の次の手札を先引き**（draw 5）」してから次プレイヤーへ回す。**持続の「手番開始時」効果（`resolveDurationStartEffects`）は手番が戻ってきた時に発火**し、先引き済みの手札に加算される（例：雇人は5枚先引き＋開始時+1＝6枚）。テストで「手番開始効果」を確認するときは END_TURN 1回では足りない（相手を回して自分の手番へ戻す）。
- **-$1/-1カード/旅トークンは Batch3 で実装済**（実装詳細は上の「Batch3 完了」節）。-$1は coins を負にできない＝`applyCoinPenalty`（`t.coinPenalty` を「最初に得る$1」に食い込ませる。素朴な「buy開始時に coins-1」は財宝ぶんに効かず空振り＝**採用しないこと**）。-1カードは `draw()` 冒頭フック（cleanup先引き限定ではない）。旅=`p.journeyDown`（false=表向き・山守/巨人が共有・flip-then-check）。
- **財宝の実プレイ化には `coin:` が要る**（段階1カタログには無い）。`treasureCoins`=`C()[id].coin`。表示テキスト不変＝**webp再生成不要**。relic に `coin:2` 追加済（掘出物と同型）。

### バッチ進捗（着手順・完了状況）
1. ~~**Batch3＝トークン基盤＋トークン系カード**~~ ✅ **完了**＝ranger/giant/relic/bridge_troll＋旅/-1カード/-$1トークン。
2. ~~**Batch4＝酒場マット/Reserve 基盤＋Reserveカード9枚**~~ ✅ **完了**＝守銭奴/遠隔地/鼠取り/案内人/変容/ワイン商/法貨/御料車/複製。
3. ~~**Batch5＝トラベラー（page/peasant＋成長先8）**~~ ✅ **完了（2026-07-07）**＝上の「Batch5 完了」節が詳細。
4. ~~**Batch5c＝純持続/アタック3枚（隊商の護衛/呪いの森/沼の妖婆）**~~ ✅ **完了（2026-07-08）**＝上の「Batch5c 完了」節が詳細。
5. ~~**Batch6＝複雑4枚（倒壊/工匠/語り部/使者）**~~ ✅ **完了（2026-07-08）**＝上の「Batch6 完了」節が詳細。**これで冒険 全38枚のカード効果 実装完了**。
6. ~~**Phase E＝CARD_SET昇格**~~ ✅ **完了（2026-07-08）**＝上の「Phase E 完了」節が詳細。**冒険は実プレイ可能**。
7. **【次はここ】＝push（ユーザー確認）→ その後 帝国（Empires）段階2**。

---

## 0-8. 段階2＝暗黒時代56枚 実装 **完了**（2026-07-06・全56枚実プレイ化＋UI＋テスト＋CARD_SET昇格＋敵対レビュー修正）

### 完了サマリ（2026-07-06。**`8a6f430` まで push済＝本番 Pages/Render に反映済み（sw.js v35）**）
- **カード効果56/56枚 実装完了**。前回までの24枚に加え、今セッションで残り32枚を Group A〜E で実装（各 engine reducer＋PLAYER_ACTIONS＋CPU decidePending＋UI viewPendingModal の4点セット）:
  - **A（素直系）** junk_dealer/mystic/altar/bandit_camp/catacombs/hunting_grounds＋feodum VP。**on-trash対話キュー `state.onTrashQueue`** を新設（地下墓所/狩場/従者の獲得対話をアタック中の廃棄と競合させず reduce 末尾で1件ずつ消化）。
  - **B（trash-to-gain）** graverobber/rebuild/count。
  - **C（複雑）** band_of_misfits(命令)/death_cart(on-gain廃墟2)/hermit(狂人交換=buyPhaseGainedフラグ+END_TURN)/counterfeit(財宝2回)/procession(runReplaysにprocession2/procession_finishラベル)。
  - **D（アタック）** marauder/cultist(連鎖)/pillage/rogue/urchin(→傭兵)/mercenary＋汎用 `discard_down`（民兵型embedded・浮浪児4/傭兵3/sir_michael3で共用）。
  - **E（騎士10種）** 混合山アタック（上2枚公開→被害者が$3-6を選び廃棄→騎士なら攻撃騎士も相討ち=sourceCard）。dame_anna/natalie/sir_michael の前段対話・sir_martin($4)・sir_vander(相討ちで金貨)・dame_josephine(2VP)。
- **【実バグ修正2件（副産物）】** (1)`reshuffleDeck` が山札を**置換**しており、山札の上N枚を見る系（旅の楽団/生存者/地下墓所）が残り<Nの非空山札で札を消失させる保存則バグ→**append方式**に修正（全プール混成fuzzで検出）。(2)CPUの `discard_down` に堀チェック漏れ→既存の汎用アタック免疫テストが捕捉→修正。
- **UI**：全pending（既存24＋新32）のモーダル＋混合山（騎士＝一番上表示・廃墟＝獲得専用の山表示）。
- **テスト新設**：`darkages.test.js`（70件・経路別on-trash＝城塞×礼拝堂/狂信者×死の荷車/封土×騎士 ほか＋敵対レビュー回帰8件）＋`darkages-ui.test.js`（57件）。`package.json` 登録。**全29スイート緑（整合性3132）**。
- **CARD_SET昇格**：`DOM.KINGDOM_DARKAGES`＝公式「Grim Parade」（armory/band_of_misfits/catacombs/cultist/forager/fortress/knights/market_square/procession/hunting_grounds）＝`darkages` 固定セット＋`random-darkages`。**避難所は「王国が KINGDOM_DARKAGES と内容一致」で `createInitialState` が自動ON**（opts不要＝local/再戦/オンライン全経路で機能）。random系はOFF。invariants の出荷セット検証にも追加。
- **敵対レビュー（多エージェント8次元→敵対的検証・確定10件/偽陽性0）→全10件修正**（コミット `587e747`）:
  - **リアクション3種を新規実装**（§0-8決定4の既知TODO・出荷darkagesセットで到達）：青空市場(on-trash→金貨)・納屋(on-gain勝利点→廃棄)・物乞い(被弾時→銀貨2枚・免疫にはならない=horse_traders型)。
  - はみだし者の対象から騎士の混合山 'knights' を除外（無効果の死に選択肢だった。captainTargetsも）／BoM×死の荷車の自身廃棄を不発化(fromCommand)／偽造通貨×偽造通貨の2回目+1購入を追加／傭兵の1枚廃棄を許可(効果不発)／浮浪児の狂信者連鎖トリガー(maybeUrchinTrap)。
- **webp9枚再生成**（hermit/procession/pillage/death_cart/rats/counterfeit/marauder/cultist/band_of_misfits＝§0-8でカタログを現行エラッタに更新した分）→ `sw.js` v34→**v35**。death_cart/band_of_misfits を目視確認。
- **CPUソーク**：出荷2セット（darkages/random-darkages・2〜4人・全難易度）**280戦 完走280/stuck0/保存則0/例外0**（納屋反応175回発火）。

### 残タスク・許容簡略化（詳細は下の「決定事項」「詰まり」参照）
- **push 済（`8a6f430`・2026-07-06）**＝本番 Pages/Render・sw.js v35 反映済み。**次の大仕事＝冒険/帝国の段階2（§5-2）**。
- **許容簡略化（意図的・再議論しない）**：浮浪児→傭兵の玉座/行進経由リプレイは未対応（狂信者連鎖のみ対応・低頻度＆任意得のみ）／on-trash対話キューと廃棄札の続きの獲得の順序は多少前後し得る／band_of_misfits・procession は持続カードを対象外（船長と同型）／納屋on-gainは自分の手番のトップレベル勝利点獲得のみ（相手ターン/入れ子獲得の稀な反応は未対応）。

### （以下は実装中の設計メモ＝リファレンスとして保持。現在は上の「完了サマリ」が最新）
### 旧・現在地（実装当時のメモ）
- **完了①＝公式ルール研究**（成果物＝**`docs/research/darkages_rules.json`**＝55枚の現行英文/エラッタ/裁定/山構成、**`docs/research/darkages_catalog_diff.md`**＝差分レポート）。**実装前に該当カードを必ず読む**。
- **完了②＝カタログ現行化**（cards.js/carddata.js/integrity.test.js。エラッタ6枚＋looter/command種別。整合性3130）。
- **完了③＝triggerOnTrash 自動系6枚**（城塞=手札へ戻り戻り値false／ネズミ・草茂る屋敷=+1カード／封土=銀貨3／サー・ヴァンダー=金貨1／狂信者=+3カード。誰の廃棄でも持ち主に発動）。
- **完了④＝trashCard 統一関数＋on-trash第2層配線（今セッション）**：`trashOwn`→`trashCard(state,owner,card)`にリネーム＋**戻り値=trashに残ったか**（城塞=false）。本人任意廃棄（礼拝堂/司教/改築/拡張/溶鉱炉/仮面舞踏会/引揚水夫/金貸し/取壊し/身代わり/総督/鉱山/改良/衛兵/見張り/物見やぐら/水晶玉/remake/forge/sentry/salvager/bishop等）とアタック廃棄（詐欺師/破壊工作員/山賊/盗賊thief/私掠船corsair＝owner=被害者）を寄せた。明示除外（自己廃棄札=投資/祝宴/宝の地図/鉱山の村/豊穣の角・lurkerのサプライ廃棄）は据え置き。
- **完了⑤＝基盤機構（今セッション）**：**混合山**＝騎士は`supply.knights`（数値・王国枠・購入可）＋`state.knights`（実カード配列）／**廃墟は`state.ruins`配列のみ**（`'ruins'`はカタログ非在＝supplyに持つとCPU/UIのsupply走査が`C()['ruins']`で落ちるため）。gain冒頭で山先頭を実カードid（survivors/sir_martin）に解決しshift。`cardCost('knights')`=山の一番上の実コスト（sir_martin=$4）。`canBuyCard('ruins')`=false。emptyPileCountで`state.ruins.length===0`を明示加算。maskStateForで混合山は先頭1枚だけ公開。invariants tallyは混合山を実カード(state.ruins/knights)で数え supply数値のruins/knightsはskip。非サプライ＝NON_SUPPLYにspoils/madman/mercenary追加。避難所＝`opts.shelters`で開始デッキの屋敷3枚→納屋/共同墓地/草茂る屋敷。initSupply条件節＝rats20固定・looterで廃墟state・spoils15/madman10/mercenary10。**全プール混成fuzz緑**。
- **完了⑥＝カード効果24/56枚（今セッション）**：単純15（廃墟4種abandoned_mine/ruined_library/ruined_market/ruined_village・城塞・共同墓地・貧民街poor_house・放浪者vagrant・賢者sage・物乞いbeggar・狂人madman・青空市場market_square・戦利品spoils）＋対話9（生存者survivors・ネズミrats・武器庫armory・採集者forager・従者squire+on-trashアタック獲得・倉庫storeroom・清掃scavenger・鉄物商ironmonger・放浪楽師wandering_minstrel）。**engine reducer＋PLAYER_ACTIONS＋CPU decidePending の4点セット済み（UIは未実装）**。CPU側は`NON_SUPPLY_SET`（PRIZE_SET＋戦利品/狂人/傭兵）で汎用獲得の無限ループを防止。
- **未着手（残り）**：**カード効果32枚**＝中盤14（屑屋junk_dealer/秘術師mystic/墓暴きgraverobber/地下墓所catacombs/建て直しrebuild/伯爵count/はみだし者band_of_misfits(命令)/盗賊rogue/略奪pillage/山賊の宿営地bandit_camp/偽造counterfeit/狩場hunting_grounds/祭壇altar/隠遁者hermit）＋アタック（略奪者marauder/狂信者cultist/傭兵mercenary/浮浪児urchin）＋**騎士10種**＋death_cart(on-gain廃墟2枚)。／**UI**（viewPendingModal 新pending分岐＋混合山top表示）／**darkages.test.js・darkages-ui.test.js**／**CARD_SET昇格**（darkages固定10種＋random-darkages）／敵対レビュー＋CPUソーク／webp9枚再生成＋sw.js v35。

### 決定事項（ユーザー委任により確定。再議論しない）
1. **避難所＝固定 `darkages` セットのみON**（`createInitialState` の `opts.shelters`。CARD_SET昇格時に darkages だけ true を渡す）／random系はOFF。
2. **on-trash第2層は完了④で配線済み**。第1層＝新規暗黒時代カードは最初から `trashCard` を使う。第3層＝lurker/自己廃棄札は明示除外（据え置き）。
3. **経路別の明示テスト必須**（保存則fuzzは「城塞がtrashに残ったまま」を検知できない）：城塞×礼拝堂／狂信者×死の荷車／封土×騎士 等をdarkages.test.jsに。
4. 対話系on-trash（catacombs=安い獲得／hunting_grounds=公領or屋敷3／squire=アタック獲得）とリアクション（market_square/hovel/beggar）は pending/キューが別途必要。**squireのon-trashは`!state.pending`ガードの簡略実装済み**（複数on-trash競合は先着のみ＝許容簡略化）。catacombs/hunting_groundsのon-trash対話はまだ未実装。

### 実装設計の要点（下敷き＝§0-7の各機構＋docs/adding-cards.md。裁定の正本＝docs/research/darkages_rules.json）
- **混合山（実装後の確定形）**＝**騎士**は`supply.knights`＋`state.knights`（購入・獲得とも `gain(pi,'knights')` で山先頭を取る）。**廃墟**は`state.ruins`のみ（`gain(pi,'ruins')`で配布。購入不可）。`gain`は`isMixed`分岐で `state[cardId].shift()` し、supply.knightsがあればデクリメント。UIは混合山を「先頭1枚（maskで公開）」で描画する（Todo10）。
- **騎士アタック**＝thief/saboteur型の複合（山札上2枚公開→$3-6を**被害者が選んで**廃棄→残り捨て札→**騎士が廃棄されたら攻撃騎士も廃棄**）。dame_anna（先に自分の廃棄≤2）/sir_michael（先に手札3枚まで捨て=民兵型）/dame_natalie（≤$3任意獲得）は前段付き。cardCost('knights')は山の一番上で変動。
- **はみだし者(band_of_misfits・命令)**＝既存 captainTargets/CAPTAIN_PLAY の同型（上限=自身の現在コスト-1・非Command・サプライに残したまま使用）。
- **隠遁者交換(hermit)**＝END_TURN（cleanup前）で「購入フェイズ中にgainゼロ」判定→隠遁者を山へ戻し狂人を捨て札へ（**gainでなく交換＝獲得フック不発・狂人山空なら不成立**）。turn に「購入フェイズ中に獲得したか」の旗が要る。
- **death_cart**＝on-gain（triggerOnGain）で廃墟2枚を`gain(pi,'ruins')`。プレイ時は「これ or 手札のアクション1枚を廃棄（任意）→廃棄したら+$5」。
- **主要裁定**（rules.json rulings 参照）：行進×城塞=廃棄成立で獲得実行／浮浪児=「**先に**」廃棄→傭兵獲得→アタック解決／青空市場=相手ターンでも・1廃棄に複数枚反応可／偽造通貨×戦利品／伯爵count=独立2段階の三択。

### 次の一歩（この順で・各グループ末で `node test/invariants.test.js` 緑を確認しコミット）
1. **カード効果の残り32枚**：素直なpending（屑屋/秘術師/墓暴き/地下墓所/建て直し）→ アタック（略奪者/狂信者/略奪/傭兵/浮浪児/盗賊）→ **騎士10種**（混合山アタック）→ 複雑（伯爵count/はみだし者band_of_misfits命令/隠遁者hermit交換/death_cart on-gain/catacombs・hunting_groundsのon-trash対話/counterfeit/altar）。各カード engine reducer＋PLAYER_ACTIONS＋CPU decidePending の4点セット必須（UIは2.でまとめて）。
2. **UI**（ui.js `viewPendingModal` に新pending分岐＋混合山topの盤面表示）。
3. **darkages.test.js / darkages-ui.test.js 新設**（経路別on-trashテスト＝城塞×礼拝堂/狂信者×死の荷車/封土×騎士 は必須）。
4. **CARD_SET昇格**（DOM.CARD_SETS に darkages固定10種＋random-darkages。darkagesにだけ `opts.shelters=true` を渡す配線）→ **全27+スイート緑**（新スイート含む）。
5. 敵対レビューWorkflow→確定バグ修正→CPUソーク（240戦級）。
6. **webp9枚再生成**（hermit/procession/pillage/death_cart/rats/counterfeit/marauder/cultist/band_of_misfits＝文言/種別変更ぶん。`CARDS_ONLY=<ids> node tools/build-cards.js`・このPCのみ可）→ sw.js v34→v35 → PROGRESS更新 → コミット（**pushはユーザー確認**）。

---

## 0-7. 段階2＝新プロモ6枚（王子/船長/教会/サウナ/アヴァント/へそくり）を実プレイ化（2026-07-05 完了）

### 結論
- **新プロモの王国カード6種を段階2（実プレイ・現行エラッタ準拠）で実装完了**。`DOM.CARD_SETS` に `promo2-pack`（固定10種＝moat/village/militia/smithy/market＋stash/prince/captain/church/sauna）を追加し**出荷済み**。既存 `random-promo`（basic+intrigue+promo 抽選）でも 6種が実プレイになった。`sw.js` v33→**v34**。テスト **27スイート全緑**（`promo2.test.js` 141件＋`promo2-ui.test.js` 22件を新設・`package.json`登録・`invariants` に `promo2-pack` セット＋`princes` ゾーン追加）。整合性 3115→**3122**。CPU序列 100/64/95 維持。
- **公式ルールは多エージェント研究＋敵対検証Workflowで確定**（wiki.dominionstrategy.com/wikiwiki/RGG公式FAQ で裏取り）。**王子/船長は現行エラッタで種別が アクション-持続-命令（Action-Duration-Command）に変更**済み＝それを採用（王子=2022改訂・船長=2019改訂。「動かさずに使用」＝場に出さずプレイ）。webp（prince/captain）を新種別・新文言で再生成。carddata に `アクション・持続・命令` の複合ラベル追加。
- **新機構をすべて新設（簡略化なし）**：
  - **分割山（サウナ/アヴァント）**＝10枚1山（上5サウナ・下5アヴァント）。`supply.sauna/avanto` 各5＋「上が尽きるまで下は取れない」を **4系統ガード**（`gain()`冒頭・`canBuyCard`・`emptyPileCount`はペアで1山・CPU `splitBlocked`）で表現。抽選 `randomKingdom` は avanto→sauna に正規化（1山ぶんの枠）。`createInitialState` が sauna⇔avanto を相互補完。**`finishGain`/`SMUGGLERS_GAIN` は gain() の戻り値を検証**（拒否カードで pending を閉じない）。
  - **サウナ/アヴァント連鎖**（`sauna_chain` pending）＝アクション権を消費せず相方をプレイ。**サウナの銀貨トリガー**＝`t.saunaPlays`（このターンの使用回数）ぶん、銀貨を使うたび手札1枚を廃棄してよい（`sauna_trash` pending・+2コイン計上後・玉座で累積）。`playTreasureCard` の銀貨分岐＋TIARA_PLAY の2回目にも配線（§敵対レビューで後者の漏れを修正）。
  - **教会**（アクション-持続）＝手札最大3枚を伏せて脇（`church_setaside`）→次ターン開始時に手札へ戻し任意廃棄（`DURATION_RESOLVERS.church`→`church_trash` を startQueue へ・0枚でも廃棄機会）。脇置きは相手にマスク（setAside＋delayedEffects.stashed 両方伏せる）。
  - **船長**（アクション-持続-命令）＝現在と次ターン開始時、サプライの $4以下・非持続/命令アクションを**サプライに残したまま**使用（`captain` pending・`captainTargets` を engine/CPU/UI で共有）。自己移動（採掘村の廃棄等）は removeOne 失敗で**自然に不発**（+2コインも出ない＝公式）。次ターンぶんは `DURATION_RESOLVERS.captain`→startQueue。アタックもサプライから通常どおり機能（堀/リアクション窓OK）。
  - **王子**（アクション-持続-命令・現行）＝手札の $4以下・非持続/命令アクションを脇（`p.princes[]`）に置き（`prince_setaside`）、**毎ターン開始時に脇のまま強制プレイ**（`prince_play`・resolveDurationStartEffects が startQueue へ）。置いた王子は**持続としてゲーム終了まで場に残る**（cleanupAndAdvance が `cnt.prince += princes.length`）。脇のカードも所有カード（`allCards` に princes）。玉座×王子＝2枚脇置き（現行公式）。自己移動する対象（島/宝の地図）は複製しない＝removeOne ガード（§敵対レビューで island の欠落を修正）。
  - **へそくり**（財宝$5+2コイン）＝「シャッフル時に山札の好きな位置へ」。シャッフルは効果解決中に同期発生し対話を挟めない（業界最大手も未実装の難物）ため、**常設方針 `stashPlacement`（top既定/mix/bottom・`STASH_SETTING` で本人がいつでも変更）で自動配置**。全リシャッフルを共通入口 `reshuffleDeck(p)`（37箇所を一括置換）＋`placeStash(p)` に集約。裏面が異なる＝**山札/手札/脇のへそくり位置は公開情報**（maskStateFor が位置だけ晒す）。
  - **startQueue 安全網**（`reduce()` 末尾）＝王子/船長がターン開始時にアタック等を使うと連鎖の終端が pending=null で閉じるだけで後続の開始時効果を取り残す→「pending無し＆startQueue残」を検知して popStartQueue する一括救済。
- **新pendingは全て4点セット**（engine reducer＋PLAYER_ACTIONS＋CPU decidePending＋UI viewPendingModal）＝8種（PRINCE_SETASIDE/PRINCE_PLAY/CAPTAIN_PLAY/CHURCH_SETASIDE/CHURCH_TRASH/SAUNA_CHAIN/SAUNA_TRASH/STASH_SETTING）。CPU＝chooseActionに6枚＋`bestPrinceTarget`（PRINCE_AVOID=島/宝の地図）＋chooseBuyのstash分岐＋GAIN_ORDER実強度順再配置。UI＝へそくり配置トグル・王子の脇チップ（👑）表示。

### 敵対的レビュー（多エージェント8次元Workflow）＝確定バグ2件（両方修正・回帰テスト済）＋自己検証6次元クリーン
- **【中】王子×島の複製**（保存則違反・VP無限増殖）：王子で島を「動かさず使用」すると `case 'island'` が inPlay に島が無いのに `islandMat.push` し、幻の島が毎ターン増殖。→ `removeOne` 成功時のみ push（treasure_map/祝宴と同型ガード）。**黒市場経由で島を入手＋王子＝到達可**（CPUは PRINCE_AVOID で回避するため CPU戦では出ない）。
- **【低】ティアラ×サウナの銀貨トリガー漏れ**：ティアラの2回目は `playTreasureCard` を通らず、銀貨の2回目でサウナの廃棄機会が立たなかった（remaining が1のまま）。→ TIARA_PLAY の2回目副次効果に silver 分岐を配線（1回目の sauna_trash に合算）。黒市場経由の稀ケース。
- **自己検証（Workflowがセッション上限で8/10中断→残りをmain側で直接再現検証）**：船長で各種$4以下アタック（民兵/役人/追いはぎ）をサプライからプレイ→リアクション/堀/保存則OK・王子で獲得系（工房）を脇置き→毎ターン獲得pending→startQueue安全網OK・分割山の全獲得経路（BUY/闇市場/改築/密輸人/物見やぐら型on-gain）でavantoガードOK・anyGainable×avanto の極端局面でも無限ループ無し・教会のマスク漏れ無し。**CPUソーク約240戦（promo2-pack/random-promo 2-4人）で stuck/例外/保存則違反ゼロ**。

### 次（未着手）＝段階2の残り拡張（§5-1）
- **着手順＝ ~~収穫祭~~✅ → ~~ギルド~~✅ → ~~異郷~~✅ → ~~新プロモ~~✅(§0-7) → 暗黒時代を全56に完成**。暗黒時代＝廃墟/騎士の混合山・避難所・戦利品/狂人/傭兵・要塞等のon-trash等（特殊山は§6「4系統除外チェックリスト」必須）。設計図＝`docs/adding-cards.md`（分割山/「動かさず使用」/永続持続/startQueue安全網/シャッフル介入 の手順を §0-7 で追記済み）。
- **冒険/帝国の段階2（実プレイ化）は別の大仕事**（Reserve/酒場マット/トラベラー交換/旅トークン/負債経済/分割山/城/命令/勝利点トークン/集合）＝暗黒時代の後。

---

## 0-6. 段階1＝冒険（Adventures）＋帝国（Empires）74枚を画像化・カタログ追加（2026-07-05 完了・`fcfae02`）

### 結論
- **冒険＋帝国の縦カード全74枚を段階1で追加**（＝画像は出るがゲーム未参加。CARD_SETS 未参照）。内訳＝**冒険 王国30＋トラベラー成長先8＝38**／**帝国 非分割18＋分割両面10＋城8＝36**。`DOM.CARDS`＋`POOLS.adventures/empires`＋`GAIN_ORDER`（74id）＋ui.js一覧グループを追加。`npm test` 25スイート全緑（整合性 2417→**3115**）。`sw.js` v32→**v33**。**webp74枚生成済（`asset/cards/*.webp`）**。
- **カード定義（公式和名/コスト/負債/種別/効果テキスト）は多エージェント研究＋校閲Workflowで確定**（wikiwiki/fandom/dominionstrategy.com で裏取り・全74枚 confirmed）。研究データは scratchpad に保存（`adv_emp_carddata.json`）。
- **新種別の表示対応**を carddata.js に追加：reserve(リザーブ)/traveller(トラベラー)/castle(城)/command(命令)＋action+treasure(冠)＋duration+reaction(隊商の護衛)の複合ラベル。integrity の JP/EN マップにも登録（種別ラベル網羅テストが緑）。frameType は base type に落ちるので新スキン不要。
- **帝国の負債(Debt)コスト**を build-cards.js に**オレンジ六角トークン**で新規描画。負債のみ札（技術者/市街/大君主/王室の鍛冶屋＝cost:0,debt:8等）はコイン位置に大トークン、大金（cost:8+debt:8）はコイン＋小トークン。carddata に `debt` 透過。
- **画像回収**＝Downloads の74枚を生成時刻でバッチ（A1〜E4）割当→ステージング→**多エージェント視覚判別**（各画像を Read で実見し id↔絵を一意確定）。**A1の最初2枚が生成逆順**（page↔coin_of_the_realm）だったのを訂正、他73枚は指示順どおり・全て high 信頼。→`asset/art/<id>.png` 回収→`CARDS_ONLY` で新74枚のみ webp生成（既存を再エンコードしない）。モンタージュで全74枚 目視OK（負債トークン・城の序列 粗末→王城 も正しい）。

### 完全性（作った74枚 vs 公式全カード）＝**縦カードは冒険/帝国とも完全網羅・抜けなし**
- **✅冒険38枚**＝王国30（法貨/トラベラー起点 page/peasant 含む）＋トラベラー成長先8（treasure_hunter/warrior/hero/champion/soldier/fugitive/disciple/teacher）。**縦カードの抜けゼロ**。
- **✅帝国36枚**＝非分割18＋分割両面10（陣地/鹵獲品・パトリキ/エンポリウム・開拓者/騒がしい村・投石機/石・剣闘士/大金）＋城8（粗末→王城）。**縦カードの抜けゼロ**。
- **❌未作成＝横長ランドスケープのみ**（現行の縦型枠768×1152では非対応のため意図的に除外）：**冒険 イベント20種**（Alms/Borrow/Quest/Save/Scouting Party/Travelling Fair/Bonfire/Expedition/Ferry/Plan/Mission/Pilgrimage/Ball/Raid/Seaway/Trade/Lost Arts/Training/Inheritance/Pathfinding）＋**帝国 イベント13種＋ランドマーク20種**。＝計約53枚。これらは横長枠パイプラインを作る時に別途。
- **拡張パックの抜け**：発売順で冒険/帝国の次＝**夜想曲/ルネサンス/移動動物園/同盟/略奪/日の出づる国** は未着手（画像・カタログとも無し）。

### 次（この段階1の続き）
- **冒険/帝国を段階2（実プレイ化）するのは大仕事**：酒場マット(Reserve)・トラベラー交換・旅トークン・持続多数・負債コスト経済・分割山・城の混合山・命令(overlord/crown)・勝利点トークン・集合(Gathering)等の新機構が必要（`docs/adding-cards.md` に追記してから着手）。段階2の着手順（§5-1）では **新プロモ→暗黒時代完成 が先**。冒険/帝国段階2はその後。

---

## 0-5. 段階2＝異郷（Hinterlands）35枚を実プレイ化（2026-07-05 完了）

### 結論
- **異郷の王国カード35種を段階2（実プレイ・完全忠実）で実装完了**。`DOM.CARD_SETS` に `hinterlands`（固定10種 `KINGDOM_HINTERLANDS`）＋`random-hinterlands` を追加し**出荷済み**。`sw.js` v31→**v32**。テスト **25スイート全緑**（`hinterlands.test.js` 83件＋`hinterlands-ui.test.js` 44件を新設・`package.json`登録・`invariants` に hinterlands/random-hinterlands も追加）。整合性 2415→**2417**。CPU序列 100/64/95 維持。
- **固定10種 `DOM.KINGDOM_HINTERLANDS`**＝岐路/愚者の黄金/開発/オアシス/トンネル/何でも屋/絹の道/値切り屋/辺境伯/国境の村（on-gainトリガー・可変VP・on-discardリアクション・on-buy・アタック・財宝リアクションを味わえる showcase）。**公式の異郷専用10種は存在しない**＝常に混成なので自作。異郷は**特殊山・非サプライ・持続カードが無い**＝「4系統除外チェックリスト」不要でシンプルな部類。
- **新機構をすべて新設（簡略化なし）**：
  - **on-gainトリガー**（triggerOnGain 拡張）：自動＝キャッシュ(銅貨2)/大使館(他者銀貨)/不正利得(他者呪い・非アタック＝堀不可)/遊牧民の野営地(山札上)/遊牧民(+2コイン)/役人(場の財宝を山札上)。対話＝国境の村(安いカード獲得)/宿屋(捨て札アクションを山札へ混ぜる)/スーク(手札2枚廃棄)/公爵夫人(公領獲得で公爵夫人)/狂戦士(獲得時プレイ)。獲得時対話ゲート `_gainDepth===1 && !pending` の else-if 連鎖（1獲得=1対話）。
  - **on-discardフック**（`triggerOnDiscard`）：トンネル(金貨自動)/小道(自動プレイ)/織工(獲得選択・noPromptで銀貨自動)。**異郷は基本/他拡張と混成しない**ので、フックは異郷の捨て札リデューサ（オアシス/地図職人/何でも屋/大使館/宿屋/公爵夫人/神託/辺境伯/狂戦士/魔女の小屋/車大工）にのみ配線。
  - **on-trashフック**（`triggerOnTrash`＝trashOwn経由）：遊牧民(+2コイン)。
  - **on-buyフック**（BUY内）：値切り屋(購入毎に格下げ獲得・while in play)/農地(廃棄→+2コスト獲得)/高貴な山賊(プレイ/購入の両方でアタック)。
  - **獲得置換リアクション**（交易商人 trader_react）：自分の手番の獲得を銀貨に置換（サプライへ戻す）。**active本人・銀貨以外・pending無しのみ**（相手ターンの呪い獲得置換は非対応＝§6の既知簡略化）。
  - **番犬**（guard_dog）：`hasReaction` 入り＝攻撃反応窓で先にプレイ（+2〜4カード・免疫にはならない・馬商人型）。
  - **アタック6種**（辺境伯/神託/高貴な山賊/狂戦士/魔女の小屋/大釜）＝witch型 EnterVictim/Apply/REACT ＋ ATTACKS登録＋堀/灯台免疫。大釜＝このターン3回目のアクション獲得で呪い配布（actionsGainedThisTurn カウンタ）。
  - **可変VP**（silk_road＝所持勝利点カード/4・vpOf/vpOfPlayer両方）／**コスト軽減**（highway＝場の枚数ぶん-1）／**策謀のクリンナップ**（END_TURN→scheme_cleanup で場の非持続アクションを山札上へ→cleanupAndAdvance）／**愚者の黄金**（1枚目$1/2枚目$4・他者の属州獲得で金貨化リアクション）。
- **新pendingは全て4点セット**（engine reducer＋PLAYER_ACTIONS＋CPU decidePending＋UI viewPendingModal）。CPU＝chooseActionに35枚・decidePendingに全pending（終端保証＝必須獲得は候補あれば必ず非null）。evaluateKingdom は**異郷を MONEY 既定のまま**（§0の「半端エンジンは負け」を踏襲＝CPUは異郷で純ビッグマネー。CPU序列は無悪化を確認）。

### 自作スモーク＋敵対レビュー（多エージェント6次元→独立検証）で バグ5件検出→修正
- **自作スモーク（CPU 60戦＋3-4人48戦）で無限ループ3件**：神託(ORACLE_DECIDE)・辺境伯(MARGRAVE_DISCARD)・狂戦士(BERSERKER_DISCARD) の捨て札解決が **pending を null にせず前進**し、CPUが同じ捨てを反復→修正（`state.pending=null` を前進前に追加）。＝**新reducerで「捨て→triggerOnDiscard→次へ」型は null 忘れが定番の罠**。
- **敵対レビューで2件（出荷到達は稀だが実在の潜在バグ）を追加修正**：(1)**値切り屋CPUのフォールバック欠落**（`bestGain(noVictory) || bestGain(...)` に揃える＝呪いしか無い局面で card:null→engine必須獲得と噛み合い無限ループ。兄弟border_village/weaver/berserker/farmlandは持っていた書き漏れ）。(2)**神託/公爵夫人の自分対象でトンネル捨て→金貨獲得が trader_react 等を立て、攻撃キュー（残り被害者＋使用者+2カード）を潰す**＝triggerOnDiscard中は pending を保持して獲得時対話を抑止するよう修正（回帰テスト2件追加）。
- **偽陽性1件**（狂戦士×交易商人の pending 上書き）＝BERSERKER_GAIN は gain前に pending を保持＝trader ゲートで抑止済＝バグでない、を検証で確認。

### 次（未着手）＝段階2の残り拡張（§5-1）
- **着手順＝ ~~収穫祭~~✅ → ~~ギルド~~✅ → ~~異郷~~✅ → 新プロモ6 → 暗黒時代を全56に完成**。暗黒時代＝廃墟/騎士の混合山・避難所・戦利品/狂人/傭兵・要塞等のon-trash等（特殊山は§6の「4系統除外チェックリスト」必須）。設計図＝`docs/adding-cards.md`。

---

## 0-4. 段階2＝ギルド（Guilds）13枚を実プレイ化（2026-07-04 完了）

### 結論
- **ギルドの王国カード13種を段階2（実プレイ・完全忠実）で実装完了**。`DOM.CARD_SETS` に `guilds`（固定10種 `KINGDOM_GUILDS`）＋`random-guilds` を追加し**出荷済み**。`sw.js` v30→**v31**。テスト **23スイート全緑**（`guilds.test.js` 81件＋`guilds-ui.test.js` 25件を新設・`package.json`登録・`invariants` に guilds/random-guilds も追加）。整合性 2413→**2415**。CPU序列 100/64/95 維持。
- **固定10種 `DOM.KINGDOM_GUILDS`**＝蝋燭職人/石工/医者/助言者/収税吏/伝令官/パン屋/肉屋/商人ギルド/予言者（財源・過払い・アタック2種・公開・trash-to-gain・on-buy・setup を全て味わえる構成）。**公式のギルド専用10種は存在しない**（Guildsは13枚のみ＝常に基本/陰謀と混成。研究Workflowで確認）ので showcase 用の自作10種。
- **新機構をすべて新設（簡略化なし）**：
  - **財源 Coffers（＝日本語名「財源」）**＝per-player数値 `coffers`（createInitialStateで初期化・**公開＝マスク不要・VPに数えない**）。付与＝蝋燭職人/パン屋+1・肉屋+2・広場（財宝捨てで+1）・商人ギルド（購入毎）。消費＝`COFFERS_SPEND`（購入フェイズに1枚=+1コイン）。UI＝金色バッジ＋「💰財源を使う」ボタン＋数量ステッパー `modalAmount`。**パン屋のセットアップ**＝王国にbakerがあれば開始時 全員+1財源。
  - **商人ギルド**＝`t.merchantGuildPlays`（このターンの使用回数）を購入毎に財源へ。**公式2E＝プレイ回数で累積**（玉座で2回使えば購入毎+2）＝場の枚数ではない。出荷セットでは玉座系と同居しないため差は出ないが忠実性のためプレイ回数で実装。
  - **過払い overpay**＝`OVERPAY_CARDS`(石工/医者/名品/伝令官)。BUY後（残コインがあれば）`maybeStartOverpay`→`overpay` pending→`OVERPAY_RESOLVE`(額確定)→カード別 `applyOverpayEffect`。名品=銀貨/枚・石工=ちょうど同コストのアクション2枚(`stonemason_overpay`)・医者=1枚ずつ山札上を廃棄/捨て/戻す(`doctor_overpay`・私的なので**maskで伏せる**)・伝令官=捨て札から山札上へ(`herald_overpay`)。**闇市場購入でも過払いを提供**（promo-pack/random-promoで黒市デッキにギルド札が入るため到達可＝敵対レビューで確定・修正済）。
  - **アタック2種**＝収税吏 taxman（財宝廃棄→+$3までの財宝を山札上に獲得→他の各自[手札5枚以上]が同名を捨てる。廃棄しなければ無効果）／予言者 soothsayer（金貨獲得→他の各自が呪い獲得→**引いたら+1カード**。呪い枯渇なら引かない）。`ATTACKS` 登録＋`*EnterVictim`＋堀/灯台免疫。
  - **trash-to-gain**＝石工（廃棄→それより安い2枚）／肉屋（+2財源→廃棄→財源を払い(廃棄コスト+財源)以下を獲得）。**公開系**＝助言者（上3枚→**左隣**が1枚捨てさせ残りは使用者の手札へ・pending.player=左席）／熟練工（指定以外が3枚出るまで公開→手札）／伝令官（山札上を公開しアクションならプレイ）。
- **新pendingは全て4点セット**（engine reducer＋PLAYER_ACTIONS＋CPU decidePending＋UI viewPendingModal）。CPU＝`chooseAction`に13枚・`decidePending`に全pending・**`coffersToSpend`**（財源を最小枚数だけ使って買いを底上げ・終端保証）・`evaluateKingdom`に`inPool('guilds')`追加（guilds→ENGINE＝CPUがエンジンを組む）・GAIN_ORDERに13枚を強度順再配置。

### 敵対的レビュー（多エージェントWorkflow・7次元→再現検証）＝確定バグ2件（両方修正済）
- **【低】闇市場で過払い対象カードを買っても過払いが飛ばされていた**（「出荷セットで到達不能」コメントが誤り＝promo-pack/random-promoで黒市デッキに全POOLS[ギルド含む]が入る）。→ `BLACK_MARKET_BUY` に `maybeStartOverpay` を追加＋回帰テスト。
- **【低】過払い数量ステッパーが連続購入で前回値を持ち越す**（同一 pending キー`overpay`でリセットされず、意図しない過払いの恐れ）。→ `modalAmount` の確定時に `UI.amount=null`（card識別だけでは名品2連続で不足＝インスタンス毎リセットが正解）。
- **自分の事前精査で1件修正**：必須獲得(収税吏/肉屋)で獲得先が皆無（銅貨/銀貨/名品 枯渇）のとき card=null を拒否し続けCPU無限ループ/人間詰みの恐れ→ engine で「候補ゼロなら獲得せず解決（収税吏はアタックは実行）」＋UIに skip フォールバック＋回帰テスト。
- 他5次元（coffers/attacks/baseeffects/cpu/conservation-integrity）は**クリーン**（偽陽性0・nit0）。

### 次（未着手）＝段階2の残り拡張（§5-1）
- **着手順（新機構の少ない順）＝ ~~収穫祭~~✅ → ~~ギルド~~✅ → 異郷35 → 新プロモ6 → 暗黒時代を全56に完成**。異郷=on-gainトリガー/可変VP(silk_road/feodum)等、暗黒時代=廃墟/騎士の混合山・避難所・戦利品/狂人/傭兵・要塞等のon-trash等。設計図＝`docs/adding-cards.md`。

---

## 0-3. 段階1＝ギルド13＋暗黒時代残り36 を画像化・カタログ追加（2026-07-04 完了・`651e3f6`）

### 結論
- **残り未カタログの全49枚を段階1で追加**（＝画像は出るがゲーム未参加。CARD_SETS 未参照）。内訳＝**ギルド13**／**暗黒時代 王国14＋騎士の山(knights)＋騎士10種／廃墟5／避難所3／非サプライ3（戦利品/狂人/傭兵）**。`npm test` 21スイート全緑（整合性 1947→**2413件**）。`sw.js` v29→**v30**。**これで Downloads の絵は全処理済（desktop.ini のみ残置）**。
- **公式カードデータは多エージェント＋WebSearch で敵対的に確定**。和名は推測でなく公式採用：taxman=**収税吏**／herald=**伝令官**／soothsayer=**予言者**／junk_dealer=**屑屋**／mystic=**秘術師**／rogue=**盗賊**／catacombs=**地下墓所**／band_of_misfits=**はみだし者**／candlestick_maker=**蝋燭職人**／rebuild=**建て直し**／counterfeit=**偽造通貨**。**Coffers＝「財源」**（段階2で使う訳語を確定）。hovel=納屋/necropolis=共同墓地/overgrown_estate=草茂る屋敷。
- **spoils の名前は「戦利品」を採用**（公式は「略奪品」だが、既存 marauder/新規 bandit_camp/pillage が「戦利品置き場」と参照＝プロジェクト内一貫性を優先。将来 Plunder/Loot を入れる時に再考）。
- **新種別 knight/ruins/shelter を追加**：carddata の typeLabel/typeLabelEn（複合語を先に決めて全typeを落とさない）＋ integrity の JP/EN マップに登録。frameType は base type で既存スキンに落ちるので変更不要。dame_josephine は `['action','attack','knight','victory'] vp:2`。
- **孤立プール** `guilds/knights/ruins/shelters/darkages_np` を新設＋`darkages` に15種合流（20→35）。GAIN_ORDER に49 id追加（整合性=全カード網羅）。ui.js カード一覧にギルド/騎士/廃墟/避難所/非サプライのグループ追加。
- **画像回収**＝多エージェント識別（内容判別・Read で実見）＋敵対検証＋**カバレッジ整合で49画像↔49idを一意確定**（二重割当4件[catacombs/pillage/dame_natalie/masterpiece]を欠落4件[necropolis/ruined_village/dame_sylvia/journeyman]へ再割当）。**騎士10種は絵での個体判別不能＝性別(Dame/Sir)一致で割当（コスメのみ・ゲーム無影響）**。→`asset/art/<id>.png` 回収→`CARDS_ONLY` フィルタ（build-cards.js 新設）で新49枚のみ webp生成（既存222を再エンコードしない）。

### 次（未着手）＝段階2: ギルド13枚を実プレイ化（§5-1）
- 新機構＝**コイントークン Coffers(=財源)**（per-player数値＋消費action の4点セット）／**overpay 過払い**（BUY拡張：stonemason/doctor/masterpiece/herald）／**アタック2種**（収税吏 taxman・予言者 soothsayer）／trash-to-gain（stonemason/butcher/graverobber系）／merchant_guild の購入毎on-buyトリガー／baker のセットアップ（開始時全員+1財源）／advisor/journeyman/mystic の公開・宣言／plaza/candlestick_maker の財源。**賞品Prizes山(§0-2)と収穫祭の各機構が良いコピー元**。

## 0-2. 段階2＝収穫祭13＋褒賞5 を実プレイ化（2026-07-04 完了）

### 結論
- **収穫祭(Cornucopia)の王国カード13種＋賞品Prizes5種＝計18枚を段階2（実プレイ・完全忠実）で実装完了**。`DOM.CARD_SETS` に `cornucopia`（固定10種 `KINGDOM_CORNUCOPIA`）＋ `random-cornucopia` を追加し**出荷済み**（＝プレイ可能）。`sw.js` v28→**v29**。テスト **21スイート全緑**（`cornucopia.test.js` 107件＋`cornucopia-ui.test.js` 21件を新設・`package.json`登録・`invariants` にも cornucopia/random-cornucopia を追加）。CPU序列 100/64/95 維持。
- **新機構をすべて新設（簡略化なし）**：
  - **賞品Prizes山**＝`supply` の数値キー(各1枚)。`NON_SUPPLY` set で `emptyPileCount`(3山終了)・`canBuyCard`(購入)・`blackMarket`母集団・汎用獲得(`bestGain`/`bestGainExact`/`horn_of_plenty`)から除外。獲得は馬上槍試合のみ。
  - **災いカードBane**（若き魔女）＝`createInitialState` が `$2-3` の王国カードを1つ選び `state.baneCard` に格納し `kingdom` に push（11山目・通常の購入可能サプライ・`pickBane`）。攻撃時は所持者に反応窓、公開で免除（手札に残す）。
  - **可変VP品評会**＝`vpOf`（engine）＋`vpOfPlayer`（cpu）に `2×floor(異名数/5)×枚数`。
  - **王女コスト-2**＝`cardCost` に active の場の princess 枚数ぶん減算。
  - **馬商人リアクション**＝`hasReaction` に horse_traders 追加。反応窓（stage 'react' ＋ embedded民兵/拷問人）で脇置き→免疫にはならず攻撃は受ける→次手番開始で `DURATION_RESOLVERS.horse_traders` が +1カードして手札に戻す。CPU は decidePending 冒頭で先に脇置き（無限ループしない）。
  - **アタック4種**（占い師/道化師/家臣団/若き魔女）＝witch型 EnterVictim/Apply/REACT ＋ `ATTACKS` 登録。**馬上槍試合**＝属州公開→賞品/公領を山札上、相手が公開しなければ +1カード+1コイン（属州も上置き→ボーナスで即引くのは公式挙動）。**豊穣の角**＝場の異名数コストまで獲得＋勝利点なら自身廃棄。
- **新pendingは全て4点セット**（engine reducer＋PLAYER_ACTIONS＋CPU decidePending＋UI viewPendingModal）を満たす。

### 敵対的レビュー（多エージェントWorkflow）で 8件の実バグを検出→全修正・回帰テスト済み
- **【高】闇市場に賞品が漏れる**：`blackMarket` 母集団が全 `POOLS`（賞品含む）から作られ、tournament 不在の出荷セット（promo-pack 等）で賞品が $0 購入可能だった。→ `NON_SUPPLY` を母集団から除外。
- **【高】豊穣の角で賞品を獲得できた**：`HORN_OF_PLENTY_GAIN` が `NON_SUPPLY` 未チェック＋CPU `bestGain` が賞品を提案。→ reducer に `NON_SUPPLY` ガード、CPU `bestGain`/`bestGainExact` から賞品(`PRIZE_SET`)を除外（reducer単独だとCPU無限ループ＝両方必須）。
- **【中】CPU `vpOfPlayer` が品評会を未計上**（hard CPUの終局読み誤差）。→ engine.vpOf と同じ品評会項を追加。
- **【低】頼もしい乗騎の選択順**：クリック順で解決し「銀貨→山札捨て」を先に処理し得た。→ カード記載順(`valid.filter`)で解決＝+2カードを先に。
- **【低→実は到達可】馬商人リアクションが embedded型(民兵/拷問人)で欠落**（闇市場経由で到達）。→ CPU guard を民兵/拷問人へ拡張＋`modalMilitia`/`modalTorturer` に脇置きボタン。
- 2つの高危険 exploit（闇市場・細工 HORN_OF_PLENTY_GAIN）は node で **閉鎖確認**、promo-pack/cornucopia/random-cornucopia の CPU 24戦が stuck/例外ゼロで完走。

---

## 0. B案＝王国評価型CPU購入AI 実装完了（2026-07-03）

### 結論
- **B案を実装・採用**（`js/cpu.js` `evaluateKingdom`）。ゲーム開始時に王国を評価し **ENGINE→エンジン構築買い（現行 `bestEngineBuy`）／ MONEY→純ビッグマネー（`bestEngineBuy` を呼ばない）** に切り替える。**購入ロジックのみの変更・新pendingなし**（decidePending/UI 不変）。王国は対局中不変なので内容キーで1回だけ評価しキャッシュ。
- **最終分類ロジック**：`ENGINE = 海辺プール or 繁栄プールを含む or (礼拝堂あり & +2カード級ドローあり & 庭園なし)`。それ以外は MONEY。
- **自己対戦A/B（NEW=本実装 vs OLD=常時エンジン, 全22出荷セット, N=200, 席交換ペア校正）で採用条件を完全達成**：**総合 hard 71.5% / normal 71.3%**（>52%）、**全セット ≥48.5%**（最小=固定alchemy 48.5%、random-seaside=50.0%＝§0重点も無悪化）。`npm test` 19スイート全緑・**難易度序列 強vs弱100%／強vs普通64%／普通vs弱95%**（従来95/55/87から改善・閾値60/45/55クリア）。

### 実測で判明した重要事項（当初の叩き台からの修正）
- **§0当初データ（「random-seaside は純BM 43%＝エンジンが勝つ」）は現HEAD＋均衡ペア計測では再現せず、random-seaside は互角（50%）だった**。ただし**固定セットの海辺/繁栄はエンジンが圧勝**（BM は 海辺15%・繁栄23%）。＝§0の「seasideはエンジン有利」という結論自体は固定セットで強く正しく、randomがマイルドだっただけ。→ 拡張シグナル（海辺 or 繁栄プール）を ENGINE にすれば random は互角（損無し）・固定は取りこぼさない。
- **第一仮説「村とドローが両方ある→ENGINE」は不採用**：それだと basic/intrigue の random 王国もエンジン化して負ける（BM が 55〜96% 勝つ）。逆に村/ドロー等の一般特徴量では**固定繁栄エンジン（kings_court等）を取りこぼす**（villages/draws は random-basic と区別不能）。→ 拡張レベルのシグナルが正解。
- **例外1件＝推奨「ビッグマネー」固定セット**：名前と裏腹に chapel(圧縮)+laboratory(ドロー) の軽量エンジンで、BM だと 43%（<45%違反）。→ **`礼拝堂+ドロー` を ENGINE に追加**して 50% に修正。ただし **庭園(gardens)があれば“庭園ラッシュ”＝BM有利**（size-distortion は BM 99%勝ち）なので庭園を除外し、両立させた。
- **失敗済みの中間案（§0記載、再試行しないこと）を再確認**：村/ドロー・キャントリップ厳選系は random で改善しても固定エンジンや BM-rush を壊す。**半端エンジンは無エンジンより弱い**の教訓は正しい。

### 検証手法（再現用メモ・スクリプトは規約により削除済み）
- vm sandbox に cards/engine を1回読み、**NEW=作業ツリー cpu.js／OLD=`git show HEAD:js/cpu.js`** を同一 context に順に runInContext して `DOM.cpu` を2つ捕捉。1ゲーム内で `E.actor(s)===newSeat ? newCpu.decide : oldCpu.decide` と席で差し替え。
- **校正**：同一(kingdom)を席0/席1の両方で対戦＋**試行ごとにシードをリセットして初期シャッフルを一致**させる強ペア設計。ミラー（NEW=OLD）で**全セット厳密に50.0%**・`isEngine=true`（常時エンジン）でも 50.0% を確認してから本計測。進行判定は `pending` を含む状態フィンガープリント（`pending.stage` を落とすと誤stuck多発）。
- 分類候補は `_abx.tmp.js` で ENGINE_CLASSIFIER ブロックを文字列差替えして一括比較（H8=拡張のみ・H8f=拡張+礼拝堂エンジン 等）。**H8f（採用）が TOTAL 71.4%・MIN 49.3% で最良**。

---

## 1. ゴール
- スマホ向けドミニオン対戦Webアプリ（CPU戦・2〜4人ローカル・オンライン対戦）。回答/UIは日本語。
- 基本・陰謀（第二版）＋プロモ、海辺27・錬金術13（支配含む）・繁栄27（各第二版）＝**全143枚を実プレイ可能**。
- カードは「金属枠＋AI生成の絵＋コード描画の文字」を合成した完成画像（`asset/cards/<id>.webp`・金トリム方式）。
- 拡張を「壊さず」増やせる単一ソース設計と、テストで守られた堅牢性を維持する。

## 2. アーキテクチャ（カードを増やす/触るとき必読）
- **表示データの正本＝`js/cards.js` の `DOM.CARDS`**（id/name/cost/types/text、+持続や `potion` 等）。`js/carddata.js` が名前/コスト/種別ラベル/枠色/画像パスを自動導出。`cards.html`（一覧プレビュー）も `tools/build-cards.js`（画像生成）も `DOM.CARDS` を見る。
- **完成画像の生成**：`node tools/build-cards.js`（プロジェクト直下がcwd）。masterフレームを種別スキンにrecolor→枠＋絵(`asset/art/<id>.png`)＋文字をcanvas合成→768×1152 WebP（全143枚）。`CARDS_OUT` で出力先変更可。入力 `images/`・`asset/art/` は `.gitignore`＝**このPCのみ**（再生成はこのPCでしかできない）。
- **エンジン**：`js/engine.js`。`reduce(state, action)` の純関数。`applyEffect` の per-card switch、選択は `state.pending`＋`*_RESOLVE` reducer。攻撃は `ATTACKS` 登録表＋`*EnterVictim`。`PLAYER_ACTIONS`(Set) が送信可能actionの唯一の許可リスト（サーバも参照）。
- **CPU**：`js/cpu.js`。`chooseAction`／`decidePending`（**新pendingには必ず分岐を足す。無いとCPU無限ループ**）／`GAIN_ORDER`（購入優先＝**全カード網羅必須**）／`chooseBuy`(easy/normal/hard)＋`bestEngineBuy`。
- **UI**：`js/ui.js`。`viewBoard`／`viewPendingModal`（**新pendingには分岐必須＝無いと人間が詰む**）／`modal*`ヘルパ。オンラインも同じ ui.js（NetStore.dispatch。クライアントは reduce しない＝サーバ権威）。
- **整合性テスト** `test/integrity.test.js`：reduce case↔PLAYER_ACTIONS一致／GAIN_ORDER=全カード／POOL所属／固定セット10種／react攻撃はATTACKS登録／表示データ一致／種別ラベルが全typeを含む。**抜けはCIで即赤**。
- **テスト全体**：`npm test`＝19スイート（integrity／invariants=**カード保存則ほかプロパティベースfuzz**／engine／各拡張／cpu／attacks-multiplayer／UI各種(jsdom)／server／online／stress）。手動＝`verify:e2e`・`verify:visual`・`test/verify-online.js`（これのみ要サーバ起動）。
- **デプロイ**：main に push → `.github/workflows/deploy.yml` が Pages 公開、サーバは Render 自動再デプロイ。**新しい配信フォルダは deploy.yml に追加**（忘れると本番404）。**client資産（js/css/webp等）を変えたら `sw.js` の VERSION を上げる**（現在 v26）。コミット者設定済み（Naoki Inoue）。

## 3. 完了したこと（サマリ。詳細は各コミットメッセージ＝git log が正）
### 2026-07-10 E8＝命令(Command)の忠実化「プレイした札は動かない」（§0-17・未push）
- **前セッションの E8 計画（＝命令カードが身代わりに動く）は廃止済みの2016年ルールだった**。研究WF＋敵対検証で 2019エラッタ／RGG Dark Ages(2022) PDF を逐語確認し方針を反転。カタログ文も既に現行側だった（大君主「サプライに残す」）。
- 実バグ3種を修正：**船長/王子で使った鉱山の村・倒壊・死の荷車・陣地が、場にある同名の本物のコピーを誤って廃棄/脇置きしていた**（`random-promo` で到達）／命令経由の倒壊に engine が拒否する死に選択肢が出ていた／`farmers_market` の山上VP取得・`island` の手札1枚・`feast` の獲得 などの「移動に条件づかない効果」の扱いを明確化。
- 敵対レビュー確定1クラスタ（2件）を修正：**`pending.self` 新設によるオンライン永続化スナップショットの後方互換バグ**（空手札の倒壊 pending が永久 livelock）→ `DOM.engine.pendingSelf` にフォールバックを内包。
- `sw.js` v43→v44・`overlord.webp` 再生成。全33スイート緑（帝国269/暗黒時代87/新プロモ165/冒険59・整合性3146不変・CPU序列 100/64/95 維持）。

### 2026-07-10 帝国 Batch E6＝命令(overlord/crown)＋財宝再演の根治（§0-15・未push）
- 帝国の新機構6系統すべて実装完了（残るは E7＝CARD_SET昇格のみ）。`sw.js` v41→v42。
- 敵対レビュー確定9件を全修正。うち**出荷済み拡張の実バグ3件**＝ティアラ/偽造通貨の「2回目のアタックが飛ぶ」（繁栄・暗黒時代）／はみだし者×行進の「再演で選び直せる」（暗黒時代）／CPU `pickSwindlerGift` の分割山ロック無限ループ。
- テスト：empires 197件・darkages 79件・prosperity 69件・promo2 142件。invariants の敵対王国+4種。追加ソーク120戦クリーン。**全32スイート緑（整合性3144不変・CPU序列 100/64/95 維持）**。

### 2026-07-04 段階2の実装設計図を作成（`docs/adding-cards.md`）
- 全カード実プレイ化（段階2）に向け、エンジンの全機構（効果/pending・on-gain等トリガー/リアクション・特殊山/セットアップ/トークン/CARD_SET昇格・持続/command/可変VP・テスト雛形）を多エージェント調査し、**file:line＋コピー元コード＋落とし穴**を `docs/adding-cards.md` に恒久化。段階2の作業計画は §5-1。

### 2026-07-04 新拡張カードの画像化・カタログ追加（段階1・79枚）
- **収穫祭13＋褒賞5＋異郷35（初版26＋第二版新規9）＋暗黒時代20＋新プロモ6＝79枚を段階1で追加**（`DOM.CARDS`＋孤立プール `POOLS.cornucopia/hinterlands/darkages`＋promo合流＋`GAIN_ORDER`＋ui.js一覧グループ）。**画像は出るがゲーム未参加**（CARD_SETSから孤立プールを参照しない＝実サプライに出ない）。完成webp79枚生成済み（`asset/cards/*.webp`）。整合性テスト緑（fools_gold=財宝+リアクション／tunnel=勝利点+リアクションの新種別ラベルを carddata に追加）。`sw.js` v27→v28。
- 絵はユーザーがChatGPTで生成→私がDL画像を判別し `asset/art/<id>.png` に回収（→ChatGPT運用ルールは記憶 `chatgpt-card-art-workflow` 参照）。カード定義・画像判別は多エージェントworkflowで起草/照合。
- **未完了＝段階2（実プレイ化）**：engine効果／CPU decidePending・chooseAction・chooseBuy／UI viewPendingModal／CARD_SETへの昇格が未実装。暗黒時代は20/56のみ（残36＋廃墟/避難所/騎士/特殊は未着手）。§5参照。

### 2026-07-03 CPU購入AI強化（B案）
- **B案＝王国評価型 CPU購入AI 実装完了**（`js/cpu.js` `evaluateKingdom`）。ENGINE/MONEY 切替で総合勝率 hard 71.5%/normal 71.3%・全22出荷セット≥48.5%。詳細・A/B結果・実測の修正点は **§0**。`sw.js` v26→v27。テスト19スイート全緑・難易度序列 100/64/95%。

### 2026-07-01〜03 堅牢化マラソン（多エージェント監査①〜⑦＋fuzz＋実測。実バグ約20件修正）
- `8235b32` 海辺の簡略化2点を本格実装（封鎖の堀免疫窓＝`immune[]`／海賊の財宝獲得リアクション＝`pirate_react`）＋混成王国CPU購入バランス＋cpu.test決定論化（固定シード）
- `0cb288c` 監査①: 泥棒王国の無限ループ(高)＝CPU経済フォールバック＋`isGameOver`150手番安全網／会計士2枚目消失／ティアラ×ペテン師2回目／水晶玉の財宝プレイ委譲／封鎖×2
- `43c3e5a` 監査②オンライン: 水晶玉看破の漏洩／自席山札の順序透視→ソート配信／DoS対策(`MAX_ROOMS`＋無人ロビー即破棄)。**anti-cheatはexploit無しを確認**
- `d6f5e45` 監査③表示: ペテン師「財宝・アタック」/会計士3種ラベル修正＋**webp2枚再生成**＋ラベル網羅テスト
- `30cf5ba` 監査④UI/UX: 支配中の看破マスクでrender例外(高)＝`secretSeer`＋cardEl未知id防御／自動スキップ・コーチの被支配者ルーティング／闇市場サプライ外カードの手札描画／おすすめ買いにcolony/platinum
- `54d3018` 監査⑤: 混成王国の潜在バグ2件（支配×外部self-trash・コイン獲得札×ポーション費用）は**全プール/全セット走査で到達不能を証明**＝意図的に未修正（§6参照）
- `c94e84f` `d089a47` `b91bb2d` 監査⑥⑦: **カード保存則fuzz新設**(`test/invariants.test.js`)→闇市場の公開カード消失・宝の地図複製（玉座2回目）を修正＋支配強制12戦＋負リソース/手番/終局検査＋ログ長≤250ガード
- `baee9dc` DoS即破棄が復元(restoreRoom)ロビーを壊す自己回帰を修正（`allowImmediate`引数）
- `d105b68` CPU強化: `throneValue` による玉座/王の宮廷の対象選択＋衛兵の銅貨圧縮（A/Bニュートラル＝質改善）＋**§0の戦略的発見を記録**
- `1a69139` 実ブラウザE2Eスモーク新設（`test/verify-e2e.js`・9/9・自己完結）
- `49149de` `verify-visual.js` 刷新＝320/360/390/414/768px×主要画面で横はみ出しゼロ確認
- `628ae15` a11y: カード/山に role=button＋aria-label＋Enter/Space（`a11yBtn`）
- `7cf27f4` 性能監査: reduce 0.04ms/手・render p95 22ms(4xスロットル)＝良好・バグ無し
- `d339b95` 多人数アタック検証: 監査0件＋シナリオ22件新設(`test/attacks-multiplayer.test.js`)＝**クリーン**（呪い枯渇は手番順先着・堀は公開者のみ免疫・玉座×魔女=2枚 等すべて正）
- `2df9f83` ドキュメント総点検（PROGRESS/CLAUDE/README を現状同期）

### 過去セッション（〜2026-07-01）
- カード完成画像 全143枚（金トリム方式）／海辺27種の実プレイ化（持続機構・マット・前哨地・灯台免疫）／錬金術13種（ポーション経済・支配=actorルーティング/gain・trashOwn精算/追加ターン）／繁栄27種（VPトークン・プラチナ/植民地・コスト軽減・王の宮廷）。広い経緯は `docs/handover.md`。

## 4. 決定事項とその理由
- **CPU購入はB案（王国評価で ENGINE/MONEY 切替）を実装・採用済み（2026-07-03完了）**：`evaluateKingdom`。詳細・A/B結果・実測の修正点は §0。A案（BM寄せ）は seaside悪化＋エンジンレスUXのため不採用。総合勝率 hard 71.5%/normal 71.3%・全セット≥48.5%。
- **枠は画像（金属枠）方式**：コード描画SVGでは基準カードの絵画的な金に届かなかった（5回差し戻し。詳細 `docs/handover.md`）。
- **画像だけ先・ゲームロジックは別タスク**：新拡張はまず `DOM.CARDS` カタログ＋孤立プール＋`GAIN_ORDER` で「画像は出るがゲームに入らない」状態にし整合性テストを緑に保つ→後で実ゲーム化（海辺/錬金術/繁栄はこの方式で完了）。
- **海辺の簡略化2点は本格実装済み**：封鎖の堀免疫窓・海賊の財宝獲得リアクション。on-gain対話は `!pending && _gainDepth===1` ゲートで安全側。

## 5. 未完了タスク（優先順。次セッションは 1. から）
1. **【最優先】ルネサンス（§0-22）の敵対レビュー確定バグを修正 → push（ユーザー確認）**。`sw.js` v49。
2. **次の拡張候補**（着手前に `docs/adding-cards.md` 必読）:
   - **絵（webp）の回収**：**ルネサンス50枚**（王国25＋プロジェクト20＋アーティファクト5・現在は枠＋文字）／冒険イベント20種。
     縦型＝`CARDS_ONLY=<ids> node tools/build-cards.js`／横型＝`CARDS_ONLY=<ids> node tools/build-landscape.js`（このPCのみ）。
   - **発売順の未着手拡張（段階1すら未着手＝画像・カタログとも無し）**：夜想曲/移動動物園/同盟/略奪/日の出づる国。
   - **✅段階2 完了済み拡張**：収穫祭(§0-2)／ギルド(§0-4)／異郷(§0-5)／新プロモ(§0-7)／暗黒時代 全56枚(§0-8)／冒険 全38枚(§0-9)／**帝国 縦型36枚(§0-10〜0-16)**＋**E8(§0-17)**＋**帝国ランドマーク21種＋絵(§0-19)**＋**帝国イベント13種(§0-20)**＋**冒険イベント20種(§0-21)**（すべて push 済）＋**ルネサンス全50枚(§0-22・未push)**。
3. **錬金術アートの△3枚最終確認（任意）**：変成/薬草商/薬剤師。差し替えは `asset/art/<id>.png` →`node tools/build-cards.js`→該当webpデプロイ。
4. （任意・CPU購入の残課題）B案は「拡張＋礼拝堂エンジン」で ENGINE/MONEY を切替済み（暗黒時代は MONEY 既定＝§0-5 と同方針）。さらに踏み込むなら **MONEY王国での BM+呪いアタック（魔女等≤2枚）** や **王国個別のエンジン成立度スコアリング**が候補（優先度低）。
5. （任意・過去メモ）絵文字→game-icons.net SVG 化、vanilla効果DSL 等。

## 6. 詰まり・注意点・保留中の判断
- **新カードを `DOM.CARDS` に足すと整合性テストが赤くなる**（GAIN_ORDER網羅＋POOL所属を要求）→ 孤立プール＋GAIN_ORDER追加で回避。実ゲーム化時は ATTACKS/PLAYER_ACTIONS/CPU decidePending/UI viewPendingModal も忘れず（抜けはCIで赤 or CPU無限ループ/人間詰み）。
- **デプロイ**：サーバ変更時は Pages と Render の反映タイミング差で一時的に空振りし得る。`sw.js` VERSION更新を忘れない。
- **一時スクリプト規約**：使い捨ては**プロジェクト直下に `_*.tmp.js`** で作り実行後**必ず削除**。スクショ等は scratchpad へ。シェルcwdがずれることがあるので実行前に `Set-Location 'C:\Users\b1242\claude\game\dominion'`。
- **支配（Possession）の廃棄カード返却の簡略化＝到達不能を証明済み（監査⑤）＝意図的に未修正**：`possession` は alchemy プール専用で、複数プールを混ぜる出荷セット（random/random-promo/random-1e）はいずれも alchemy を含まない＝支配と外部拡張self-trashはどの出荷王国でも共存しない。全self-trashのtrashOwn化はアタック廃棄/供給廃棄の誤変換で**可到達バグを生むリスク**があり見送り。**混成alchemyモードを正式追加する時に一緒に対応**する方針。同型のポーション費用問題も到達不能（可到達だった大学のみガード済み）。
- **支配のCPU簡略化**：CPUは支配を自動購入しない（`bestPotionBuy` で除外）。人間が使うぶんは支配者がCPUでも動作する。
- **非サプライ数値キー山（賞品Prizes・将来の戦利品/狂人/傭兵）を足すときの必須チェックリスト**（§0-2のレビューで実際に踏んだ罠）：`NON_SUPPLY` set に登録し、**(1) `emptyPileCount`(3山終了) (2) `canBuyCard`(購入) (3) `blackMarket` 母集団（`createInitialState` の universe フィルタ） (4) 汎用獲得（engine の `*_GAIN` reducer と CPU `bestGain`/`bestGainExact`）** の4系統すべてから除外すること。特に「reducer だけガードして CPU 側を放置すると、CPU が拒否される獲得を出し続けて無限ループ」する（豊穣の角で実際に発生）＝**engine拒否とCPU非提案は必ずセット**。汎用獲得を持つ札（`horn_of_plenty` 等）は特に漏れやすい。
- **段階1(§0-3)＋ギルド段階2(§0-4)は push済（`6d1d69c`・2026-07-04・ユーザー確認の上で本番デプロイ）**。以後の段階2作業も 完成→CARD_SET昇格→全テスト緑→**都度確認の上で** push。
- **`5150017` まで push済（2026-07-05・本番デプロイ済）＝異郷段階2＋冒険/帝国段階1＋新プロモ段階2(§0-7)**。以後の段階2作業も 完成→CARD_SET昇格→全テスト緑→**都度ユーザー確認の上で** push。`sw.js` は v34。
- **冒険/帝国段階1の画像回収メモ**：Downloads の ChatGPT画像はファイル名不定→生成時刻でバッチ割当→視覚判別で id確定（chatgpt-card-art-workflow 記憶＋今回は多エージェント判別）。`asset/art/*.png`・`images/` は gitignore＝このPCのみ。webp再生成は `CARDS_ONLY=<id,...> node tools/build-cards.js`。研究データは scratchpad `adv_emp_carddata.json`。
- **異郷の許容簡略化（到達が稀 or 忠実性のみ・敵対レビューで重大でないと確定）＝意図的に未実装**：(1)**交易商人の獲得置換は自分の手番の獲得のみ**（相手ターンの魔女等の呪い獲得を銀貨に置換する反応は非対応＝獲得時対話ゲートが active限定・相手ターンだと pending 競合で潰れるため。呪いはそのまま受ける＝安全側）。(2)**値切り屋/農地/高貴な山賊の on-buy は「1購入=1 pending」**＝farmland/noble_brigand を買うと同ターン場の値切り屋の強制獲得がスキップされ得る（複数 on-buy を並べる汎用キューが無いため。カード保存則は保持・ループ/クラッシュ無し）。(3)**develop 等の獲得で入れ子の獲得時対話（border_village等）は `!pending` ゲートでスキップ**。いずれも「on-buy/on-gain の汎用 pending キュー」を導入する時にまとめて対応する方針（現状は保存則・非ループを敵対レビューで確認済）。
- **【既存・スコープ外の別課題】闇市場デッキに「段階1のみ（＝engineロジック未実装）のプール」が漏れる**：`createInitialState` の黒市universeは全 `Object.values(DOM.POOLS)` を平坦化するため、promo-pack/random-promo で黒市デッキに hinterlands/darkages/knights/ruins/shelters/darkages_np（＋spoils/madman/mercenary）が混入する。これらは段階1（applyEffect未実装＝買って使っても何も起きない死に札）。**ギルドの段階2化で guilds プールは playable になった**ので問題なし。残りは各拡張が段階2化される都度 自動解消。**根治するなら黒市universeを「CARD_SETSが参照する playable プールのみ」に絞る**（＝段階2化の順に自然消化。急がば注意：正しく除外しないと変種が減る）。敵対レビューが指摘（元からの挙動＝ギルド作業とは独立）。
- **段階1で追加した暗黒時代の非サプライ札（戦利品/狂人/傭兵/騎士10種/廃墟5/避難所3）を段階2で実プレイ化する時は、上の「4系統除外チェックリスト」を必ず通す**。特殊山（廃墟＝混合順序山→top-level配列・invariants tally追加／騎士＝混合山／避難所＝開始デッキ置換）は `docs/adding-cards.md` §C に実装手順あり。新種別 knight/ruins/shelter は表示ラベルのみ実装済（engineロジックは段階2で新設）。
- **暗黒時代 段階2 は WIP（§0-8 が正）**：カタログのみ現行エラッタに修正済み＝**カード一覧の文言と webp 画像の文字が9枚で不一致**（hermit/procession/pillage/death_cart/rats/counterfeit＋種別変更の marauder/cultist/band_of_misfits）。**CARD_SET昇格前に webp 再生成必須**（このPCで `CARDS_ONLY=<ids> node tools/build-cards.js`）。sw.js VERSION は完成時に v34→v35。
- **Read ツール出力の汚染を観測（2026-07-05）**：実在しないコード/コメントが Read 結果に混入して見え、「基盤実装済み」と誤認しかけた（git diff / grep の生バイト確認で否定して復旧）。以後この作業では、実装状態を断定する前に **Grep・`Get-Content`・`git show` での裏取り**を併用すること。
- **【E6で新設・以後の必読】「財宝を2回使う」は必ず `state.replay` の `'treasure_replay'` を使う**（§0-15）。`playTreasureCard` ＝移動＋`applyTreasureEffect`／`applyTreasureEffect` ＝**カードを動かさず効果だけ**。2回目を「コインだけ足す」で済ませると、pending を立てる財宝（御守り/水晶玉/金床/不正利得/豊穣の角）や +購入/+VP を持つ財宝（元手/大金/鹵獲品/収集/偽造通貨）の2回目が丸ごと消える＝**旧 `treasureReplayCoins` の轍**。**新しい財宝を足すときは `applyTreasureEffect` に書けば冠/ティアラ/偽造通貨の2回目が自動で正しくなる**。自己移動する財宝（投資/戦利品/法貨/私掠船の廃棄）は `removeOne` ガードで2回目に自然不発（lose track）＝**新規財宝で自己移動させるなら必ず `if (removeOne(...))` で包む**。
- **【E6で新設】命令（Command）の再演は選び直さない**（公式）：`state.turn.commandAs[命令id]` に1回目の選択を記憶し、`runReplays` が立てる `state._replaying` を見て `replayCommandAs` が再利用する。**`_replaying` はゴーレムの2枚目では立てない**（別カードの新しいプレイ＝選び直せる）。新しい命令カードを足すときは `case` の先頭に `if (replayCommandAs(state, pi, '<id>')) break;` を、選択の reducer に `rememberCommandAs` を入れる。**船長（captain）は持続で「次のターンの開始時」が別のプレイ＝毎ターン選び直す**ので commandAs を使わない（意図的）。
- **【E8で確定・重要】命令（Command）＝「プレイした札は動かない」（2019エラッタ・現行）**。命令カード（大君主/はみだし者/船長/王子）はカードを**サプライ／王子の脇に残したままプレイする**ので、そのカードの「これ(this)を廃棄／脇に置く／山へ戻す／マットに置く」は**必ず失敗する。命令カード自身も身代わりに動かない**。**移動そのもの（と「移動できたなら」で条件づいたボーナス）だけが失われ、残りの効果は普通に解決する**（祝宴の獲得／島の「手札から1枚」／死の荷車の「手札のアクション」／農家の市場の山上VP取得 は起きる。鉱山の村の+$2・略奪の戦利品・宝の地図の金貨・狂人のドロー は起きない）。実装＝`state._cmd`＋`playedByCommand`／`takeSelf`／`playAsCommand`（§0-17）。
  - **「そのカードの名前/種別/コストを得て身代わりに動く」のは 2016年初版ルール＝廃止済み**。RGG が旧 Empires PDF を今もホストしているので**そちらを読むと必ず間違える**。正本は RGG **Dark Ages(2022)** ルールブックPDF の Band of Misfits 項＋Donald X. の 2019エラッタ。
  - **`empires` 固定セットが大君主と自己移動札（農家の市場/陣地）を同居させていない理由「永久VPループ」は旧ルール前提の誤診**。現行では合法・非ループなので、将来セットを組み替えても構わない。
- **【E8で新設】`pending.self`（倒壊/死の荷車の「これを廃棄できるか」）は必ず `DOM.engine.pendingSelf(state, pd, cardId)` で読む**。engine拒否・CPU非提案・UI表示の3面が同じ述語を見ること（片側だけずれると即 CPU 無限ループ）。**pending に新フィールドを足したら、オンライン永続化スナップショット（`server/gameServer.js` が `state.pending` ごと保存・無変換復元）に無い場合のフォールバックを書くこと**＝E8 の敵対レビューで実際に踏んだ（旧 pending の `self` 欠落→falsy→空手札の倒壊が永久 livelock）。
- **【E8で新設】命令の代理プレイは `applyEffect` の内側で「別の本物のカード」をプレイする経路と区別する**（`_cmd.as` で識別）。伝令官/家臣/水晶玉/狂戦士(on-gain) は applyEffect の内側で本物を場に出してプレイするので、そちらの「これ」は本物を指す。
- **【E6の意図的な簡略化】玉座×大君主のネスト**で、玉座の2回目が「先に」走り対象不在で空振りすることがある（`state.replay` が単一FIFOのため＝玉座×玉座の既存挙動と同型）。**保存則・非ループ・クラッシュ無しを敵対レビューとfuzzで確認済み**＝再修正しなくてよい。
- **【E7で新設】「コスト$N以下」の判定は `costIsPlainCoin(id)` を必ず併用する**（engine.js）。公式のコスト比較は coin/負債/ポーションを**成分ごと**に比べるので、負債コストやポーション費用を持つカードは「コスト$N以下」に含まれない（`$0+負債4` は "up to $5" ではない）。`princeEligible`/`captainTargets`/`overlordTargets`/`bandOfMisfitsTargets` と CPU の `bestGain`/`bestGainExact`/`bestPrinceTarget` は同じ除外を持つこと（片側だけだとCPU無限ループ）。
- **【E7で新設】CPUで山のコストを見るときは必ず engine の `cardCost`（実コスト）を使う**。混合山（`knights`/`castles`）のプレースホルダは静的コストが実物とずれる（castles=$3だが一番上は最大$10）。`cpu.js` の `mixedTop(state,id)` が「一番上の実カード」を返す。
- **【E7で判明】新しい CARD_SET を足したら UI の picker にも出す**（`kind:'standard'` は「拡張」タイル）。`test/ui.test.js` の「全 CARD_SETS がセット選択画面から選べる」が守る。**新しいプレースホルダ card を `DOM.CARDS` に足したら webp も生成する**（`verify:e2e` の webp 404 検査が守る）。
