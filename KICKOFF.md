<!-- /handoff が自動生成（2026-07-11）。新セッションはこのファイルの指示に従う。手編集不要 -->

ウルトラコード（最大エフォート）で進めてください。

スマホ向けドミニオン対戦Webアプリ（CPU戦・2〜4人ローカル・オンライン対戦）の実装を引き継ぎます。回答/UIは日本語。
作業ディレクトリ: c:\Users\b1242\claude\game\dominion / branch: main（main直接作業運用。最新は git log で確認）。

## まずやること
1. `Set-Location 'C:\Users\b1242\claude\game\dominion'` して `npm test` → **33スイート・オールグリーン（exit 0・整合性3146件・帝国269件＋UI45件・冒険59件＋UI40件・暗黒時代87件＋UI57件・新プロモ165件＋UI22件・繁栄69件・異郷83件＋UI44件・収穫祭107件・ギルド81件・CPU序列 強vs弱100/強vs普通64/普通vs弱95）**を確認。
2. `PROGRESS.md` の §0-18（横型ランドスケープ・着手中）と §5・§6 を読む。**横型の設計正本＝`docs/research/landscape_cards.md`（54枚の公式データ＋機構分類＋実装の重さティア）と `docs/research/landscape_gaps.md`（未確定事項の回答集＝Windfall/負債とイベント/枚数/Tomb/Mission/セットアップVP）**。全体設計図＝`docs/adding-cards.md`。

## 現状：横型ランドスケープの「土台」まで完了・engine は未着手
- **横型枠パイプライン `tools/build-landscape.js`（完成・コミット済）**：縦型 master 枠の金レール断面（23px）を採取して任意サイズの丸角矩形/円に同じレールを描く方式＝**枠のAI画像を新規生成せずに縦カードと同じ質感**が出る。イベント＝茶褐色＋コインメダル／ランドマーク＝深い青緑。負債六角トークン・2桁コスト・禁則処理・絵の窓1.14 対応。`LANDSCAPE_PREVIEW=1` でサンプル描画、`CARDS_ONLY`/`CARDS_OUT` は縦型と同じ。実データ（`DOM.LANDSCAPES`）で `keep`/`mountain_pass` の生成を確認済み。
- **カタログ `DOM.LANDSCAPES`（帝国ランドマーク21種）を `js/cards.js` に追加済**（`4ef4ca8`）。**`DOM.CARDS` には入れない**ので GAIN_ORDER網羅・POOL所属・3山終了・闇市場デッキ に一切混ざらない（整合性3146・invariants 不変を確認済み）。`DOM.LANDMARKS_EMPIRES`（21id）／`DOM.GATHERING_CARDS`（temple/farmers_market/wild_hunt）／`DOM.isLandscape` も追加済み。
- **未pushコミットあり**（E8 以降は push 済だが、`c10cf47`＝横型枠＋研究、`4ef4ca8`＝カタログ＋計画 は push 済か要確認＝`git log origin/main..main` で確認。§0-18 の内容は本番挙動を変えない＝カタログ追加だけなので急がない）。

## 次に取り組むタスク（優先順1位）：帝国ランドマーク21種の engine 実装
PROGRESS §0-18「次にやること」の 1〜6 の順。要点だけ：
1. **共通基盤**：`state.landmarks=[id...]`（公開・maskで残す）／`state.landmarkVP={id:個数}`（ランドマーク上の**有限リザーブ**・非カード＝保存則tally対象外）／`state.landmarkStash`（水道橋/汚された神殿が山から移したVPの一時置き）／`state.obeliskPile`。`createInitialState` で準備（`pickBane` と同型）。**山に置くVPは既存 `state.pileVP`（集合機構）を再利用**。
2. **得点専用11種**（museum/fountain/palace/bandit_fort/wall/wolf_den/orchard/triumphal_arch/keep/tower/obelisk）＝`scoreGame(state)` に横断採点ブロックを追加（`vpOf(p)` は state を持たないので署名を変えず scoreGame 側へ）。**得点が負になり得る＝下限クランプ禁止**。keep は全員のデッキを同時に見る。tower/obelisk は「カード→由来山」写像（分割山は両名・混合山は length）。CPU `vpOfPlayer` にも同じ加点。
3. **トリガー型10種**：tomb(trashCard 本体)／battlefield(triggerOnGain 勝利点)／labyrinth(そのターン2枚目の獲得)／baths(END_TURN 獲得0)／basilica(購入フェイズ獲得＋残コイン≥2)／colonnade(購入フェイズのアクション獲得＋場に同名)／aqueduct・defiled_shrine(pileVP→landmarkStash→vpTokens)／**arena(購入フェイズ開始の任意捨て＝新pending＝4点セット必須)**／**mountain_pass(逐次入札＝新pending＋CPU入札評価＋UI入札モーダル)**。
4. **セット選択**：`empires` にランドマーク2枚を付ける新セットか、UIトグルか（設計判断・未決）。新 CARD_SET を足したら UI picker にも出す（`test/ui.test.js` が守る）。
5. **テスト**：`test/landmarks.test.js` 新設＋invariants に「ランドマークVPは非カード」「得点が負」検証＋CPUソーク。
6. **絵**：ユーザーがチャッピーで21枚生成中（前セッションで3バッチの指示文を出した）。`C:\Users\b1242\Downloads` の画像を判別して `asset/art/<id>.png` に回収 → `node tools/build-landscape.js` で webp 生成 → `sw.js` VERSION を上げる。**絵が無くても暗い地の板で成立**するので engine を先に進めてよい。

## 守るべき進め方・流儀
- **新pendingは必ず4点セット**（engine reducer＋PLAYER_ACTIONS登録＋CPU decidePending＋UI viewPendingModal）＋終端保証。無いとCPU無限ループ／人間が詰む。arena/mountain_pass が該当。
- **「≤$N/ちょうど$N/相手に獲得させる」系を触るときは engine述語と CPU候補選び（bestGain 等）の両側に `!NON_SUPPLY.has(id)`・`!splitLocked(state,id)`・`costIsPlainCoin(id)` を入れる**（片側だけだと engine拒否×CPU再提案＝無限ループ＝過去6回踏んだ罠）。
- **1機構実装/変更ごとに**：狙い撃ち一時テスト（プロジェクト直下 `_*.tmp.js`＝.gitignore・実行後必ず削除。cwd がずれるので実行前に Set-Location）→ `node test/invariants.test.js` 緑 → `npm test` 全33緑 → コミット。恒久回帰は `test/landmarks.test.js` 等に。大きな決定は PROGRESS.md に追記。
- **substantiveなタスクは Workflow で多エージェント＋敵対的検証**（各findingは node 再現で確定）。CONTEXT文字列にバックティックを入れない。ソークのデッドロック検出は pending の完全JSONを比較。**レビューエージェントは同名 `_*.tmp.js` を作りうる**ので名前を分ける。公式ルールが曖昧なら研究エージェントで裏取り（wiki.dominionstrategy.com はボット保護で WebFetch 不可＝WebSearch と RGG公式ルールブックPDF・ultraboardgames・fandom・wikiwiki.jp を使う。RGG の PDF は本文抽出できて最も信頼）。
- client資産（js/css/webp等）を変えたら `sw.js` の VERSION を上げる（現在 v44）。回答は日本語・フランクに短く。**push は勝手にしない＝完成→全テスト緑→都度ユーザー確認の上で**。
- **セッションが重くなったら促さず自動で /handoff する**（ユーザー指示・記憶 auto-handoff）。

## 次セッションが知らないと事故る事項（横型ランドスケープ固有）
- **ランドマークは20ではなく21種**（依頼側の誤り）。和名2件は訂正済み＝**basilica＝公会堂**（「バシリカ」は読み仮名）／**keep＝砦**（「天守」は誤り。`bandit_fort`＝山賊の砦 と別カード）。
- **横型は1対局に 0〜2枚**（Events と Landmarks の**合算**で最大2）。**王国山は常に10のまま**＝`emptyPileCount`／3山終了に影響させない。若き魔女のBaneにはできない。
- **負債トークンがある間はカードもイベントも購入できない**（RGG帝国ルールブック逐語）。イベントは購入権1消費・複数回可・返済は購入権消費なし。※今回はランドマークだけなので直接は効かないが、将来イベントを足すとき必須。
- **ランドマークのVPトークンは供給から取る有限リザーブ**＝`state.landmarkVP`。`state.pileVP`（集合＝山の上・実質無制限）とは**別物**。水道橋/汚された神殿だけが両方使う（山＝pileVP、ランドマーク上＝landmarkStash）。VPが尽きたらそのランドマークでは以後得点できない。
- **2022エラッタで basilica/colonnade/defiled_shrine は「購入したとき」→「購入フェイズ中に獲得したとき」に変更**。カタログ文は現行採用済み。実装時は `docs/research/landscape_cards.md` §6-4 の現行文を正とする。
- **Tomb の +1VP は「廃棄した本人」**に入る（相手ターンの詐欺師でも・塩まきのサプライ廃棄でも・複数枚は1枚ごと）。→ `trashCard`(engine.js) 本体の `state.trash.push` 直後にフック（城塞が手札に戻る場合も廃棄自体は起きているので発火）。サプライ廃棄は所有者不在なので個別に「active に+1VP」。
- **横型カードは `DOM.CARDS` に無い**ので、`carddata.js` の buildDisplay／`cards.html` 一覧／`ui.js` 盤面表示は `DOM.LANDSCAPES` を見る別経路が要る。webp再生成は `tools/build-landscape.js`（縦型 `build-cards.js` とは別スクリプト）。
- **Read出力の汚染に注意**：実在しないコード/コメントが混入して見えることがある。断定前に Grep・`git show`・`Get-Content` で裏取り。

## 直近で完了した大仕事（参考）
- **E8＝命令(Command)の忠実化**（§0-17・push済 `52bba46`・本番 v44 実機確認済み）。「命令がプレイした札は動かない（2019エラッタ）」＝当初計画の2016旧ルールは廃止済みだった。`state._cmd`＋`playedByCommand`/`takeSelf`/`playAsCommand`／`DOM.engine.pendingSelf`（倒壊/死の荷車の後方互換フォールバック内包）。
