<!-- /handoff が自動生成（2026-08-25）。新セッションはこのファイルの指示に従う。手編集不要 -->

**ウルトラコード（最大エフォート）で進めてください。**

スマホ向けドミニオン対戦Webアプリの続き。作業ディレクトリ＝`c:\Users\b1242\claude\game\dominion`（branch `main`）。回答は日本語で、フランクに短く。

## まず最初にやること
1. `npm test` を実行して **全50スイート緑（exit 0・整合性5864・不変条件12）** を確認する。
   🛑 **`npm test` は `&&` チェーン＝1つ落ちると以降が1度も走らない**。大きな変更のあとは必ず**最後まで**通すこと。
2. **`PROGRESS.md` の §0-42（今ここ）／§0-41／§5／§6 を読む。** 広い過去文脈は `docs/handover.md`。
3. **2026-08-25 に push 済み＝本番は `sw.js` v91**。**以後の push もユーザーに確認してから**。
   ⚠ 本番と比べるとき **`js/ui.js`・`css/style.css`・`manifest.webmanifest`・`test/ui.test.js` は `git show HEAD:<path>`** を使う
   （作業ツリーに Codex の未コミット差分がある）。

## 現在地（2026-08-25）
- **Arcana 以外の公式全カード（縦型617＋横型227＝844枚）が実プレイ可能**。
- §0-41＝**日本語名50件**を公式へ統一（同名カードの重複0件）。
- §0-42＝**カード文844枚を engine 実装と公式英語テキストに全数照合し、確定76件を全修正**。
  [high] 8件は**実装が公式と別のカードだった**（山師・軍用金・海賊・出資・黒猫・動物見本市・公爵夫人・支配）。
  副産物＝`carddata.js` の `effects` による**カード文の二重管理**を解消／engine・UI が別カード名を名乗っていた35箇所を修正。

## 次に取り組むこと
1. **第18拡張 Arcana**（2026年予定・500枚・王国37山・機構＝Study/Cart/Project）＝
   **カード名が1つも公開されていないので段階0すら着手不能**。英語wiki `Arcana` を見てデータが出ていたら段階0から。
2. データが無い間にやるなら＝多エージェント敵対レビューの再走（§0-42 の修正は engine を広く触ったので、
   既存17拡張への退行を新旧 engine の完全並走で確かめると安心）／CPU購入AIの拡張別チューニング。

## 守るべき流儀
- 新しい pending は**4点セット**（engine reducer＋`PLAYER_ACTIONS`＋CPU `decidePending`＋UI `viewPendingModal`）＋終端保証。
- **`ATTACKS` は字面の literal に書く**（代入は integrity が未登録扱い）。
- 獲得の可否・コスト比較は `DOM.engine` の述語（`gainableBase`/`costUpTo`/…）。
- **「手札がN枚になるまで引く」は `drawUpTo(state, pi, N)`**（素朴な一括ドローは -1カードトークンで1枚足りずに止まる）。
- **「場」＝`inPlay` ＋ `durationCards`**（前ターンから残る持続も場）。
- **「公開する」効果は `reveal()` を通す**（パトロンの誘発とオンラインの可視化がここに乗る）。「見る」は通さない。
- **カード面の文字は `DOM.CARDS[].text` だけ**。`js/carddata.js` に `effects:` を書かない（恒久検査が落とす）。
- 「山札を掘る」ループは `noMoreShuffle` 契約に乗せる（メイソン団／回避が残した札で2度シャッフルしない）。
- 回帰テストは必ず**バグ注入で感度を確かめる**（`/tmp` に js/ と test/ をコピーして注入）。
  **新旧で結果が同じになる組み方をすると感度ゼロ**になる（2026-08-24 に踏んだ）。
- 使い捨てスクリプトは `_*.tmp.*`（gitignore 済み）で作り**実行後に削除**。`c:\tmp` は本業の資料があるので一括削除しない。
- client 資産（js/css/webp/sw）を変えたら `sw.js` の VERSION を上げる。

## 知らないと事故ること
- 🛑 **Codex が同じ作業ツリーで `css/style.css`・`js/ui.js`・`manifest.webmanifest`・`test/ui.test.js`・
  `asset/ui/`・`icon-*.png`・`asset/cards/back.webp` を改修中**＝`git status` の未コミット差分は Codex のもの。
  **自分のコミットに混ぜない**＝メモリ `codex-concurrent-commit-isolation` の手順で index 直書き。
- 🛑 **日本語名を一括置換しない**＝`従者`(squire)／`使者`(messenger)／`役人`(bureaucrat)／`投資`(イベント invest)／
  `略奪者`(種別 Looter)／`追従者`(lackeys)／技術用語の「キャッシュ」は**今もその名前が正しい別物**。
- 日本語wiki の**拡張一覧ページは「（拡張）」付き**（`繁栄（拡張）` 等）。並列で叩くと 429 で全滅＝自分で逐次
  （`tools/jpwiki.py`）。詳細＝メモリ `jpwiki-page-names-and-name-audit`。
- 英語wiki は `node tools/wikidirect.js "<Page>"`（数秒・常に現行版・301 追従あり）。並列で使ってよい。
- push 直後は Render が再デプロイ中で ws が `ECONNRESET` になる＝数分待ってから叩く。
