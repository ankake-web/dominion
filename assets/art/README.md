# カード中央イラストの置き場所

各カードの**中央イラストだけ**を置きます（カード枠・コスト・名前・種別・効果欄は CSS/SVG で描画）。
アプリは `assets/art/<id>.jpg` を読み込みます（元の高解像度PNGは `pictier/` に保管・gitには載せません）。

## 現在の収録状況（17種中16種）

配置済み（16）: copper, silver, gold, duchy, province, curse, cellar, market, militia,
mine, moat, remodel, smithy, village, woodcutter, workshop

未配置（1）: **estate（屋敷）** … イラストが無いため、テンプレートのアイコン（🏡）で仮表示。
`assets/art/estate.jpg` を置けば自動で反映されます。

## 差し替え・追加のしかた
- ファイル名は `assets/art/<id>.jpg`（例: 屋敷なら `estate.jpg`）。
- **大きな主題を1つ**・明るめ/カラフルに。文字・枠・コストは入れない（テンプレ側で描画）。
- 中央枠は `object-fit: cover` で切り取り表示。横長/正方形どちらでも可。
- 重い画像は `sips -s format jpeg -s formatOptions 88 -Z 850 入力 --out assets/art/<id>.jpg` 程度に縮小推奨。
