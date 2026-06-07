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

## 枠画像（assets/frames/）
種別ごとに6種：`treasure.jpg`(金) / `victory.jpg`(緑) / `curse.jpg`(紫) /
`action.jpg`(青) / `attack.jpg`(赤) / `reaction.jpg`(青緑)。
全種で同じ領域配置（コストバッジ・名前バナー・種別バナー・中央枠・効果欄）。
差し替える場合は同じ領域配置のものにすると、文字の位置がそのまま合います。

> 元の高解像度PNGは `pictier/` に保管（git管理外）。
