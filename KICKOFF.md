<!-- /handoff が自動生成（2026-07-11）。新セッションはこのファイルの指示に従う。手編集不要 -->

ウルトラコード（最大エフォート）で進めてください。

スマホ向けドミニオン対戦Webアプリ（CPU戦・2〜4人ローカル・オンライン対戦）の実装を引き継ぎます。回答/UIは日本語。
作業ディレクトリ: c:\Users\b1242\claude\game\dominion / branch: main（main直接作業運用。最新は git log で確認）。

## まずやること
1. `Set-Location 'C:\Users\b1242\claude\game\dominion'` して `npm test` → **35スイート・オールグリーン（exit 0・整合性3147・不変条件5・帝国269＋UI68・ランドマーク80・帝国イベント34（events）・冒険59＋UI40・暗黒時代87＋UI57・新プロモ165＋UI22・繁栄69・異郷83＋UI44・収穫祭107・ギルド81＋UI25・CPU序列 強vs弱100/強vs普通64/普通vs弱95）** を確認。
2. `PROGRESS.md` 先頭サマリ＋**§0-20（帝国イベント・EV0/EV1 完了）**を読む。横型の設計正本＝`docs/research/landscape_cards.md`（§2 カード定義／§3 機構分類／§4 重量ランキング）＋`docs/research/landscape_gaps.md`。全体設計図＝`docs/adding-cards.md`。

## 現状：横型ランドスケープ第2弾＝帝国イベント13種に着手（EV0/EV1 完了・未push・ローカルcommit `8caabc0`）
- **EV0＝共通基盤 完了**：13イベントを `DOM.LANDSCAPES`（`kind:'event'`）＋`DOM.EVENTS_EMPIRES`＋`DOM.eventsForSet`。engine に `state.events` スロット＋`hasEvent`＋**`BUY_EVENT` reducer**（購入フェイズ・購入権1消費・イベント自体は獲得しない・複数回可・**負債>0では買えない**・**コスト軽減を受けない**・負債コストは `p.debt+=`）＋`applyEventEffect`。`PLAYER_ACTIONS` 登録済み。
- **EV1＝簡単10種 完了**：delve/wedding/dominate/windfall/conquest/triumph（pending無し・「今ターン獲得数」は既存 `t.gainedThisTurn` 流用＝新カウンタ不要）＋salt_the_earth/banquet/advance/ritual（新pending4種＝4点セット完備）。CPU用 `firstGainable`/`plainCoin` 新設。UI＝盤面イベント帯（買う横型・購入ボタン）＋拡大の種別/コスト表示。
- **検証**：`test/events.test.js` 新設34件（35スイート目）＋`empires-ui` 60→68件。**ランドマーク21種（§0-19）は絵ごと push 済（本番 v46 反映確認済）**。

## 次に取り組むタスク（優先順1位）：EV2 → EV3
1. **EV2＝重量イベント3種**（`docs/research/landscape_cards.md` §3-2/§3-3/§3-9）：
   - **tax**：新 `state.pileDebt`（`state.pileVP` と同型の公開マップ・非カード・maskで残す）。準備で全サプライ山に負債1、tax購入で山を1つ選び+2。**購入フェイズの獲得**（`gainWasBuyPhase`）でその山の負債を全部 `p.debt` へ。UIに負債バッジ。
   - **donate**（負債8）：次ターン開始時（他の開始時効果より前）にデッキ＋捨て札を全部手札へ→任意枚数廃棄→残りをシャッフルして5枚引く（通常ドロー置換）。`DURATION_RESOLVERS`/`startQueue` に予約。**タイミングがエラッタの主因＝繊細**。
   - **annex**（負債8）：捨て札を見て最大5枚残し他を `reshuffleDeck` で山札へ→公領獲得。
   各 4点セット（engine reducer＋PLAYER_ACTIONS＋CPU decidePending＋UI viewPendingModal）＋終端保証。
2. **EV3＝CARD_SET昇格**：`DOM.CARD_SETS` に `empires-events`（`kind:'standard'`・`kingdom:DOM.KINGDOM_EMPIRES`・`eventsFrom:'empires'`）。ui/server の startGame で `DOM.eventsForSet` を landmarks と同様に確定・共有（`opts.events`）。UI picker に出す（`test/ui.test.js` が守る）。**CPUのイベント購入評価 `bestEventBuy` を実装**（現状CPUはイベントを買わない＝購入AIが要る）。CPUソーク＋敵対レビュー（多エージェント・各finding node再現）＋invariants に empires-events 追加。任意で event webp（`build-landscape.js` は event スキン対応済）。→ **ユーザー確認の上で push**（`sw.js` VERSION を上げる／現 v46）。

## 守るべき進め方・流儀
- **新pendingは必ず4点セット**（engine reducer＋PLAYER_ACTIONS＋CPU decidePending＋UI viewPendingModal）＋終端保証。無いとCPU無限ループ／人間詰み。
- **「≤$N/相手に獲得」系は engine述語とCPU候補選び（`firstGainable`/`bestGain` 等）の両側に `!NON_SUPPLY`・`!splitLocked`・`costIsPlainCoin`（CPUは `plainCoin`）を入れる**（片側だけだと無限ループ）。
- **イベントは「カード」でない**＝コスト軽減（橋/街道）を受けず、購入時トリガー（商人ギルド/値切り屋/過払い）も発動しない。**負債>0 の間はカードもイベントも購入不可**。返済は購入権を消費しない。
- **1機構ごとに**：狙い撃ち一時テスト（プロジェクト直下 `_*.tmp.js`＝gitignore・実行後必ず削除。cwd がずれるので実行前に `Set-Location`）→ `node test/invariants.test.js` 緑 → `npm test` 全緑 → 恒久回帰は `test/events.test.js` へ。大きな決定は PROGRESS.md に追記。
- **substantiveなタスクは Workflow/Agent で多エージェント＋敵対的検証**（各findingは node 再現で確定）。公式ルールが曖昧なら研究エージェントで裏取り（wiki.dominionstrategy.com は WebFetch 不可＝WebSearch と RGG公式PDF・ultraboardgames・fandom・wikiwiki.jp を使う）。
- client資産（js/css/webp等）を変えたら `sw.js` の VERSION を上げる（現在 v46）。回答は日本語・フランクに短く。**push は勝手にしない＝完成→全テスト緑→都度ユーザー確認の上で**。**セッションが重くなったら促さず自動で /handoff**（記憶 auto-handoff）。**Read出力の汚染に注意**：断定前に Grep・`git show`・`Get-Content` で裏取り。

## 次セッションが知らないと事故る事項（イベント固有）
- **EV0/EV1 は未push・ローカルcommit `8caabc0`（作業ツリーはクリーン）**。破壊しないこと。`git log origin/main..main` で未push分を確認。
- **イベントはまだどの CARD_SET にも入っていない**＝invariants の全プール混成fuzzはイベントを引かない（EV3 で `empires-events` を足すと fuzz 対象になる＝そこで初めて保存則/終端が総当たりされる）。**CPU は今イベントを買わない**（pendingの解決だけ実装済＝EV3 で `bestEventBuy` を足すまでソークでイベントは発火しない）。
- **conquest/triumph の「今ターン獲得数」は `t.gainedThisTurn`（手番プレイヤーの獲得id列・gain() が push）で足りる**＝新カウンタ不要。**salt はサプライから直接廃棄するが `trashCard(state, pi, card)` を通す**（Tomb 発火・保存則OK）。
- カタログ文は**現行エラッタ**（tax=「購入フェイズに獲得時」）。**Windfall は研究データに欠落していたので追加済み**（$5・山札と捨て札が両方空なら金貨3・手札/場は判定外）。

## 直近で完了した大仕事（参考）
- **§0-20 帝国イベント EV0/EV1**（2026-07-11・未push・`8caabc0`）＝BUY_EVENT 基盤＋簡単10種＋events.test.js 34件。
- **§0-19 帝国ランドマーク21種＋絵**（2026-07-11・push済・本番 v46 実機確認）。
