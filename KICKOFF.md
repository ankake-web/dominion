<!-- /handoff が自動生成（2026-07-05）。新セッションはこのファイルの指示に従う。手編集不要 -->

ウルトラコード（最大エフォート）で進めてください。

スマホ向けドミニオン対戦Webアプリ（CPU戦・2〜4人ローカル・オンライン対戦）の実装を引き継ぎます。回答/UIは日本語。
作業ディレクトリ: `c:\Users\b1242\claude\game\dominion` / branch: `main`（main直接作業運用。最新は `git log` で確認。**未pushのWIPコミットあり＝push はユーザー確認必須**）。

## まずやること（着手前の健全性確認）
1. `Set-Location 'C:\Users\b1242\claude\game\dominion'` して `npm test` → **27スイート・オールグリーン（exit 0）** を確認。整合性は **3130件**（暗黒時代カタログ現行化ぶん+8を含む）。
2. `PROGRESS.md` の **§0-8（暗黒時代の現在地・決定事項・設計要点・次の一歩）** を読む。§5/§6 も。
3. `docs/research/darkages_catalog_diff.md`（差分レポート）に目を通し、実装中は **`docs/research/darkages_rules.json`**（55枚の現行英文・エラッタ・裁定の正本）を都度参照する。
4. `docs/adding-cards.md`（実装設計図。特殊山は§C）。

## 今回のタスク（優先順1位）：段階2＝暗黒時代56枚の実プレイ化【続き・基盤機構から】
済んでいるのは (a)公式ルール研究（docs/research/ に保存済み） (b)カタログ現行化（エラッタ6枚＋looter/command種別） (c)triggerOnTrash自動系6枚（城塞/ネズミ/草茂る屋敷/封土/サー・ヴァンダー/狂信者）だけ。**基盤機構は未着手**。続きの順序（詳細は PROGRESS §0-8「次の一歩」）:
1. **`trashCard(state, owner, card)` 統一関数新設＋on-trash第2層配線**＝既存reducerの「本人の手札/デッキ任意廃棄」と「アタック廃棄（owner=被害者）」だけを寄せる（25〜30箇所・**1箇所ずつ npm test**）。lurker/自己廃棄札/possessed_trash_marker/cleanup一括は寄せない（許容簡略化＝決定済み）。
2. **基盤機構**：混合山（`supply.ruins/knights`数値＋`state.ruins/knights`配列の二重持ち・**invariants tally に forEach 追加必須**・maskは先頭1枚だけ公開・cardCost('knights')=山の一番上）／非サプライ3種（NON_SUPPLYに追加→4系統除外が自動）／避難所（**固定darkagesセットのみON**）／initSupply（rats20・廃墟10×(人数-1)・騎士10・spoils15・madman10・mercenary10）。
3. カード効果（単純→pending→アタック→複雑）→ CPU decidePending/chooseAction/GAIN_ORDER再配置 → UI viewPendingModal＋混合山top表示 → darkages.test.js/darkages-ui.test.js 新設 → **完成してから CARD_SET昇格**（darkages＋random-darkages）。
4. 敵対レビューWorkflow→確定バグ修正→CPUソーク → **webp9枚再生成**（テキスト/種別を変えた hermit/procession/pillage/death_cart/rats/counterfeit/marauder/cultist/band_of_misfits）→ sw.js v34→v35 → PROGRESS更新 → コミット（**pushはユーザー確認**）。

## 進め方（厳守）
- **新pendingは engine reducer＋PLAYER_ACTIONS＋CPU decidePending＋UI viewPendingModal の4点セット必須**（漏れ＝CPU無限ループ/人間詰み/サーバ拒否/整合性赤）。「捨て→次へ」型reducerは前進前に `state.pending=null`。
- **経路別on-trashテスト必須**（保存則fuzzは「城塞がtrashに残ったまま」を検知できない）：城塞×礼拝堂／狂信者×死の荷車／封土×騎士 等。
- substantiveなタスクは Workflow で多エージェント＋敵対的検証。使い捨てスクリプトは直下 `_*.tmp.js` で作り実行後必ず削除。
- 1機構ごとに npm test 緑→こまめにコミット。大きな決定は PROGRESS.md へ。作業の区切りで「今やったこと/次にやること」報告。容量が重くなったら /handoff を促す。

## 次セッションが知らないと事故る事項
- **未pushコミットあり**（暗黒時代WIP＋handoff。`git status -sb` で確認。push はユーザー確認必須）。作業ツリーは clean のはず。**CARD_SET未昇格なので本番/実プレイへの影響はゼロ**。
- **Read ツール出力の汚染を前セッションで観測**（実在しないコードが混入して見え「基盤実装済み」と誤認しかけた）。実装状態を断定する前に **Grep / `Get-Content` / `git show` の生バイト確認**で裏取りすること。
- カタログ文言だけ現行化済み＝**webp画像の文字と9枚で不一致**（上記リスト）。昇格前に再生成必須（このPCのみ可）。
- 避難所ON/OFF・on-trash 3層方針・許容簡略化（lurker等）・経路別テスト方針は**決定済み（PROGRESS §0-8）＝再議論しない**。
