# 未実装19種の公式ルール（段階0の正本）

**対象＝PROGRESS §0-40 の網羅性監査で確定した未実装33種のうち、既存機構でほぼ書ける19種。**
残る14種（収穫祭＆ギルド 第2版の王国8＋褒賞6）は **Ferryman が「サプライ外の山」という前例の無い機構**を
持ち込むので別途研究する。

| 章 | 群 | カード |
|---|---|---|
| 1 | 海辺 第1版 A | 抑留(Embargo)／真珠採り(Pearl Diver)／大使(Ambassador)／航海士(Navigator) |
| 2 | 海辺 第1版 B | 海賊船(Pirate Ship)／海の妖婆(Sea Hag)／探検家(Explorer)／幽霊船(Ghost Ship) |
| 3 | 繁栄 第1版 A | 借入金(Loan)／交易路(Trade Route)／護符(Talisman)／禁制品(Contraband)／会計所(Counting House) |
| 4 | 繁栄 第1版 B | 山師(Mountebank)／玉璽(Royal Seal)／投機(Venture)／暴徒(Goons) |
| 5 | プロモ | Marchland／Summon（**本アプリ初のプロモのイベント**） |

一次資料＝英語wiki（`node tools/wikidirect.js "<Card_Name>"`。301追従あり。区切り線は `RAW_DIR` で生HTMLの
`<hr>` を実数）。**各章は「起草 → 別エージェントによる敵対検証」の2部構成**で、
**食い違う場合は検証側が正**（起草より後に同じページを取り直して照合している）。

---

## 🛑 実装前に必読（全章に共通する罠）

1. **新しい state を足すときは「カードか非カードか」を最初に決める**。
   - **非カード**（トークン・マット上のコイン・カウンタ）＝`allCards` にも `test/invariants.test.js` の
     保存則 tally にも**入れない**／庭園・品評会・壁にも数えない。
     前例＝`state.pileVP`（山上の勝利点）／`state.pileDebt`（山上の負債）／`state.pileFavor`（山上の好意）／
     `p.coffers`（財源）／`p.villagers`（村人）／`p.favors`（好意）／`p.vpTokens`。
   - **カード**（脇に置いた実カード）＝`allCards` と invariants の `ZONES` の**両方**に配線する。
2. **山の上に載るトークンの READ / WRITE は必ず `pileKeyOf(state, id)` を通す**。
   §0-20 で徴税が、§A2 で汚された神殿が実際に踏んだ罠＝**分割山の下段や混合山の中身を実カードidで引くと
   トークンが永久に孤児化する**。UI/CPU の候補からも分割山の下段を除くこと。
3. **新しいトップレベル state は遅延生成する**（`state.x = state.x || {}`）＋読み側は必ず存在チェック。
   オンラインは state を**無変換で復元**するので、旧スナップショットに無いフィールドで落ちると**部屋が固まる**
   （§0-17 で `pending.self` の欠落から livelock を踏んでいる）。
4. **山を撤去する神風(Divine Wind) の ⑤ ブロックに、新しい「山の上のトークン」を消す1行を足す**
   （`js/engine.js` の `pileVP`/`pileDebt`/`pileFavor` を `delete` している場所）。足さないと孤児化する。
5. **「これを廃棄する／脇に置く／山に戻す」は必ず `takeSelf(state, pi, id)` を通す**（§0-17）。
   命令(Command)＝大君主／はみだし者／船長／王子 が使ったカードは**場に出ていない**ので移動が失敗する。
   `removeOne(p.inPlay, id)` を直に書くと**カードが増える／消える**。
   「山に戻す」はさらに **`canReturnToPile` を先に確認**（§0-38 の [high]＝確認せずに抜くと消滅する）。
6. **コスト比較は3成分**（コイン／ポーション／負債）＝`costUpTo` / `costUnder` / `costExact` / `gainableBase`。
   素の数値比較は**非サプライ・ロック中の分割山下段**を拾って**本番 livelock** になる。
7. **複数枚を続けて獲得する効果は `state.pending` を直接代入しない**（獲得時対話を握りつぶす）。
   `onGainQueue` に積むか、**植民(Populate)型の再開網**（`t.*Queue` ＋ reduce 末尾）にする。
   §0-39 の狐で「銀貨の獲得が開いた望楼の窓が消える」を実際に踏んでいる。
8. **新しい pending は4点セット必須**＝engine reducer ＋ `PLAYER_ACTIONS` ＋ CPU `decidePending` ＋
   UI `viewPendingModal`。**候補ゼロなら窓を開かない**／**任意の窓には辞退ボタン**（`modalMultiHand` は
   `allowZero = true`、`modalGainSupply` は**第6引数に関数**が要る＝第7引数 `alwaysSkip` だけでは出ない）。
   ⚠ `test/integrity.test.js` の「全 pending に CPU/UI の分岐があるか」が足し忘れを機械検出する。
9. **捨てさせたら `triggerOnDiscard` を呼ぶ**（坑道／村有緑地／忠犬／織工が誘発する）。
   アタックによる捨て札は `noPrompt = true`（攻撃キューを壊さないため）。
10. **アタックは `ATTACKS` 登録＋`*EnterVictim`＋堀/灯台の免疫**。
    「アタックではないが相手に影響する」ものは**登録しない**（登録すると堀で防げて公式より弱くなる）。
11. **CPU の `chooseAction` にも新カードを足す**（足さないと CPU が一度も使わず、ソークがその経路を
    1度も検証しない＝§0-36 が名指しした罠）。**`GAIN_ORDER` は全カード網羅**（整合性テストが検査）。
12. **日本語カード名は英語wiki の Japanese 行を信用しない**（§0-31 で実物と食い違うことを確認済み）。
    **日本語wiki で裏取りしてから確定する。ただし wikiwiki.jp は並列で叩くと 429 で全滅するので逐次で自分で取る。**

### 🛑 敵対検証が起草を覆した「重大な訂正」2件（実装前に必ず読むこと）

**(A) `canReturnToPile` / `availableInSupply` は「サプライ由来か」を表さない**（第1章の訂正2）
公式（Ambassador）逐語＝
> If you reveal a card which is **not from the Supply**, such as **Spoils**, a Shelter, a **Reward**,
> or a card bought through Black Market, Ambassador does nothing.

⚠ **非サプライ山も `state.supply` に数値キーを持つ**（`supply.spoils = 15` / `madman` / `mercenary` /
賞品 / 馬 …）ので、**`canReturnToPile` も `availableInSupply` も true を返す**（実測）。
そのまま実装すると **略奪品／賞品／馬／狂人／傭兵／戦利品 をサプライに戻して全員にコピーを配れる**
（賞品は各1枚しか存在しない設計なので**枚数の不変条件が壊れる**）。
⇒ **必ず `!NON_SUPPLY.has(id)` を併用する**。真の前例＝§0-37 の **`receiveTributeTargets`（賛辞）**
＝「コスト制限なしの獲得」を `gainableBase` の上に作った唯一の例。

**(B) wiki の Versions 表の「Never printed」の読み方**（第1章の訂正1）
表は6列（Print / Digital / Text / Changes / Announced / Printed）で、
**印刷された版は Announced と Printed を `colspan="2"` で1セルに統合**し、
**未印刷の版は Print 列と Printed 列の両方に `Never printed` と明記**する。
⇒ `colspan="2"` の行を「未印刷」と読み違えると**版の判断を丸ごと間違える**。
実際、抑留(Embargo) の2019-09「If you did」は未印刷だが、**その後 2020-10 に "Trash this **to** add"
（同じ条件付き）として印刷済み**＝現行の印刷済みカードがエラッタを内包している。
⇒ **旅行(Journey)＝未印刷エラッタを採るか、という §4 D1 の論点は この19種には存在しない**（迷わず現行文を採る）。


---

# 第1章　海辺 第1版 A ― 抑留(Embargo)／真珠採り(Pearl Diver)／大使(Ambassador)／航海士(Navigator)

# 海辺（Seaside）第1版限定カード4枚 — 公式ルール確定レポート

一次資料＝英語wiki（`tools/wikidirect.js` で 2026-08-22 に直読み・301追従・生HTMLで `<hr>` 検証済み）。
リポジトリは**1バイトも変更していない**（`git status --porcelain` クリーン。自分の一時ディレクトリ `_m19_raw.tmp` は削除済み。※プロジェクト直下に別エージェントの `_m19_raw/`（Goons/Marchland/Mountebank/Possession/Royal_Seal/Summon/Trade_Route/Venture）が存在するが、私のものではないので触っていない）。

**前提の確認（実装計画に効く）**：`DOM.POOLS.seaside` は**27種＝海辺 第2版**であり、この4枚は `DOM.CARDS`／`DOM.LANDSCAPES` に**1枚も存在しない**（585枚／226枚を機械確認）。id `embargo` / `pearl_diver` / `ambassador` / `navigator` はいずれも未使用、日本語名 `抑留` / `真珠採り` / `大使` / `航海士` も未使用＝**衝突ゼロ**。

---

# 1. Embargo（$2・アクション）

## 1-1. 英語カード文（現行の逐語）

> **+$2**
> Trash this to add an Embargo token to a Supply pile. (For the rest of the game, when a player buys a card from that pile, they gain a Curse.)

**区切り線＝0本**（生HTMLの Card text ブロックで `<hr>` を 0 件と機械確認）。括弧内は「リマインダー文」であり、初版にあった区切り線は 2016 年に**廃止されている**（下記）。

## 1-2. 版（Versions）＝**機能エラッタが2回ある。現行は2020年版**

| 順 | Announced / Printed | 逐語 | Changes |
|---|---|---|---|
| ① | First edition（2009-10・印刷済） | 下記 | — |
| ② | 2016-10 / 2017-07（**印刷済**） | 下記 | Each Curse is gained separately (**removing the dividing line**). Shorten "trash this card" to "trash this". Use gender neutral pronouns. Increased font size. |
| ③ | 2019-05 / Never printed | ②と同文 | Formatting changes only. |
| ④ | 2019-09 / **Never printed** | 下記 | **Placing a token became contingent on trashing Embargo.** |
| ⑤ | 2020-10 / **Never printed**＝**現行** | 冒頭の逐語 | Rephrased condition as "Do X to Y". |

① 初版（**区切り線あり**）：
> +$2
> Trash this card. Put an Embargo token on top of a Supply pile.
> ————
> When a player buys a card, he gains a Curse card per Embargo token on that pile.

② 2016年版（現物の日本語版・ドイツ語2018版などはこの世代）：
> +$2
> Trash this. Add an Embargo token to a Supply pile. (For the rest of the game, when a player buys a card from that pile, they gain a Curse.)

④ 2019-09 版：
> +$2
> Trash this. **If you did,** add an Embargo token to a Supply pile. (For the rest of the game, when a player buys a card from that pile, they gain a Curse.)

⚠ **④⑤は未印刷だが、公式 `Versions` 表に正式な行として載っている**（旭日の段階0で確定した「旅行(Journey)＝2023エラッタを採る」判断と同じ形。§0-29 A4 の royal_galley＝*announce* だけで Versions 行が無かったケースとは異なる）。**本アプリの方針＝現行（⑤）を採る**のが一貫する。

## 1-3. Official FAQ（現行・逐語）

> The token can go on any Supply pile - a Kingdom card pile such as Embargo, or a base card pile such as Silver.
> The token modifies the pile, so that anyone buying a card from that pile gains a Curse.
> This even affects the player who placed the Embargo token.
> This is cumulative; with three Embargo tokens on a pile, buying a card from that pile will give you three Curses.
> Embargo tokens do not do anything if a card is gained without being bought, such as with Smugglers, or if the Curse pile is empty.
> Embargo tokens are not counter-limited; use a replacement if necessary.
> **If you Throne Room Embargo, you will get +$4 but only place one token, since you can only trash Embargo once.**

### Other rules clarifications（逐語）

> If there are multiple Embargo tokens on a pile, **each Curse gain from buying from that pile happens separately**, which allows other when-buy triggers (such as the pre-errata version of Haggler's) to activate in between Curse gains.

### Deprecated official FAQ (2016 2019)（逐語・**現行と正反対の1行があるので注意**）

> （前略・現行と同文）
> If you Throne Room Embargo, you will get +$4 **and place two tokens**, even though you can only trash Embargo once.

### Deprecated official FAQ (2009)（逐語）

> You can pick any pile in the supply.
> If multiple Embargo cards are used to put Embargo tokens on the same pile, a player gains a Curse card for every Embargo token when they buy a card from that pile.
> You do not gain a Curse card if you gain a card from an Embargoed pile without buying it (for example, if you gain a card with Smugglers).
> If you Throne Room an Embargo, you place two Embargo tokens and they do not have to go on the same Supply pile.
> If you run out of Embargo tokens, use a suitable replacement to mark Embargoed piles.
> If there are no Curses left, Embargo tokens do nothing.

### Trivia（実装判断の裏づけ・逐語）

> Embargo requires dedicated tokens, just for this card that often no-one buys. That sure wanted to be fixed. **And it already had errata due to the changes to Band of Misfits & co.**
> — Donald X. Vaccarino, *Seaside 2E Preview 1*, May 2022

## 1-4. ⚠ 実装で危ないところ

### (a) 新 state＝`state.pileEmbargo`（山の上の抑留トークン）
- **`state.pileVP` / `state.pileDebt` / `state.pileFavor` と完全に同型**＝`{[pileKey]: 個数}`・**トップレベル・公開**・`maskStateFor` は `Object.assign` の clone でそのまま残る＝**触らなくてよい**。
- 🛑 **非カード**＝`allCards`・保存則 tally（`test/invariants.test.js` の tally）・庭園/品評会/壁 に**混ぜない**。
- 🛑 **`state.pileDebt` の轍を踏まないこと**＝§0-38 の「徴税が厳冬の負債を横取りした」バグの原因は「`pileDebt` は徴税を使わないゲームでも `{}` として常に存在する」こと。抑留トークンを置くのは Embargo だけなので**共有の危険は無い**が、**`createInitialState` で常時 `{}` を作らず、`state.pileEmbargo = state.pileEmbargo || {}` と遅延生成**し、読み側は必ず `if (state.pileEmbargo && ...)` でガードする（＝**旧スナップショット互換**。オンラインは state を無変換で復元するので必須）。
  - ⚠ **王国に Embargo が無くても闇市場デッキ経由で Embargo を買って使える**ので、「王国に embargo があるときだけ作る」方式にすると穴が開く。遅延生成が正解。
- 🛑 **`applyDivineWind`（旭日・神風）の ⑤ ブロックに `if (state.pileEmbargo) delete state.pileEmbargo[k];` を足す**（`js/engine.js` 約 293〜297 行の `pileVP`/`pileDebt`/`pileFavor` を消している場所と同じ）。足さないと**撤去された山キーにトークンが孤児化して残る**。

### (b) 山キーの正規化＝**READ / WRITE の両方で `pileKeyOf` を通す**
§0-20 で徴税が実際に踏んだ罠。**書く側**（`EMBARGO_PILE` reducer）と**読む側**（`BUY` の呪い付与）で必ず `pileKeyOf(state, id)` を通す。
- 分割山（帝国5組・サウナ/アヴァント）＝**下段を選んでも上段キーに正規化**（1山＝1セットのトークン。公式も「Supply pile」単位）。
- 混合山（廃墟/騎士/城/同盟の6分割山）＝`pileKeyOf` が山キー（`knights` / `castles` / `augurs` …）を返す。
- 🛑 UI/CPU の候補からも**分割山の下段を除く**（`TAX_PILE` の UI は `(id) => !(DOM.SPLIT_PILES && DOM.SPLIT_PILES[id])` で除いている＝そのままコピーできる）。

### (c) 「空の山にも置けるか」＝**置ける**
カード文に非空条件が無く、公式FAQ も「any Supply pile」としか言わない。**本アプリの前例（徴税 `TAX_PILE`／冒険の教師の山トークン `validTeacherPiles`）と同じく空の山も許可する**のが一貫する（`js/engine.js` 14420 付近のコメントが根拠を書いている）。
- 受理側は **`supply` キーの不存在と `NON_SUPPLY` だけを拒否**（＝`TAX_PILE` の逐語コピー）。
- UI は **`modalGainSupply(..., allowEmpty = true)`**（`js/ui.js` 3579 の徴税行が完全な雛形）。⚠ §0-32 の [low] 3 で確定した通り、`allowEmpty` 分岐は `isNonSupplyPile` で非サプライ山（賞品/成長先/馬/戦利品）を弾かないと**押しても何も起きない死にチップ**が並ぶ（`js/ui.js` 4940 に既にその処理がある）。

### (d) 🛑 **玉座の間で2枚目のトークンは置かない**＝`takeSelf` を通す（現行エラッタの核心）
現行文は "**Trash this to** add ..." ＝ **廃棄できたときだけトークンを置く**。
```
case 'embargo':
  addCoins(state, 2);
  if (takeSelf(state, pi, 'embargo')) {   // §0-17 の命令ガード込み（祝宴/宝の地図/島と同型）
    trashCard(state, pi, 'embargo');
    state.pending = { type: 'embargo_pile', player: pi };
  }
  break;
```
- **`removeOne(p.inPlay, 'embargo')` を直に書かず `takeSelf(state, pi, 'embargo')` を使う**＝§0-17 で確定した「**命令(Command)がプレイした札は動かない**」。大君主／はみだし者／船長／王子（すべて $2 の Embargo をプレイできる）経由では**廃棄が失敗し、トークンは置かれない**。**+$2 は普通に出る**。
  - ⚠ この 2019 エラッタは Donald X. 自身が「Band of Misfits & co. の変更に伴うエラッタだった」と明言している＝**命令ガードこそがこのエラッタの存在理由**。ここを外すと公式違反かつ**トークンが無限に湧く**。
- 玉座の間の2回目＝`inPlay` に Embargo が無い（1回目で廃棄済み）→ `takeSelf` が失敗 → +$2 だけ。**pending も立てない**（立てると人間が「置く山」を選ばされる死に窓になる）。

### (e) 呪いの付与＝`BUY` reducer に足す。**購入だけ**（獲得では発火しない）
- 場所＝`js/engine.js` の `case 'BUY'`、`gain(state, pi, card, 'discard')` と購入ログの**直後**（`triggerMerchantGuild` / `maybeStartOverpay` / 農地 / 値切り屋 / `applyLingerOnBuy` の並びに合流させる）。
- 🛑 **`BUY_EVENT` / `BUY_PROJECT` では発火しない**（カードを買っていない）。🛑 **`BLACK_MARKET_BUY` でも発火しない**（闇市場デッキはサプライ山ではない）。🛑 `gain()` からは絶対に呼ばない（Smugglers/工房などの獲得では起きない＝公式FAQ明記）。
- 🛑 **呪いの山が空なら何も起きない**（`gain` が false を返すだけなので自然にそうなる）。
- 🛑 **累積**＝トークン N 個なら呪い N 枚。ただし**1枚ずつ別々の獲得**（Other rules clarifications 逐語）。
  - **素直に `for` ループで `gain` を N 回呼ぶと2枚目以降の獲得時対話が潰れる**：`triggerOnGain` の `_gainDepth === 1 && !state.pending` ゲートにより、1枚目の呪いで望楼/交易商人の窓が立つと**2枚目以降の窓が黙って消える**（3個なら望楼の窓が3回開くのが公式）。
  - → **`state.onGainQueue` に `{ type: 'embargo_curse', player: pi }` を N 個積む**のが正解。ドレイナー（`js/engine.js` 13375 付近の `while (state.onGainQueue.length)`）に**非対話項目**として1分岐足す（`gatekeeper_exile` / `buried_treasure_play` と同型）：
    ```
    if (q.type === 'embargo_curse') { gain(state, q.player, 'curse', 'discard'); if (state.pending) break; continue; }
    ```
    これで「各呪いの獲得が別々に起きる」＝望楼で山札の上に置く／交易商人で銀貨に置換する／坑道が誘発する、が呪いごとに独立して働く。
- **置いた本人にも効く**（例外なし）。
- **同時に誘発する他の when-buy トリガー（値切り屋/商人ギルド/公会堂/過払い）との解決順は選べない**＝本アプリの既存の横断的な許容簡略化。公式は「間に挟める」（Other rules clarifications）。**PROGRESS に許容簡略化として明記すること。**

### (f) CPU / UI（4点セット）
| 面 | やること | 雛形 |
|---|---|---|
| engine reducer | `EMBARGO_PILE` | `TAX_PILE`（14418〜14432）を逐語コピー |
| `PLAYER_ACTIONS` | `'EMBARGO_PILE'` を追加 | 23544 行の並び |
| CPU `decidePending` | `pd.type === 'embargo_pile'` → 山を1つ返す（**必ず非 null**） | `js/cpu.js` 1405〜1414（tax_pile） |
| UI `viewPendingModal` | `modalGainSupply(..., allowEmpty=true)` | `js/ui.js` 3579（tax_pile） |
- 🛑 **CPU は必ず有効な山を返すこと**。徴税は §0-32 で「非空ゼロなら在庫条件を外して選ぶフォールバック」を入れてある＝**同じフォールバックが要る**（空の山しか無くても置けるので、`supply` にキーがあれば選べる＝候補が枯れることは原理的に無い）。
- CPU の置き先方針＝「相手が買いたそうで自分は買わない山」を選ぶのは難しいので、**まずは徴税と同じ雑な選択で十分**（Embargo は弱いカードで、公式wikiの戦略節も「無害な山に置くのが最善なことが多い」と書いている）。
- **盤面表示**＝山の右上にバッジ（`state.pileVP` の `⭐N`／`state.pileFavor`／`state.pileDebt` の `🟠` と同じ場所）。**公開情報なので必ず出す**（見えないと「なぜ呪いを引いたのか」が分からない）。

### (g) 終端保証
サプライの山は常に1つ以上あるので**候補ゼロにならない**＝辞退ボタン不要（強制）。ただし念のため `state.supply` にキーが1つも無ければ `state.pending = null` で終端する保険を入れる。

## 1-5. 日本語カード名（参考）

英語wiki `Other language versions` の Japanese 行：
> **抑留** (pron. *yokuryū*, lit. *internment*)
> +$2
> これを廃棄する。 サプライ1山の上に抑留トークン1枚を追加する (その山のカード1枚を購入するプレイヤーは、 呪い1枚を獲得する)。

⚠ **この行は実物と食い違うことがある**（§0-27 で夜想曲は17枚が食い違った）。**日本語wiki での裏取りが必要**（このセッションでは wikiwiki.jp を叩けない）。
⚠ 文面は**2016年版（②）の訳**であり、現行（⑤）の "Trash this **to** add"（＝廃棄できたときだけ置く）が反映されていない。**本アプリのカタログ文は現行に合わせて書き直す必要がある**（例：「これを廃棄して、サプライの山1つに抑留トークン1枚を追加する。（ゲームの残りの間、そのプレイヤーがその山からカードを購入したとき、呪い1枚を獲得する。）」）。

---

# 2. Pearl Diver（$2・アクション）

## 2-1. 英語カード文（現行の逐語）

> **+1 Card**
> **+1 Action**
> Look at the bottom card of your deck. You may put it on top.

**区切り線＝0本**。

## 2-2. 版（Versions）＝**機能エラッタなし**

| 順 | Announced / Printed | Changes |
|---|---|---|
| ① | First edition（2009-10・印刷済） | — |
| ② | 2016-10 / 2017-07（印刷済） | Increased font size.（文面同一） |
| ③ | 2019-05 / Never printed | Formatting changes only.（文面同一） |

## 2-3. Official FAQ（現行・逐語）

> First draw a card and get +1 Action; then look at the bottom card of your deck, **shuffling first if needed**.
> If you choose to put the bottom card on top of your deck, be sure not to look at the card above it.

### Deprecated official FAQ (2009)（逐語）

> Draw a card before you look at the bottom card of your deck.
> If placing the card on top of your deck, be sure not to look at the next card on the bottom of your deck while moving the card.
> **If you have no cards left when it's time to look at the bottom, you shuffle first.**

## 2-4. ⚠ 実装で危ないところ

### (a) 順序が固定＝**引く → +1アクション → その後に底を見る**
🛑 「+1カードを引く**前**に底を見る」実装は公式違反（引いた1枚が最後の1枚だったケースで結果が変わる）。

### (b) 底の位置＝`p.deck[p.deck.length - 1]`
本アプリの山札は `deck[0] = 一番上`（`deck.shift()` で引き、`deck.unshift()` で上に置く）。`reshuffleDeck` は **`p.deck = p.deck.concat(shuffled)`＝追加方式**（§0-8 で保存則バグを直したときにこうなった）ので、「底」＝配列の末尾で正しい。

### (c) シャッフルの扱い
```
draw(state, pi, 1); addActions(t, 1);
if (p.deck.length === 0 && p.discard.length > 0) reshuffleDeck(p, state);
if (p.deck.length > 0) state.pending = { type:'pearl_diver', player: pi, card: p.deck[p.deck.length-1] };
```
- 🛑 **`reshuffleDeck` は「メイソン団が捨て札に札を残したか」を返す**（§0-29）。同じアクセスで2度シャッフルしないこと。ここは1回しか呼ばないので素直でよい。
- 🛑 **山札も捨て札も空なら窓を開かない**（候補ゼロで窓を開かない定石）。
- ⚠ **山札が1枚のとき、底＝一番上**。「上に置く」を選んでも実質何も起きない（合法・**拒否してはいけない**）。

### (d) 🛑 **旭日（影 Shadow）との相互作用＝必ず起きる**
`reshuffleDeck` は**影カードをシャッフルした束の一番下に置く**（§0-35）。したがって mix-all で旭日が混ざると、**真珠採りが見る「底」はほぼ常に影カード**になる。
- 影カードを山札の上に置くのは**合法だが無意味**（影は山札のどこからでも使えるため）。**CPU の評価関数が影カードを最優先で topdeck しないよう**にしておく（そうしないと真珠採りが常に無駄になる）。バグではないが、CPU の質の問題。

### (e) 🛑 マスク（オンラインの情報漏洩）＝**これを忘れると §0-21／§0-28／§0-29 A4／§0-30 P1b に続く「5回目の同一クラスの事故」**
`pd.card` は**私的な看破**（reveal ではない）。`maskStateFor`（`js/engine.js` 23452 付近）の
```
if (s.pending && (s.pending.type === 'crystal_ball' || s.pending.type === 'zombie_spy') && s.pending.card != null && ...)
```
の許可リストに **`'pearl_diver'` を足す**（`pd.card` を持つ型のリスト＝水晶玉／ゾンビの密偵／医者の過払いと同型）。本人と支配中の決定者（`secretSeer`）だけに見せる。

### (f) 4点セット
| 面 | 内容 |
|---|---|
| engine reducer | `PEARL_DIVER_RESOLVE`＝`{ topdeck: true/false }`。true なら `p.deck.pop()` → `p.deck.unshift(c)`。**必ず `state.pending = null`** |
| `PLAYER_ACTIONS` | `'PEARL_DIVER_RESOLVE'` |
| CPU `decidePending` | 「良い札なら上へ」。`starChartPick` の評価（`shuffleCardRank`）を流用できる。**必ず非 null を返す** |
| UI `viewPendingModal` | 2択ボタン「山札の上に置く」／「そのままにする」＋見えた1枚を拡大表示。**どちらも常に押せる＝詰まない** |
- 🛑 **`state.pending = null` を前進の前に必ず書く**（§0-5 で神託/辺境伯/狂戦士が `null` 忘れで**CPU無限ループ**した。「捨て→次へ」型 reducer の定番の罠）。

### (g) 「見た」だけ＝**捨て札トリガーも公開トリガーも発火しない**
`reveal()` を通してはいけない（**公開ではない**＝パトロンの +1財源は出ない）。

## 2-5. 日本語カード名（参考）

> **真珠採り** (pron. *shinju-tori*)
> +1 カードを引く
> +1 アクション
> 山札の一番下のカ一ドを見る。それを一番上に置いてもよい。

⚠ 実物と食い違う可能性あり（日本語wiki で裏取りすること）。⚠ 上の「カ一ド」は wiki 側の誤字（漢数字の「一」）。⚠ 本アプリのカタログ流儀では **「+1 カードを引く」→「+1 カード」**に正規化する。

---

# 3. Ambassador（$3・アクション-アタック）

## 3-1. 英語カード文（現行の逐語）

> Reveal a card from your hand. Return up to 2 copies of it from your hand to the Supply. Then each other player gains a copy of it.

**区切り線＝0本**（1段落）。

## 3-2. 版（Versions）＝**機能エラッタなし**

| 順 | Announced / Printed | Changes |
|---|---|---|
| ① | First edition（2009-10・印刷済） | — |
| ② | 2016-10 / 2017-07（印刷済） | Increased font size.（文面同一） |

## 3-3. Official FAQ（現行・逐語）

> First you reveal a card from your hand.
> Then take **0, 1, or 2** copies of that card from your hand and **put them on top of their Supply pile**.
> Then each other player gains a copy of that card from the Supply.
> If there are not enough copies to go around, deal them out **in turn order, starting with the player to your left**.

### Other rules clarifications（逐語）

> If you reveal a card which is **not from the Supply**, such as Spoils, a Shelter, a Reward, or a card bought through Black Market, **Ambassador does nothing**.
> If you reveal a card which is part of a Supply pile with differently named cards, such as Ruins, Knights, or Castles, you can only return two cards to the Supply pile if they have the same name. **Other players will only gain cards with that name, and only if they are on the top of the pile (no digging).**
> If you empty either the Province pile or a third Supply pile, then use Ambassador so that the pile is no longer empty at the **end of your turn**, the game does not end.

### Deprecated official FAQ (2009)（逐語）

> First you choose and reveal a card from your hand.
> You may place up to 2 copies of that card from your hand back in the Supply.
> **You may choose not to put any of them back in the Supply.**
> Then the other players each gain a copy of it from the Supply.
> If the pile for the chosen card runs out, some players may not get one; cards are given out in turn order starting with the next player.
> **If you have no other cards in hand when you play this, it does nothing.**

### 戦略節から確定できる裁定（逐語）

> Revealing cards without returning them may enable a pile-out win; you can even do the same with the Province pile ...
> ... you can consider keeping a piece of junk (or even gaining a Curse) to reveal repeatedly without returning it, **allowing you to continue attacking them**.

＝**0枚戻しても「他の全員が獲得する」は起きる**（返却は獲得の前提条件ではない）。

## 3-4. ⚠ 実装で危ないところ

### (a) 🛑 「サプライに戻す」は `canReturnToPile` → `returnToPile`（濡女・馬の習性・チョウの習性と**同型**）
§0-38 の [high] が名指しした保存則違反クラスそのもの。
```
if (!canReturnToPile(state, c)) { /* 戻さない */ }
else { removeOne(p.hand, c); returnToPile(state, c); }
```
🛑 **`removeOne` を先に書いてから `returnToPile` が false を返す**と、カードが**ゲームから消滅する**（オンラインは state をそのまま永続化するので**部屋のカード総数が恒久的に狂う**）。**必ず `canReturnToPile` を先に確認**。
- `canReturnToPile`（`js/engine.js` 2913）は `pileKeyOf` を通し、混合山（`state[pile]` が配列か）と `supply` キーの有無で判定する。**Shelter／Spoils／Reward／家宝／ゾンビ／闇市場デッキ由来の札は false**＝公式の「Ambassador does nothing」が**そのまま述語1本で表現できる**。
- 🛑 **窓を開く側（＝UI/CPU のフィルタ）も同じ `canReturnToPile` を見る**こと（§0-38 でチョウの習性が `supply` を直読みしていて戦利品・混合山でずれた）。

### (b) 🛑 「返す」は**廃棄でも獲得でもない第3の移動**
- `triggerOnTrash` / `triggerOnGain` を**呼ばない**（同盟の交換 `exchangeCard`／濡女と同じ）。
- **`supply` が増える**＝**3山終了の判定が巻き戻る**。公式FAQ が「空になった山を Ambassador で埋め戻せばゲームは終わらない」と明記している。本アプリの `isGameOver` は `cleanupAndAdvance` の中で**その時点の supply** を見るので**自動的に正しい**（何もしなくてよい）。
- ⚠ **空になった山が復活する**＝略奪の**調査(Search) の `pile_empty` が後でもう一度誘発しうる**（§0-30 P2 の「無謀な(Reckless) が山へ戻すと再誘発しうる」と同じ）。`returnToPile` 側の既存挙動に乗るので追加実装は不要だが、テストで確認すること。

### (c) 🛑 混合山＝「一番上のカードのみ・掘らない」
公式逐語＝`only if they are on the top of the pile (no digging)`。
- 返却＝`returnToPile` が `state[pile].unshift(cardId)` するので**戻した札が一番上に載る**＝公式どおり。
- 配布＝**`mixedTopCard(state, pileKey) === card` のときだけ獲得できる**。`gain(state, v, pileKey)` は先頭を shift するので、**山キーで gain し、事前に一番上の名前を照合する**。より簡単には既存述語 **`availableInSupply(state, cardId)`**（`js/engine.js` 2705 付近）が `(supply>0 && !splitLocked) || mixedPileWithTop(state,id)` ＝**まさにこの判定**なので、これを使う。
- ⚠ 対象＝廃墟／騎士／城／**同盟の分割山6組**（`augurs` など）。

### (d) 🛑 帝国型「2段分割山」（catapult/rocks・sauna/avanto 等）＝**許容簡略化の判断が要る**
本アプリは帝国/プロモの2段分割山を**2つの数値 supply キー＋`splitLocked`** でモデル化しており、「rocks を catapult の上に載せる」物理状態を**表現できない**。
- `returnToPile('rocks')` は `state.supply.rocks += 1` になる（`pileKeyOf` は mixed 判定にしか使われないので安全）。しかし **`splitLocked` が真なら相手は獲得できない**。
- 公式（混合山と同じ理屈）なら「戻した rocks が一番上に載るので相手は rocks を獲得できる」。
- → **`availableInSupply` で配布可否を判定し、ロック中なら配らない**＝**許容簡略化として PROGRESS に明記**する（mix-all 限定・到達が極めて稀）。

### (e) 公開は**本物の reveal**＝`reveal()` を通す
パトロン（ルネサンス）が +1財源で誘発する。🛑 `{ notReveal: true }` を付けない。
- 🛑 **公開しても手札から動かない**＝公開した1枚は**そのまま返却対象に含められる**（定石：屋敷を公開して屋敷2枚を返す）。

### (f) アタックの形＝**witch 型のループ**（`witchEnterVictim` が完全な雛形）
```
ATTACKS['ambassador'] = { onMoat: (s, pd) => ambassadorEnterVictim(s, pd.source, pd.queue, pd.card) };
```
- 被害者キューは `for (let k = 1; k < n; k++) vics.push((pi + k) % n)` ＝**左隣から手番順**＝公式の "starting with the player to your left" と一致（`case 'witch'` 6341 行と同型）。
- 各被害者ごとに `attackImmune` → `hasReaction` → `{ type:'ambassador', stage:'react', ... }` → `MOAT_REVEAL` / `SHIELD_REVEAL` で `onMoat`。
- **山が尽きたら残りの被害者は何も得ない**（`availableInSupply` が false）。ループは**空振りでも必ず前進する**（無限ループしない）。

### (g) ⚠ 「公開・返却」と「堀を公開する窓」の順序＝**許容簡略化の判断が要る**
公式では**堀はアタックをプレイした瞬間**に公開する＝相手は「何を返されるか」を**見る前に**堀を切るか決める。
- 素直な実装（① 公開・返却の pending → ② witch 型ループ）だと、**相手は返された札を見てから堀を切れる**＝弱い意味の情報漏れ。
- 厳密にやるなら `attack_window`（§0-28・`js/engine.js` 11477／3696）で**先に全員ぶんの窓を開き免疫を確定**してから公開・返却→配布する。ただし `attack_window` は免疫を**記録しない**ので、`lingerAttackEnter` の `immune[]`（3696 付近）方式に寄せる必要がある。
- 🛑 **§0-38 で狐(kitsune) について同じ簡略化を明示的に許容している**（「狐は『呪いを配る』を選んだときだけリアクション窓を開く」）。**同じ扱いで許容簡略化にするのが一貫する**が、**必ず PROGRESS に書くこと**。

### (h) 終端保証・人間が詰まない設計
- **手札0枚なら窓を開かない**（公式＝何も起きない）。
- 🛑 **公開できるカードを「サプライに戻せる札」に限定してはいけない**。限定すると「手札が全部 Shelter／Spoils」のときに**候補ゼロの閉じられない窓**になる。**手札のどれでも公開できる**ようにすれば候補ゼロが原理的に起きない（かつ公式にも忠実＝「遂行できない選択肢も選べる」＝探索/物色/専門家の前例）。UI には「（サプライに山が無いので何も起きません）」と添える（§0-29 A5 [low] 7 の専門家と同じやり方）。
- **返す枚数は 0〜min(2, 手札の同名枚数)**。🛑 **0 が合法**＝**「戻さない」ボタンが必ず要る**（§0-37 の [high]＝賛辞で「やめる」が1つも出ず人間だけが強制獲得させられた事故と同じクラス）。
  - ⚠ `modalMultiHand` 系を使うなら「0枚で確定」できることを必ず確認する。`modalSingleHand` の skip は **`{label,on}` オブジェクト必須**（boolean `true` は死にボタン＝§0-32 の [high]）。

### (i) 4点セット（新 pending 2種＋react）
| pending | 内容 | 雛形 |
|---|---|---|
| `ambassador` (stage `reveal`) | 手札から1枚公開 | `modalSingleHand`（フィルタなし） |
| `ambassador` (stage `return`) | 同名を 0/1/2 枚返す | 枚数ステッパー `modalAmount(0..min(2,枚数))`（首都/苦行の前例）または同名チップの複数選択 |
| `ambassador` (stage `react`) | 堀/盾の窓 | `witch` の react |
- reducer `AMBASSADOR_REVEAL` / `AMBASSADOR_RETURN` / （`MOAT_REVEAL`・`SHIELD_REVEAL` は既存）を `PLAYER_ACTIONS` に登録。
- 🛑 **UI の選択は `takeSelection()` を通す**（§0-29 A3 の [high]＝`UI.selection` がターンをまたいで持ち越されて人間が完全に詰む）。
- CPU `decidePending`：公開は「屋敷 > 銅貨 > 呪い」の順で選び、返却枚数は最大。**必ず非 null**。

### (j) 支配（Possession）との相互作用
公式：`If Possession is present, Ambassador can become a liability, as your opponent can use it to return your good cards and gain them for themselves.`
＝支配中は**支配者が「他のプレイヤー」に含まれる**ので支配者もコピーを獲得する。本アプリの `actor()` ルーティングと `gain()` の支配分岐に自然に乗るが、**回帰テストで確認すること**。

### (k) その他
- **他プレイヤーの獲得＝本物の `gain`**＝望楼／交易商人／坑道／不正利得の反応がすべて誘発する（公式：`weakened or neutralised by ... cards with a relevant Reaction like that of Watchtower`）。
- **`gainableBase` / `costUpTo` を使ってはいけない**＝コスト制限は一切無い（「そのカードのコピー」を配るだけ）。素の `availableInSupply` で判定する。

## 3-5. 日本語カード名（参考）

> **大使** (pron. *taishi*)
> 手札1枚を公開する。公開したのと同じカード2枚以下を手札からサプライに戻す。他のプレイヤーは全員、それと同じカード1枚を獲得する。

⚠ 実物と食い違う可能性あり（日本語wiki で裏取り）。⚠ **既存の「大使館」(embassy・異郷) とカード一覧の全文検索で紛らわしい**（id 衝突は無し）。

---

# 4. Navigator（$4・アクション）

## 4-1. 英語カード文（現行の逐語）

> **+$2**
> Look at the top 5 cards of your deck. Either discard them all, or put them back in any order.

**区切り線＝0本**（生HTMLで機械確認）。

## 4-2. 版（Versions）＝**機能エラッタなし**（文面短縮のみ）

| 順 | Announced / Printed | 逐語 | Changes |
|---|---|---|---|
| ① | First edition（2009-10・印刷済） | `+$2 / Look at the top 5 cards of your deck. Either discard all of them, or put them back **on top of your deck** in any order.` | — |
| ② | 2016-10 / 2017-07（印刷済） | 現行文 | Shortened "back on top of your deck" to "back". Increased font size. |
| ③ | 2019-05 / Never printed | 現行文 | Formatting changes only. |

## 4-3. Official FAQ（現行・逐語）

> You discard **all 5 cards (or however many were left after shuffling) or none of them**.
> If you do not discard them, put them back in any order.

### Deprecated official FAQ (2009)（逐語）

> You discard all 5 cards or none of them.
> If you don't discard them, put them back in any order.
> **If there aren't 5 cards left in your deck, look at as many as you can, then shuffle your discard pile (not including the cards you are currently looking at), and look at the rest.**
> If there still aren't 5, you just look at however many are left, and put them back or discard them.

### 戦略節から確定できる相互作用（逐語・**実装で必ず効く**）

> ... it can be a way to **discard Tunnel or Village Green**, or set up to draw with cards like Wishing Well ...

## 4-4. ⚠ 実装で危ないところ

### (a) **`survivors`（暗黒時代・生存者）の完全な同型**＝枚数が 2 → 5、加えて +$2
`js/engine.js` の `case 'survivors'`（6692）と `case 'SURVIVORS_RESOLVE'`（16733）が**逐語の雛形**。
```
case 'navigator': {
  addCoins(state, 2);
  if (p.deck.length < 5 && p.discard.length > 0) reshuffleDeck(p, state);
  const look = p.deck.slice(0, 5);
  if (look.length > 0) state.pending = { type:'navigator', player: pi, cards: look.slice() };
  break;
}
```
- 🛑 **`addCoins(state, n)` を使う**（`t.coins += n` を直に書かない＝カメレオンの習性が壊れる。§0-25）。
- 🛑 **`reshuffleDeck` は `p.deck = p.deck.concat(shuffled)` ＝追加方式**なので、「山札に残っている札を先に見て、その下にシャッフルした捨て札が来る」＝**2009 FAQ の逐語手順（見ている札はシャッフルに混ぜない）と結果が完全に一致する**。素直に書いてよい。
- 🛑 **0〜4枚しか無いのは正常系**（「or however many were left after shuffling」）。**候補ゼロ（deck も discard も空）なら窓を開かない**。

### (b) 🛑 **捨てるときは `triggerOnDiscard` を必ず呼ぶ**（公式wikiが Tunnel / Village Green を名指ししている）
- `look_arrange`（`LOOK_ARRANGE_RESOLVE`・21644 行）は `if (disc.length) triggerOnDiscard(state, pd.player, disc);` を**呼んでいる**（§0-28 で「山札から捨てたカードでも捨て札トリガーは誘発する」と確定済み）。
- ⚠ **一方 `SURVIVORS_RESOLVE`（16733〜16754）は `triggerOnDiscard` を呼んでいない**。生存者も「山札から捨てる」なので、**坑道／村有緑地／忠犬が誘発しない既存の穴の可能性がある**（暗黒時代×異郷＝mix-all で到達）。Navigator を実装するときに**雛形をそのままコピーするとこの穴を継承する**。**別途 確認・修正を検討すること**（本タスクの範囲外だが、コピー元なので必ず見ること）。
- **自分のターンの自分の捨て札なので `noPrompt` は付けない**（村有緑地・忠犬の窓を開く。アタックによる捨て札だけが `noPrompt=true`）。

### (c) 「全部捨てる or 全部戻す」＝**中間が無い**
🛑 `look_arrange`（＝好きな枚数を捨てて残りを戻す）を**流用してはいけない**＝公式違反（Navigator の弱さの本質がここ）。`survivors` の `{choice:'discard'} / {choice:'keep', order:[...]}` 形が正しい。

### (d) 順序の指定
`SURVIVORS_RESOLVE` の `action.order` 検証（ソートして多重集合が一致するか）をそのまま流用する。`order[0]` が一番上。**不正な order は公開順にフォールバック**（＝拒否せず終端する＝人間が詰まない）。

### (e) 🛑 マスク（私的看破）
`maskStateFor` の許可リスト（23446 行の長い `||` 連鎖：`sentry`/`lookout`/`catacombs`/`survivors`/`scouting_party`/`look_arrange`/`miller_pick`/`sentinel`/`fortune_hunter`/`mapmaker`/`sextant`）に **`'navigator'` を足す**。忘れると**オンラインで相手の山札の上5枚が配信JSONから読める**（§0-21 偵察隊／§0-28 夜警／§0-29 A4 粉屋・歩哨／§0-30 六分儀 に続く**5回目の同一クラスの事故**）。

### (f) 4点セット
| 面 | 内容 | 雛形 |
|---|---|---|
| engine reducer | `NAVIGATOR_RESOLVE` | `SURVIVORS_RESOLVE` |
| `PLAYER_ACTIONS` | `'NAVIGATOR_RESOLVE'` | — |
| CPU `decidePending` | `case 'navigator'`＝5枚の質を評価して「全捨て / 全戻し」。戻すなら良い順に並べる | `js/cpu.js` 2704（`look_arrange`）の評価関数を流用 |
| UI `viewPendingModal` | 5枚を表示＋「全部捨てる」ボタン＋「この順で戻す」（並べ替え） | `look_arrange` の UI（`js/ui.js` 2717）＋ `survivors` の2択 |
- 🛑 **どちらのボタンも常に押せる**＝候補ゼロで詰まない。**`state.pending = null` を前進の前に必ず書く**。
- 🛑 UI の選択は `takeSelection()` を通す（持ち越し禁止）。

### (g) 「見る」だけ＝**公開ではない**
`reveal()` を通さない（パトロンは誘発しない）。

## 4-5. 日本語カード名（参考）

> **航海士** (pron. *kōkai-shi*)
> +$2
> 山札の上から5枚を見る。それらを捨て札にするか、好きな順番で山札の上に戻す。

⚠ 実物と食い違う可能性あり（日本語wiki で裏取り）。⚠ **既存の「一等航海士」(first_mate・略奪) と全文検索で紛らわしい**（id 衝突は無し）。⚠ 本アプリのカタログ流儀では **「+2 コイン」** 表記。

---

# 実装前に必読（この4枚に共通する罠）

1. 🛑 **この4枚は海辺 第1版限定**＝本アプリの `POOLS.seaside`（27種＝第2版）に**足してはいけない**。足すと `random-seaside`・mix-all の抽選が変わり、整合性テストと決定論シードの回帰テストが一斉に壊れる。**新しい孤立プール（例 `seaside1e`）を作り、段階1では `DOM.STAGE1_POOLS` に必ず入れる**（入れないと闇市場に「買っても何も起きない死に札」が並ぶ）。`GAIN_ORDER` には**必ず4件とも足す**（整合性テストが全カード網羅を要求する）。

2. 🛑 **版の選択を先に決める**。機能エラッタがあるのは **Embargo だけ**（2019-09 の "If you did" ＝**未印刷**）。旅行(Journey)＝2023エラッタを採った前例（§4 決定D1）に合わせて**現行（2020年版）を採る**のが一貫する。Pearl Diver / Ambassador / Navigator は**エラッタなし**＝迷う余地がない。

3. 🛑 **「サプライに戻す／山にトークンを置く」は自己移動系の鉄則を守る**。
   - Embargo の自己廃棄は **`takeSelf`** を通す（§0-17：命令がプレイした札は動かない＝**このエラッタの存在理由そのもの**）。玉座の2回目はトークンを置かない。
   - Ambassador の返却は **`canReturnToPile` を先に確認してから `removeOne`**（§0-38 の [high]＝確認せずに抜くとカードがゲームから消滅する）。**窓を開く側も同じ述語**を見る。

4. 🛑 **山の上に載るトークンは `pileKeyOf` を READ / WRITE の両方で通す**（§0-20 で徴税が実際に踏んだ「負債の孤児化」）。分割山の下段は候補から除き、上段キーに正規化する。**`applyDivineWind` の削除リストにも足す**（`pileVP`/`pileDebt`/`pileFavor` の隣）。

5. 🛑 **山の上のトークンは非カード**＝`allCards`・保存則 tally・庭園/品評会/壁 に混ぜない。**`state.pileEmbargo` は遅延生成**（`|| {}`）し、読み側は必ず `if (state.pileEmbargo && ...)` でガード＝**旧スナップショット互換**（オンラインは state を無変換で復元する）。

6. 🛑 **「見る（look at）」効果を足したら `maskStateFor` の私的看破リストに足す**。今回は **`navigator`（`pd.cards`）と `pearl_diver`（`pd.card`）の2箇所**。これを忘れる事故は §0-21／§0-28／§0-29 A4／§0-30 P1b で**4回繰り返している**。

7. 🛑 **「山札から捨てる」ときは `triggerOnDiscard` を呼ぶ**（Navigator：公式wikiが Tunnel / Village Green を明示）。⚠ コピー元の `SURVIVORS_RESOLVE` は**呼んでいない**＝既存の穴を継承しないこと（別途 確認推奨）。

8. 🛑 **新 pending は全部4点セット**（engine reducer＋`PLAYER_ACTIONS`＋CPU `decidePending`＋UI `viewPendingModal`）。今回の新 pending＝`embargo_pile` / `pearl_diver` / `navigator` / `ambassador`(reveal・return・react)。
   - **CPU は絶対に `null` を返さない**（オンラインで `reduce(state, null)` が TypeError → 部屋が固まる）。
   - **engine 側に終端保証**（候補ゼロなら窓を閉じる）。
   - **任意の効果には辞退ボタンが必須**（Ambassador の「0枚戻す」＝§0-37 の [high] 賛辞と同じクラス）。`modalSingleHand` の skip は **`{label,on}` 必須**（boolean `true` は死にボタン＝§0-32）。
   - **前進の前に必ず `state.pending = null`**（§0-5 で神託/辺境伯/狂戦士が忘れて本番 livelock）。

9. 🛑 **コスト比較は一切使わない**。この4枚はどれもコスト制限を持たない（Ambassador は「そのカードのコピー」、Embargo は「任意のサプライ山」）。素の数値比較も `costUpTo` も**書く場所が無い**＝もし書いていたら設計を間違えている。獲得可否は **`availableInSupply`**（混合山の一番上・分割山ロックを正しく見る唯一の述語）を使う。

10. **許容簡略化として PROGRESS に必ず書くもの（3件）**
    - Embargo：**同時に誘発する他の when-buy トリガー（値切り屋/商人ギルド/過払い/公会堂）との解決順を選べない**（公式は呪いの獲得の間に挟める）。
    - Ambassador：**堀を公開する窓が「公開・返却の後」に開く**（公式はアタックをプレイした瞬間）＝§0-38 の狐(kitsune) と同じ扱い。厳密にするなら `attack_window`＋`immune[]` 方式へ。
    - Ambassador：**帝国型2段分割山の下段を返してもロック中は相手が獲得できない**（公式なら一番上に載るので獲得できる）＝本アプリの分割山モデルの制約。mix-all 限定。

11. **日本語名・日本語カード文は英語wiki の Japanese 行を鵜呑みにしない**。この4行はすべて **2016年版の Dominion Online 訳**であり、とくに **Embargo は現行の「Trash this **to** add」（＝廃棄できたときだけ置く）が反映されていない**。**日本語wiki（wikiwiki.jp）で裏取りしてからカタログに入れること**（このセッションでは 429 事故のため叩いていない）。名前の参考値＝**抑留 / 真珠採り / 大使 / 航海士**（id・名前とも既存 811枚と衝突なしを機械確認済み）。


## 【この章の敵対検証（別エージェントが一次資料に当たり直したもの）】
⚠ **上の起草と食い違う場合はこちらが正**（起草より後に、同じページを取り直して照合している）。

# 敵対検証レポート — 海辺1E 4枚（Embargo / Pearl Diver / Ambassador / Navigator）

一次資料＝英語wiki を `tools/wikidirect.js` で自分で再取得（2026-08-22・生HTMLで `<hr>` と `colspan`/`rowspan` を検証）。実装の罠は `js/engine.js` / `js/cpu.js` / `js/ui.js` / `js/cards.js` を実際に grep・node 実行して確認。**リポジトリは1バイトも変更していない**（`git status --porcelain` 空・一時ディレクトリ `_m19v_raw.tmp` は削除済み）。

英語カード文・公式FAQ・Other rules clarifications・Deprecated FAQ の**逐語は4枚とも起草どおりで、捏造・欠落なし**。訂正は下記5件。

---

## 確定した訂正

### 訂正1 🛑【重大】Versions 表の「Never printed」を4行で読み違えている（3枚）

**① 起草の記述**

| 起草 | 記述 |
|---|---|
| Embargo ③ | `2019-05 / Never printed` |
| Embargo ⑤ | `2020-10 / **Never printed**＝**現行**` |
| Pearl Diver ③ | `2019-05 / Never printed` |
| Navigator ③ | `2019-05 / Never printed` |

**② 一次資料の逐語**（`Embargo` / `Pearl_Diver` / `Navigator` / `Journey` の生HTML）

wiki の Versions 表は6列（Print / Digital / Text / Changes / Announced / Printed）で、**印刷された版は Announced と Printed を `colspan="2"` で1セルに統合**する。未印刷の版は**両方に明記**する。

```html
<!-- Embargo 第5行（現行） -->
<td>[IMG:Embargo.jpg]        ← Print 列に印刷版の画像がある
<td>[IMG:EmbargoDigital.jpg]
<td>… Trash this to add an Embargo token to a Supply pile. …
<td>Rephrased condition as "Do X to Y".
<td colspan="2">October&#160;2020      ← Announced+Printed 統合

<!-- Embargo 第4行（未印刷） -->
<td><i>Never printed</i>     ← Print 列にも明記
…
<td>September&#160;2019
<td><i>Never printed</i>     ← Printed 列にも明記
```

対照実験（`Journey`＝PROGRESS が「未印刷」と確定している既知ケース）：
```html
<td><i>Not printed yet</i> … <td>September&#160;2023 <td><i>Not printed yet</i>
```
＝未印刷の行は必ず**両列に文字が入る**。`colspan="2"` の行は First edition（`October 2009`）と同じ形＝**印刷済み**。

**③ 正しい記述**

| 版 | Announced | Printed | Print 画像 |
|---|---|---|---|
| Embargo ③ | 2019-05 | **2019-05（印刷済）** | `EmbargoOld3.jpg` |
| Embargo ④ | 2019-09 | **Never printed** ✔起草どおり | *Never printed* |
| **Embargo ⑤（現行）** | 2020-10 | **2020-10（印刷済）** | `Embargo.jpg` |
| Pearl Diver ③ | 2019-05 | **2019-05（印刷済）** | `Pearl_Diver.jpg` |
| Navigator ③ | 2019-05 | **2019-05（印刷済）** | `Navigator.jpg` |

**影響が大きい**：起草の「実装前に必読 2」は *「機能エラッタがあるのは Embargo だけ（2019-09 の "If you did" ＝未印刷）。旅行(Journey)＝2023エラッタを採った前例に合わせて現行（2020年版）を採るのが一貫する」* と、**未印刷エラッタを採るかどうかの論点を立てているが、その論点自体が存在しない**。2019-09 の未印刷版はその後 **2020-10 に "Trash this **to** add"（同じ条件付き）として印刷されている**＝現行の印刷済みカードがエラッタを内包している。§0-29 A4 の royal_galley（未印刷アナウンス）とも §4 D1 の Journey（未印刷エラッタ）とも**比較する必要がない**。迷う余地なく現行文を採るだけ。

---

### 訂正2 🛑【重大・そのまま実装するとルール違反】`canReturnToPile` は「サプライ由来か」を表さない

**① 起草の記述**（Ambassador 3-4(a)）
> `canReturnToPile`（`js/engine.js` 2913）は … **Shelter／Spoils／Reward／家宝／ゾンビ／闇市場デッキ由来の札は false**＝公式の「Ambassador does nothing」が**そのまま述語1本で表現できる**。

さらに 3-4(k)：
> 素の `availableInSupply` で判定する。

**② 一次資料の逐語**（`Ambassador` > Other rules clarifications）
> If you reveal a card which is **not from the Supply**, such as **Spoils**, a Shelter, a **Reward**, or a card bought through Black Market, Ambassador does nothing.

**③ コードでの実測**（`node` で `createInitialState(['A','B'], ['marauder','hermit','urchin','tournament', …])`）

```
spoils        supplyHasOwn= true   NON_SUPPLY= true
madman        supplyHasOwn= true   NON_SUPPLY= true
mercenary     supplyHasOwn= true   NON_SUPPLY= true
horse         supplyHasOwn= true   NON_SUPPLY= true
bag_of_gold   supplyHasOwn= true   NON_SUPPLY= true   ← まさに公式が名指しした "Reward"
diadem        supplyHasOwn= true   NON_SUPPLY= true
hovel         supplyHasOwn= false  ← Shelter だけは起草どおり false
goat          supplyHasOwn= false  ← 家宝も false
```

`canReturnToPile` の実体（`js/engine.js` 2913）は最後が
```js
return Object.prototype.hasOwnProperty.call(state.supply, cardId);
```
＝**非サプライ山も `supply` に数値キーを持つ**（`initSupply`：`supply.spoils = 15` / `supply.madman = 10` / `supply.mercenary = 10`、賞品・馬も同様）ので **true を返す**。戦利品(Loot) は先頭の `LOOT_SET` 分岐で無条件 true。

同様に `availableInSupply`（3223）も
```js
if ((state.supply[id] || 0) > 0) return !splitLocked(state, id);
```
だけで **NON_SUPPLY を除外していない**。

**④ 正しい記述**

そのまま実装すると **略奪品／賞品／馬／狂人／傭兵／戦利品 を「サプライに戻して」全員にコピーを配れる**（賞品は各1枚しか存在しない設計なので枚数不変条件が壊れる）。正しい述語は：

```js
// 返す側
const canReturn = (c) => !NON_SUPPLY.has(c) && canReturnToPile(state, c);
// 配る側（コスト制限は無い・混合山の一番上だけ）
const canGive   = (c) => !NON_SUPPLY.has(c) && availableInSupply(state, c);
```

**真の前例は §0-37 の `receiveTributeTargets`（賛辞 Receive Tribute）**＝「コスト制限なしの獲得」を `gainableBase` の上に作った唯一の例（`gainableBase = !!C()[id] && !NON_SUPPLY.has(id) && !splitLocked(...) && supply[id] > 0`）。起草はこの前例を挙げていない。混合山を扱う必要があるぶんだけ `availableInSupply` 側に寄せるのが正しい。

---

### 訂正3【中】「望楼／交易商人／坑道が誘発する」は**本アプリでは偽**

**① 起草の記述**（Ambassador 3-4(k)）
> **他プレイヤーの獲得＝本物の `gain`**＝望楼／交易商人／坑道／不正利得の反応がすべて誘発する

**② コードの逐語**（`js/engine.js` 10578）
```js
if (state.turn && pIndex === state.turn.active && state._gainDepth === 1 && !state.pending) {
  if (me.hand.includes('watchtower')) state.pending = { type: 'watchtower', … };
  …
  else if (me.hand.includes('trader') && …) state.pending = { type: 'trader_react', … };
}
```
＝**`pIndex === state.turn.active` ゲート**。Ambassador の配布相手は手番プレイヤーではないので、望楼・交易商人・国境の村・宿屋・スーク・公爵夫人・納屋(hovel) は**1つも開かない**。これは PROGRESS §0-5 が「交易商人の獲得置換は自分の手番の獲得のみ（相手ターンの魔女等の呪い獲得を銀貨に置換する反応は非対応）」と明記している**既存の横断的簡略化**。

また **坑道(Tunnel) は捨て札トリガー**（`triggerOnDiscard`）であって獲得反応ではない＝分類の誤り。Ambassador は相手に捨てさせないので出番がない。

**③ 正しい記述**

Ambassador の配布で**実際に誘発するのは**：
| 効果 | 経路 | 挙動 |
|---|---|---|
| **牧羊犬(sheepdog)** | `onGainQueue`（10506） | 誰の獲得でも開く ✔ |
| **鷹匠(falconer)** | `onGainQueue`（10516） | 種別2つ以上のカードで**全プレイヤー**ぶん開く ✔ |
| **海賊(pirate)** | `pirateReactWindow`（10630・**active 非依存**） | **`state.pending` を直接立てる** ⚠ |
| **愚者の黄金(fools_gold)** | `foolsGoldReactWindow`（10619・**active 非依存**） | 属州を配ると**直接 pending** ⚠ |
| **不正利得(ill_gotten_gains)** | 自動（10300・ゲート無し） | 配ると**配った本人を含む全員**が呪いを獲得 |
| 望楼・交易商人・納屋・国境の村・宿屋・スーク | — | **開かない**（許容簡略化として PROGRESS に明記すべき） |

---

### 訂正4【中】Ambassador の配布ループが窓を握りつぶす（起草は Embargo にだけ書いて Ambassador に書いていない）

**① 起草の記述**
Embargo については正しく指摘している：
> 素直に `for` ループで `gain` を N 回呼ぶと2枚目以降の獲得時対話が潰れる … `state.onGainQueue` に積むのが正解

しかし **Ambassador の配布（3-4(f)）は witch 型ループとしか書いていない**。

**② コードの逐語**（`js/engine.js` 3815 `witchCurse`）
```js
function witchCurse(state, source, victim, queue) {
  if ((state.supply.curse || 0) > 0) { gain(state, victim, 'curse', 'discard'); … }
  witchEnterVictim(state, source, queue);   // ← gain が立てた pending を無条件に上書きする
}
```
魔女は「呪い」しか配らないので、非 active ゲートを持たない `pirateReactWindow`（財宝）／`foolsGoldReactWindow`（属州）のどちらにも該当せず**偶然安全**。

**③ 正しい記述**

Ambassador は**任意のカードを配る**ので偶然が成り立たない。実害：

- 銅貨／銀貨を配る（Ambassador の主用途）→ 相手 1 人目の獲得で `pirate_react` が `state.pending` にセットされる → 2人目の `gain` は `!state.pending` ゲートで海賊が空振り → 最後に Ambassador の reducer が `state.pending = null` して **1人目の海賊窓も消滅**。
- 属州を配る（公式が名指しした pile-out 戦術）→ 愚者の黄金で同型。

`witchCurse` をそのままコピーすると壊れるので、**配布は `onGainQueue` に `{ type:'ambassador_give', player: v, card }` を人数ぶん積み、ドレイナ（13374）に非対話分岐を1つ足す**（`buried_treasure_play` と同型＝`if (state.pending) break; continue;`）のが正解。Embargo の呪い配布と**同じ解決策で両方直る**。

---

### 訂正5【小】カード名の類似チェックに漏れ

**① 起草の記述**
> ⚠ **既存の「一等航海士」(first_mate・略奪) と全文検索で紛らわしい**

**③ 正しい記述**（`node` で全811枚を走査）
```
similar: 大使館      (embassy・異郷)
similar: 航海        (voyage・同盟)      ← 起草が落としている
similar: 一等航海士  (first_mate・略奪)
```
**「航海」は「航海士」の完全な部分文字列**なので、§0-24 で入れたカード検索（部分一致AND）では「航海」で航海士も一等航海士もヒットする＝一等航海士より紛らわしい。id・日本語名の衝突はゼロ（起草の機械確認は再現できた：`CARDS 585 / LANDSCAPES 226 / POOLS.seaside 27 / STAGE1_POOLS []`）。

---

## 足りていない項目

### A. 一次資料側 — **取りこぼしなし**
4枚とも Official FAQ / Other rules clarifications / Deprecated FAQ (2016 2019) / Deprecated FAQ (2009) / Versions / Trivia の全節を照合し、起草の引用と**逐語一致**。Ambassador の Strategy 節から拾った「0枚返却でも配布は起きる」の根拠付けも妥当（Deprecated FAQ 2009 の `You may choose not to put any of them back in the Supply.` が直接の根拠として更に強い）。Embargo の Trivia（Band of Misfits エラッタ由来）も正しい。

**傍証を1つ追加**：Embargo の Korean 行（現行印刷）は `이 카드를 폐기합니다. **그렇게 했을 경우**,`（＝*Trash this. **If you did**,*）＝**条件付きエラッタ後の文面が実際に印刷されている**。訂正1を裏づける独立の証拠。

### B. 実装の罠 — 起草の指摘は**ほぼ全部コードで裏が取れた**
| 起草の主張 | 検証結果 |
|---|---|
| `applyDivineWind` が `pileVP`/`pileDebt`/`pileFavor` を削除（〜293-297行） | ✅ **294-296行**で確認。`pileEmbargo` を足す必要あり |
| `maskStateFor` は `clone(state)` ベース＝新トップレベル field は素通し | ✅ 23347行 `const s = clone(state)` |
| 私的看破リストに `navigator`(cards) / `pearl_diver`(card) を足す | ✅ 23448 / 23453 行のリストを確認 |
| `TAX_PILE` が空山を許し `NON_SUPPLY`/キー不存在だけ拒否 | ✅ 14418-14432 逐語一致 |
| `modalGainSupply(..., allowEmpty)` は `isNonSupplyPile` で死にチップを弾く | ✅ ui.js 4929/4940/4942 |
| CPU の雛形＝cpu.js 1405(tax_pile) / 2704(look_arrange) | ✅ 行番号まで一致 |
| **`SURVIVORS_RESOLVE` が `triggerOnDiscard` を呼んでいない** | ✅ **16738-16739 行で確認＝指摘は正しい** |
| `LOOK_ARRANGE_RESOLVE` は呼んでいる | ✅ 21644 行 |
| `reshuffleDeck` は `p.deck = p.deck.concat(shuffled)`＝底は配列末尾 | ✅ 1913 行。影札は `shuffled.push(...shadows)` で底へ ✅ |
| `takeSelf` / `playedByCommand` の存在 | ✅ 5436 行 |

一方、**起草に無い実装事実**を5点補足します。

**1. `SURVIVORS_RESOLVE` の穴は「検討」ではなく確定の既存バグ**
16738 行で `state.pending = null` の**前**に捨て処理を済ませ、`triggerOnDiscard` を一度も呼ばない。＝**mix-all で 生存者(暗黒時代)×坑道/村有緑地/忠犬 が今日空振りしている**。Navigator を書くときの副産物として別途潰す価値がある（§0-38 の「民兵ほかが `triggerOnDiscard` を呼んでいなかった」と同一クラス）。

**2. Embargo の前例は `feast` ではなく `spellScrollEffect`（呪符の巻物）**
起草は自己廃棄の一般論しか書いていないが、`case 'feast'`（6360）は
```js
// 獲得は廃棄に条件づかない（命令経由なら廃棄だけが失敗する）
if (takeSelf(state, pi, 'feast')) { trashCard(…); }
if (anyGainable(…)) state.pending = { type: 'feast', … };   // ← 無条件
```
＝**非条件付き**。これを写すと現行エラッタ（`Trash this **to** add`）が壊れる。正しい雛形は `spellScrollEffect`（5425）＝
```js
const self = takeSelf(state, pi, 'spell_scroll');
if (!self) { log(…獲得も起きない…); return; }
trashCard(state, pi, 'spell_scroll');
… state.pending = { … };      // ← 廃棄できたときだけ
```

**3. Embargo が `trashCard` の直後に `state.pending` を立てても安全**
`triggerOnTrash`（青空市場／呪いの鏡／リッチ／従者／地下墓所／狩場）は**すべて `state.onTrashQueue` に積み、`state.pending` を直接立てない**（該当ブロックを全走査して確認）。よって `embargo_pile` を続けて立ててよく、on-trash 窓は reduce 末尾（13360）で `embargo_pile` 解決後に消化される。**「危ない」と誤解して余計な回避策を入れないこと**。

**4. 自席の山札は `maskStateFor` で id ソートされる ＝ Pearl Diver の `pd.card` は必須**
```js
// 自席の deck は id をソートして順序情報を消す（配信JSONを覗く改造クライアントの山札透視を防ぐ）
const rest = p.deck.filter((c) => !keepFace(c)).sort();
```
＝クライアントは**自分でも底のカードを計算できない**。起草はマスク（相手に伏せる）しか書いていないが、**pending に載せることは任意ではなく必須**。加えて `SURVIVORS_RESOLVE` が `pd.cards` を信用せず resolve 時に `p.deck.shift()` し直す防御パターンを踏襲するとよい（オンライン復元スナップショット耐性）。

**5. `server/gameServer.js` の `isNoConsentUndoableBuy` は変更不要**
述語（`if (h.action.type !== 'BUY') return false;` ＋ 相手の state 完全一致 ＋ 自分の deck/hand 不変 ＋ `pending`/`onGainQueue`/`onTrashQueue` 空）を読んだ結果：
- 抑留トークンの設置は `EMBARGO_PILE`＝BUY ではないので最初のガードで落ちる。
- 抑留された山からの購入で増えるのは**自分の捨て札の呪い**と `supply.curse` だけ（`supply` は比較対象外・相手は不変）＝乱数も情報も増えないので同意なしで戻せてよい。望楼が誘発すれば `cur.pending` で自動的に承認制へ落ちる。
- Ambassador は購入ではないので対象外。
＝**`pileEmbargo` を比較リストに足す必要はない**（次の実装者が悩むところなので明記推奨）。

### C. 起草が挙げるべきだった公式の細部
- **Embargo × Haggler**：Other rules clarifications が「呪いの獲得の間に他の when-buy トリガーを挟める」例として**名指ししている唯一のカード**。起草は「解決順を選べない＝許容簡略化」と書いており結論は妥当だが、`js/engine.js` の `case 'BUY'` は `maybeHagglerGains` → `applyLingerOnBuy` の順で末尾に並んでいるので、Embargo は `applyLingerOnBuy` の隣に置く＝**Haggler の後**になる旨を明記すべき。
- **Embargo は Embargo 自身の山にも置ける**（`a Kingdom card pile such as Embargo`）。
- **Ambassador × 不正利得**：配ると**配った本人も**呪いを獲得する（10300 行はゲート無しの自動効果）。

---

## 総括

- **英語カード文・FAQ・Other rules clarifications の逐語は4枚とも正確**（節の見落としもなし）。
- **訂正1（Versions の "Never printed" 誤読・4行）** と **訂正2（`canReturnToPile` が非サプライ山を通す）** は、そのまま実装すると前者は無用な版選択の議論を、後者は**賞品／略奪品／馬／戦利品を配れるルール違反**を招く。
- **訂正3・4** は「本アプリで実際に何が誘発するか」の誤認と、Embargo にだけ書かれた `onGainQueue` の教訓を Ambassador に適用し損ねたもの。
- 起草が自力で見つけた **`SURVIVORS_RESOLVE` の `triggerOnDiscard` 欠落**は独立に再現でき、**既存の実バグとして確定**。


---

# 第2章　海辺 第1版 B ― 海賊船(Pirate Ship)／海の妖婆(Sea Hag)／探検家(Explorer)／幽霊船(Ghost Ship)

# 海辺（Seaside）第1版限定カード 4枚 ― 公式ルール確定と実装メモ

一次資料＝英語wiki（`tools/wikidirect.js` で逐次取得。生HTMLも取得して `<hr>` を検査＝**4枚とも区切り線ゼロ**）。
リポジトリは1バイトも変更していない（`git status` クリーン・一時ファイルは削除済み）。

---

## 0. 前提の確認（この4枚がどこに入るか）

`js/cards.js` を読んで確認した事実：

- `DOM.POOLS` に **`basic1e`(25) / `intrigue1e`(25)** が既にある。差分＝`basic1e` 固有 = `woodcutter chancellor feast adventurer spy thief`／`intrigue1e` 固有 = `great_hall coppersmith scout tribute saboteur secret_chamber`。
  ＝**「1版プールは 2版プールと重複する共有カードも含めて、その版の王国カード全部を列挙する」**のが既存の流儀。
- `DOM.CARD_SETS` に **`random-1e`**（`{kind:'random', name:'初版から', randomFrom:['basic1e','intrigue1e']}`）がある。
- `MIX_KINGDOM_POOLS` に `basic1e`/`intrigue1e` は**入っていない**（＝1版カードは mix-all に出さない方針）。
- 現行 `POOLS.seaside` は27枚（＝海辺2版）。海辺1版は26枚＝共有18＋**1版限定8**（Ambassador / Embargo / **Explorer** / **Ghost Ship** / Navigator / Pearl Diver / **Pirate Ship** / **Sea Hag**）。
  → 新設するのは **`POOLS.seaside1e`（26枚）** ＋ `random-1e` の `randomFrom` に `'seaside1e'` を足す、が既存流儀に一致する。
- 4枚とも `DOM.CARDS` に未収録（grep 済み）。

---

# 1. Pirate Ship（海賊船・$4・アクション-アタック）

## 1-1. 英語カード文（現行の逐語）

> Choose one: +[$1] per Coin token on your Pirate Ship mat; or each other player reveals the top 2 cards of their deck, trashes one of those Treasures that you choose, and discards the rest, and then if anyone trashed a Treasure, you add a Coin token to your Pirate Ship mat.

- **区切り線（`<hr>`）は 0 本**（生HTMLで確認）。1段落・1行。
- 種別＝`Action - Attack`／コスト＝$4／セット＝Seaside（第1版のみ）。

## 1-2. 版（Versions）

| 版 | 逐語 | 変更点 | Announced / Printed |
|---|---|---|---|
| First edition | > Choose one: Each other player reveals the top 2 cards of his deck, trashes a revealed Treasure that you choose, discards the rest, and if anyone trashed a Treasure you take a Coin token; or, +[$1] per Coin token you've taken with Pirate Ships this game. | — | October 2009 |
| 2016エラッタ | > Choose one: +[$1] per Coin token on your Pirate Ship mat; or each other player reveals the top 2 cards of their deck, trashes one of those Treasures that you choose, and discards the rest, and then if anyone trashed a Treasure you add a Coin token to your Pirate Ship mat. | > Reordered choices. / Clarify that the coin token goes on the Pirate Ship Mat. / Use gender neutral pronouns. / Increased font size. | Oct 2016 / Jul 2017 |
| 2019 | 現行文（上記1-1・"Treasure, you add" にカンマ） | > Formatting changes only. | May 2019 |

⚠ **機能エラッタではない**（選択肢の順番が入れ替わり、トークンの置き場所が明文化されただけ）。**採用は現行（2019）文**。

## 1-3. Official FAQ / Other rules clarifications（逐語・全文）

**Official FAQ**
> Players revealing a card like Moat do so before you choose your option.
> If you choose the first option, you get +[$1] per Coin token on your Pirate Ship mat; the Coin tokens stay there.
> If you choose the second option, each other player reveals the top 2 cards of their deck, trashes a revealed Treasure of your choice, if possible, and discards the rest of their revealed cards.
> Then, if any players did trash a Treasure, you add a Coin token to your Pirate Ship mat (from the supply of tokens).
> You get at most one Coin token per play of Pirate Ship.
> Take a Pirate Ship mat when you first need one.

**Other rules clarifications**
> Coin tokens on your Pirate Ship mat cannot be spent (as the Coin tokens from Dominion: Guilds can be).

**Deprecated official FAQ (2009)**（＝現行の一般則に吸収されただけで内容は生きている。シャッフル手順の正本）
> When you first take this card, take a Pirate Ship player mat.
> If you use the Pirate Ship to trash treasures, a player with just one card left reveals that last card and then shuffles to get the other card to reveal (without including the revealed card); a player with no cards left shuffles to get both of them.
> A player who still doesn't have two cards to reveal after shuffling just reveals what he can.
> Each player trashes one Treasure card at most, of the attacker's choice from the two revealed cards.
> As long as you trashed at least one Treasure card in this way, place a Coin token on your Pirate Ship player mat.
> You can't get more than one Coin token each time you play Pirate Ship, no matter how many treasures it trashes.
> If you choose not to try to trash treasures from the other players, the Pirate Ship is worth one coin for each Coin token on your Pirate Ship player mat.
> The Coin tokens are cumulative, so after you have used your Pirate Ships to trash coins 3 times (and you trash at least one Treasure card each time), any Pirate Ship you play could be worth 3 coins.
> Pirate Ship is an Action-Attack and players can reveal Secret Chamber even if you choose to use Pirate Ship for the coin value.

**Coin token ページ（トークンの正本）**
> Seaside (first edition only) — 25 / Pirate Ship

＝Coin token は物理的に Coffers/Villagers/Favors と同じ金属トークンだが、**海賊船マットのトークンは別枠・使用不可**。

**Strategy 節（公式wikiの記述・資本主義の裁定として使える）**
> Pirate Ship's strongest synergy is with Capitalism, which changes almost all payload cards into Treasures. As such, it greatly increases Pirate Ship's effectiveness as an Attack while also allowing you to play it in the Buy phase, which removes the need for village support.

## 1-4. ⚠ 実装で危ないところ

### (a) 新しい state ＝ `p.pirateShipTokens`（**非カード・公開・使用不可**）
- `p.coffers`（財源）／`p.villagers`（村人）／`p.favors`（好意）と**まったく同型の per-player 数値**（`js/engine.js` の player 初期化 2089〜2093行の並びに1行足す）。
- **ただし `coffers` に相乗りしてはいけない**＝公式逐語 `Coin tokens on your Pirate Ship mat cannot be spent`。`COFFERS_SPEND` の対象にしない。
- **保存則の tally／`allCards`／庭園・品評会・壁 には入れない**（非カード）。`vpOf` にも入れない（VPではない）。
- `maskStateFor` は clone ＋ `Object.assign` なので**公開のまま自動で残る**（`favors` と同じ＝追加作業不要）。
- **ターンを跨いで残る**＝`freshTurn` に入れない。旧スナップショット互換のため読むときは必ず `(p.pirateShipTokens || 0)`。
- 盤面に金色バッジを出す（`.pile-favor` / 財源バッジと同じ流儀）。**残数が見えないと「攻撃 or +$」の判断ができない**＝UIは必須。

### (b) 🛑 **リアクション窓は「選択の前」に開く**（公式逐語 `Players revealing a card like Moat do so before you choose your option.`）
- 本アプリの `*EnterVictim` は**被害者ごとに反応窓を挟みながら順に処理する**ので、素直に書くと「攻撃を選んだ後に堀が出る」＝**公式と順序が逆**になる。
- Pirate Ship はこの差が**実際に見える**（全員が免疫だと分かれば +$ 側を選ぶ／パトロンの +1財源が動くタイミングも変わる）。
  ※ §0-37 で**狐(kitsune)は同じ問題を「攻撃を選んだときだけ窓を開く」と割り切って許容簡略化にしている**。Pirate Ship で同じ割り切りをするなら**必ず PROGRESS に許容簡略化として明記**すること。
- **忠実に書くなら前例は `lingerAttackEnter`（js/engine.js:4611）＋`markLingerImmune`（4607）**＝
  「先に全員ぶんの反応窓を回し、堀を公開した席と `attackImmune` の席を `immune[]` に記録してから本体を実行する」型。
  Pirate Ship なら `state.pending = { type:'pirate_ship', stage:'react', player:victim, source, victim, queue:rest, immune:[...] }` を回し、
  キューが尽きたら `stage:'choose'` に移す。
- 🛑 `MOAT_REVEAL`（js/engine.js:14604）は `isAttackReactPending(pd)`（3719）を通す＝**`pd.stage === 'react'` でないと堀が撃てない**。上の型なら満たす。
  `ATTACKS.pirate_ship = { onMoat: (s,pd) => { markPirateShipImmune(...); pirateShipReactEnter(s, pd.source, pd.queue, pd.immune); } }`。

### (c) 攻撃本体＝**`thief` のほぼ完全な同型**（`thiefEnterVictim` 3773／`thiefReveal` 3784／`THIEF_PICK` 15879）
- 上2枚めくり：`thiefReveal` の**空山札→`reshuffleDeck(v)`→それでも足りなければ少ない枚数で公開**が 2009 FAQ の手順と**一致している**（`without including the revealed card` ＝ 1枚 shift してから reshuffle する順序も一致）。そのままコピーしてよい。
- **財宝判定は `isTreasureFor(state, c)`**（資本主義対応）。素の `DOM.isType(c,'treasure')` は禁止。
- **廃棄は必須**（財宝が公開されていれば必ず1枚廃棄。「やめる」ボタンを出してはいけない）。財宝が0枚なら**窓を開かず全部捨てて次の被害者へ**（＝候補ゼロで窓を開かない＝CPU livelock／人間の詰み回避）。
- **廃棄の owner は被害者**＝`trashCard(state, victimIndex, card)`（詐欺師/破壊工作員/盗賊と同じ慣行）。これで
  **石(rocks・帝国の財宝)を廃棄されたら被害者が銀貨を得る／青空市場(market_square)が反応する／Tomb の +1VP は被害者に入る**が正しく動く。
- 🛑 **`thief` は「残りを捨てる」で `triggerOnDiscard` を呼んでいない**（`THIEF_PICK` 15889行 `rest.forEach((c) => v.discard.push(c))`／`thiefReveal` の財宝なし分岐も同様）＝
  **坑道(tunnel)が金貨を出さない既存の取りこぼし**（§0-31 で民兵・軍団兵を直したのと同じクラス）。
  **コピー元をそのまま写すとこのバグを新規に増やす**。Pirate Ship 側は必ず `triggerOnDiscard(state, victim, rest, true)`（アタック由来なので `noPrompt=true`）を呼ぶこと。ついでに `thief` も直す価値がある。

### (d) 🛑 トークン加算は「全員を処理し終えた**後**に1回だけ」
- 公式逐語 `and then if anyone trashed a Treasure, you add a Coin token` ＋ `You get at most one Coin token per play of Pirate Ship.`
- 本アプリの被害者ループは**再帰**なので、`anyTrashed` フラグを **pending に載せて持ち回す**必要がある（前例＝`taxman` の `pd.trashedName`／`catapult` の `pd.giveCurse`）。
  ループの終端（`queue` が空になった分岐）で `if (pd.anyTrashed) p.pirateShipTokens++` を1回だけ。
- **2人以上が廃棄しても +1個**。**玉座の間で2回使えば「1プレイにつき1個」＝最大2個**（`per play` なので玉座は2回とも判定する）。

### (e) 選択（Choose one）
- 新 pending `pirate_ship` stage `'choose'`＝2択。**どちらも常に合法**（トークン0個で +$0 も、全員免疫でも攻撃を選べる）＝終端保証はやさしい。
- **`+$1 per token` は必ず `addCoins(state, n)` を通す**（`t.coins += n` 直書き禁止＝カメレオンの習性が壊れる）。
- **トークンは減らない**（`the Coin tokens stay there`）。
- `ELDER_CHOICE_ORDER`（同盟の長老＝「異なるもう1つも選ぶ」）には**登録しない**のが既存方針（§0-29 A4 の許容簡略化＝登録済みは同盟の9種のみ）。登録しないことを明記する。

### (f) 資本主義（Capitalism）
- 🛑 **Pirate Ship はカード文に「+$1」があるので資本主義下では財宝になる**（上の Strategy 逐語が公式wikiの裏付け）。
  ＝`test/integrity.test.js:170` の **「資本主義で財宝になるアクションは147枚」を 148 に更新**する必要がある
  （日本語カタログ文に `+1 コイン` と書けば `isCapitalismTreasure` の正規表現に自動で当たる。当たらない書き方にするなら `CAPITALISM_EXTRA` に明示追加）。
- 資本主義下で**購入フェイズに使うとアタックが購入フェイズで走る**＝`PLAY_ALL_TREASURES` が pending で中断する。`turn.playAllResume`（§0-24）が既にあるので追加作業は不要だが、**テストで1本通しておくこと**。

### (g) CPU / UI
- CPU：`chooseAction` に登録（**登録しないとソークで1度も使われず経路が検証されない**＝§0-36 が名指しした罠）。
  `decidePending` は ①choose（トークンが少ない序盤は攻撃、`tokens>=3` かつ買いに届くなら +$ 等の単純な閾値でよい。どちらも合法なので livelock しない）②pick（公開された財宝から1枚＝**必ず非 null**。最高額の財宝を選ぶ）③react（`immuneReveal(p)`）。
- UI：`viewPendingModal` に3分岐（choose／pick／react）。**pick には「やめる」を出さない**（強制）。choose は2ボタン＋トークン残数の表示。

## 1-5. 日本語カード名（要裏取り）

英語wiki `Other language versions` の Japanese 行：

> 海賊船 (pron. kaizoku-sen)
> 次のうち1つを選ぶ:「あなたの海賊船マットの上の海賊船トークン1枚につき+[$1]」:「他のプレイヤーは全員、 山札の上から2枚を公開し、その中のあなたが選択する財宝カード1枚を廃棄し、残りを捨て札にする。誰かが財宝カードを廃棄した場合、あなたは目分の海賊船マットの上に海賊船トークン1枚を追加する」

⚠ **この行は実物と食い違うことがある**（日本語wiki での裏取りが必要）。実際この引用は
**「目分」＝「自分」の誤字**があり、**区切り記号が `;` ではなく `:` になっている**＝そのまま写さないこと。
また EN は "Coin token" だが JP訳は **「海賊船トークン」**と呼んでいる点に注意（UI 表記をどちらにするか決める）。

⚠ **名前の衝突注意**：本アプリには既に **`pirate`＝海賊**（海辺2版）と **`corsair`＝私掠船**（海辺2版）がある。
`pirate_ship`＝海賊船 を足すと**海賊系が3枚**になる。**絵の判別で必ず取り違えが起きる組み合わせ**（§0-37 の「紛らわしいペア」と同じ）。

---

# 2. Sea Hag（海の妖婆・$4・アクション-アタック）

## 2-1. 英語カード文（現行の逐語）

> Each other player discards the top card of their deck, then gains a Curse onto their deck.

- **区切り線 0 本**。1行。種別＝`Action - Attack`／$4。

## 2-2. 版（Versions）

| 版 | 逐語 | 変更点 | Announced / Printed |
|---|---|---|---|
| First edition | > Each other player discards the top card of his deck, then gains a Curse card, putting it on top of his deck. | — | October 2009 |
| 2016エラッタ | > Each other player discards the top card of their deck, then gains a Curse onto their deck. | > Clarify that the gained Curse doesn't visit the discard pile. / Use gender neutral pronouns. / Increased font size. | Oct 2016 / Jul 2017 |
| 2019 | 同文 | > Formatting changes only. | May 2019 |

⚠ **機能エラッタなし**。ただし「呪いは捨て札置き場を経由しない」が明文化された＝**`gain(..., 'deck')` 一択**。

## 2-3. Official FAQ / Other rules clarifications（逐語・全文）

**Official FAQ**
> The Curses are given out in turn order, which can matter when the Curse pile is low.
> They go onto decks rather than into discard piles.

**Other rules clarifications**
> Even when there are no Curses left, other players still discard the top card of their deck when Sea Hag is played.

**Deprecated official FAQ (2009)**
> A player with no cards left in his deck shuffles first in order to get a card to discard.
> If he still has no cards, he doesn't discard one.
> A player discarding his last card to this has the gained Curse become the only card in his deck.
> If there aren't enough Curses left to go around, deal them out in turn order, starting with the player to the left of the player who played Sea Hag.

**Secret history（実装の意図が分かるので参考）**
> The discarding is just there so that multiple Sea Hags don't leave you with a stack of Curses on top of your deck.

## 2-4. ⚠ 実装で危ないところ

### (a) 骨格は `witch` と完全同型（`witchEnterVictim` js/engine.js:3804／`witchCurse` 3816）
- 新 state 不要。新 pending は **`sea_hag` stage `'react'` の1種だけ**（`SEA_HAG_REACT`＝`WITCH_REACT` のコピー）。
- `ATTACKS.sea_hag = { onMoat: (s,pd) => seaHagEnterVictim(s, pd.source, pd.queue) }` に1行。
- 4点セット＝reducer `SEA_HAG_REACT` ＋ `PLAYER_ACTIONS` ＋ CPU `decidePending`（`immuneReveal(p)` を返すだけ）＋ UI `reactOptions`。

### (b) 🛑 順序＝「捨てる → 捨て札トリガーを解決 → その後に呪いを山札の上へ」
- **捨てるのは本物の「捨てる」**＝`triggerOnDiscard(state, victim, [card], true)`（`noPrompt=true`＝相手のアタック由来。拷問人・軍団兵と同じ慣行）を**必ず呼ぶ**。
  ＝**坑道(tunnel) を捨てさせたら被害者が金貨を得る／小道(trail)／織工(weaver)** が動く（`triggerOnDiscard` js/engine.js:10885）。呼び忘れが §0-31 で直した既存バグと同じクラス。
- **呪いは捨てた後に山札の上**＝`gain(state, victim, 'curse', 'deck')`（前例＝役人 6349行 `gain(state, pi,'silver','deck')`／病 18175行 `gain(state, pd.player,'curse','deck')`）。
  `gain` は在庫0なら `false` を返すので**ログもガード**する（病の実装がそのまま手本）。
- **呪いが尽きていても捨て札は行う**（公式逐語）＝`if (supply.curse > 0)` で**捨てまでスキップしない**こと。`witchCurse` をそのままコピーすると捨てが漏れる。
- 山札が空なら `reshuffleDeck(v)` してから捨てる。捨てた結果デッキが空になっても**呪いは新しいデッキの唯一の札になる**（そのまま `unshift` 相当＝`gain(...,'deck')` でよい／**ここで再シャッフルしない**）。

### (c) 🛑 既存の許容簡略化が **一気に目立つようになる**（要判断）
- **交易商人(trader)・物見やぐら(watchtower) の獲得時リアクションは「自分の手番の獲得」でしか窓が開かない**
  （`triggerOnGain` の 10578行 `state.turn && pIndex === state.turn.active && state._gainDepth === 1 && !state.pending`）。
- 公式は**相手のターンでも撃てる**。しかも **Trader × Sea Hag はドミニオンで最も有名な防御コンボ**（Trader 公式FAQ＝
  > When you gain a card, whether due to buying it or gaining it some other way, you may reveal Trader from your hand to exchange the gained card for a Silver.
  ／2020年の機能更新で「獲得置換」から「獲得**後**の交換」になった）。
- Watchtower も同様に**貰った呪いをその場で廃棄できる**のが公式。
- ＝**Sea Hag を出荷すると「呪い対策カードが効かない」ことが実プレイで確実にバレる**。
  対応は (i) 許容簡略化として PROGRESS に明記する か (ii) `triggerOnGain` の窓を相手ターンへ広げる横断改修（**16拡張に波及するので敵対レビュー必須**）。**着手前にユーザー判断を仰ぐこと。**

### (d) その他
- **呪いは手番順に配る**＝既存の `othersInOrder(state, pi)` がそのまま正しい（枯渇時の配り順が公式と一致）。
- 灯台/チャンピオン＝`attackImmune`、堀/盾＝反応窓。**免疫のプレイヤーは捨てもしない**（アタック全体が無効）。
- **山札の上を触るので `maskStateFor` の「私的看破」は不要**（誰も見ていない＝公開情報にならない）。ただし**捨てた1枚は全員に見える**ので `reveal(..., {notReveal:true})` ではなく素直に捨て札に置き、ログに名前を出す（捨て札の一番上は公開情報）。

## 2-5. 日本語カード名（要裏取り）

> 海の妖婆 (pron. umi no yōba)
> 他のプレイヤーは全員、山札の一番上のカードを捨て札にし、呪い1枚を山札の上に獲得する。

⚠ **実物と食い違うことがある**（日本語wiki で裏取り要）。ただしこの文面は現行英文と整合しており信頼度は高い。

⚠ **名前の衝突注意**：本アプリには既に **`sea_witch`＝海の魔女**（海辺2版）と **`swamp_hag`＝沼の妖婆**（冒険）がある。
**「海の妖婆／海の魔女／沼の妖婆」の3つ巴**＝カード絵の判別と全文検索で必ず事故る。

---

# 3. Explorer（探検家・$5・アクション）

## 3-1. 英語カード文（現行の逐語）

> You may reveal a Province from your hand. If you do, gain a Gold to your hand. If you don't, gain a Silver to your hand.

- **区切り線 0 本**。種別＝`Action`（アタックではない）／$5。

## 3-2. 版（Versions）

| 版 | 逐語 | 変更点 | Announced / Printed |
|---|---|---|---|
| First edition | > You may reveal a Province card from your hand. If you do, gain a Gold card, putting it into your hand. Otherwise, gain a Silver card, putting it into your hand. | — | October 2009 |
| 2016エラッタ | > You may reveal a Province from your hand. If you do, gain a Gold to your hand. If you don't, gain a Silver to your hand. | > Clarify that the gained Gold doesn't visit the discard pile. / Increased font size. | Oct 2016 / Jul 2017 |
| 2019 | 同文 | > Formatting changes only. | May 2019 |

⚠ **機能エラッタなし**。

## 3-3. Official FAQ（逐語・全文）

**Official FAQ**
> You do not have to reveal a Province if you have one.
> If you do reveal one you gain a Gold, otherwise you gain a Silver.
> The gained card comes from the Supply and is put into your hand; it can be played the same turn.

**Deprecated official FAQ (2009)**（内容は同じ。末尾が `it can be spent the same turn.`）
> You don't have to reveal a Province if you have one.
> If you do reveal one you gain a Gold, otherwise you gain a Silver.
> The gained card comes from the supply and is put into your hand; it can be spent the same turn.

※ `Other rules clarifications` 節は**存在しない**（この4枚で唯一）。

## 3-4. ⚠ 実装で危ないところ

### (a) 新 state 不要・新 pending 1種（任意の Yes/No）
- `explorer` pending＝**「属州を公開する／しない」の2択**。
- 🛑 **手札に属州が無いときは窓を開かない**（自動で銀貨を手札に獲得）。開くと「はい」が押せない死に窓になる。
  逆に**属州があるときは「公開しない」も必ず押せるようにする**（任意＝辞退ボタン必須）。
  ＝PROGRESS §0-32 の「`modalSingleHand` の skip は `{label,on}` オブジェクト必須（`true` は死にボタン）」の轍を踏まないこと。
- CPU `decidePending`：**属州があるなら常に公開**（金貨>銀貨・デメリット無し）。`null` を返さない。

### (b) 公開は必ず `reveal()` を通す（js/engine.js:2511）
- パトロン(patron)は「公開」で +1財源＝**アクションフェイズの公開フック**が `reveal()` に集約されている。
  素の `log()` だけで済ませると mix-all でパトロンが静かに死ぬ。

### (c) 獲得先＝`'hand'`
- `gain(state, pi, 'gold', 'hand')` / `gain(state, pi, 'silver', 'hand')`（前例＝16091行 `gain(state, pd.player,'silver','hand')`）。
- 🛑 **`gain` は在庫0で `false` を返す**＝金貨/銀貨の山が空なら**何も獲得しない**（公開はしたのに獲得ゼロ＝正しい）。ログをガードすること。
- 🛑 **`GAIN_TO_HAND` の置換は `dest === 'discard'` のときだけ**（`gain` 2754行）＝ここは明示的に `'hand'` を渡すので干渉しない。
- **手札に獲得した金貨/銀貨はそのターンに使える**（購入フェイズで普通に出せる）＝本アプリは手札から財宝を出す実装なので**追加作業なし**。

### (d) コスト比較は登場しない
- 獲得するのは固定で金貨/銀貨＝`costUpTo` 等は不要。**素の数値比較を書く場面が無い**ので、この4枚の中では一番安全。

### (e) CPU / UI
- CPU `chooseAction` に登録（ターミナル。`bestEngineBuy`/`GAIN_ORDER` にも id を足す＝整合性テストが全カード網羅を要求する）。
- UI＝`viewPendingModal` に「属州を公開する／公開しない」の2ボタン。

## 3-5. 日本語カード名（要裏取り）

> 探検家 (pron. tanken-ka)
> 手札の属州1枚を公開してもよい。公開した場合、金貨1枚を手札に獲得する。公開しなかった場合、銀貨1枚を手札に獲得する。

⚠ **実物と食い違うことがある**（日本語wiki 裏取り要）。
参考：Trivia に「イタリア語では `Esploratore` が Adventurer に取られていた」「スペイン語では `Explorador` が Scout に取られていたので女性形」とある＝**多言語で名前が衝突しやすいカード**。
日本語では **`adventurer`＝冒険者／`scout`＝斥候** なので衝突しないが、**`expedition`＝探検（冒険のイベント）／`exploration`＝探査（ルネサンスのプロジェクト）** と**紛らわしい**（全文検索・絵の判別で注意）。

---

# 4. Ghost Ship（幽霊船・$5・アクション-アタック）

## 4-1. 英語カード文（現行の逐語）

> +2 Cards
> Each other player with 4 or more cards in hand puts cards from their hand onto their deck until they have 3 cards in hand.

- **区切り線 0 本**（`+2 Cards` の下は改行だけ＝`<hr>` ではない）。種別＝`Action - Attack`／$5。

## 4-2. 版（Versions）

| 版 | 逐語 | 変更点 | Announced / Printed |
|---|---|---|---|
| First edition | > +2 Cards / Each other player with 4 or more cards in hand puts cards from his hand on top of his deck until he has 3 cards in his hand. | — | October 2009 |
| 2016エラッタ | > +2 Cards / Each other player with 4 or more cards in hand puts cards from their hand onto their deck until they have 3 cards in hand. | > Use gender neutral pronouns. / Increased font size. | Oct 2016 / Jul 2017 |
| 2019 | 同文 | > Formatting changes only. | May 2019 |

⚠ **機能エラッタなし**（代名詞と字詰めだけ）。
Secret history に「昔は "3 or fewer" と書いてあったが混乱を招くのでやめた」とある＝**3枚以下は何もしない**が確定。

## 4-3. Official FAQ（逐語・全文）

**Official FAQ**
> Each other player keeps putting cards from their hand onto their deck, in any order they choose, until they only have 3 cards in hand.
> Players who already had 3 or fewer cards in hand do not put any cards onto their deck.

**Deprecated official FAQ (2009)**
> The other players choose which cards they put on their decks and in what order.
> This has no effect on another player who already has only 3 cards in hand.
> A player with no cards left in their deck does not shuffle; the cards put back become the only cards in their deck.

※ `Other rules clarifications` 節は**存在しない**。

## 4-4. ⚠ 実装で危ないところ

### (a) 🛑 **「順番も被害者が選ぶ」＝1枚ずつ置かせる**（まとめ選択にしてはいけない）
- 公式逐語 `in any order they choose`。置いた順で次のターンに引く順が変わる＝**観測可能な差**。
- ＝**民兵型の `discardDownEnter`（js/engine.js:4131・複数枚まとめ選択）を流用してはいけない**。
- 正しい前例は **会計士（clerk）**＝`clerkEnterVictim`(5062) / `clerkProceed`(5075) / `CLERK_TOPDECK`(18044)。
  `CLERK_TOPDECK` は `removeOne(v.hand, card); v.deck.unshift(card);` の**1枚だけ**。
  Ghost Ship はこれを **`hand.length > 3` の間ループ**させる（解決するたびに再び同じ被害者の pending を立て直す）。
- 新 pending は **`ghost_ship` stage `'react'` / `'topdeck'` の2つ**。4点セット必須。

### (b) 🛑 **枚数判定はリアクションの解決「後」に行う**
- 前例＝`villainEnterVictim`（3854行）の `if (v.hand.length < 5) { villainEnterVictim(...); return; } // 反応で手札が減ったら対象外`／`clerkProceed` の `if (hand.length >= 5)`。
- **馬商人(horse_traders)** は反応で自分を手札から脇へ置く＝**手札が1枚減って4→3になり対象外になる**（公式どおり）。
  **番犬(guard_dog)／隊商の護衛(caravan_guard)** は逆に**引いて手札が増える**。どちらも `stage:'react'` の後に `>= 4` を測り直せば正しくなる。

### (c) 🛑 **山札の上に置くのは「捨てる」でも「獲得」でもない**
- `triggerOnDiscard` を呼んではいけない（坑道が誤爆する）。`gain` でもない。
- **ここでシャッフルしない**（公式逐語 `A player with no cards left in their deck does not shuffle; the cards put back become the only cards in their deck.`）＝`v.deck.unshift(card)` だけ。

### (d) 強制＝辞退ボタンを出さない／ただし終端保証
- `hand.length > 3` の間は必ず1枚出す＝**候補は必ず1枚以上ある**ので候補ゼロの窓は原理的に開かない。
- CPU `decidePending`：**必ず非 null**（手札から「そのターンに一番いらない札」を返す。`hand[0]` フォールバックを必ず持たせる）。
  返す札が手札に無いと engine が state 不変で拒否 → **同じ手を返し続けて本番 livelock**（§0-25 の門番と同じクラス）。
- UI：`modalSingleHand`（skip なし）。**モーダルが1枚ごとに開き直る**ので、`UI.selection` の持ち越し（§0-29 A3 の [high]）に注意＝
  **確定時に必ず `takeSelection()` を通す**（pending キーが `ghost_ship/topdeck` のまま変わらないので、持ち越すと人間が詰む典型形）。

### (e) 順序と細部
- **`+2 Cards` が先、アタックが後**（カード記載順）。
- アタックは手番順（`othersInOrder`）。`attackImmune`（灯台/チャンピオン）＋堀/盾の反応窓は既存どおり。
- 被害者の山札の上が既知になるが、**それは被害者自身の情報**なので `maskStateFor` の私的看破リストへの追加は不要
  （攻撃側は中身を見ない＝`pending` に被害者の手札を載せてはいけない。載せると**オンラインで手札が丸見え**になる＝§0-29 A4 の [high] と同じ事故）。

### (f) 汎用ヘルパにするか
- 「手札をN枚になるまで山札の上に置く」は現状 Ghost Ship だけ。`topdeckDownEnter(state, source, down, victims)` として `discardDownEnter` の隣に置くのが素直（将来 Prosperity 2版の Clerk 以外に増えたときに効く）。**ただし `discardDownEnter` に `mode` 引数を足して分岐させるのは禁止**＝民兵型は「まとめ選択」で Ghost Ship は「1枚ずつ」＝**別の関数にしないと必ずどちらかが壊れる**。

## 4-5. 日本語カード名（要裏取り）

> 幽霊船 (pron. yūreisen)
> +2 カードを引く
> 他のプレイヤーは全員、手札が3枚になるように山札の上に置く。

🛑 **この日本語文は明らかに不完全**＝
①「手札が4枚以上の」という条件が落ちている ②「手札から」が落ちている ③「置く」の主語・対象が曖昧。
**そのままカタログに写してはいけない**。**日本語wiki での裏取りが必須**。
カタログ文の推奨（既存の簡潔スタイルに合わせる）：

```
+2 カード
手札4枚以上の他プレイヤーは、
手札が3枚になるまで手札を山札の上に置く。
```

⚠ **名前の衝突注意**：本アプリには既に **`haunted_castle`＝幽霊城**（帝国）・**`ghost`＝幽霊**（夜想曲）がある。
**「幽霊船／幽霊城／幽霊」の3つ巴**＝絵の判別で必ず事故る。

---

# 実装前に必読（この4枚に共通する罠）

1. **4枚とも「機能エラッタなし」＝現行（2019）文をそのまま採用**してよい。区切り線は**4枚とも0本**（生HTMLで `<hr>` を数えて確認済み）。
   1版オリジナル文との差は「代名詞の gender neutral 化」「獲得先が捨て札を経由しないことの明文化」「Pirate Ship の選択肢の順序入れ替え」だけ。

2. 🛑 **英語wiki の Japanese 行は 4枚中2枚が信用できない**。
   Pirate Ship は誤字（`目分`）と区切り記号の乱れ、**Ghost Ship は条件節が丸ごと欠落**している。
   **カタログ文は日本語wiki（＝Dominion Online 訳）で裏取りしてから書くこと**（§4 の決定3＝日本語文面は DO訳で統一）。

3. 🛑 **名前がぶつかる**（絵の回収・全文検索で必ず事故る）：
   - 海賊船 ↔ **海賊(pirate)** ↔ **私掠船(corsair)**
   - 海の妖婆 ↔ **海の魔女(sea_witch)** ↔ **沼の妖婆(swamp_hag)**
   - 幽霊船 ↔ **幽霊城(haunted_castle)** ↔ **幽霊(ghost)**
   - 探検家 ↔ **冒険者(adventurer)** ↔ 探検(expedition) ↔ 探査(exploration)
   ＝§0-37 の「連番＝生成順を信用せず、全候補から全単射で判別する」を**必ず**適用する。

4. **新 pending は例外なく4点セット**（engine reducer ＋ `PLAYER_ACTIONS` ＋ CPU `decidePending` ＋ UI `viewPendingModal`）。
   この4枚で増えるのは **`pirate_ship`(react/choose/pick)／`sea_hag`(react)／`explorer`(1択)／`ghost_ship`(react/topdeck)** ＝**新 action 7〜8個**。
   `*_RESOLVE`/`*_REACT` は `PLAYER_ACTIONS` にも足す（整合性テストが検査する）。

5. **アタック3枚は `ATTACKS` 登録表に1行ずつ**＋`*EnterVictim`＋`*_REACT` リゾルバ。
   `MOAT_REVEAL`/`SHIELD_REVEAL` は `isAttackReactPending(pd)`＝**`pd.stage === 'react'`** を要求する。

6. 🛑 **「捨てさせる」経路には必ず `triggerOnDiscard(..., true)` を呼ぶ**（坑道／小道／織工）。
   **コピー元の `thief` はこれを呼んでいない**（既存の取りこぼし）＝**写すとバグを新規に増やす**。

7. **獲得は必ず `gain()` を通し、戻り値（boolean）を見る**。`dest` は `'deck'`（Sea Hag）／`'hand'`（Explorer）。
   **`return gain(...)` と書かない**（§0-36 で `finishGain` の戻り値を `return` して state を消した事故と同型）。

8. **`t.coins += n` / `t.actions += n` を直接書かない**（`addCoins` / `addActions`）。Pirate Ship の「+$1 per token」が該当。

9. **資本主義(Capitalism)の集合が変わる**＝Pirate Ship は「+$」を持つアクション＝**財宝になる**（公式wikiの Strategy が明言）。
   `test/integrity.test.js:170` の **147枚 → 148枚** を意図的に更新すること（他の3枚は +$ を持たないので対象外）。

10. **既存の許容簡略化が Sea Hag で一気に露出する**＝
    **交易商人・物見やぐらの獲得時リアクションは自分の手番でしか開かない**（`triggerOnGain` js/engine.js:10578）。
    公式では**相手ターンの呪い獲得にも撃てる**（Trader × Sea Hag は最有名の防御コンボ）。
    **許容簡略化として明記するか、横断改修するかを着手前に決める**こと。

11. **配線チェックリスト**（整合性テスト・e2e が赤くする）：
    `DOM.CARDS` に4枚 → **新プール `POOLS.seaside1e`（26枚＝共有18＋1版限定8）** → `random-1e` の `randomFrom` に追加 →
    **CPU `GAIN_ORDER` に全 id**（網羅必須） → CPU `chooseAction` に4枚 → `js/ui.js` のカード一覧グループ →
    **webp 4枚を生成**（`CARDS_ONLY=pirate_ship,sea_hag,explorer,ghost_ship node tools/build-cards.js`＝**このPCのみ**） →
    **`sw.js` の VERSION を上げる**。
    `MIX_KINGDOM_POOLS` には**入れない**（`basic1e`/`intrigue1e` と同じ扱い＝1版カードは mix-all に出さない既存方針）。


## 【この章の敵対検証（別エージェントが一次資料に当たり直したもの）】
⚠ **上の起草と食い違う場合はこちらが正**（起草より後に、同じページを取り直して照合している）。

検証完了。リポジトリは1バイトも変更していません（`git status` クリーン／一時ファイル削除済み。`_m19v_*` は**並行セッションの別レビュアーの成果物**なので触っていません）。

# 検証の範囲

`tools/wikidirect.js` で **Pirate_Ship / Sea_Hag / Explorer / Ghost_Ship / Trader / Coin_token** を自分で逐次取得（生HTMLも `RAW_DIR` で取得して `<hr>` を実測）。実装側の主張は `js/engine.js` / `js/cards.js` / `test/integrity.test.js` を grep・`vm` で実ロードして確認。

**英語カード文の逐語・版(Versions)の3行・Official FAQ / Other rules clarifications / Deprecated FAQ の逐語は、4枚とも起草と一字一句一致していました（捏造ゼロ・改変ゼロ）。** 引用した engine の行番号も18箇所中17箇所が正確でした。以下は残った訂正と欠落です。

---

# A. 確定した訂正

## 訂正1 🛑【重大・実装の到達性】「mix-all に出さない＝他拡張と混ざらない」は成立しない（闇市場が全プールから作られる）

**① 起草の記述**
> `MIX_KINGDOM_POOLS` には**入れない**（`basic1e`/`intrigue1e` と同じ扱い＝1版カードは mix-all に出さない既存方針）。

さらに配線チェックリスト（項目11）に**闇市場と `DOM.STAGE1_POOLS` が1文字も出てこない**。Sea Hag の [risk] も「Sea Hag を**出荷すると**実プレイでバレる」と海辺1版セット前提で論じている。

**② 一次資料（`js/engine.js` の逐語）**
```js
// js/engine.js:2258
const universe = Array.from(new Set([].concat.apply([], Object.values(DOM.POOLS || {}))));
...
// js/engine.js:2273
blackMarket = shuffle(universe.filter((id) => DOM.CARDS[id] && id !== 'black_market' && !NON_SUPPLY.has(id) &&
  !inSupply(id) && !mixedContents.has(id) && !isMixedPileKey(id) && !stage1.has(id)));
```
＝**闇市場デッキの母集団は `DOM.POOLS` 全部の平坦化**。除外は非サプライ・混合山・`DOM.STAGE1_POOLS` だけ。そして `js/cards.js:1906` は **`DOM.STAGE1_POOLS = []`**。

実測（`vm` でロード）：universe は **575枚**で、`adventurer / scout / chancellor / thief / spy / tribute / saboteur / secret_chamber / coppersmith` が**すべて含まれる**＝**1版限定カードは既に今日、全対局の闇市場デッキに入っている**。

**③ 正しい記述**
`POOLS.seaside1e` を新設した瞬間、**この4枚は「闇市場がある対局」すべてで購入可能になる**。したがって：

- **Sea Hag × 交易商人 / 物見やぐら**は「海辺1版セット限定」ではなく、**`hinterlands` / `prosperity` / mix-all の対局からも到達する**。起草の [risk] (c) の深刻度は上がる。
- **Pirate Ship × 資本主義（ルネサンス）／× 長老(Elder)（同盟）／× 習性(Way)（移動動物園）／× パトロン**もすべて到達する。
- 🛑 **CPU は闇市場で `GAIN_ORDER` 上位38枚しか買わない**（PROGRESS §0-29 A5 の明記）＝**CPUソークを何戦回してもこの経路は1度も検証されない＝「人間だけが通る道」**。敵対レビューでは購入を強制注入して補うこと。
- 🛑 **段階1（カタログだけ先に入れる）で止めるなら `DOM.STAGE1_POOLS` に `'seaside1e'` を必ず入れる**（入れないと「買っても何も起きない死に札」が $0 で闇市場に並ぶ＝PROGRESS が繰り返し警告している事故）。**チェックリストにこの1行を足すこと。**

---

## 訂正2 【低】Pirate Ship の FAQ は3節ではなく4節（`Deprecated official FAQ (2017)` の見落とし）

**① 起草の記述** — Pirate Ship の FAQ を `Official FAQ` / `Other rules clarifications` / `Deprecated official FAQ (2009)` の3節として提示。

**② 一次資料（Pirate_Ship ページの目次・逐語）**
```
1 FAQ
 1.1 Official FAQ
 1.2 Other rules clarifications
 1.3 Deprecated official FAQ (2017)
 1.4 Deprecated official FAQ (2009)
```

**③ 正しい記述** — 4節ある。ただし **(2017) 節の中身は現行 Official FAQ ＋ Other rules clarifications をそのまま合併したもの**（1行ずつ突き合わせて完全一致を確認）＝**情報の欠落は無い**。「FAQ節を丸ごと見落としていないか」の観点で記録に残すべき、というだけ。
※ Sea Hag は3節（Official / Other rules clarifications / Deprecated 2009）、Explorer と Ghost Ship は2節（Official / Deprecated 2009）で、**`Other rules clarifications` が無いのは Explorer と Ghost Ship の2枚**（起草は Explorer だけ「唯一」と書いているが Ghost Ship も無い）。

---

## 訂正3 【低】`witchCurse` の行番号

**① 起草** ＝ `witchEnterVictim` js/engine.js:3804／`witchCurse` **3816**
**② 実測** ＝ `3815:  function witchCurse(state, source, victim, queue) {`
**③ 正しい記述** ＝ `witchCurse` は **3815行**。

他の引用は全部正確でした（`isAttackReactPending` 3719／`MOAT_REVEAL` 14604／`thiefEnterVictim` 3773／`thiefReveal` 3784／`THIEF_PICK` 15879／`triggerOnDiscard` 10885／`clerkEnterVictim` 5062／`clerkProceed` 5075／`CLERK_TOPDECK` 18044／`villainEnterVictim` 3854・3867の `< 5` ガード／`discardDownEnter` 4131／`triggerOnGain` のゲート **10578**／`reveal` 2511／`GAIN_TO_HAND` 2754／`markLingerImmune` 4607／`lingerAttackEnter` 4611／player初期化 `coffers` 2090・`villagers` 2091・`favors` 2092／`test/integrity.test.js:170` の `set.length === 147`）。

---

## 訂正4 【低】Explorer の多言語メモの帰属

**① 起草** ＝「参考：**Trivia** に「イタリア語では〜」「スペイン語では〜」とある」
**② 一次資料** ＝ どちらも **`Other language versions` 表の Notes 欄**。逐語＝ Italian: `Avventuriero (lit. adventurer - Esploratore was already taken by Adventurer)` ／ Spanish: `Exploradora (Note: explicitly feminine, due to Explorador already being used for Scout)`
**③ 正しい記述** ＝ Trivia 節ではなく言語表の Notes。内容自体は正しい。

---

# B. 足りていない項目

## B-1 🛑 Pirate Ship：リアクション窓を攻撃側だけに開くと、**免疫以外のリアクションを全部殺す**（起草の見積もりが過小）

起草は「パトロンの +1財源が動くタイミングが変わる」としか書いていない。公式逐語は2箇所：
> Players revealing a card like Moat do so before you **choose** your option.（Official FAQ）
> Pirate Ship is an Action-Attack and players can reveal **Secret Chamber even if you choose to use Pirate Ship for the coin value**.（Deprecated 2009）

＝**「Pirate Ship を使った」時点でアタックのリアクション窓が開く**（選択より前・選択に依存しない）。「攻撃を選んだときだけ窓を開く」（狐と同じ割り切り）にすると、**+$ 側を選ぶだけで相手の下記が全部不発**になり、**攻撃側が一方的に得をする**：

| 不発になるもの | 拡張 | 実害 |
|---|---|---|
| 馬商人 `horse_traders` | 収穫祭 | 脇に置けず次ターン +1カードを失う |
| 番犬 `guard_dog` | 異郷 | +2〜4カードを失う |
| 隊商の護衛 `caravan_guard` | 冒険 | +1カード／次ターン +$1 を失う |
| 外交官 `diplomat` | 陰謀 | +2カード→3枚捨て（engine.js:16278 `diplomatReacted`） |
| **秘密の部屋 `secret_chamber`** | **`intrigue1e`＝闇市場で到達** | +2カード→2枚を山札の上 |
| パトロン `patron` | ルネサンス | +1財源 |

→ 起草の「(i) 許容簡略化 / (ii) `lingerAttackEnter` 型で忠実に」という二択の提示は正しいが、**このコスト表を添えないと判断できない**。（狐は「呪いを配る側を選んだときだけ」＝相手が損をする側だけ窓が開く形なので、Pirate Ship とは非対称性の向きが逆。）

## B-2 Pirate Ship：**玉座の間で「攻撃 → +$」の順に選ぶと、直前に増えたトークンも数える**

`You get at most one Coin token per play of Pirate Ship.` ＋ トークンは被害者ループ終端で即時加算。1回目に攻撃が成功して +1個 → 2回目に「+$1 per token」を選ぶと**その新しいトークンも数える**。起草は「最大2個」までしか書いていない。起草の設計（(d) `anyTrashed` を pending に載せ、ループ終端で1回だけ加算）ならこれが自動的に正しくなるので、**回帰テストで固定すべき項目として明記**すること。

## B-3 Pirate Ship：**Coin token の「25」は上限ではない**（明記しないと事故る）

起草は Coin token ページを「トークンの正本」として引き、`Seaside (first edition only) — 25 / Pirate Ship` を挙げている。この 25 は**箱に入っている物理コンポーネントの枚数**であって、`(from the supply of tokens)` を含めて**ルール上の上限を作る記述はどこにも無い**。本アプリの `coffers`/`villagers`/`favors` も上限なし。→ **「25 は上限ではない＝上限を実装しない」と1行書くこと**（書かないと次の実装者が `Math.min(25, ...)` を入れかねない）。
※ 同ページの逐語で「Coffers / Villagers / Favors / Trade Route / Garrison / Sinister Plot と**同じ物理トークン**」であることは確認済み＝起草の「同型」判断は正しい。

## B-4 Pirate Ship：**資本主義下で「財宝を全部出す」ボタンが攻撃を自動発火する**

起草は「`turn.playAllResume` が既にあるので追加作業は不要」とだけ書くが、判断が2つ抜けている。
```js
// js/engine.js:14005
const treasures = me.hand.filter((c) => isTreasureFor(state, c) && !PLAY_ALL_EXCLUDE.has(c)).sort(playAllOrder);
// js/engine.js:1129
const PLAY_ALL_EXCLUDE = new Set(['cursed_gold', 'crucible', 'pickaxe']);
```
- **`PLAY_ALL_EXCLUDE` に入れるか**を明示的に決めること。既存3枚は「押すと必ず損する」から除外＝Pirate Ship は損しないので**入れないのが筋**（既存の資本主義アタック `relic/coven/gatekeeper/archer/barbarian/skirmisher/kitsune/samurai` と同じ扱い）。**この判断を書かないと後で揺れる。**
- `playAllResume` は §0-24 の [med] 修正で**中断時の残りキューを固定する**（手札を再スキャンしない）＝Pirate Ship の choose-one で中断しても意図どおり動くことを**テストで1本通す**こと。

## B-5 🛑 Sea Hag：**捨て札トリガーは `state.pending` を保持したまま呼ぶ**（engine 自身が前例をコメントで名指し）

起草は「`triggerOnDiscard(..., noPrompt=true)` を呼べ」までは正しいが、**pending の扱いを書いていない**。engine には**まさに同型の前例のコメント**がある：
```js
// js/engine.js:20266（神託 ORACLE）
// ★pending は 'oracle' のまま保持したまま捨て処理する＝tunnel の金貨獲得等が trader_react 等の
```
＝坑道(tunnel)を捨てさせると**その金貨獲得が `trader_react` / `watchtower` の窓を立て、Sea Hag の被害者ループ（残りの被害者と呪い配布）を潰す**。§0-5 の異郷で実際に踏んだバグと同型。
※ 現状は被害者が非 active なのでゲート（`pIndex === state.turn.active`）で開かないが、**訂正1で「相手ターンにも窓を開く」横断改修をするなら必須**になる。**その依存関係も書くこと。**

## B-6 Ghost Ship：`UI.selection` の持ち越しは **相手のターンに開く窓なので最も危険**

起草は `takeSelection()` に触れているが、§0-29 A3 の [high] の要点が半分抜けている：
- **CPU の手番中はモーダルが描かれず（`interactive=false`）pending キーが変わらない**＝`ghost_ship/topdeck` のまま前ターンの手札インデックスが残る。
- 対策は `takeSelection()`（確定時に捨てる）**だけでなく `pruneSelection`（描画時に範囲外を間引く）も要る**（同節で両方が導入されている）。
- 初心者モードOFFだと `.modal-scrim` が盤面も☰も覆う＝**脱出口ゼロ**。

## B-7 `random-1e` の母集団を変えると**出荷済みセットの挙動が静かに変わる**

起草は「`random-1e` の `randomFrom` に `'seaside1e'` を足す＝既存流儀」と書くが、`random-1e`（「初版から」）は**既に出荷済み**。整合性テストは
```js
// test/integrity.test.js:91-93
DOM.CARD_SETS.filter((s) => s.randomFrom).forEach((s) =>
  s.randomFrom.forEach((p) => ok(!!DOM.POOLS[p], 'random ' + s.id + ' の母集団 ' + p + ' が存在')));
```
＝**プールが実在するかしか見ない**ので、母集団が 50→76枚に増えても**テストは緑のまま**。→ (i) `random-1e` に混ぜる（名前どおりで妥当）か (ii) `random-seaside1e` を別立てするかを**明示的に決めて PROGRESS に書く**こと。

## B-8 共有18枚の 1e/2e テキスト差を確認していない

`seaside1e = 共有18 + 1版限定8 = 26` の算術は正しい（`POOLS.seaside` 27枚 − 2版新規9 = 18 を実測確認）。しかし**共有18枚のうち 1版と現行でテキストが違うもの**（Outpost の 2019エラッタ等）に触れていない。本アプリのカタログは現行文を共有するので実害は無い見込みだが、**「1版の対局なのに 2版の文言・挙動で動く」を許容簡略化として明記**すること（`basic1e`/`intrigue1e` が同じ扱いであることを確認してから書けば「既存流儀に一致」と言える）。

## B-9 Explorer：獲得の後に物見やぐら／ティアラ／交易商人の窓が開く（起草が触れていない分岐）

`gain(..., 'hand')` は `triggerOnGain` を通り、そのゲートは
```js
// js/engine.js:10578
if (state.turn && pIndex === state.turn.active && state._gainDepth === 1 && !state.pending) {
```
＝**Explorer の pending を先に `null` にしてから gain すれば窓が開き、保持したまま gain すれば開かない**。Explorer は**自分の手番・トップレベル獲得＝開くのが公式**なので `pending = null` を先に置くこと。**この分岐を明記しないと実装者が任意に選ぶ。**

## B-10 日本語名の断定について＝**指摘なし（起草は正しく留保している）**

起草は4枚とも「⚠ 実物と食い違うことがある（日本語wiki 裏取り要）」と書いており**断定していない**。そのうえで独自に確認した結果、起草の指摘は**両方とも正確**でした：

- **Pirate Ship の JP 行は実際に壊れている**：`あなたは目分の海賊船マット`（＝**自分**の誤字）、選択肢の区切りが `;` ではなく `:`。→ そのまま写してはいけない。
- **Ghost Ship の JP 行は条件節が丸ごと欠落**：`他のプレイヤーは全員、手札が3枚になるように山札の上に置く。` ＝ **韓国語（`손에 있는 카드가 4장 이상인`）／ポーランド語（`który ma na ręce co najmniej 4 karty`）／ロシア語（`с четырьмя или более картами в руке`）／スペイン語（`con 4 cartas o más en su mano`）にはすべて「4枚以上」がある**のに**日本語行だけ無い**。→ 起草の警告と代替カタログ文は妥当。
- **Sea Hag / Explorer の JP 行は現行英文と完全に整合**（逐語照合済み）＝信頼度は高い。

**名前衝突の警告は全件、リポジトリ実データで裏が取れました**：`pirate`＝海賊／`corsair`＝私掠船／`sea_witch`＝海の魔女／`swamp_hag`＝沼の妖婆／`haunted_castle`＝幽霊城／`ghost`＝幽霊／`adventurer`＝冒険者／`scout`＝斥候／`expedition`＝探検(event)／`exploration`＝探査(project) が**すべて実在**。

---

# C. 訂正なし（独自に確認して起草が正しかったもの）

- **英語カード文の逐語（4枚）／Versions 表の3行ずつ／機能エラッタ0件**＝一字一句一致。2016 と 2019 の差が Pirate Ship のカンマ1つ（`Treasure you add` → `Treasure, you add`）だけ、という細部まで正確。
- **`<hr>`（区切り線）0本**＝Ghost Ship と Pirate Ship の**生HTMLを自分で取得して独立に確認**（ページ全体でも 0）。Ghost Ship は `<b>+2&#160;Cards</b><p>…</p>` ＝ 改行であって区切り線ではない、も確認。Sea Hag / Explorer は1文＝構造上あり得ない。
- **`thief` が `triggerOnDiscard` を呼んでいない**（既存の取りこぼし）＝**確認できた**。`THIEF_PICK`(15889) の `rest.forEach((c) => v.discard.push(c))` と `thiefReveal` の財宝なし分岐の両方に無い。起草の「写すとバグを新規に増やす」は正しい。
- **`thiefReveal` のシャッフル手順が 2009 FAQ と一致**（1枚 shift → `reshuffleDeck` ＝ `without including the revealed card`／足りなければ break ＝ `just reveals what he can`）＝確認できた。
- **`witchCurse` を素直にコピーすると捨てが漏れる**＝確認できた（`if ((state.supply.curse || 0) > 0)` が gain だけを包んでいる）。
- **`isAttackReactPending` が `pd.stage === 'react'` を要求**（3719）／**`maskStateFor` が `Object.assign({}, p, …)` なので新スカラーは公開のまま自動で残る**／**`gain(..., 'deck')` は `p.deck.unshift`（＝一番上）**／**`GAIN_TO_HAND` の置換は `dest === 'discard'` のときだけ（2754）**＝すべて確認できた。
- **`trader_react` / `watchtower` が active プレイヤーの獲得でしか開かない**（10578 の `else if` 連鎖）＝確認できた。
- **Trader の「2020年の機能更新で獲得置換 → 獲得後の交換」**＝Trader ページの逐語で確認：`it received a functional update in 2020, turning its reaction into an exchange taking place after you gain the card` ／Versions の Changes 欄 `Triggers on when-gain instead of when-would-gain.`（Announced October 2020）。
- **`CLERK_TOPDECK` が1枚だけ（`removeOne(v.hand, card); v.deck.unshift(card);`）／`clerkProceed` が反応の後に手札枚数を測り直す**＝確認できた。Ghost Ship を「clerk のループ版」として書く起草の設計は正しい。
- **`ELDER_CHOICE_ORDER` は同盟の9種のみ**（town / blacksmith / town_crier / innkeeper / broker / stronghold / hill_fort / modify / specialist）＝確認できた。ただし**訂正1により Pirate Ship × 長老は闇市場経由で到達する**ので、「登録しない」を許容簡略化として PROGRESS に明記する必要度は上がる。
- **資本主義 147→148**＝`test/integrity.test.js:170` の `ok(set.length === 147, ...)` を確認。`CAPITALISM_RE = /[+＋]\s*\d+\s*コイン/` なので、カタログ文に「+1 コイン」と書けば自動でヒットする、という起草の指示も正しい。Pirate Ship が対象になることは wiki の Strategy 逐語（`Pirate Ship's strongest synergy is with Capitalism …`）でも裏が取れた。
- Ghost Ship の Secret history 逐語（`This used to say "3 or fewer," but that confused people.`）＝一致。


---

# 第3章　繁栄 第1版 A ― 借入金(Loan)／交易路(Trade Route)／護符(Talisman)／禁制品(Contraband)／会計所(Counting House)

繁栄(Prosperity) 第1版限定カード5枚の公式ルール確定（英語wiki 逐語・2026-08-22 取得）。
一次資料＝`wiki.dominionstrategy.com` の各カードページ（`node tools/wikidirect.js` で直読み、区切り線は `RAW_DIR` の生HTMLで `<hr>` を実数）。

⚠ **前提の確認**：`js/cards.js` の `DOM.POOLS.prosperity` は**第二版の25種**（anvil/clerk/investment/collection/crystal_ball/magnate/war_chest/tiara/charlatan）で、この5枚は**カタログに1枚も存在しない**（`grep` で0件）。既に `BASE_REMOVED_1E` / `INTRIGUE_REMOVED_1E` ＋ `DOM.POOLS.basic1e` / `intrigue1e` ＋ CARD_SET `random-1e`（`js/cards.js` 1730-1768, 2013行）という**初版カードの前例インフラがある**ので、`PROSPERITY_REMOVED_1E` ＋ `DOM.POOLS.prosperity1e` を同じ形で足し、`random-1e` の `randomFrom` に加えるのが素直。

---

# 1. Loan（$3・財宝）

## 1. 英語カード文（現行の逐語）

> [$1]
> Reveal cards from your deck until you reveal a Treasure. Discard it or trash it. Discard the other cards.

**区切り線＝0本**（生HTMLに `<hr>` なし＝コイン記号と本文が同じブロック。2020年の "When you play this" 削除で全部が「使用時効果」になったため）。

## 2. 版（Versions）

機能エラッタは**無し**（文面整理だけ3回）。

| 版 | 逐語 | 変更 |
|---|---|---|
| First edition（2010-10） | > [$1] When you play this, reveal cards from your deck until you reveal a Treasure. Discard it or trash it. Discard the other cards. | — |
| 2016-10 発表／2017-02 印刷 | 同文 | > Increased font size. |
| 2020-10 | > [$1] Reveal cards from your deck until you reveal a Treasure. Discard it or trash it. Discard the other cards. | > Removed "When you play this" from Treasures. |

→ **採用は最終行（2020）**。機能差ゼロ。

## 3. Official FAQ（逐語・全文）

> When you play Loan, you get [$1], reveal cards from the top of your deck until revealing a Treasure card, and then decide whether to trash that card or discard it.
> Then you discard all of the other revealed cards.
> If you run out of cards before revealing a Treasure, shuffle your discard pile (but not the revealed cards) to get more; if you still do not find a Treasure, just discard all of the revealed cards.

**Other rules clarifications 節は存在しない**（目次が 1.1 Official FAQ / 1.2 Deprecated のみ）。

Deprecated official FAQ (2010) の追加分（逐語）：

> This is a Treasure worth [$1], like Copper.
> Remember that you can play Treasures in any order in the Buy phase and can choose not to play some of your Treasures if you want.

## 4. ⚠ 実装で危ないところ

- **`revealFromDeck(state, pi, pred)`（`js/engine.js` 5121行）がそのまま使える**。この関数は
  「山札が尽きたら `reshuffleDeck(p)` するが、**めくった札(`skipped`)は `p.discard` に入れずローカル配列に持っている**」
  ＝公式の「**revealed cards は混ぜない**」を既に満たしている。**自前で `p.deck.shift()` ループを書かないこと**（混ぜてしまう）。
- **述語は `isTreasureFor(state, c)`**（`DOM.isType(c,'treasure')` を直書きしない）。
  資本主義(Capitalism)下では +$ を持つアクションが**財宝**なので Loan はそれを見つける。前例＝`case 'farming_village'`（7212行）が
  `(c) => DOM.isType(c,'action') || isTreasureFor(state, c)` と書いている。
- **新 pending が1つ要る**（`loan_choose`＝「捨てる／廃棄する」の2択）。**4点セット必須**。
  - **候補ゼロなら窓を開かない**＝財宝が1枚も出なければ pending を立てず、`skipped` を全部捨てて終わり（辞退ボタン不要／
    両選択肢とも常に合法なので**人間が詰まない・CPU が livelock しない**）。
  - CPU `decidePending` は「銅貨なら廃棄／それ以外は捨てる」程度で十分だが、**必ず非 null を返す**こと。
- **順序＝①めくる → ②公開 → ③その1枚を捨てる/廃棄する → ④残りを捨てる**（公式FAQ が "Then you discard all of the other revealed cards"）。
  ⚠ **③④は `loan_choose` の reducer 内で完結させる**（`skipped` は pending に載せて持ち越す）。
- **④の「残りを捨てる」は `triggerOnDiscard(state, pi, skipped)` を必ず呼ぶ**（坑道 Tunnel が金貨を出す・小道 Trail・織工 Weaver）。
  ⚠ `farming_village` は `p.discard.push(c)` の直書きで**呼んでいない**＝それをコピーすると §0-31 の「民兵が坑道を空振り」と同じ穴を再生産する。
  ③で「捨てる」を選んだ1枚も**捨て札トリガーの対象**（坑道を捨てたら金貨）。
- **③の廃棄は `trashCard(state, pi, card)`**（支配 Possession の退避・墓標 Tomb・司祭・青空市場・城塞 が正しく走る）。
  この札は手札にも山札にも属さない「公開中の宙ぶらりん」なので、`removeOne` は不要（`skipped`/`matched` から取るだけ）。
- **`reveal(state, pi, shown, '借入金で公開')` を通す**（パトロン Patron の +1財源はアクションフェイズ限定なので Loan では発動しないが、
  公開フックは唯一の入口に集約する方針＝§0-22）。
- **財宝なので効果は `applyTreasureEffect`（1324行）に書く**。`applyEffect` は財宝では呼ばれない。
  `coin: 1` をカタログに入れれば +$1 は共通処理で出る（効果側に書かない）。
- **`PLAY_ALL_TREASURES` で pending が立つ**＝`t.playAllResume`（§0-24）が残りを出し切る。**`PLAY_ALL_EXCLUDE` には入れない**
  （廃棄は任意なのでボタン1つで事故らない。`cursed_gold`/`crucible`/`pickaxe` とは性質が違う）。
- **`playAllOrder` の rank は 0（既定）でよい**。ただし戦略上は早く出したいので、必要なら `-1`（銀貨と同じ）を検討する程度。
- **旭日：`noteTreasurePlayedForProphecy` は `playTreasureCard` 側で自動**（豊作／狼狽）。効果側で触らない。
- **-1カードトークン（冒険）は無関係**（「公開」はドローではないので `draw()` を通らない＝正しい）。
- 🛑 **300回ガード**：`revealFromDeck` は `guard++ < 300` で止まる。財宝ゼロのデッキ（呪い＋屋敷だけ等）でも
  `p.deck.length===0 && p.discard.length===0` で `break` するので無限ループしない。

## 5. 日本語カード名（参考）

英語wiki の Other language versions の Japanese 行：

> 借金 (pron. shakkin)
> [$1] 財宝カード1枚が公開されるまで山札を上から公開する。その1枚を捨て札にするか廃棄する。公開した他のカードを捨て札にする。

⚠ **この行は実物と食い違うことがある**（§0-31 で夜想曲の17枚が食い違った実績あり）。
**⚠ しかも今回のタスク指示は「借入金」で、wiki の「借金」と一致していない**＝**日本語wiki で必ず裏取りすること**（この調査では日本語wiki を叩けないため未確定）。

---

# 2. Trade Route（$3・アクション） 🛑 最重量

## 1. 英語カード文（現行の逐語）

> **+1 Buy**
> Trash a card from your hand. **+[$1]** per Coin token on the Trade Route mat.
> ————
> Setup: Add a Coin token to each Victory Supply pile; move that token to the Trade Route mat when a card is gained from the pile.

**区切り線＝1本**（生HTMLで確認。`</p><hr .../>Setup:` ＝ Setup 行の直前に1本だけ）。

## 2. 版（Versions）＝🛑 **機能エラッタあり（解決順が逆転している）**

| 版 | 逐語 | 変更 |
|---|---|---|
| **First edition（2010-10）** | > +1 Buy<br>> +[$1] per token on the Trade Route mat. Trash a card from your hand.<br>> Setup: Put a token on each Victory card Supply pile. When a card is gained from that pile, move the token to the Trade Route mat. | — |
| **2016-10 発表／2017-02 印刷（＝現行）** | > +1 Buy<br>> Trash a card from your hand. +[$1] per Coin token on the Trade Route mat.<br>> Setup: Add a Coin token to each Victory Supply pile; move that token to the Trade Route mat when a card is gained from the pile. | > **Trash before gaining +$.**<br>> Increased font size. |

🛑 **「廃棄が先・+$が後」が公式エラッタの本体**。旧版どおり「+$ が先」に書くと、下の FAQ が名指しする狩場(Hunting Grounds)の例が再現できない。

## 3. Official FAQ（逐語・全文）

> You get +1 Buy, and trash a card from your hand if you can.
> Then you get +[$1] per Coin token on the Trade Route mat.
> This card has setup; at the start of games using it, you put a Coin token on each Victory card pile being used (including Kingdom card piles such as Gardens, and Colonies if used).
> In the rare cases where there are more than 8 Victory piles, the tokens are not counter-limited; use a replacement.
> Whenever any player gains the first card from a Victory card pile - whether by buying it or otherwise gaining it - the Coin token is moved to the mat.
> So if no Victory cards have been gained this game, the mat has no tokens and Trade Route makes +[$0]; if four Provinces and one Estate have been gained, the mat has two tokens and Trade Route makes +[$2].
> If you are using the promotional card Black Market, and Trade Route is in the Black Market deck, you do the setup for Trade Route.

## Other rules clarifications（逐語・全文）🛑 実装の核心

> Certain Victory cards come from split piles that are not themselves Victory card piles, such as Dame Josephine and Territory; gaining them does not add a token to the Trade Route mat.
> However Castles are a Victory Card pile.
> The Trade Route token on a pile will not move if the top card of a pile is removed without gaining it, such as when you trash it with Salt the Earth, or exile it with Way of the Worm or Enclave.
> If you gain a Victory card from the trash pile, you still move a Coin token from its Supply pile to the mat.
> You get +[$] after trashing a card. So if you trash a Hunting Grounds and gain the first Duchy, that will increase the +[$] you get from this.

（生HTMLに `<sup>` ＝脚注は0個＝2025年9月の脚注一括削除の影響を受けていない箇所）

## Deprecated official FAQ (2010) の追加分（逐語）

> If you have no cards left in hand, you do not trash one.
> The amount you get from Trade Route is the same as +[$1] per Victory card pile that a card has been gained from this game.
> If Victory cards have been gained from outside the Supply piles, for example using the promotional card Black Market, then this does not count those.
> So for example if this game includes the Dominion: Intrigue card Harem, and so far Harem and Duchy have been bought, but no-one has bought (or otherwise gained) Estate or Province or Colony, then Trade Route makes [$2].
> It does not matter who gained the cards or how they gained them.
> You do not get any extra money if a pile has had multiple cards gained from it or is empty; all that matters is if at least one card has been gained from it.
> It does not matter if cards have been returned to a pile, such as with Ambassador from Dominion: Seaside; Trade Route only cares if a card was ever gained from the pile this game.

## 4. ⚠ 実装で危ないところ

### (a) 「どの山が勝利点の山か」＝**randomizer（山キー）の静的種別**で決める（🛑 `isTypeSupply` を使ってはいけない）

公式の逐語が本アプリの既存構造とちょうど一致する：

| 山 | 公式 | 本アプリの `DOM.CARDS[pileKey].types` | 判定 |
|---|---|---|---|
| Estate/Duchy/Province/Colony | ○ | victory | トークンを置く |
| 庭園・ハーレム・島・絹の道・封土・トンネル・遠隔地… | ○（"including Kingdom card piles such as Gardens"） | victory を含む | 置く |
| **Castles（城）** | ○（"However Castles are a Victory Card pile."） | `castles: types:['victory','castle']`（763行） | **置く** |
| **Knights（騎士・デイム・ジョセフィーヌ入り）** | ✕（"Dame Josephine …; gaining them does not add a token"） | `knights: types:['action','attack','knight']`（559行） | **置かない** |
| **同盟の分割山（衝突＝領土 Territory 入り／叙事詩＝遠い海岸／城砦＝要塞）** | ✕（"Territory"） | `clashes/odysseys/forts` とも `types:['action', …]` | **置かない** |
| Curse | ✕（勝利点種別ではない） | curse | 置かない |
| 廃墟(ruins) | ✕ | action | 置かない |
| 避難所(shelters) | ✕（サプライではない） | — | 置かない |

→ **`DOM.isType(pileKey,'victory')` の静的判定が公式と1対1で対応する**。
🛑 `isTypeSupply(state,id,'victory')`（＝一番上の実カードの種別）を使うと、**衝突の山を掘って領土が一番上に来た瞬間に山が「勝利点の山」に化ける**＝公式違反。
これは §0-29 A2b で確立した「**山のコスト・種別は randomizer 固定／買うときのコストは一番上**」という線引きそのもの。

### (b) 準備＝`state.pileDebt`（徴税 Tax）のコピーでよい

`createInitialState`（2314-2318行）の徴税ブロックが完全な雛形：

```
const pileDebt = {};
if (events.indexOf('tax') >= 0) {
  Object.keys(supply).forEach((id) => { if (!NON_SUPPLY.has(id) && !SPLIT_TOP[id]) pileDebt[id] = 1; });
}
```
→ Trade Route 版は同じ形で `&& DOM.isType(id,'victory')` を足すだけ。
- **`!NON_SUPPLY.has(id)`** ＝賞品・戦利品・馬・略奪品・精霊 などの非サプライ数値キーを弾く（**必須**）。
- **`!SPLIT_TOP[id]`** ＝分割山の下段を弾く（1山1トークン）。ただし勝利点の分割山下段は現状ほぼ無いので実質無害。
- 🛑 **`landmarks.length` のようなゲートを付けない**＝**闇市場デッキに Trade Route が入っているだけでも準備を走らせる**
  （公式FAQ が明示）。＝判定は「王国 or 闇市場母集団に `trade_route` があるか」。**`DOM.LOOT_GIVERS` / `DOM.HORSE_GIVERS` と同じ「そのカードがあるときだけ準備する」パターン**だが、闇市場も見る点が独特。

### (c) state は**3層ではなく2フィールド**で足りる（どちらも**非カード**＝保存則 tally に入れない）

```
state.tradeRoutePiles = { [pileKey]: 1 }   // まだトークンが乗っている山（公開）
state.tradeRouteMat   = n                  // マットへ移った個数（公開・全プレイヤー共有）
```
- **マットは1枚だけの共有マット**（"the Trade Route mat"）＝**プレイヤーごとに持たない**。
  公式 "It does not matter who gained the cards or how they gained them." → 誰の Trade Route も同じ `n` を見る。
- 前例＝**`state.pileVP`（山の上のVP）＋ `state.landmarkStash`（山→ランドマークへ移した一時VP）の完全な同型**（748-750行）。
  水道橋(Aqueduct)／汚された神殿(Defiled Shrine) が「山に置いた token を別の場所へ移す」という**まったく同じ二段構造**をしている。
- 🛑 **保存則 tally（`test/invariants.test.js`）にも `allCards` にも入れない**（`state.pileVP` / `state.pileDebt` / `p.favors` と同じ非カード）。
- 🛑 **旧スナップショット互換**＝サーバは state を無変換で復元するので、読むときは必ず `(state.tradeRouteMat || 0)` / `if (state.tradeRoutePiles && …)` でガードする（§0-20 の pileDebt と同じ）。
- **得点には一切影響しない**（VP ではなく Coin token）。`scoreGame` / `vpOf` / CPU `vpOfPlayer` は触らない。

### (d) トークンの移動フック＝`triggerOnGain` に1箇所

```
const k = pileKeyOf(state, gainedCard);
if (state.tradeRoutePiles && state.tradeRoutePiles[k]) {
  delete state.tradeRoutePiles[k];
  state.tradeRouteMat = (state.tradeRouteMat || 0) + 1;
}
```
- 🛑 **READ は必ず `pileKeyOf(state, card)` を通す**（826行）＝分割山の下段・混合山の中身（城8種→`castles`）を山キーに正規化する。
  §0-29 A2 の「汚された神殿の山上VPが孤児化」・§0-20 の徴税と**3回目の同型事故**になるので絶対に忘れない。
- **「トークンが乗っている山からの獲得」だけを見る**設計にすると、副作用として公式が要求する挙動が全部自動で揃う：
  - **闇市場で買った勝利点** → その山はサプライに存在しない → `pileKeyOf` の結果にトークンが無い → 移らない（deprecated FAQ 準拠 ✓）
  - **騎士の山からデイム・ジョセフィーヌ** → `knights` にトークンが無い → 移らない ✓
  - **城の山から粗末な城** → `castles` にトークンがある → 移る ✓
  - **2枚目以降の獲得** → トークンは既に無い → 何も起きない ✓（"You do not get any extra money if a pile has had multiple cards gained from it"）
  - **大使(Ambassador)で山に戻した後** → トークンは戻らない ✓
- 🛑 **「山からカードが抜けたが獲得ではない」場合はトークンを動かさない**＝
  塩まき(Salt the Earth)＝`trashFromSupplyPile`／ハツカネズミの習性(Way of the Mouse)・包領(Enclave) の追放＝`exileFromSupply`。
  **`triggerOnGain` にだけ書けば自動的に満たされる**（これらは `gain()` を通らない）。
  ⚠ 逆に言えば「supply の減算サイト全部に配線する」（＝略奪の調査 Search がやっている `pile_empty` フック）方式にすると**公式違反になる**。
- 🛑 **廃棄置き場からの獲得（墓暴き／盗賊／リッチ／物色）でもトークンは移る**（"If you gain a Victory card from the trash pile, you still move a Coin token from its Supply pile to the mat."）。
  本アプリでは `gainFromOutside` も `triggerOnGain` を呼ぶので**自動で満たされる**。
  ⚠ ただし deprecated FAQ の「サプライ外からの獲得は数えない（闇市場）」と字面が衝突して見える。
  **整合的な解釈＝「その名前の山がサプライにあり、まだトークンが乗っているか」だけを見る**（闇市場の札はサプライに山が無いので自然に除外される）。
  この解釈なら新旧どちらの FAQ も同時に満たせる。**この1行に集約する設計を強く推奨**。

### (e) 🛑 **「廃棄 → on-trash を全部解決 → その後に +$ を数える」**（エラッタの本体）

公式例＝**狩場(Hunting Grounds)を廃棄 → 公領を獲得 → そのトークンが移る → その +$1 も自分がもらえる**。
狩場の on-trash は**「公領1枚 or 屋敷3枚」の選択待ち**（`onTrashQueue` の `hunting_grounds_trash`・10997行）なので、
**廃棄した直後に数えたら間に合わない**。

→ **`t.kintsugiResume`（旭日の金継ぎ・12276-12285／13573-13586／18490行）が完全な雛形**：

```
// TRADE_ROUTE_TRASH の reducer 末尾
trashCard(state, pd.player, card);
state.pending = null;
t.tradeRouteResume = { player: pd.player };   // ← その場で数えない

// reduce 末尾の再開網
if (!state.pending && !state.gameOver && t.tradeRouteResume
    && !(state.onTrashQueue && state.onTrashQueue.length)
    && !(state.onGainQueue && state.onGainQueue.length)) {
  const n = state.tradeRouteMat || 0;
  addCoins(state, n);           // 🛑 t.coins += n を直接書かない（カメレオンの習性）
  t.tradeRouteResume = null;
  state = runReplays(state);
}
```
- 同じ理由で**青空市場(Market Square)／墓所(Tomb)／司祭／下水道**が絡んでも壊れない。
- 🛑 **手札0枚なら廃棄しないが +$ は得る**（"trash a card from your hand **if you can**"）＝
  **手札0枚では pending を立てず、その場で（または同じ再開網で）+$ を出す**。
  ここを「候補ゼロなら窓を開かない」だけで済ませて +$ も落とすと公式違反。
- **`+1 Buy` は廃棄より前**（カード記載順）＝`t.buys += 1` を最初に。

### (f) pending・CPU・UI

- 新 pending 1つ＝`trade_route_trash`（**手札から1枚を強制廃棄**）。**4点セット必須**。
  - **終端保証**＝`if (!pl.hand.length) { state.pending = null; return state; }`（`KINTSUGI_TRASH` 18480行と同型）。
  - 辞退ボタンは**不要**（強制）。ただし**手札0枚では窓を開かない**ので人間は詰まない。
  - CPU `decidePending` は「呪い＞廃墟＞屋敷＞銅貨」の既存廃棄優先度を流用し、**必ず非 null**を返す。
- **UI**＝山の右上に Coin トークンのバッジ（`pileVpBadge` / `pileDebtBadge` / `pileTokenBadge` と同じ枠組み）＋
  盤面に「交易路マット：🪙N個」の表示（**残数が見えないと戦略が立たない公開情報**＝§0-28 の非サプライ山表示と同じ理由）。

## 5. 日本語カード名（参考）

> 交易路 (pron. kōekiro)
> +1 購入／手札1枚を廃棄する。交易路マットの上の交易路トークン1枚につき +[$1]。
> 準備:勝利点カードのサプライの山すべての上に交易路トークン1枚を追加する。その山のカード1枚を獲得するとき、交易路トークンを交易路マットの上に移動する。

⚠ この行は実物と食い違うことがある（日本語wiki で裏取りが必要）。
⚠ **この日本語文は「廃棄が先」の現行エラッタ側**になっている（＝訳出時期が新しい）。

---

# 3. Talisman（$4・財宝）

## 1. 英語カード文（現行の逐語）

> [$1]
> ————
> While you have this in play, when you buy a non-Victory card costing [$4] or less, gain a copy of it.

**区切り線＝1本**（生HTMLで確認＝コイン記号と本文の間。「while in play」型の常設能力なので隠し財産 Hoard と同じレイアウト）。

## 2. 版（Versions）

機能エラッタは**無し**（言い回しの整理が3回）。

| 版 | 逐語 | 変更 |
|---|---|---|
| First edition（2010-10） | > While this is in play, when you buy a card costing [$4] or less that is not a Victory card, gain a copy of it. | — |
| 2016-10／2017-02 | > While this is in play, when you buy a non-Victory card costing [$4] or less, gain a copy of it. | > Shortened "card that is not a Victory card" to "non-Victory card". Increased font size. |
| 2019-05 | 同文 | > Formatting changes only. |
| **2020-10（現行）** | > While you have this in play, when you buy a non-Victory card costing [$4] or less, gain a copy of it. | > Rephrased "While this is in play" to "While you have this in play". |

## 3. Official FAQ（逐語・全文）

> Each time you buy a non-Victory card costing [$4] or less with this in play, you gain another copy of the bought card.
> If there are no copies left, you do not gain one.
> The gained card comes from the Supply and goes into your discard pile.
> If you have multiple Talismans, you gain an additional copy for each one; if you buy multiple cards for [$4] or less, Talisman applies to each one.
> For example if you have two Talismans, four Coppers, and two Buys, you could buy Silver and Trade Route, gaining two more Silvers and two more Trade Routes.
> Talisman only affects buying cards; it does not work on cards gained other ways, such as with Expand.
> Talisman only cares about the cost of the card when you buy it, not its normal cost; so for example it can get you a Peddler if you have played two Actions this turn, thus lowering Peddler's cost to [$4], or can get you a Grand Market if you have a Quarry in play.

## Other rules clarifications（逐語・全文）

> When you buy a card from the Black Market deck, you do not get a second copy of it even if Talisman is in play, since there is no second copy in the Supply.
> Talisman, like most other gainers, cannot be used to gain cards with [P] or [D] in their cost.
> This checks the cost of a card when you buy it, even if it changes later. So if you buy a Fisherman for [$2] and then gain a Sleigh with Charm, you will gain a second Fisherman, even though it now costs [$5].

## Deprecated official FAQ (2010) の追加分（逐語）

> A card is a Victory card if Victory is any of its types; for example Great Hall from Dominion: Intrigue is an Action - Victory card, so it is a Victory card.

## 4. ⚠ 実装で危ないところ

- **新 pending は不要**（獲得先は「買ったカードそのもの」＝選択が無い）。**`maybeHagglerGains`（値切り屋・11024行）の場所に並べるだけ**。
  ＝`BUY` reducer（14071行付近）で `maybeHagglerGains` の隣に `maybeTalismanGains(state, pi, card, boughtRef, boughtIsVictory)` を1行。
  値切り屋と違い pending を立てないので、**`!state.pending` ゲートも不要**（むしろ付けると、農地/過払いの pending が立っているときに空振りする）。
- 🛑 **コストも種別も「`gain()` を呼ぶ前」に確定させる**。
  `BUY` は既に `const boughtRef = costOf(state, card);` を **`gain()` の前**に取っている（14031行）＝**これをそのまま使う**。
  種別も同様に **`gain()` の前**に `isTypeSupply(state, card, 'victory')` を取る
  （🛑 `gain()` が混合山の一番上を `shift` するので、後で測ると別のカードの種別になる＝§0-29 A5 [low]6 の「獲得ログが獲得後の一番上を名乗る」と同じ罠）。
- **条件は 3成分**：`boughtRef.pot === 0 && boughtRef.debt === 0 && boughtRef.coin <= 4 && !boughtIsVictory`。
  🛑 `cardCost(state,id) <= 4` の素の数値比較は禁止（ポーション費用＝`$4+P`／負債コスト＝`$0+8D` を拾う。
  公式が "cannot be used to gain cards with [P] or [D] in their cost" と明記）。
  🛑 **`costUpTo(state, id, 4)` を呼び直してもいけない**＝それは「**今の**コスト」なので、漁師(Fisherman)×お守り(Charm) の公式例が壊れる。**必ず購入時にキャプチャした `boughtRef` を使う**。
- **枚数＝場にある Talisman の物理枚数**（`me.inPlay.filter((c) => c === 'talisman').length`）。
  値切り屋(11025行)と完全に同じ数え方。
  ⚠ 2020エラッタの "While **you have** this in play" は**持続で場に残っている間も含む**という意味なので、
  厳密には `inPlay` ＋ `durationCards` を見るのが正しい（財宝の Talisman が持続として場に残る経路＝旗艦／大名／専門家の再演）。
  本アプリの既存 `haggler` は `inPlay` だけを見ているので、**同じ簡略化に揃えるか、両方見るかを一度決める**こと（推奨＝`inPlay` のみ＝既存と揃える／許容簡略化として記録）。
- **獲得は `gain(state, pi, action.card, 'discard')` を枚数ぶんループ**。
  - 「山が空なら獲得しない」は `gain` の戻り値 false で自動。
  - **獲得先は捨て札**（"goes into your discard pile"）。ただし遊牧民の野営地(Nomad Camp)／ヴィラ(Villa) 等の**獲得先を変える on-gain は普通に働く**（`gain` が処理する）。
  - **獲得時トリガーが連鎖する**（国境の村・望楼・交易商人・ティアラ…）＝`gain` → `triggerOnGain` が対話を立てたら `state.onGainQueue` に積まれる。**自分で `state.pending` を直代入しない**。
- 🛑 **`BLACK_MARKET_BUY`（16547行）には配線しない**（公式＝サプライに2枚目が無いので獲得しない）。
  配線しなければ自動的に正しい。**片方だけ足す誘惑に負けないこと**。
- **`BUY_EVENT` / `BUY_PROJECT` にも配線しない**（イベント・プロジェクトは「カード」ではない）。
- **混合山／分割山を買った場合**：`gain(state, pi, 'townsfolk')` のように**山キーで獲得する**と、同名が4枚積まれている分割山では自然に「もう1枚の同じカード」が手に入る。
  ⚠ ただし**その名前の最後の1枚を買った直後**は、山の一番上が次の種類に変わっている＝**公式では「コピーが残っていないので獲得しない」**のに、本アプリでは別のカードを獲得してしまう。
  → **`mixedTopCard(state, pileKey) === 買ったカード` を確認してから獲得する**（1行）。忘れると「触れ役を買ったら蹄鉄工が付いてくる」。
- **CPU**：`bestGain` 等は不要（選択が無い）。ただし**購入評価**で「Talisman が場にあると $4以下の買い物が2枚になる」ことを CPU が知らないと弱いままだが、**engine拒否／livelock のリスクはゼロ**なので後回しでよい。
- **財宝なので効果（+$1）は `coin: 1`**、常設能力は `applyTreasureEffect` ではなく **`BUY` 側のフック**に書く（`applyTreasureEffect` には何も書かない）。

## 5. 日本語カード名（参考）

> 護符 (pron. gofu)
> [$1] これが場にある間、コスト[$4]以下の勝利点以外のカード1枚を購入するとき、それと同じカード1枚を獲得する。

⚠ この行は実物と食い違うことがある（日本語wiki で裏取りが必要）。

---

# 4. Contraband（$5・財宝）

## 1. 英語カード文（現行の逐語）

> [$3]
> +1 Buy
> The player to your left names a card. You can't buy that card this turn.

**区切り線＝0本**（生HTMLで確認。全部が使用時効果）。

## 2. 版（Versions）

機能エラッタは**無し**。

| 版 | 逐語 | 変更 |
|---|---|---|
| First edition（2010-10） | > [$3] +1 Buy / When you play this, the player to your left names a card. You can't buy that card this turn. | — |
| 2016-10／2017-02 | 同文 | > Increased font size. |
| **2020-10（現行）** | > [$3] +1 Buy / The player to your left names a card. You can't buy that card this turn. | > Removed "When you play this" from Treasures. |

## 3. Official FAQ（逐語・全文）

> When you play this, you get [$3] and +1 Buy.
> The player to your left names a card, and you cannot buy the named card this turn.
> This does not stop you from gaining the card in ways other than buying it (such as via Hoard).
> They do not have to name a card in the Supply.
> If you play multiple Contrabands in one turn, the player to your left names a card each time; if they name different cards, you cannot buy any of the named cards this turn.
> If you play Contraband before other Treasures, you hide how much [$] you will have; however the number of cards left in a player's hand is public information.

**Other rules clarifications 節は存在しない**。

Deprecated official FAQ (2010) の追加分（逐語）：

> You can play Treasures in any order, and you resolve this ability right when you play it, before playing any further Treasure cards.
> Note that once you buy a card in the Buy phase, you cannot play more Treasures.
> The number of cards left in a player's hand is public information; you can ask whenever you want to know it (for example, when that player plays Contraband).

## 4. ⚠ 実装で危ないところ

- **新 state ＝ `t.contraband = [cardId, ...]`（ターン限りの非カード配列）**。
  `freshTurn`（1984行）に `contraband: []` を足す（＝毎ターン自動でリセット＝「this turn」が保証される）。
  🛑 **配列**にすること（複数の Contraband で**異なる名前が積まれる**＝公式明記）。
  `t.cantBuyActions`（夜想曲の錯乱・3350行）と同じ層だが、**あちらは boolean 1つ／こちらは名前のリスト**。
- **購入禁止の判定は `canBuyCard(state, pi, id)`（3339行）に1行足すだけ**。
  ここは **engine拒否・CPU非提案・UIボタン無効化の3面が共有する唯一の述語**なので、ここに書けば本番 livelock も「押しても何も起きないボタン」も構造的に防げる（§0-23 の教訓）。
  ```
  if (state.turn && state.turn.contraband && state.turn.active === pi
      && contrabandBlocks(state, id)) return false;
  ```
- 🛑 **混合山の名指し**：`modalNameCard`（`js/ui.js` 4888行）は **`SUPPLY_ORDER` ＋ 混合山の中身**（`MIX.forEach((k) => (state[k]||[]).forEach(push))`）を候補に出す＝
  「デイム・アンナ」「王城」のような**中身のカード名**が指名され得る。
  一方 `BUY` は**山キー**（`knights` / `castles`）で来る。
  → `contrabandBlocks(state, id)` は **`id` そのもの**と **`mixedTopCard(state, id)`** の両方を照合すること
  （＝「デイム・アンナを指名 → 騎士の山の一番上がデイム・アンナのときだけ買えない」＝公式どおり）。
- 🛑 **`BLACK_MARKET_BUY`（16547行）にも同じチェックを足す**。闇市場の「買う」も購入なので Contraband は効く。
  既に `debt` / `noBuyCards` / `cantBuyActions` の3つを個別に持っている場所なので、**4つ目として並べる**（`canBuyCard` を呼んでいないので自動追随しない）。
- **イベント／プロジェクト／ランドマークは止まらない**（"names a **card**"）＝`BUY_EVENT` / `BUY_PROJECT` には**足さない**。
  ⚠ wiki の Strategy 節が「支配(Dominate)や凱旋(Triumph)のようなイベント中心の局面では Contraband が使える」と明記＝**これは仕様であって漏れではない**。
- **「購入以外の獲得」は止まらない**（"This does not stop you from gaining the card in ways other than buying it (such as via Hoard)."）＝`gain()` には一切触らない。
- **新 pending 1つ＝`contraband_name`（`player` は左隣の席）**。**4点セット必須**。
  - 🛑 **pending の持ち主が手番プレイヤーではない**＝§0-29 A4 の**射手(Archer)** と同じ形（「被害者が選ぶ／使用者が選ぶ」の跨ぎ）。
    オンラインでは左隣のクライアントにモーダルを出す必要がある。**`viewPendingModal` は `pd.player` を見て描く**既存の枠組みに乗る。
  - **候補ゼロは起きない**（サプライは常に非空）＝辞退ボタン不要。ただし CPU は**必ず非 null** を返すこと。
  - CPU の指名ヒューリスティック＝「相手が買えそうな範囲（＝相手の場のコイン＋手札枚数からの推定）で `GAIN_ORDER` が最も強いカード」。
    最低でも `province` / `gold` のような固定でも livelock はしない。
- **「サプライ外のカードも指名できる」は許容簡略化にできる**。
  公式 "They do not have to name a card in the Supply." だが、**サプライ外のカードは元々購入できない**ので、指名しても効果はゼロ
  （＝「指名を辞退する」代わりに使う抜け道でしかない）。`modalNameCard` はサプライ＋混合山の中身しか出さないが、
  相手は銅貨や呪いを指名すれば実質同じことができる＝**機能差なし**。**PROGRESS に「許容簡略化」として1行残す**こと。
- **財宝なので効果は `applyTreasureEffect`（1324行）に書く**。`coin: 3` はカタログへ、`t.buys += 1` と pending の設置だけを書く。
- **`PLAY_ALL_TREASURES` で pending が立つ**＝`t.playAllResume` が残りを出し切る（§0-24）。
  ⚠ `PLAY_ALL_EXCLUDE` に**入れるべきかは要判断**：
  「財宝を全部出す」だと Contraband が自動で出てしまい、**指名を食らってから他の財宝が出る**（＝公式の「先に出して手の内を隠す」戦術は取れるが、逆に「Contraband を出さない」選択ができない）。
  `cursed_gold`（出すと必ず呪い）ほど致命的ではないが、**「1枚買うつもりの属州を封じられる」＝実害は大きい**。
  → **`PLAY_ALL_EXCLUDE` に入れることを推奨**（呪われた金貨と同じ理由＝ボタン1つで事故る）。
  🛑 入れるなら **engine・CPU・UI を同一コミットで**（engine だけ締めると CPU が `PLAY_ALL_TREASURES` を返し続けて**本番 livelock**＝§0-28 の実績）。
- **`playAllOrder`**：入れない場合は rank を **`-2`（最優先）**にすると公式の推奨プレイ（先に出して総コインを隠す）に沿う。

## 5. 日本語カード名（参考）

> 禁制品 (pron. kinseihin)
> [$3] +1 購入／左隣のプレイヤーはカード1枚を指定する。このターン、あなたはそのカードを購入できない。

⚠ この行は実物と食い違うことがある（日本語wiki で裏取りが必要）。

---

# 5. Counting House（$5・アクション）

## 1. 英語カード文（現行の逐語）

> Look through your discard pile, reveal any number of Coppers from it, and put them into your hand.

**区切り線＝0本**。コスト以外の記号なし（+アクションも +コインも無い＝純粋なターミナル）。

## 2. 版（Versions）

機能エラッタは**無し**。

| 版 | 逐語 | 変更 |
|---|---|---|
| First edition（2010-10） | > Look through your discard pile, reveal any number of Copper cards from it, and put them into your hand. | — |
| **2016-10／2017-02（現行）** | > Look through your discard pile, reveal any number of Coppers from it, and put them into your hand. | > Shortened "Copper card" to "Copper". Increased font size. |

## 3. Official FAQ（逐語・全文）

> This card lets you look through your discard pile, something you normally are not allowed to do.
> You only get to look through your discard pile when you play this.
> You do not have to show the other players your entire discard pile, just the Coppers you take out.
> After you take out the Coppers, you can leave your discard pile in any order.

**Other rules clarifications 節も Deprecated 節も存在しない**（目次が 1.1 のみ）。

## 4. ⚠ 実装で危ないところ

- **最も軽い1枚**。新 state 不要・トリガー不要・アタックでない。
- **新 pending 1つ＝`counting_house`（0〜N 枚を選ぶ）**。**4点セット必須**。
  - **銅貨は全部同一なので「枚数ステッパー」で十分**＝`modalAmount`（帝国の峠 Mountain Pass／ギルドの過払い Overpay で使っている）を流用。
    `min=0, max=（捨て札の銅貨枚数）`。
  - 🛑 **0枚が合法**（"any number"）＝**「0枚で確定」できるボタンが必ず要る**。
    これを落とすと「捨て札に銅貨が5枚あるが手札を増やしたくない（民兵対策・手札上限の絡み）」局面で人間が意思に反する選択を強いられる。
  - 🛑 **捨て札に銅貨が0枚なら pending を立てない**（候補ゼロで窓を開かない定石）。
    ⚠ ただし**「捨て札を見る」だけは公式には起きている**が、見ても何も選べないので窓を開かない実装で問題ない。
  - CPU `decidePending`＝「全部取る」でほぼ常に最善（`{type:'COUNTING_HOUSE', amount: n}`）。**必ず非 null**。
- **`reveal(state, pi, coppers, '会計所で公開')` を通す**（公開の共通フック＝§0-22）。
  ⚠ **捨て札全体を公開しない**（"You do not have to show the other players your entire discard pile, just the Coppers you take out."）。
- **マスク（`maskStateFor`）の変更は不要**。本アプリは既に
  `discard: new Array(p.discard.length).fill('back')`（23385行）で**相手の捨て札を完全に伏せ**、
  自席（`i === seat`）には捨て札をそのまま見せている＝「自分の捨て札を見る」は最初から成立している。
  🛑 **`pending.cards` に捨て札の中身を載せる実装にしないこと**（載せると `maskStateFor` の私的看破リストに追加が必要になり、
  §0-21 偵察隊／§0-28 夜警／§0-29 A4 粉屋・歩哨 と**4回目の同型の漏洩**を作る。枚数だけ渡せば足りる）。
- **移動は「捨て札 → 手札」**＝**捨てるでも獲得でも廃棄でもない**。
  🛑 `triggerOnDiscard` を呼ばない／`triggerOnGain` を呼ばない／`gain()` を通さない。
  ただの `removeOne(p.discard,'copper')` × n → `p.hand.push('copper')` × n。
- **捨て札が空でも合法**（何も起きない）。「山札を捨て札にした直後」等でも同じ。
- **`allCards` / 保存則には無影響**（同じプレイヤーのゾーン間移動）。
- **強力なコンボが2つ公式に認知されている**＝**移動遊園地(Travelling Fair)**（獲得を山札の上へ→会計所を毎ターン手札に）と
  **夜警(Night Watchman)**。どちらも本アプリに実装済みなので、**CPUソークで自然に到達する**（`mix-all`）。
  ⚠ 会計所は**ターミナル**（+アクションなし）なので CPU の `chooseAction` 登録を忘れると一度も使われない（§0-37 の [medium]4 と同じ罠）。

## 5. 日本語カード名（参考）

> 会計所 (pron. kaikei-sho, lit. accounting office)
> 捨て札置き場のカードをすべて見て、その中の好きな枚数の銅貨を公開し、手札に加える。

⚠ この行は実物と食い違うことがある（日本語wiki で裏取りが必要）。

---

# 実装前に必読（この5枚に共通する罠）

1. 🛑 **この5枚はカタログに1枚も存在しない**。`DOM.POOLS.prosperity` は第二版25種。
   `BASE_REMOVED_1E` / `INTRIGUE_REMOVED_1E` ＋ `basic1e` / `intrigue1e` ＋ CARD_SET `random-1e`（`js/cards.js` 1730/1767/2013行）が**既存の前例インフラ**なので、
   `PROSPERITY_REMOVED_1E` ＋ `DOM.POOLS.prosperity1e` を同じ形で足し、`random-1e` の `randomFrom` に加える。
   ⚠ 段階1で止めるなら **`DOM.STAGE1_POOLS` に必ず入れる**（入れないと闇市場に死に札が $0 で並ぶ）。
   🛑 **ただし Trade Route だけは「闇市場デッキに入っているだけで準備が走る」**ので、段階1で塞いだままにしないと準備コードが半端に走る危険がある。
2. 🛑 **コスト比較は必ず3成分**。Talisman の「$4以下」は `boughtRef`（購入時にキャプチャ済みの `costOf`）で判定し、
   `cardCost(state,id) <= 4` の素の数値比較も `costUpTo` の**呼び直し**も両方誤り
   （前者はポーション費用/負債コストを拾い、後者は公式例「漁師×お守り」を壊す）。
3. 🛑 **山の上に置くトークンの READ は必ず `pileKeyOf(state, card)`**（826行）。
   Trade Route で忘れると分割山・混合山でトークンが孤児化する＝§0-20 徴税／§0-29 汚された神殿 と**3回目の同型事故**。
4. 🛑 **「山の種別」は randomizer の静的種別／「買うときのコスト」は一番上**（§0-29 A2b）。
   Trade Route の「勝利点の山か」は **`DOM.isType(pileKey,'victory')`**（`isTypeSupply` は禁止）。
   Talisman の「勝利点か」は逆に**買ったカードの実体**なので `isTypeSupply` を **`gain()` の前**に評価する。
5. 🛑 **「山からカードが抜けた」≠「獲得された」**。Trade Route のトークンは `triggerOnGain` にだけ書く。
   `trashFromSupplyPile`（塩まき）／`exileFromSupply`（ハツカネズミの習性・包領）では**動かない**のが公式。
   逆に**廃棄置き場からの獲得（`gainFromOutside`）では動く**。
6. 🛑 **on-trash / on-gain の対話を跨いでから数える**。
   Trade Route の +$ は `t.tradeRouteResume` で **`onTrashQueue` と `onGainQueue` が両方空になってから**数える
   （雛形＝旭日の金継ぎ `t.kintsugiResume`・12276／13573／18490行）。
   その場で数えると公式例（狩場を廃棄→公領獲得→+$1が増える）が再現できない＝**これが 2016 エラッタの本体**。
7. 🛑 **`t.coins += n` / `t.actions += n` を直接書かない**＝`addCoins(state,n)` / `addActions(t,n)`
   （カメレオンの習性・雪深い村）。`t.buys += 1` は既存の慣行どおり直書きでよい。
8. 🛑 **「捨てる」経路は `triggerOnDiscard` を呼ぶ**（Loan の「残りを捨てる」＝坑道が金貨を出す）。
   既存の `farming_village`（7212行）は呼んでいないので**コピー元にしない**。
9. 🛑 **購入禁止は `canBuyCard`（3339行）に1行**。ここが engine拒否・CPU非提案・UI無効化の3面共有点。
   **加えて `BLACK_MARKET_BUY`（16547行）にも同じチェックを足す**（この reducer は `canBuyCard` を呼ばず個別ガードを並べている）。
   逆に **`BUY_EVENT` / `BUY_PROJECT` には足さない**（イベント・プロジェクトはカードではない）。
10. 🛑 **新しい非カード state（`state.tradeRoutePiles` / `state.tradeRouteMat` / `t.contraband`）は
    保存則 tally・`allCards`・庭園/品評会・「カード名を宣言」から除外**し、**読むときは必ず旧スナップショット互換のガードを付ける**
    （サーバは state を無変換で復元する＝欠落すると部屋が固まる／§0-17 `pending.self` と同型）。
11. **財宝3枚（Loan / Talisman / Contraband）の効果は `applyTreasureEffect`（1324行）に書く**（`applyEffect` は財宝では呼ばれない）。
    Talisman だけは常設能力なので `BUY` 側（`maybeHagglerGains` の隣・14071行）に置く。
    **Loan と Contraband は pending を立てる財宝**＝`t.playAllResume`（§0-24）で自動再開される。
    **Contraband は `PLAY_ALL_EXCLUDE` に入れることを推奨**（入れるなら engine・CPU・UI を同一コミットで）。
12. **新 pending は合計4種**＝`loan_choose` / `trade_route_trash` / `contraband_name` / `counting_house`。
    すべて **engine reducer ＋ `PLAYER_ACTIONS` ＋ CPU `decidePending` ＋ UI `viewPendingModal`** の4点セット。
    - **辞退ボタンが要るのは `counting_house`（0枚が合法）だけ**。
    - **終端保証が要るのは `trade_route_trash`（手札0枚）**。ただし**手札0枚では窓を開かず、+$ だけは必ず出す**こと。
    - **`contraband_name` は pending の持ち主が手番プレイヤーではない**（左隣）＝同盟の射手(Archer) と同じ形。
13. **CPU `chooseAction` に `trade_route` と `counting_house` を登録する**（どちらもターミナル）。
    登録を忘れると**CPUソークがその経路を1度も検証しない**（§0-36／§0-37 が名指しした最頻の罠）。
14. **日本語カード名は5枚とも要裏取り**。とくに **Loan＝wiki は「借金」だがタスク指示は「借入金」で食い違っている**。
    残り4枚（交易路／護符／禁制品／会計所）は wiki とタスク指示が一致。


## 【この章の敵対検証（別エージェントが一次資料に当たり直したもの）】
⚠ **上の起草と食い違う場合はこちらが正**（起草より後に、同じページを取り直して照合している）。

検証完了。作業ツリーはクリーン（一時ファイル削除済み）。5枚とも英語wikiを自分で取り直し（`RAW_DIR` で生HTMLの `<hr>` を実数）、実装の罠は `js/engine.js` / `js/cpu.js` / `js/ui.js` を grep で裏取りしました。

---

# 総評

**一次資料の照合結果＝カード文・区切り線・版・FAQ の逐語は全5枚とも正確。捏造・取りこぼしゼロ。**
とくに Trade Route の「Trash before gaining +$」エラッタと Other rules clarifications 全文は完全一致で、起草の核心（エラッタの本体＝解決順）は正しい。

**訂正は「実装の罠」側に集中**＝確定12件（medium 3／low 6／nit 3）。

---

# A. 一次資料の照合＝訂正なし（確認できた項目）

| 項目 | 結果 |
|---|---|
| 5枚の英語カード文（逐語） | **完全一致** |
| 区切り線 `<hr>` の実数 | Loan **0**／Trade Route **1**／Talisman **1**／Contraband **0**（$3と+1Buyの間は `<br>`）／Counting House **0** ＝**全部一致** |
| Versions の行数 | Loan 3／TR **2**／Talisman **4**／Contraband 3／CH 2 ＝**全部一致** |
| TR の 2016 Changes | `Trash before gaining +$.` `Increased font size.` ＝**一致**（機能エラッタありの断定は正しい） |
| Official FAQ 全文 | 5枚とも**逐語一致** |
| TR / Talisman の Other rules clarifications | **全文一致・節の取りこぼしなし**（`<sup>` 脚注 0個も確認） |
| Loan / Contraband / Counting House に Other rules clarifications 節が無い | **TOC で確認＝正しい**（CH は Deprecated 節も無い） |
| 日本語名 借金／交易路／護符／禁制品／会計所 | wiki の記載と一致 |

---

# B. 確定した訂正

## ① [medium] Loan — `revealFromDeck` は「2度目のシャッフル禁止」を守っていない

- **① 起草の記述**：「`revealFromDeck`（5121行）が**そのまま使える**」「公式の『revealed cards は混ぜない』を既に満たしている」「**自前で `p.deck.shift()` ループを書かないこと**」
- **② 一次資料**：
  - `Loan` Official FAQ 逐語＝`If you run out of cards before revealing a Treasure, shuffle your discard pile (but not the revealed cards) to get more; if you still do not find a Treasure, just discard all of the revealed cards.`（**シャッフルは1回**）
  - `js/engine.js` 1917-1920 のコメント逐語＝`When you need to shuffle to access more cards from your deck, you only shuffle one time, even if Order of Masons put some cards back in your discard pile.` ＝**呼び出し側が戻り値を見て2回目を打ち切る契約**
- **③ 正しい記述**：`revealFromDeck` は「revealed を混ぜない」は満たすが、**`reshuffleDeck` の戻り値（`masonsLeft`）を無視している**。メイソン団／回避が捨て札に札を残すと、ループ内で `p.discard.length > 0` が再び真になり **同じ Loan の解決中に2度目のシャッフルが起きる**。Loan を足すならこの契約を `revealFromDeck` にも通すこと（`draw()` と同じ形）。
  ⚠ これは**既存の潜在バグ**でもある（`farming_village` 7214／`fortune_teller` 5152／12261 も同じ穴）。mix-all 限定＝[medium]。

## ② [medium] Trade Route — 神風(Divine Wind)への配線が丸ごと抜けている

- **① 起草の記述**：`applyDivineWind` への言及ゼロ。
- **② 一次資料**：Rising Sun ルールブック逐語（`js/engine.js` 264行に既に引用済み）＝**`Tokens on the removed piles are no longer on them.`**
- **③ 正しい記述**：`applyDivineWind` の `killKeys.forEach`（289-296行）は既に `pileVP` / `pileDebt` / `pileFavor` を `delete` している。**`state.tradeRoutePiles` にも同じ1行が要る**。放置すると (a) 公式逐語違反、(b) 撤去後に**同名の山が再び配られたとき「無いはずのトークン」が動く**。
  ⚠ PROGRESS §0-38 の「神風に新しい派生セットアップを足すときは `applyDivineWind` の⑤にも足す」がまさにこれ。
  なお「新しい10山に Trade Route のトークンを置くか」は **置かないのが逐語どおり**（`Do any Setup for them that they require` ＝新カード側が要求する Setup のみ／Trade Route 自身も撤去される）。

## ③ [medium] Trade Route — トークン移動は `_gainDepth > 6` ガードより**前**に置く

- **① 起草の記述**：「トークンの移動フック＝`triggerOnGain` に1箇所」（位置指定なし・雛形として徴税ブロックを提示）
- **② 一次資料**：`js/engine.js` 10134-10135＝`state._gainDepth = (state._gainDepth||0)+1; if (state._gainDepth > 6) { state._gainDepth--; return; }`。すぐ上の金継ぎのコメント逐語＝**「ただの記録なので連鎖の暴走防止ガードより『前』（7段以上ネストした獲得で得た金貨も数える）」**
- **③ 正しい記述**：徴税ブロック（10188行）は**ガードの後**にある。Trade Route のトークン移動も「ただの記録」なので、**`gainedGoldThisGame`（10134行）と同じ位置＝ガードの前**に置く。徴税をコピーすると7段以上の連鎖獲得（旭日の成長 Growth 等）でトークンが黙って落ちる。

## ④ [low] Trade Route — 準備コードの配置と「段階1で危険」という記述が逆

- **① 起草の記述**：「🛑 ただし Trade Route だけは『闇市場デッキに入っているだけで準備が走る』ので、**段階1で塞いだままにしないと準備コードが半端に走る危険がある**」
- **② 一次資料**：`js/engine.js` 2266-2273＝`const stage1 = new Set(...(DOM.STAGE1_POOLS||[])...)` → `blackMarket = shuffle(universe.filter(... && !stage1.has(id)))`
- **③ 正しい記述**：**`STAGE1_POOLS` に入っている間は闇市場デッキに絶対に入らない**＝段階1では危険は無い（逆）。危険なのは**昇格後**。
  加えて**配置順の制約**が抜けている：`blackMarket` は 2258/2273行で作られ、`pileDebt` の準備は 2314行。Victory トークンのループは**2273行より後**に置くこと。

## ⑤ [low] Talisman — 混合山のチェックが「山キー vs 実カード」を取り違えている

- **① 起草の記述**：「**`mixedTopCard(state, pileKey) === 買ったカード` を確認してから獲得する**（1行）」
- **② 一次資料**：`Talisman` Official FAQ 逐語＝`If there are no copies left, you do not gain one.`／`js/engine.js` 14036 `gain(state, pi, card, 'discard')` の `card` は `action.card`＝**山キー**（`'knights'` / `'townsfolk'`）。`mixedTopCard(state,'knights')` は**実カードid**（`'sir_martin'`）を返す（75-77行）。
- **③ 正しい記述**：比較対象が定義できない。`gain()` の**前**に `const realBought = mixedTopCard(state, card) || card;` を捕まえ、**後**に `mixedTopCard(state, card) === realBought` を確認する。
  ⚠ **実害あり**：`cardCost(state,'knights')` は一番上の実コストを返す（1519-1521行）＝**サー・マーティンだけ $4** なので、彼が一番上のとき買うと Talisman が「次の騎士（別人）」を獲得する。騎士は各1枚＝公式は獲得しない。**mix-all（暗黒時代＋繁栄1E）で到達**。

## ⑥ [low] Talisman — 2020年の "While you have this in play" は機能変更ではない

- **① 起草の記述**：「2020エラッタの "While **you have** this in play" は**持続で場に残っている間も含む**という意味なので、厳密には `inPlay` ＋ `durationCards` を見るのが正しい」
- **② 一次資料**：`Talisman` Versions の Changes 逐語＝`Rephrased "While this is in play" to "While you have this in play".`（2020 Errata の文言整理。機能差の記述は無い）
- **③ 正しい記述**：**文言整理であって機能変更ではない**。実装は `inPlay` のみで足りる（Talisman は持続ではないので `durationCards` に入る経路が無い）。既存の `haggler`（11025行）と同じ数え方で正しい。

## ⑦ [low] Contraband — 「サプライ外を指名できる」を許容簡略化にする**理由**が誤り

- **① 起草の記述**：「**サプライ外のカードは元々購入できない**ので、指名しても効果はゼロ」
- **② 一次資料**：`Contraband` Official FAQ 逐語＝`They do not have to name a card in the Supply.`／`js/engine.js` 16547 `BLACK_MARKET_BUY`＝**闇市場はサプライ外のカードを購入する**
- **③ 正しい記述**：理由が事実に反する。正しくは「**闇市場はアクションフェイズに解決し、Contraband（財宝）は購入フェイズに使うので順序上ほぼ当たらない**（ヴィラ／継続でアクションフェイズに戻れば理論上は当たる）」。しかも起草自身が `BLACK_MARKET_BUY` にもチェックを足せと書いており内部矛盾している。

## ⑧ [low] Loan / Contraband — 提案している `playAllOrder` の rank が既存と衝突する

- **① 起草の記述**：Loan は「必要なら `-1`（銀貨と同じ）」／Contraband は「rank を **`-2`（最優先）**にすると…」
- **② 一次資料**：`js/engine.js` 1136-1138＝`(c) => (PLAY_TWICE_TREASURES[c] ? -2 : c === 'figurine' ? -2 : c === 'silver' ? -1 : ...)`／同 1132-1135 のコメント逐語＝**「🛑 ペンダントと同じ rank にしてはいけない（`sort` は同順位を入れ替えないので手札の並び順で前後が決まり、取りこぼす）」**
- **③ 正しい記述**：**`-1` は銀貨、`-2` は `PLAY_TWICE_TREASURES` と `figurine` が既に使っている**＝§0-37 が名指しした「米とペンダントを同じ rank にするな」の罠そのもの。新しい rank 値（例 `-3` / `-1.5`）を使うこと。

## ⑨ [low] Contraband — `PLAY_ALL_EXCLUDE` は CPU 側にリテラルで二重化されている＋除外は「推奨」ではなく要判断

- **① 起草の記述**：「**`PLAY_ALL_EXCLUDE` に入れることを推奨**（呪われた金貨と同じ理由）」「入れるなら engine・CPU・UI を同一コミットで」
- **② 一次資料**：`js/cpu.js` 4200＝`const PLAY_ALL_SKIP = ['cursed_gold', 'crucible', 'pickaxe'];`（**engine の Set を参照せずリテラル**）／4203-4208＝除外札ごとに **「1枚ずつ `PLAY_TREASURE` で出す」フォールバック分岐**が個別に書かれている
- **③ 正しい記述**：
  - CPU 側は **配列（4200行）とフォールバック分岐（4203-4208行）の2箇所**が要る。配列だけ足すと **CPU が Contraband を永久に使わない**（$3＋1購入＝金貨相当を捨てる。livelock にはならないが明確に弱くなる）。
  - **除外の是非に公式根拠は無い**。呪われた金貨（必ず呪い獲得）・坩堝/つるはし（廃棄が**強制**）と違い、Contraband の代償は相手の指名だけ。**「推奨」ではなく「要判断」と書くべき**（`playAllOrder` で最優先にする案と排他）。

## ⑩ [low] Loan — 「パトロンは Loan では発動しない」は言い過ぎ

- **① 起草の記述**：「パトロン Patron の +1財源は**アクションフェイズ限定なので Loan では発動しない**」
- **② 一次資料**：`Patron` カード文逐語＝`When something causes you to reveal this (using the word "reveal") in an Action phase, +1 Coffers.`／本アプリの `reveal()`（2520行）も `state.turn.phase === 'action'` ゲート
- **③ 正しい記述**：通常の購入フェイズの Loan では確かに発動しないが、**語り部(Storyteller)** はアクションフェイズに財宝を使わせる（本アプリ実装済み＝§0-9 Batch6）ので、その経路では発動する。結論（必ず `reveal()` を通す）は変わらない。

## ⑪ [nit] Counting House — もっと近い前例がある（サイロ）

起草は `modalAmount` の前例として峠／過払いを挙げるが、**サイロ(silos・ルネサンスのプロジェクト)** が「好きな枚数の**銅貨**を**公開**して捨てる」＝ほぼ同型で、そのまま写せる：

| 面 | 場所 |
|---|---|
| engine reducer | `js/engine.js` 19222-19238（`action.count` 受理／`want > have` で拒否／`reveal(...)`／0枚許容） |
| UI | `js/ui.js` 4312（`modalAmount(..., coppers, 0, ...)`） |
| CPU | `js/cpu.js` 3684 |

⚠ ただし **サイロは候補ゼロでも窓を開く**（`js/engine.js` 9207＝無条件に `startQueue` へ push）。起草の「銅貨0枚なら窓を開かない」は既存前例と**逆**＝どちらでもよいが方針を決めて書くこと。

## ⑫ [nit] Trade Route — Deprecated FAQ の引用が「順序が逆だった」証拠2行を落としている

落ちている逐語（`Trade_Route` > Deprecated official FAQ (2010)）：

> You get an additional Buy to use in your Buy phase.
> **You get +[$1] per token on the Trade Route mat.**
> **Then you trash a card from your hand.**
> Put a coin token on each Victory card pile at the start of the game.
> When a card is gained from a Victory card pile, move its token onto the Trade Route mat.
> If you are using Black Market and Trade Route is in the Black Market deck, put tokens on Victory card piles at the start of the game.

太字の2行が**2016エラッタ前の解決順（+$が先・廃棄が後）そのもの**＝起草の主張「エラッタの本体は順序」の一次証拠。引用しておくと次の実装者が旧版へ戻す事故を防げる。

---

# C. 足りていない項目（起草に無いが実装で必要）

1. **Trade Route × 交換(exchange)**：取り替え子／吸血鬼↔コウモリは獲得でも廃棄でもないが `supply` が増減する（`js/engine.js` 11406-11416＝`triggerOnGain` を呼ばない）。**自動的に正しい**が、起草の「山からカードが抜けたが獲得ではない」リスト（塩まき・追放）に足すべき。
2. **Trade Route × 山が「復活」する経路**：無謀な(Reckless) の `returnToPile`／大使(Ambassador)。**トークンは戻らない**（Deprecated FAQ 逐語＝`It does not matter if cards have been returned to a pile, such as with Ambassador ...; Trade Route only cares if a card was ever gained from the pile this game.`）＝`triggerOnGain` にだけ書けば自動で満たされる。この逐語を明記しておくこと。
3. **Trade Route の準備述語は既存の `plainActionPile` が完璧な雛形**（`js/engine.js` 2296-2297＝汚された神殿／オベリスク）。同関数は `castles`/`knights`/`ruins` を**明示除外**しているが、Trade Route は公式が **`However Castles are a Victory Card pile.`** と名指ししているので **`castles` を除外してはいけない**＝`DOM.isType(id,'victory') && !NON_SUPPLY.has(id) && !SPLIT_TOP[id]` でちょうど公式と1対1になる（`knights` は `types:['action','attack','knight']`＝自然に落ちる／`ruins` は `supply` にキーが無い）。
4. **Counting House は本アプリでは固有価値の一部が既に失われている**：`maskStateFor` は `i !== seat` のときだけ捨て札を伏せる（`js/engine.js` 23385）＝**自分の捨て札は常に全部見えている**。公式は自分の捨て札も一番上以外は見られないので、「look through your discard pile」の情報価値はゼロ。**PROGRESS に許容簡略化として1行残す**こと（起草は「マスク変更不要」としか書いていない）。
5. **Talisman × Haggler の解決順**：公式は同時に誘発したら順番を選べる。本アプリは固定順（既存の横断簡略化）＝1行記録。
6. **Trade Route の +$ 再開網は `runReplays` を必ず呼ぶ**：起草のコード断片には入っているが、金継ぎ（`js/engine.js` 13575-13586）と同じく **`state = runReplays(state)` で締める**ことを明示しないと、玉座/王の宮廷で2回目の Trade Route が積まれたまま止まる。
7. **`state.tradeRoutePiles` / `tradeRouteMat` はサーバの `isNoConsentUndoableBuy` に足す必要は無い**（`server/gameServer.js` 191-224 を確認）：公開情報かつ情報が増えないので、勝利点カードの購入は従来どおり同意なしで戻せる。**逆に「新しい非プレイヤー state を足したら比較する」を機械的に適用すると、勝利点を買うたびに承認制へ落ちて UX だけ悪化する**（§0-19 の「城と同盟の分割山は全公開なので比較しない」と同じ判断）。

---

# D. 日本語カード名について

**5枚とも Print / Digital 列が空**＝カードのスキャン画像が無く、wiki の日本語名は**テキストのみ・裏取り不能**。とくに **Loan は wiki が「借金」／タスク指示は「借入金」で食い違っている**（起草はこれを正しく指摘済み）。
⚠ 加えて、ホビージャパン日本語版の **繁栄は第二版（2023年）で出ている**ため、**第一版限定のこの5枚は現行の日本語版が存在しない可能性がある**（初版の日本語版に載っていた名前が正本になる）。**日本語wiki で5枚とも要裏取り**。


---

# 第4章　繁栄 第1版 B ― 山師(Mountebank)／玉璽(Royal Seal)／投機(Venture)／暴徒(Goons)

`_m19_raw` は削除済み、`git status` クリーン（リポジトリは1バイトも変更していません）。

---

# 繁栄(Prosperity) 第1版専用カード 4枚 — 公式ルール確定

一次資料＝英語wiki（`tools/wikidirect.js` で逐次取得、区切り線は生HTMLの `<hr>` を数えて確定）。補助として `Possession` / `Black_Market` / `Way` / `Merchant_Guild` の各ページも参照した。

---

## 1. Mountebank（$5・アクション-アタック）

### 1-1. 英語カード文（現行の逐語）

> \+ $2
> Each other player may discard a Curse. If they don't, they gain a Curse and a Copper.

**区切り線＝0本**（生HTMLの Card text 欄に `<hr>` なし）。

### 1-2. 版(Versions)

**機能エラッタは無し**（文言変更のみ3版）。

| 版 | Text | Changes | Announced / Printed |
|---|---|---|---|
| First edition | > +$2 / Each other player may discard a Curse. If **he** doesn't, **he gains** a Curse and a Copper. | — | Oct 2010 |
| 2nd | > +$2 / Each other player may discard a Curse. If **they** don't, **they gain** a Curse and a Copper. | Use gender neutral pronouns. Increased font size. | Oct 2016 / Feb 2017 |
| 3rd（現行） | 同上 | Formatting changes only. | May 2019 |

Prosperity 2E で **removed**（Charlatan に置換）。

### 1-3. Official FAQ / Other rules clarifications（逐語）

**Official FAQ**
> This hits the other players in turn order, which can matter when the Curse or Copper piles are low.
> Each of the other players in turn chooses whether or not to discard a Curse card, and the players who do not gain a Curse and a Copper from the Supply, putting them into their discard piles.
> If either the Curse or Copper pile is empty, players still gain the other card.

**Other rules clarifications**
> A player hit by Mountebank gains the Curse first, and then the Copper.

**Deprecated official FAQ (2010)** ← ⚠ 現行FAQから削除されたが実装上重要な裁定が2件ある（§0-31 の「2025年9月に脚注付き裁定がまとめて削除された」問題そのもの）
> This hits the other players in turn order when that matters (such as when the Curse or Copper pile is low).
> Each of the other players in turn chooses whether or not to discard a Curse card from his hand, and if he does not, gains a Curse and a Copper from the Supply, putting them into his discard pile.
> If either the Curse or Copper pile is empty, he still gains the other one.
> **If both are empty, he does not gain either, but can still discard a Curse if he wants to.**
> **A player using Moat (from Dominion) on this may not discard a Curse, and doesn't gain a Curse or Copper - you cannot Moat just part of the attack.**
> A player using Watchtower on this can use it just to trash the Curse, just to trash the Copper, or to trash both.

### 1-4. ⚠ 実装で危ないところ

**同型の前例＝`old_witch`（ルネサンス 老魔女）が最も近い**（被害者ごとに「呪い」がらみの選択を1つ挟む2段アタック）。`torturer`（embedded・被害者が二択）も形は近いが、Mountebank は「手札に呪いが無ければ選択肢が存在しない」ので `old_witch` 型（react ステージ＋条件付き choice pending）が正しい。

- **新 pending 2種**＝`mountebank`(stage:`react`) と `mountebank`（choice）。4点セット必須
  （engine reducer `MOUNTEBANK_REACT` / `MOUNTEBANK_RESOLVE` ＋ `PLAYER_ACTIONS` ＋ CPU `decidePending` ＋ UI `viewPendingModal`）。
- **`ATTACKS` に1行**＝`mountebank: { onMoat: (s, pd) => mountebankEnterVictim(s, pd.source, pd.queue) }`。
- 🛑 **「呪いを捨てる」は堀の代わりではない**。公式逐語＝`you cannot Moat just part of the attack`＝
  **堀を公開した／灯台・チャンピオンで免疫の被害者は「捨てる選択」ごと丸ごと飛ばす**。
  `attackImmune` でフィルタ → `hasReaction` なら react ステージ、という既存の並び（`oldWitchEnterVictim` 参照）をそのまま使えば自動的に正しくなる。**捨てる窓を免疫判定より前に置くと公式違反。**
- 🛑 **獲得順は「呪い → 銅貨」**（Other rules clarifications が名指し）。`gain(state, victim, 'curse', 'discard')` → `gain(state, victim, 'copper', 'discard')` の順に書く。片方の山が空でももう片方は獲得する（`gain` が false を返すだけなので自然に正しい）。
- ⚠ **両方の山が空でも「呪いを捨てる」窓は開く**（deprecated FAQ）。ただし本アプリの定石「候補ゼロなら窓を開かない」は
  **手札に呪いが無いとき**にだけ適用する（選択肢が本当に存在しないので）。**山が空だからといって窓を閉じてはいけない。**
  実利は無いように見えるが、山が空かどうかは対局中に変わるので条件を混ぜると壊れやすい。
- **CPU `decidePending` は絶対に null を返さない**（`{type:'MOUNTEBANK_RESOLVE', choice:'discard'|'take'}`）。react 段は既存の `immuneReveal(p)`（堀/盾）を先に返す共通形に乗せる。定石＝**手札に呪いがあれば捨てる**（wiki Strategy も「呪いが手札にあれば捨てるのがほぼ常に正しい」）。
- **UI は必ず2ボタン**（「呪いを捨てる」「呪いと銅貨を受ける」）。呪いが手札に無ければそもそも窓を開かない＝人間が詰まない。
- **3山終了**＝呪いと銅貨の**2山**を枯らしうる。`emptyPileCount` は自動で効くが、CPU の `buyEndsGame`（`DOM.engine.emptyPileCount` 経由）も自動追随する。
- **被害者の Watchtower / 交易商人 は開かない**（既存の横断簡略化）。本アプリの獲得時対話は
  `pIndex === state.turn.active && _gainDepth === 1 && !state.pending` でゲートされており、Mountebank の被害者は手番プレイヤーでない。
  ⚠ **これは魔女・老魔女・ペテン師とまったく同じ既存挙動**なので、Mountebank のためだけに直そうとしないこと（直すなら横断改修）。**deprecated FAQ が Watchtower を名指ししている**ので、PROGRESS に「許容簡略化」として1行残すこと。
- **支配(Possession)**＝被害者への呪い/銅貨の獲得は普通に被害者が受ける（`gain` の支配分岐は `pIndex === t.active` のときだけ働くので自動的に正しい）。
- **コスト比較は一切不要**（固定カード指定）＝`costUpTo` 等は使わない。
- **CPU `chooseAction`／`GAIN_ORDER`**＝ターミナルシルバー級だが実力は最上位クラス（wiki＝`one of the strongest cards in the game`）。`GAIN_ORDER` は $5 帯の上位（witch 近辺）に置く。

### 1-5. 日本語カード名

英語wiki `Other language versions` の Japanese 行：
> 香具師 (pron. *yashi*, lit. *charlatan*)
> ＋$2 他のプレイヤーは全員、呪い1枚を捨て札にしてもよく、捨て札にしなかった場合、呪い1枚と銅貨1枚を獲得する。

⚠ **この行は実物と食い違うことがある**（§0-31 で確認済みの既知問題）。**日本語wiki での裏取りが必要**。
🛑 **本タスクの依頼文は「山師」と書いているが、英語wiki は「香具師」**＝**2者が食い違っている**。
また Japanese 行に**印刷版カード画像へのリンクが無い**（`File:...Japanese...` が0件）＝この訳文は**Dominion Online 訳の可能性が高く、ホビージャパン印刷版の逐語ではない**。日本語wiki の個別カードページで必ず確認すること。

---

## 2. Royal Seal（$5・財宝）

### 2-1. 英語カード文（現行の逐語）

> $2
> ————
> While you have this in play, when you gain a card, you may put that card onto your deck.

**区切り線＝1本**（生HTMLで `<hr>` を1つ確認。`$2` の直後）。

### 2-2. 版(Versions)

**機能エラッタは無し**（言い回しのみ）。

| 版 | Text | Changes | Announced / Printed |
|---|---|---|---|
| First edition | > $2 / **While this is in play**, when you gain a card, you may put that card **on top of** your deck. | — | Oct 2010 |
| 2nd | > $2 / While this is in play, when you gain a card, you may put that card **onto** your deck. | Rephrased "on top of" to "onto". Increased font size. | Oct 2016 / Feb 2017 |
| 3rd（現行） | > $2 / **While you have this in play**, when you gain a card, you may put that card onto your deck. | Rephrased "While this is in play" to "While you have this in play". | Oct 2020 |

Prosperity 2E で **removed**（Tiara に置換）。

### 2-3. Official FAQ / Other rules clarifications（逐語）

**Official FAQ**
> If you gain multiple cards with this in play, this applies to each of them - you could put any or all of them on top of your deck.
> This applies both to cards gained due to being bought, and to cards gained other ways with Royal Seal in play, such as with Hoard.

**Other rules clarifications**
> If Royal Seal is no longer in play when you gain a card, such as because it was trashed with Mint or top-decked with Mandarin, you cannot use its ability.

**Deprecated official FAQ (2010)**
> This is a Treasure worth $2, like Silver.
> If you gain multiple cards with this in play, this applies to each of them - you could put any or all of them on top of your deck.
> **If you use this ability and there are no cards left in your deck, you do not shuffle; the card you gained becomes the only card in your deck.**
> Royal Seal applies to all cards you gain while it is in play, whether bought or gained other ways.
> **If you play Possession, and during the extra turn you have the possessed player play Royal Seal, he cannot put the card on his deck - he is not gaining the card, you are.**

### 2-4. ⚠ 実装で危ないところ

**新 pending は不要**。既存の **`travelling_fair` pending をそのまま共有できる**（移動遊園地／追跡者／勲章／小像が既に共有している窓。`source` でログのラベルだけ切り替える形が確立済み）。
＝**engine に push 1箇所＋ログ文字列だけ**で、CPU `decidePending` と UI `viewPendingModal` は**改修ゼロ**。

🛑 **`tiara` と同じ「else-if 連鎖」に足してはいけない。`onGainQueue` に積む**。理由：

| 置き場所 | 挙動 |
|---|---|
| `triggerOnGain` の望楼/ティアラ **else-if 連鎖** | `_gainDepth === 1 && !state.pending` でゲート＝**1獲得につき対話は1つだけ**。公式FAQ の `If you gain multiple cards with this in play, this applies to each of them` を満たさない（入れ子の獲得・1効果で複数枚獲得で黙って落ちる） |
| **`onGainQueue`（`travelling_fair`）** | 獲得のたびに毎回積まれる＝**公式FAQ どおり**。既に勲章・追跡者がこの形で公式FAQ の同じ逐語を満たしている |

推奨コード位置＝`triggerOnGain` 内の勲章(`t.insignia`)ブロックの真横：

```
if (state.turn && pIndex === state.turn.active && dest !== 'deck' &&
    state.players[pIndex].inPlay.includes('royal_seal')) {
  (state.onGainQueue = state.onGainQueue || []).push(
    { type: 'travelling_fair', player: pIndex, card: cardId, dest: dest || 'discard', source: 'royal_seal' });
}
```

- 🛑 **判定は「場にあるか」（`inPlay.includes`）＝ターン旗ではない**。公式は
  `While you have this in play`／`If Royal Seal is no longer in play ... you cannot use its ability`。
  **ティアラ(Tiara)は逆に「このターン」型**（`When you gain a card this turn`＝場を離れても効き続ける）。
  ⚠ **本アプリの `tiara` は現在 `me.inPlay.includes('tiara')` で実装されており、これは Royal Seal の規則であってティアラの規則ではない**
  （カタログ文 `このターン、カードを獲得したとき山札の上に置いてよい。` とも食い違う）。Royal Seal を足すついでに
  **ティアラ側を「このターン」型（`t.tiaraTurn` 相当）に直すか、少なくとも PROGRESS に既知差分として記録すること**。
  この2枚を「同じ挙動」と思って共通化すると、両方まとめて間違える。
- **判定の時点＝獲得が起きた瞬間**（push 時）。`travelling_fair` reducer 側で `royal_seal` の在場を**再確認しない**こと
  （獲得から窓の解決までの間に連鎖で Royal Seal が場を離れると、公式より厳しく否定してしまう）。
- **支配(Possession)＝自動的に正しくなる**。公式逐語 `he cannot put the card on his deck - he is not gaining the card, you are.`
  本アプリの `gain()` は支配中 `triggerOnGain(state, t.possessedBy, ...)` に振り分けるので `pIndex = possessedBy ≠ t.active` となり、
  上のガード `pIndex === state.turn.active` で窓が開かない。**この分岐を「支配者にも開く」方向に緩めてはいけない。**
- **獲得先が捨て札以外でも動かせる**（獲得置換＝ヴィラで手札に来た札も山札の上へ）。既存の `TRAVELLING_FAIR_TOPDECK` は
  `zoneOf(p, dest) → discard → hand` の順に探して見つからなければ黙って不発（stop-moving）＝そのままで正しい。
- **`dest !== 'deck'` ガードを付ける**（既に山札の上に置かれた獲得で無意味な窓を開かない）。
- ⚠ **望楼(Watchtower) と同時に持つと窓が2つ出る**（望楼＝else-if 連鎖、Royal Seal＝キュー）。公式は「置換効果はどちらか一方」だが、
  reducer が lose-track で不発になるので**壊れはしない**（勲章×望楼で既に同じ状態）。**許容簡略化として PROGRESS に1行**。
- ⚠ **山札が空でも「山札の上に置く」でシャッフルは起きない**（deprecated FAQ）＝`p.deck.unshift(card)` だけ。既存 reducer はそうなっている。
- 🛑 **追いはぎ(Highwayman)で「何もしない」ことにされた Royal Seal でも、山札の上に置く能力は働く**。
  区切り線の下＝使用時の記載効果ではないため（`Way` ページの一般則＝`Text below a dividing line is unaffected` と同じ理屈。
  追いはぎの逐語も `just prevents on-play instructions on the card from being carried out`）。
  本アプリでは `playTreasureCard` が `highwaymanBlocks` で早期 return しても、この能力は `triggerOnGain` 側の在場判定なので
  **偶然そのまま正しい**。「効果を `applyTreasureEffect` に書いていないのは書き忘れでは？」と後から“直さない”こと。
- **`coin: 2` をカタログに入れる**（財宝の共通処理が使う）。効果関数は不要（`applyTreasureEffect` に case を書かない）。
- **CPU**＝弱いカード（wiki Strategy＝`rarely worth gaining`）。`GAIN_ORDER` は銀貨より少し上程度の低い位置に置く。
  `decidePending` は `travelling_fair` の既存分岐がそのまま使われる。

**カタログ文案**（既存の言い回しに正規化）：
```
コイン +2
————
これが場にある間、カード1枚を獲得したとき、それを山札の上に置いてよい。
```

### 2-5. 日本語カード名

> 玉璽 (pron. *gyokuji*)
> $2 これが場にある間、カード1枚を獲得するとき、それを山札の上に置いてもよい。

⚠ **この行は実物と食い違うことがある**（依頼文の「玉璽」とは一致）。**印刷版カード画像へのリンクは無い**ので、日本語wiki での裏取りが必要。

---

## 3. Venture（$5・財宝）

### 3-1. 英語カード文（現行の逐語）

> $1
> Reveal cards from your deck until you reveal a Treasure. Discard the other cards. Play that Treasure.

**区切り線＝0本**。

### 3-2. 版(Versions)

**機能エラッタは無し**（2020年に "When you play this," を財宝から一律削除しただけ＝機能差ゼロ）。

| 版 | Text | Changes | Announced / Printed |
|---|---|---|---|
| First edition | > $1 / **When you play this, reveal** cards from your deck until you reveal a Treasure. Discard the other cards. Play that Treasure. | — | Oct 2010 |
| 2nd | 同上 | Increased font size. | Oct 2016 / Feb 2017 |
| 3rd（現行） | > $1 / Reveal cards from your deck until you reveal a Treasure. Discard the other cards. Play that Treasure. | Removed "When you play this" from Treasures. | Oct 2020 |

Prosperity 2E で **removed**（Crystal Ball に置換）。

### 3-3. Official FAQ（逐語）

※このカードには `Other rules clarifications` 節が**無い**。

**Official FAQ**
> When you play Venture, you reveal cards from your deck until revealing a Treasure card.
> If you run out of cards before revealing a Treasure, shuffle your discard pile (but not the revealed cards) to get more; if you still don't find a Treasure, just discard all of the revealed cards.
> If you do find a Treasure, discard the other cards and play the Treasure.
> If that Treasure does something when played, do that something.
> For example if Venture finds you another Venture, you reveal cards again.

**Deprecated official FAQ (2010)**（上に加えて1行）
> This is a Treasure card worth $1, like Copper.
> …（同文）…
> **Remember that you choose what order to play Treasure cards; for example if you have both Venture and Loan in hand, you can play either one first.**

### 3-4. ⚠ 実装で危ないところ

**同型の前例＝`farming_village`（収穫祭 農村）＝`revealFromDeck` ＋ `crystal_ball`（繁栄2E 水晶玉）の「山札の札を財宝として使う」経路**。この2つを合成するだけで書ける。

- 🛑 **効果は `applyTreasureEffect` に書く**（`applyEffect` は財宝では呼ばれない＝§0-25 で実際に踏んだ罠）。`coin: 1` はカタログ側。
- **公開ループは既存ヘルパ `revealFromDeck(state, pi, pred)` をそのまま使う**。この関数は
  「山札が尽きたら捨て札をシャッフル、**ただし公開済みの札は既に `shift()` 済みなので混ざらない**」＝
  公式逐語 `shuffle your discard pile (but not the revealed cards)` を**そのまま満たしている**。自前ループを書かないこと。
- 🛑 **述語は `isTreasureFor(state, c)`（動的）。`DOM.isType(c,'treasure')`（静的）は禁止**。
  資本主義(Capitalism)／悟り(Enlightenment)で財宝になったアクションも「財宝」として見つかり、使用される。
  既存の `farming_village` も `isTreasureFor` を使っている。
- **見つけた財宝の使用は `p.hand.push(matched); playTreasureCard(state, pi, matched);`**（`crystal_ball` の確立パターン）。
  `playTreasureCard` を通すことで **銀行(bank)/賢者の石の動的コイン・ポーショントークン・ペテン師のアタック・
  商人の「最初の銀貨」・サウナの `t.saunaPlays`・山トークン・追いはぎ・`noteTreasurePlayedForProphecy`（豊作/狼狽）・
  `noteAllyPlay`・資本主義で財宝になったアクションの `applyEffect` 分岐** が全部自動で正しくなる。
  **自前で `coin` を足すだけの実装は必ず壊れる**（§0-15 の `treasureReplayCoins` の轍）。
- ⚠ **`playTreasureCard` は内部で `notePlayFromHand` を呼ぶ**＝Venture が使わせた財宝が
  **航海(Voyage)の「手札から3枚まで」に誤って数えられる**（公式では手札からのプレイではない）。
  **既存の `crystal_ball` も同じ穴を持っている**ので、Venture 単体で直すか横断で直すかを決めること。
  同種の前例＝`playCardNoAction` の第7引数 `asHand`（§0-35）＝`playTreasureCard` にも同じ抜け道が要る。
- 🛑 **捨てる札は `triggerOnDiscard(state, pi, skipped)` を通す**（坑道(Tunnel)が金貨を出す／小道・織工・村有緑地・忠犬）。
  ⚠ **既存の `farming_village` はこれを呼んでいない**（`skipped.forEach(c => p.discard.push(c))` だけ）＝
  §0-31 の実バグ⑥（民兵が `triggerOnDiscard` を呼んでいなかった）と同じクラスの取りこぼしが残っている。**コピー元にしないこと。**
- 🛑 **順序＝「捨てる → その捨て札トリガーを解決 → その後に財宝を使用」**（公式FAQ の文順）。
  ⚠ **捨て札トリガーが `state.pending` を立てうる**（織工＝`weaver`）。立ったまま `playTreasureCard` を呼ぶと、
  その財宝が開く窓が織工の窓を上書きして**リソースが湧く／窓が消える**。
  → **`t.ventureResume` 型の再開網**（既存の前例＝`t.storytellerResume`（語り部）／`t.fhResume`（一等航海士のスタック）／
  `t.playAllResume`）を用意して、pending が解決してから財宝を使用する形にすること。
  簡略化する場合は PROGRESS に明記（村有緑地・忠犬はキュー行きなので実害があるのは織工のみ）。
- **入れ子（Venture が Venture を見つける）は公式**。`revealFromDeck` の guard(300) とデッキの有限性で自然に終端する。
  ただし上の再開網を作るなら**スタック（配列）で持つこと**＝§0-30 P6 の一等航海士で「単一オブジェクトにしたら外側が消える」[high] を実際に踏んでいる。
- **見つからなかった場合＝全部捨てて終わり**（`+$1` は出る）。**正常系なので窓を開かない**。
- **`reveal()` を必ず通す**（公開＝パトロン(Patron)の +1財源が誘発する）。`farming_village` と同じく
  `skipped.concat(matched ? [matched] : [])` を1回で公開する。
- **`reshuffleDeck` の副作用**＝運命の(Fated)／回避(Avoid)／影(Shadow)の底入れ／占星術師団・メイソン団が走る。
  `revealFromDeck` は `reshuffleDeck(p)` を state 無しで呼ぶが `_reduceState` フォールバックが効く（§0-32）。**触らないこと。**
- **`PLAY_ALL_EXCLUDE` には入れない**（事故らない・純粋に得）。
- ⚠ **`playAllOrder` に順位を決める**。Venture は「場に財宝を1枚増やす」ので、
  **場の財宝を数える札より前**に出したい＝`米(rice)`／`ペンダント(pendant)`／`大金(fortune)`／`銀行(bank)` より前。
  🛑 **既存カードと同じ rank にしてはいけない**（`sort` は同順位を入れ替えないので手札の並び順で前後が決まる＝
  engine のコメントが米/ペンダントで名指ししている罠）。`figurine`(-2) と `silver`(-1) の間か、`silver` と同じ側に専用 rank を切ること。
- **追いはぎ(Highwayman)＝そのターン最初の財宝なら Venture 自身の効果が丸ごと消える**（$1 も掘りも出ない）。
  `playTreasureCard` の早期 return で自動的に正しい。
- **CPU**＝`GAIN_ORDER` は低め（wiki Strategy＝ニッチ・`an expensive Silver`）。**新 pending が無いので `decidePending` の改修は不要**。

**カタログ文案**：
```
コイン +1
財宝カード1枚が公開されるまで山札を上から公開する。
公開した他のカードを捨て札にし、その財宝カードを使用する。
```

### 3-5. 日本語カード名

> 投機 (pron. *tōki*)
> $1 財宝カード1枚が公開されるまで山札を上から公開する。公開した他のカードを捨て札にし、その財宝カードを使用する。

⚠ **この行は実物と食い違うことがある**（依頼文の「投機」とは一致）。印刷版カード画像へのリンクは無いので日本語wiki で裏取りすること。

---

## 4. Goons（$6・アクション-アタック）

### 4-1. 英語カード文（現行の逐語）

> \+1 Buy
> \+ $2
> Each other player discards down to 3 cards in hand.
> ————
> While you have this in play, when you buy a card, +1 VP.

**区切り線＝1本**（生HTMLで `<hr>` を1つ確認。`discards down to 3 cards in hand.` の直後）。
🛑 **この区切り線は機能に効く**（下の §4-4 を参照）。

### 4-2. 版(Versions)

**機能エラッタは無し**（言い回し・書式のみ）。

| 版 | Text | Changes | Announced / Printed |
|---|---|---|---|
| First edition | > +1 Buy / +$2 / Each other player discards down to 3 cards in hand. / ———— / **While this is in play**, when you buy a card, +1 VP. | — | Oct 2010 |
| 2nd | 同上 | Increased font size. Highlight vanilla bonuses in the body text. | Oct 2016 / Feb 2017 |
| 3rd（現行） | > … / ———— / **While you have this in play**, when you buy a card, +1 VP. | Rephrased "While this is in play" to "While you have this in play". | Oct 2020 |

Prosperity 2E で **removed**（Collection に置換）。

### 4-3. Official FAQ / Other rules clarifications（逐語）

**Official FAQ**
> You get +1 VP per card you buy, but do not get +1 VP for gaining a card some other way.
> Multiple copies of Goons are cumulative; if you have two Goons in play and buy a Silver, you'll get +2 VP.
> **However if you King's Court a Goons, despite having played the card 3 times, there is still only one copy of it in play, so buying Silver would only get you +1 VP.**

**Other rules clarifications**
> Buying Events does not give you VP.

**Deprecated official FAQ (2010)**
> See the Additional Rules section for rules on VP tokens.
> You get 1 VP for each card you buy, but do not get a for gaining a card some other way.
> Multiple copies of Goons are cumulative; if you have two Goons in play and buy a Silver, you get 2 VP.
> However if you King's Court a Goons, despite having played the card 3 times, there is still only one copy of it in play, so buying Silver would only get you 1 VP.

### 4-4. ⚠ 実装で危ないところ

**アタック部分＝新 pending 不要**。**購入VP部分＝新 pending 不要**（非対話）。＝**engine だけで完結する**。

#### (a) アタック（手札3枚まで捨てさせる）

- 🛑 **`discardDownEnter(state, pi, 3, victims, null, 0)`（共通の `discard_down` pending）を使う。自前モーダルを作らない。**
  §0-37 が名指しで警告しているとおり（侍/忍者）、自前モーダルを作ると **堀/盾のリアクション導線の穴を再発させる**
  （`discard_down` は `ATTACKS` に `embedded: true` で登録済み＝モーダル内に堀/盾/馬商人のボタンが既にある）。
  ＝**`ATTACKS` への新規登録も不要**（`discard_down` を流用するので）。
- 被害者の抽出は `militia` と同じ形＝**手番順**（`(pi + k) % n`）＋ `hand.length > 3` ＋ `!attackImmune(state, idx)`。
- `t.buys += 1`（購入権は `addActions`/`addCoins` のようなヘルパ不要＝既存の直接加算が慣行）／
  🛑 **`addCoins(state, 2)` を必ず使う**（`t.coins += 2` を直接書くとカメレオンの習性が壊れる）。

#### (b) 購入するたび +1勝利点

- 🛑 **「場にある枚数」で数える。「使用回数」ではない。**
  公式FAQ が王の宮廷を名指し＝`King's Court a Goons ... there is still only one copy of it in play, so ... only +1 VP`。
  → **`groundskeeper`（帝国 庭師）と同じモデル**＝`me.inPlay.filter(c => c === 'goons').length`。
  🛑 **`t.merchantGuildPlays`（商人ギルド）のモデルをコピーしてはいけない**（あちらはプレイ回数で累積する別ルール。
  ついでに言うと **商人ギルドは 2022 エラッタで
  `At the end of your Buy phase this turn, +1 Coffers per card you gained in it.` に全面変更されており、
  本アプリの `triggerMerchantGuild` は旧版のまま**＝Goons の実装時にここを参考にすると二重に間違える）。
- **`durationCards` は足さない**。Goons は持続にならないので `inPlay` だけが正しい
  （蓄積／海上交易が `inPlay + durationCards` を見るのとは事情が違う）。
- **呼ぶ場所は2箇所**＝`BUY` reducer と `BLACK_MARKET_BUY` reducer（＝`triggerMerchantGuild` の真横）。
  闇市場からの購入も「購入」＝英語wiki `Black Market` の逐語
  > Buying and gaining a card from from the Black Market will count for anything that cares about cards that you bought (e.g. Haggler or Swamp Hag).
- 🛑 **`BUY_EVENT` と `BUY_PROJECT` からは呼ばない**（`Buying Events does not give you VP.`＝カードでないものの購入は対象外）。
- **`p.vpTokens` は既存の非カード公開スカラー**＝保存則 tally・`allCards` に入れない。`vpOf`（engine）と `vpOfPlayer`（CPU）が
  既に加算しているので**得点計算・CPU の終局読みは自動で正しくなる**。
- **支配(Possession)＝VPトークンは被支配者に入る**。`Possession` ページの逐語＝
  > You also get any D tokens that player would have gotten … **You do not get any other tokens that player would have gotten** (this is a change from an earlier version).
  ＝負債は支配者、**VPトークンは被支配者**。`BUY` の中で `state.players[pi]`（= `t.active` = 被支配者）に足せば正しい
  （既存の `monument` と同じ扱い）。**`debtHolder` / `possessedBy` の振り分けをここに書いてはいけない。**
- 🛑 **習性(Way)で使っても購入VPは働く**（区切り線の下だから）。`Way` ページの Donald X. 逐語＝
  > Stuff below a dividing line is unaffected; if it's like, "While this is in play, something something," that will still happen.
  （同ページの Highway の例も同じ）。**`inPlay` を数える実装なら自動的に正しい**＝
  「習性で使ったから効果を消す」ような分岐を足さないこと。**女魔術師(Enchantress)で置換された場合も同様**。
- **3山終了の加速**＝Goons デッキは +購入で銅貨/呪いを買い漁って終局を早める。CPU の `buyEndsGame` は
  `DOM.engine.emptyPileCount` を見ているので自動追随（§0-24）。
- **CPU**
  - `chooseAction` に登録（`militia` と同じターミナル扱い）。**登録漏れ＝CPUソークがこの経路を1度も検証しない**（§0-36 が名指しした罠）。
  - `GAIN_ORDER` は $6 帯の最上位（wiki＝`one of the best payload cards in Dominion`）。
  - `decidePending` は既存の `discard_down` 分岐がそのまま使われる＝**改修不要**。
  - 「余った購入権で $0 のカードを買って VP を稼ぐ」は CPU の既定購入ロジックには無い＝**許容簡略化として記録**（忠実性・非ループには影響しない）。

**カタログ文案**：
```
+1 購入
+2 コイン
他のプレイヤーは手札が3枚になるまで捨てる。
————
これが場にある間、カード1枚を購入するたびに +1 勝利点。
```

### 4-5. 日本語カード名

> ならず者 (pron. *narazumono*, lit. *ruffian*)
> +1 購入 +$2 他のプレイヤーは全員、手札が3枚になるように捨て札にする。／これが場にある間、カード1枚を購入するとき、+1 VP。

⚠ **この行は実物と食い違うことがある**。**日本語wiki での裏取りが必須**。
🛑 **本タスクの依頼文は「暴徒」と書いているが、英語wiki の「暴徒」は Chinese 行の名前**（Japanese 行は「ならず者」）＝
**依頼文が中国語名を日本語名として取り違えている可能性が高い**。Japanese 行に印刷版カード画像へのリンクは無い。

---

# 実装前に必読（この4枚に共通する罠）

1. 🛑 **区切り線の下は「使用時の記載効果」ではない**。この群では **Royal Seal と Goons の主効果が区切り線の下にある**。
   結果として、**習性(Way)・女魔術師(Enchantress)・追いはぎ(Highwayman)で「何もしない」ことにされても、
   これらの能力は働き続ける**（`Way` ページ Donald X. 逐語＝`Stuff below a dividing line is unaffected`）。
   → **両方とも「場にあるか」を外側（`triggerOnGain` / `BUY`）で見る実装にすること**。`applyEffect` / `applyTreasureEffect`
   の中に書くと、上記3種で静かに消える。逆に、外側に書いてあるのを見て「効果関数への書き忘れ」と誤解して“直さない”こと。

2. 🛑 **「While you have this in play」（Royal Seal / Goons）と「this turn」（ティアラ / 勲章 / 追跡者 / 移動遊園地）を混同しない。**
   前者＝場から離れたら止まる（`inPlay.includes` / `inPlay.filter().length`）。後者＝ターン旗（`t.insignia` / `t.trackerTurn`）。
   ⚠ **本アプリの `tiara` は現在「場にあるか」で実装されている＝ティアラのルールではなく Royal Seal のルール**。
   Royal Seal 実装時に必ず突き合わせること（カタログ文とも食い違っている）。

3. 🛑 **「複数枚あるとき」の数え方が3系統ある。取り違えると静かに壊れる。**
   - **場の枚数**＝Goons（公式FAQ が王の宮廷を名指し）／庭師(groundskeeper)／隠し財産(hoard)
   - **プレイ回数**＝商人ギルド（旧版）／`t.improvePlays`
   - **予約の数**＝持続系（`p.delayedEffects`）
   Goons は**必ず1つ目**。

4. 🛑 **アタックは既存の共通機構に乗せる。自前モーダルを作らない。**
   - Goons＝**`discardDownEnter(..., 3, ...)`**（`discard_down` は `ATTACKS` に `embedded` 登録済み＝堀/盾/馬商人の導線が既にある）
   - Mountebank＝**`old_witch` 型**（`ATTACKS` に1行＋`*EnterVictim`＋react/choice の2 pending）
   自前で書くと §0-30 P1b（盾のボタンが3モーダルに無く**人間だけが詰む**）と同じ事故を再発させる。

5. 🛑 **「呪いを捨てて免れる」は堀の代わりではない**（Mountebank）。公式逐語 `you cannot Moat just part of the attack`。
   免疫判定（`attackImmune` フィルタ＋堀の react ステージ）を**必ず先に**通し、そのあとで捨てる選択の窓を開く。

6. 🛑 **獲得順・解決順を逐語どおりに**。
   - Mountebank＝**呪い → 銅貨**（Other rules clarifications が名指し）。片方の山が空でももう片方は獲得する。
   - Venture＝**捨てる → 捨て札トリガー → 財宝を使用**。捨て札トリガーが pending を立てうる（織工）ので
     `t.storytellerResume` 型の再開網が要る（無しにするなら PROGRESS に許容簡略化として明記）。

7. 🛑 **財宝を「使わせる」ときは必ず `playTreasureCard` を通す**（Venture）。
   `p.hand.push(card)` してから呼ぶ＝`crystal_ball` の確立パターン。自前で `coin` を足すだけの実装は
   銀行・ペテン師・商人・サウナ・山トークン・予言・追いはぎ・資本主義を全部取りこぼす（§0-15 の `treasureReplayCoins` の轍）。
   ⚠ ただし `playTreasureCard` は `notePlayFromHand` を呼ぶ＝**航海(Voyage)の3枚制限に誤カウントする既存の穴**がある
   （`crystal_ball` も同罪）。`playCardNoAction` の `asHand` 引数と同じ逃げ道が要る。

8. 🛑 **種別判定は必ず動的述語**＝`isTreasureFor(state, c)`（Venture）。静的 `DOM.isType(c,'treasure')` は
   資本主義(Capitalism)・悟り(Enlightenment)で必ずズレる。

9. 🛑 **捨てる経路は `triggerOnDiscard` を通す**（Venture）。坑道(Tunnel)・小道・織工・村有緑地・忠犬。
   ⚠ **コピー元候補の `farming_village` はこれを呼んでいない**（既存の取りこぼし）。そのままコピーしない。

10. **支配(Possession) の振り分けは3種類に分かれる。** `Possession` ページ逐語＝
    > Any cards the Possessed player would have gained in any way, you gain instead … You also get any D tokens that player would have gotten … **You do not get any other tokens that player would have gotten.**
    - **カード＝支配者**（Royal Seal の topdeck が働かない理由。本アプリの `triggerOnGain(state, t.possessedBy, ...)` 振り分けで**自動的に正しくなる**）
    - **負債＝支配者**
    - **VPトークン＝被支配者**（Goons。既存の `monument` と同じ扱い）

11. **新 pending の要否まとめ**（4点セット＝engine reducer＋`PLAYER_ACTIONS`＋CPU `decidePending`＋UI `viewPendingModal`）
    | カード | 新 pending | 流用できる既存機構 |
    |---|---|---|
    | Mountebank | **2種必要**（react / choice） | `old_witch`（`oldWitchEnterVictim` / `OLD_WITCH_REACT` / `OLD_WITCH_TRASH`） |
    | Royal Seal | **不要** | `travelling_fair`（勲章／追跡者／移動遊園地と共有・`source` でログだけ切替） |
    | Venture | **不要** | `revealFromDeck` ＋ `playTreasureCard`（`farming_village` ＋ `crystal_ball`） |
    | Goons | **不要** | `discardDownEnter(..., 3, ...)`（`discard_down`） |
    ＝**新 pending が要るのは Mountebank だけ**。他3枚は engine だけで完結し、CPU/UI の改修は Mountebank 分と `chooseAction`/`GAIN_ORDER` 登録のみ。

12. ⚠ **カタログ登録先**＝house style に従い `PROSPERITY_REMOVED_1E` ＋ `DOM.POOLS.prosperity1e`
    （`BASE_REMOVED_1E` / `basic1e`、`INTRIGUE_REMOVED_1E` / `intrigue1e` と同じ形。
    `DOM.POOLS.prosperity.filter(id => !PROSPERITY_NEW_2E.includes(id)).concat(PROSPERITY_REMOVED_1E)`）。
    2E 新規9枚＝anvil / clerk / investment / tiara / charlatan / collection / crystal_ball / magnate / war_chest。
    1E 撤去9枚＝loan / trade_route / talisman / contraband / counting_house / **mountebank / royal_seal / venture / goons**。
    ⚠ 段階1で止めるなら **`DOM.STAGE1_POOLS` に必ず入れる**（闇市場に死に札が並ぶ）。

13. 🛑 **日本語カード名は英語wiki の Japanese 行を信用しない。**
    この4枚はいずれも **Japanese 行に印刷版カード画像へのリンクが無い**（`File:...Japanese...` が0件）＝
    Dominion Online 訳の可能性が高く、ホビージャパン印刷版の逐語ではない。さらに**依頼文の想定名と2枚で食い違っている**：
    | | 依頼文 | 英語wiki Japanese 行 | 判定 |
    |---|---|---|---|
    | Mountebank | 山師 | **香具師**（yashi） | ⚠ **食い違い**。要裏取り |
    | Royal Seal | 玉璽 | 玉璽（gyokuji） | 一致 |
    | Venture | 投機 | 投機（tōki） | 一致 |
    | Goons | 暴徒 | **ならず者**（narazumono） | ⚠ **食い違い**。「暴徒」は同ページの **Chinese** 行の名前＝取り違えの疑い |
    日本語wiki（wikiwiki.jp）の個別カードページで確認すること（**並列で叩くと 429 で全滅するので逐次・6秒間隔**＝`tools/jpwiki.py`）。


## 【この章の敵対検証（別エージェントが一次資料に当たり直したもの）】
⚠ **上の起草と食い違う場合はこちらが正**（起草より後に、同じページを取り直して照合している）。

クリーンアップ完了・リポジトリは1バイトも変更していません（`git status --porcelain` = 0行）。

---

# 検証結果

## 総評

**英語カード文の逐語・区切り線の本数・版(Versions)・公式FAQ / Other rules clarifications は4枚とも全て正確**でした。私自身で `wikidirect.js` により4ページを取り直し、生HTMLの `<hr>` を数えて照合しています（Mountebank 0本／Royal Seal 1本／Venture 0本／Goons 1本＝全て起草どおり）。捏造・FAQ節の見落としもありません。Venture に `Other rules clarifications` 節が無いことも実在の事実です。

以下は**確定した訂正 8件**と**足りていない項目 7件**です。

---

# A. 確定した訂正

## A-1. 【中】Royal Seal「CPU/UI は改修ゼロ」は誤り — UI にラベル分岐が要る／engine のログは固定文字列

**① 起草の記述**（§2-4）
> ＝**engine に push 1箇所＋ログ文字列だけ**で、CPU `decidePending` と UI `viewPendingModal` は**改修ゼロ**。
> …「`source` でログのラベルだけ切り替える形が確立済み」

**② 一次資料（リポジトリ実コード）**

`js/ui.js:3655`
```js
if (pd.type === 'travelling_fair') return modalOptions((pd.source === 'bauble' ? '道化棒' : pd.source === 'insignia' ? '勲章' : '移動遊園地') + ' — 山札の上に置く？',
```
`js/engine.js:14344`（`TRAVELLING_FAIR_TOPDECK` reducer）
```js
if (zone && removeOne(zone, pd.card)) { p.deck.unshift(pd.card); log(state, `${p.name} は移動遊園地で「${C()[pd.card].name}」を山札の上に置いた。`); }
```

**③ 正しい記述**
- **ラベルを切り替えているのは engine のログではなく `js/ui.js` の `modalOptions` 第1引数**。engine 側のログは**「移動遊園地で」に固定**されている。
- したがって Royal Seal を足すと、**UI モーダルもログも「移動遊園地」と名乗る**。CPU は確かに改修不要（`js/cpu.js:1506` の分岐は `source` を見ない汎用）だが、**UI は三項演算子に1分岐を足す必要がある**。engine 側は「ログ文字列だけ」ではなく「`pd.source` を見てログを分岐させる改修」が要る（放置すると全ソースが「移動遊園地」と嘘をつく）。
- 正しい要約＝**engine に push 1箇所＋ログの分岐＋UI に1分岐／CPU のみ改修ゼロ**。

---

## A-2. 【中】Royal Seal に `playAllOrder` の順位が要る（起草は Venture にしか触れていない）

**① 起草の記述**（§2-4・実装で危ないところ）
Royal Seal の節に `playAllOrder` への言及が一切無い。

**② 一次資料**

英語wiki `Royal Seal` Official FAQ 逐語：
> This applies both to cards gained due to being bought, and to cards gained other ways with Royal Seal in play, such as with **Hoard**.

`js/engine.js:1424`（掘出物＝`treasure_trove` は**使用時に金貨と銅貨を獲得する財宝**）
```js
if (card === 'treasure_trove') {
  const g1 = gain(state, pIndex, 'gold', 'discard'), g2 = gain(state, pIndex, 'copper', 'discard');
```
`js/engine.js:1137`（`playAllOrder` の rank 表）
```js
const rank = (c) => (PLAY_TWICE_TREASURES[c] ? -2 : c === 'figurine' ? -2 : c === 'silver' ? -1 :
  c === 'rice' ? 1 : c === 'pendant' ? 2 : c === 'fortune' ? 3 : 0);
```

**③ 正しい記述**
「財宝を全部出す」で `royal_seal` と `treasure_trove`（および `ill_gotten_gains`）が**どちらも rank 0 で同順位**になり、`Array.prototype.sort` は安定ソートなので**手札の並び順で前後が決まる**。Royal Seal が後に出ると **treasure_trove が獲得した金貨・銅貨を山札の上に置く窓が開かない**（公式FAQ が「買った以外の獲得にも効く」と明記している経路が確率的に落ちる）。
→ **Royal Seal は `playAllOrder` で早め（`figurine` と同じ -2 帯、ただし別 rank）に置くこと**。これは起草自身が Venture の項で書いた「🛑 既存カードと同じ rank にしてはいけない」という注意を、Royal Seal に適用し忘れた形です。

⚠ **同じ穴が `insignia`（勲章）に既存で存在する**（`insignia` も rank 未設定）＝下の B-5 参照。

---

## A-3. 【中】Royal Seal の Deprecated FAQ 引用が逐語ではない

**① 起草の記述**（§2-3）
> **If you play Possession**, and during the extra turn you have the possessed player play Royal Seal, …

**② 一次資料** — 英語wiki `Royal Seal` > Deprecated official FAQ (2010)
> If you play **the Dominion: Alchemy card** Possession, and during the extra turn you have the possessed player play Royal Seal, he cannot put the card on his deck - he is not gaining the card, you are.

**③ 正しい記述** — 「the Dominion: Alchemy card」が脱落しています。裁定の中身は変わりませんが、**「逐語」と称した引用に欠落がある**ので、正本に書き写すときは補うこと。

---

## A-4. 【中】「Royal Seal と Goons の両方が Way／女魔術師／追いはぎで守られる」は誤り — 各カードに効く脅威は排他

**① 起草の記述**（実装前に必読 #1）
> この群では **Royal Seal と Goons の主効果が区切り線の下にある**。結果として、**両方とも「場にあるか」を外側で見る実装にすること**。…「習性(Way)・女魔術師(Enchantress)・追いはぎ(Highwayman)で「何もしない」ことにされても、これらの能力は働き続ける」

**② 一次資料**

英語wiki `Way`：
> Ways are not Kingdom cards… **When you play an Action card**, pick, do you want its normal function, or do you want the Way.

`js/cards.js:701`（女魔術師）
> 他の各プレイヤーがその手番で最初にプレイする**アクションカード**は、記載の効果の代わりに +1 カード +1 アクション となる。

`js/cards.js:1054`（追いはぎ）
> 他のプレイヤーが各ターンに最初に使用する**財宝**は、何もしない。

**③ 正しい記述**

| | 習性(Way) | 女魔術師 | 追いはぎ |
|---|---|---|---|
| **Royal Seal**（財宝） | **該当なし**（習性はアクション専用） | **該当なし**（アクション専用） | ✅ 該当・下段は働く |
| **Goons**（アクション） | ✅ 該当・下段は働く | ✅ 該当・下段は働く | **該当なし**（財宝専用） |

「両方とも3つ全部に守られる」という書き方は**各カードにつき2つが的外れ**です。「区切り線の下は働く」という一般則自体は正しい（`Text below a dividing line is unaffected, it will still happen whenever it says it does.` — `Way` ページ逐語）ので、結論（外側で判定する）は変わりませんが、**実装者が「Royal Seal と習性の相互作用」を検証しようとして時間を溶かす**ので、対応表に直すべきです。

---

## A-5. 【小】Mountebank の pending 命名が既存の前例と食い違う

**① 起草の記述**（§1-4）
> **新 pending 2種**＝`mountebank`(stage:`react`) と `mountebank`（choice）

**② 一次資料** — `js/engine.js:3833, 3845`（前例として起草自身が指定した `old_witch`）
```js
state.pending = { type: 'old_witch', stage: 'react', player: victim, source, victim, queue: rest };
…
state.pending = { type: 'old_witch_trash', player: victim, source, queue };
```

**③ 正しい記述** — `old_witch` 型は**同名 + stage** ではなく、**`old_witch`（react）と `old_witch_trash`（別 type）の2つ**です。起草の「`mountebank` を stage 違いで2つ」は前例と異なります。機能上はどちらでも動きますが、`js/engine.js:3723` の
```js
return !!a.embedded || pd.stage === 'react';
```
（`ATTACKS` の反応窓判定）と、UI の選択リセットキー `pd.type + (pd.stage||'')` の両方に関わるので、**前例どおり `mountebank`（stage:'react'）と `mountebank_discard`（別 type）に分ける**のが安全です。

---

## A-6. 【小】Mountebank と `old_witch` は「選択と獲得の順序」が逆であることに注意が要る

**① 起草の記述**（§1-4）
> **同型の前例＝`old_witch`（ルネサンス 老魔女）が最も近い**

**② 一次資料** — `js/engine.js:3838-3848`（`oldWitchApply`）
```js
function oldWitchApply(state, source, victim, queue) {
  if ((state.supply.curse || 0) > 0) {
    gain(state, victim, 'curse', 'discard');      // ← 先に獲得
    …
  }
  if (state.players[victim].hand.includes('curse')) {
    state.pending = { type: 'old_witch_trash', … }; // ← その後に選択
```

**③ 正しい記述** — **老魔女は「獲得 → 選択（廃棄）」／Mountebank は「選択（捨てる） → 獲得（捨てなかった場合のみ）」で順序が逆**です。`oldWitchApply` の骨格をそのままコピーすると **呪いを配ってから捨てる窓を開く**という真逆の実装になります。「構造は同型（react → 条件付き choice）だが、`Apply` 関数の中身は反転する」と明記すべきです。

---

## A-7. 【小】Goons の `+1 Buy` の書き方の根拠が示されていない（結論は正しい）

**① 起草の記述**（§4-4)
> `t.buys += 1`（購入権は `addActions`/`addCoins` のようなヘルパ不要＝既存の直接加算が慣行）

**② 一次資料** — `js/engine.js` に `function addBuys` は**存在せず**、`t.buys += ` が**103箇所**。

**③ 正しい記述** — 結論は正しいので**訂正ではありません**が、根拠を明示しておくと将来「`addBuys` を作れ」というレビュー指摘に反証できます（`addActions`/`addCoins` は雪深い村／カメレオンの習性という**具体的なカードが要求した**ヘルパで、購入権にはそれに相当するカードが無い）。

---

## A-8. 【小】Venture の `playAllOrder` 説明が既存の rank 表と食い違う

**① 起草の記述**（§3-4）
> **場の財宝を数える札より前**に出したい＝`米(rice)`／`ペンダント(pendant)`／`大金(fortune)`／**`銀行(bank)`** より前。

**② 一次資料** — `js/engine.js:1137`（rank 表に `bank` は無い＝rank 0）

**③ 正しい記述** — **`bank` には順位が設定されていない**（rank 0＝大多数の財宝と同順＝手札順で前後が決まる）。したがって「Venture を bank より前に置く」は、**Venture に負の rank を与えることで初めて成立**します（rank 0 のままだと bank と同順で不定）。起草の推奨（`figurine(-2)` と `silver(-1)` の間）に従えば結果的に正しくなりますが、「bank より前」を既存の rank 表の事実として書くのは誤りです。

---

# B. 足りていない項目

## B-1. 🛑【重要】`collection`（収集）も `tiara` と**同じ**バグを抱えている — 起草は tiara しか見つけていない

起草は「本アプリの `tiara` は `inPlay.includes('tiara')` で実装されており、これは Royal Seal の規則」という**正しい実バグ**を発見しています（私も英語wiki `Tiara` の逐語 `**This turn**, when you gain a card, you may put it onto your deck.` と Official FAQ `If you gain multiple cards **later in the turn after playing Tiara**` で裏取り済み）。

**同じ穴がもう1枚あります。**

英語wiki `Collection`（Card text 逐語）：
> $2 / +1 Buy / **This turn**, when you gain an Action card, +1 VP.

`js/cards.js:314`（カタログも正しく「このターン」）
> 'コイン +2、+1 購入\n**このターン**、アクションカードを獲得するたびに +1 勝利点。'

`js/engine.js:10573`（**実装は「場の枚数」＝Royal Seal / Goons の規則**）
```js
const cols = state.players[pIndex].inPlay.filter((c) => c === 'collection').length;
```

**なぜ Goons の実装時に必ず踏むか**：Collection は **Goons の2E 置換カード**です。Goons を正しく `inPlay.filter(...).length` で実装すると、Collection とコードが**見た目そっくりになる**ため、次の実装者が「同じだから共通化しよう」とやると**両方まとめて間違えます**。正本には
> **Goons / Royal Seal＝`While you have this in play`＝場の枚数。Collection / Tiara＝`This turn`＝そのターンの使用回数。コードが似て見えても共通化してはいけない。**

と明記すべきです。

さらに、**正しい前例はリポジトリ内に既にあります**＝`js/engine.js:1621`
```js
if (card === 'insignia') { t.insignia = (t.insignia || 0) + 1; }
```
勲章(Insignia) は `This turn, when you gain a card…` で、**`t.insignia`（そのターンの使用回数）**という正しいモデルで実装済み。tiara / collection はこれに揃えるべきです。

---

## B-2. 🛑 Mountebank の許容簡略化として **交易商人(Trader)** を名指しすべき（起草は望楼しか挙げていない）

起草は Deprecated FAQ の Watchtower 裁定を許容簡略化として記録するよう書いていますが、**Mountebank の最も有名なカウンターである交易商人が抜けています**。

`js/engine.js:10578, 10601`
```js
if (state.turn && pIndex === state.turn.active && state._gainDepth === 1 && !state.pending) {
  const me = state.players[pIndex];
  if (me.hand.includes('watchtower')) …
  …
  else if (me.hand.includes('trader') && cardId !== 'silver' && …) {
    state.pending = { type: 'trader_react', … };
```
＝**`pIndex === state.turn.active` ゲートにより、Mountebank の被害者は Trader を公開できない**（公式では呪いの代わりに銀貨を獲得できる）。

これは PROGRESS §0-5 が既に
> **交易商人の獲得置換は自分の手番の獲得のみ**（相手ターンの魔女等の呪い獲得を銀貨に置換する反応は非対応）

と記録している**既存の横断簡略化**なので、Mountebank のために直す必要はありません。ただし **Mountebank は Trader を名指しで無効化する最も目立つカード**なので、正本に「望楼**と交易商人**が反応しない＝§0-5 の既存簡略化」と両方書くべきです。

---

## B-3. 🛑 Venture の「捨てる → 捨て札トリガー」で **pending を立てうるのは織工だけではない**（起草の限定は不正確）

**① 起草の記述**（§3-4）
> 簡略化する場合は PROGRESS に明記（村有緑地・忠犬はキュー行きなので**実害があるのは織工のみ**）。

**② 一次資料** — `js/engine.js:10885-10915`（`triggerOnDiscard` 本体）
```js
if (c === 'tunnel') { if (gain(state, pIndex, 'gold', 'discard')) … }   // ← gain() を呼ぶ
else if (c === 'trail') { trailPlay(state, pIndex, 'discard'); }        // ← カードを使用する
else if (c === 'weaver') weaverN++;
```

**③ 補うべき内容** — 織工のほかに **坑道(Tunnel)** と **小道(Trail)** が pending を立てうる経路です：
- **坑道**＝`gain(state, pIndex, 'gold', 'discard')` を呼ぶ → **その金貨の獲得が `triggerOnGain` を走らせ、望楼／ティアラ／交易商人／Royal Seal の窓を開く**（自分の手番・`_gainDepth===1`・`!state.pending` を全部満たすので実際に開く）。
- **小道**＝`trailPlay` がカードを使用する → その効果が pending を立てうる。

つまり **「Venture で捨てた札に坑道が混ざっていて、かつ手札に望楼がある」だけで pending が立ちます**。「実害があるのは織工のみ」は誤りで、`t.ventureResume` 型の再開網（またはその明示的な簡略化）は**織工が王国に無くても必要**です。

---

## B-4. 🛑 Venture が `playTreasureCard` を通すと **`t.saunaPlays` の銀貨廃棄窓** など「pending を立てる副作用」が Venture 経由で起きる

起草は `playTreasureCard` を通す利点（銀行・ペテン師・商人・サウナ・山トークン・予言）を正しく列挙していますが、**そのうち複数が pending を立てる**ことに触れていません。

`js/engine.js:1195-1197`（`playTreasureCard` の入口）で `applyPileTokens` / `noteTreasurePlayedForProphecy` / `noteAllyPlay` が走り、さらに効果本体が pending を立てます。Venture が掘り当てうる pending 立て財宝の実例：
- **ペテン師(charlatan)** = 財宝-アタック → 各相手のリアクション窓
- **サウナ×銀貨** = `sauna_trash` 窓
- **御守り／水晶玉／金床／不正利得／豊穣の角** 等の選択待ち
- **呪符の巻物(spell_scroll)** = アクション-財宝

これらは B-3 の再開網と**同じスタックに乗せる必要がある**（Venture が Venture を見つける入れ子と併せて）ため、起草が「スタック（配列）で持つこと」と書いたのは正しいものの、**「入れ子 Venture のためのスタック」ではなく「捨て札トリガー由来の pending ＋ 掘り当てた財宝由来の pending の両方を跨ぐスタック」**である、と精度を上げるべきです。

---

## B-5. 【小】`tracker`（追跡者）の `travelling_fair` 窓が **既にラベルを誤表示している**（既存の軽微バグ）

`js/engine.js:10327`
```js
… push({ type: 'travelling_fair', player: pIndex, card: cardId, dest: dest || 'discard', src: 'tracker' });
```
`js/engine.js:10333`（勲章）／`js/engine.js:10791`（道化棒・移動遊園地）はいずれも **`source:`**。UI（`js/ui.js:3655`）が読むのは **`pd.source`** なので、**追跡者だけキー名が `src` で、モーダルが「移動遊園地」と表示されます**。

Royal Seal を同じ窓に載せるときに**必ず `source:` を使う**（起草の提案コードは正しく `source:` になっています）と同時に、この1文字を直しておくのが自然です。

---

## B-6. 【小】Goons を `discard_down` に載せると **アタック名がログ／UI に出ない**

`js/engine.js:4131`
```js
function discardDownEnter(state, source, down, victims, next, drawAfter) {
  if (victims && victims.length) state.pending = { type: 'discard_down', player: victims[0], source, down, … };
```
`source` は**カードid ではなく席番号**（`js/engine.js:13217` が `source: seat` で使用）。したがって `discard_down` を共有すると、被害者側には「誰の何のカードで捨てさせられているか」が出ません（忍者・侍・浮浪児・傭兵・サー・マイケルと同じ既存の割り切り）。起草の推奨（自前モーダルを作らない）は**正しい**ので変更不要ですが、**「Goons のログ／UI に『暴徒／ならず者』の名前は出ない＝既存の共有窓の仕様」**と1行残さないと、次の実装者が「名前を出すために自前モーダルを作る」→ §0-30 P1b の盾の穴を再発させます。

---

## B-7. 【参考・範囲外】起草が付随して指摘した「商人ギルドは旧版のまま」は**事実です**

起草が Goons の項で余談として書いた指摘を、私も独立に裏取りしました。

英語wiki `Merchant Guild` Card text 逐語：
> +1 Buy / +$1 / **At the end of your Buy phase this turn, +1 Coffers per card you gained in it.**

`js/engine.js:3405-3413`（実装は旧版＝「購入するたびにプレイ回数ぶん財源」）
```js
function triggerMerchantGuild(state, pi) {
  const n = (state.turn && state.turn.merchantGuildPlays) || 0;
  if (n > 0) { me.coffers = (me.coffers || 0) + n; …
```
`js/cards.js` のカタログも旧版文面のはずです（`triggerMerchantGuild` が `BUY`／`BLACK_MARKET_BUY` の2箇所から呼ばれている＝購入トリガー実装）。**現行は「購入」ではなく「購入フェイズ終了時に、そのフェイズ中に獲得した枚数ぶん」**なので、**購入以外の獲得（工房・鹵獲品・国境の村の連鎖など）も数え、逆に負債返済だけのターンは何も出ない**という別ルールです。Goons の担当範囲外ですが、**Goons のコピー元として `triggerMerchantGuild` を眺めると二重に誤解する**ので、正本に警告として残す価値があります（別途、収穫祭＆ギルドの再検証タスクを立てるべき事案）。

---

# C. 訂正なしと確認した項目

以下は**自分で一次資料に当たり直して、起草が正しいことを確認**しました。

| 項目 | 確認方法 |
|---|---|
| 4枚の英語カード文（現行）逐語 | `wikidirect.js` で4ページ取得・全文一致 |
| 区切り線の本数（0/1/0/1） | 生HTML の Card text セル内 `<hr>` を実カウント |
| 版(Versions) 3版／機能エラッタ0件（4枚とも） | English versions 表を全行照合 |
| Official FAQ・Other rules clarifications・Deprecated FAQ の全文 | 各ページの FAQ 節を全文照合。**節の見落としゼロ**（Venture に `Other rules clarifications` が無いのも実在の事実） |
| Mountebank「呪いを捨てても堀の代わりにはならない」 | `you cannot Moat just part of the attack`（Deprecated FAQ） |
| Mountebank の獲得順「呪い → 銅貨」 | `A player hit by Mountebank gains the Curse first, and then the Copper.`（Other rules clarifications） |
| Goons「場の枚数であってプレイ回数ではない」 | `if you King's Court a Goons, despite having played the card 3 times, there is still only one copy of it in play, so buying Silver would only get you +1 VP.`（Official FAQ） |
| Goons「イベントの購入では VP を得ない」 | `Buying Events does not give you VP.`（Other rules clarifications） |
| 闇市場の購入は「購入」に数える | `Buying and gaining a card from from the Black Market will count for anything that cares about cards that you bought (e.g. Haggler or Swamp Hag).`（`Black_Market`） |
| 支配＝VPトークンは被支配者 | `You also get any [D] tokens… **You do not get any other tokens that player would have gotten**`（`Possession`） |
| 区切り線の下は習性で無効化されない | `Text below a dividing line is unaffected, it will still happen whenever it says it does.`（`Way`） |
| 繁栄1E撤去9枚のリスト | `Prosperity` > Removed first-edition Kingdom cards＝loan / trade_route / talisman / contraband / counting_house / mountebank / royal_seal / venture / goons（**完全一致**） |
| 日本語名の断定回避＋依頼文との食い違い指摘 | Japanese 行＝香具師 / 玉璽 / 投機 / ならず者。**4枚とも Japanese 行に印刷版カード画像リンクが 0 件**（生HTMLで確認）＝DO訳の疑いが濃い、という起草の判断は妥当。**「暴徒」が Goons の Chinese 行の名前**であることも確認（依頼文の取り違え） |
| `old_witch` / `discardDownEnter` / `revealFromDeck` / `crystal_ball` / `isTreasureFor` / `groundskeeper` / `travelling_fair` / `zoneOf` / `attackImmune` / `hasReaction` / `highwaymanBlocks` / `notePlayFromHand` / `t.storytellerResume` / `t.fhResume` / `playAllResume` / `addCoins` / `addActions` / `debtHolder` の実在と挙動 | `js/engine.js` を直接 grep・本体を読んで確認。**起草が挙げたカードid・関数名は全て実在**（架空の前例ゼロ） |
| `farming_village` が `triggerOnDiscard` を呼んでいない | `js/engine.js:7217` `skipped.forEach((c) => p.discard.push(c));` ＝起草の警告どおり |
| `discard_down` が `ATTACKS` に `embedded: true` で登録済み | `js/engine.js:3672` |
| `playTreasureCard` が `notePlayFromHand` を無条件で呼ぶ（航海の誤カウント） | `js/engine.js:1189` |
| `BASE_REMOVED_1E`/`basic1e` の house style | `js/cards.js:1730-1768` |
| `triggerMerchantGuild` の呼び出しが `BUY`(14056)・`BLACK_MARKET_BUY`(16571) の2箇所のみ（＝`BUY_EVENT` を自動的に除外できる） | grep で確認・起草の配置推奨は正しい |

---

## 参考：関連ファイル（絶対パス）

- `C:\Users\b1242\claude\game\dominion\js\engine.js`
- `C:\Users\b1242\claude\game\dominion\js\cards.js`
- `C:\Users\b1242\claude\game\dominion\js\ui.js`
- `C:\Users\b1242\claude\game\dominion\js\cpu.js`
- `C:\Users\b1242\claude\game\dominion\tools\wikidirect.js`（英語wiki 取得に使用）


---

# 第5章　プロモ ― Marchland／Summon（本アプリ初のプロモ・イベント）

Repo is clean, temp files gone. Here is the research report.

---

# プロモ2枚（Marchland / Summon）公式ルール確定レポート

一次資料＝英語wiki（`tools/wikidirect.js` で逐次取得）＋生HTML（`<hr>` 判定）。
参照した支援ページ＝`Silk_Road` / `Event` / `Nomad_Camp` / `Villa` / `Delay` / `Promo`。

---

## A. Marchland（$5・勝利点・2024年3月）

### A-1. 英語カード文（現行の逐語）

> Worth 1 [VP] per 3 Victory cards you have (round down).
> ────────
> When you gain this, **+1 Buy**, and discard any number of cards for **+[$1]** each.

- **区切り線は1本**（生HTMLに `<hr style="width:66%;...">` が1つ。VP句と on-gain 句のあいだ）。
- Info：`Cost [$5]` ／ `Type(s) Victory` ／ `Purpose Kingdom Pile` ／ `Set Promo` ／ Illustrator: Eric J Carter。

### A-2. 版（Versions）＝**エラッタ無し・単一版**

English versions の行は**1行だけ**：

> Print ✓ / Digital ✓ / Text（上と同一）/ Changes: **First version** / Announced: — / Printed: **March 2024**

⇒ **旧文は存在しない**。「現行＝印刷済み最新」の方針でそのまま採用してよい。

### A-3. Official FAQ（逐語・全文）

> Marchland counts itself.
>
> Round down; if you have 11 Victory cards, each Marchland is worth 3 [VP].
>
> Use 8 copies of Marchland for games with 2 players, 12 for games with 3 or more players.
>
> "Any number" includes zero.

### A-3b. Other rules clarifications（逐語・全文）

> If you gain Marchland to your hand (such as via Artisan), it can be one of the cards you discard for +[$].

### A-3c. 参考＝Silk Road の Official FAQ（同型カードの逐語）

> Silk Roads count themselves.
> Round down; if you have 11 Victory cards, Silk Road is worth 2 [VP].
> Use 8 copies of Silk Road for games with 2 players, 12 for games with 3 or more players.

### A-3d. Secret history（設計意図＝実装判断の補強）

> This started in Hinterlands 2E, as a replacement for Silk Road. It doesn't fit in the update pack; Victory cards require 2 pesky extra cards. So it's a promo instead.
>
> The first attempt had "When you gain this, gain a Silver per card you've gained this turn" on the bottom, and it jumped from there straight to the final version. However then I also tried "1 [VP] per 2 Victory cards," and only letting you discard Victory cards but giving you +[$2] each.

⇒ **絹の道の後継**＝実装も `silk_road` の兄弟として書くのが正しい。

### A-4. ⚠ 実装で危ないところ

#### (a) 可変VP＝`silk_road` と完全同型・**除数だけ 4 → 3**
`js/engine.js` の `vpOf`（L.8887 付近）と `js/cpu.js` の `vpOfPlayer`（L.807 付近）の**両方**に1行ずつ足す。

```js
// engine.vpOf
const marchlands = cards.filter((c) => c === 'marchland').length;
if (marchlands) vp += marchlands * Math.floor(cards.filter((c) => DOM.isType(c, 'victory')).length / 3);
```
🛑 **cpu 側を忘れると hard CPU の終局読みが engine と乖離する**（§0-37 の実バグ③と同じクラス）。
🛑 **自身を数える**（`cards` は `allCards` なので自動的に含まれる＝絹の道と同じ）。
🛑 **端数切り捨て**（`Math.floor`）。
🛑 種別判定は `DOM.isType(c,'victory')`（静的でよい）。ただし**旭日の悟り(Enlightenment) は財宝→アクションの
置換なので勝利点判定には影響しない**＝`isTypeSupply` / 動的判定を使う必要は無い。

#### (b) 山の枚数＝**2人8／3人以上12** は自動で正しい
`initSupply`（`js/engine.js` L.1927）が
`kingdom.forEach((k) => (supply[k] = DOM.isType(k, 'victory') ? v : 10))`（`v = numPlayers <= 2 ? 8 : 12`）
としているので、`types: ['victory']` を付けるだけで公式どおりになる。**追加コード不要**。

#### (c) 獲得時トリガー＝**新 pending が1つ要る**（4点セット必須）
- 前例＝**倉庫(storeroom) の discard2 ステージ**（`STOREROOM_DISCARD` / `modalMultiHand` / CPU `p.hand.filter(isDead)`）。
  「好きな枚数を捨て、1枚につき +$1」は**まったく同じUI・同じ reducer 形**。
- ただし**倉庫はプレイ時**、Marchland は**獲得時**なので、**`state.pending` を直接立ててはいけない**。
  必ず **`state.onGainQueue` に積む**（PROGRESS §0-25／§0-26 の鉄則。直代入すると望楼などの獲得時窓を握りつぶす）。

```js
// triggerOnGain の中（forum の隣が自然）
if (cardId === 'marchland') {
  (state.onGainQueue = state.onGainQueue || []).push({ type: 'marchland_discard', player: pIndex });
}
```
🛑 **窓を開く前に `+1 Buy` を先に確定させる**（カード記載順が「+1 Buy, and discard…」）。
🛑 **手札0枚なら窓を開かない**（`+1 Buy` だけ出して終わり）＝候補ゼロの pending は CPU livelock／人間の詰みになる。
🛑 **0枚捨ても合法**（"Any number" includes zero）＝**必ず「確定（0枚捨て）」が押せる**モーダルにする
（`modalMultiHand(..., allowZero=true)` ＝倉庫と同じ第5引数 `true`）。

#### (d) 🛑 **「手札に獲得した Marchland 自身も捨てられる」**（Other rules clarifications）
`triggerOnGain(state, pi, card, dest)` は**カードを `dest` に置いた後**に呼ばれるので、
`dest === 'hand'`（職人 Artisan／彫刻家／出納官）なら Marchland は既に `p.hand` にある。
**窓の候補プールを「解決時の `p.hand` 全体」から読めば自動的に正しくなる**（フィルタを掛けないこと）。
⚠ 逆に「Marchland を除外する」フィルタを書くと**公式違反**になる。

#### (e) 🛑 捨て札は **`triggerOnDiscard` を必ず呼ぶ**
坑道(tunnel)＝金貨／進路(trail)＝使用／織工(weaver)／村有緑地(village_green) が誘発する。
⚠ **前例の倉庫(storeroom) は `triggerOnDiscard` を呼んでいない**（既存の横断簡略化）ので、**コピー元にしてはいけない**。
§0-31 の出荷済みバグ⑥（民兵／軍団兵／公共広場で坑道が空振り）と同じクラスの穴を新カードで作らないこと。
到達＝`mix:promo,hinterlands`（坑道）／`mix:promo,menagerie`（村有緑地）。
⚠ 捨て札トリガーが**入れ子の獲得**（坑道→金貨）を起こす＝`_gainDepth` が1段深くなる。既存ガードで安全。

#### (f) 🛑 **相手のターンに獲得したとき**（＝Villa の公式裁定と同じクラス）
Villa の Unofficial FAQ 逐語：

> If you gain this during another player's turn, you will put the Villa into your hand and get +1 Action, but will have no way to use that Action, since it is not your turn.

⇒ 公式は「**能力は誘発するが、そのボーナスは使い道が無いだけ**」。
一方このアプリは `t.buys` / `t.coins` が**手番プレイヤーの資源**なので、素直に書くと
**相手のターンに Marchland を獲得すると、相手に +1購入と +$ を献上する**（詐欺師 Swindler で $5 を廃棄させられた等で到達）。
**前例＝公共広場(forum)**（`js/engine.js` L.10423）：

```js
if (cardId === 'forum' && state.turn && pIndex === state.turn.active) { state.turn.buys += 1; ... }
```
→ **同じガード `pIndex === state.turn.active` を必ず付ける**。
【設計判断】そのうえで**捨て札の窓ごと自分の手番に限定する**のが実務的（＝相手のターンでは坑道が誘発しない＝
**許容簡略化として PROGRESS に明記**）。忠実にやるなら窓は開き、`addCoins` だけを手番判定でスキップする形になるが、
「相手のターンに自分の手札を捨てる pending」は UI／CPU／マスクの負担が大きい割に得るものが無い。

#### (g) 獲得フェイズの違い
- **アクションフェイズ獲得**（工房／職人／技術者）＝ +1購入と +$ は**そのまま購入フェイズへ持ち越される**（`t.buys`/`t.coins` はターン単位）＝公式どおり。
- **購入フェイズ獲得**（購入・意外な授かり物 等）＝そのまま使える。
- 🛑 **闇市場(BLACK_MARKET_BUY)経由**＝§0-11 で `triggerOnGain` が呼ばれるように直済み＝自動で働く。
  ただし闇市場は**アクションフェイズ**なので `t.treasuresLocked` は立たない（正しい）。

#### (h) CPU
- `GAIN_ORDER` に `marchland` を**必ず追加**（整合性テストが全カード網羅を要求＝入れないと即赤）。
  位置は `silk_road` の近く（勝利点ラッシュ札）。
- `decidePending` に `marchland_discard` 分岐＝`{ type: 'MARCHLAND_DISCARD', cards: p.hand.filter(isDead) }`
  （倉庫と同じ）。**`null` を返さない**こと。
- `evaluateKingdom` は promo＝既定のまま（変更不要）。

#### (i) カタログ／画像
- `js/cards.js`：`DOM.CARDS.marchland`（`cost: 5, types: ['victory']`）＋ **`DOM.POOLS.promo` に追加**（12→13）。
- `DOM.CARDS` 585→**586**。
- 日本語カード文の下書き（既存カタログの言い回しに正規化・区切り線は `\n————\n` ではなく既存流儀に合わせる）：
  > 自分のデッキの勝利点カード3枚につき 1 勝利点（端数切り捨て）。
  > ————
  > このカードを獲得したとき、+1 購入。その後、手札を好きな枚数捨て、1枚につき +1 コイン。
- **webp は `node tools/build-cards.js`（縦型・勝利点スキン＝緑）**。絵（`asset/art/marchland.png`）が要る。
- `sw.js` の VERSION を上げる。

### A-5. 日本語カード名 ⚠ **未確定＝要決定**

英語wiki の Other language versions に載っているのは **French「Confins」／German「Grenzregion」の2言語だけで、
Japanese の行は存在しない**（生HTMLで確認）。
⇒ **ホビージャパンの印刷版が無く、公式和名は英語wiki からは取れない**。
- 直訳＝「辺境（へんきょう）」「辺境地」「国境地帯」。ドイツ語 Grenzregion＝「国境地域」／フランス語 Confins＝「辺境」。
- 本プロジェクトの決定（§4-3）＝**日本語文面は Dominion Online 訳で統一**なので、**DO に日本語名があればそれが正**。
  🛑 **日本語wiki（wikiwiki.jp）で裏取りしてから確定すること**（私は叩けない。英語wiki の Japanese 行は
  そもそも無く、あっても実物と食い違う前例がある＝§0-31 の記録）。
- ⚠ **既存カード名との衝突チェック**：「辺境」系の名前は `border_village`（国境の村）と紛らわしい。
  `frontier` 系の和名は現在使われていないので id 衝突は無い（`grep` で `marchland` は0件＝安全）。

---

## B. Summon（$5・**イベント**＝横型ランドスケープ・2015年11月）

### B-1. 英語カード文（現行の逐語）

> Gain an Action card costing up to [$4]. Set it aside. If you did, then at the start of your next turn, play it.

- **区切り線なし**（生HTMLに `<hr>` は0本＝1段落の続き文）。
- Info：`Cost [$5]` ／ `Type Event` ／ `Set Promo` ／ Illustrator: Marco Primo。
- **これが 79個あるイベントのうち唯一のプロモ**（Event ページ逐語：`There are 79 Events, including 1 promo`）。
  ＝本アプリの現状78個（冒険20＋帝国13＋移動動物園20＋略奪15＋旭日10）にこれを足して**79で完備**。

### B-2. 版（Versions）＝**1回だけ言い回しの変更あり（機能差ゼロ）**

| Print/Digital | Text | Changes | Announced |
|---|---|---|---|
| ✓/✓ | Gain an Action card costing up to [$4]. Set it aside. **If you do**, then at the start of your next turn, play it. | First version | **November 2015** |
| ✓/✓ | Gain an Action card costing up to [$4]. Set it aside. **If you did**, then at the start of your next turn, play it. | Rephrased "if you do" to "if you did". | **February 2017** |

⇒ **現行＝2017年版「If you did」**。機能差は無いが、「did」＝**脇に置けたかを後から確認する**という
lose-track の意図を明示した文言（Secret history 参照）。**カタログ文は現行を採用**。

### B-3. Official FAQ（逐語・全文）

> When you buy this, you gain an Action card costing up to [$4] from the Supply and set it aside face up.
>
> If you did set it aside, then at the start of your next turn, play that Action card. This doesn't use up your default Action for the turn.
>
> In order to remember to play the card on your next turn, you may want to turn it sideways or diagonally, turning it right side up when you play it.
>
> If you move the Action card after you gain it but before you set it aside (e.g. by putting it on top of your deck with Watchtower from Dominion: Prosperity), then Summon will "lose track" of it and be unable to set it aside; in that case you will not play it at the start of your next turn.
>
> If you use Summon to gain a Nomad Camp (from the first edition of Dominion: Hinterlands), Summon will know to find the Nomad Camp on your deck, so you will set it aside in that case (unless you have moved it elsewhere via another ability).

### B-3b. Other rules clarifications（逐語・全文）

> The Summoned card is discarded during your Clean-up phase once its effects are resolved like a typical Action card, as it has been brought into play by the effect of Summon.
>
> If you are being Possessed, and the player to your right tells you to Summon a card, they gain the card, which does not get set aside, nor played at the start of their turn, instead staying in their discard pile.
>
> If you Summon a Hireling, you will draw a card when you play it, since it will still be the start of your turn.
>
> Summon will also fail to move a card if it moves away, and then moves back to the same place. For example, if you gain an Experiment, Exile it to Gatekeeper, then gain the second Experiment and discard the first Experiment from Exile, Summon will still fail to set aside the Experiment, even though it's still in your discard pile.

### B-3c. 関連ページの逐語（実装に直結する裁定）

**Nomad Camp ページ / Other rules clarifications**：
> An effect that tries to move Nomad Camp **after** it is gained (such as Summon) will successfully move it from your deck without losing track of it.

（同ページ Card text＝現行は **`This is gained onto your deck (instead of to your discard pile).`**
＝**「獲得先の置き換え」であって「獲得後の移動」ではない**。）

**Villa ページ / Other rules clarifications**：
> Because Replace and **Summon** try to move Villa **after** it is gained and then put into your hand, they will fail to move it.
>
> Unlike Ghost Town, Villa **visits** the place it is gained to before it moves itself to your hand.

**Delay ページ / Official FAQ**（開始時プレイの一般則）：
> Once you set aside the Action card, you have to play it at the start of your next turn.
> **If you do multiple things at the start of your turn, you can order them.**
> Playing the Action card at the start of your next turn does not use up an Action.

**Event ページ / Official rules**（イベント共通・逐語）：
> Buying an Event uses up a Buy; normally you can either buy a card, or buy an Event.
> **The same Event can be bought multiple times in a turn** if you have the Buys and [$] available to do it.
> You cannot play further Treasures that turn after buying an Event.
> Buying an Event is not buying a card and so does not trigger cards like [Haggler, Swamp Hag, or Charm].
> Costs of Events are not affected by cards like [Bridge or Flourishing Trade].

### B-3d. Secret history / Retrospective（実装意図の補強・逐語）

> It has an unusual wording to deal with some of the weird things that can happen in Dominion. There are various ways for the card to vanish (e.g. Watchtower), so to make sure you have the physical card around to tell you what to do next turn, it gets set aside and then makes sure it was.

> Summon could have changed the gain-destination of the card to set-aside-land, rather than gaining it and setting it aside. That would be way more wordy and confusing, just to improve a small number of interactions.

⇒ 🛑 **Summon は「獲得先を脇にする」ではない**＝**普通に獲得してから脇へ移す**（＝stop-moving の窓がある）。
これは **刈り入れ(Reap)** とは**違う**（Reap は `gain(..., 'eventSetAside')` ＝獲得先そのものが脇）。

### B-4. ⚠ 実装で危ないところ

#### (a) 🛑 同型は **刈り入れ(Reap) ではなく「せっかちな(Hasty)」／「急速拡大(Rapid Expansion)」**
| 機構 | 獲得先 | stop-moving の窓 |
|---|---|---|
| 刈り入れ(reap) | `gain(state, pi, 'gold', 'eventSetAside')` ＝**脇に直接獲得** | **無い**（望楼で盗めない） |
| **せっかちな(hasty)** | 普通に獲得 → `onGainQueue` の `hasty_aside` が `zoneOf(p, q.dest)` から脇へ移す | **ある**（動かされていたら失敗） |
| **Summon** | **hasty と同じ**（公式FAQが Watchtower を名指し） | **ある** |

→ **`js/engine.js` L.13492 の `hasty_aside` ハンドラをそのまま流用する**のが最短かつ正しい。
急速拡大が `source: 'rapid_expansion'` でログだけ分けた前例があるので、**`source: 'summon'` を足すだけ**で済む。

```js
// SUMMON_GAIN reducer の中（gain 成功後）
(state.onGainQueue = state.onGainQueue || []).push({ type: 'hasty_aside', player: pi, card, dest: 'discard', source: 'summon' });
```
🛑 **`gain()` を呼んだ後に push する**こと（FIFO なので望楼／青空市場／村有緑地などの獲得時窓が**先に**解決される
＝公式どおり「Watchtower が先に山札の上へ動かして Summon が失敗する」が自然に再現される）。

#### (b) 🛑 **既存バグを1件見つけた＝Hasty／Rapid Expansion × 遊牧民の野営地(Nomad Camp)**
公式＝**Summon（および同型の効果）は Nomad Camp を山札の上から見つけて動かせる**（上の逐語）。
理由＝現行の Nomad Camp は **`This is gained onto your deck`＝獲得先の置き換え**だから。

ところが本アプリの `nomad_camp` は **`triggerOnGain` の中で「獲得後に移動」させている**（`js/engine.js` L.10304）：
```js
if (cardId === 'nomad_camp' && dest !== 'hand') { const z = zoneOf(gp, dest); if (removeOne(z, 'nomad_camp')) { gp.deck.unshift('nomad_camp'); ... } }
```
⇒ `hasty_aside` は `zoneOf(p, q.dest)`＝**捨て札**を見るので `removeOne` が失敗し、**脇に置けない**。
- **今日到達する**：`mix:hinterlands,plunderexp:2:trait-plunder` で「せっかちな」が遊牧民の野営地の山に付くと発火。
  旭日の「急速拡大」×遊牧民の野営地でも同型。
- **Summon を足すと3例目**になる。
- **根治案**＝`nomad_camp` を**獲得先の置き換え**として実装する（`gain()` の `dest` 決定側で
  `if (cardId === 'nomad_camp' && dest !== 'hand') dest = 'deck';` にする）。**ゴーストタウン／悪人のアジト／
  守護者／夜警が既に「捨て札に獲得する場合だけ手札に置き換わる」形（§0-28）＝同じ流儀にそろえられる**。
  こうすると `q.dest === 'deck'` になり、Summon／Hasty／Rapid Expansion が3つとも自動で公式どおりになる。
  ⚠ 変更すると **ヴィラ(Villa)＝「獲得先を訪れてから手札へ移動する」との差**が正しく出る
  （公式：Ghost Town は置き換え／Villa は移動＝Summon は Villa に負ける）。回帰テスト必須。
- **回避案**（小さい）＝`hasty_aside` のフォールバックとして「`q.card === 'nomad_camp'` なら `p.deck` も探す」。
  ただし**カードidベースなので同名の別コピーを盗む危険**があり、根治案の方が安全。

#### (c) 🛑 支配(Possession) の扱い
公式：
> they gain the card, which does not get set aside, nor played at the start of their turn, instead staying in their discard pile.

本アプリの `gain()` は支配中、カードを `t.possessionGains`（脇）へ入れ、`triggerOnGain` を**支配者の席**で呼ぶ
（`js/engine.js` L.2767-2776）。したがって `hasty_aside` が誰の `dest` を見ても `removeOne` は失敗する＝**自然に公式どおり**。
🛑 ただし **「捨て札に同名の別コピーが偶然あると盗んでしまう」**（本アプリはカードidで管理＝インスタンス追跡が無い）。
→ **`SUMMON_GAIN` で `state.turn.possessedBy != null && pi === state.turn.active` なら aside を積まない**、
という明示ガードを入れるのが安全。

#### (d) 🛑 **獲得は強制・しかし候補ゼロなら窓を開かない**
「Gain an Action card costing up to $4」に "may" は無い＝**可能なら必ず獲得**。
- 述語は必ず **`costUpTo(state, id, 4)` ＋ `isTypeSupply(state, id, 'action')`**。
  🛑 **素の `cardCost <= 4` は禁止**（非サプライ＝賞品／戦利品／馬／成長先、ロック中の分割山下段、
  ポーション費用（`$4+P` は "up to $4" ではない）、負債コストを拾って本番 livelock になる）。
  `costUpTo` は既定で `pot:0, debt:0` なので3成分が正しく効く。
  🛑 種別判定は **`isTypeSupply`**（分割山・混合山の「一番上」で判定する。`DOM.isType` を使うと
  叙事詩(odysseys) や城(castles) の randomizer 種別で誤判定する＝§A2b の教訓）。
  🛑 **旭日の悟り(Enlightenment) 下では財宝もアクション**＝`isActionFor` 相当を使うべきか要検討。
  §0-37 の許容簡略化「悟りの for all purposes は主要4サイトだけ」に従うなら静的判定のままでよい（要 PROGRESS 明記）。
- **候補ゼロ**（$4以下のアクションのサプライ山が全部空／そもそも無い）なら
  **pending を立てない**（`anyGainable` でゲート）。人間の詰み／CPU livelock を防ぐ。
  ⚠ ただし**イベント自体は買えてしまう**（コストを払って何も起きない）＝公式どおり（買うのを止める理由が無い）。

#### (e) 🛑 **`ONCE_PER_TURN_EVENTS` に入れてはいけない**
Summon のカード文に `Once per turn:` は無い＝**1ターンに何度でも買える**（Event の一般則の逐語どおり）。
複数回買えば `p.eventSetAside` に複数枚たまり、次ターン開始時に**その枚数ぶん `event_play` が積まれる**
（`js/engine.js` L.9128 が `(p.eventSetAside || []).forEach(...)`）＝既存機構がそのまま対応済み。
⚠ **順序はプレイヤーが選べる**のが公式（Delay の FAQ）が、本アプリの `startQueue` は FIFO ＝**既存の許容簡略化**。

#### (f) 次ターンの使用まわり
- **アクション権を消費しない**＝`playCardNoAction`（既存 `EVENT_PLAY` がそう呼んでいる）✓。
- **場に出る**＝クリンナップで普通に捨てられる（Other rules clarifications 逐語）✓ `playCardNoAction` の既定挙動。
- **持続カードなら普通に持続する**✓。
- **雇人(Hireling) を Summon すると、使用した瞬間はまだ「ターンの開始時」なのでその場で1枚引く**
  （公式FAQ）。⚠ 本アプリは**永続持続の稼働数を開始時効果の解決後に増やす**（§P1b の既知の許容簡略化
  「尽きぬ杯をターン開始時に使用させると『現在』ぶんだけになる」）。**Summon はまさにその経路**なので、
  **PROGRESS の当該注記が「王子／船長／準備」に加えて「Summon」も対象になる**＝明記すること。
- **習性(Way)** も選べる（`EVENT_PLAY` は `action.way` を受け取る）✓。

#### (g) 🛑 インスタンス追跡が無いことによる乖離（許容簡略化として明記）
> Summon will also fail to move a card if it moves away, and then moves back to the same place.（Experiment × Gatekeeper の例）

本アプリはカードを **id** でしか管理していないので、「同じ場所に戻ってきた別インスタンス」を区別できず、
`removeOne(zone, id)` が**成功してしまう**（公式は失敗）。**mix-all 限定・極小**＝許容簡略化。

#### (h) 新 pending は **2種**（どちらも4点セット＝engine reducer＋`PLAYER_ACTIONS`＋CPU `decidePending`＋UI `viewPendingModal`）
| pending | 内容 | 前例 |
|---|---|---|
| `summon_gain` | $4以下のアクション1枚を強制獲得 | `bargain_gain` / `demand_gain`（移動動物園）／`hammer`（戦利品） |
| （`hasty_aside`） | **非対話**＝新規不要（既存を `source:'summon'` で流用） | 略奪の せっかちな／旭日の 急速拡大 |
| （`event_play`） | 次ターン開始時の強制使用 | **既存のまま**（遅延／刈り入れ／せっかちな が共有） |

- **CPU**：`decidePending` の `summon_gain` は **`null` を返さない**こと。
  `firstGainable(state, (id) => isTypeSup(state, id, 'action') && costUpTo(state, id, 4))` のフォールバックを必ず置く
  （`finishGain` は「候補があるのに null」を拒否する＝engine拒否×CPU提案で livelock＝§0-4 で実際に踏んだ形）。
- **CPU `bestEventBuy`**（`js/cpu.js` L.1147）に summon を足すかは任意。
  足さない場合は **CPUソークでこの経路が1度も通らない**（§0-37 の「CPU は旭日のイベントを3種しか買わない」と同じ構図）
  ＝**強制購入ソーク**で別途検証すること。
- **UI**：`summon_gain` は `modalGainSupply` で描く。**辞退ボタンは不要**（強制・候補ゼロなら窓を開かない）。

#### (i) 🛑 横型（ランドスケープ）としての配線＝**本アプリ初のプロモ・イベント**
1. `js/cards.js` の `DOM.LANDSCAPES` に追加：
   ```js
   summon: { name: '召喚', nameEn: 'Summon', kind: 'event', expansion: 'promo', cost: 5, debt: 0,
     text: 'コスト4コイン以下のアクションカード1枚を獲得し、脇に置く。\nそうした場合、次のあなたのターンの開始時、それを使用する。' },
   ```
   → `DOM.LANDSCAPES` 226→**227**／全体 811→**813枚**（Marchland 込み）。
2. **`DOM.EVENTS_PROMO` を新設**（既存が `expansion` フィルタで自動導出している形にそろえる）：
   ```js
   DOM.EVENTS_PROMO = Object.keys(DOM.LANDSCAPES).filter((id) => DOM.LANDSCAPES[id].kind === 'event' && DOM.LANDSCAPES[id].expansion === 'promo');
   ```
3. **`DOM.eventPoolFor`** に `if (expansion === 'promo') return DOM.EVENTS_PROMO || [];` を1行。
4. **`DOM.MIX_LANDSCAPE_POOLS`** に `'ev-promo': { label: 'イベント（プロモ）', get: () => DOM.EVENTS_PROMO || [] }`。
5. **`js/ui.js` のカード一覧**（L.957 付近）に `addL('イベント（プロモ・横型・購入フェイズに買う）', DOM.EVENTS_PROMO);`。
6. **webp** ＝ `node tools/build-landscape.js`（`kind:'event'` のスキン＝**茶褐色・コスト欄あり**が既にある
   ＝`tools/build-landscape.js` L.62 `event: { base: [122, 84, 40] }`）。**新スキンは不要**。絵 `asset/art/summon.png` が要る。

#### (j) 🛑 **プロモのイベントを抽選プールに入れるとどうなるか**（明確に決めること）
- **`MIX_LANDSCAPE_POOLS['ev-promo']`**：`landscapesForSet` が選択プールを1つの束にまとめて
  **合計 count（最大2）枚**だけ引く（`js/cards.js` L.2162-）ので、**他の横型プールと混ぜれば普通に薄まる**。
  🛑 **`ev-promo` を単独で選ぶと、束が1枚しか無いので `pickLandmarks(2, ['summon'])` は `['summon']` を返す**
  ＝**必ず Summon が出て、2枚目は出ない**（count=2 を指定しても1枚）。これは**バグではなく正常**
  （既存 `pickLandmarks` は `src.slice(0, n)` なので短い束でも落ちない）。UI の説明文で「1枚しかない」と分かるようにする。
- **CARD_SET への配線**：
  - 🛑 **既存の `promo-pack` / `promo2-pack` に `eventsFrom: 'promo'` を足すと、プールが1枚なので
    Summon が 100% 必ず出る**＝出荷済みセットの挙動が固定的に変わる。**別セット（例 `promo-events`）を新設する**か、
    **mix だけに配線する**のが安全。
  - `random-promo`（`randomFrom: ['basic','intrigue','promo']`）は**王国プールだけ**なので横型は出ない（現状どおり）。
- **横型は「合計2枚まで」に数える**（同盟の Ally・旭日の予言＝別枠、とは違う）。
  `landscapesForSet` が唯一の入口なので**自動的に守られる**。🛑 `eventsForSet` を単独で呼ぶ経路を作らないこと。
- **`state.events`** に入るだけ＝**非カード**。保存則 tally・`allCards`・庭園／品評会・「カード名を宣言」に数えない
  （Event ページ逐語：`Events are not considered "cards" at all`）。
- **イベント共通の副作用も自動で正しい**（既存 `BUY_EVENT`）：購入権を1消費／`t.treasuresLocked` が立つ／
  コスト軽減（橋・街道・盛大な取引）を受けない／購入時トリガー（値切り屋・沼の妖婆・御守り・商人ギルド）は誘発しない。

### B-5. 日本語カード名 ＝ **召喚（しょうかん）**

英語wiki の Other language versions に **Japanese 行があり**、印刷版 2015：

> Japanese ｜ 召喚 (pron. shōkan) ｜ コスト[$4]以下のアクションカード1枚を獲得する。そのカードを脇に置く。そうした場合，あなたは次のターンの開始時にそのカードを使用する。

⚠ **この行は実物と食い違うことがある**（§0-31 で夜想曲17枚が食い違った実績）。
とくに**読点が全角カンマ「，」**になっており、本アプリのカタログ流儀（「、」）と異なる＝そのまま貼らないこと。
🛑 **日本語wiki（wikiwiki.jp）で裏取りしてから確定すること**（決定D3＝Dominion Online 訳で統一）。
名前「召喚」自体は Marchland と違って**独立の証拠が1つある**ぶん信頼度は高い。

---

## C. 実装前に必読（この2枚に共通する罠）

1. 🛑 **「コスト$4以下」は必ず `costUpTo(state, id, 4)`**（3成分＝コイン／ポーション／負債）。
   素の `cardCost(state,id) <= 4` は非サプライ・ロック中の分割山下段・`$4+P`・負債コストを拾って**本番 livelock**。
   種別は **`isTypeSupply`**（混合山・分割山の一番上で判定）。
2. 🛑 **獲得時の対話は `state.pending` に直代入せず `state.onGainQueue` に積む**（Marchland の捨て札窓）。
   直代入すると望楼・青空市場・村有緑地などの獲得時窓を無言で握りつぶす。
3. 🛑 **獲得時の「+$」「+購入」は `pIndex === state.turn.active` でゲートする**（前例＝`forum` L.10423）。
   付けないと**相手のターンに獲得したとき相手に資源を献上する**。公式は「能力は誘発するがボーナスは使えない」（Villa FAQ）。
4. 🛑 **新しく「手札を捨てさせる」経路を書いたら必ず `triggerOnDiscard` を呼ぶ**（坑道／進路／織工／村有緑地）。
   前例の**倉庫(storeroom) は呼んでいない**のでコピー元にしてはいけない。
5. 🛑 **「獲得して脇に置く」は `gain(dest:'eventSetAside')` ではなく `hasty_aside` 型**
   （普通に獲得 → `onGainQueue` で `zoneOf(p, q.dest)` から移す）。
   前者（刈り入れ型）にすると **Watchtower / Royal Seal / Tracker で盗めなくなり公式違反**。
6. 🛑 **`q.dest` だけを探す**（§0-38 の進歩(Progress) の教訓）。探す場所を増やすと stop-moving の線引きが壊れ、
   **Villa（獲得後に手札へ移動＝Summon は負ける）／Ghost Town（獲得先の置き換え＝Summon は勝つ）**の差が消える。
7. 🛑 **遊牧民の野営地(Nomad Camp) は「獲得先の置き換え」が公式**（現行カード文
   `This is gained onto your deck (instead of to your discard pile).`）。
   本アプリは「獲得後の移動」で実装しており、**Hasty／急速拡大／Summon がすべて公式と逆になる**＝
   **今日 mix で到達する出荷済みバグ**。`gain()` の `dest` 決定側で置き換える形に直すのが根治。
8. 🛑 **`p.eventSetAside` は物理カード＝公開ゾーン**（`allCards`・`test/invariants.test.js` の `ZONES`・
   `zoneOf` に配線済み。`maskStateFor` は触らない＝伏せない）。Summon の FAQ も `set it aside **face up**`。
9. 🛑 **候補ゼロなら窓を開かない**（Marchland＝手札0枚／Summon＝$4以下のアクション山が無い）。
   Marchland の捨て札窓は **0枚確定が必ず押せる**こと（"Any number" includes zero）。
10. 🛑 **CPU `decidePending` で `null` を返さない**（`finishGain` は「候補があるのに null」を拒否＝pending が閉じず livelock）。
11. 🛑 **`GAIN_ORDER` に `marchland` を足す**（整合性テストが全カード網羅を要求）。**Summon は横型なので不要**
    （`DOM.CARDS` に入れない＝整合性テストにも闇市場デッキにも混ざらない）。
12. 🛑 **可変VPは engine の `vpOf` と CPU の `vpOfPlayer` の両方に足す**（片方だけだと hard CPU の終局読みが乖離＝§0-37 実バグ③）。
13. **client 資産（`js/`・webp）を変えたら `sw.js` の VERSION を上げる**（現在 v82）。


## 【この章の敵対検証（別エージェントが一次資料に当たり直したもの）】
⚠ **上の起草と食い違う場合はこちらが正**（起草より後に、同じページを取り直して照合している）。

Repo clean, temp files removed. Here is my adversarial verification.

---

# 敵対的検証レポート — Marchland / Summon

**方法**：`tools/wikidirect.js` で Marchland / Summon / Event / Nomad_Camp / Villa / Delay / Prince を**自分で逐次取得**し、生HTML（`RAW_DIR`）で `<hr>`・表の列構造・`colspan` まで確認。実装の罠は `js/engine.js` を grep し、**Hasty×遊牧民の野営地は node で実再現**した。

---

## 総評

**逐語は極めて正確**。FAQ の `<li>` を全件機械抽出して照合したところ、**Marchland 5件＋Other rules 1件、Summon 9件＝全15件が一字一句一致・取りこぼしゼロ・捏造ゼロ**。版・区切り線・実装参照（行番号を含む）もほぼすべて実在を確認した。とくに **Hasty × 遊牧民の野営地の出荷済みバグは実再現できた＝CONFIRMED**。

以下は**確定した訂正4件（うち1件は重要）**と**足りない項目6件（うち2件は着手前に潰さないと事故る）**。

---

## A. 確定した訂正

### A-1 ★重要 — Nomad Camp の根拠付けが誤り。かつ**カタログ文が2016エラッタ前で止まっている**（起草が見落とし）

**① 起草の記述**（B-4 (b)）
> 理由＝現行の Nomad Camp は **`This is gained onto your deck`＝獲得先の置き換え**だから。

**② 一次資料**（`Summon` / Official FAQ・第5項、逐語）
> If you use Summon to gain a Nomad Camp (**from the first edition of Dominion: Hinterlands**), Summon will know to find the Nomad Camp on your deck, so you will set it aside in that case (unless you have moved it elsewhere via another ability).

**③ 正しい記述**
この裁定は**第一版の文面（＝「獲得したとき山札の上に置く」＝獲得**後**の移動）を名指しして**「それでも Summon は成功する」と言っている。つまり **2016年の書き換えに依存しない裁定**であり、「置き換えだから成功する」という説明は逆立ちしている。根拠として引くべきは `Nomad_Camp` / Other rules clarifications の逐語：
> An effect that tries to move Nomad Camp **after** it is gained (such as Summon) will successfully move it from your deck **without losing track of it**.

**さらに起草が完全に見落としている事実＝Nomad Camp には2016年エラッタがある**（`Nomad_Camp` / English versions・3行）：

| Text | Changes | Announced / Printed |
|---|---|---|
| `+1 Buy +$2` **When you gain this, put it on top of your deck.** | First edition | October 2011 |
| `+1 Buy +$2` **This is gained onto your deck (instead of to your discard pile).** | **Clarified that the gained Nomad Camp doesn't visit the discard pile.** Increased font size. | Oct 2016 / Dec 2016 |
| （同文） | Formatting changes only. | October 2020 |

本アプリの `js/cards.js:411-412` は **2011年の第一版文面**（「このカードを獲得したとき、山札の一番上に置く。」）のまま。ページには `Deprecated official FAQ (2011)` 節まである。
⇒ 本プロジェクトの方針（現行＝印刷済み最新＋公式エラッタ）では**カタログ文を書き換え、`CARDS_ONLY=nomad_camp node tools/build-cards.js` で webp を焼き直す**必要がある。起草はこの1枚を「実装だけ直す」話にしていたが、**表示も直さないとカードが嘘をつく**。

**なお、起草が指摘したバグ自体は CONFIRMED**（自分で再現した）：

```
Hasty(せっかちな) を nomad_camp の山に付けて BUY:
  deck top: ['nomad_camp','copper'] | eventSetAside: []   ← 脇に置けていない
  対照（village）: eventSetAside: ["village"]              ← 正常
```
原因も起草のとおり：`hasty_aside` の push は `triggerOnGain` の L.10254、nomad_camp の topdeck は L.10304 ＝**同じ関数内で topdeck が先に走り**、キュー消化時に `zoneOf(p,'discard')` から `removeOne` が失敗する。到達は `mix:hinterlands,plunderexp:2:trait-plunder`（せっかちな）と旭日の急速拡大＝**今日の出荷経路**。

---

### A-2 — Villa の引用を「公式」と呼んではいけない

**① 起草**（B-4 (f) 末尾・および §C-3）
> ⇒ **公式は**「能力は誘発するが、そのボーナスは使い道が無いだけ」。／「公式は…（Villa FAQ）」

**② 一次資料**（`Villa` ページの節構成）
当該文は **`FAQ > Unofficial FAQ`** の中にある（`Official FAQ` 節は存在せず、`Deprecated official FAQ (2021)` / `(2016 2018)` が別にある）。起草自身が引用直前では「Villa の **Unofficial FAQ** 逐語」と正しく書いておきながら、結論行で「公式は」に格上げしている。

**③ 正しい記述**：「**非公式FAQ**（wiki）＝能力は誘発するがボーナスは使えない」。§0-29 A4（royal_galley）で「未印刷のアナウンス／Unofficial FAQ は採らない」と判断した前例があるので、**この区別は本プロジェクトでは実務上も効く**。
※起草がもう一つ引いた「Because Replace and **Summon** try to move Villa after it is gained…」は **`Other rules clarifications`** にあり、帰属は正しい。

---

### A-3 — Marchland の Versions 表：「Announced: —／Printed: March 2024」は不正確

**① 起草**（A-2）：`Changes: First version / Announced: — / Printed: March 2024`
**② 一次資料**：データ行の最終セルは `<td colspan="2">March&#160;2024</td>` ＝**Announced と Printed の2列にまたがる1セル**。
**③ 正しい記述**：「**2024年3月に告知＝印刷（単一版・エラッタ無し）**」。結論（エラッタ無し・現行1版）は変わらない。

---

### A-4 — Summon の日本語行を「印刷版 2015」と書けるだけの根拠は無い

**① 起草**（B-5）：「Japanese 行があり、**印刷版 2015**」
**② 一次資料**：`Summon` / Other language versions の Japanese 行は
`Name=召喚 (pron. shōkan)` ／ **Print セル・Digital セルとも空**（`<td><span style="white-space: nowrap;"></span></td><td></td>`）／`Notes=2015`。
比較のため `Prince`（日本語版が実在する promo）を取ったところ**同じく Print/Digital とも空**で、Korean だけ `File:PrinceKorean.jpg` の画像が入っていた ⇒ **この2列は「スキャン画像の置き場」であって発売フラグではない**。
**③ 正しい記述**：「英語wiki の Other language versions に日本語行あり（Notes=2015）。**Print/Digital 欄はスキャン画像用で、印刷の有無を示すものではない**」。
※起草が「この行は実物と食い違うことがある／全角カンマ `，` をそのまま貼るな／**jpwiki で裏取りせよ**」と釘を刺した点は正しく、そこは維持でよい。

---

## B. 足りていない項目

### B-1 ★着手前に決めないと事故る — `DOM.STAGE1_POOLS` が Marchland には**使えない**（起草に記載ゼロ）

`js/cards.js:1906` は現在 `DOM.STAGE1_POOLS = []`。`js/engine.js:2266-2267` は
```js
const stage1 = new Set([].concat.apply([], (DOM.STAGE1_POOLS || []).map((k) => DOM.POOLS[k] || [])));
```
＝**プール単位でしか除外できない**。Marchland を `DOM.POOLS.promo` に足すと `promo` は既に完全実装済みプールなので **STAGE1_POOLS で塞げない**。結果、**カタログだけ先に入れる（段階1）コミットを切った瞬間**に：

1. **闇市場デッキ**に「買っても何も起きない死に札」が $5 で並ぶ（`BLACK_MARKET_BUY` は `gainFromOutside` を通す＝L.16575 で確認済み）。
2. **`random-promo`**（`randomFrom: ['basic','intrigue','promo']`）の抽選母集団が **12→13**（`POOLS.promo` を実測）＝既存出荷セットの抽選分布が変わる。

⇒ **「カタログ＋engine を同一コミットで入れる」か、`DOM.POOLS.promo3 = ['marchland']` のような別プールを立てて `STAGE1_POOLS = ['promo3']` にする**かを先に決めること。PROGRESS §5/§6 が繰り返し名指ししている罠（§0-29 A5「STAGE1_POOLS は空になった。段階1の拡張を足したら必ずここに入れる」）に**そのまま該当する**。

---

### B-2 — Marchland の on-gain `+$1` が `applyCoinPenalty` を呼ばないと -$1トークンが空振りする

起草は `addCoins` にすら触れていない。`js/engine.js:1103` の `applyCoinPenalty(state)` は
「**コインが増えた直後に呼ばれる**」契約で、`playTreasureCard` 末尾・`COFFERS_SPEND`（L.14489）・山トークン `tk==='coin'`（L.4048）・`END_ACTION_PHASE`（L.1727）から呼ばれている。

- **-$1トークン（橋の下のトロル）**が未消化のまま購入フェイズに入り、
- **舞踏会(Ball)** は購入フェイズ中にトークンを渡す（L.1109-1112 の専用分岐がまさにその処理）

という状態で Marchland の捨て札 `+$` が入ると、**呼ばなければそのターンは食い込まない**（トークンは翌ターンへ持ち越すので消失はしないが、公式「次にコインを得るとき$1少ない」から逸脱）。
これは §0-9 で**確定バグとして修正済みの `COFFERS_SPEND` と完全に同型**。到達＝`mix:adventures,promo`。
⚠ 参考までに、起草がコピー元に挙げた **`STOREROOM_DISCARD`（L.16804-）は `addCoins` は使うが `applyCoinPenalty` を呼んでいない**＝**この点でも倉庫をコピー元にしてはいけない**（起草は `triggerOnDiscard` の欠落だけを挙げていた）。[low・忠実性]

---

### B-3 — Summon の UI 追加を強制している**テストの名前**が書かれていない

`test/empires-ui.test.js:245`
```js
ok($all('.landmark-mini img').length === Object.keys(DOM.LANDSCAPES).length,
  'カード一覧に横型カード（DOM.LANDSCAPES）が全部並ぶ');
```
⇒ `DOM.LANDSCAPES.summon` を足して **ui.js の `addL(...)` を忘れると即赤**。また `.landmark-mini img` は `asset/cards/summon.webp` を要求するので、**webp を焼く前にコミットすると `verify:e2e` の webp 404 検査も落ちる**。起草の手順（ui.js に1行／`build-landscape.js`）自体は正しいので、**「この2つはテストが強制する」**と書き足せば十分。

---

### B-4 — 「Summon で永続持続」は雇人だけではないが、**全部コスト軽減が要る**

起草は「雇人(Hireling) を Summon すると…」と平文で書いているが、実測：

| id | cost | 永続持続か（`permanentDurationCounts` L.925-934） |
|---|---|---|
| quartermaster | **$5** | ✓ |
| archive | **$5** | ✓ |
| hireling | **$6** | ✓ |
| samurai | **$6** | ✓ |

Summon は「up to $4」なので、**4枚とも 橋／街道／渡し船／安価な／盛大な取引 などのコスト軽減が無いと届かない**（champion は非サプライ・尽きぬ杯は $7 の戦利品＝そもそも対象外）。
起草が指摘した「開始時に使わせると当ターンぶんが出ない」既知の許容簡略化は**コードで裏取り済み**＝`p.hirelings` のドローは L.9108、`event_play` の startQueue push は L.9128 ＝**ドローが先**なので当ターンぶんは出ない。⇒ PROGRESS の当該注記は「王子／船長／準備」に **Summon** を足したうえで、**対象は雇人／操舵手／資料庫／侍の4枚・いずれもコスト軽減が前提**と書くのが正確。

---

### B-5 — 脇札の「表向き＝公開」が UI に出るのは自分のぶんだけ

公式 FAQ 逐語は `set it aside **face up**`。engine 側は正しく公開（`maskStateFor` は `eventSetAside` を伏せない・`test/invariants.test.js:28` の ZONES に登録済み・`allCards` L.8853）。
ただし `js/ui.js:1577` は **`me.eventSetAside` しか描いていない**＝相手の脇札が盤面に出ない。遅延／刈り入れ／せっかちな からの既存挙動なので Summon 固有ではないが、**Summon は「相手が次ターン何を撃ってくるか」が読みの核**なので、実装時に相手ぶんも出すかを決めておくべき（§0-37 で川船の脇札を「買う前に見えないと判断できない」として盤面に出した前例あり）。[low]

---

### B-6 — 細かい確認済み事項（起草に無いが、赤にならないことを実測で確認した）

- **資本主義(Capitalism)の財宝集合は変わらない**。Marchland のカタログ文には「+1 コイン」が入るが、`isCapitalismTreasure`（L.1049-1057）が `if (!DOM.isType(id,'action')) return false;` で弾く ⇒ `test/integrity.test.js` の固定集合は無傷。
- **山の枚数**：`initSupply` L.1940 `supply[k] = DOM.isType(k,'victory') ? v : 10`／`v = numPlayers <= 2 ? 8 : 12` ⇒ **追加コード不要**（起草の主張どおり）。
- **`pickLandmarks` は `src.slice(0,n)`** ⇒ 1枚しかない `ev-promo` を単独指定しても落ちない（起草どおり）。`landscapesForSet` が唯一の入口であることも production 呼び出し（`js/ui.js:5137`／`server/gameServer.js:354`）で確認。
- `MIX_LANDSCAPE_POOLS` へ `ev-promo` を足すとチップは `js/ui.js:554` が自動生成（10個目）。`test/invariants.test.js:451` が全プールを走査するので fuzz にも自動で乗る。**320px のチップ折返しは §0-16 実バグ③で `.seg.seg-wrap` 済み**だが `verify:visual` で再確認すること。

---

## C. 逐語・数値の照合結果（訂正なし）

| 項目 | 判定 |
|---|---|
| Marchland カード文・区切り線1本（`<hr style="width:66%...">` を生HTMLで確認） | ✅一致 |
| Marchland Official FAQ 4件＋Other rules 1件（`<li>` 全5件を機械抽出） | ✅**完全一致・取りこぼし0** |
| Marchland Versions＝1行・`First version`・エラッタ無し | ✅（A-3 の colspan のみ） |
| Marchland に **Japanese 行が無い**（`grep -c Japanese` = 0）／French `Confins`・German `Grenzregion` のみ | ✅（和名未確定の断定を避けた判断は正しい） |
| Marchland Secret history（Silk Road の後継） | ✅一致。加えて First announcement に **`Marchland (no relation to the month or expansion)`** ＝“March”は月ではなく「辺境(marches)」の意 ⇒ 和名「辺境」系という読みの傍証になる |
| Summon カード文・**区切り線0本**（ページ内唯一の `<hr>` はドイツ語 Notes セル内） | ✅一致 |
| Summon Official FAQ 5件＋Other rules 4件（`<li>` 全9件） | ✅**完全一致・取りこぼし0** |
| Summon Versions＝2行（`if you do` → `if you did`・Feb 2017・機能差なし） | ✅一致 |
| Summon Secret history / Retrospective（`gaining and setting it aside` を選んだ設計判断） | ✅一致 |
| `Event` ページ「There are **79 Events, including 1 promo**」＋イベント一般則5項 | ✅一致。実測でアプリは現在 **78**（帝国13＋冒険20＋移動動物園20＋略奪15＋旭日10）＝+Summon で 79 で完備 |
| `Delay` Official FAQ（開始時の順序は選べる／アクション権を使わない） | ✅一致 |
| `Nomad_Camp` Other rules clarifications | ✅一致（ただし A-1） |
| `Villa` Other rules（Replace/Summon は失敗）／Ghost Town との差 | ✅一致 |
| 実装参照：`silk_road` engine L.8887・cpu L.807／`forum` L.10423 のガード／`hasty_aside` L.13492／`STOREROOM_DISCARD` が `triggerOnDiscard` 未呼出／`modalMultiHand` 第5引数 `allowZero`／`costUpTo(state,id,coin,spec)` 既定 pot=debt=0／`isTypeSupply` L.90／`EVENT_PLAY`→`playCardNoAction(..., action.way)`／`ONCE_PER_TURN_EVENTS` に summon 不要／`event: {base:[122,84,40]}` + `WITH_COIN.event=true` | ✅**全件実在を確認**（存在しない前例カードidの捏造ゼロ） |
| 枚数：`DOM.CARDS` 585→586／`DOM.LANDSCAPES` 226→227／`POOLS.promo` 12→13／`marchland`・`summon` の id 衝突なし | ✅実測一致 |

---

## D. まとめ（実装着手前の TODO 差分）

起草に**足すべき**もの：

1. **Nomad Camp の 2016エラッタ**＝カタログ文を `This is gained onto your deck (instead of to your discard pile).` 相当へ書き換え＋**webp 再生成**（このPCのみ）。根拠は「第一版でも Summon は成功する」という Summon FAQ 第5項＋Nomad Camp の Other rules clarifications。
2. **`DOM.STAGE1_POOLS` では Marchland を塞げない**＝カタログと engine を同一コミットにするか、別プールを立てる（**B-1**）。
3. **Marchland の on-gain `+$` の後に `applyCoinPenalty(state)`**（**B-2**）。
4. Villa の引用を「Unofficial FAQ」と明記（**A-2**）。
5. Summon で届く永続持続は4枚・全部コスト軽減が前提（**B-4**）。
6. `test/empires-ui.test.js:245` が横型の一覧登録と webp を強制する（**B-3**）。

それ以外は**訂正なし**。逐語・FAQ・版の取りこぼしは1件も見つからなかった。
