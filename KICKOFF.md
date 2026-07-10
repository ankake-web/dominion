<!-- /handoff が自動生成（2026-07-10）。新セッションはこのファイルの指示に従う。手編集不要 -->

ウルトラコード（最大エフォート）で進めてください。

スマホ向けドミニオン対戦Webアプリ（CPU戦・2〜4人ローカル・オンライン対戦）の実装を引き継ぎます。回答/UIは日本語。
作業ディレクトリ: c:\Users\b1242\claude\game\dominion / branch: main（main直接作業運用。最新は git log で確認）。

## まずやること
1. `Set-Location 'C:\Users\b1242\claude\game\dominion'` して `npm test` → **32スイート・オールグリーン（exit 0・整合性3144件・帝国197件・暗黒時代79件・繁栄69件・新プロモ142件・CPU序列 100/64/95）**を確認。
2. `PROGRESS.md` の §0-15（帝国 Batch E6 完了・次はE7）と §5・§6 を読む。**帝国の設計正本＝`docs/research/empires_rules.md`**、全体設計図＝`docs/adding-cards.md`。

## 現状：帝国（Empires）の縦型36枚は実装完了。残るは CARD_SET 昇格のみ
- **Batch E1〜E6 すべて完了**＝負債(Debt)／集合(山上VP)／分割山5組／城8(混合山)／命令(overlord・crown)／villa の新機構6系統＋全カード効果。`sw.js` v42。
- **帝国はまだ CARD_SET 未昇格＝帝国カードはサプライに出ない**（本番の王国は不変）。
- **未pushコミットが2件**（E6本体＋前回の handoff）。`git log --oneline origin/main..HEAD` で確認すること。
- E6 では出荷済み拡張の実バグ3件も直した（ティアラ/偽造通貨の「2回目のアタックが飛ぶ」＝繁栄/暗黒時代／はみだし者×行進の「再演で選び直せる」＝暗黒時代／CPU pickSwindlerGift の分割山ロック無限ループ）。**push すればこの3件は本番挙動に効く**。

## 次に取り組むタスク（優先順1位）：帝国 E7＝Phase E＝CARD_SET昇格
**ここで初めて本番に帝国が出る**。冒険の Phase E（§0-9）が最良のコピー元。
- `js/cards.js`：`DOM.KINGDOM_EMPIRES` 固定10種を選定（新機構を一通り味わえる showcase。公式の帝国専用10種は無いので自作）＋`DOM.CARD_SETS` に `empires` / `random-empires` の2行。
- **注意**：`POOLS.empires` には混合山プレースホルダ `castles` と分割山の上下段が入っている。`randomKingdom` は下段→上段に正規化済み・`createInitialState` が上下を相互補完する。城8種（humble_castle 等）は `POOLS.castles`＝混合山の中身で抽選対象外。
- `test/empires-ui.test.js` を新設（冒険/暗黒時代の UI スモークが雛形）＋`test/invariants.test.js` の「出荷セット」検証に `empires`/`random-empires` を追加＋CPUソーク（2〜4人・全難易度）。
- 横型ランドスケープ（イベント/ランドマーク）は縦枠パイプライン未対応で対象外。
- 完成→全テスト緑→**ユーザー確認の上で** push（E6 も同時に本番反映される）。

## 守るべき進め方・流儀
- **新pendingは必ず4点セット**（engine reducer＋PLAYER_ACTIONS登録＋CPU decidePending＋UI viewPendingModal）＋終端保証。無いとCPU無限ループ／人間が詰む。
- **「≤$N/ちょうど$N/相手に獲得させる」系の獲得を足す/触るときは、engine述語と CPU の候補選び（bestGain/bestGainExact/pickSwindlerGift 等）の両側に `!NON_SUPPLY.has(id)`・`!splitLocked(state,id)`・`!(C()[id].debt>0)` を入れる**（片側だけだと「engine拒否×CPU再提案＝無限ループ」＝この5年で6回踏んだ罠）。
- **1枚実装/変更ごとに**：狙い撃ち一時テスト（プロジェクト直下 `_*.tmp.js`＝.gitignore済・実行後**必ず削除**。cwdがずれるので実行前に Set-Location）→ `node test/invariants.test.js` 緑 → `npm test` 全32緑 → コミット。恒久回帰は `test/empires.test.js` 等に置く。大きな決定は PROGRESS.md に追記。
- **substantiveなタスクは Workflow で多エージェント＋敵対的検証**（各findingは node 再現で確定させる）。CONTEXT文字列にバックティックを入れない（テンプレートリテラルが壊れる）。ソークのデッドロック検出は pending の完全JSONを比較。**レビューエージェントは同名 `_*.tmp.js` を作りうる**。公式ルールが曖昧なら研究エージェントで裏取り（wiki.dominionstrategy.com はボット保護で WebFetch 不可＝WebSearch と ultraboardgames/fandom を使う）。
- client資産（js/css/webp等）を変えたら `sw.js` の VERSION を上げる（現在 v42）。回答は日本語・フランクに短く。**push は勝手にしない＝完成→全テスト緑→都度ユーザー確認の上で**。

## 次セッションが知らないと事故る事項（必読）
- **【E6で新設】「財宝を2回使う」は必ず `state.replay` の `'treasure_replay'` を使う**。`playTreasureCard` ＝移動＋`applyTreasureEffect`／`applyTreasureEffect` ＝**カードを動かさず効果だけ**。2回目を「コインだけ足す」で済ませると、pending を立てる財宝（御守り/水晶玉/金床/不正利得/豊穣の角）や +購入/+VP を持つ財宝（元手/大金/鹵獲品/収集/偽造通貨）の2回目が丸ごと消える＝旧 `treasureReplayCoins` の轍。**新しい財宝は `applyTreasureEffect` に書けば 冠/ティアラ/偽造通貨 の2回目が自動で正しくなる**。自己移動する財宝（投資/戦利品/法貨/私掠船の廃棄）は `removeOne` ガードで2回目に自然不発（lose track）＝**新規財宝で自己移動させるなら必ず `if (removeOne(...))` で包む**。
- **【E6で新設】命令（Command）の再演は選び直さない**（公式）：`state.turn.commandAs[命令id]` に1回目の選択を記憶し、`runReplays` が立てる `state._replaying` を見て `replayCommandAs` が再利用する。**`_replaying` はゴーレムの2枚目では立てない**（別カードの新しいプレイ）。新しい命令カードは `case` 先頭に `if (replayCommandAs(state, pi, '<id>')) break;`、選択の reducer に `rememberCommandAs`。**船長(captain)は持続で「次のターンの開始時」が別のプレイ＝毎ターン選び直す**ので commandAs を使わない（意図的）。
- **混合山の正本＝gain の `isMixed`（ruins/knights/castles）＋ state.ruins/knights/castles**。**分割山の正本＝`DOM.SPLIT_PILES`（cards.js）**＝1行足せば gain/canBuyCard/emptyPileCount/CPU が自動対応。
- **gainer（remodel/工房等の `*_GAIN`）経由の獲得で on-gain 対話が要る効果は `state.onGainQueue` に積む**（finishGain の pending 中は `!pending` ゲートで抑止されるため＝E5の教訓）。
- **意図的な据え置き（再修正しなくてよい）**：workshop等の汎用「≤$N獲得」reducer は負債カードを除外していない（どの出荷セットでも同居せず到達不能。将来 mix-all モード時に共通ヘルパへ集約）。大君主/はみだし者/船長は「そのカードのコスト・名前・種別を得る」clause 未実装。玉座×大君主のネストで玉座の2回目が先に走り対象不在で空振りすることがある（`state.replay` が単一FIFO＝玉座×玉座の既存挙動と同型。保存則・非ループ確認済）。
- **reduce は state を clone して新stateを返す**（破壊的でない）＝テストは必ず `s = reduce(s, a)` と再代入。狙い撃ちで state を手組みするとき init tally は「手札/山札を上書きした後」に取る。
- **手番タイミングの罠**：cleanupAndAdvance が「自分の手番終了時に自分の次の手札を先引き(draw5)」してから次Pへ。持続の手番開始効果は手番が戻った時に発火。
- **Read出力の汚染に注意**：実在しないコード/コメントが混入して見えることがある。断定前に Grep・`git show`・`Get-Content` で裏取り。
