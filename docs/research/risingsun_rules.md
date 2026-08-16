# 旭日（Rising Sun）＝公式ルール研究の正本

- 拡張＝**Dominion: Rising Sun**（第16拡張・**2024年8月10日**発売・Rio Grande Games）。
- **日本語の拡張名＝「旭日（きょくじつ）」**。⚠ 本プロジェクトが長らく書いていた「日の出づる国」は**誤り**だった
  （英語wiki `Rising Sun > Trivia > Official releases in other languages` の `Japanese: 旭日 (pron. kyokujitsu)` と、
  日本語wiki `wikiwiki.jp/dominiondeck` のページ名 `旭日` が**独立に一致**）。
- **300枚／実装対象50種**＝王国250（**25種**×10）＋ランダマイザー25＋**イベント10**＋**予言(Prophecy)15**。
- トークン＝負債40／**日の出(Sun)13**。
- **カードの機能エラッタは0件**（`Errata` ページの Rising Sun 節が空・Versions 表は `August 2024 / First edition` の1行だけ）。

作成＝2026-08-16。多エージェント研究（8群を分担収集 → **各群を別エージェントが一次資料で敵対検証** → 訂正を反映した確定版）。
確定した訂正 **43件**（[high] 2／[medium] 12／[low] 29）。**捏造・枚数過不足はゼロ**。

---

## ★実装前に必読（18項目）★

**ここだけは記憶ではなくこの文書を見ること。** 各項目の根拠は該当章にある。

### 新機構（新規は2つだけ）
1. **前兆(Omen)／予言(Prophecy)／日の出(Sun)トークン**
   ＝**王国に Omen が1枚でもあれば予言を1枚だけ配る**（Omen が何枚あっても1つ）。
   Sun トークンは **2人5／3人8／4人10／5人12／6人13**。
   **「+1 Sun」＝予言からトークンを1個取り除く。最後の1個を取り除いた瞬間に予言の効果が有効になり、以後ゲーム終了までずっと有効。**
   **「+1 Sun」は Omen カードの記載の一番最初に必ず来る**＝**予言はそのカードの残りの効果より前に発動しうる**
   （公式FAQ逐語＝`First the +1 [Sun] happens, which may trigger a Prophecy; then …`）。
   **全部取り除いた後の「+1 Sun」は何もしない**（空振りでも Omen の残りは普通に解決する）。
   - **Omen は6種**＝Mountain Shrine(5D) / Poet($4) / River Shrine($4) / Rustic Village($4) / Tea House($5) /
     **Kitsune($5)＝`Action - Attack - Omen`**。
   - **予言は「カード」ではない**（公式逐語＝`Prophecies are not considered "cards" at all`）＝
     `allCards` にも保存則 tally にも入れない。庭園/品評会/壁にも数えない。Sun トークンも非カード。
   - **予言は横型の「合計2枚まで」に数えない**（同盟の Ally とまったく同じ扱い）。
     公式の「最大2枚」の列挙は `Events, Traits, Landmarks, Projects, and Ways` で**予言が入っていない**。
     枠色は **iris blue（菖蒲色）**。**コスト欄は無い**。
2. **影(Shadow)カード＝5種**（Fishmonger$2 / Alley$4 / **Ninja$4＝`Action-Attack-Shadow`** / Ronin$5 / Tanuki$5）
   - **裏面が違うので山札から使える**。**シャッフルするとき「シャッフルした束の一番下」に置く**。
     **獲得したときは一番下に置かない**（シャッフルのときだけ）。底に置かれた後も普通に動く。
   - **アクションを使えるときならいつでも、山札のどこにあっても使える**（＝**アクション権を消費する**。
     Donald X. 逐語＝`you have to be allowed to play an Action, it doesn't get around that`）。
   - **玉座の間などが「手札からカードを使う」と言ったときも山札の影札を使ってよい**（本拡張の `Practice` も同じ）。
   - ⚠ **ただし手札にあるわけではない**＝`Alley` の「手札1枚を捨てる」・地下貯蔵庫・民兵の捨て札・書庫の手札枚数
     には**一切数えない**。**逆に庭園/品評会/絹の道など「所有カードの総数」には数える**（山札の底も所有カード）。
   - **裏面は5種とも別の絵**（wiki の `File:NinjaBack.jpg` 等5枚を実見して確定）＝
     **裏を見れば何の影札かまで分かる**。共通なのは帯の文言 `When shuffling this, put it on the bottom of your deck.` だけ。
     → **`maskStateFor` は「どの位置が影札か」ではなく「どの位置にどの影札があるか」を自分に見せる**設計にする。
   - **略奪の「運命の(Fated)」と一緒に底に置ける**（相対順は選べる）＝mix-all で同居する。
3. **負債(Debt)・イベント(Event)・持続(Duration) は既存機構**（帝国／冒険・帝国／全拡張）。**新規実装は不要**。

### 出荷済みの挙動に関わること（★最重要★）
4. **【2024エラッタ・帝国に遡及】負債は「そのターン中いつでも」返済できる**（購入フェイズ限定ではない）。
   旧ルールは wiki が `Prior official rules (amended by the release of the Rising Sun expansion)` として過去扱い。
   Donald X.＝`no more screwing over Black Market`（＝アクションフェイズの闇市場で負債持ちが詰むのが動機）。
   → **2026-08-16 に修正済み**（`REPAY_DEBT` の購入フェイズ判定を外し、UI の返済ボタンを全フェイズ共通に）。
5. **【同】負債を負うのは「購入」したときだけ**。**効果での獲得では負債を負わない**
   （逐語＝`Although buying a card with [D] in its cost gives you Debt tokens, gaining such a card in other ways does not.`）。
   → **2026-08-16 に修正済み**（`takeDebt` を `gain()` から `BUY` / `BLACK_MARKET_BUY` へ移した）。
   ルールブックの公式例 **`Tanuki trashing an Artist can gain a Daimyo`** がまさにこの経路＝**旭日を実装すると必ず踏む**。
6. **コスト比較は成分別**（既存 `costOf`/`costUpTo`/`costExact` が既に正しい）。公式例＝
   **`"Up to [$4]" は D を含むコストを含まない`**／**`$4 と 6D はどちらも他方より高くない`**／
   **`8D は 6D より高い`**／**`純粋な D コストには暗黙の $0 がある`**。
   → `Craftsman can't gain a Mountain Shrine`（5D は "up to $5" ではない）。
7. **持続を追加で使わせたカードも場に残る**＝公式が名指しする一覧は
   **Throne Room / Scepter / Mastermind / Specialist / Flagship / Daimyo**。
   ＝**略奪の決定D4「旗艦は持続を再演したら場に残す（例外なし）」と完全に一致**。**Daimyo も同じ実装**。
   ⚠ ただし本アプリには **§0-25/§0-28 の許容簡略化「玉座×持続では玉座が場に残らない」**が残っており、
   **Daimyo を足すと旭日単独セットでも見えるようになる**。
8. **【2025エラッタ】持続が場を離れたら以後働かない**（`If a Duration card leaves play somehow, it stops doing
   things on future turns.`）＋**玉座側の再演も止まる**。**印刷版ルールブック(2024)にはこの2文が無い**＝
   **wiki の現行版が正**。本アプリの現状は未調査＝**段階2の着手前に確認すること**。
9. **【2026エラッタ・未アナウンス】`Royal Galley`（同盟）＝脇に置かない**／**`Treasury`（海辺）＝捨てたときに誘発**
   （2022エラッタの差し戻し）。**どちらも `2026 Errata` ページに正式掲載されている**。
   → §「決定事項 D2」を見ること（**§0-29 A4 の決定を覆す**）。
10. **【2025エラッタ】`Capital`（帝国）＝`When you discard this from play, +[6D].`**（「その後 返済してよい」が消えた）。
    理由＝負債がいつでも返せるようになったので**冗長になった**だけ＝**挙動は同じ**。本アプリの実装は結果として正しい。
    ⚠ **`Errata` の要約ページには載っておらず、`Capital` の個別 Versions 表にしか無い**＝要約だけ見ると必ず取りこぼす。

### 実装で壊しやすいところ
11. **`Continue`（イベント・8D）＝購入フェイズからアクションフェイズへ戻る**＝**ヴィラ(Villa)と同じクラス**。
    闘技場の再武装／宝箱の再発動／公会堂・列柱の `gainWasBuyPhase` を必ず通すこと。
    **`Continue` だけが `Once per turn:` 付き**（他9イベントは入れない）。
    さらに **`River Shrine` は「このターンの購入フェイズで1枚も獲得しなかったか」を複数の購入フェイズを跨いで見る**。
12. **`Daimyo`（6D・`Action - Command`）＝「このターン、次に使う命令でないアクションを再使用する」**
    ＝**略奪の旗艦(Flagship)とほぼ同型**（旗艦は持続で「次回」、大名は「このターン中」）。
    **`Command` 種別が付いているのは無限ループ防止のためだけ**（公式逐語＝`it has no meaning beyond stopping
    these cards from playing each other.`）＝**`DOM.isType(card,'command')` の除外に Daimyo を足す**。
    公式＝**任意ではない**／**そのカードが自身を廃棄しても再使用する**／**大名2枚＋名匠なら名匠を計3回使う**。
13. **`Riverboat`（$3）の準備**＝**使っていない非持続の「ちょうど $5」のアクション1枚を脇に置く**。
    「動かさずに使用する」＝**はみだし者と同じ命令型の処理**（日本語wiki が明示）＝**`playAsCommand` を通す**。
    ⚠ **その脇札自身の setup も走らせる**必要がある（Divine Wind の逐語 `Do any Setup for them that they require`）。
14. **`Approaching Army`（予言）＝準備でアタックの王国カードの山を1つ追加する**（既にアタックがあっても）。
    **11山目は普通のサプライ山**（購入可・獲得可・**3山終了に数える**）＝**若き魔女の災いカード(Bane)と同型**。
    **予言が発動しなくても準備の追加は起きる**。
15. **`Divine Wind`（予言）＝最後の Sun を取り除いたとき、王国の10山（＋11山目）を撤去して新しく10種を配り直す**
    ＝**本アプリに前例が無い破壊的操作**。公式逐語で決まっていること＝
    **廃墟/ポーション/プラチナ・植民地は撤去しない**／**新しい10種の setup は走らせる**／**家宝は配らない**／
    **避難所やプラチナ・植民地の採否は決め直さない**／**連携が出て Ally が未決なら Ally を配る**／
    **予言は配り直さない**／**撤去した山は空山に数えない・カードを戻せない**／
    **撤去した山のトークンは無くなる**／**特性(Trait)とオベリスクは撤去した山にも効き続ける・Bane は Bane のまま**／
    **略奪の調査(Search)は山の撤去では誘発しない**／**「このゲームで使う」型（シャーマン等）は撤去後も機能する**。
16. **`Kind Emperor`（予言）は発動した瞬間に即時発火する**（`When the last [Sun] is removed, this applies
    immediately, in the middle of resolving the Omen, and **only the player who removed the [Sun]** gains an Action then.`）
    ＝**予言の発動を「次のターン開始時にまとめて」に遅延させる実装は公式違反**。
    **`Divine Wind` も同じく「最後の Sun を取り除いたとき」型**＝**汎用の発動フックを作ること**（専用フックにしない）。
17. **`Biding Time`（予言）＝クリンナップ開始時に手札を伏せて脇に置き、次の自分のターン開始時に手札へ加える。
    置き換わるのは「捨てる」だけで、5枚のドローは普通に行う**（`you still draw 5 cards`）。
    ⚠ ここを「手札が空になる」と読むと**リアクション不能・捨てアタック空振り**という誤った実装になる。
18. **`Rapid Expansion`（予言）＝アクションと財宝を「せっかちな(Hasty)」にする**
    （公式が `makes all Actions and Treasures Hasty` と名指し）＝**略奪の特性「せっかちな」を本アプリは実装済み**
    （`p.eventSetAside`＋`event_play` に相乗り）＝**その機構を流用する**。

---

## 決定事項（D1〜D5）

### D1. 日本語のカード文面＝**Dominion Online 訳で統一**（略奪の決定3と同じ）
日本語wiki の個別カードページは**英語原文と日本語訳を同じ表に並記**しており、その日本語訳は
`※日本語訳はDominion Onlineより` と明記されている。**ホビージャパン印刷版の逐語を50種ぶん揃える手段が無い**
（ユーザーは日本語版の現物を持っていない）。**カード名は日本語wiki のページ名＝印刷版準拠**を使う。
⚠ **印刷版と文面が違うと日本語wiki 自身が書いているカードが6枚**＝
**川船／好機到来／米／絵師／進歩／盛大な取引**（各ページの「余談」節）。
とくに **`Biding Time`＝「好機到来」は日本語wiki 自身が「財産目当て並みの誤訳」と書いている**
（原意は「好機を**待つ**」。DO の未発売時の訳は「待機」だった）。**それでも印刷版の名前は「好機到来」**なので採用する。

### D2. **`Royal Galley`（同盟）と `Treasury`（海辺）の 2026エラッタを採用する**（＝§0-29 A4 の決定を覆す）
- **事実**＝`2026 Errata` ページに **`Royal Galley — Don't set the played card aside to avoid problems with the
  2025 Duration rule change.`** と **`Treasury — Triggers when discarded instead of at the end of the Buy phase
  (reverting the 2022 Errata).`** が正式に掲載されている
  （同ページ冒頭＝`A few individual cards were changed during 2026 without any official announcement being made.`）。
- **§0-29 A4 は「2026年5月に *announce* されたが未印刷で公式FAQも未更新」を理由に採らないと決めていた**が、
  **その後 wiki の年次エラッタページに正式に載った**。
- **一貫性の根拠**＝略奪の決定D1で **`Journey`（旅行）は未印刷の2023エラッタを採用している**
  （理由＝正式なエラッタ行があるから／同じエラッタの `mission` を既に採用済みだから）。**同じ基準を適用する**。
- → **段階2の前後どちらでもよいが、別コミットで直すこと**（旭日とは独立した既存拡張の修正）。

### D3. **影札のオンライン可視性**（`maskStateFor`）
公式は「裏面が5種とも違う」ので、物理的には**相手の手札・脇にある影札は種類まで見える**
（唯一の前例＝`Stash` の Official FAQ `you'll be able to tell when it's in other players' hands, or set aside for a Haven`）。
一方**相手の山札の中は束なので見えない**。→ **実装方針**：
- **必須**＝**自分の山札の「どの位置にどの影札があるか」を自分に見せる**（見えないと山札からプレイする操作ができない）
  ＝`maskStateFor` の私的看破リストに追加（§0-21 偵察隊／§0-28 夜警／A4 粉屋・歩哨と同じクラス）。
- **相手の手札・脇の影札を見せるかは段階2で判断**（本アプリは相手の手札を枚数だけにしている＝忠実性 vs 既存設計の衝突。
  §0-30 の「戦利品の山＝一番上も見せない」と同じクラスの判断）。**据え置くなら許容簡略化として明記する**。

### D4. **シャッフル時の影札の相対順は自動**（許容簡略化）
公式は「影札が複数あるとき／運命の(Fated)と同居するとき」だけ底での**相対順を選べる**が、
本アプリの `reshuffleDeck` は**同期・非対話**（§0-22 星図・§0-29 占星術師団・§0-30 運命の と同じ難所）。
**戦略的影響はほぼゼロ**（底の並び順が効くのはそのシャッフルで山札を底まで掘り切る極端な場合だけ）なので**自動で決める**。
※影札を底へ移す処理自体は `reshuffleDeck` の「運命の」ブロックの直後に足すだけでよい（**同関数がシャッフルの唯一の入口**）。

### D5. **`Approaching Army` の11山目が 特性(Trait)／災いカード(Bane) の候補になるか＝公式の明文が無い**
3ページを全文取得しても明文が無いことを検証側も確認した。**本アプリは §0-30 P4 で「特性の選出は準備手順の最後
（災いカードの山も候補）」と決めている**ので、**追加の山も「配られた王国カード」に含める**（自然な読み）。
→ **許容簡略化として明記する**。

---

## 段階1・段階2 の計画

### 段階1＝カタログと画像
- `DOM.CARDS` **+25**（560→**585**）／`DOM.LANDSCAPES` **+25**（201→**226**）＝合計 761→**811枚**。
- **新種別 `omen`（前兆）**・**`shadow`（影）**＝縦型（前例＝同盟の `liaison`／略奪の `loot`）。
- **横型の新 kind `prophecy`（予言）**＝`tools/build-landscape.js` にスキンを新設。
  **iris blue（菖蒲色）**・**コスト欄なし**（前例＝同盟の `ally`＝濃い藍／略奪の `trait`＝深い臙脂）。
- ⚠ **`DOM.STAGE1_POOLS` に必ず入れる**（今は `[]`。入れないと闇市場に「買っても何も起きない死に札」が $0 で並ぶ）。
- ⚠ **影札は裏面が違う**＝カード画像（webp）の扱いを決める（表だけでよいか、裏も要るか）。
- ⚠ **id 衝突**＝既存761枚と機械照合すること（`rice`/`samurai`/`ninja` 等は未使用だが `artist`↔`artisan`、
  `change`↔既存語 に注意）。

### 段階2＝engine/CPU/UI（推奨バッチ順）
| バッチ | 内容 | 理由 |
|---|---|---|
| **R1** | **前兆/予言/Sun トークンの基盤**（`state.prophecy`・`state.sunTokens`・`+1 Sun` の共通入口・**汎用の発動フック**） | 予言15種が全部これに乗る。Ally の選定（§0-29 A1）と同型 |
| **R2** | **影(Shadow)の基盤**（`reshuffleDeck` で底へ／山札から使う経路／`maskStateFor`／玉座等の「手札から」窓に並べる） | 王国5種と横断機構 |
| **R3** | 素直な王国カード（$2〜$5 のうち新機構に触らないもの） | — |
| **R4** | **予言15種**（`Divine Wind` は最後） | R1 の上 |
| **R5** | **イベント10種**（`Continue` はヴィラ経路） | 既存 `BUY_EVENT` の上 |
| **R6** | 残りの王国（`Daimyo`／`Riverboat`／`Artist`／`Rice`／`Samurai` ほか） | 命令・準備・持続 |
| **R7** | **CARD_SET 昇格**（`risingsun` 固定10種＋`risingsun-events`＋`risingsun-prophecies`＋`random-risingsun`＋mix-all 16→17拡張） | — |

**新しい pending は必ず4点セット**（engine reducer＋`PLAYER_ACTIONS`＋CPU `decidePending`＋UI `viewPendingModal`）。
**述語を1つ足したら、窓を開く条件・受理・CPU の候補・UI のフィルタの4面を同時に直す**（本プロジェクトで最も再発する事故）。

---

## 一次資料（このPCに保存済み）

| ファイル | 内容 |
|---|---|
| `C:/tmp/risingsun_research/rulebook.pdf` / `rulebook.txt` | RGG 公式ルールブック **2024年版**（`pdftotext -layout` 済み・119KB）。**一般ルールの逐語の正本** |
| `C:/tmp/risingsun_research/_expansion.txt` | 英語wiki `Rising Sun`（拡張の総論・ライブ） |
| `C:/tmp/risingsun_research/jp_expansion.txt` / `jp/` / `g0_jp_pairs.md` | 日本語wiki `旭日` ＋ 個別50ページ ＋ **EN/JP 対応表（機械抽出）** |
| `C:/tmp/risingsun_research/g1〜g8_*.md` | 収集doc（8群） |
| `C:/tmp/risingsun_research/v_*.md` | 敵対検証doc（8群・確定訂正43件） |
| `C:/tmp/risingsun_research/m1〜m8_*.md` | **訂正を反映した確定版**（＝下記の各章の元） |

### 取り方（ツール）
- **英語wiki**＝`node tools/wikidirect.js "<Page>" [...]`（Anubis を自力で突破・**常にライブ**・数秒）。
  生HTMLは `RAW_DIR=<dir>`。**2026-08-16 に 301/302 のリダイレクト追従を追加した**
  （拡張の総論ページは正規URLへ 301 されるので、追わないと本文が1バイトも取れない）。スペースは `%20` ではなく `_`。
- **日本語wiki**＝`python tools/jpwiki.py "<ページ名>" [...]`。
  ⚠ **数ページ続けて叩くと 429**（50ページ中36ページが 429 になった）＝**6秒間隔＋バックオフ再試行**を実装済み。
  **エージェントを並列で走らせると必ず全滅する＝日本語wiki だけは逐次で取ること。**
- ⚠ **区切り線（`<hr>`）は strip 済みテキストでは消える**＝**生HTML で数える**か、
  **日本語wiki の並記表に出る `--------------------` を見る**。

---
