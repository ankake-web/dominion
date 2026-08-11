<!-- /handoff が自動生成（2026-08-11）。新セッションはこのファイルの指示に従う。手編集不要 -->

**ウルトラコード（最大エフォート）で進めてください。**

スマホ向けドミニオン対戦Webアプリの開発。
作業ディレクトリ＝`C:\Users\b1242\claude\game\dominion` ／ branch＝`main`（最新は `git log` で確認）。回答は日本語。

## 最初にやること
1. `npm test` を実行し、**全36スイート・オールグリーン（exit 0）**を確認する
   （整合性3695／不変条件10／移動動物園253＋UI64／CPU序列 100/64/95 など）。赤ならまずそこを直す。
2. `PROGRESS.md` を読む。**§1（ゴール）／§2（アーキテクチャ）／§5（未完了タスク）／§6（注意点）は必読**。
   直近の作業は §0-26（移動動物園の完成）と §0-25（移動動物園の基盤）。
3. 新しいカードを足す前に **`docs/adding-cards.md`** を必ず読む（engine の全機構の実装手順＋落とし穴が
   file:line 付きでまとまっている）。

## いまの状態
**移動動物園（Menagerie）まで完成して push 済み。未pushのコミットは無い。**
全521枚（縦型402＋横型119）が実プレイ可能で、**全部に絵が入っている**（枠＋文字だけの札はゼロ）。
本番＝GitHub Pages（`sw.js` v58）＋ Render（オンライン対戦サーバ）で稼働中。

## 次に取り組むタスク（優先順1位）＝ 新しい拡張の実装
**発売順の未着手拡張＝夜想曲（Nocturne）／同盟（Allies）／略奪（Plunder）／日の出づる国（Rising Sun）**。
段階1（画像・カタログ）すら未着手なので、まず**どれをやるかをユーザーに確認する**こと。
発売順では夜想曲が次だが、過去2回は「技術的相性」でユーザー判断により順番を入れ替えている
（ルネサンス→移動動物園を先行）。夜想曲は **夜フェイズ・分割山・家宝・魂・ボーン鴉** など新機構が多く重い。

実装は必ずこの順で（移動動物園＝§0-25/§0-26 が最新の手本）:
1. **多エージェント研究WF**で公式ルールを収集 →「別エージェントが一次資料で敵対検証」して
   `docs/research/<expansion>_rules.md` を作る（これが実装の正本。記憶に頼らない）。
2. 段階1＝カタログ（`DOM.CARDS` / `DOM.LANDSCAPES`）＋孤立プール＋`GAIN_ORDER`＋webp生成（枠＋文字）。
3. 段階2＝engine 実装をバッチに分け、各バッチ末で `node test/invariants.test.js` 緑＋`npm test` 全緑でコミット。
4. CARD_SET 昇格 → 多エージェント敵対レビュー → UIテスト新設・CPUソーク・`verify:e2e`/`verify:visual`。
5. 絵の回収（記憶 `chatgpt-card-art-workflow` の手順）→ PROGRESS 更新 → **ユーザー確認の上で** push。

## 守るべき流儀
- **ウルトラコードで多エージェント＋敵対的検証**。**各 finding は必ず node で再現してから直す**（偽陽性は棄却）。
  移動動物園では、この方式で「門番のアタックが実質完全に無効」という high バグを実際に捕まえた。
- **完全忠実 > 簡略化**。簡略化するなら PROGRESS に「許容簡略化」と理由を必ず書く。
- **push は毎回ユーザー確認を取る**（コミットは随時してよい）。push 後は Pages/Render の本番反映を実機確認する。
- 使い捨てスクリプトは**プロジェクト直下に `_*.tmp.js`**（gitignore 済み）で作り、実行後に必ず削除。
  一時ファイルは scratchpad へ。
- client 資産（js/css/webp 等）を変えたら **`sw.js` の VERSION を上げる**（現在 v58）。
- 進捗・決定は `PROGRESS.md` に追記する。

## 次セッションが知らないと事故ること
- **新しい pending を足したら必ず4点セット**（engine reducer＋`PLAYER_ACTIONS`＋CPU `decidePending`＋
  UI `viewPendingModal`）。1つでも欠けると CPU 無限ループか人間が詰む。
- **CPU の `decidePending` で `null` を返さない**（オンラインで `reduce(state, null)` が TypeError になり
  **部屋が固まる**）。候補ゼロでも `{type:'X', card:null}` を返し、engine 側に「候補ゼロなら窓を閉じる」終端保証を書く。
- **獲得可否・コスト比較は必ず `DOM.engine` の述語**（`gainableBase`/`costUpTo`/`costUnder`/`costExact`/`sameCost`）。
  素の `cardCost(state,id) <= N` を書くと mix-all で本番 livelock になる。
- **CPU が所有カードを数えるときは `DOM.engine.allCards`**（CPU 側でゾーン列挙を手書きしない）。
- **`t.actions += n` / `t.coins += n` を直接書かない**（`addActions` / `addCoins` を通す＝雪深い村・カメレオンの習性）。
- **財宝の効果は `applyTreasureEffect`**（`applyEffect` は財宝では呼ばれない）。
- **獲得時の対話は `state.onGainQueue` に積む**。「1つの効果で複数枚を獲得する」効果の後に `state.pending` を
  直接代入しない（獲得時リアクションの窓を握りつぶす）。
- **新しいゾーンを足したら** `allCards`・`test/invariants.test.js` の `ZONES`・`maskStateFor` の3箇所を必ず配線する。
- **オンライン永続化**：`server/gameServer.js` は state をそのまま保存し**無変換で復元**する。
  新しいフィールドは `|| []` / `|| 0` で防御し、旧スナップショットで落ちない・固まらないことを確認する。
- **GitHub Pages のデプロイが詰まったら** PROGRESS §6 の「ゾンビ化」の項を読む
  （`gh api -X POST repos/ankake-web/dominion/pages/deployments/<旧SHA>/cancel` で解除）。
- 絵の webp 再生成は**このPCでしかできない**（入力の `images/`・`asset/art/` は gitignore）。
