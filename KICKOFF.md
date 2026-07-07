<!-- /handoff が自動生成（2026-07-08）。新セッションはこのファイルの指示に従う。手編集不要 -->

ウルトラコード（最大エフォート）で進めてください。

スマホ向けドミニオン対戦Webアプリ（CPU戦・2〜4人ローカル・オンライン対戦）の実装を引き継ぎます。回答/UIは日本語。
作業ディレクトリ: c:\Users\b1242\claude\game\dominion / branch: main（main直接作業運用。最新は git log で確認）。

## まずやること
1. `Set-Location 'C:\Users\b1242\claude\game\dominion'` して `npm test` → **32スイート・オールグリーン（exit 0・整合性3134件・帝国39件）**を確認。
2. `PROGRESS.md` の §0-10（帝国 段階2＝Batch E1 完了・次はE2）と §5・§6 を読む。**帝国の設計正本＝`docs/research/empires_rules.md`**（公式ルール裏取り＋6機構＋バッチ計画）。全体設計図＝`docs/adding-cards.md`。

## 現状：帝国（Empires）段階2に着手＝Batch E1＝負債(Debt)経済の基盤 完了（未push）
- **負債スカラー `p.debt`**（購入ブロック／`REPAY_DEBT`返済／`gain()`で付与／capitalのon-discard負債＋残コイン即返済）＋**純負債4枚**（技術者/市街/王室の鍛冶屋/元手）を実装＋CPU＋UI。`sw.js` v37。
- 「コストN以下/ちょうどN の獲得」は負債コストのカードを取れないルールを engine/CPU/UI に反映。多エージェント敵対レビュー（5次元）→確定バグ1件（闇市場×負債）修正済み。`test/empires.test.js`（39件）新設。
- **冒険（Adventures）段階2は前回セッションで push 済み（HEAD が origin/main と一致＝本番反映済み・sw.js v36）**。その上に **Batch E1 のコミット（`wip(empires): … Batch E1`）が未push**。

## 次に取り組むタスク（優先順1位）：帝国 Batch E2（既存VPトークン＆単独カード 9枚）
- 対象＝sacrifice（廃棄→種別別ボーナス・勝利点ならVPトークン2個）/chariot_race（コスト比較→+コイン+VP）/groundskeeper（場にある間 勝利点獲得毎にVP）/forum（+3カード+1ア-2捨て・on-buy+1購入）/legionary（アタック＝金貨公開で相手手札2枚に）/enchantress（持続アタック＝相手の最初のアクションを+1カード+1アクションに置換）/archive（3手番持続＝上3枚脇→毎手番1枚手札へ）/charm（財宝の二択＝獲得コピー）/villa（獲得で手札＋アクションフェイズ復帰）。
- **プレイヤーVPトークン `p.vpTokens` は既存**（繁栄で実装済・vpOfに加算済）＝集合(山上VP)とは別。E2は既存VPトークンを使うだけ。個別裁定は `docs/research/empires_rules.md` §3 を着手時に必ず再確認（chariot_raceの同コスト扱い・enchantressの置換・villaのフェイズ復帰・archiveの複数手番持続 等）。
- 以降の順：E3集合(山上VP＝farmers_market/temple/wild_hunt)→E4分割山5組(sauna/avanto流用)→E5城8(knights混合山流用)→E6命令(overlord/crown)→E7=CARD_SET昇格。

## 守るべき進め方・流儀
- **新pendingは必ず4点セット**（engine reducer＋PLAYER_ACTIONS登録＋CPU decidePending＋UI viewPendingModal）＋終端保証。持続は armDuration/DURATION_RESOLVERS/startQueue安全網、命令は state.replay。
- **新しく「≤$N/ちょうど$N/相手に獲得させる」系の獲得を足す/触るときは `!NON_SUPPLY.has(id)` と（帝国では）`!(C()[id].debt>0)` を engine述語と CPU bestGain の両側に入れる**（片側だけだと「engine拒否×CPU再提案＝無限ループ」）。
- **1枚実装/変更ごとに**：狙い撃ち一時テスト（プロジェクト直下 `_*.tmp.js`＝.gitignore済・実行後**必ず削除**。cwdがずれるので実行前に Set-Location）→ `node test/invariants.test.js` 緑 → `npm test` 全32緑 → コミット。回帰は `test/empires.test.js` に足す。大きな決定は PROGRESS.md に追記。
- **substantiveなタスクは Workflow で多エージェント＋敵対的検証**。CONTEXT文字列にバックティックを入れない（テンプレートリテラルが壊れる）。ソークのデッドロック検出は pending の完全JSONを比較。**レビューエージェントは同名 `_*.tmp.js` を作りうる**（自分の一時テストが上書きされ得る＝恒久テストは test/empires.test.js に置く）。公式ルールが曖昧なら研究エージェントで wiki/RGG 裏取り（wiki.dominionstrategy.com はボット保護でWebFetch不可＝WebSearch と ultraboardgames/fandom を使う）。
- client資産（js/css/webp等）を変えたら `sw.js` の VERSION を上げる（現在 v37）。回答は日本語・フランクに短く。**push は勝手にしない＝完成→全テスト緑→都度ユーザー確認の上で**。

## 次セッションが知らないと事故る事項（必読）
- **未pushコミットあり**（Batch E1＋この handoff）。push は必ずユーザー確認。帝国は CARD_SET 未昇格＝**本番挙動は不変**（負債カードはサプライに出ない）。
- **意図的な据え置き（§0-10・§6）**：workshop等の汎用「≤$N獲得」reducer は負債カードを除外していない。どの出荷セットでも負債カードと汎用gainerは同居せず（mix-allセット無し）＋fuzzはCPU駆動でbestGainが負債カードを提案しないため到達不能。将来 mix-allモード時に共通ヘルパへ集約（ポーション費用問題と一緒に）。**再修正しなくてよい**。
- **reduce は state を clone して新stateを返す**（破壊的でない）＝テストは必ず `s = reduce(s, a)` と再代入。狙い撃ちで state を手組みするとき init tally は「手札/山札を上書きした後」に取る。
- **手番タイミングの罠**：cleanupAndAdvance が「自分の手番終了時に自分の次の手札を先引き(draw5)」してから次Pへ。持続の手番開始効果は手番が戻った時に発火。capital の負債は cleanup で発火（残コインから即返済）。
- **Read出力の汚染に注意**：実在しないコード/コメントが混入して見えることがある。断定前に Grep・`git show`・`Get-Content` で裏取り。
