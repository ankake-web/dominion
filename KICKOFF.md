<!-- /handoff が自動生成（2026-07-11）。新セッションはこのファイルの指示に従う。手編集不要 -->

ウルトラコード（最大エフォート）で進めてください。

スマホ向けドミニオン対戦Webアプリ（CPU戦・2〜4人ローカル・オンライン対戦）の実装を引き継ぎます。回答/UIは日本語。
作業ディレクトリ: c:\Users\b1242\claude\game\dominion / branch: main（main直接作業運用。最新は git log で確認）。

## まずやること
1. `Set-Location 'C:\Users\b1242\claude\game\dominion'` して `npm test` → **34スイート・オールグリーン（exit 0・整合性3147件・不変条件5・帝国269件＋UI54件・ランドマーク80件・冒険59＋UI40・暗黒時代87＋UI57・新プロモ165＋UI22・繁栄69・異郷83＋UI44・収穫祭107・ギルド81＋UI25・CPU序列 強vs弱100/強vs普通64/普通vs弱95）**を確認。
2. `PROGRESS.md` の先頭サマリ＋**§0-19（帝国ランドマーク21種 engine 実装・完了・未push）**と §5・§6 を読む。横型の設計正本＝`docs/research/landscape_cards.md`／`docs/research/landscape_gaps.md`。全体設計図＝`docs/adding-cards.md`。

## 現状：帝国ランドマーク21種の engine 実装まで完了（未push・sw.js v45）
- 新セット **`empires-landmarks`**（帝国固定10王国＋ランドマーク2枚抽選）で実プレイ可能。得点計算専用11種＋トリガー8種＋新pending2種（闘技場 arena／峠 mountain_pass＝逐次入札）＝4点セット完備。CARD_SET昇格・ui盤面帯・server/ローカル配線・敵対レビュー6件修正（回帰テスト付き）まで全部済み。詳細は PROGRESS §0-19。
- **横型カードは `DOM.CARDS` に無い**（`DOM.LANDSCAPES` が正本）＝整合性テストに混ざらない。VPは3系統（`state.landmarkVP`=ランドマーク上の有限リザーブ／`state.pileVP`=山の上／`state.landmarkStash`=一時置き）。得点は負になり得る＝下限クランプ禁止。
- **未pushコミットの有無は `git log origin/main..main` で確認**（§0-19 は未commit/未pushの可能性が高い＝作業ツリーに変更あり。まず `git status` を見る）。

## 次に取り組むタスク（優先順1位）：ランドマークの webp 回収 → push
1. **絵の回収**：ユーザーがチャッピーでランドマーク21枚を生成中（前セッションで3バッチの指示文を出した）。`C:\Users\b1242\Downloads` を見て新しいランドマークの絵が来ていたら、記憶 `chatgpt-card-art-workflow` の手順＋内容判別で `asset/art/<id>.png`（21種：aqueduct/arena/bandit_fort/basilica/baths/battlefield/colonnade/defiled_shrine/fountain/keep/labyrinth/mountain_pass/museum/obelisk/orchard/palace/tomb/tower/triumphal_arch/wall/wolf_den）に回収 → **`node tools/build-landscape.js`（横型・縦型 build-cards.js とは別スクリプト。`CARDS_ONLY=<id,...>` で対象を絞れる）** で webp 生成（このPCのみ可）。※現時点で Downloads にあるのは 7/5 の旧・帝国縦カードバッチのみ＝ランドマークの絵はまだ未着。来ていなければユーザーに催促してよい。
2. **一覧/盤面の画像表示**（任意・絵があれば）：`carddata.js`/`cards.html`/`ui.js` は `DOM.CARDS` を見るので、横型は `DOM.LANDSCAPES` を見る別経路が要る（今は盤面に名前＋説明文が出るだけ＝機能は完結）。webp を出すなら別経路を足す。
3. **push（ユーザー確認）**：**都度ユーザー確認の上で** `git push`。empires-landmarks が本番 Pages/Render に出る（サーバは `DOM.CARD_SETS`/`DOM.landmarksForSet` から自動で受理＝サーバ側変更不要）。`sw.js` は既に v45。

## その後（優先順2位以降）
- 帝国イベント13＋冒険イベント20（`BUY_EVENT`＋CPU購入AI＋負債経済連動＝ランドマークより重い。横型枠パイプラインは §0-18 で対応済み）。→ その先は夜想曲以降（画像・カタログとも未着手）。

## 守るべき進め方・流儀
- **新pendingは必ず4点セット**（engine reducer＋PLAYER_ACTIONS登録＋CPU decidePending＋UI viewPendingModal）＋終端保証。無いとCPU無限ループ／人間が詰む。
- **「≤$N/ちょうど$N/相手に獲得させる」系を触るときは engine述語と CPU候補選び（bestGain 等）の両側に `!NON_SUPPLY.has(id)`・`!splitLocked(state,id)`・`costIsPlainCoin(id)` を入れる**（片側だけだと無限ループ）。
- **ランドマーク得点を足すなら `landmarkScoreForCards`(engine) に書けば CPU 終局読みも自動一致**（CPU は `DOM.engine.landmarkScoreForCards` を呼ぶ）。**購入フェイズ限定トリガーは `gainWasBuyPhase`（獲得時点のフェイズ）を使う**（ヴィラ等が phase を変えても正しい）。
- **1機構ごとに**：狙い撃ち一時テスト（プロジェクト直下 `_*.tmp.js`＝.gitignore・実行後必ず削除。cwd がずれるので実行前に Set-Location）→ `node test/invariants.test.js` 緑 → `npm test` 全34緑 → 恒久回帰は `test/landmarks.test.js` 等へ。大きな決定は PROGRESS.md に追記。
- **substantiveなタスクは Workflow で多エージェント＋敵対的検証**（各findingは node 再現で確定）。CONTEXT文字列にバックティックを入れない／レビュー用一時ファイルは名前を分ける。公式ルールが曖昧なら研究エージェントで裏取り（wiki.dominionstrategy.com は WebFetch 不可＝WebSearch と RGG公式PDF・ultraboardgames・fandom・wikiwiki.jp を使う）。
- client資産（js/css/webp等）を変えたら `sw.js` の VERSION を上げる（現在 v45）。回答は日本語・フランクに短く。**push は勝手にしない＝完成→全テスト緑→都度ユーザー確認の上で**。
- **セッションが重くなったら促さず自動で /handoff する**（記憶 auto-handoff）。**Read出力の汚染に注意**：実在しないコード/コメントが混入して見えることがある。断定前に Grep・`git show`・`Get-Content` で裏取り。

## 次セッションが知らないと事故る事項（ランドマーク固有）
- **§0-19 は未push・作業ツリーに変更あり**（js/engine.js・cpu.js・ui.js・cards.js・server/gameServer.js・sw.js・package.json・test/empires-ui.test.js・test/invariants.test.js＋新規 test/landmarks.test.js）。まだ commit していない可能性が高い＝`git status`/`git log` で確認してから動く。破壊しないこと。
- **敵対レビューで直した要注意点**：オベリスクは分割山（settlers⇔bustling_village／catapult⇔rocks）の両半分を数える／購入フェイズトリガー（公会堂/列柱/汚された神殿の呪い）はヴィラの phase 変更に負けないよう `gainWasBuyPhase` を使う／闘技場はヴィラ再入場で再武装（`arenaFired=false`）。
- **イベントはまだ 0 枚**（ランドマークだけ）。イベントを足すときは負債トークン中はカード/イベントとも購入不可・イベント購入は購入権1消費・返済は購入権消費なし（`docs/research/landscape_gaps.md`）。

## 直近で完了した大仕事（参考）
- **§0-19 帝国ランドマーク21種 engine 実装**（2026-07-11・未push・v45）＝得点11＋トリガー8＋闘技場/峠＋empires-landmarks 昇格＋敵対レビュー6件修正。全34スイート緑・verify:e2e 9/9。
- **§0-17 E8＝命令(Command)の忠実化**（push済・本番 v44 実機確認済み）。
