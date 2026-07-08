<!-- /handoff が自動生成（2026-07-08）。新セッションはこのファイルの指示に従う。手編集不要 -->

ウルトラコード（最大エフォート）で進めてください。

スマホ向けドミニオン対戦Webアプリ（CPU戦・2〜4人ローカル・オンライン対戦）の実装を引き継ぎます。回答/UIは日本語。
作業ディレクトリ: c:\Users\b1242\claude\game\dominion / branch: main（main直接作業運用。最新は git log で確認）。

## まずやること
1. `Set-Location 'C:\Users\b1242\claude\game\dominion'` して `npm test` → **32スイート・オールグリーン（exit 0・整合性3134件・帝国79件）**を確認。
2. `PROGRESS.md` の §0-11（帝国 段階2＝Batch E2 完了・次はE3）と §0-10（E1）・§5・§6 を読む。**帝国の設計正本＝`docs/research/empires_rules.md`**（公式ルール裏取り＋6機構＋バッチ計画）。全体設計図＝`docs/adding-cards.md`。

## 現状：帝国（Empires）段階2＝Batch E1（負債経済）＋Batch E2（既存VPトークン＆単独9枚）まで完了（未push）
- **Batch E2 完了**＝forum/sacrifice/groundskeeper/chariot_race/villa/charm/legionary/enchantress/archive の9枚を4点セットで実装（詳細＝PROGRESS §0-11）。`sw.js` v37→**v38**。`test/empires.test.js` を全79件に拡張。
- 研究WFで**カタログ誤り2件を修正**（villa＝「これを手札に加える」はプレイ時でなく獲得時／forum＝「購入時」→「獲得時」の+1購入。**villa/forumのwebp再生成済**）。chariot_raceの「左隣0枚は勝ち」も誤り→両者公開でき厳密に高い時だけに修正。
- **敵対レビュー（6次元→node再現）＝確定バグ2件修正**（生贄×玉座でCPU無限ループ＝CPU sacrifice に手札フォールバック／闇市場でvilla等のon-gain欠落＝BLACK_MARKET_BUYにtriggerOnGain追加）＋据え置き1件（enchantress×追加ターン＝出荷帝国に追加ターン源なしで到達不能・許容簡略化）。
- **帝国はまだ CARD_SET 未昇格＝本番挙動は不変**（帝国カードはサプライに出ない）。**冒険までは push 済**（sw.js v36）。その上に **Batch E1＋E2＋この handoff が未push**。

## 次に取り組むタスク（優先順1位）：帝国 Batch E3（集合＝サプライ山上のVPトークン）
- `docs/research/empires_rules.md` §1-2 の集合機構＝新スカラー **`state.pileVP = {[pileId]:個数}`**（公開・非カード＝保存則に無関係・maskはObject.assignで残る）＋**temple/farmers_market/wild_hunt** の3枚。個別裁定は §3 を着手時に必ず再確認（farmers_marketの4個以上で全取得＋廃棄・templeの獲得時全取得・wild_huntの二択）。**プレイヤーVPトークン `p.vpTokens` は既存**＝集合は「山側のVP」だけが新規。
- 以降の順：E4分割山5組(sauna/avanto流用)→E5城8(knights混合山流用)→E6命令(overlord/crown)→E7=CARD_SET昇格。

## 守るべき進め方・流儀
- **新pendingは必ず4点セット**（engine reducer＋PLAYER_ACTIONS登録＋CPU decidePending＋UI viewPendingModal）＋終端保証。持続は armDuration/DURATION_RESOLVERS/startQueue安全網、命令は state.replay。
- **新しく「≤$N/ちょうど$N/相手に獲得させる」系の獲得を足す/触るときは `!NON_SUPPLY.has(id)` と（帝国では）`!(C()[id].debt>0)` を engine述語と CPU bestGain の両側に入れる**（片側だけだと「engine拒否×CPU再提案＝無限ループ」）。
- **1枚実装/変更ごとに**：狙い撃ち一時テスト（プロジェクト直下 `_*.tmp.js`＝.gitignore済・実行後**必ず削除**。cwdがずれるので実行前に Set-Location）→ `node test/invariants.test.js` 緑 → `npm test` 全32緑 → コミット。回帰は `test/empires.test.js` に足す。大きな決定は PROGRESS.md に追記。
- **substantiveなタスクは Workflow で多エージェント＋敵対的検証**。CONTEXT文字列にバックティックを入れない（テンプレートリテラルが壊れる）。ソークのデッドロック検出は pending の完全JSONを比較。**レビューエージェントは同名 `_*.tmp.js` を作りうる**（自分の一時テストが上書きされ得る＝恒久テストは test/empires.test.js に置く）。公式ルールが曖昧なら研究エージェントで wiki/RGG 裏取り（wiki.dominionstrategy.com はボット保護でWebFetch不可＝WebSearch と ultraboardgames/fandom を使う）。
- client資産（js/css/webp等）を変えたら `sw.js` の VERSION を上げる（現在 v38）。回答は日本語・フランクに短く。**push は勝手にしない＝完成→全テスト緑→都度ユーザー確認の上で**。

## 次セッションが知らないと事故る事項（必読）
- **未pushコミットあり**（Batch E1＋Batch E2＋この handoff）。push は必ずユーザー確認。帝国は CARD_SET 未昇格＝**本番挙動は不変**（帝国カードはサプライに出ない）。
- **意図的な据え置き（§0-10・§6）**：workshop等の汎用「≤$N獲得」reducer は負債カードを除外していない。どの出荷セットでも負債カードと汎用gainerは同居せず（mix-allセット無し）＋fuzzはCPU駆動でbestGainが負債カードを提案しないため到達不能。将来 mix-allモード時に共通ヘルパへ集約（ポーション費用問題と一緒に）。**再修正しなくてよい**。
- **reduce は state を clone して新stateを返す**（破壊的でない）＝テストは必ず `s = reduce(s, a)` と再代入。狙い撃ちで state を手組みするとき init tally は「手札/山札を上書きした後」に取る。
- **手番タイミングの罠**：cleanupAndAdvance が「自分の手番終了時に自分の次の手札を先引き(draw5)」してから次Pへ。持続の手番開始効果は手番が戻った時に発火。capital の負債は cleanup で発火（残コインから即返済）。
- **Read出力の汚染に注意**：実在しないコード/コメントが混入して見えることがある。断定前に Grep・`git show`・`Get-Content` で裏取り。
