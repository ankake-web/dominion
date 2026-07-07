<!-- /handoff が自動生成（2026-07-08）。新セッションはこのファイルの指示に従う。手編集不要 -->

ウルトラコード（最大エフォート）で進めてください。

スマホ向けドミニオン対戦Webアプリ（CPU戦・2〜4人ローカル・オンライン対戦）の実装を引き継ぎます。回答/UIは日本語。
作業ディレクトリ: c:\Users\b1242\claude\game\dominion / branch: main（main直接作業運用。最新は git log で確認）。

## まずやること
1. Set-Location 'C:\Users\b1242\claude\game\dominion' して npm test → 29スイート・オールグリーン（exit 0・整合性3132件）を確認。
2. PROGRESS.md の §0-9（冒険 段階2。全38枚のカード効果 実装完了・残りは Phase E。設計事実・落とし穴が全部ここ）と §5・§6 を読む。設計図＝docs/adding-cards.md（特殊山は §C）。

## 現状：冒険（Adventures）段階2 ＝ 全38枚のカード効果 実装完了・残るは Phase E（CARD_SET昇格）
- Batch1a〜6 で **冒険38枚すべて**（トラベラー/Reserve/トークン/持続/アタック/複雑系）を実装済み。各バッチ fuzz緑＋狙い撃ち＋全29緑＋多エージェント敵対レビューでコミット済み（Batch5=確定バグ4件、5c=2件、6=1件を検出→全修正）。
- 冒険はまだ CARD_SET 未昇格＝通常プレイに出ない（invariants の全プール混成fuzz でのみ実行され緑）。本番挙動は不変。**未pushコミット多数**（Batch1a〜6＋各レビュー修正）。push は Phase E完了→レビュー後に**都度ユーザー確認**（勝手に push しない）。

## 次に取り組むタスク：Phase E（CARD_SET昇格）＝冒険を実サプライに出す
**PROGRESS §0-9「【重要】残り＝Phase E」を必読**（配線・テスト・webp・sw.js の手順が全部そこ）。要点：
1. **昇格の配線**（js/cards.js）：`DOM.KINGDOM_ADVENTURES` 固定10種を自作／**`POOLS.adventures` から成長先8種を `POOLS.travellers` に分離**（treasure_hunter/warrior/hero/champion/soldier/fugitive/disciple/teacher＝prizes と同型＝random 抽選から外す・page/peasant はサプライなので adventures に残す）／`DOM.CARD_SETS` に `adventures`＋`random-adventures` の2行／GAIN_ORDER 実強度順に再配置／invariants の出荷セット検証に2セット追加。
2. **テスト新設**：`adventures.test.js`／`adventures-ui.test.js`（package.json 登録）。回帰テスト必須（§0-9に列挙）＝throne/KC/procession×Reserve 保存則／page/peasant×upgrade/remake/forge のデッドロック回帰／swindler×成長先／champion・teacher・トラベラー交換／呪いの森×農地・沼の妖婆×過払い・免疫の反応順独立／玉座×語り部×水晶玉の引き枚数／使者の初回配布。
3. **多エージェント敵対レビュー → CPUソーク（240戦級）→ webp**：**storyteller の webp 再生成必須**（カタログ文を2022エラッタに更新済み＝画像が古い。`CARDS_ONLY=storyteller node tools/build-cards.js`・このPCのみ）。他37枚は再生成不要。→ **`sw.js` v35→v36** → PROGRESS更新 → **ユーザー確認の上で push**。
4. その後＝帝国（Empires）段階2（別の大仕事）。

## 守るべき進め方・流儀
- **新しく「ちょうどコスト/同コスト/相手に獲得させる」系の獲得を足す/触る時は必ず `!NON_SUPPLY.has(id)` を両側（anyGainable と canGain）に入れる**＝Batch5で upgrade/remake/governor/forge/swindler の除外漏れが HIGH デッドロック＋不正獲得、Batch6の artificer も同型で対処済み。
- **相手の購入/獲得をフックする効果・手札を動かす持続・玉座の再演は、on-buy/on-gain の選択待ち(pending)や runReplays の順序と衝突しないか必ず敵対検証**＝Batch5cで呪いの森×農地のデッドロック、Batch6で玉座×語り部の引き枚数取りこぼしが出た。
- **1枚実装/変更ごとに**：狙い撃ち一時テスト（プロジェクト直下 `_*.tmp.js`・実行後**必ず削除**）→ `node test/invariants.test.js` 緑 → `npm test` 全29緑 → コミット。大きな決定は PROGRESS.md に追記。
- **substantiveなタスクは Workflow で多エージェント＋敵対的検証**（実装後に確定バグを空試験で再現→修正。Batch3〜6でこの流れで実バグを検出・修正した）。**Workflow の CONTEXT 文字列にバックティック（`）を入れない**＝テンプレートリテラルが途中で閉じてパースエラーになる（Batch6で踏んだ）。**ソークのデッドロック検出は pending の完全JSONを比較する**（type/stageだけだと remaining/queue が動く多段pendingを偽陽性で誤検出＝Batch5c/6で踏んだ）。公式ルールが曖昧なら研究エージェントで wiki/RGGルールブック 裏取り。
- client資産（js/css/webp等）を変えたら sw.js の VERSION を上げる（現在 v35・Phase E で v36 予定）。回答は日本語・フランクに短く。

## 次セッションが知らないと事故る事項（必読）
- **未pushコミット多数**（Batch1a〜6＋レビュー修正）。push は Phase E完了後に必ずユーザー確認。
- **手番タイミングの罠**：cleanupAndAdvance が「自分の手番終了時に自分の次の手札を先引き(draw5)」してから次Pへ。持続の手番開始効果は手番が戻った時に発火。**持続/先引きは山札が尽きると引ける枚数だけ**（テストで +N を確認するなら山札を厚めに）。
- **Batch5/5c/6 の許容簡略化（意図的）**：champion/teacher/caravan_guard のボーナスは玉座/王の宮廷/門下生の再演では発火しない（PLAY_ACTION のみ）。呪いの森×農地の同時購入時は農地が空振り（fuzz限定＝出荷セットで同居しない）。
- **狙い撃ちテストで state を手で組むとき**：init tally は「手札/山札を上書きした後」に取る（上書き前に取ると元カードを失って保存則が偽陽性で落ちる＝今回何度も踏んだ）。
- **Read出力の汚染に注意**：実在しないコード/コメントが Read 結果に混入して見えることがある。実装状態を断定する前に Grep・`git show`・`Get-Content` で裏取り。
- 使い捨てスクリプトはシェルcwdがずれることがあるので実行前に `Set-Location 'C:\Users\b1242\claude\game\dominion'`。
