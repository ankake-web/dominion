<!-- /handoff が自動生成（2026-08-23）。新セッションはこのファイルの指示に従う。手編集不要 -->

**ウルトラコード（最大エフォート）で進めてください。**

スマホ向けドミニオン対戦Webアプリの続き。作業ディレクトリ＝`c:\Users\b1242\claude\game\dominion`（branch `main`）。回答は日本語で、フランクに短く。

## まず最初にやること
1. `npm test` を実行して **全50スイート緑（exit 0・整合性5859・不変条件12・`missing33` 263＋`missing33-ui` 110）** を確認する。
   🛑 **`npm test` は `&&` チェーン＝1つ落ちると以降が1度も走らない**。大きな変更のあとは必ず**最後まで**通すこと
   （2026-08-23 に `test/promo2.test.js` が落ちたまま「全50緑」と誤報告した＝以降39スイートが未実行だった）。
2. **`PROGRESS.md` の §0-40（今ここ＝未実装33種の段階0〜昇格まで全部）／§5／§6 を読む。** 正本＝`docs/research/missing19_rules.md`（海辺1版8・繁栄1版9・プロモ2）と
   `docs/research/cornguilds2e_rules.md`（収穫祭＆ギルド2版14＋末尾の敵対検証3本）。広い過去文脈は `docs/handover.md`。
3. **2026-08-23 に 8コミットを push 済み＝本番は v88**（Pages 38/38・Render 22/22 で機械照合済み＝PROGRESS §0-40 の「push＝完了」節）。
   **以後の push もユーザーに確認してから**（勝手に push しない）。
   ⚠ 本番と比べるとき **`js/ui.js` は `git show HEAD:js/ui.js`** を使う（作業ツリーには Codex の未コミット差分がある）。

## 現在地（2026-08-23）
- **未実装33種（海辺1版8／繁栄1版9／収穫祭＆ギルド2版14／プロモ2）を段階2で全部実装し昇格した＝Arcana 以外の公式全カード（縦型618＋横型227＝845枚）が実プレイ可能。**
  新セット7つ＝`seaside1e`／`prosperity1e`／`cornguilds2e`／`promo-events`（＋召喚）／`random-seaside1e`／`random-prosperity1e`／`random-cornguilds2e`。
  `random-1e` と mix-all（`cornguilds2e`）と闇市場デッキの母集団が増えた。新機構＝**渡し守の山（`state.ferrymanPile`＝サプライ外の王国山）／褒賞の山（2人各1・3人以上各2）／野盗の常設ルール（`state.footpadRule`）／海賊船トークン／交易路マット／抑留トークン**。
- **出荷済みバグ7件を同時に修正**＝商人ギルド／財源の2018旧則→2021／王女・ティアラ／収集の「場にある」→「このターン」／追跡者の `src`／遊牧民の野営地の2016エラッタ（獲得先の置き換え）／パン屋×闇市場／借金・投機の捨て札トリガー順。
- 検証＝`npm test` 全50緑／`verify:e2e` 9/9／`verify:visual` はみ出し0／恒久テストはバグ注入 7/7・13/13・15/15・**10/10（レビュー修正）** で感度確認／
  昇格7セット×3戦 CPU ソーク完走＋**レビュー後に 13セット×4戦＝52ゲーム・17,372ステップ（膠着/例外/保存則違反/engine拒否 0）**。
- **敵対レビュー（6観点・13体）で確定10件を修正済み**（真珠採りのシャッフル／交易路×王の宮廷の +$／CPU の境界地VP／召喚の旗のid照合／
  闇市場の一騎討ちで褒賞の山／`gainFromOutside` の遊牧民の野営地／会計所・大使の pending 漏れ／海賊船・海の妖婆の村有緑地／謝肉祭のシャッフル／ワイン商との順序 ほか）。

## 次に取り組むこと（優先順）
1. **push（ユーザー確認）**＝レビュー修正10件のコミットが未push（`sw.js` v89）。push したら本番照合（Pages の sha1・Render の実 ws）。
   ※ 敵対レビュー（6観点・13体）は 2026-08-23 に完了済み＝確定10件は全部修正・回帰テスト R1〜R10（バグ注入 10/10 検出）付き。PROGRESS §0-40 の該当節を見ること。
2. **§0-40「未対応」の宿題**（どれも webp 再生成を伴うものが多い＝このPCのみ）：日本語名の誤り14件（`mandarin`「役人」が `bureaucrat` と衝突＝公式「官吏」ほか）／`harem`→Farm 改名／`hoard` の `POOLS.promo`/`prosperity` 二重登録／
   `revealFromDeck`・`farming_village`・`fortune_teller` の「2度目のシャッフル禁止」（メイソン団・mix-all 限定）／Courser を長老(Elder)の対象にするか（公式は対象）／Princess の2022エラッタは**印刷済み**に揃えた（済）。
3. **第18拡張 Arcana**（2026年予定）＝カード名すら未公開＝データが出たら段階0から。

## 守るべき流儀
- 新しい pending は**4点セット**（engine reducer＋`PLAYER_ACTIONS`＋CPU `decidePending`＋UI `viewPendingModal`）＋終端保証。`test/integrity.test.js` が機械検査する。
- **`ATTACKS` は字面の literal に書く**（`ATTACKS['x'] = …` の代入は integrity が未登録扱い）。
- 獲得の可否・コスト比較は `DOM.engine` の述語（`gainableBase`/`costUpTo`/…）。非サプライ山も `supply` に数値キーを持つ＝`canReturnToPile`/`availableInSupply` は「サプライ由来か」を表さない（`!NON_SUPPLY.has` を併用）。
- 回帰テストは必ず**バグ注入で感度を確かめる**（scratchpad に js/ と test/ をコピーして注入＝本体と干渉しない）。
- 使い捨てスクリプトは `_*.tmp.*`（gitignore 済み）で作り**実行後に削除**。`c:\tmp` は本業の資料があるので一括削除しない。
- client 資産（js/css/webp/sw）を変えたら `sw.js` の VERSION を上げる。

## 知らないと事故ること
- 🛑 **Codex が同じ作業ツリーで `css/style.css`・`js/ui.js`（絵文字→SVG）・`manifest.webmanifest`・`test/ui.test.js` を改修中**＝`git status` に出る未コミット差分は Codex のもの。
  **自分のコミットに混ぜない**＝メモリ `codex-concurrent-commit-isolation` の手順（パッチスクリプトを HEAD にも当てて `git hash-object -w`＋`git update-index --cacheinfo` で index 直書き／`git apply --cached --unidiff-zero` は壊れる／
  `open('w').write(fn(t))` ではなく先に `out=fn(t)`／`git checkout -- file` 後は CRLF→LF に戻す）。
- 日本語wiki（wikiwiki.jp）は並列で叩くと 429 で全滅＝エージェントに触らせず自分で逐次。
- `maybeStartOverpay` は pending があれば `onGainQueue` の `overpay_ask` に積む（望楼/交易商人の窓を潰さない）＝修正済みなので戻さない。
- 渡し守の山の札が要求する準備は `createInitialState` の `kX`（kingdom＋渡し守の札）と `initSupply` の2回目で走らせている。神風の新10山に渡し守が入った場合の派生準備は走らせない（許容簡略化）。
