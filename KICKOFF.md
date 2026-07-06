<!-- /handoff が自動生成（2026-07-06）。新セッションはこのファイルの指示に従う。手編集不要 -->

ウルトラコード（最大エフォート）で進めてください。

スマホ向けドミニオン対戦Webアプリ（CPU戦・2〜4人ローカル・オンライン対戦）の実装を引き継ぎます。回答/UIは日本語。
作業ディレクトリ: `c:\Users\b1242\claude\game\dominion` / branch: `main`（main直接作業運用。最新は `git log` で確認）。

## まずやること（着手前の健全性確認）
1. `Set-Location 'C:\Users\b1242\claude\game\dominion'` して `npm test` → **29スイート・オールグリーン（exit 0）** を確認。
2. `PROGRESS.md` の **§0-9（冒険 段階2・着手中＝今の作業。設計事実と残り着手順が全部ここ）** と §5、§6 を読む。設計図＝`docs/adding-cards.md`。

## 現状：冒険（Adventures）段階2 ＝ 着手中（8/38枚・未pushコミット多数）
- 前セッションで冒険の単純カード＋純粋な持続 計8枚を実プレイ化（港町/失われし都市/カササギ/掘出物/雇人/地下牢/道具/魔除け）。各バッチ＝全プール混成fuzf緑＋狙い撃ちテスト＋全29スイート緑でコミット済み。詳細は PROGRESS §0-9。
- **冒険はまだ CARD_SET 未昇格＝通常プレイに出ない**（fuzz でのみ実行）。だから main にあっても本番挙動は不変。**push は未実施＝完成→CARD_SET昇格→レビュー後に都度ユーザー確認**（勝手に push しない）。

## 次にやること（優先順＝PROGRESS §0-9 の「残り」）
1. **Batch3＝トークン基盤＋トークン系カード**：旅トークン(`p.journeyDown`)・-$1トークン・-1カードトークン → ranger/giant/relic/bridge_troll。giant/relic/bridge_troll はアタック＝ATTACKS登録＋堀リアクション窓（marauder/witch型がコピー元）。
2. Batch4＝酒場マット/Reserve 基盤＋Reserve 9枚 → Batch5＝トラベラー → Batch6＝複雑4枚 → Phase E（CARD_SET昇格＋テスト＋敵対レビュー＋webp確認＋sw.js v36）。
3. その後＝帝国（Empires）段階2（別の大仕事）。

## 進め方（厳守）
- **冒険/帝国は invariants の全プール混成fuzz が引く**＝1枚実装した瞬間から「engine reducer＋PLAYER_ACTIONS＋CPU decidePending＋UI viewPendingModal の4点セット＋新pendingの終端保証＋新ゾーンの保存則tally配線」が必須（漏れ＝fuzz赤/CPU無限ループ/人間詰み）。**新ゾーンを足したら `test/invariants.test.js` の `ZONES` にも追加**（例：酒場マット `tavern`）。
- **1バッチ（機構が同種のカード群）ごとに**：狙い撃ち一時テスト（`_*.tmp.js`・実行後必ず削除）→ `node test/invariants.test.js` 緑 → `npm test` 全29緑 → コミット。大きな決定は PROGRESS.md へ。
- substantiveなタスクは Workflow で多エージェント＋敵対的検証（前拡張もこれで確定バグを検出）。使い捨てスクリプトは直下 `_*.tmp.js` で作り実行後**必ず削除**（コミットに混ぜない）。
- 財宝の実プレイ化は `coin:` を cards.js に追加（表示不変＝webp再生成不要）。client資産を変えたら `sw.js` VERSION を上げる（現在 **v35**）。webp再生成はこのPCのみ可。

## 次セッションが知らないと事故る事項
- **未pushコミット多数**（冒険 Batch1a/2/2b＋docs）。本番は暗黒時代まで（v35）。push は完成後に必ずユーザー確認。
- **手番タイミングの罠**：このエンジンは「自分の手番終了時に自分の次の手札を先引き(draw5)」し、**持続の「手番開始時」効果は手番が戻った時に発火**して先引き済み手札に加算する。テストで開始時効果を見るなら END_TURN 1回では足りない（相手を回して自分の手番へ戻す）。
- **-$1トークンは coins を負にしない**＝`max(0,coins-1)`（invariants の負リソース検査に抵触させない）。適用：-$1=購入フェイズ開始／-1カード=cleanupの次手札drawを1減／旅=`p.journeyDown`真偽。
- **Read ツール出力の汚染に注意**（実在しないコードが混入して見えることがある）。実装状態を断定する前に Grep / `git show` の生確認で裏取り。
- 暗黒時代の避難所自動判定・reshuffleDeckのappend方式（§0-8末/§6）など、既存の不変は壊さない。
