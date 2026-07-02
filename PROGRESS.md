# 進捗（PROGRESS） — ドミニオン Webアプリ

最終更新: 2026-07-03 / branch `main`。**すべてコミット&push済・Pages/Render 自動デプロイ済・作業ツリー clean**。`sw.js` は **v26**。
公開: GitHub Pages https://ankake-web.github.io/dominion/ （クライアント）＋ Render（オンライン対戦サーバ）。
**新セッションは まず `npm test` を実行し 19スイート・2438件オールグリーン（exit 0）を確認**してから着手すること。
実ブラウザ検証（puppeteer・手動）: `npm run verify:e2e`（通しプレイスモーク）／`npm run verify:visual`（320〜768pxはみ出し検査）。

---

## 0. 次セッションのタスク：B案＝王国ごとの「エンジン成立度」を評価するCPU購入AI（決定済み 2026-07-03）

### 決定と理由
- 実測（下表）で「**現行CPUのエンジン買い（`bestEngineBuy`）は現実的な単一拡張王国では純ビッグマネー(BM)に大敗、ただし海辺だけは現行が勝つ**」と判明。買いを絞る単純な中間案は全て「basic/intrigue改善⇔seaside悪化」のトレードオフを壊せず失敗済み。
- → **B案を採用**（ユーザー決定）：ゲーム開始時に王国10種を評価して「エンジンが成立する王国か」を判定し、**成立→エンジン構築買い／不成立→ビッグマネー買い に切り替える**。A案（hardを単純BM寄せ）は「seaside悪化＋CPUが王国カードを買わないUX」のため不採用。
- **性能懸念なし**（確認済み）：静的評価はマイクロ秒オーダー。reduce実測0.04ms/手・CPU手番は演出ウェイト650-950msに埋没。モンテカルロ（プレイアウト先読み）方式にはしない。

### 実測データ（判断の土台。自己対戦A/B＝NEW vs OLD、下記ハーネス）
| セット | 純BM vs 現行(hard) | 純BM vs 現行(normal) |
|---|---|---|
| random-basic | 純BM **82%** | 72% |
| random-intrigue | 純BM **88%** | 84% |
| random(基本+陰謀) | 純BM **78%** | 83% |
| random-alchemy | 純BM **67%** | 68% |
| random-prosperity | 49%（互角） | 47% |
| random-seaside | **43%＝現行が勝つ** | 41% |

- **失敗済みの中間案（再試行しないこと）**：(a) 研究所型キャントリップ(+1アクション&+カード)のみ厳選 → 総合48%・**seaside 19%** ／(b) キャントリップ広め＋呪いアタック≤2 → 総合41-44%・seaside 29% ／(c) 村/ドローの支え条件付き → 総合43-44%・**seaside 17%**。教訓＝**半端なエンジンは無エンジンより弱い**。
- 現行 `bestEngineBuy`（js/cpu.js）＝非ターミナル have<4／ターミナル have<2 かつ terminals<villages+1／王国財宝 have<2、GAIN_ORDER順。ヘルパ `plusActions`/`plusCards`（text正規表現）・`throneValue` あり。seasideで実証済みに機能する。

### 設計の叩き台
1. **`evaluateKingdom(kingdom)` を新設**（王国は対局中不変→ゲーム開始時1回評価してキャッシュ可）。見る要素＝村(+2アクション)の有無／ドロー(+2カード以上)の有無／安価(≤4)キャントリップ数／持続(seaside型テンポ)／呪い配布アタック。第一仮説＝**「村とドローが両方ある」or「seaside型（安キャントリップ＋持続）」→ ENGINE、それ以外 → MONEY**（seasideだけ現行が勝つ実測と整合）。
2. strategy=ENGINE の王国では**現行 `bestEngineBuy` をそのまま**使い、strategy=MONEY では呼ばない（純BM）。MONEYでも「呪い配布アタック≤2枚だけは買う」はBM定石として試す価値あり。
3. 適用範囲：`chooseBuy` 経由で hard/normal 共通に効かせてA/B。easy（`chooseBuyWeak`）はエンジン買い無しで影響なし。
4. **採用条件＝自己対戦A/Bで 総合>52% かつ どのセット（特にseaside）も45%未満に悪化しない**。満たせなければ閾値調整、それでも駄目なら結果をこの§0に記録して不採用でよい（実測が正）。

### 自己対戦A/Bハーネスの再作成手順（前回の `_ab.tmp.js` は規約により削除済み）
- vm sandbox に cards/engine を読み込み、**NEW=作業ツリーの js/cpu.js／OLD=`git show HEAD:js/cpu.js`** を別々に runInContext して DOM.cpu を2つ捕捉。1ゲーム内で `E.actor(s)===newSeat ? newCpu.decide : oldCpu.decide` と席で差し替え。
- **校正の教訓（重要）**：席と王国が交絡しないよう、**同一(seed,セット)のキングダムを NEW=席0 / NEW=席1 の両方で対戦**させる。まずミラー（NEW=OLD）で NEW勝数=OLD勝数 になることを確認してから本計測。勝率＝NEW/(NEW+OLD)（tie除外）。
- セット＝`DOM.kingdomForSet(x)`, x∈{random-basic, random-intrigue, random, random-seaside, random-alchemy, random-prosperity}。250キングダム×2席/水準 程度で判定。
- ※参照ボット方式は使わない（前回「BM+Smithy」参照ボットが鍛冶屋2枚買いで自滅し校正失敗）。自己対戦A/Bが信頼できる指標。
- プロジェクト直下に `_ab.tmp.js` で作り、終わったら必ず削除。

### 完了条件・ガードレール
- `npm test` 19スイート全緑。特に `test/cpu.test.js` の難易度序列（固定シード20260701・決定論：強vs弱≥60%／強vs普通≥45%／普通vs弱≥55%。現在95/55/87%）と `test/invariants.test.js`。
- 購入ロジックのみの変更＝**新pendingを作らない**（CPU `decidePending`／UI `viewPendingModal` の追加不要）。
- cpu.js はクライアント配信資産 → **`sw.js` VERSION v26→v27**。PROGRESS.md 追記 → コミット → push（Pages/Render自動）。

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
- **CPU購入はB案（王国評価で ENGINE/MONEY 切替）で行く（2026-07-03決定）**：詳細と理由は §0。A案（BM寄せ）は seaside悪化＋エンジンレスUXのため不採用。性能懸念なしを確認済み。
- **枠は画像（金属枠）方式**：コード描画SVGでは基準カードの絵画的な金に届かなかった（5回差し戻し。詳細 `docs/handover.md`）。
- **画像だけ先・ゲームロジックは別タスク**：新拡張はまず `DOM.CARDS` カタログ＋孤立プール＋`GAIN_ORDER` で「画像は出るがゲームに入らない」状態にし整合性テストを緑に保つ→後で実ゲーム化（海辺/錬金術/繁栄はこの方式で完了）。
- **海辺の簡略化2点は本格実装済み**：封鎖の堀免疫窓・海賊の財宝獲得リアクション。on-gain対話は `!pending && _gainDepth===1` ゲートで安全側。

## 5. 未完了タスク（優先順。次セッションは 1. から）
1. **B案：王国評価型CPU購入AIの実装**（→ **§0 に完全な作業指示**。実測データ・設計叩き台・A/Bハーネス手順・採用条件すべて記載）。
2. **新拡張の画像化（要アート）**：コード側（カタログ＋孤立プール＋GAIN_ORDER）は追加可能だが、完成画像には `asset/art/<id>.png`（AI生成・ローカルgitignore）が新規に必要。どの拡張か＋アートの用意方法を決めてから着手。
3. **錬金術アートの△3枚最終確認（任意）**：変成/薬草商/薬剤師。差し替えは `asset/art/<id>.png` →`node tools/build-cards.js`→該当webpデプロイ。
4. （任意・過去メモ）絵文字→game-icons.net SVG 化、vanilla効果DSL 等。

## 6. 詰まり・注意点・保留中の判断
- **新カードを `DOM.CARDS` に足すと整合性テストが赤くなる**（GAIN_ORDER網羅＋POOL所属を要求）→ 孤立プール＋GAIN_ORDER追加で回避。実ゲーム化時は ATTACKS/PLAYER_ACTIONS/CPU decidePending/UI viewPendingModal も忘れず（抜けはCIで赤 or CPU無限ループ/人間詰み）。
- **デプロイ**：サーバ変更時は Pages と Render の反映タイミング差で一時的に空振りし得る。`sw.js` VERSION更新を忘れない。
- **一時スクリプト規約**：使い捨ては**プロジェクト直下に `_*.tmp.js`** で作り実行後**必ず削除**。スクショ等は scratchpad へ。シェルcwdがずれることがあるので実行前に `Set-Location 'C:\Users\b1242\claude\game\dominion'`。
- **支配（Possession）の廃棄カード返却の簡略化＝到達不能を証明済み（監査⑤）＝意図的に未修正**：`possession` は alchemy プール専用で、複数プールを混ぜる出荷セット（random/random-promo/random-1e）はいずれも alchemy を含まない＝支配と外部拡張self-trashはどの出荷王国でも共存しない。全self-trashのtrashOwn化はアタック廃棄/供給廃棄の誤変換で**可到達バグを生むリスク**があり見送り。**混成alchemyモードを正式追加する時に一緒に対応**する方針。同型のポーション費用問題も到達不能（可到達だった大学のみガード済み）。
- **支配のCPU簡略化**：CPUは支配を自動購入しない（`bestPotionBuy` で除外）。人間が使うぶんは支配者がCPUでも動作する。
