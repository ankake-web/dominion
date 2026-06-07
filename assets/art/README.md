# カード中央イラストの置き場所

各カードの**中央イラストだけ**を置きます。カードの枠は `assets/frames/<type>.jpg`（種別ごとの枠画像）、
コスト・名前・種別・効果は CSS で重ねて描画します。アプリは `assets/art/<id>.jpg` を読み込みます。

## 収録状況：17/17 すべて配置済み
copper, silver, gold, estate, duchy, province, curse, cellar, market, militia,
mine, moat, remodel, smithy, village, woodcutter, workshop

## 差し替え・追加のしかた
- ファイル名は `assets/art/<id>.jpg`（例: 屋敷なら `estate.jpg`）。
- **大きな主題を1つ**・明るめ/カラフルに。文字・枠・コストは入れない（枠とテンプレ側で描画）。
- 中央枠は `object-fit: cover` で切り取り表示。横長/正方形どちらでも可。
- 重い画像は `sips -s format jpeg -s formatOptions 88 -Z 850 入力 --out assets/art/<id>.jpg` 程度に縮小推奨。

## 枠画像（assets/frames/、透明窓つきPNG）
8種：財宝は金属別に `copper.png`(銅) / `silver.png`(銀) / `gold.png`(金)、
ほかは `victory.png`(緑) / `curse.png`(紫) / `action.png`(青) / `attack.png`(赤) / `reaction.png`(青緑)。
- **中央窓は透明**。イラストは枠の**背面**に置き、窓から見える分だけが表示される（金縁が絵の縁に被さる“はめ込み”）。
- 全種で同じ領域配置（コストバッジ・名前バナー・種別バナー・中央窓・効果欄）。差し替えは同配置のものに。
- カードとフレームの対応は `js/cardview.js` の `TREASURE_FRAME`（銅/銀/金）と `card.type`（それ以外）で決まる。
- 窓が市松模様（不透明）で書き出された枠は、中央bbox内の低彩度ピクセルを alpha=0 にして透明窓化している（canvas処理）。

> 元の高解像度PNG（`frame_*.png` 等）は `pictier/` に保管（git管理外）。
