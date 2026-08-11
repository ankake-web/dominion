<!-- /handoff が自動生成（2026-08-11）。新セッションはこのファイルの指示に従う。手編集不要 -->

**ウルトラコード（最大エフォート）で進めてください。**

スマホ向けドミニオン対戦Webアプリの開発（新拡張「移動動物園 / Menagerie」を実装中）。
作業ディレクトリ＝`C:\Users\b1242\claude\game\dominion` ／ branch＝`main`（最新は `git log` で確認）。回答は日本語。

## 最初にやること
1. `npm test` を実行し、**全35スイート・オールグリーン（exit 0）**を確認する
   （整合性 3694／不変条件 9／移動動物園 126／UI 119／server 70 など）。赤ならまずそこを直す。
2. `PROGRESS.md` の **§0-25（移動動物園）を必ず読む**。実装済みの機構・落とし穴・未修正バグが全部そこにある。
   カードの公式データ・裁定の正本は `docs/research/menagerie_rules.md`（13.7万字。記憶ではなくこれを見る）。
   新カード実装の一般手順は `docs/adding-cards.md`。

## いま何が終わっていて、何が残っているか
移動動物園は **王国30枚＋馬（非サプライ30枚）＋習性(Way)20種＋CARD_SET昇格 まで完了**（`sw.js` v57・**未push**）。
`menagerie` / `menagerie-ways` / `random-menagerie` が既に実プレイ可能。**イベント20種だけ未実装**（カタログと webp はある）。

## 次に取り組むタスク（優先順1位）＝ イベント20種の実装
- `js/engine.js` の `applyEventEffect` に case を足す。**`BUY_EVENT` の基盤は帝国/冒険で完成済み**なのでそれをコピー元にする。
- **絶望(desperation)** は `ONCE_PER_TURN_EVENTS` に足す＝ "Once per turn:" は**購入自体が1ターン1回**（一次資料で確定済み）。
  **好機(seize_the_day)** は1ゲーム1回（`p.seizedTheDay`・冒険の相続と同型）。
- 新しい選択待ちは必ず **4点セット**（engine reducer＋`PLAYER_ACTIONS`＋CPU `decidePending`＋UI `viewPendingModal`）。
- 実装後に `menagerie-events`（固定10種＋イベント2枚抽選）を `DOM.CARD_SETS` に足し、invariants の出荷セット検証にも追加する。
- その後は PROGRESS §5 の 1-2〜1-6（既存バグ3件の修正 → 敵対レビュー → UIテスト/ソーク → 絵の回収 → push）。

## このプロジェクトの流儀（守ること）
- **ウルトラコードで多エージェント＋敵対的検証**。研究も実装レビューも Workflow でファンアウトし、
  **各 finding は node で再現してから直す**（偽陽性を捨てる）。
- **完全忠実 > 簡略化**。簡略化するなら必ず PROGRESS に「許容簡略化」と理由を書く。
- **push は毎回ユーザー確認を取る**（勝手に push しない）。コミットは随時してよい。
- 使い捨てスクリプトは**プロジェクト直下に `_*.tmp.js`** で作り、実行後に必ず削除。一時ファイルは scratchpad へ。
- client 資産（js/css/webp 等）を変えたら `sw.js` の VERSION を上げる（現在 v57）。
- 進捗・決定は `PROGRESS.md` に追記する。

## 次セッションが知らないと事故ること
- **今回の作業はすべてコミット済みだが未 push**。本番（Pages/Render）にはまだ出ていない。
- **`t.actions += n` / `t.coins += n` を直接書かないこと**。`addActions(t,n)` / `addCoins(state,n)` に一本化済み
  （雪深い村＝+アクション全無視、カメレオンの習性＝+カード↔+コイン が静かに壊れる）。
- **財宝カードの効果は `applyTreasureEffect` に書く**（`applyEffect` は財宝では呼ばれない。1回踏んだ）。
- **獲得時の対話は `state.onGainQueue` に積む**（移動動物園は1回の獲得で複数の窓が開くのが普通）。
- **「相手のターンをフックする持続アタック」を足したら、CPU分岐・UIモーダル・`LINGER_REACT` の許可リストの3箇所**を必ず足す
  （門番でこれを漏らして fuzz が 20000 step 未終局になった）。
- **獲得可否・コスト比較は必ず `DOM.engine` の述語**（`gainableBase`/`costUpTo`/`costUnder`/`costExact`/`sameCost`）。
  追放の候補は `exilableSupplyIds`／`availableInSupply` が正本。素の `cardCost(state,id) <= N` を書くと mix で本番 livelock になる。
- **未修正の既存バグ3件が PROGRESS §0-25 に列挙してある**（戦車競走が `draw()` を通らず -1カードトークンを無視するのが実害あり）。
- 移動動物園の**絵は未回収**（71枚が枠＋文字の暗い板）。webp 再生成はこのPCでしか行えない（入力 `images/`・`asset/art/` は gitignore）。
