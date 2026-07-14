# mix-all モード解禁のためのエンジン硬化 計画（正本）

2026-07-14 作成。**多エージェント監査＋敵対検証（各 finding を node で再現確定）＝確定23件**の修正計画。
監査WF＝5観点（汎用「$N以下を獲得」／「ちょうど$N を獲得」／CPU・UIの述語ズレ／支配 Possession／その他 cross-expansion）。

## 背景
「拡張を自由に混ぜるランダム対戦（mix-all）」を解禁すると、PROGRESS §6 / §0-10 に
**「どの出荷 CARD_SET でも同居しないから未修正」**と明記して先送りしてきた簡略化の前提が崩れ、**全部が到達可能になる**。
この文書はその穴を潰すための作業指示書（上から順に潰せば終わる形にしてある）。

## 現状
- **mix の配線は実装済み・全37スイート緑**：cards.js（`DOM.isMixSet` / `parseMixSet` / `makeMixSet` /
  `kingdomForSet` / **`landscapesForSet`＝横型3種を一度に決める唯一の入口** / `setDisplayName` /
  `MIX_KINGDOM_POOLS` / `MIX_LANDSCAPE_POOLS`）、ui.js（「ミックス」分類＝拡張チップ＋横型の枚数/抽選元）、
  server（`isValidKingdomSet`＝形式＋プール名を検証）、css（`.mix-chip`）。
- **この硬化が終わるまで push してはいけない**（mix を選ぶと下記の穴に到達できる）。

---

# mix-all 解禁 修正計画（実装者向け・上から順に潰す）

## 0. 大原則
- **述語は engine に1本化し、engine reducer / `anyGainable` ゲート / CPU 候補選び / UI モーダル filter の4面が同じ関数を呼ぶ**。個別 `if` 追加は禁止（今回の穴は全部「同じ条件を2箇所に手書きして片方で落とした」もの）。
- **engine を締める修正と CPU を締める修正は必ず同一コミット**（engine だけ締めると CPU が拒否される札を提案し続けて本番 livelock。監査で実測済み）。
- 公式のコスト比較は **coin / potion / debt の成分別**。`$4+P` は "up to $4" でなく、`$0+負債8` は "exactly $0" でない。

---

## 1. 【最優先】共通ヘルパを新設（js/engine.js）

`costIsPlainCoin`（engine.js:2603）と `upToCanGain`（engine.js:5970）の隣に集約。既に正しい実装が `improve`(10186/10199) と `charm`(5349/10711) にあるので、それを昇格させる形。

```js
function costOf(state, id) {                       // 3成分
  const c = C()[id] || {};
  return { coin: cardCost(state, id), pot: potionCost(id), debt: c.debt || 0 };
}
function gainableBase(state, id) {                 // 全獲得の土台（既存 upToCanGain の前半）
  return !!C()[id] && !NON_SUPPLY.has(id) && !splitLocked(state, id) && (state.supply[id] || 0) > 0;
}
function costUpTo (state, id, coin, spec) { const c=costOf(state,id), s=spec||{};      // 「$N以下」
  return gainableBase(state,id) && c.coin<=coin && c.pot<=(s.pot||0) && c.debt<=(s.debt||0); }
function costUnder(state, id, coin, spec) { /* 同上・c.coin < coin */ }                 // 「より安い」
function costExact(state, id, coin, pot, debt) { const c=costOf(state,id);              // 「ちょうど」
  return gainableBase(state,id) && c.coin===coin && c.pot===(pot||0) && c.debt===(debt||0); }
function sameCost(state, a, b) { const x=costOf(state,a), y=costOf(state,b);            // 詐欺師/御守り
  return x.coin===y.coin && x.pot===y.pot && x.debt===y.debt; }
```
- **exact 系の pending には `exact` だけでなく `pot` / `debt` も焼き込む**（procession/improve が既にこの形）。
- `DOM.engine` に **`costUpTo` / `costUnder` / `costExact` / `gainableBase`** を公開（engine.js:11871 のエクスポート表に追加）。CPU と UI はこれ「だけ」を見る。
- 例外（コスト制限が無いのが公式・触らない）：`hero_gain`(4672/8568＝任意の財宝)／`squire_trash_gain`(5477/8126＝任意のアタック)。ただし NON_SUPPLY 除外は維持。
- `upToCanGain`/`seawayCanGain`/`banquetCanGain`/`advanceCanGain`/`inventorGainable`（5970-5993, 1401, 2946）は新ヘルパの薄いラッパに書き換え（挙動不変）。

---

## 2. 【high】置換サイト一覧（漏れゼロ用チェックリスト・engine.js）

### 2-1. 「$N以下 / より安い」→ `costUpTo` / `costUnder`（ゲートと reducer の**両方**）
| カード | ゲート(anyGainable) | reducer(canGain) | 今の欠落 |
|---|---|---|---|
| 工房 | 3143 | 6960 | NON_SUPPLY/pot/debt 全部 |
| 鉄工所 | 3189 | 7062-7068 | 同上 |
| 祝宴 | 3337 | 7263 | 同上 |
| 武器庫 | 3681 | 8091 | 同上 |
| 職人 | 3456 | 7570-7576 | 同上 |
| 鉱山 | 6924 | 6929-6932 | NON_SUPPLY/pot（財宝フィルタは残す） |
| 改築 | 6947 | 6952-6955 | 全部 |
| 身代わり | 7725 | 7730 | 全部 |
| 取り壊し | 7862 | 7869 | 全部 |
| 拡張 | 9438 | 9442-9447 | 全部 |
| 軍用金 | 9502 | 9506 | 全部 |
| 金床 | 9564 | 9568 | 全部 |
| 豊穣の角 | 366 | 9826-9827 | pot/debt |
| 祭壇 | 3732 | 8233/8241 | pot/debt |
| 地下墓所 | 5483 | 8263 | pot/debt（under） |
| 墓暴き | 8316 | 8324 | pot/debt |
| 建て直し | 8346 | 8358 | pot/debt |
| 隠遁者 | 8454 | 8462 | pot/debt |
| 石工 | 10788 | 10797 | pot/debt（under） |
| 肉屋 | — | 10939 | pot/debt |
| 収税吏 | — | 10888 | pot |
| 値切り屋 | 5519 | 11611 | pot/debt |
| 国境の村 | 5288 | 11256 | pot/debt（under） |
| 狂戦士 | 4467 | 11483 | pot/debt |
| 車大工 | 11527 | 11537 | pot/debt |
| 変容 | 8944 | 8953 | debt |
| 大学 | 4115 | 9268 | debt |
| 技術者 | 10366/10385 | 10386 | pot |
| 使者 | 6379 | — | pot |
| ≤$4/≤$3 の残り | 2730 / 3827 / 8776 / 11427 | 同 | pot or debt |
| 封鎖 | 3992 | 9134（→§3へ） | 全部＋gain未経由 |

### 2-2. 「ちょうど / 同コスト」→ `costExact` / `sameCost`
- 改良 7480 / 7489 ・ リメイク 9681 / 9692 ・ 開発 2348 / 11024-11029 ・ 農地 11595 / 11605
- 総督 7828 / 7840 ・ 工匠 11379 / 11389 ・ 溶鉱炉 9463 / 9471
- 石工(過払い) 1006 / 10738-10743 ・ 行進 6200 / 8485（pot はあるが debt 無し）
- **詐欺師 1077 / 7140**（`sameCost(state, 廃棄札, id)` に。銅貨$0→大君主$0+負債8 の押し付けを塞ぐ）
- 参照実装（変更不要・コピー元）：御守り 5349/10711、増築 10186/10199

---

## 3. 【high】gain() / trashCard を通らない経路（保存則・NON_SUPPLY）

1. **BLOCKADE_GAIN**（9134-9148）：`supply--` + `setAside.push` 直挿し → **`gain()` に `dest:'setAside'` を追加して必ず gain 経由**（混合山 shift・負債付与・splitLocked・triggerOnGain が一括で効く）。canGain は `costUpTo(state,id,4)`。`armDuration` の `gained` には gain が置いた**実カードid**を渡す。ゲート 3992 も同じ述語に。
2. **LURKER_TRASH / LURKER_GAIN**（7662-7672 / 7673-7682）：述語を `gainableBase && isType('action')` に。混合山（'knights'/'castles'/'ruins'）は**新ヘルパ `trashFromSupplyPile(state, pi, pileId)`**（SALT_TRASH 6672 付近の実装＝`state.castles.shift()` + supply 同期 を抽出）へ。LURKER_GAIN も trash 内の**混合山プレースホルダを弾く**。
3. **MINT_REVEAL**（9417-9428）：`if (supply>0)` → `gainableBase(state, card)`（戦利品/賞品のコピーを塞ぐ）。
4. **密輸人**：候補 3964-3971 と **SMUGGLERS_GAIN 9121-9133 の両方**に `costUpTo(state,id,6)`（pending の候補配列は永続化スナップショットから無変換復元されるので受理時にも再検証＝`pendingSelf` と同じ罠）。
5. **TRADER_REACT**（11133-11147・gate 5304）：`state.supply[pd.card]++` を **`returnToPile(state,id)`** に（混合山は `pileKeyOf` で山キー正規化＋`state[pile].unshift`）。**サプライ由来でない獲得（闇市場札）は窓自体を開かない**＝gate 5304 に `Object.prototype.hasOwnProperty.call(state.supply, cardId)` を追加（3面同述語）。

### 自己廃棄が `trashCard` を通っていない5か所（→ `trashCard(state, pi, id)` に統一）
`investment` 328 ／ `feast` 3336 ／ `treasure_map` 3904, 3906 ／ `mining_village` 7088 ／ `horn_of_plenty` 9832
→ これ1点で **支配の退避**（§4）と **墓標/司祭/下水道/青空市場の廃棄トリガー**が同時に正しくなる。
※逆に **サプライからの廃棄**（`gladiator` 2005 / `lurker` 7668 / `SALT_TRASH` 6686）は `trashCard` を通してはいけない → 上記 `trashFromSupplyPile` に寄せる（支配で退避されない・墓標は発火する）。

---

## 4. 【支配（Possession）】別章

1. **負債の受取人が逆**（gain() 828-838 が 840-846 の支配分岐より前）→ ヘルパ `takeDebt(state, pIndex, dbt)` を作り、**支配中は `t.possessedBy` 側に付ける**。`BLACK_MARKET_BUY`（7908-7909 付近）の負債直挿しも同ヘルパへ（※こちらは promo-pack で**既に到達可**＝mix 前からの実バグ）。
2. **サプライ外からの獲得が支配振り分けを素通り** → 共通ヘルパ `gainCard(state, pi, id, dest, {fromTrash|fromBlackMarket})` に集約（支配中は `possessionGains` へ→ triggerOnGain も獲得者=支配者で発火）。対象：`LURKER_GAIN` 7678 ／ `GRAVEROBBER_FROM_TRASH` 8300 ／ `ROGUE_GAIN_FROM_TRASH` 8689 ／ `TREASURER_GAIN` 10330 ／ `THIEF_GAIN` 7255 ／ `BLACK_MARKET_BUY` 7905。`gain()` はこの薄いラッパにする。
3. **支配中の獲得で triggerOnGain が一切発火しない**（gain() 840-846 の早期 return）→ `possessionGains` に積んだ後 `triggerOnGain(state, t.possessedBy, realId, 'discard')`。**移動を伴う on-gain（ヴィラ/国境の村の入れ子獲得/貨物船/物見やぐら）は「移動だけ失敗し残りは解決」**＝命令(Command) の `takeSelf`/`playedByCommand` と同じ設計を流用。※ 影響が読み切れなければ「意図的簡略化として据え置き（low）」でも可＝ただし PROGRESS §6 に明記すること。
4. **塩まきの逆問題**：`SALT_TRASH` 6686 が `trashCard(owner=被支配者)` を呼び possessionTrash へ退避→**サプライの属州が被支配者にタダで湧く**。上記 `trashFromSupplyPile` に置換して解消。
5. §3の自己廃棄5か所を `trashCard` 化すると、支配中の永久廃棄（祝宴/鉱山の村/宝の地図/豊穣の角/投資）が同時に直る。

---

## 5. 【high】CPU（js/cpu.js・engine と同一コミット）
- `bestGain` 84-96 / `bestGainExact` 99-117：**既存の `plainCoin`(121) を適用**（debt は除外済み・potion が抜け）。
- `pickSwindlerGift` 960：3成分一致（`sameCost` 相当）＋ potion/debt 除外。
- **自前 GAIN_ORDER ループ（`splitBlocked` 欠落＝engine 拒否と噛み合って無限ループ）**：1537(transmogrify) / 1662(charm) / 1978(石工の過払い額) / 1989(stonemason_overpay) / 2127(wheelwright) / 2269(procession_gain) / 2228(rebuild) / 2171(squire) / 1830(university) / 413・2263(upgradeable 判定) → **すべて `firstGainable`(122) 経由か `DOM.engine.costUpTo/costExact` に置換**。
- 原則：**engine が拒否する id を CPU が返さない**ことを述語共有で保証（コピペ述語を残さない）。

## 6. 【high】UI（js/ui.js）
- `modalGainSupply`(2760-2762) の `filter` は現状 `effCost` だけ → **呼び出し側 40 箇所の filter を `DOM.engine.costUpTo/costUnder/costExact/gainableBase` に置換**（ロック中の分割山下段・混合山プレースホルダ・ポーション/負債札がチップに出なくなる）。
  代表：1442 鉱山 / 1447 改築 / 1449 工房 / 1469 鉄工所 / 1588 改良 / 1591 詐欺師 / 1611 祝宴 / 1639 職人 / 1648 待ち伏せ / 1654 身代わり / 1669 総督 / 1671 取り壊し / 1873 変容 / 1925 工匠 / 1930 使者 / 1935 封鎖 / 1977 拡張 / 1979 溶鉱炉 / 1981-1982 軍用金 / 1994 金床 / 2016 リメイク / 2048 豊穣の角 / 2061・2069 石工 / 2075 収税吏 / 2080 肉屋 / 2093 開発 / 2136 国境の村 / 2137 織工 / 2144 狂戦士 / 2146 車大工 / 2154 農地 / 2155 値切り屋 / 2170 武器庫 / 2190 祭壇 / 2194 地下墓所 / 2204 墓暴き / 2206 建て直し。
- 安全網：`modalGainSupply` 内で `filter(id) && DOM.engine.gainableBase(state,id)` を**常に and する**（呼び出し側の書き漏れを1か所で吸収）。

---

## 7. 回帰テスト（穴ごとに最小1件・新規 `test/mixall.test.js`）
- 溶鉱炉 0枚廃棄（exact $0）→ `FORGE_GAIN vineyard`($0+P) が**拒否**され pending が残る。
- 工房 → `WORKSHOP_GAIN spoils` / `followers` / `warrior` が拒否（NON_SUPPLY）。
- 拡張（金貨廃棄）→ `EXPAND_GAIN possession`($6+P2) 拒否。
- 大学 → `UNIVERSITY_GAIN overlord`($0+負債8) 拒否／技術者 → `ENGINEER_GAIN vineyard` 拒否。
- 詐欺師（相手の銅貨$0廃棄）→ `SWINDLER_GAIN overlord` 拒否・相手 debt=0 のまま。
- 工匠 0枚捨て（exact $0）→ `ARTIFICER_GAIN city_quarter` 拒否。
- 鉱山（銅貨廃棄）→ `MINE_GAIN philosophers_stone` / `spoils` / `diadem` 拒否。
- 密輸人（右隣が spoils / engineer を獲得）→ candidates が空。
- 封鎖 → `BLOCKADE_GAIN castles` で **tally 不変**（プレースホルダが増えない）＋ `rocks`(ロック下段) 拒否 ＋ `engineer` で debt=4 が付く ＋ `villa` の on-gain が発火。
- 待ち伏せ → `LURKER_TRASH knights` で tally 不変（`state.knights` が減り supply 同期）／`champion`・`followers`・分割山下段が候補外。
- 造幣所 → `MINT_REVEAL spoils` で獲得0。
- 交易商人 → 騎士/城/闇市場札の獲得を公開しても `state.supply` に新キーが生えない（`Object.keys(supply)` 不変）。
- CPU 終端：分割山下段ロック中の `procession_gain` / `stonemason_overpay` / `wheelwright` / `transmogrify_gain` / `charm_gain` で **CPU が 40手以内に pending を閉じる**（同一 pending 連続 = 0）。
- 支配：①$0+負債8 購入で **支配者に debt**・被支配者 debt=0 ②祝宴/鉱山の村/宝の地図/豊穣の角/投資が possessionTrash 経由で**返却される** ③塩まきの属州が **trash に入り被支配者に渡らない** ④廃棄置き場獲得4種＋闇市場が `possessionGains` に入る ⑤（実装するなら）死の荷車を支配ターンに購入 → **支配者が**廃墟2枚。
- invariants：`mix-all`（全プール混成・分割山＋混合山＋非サプライ山＋負債＋ポーションを同居）の fuzz を追加＝保存則・非ループ・負リソース。

## 8. 仕上げ
`npm test` 全スイート緑 → `verify:e2e` → `sw.js` VERSION++ → PROGRESS §6 の「ポーション/負債は同居しないので未修正」「闇市場に段階1プールが漏れる」の注記を**解消済みに書き換え**（mix-all 前提に更新）。