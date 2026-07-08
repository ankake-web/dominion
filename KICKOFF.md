<!-- /handoff が自動生成（2026-07-08）。新セッションはこのファイルの指示に従う。手編集不要 -->

ウルトラコード（最大エフォート）で進めてください。

スマホ向けドミニオン対戦Webアプリ（CPU戦・2〜4人ローカル・オンライン対戦）の実装を引き継ぎます。回答/UIは日本語。
作業ディレクトリ: c:\Users\b1242\claude\game\dominion / branch: main（main直接作業運用。最新は git log で確認）。

## まずやること
1. `Set-Location 'C:\Users\b1242\claude\game\dominion'` して `npm test` → **32スイート・オールグリーン（exit 0・整合性3144件・帝国140件）**を確認。
2. `PROGRESS.md` の §0-14（帝国 段階2＝Batch E5 完了・次はE6）と §0-13（E4）・§0-12〜0-10（E3〜E1）・§5・§6 を読む。**帝国の設計正本＝`docs/research/empires_rules.md`**（公式ルール裏取り＋6機構＋バッチ計画）。全体設計図＝`docs/adding-cards.md`。

## 現状：帝国（Empires）段階2＝Batch E1〜E5（負債／単独9枚／集合／分割山5組／城8）すべて完了・push済＝本番反映
- **Batch E5 完了**＝城8種を1つの混合山 `state.castles`（knights 流用・昇順に積む・一番上だけ購入/獲得・2人8枚/3-4人12枚）＋可変VP（humble=城数／kings=城数×2・自身含む全城）＋各on-gain/on-trash を実装。詳細＝PROGRESS §0-14。`sw.js` v41。`test/empires.test.js` を全140件に拡張。**カタログ/webp変更なし**（研究WFで全8枚のカタログ＝公式一致・humble_castle に coin:1 のみ追加）。integrity 3134→**3144**（'castles' プレースホルダ card ぶん）。
- 敵対レビュー（6次元→node再現）＝確定バグ1件修正：**gainer（remodel/工房等の *_GAIN）経由で sprawling/haunted を獲得すると獲得時効果が発火しない**（finishGain の gain() 時点で自分の pending が残り `!state.pending` ゲートに引っかかる）→**新 `state.onGainQueue`（onTrashQueue 同型）に城の獲得時対話を積み reduce 末尾で発火**（border_village 等の !pending 簡略化は温存）。knights 回帰なし。
- **帝国はまだ CARD_SET 未昇格＝本番挙動は不変**（帝国カードはサプライに出ない）。**E1〜E5すべて push 済（HEAD==origin/main）**。未pushの作業は無し＝クリーンな状態からE6着手可。

## 次に取り組むタスク（優先順1位）：帝国 Batch E6（命令＝overlord/crown）＝帝国 最後の新機構
- `docs/research/empires_rules.md` §1-5：**overlord**（負債d8・**band_of_misfits/captain 流用**＝`captainTargets`/`bandOfMisfitsTargets` 型。サプライのコスト5以下・非命令アクションを、サプライに残したまま使う・自己移動系は removeOne 失敗で自然不発・持続は対象外＝船長と同じ簡略化）／**crown**（$5・action+treasure・**玉座同型 `state.replay` 1件push**だが現在フェイズで対象種別が変わる＝アクションフェイズ→手札のアクション1枚を2回／購入フェイズ→手札の財宝1枚を2回・アクション権は消費しない）。
- その後 **E7＝Phase E＝CARD_SET昇格**（`DOM.KINGDOM_EMPIRES` 固定10種＋`empires`/`random-empires`）＝**ここで初めて本番に帝国が出る**。横型ランドスケープ（イベント/ランドマーク）は縦枠パイプライン未対応で対象外。

## 守るべき進め方・流儀
- **新pendingは必ず4点セット**（engine reducer＋PLAYER_ACTIONS登録＋CPU decidePending＋UI viewPendingModal）＋終端保証。持続は armDuration/DURATION_RESOLVERS/startQueue安全網、命令は state.replay。
- **新しく「≤$N/ちょうど$N/相手に獲得させる」系の獲得を足す/触るときは `!NON_SUPPLY.has(id)` と（帝国では）`!(C()[id].debt>0)` を engine述語と CPU bestGain の両側に入れる**（片側だけだと「engine拒否×CPU再提案＝無限ループ」）。
- **1枚実装/変更ごとに**：狙い撃ち一時テスト（プロジェクト直下 `_*.tmp.js`＝.gitignore済・実行後**必ず削除**。cwdがずれるので実行前に Set-Location）→ `node test/invariants.test.js` 緑 → `npm test` 全32緑 → コミット。回帰は `test/empires.test.js` に足す。大きな決定は PROGRESS.md に追記。
- **substantiveなタスクは Workflow で多エージェント＋敵対的検証**。CONTEXT文字列にバックティックを入れない（テンプレートリテラルが壊れる）。ソークのデッドロック検出は pending の完全JSONを比較。**レビューエージェントは同名 `_*.tmp.js` を作りうる**（自分の一時テストが上書きされ得る＝恒久テストは test/empires.test.js に置く）。公式ルールが曖昧なら研究エージェントで wiki/RGG 裏取り（wiki.dominionstrategy.com はボット保護でWebFetch不可＝WebSearch と ultraboardgames/fandom を使う）。
- client資産（js/css/webp等）を変えたら `sw.js` の VERSION を上げる（現在 v41）。回答は日本語・フランクに短く。**push は勝手にしない＝完成→全テスト緑→都度ユーザー確認の上で**。

## 次セッションが知らないと事故る事項（必読）
- **未pushコミットは無し（HEAD==origin/main）**。この handoff コミットも push すること（push は必ずユーザー確認）。帝国は CARD_SET 未昇格＝**本番挙動は不変**（帝国カードはサプライに出ない）。
- **混合山の正本＝gain の `isMixed`（ruins/knights/castles）＋ state.ruins/knights/castles**。新しい混合山は knights/castles を雛形に（cardCost/emptyPileCount/mask/invariants tally/闇市場除外/CPU GAIN_ORDER）。**gainer（*_GAIN）経由の獲得で on-gain 対話が要る効果は `state.onGainQueue` に積む**（finishGain の pending 中は !pending ゲートで抑止されるため＝E5レビューの教訓）。
- **分割山の正本＝`DOM.SPLIT_PILES`（cards.js）**。新しい分割山を足すときはここに1行足すだけで gain/canBuyCard/emptyPileCount/CPU 等が自動対応する。**新しい「ちょうど$N獲得」系を足す/触るときは `!splitLocked(state,id)` も述語に入れる**（E4レビューのデッドロック回避＝`!NON_SUPPLY.has(id)`/`!(debt>0)` と同じ要領）。
- **意図的な据え置き（§0-10・§6）**：workshop等の汎用「≤$N獲得」reducer は負債カードを除外していない。どの出荷セットでも負債カードと汎用gainerは同居せず（mix-allセット無し）＋fuzzはCPU駆動でbestGainが負債カードを提案しないため到達不能。将来 mix-allモード時に共通ヘルパへ集約（ポーション費用問題と一緒に）。**再修正しなくてよい**。
- **reduce は state を clone して新stateを返す**（破壊的でない）＝テストは必ず `s = reduce(s, a)` と再代入。狙い撃ちで state を手組みするとき init tally は「手札/山札を上書きした後」に取る。
- **手番タイミングの罠**：cleanupAndAdvance が「自分の手番終了時に自分の次の手札を先引き(draw5)」してから次Pへ。持続の手番開始効果は手番が戻った時に発火。capital の負債は cleanup で発火（残コインから即返済）。
- **Read出力の汚染に注意**：実在しないコード/コメントが混入して見えることがある。断定前に Grep・`git show`・`Get-Content` で裏取り。
