<!-- /handoff が自動生成（2026-07-05）。新セッションはこのファイルの指示に従う。手編集不要 -->

ウルトラコード（最大エフォート）で進めてください。

スマホ向けドミニオン対戦Webアプリ（CPU戦・2〜4人ローカル・オンライン対戦）の実装を引き継ぎます。回答/UIは日本語。
作業ディレクトリ: `c:\Users\b1242\claude\game\dominion` / branch: `main`（このプロジェクトは main で直接作業する運用。最新コミットは `git log` で確認）。

## まずやること（着手前の健全性確認）
1. `Set-Location 'C:\Users\b1242\claude\game\dominion'` して `npm test` を実行し、**27スイート・オールグリーン（exit 0）** を確認する。
   想定件数の目安＝整合性3122件・新プロモ141件＋UI22件・異郷83件＋UI44件・収穫祭107件・ギルド81件＋UI25件・CPU序列（強vs弱100 / 強vs普通64 / 普通vs弱95）。
2. `PROGRESS.md` を読む（**§0-7=新プロモ段階2の記録**／§5=段階2の着手順・優先タスク／§6=注意点・4系統除外チェックリスト・許容簡略化）。
3. `docs/adding-cards.md` を読む（段階2の実装設計図＝全機構の file:line＋コピー元＋落とし穴。**特殊山は §C**。分割山/「動かさず使用」/永続持続/startQueue安全網/シャッフル介入は §0-7 追加分）。

## 今回のタスク（優先順1位）：段階2＝暗黒時代を全56に完成（実プレイ化）
- 段階2の着手順は 収穫祭✅→ギルド✅→異郷✅→新プロモ✅→**【暗黒時代】**（段階2の最後の大物）。完全忠実／簡略化しない。
- **暗黒時代のカタログ・GAIN_ORDER・webp は既に全部ある**（§0-3/§0-6・段階1完了）＝`DOM.POOLS.darkages`35種＋`knights`10＋`ruins`5＋`shelters`3＋`darkages_np`3。**未実装なのは engine効果／pending／CPU decidePending・chooseAction・chooseBuy／UI viewPendingModal／CARD_SET昇格 だけ**。
- **新設が要る大物機構**（詳細は PROGRESS §5-1 と docs/adding-cards.md §C）：
  - **混合山**（廃墟Ruins/騎士Knights＝中身と順序が違う）＝`state.ruins`/`state.knights` を top-level id配列に（blackMarket型）。**invariants.test.js の tally に forEach 追加必須**（漏れると保存則が誤検知で赤）。emptyPileCount に明示加算・maskで伏せる。
  - **避難所Shelters**（開始デッキ置換）＝createInitialState の開始 estate を条件で hovel/necropolis/overgrown_estate に。
  - **戦利品/狂人/傭兵**（非サプライ数値キー山）＝**§6「4系統除外チェックリスト」必須**（emptyPileCount・canBuyCard・blackMarket母集団・CPU bestGain/bestGainExact の全てから除外）。
  - **on-trashフック**（要塞=廃棄で手札に戻る 等）＝異郷の `triggerOnTrash` を拡張・本人任意廃棄に限定。略奪者の廃墟配布アタック・建て直し/伯爵の多段選択。
- 良いコピー元＝収穫祭の賞品Prizes山（非サプライ数値キー）・ギルド/異郷の各pending機構・§0-7の分割山/混合山ノウハウ。**1機構ずつ完成→npm test緑→敵対レビュー→コミット**、最後に CARD_SET 昇格。

## 進め方（厳守）
- **新pendingは engine reducer＋PLAYER_ACTIONS＋CPU decidePending＋UI viewPendingModal の4点セット必須**（漏れ＝CPU無限ループ/人間詰み/サーバ拒否/整合性赤）。新 `*_RESOLVE` は大文字・`GAIN_ORDER`網羅・`sw.js` VERSION更新も忘れない。
- 「捨て→triggerOnDiscard→次へ」型 reducer は前進前に必ず `state.pending=null`（異郷で無限ループ3件踏んだ罠）。
- 必須獲得(finishGain型)は候補ゼロで辞退でき、CPUの `bestGain` フォールバック（`|| bestGain(...)`＝呪い含む版）を兄弟カードと揃える。gain() が拒否し得るカード（分割山等）は finishGain が戻り値検証する（§0-7）。
- **substantiveなタスクは Workflow で多エージェント＋敵対的検証**（公式ルール研究→実装→npm test緑→敵対レビュー→確定バグ修正→コミット）。使い捨てスクリプトは直下 `_*.tmp.js` か scratchpad に作り実行後必ず削除。
- 完成・CARD_SET昇格・全テスト緑まで済んだら **push（本番デプロイ）は都度ユーザー確認の上で**。大きな決定は PROGRESS.md に追記。作業の区切りで「今やったこと/次にやること」を報告。容量が重くなったら /handoff を促す。

## 次セッションが知らないと事故る事項
- **未pushコミットは無し**（新プロモ段階2は `5150017`＋`078d361` で本番デプロイ済み・`sw.js` v34 配信確認済み）。作業ツリーは clean のはず（`git status` で確認）。
- **GitHub Pages のデプロイは稀に `Deployment failed, try again later.` になる**（インフラ一時障害）が、次のpushで自動回復する（今回も 5150017 が failure→078d361 が success で反映）。慌てず gh run で次の成功を待つ。
- **闇市場デッキに「段階1のみ（engine未実装）のプール」が混ざる既存問題**（§6）＝暗黒時代を段階2化すると darkages プールが playable になり自然解消に近づく。ただし非サプライ札（戦利品/狂人/傭兵/騎士/廃墟/避難所）は4系統チェックリストを必ず通すこと。
- 錬金術アート△3枚（変成/薬草商/薬剤師）の最終確認は任意・優先度低（PROGRESS §5-2）。
