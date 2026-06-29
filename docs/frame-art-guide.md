# 枠画像（フレーム）生成ガイド — `asset/frames/<type>.png`

カード表示は **「枠と文字はコード描画／“絵だけ”をAI生成してはめ込む」合成方式**。
このガイドは、その**枠（フレーム）を画像で用意する**ためのもの。種別ごとに **6枚だけ** 作れば、
全77枚のカードが完成形の見栄えになる（文字・数字・各カードの絵はコード側が載せる）。

- 仕組み：`js/cardview.js` は既定で `asset/frames/<type>.png` を読みに行き、**読めれば画像枠を表示し SVG枠を隠す**。
  無ければ現行の SVG枠にフォールバック（テスト緑のまま）。→ **6枚置くだけでコード変更なしに切り替わる**。
- 文字（カード名・種別・効果・コスト数字）は**コードが枠の上に重ねる**。だから**枠画像には文字・数字を一切描かない**。
- 各カードの絵は `asset/art/<id>.png`（→ `docs/art-manifest.md`）。枠の**中央の窓（透明）**から見える。

---

## 0. 結論（最低限これだけ守れば動く）
1. **サイズ `1000 × 1515 px`（縦長）/ PNG / アルファ付き**。
2. **中央の正方形「窓」を完全に透明（alpha=0）にする** … 下に置く絵がそこから見える。
   - 窓の範囲：**左上 (126, 378) 〜 右下 (874, 1126)**＝**748×748 の正方形**（中心 (500, 752)）。
3. **文字・数字を一切描かない**（カード名/種別/効果/コスト数字はコードが載せる）。
4. **配置を型紙 `docs/frame-templates/<type>.png` に合わせる**（コスト章・名前帯・種別帯・羊皮紙パネルの位置）。
   - いちばん簡単で確実なのは、その型紙を **img2img のベース画像**にして金の質感だけ上書きすること（§4）。
5. ファイル名は種別キーそのまま：`treasure / victory / curse / action / attack / reaction` → `asset/frames/<type>.png`。

> ⚠️ 型紙 `docs/frame-templates/*.png` は現行SVG枠を画像化しただけ（位置合わせ用）。**そのまま本番枠にしない**。
> これを下敷きに「絵画的な金」を生成して `asset/frames/` に出力するのがこのガイドの目的。

---

## 1. レイアウト地図（1000×1515 px 座標）

出力は 1000×1515 px なので、以下は**そのままピクセル座標**として使える（型紙SVGの viewBox と一致）。
コード側はこの座標に文字を重ねるので、**この位置からズラさないこと**が最重要。

| 要素 | 位置（px, 1000×1515） | 枠画像での描き方 |
|---|---|---|
| **外周** | 0,0 – 1000,1515（角丸 ~46） | 黒に近い極細の縁＋**金の二重枠レール**。 |
| **金の二重枠** | 外レール中心 38–962 / 内ライン 56–944 | 太い金レール＋内側に細い金ライン。**画像枠の主役＝この金の質感**。 |
| **四隅の金具（ロゼット）** | (78,78) (922,78) (78,1437) (922,1437) 各 半径~26 | 花弁状の金の飾り＋中央に種別色の宝玉。任意だが基準カードに寄せると映える。 |
| **コスト章（コイン）** | 中心 **(150,150)**、外半径 **~104**（およそ 46–254 × 46–254） | 同心円で彫り込んだ金のメダル。**中心 半径~69 は明るいクリームの座面**にし、**数字は描かない**（コードが載せる）。 |
| **名前帯（上辺）** | **270,44 – 930,244**（内側座面 284,58 – 916,230） | 金縁のプレート。中身は**その種別の濃い宝石色の平面**。**文字なし**。 |
| **種別帯（中央やや上）** | **228,286 – 772,358**（中心 y≈322 の横長リボン／六角形） | 金縁の細いリボン状プレート。中身は種別色の座面。**文字なし**。 |
| **中央の窓（絵が入る）** | **窓＝透明 126,378 – 874,1126（748×748）** / 金の額縁 120,372 – 880,1132 | **窓の内側は完全透明**。窓のフチに金の額縁を回す。 |
| **羊皮紙パネル（下部・効果欄）** | **70,1168 – 930,1446**（内側 84,1182 – 916,1432） | 金縁＋**羊皮紙（生成りのパーチメント）**。**文字なし**（効果テキストはコードが載せる）。 |

要するに上から：**コスト章（左上）＋名前帯（上）→ 種別帯 → 大きな透明窓 → 羊皮紙パネル（下）**、全体を**金の二重枠＋四隅金具**が囲む。

---

## 2. 種別ごとの色（6種）

**金（枠・コイン・各プレートの縁）は6種すべて共通。** 違うのは**背景／プレート座面の「宝石色」と宝玉の色**だけ。
下の宝石色を“濃い座面色”として使う（基準は現行CSSの `--frame*`）。

| type（ファイル名） | 日本語 | テーマ宝石色 | 背景/座面の色（濃 → 最濃） | 雰囲気キーワード（英語プロンプト用） |
|---|---|---|---|---|
| `action`   | アクション | 深い青（ロイヤルブルー） | `#234d86` → `#112a52` → `#0a1838` | deep royal blue, sapphire, navy |
| `attack`   | アタック | 深い赤（クリムゾン） | `#7e2422` → `#4c1212` → `#2a0a0a` | deep crimson red, garnet, blood red |
| `reaction` | リアクション | 深い青緑（ティール） | `#15605b` → `#0c3a37` → `#06211f` | deep teal, emerald-cyan, viridian |
| `treasure` | 財宝 | 琥珀・黄金茶 | `#7c5a14` → `#483205` → `#281b04` | warm amber, dark gold-brown, topaz |
| `victory`  | 勝利点 | 深い緑（エメラルド） | `#1c5e31` → `#103a20` → `#07210f` | deep emerald green, forest green |
| `curse`    | 呪い | 深い紫（バイオレット） | `#482670` → `#2c1546` → `#170a28` | dark violet purple, amethyst, eerie |

> 種別の対応は `js/carddata.js` の `frameType()` が正本（**attack > reaction > treasure > action > victory > curse** の優先順で1つに決まる）。
> 例：堀＝action+reaction → `reaction`、民兵＝action+attack → `attack`、後宮＝treasure+victory → `treasure`。

---

## 3. 共通プロンプト（金の質感が主役）

枠の良し悪しは**「絵画的に塗られた温かい金」**で決まる（ここがSVGでは届かなかった点）。
画風は基準カード `asset/<id>.jpg` の金枠に寄せる。

**共通（英語・コピペ用）**
```
ornate gilded card frame, painterly oil-painting style, warm honey-gold metal with
specular highlights and soft reflections, baroque/medieval fantasy ornament,
embossed double gold rail border, four corner gold rosettes with a small gemstone,
a circular embossed gold cost medallion at the TOP-LEFT (smooth cream center, blank),
a gold name banner across the TOP, a small gold ribbon plaque below it,
a large empty SQUARE window in the CENTER, an aged parchment panel at the BOTTOM,
rich {{TYPE_COLOR}} jewel-tone background panels, dramatic warm lighting,
high detail, 1000x1515 vertical, centered, symmetrical
```
`{{TYPE_COLOR}}` を §2 の英語キーワードに差し替える（例 action なら `deep royal blue sapphire`）。

**ネガティブ（英語・コピペ用）**
```
text, letters, words, numbers, digits, typography, watermark, signature,
any picture or scene inside the center window, person, character, landscape,
flat vector, cartoon, low detail, blurry, jpeg artifacts
```
※ **中央の窓には何も描かせない**（絵は別途はめ込む）。`text/letters/numbers` を必ず弾く。

---

## 4. 推奨フロー：型紙を img2img のベースにする（位置ズレ防止）

文字位置をコードと一致させる鍵は **配置を変えないこと**。一番確実なのは型紙を初期画像にする img2img：

1. 初期画像 = `docs/frame-templates/<type>.png`（既に**透明窓・文字なし・正しい配置**）。
2. プロンプト = §3 共通＋§2 の色キーワード。**denoising / strength は 0.4〜0.6 程度**
   （構図＝コスト章・名前帯・種別帯・窓・羊皮紙の**位置を保ったまま**、金や背景の“絵画的な塗り”だけ強化）。
3. 解像度は 1000×1515 を維持（できなければ縦横比2:3に近い大きめで生成 → 1000×1515 に縮小）。
4. **中央の窓の透明を必ず復元する**：img2img は透明部分を塗りつぶすことがある。生成後に
   **中央 (126,378)–(874,1126) の 748×748 を消して alpha=0** に戻す（窓の金額縁は残す）。
   - txt2img で作る場合も同様に、最後にこの窓を切り抜いて透明にする。
5. **文字・数字が紛れ込んでいないか確認**（特にコイン中心・名前帯・羊皮紙）。あれば消す。
6. `asset/frames/<type>.png` として保存。

> img2img が無く txt2img のみの場合：§3 のプロンプトで生成 → 縮小 → §1 の座標に合わせて
> 中央窓 (126,378)–(874,1126) を透明に切り抜く。位置合わせは型紙を半透明で重ねて確認すると速い。

---

## 5. チェックリスト（保存前に）
- [ ] `1000 × 1515 px` / PNG / アルファ付き。
- [ ] **中央 748×748 (126,378)–(874,1126) が透明**（下の絵が見える）。窓のフチに金の額縁。
- [ ] 文字・数字が**どこにも無い**（コスト中心・名前帯・種別帯・羊皮紙パネル）。
- [ ] コスト章は**左上 (150,150) 中心**、名前帯は**上 270–930**、種別帯は**中央 228–772/y≈322**、羊皮紙は**下 70–930/1168–1446**。
- [ ] 金が**温かく艶やか（鏡面ハイライト）**で、背景はその種別の宝石色。
- [ ] ファイル名が種別キー一致：`asset/frames/{treasure|victory|curse|action|attack|reaction}.png`。

## 6. 確認方法
- `cards.html` を開くと、`asset/frames/<type>.png` がある種別は**画像枠**で、無い種別は**SVG枠**で表示される（混在OK）。
- 型紙＝SVG枠の配置を見たいときは `DOM.cardView(card, { noFrameImg: true })`（常にSVG枠）。
- 個別URLを試したいときは `DOM.cardView(card, { frameSrc: '…png' })`。
- ゲーム盤面（`js/ui.js`）は別系統で**この変更の影響を受けない**（プレビュー `cards.html` 専用）。
