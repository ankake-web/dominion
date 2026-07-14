<!-- /handoff が自動生成（2026-07-14）。新セッションはこのファイルの指示に従う。手編集不要 -->

ウルトラコード（最大エフォート）で進めてください。

スマホ向けドミニオン対戦Webアプリ（CPU戦・2〜4人ローカル・オンライン対戦）の実装を引き継ぎます。回答/UIは日本語。
作業ディレクトリ: c:\Users\b1242\claude\game\dominion / branch: main（main直接作業運用。最新は git log で確認）。

## まずやること
1. `Set-Location 'C:\Users\b1242\claude\game\dominion'` して `npm test` → **38スイート・オールグリーン（exit 0・整合性3401・
   不変条件9・mix-all硬化102・ルネサンス320＋UI62・帝国269＋UI75・ランドマーク80・横型イベント149・冒険59＋UI67・
   暗黒時代87＋UI57・新プロモ165＋UI22・繁栄69・異郷83＋UI44・収穫祭107・ギルド81＋UI25・CPU序列 100/64/95）** を確認。
2. `PROGRESS.md` の **§0-23（mix-all 硬化）と §6（注意点）** を読む。全体設計図＝`docs/adding-cards.md`。

## 現状（2026-07-14 時点）
- **未pushコミットは無い。本番は最新**（`sw.js` v52・GitHub Pages ＋ Render 反映確認済み）。
- **実プレイ可能な13拡張（基本/陰謀/海辺/錬金術/繁栄/収穫祭/ギルド/異郷/暗黒時代/冒険/帝国/ルネサンス/プロモ）を
  自由に混ぜる mix-all モードが稼働中**（横型＝イベント/ランドマーク/プロジェクトも合算2枚まで選べる）。
  実装済みの全カードに絵（webp）が入っている。

## 次に取り組むタスク（優先順1位）：**発売順の未着手拡張に着手**
候補＝**夜想曲 / 移動動物園 / 同盟 / 略奪 / 日の出づる国**（段階1すら未着手＝画像・カタログとも無し）。
どれをやるかは**ユーザーに1問だけ確認**してから着手する（技術的相性で順序を変えた前例あり＝§0-22）。
進め方は §0-22（ルネサンス）が最良のテンプレ：
公式ルールの多エージェント研究（一次資料＋エラッタ）→ カタログ＋webp（枠＋文字）→ 効果をバッチ実装 →
CARD_SET 昇格 → 敵対レビュー → CPUソーク → 絵の回収 → ユーザー確認の上で push。

## 【最重要・知らないと事故る】mix-all 以後の鉄則
- **獲得の可否・コスト比較は必ず `DOM.engine` の述語を使う**：
  `gainableBase` / `costUpTo` / `costUnder` / `costExact` / `sameCost`（＋`costOf`）。
  素の `cardCost(state,id) <= N` を書くと、非サプライ（賞品/戦利品/トラベラー成長先）・ロック中の分割山下段・
  ポーション費用・負債コストを取りこぼし、**engine が拒否 × CPU が提案し続けて本番 livelock**になる
  （敵対レビューで複製/馬上槍試合/待ち伏せが実際にそうなっていた）。
  **engine reducer・`anyGainable` ゲート・CPU の候補選び・UI のモーダル filter の4面が同じ関数を見ること。**
- **サプライ外からの獲得（廃棄置き場/闇市場）は `gainFromOutside`**（負債・支配の振り分け・獲得トリガーを一括）。
  **サプライの山からの廃棄（塩まき/待ち伏せ/剣闘士）は `trashFromSupplyPile`**（混合山は一番上の実カード・支配で退避しない）。
  **獲得先ゾーンの写像は `zoneOf(p, dest)`**（'setAside' を忘れると捨て札の同名コピーを動かす）。
- 新pendingは**4点セット必須**（engine reducer＋PLAYER_ACTIONS＋CPU decidePending＋UI viewPendingModal）＋終端保証。
  「ちょうど/以下」の pending には **pot/debt を焼き込む**（オンライン永続化の旧スナップショット互換に注意）。

## 守るべき進め方・流儀
- **1機構ごとに**：狙い撃ち一時テスト（直下 `_*.tmp.js`＝実行後必ず削除。cwd がずれるので実行前に `Set-Location`）→
  `node test/invariants.test.js` 緑 → `npm test` 全緑 → 恒久回帰は該当 test へ。大きな決定は PROGRESS.md に追記。
- **substantive なタスクは Workflow/Agent で多エージェント＋敵対的検証**（各 finding は node 再現で確定／偽陽性は棄却）。
- client資産（js/css/webp等）を変えたら `sw.js` の VERSION を上げる（現在 v52）。回答は日本語・フランクに短く。
- **push は勝手にしない＝完成→全テスト緑→都度ユーザー確認の上で**。**セッションが重くなったら促さず自動で /handoff**。
- **Read出力の汚染に注意**：実装状態を断定する前に Grep・`git show`・`Get-Content` で裏取りする。
- カード絵はユーザーが ChatGPT で生成 → 私が中身を見て判別し `asset/art/<id>.png` に回収 → webp 再生成
  （縦型 `tools/build-cards.js`／横型 `tools/build-landscape.js`。`CARDS_ONLY=<ids>` で個別生成。このPCのみ可）。

## 直近で完了した大仕事（参考）
- **§0-23 mix-all（2026-07-14・push済 v52）**＝13拡張を自由に混合。獲得述語を engine に一本化（engine 約60／CPU 約25／
  UI 約40箇所を置換）、gain/trash を通らない経路を統一、支配（Possession）を硬化。敵対レビュー確定17件を修正。
  新設 `test/mixall.test.js`（102件）＋invariants に mix-all fuzz。mix CPUソーク318戦クリーン。
- **§0-22 ルネサンス全50枚（push済 v50）**／**§0-21 冒険イベント20種の絵（v51）**。
