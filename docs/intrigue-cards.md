# 陰謀（第1版）残り11種 — 実装リファレンス

実装済み14種（後宮・貴族・願いの井戸を含む）は第1版「陰謀」構成のため、残りも**第1版陰謀の全25種**を完成させる。
このドキュメントは「効果の正典」「実装が触る層」「必要な画像ファイル名」をまとめたもの。

## 必要な画像ファイル（デザイン担当が用意）
各カードにつき `asset/<id>.jpg`（原寸）と `asset/thumb/<id>.jpg`（サムネ）の2点。
未配置でも onerror でカード名テキスト表示にフォールバックするため、コードは先行して動く。

| id | 日本語名 | 画像 |
|---|---|---|
| `great_hall` | 大広間 | asset/great_hall.jpg, asset/thumb/great_hall.jpg |
| `coppersmith` | 銅細工師 | asset/coppersmith.jpg, asset/thumb/coppersmith.jpg |
| `trading_post` | 交易場 | asset/trading_post.jpg, asset/thumb/trading_post.jpg |
| `upgrade` | 改良 | asset/upgrade.jpg, asset/thumb/upgrade.jpg |
| `scout` | 斥候 | asset/scout.jpg, asset/thumb/scout.jpg |
| `swindler` | 詐欺師 | asset/swindler.jpg, asset/thumb/swindler.jpg |
| `tribute` | 貢物 | asset/tribute.jpg, asset/thumb/tribute.jpg |
| `saboteur` | 破壊工作員 | asset/saboteur.jpg, asset/thumb/saboteur.jpg |
| `minion` | 手先 | asset/minion.jpg, asset/thumb/minion.jpg |
| `masquerade` | 仮面舞踏会 | asset/masquerade.jpg, asset/thumb/masquerade.jpg |
| `secret_chamber` | 秘密の小部屋 | asset/secret_chamber.jpg, asset/thumb/secret_chamber.jpg |

## 効果の正典（第1版「陰謀」）
- **大広間 (Great Hall, $3, アクション-勝利点)**：+1カード, +1アクション。勝利点1。
- **銅細工師 (Coppersmith, $4, アクション)**：このターン、銅貨は出すと+1コイン多くなる（銅貨1枚=2コイン）。
- **交易場 (Trading Post, $5, アクション)**：手札を2枚廃棄する。そうしたら銀貨1枚を手札に獲得。
- **改良 (Upgrade, $5, アクション)**：+1カード, +1アクション。手札を1枚廃棄し、ちょうど1コイン高いカードを1枚獲得。
- **斥候 (Scout, $4, アクション)**：+1アクション。山札の上4枚を公開。勝利点カードは手札に加え、残りを好きな順で山札の上に戻す。
- **詐欺師 (Swindler, $5, アクション-アタック)**：+2コイン。他の各プレイヤーは山札の上1枚を廃棄し、それと同じコストのカードを獲得（獲得物は使用者が選ぶ）。
- **貢物 (Tribute, $5, アクション)**：左隣のプレイヤーが山札の上2枚を公開して捨てる。公開された“異なる名前”ごとに、アクションなら+2アクション／財宝なら+2コイン／勝利点なら+2カード。
- **破壊工作員 (Saboteur, $5, アクション-アタック)**：他の各プレイヤーは$3以上のカードが出るまで山札の上を公開し、それを廃棄。さらにそれより最大$2安いカードを獲得してよい。残りは捨てる。
- **手先 (Minion, $5, アクション-アタック)**：+1アクション。次から1つ：+2コイン／または、自分の手札を捨てて+4カードし、手札5枚以上の他プレイヤーも手札を捨てて4枚引く。
- **仮面舞踏会 (Masquerade, $3, アクション)**：+2カード。各プレイヤーは同時に手札1枚を左隣へ渡す。その後、自分は手札を1枚廃棄してよい。
- **秘密の小部屋 (Secret Chamber, $2, アクション-リアクション)**：手札を好きな枚数捨て、捨てた枚数だけ+1コイン。／リアクション：他人がアタックを使ったとき手札から公開してよい。公開したら+2カードし、手札2枚を山札の上に戻す。

## カード1枚が触る層（実装チェックリスト）
1. `js/cards.js` … `DOM.CARDS[id]` 定義。ランダム抽選に出すなら `DOM.POOLS.intrigue` にも id を追加。
2. `js/carddata.js` と `data/cards.json` … 一覧表示用データ（effects配列・art・icon・typeLabel）を両方に。
3. `js/engine.js` … `applyEffect()` に case（即時 or `state.pending`）。対話が要るなら `reduce()` に `*_RESOLVE` の case。
4. `server/gameServer.js` … 新しい `*_RESOLVE` アクション名を `ALLOWED` に追加（無いとオンラインで弾かれる）。
5. `js/ui.js` … `viewPendingModal()` に `pd.type` 分岐。既存の `modal*` ヘルパを使う（無ければ新設）。
6. `js/cpu.js` … `decidePending()` に case を追加し対応する `*_RESOLVE` を返す（pending放置はCPUの手番停止）。
7. 画像（上表）。
8. `test/intrigue.test.js`（エンジン）と `test/intrigue-ui.test.js`（UI）にテスト追加。

実装の難易度順（易→難）：大広間 → 銅細工師 → 交易場 → 改良 → 斥候 → 貢物 → 詐欺師 → 破壊工作員 → 手先 → 仮面舞踏会 → 秘密の小部屋。
