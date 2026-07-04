# 進捗（PROGRESS） — ドミニオン Webアプリ

最終更新: 2026-07-04 / branch `main`。**段階1(下記§0-3)まで コミット済＝`651e3f6`（※未push・pushは要確認）。それ以前はpush済**。`sw.js` は **v30**。
公開: GitHub Pages https://ankake-web.github.io/dominion/ （クライアント）＋ Render（オンライン対戦サーバ）。
**新セッションは まず `npm test` を実行し 21スイート・オールグリーン（exit 0・整合性2413件・収穫祭107件・CPU序列 強vs弱100/強vs普通64/普通vs弱95）を確認**してから着手すること。
実ブラウザ検証（puppeteer・手動）: `npm run verify:e2e`（通しプレイスモーク）／`npm run verify:visual`（320〜768pxはみ出し検査）。

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
1. **段階2＝全カード実プレイ化（ユーザー決定・約128枚・完全忠実）**。対象＝収穫祭13＋褒賞5＋異郷35＋**暗黒時代を全56に完成**＋新プロモ6＋**ギルド13**。方針＝特殊山・全トリガー・command系まで**機構ごと新設**（簡略化しない）。
   - **実装の設計図＝`docs/adding-cards.md`**（全機構の file:line ＋コピー元パターン＋落とし穴。毎回これを見れば実装できる）。
   - **着手順（新機構の少ない順）＝ ~~収穫祭~~✅ → ギルド → 異郷 → 新プロモ → 暗黒時代完成**。1拡張ずつ 効果+pending+CPU+UI+ATTACKS/PLAYER_ACTIONS+テスト → `npm test`緑 → コミット。**各拡張は完成してから CARD_SET 昇格**（＝中途の暗黒時代がデプロイに出ない）。
   - **✅収穫祭は完了（2026-07-04・§0-2）**。**✅段階1（画像化・カタログ）は残り全49枚[ギルド13＋暗黒時代残り36]完了（2026-07-04・§0-3・`651e3f6`）＝暗黒時代の残りカタログ定義もここで済んだ**（下記の「暗黒時代の残り」カタログ項は消化済／段階2ロジックが未実装）。
   - **次はギルド（13枚）を段階2実プレイ化**：新機構＝コイントークンCoffers（=**財源**・per-player数値＋`COFFERS_SPEND` の4点セット）／overpay（購入時に超過払い＝BUY拡張。stonemason/doctor/masterpiece/herald）／trash-to-gain（stonemason/butcher）／アタック2種（収税吏taxman・予言者soothsayer）／merchant_guild の購入毎トリガー／baker のセットアップ。賞品Prizes山（`NON_SUPPLY`・非サプライ数値キー）と収穫祭の各機構が良いコピー元。**カード定義は§0-3で追加済＝engine効果/pending/CPU/UI/CARD_SET昇格を足すだけ**。
   - **新設が要る機構**：賞品Prizes山（収穫祭）／Bane（若き魔女）／可変VP fairgrounds/silk_road/feodum（vpOfに1ブロック）／持続 captain/church（armDuration+RESOLVER）／command procession/band_of_misfits/captain/trusty_steed（replayキュー）／王子prince（脇から毎ターン）／コイントークンCoffers（ギルド・per-player数値+COFFERS_SPEND）／overpay（ギルド）／廃墟Ruins・騎士Knights混合山＋戦利品/狂人/傭兵（暗黒時代・top-level配列/非サプライ）／避難所Shelters（開始デッキ置換）／on-trash・on-discardフック（暗黒時代・要塞/市場の広場等で新設、本人任意廃棄に限定）。
   - **暗黒時代の残り**：段階1未追加の王国15枚（junk_dealer/bandit_camp/rebuild/catacombs/graverobber/count/band_of_misfits/mystic/rogue/pillage/cultist/knights/counterfeit/hunting_grounds/altar）＋廃墟5/避難所3/騎士10/戦利品/狂人/傭兵 のカタログ定義＆GAIN_ORDER＆（絵は後入れ）も要。**絵は後で挿入方針**＝定義とロジックを先に、webpは枠+文字で生成orアート後入れ。
2. **錬金術アートの△3枚最終確認（任意）**：変成/薬草商/薬剤師。差し替えは `asset/art/<id>.png` →`node tools/build-cards.js`→該当webpデプロイ。
3. （任意・CPU購入の残課題）B案は「拡張＋礼拝堂エンジン」で ENGINE/MONEY を切替済み。さらに踏み込むなら **MONEY王国での BM+呪いアタック（魔女等≤2枚）** や **王国個別のエンジン成立度スコアリング**が候補（現状でも総合71%なので優先度は低い）。
4. （任意・過去メモ）絵文字→game-icons.net SVG 化、vanilla効果DSL 等。

## 6. 詰まり・注意点・保留中の判断
- **新カードを `DOM.CARDS` に足すと整合性テストが赤くなる**（GAIN_ORDER網羅＋POOL所属を要求）→ 孤立プール＋GAIN_ORDER追加で回避。実ゲーム化時は ATTACKS/PLAYER_ACTIONS/CPU decidePending/UI viewPendingModal も忘れず（抜けはCIで赤 or CPU無限ループ/人間詰み）。
- **デプロイ**：サーバ変更時は Pages と Render の反映タイミング差で一時的に空振りし得る。`sw.js` VERSION更新を忘れない。
- **一時スクリプト規約**：使い捨ては**プロジェクト直下に `_*.tmp.js`** で作り実行後**必ず削除**。スクショ等は scratchpad へ。シェルcwdがずれることがあるので実行前に `Set-Location 'C:\Users\b1242\claude\game\dominion'`。
- **支配（Possession）の廃棄カード返却の簡略化＝到達不能を証明済み（監査⑤）＝意図的に未修正**：`possession` は alchemy プール専用で、複数プールを混ぜる出荷セット（random/random-promo/random-1e）はいずれも alchemy を含まない＝支配と外部拡張self-trashはどの出荷王国でも共存しない。全self-trashのtrashOwn化はアタック廃棄/供給廃棄の誤変換で**可到達バグを生むリスク**があり見送り。**混成alchemyモードを正式追加する時に一緒に対応**する方針。同型のポーション費用問題も到達不能（可到達だった大学のみガード済み）。
- **支配のCPU簡略化**：CPUは支配を自動購入しない（`bestPotionBuy` で除外）。人間が使うぶんは支配者がCPUでも動作する。
- **非サプライ数値キー山（賞品Prizes・将来の戦利品/狂人/傭兵）を足すときの必須チェックリスト**（§0-2のレビューで実際に踏んだ罠）：`NON_SUPPLY` set に登録し、**(1) `emptyPileCount`(3山終了) (2) `canBuyCard`(購入) (3) `blackMarket` 母集団（`createInitialState` の universe フィルタ） (4) 汎用獲得（engine の `*_GAIN` reducer と CPU `bestGain`/`bestGainExact`）** の4系統すべてから除外すること。特に「reducer だけガードして CPU 側を放置すると、CPU が拒否される獲得を出し続けて無限ループ」する（豊穣の角で実際に発生）＝**engine拒否とCPU非提案は必ずセット**。汎用獲得を持つ札（`horn_of_plenty` 等）は特に漏れやすい。
- **段階1(§0-3)は コミット済だが未push**（`651e3f6`本体＋`e833fbd`/本ハンドオフのdoc）。**ユーザー決定＝push はギルド段階2完成後にまとめて**（段階1は画像のみ＝ゲーム未参加なので単独push不要）。次セッションでギルド段階2を完成させ、CARD_SET昇格まで済んだら `git push`（本番デプロイ）を**都度確認の上で**行う。
- **段階1で追加した暗黒時代の非サプライ札（戦利品/狂人/傭兵/騎士10種/廃墟5/避難所3）を段階2で実プレイ化する時は、上の「4系統除外チェックリスト」を必ず通す**。特殊山（廃墟＝混合順序山→top-level配列・invariants tally追加／騎士＝混合山／避難所＝開始デッキ置換）は `docs/adding-cards.md` §C に実装手順あり。新種別 knight/ruins/shelter は表示ラベルのみ実装済（engineロジックは段階2で新設）。
