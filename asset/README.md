# カード画像（完成カード1枚絵）

各カードは **`asset/<id>.jpg`** の1枚画像です。枠・コスト・名前・種別・効果まで
すべて描き込み済みの「完成カード」で、アプリ側で枠や文字を重ねません。

- 対戦画面・拡大表示・カード一覧(cards.html) すべてこの画像を表示します。
  - 対戦画面/拡大: `js/ui.js` が `asset/<id>.jpg` を読み込み
  - 一覧/プレビュー: `js/carddata.js`・`data/cards.json` の `art` が `asset/<id>.jpg`
- 17種: copper, silver, gold, estate, duchy, province, curse, cellar, market,
  militia, mine, moat, remodel, smithy, village, woodcutter, workshop

## 差し替え・追加のしかた
- ファイル名は `asset/<id>.jpg`（例: 銅貨なら `copper.jpg`）。縦長（カード比 ~1060:1484）。
- 重い原本(PNG等)は **`asset/` に置いても `asset/*.png` は配信されません**（.gitignore）。
  仕上げの軽量JPGだけを `<id>.jpg` で置いてください。
- 軽量化の目安:
  `sips -s format jpeg -s formatOptions 85 -Z 980 入力.png --out asset/<id>.jpg`
  （700×980前後・1枚300KB程度・17枚で約5MB）。

> 旧方式（`assets/` のイラスト＋枠画像＋CSS合成、`pictier/` の原本）は廃止しました。
