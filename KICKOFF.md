<!-- /handoff が自動生成（2026-07-07）。新セッションはこのファイルの指示に従う。手編集不要 -->

ウルトラコード（最大エフォート）で進めてください。

スマホ向けドミニオン対戦Webアプリ（CPU戦・2〜4人ローカル・オンライン対戦）の実装を引き継ぎます。回答/UIは日本語。
作業ディレクトリ: c:\Users\b1242\claude\game\dominion / branch: main（main直接作業運用。最新は git log で確認）。

## まずやること
1. Set-Location 'C:\Users\b1242\claude\game\dominion' して npm test → 29スイート・オールグリーン（exit 0・整合性3132件）を確認。
2. PROGRESS.md の §0-9（冒険 段階2＝今の作業。Batch5完了の詳細・残り着手順・落とし穴が全部ここ）と §5・§6 を読む。設計図＝docs/adding-cards.md（特殊山は §C）。

## 現状：冒険（Adventures）段階2 ＝ 31/38枚・未pushコミット多数
- Batch1a/2/2b（単純+持続8枚）／Batch3（トークン系4枚）／Batch4（酒場マット/Reserve全9枚）／**Batch5（トラベラー全10枚＝page/peasant＋成長先8種[treasure_hunter/warrior/hero/champion/soldier/fugitive/disciple/teacher]）**まで完了。各バッチ fuzz緑＋狙い撃ち＋全29緑＋多エージェント敵対レビューでコミット済み。**Batch5は敵対レビューで確定バグ4件（HIGH1/MED1/LOW2）を検出→全修正済（`7cda556`）**。
- 冒険はまだ CARD_SET 未昇格＝通常プレイに出ない（invariants の全プール混成fuzz でのみ実行され緑）。本番挙動は不変。push は全カード完成→CARD_SET昇格→レビュー後に**都度ユーザー確認**（勝手に push しない）。

## 次に取り組むタスク（優先順1位）：残り7枚のうち まず 純持続/アタック3枚
**PROGRESS §0-9「【重要】残り＝7枚」を必読**。要点のみ：
1. **caravan_guard / haunted_woods / swamp_hag の3枚**＝旧バッチ計画に**抜けていた**純持続/アタック（現状 段階1＝効果なし `default:break`）。
   - **隊商の護衛caravan_guard**（+1c+1a・次ターン開始時+$1・**リアクション**＝他Pのアタック時に手札からプレイしてよい）＝馬商人/番犬型の「攻撃反応窓で先にプレイ」＋隊商型の次ターン予約（armDuration/DURATION_RESOLVERS）。`hasReaction` に追加。
   - **呪いの森haunted_woods**（アタック持続＝**次の自分の手番まで他Pが購入した時、その手札を全て山札の上に置く**・次ターン開始時+3カード）。
   - **沼の妖婆swamp_hag**（アタック持続＝**次の自分の手番まで他Pが購入した時、呪い1枚を獲得**・次ターン開始時+$3）。
   - **新機構＝「相手の購入をフックする持続」**（haunted_woods/swamp_hag 共通）。各プレイヤーの `delayedEffects` に「発動元席・種別」を張り、`BUY` reducer 末尾で**購入した席≠発動元席**の窓を発火させる（次の発動元の手番開始で窓を閉じる＝既存の封鎖/サルの「相手の手番中フック」と同型）。設計を PROGRESS §0-9 に新設して詰めてから実装。堀/champion 免疫の扱いに注意。
2. **Batch6＝複雑4枚**：raze/artificer/storyteller/messenger（PROGRESS §0-9 参照）。
3. **Phase E**（CARD_SET昇格）：`DOM.KINGDOM_ADVENTURES`固定10種＋POOLS昇格（**成長先8種は `POOLS.travellers` に分離**して random-adventures 抽選から外す＝prizes同型）＋CARD_SETS2行＋GAIN_ORDER再配置／`adventures.test.js`・`adventures-ui.test.js` 新設。**回帰テスト必須**＝throne/KC/procession×Reserve 保存則／**page/peasant×upgrade/remake/forge で$4がトラベラー成長先のみ→獲得なし終了（デッドロック回帰）**／**swindler×page/peasant で成長先が被害者に渡らない**／champion 永続・免疫・アクション毎+1／teacher 山トークン／交換の全系列。→ webp（カタログ変更なし＝再生成不要）→ `sw.js` v35→**v36**。
4. その後 帝国（Empires）段階2。

## 守るべき進め方・流儀
- **1枚実装した瞬間から4点セット必須**：engine reducer＋PLAYER_ACTIONS登録＋CPU decidePending分岐＋UI viewPendingModal分岐。＋新pendingの終端保証（CPUが必ず有効手を返す）＋新ゾーン/新山の保存則tally配線（test/invariants.test.js の ZONES／tally）。抜けは fuzz 即赤・CPU無限ループ・人間詰み。
- **新しく「ちょうどコスト/同コストで獲得」系や「相手に獲得させる」系を足す/触る時は必ず `!NON_SUPPLY.has(id)` を両側（anyGainable と canGain）に入れる**＝Batch5レビューで upgrade/remake/governor/forge/swindler の除外漏れが HIGH デッドロック＋不正獲得を起こした（farmland は元から除外していた）。
- **1バッチごとに**：狙い撃ち一時テスト（プロジェクト直下 `_*.tmp.js`・実行後**必ず削除**）→ `node test/invariants.test.js` 緑 → `npm test` 全29緑 → コミット（`wip(adventures): 段階2 BatchN=...`）。大きな決定は PROGRESS.md に追記。
- **substantiveなタスクは Workflow で多エージェント＋敵対的検証**（実装後に確定バグを空試験で再現→修正。Batch3/4/5でこの流れで実バグを検出・修正した）。公式ルールが曖昧なら研究エージェントで wiki 裏取り。
- 財宝は `coin:` を追加（表示テキスト不変＝webp再生成不要）。client資産（js/css等）を変えたら sw.js の VERSION を上げる（現在 v35・Phase E で v36 予定）。回答は日本語・フランクに短く。

## 次セッションが知らないと事故る事項（必読）
- **未pushコミット多数**（Batch1a〜5＋レビュー修正）。push は完成後に必ずユーザー確認。
- **手番タイミングの罠**：このエンジンは「自分の手番終了時に自分の次の手札を先引き（cleanupAndAdvance で draw 5）」し、持続の「手番開始時」効果（resolveDurationStartEffects）は手番が戻った時に発火して先引き済み手札に加算する。テストで開始時効果を見るには END_TURN 1回では足りない（相手を回して自分の手番へ戻す）。
- **自己移動は必ず removeOne の戻り値チェック**：「場/手札から取り除いて別ゾーンへ移す」処理は `if (removeOne(...)) { push... }`。putOnTavern/交換/champion の durationCards 残しも同型の罠。
- **Batch5の許容簡略化（意図的）**：champion の+1アクション／teacher の山トークンのボーナスは、玉座/王の宮廷/門下生の**再演では発火しない**（PLAY_ACTION のみ）。公式は各再演で発火するが冒険固定セットに玉座/王の宮廷は入らない見込み＝shipping影響なし・保存則影響なし。
- **Read出力の汚染に注意**：実在しないコード/コメントが Read 結果に混入して見えることがある。実装状態を断定する前に Grep・`git show`・`Get-Content` で裏取り。
- 使い捨てスクリプトはシェルcwdがずれることがあるので実行前に `Set-Location 'C:\Users\b1242\claude\game\dominion'`。
