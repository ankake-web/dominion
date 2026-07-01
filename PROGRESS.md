# 進捗（PROGRESS） — ドミニオン Webアプリ

最終更新: 2026-07-01 / branch `main`。**繁栄（Prosperity 第二版）27種＋錬金術（Alchemy 第二版）13種を実プレイ可能に実装＝デプロイ予定**。
公開: GitHub Pages https://ankake-web.github.io/dominion/ （クライアント）＋ Render（オンライン対戦サーバ）。
**新セッションは まず `npm test` を実行し 1839件オールグリーンを確認**してから着手すること（17スイート）。

### 繁栄（Prosperity 第二版）27種を実プレイ可能に（2026-07-01）
- **25王国＋プラチナ貨＋植民地**を実装。新セット「**繁栄セット**」(`DOM.KINGDOM_PROSPERITY` 固定10種)＋「**繁栄から**」(ランダム)。`POOLS.prosperity`(25種)。
- **新基盤**：(1)**VPトークン** `player.vpTokens`（司教・記念碑・収集・投資。`vpOf` で加算・`maskStateFor` は素通し=公開）。(2)**プラチナ貨/植民地**＝`initSupply` が王国に繁栄カードがあるとき自動供給（platinum 12 / colony v）。盤面の財宝/勝利点列に条件表示。(3)**コスト軽減** `cardCost`（石切場＝場にある間アクション$2安／行商人＝購入時 場のアクション数×$2安）。(4)**動的財宝** 銀行＝`playTreasureCard` で場の財宝枚数ぶん。(5)**`canBuyCard`**（高級市場＝場に銅貨で不可。engine/CPU/UI 共用で空振り防止）。
- **獲得時フック**（`triggerOnGain`）：隠し財産＝勝利点獲得→金貨（**購入時→獲得時に faithful 化**。`applyHoardOnBuy` は no-op 化）／収集＝アクション獲得→+VP／物見やぐら・ティアラ＝獲得物の廃棄/山札上（`_gainDepth===1 && !pending` の安全ガード＝自分の手番の主獲得時のみ）。
- **アタック**：群衆／会計士／ペテン師を `ATTACKS` 登録（堀で無効化可）。**王の宮廷**＝`replay` に2回積んで3回プレイ（runReplays 上限 30→200）。**会計士の手番開始時プレイ**も実装（`clerk_start` を `resolveDurationStartEffects` で startQueue へ）。
- 24+1 の新 reducer（`BISHOP_*`/`VAULT_*`/`MINT_REVEAL`/`EXPAND_*`/`FORGE_*`/`KINGS_COURT_CHOOSE`/`WAR_CHEST_*`/`WATCHTOWER`/`TIARA_*`/`ANVIL_*`/`INVESTMENT*`/`CRYSTAL_BALL`/`CLERK_*` 等）＋ `PLAYER_ACTIONS`＋CPU `decidePending` 全分岐＋`chooseAction`/`chooseBuy`(植民地/プラチナ優先)＋UI `viewPendingModal` 全モーダル。
- **敵対的レビュー（サブエージェント）で発見→修正**：①司教を空手札で使うとデッドロック→`hand>0` ガード。②ティアラの2回目コインが相手の堀で取りこぼし→pending 無関係に常時加算。③会計士の手番開始プレイ未実装→実装。④runReplays 上限30→200。
- **検証**：`test/prosperity.test.js`(56)・`test/prosperity-ui.test.js`(29) 追加。CPU対CPU **157戦(2-4人)0デッドロック**、実ブラウザで盤面描画＋webp読込(broken 0)、27枚モンタージュ目視OK。**全テスト約1737件緑**。
- **カード画像**：`asset/cards/<id>.webp` 26枚新規＋hoard更新（繁栄調の新絵＋テキストを「獲得時」に修正）。`carddata.js` の hoard DISPLAY も修正。差分は新規26＋hoardのみ（既存はgrainのみ→`git checkout`で戻し）。
- **デプロイ**：`sw.js` v15→**v16**（クライアント更新）。繁栄webpは deploy.yml の glob でコピー、実行時プリキャッシュ（precache不要）。

### 錬金術（Alchemy 第二版）13種を実プレイ可能に（2026-07-01）
- **12種＋支配**を実装。新セット「**錬金術セット**」(`DOM.KINGDOM_ALCHEMY` 固定10種)＋「**錬金術から**」(ランダム, `POOLS.alchemy`=王国12種)を**有効化**（上記で一時無効化していた2エントリを実装完了に伴い復活）。
- **ポーション経済（新基盤）**：`initSupply` が王国にポーション費用カードがあると**ポーション山(16)**を自動供給／`freshTurn` に `turn.potions`／`playTreasureCard` で potion 財宝→`t.potions+=1`／**BUY にポーション費用判定を追加**（コスト0でもポーション無しはタダ取り不可＝重要）。`potionCost(id)`（コイン軽減では下がらない）。UI＝**POTIONバッジ(紫)＋ポーション山を財宝列に＋購入可否 `affordable()`**（コイン・ポーション・繁栄制約を1関数に集約）。
- **各カード**：変成(種類ごと獲得・多重タイプは各ぶん)／ブドウ園(所持アクション3枚=1VP＝`vpOf` に加算)／薬草商(片付けで場の財宝を山上=cleanup自動)／薬剤師(上4枚の銅貨/ポーションを手札・残りを並べ替え)／念視の泉(密偵型アタック＋自分はアクション以外まで公開ドロー)／大学(アクション獲得)／錬金術師(場にポーションで山上=cleanup自動)／使い魔(魔女型アタック)／賢者の石(山札+捨て札÷5コイン)／ゴーレム(アクション2枚を replay で使う。runReplays に `label:'golem'` 分岐)／徒弟(廃棄コインぶんドロー・ポーション費用は+2)。使い魔・念視の泉を `ATTACKS` 登録。
- **支配（Possession）＝最難**：`turn.possessedBy`(操作者)/`turn.rotationSeat`(回り順を崩さない)/`state.extraTurns`(追加ターン待ち行列)。**`actor()` を支配ルーティング化**（被支配者=activeの決定を支配者に委譲。他人のリアクションは本人）。**`gain()` リダイレクト**（被支配者の獲得→脇→精算で支配者の捨て札へ）。**`trashOwn()`**（被支配者の廃棄→脇→精算で本人の捨て札へ戻す＝永久廃棄しない。錬金術の廃棄は変成/徒弟が使用。§注意参照）。`cleanupAndAdvance` で精算＋次手番決定（前哨地→支配追加ターン→通常rotationSeat+1）。UI＝**maskStateForで支配者に被支配者の手札を開示／「🎭 支配中」バナー／被支配者の手札を操作対象として描画**（`handP`）／pendingモーダルの表示判定を `pending.player===viewer` から `interactive`(=actor===viewer)へ（支配で詰まないため）。オンラインは `actor()` 経由で**サーバ無改修**（送信可否・CPU判定とも actor で正しく分岐）。
- **CPU**：`decidePending` 全8分岐＋`chooseAction`(非ターミナル/ターミナル分類)＋`chooseBuy`(ポーション所持で錬金カード優先・未所持なら potion 仕込み。支配はCPU自動購入から除外)＋`decide` を支配対応(被支配者の手札を操作・操作者levelで判断)。`vpOf` にブドウ園。
- **敵対的レビュー（多エージェントWorkflow＋CPUストレス）で発見→全修正（7件）**：
  ①**CPU無限ループ**：ポーション0でも「ポーション費用カード」を勝ち筋/廉価札として選び続け reduce が no-op（`chooseBuy` 最終ガード・`kingdomAffordable`・hard の勝ち筋スキャンがコイン費用のみ判定）→3箇所にポーション費用充足チェック追加。②**大学がポーション費用アクションを獲得できた**（ルール違反・純錬金術で踏む）→ engine 2箇所(anyGainable/UNIVERSITY_GAIN)＋cpu＋ui の述語に `potionCost===0` 追加。③**連鎖支配**（被支配ターン中に支配をプレイ）で操作権/獲得先が中間の被支配者に向く（オンライン悪用）→ `possessedBy` を「元の支配者」`t.possessedBy` から継承。④**手札のポーションが盤面に描画されない**（`handGroups` の `SUPPLY_ORDER` に potion が無く全グループから脱落・毎ゲーム発生）→ 並びに `potion` を追加。⑤支配中『財宝を全部出す』ボタン活性が支配者手札を見る→被支配者(`t.active`)で判定（`viewActionBar`/`endTurnTap`/`endActionPhase`）。⑥ゴーレム/連鎖で使ったアクションが `actionsPlayed` に計上されず（混成王国の共謀者）→加算。⑦（対応不要）CPUは支配を自動購入しないため CPU-支配者の買い最適化が被支配者向きなのはデッドコード。
- **検証**：`test/alchemy.test.js`(80＝12種＋ポーション経済＋支配＋回帰)・`test/alchemy-ui.test.js`(20)。CPU対CPU **120戦(固定/ランダム×2-4人×全難易度)0詰み**、大学のポーション費用不変条件を確認。**全テスト1839件緑（17スイート・`npm test` exit 0）**。`sw.js` v16→**v17**。
- **カード画像**：13枚は既存(前セッションで生成済み)。ロジック追加のみで画像/`carddata.js` は不変。

過去の広い文脈（第二版化・単一ソース化・整合性テスト・オンライン再接続・枠画像方式の経緯など）は `docs/handover.md` を参照。

---

## 1. ゴール
- スマホ向けドミニオン対戦Webアプリ（CPU戦・2〜4人ローカル・オンライン対戦）。回答/UIは日本語。
- カードは「**金属枠＋AI生成の絵＋コード描画の文字** を合成した完成画像」(`asset/cards/<id>.webp`)。見栄えは基準カード `asset/<id>.jpg` と同等の高級感を目指す（達成済み＝金トリム方式）。
- 拡張を「壊さず」増やせる単一ソース設計を維持する。

## 2. アーキテクチャ（カードを増やす/触るとき必読）
- **表示データの正本＝`js/cards.js` の `DOM.CARDS`**（id/name/cost/types/text、+ 海辺の持続や `potion`=ポーション費用など）。`js/carddata.js` がそこから名前/コスト/種別ラベル/枠色/画像パスを自動導出。`cards.html`(一覧プレビュー) も `tools/build-cards.js`(画像生成) も `DOM.CARDS` を見る。
- **完成画像の生成**：`node tools/build-cards.js`（プロジェクト直下を cwd に）。masterフレーム1枚（`images/assets/…20_21_29.png`、recursiveに探索）を種別8スキンに recolor → 各カードで 枠＋絵(`asset/art/<id>.png`)＋文字(コスト/名前/種別/効果) を canvas 合成 → 768×1152 WebP を `asset/cards/<id>.webp` に出力（全117枚）。`CARDS_OUT` 環境変数で出力先を変えてプレビュー可。入力の `images/`・`asset/art/` は `.gitignore`（このPCのみ。webpだけ追跡）。
- **エンジン**：`js/engine.js`。`reduce(state, action)` の純関数。`applyEffect` の per-card switch、選択は `state.pending` ＋ `*_RESOLVE` reducer。攻撃は `const ATTACKS={}` 登録表＋`*EnterVictim`。`DOM.engine.PLAYER_ACTIONS`(Set) が「プレイヤーが送れる action」の唯一の許可リスト（サーバも参照）。効果プリミティブ `discardFromHand/trashFromHand/finishGain`。
- **CPU**：`js/cpu.js`。`chooseAction`(出すカード)・`decidePending`(各pendingへの応答＝**新pendingには必ず分岐を足す。無いとCPUが無限ループ**)・`GAIN_ORDER`(購入優先＝**全カード網羅必須**)。
- **UI**：`js/ui.js`。`viewBoard`(盤面)・`viewPendingModal`(選択モーダル)・`modal*`ヘルパ。オンラインも同じ `ui.js`（NetStore.dispatch）。
- **整合性テスト** `test/integrity.test.js`：reduce case↔PLAYER_ACTIONS一致／GAIN_ORDER=全カード／全カードがいずれかのPOOL所属／固定セットは10種／react攻撃はATTACKS登録／表示データ一致 を自動検証。**抜けはCIで即赤**。
- **デプロイ**：main に push → `.github/workflows/deploy.yml` が `_site` を組んで Pages 公開、サーバ変更は Render が自動再デプロイ。**新しい配信フォルダを足したら deploy.yml のコピー対象に追加**（忘れると本番404）。**`sw.js` を変えたら VERSION を上げる**（現在 v15。client UI 変更時は上げる）。コミット者はローカル設定済み（Naoki Inoue）。

## 3. 完了したこと（このセッション 2026-06-30・すべてコミット＆デプロイ済み）
- **カード完成画像（全117枚）**：基本/陰謀/プロモ77＋**海辺27**＋**錬金術13**。枠は「**金トリム方式**」＝色地カード(victory/curse/action/attack/reaction/duration)は地色＋**金レール**、財宝は銅/銀/金の専用メタル。コイン中央は暗いメダル＋白数字。持続=オレンジ枠。**錬金術のポーション費用は紫のフラスコ記号**（ポーションのみ=フラスコだけ／コイン+ポーション=数字+小フラスコ／支配=6+×2）。生成は `tools/build-cards.js`。
- **海辺（Seaside 第二版）27種を実プレイ可能に**（commit `33876f5`）。新セット「海辺セット(固定10種)」「海辺から(ランダム)」。**持続(Duration)機構**＝`durationCards`/`delayedEffects`/`setAside`/`islandMat`/`nativeVillageMat`、`cleanupAndAdvance` で持ち越し仕分け、`resolveDurationStartEffects`+`turn.startQueue`+`popStartQueue`、`DURATION_RESOLVERS`、`armDuration`。マット(島/原住民)、追加ターン(前哨地)、灯台免疫(`attackImmune`を全攻撃に配線)、on-gain/on-playフック(`triggerOnGain`=サル/封鎖、`corsairOnPlayTreasure`=私掠船、再帰ガード付)、巾着切り/海の魔女をATTACKS登録、宝物庫/密輸人。**船乗りの「獲得した持続を即プレイ」も実装済み**(`sailor_play_gain`)。`test/seaside.test.js`(85)・`test/seaside-ui.test.js`(22)。
- **オンライン/UI改善（commit `325e31d`/`18fb4d6`）**：盤面アクション列をコスト順／獲得アニメのカード上数字を削除／ゲストのロビーをホストと同項目(読取専用)＋初心者モードON/OFFをロビーに／名前を`localStorage`記憶／**手番順(上から順/ランダム)を選択可**(`server/gameServer.js` `randomOrder`)／カード拡大を閉じてもスクロール位置保持／カード一覧に海辺・錬金術追加／選択モーダルのカードを大きく表示。`sw.js` v15。

## 4. 決定事項とその理由
- **枠は画像（金属枠）方式**。コード描画SVGの金は基準カードの絵画的な金に構造的に届かなかったため（過去に5回差し戻し。詳細 `docs/handover.md`）。
- **画像だけ先・ゲームロジックは別タスク**。新拡張はまず `DOM.CARDS` にカタログ追加＋**孤立プール**＋`GAIN_ORDER`追加で「画像は出るがゲームには入らない＝壊れない」状態にし、整合性テストを緑に保つ→後で実ゲーム化して `POOLS`→`CARD_SET` 昇格。海辺・錬金術・繁栄はすべて実プレイ可能化済み（この方式で段階実装した）。
- **海辺の一部効果は簡略化**：封鎖の「呪い窓に堀で免疫」、海賊の「財宝獲得時リアクションで手札から出す」は未実装（基本効果は実装）。on-gain中の対話pendingが複雑で安全側に倒した。（船乗りの即プレイは要望を受け実装済み。）

## 5. 未完了タスク（次セッションはここから・優先順）
1. **（完了・2026-07-01）錬金術（Alchemy）13種を実プレイ可能に**（支配含む）。詳細は上の「錬金術…」節。→ 残タスクは無し。任意で錬金術×繁栄など**混成王国のCPU購入バランス調整**。
2. **海辺の簡略化2点の本格実装（任意）**：封鎖の堀免疫窓・海賊の財宝獲得リアクション。
3. **錬金術アートの△3枚最終確認（任意）**：変成=金の変成光／薬草商=女性が薬草調合／薬剤師=天秤の男。目視では妥当。入替えたい場合は `asset/art/<id>.png` を差し替え→`node tools/build-cards.js`→該当webp再デプロイ。
4. （任意・過去メモ）絵文字→game-icons.net SVG 化、vanilla効果DSL 等。

## 6. 詰まり・注意点・保留中の判断
- **新カードを `DOM.CARDS` に足すと整合性テストが赤くなる**（GAIN_ORDER網羅＋POOL所属を要求）。→ 孤立プール＋GAIN_ORDER追加で回避（§4）。実ゲーム化するときは ATTACKS/PLAYER_ACTIONS/CPU decidePending/UI viewPendingModal も忘れず（抜けはCIで赤 or CPU無限ループ）。
- **デプロイ**：サーバ(`server/gameServer.js`)変更時は client(Pages)とserver(Render)が同時反映されるまで一時的に機能が空振りし得る（手番順トグル等）。push一発で両方走るが反映タイミング差に注意。`sw.js` VERSION更新を忘れない。
- **一時スクリプト規約**：puppeteer/contact等の使い捨ては**プロジェクト直下に `_*.tmp.js`** で作り `node` 実行後に**必ず削除**（直下を汚さない）。スクショ/montageは scratchpad へ。**シェルのcwdが `images/` 等にずれることがある**ので、tmpスクリプトは絶対パス推奨、build/test実行前に `Set-Location 'C:\Users\b1242\claude\game\dominion'`。
- 入力アセット（`images/`・`asset/art/`）は `.gitignore` で**このPCローカルのみ**。画像の再生成はこのPCでしかできない。
- **支配（Possession）の廃棄カード返却の簡略化**：被支配者の廃棄を本人へ戻す処理は `trashOwn(state, owner, card)` 経由のカードだけが対象。錬金術の廃棄カード（変成・徒弟）は `trashOwn` 使用済みなので**出荷セット（純錬金術＝錬金術セット/錬金術から）では完全に正確**。基本/陰謀/海辺/繁栄の廃棄カード（礼拝堂・鉱山等）は従来どおり `state.trash.push` のままなので、**混成王国で支配下にそれらを使うと実廃棄になる**（＝返却されない簡略化）。出荷セットは純錬金術なので実害なし。全 self-trash を `trashOwn` 化すれば完全対応可（各サイトに owner を渡すだけ・非支配時は挙動不変）。
- **支配のCPU簡略化**：CPUは支配を自動購入しない（`bestPotionBuy` で除外）。人間が買って使うぶんには支配者がCPUでも被支配ターンを操作できる（`decide` 対応済み）。
