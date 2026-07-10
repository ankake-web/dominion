<!-- /handoff が自動生成（2026-07-10）。新セッションはこのファイルの指示に従う。手編集不要 -->

ウルトラコード（最大エフォート）で進めてください。

スマホ向けドミニオン対戦Webアプリ（CPU戦・2〜4人ローカル・オンライン対戦）の実装を引き継ぎます。回答/UIは日本語。
作業ディレクトリ: c:\Users\b1242\claude\game\dominion / branch: main（main直接作業運用。最新は git log で確認）。

## まずやること
1. `Set-Location 'C:\Users\b1242\claude\game\dominion'` して `npm test` → **33スイート・オールグリーン（exit 0・整合性3146件・帝国226件＋UI45件・冒険45件・暗黒時代79件・繁栄69件・新プロモ142件・CPU序列 100/64/95）**を確認。
2. `PROGRESS.md` の §0-16（帝国 E7＝CARD_SET昇格・push済）と §5・§6 を読む。**帝国の設計正本＝`docs/research/empires_rules.md`**、全体設計図＝`docs/adding-cards.md`。

## 現状：帝国は本番稼働中。縦型カードの実プレイ化は全拡張ぶん完了
- `15b605e` を push 済＝**本番（Pages v43＋Render）に「帝国セット」「帝国から」が出ている**。実機確認済み（Pages が v43 を配信・`castles.webp` 200／WSで `kingdomSet=empires` を受理し 城8枚・分割山下段・負債・山上VP・相手手札マスク 正常）。
- E7 では出荷済みの実バグも直した：**大君主/船長/はみだし者/王子が負債カードを対象にできた**（公式のコスト比較＝成分ごと）／**拡張の固定セット8つ（海辺〜冒険）が UI の picker から選べなかった**（6/14の分類UI刷新以降）／**「ランダム」分類のボタンが 320px で画面外**／**CPUが混合山の静的コストで判定**／**castles.webp が無く404**。
- 未pushコミットは無い（作業ツリーはクリーン）。

## 次に取り組むタスク（優先順1位）：E8＝命令(Command)の「自身が動く」clause
公式2022では命令カードは**そのカードの名前/種別/コストを得て、自己移動するときは命令カード自身が動く**。現実装は旧2016版の "leaving it there"＝no-op。
- 対象4枚：**overlord（帝国）／band_of_misfits（暗黒時代）／captain（新プロモ）／prince（新プロモ）**。
- 公式挙動：大君主×陣地＝**大君主が脇に置かれ、片付けで大君主の山へ戻る**／大君主×農家の市場(山上4VP)＝**大君主自身を廃棄**／船長×鉱山の村＝**船長を廃棄して+$2**／王子×島＝**王子が島マットへ**（以後 再演されない）。
- **これを直すと `random-empires` の「大君主→農家の市場で永久にVPを得る」exploit が消える**（現状は固定セットで同居させないことで回避＝§0-16）。
- 実装の勘所：`state.turn` に「いま何として使っているか」の物理カードidスタックを持ち、自己移動サイト（`removeOne(p.inPlay, X)`）を `commandSelf()` 経由にする。**pending 経由の自己移動（`encampment_reveal` / `death_cart`）は pending に phys を載せる**必要がある。`fromCommand` フラグは廃止して統一できる。
- 公式では **大君主は持続カードもプレイできる**（場に残る）＝現実装は除外。E8 で一緒に検討してよい。
- 影響範囲に暗黒時代・新プロモの出荷セットが含まれるので、`darkages.test.js` / `promo2.test.js` の回帰を必ず確認すること。

## 他の残タスク
- **横型ランドスケープ**（帝国のイベント13＋ランドマーク20／冒険のイベント20）＝縦枠パイプライン未対応で段階1すら未着手。別途 横長枠の生成パイプラインが要る。
- 発売順その先（画像もカタログも無し）：夜想曲/ルネサンス/移動動物園/同盟/略奪/日の出づる国。
- （優先度低）CPU購入AI：帝国/暗黒時代/冒険/異郷は `evaluateKingdom` が MONEY 既定＝CPUは純ビッグマネー。

## 守るべき進め方・流儀
- **新pendingは必ず4点セット**（engine reducer＋PLAYER_ACTIONS登録＋CPU decidePending＋UI viewPendingModal）＋終端保証。無いとCPU無限ループ／人間が詰む。
- **「≤$N/ちょうど$N/相手に獲得させる」系の獲得・プレイを足す/触るときは、engine述語と CPU の候補選び（bestGain/bestGainExact/pickSwindlerGift/kingdomAffordable/bestPrinceTarget 等）の両側に `!NON_SUPPLY.has(id)`・`!splitLocked(state,id)`・`costIsPlainCoin(id)`（負債/ポーション費用を持たない）を入れる**（片側だけだと「engine拒否×CPU再提案＝無限ループ」＝この5年で6回踏んだ罠）。
- **CPUで山のコストを見るときは engine の `cardCost`（実コスト）を使う**。混合山（knights/castles）のプレースホルダは静的コストが実物とずれる（`cpu.js` の `mixedTop`）。
- **1枚実装/変更ごとに**：狙い撃ち一時テスト（プロジェクト直下 `_*.tmp.js`＝.gitignore済・実行後**必ず削除**。cwdがずれるので実行前に Set-Location）→ `node test/invariants.test.js` 緑 → `npm test` 全33緑 → コミット。恒久回帰は `test/empires.test.js` 等に置く。大きな決定は PROGRESS.md に追記。
- **substantiveなタスクは Workflow で多エージェント＋敵対的検証**（各findingは node 再現で確定させる）。CONTEXT文字列にバックティックを入れない（テンプレートリテラルが壊れる）。ソークのデッドロック検出は pending の完全JSONを比較。**レビューエージェントは同名 `_*.tmp.js` を作りうる**ので名前を分ける。公式ルールが曖昧なら研究エージェントで裏取り（wiki.dominionstrategy.com はボット保護で WebFetch 不可＝WebSearch と **RGG公式ルールブックPDF**・ultraboardgames・fandom を使う。RGG の PDF は本文を直接抽出できて最も信頼できる）。
- client資産（js/css/webp等）を変えたら `sw.js` の VERSION を上げる（現在 v43）。回答は日本語・フランクに短く。**push は勝手にしない＝完成→全テスト緑→都度ユーザー確認の上で**。
- **新しい CARD_SET を足したら UI の picker にも出す**（`kind:'standard'` は「拡張」タイル）。`test/ui.test.js` の「全 CARD_SETS がセット選択画面から選べる」が守る。**新しいプレースホルダ card を `DOM.CARDS` に足したら webp も生成する**（`CARDS_ONLY=<id> node tools/build-cards.js`・このPCのみ。`npm run verify:e2e` の webp 404 検査が守る）。

## 次セッションが知らないと事故る事項（必読）
- **公式のコスト比較は成分ごと**（コイン／負債／ポーション）。`$0+負債4` は "up to $5" では**ない**。engine の `costIsPlainCoin(id)` を「コストN以下」判定に必ず併用する。
- **「財宝を2回使う」は必ず `state.replay` の `'treasure_replay'` を使う**。`playTreasureCard` ＝移動＋`applyTreasureEffect`／`applyTreasureEffect` ＝**カードを動かさず効果だけ**。2回目を「コインだけ足す」で済ませると pending を立てる財宝や +購入/+VP の2回目が丸ごと消える。自己移動する財宝は `removeOne` ガードで包む（lose track）。
- **命令（Command）の再演は選び直さない**（公式）：`state.turn.commandAs[命令id]` に1回目の選択を記憶し、`runReplays` が立てる `state._replaying` を見て `replayCommandAs` が再利用する。**`_replaying` はゴーレムの2枚目では立てない**。船長は持続で「次のターンの開始時」が別のプレイ＝毎ターン選び直す（commandAs を使わない）。
- **混合山の正本＝gain の `isMixed`（ruins/knights/castles）＋ state.ruins/knights/castles**。**分割山の正本＝`DOM.SPLIT_PILES`（cards.js）**＝1行足せば gain/canBuyCard/emptyPileCount/CPU が自動対応。
- **gainer（remodel/工房等の `*_GAIN`）経由の獲得で on-gain 対話が要る効果は `state.onGainQueue` に積む**（finishGain の pending 中は `!pending` ゲートで抑止されるため＝E5の教訓）。
- **意図的な据え置き（再修正しなくてよい）**：workshop等の汎用「≤$N獲得」reducer は負債カードを除外していない（どの出荷セットでも同居せず到達不能）。玉座×大君主のネストで玉座の2回目が先に走り対象不在で空振りすることがある（`state.replay` が単一FIFO＝玉座×玉座の既存挙動と同型。保存則・非ループ確認済）。
- **reduce は state を clone して新stateを返す**（破壊的でない）＝テストは必ず `s = reduce(s, a)` と再代入。狙い撃ちで state を手組みするとき init tally は「手札/山札を上書きした後」に取る。
- **手番タイミングの罠**：cleanupAndAdvance が「自分の手番終了時に自分の次の手札を先引き(draw5)」してから次Pへ。持続の手番開始効果は手番が戻った時に発火。
- **CSS の `.seg` は後方定義**なので、セグメント系を上書きするクラスは `.seg.xxx` と特異度を上げないと効かない（E7で踏んだ）。`.seg { overflow:hidden }` は**はみ出し検査に映らないクリップ**を生むので、ボタンが画面外に隠れていないかは実ブラウザで getBoundingClientRect で測ること。
- **本番サーバの疎通確認**：WS は `wss://dominion-server-1hc9.onrender.com/ws`（**`/ws` パス必須・`Origin: https://ankake-web.github.io` 必須**）。`joined` の直後に**初期 lobby（basic）が飛んでくる**ので、`setConfig` の結果を見るときは1通目を無視すること。Render の反映は push から数分。
- **Read出力の汚染に注意**：実在しないコード/コメントが混入して見えることがある。断定前に Grep・`git show`・`Get-Content` で裏取り。
