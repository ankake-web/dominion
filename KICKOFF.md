<!-- /handoff が自動生成（2026-07-08）。新セッションはこのファイルの指示に従う。手編集不要 -->

ウルトラコード（最大エフォート）で進めてください。

スマホ向けドミニオン対戦Webアプリ（CPU戦・2〜4人ローカル・オンライン対戦）の実装を引き継ぎます。回答/UIは日本語。
作業ディレクトリ: c:\Users\b1242\claude\game\dominion / branch: main（main直接作業運用。最新は git log で確認）。

## まずやること
1. `Set-Location 'C:\Users\b1242\claude\game\dominion'` して `npm test` → **32スイート・オールグリーン（exit 0・整合性3134件・帝国122件）**を確認。
2. `PROGRESS.md` の §0-13（帝国 段階2＝Batch E4 完了・次はE5）と §0-12（E3）・§0-11（E2）・§0-10（E1）・§5・§6 を読む。**帝国の設計正本＝`docs/research/empires_rules.md`**（公式ルール裏取り＋6機構＋バッチ計画）。全体設計図＝`docs/adding-cards.md`。

## 現状：帝国（Empires）段階2＝Batch E1（負債）＋E2（単独9枚）＋E3（集合）＋E4（分割山5組）まで完了
- **Batch E4 完了**＝分割山5組の10枚（encampment/plunder・patrician/emporium・settlers/bustling_village・catapult/rocks・gladiator/fortune）を4点セットで実装＋**分割山機構を sauna/avanto 専用から一般化**（`DOM.SPLIT_PILES`＝下段id→上段id の唯一の正本／engine `splitLocked`／initSupply/complement/gain/canBuyCard/emptyPileCount/captain/bandOfMisfits/teacher/cpu `splitBlocked`/randomKingdom を全て一般化）。詳細＝PROGRESS §0-13。`sw.js` v39→**v40**。`test/empires.test.js` を全122件に拡張。**カタログ/webp変更なし**（研究WFで全10枚のカタログ＝公式一致・plunder/rocksに coin:のみ追加）。
- 敵対レビュー（6次元→node再現）＝確定バグ1件修正：**exact-cost強制獲得（upgrade/remake/procession等）が「ロック中の分割山下段（rocks $4など基本札に同コストが無い）を唯一候補」として掴んで無限ループ/人間詰み**→**全ての exact-cost 強制獲得述語＋finishGain の辞退経路に `!splitLocked(state,id)` を追加**（≤N/＜N は基本札があり対象外）。sauna/avanto回帰なし。
- **帝国はまだ CARD_SET 未昇格＝本番挙動は不変**（帝国カードはサプライに出ない）。**E1〜E3は push 済**（sw.js v39）。その上に **Batch E4＋この handoff が未push**。

## 次に取り組むタスク（優先順1位）：帝国 Batch E5（城8＝混合山）
- `docs/research/empires_rules.md` §1-4 の城8＝**knights 混合山流用**（`js/engine.js` の `isMixed`/`state.knights` を参照。`state.castles`＝top-level id配列・コスト昇順に積む・一番上だけ購入/獲得・invariants tally に forEach(add)・maskで先頭のみ公開・emptyPileCount に +（空なら1）・`cardCost('castles')`＝先頭の実コスト）。
- **2人＝各1枚計8／3人以上＝計12**（Humble/Small/Opulent/Kings を各2・Crumbling/Haunted/Sprawling/Grand は各1・昇順維持）。可変VP（humble_castle=所有城数×1／kings_castle=所有城数×2＝vpOfに城カウント項）＋各on-gain（small=これか手札の城1枚を廃棄→城1枚獲得・crumbling=獲得/廃棄で+1VP&銀貨1・haunted=自手番獲得で金貨1&他P手札5枚以上なら2枚山札上・sprawling=獲得で公領1or屋敷3・grand=獲得で手札公開し手札+場の勝利点1枚毎+1VP・opulent=手札の勝利点を任意枚数捨て1枚毎+2コイン）。
- 以降の順：E6命令(overlord/crown)→E7=CARD_SET昇格。

## 守るべき進め方・流儀
- **新pendingは必ず4点セット**（engine reducer＋PLAYER_ACTIONS登録＋CPU decidePending＋UI viewPendingModal）＋終端保証。持続は armDuration/DURATION_RESOLVERS/startQueue安全網、命令は state.replay。
- **新しく「≤$N/ちょうど$N/相手に獲得させる」系の獲得を足す/触るときは `!NON_SUPPLY.has(id)` と（帝国では）`!(C()[id].debt>0)` を engine述語と CPU bestGain の両側に入れる**（片側だけだと「engine拒否×CPU再提案＝無限ループ」）。
- **1枚実装/変更ごとに**：狙い撃ち一時テスト（プロジェクト直下 `_*.tmp.js`＝.gitignore済・実行後**必ず削除**。cwdがずれるので実行前に Set-Location）→ `node test/invariants.test.js` 緑 → `npm test` 全32緑 → コミット。回帰は `test/empires.test.js` に足す。大きな決定は PROGRESS.md に追記。
- **substantiveなタスクは Workflow で多エージェント＋敵対的検証**。CONTEXT文字列にバックティックを入れない（テンプレートリテラルが壊れる）。ソークのデッドロック検出は pending の完全JSONを比較。**レビューエージェントは同名 `_*.tmp.js` を作りうる**（自分の一時テストが上書きされ得る＝恒久テストは test/empires.test.js に置く）。公式ルールが曖昧なら研究エージェントで wiki/RGG 裏取り（wiki.dominionstrategy.com はボット保護でWebFetch不可＝WebSearch と ultraboardgames/fandom を使う）。
- client資産（js/css/webp等）を変えたら `sw.js` の VERSION を上げる（現在 v40）。回答は日本語・フランクに短く。**push は勝手にしない＝完成→全テスト緑→都度ユーザー確認の上で**。

## 次セッションが知らないと事故る事項（必読）
- **未pushコミットあり**（Batch E4＋この handoff。E1〜E3は push 済）。push は必ずユーザー確認。帝国は CARD_SET 未昇格＝**本番挙動は不変**（帝国カードはサプライに出ない）。
- **分割山の正本＝`DOM.SPLIT_PILES`（cards.js）**。新しい分割山を足すときはここに1行足すだけで gain/canBuyCard/emptyPileCount/CPU 等が自動対応する。**新しい「ちょうど$N獲得」系を足す/触るときは `!splitLocked(state,id)` も述語に入れる**（E4レビューのデッドロック回避＝`!NON_SUPPLY.has(id)`/`!(debt>0)` と同じ要領）。
- **意図的な据え置き（§0-10・§6）**：workshop等の汎用「≤$N獲得」reducer は負債カードを除外していない。どの出荷セットでも負債カードと汎用gainerは同居せず（mix-allセット無し）＋fuzzはCPU駆動でbestGainが負債カードを提案しないため到達不能。将来 mix-allモード時に共通ヘルパへ集約（ポーション費用問題と一緒に）。**再修正しなくてよい**。
- **reduce は state を clone して新stateを返す**（破壊的でない）＝テストは必ず `s = reduce(s, a)` と再代入。狙い撃ちで state を手組みするとき init tally は「手札/山札を上書きした後」に取る。
- **手番タイミングの罠**：cleanupAndAdvance が「自分の手番終了時に自分の次の手札を先引き(draw5)」してから次Pへ。持続の手番開始効果は手番が戻った時に発火。capital の負債は cleanup で発火（残コインから即返済）。
- **Read出力の汚染に注意**：実在しないコード/コメントが混入して見えることがある。断定前に Grep・`git show`・`Get-Content` で裏取り。
