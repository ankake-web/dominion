<!-- /handoff が自動生成（2026-07-08）。新セッションはこのファイルの指示に従う。手編集不要 -->

ウルトラコード（最大エフォート）で進めてください。

スマホ向けドミニオン対戦Webアプリ（CPU戦・2〜4人ローカル・オンライン対戦）の実装を引き継ぎます。回答/UIは日本語。
作業ディレクトリ: c:\Users\b1242\claude\game\dominion / branch: main（main直接作業運用。最新は git log で確認）。

## まずやること
1. `Set-Location 'C:\Users\b1242\claude\game\dominion'` して `npm test` → **32スイート・オールグリーン（exit 0・整合性3134件・帝国95件）**を確認。
2. `PROGRESS.md` の §0-12（帝国 段階2＝Batch E3 完了・次はE4）と §0-11（E2）・§0-10（E1）・§5・§6 を読む。**帝国の設計正本＝`docs/research/empires_rules.md`**（公式ルール裏取り＋6機構＋バッチ計画）。全体設計図＝`docs/adding-cards.md`。

## 現状：帝国（Empires）段階2＝Batch E1（負債）＋E2（既存VPトークン&単独9枚）＋E3（集合）まで完了
- **Batch E3 完了**＝集合機構 `state.pileVP`（サプライ山上のVPトークン・公開・非カード・共有累積）＋**temple/farmers_market/wild_hunt** を4点セットで実装（詳細＝PROGRESS §0-12）。`sw.js` v38→**v39**（js/css変更）。`test/empires.test.js` を全95件に拡張。**カタログ/webp変更なし**（研究WFで全3枚のカタログ＝公式一致を確認）。
- 敵対レビュー（5次元→node再現）＝確定バグ1件修正（temple_trash のUIソフトロック＝同一ターンに神殿の廃棄が2回開くと `UI.selection` の幽霊選択が外せず詰む→モーダル先頭で手札にある名前だけに間引く）。出荷帝国セット未昇格のため本番未到達。
- **帝国はまだ CARD_SET 未昇格＝本番挙動は不変**（帝国カードはサプライに出ない）。**E1＋E2は push 済**（sw.js v38）。その上に **Batch E3＋この handoff が未push**。

## 次に取り組むタスク（優先順1位）：帝国 Batch E4（分割山5組）
- `docs/research/empires_rules.md` §1-3/§2 の分割山＝**sauna/avanto と同型**（分割山ガード4系統：`gain()`冒頭/`canBuyCard`/`emptyPileCount`ペアで1山/CPU `splitBlocked`）。5組＝encampment/plunder・patrician/emporium・settlers/bustling_village・catapult/rocks・gladiator/fortune。**上下でコストが違う**点だけ sauna/avanto（両$4）と異なる（cardCost はカード固有でOK）。`DOM.randomKingdom` は下→上に正規化、createInitialState で相互補完。
- 依存注意：fortune は負債(E1)＋剣闘士on-gain金貨、emporium は on-gain +2VP(場アクション5枚以上・E2のvpTokens使用)、rocks は on-gain/trash銀貨、catapult はアタック(手札1廃棄→コスト3以上で呪い/財宝で手札3捨て)、encampment は非公開でサプライへ返却。
- 以降の順：E5城8(knights混合山流用)→E6命令(overlord/crown)→E7=CARD_SET昇格。

## 守るべき進め方・流儀
- **新pendingは必ず4点セット**（engine reducer＋PLAYER_ACTIONS登録＋CPU decidePending＋UI viewPendingModal）＋終端保証。持続は armDuration/DURATION_RESOLVERS/startQueue安全網、命令は state.replay。
- **新しく「≤$N/ちょうど$N/相手に獲得させる」系の獲得を足す/触るときは `!NON_SUPPLY.has(id)` と（帝国では）`!(C()[id].debt>0)` を engine述語と CPU bestGain の両側に入れる**（片側だけだと「engine拒否×CPU再提案＝無限ループ」）。
- **1枚実装/変更ごとに**：狙い撃ち一時テスト（プロジェクト直下 `_*.tmp.js`＝.gitignore済・実行後**必ず削除**。cwdがずれるので実行前に Set-Location）→ `node test/invariants.test.js` 緑 → `npm test` 全32緑 → コミット。回帰は `test/empires.test.js` に足す。大きな決定は PROGRESS.md に追記。
- **substantiveなタスクは Workflow で多エージェント＋敵対的検証**。CONTEXT文字列にバックティックを入れない（テンプレートリテラルが壊れる）。ソークのデッドロック検出は pending の完全JSONを比較。**レビューエージェントは同名 `_*.tmp.js` を作りうる**（自分の一時テストが上書きされ得る＝恒久テストは test/empires.test.js に置く）。公式ルールが曖昧なら研究エージェントで wiki/RGG 裏取り（wiki.dominionstrategy.com はボット保護でWebFetch不可＝WebSearch と ultraboardgames/fandom を使う）。
- client資産（js/css/webp等）を変えたら `sw.js` の VERSION を上げる（現在 v39）。回答は日本語・フランクに短く。**push は勝手にしない＝完成→全テスト緑→都度ユーザー確認の上で**。

## 次セッションが知らないと事故る事項（必読）
- **未pushコミットあり**（Batch E3＋この handoff。E1/E2は push 済）。push は必ずユーザー確認。帝国は CARD_SET 未昇格＝**本番挙動は不変**（帝国カードはサプライに出ない）。
- **意図的な据え置き（§0-10・§6）**：workshop等の汎用「≤$N獲得」reducer は負債カードを除外していない。どの出荷セットでも負債カードと汎用gainerは同居せず（mix-allセット無し）＋fuzzはCPU駆動でbestGainが負債カードを提案しないため到達不能。将来 mix-allモード時に共通ヘルパへ集約（ポーション費用問題と一緒に）。**再修正しなくてよい**。
- **reduce は state を clone して新stateを返す**（破壊的でない）＝テストは必ず `s = reduce(s, a)` と再代入。狙い撃ちで state を手組みするとき init tally は「手札/山札を上書きした後」に取る。
- **手番タイミングの罠**：cleanupAndAdvance が「自分の手番終了時に自分の次の手札を先引き(draw5)」してから次Pへ。持続の手番開始効果は手番が戻った時に発火。capital の負債は cleanup で発火（残コインから即返済）。
- **Read出力の汚染に注意**：実在しないコード/コメントが混入して見えることがある。断定前に Grep・`git show`・`Get-Content` で裏取り。
