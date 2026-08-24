<!-- /handoff が自動生成（2026-08-24）。新セッションはこのファイルの指示に従う。手編集不要 -->

**ウルトラコード（最大エフォート）で進めてください。**

スマホ向けドミニオン対戦Webアプリの続き。作業ディレクトリ＝`c:\Users\b1242\claude\game\dominion`（branch `main`）。回答は日本語で、フランクに短く。

## まず最初にやること
1. `npm test` を実行して **全50スイート緑（exit 0・整合性5859・不変条件12・同盟523・`missing33` 263＋UI 115・新プロモ167）** を確認する。
   🛑 **`npm test` は `&&` チェーン＝1つ落ちると以降が1度も走らない**。大きな変更のあとは必ず**最後まで**通すこと。
2. **`PROGRESS.md` の §0-41（今ここ）／§0-40／§5／§6 を読む。** 広い過去文脈は `docs/handover.md`。
3. **2026-08-24 に push 済み＝本番は `sw.js` v90**（Pages 8本 sha1 一致＋カード名20/20／Render 実 ws 11/11 で機械照合済み）。
   **以後の push もユーザーに確認してから**（勝手に push しない）。
   ⚠ 本番と比べるとき **`js/ui.js` は `git show HEAD:js/ui.js`** を使う（作業ツリーに Codex の未コミット差分がある）。

## 現在地（2026-08-24）
- **Arcana 以外の公式全カード（縦型618＋横型227＝845枚）が実プレイ可能**。**同名カードの重複は0件**（機械検査）。
- 直近＝**日本語カード名の全数監査で50件を公式（日本語wiki＝ホビージャパン印刷版）へ統一**し、webp 51枚を焼き直した。
  同名衝突4組（役人／従者／使者／投資）が全部解消。**繁栄12件は王の宮廷→宮廷 など見た目が大きく変わる**。
- あわせて §0-40 の宿題を5件とも完済＝`hoard` の二重登録／`revealFromDeck` のメイソン団 2度目シャッフル／
  駿馬×長老／錬金術のセット表示名／要塞の種別順。`harem` は**ハーレムのまま据え置きと決定**（Farm は未印刷）。

## 次に取り組むこと
1. **第18拡張 Arcana**（2026年予定・500枚・王国37山・機構＝Study/Cart/Project）＝
   **カード名が1つも公開されていないので段階0すら着手不能**。英語wiki `Arcana` を見てデータが出ていたら段階0から。
2. データが無い間にやるなら＝多エージェント敵対レビューの再走／CPU購入AIの拡張別チューニング／
   カード文（text）の全数照合（**名前は監査済みだが、カード文はまだ全数照合していない**）。

## 守るべき流儀
- 新しい pending は**4点セット**（engine reducer＋`PLAYER_ACTIONS`＋CPU `decidePending`＋UI `viewPendingModal`）＋終端保証。`test/integrity.test.js` が機械検査する。
- **`ATTACKS` は字面の literal に書く**（`ATTACKS['x'] = …` の代入は integrity が未登録扱い）。
- 獲得の可否・コスト比較は `DOM.engine` の述語（`gainableBase`/`costUpTo`/…）。非サプライ山も `supply` に数値キーを持つ。
- 「山札を掘る」ループは **`noMoreShuffle` 契約**に乗せる（`if (p.discard.length === 0 || noMoreShuffle) break; noMoreShuffle = reshuffleDeck(p, state) === true;`）。
- 回帰テストは必ず**バグ注入で感度を確かめる**（`/tmp` に js/ と test/ をコピーして注入）。**新旧で結果が同じになる組み方をすると感度ゼロ**になる（2026-08-24 に踏んだ）。
- 使い捨てスクリプトは `_*.tmp.*`（gitignore 済み）で作り**実行後に削除**。`c:\tmp` は本業の資料があるので一括削除しない。
- client 資産（js/css/webp/sw）を変えたら `sw.js` の VERSION を上げる。

## 知らないと事故ること
- 🛑 **Codex が同じ作業ツリーで `css/style.css`・`js/ui.js`（絵文字→SVG）・`manifest.webmanifest`・`test/ui.test.js` を改修中**＝
  `git status` の未コミット差分は Codex のもの。**自分のコミットに混ぜない**＝メモリ `codex-concurrent-commit-isolation` の手順
  （HEAD に自分のブロックだけ当てたファイルを `git hash-object -w`＋`git update-index --cacheinfo` で index 直書き →
  `git write-tree` → `git archive | tar -x` でステージ済みツリーを取り出してテスト → コミット）。
- 🛑 **日本語名を一括置換しない**＝`従者`(squire)／`使者`(messenger)／`役人`(bureaucrat)／`投資`(イベント invest)／
  `略奪者`(種別 Looter)／`追従者`(lackeys)／技術用語の「キャッシュ」は**今もその名前が正しい別物**。
- 日本語wiki の**拡張一覧ページは「（拡張）」付き**（`繁栄（拡張）` 等）＝`繁栄`/`移動動物園`/`同盟`/`略奪` は同名カードのページ。
  並列で叩くと 429 で全滅＝エージェントに触らせず自分で逐次（`tools/jpwiki.py`）。詳細＝メモリ `jpwiki-page-names-and-name-audit`。
- push 直後は Render が再デプロイ中で ws が `ECONNRESET` になる＝数分待ってから叩く。
