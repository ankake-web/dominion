<!-- /handoff が自動生成（2026-07-08）。新セッションはこのファイルの指示に従う。手編集不要 -->

ウルトラコード（最大エフォート）で進めてください。

スマホ向けドミニオン対戦Webアプリ（CPU戦・2〜4人ローカル・オンライン対戦）の実装を引き継ぎます。回答/UIは日本語。
作業ディレクトリ: c:\Users\b1242\claude\game\dominion / branch: main（main直接作業運用。最新は git log で確認）。

## まずやること
1. Set-Location 'C:\Users\b1242\claude\game\dominion' して npm test → 29スイート・オールグリーン（exit 0・整合性3132件）を確認。
2. PROGRESS.md の §0-9（冒険 段階2＝今の作業。Batch5/5c完了の詳細・残り着手順・落とし穴が全部ここ）と §5・§6 を読む。設計図＝docs/adding-cards.md（特殊山は §C）。

## 現状：冒険（Adventures）段階2 ＝ 34/38枚・未pushコミット多数
- Batch1a〜4／**Batch5（トラベラー全10枚＝page/peasant＋成長先8）**／**Batch5c（純持続/アタック3枚＝隊商の護衛/呪いの森/沼の妖婆）**まで完了。各バッチ fuzz緑＋狙い撃ち＋全29緑＋多エージェント敵対レビューでコミット済み。Batch5は確定バグ4件、Batch5cは確定バグ2件を検出→全修正済（`7cda556`・`edbd8a4`）。
- 冒険はまだ CARD_SET 未昇格＝通常プレイに出ない（invariants の全プール混成fuzz でのみ実行され緑）。本番挙動は不変。push は全カード完成→CARD_SET昇格→レビュー後に**都度ユーザー確認**（勝手に push しない）。

## 次に取り組むタスク（優先順1位）：Batch6＝複雑4枚
**PROGRESS §0-9「【重要】残り＝4枚（Batch6）」を必読**（各カードの効果・落とし穴が記載）。要点：
- **raze倒壊**($2)：+1アクション。これか手札1枚を廃棄→廃棄カードのコスト分だけ山札の上を見て1枚手札・残り捨て（sentry/lookout型pending）。
- **artificer工匠**($5)：+1カード+1アクション+$1。手札を好きな枚数捨て→捨てた枚数ちょうどのコストのカード1枚を山札の上に獲得してよい（任意・`!NON_SUPPLY.has(id)` 必須）。
- **storyteller語り部**($5)：+1アクション。手札から最大3枚の財宝をプレイ→所持コイン$1につき+1カード（コイン全消費）。`playTreasureCard` を使う。財宝リアクション/-$1トークンとの相互作用に注意。
- **messenger使者**($4)：+1購入+$2＋山札捨て（任意）。**買ったとき**そのターン最初の購入なら$4以下1枚獲得＋他全Pもコピー獲得（BUY内 on-buy・プレイ効果とは別物）。
- 各カード4点セット（engine reducer＋PLAYER_ACTIONS＋CPU decidePending＋UI viewPendingModal）＋新pendingの終端保証。狙い撃ち→invariants緑→npm test全29緑→コミット→多エージェント敵対レビュー→確定バグ修正。
その後：Phase E（CARD_SET昇格＝§0-9「Phase E」節・**成長先8種は POOLS.travellers に分離**／adventures.test.js に回帰テスト必須／sw.js v35→v36）→ 帝国（Empires）段階2。

## 守るべき進め方・流儀
- **1枚実装した瞬間から4点セット必須**：engine reducer＋PLAYER_ACTIONS登録＋CPU decidePending分岐＋UI viewPendingModal分岐。＋新pendingの終端保証（CPUが必ず有効手を返す）＋新ゾーン/新山の保存則tally配線。抜けは fuzz 即赤・CPU無限ループ・人間詰み。
- **「ちょうどコスト/同コスト/相手に獲得させる」系の獲得は必ず `!NON_SUPPLY.has(id)` を両側（anyGainable と canGain）に入れる**＝Batch5レビューで upgrade/remake/governor/forge/swindler の除外漏れが HIGH デッドロック＋不正獲得を起こした。artificer（ちょうどコスト獲得）も同様に必須。
- **相手の購入/獲得をフックする効果・手札を動かす持続は、on-buy/on-gain の選択待ち(pending)と衝突しないか必ず敵対検証**＝Batch5cで呪いの森×農地のデッドロックが出た（手札依存 pending を空手札で終端＝FARMLAND_TRASH と同型の終端保証を入れる）。
- **1バッチごとに**：狙い撃ち一時テスト（プロジェクト直下 `_*.tmp.js`・実行後**必ず削除**）→ `node test/invariants.test.js` 緑 → `npm test` 全29緑 → コミット（`wip(adventures): 段階2 BatchN=...`）。大きな決定は PROGRESS.md に追記。
- **substantiveなタスクは Workflow で多エージェント＋敵対的検証**（実装後に確定バグを空試験で再現→修正。Batch3/4/5/5cでこの流れで実バグを検出・修正した）。**ソークのデッドロック検出は pending の完全JSONを比較すること**（type/stageだけだと remaining/queue が動く多段pendingを偽陽性で誤検出する＝Batch5cで踏んだ）。公式ルールが曖昧なら研究エージェントで wiki 裏取り。
- 財宝は `coin:` を追加（表示テキスト不変＝webp再生成不要）。client資産（js/css等）を変えたら sw.js の VERSION を上げる（現在 v35・Phase E で v36 予定）。回答は日本語・フランクに短く。

## 次セッションが知らないと事故る事項（必読）
- **未pushコミット多数**（Batch1a〜5c＋レビュー修正）。push は完成後に必ずユーザー確認。
- **手番タイミングの罠**：cleanupAndAdvance が「自分の手番終了時に自分の次の手札を先引き(draw5)」してから次Pへ。持続の手番開始効果は手番が戻った時に発火。テストで開始時効果を見るには相手を回して自分の手番へ戻す。**持続の先引きは山札が尽きると引ける枚数だけ**（テストで +N を確認するなら山札を厚めに）。
- **自己移動は必ず removeOne の戻り値チェック**（putOnTavern/交換/champion/caravan_guard の durationCards 残しは同型の罠）。
- **Batch5/5cの許容簡略化（意図的）**：champion/teacher/caravan_guard のボーナスは玉座/王の宮廷/門下生の再演では発火しない（PLAY_ACTION のみ）。呪いの森×農地の同時購入時は農地が空振り（fuzz限定＝出荷セットで同居しない）。
- **Read出力の汚染に注意**：実在しないコード/コメントが Read 結果に混入して見えることがある。実装状態を断定する前に Grep・`git show`・`Get-Content` で裏取り。
- 使い捨てスクリプトはシェルcwdがずれることがあるので実行前に `Set-Location 'C:\Users\b1242\claude\game\dominion'`。
