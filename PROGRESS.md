# 進捗（PROGRESS） — ドミニオン Webアプリ

最終更新: 2026-07-07 / branch `main`（最新は `git log` で確認）。**暗黒時代 段階2 は完成＆push済＝本番反映（§0-8・`sw.js` v35）**。**その後に未pushの WIP コミットあり＝冒険（Adventures）段階2 に着手中（§0-9・12/38枚＝Batch3=トークン系まで完了）**。冒険は CARD_SET 未昇格＝通常プレイに出ない（fuzz でのみ実行され緑）ので main にあっても本番挙動は不変。以後の段階2作業も 完成→CARD_SET昇格→全テスト緑→**都度ユーザー確認の上で** push（勝手に push しない）。
公開: GitHub Pages https://ankake-web.github.io/dominion/ （クライアント）＋ Render（オンライン対戦サーバ）。
**新セッションは まず `npm test` を実行し 29スイート・オールグリーン（exit 0・整合性3132件・暗黒時代70件＋UI57件・新プロモ141件＋UI22件・異郷83件＋UI44件・収穫祭107件・ギルド81件＋UI25件・CPU序列 強vs弱100/強vs普通64/普通vs弱95）を確認**してから着手すること。
実ブラウザ検証（puppeteer・手動）: `npm run verify:e2e`（通しプレイスモーク）／`npm run verify:visual`（320〜768pxはみ出し検査）。

---

## 0-9. 段階2＝冒険（Adventures）実プレイ化 **着手中（12/38枚）**（2026-07-07・WIP・未push）

**次セッションはこの節から続行**。着手前に `docs/adding-cards.md` と本節を必読。**未pushコミット（Batch1a/2/2b/3）**＝Adventures はまだ CARD_SET 未昇格＝**通常プレイに出ない**（fuzz でのみ実行され緑）。push は全カード完成→CARD_SET昇格→レビュー後に都度確認。

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

### 残り（次セッションの着手順）
1. ~~**Batch3＝トークン基盤＋トークン系カード**~~ ✅ **完了（2026-07-07）**＝ranger/giant/relic/bridge_troll＋旅/-1カード/-$1トークン。詳細は上の「Batch3 完了」節。
2. **【次はここ】Batch4＝酒場マット/Reserve 基盤＋Reserveカード9枚**：新ゾーン `p.tavern[]`（公開＝islandMat型・allCards/tally/mask に配線／**invariants の ZONES へ 'tavern' 追加が必須**）＋汎用 CALL 機構（呼び出しタイミングがカード別＝coin_of_the_realm=アクションをプレイした時／guide・ratcatcher・transmogrify=手番開始時／duplicate=$6以下獲得時／royal_carriage=アクションのプレイ完了時／wine_merchant=購入フェイズ終了時／distant_lands=呼ばない＝VP専用）。**miser守銭奴**は酒場マットに銅貨を貯める別処理。royal_carriage は命令（再演）。
3. **Batch5＝トラベラー**：page/peasant（サプライ）＋成長先8種（非サプライ山＝各5枚。`NON_SUPPLY`＋cpu `NON_SUPPLY_SET` に8id追加／initSupply で page・peasant があれば各成長先5枚を supply 数値キーで追加／canBuyCard 不可／emptyPileCount 除外）。「場から捨てる時に交換してよい」＝END_TURN/cleanup前のタイミング。champion/teacher/disciple/hero 等の効果。
4. **Batch6＝複雑**：raze倒壊(廃棄→コスト分の山札上を見て1枚手札)／artificer工匠(捨て枚数=コストちょうどを山札上に獲得)／storyteller語り部(財宝を最大3枚プレイ→全コインで+カード)／messenger使者(最初の購入なら全員が同コピー獲得)。
5. **Phase E**：`DOM.KINGDOM_ADVENTURES`固定10種＋`DOM.POOLS.adventures`昇格＋`DOM.CARD_SETS`に2行＋GAIN_ORDER再配置 → `adventures.test.js`/`adventures-ui.test.js` 新設（package.json登録）→ 多エージェント敵対レビュー→CPUソーク→webp（段階1で生成済み・カタログ変更が無ければ再生成不要／`coin:`追加は表示不変）→ `sw.js` v35→v36。
6. **その後＝帝国（Empires）段階2**（別の大仕事）：負債Debt経済／集合=VPトークン山（農民の市場/神殿/野生の狩り）／命令(overlord/crown)／分割山5組（サウナ/アヴァント機構流用）／城8（騎士の混合山流用・勝利点）／villa(手札に獲得しアクションフェイズに戻る)。

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
1. **【最優先・進行中】冒険（Adventures）段階2 の続き（§0-9）**＝現在 12/38枚（Batch3=トークン系まで完了）。**次は Batch4（酒場マット/Reserve 基盤＋Reserveカード9枚）**。着手順・設計事実・落とし穴はすべて **§0-9** に記載（必読）。着手前に `docs/adding-cards.md` も参照。
   - **✅段階2 完了済み拡張**：収穫祭(§0-2)／ギルド(§0-4)／異郷(§0-5)／新プロモ(§0-7)／**暗黒時代 全56枚(§0-8)**。基本・陰謀・海辺・錬金術・繁栄と合わせ、**縦型カードの実プレイ化は暗黒時代まで完了**。冒険が完了したら帝国へ。
2. **段階2の残り＝発売順の未着手拡張**（着手前に `docs/adding-cards.md` を必読。特殊機構は §C）:
   - **冒険(Adventures)＝着手中(§0-9)。その後 帝国(Empires)**＝段階1（画像・カタログ）は済み(§0-6)。帝国の新機構＝負債(Debt)コスト経済・分割山・城の混合山・命令(overlord/crown)・勝利点トークン・集合(Gathering)。横型ランドスケープ（イベント/ランドマーク）は縦枠パイプライン未対応で段階1すら未着手。
   - **発売順その先（段階1すら未着手＝画像・カタログとも無し）**：夜想曲/ルネサンス/移動動物園/同盟/略奪/日の出づる国。
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
