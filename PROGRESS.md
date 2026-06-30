# 進捗（PROGRESS） — ドミニオン Webアプリ

最終更新: 2026-06-30 / branch `main` / **すべてコミット＆本番デプロイ済み・作業ツリーはクリーン**（最新コミット `18fb4d6`、`origin/main` と同期）。
公開: GitHub Pages https://ankake-web.github.io/dominion/ （クライアント）＋ Render（オンライン対戦サーバ）。
**新セッションは まず `npm test` を実行し 1520件オールグリーンを確認**してから着手すること（合計 = 整合性613＋194＋拡張165＋第二版159＋海辺85＋CPU50＋UI75＋拡張UI43＋第二版UI24＋海辺UI22＋サーバ45＋オンライン29＋耐久16）。
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
- **画像だけ先・ゲームロジックは別タスク**。新拡張はまず `DOM.CARDS` にカタログ追加＋**孤立プール**（`POOLS.seaside`は実装後にセット参照へ昇格、`POOLS.alchemy`は現在も孤立）＋`GAIN_ORDER`追加で「画像は出るがゲームには入らない＝壊れない」状態にし、整合性テストを緑に保つ。錬金術は現在この段階（画像のみ）。
- **海辺の一部効果は簡略化**：封鎖の「呪い窓に堀で免疫」、海賊の「財宝獲得時リアクションで手札から出す」は未実装（基本効果は実装）。on-gain中の対話pendingが複雑で安全側に倒した。（船乗りの即プレイは要望を受け実装済み。）

## 5. 未完了タスク（次セッションはここから・優先順）
1. **錬金術（Alchemy）の実ゲームロジック実装**（現在は画像のみ＝孤立プールでプレイ不可）。海辺と同様に大がかり。要点：ポーション（特殊財宝サプライ＋ポーション費用の購入処理）、ブドウ園/賢者の石の変動VP、各カード効果、**支配=相手のターンを自分が操作**（最難・要設計）。海辺の持続機構・`POOLS`→`CARD_SET`昇格・CPU/UI/テストの手順をそのまま踏襲。
2. **海辺の簡略化2点の本格実装（任意）**：封鎖の堀免疫窓・海賊の財宝獲得リアクション。
3. **錬金術アートの△3枚最終確認（任意）**：変成=金の変成光／薬草商=女性が薬草調合／薬剤師=天秤の男。目視では妥当。入替えたい場合は `asset/art/<id>.png` を差し替え→`node tools/build-cards.js`→該当webp再デプロイ。
4. （任意・過去メモ）絵文字→game-icons.net SVG 化、vanilla効果DSL 等。

## 6. 詰まり・注意点・保留中の判断
- **新カードを `DOM.CARDS` に足すと整合性テストが赤くなる**（GAIN_ORDER網羅＋POOL所属を要求）。→ 孤立プール＋GAIN_ORDER追加で回避（§4）。実ゲーム化するときは ATTACKS/PLAYER_ACTIONS/CPU decidePending/UI viewPendingModal も忘れず（抜けはCIで赤 or CPU無限ループ）。
- **デプロイ**：サーバ(`server/gameServer.js`)変更時は client(Pages)とserver(Render)が同時反映されるまで一時的に機能が空振りし得る（手番順トグル等）。push一発で両方走るが反映タイミング差に注意。`sw.js` VERSION更新を忘れない。
- **一時スクリプト規約**：puppeteer/contact等の使い捨ては**プロジェクト直下に `_*.tmp.js`** で作り `node` 実行後に**必ず削除**（直下を汚さない）。スクショ/montageは scratchpad へ。**シェルのcwdが `images/` 等にずれることがある**ので、tmpスクリプトは絶対パス推奨、build/test実行前に `Set-Location 'C:\Users\b1242\claude\game\dominion'`。
- 入力アセット（`images/`・`asset/art/`）は `.gitignore` で**このPCローカルのみ**。画像の再生成はこのPCでしかできない。
