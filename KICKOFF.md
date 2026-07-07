<!-- /handoff が自動生成（2026-07-07）。新セッションはこのファイルの指示に従う。手編集不要 -->

ウルトラコード（最大エフォート）で進めてください。

スマホ向けドミニオン対戦Webアプリ（CPU戦・2〜4人ローカル・オンライン対戦）の実装を引き継ぎます。回答/UIは日本語。
作業ディレクトリ: c:\Users\b1242\claude\game\dominion / branch: main（main直接作業運用。最新は git log で確認）。

## まずやること
1. Set-Location 'C:\Users\b1242\claude\game\dominion' して npm test → 29スイート・オールグリーン（exit 0・整合性3132件）を確認。
2. PROGRESS.md の §0-9（冒険 段階2＝今の作業。設計事実・落とし穴・残り着手順が全部ここ）と §5・§6 を読む。設計図＝docs/adding-cards.md（特殊山は §C）。

## 現状：冒険（Adventures）段階2 ＝ 21/38枚・未pushコミット多数
- Batch1a/2/2b（単純+持続8枚）／Batch3（トークン系4枚=山守/巨人/遺物/橋の下のトロル＋旅/-1カード/-$1トークン）／Batch4（酒場マット/Reserve全9枚=守銭奴/遠隔地/鼠取り/案内人/変容/ワイン商/法貨/御料車/複製）まで完了。各バッチ fuzz緑＋狙い撃ちテスト＋全29スイート緑＋多エージェント敵対レビューでコミット済み。
- 冒険はまだ CARD_SET 未昇格＝通常プレイに出ない（invariants の全プール混成fuzz でのみ実行され緑）。本番挙動は不変。push は全カード完成→CARD_SET昇格→レビュー後に**都度ユーザー確認**（勝手に push しない）。

## 次に取り組むタスク（優先順1位）：Batch5＝トラベラー（page/peasant＋成長先8種）
2系統：page→treasure_hunter→warrior→hero→champion ／ peasant→soldier→fugitive→disciple→teacher。
新機構（詳細は PROGRESS §0-9「残り」3.＋docs/adding-cards.md §C を必読。ここは要点のみ）：
1. **非サプライ山（各5枚）**：成長先8種は非サプライ。page/peasant が王国にあるとき initSupply で各5枚を supply 数値キー追加。§6「賞品の4系統除外チェックリスト」を必ず通す＝`NON_SUPPLY`＋cpu `NON_SUPPLY_SET` に8id追加／canBuyCard 不可／emptyPileCount 除外／blackMarket母集団から除外／engine `*_GAIN`＋cpu `bestGain/bestGainExact` から除外。
2. **トラベラー交換**：「場から捨てる時、次の成長先と交換してよい」＝cleanupAndAdvance の「場→捨て札」の直前で交換窓。交換＝獲得ではない（on-gainフック不発）。次の山が空なら不可。交換は必ず removeOne の戻り値チェック（自己移動＝下記の落とし穴）。
3. **champion**：永続持続＝hireling/prince と同型（cleanupAndAdvance の cnt に加算し durationCards に残す）。ゲーム終了までアタック免疫＋自分がアクションを使うたび+1アクション。免疫は `attackImmune` に champion 条件を追加。
4. **teacher**：Reserve＝Batch4で作った酒場マット機構（putOnTavern／tavern_start コール）をそのまま流用。加えて「+カード/+アクション/+購入/+コイン トークンを、自分のトークンが無いアクションのサプライ山に置く」＝山ごとのトークン新機構（その山のカードをプレイした時にボーナス）。ここが最も複雑。
- **推奨分割**：Batch5a＝非サプライ山＋交換＋page/peasant＋treasure_hunter/warrior(アタック)/hero/champion/soldier(アタック)/fugitive/disciple。Batch5b＝teacher（Reserve＋山トークン）。
その後：Batch6＝複雑4枚（raze倒壊/artificer工匠/storyteller語り部/messenger使者）→ Phase E（CARD_SET昇格＝DOM.KINGDOM_ADVENTURES固定10種＋POOLS昇格＋CARD_SETS2行＋GAIN_ORDER再配置／adventures.test.js・adventures-ui.test.js 新設＝**throne/KC/procession×Reserve の強制保存則テストを必ず入れる**／敵対レビュー／CPUソーク／webp確認／sw.js v35→v36）→ その後 帝国（Empires）段階2。

## 守るべき進め方・流儀
- **1枚実装した瞬間から4点セット必須**：engine reducer＋PLAYER_ACTIONS登録＋CPU decidePending分岐＋UI viewPendingModal分岐。＋新pendingの終端保証（CPUが必ず有効手を返す）＋新ゾーン/新山の保存則tally配線（test/invariants.test.js の ZONES／tally）。抜けは fuzz が即赤・CPU無限ループ・人間詰みになる。
- **1バッチごとに**：狙い撃ち一時テスト（プロジェクト直下に `_*.tmp.js`・実行後**必ず削除**）→ `node test/invariants.test.js` 緑 → `npm test` 全29緑 → コミット（`wip(adventures): 段階2 BatchN=...`）。大きな決定は PROGRESS.md に追記。
- **substantiveなタスクは Workflow で多エージェント＋敵対的検証**（実装後に確定バグを空試験で再現→修正。Batch3/4でこの流れで実バグを各1件検出・修正した）。公式ルールが曖昧なら研究エージェントで wiki 裏取り。
- 財宝は `coin:` を追加（表示テキスト不変＝webp再生成不要）。client資産（js等）を変えたら sw.js の VERSION を上げる（現在 v35・Phase E で v36 予定）。回答は日本語・フランクに短く。

## 次セッションが知らないと事故る事項（必読）
- **未pushコミット多数**（Batch1a〜4＋レビュー修正）。push は完成後に必ずユーザー確認。
- **手番タイミングの罠**：このエンジンは「自分の手番終了時に自分の次の手札を先引き（cleanupAndAdvance で draw 5）」し、持続の「手番開始時」効果（resolveDurationStartEffects）は手番が戻った時に発火して先引き済み手札に加算する。テストで開始時効果を見るには END_TURN 1回では足りない（相手を回して自分の手番へ戻す）。
- **自己移動は必ず removeOne の戻り値チェック**：「場/手札から取り除いて別ゾーンへ移す」処理は `if (removeOne(...)) { push... }` にする。Batch4で putOnTavern がこれを怠り、玉座/王の宮廷/行進の複製プレイで酒場マットに幻カードが増殖（保存則違反）した。トラベラー交換・champion の durationCards 残しも同型の罠。
- **Read出力の汚染に注意**：実在しないコード/コメントが Read 結果に混入して見えることがある。実装状態を断定する前に Grep・`git show`・`Get-Content` で裏取りする。
- 使い捨てスクリプトはシェルcwdがずれることがあるので実行前に `Set-Location 'C:\Users\b1242\claude\game\dominion'`。
