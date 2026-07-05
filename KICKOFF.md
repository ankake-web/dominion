<!-- /handoff が自動生成（2026-07-05）。新セッションはこのファイルの指示に従う。手編集不要 -->

ウルトラコード（最大エフォート）で進めてください。

スマホ向けドミニオン対戦Webアプリ（CPU戦・2〜4人ローカル・オンライン対戦）の実装を引き継ぎます。回答/UIは日本語。
作業ディレクトリ: `c:\Users\b1242\claude\game\dominion` / branch: `main`（main直接作業運用。最新は `git log` で確認。**未pushのWIPコミットあり＝push はユーザー確認必須**）。

## まずやること（着手前の健全性確認）
1. `Set-Location 'C:\Users\b1242\claude\game\dominion'` して `npm test` → **27スイート・オールグリーン（exit 0）**・整合性 **3130件** を確認。
2. `PROGRESS.md` の **§0-8（暗黒時代の現在地・決定事項・設計要点・次の一歩）** を読む。§5/§6 も。
3. 実装するカードは都度 **`docs/research/darkages_rules.json`**（現行英文/エラッタ/裁定の正本）で裏取り。`docs/research/darkages_catalog_diff.md`・`docs/adding-cards.md`（特殊山は§C）も参照。

## 今回のタスク（優先順1位）：段階2＝暗黒時代56枚の実プレイ化【続き・カード効果の残り32枚から】
**済んでいるのは**（今セッション分＝未pushコミット）: (a)trashCard統一関数＋on-trash第2層配線 (b)基盤機構＝混合山（**騎士=supply.knights＋state.knights／廃墟=state.ruins配列のみ**）・非サプライ3種・避難所（opts.shelters）・initSupply条件節・invariants tally (c)カード効果24/56枚＝単純15＋対話9（engine reducer＋PLAYER_ACTIONS＋CPU decidePending の4点セット。**UIは未**）。

**残り＝カード効果32枚＋UI＋テスト＋昇格**。続きの順序（詳細は PROGRESS §0-8「次の一歩」）:
1. **カード効果の残り32枚**：素直なpending（屑屋/秘術師/墓暴き/地下墓所/建て直し）→ アタック（略奪者/狂信者/略奪/傭兵/浮浪児/盗賊）→ **騎士10種**（混合山アタック）→ 複雑（伯爵/はみだし者=命令/隠遁者=交換/death_cart=on-gain廃墟/catacombs・hunting_groundsのon-trash対話/counterfeit/altar）。**各カード engine reducer＋PLAYER_ACTIONS＋CPU decidePending の4点セット必須**（UIは次段でまとめて）。各グループ末で `node test/invariants.test.js`（全プール混成fuzz）緑を確認。
2. **UI**（ui.js `viewPendingModal` に新pending分岐＋混合山topの盤面表示）。
3. **darkages.test.js / darkages-ui.test.js 新設**（経路別on-trashテスト必須＝城塞×礼拝堂/狂信者×死の荷車/封土×騎士）。
4. **CARD_SET昇格**（DOM.CARD_SETS に darkages固定10種＋random-darkages。darkagesにだけ `opts.shelters=true` を渡す）→ 全テスト緑。
5. 敵対レビューWorkflow→確定バグ修正→CPUソーク → **webp9枚再生成**（hermit/procession/pillage/death_cart/rats/counterfeit/marauder/cultist/band_of_misfits＝このPCのみ可）→ sw.js v34→v35 → PROGRESS更新 → コミット（**pushはユーザー確認**）。

## 進め方（厳守）
- **新pendingは engine reducer＋PLAYER_ACTIONS＋CPU decidePending＋UI viewPendingModal の4点セット必須**（漏れ＝CPU無限ループ/人間詰み/サーバ拒否/整合性赤）。「捨て→次へ」型reducerは前進前に `state.pending=null`。
- **非サプライ獲得は engine拒否とCPU非提案を必ずセット**（CPU側は `NON_SUPPLY_SET`＝賞品＋spoils/madman/mercenary を汎用獲得から除外済み。新カードで獲得系を書くときも守る）。
- **経路別on-trashテスト必須**（保存則fuzzは「城塞がtrashに残ったまま」を検知できない）。
- substantiveなタスクは Workflow で多エージェント＋敵対的検証。使い捨てスクリプトは直下 `_*.tmp.js` で作り実行後必ず削除。
- 1機構/1グループごとに fuzf・テスト緑→こまめにコミット。大きな決定は PROGRESS.md へ。作業の区切りで「今やったこと/次にやること」報告。容量が重くなったら /handoff を促す。

## 次セッションが知らないと事故る事項
- **未pushコミット多数**（今セッションのtrashCard＋基盤＋カード効果24枚＝5コミット＋以前の2つ。`git log`/`git status -sb` で確認。push はユーザー確認必須）。作業ツリーは clean のはず。**CARD_SET未昇格なので本番/実プレイへの影響はゼロ**。
- **混合山の非対称**＝騎士は `supply.knights`（数値）＋`state.knights`（配列）、**廃墟は `state.ruins`（配列）のみ**（`'ruins'`はカタログ非在＝supplyに持つとCPU/UIのsupply走査が `C()['ruins']` で落ちる）。この設計は変えない。新カードで廃墟を配るときは `gain(pi,'ruins')`、騎士は `gain(pi,'knights')`。
- **squireのon-trash（アタック獲得）は `!state.pending` ガードの簡略実装**（複数on-trash同時競合は先着のみ＝許容簡略化。catacombs/hunting_groundsのon-trash対話はまだ未実装）。
- **Read ツール出力の汚染を前セッションで観測**（実在しないコードが混入して見えた）。実装状態を断定する前に Grep / `Get-Content` / `git show` の生バイト確認で裏取りすること。
- カタログ文言だけ現行化済み＝**webp画像の文字と9枚で不一致**（上記リスト）。昇格前に再生成必須（このPCのみ可）。
- 避難所ON/OFF・on-trash方針・許容簡略化・経路別テスト方針は**決定済み（PROGRESS §0-8）＝再議論しない**。
