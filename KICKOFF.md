<!-- /handoff が自動生成（2026-07-14）。新セッションはこのファイルの指示に従う。手編集不要 -->

ウルトラコード（最大エフォート）で進めてください。

スマホ向けドミニオン対戦Webアプリ（CPU戦・2〜4人ローカル・オンライン対戦）の実装を引き継ぎます。回答/UIは日本語。
作業ディレクトリ: c:\Users\b1242\claude\game\dominion / branch: main（main直接作業運用。最新は git log で確認）。

## まずやること
1. `Set-Location 'C:\Users\b1242\claude\game\dominion'` して `npm test` → **37スイート・オールグリーン（exit 0・整合性3401・不変条件8・ルネサンス320＋UI62・帝国269＋UI75・ランドマーク80・横型イベント149・冒険59＋UI67・暗黒時代87＋UI57・新プロモ165＋UI22・繁栄69・異郷83＋UI44・収穫祭107・ギルド81＋UI25・CPU序列 強vs弱100/強vs普通64/普通vs弱95）** を確認。
2. **`docs/research/mixall_hardening.md`（作業指示書＝正本）** と `PROGRESS.md` の **§0-23** を読む。全体設計図＝`docs/adding-cards.md`。

## 現状
- **ルネサンス（全50枚）と冒険イベントの絵まで完了・push 済**（本番 `sw.js` v51・実機確認済）。実装済みの全カードに絵が入っている。
- **未pushのコミットが2本**：mix-all モードの「配線」＋硬化計画、と PROGRESS 更新。**硬化が終わるまで push 禁止**。

## 次に取り組むタスク（優先順1位）：**mix-all モードのエンジン硬化（確定23件）**
ユーザー要望＝「ランダム対戦で混ぜる拡張を選びたい」。実プレイ可能な13拡張＋横型を自由に組み合わせる **mix モード**の
**配線は完了している**（`DOM.isMixSet`/`parseMixSet`/`makeMixSet`/`kingdomForSet`/**`landscapesForSet`＝横型3種を一度に決める唯一の入口**、
UI の「ミックス」分類、サーバの `isValidKingdomSet`）。全37スイート緑・CPU が全13拡張ミックスで完走することも確認済み。

**しかし mix を解禁すると、コードが「どうせ同居しないから」と先送りしてきた穴が全部到達可能になる**（多エージェント監査＋
敵対検証で**確定23件**・各 finding は node 再現済み）。例：基本＋収穫祭で**工房が賞品を獲得できる**／基本＋錬金術で
**工房がブドウ園（ポーション費用）をタダ獲得できる**／支配（Possession）×他拡張で廃棄カードの返却が壊れる。

- **やること＝`docs/research/mixall_hardening.md` を上から順に潰す**（engine 約60箇所・CPU 約10・UI 約40・支配は別章）。
- **方針＝述語を engine に1本化**：`costUpTo` / `costUnder` / `costExact` / `gainableBase` / `sameCost` を新設して
  `DOM.engine` に公開し、**engine reducer・`anyGainable` ゲート・CPU の候補選び・UI のモーダルフィルタの4面が同じ関数を見る**。
  個別に `if` を足して回る修正は禁止（今回の穴は全部「同じ条件を2箇所に手書きして片方で落とした」もの）。
- **engine を締める修正と CPU を締める修正は必ず同一コミット**（engine だけ締めると CPU が拒否される札を提案し続けて livelock）。
- 回帰＝新規 `test/mixall.test.js`（穴ごとに最小1件）＋ `invariants` に mix-all fuzz。
- 完了後：敵対レビュー（多エージェント）→ CPUソーク（mix 各種）→ `sw.js` VERSION++（現在 v51）→ **ユーザー確認の上で** push。
  PROGRESS §6 の「ポーション/負債は同居しないので未修正」「闇市場に段階1プールが漏れる」の注記を**解消済みに更新**する。

## その次の候補
発売順の未着手拡張（段階1すら未着手＝画像・カタログとも無し）：夜想曲／移動動物園／同盟／略奪／日の出づる国。

## 守るべき進め方・流儀
- **新pendingは必ず4点セット**（engine reducer＋PLAYER_ACTIONS＋CPU decidePending＋UI viewPendingModal）＋終端保証。
  **engine が拒否する手はCPU/UIにも出させない**（同じ述語を engine が公開して3〜4面で共有する）。
- **1機構ごとに**：狙い撃ち一時テスト（直下 `_*.tmp.js`＝実行後必ず削除。cwd がずれるので実行前に `Set-Location`）→
  `node test/invariants.test.js` 緑 → `npm test` 全緑 → 恒久回帰は該当 test へ。大きな決定は PROGRESS.md に追記。
- **substantive なタスクは Workflow/Agent で多エージェント＋敵対的検証**（各 finding は node 再現で確定）。
- client資産（js/css/webp等）を変えたら `sw.js` の VERSION を上げる。回答は日本語・フランクに短く。
- **push は勝手にしない＝完成→全テスト緑→都度ユーザー確認の上で**。**セッションが重くなったら促さず自動で /handoff**。
- **Read出力の汚染に注意**：実装状態を断定する前に Grep・`git show`・`Get-Content` で裏取りする。
- カード絵はユーザーが ChatGPT で生成 → 私が中身を見て判別し `asset/art/<id>.png` に回収 → webp 再生成
  （縦型 `tools/build-cards.js`／横型 `tools/build-landscape.js`。`CARDS_ONLY=<ids>` で個別生成。このPCのみ可）。

## 直近で完了した大仕事（参考）
- **§0-22 ルネサンス全50枚**（2026-07-13・push済 v50）＝王国25＋プロジェクト20＋アーティファクト5。新機構＝村人／
  アーティファクト／プロジェクト。横断リファクタ2件（`reveal()` に公開フック集約＝パトロン／財宝判定を `isTreasureFor` に
  集約69箇所＝資本主義）。敵対レビュー確定9件を修正。
- **絵の回収**：ルネサンス50枚（v50）／冒険イベント20枚（v51）。**これで全カードに絵が入った**。
