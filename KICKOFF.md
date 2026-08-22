<!-- /handoff が自動生成（2026-08-22）。新セッションはこのファイルの指示に従う。手編集不要 -->

**ウルトラコード（最大エフォート）で進めてください。**

スマホ向けドミニオン対戦Webアプリの続き。作業ディレクトリ＝`c:\Users\b1242\claude\game\dominion`（branch `main`）。回答は日本語で、フランクに短く。

## まず最初にやること
1. `npm test` を実行して **全48スイート緑（exit 0・整合性5561・不変条件12・旭日498＋旭日R4 230＋旭日UI 98）** を確認する。
2. **`PROGRESS.md` の §0-39（今ここ）／§0-38／§0-37／§5／§6 を読む。** 旭日の細部は §0-33〜§0-36 に、
   広い過去文脈は `docs/handover.md` に。
3. **未pushが40コミット前後ある**（正確な数は `git log origin/main..HEAD`）＝**旭日の段階1＋段階2 R1〜R7＋敵対レビュー修正3巡**。
   **push はユーザーに確認してから**（勝手に push しない）。

## いまの状態（1行）
**§0-40 で「世の中に出ている全カード」との差分を監査した＝残りは 33種 ＋ Arcana**
（海辺 第1版8／繁栄 第1版9／収穫祭＆ギルド 第2版14／プロモ2）。詳細は PROGRESS §0-40。

**旭日（Rising Sun）は完成した**＝17拡張＋プロモ＝**811枚（縦型585＋横型226）が実プレイ可能**。
`DOM.CARD_SETS` に `risingsun`（固定10種）／`risingsun-events`／`random-risingsun` があり、**mix-all も17拡張**。
**残っているのは「絵50枚の回収」と「push」だけ**（`sw.js` は **v82**）。
**§0-38（予言15種＋イベント10種）と §0-39（王国25種）で敵対レビューを合計4体回し、確定22件を全修正した**
＝**旭日50種すべてを正本の逐語と1枚ずつ突き合わせ済み**。
（[high]＝**山に戻せないカードを場から抜いてゲームから消す**保存則違反が3箇所／
 **公家が場に0枚で +3購入**＝`random-promo` の闇市場で今日到達する出荷済みバグ）。

## 次にやる具体的タスク
### 優先1＝**絵（webp）50枚の回収**（ユーザーの作業が要る）
**旭日50枚だけが枠＋文字**（他の761枚は絵入り）。ChatGPT への**指示文5バッチは作成済み・リポジトリ内**：
**`docs/research/risingsun_art_prompts.md`**（1バッチ10枚 × 5。そのままチャットに貼る）。
作り方の流儀はメモリ `chatgpt-card-art-workflow`。
- ⚠ **連番＝生成順を信用せず、全候補から全単射で判別する**（過去に取り違えが起きている）。
- ⚠ 紛らわしいペア＝**侍／忍者／大名／浪人**（全部「武士」系）・**山の社／川の社**・**茶屋／魚屋**。
- 回収＝`asset/art/<id>.png` → `CARDS_ONLY=<ids> node tools/build-cards.js`（王国25）／
  `CARDS_ONLY=<ids> node tools/build-landscape.js`（イベント10＋予言15）→ `sw.js` を **v82** へ。
- 絵が入ったかは**ファイルサイズで検算**（枠＋文字＝40〜70KB／絵入り＝80KB超）。
- 最後に **Downloads の原本を掃除**（`asset/art/*.png` と sha1 一致する PNG だけ消す）。

### 優先2＝**push**（ユーザー確認の上で）
push すると本番 Pages/Render に旭日が出る。**本番反映は機械照合で確かめる**
（`sw.js` の VERSION／`js/*.js` の sha1 一致／webp のバイト一致／Render は `GET /status` と実 ws）。
⚠ **Pages のデプロイがゾンビ化して以後を全部 400 で弾くこと**がある＝
`gh api -X POST repos/ankake-web/dominion/pages/deployments/<旧SHA>/cancel` で解除（§6 に手順）。

### 優先3＝**未実装33種の実装**（PROGRESS §0-40 の表）
✅ **19種（海辺 第1版8／繁栄 第1版9／プロモ2）の段階0は完了**＝正本 `docs/research/missing19_rules.md`（308KB）。
   **着手前に冒頭の「実装前に必読」12項目＋重大な訂正2件を必ず読む**。
海辺 第1版8・繁栄 第1版9・プロモ2 は既存機構でほぼ書ける。
🛑 **最重量は収穫祭＆ギルド第2版の Ferryman**＝「$3〜$4 の王国カード1山をサプライ外に置く」
＝本アプリに前例の無い非サプライ機構。褒賞(Reward)6種は賞品(Prizes)と同型。
⚠ **日本語名の誤り14件と `harem`→`Farm` 改名は webp 再生成が要る**＝旭日の絵入れとまとめてやる。

### その先
**第17拡張 Arcana**（2026年予定・500枚・王国37山・Study/Cart/Project）は
**カード名すら未公開なので着手不能**。データが出ていれば段階0（研究）から。
それまでは既存の磨き込み（CPU 購入AIの拡張別チューニング等）が候補。

## 守るべき進め方
- **多エージェント＋敵対的検証**でやる（研究・カタログ・レビューとも）。型は §6「研究・調査の型」。
- **バグは必ず node で再現してから直す**／**回帰テストはバグ注入で感度を確かめる**。
- **engine を締めたら CPU と UI も同じコミットで直す**（窓・受理・CPU候補・UIフィルタの4面）。
  新しい pending は**4点セット必須**（engine reducer＋`PLAYER_ACTIONS`＋CPU `decidePending`＋UI `viewPendingModal`）。
- **client 資産（js/css/webp/sw）を変えたら `sw.js` の VERSION を上げる**（今 **v82**）。
- 使い捨てスクリプトは**プロジェクト直下に `_*.tmp.js`** で作り**実行後必ず削除**（`_*` は gitignore 済み）。
- **push はユーザー確認**（コミットは自由）。
- 実ブラウザ検証は **`E2E_SET=旭日 npm run verify:e2e`** で拡張セットを選べる
  （無指定なら既定セット。旭日は 11/11 緑を確認済み）。
- **日本語wiki（wikiwiki.jp）は並列で叩くと 429 で全滅する**＝エージェントに触らせず自分で逐次に取る。

## 知らないと事故ること
- 🛑 **レビューエージェントを走らせる前に必ずコミットする**。2026-08-21 に、走らせたエージェントの1体が
  `git checkout` で**私の未コミット修正（engine.js / ui.js）を丸ごと巻き戻した**。
  「コードを変更するな」と指示しても起こる＝**未コミットの作業を抱えたままレビューを投げない**。
  また API エラーで数体が落ちるので、**重要な検証は自分でもやる**。
- 🛑 **`node -e "..."` の中で日本語やテンプレートリテラルを含む複数行置換をしない**（シェル展開で壊れる）。
  Edit ツールを使うか、Write でパッチスクリプトを作ってから実行する。
  **作業ツリーは CRLF** なので、スクリプトで複数行検索するときは `.replace(/\r\n/g,'\n')` で正規化する。
- **予言(Prophecy)の効果は必ず `prophecyActive(state, id)` で書く**（`hasProphecy` は準備処理専用）。
  **発動フックで `state.pending` を直接立てない**＝`queueProphecy` に積む。
- **§E の一般則**＝「後（After／たび）」型は起動した前兆自身も恩恵を受ける（偉大な指導者・来寇）／
  「先に（first）」型は受けない（豊作）。**略奪の "next time" 型とは正反対**。
- **`modalGainSupply` の辞退ボタンは第6引数 `skipOnEmpty` に関数が要る**
  （第7引数 `alwaysSkip: true` だけでは絶対に出ない＝賛辞で [high] を踏んだ）。
- **`modalSingleHand` の skip は `{label,on}` 必須**（boolean `true` は押せない死にボタン）。
- **`finishGain` は pending を残したまま `gain()` を呼ぶ**＝獲得時対話（望楼など）が `!state.pending` ゲートで
  潰れる。**複数枚を連続で獲得する効果は植民(Populate)型**（pending を先に閉じてから `gain`）にする。
- **`finishGain` / `takePlayable` / `playPlayable` は boolean を返す**＝`return finishGain(...)` は禁止。
- **効果で負債を得るときは `addDebt`**（`takeDebt` はコスト欄を読むので効果では黙って0）。
- 🛑 **「山に戻す」効果は必ず `canReturnToPile` を先に確認してから場から抜く**（窓を開く側も同じ述語）。
  確認せずに `removeOne`→`returnToPile` すると**カードがゲームから消滅する**（闇市場で買った札・神風で撤去された山）。
- 🛑 **神風に派生セットアップを足すときは `applyDivineWind` の ⑤ ブロックにも足す**
  （`createInitialState` が `initSupply` の**外**でやっている 廃墟／馬／災いカード／川船の脇札 は手動）。
- **「財宝を使用した」ときのフックは `noteTreasurePlayedForProphecy` の1箇所に書く**
  （`playTreasureCard` だけに書くと `playCardNoAction` 経由が全部落ちる）。
- **`t.bpGained` は `END_ACTION_PHASE` で 0 に戻る**＝「このターン購入フェイズに獲得したか」は `t.buyPhaseGained`。
- **「+N カード」の文字列を持たないドロー**（浪人＝`Draw until you have 7 cards in hand`）は
  **カメレオンの習性で変換しない**（`state._chamOff`）。**「N枚になるまで引く」は1枚ずつ引き、
  終端は「山札と捨て札が両方空」で判定する**（引けた枚数0で止めると -1カードトークンで壊れる）。
- **選択肢を順に解決する効果は pending が立ったら残りを `t.*Rest` に積んで中断する**
  （その場で全部回すと、途中の獲得/廃棄が開いた窓を後続が上書きして消す）。
- **群A（最終的に場に出る窓）と群B（捨てる/廃棄する/脇に置く/山に戻す窓）を混同しない**。
  群Aは `test/risingsun.test.js` の `A_WINDOWS` 表（19窓）が4面整合を自動検査する＝**新しい窓は表に1行足す**。
- **新しいカードを engine に足したら CPU の `chooseAction` にも足す**（R4a/R6 の7種を入れ忘れて
  「CPU が一度も使わない＝ソークが経路を検証しない」状態になった）。
- **`c:\tmp` には本業の `LiS_AF_資料一式` があるので一括削除しない**。
  旭日の一次資料は `C:/tmp/risingsun_research/`（ルールブックPDF・wiki 出力・8群の doc・`g0_jp_pairs.md`）。
  正本＝`docs/research/risingsun_rules.md`（847KB）。
