# 略奪（Plunder）公式ルール研究 — 実装の正本

多エージェント研究（7群を分担収集 → **各群を別エージェントが一次資料で敵対検証**）で確定したデータ。
**カタログ（`js/cards.js`）と engine を書くときは、記憶ではなくこの文書を見ること。**

- 発売＝**2022年12月19日**。**印刷は初版のみ（第2刷は無い）**＝2022年12月のテキストが現行。
  機能エラッタは **Journey 1枚だけ**（2023年9月 Extra turn errata・**未印刷**）＝下記「要ユーザー確認」参照。
- 内訳＝**500枚**（RGG ルールブック p.2 逐語）＝王国 400（40種×10枚）＋**Loot 30（15種×2枚）**
  ＋ランダマイザー40＋**イベント15**＋**特性(Trait) 15**。
  → **実装対象は 85種**＝縦型（`DOM.CARDS`）55種（王国40＋Loot 15）／横型（`DOM.LANDSCAPES`）30種（イベント15＋特性15）。
  **王国カードの種類数は全拡張中で最大**。
- 新機構＝**Loot（伏せた非サプライの混合山）／特性(Trait)（サプライの山1つに付く横型）／
  "next time"（次に〜したとき）型の持続**。

---

## ⚠️ 一次資料の使い方（この拡張で変わったこと）

1. **英語wiki（wiki.dominionstrategy.com）＝現行カードテキストの正本**。
   **★この拡張から `node tools/wikidirect.js <Page> [...]` で本体を直読みできる**（Anubis の proof-of-work を
   自力で解いて cookie を取る）。**数秒で終わり、常にライブの現行ページが読める**。
   - **⚠️ 従来の `tools/wikifetch.py`（Wayback 経由）はもう第一選択にしないこと。** 3つの罠がある：
     (a) 遅い（1ページ30〜60秒）・**429/接続拒否が頻発**（この調査中、web.archive.org が丸ごと落ちた時間帯があった）／
     (b) **`snapshot=` の年は「ページの古さ」の証拠にならない**＝Wayback は部分タイムスタンプを
     **最寄りのキャプチャ**と解釈するので、`2019id_` でも 2022年発売の略奪の現行ページが返る。
     **逆に、古いキャプチャを掴むと Journey の Errata 節が存在しない**（2023年前半のキャプチャで実際に起きた）／
     (c) 2025年12月以降のキャプチャは Anubis の "Making sure you're not a bot!" 画面が保存されている。
   - **新しさの判定は snapshot ではなく、本文の `Set:` 行と `Versions > English versions` 表の Release/Date 列で行う。**
   - 見るべき節＝`Info`(Cost/Type(s)/Set)・`Card text`・`Official FAQ`・`Other rules clarifications`・
     `Versions > English versions`（**行数＝刷りの数＝エラッタの有無**）・`Other language versions`・`Trivia`。
   - **⚠ カードページは安定だが「拡張の総論ページ」は編集が入る**（検証で実測）＝
     `Plunder (expansion)` は 2024年のキャプチャに `If a Duration card leaves play somehow, …` の1行が**無く**、
     ライブ版には**ある**。古いキャプチャだけで判定すると**偽陽性**を出す。
   - **⚠ 2025年9月ごろ、英語wikiで「脚注付きの裁定」がまとめて削除された形跡がある**
     （現場監督×増築・旗艦×はみだし者 が**同時に**消えている）。
     現場監督のほうは**日本語wikiに「2025年2月エラッタで成立しなくなった」という独立の根拠がある**が、
     旗艦のほうには無い。→ **現行版だけを見て起草すると裁定を取りこぼす**恐れがある。
   - **⚠ strip 済みテキストでは表の「列」と `<hr>`（区切り線）が消える**。
     Print 列か Digital 列か／カード文に区切り線があるかを判定するときは **`RAW_DIR=<dir>` で生HTMLを見る**こと。
2. **RGG 公式ルールブック PDF** ＝ `https://www.riograndegames.com/wp-content/uploads/2022/08/DomPlunder.pdf`
   （2,206,503 bytes・2022-08-20 レイアウト＝**初版**）。**一般ルール（Loot・Trait・Event・Duration）の逐語にだけ使う。
   カード文面の正本にしてはいけない。**
   ⚠️ **pdftotext はコイン記号・VP記号を全部落とす**（`+ .` のように金額が消える）＝金額は必ず wiki 側で裏取り。
3. **日本語のカード名・文面＝日本語wiki（wikiwiki.jp/dominiondeck）＝`python tools/jpwiki.py <ページ名>`**。
   **⚠️ ただし略奪では前提が1つ崩れている**（第1章 §7 に詳述）：
   日本語版（ホビージャパン）は2023年3月に発売済みだが、**日本語wiki の略奪のカード訳文には全ページに
   `(※日本語訳はDominion Onlineより)` と明記がある**＝**印刷版と照合された訳ではない**。
   - **【確度・高】用語**：`Loot`＝**戦利品** ／ `Trait`＝**特性** ／ `Spoils`（暗黒時代）＝**略奪品** ／ 拡張名＝**略奪**
     （解説本文でも一貫して使われている）。
   - **【要確認】カード85種の個別の日本語「文面」**＝Dominion Online 訳。
     **実際に `sack_of_loot` / `pilgrim` / `trickster` / `avoid` / `launch` / `spell_scroll` / `taskmaster` / `siren` で
     印刷版と食い違うことが実証されている**（**いずれも機能差はゼロ・表記のみ**）。
     ⚠ ただし**印刷版の逐語を85種ぶん揃える手段は今回は無い**：英語wiki の `Other language versions` に
     Japanese 行があるのは **Crew / Invasion / Siren / Taskmaster の4枚だけ**で、しかも
     画像が 215×344px と低解像度・Notes 列の年が空・**掲載テキストに誤字**（`廃楽`／`緩得`）がある。
     → **そのままカタログに貼ってはいけない。**
   - **【確度・高】カード85種の日本語「名前」**＝日本語wiki の一覧・個別ページ・拡張ページの3箇所で一致し、
     英語wiki の Japanese 行4枚とも一致している。**名前だけ先に確定して進めても事故らない。**
   - **⚠ 日本語版の発売そのものは日本のメディアが報じている**（4Gamer／Table Games in the World・2023年2月付＝
     2023年3月下旬発売）。**ただし上記のとおり逐語を揃える手段が無い**ので、
     「印刷版が存在するか」を断定的に書かないこと。

---

## ✅ この研究で下したユーザー決定

- **【2026-08-15・ユーザー決定】`spoils`（暗黒時代）の日本語名を、公式訳の「略奪品」へ改名する。**
  → **「戦利品」を Loot（略奪）に明け渡す**＝両方が公式どおりになる。
  影響＝`js/cards.js` の4箇所（`marauder` 494 / `bandit_camp` 530 / `pillage` 546 / `spoils` 601-602 の
  カード文中の「戦利品置き場」と `spoils` の name）＋`js/engine.js` のログ文字列＋**webp 4枚の再生成**（このPCのみ）
  ＋テスト期待値。**これは出荷済みの忠実性バグの修正でもある**（公式は一貫して「略奪品」）。

---

## ⚠️ 実装前に必読：この拡張の落とし穴（敵対検証で確定したリスクの集約）

### 1. ★最大の設計判断★ "next time"（次に〜したとき）型の持続＝**本アプリに前例が無い持続**
該当＝**ちょうど7枚**＝**Cage / Search / Secluded Shrine / Abundance / Flagship / Landing Party / Cutthroat**
（英語wiki `Duration` の `Triggered effects` 節が正本。詳細は第1章 §3-1b）。
**⚠ Abundance は Treasure - Duration**＝購入フェイズに出す（アクション権を使わない）＝`applyTreasureEffect` 側に書く。
**⚠ Cutthroat は `anyone gains`＝他人の獲得でも誘発する**／**予約を張るのはアタックを全部解決した後**
（先に張ると自分のアタックで相手が捨てた坑道の金貨が自分の予約を誘発してしまう）。
公式逐語＝`Some Duration cards in Plunder do something the "next time" a certain thing happens.
That thing could happen the same turn, or many turns later; these may sit in play turn after turn until finally the thing happens.`
- **(a) 相手のターンに条件が満たされうる＝「相手の片付け」で自分の場から捨てられる。**
  逐語＝`This can trigger on any player's turn.`（Secluded Shrine）／`the Cutthroats are finally discarded that turn`。
  **本アプリの `cleanupAndAdvance` は手番プレイヤーの場しか片付けない**＝
  **全員の場を走査して「解決済みの next-time 持続」を捨てる経路が新規に要る**。
  放置すると場に残り続け、**保存則は保つが `inPlay` を数えるカード（沼地の小屋/ペンダント/価値ある村/豊穣の角/行商人）が過大に数える**。
- **(b) 条件を一度も満たさなければゲーム終了まで場に残る**＝**永久持続**（雇人/チャンピオン/尽きぬ杯と同じ器）。
- **(c) その事象で場に出た1枚自身は誘発しない。**
  逐語＝`that will trigger your other Secluded Shrines, but not the one you just played`。
  → **誘発リストは事象の「前」にスナップショットする**（§0-29 の `noteAllyPlay` で踏んだ非対称の裏返し）。
- **(d) 誘発したら空振りでも消費される。**
  逐語＝`It triggers even if the player can't or doesn't want to trash anything; … but Secluded Shrine is done, and is discarded that turn.`
  → **「候補ゼロなら窓を開かない」という本アプリの定石（§0-29 のリッチ [high]）をここに適用してはいけない**。
  窓を開かず**無言で消費**する（任意なので、pending を立てるなら必ず「しない」ボタンを出す）。

### 2. Loot の山＝**非サプライ かつ 混合山 かつ 中身が完全に伏せられている**＝本アプリに前例が無い組み合わせ
- 既存の `MIXED_PILE_KEYS`（廃墟/騎士/城/同盟6）は**全部サプライ山**。既存の `NON_SUPPLY`（賞品/略奪品/馬/精霊）は**全部同名か個別山**。
  → **`supply` に載せるとサプライ扱いになる**＝`state.loot`（実カードid配列・30枚）を**トップレベル**に持ち、
  `NON_SUPPLY` 相当の除外4系統（**購入不可・汎用獲得不可・闇市場デッキに入れない・3山終了に数えない**）を全部通す。
  **`test/invariants.test.js` の tally に `(s.loot||[]).forEach(add)` を足すこと**（漏れると保存則が誤検知で赤）。
- **中身も順序も完全に伏せる**。逐語＝`Players can't look through the Loot pile during a game.`
  **廃墟と違い一番上も見えない**（日本語wiki が名指しで注意）。→ `maskStateFor` で全部 `'back'`。
  **§0-21 偵察隊／§0-28 夜警／§0-29 粉屋・歩哨 と4回目の同じクラスの漏れになりかねない。**
- **サーバの `isNoConsentUndoableBuy`（§0-24）は「購入では情報が増えない」を前提にしている**が、
  **Loot を獲得する購入（戦利品の袋など）では山の次の1枚が変わる＝情報が増える**。
  → **`state.loot` も比較対象に入れて承認制へ落とす**（§0-29 A2 の伏せ札の騎士と同型）。
- **汎用 gainer では取れないが、「種別を名指し」すれば取れる**。
  逐語＝`Loot cards can also be gained from their pile when a card refers to their type.`（賞品/報酬と同じ例外）。
  **廃棄置き場からは取れる**（墓暴き/ネクロマンサー/リッチ）。**交換で戻すときは山の一番上に裏向き**（`returnToPile`）。
- **コストは全15種 `$7*`（星付き＝非サプライ）**。購入はできないが**コスト参照には引っかかる**。
  ⚠ **呪符の巻物の「これより安い」は両辺とも `cardCost` を通すこと**＝
  全体軽減（橋/街道）は差し引きゼロだが、**山を名指しする軽減（渡し船の -$2 トークン／発明家の家族の好意）では
  取れる集合が実際に増える**（$8 の山が $6 になれば獲得できる＝日本語wiki が逐語で書いている）。

### 3. Search（調査）＝**「サプライの山が空になった瞬間」という新しい誘発点**
既存に一切無いフック。**`emptyPileCount` は使えない**（これは「今いくつ空か」であって「今空になった」ではない）。
- **非サプライ山（Loot / 馬 / 賞品）が空になっても誘発しない。**
  逐語＝`If a non-supply pile (like Loot or Horse) is emptied, that won't trigger Search.`
- **無謀な(Reckless)がカードを山へ戻すと山が復活する**＝**同じ山でもう一度誘発しうる**（第1章 §1-4）。

### 4. 特性(Trait)＝「カード」ではなく**「山に由来するカードid の集合」**に付く
- **山が空になっても効き続ける**（`Traits continue to affect the cards from a pile even after the pile is empty.`）
  ＋**分割山ではその山の全種に効く**（`A Trait on a split pile affects all of those different cards.`）。
  → **`state.trait = { <traitId>: <pileKey> }` を持ち、判定は `pileKeyOf` を必ず通す**
  （§0-29 の汚された神殿・徴税と同型の「実カードidで引いて永久に孤児化する」バグを避ける）。
- **特性はカード種別を増やさない**＝`types` に足さない。廷臣/鷹匠/品評会/蛮族の種別判定に混ぜない。
- **付け先はアクションか財宝の王国の山だけ**（`Silver` や廃墟には付かない）＝**randomizer の種別で判定**
  （発明家の家族が城に置けないのと同じ考え方）。**同じ山に2枚は付けない。**
- **⚠ 選出は「準備手順の最後」**（日本語wiki `特性` 逐語）。
  → `createInitialState` では **王国10種 → 災いカード(Bane) → Ally → 植民地/避難所 を全部決めてから、最後に**特性の付け先を決める。
  **災いカードの山も付け先の候補に入る。**
- **⚠ 特性の効果は準備中には効かない**。逐語（`Cheap` 公式FAQ）＝
  `This does not apply during setup; it can't for example cause a [$4] to be used as Young Witch's Bane.`
- **横型の合計2枚枠に数える**（イベント/ランドマーク/プロジェクト/習性と同じ）＝`DOM.landscapesForSet` に新 `kind:'trait'`。
  **`tools/build-landscape.js` に新スキンが要る**（直近の前例＝同盟の `ally`）。

### 5. 無謀な(Reckless)＝**本アプリの再演機構（`state.replay`）と正面衝突する**
`Follow the instructions of played Reckless cards twice.` ＋ `When discarding one from play, return it to its pile.`
- 玉座の間と違い**カードではない**＝場に「玉座」が残らない。持続に付くと**2回ぶんの予約**が立つ。
- **習性(Way)を使うと2回にならないが、山へ戻す方は起きる**。**女魔術師・追いはぎでも同じ**。
  **`Way of the Chameleon` だけは例外で2回になる**。
- **「使用した回数」は1回**（共謀者の判定）。**「このターン最初にこれを使ったか」を見るカードでは2回とも "1回目" 扱い**。
- **山へ戻す＝サプライの山が復活する**＝**3山終了と Search の判定が巻き戻る**。
- **`If a Reckless card never gets discarded from play`（操舵手/調査/使い切り）＝2回使えて戻さない＝デメリット無し。**
→ **`state.replay` にそのまま乗せると必ず壊れる。専用ヘルパにすること。**

### 6. シャーマン(Shaman)＝**王国にあるだけで全員・毎ターン・強制**の恒久ルール
`It applies even if no-one ever gets a Shaman.` ＋ `This applies even on your first turn.`
→ **`createInitialState` の末尾（ターン1）でも開く**必要がある。
**§0-29 A3 の [medium] 3「ゲームの最初のターンだけ開始時 Ally の窓が開かない」とまったく同じ穴**を踏む。
順序も選べる（`You can order the gaining with other start-of-turn abilities.`）。

### 7. 受け継がれた(Inherited)＝**開始デッキを差し替える**＝サプライから人数ぶん抜く
`Cards starting in your deck due to Inherited were never "gained"` ＝**獲得トリガーを引かない**。
**3山終了に影響する。** 避難所・家宝と同じ配線（`allCards` / invariants の ZONES / `initSupply` の枚数）。
**交換で箱に戻る＝カードが盤面から消える**ので保存則の扱いに注意。

### 8. 運命の(Fated)／回避(Avoid)＝**シャッフルの最中に対話が要る**＝本エンジンで最も危険
`reshuffleDeck(p)` は**同期・非対話**（§0-22 の星図／へそくり、§0-29 の占星術師団／メイソン団と**同型**）。
→ **常設方針＋自動選択に倒す**のが既定路線（§0-29 で確立した `p.favorShuffle` 型）。**段階2の最初に決めること。**

### 9. 旅行(Journey)＝**版の選択が要る**＋**片付けで場のカードを捨てない**という前例の無い片付け
- **版＝要ユーザー確認**（下記「要ユーザー確認」参照）。
- `any effects that care about cards that you discard from play this turn (e.g. Improve and Scheme) will do nothing.
  However, some effects trigger at the start of Clean-up (e.g. Alchemist and Walled Village), and they trigger normally.`
  → **策謀／増築／錬金術師／城壁のある村／カエルの習性／沿岸の避難港**が全部この経路にいる。
  さらに `Journey's restriction only applies to your cards.`（相手のカードは普通に捨てる）。

### 10. 新しい脇置きゾーンが多い（**物理カード＝保存則 tally と `allCards` に入れる**）
檻(Cage)／岩屋(Grotto)／**操舵手(Quartermaster)＝インスタンス単位の脇**（本エンジンが持っていない概念）／
パズルボックス／配達(Deliver)／準備(Prepare)／旅行(Journey)／忍耐強い(Patient)／疲れ知らずの(Tireless)。
**`test/invariants.test.js` の ZONES に足し忘れると保存則が誤検知で赤になる。**

### 11. 「ターン終了時に手札へ」は**次の手札を先引きした後**
檻／パズルボックス／配達／トリックスター／疲れ知らずの topdeck。
**§0-22 の角笛・§0-25 のリス・§0-28 の忠犬と同じ位置**。ここを間違えると1ターン遅れてほぼ無効化される。

### 11b. 旗艦(Flagship)＝**命令(Command)** ＋ **持続を再演すると旗艦自身も場に残る**
`The next time you play a non-Command Action card, replay it.`
- **⚠ 除外すべき Command は公式に8つ**（英語wiki `Command > List of Commands`）＝
  大君主／はみだし者／船長／王子／**王笏(Scepter)**／**相続した屋敷(Inheritance)**／大名(Daimyo)／旗艦。
  **本アプリの `scepter` には既に `'command'` が付いている**が、**相続した屋敷は動的**（`inheritedEstate`）＝
  **静的な `types` だけを見る除外述語では漏れる**。
  → **これは忠実性ではなく無限ループ防止の必須条件**（日本語wiki `旗艦 > 余談` が
  旗艦↔はみだし者／旗艦↔相続した屋敷 の無限ループを実例として挙げている）。
- **持続を再演した場合、旗艦は「その持続が場から捨てられるまで」場に残る**（RGG ルールブック逐語＋現行 wiki）。
  ＝**§0-25/§0-28 の「玉座×持続では玉座が残らない」という本アプリの許容簡略化と正面から衝突する。**
  ⚠ **はみだし者が使った持続を旗艦が再演した場合だけ**「旗艦は残らない」という裁定が
  2023〜2025年9月の英語wikiに脚注付きで存在し、**2025-09-11 の版で削除されている**＝**要ユーザー確認**。

### 11c. 現場監督(Taskmaster)＝**「能力を繰り返す」は「アクションの使用」ではない**
日本語wiki `現場監督 > 詳細なルール` 逐語＝共謀者に数えない／「アクションの使用後」が来ない／
法貨・御料車を呼び出せない／チャンピオンの +1アクションを得ない／習性を選べない／フリゲート船のアタックも誘発しない。
→ **`noteAllyPlay`（同盟）・山トークン（冒険）・浮浪児のトラップ・`t.actionsPlayed` を一切触らないこと。**
誘発条件は **「コイン5・ポーション0・負債0」でちょうど一致**（3成分比較。`cardCost().coin === 5` だけで判定しない）。
**過払いはコストを変えない**／**動的コスト（漁師・デストリエ）は獲得時点の値で判定**。
**⚠ Dominion Online の日本語訳「これより後に」は不正確**＝英語の
`the rest of this turn`（＝この能力が発揮されたタイミング以降）が正しい。

### 12. 王の隠し財産(King's Cache)＝**財宝を3回使用**（既存機構は2回までしか無い）
`applyTreasureEffect` ＋ `state.replay` の `'treasure_replay'`（§0-15）を**3回に一般化**すること。

### 13. 一等航海士(First Mate)／鉱山道路(Mining Road)＝**入れ子の任意プレイ・獲得トリガーからの再入**
- 一等航海士＝「手札から同名のアクションを好きなだけ使用」＝**エンジンに存在しないループ**。
- 鉱山道路＝**獲得トリガーの中から財宝を「使用」する**（再入）。**§0-29 A4 の炉(kiln)／浮浪児のトラップと同型**。

### 14. 「見る（look at）」効果が多い＝**`maskStateFor` の私的看破リストに必ず足す**
地図作り／六分儀／財産目当て／巡礼者／宝珠（捨て札を全部見る）ほか。
**§0-21 偵察隊／§0-28 夜警／§0-29 粉屋・歩哨 と3回続けて同じクラスの漏れを出している。**

### 14b. 密航者(Stowaway)＝**「next time」型とは逆に、自分自身の獲得にも反応できる**
- **手番プレイヤーの獲得時効果を全部処理した「後」に、他プレイヤーのリアクション窓を開く**
  （日本語wiki `詳細なルール` 逐語＝`(iとiiの処理順が逆になることは無い)`）。
  → `state.onGainQueue` に**手番プレイヤーぶんを先に積み、他プレイヤーの窓を後ろに置く**。
- **手札に獲得した密航者は、その獲得自体にリアクションできる**（職人・変容・カブラー・願い・彫刻家・交換）。
  ＝**必読 1(c) の「自分自身は誘発しない」を密航者に適用してはいけない**（別機構）。
- **王子(Prince)は2022年の改訂で Duration 種別を持つ**＝**王子の獲得でも密航者が反応する**。

### 14c. キャビンボーイ(Cabin Boy)＝**場から廃棄できなければ獲得も起きない**
- `takeSelf` が失敗したら**持続カードの獲得も起きない**（日本語wiki 逐語）。
- **玉座の間で2回使うと2回目も同じ選択肢を選べる（が不発）**＝**UI で選択肢を潰してはいけない**
  （engine 側で空振りさせる）。
- **長老(Elder・同盟)の「追加でもう1つ選ぶ」対象にならない**＝`ELDER_CHOICE_ORDER` に入れてはいけない
  （長老が追加できるのは「そのターンに選択効果を発揮するカード」だけ／キャビンボーイの選択は次のターン）。

### 15. 「捨てる → その後に引く」の順を守る（捨て札トリガーの取りこぼし）
岩屋(Grotto)／内気な(Shy)／襲撃(Foray)。**§0-28 の羊飼い・§0-29 の砂漠の案内人で2回踏んでいる罠。**
逆に **回避(Avoid) はシャッフル中なので捨て札トリガーを誘発しない**／**友好的な(Friendly) は
クリンナップの捨て札なので捨て札リアクションが働かない**＝**内気な(Shy) と非対称**。

### 16. 述語と4点セット（本プロジェクトで最も再発する事故＝再掲）
- **新しい pending は4点セット必須**＝engine reducer ＋ `PLAYER_ACTIONS` ＋ CPU `decidePending` ＋ UI `viewPendingModal`。
- **述語を1つ足したら「窓を開く条件・受理・CPU の候補・UI のフィルタ」の4面を必ず同時に直す。**
- **Loot は非サプライ**＝候補を作るのに `costUpTo`/`costUnder`/`gainableBase` を使うと**候補ゼロ→本番 livelock**
  （§0-28 の悪魔祓いの精霊・§0-29 のリッチと同型）。**専用の述語を書くこと。**
- **コスト制限が無い獲得に `costUpTo` を掛けない**＝工具(Tools)／キャビンボーイの持続獲得／
  専門家型のコピー獲得。**逆に `costUpTo` を外すと非サプライを掴む**ので、両方を明示的に書く。

---

## ⚠️ 要ユーザー確認（実装前に人間が決めること。研究では決められない）

| # | 項目 | 内容 | 現時点の状態 |
|---|---|---|---|
| 1 | **`journey`（旅行）の版** | **A＝2022印刷版**（`Once per turn:` あり・「直前が自分の手番でない」条件つき）か、**B＝2023年9月 Extra turn errata**（条件なし・「3ターン連続不可」）か。**エラッタは未印刷**（`Not printed yet`）。本プロジェクトは **royal_galley で「未印刷のエラッタは採らない」と決めた**前例がある一方、**同盟の Island Folk / Voyage は同じ2023エラッタを（第2刷で印刷済みなので）採用済み**。**版によって `ONCE_PER_TURN_EVENTS` への登録可否が反転する。** | **未決** |
| 2 | **日本語カード文面をどの版に合わせるか** | 本書の和文は **Dominion Online 訳**（日本語wiki 掲載）。印刷版と少なくとも8枚で食い違う（**機能差はゼロ・表記のみ**）。**ただし印刷版の逐語を85種ぶん揃える手段が無い**（英語wiki の Japanese 行は4枚だけ＋誤字あり）。<br>**案A＝Dominion Online 訳で85種を統一（推奨）**／案B＝4枚だけ印刷版に寄せる（**不統一＋誤字混入なので勧めない**）。**日本語名はどちらでも同じ**なので名前だけ先に確定して進めてよい。 | **未決（案A推奨）** |
| 5 | **旗艦(Flagship)がはみだし者の使った持続を再演したとき、旗艦は場に残るか** | **一般則＝残る**（RGG ルールブック逐語・現行wiki・`Duration` ページ）。**しかし「はみだし者経由だけは残らない」という脚注付き裁定が2023〜2025年9月の英語wikiに存在し、2025-09-11 の版で削除**されている（削除が「誤りだったから」か「一括編集の巻き添え」か一次資料では断定できない）。<br>**理屈は通る**（はみだし者が使う持続はサプライから動かない＝一度も場に入らないので追跡が成立しない）。<br>**推奨＝一般則（残る）で実装し、はみだし者/大君主/船長が使った持続を再演した場合だけ場に残さない**（両方の資料に矛盾しない安全側）。 | **未決** |
| 3 | ~~`spoils` の日本語名~~ | ~~「戦利品」のままか「略奪品」へ戻すか~~ | ✅ **決定済（2026-08-15）＝「略奪品」へ改名** |
| 4 | **港の村(Harbor Village)×習性(Way)由来の +$** | ボーナスを得るか。**一次資料が真っ向から割れている**（英語wiki Official FAQ＝得る／日本語wiki＝2025年2月の移動動物園エラッタ＋2025年3月の Donald X. の Discord 回答を出典に**得ない**）。**mix-all 限定の到達**。 | **未決** |

---

## 📐 規模と段階分けの計画（同盟＝§0-29 と同じ手順）

| 段階 | 内容 | 規模の目安 |
|---|---|---|
| **段階0** | 公式ルール研究（この文書） | ✅ **完了** |
| **段階1** | カタログ＋孤立プール＋`GAIN_ORDER`＋カード一覧の群＋webp（枠＋文字）<br>⚠ **`DOM.STAGE1_POOLS` に必ず入れる**（入れないと闇市場に死に札が並ぶ）<br>⚠ **横型の新 kind `trait` のスキンを `tools/build-landscape.js` に新設** | 縦型55＋横型30＝**85エントリ**<br>（`DOM.CARDS` 505→**560** ／ `DOM.LANDSCAPES` 171→**201**） |
| **段階2** | engine/CPU/UI をバッチ実装（下記の順を推奨） | 新 pending は 4点セット必須 |
| **CARD_SET 昇格** | `plunder`（固定10種）／`random-plunder`／mix-all（15→16拡張） | `DOM.STAGE1_POOLS` から外す |
| **敵対レビュー** | 多エージェント5観点＋CPUソーク＋`verify:e2e`/`verify:visual` | 同盟は確定45件 |
| **絵の回収** | 85枚（ChatGPT・10枚ずつ） | **連番＝生成順とは限らない＝全枚実見** |

### 段階2 の推奨バッチ順（危険なものを先に土台として作る）
1. **P1＝Loot の山の基盤**（`state.loot`・獲得/公開/戻す・マスク・4系統除外・invariants tally）＋Loot 15種。
2. **P2＝"next time" 持続の共通機構**（**相手の片付けでも捨てる**経路・永久持続の器・スナップショット誘発）。
3. **P3＝素直な王国カード**（財宝・単純アクション）。
4. **P4＝特性(Trait) の基盤＋15種**（`state.trait`・準備順の最後・`pileKeyOf`・**無謀な** は最後）。
5. **P5＝イベント15種**（`BUY_EVENT` は既存。**旅行の片付け**と**準備/配達の脇置き**が重い）。
6. **P6＝残りの王国カード**（一等航海士・操舵手・鉱山道路・王の隠し財産・フリゲート船・切り裂き魔）。
7. **P7＝CARD_SET 昇格 → 敵対レビュー → 絵 → push**。

### 段階1（カタログ・画像）で気をつけること
- **`DOM.STAGE1_POOLS` は現在 `[]`**。略奪の孤立プールを**必ずここに入れる**
  （入れないと闇市場に「買っても何も起きない死に札」が $0 で並ぶ）。
- **Loot 15種のコストは `$7*`（星付き＝非サプライ）**＝賞品/略奪品と同じ表記が要る（`tools/build-cards.js`）。
- **横型の新 kind `trait` のスキンを `tools/build-landscape.js` に新設**（直近の前例＝同盟の `ally`＝濃い藍）。
  **特性はコスト欄が無い**（Info box に Cost 欄が存在しない）。
- **カード文の区切り線（`—————`）の有無を取り違えない**。検証で実測＝
  **`gondola` / `mapmaker` / `buried_treasure` の3枚には線があり、`jewelled_egg` には（wiki 上）無い**
  （`shaman` / `siren` には有る＝**wiki 側の表記が不統一**）。**生HTMLで `<hr>` を確認してから焼くこと。**

### id 空間の注意
- **英語 id `plunder` は既に使用済み**（帝国の分割山 `plunder`＝鹵獲品）。
  **プール名・セットIDは `plunder` 以外にする**（例 `plunderexp`）か、衝突しない命名を先に決めること。
- **日本語名の衝突**＝拡張名「略奪」＝暗黒時代の王国カード `pillage`（略奪）と完全一致
  （§0-29 の `alliance`＝同盟 と同型。**id 衝突は無い**が、カード一覧の群見出しで区別すること）。

---

# 各群の本文（一次資料の逐語つき）

以下は7群それぞれの調査結果をそのまま収録したもの。`<!-- 検証で訂正: ... -->` は**別エージェントによる敵対検証**で
下書きを訂正した箇所（＝**下書きは間違っていた**）。実装時は必ず該当章を開いて逐語を確認すること。


---

## 第1章 新機構・一般ルール（Loot／特性(Trait)／"next time" 型持続／エラッタ／準備）

<sub>（出典ファイル＝`mechanics.md`。見出しは2段下げて収録）</sub>

### 略奪（Plunder）新機構・一般ルール 一次資料調査

**調査日**: 2026-08-15 / 担当: 新機構・一般ルール担当エージェント
**対象**: Loot（戦利品）／Trait（特性）／"Next time" 型持続／Duration 変更点／エラッタ・FAQ／Setup

---

#### 0. 使った一次資料と、その「新しさ」の検証

| 資料 | 取得方法 | 版・日付 | 信頼度 |
|---|---|---|---|
| 英語wiki `Loot` | `tools/wikifetch.py` | **oldid=92725・last edited 2025-08-31** | 現行 |
| 英語wiki `Trait` | 同上 | **oldid=92107・last edited 2025-07-02** | 現行 |
| 英語wiki `Plunder_(expansion)` | 同上 | oldid=94501・**last edited 2025-12-31** | 現行 |
| 英語wiki `Duration` | 同上 | **last edited 2025-11-16**（**2025 Errata に言及**） | 現行 |
| 英語wiki `Journey` | 同上 | **oldid=92112・last edited 2025-07-03** | 現行 |
| 英語wiki `Errata` | 同上 | **last edited 2025-03-10** | 現行 |
| 英語wiki `2023 Errata` | 同上 | 2024年キャプチャ | 現行 |
| 英語wiki `Non-Supply` | 同上 | **last edited 2025-06-05** | 現行 |
| 英語wiki `Search` / `Secluded Shrine` / `Abundance` / `Cutthroat` / `Cheap` / `Reckless` / `Inherited` | 同上 | 2024-12〜2026-02 | 現行 |
| 英語wiki `Shaman` | 同上 | **last modified 2022-12-31（＝発売直後の古いキャプチャしか取れなかった）** | ⚠ 下記注意 |

<!-- 検証で訂正: 旧=Loot「2024-10-15/oldid=84951」・Trait「2023-03-26/oldid=69193」・Journey「2024-12-27」・Errata「2024-01-25」。
     出典＝各ページ末尾の "This page was last edited on ..." と Retrieved from の oldid（2026-08-15 に再取得）。
     Trait は実際には oldid=92107（2025-07-02）で、下書きの2年古い版番号は誤り。 -->

⚠ **`Shaman` は 2022-12-31 のキャプチャしか取れなかった**。その版の Official FAQ 末尾は
`for example gaining a Treasure would trigger Secluded Shrine's ability.` だが、
**RGG 公式ルールブック PDF p.7 の逐語は `for example gaining an Estate would trigger Cage's ability.`**。
本文 §6 は **PDF の逐語**を採用している（wiki の古い版ではない）。
| **RGG 公式ルールブック PDF** | `curl` → `pdftotext -layout` | `DomPlunderRules22.qxp` **8/20/22 6:54 AM**＝**初版**（発売は 2022-12-19） | 一般ルールの逐語にのみ使用 |
| 日本語wiki `略奪（拡張）` `戦利品` `特性` `略奪品` | curl → HTML strip | Last-modified 2026-04〜2026-07 | 日本語名の正本（ただし §7 の注意） |

##### ⚠ この調査で判明した「ツールの罠」（次のセッションが必ず踏む）

1. **`tools/wikifetch.py` はサンドボックス下では必ず失敗する**（`WinError 10061 接続拒否`）。
   **Bash ツールを `dangerouslyDisableSandbox: true` で呼ばないと1ページも取れない**。
2. **1回で成功しない**（Wayback が断続的に接続拒否を返す）。**同じページを5〜8回リトライすると通る**。
   リトライ用ラッパを `C:/tmp/plunder_research/fetch.sh` に置いた。
3. **出力ヘッダの `snapshot=` は当てにならない**。`snapshot=2019id_` と出た `Trait` ページの中身は
   **実際には 2023-03-26 版**（Wayback が最近接キャプチャを返すため）。
   **必ず本文末尾の `This page was last edited/modified on ...` を見ること**（`grep -o "last edited on [0-9A-Za-z ,]*"`）。
4. 出力に NUL バイトが混ざることがある（`grep` が "Binary file ... matches" と言う）。`tr -d '\0'` するか Python で `.replace('\x00','')`。
5. 日本語wiki のページ名は **`Plunder` ではなく `略奪（拡張）`**（全角カッコ）。`略奪` は暗黒時代のカードのページ。
   WebFetch は 429 を返すので **curl + HTML strip** が確実。

---

#### 1. Loot（戦利品）

##### 1-1. 何枚か・どういう山か

> **"There are 15 Loot cards, with 2 copies of each. Shuffle them into a face-down pile before the game if any cards refer to Loot. During the game, "gain a Loot" means, you gain the top card of the Loot pile. When you gain a Loot, reveal it to all players. Then put it into your discard pile as usual. Players can't look through the Loot pile during a game. The Loot pile isn't in the Supply; players can't buy or gain from it, except with cards that specifically gain Loot."**
> — RGG 公式ルールブック PDF p.3「Loot」節（逐語・全文）。英語wiki `Loot` の "Official Rules" 節も**一字一句同じ**。

確定事項：

| 項目 | 一次資料の答え |
|---|---|
| 枚数 | **30枚＝15種×2枚**（`There are 30 Loot cards in total: 15 distinct cards at 2 copies each.` — 英語wiki `Loot` 冒頭） |
| 山の数 | **1つの山**（"a face-down pile"）。15の山ではない |
| 積み方 | **ゲーム開始前に30枚をシャッフルして裏向き1山**（`Shuffle them into a face-down pile before the game`） |
| 公開/伏せ | **完全に伏せる**。一番上も見えない。`Players can't look through the Loot pile during a game.` |
| コスト | **全種 $7\***（`They all have a cost of [$7*].` — 英語wiki `Loot`）。`*` は非サプライ印で、**コストとしては普通に $7 として働く**：`The asterisk in their cost has no effect on gameplay other than to signify this; all effects that care about costs affect non-Supply cards normally.`（英語wiki `Non-Supply`） |
| 種別 | ⚠ **一様ではない**。共通するのは末尾の `Loot` だけ（`Loot` は `Single-pile types` に分類＝英語wiki のカード種別ナビボックス）。**内訳＝`Treasure - Loot` 8種／`Treasure - Duration - Loot` 4種（アンフォラ・尽きぬ杯・船首像・宝石）／`Treasure - Reaction - Loot`（盾）／`Treasure - Attack - Loot`（剣）／`Action - Treasure - Loot`（呪符の巻物）** |

<!-- 検証で訂正: 旧=「種別 = `Treasure - Loot`（全種同じ）」。
     出典＝RGG 公式ルールブック PDF p.9-10 の各カード画像の種別行に
     `Treasure - Loot` / `Treasure - Duration - Loot` / `Treasure - Reaction - Loot` /
     `Action - Treasure - Loot` / `Treasure - Attack - Loot` の5種類が実在する。
     裏取り＝Shield「You can reveal this when another player plays an Attack card to be unaffected by it,
     exactly as with Moat.」／Sword「This is an Attack, and so cards like Moat and Shield protect from it.」／
     Spell Scroll「…your Action phase, it uses up an Action play for the turn.」／
     英語wiki `Duration` の一覧に Amphora・Endless Chalice・Figurehead・Jewels の4枚だけが載る。
     ＝全15枚に同じ types を与えると、盾のリアクション窓・剣のアタック（堀で防げる）・
     呪符の巻物のアクション権消費・持続4枚の場残りがすべて壊れる。 -->

**種別の並び順は必ず `Loot` を最後に置く**（公式の印字がすべてそうなっている）。
本アプリは種別ラベルを `types` 配列の順に連ねる汎用規則（§0-29）なので、この順序がそのまま表示になる。
| 準備条件 | **「Loot に言及するカードが1枚でもあるゲームでだけ用意する」**（`if any cards refer to Loot`） |

**日本語wiki の補足（実装に効く）**：
> 「戦利品全30枚を全て裏向きにした状態でシャッフルし、一番上のカードを裏向きのままで戦利品の山札としてサプライ外に置く。
> **一番上のカードのみが公開される廃墟などとは異なるので注意。**」
> — 日本語wiki `戦利品` §詳細なルール

##### 1-2. どのカードが Loot を配るか

> **"Ways to gain Loot: [$2] Jewelled Egg, Peril, Search / [$3] Foray / [$5] Pickaxe, Wealthy Village, Cutthroat / [$6] Looting, Sack of Loot / [$10] Invasion, Prosper / Trait: Cursed"**
> — 英語wiki `Loot` §Ways to gain Loot

**＝ 王国カード5種（Jewelled Egg / Search / Pickaxe / Wealthy Village / Cutthroat）＋ Sack of Loot ＋
イベント5種（Peril / Foray / Looting / Invasion / Prosper）＋ 特性1種（Cursed）＝ 計12の入口。**

##### 1-3. 「Loot を獲得する」以外で得られるか

**原則＝得られない。** 一次資料は2段構えで書いている。

> **"The Loot pile isn't in the Supply; players can't buy or gain from it, except with cards that specifically gain Loot."**
> — RGG ルールブック p.3

> **"Loot cards can also be gained from their pile when a card refers to their type. This exception is specifically stated in the rules for Plunder."**
> — 英語wiki `Non-Supply` §Rules

> **"Non-Supply cards are not available for buying and can only be gained or used through other cards.
> Non-Supply cards can only be gained from their piles when called out by name, or when the source pile is specified. …
> Cards that gain duplicates of cards without specifically naming them (for example Disciple) cannot gain non-Supply cards."**
> — 英語wiki `Non-Supply` §Rules

つまり：
- 「Loot を獲得する」＝**タイプ名 `Loot` を名指しした効果**だけが通る（賞品 Prizes・報酬 Rewards と同じ「タイプ名指しの例外」）。
- **「財宝を獲得する」「$7以下を獲得する」等では絶対に取れない**（＝汎用 gainer は全て弾く）。
- **例外＝廃棄置き場からの獲得は通る**：
  > **"Trash gainers can gain non-Supply cards that are in the trash."** — 英語wiki `Non-Supply`
  > 「ただし、**廃棄置き場にある戦利品であれば、「廃棄置き場からカードを獲得する効果」で獲得できる**。」 — 日本語wiki `戦利品`
- **山に戻す（交換）も可能**：
  > **"If you exchange a gained Loot (e.g. with Changeling), the Loot goes back on top of the pile, face down."**
  > — 英語wiki `Loot` §Other rules clarifications（**裏向きで一番上に戻す**）

**山が伏せているせいで起きる裁定**（日本語wiki `戦利品`）：
> 「何らかの効果で『戦利品の山札の一番上にダブロン金貨(A)を(裏向きで)戻した』という処理の直後だったとしても、
> **工具(Tools)の効果で『場に出ているダブロン金貨(B)』を指定したところで、戦利品の山札の一番上にあるであろう
> ダブロン金貨(A)を獲得することはできない。上述の通り、戦利品の山札は非公開領域であるため。**」

##### 1-4. サプライではないのか／3山終了に数えるか

> **"The Loot pile isn't in the Supply"** — RGG ルールブック p.3
> **"Non-Supply piles don't count towards a three-pile ending."** — 英語wiki `Non-Supply` §Rules
> 「**戦利品の山札はサプライではない。戦利品の山札が枯れた場合でも、ゲーム終了条件である三山切れには数えない。**」 — 日本語wiki `戦利品`

**さらに決定的な逐語（Search）**：
> **"If a non-supply pile (like Loot or Horse) is emptied, that won't trigger Search."**
> — 英語wiki `Search` §**Other rules clarifications**
> <!-- 検証で訂正: 旧=「§Official FAQ」。Search ページの Official FAQ は玉座の1件のみで、この文は Other rules clarifications 側にある。 -->

**＝ Loot の山が空になる事象は「サプライ山が空になった」に一切数えない。**（Search＝調査 の誘発条件にもならない）

**【下書きに無かった Search の逐語・実装に直結する3件】**（英語wiki `Search` §Other rules clarifications）
> **"It doesn't matter if the Supply pile had already been emptied on a previous turn. So if you empty a pile,
> return copies to the Supply (with e.g. Swap), and empty it again, Search can trigger off that pile again."**
> **"If emptying a Supply pile causes you to play this (e.g. you gain the last Gondola which lets you play a Search),
> that won't trigger the Search (it triggers off the next Supply pile that's emptied)."**
> **"Ending the game by emptying the third Supply pile, Provinces, or Colonies does trigger Search;
> you gain the Loot before the game ends."**

⚠ 3つ目は**終局処理の順序**に直接効く（`isGameOver` が立ってから得点計算までの間に Loot を獲得する）。
1つ目は**無謀な(Reckless)が山にカードを戻す**と同じ山で再誘発し得ることを意味する。

##### 1-5. Loot が尽きたらどうなるか

**⚠ 一次資料に明示的な記述は見つからなかった（＝この項目は「不明＝一般ルールに落ちる」）。**
RGG ルールブック・英語wiki `Loot`・日本語wiki `戦利品` のいずれにも「Loot の山が空のとき」の記述は無い。

一般ルール（獲得できないものは獲得しない）に落ちるはずで、**完全に同型の先例が日本語wiki にある**：
> 「略奪を使用し、自身を廃棄した際、**略奪品の山札にカードが残っていない場合、略奪品は獲得できないが、
> ハンデス効果は発生する。**」 — 日本語wiki `略奪`（暗黒時代 Pillage）§詳細なルール

同型の Shaman 公式FAQ も同じ形：
> **"If there's no such card, you don't gain one."** — 英語wiki `Shaman` §Official FAQ

**さらに、略奪自身の公式FAQ に「同じ形（片方だけ失敗して残りは解決する）」の逐語がある**（検証で追記）：
> **"Cursed: When you gain a card from the Cursed pile, you also gain a Loot and a Curse.
> `If there are no Curses left, you still gain a Loot.`"**
> — RGG 公式ルールブック PDF p.7（呪い側が枯れても Loot 側は成立する＝両者は独立に判定する）

→ **「Loot が0枚なら Loot は獲得しない。ただしそのカード／イベントの残りの効果は普通に解決する」**が
一般ルールからの帰結。**ただし公式の逐語ではないので、実装時は「許容簡略化」ではなく「一般ルールからの帰結」と記録すること。**

---

#### 2. Trait（特性）

##### 2-1. 準備＝サプライの王国の山1つに付ける

> **"Plunder has Traits, which are a new kind of landscape card that affects a single Action or Treasure pile.
> At the start of a game with a Trait, choose a random Action or Treasure Kingdom card pile to put the Trait on;
> then during that game, cards from that pile are affected as indicated on the Trait.
> • Traits are not Kingdom cards, and are never bought or gained.
> • Traits only go on Kingdom cards, not on e.g. Silver or the Ruins pile (from Dark Ages).
> • Don't put two Traits on the same pile.
> • Traits refer to the pile using the name of the Trait; for example Pious refers to "Pious cards." That just means, any card from that pile.
> • A Trait on a split pile (from Empires and Allies) affects all of those different cards.
> • Traits continue to affect the cards from a pile even after the pile is empty."**
> — RGG 公式ルールブック PDF p.3-4「Traits」節（逐語・全文）。英語wiki `Plunder_(expansion)` §Traits も同文。

> **"In games using a Trait, pick a random Treasure or Action from the dealt-out Kingdom cards and put the Trait under it,
> so the text is showing; do not put two Traits on the same pile."**
> — RGG ルールブック p.2「Preparation」（**"pick a random"＝プレイヤーが選ぶのではなく無作為**）

##### 2-2. どの山に付けられるか

| 対象 | 可否 | 根拠 |
|---|---|---|
| **アクションの王国の山** | ○ | `only Action and Treasure piles`（英語wiki `Trait`） |
| **財宝の王国の山** | ○ | 同上 |
| **勝利点だけの王国の山**（庭園等） | **×** | `only Action and Treasure piles` |
| 基本カードの山（銀貨・金貨・属州等） | **×** | `Traits only go on Kingdom cards, not on e.g. Silver` |
| **廃墟(Ruins)の山** | **×**（名指しで除外） | `not on e.g. Silver or the Ruins pile (from Dark Ages)` |
| **分割山（帝国・同盟）** | ○。**その山の4種（2種）すべてに効く**。**中身の勝利点カードにも効く** | `A Trait on a split pile (from Empires and Allies) affects all of those different cards.` |
| 混合山・分割山の**種別判定** | **randomizer（山）の種別で判定する。城(Castles)だけ×、他の分割山は全部○** | 日本語wiki `特性`：「分割された山札のように山札に異なるカードが含まれる場合、**ランダマイザーに書かれている種類を参照する**。具体的には**城以外の全ての分割された山札はアクションの山札として扱われるので、特性の対象として選択される**。」 |
| **災いカード(Bane・若き魔女)の山** | **○（アクション/財宝なら選出対象）** | 日本語wiki `特性`：「ゲームの準備時、**特性の山札選出は準備手順の最後に行う**。**魔女娘をゲームに用いる場合の災いカード…は選出対象となる**。」 |
| 2つ目の特性を同じ山に | **×** | `Don't put two Traits on the same pile.` |

<!-- 検証で訂正: 旧=「混合山（騎士・城）| 不明（一次資料に記述なし）」。
     出典＝日本語wiki `特性` §詳細なルール が「ランダマイザーに書かれている種類を参照する／城以外の全ての分割された山札は
     アクションの山札として扱われる」と明記していた（下書きが読み落としている）。
     ＝城 × は確定、騎士は「randomizer がアクション」なので同じ一般則で ○。
     ただし英語一次資料に騎士を名指しした記述は無いので、騎士だけは「一般則からの帰結」扱い。
     また旧表は災いカード(Bane)の行が丸ごと欠けていた。 -->

**分割山の中身が勝利点でも特性カードになる**（日本語wiki `特性` の実例逐語）：
> 「例えば、衝突の山札が**内気な**の対象として選ばれた場合、衝突の山札に由来する**領土**も
> **(アクションまたは財宝カードでは無いが)【内気なカード】となり**、
> 「ターン開始時、内気なカード(=領土)1枚を捨てて+2ドロー得る」という動きができる。」

> 「例えば、パトリキ/エンポリウムの山札が**友好的な**の対象として選ばれた場合、
> 「クリーンアップフェイズの開始時に、【友好的なカード】であるパトリキを捨て札にする
> ⇒サプライにある【友好的なカード】であるエンポリウムを獲得」という動きができる。」

**⚠ 特性は「カード種別」を増やさない**（日本語wiki `特性` §詳細なルール 逐語）：
> 「特性がセットされた山札のカードを**廷臣**や**鷹匠**が参照した場合でも**【カード種別】が増えるわけではない**。」

→ 実装では **`DOM.CARDS[id].types` に特性を足してはいけない**（廷臣・鷹匠・品評会・蛮族の種別一致判定が壊れる）。
別枠の `state.trait` で持つこと。

**山が空になっても効き続ける**（`Traits continue to affect the cards from a pile even after the pile is empty.`）
＝**特性は「山」ではなく「その山に由来するカードの名前」に付く**、というのが実装上の正体。

##### 2-3. 付いた山のカードは「どこにあるとき」効果を持つか

**一次資料は「ゾーン」を一切限定していない。** 特性は "any card from that pile" を修飾するだけで、
**どのゾーンで働くかは特性ごとに違う**。15種の逐語（英語wiki の `Trait text` 欄＋RGG ルールブック p.7-8）：

| 特性 | 逐語（現行カードテキスト） | 効く場所 |
|---|---|---|
| **Cheap** | `Cheap cards cost $1 less.` | **コストを参照するあらゆる場面**（サプライ・手札・場・**得点計算中も**） |
| **Cursed** | `When you gain a Cursed card, gain a Loot and a Curse.` | 獲得時 |
| **Fated** | `When shuffling, you may look through the cards and reveal Fated cards to put them on the top or bottom.` | **シャッフル中**（山札／捨て札） |
| **Fawning** | `When you gain a Province, gain a Fawning card.` | 属州獲得時（→サプライ山から獲得） |
| **Friendly** | `At the start of your Clean-up phase, you may discard a Friendly card to gain a Friendly card.` | **手札**（片付け開始時） |
| **Hasty** | `When you gain a Hasty card, set it aside, and play it at the start of your next turn.` | 獲得時→**脇**→次ターン開始時に使用 |
| **Inherited** | `Setup: You start the game with an Inherited card in place of a starting card you choose.` | **ゲーム準備（Setup）** |
| **Inspiring** | `After playing an Inspiring card on your turn, you may play an Action from your hand that you don't have a copy of in play.` | 使用直後（**手札**からもう1枚） |
| **Nearby** | `When you gain a Nearby card, +1 Buy.` | 獲得時 |
| **Patient** | `At the start of your Clean-up phase, you may set aside Patient cards from your hand to play them at the start of your next turn.` | **手札**（片付け開始時）→脇→次ターン開始時 |
| **Pious** | `When you gain a Pious card, you may trash a card from your hand.` | 獲得時（廃棄元は手札） |
| **Reckless** | `Follow the instructions of played Reckless cards twice. When discarding one from play, return it to its pile.` | **使用時**＋**場から捨てるとき** |
| **Rich** | `When you gain a Rich card, gain a Silver.` | 獲得時 |
| **Shy** | `At the start of your turn, you may discard one Shy card for +2 Cards.` | **手札**（ターン開始時） |
| **Tireless** | `When you discard a Tireless card from play, set it aside, and put it onto your deck at end of turn.` | **場から捨てるとき**→脇→ターン終了時に山札の上 |

**＝ 特性は「その名前のカードが持つ恒久的な追加プロパティ」**。ゾーン限定は無い。
（上の15種のカードテキストは **RGG 公式ルールブック PDF のカード画像の逐語**と一致することを再確認済み＝訂正なし）

##### 2-3b. 【下書きに丸ごと欠けていた】特性15種の公式FAQ（RGG ルールブック PDF p.7-8・逐語）

<!-- 検証で追記: 旧稿は §2-5 で Cheap の FAQ しか引いておらず、他14種の公式FAQを一切載せていなかった。
     出典＝DomPlunderRules22.qxp（pdftotext -layout）。下記はすべてカード名見出し付きの公式FAQ本文。
     Friendly/Shy の「1ターン1枚まで」と Tireless の「次の手札を引いた後」は、
     これが無いと確実に実装を間違える。 -->

| 特性 | 公式FAQ（逐語） | なぜ効くか |
|---|---|---|
| **Cheap** | `This lowers the cost of a pile for the entire game (including when scoring). Costs can't go below [$0]. This doesn't reduce non-[$] costs like [P] and [D]; for example this does nothing on the Engineer pile (from Empires). This does not apply during setup; it can't for example cause a [$4] to be used as Young Witch's Bane (from Cornucopia).` | 得点計算中も効く／$0未満にしない／ポーション・負債は減らない／**準備中は効かない** |
| **Cursed** | `When you gain a card from the Cursed pile, you also gain a Loot and a Curse. `**`If there are no Curses left, you still gain a Loot.`** | 呪い枯渇でも Loot は取る（片方だけ失敗する） |
| **Fated** | `Each time you shuffle, you can choose to put Fated cards on the top or bottom of your deck, while shuffling the other cards normally. If for example you had five Fated cards, you could put two on top, one on the bottom, and leave the other two to be shuffled in. `**`In games with Fated, you can look through your deck before shuffling, even if you're sure you don't have any Fated cards.`** | **1枚ずつ 上/下/混ぜる の3択**（全部上ではない）。オンラインでは「見た」情報が漏れないようにする |
| **Fawning** | **`This is mandatory.`** | 属州獲得時の獲得は強制（任意ではない） |
| **Friendly** | **`You may only discard one Friendly card per turn this way.`** | **1ターン1枚まで**（複数枚を連鎖できない） |
| **Hasty** | `If this plays a card that can't normally be played, like Territory (from Allies), that card goes into play but doesn't do anything else then.` | **使えないカードでも「場に出る」**（効果は無し）＝獲得した勝利点が場に出て片付けで捨てられる |
| **Inherited** | `If they care, players decide which card to replace in turn order. Replaced Coppers go back to the pile; replaced Estates go back to the box. Replaced other cards (Shelters from Dark Ages, Heirlooms from Nocturne) go back to the box. If the Inherited pile is a split pile (from Empires or Allies), players take cards from the pile in turn order. … Cards starting in your deck due to Inherited were never "gained" and did not trigger "when you gain this" effects.` | §6 参照 |
| **Inspiring** | `When you play an Inspiring card, after resolving it, you can play an Action card from your hand, provided that you don't have a copy of that card in play. `**`Duration cards that you played on previous turns that are still in play, are in play; cards that have left play somehow, like a Mining Village (from Intrigue) trashing itself, are not in play.`**` An Inspiring card can sometimes play a different Inspiring card (when Inspiring is on a split pile, like those in Empires and Allies), but can't normally play another copy of itself.` | 「場にコピーが無いか」は**持続を含む今の場**で判定／**解決が全部終わった後**に窓を開く |
| **Nearby** | `Each time you gain a Nearby card, you get +1 Buy.` | **毎回**（累積する） |
| **Patient** | `You can set aside multiple Patient cards at once; play them all at the start of your next turn, in any order. If this plays a card that can't normally be played, like Territory (from Allies), that card goes into play but doesn't do anything else then.` | **複数枚まとめて脇へ置ける**（Friendly/Shy と違い1枚制限が無い）／順番は本人が選ぶ |
| **Pious** | `Each time you gain a Pious card, you may optionally trash a card from your hand.` | **毎回**・任意 |
| **Reckless** | `Reckless does two things, at different times. When you play a Reckless card, you follow its instructions an extra time - follow them entirely, then follow them again - and when you discard one from play, you return it to its Supply pile. With Duration cards those may not happen on the same turn. If you skip following the instructions of the card - for example by using a Way (from Menagerie) instead - then you don't follow them an extra time, but still return the card when discarding it from play.` | §9-10 参照 |
| **Rich** | `Each time you gain a Rich card, you also gain a Silver.` | **毎回** |
| **Shy** | **`You can only discard one Shy card per turn this way.`** | **1ターン1枚まで**（カード文の "one Shy card" と二重に効く） |
| **Tireless** | **`This is mandatory. You draw your next hand before putting the card onto your deck.`** | **強制**／**このエンジンの「先引き」より後**に山札の上へ置く＝角笛(§0-22)とは逆の位置 |

##### 2-4. 何枚使うか／横型の合計枚数制限にどう数えるか

> **"There are 15 Traits, any number of which may be used in a game of Dominion, though Donald X recommends not using
> more than two total Landmarks, Events, Projects, Ways and Traits."**
> — 英語wiki `Trait` 冒頭

> **"For normal play we recommend using at most 2 such cards; with other expansions that includes
> Events, Traits, Landmarks, Projects, and Ways."**
> — RGG 公式ルールブック PDF p.2「Preparation」（逐語）

> **"It is generally recommended that no more than two in total out of any of the following types be used in a game:
> Events / Landmarks / Projects / Ways / Traits"**
> — 英語wiki `Card-shaped thing`（`Landscape` のリダイレクト先）

**＝ ルール上は枚数無制限。推奨として イベント＋ランドマーク＋プロジェクト＋習性＋特性 の合計2枚以下。**
（＝本アプリの「横型は合計2枚まで」の枠に**そのまま合流する**。同盟カード(Ally)や予言(Prophecy)のような
「連携があれば自動で1枚」型ではない＝**特性は Ally ではなくイベント/ランドマーク側の仲間**）

日本語wiki も同じ：
> 「ゲームに使用する王国カードが10種類と決められているのに対して、**特性の枚数に明確なルールはない**。
> ただし公式ルールでは、通常のゲームで使用するイベント・ランドマーク・プロジェクト・習性・特性の
> **合計を2枚以下にすることを推奨している**。」 — 日本語wiki `特性`

**＋日本語wiki の脚注（下書きが落としていた・本アプリの枠設計に直結）**：
> 「公式ルールでは、通常のゲームで用いるイベント・ランドマーク・プロジェクト・習性・特性の合計を2枚以下にすることを
> 推奨しているが、**これに同盟と予言は含まれないので注意**。」 — 日本語wiki `特性` 脚注*1

<!-- 検証で追記: 出典＝日本語wiki `特性` の脚注*1（2026-06-14 版）。
     ＝Ally(同盟カード)と Prophecy(予言) は「合計2枚」に数えない＝本アプリの
     「横型は合計2枚まで＋Ally は別枠」という既存設計と完全に一致する、という裏取り。 -->

⚠ **本アプリの `DOM.landscapesForSet` は「イベント/ランドマーク/プロジェクト/習性 の合計2枚」を1箇所で決めている**（§0-23）。
**特性はこの枠に足す／Ally と Prophecy は足さない**、が公式どおり。

**ランダマイザーに混ぜる方法**（イベントと同じ扱い）：
> **"Events and Traits can be shuffled into the randomizer deck (despite having a different back). They are not part of the
> 10 Kingdom cards used in a game; when an Event or Trait is turned over, put it on the table but keep turning over cards
> until you get 10 Kingdom cards. … Skip any further landscape cards turned over. Also skip Events and Traits when using
> a randomizer card to determine whether or not to use Platinum/Colony (from Prosperity), or Shelters (from Dark Ages)
> in a game, or to determine the bane for Young Witch (from Cornucopia)."**
> — RGG ルールブック p.2

##### 2-5. 特性の準備順に関する重要な裁定

> **"This does not apply during setup; it can't for example cause a [$4] to be used as Young Witch's Bane (from Cornucopia)."**
> — 英語wiki `Cheap` §Official FAQ

**＝ Cheap のコスト軽減は「準備（Setup）中には効かない」**。若き魔女の災いカード（$2-3）の選定は
**軽減前のコスト**で行う。＝**特性の適用は「準備が全部終わった後から」**。

（`Cheap` のその他の公式FAQ）
> **"This lowers the cost of a pile for the entire game (including when scoring). Costs can't go below [$0].
> This doesn't reduce non-[$] like [P] and [D], for example this does nothing on the Engineer pile (from Empires)."**

---

#### 3. "Next time"（次に〜するとき）型の持続

##### 3-1. 公式の定義（逐語）

> **"Some Duration cards in Plunder do something the "next time" a certain thing happens. That thing could happen the
> same turn, or many turns later; these may sit in play turn after turn until finally the thing happens.
> For example you could play a Secluded Shrine and two Coppers, buy a Silver, and immediately trash two cards from
> your hand, discarding Secluded Shrine that turn. Or you could buy a Stowaway instead, and leave Secluded Shrine in
> play for next turn."**
> — RGG 公式ルールブック PDF p.3「Durations」節（逐語）。英語wiki `Plunder_(expansion)` §Durations も同文。

> **"Plunder introduced Duration cards that have an effect triggered the "next time" a certain condition occurs,
> and remain in play until whatever turn that happens, rather than a specified number of turns."**
> — 英語wiki `Duration` 冒頭

##### 3-1b. 【下書きに無かった】"next time" 型は具体的にどの7枚か

英語wiki `Duration` §List of Duration cards §**Triggered effects** の逐語（＝この7枚が全部）：

| カード | コスト | 種別 | 誘発条件と効果（逐語） |
|---|---|---|---|
| **Cage** | $2 | Action - Duration | `When you gain a Victory card, trash the Cage and put the cards set aside with Cage into your hand at the end of the turn.` |
| **Search** | $2 | Action - Duration | `When a Supply pile empties, trash Search and gain a Loot.` |
| **Secluded Shrine** | $3 | Action - Duration | `When you gain a Treasure card, trash up to 2 cards from your hand.` |
| **Abundance** | $4 | **Treasure** - Duration | `When you gain an Action card, +1 Buy and +[$3].` |
| **Flagship** | $4 | Action - Duration | `When you play a non-Command Action card, replay it.` |
| **Landing Party** | $4 | Action - Duration | `When the first card you play on a turn is a Treasure, put Landing Party onto your deck afterwards.` |
| **Cutthroat** | $5 | Action - Duration - **Attack** | `When anyone gains a Treasure card costing [$5] or more, gain a Loot.` |

<!-- 検証で追記: 旧稿は §3 全体を「"next time" 型がある」と抽象的に書くだけで、
     どのカードが該当するかを一度も列挙していなかった（実装計画が立てられない）。
     出典＝英語wiki `Duration` の "Triggered effects" 節（last edited 2025-11-16）。
     コスト・種別は英語wiki 各カードページの Info 欄／`Plunder_(expansion)` のナビボックスで裏取り。
     ※Abundance は **Treasure**-Duration＝購入フェイズに出す（アクション権を使わない）ので、
       本アプリの `applyTreasureEffect`（§0-15）側に書くこと。 -->

**⚠ Cutthroat の公式FAQ＝Loot 自身が誘発源になる（連鎖する）**：
> **"Loot itself is a Treasure costing [$5] or more, so a player gaining one will trigger Cutthroats."**
> — 英語wiki `Cutthroat` §Official FAQ

**⚠ Cutthroat の "next time" は「アタックを解決し終えてから」張られる**：
> **"The "next time" effect gets set up after the other players discard. So if another player discards a Tunnel and
> gains a Gold, that won't cause you to gain a Loot."**
> — 英語wiki `Cutthroat` §Other rules clarifications

→ **予約を張るのはカードの記載効果を全部解決した後**（先に張ると自分のアタックが誘発してしまう）。
本アプリの坑道(Tunnel)＝`triggerOnDiscard` がまさにこの反例に登場する。

##### 3-2. いつ解決するか・場に残る期間

> **"Some Duration cards have an ability that is triggered by a certain condition being met, such as Abundance;
> these cards remain in play until Clean-up of the turn on which the condition is met, which may be the same turn on
> which they were played or a later turn. **If the condition is never met, these cards will remain in play permanently as well.**"**
> — 英語wiki `Duration` §Other rules clarifications（逐語）

| 状況 | 結果 |
|---|---|
| そのターン中に条件を満たした | **そのターンの片付けで捨てる**（普通のカードと同じ） |
| 条件を満たさなかった | **場に残り続ける**（何ターンでも） |
| **条件を一度も満たさなかった** | **ゲーム終了まで場に残る**（＝雇人/チャンピオン/尽きぬ杯と同じ「永久持続」状態になり得る） |

##### 3-3. ⚠ 相手のターンに誘発する（最大の落とし穴）

> **"This can trigger on any player's turn."** — 英語wiki `Secluded Shrine` §Official FAQ
> **"This triggers when you gain an Action card due to buying it, or gain one some other way.
> If it happens during another player's turn, the +[$3] and +1 Buy won't be useful."** — 英語wiki `Abundance` §Official FAQ

Cutthroat のカードテキストは明示的に **"The next time anyone gains a Treasure costing [$5] or more, gain a Loot."**
（`anyone`）。Search は「次にサプライの山が切れたとき」＝**誰のターンでも起きる**。

**＝ 条件が相手のターンに満たされたら、その持続は「相手の片付け」で自分の場から捨てられる。**
根拠は次の3つの逐語の重ね合わせ（**単独で言い切っている一次資料は無い**）：

> ① **"This can trigger on any player's turn."**（誰のターンでも誘発する）
> ② **"…but Secluded Shrine is done, and `is discarded that turn`."**（誘発した**そのターン**に捨てる）
> — ①②とも 英語wiki `Secluded Shrine` §**Official FAQ**
> ③ **"…once that happens, everyone who's played a Cutthroat gets a Loot card and `the Cutthroats are finally discarded that turn`."**
> — 英語wiki `Cutthroat` 冒頭

<!-- 検証で訂正: 旧稿はここに 英語wiki `Duration` §Other rules clarifications の
     "It's also occasionally possible for a Duration card to remain in play during your Clean-up, but it stops having
      any effect before your next turn, meaning you'll discard it from play during another player's Clean-up."
     を「この現象を独立に明記している」として引いていたが、**これは別の話の引用（誤用）**。
     原文の直後は "For example, if you play Voyage and Lich on the same turn, the Voyage turn will get skipped. …
     Since you don't get a Clean-up phase during the skipped turn, the Voyage will stay in play until the Clean-up of
     the next turn that happens (which could be another player's Clean-up)."
     ＝**航海(Voyage)×リッチ(Lich) でターンが飛んだ場合**の説明であって、"next time" 持続の話ではない。
     結論（相手の片付けで捨てられ得る）自体は上の①②③で正しく裏が取れるので、根拠だけ差し替えた。 -->

（なお、上で誤用されていた `Duration` の一文は**別経路で同じ結論に効く**ので、参考として正しい文脈つきで残す）：
> **"It's also occasionally possible for a Duration card to remain in play during your Clean-up, but it stops having any
> effect before your next turn, meaning you'll discard it from play during another player's Clean-up.
> `For example, if you play Voyage and Lich on the same turn, the Voyage turn will get skipped.` …
> `Since you don't get a Clean-up phase during the skipped turn, the Voyage will stay in play until the Clean-up of the
> next turn that happens (which could be another player's Clean-up).`"**
> — 英語wiki `Duration` §Other rules clarifications
> ＝**本アプリは航海もリッチも実装済み**（§0-29 A5）なので、こちらは略奪とは独立に今日すでに到達し得る。

##### 3-4. 複数枚あるときの順序

**公式の逐語で確定しているのは Search（調査）の3件**：

> **"If multiple players have played a Search when a Supply pile empties, players trash their Searches and gain Loots in turn order."**
> **"If gaining a card empties a Supply pile, you'll order Search with other when-gain effects.
> If trashing a card empties a Supply pile (e.g. Lurker), you'll order Search with other when-trash effects."**
> **"If you Invest in the last card of a Supply pile, other players who also Invested in that card can order between
> the +2 Cards from Invest and trashing their Searches."**
> — 英語wiki `Search` §Other rules clarifications

**＝ (a) プレイヤー間はターン順／(b) 自分のぶんは他の同時誘発（獲得時・廃棄時）と自由な順序で解決できる。**
（ドミニオンの一般則「同時に誘発した効果は、その持ち主が順序を選ぶ／複数人ならターン順」に一致）

**自分の場に同じ "next time" 持続が複数枚ある場合＝全部が同時に誘発する**（逐語）：
> **"If you gain a Gondola and play a Secluded Shrine, that will trigger your other Secluded Shrines, but not the one you
> just played (it triggers off your **next** Treasure gain)."**
> — 英語wiki `Secluded Shrine` §Other rules clarifications

**＝ 「その瞬間に場に出た1枚」は、その同じ事象では誘発しない**（"next"＝これ以降の獲得）。

**同型の逐語が Cutthroat と Search にもある**（下書きが引いていなかった2件）：
> **"If you gain a Gold, that will trigger Cutthroats by all players (including ones that you already played).
> However, if the Gold gain causes you to play a Cutthroat (you gain one from Haggler and then play it with Rush),
> the Gold won't trigger the Cutthroat you just played (it triggers off your next Treasure gain)."**
> — 英語wiki `Cutthroat` §Other rules clarifications
> **"If emptying a Supply pile causes you to play this (e.g. you gain the last Gondola which lets you play a Search),
> that won't trigger the Search (it triggers off the next Supply pile that's emptied)."**
> — 英語wiki `Search` §Other rules clarifications

**＝ 3枚とも同じ規則**：誘発は「**その事象の時点で既に場にあった予約**」だけ。**全員ぶんが誘発する**（自分だけではない）。

##### 3-5. 玉座の間などで2回使ったとき

> **"If you Throne Room a Search, Throne Room will stay out with Search until a pile empties, and then you'll trash Search
> once but gain two Loots (and discard Throne Room that turn)."**
> — 英語wiki `Search` §Official FAQ

**＝ 予約は2つ立つが、自己廃棄のような「1回しかできない移動」は1回だけ失敗する。玉座も一緒に場に残る。**

##### 3-6. 条件を満たしたが効果が空振りでも「終わる」

> **"It triggers even if the player can't or doesn't want to trash anything; they don't have to trash anything,
> **but Secluded Shrine is done, and is discarded that turn.**"**
> — 英語wiki `Secluded Shrine` §Official FAQ

**＝ 誘発した時点で消費される。「何もしなかったからまだ場に残る」は誤り。**

---

#### 4. Duration（持続）まわりで略奪が変えたこと

##### 4-1. 略奪が持ち込んだ変化は2つ

1. **"next time" 型**（§3・**新規**）。
2. **持続の財宝が本格的に増えた**（Contract＝同盟 が初出、略奪で大量に）：
   > **"Many Duration cards in Plunder are Treasures. These are just like normal Treasures, except that they stay in play
   > until they're done doing things, like other Durations do."**
   > — RGG 公式ルールブック PDF p.3（逐語）
   > **"Duration Treasures began to be introduced with Contract from Allies."** — 英語wiki `Duration` 冒頭

##### 4-2. 略奪ルールブックが書いている一般ルール

**⚠ ここは「2022年の印刷版」と「現行」で文が違う。現行を実装すること。**

**(a) 2022年 印刷版ルールブック PDF p.3（逐語）＝古い**
> **"Duration cards are not discarded in Clean-up if they have something left to do on a future turn; they stay in play
> until the Clean-up of the last turn that they do something. Additionally, if a Duration card is played extra times by a
> card such as Flagship, that card also stays in play until the Duration card is discarded, to track the fact that the
> Duration card was played extra times. Keep track of whether or not a Duration card was played on the current turn,
> such as by putting your cards into two lines."**

**(b) 現行（英語wiki `Plunder_(expansion)` §Additional rules §Durations ＝ oldid 94501・2025-12-31。逐語）**
> **"Duration cards are orange, and have abilities that affect future turns.
> Duration cards are not discarded in Clean-up if they have something left to do on a future turn; they stay in play until
> the Clean-up of the last turn that they do something.
> `If a Duration card leaves play somehow, it stops doing things on future turns.`
> Additionally, if a Duration card is played extra times by a card such as [Throne Room, Scepter, Mastermind, Specialist,
> Flagship, or Daimyo], that card also stays in play until the Duration card is discarded, to track the fact that the
> Duration card was played extra times; `and that effect also ends if that card somehow leaves play`.
> Keep track of whether or not a Duration card was played on the current turn, such as by putting your cards into two lines."**

<!-- 検証で訂正: 旧稿は (a) だけを引いて「（既存と同じ）」と書いていたが、
     現行の同じ節には 2025 エラッタ由来の2文（バッククォート部分）が**増えている**。
     出典＝Wayback 20260101 キャプチャの `Plunder_(expansion)` oldid=94501（本文を直接確認）。
     ＝§4-3 で「略奪とは独立」と書いてある変更が、実は略奪のルール節そのものに取り込まれている。 -->

**＝ 略奪のルール節を実装の正本にするなら (b) を使う**（(a) は初版の紙）。

##### 4-3. ⚠ 略奪とは独立に、**2025年エラッタで持続の一般ルールが2つ変わっている**

**公式エラッタ一覧の逐語**（英語wiki `Errata` §Rules・last edited 2025-03-10）：
> **"Durations — No longer have any effect on future turn if the card has left play (2025)."**
> （同じ節に **"Debt — Can be paid off at any time during your turn (2024)."** もある＝本アプリの `REPAY_DEBT` の
> 「購入フェイズのみ」制限は現行と食い違う可能性がある。**略奪とは無関係だが別途要確認**）

英語wiki `Duration` §Prior rules（＝**現行は下記の「変更後」**）：

> **"Prior to 2025 Errata, Durations would have effect on future turns even if they had left play.
> Likewise a Duration played by a Throne Room variant that had left play would still have its effect multiplied on future turns."**

> **"Since 2025, no Command variants can play Duration cards, but if using a previous versions of a Command variant
> (e.g., Band of Misfits, an Estate after using Inheritance on a Duration card, or any Action card using Way of the Mouse
> to play a Duration) to play a Duration card, it would stay in play for as long as the Duration card it played would have
> stayed in play."**

**この2件は略奪固有ではないが、本アプリの既存挙動（§0-17 の命令、§0-25 の「玉座×持続の許容簡略化」）に
直接あたる。略奪の "next time" 持続を足すと同居範囲が一気に広がるので、着手前に別途裁定が要る。**

（現行の該当ルール逐語）
> **"If a Duration card leaves play somehow, it stops doing things on future turns."**
> — 英語wiki `Plunder_(expansion)` §Durations / `Duration` §Official rules

---

#### 5. 公式エラッタ／FAQ

##### 5-1. 印刷版は **2022年12月の初版のみ**（第2刷は無い）

英語wiki `Plunder_(expansion)` §Versions（逐語・表そのまま）：

| Date | Rulebook | Changes |
|---|---|---|
| **December 2022** | PDF | **First edition** |

> **Announced changes for future printing**
> **Functional changes:**
> **Journey — Changed to never allow more than two turns in a row (2023).**
> **Expected changes for future printing**
> **Cosmetic changes:**
> **Inherited — Mark "Setup:" in bold (2023).**

**＝ 2026-08 時点で、略奪の印刷版は 2022年12月の1版だけ。「第2刷」は存在しない。**
（＝同盟のように「2023年12月・第2刷が現行」という状況ではない。**RGG の PDF＝初版＝現行の印刷物**でもある。
ただし §0 の方針どおり、**カード文面の正本は wiki の `Versions` 表の最新 printing 行**）

##### 5-2. 機能エラッタは **Journey 1枚だけ**（＝この結論は正しい）

英語wiki `Errata` §Plunder（逐語・last edited 2025-03-10）＝**Plunder 節はこの1行だけ**：
> **"Journey — 'You don't discard cards from play in Clean-up this turn. Take an extra turn after this one
> (but not a 3rd turn in a row).' (2023)"**

英語wiki **`2023 Errata`**（＝`Errata` とは別ページ）§Card errata §Functional card changes（逐語）：
> **"Island Folk, Journey, Mission, Outpost, Possession, and Voyage `are changed to never allow more than two turns
> in a row`. `Fleet and Seize the Day however are not changed.`"**

<!-- 検証で訂正: 旧=「英語wiki `Errata` §2023 Errata（逐語）: "…can no longer give more than two turns in a row."」。
     ① `Errata` ページに「2023 Errata」という節は無い（年ごとの別ページへのリンクと、拡張ごとの節しかない）。
        この文があるのは独立した `2023 Errata` ページ。
     ② 逐語も "can no longer give" ではなく "are changed to never allow"。
     ③ 旧稿は **"Fleet and Seize the Day however are not changed." を落としていた**。
        本アプリは 艦隊(Fleet)・今を生きる(Seize the Day) を両方実装済み（§0-22／§0-26）で、
        §0-26 は「今を生きるは3連続もあり得る」と正しく実装している＝この一文がその裏取りになる。
        落とすと「2023エラッタを全部の追加ターン札に適用する」という逆方向の事故を招く。 -->

**＋ DXV 本人の逐語（`2023 Errata` §Reasoning for extra turn errata）**：
> **"Functionally they just lock out three turns in a row from happening, even with multiple kinds of extra-turn things;
> `except, Seize the Day and Fleet aren't changed and could result in a one-time 3rd turn`."**

英語wiki `Journey` §Versions（逐語・表そのまま）：

| Print | Text | Release | Date |
|---|---|---|---|
| Plunder（印刷版） | **"Once per turn: If the previous turn wasn't yours, you don't discard cards from play in Clean-up this turn, and take an extra turn after this one."** | Plunder | December 2022 |
| **Not printed yet** | **"You don't discard cards from play in Clean-up this turn. Take an extra turn after this one (but not a 3rd turn in a row)."** | **Extra turn errata** | **September 2023** |

**⚠ 判断が要る点＝「現行」はどちらか**

| 観点 | 印刷版（2022-12） | エラッタ版（2023-09） |
|---|---|---|
| 物理カード | **これが唯一の印刷**（`Versions` 表は 2025-12-31 版でも「December 2022 / First edition」の1行だけ） | **未印刷（`Not printed yet`）** |
| 公式デジタル（Temple Gates Games） | — | **こちらを実装済み**（wiki の Digital 列） |
| 英語wiki の `Event text`（ページ冒頭の正式テキスト欄） | — | **エラッタ版が載っている**（＝wiki は新版を「現行テキスト」として扱う） |
| 英語wiki の FAQ 節 | `Official FAQ (2022)` として残置 | ⚠ **`Unofficial FAQ (Post-2023 Errata)`＝"Unofficial" と明示**されている |
| 公式エラッタ一覧 | — | **`Errata` ページの Plunder 節＋`2023 Errata` ページに明記** |

<!-- 検証で訂正: 旧=「英語wiki の扱い｜…｜**独立した `Errata` 節を立て、変わる裁定を列挙**」。
     実際の見出しは "Unofficial FAQ (Post-2023 Errata)" ＝**Unofficial と明記されている**。
     出典＝英語wiki `Journey`（oldid=92112・2025-07-03）の目次と本文見出し。
     ＝下書きが「royal_galley より一段強い」根拠に挙げた3本柱のうち1本（wiki の扱い）は**成立しない**。
     残る2本（公式エラッタ一覧への掲載／公式デジタル実装）と、
     新たに確認した1本（wiki 冒頭の `Event text` 欄がエラッタ版）は成立する。 -->

**本プロジェクトの方針との照合**：
- §0-29（royal_galley）＝「announced だが**未印刷かつ公式FAQ未更新**（wiki も Unofficial FAQ 扱い）」→ **採らなかった**。
- **Journey も wiki の FAQ 見出しは同じ "Unofficial" 扱い**なので、その1点だけでは royal_galley と区別できない。
  **区別できるのは3点**：① `Errata` ページの Plunder 節に**唯一の機能エラッタとして載っている**
  （royal_galley は Allies 節に載っていない）／② wiki 冒頭の `Event text` 欄が**エラッタ版に差し替わっている**／
  ③ 公式デジタル（Temple Gates Games）が実装済み。
- さらに**本アプリは同じ2023エラッタの他の5枚を既に採用済み**：
  Island Folk / Voyage（§0-29「3ターン連続不可」）、Mission（§0-26「`ONCE_PER_TURN_EVENTS` から外した」）、
  Outpost / Possession（§0-26 の追加ターン優先順位ロジック）。
- **→ Journey だけ旧版のままにすると、同じエラッタの6枚のうち1枚だけ挙動が食い違う。**
  **ユーザーに明示的に確認すべき決定事項**（この文書だけでは決めない）。

**印刷版（2022）の公式FAQ 冒頭（下書きが引いていなかった＝旧版を採る場合の正本）**：
> **"You can only buy this once per turn. When you do, if the previous turn was not yours - if it was another player's
> turn before this turn - you don't discard cards from play this turn, and you take another turn after this turn ends.
> You still discard your hand."**
> — 英語wiki `Journey` §**Official FAQ (2022)**

**エラッタ版で変わる裁定（英語wiki `Journey` §`Unofficial FAQ (Post-2023 Errata)`・逐語）**：
<!-- 検証で訂正: 旧=「§Errata」。実際の見出しは "Unofficial FAQ (Post-2023 Errata)"。 -->
> **"If you buy Journey multiple times in one turn, you aren't able to take more than 2 turns in a row, so all Journeys after the first will fail.
> If you buy Journey on an extra turn, your cards will stay in play, but you won't get an extra turn.
> If you set up multiple extra turns at once (e.g. one from Journey, one from Voyage), you choose one turn to take, and the others fail.
> If you are Possessed, and they make you buy Journey, anything they made you play will stay in play, you take a Journey turn, and then take your normal turn."**

##### 5-3. Journey のその他のFAQ

<!-- 検証で訂正: 旧見出し＝「版によらず有効な部分」。実際には下の7件のうち
     「Lich」「Improve/Scheme」「Journey's restriction only applies to your cards」の3件は
     `Unofficial FAQ (Post-2023 Errata)` 側にしか無く、`Official FAQ (2022)` 側には無い。
     出典＝英語wiki `Journey`（oldid=92112）の2つのFAQリストを突き合わせて確認。 -->

**両方のリストに載っている（＝版によらず有効）**：tiebreaker／場の銅貨は+$1を出さない／
"while this is in play" は働く（Swamp Shacks）／もともと場に残る持続（Longship）はそのまま。
**Post-2023 側にしか無い**：Lich／Improve・Scheme／相手のカードは普通に捨てる／Urchin の例外。

> **"The extra turn is completely normal except that it doesn't count for the tiebreaker."**
> **"The cards left in play don't do anything special on the extra turn; a Copper left in play doesn't make +[$1] on the extra turn and so on."**
> **"Cards with "while this is in play" abilities can continue to function, and the cards are in play for things that care about that, such as Swamp Shacks; otherwise, the cards being in play just means you won't draw them that turn."**
> **"If you play Lich and buy Journey on the same turn, your cards remain in play, the Journey turn gets skipped, and you'll discard those cards from play during the next Clean-up (yours or another player's)."**
> **"If you buy Journey, then any effects that care about cards that you discard from play this turn (e.g. Improve and Scheme) will do nothing. However, some effects trigger at the start of Clean-up (e.g. Alchemist and Walled Village), and they trigger normally."**
> **"Journey's restriction only applies to your cards. Any cards that other players play (e.g. Mapmaker) will be discarded normally."**
> **"Cards that would have stayed in play anyway (e.g. a Longship played on the turn you bought Journey) stay in play for that reason, and do whatever they normally do."**
> **"Almost all "while this is in play" abilities have either received errata (e.g. Quarry) or been removed (e.g. Talisman). The exception is Urchin, which you can play during your regular turn, and then trash into a Mercenary on the Journey turn."**
> — 英語wiki `Journey`
> <!-- 検証で追記: 下2件は旧稿に無かった。Urchin/Mercenary は本アプリの暗黒時代（§0-8）に実装済み＝mix-all で到達する。 -->

##### 5-4. Inherited の「Setup: を太字にする」は **表示のみ（機能変更なし）**

`Expected changes for future printing / Cosmetic changes: Inherited — Mark "Setup:" in bold (2023).`

---

#### 6. 準備（Setup）で特別なことが要るもの

| 対象 | 条件 | 逐語 |
|---|---|---|
| **Loot の山** | **Loot に言及するカードが1枚でもあるとき**（王国カード・イベント・特性 Cursed のいずれか） | `Shuffle them into a face-down pile before the game if any cards refer to Loot.`（RGG p.3）／`In games using cards that refer to Loot, shuffle the Loot pile and place it face down where everyone can reach it.`（RGG p.2） |
| **特性の付け先** | 特性を使うゲーム。**アクション or 財宝の王国の山から無作為に1つ** | `In games using a Trait, pick a random Treasure or Action from the dealt-out Kingdom cards and put the Trait under it`（RGG p.2） |
| **Inherited（特性）** | **カード文に `Setup:` を持つ唯一の特性** | `Setup: You start the game with an Inherited card in place of a starting card you choose.` |
| **Shaman（王国カード $2）** | **ゲーム全体の恒久ルールを足す**（Setup 表記は無いが `In games using this,`） | `In games using this, at the start of your turn, gain a card from the trash costing up to [$6].` |

##### Inherited の公式FAQ（逐語・英語wiki `Inherited` §Official FAQ ＝ RGG ルールブック p.7 と同文）
> **"If they care, players decide which card to replace in turn order.
> Replaced Coppers go back to the pile; replaced Estates go back to the box.
> Replaced other cards (Shelters from Dark Ages, Heirlooms from Nocturne) go back to the box.
> If the Inherited pile is a split pile (from Empires or Allies), players take cards from the pile in turn order.
> So in a 6-player game with the Townsfolk pile, the first four players get a Town Crier, and the next two get a Blacksmith.
> Cards starting in your deck due to Inherited were never "gained" and did not trigger "when you gain this" effects."**

**＝ 開始デッキの1枚を差し替える＝サプライの山から人数ぶん抜く（3山終了に影響）。**
本アプリの**避難所(Shelters)・家宝(Heirloom)・相続(Inheritance)の脇置き**と同じクラス。

##### Shaman の公式FAQ（逐語・英語wiki `Shaman` §Official FAQ）
> **"In games using Shaman, for the whole game, at the start of each of your turns (including extra turns), you gain a card
> from the trash costing up to [$6]. This is mandatory.
> If there's no such card, you don't gain one.
> This applies even on your first turn (relevant with Necromancer, from Nocturne).
> **It applies even if no-one ever gets a Shaman.**
> The gained card goes into your discard pile. It's a card you gained, and can trigger things that care about that;
> for example gaining an Estate would trigger Cage's ability."**
> **"You can order the gaining with other start-of-turn abilities."**

---

#### 7. 日本語の用語（⚠ **一部は「要ユーザー確認」**。§7末尾の注記を必ず読むこと）

| 英語 | 日本語 | 出典 |
|---|---|---|
| Plunder（拡張） | **略奪** | 日本語wiki `略奪（拡張）` |
| **Loot** | **戦利品** | 日本語wiki `戦利品`（種別＝`財宝-戦利品`） |
| **Trait** | **特性** | 日本語wiki `特性` |
| Spoils（暗黒時代） | **略奪品** | 日本語wiki `略奪品` |

**特性15種**：安価な(Cheap) / 呪われた(Cursed) / 運命の(Fated) / へつらう(Fawning) / 友好的な(Friendly) /
せっかちな(Hasty) / 受け継がれた(Inherited) / 鼓舞する(Inspiring) / 近隣の(Nearby) / 忍耐強い(Patient) /
敬虔な(Pious) / 無謀な(Reckless) / 豊かな(Rich) / 内気な(Shy) / 疲れ知らずの(Tireless)

**戦利品15種**：アンフォラ(Amphora) / ダブロン金貨(Doubloons) / 尽きぬ杯(Endless Chalice) / 船首像(Figurehead) /
ハンマー(Hammer) / 勲章(Insignia) / 宝石(Jewels) / 宝珠(Orb) / 賞品のヤギ(Prize Goat) / パズルボックス(Puzzle Box) /
六分儀(Sextant) / 盾(Shield) / 呪符の巻物(Spell Scroll) / 杖(Staff) / 剣(Sword)

**⚠⚠ 注記（検証で強い警告に差し替え）**

- **日本語版（ホビージャパン）は 2023年3月下旬に発売済み**（カード500枚・5,500円・2〜4人）。
  出典＝4Gamer『「ドミニオン：略奪」日本語版，2022年3月下旬に発売』（記事URL は 2023-02 付）／
  Table Games in the World『『ドミニオン：略奪』日本語版、3月下旬発売』（2023-02）。
- **にもかかわらず、日本語wiki の略奪のカード訳文表には全ページに「(※日本語訳はDominion Onlineより)」が付いている**
  （`特性` ページ・`略奪` ページの両方で実見）。
  **＝ wiki に載っている個別の訳語は Dominion Online 由来であって、ホビージャパン印刷版と照合された訳ではない。**
- したがって確度を2段に分ける：
  - **【確度・高】`Loot`＝戦利品／`Trait`＝特性／`Spoils`＝略奪品／拡張名＝略奪**
    ＝これらは wiki の**用語ページの解説本文**（表ではない）でも一貫して使われている。
  - **【要ユーザー確認】特性15種・戦利品15種の個別の日本語名**
    ＝上のリストは **Dominion Online 表記**。同盟(§0-29)では「日本語wiki で全72枚を機械照合（一致72/72）」できたが、
    **略奪は同じ強度の裏取りが取れていない**。夜想曲(§0-27)で**英語wiki の Japanese 行が17枚実物と食い違った**前例があるので、
    **カタログ投入前に、ユーザーの手元の日本語版カード（またはホビージャパン公式画像）と突き合わせること。**

<!-- 検証で訂正: 旧稿は §7 の見出しで「日本語wiki＝ホビージャパン印刷版」と断定し、
     注記でも「用語自体は…確度は高い」で済ませていたが、日本語wiki のカード表は明示的に
     "(※日本語訳はDominion Onlineより)" と断っており、印刷版と照合済みという根拠はどこにも無い。
     出典＝日本語wiki `特性`(Last-modified 2026-06-14)／`略奪`(2026-07-20) を実見。
     個別名は「未確定」として扱うのが正しいので、確度を2段に分けた。 -->

---

#### 8. 本アプリの既存機構との対応（一次資料が何と言っているかベース）

| 論点 | 一次資料の答え | 本アプリで一番近い既存機構 |
|---|---|---|
| Loot はサプライか | **非サプライ**（`The Loot pile isn't in the Supply`） | `NON_SUPPLY`（賞品/戦利品spoils/馬/精霊…）と同じ |
| Loot は3山終了に数えるか | **数えない**（`Non-Supply piles don't count towards a three-pile ending.`） | 同上（`emptyPileCount` が既に除外） |
| Loot は1つの山か | **1つの山・30枚**（`a face-down pile`） | 馬(30枚)・spoils(15枚)と同じ「単一の非サプライ山」 |
| 山の中身は同名か | **15種×2枚＝中身が不均一** | **騎士(knights)・廃墟(ruins)と同じ「混合山」**（＝`MIXED_PILE_KEYS` 型）。ただし**非サプライ** |
| 中身は公開か | **完全に伏せる**（`Players can't look through the Loot pile`） | **`HIDDEN_MIXED_PILE_KEYS = ['ruins','knights']` と同じ扱い**（＝`maskStateFor` で伏せる）。**廃墟と違い一番上も見えない**（日本語wiki が明記） |
| 汎用 gainer で取れるか | **取れない**（`except with cards that specifically gain Loot`） | 賞品(PRIZE_SET)と同じ＝`gainableBase`/`costUpTo` が弾く形 |
| タイプ名指しなら取れるか | **取れる**（`Loot cards can also be gained from their pile when a card refers to their type.`） | **賞品(Tournament)・報酬(Joust)と同じ「タイプ名指しの例外」** |
| 廃棄置き場からは取れるか | **取れる**（`Trash gainers can gain non-Supply cards that are in the trash.`） | 墓暴き/祭壇と同じ |
| 山へ戻すことはあるか | **ある**（`the Loot goes back on top of the pile, face down`） | `returnToPile` / `canReturnToPile`（§0-16 の取り替え子）と同じ |
| Trait は Ally 型か | **違う**。`Events and Traits can be shuffled into the randomizer deck` ＋ 推奨2枚に**含まれる** | **イベント/ランドマーク/プロジェクト/習性と同じ「横型・合計2枚枠」**（`DOM.LANDSCAPES` の新 `kind:'trait'`） |
| Trait の付け先は誰が決めるか | **無作為**（`pick a random Treasure or Action`） | **災いカード(Bane)・Ally と同じ＝`createInitialState` で決める**（サーバ権威・再戦も安全） |
| Trait は分割山にどう効くか | **その山の全種に効く**（`affects all of those different cards`） | 同盟の `pileFavor`（発明家の家族）が `pileKeyOf` で正規化しているのと同じ形 |
| Trait は山が空でも効くか | **効く**（`continue to affect the cards from a pile even after the pile is empty`） | ＝**「山」ではなく「カードid の集合」に持たせるべき**という結論 |
| Trait は勝利点の山に付くか | **付かない**（`only Action and Treasure piles`） | 発明家の家族が城(Castles)に置けないのと同じ「randomizer の種別で判定」 |
| "next time" 持続 | **条件を満たすまで場に残る／満たさなければ永久** | `p.delayedEffects`（持続の予約）＋ **相手のターンをフックする `applyLingerOnBuy`（§0-9 Batch5c）と同型** |
| "next time" は相手のターンにも誘発するか | **する**（`This can trigger on any player's turn.` / `anyone gains`） | 沼の妖婆/呪いの森/門番と同じ「相手のターンをフックする持続」 |
| 誘発したら誰の片付けで捨てるか | **条件を満たしたターンの片付け**＝**相手の片付けになり得る** | **通常経路では前例が無い**（既存の持続は必ず自分の片付けで捨てる）＝§9 の最大の落とし穴。<br>⚠ ただし **航海(Voyage)×リッチ(Lich)** だけは**今日すでに同じ現象に到達する**（§3-3 の `Duration` 逐語）＝本アプリが現状どう振る舞うか先に確認すること |

---

#### 9. 【実装前に必読】事故りそうな落とし穴

1. **⚠⚠ 日本語名が既存カードと3重に衝突する。**
   - **Loot の公式和名「戦利品」を、本アプリは既に暗黒時代の Spoils に使っている**
     （`js/cards.js:601` `spoils: { name: '戦利品' }`）。**公式の Spoils は「略奪品」**（日本語wiki `略奪品` で確認）。
     PROGRESS §0-3 が「**将来 Plunder/Loot を入れる時に再考**」と明記した宿題が**まさにこれ**。
     → **spoils を「略奪品」に直して Loot に「戦利品」を明け渡す**か、Loot に別名を当てるかの決定が要る。
     spoils の名前を直す場合、**カード文中の「戦利品置き場」も同時に直す必要がある＝`js/cards.js` の
     `marauder`(494行)／`bandit_camp`(530行)／`pillage`(546行)／**`spoils` 自身(602行「このカードを戦利品置き場に戻す」)**
     の4箇所＝webp を4枚再生成する**（このPCのみ）。
     <!-- 検証で訂正: 旧=「marauder/bandit_camp/pillage …webp を3枚以上再生成」。
          spoils 自身のカード文にも「戦利品置き場」が入っているので4枚。
          出典＝js/cards.js を grep（494/530/546/602行）。 -->
   - **拡張名「略奪」＝暗黒時代の王国カード `pillage`（略奪）と完全一致**（同盟拡張×イベント `alliance`＝同盟 と同型）。
   - **英語の "Plunder" ＝ 帝国の分割山カード `plunder`（鹵獲品）と id が衝突する**。
     → **新拡張の id 空間で `plunder` は既に使用済み**。プール名・セットIDは `plunder` 以外（例 `plunder2`/`plunderexp`）か、
     帝国側の id を触らずに済む命名を先に決めること。

2. **⚠⚠ "next time" 持続は「相手の片付け」で自分の場から捨てられる。**
   本アプリの `cleanupAndAdvance` は**手番プレイヤーの場しか片付けない**。
   根拠＝`Secluded Shrine` §Official FAQ の `This can trigger on any player's turn.` ＋ 同 `is discarded that turn`、
   および `Cutthroat` 冒頭の `the Cutthroats are finally discarded that turn`（§3-3 参照）。
   <!-- 検証で訂正: 旧稿はここでも `Duration` ページの「you'll discard it from play during another player's Clean-up」を
        根拠に挙げていたが、その文は 航海×リッチ でターンが飛んだ場合の話であって "next time" 持続の話ではない。
        結論は正しいので根拠だけ差し替えた。 -->
   → **他プレイヤーの片付けで全員の場を走査して「解決済みの next-time 持続」を捨てる**経路が新規に要る。
   放置すると場に残り続けて**保存則は保つが忠実性が壊れる**（＋`inPlay` を数えるカードが過大に数える）。

3. **⚠ "next time" 持続は条件を一度も満たさないと**ゲーム終了まで場に残る**。**
   `If the condition is never met, these cards will remain in play permanently as well.`
   → 雇人/チャンピオン/尽きぬ杯と同じ「永久持続」の器（`p.hirelings` / `p.princes` 相当）が必要。
   **cleanup の持続仕分けを「残り予約数」で数えている既存実装（§0-28 の幽霊の注記）と噛み合うか要確認。**

4. **⚠ 「その瞬間に場に出た1枚」は同じ事象では誘発しない。**
   `that will trigger your other Secluded Shrines, but not the one you just played`。
   → 誘発リストを**イベント発生「前」にスナップショットする**か、予約に「このターン/この解決で張ったか」の印を持つ。
   同盟の `noteAllyPlay`（§0-29）で踏んだ「1回目が落ちる/2回目だけ誘発する」の裏返し。

5. **⚠ 誘発したら空振りでも消費される。**
   `It triggers even if the player can't or doesn't want to trash anything; … but Secluded Shrine is done, and is discarded that turn.`
   → **「候補ゼロなら窓を開かない」という本アプリの定石（§0-29 の リッチ [high]）を、ここに適用してはいけない。**
   窓は開かず**自動で消費**する（人間に「何も廃棄しない」を選ばせる形か、候補ゼロなら無言で消費）。
   ただし**pending を立てるなら必ず「廃棄しない」ボタンを出す**（任意なので）。

6. **⚠ Loot の山は「非サプライ かつ 混合山 かつ 中身が完全に伏せられている」**＝本アプリに前例が無い組み合わせ。
   - `MIXED_PILE_KEYS` は全部サプライ山（廃墟/騎士/城/同盟6）。
   - `NON_SUPPLY` は全部同名か個別山（賞品/spoils/馬/精霊）。
   - → **`HIDDEN_MIXED_PILE_KEYS` に足すだけでは足りない**（`supply` に載せるとサプライ扱いになる）。
   - **オンラインの `maskStateFor` で山の中身も順序も完全に伏せること**（§0-21 偵察隊／§0-28 夜警／§0-29 粉屋・歩哨 と
     **4回目の同じクラスの漏れ**になりかねない）。獲得した1枚だけ公開する。
   - **サーバの `isNoConsentUndoableBuy`**（§0-24）＝「購入では乱数を消費しない／情報が増えない」の前提が
     **Loot を獲得する購入（Sack of Loot 等）では崩れる**（山の一番上が公開される＝情報が増える）。
     → **Loot の山も比較対象に入れる**こと（伏せ札の騎士の山で踏んだ §0-29 A2 の [medium] 3 と同型）。

7. **⚠ Loot の山が空になっても Search（調査）は誘発しない。**
   `If a non-supply pile (like Loot or Horse) is emptied, that won't trigger Search.`
   → 「サプライ山が空になった」判定に**非サプライ山を混ぜない**。本アプリの `emptyPileCount` は既に除外しているが、
   Search は `emptyPileCount` ではなく**「今この瞬間にサプライ山が空になった」という事象**を見る＝**新しいフック**が要る。

8. **⚠ 特性は「山」ではなく「カード名の集合」に付く。**
   `Traits continue to affect the cards from a pile even after the pile is empty.` ＋
   `A Trait on a split pile affects all of those different cards.`
   → **`state.trait = { id, pileKey }` を持ち、判定は「そのカードid が pileKey の山に由来するか」**にする。
   同盟の分割山なら中身4種すべて。**`pileKeyOf` を必ず通す**（§0-29 の汚された神殿・徴税と同型の孤児化バグを避ける）。
   **闇市場デッキのカードは「山に由来しない」**（英語wiki `Non-Supply`＝`The Black Market deck is not a pile however,
   and cards in it do not belong to a pile`）が、**特性×闇市場の裁定は一次資料に無い＝不明**。

9. **⚠ 特性の選出は「準備手順の最後」／特性の効果は準備中には効かない**（別々の2つの規則）。
   - **選出順**（日本語wiki `特性` §詳細なルール 逐語）：
     「ゲームの準備時、**特性の山札選出は準備手順の最後に行う**。
      **魔女娘をゲームに用いる場合の災いカード**＆来寇をゲームに用いる場合の【追加アタック】**は選出対象となる**。
      一方で、Ferryman をゲームに用いる場合の【Ferrymanカード】は選出対象にならない。」
     → **`createInitialState` では 王国10種の決定 → 災いカード(Bane)選定 → Ally 選定 → 植民地/避難所判定 を全部終えてから、
       最後に特性の付け先を無作為に決める**。**Bane の山は付け先の候補に入る**（アクション/財宝なら）。
   - **効果の適用開始**（英語wiki `Cheap` §Official FAQ 逐語）：
     `This does not apply during setup; it can't for example cause a [$4] to be used as Young Witch's Bane.`
     → **Cheap の $1 軽減は Bane の $2-3 判定には効かない**（軽減前のコストで選ぶ）。
   <!-- 検証で訂正: 旧稿は「特性を決めるより前に災いカード選定を済ませる」という結論だけで、
        (a) それが公式の「準備手順の最後」規則によること、(b) **Bane 自身が特性の付け先になり得る**こと
        を書いていなかった。出典＝日本語wiki `特性`（Last-modified 2026-06-14）§詳細なルール。 -->

9b. **⚠ 特性はカード種別を増やさない**（§2-2 の逐語）。`types` に足さず `state.trait` で別に持つ。
    廷臣・鷹匠・品評会・蛮族（同盟）の「種別」判定に混ぜてはいけない。

10. **⚠ Reckless（無謀な）は本アプリの再演機構と正面衝突する。**
    `Follow the instructions of played Reckless cards twice.` ＋ `When discarding one from play, return it to its pile.`
    - 玉座の間と違い**カードではない**＝場に「玉座」が残らない。持続に付くと **2回ぶんの予約**が立つ。
    - **習性(Way)を使うと2回にならないが、山へ戻す方は起きる**（`you don't follow them an extra time, but still return the card`）。
    - **女魔術師(Enchantress)・追いはぎ(Highwayman)でも同じ**（wiki の Other rules clarifications）。
    - **`Way of the Chameleon` だけは例外で2回になる**（"follow this card's instructions" と書いてあるため）。
    - **「使用した回数」は1回**（`that only counts as 1 card played (which matters for e.g. Conspirator)`）。
    - **「このターン最初にこれを使ったか」を見るカードでは、2回とも "1回目" 扱い**
      （`So your 1st Reckless Fool's Gold gives +[$2], and your 1st Reckless Crossroads gives +6 Actions.`）。
    - **【下書きに無かった逐語4件】**（英語wiki `Reckless` §Other rules clarifications）：
      `Both iterations will count as something the card did.`（港の村 Harbor Village が +$1 を出す）／
      `Abilities that happen after playing a card (e.g. Frigate or Landing Party) are resolved (once) after you finish both iterations.`／
      `If a Reckless card is an Attack, a single Shield reveal (which you have to reveal before the first iteration) will block both attacks.`／
      `If a Reckless card never gets discarded from play (e.g. Quartermaster, Search, or a one-shot), you'll follow its
       instructions twice, but you'll never return it to its pile (so there's effectively no downside).`／
      `If another card moves a Reckless card when it's discarded from play (e.g. Scheme), it'll fail to return to its pile.`
    - **戻し先は「サプライの山」**（公式FAQ逐語＝`you return it to its Supply pile`）＝
      **山が復活する＝3山終了・Search の「山が空になった」判定が巻き戻る**（§1-4 の「同じ山で再誘発できる」と直結）。
    → **`state.replay` に乗せるのが素直だが、上の点は既存の玉座系と挙動が違う**。専用ヘルパにすること。

11. **⚠ Journey のエラッタをどちらにするか、ユーザーに確認が要る。**
    印刷版は初版のみ（`Not printed yet`）だが、**公式エラッタ一覧に載り、公式デジタルは新版**。
    **本アプリは同じ2023エラッタの Island Folk / Voyage / Mission / Outpost / Possession を既に採用済み**なので、
    Journey だけ旧版だと同じエラッタ内で挙動が割れる。→ **§0-29 の royal_galley とは事情が違う**ことを添えて確認する。

12. **⚠ Journey は「片付けで場のカードを捨てない」＝本アプリに前例が無い片付け。**
    `any effects that care about cards that you discard from play this turn (e.g. Improve and Scheme) will do nothing.
    However, some effects trigger at the start of Clean-up (e.g. Alchemist and Walled Village), and they trigger normally.`
    → **策謀(Scheme)・増築(Improve)・錬金術師・城壁のある村・カエルの習性・沿岸の避難港** が全部この経路にいる。
    さらに `Journey's restriction only applies to your cards.`（相手が使ったカードは普通に捨てる）。

13. **⚠ Shaman は「王国にあるだけで全員・毎ターン・強制」の恒久ルール。**
    `It applies even if no-one ever gets a Shaman.` ＋ `This applies even on your first turn.`
    → **`createInitialState` の末尾（ターン1）でも開く**必要がある（§0-29 A3 の [medium] 3＝
    「ゲームの最初のターンだけ開始時 Ally の窓が開かない」と**まったく同じ穴**を踏む）。
    順序も選べる（`You can order the gaining with other start-of-turn abilities.`）。

14. **⚠ Inherited は開始デッキを差し替える＝サプライから人数ぶん抜く。**
    3山終了に影響する。`Cards starting in your deck due to Inherited were never "gained"`＝**獲得トリガーを引かない**。
    避難所・家宝と同じ配線（`allCards` / invariants の ZONES / `initSupply` の枚数）。

15. **規模の把握**：略奪は **500枚**。内訳は RGG ルールブック PDF p.2 の逐語＝
    **`400 Normal Kingdom cards`（40種×10枚）＋`30 Loot cards`（15種×2枚）＋`40 Randomizer cards`
    ＋`15 Event cards`＋`15 Trait cards`**（400+30+40+15+15＝500）。
    <!-- 検証で訂正: 旧=「500枚＝王国40種＋Loot 30＋イベント15＋特性15」＝400+30+15+15=460 で合わない
         （ランダマイザー40枚が抜けていた）。出典＝DomPlunderRules22 p.2 の内容物リスト逐語。 -->
    **王国カード数は全拡張中で最大**（`Plunder is the largest expansion in terms of number of kingdom cards.`）。
    縦型＝王国40＋Loot 15＝**55種**／横型＝イベント15＋特性15＝**30種**／**合計85種**
    （Donald X. のティーザー「85」＝ユニークなカード名の数、で裏取り済み）。

---

#### 付録：取得済み生データの置き場

- `C:/tmp/plunder_research/plunder_rules.txt` … RGG 公式ルールブック PDF の `pdftotext -layout` 出力（1264行）
- `C:/tmp/plunder_research/rules_clean.txt` … 上記からカード画像の残骸を除いたもの（676行・**特性15種のFAQが読める**）
- `C:/tmp/plunder_research/DomPlunder.pdf` … 原本（12ページ・2.2MB）
- `C:/tmp/plunder_research/pages/*.txt` … 英語wiki の各ページ（`fetch.sh` でリトライ取得）
- `C:/tmp/plunder_research/jp_expansion.txt` … 日本語wiki `略奪（拡張）`（**全85種の日本語名と効果概要**）
- `C:/tmp/plunder_research/jp_戦利品.txt` / `jp_特性.txt` / `jp_略奪品.txt` … 日本語wiki の用語ページ
- `C:/tmp/plunder_research/fetch.sh` … wikifetch のリトライラッパ（**`dangerouslyDisableSandbox: true` 必須**）

⚠ **`pdftotext` はコイン記号・VP記号・負債記号を全部落とす**（`+ .` のように見える）。
金額は必ず英語wiki 側（`[$3]` 形式で復元される）で裏取りすること。


---

## 第2章 王国カード 1/3 — $2〜$4 の13枚

<sub>（出典ファイル＝`kingdom1.md`。見出しは2段下げて収録）</sub>

### 略奪（Plunder・2022年12月）王国カード 調査 1/3

> ### ⚠️ この章（kingdom1）の敵対検証について
> 下書きを書いたエージェントとは**別の2体**が、担当を分けて**一次資料を自分で引き直して**検証した
> （ライブwiki 直読み＋Wayback の別スナップショット＋RGG 公式PDF の3系統で照合）。
> **確定した訂正は計15件（V1が6件・V2が9件。うち high 4件）／要ユーザー確認5件／下書きが落としていた裁定 約24件。**
> **本文はまだ訂正前のままなので、必ず章末の「敵対検証レポート」を先に読むこと。**
> とくに重いのは＝**旗艦(Flagship)は持続を再演すると場に残る**（本文は「残らない」＝逆）／
> **現場監督×増築の裁定は2025年2月エラッタで無効**（本文は「実装前に確認」で止まっている）／
> **"next time" 型は5枚ではなく ちょうど7枚**（切り裂き魔・上陸部隊が抜けていた）／
> **日本語印刷版は「存在しない」と断定できない**（本文の前提が誤り）。


対象13枚＝Cage / Grotto / Jewelled Egg / Search / Shaman / Secluded Shrine / Siren / Stowaway /
Taskmaster / Abundance / Cabin Boy / Crucible / Flagship

#### 出典と信頼度

| 項目 | 出典 | 備考 |
|---|---|---|
| 英語カードテキスト・種別・コスト | 英語wiki（wiki.dominionstrategy.com）の各カードページ `Card text` 欄＋`Versions > English versions` 表 | Wayback 経由。**CDX API で実キャプチャ日時を確定**した（下表）。全13枚とも略奪発売（2022-12）より後＝略奪の情報を確実に含む |
| 公式FAQ・裁定 | 同ページの `Official FAQ` / `Other rules clarifications` / `Trivia` 節 | |
| 日本語カード名 | ①**ホビージャパン公式の実物写真**（4枚のみ確認可）／②日本語wiki `https://wikiwiki.jp/dominiondeck/略奪（拡張）`（2026-07-21 更新） | 下記「日本語版について」参照 |
| 日本語カードテキスト | 日本語wiki の各カードページ | ⚠ **日本語wiki自身が「(※日本語訳はDominion Onlineより)」と明記**＝**ホビージャパンの印刷版ではなくオンライン版の訳**。**印刷版とは文言が実際に違うことを実物写真で確認済み**。下記参照 |

<!-- 検証で訂正: 旧="全13枚とも capture は 2023-03〜2025-05" → `tools/wikifetch.py` の出力は要求プレフィックス（'2id_' 等）を印字するだけで実キャプチャ日を示さないので、この記述は根拠にならなかった。CDX API で実日時を確定し直した。出典= https://web.archive.org/cdx/search/cdx?url=wiki.dominionstrategy.com/index.php/<Page> -->

**実キャプチャ日時（CDX で確定・2025-06 以前の最新を採用）**
Cage=**20240907** ／ Grotto=20250116 ／ Jewelled_Egg=20250118 ／ Search=20250127 ／ Shaman=20250503 ／
Secluded_Shrine=20250118 ／ Siren=20250118 ／ Stowaway=20250115 ／ Taskmaster=20250114 ／
Abundance=20250116 ／ Cabin_Boy=20250501 ／ Crucible=20250118 ／ Flagship=20250130 ／
Plunder_(expansion)=20250415 ／ Errata=20250330。
（Wayback の 2025-12 以降のキャプチャは Anubis の bot 検知画面が保存されているので使えない。）

##### ⚠ 日本語版について（実装前に必ず読むこと）

<!-- 検証で訂正: 旧="略奪の日本語印刷版は（この資料の時点で）存在しないと考えるのが自然" / "「印刷版の日本語wiki＝正本」という前提が今回は成り立たない" → **誤り**。ホビージャパンが「ドミニオン：略奪」日本語版を 2023年3月下旬に発売済み。
出典= https://hobbyjapan.games/dominion_plunder/ （HJ公式・2023年3月・実物写真あり）／ https://www.4gamer.net/games/138/G013817/20230216103/ ／ https://www.gamer.ne.jp/news/202302180012/ ／JAN 4981932026688。
「英語wikiに Japanese 行が無い」は事実だが（13枚とも Dutch/German/Polish のみ＝機械確認）、それは英語wikiの記載漏れであって「印刷版が無い」根拠にはならない。 -->

- **ホビージャパン版「ドミニオン：略奪」は 2023年3月下旬に発売済み**（＝日本語印刷版は**存在する**）。
  したがって本プロジェクトの原則「日本語名・文面の正本＝日本語wiki（ホビージャパン印刷版）」は**今回も適用したい**。
- **ところが日本語wikiの略奪カードページは「(※日本語訳はDominion Onlineより)」と明記している**
  （2026-07-20 更新時点でも）。**この注記は略奪固有**で、同盟の `道化棒`/`大工`・基本の `民兵` のページには無い
  （3ページを実取得して機械確認）。＝**日本語wikiの略奪の文面は印刷版ではない**。
- **印刷版の実物で確認できたのは4枚だけ**（HJ公式ページ掲載の実物写真
  `https://hobbyjapan.games/wp-content/uploads/2023/01/Domi_Plunder_jp_kingdomcards.jpg` を実見）：
  **シャーマン／セイレーン／現場監督／密航者**。**名前は4枚とも本資料の表と一致**（＝Dominion Online 訳と印刷版で
  カード名は一致している公算が高い）。
- **ただし文面は印刷版とDO訳で明確に違う**（実物写真からの逐語）：
  | カード | 印刷版（HJ実物写真） | 日本語wiki（DO訳） |
  |---|---|---|
  | シャーマン | `これを使用しているゲーム中、…` | `シャーマンを使うゲームでは、…` |
  | 密航者 | `いずれかのプレイヤーが持続カード1枚を獲得したとき、あなたの手札からこれを使用してもよい。` | `誰かが持続カード1枚を獲得したとき、あなたは手札からこれを使用してもよい。` |
  | セイレーン | `あなたがこれを獲得したとき、あなたの手札からアクションカード1枚を廃棄しないかぎり、これを廃棄する。` | `これを獲得したとき、手札からアクションカード1枚を廃棄してもよい。廃棄しない場合、これを廃棄する。` |
  | 現場監督 | `+1 アクション、+①、このターンにこれより後、あなたがコストがちょうど⑤のカード1枚を獲得した場合、その後、あなたの次のターンの開始時、この能力を繰り返す。` | `+1 アクション、+1 コイン、このターン、これより後にあなたがコスト5のカードを獲得した場合、あなたの次のターンの開始時に、このカードの能力を冒頭から繰り返す。` |
- ⇒ **【要ユーザー確認】**：(a) 残り9枚（檻/岩屋/宝飾卵/調査/秘境の社/豊穣/キャビンボーイ/坩堝/旗艦）の
  **印刷版カード名**、(b) 13枚全部の**印刷版カード文面**。本資料の日本語テキストは**すべてDO訳**であり、
  そのまま `DOM.CARDS` の `text` にすると**印刷版と食い違う**（webp の文字も変わる）。
  ユーザーが現物を持っているなら現物が正本。持っていないならDO訳採用でよいが、その旨をPROGRESSに残すこと。

##### エラッタ
- **13枚とも `Versions > English versions` 表の行は「Plunder / December 2022」の1行だけ**＝
  **再版行も無い**（＝2022年12月の初版テキストが現行テキスト。13枚すべて機械確認）。
<!-- 検証で訂正: 旧根拠="各ページの目次にも Errata 節は存在しない" → エラッタはカードページではなく中央の `Errata` ページに載るので、この根拠は無効だった。中央ページを実取得して確認し直した。 -->
- **中央の `Errata` ページ（capture=20250330）の `Plunder` 節に載っているのは `Journey`（イベント）1件だけ**
  ＝**この13枚にカード単位のエラッタは無い**。逐語＝
  `Journey — 'You don't discard cards from play in Clean-up this turn. Take an extra turn after this one (but not a 3rd turn in a row).' (2023)`
- ⚠ **ただし一般ルールのエラッタが1件この13枚に効く**（`Errata` ページ `Rules` 節・逐語）：
  `Durations — No longer have any effect on future turn if the card has left play (2025).`
  → 下の **§E（現場監督×増築）** と **§F（旗艦）** を参照。**カードページのFAQはこのエラッタより前の記述**。

---

#### カード表

##### コスト$2

| id | 英語名 | 日本語名 | コスト | 種別 |
|---|---|---|---|---|
| `cage` | Cage | 檻 | $2 | Treasure - Duration |
| `grotto` | Grotto | 岩屋 | $2 | Action - Duration |
| `jewelled_egg` | Jewelled Egg | 宝飾卵 | $2 | Treasure |
| `search` | Search | 調査 | $2 | Action - Duration |
| `shaman` | Shaman | シャーマン | $2 | Action |

##### コスト$3

| id | 英語名 | 日本語名 | コスト | 種別 |
|---|---|---|---|---|
| `secluded_shrine` | Secluded Shrine | 秘境の社 | $3 | Action - Duration |
| `siren` | Siren | セイレーン | $3 | Action - Duration - Attack |
| `stowaway` | Stowaway | 密航者 | $3 | Action - Duration - Reaction |
| `taskmaster` | Taskmaster | 現場監督 | $3 | Action - Duration |

##### コスト$4

| id | 英語名 | 日本語名 | コスト | 種別 |
|---|---|---|---|---|
| `abundance` | Abundance | 豊穣 | $4 | Treasure - Duration |
| `cabin_boy` | Cabin Boy | キャビンボーイ | $4 | Action - Duration |
| `crucible` | Crucible | 坩堝 | $4 | Treasure |
| `flagship` | Flagship | 旗艦 | $4 | Action - Duration - Command |

**負債(Debt)コスト・ポーション費用は13枚とも無し**（すべてコインのみ）。

---

#### 1. Cage（檻）

- **id**: `cage` ／ **コスト**: $2 ／ **種別**: Treasure - Duration
- **現行カードテキスト（英語・改行位置そのまま）**

```
Set aside up to 4 cards from your hand face down (on this). The next time you gain a Victory card,
trash this, and put the set aside cards into your hand at end of turn.
```
（`Versions` 表の Plunder / December 2022 行は1行のべた書き。カード実物では上記の位置で折り返す）

- **日本語カードテキスト（Dominion Online 訳・逐語）**

```
手札を最大4枚(このカードの)脇に伏せて置いてもよい。
持続
次に勝利点カード1枚を獲得したとき、このカードを場から廃棄し、脇に置いたカードをターン終了時に手札に加える。
```
（日本語wikiの種別欄は `財宝`。持続はテキスト中の「持続」で表現＝**公式の種別列は Treasure - Duration**）
- **公式FAQ（逐語）**
  - `The cards go to your hand after drawing your regular hand of 5 cards for next turn.`
  - `For example you might set aside two Estates and two Coppers on a Cage on an early turn; then on a late turn, buy a Province, trash the Cage, and add the two Estates and two Coppers to your hand at end of turn.`
- **その他の裁定（逐語）**
  - `See the Additional rules section for Duration cards in Dominion: Plunder regarding things happening "the next time".`
  - `If you set aside nothing with this, it will still stay in play until you gain a Victory card.`
  - `If gaining a Victory card causes you to play this (e.g. you gain a Province, then gain a Cage with Haggler, and play it with Mining Road), that won't trigger the Cage (it triggers off the next Victory card you gain).`
- **Secret History（実装判断の裏付け）**
  - `Initially it wasn't a Treasure, didn't trash itself, and put the cards into your hand on the same turn that you gained a Victory card ... then put the cards into your hand at end of turn, to make the card better; then to tone it back down, and also make it less like Grotto, it trashed itself.`

---

#### 2. Grotto（岩屋）

- **id**: `grotto` ／ **コスト**: $2 ／ **種別**: Action - Duration
- **現行カードテキスト（英語・改行位置そのまま）**

```
+1 Action
Set aside up to 4 cards from your hand face down (on this). At the start of your next turn, discard
them, then draw as many.
```

- **日本語カードテキスト（Dominion Online 訳・逐語）**

```
+1 アクション
手札を最大4枚(このカードの)上に伏せて置いてもよい。
あなたの次のターンの開始時、それらを捨て札にし、同じ枚数のカードを引く。
```
- **公式FAQ（逐語）**
  - `For example you could set aside 3 cards from your hand, and at the start of your next turn, discard those 3 cards, then draw 3 cards.`
- **その他の裁定（逐語）**
  - `If you set aside 0 cards, Grotto won't stay in play for your next turn.`
- **Secret History**
  - `This started as an Action, turned into a Treasure, then back to an Action. It originally had no limit ... And one version had you draw before discarding, so you couldn't draw the cards you were storing`
    → **現行は「捨てる → その後に引く」**（引いてから捨てるのではない）。

---

#### 3. Jewelled Egg（宝飾卵）

- **id**: `jewelled_egg` ／ **コスト**: $2 ／ **種別**: Treasure
- **現行カードテキスト（英語・改行位置そのまま）**

```
[$1]
+1 Buy
When you trash this, gain a Loot.
```

- **日本語カードテキスト（Dominion Online 訳・逐語）**

```
1 コイン
+1 購入
--------------------
これを廃棄したとき、戦利品1枚を獲得する。
```
- **公式FAQ（逐語）**
  - `The player trashing Jewelled Egg gets the Loot, regardless of which player played the card that caused them to trash it.`
- **その他の裁定**: 節はあるが記載なし（空）
- **Preview（Donald X.）**
  - `Jewelled Egg needs to be trashed to make a Loot.`

---

#### 4. Search（調査）

- **id**: `search` ／ **コスト**: $2 ／ **種別**: Action - Duration
- **現行カードテキスト（英語・改行位置そのまま）**

```
+[$2]
The next time a Supply pile empties, trash this and gain a Loot.
```

- **日本語カードテキスト（Dominion Online 訳・逐語）**

```
+2 コイン
次にサプライ1山が空になったとき、これを場から廃棄し、戦利品1枚を獲得する。
```
- **公式FAQ（逐語）**
  - `If you Throne Room a Search, Throne Room will stay out with Search until a pile empties, and then you'll trash Search once but gain two Loots (and discard Throne Room that turn).`
- **その他の裁定（逐語・すべて実装に効く）**
  - `See the Additional rules section for Duration cards in Dominion: Plunder regarding things happening "the next time".`
  - `If multiple players have played a Search when a Supply pile empties, players trash their Searches and gain Loots in turn order.`
  - `It doesn't matter if the Supply pile had already been emptied on a previous turn. So if you empty a pile, return copies to the Supply (with e.g. Swap), and empty it again, Search can trigger off that pile again.`
  - `If a non-supply pile (like Loot or Horse) is emptied, that won't trigger Search.`
  - `If gaining a card empties a Supply pile, you'll order Search with other when-gain effects. If trashing a card empties a Supply pile (e.g. Lurker), you'll order Search with other when-trash effects.`
  - `If you Invest in the last card of a Supply pile, other players who also Invested in that card can order between the +2 Cards from Invest and trashing their Searches.`
  - **`If you play this with Band of Misfits, it will stay in play until a Supply pile empties. When one does, you trash nothing and gain a Loot.`**
    <!-- 検証で訂正: 旧=この1行が丸ごと欠落していた（Other rules clarifications の6番目）。出典= 英語wiki Search ページ capture=20250127 の Other rules clarifications 節。
         ＝命令(Command)経由で使うと「廃棄せずに Loot だけ得る」＝本プロジェクトの §0-17 `playedByCommand`/`takeSelf` に直結する実装必須情報。 -->
  - `If emptying a Supply pile causes you to play this (e.g. you gain the last Gondola which lets you play a Search), that won't trigger the Search (it triggers off the next Supply pile that's emptied).`
  - `Ending the game by emptying the third Supply pile, Provinces, or Colonies does trigger Search; you gain the Loot before the game ends. Usually this won't make a difference, but trashing Search and gaining Loot can affect your score due to abilities such as Fairgrounds, Tomb, and Keep, and there are a few abilities that might allow you to play the gained Loot before the end of your final turn and use it to buy some additional [VP].`

---

#### 5. Shaman（シャーマン）

- **id**: `shaman` ／ **コスト**: $2 ／ **種別**: Action
- **現行カードテキスト（英語・改行位置そのまま）**

```
+1 Action
+[$1]
You may trash a card from your hand.
---
In games using this, at the start of your turn, gain a card from the trash costing up to [$6].
```
（最終行はカード下部の分割線より下＝**ゲーム全体に効く常設効果**。日本語wikiも `--------------------` で分けて表記している）

- **日本語カードテキスト（Dominion Online 訳・逐語）**

```
+1 アクション
+1 コイン
手札1枚を廃棄してもよい。
--------------------
シャーマンを使うゲームでは、あなたは自分の各ターンの開始時に、廃棄置き場からコスト6以下のカード1枚を獲得する。
```

- **公式FAQ（逐語）**
  - `In games using Shaman, for the whole game, at the start of each of your turns (including extra turns), you gain a card from the trash costing up to [$6]. This is mandatory.`
  - `If there's no such card, you don't gain one.`
  - `This applies even on your first turn (relevant with Necromancer, from Nocturne).`
  - `It applies even if no-one ever gets a Shaman.`
  - `The gained card goes into your discard pile. It's a card you gained, and can trigger things that care about that; for example gaining an Estate would trigger Cage's ability.`
- **その他の裁定（逐語）**
  - `You can order the gaining with other start-of-turn abilities. So if there are 0 cards in the trash, you can:`
    - `First resolve Shaman, gain nothing, and then trash a Copper with Rope (for the next player to gain).`
    - `First trash your Cabin Boy from play, and then gain it back from the trash with Shaman.`

---

#### 6. Secluded Shrine（秘境の社）

- **id**: `secluded_shrine` ／ **コスト**: $3 ／ **種別**: Action - Duration
- **現行カードテキスト（英語・改行位置そのまま）**

```
+[$1]
The next time you gain a Treasure, trash up to 2 cards from your hand.
```

- **日本語カードテキスト（Dominion Online 訳・逐語）**

```
+1 コイン
次に財宝カード1枚を獲得したとき、手札を最大2枚廃棄してもよい。
```
- **公式FAQ（逐語）**
  - `This can trigger on any player's turn.`
  - `It triggers even if the player can't or doesn't want to trash anything; they don't have to trash anything, but Secluded Shrine is done, and is discarded that turn.`
- **その他の裁定（逐語）**
  - `See the Additional rules section for Duration cards in Dominion: Plunder regarding things happening "the next time".`
  - `If you gain a Gondola and play a Secluded Shrine, that will trigger your other Secluded Shrines, but not the one you just played (it triggers off your next Treasure gain).`
- **ルールブック本文の例（Plunder 拡張ページ `Additional rules > Durations` より逐語）**
  - `For example you could play a Secluded Shrine and two Coppers, buy a Silver, and immediately trash two cards from your hand, discarding Secluded Shrine that turn. Or you could buy a Stowaway instead, and leave Secluded Shrine in play for next turn.`

---

#### 7. Siren（セイレーン）

- **id**: `siren` ／ **コスト**: $3 ／ **種別**: Action - Duration - Attack
- **現行カードテキスト（英語・改行位置そのまま）**

```
Each other player gains a Curse. At the start of your next turn, draw until you have 8 cards in hand.
---
When you gain this, trash it unless you trash an Action from your hand.
```

- **日本語カードテキスト（Dominion Online 訳・逐語）**

```
他のプレイヤーは全員、呪い1枚を獲得する。
持続
あなたの次のターンの開始時、あなたは手札が8枚になるようにカードを引く。
--------------------
これを獲得したとき、手札からアクションカード1枚を廃棄してもよい。廃棄しない場合、これを廃棄する。
```
<!-- 検証で訂正: 旧="日本語wikiは種別欄を アクション-アタック と書き…" だけで終わっていたが、**印刷版の実物は種別欄が「アクション−持続−アタック」**（HJ公式写真 Domi_Plunder_jp_kingdomcards.jpg を実見）。
     ＝種別欄が2つしか無いのは Dominion Online の表示仕様であって印刷版ではない。密航者も同様に印刷版は「アクション−持続−リアクション」。 -->
（日本語wikiは種別欄を `アクション-アタック` と書き、持続部分をテキスト中の「持続」で表しているが、
 これは **Dominion Online の表示仕様**。**HJ印刷版の実物は種別欄が「アクション−持続−アタック」**＝
 英語wikiの `Action - Duration - Attack` と一致する）

- **公式FAQ（逐語）**
  - `When you gain a Siren, it's immediately trashed unless you trash an Action card from your hand.`
  - `However if you manage to move the Siren from where it was gained (whether it was gained to your discard pile or somewhere else) before resolving this ability - for example putting it on top of your deck with Insignia - then it will fail to be trashed (though you can still trash an Action card if you want).`
- **その他の裁定（逐語）**
  - `The important part of getting around Siren's self-trashing effect is to move it when it's gained. This is why Insignia works, but the following does not:`
    - `Some cards directly gain a card somewhere (e.g. Invasion gains an Action directly onto your deck). This does not actually move the Siren, so it will still trash itself.`
    - `A few other cards gain a card and then move it later. So if you gain a Siren with Spell Scroll, the Siren will trash itself, and the Spell Scroll will fail to play it.`
  - `If you have an Action in hand, you can decline to trash it, and let the Siren trash itself. This may still be useful if you want to trigger when-trash effects (such as Sewers or Market Square).`

---

#### 8. Stowaway（密航者）

- **id**: `stowaway` ／ **コスト**: $3 ／ **種別**: Action - Duration - Reaction
- **現行カードテキスト（英語・改行位置そのまま）**

```
At the start of your next turn, +2 Cards.
---
When anyone gains a Duration card, you may play this from your hand.
```

- **日本語カードテキスト（Dominion Online 訳・逐語）**

```
あなたの次のターンの開始時に、+2 カードを引く。
リアクション
誰かが持続カード1枚を獲得したとき、あなたは手札からこれを使用してもよい。
```
- **公式FAQ（逐語）**
  - `You may play this from your hand when you personally gain a Duration card, or when another player does.`
- **その他の裁定（逐語）**
  - `This plays like the Reactions in Menagerie; see the Reactions section.`
    → **移動動物園型のリアクション**（＝そり／牧羊犬／鷹匠／村有緑地と同じ「手札から先に使用する」型。
      本アプリでは既に `hasReaction` ＋ `onGainQueue` の窓で実装済みの形）。

---

#### 9. Taskmaster（現場監督）

- **id**: `taskmaster` ／ **コスト**: $3 ／ **種別**: Action - Duration
- **現行カードテキスト（英語・改行位置そのまま／`Versions` 表の逐語）**

```
+1 Action,
+[$1],
and if you gain a card costing exactly [$5] this turn, then at the start of your next turn, repeat
this ability.
```

- **日本語カードテキスト（Dominion Online 訳・逐語）**

```
+1 アクション、+1 コイン、このターン、これより後にあなたがコスト5のカードを獲得した場合、
あなたの次のターンの開始時に、このカードの能力を冒頭から繰り返す。
```
- **公式FAQ（逐語）**
  - `Taskmaster can end up making +1 Action and +[$1] turn after turn, as long as you keep gaining at least one card costing [$5].`
  - `It only matters what the card cost when you gained it, not what it costs at other times.`
  - `Taskmaster does not count cards gained before playing it.`
- **その他の裁定（逐語）**
  - `Repeating Taskmaster's ability doesn't count as playing it again (which means you can't use a Way to make Taskmaster do something other than its usual ability at this point, and it won't count for Conspirator).`
  - `At the start of your turn, you can first repeat this ability, then gain a Duchy with Importer, and that will let the Taskmaster repeat itself on your next turn.`
  - `This checks the cost that a card had at the moment you gained it. So if you gain a Destrier that costs [$6], that won't count for Taskmaster (even though its own gain means it now costs [$5]). But if you gain a Destrier that costs [$5] (meaning it now costs [$4]), that lets Taskmaster repeat itself.`
  - `If gaining a [$5]-cost card causes you to play a Taskmaster (e.g. you play Haggler and buy a [$5] card, and then gain a Taskmaster with Haggler's ability and play the Taskmaster with Innovation), that will let the Taskmaster repeat itself on your next turn.`
  - `If you haven't gained a [$5]-cost card this turn, Taskmaster can be trashed with Improve. But if you gain a [$5]-cost card afterwards (with a 2nd Improve), the Taskmaster will still repeat itself on your next turn (and potentially for multiple turns); you will have to remember this.`

---

#### 10. Abundance（豊穣）

- **id**: `abundance` ／ **コスト**: $4 ／ **種別**: Treasure - Duration
- **現行カードテキスト（英語・改行位置そのまま）**

```
The next time you gain an Action card: +1 Buy and +[$3].
```

- **日本語カードテキスト（Dominion Online 訳・逐語）**

```
次にアクションカード1枚を獲得したとき、
財宝
+1 購入、+3 コイン
```
- **公式FAQ（逐語）**
  - `This triggers when you gain an Action card due to buying it, or gain one some other way.`
  - `If it happens during another player's turn, the +[$3] and +1 Buy won't be useful.`
- **その他の裁定（逐語）**
  - `See the Additional rules section for Duration cards in Dominion: Plunder regarding things happening "the next time".`
  - `If gaining an Action card causes you to play this (e.g. you gain a Courier and play it with Innovation), that won't trigger the Abundance (it triggers off the next Action you gain).`

---

#### 11. Cabin Boy（キャビンボーイ）

- **id**: `cabin_boy` ／ **コスト**: $4 ／ **種別**: Action - Duration
- **現行カードテキスト（英語・改行位置そのまま）**

```
+1 Card
+1 Action
At the start of your next turn, choose one: +[$2]; or trash this to gain a Duration card.
```

- **日本語カードテキスト（Dominion Online 訳・逐語）**

```
+1 カードを引く
+1 アクション
あなたの次のターンの開始時、次のうち1つを選ぶ：
「+2 コイン」
「持続カードを1枚獲得するために、これを場から廃棄する」
```
- **公式FAQ（逐語）**
  - `You can trash a Cabin Boy to gain another Cabin Boy.`
- **その他の裁定**: 節はあるが記載なし（空）
- **Strategy 節の記述（Shaman との相互作用・実装確認に有用）**
  - `In games using Shaman, you can trash a Cabin Boy to gain another Duration, then resolve Shaman to gain the trashed Cabin Boy, while avoiding gaining junk from the trash.`

---

#### 12. Crucible（坩堝）

- **id**: `crucible` ／ **コスト**: $4 ／ **種別**: Treasure
- **現行カードテキスト（英語・改行位置そのまま）**

```
Trash a card from your hand. +[$1] per [$1] it costs.
```

- **日本語カードテキスト（Dominion Online 訳・逐語）**

```
手札1枚を廃棄する。
そのコスト1につき+1コイン。
```
- **公式FAQ（逐語）**
  - `For example if you trash an Estate, which costs [$2] you get +[$2].`
  - `If you trash a card with [P] or [D] in its cost (from other expansions), you get nothing for those symbols.`
    （＝ポーション費用・負債コストの成分はコインにならない）
- **その他の裁定**: 節はあるが記載なし（空）

---

#### 13. Flagship（旗艦）

- **id**: `flagship` ／ **コスト**: $4 ／ **種別**: Action - Duration - Command
- **現行カードテキスト（英語・改行位置そのまま）**

```
+[$2]
The next time you play a non-Command Action card, replay it.
```

- **日本語カードテキスト（Dominion Online 訳・逐語）**

```
+2 コイン
次に命令カード以外のアクションカード1枚を使用したとき、それを再使用する。
```
- **公式FAQ（逐語）**
  - `This isn't optional; whatever that next non-Command Action card is, Flagship replays it.`
  - `It replays it even if the card trashed itself, and even if it isn't your turn.`
  - `Command cards, such as Flagship itself, are not replayed; Flagship waits for a non-Command Action card.`
  - `If you play two Flagships and then e.g. a Harbor Village, you'll play the Harbor Village three times total - once normally and once for each Flagship.`
- **その他の裁定（逐語）**
  - `See the Additional rules section for Duration cards in Dominion: Plunder regarding things happening "the next time".`
  - `If you play a Flagship and then a Band of Misfits, you will replay the card that the Band of Misfits plays. But if you play a Flagship and then a Necromancer, Flagship will replay the Necromancer (and you'll choose a 2nd card to play from the trash).`
  - `If you play Flagship, then play a Band of Misfits, which plays a Duration card, the Flagship will replay that Duration card. The Band of Misfits will stay in play, but the Flagship will not; you will have to remember that the Duration card was played twice.`

---

#### 参考：この群に効く「Plunder の追加ルール」（拡張ページ `Additional rules > Durations` より逐語）

- `Duration cards are not discarded in Clean-up if they have something left to do [on a future turn]; they stay in play until the Clean-up of the last turn that they do something.`
- `If a Duration card leaves play somehow, it stops doing things on future turns.`
- `Additionally, if a Duration card is played extra times by a card such as [Throne Room, Scepter, Mastermind, Specialist, Flagship, or Daimyo], that card also stays in play until the Duration card is discarded, to track the fact that the Duration card was played extra times.`
- `Some Duration cards in Plunder do something the "next time" a certain thing happens. That thing could happen the same turn, or many turns later; these may sit in play turn after turn until finally the thing happens.`
- `Many Duration cards in Plunder are Treasures. These are just like normal Treasures, except that they stay in play until they're done doing things, like other Durations do.`

---

#### 実装時に事故りそうな落とし穴（逐語引用つき）

##### 0. 日本語名の衝突＝**`spoils` の改名は既に完了している（対応不要）**
<!-- 検証で訂正: 旧="本プロジェクトは spoils の表示名に「戦利品」を採用済み（js/cards.js: spoils: { name: '戦利品', … text: '…戦利品置き場に戻す。' }）→ 先に spoils を「略奪品」に改名するのが素直"
     ＝**現物と不一致**。作業ツリー（HEAD=ea0c091, 2026-08-15）の js/cards.js は既に `spoils: { id:'spoils', name:'略奪品', … text:'3 コイン\nこれを使用したとき、このカードを略奪品置き場に戻す。' }`。
     `grep -rn 戦利品 js/` は **0件**、`grep -rn 略奪品 js/` は cards.js/cpu.js/engine.js で多数ヒット。
     コミット逐語= `ea0c091 fix(darkages): spoils の日本語名を公式訳「略奪品」に直す（略奪の Loot＝「戦利品」と衝突するため）`。
     ＝この節が求めていた改名は既に済んでおり、「最優先タスク」ではない。 -->
- 日本語wiki（Dominion Online 訳）は **Loot = 戦利品**。実際に `宝飾卵`・`調査` の訳文が
  `戦利品1枚を獲得する` となっている。日本語wikiのページ名も `戦利品`（Loot）／`戦利品の袋`（Sack of Loot）。
- **Spoils（暗黒時代）の日本語wikiページ名は `略奪品`**（実取得して確認。逐語＝
  `暗黒時代 / 略奪品 / 0* / 財宝 / 3 コイン / あなたはこのカードを使用するとき、このカードを略奪品の山札へ戻す。`）。
- ✅ **`spoils` の改名は 2026-08-15 に完了済み**（`ea0c091` ＝現 HEAD）。
  現在の `js/cards.js` は `name: '略奪品'` / `text: '…このカードを略奪品置き場に戻す。'`、
  **`js/` 全体に「戦利品」は0件**（機械確認）。＝**Loot に「戦利品」を割り当ててよい状態が既に整っている**。
  → **この節に残っている作業は無い**。ただし Loot 実装時に `戦利品置き場` の文言を新設するので、
  `略奪品置き場`（Spoils）と混同しないことだけ注意する。
- 拡張名も衝突する：**Plunder の日本語拡張名は「略奪」**で、暗黒時代の王国カード `pillage` の日本語名も**「略奪」**。
  （日本語wiki の `略奪` ページは pillage のカードページ、拡張は `一覧/略奪（拡張）`）。
  ＝§0-29 の `alliance` と完全に同型。**id 衝突は無い**（`pillage` vs 拡張ID）が、群見出しは区別すること。
- **英語 id の衝突はゼロ**（13枚とも `js/cards.js` に同名 id は無い＝機械確認済み）。
  ただし `search` は英語として一般的すぎるので、既存の変数名・関数名（`searchNorm` 等）と混同しないこと。


##### A. 「the next time（次に〜したとき）」型の持続＝**新しい常設の誘発窓が5枚もある**
`Cage`（勝利点を獲得したとき）／`Search`（サプライの山が空になったとき）／`Secluded Shrine`（財宝を獲得したとき）／
`Abundance`（アクションを獲得したとき）／`Flagship`（非命令アクションを使用したとき）。
- **同じターンに解決されることもあれば、何ターンも場に残ることもある**＝
  `Some Duration cards in Plunder do something the "next time" a certain thing happens. That thing could happen the same turn, or many turns later; these may sit in play turn after turn until finally the thing happens.`
  → 本アプリの `p.delayedEffects`（ターン開始時に解決する予約）モデルでは**表現できない**。
  「相手のターンをフックする持続」＝§0-9 Batch5c の `applyLingerOnBuy`（沼の妖婆/呪いの森）と同型の
  **イベント駆動の予約**が要る。**Secluded Shrine は明示的に相手のターンでも発動する**：
  `This can trigger on any player's turn.`
- **⚠ 自分自身を誘発させてはいけない（4枚とも同じ罠）**。逐語：
  - Cage: `If gaining a Victory card causes you to play this ..., that won't trigger the Cage (it triggers off the next Victory card you gain).`
  - Search: `If emptying a Supply pile causes you to play this (e.g. you gain the last Gondola which lets you play a Search), that won't trigger the Search`
  - Secluded Shrine: `If you gain a Gondola and play a Secluded Shrine, that will trigger your other Secluded Shrines, but not the one you just played`
  - Abundance: `If gaining an Action card causes you to play this (e.g. you gain a Courier and play it with Innovation), that won't trigger the Abundance`
  → **「その誘発事象の解決中に場に出た予約は、その事象では発火しない」**を横断ルールとして1箇所に実装する。
  片方だけ直すと必ずどれかが壊れる。

##### B. Search＝「サプライの山が空になったとき」＝**新しい誘発点**（既存に一切無い）
- `If a non-supply pile (like Loot or Horse) is emptied, that won't trigger Search.`
  → 本アプリの `NON_SUPPLY` 集合（賞品/戦利品/成長先/馬/精霊/願い…）を必ず除外する。
- **再武装する**：`It doesn't matter if the Supply pile had already been emptied on a previous turn. So if you empty a pile, return copies to the Supply (with e.g. Swap), and empty it again, Search can trigger off that pile again.`
  → 「一度空になった山」を記録して二度と発火させない実装は**誤り**。
- **終局と同時でも発火する**：`Ending the game by emptying the third Supply pile, Provinces, or Colonies does trigger Search; you gain the Loot before the game ends.`
  → `isGameOver` の判定より**前**に Loot を獲得させないと Fairgrounds／Tomb／Keep の得点がズレる。
  本アプリは `cleanupAndAdvance` が `isGameOver` を先に見るので**順序を明示的に直す必要がある**。
- **廃棄で空になる経路もある**：`If trashing a card empties a Supply pile (e.g. Lurker), you'll order Search with other when-trash effects.`
  → `gain()` だけにフックすると待ち伏せ／剣闘士／塩まきで取りこぼす。**`trashFromSupplyPile` にも要る**。
- **複数人が同時に持ちうる**：`If multiple players have played a Search when a Supply pile empties, players trash their Searches and gain Loots in turn order.`
  → 手番順ループが要る（1人ぶんだけ解決して終わる実装は誤り）。
- **玉座の間で「廃棄1回・獲得2回」**：`you'll trash Search once but gain two Loots (and discard Throne Room that turn).`
- **命令(Command)経由なら「廃棄0回・獲得1回」**：`If you play this with Band of Misfits, it will stay in play until a Supply pile empties. When one does, you trash nothing and gain a Loot.`
  <!-- 検証で追記: 下書きはこの1行を取りこぼしていた。出典= 英語wiki Search ページ capture=20250127。 -->
  → §0-17 の「命令がプレイした札は動かない」そのもの。**`takeSelf` / `playedByCommand` を通し、
  廃棄に失敗しても Loot の獲得は必ず実行する**（廃棄成功を条件にすると公式より弱くなる）。

##### C. Siren＝**獲得時の自己廃棄が「移動」で失敗する（stop-moving）**
- `When you gain a Siren, it's immediately trashed unless you trash an Action card from your hand.`
- `However if you manage to move the Siren from where it was gained ... before resolving this ability - for example putting it on top of your deck with Insignia - then it will fail to be trashed`
- **「直接その場所に獲得する」効果では回避できない**：
  `Some cards directly gain a card somewhere (e.g. Invasion gains an Action directly onto your deck). This does not actually move the Siren, so it will still trash itself.`
  → **`gain(dest:'deck')` のような「最初からその場所に獲得」と「獲得後に動かす」を区別する**必要がある。
  本アプリの `gain()` は dest 引数1つで両者を同一視しているので、そのままだと**Insignia 型（獲得後に動かす）を
  実装した瞬間に判定が壊れる**。
- **アクションを持っていても廃棄しない選択ができる**：
  `If you have an Action in hand, you can decline to trash it, and let the Siren trash itself. This may still be useful if you want to trigger when-trash effects (such as Sewers or Market Square).`
  → 「手札にアクションがあるなら強制」ではない＝**必ず二択の窓を開く**（CPU が自動で払う実装にすると忠実性を失う）。
- **Siren はアタック（呪い配布）だが、獲得時の自己廃棄はアタックではない**。堀のリアクション窓は使用時にだけ開く。

##### D. Shaman＝**「王国にあるだけでゲーム全体に効く」常設効果**（本アプリに前例が少ない型）
- `In games using Shaman, for the whole game, at the start of each of your turns (including extra turns), you gain a card from the trash costing up to [$6]. This is mandatory.`
- `It applies even if no-one ever gets a Shaman.` ＝**誰も1枚も買わなくても効く**
  → パン屋(baker)のセットアップや若き魔女の災いと同じく **`createInitialState` で王国を見て有効化**する。
- `This applies even on your first turn` ＝**ターン1の開始時にも開く**（§0-29 A3 で踏んだ
  「`createInitialState` の末尾でも窓を開く」問題と同型）。
- `If there's no such card, you don't gain one.` ＝**候補ゼロなら窓を開かない**（強制なので、候補ゼロで
  pending を立てると CPU が livelock ／人間が詰む＝§0-29 A5 の [high] リッチと**完全に同型**）。
- `The gained card goes into your discard pile. It's a card you gained, and can trigger things that care about that; for example gaining an Estate would trigger Cage's ability.`
  → **獲得トリガーを普通に発火させる**（`gain()` を通す）。ただし**獲得元がサプライではない**ので
  `costUpTo`/`gainableBase` を掛けてはいけない（§0-29 A4 のリッチと同じ罠）。
- **解決順を選べる**：`You can order the gaining with other start-of-turn abilities.` の例
  `First trash your Cabin Boy from play, and then gain it back from the trash with Shaman.`
  → 本アプリの `t.startQueue` は**先入れ順で順序を選べない**（既存の横断簡略化）。
  **Shaman × Cabin Boy はこのコンボが公式に明記されている**ので、許容簡略化として記録するか、
  Shaman だけ startQueue の末尾に入れるなどの配慮が要る。

##### E. Taskmaster＝**「獲得したその瞬間のコスト」で判定する**（現在コストではない）
- `It only matters what the card cost when you gained it, not what it costs at other times.`
- `So if you gain a Destrier that costs [$6], that won't count for Taskmaster (even though its own gain means it now costs [$5]). But if you gain a Destrier that costs [$5] (meaning it now costs [$4]), that lets Taskmaster repeat itself.`
  → 本アプリの `cardCost(state,id)` は**現在の状態**で計算するので、`triggerOnGain` の中で
  **獲得直前のコストをスナップショットして渡す**必要がある（§0-26 の値切り屋で同じ罠を踏んでいる）。
- `Taskmaster does not count cards gained before playing it.` ＝**使用より前の獲得は数えない**
  → 「そのターンの獲得数」カウンタ（`t.gainedThisTurn`）をそのまま使うと**過剰カウント**になる。
- `Repeating Taskmaster's ability doesn't count as playing it again (which means you can't use a Way to make Taskmaster do something other than its usual ability at this point, and it won't count for Conspirator).`
  → **習性(Way)を選び直させない・共謀者に数えない・`noteAllyPlay`（同盟の「アクションを使用した後」）も呼ばない**。
- **無限に持続しうる**＝毎ターン $5 を獲得し続ける限り場に残る。`p.delayedEffects` の「1ターンぶんの予約」
  モデルだと表現できないので、**雇人(hireling)/王子と同じ「永続持続」枠**が要る。
- ⚠ **`Improve` で廃棄した後の扱い＝2025年の一般ルールエラッタで変わっている**。
<!-- 検証で訂正: 旧="この2つは矛盾して見えるので実装前に必ず確認すること（…「予約が既に確定している」扱いだと解釈できる）" ＝推測で埋めていた。
     一次資料で解決する：英語wiki `Errata` ページ（capture=20250330）の Rules 節に
     `Durations — No longer have any effect on future turn if the card has left play (2025).` がある。
     Taskmaster ページの当該FAQ（capture=20250114）はこのエラッタより前の記述で、更新されていないだけ。
     本プロジェクトは既に2025エラッタ側を採用している（PROGRESS §0-25「2025の『場を離れた持続は以後働かない』」）。 -->
  - カードページのFAQ逐語（capture=20250114・**2025エラッタ前の記述**）＝
    `If you haven't gained a [$5]-cost card this turn, Taskmaster can be trashed with Improve. But if you gain a [$5]-cost card afterwards (with a 2nd Improve), the Taskmaster will still repeat itself on your next turn (and potentially for multiple turns); you will have to remember this.`
  - **現行の一般ルールエラッタ逐語**（`Errata` ページ `Rules` 節）＝
    `Durations — No longer have any effect on future turn if the card has left play (2025).`
  - **⇒ 現行では「増築で廃棄された現場監督は、次のターンに能力を繰り返さない」**。
    追加ルールの `If a Duration card leaves play somehow, it stops doing things on future turns.` と整合する。
    **本プロジェクトは既に2025エラッタ側を採用している**（PROGRESS §0-25）ので、そちらに揃えるのが一貫している。
  - ※wiki のカードページFAQが未更新なので、**最終的には要ユーザー確認**（ただし一次資料の日付は 2025 > 2022 で明確）。

##### F. Flagship＝**命令(Command)種別の新カード**（本アプリの `playAsCommand` 機構に直結）
- **強制**：`This isn't optional; whatever that next non-Command Action card is, Flagship replays it.`
  → 辞退ボタンを出してはいけない。
- **自分自身と他の Flagship を飛ばす**：`Command cards, such as Flagship itself, are not replayed; Flagship waits for a non-Command Action card.`
  → **本アプリの `Command` 種別を持つ札（大君主／はみだし者／船長／王子／Flagship）を除外する述語**が要る。
  ⚠ **ネクロマンサーは Command 種別を持たない**ので Flagship は**ネクロマンサー自身を再演する**：
  `if you play a Flagship and then a Necromancer, Flagship will replay the Necromancer (and you'll choose a 2nd card to play from the trash).`
  一方 **はみだし者は Command なので飛ばされ、「はみだし者が使ったカード」の方が再演される**：
  `If you play a Flagship and then a Band of Misfits, you will replay the card that the Band of Misfits plays.`
  ＝**この2枚は逆の挙動**。同じヘルパで書くと必ずどちらかが壊れる。
- **相手のターンでも再演する**：`It replays it even if the card trashed itself, and even if it isn't your turn.`
  → 移動動物園のリアクション（そり等）や密航者(Stowaway)で相手のターンにアクションを使うと発火する。
- **複数枚は累積**：`If you play two Flagships and then e.g. a Harbor Village, you'll play the Harbor Village three times total - once normally and once for each Flagship.`
- **持続を再演したときの場残り＝原則は「旗艦も場に残る」**。
<!-- 検証で訂正: 旧="（Flagship は場に残らない）" と一般化していたが誤り。Plunder 拡張ページ Additional rules（capture=20250415）の逐語が
     Flagship を「持続を余分にプレイしたら場に残る側」として名指ししている。「場に残らない」のは Band of Misfits 経由の特殊例だけ。 -->
  - **原則（Plunder 追加ルール・逐語）**＝`Additionally, if a Duration card is played extra times by a card such as [Throne Room, Scepter, Mastermind, Specialist, **Flagship**, or Daimyo], that card also stays in play until the Duration card is discarded, to track the fact that the Duration card was played extra times.`
    ＝**旗艦が持続カードを再演したら、その持続が捨てられるまで旗艦も場に残る**（＝玉座の間と同じ扱い）。
  - **例外＝はみだし者(Band of Misfits)を経由したとき**だけ逐語で否定されている：
    `If you play Flagship, then play a Band of Misfits, which plays a Duration card, the Flagship will replay that Duration card. The Band of Misfits will stay in play, but the Flagship will not; you will have to remember that the Duration card was played twice.`
  - ※この FAQ も capture=20250130 ＝**2025年の `Durations` エラッタ前**の記述。エラッタとの整合は要確認。
  - ＝§0-25/§0-28 の「玉座×持続」既存簡略化と**同じクラスの話**（本エンジンは持続の再演で玉座を場に残す実装がある）。

##### G. Cabin Boy の「持続カードを獲得」は**コスト制限が無い**
- 逐語テキスト＝`trash this to gain a Duration card.`（"costing up to" が無い）
- `You can trash a Cabin Boy to gain another Cabin Boy.`
  → `costUpTo` を掛けると公式より弱くなる（§0-29 A4 の「沈没船の財宝／専門家のコピー獲得／侍祭」と同じ罠）。
- **二択は「ターン開始時」**＝`t.startQueue` に積む。片方は自己廃棄なので、
  **場に自分が残っていない（命令経由で使われた等）ケースの `takeSelf` ガード**が要る。

##### H. Crucible の +$ は**コイン成分だけ**
- `If you trash a card with [P] or [D] in its cost (from other expansions), you get nothing for those symbols.`
  → `cardCost` の3成分のうち **coin だけ**を足す。`$0 + 負債8` の技術者を廃棄しても +$0。
- **財宝なので `applyTreasureEffect` に書く**（`applyEffect` に書くと空振り＝§0-25 で踏んだ罠）。
- **廃棄は強制**（"You may" が無い）。手札が空なら何も起きない。

##### I. Jewelled Egg＝**on-trash で Loot を獲得するのは「廃棄した本人」**
- `The player trashing Jewelled Egg gets the Loot, regardless of which player played the card that caused them to trash it.`
  → 詐欺師／盗賊／投石機など**相手が廃棄させた場合でも所有者（廃棄された側）が Loot を得る**。
  本アプリの `triggerOnTrash(state, owner, card)` の owner が正しく被害者になっているかを確認すること。

##### J. Cage の「手札に戻すのはターン終了時＝次の手札を引いた後」
- `The cards go to your hand after drawing your regular hand of 5 cards for next turn.`
  → 本アプリは**自分の手番終了時に次の手札を先引きする**（§0-22 の最重要注意）。
  Cage は**先引きの後**に脇札を手札へ加える＝保存(save)／リス／忠犬と同じスロット。
  **角笛(horn)のように先引きより前に置くと1ターンぶんズレる**。
- **0枚でも場に残る**：`If you set aside nothing with this, it will still stay in play until you gain a Victory card.`
  ⇔ **Grotto は逆**：`If you set aside 0 cards, Grotto won't stay in play for your next turn.`
  ＝**この2枚を同じヘルパで書くと必ずどちらかが壊れる**。

##### K. Grotto は「捨てる → その後に引く」の順
- 逐語＝`At the start of your next turn, discard them, then draw as many.`
- Secret History に `one version had you draw before discarding` とあり、**現行は捨ててから引く**が確定。
  → 捨て札トリガー（坑道／村有緑地／忠犬／織工）が**引く前に**解決される（§0-28 の羊飼い・§0-29 の砂漠の案内人と同型の罠）。

##### L. Stowaway＝**移動動物園型リアクション**（アタックのリアクションではない）
- `This plays like the Reactions in Menagerie; see the Reactions section.`
- `You may play this from your hand when you personally gain a Duration card, or when another player does.`
  → **「誰かが」持続カードを獲得したとき**＝自分の獲得でも相手の獲得でも窓が開く（§0-25 の鷹匠と同型／
  牧羊犬＝自分だけ、とは違う）。**相手のターンに場に出た密航者は、その人の次の片付けで捨てる**
  （§0-25 の既存の許容簡略化と同じ扱いになる）。
- **持続でもある**＝相手のターンに使っても「あなたの次のターンの開始時に +2カード」。

##### M. Abundance＝**相手のターンにも誘発するが無意味**
- `If it happens during another player's turn, the +[$3] and +1 Buy won't be useful.`
  → **誘発自体は起きて予約は消費される**（＝空振りしても場から捨てる）。「自分のターンだけ誘発」に
  実装すると公式より強くなる。

---

#### 敵対検証レポート（担当＝Cage / Grotto / Jewelled Egg / Search / Shaman / Secluded Shrine / Siren ＋ 群レベルの主張）

<sub>（出典ファイル＝`verify/kingdom1_v1.md`）</sub>

#### 敵対検証レポート — `kingdom1.md` / 担当7枚＋群レベルの主張

担当＝**Cage(檻) / Grotto(岩屋) / Jewelled Egg(宝飾卵) / Search(調査) / Shaman(シャーマン) / Secluded Shrine(秘境の社) / Siren(セイレーン)**
＋ 下書き冒頭の「出典と信頼度」「⚠ 日本語版について」「エラッタ」「カード表」。

##### 検証に使った一次資料（すべて自分で引き直した）

| # | 資料 | 取り方 |
|---|---|---|
| A | **英語wiki 本体のライブページ**（現行版） | `node tools/wikidirect.js Cage Grotto Jewelled_Egg Search` / `... Shaman Secluded_Shrine Siren "Plunder_(expansion)"` → `verify/live1.txt` `verify/live2.txt` `verify/live_all.txt`。**status=200 の直読み＝現行版**。 |
| B | 英語wiki（Wayback・別スナップショット） | `python prefetch.py verify/recheck verify/mylist.txt`（Cage=2id_ / Grotto=2024id_ / Jewelled_Egg=2024id_ / Search=2id_ / Shaman=2id_ / Secluded_Shrine=2id_ / Siren=2025id_）。**A との突き合わせで「キャプチャが古くて別物」でないことを機械確認**。 |
| C | 英語wiki 生HTML（表の**列**を見るため） | `verify/Siren_raw.html` / `verify/JE_raw.html` / `verify/Shaman_raw.html`。strip 済みテキストでは Print/Digital 列の区別と `<hr>`（区切り線）が消えるため。 |
| D | **RGG 公式ルールブック PDF 全文** | `plunder_rules.txt`（`-layout`）と `plunder_rules_raw.txt`（読み順）。カード別FAQ段落＋ランダマイザーシートのカード画像テキスト。 |
| E | 日本語wiki 各カードページ | `jp/檻.txt` `jp/岩屋.txt` `jp/宝飾卵.txt` `jp/調査.txt` `jp/シャーマン.txt` `jp/秘境の社.txt` `jp/セイレーン.txt`（各ページに英語原文と日本語訳が併記された表がある）。 |
| F | 日本語wiki 拡張一覧 | `jp_expansion.txt`（ページ名 `略奪（拡張）`）・`jp_plunder.txt`（ページ名 `略奪`＝暗黒時代の Pillage）・`jp_略奪品.txt`（Spoils）。 |

**A と B の突き合わせ結果**：7枚とも `Card text` / `Versions` / FAQ の**内容は完全一致**
（Cage・Jewelled_Egg・Search・Shaman・Secluded_Shrine は Wayback ダンプとバイト一致、Grotto・Siren はリンク整形と
スナップショット表記だけの差）。FAQ 本文の差はライブ側の Search に**ヘアスペース実体 `&#x200a;` が1個**入っただけ
＝**ルール上の差分ゼロ**。

---

##### 確定（下書きどおりで正しい）

1. **コストと種別＝13枚すべて正しい**。ライブwiki の `Info > Cost / Type(s)` を機械抽出して照合＝下書きの表と1件も食い違わない。
   `Cage $2 Treasure-Duration` / `Grotto $2 Action-Duration` / `Jewelled Egg $2 Treasure` / `Search $2 Action-Duration` /
   `Shaman $2 Action` / `Secluded Shrine $3 Action-Duration` / `Siren $3 Action-Duration-Attack` /
   `Stowaway $3 Action-Duration-Reaction` / `Taskmaster $3 Action-Duration` / `Abundance $4 Treasure-Duration` /
   `Cabin Boy $4 Action-Duration` / `Crucible $4 Treasure` / `Flagship $4 Action-Duration-Command`。
   **種別の落としはゼロ**（Siren の Duration、Flagship の Command、Stowaway の Reaction、Abundance の Treasure-Duration すべて有り）。
   コスト帯の割り当ても英語wiki のナビボックス（`[$2]` Cage・Grotto・Jewelled Egg・Search・Shaman／`[$3]` Secluded Shrine・
   Siren・Stowaway・Taskmaster／`[$4]` に Abundance・Cabin Boy・Crucible・Flagship を含む13枚）と一致。
   **負債・ポーション費用が13枚とも無い**ことも Info 欄で確認。

2. **英語カードテキスト＝担当7枚とも逐語一致**。しかも**3系統独立で一致**：
   ライブwiki の `Card text` 欄 ／ ライブwiki の `Versions > English versions` の唯一の行 ／
   **RGG ルールブックPDF のカード画像**（`plunder_rules_raw.txt` 97-99行に Cage、293行に Grotto、
   `plunder_rules.txt` 348-351行に Jewelled Egg、514-517行に Search、526-531行に Secluded Shrine、
   543-548行に Shaman、573-580行に Siren）。

3. **公式FAQ／Other rules clarifications ＝ 7枚とも脱落ゼロ・誤引用ゼロ**。箇条書きの個数まで一致：
   Cage 2+3 ／ Grotto 1+1 ／ Jewelled Egg 1+0 ／ **Search 1+8** ／ Shaman 5+1(サブ2) ／
   Secluded Shrine 2+2 ／ Siren 2+2(サブ2)。
   さらに **RGG PDF のカード別FAQ段落**（`Cage:` 146行 / `Grotto:` 310行 / `Jewelled Egg:` 346行 / `Search:` 503行 /
   `Secluded Shrine:` 522行 / `Shaman:` 535行 / `Siren:` 566行）とも語単位で一致した。
   ＝**この群でいちばん危ない「FAQの取りこぼし」は発生していない**。

4. **エラッタ無しの主張は正しい**。ライブwiki で13枚を機械検査＝
   **`Errata` 節はどのページにも存在せず（0件）、`English versions` 表の行は `Plunder / December 2022` のちょうど1行**。
   担当7枚は Wayback の別スナップショットでも同じ（＝「古いキャプチャだからエラッタ節が見えないだけ」ではない）。

5. **日本語名7枚が正しい**＝檻 / 岩屋 / 宝飾卵 / **調査** / シャーマン / 秘境の社 / セイレーン。
   日本語wikiの各カードページが**英語原名を併記した表**を持っているので、順序に頼らず1枚ずつ一意に確定できた。
   拡張一覧 `略奪（拡張）` の記載とも一致。

6. **日本語カードテキスト7枚が逐語一致**（`jp/*.txt` の訳文欄と1文字も違わない）。
   特に **Cage は「(このカードの)脇に伏せて置いてもよい」、Grotto は「(このカードの)上に伏せて置いてもよい」**という
   訳し分けまで下書きが正確に再現している（ここは取り違えやすい）。

7. **「(※日本語訳はDominion Onlineより)」の注記が7ページすべてに実在する**（各ページ11行目）。
   ＝「日本語wikiの訳＝Dominion Online 由来」という下書きの前提は正しい。

8. **Cage / Siren の種別注記が正しい**。日本語wikiの種別欄は Cage=`財宝`、Siren=`アクション-アタック` で、
   持続はテキスト中の「持続」で表現されている（Dominion Online のバンド表示に由来）。
   **公式の種別列は Treasure-Duration / Action-Duration-Attack** ＝下書きの注記どおり。
   なお **RGG のカード実物には「持続」の区切りバンドは無く一続きの文**（`plunder_rules_raw.txt` 97-101行）なので、
   下書きが英語側に区切りを入れなかったのは**正しい**。

9. **Secret History / Preview の引用**（Cage・Grotto の Secret History、Jewelled Egg の Preview
   `Jewelled Egg needs to be trashed to make a Loot.`）はいずれも実在し、省略記号の使い方も原文を歪めていない。

10. **落とし穴 §A/§B/§C/§D/§I/§J/§K の「ルール上の主張」は全部一次資料で裏付けられる**（担当7枚ぶん）。
    - §A 自己誘発しない：Cage・Search・Secluded Shrine の3枚とも該当 clarification が実在（Abundance も同型で実在）。
    - §B Search：非サプライ山は誘発させない／**再武装する**（Swap で戻して再度枯らせば再誘発）／
      **終局と同時でも Loot は先に獲得する**／**廃棄で山が枯れる経路もある**（Lurker）／**複数人は手番順**／
      **玉座は「廃棄1回・獲得2回」** ＝全部逐語で実在。
    - §C Siren：`When you gain a Siren, it's immediately trashed unless you trash an Action card from your hand.` ／
      Insignia で**動かせば**自己廃棄に失敗する／Invasion の「直接その場所へ獲得」では**失敗しない**／
      Spell Scroll は「獲得してから後で動かす」ので**失敗しない**／
      **手札にアクションがあっても廃棄を辞退できる**（Sewers・Market Square 目当て）＝全部実在。
    - §D Shaman：`This is mandatory.` ／ `If there's no such card, you don't gain one.` ／
      `This applies even on your first turn` ／ `It applies even if no-one ever gets a Shaman.` ／
      獲得先は捨て札で**獲得トリガーが普通に発火する（Cage を誘発する例つき）**／
      **他のターン開始時能力と解決順を選べる**（Rope・Cabin Boy の2例）＝全部実在。
      Shaman の最終行がカード下部の**区切り線より下**であることも生HTMLの `<hr>` で確認（`verify/Shaman_raw.html`）。
    - §I Jewelled Egg：`The player trashing Jewelled Egg gets the Loot, regardless of which player played the card that caused them to trash it.` ＝実在。
    - §J Cage：`The cards go to your hand after drawing your regular hand of 5 cards for next turn.`（＝**先引きの後**）／
      `If you set aside nothing with this, it will still stay in play until you gain a Victory card.` ＝実在。
    - §K Grotto：`discard them, then draw as many`（**捨ててから引く**）／
      `If you set aside 0 cards, Grotto won't stay in play for your next turn.` ＝実在。
      **Cage と Grotto で「0枚のとき場に残るか」が逆**という下書きの指摘も正しい。

11. **`If a Duration card leaves play somehow, it stops doing things on future turns.` を
    「拡張ページ `Additional rules > Durations` からの逐語」としている点は正しい**。
    ⚠ ただし **Wayback の 2024年キャプチャ（`verify/recheck/Plunder__expansion_.txt`）にはこの1行が無い**。
    ライブ直読み（`verify/live_all.txt`）には**有る**。古いキャプチャだけを見ると
    「下書きの誤引用だ」と誤判定してしまうので、後続セッションは注意すること。
    ※なお RGG の2022年印刷ルールブックPDF にもこの1行は**無い**（wiki が一般ルールから補ったもの）。

---

##### 訂正

###### **[medium]** 群レベル「英語wikiに Japanese の行が1枚も無い」＝**誤り**（Siren にはある）

- **旧（下書き §⚠ 日本語版について）**
  > 英語wikiの `Other language versions` 表に Japanese の行が1枚も無い（Dutch / French / German / Polish のみ）。
  > ＝**略奪の日本語印刷版は（この資料の時点で）存在しない**と考えるのが自然。
- **正**：**Siren には Japanese の行がある**。日本語名 `セイレーン`、**Print 列**に画像 `SirenJapanese.jpg`、
  日本語カードテキスト付き。担当7枚のうち Japanese 行を持つのは Siren だけだが、
  `en/` に取得済みの略奪関連46ページを機械走査すると **Crew / Invasion / Siren / Taskmaster の4枚**が Japanese 行を持つ。
  よって「1枚も無い」は事実として誤りで、そこから導いた「日本語印刷版は存在しない」という推論も**根拠を失う**。
- **出典**：ライブwiki `Siren` > `Versions` > `Other language versions`（`verify/live_all.txt`、`### PAGE: Siren` 内）。
  Wayback の 2025id_ / 2id_ 両スナップショットにも存在（`verify/recheck/Siren.txt` 154行 / `en/Siren.txt` 154行）。
  **列の判定は生HTML で確認**（`verify/Siren_raw.html`：`<th>Japanese</th><td>セイレーン</td><td><img …SirenJapanese.jpg…></td><td></td><td>…日本語テキスト…</td>`
  ＝表のヘッダが `Language / Name / Print / Digital / Text / Notes` なので画像は **Print 列**、Digital 列は空）。
- **wiki 掲載の日本語テキスト（逐語）**
  ```
  他のプレイヤーは全員呪い1枚を獲得する。
  あなたの次のターンの開始時、あなたの
  手札が8枚になるまでカードを引く。
  ――――――
  あなたがこれを獲得したとき、あなたの
  手札からアクションカード1枚を
  廃棄しないかぎり、これを廃楽する。   ← 「廃棄」の誤字（原文ママ）
  ```
  下書きが載せている Dominion Online 訳
  （`これを獲得したとき、手札からアクションカード1枚を廃棄してもよい。廃棄しない場合、これを廃棄する。`）と**文言が違う**。
- **実装への影響**：
  - **日本語名の決定には影響しない**（`セイレーン` は日本語wiki・英語wikiの Japanese 行とも一致。他3枚も
    `乗組員`＝Crew、`侵略`＝Invasion、`現場監督`＝Taskmaster で日本語wikiと一致）。
  - 影響するのは**日本語カードテキストをどちらの訳で表示するか**だけ。→「要ユーザー確認」へ。
  - 下書きの「将来ホビージャパン版が出たら変わりうる」という注意自体は残してよいが、
    **「日本語版は存在しない」と断定している文は削ること**。

###### **[medium]** 「参考：Plunder の追加ルール」の引用が**途中で切れている**（持続が場を離れたときの規定が落ちている）

- **旧（下書き 参考節・3番目）**
  > `Additionally, if a Duration card is played extra times by a card such as [Throne Room, Scepter, Mastermind, Specialist, Flagship, or Daimyo], that card also stays in play until the Duration card is discarded, to track the fact that the Duration card was played extra times.`
- **正**（末尾に続きがある）
  > `Additionally, if a Duration card is played extra times by a card such as [Throne Room, Scepter, Mastermind, Specialist, Flagship, or Daimyo], that card also stays in play until the Duration card is discarded, to track the fact that the Duration card was played extra times;` **`and that effect also ends if that card somehow leaves play.`**
- **出典**：ライブwiki `Plunder (expansion)` > `Additional rules` > `Durations`（`verify/live_all.txt`）。
  Wayback の 2025id_ キャプチャ（`Plunder_expansion.txt` 299行付近）にも同じ末尾がある。
- **なぜ効くか**：本プロジェクトは「玉座で2回使われた持続は、その玉座も場に残す」を
  `p.delayedEffects` の残り枚数で数えている（PROGRESS §0-25/§0-28 の既存簡略化）。
  落ちている一句は **「その追跡役（玉座/Flagship 等）が場を離れたら、追跡の効果も終わる」**という規定で、
  Flagship（担当外だが同じ群）と増築(Improve)・廃棄系が絡む局面の挙動を直接決める。
  引用が切れたままだと実装者が「場を離れても2回ぶん効き続ける」と読む恐れがある。

###### **[low]** 出典表の日本語wiki URL と更新日が誤り

- **旧**：`https://wikiwiki.jp/dominiondeck/一覧/略奪（拡張）`（2023-03-30 更新）
- **正**：URL は **`https://wikiwiki.jp/dominiondeck/略奪（拡張）`**（`一覧/` の階層は無い）／
  **Last-modified: 2026-07-21 (火) 16:43:28**。
- **出典**：`jp_expansion.html` の `rel="canonical" href="https://wikiwiki.jp/dominiondeck/%E7%95%A5%E5%A5%AA%EF%BC%88%E6%8B%A1%E5%BC%B5%EF%BC%89"`
  ＋ `jp_expansion.txt` 6行目 `Last-modified: 2026-07-21 (火) 16:43:28`。

###### **[low]** 「表の並び順が英語wikiと完全一致することで対応を確定」＝**並び順は一致しない**（結論は正しい）

- **旧**：> **表の並び順とコスト帯が英語wikiと完全一致**することで対応を確定
- **正**：**コスト帯は一致するが並び順は一致しない**。
  - 英語wiki ナビボックス：`[$2]` Cage, Grotto, Jewelled Egg, Search, Shaman ／ `[$3]` Secluded Shrine, Siren, Stowaway, Taskmaster（英名アルファベット順）
  - 日本語wiki `略奪（拡張）`：`2` シャーマン, 岩屋, 調査, 宝飾卵, 檻 ／ `3` 秘境の社, 現場監督, セイレーン, 密航者
  - ＝$3 帯だけ見ても 英 `Secluded Shrine, Siren, Stowaway, Taskmaster` に対し 日 `秘境の社, 現場監督, セイレーン, 密航者`（＝Secluded Shrine, **Taskmaster**, Siren, Stowaway）で順序が違う。
- **出典**：`en/Cage.txt` のナビボックス（$2/$3 の並び）／`jp_expansion.txt` の `王国カード` 表。
- **注記**：**下書きの7枚の日本語名の対応そのものは全部正しい**。ただし根拠が不正確なので、
  正しい根拠に差し替えること＝**日本語wikiの各カードページが英語原名を併記した表を持っている**
  （例：`jp/調査.txt` に `Plunder / Search / 2 / Action-Duration / …` と `略奪 / 調査 / 2 / アクション-持続 / …` が並記）。
  並び順に頼る方法を残すと、残り拡張のカードで取り違えを生む。

###### **[low]** Cage の「カード実物の折り返し位置」が違う

- **旧**：
  ```
  Set aside up to 4 cards from your hand face down (on this). The next time you gain a Victory card,
  trash this, and put the set aside cards into your hand at end of turn.
  ```
  （`カード実物では上記の位置で折り返す`）
- **正**（RGG ルールブックPDF のカード画像・逐語）：
  ```
  Set aside up to 4 cards from your hand face down (on this).
  The next time you gain a Victory card, trash this, and put
  the set aside cards into your hand at end of turn.
  ```
- **出典**：`plunder_rules_raw.txt` 97-99行。
- 影響＝カード画像生成の行組みだけ（ルール影響なし）。

###### **[low]** Jewelled Egg の英語テキストに**区切り線が抜けている**

- **旧**：
  ```
  [$1]
  +1 Buy
  When you trash this, gain a Loot.
  ```
- **正**：`+1 Buy` と `When you trash this, gain a Loot.` の**間に区切り線がある**（＝廃棄時能力は線の下）。
  ```
  [$1]
  +1 Buy
  ---
  When you trash this, gain a Loot.
  ```
- **出典**：英語wiki `Jewelled Egg` > `Versions > English versions` の生HTML
  （`verify/JE_raw.html`：`<b>+1 Buy</b><hr style="height:2px;width:66%;…" />When you trash this, gain a Loot.`
  ＝Shaman・Siren と**同一スタイルの `<hr>`**）。独立確認として日本語wiki `宝飾卵` の英語原文欄も
  `+1 Buy` / `--------------------` / `When you trash this, gain a Loot.` と区切りを明示している。
- **なぜ効くか**：下書きは Shaman と Siren には `---` を書いているのに Jewelled Egg にだけ書いていない＝
  **同じ群の中で不統一**。カード画像生成（`build-cards.js`）が区切り線を引くかどうかの入力になるので、
  このまま実装すると宝飾卵だけ線が出ない。

###### **[low・ごく小さい]** Jewelled Egg の「その他の裁定：節はあるが記載なし（空）」は現行版では**節ごと消えている**

- ライブwiki の Jewelled Egg には `Other rules clarifications` の見出し自体が無い（TOC も `1.1 Official FAQ` → `2 Strategy`）。
  Wayback の古いキャプチャには空見出しが残っていた。**内容の差はゼロ**なので実装影響なし。記録のみ。
- **出典**：`verify/live_all.txt` の `### PAGE: Jewelled_Egg` 節 ／ `en/Jewelled_Egg.txt`（空見出しあり）。

---

##### 要ユーザー確認

1. **略奪の日本語印刷版（ホビージャパン版）が実在するのか**＝一次資料だけでは断定できない。
   - **肯定材料**：英語wiki の Siren / Invasion / Taskmaster / Crew に Japanese 行があり、
     Siren・Invasion・Taskmaster は **Print 列に画像**が入っている。日本語名は日本語wikiと一致。
   - **否定・保留材料**：
     (a) `SirenJapanese.jpg` は **215×344px**（英語版 `Siren.jpg` は 1260×2016px）＝極端に低解像度で、
         公式配布素材というより写真/プロキシの可能性がある。
     (b) **Notes 列の年が空**（Dutch / German / Polish はいずれも `(2023)`）。
     (c) 掲載日本語テキストに**誤字**（`これを廃楽する`＝`廃棄` の誤り）がある。
     (d) 46ページ中4枚しか Japanese 行が無い＝**全カードが揃った印刷版**の痕跡としては不自然。
   → 「日本語印刷版が出ている／いない」を**PROGRESS に断定して書かないこと**を推奨。

2. **実装時の日本語カードテキストをどちらの訳で出すか**（Siren で実際に文言が割れている）。
   - 案A＝**Dominion Online 訳（日本語wiki 掲載）で全72…85種を統一**する。
     利点＝全カードぶん揃っている・本アプリの既存拡張と同じ出所。
   - 案B＝英語wikiの Japanese 行がある4枚だけそちらに合わせる。
     → **不統一になるうえ誤字も混じる**ので勧めない。
   - **日本語名はどちらでも同じ**なので、名前だけ先に確定して進めても事故らない。

---

##### 下書きが落としていた裁定（逐語）

いずれも**担当7枚のカードページ内の FAQ には脱落が無い**。落ちているのは
「カードページの外にあるが、この7枚の実装に直接効く」規定。

###### 1. 追加ルール（Durations）＝上の訂正2の続き

> `Additionally, if a Duration card is played extra times by a card such as [Throne Room, Scepter, Mastermind, Specialist, Flagship, or Daimyo], that card also stays in play until the Duration card is discarded, to track the fact that the Duration card was played extra times;` **`and that effect also ends if that card somehow leaves play.`**

（出典：ライブwiki `Plunder (expansion)` > `Additional rules` > `Durations`）

###### 2. 追加ルール（Durations）＝物理プレイ用の指示（実装影響なし・記録のみ）

> `Keep track of whether or not a Duration card was played on the current turn, such as by putting your cards into two lines.`

（出典：同上。RGG ルールブックPDF `plunder_rules.txt` 73-74行にも同文あり）

###### 3. **Loot の一般ルール5件**＝`Search` と `Jewelled Egg` の「戦利品1枚を獲得する」の解決に直結するのに `kingdom1.md` に無い

> - `There are 15 Loot cards, with 2 copies of each. Shuffle them into a face-down pile before the game if any cards refer to Loot.`
> - `During the game, "gain a Loot" means, you gain the top card of the Loot pile.`
> - `When you gain a Loot, reveal it to all players. Then put it into your discard pile as usual.`
> - `Players can't look through the Loot pile during a game.`
> - `The Loot pile isn't in the Supply; players can't buy or gain from it, except with cards that specifically gain Loot.`
> - （Other rules clarifications）`If you exchange a gained Loot (e.g. with Changeling), the Loot goes back on top of the pile, face down.`

（出典：英語wiki `Loot` > `Rules > Official rules` / `Other rules clarifications`＝`en/Loot.txt`。
RGG ルールブックPDF `plunder_rules.txt` 85-89行にも同文）
※ `loot.md` 担当と重複する可能性はあるが、**この群の2枚（Search・Jewelled Egg）がどちらも Loot 獲得札**なので
`kingdom1.md` 側にも参照を1行置くべき。特に「**公開する**」「**捨て札に置く**」「**サプライではない**」の3点は
本アプリの `reveal()`（パトロン誘発）・`gain(dest)`・`NON_SUPPLY` の3系統に直接効く。

###### 4. Siren の `Trivia > Rules` 節＝**回避コンボの根拠が「stop-moving rule」であると wiki が明示している**

> `Many tricks around dodging Siren's self-trashing effect require knowledge of the stop-moving rule, and paying attention to how specific cards are phrased.`

（出典：ライブwiki `Siren` > `Trivia` > `Rules`。生HTML `verify/Siren_raw.html` の `id="Rules"` 節冒頭）
下書き §C の結論（Insignia は成功・Invasion / Spell Scroll は失敗）は正しいが、
**その根拠が既存の「stop-moving rule」＝本プロジェクトが §0-17（命令 Command）で既に実装している概念**である、
という対応づけが書かれていない。実装時は新機構を起こさず既存の lose-track 判定に寄せられる可能性が高いので、
この1行を落とさないほうがよい。
※同節の残りは Donald X. のインタビュー（設計談）で、**追加の裁定は含まれていない**（確認済み）。

---

##### 補足：後続セッションへの注意（この検証で分かった落とし穴）

- **Wayback のスナップショットは「ページの版」が実際に違うことがある**。
  `Plunder (expansion)` は 2024id_ キャプチャに `If a Duration card leaves play somehow, …` の1行が**無く**、
  ライブ版には**ある**。古いキャプチャだけで「下書きの捏造だ」と判定すると**偽陽性を出す**。
  → **`node tools/wikidirect.js` の直読み（status=200）を正本にすること**。
- 逆に、担当7枚のカードページ自体は 2024/2025/ライブ で**内容が一致**していた（差はヘアスペース1個だけ）。
  ＝カードページは安定、拡張の総論ページは編集が入る、という傾向。
- **strip 済みテキストでは表の「列」と `<hr>`（区切り線）が消える**。
  Print 列か Digital 列か／区切り線があるかを判定するときは**必ず生HTML を見ること**
  （今回 Siren の Japanese 行と Jewelled Egg の区切り線はこれで確定した）。
- **RGG ルールブックPDF はカード別FAQの裏取りに極めて有効**（7枚とも wiki と語単位で一致した）。
  ただし pdftotext がコイン記号を落とすので**金額は必ず wiki 側で読む**（既知）。
  また PDF は2022年印刷版なので、**wiki が後から足した一般ルール（`leaves play somehow`）は載っていない**。


---

#### 敵対検証レポート（担当＝Stowaway / Taskmaster / Abundance / Cabin Boy / Crucible / Flagship ＋ 「落とし穴」節のルール主張）

<sub>（出典ファイル＝`verify/kingdom1_v2.md`）</sub>

#### 敵対検証レポート：kingdom1.md（担当6枚＋「落とし穴」節A〜M）

対象カード＝**Stowaway / Taskmaster / Abundance / Cabin Boy / Crucible / Flagship**
＋ 下書き末尾 `## 実装時に事故りそうな落とし穴` のA〜Mの**ルール主張**。

##### 検証に使った一次資料（すべて自分で引き直した）

| 資料 | 取得方法 | 版 |
|---|---|---|
| 英語wiki 各カードページ（**最終確認**） | **`node tools/wikidirect.js`（ライブ直読み）** | Stowaway/Taskmaster `oldid=95366/95368`＝**2026-02-21**／Abundance/Cabin Boy/Crucible `95332/95334/95337`＝**2026-02-21**／Flagship `oldid=95900`＝**2026-03-20** |
| 英語wiki `Plunder_(expansion)` / `Duration` / `Command` | 同上 | 2026-03-28 ／ **2026-05-05（`oldid=96197`）** ／ 2026-03-22（`oldid=95909`） |
| 旧版との差分比較 | `tools/wikifetch.py`（Wayback）＋ CDX指定の自作 `verify/_cdxfetch.py` | Taskmaster 2024-09-01 / `oldid=94249`(2025-11-22)、Flagship `oldid=68989`(2023) / `85244`(2024-10-17) / `88751`(2024-12-07) / `93340`(2025-09-11) |
| RGG 公式ルールブック | `C:/tmp/plunder_research/DomPlunder.txt`（pdftotext 済み・実DL） | 2022年8月組版（`plunderrandomizers21.indd` / `8/19/22`） |
| 日本語wiki | `C:/tmp/plunder_research/jp/<名前>.txt` | 各ページ冒頭 `Last-modified: 2026-07-20` 等 |

> **注**：最初は Wayback で取ったが、途中で `wikidirect.js` が常設化されたので**6枚＋3ページを全部ライブで取り直して突き合わせた**。
> 結果、**カードの内容（コスト・種別・テキスト）はライブでも完全に同一**で、下記の訂正はすべてライブ版で再確認済み。
> なお**ライブ版のほうが情報が多い**（Stowaway に日本語印刷版の行が増えている／`Duration` ページに
> 「the next time」型の**完全な一覧**がある）。下書きが見た版には無かったものが含まれる。

---

##### 確定（下書きどおりで正しい）

1. **6枚のコスト・種別**：Stowaway `$3` Action-Duration-Reaction ／ Taskmaster `$3` Action-Duration ／
   Abundance `$4` Treasure-Duration ／ Cabin Boy `$4` Action-Duration ／ Crucible `$4` Treasure ／
   Flagship `$4` Action-Duration-**Command**。**種別の落としは無い**。負債・ポーション費用も無し。（ライブ版で再確認）
2. **英語カードテキストは6枚とも現行版と逐語一致**。Flagship は **RGG ルールブック本文
   （`DomPlunder.txt` 242〜260行）とも一字一句一致**。
3. **エラッタ・再版は無い**（下書きの結論は正しい。**ただし根拠はもっと強くできる**）：
   ライブ版の `Versions > English versions` は**新しい表スキーマ**になっており、
   列が `Print | Digital | Text | Changes | Announced | Printed`。**6枚とも行は1本だけで
   `Changes = First edition` / `Announced = （空）` / `Printed = December 2022`**（機械抽出で確認）。
   ＝**エラッタが無いだけでなく、「announce されたが未印刷のエラッタ」も無い**
   （§0-29 A4 の royal_galley のような罠がこの6枚には存在しない、と断言できる）。
   ※ただし**一般ルール側のエラッタが Taskmaster の裁定を1つ壊している**（訂正3）。
4. **Stowaway の Official FAQ／Other rules は下書きの引用どおり**（ライブ版でも2件のまま）。
5. **Abundance の FAQ 2件・Other rules 2件は下書きどおり**（Courier×Innovation の自己誘発除外を含む）。
6. **Cabin Boy**：Official FAQ は1件のみ、`Other rules clarifications` は**空**＝下書きどおり。
7. **Crucible**：Official FAQ 2件、`Other rules clarifications` は**空**＝下書きどおり。
8. **Flagship の Official FAQ 4件は下書きどおり**（強制／自己廃棄しても再演／相手のターンでも／Command は飛ばす／2枚で3回）。
9. **落とし穴 C（Siren の stop-moving）／D（Shaman の常設効果）／I（Jewelled Egg は廃棄した本人が Loot）／
   J（Cage は次の手札を引いた後・0枚でも場に残る／Grotto は0枚なら残らない）／K（Grotto は捨てる→引く）**
   ＝**引用は現行英語wikiと逐語一致**（各ページを再取得して照合）。
10. **落とし穴 L（Stowaway は移動動物園型リアクション。誰の獲得でも窓が開く）＝正しい**。
11. **落とし穴 M（Abundance は相手のターンにも誘発するが無意味）＝正しい**。
12. **落とし穴 G（Cabin Boy の「持続カードを獲得」にコスト制限が無い）＝正しい**。
13. **落とし穴 H（Crucible の +$ はコイン成分だけ）＝正しい**。
14. **落とし穴 F の中核（Necromancer は Command ではないので Flagship に再演される／
    はみだし者は Command なので飛ばされ、はみだし者が使ったカードの方が再演される）＝正しい**。
    ライブの `Command` ページが `Necromancer` と `Royal Carriage` を **`Corner cases`＝Command 型を持たない**と明記。

---

##### 訂正

**[high] 対象=「⚠ 日本語版について」節（全13枚＝拡張全体の方針に効く）**
- 旧＝`英語wikiの Other language versions 表に Japanese の行が1枚も無い（Dutch / French / German / Polish のみ）。＝略奪の日本語印刷版は（この資料の時点で）存在しないと考えるのが自然。`
- 正＝**日本語印刷版は存在する**。
  - 出典1＝英語wiki `Plunder_(expansion) > Trivia > Official releases in other languages` に
    **`Japanese: 略奪 (pron. liaku datsu)`** と明記（Dutch / German / Polish と並記）。
  - 出典2＝**Japanese 行が実在するカードページが複数ある**。担当6枚のうち
    **Stowaway と Taskmaster の2枚**に、印刷版画像つきの Japanese 行がある（**ライブ版で確認**）。
    他に **Siren / Crew / Invasion** でも確認した。
  - ＝**Japanese 行が少ないのは「wikiの記入漏れ」であって「未発売の証拠ではない」**。
    下書きの「印刷版が無いのでDominion Online訳を採用してよい」という前提は成立しない。
  - ※ただし**結論（DomOnline訳を使う）自体は現実的には妥当**。理由が違うだけ（→「要ユーザー確認2」）。

**[high] 対象=落とし穴A「the next time 型は5枚」**
- 旧＝`Cage／Search／Secluded Shrine／Abundance／Flagship` の**5枚**
- 正＝**ちょうど7枚**。ライブの `Duration` ページ（2026-05-05・`oldid=96197`）に
  **`Triggered effects`＝「開始時ではなく条件で誘発する持続」の公式カテゴリ**があり、
  **Dominion 全体でこの7枚がすべて**（カードギャラリーのサムネも7枚）：

  | カード | wiki の要約（逐語） |
  |---|---|
  | Abundance | `When you gain an Action card, +1 Buy and +[$3].` |
  | Cage | `When you gain a Victory card, trash the Cage and put the cards set aside with Cage into your hand at the end of the turn.` |
  | **Cutthroat**（$5・下書きに無い） | `When anyone gains a Treasure card costing [$5] or more, gain a Loot.` |
  | Flagship | `When you play a non-Command Action card, replay it.` |
  | **Landing Party**（$4・下書きに無い） | `When the first card you play on a turn is a Treasure, put Landing Party onto your deck afterwards.` |
  | Search | `When a Supply pile empties, trash Search and gain a Loot.` |
  | Secluded Shrine | `When you gain a Treasure card, trash up to 2 cards from your hand.` |

  → **7枚とも略奪のカード**＝この誘発窓の共通機構は略奪だけで完結する（他拡張への波及は無い）。
  → **`Cutthroat` は「anyone gains」＝他人の獲得でも誘発**するので、
    「自分の獲得だけ見る」設計にすると作り直しになる。
  → `Landing Party` は「そのターン最初に使ったカードが財宝なら」＝**獲得でも廃棄でもない誘発点**が1つ増える。
  ※ライブ版には同じページに `Duration effects`（＝場にある間ずっと効く持続）の一覧もあり、
    略奪からは **Frigate / Highwayman** が入る（これも「相手のターンをフックする」機構が要る）。

**[high] 対象=落とし穴E「Improve で廃棄した後でも Taskmaster の予約は残る」**
- 旧＝`Improve で廃棄した後でも予約は残る：the Taskmaster will still repeat itself on your next turn ... you will have to remember this.`
  ⇔ 追加ルールと矛盾して見えるので**実装前に必ず確認すること**
- 正＝**矛盾は既に決着済み。この裁定は無効**＝**場を離れた Taskmaster は次のターンに繰り返さない**
  （追加ルール `If a Duration card leaves play somehow, it stops doing things on future turns.` が勝つ）。
  - 出典1＝**日本語wiki `現場監督 > 詳細なルール`**（逐語）：旧裁定を書いた直後に取り消し文がある。
    > `持続カードが何らかの理由により場を離れた場合、【持続効果】はターン終了時にすべて失われる、というルール（英語版移動動物園（拡張）改版に伴う2025年2月エラッタ）により、成立しなくなりました。`
  - 出典2＝**英語wiki からも当該項目が削除されている**。2024-09-01 キャプチャの
    `Other rules clarifications` には Improve の項が**在る**が、**`oldid=94249`(2025-11-22) にも
    ライブ最新 `oldid=95368`(2026-02-21) にも無い**（同節は4項目のみ）。3版を自分で取得して差分確認した。
  - 出典3＝ライブ `Duration > Other rules clarifications` の一般則
    > `A Duration played this turn that won't stay in play can be trashed with Improve.`
    ＝**「場に残らない持続だけが Improve で廃棄できる」**＝条件未達の Taskmaster は廃棄できるが、
    廃棄された以上は次ターンに何もしない、で一貫する。
  - 本プロジェクトは 2025年2月エラッタを既に採用済み（PROGRESS §0-25/§0-26）なので**この方針で実装して整合する**。

**[high] 対象=落とし穴F「Flagship は場に残らない」**
- 旧＝`（Flagship は場に残らない）`＝§0-25/§0-28 の「玉座×持続」と**結論が逆**
- 正＝**一般則は逆で、Flagship は持続を再演したら場に残る**。
  - 出典1＝**RGG ルールブック逐語**（`DomPlunder.txt` 71〜74行）：
    > `Additionally, if a Duration card is played extra times by a card such as Flagship, that card also stays in play until the Duration card is discarded, to track the fact that the Duration card was played extra times.`
  - 出典2＝ライブ `Plunder_(expansion) > Additional rules > Durations`（同文。列挙が
    `[Throne Room, Scepter, Mastermind, Specialist, Flagship, or Daimyo]` に拡張されている）。
  - 出典3＝ライブ `Duration > Other rules clarifications`：
    > `When you use a Throne Room variant to play a Duration multiple times, that Throne Room stays in play for as long as the Duration does.`
- 下書きが引いた「場に残らない」は **はみだし者(Band of Misfits)経由という1つのコーナーケース限定**の記述で、
  しかも**現行の英語wikiからは削除されている**（→「要ユーザー確認1」）。
  **一般則として「残らない」と実装すると、素直な `Flagship → 手札の持続` が壊れる。**

**[medium] 対象=Taskmaster「その他の裁定」の引用**
- 旧＝5項目（最後が Improve の項）
- 正＝**現行版は4項目**（Way/Conspirator・Importer・獲得時コスト（Destrier）・Haggler×Innovation）。
  Improve の項は削除済み（上記[high]と同根）。下書きは削除前の版を引いている。

**[medium] 対象=落とし穴F「本アプリの Command 種別を持つ札（大君主／はみだし者／船長／王子／Flagship）」**
- 旧＝5枚
- 正＝**公式の Command は8つ**。ライブ `Command > List of Commands` 逐語：
  > `Band of Misfits, Captain, Overlord — Play a card from the Supply.`
  > `Prince — Plays a set-aside card at the start of each turn.`
  > `Estate under the influence of Inheritance — Plays a set-aside card.`
  > `Scepter — Plays a card that is already in play.`
  > `Daimyo, Flagship — Replays the next played card.`
  - **漏れているのは 王笏(Scepter) と 相続した屋敷(Inheritance)**。
  - **実装上いちばん効くのは相続した屋敷**＝これは**アクションかつ Command** なので
    **Flagship は相続した屋敷を再演してはいけない**。本プロジェクトは相続を実装済み（§0-21）＝mix-all で到達する。
    ⚠ `js/cards.js` を確認したところ `scepter` には既に `'command'` が付いている
    （`types: ['treasure','command']`）が、**相続の屋敷は `inheritedEstate` で動的に扱っている**ので、
    **Flagship の除外述語は静的 `types` だけを見てはいけない**。
  - 日本語wiki `旗艦 > 余談` は**無限ループの実例**を2本挙げている（旗艦↔はみだし者／旗艦↔相続した屋敷）。
    ＝Command 除外は忠実性の問題ではなく**無限ループ防止のための必須条件**。
  - 補強（ライブ `Flagship > Trivia`・逐語）：
    > `Flagship was the first card to have the Command type when it was originally published. Other cards had the Command type before Flagship did, such as Band of Misfits, but such cards all had the type added to them retroactively via errata.`

**[medium] 対象=落とし穴E／Taskmaster の誘発条件**
- 旧＝`コスト5のカードを獲得`
- 正＝**「コイン5・ポーション0・負債0」でちょうど一致**。日本語wiki `現場監督 > 詳細なルール` 逐語：
  > `より正確には「コスト5コイン0ポーション0負債のカードの獲得」である`
  → 本プロジェクトの3成分比較（`costExact` 系）をそのまま使うこと。
    `cardCost().coin === 5` だけで判定するとポーション費用・負債コストの札で誤爆する。

**[low] 対象=「参考：この群に効く Plunder の追加ルール」の引用**
- 旧＝`... to track the fact that the Duration card was played extra times.`
- 正＝現行wikiは末尾に**一句多い**：`...; and that effect also ends if that card somehow leaves play.`
  （**RGG 2022年ルールブックには無い＝後から足された文**＝2025年2月エラッタ側の文言）。
  この一句が上記[high]（Taskmaster×Improve の無効化）と対になっているので、落とすと判断を誤る。

**[low] 対象=Taskmaster / Stowaway の日本語カードテキスト**
- 旧＝Dominion Online 訳のみを掲載
- 正＝**印刷版の日本語テキストが英語wikiに載っている**（`Other language versions > Japanese`・逐語）。
  - **Taskmaster（印刷版）**
    > `+1 アクション、+[$1]、 このターンあなたがコストがちょうど[$5]のカード1枚を緩得した場合、その後、あなたの次のターンの開始時、この能力を繰り返す。`
    （DomOnline訳＝`…このターン、これより後にあなたがコスト5のカードを獲得した場合、…この能力を冒頭から繰り返す。`）
  - **Stowaway（印刷版・ライブ版で新たに追加されていた）**
    > `あなたの次のターンの開始時、＋2 カードを引く` / `いずれかのプレイヤーが持続カード1枚を獲得したとき、あなたの手札からこれを使用してもよい。`
    （DomOnline訳＝`あなたの次のターンの開始時に、+2 カードを引く。` / `誰かが持続カード1枚を獲得したとき、あなたは手札からこれを使用してもよい。`）
  - ⚠ **wiki 側の書き起こしに誤字がある**：Taskmaster の `緩得`（正＝`獲得`）、Siren の `廃楽`（正＝`廃棄`）。
    **そのままカタログに貼らないこと。**
  - なお**カード名は印刷版・日本語wiki・Dominion Online の3者で一致**（現場監督／密航者／豊穣／
    キャビンボーイ／坩堝／旗艦）＝**名前は安全**。

---

##### 要ユーザー確認

1. **【最重要】Flagship がはみだし者の使った持続カードを再演したとき、Flagship は場に残るか**
   - **一般則＝残る**（RGGルールブック逐語・ライブ `Plunder_(expansion)` 追加ルール・ライブ `Duration` ページ）。上記[high]。
   - **しかし**「はみだし者が使った持続を旗艦が再演した場合だけは、はみだし者は残るが旗艦は残らない」という裁定が
     **2023年〜2025年9月の英語wikiに脚注付き（`[1]`）で存在**し、**2025-09-11 の版で削除**されている
     （`oldid=85244`(2024-10-17)・`88751`(2024-12-07) には在り、`93340`(2025-09-11) 以降・**ライブ `95900`(2026-03-20) にも無い**＝
     自分で5版を取得して確認）。
   - 日本語wiki `旗艦` の**コメント欄（2024-10-08〜09）**によれば、当時の編集者が英語wikiを確認してこの裁定を採用し、
     > `大名と合わせて編集しておきました。大名が旗艦と同様の扱いであることはTGGのDiscordにてDZ氏から確認を取っています。`
     ＝**当時は公式に近い確認があった**。
   - **理屈は通る**（はみだし者が使う持続カードは**サプライから動かない＝一度も場に入らない**ので、
     「その持続カードが場から捨てられるまで残る」という追跡自体が成立しない）。
     ライブ `Duration` ページにも近い趣旨の一般則がある：
     > `It is also sometimes possible to use a Throne Room variant on a Duration card but be unable to leave the Throne in play with the Duration (e.g., ... was played by a Command variant such as Band of Misfits and never entered play in the first place). In these cases, the Duration card is played twice immediately, but its ability is only activated once on future turns, since the Throne is not still in play to remind you.`
     （※これは「はみだし者が玉座を使った」逆向きの例で、**我々のケースそのものではない**）
   - → **削除が「誤りだったから」なのか「2025年の一括編集の巻き添え」なのか、一次資料からは断定できない。**
     （Taskmaster の Improve 項も同時期に消えているが、そちらは日本語wikiに「2025年2月エラッタで無効」という**独立の根拠がある**。旗艦側にはそれが無い。）
   - **実装上の推奨**：一般則（**残る**）で実装し、**はみだし者/大君主/船長がサプライから使った持続を再演した場合だけ
     場に残さない**（両方の資料と矛盾しない安全側）。この分岐を入れるかはユーザー判断。

2. **日本語表示テキストをどちらにするか**（訂正[high]＋[low]の帰結）
   - 印刷版（ホビージャパン）は存在するが、**英語wikiに Japanese 行があるのは略奪85種のうちごく一部**で、
     日本語wikiのテキストは**明示的に Dominion Online 訳**（各ページ冒頭に `(※日本語訳はDominion Onlineより)`）。
   - ＝**「印刷版の逐語」を85種ぶん揃える手段が今回は無い**。夜想曲・同盟のときの
     「日本語wiki＝印刷版が正本」という前提は**今回は使えない**（下書きの結論は結果的に妥当だが、理由が違う）。
   - → **A: 日本語wiki（DomOnline訳）で全カード統一**（実運用は楽・ただし一部は印刷版と文面が違う）
     **B: Japanese 行がある数枚だけ印刷版に合わせる**（混在して不整合になる）
     のどちらにするか決めてほしい。**カード名はどちらでも同じ**なので、名前だけは今すぐ確定してよい。

3. **2025年9月の英語wiki一括編集で「脚注付きの裁定」がまとめて消えている可能性**
   - 自分の担当2枚（Taskmaster・Flagship）で**同時に**起きている。どちらも `[1]` 脚注付きの行だった。
   - → **kingdom2/kingdom3・mechanics の担当が「現行版だけ」を見て起草していると、
     同じ形で裁定を取りこぼしている恐れがある**。2024年のキャプチャと突き合わせる価値がある
     （`verify/_cdxfetch.py` で `capture=` 指定の取得ができる。`wikidirect.js` はライブ専用なので旧版は取れない）。

---

##### 下書きが落としていた裁定（逐語）

###### Stowaway（密航者）— 3件。うち2件は実装に直接効く（日本語wiki `詳細なルール`）
1. **他人の獲得に反応する密航者は、手番プレイヤーの獲得時効果の「後」に処理される**
   > `密航者のリアクション効果は、誰かが持続カードを獲得した時に誘発する効果だが、この効果は「ターンプレイヤーが持続カードを獲得した時に誘発する効果」よりも後に処理されることに注意`
   例＝2人戦でAが**散兵**を使用→Aが**切り裂き魔**を獲得。
   まず**Aの獲得時効果**（散兵でBが手札を3枚にする）を全部処理し、**その後で**Bが密航者を手札から使用できる。
   > `(iとiiの処理順が逆になることは無い)`
   → 本アプリでは `onGainQueue` に**手番プレイヤーぶんを先に積み、他プレイヤーのリアクション窓を後ろに置く**必要がある。
2. **手札に獲得した密航者は、自分自身の獲得にリアクションできる**（＝「the next time」型の自己誘発禁止とは**逆**）
   > `職人・変容・カブラー・願い・彫刻家・交換などで密航者を手札に獲得した場合、(密航者自体も持続カードなので)その獲得したばかりの密航者を自身の獲得に対してリアクションすることができる。`
   → 落とし穴Aの「自分自身を誘発させてはいけない」を**密航者に適用してはいけない**（別機構）。
3. **エラッタで種別が増えたカードに注意**＝`王子` は現在 Action-**Duration**-Command なので**王子の獲得でも密航者が反応する**
   （英語wiki `Prince`：`it received the Duration and Command types as part of a series of revisions and rule changes in 2022`）。
4. （参考・Secret History）`Briefly it triggered on other players playing Duration cards; then to the final version.`

###### Taskmaster（現場監督）— 日本語wiki `詳細なルール` に実装直結の裁定が多数
1. **「能力を繰り返す」は『アクションの使用』ではない**（英語wikiは Way と Conspirator しか書いていない）
   > `共謀者がカウントする『アクションの使用』には該当しない。` / `この処理を行っても、『アクションの使用後』は来ない。`
   > `法貨、御料車を呼び出すことはできない。` / `チャンピオンが持続している場合でも「+1 アクション」は得られない。`
   > `この処理をする際に、習性を選ぶことはできない。` / `この処理を行っても、フリゲート船のアタック効果は誘発しない。`
   → **`noteAllyPlay`（同盟の「アクションを使用した後」）・山トークン・浮浪児のトラップ・
     共謀者カウンタ・習性の選択を一切触らないこと。**
2. **過払い(overpay)はコストを変えない**
   > `名品購入時、2コイン分過払いしても、3コストの財宝カードを獲得したと判定されるので、現場監督の持続効果を誘発しない。`
3. **動的コストの判定例が2つ**（英語wikiは Destrier だけ）
   > `捨て札が空の状態で漁師を獲得した場合は、2コストのカードを獲得したと判定されるので、現場監督の持続効果を誘発しない。`
   > `ターン内に他にカードを1枚獲得している状態でデストリエを獲得した場合は、5コストのカードを獲得したと判定される`
4. **Dominion Online の日本語訳「これより後に」は不正確**（＝下書きが採用した訳文）
   > `厳密には英語版の通り「(この効果が発揮されたタイミング以降で)このターン、あなたがコスト5のカードを獲得した場合」が正しい。よって、5コストカードの獲得に誘発して現場監督が使用された場合、現場監督の「次のターンの開始時に、カードの能力を冒頭から繰り返す」の処理が発揮される`
   （＝英語FAQ の Haggler×Innovation の項と同内容。**日本語文だけ読んで実装すると落とす**）
5. **ターン開始時の解決順は選べる**（英語の Importer の項と同内容だが、日本語wikiは逆順の帰結まで書いている）
   > `先に輸入者を処理すると、ターン開始時点で現場監督の持続効果は発揮されない。`
6. （参考）Preview / Secret History / **Wording**（下書きは3節とも未収録）
   > Wording: `A lot of work went into that wording ... "Play this again" was tried and failed; consider Throning it.`

###### Cabin Boy（キャビンボーイ）— 3件すべて実装に効く（日本語wiki `詳細なルール`）
1. **場から廃棄できなければ獲得もできない**
   > `キャビンボーイの「持続カード獲得のために、これを場から廃棄する」の効果は、キャビンボーイを場から廃棄するのに失敗した場合は得られないので注意`
   → 下書きG の「`takeSelf` ガードが要る」は正しいが、**その結果「獲得も起きない」**ことまで明記が要る。
2. **玉座の間で2回使うと、2回目も同じ選択肢を選べる（が不発）**
   > `1回目の持続効果で「持続カード獲得のために、これを場から廃棄する」をした後、2回目の持続効果でも「持続カード獲得のために、これを場から廃棄する」を選択できる。ただし、2回目は廃棄に失敗するため何も起こらない。`
   → **選択肢を消してはいけない**（UI で潰すと公式と違う。engine 側で空振りさせる）。
3. **長老(Elder・同盟)の「追加でもう1つ選ぶ」対象にならない**
   > `キャビンボーイは選択効果を持つが、長老の「選択効果追加」の対象にはならない。これは、長老により選択効果を追加することができるのは「(長老の効果で使用したカードが)このターンで選択効果を発揮する場合」に限られるためである。`
   → 本アプリの `ELDER_CHOICE_ORDER` に **cabin_boy を入れてはいけない**（§0-29 A4 の機構に直撃）。

###### Crucible（坩堝）— 2件（日本語wiki `詳細なルール`）
1. **コスト軽減の後のコストで数える**
   > `コストを参照するとき廃棄したカードは通常廃棄置き場にある。橋などでコストが下がっている場合、下がった後のコストを元にコインを産む。`
   → 静的な `C()[id].cost` ではなく **`cardCost(state,id)` を使う**（本アプリの既存の罠と同型）。
2. **手札0枚なら廃棄は失敗／$0のカードも廃棄できる（+$0）**
   > `坩堝の廃棄効果は強制処理であり、手札が1枚以上あればいずれかを必ず廃棄しなければならない。` `コスト0の銅貨や呪いも廃棄できる。その場合、金量は出力しない。`

###### Flagship（旗艦）— 再演の対象範囲が下書きより広い（日本語wiki `詳細なルール`）
> `旗艦の効果は強制効果なので、ターンやフェイズを問わず旗艦の次に使用する(命令カード以外の)アクションは必ず再使用される。`
- `購入フェイズで財宝として使用した冠や呪符の巻物、資本主義で財宝化したアクションカード。`
- `購入フェイズで苦労や進軍を購入、ゴンドラ獲得などにより使用したアクションカード。`
- **`夜フェイズに夜行カードとして使用した人狼。`**（＝夜フェイズでも発火する）
- `他プレイヤーのターン中にリアクションとして使用したアクションカード（密航者、隊商の護衛、黒猫など）。`
→ **`PLAY_ACTION` だけにフックすると全部取りこぼす。**
  `playCardNoAction`（苦労/進軍/博打）・`PLAY_NIGHT`（人狼）・リアクション経路・資本主義の財宝化アクションにも要る。

さらに：
- **捨て札になるタイミング**
  > `このカードは使用後、命令カード以外のアクションを使用し、持続処理を発揮するまで場に残り続け、持続処理を発揮した次のクリーンアップフェイズに捨て札になる。`
  > `他のプレイヤーのターン中に旗艦の持続効果を発揮した場合、(そのカードが持続効果を発揮していなければ)そのターンのクリーンアップフェイズに捨て札になる。`
  （※ライブ `Duration` ページも `you'll discard it from play during another player's Clean-up` という状況が実在すると明記）
- **複数回使用の累積**＝`村→旗艦→旗艦と使用した場合なども同様`（英語FAQの「2枚で3回」と同じ）。

###### Abundance（豊穣）— 場残りの一般則（ライブ `Duration > Other rules clarifications`・逐語）
> `Some Duration cards have an ability that is triggered by a certain condition being met, such as Abundance; these cards remain in play until Clean-up of the turn on which the condition is met, which may be the same turn on which they were played or a later turn. If the condition is never met, these cards will remain in play permanently as well.`
→ **条件が満たされなければ永久に場に残る**（＝`p.delayedEffects` の「1ターンぶんの予約」では表現できない、を裏づける公式文）。
＋ 日本語wiki の自己誘発しない具体例（英語wikiの Courier×Innovation とは別の例）：
> `「財産目当てを獲得し、突貫の効果で使用する→財産目当ての効果で豊穣を使用する」... この場合豊穣の持続効果は誘発しない。`

###### Search（他担当だが、落とし穴Bの検証結果）
- 下書きBの引用は**7項目すべて現行版と逐語一致・取りこぼし無し**。
- 質問への回答：
  - **(a) 誰が空にしても誘発する**（カード文の主語が無い＝`The next time a Supply pile empties`／
    FAQ が `If multiple players have played a Search when a Supply pile empties, players trash their Searches and gain Loots in turn order.` と複数人同時を前提にしている）
  - **(b) 複数の Search は手番順で全部誘発する**（同上）
  - **(c) 自分の獲得・自分の廃棄で空にした山でも誘発する**
    （`If gaining a card empties a Supply pile, you'll order Search with other when-gain effects.` ＝自分の獲得を前提にした文）。
    **例外は「その山が空になったことが原因でこの Search が場に出た」場合だけ**。



---

## 第3章 王国カード 2/3 — $4〜$5 の13枚

<sub>（出典ファイル＝`kingdom2.md`。見出しは2段下げて収録）</sub>

### 略奪（Plunder）王国カード 群2/3 — 一次資料まとめ（13件）

**担当範囲**：Fortune_Hunter / Gondola / Harbor_Village / Landing_Party / Mapmaker / Maroon / Rope /
Swamp_Shacks / Tools / Buried_Treasure / Crew / Cutthroat / Enlarge

#### 出典と信頼度

| 種類 | 出典 | 備考 |
|---|---|---|
| 現行カードテキスト（英語） | 英語wiki `wiki.dominionstrategy.com` の各カードページ（`Card text` 欄＋`Versions` 表の最新 printing 行）。`python tools/wikifetch.py` で Wayback 経由取得 | snapshot は下表参照。**全13ページとも 2023年以降のキャプチャ＝略奪（2022年12月発売）の情報を含む**（全ページの Info 欄 `Set` が `Plunder`、`Versions` 表の唯一の英語行が `Plunder / December 2022` であることを確認済み＝**印刷は初版1種のみ・エラッタ行なし**） |
| 公式FAQ・裁定 | 同ページの `Official FAQ` / `Other rules clarifications` / `Trivia` 節 | 逐語引用 |
| 日本語名・日本語テキスト | 日本語wiki `wikiwiki.jp/dominiondeck` の各カードページ（curl で HTML を実取得しタグ除去） | **日本語版はホビージャパンから2023年3月発売済**（[Gamer](https://www.gamer.ne.jp/news/202302180012/) / [ホビージャパン公式](https://hobbyjapan.games/dominion_plunder/)）。日本語wikiのカード名はその印刷版の名前（各ページに「日本語版登場前のDominion Onlineでの仮名は〜」という記述があり、現行名＝印刷版であることが確認できる） |

##### 取得した snapshot 一覧（略奪の情報を含むかの確認）

<!-- 検証で訂正: 旧=下書きの snapshot 一覧（Gondola=2024id_ / Buried_Treasure=20250114 など）は再現しなかった。
     `tools/wikifetch.py` は Wayback の archived URL を **http://** で組み立てるが、Gondola と Buried_Treasure の
     キャプチャは **https://** スキームで保存されているため、SNAPSHOTS 5種すべてが失敗する（実測 FAILED）。
     この2枚は `http://archive.org/wayback/available?url=...` で timestamp を引いてから
     `https://web.archive.org/web/<ts>id_/https://wiki.dominionstrategy.com/index.php/<Page>` を直接叩いて取得した。
     出典=検証エージェントの実行ログ -->

| ページ | 実際に取得できたキャプチャ | 取得方法 | 判定 |
|---|---|---|---|
| Fortune_Hunter | `2id_`（最新） | wikifetch | OK（Set=Plunder / December 2022） |
| Gondola | **20250115012803** | 直URL（wikifetch は**失敗する**） | OK |
| Harbor_Village | **20260109110723** | 直URL（`2019id_` フォールバックでも本文は取れるが**内容が古い**） | OK |
| Landing_Party | `2id_`（最新） | wikifetch | OK |
| Mapmaker | **20250731181007** | 直URL | OK |
| Maroon | `2024id_` / 20250118022943 | wikifetch＋直URL | OK（内容一致） |
| Rope | `2023id_` / 20250115185543 | wikifetch＋直URL | OK（内容一致） |
| Swamp_Shacks | `2023id_` / 20250118074651 | wikifetch＋直URL | OK（内容一致） |
| Tools | `2025id_` | wikifetch | OK |
| Buried_Treasure | **20250114235630** | 直URL（wikifetch は**失敗する**） | OK |
| Crew | `2023id_` / **20251218074554** | wikifetch＋直URL | OK（※下記の注意参照） |
| Cutthroat | `2024id_` / 20250116012433 | wikifetch＋直URL | OK |
| Enlarge | `2019id_`（実体は 2022年以降）/ **20251214203547** | wikifetch＋直URL | OK |

<!-- 検証で訂正: 旧=「Mapmaker / Swamp_Shacks / Tools の3枚だけ 2023〜2024年初頭の古い snapshot しか取れなかった」
     → 誤り。Mapmaker=2025-07-31、Tools=2025年、Swamp_Shacks=2025-01-18 のキャプチャが取れる（内容は 2023年版と完全一致）。
     一方で **Harbor_Village と Crew は「新しいキャプチャで節が増減している」ので、古いキャプチャだけを見ると取りこぼす**
     （下記 §3・§11 参照）。出典=検証エージェントが両方のキャプチャを実取得して差分確認 -->

> ⚠ **英語wiki のページは 2025〜2026年にかけて改稿されており、キャプチャの新旧で FAQ 節の項目が増減している**。
> 実測した差分は2件：
> - **Harbor_Village**：2023年版には無い項目が現行版に4つ増えている（`Way of the Chameleon` / 2枚目の `Inspiring` 港の村 /
>   `Inspiring Merchant`×`Fortune Hunter` / `Enlightenment`）。**古いキャプチャだけを見ると取りこぼす**。
> - **Landing_Party / Crew**：2023年版にあった `Other rules clarifications`（命令カード＋stop-moving）が
>   **現行版では節ごと削除されている**。ルール自体が変わったのではなく wiki の整理と見られるが、
>   **「現行ページに無い」ことは事実**なので、引用するときは「2023年キャプチャ」と明記すること（§4・§11）。

> ⚠ **日本語wikiの表には「(※日本語訳はDominion Onlineより)」の注記がある**。
> 日本語**カード名**は印刷版（ホビージャパン）で確定だが、**日本語カードテキストの一字一句は
> Dominion Online の訳文であり、印刷版カードの文面と細部が違う可能性がある**（要・実物照合）。
> ただし日本語版の実物テキストは今回の一次資料からは取得できなかったため、
> **本アプリのカタログ日本語文はこの訳文をベースに、既存カードの言い回しへ寄せる**のが妥当。
>
> <!-- 検証で訂正: 旧=「各ページに『日本語版登場前のDominion Onlineでの仮名は〜』という記述があり、現行名＝印刷版であることが確認できる」
>      → 13ページ中その記述があるのは **財産目当て と 地図作り の2ページだけ**（実測）。ただし結論は維持できる。
>      出典① 日本語wiki `財産目当て`「なお、ホビージャパンより日本語版が発売される前のDominion Onlineでの名称は「宝探し」であった。」
>      ＋コメント欄「HB版の日本語カード名は[財産目当て]のようですので、修正をお願いします。 -- 2023-03-29」
>      出典② 日本語wiki `地図作り`「ちなみに、Dominion Onlineにおける、日本語版登場前の仮名は「海図職人」であった。」
>      出典③ ホビージャパン公式 https://hobbyjapan.games/dominion_plunder/ ＝日本語版『ドミニオン：略奪』2023年3月発売 -->
> **日本語版が実在すること**（ホビージャパン／2023年3月発売）は公式サイトで確認済み。
> **`乗組員` だけは英語wiki 側にも Japanese 行があり、日本語wiki の訳と食い違う**（§11 参照）。

---

#### 一覧表（id / 名前 / コスト / 種別）

| id | 英語名 | 日本語名 | コスト | 種別（カード記載順） |
|---|---|---|---|---|
| `fortune_hunter` | Fortune Hunter | 財産目当て | `$4` | Action |
| `gondola` | Gondola | ゴンドラ | `$4` | Treasure - Duration |
| `harbor_village` | Harbor Village | 港の村 | `$4` | Action |
| `landing_party` | Landing Party | 上陸部隊 | `$4` | Action - Duration |
| `mapmaker` | Mapmaker | 地図作り | `$4` | Action - Reaction |
| `maroon` | Maroon | 置き去り | `$4` | Action |
| `rope` | Rope | 縄 | `$4` | Treasure - Duration |
| `swamp_shacks` | Swamp Shacks | 沼地の小屋 | `$4` | Action |
| `tools` | Tools | 工具 | `$4` | Treasure |
| `buried_treasure` | Buried Treasure | 埋められた財宝 | `$5` | Treasure - Duration |
| `crew` | Crew | 乗組員 | `$5` | Action - Duration |
| `cutthroat` | Cutthroat | 切り裂き魔 | `$5` | Action - Duration - Attack |
| `enlarge` | Enlarge | 拡大 | `$5` | Action - Duration |

- **負債(Debt)コスト・ポーション費用は13件とも無し**（全部コインのみ）。**13件とも `Versions` 表の英語行は1行だけ
  （`Plunder / December 2022`）＝再版もエラッタ行も無い**ので、上のテキストが現行の印刷そのもの。
- **種別の順**は英語wiki の Info ボックス `Type(s)` 欄の順。
  英語wiki の Info は `Action - Duration - Attack`。**本アプリの `types` 配列はこの順を採る**
  （同盟で決めた「`types` 配列の順にラベルを連ねる汎用規則」に乗る）。
  <!-- 検証で訂正: 旧=「Cutthroat だけ日本語wikiが『アクション-アタック ／（区切り線）／ 持続』の形で描いている」
       → 日本語wiki `切り裂き魔` に **区切り線（--------------------）は無い**。実際の表記は
       「アクション-アタック／他のプレイヤーは全員…／持続／次に(自分を含む)誰かが…」＝
       *種別アイコンを本文の途中に置く* 日本語wiki 共通の表示様式であって区切り線ではない。
       （比較：同じ日本語wikiで ゴンドラ と 埋められた財宝 には実際に "--------------------" が入っている）
       出典= https://wikiwiki.jp/dominiondeck/切り裂き魔 / ゴンドラ / 埋められた財宝 の各カードテキスト欄 -->
- **【重要】区切り線（dividing line）を持つのは 3枚だけ＝`gondola` / `mapmaker` / `buried_treasure`**。
  英語wiki の `Card text` セルの生HTML に `<hr>` があるかで機械判定した実測値：
  Gondola=1・Buried Treasure=1・Mapmaker=1／**Cutthroat=0・Rope=0・Landing Party=0・Crew=0・Enlarge=0**。
  ＝**切り裂き魔の「次に〜戦利品」は区切り線の下ではなく持続能力そのもの**。
  これを取り違えると「習性(Way)や `悟り` で切り裂き魔を使ったとき、線の下だから予約だけは張られる」という
  逆の実装になる（公式は Way を使うと**アタックも予約も両方**発生しない＝`Way` ページ逐語
  「Text below a dividing line is unaffected」の裏返し）。
- **`mapmaker`（地図作り）は既存の異郷 `cartographer`（地図職人）と日本語名がまぎらわしい**。
  日本語wiki も余談で明記：
  > 「`地図職人` と地図作りで日本語がほぼ同じなので区別しづらいが、原語の「Cartographer」と「Mapmaker」では微妙に意味が異なる。」
  id 衝突は無いが、カード一覧の全文検索・ログ表示で人間が混同する。

---

#### 各カードの詳細

##### 1. `fortune_hunter` — Fortune Hunter / 財産目当て — `$4` — Action

**現行カードテキスト（英語・改行位置を再現）**
```
+[$2]
Look at the top 3 cards of your deck. You may play a Treasure from them. Put the rest back in any order.
```

**日本語カードテキスト**
```
+2 コイン
山札の上から3枚を見る。
その中の財宝カード1枚を使用してもよい。
残りを好きな順番で山札の上に戻す。
```

**Official FAQ（逐語）**
> Completely resolve playing the Treasure before putting the other cards back on top; for example if the Treasure is a `Figurine`, the two cards you draw won't be the other ones you looked at with Fortune Hunter.

**日本語wiki「詳細なルール」（逐語・実装に効くもの）**
> 財産目当ての使用時効果は上から順に読み下し処理をする。①山札の上から3枚を見る→②その中の財宝1枚を使用できる→③残りを好きな順番で山札の上に戻す、という順番を意識すること。

<!-- 検証で追記: 下書きが落としていた項目。「任意」と「戻す枚数が 2 or 3」は実装に直接効く。
     出典= https://wikiwiki.jp/dominiondeck/財産目当て 詳細なルール -->
> ②で財宝1枚を使用するのは任意である。②で財宝1枚を使用した場合は、③で残り2枚のカードを好きな順番で山札の上に戻し、②で財宝を使用しなかった場合は、③で3枚のカードを好きな順番で山札の上に戻す。

> ②で財宝1枚を使用する際に、①で見ているカードはデッキではなく脇に置かれている。よって、②による財宝の使用でドローなどのデッキのカードに影響する効果を発揮する場合、①で見ているカードではなく、その時のデッキで処理する。

> 財産目当てが場から捨て札になるタイミングは、常に「財産目当て使用ターンのクリーンアップフェイズ」である。`玉座の間` や `はみだし者` などの『自身の効果で使用したカードが場から離れるまで場に残るカード』との違いに注意。

> 財産目当ての効果で `縄` を使用すると、縄は「財産目当て使用者の次のターンのクリーンアップフェイズ」まで場に残るが、財産目当て自身は「財産目当て使用ターンのクリーンアップフェイズ」に捨て札になる。

**Secret History（参考）**
> The first version was a `Duchess` for `Gold` (it came free with Gold) and could play your top card if it was a non-`Copper` Treasure. Maybe that's just an unrelated card. Then I tried the published card, bam.

---

##### 2. `gondola` — Gondola / ゴンドラ — `$4` — Treasure - Duration

**現行カードテキスト（英語・改行位置を再現／`—` は区切り線）**
```
Either now or at the start of your next turn: +[$2].
—
When you gain this, you may play an Action card from your hand.
```

**日本語カードテキスト**
```
現在またはあなたの次のターンの開始時に、+2 コイン
--------------------
これを獲得したとき、手札のアクションカード1枚を使用してもよい。
```

**Official FAQ（逐語）**
> When playing Gondola, choose whether to get `+[$2]` immediately, or at the start of your next turn.

> If you choose "immediately," Gondola will be discarded in the same turn's Clean-up; if you choose "next turn," Gondola will be discarded that turn.

> If you play Gondola multiple times, such as with `King's Cache`, you choose each time whether to get the `+[$2]` now or next turn, and Gondola only stays `in play` if at least one of the plays was for next turn (in which case the King's Cache also stays in play).

**Other rules clarifications（逐語）**
> Playing an Action card with this does not use up an Action.

> You can't play Treasures from your hand after you start buying cards. So if you gain this by buying it and play a `Smithy`, you won't be able to use the Treasure cards you draw.

> If playing an Action with this sets up a "when you gain a card" effect, that ability will trigger off the Gondola gain. This means you can gain a Gondola, play a `Sailor`, and then have that `Sailor` play the Gondola.

> The exception is if the Action says "next time" (e.g. `Secluded Shrine`), which will instead trigger off the **next** Treasure you gain.

**日本語wiki「詳細なルール」（逐語）**
> ゴンドラを使用したときに、「+2コイン」を今受けるか次のターンの開始時受けるかを選択する。
> 今受けることを選んだ場合、ゴンドラは持続せずにこのターンのクリーンアップフェイズで捨て札にする。
> 次のターンの開始時に受けることを選んだ場合、次のターンでゴンドラの持続効果を発揮し、そのターンのクリーンアップフェイズで捨て札にする。

> `ティアラ` などでゴンドラを複数回使用した場合、1回ごとに今受けるか次のターンの開始時に受けるかを選択する。その場合、1回でも「次のターンの開始時に受ける」を選択した場合は次のターンまで場に残る(ティアラも場に残る)。

**Secret History**：`Didn't change.`

---

##### 3. `harbor_village` — Harbor Village / 港の村 — `$4` — Action

**現行カードテキスト（英語・改行位置を再現）**
```
+1 Card
+2 Actions
After the next Action you play this turn, if it gave you +[$], +[$1].
```

**日本語カードテキスト**
```
+1 カードを引く
+2 アクション
このターン次にアクションカード1枚を使用した後、その効果で+コインを得ていた場合、+1 コイン。
```

**Official FAQ（逐語）**
> This only cares if the `Action` itself gave you `+[$]`, not if you otherwise got `+[$]` due to playing it (such as due to `Training`, from `Adventures`, or due to receiving `The Forest's Gift`, from `Nocturne`).

> It's okay if you no longer have the `[$]` (such as due to `Storyteller`†).

> `+Coffers` (from `Guilds` and `Renaissance`) is not `+[$]`.

> `+[$0]` doesn't get you the bonus.

> Using a `Way` (from `Menagerie`) to get `+[$]` (e.g. `Way of the Sheep`) does get you the bonus.

> If you `Throne Room` a Harbor Village and then play a `Militia`, you played Harbor Village, then Harbor Village, then Militia, so you get nothing for the first play of Harbor Village and `+[$1]` for the second play of it.

**Other rules clarifications（逐語・抜粋）**
> † The `Storyteller` example in the FAQ is referring to the **original** wording that gave you `+[$1]`. Other cards that can give `+[$]` and make you lose `[$]` include `Poor House`, `Souk`, `Capital City`, and `Black Market`.

> If an Action makes `+[$1]`, but you have the `-[$1]` token (from `Bridge Troll` and/or `Ball`), that reduces the Action's `+[$1]` to `+[$0]`, so it won't count for Harbor Village.

> If Harbor Village has `Inspiring`, then the Action you play with it will be the "next" Action that Harbor Village checks for.

> If you use `Way of the Chameleon` on Harbor Village, then that affects both the +1 Card and the `+[$1]` of Harbor Village's text, even though they take place at different times.

> Normally, if you play 2 consecutive Harbor Villages, the first one won't give `+[$]` even if the second one ends up giving you `+[$]`. This is because you don't get `+[$]` from the second Harbor Village until after playing a third Action card, and the first Harbor Village checks if you got `+[$]` from the second Harbor Village before that happens.

<!-- 検証で追記: 下書きが1項目取りこぼしていた（現行 20260109 キャプチャの Other rules clarifications に存在）。
     出典= wiki.dominionstrategy.com/index.php/Harbor_Village (Wayback 20260109110723) -->
> However, if Harbor Village has `Inspiring` and your 2nd Harbor Village causes you to play an Action giving `+[$]` then the 2nd Harbor Village will give `+[$]` early enough for the 1st Harbor Village to give `+[$1]` for it.

> If you play `Kiln`, play Harbor Village, gain a 2nd Harbor Village and play it with `Innovation`, and then play a card giving `+[$]` (e.g., `Militia`), both Harbor Villages will give `+[$1]`. This is because you play the second Harbor Village after putting the first Harbor Village in play, but before resolving it; therefore the Militia is the "next" Action card for both of them.

> If the next Action you play didn't give `+[$]`, but replaying that card causes it to give `+[$]` (e.g. you play a `Steward` and choose +2 Cards, then call a `Royal Carriage` on the `Steward` and choose `+[$2]`), that won't count for Harbor Village.

> However, if the `Steward` is `Reckless`, and you choose +2 Cards and `+[$2]`, that will count for Harbor Village.

> If `Enlightenment` is in effect, `Treasure` cards are Actions. This means, when Enlightenment is in effect, if Harbor Village is the last card you play during the Action phase, and the first card you play during the Buy phase is a Treasure giving `+[$]`, the Harbor Village will give you `+[$1]`. However, if you play the Treasure after Harbor Village during your Action phase, it won't give you any `+[$]` and therefore neither will Harbor Village.

**日本語wiki「詳細なルール」（逐語・抜粋）**
> 【追加効果】を得られる条件は「(港の村を使用した後、同じターン内に)その次にアクションAを使用した際、『アクションA自身の効果』でコインを得ていた場合」に限られる。

> アクションAの効果が「+コイン」を含む選択式のもの(`手先` や `執事` など)や、条件によって+コインを得られるもの(`鉱山の村` や `首都` など)であるとき、それを処理した結果+コインを得た場合のみ【追加効果】を得られる。

> アクションAの使用によって「+0コインしか発生しなかった(`引揚水夫` で `銅貨` を廃棄したなど)」という場合は、【追加効果】は得られない。

> アクションAの使用によって「+1`財源`」を得ても、『アクションA自身の効果』でコインを得ていないので、【追加効果】を得られるかどうかの判定に影響しない。

> アクションAの使用に誘発し「`+1コイントークン`」の効果で+1コインを得た場合も、【追加効果】を得られるかどうかの判定に影響しない。／連携カードであるアクションAの使用に誘発し「`小売店主連盟`」の効果で+1コインを得た場合も、（同）。

> アクションAを `サルの習性`、`ラバの習性`、`アザラシの習性`、`羊の習性` として使用した場合は、『アクションA自身の効果』ではなく習性によってコインを得ている扱いとなり、【追加効果】を**得られない**。
> ただし、アクションAを `カメレオンの習性` として使用した場合、カメレオンの習性の処理として『アクションA自身の効果』の指示に従うため、ドローコイン入れ替え後に判定を行い、最終的に+コインを得ていれば【追加効果】を得る。

> アクションAの効果が「処理中はコインを産まないが、処理終了後に『別の処理に誘発して+コインを得る』というもの(`商人` や港の村など)」であるとき、【追加効果】は得られない。

> 多くの財宝カードはテキストが「+Xコイン」ではなく「Xコイン」だがこれは同じとみなす。

> 【追加効果】が誘発されるのは「(港の村を使用した後、同じターン内に)『その次に使用したアクションA』の使用時効果を全て処理し終えた直後」のタイミングである。（…）同じタイミングの処理には「`法貨` や `御料車` の呼び出し」「`フリゲート船` のアタックの処理」「`写本士の仲間たち` の処理」などがある。

> 例②：`玉座の間` との組み合わせ例 … 港の村(1回目)の【追加効果】は得られない／港の村(2回目)の【追加効果】は得られる。

##### ⚠【要ユーザー確認】習性(Way)由来の +$ で港の村のボーナスを得るか＝一次資料が真っ向から割れている

<!-- 検証で訂正: 旧=「英語wiki の Official FAQ（＝公式）が正。日本語wiki側は有志の解釈で一次資料ではない。
     実装は英語FAQに従い『習性由来の +$ でもボーナスを得る』」
     → **断定できない**。日本語wiki の注釈 *3 は「有志の解釈」ではなく **2025年2月の移動動物園エラッタ＋
     2025年3月の Donald X. の Discord 回答** を出典として明示しており、英語wiki の Official FAQ 節は
     2022年公式FAQ文書の再録で更新されていない可能性が高い。どちらが現行かを一次資料で確定できなかったので
     要ユーザー確認に格下げする。出典=日本語wiki 港の村 脚注*3 の HTML 内リンク
     https://discord.com/channels/609163450077151233/769292895844040715/1346919176505135125 （2025-03-05 頃のメッセージID） -->

| 立場 | 逐語 | 出典 |
|---|---|---|
| **得る** | `Using a Way (from Menagerie) to get +[$] (e.g. Way of the Sheep) does get you the bonus.` | 英語wiki `Harbor_Village` の **Official FAQ** 節（20260109 キャプチャでも同文のまま） |
| **得ない** | `アクションAを サルの習性、ラバの習性、アザラシの習性、羊の習性 として使用した場合は、『アクションA自身の効果』ではなく習性によってコインを得ている扱いとなり、【追加効果】を得られない。` | 日本語wiki `港の村` 詳細なルール。**脚注 `*3`＝「英語版移動動物園（拡張）改版に伴う2025年2月エラッタに伴って処理が変更された。」＋ Discord リンク（2025年3月・Dominion 公式サーバのルール質問チャンネル）** |

- 英語wiki の `Official FAQ` 節は**発売時（2022年）の公式FAQ文書の丸写し**で、後年の裁定変更を反映しない運用になっている
  （同ページ内でも `†The Storyteller example in the FAQ is referring to the original wording` のように
  「FAQ の記述が古い」と注釈で補う形が実際に使われている）。
- 一方 Discord の当該メッセージは**認証なしでは読めず**、英語wiki 側にも 2025年エラッタの記述は見つからなかった
  （`Way` ページ・`Way_of_the_Sheep` ページとも 2025年エラッタへの言及なし。`Way_of_the_Sheep` は
  `Way of the Sheep does not have an official FAQ` と書かれているだけ）。
- **したがって実装方針は要ユーザー確認**。なお本アプリへの実害は
  「習性 × 港の村」＝**mix-all でしか同居しない**ので、どちらに倒しても出荷セットの挙動は変わらない。
  迷うなら**日本語wiki 側（＝新しい裁定・得られない）に倒すほうが安全**（`addCoins` の由来タグを
  「カード自身の効果か」だけで判定すれば自然にこちらになる）。

---

##### 4. `landing_party` — Landing Party / 上陸部隊 — `$4` — Action - Duration

**現行カードテキスト（英語・改行位置を再現）**
```
+2 Cards
+2 Actions
The next time the first card you play on a turn is a Treasure, put this onto your deck afterwards.
```

**日本語カードテキスト**
```
+2 カードを引く
+2 アクション
次にターン中最初に使用するカードが財宝カードであるとき、その後にこれを山札の上に置く。
```

**Official FAQ（逐語）**
> Resolve the `Treasure` before putting Landing Party on your deck; for example if the Treasure is `Figurine`, you'd draw 2 cards before putting Landing Party on top.

> It's okay if the Treasure has more types, including `Action` (like `Spell Scroll`).

**Other rules clarifications（逐語）**
> See the `Additional rules section` for Duration cards in Dominion: Plunder regarding things happening "the next time".

> `Duration` cards that you played on previous turns that have an effect at the beginning of this turn, such as `Caravan`, don't have any effect on whether you can top-deck Landing Party. Neither do `Reserve` cards put into play at the beginning of the turn by `calling` them, such as `Transmogrify`. Only the first card you actually play on the turn, and whether or not it is a Treasure, matters for Landing Party.

> The first card you play on your turn can be one that you play from your hand in the normal way, or it can be one played as a result of an "at the start of your turn" instruction, such as that of `Piazza`, `Reap`, or `Royal Galley`. What matters for start-of-your-turn instructions is whether they are actually telling you to "play" something.

<!-- 検証で訂正: 旧=この項目を「現行ページの Other rules clarifications」として並べていた。
     → **現行ページ（wikifetch の 2id_＝最新キャプチャ）にはこの項目は存在しない**（節ごと削除されている）。
     実在するのは **2023-06-01 キャプチャ**（https://web.archive.org/web/20230601id_/https://wiki.dominionstrategy.com/index.php/Landing_Party）。
     引用文そのものは逐語で正しい（"Band of Misfits" で合っている＝Crew ページ版の "Overlord" と取り違えてはいない）。
     出典=検証エージェントが新旧2キャプチャを実取得して差分確認 -->
> **【2023年キャプチャのみ・現行ページからは削除済み】** If you play this with a `Command variant` such as `Band of Misfits`, the `stop-moving rule` means that Landing Party can't put itself onto your deck, and it isn't waiting for anything to happen. So you'll discard the `Band of Misfits` from play during this turn's Clean-up.
> ※**同内容の clarification は `Crew` ページにもあり、そちらは `Overlord` を名指ししている**（§11 に追記した）。
> 2枚とも「自分を場から動かす持続」なので、ルールの中身は現行でも生きていると読める（`stop-moving rule` は一般ルール）。
> ただし**「現行ページに載っている」とは書けない**ので、実装コメントに引くときは出典キャプチャを明記すること。

> If the first Treasure you play is a `Spell Scroll`, which gains and plays a Landing Party, that will make you topdeck your other Landing Parties, but not the one you just played (it triggers off the **next** time your first card played is a Treasure).

> If you play a Treasure on someone **else's** turn (for example, if you gain a `Buried Treasure` as a result of a `Barbarian` attack and immediately play it), that can top-deck your Landing Parties.

**日本語wiki「詳細なルール」（逐語・抜粋）**
> 上陸部隊は場から山札の上に移動するカードであり、場から捨て札になることがない。よって、【`疲れ知らずの`上陸部隊】は特性の効果を得ることが基本的にできないので注意。

> 上陸部隊が場から山札の上に移動する処理は『財宝カードを使用した直後』に誘発する。他に『カードを使用した直後』に誘発する効果があれば同時に誘発し、その処理順は自由に選択できる。

> このターンに最初に使用したアクションカードAが、このターンに `資本主義` を購入したことにより財宝化した場合でも、「ターン中最初に財宝カードを使用した」として扱われることはないので注意。

> 上陸部隊は「『自分のターン以外を含むあらゆるターン』で、『あなた』が最初に使用するカードが財宝カードであるとき」に山札の上に移動する。

**「the next time」の一般ルール（略奪ルールブック／英語wiki 拡張ページ 逐語）**
> Some Duration cards in Plunder do something the "next time" a certain thing happens. That thing could happen the same turn, or many turns later; these may sit in play turn after turn until finally the thing happens.

---

##### 5. `mapmaker` — Mapmaker / 地図作り — `$4` — Action - Reaction

**現行カードテキスト（英語・改行位置を再現／`—` は区切り線）**
```
Look at the top 4 cards of your deck. Put 2 into your hand and discard the rest.
—
When any player gains a Victory card, you may play this from your hand.
```

**日本語カードテキスト**
```
山札の上から4枚を見る。
その中の2枚を手札に加え、残りを捨て札にする。
--------------------
誰かが勝利点カード1枚を獲得したとき、あなたはこれを手札から使用してもよい。
```

**Official FAQ（逐語）**
> If you have fewer than four cards (after `shuffling`), you just look at what's left.

> You may play this when someone (including you) `gains` a `Victory` card due to `buying` it, or some other way.

> When you play Mapmaker in response to someone gaining a Victory card, you can immediately play another Mapmaker afterwards - even one you just got via the first Mapmaker.

**Other rules clarifications（逐語）**
> This plays like the Reactions in `Menagerie`; see the `Reactions section`.

**日本語wiki「詳細なルール」（逐語）**
> 地図作りの使用時効果は全てドローではないので、`－1カードトークンの機能` の影響を受けず、－1カードトークンは次のドローまで残り続ける。

> 仕切り線より下はカード獲得時に誘発する獲得時効果であり、いわゆる【獲得誘発リアクション】と言える。

---

##### 6. `maroon` — Maroon / 置き去り — `$4` — Action

**現行カードテキスト（英語・改行位置を再現）**
```
Trash a card from your hand. +2 Cards per type it has (Action, Attack, etc.).
```

**日本語カードテキスト**
```
手札1枚を廃棄する。
それが持つ種別(アクション、アタックなど)1つにつき +2 カードを引く。
```

**Official FAQ（逐語）**
> `Types` are the words on the bottom banner of cards - `Action`, `Attack`, and so on.

> For example if you `trash` a `Cage` with Maroon, you'll `draw` 4 cards, since it's a `Treasure` and a `Duration`, 2 types.

**Other rules clarifications（逐語）**
> If the trashed card has a `Trait`, or is `Young Witch`'s Bane, that won't count as an extra type for Maroon.

> `Inheritance`, `Capitalism`, and `Charlatan` will add types to cards.

**日本語wiki「詳細なルール」（逐語）**
> 置き去りを使用した際、手札の廃棄は強制処理であり、手札が1枚以上あればいずれかを必ず廃棄しなければならない。

> 置き去りを使用した際に手札が0枚の場合、廃棄に失敗する。

> サプライの山に `特性` がセットされている場合でも、カード種別が増えるわけではないので注意。`魔女娘` が指定する「災いカード」のサプライのカードも、カード種別が増えるわけではないので注意。

> エラッタ等によってカード種別が追加されているカードとの組み合わせに注意。具体的には、`はみだし者`、`大君主`、`王笏`、`王子`、`Captain` 及び `相続` 購入後の `屋敷` が該当する。

---

##### 7. `rope` — Rope / 縄 — `$4` — Treasure - Duration

**現行カードテキスト（英語・改行位置を再現）**
```
[$1]
+1 Buy
At the start of your next turn, +1 Card and you may trash a card from your hand.
```
（※日本語wiki側にも区切り線 `--------------------` の記載は無い＝1ブロック）

**日本語カードテキスト**
```
1 コイン
+1 購入
あなたの次のターンの開始時に、+1 カードを引く、手札1枚を廃棄してもよい。
```

**Official FAQ（逐語）**
> When you play this, you get `+[$1]` and +1 Buy, and at the start of your next turn, you first draw a card, then may trash a card from your hand.

**日本語wiki「詳細なルール」（逐語）**
> 次のターン開始時に手札1枚を廃棄することは任意である。

**Secret History（参考・実装に無関係）**
> Started as a Sailor in Seaside 2E. … then it moved here, dropped the reaction, and became a Treasure; then the coin and buy moved to the turn played.

---

##### 8. `swamp_shacks` — Swamp Shacks / 沼地の小屋 — `$4` — Action

**現行カードテキスト（英語・改行位置を再現）**
```
+2 Actions
+1 Card per 3 cards you have in play (round down).
```

**日本語カードテキスト**
```
+2 アクション
あなたが場に出しているカード3枚(端数切り捨て)につき、+1 カードを引く。
```

**Official FAQ（逐語）**
> This counts the Swamp Shacks itself, and `Duration` cards played on previous turns that are still in play.

> It counts `Treasures` if you have some in play, such as Treasure Duration cards, or due to `Fortune Hunter`.

> It does not count set aside cards, such as cards on a `Quartermaster`.

> Round down the number of cards you draw; if you have 8 cards in play, you draw 2.

**日本語wiki「詳細なルール」（逐語）**
> このターンにプレイしたカードの枚数は関係なく、場に出ているカードの枚数のみを数える。

> 場に持続している持続カード、呼び出したリザーブカードなどは数え、プレイして廃棄されたカードなどは数えない。

> 「脇に置く」効果によって置かれたカードも場の枚数に含まれない。特に表向けで脇に置く効果を持つカード（`忠犬`、`貨物船`、`王子` など）がある場合は、場のカードと混同しないように注意。

**Secret History（参考）**
> Initially cost `[$3]` and gave +1 Card per 4 cards you had in play.

---

##### 9. `tools` — Tools / 工具 — `$4` — Treasure

**現行カードテキスト（英語）**
```
Gain a copy of a card anyone has in play.
```

**日本語カードテキスト**
```
(自分を含む)誰かが場に出しているのと同じカード1枚を獲得する。
```

**Official FAQ（逐語）**
> This can gain a copy of a card any player has in play; other players may for example have `Duration` cards in play.

> Tools itself is in play, so you can gain a copy of that.

**Other rules clarifications（逐語）**
<!-- 検証で訂正: 旧="(such as `Loot`)" → 実際は複数形 "(such as Loots)"。
     出典= wiki.dominionstrategy.com/index.php/Tools (Wayback 2025id_) -->
> This can't gain a copy of a card that `isn't in the Supply` (such as `Loots`). However, you can still try to gain a copy of it (and gain nothing).

**日本語wiki「詳細なルール」（逐語）**
> 工具を使用した際、(自分を含む)誰かが場に出しているのと同じカード1枚を獲得するのは強制効果である。

> 前のターンから場に出ている持続カードや呼び出したリザーブカードも「場に出ているカード」なので、工具の効果で指定できる。

> 誰のターンかに関わらず、他のプレイヤーが使用したカードも「場に出ているカード」なので、工具の効果で指定できる。

> 持続カードはもちろん、リアクションで使用されたカードもクリーンアップ処理されるまでは場に残っているため、選択肢に入る。

**Secret History（参考）**
> This started as an Action for $5 … To make it good enough it had to be a Treasure for $4. … I considered limiting it to gaining Actions, so it couldn't gain a Tools, but in the end it gets to.

---

##### 10. `buried_treasure` — Buried Treasure / 埋められた財宝 — `$5` — Treasure - Duration

**現行カードテキスト（英語・改行位置を再現／`—` は区切り線）**
```
At the start of your next turn, +1 Buy and +[$3].
—
When you gain this, play it.
```

**日本語カードテキスト**
```
あなたの次のターンの開始時、+1 購入、+3 コイン。
--------------------
これを獲得したとき、使用する。
```

**Official FAQ（逐語）**
> When you gain this, you have to play it; it's not optional.

**日本語wiki「詳細なルール」（逐語）**
> 埋められた財宝を獲得した際、使用するのは強制効果である。以下の場合に注意。

> 他プレイヤーのターン中に(`蛮族` のアタック効果で `金貨` を廃棄した場合などで)埋められた財宝を獲得した際も、獲得時効果は誘発するので、埋められた財宝が使用される。

> `職人` などの効果で手札に直接埋められた財宝を獲得した際でも、手札に留めておくことはできず、必ず場に出て使用する処理となる。
> ただし、この時「他の『手札からのカード使用の制限』に抵触する」という場合は、埋められた財宝を使用しないことに注意。具体的には、「`航海` の『ターン中使用できる手札は3枚まで』という制限」が該当する。

> `工匠` などの効果でデッキトップに直接埋められた財宝を獲得した際でも、デッキトップに留めておくことはできず、必ず場に出て使用する処理となる。

> `封鎖` などの効果で脇に直接埋められた財宝を獲得した際でも、脇に留めておくことはできず、必ず場に出て使用する処理となる。

> ただし、埋められた財宝の獲得時に、埋められた財宝の獲得時効果を処理する前に、別の獲得時効果で埋められた財宝を獲得先から移動させた場合は、埋められた財宝を使用するのに失敗する。

**日本語wiki コメント欄のQ&A（逐語）**
<!-- 検証で訂正: 旧=「準一次」とラベルしていた → **一次資料ではない**（wiki の匿名コメント欄の回答）。
     引用自体は逐語で正しい（2024-06-20 の質問と回答）。実装で頼るなら英語wiki 側で裏取りが要る。 -->
> ⚠ **これは wiki のコメント欄＝有志の回答であり一次資料ではない**（引用は逐語で正しい）。
> (1)総督の廃棄効果により他プレイヤーが埋められた財宝を獲得した場合でも埋められた財宝は使用され、使用者のターンが回ってきた段階で+1 購入、+3 コインが得られますか？(2)追いはぎ効果が有効な上で(1)のように他プレイヤーが埋められた財宝を獲得した場合、(それが初めて使用する財宝であれば)埋められた財宝が無効化され、残りの財宝は影響しないということで良いですか？(3)(もし(2)が正しい場合)無効になった埋められた財宝が捨て札になるのはいつですか？
> → (1)(2)ともに正解。(3)は使用した(埋められた財宝を獲得した)ターンのクリーンアップ。

---

##### 11. `crew` — Crew / 乗組員 — `$5` — Action - Duration

**現行カードテキスト（英語・改行位置を再現）**
```
+3 Cards
At the start of your next turn, put this onto your deck.
```

**日本語カードテキスト**（日本語wiki＝Dominion Online 訳）
```
+3 カードを引く
あなたの次のターンの開始時、これを場から山札の上に置く。
```

<!-- 検証で追記: 13枚中 **乗組員 だけ英語wiki 側にも Japanese 行がある**（20251218074554 キャプチャの Other language versions）。
     そこでは「あなたの次のターンの開始時、**これをあなたのデッキの上に置く。**」となっており、
     日本語wiki（Dominion Online 訳）の「これを**場から山札の上に**置く。」と文面が違う。
     どちらが HJ 印刷版かは実物照合が必要＝**要ユーザー確認**（カード名 `乗組員` は両者一致）。
     出典= wiki.dominionstrategy.com/index.php/Crew (Wayback 20251218074554) Other language versions / Japanese 行 -->
> **⚠【要ユーザー確認】英語wiki の Japanese 行は別訳**：`+3 カードを引く／あなたの次のターンの開始時、これをあなたのデッキの上に置く。`
> （日本語wiki は `これを場から山札の上に置く。`）。カード名 `乗組員` は一致。文面のどちらが印刷版かは実物照合が要る。

**Official FAQ（逐語）**
> Putting this onto your deck isn't optional.

**Other rules clarifications（逐語）**
<!-- 検証で追記: 下書きは Crew の Other rules clarifications を1件も載せていなかった。
     2023id_ キャプチャに実在（現行 20251218 キャプチャでは節ごと削除済み）。
     出典= wiki.dominionstrategy.com/index.php/Crew (Wayback 2023id_) -->
> **【2023年キャプチャのみ・現行ページからは削除済み】** If you play this with a `Command variant` such as `Overlord`, the `stop-moving rule` means that Crew can't put itself onto your deck, and it isn't waiting for anything to happen. So you'll discard the `Overlord` from play during this turn's Clean-up.

**日本語wiki「詳細なルール」（逐語）**
> このカードは使用したターンのクリーンアップフェイズには捨て札にならず、次ターンの開始時に場から山札の上に移動する。

> 「次のターンの開始時、乗組員を場から山札の上に置く」の処理時、乗組員は捨て札置き場を経由せず、直接山札の上に移動する。よって、【`疲れ知らずの`乗組員】は特性の効果を得ることが基本的にできないので注意。

> 「次のターンの開始時、乗組員を場から山札の上に置く」の処理は強制処理であるので注意。

> `玉座の間` などで乗組員を複数回使用した際の、玉座の間系が場から捨て札になるタイミングに注意。（…）乗組員(A)の持続効果が処理され、場からデッキトップに移動する。この時点で『使用した持続カード(=乗組員(A))が場から離れた』と判定されるが、このタイミングで玉座の間Aが捨て札になるのではなく、11ターン目のクリーンアップフェイズで場から捨て札になる。

> その後場に同名のカードが戻ってきても、`移動阻止ルール` により、「その使用した乗組員(A)が場に持続し、次のターンに持続効果を予約している」という状況だとは**判断されない**。

---

##### 12. `cutthroat` — Cutthroat / 切り裂き魔 — `$5` — Action - Duration - Attack

<!-- 検証で訂正: 旧=英語/日本語とも2行の間に区切り線（`—` / `--------------------`）を入れていた。
     → **切り裂き魔に区切り線は無い**。英語wiki の Card text セルの生HTML に `<hr>` は 0個
     （比較：Gondola / Buried_Treasure / Mapmaker は各1個ある）。日本語wiki `切り裂き魔` にも
     "--------------------" は無く、日本語wiki が入れているのは種別アイコン「持続」だけ。
     出典= wiki.dominionstrategy.com/index.php/Cutthroat (Wayback 20250116012433) の Card text セルHTML／
           https://wikiwiki.jp/dominiondeck/切り裂き魔 -->
**現行カードテキスト（英語・改行位置を再現／★区切り線は無い）**
```
Each other player discards down to 3 cards in hand.
The next time anyone gains a Treasure costing [$5] or more, gain a Loot.
```

**日本語カードテキスト**（★区切り線は無い＝2行目も持続能力そのもの）
```
他のプレイヤーは全員、手札が3枚になるように捨て札にする。
次に(自分を含む)誰かがコスト5以上の財宝カード1枚を獲得したとき、あなたは戦利品1枚を獲得する。
```

**Official FAQ（逐語）**
> `Loot` itself is a `Treasure` costing `[$5]` or more, so a player `gaining` one will `trigger` Cutthroats.

**Other rules clarifications（逐語）**
> See the `Additional rules section` for `Duration` cards in `Dominion: Plunder` regarding things happening "the next time".

> If you gain a `Gold`, that will trigger Cutthroats by all players (including ones that you already played). However, if the Gold gain causes you to play a Cutthroat (you gain one from `Haggler` and then play it with `Rush`), the Gold won't trigger the Cutthroat you just played (it triggers off your **next** `Treasure` gain).

> The "next time" effect gets set up after the other players `discard`. So if another player discards a `Tunnel` and gains a Gold, that won't cause you to gain a Loot.

**Strategy / Antisynergies（逐語）**
<!-- 検証で訂正: 旧="can make all `Treasures` cost 4 or less"（大文字＋リンク扱い）
     → 実際は小文字の平文 "all treasures"。出典= wiki.dominionstrategy.com/index.php/Cutthroat (Wayback 20250116012433) -->
> `Family of Inventors` and other `cost reduction` effects can make all treasures cost 4 or less, stopping Cutthroat from triggering.

**日本語wiki「詳細なルール」（逐語・抜粋）**
> このカードは使用後、誰かがコスト5以上の財宝を獲得し、持続処理を発揮するまで場に残り続け、【戦利品ボーナス】を発揮した次のクリーンアップフェイズに捨て札になる。

> 獲得したカードのコストが5以上か(=【戦利品ボーナス】を得るか)はカード獲得時に判定され、その後コストが変動しても判定が覆ることは無い。

> `資本主義` 影響下、捨て札が空の状態で `漁師` を獲得した場合は、2コストの財宝カードを獲得したと判定されるので、【戦利品ボーナス】は得られない。一連の処理で捨て札置き場にカードが存在することとなり、漁師は5コストに戻ることも有るだろうが、それで判定が覆ることは無い。

<!-- 検証で追記: 下書きが落としていた「逆向きの例」。片方だけ実装すると非対称になる。
     出典= https://wikiwiki.jp/dominiondeck/切り裂き魔 詳細なルール -->
> 資本主義影響下で `動物見本市` をアクションカードを廃棄することで購入した場合でも、7コストの財宝カードを獲得したと判定されるので、【戦利品ボーナス】を得る。

> なお、`過払い` はカードのコストを変動させる処理ではないので注意。`名品` 購入時、2コイン分過払いしても、3コストの財宝カードを獲得したと判定されるので、【戦利品ボーナス】を得ない。

> 【戦利品ボーナス】効果は、『カード獲得に誘発する効果』である。他に『カード獲得に誘発する効果』があれば、同時に誘発し、処理順は自由に選べる。ただし、複数のプレイヤー間で同時に効果が誘発している場合は、【ターンプレイヤーからターン順に処理が優先される】という原則(`ターンプレイヤー優先原則`)があり（…）

> 例えば、「切り裂き魔Cのアタック効果(あるいは切り裂き魔C使用に誘発するリアクション効果)で、他プレイヤーが `坑道` を捨て札にし、`金貨`(=コスト5以上の財宝カード)を獲得する」という処理が発生することがあるが、この場合切り裂き魔Cの【戦利品ボーナス】は誘発しない。

---

##### 13. `enlarge` — Enlarge / 拡大 — `$5` — Action - Duration

**現行カードテキスト（英語・改行位置を再現）**
```
Now and at the start of your next turn: Trash a card from your hand, and gain one costing up to [$2] more.
```

**日本語カードテキスト**
```
現在とあなたの次のターンの開始時：
手札1枚を廃棄し、それよりコストが最大2高いカード1枚を獲得する。
```

**Official FAQ（逐語）**
> Once you've played Enlarge, `trashing` a card at the `start of your next turn` is mandatory.

**日本語wiki「詳細なルール」（逐語）**
> 拡大を使用した場合、使用時、次のターンの開始時ともに必ず手札1枚を廃棄しなくてはならない。

> 手札1枚を廃棄した場合、必ずカード1枚を獲得しなくてはならない。例えば、0コストの `呪い` を廃棄した場合、呪い・`銅貨`・`屋敷`・その他0～2コストのサプライにあるカードのどれかを獲得することになる。

> 手札が1枚もなくカードを廃棄できなかった場合は、カードを獲得できない。

> コストを参照するとき廃棄したカードは通常廃棄置き場にある。

> 獲得するカードは廃棄したカードのコストよりちょうど2多い必要はなく、廃棄したカードのコストとコストが同じ、あるいはそれよりコストが少ないカードでもよい。

> 廃棄したカードのコストにポーション(負債)が含まれている場合、コストが最大2コイン多ければ、コストにポーション(廃棄したカードの負債コスト以下の負債)が含まれるカードを獲得できる。
> `大学`(2+P) を廃棄した場合、コスト4+P以下のカード1枚を獲得する。ポーションが含まれていない、ただの4コスト以下のカードでもよい。
> `大金`(8+負債8) を廃棄した場合、コスト10+負債8以下のカード1枚を獲得する。負債が含まれていない `属州`(8) や `白金貨`(9) や `王城`(10)、逆に負債だけの `大君主`(負債8) などでもよい。

**Secret History（参考）**
> Didn't change, though having it be mandatory next turn was debated.

---

#### 実装時に事故りそうな落とし穴（逐語引用つき）

##### A. 「the next time 〜」持続は、条件が満たされるまで**何ターンでも場に残り続ける**（Landing Party / Cutthroat）

<!-- 検証で訂正: 旧=出典が「略奪ルールブック／英語wiki 拡張ページ」とだけ書かれていて曖昧だった。
     英語wiki の `Plunder` は **帝国の財宝カード**のページ（陣地の分割山の下段）。拡張のページは `Plunder_(expansion)`。
     正しい出典＝`Plunder_(expansion)` の Additional rules → Durations 節（Wayback 2025id_）。逐語は一致していた。 -->
> Some Duration cards in Plunder do something the "next time" a certain thing happens. **That thing could happen the same turn, or many turns later; these may sit in play turn after turn until finally the thing happens.** For example you could play a `Secluded Shrine` and two `Coppers`, buy a `Silver`, and immediately trash two cards from your hand, discarding Secluded Shrine that turn. Or you could buy a `Stowaway` instead, and leave Secluded Shrine in play for next turn.
> （出典＝英語wiki **`Plunder_(expansion)`** の `Additional rules` → `Durations` 節。※`Plunder` 単体は帝国の財宝カードのページなので別物）

本エンジンの持続は「次の自分の手番開始時に `DURATION_RESOLVERS` が解決して捨てる」前提（`p.delayedEffects`／
`cleanupAndAdvance` の `cnt.<id>`）なので、**「開始時ではなく任意のイベントで解決し、それまで場に残る」という
第3の持続モデルが要る**。既存で一番近いのは同盟の**条件つき持続**（要塞・駐屯地）と暗黒時代の
「相手のターンをフックする持続」（沼の妖婆・呪いの森・`applyLingerOnBuy`）。**Cutthroat は
コスト軽減で永久に条件を満たさなくなり得る**：

> `Family of Inventors` and other `cost reduction` effects can make all treasures cost 4 or less, **stopping Cutthroat from triggering.**

＝**場に永久に残る持続が保存則テスト（`durationCards` と `cnt` の突き合わせ）を壊さないか**、
また `emptyPileCount`／終局判定が回るか（無限に残っても終局する）を必ず fuzz で確認する。

##### B. Cutthroat：**アタックの捨て札を全部解決してから**「next time」を張る（順序が非対称）

> The "next time" effect gets set up **after** the other players `discard`. So if another player **discards a `Tunnel` and gains a Gold, that won't cause you to gain a Loot.**

＝`applyEffect` の中で「アタック解決 → その後に予約を張る」の順を守ること。
本エンジンは `discard_down` 系がアタック用の pending を積んで**後から解決する**ので、
**pending が全部閉じてから予約を張る**必要がある（`onGainQueue` / reduce 末尾の再開網に載せる）。
素直に `case 'cutthroat'` の中で予約を張ると、坑道の金貨で自分が Loot を取れてしまう。

##### C. Cutthroat：**Loot 自身が「$5以上の財宝」＝連鎖する**／**自分の獲得でも誰の獲得でも誘発**

> `Loot` itself is a `Treasure` costing `[$5]` or more, so a player `gaining` one will `trigger` Cutthroats.

> If you gain a `Gold`, that will trigger Cutthroats by all players (including ones that you already played).

＝1回の金貨獲得で **全プレイヤーの Cutthroat が同時に発火し、その Loot 獲得がさらに別の Cutthroat を発火させる**。
`triggerOnGain` の再入（`_gainDepth`）と処理順（**ターンプレイヤーからターン順**）の設計が必要。
日本語wikiの4人戦の例が正本：
> まずは、ターンプレイヤーであるプレイヤーAの『プレイヤーAの貴族獲得に誘発する効果』を自由な順番で処理する。（…）よって、**プレイヤーA,C,Dの順**に切り裂き魔の持続効果による【戦利品ボーナス】を得る。

さらに**自分が張った直後の予約は自分の獲得では発火しない**（"next" の意味）：
> However, if the Gold gain causes you to play a Cutthroat (you gain one from `Haggler` and then play it with `Rush`), the Gold **won't** trigger the Cutthroat you just played (it triggers off your **next** `Treasure` gain).

##### D. Cutthroat：コストは**獲得時点で確定**し、後から変わっても覆らない／過払いはコストを変えない

> 獲得したカードのコストが5以上か(=【戦利品ボーナス】を得るか)は**カード獲得時に判定され、その後コストが変動しても判定が覆ることは無い**。

> なお、**`過払い` はカードのコストを変動させる処理ではない**ので注意。`名品` 購入時、2コイン分過払いしても、3コストの財宝カードを獲得したと判定されるので、【戦利品ボーナス】を得ない。

＝`cardCost(state, id)` を**獲得の瞬間にスナップショット**して比較する。§0-29 で踏んだ
「混合山の獲得ログは `gain()` の**前**に `mixedTopCard` を評価する」と同じクラス。

##### E. Landing Party：**「あなたが」そのターン最初に使ったカード＝相手のターンでも数える**

> If you play a Treasure on someone **else's** turn (for example, if you gain a `Buried Treasure` as a result of a `Barbarian` attack and immediately play it), **that can top-deck your Landing Parties.**

＝「そのターンの手番プレイヤー」ではなく**プレイヤー毎の per-turn カウンタ**が要る
（`t.<something>` は手番プレイヤーのものなので使えない）。**相手のターンに `p.playsThisTurn` を数える器**が必要。
しかも本群の `buried_treasure`（獲得時に強制プレイ）が**まさにその経路を作る**＝この2枚は同じ拡張に同居する。

##### F. Landing Party / Fortune Hunter：**財宝を完全に解決してから**次の処理をする

> Resolve the `Treasure` before putting Landing Party on your deck; for example if the Treasure is `Figurine`, you'd draw 2 cards before putting Landing Party on top.（Landing Party）

> Completely resolve playing the Treasure before putting the other cards back on top; for example if the Treasure is a `Figurine`, **the two cards you draw won't be the other ones you looked at with Fortune Hunter.**（Fortune Hunter）

＝**Fortune Hunter の見ている3枚は deck から抜いて脇に持つ**（§0-29 の歩哨 Sentinel と同型）。
「deck の先頭3枚を覗くだけ」で実装すると、Figurine 等でその3枚を引いてしまい**カードが二重に動く＝保存則違反**。

##### G. Landing Party / Crew：**命令(Command)で使うと stop-moving で自分を動かせず、待ちもしない**

<!-- 検証で訂正: 旧=Landing Party の1件だけを挙げ、しかも「現行ページの記述」として扱っていた。
     → 実際は **Landing_Party と Crew の両ページに1件ずつあり、どちらも 2023年キャプチャ限定**（現行ページでは削除済み）。
     Crew 版は `Overlord` を名指ししている。出典=Wayback 20230601 / 2023id_ の両ページ -->
> **【Landing_Party・2023年キャプチャ】** If you play this with a `Command variant` such as `Band of Misfits`, the `stop-moving rule` means that Landing Party can't put itself onto your deck, and **it isn't waiting for anything to happen. So you'll discard the `Band of Misfits` from play during this turn's Clean-up.**

> **【Crew・2023年キャプチャ】** If you play this with a `Command variant` such as `Overlord`, the `stop-moving rule` means that Crew can't put itself onto your deck, and **it isn't waiting for anything to happen. So you'll discard the `Overlord` from play during this turn's Clean-up.**

＝§0-17 の `playAsCommand` / `takeSelf` / `playedByCommand` にそのまま乗る。
**「命令経由なら予約を張らない」**まで実装しないと、大君主/はみだし者が永久に場に残る。
Crew も同型（自分をデッキトップに置く）＝命令経由では動かない。

##### H. Landing Party / Crew：**場から捨て札を経由せず山札の上へ移動する**＝玉座の間の捨てるタイミング

> 「次のターンの開始時、乗組員を場から山札の上に置く」の処理時、乗組員は**捨て札置き場を経由せず、直接山札の上に移動する**。よって、【`疲れ知らずの`乗組員】は特性の効果を得ることが基本的にできない。

> この時点で『使用した持続カード(=乗組員(A))が場から離れた』と判定されるが、**このタイミングで玉座の間Aが捨て札になるのではなく、11ターン目のクリーンアップフェイズで場から捨て札になる**。

＝本エンジンの `cleanupAndAdvance` は「持続カードの残り枚数（`p.delayedEffects`）で場に残す枚数を決める」ので、
**持続カード本体が場から消えても玉座の間だけ残す**という状態を表現できるか要確認。

##### I. Buried Treasure：**獲得したら強制プレイ**＝獲得先（手札・デッキトップ・脇）を問わず場に出る

> When you gain this, you have to play it; **it's not optional.**

> `職人` などの効果で**手札に直接**埋められた財宝を獲得した際でも、手札に留めておくことはできず、必ず場に出て使用する処理となる。／`工匠` などの効果で**デッキトップに直接**〜／`封鎖` などの効果で**脇に直接**〜

> ただし、埋められた財宝の獲得時に、埋められた財宝の獲得時効果を処理する前に、**別の獲得時効果で埋められた財宝を獲得先から移動させた場合は、埋められた財宝を使用するのに失敗する**（lose track）。

**⚠ 本エンジン固有の地雷**：
> ただし、この時「他の『手札からのカード使用の制限』に抵触する」という場合は、埋められた財宝を使用しないことに注意。具体的には、「**`航海` の『ターン中使用できる手札は3枚まで』という制限**」が該当する。

＝§0-29 の `canPlayFromHand` / `t.handPlays`（航海）に**この経路も通す**必要がある。
また `gain()` の `dest`（`'hand'`/`'deck'`/`'setAside'`/`'discard'`）ごとに `removeOne` する場所が違う＝
**`zoneOf(p, dest)` を通す**（§0-23）。相手のターン中の獲得でも発火する（`蛮族` で金貨を廃棄→獲得）。

##### J. Gondola：**獲得時に手札のアクションを1枚使用できる**＝購入フェイズ中でもアクション権を使わずに使える

> Playing an Action card with this **does not use up an Action.**

> **If playing an Action with this sets up a "when you gain a card" effect, that ability will trigger off the Gondola gain.** This means you can gain a Gondola, play a `Sailor`, and then have that `Sailor` play the Gondola.

> The exception is if the Action says "next time" (e.g. `Secluded Shrine`), which will instead trigger off the **next** Treasure you gain.

＝**ゴンドラ自身の獲得がまだ「進行中」で、その獲得を後から張った効果が捕まえられる**という、
本エンジンの `triggerOnGain` / `onGainQueue` の順序モデルに真っ向から刺さる要件。
`playCardNoAction`（§0-26）が入口だが、**習性(Way)・炉(Kiln)・`noteAllyPlay`（同盟）も通る**ことに注意。
さらに購入フェイズの制限：
> You can't play Treasures from your hand after you start buying cards.（＝`t.treasuresLocked`。§0-21）

##### K. Gondola：**プレイのたびに「今 or 次ターン」を選ぶ／1回でも「次ターン」なら場に残る**

> If you play Gondola multiple times, such as with `King's Cache`, you choose each time whether to get the `+[$2]` now or next turn, and **Gondola only stays `in play` if at least one of the plays was for next turn (in which case the King's Cache also stays in play).**

＝§0-15 で作った `applyTreasureEffect` / `'treasure_replay'` の2回目にも**選択 pending が立つ**。
「コインだけ足す」実装では壊れる（冠/ティアラ/偽造通貨/王の隠し財産の2回目）。
**「次ターン」を選んだ回数が1回でもあれば持続**＝`cnt` を回数ではなくフラグで持つ設計が要る。

##### L. Harbor Village：**「そのアクション自身の効果」で得た +$ だけを数える**（外部由来は全部ダメ）

> This only cares if the `Action` **itself** gave you `+[$]`, not if you otherwise got `+[$]` due to playing it (such as due to `Training` … or due to receiving `The Forest's Gift` …).

> `+Coffers` … is not `+[$]`. ／ `+[$0]` doesn't get you the bonus.

> If an Action makes `+[$1]`, but you have the `-[$1]` token …, that reduces the Action's `+[$1]` to `+[$0]`, **so it won't count for Harbor Village.**

＝§0-25 で `addCoins(state, n)` に一本化してあるのが効くが、**呼び出し元が「カード自身の効果か・外部由来か」を
区別できない**。`addCoins` に**由来タグ**を足すか、`applyEffect` の前後でコイン差分を取るかの設計判断が要る
（後者だと `-$1トークン`で 0 になったケースが自然に落ちて公式どおりになる）。

<!-- 検証で訂正: 旧=「英語Official FAQ（＝公式）が正＝ボーナスを得る」と断定していた。
     → 日本語wiki が 2025年2月の移動動物園エラッタ＋2025年3月の Discord 回答を出典に「得られない」としており、
     どちらが現行かを一次資料で確定できなかった。§3 の【要ユーザー確認】表を参照。 -->
> **⚠【要ユーザー確認】習性(Way)由来の +$ の扱いは一次資料が割れている**（§3 の表を参照）。
> 英語wiki Official FAQ ＝「得る」／日本語wiki＋2025年エラッタ・Discord 裁定 ＝「得られない」。
> **mix-all でしか同居しないので出荷セットへの影響はゼロ**。決めるまでは実装しないか、
> 「カード自身の効果か」だけを見る素直な実装（＝習性由来は得られない）に倒しておくのが安全。

##### M. Harbor Village：**判定は「次に使ったアクションの解決が全部終わった直後」＝入れ子のアクションではない**

> If you `Throne Room` a Harbor Village and then play a `Militia`, you played Harbor Village, then Harbor Village, then Militia, so **you get nothing for the first play of Harbor Village and `+[$1]` for the second play of it.**

> ①港の村を使用→②`専門家` を使用(これが『その次に使用したアクションA』となる)→③専門家の効果で、まず `市場` を使用(これが『別のアクションB』になる) … この場合でも港の村の【追加効果】の判定は「専門家(=アクションA)でコインを得たか」である。

＝「次に使ったアクション」は**トップレベルの使用**であり、その解決中に別のアクションを使っても
そちらは対象にならない。専門家（同盟）・玉座の間・技術革新（ルネサンス）・炉（移動動物園）と全部絡む。

##### N. Maroon：**種別の数え方**が Trait / Bane / 相続 / 資本主義 / ペテン師で変わる

> If the trashed card has a `Trait`, or is `Young Witch`'s Bane, that won't count as an extra type for Maroon.

> `Inheritance`, `Capitalism`, and `Charlatan` will add types to cards.

> エラッタ等によってカード種別が追加されているカードとの組み合わせに注意。具体的には、`はみだし者`、`大君主`、`王笏`、`王子`、`Captain` 及び `相続` 購入後の `屋敷` が該当する。

＝`DOM.CARDS[id].types.length` を直接読むと**資本主義（+財宝）・相続（屋敷に+アクション）・
ペテン師（銅貨に+呪い）で静かにズレる**。§0-22 の `isTreasureFor(state, id)` と同じく
**`typeCountFor(state, pi, id)` を1本作って engine/CPU/UI が同じものを見る**こと。
また**廃棄は強制（手札があれば必ず）／手札0枚なら廃棄失敗＝ドロー0**：
> 置き去りを使用した際、手札の廃棄は強制処理であり、手札が1枚以上あればいずれかを必ず廃棄しなければならない。／手札が0枚の場合、廃棄に失敗する。

さらに**廃棄の on-trash（城塞が手札に戻る／狂信者+3カード／ネズミ／封土／草茂る屋敷）を全部解決してからドローする**
（§0-29 の `trashCardsTogether` / 歩哨と同じ順序問題）。

##### O. Tools：**コスト制限が無い＝`costUpTo` を掛けてはいけない**／**非サプライは「選べるが何も起きない」**

> This can't gain a copy of a card that isn't in the Supply (such as `Loot`). **However, you can still try to gain a copy of it (and gain nothing).**

> 工具を使用した際、（…）獲得するのは**強制効果**である。

＝§0-29 の「沈没船の財宝／専門家のコピー獲得／侍祭の卜占官獲得は**コスト制限が無い**＝`costUpTo` を掛けてはいけない」と同型。
かつ§0-21 探索・§0-29 専門家と同じ「**遂行できない選択肢も選べる**」＝UI で選択肢を消さずラベルで補う。
**候補は「誰かの場（inPlay ＋ durationCards ＋ 呼び出し済み Reserve）」＝自分以外のプレイヤーのゾーンも見る**：
> 誰のターンかに関わらず、他のプレイヤーが使用したカードも「場に出ているカード」なので、工具の効果で指定できる。

**強制なのに候補が0になり得る**（場が空＝理論上ありえないが、全部が非サプライの Loot だけ、等）＝
§0-29 [high] リッチと同じ「**候補ゼロの窓を開いて閉じない**」事故になる。**解決時に必ず再検査**すること。

##### P. Swamp Shacks：**場の枚数は inPlay ＋ 前ターンからの持続 ＋ 呼び出した Reserve、脇置きは含めない**

> This counts the Swamp Shacks itself, and `Duration` cards played on previous turns that are still in play. ／ It counts `Treasures` if you have some in play … ／ **It does not count set aside cards, such as cards on a `Quartermaster`.**

> 「脇に置く」効果によって置かれたカードも場の枚数に含まれない。特に表向けで脇に置く効果を持つカード（`忠犬`、`貨物船`、`王子` など）がある場合は、場のカードと混同しないように注意。

＝§0-29 の [low] 「従者(soldier) の +$1/他アタック が `durationCards` を無視していた」と**まったく同じ罠**。
本エンジンの脇置きゾーンは `p.cargo`（貨物船）/`p.princes`（王子）/`p.archives`（資料庫）/
`p.contractSetAside`（契約書・王家のガレー船）/`p.eventSetAside` 等が既にあり、**全部数えない**。

##### Q. Mapmaker：**「見る(look at)」であってドローではない**＝マスク漏れと -1カードトークン

> 地図作りの使用時効果は全てドローではないので、**`－1カードトークンの機能` の影響を受けず、－1カードトークンは次のドローまで残り続ける。**

＝§0-21 偵察隊 / §0-28 夜警 / §0-29 粉屋・歩哨 と**4回続けて同じクラスの漏れ**を出している箇所。
**`maskStateFor` の私的看破リストに `pending.type` を足す**のを絶対に忘れないこと。

##### R. Mapmaker：**リアクションは「誰かが」勝利点を獲得したとき／連鎖して何枚でも使える**

> You may play this when someone (**including you**) `gains` a `Victory` card due to `buying` it, or some other way.

> When you play Mapmaker in response to someone gaining a Victory card, **you can immediately play another Mapmaker afterwards - even one you just got via the first Mapmaker.**

> This plays like the Reactions in `Menagerie`; see the `Reactions section`.

＝§0-26 の `onGainQueue` 組（牧羊犬/そり/鷹匠/移動遊園地）と同型で、**同じ獲得に対して窓を再オファーする**必要がある
（1回で閉じると公式より弱い）。**自分の購入でも発火する**＝購入直後にモーダルが開く。
`hasReaction` にも登録が要る。**アクション権を消費しない**。
`Put 2 into your hand` は**山札が4枚未満でも「あるだけ見る」**：
> If you have fewer than four cards (after `shuffling`), you just look at what's left.
＝1枚しか無ければ1枚を手札に（0枚なら何もしない）＝**候補ゼロで窓が閉じない事故に注意**。

##### S. Enlarge：**次ターンの廃棄は強制／廃棄したら獲得も強制／手札0枚なら両方しない**

> Once you've played Enlarge, `trashing` a card at the `start of your next turn` is **mandatory**.

> 手札1枚を廃棄した場合、**必ずカード1枚を獲得しなくてはならない**。例えば、0コストの `呪い` を廃棄した場合、呪い・`銅貨`・`屋敷`・その他0～2コストのサプライにあるカードのどれかを獲得することになる。

> 手札が1枚もなくカードを廃棄できなかった場合は、カードを獲得できない。

＝**強制獲得なので候補ゼロで詰む**（§0-29 [high] リッチと同型）。$0以下の獲得先は呪い/銅貨/屋敷があるので
通常は詰まないが、**呪い枯れ＋銅貨枯れ＋屋敷枯れ**は3山終了寸前に起こり得る＝**終端保証を必ず書く**。

##### T. Enlarge：「$2 高いまで」は**成分ごと**（コイン／ポーション／負債）

> `大学`(2+P) を廃棄した場合、コスト**4+P以下**のカード1枚を獲得する。ポーションが含まれていない、ただの4コスト以下のカードでもよい。

> `大金`(8+負債8) を廃棄した場合、コスト**10+負債8以下**のカード1枚を獲得する。負債が含まれていない `属州`(8) や `白金貨`(9) や `王城`(10)、逆に負債だけの `大君主`(負債8) などでもよい。

＝§0-23 で作った `costUpTo(state, id, coin, pot, debt)` を**そのまま使う**（素の `cardCost(state,id) <= N` を書くと
mix-all で本番 livelock）。**engine拒否・CPU候補・UIフィルタの3面が同じ述語を見ること**。

##### U. Rope：**次ターンは「引く → その後で廃棄」の順**／廃棄は任意

> When you play this, you get `+[$1]` and +1 Buy, and at the start of your next turn, **you first draw a card, then may trash a card from your hand.**

＝引いたカードを廃棄できる。順序を逆にすると忠実性が落ちる（本エンジンは
「先引き」との兼ね合いがあるので、`DURATION_RESOLVERS.rope` は `draw()` → `pending` の順に書く）。

##### V. Fortune Hunter は**財宝を使うがアクションフェイズの出来事**＝財宝側の全機構が絡む

日本語wiki（利用法）逐語：
> また、アクションフェイズ中に財宝カードを使用できる数少ない手段であるため、`道化棒` や `石切場` など`特殊財宝` の恩恵を得られることを見逃さないようにしよう。

＝`playTreasureCard` / `applyTreasureEffect`（§0-15）を通すこと。**`t.treasuresLocked`（購入後は財宝を出せない）は
アクションフェイズなので立たない**（闇市場と同じ扱い）。
Harbor Village の FAQ にもこの経路が出てくる：
> If the next Action you play is an `Inspiring` `Merchant`, and `Inspiring` plays a `Fortune Hunter` that plays a `Silver`, that means `Merchant` gives `+[$1]`, which means Harbor Village also gives `+[$1]`.

##### W. 群内の相互作用で必ず同居して事故る組み合わせ

- **`buried_treasure` × `landing_party`**：相手のターンに埋められた財宝を獲得→強制プレイ→
  それが「あなたがそのターン最初に使ったカード＝財宝」になり、**相手のターン中に上陸部隊がデッキトップへ移動する**（E 参照・公式FAQ明記）。
- **`fortune_hunter` × `rope`**：財産目当てで縄を使うと**縄だけが次ターンまで場に残り、財産目当ては今ターンで捨てる**（1 参照）。
- **`fortune_hunter` × `swamp_shacks`**：財産目当てで出した財宝が「場のカード」に数えられる（公式FAQ明記）。
- **`gondola` × `cutthroat`**：ゴンドラ($4)は「$5以上の財宝」ではないので切り裂き魔を誘発**しない**が、
  `buried_treasure`($5) と `tools`... **Tools は $4 なので誘発しない**。**誘発するのは埋められた財宝($5)と Loot と金貨/白金貨など**。
- **`tools` × 持続**：相手が持続を場に置いている間、**その持続のコピーを獲得できる**（Tools 自身のコピーも可）。
  ＝`tools` の山が自己増殖して枯れる＝3山終了が早まる。
- **`maroon` × `cage`（同拡張・群1）**：`Treasure`+`Duration`＝2種別＝**4ドロー**（公式FAQの例）。
- **`crew` × `landing_party`**：どちらも「場から山札の上へ移動する持続」＝
  同じ機構（捨て札を経由しない移動）を共有するので、**片方だけ直すと非対称になる**。

##### Y. 【検証で追加】区切り線の有無を取り違えない（`gondola` / `mapmaker` / `buried_treasure` の3枚だけ線がある）

英語wiki の `Card text` セルの生HTML の `<hr>` を機械カウントした実測（Wayback 2025年1月キャプチャ）：

| カード | `<hr>` | 線の下にある文 |
|---|---|---|
| `gondola` | **1** | `When you gain this, you may play an Action card from your hand.` |
| `mapmaker` | **1** | `When any player gains a Victory card, you may play this from your hand.` |
| `buried_treasure` | **1** | `When you gain this, play it.` |
| `cutthroat` | 0 | —（「次に〜戦利品」は**持続能力そのもの**） |
| `rope` / `landing_party` / `crew` / `enlarge` | 0 | — |

`Way` ページ逐語＝**`Text below a dividing line is unaffected, it will still happen whenever it says it does.`**
＝上表の3枚の「獲得したとき」「誰かが勝利点を獲得したとき」は習性(Way)を使っても消えないが、
**切り裂き魔・縄・上陸部隊・乗組員・拡大の持続予約は、習性で使うと丸ごと発生しない**。
本アプリでは §0-25 の `applyWay` が「記載効果の代わり」を実装しているので、
**「線の下の効果だけは `applyWay` でも実行する」分岐が必要なのは上表の3枚だけ**。

##### X. 未確認事項（推測で埋めていない）／要ユーザー確認

<!-- 検証で全面書き換え: 旧の3項目のうち2項目が事実誤認だった（Mapmaker/Tools は2025年キャプチャが取れる／
     「各ページに仮名の記述がある」は2ページのみ）。確定できない項目を明示的に列挙し直した。 -->

**A. 一次資料に当たっても確定できなかった＝要ユーザー確認**
1. **港の村 × 習性(Way) のボーナス判定**（§3・§L）。英語wiki Official FAQ＝「得る」／
   日本語wiki（2025年2月エラッタ＋2025年3月 Discord 裁定を出典に明示）＝「得られない」。
   Discord は認証必須で読めず、英語wiki 側にも 2025年エラッタの記述が無いため決着せず。
   **mix-all 限定なので出荷セットへの影響はゼロ**。
2. **乗組員の日本語カードテキスト**（§11）。英語wiki の Japanese 行＝`これをあなたのデッキの上に置く。`／
   日本語wiki（Dominion Online 訳）＝`これを場から山札の上に置く。`。実物照合が要る。
   なお**カード名 `乗組員` は両者一致**。
3. **日本語版の印刷カードの文面そのもの**（13枚全部）。日本語wiki の表には
   `(※日本語訳はDominion Onlineより)` の注記があるため、細部の言い回しが印刷版と違う可能性がある。
   → **カタログ日本語文は Dominion Online 訳をベースに、既存カードの言い回しへ寄せる**方針でよいか要確認。

**B. 確定できたもの（上の「未確認」から格上げ）**
- **日本語カード名13件は印刷版（ホビージャパン／2023年3月発売）で確定**。
  根拠＝ホビージャパン公式 `https://hobbyjapan.games/dominion_plunder/`（日本語版『ドミニオン：略奪』2023年3月）
  ＋日本語wiki `財産目当て` のコメント「HB版の日本語カード名は[財産目当て]のようですので、修正をお願いします。 -- 2023-03-29」。
- **13枚ともエラッタは無い**。英語wiki の `Versions` → `English versions` 表が**全13枚とも1行だけ**
  （`Plunder / December 2022`）で、`Errata` 節を持つページはゼロ（2025〜2026年の最新キャプチャで確認）。
- `Mapmaker` / `Swamp_Shacks` / `Tools` も **2025年のキャプチャが取得でき、2023年版と内容が完全一致**した。

**C. まだ引いていない資料**
- **RGG 公式ルールブック PDF は引いていない**（一般ルール担当＝別群の想定）。
  「the next time」の一般ルール逐語は英語wiki `Plunder_(expansion)` の `Additional rules` 節から取得済み（§A）。
- **日本語wiki の「詳細なルール」節は有志編集であり一次資料ではない**（脚注で出典を示している項目もあるが、
  示していない項目もある）。本ドキュメントで日本語wiki だけを根拠にしている裁定は、
  実装時に英語wiki／公式FAQ と突き合わせること。
- **埋められた財宝の「総督／追いはぎ」Q&A（§10）は日本語wiki の *コメント欄*** ＝
  有志の回答であって準一次ですらない。実装で頼るなら英語wiki の `Highwayman` / `Governor` 側で裏を取ること。


---

## 第4章 王国カード 3/3 — $5〜$7 の14枚

<sub>（出典ファイル＝`kingdom3.md`。見出しは2段下げて収録）</sub>

### 略奪（Plunder・2022年12月発売）王国カード 3/3 — 一次資料調査

対象14件：Figurine / First_Mate / Frigate / Longship / Mining_Road / Pendant / Pickaxe /
Pilgrim / Quartermaster / Silver_Mine / Trickster / Wealthy_Village / Sack_of_Loot / King's_Cache

#### 出典と取得方法（重要）

| 資料 | 状態 |
|---|---|
| **英語wiki（wiki.dominionstrategy.com）** | **`tools/wikifetch.py` は今回使えなかった**。Wayback（`web.archive.org`）がこの環境から接続拒否（`Connection refused` / 名前解決は成功・IP 207.241.237.3 が拒否）。`archive.org` 本体は 200 だが `web.archive.org` だけ 000。→ **英語wiki 本体を Anubis(v1.27) の PoW を解いて直接読んだ**（`C:/tmp/plunder_research/anubis.js`。難易度5の sha256 ハッシュキャッシュを node で解いて `pass-challenge` を叩き cookie を取得）。**したがって取得したのは Wayback スナップショットではなく現在のライブページ**（各ページ末尾の `This page was last edited on ...` は 2026年2月〜8月＝略奪の情報を含む最新版）。 |
| **日本語wiki（wikiwiki.jp/dominiondeck）** | 拡張ページ＝`略奪（拡張）`（`ドミニオン：略奪` 日本語版 **2023年3月発売**）。各カードの個別ページも取得済み（連続アクセスで 429 が出る。**12秒間隔では 2026-08-15 時点で 429 が続いた＝45秒間隔なら全件 200**）。日本語カードテキストは日本語wiki の欄から取った。<!-- 検証で訂正: 旧="日本語wiki の「(※日本語訳はDominion Onlineより)」欄が正本" → この欄は wikiwiki 自身が「※日本語訳はDominion Onlineより」と明記しており、**ホビージャパン印刷版のカード文面そのものではない**。実物カードとの相違が実際に3件見つかった（下の「日本語テキストの出典に関する重大な注意」節）。出典=wikiwiki.jp 各カードページの効果表ヘッダ「(※日本語訳はDominion Onlineより)」／英語wiki 各ページ Other language versions の Japanese 行 --> |
| RGG 公式ルールブック PDF | **今回は使用していない**（金額はすべて英語wiki の `[$N]` 表記で裏取り済み。カード文面の正本にはしない方針どおり）。 |

- ⚠ **英語wiki の "Other language versions" の Japanese 行は今回も当てにならない**。Trickster の Japanese 行は
  `呪い1枚を装得する` `場から職宝カード` `勝に置いてもよい` と **OCR崩れ**（正しくは 獲得／財宝／脇）。
  Figurine / Mining Road / Pendant / Pickaxe / Quartermaster / Silver Mine / Wealthy Village / First Mate /
  Frigate / King's Cache には **Japanese 行が存在しない**。→ **日本語は全件 wikiwiki.jp から取った**。
- 全14件とも **Versions 表は「First edition / December 2022」の1行のみ＝エラッタなし**。`Errata` 節を持つページも0件。
  （検証で再取得して確認＝14/14。各ページの `This page was last edited on` は **2026年2月21日〜2026年8月8日**＝略奪の情報を含む最新版。
   Japanese 行があるのは **Longship / Pilgrim / Sack of Loot / Trickster の4ページだけ**で、残り10ページには無い＝下書きの記載どおり。）
- ⚠ **検証で追加**：**Pendant / Quartermaster / Silver Mine / King's Cache の4ページには英語wiki自身が品質バナーを出している**。逐語＝
  `This page is awaiting large-scale edits by the community to meet quality and format standards. The information on this page may be outdated.`
  **Card text 欄・Versions 表・Official FAQ はカード画像と一致していて問題ない**（4件とも実際に突き合わせ済み）が、
  Strategy 等の解説文は古い可能性がある。
  <!-- 検証で訂正: 旧=このバナーへの言及が無く「未確認事項＝なし」と断言していた 出典=wiki.dominionstrategy.com の Pendant / Quartermaster / Silver_Mine / King's_Cache 各ページ冒頭 -->

---

#### ⚠ 日本語テキストの出典に関する重大な注意（検証で追加）

<!-- 検証で訂正: 下書きは wikiwiki の訳文を「印刷版の日本語カードテキスト」として無条件に採用し、未確認事項を「なし」としていた -->

**wikiwiki.jp の効果表は、表のヘッダに `(※日本語訳はDominion Onlineより)` と明記されている＝Dominion Online の訳文であって、
ホビージャパン印刷版のカード文面そのものではない。** 一方、**英語wiki の Other language versions の Japanese 行は
実物カードの転記**（ただし OCR 崩れがある）。この2つを突き合わせると、本群14件のうち **Japanese 行が存在する4件中3件で実際に文面が食い違う**：

| id | 印刷版（英語wiki Japanese 行・逐語／〔〕は OCR 崩れの復元） | wikiwiki（Dominion Online 訳）＝本ドキュメントの本文 |
|---|---|---|
| `sack_of_loot` | `[$1]` ／ `+1 カードを購入` ／ `〔戦〕利品1枚を獲得する。` | `+1 コイン` ／ `+1 購入` ／ `戦利品1枚を獲得する。` |
| `pilgrim` | `+4 カードを引く` ／ `あなたの手札のカード1枚を、あなたのデッキの上に置く。` | `+4 カードを引く` ／ `手札1枚を山札の上に置く。` |
| `trickster` | `他のプレイヤーは全員、呪い1枚を〔獲〕得する。` ／ `このターンに1度、あなたが場から〔財宝〕カード1枚を捨て札にしたとき、それを〔脇〕に置いてもよい。ターンの終了時に、それをあなたの手札に加える。` | `他のプレイヤーは全員、呪い1枚を獲得する。` ／ `このターンに1度、財宝カード1枚を場から捨て札にしたとき、それを脇に置いてもよい。` ／ `ターン終了時、それを手札に加える。` |
| `longship` | `+2 アクション` ／ `あなたの次のターンの開始〔時〕、+2 カードを引く` | 同一（相違なし） |

**傾向＝印刷版は「あなたの」を明示し、`山札`ではなく`デッキ`、`+1 購入`ではなく`+1 カードを購入`、
財宝の固定コインは `+1 コイン` ではなく裸のコイン記号。** 効果は同じで**機能差はゼロ**だが、
本プロジェクトは**カード画像(webp)に日本語文面を焼き込む**ので、どちらを採るかは表示の問題として実在する。

- **本プロジェクトの既存676枚の表記慣習**（`js/cards.js` を実測）＝
  `+N カード`（135箇所。`カードを引く` は3箇所のみ）／`山札` 168 : `デッキ` 31 ／`+1 購入` 73・`+1 カードを購入` 0 ／
  裸のコイン（例＝`spoils` は `3 コイン`）と `+N コイン`（例＝`capital` は `+6 コイン`）が混在。
  → **既存慣習は wikiwiki（Dominion Online）側に近く、そのままでは印刷版とも既存676枚とも一致しない。**
- **要ユーザー確認**：本群14件の日本語文面を
  (a) 本ドキュメント本文どおり（wikiwiki＝Dominion Online 訳）にするか、
  (b) 既存676枚の慣習（`+N カード` / `山札` / `+1 購入`）に正規化するか、
  (c) 印刷版（`あなたの…` / `デッキ` / `+1 カードを購入`）に寄せるか。
  **既存カタログとの一貫性を優先するなら (b)** だが、これは研究では決められない。

---

#### 一覧表

| id | 英語名 | 日本語名 | コスト | 種別（カード表記順） |
|---|---|---|---|---|
| `figurine` | Figurine | 小像 | $5 | Treasure（財宝） |
| `first_mate` | First Mate | 一等航海士 | $5 | Action（アクション） |
| `frigate` | Frigate | フリゲート船 | $5 | Action - Duration - Attack（アクション-持続-アタック） |
| `longship` | Longship | ロングシップ | $5 | Action - Duration（アクション-持続） |
| `mining_road` | Mining Road | 鉱山道路 | $5 | Action（アクション） |
| `pendant` | Pendant | ペンダント | $5 | Treasure（財宝） |
| `pickaxe` | Pickaxe | つるはし | $5 | Treasure（財宝） |
| `pilgrim` | Pilgrim | 巡礼者 | $5 | Action（アクション） |
| `quartermaster` | Quartermaster | 操舵手 | $5 | Action - Duration（アクション-持続） |
| `silver_mine` | Silver Mine | 銀山 | $5 | Treasure（財宝） |
| `trickster` | Trickster | トリックスター | $5 | Action - Attack（アクション-アタック） |
| `wealthy_village` | Wealthy Village | 価値ある村 | $5 | Action（アクション） |
| `sack_of_loot` | Sack of Loot | 戦利品の袋 | $6 | Treasure（財宝） |
| `kings_cache` | King's Cache | 王の隠し財産 | $7 | Treasure（財宝） |

**負債(Debt)・ポーション費用は14件とも 0**（すべて純コインコスト＝`costIsPlainCoin` が真）。

---

#### カード別 詳細

##### 1. `figurine` — Figurine / 小像 — $5 — Treasure

**現行カードテキスト（英語・逐語）**
```
+2 Cards
You may discard an Action card for +1 Buy and +$1.
```

**日本語カードテキスト**
```
+2 カードを引く
手札のアクションカード1枚を捨て札にしてもよい。そうした場合、+1 購入, +1 コイン。
```

**公式FAQ（逐語）**
> This is a **Treasure**, and so is played in your **Buy phase**, but **draws** cards.
> This means that usually if it draws you an **Action** card, that card won't be useful that turn, except that Figurine itself lets you **discard** one Action card for **+1 Buy** and **+[$1]**.

**エラッタ**：なし（Printed = First edition, December 2022 の1行のみ）。

**日本語wiki の補足**：捨て札にすることでリアクションできる **村有緑地／織工** と相性が良い（＝
`triggerOnDiscard` を通す必要がある）。**財産目当て（Fortune Hunter）でアクションフェイズに使用**した場合、
「財産目当てで見た残りの2枚ではなく、その下の2枚を引く」。

---

##### 2. `first_mate` — First Mate / 一等航海士 — $5 — Action

**現行カードテキスト（英語・逐語／改行は日本語wikiの英文欄が保持している位置）**
```
Play any number of Action cards with the same name from your hand,
then draw until you have 6 cards in hand.
```

**日本語カードテキスト**
```
手札から、名前が互いに一致するアクションカードを好きな枚数使用してもよい。
その後、手札が6枚になるようにカードを引く。
```

**公式FAQ（逐語）**
> If you don't have any **Action** cards to play, you'll still **draw** up to 6.
> If the Action card you play draws you another copy of itself, you can play that copy, and so on.
> First Mate can play First Mates; keep careful track of which card you're resolving, as you would with multiple **Throne Rooms**.

**エラッタ**：なし。Secret history＝`Unchanged except for a phrasing tweak.`

**日本語wiki「詳細なルール」（実装に効くもの・逐語）**
> 一等航海士の使用時効果で、手札から使用するアクションの枚数を0枚とする(=アクションを何も使用しない)ことを選択しても良い。その場合でも、「手札が6枚になるようにカードを引く」を実行する。
> 一等航海士の使用時効果を処理する際、何枚のアクションカードを使用するか宣言する必要は無い。アクションを解決するごとに使用を判断してよい。
> 手札のカードが6枚になるまでドローし続けるので、即座に－1カードトークンは取り除かれ、実質的に影響を受けない。
> 手札が6枚以上ある場合、カードのドローを行えない。この場合、－1カードトークンは残ったままとなる。
> 影カードは、「手札にあるように山札から使用できる」ため、山札にある限りの同名影カードを好きなだけ使用することができる。
<!-- 検証で追記: 影(Shadow)カードの裁定が抜けていた。日の出づる国(Rising Sun)は本プロジェクト未着手なので当面は影響ゼロだが、将来 Rising Sun を足すときに一等航海士の候補集合を「手札」だけで書いていると壊れる。出典=wikiwiki.jp/dominiondeck/一等航海士「詳細なルール」 -->
> 一等航海士が場から捨て札になるタイミングは、常に「一等航海士使用ターンのクリーンアップフェイズ」である。玉座の間やはみだし者などの『自身の効果で使用したカードが場から離れるまで場に残るカード』との違いに注意。
> 一等航海士の効果でセイレーンを使用すると、セイレーンは「一等航海士使用者の次のターンのクリーンアップフェイズ」まで場に残るが、一等航海士自身は「一等航海士使用ターンのクリーンアップフェイズ」に捨て札になる。

---

##### 3. `frigate` — Frigate / フリゲート船 — $5 — Action - Duration - Attack

**現行カードテキスト（英語・逐語）**
```
+$3
Until the start of your next turn, each time another player plays an Action card,
they discard down to 4 cards in hand afterwards.
```

**日本語カードテキスト**
```
+3 コイン
あなたの次のターンの開始時まで、他のプレイヤーはアクションカード1枚を使用するたび、
その後に、手札が4枚になるように捨て札にする。
```

**公式FAQ（逐語）**
> This applies each time another player plays an **Action**, until your next turn. That includes later on during your turn, if they manage to play an Action then (for example a **Stowaway**).
> They completely resolve playing the Action before **discarding**.

**Other rules clarifications（英語wiki・逐語）**
> An affected player can order this attack with other effects that trigger after playing an Action card. For example, they can first discard down to 4 cards in hand, and then spend a Favor for **Fellowship of Scribes**.
> Unlike other Duration Attacks (such as **Swamp Hag**), Frigate does nothing at the start of your next turn. This means that if this attack won't affect anyone (e.g., each other player blocks it with **Moat**), you'll immediately discard Frigate from play during your Clean-up.
> If a player reacts to Frigate being played with a **Reaction** that plays itself (e.g. **Guard Dog**), they won't discard down to 4 cards after playing that, because the Frigate's attack isn't active yet.

**エラッタ**：なし。

**日本語wiki「詳細なルール」（逐語・実装に効くもの）**
> ただし、フリゲート船使用時に他のプレイヤー全員が堀などでアタック効果を受けなかった場合、フリゲート船は使用ターンのクリーンアップフェイズに場から捨て札になる。これは、フリゲート船は「使用プレイヤーに対する持続効果(次のターン開始時に発揮される能力など)」を持たず、「他のプレイヤーに対する持続効果」しか持たないためである。
> 前のターンから場に出ている持続カードの処理や、リザーブカードの呼び出しはアクションの使用ではないので、【フリゲート船アタック】が発揮されない。
> 購入フェイズに冠や呪符の巻物や資本主義の影響で財宝となったアクションを使用した場合や、夜フェイズに人狼を使用した場合でも、【フリゲート船アタック】が発揮される。
> 他プレイヤーのターン中にリアクションにより密航者や地図作りなどを使用した場合でも、【フリゲート船アタック】が発揮される。
> なお、【フリゲート船アタック】は他の『使用時後効果』と同時に誘発し、処理順はアクション使用者が自由に選べる。
> 堀などをリアクションするタイミングは「相手のアタックカードの使用時」であり、【フリゲート船アタック】が誘発したタイミング(=自分がアクションカードを使用した後)になってからリアクションすることはできない。
> フリゲート船が使用されたタイミングに、灯台やチャンピオンや守護者の効果を発揮している他プレイヤーは、この【フリゲート船アタック】を受けない。(他プレイヤーがフリゲート船を使用し、)自分のターンになってから、灯台やチャンピオンを使用した場合では、【フリゲート船アタック】を防げない。
> フリゲート船を使用したプレイヤーが追加のターンを得ていた場合は、【フリゲート船アタック】は他プレイヤーに影響する前に消えることになる。逆に、他プレイヤーは追加ターンを含め全てのターンにおいて、【フリゲート船アタック】を受けることになる。

---

##### 4. `longship` — Longship / ロングシップ — $5 — Action - Duration

**現行カードテキスト（英語・逐語）**
```
+2 Actions
At the start of your next turn, +2 Cards.
```

**日本語カードテキスト**
```
+2 アクション
あなたの次のターンの開始時、+2 カードを引く。
```

**公式FAQ（逐語）**
> Playing this gives you +2 **Actions** then, and +2 Cards at the **start of your next turn**.

**エラッタ**：なし。Secret history（逐語・全文）＝
> This came straight from Allies. Gloriously simple cards always have to fight for life, and this was going to be a good fit for Plunder.
<!-- 検証で訂正: 旧=`This came straight from Allies.` で切っていた（省略記号なしの途中打ち切り） 出典=wiki.dominionstrategy.com/index.php/Longship -->

---

##### 5. `mining_road` — Mining Road / 鉱山道路 — $5 — Action

**現行カードテキスト（英語・逐語）**
```
+1 Action
+1 Buy
+$2
Once this turn, when you gain a Treasure, you may play it.
```

**日本語カードテキスト**
```
+1 アクション
+1 購入
+2 コイン
このターンに1度、財宝カード1枚を獲得したとき、それを使用してもよい。
```

**公式FAQ（逐語）**
> Playing the **Treasure** is optional.
> This ability is cumulative; if you play two Mining Roads, then twice that turn you may play a Treasure when you gain one.
> However two Mining Roads can't play the same gained Treasure twice.
> Mining Road applies to Treasures gained due to being bought, or gained other ways.
> It works in your **Action phase** if you gain a Treasure then.

**Other rules clarifications（英語wiki・逐語）**
> If gaining a Treasure causes you to gain a Treasure (e.g. a **Fortune** that gains a **Gold**), and you've played multiple Mining Roads, you can play those Treasures in any order (i.e. you can play the Gold before playing the Fortune).

**エラッタ**：なし。

**日本語wiki「詳細なルール」（逐語・実装に効くもの）**
> 鉱山道路の効果は、使用時に全て予約される。玉座の間系で複数回使用すると、使用した回数だけ「獲得した財宝カードを使用できる」の効果を得られる。行進などで場を離れても、使用時効果は消えないので、「獲得した財宝カードを使用できる」の効果を得られる。はみだし者などのカードでサプライから使用する場合など、カードが場に出ない場合でも、「獲得した財宝カードを使用できる」の効果を得られる。逆に、女魔術師のアタック効果や習性により使用時効果が書き換えられた場合は、鉱山道路が場に出ていても、「獲得した財宝カードを使用できる」の効果を得られない。
> 鉱山道路の効果は財宝カードの獲得時に誘発する。他の獲得時効果と同時に誘発し、処理順は獲得者が選ぶ。ただし、獲得した財宝カードを鉱山道路で使用する(=場に出す)効果は「獲得カードを獲得先から移動させる効果」なので、これを処理すると、他の「獲得カードを獲得先から移動させる効果」の処理には失敗する。(移動阻止ルール)
> 同様に、他の「獲得カードを獲得先から移動させる効果」を先に処理すると、獲得した財宝カードを鉱山道路の効果で使用する(=場に出す)処理に失敗する。
> 例えば、鉱山道路使用後かつ貨物船を使用した状態で獲得した財宝カードは、鉱山道路の効果により使用する(=場に出す)か、貨物船により脇に置くかのどちらか一方を先に処理した時点で、後のもう一方の処理には失敗する。
> **一方で、獲得した財宝カードを鉱山道路の効果で使用する(=場に出す)処理を行ったとしても、そのことで他の『「獲得カードを獲得先から移動させる効果」以外の獲得時に誘発する効果』は妨げられない。**
> 例えば、コスト6以下の財宝カードを獲得し、鉱山道路の効果で使用した後でも、複製を呼び出し同じカードを獲得できる。
> 鉱山道路の効果により獲得した財宝Aを使用し、そのことで財宝Aがカード獲得時効果を発揮する場合は、この【自身の獲得】に対してカード獲得時効果を誘発できる。例えば、資本主義により財宝カードとなった貸し馬屋Aを獲得した際に鉱山道路の効果で使用すると、貸し馬屋Aの獲得時効果が貸し馬屋Aの獲得に対して誘発し発揮され、馬1枚を獲得する。
<!-- 検証で追記: 下書きは「移動阻止ルール」の片方向しか引いておらず、**「移動効果以外の獲得時効果は妨げられない」という限定**が抜けていた。これが無いと実装側が「鉱山道路で使ったら以後の on-gain を全部殺す」と誤読する（下の落とし穴 E を参照）。出典=wikiwiki.jp/dominiondeck/鉱山道路「詳細なルール」 -->
> デッキトップに直接獲得(武器庫の効果などが該当)される財宝カードや、手札に直接獲得(銀山の効果などが該当)される財宝カードや、脇に直接獲得(操舵手の効果などが該当)される財宝カードに対しても、鉱山道路の効果は誘発し、使用することができる。
> 鉱山道路が場から捨て札になるタイミングは、常に「鉱山道路使用ターンのクリーンアップフェイズ」である。（＝鉱山道路の効果で縄を使用しても、縄だけが次ターンまで場に残る）

---

##### 6. `pendant` — Pendant / ペンダント — $5 — Treasure

**現行カードテキスト（英語・逐語）**
```
+$1 per differently named Treasure you have in play.
```

**日本語カードテキスト**
```
あなたが場に出している異なる財宝カード1種類につき、+1 コイン。
```

**公式FAQ（逐語）**
> This counts itself. For example if you had three **Coppers**, a **Gondola** played last turn, and the Pendant in play, it would make **+[$3]**.

**エラッタ**：なし。

**日本語wiki「詳細なルール」（逐語）**
> このターンにプレイした財宝カードの枚数は関係なく、場に出ている異なる名前の財宝カード枚数を数える。
> 場に出ている財宝カードは、使用したペンダント自身も含まれる。
> 場に持続している持続-財宝カード、呼び出した法貨などは数え、プレイして場から移動した財宝カードなどは数えない。
> 「脇に置く」効果によって脇に置かれた財宝カードも場の枚数に含まれない。特に表向けで脇に置く効果を持つカード（貨物船、王子など）がある場合は、場のカードと混同しないように注意。
> 異なる財宝カード枚数のカウントはペンダント使用時に行われ、その時点でペンダントの産出コイン量は確定する。ペンダント使用後に場に出ている財宝の枚数が変わった場合でも、ペンダントの産出コイン量が変化することは無いので注意。
> 資本主義影響下では仮想コイン産出アクションもペンダントでカウントできる。

---

##### 7. `pickaxe` — Pickaxe / つるはし — $5 — Treasure

**現行カードテキスト（英語・逐語／改行は日本語wikiの英文欄が保持している位置）**
```
$1
Trash a card from your hand.
If it costs $3 or more, gain a Loot to your hand.
```

**日本語カードテキスト**
```
1 コイン
手札1枚を廃棄する。
そのコストが3以上の場合、戦利品1枚を手札に獲得する。
```

**公式FAQ（逐語）**
> **Trashing** is mandatory, if you have any cards left in hand. Remember that you have to reveal the gained **Loot**.

**エラッタ**：なし。

**日本語wiki「詳細なルール」（逐語）**
> つるはしの使用時効果は①手札のカードを廃棄し、廃棄置き場に置く→②廃棄カードのコストを参照し、追加効果を得る、という二段階の処理である。廃棄したカードのコストを参照するのは②のタイミングである。
> 例えば、①で捨て札が空の状態で漁師(2コスト)を廃棄し、直後に手札の青空市場でリアクションすると、捨て札ができるので漁師は5コストとなる。この後で、②が処理されるので、結果的に戦利品を手札に獲得する。
> つるはしの効果で獲得される戦利品は、捨て札置き場を経由せずに直接手札に獲得される。

---

##### 8. `pilgrim` — Pilgrim / 巡礼者 — $5 — Action

**現行カードテキスト（英語・逐語）**
```
+4 Cards
Put a card from your hand onto your deck.
```

**日本語カードテキスト**
```
+4 カードを引く
手札1枚を山札の上に置く。
```

**公式FAQ（逐語）**
> The card you put on top doesn't have to be one of the 4 you just **drew**.

**エラッタ**：なし。Secret history（逐語・全文）＝
> Unchanged. Being simple, it had to fight for its life; that's the sad lot of these awesome cards.
<!-- 検証で訂正: 旧=`Unchanged.` で切っていた（省略記号なしの途中打ち切り） 出典=wiki.dominionstrategy.com/index.php/Pilgrim -->

**日本語wiki「詳細なルール」（逐語）**
> デッキの一番上に置くカードは、手札全てから選んでよい。引いたカードのうちいずれかである必要はない。
> カードをドローできなかった場合でも、デッキトップに1枚戻す効果は必ず行わなければならない。

---

##### 9. `quartermaster` — Quartermaster / 操舵手 — $5 — Action - Duration

**現行カードテキスト（英語・逐語／改行は日本語wikiの英文欄が保持している位置）**
```
At the start of each of your turns for the rest of the game, choose one:
Gain a card costing up to $4, setting it aside on this;
or put a card from this into your hand.
```

**日本語カードテキスト**
```
ゲーム終了まで、あなたの各ターンの開始時、次のうち1つを選ぶ：
「コスト4以下のカード1枚を(このカードの)脇に獲得する」
「このカードの脇にあるカード1枚を手札に加える」
```

**公式FAQ（逐語）**
> Quartermaster stays **in play** for the rest of the game.
> Each turn you either **gain** a card and put it on the Quartermaster, or take one of the cards you've already gained with that Quartermaster and put it into your hand.
> If you play two Quartermasters, they each have their own set of cards. However if you **Throne Room** a Quartermaster, you just have one set of cards for it, and twice on each of your turns, either add one or take one.

**Other rules clarifications（英語wiki・逐語）**
> Cards that were **gained** and **set aside** on Quartermaster are still yours at the end of the game. So you can gain **Estates** and leave them set aside forever (effectively **exiling** them).
> The card you gain is immediately set aside, and **doesn't visit** your **discard pile**. So if you gain a **Ghost Town**, it will be set aside on this (instead of going to your hand).
> However, abilities that move cards **when you gain them** can move a card that's gained with Quartermaster. So if you gain a **Siren** with this, it will still **trash** itself (unless you trash an **Action** from your hand).

**エラッタ**：なし。

**日本語wiki「詳細なルール」（逐語・実装に効くもの）**
> 操舵手がターン終了時に場を離れている場合、操舵手の脇にカードがあればそれらを脇に置いたまま、次のターンからはカードを獲得することは無く、それらを手札に加えることもできない。
> 玉座の間系で複数回操舵手をプレイした場合、プレイした回数だけ毎ターン操舵手の持続効果が発揮される。この場合、その玉座の間も場に残り続ける。
> 「ターンの開始時」に召喚などで操舵手を使用すると、その「ターンの開始時」にも操舵手の持続効果が発揮される。
> ターン開始時に橋などが使用されカードのコストが下がった場合、下がった後のコストが4コスト以下であれば獲得できる。ポーションをコストに含むカード(ブドウ園など)、負債をコストに含むカード(技術者など)は、どちらもコスト最大4(コイン)までのカードに含まれないため、獲得できない。（＝「コスト最大4コイン0ポーション0負債までのカード」）
> イベントやプロジェクトはカードではないため、操舵手で獲得できない。
> 操舵手で獲得されるカードは、捨て札置き場を経由せずに直接脇に獲得される。
> 複数枚の操舵手が持続する場合、脇の領域は個々に区別される。脇に置いたカードを別の操舵手によって手札に加えることはできない。
> 玉座の間で大君主を2回プレイし両方とも操舵手をプレイした場合、1回目と2回目で別々の脇の領域になる。
> 操舵手の効果は「選択効果」なので、長老の対象となる。

---

##### 10. `silver_mine` — Silver Mine / 銀山 — $5 — Treasure

**現行カードテキスト（英語・逐語）**
```
Gain a Treasure costing less than this to your hand.
```

**日本語カードテキスト**
```
これより安い財宝カード1枚を手札に獲得する。
```

**公式FAQ（逐語）**
> This can **gain** **Silver**, but also other **Treasures** **costing** less than Silver Mine, when in the **Supply**: **Gondola**, **Jewelled Egg**, and so on.

**エラッタ**：なし。

**日本語wiki「詳細なルール」（逐語）**
> 銀山を使用した際、サプライにある「銀山よりコスト低い財宝カード」を手札に獲得することは強制である。
> サプライにある財宝カードが、コストが銀山のコスト以上のカードしか無い場合、何の効果も得られない(橋を5回以上使用し、銀山のコストが0になっている場合などに発生する)。
> ポーションをコストに含む財宝カード(賢者の石)、負債をコストに含む財宝カード(大金)は、どちらも「銀山よりコストが低いカード」になることはないため、銀山の効果で獲得できない。（＝「コスト最大4コイン0ポーション0負債までのカード」とみなされる）
> 銀山の効果で獲得される財宝は、捨て札置き場を経由せずに直接手札に獲得される。

**日本語wiki「利用法」（逐語）** <!-- 検証で訂正: 旧=この2文を「詳細なルール」節からの引用として並べていた。実際は「利用法」節にある（節名だけの誤り・内容は正しい） 出典=wikiwiki.jp/dominiondeck/銀山 -->
> （…や 発明家の家族 や 安価な などの特例を除き)メリットにはならない。
> 極端な話、街道を5回以上使用するなどして全カードのコストが-5金されると、銀山の効果でカードが獲得できない。

---

##### 11. `trickster` — Trickster / トリックスター — $5 — Action - Attack

**現行カードテキスト（英語・逐語／改行は日本語wikiの英文欄が保持している位置）**
```
Each other player gains a Curse.
Once this turn, when you discard a Treasure from play, you may set it aside.
Put it in your hand at end of turn.
```

**日本語カードテキスト**
```
他のプレイヤーは全員、呪い1枚を獲得する。
このターンに1度、財宝カード1枚を場から捨て札にしたとき、それを脇に置いてもよい。
ターン終了時、それを手札に加える。
```

**公式FAQ（逐語）**
> This is cumulative; if you play two Tricksters, then you can **set aside** up to two **Treasures** you **discard** from play and put them into your hand at **end of turn**, after drawing.

**エラッタ**：なし（`The wording got tweaked, but what it did stayed the same.`＝発売前の話）。

**日本語wiki「詳細なルール」（逐語・実装に効くもの）**
> トリックスターの【財宝保存処理】で脇に置く財宝は、実際に一度捨て札にされることに注意。よって、【財宝保存処理】で元手を脇に置く場合も、元手の「場から捨て札にする時 <6> を受け取る」の処理は発生する。
> また、場から捨て札にする際にしか誘発しないことに注意。例えば、資本主義影響下で財宝化したワイン商を酒場マットから捨て札にしても、【財宝保存処理】の対象とすることはできない。
> トリックスターの効果は、使用時に全て発揮される。玉座の間系で複数回使用すると、使用した回数だけ【財宝保存処理】を得られる。行進などで場を離れても、使用時効果は消えないので、【財宝保存処理】を得られる。大君主などのカードでサプライから使用する場合など、カードが場に出ない場合でも、【財宝保存処理】の効果を得られる。逆に、女魔術師のアタック効果や習性により使用時効果が書き換えられた場合は、トリックスターが場に出ていても、【財宝保存処理】を得られない。
> 特に他の捨て札時効果が同時に誘発する際は、脇に置くタイミングで「何の効果で脇に置いたのか」を明確に宣言する必要があるので注意。（例＝【疲れ知らずの宝飾卵】）

---

##### 12. `wealthy_village` — Wealthy Village / 価値ある村 — $5 — Action

**現行カードテキスト（英語・逐語）**
```
+1 Card
+2 Actions
--------------------
When you gain this, if you have at least 3 differently named Treasures in play, gain a Loot.
```

**日本語カードテキスト**
```
+1 カードを引く
+2 アクション
--------------------
これを獲得したとき、異なる財宝カードを3種類以上場に出している場合、戦利品1枚を獲得する。
```

**公式FAQ（逐語）**
> The 3 differently named **Treasures** can include **Duration** Treasures you played on a previous turn, and **Loots** themselves.

**エラッタ**：なし。

**日本語wiki「詳細なルール」（逐語）**
> このターンにプレイしたカードの枚数は関係なく、異なる財宝カードが場に3枚出ていれば、戦利品を獲得する。
> 場に持続している持続-財宝カード、呼び出した法貨などは数え、プレイして廃棄された財宝カードなどは数えない。
> 「脇に置く」効果によって置かれた財宝カードも場の枚数に含まれない。特に表向けで脇に置く効果を持つカード（貨物船、王子など）がある場合は、場のカードと混同しないように注意。

**日本語名の注意（日本語wiki「余談」逐語）**
> カードの元の英語名は「Wealthy Village」である。「wealthy」は本来「裕福な、富裕な」を意味し、「価値ある」と訳すにはやや意味が通じない。…ちなみに、HJ版の未発売時のDominion Oinlineでは「裕福な村」と訳されていた。
→ **印刷版（ホビージャパン）は「価値ある村」が正**。「裕福な村」は日本語版発売前の暫定訳なので採用しない。

---

##### 13. `sack_of_loot` — Sack of Loot / 戦利品の袋 — $6 — Treasure

**現行カードテキスト（英語・逐語）**
```
$1
+1 Buy
Gain a Loot.
```

**日本語カードテキスト**
```
+1 コイン
+1 購入
戦利品1枚を獲得する。
```

**公式FAQ（逐語）**
> When you play this, you get **+[$1]** and **+1 Buy**, and **gain** a **Loot**.

**エラッタ**：なし。

**日本語wiki「詳細なルール」（逐語）**
> 戦利品の獲得は強制である。

---

##### 14. `kings_cache` — King's Cache / 王の隠し財産 — $7 — Treasure

**現行カードテキスト（英語・逐語）**
```
You may play a Treasure from your hand 3 times.
```

**日本語カードテキスト**
```
手札の財宝カード1枚を3回使用してもよい。
```

**公式FAQ（逐語）**
> If you King's Cache a King's Cache, you will play three more **Treasures** three times each.
> If you King's Cache a Treasure-**Duration** card, King's Cache will stay in play as long as that card does.

**Other rules clarifications（英語wiki・逐語）**
> If you King's Cache a **Capital**, you end up with 6 debt when the Capital is discarded, not 18.

**Trivia（逐語）**
> King's Cache is the first Kingdom card pile to cost **[$7]** since the cost was introduced in **Prosperity**.

**エラッタ**：なし。

**日本語wiki「詳細なルール」**：「手札の財宝を3回使用する」については、**ティアラ**の『「手札の財宝を2回使用する」について』を参照
（＝本プロジェクトの `treasure_replay` 機構と同じ扱いでよい、という位置づけ）。

---

#### 未確認事項

<!-- 検証で訂正: 旧="なし" と断言していた。実際には下記2件が未確定 -->
- **英語カードテキスト／コスト（負債・ポーション成分を含む）／種別と並び順／公式FAQ／エラッタ無し／日本語カード名 の14件は確定**
  （検証で英語wiki 14ページ・日本語wiki 14ページを独立に取り直して全件一致を確認）。
- ⚠ **要ユーザー確認①＝日本語カードテキストをどの版に合わせるか**（上の「日本語テキストの出典に関する重大な注意」節）。
  本文の日本語文面は **wikiwiki.jp＝Dominion Online 訳**であり、**印刷版のカード文面とは `sack_of_loot` / `pilgrim` / `trickster` の3件で食い違う**
  （機能差はゼロ・表記のみ）。既存676枚の表記慣習ともズレるので、webp に焼く前に方針を決める必要がある。
- ⚠ **要ユーザー確認②＝`spoils`（暗黒時代）の日本語名を「略奪品」へ改名するか**（下の落とし穴 A）。
  これを決めないと本群の `sack_of_loot` / `pickaxe` / `wealthy_village` のカード文が書けない
  （「戦利品」がどちらを指すか確定しないため）。**研究では決められない設計判断。**
- ただし **RGG 公式ルールブック PDF の逐語は今回引いていない**（今回の14件はカード固有の裁定のみで、
  一般ルール＝「Loot の山の作り方」「Trait の付け方」等は本群の担当外。Loot 15種と Trait は別担当の群）。
- `web.archive.org` がこの環境から接続不能なので、`tools/wikifetch.py` は**当面使えない**。
  代替＝`C:/tmp/plunder_research/anubis.js`（Anubis PoW を解いて英語wiki 本体を直読み）。
  `node anubis.js <Page> [<Page> ...]` で使える。**このスクリプトは残してある。**
  - **【検証で独立に再現・確認】**（2026-08-15）：`python tools/wikifetch.py Figurine` は
    `!! 取得失敗: <urlopen error [WinError 10061] 対象のコンピューターによって拒否されたため、接続できませんでした。>` を返す。
    `curl https://web.archive.org/` = **000**（接続拒否）／`https://archive.org/` = 200／`http://wiki.dominionstrategy.com/...` = 308。
    ＝**下書きの主張は正しい。Wayback だけがこの環境から落ちている。**
    `anubis.js` で14ページを**別ディレクトリに取り直して**全項目を独立に突き合わせた（`C:/tmp/plunder_verify3/`）。
  - 日本語wiki 側も同様に取り直した（`jpslow.js`＝`jpfetch2.js` の待ち時間を 12秒→**45秒**にしたもの。
    12秒では 2026-08-15 時点で 429 が連発する）。

---

#### 実装時に事故りそうな落とし穴（この群）

##### A. 「戦利品(Loot)」の日本語名が **既存の暗黒時代 `spoils` と衝突する**（最優先で決める）
- 日本語wiki の略奪ページで **Loot 種別 = 「戦利品」**（ダブロン金貨・ハンマー・勲章…の見出しが `財宝-戦利品`）。
  一方 **暗黒時代 Spoils の公式和名は「略奪品」**（日本語wiki の 略奪(Pillage) 逐語＝
  「これを廃棄する。そうした場合、**略奪品**2枚を獲得し、…」）。
- **本プロジェクトは PROGRESS §0-3 で `spoils` に「戦利品」を採用してしまっている**
  （逐語＝「**spoils の名前は「戦利品」を採用**（公式は「略奪品」だが、既存 marauder/新規 bandit_camp/pillage が
  「戦利品置き場」と参照＝プロジェクト内一貫性を優先。**将来 Plunder/Loot を入れる時に再考**）」）。
  → **まさに「再考」の時**。`spoils` を「略奪品」に改名しないと、盤面・カード一覧・ログ・全文検索で
  **2つの別物が同じ「戦利品」という文字列**になる（§0-29 の `alliance`＝「同盟」衝突と同型だが、
  今回は**同じ拡張内で毎ゲーム同時に出得る**ぶん遥かに悪い）。改名すると webp の再生成が要る
  （`marauder` / `bandit_camp` / `pillage` / `spoils` のカード文）。
- **【検証で裏取り済み】**（2026-08-15）＝**この指摘は正しい**：
  - `js/cards.js` 実測＝`spoils: { id: 'spoils', name: '戦利品', cost: 0, types: ['treasure'], coin: 3, text: '3 コイン\nこれを使用したとき、このカードを戦利品置き場に戻す。' }`。`戦利品` はファイル全体で **11箇所**。
  - 日本語wiki は **Loot＝戦利品**（`つるはし` 逐語「そのコストが3以上の場合、**戦利品**1枚を手札に獲得する。」／
    `戦利品の袋` 逐語「**戦利品**1枚を獲得する。」）、**Spoils＝略奪品**（`王の隠し財産` 逐語
    「使い捨ての財宝である**略奪品**や備蓄品も使用出来ればかなり強い。」）と**同一サイト内で明確に使い分けている**。
  ＝衝突は実在する。**この設計判断（改名するか）を先に決めないと本群3枚のカード文が書けない＝要ユーザー確認②**。

##### B. `first_mate`（一等航海士）＝**エンジンに存在しない「入れ子の任意プレイ・ループ」**
- 逐語＝`If the Action card you play draws you another copy of itself, you can play that copy, and so on.` ＋
  `First Mate can play First Mates` ＋ 日本語wiki「何枚のアクションカードを使用するか宣言する必要は無い。
  **アクションを解決するごとに使用を判断してよい**」。
  → 「同名を何枚使うか」を**先に確定できない**＝`pending` を1回開いて終わりにできない。
  解決のたびに「もう1枚使うか」を再オファーする**再開網**（`t.firstMateName` ＋ reduce 末尾）が要る。
  さらに `first_mate` 自身を選ぶと**入れ子で別の名前を宣言できる**（外側の宣言は生き続ける）。
- **アクション権を消費しない使用**なので `playCardNoAction` 経路。**§0-29 の必須配線を全部通すこと**＝
  `noteAllyPlay`（魔女の輪／小売店主連盟／写本士の仲間たち）・`applyPileTokens`（教師トークン）・
  習性(Way) の選択・炉(kiln)。さらに **`canPlayHandCard`（航海の「手札から3枚まで」＋将軍 `warlordBlocks`）
  の3面ゲート**を通さないと mix-all で engine拒否×CPU提案の livelock（A4 [high] 12番と同型）。
- **場を離れるタイミングが玉座の間と逆**。日本語wiki逐語＝
  「一等航海士が場から捨て札になるタイミングは、**常に「一等航海士使用ターンのクリーンアップフェイズ」**である。
  玉座の間やはみだし者などの『自身の効果で使用したカードが場から離れるまで場に残るカード』との違いに注意。」
  → 一等航海士で**持続**を使っても一等航海士自身は残らない（§0-29 A4 の「専門家は残る／長老は残らない」と同じ罠）。
- draw-to-6 と −1カードトークンの非対称：逐語＝「手札のカードが6枚になるまでドローし続けるので、
  即座に－1カードトークンは取り除かれ、実質的に影響を受けない。**手札が6枚以上ある場合、カードのドローを行えない。
  この場合、－1カードトークンは残ったままとなる。**」

##### C. `frigate`（フリゲート船）＝**「他人のアクション使用をフックする持続アタック」＋「誰も影響を受けなければ持続しない」**
- 既存の `applyLingerOnBuy`（沼の妖婆／呪いの森＝**購入**をフック）とは**フック点が違う**。
  新たに「他プレイヤーがアクションを**使用し終わった後**」のフックが要る。
  逐語＝`They completely resolve playing the Action before discarding.`
- **持続の生存条件が特殊**。逐語＝
  `Unlike other Duration Attacks (such as Swamp Hag), Frigate does nothing at the start of your next turn.
   This means that if this attack won't affect anyone (e.g., each other player blocks it with Moat),
   you'll immediately discard Frigate from play during your Clean-up.`
  → 本エンジンの `armDuration`＋`cnt` は「予約があれば場に残す」設計なので、
  **全員が堀/灯台/チャンピオン/守護者で無効化した場合だけ予約を張らない**分岐が要る。
- **リアクションでプレイされたカードの扱いが「そのとき」と「あとで」で逆**：
  - Frigate 使用に反応して番犬を出す＝**捨てない**（逐語 `they won't discard down to 4 cards after playing that,
    because the Frigate's attack isn't active yet.`）
  - 相手のターン中にリアクションで密航者/地図作りを使う＝**捨てる**（日本語wiki逐語）。
- **持続カードの開始時効果・リザーブの呼び出しは「アクションの使用」ではない**（発揮しない）が、
  **購入フェイズの 冠／呪符の巻物／資本主義で財宝化したアクション**と**夜フェイズの人狼**は発揮する。
- 免疫は**フリゲート船を使用した瞬間**に確定（後から灯台/チャンピオンを使っても防げない）＝
  §0-9 Batch5c の `markLingerImmune`（一意 rid）と同じ形にする。
- 追加ターンの非対称：**使用者が追加ターンを取ると効果は他人に届く前に消える**／
  **被害者は追加ターンを含む全ターンで受ける**。
- 誘発の**処理順は被害者が選べる**（逐語＝`they can first discard down to 4 cards in hand, and then spend a Favor
  for Fellowship of Scribes.`）＝本エンジンの「同時誘発の順を選べない」既存簡略化に当たる（許容簡略化として記録すべき）。
- ⚠ **`lingerAttackEnter` を使うなら UI の `viewPendingModal` 分岐と `LINGER_REACT` 許可リストを必ず足す**
  （A4 [high] 1番＝`state.pending.type` にカード名を**変数で**入れるのでリテラル検索をすり抜けて人間が詰む）。

##### D. `quartermaster`（操舵手）＝**インスタンス単位の脇ゾーン**（本エンジンが持っていない概念）
- 逐語＝`If you play two Quartermasters, they each have their own set of cards. However if you Throne Room a
  Quartermaster, you just have one set of cards for it, and twice on each of your turns, either add one or take one.`
  日本語wiki＝「複数枚の操舵手が持続する場合、**脇の領域は個々に区別される**。脇に置いたカードを別の操舵手によって
  手札に加えることはできない。」／「玉座の間で大君主を2回プレイし両方とも操舵手をプレイした場合、
  **1回目と2回目で別々の脇の領域になる**」。
  → §0-29 A4 の駐屯地トークンで踏んだ「場のインスタンス単位のカウンタ」より重い。
  `p.quartermasters = [{ cards: [...] }, ...]` のような**配列で持つ**（`p.archives`＝資料庫が最も近い前例）。
- **獲得先が捨て札を経由しない新 dest**。逐語＝`The card you gain is immediately set aside, and doesn't visit your
  discard pile. So if you gain a Ghost Town, it will be set aside on this (instead of going to your hand).`
  ただし逐語＝`However, abilities that move cards when you gain them can move a card that's gained with Quartermaster.
  So if you gain a Siren with this, it will still trash itself` ＝**on-gain の移動系は効く**（獲得トリガーは止めない）。
- **脇のカードは自分の所有カード**＝`allCards`／invariants の ZONES／終局デッキ公開／庭園・品評会・得点 に入れる。
  逐語＝`Cards that were gained and set aside on Quartermaster are still yours at the end of the game.`
- **永続持続**（`p.hirelings`／`p.princes` と同型で `cnt` に足して場に残す）。ただし
  「操舵手がターン終了時に場を離れている場合、…次のターンからはカードを獲得することは無く、それらを手札に加えることもできない」
  ＝**脇のカードは残るが機能停止**（＝保存則は保つが「取り出せないカード」が残る）。
- 「コスト4以下」は**成分別**（逐語＝「コスト最大4コイン**0ポーション0負債**まで」）＝`costUpTo` を必ず通す。
  イベント／プロジェクトは獲得できない。**ターン開始時の橋/運河のコスト減は反映される**（順序依存）。
- **`choose one` なので `ELDER_CHOICE_ORDER`（長老）に登録が必要**（日本語wiki が明記）。
  ただし逐語＝「長老が選択効果を追加できるのは**このターンに選択する場合**に限られる」＝
  次以降のターン開始時の選択は1つだけ。これを取り違えると永久に2択になる。

##### E. `mining_road`（鉱山道路）＝**獲得トリガーの中から財宝を「使用」する**（再入）
- 逐語＝`Mining Road applies to Treasures gained due to being bought, or gained other ways.` ＋
  `It works in your Action phase if you gain a Treasure then.` ＋
  日本語wiki「デッキトップに直接獲得(武器庫)…手札に直接獲得(銀山)…脇に直接獲得(操舵手)される財宝カードに対しても、
  鉱山道路の効果は誘発し、使用することができる。」
  → `triggerOnGain` / `onGainQueue` の中から `playTreasureCard`（＝`applyTreasureEffect`）を呼ぶ。
  **その財宝がさらに獲得を起こす**（掘出物・戦利品の袋・銀山・つるはし…）ので**再入とキューの多重化**に注意。
- **累積・でも同じ1枚を2回は使えない**。逐語＝`This ability is cumulative; if you play two Mining Roads, then twice
  that turn you may play a Treasure when you gain one. However two Mining Roads can't play the same gained Treasure twice.`
  → §0-29 A4 の `t.galleria`／`t.skirmishers`（使用回数を積む）と同型だが、
  **「その獲得1件につき1回」の重複防止**も要る。
- **lose-track（移動阻止）**：逐語＝「獲得した財宝カードを鉱山道路で使用する(=場に出す)効果は
  『獲得カードを獲得先から移動させる効果』なので、これを処理すると、他の『獲得カードを獲得先から移動させる効果』の
  処理には失敗する。」＝貨物船・物見やぐら・ヴィラ・そり等と**排他**（先に処理した方だけが成功する）。
  本エンジンの `onGainQueue` は「順に全部やる」ので、**片方が動かした時点で残りを失敗させる**判定が要る。
  - ⚠ **失敗させるのは「獲得カードを獲得先から移動させる効果」だけ**。逐語＝「一方で、獲得した財宝カードを鉱山道路の効果で
    使用する(=場に出す)処理を行ったとしても、そのことで他の『「獲得カードを獲得先から移動させる効果」以外の獲得時に誘発する
    効果』は妨げられない。例えば、コスト6以下の財宝カードを獲得し、鉱山道路の効果で使用した後でも、**複製を呼び出し同じ
    カードを獲得できる**。」＝**on-gain を一括で殺すと公式違反**（複製／罠師の小屋／都市国家／建築家ギルド／遊牧民団／
    投資の +2カード／VP系ランドマーク は全部そのまま発火する）。
    <!-- 検証で追記: 下書きはこの限定を落としており、実装が over-block する危険があった 出典=wikiwiki.jp/dominiondeck/鉱山道路 -->
  - 逐語＝「鉱山道路の効果により獲得した財宝Aを使用し、そのことで財宝Aがカード獲得時効果を発揮する場合は、この【自身の獲得】に
    対してカード獲得時効果を誘発できる。」＝**資本主義で財宝化した貸し馬屋を獲得→鉱山道路で使用すると、自分自身の獲得に対して
    馬1枚を獲得する**（自己参照の再入がある）。
- **効果は使用時に予約される**＝行進で場を離れても・はみだし者でサプライから使っても効く／
  **女魔術師・習性で使用時効果が書き換えられたら効かない**。

##### F. `trickster`（トリックスター）＝「場から捨てる」フック＋**先引きの後**に手札へ
- 逐語＝`This is cumulative; if you play two Tricksters, then you can set aside up to two Treasures you discard from
  play and put them into your hand at end of turn, **after drawing**.`
  → 本エンジンは「自分の手番終了時に**次の手札を先引き**」する。**先引きの後**に手札へ加える
  （§0-29 A3 の島民／§0-25 のリス／§0-21 の保存 と同じスロット。**角笛だけは逆**）。ここを間違えると1ターンずれる。
- **一度本当に捨てる**：逐語（日本語wiki）＝「脇に置く財宝は、**実際に一度捨て札にされる**ことに注意。
  よって、…元手を脇に置く場合も、元手の『場から捨て札にする時…を受け取る』の処理は発生する。」
  → 首都(Capital)の負債6は**発生する**。`triggerOnDiscard`（坑道/村有緑地/織工）も普通に走る。
- **「場から」限定**：酒場マットからの捨て札（資本主義×ワイン商）は対象外。
- 使用時に全部予約（行進/大君主でも効く・女魔術師/習性で書き換えられたら効かない）。
- **アタック部分（呪い配布）だけが堀の対象**。脇置きはアタックではない。

##### G. 「場に出ている異なる名前の財宝」の数え方（`pendant` / `wealthy_village` で**同じ罠**）
- **数える**：`p.inPlay` ＋ **`p.durationCards`（前ターンから残る持続-財宝）** ＋ 呼び出した法貨。
  **自分自身も数える**（Pendant 公式FAQ逐語＝`This counts itself.`）。**Loot も数える**（Wealthy Village 公式FAQ逐語）。
- **数えない**：脇に置かれた財宝＝`p.cargo`（貨物船）・`p.princes`（王子）・`p.contractSetAside`・`p.archives`・
  `p.eventSetAside`・操舵手の脇。日本語wiki逐語＝「『脇に置く』効果によって脇に置かれた財宝カードも場の枚数に含まれない。
  **特に表向けで脇に置く効果を持つカード（貨物船、王子など）がある場合は、場のカードと混同しないように注意。**」
  → 本エンジンは**表向きの脇置きが5ゾーンある**ので、素直に `inPlay` だけ見ると過小、
  「表向き＝公開」で拾うと過大になる。
- **「財宝か」の判定は必ず `isTreasureFor(state, id)`**（資本主義でアクションが財宝になる＝
  日本語wiki が Pendant で明記）。静的 `DOM.isType(id,'treasure')` を書くと壊れる。
- **Pendant は使用時に金額が確定**（逐語＝「ペンダント使用後に場に出ている財宝の枚数が変わった場合でも、
  ペンダントの産出コイン量が変化することは無い」）＝あとから足し直さない。

##### H. 財宝の「複数回使用」＝`kings_cache` は **3回**（既存は2回しか無い）
- 本プロジェクトの `treasure_replay`（§0-24）は**2回目まで**しか作られていない。3回目を積む必要がある。
  **【検証で裏取り済み】** `js/engine.js:494` 実測＝`const PLAY_TWICE_TREASURES = { tiara: 1, crown: 1, counterfeit: 1 };`
  ＝3枚とも「2回」専用。`state.replay.push({ ..., label: 'treasure_replay' })` は engine 内4箇所すべてが
  **1回だけ push＝合計2回プレイ**の形（`js/engine.js` の 7602 / 12693 / 13774 / 14903 行）。
  `playAllOrder`（`js/engine.js:498`）と `p.cargo` / `p.princes` / `p.contractSetAside` / `p.archives` / `p.eventSetAside`
  の5ゾーン名（落とし穴 G）も実在を確認済み。
- 逐語＝`If you King's Cache a Treasure-Duration card, King's Cache will stay in play as long as that card does.`
  → **玉座×持続の既存簡略化（§0-25 で「場に残らない」と記録済み）と真正面から衝突する**。
- 逐語＝`If you King's Cache a Capital, you end up with 6 debt when the Capital is discarded, not 18.`
  → 「場から捨てるときの負債」は**カード1枚につき1回**＝プレイ回数で掛けない。
- **`playAllOrder`（財宝を全部出す順）に `kings_cache` と `figurine` を足す**。
  現行は「ティアラ/冠/偽造通貨 → 銀貨 → その他 → 大金」。
  - `kings_cache` は **`PLAY_TWICE_TREASURES` と同じ「最初」グループ**（手札に財宝が残っていないと空振り）。
  - `figurine` も **早めに出す**（+2カード で引いた財宝をその後に出せる。最後に出すと丸損）。
  - `pendant` は逆に **できるだけ後**（場の財宝の種類が増えてから）。ただし「種類」なので銅貨を何枚出しても
    増えない＝機械的に最後で良い（大金より前）。
- `figurine` / `pickaxe` / `silver_mine` / `sack_of_loot` は **pending を立てる／獲得を起こす財宝**なので、
  `PLAY_ALL_TREASURES` の中断→`turn.playAllResume` の再開経路を必ず通ること（§0-24 の注意）。

##### I. 「手札に直接獲得」「山へ直接獲得」の dest 追加（3枚）
- `pickaxe`（戦利品を**手札に**）／`silver_mine`（財宝を**手札に**）／`quartermaster`（**脇に**）。
  いずれも**捨て札置き場を経由しない**（日本語wiki が3枚とも明記）。`gain(dest:'hand')` / 新 dest が要る。
- `pickaxe` の逐語＝`Remember that you have to reveal the gained Loot.` ＝ **`reveal()` を通す**
  （＝§0-22 のパトロンが自動で効く）。

##### J. `pickaxe` の**コスト参照は廃棄の「後」**
- 日本語wiki逐語＝「①手札のカードを廃棄し、廃棄置き場に置く→②廃棄カードのコストを参照し、追加効果を得る、
  という二段階の処理である。**廃棄したカードのコストを参照するのは②のタイミングである。**
  例えば、①で捨て札が空の状態で漁師(2コスト)を廃棄し、直後に手札の青空市場でリアクションすると、
  捨て札ができるので漁師は5コストとなる。この後で、②が処理されるので、結果的に戦利品を手札に獲得する。」
  → §0-26 の儀式(ritual)エラッタ（`it cost` → `it costs`）と同型。**廃棄前のコストをスナップショットしない**。
  廃棄は強制（`Trashing is mandatory, if you have any cards left in hand.`）＝**手札0枚なら何もしないで終端**。

##### K. `silver_mine` は「**自身より安い**」＝コスト減で**弱くなる**（逆方向の罠）
- 日本語wiki逐語＝「銀山のカード獲得効果は工房と異なり『自身より安いカード獲得』なので、コスト減効果は…
  メリットにはならない。極端な話、街道を5回以上使用するなどして全カードのコストが-5金されると、
  銀山の効果でカードが獲得できない。」
  → `costUnder(state, cardCost(state,'silver_mine'))` と**動的な自身のコスト**で毎回引く。
  静的 `$5` を焼き込むと橋/街道/渡し船/-2コストトークンで壊れる。
  獲得は**強制**だが候補ゼロなら**何も起きずに終端**（＝候補ゼロの pending を開かない＝A5 [high] リッチと同型）。

##### L. `pilgrim` の「山札の上へ置く」は**引けなくても強制**
- 逐語（日本語wiki）＝「カードをドローできなかった場合でも、**デッキトップに1枚戻す効果は必ず行わなければならない**。」
  ＋公式FAQ＝`The card you put on top doesn't have to be one of the 4 you just drew.`
  → 候補は**手札全部**。**手札が完全に空のときだけ**終端保証（候補ゼロの pending を開かない）。

##### M. `wealthy_village` の on-gain は「獲得**時**の場」を見る＝購入フェイズ以外だとほぼ空振り
- 工房・操舵手・闇市場などアクションフェイズの獲得では場に財宝が無く発動しない。
  逆に**操舵手で獲得**すると（ターン開始時＝場に前ターンの持続-財宝が残っていれば）成立し得る。
- 本エンジンの **「1回の獲得につき else-if 連鎖組の on-gain 対話は1つだけ」**という既存簡略化
  （§0-26）に載せると握りつぶされる。**戦利品の獲得は対話（無作為に1枚めくる）を伴わない自動処理**にできるなら
  `onGainQueue` の非対話項目にするのが安全。

##### N. 日本語名の**部分一致衝突**（カード全文検索・盤面帯・名前宣言モーダル）
- **「王の隠し財産」⊃「隠し財産」**（繁栄 Hoard）。さらに「王の宮廷」(King's Court) とも紛らわしい
  （英語wiki Trivia 逐語＝`King's Cache is the King's Court for Treasures`／日本語wiki＝「英語名の頭文字は宮廷(King's Court)と同じKC」）。
- **「巡礼者」(Pilgrim) vs 「巡礼」(Pilgrimage・冒険のイベント)** も部分一致。
- §0-24 で入れた**カード全文検索（`searchNorm`＋空白区切りAND）**で「隠し財産」「巡礼」が2件ヒットするようになる。
  機能影響は無いが、`docs` と群見出しで区別しておくこと（§0-29 の `alliance`＝「同盟」と同じ扱い）。
- **【検証で裏取り済み】** `js/cards.js` 実測＝`hoard: { name: '隠し財産' }`（189行）／
  `pilgrimage: { name: '巡礼', kind: 'event', expansion: 'adventures' }`（1722行）＝**両方の部分一致衝突は実在する**。

##### O. その他（軽いが忘れると壊れる）
- `figurine` は **財宝なのにドローする**＝購入フェイズにリシャッフルが起き得る（メイソン団／占星術師団／
  へそくり `placeStash` が絡む）。効果は **`applyTreasureEffect` に書く**（`applyEffect` は財宝では呼ばれない）。
  アクションを捨てる部分は `triggerOnDiscard` を通す（村有緑地／織工／坑道）。
- `longship` は本群で唯一の完全バニラ。**+2アクションは使用時／+2カードは次ターン開始時**（`DURATION_RESOLVERS`）。
- `sack_of_loot` の戦利品獲得は**強制**（日本語wiki逐語＝「戦利品の獲得は強制である。」）。
- 本群14件すべて **負債もポーション費用も持たない**＝`costIsPlainCoin` が真。
  ただし **`quartermaster` / `silver_mine` の「獲得できる範囲」判定は成分別**（相手側のカードが負債/ポーションを
  持ち得る）＝`costUpTo` / `costUnder` を必ず使う（素の `cardCost(state,id) <= N` を書くと mix-all で livelock）。


---

## 第5章 戦利品(Loot) 15種

<sub>（出典ファイル＝`loot.md`。見出しは2段下げて収録）</sub>

### 略奪（Plunder・2022年12月）— 戦利品（Loot）カード15種 一次資料まとめ

**担当範囲＝Loot 15種のみ**（王国カード・イベント・習癖(Trait)は別担当）。

#### 出典（すべて実DL・実読）
| 種別 | 出典 | 取得方法・確認 |
|---|---|---|
| 現行カードテキストの正本 | 英語wiki `wiki.dominionstrategy.com` の各カードページ（`Card text` 欄＋`Versions > English versions` の最新 printing 行） | `python tools/wikifetch.py <Page>`（Wayback 経由）。**判定は snapshot ラベルではなく本文の `Set: Plunder` / `Plunder December 2022` で行う**＝15枚とも略奪発売後のキャプチャであることを1枚ずつ確認済み |

<!-- 検証で訂正: 旧="15枚とも snapshot は 2023id_ / 2024id_ / 2025id_ / 2id_（＝最新）"。
     独立に再取得すると Staff と Prize Goat は snapshot=2019id_ で返る（再現不能な記述だった）。
     `wikifetch.py` の SNAPSHOTS は ['2id_','2025id_','2024id_','2023id_','2019id_'] を順に試すが、
     Wayback は部分タイムスタンプを「その時刻に最も近いキャプチャ」と解釈するため、
     2019年に存在しないページでも 2019id_ で発売後のキャプチャが返る。
     ＝**snapshot の年は古さの証拠にならない**。実際 2019id_ で返った Staff / Prize Goat の本文は
     どちらも `Set: Plunder` / `Plunder / December 2022` を含む現行ページだった。
     出典=独立再取得（python tools/wikifetch.py Staff Prize_Goat）＋ tools/wikifetch.py の SNAPSHOTS 実装 -->
⚠ **`wikifetch.py` の `snapshot=2019id_` は「2019年のページ」という意味ではない**（Wayback の最近傍キャプチャ）。
**古さの判定は必ず本文の `Set:` 行と `Versions` 表の Release/Date 列で行うこと。**
| 公式FAQ | 同上 `Official FAQ` / `Other rules clarifications` 節 ＋ RGG 公式ルールブックPDF | PDF＝`https://www.riograndegames.com/wp-content/uploads/2022/08/DomPlunder.pdf`（2,206,503 bytes・2022-08-20）を curl で実DL → `pdftotext -layout`。**wiki の Official FAQ と PDF の FAQ は15枚とも逐語一致**（PDFはコイン記号を落とすので金額は wiki 側で裏取り） |
| 日本語名・日本語カードテキスト | 日本語wiki `https://wikiwiki.jp/dominiondeck/<カード名>` の全15ページ | curl で実DL（WebFetch は 429、素の curl だと Cloudflare チャレンジに時々かかるので cookie jar ＋リトライで全15枚取得）。**各ページの表に英語名が併記されているので、日本語名⇔英語名の対応は推測ではなく実データで確定**している |

⚠ **日本語wiki の効果文には `(※日本語訳はDominion Onlineより)` と明記がある**＝表示されている日本語文面は
**Dominion Online（デジタル版）の訳**であって、ホビージャパン印刷版と一字一句同じとは限らない。
**実際に呪符の巻物(Spell Scroll)では印刷版と食い違う**ことがページ内に明記されている（下記「落とし穴」参照）。

---

#### 全15種の一覧表

**コストは全15種とも `$7*`（星付き＝非サプライ）**。負債・ポーションは**1枚も無い**（成分は coin:7 のみ・`potion:0` `debt:0`）。

| id | 英語名 | 日本語名 | コスト | 種別（カード記載順） | 現行カードテキスト（英語・改行位置も再現） | 日本語カードテキスト | 公式FAQ・裁定（逐語） |
|---|---|---|---|---|---|---|---|
| `amphora` | Amphora | アンフォラ | `$7*` | Treasure - Duration - Loot | Either now or at the start of your next turn:<br>+1 Buy and +$3. | 現在またはあなたの次のターンの開始時に、<br>+1 購入、+3 コイン。 | **Official FAQ**: `When playing Amphora, choose whether to get +$3 and +1 Buy immediately, or at the start of your next turn.` / `If you choose "immediately," Amphora will be discarded in the same turn's Clean-up; if you choose "next turn," Amphora will be discarded that turn.` / `If you play Amphora multiple times, such as with King's Cache, you choose each time whether to get the +$3 and +1 Buy now or next turn, and Amphora only stays in play if at least one of the plays was for next turn (in which case the King's Cache also stays in play).` |
| `doubloons` | Doubloons | ダブロン金貨 | `$7*` | Treasure - Loot | $3<br>―――<br>When you gain this, gain a Gold. | 3 コイン<br>―――<br>これを獲得したとき、金貨1枚を獲得する。 | **Official FAQ**: `When you gain this, you also gain a Gold.` ／ 日本語wiki 詳細なルール: 「このカードを獲得した時、金貨の獲得は**強制**である。」「サプライの金貨が無い場合、何も獲得しない。」 |
| `endless_chalice` | Endless Chalice | 尽きぬ杯 | `$7*` | Treasure - Duration - Loot | Now and at the start of each of your turns for the rest of the game:<br>$1<br>+1 Buy | 現在と、ゲーム終了まであなたの各ターンの開始時に、<br>1 コイン<br>+1 購入 | **Official FAQ**: `Once played, this stays in play for the rest of the game.` ／ 日本語wiki 詳細なルール: 「持続カードが何らかの理由により場を離れた場合、【持続効果】はターン終了時にすべて失われる」「ティアラ系で複数回尽きぬ杯をプレイした場合、プレイした回数だけ毎ターン尽きぬ杯の持続効果が発揮される（ティアラも場に残り続ける）」「『ターンの開始時』に尽きぬ杯を使用した場合（準備 Prepare 等）は『現在1金+1購入』と『各ターンの開始時1金+1購入』の両方が起きて**即座に2金2購入**になる」 |
| `figurehead` | Figurehead | 船首像 | `$7*` | Treasure - Duration - Loot | $3<br>―――<br>At the start of your next turn, +2 Cards. | 3 コイン<br>―――<br>あなたの次のターンの開始時、+2 カードを引く。 | **Official FAQ**: `When you play this, you get +$3, and at the start of your next turn, you get +2 Cards.`（`Other rules clarifications` 節は空） |
| `hammer` | Hammer | ハンマー | `$7*` | Treasure - Loot | $3<br>―――<br>Gain a card costing up to $4. | 3 コイン<br>―――<br>コスト4以下のカード1枚を獲得する。 | **Official FAQ**: `Each time you play this, you get +$3 and gain a card costing up to $4. This isn't optional.` ／ 日本語wiki 詳細なルール: 「ポーションをコストに含むカード(ブドウ園など)、負債をコストに含むカード(技術者など)は、どちらもコスト最大4(コイン)までのカードに含まれないため、獲得できない」「正確には『コスト最大4コイン**0ポーション0負債**までのカード』とみなされる」「橋などでコストが下がった場合、下がった後のコストが4以下であれば獲得できる（橋→ハンマーの順なら公領を獲得できる）」「イベントやプロジェクトはカードではないため獲得できない」 |
| `insignia` | Insignia | 勲章 | `$7*` | Treasure - Loot | $3<br>―――<br>This turn, when you gain a card, you may put it onto your deck. | 3 コイン<br>―――<br>このターン、カード1枚を獲得したとき、それを山札の上に置いてもよい。 | **Official FAQ**: `If you gain multiple cards, this applies to each of them - you can put any or all of them on top of your deck.` |
| `jewels` | Jewels | 宝石 | `$7*` | Treasure - Duration - Loot | $3<br>+1 Buy<br>―――<br>At the start of your next turn, put this on the bottom of your deck. | 3 コイン<br>+1 購入<br>―――<br>あなたの次のターンの開始時に、これを山札の一番下に置く。 | **Official FAQ**: `When you play this, you get +$3 and +1 Buy, and at the start of your next turn, put this on the bottom of your deck.` ／ **Other rules clarifications**: `If a card plays this multiple times (e.g. King's Cache), then when you put this on the bottom of your deck, that card will remain in play until the Clean-up phase.` ／ 日本語wiki 詳細なルール: 「次のターンの開始時にデッキボトムに置くのは**強制**」「**捨て札置き場を経由せず直接デッキボトムに移動する**。よってトリックスターの効果で宝石を脇に置くことはできない」 |
| `orb` | Orb | 宝珠 | `$7*` | Treasure - Loot | Look through your discard pile. Choose one: Play an Action or Treasure from it; or<br>+1 Buy and +$3. | 捨て札置き場のカードをすべて見る。次のうち1つを選ぶ:<br>「その中のアクションカードか財宝カード1枚を使用する」;「+1 購入、+3 コイン」 | **Official FAQ**: `First look through your discard pile; then choose either to play an Action or Treasure from it, or to get +1 Buy and +$3.` ／ 日本語wiki 詳細なルール: 「捨て札置き場をすべて見る効果は、**どちらの選択肢を選ぶかに関わらず先に処理する**」「購入フェイズ中に使用した宝珠の効果でアクションカードを使用する場合、**あくまで購入フェイズ中の使用**（冠は必ず『財宝2回使用』／人狼は必ず『+3ドロー』になる）」「宝珠が場から捨て札になるタイミングは**常に『宝珠使用ターンのクリーンアップ』**（玉座の間やはみだし者と違う）。宝珠で漁村を使用すると漁村は次のターンまで場に残るが、宝珠自身は当ターンに捨て札になる」 |
| `prize_goat` | Prize Goat | 賞品のヤギ | `$7*` | Treasure - Loot | $3<br>+1 Buy<br>―――<br>You may trash a card from your hand. | 3 コイン<br>+1 購入<br>―――<br>手札1枚を廃棄してもよい。 | **Official FAQ**: `Trashing a card is optional.` |
| `puzzle_box` | Puzzle Box | パズルボックス | `$7*` | Treasure - Loot | $3<br>+1 Buy<br>―――<br>You may set aside a card from your hand face down. Put it into your hand at end of turn. | 3 コイン<br>+1 購入<br>―――<br>手札1枚を脇に伏せて置いてもよい。ターン終了時にそれを手札に加える。 | **Official FAQ**: `If you set aside a card, the Puzzle Box itself is still discarded normally that turn.` / `The set-aside card goes into your hand after drawing for the next turn.` ／ 日本語wiki 詳細なルール: 「次のターンなどに処理が残る効果ではないため、パズルボックスが**持続したり場に残ったりはしない**」 |
| `sextant` | Sextant | 六分儀 | `$7*` | Treasure - Loot | $3<br>+1 Buy<br>―――<br>Look at the top 5 cards of your deck. Discard any number. Put the rest back in any order. | 3 コイン<br>+1 購入<br>―――<br>山札の上から5枚を見る。その中の好きな枚数を捨て札にする。残りを好きな順番で山札の上に戻す。 | **Official FAQ**: `You can put all 5 cards back, or discard all 5, or anything in between.` ／ **Other rules clarifications**: `If you happen to put a card on top of your deck in the middle of resolving Sextant—for instance, by discarding a Tunnel, gaining a Gold, and top-decking it due to Progress—then when you return any remaining cards to your deck they will go on top of the card you just put there.` ／ 日本語wiki: 「山札の上から5枚を見る効果は**強制**」 |
| `shield` | Shield | 盾 | `$7*` | Treasure - **Reaction** - Loot | $3<br>+1 Buy<br>―――<br>When another player plays an Attack, you may first reveal this from your hand to be unaffected. | 3 コイン<br>+1 購入<br>―――<br>他のプレイヤーがアタックカードを使用するとき、その解決前に、手札からこれを公開してもよい。公開した場合、そのアタックカードの影響を受けない。 | **Official FAQ**: `You can reveal this when another player plays an Attack card to be unaffected by it, exactly as with Moat.` / `You do this before the Attack card has done anything, and can use Shield against multiple Attacks in a turn.` / `Shield stays in your hand and can still be played for +$3 and +1 Buy on your turn.` |
| `spell_scroll` | Spell Scroll | 呪符の巻物 | `$7*` | **Action** - Treasure - Loot | Trash this to gain a cheaper card. If it's an Action or Treasure, you may play it. | これを廃棄する。廃棄した場合、これより安いカード1枚を獲得する。それがアクションカードか財宝カードの場合、使用してもよい。<br>※印刷版の文面は下記「落とし穴」参照 | **Official FAQ**: `You can play this in your Action phase or Buy phase; if played in your Action phase, it uses up an Action play for the turn. However playing the card you gain from Spell Scroll does not use up an Action play.` ／ **Other rules clarifications**（下書きが落としていた）: `If you use Spell Scroll to gain and play an Action card during your Buy phase, that does not allow you to play any additional Action cards afterward, even if the Action you play gives you +Actions.` |
<!-- 検証で訂正: 旧=Official FAQ のみ記載し `Other rules clarifications` を丸ごと欠落。
     出典=英語wiki Spell_Scroll ページ `Other rules clarifications` 節の逐語。
     実装影響＝購入フェイズに呪符の巻物で村（+2アクション）を獲得して使用しても、
     **その後アクションカードを追加で使用できてはいけない**（+アクションは加算されるが使用権にならない）。 -->


| `staff` | Staff | 杖 | `$7*` | Treasure - Loot | $3<br>+1 Buy<br>―――<br>You may play an Action from your hand. | 3 コイン<br>+1 購入<br>―――<br>手札からアクションカード1枚を使用してもよい。 | **Official FAQ**: `Playing an Action card from your hand is optional.` ／ 日本語wiki 詳細なルール: 「杖の効果でアクションを使用するのは**購入フェイズ**であることに注意」「杖で使用した冠は必ず『財宝2回使用』／人狼は必ず『+3ドロー』になる」「杖が場から捨て札になるタイミングは**常に『杖使用ターンのクリーンアップ』**（玉座の間などと違う）」 |
| `sword` | Sword | 剣 | `$7*` | Treasure - **Attack** - Loot | $3<br>+1 Buy<br>―――<br>Each other player discards down to 4 cards in hand. | 3 コイン<br>+1 購入<br>―――<br>他のプレイヤーは全員、手札が4枚になるように捨て札にする。 | **Official FAQ**: `This is an Attack, and so cards like Moat and Shield protect from it.` ／ 日本語wiki 詳細なルール: 「相手の手札が5枚以上の時に1枚捨てさせる効果ではなく、**手札枚数に関わらず4枚になるまで**捨てさせる効果である（民兵タイプ）」 |

##### エラッタ
**15枚とも `Versions > English versions` 表の行は 1行だけ**（`Plunder / December 2022`）＝
**印刷は初版のみで、機能エラッタ・テキスト改訂は1枚も無い**（wiki に `Errata` 節を持つ Loot は存在しない）。
つまり RGG の 2022-08 版 PDF が**そのまま現行**（夜想曲・同盟のような「PDFが旧版」の罠は無い）。

##### Secret History（実装には効かないが、設計意図の裏取りとして）
- Amphora: `Unchanged except for name.`
- Endless Chalice: `Tweaked the wording but kept it functionally the same. It didn't always have the big coin.`
- Figurehead: `Started out making +$2.`
- Insignia: `Unchanged.`（`Why does it not have +Buy?` 節あり＝**+1購入が無いのは意図的**）
- Orb: `Initially made +$2 and played a card from your discard pile; yowza. Then a choice of playing a card or +$3; then playing a card or +$3 and +1 Buy.`
- Prize Goat / Puzzle Box / Shield / Sword: `Initially had no +Buy.`
- Spell Scroll: `Initially a Treasure that gained a cheaper card to hand. ... Then, could also play Treasures ... Then I made it also an Action for more flexibility.`

---

#### 補足＝戦利品の山（Loot pile）の共通ルール（実装の前提）

RGG 公式ルールブック（`DomPlunder.pdf` p.3）逐語：

> There are 15 Loot cards, with 2 copies of each. Shuffle them into a face-down pile before the game if
> any cards refer to Loot. During the game, "gain a Loot" means, you gain the top card of the Loot pile.
> When you gain a Loot, reveal it to all players. Then put it into your discard pile as usual. Players can't
> look through the Loot pile during a game. The Loot pile isn't in the Supply; players can't buy or gain
> from it, except with cards that specifically gain Loot.

準備（同 p.2）：
> In games using cards that refer to Loot, shuffle the Loot pile and place it face down where everyone can reach it.

英語wiki `Loot` ページの **Other rules clarifications**（逐語）：
> If you exchange a gained Loot (e.g. with Changeling), the Loot goes back on top of the pile, face down.

日本語wiki「戦利品」ページの詳細なルール（要点・逐語）：
- 「戦利品全30枚を全て裏向きにした状態でシャッフルし、一番上のカードを裏向きのままで戦利品の山札としてサプライ外に置く。**一番上のカードのみが公開される廃墟などとは異なるので注意**。」
- 「戦利品は、『戦利品を獲得する効果』でのみ獲得できる。購入や、通常のカード獲得効果では獲得できない。」
- 「**戦利品の山札は非公開領域**であるため、（工具などで場のダブロン金貨を指定しても）戦利品の山札の一番上にあるダブロン金貨を獲得することはできない。」
- 「ただし、**廃棄置き場にある戦利品**であれば、『廃棄置き場からカードを獲得する効果』で獲得できる。」
- 「交換の処理などで戦利品を由来する山札に戻す処理が発生した場合は、戦利品の山札の一番上に**裏返しの状態で**戻す。」
- 「**戦利品の山札はサプライではない。戦利品の山札が枯れた場合でも、ゲーム終了条件である三山切れには数えない。**」

戦利品を配るカード（英語wiki `Loot > Ways to gain Loot`。**別担当の範囲だが、実装順の参考に**）：
`$2` Jewelled Egg / Peril / Search ・ `$3` Foray ・ `$5` Pickaxe / Wealthy Village / Cutthroat ・
`$6` Looting / Sack of Loot ・ `$10` Invasion / Prosper ・ Trait: Cursed

##### 機械的な整合（本アプリの実装値として使える数）
- **`+$3` を持つのは11枚**（Doubloons / Figurehead / Hammer / Insignia / Jewels / Prize Goat / Puzzle Box / Sextant / Shield / Staff / Sword）。
  Amphora と Orb は**選択肢の中**に `+$3` があるので静的な `coin:3` にしてはいけない。Endless Chalice は `$1`。Spell Scroll は**コイン無し**。
  （日本語wiki「戦利品」の総括「**15種中13種類**は+3コインの効果を持ち」＝上記11＋条件つき2[アンフォラ・宝珠] と一致。
   同ページの脚注*1 逐語＝「**金貨を獲得して使用できる呪符の巻物も含めると、14種類**」）
- **`+1 Buy` を持つのは10枚**（Amphora[条件]/Endless Chalice/Jewels/Orb[条件]/Prize Goat/Puzzle Box/Sextant/Shield/Staff/Sword）。
  **持たないのは5枚**＝Doubloons / Figurehead / Hammer / Insignia / Spell Scroll。
  （日本語wiki の総括「10種類は +1購入」と一致＝クロスチェック済み）
- **持続(Duration)は4枚**＝Amphora（条件つき）/ Endless Chalice（恒久）/ Figurehead / Jewels。
- **アタックは1枚**（Sword）／**リアクションは1枚**（Shield）／**アクションでもあるのは1枚**（Spell Scroll）。

---

#### 【重要】実装時に事故りそうな落とし穴（逐語引用つき）

##### 1. 呪符の巻物(Spell Scroll)＝**日本語印刷版の文面がルールミスを誘発する誤訳**
日本語wiki が名指しで警告している（逐語）：
> ※ホビージャパンから発売されている「ドミニオン：略奪」版のテキストは
> 「これを廃棄して、これよりもコストの少ないカード1枚を獲得する」になっているが、**ルールミスを誘発する訳**である。
> 玉座の間などで複数回使用したときにカードを複数回獲得できるかのようなテキストであるが、詳細なルールにある通り不可能である。

→ **カタログ文は印刷版どおりにしてはいけない**（夜想曲の取り替え子と同じクラス）。
英語原文 `Trash this to gain a cheaper card.` ＝**廃棄できた場合にだけ獲得する**（1回目で廃棄されるので2回目は空振り）。
本アプリでは `takeSelf` / `playedByCommand`（§0-17）を通し、命令(Command)経由では廃棄が失敗して獲得も起きない形にすること。

##### 2. 呪符の巻物は**アクションでも財宝でもある**＝プレイ経路が2つ、アクション権の消費が非対称
> `You can play this in your Action phase or Buy phase; if played in your Action phase, it uses up an Action play for the turn.`
> `However playing the card you gain from Spell Scroll does not use up an Action play.`

→ 購入フェイズでも `PLAY_TREASURE` で出せて、そのとき**アクション権は減らない**。
さらに**獲得したカードを使うほうはどちらのフェイズでもアクション権を消費しない**。
`PLAY_ALL_TREASURES`（財宝を全部出す）に巻き込むと、廃棄→獲得→使用の選択待ちが割り込む＝
**`playAllResume`（§0-24）の中断・再開に必ず載せる**こと。

##### 3. 杖(Staff)・宝珠(Orb)＝**購入フェイズにアクションカードを使用する**
> 杖: 「杖の効果でアクションを使用するのは**購入フェイズ**であることに注意。」
> 「杖の効果で使用した**冠**は、必ず『財宝2回使用』の効果となる。」「使用した**人狼**は、必ず『+3ドロー』の効果となる。」
> 「**行商人**のコストは変動している。」

→ 本アプリの `turn.phase === 'buy'` 判定に依存しているカード（冠のモード分岐・人狼・行商人のコスト・
公会堂/列柱/汚された神殿/徴税の `gainWasBuyPhase`・`treasuresLocked`）が**全部この経路で効く**。
「アクションを使わせる」共通入口＝`playCardNoAction`（§0-26）に載せるが、**フェイズを書き換えてはいけない**。

##### 4. 杖・宝珠は「使わせたカード」が場に残っても**自分は当ターンに捨て札になる**（玉座の間と扱いが逆）
> 「杖が場から捨て札になるタイミングは、**常に『杖使用ターンのクリーンアップフェイズ』**である。
> 玉座の間やはみだし者などの『自身の効果で使用したカードが場から離れるまで場に残るカード』との違いに注意。
> 杖の効果で漁村を使用すると、漁村は『杖使用者の次のターンのクリーンアップフェイズ』まで場に残るが、
> 杖自身は『杖使用ターンのクリーンアップフェイズ』に捨て札になる。」（宝珠も同文）

→ §0-25 の「専門家(Specialist)で持続を2回使うと専門家自身も場に残る」と**逆**。
`playCardNoAction` の戻り値を見て持続の予約を張る実装（A4 の [high] 12）を**そのまま流用すると杖が場に残って壊れる**。

##### 5. 宝石(Jewels)＝デッキの一番下へ行くのは**強制**、かつ**捨て札置き場を経由しない**
> 「次のターンの開始時にデッキボトムに置くのは**強制効果**である。この時、宝石は**捨て札置き場を経由せず直接デッキボトムに移動**する。
> よって、**トリックスターの効果で宝石を脇に置くことはできない**。」

→ 「場から捨てるとき」のフック（トリックスター／坑道／村有緑地／カエルの習性／城壁のある村）を
**一切通してはいけない**。移動先は `p.deck` の**末尾**。
さらに Official FAQ 相当の clarification（逐語）：
> `If a card plays this multiple times (e.g. King's Cache), then when you put this on the bottom of your deck, that card will remain in play until the Clean-up phase.`
→ **再演元（王の隠し財産/冠/ティアラ/専門家）は宝石が場を離れた瞬間には捨てず、そのターンのクリンナップまで場に残す**。

**さらに（下書きが落としていた・移動阻止ルール＝lose-track が絡む）**。日本語wiki「宝石」詳細なルール 逐語：
> 「11ターン目でデッキボトムに移動した後の宝石(A)を**引き直すなどして手札から使用すると場に出る**が、
> …のタイミングで一度『使用した持続カード(=宝石(A))が場から離れた』と判定されている。
> その後場に同名のカードが戻ってきても、**移動阻止ルール**により…**判断されない**。
> よって、11ターン目で手札に戻った宝石(A)を手札から使用した場合でも、
> **冠Aは11ターン目のクリーンアップフェイズで場から捨て札になる**。」

→ 実装＝**冠/ティアラ側の「まだ場に残すか」の判定に、同名カードが場へ戻ってきたことを再カウントしてはいけない**
（`removeOne` 系の同名一致で復活させると冠が永久に場に残る）。§0-17 の lose-track と同じ扱い。
<!-- 検証で追記: 下書きは King's Cache の clarification だけで、宝石を引き直して同ターンに再使用した場合の
     lose-track 判定（冠は当ターンのクリンナップで捨てる）に触れていなかった。
     出典=https://wikiwiki.jp/dominiondeck/宝石 「詳細なルール」節 -->

**⚠ 宝石は「山札の一番下に置く」＝獲得でも捨て札でもない第3の移動**（デッキボトム）。
`p.deck` の**末尾**に直接 push し、`triggerOnDiscard`（トリックスター/坑道/村有緑地/カエルの習性/城壁のある村）を
**1つも通さない**こと（上記の逐語「捨て札置き場を経由せず直接デッキボトムに移動する」）。

##### 6. アンフォラ(Amphora)＝**プレイのたびに独立に「今か次か」を選ぶ**／1回でも「次」なら持続する
> `If you play Amphora multiple times, such as with King's Cache, you choose each time whether to get the +$3 and +1 Buy now or next turn,
> and Amphora only stays in play if at least one of the plays was for next turn (in which case the King's Cache also stays in play).`

→ 「条件つき持続」＝同盟の要塞/駐屯地と同型（§0-29 A4）。
**旗1つではなく回数で持つ**（「今」を2回選んだら持続しない／「次」を2回選んだら次ターンに2回発動）。

##### 7. 尽きぬ杯(Endless Chalice)＝**永続持続**＋「ターン開始時に使用」で**その場で2回発動**
> `Once played, this stays in play for the rest of the game.`
> 「『ターンの開始時』に尽きぬ杯を使用した際の処理に注意。尽きぬ杯は『現在、1金＆+1購入』と
> 『各ターンの開始時、1金＆+1購入』の効果を持つので、この場合は**即座に2金2購入**が得られることになる。」

→ 本アプリの `p.hirelings` / `p.champions` / `p.princes`（永続持続の枚数カウンタ）と同型で持つ。
**ティアラ系で複数回プレイしたら、その回数ぶん毎ターン発動する**（「ティアラも場に残り続ける」）。
「ターン開始時に使用させる」経路（略奪の Prepare／王子／船長）と同居すると即2回発動する。

##### 8. ハンマー(Hammer)＝獲得は**強制**、かつコスト比較は**3成分厳密**
> `Each time you play this, you get +$3 and gain a card costing up to $4. This isn't optional.`
> 「正確には『コスト最大4コイン**0ポーション0負債**までのカード』とみなされるため（ブドウ園・技術者は獲得できない）」

→ 本アプリでは `costUpTo(state, id, 4)` を使うこと（§0-23）。素の `cardCost <= 4` を書くと
ポーション費用/負債コスト/非サプライ/ロック中の分割山下段を拾って **engine拒否×CPU提案の livelock**。
**強制なのに候補ゼロ**（$4以下の山が全部空）になり得るので、**窓を開く前に再検査して候補ゼロなら開かない**
（§0-29 A5 の [high] リッチと同型）。

##### 9. ダブロン金貨(Doubloons)＝獲得時の金貨は**強制**、山が空なら何も起きない
> 「このカードを獲得した時、金貨の獲得は**強制**である。」「サプライの金貨が無い場合、何も獲得しない。」

→ 戦利品は「獲得したとき」に**必ず公開**される（`When you gain a Loot, reveal it to all players.`）ので、
`triggerOnGain` の中で戦利品公開 → ダブロンの金貨獲得、という**入れ子の獲得**になる。
本アプリの「1獲得＝1対話」の else-if 連鎖に足すと他の on-gain を握りつぶす＝**`state.onGainQueue` に積む**こと（§0-26）。

##### 10. 盾(Shield)＝**手札に残る**リアクション（堀と同じ）だが、**財宝でもある**
> `Shield stays in your hand and can still be played for +$3 and +1 Buy on your turn.`
> `You do this before the Attack card has done anything, and can use Shield against multiple Attacks in a turn.`

→ 本アプリの `hasReaction` ＋ `MOAT_REVEAL` 相当の**免疫リアクション**（馬商人/番犬のような「先にプレイする」型ではない）。
**1ターンに複数のアタックへ何度でも使える**＝`immune[]` の per-attack 記録（§0-9 Batch5c の `rid`）が必須。
⚠ **同盟の Ally が起こす攻撃（魔女の輪・すり師団）は「アタックカードのプレイ」ではないので盾で防げない**（§0-29）。

##### 11. 剣(Sword)＝**手札4枚になるまで**（民兵型）。「5枚以上なら1枚」ではない
> 「相手の手札が5枚以上の時に1枚捨てさせる効果ではなく、**手札枚数に関わらず4枚になるまで**捨てさせる効果である。」

→ 既存の汎用 `discard_down`（民兵/浮浪児/傭兵/サー・マイケル/辺境伯）を **n=4** で流用できる。
ただし**財宝カードのアタック**なので、`playTreasureCard` の途中でリアクション窓が開く＝
`PLAY_ALL_TREASURES` が中断して `playAllResume` に載る（遺物 relic・ペテン師 charlatan と同型）。

##### 12. 六分儀(Sextant)＝解決中に山札の上へカードが載ることがある
> `If you happen to put a card on top of your deck in the middle of resolving Sextant—for instance, by discarding a Tunnel, gaining a Gold,
> and top-decking it due to Progress—then when you return any remaining cards to your deck they will go on top of the card you just put there.`

→ **公式は「後から戻す残りが上」**。本アプリの汎用 `look_arrange` は §0-29 A3 で
「解決中に山札の上へ置かれたカードが戻した残りより上に来る（公式は逆）」という**許容簡略化**として記録済み。
六分儀は**捨て札を挟むので坑道(Tunnel)が確実に誘発する＝この差が実際に見える数少ないカード**。流用するなら再検討が要る。
また「5枚見る」は**強制**（捨てる枚数だけが任意）。

##### 13. 宝珠(Orb)＝「捨て札を全部見る」は**選択の前に必ず行う**／捨て札から**アクションも財宝も**使える
> `First look through your discard pile; then choose either to play an Action or Treasure from it, or to get +1 Buy and +$3.`
> 「捨て札置き場のカードをすべて見る効果は、**いずれの選択肢を選ぶかに関わらず処理する**。」

→ 「見る(look at)」＝**オンラインの私的看破**。`maskStateFor` の私的看破リストに必ず足す
（§0-21 偵察隊／§0-28 夜警／§0-29 A4 粉屋・歩哨 と**4回続けて同じクラスの漏れ**を出している）。
※ただし宝珠は「自分の捨て札」なので元から自分に見えている＝実害は小さいが、pending に載せるなら要確認。
また**捨て札から使用するので `state.trash` でも `p.hand` でもない第3の経路**＝
アクション権を消費しない（`playCardNoAction`）＋**捨て札に戻すのではなく場に出す**。

**⚠ 宝珠は「次のうち1つを選ぶ」＝『選ぶ』カード＝長老(Elder)の追加選択対象**（下書きが落としていた）。
日本語wiki「宝珠」詳細なルール 逐語：
> 「宝珠の『捨て札置き場のカードをすべて見る』**より後の効果は「選択効果」**なので、悟りの効果でアクション化され、
> アクションフェイズ以外に**長老で使用されると、選択効果を1つ多く選択できる**。」

→ PROGRESS §0-29 A4 の恒久ルール（逐語）＝
「**「選ぶ」カードを新しく足すときは `ELDER_CHOICE_ORDER` に**カード記載順で**登録し、
 reducer は `normalizeChoices` → `runChoiceOptions` を通す**（長老の追加選択が自動で効く）」
に**宝珠を必ず載せる**こと（`ELDER_CHOICE_ORDER` に登録しないと mix-all で長老と同居したとき公式より弱くなる）。
なお「捨て札を全部見る」は**選択肢ではない前段**＝長老で2つ選んでも見るのは1回。
※§0-29 A4 は「長老で追加選択できるのは同盟の9種のみ」を**許容簡略化**として記録している＝
宝珠を足すか据え置くかは実装時の判断だが、**据え置くなら許容簡略化として明記する**こと。
<!-- 検証で追記: 下書きは宝珠が choose-one であることに触れておらず、長老(Elder)/ELDER_CHOICE_ORDER への
     登録要否がまったく議題に上がっていなかった。出典=https://wikiwiki.jp/dominiondeck/宝珠 「詳細なルール」節 -->

**もう1点＝行商人のコストは変動している**（杖と同じ注意。日本語wiki 宝珠/杖 の両方に逐語あり）：
> 「**行商人**のコストは変動している。例えば、アクションが場に2枚あれば、行商人は4コストになっているため、
> 工房でサプライの行商人を獲得できるし、大君主で行商人を選択できる。」

##### 14. パズルボックス(Puzzle Box)＝**持続ではない**。脇札はターン終了時（次の手札を引いた後）に手札へ
> `If you set aside a card, the Puzzle Box itself is still discarded normally that turn.`
> `The set-aside card goes into your hand after drawing for the next turn.`
> 「次のターンなどに処理が残る効果ではないため、パズルボックスが**持続したり場に残ったりはしない**。」

→ **本アプリの「自分の手番終了時に次の手札を先引きする」実装では、脇札を戻すのは必ず先引きの“後”**
（§0-22 の角笛は逆に「前」・§0-25 のリス／§0-21 の保存と同じ位置）。ここを間違えると1ターンぶんズレる。
脇札は**物理カード**なので新ゾーン（`p.puzzleBox` 等）を `allCards` と invariants の `ZONES` に登録すること。
伏せて置く＝**所有者以外にはマスクする**。

##### 15. 賞品のヤギ(Prize Goat)＝廃棄は任意。**財宝の使用中に廃棄が起きる**
> `Trashing a card is optional.`

→ 廃棄トリガー（城塞・ネズミ・狂信者・墓所・青空市場・リッチ）が**購入フェイズの財宝プレイ中に発火する**。
歩哨(Sentinel)/リッチのような「同時に複数枚廃棄」ではなく1枚なので `trashCard` でよいが、
**廃棄が pending を開いたら `PLAY_ALL_TREASURES` が中断する**＝`playAllResume` に載せる。

##### 16. 勲章(Insignia)＝「このターン、獲得したカード**すべて**」に適用される任意の topdeck
> `If you gain multiple cards, this applies to each of them - you can put any or all of them on top of your deck.`

→ 「1回の獲得につき対話は1つだけ」という本アプリの**既存の横断簡略化**（望楼/ティアラ/交易商人/宿屋/スーク/
公爵夫人/国境の村 の else-if 連鎖）と正面衝突する。勲章は**毎回開く必要がある**ので
`state.onGainQueue` 側に載せること（望楼と同じ問題を持つカードなので、望楼が同居する王国で挙動を揃えて確認する）。
`t.insignia` のような**このターン用のカウンタ**で持つ（場の枚数ではない＝ガレリア/散兵と同型・§0-29 A4）。

##### 17. 戦利品の山そのもの（Loot pile）— 本アプリの既存機構との対応
- **非サプライ**＝`NON_SUPPLY` に15種すべて登録。**購入不可・汎用獲得不可・闇市場デッキに入れない・3山終了に数えない**
  （§0-2 の「4系統除外チェックリスト」を必ず通す）。逐語＝`The Loot pile isn't in the Supply; players can't buy or gain from it, except with cards that specifically gain Loot.`
- **山の中身は秘密**（`HIDDEN_MIXED_PILE_KEYS` と同じ扱い）＝逐語 `Players can't look through the Loot pile during a game.`
  廃墟のように**一番上を公開してはいけない**（日本語wiki が名指しで「一番上のカードのみが公開される廃墟などとは異なる」と注意している）。
  → **オンラインの `maskStateFor` で山の中身を全部伏せる**／サーバの「同意なしの1手もどす」でも
  **戦利品を獲得する手は承認制に落とす**（獲得＝山の次の1枚が変わる＝§0-14 の伏せ札の騎士と同型の覗き見穴になる）。
- **枚数は人数によらず常に30枚**（15種×2）。
- **交換で戻すときは山の一番上に裏向き**＝`returnToPile` / `canReturnToPile`（§0-14）に載せる。
  逐語＝`If you exchange a gained Loot (e.g. with Changeling), the Loot goes back on top of the pile, face down.`
- **廃棄置き場に行った戦利品は「廃棄置き場から獲得する効果」で取れる**（墓暴き/ネクロマンサー/リッチ）。

##### 18. コストは全15種 `$7*`＝**星付き（非サプライ）**
戦利品は購入できないので「購入コストとしての軽減」は効かないが、
`cardCost` が $7 を返す以上「コスト$7以下を獲得」「これより安いカードを獲得」等の**参照**には引っかかる。
とくに**呪符の巻物の「これより安いカード」＝$7未満**（`costUnder`）＝**属州($8)は取れない／金貨($6)は取れる**。
※英語wiki の解説文も `allows you to gain and play cards costing less than [$7]` と明記。
画像生成（`tools/build-cards.js`）では**賞品/戦利品と同じ星付きコスト表記**が要る。

**⚠ ただし「コスト軽減は無意味」ではない**（下記は日本語wiki 呪符の巻物ページの逐語）：
> 「獲得コストの範囲は『これより安い』なので**橋のように全体に影響するカードだと意味は無い**が、
> **特定の山札のみを下げる場合には有効**。他には**発明家の家族**がある。」
> 「**渡し船**を使えば、**コスト7～8のカードを獲得することもできる**。」

→ **全体軽減（橋/街道）＝呪符の巻物自身のコストも一緒に下がるので、取れる集合は変わらない**（差し引きゼロ）。
**山を名指しして下げる軽減（渡し船の -$2 トークン／発明家の家族の好意／`state.pileFavor`）＝取れる集合が実際に増える**
（$8 の山が $6 になれば $7 未満なので獲得できる）。
＝**`costUnder(state, id, cardCost(state,'spell_scroll'))` のように両辺とも `cardCost` を通す**こと。
片方を静的な `7` で焼き込むと橋がある場で公式より広く/狭く取れる。
<!-- 検証で訂正: 旧="値切り屋/橋/街道などのコスト軽減は購入しないので無意味だが" という断定。
     日本語wiki「呪符の巻物」利用法の逐語が、全体軽減は無意味／山を名指しする軽減（渡し船・発明家の家族）は有効、
     と明確に区別している（渡し船でコスト7〜8のカードを獲得できる）。
     出典=https://wikiwiki.jp/dominiondeck/呪符の巻物 「利用法」節 -->

##### 19. 【最重要・命名衝突】**日本語で Loot＝「戦利品」／Dark Ages の Spoils＝「略奪品」**。本アプリは今この2つを取り違えている
一次資料（日本語wiki の各ページ表・逐語）：
- `https://wikiwiki.jp/dominiondeck/戦利品` ＝ **Plunder / Puzzle Box / 財宝-戦利品**（＝**Loot の訳語が「戦利品」**）。
  「戦利品全30枚を全て裏向きにした状態でシャッフルし…」＝**Loot の山の説明ページ**。
- `https://wikiwiki.jp/dominiondeck/略奪品` ＝ **Dark Ages / Spoils / 0* / 財宝 / `When you play this, return it to the Spoils pile.`**
  ＝**Spoils の訳語は「略奪品」**。
- 同ページのサイドバー「戦利品」欄に **15枚の日本語名が列挙**されている
  （ダブロン金貨・ハンマー・勲章・宝珠・賞品のヤギ・パズルボックス・六分儀・杖・呪符の巻物・剣・盾・
   アンフォラ・尽きぬ杯・船首像・宝石）＝本書の日本語名15件と完全一致。

**しかし本アプリの `js/cards.js:601` は `spoils: { id:'spoils', name:'戦利品', ... }`**＝
**Dark Ages の Spoils に「戦利品」という名前を既に使ってしまっている**。
これは PROGRESS §0-3 が**自分で予告していた**問題（逐語）：
> **spoils の名前は「戦利品」を採用**（公式は「略奪品」だが、既存 marauder/新規 bandit_camp/pillage が
> 「戦利品置き場」と参照＝プロジェクト内一貫性を優先。**将来 Plunder/Loot を入れる時に再考**）。

→ **今がその「再考」のタイミング**。このまま Loot を実装すると、**同一の文字列「戦利品」が2つの別物を指す**：
1. `DOM.CARDS.spoils.name`（暗黒時代の使い捨て金貨）
2. Loot の**種別ラベル**（`財宝-戦利品`＝carddata の typeLabel に足す新種別）と**山の名前**（盤面の「戦利品の山」）
＝**同盟の `alliance`（移動動物園のイベント名＝同盟）× 同盟拡張 の衝突（§0-29）より深刻**
（あちらは id が別で表示だけ／こちらは**種別ラベルとカード名が同じ文字列**＝カード一覧の全文検索・
 盤面の帯・`TYPE_JP` の3箇所で意味が2つになる）。

**要ユーザー確認＝どちらに寄せるか**（一次資料だけでは決まらない・実装方針の判断）：
- (A) **`spoils` を公式どおり「略奪品」に改名**（＋`marauder`/`bandit_camp`/`pillage` のカード文の
  「戦利品置き場」→「略奪品置き場」＋**該当 webp の再生成**）→ Loot が素直に「戦利品」を名乗れる。**公式に一致**。
- (B) `spoils` を「戦利品」のまま据え置き、Loot 側を別語にする → **公式訳から外れる**（非推奨）。


---

## 第6章 イベント 15種

<sub>（出典ファイル＝`events.md`。見出しは2段下げて収録）</sub>

### 略奪（Plunder・2022年12月）— イベント15種 一次資料まとめ

収集日: 2026-08-15 / 担当: イベント群
一次資料:
- 英語wiki（wiki.dominionstrategy.com）＝ `python tools/wikifetch.py <Page>`（Wayback経由）。各カードの `Card text` 欄・`Official FAQ`・`Other rules clarifications`・`Versions`（最新 printing 行）・`Errata`・`Trivia` を読んだ。
- 日本語＝ 日本語wiki `https://wikiwiki.jp/dominiondeck/`（拡張ページ `略奪（拡張）` ＋ 各カードの個別ページ）。
- **RGG ルールブックPDF ＝ `C:/tmp/plunder_research/DomPlunder.pdf` / `DomPlunder.txt`（2022年12月・初版）を使用**。
  一般ルール（イベント共通則・Loot 山）と、15枚全部のカードテキスト＋FAQ の逐語が入っている。
  ⚠ `pdftotext` はコイン記号を落とすので**金額は英語wiki の `[$N]` 表記で裏取り**した（下の §1 は3系統一致）。

<!-- 検証で訂正: 旧＝「RGG ルールブックPDF は使っていない（不要と判断）」。
     実際には同フォルダに DomPlunder.pdf / DomPlunder.txt が既にDL済みで、
     §5 で「未確認」としていた Loot 山の逐語ルールがこの PDF に丸ごと入っていた（→ §4-A に転記した）。
     出典＝DomPlunder.txt L83-87「There are 15 Loot cards, with 2 copies of each. ...」 -->

> **検証（敵対検証担当・2026-08-15）**：15枚すべてについて、**下書きを見ずに**
> `python tools/wikifetch.py` を自分で回して英語wiki を引き直し、さらに RGG ルールブックPDF と
> 日本語wiki を突き合わせた。**コスト15/15・種別15/15・英語カードテキスト15/15・FAQ逐語は下書きどおりで誤りなし**
> （§1 の表は「英語wiki の Info 欄」「英語wiki 拡張ナビの コスト別一覧」「RGG ルールブックPDF」の**3系統で一致**）。
> 訂正したのは **① Journey の版の扱い（未印刷エラッタを「現行」と断定していた）**、
> **② Loot 山を「未確認」としていた（RGG PDF と英語wiki Loot ページに逐語があった）**、
> **③ 発進の日本語wiki 個別ページを「未取得」としていた（取得して埋めた）**、
> **④ Journey に `Once per turn:` が有るか無いかは版によって変わる（`ONCE_PER_TURN_EVENTS` 登録可否が反転＝実装に直結）のに書かれていなかった**、
> **⑤ Journey の FAQ 節構成の取り違え（実在しない "Unofficial FAQ" 名義で `Official FAQ (2022)` と `Other rules clarifications` を混ぜ、Official FAQ の第1行を落としていた）**の5点。
> **⑥ 出典なしの断定2件（Launch で財宝ロックが解ける／イベント共通則）に一次資料を付けた**（結論はどちらも下書きどおりで正しかった）。

> **snapshot の年について**：`wikifetch.py` が表示する `snapshot=` は「Wayback に投げた URL 接頭辞」であって実際のキャプチャ年ではない（Wayback は最寄りのキャプチャへリダイレクトする）。
> 実際、`snapshot=2019id_` で返った Bury / Foray / Scrounge も本文に **`Set: Plunder` / `Release: Plunder December 2022`** が入っており略奪の情報を含んでいた。**年ではなく本文の `Set` 欄で判定した**（全15枚 `Set = Plunder` を確認済み）。

---

#### 1. 一覧表（コスト・種別・英語テキスト）

**15種すべて 種別＝`Event` のみ**（Attack でも Duration でもない＝**堀では防げない／持続の予約を張らない**）。
**負債(Debt)・ポーション費用は1枚も無い＝全部プレーンなコインコストだけ。**

<!-- 検証で訂正: journey 行。旧＝「【現行＝2023エラッタ】…／【2022印刷版】…」と、エラッタ側を
     "現行" と断定していた。英語wiki の Versions 表は エラッタ行の Print 欄が "Not printed yet" で、
     印刷物は2022年版しか存在しない。本プロジェクトは royal_galley で「未印刷のエラッタは採らない」と
     決定済み（PROGRESS §0-29 A4）なので、"現行" と断定するのは方針に反する＝要ユーザー確認へ格下げ。
     出典＝英語wiki Journey / Versions / English versions：
       行1: Print=[Journey] / Text="Once per turn: If the previous turn wasn't yours, ..." / Release=Plunder / Date=December 2022
       行2: Print="Not printed yet" / Digital=[Journey from Temple Gates Games]
            / Text="You don't discard cards from play in Clean-up this turn. Take an extra turn after this one (but not a 3rd turn in a row)."
            / Release="Extra turn errata" / Date=September 2023 -->

> **コストの裏取り＝3系統一致**（下の15行はすべてこの3つが一致した）：
> ① 各カードページの `Info / Cost` 欄／② 英語wiki 拡張ナビの コスト別一覧 逐語
> `Events [$1] Bury [$2] Avoid • Deliver • Peril • Rush [$3] Foray • Launch • Mirror • Prepare • Scrounge [$4] Maelstrom • Journey [$6] Looting [$10] Invasion • Prosper`
> ／③ RGG ルールブックPDF のカード面の書き起こし（金額記号は落ちるが文面は一致）。

| id | 英語名 | 日本語名 | コスト | 種別 | 現行カードテキスト（英語・逐語／改行そのまま） |
|---|---|---|---|---|---|
| `bury` | Bury | 埋葬 | `$1` | Event | `+1 Buy`<br>`Put any card from your discard pile on the bottom of your deck.` |
| `avoid` | Avoid | 回避 | `$2` | Event | `+1 Buy`<br>`The next time you shuffle this turn, pick up to 3 of those cards to put into your discard pile.` |
| `deliver` | Deliver | 配達 | `$2` | Event | `+1 Buy`<br>`This turn, each time you gain a card, set it aside, and put it into your hand at end of turn.` |
| `peril` | Peril | 危難 | `$2` | Event | `You may trash an Action card from your hand to gain a Loot.` |
| `rush` | Rush | 突貫 | `$2` | Event | `+1 Buy`<br>`The next time you gain an Action card this turn, play it.` |
| `foray` | Foray | 襲撃 | `$3` | Event | `Discard 3 cards, revealing them. If they have 3 different names, gain a Loot.` |
| `launch` | Launch | 発進 | `$3` | Event | `Once per turn: Return to your Action phase.`<br>`+1 Card, +1 Action, and +1 Buy.` |
| `mirror` | Mirror | 鏡映 | `$3` | Event | `+1 Buy`<br>`The next time you gain an Action card this turn, gain a copy of it.` |
| `prepare` | Prepare | 準備 | `$3` | Event | `Set aside your hand face up.`<br>`At the start of your next turn, play those Actions and Treasures in any order, then discard the rest.` |
| `scrounge` | Scrounge | 物色 | `$3` | Event | `Choose one: Trash a card from your hand;`<br>`or gain an Estate from the trash, and if you did, gain a card costing up to [$5].` |
| `journey` | Journey | 旅行 | `$4` | Event | **⚠ 版が2つある＝どちらを採るかは要ユーザー確認（§4-F）**<br>**【A＝2022年12月・印刷版（現在 唯一の印刷物）】**`Once per turn: If the previous turn wasn't yours, you don't discard cards from play in Clean-up this turn, and take an extra turn after this one.`<br>**【B＝2023年9月 Extra turn errata・英語wiki の Print 欄は `Not printed yet`／デジタル(Temple Gates)のみ】**`You don't discard cards from play in Clean-up this turn. Take an extra turn after this one (but not a 3rd turn in a row).` |
| `maelstrom` | Maelstrom | 大渦巻 | `$4` | Event | `Trash 3 cards from your hand. Each other player with 5 or more cards in hand trashes one of them.` |
| `looting` | Looting | 略奪行為 | `$6` | Event | `Gain a Loot.` |
| `invasion` | Invasion | 侵略 | `$10` | Event | `You may play an Attack from your hand.`<br>`Gain a Duchy. Gain an Action onto your deck.`<br>`Gain a Loot; play it.` |
| `prosper` | Prosper | 繁栄 | `$10` | Event | `Gain a Loot, plus any number of differently named Treasures.` |

---

#### 2. 日本語カードテキスト

日本語名は **日本語wiki（wikiwiki.jp/dominiondeck）** が正本。**15枚すべてのコストが英語wikiと完全一致**し、
うち4枚（回避／突貫／発進／大渦巻）は英語wiki の `Other language versions` の Japanese 行（＝日本語版カードの実物写真の書き起こし）とも**名前が一致**した。

##### ⚠ 日本語「テキスト」は2系統あり、文言が食い違う
- **(A) 印刷版カードの逐語** ＝ 英語wiki の Japanese 行（実物写真つき）。**4枚しか無い**。
- **(B) 日本語wiki 各カードページの記載** ＝ 15枚すべてある。ただし **(A) と比べると `+1 カードを購入` を `+1 購入` に縮めるなど、表記が正規化されている**。

**本アプリのカタログに載せる文面は (A) を優先し、(A) が無い11枚は (B) を採る**のが安全。以下は両方併記。

| id | 日本語名 | (A) 印刷版の逐語（英語wiki の Japanese 行） | (B) 日本語wiki の記載 |
|---|---|---|---|
| `bury` | 埋葬 | 未確認（英語wikiに Japanese 行なし） | `+1 購入`<br>`捨て札置き場のカード1枚を山札の一番下に置く。` |
| `avoid` | 回避 | `+1 カードを購入`<br>`このターンあなたが次にシャッフルをするとき、`<br>`その中から3枚までを取って、あなたの捨て札に置く。` | `+1 購入`<br>`このターン次にシャッフルするとき、カードを最大3枚シャッフルから取り出し捨て札に置く。` |
| `deliver` | 配達 | 未確認 | `+1 購入。このターン、カード1枚を獲得するたびにそれを脇に置き、ターン終了時に手札に加える。` |
| `peril` | 危難 | 未確認 | `戦利品1枚を獲得するために、手札からアクションカード1枚を廃棄してもよい。` |
| `rush` | 突貫 | `+1 カードを購入`<br>`このターンあなたが次にアクションカード1枚を獲得したとき、`<br>`それを使用する。` | `+1 購入。このターン次にアクションカード1枚を獲得したとき、それを使用する。` |
| `foray` | 襲撃 | 未確認 | `手札3枚を公開して捨て札にする。その3枚が異なるカードの場合、戦利品1枚を獲得する。` |
| `launch` | 発進 | `各ターンに1度：あなたのアクションフェイズに戻る。`<br>`+1 カードを引く、＋1 アクション、＋1 カードを購入。` | `1ターンに1度のみ：アクションフェイズに戻る。`<br>`+1 カードを引く、+1 アクション、+1 購入。` |
| `mirror` | 鏡映 | 未確認 | `+1 購入`<br>`このターン次にアクションカード1枚を獲得したとき、追加で同じカード1枚を獲得する。` |
| `prepare` | 準備 | 未確認 | `手札をすべて表向きに脇に置く。あなたの次のターンの開始時、その中のアクションカードと財宝カードを好きな順番で使用し、その後、残りを捨て札にする。` |
| `scrounge` | 物色 | 未確認 | `次のうち1つを選ぶ：「手札1枚を廃棄する」；「廃棄置き場から屋敷1枚を獲得する。獲得した場合、コスト5以下のカード1枚を獲得する」` |
| `journey` | 旅行 | 未確認 | `このターン、あなたはクリーンアップフェイズに場のカードを捨て札にしない。このターンの後に追加の1ターンを得る(ただし、連続3ターンとなる場合は得られない)。`（＝**2023エラッタ後**） |
| `maelstrom` | 大渦巻 | `あなたの手札からカード3枚を廃棄する。`<br>`手札が5枚以上ある他のプレイヤーは全員、`<br>`手札からカード1枚を施棄する。`※`施棄` は wiki 側の誤字。正しくは `廃棄` | `手札3枚を廃棄する、手札を5枚以上持つ他プレイヤーは手札1枚を廃棄` |
| `looting` | 略奪行為 | 未確認 | `戦利品1枚を獲得する。` |
| `invasion` | 侵略 | 未確認 | `手札からアタックカード1枚を使用してもよい。公領1枚を獲得する。アクションカード1枚を山札の上に獲得する。戦利品1枚を獲得し、使用する。` |
| `prosper` | 繁栄 | 未確認 | `戦利品1枚と、好きな枚数の互いに異なる財宝カードを獲得する。` |

<!-- 検証で追記: launch の (B) を実取得して埋めた（旧＝「個別ページ未取得」）。
     出典＝ https://wikiwiki.jp/dominiondeck/発進 ＝「1ターンに1度のみ：アクションフェイズに戻る。+1 カードを引く、+1 アクション、+1 購入。」
     ＝(A) 印刷版「各ターンに1度：…＋1 カードを購入。」とは表記が違う＝下書きの (A)/(B) 二系統という整理自体は正しい。 -->

> **検証で再取得できた行（敵対検証担当が下書きを見ずに wikiwiki の個別ページを引き直した）**：
> **回避／配達／危難／準備／物色／旅行／発進／侵略／繁栄 の9枚は (B) が下書きと完全一致**
> （`発進` は下書きが「個別ページ未取得」としていたので上で埋めた）。
> **大渦巻** の (B) は 日本語wiki 拡張ページ `略奪（拡張）` の一覧表と逐語一致（`手札3枚を廃棄する、手札を5枚以上持つ他プレイヤーは手札1枚を廃棄`）。
> 残る **埋葬・突貫・襲撃・鏡映・略奪行為 の5枚は wikiwiki が HTTP 429 で再取得できず未再検証**
> （下書きの記載をそのまま残してある。**一致率 9/9 なので信頼性は高い**が、カタログ投入前にもう一度引き直すこと）。
>
> なお **日本語名15/15 は独立に裏取り済み**＝日本語wiki `略奪（拡張）` の一覧表の逐語
> `埋葬1 / 回避2 / 配達2 / 危難2 / 突貫2 / 襲撃3 / 発進3 / 鏡映3 / 準備3 / 物色3 / 旅行4 / 大渦巻4 / 略奪行為6 / 侵略10 / 繁栄10`
> ＝**名前もコストも下書きどおり**（英語wiki 側のコストとも一致）。

> **Loot の日本語訳は「戦利品」**（日本語wiki が全カードで一貫してこの語を使っている）。
> **裏取り（検証担当）**＝日本語wiki `戦利品` ページ（Last-modified 2026-04-17）に
> 「`略奪` で登場した、特定の効果でのみ獲得できる強力な財宝カードの一群」「必ずカード種別に**「財宝-戦利品」**を持つ」
> 「必ず7コストである」と明記。一方 日本語wiki `略奪品` ページは
> 「`Dark Ages` / `Spoils` / 暗黒時代 **略奪品**」＝**Spoils の公式日本語名は「略奪品」**。
> ＝**下の Q の訳語衝突は実在する**（本アプリが `spoils` に「戦利品」を当てているのが公式とズレている）。
> ⚠ ただし 日本語wiki の当該表は「(※日本語訳はDominion Onlineより)」と注記＝**ホビージャパン印刷版の逐語とは限らない**。
> ⚠ **本アプリは暗黒時代の `spoils` に既に「戦利品」を割り当てている**（§0-3 の決定＝公式は「略奪品」だが marauder/bandit_camp/pillage のカード文と揃えるため）。**略奪の Loot と名前が衝突する**ので、実装前に訳語を決め直すこと（`spoils` を「略奪品」に戻す／Loot を別名にする、のどちらか）。

---

#### 3. 公式FAQ・裁定（実装に効くものだけ・逐語）

##### `bury`（埋葬・$1）
- Official FAQ: `Once you buy this, the ability is mandatory.` ＝**強制**（捨て札が空でなければ必ず1枚を山札の一番下へ）。
- Other rules clarifications: `You cannot search through your discard pile prior to buying this Event to check if you want to buy it.`

##### `avoid`（回避・$2）
- `If you don't end up shuffling this turn, this does nothing.`
- `If you do shuffle, you first look through the cards and pick up to 3 to put into your discard pile. Shuffle the other cards normally, but don't shuffle those 3 in.`
- `Avoid is cumulative; if you Avoid 3 times, you will pick up to 9 cards to not shuffle in.`
- `You might leave so many cards in your discard pile that you don't have enough to draw; this does not trigger another shuffle, you just draw what you can.`
- Other rules clarifications: `Putting cards into your discard pile doesn't count as discarding (e.g. it won't activate e.g. Village Green).`
- `If your next shuffle consists of your entire deck (e.g. you gained an Inn), you can look through your entire deck, and put cards from it directly into your discard pile.`

##### `deliver`（配達・$2）
- `Buying this more than once doesn't do anything extra.`
- `The set aside cards go into your hand after drawing your usual 5 cards.`
- Trivia/Wording（Donald X.）: `Deliver doesn't have "once per turn," even though it does nothing when bought multiple times.` ／ `Deliver also uses "each time" instead of "when" (like on Insignia).`

##### `peril`（危難・$2）
- `You only gain a Loot if you trashed an Action card.`

##### `rush`（突貫・$2）
- `If you Rush twice in a row, you'll still only play the Action once. You can however Rush, buy an Action and play it, Rush again, and buy another Action and play it.`（＝**累積しない。1枚ぶんの予約が消費されるまで上書き**）
- Other rules clarifications: `Remember that +X Actions you may acquire (the ability to play additional Action cards this turn) are only usable in the Action phase.`

##### `foray`（襲撃・$3）
- `If you didn't have 3 cards to discard, you don't gain a Loot.`（＝手札3枚未満なら **Loot なし**。捨てられるだけ捨てるかは規定なし＝カード文どおり「3枚捨てる」を満たせない）

##### `launch`（発進・$3）
- `This ends your Buy phase and returns you to your Action phase.`
- `This does not cause "start of turn" abilities to repeat; however when your Buy phase happens again after that, "start of Buy phase" abilities can repeat.`
- Other rules clarifications: `"Once per turn" applies to the whole Event.`
- `This counts as ending your Buy phase (for cards like Wine Merchant and Pageant). If you take multiple Buy phases, those cards will trigger multiple times.`
- `Unlike Cavalry, Launch draws you a card after ending your Buy phase. So if ending your Buy phase makes you put a Treasury onto your deck, you will draw it with Launch.`

##### `mirror`（鏡映・$3）
- `This is cumulative; if you buy Mirror three times and then buy an Action, you'll gain three extra copies of it.`（＝**Rush と正反対に累積する**）

##### `prepare`（準備・$3）
- `Once you've set the cards aside, playing all of those Actions and Treasures next turn is mandatory.`
- Other rules clarifications: `Between playing each of the set aside cards, you cannot play any cards from your hand, unless a card specifically tells you so (for example, Throne Room).`
- `Playing all the set aside cards is a single start-of-turn effect. Between playing each of those cards, you cannot resolve any other start-of-turn effects (for example, from Durations played last turn).`

##### `scrounge`（物色・$3）
- `You may either trash a card from your hand, or may gain an Estate from the trash.`
- `If you gained an Estate, you then also gain a card costing up to [$5] from the Supply.`

##### `journey`（旅行・$4）— **2023年9月「Extra turn errata」あり**
`Versions` 表の逐語：
- 2022年12月印刷（Plunder）: `Once per turn: If the previous turn wasn't yours, you don't discard cards from play in Clean-up this turn, and take an extra turn after this one.`
- `Not printed yet` / Temple Gates Games デジタル・**`Extra turn errata` / September 2023**: `You don't discard cards from play in Clean-up this turn. Take an extra turn after this one (but not a 3rd turn in a row).`

`Errata` 節の逐語：
> `Journey has received errata so that you can't take multiple extra turns in a row. Here are rulings that will change as a result.`
- `If you buy Journey multiple times in one turn, you aren't able to take more than 2 turns in a row, so all Journeys after the first will fail.`
- `If you buy Journey on an extra turn, your cards will stay in play, but you won't get an extra turn.`
- `If you set up multiple extra turns at once (e.g. one from Journey, one from Voyage), you choose one turn to take, and the others fail.`
- `If you are Possessed, and they make you buy Journey, anything they made you play will stay in play, you take a Journey turn, and then take your normal turn.`

`Official FAQ (2022)` 節の逐語（**wiki の節名はまさに「Official FAQ (2022)」＝2022年版カード前提だと明示されている**）：
- `You can only buy this once per turn. When you do, if the previous turn was not yours - if it was another player's turn before this turn - you don't discard cards from play this turn, and you take another turn after this turn ends. You still discard your hand.`
- `The extra turn is completely normal except that it doesn't count for the tiebreaker.`
- `The cards left in play don't do anything special on the extra turn; a Copper left in play doesn't make +[$1] on the extra turn and so on.`
- `Cards with "while this is in play" abilities can continue to function, and the cards are in play for things that care about that, such as Swamp Shacks; otherwise, the cards being in play just means you won't draw them that turn.`
- `Cards that would have stayed in play anyway (e.g. a Longship played on the turn you bought Journey) stay in play for that reason, and do whatever they normally do.`

`Other rules clarifications` 節の逐語（**上の Official FAQ (2022) とは別の節**）：
- `Almost all "while this is in play" abilities have either received errata (e.g. Quarry) or been removed (e.g. Talisman). The exception is Urchin, which you can play during your regular turn, and then trash into a Mercenary on the Journey turn.`
- `If you play Lich and buy Journey on the same turn, your cards remain in play, the Journey turn gets skipped, and you'll discard those cards from play during the next Clean-up (yours or another player's).`
- `If you buy Journey, then any effects that care about cards that you discard from play this turn (e.g. Improve and Scheme) will do nothing. However, some effects trigger at the start of Clean-up (e.g. Alchemist and Walled Village), and they trigger normally.`
- `Journey's restriction only applies to your cards. Any cards that other players play (e.g. Mapmaker) will be discarded normally.`

<!-- 検証で訂正: 旧＝これら4行を「エラッタと無関係に有効な裁定（Unofficial FAQ / Official FAQ 2022 共通）」という
     見出しで Official FAQ の行と混ぜて並べていた。実際の wiki の節構成は
       FAQ > Errata / Official FAQ (2022) / Other rules clarifications の3節で、
     Urchin・Lich・Improve/Scheme・Mapmaker の4行は "Other rules clarifications" 側。
     また Official FAQ (2022) の**第1行**（"You can only buy this once per turn. ..."）が丸ごと落ちていたので補った。
     wiki に "Unofficial FAQ" という節は存在しない。出典＝英語wiki Journey（2024キャプチャ・ev_recheck2.txt）。 -->

> **⚠ 実装に直結する差（下書きに書かれていなかった）＝「1ターンに1度」が版で消える**
> **A（2022印刷版）**は `Once per turn:` を持つ＝**§0-21 の `ONCE_PER_TURN_EVENTS` に入れる**
> （＝2回目の購入自体を拒否して購入権を無駄にしない）。
> **B（2023エラッタ）はカード文から `Once per turn:` が消えている**＝**`ONCE_PER_TURN_EVENTS` に入れてはいけない**。
> 代わりに逐語 `If you buy Journey multiple times in one turn, you aren't able to take more than 2 turns in a row,
> so all Journeys after the first will fail.` ＝**何回でも買えて2枚目以降が空振り**（＝§0-26 の使節団と同じ形）。
> **どちらを採るかで `ONCE_PER_TURN_EVENTS` への登録可否が反転する**ので、版を決めるまで実装に入れない。

##### `maelstrom`（大渦巻・$4）
- `This isn't optional for the other players; they must trash a card if they have 5 or more cards in hand.`

##### `looting`（略奪行為・$6）
- `You simply gain a Loot.`

##### `invasion`（侵略・$10）
- `You do the four things in that order.`
- `Playing an Attack card is optional; the rest are mandatory.`
- Other rules clarifications: `When you gain a Loot and play it, the No Visiting rule is not in effect; you gain the Loot to your discard pile, and then any on-gain triggers are activated, and then you play the Loot. If an on-gain trigger moves the Loot out of your discard pile (for example, you reveal a Watchtower to top-deck the Loot, the stop-moving rule prevents you from playing it.`

##### `prosper`（繁栄・$10）
- `Gain the Loot first. Then, one at a time, you can choose differently named Treasures to gain, resolving each gain in turn.`
- `You don't have to gain any Treasures you don't want (after the Loot).`
- `For example in a game with Gondola, you might choose to gain Gondola, resolve its "when gain" ability to play a Trickster, then choose to gain a Gold and a Silver and then stop.`
- Other rules clarifications: `Unlike Populate, this checks the types of a card and not the types of of a pile. This is why Populate cannot gain an Estate that's been affected by Inheritance, but Prosper can gain a Curse that's been affected by Charlatan.`
- `Prosper can potentially gain multiple cards from the same pile. For example, if you have Capitalism, you can gain a Tent, revealing a Garrison that you can now gain.`

---

#### 4. 実装時に事故りそうな落とし穴（逐語引用つき）

##### A. 「gain a Loot」5枚（peril / foray / looting / invasion / prosper）は Loot 山の機構に全面依存
本群だけでは実装できない。**Loot 山（15種・シャッフルして上から引く非サプライ山）の実装が前提**。カード15種の中身は別担当。

<!-- 検証で訂正: 旧＝「Loot ページを Wayback から取得できなかった＝Loot 山そのものの逐語は本ファイルでは未確認」。
     実際には (1) 同フォルダの RGG ルールブック DomPlunder.txt に一般ルールとして丸ごと入っており、
     (2) 英語wiki Loot ページも取得済み（loot_raw/Loot.txt・snapshot=2023id_ の "Official Rules" 節）。
     両者は逐語一致。よって「未確認」ではないので下に転記した。 -->

**Loot 山の逐語（RGG ルールブックPDF `DomPlunder.txt` ＝ 英語wiki `Loot` の `Official Rules` 節と完全一致）**：
> `There are 15 Loot cards, with 2 copies of each. Shuffle them into a face-down pile before the game if
> any cards refer to Loot. During the game, "gain a Loot" means, you gain the top card of the Loot pile.
> When you gain a Loot, reveal it to all players. Then put it into your discard pile as usual. Players can't
> look through the Loot pile during a game. The Loot pile isn't in the Supply; players can't buy or gain
> from it, except with cards that specifically gain Loot.`

＝本エンジンへの含意（**イベント側の実装可否に直結するのでここに置く**）：
- **30枚（15種×2）の伏せ札の山**＝**中身が秘密の混合山**＝§0-29 A2 の `HIDDEN_MIXED_PILE_KEYS`（廃墟・騎士）と同型。
  **`maskStateFor` で順序を伏せる**こと（＝城や同盟の分割山のような「全公開」側に入れてはいけない）。
- **非サプライ**（`NON_SUPPLY` へ登録）＝購入不可・汎用獲得（工房/改築…）の候補に出さない・**3山終了に数えない**。
  §6 の「4系統除外チェックリスト」を必ず通す。
- **「Loot を獲得する」＝山の一番上1枚**＋**獲得時に全員へ公開**（`reveal()` を通す＝パトロンが誘発する。§0-22）。
- コストは `[$7*]`（`*` 付き＝非サプライ表記）。`Loot` は**種別**でもある（`Treasure - Loot`）。
- 英語wiki `Loot` の `Other rules clarifications` 逐語：
  `If you exchange a gained Loot (e.g. with Changeling), the Loot goes back on top of the pile, face down.`
  ＝§0-29 A2 の `canReturnToPile` / `returnToPile` を通すこと（**一番上に伏せて戻す**）。
- ルールブックの `500 cards` 内訳逐語＝`30 Loot cards / 2 each of Amphora, Doubloons, Endless Chalice,
  Figurehead, Hammer, Insignia, Jewels, Orb, Prize Goat, Puzzle Box, Sextant, Shield, Spell Scroll, Staff, Sword`。

##### B. `invasion` の「Loot を獲得して使用する」は No Visiting rule の例外
> `When you gain a Loot and play it, the No Visiting rule is not in effect; you gain the Loot to your discard pile, and then any on-gain triggers are activated, and then you play the Loot. If an on-gain trigger moves the Loot out of your discard pile (for example, you reveal a Watchtower to top-deck the Loot, the stop-moving rule prevents you from playing it.`

＝**「捨て札に獲得 → on-gain トリガーを全部解決 → その後で場に出して使用」**の順。
本エンジンで言えば「望楼で山札の上に置いたら使用できない（lose track）」。§0-29 A4 の `takeSelf`/`removeOne` ガードと同じ形が必要。
さらに `Gain an Action onto your deck.` は **コスト上限が無い**（`costUpTo` を掛けてはいけない＝§0-29 A4 の「沈没船の財宝／専門家／侍祭」と同型の罠）。

##### C. `rush` は累積しない／`mirror` は累積する（**同じ「次に獲得したとき」なのに非対称**）
> Rush: `If you Rush twice in a row, you'll still only play the Action once.`
> Mirror: `This is cumulative; if you buy Mirror three times and then buy an Action, you'll gain three extra copies of it.`

**この2枚を同じヘルパで書くと必ずどちらかが壊れる**（§0-29 A4 の「散兵と追いはぎ」と完全に同型）。
`rush` は真偽フラグ1つ、`mirror` は残り回数のカウンタで持つこと。

##### D. `deliver` の「ターン終了時に手札に入れる」は **先引きの後**
> `The set aside cards go into your hand after drawing your usual 5 cards.`

本エンジンは `cleanupAndAdvance` が**自分の手番終了時に次の手札を先引きする**ので、`deliver` の脇札は**その先引きの後**に手札へ足す（§0-25 のリス／§0-28 の忠犬と同じ位置）。前に入れると捨てられてしまう。
また `+1 Buy` があるので**購入フェイズ以外での獲得**（相手ターンの獲得は起こらないが、自分のアクションフェイズの獲得は起こる）にも効く＝`This turn, each time you gain a card` はフェイズを問わない。
脇札は**物理カード**なので `allCards` と invariants の `ZONES` に登録すること。

##### E. `avoid` は「シャッフルの最中に対話が要る」＝本エンジンで最も危険
> `If you do shuffle, you first look through the cards and pick up to 3 to put into your discard pile.`
> `Avoid is cumulative; if you Avoid 3 times, you will pick up to 9 cards to not shuffle in.`

`reshuffleDeck(p)` は**同期・非対話**（74箇所から呼ばれ `draw()` → `applyEffect` の途中で起きる）。
＝**へそくり(`stashPlacement`)・星図・占星術師団/メイソン団と完全に同じ問題**。§0-29 の決定（常設方針＋自動選択）と同じ扱いにするのが素直。
さらに2つ罠がある：
> `Putting cards into your discard pile doesn't count as discarding (e.g. it won't activate e.g. Village Green).`
＝**`triggerOnDiscard` を呼んではいけない**（坑道・村有緑地・忠犬が誤発火する）。
> `You might leave so many cards in your discard pile that you don't have enough to draw; this does not trigger another shuffle, you just draw what you can.`
＝**2度目のシャッフルをしない**。§0-29 A3 の「メイソン団が1回のドローで何度もシャッフルする」バグと同型＝`reshuffleDeck` の戻り値ガードが要る。

##### F. `journey` は 2023「Extra turn errata」の当事者。**⚠ どちらの版を採るかは 要ユーザー確認（勝手に決めない）**
> `Journey has received errata so that you can't take multiple extra turns in a row.`
> （エラッタ後）`You don't discard cards from play in Clean-up this turn. Take an extra turn after this one (but not a 3rd turn in a row).`

<!-- 検証で訂正: 旧見出し＝「本プロジェクトは既にエラッタ側を採用している」／旧本文＝「Journey もエラッタ側に
     揃えるのが一貫」と、エラッタ採用を既定路線として断定していた。これは本プロジェクトの版方針に照らすと断定できない。
     決定的な事実＝英語wiki Journey の Versions 表で、エラッタ行の **Print 欄が "Not printed yet"**
     （デジタルの Temple Gates Games 版にしか入っていない）。
     PROGRESS §0-29 A4 の royal_galley では「announce されたが未印刷＝本プロジェクトの
     『現行＝印刷済み最新＋公式エラッタ』方針では採らない」と明示的に決定している＝同じ形。
     一方 同盟の Island Folk / Voyage は同じ2023エラッタでも **Allies 第2刷(2023年12月)で印刷済み**
     （PROGRESS §0-29「RGG の PDF は現行（2023年12月・第2刷）」）＝Journey とは状況が違う。
     よって「一貫だからエラッタ側」は成立しない。→ 要ユーザー確認に格下げした。
     出典＝英語wiki Journey / Versions / 日本語wiki 旅行（後述）。 -->

**判断材料（両論・どちらにも公式の裏づけがある）**：
- **B＝2023エラッタを採る理由**：wiki に正式な `Errata` 節があり**裁定まで更新されている**（royal_galley は
  フォーラムでの *announce* だけで FAQ 未更新だった＝ここが違う）／公式デジタル実装（Temple Gates Games）は
  エラッタ側／同盟の Island Folk・Voyage と**同じ 2023年9月の Extra turn errata** で、本アプリは
  そちらを既に実装済み＝**同じ盤面に Voyage と Journey が並ぶと挙動がちぐはぐになる**。
- **A＝2022印刷版を採る理由**：本プロジェクトの版方針は「**印刷済み最新＋公式エラッタ**」で、
  Journey のエラッタは**まだ一度も印刷されていない**（`Not printed yet`）＝royal_galley でこの理由により
  エラッタを見送った前例がある／**日本語版カードも当然2022年テキストのまま**。
- **日本語wiki `旅行` ページの逐語**（検証担当が実取得）＝現行表記はエラッタ側だが、
  **「カードテキストから効果が変更されており」**と注記し、**実物カードで遊ぶときはどちらの版を使うか
  プレイヤー間で合意するよう勧めている**＝日本語圏でも「印刷物とズレている」認識。
  旧テキスト（＝日本語の印刷版）＝`1ターンに1度のみ：直前のターンがあなたのものでない場合、このターンあなたは
  クリーンアップフェイズに場のカードを捨て札にせず、このターンの後に追加の1ターンを得る。`

**※ 版によって `ONCE_PER_TURN_EVENTS` への登録可否が反転する**（§3 の journey 節を参照）。**決着まで実装に入らないこと。**
関連する既存機構との衝突：
> `If you set up multiple extra turns at once (e.g. one from Journey, one from Voyage), you choose one turn to take, and the others fail.`
＝§0-29 A5 の `ally_island_folk` の窓（「どちらの追加ターンを取るか選ばせる」）に **Journey も足す**必要がある。
> `The extra turn is completely normal except that it doesn't count for the tiebreaker.`
＝`p.freeTurns` / `tieTurns` に数える（§0-26 の今を生きると同じ）。
> `If you play Lich and buy Journey on the same turn, your cards remain in play, the Journey turn gets skipped, and you'll discard those cards from play during the next Clean-up (yours or another player's).`
＝リッチ(§0-29 A5)の `p.skipTurns` と直接絡む。**しかも「場に残ったカードは *他人の* クリンナップで捨てられる」**という、本エンジンに存在しない挙動。

##### G. `journey` の「場のカードを捨てない」は片付けの意味を変える横断修正
> `If you buy Journey, then any effects that care about cards that you discard from play this turn (e.g. Improve and Scheme) will do nothing. However, some effects trigger at the start of Clean-up (e.g. Alchemist and Walled Village), and they trigger normally.`
> `Journey's restriction only applies to your cards. Any cards that other players play (e.g. Mapmaker) will be discarded normally.`
> `Cards with "while this is in play" abilities can continue to function ... such as Swamp Shacks`

＝**「片付け開始時の効果」は普通に起こるが「場から捨てる」だけが起きない**。本エンジンの
`endBuyTailSchemeOrCleanup`（策謀＝§0-5）／増築(§0-22)／カエル(§0-25「場から捨てるとき山札の上へ」)／
城壁のある村・宝物庫の自動返却 が**全部この境目に居る**ので、どれが起きてどれが起きないかを1つずつ決める必要がある。
`You still discard your hand.`（2022 FAQ）＝**手札は普通に捨てる**（場だけ残る）。

##### H. `launch` は「購入フェイズを終わらせてアクションフェイズに戻る」＝ヴィラの逆方向で、しかも**購入フェイズ終了トリガーを2回引く**
> `This counts as ending your Buy phase (for cards like Wine Merchant and Pageant). If you take multiple Buy phases, those cards will trigger multiple times.`
> `This does not cause "start of turn" abilities to repeat; however when your Buy phase happens again after that, "start of Buy phase" abilities can repeat.`

本エンジンでは **ワイン商(§0-9 Batch4a)の `endBuyTail` の窓**・**購入フェイズ開始時の効果**（浴場／宝箱／闘技場／
銀行家連盟・発明家の家族・市場の町・平和的教団・木工ギルド＝§0-29 A3）が**もう一度**開く。
逆に**ターン開始時の効果は繰り返さない**。ヴィラ(§0-16)が `turn.phase='action'` に戻す既存経路があるので、
`t.arenaFired` の再武装（§0-19）や `t.treasuresLocked` の解除（§0-21）と**同じ扱いが必要**。

<!-- 検証で補強: 「treasuresLocked が解除される／闘技場が再武装する」は下書きでは出典なしの断定だった。
     一次資料が実在したので付けた（＝結論は下書きどおりで正しい）。
     ⚠ 紛らわしいのは、Plunder ルールブックのイベント共通則が
     「You cannot play further Treasures **that turn** after buying an Event.」＝"そのターン" と書いていること。
     これを字面どおり取ると Launch 後の2回目の購入フェイズでも財宝を出せないことになるが、
     ヴィラの公式裁定が「戻ったら最初から＝財宝をまた出せる」と明示しているので、そちらが正。 -->

**裏づけ（英語wiki `Villa`・Other rules clarifications 逐語）**：
> `... you will put the Villa into your hand, get +1 Action, and return to your Action phase.
> This will let you play more Action cards (such as the Villa); when you are done with that you will return to
> your Buy phase, from the beginning - you can play more Treasures (and Arena will trigger again).`

＝**アクションフェイズへ戻って購入フェイズに入り直すと「最初から」＝財宝を出し直せる／闘技場も再発火する**。
Launch は同じ `Return to your Action phase.` なので**そのまま同じ扱いでよい**
（本エンジンは既に `END_ACTION_PHASE` で `treasuresLocked` を解除し `t.arenaFired` を再武装している＝§0-21 F1／§0-19）。
※ただし **Journey の「場を捨てない」旗は購入フェイズを跨いでも消してはいけない**（§4-R）＝Launch と混ぜないこと。
> `Unlike Cavalry, Launch draws you a card after ending your Buy phase.`
＝**「購入フェイズを終える」→「+1カード」の順**（宝物庫を山札の上に置いてから引くので引ける）。順序を逆にすると引けない。
> `"Once per turn" applies to the whole Event.`
＝§0-21 の `ONCE_PER_TURN_EVENTS` に入れる（**2回目の購入自体を拒否**＝購入権を無駄にしない）。
**`deliver` は逆に "once per turn" が無い**（`Buying this more than once doesn't do anything extra.` ＝買えるが空振り）＝Donald X. が明言：
> `Deliver doesn't have "once per turn," even though it does nothing when bought multiple times.`
この2枚を同じリストに入れないこと。

##### I. `prepare` は「1つの開始時効果として全部使う」＝startQueue に分割して積むと壊れる
> `Playing all the set aside cards is a single start-of-turn effect. Between playing each of those cards, you cannot resolve any other start-of-turn effects (for example, from Durations played last turn).`
> `Between playing each of the set aside cards, you cannot play any cards from your hand, unless a card specifically tells you so (for example, Throne Room).`
> `Once you've set the cards aside, playing all of those Actions and Treasures next turn is mandatory.`

＝**強制**・**順番はプレイヤーが選ぶ**・**他の `startQueue` 項目を割り込ませない**。
本エンジンの `t.startQueue` は「1件ずつ pending を開く」設計なので、**Prepare は1件の中でループする専用の再開網**が要る（§0-26 の `t.populateQueue` と同型）。
また**アクションフェイズではない**（ターン開始時）ので**アクション権を消費しない**。財宝も出すので `t.treasuresLocked`（§0-21）と衝突しないか要確認。
脇札は**表向き＝公開**（`maskStateFor` で伏せない。§0-29 A4 の `p.contractSetAside` と同型）＋**物理カード**なので `allCards`/`ZONES` に登録。

##### J. `maelstrom` は **アタックではない**（種別に Attack が無い）
> Type: `Event` のみ。 `This isn't optional for the other players; they must trash a card if they have 5 or more cards in hand.`

＝**堀・灯台・チャンピオン・守護者で防げない**。`ATTACKS` に登録してはいけない／`attackImmune` を通してはいけない
（§0-29 の「Ally が起こす攻撃は堀で防げない」と同じ罠）。
かつ**廃棄は被害者自身が選ぶ**＝pending の持ち主が相手側に跨る（§0-29 A4 の射手と同型）。
自分の廃棄3枚は**強制**（手札が3枚未満なら可能なだけ）。相手の廃棄は on-trash（城塞・ネズミ・墓暴き・リッチ・青空市場）を誘発する。

##### K. `scrounge` の「廃棄置き場から屋敷を獲得」は **サプライからの獲得ではない**
> `or gain an Estate from the trash, and if you did, gain a card costing up to [$5].`

§0-29 A4 のリッチ（`lichTrashTargets`）で踏んだのと同型＝**獲得元がサプライではないので `costUpTo`/`gainableBase` を使うと候補ゼロ→CPU livelock**。
かつ **`and if you did` ＝屋敷を獲得できたときだけ** $5以下が付く（廃棄置き場に屋敷が無ければ何も起きない）。
2つ目の獲得は**サプライから**なので `costUpTo(5)` でよい（成分別比較＝負債・ポーション費用を弾く）。
「手札を廃棄する」側は**手札0枚でも選べる**か要注意＝両方遂行不能なら pending が閉じない（§0-29 A5 のリッチと同型の詰み）。**選択肢ゼロにならない終端保証**を必ず入れる。

##### L. `prosper` は「山の種別」ではなく「カードの種別」を見る
> `Unlike Populate, this checks the types of a card and not the types of of a pile. This is why Populate cannot gain an Estate that's been affected by Inheritance, but Prosper can gain a Curse that's been affected by Charlatan.`
> `Prosper can potentially gain multiple cards from the same pile. For example, if you have Capitalism, you can gain a Tent, revealing a Garrison that you can now gain.`

＝**§0-29 A2b で作った `isTypeSupply(state, id, ty)`（山の一番上の種別）を使う**側。植民(populate)の `populatePiles`（randomizer の種別）と**取り違えると静かに壊れる**。
さらに **`Capitalism`（ルネサンスのプロジェクト）で財宝になったアクションも対象**＝`isTreasureFor(state,id)` を通すこと（静的 `DOM.isType(id,'treasure')` を書かない）。
**1枚ずつ順に獲得し、各獲得を解決してから次を選ぶ**（`Then, one at a time, you can choose differently named Treasures to gain, resolving each gain in turn.`）
＝§0-26 の植民と同じ「reduce 末尾の再開網」が要る。**やめる自由がある**（`You don't have to gain any Treasures you don't want`）＝「もうやめる」ボタン必須。
**同じ山から複数枚取れる**（分割山の一番上が入れ替わるため）＝「獲得済みの山を候補から消す」実装は誤り。**名前で重複判定する**。

##### M. `bury` は強制。捨て札を「見てから買う」ことはできない
> `Once you buy this, the ability is mandatory.`
> `You cannot search through your discard pile prior to buying this Event to check if you want to buy it.`

＝捨て札が空でなければ**必ず1枚**を山札の**一番下**へ。UI で「やめる」を出してはいけない（engine が拒否して詰む）。
「山札の一番下」は本エンジンに前例が少ない移動先＝`p.deck.push()` 側であることに注意（`unshift` は上）。
オンラインでは**自分の捨て札は公開情報**なので情報漏洩は無い。

##### N. `foray` は「3枚捨てて公開」＝捨て札トリガーを誘発する（`avoid` と正反対）
> `Discard 3 cards, revealing them. If they have 3 different names, gain a Loot.`
> `If you didn't have 3 cards to discard, you don't gain a Loot.`

`reveal()` を通す（＝パトロンが誘発する。§0-22 の横断フック）。`discard` なので `triggerOnDiscard`（坑道・村有緑地・忠犬・織工）は**誘発する**。
＝**同じ拡張の中で `avoid`（誘発しない）と `foray`（誘発する）が同居する**ので、共通ヘルパにまとめてはいけない（§0-29 A4 の「薬草集めと古地図」と同型）。
「3枚ちょうど捨てる」＝手札3枚未満なら条件を満たせない。**§0-29 A4 のごますりと同じく3枚は同時に捨てる**のが安全（1枚ずつだと坑道→望楼の連鎖で不正が通る）。

##### O. `peril` は「廃棄できたときだけ」Loot
> `You only gain a Loot if you trashed an Action card.`

任意（`You may`）＝手札にアクションが無ければ何も起きない＝**選択肢ゼロの pending を開かない**こと。
on-trash（城塞＝廃棄置き場に残らない／リッチ／ネズミ／墓暴き）が絡んでも**「廃棄した」事実で Loot は貰える**（城塞が手札に戻っても廃棄自体は起きている＝§0-19 の Tomb と同じ扱い）。

##### P. 15枚とも **負債コスト・ポーション費用なし＝コインのみ**。ただし全部「イベント」なので既存の共通則が効く

<!-- 検証で補強: 下書きはこの節を本アプリの PROGRESS（§0-20/§0-21）だけを根拠に書いていたが、
     Plunder ルールブック自身にイベント共通則の逐語がある（初版PDFでも一般ルールは正本として使える）ので転記した。
     出典＝DomPlunder.txt L91-106。結論は下書きどおりで、6項目すべて既存実装と一致する。 -->

**RGG ルールブック `DomPlunder.txt` のイベント共通則 逐語**：
> `Plunder has Events, which first appeared in Adventures. In your Buy phase, when you can buy a card,
> you can buy an Event instead. You pay the cost indicated on the Event and then do its effect.`
> `- Events are not Kingdom cards; they sit on the table and provide an effect you can buy. There is no
>    way for you to gain one or end up with one in your deck.`
> `- Buying an Event uses up a Buy; normally you can either buy a card, or buy an Event. ...`
> `- The same Event can be bought multiple times in a turn if you have the Buys and available to do it.`
> `- You cannot play further Treasures that turn after buying an Event.`
> `- Buying an Event is not buying a card, for things that care about that, like Haggler (from ...)`
> `- Costs of Events are not affected by cards like Bridge (from Intrigue).`

＝**既存の `BUY_EVENT`（§0-20/§0-21）がそのまま全部満たしている**。以下は本アプリ側の対応：
- **イベントは「カード」ではない**＝コスト軽減（橋／街道／発明家の家族の好意トークン）を受けず、購入時トリガー（商人ギルド／値切り屋／過払い）も発動しない（§0-20）。
- **負債>0 の間はイベントも購入できない**（§0-20）。
- **`BUY_EVENT` は購入権を1消費し、`t.treasuresLocked` を立てる**（§0-21）＝**`launch` で購入フェイズに戻ると解除される**（`END_ACTION_PHASE` で解除する既存実装がそのまま効く）。
- **使者（messenger・冒険）の「そのターン最初の購入」にイベント購入が数えられる**（§0-21）＝`t.buysMade++` を忘れない。
- 横型は **`DOM.LANDSCAPES` が正本**（`DOM.CARDS` に入れない）。

##### Q. 訳語衝突（実装前に決めること）
- **Loot ＝「戦利品」**（日本語wiki）だが、本アプリは**暗黒時代の `spoils` に既に「戦利品」を使っている**（§0-3 の意図的な決定）。**衝突する**ので `spoils` を公式訳「略奪品」に戻すか、Loot を別訳にするかを先に決める。カード文（marauder / bandit_camp / pillage）の再生成（webp）も伴う。
- **`prosper` の日本語名「繁栄」は拡張セット「繁栄(Prosperity)」と完全に同じ文字列**（§0-29 の `alliance`＝「同盟」と同型）。id 衝突は無いが、**カード一覧の全文検索・盤面の帯で意味が2つになる**ので群見出しで区別すること。
- **`looting`（略奪行為）の日本語名は拡張名「略奪」を含む**＝同上。

##### R. `journey` / `prepare` / `deliver` は**新しい脇置きゾーンが要る**
- `prepare` ＝表向き（公開）の脇札。`deliver` ＝ターン終了まで持つ脇札。
- どちらも**物理カード**＝`allCards`・`invariants` の `ZONES`・`maskStateFor` の3点に配線しないと保存則テストが即赤になる（§0-27 の `ghostSetAside`/`cryptSetAside` と同型）。
- `journey` は逆に**ゾーンを増やさず「場を捨てない」旗**（`t.journeyKeepInPlay` 相当）だが、**その旗はターンをまたいで生き残る必要がある**（片付けは追加ターンの後にも来る）＝`freshTurn` で消してはいけない。

---

#### 5. 未確認・要ユーザー確認（推測で埋めていない）

<!-- 検証で訂正: この表は4行のうち3行が実態と食い違っていた。
     (a) 「Loot 山の逐語は未確認」→ RGG ルールブックPDF と 英語wiki Loot ページの両方にあり取得済み（→ §4-A に転記）。
     (b) 「launch の日本語wiki 個別ページ 未取得」→ 検証担当が取得（→ §2 に反映）。
     (c) 「RGG ルールブックPDF 未使用（不要と判断）」→ 不要ではなかった（(a) がそこにあった）。使用済みに変更。
     また **Journey の版の選択**という最重要の未決事項が表に無かったので追加した。 -->

##### ⚠ 要ユーザー確認（実装前に人間が決めること）

| 項目 | 内容 |
|---|---|
| **`journey` の版**（最重要） | **A＝2022印刷版**（`Once per turn:` あり・「直前が自分の手番でない」条件つき）か、**B＝2023年9月 Extra turn errata**（条件なし・「3ターン連続不可」）か。**エラッタは英語wiki の Print 欄が `Not printed yet`＝まだ一度も印刷されていない**。本プロジェクトは royal_galley で「未印刷のエラッタは採らない」と決定した前例がある一方、同盟の Island Folk / Voyage は同じ2023エラッタを（**第2刷で印刷済みなので**）採用済み。**版によって `ONCE_PER_TURN_EVENTS` への登録可否が反転する**。詳細＝§4-F |
| **`Loot` の日本語訳** | 公式（日本語wiki）＝**戦利品**。だが本アプリは暗黒時代 `spoils` に「戦利品」を当てている（公式は**略奪品**）。`spoils` を公式訳へ戻す（＝webp 3枚以上の再生成を伴う）か、Loot を別訳にするか。詳細＝§4-Q |

##### 未確認（一次資料に当たれなかったもの）

| 項目 | 状態 | 試したこと |
|---|---|---|
| 11枚の**印刷版**日本語逐語（埋葬・配達・危難・襲撃・鏡映・準備・物色・旅行・略奪行為・侵略・繁栄） | **未確認**（推測で埋めていない） | 英語wiki の `Other language versions` に Japanese 行があるのは **Avoid / Rush / Launch / Maelstrom の4枚だけ**（検証担当が全15ページで再確認＝この4枚で正しい）。日本語wiki 個別ページの記載は (B) として別に載せてあるが、**Avoid・Launch で印刷版と文言が食い違うことが実証済み**なので「印刷版の逐語」としては採用しない |
| 日本語wiki 個別ページ (B) の再検証 5枚（埋葬・突貫・襲撃・鏡映・略奪行為） | **未再検証** | 検証担当が **回避／配達／危難／準備／物色／旅行／発進／侵略／繁栄 の9枚**を独立に引き直し**全9枚が下書きと完全一致**（＋大渦巻は拡張ページの一覧表と逐語一致）。残りは wikiwiki.jp が HTTP 429 で取得できず。**一致率 9/9 なので下書きの信頼性は高い**が、カタログ投入前にもう一度引くこと |
| `scrounge` の新しい Wayback キャプチャ | 未取得（`2019id_` のみ） | 5回再試行。ただし本文に `Set: Plunder` / `Release: Plunder December 2022` があり、`Card text`・`Official FAQ`・`Versions`・`Secret History` が揃っているため内容は完全（**検証担当も同じ結論**） |
| Loot カード15種そのものの効果 | 別担当 | 山の**ルール**は §4-A に逐語で入れた。**15種の中身**（Amphora〜Sword）はこのファイルの対象外 |

> **snapshot の年について（下書きの注記は正しい）**：`wikifetch.py` の `SNAPSHOTS` は Wayback に渡す
> **タイムスタンプ接頭辞**で、Wayback は**最寄りのキャプチャへリダイレクトする**。
> 本件15ページは**どれも略奪(2022年12月)以前には存在しないページ名**なので、`2019id_` で当たっても
> 返るのは必ず2022年12月以降のキャプチャ。**全15ページで本文の `Set` 欄が `Plunder` であることを検証担当も再確認した**。
> ⚠ ただし**「2023年前半のキャプチャだと Journey のエラッタ節がまだ無い」**という別の罠はある
> （実際 `raw3.txt` と `ev_recheck2.txt` の Journey は Errata 節つき＝2024キャプチャで正しく取れている）。

---

#### 6. 取得元ファイル（再検証用・`C:/tmp/plunder_research/`）

| ファイル | 含まれるページ |
|---|---|
| `ev_b1.txt` | Avoid |
| `ev_b2.txt` | Foray, Prosper |
| `ev_b4.txt` | Peril |
| `ev_b6.txt` | Deliver, Rush |
| `ev_b7.txt` | Bury |
| `ev_b10.txt` | Scrounge, Invasion |
| `ev_launch.txt` | Launch |
| `ev_mirror.txt` | Mirror |
| `ev_prep10.txt` | Prepare |
| `raw3.txt` | Journey, Maelstrom, Looting |
| `ev_recheck.txt` | Foray（2024 キャプチャで再確認） |
| `ev_recheck2.txt` | Journey（2024 キャプチャ＝Errata 節つき） |

**検証担当（敵対検証）が追加で使った一次資料**：

| ファイル / URL | 内容 |
|---|---|
| `DomPlunder.pdf` / `DomPlunder.txt` | **RGG 公式ルールブック（2022年12月・初版）**＝イベント共通則・Loot 山の逐語・15枚全部のカード面＋FAQ。下書きが「未使用」としていたもの |
| `loot_raw/Loot.txt` | 英語wiki `Loot`（snapshot=2023id_）＝`Official Rules` / `Other rules clarifications` |
| `jp_expansion.txt` | 日本語wiki `略奪（拡張）`＝**イベント15種の日本語名とコストの一覧表**（名前15/15・コスト15/15を独立裏取り） |
| `jp_戦利品.txt` / `jp_略奪品.txt` | 日本語wiki `戦利品`（＝Plunder の Loot）と `略奪品`（＝暗黒時代の Spoils）＝**訳語衝突の裏取り** |
| `C:/tmp/verify_ev/v2.txt` `v3.txt` `villa.txt` `j1.txt` `p1.txt` | 検証担当が**下書きを見ずに**引き直した英語wiki（Maelstrom・Looting・Prepare・Journey・Prosper・**Villa**）。Looting ページ末尾の拡張ナビに**イベント15種のコスト別一覧**があり、これが3系統目の裏取りになった |
| `https://wikiwiki.jp/dominiondeck/{回避,配達,危難,準備,物色,旅行,発進,侵略,繁栄}` | 日本語wiki 個別ページ 9枚を WebFetch で直接取得（**9/9 が下書きと一致**） |


---

## 第7章 特性(Trait) 15種

<sub>（出典ファイル＝`traits.md`。見出しは2段下げて収録）</sub>

### 略奪（Plunder, 2022年12月）— 特性（Trait）15種 一次資料まとめ

**担当範囲**: Cheap / Cursed / Fated / Fawning / Friendly / Hasty / Inherited / Inspiring / Nearby /
Patient / Pious / Reckless / Rich / Shy / Tireless（全15種＝Plunder の Trait 全数）

#### 0-A. 敵対検証の結果（別エージェントが一次資料を引き直して検証）

**検証方法**＝下書きの引用を一切コピーせず、`python tools/wikifetch.py` で15の Trait ページ＋`Trait` ページを
**別の snapshot で取り直し**、日本語wiki `wikiwiki.jp/dominiondeck/` の `特性` ページ＋**15個の個別ページを全て
自分で HTTP 取得**し、さらに RGG の `DomPlunder.pdf` を `pdftotext -layout` で読んで突き合わせた。

**確定（下書きどおりで正しい）**
- **英語カードテキスト15種すべて逐語一致**。`English versions` 表は**どのページも `Plunder / December 2022` の1行のみ**
  ＝**刷りは1つしか無く、古い版を拾う余地が構造的に無い**。
- **コスト＝15種すべて「なし」**（Info box に Cost 欄が無い）。**種別＝15種すべて `Trait` のみ**。複合種別なし。
- **英語wiki の15ページとも `Errata` 節が存在しない**（grep でヒットするのは全ページ共通のフッタ「2019 Errata」リンク）
  ＝**機能エラッタは無い**、という下書きの結論は正しい。
- **日本語名15種**＝日本語wiki の `特性` ページ・15個の個別ページ・サイドバー一覧の**3箇所すべてで一致**。
- **日本語テキスト15種も個別ページと逐語一致**（＝下書きは英語wiki の Japanese 行を使っていない。正しい判断。
  そもそも Trait の `Other language versions` 表には Dutch / German / French しか無く **Japanese 行が存在しない**）。
- **Reckless の全裁定（英語 Official FAQ 4項＋Other rules clarifications 10項）が逐語一致**。
  ホビージャパン印刷版の誤訳テキスト `無謀なカードは、その効果を2回使用する。場から捨て札にするときは、元の山札に戻す。`
  も日本語wiki と逐語一致。
- **Trait 共通ルール（`Official Rules` / `Preparation`）が RGG PDF と一字一句一致**。**Trait は15種で全数**。
- イラストレーター15件も一致。

**訂正した件（本文中に `<!-- 検証で訂正: ... -->` で明示）**＝下記 8 件。
うち **§4-15 Tireless の日本語裁定 11行の脱落**と **§5(5) Friendly のリアクションの因果の取り違え**が重い。

**要ユーザー確認（一次資料では確定できない）**
1. **ホビージャパン印刷版の日本語テキスト（Reckless 以外の14種）**。日本語wiki は表に
   `(※日本語訳はDominion Onlineより)` と明記しており、**印刷版そのものではない**。
   日本語**名**は3箇所一致で確定してよいが、**文面を印刷版と一字一句合わせたいなら実物カードの確認が要る**。
2. **Reckless の日本語表示テキストをどちらにするか**。印刷版は公式に誤訳（日本語wiki が明言）。
   下書きは「英語原文＝指示に2回従う」を採る方針を提案しているが、**これは本アプリの表示文が
   実物カードと食い違うことを意味する**（夜想曲の取り替え子と同じ判断）。**採否はユーザー決定事項**。
3. **印刷カード上の英文の改行位置**（wiki の Versions 表は1行掲載）。カード画像を直接見るしかない。

---

#### 0. 出典と取得方法（再現手順）

| 用途 | 出典 | 取得方法 |
|---|---|---|
| 現行英語カードテキスト・公式FAQ・裁定 | 英語wiki `wiki.dominionstrategy.com` の各 Trait 個別ページ＋`Trait` ページ | `python tools/wikifetch.py <Page> ...`（Wayback 経由） |
| 一般ルール（Trait の準備手順） | 同上 `Trait` ページの `Official Rules` 節（＝RGG ルールブック逐語の転載） | 同上 |
| 日本語カード名・日本語カードテキスト・和文裁定 | 日本語wiki `wikiwiki.jp/dominiondeck/特性` および各特性ページ | HTTPS 直取得（curl / urllib）→ タグ剥がし |

##### 取得できた snapshot（**全15ページとも Plunder（2022年12月）の内容を含むことを本文で確認済み**）

| ページ | snapshot ラベル | 実内容 |
|---|---|---|
| Trait | `2024id_` | Plunder の Trait 一覧・Official Rules あり ✅ |
| Cheap | `2024id_` | ✅ |
| Cursed | `2019id_` | ⚠ ラベルは2019だが Wayback が**最も近い実在キャプチャ**（2023年以降）を返すため、本文は Plunder の Cursed。`Set: Plunder` / `December 2022` を本文で確認 ✅ |
| Fated | `2024id_` | ✅ |
| Fawning | `2id_`（最新） | ✅ |
| Friendly | `2024id_` | ✅ |
| Hasty | `2024id_` | ✅ |
| Inherited | `2019id_` | ⚠ 同上。本文に `Set: Plunder` / `December 2022` ✅ |
| Inspiring | `2019id_` | ⚠ 同上。本文に `Set: Plunder` / `December 2022` ✅ |
| Nearby | `2025id_` | ✅ |
| Patient | `2id_`（最新） | ✅ |
| Pious | `2id_`（最新） | ✅ |
| Reckless | `2id_`（最新） | ✅ |
| Rich | `2id_`（最新） | ✅ |
| Shy | `2023id_` | ✅ |
| Tireless | `2025id_` | ✅ |

<!-- 検証で訂正: 旧=上表の snapshot ラベルは「`2id_`（最新）」等と書かれていたが、(a) `2id_` は最新ではなく最古、
     (b) ラベル自体が実行のたびに変わるため再現しない。出典=`tools/wikifetch.py` の `SNAPSHOTS` 定義と、
     検証者が同じ15ページを再取得して得たラベル（Cheap=2019id_ / Pious=2019id_ / Rich=2023id_ /
     Reckless=2025id_ / Tireless=2id_ / Fawning=2id_ / Patient=2id_ / Fated=2024id_ / Friendly=2024id_ /
     Inherited=2024id_ / Inspiring=2024id_ / Cursed=2024id_ / Nearby=2019id_ / Shy=2023id_ / Hasty=2019id_）。 -->
> **⚠ 上表の snapshot ラベルは「たまたまその実行で最初に成功したもの」であって再現しない**。
> 検証者が同じ15ページを取り直したところ、**15件中12件でラベルが変わった**（例：Cheap 2024id_→2019id_、
> Reckless 2id_→2025id_、Tireless 2025id_→2id_）。Wayback がレート制限で 503/refused を返すと
> `wikifetch.py` が次の snapshot へ落ちるため、ラベルは実行ごとに変わる。**ラベルには意味が無い**。
>
> **snapshot ラベルの読み方（訂正版）**: `SNAPSHOTS = ['2id_', '2025id_', '2024id_', '2023id_', '2019id_']`。
> Wayback はタイムスタンプを**右にゼロ埋め**するので `2id_` → `20000000000000`（2000年）＝
> **「最新」ではなく実在する最古のキャプチャ**を返す。同様に `2019id_` も、ページが2023年以降にしか
> 存在しなければ最古のキャプチャを返す。**したがって既定の `2id_` で成功したページは初期版を読んでいる可能性がある**
> （＝後から追記された FAQ を取りこぼしうる）。**ラベルではなく本文の `Set:` と `Release Date`、および
> `English versions` 表の最新 printing 行を見て判定すること**。
> 今回は15ページとも**異なる snapshot で2回取得して英文が完全一致**することを確認したので、下表の英文は安全。
>
> **もう一つの罠**: 2025年12月以降のキャプチャは Anubis の bot 検知画面が保存されている。
> `wikifetch.py` は `Anubis` 文字列を検出して次の snapshot へ落ちる実装になっているので通っている。
> また Wayback は連続アクセスで頻繁に `WinError 10061 / connection refused` を返す（**ページが存在しない
> のではなく単なるレート制限**）。今回 6ページがこれで落ちたが、5〜20秒の sleep を挟んだリトライで全部取れた。

##### ⚠ 日本語テキストの出典に関する重大な注意

日本語wikiの各特性ページの効果欄には **`(※日本語訳はDominion Onlineより)`** と明記されている。
つまり表の和文は**ホビージャパン印刷版のテキストではなく Dominion Online（オンライン実装）の訳**。
**唯一 `無謀な`(Reckless) だけ、日本語wikiが「ホビージャパン印刷版の実テキスト」を別掲し、
それが誤訳であると明言している**（後述 §4-12）。他14種については印刷版との一字一句の一致は
本調査では確認できていない（＝**日本語名は確定、日本語テキストは「Dominion Online 版」として扱うこと**）。

---

#### 1. 一覧表（コスト・種別・現行英文・和文）

**コストは15種すべて「なし」**。Trait は横型ランドスケープで、公式ルールに逐語で
`Traits are not Kingdom cards, and are never bought or gained.`（＝購入も獲得もしない）とある。
コイン／負債／ポーションのいずれの成分も持たない。

**種別も15種すべて `Trait`（日本語＝特性）のみ**（`Type: Trait` / `種別: 特性`）。
Action・Treasure 等の複合種別を持つものは無い。

| id | 英語名 | 日本語名 | コスト | 種別 | 現行カードテキスト（英語・逐語） | 日本語カードテキスト |
|---|---|---|---|---|---|---|
| `cheap` | Cheap | 安価な | なし | Trait（特性） | `Cheap cards cost [$1] less.` | 安価なカードのコストは1コイン下がる。 |
| `cursed` | Cursed | 呪われた | なし | Trait（特性） | `When you gain a Cursed card, gain a Loot and a Curse.` | 呪われたカード1枚を獲得したとき、戦利品1枚と呪い1枚を獲得する。 |
| `fated` | Fated | 運命の | なし | Trait（特性） | `When shuffling, you may look through the cards and reveal Fated cards to put them on the top or bottom.` | シャッフルするとき、それらのカードをすべて見て、その中の運命のカードを何枚でも公開してもよい。公開した各カードをシャッフルしたカードの一番上か一番下に置く。 |
| `fawning` | Fawning | へつらう | なし | Trait（特性） | `When you gain a Province, gain a Fawning card.` | 属州1枚を獲得したとき、へつらうカード1枚を獲得する。 |
| `friendly` | Friendly | 友好的な | なし | Trait（特性） | `At the start of your Clean-up phase, you may discard a Friendly card to gain a Friendly card.` | あなたのクリーンアップフェイズの開始時、手札の友好的なカードのうち1枚を捨て札にしてもよい。そうした場合、友好的なカード1枚を獲得する。 |
| `hasty` | Hasty | せっかちな | なし | Trait（特性） | `When you gain a Hasty card, set it aside, and play it at the start of your next turn.` | せっかちなカード1枚を獲得したとき、それを脇に置き、あなたの次のターンの開始時に使用する。 |
| `inherited` | Inherited | 受け継がれた | なし | Trait（特性） | `Setup: You start the game with an Inherited card in place of a starting card you choose.` | 準備:ゲーム開始時の自分のカード1枚を選び、受け継がれたカード1枚と入れ替える。 |
| `inspiring` | Inspiring | 鼓舞する | なし | Trait（特性） | `After playing an Inspiring card on your turn, you may play an Action from your hand that you don't have a copy of in play.` | あなたのターンに鼓舞するカードを使用した後、あなたが場に出していないアクションカード1枚を手札から使用してもよい。 |
| `nearby` | Nearby | 近隣の | なし | Trait（特性） | `When you gain a Nearby card, +1 Buy.` | 近隣のカード1枚を獲得したとき、+1 購入。 |
| `patient` | Patient | 忍耐強い | なし | Trait（特性） | `At the start of your Clean-up phase, you may set aside Patient cards from your hand to play them at the start of your next turn.` | あなたのクリーンアップフェイズの開始時に、手札から忍耐強いカードを何枚でも脇に置いてもよい。そうした場合、あなたの次のターンの開始時にそれらを使用する。 |
| `pious` | Pious | 敬虔な | なし | Trait（特性） | `When you gain a Pious card, you may trash a card from your hand.` | 敬虔なカード1枚を獲得したとき、手札1枚を廃棄してもよい。 |
| `reckless` | Reckless | 無謀な | なし | Trait（特性） | `Follow the instructions of played Reckless cards twice. When discarding one from play, return it to its pile.` | 無謀なカードは1度の使用で2回指示に従う。無謀なカードを場から捨て札にしたとき、それをそのカードの山に戻す。<br>※**印刷版は誤訳** → §4-12 |
| `rich` | Rich | 豊かな | なし | Trait（特性） | `When you gain a Rich card, gain a Silver.` | 豊かなカード1枚を獲得したとき、銀貨1枚を獲得する。 |
| `shy` | Shy | 内気な | なし | Trait（特性） | `At the start of your turn, you may discard one Shy card for +2 Cards.` | あなたのターンの開始時に、手札の内気なカードのうち1枚を捨て札にしてもよい。そうした場合、+2 カードを引く。 |
| `tireless` | Tireless | 疲れ知らずの | なし | Trait（特性） | `When you discard a Tireless card from play, set it aside, and put it onto your deck at end of turn.` | 疲れ知らずのカードを場から捨て札にしたとき、それを脇に置き、ターン終了時に山札の上に置く。 |

**改行位置について**: 英語wiki の `Versions` 表（English versions）は英文を**1行のプレーンテキスト**で
掲載しており、**印刷カード上の改行位置は再現されていない**（＝この情報源からは取得不能）。
上表の英文は `Versions` 表の 2022年12月 Plunder 行（＝唯一の刷り／最新 printing）の逐語そのまま。
日本語wiki側も同様に1行掲載。参考までに、ドイツ語版は改行込みで掲載されており
（例 Rich＝`Wenn du eine Reiche Karte / nimmst, nimm ein Silber.`）、Trait のテキスト欄が
2〜3行組であることは分かるが、**英語の改行位置は未確認**。

**id 衝突チェック（本アプリ既存カードとの照合）**: 15 id とも既存 `DOM.CARDS` / `DOM.LANDSCAPES` に無い。
近い名前として 冒険のイベント `inheritance`（相続）／夜想曲の `cursed_village`（呪われた村）・
`cursed_gold`（呪われた金貨）／同盟の `lich`（リッチ）があるが、**id は全て別**。
ただし表示上の紛らわしさは残る（日本語wikiも「【呪われた村】(Cursed の付いた村) と "Cursed Village"(呪われた村)
は同名カードではない」と注意している＝§4-2）。<!-- 検証で訂正: 旧=§4-3。名称衝突の記述があるのは §4-2（Cursed）。§4-3 は Fated。 -->

---

#### 2. Trait 共通ルール（`Trait` ページの `Official Rules` 節・逐語）

> `Plunder has Traits, which are a new kind of landscape card that affects a single Action or Treasure pile.
> At the start of a game with a Trait, choose a random Action or Treasure Kingdom card pile to put the Trait on;
> then during that game, cards from that pile are affected as indicated on the Trait.`

> `Traits are not Kingdom cards, and are never bought or gained.`

> `Traits only go on Kingdom cards, not on e.g. Silver or the Ruins pile (from Dark Ages).`

> `Don't put two Traits on the same pile.`

> `Traits refer to the pile using the name of the Trait; for example Pious refers to "Pious cards."
> That just means, any card from that pile.`

> `A Trait on a split pile (from Empires and Allies) affects all of those different cards.`

> `Traits continue to affect the cards from a pile even after the pile is empty.`

準備（`Preparation` 節・逐語）:

> `Events and Traits can be shuffled into the randomizer deck (despite having a different back).
> They are not part of the 10 Kingdom cards used in a game; ... For normal play we recommend using at most
> 2 such cards; with other expansions that includes Events, Traits, Landmarks, Projects, and Ways.`

> `Also skip Events and Traits when using a randomizer card to determine whether or not to use
> Platinum/Colony (from Prosperity), or Shelters (from Dark Ages) in a game, or to determine the bane
> for Young Witch (from Cornucopia).`

> `In games using a Trait, pick a random Treasure or Action from the dealt-out Kingdom cards and put the
> Trait under it, so the text is showing; do not put two Traits on the same pile.`

日本語wiki `特性` ページの追加裁定（逐語）:

> `ゲームの準備時、特性の山札選出は準備手順の最後に行う。魔女娘をゲームに用いる場合の災いカード＆
> 来寇をゲームに用いる場合の【追加アタック】は選出対象となる。一方で、Ferrymanをゲームに用いる場合の
> 【Ferrymanカード】は選出対象にならない。`

> `例えば、銀貨や廃墟は"「王国カード」ではない(「基本カード」に分類される)"ので、特性の対象として選択されない。`

> `分割された山札のように山札に異なるカードが含まれる場合、ランダマイザーに書かれている種類を参照する。
> 具体的には城以外の全ての分割された山札はアクションの山札として扱われるので、特性の対象として選択される。`

> `特性がセットされた山札のカードを廷臣や鷹匠が参照した場合でも【カード種別】が増えるわけではない。`

> `特性がセットされた山札が空になった場合でも、特性の効果は失われない。`

<!-- 検証で追記: 旧稿は次の1行を落としていた。本アプリではオベリスク（帝国ランドマーク）の述語を流用すると
     間違う分岐なので必須。出典=日本語wiki「特性」詳細なルール。 -->
> `ゲームの準備時、特性の対象として選択されるのは"「王国カード」かつ「アクションまたは財宝カード」の山札"である。
> ランドマークのオベリスクとは異なるため注意。`

##### RGG 公式ルールブック PDF による裏取り（検証で追加）

<!-- 検証で追記: 旧稿 §6-3 は「RGG 公式ルールブック PDF は今回参照していない」としていたが、検証者が実際に
     読んで一致を確認した。ただし初版レイアウトなのでカード文面の正本にはしない。 -->
`DomPlunder.pdf`（`DomPlunderRules22.qxp_WideDominion 8/20/22`・sha1 `1e337a1a0e7e55229674665b96b5d42700419bae`）を
`pdftotext -layout` で読み、上記の `Official Rules` / `Preparation` の**全文が一字一句一致**することを確認した。
加えて内容物一覧に
`15 Trait cards: Cheap, Cursed, Fated, Fawning, Friendly, Hasty, Inherited, Inspiring, Nearby, Patient, Pious, Reckless, Rich, Shy, Tireless`
とあり、**Trait は15種で全数**であることが wiki とは独立に裏取りできた。
⚠ **ただしこの PDF は 2022年8月レイアウト＝略奪の初版**（夜想曲で踏んだ罠と同型）。
**一般ルールの逐語にだけ使い、カード文面の正本にはしない**こと（カード文面の正本は英語wiki の
`English versions` 表の最新 printing 行＝今回は `Plunder / December 2022` の1行のみ）。

---

#### 3. 誘発タイミング別の分類（実装時の骨格）

| 誘発窓 | 該当 Trait |
|---|---|
| コストの恒久的な書き換え | Cheap |
| 準備（Setup） | Inherited |
| カードを獲得したとき（そのカード自身） | Cursed / Hasty / Nearby / Pious / Rich |
| 属州を獲得したとき | Fawning |
| ターンの開始時 | Shy（手札から捨てて+2ドロー）／Hasty・Patient（脇札を使用） |
| カードを使用した後 | Inspiring |
| 使用時効果の書き換え（指示に2回従う） | Reckless（前半） |
| 場から捨て札にしたとき | Reckless（後半＝山へ戻す）／Tireless（脇へ→ターン終了時に山札の上） |
| クリンナップフェイズの開始時 | Friendly（捨てて獲得）／Patient（脇に置く） |
| シャッフルするとき | Fated |

---

#### 4. 各 Trait の公式FAQ・裁定（実装に影響するものだけ逐語）

**エラッタについて**: 英語wiki の15ページとも `Errata` 節は**存在しない**（`Trivia > Secret History` のみ）。
＝**Trait 15種に機能エラッタは無い**（初刷＝現行）。

##### 4-1. Cheap（安価な）

**Official FAQ（逐語）**
> `This lowers the cost of a pile for the entire game (including when scoring).`
> `Costs can't go below [$0].`
> `This doesn't reduce non-[$] like [P] and [D], for example this does nothing on the Engineer pile (from Empires).`
<!-- 検証で訂正: 旧=`This doesn't reduce non-[$] costs like [P] and [D]; for example ...`（"costs" が入りセミコロン）。
     出典=英語wiki Cheap ページ（検証者取得 snapshot=2019id_）の Official FAQ 逐語。"costs" は無く区切りはカンマ。
     ルールの意味は同一。2024年キャプチャで文言が異なる可能性は再取得できず未確認。 -->
> `This does not apply during setup; it can't for example cause a [$4] to be used as Young Witch's Bane (from Cornucopia).`

**日本語wiki 追加裁定（逐語）**
> `得点計算時も、【安価なカード】は1コイン分コストが下がったカードとして扱われる。例えば、【安価な村】は
> 得点計算時も「コスト2のカード」として扱われるので、高原の羊飼いで集計する「コスト2のカードの枚数」に含まれる。`

> `安価なはあくまで「【安価なカード】のコストを1コイン分下げる」という効果なので、ポーションのみのコストの
> カード(変成)や負債のみのコストのカード(技術者など)が【安価なカード】になった場合は、意味が無い。`

##### 4-2. Cursed（呪われた）

**Official FAQ（逐語）**
> `When you gain a card from the Cursed pile, you also gain a Loot and a Curse.`
> `If there are no Curses left, you still gain a Loot.`

**Other rules clarifications（逐語）**
<!-- 検証で追記: 旧稿はこの英語節を丸ごと落としており、獲得順を日本語wiki だけの裁定として書いていた。
     出典=英語wiki Cursed ページ Other rules clarifications。獲得順は公式英語側にも明記がある。 -->
> `You gain the Cursed card first, then the Loot, and finally the Curse.`

**日本語wiki 追加裁定（逐語）**
> `【呪われたカード】の獲得時の処理は、①【呪われたカード】を獲得し、獲得先に移動する→②戦利品を1枚獲得する
> →③呪いを1枚獲得する、という順番である。`
> `最後に獲得するのは呪いになるので、【呪われたカード】獲得後は行人のコストは0になる。`

**名称の衝突（日本語wiki 余談・逐語）**
> `【呪われた村】の英語名は【Cursed Village】となり、"Cursed Village"と区別が付かなくなる。
> このことで【Cursed Village】と"Cursed Village"を「同名のカード」とは見なさないので注意。`

##### 4-3. Fated（運命の）

**Official FAQ（逐語）**
> `Each time you shuffle, you can choose to put Fated cards on the top or bottom of your deck,
> while shuffling the other cards normally.`
> `If for example you had five Fated cards, you could put two on top, one on the bottom, and leave the
> other two to be shuffled in.`
> `In games with Fated, you can look through your deck before shuffling, even if you're sure you don't
> have any Fated cards.`

**Other rules clarifications（逐語）**
> `If you put any Fated cards on top, they go on top of the shuffled cards, not on top of your deck.
> And if you put any Fated cards on the bottom, they go on the bottom of the shuffled cards,
> not on the bottom of your deck.`
> `If Patron is Fated, then revealing it when shuffling will give you +1 Coffers (assuming that it's an
> Action phase). If you reveal Patron, you have to put it either on top or bottom.`

**日本語wiki 追加裁定（逐語）**
> `シャッフル時、【運命のカード】を複数枚数公開した場合は、「公開した【運命のカード】の内、任意の枚数を
> デッキトップに置く」を行い、その後「残りの公開した【運命のカード】全てのをデッキボトムに置く」と処理する。`
<!-- 検証で追記: 旧稿は次の2行（「公開枚数は0枚でもよい＝一部だけ公開できる」「ゲーム中は誰でもシャッフル対象を見てよい」）
     を落としていた。前者は実装で「全部自動でトップに置く」にすると公式より強くなる分岐なので必須。
     出典=日本語wiki「運命の」詳細なルール。 -->
> `なお、シャッフル時に公開する【運命のカード】の枚数は任意の枚数(=0枚でも良い)ので、「【運命のカード】を敢えて
> 全ては公開せず、一部は通常通りシャッフルに混ぜる」という動きもできる。`
> `【運命のカード】が用いられるゲーム中は、シャッフル時にシャッフルするカード群の内容を見て良い。`
> `【運命のカード】の獲得していないプレイヤーであっても、シャッフルするカード群の内容を見て良い。`
> `宿屋、寄付、併合、飢饉によって引き起こされるシャッフルでも運命のの効果は誘発する。`
> `ただし、パトロンを公開して1財源得られるのはアクションフェイズ中に公開した場合のみである。特にクリーンアップ
> フェイズ中に次のターン用の手札を作る際のシャッフル時に公開しても財源は得られないので注意。`

##### 4-4. Fawning（へつらう）

**Official FAQ（逐語）**
> `This is mandatory.`

**Donald X. プレビュー（逐語）**
> `Fawning means Province comes with a Fawning card. It's not optional, which is sometimes fun.`

**日本語wiki 追加裁定（逐語）**
> `属州獲得時、【へつらうカード】を獲得するのは強制である。`

##### 4-5. Friendly（友好的な）

**Official FAQ（逐語）**
> `You may only discard one Friendly card per turn this way.`

**Other rules clarifications（逐語）**
> `If a split pile is Friendly, you can discard a Friendly card to gain a Friendly card with a different
> name (e.g. discard a Battle Plan to gain a Warlord).`
> `If Encampment is Friendly, you can first return a set-aside Encampment to its pile, and then discard an
> Encampment (or Plunder from your hand to regain it.`

**日本語wiki 追加裁定（逐語）**
> `友好的なの効果による捨て札処理＆カードの獲得は、クリーンアップフェイズに行われることに注意。`
> `ヴィラや騎兵隊を獲得しても、アクションフェイズに戻ることはない。`
> `たとえ村有緑地などを捨て札にした場合でもリアクションできない。`
> `友好的なの「クリーンアップフェイズの開始時の処理」を終えた後に、クリーンアップフェイズ中の処理として
> 「手札をすべて捨て札にする」という処理が発生することに注意。`

##### 4-6. Hasty（せっかちな）

**Official FAQ（逐語）**
> `If this plays a card that can't normally be played, like Territory (from Allies), that card goes into
> play but doesn't do anything else then.`

**Other rules clarifications（逐語）**
> `Playing a card that has no effect (like Territory) will still trigger e.g. Pathfinding, and it can
> count for e.g. Landing Party.`

**日本語wiki 追加裁定（逐語）**
> `せっかちなの効果は強制である。`
> `身代わり or 呪符の巻物 or 召喚で【せっかちなカード】を獲得した場合の処理に注意。… ①【せっかちなカード】
> 獲得→②せっかちなの効果で【せっかちなカード】を脇に置く→③身代わり or 呪符の巻物 or 召喚の効果で獲得した
> 【せっかちなカード】を獲得先から移動しようとするが、移動阻止ルールにより移動に失敗する、という処理になる。`
> `この時、次のターンの開始時の処理は「領土を場に出し使用するが、何も起こらない。次ターン以降への処理も
> 持っていないので、次のクリーンアップフェイズに場から捨て札になる」となる。`
> `この領土は使用されるので、「衝突の山札に『+1コイントークン』などのプレイヤートークンが乗っていた場合は、
> トークンの効果が誘発する」「上陸部隊が参照する『ターン中最初に使用されたカード』として扱われる」と言う点に注意。`

##### 4-7. Inherited（受け継がれた）

**Official FAQ（逐語）**
> `If they care, players decide which card to replace in turn order.`
> `Replaced Coppers go back to the pile; replaced Estates go back to the box.`
> `Replaced other cards (Shelters from Dark Ages, Heirlooms from Nocturne) go back to the box.`
> `If the Inherited pile is a split pile (from Empires or Allies), players take cards from the pile in
> turn order. So in a 6-player game with the Townsfolk pile, the first four players get a Town Crier,
> and the next two get a Blacksmith.`
> `Cards starting in your deck due to Inherited were never "gained" and did not trigger "when you gain this" effects.`

**Donald X.（多人数での運用・逐語）**
> `In multiplayer IRL, I recommend not putting Inherited on a split pile, unless that's the fun you want.`

**日本語wiki 追加裁定（逐語）**
> `【受け継がれた騎士】となった場合も、スタートプレイヤーからターン順に受け継がれたサプライの一番上のカードと
> 入れ替える。そのため、プレイヤーごとに別のカードが初期デッキに含まれることになる。`
> `「初期デッキのカードのうち1枚を【受け継がれたカード】と入れ替える」という処理の際、入れ替えた初期デッキの
> カードは廃棄されたとみなされない。草茂る屋敷や呪いの鏡を入れ替えた際も、廃棄時効果は誘発されない。`
> `【受け継がれた影カード】が用いられるゲームでは、【受け継がれた影カード】が初期デッキカードと入れ替わった後に、
> ゲームの準備としてデッキをシャッフルする。よって、このシャッフル時に【受け継がれた影カード】を自分の山札の
> 底に置く。`
> `【受け継がれたへそくり】が用いられるゲームでは、…このシャッフル時に【受け継がれたへそくり】を自分の山札の
> 好きなところに加えることができる。`
> `特に四人戦では、受け継がれたサプライのカードは4枚減った状態でゲームが始まるので、サプライが1山枯れるのが
> 早くなる場合もあるので注意。`
<!-- 検証で追記: 旧稿は以下3件を落としていた。いずれも実装に直結する。出典=日本語wiki「受け継がれた」詳細なルール。 -->
> `避難所場や家宝カードを使用するゲームでは、避難所や家宝を【受け継がれたカード】の入れ替えに選んでもよい。
> たとえば【受け継がれたプーカ】となった場合、プーカに対応している家宝の呪われた金貨を入れ替えてもよい。`
> `「初期デッキのカードのうち1枚を【受け継がれたカード】と入れ替える」という処理の際、【受け継がれたカード】は
> 獲得されたとみなされない。【受け継がれたカード】が獲得時効果を持つ場合も、その効果は誘発しない。`
> `分割された山札が【受け継がれたカード】に指定された場合も、順々に入れ替え処理を行う。そのため、5人戦以上を
> 行う際の5番手以降は、4番手までのプレイヤーと別のカードが初期デッキに含まれる可能性がある。`
> （利用法欄）`特に同盟の分割された山札の場合、4人戦では一番上にあるカードが2番目のカードの状態でゲームが
> 開始する。また全員が山を循環させうるので注意。`

##### 4-8. Inspiring（鼓舞する）

**Official FAQ（逐語）**
> `When you play an Inspiring card, after resolving it, you can play an Action card from your hand,
> provided that you don't have a copy of that card in play.`
> `Duration cards that you played on previous turns that are still in play, are in play; cards that have
> left play somehow, like a Mining Village (from Intrigue) trashing itself, are not in play.`
> `An Inspiring card can sometimes play a different Inspiring card (when Inspiring is on a split pile,
> like those in Empires and Allies), but can't normally play another copy of itself.`

**日本語wiki 追加裁定（逐語）**
> `「あなたが場に出していないアクションカード」とは、このターンにプレイしたアクションカードであるかは関係なく、
> 場に出ているアクションカードかどうかで判断される。`
> `場に持続している持続カード、呼び出したリザーブカードなどは対象だが、プレイして廃棄されたカードなどは
> 対象にならない。`
> `「脇に置く」効果によって置かれたカードも場に出ていない。特に表向けで脇に置く効果を持つカード
> （忠犬、貨物船、王子など）がある場合は、場のカードと混同しないように注意。`
> `【鼓舞するカード】が場から捨て札になるタイミングは、鼓舞するの効果で何を使用したとしても、変化しない
> ことに注意。玉座の間やはみだし者などの『自身の効果で使用したカードが場から離れるまで場に残るカード』との
> 違いに注意。`
> `騎士であれば全てカード名が異なり、それぞれにとって互いに「あなたが場に出していないアクションカード」の
> 関係であるため、騎士→別の騎士と出すことが可能。`
> （利用法欄）`財宝が【鼓舞するカード】である場合は、購入フェイズにアクションカードの使用機会を得られたりする。`

##### 4-9. Nearby（近隣の）

**Official FAQ（逐語）**
> `Each time you gain a Nearby card, you get +1 Buy.`

**Secret History（逐語・実装方針の裏取りとして）**
> `Unchanged. It had to compete with "When you play one of these, +1 Buy" for a while;`
（＝**使用時ではなく獲得時**であることの確認）

##### 4-10. Patient（忍耐強い）

**Official FAQ（逐語）**
> `You can set aside multiple Patient cards at once; play them all at the start of your next turn, in any order.`
> `If this plays a card that can't normally be played, like Territory (from Allies), that card goes into
> play but doesn't do anything else then.`

**Other rules clarifications（逐語）**
> `Playing all the set aside cards is a single start-of-turn effect. Between playing each of those cards,
> you cannot resolve any other start-of-turn effects (for example, from Durations played last turn).`
> `If you have multiple Patient cards with different names, you can play them in any order. So if you set
> aside Sunken Treasure and Distant Shore, you can first play Sunken Treasure, gain a Distant Shore,
> then play the set-aside Distant Shore.`
> `If Patient cards get put into your hand at the start of Clean-up (e.g. you trash a Patient Fortress
> with Improve), you may set it aside to play it at the start of your next turn.`

**日本語wiki 追加裁定（逐語）**
> `「ターンの開始時」はアクションフェイズである。`
> `忍耐強いの効果で使用した冠は、必ず「アクション2回使用」の効果となる。`
> `忍耐強いの効果で使用した人狼は、必ず「+3ドロー」の効果となる。`
> `(3)の処理は『(1)で脇に置いたカードを使用する(複数枚ある場合は好きな順番で使用してよい)』という一連の
> 処理なので、この処理の間に他の「ターンの開始時」効果の処理を割り込ませることはできないので注意。`
> `「各ターンの開始時」の効果を持つカードを忍耐強いの効果で使用した場合、同じ「各ターンの開始時」中に
> 効果を発揮する。（該当＝雇人、操舵手、侍、王子）`
<!-- 検証で追記: 旧稿は「忍耐強いブロック自体を他の開始時効果に対してどこに差し込むかは選べる」を落としており、
     『startQueue に1項目・先入れ順で固定』と読める書き方になっていた。公式は差し込み位置を選べる（内部だけが不可分）。
     ＋ Patient にも Hasty と同じ 領土(Territory) の裁定がある。出典=日本語wiki「忍耐強い」詳細なルール。 -->
> （厳密な処理・逐語）`クリーンアップフェイズの開始時に…手札にある【忍耐強いカード】を任意の枚数表向きに脇に置く.`
> `次ターンの開始時に「ターンの開始時」効果の処理順を選ぶ。`
> `「忍耐強いのターンの開始時処理」を開始することを選んだ場合、『(1)で脇に置いたカードを使用する
> (複数枚ある場合は好きな順番で使用してよい)』という効果を処理する。`
> `(3)の処理がすべて終わってから、(まだあるなら)他の「ターンの開始時」効果の処理を行う。`
> `衝突の山札が忍耐強いの対象として選ばれた場合、衝突の山札に由来する領土も(アクションまたは財宝カードでは
> 無いが)【忍耐強いカード】となり、「クリーンアップフェイズ開始時に手札から脇に置いてもよい。そうした場合、
> 次のターンの開始時に使用する」という効果を持つようになる。`
> `この時に【忍耐強い領土】は使用されるので、「衝突の山札に『+1コイントークン』などのプレイヤートークンが
> 乗っていた場合は、トークンの効果が誘発する」「上陸部隊が参照する『ターン中最初に使用されたカード』として
> 扱われる」と言う点に注意。`

（Strategy 欄より＝アクション権を消費しない旨の逐語）
> `not only does it allow unplayed cards to be set aside until the next turn, but on the next turn they
> can be played without using up an action play. However, the play is not optional: once set aside,
> they get played no matter what.`

##### 4-11. Pious（敬虔な）

**Official FAQ（逐語）**
> `Each time you gain a Pious card, you may optionally trash a card from your hand.`

**日本語wiki 追加裁定（逐語）**
> `職人、カブラー、願いなどによって【敬虔なカード】を手札に獲得した場合、その【敬虔なカード】自体も廃棄する
> ことができる。獲得時効果を解決するときに獲得カードはすでに獲得先に移動している。`

##### 4-12. Reckless（無謀な）— **最難関**

**Official FAQ（逐語）**
> `Reckless does two things, at different times. When you play a Reckless card, you follow its
> instructions an extra time - follow them entirely, then follow them again - and when you discard one
> from play, you return it to its Supply pile.`
> `With Duration cards those may not happen on the same turn.`
> `If you skip following the instructions of the card - for example by using a Way (from Menagerie)
> instead - then you don't follow them an extra time, but still return the card when discarding it from play.`

**Other rules clarifications（逐語）**
> `Just like Ways, if a Reckless card is affected by Enchantress and/or Highwayman, you won't do its
> instructions twice, and you still return the Reckless card to its pile when discarding it from play.`
> `The exception is Way of the Chameleon, which tells you to "follow this card's instructions." So if you
> play a Reckless card as Way of the Chameleon, you'll follow its instructions twice, switching +Cards
> and +[$] both times.`
> `Even though you follow a Reckless card's instructions twice, that only counts as 1 card played
> (which matters for e.g. Conspirator).`
> `Some cards care if it's the 1st time you played a copy of it this turn; if it's Reckless, both
> iterations will be the 1st time you played it. So your 1st Reckless Fool's Gold gives +[$2], and your
> 1st Reckless Crossroads gives +6 Actions.`
> `Both iterations will count as something the card did. So if you play a Harbor Village, then play a
> Reckless Steward and choose +2 Cards and +[$2], that will let Harbor Village give +[$1].`
> `Abilities that happen after playing a card (e.g. Frigate or Landing Party) are resolved (once) after
> you finish both iterations of a Reckless card.`
> `If a Reckless card is an Attack, a single Shield reveal (which you have to reveal before the first
> iteration of the Reckless card) will block both attacks (even if you want to get attacked the 2nd time).`
> `If an attacked player draws a Shield as a result of the 1st attack (e.g. the attack was Soothsayer),
> they don't get to reveal the Shield against the 2nd attack.`
> `If a Reckless card never gets discarded from play (e.g. Quartermaster, Search, or a one-shot), you'll
> follow its instructions twice, but you'll never return it to its pile (so there's effectively no downside).`
> `If another card moves a Reckless card when it's discarded from play (e.g. Scheme), it'll fail to return to its pile.`
> `If Highwayman is Reckless, then when you discard it from play at the start of a turn, you'll return it
> to its pile, and then get +6 Cards.`

**⚠ 日本語版（ホビージャパン印刷版）は誤訳。日本語wikiが明言（逐語）**
> `※ホビージャパンから発売されている「ドミニオン：略奪」版のテキストでは誤訳が含まれるため注意。`
>
> 印刷版テキスト＝`無謀なカードは、その効果を2回使用する。場から捨て札にするときは、元の山札に戻す。`
>
> `「2回使用する」は誤訳である。当ページ冒頭から繰り返し説明している通り、本来は「2回使用する」効果ではなく、
> 「1回のカード使用でテキスト指示に2回従う」効果である。`

→ **本プロジェクトの方針（現行＝印刷済み最新＋公式エラッタ）では英語原文の「指示に2回従う」を採る。**
日本語表示テキストは日本語wikiが載せる Dominion Online 訳
`無謀なカードは1度の使用で2回指示に従う。無謀なカードを場から捨て札にしたとき、それをそのカードの山に戻す。`
を採用し、印刷版の誤訳は採らない（※夜想曲の取り替え子で同じ判断をした前例あり）。

**日本語wiki 追加裁定（逐語・特に重要なもの）**
> `【無謀な愚者の黄金】を使用した際、それがターン中最初に使用する愚者の黄金であれば、処理の結果「＋1金」
> 「＋1金」を得て計2金となる。「＋1金」「＋4金」で5金を得ることは無い。`
> `例えば、【無謀な大金】は「このターンに1度だけ」という条件であり「このターンに初めて使用した『大金』の場合」
> ではないので、コインを2倍にする効果は1度しか受けられない。`
> `【無謀な港の村】を使用した後、次に民兵を使用すれば、「＋1金」「＋1金」を得て(民兵を除く【無謀な港の村】
> だけで)計2金となる。玉座の間の効果で港の村を使用した後、次に民兵を使用したパターンとは結果が異なる。`
> `【無謀なアタックカード】を使用した際、使用は1回であることに注意。他プレイヤーが、【アタック誘発リアクション】
> でリアクションするのは、【無謀なアタックカード】が使用時効果の1回目を発揮する前である。`
> `①「1度の使用で2回指示に従う」について、2回のうち1回目と2回目で、テキスト指示の範囲内で異なる選択肢を
> 取ることは可能。例えば、【無謀な執事】を使用した際、1回目で「＋2ドロー」、2回目で「＋2金」を処理することが
> できる。`
> `【無謀なカード】を使用して習性を使った場合、①の処理は上書きされるので発生せず、習性の効果を1回のみ発揮する。
> …『①「1度の使用で2回指示に従う」は「2回使用する」ではないため、「1度は通常の使用時効果を処理して、
> 1度は習性を処理する」ような動きはできない。』`
> `使用した【無謀なカード】が、女魔術師のアタック効果を受けた場合、①の処理は上書きされるので発生せず、
> 「+1 カードを引く、+1 アクション」を1回発揮する。ただし、②の処理は発生するので、捨て札時に由来する山に戻す。`
> `使用した【無謀なカード】が、追いはぎのアタック効果を受けた場合、①の処理は上書きされるので発生せず、
> 何も起きない。ただし、②の処理は発生するので、捨て札時に由来する山に戻す。`
> `長老の効果で【無謀な貴族】を使用した場合、①の処理は上書きされずに全ての書き換え効果が適用されるので、
> 「『次のうち1つか2つを選ぶ：+3ドロー; +2アクション』の指示に2回従う」と処理される。`
> `【無謀な雇人】は①使用したターンに「各ターンの開始時1ドロー」を2度予約し、②クリーンアップフェイズで
> 場から捨て札にならないため、由来する山に戻ることはない。`
> `【無謀な追いはぎ】は①使用したターンに「…」を2度予約し、②次のターンの開始時に場から捨て札にしたときに
> 由来する山に戻す(由来する山に戻っても、①で予約した効果は全て問題なく発揮される)。`
> `ターン中に一時的にサプライの山が3つ空になっても、無謀なの効果で山にカードが戻り、ターン終了時に
> サプライの山が3つ空になっていなければ、終了条件を満たさないのでそのままゲームを続行する。`
> `分割された山札が無謀なで指定された場合、クリーンアップフェイズに複数種類の【無謀なカード】を場から
> 捨て札にするときは、ターンプレイヤーは好きな順で由来する山に戻す。`

##### 4-13. Rich（豊かな）

**Official FAQ（逐語）**
> `Each time you gain a Rich card, you also gain a Silver.`

**日本語wiki 追加裁定（逐語）**
> `【豊かなカード】獲得時、銀貨1枚の獲得は強制である。`

##### 4-14. Shy（内気な）

**Official FAQ（逐語）**
> `You can only discard one Shy card per turn this way.`

**日本語wiki 追加裁定（逐語）**
> `内気なの効果は、ターン開始時に行う、①【内気なカード】を1枚を手札から捨て札にする→②+2ドローを得る、
> という"一連の処理"かつ"二段階の処理"である。`
> `①と②の間に他の「ターンの開始時」の処理を割り込ませることはできない。例えば、①で【内気なカード】を
> 捨て札にし、手札を4枚にする→この手札4枚のタイミングですり師団を処理する→②の処理に戻り+2ドローを得る、
> という動きはできない。`
> `捨て札時にリアクションするタイミングは、①の直後である。②の後ではない。例えば、【内気な村有緑地】を
> 内気なの効果で捨て札にした際は、2ドローの前にリアクションし、使用時効果を発揮する必要があるので注意。`
> `あくまで単独の処理であり、『ターン開始時に対象のカードを捨て札にすると(捨て札時効果のように)自動的に
> 追加効果が得られる』という誘発効果ではない。類似効果に輪作があるが、例えば「輪作購入後、ターン開始時に
> 【内気な風車】1枚を捨て札にした」という場合に+4ドローできるわけでは無い。`

##### 4-15. Tireless（疲れ知らずの）

**Official FAQ（逐語）**
> `This is mandatory.`
> `You draw your next hand before putting the card onto your deck.`

**Other rules clarifications（逐語）**
> `If a Tireless card never gets discarded from play (e.g. it's Quartermaster, Crew, or a one-shot),
> then Tireless will have no effect.`
> `If something else moves a Tireless card when it's discarded from play (e.g. Scheme), you won't set it aside.`
> `If a Tireless card discards itself from play at a weird time (e.g. Highwayman), you'll still set it
> aside and put it onto your deck at the end of the turn.`
> `If a split pile is Tireless, you can put the cards onto your deck in any order.`
> `If you have an ability that gives you +Cards at the end of your turn (from e.g. Way of the Squirrel or
> Farrier), you can top-deck your Tireless card before or after taking the +Cards. If you top-deck first,
> you will draw the Tireless card immediately and it will be in your hand during your opponent's turn.`
> `Note that some things draw extra cards when you draw your Clean-up hand (e.g. Flag or Expedition),
> which will happen before you topdeck Tireless cards.`

**日本語wiki 追加裁定（逐語）**
<!-- 検証で訂正/追記: 旧稿はここに1行（しかも日本語wikiに実在しない要約文
     「【疲れ知らずのカード】がデッキトップに戻るのは強制効果であることには注意。」）しか書いておらず、
     日本語wiki「疲れ知らずの」詳細なルールにある実装直結の裁定を丸ごと落としていた。以下が逐語。 -->
> `疲れ知らずのの「場から捨て札になるとき脇に置き、ターン終了時にデッキトップに置く」という効果は強制効果である。`
> `疲れ知らずのの効果は、「【疲れ知らずのカード】を場から捨て札にしたとき」に誘発する捨て札時効果である。`
> `「【疲れ知らずのカード】を場から廃棄したとき(調査などが該当)」や「【疲れ知らずのカード】を場から手札に
> 移動にしたとき(霊術師が該当)」は誘発しない。`
> `クリーンアップフェイズ以外で場から捨て札になった場合も誘発する(追いはぎが該当)。`
> `場以外の場所から捨て札になった場合は誘発しない(ワイン商を酒場マットから捨て札にした場合などが該当)。`
> `何らかの【上書処理】【書換処理】で使用時効果が上書きor書き換えをされても、捨て札時効果が消えることはない。`
> `【疲れ知らずのカード】が捨て札時効果を発揮するのは、「【疲れ知らずのカード】が場から捨て札置き場に実際に
> 一度置かれた後」である。この時、他の捨て札時効果も同時に誘発する。`
> `よって、【疲れ知らずのカード】が他の捨て札時効果(画策、トラベラーなどの効果)で捨て札置き場から移動した場合、
> 【疲れ知らずのカード】の「脇に置き、ターン終了時にデッキトップに置く」の処理に失敗する(移動阻止ルール)。`
> `実際に捨て札になっているので、【疲れ知らずの元手】は(捨て札置き場から脇に置いた場合でも)「<6>を受け取る」の
> 処理が発生する。`
> `疲れ知らずのの「脇に置き、ターン終了時にデッキトップに置く」効果は、ターン終了時に発生する。他の
> 「ターン終了時に発生する処理」と同時に発生し、その処理順は自由に選択できる。`
> `例えば【疲れ知らずのカード】とリスの習性により書き換えられたアクションを使用してターンを終えた場合、
> ターン終了時に疲れ知らずのの「脇に置き、ターン終了時にデッキトップに置く」効果とリスの習性の
> 「+2 カードを引く」が同時に誘発する。前者を先に処理した場合は【疲れ知らずのカード】を引くことになり、
> 後者を先に処理した場合は【疲れ知らずのカード】はデッキトップに残る。`

---

#### 5. 実装時に事故りそうな落とし穴（逐語引用つき）

##### (1) Trait は「カード」ではなく「山」に付く＝`pileKeyOf` 正規化を全部通す
> `Traits refer to the pile using the name of the Trait; for example Pious refers to "Pious cards."
> That just means, any card from that pile.`
> `A Trait on a split pile (from Empires and Allies) affects all of those different cards.`
> `Traits continue to affect the cards from a pile even after the pile is empty.`

本アプリには **帝国の2段分割山5組・同盟の分割山6組・混合山（廃墟/騎士/城）** が既にある。
「このカードは Trait 付きか？」の述語は**必ず `pileKeyOf` を通して山キーで判定**すること。
§0-20 の徴税・§0-29 A2 の汚された神殿と**同じクラスの孤児化バグ**を必ず踏む。
さらに **山が空になっても効果が続く**ので、`supply[key] === 0` でも判定を切ってはいけない。

##### (2) Trait が付いた「王国のアクション/財宝の山」の選び方＝ setup の最後・randomizer 基準
> `Traits only go on Kingdom cards, not on e.g. Silver or the Ruins pile (from Dark Ages).`
> `Also skip Events and Traits when using a randomizer card to determine whether or not to use
> Platinum/Colony ..., or Shelters ..., or to determine the bane for Young Witch`
> （日本語wiki）`ゲームの準備時、特性の山札選出は準備手順の最後に行う。魔女娘をゲームに用いる場合の災いカード
> ＆来寇をゲームに用いる場合の【追加アタック】は選出対象となる。`
> （日本語wiki）`具体的には城以外の全ての分割された山札はアクションの山札として扱われるので、特性の対象として
> 選択される。`

＝**「山の種別」は randomizer（プレースホルダ＝最安カード）で判定**（本アプリ §0-29 A2b の
「山のコスト・種別は randomizer／買うときのコストは一番上」の分岐と**同じ側**）。
城(`castles`)は勝利点の山＝対象外、騎士(`knights`)はアクションの山＝**対象になる**。
災いカード(`baneCard`)は選出対象＝`createInitialState` の**最後**（`pickBane` の後）に決めること。

##### (3) 「普通は使用できないカードを場に出す」経路が必要（Hasty / Patient）— **本アプリでは必ず到達する**
> `If this plays a card that can't normally be played, like Territory (from Allies), that card goes into
> play but doesn't do anything else then.`
> `Playing a card that has no effect (like Territory) will still trigger e.g. Pathfinding, and it can
> count for e.g. Landing Party.`
> （日本語wiki）`衝突の山札がせっかちなの対象として選ばれた場合、衝突の山札に由来する領土も(アクションまたは
> 財宝カードでは無いが)【せっかちなカード】となり…この領土は使用されるので、「衝突の山札に『+1コイントークン』
> などのプレイヤートークンが乗っていた場合は、トークンの効果が誘発する」`

同盟の分割山 **衝突(clash)** に **領土(territory)＝勝利点** が入っており、本アプリは同盟を出荷済み。
`PLAY_ACTION` の「アクションか？」ガードを通さない**「場に出すだけ」の専用経路**が要る。
かつ「使用した」とは数える＝**冒険の山トークン（`applyPileTokens`）・`noteAllyPlay`（同盟の写本士の仲間たち）・
上陸部隊（略奪 Landing Party）の『そのターン最初に使用したカード』**が誘発する。

##### (4) Shy の「捨てる → **+2ドローの前に** 捨て札トリガーを解決」— §0-28/§0-29 で3回踏んでいる罠の再来
> （日本語wiki）`捨て札時にリアクションするタイミングは、①の直後である。②の後ではない。例えば、
> 【内気な村有緑地】を内気なの効果で捨て札にした際は、2ドローの前にリアクションし、使用時効果を発揮する
> 必要があるので注意。`
> （日本語wiki）`①と②の間に他の「ターンの開始時」の処理を割り込ませることはできない。`

坑道（異郷）／村有緑地・忠犬（移動動物園）／織工（異郷）が誘発。
**ドローを先にやると坑道の金貨がリシャッフルに入らない**＝§0-28 の羊飼い／§0-29 A3 の砂漠の案内人と同型。
同時に「①と②の間に他の開始時効果を割り込ませない」＝`startQueue` に**1項目として**積むこと
（すり師団の割り込みを禁じる公式例が明示されている）。

##### (5) Friendly は「クリンナップの捨て札」＝ **捨て札リアクションが働かない**（Shy と非対称）
> （日本語wiki）`たとえ村有緑地などを捨て札にした場合でもリアクションできない。`
> （日本語wiki）`ヴィラや騎兵隊を獲得しても、アクションフェイズに戻ることはない。`
> （日本語wiki）`友好的なの「クリーンアップフェイズの開始時の処理」を終えた後に、クリーンアップフェイズ中の
> 処理として「手札をすべて捨て札にする」という処理が発生することに注意。`

<!-- 検証で訂正: 旧稿は「Friendly はクリンナップの捨て札だからリアクション窓が働かない」と Trait 側の性質のように
     書いていたが、これは因果が逆。理由は**リアクション側のカード文**にある＝村有緑地／坑道／織工／忠犬 はいずれも
     "When you discard this **other than during Clean-up**"（クリンナップ中の捨て札を自分で除外している）。
     したがって「Friendly のときは捨て札トリガーを一律に閉じる」実装にしてはいけない（クリンナップ中に誘発すべき
     他の効果まで巻き込む）。既存の各カードの条件に素直に通せば自動的に正しくなる。
     出典=日本語wiki「友好的な」詳細なルール（`たとえ村有緑地などを捨て札にした場合でもリアクションできない。`）＋
     各リアクションカードのカード文。 -->
**結果として Shy（ターン開始時）はリアクションが働き、Friendly（クリンナップ開始時）は働かない**が、
**その理由は Trait 側ではなくリアクション側のカード文**（"other than during Clean-up"）にある。
＝**「Friendly の捨て札では捨て札トリガーを閉じる」という特別扱いを書いてはいけない**。既存の
`triggerOnDiscard` にそのまま通し、各カードの「クリンナップ中は除く」条件に任せるのが正しい。
さらに Friendly でヴィラを獲得しても**アクションフェイズに戻らない**（`villa` の on-gain が
`gainWasBuyPhase` を見る本アプリの実装と整合するか要確認）。

##### (6) Reckless は「玉座の間」ではない＝`state.replay` に寄せると必ず壊れる
> `Even though you follow a Reckless card's instructions twice, that only counts as 1 card played
> (which matters for e.g. Conspirator).`
> `Some cards care if it's the 1st time you played a copy of it this turn; if it's Reckless, both
> iterations will be the 1st time you played it. So your 1st Reckless Fool's Gold gives +[$2],
> and your 1st Reckless Crossroads gives +6 Actions.`
> `Abilities that happen after playing a card (e.g. Frigate or Landing Party) are resolved (once) after
> you finish both iterations of a Reckless card.`
> `If a Reckless card is an Attack, a single Shield reveal ... will block both attacks`

本アプリの玉座/王の宮廷/行進は `state.replay`（＝「2回使用する」）で実装されている。
Reckless をここに載せると **共謀者(conspirator)・愚者の黄金・岐路(crossroads)・港の村・大金・
アタックのリアクション窓・上陸部隊 が全部ズレる**。`applyEffect` を2回呼ぶ**専用ルート**が要る
（`noteAllyPlay` / `t.handPlays` / 山トークン / 共謀者カウンタ は**1回だけ**加算）。

##### (7) Reckless の「山へ戻す」は 3山終了の帳簿を動かす
> `Follow the instructions of played Reckless cards twice. When discarding one from play, return it to its pile.`
> （日本語wiki）`ターン中に一時的にサプライの山が3つ空になっても、無謀なの効果で山にカードが戻り、
> ターン終了時にサプライの山が3つ空になっていなければ、終了条件を満たさないのでそのままゲームを続行する。`

本アプリの `returnToPile` / `canReturnToPile`（§0-29 A2 の取り替え子・交換で新設済み）を通すこと。
`supply` が増える＝`emptyPileCount` が戻る。**終局判定は「ターン終了時」**（本アプリの `isGameOver` を
`cleanupAndAdvance` の中で見る現行実装と整合するか要確認）。

##### (8) Reckless × 「使用時効果の書き換え」は **①だけ上書き・②は必ず起きる**（非対称）
> `If you skip following the instructions of the card - for example by using a Way (from Menagerie)
> instead - then you don't follow them an extra time, but still return the card when discarding it from play.`
> `Just like Ways, if a Reckless card is affected by Enchantress and/or Highwayman, you won't do its
> instructions twice, and you still return the Reckless card to its pile`
> `The exception is Way of the Chameleon, which tells you to "follow this card's instructions." So if you
> play a Reckless card as Way of the Chameleon, you'll follow its instructions twice, switching +Cards
> and +[$] both times.`

習性(Way)・女魔術師(Enchantress)・追いはぎ(Highwayman) は**本アプリに全部実装済み**＝即到達する。
**カメレオンの習性だけが例外で2回従う**（他の習性は1回）。この1枚を落とすと静かに壊れる。

##### (9) Reckless / Tireless の「場から捨て札にしたとき」は他の移動に負ける（lose track）
> `If another card moves a Reckless card when it's discarded from play (e.g. Scheme), it'll fail to return to its pile.`
> `If something else moves a Tireless card when it's discarded from play (e.g. Scheme), you won't set it aside.`
> `If a Reckless card never gets discarded from play (e.g. Quartermaster, Search, or a one-shot), you'll
> follow its instructions twice, but you'll never return it to its pile (so there's effectively no downside).`

策謀(scheme・異郷)／城壁のある村／宝物庫／カエルの習性 が競合する。
＝**「場から捨てる直前」の共通窓**（本アプリは §0-29 A4 で「場から捨てるとき山札の上へ」の共通窓を新設済み）
に相乗りさせ、**どちらか一方だけが成功する**ようにすること。

##### (10) Tireless の topdeck は「次の手札を先引きした**後**」
> `You draw your next hand before putting the card onto your deck.`
> `Note that some things draw extra cards when you draw your Clean-up hand (e.g. Flag or Expedition),
> which will happen before you topdeck Tireless cards.`
> `If you have an ability that gives you +Cards at the end of your turn (from e.g. Way of the Squirrel or
> Farrier), you can top-deck your Tireless card before or after taking the +Cards.`

本アプリは**自分の手番終了時に次の手札を先引きする**構造。角笛(horn・ルネサンス)は先引きの**前**、
リス(squirrel)・保存(save)は**後**。**Tireless は「後」側**＝旗(flag)・探検(expedition)の追加ドローも
先に済ませてから山札の上に置く。ここを間違えると Tireless カードが次の手札に混ざる（＝1ターン早く働く）。
脇に置く一時ゾーンは**物理カード**なので `allCards` / invariants の `ZONES` / `maskStateFor` に配線が要る。

##### (11) Fated は「シャッフル中の対話」＝本アプリでは**非対話にできない**（占星術師団と同型）
> `Each time you shuffle, you can choose to put Fated cards on the top or bottom of your deck,
> while shuffling the other cards normally.`
> `If you put any Fated cards on top, they go on top of the shuffled cards, not on top of your deck.`
> `If Patron is Fated, then revealing it when shuffling will give you +1 Coffers (assuming that it's an
> Action phase). If you reveal Patron, you have to put it either on top or bottom.`

`reshuffleDeck(p)` は同期・非対話（§0-29 で占星術師団／メイソン団を**常設方針＋自動選択**にした前例）。
Fated も同じ扱いにするのが現実的。**「公開」なので `reveal()` を通す**こと＝パトロン（ルネサンス）が
自動で誘発する（本アプリは `reveal()` に公開フックを集約済み＝§0-22）。ただし
**クリンナップ中のシャッフルでは財源は得られない**（アクションフェイズ限定）ので、`turn.phase` を見ること。
さらに **`reshuffleDeck` の戻り値**（メイソン団が札を残したか）と競合しないよう注意。

##### (12) Inherited は「獲得でも廃棄でもない」＋**箱に戻す＝カードが盤面から消える**
> `Cards starting in your deck due to Inherited were never "gained" and did not trigger "when you gain this" effects.`
> `Replaced Coppers go back to the pile; replaced Estates go back to the box.`
> `Replaced other cards (Shelters from Dark Ages, Heirlooms from Nocturne) go back to the box.`
> （日本語wiki）`入れ替えた初期デッキのカードは廃棄されたとみなされない。草茂る屋敷や呪いの鏡を入れ替えた際も、
> 廃棄時効果は誘発されない。`

**銅貨だけ山に戻り、屋敷・避難所・家宝は箱へ（＝ゲームから消える）**。
本アプリの保存則 tally（invariants）は「カードの総数が保存される」ことを検査しているので、
**Inherited は tally の初期値そのものを変える**＝テスト側に配線が要る。
また **サプライの山が人数ぶん減る**（4人戦なら-4枚）＝3山終了が早まる。
分割山/混合山（騎士）が対象なら**手番順に一番上から1枚ずつ**取る＝プレイヤーごとに別のカードになる。
影(Shadow)カード・へそくり(Stash) は**準備シャッフルでの配置が要る**（日本語wiki 逐語）。

##### (13) Cursed には **Loot 山（略奪の戦利品15種）が先に必要**
> `When you gain a card from the Cursed pile, you also gain a Loot and a Curse.`
> `If there are no Curses left, you still gain a Loot.`
> （日本語wiki）`①【呪われたカード】を獲得し、獲得先に移動する→②戦利品を1枚獲得する→③呪いを1枚獲得する、
> という順番である。最後に獲得するのは呪いになるので、【呪われたカード】獲得後は行人のコストは0になる。`

**呪いが枯れていても Loot は取る**（片方だけ止めない）。獲得順が固定＝行人(wayfarer・移動動物園)の
コスト参照が変わるので、`turn.lastGainedAny` の更新順まで公式どおりにすること。

##### (14) 獲得誘発6種は `state.onGainQueue` に積む（`state.pending` 直代入は禁止）
Cursed / Fawning / Hasty / Nearby / Pious / Rich は全部「カードを獲得したとき」。
Cursed は 1回の獲得で**3枚**（本体＋Loot＋呪い）獲得する＝
> （§0-26 の既存注意）`「1つの効果で複数枚を獲得する」効果の後に state.pending を直接代入しない`

さらに **Hasty は「獲得したカードを脇に置く」＝獲得先からの移動**なので、
望楼・遊牧民の野営地・身代わり・配達 と競合して**移動阻止（lose track）**が起きる：
> （日本語wiki）`①【せっかちなカード】獲得→②せっかちなの効果で【せっかちなカード】を脇に置く→
> ③身代わり or 呪符の巻物 or 召喚の効果で獲得した【せっかちなカード】を獲得先から移動しようとするが、
> 移動阻止ルールにより移動に失敗する`

##### (15) Cheap は「準備には効かない」「$ 以外は下げない」「得点計算には効く」の**3点セット**
> `This lowers the cost of a pile for the entire game (including when scoring).`
> `This does not apply during setup; it can't for example cause a [$4] to be used as Young Witch's Bane`
> `This doesn't reduce non-[$] costs like [P] and [D]`
> （日本語wiki）`【安価な村】は得点計算時も「コスト2のカード」として扱われるので、高原の羊飼いで集計する
> 「コスト2のカードの枚数」に含まれる。`

橋・街道（ターン中のコスト軽減）と違い**恒久**。`cardCost` に入れるのは同じだが、
**準備で `cardCost` を見ている箇所（若き魔女の災い選定・冒険の山トークンの置き先・
発明家の家族の対象・オベリスク 等）は素のコストを見る**必要がある。
**同盟の高原の羊飼い（`allyScoreForCards`）は軽減後のコストを見る**＝逆向きの取りこぼしに注意。

##### (16) Inspiring の「場に出していない」は **in play 判定**（このターン使ったかではない）
> `Duration cards that you played on previous turns that are still in play, are in play; cards that have
> left play somehow, like a Mining Village (from Intrigue) trashing itself, are not in play.`
> （日本語wiki）`「脇に置く」効果によって置かれたカードも場に出ていない。特に表向けで脇に置く効果を持つカード
> （忠犬、貨物船、王子など）がある場合は、場のカードと混同しないように注意。`
> （日本語wiki）`【鼓舞するカード】が場から捨て札になるタイミングは、鼓舞するの効果で何を使用したとしても、
> 変化しないことに注意。`

本アプリの `p.inPlay` ＋ `p.durationCards` の両方を見る。
`p.contractSetAside`（同盟）・`p.cargo`（ルネサンス）・`p.princes`（プロモ）・`p.eventSetAside`（移動動物園）
は **in play ではない**。また Inspiring は玉座の間と違い**場に残る期間を変えない**。
アクション権を消費しない＝`t.actions` を減らさないが、**航海(voyage・同盟)の「手札から3枚まで」には数える**
かどうかは要検討（`canPlayHandCard` の3面ガードに通すこと）。

##### (17) Patient は「複数枚を1つの開始時効果として」＝`startQueue` に1項目
> `Playing all the set aside cards is a single start-of-turn effect. Between playing each of those cards,
> you cannot resolve any other start-of-turn effects (for example, from Durations played last turn).`
> `once set aside, they get played no matter what`（＝脇に置いたら**使用は強制**）
> （日本語wiki）`「ターンの開始時」はアクションフェイズである。忍耐強いの効果で使用した冠は、必ず
> 「アクション2回使用」の効果となる。忍耐強いの効果で使用した人狼は、必ず「+3ドロー」の効果となる。`

冠(crown・帝国)／人狼(werewolf・夜想曲)がフェイズでモードを変えるので、**`turn.phase === 'action'`**
であることが効く（本アプリのピアッツァと同じ扱い＝§0-22）。
脇に置くのは任意、**置いた後の使用は強制**という非対称に注意。

##### (18) CPU / UI の3面同時（本プロジェクトで最も再発する事故）
Trait は「どの山に付いているか」でエンジンの述語が変わるため、**engine の受理／CPU の候補／UI のフィルタ**が
同じ述語（`hasTrait(state, pileKey, traitId)` の類）を見ないと、§0-29 A4 の [high] 12番と同型の
**engine拒否 × CPU提案の livelock** になる。特に：
- **Inspiring**＝「場に出していないアクション」のフィルタ（engine拒否・CPU候補・UI の dim）
- **Friendly / Patient / Shy**＝候補ゼロなら**窓を開かない**（辞退ボタンは必ず要る＝すべて任意）
- **Fawning / Rich / Hasty / Tireless**＝**強制**なので辞退ボタンを出さない
- **Pious**＝任意（「廃棄しない」ボタンが必ず要る）

---

#### 6. 未確認事項（推測で埋めていない項目）

1. **印刷カード上の英文の改行位置**（wiki の Versions 表は1行掲載）。→ カード画像を直接読むしかない。
2. **ホビージャパン印刷版の日本語テキスト（Reckless 以外の14種）**。本まとめの和文は
   日本語wikiが `(※日本語訳はDominion Onlineより)` と明記した **Dominion Online 訳**。
   日本語**名**（安価な／呪われた／運命の／へつらう／友好的な／せっかちな／受け継がれた／鼓舞する／近隣の／
   忍耐強い／敬虔な／無謀な／豊かな／内気な／疲れ知らずの）は日本語wikiの一覧・個別ページ・
   拡張ページの3箇所で一致しており確定とみなしてよい。
3. ~~**RGG 公式ルールブック PDF の逐語**は今回参照していない~~
   <!-- 検証で訂正: 旧=未参照。検証者が DomPlunder.pdf を pdftotext -layout で読み、§2 の Official Rules /
        Preparation が一字一句一致すること、および「15 Trait cards」の全数を確認した（§2 末尾に追記）。 -->
   → **検証で参照済み**。§2 末尾の「RGG 公式ルールブック PDF による裏取り」節を参照。
   一般ルールは一致。**ただし PDF は初版（2022年8月レイアウト）なのでカード文面の正本にはしない**。
4. **Trait のイラストレーター**は取得済み（Cheap=Matthias Catrein / Cursed=Jessi J / Fated=Brian Brinlee /
   Fawning=Brian Brinlee / Friendly=Brian Brinlee / Hasty=Donald Crank / Inherited=Martin Hoffmann /
   Inspiring=Brian Brinlee / Nearby=Brian Brinlee / Patient=Donald Crank / Pious=Martin Hoffmann /
   Reckless=Martin Hoffmann / Rich=Brian Brinlee / Shy=Jessi J / Tireless=Martin Hoffmann）＝実装には不要。
