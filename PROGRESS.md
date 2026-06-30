# 進捗（PROGRESS） — ドミニオン Webアプリ

最終更新: 2026-06-30 / branch `main`。**海辺27種：カード画像化（commit `196b53d`）＋金トリム見栄え改善（`55802ca`）＋実ゲームロジック実装、すべて本番デプロイ済み**。GitHub Pages https://ankake-web.github.io/dominion/ ・Render。
これまでの蓄積分（第二版・陰謀・単一ソース化・整合性/UIテスト等）＋カード完成画像方式を一括で本番反映済み。
新セッションは **まず `npm test` を実行してグリーンを確認**してから着手すること（**現在 1436件**＝海辺ゲームロジック＋テストで1344→1436に増加）。
広い文脈（第二版化・単一ソース化・整合性テスト・オンライン再接続など過去分）は `docs/handover.md` を参照。
> ★直前まで held-back だった「UI改善5件＋船乗り即プレイ＋錬金術画像化」は **commit `325e31d` でコミット＆push 済み（本番反映）**。

### UI微修正4件（2026-06-30・コミット＆デプロイ）
- **カード拡大を閉じてもページ先頭に戻らない**：`render()` で「モーダルを開く直前のスクロール位置」を `UI._pageScrollY` に記録し、同じ画面でモーダルを閉じた時に復元（`document.scrollingElement` を使用。overflow:hidden解除後に戻すので確実）。盤面のカード詳細・拡大確認・ログ等すべてのモーダルに効く。
- **カード一覧に海辺・錬金術を追加**：`viewCardList()` に `POOLS.seaside`(27) と `POOLS.alchemy`(13) のグループを基本/陰謀の後に追加（コスト順）。
- **廃棄など選択モーダルのカードを大きく表示**：`.chip-grid .card.sm` を 84px→**118px**（min-height 118→166）に拡大（礼拝堂/地下貯蔵庫/民兵/廃棄系などの選択が見やすく）。
- **sw.js v14→v15**：クライアントUI変更を配信（CORE に css/ui.js 等を含むためVERSION更新で更新が降りる）。
- テスト `npm test` グリーン維持（1452件）＋一時jsdomで一覧・選択モーダル・スクロール開閉の11項目を確認後に削除。

### 錬金術（Alchemy 第二版）13種を**カード画像化**（2026-06-30・★commit `325e31d` でコミット＆デプロイ済み）
- 海辺と同じ完成画像パイプラインで錬金術13種（ポーション/変成/ブドウ園/薬草商/薬剤師/念視の泉/大学/錬金術師/使い魔/賢者の石/ゴーレム/徒弟/支配）の `asset/cards/<id>.webp` を生成。**画像のみ**（実ゲームロジックは別途・未実装＝孤立プール `alchemy` でゲーム不変）。
- 絵13枚（images/ の 20_58台7枚＋22_2x台6枚）をコンタクトシートで識別し `asset/art/<id>.png` に配置。`js/cards.js` に13種をカタログ追加（`potion` フィールド＝ポーション費用）＋ `POOLS.alchemy`（孤立）。`js/cpu.js` GAIN_ORDER に13件。
- **ポーション費用の表示**（ユーザー選択）：`tools/build-cards.js` に紫のフラスコ記号 `drawPotion()` を追加。コスト円に `cost>0` なら数字、`cost===0` のポーションのみ（ブドウ園・変成）はフラスコのみ、コイン＋ポーションは数字＋下に小フラスコ、支配は「6＋×2」。`potion` を合成関数に渡すよう改修。
- `npm test` グリーン維持（整合性613）。全117枚を再生成し原寸＋montageで目視OK。既存104枚はgrainのみ変化のため `git checkout HEAD -- asset/cards/` で戻し、**差分は新規13枚の webp のみ**。
- **★コミット/デプロイ保留の理由**：作業ツリーに**ユーザーの未コミット作業（UI要望5件＋船乗り即プレイ実装）**が `engine.js/ui.js/css/server/seaside テスト/cpu.js` に混在。`cpu.js` は私のalchemy GAIN_ORDERと held-back の `sailor_play_gain` が同居するため、**alchemyだけの分離コミット不可**。ユーザーが「ゲーム中につきデプロイ保留」中なので、**ゲーム終了後に held-back＋alchemy をまとめてコミット→push（同時デプロイ）**するのが安全（client/server同時・sw.js VERSION更新も）。
- △要確認（合成前の判断）：変成=金の変成光／薬草商=女性が薬草調合／薬剤師=天秤の男。montage目視では妥当だが、入替えがあれば `asset/art` を差し替えて再ビルド。

### 海辺（Seaside 第二版）実ゲームロジック実装（2026-06-30・デプロイ済み）
- **27種すべてプレイ可能**に。新セット「**海辺セット（第二版）**」(`DOM.KINGDOM_SEASIDE` 固定10種)＋「**海辺から**」(ランダム `randomFrom:['seaside']`)を追加。`POOLS.seaside` は孤立プールから「参照される抽選母集団」に格上げ。
- **持続(Duration)機構**（`js/engine.js` のbackbone）：プレイヤーに `durationCards`(場に残る・公開) / `delayedEffects`(次手番開始時に解決する予約) / `setAside`(私的) / `islandMat`(公開・VP) / `nativeVillageMat`(秘密) を追加。`cleanupAndAdvance` で「予約が残る持続だけ捨てずに持ち越し→出し切ったら捨て札」に仕分け。`resolveDurationStartEffects` が手番開始時に予約を消化（非対話は即時、対話は `turn.startQueue`→`pending` 経由で `popStartQueue` 連結）。`DURATION_RESOLVERS[type]` に各カードの次手番効果を登録。`armDuration()` で予約を積む。
- **マット**：島＝自身＋手札1枚を `islandMat`(VP維持・デッキから外れる)、原住民の村＝山札の上を `nativeVillageMat` に貯める/手札に回収。`allCards()`（engine/cpu 双方）と `maskStateFor` を拡張（島マット公開・脇置き/原住民マットは伏せ・delayedEffectsの隠し札idも伏せ）。
- **追加ターン**：前哨地＝`cleanupAndAdvance` を条件分岐（`p.outpostExtra`なら同一プレイヤー続行・手札3枚・`isExtraTurn`で連鎖防止）。
- **アタック/フック/リアクション**：巾着切り・海の魔女を `ATTACKS` 表に登録（堀/秘密の小部屋/外交官で無効化可）。**灯台免疫**を全アタックの被害者選定に配線（`attackImmune`）。`gain()` に `triggerOnGain`（サル＝右隣の獲得で+カード／封鎖＝同名獲得で呪い）、`playTreasureCard()` に `corsairOnPlayTreasure`（私掠船＝相手の最初の銀/金を廃棄）を追加（再帰暴走ガード付き）。海賊・アストロラーベは財宝なので `playTreasureCard` で持続化。宝物庫はクリーンアップで「勝利点未獲得なら山札の上に戻す」を自動処理。密輸人は `lastTurnGains` を参照。
- **簡略化（faithful但し一部簡素）**：~~船乗りの「獲得した持続を即プレイ」~~（→**2026-06-30に実装済み・後述**）、封鎖の「呪い窓に堀で免疫」、海賊の「財宝獲得時リアクションで手札から出す」は省略（基本効果は実装）。これらは on-gain中の対話pendingが絡み複雑なため、安全側に倒した。
  - **★船乗りの即プレイを実装（2026-06-30・ローカル/未デプロイ）**：ユーザー報告「船乗りの効果が発動していない」を受け、カード2行目「このターン1度、獲得した持続カードを使える」を実装。`engine.js`＝船乗りプレイ時に `t.sailorPlays++`、`gain()`→`triggerOnGain(…, dest)` で**自分の手番に持続カードを獲得し pending が無いとき**だけ `pending:{type:'sailor_play_gain',card,dest}` を立てて1回分消費。新 reducer `SAILOR_PLAY_GAIN`（`play:true`で discard等から `inPlay` へ移して `applyEffect`→持続予約→cleanupで durationCards へ）。`PLAYER_ACTIONS` に `SAILOR_PLAY_GAIN` 追加。`cpu.js`＝`sailor_play_gain` は常に `play:true`。`ui.js`＝確認モーダル（使う/使わない）。**安全側の制限**：別の対話pending中に起きた獲得（工房等で持続を獲得）では出さない＝主に「購入」時に発動。テスト＝`seaside.test.js` に発動/辞退/非持続/1度きり/次手番持続発火、`seaside-ui.test.js` にモーダル描画を追加。**全テスト緑**。
- **CPU**：`chooseAction`/`decidePending` に全海辺カードの分岐を追加（新pending全てに応答＝デッドロック無し）。`GAIN_ORDER` を27種とも強さ順に並べ替え（孤立カタログ末尾→適正優先度）。CPU対CPUの海辺王国フル対戦が無限ループ無しで終局することをテスト。
- **UI**：`viewPendingModal` に全海辺pendingの分岐、盤面に⏳付き持続カードと島/原住民マットの表示、`css` に `.chip-card.duration`/`.mats`。
- **テスト**：`test/seaside.test.js`(69件・各カード挙動＋CPU対CPU)・`test/seaside-ui.test.js`(21件・全モーダル＋盤面描画) を追加し `npm test` に組込。**合計1436件グリーン**。puppeteer実ブラウザで海辺ソロ盤面を描画しカード画像・マット・持続表示を目視確認（scratchpad `seaside_board.png`）。
- **注意**：`sw.js` は変更不要（盤面ロード時に全104枚を実行時プリロード→SWがfetchキャッシュ。海辺webpは既にデプロイ済み）。`deploy.yml` も変更不要。

### ★要望対応 5件（2026-06-30・実装済み／★未コミット・未デプロイ）
> ユーザーが「現在ゲーム中なのでデプロイ中止」と明言。**ローカル実装のみ・push していない**。ゲーム終了後にコミット→デプロイ可。`npm test` **1436件グリーン維持**＋一時jsdomスクリプトで実描画16項目を確認後に削除。変更ファイル＝`js/ui.js` `css/style.css` `server/gameServer.js`。
1. **アクションカードをコスト順に**（`js/ui.js` 盤面サプライ）：王国カード列を `kingdomByCost = state.kingdom.slice().sort((a,b)=> cost差 || id順)` で**昇順**表示（同コストはid順で安定）。財宝/勝利点列は据え置き。表示順のみ＝ゲームロジック・通信に影響なし。
2. **獲得アニメのカード上の数字を削除**（`js/ui.js` `flyGainBig` ＋ `css/style.css`）：`gain-cost`（コインのコスト数字オーバーレイ）を要素ごと撤去＋CSSの `.gain-cost` ルールも削除。カード画像自体にコストは描かれているので冗長だった。名前キャプション(`gain-cap`)は維持。
3. **オンライン：ゲスト待機ロビーをホストと同項目に＋初心者モード切替**（`js/ui.js` `viewLobby` ＋ `css`）：ゲストには CPU人数/CPU強さ/王国セット/手番の順番を**読み取り専用**（`.lobby-readonly .readonly-val`）で表示し「ホストの開始を待っています…（変更はホストのみ）」を併記。**初心者モードのON/OFFトグル**（`.field`＋segmented・`setBeginner`）をホスト・ゲスト両方のロビーに追加（各自端末ローカル設定＝`localStorage['dominion-beginner']`）。
4. **名前が部屋を作り直してもリセットされない**（`js/ui.js`）：`localStorage['dominion-myname']` に記憶。`defaultName()` が記憶名を最優先で返し、create/join 画面の入力 `oninput` と `createRoom`/`joinRoom` 確定時に `saveMyName()` で保存。
5. **オンラインで手番順（上から順/ランダム）を選べる**（`server/gameServer.js` ＋ `js/ui.js`）：部屋に `randomOrder`（既定 true＝従来どおりランダム開始）を追加。`setConfig` で受理、`broadcastLobby`/`roomSnapshot`/`restoreRoom` に載せ全員へ配信。`startGame` の開始席＝**テスト注入(START_ACTIVE が整数)を最優先**、本番は `randomOrder ? 'random' : 0`（上から順＝席0=ホスト先手）。ホストのロビーに「手番の順番」segmented を追加。
   - **デプロイ注意**：client(Pages) と server(Render) を**同時にデプロイ**しないと手番順トグルが空振り（古いサーバは randomOrder を無視）。`sw.js` のVERSION更新も忘れず（client側UI変更あり）。

### 金トリム見栄え改善（2026-06-30・デプロイ済み）
- 基準カード(`asset/<id>.jpg`)同等の高級感へ。`tools/build-cards.js` を変更：**色地5種＋持続（victory/curse/action/attack/reaction/duration）のレール（縁取り・四隅・コイン環・帯枠）を「金（GOLD_RAMP）」に統一**（地色は種別色のまま・少し深めに調整）。**財宝の銅/銀/金だけは専用メタル維持**（金貨は金）。さらに**コイン中央を暗い地色のメダル（放射グラデ＋内ふち影）にして数字を白**（基準カードのメダル感）。
- ビルダーに `process.env.CARDS_OUT`（出力先切替・デプロイ前プレビュー用）を追加。`SKIN[skinOf(c)].base` を合成関数に渡してメダル色に使用。
- 全104枚を再生成して本番反映（`asset/cards/*.webp` 104枚 modified）。テストは画像内容に非依存なので影響なし。

---

## 0. 直近セッションの成果（2026-06-30）＝海辺（Seaside 第二版）27種を**カード画像化**（★未コミット）
- **目的**：既存77枚と同じ合成方式で海辺27種の完成形 `asset/cards/<id>.webp` を作る**だけ**。海辺の実ゲームロジック（持続機構・島/原住民マット・呪いサプライ等）は**やらない**（別タスク）。
- **やったこと（すべてローカル・未コミット）**：
  1. **絵を配置**：`images/`（チャッピー3バッチ＝19_17台10枚/19_21台10枚/19_24台7枚）を**1枚ずつ目視確認**し（コンタクトシートで主題照合）、確信度高で `asset/art/<id>.png` に27枚配置。対応は全枚プロンプト並び順どおり（灯台・サル・島・アストロラーベ・潮だまり・海の魔女など特徴的主題が一致）。
  2. **DOM.CARDS に27種追加**（`js/cards.js`）：ユーザー提供のWiki準拠テキストをそのまま採用（宝物庫＝「勝利点を“購入”していなければ」等）。idは native_village/haven/lighthouse/warehouse/smugglers/lookout/fishing_village/sea_chart/monkey/astrolabe/treasure_map/salvager/cutpurse/caravan/island/sailor/tide_pools/bazaar/treasury/outpost/tactician/merchant_ship/wharf/blockade/corsair/sea_witch/pirate。
  3. **★整合性テスト対策（重要）**：DOM.CARDS に足すと整合性テストが「全カードは GAIN_ORDER 網羅＋いずれかのプール所属」を要求して赤くなる。そこで **(a) `DOM.POOLS.seaside`＝どの CARD_SET / randomFrom からも参照しない「孤立プール」** を追加（抽選母集団に流入しない＝ゲーム挙動不変）、**(b) `cpu.js` の GAIN_ORDER に27件追加**（孤立ゆえ実サプライに出ず並び順はCPU挙動に無影響）。→ ゲームは一切変わらずテスト緑。
  4. **持続＝オレンジ枠（本家準拠・ユーザー選択）**：`carddata.js` の `frameType` に `duration` を**最優先**で追加（→16枚がオレンジ）。`typeLabel`/`typeLabelEn` に持続の複合（例「アクション・持続・アタック」「財宝・持続・リアクション」）を追加。`TYPE_ICON.duration='⏳'`。`build-cards.js` の `SKIN` に橙スキン `duration:{base:[176,88,18], ramp{sh[96,44,6]/mid[206,116,28]/hi[250,196,120]}}` を追加（skinOf は `c.type` を返すので自動で 'duration' を引く）。
  5. **build-cards.js を堅牢化**：master 金枠（`…20_21_29.png`）が `images/assets/` サブフォルダに移動していたため**再帰探索 `findMaster()`** に変更。モンタージュ出力先を旧セッション固有パス→`os.tmpdir()/dominion-cards-montage` に修正（mkdir付き）。
  6. **ビルド**：`node tools/build-cards.js` で**104枚合成**（fontsOk=true・duration recolor済み）。海辺27枚を原寸目視＝オレンジ枠・三重ラベルも帯に収まり良好。
  7. **検証**：`npm test`＝**1344件すべて緑/0失敗**（整合性 411→546・第二版＋プロモ 153→157＝堀の全アタック無効化ループが新アタック4種を巡回。未実装アタックは applyEffect の `default:break` で no-op→被害者不変で通過）。cards.html を puppeteer file:// で開き **broken=0・海辺27/27ロード成功**（総数208＝104×2は比較用の旧合成グリッド）。
  8. **差分をクリーン化**：ビルダーは全104枚を再生成するため既存77枚も grain だけ変わって「変更扱い」になる。見た目同一なので **`git checkout HEAD -- asset/cards/` で既存77枚を戻し、差分は新規27枚のみ** にした。
- **変更ファイル**：`js/cards.js` `js/cpu.js` `js/carddata.js` `tools/build-cards.js`（M）＋ `asset/cards/<海辺id>.webp` 27枚（新規・gitignore対象外で追跡される）。`images/`・`asset/art/` はローカルのみ（.gitignore）。
- **デプロイ（人間判断）**：`asset/cards/*.webp` は deploy.yml が glob でコピー済み＝**deploy.yml 変更不要**。海辺はオフライン precache 対象外（プレイ不能＝盤面に出ない）なので **sw.js も変更不要・VERSION 据え置きで正しい**。コミット→push で Pages 反映。
- **注意/次タスク候補**：海辺を**実際に遊べる**ようにするには別途エンジン実装（持続カードの「次のターン効果」機構・島/原住民マット・封鎖や海賊のリアクション・呪いサプライ等）＋ POOLS.seaside を CARD_SET に載せる、が必要。今回は未着手。
  - 保留：先に切り出した**「金トリム見栄え改善」**（基準カードは色地でも金トリム＋暗いコイン中央。色地5種を金トリム化＋コイン暗メダル化する案）は未着手のまま。やるなら別途。

---

## 1. ゴール
- カード表示を「**枠と文字はコード描画／“絵だけ”をAI生成してはめ込む**合成方式」にする。
- 最終的な見栄えは**基準カード `asset/<id>.jpg`（AI生成の絵画的な金枠カード）と同等**を目指す。
- ユーザー（あなた）は AIで画像を生成できる。Claude はコード（枠の仕組み・文字描画・はめ込み）を担当。

## 2. 完了したこと（今回のセッション）
- **カード枠の方式を「枠画像方式」に確定**（理由は §3）。
- **枠画像方式をコードに実装し、テスト緑（1205件）を維持**：
  - `js/cardview.js`：枠は**二段構え**。既定で `asset/frames/<type>.png` を読みに行き、
    - 読めれば**画像枠を表示し SVG枠を隠す**（`root` に `has-frameimg` クラス付与）、
    - 無ければ**SVG枠にフォールバック**（現状はこちら）。
    - `opts.frameSrc`（枠画像URL上書き）・`opts.noFrameImg`（常にSVG枠＝型紙確認用）を追加。
    - **コスト数字を SVG内描画 → HTMLオーバーレイ `.dcard-cost` に移設**（画像枠の上にも同じコイン位置に数字が載るようにするため）。彫り込み風 text-shadow。
    - 中央の窓に `asset/art/<id>.png` をはめ込み、`onerror`で 絵→絵文字→名前 の段階フォールバック（既存挙動維持）。
  - `css/cards.css`：`.dcard-frameimg`（z1, object-fit:fill）＋ `.dcard.has-frameimg` で SVG枠を隠す。`.dcard-cost`（コイン中心 15%/9.9% に配置）。複合種別ラベルの1pxはみ出し（堀「アクション・リアクション」）を `4.1cqw`/字間0 で解消。
  - **型紙画像6種を `docs/frame-templates/<type>.png` に配置**（透明窓・文字なし。現行SVG枠由来）。位置合わせ／img2imgのベース用。
  - puppeteer 実描画で (a) SVGフォールバック（HTMLコスト数字がコイン面に正しく載る）、(b) 画像枠モード（透明窓PNGを `frameSrc` で流し込み→画像枠表示・SVG非表示・窓越し表示・文字オーバーレイが一度だけ整列）を確認済み。
- 影響範囲：**プレビュー `cards.html` 専用パス**。ゲーム盤面 `js/ui.js` は別系統で**未変更**。
- **生成ガイド2点を作成（旧 §4-1/§4-2 完了。docs追加のみ＝コード未変更）**：
  - `docs/frame-art-guide.md`：枠6色の生成ガイド。型紙SVG(`cardview.js`)の実座標(1000×1515)から各領域の**ピクセル位置**を割り出して明記
    （透明窓＝中央 (126,378)–(874,1126) の748×748／コスト章中心(150,150)／名前帯270–930,44–244／種別帯228–772,y≈322／羊皮紙70–930,1168–1446／四隅ロゼット）。
    種別6色（CSS `--frame*` 由来）の色表・共通プロンプト＋ネガティブ・**型紙を img2img ベースにする推奨フロー**・保存前チェックリストを収録。出力先 `asset/frames/<type>.png`。
  - `docs/art-manifest.md`：全**77種**の id/名前/$/種別/効果/おすすめ主題（英プロンプト＋和訳）を**枠種別ごと**に表で収録。正本 `DOM.CARDS` を node で全件書き出して生成し**網羅漏れ無し**（主題のみ人手）。共通画風＋ネガティブ・絵の仕様（絵だけ・正方形1:1・768px・PNG・`asset/art/<id>.png`）を冒頭に明記。
- **実アセットで完成形カードを検証（鍛冶屋・2026-06-29）**：ユーザーがチャッピー(ChatGPT)で生成した「絵」と「枠下地」を `images/` に配置。
  - 絵（油彩調の鍛冶屋・1254²）は**狙い通りの質感で採用OK**。`asset/art/smithy.png` に設置済み。
  - 枠下地は**1枚の master**（金はそのまま／色替え部＝ベタ緑 `#00C24A`／中央窓＝ベタ・マゼンタ `#FF00FF`／羊皮紙はクリーム維持・1024×1536）。
    これをコードで **緑→種別の宝石色(`--frame-d`)×陰影／マゼンタ→透明にくり抜き** して**6種別ぶんを自動生成**（recolor成功）。色はコード側の数値で後から可変。
    → 生成済み6枚は **`images/frames_recolored/<type>.png`** に退避（後述の理由で asset/frames へはまだ置かない）。
  - puppeteerで **本物の金枠＋本物の絵＋コード文字** のカード1枚を実描画し、コスト/名前/種別帯/絵/効果が所定の金プレートに整列することを確認（スクショ `c:\tmp\sample_smithy_full.png`）。
  - **新枠(1024×1536)用に実測したオーバーレイ座標**（cards.html 本組み込み時にこのまま使える。`.dcard.has-frameimg` にスコープ）：
    - card: `aspect-ratio:1024/1536`
    - cost: `left9.04% top6.0% w20% h13%`（数字 `font-size:10.5cqw`）
    - title(名前): `left32.81% w53.13% top7.03% h6.77%`（`font-size:10cqw`）
    - plaque(種別帯): `left33.2% w41.8% top19.01%`（単一 `3.5cqw`／複合 `3.3cqw`）
    - art(窓): `left14.94% top25.59% w70.02% h46.35%`
    - panel(羊皮紙): `left11.91% w75.98% top76.69% h15.89%`
- **新・シンプル枠＋絵10枚で完成形カードを一括試作（2026-06-29）**：ユーザーが `images/` に
  「新しいシンプル/横長 master 枠」(`ChatGPT Image …20_21_29.png`・**1024×1536**) と絵10枚を配置。
  これらを**puppeteerでcanvas合成**し、完成形カード10枚を **`images/assets/<id>.png`** に出力（基本カード一式：
  銅貨/銀貨/金貨/屋敷/公領/属州/呪い/地下貯蔵庫/村/市場）。**目視OK**（金枠・絵の額装・文字整列・recolor良好）。
  - master枠の実測領域(1024×1536)：コスト円 中心≈(126,126) r≈82／名前帯 x224–976,y60–188／
    種別帯 x188–852,y228–268／窓 x64–958,y308–1092／クリーム羊皮紙 x62–965,y1140–1473。
  - **recolor（緑#00C24A→種別色）パラメータ**：base色 `treasure[124,90,20] / victory[28,94,49] /
    curse[72,38,112] / action[35,77,134]`、係数 `f=clamp(g/176,0.6,1.3)`、ヴィネット
    `v=1−0.30*(中心距離/maxD)^1.4`、グレイン `±4`。窓マゼンタ→透明、近黒(<32)→透明。
  - **マゼンタ判定を拡張してピンクの縁残りを除去**：`isMag = (r>170&&b>170&&g<130) ||
    (r>120&&b>120 && r>g+28 && b>g+28)`（窓フチのアンチエイリアス淡ピンクを拾う／金・クリームは誤爆しない）。
  - 合成の文字オーバーレイ座標（canvas px・1024×1536）：窓 `WR={x:54,y:298,w:914,h:804}`(cover)、
    コスト `bold 88px (126,132)` 縁取り、名前 `fit→(600,126)`、種別 `fit→(520,250)`、
    効果パネル `{x:62,y:1140,w:903,h:333}` 44px→22pxまで自動縮小・日本語1文字単位で折返し・中央寄せ。
  - **注意**：これは試作用に1枚スクリプトへカードデータをハードコードした評価出力。**cards.html 本組み込みとは別物**
    （§4-3 は引き続き未着手）。出力先も `images/assets/`（本番の `asset/art|frames` ではない）。**全て未コミット**。
- **銅貨・銀貨を基準カード(`asset/*.jpg`)寄りに作り直し（2026-06-29）**：ユーザー指摘＝「絵に対しカードがへぼい／フォントがダサい／枠に模様／銅貨・銀貨は専用の銅色・銀色フレームに」＋「模様・フォントは `asset/` の基準画像みたいに、特にコストのフォントとサイズ感が大事」。対応：
  - **フォントを基準準拠に変更**：コスト数字＝**白セリフ大（Georgia bold 140px・濃縁取り）でコイン面を充填**（旧・彫り込み風Cinzel/金グラデを廃止）。名前＝**白＋濃縁取り＋字間**の明朝（Shippori Mincho 800、puppeteerでGoogle Fonts読込 fontsOk=true）。種別＝二言語「財宝 / Treasure」白。効果＝**左寄せ濃色**。
  - **枠の模様**：地（緑→金属）に**オーガニックな値ノイズ(fbm 3oct)のまだら**（`p=1+0.13*(fbm(x/34,y/34)−0.45)` ≈±6%）＋ヴィネット。革/ブラシド金属風。旧・幾何ダマスク（キルト状で不評）は廃止。
  - **専用フレームカラー**：地(green→)`copper[120,72,42] / silver[106,112,122]`。
  - **金レールも金属色へ置換（重要・新規）**：基準は枠の縁取り・四隅・窓枠・コイン環まで全部その金属色＝金色を使わない。master枠は金レールを残していたので、**金画素を検出して陰影を保ったまま色相だけ金属ランプへ写像**。
    - 判定：`isGold = r>120 && b<170 && (r-b)>60 && (g-b)>45 && r>=g-25`（緑は r小で除外／クリームは r-b<60 で除外／**明るい黄ハイライトも b<170 で拾い銀の黄点残りを解消**）。
    - 金属ランプ（陰影保持・sh/mid/hi 3点補間、`t=clamp((L−95)/120,0,1)`、`L=0.299r+0.587g+0.114b`）：
      `copper{ sh[58,30,16] mid[152,86,46] hi[240,188,142] }` / `silver{ sh[60,63,70] mid[150,154,160] hi[240,242,246] }`。
  - master枠の実ピクセル（採取済み）：金=暗(147,103,2)〜明(254,225,57)／緑地≈(3,174,52)／クリーム≈(252,241,221)／暗部<32→透明。
  - puppeteer合成で **`images/assets/copper.png` / `silver.png`** を再出力し**目視で基準カードと同系統を確認**（枠まで銅/銀で統一・コスト数字の書体/サイズ感一致・銀の黄点なし）。**未コミット**。
  - **次**：この方向でユーザー承認が出たら残り8枚（金貨/屋敷/公領/属州/呪い/地下貯蔵庫/村/市場）へ同方式を適用（金貨=金ランプ維持、勝利=緑、呪い=紫、アクション=青で地＋レール）。
- **全77カードの「絵」を受領＆抜け漏れ確認＆ステージング（2026-06-29）**：ユーザーが `images/` にカード絵を**全投入**（タイムスタンプ名77枚＋master枠`…20_21_29.png`1枚＝計78枚）。絵は**1448×1086（横長4:3）油彩調**で統一。
  - **抜け漏れ確認＝完了（網羅・重複なし）**：(1) MD5で全77枚**ユニーク**（同一画像の二重登録ゼロ）。(2) コンタクトシート2枚（scratchpad `contact_0/1.jpg`・採番付）で全77枚を主題識別。(3) コード正本 `js/cards.js` の実カードid**77個**（`basic/intrigue/interaction/random` の4セット分類idは除外）と、識別したidが**全単射**であることを機械照合（`not-in-code`/`code-id-missing-image` ともゼロ）。
  - **ステージング配置（フレーム合成はまだ＝ユーザー指示）**：各絵を `asset/art/<id>.png` に配置（76枚コピー）。**`smithy` は前セッション承認済みの `asset/art/smithy.png` を保護＝上書きせず**（19:16のまま）。結果 `asset/art` に**全77id分が完備**。→ cards.html プレビューが窓に実絵を表示するようになる（枠は asset/frames 空のため現状SVGフォールバックのまま）。ゲーム盤面 `js/ui.js`（asset/thumb系統）は無関係・未変更。
  - **対応表 `docs/art-source-map.md` を新規生成**：idx/id/元ファイル名の77行。`要確認`●列＝似た主題（肖像 duke↔baron、フード姿 spy/thief/lurker/saboteur/minion/replace、献上系 tribute/vassal/courtier）で合成前に1枚目視推奨の候補。順番識別の確信度メモ。
  - 注意：絵は横長1448×1086、新masterの窓も横長(914×804)なので cover で問題なし（旧SVG枠の窓は正方748²のため左右トリミングされるが現状プレビュー用途では許容）。**全て未コミット**。
- **全77カードの完成形を一括生成＝完了（2026-06-29・ユーザー承認「枠も絵もこれで行きましょう」）**：銅貨・銀貨で確立した build4 方式（金属枠＋油彩の絵＋コード文字）を全77枚へ適用し、**`asset/cards/<id>.png` に77枚出力**。目視OK（レビュー用モンタージュ scratchpad `cards_0/1.jpg`）。
  - **方式**：masterフレーム1枚（`images/…20_21_29.png`・1024×1536）を**種別8スキンにrecolorしてキャッシュ→各カードで 枠＋絵(`asset/art`)＋文字 をcanvas合成**。recolor＝緑#00C24A→種別の地色`base`×輝度f×ヴィネット×fbmまだら、金レール→種別メタル3点ランプ`ramp`(sh/mid/hi)、マゼンタ→透明、近黒<32→透明、クリーム羊皮紙=保持。判定式は build4 と同一（`isGold`/`isGreen`/`isMag`）。
  - **8スキンの色**（`base` / `ramp{sh,mid,hi}`）：copper・silver・gold は専用メタル（金貨は金ランプ維持）、victory/curse/action/attack/reaction は CSS正本 `--frame`(`#1c5e31/#482670/#234d86/#7e2422/#15605b`)系のメタルランプ。財宝の汎用(harem/hoard)は金スキン。スキン判定＝`id==copper/silver/gold ? その金属 : type==treasure ? gold : type`。
  - **文字座標（master 1024×1536・build4実測）**：コスト`bold 140px Georgia`を(126,116)中央・白＋濃縁取り／名前`Shippori Mincho 800`を(600,124)中央・**幅700pxで84→30pxへ自動縮小**＋字間0.12em／種別「日本語 / English」を(520,250)・600pxで36→16px縮小／効果＝羊皮紙`{x62,y1140,w903,h333}`に左寄せ・46→16pxで全行が収まるよう自動縮小＋日本語1文字単位で折返し＋縦中央、濃色`#34250c`。Shippori MinchoはGoogle Fontsから読込（fontsOk=true）。
  - **ビルダーをリポジトリに永続化**：生成スクリプトは **`tools/build-cards.js`**（コミット済み・デプロイ対象外）。色やテキストを変えたいときはこれを編集し、**プロジェクト直下で `node tools/build-cards.js`** を実行すれば全77枚を再生成できる（puppeteerはプロジェクト内なので裸import解決OK）。入力 `images/`・`asset/art/` は .gitignore でローカルのみ＝この端末でのみ再生成可能。
  - **見栄え調整（ユーザーFB反映・2026-06-30）**：(1) コスト数字を **Georgia→Cinzel** に変更（Georgiaは2が小・6/8が上に飛ぶ「オールドスタイル数字」が原因。Cinzelは均一なライニング数字）＋`actualBoundingBox`で実インクをコイン中心(126,126)に縦中央そろえ・150px。(2) **名前を拡大**（開始84→96px・幅上限700→720・最小30→34）。(3) **効果を拡大**（開始46→58px・行高1.42→1.34）。(4) **地のまだら模様を強調**（緑→地のfbmを 細目`x/26`＋広いムラ`x/120,y/96` の二層に。最終は係数 fine`0.40`/broad`0.24`・粒子±6 まで濃く＝ユーザー「もっと濃く」反映）。
  - **配信用WebP化＋本番デプロイ（2026-06-30）**：出力を `asset/cards/<id>.png`(3MB×77=233MBで重すぎ)→ **768×1152のWebP `asset/cards/<id>.webp`（平均147KB・計11MB）** に変更。cards.htmlも `.webp` 参照に。`.gitignore` で重い原本（`images/`・`asset/art/`・`asset/cards/*.png`）を除外し webp のみ追跡。`deploy.yml` に `asset/cards/*.webp` のコピーを追加＆削除済み `data/cards.json` のコピー行を除去、`sw.js` を v12 へ。**commit `b2de937` を push 済み**→ Pages デプロイ成功、`cards.html`・各webp が HTTP200 で配信中。**ビルダー（scratchpad `build-cards.js`）はWebP出力版に更新済み**。
  - **cards.html プレビューに組み込み済み（ユーザー選択「cards.htmlプレビューのみ」）**：[cards.html](cards.html) を**完成画像 `asset/cards/<id>.png` 直表示**に変更（`makeCard()`＝`<img class="dcard-full">`、`onerror`で従来 `DOM.cardView` 合成にフォールバック）。旧 `demoart` チェックを廃し**「旧・コード合成方式で表示（比較用）」トグル**を追加。`.dcard-full`は`drop-shadow`で角透過に追従。puppeteer file:// 検証で全154ノード（77×2グリッド）loaded=154/broken=0/fallback=0。`npm test` **1205緑/0失敗**を維持。cardview.js/ui.js（盤面）は**未変更**。
  - **盤面 `js/ui.js` も新カードへ統一（2026-06-30・ユーザーFB「ゲームのカードが更新されてない／新カードが真っ白」を受けて拡張）**：ゲームは元々 CSS で `.has-art` の画像が読めたら文字オーバーレイを隠す設計（`asset/thumb/<id>.jpg` を1枚表示）。新カードは thumb 無し→真っ白だった。**盤面art・公開バッジ・公開一覧・拡大表示(×2)・先読み・獲得アニメの画像参照を `asset/cards/<id>.webp` に統一**（旧 `asset/thumb/*.jpg`・`asset/<id>.jpg` 参照は撤去）。`sw.js` のプリキャッシュも webp に・v13へ。puppeteerでソロ対戦を起動し card-art 19枚 loaded=19/broken=0（src=`cards/*.webp`）を確認、`npm test` 1205緑。→ デプロイ済み（後述）。
- **初心者モードを追加（2026-06-30・ユーザー要望）**：☰メニューに「🔰 初心者モード：オン/オフ」トグル（プレイ中に切替・`localStorage['dominion-beginner']`に記憶・既定ON）。ON時の4フォロー＝(1)**今やること案内**：ヘッダーに常時表示の `.coach-bar`（`coachHint()`がフェーズ別に「アクション/購入で次に何をするか」を案内）、(2)**操作ミス警告**：既存の確認（アクション残し/財宝出し忘れ/買い忘れ）＋案内文で補強、(3)**おすすめ買い物**：`recommendedBuys()`（買える中から 属州>金貨>銀貨）を購入フェーズに黄色枠＋「おすすめ」リボンでハイライト＋案内文に明記、(4)**カードのやさしい説明**：詳細シートに `.beginner-tip`（`TIPS`の登録＋未登録は種別から自動補完で全カード対応）。実装は `js/ui.js`＋`css/style.css`（`.coach-bar`/`.pile.recommended`+`.rec-badge`/`.beginner-tip`）。追加のみ＝既存挙動不変。`npm test` 1205緑、puppeteerで4機能の表示を確認。

## 3. 決定事項とその理由
- **枠は SVG ではなく「画像」にする（枠画像方式）**。
  - 理由：コードで描く SVG/CSS の金は、基準カードの**絵画的に塗られた金**に**構造的に届かない**（ベクター vs ラスターの本質差）。多エージェントのバトルオフ（4案を並列生成・実描画・3観点審査）でも最良案で金の質感70点、本物への統合でも平板寄り。SVG枠は計5回差し戻された。
  - 方式：**ユーザーが種別ごとに枠画像6枚をAI生成（中央の窓は透明・文字/数字なし）→ Claude が文字（コード描画）＋絵をはめ込む。** 生成は枠6枚＋各カードの絵だけで済み、文字はコード描画のまま（鮮明・差し替え可）。
- **型紙＝SVG枠の viewBox(1000×1515) の配置**。画像枠はこの配置に合わせて作れば、SVG枠でも画像枠でも**文字位置が共通**で一致する。
- 種別キーは6つ：`treasure / victory / curse / action / attack / reaction`（`card.type` から導出。attack/reaction優先）。
- 表示データの正本は `js/cards.js` の `DOM.CARDS`。`js/carddata.js` がそこから導出（id/名前/コスト/種別/`typeLabel`/`typeLabelEn`/`artSquare` 等）。

## 4. 未完了タスク（優先順／次セッションはここから）
1. ~~`docs/frame-art-guide.md` を書く~~ → **完了**（§2参照）。
2. ~~`docs/art-manifest.md` を出力~~ → **完了**（§2参照。全77種・網羅漏れなし）。
3. **新枠を cards.html 本組み込み（次セッションの主タスク）**：上の実測座標を `css/cards.css` に `.dcard.has-frameimg` スコープで焼き込み、`images/frames_recolored/*.png` を `asset/frames/` へ戻す。
   - **その前に潰す2点（検証済みの崩れ）**：
     (a) **長い名前のはみ出し**：新・名前帯は旧より狭く、6文字名「城壁のある村」が溢れる → 名前の**自動縮小**（文字数/幅に応じた縮小。`DOM.fitCardEffects` 的な実測フィット or `cqw`段階）を入れる。
     (b) **長い効果文の見切れ**：新・羊皮紙が旧より狭く、長い1行効果が右で切れる → 効果の自動縮小/改行許容を調整。
   - 色を変えたいときは recolor の `TARGET[type]`（`--frame-d` 由来）を変えて6枚を再生成（master は緑+マゼンタの1枚を使い回す）。
4. ~~**絵の量産**~~ → **完了**（全77枚を受領・抜け漏れ無し・`asset/art/<id>.png` へステージング済み。§2参照／対応表 `docs/art-source-map.md`）。次は §4-3 の枠本組み込みと、絵×枠の合成（ユーザーGOで着手）。合成前に `要確認`● の数枚だけ id 割当を目視確認すると安全。
5. （任意・人間判断）本番反映するか。ゲーム盤面 `js/ui.js`（別系統 `asset/thumb`＋文字）も新方式に統合するか。

## 5. 詰まり・注意点・保留中の判断
- **型紙PNG（docs/frame-templates）は現行SVG枠由来＝そのまま本番枠にはしない**（同じ見た目のラスター版なだけ）。あくまで配置合わせ／img2imgベース。
- いまは `asset/frames/` 空 → **SVG枠フォールバックが本番表示**。`asset/art/` 空 → 絵文字フォールバック表示（どちらも正しい現状）。
- **すべて未コミット**。反映（main運用＝GitHub Pages/Render）は人間判断で。デプロイ手順は `docs/handover.md` 参照。
- puppeteer 検証スクリプトはプロジェクト直下に `_*.tmp.js` で作り、`await import('puppeteer')`（裸指定）で実行→**実行後に必ず削除**（リポジトリ直下を汚さない）。スクショは scratchpad へ。
- 保留中の人間判断：(a) 枠画像が用意できたら本番反映するか、(b) ゲーム盤面 `js/ui.js`（別系統 `asset/thumb`＋文字）も新方式に統合するか。
