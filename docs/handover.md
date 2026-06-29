# 引継ぎメモ（2026-06-28 時点）

ドミニオン Webアプリ（`c:\Users\b1242\claude\game\dominion` / branch `main`）の作業引継ぎ。

## いまの状態
- **全変更は未コミット**（作業ツリーに入っているだけ）。反映は人間判断で。
- **`npm test` = 1205件すべてグリーン**（11ファイル）。まず最初にこれを実行して緑を確認すること。
- 変更/追加ファイル：
  - 変更：`js/cards.js` `js/engine.js` `js/cpu.js` `js/ui.js` `js/carddata.js` `server/gameServer.js` `cards.html` `package.json` `docs/intrigue-cards.md` `test/intrigue-ui.test.js`
  - 追加：`test/edition2.test.js` `test/edition2-ui.test.js` `test/integrity.test.js` `docs/edition2-cards.md`
  - 削除：`data/cards.json`（重複のため。表示データは `DOM.CARDS` から自動導出に）
  - 無関係：`CLAUDE.md` は元からある未追跡のプロジェクト設定（今回の対象外、触らない）

## このセッションでやったこと
### 機能（ユーザー依頼）
1. **勝利点カードの山を人数依存に**：王国の勝利点カード（庭園/公爵/貴族/後宮/大広間/風車）も屋敷/公領/属州と同じく **2人=8 / 3-4人=12**。`engine.js` の `initSupply`。
2. **コストのバグ修正**：間違っていたのは詐欺師(swindler)。正しくは **$3**（誤って$5だった）。密偵(spy)は元から$4で正。
3. **第二版化（陰謀まで）**：初版で廃止のカードは実装を残し「初版・王国基本／初版・陰謀」セットで遊べる。
   - 基本2E追加7種：`harbinger merchant vassal poacher bandit sentry artisan`
   - 陰謀2E追加7種：`courtier diplomat lurker mill patrol replace secret_passage`
4. **プロモ6種**：`walled_village envoy governor dismantle black_market hoard`
   - ※ `hoard`（隠し財産）は厳密には『繁栄』のカード。純正プロモ Stash はシャッフル時配置がエンジンに合わないため、ユーザー確認の名前に合わせて Hoard を採用。
   - 簡略化：城壁のある村＝クリーンアップ時に自動で山札の上へ戻す。闇市場＝サプライ外カードでBMデッキを生成（`maskStateFor`で秘匿）。
5. エンジン/CPU/UI/オンライン(サーバ許可)/カード一覧 すべて対応。CPU対CPUの大量自動対戦で無限ループ0を確認済み。
6. 多エージェントの敵対的ルール検証ワークフローを実施し、実バグ3件（衛兵の情報漏れ＝maskStateFor、外交官ログ、隠し通路UIの真ん中位置）を修正済み。

### 基盤整備（「カードを増やしても壊れない」ための単一ソース化＋自動検証）
- **表示データ単一ソース**：`js/cards.js` の `DOM.CARDS` が正本。`js/carddata.js` は `DOM.CARDS` から名前/コスト/種別/枠色/画像パスを**自動導出**し、`DISPLAY`(icon/effects)だけ持つ（省略可＝種別アイコンとtextで自動表示）。`data/cards.json` は削除。`cards.html` は `cards.js` を読むよう変更。
- **オンライン許可リスト単一ソース**：`DOM.engine.PLAYER_ACTIONS`（engine.js）が正本。`server/gameServer.js` はそれを使うだけ（独自リスト撤去）。
- **アタック登録表**：`engine.js` の `const ATTACKS = {...}` に1行登録すれば、堀/秘密の小部屋/外交官の反応窓口と「無効化時に次の被害者へ」を自動処理。`MOAT_REVEAL` の個別分岐は撤去。
- **効果プリミティブ**：`discardFromHand(state,席,cards,枚数,ログ)` / `trashFromHand(...)` / `finishGain(state,pd,card,canGain,dest,ログ)`（強制獲得のデッドロック回避を一元化）。獲得/捨て/廃棄系リゾルバ10個をこれに置換済み。
- **整合性テスト** `test/integrity.test.js`：reduce の case↔`PLAYER_ACTIONS` 一致／サーバがそれを使う／`GAIN_ORDER`が全カード網羅／プール・セットid健全／表示データのid・名前・コスト一致／react系アタックが全て`ATTACKS`登録済み、を自動検証。**抜けはCIで即赤**。

## カードを1枚足す手順（現行）
詳細は `docs/edition2-cards.md` の「カードを1枚足すとき触る層」。要点：
1. `js/cards.js` の `DOM.CARDS` に定義（＋`DOM.POOLS`/`DOM.CARD_SETS`）。**名前・コストはここだけ**。
2. `js/engine.js`：`applyEffect` の case、選択を伴うなら `reduce` に `*_RESOLVE`。**新アクション種別は同ファイルの `PLAYER_ACTIONS` にも追加**。アタックは `ATTACKS` に1行。定型は `finishGain`/`discardFromHand`/`trashFromHand` を使う。
3. `js/cpu.js`：`chooseAction` 優先順、`decidePending` の case、`GAIN_ORDER`（全カード必須）。
4. `js/ui.js`：`viewPendingModal` の分岐＋`modal*` ヘルパ。
5. （任意）`js/carddata.js` の `DISPLAY` に icon/effects、`asset/<id>.jpg` の絵。
6. サーバは触らない（`PLAYER_ACTIONS`から自動）。
7. `npm test`（特に `test/integrity.test.js`）で抜けを検出。

## 次にやる予定（このチャットの続き）
**カードの絵をユーザーが生成AIで作る**ための土台づくり。方針＝「**枠と文字はコード描画／“絵だけ”をAI生成してはめ込む**合成方式」。

### 経緯：SVG枠は5回差し戻し → 「枠画像方式」に確定（2026-06-29）
コードのみで描く枠（SVG/CSS）の金は、基準カード（`asset/<id>.jpg`＝AI生成の絵画的な金）に**構造的に届かない**（ベクター vs ラスターの本質差。多エージェントのバトルオフでも最良案で金の質感70点、実統合で平板寄り）。
そこでユーザー選択により **「枠も画像にする」方式に確定**：
- **ユーザーが種別ごとに枠画像6枚をAI生成（中央の窓は透明・文字/数字なし）→ 私が文字（コード描画）＋絵をはめ込む。**
- 利点：基準同等の絵画的な金が出て、かつ**文字はコード描画のまま（鮮明・差し替え可）／絵は1枚ずつ差し替え**。生成は枠6枚＋各カードの絵だけ。

### ① 合成カード（枠画像方式）… ✅ 実装＆テスト緑（2026-06-29）
- `js/cardview.js`：**枠は二段構え**。既定で `asset/frames/<type>.png` を読みに行き、**読めれば画像枠を使い SVG枠を隠す**（`root.classList`に `has-frameimg`）／**無ければ SVG枠にフォールバック**。`opts.frameSrc`（URL上書き）・`opts.noFrameImg`（常にSVG枠＝型紙確認用）を追加。
  - **コスト数字は SVG内描画→HTMLオーバーレイ `.dcard-cost` に移設**（画像枠の上にも同じコイン位置に数字が載るように）。彫り込み風の text-shadow。
  - 既存の窓＝`asset/art/<id>.png` を枠の下に置き、枠の窓（透明）から見せる。`onerror`で 絵→絵文字→名前 の段階フォールバックは維持。
- `css/cards.css`：`.dcard-frameimg`（z1, object-fit:fill）＋ `.dcard.has-frameimg` で SVG枠を隠す。`.dcard-cost`（コイン中心15%/9.9%に配置）を追加。複合種別プレートのはみ出しを `4.1cqw`/字間0で確実に解消（堀「アクション・リアクション」も収まる）。
- レイアウトは SVG枠の viewBox(1000×1515)＝**型紙**。画像枠はこの配置に合わせて作れば、SVG枠でも画像枠でも**文字位置は共通**で一致する。
- 影響範囲：**プレビュー(cards.html)専用パス**。ゲーム盤面 `js/ui.js` は別系統で未変更。`npm test` **1205件グリーン維持**。
- 確認：puppeteer 実描画で (a) SVGフォールバック（HTMLコスト数字がコイン面に正しく載る）、(b) 画像枠モード（透明窓PNGを `frameSrc` で流し込み→画像枠表示・SVG非表示・窓越し表示・文字オーバーレイが一度だけ整列）を確認済み。
- **型紙画像を `docs/frame-templates/<type>.png`（6種・透明窓・文字なし）に配置済み**。ユーザーはこの配置に合わせて金枠を生成（img2imgのベースに使うと位置がぴったり合う）。

### ② 次セッションでやること（残タスク）
1. **`docs/frame-art-guide.md`（枠画像の生成ガイド）を書く**：種別6色の枠生成プロンプト＋仕様（1000×1515 PNG、**中央の正方形窓は透明**、文字/数字なし、金枠＋四隅装飾＋コスト円メダル＋名前帯＋種別帯＋羊皮紙パネルを `docs/frame-templates/<type>.png` の配置に合わせる）。出力先＝`asset/frames/<type>.png`（type＝treasure/victory/curse/action/attack/reaction）。
2. **`docs/art-manifest.md`（Task②）を出力**：全77種の id・名前・コスト・種別・効果・おすすめ主題プロンプト一覧。絵の仕様＝**絵だけ**（枠/文字/数字/縁なし）、**正方形1:1**、768px程度、PNG、ファイル名＝カードID（`asset/art/<id>.png`）、共通画風プロンプト＋ネガティブ`text,letters,numbers,border,frame`。データは `DOM.CARDS`（js/cards.js）が正本。
3. ユーザーが `asset/frames/<type>.png`（枠6枚）と `asset/art/<id>.png`（各カードの絵）を配置すれば、その時点から1枚ずつ完成形に差し替わる（コード変更不要）。
- 注：型紙PNG（docs/frame-templates）は現行SVG枠由来なので**そのまま本番枠にはしない**（同じ見た目のラスター版なだけ）。あくまで配置合わせ／img2imgベース用。

## さらに先の改善候補（任意）
- game-icons.net の SVG アイコンへ移行（絵文字の端末差を解消）。
- vanilla効果DSL（純粋な+X系カードをデータだけで書けるように）。
- 効果プリミティブのさらなる拡充。
