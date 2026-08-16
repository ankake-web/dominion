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


<!-- ===== m1_mechanics.md ===== -->

# 旭日（Rising Sun）＝公式ルール正本

## 第1章 一般ルールと新機構

確定版作成＝2026-08-16／**最終仕上げ＝2026-08-16（批評 `c_mechanics.md` 反映後）**。
入力＝`g1_mechanics.md`（収集）／`v_mechanics.md`（敵対検証・訂正8件）／`g0_jp_pairs.md`（日本語wiki の EN/JP 対応）
／`c_mechanics.md`（完全性の批評＝[must] 8件・[nice] 10件）。
**検証docの訂正8件はすべて採用**（うち [medium] 1件は自分で画像5枚を実見して再確認した）。
**さらに私が一次資料・実コードに当たって追加した訂正が6件**（うち [high] 1件＝§3）。
**批評の [must] 8件はすべて反映し（うち2件は実コードを読んで内容を精密化した）、[nice] 10件も全部拾った**。本章末に一覧。

> ⚠ **本章が引用する `js/engine.js` の行番号は「`d6cf76d` ＋作業ツリーの未コミット変更」時点のもの**。
> このファイルは**現在も別セッションが編集中**で（`git status` に `M js/engine.js`）、行番号は数行ずつ動く。
> **必ず関数名で grep すること**（行番号は目安）。本章の関数名はすべて 2026-08-16 に `grep` して実在を確認した。

### 0-0. 章の前に：拡張の日本語名は **「旭日（きょくじつ）」**

本タスクの指示文と PROGRESS の旧記述にある **「日の出づる国」は誤り**。

- 英語wiki `Rising Sun > Trivia > Official releases in other languages` 逐語：
  `Japanese: 旭日 (pron. kyo'kujitsu)`（`_expansion.txt` 851〜856行・`vm_6.txt` の同行で再取得して一致）
- 日本語wiki（wikiwiki.jp/dominiondeck）のページ名も `旭日`。
- 既にリポジトリの `docs/research/risingsun_rules.md`（別セッションが起草した要約の正本）でも訂正済み。

**種別・機構の訳語**（日本語wiki のカードページ表・英語wiki の "In other languages" で一致）：
**Omen＝前兆／Prophecy＝予言／Shadow＝影／Sun トークン＝Sunトークン（日本語wiki も "Sun" のまま）**。

### 0-1. 使った一次資料

| # | 資料 | 取得 |
|---|---|---|
| A | **RGG 公式ルールブック（2024-06-13 組版・2024年8月発売）** | `rulebook.pdf` → `pdftotext -layout` 済み `rulebook.txt` |
| B | 英語wiki `Rising Sun`（拡張ページ・ライブ） | `_expansion.txt` ／ 再取得 `vm_6.txt` |
| C | 英語wiki `Shadow` / `Omen` / `Prophecy` / `Materials` | `vm_1.txt` |
| D | 英語wiki `Card-shaped thing` / `Debt` / `Event` / `Duration` | `vm_2.txt` `vm_2b.txt` |
| E | 英語wiki `Errata` / `2024 Errata` / `2025 Errata` / `2026 Errata` | `vm_3.txt` |
| F | 英語wiki `Approaching Army` / `Young Witch` / `Fated` / `Stash` | `vm_4.txt` |
| G | 英語wiki `Riverboat` / `Trait` / `Daimyo` / `Practice` | `vm_5.txt` |
| H | 英語wiki `Continue` / `Kitsune` / `Ronin` / `Tanuki` / `Mountain Shrine` / `Alley` / `Fishmonger` / `Capital` | `vm_7.txt` `vm_8.txt` `vm_10.txt` |
| I | 英語wiki `Return to Action phase`（＝`Action phase` へのリダイレクト） | `g6_returnphase.txt` |
| J | **影札の裏面の実画像5枚** | `_ninja.jpg` `_ronin.jpg` `_tanuki.jpg` `_alley.jpg` `_fishmonger.jpg`（**私が5枚とも実見**） |
| K | 日本語wiki の各カードページ（EN/JP 併記表） | `g0_jp_pairs.md` |

⚠ **ルールブックPDFのテキスト化ではコスト記号・負債記号・Sun記号がすべて画像なので消える**
（例＝66行目 `costing exactly  that is not being used` のように空白になる）。
本章の英語逐語は **A の文をベースに、B/C/D（記号を `[$5]` `[6D]` `[Sun]` の形で出力する）で記号を埋め戻したもの**。
**記号を埋めた箇所は角括弧で示す。**

⚠ **A（ルールブック）と B（拡張ページ）は文が完全一致ではない**（＝訂正④）。
`Debt` 節と `Events` 節は B が帝国/冒険と共用の wiki 文になっており、項目が1つ欠けていたり言い回しが違う。
**本章では A（ルールブック）の文を正とし、B からは記号だけを取っている。**
記号が B に無い箇所（`+[2D]` の例文など）は**「A の文＋記号は同一文書内の他の出現から確定」**であることを明記する。

---

## 1. 前兆(Omen)／予言(Prophecy)／Sunトークン

### 1-1. 逐語（ルールブック p.3〜4「Omens & Prophecies」節の**全文**）

> Rising Sun has Omens and Prophecies. Prophecies are rules that will eventually apply to the game;
> Omens provide a way to tick down time until the Prophecy.
>
> - In every game with one or more Omen cards, deal out one Prophecy for it. Only use one Prophecy
>   no matter how many Omens you have.
> - Put 5 Sun tokens on the Prophecy for 2 players, 8 for 3 players, 10 for 4 players, 12 for 5 players, and
>   13 for 6 players.
> - "+1 [Sun]" means, remove a token from the Prophecy. Then if it was the last token, the rules text on
>   the Prophecy becomes active, right then and for the rest of the game.
> - "+1 [Sun]" always appears first on Omens, before anything else the card does.
> - "+1 [Sun]" does nothing else once all the tokens are removed.
> - Prophecy text does nothing until the last Sun token is removed.

（A: `rulebook.txt` 109〜126行。B: `_expansion.txt`、C: `Prophecy` ページ "Omens & Prophecies" と
**3ソース完全一致**＝私も `rulebook.txt` 100〜126行を開いて1文ずつ照合した。）

### 1-2. 準備の逐語

> In games using an Omen, shuffle the Prophecies, and deal out one to be used this game. Put a number
> of Sun tokens on it based on the player count; see the Omens and Prophecies section. If the Prophecy is
> Approaching Army, add an Attack card pile to the game (even if there already is one).

（A: `rulebook.txt` 62〜64行 ＝ C: `Prophecy` ページ "Preparation"、完全一致。）

**＝予言はゲーム開始時に1枚だけ表向きで場に出る＝最初から全員に見えている**
（Donald X. 逐語＝`Prophecies are landscapes that change the game, but don't apply at the start of the game;
it takes Omens being played a certain number of times before they happen.`）。

### 1-3. 人数別トークン数（4ソースで一致）

| 人数 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|
| Sunトークン | **5** | **8** | **10** | **12** | **13** |

箱に入っているのは **13個**＝**6人戦がちょうど上限**。
（`rulebook.txt` 39行 `13 Sun tokens` ／ `Rising Sun` Info ／ `Materials` ／ `Omen` ページ ／
Donald X. `It's 5 tokens with 2 players, 8 with 3, 10 with 4, 12 with 5, and 13 with 6.` の**5ソース一致**。）

### 1-4. 前兆(Omen)＝**6種**

英語wiki `Omen` ページ "List of Omen cards"（種別は**各カードページの `Info > Type(s)`**＝訂正②）：

| コスト | EN | **JP** | 種別 | 日本語カード文（DO訳） | `<hr>` |
|---|---|---|---|---|---|
| **[5D]** | Mountain Shrine | **山の社** | Action - Omen | +1 Sun／+2 コイン／手札1枚を廃棄してもよい。／その後、廃棄置き場にアクションカードがある場合、+2 カードを引く。 | 0 |
| **[$4]** | Poet | **歌人** | Action - Omen | +1 Sun／+1 カードを引く／+1 アクション／山札の一番上のカードを公開する。それがコスト3以下の場合、手札に加える。 | 0 |
| **[$4]** | River Shrine | **川の社** | Action - Omen | +1 Sun／手札を最大2枚廃棄してもよい。／クリーンアップフェイズの開始時、このターン購入フェイズにカードを獲得しなかった場合、コスト4以下のカード1枚を獲得する。 | 0 |
| **[$4]** | Rustic Village | **田舎の村** | Action - Omen | +1 Sun／+1 カードを引く／+2 アクション／+1 カードを引くために手札2枚を捨て札にしてもよい。 | 0 |
| **[$5]** | Kitsune | **狐** | **Action - Attack - Omen** | +1 Sun／次のうち異なる2つを選ぶ：「+2 アクション」「+2 コイン」「他のプレイヤーは全員、呪い1枚を獲得する」「銀貨1枚を獲得する」 | 0 |
| **[$5]** | Tea House | **茶屋** | Action - Omen | +1 Sun／+1 カードを引く／+1 アクション／+2 コイン | 0 |

＝**6種**（数え直して6。**アタックは Kitsune 1枚だけ**）。
Donald X. 逐語で裏取り：
> There are 6 Omens and 15 Prophecies, and you only use one Prophecy per game, even if there are
> multiple Omens.
> —Donald X. Vaccarino, *Rising Sun Previews 1: Omens and Prophecies*, August 2024

**⚠ [訂正G＝批評 M8・私が一次資料で再確認] 狐(Kitsune)の選択肢は「+2 アクション」が先、「+2 コイン」が後**。
確定版の初稿は逆に書いていた。出所の `g0_jp_pairs.md` は**同じ行の中で EN 列が `+2 Actions ; +$2` なのに
JP 列が「+2 コイン」「+2 アクション」**という内部矛盾を起こしており（日本語wiki `jp/retry2.txt` 15〜38行の
転記そのものが乱れている＝私が両方を実見）、**公式の並びは英語wiki の `Card text` と `Versions` 表の2箇所とも
`Choose two different options: +2 Actions ; +[$2] ; each other player gains a Curse; gain a Silver.`**
（`vm_7.txt` 393〜399行・507〜513行）。
🛑 **本アプリは「選ぶ」カードを `ELDER_CHOICE_ORDER` に *カード記載順で* 登録し、解決も必ず記載順**と決めている
（§0-29 A4）。**正本の表がそのまま `DOM.CARDS.kitsune.text` になり、それが webp に焼かれ、それが解決順になる**ので、
ここを直さずにカタログを起草すると**印刷と違う順で並ぶカードを焼き直すはめになる。**

**版**：6種とも `First edition / August 2024`。機能エラッタなし。
**⚠ Poet の「コスト3以下」は `[$3]` で確定**（訂正③）＝`Poet` ページ `Card text` の
`Reveal the top card of your deck. If it costs [$3] or less, put it into your hand.` ＋
日本語wiki の「コスト3以下」＋`Debt` ページの例文 `Poet cannot draw a Mountain Shrine, because [5D] is not "up to [$3]."`
の**3ソース独立一致**。g1 が保留にしていたが保留の必要は無い。

### 1-5. 予言(Prophecy)＝**15種**

`Prophecy` ページ "List of Prophecies"（アルファベット順）＝
Approaching Army / Biding Time / Bureaucracy / Divine Wind / Enlightenment / Flourishing Trade /
Good Harvest / Great Leader / Growth / Harsh Winter / Kind Emperor / Panic / Progress /
Rapid Expansion / Sickness ＝**数えて15**。

日本語名（`g0_jp_pairs.md`＝日本語wiki のカードページ自身から確定。並び順の推測ではない）＝
**来寇／好機到来／官僚制／神風／悟り／盛大な取引／豊作／偉大な指導者／成長／厳冬／神器／狼狽／進歩／急速拡大／病**。

⚠ **`Biding Time`＝「好機到来」は日本語wiki 自身が誤訳と明記している**（原意は「好機を**待つ**」）。
`jp/retry4.txt` 1220〜1228行の余談を実見＝`しかしながら、日本語訳は「好機到来」となっており、全く逆の意味となってしまっている。`
＋`ちなみに、HJ版の未発売時のDominion Oinlineでは「待機」と訳されていた。`
**日本語wiki は HJ版の名前を見出しに使う方針なので「好機到来」が印刷名と考えてよい**が、
**「印刷版の名前も好機到来」と明記した出典は取れていない**（[訂正H＝批評 N2]＝初稿は断定していた）。結論は変わらない。

⚠ **[訂正H・続き] 「`Progress`／`Flourishing Trade` はホビージャパン版の印刷テキストが DO訳と違う（各ページの余談に記載）」は
出典が確認できなかった**。`jp/*.txt`（日本語wiki の全取得キャッシュ）を `ホビージャパン`／`HJ版` で全文検索すると、
当たるのは **川船(Riverboat) のページ（`jp/batch0.txt` 1727／1959／1985／1995行＝実際に HJ版テキストが併記されている）**
と **好機到来／予言ページの脚注**だけで、**進歩・盛大な取引のページは本文自体がキャッシュに無い**。
＝**「HJ版と DO訳が違うと確認できているのは川船だけ」**が正しい。
**本プロジェクトの方針は DO訳で統一**（略奪の決定3と同じ）なので**結論は変わらない**が、断定を弱めておく。

⚠ **[批評 N3] `Flourishing Trade`（盛大な取引）のカード文は2文ある**＝
`Cards cost [$1] less. **You may use Action plays as Buys.**`
（JP＝「すべてのカードのコストは1コイン下がる。**アクション権を購入権として使ってよい。**」）。
**後半は §2 の影札と直接干渉する**＝影札は**アクション権を消費して**山札から使う（§2-4 の Donald X. 逐語）ので、
**アクション権を購入権に回した分だけ山札の影札が使えなくなる**。
また `t.actions` を `t.buys` に振り替える新 action が要る（`SPEND_VILLAGER`＝村人と同型の per-turn 変換）。
＝**§3 で「予言＝全カード $1 安い」としか書いていない箇所の補足。**

### 1-6. 「+1 [Sun]」の解決順（実装で最も効く）

- **「+1 [Sun]」は Omen の記載の一番最初に必ず来る**（逐語）。
  → カード個別FAQも重ねて明言：
  - Kitsune: `First the +1 [Sun] happens, which may trigger a Prophecy; then you choose two different options…`
  - Rustic Village: `First the +1 [Sun] happens, which may trigger a Prophecy; then you get +1 Card, +2 Actions…`
  - Tea House: `First the +1 [Sun] happens, which may trigger a Prophecy; then you get +1 Card, +1 Action, and +[$]…`

  ＝**予言はそのカードの残りの効果より前に、同じプレイの中で発動しうる**。
- **最後の1個を取り除いた瞬間**に予言が有効になり（`right then`）、**以後ゲーム終了までずっと有効**（`for the rest of the game`）。**一時的ではない**。
- **全部取り除いた後の「+1 [Sun]」は何もしない**＝空振りでも Omen の残りの効果は普通に解決する。

**⚠ [訂正E＝私の追加] 「最後の Sun を取り除いたその瞬間に即時発火する予言」は 2つある**
（g1 §1-5 は「**その人**が特別扱いされる予言」に限定して Kind Emperor 1つとしており、その限定自体は正しいが、
**実装の観点では2つとも即時発火するので同じ穴に落ちる**）：

1. **Kind Emperor（神器）** — ルールブック逐語（`rulebook.txt` 670〜675行）：
   > Kind Emperor: You gain any Action to your hand, regardless of cost. This is not optional.
   > **When the last [Sun] is removed, this applies immediately, in the middle of resolving the Omen, and
   > only the player who removed the [Sun] gains an Action then.**

   カード文＝`At the start of your turn, and when you remove the last [Sun]: Gain an Action to your hand.`
   （JP＝「あなたのターンの開始時とあなたが最後のSunトークンを取り除いたとき、アクションカード1枚を手札に獲得する。」）
2. **Divine Wind（神風）** — カード文＝`When you remove the last Sun token, remove all Kingdom card piles
   from the Supply, and set up 10 new random piles.`（JP＝「最後のSunトークンを取り除いたとき、サプライにある
   王国カードの山をすべて取り除き、新しくランダムに王国カードの山10個を追加する。」）＝**§6-4 参照**。

**＝予言の発動を「次のターン開始時にまとめて」等に遅延させる実装は公式違反になる。**

### 1-7. 予言は横型の「合計2枚まで」に数えるか → **数えない**（確定）

**同盟(Allies)の Ally カードとまったく同じ扱い。**

根拠1＝英語wiki `Card-shaped thing`（`Landscape` のリダイレクト先）が**2つのグループに明確に分けている**：
> It is generally recommended that no more than two in total out of any of the following types be used in a game:
> Events / Landmarks / Projects / Ways / Traits
>
> **Other landscapes' presence in games depends on whether certain Kingdom cards, or types of Kingdom
> cards, are present:** … **Allies: in a game with Liaison cards, one Ally is selected at the start of the game.**
> **Prophecies: in a game with Omen cards, one Prophecy is selected at the start of the game.**

根拠2＝ルールブックの「最大2枚」の逐語に**予言が入っていない**：
> For normal play we recommend using at most 2 such cards; with other expansions that includes
> **Events, Traits, Landmarks, Projects, and Ways.**

根拠3＝**予言はランダマイザーデッキに混ぜない**（イベントは「混ぜてよい」と書かれている）。
`In games using an Omen, shuffle the Prophecies, and deal out one to be used this game.`

根拠4＝`Prophecy` ページ冒頭：
> Prophecies are not Kingdom cards; including a Prophecy in a game does not count toward the 10 Kingdom
> card piles the Supply includes. **In fact, Prophecies are not considered "cards" at all; any text referring to
> a "card" (such as instructions to "name a card") does not apply to Prophecies.** However, for reference,
> the Prophecy effects are printed on cards in a landscape orientation with **iris blue frames**.

### 1-8. **⚠ [訂正I＝批評 M4] サプライに Omen が1枚も無いのに「+1 [Sun]」が走る経路が2つある**

初稿はここに触れていなかった。**どちらも本アプリでは実在の到達経路**（実コードで確認した）：

1. **`Riverboat`（川船）の脇札**＝準備で「使っていない・**非持続**・**ちょうど $5** のアクションカード」を1枚脇に置く。
   **茶屋(Tea House `[$5]` Action-Omen) と 狐(Kitsune `[$5]` Action-Attack-Omen) が両方とも条件を満たす**
   （§1-4 の表のとおり非持続の $5 アクション）。川船はその札を毎ターン「動かさずに使用する」ので、
   **王国10種に Omen が1枚も無いゲームで、毎ターン `+1 Sun` が走る。**
2. **闇市場(Black Market)デッキ**＝本アプリの母集団は
   `js/engine.js` `createInitialState` の
   `const universe = Array.from(new Set([].concat.apply([], Object.values(DOM.POOLS || {}))));`（1579行）＝
   **全 `POOLS` の平坦化**で、除外するのは `NON_SUPPLY` / 混合山の中身と山キー / **`DOM.STAGE1_POOLS`** だけ。
   ＝**旭日を段階2に上げて `STAGE1_POOLS` から外した瞬間、Omen 6種が闇市場デッキに入る**（§0-29 A5 で
   `STAGE1_POOLS` は空になっている）。

**→ 実装の結論：`+1 Sun` の共通入口は「予言が無ければ完全な空振り」で終端すること。**
前例＝同盟の `gainFavors`（`js/engine.js`）＝**Ally が居ないゲームでは好意を配らない**。
`state.prophecy == null` / `state.sunTokens == null` のまま呼ばれても落ちない書き方にする
（`if (state.prophecy == null) return;` を関数の先頭に置くだけ）。

**⚠ 未確定（§10-7 に再掲）＝「準備で予言を配るか」を王国10種だけで判定してよいか。**
公式は `In games using an Omen` としか言わず、**脇札・闇市場デッキを含むかの明文が無い**。
ただし**本アプリには既に強い前例がある**：`createInitialState` は馬の山を
`if ((DOM.HORSE_GIVERS || []).some((id) => kingdom.includes(id) || events.includes(id) || **id === mouseCard**)) supply.horse = 30;`（1606行）
＝**ハツカネズミの習性で脇に置いた1枚まで見て**山を用意している。戦利品も
`kingdom.some(...) || events.some(...) || (opts.traits||[]).some(...)`（1670〜1671行）で**イベント・特性まで走査**する。
日本語wiki の川船ページも「幸運/不運カードを脇に置いたら祝福/呪詛の山を用意する」と書いている（`jp/batch0.txt` 1940〜1950行）。
＝**同じ論法なら「Omen を脇に置いたら予言を配る」**。**闇市場デッキは含めない**のが自然
（デッキの中身は秘密＝準備の判定に使うと情報が漏れる）。**方針として PROGRESS に明記すること。**

### ⚠ 実装で危ないところ（§1）

- **`state.prophecy`（1つ・公開・対局中不変）＋ `state.sunTokens`（残数）は §0-29 A1 の `state.ally` と完全に同型**。
  `js/engine.js` の `if (alliesHasLiaison(kingdom)) { … }`（1517行）と**同じ位置・同じ書き方**で
  `createInitialState` が決める。**`DOM.landscapesForSet`（`js/cards.js` 1888行）には絶対に入れない**
  ＝入れると横型の合計2枚制限を食う（Ally も入っていない）。
- **[批評 N5] `state.sunTokens` に上限クランプは要らない**。`Materials` ページ逐語＝
  `Rising Sun comes with 13 wooden tokens in the form of sun icons, that are to be placed on a Prophecy …`
  （`vm_1.txt` 1532行）。**負債トークン（`[D] is not counter-limited; players should use a replacement if they run out.`）や
  VPトークンと違い「足りなければ代用品を」の記述が無い**＝13個が設計上の上限（6人戦がちょうど13）で、
  **増える経路が1つも無い**（`+1 [Sun]` は取り除く方向にしか動かない）。単調減少のカウンタとして書けばよい。
- **予言は「カード」ではない**＝`allCards`（`js/engine.js`）にも `test/invariants.test.js` の保存則 tally にも入れない。
  庭園/品評会/壁/絹の道 にも数えない。**Sun トークンも非カード**＝`state.pileVP` / `p.favors` / `state.pileFavor` と同型のスカラー。
- **`+1 Sun` は共通入口を1つ作り、Omen の `applyEffect` の case の**先頭で必ず呼ぶ**。
  トークンが0になった瞬間に予言を有効化し、**Kind Emperor / Divine Wind はその場で発火**させる
  （`t.startQueue` に積んで遅らせてはいけない）。**Kind Emperor は「取り除いた本人だけ」**が獲得する。
- **`Kind Emperor` の「手札にアクションを獲得（コスト制限なし）」に `costUpTo` を使ってはいけない**
  ＝コスト上限が無い（§0-29 A4 の「専門家のコピー獲得／侍祭の卜占官獲得はコスト制限が無い」と同型）。
- **横型の新 kind `prophecy`** を `tools/build-landscape.js` に新設する。**iris blue（菖蒲色）／コスト欄なし**。
  直近の前例＝同盟の `ally`（濃い藍）／略奪の `trait`（深い臙脂）。
- **新種別 `omen`** を `types` に足す（Kitsune は `['action','attack','omen']`）。
  表示ラベルは同盟/略奪で入れた「`types` 配列の順に連ねる汎用規則」に自動で乗る。
  **`js/carddata.js` の TYPE_JP/EN・`js/ui.js` の TYPE_JP・`test/integrity.test.js` の JP/EN の4箇所**に
  `omen`＝前兆／`shadow`＝影 を足す（§0-30b で `loot` を足したときと同じ4箇所。
  **`test/ui.test.js` の「全カード種別が TYPE_JP にあるか」の恒久検査が足し忘れを捕まえる**）。
- **盤面に予言と残り Sun 数を出す**（公開情報。§0-29 A3 の Ally 帯／§0-19 のランドマーク帯と同じ場所）。

---

## 2. 影(Shadow)カード

### 2-1. **5種**（種別は各カードページの `Info > Type(s)` で確定＝訂正②）

| コスト | EN | **JP** | 種別 | 日本語カード文（DO訳） | `<hr>` |
|---|---|---|---|---|---|
| **[$2]** | Fishmonger | **魚屋** | Action - Shadow | +1 購入／+1 コイン／——／これは手札からと同様に山札からも使用できる。 | **1** |
| **[$4]** | Alley | **小路** | Action - Shadow | +1 カードを引く／+1 アクション／手札1枚を捨て札にする。／——／これは手札からと同様に山札からも使用できる。 | **1** |
| **[$4]** | Ninja | **忍者** | **Action - Attack - Shadow** | +1 カードを引く／他のプレイヤーは全員、手札が3枚になるように捨て札にする。／——／これは手札からと同様に山札からも使用できる。 | **1** |
| **[$5]** | Ronin | **浪人** | Action - Shadow | 手札が7枚になるようにカードを引く。／——／これは手札からと同様に山札からも使用できる。 | **1** |
| **[$5]** | Tanuki | **狸** | Action - Shadow | 手札1枚を廃棄する。それよりコストが最大2コイン高いカード1枚を獲得する。／——／これは手札からと同様に山札からも使用できる。 | **1** |

＝**5種**（ルールブック逐語 `Rising Sun has five Shadow cards.` と一致。**アタックは Ninja 1枚だけ**）。
**5枚とも区切り線の下が同じ1文**＝`You can play this from your deck as if in your hand.`

**版**：5種とも `First edition / August 2024`。機能エラッタなし。
**公式FAQ**：5枚とも `See the Shadows section.` ＋そのカードの効果の言い換えだけ（＝影固有の追加裁定は無い）。
例＝Ronin: `When you play this, you draw cards one at a time until you have 7 cards in hand, or can't draw any
more; if you already had 7 or more cards in hand, you don't draw any.`／
Tanuki: `… gain a card costing up to [$2] more than it, like when playing Remodel.`

### 2-2. 逐語（ルールブック p.4「Shadows」節の**全文**・8項目）

> Rising Sun has five Shadow cards. These cards all have unique backs, and can be played from your deck.
>
> - When shuffling Shadow cards, put them on the bottom. If you have multiple Shadow cards, they can
>   go in any order at the bottom. **They can also be mixed with any other cards you specifically put on the
>   bottom, such as Fated cards from Plunder.**
> - You may wish to turn your Shadow cards sideways at the bottom of your deck, so that it is easy to
>   remember that they are there.
> - **Shadow cards will not necessarily stay on the bottom of your deck; they are just put there when
>   shuffling them.**
> - **Shadow cards are not put on the bottom when gained, or at any time other than when shuffling
>   them.**
> - **You can look through your deck at the card backs at any time, and see where your Shadow cards are.**
> - **Whenever you can normally play an Action card, you can play a Shadow card from your deck. It can be
>   anywhere in your deck. You play it exactly as if playing it from your hand; it goes into play and you
>   follow its instructions.**
> - **When a card like Throne Room tells you to play a card from your hand, you can use that opportunity
>   to play a Shadow card from your deck.**
> - **You can play Shadow cards from your deck as if in your hand, but this does not mean the Shadow card
>   is in your hand; for example you cannot discard it to an ability like Alley's (unless it is actually in your
>   hand).**

（A: `rulebook.txt` 128〜152行 ＝ B: `_expansion.txt` ＝ C: `Shadow` ページ "Official rules"、
**3ソース完全一致**＝私も `rulebook.txt` を開いて1文ずつ照合した。）

### 2-3. **裏面はカードごとに別の絵**（訂正①＝[medium]・**自分で5枚とも実見して確認**）

g1 は「`unique backs` が『（通常の裏と違って）固有』か『5枚それぞれ別々』か曖昧＝未確定」として
マスク設計を保留していたが、**保留の必要は無い**。

`Shadow` の各カードページの `Info > Card back` に**5枚それぞれ別ファイル**が置かれている
（`File:NinjaBack.jpg` / `RoninBack.jpg` / `TanukiBack.jpg` / `AlleyBack.jpg` / `FishmongerBack.jpg`）。
**私が5枚すべてをダウンロードして実見した結果**：

| カード | 裏面の絵 | 下部の帯 |
|---|---|---|
| Ninja | 舟の上の黒装束の忍者（月夜） | `When shuffling this, put it on the bottom of your deck.` |
| Ronin | 笠をかぶり刀を差した浪人（桜） | 同上 |
| Tanuki | 青く光る狸（夜の森） | 同上 |
| Alley | 町並みの路地（人影3人） | 同上 |
| Fishmonger | 魚を持つ魚屋の女性 | 同上 |

＝**5種とも絵が違う。共通なのは下部の帯の1文だけ**。
**＝`unique backs` は「5枚それぞれ別々」の意＝裏を見れば "どの" 影札かまで分かる。**

### 2-4. Donald X. のプレビュー逐語（設計意図・境界条件）

> I bet you never thought I'd revisit **Stash**. This expansion has 5 cards with special backs.
> The back lets you know that you put it on the bottom when shuffling it. The front meanwhile tells you
> that you can play it from your deck. **You play it only whenever you could otherwise play an Action from
> your hand; you have to be allowed to play an Action, it doesn't get around that.** You can play it as a
> normal Action play, or via cards like Throne Room, that play Action cards from your hand. It leaps out of
> your deck and into play. IRL I recommend having the Ninja peeking out of the bottom, to remind you
> that it's there. **If you have multiple Shadows, you get to order them on the bottom, for when that
> matters. And they don't have to be on the bottom for their ability to let them be played; they just have
> to be in your deck. They can still be played from your hand too; it's just not usually what you prefer.**
> —Donald X. Vaccarino, *Rising Sun Previews 2: Shadow*, August 2024

⚠ **アクション権を消費する**ことが明言されている＝**アクション権0では山札から影札を使えない**。

### 2-5. **「山札から使える」はアクションのプレイに限らない**（訂正C＝私の追加・[medium]）

g1 §2-7 の項目7/8 は「アクション権が必要」「夜フェイズには使えない」と書いているが、**書き方が狭すぎる**。
`Fishmonger` ページの **"Other rules clarifications"** 逐語：

> **If you have bought Capitalism, you can also play Fishmonger from your deck whenever you could
> normally play Treasures from your hand.**

＝影札の能力は「**その札を手札から使えるときならいつでも、代わりに山札から使ってよい**」という一般則。
資本主義（ルネサンスのプロジェクト＝`+$` を持つアクションを財宝にする）があれば
**購入フェイズに、財宝として、山札から魚屋を使える**（mix-all 限定）。

**正しい言い方**：
- **アクションとして使うなら**アクション権が要る（Donald X. 逐語）＝アクションフェイズ、または玉座の間等の窓。
- **その札が（資本主義などで）財宝でもあるなら**、財宝を出せるとき＝購入フェイズにも山札から出せる。
- **夜フェイズは関係ない**＝旭日の影札5種に夜行(Night)カードは1枚も無いので、そもそも夜に使う経路が無い
  （「使えない」ではなく「該当が無い」）。

### 2-6. 略奪の「運命の(Fated)」との同居 ＝ 逐語で確定

- ルールブック（上記）＝`They can also be mixed with any other cards you specifically put on the bottom,
  such as Fated cards from Plunder.`
- 英語wiki `Fated` ページ "Other rules clarifications" が**逆方向からも明言**（＝相互に整合）：
  > **If you have Shadow cards in your deck, they go to the bottom of your deck when you shuffle;
  > bottom-decked Fated cards can go above, below, or between Shadow cards.**

**＝mix-all で影札と「運命の」が同居したら、山札の底に置く相対順をプレイヤーが選ぶ。**

### 2-7. シャッフルの途中の対話 → **要るが極小**（自動選択でよい）

対話が要る場面は**2つだけ**で、どちらも「底に送る札どうしの相対順」：
1. **影札が2枚以上あるとき**＝`If you have multiple Shadow cards, they can go in any order at the bottom.`
2. **影札と「運命の」で底に送る札が同居するとき**（mix-all 限定）＝上記 `Fated` 逐語。

**それ以外に対話は無い**（へそくり(Stash) と違い「山札の好きな位置へ」ではなく**底に置くだけ**なので配置先の選択が無い）。
＝ **へそくり／星図／運命の／占星術師団 より圧倒的に軽い。**

⚠ **「底」の意味**：`Fated` の逐語は
`If you put any Fated cards on the bottom, they go on the bottom of **the shuffled cards**, not on the bottom
of your deck.` ＝**シャッフルした束の底**であって山札全体の底ではない。
**影札についての同等の明文は取れなかった**（⚠未確定・§10-2）が、2016年のシャッフルエラッタ
（シャッフルした束は残っていた山札の**下**に付く）と組み合わせると**結果は同じ**になる。
本アプリの `reshuffleDeck` は `p.deck = p.deck.concat(shuffled)` なので、**この差は観測できない**。

### 2-8. 実装で効く境界条件（すべて逐語から）

1. **獲得したときは底に置かない**（`not put on the bottom when gained, or at any time other than when
   shuffling them`）＝望楼・`Progress`（進歩）等の topdeck は普通に効く。
2. **底に置かれた後も普通に動く**（`will not necessarily stay on the bottom`）。
3. **山札のどこにあってもプレイできる**（`It can be anywhere in your deck.`）。
4. **プレイしたら場に出る**（`it goes into play and you follow its instructions.`）＝脇や山札に残らない。
5. **「手札からアクションを使う」効果の対象にできる**（逐語＝`When a card like Throne Room tells you to play a card
   from your hand, you can use that opportunity to play a Shadow card from your deck.`）。
   **本アプリの該当窓の完全な一覧は §2-9（下）に分類して載せた**（[訂正J＝批評 M7]）。
6. **手札にあるわけではない**（`this does not mean the Shadow card is in your hand`）
   ＝**Alley の「手札1枚を捨て札にする」に使えない**（実際に手札にある場合を除く）／
   地下貯蔵庫・民兵・忍者の捨て札／書庫・図書館の手札枚数／`Ronin` の「手札が7枚になるまで」
   ＝**「手札を数える／手札から捨てる」効果に一切数えない**。
7. **⚠ [訂正⑤] ただし「所有カードを数える」効果には普通に数える**。
   **庭園(Gardens) は手札ではなく所有カード総数を数える**（`Worth 1 [VP] per 10 cards you have.`）。
   山札の底にある影札も**所有カードなので庭園・品評会・絹の道・城・博物館 に数える**。
   g1 §2-7 項目6 は「庭園などの『手札』参照に一切数えない」と書いており、
   **そのまま実装指示として読むと保存則側のバグになる**。

### 2-9. **⚠ [訂正J＝批評 M7] 影札を受け入れる窓／受け入れない窓の完全な分類**

初稿は「玉座の間／王の宮廷／行進／専門家／長老／王家のガレー船／市場の町／稽古」の8つを挙げて
行番号を7つ並べ「ほか」で済ませていた。**`p.hand.some((c) => DOM.isType(c, 'action')` の grep は 24箇所ある**
（`js/engine.js`・2026-08-16 実測）。**全部を機械的に拾うと公式違反になる**ので、下の2群に分けること。

**線引き＝ルールブック逐語のとおり「手札から *使用する*（play）」窓だけが影札を受け入れる。
「手札から 捨てる／廃棄する／脇に置く／山に戻す」窓は受け入れない**
（`this does not mean the Shadow card is in your hand`）。

#### 群A＝**影札を並べる**（手札からアクションを *使用させる* 窓）

| 窓（pending.type） | カード／出典 | 行 | `canPlayHandCard` |
|---|---|---|---|
| `throne` → `THRONE_CHOOSE` | 玉座の間 | 5545 / 14147 | ✅ 両側 |
| `kings_court` → `KINGS_COURT_CHOOSE` | 王の宮廷 | 6231 / 16499 | ✅ 両側 |
| `procession` → `PROCESSION_CHOOSE` | 行進（**非持続限定**） | 5947 / 15457 | ✅ 両側 |
| `first_mate` → `FIRST_MATE_PLAY` | 一等航海士（略奪） | 4838 / 13712 | ✅ 両側 |
| `royal_galley_play` | 王家のガレー船（同盟・**非持続限定**） | 7616 / 20647 | ✅ 両側 |
| `specialist_play` | 専門家（同盟・**財宝も可**） | 7630 / 20677 | ✅ 両側 |
| `elder_play` | 長老（同盟） | 7639 / 20705 | ✅ 両側 |
| `ally_market_towns` | 市場の町（Ally） | 8164 / 20233 | ✅ 両側 |
| `gondola_play` | ゴンドラ（略奪・獲得時） | 11887 / 13209 | ✅ 受理側 |
| `toil` → `TOIL_PLAY` | 苦労（移動動物園イベント） | 11283 / 19228 | ⚠ `playCardNoAction` 経由で実質OK |
| `conclave` → `CONCLAVE_PLAY` | コンクラーベ（夜想曲） | 7066 / 19548 | ⚠ 同上 |
| `imp_play` | インプ（夜想曲） | 7326 / 19846 | ⚠ 同上 |
| `staff_play` | 杖（略奪の戦利品・**購入フェイズに**アクションを使う） | 1009 / 13863 | ⚠ 同上 |
| `crown`（mode:'action'）→ `CROWN_CHOOSE` | 冠（帝国） | 1123 / 17696 | 🛑 **無い**（→ 出荷済みバグ候補②） |
| `mastermind_play` | 首謀者（同盟・ターン開始時に3回） | 8953 / 18902 | 🛑 **無い**（→ 同上） |
| `disciple_play` | 門下生（冒険） | 6875 / 15578 | 🛑 **無い**（→ 同上） |
| `invasion_attack` | 侵略（略奪イベント） | — / 13523 | ✅ 受理側 |
| **`practice`（新設）** | **稽古（旭日・イベント $3）**＝`You may play an Action card from your hand twice.` | — | **新規：4点セット＋両側に必須** |

＝**旭日で新設するのは `practice` の1つだけ**だが、**上の17窓すべてに「山札の影札」を並べる改修が要る**。

#### 群B＝**影札を並べてはいけない**（手札から *動かす* 窓）

| 窓 | カード | 行 |
|---|---|---|
| `figurine_discard` | 小像（略奪）＝手札のアクションを**捨てる** | 978 |
| `contract_setaside` | 契約書（同盟）＝手札のアクションを**脇に置く** | 1103 |
| `zombie_apprentice` | ゾンビの弟子（夜想曲）＝**廃棄** | 7284 |
| `swap_return` | 交換（同盟）＝**山に戻す** | 7525 |
| `acolyte_trash` | 侍祭（同盟）＝**廃棄** | 7533 |
| `hex_fear` | 呪詛「恐れ」（夜想曲）＝**捨てる** | 10055 |
| `peril_trash` | 危難（略奪イベント）＝**廃棄** | 10899 |
| `advance`(stage:'trash') | 昇進（移動動物園イベント）＝**廃棄** | 11022 |
| `delay` | 遅延（移動動物園イベント）＝**脇に置く** | 11298 |
| `arena` | 闘技場（帝国ランドマーク）＝**捨てる** | 11409 |
| `siren_gain` | セイレーン（略奪）＝**廃棄** | 11877 |
| `graverobber`(stage:'trash') | 墓暴き（暗黒時代）＝**廃棄** | 15261 |
| — | 呪いの鏡（夜想曲）／ハツカネズミの習性／地下貯蔵庫／民兵／**忍者自身の捨て札**／書庫・図書館の手札枚数 | — |

**判定の目安＝そのカードが最終的に `inPlay` に入るなら群A、`discard`/`trash`/`setAside`/`supply` に入るなら群B。**

⚠ **群Aを直すときは 4面（窓を開く条件・受理する reducer・CPU の候補・UI のフィルタ）を必ず同時に直す**
＝§0-29 A4 の [high] 12「将軍×玉座の間で engine拒否×CPU提案の無限ループ（60戦中11戦が膠着）」と**まったく同じ形**。
片側だけ直すのが本プロジェクトで最も再発する事故。

### ⚠ 実装で危ないところ（§2）

- **新種別 `shadow`** を `types` に足す（Ninja は `['action','attack','shadow']`）。§1 と同じ4箇所に表示ラベルを足す。
- **シャッフルは `js/engine.js` の `reshuffleDeck(p, state)`（1183行）が唯一の入口**。
  **略奪の「運命の」の処理（`p.fatedIds` を見て `shuffled.unshift(...top)` / `shuffled.push(...bottom)` する
  1253〜1264行）のすぐ後、`p.deck = p.deck.concat(shuffled)` の直前**に、影札を `shuffled` から抜いて
  `shuffled.push(...)` する数行を足すだけでよい（**非対話のまま**）。
  相対順は自動＝**許容簡略化**（§0-22 の星図・§0-29 の占星術師団/メイソン団・§0-30 の運命の と同じクラス。
  ただし**戦略的影響はほぼゼロ**＝底の中の並び順が効くのはそのシャッフルで山札を底まで掘り切る極端な場合だけ）。
  **[批評 N7] 自動化の正当化は `Stash` の Official FAQ がそのまま使える**（`vm_4.txt` 1429行 逐語）：
  > **You can't look at the fronts of the cards you're shuffling; Stash has a different card back so you know where it is.**

  ＝**シャッフル中は表を見られない**ので、影札どうしの相対順を人間が意味のある基準で選ぶ材料が実はほとんど無い
  （裏の絵は違うので "どの影札か" は分かるが、他の札は全部裏）。**非対話の自動選択は忠実性の損失が極小。**
  ⚠ **`placeStash(p)` が `concat` の直後（1266行）にある**（へそくりの位置決め）＝影札の処理は**その前**に置くこと。
- **マスクは「要判断」ではない＝へそくり(Stash) の既存実装がそのまま答え**（訂正B＝私の追加・[medium]）。
  `maskStateFor` は既に **`'stash'` だけを例外として晒している**：
  - **自席**＝`const rest = p.deck.filter((c) => c !== 'stash').sort();` で山札の順序を消しつつ
    **stash の位置だけ保存**する。
  - **相手席**＝`deck: p.deck.map((c) => (c === 'stash' ? 'stash' : 'back'))`／
    `hand: p.hand.map((c) => (c === 'stash' ? 'stash' : 'back'))`／`setAside` も同じ。
    ＝**へそくりは相手の山札・手札・脇でも位置と正体が見えている**（コメント＝「裏面が異なる＝公開情報」）。

  **影札は裏面がカードごとに違う（§2-3）ので、影札idをそのまま晒すのが公式に合う。**
  ＝`c === 'stash'` を `SHADOW_IDS.has(c) || c === 'stash'` に一般化する **1箇所の述語**で4系統が同時に直る。
  **情報漏洩にはならない**（影札はシャッフルで必ず底に行き、以後の移動は全部公開の事象なので、
  位置は元から全員が追える）。**非影札の順序は今までどおり隠れる。**
  ⚠ **これは §0-21 偵察隊／§0-28 夜警／§0-29 A4 粉屋・歩哨 と同じクラスの「私的看破リスト」の話ではない**
  （あれは「見た札」＝本人だけ。影札は**全員に見える**）。混同しないこと。
  ⚠ **サーバの `isNoConsentUndoableBuy`（`server/gameServer.js`）は「自分の山札と手札も完全一致」を要求する**
  ので、影札の位置が変わる操作は自動的に承認制へ落ちる＝追加配線は不要（§0-24 の設計どおり）。
- **山札から使う経路（新規）**：`PLAY_ACTION`（`js/engine.js`）は
  `if (me.hand.indexOf(card) < 0) return state; removeOne(me.hand, card);` なので、
  **`action.from === 'deck'` を受け付ける分岐**が要る（`me.deck` から `removeOne`）。
  **アクション権・`canPlayFromHand`（航海の3枚制限）・`warlordBlocks`（将軍）のガードは
  そのまま通す順序で書く**（engine拒否・CPU非提案・UI無効化の3面＝§0-23 の教訓）。
  **「手札のアクションを選ぶ」窓にも山札の影札を並べる＝対象は §2-9 の群A（17窓）だけ。群B（12窓＋α）には並べない。**
  **4面（窓の条件・受理・CPU の候補・UI のフィルタ）を必ず同時に直す**
  ＝§0-29 A4 の [high]「将軍×玉座の間で engine拒否×CPU提案の無限ループ」とまったく同じ形。
- **資本主義で財宝になった影札は `PLAY_TREASURE` / `PLAY_ALL_TREASURES` からも山札を見る**（§2-5）。
  ⚠ **`PLAY_ALL_TREASURES`（`playAllOrder`）に山札の影札を勝手に含めてはいけない**
  （§0-24 の `playAllResume` の教訓＝「押した時点で手札に無かった財宝を勝手に出す」事故と同型）。
  **`PLAY_ALL_EXCLUDE` 相当の扱いにして、山札からは1枚ずつ明示的に出させるのが安全。**
- **`p.deck` から抜くので保存則は自然に保たれる**（新ゾーンは不要）。`allCards` も変更不要。
- **UI＝人間が山札の影札を押せる導線が要る**（無いと「人間だけが使えない」＝§0-30 P1b の
  「盾のボタンが embedded 型アタックの3モーダルに無かった」と同じクラスの穴）。
  盤面に「山札の影札」の帯を出し、手札の群と同じように光らせる。
- **[批評 N8] 逆向きの穴＝CPU も山札の影札を使えないと、影札5種の "山札から使う" 経路がソークで一度も通らない**。
  `js/cpu.js` の `chooseAction(state, p)`（258行）は
  `const has = (id) => p.hand.includes(id) && !warlordBlocks(...)` ＝**手札しか走査しない**。
  放置すると **魚屋/小路/忍者/浪人/狸 を CPU が山札から一度も使わない**＝
  CPUソークを何百戦回してもこの経路の検証にならない（§0-29 A5 の「闇市場×同盟＝**人間だけが通る道**」と同じ構図。
  §0-30 の敵対レビューでも「pending 到達 54/54 のうち10は強制注入」で補っている）。
  → **`chooseAction` に「山札の影札」分岐を足す**（engine が受理する手だけを返すこと）＋
  **敵対レビューでは山札からの使用を強制注入する**こと。
- **CPU の `GAIN_ORDER` は全カード網羅が整合性テストの要求**なので、影札5種・前兆6種も実強度順の位置に入れる。

---

## 3. 負債(Debt)＝2024エラッタで**一般ルールが変わった**（＝帝国に遡及）

### 3-1. ルールブック p.3「Debt」節の逐語（**全文**）

> Rising Sun has Debt, which first appeared in Empires. There are Debt tokens to track the Debt, and a
> symbol, [D], which indicates amounts of Debt.
>
> - **Having Debt tokens prevents a player from buying cards or Events or Projects (from Renaissance);
>   Debt tokens do nothing else (for example they have no effect at the end of the game).**
> - **Buying a card or Event with [D] in its cost gives the player that many Debt tokens.**
> - An ability with +[D] causes you to take that many Debt tokens. For example +[2D] means you take 2
>   Debt tokens.
> - **A player can remove Debt tokens at any point in their turn by paying [$1] per Debt token to remove it.
>   This does not use up a Buy or an Action, and can be done multiple times in a turn. This does not let
>   players play Treasures at any time.**
> - [D] amounts are not [$] amounts. Math involving [$] amounts does not affect [D] amounts.
> - **Some cards look for a cost in a range. "Up to [$4]" means "[$0], [$1], [$2], [$3], or [$4]"; it does not
>   include costs with [D] in them.**
> - **Some cards compare costs. A card costing [8D] costs more than one costing [6D], just like one
>   costing [$8] costs more than one costing [$6]. However debt and [$] are not comparable. With a card
>   costing [$4] and a card costing [6D], neither costs more than the other. [6D] does however cost more
>   than [$0]; there is an implicit [$0] in all pure [D] costs, so [6D] costs the same amount of [$] as [$0],
>   and more [D].**
> - Players cannot take [D] for no reason.
> - Players cannot overpay with [D] (for Guilds cards).
> - [D] is not counter-limited; players should use a replacement if they run out.

（A: `rulebook.txt` 72〜96行。**⚠ 訂正④＝B（拡張ページ）とは文が一致していない**：
B は `or Projects (from Renaissance)` が無く、`An ability with +[D] …` の項目自体が無く、
`[D] amounts are not [$] amounts.` が `[D] amounts are something different from [$].` になっている。
私も `_expansion.txt` 243〜274行を開いて確認した＝**訂正④は正しい**。
**本章は A の文を正とする**。`+[2D]` の記号は**同じルールブックの Kate の例文中の `[2D]` と同一表記**であることで確定した
（B からは埋め戻せない＝g1 の「推測ゼロ」は事実に反するが、埋めた中身は正しい）。）

### 3-2. 公式の例（逐語・4件＝実装のテストケースにそのまま使える）

> - **Kate has [$4] and buys Daimyo, which costs [6D]. She takes [6D], then immediately pays off [4D]
>   with her [$4]. She still has [2D]. On her next turn, in her Buy phase, she has [$5]. She pays off the
>   remaining [2D] and has [$3] left, with which she buys a Silver.**
> - **Craftsman can't gain a Mountain Shrine, because [5D] is not "up to [$5]." Poet cannot draw a
>   Mountain Shrine, because [5D] is not "up to [$3]." Change can't gain a Mountain Shrine, no matter
>   what you trash, because Mountain Shrine doesn't cost any [$].**
> - **Flourishing Trade lowers costs, but has no effect on the cost of Daimyo.**
> - **Tanuki trashing an Artist can gain a Daimyo, because Daimyo does cost "up to [$2] and [8D]."**

（記号は英語wiki `Debt` ページの "Rising Sun:" 行から復元。Poet の `[$3]` は §1-4 で3ソース確定済み。
`Artist` は `[8D]`＝Tanuki は「$2高い」ので `[8D]+[$2]` まで届く＝Daimyo `[6D]` は届く、という例。）

### 3-3. **【最重要】帝国との差分＝「負債はターン中いつでも払える」（2024エラッタ・帝国に遡及）**

英語wiki `Debt` ページは**新旧を明示的に節で分けている**：

> **Prior official rules (amended by the release of the Rising Sun expansion)**
> A player removes Debt tokens **in the player's Buy phase** by paying [$1] per Debt token to remove it;
> this is done after playing Treasures, but can be done both before and after buying cards.

⇔ 現行（Rising Sun 以後）：
> A player can remove Debt tokens **at any point in their turn** by paying [$1] per Debt token to remove it.

`Errata` ページ "Rules" 節：
> **Debt — Can be paid off at any time during your turn (2024).**

`2024 Errata` "New rules > Paying off Debt"：
> Debt can now be paid off at any time during your turn, not just during a player's Buy phase.
> **This makes Capital's extra pay off during Cleanup redundant.**

Donald X. 本人：
> Rising Sun revisits debt, introduced in Empires (see). … **Which you can now do at any point during
> your turn, incidentally; no more screwing over Black Market.**
> —Donald X. Vaccarino, *Rising Sun Previews 3: Debt and Events*, August 2024

### 3-4. **「負債コストのカードは"購入"でだけ負債を負う」**

英語wiki `Debt` ページ "Other rules clarifications" 逐語：
> **Although buying a card with [D] in its cost gives you Debt tokens, gaining such a card in other ways
> does not.**

ルールブックも `**Buying** a card or Event with [D] in its cost gives the player that many Debt tokens.` で
「購入」に限定している（獲得一般ではない）。
⚠ **`Gold Mine` / `Craftsman` / `Change` / `Imperial Envoy` / `Litter` / `Root Cellar` の「+[D]」は
カード自身の能力であって費用ではない**＝別経路（`An ability with +[D] causes you to take that many Debt tokens.`）。混同しないこと。

### 3-5. 🛑 **【訂正A＝私の追加・[high]】この2件は g1 が書かれた後に、既に修正・コミット済み**

g1 §8-2 と v_mechanics の総括は「**実バグ①②はそのまま着手してよい**」と書いているが、**もう直っている**。

```
7cc4534 fix(empires): 負債の2024エラッタ＝出荷済みの実バグ2件を修正（旭日の段階0で発覚）
  js/engine.js | js/ui.js | sw.js | test/allies.test.js | test/empires.test.js
```

私が実コードで確認した現在の状態：

| 旧・実バグ | 現在の実コード | 状態 |
|---|---|---|
| ① `REPAY_DEBT` が購入フェイズ限定 | `js/engine.js` の `case 'REPAY_DEBT'`（**現在 17379行**）から `t.phase !== 'buy'` が**消えており**、2024エラッタの逐語がコメントで引用されている。`js/ui.js` の返済ボタンも全フェイズ共通になった | **✅ 修正済み** |
| ② `gain()` の末尾で `takeDebt` | `takeDebt(` の呼び出しは **`BUY`（**現在 12385行**）と `BLACK_MARKET_BUY`（**現在 14900行**）の2箇所だけ**（`grep -n "takeDebt(" js/engine.js` を 2026-08-16 に再実行して確認＝定義 1908行＋この2箇所の計3ヒットのみ）。`gain()` / `gainFromOutside` / `gainLoot` からは外れている | **✅ 修正済み** |

コミットメッセージによれば、**旧い誤った挙動を固定していたテスト2件も公式へ直され**
（御守り×市街の負債 16→8／木工ギルドで技術者を獲得しても負債0）、**回帰テスト4件が新設**され、
`npm test` 全44スイート緑・`sw.js` v75→**v76** まで済んでいる。

> **⚠ 段階2に着手する人へ：この2件を「これから直すもの」として二重に着手しないこと。**
> 逆に、**旭日の実装中に `Tanuki`（絵師を廃棄して大名を獲得）で負債が付いたら、それは退行**である
> （ルールブックの公式例そのものなので回帰テストに入れること）。

### 3-6. 現在も残っている許容簡略化（意図的）

- **選択待ち（`state.pending`）がある間は返済できない**（`REPAY_DEBT` の先頭ガード）。
  公式は「いつでも」なので**闇市場の解決中に返す手だけは再現できない**。
  ただし Donald X. が挙げた当の事象（**アクションフェイズで +$ を出してから闇市場を使う前に返す**）は解消済み。

### 3-7. 帝国と**同じ**もの（本アプリの既存実装でよい）

- 負債がある間は**カードもイベントもプロジェクトも買えない**（`canBuyCard` / `canBuyProject`）。
- **終了時の減点は無い**。
- **コスト比較は成分別**＝本アプリの `costOf` / `costUpTo` / `costUnder` / `costExact` / `sameCost` /
  `costIsPlainCoin`（§0-23 で1本化済み）が既に公式どおり。
  `"Up to [$4]" … does not include costs with [D] in them` ＝ `costUpTo` の既定（`debt: 0`）と一致。
- **過払い（ギルド）に負債は使えない**／**理由なく負債を取れない**／**トークンは数量無制限**。
- **支配(Possession)**＝`Debt` ページ逐語 `Possession … now has errata that causes it to also give the
  Possessing player all Debt tokens the Possessed player would get.` ＝
  本アプリの `takeDebt` は `t.possessedBy` を見て支配者へ振り分けている（§0-23 で対応済み）。

### ⚠ 実装で危ないところ（§3）

- **`Daimyo`（[6D]）／`Mountain Shrine`（[5D]）／`Artist`（[8D]）は「純粋な負債コスト」**＝
  `cost: 0, debt: N` でカタログに入れる（帝国の `overlord` が前例＝`cost: 0, debt: 8`）。
  **`costIsPlainCoin` が false になる**ので、`Craftsman`（$5以下獲得）／`Poet`（$3以下）／
  大君主の対象／王子の対象 から自動的に外れる＝公式例3件がそのまま通る。
- **`Change`（交替）の「それよりコストのコインコストが高いカード」は `[$]` 成分だけの比較**
  ＝公式例 `Change can't gain a Mountain Shrine … because Mountain Shrine doesn't cost any [$].`
  ＝ **`costUnder`/`costOf` の3成分比較をそのまま使ってはいけない**（コイン成分だけを見る専用述語が要る）。
  ※`Change` はカード群の担当だが、負債の一般ルールに直結するのでここに記録する。
- **`Flourishing Trade`（盛大な取引・予言＝全カード $1 安い ＋ アクション権を購入権に使える）は負債コストに効かない**
  （公式例）＝本アプリの `cardCost` はコイン成分だけを下げるので自動的に正しい。
- **⚠ 負債は旭日の中で3つの別経路に出る**（混同しない）：
  1. **費用としての負債**＝`Daimyo [6D]` / `Mountain Shrine [5D]` / `Artist [8D]` / `Continue [8D]`
     ＝**購入したときだけ**負債を負う（`BUY` / `BUY_EVENT`）。
  2. **能力としての `+[D]`**＝`Gold Mine +[4D]` / `Root Cellar +[3D]` / `Imperial Envoy +[2D]` /
     `Litter +[1D]` / `Change`（コイン差ぶん）＝**獲得でも購入でもない**ので `takeDebt` とは別に
     `p.debt += n` を直接足す経路が要る（帝国に前例が無い＝**旭日で初めて出る**）。
  3. **山の上の負債**＝**予言 `Harsh Winter`（厳冬）**＝
     `When you gain a card on your turn, if there's [D] on its pile, take it; otherwise put [2D] on its pile.`
     ＝**帝国の徴税(Tax) とまったく同じ `state.pileDebt`**（§0-20 で新設済み・非カード・公開）。
     ⚠ **READ も WRITE も必ず `pileKeyOf(state, id)` を通す**（分割山の下段を実カードidで引くと永久に孤児化する
     ＝§0-20 の敵対レビューで実際に踏んだバグ）。**「自分のターンの獲得」限定**（徴税は「自分の購入フェイズの獲得」なので**条件が違う**＝共通化しない）。

---

## 4. イベント(Event)＝冒険/帝国と**完全に同じ**

ルールブック p.4「Events」節の逐語（**全文**）：

> Rising Sun has Events, which first appeared in Adventures. In your Buy phase, when you can buy a card,
> you can buy an Event instead. You pay the cost indicated on the Event and then do its effect.
>
> - Events are not Kingdom cards; they sit on the table and provide an effect you can buy. There is no way
>   for you to gain one or end up with one in your deck.
> - Buying an Event uses up a Buy; normally you can either buy a card, or buy an Event. If you have two
>   Buys, such as after playing Fishmonger, you can buy two cards, or buy two Events, or buy a card and
>   an Event (in either order).
> - **The same Event can be bought multiple times in a turn if you have the Buys and [$] available to do it.**
> - **You cannot play further Treasures that turn after buying an Event.**
> - **Buying an Event is not buying a card, for things that care about that, like Haggler (from Hinterlands).**
> - **Costs of Events are not affected by cards like Flourishing Trade.**

（A: `rulebook.txt` 154〜167行。⚠ 訂正④＝B は `such as after playing [Ranger, Villa, Sanctuary,
Sack of Loot, or Fishmonger]` / `does not trigger cards like [Haggler, Swamp Hag, or Charm]` と
列挙が増えている。**A の文を正とする**。）

**＝本アプリの既存実装（`BUY_EVENT`・`t.treasuresLocked`・`ONCE_PER_TURN_EVENTS`・コスト軽減を受けない）が
そのまま使える。** ただし2点だけターン構造に触る：

### 4-0. 🛑 **[訂正K＝批評 M5] `that turn` を字義どおりに実装すると、出荷済みのヴィラ(Villa) が退行する**

上の逐語は `You cannot play further Treasures **that turn** after buying an Event.` と**ターン単位**で書いてあるが、
**`Continue` は購入フェイズ→アクションフェイズへ戻る＝購入フェイズがもう一度来る**（§4-1）。
この2つは衝突する。**正解は「購入フェイズ単位」**：

- **同じルールブックの中に決着が書いてある**＝`Sea Trade`（海路）の解説（`rulebook.txt` **824行**、逐語）：
  > While this draws cards, **it's too late to play more Treasures in this Buy phase.**
- **本アプリは既に購入フェイズ単位で実装している**＝`js/engine.js` の `case 'END_ACTION_PHASE'` が
  `t.treasuresLocked = false;`（**12792行付近**）を実行し、コメントにも
  「ヴィラ等でアクションフェイズに戻り、再び購入フェイズに入った場合は『購入フェイズの最初から』＝財宝を出し直せる」
  と書いてある。**これは §0-21 の敵対レビューで [high] として確定した挙動**
  （`empires`/`empires-events` で「ヴィラを買った瞬間そのターン財宝を1枚も出せなくなる」退行を実際に踏んだ）。
- 略奪の `launch`（発進）も同じ形で `t.treasuresLocked = false;` を明示している（10914行付近）。

🛑 **`Continue` を実装するとき、逐語の `that turn` を根拠に `treasuresLocked` を「ターン単位」へ直してはいけない。**

### 4-1. `Continue` ／ **継続**  （[8D]・イベント）

- **英語カード文（逐語）**：
  ```
  Once per turn: Gain a non-Attack Action card costing up to [$4].
  Return to your Action phase and play it.
  +1 Action and +1 Buy.
  ```
- **日本語カード文（DO訳）**：
  ```
  1ターンに1度のみ：アタックでないコスト4以下のアクションカード1枚を獲得する。
  アクションフェイズに戻り、それを使用する。
  +1 アクション、+1 購入。
  ```
- **区切り線**：0
- **版**：`First edition / August 2024`。機能エラッタなし。
- **公式FAQ**（`Continue` ページ）：
  > You can only buy this once per turn. When you do, you gain an Action card costing up to [$4],
  > that isn't an Attack card; you return to your Action phase; and you play the Action card you gained.
  > **This doesn't use up any of your Action plays for the turn.** You also get +1 Action and +1 Buy.
  > **Returning to your Action phase doesn't cause "start of turn" abilities to repeat; however when your
  > Buy phase happens again after that, "start of Buy phase" abilities can repeat.**
- **公式FAQ（Other rules clarifications）**：
  > **If the gained card gets moved elsewhere (e.g. Rapid Expansion), Continue can't play it, but you still
  > return to your Action phase and get +1 Action and +1 Buy.**
  > **The card is gained in your Buy phase, but played in your Action phase. This matters for cards like
  > River Shrine (which cares if you gained cards in your Buy phase) and Crown (which cares which phase
  > it was played in).**
- **一般則（`Action phase` ページ "Return to your Action phase"＝`g6_returnphase.txt` の全4段落。
  [訂正L＝批評 M6] 初稿は3段落しか引いておらず、*結論が逆向きの4段落目*を落としていた）**：
  > ① If you return to your Action phase, for example by buying Continue, no start-of-turn effects are performed
  > when returning.
  > ② When returning to your Action phase, **At the end of your Buy phase effects are triggered, such as
  > Exploration. These effects trigger again during your next Buy phase.**
  > （同段落の具体例）**You can also use Villa's effect to perform end of Buy phase triggers such as getting
  > Coffers from Merchant Guild and then take [VP] from Basilica.**
  > ③ If gaining a card that returns to your Action phase and there are other when-gain effects which care
  > about which phase a card is gained in (such as Colonnade or Footpad), **they will still see when the card
  > was gained, regardless of whether they are resolved before or after returning to your Action phase.**
  > ④ **However, if a when-gain effect triggers new effects (such as gaining additional cards) after Villa's
  > effect has been resolved, these gains happened in your Action phase.**
  > For example, if resolving Villa and then reacting to gaining Villa by playing Sheepdog as Way of the
  > Butterfly and gaining Rocks, **Rocks is gained in your Action phase and is therefore gained to your hand.**

  ＝**③と④は逆向きの結論**。③＝**その札自身**の獲得時フェイズは動かない。
  ④＝**戻った *後* に連鎖した別の獲得**はアクションフェイズの獲得になる。

  **[私の追加＝実コードで確認] 本アプリは④を自動的に満たしている。**
  `gainWasBuyPhase` は `triggerOnGain` の**先頭で毎回ローカルに取り直す const**
  （`js/engine.js` 8967行 `const gainWasBuyPhase = !!(state.turn && state.turn.phase === 'buy');`）なので、
  **連鎖した獲得は新しい `gain()`→`triggerOnGain` 呼び出し＝そのときの `state.turn.phase`（＝`'action'`）を見る**。
  ＝批評の警告「Continue の後に `onGainQueue` が回す獲得を購入フェイズ扱いにしてはいけない」は
  **構造上すでに満たされている**（`gainWasBuyPhase` をグローバルな旗に "改善" しない限り壊れない）。
  ⚠ **逆に③を守るために `gainWasBuyPhase` を使い続けること**＝
  `js/engine.js` 9471行 `const inBuy = gainWasBuyPhase; // ヴィラが phase を戻しても「獲得時点」の購入フェイズ判定を使う`
  が公会堂(Colonnade)／列柱／浴場の正本（§0-19 の [medium] 2）。

  🛑 **②だけは本アプリが満たしていない**（→ 章末「出荷済みの実バグ候補①」）。

**⚠ 実装で危ないところ（Continue）**
- **ヴィラ(Villa)／騎兵隊(Cavalry)／発進(Launch) とまったく同じクラス**＝本アプリには**既に3つの前例**がある：
  - ヴィラ＝`js/engine.js` 9231行 `if (state.turn.phase === 'buy') { state.turn.phase = 'action'; state.turn.arenaFired = false; … }`
  - 騎兵隊＝9295行（`gainWasBuyPhase && state.turn.phase === 'buy'` の**二重条件**＝より安全な書き方）
  - 発進＝10909〜10916行（イベント側。`t.phase='action'` ＋ `t.treasuresLocked=false` ＋ `t.arenaFired=false` ＋ その後にドロー）

  **`Continue` はイベントなので `launch` が一番近い前例**。ただし `launch` と違い**先に獲得してから戻る**ので
  順序は「獲得 → （獲得時効果を全部解決）→ アクションフェイズへ戻る → 獲得した札を使う → +1アクション +1購入」。
- **`gainWasBuyPhase`（`js/engine.js` 8967行）を使う**＝獲得時点のフェイズで判定する既存の仕組みが、
  公式FAQ の「Colonnade / Footpad は獲得した時点のフェイズを見る」とそのまま一致している（§0-19 の [medium] 2）。
  ＝公式FAQ の `The card is gained in your Buy phase, but played in your Action phase.` がそのまま再現される。
- **`t.treasuresLocked` は「ターン単位」にしない**（§4-0）。`END_ACTION_PHASE` が解除する既存の設計に乗せる。
- **⚠ 「購入フェイズ終了時」の効果（ワイン商／野外劇／探査）は、戻る瞬間に一度誘発するのが公式**（上記②）。
  本アプリは誘発しない＝**既存の許容簡略化**（`launch` の case コメントに明記されている）。
  **Continue でも同じ簡略化を継承し、PROGRESS に明記すること**（旭日単独では該当カードが1枚も無い＝mix-all 限定）。
- **`ONCE_PER_TURN_EVENTS` に入れる**（旭日のイベント10種のうち **`Continue` だけ**）。
- **「獲得した札を使う」は `+1 Action` を消費しない**＝`playCardNoAction`（§0-26 で新設）を通す。
  ⚠ **戻り値を見て、成功したときだけ後続を進める**（§0-29 A4 の [high] 12＝
  「`playCardNoAction` の戻り値を見ずに予約を立てて無限に窓が開いた」の再発防止）。
- **獲得した札が動かされていたら使えない**（`Rapid Expansion`＝急速拡大の予言／望楼／`Progress`）
  ＝**stop-moving**（§0-30 P5 の侵略・埋められた財宝と同型）。**それでもアクションフェイズには戻る。**
- **`River Shrine`（川の社）が「このターンの購入フェイズで1枚も獲得しなかったか」を見る**ので、
  **購入フェイズが複数回あっても全部を通しで判定する**必要がある（ルールブック逐語＝
  `If you have multiple Buy phases, such as via Continue, River Shrine only gains you a card if you didn't
  gain a card in any of those Buy phases.`）＝**旗を「そのターンで1つ」にすること**
  （フェイズごとにリセットすると Continue で洗える）。

---

## 5. 持続(Duration)＝2025エラッタ ＋ 大名(Daimyo)

### 5-1. ⚠ **印刷版ルールブックは 2025年エラッタより前**（＝wiki の現行版と2文違う）

**印刷版（`rulebook.txt` 169〜179行）の逐語**：
> Rising Sun has a few Duration cards. Duration cards are orange, and have abilities that can happen on
> future turns. Duration cards are not discarded in Clean-up if they have something left to do on a future
> turn; they stay in play until the Clean-up of the last turn that they do something. Additionally, if a
> Duration card is played extra times by a card such as **Daimyo**, that card also stays in play until the
> Duration card is discarded, to track the fact that the Duration card was played extra times. Keep track of
> whether or not a Duration card was played on the current turn, such as by putting your cards into two lines.

**現行（英語wiki `Rising Sun` / `Duration` の "Official rules"）＝太字の2文が追加されている**
（私も `_expansion.txt` 743〜761行で実見して確認）：
> … they stay in play until the Clean-up of the last turn that they do something. **If a Duration card leaves
> play somehow, it stops doing things on future turns.** Additionally, if a Duration card is played extra
> times by a card such as [**Throne Room, Scepter, Mastermind, Specialist, Flagship, or Daimyo**], that
> card also stays in play until the Duration card is discarded, to track the fact that the Duration card was
> played extra times; **and that effect also ends if that card somehow leaves play.** …

差分の正体＝**2025年エラッタ**（`Errata` ページ "Rules"）：
> **Durations — No longer have any effect on future turns if the card has left play (2025).**
> A Duration card played extra times by a Throne Room variant that has left play is only multiplied for the
> remainder of the turn it was played, not during future turns.

### 5-2. Daimyo ／ **大名**  （[6D]・Action - Command）

- **英語カード文（逐語）**：
  ```
  +1 Card
  +1 Action
  The next time you play a non-Command Action card this turn, replay it afterwards.
  ```
- **日本語カード文（DO訳）**：
  ```
  +1 カードを引く
  +1 アクション
  このターン、次に命令でないアクションカードを使用したとき、それを再使用する。
  ```
- **区切り線**：0
- **版**：`First edition / August 2024`。機能エラッタなし。
- **公式FAQ**（`Daimyo` ページ・ルールブックの解説と一字一句一致）：
  > **This isn't optional**; whatever that next non-Command Action card is, Daimyo replays it.
  > **It replays it even if the card trashed itself.**
  > Command cards, such as Daimyo itself, are not replayed; Daimyo waits for a non-Command Action card
  > (or fails to do anything more if the turn ends before you play one).
  > **If you play two Daimyos and then e.g. a Craftsman, you'll play the Craftsman three times total -
  > once normally and once for each Daimyo.**
  > Daimyo costs [6D]; see the Debt section.

**⚠ Daimyo は `Action - Command` だが、サプライのカードを代理でプレイする命令ではない**
（大君主/はみだし者/船長/王子とは別型）＝**「次に使う非Command アクションを1回多く使う」＝予約型**。
`Command` 種別が付いているのは **§0-17 の「命令は命令をプレイできない＝無限ループ防止」だけのため**
（英語wiki 逐語＝`Command is a type … it has no meaning beyond stopping these cards from playing each other.`）。

### ⚠ 実装で危ないところ（§5）

- **`types: ['action','command']` でカタログに入れれば、`DOM.isType(card,'command')` を見ている
  既存の除外がすべて自動で効く**（`js/cards.js` に現在ある command 札＝王子・船長・はみだし者・大君主・王笏・旗艦の6枚。
  相続の屋敷は動的）。特に `js/engine.js` **2343行**の
  `if (DOM.isType(card, 'action') && !DOM.isType(card, 'command'))`（略奪の旗艦の `notePlunderPlay`＝関数定義は 2318行）と
  **3063行**の `if (DOM.isType(c, 'command')) return false;` が対象。
- **予約は「複数積める」＝旗（boolean）にしてはいけない**（公式例＝大名2枚→名匠は**3回**）。
  ⚠ **§0-30 P5 の「突貫(Rush)は累積しない旗／鏡映(Mirror)は累積カウンタ＝別実装」と同じ罠**。大名は**カウンタ側**。
- **「持続を再演したら大名も場に残す」＝略奪の決定D4（旗艦）と完全に同じ実装**。
  `js/engine.js` **2306行**の
  `for (let i = 0; i < k; i++) armDuration(state, seat, 'flagship', { type: 'flagship_linger', withCard: ctx.card });`
  と、`cleanupAndAdvance` の
  `const entries = allEntries.filter((e) => !e.nextTime && e.type !== 'flagship_linger');`（**7986行**）
  ＋ その次の行 `p.delayedEffects = allEntries.filter((e) => e.nextTime || e.type === 'flagship_linger');`
  ＋ **10414〜10419行の「再演相手の予約が尽きたら旗艦の予約も落とす」判定**を
  **`daimyo_linger` でそのまま複製する**（3箇所セット＝1つでも漏らすと場に残りっぱなしか、逆に早く捨てる）。公式が名指しする一覧
  （Throne Room / Scepter / Mastermind / Specialist / Flagship / **Daimyo**）に大名が入っている＝
  **本アプリの決定D4「旗艦は持続を再演したら場に残す（例外なし）」と完全に一致する。**
- 🛑 **これで §0-25/§0-28 の許容簡略化「玉座×持続では玉座が場に残らない」が旭日の単独セットでも見えるようになる**
  （旗艦は略奪、専門家は同盟だったので mix-all 限定だったが、大名は旭日の推奨セットに入る）。
  **PROGRESS の該当行を再確認すること。**
- **`It replays it even if the card trashed itself.`** ＝**自分を廃棄したカードでも再演する**
  （＝再演の対象は「今プレイしたカードid」であって「場にある物理カード」ではない）。
  本アプリの `state.replay`（玉座の2回目・略奪の `treasure_replay` 等）と同じ形。
  ⚠ ただし**自己移動したカードの2回目は `removeOne` が失敗して自然に不発になる**既存の挙動
  （§0-15 の投資／戦利品／法貨）とは**別の話**なので混同しないこと。
- **予約が余ったままターンが終わったら捨てる**（`or fails to do anything more if the turn ends before you play one`）
  ＝**次のターンに持ち越さない**。§0-29 A4 の [medium] 6「航海の使い切れなかった予約が後の通常ターンに
  持ち越されて本来存在しない追加ターンが湧いた」と同型の罠。
- **[批評 N10] 大名×習性(Way) は既存の許容簡略化をそのまま継承する（新たな判断は不要）**。
  §0-25 に「**玉座の間などの再演では習性を選び直せない**（公式は選べる＝許容簡略化）」がある。
  大名は「再演(replay)」なので**同じ簡略化がそのまま当てはまる**＝
  **「大名だけ直そう」と手を出さないこと**（直すなら玉座/王の宮廷/行進/旗艦/専門家 と横断で直す話になる）。
  ※逆に**無謀な(Reckless・略奪の特性)は `state.replay` の専用ラベル**で「習性・女魔術師・追いはぎで書き換えられたら
  2回にならない」を実現している（§0-30 P4）＝**大名は玉座側（普通の replay）**。混同しないこと。
- **2025年の持続エラッタ（場を離れた持続は以後働かない／再演した側も止まる）への本アプリの対応状況は未調査**
  （⚠ §10-3）。旭日とは独立に確認すること。

---

## 6. 準備(Setup)

### 6-1. 逐語（`rulebook.txt` 45〜68行・**全文**）

> Dominion: Rising Sun includes 25 randomizer cards (one for each Kingdom card pile). … As with
> previous Dominion games, players must choose 10 sets of Kingdom cards for each game. …
>
> Events can be shuffled into the randomizer deck (despite having a different back). They are not part of
> the 10 Kingdom cards used in a game; when an Event is turned over, put it on the table but keep turning
> over cards until you get 10 Kingdom cards. **For normal play we recommend using at most 2 such cards;
> with other expansions that includes Events, Traits, Landmarks, Projects, and Ways.** Skip any further
> landscape-oriented cards turned over. Also skip Events when using a randomizer card to determine
> whether or not to use Platinum/Colony (from Prosperity), or Shelters (from Dark Ages) in a game, or to
> determine the bane for Young Witch (from Cornucopia). …
>
> **In games using an Omen, shuffle the Prophecies, and deal out one to be used this game. Put a number
> of Sun tokens on it based on the player count; see the Omens and Prophecies section. If the Prophecy is
> Approaching Army, add an Attack card pile to the game (even if there already is one).**
>
> **In games using Riverboat, choose a non-Duration Action card costing exactly [$5] that is not being used,
> and set a copy of it aside.**

（`[$5]` は PDF では画像で欠落。**訂正⑥**＝`Riverboat` ページの `Info > Cost` は **`[$3]`＝Riverboat 自身のコスト**であり、
`[$5]` が出てくるのは `Card text` と `Official FAQ` の**2箇所**。g1 の「Info を含む3箇所」は出典の数え方の誤り。
**結論（脇に置くのは $5 のアクション）は正しい**。さらにルールブックの推奨セット行
`Riverboat (Market/Upgrade/Bazaar/Apprentice/City/Witch's Hut/Seer/Barbarian)` が**8つとも $5** で裏取りできる。）

### 6-2. 準備手順の順序（ルールブックの記載順）

1. 王国10種を決める（イベントは別に置く・**横型は合計2枚まで**）。
2. Platinum/Colony・Shelters・**若き魔女の災いカード(Bane)** の判定（ここで横型のランダマイザーは**飛ばす**）。
3. **Omen があれば予言を1枚配り、人数ぶんの Sun トークンを載せる。**
4. **予言が `Approaching Army` なら、アタックの王国カードの山を1つ追加する（既にアタックがあっても）。**
5. **Riverboat があれば、使っていない非持続の $5 アクションを1枚選んで脇に置く。**
6. （他拡張）Ally / Trait 等の選出。

### 6-3. Riverboat ／ **川船**  （[$3]・Action - Duration）＝**準備を要求する唯一の王国カード**

- **英語カード文（逐語）**：
  ```
  At the start of your next turn, play the set aside card, leaving it there.
  ————
  Setup: Set aside an unused non-Duration Action card costing [$5].
  ```
- **日本語カード文（DO訳）**：
  ```
  あなたの次のターンの開始時に、脇に準備したカードを動かさずに使用する。
  ————
  準備: このゲームで使わない、持続ではなくアクションであるコスト5の王国カード1枚を脇に置く。
  ```
- **区切り線**：**1**
- **版**：`First edition / August 2024`。機能エラッタなし。
  ⚠ **ホビージャパン版の印刷テキストは日本語wiki 本文（DO訳）と違う**（日本語wiki の「余談」が明記）。
  **本プロジェクトの方針は DO訳で統一**（略奪の決定3）なので上記を採用する。
- **公式FAQ**（`Riverboat` ページ）：
  > In setup, choose a non-Duration Action card costing exactly [$5] that isn't being used this game, and set
  > a copy of it aside. **You can use the randomizers to find such a card. If that card also requires setup,
  > do that setup too.**
  > When you play Riverboat, it plays the set aside card at the start of your next turn. **This doesn't move
  > the set aside card; it stays set aside, even if it has instructions on it that would move it.**
  > **Riverboat is normally discarded in your next turn's Clean-up, but it stays in play as long as the card it
  > plays would have, which sometimes is longer (such as a Crown, from Empires, used on a Duration card).**
- **公式FAQ（Other rules clarifications）＝g1 が落としていた4件（訂正D＝私の追加・[low]）**：
  > **This can't choose non-Supply cards that cost [$5] (like Disciple).**
  > **This can choose [$5]'s in a split pile (like Bustling Village).**
  > **If you get the Knights randomizer, you randomly pick one of the 9 Knights that cost [$5].**
  > **The chosen card does not have a pile, which means that if it's Wild Hunt, it can't gather [VP].**
  > **Unlike Band of Misfits, Riverboat is not a Command card.**
- **[批評 N4] 日本語wiki の「詳細なルール」が挙げる候補集合の追加2件**（`jp/batch0.txt` 1918〜1950行）：
  1. **混合山の中身も候補になり得る**＝**小さい城(Small Castle)** は
     `js/cards.js` 745行 `small_castle: { cost: 5, types: ['action','victory','castle'] }` ＝
     **ランダマイザー（`castles` プレースホルダ）は勝利点だが、そのカード自身は $5 の非持続アクション**。
     🛑 **§0-29 A2b「山の種別 vs 一番上の種別」とまったく同じ罠**＝
     `isTypeSupply(state, id, 'action')`（`mixedTopCard` を見る）で機械的に絞ると**山の状態次第で落とす／拾う**。
     **Riverboat が見るのは「山」ではなく「使っていない実カード1枚」**なので、
     **`DOM.CARDS[id].types` の静的判定＋`DOM.POOLS.castles` / `POOLS.knights` の中身を明示的に走査**するのが正しい。
     **騎士は `sir_martin` だけ $4**（`js/cards.js` で実測＝残り9枚が $5）＝FAQ の "9 Knights" と一致。
  2. **選んだ札に setup があれば再帰的に走らせる**具体例＝
     **幸運(Fate)カード（聖なる木立ち）なら祝福デッキ／不運(Doom)カード（呪われた村・人狼・迫害者）なら呪詛デッキ／
     Ferryman なら専用の山**を用意する。**§6-5b の M3 と同じ穴なのでセットで実装する。**

### 6-4. Approaching Army ／ **来寇**（予言）＝**11山目を作る**

- **英語カード文（逐語）**：`After you play an Attack card, +[$1].` ／ `————` ／
  `Setup: Add an Attack kingdom card pile to the Supply.`
- **日本語カード文（DO訳）**：`アタックカード1枚を使用したとき、+1 コイン。` ／ `————` ／
  `準備:ゲームにアタックである王国カードの山1つを追加する。`
- **区切り線**：**1**
- **公式FAQ**：
  > The Attack card added in setup is in addition to the usual 10 Kingdom cards, **even if those already
  > included an Attack card.** For split piles (from Allies and Empires), **a pile is an Attack pile if the
  > randomizer card for it is an Attack.** **The added pile is a regular Kingdom card pile, and can be gained
  > from like other piles. This setup occurs at the start of the game, and so affects the game even if the
  > Prophecy never happens.**

＝**追加の山は普通のサプライ山**（購入可・獲得可・**3山終了に数える**）。
`Approaching Army` ページ冒頭＝
`Alongside Young Witch, Approaching Army is therefore one of two things that causes the Supply to consist
of more than 10 Kingdom card piles.`

### 6-5. Divine Wind（神風）＝**準備手順がゲーム中に再走する唯一の例**

ルールブック逐語：
> Divine Wind: The 10 Kingdom card Supply piles used this game are removed, as well as an 11th pile if
> something added one (such as Young Witch's Bane pile, from Cornucopia). Ruins (from Dark Ages),
> Potions (from Alchemy), and Platinum and Colony (from Prosperity) are not removed. **Deal out 10 new
> Kingdom cards. Do any Setup for them that they require, including things like putting out the Potions if
> necessary. Do not give out Heirlooms (from Nocturne). Do not re-determine whether or not to use
> Shelters (from Dark Ages) or Platinum and Colony. Deal out an Ally (from Allies) if you get a Liaison and
> didn't already have one.** The removed piles are gone; they no longer count as empty piles if empty, and
> cards can't be returned to those piles. Players can continue playing with cards they got from those piles
> though. Tokens on the removed piles are no longer on them (such as tokens from Teacher, from
> Adventures). **Traits (from Plunder) and Obelisk (from Empires) still affect their removed piles, and the
> Bane (for Young Witch) is still the Bane. Search (from Plunder) does not trigger when piles are removed.**
> "In games using this" abilities, like Shaman's (from Plunder), continue to function for removed piles.

⚠ **`Deal out an Ally … if you get a Liaison` とは書いてあるが `Deal out a Prophecy` とは書いていない**
＝**新しい予言は配らない**（Divine Wind 自身が発動済みの予言だから）。
⚠ **新しい10種に Omen が入っても既に予言は使い切っている**＝以後の「+1 [Sun]」は空振り。
⚠ **Riverboat が新しく出てきたら、その setup（$5 の脇置き）も走る**（`Do any Setup for them that they require`）。
⚠ **特性(Trait)は撤去された山にも効き続ける**（`Trait` ページ "Other rules clarifications" が逆方向からも明言＝
`If Divine Wind goes into effect, the pile with the Trait is removed from the supply, but cards from that
removed pile still have the Trait.`）。

### 6-5b. 🛑 **⚠ 実装で危ないところ（神風 Divine Wind）＝本章で最も危険な1枚**

[訂正M＝批評 M1/M2/M3]。初稿は §6-5 で公式逐語を完全に引いていたが、**実装メモが1行も無かった**。
**神風は「本アプリで初めてカードがゲームから消えて、別のカードが湧く」機構**である
（略奪の戦利品も同盟の分割山も**総数は不変**だった）。**4つの機構を同時に壊す。**

#### (1) 🛑 **保存則テストが *必ず* 赤になる**

`test/invariants.test.js` の `runGame` は
```js
let s = E.createInitialState(...);
const init = tally(s);            // ← 開始時に1度だけ基準を取る
while (!s.gameOver && step++ < 20000) {
  s = E.reduce(s, CPU.decide(s));
  if (s.pending) continue;
  const d = diffTally(init, tally(s));
  if (d.length) return { okp: false, why: '保存則 step' + step + ': ' + d.join(' ') };
```
`tally(s)` は **`Object.keys(s.supply)` を全部数え、`MIXED_PILE_KEYS` の実カード配列を数え、
`s.trash` / `s.blackMarket` / `s.loot` / 各プレイヤーの `ZONES` / `archives` / `quartermasters` /
`turn.possessionGains` / `possessionTrash` / `tricksterHold` を数える**。
＝**撤去した10山ぶんが消え、新しい10山ぶんが湧く＝両方向で差分が出て一発で落ちる。**

**→ 正本としての方針（実装者が選ぶ）：**
- **推奨＝`state.removedPiles`（撤去した実カードの配列）に移し、`tally` に1行足す**
  （物理的には箱に戻るが、検査を壊さずに済む。`s.loot` を足したときとまったく同じ形＝§0-30 P1a）。
  **新しく湧く10山ぶんは "初期 tally に無いカード" なので、これは `removedPiles` では救えない**
  → **ハーネス側に「神風が発動したら `init` を取り直す」経路を足す**のが結局は必要。
- どちらにせよ **`test/invariants.test.js` に手を入れずに済む道は無い**。**この事実を知らずに着手すると必ず事故る。**

#### (2) 🛑 **撤去は `delete state.supply[id]` で行う（`= 0` にしてはいけない）**

`emptyPileCount(state)`（`js/engine.js` 7742行）は
`Object.keys(state.supply).filter((k) => … return state.supply[k] <= 0).length` ＝
**キーが残っていて 0 だと「空の山」に数える**。
公式逐語＝`The removed piles are gone; **they no longer count as empty piles if empty**` なので、
**0 のまま残すと神風の発動と同時に3山終了が成立して即終局する。**
`isGameOver` は `emptyPileCount(state) >= 3` を見ているので、10山撤去＝**確実に即死**。

**`delete` すれば (3) も同時に片付く**（下記）。

#### (3) 🛑 **「撤去した山にカードを戻せない」を守る関数は `returnToPile` / `canReturnToPile`**

公式逐語＝`cards can't be returned to those piles`。本アプリでこれを通る経路は
**`returnToPile(state, cardId)`（2106行）／`canReturnToPile(state, cardId)`（2128行）**（§0-29 A2 で新設した共通入口）。
呼ぶのは 取り替え子／交換(Swap)／**無謀な(Reckless)＝場から捨てるとき山へ戻す**／陣地／願い／交易商人の銀貨置換、
そして **本拡張の 2枚**：
- **濡女(Snake Witch `$2`)** ＝`… you may reveal it and **return this to its pile**, to have each other player gain a Curse.`
- **狼狽(Panic・予言)** ＝`When you play a Treasure, +2 Buys, and **when you discard one from play, return it to its pile.**`

＝**mix-all を待たず、旭日の中だけで踏む。**

**幸い、(2) の `delete` を守れば自動的に正しくなる**：
```js
function canReturnToPile(state, cardId) {
  if (LOOT_SET.has(cardId)) return Array.isArray(state.loot);
  const pile = pileKeyOf(state, cardId);
  if (isMixedPileKey(pile)) return Array.isArray(state[pile]);
  return Object.prototype.hasOwnProperty.call(state.supply, cardId);   // ← delete すれば false
}
```
＝**`hasOwnProperty` を見ているので、`delete` した山は「戻せない」と自動判定される。**
⚠ **混合山（廃墟／騎士／城／同盟の分割山6組）が撤去対象になったときは
`state.supply[山キー]` と実カード配列 `state[山キー]` の *両方* を始末する**
（片方だけだと `returnToPile` が `state[pile].unshift(...)` してカードが湧く／`tally` が数え続ける）。
※**廃墟(Ruins) は公式に撤去対象外**（`Ruins … are not removed.`）なので `state.ruins` は触らない。

#### (4) 🛑 **`Do any Setup for them that they require` は本アプリでは公式の列挙よりずっと広い**

公式逐語が名指しするのは **ポーション／Ally／家宝（配らない）／Shelters・Platinum/Colony（判定し直さない）** だけだが、
本アプリの `createInitialState` は**王国の内容から下記を全部導出している**（実コードで確認）。
**神風で `state.kingdom` を差し替えるなら、これらも作り直す／始末する必要がある：**

| 導出物 | 判定 | 神風での扱い |
|---|---|---|
| **戦利品の山** `state.loot`（30枚） | `DOM.LOOT_GIVERS` を **kingdom / events / traits** で走査（1669〜1672行） | 新10種に配り手が出たら作る |
| **馬の山** `supply.horse`（30） | `DOM.HORSE_GIVERS` を **kingdom / events / mouseCard** で走査（1606行） | 同上 |
| **廃墟** `state.ruins` | `looter` 種別 | **撤去しない**（公式）。新10種に略奪者が出たら作る |
| **賞品5種** | 馬上槍試合 | 新10種に応じて |
| **戦利品(暗黒時代)/狂人/傭兵** | 隠遁者・浮浪児 | 同上 |
| **精霊3種・願い・コウモリ** | 夜想曲の非サプライ山 | 同上 |
| **祝福デッキ／呪詛デッキ** | 幸運(Fate)／不運(Doom)カード | 同上 |
| **アーティファクト** | `artifactsForKingdom`（旗手/国境警備隊/剣客/出納官） | 同上 |
| **ゾンビ3枚を廃棄置き場へ** | `necromancer`（1676行） | ⚠ **これは「カードが3枚増える」＝保存則に直撃** |
| **災いカード(Bane)** | 若き魔女（`pickBane` 242行 / 1506行） | **新10種に若き魔女が出たら11山目を作り直す**（公式の再帰 setup） |
| **`Riverboat` の脇札** | §6-3 | **新10種に川船が出たら $5 の脇置きを走らせる**（公式逐語） |
| **`Approaching Army` の11山目** | §6-4 | **撤去対象**（「11th pile if something added one」に含まれる） |
| **`state.pileVP` / `pileDebt` / `pileFavor` / `p.pileTokens` / `obeliskPile`** | 山キー付きのトークン類 | **撤去した山キーが孤児化する**。公式＝**トークンは山から降りる**（`Tokens on the removed piles are no longer on them`）／**オベリスクと特性は効き続ける** |
| **`state.traits`（特性→山キー）** | 略奪 | **効き続ける**（公式逐語）＝`hasTrait` は `pileKeyOf` 正規化なので**触らないのが正解** |

- **`state.kingdom` 自体を差し替えること**も忘れない（UI・CPU・整合性テストが全部これを見る）。
  ✅ **安心材料**＝CPU の `evaluateKingdom(kingdom)` は
  `const key = K.slice().sort().join(','); if (__engCache[key]) return __engCache[key];`（`js/cpu.js` 871〜882行）
  ＝**王国内容をキーにしたキャッシュ**なので、`state.kingdom` を差し替えれば**自動で再評価される**（ここは壊れない）。
- **略奪の `Search`（調査）は撤去では誘発しない**（公式逐語）＝`fireNextTime(state, 'pile_empty', …)` を呼ばないこと。
- **`Shaman` の「In games using this」は撤去した山にも効き続ける**（公式逐語）。
- **新10種に Omen が入っても新しい予言は配らない**（§6-5 の逐語＝Ally は配ると書いてあるのに Prophecy は書いていない）。
  以後の `+1 Sun` は空振り（§1-8 の共通入口がそのまま終端する）。

#### (5) 実装順の推奨

**神風は「予言15種の中で1枚だけ桁違いに重い」ので、P◯ バッチの最後に単独で置く**
（略奪の P2＝"next time" 型持続と同じ扱い＝**共通機構を1つ作る日**にする）。
**先に (1) の保存則ハーネスを直してから**カード効果を書くこと（逆順だと全ソークが赤で何も進まない）。

### ⚠ 実装で危ないところ（§6）

- **予言の選出は `createInitialState` の中**（§0-29 A1 の `state.ally` と同じ位置＝`js/engine.js` 1517行）。
  サーバ権威なので `NEW_GAME` / `js/ui.js`（startLocal・restartLocal）/ `server/gameServer.js`（startGame）の
  追加配線は**不要**（Ally と同じ＝`createInitialState` が決めるので自動追従）。
  ⚠ **ただし特性(Trait) は例外だった**（§0-30 P7＝`traitsForSet` を新設して `landscapesForSet` に載せ、
  `NEW_GAME`/ui/server の3箇所に配線が要った）。**予言は Ally 側（配線不要）＝どちらの型かを取り違えないこと。**
- **`Approaching Army` の11山目は `js/engine.js` 242行の `pickBane(kingdom)` / 1506行の
  `baneCard = pickBane(kingdom)` と同じ形**で足す。**普通のサプライ山なので `emptyPileCount` に自然に数えられる。**
  ⚠ **`Divine Wind` の撤去は「11山目も撤去する」**＝Bane と `Approaching Army` の両方が対象（§6-5b）。
  - **[批評 N9] 周辺で触るもの**：`test/integrity.test.js` の「固定セットは王国10種」検査（**11山目は
    `createInitialState` が足すので `DOM.KINGDOM_RISINGSUN` には足さない**＝`pickBane` と同型）／
    **盤面が11山を描けること**（`js/ui.js` の `SUPPLY_ORDER` は基本＋王国10種しか返さない＝§0-23 の
    [high]「獲得モーダルにポーションの山が出ない」と同じクラスの穴）／
    `test/invariants.test.js` の出荷セット検証。
  - **[批評 N6] 若き魔女の災いカード(Bane)との関係**＝**Omen は Bane になれない**（最安が `[$4]` の
    Poet / River Shrine / Rustic Village ＝Bane は $2〜$3）。**逆に：**
    - **魚屋(Fishmonger `[$2]`) は Bane になれる**＝**影札が Bane の山になる**（裏が違う山がサプライに立つ）。
    - **川船(Riverboat `[$3]`) も Bane になれる**＝**Bane の再帰 setup で $5 の脇置きが走る**
      （公式＝`Do any setup the Bane card requires.`）。
- **`Riverboat` の脇置きは「サプライの外の1枚」**＝
  **`costUpTo` を使ってはいけない**（`costExact(state, id, 5, 0, 0)` ＝ $5 ちょうど・ポーション/負債は 0）。
  ⚠ ただし **`costExact` は内部で `gainableBase`（＝`(state.supply[id]||0) > 0`）を通す**ので
  **「サプライに *無い* カードを選ぶ」という Riverboat の要件とは逆**＝**そのままでは使えない**。
  **`DOM.CARDS[id].cost === 5 && !cost.potion && !cost.debt && types に action && !duration && サプライに無い`
  を自前で書く**こと。**一番近い前例＝`pickMouseCard(kingdom)`（`js/engine.js` 260〜280行＝
  ハツカネズミの習性の脇札。`inK.has(id)` で使用中を除外・`NON_SUPPLY` を除外・`c.potion || c.debt` を除外・
  ちょうどのコスト・非持続・非命令）**。
  🛑 **ただし `pickMouseCard` の除外をそのままコピーしてはいけない**＝あちらは
  `if (SPLIT_TOP[id] || DOM.POOLS.castles.indexOf(id) >= 0 || (DOM.POOLS.knights||[]).indexOf(id) >= 0) return false;`
  で**分割山の下段・城・騎士を全部弾いている**が、**Riverboat の公式FAQ は逆に「分割山の $5 は選べる／
  騎士のランダマイザーなら $5 の騎士9種から無作為」と明言している**（§6-3・N4）。
  ⚠ **`command` 種別を弾くべきか**は公式に明文が無い（ハツカネズミは弾く＝命令同士のループ防止）。
  **Riverboat 自身は Command ではない**（FAQ逐語）ので、**大君主/はみだし者を脇に置くと
  「非Command の川船が Command をプレイする」＝ループしない**＝弾かなくてよいはず。**⚠未確定（§10-8）。**
  **脇の1枚は山を持たない**＝`Wild Hunt`（野生の狩り＝帝国）が山上VPを溜められない／
  冒険の山トークン・徴税/厳冬の負債・特性 は乗らない
  （READ 側が `pileKeyOf` を通しても対応する `supply` キーが無い＝自然にそうなる）。
  ⚠ **「その札にも setup があれば走らせる」**＝若き魔女の Bane と同じ再帰（`Do any setup the Bane card requires.`）。
  **本アプリの前例＝`supply.horse = 30` の判定が `id === mouseCard` を見ている**（1606行）＝
  **脇札まで見て派生物を用意する書き方が既にある**（§1-8）。
- **`Riverboat` の「動かさずに使用する」は `playAsCommand`（§0-17）をそのまま使う**
  （日本語wiki も「はみだし者と同じ命令型の処理」と明示。**ただし Riverboat 自身は Command ではない**＝
  `types` に `command` を入れてはいけない。公式FAQ逐語 `Unlike Band of Misfits, Riverboat is not a Command card.`）。
- ⚠ **`Riverboat` は「その脇の札が場に残ったであろう間ずっと場に残る」**（公式FAQ）＝
  §5 の `daimyo_linger` と同じ機構が要る（**冠×持続の例まで名指しされている**）。
- **⚠ 未確定＝準備手順どうしの相互の順序**（§10-4）。本アプリは §0-30 P4 で
  「特性の選出は準備手順の最後（災いカードの山も候補）」と決めているので、
  **`Approaching Army` の追加の山も「配られた王国カード」に含める**のが自然だが**公式の明文が無い**。
  **許容簡略化として PROGRESS に明記するか、レビューで再確認すること。**

---

## 7. エラッタ

### 7-1. **旭日のカード／予言／イベントの機能エラッタは 1件も無い**（確定）

- 英語wiki `Errata` ページの拡張別リストで、**`Rising Sun` 節は見出しだけで中身が空**
  （`Plunder` の Journey の次が `Rising Sun` → `Arcana` → `Promotional cards` と見出しだけ並ぶ）。
- `Rising Sun`（拡張ページ）の Versions 表は**1行だけ**＝`August 2024 / PDF / First edition` ＝**刷りは初版のみ**。
- 個別に確認した旭日のカードも全部 `First edition / August 2024` の1行だけ
  （Approaching Army / Riverboat / Daimyo / Ronin / Tanuki / Continue / Fishmonger / Poet ほか）。

### 7-2. 一般ルールのエラッタは **3件**（うち2件は旭日が原因）

| 年 | 内容 | 本アプリ |
|---|---|---|
| **2024** | **Debt — Can be paid off at any time during your turn.** | **✅ 修正済み**（`7cc4534`・§3-5） |
| **2025** | **Durations — No longer have any effect on future turns if the card has left play.**<br>`A Duration card played extra times by a Throne Room variant that has left play is only multiplied for the remainder of the turn it was played, not during future turns.` | ⚠ **未調査**（§10-3） |
| （2021） | Coffers — Can be spent at any time during your turn. | 参考（財源は対応済のはず） |

### 7-3. **旭日が「原因で」他拡張のカードが変わった件が2件**

**① Scepter（王笏・ルネサンス）＝2024年エラッタ**
`2024 Errata` の **"Function card changes"** 節（⚠ 訂正⑧＝見出しは `Functional` ではなく **`Function`**。
`al` が付くのは `2025 Errata` だけ。**引用した本文は完全に正しい**）逐語：
> **Scepter — Gained the Command type and no longer allows Command cards to be replayed, to avoid
> loops with Enlightenment.**
> （Trivia）Enlightenment turns Scepter into an Action-Treasure, which lets Scepter replay itself forever.

→ **本アプリは既に対応済み**＝`js/cards.js` 802行
`scepter: { … types: ['treasure', 'command'], … text: '…命令でないアクションカード1枚を、再度使用する。' }`。**修正不要。**

**② Band of Misfits / Inheritance / Overlord ＝2025年エラッタ**
> **Band of Misfits, Inheritance, Overlord — Can no longer play Duration cards.**
> **Command variants such as Band of Misfits no longer stay in play for as long as the card they played
> would have stayed in play.**

→ 本アプリは §0-17 で**「大君主/はみだし者は持続を対象外」を既に実装している**
（PROGRESS では「未実装＝E9 候補」として据え置かれていたが、**2025エラッタで公式が本アプリ側に寄ってきた**）。
＝**据え置きの理由が「未実装」から「公式どおり」に変わった＝PROGRESS の E9 の記述を更新すべき。**
`Way of the Mouse — Can no longer set aside a Duration card.` も同じ2025エラッタ（移動動物園）。

### 7-4. **Capital（元手・帝国）にも2025年エラッタがある**（訂正⑦＝v_mechanics が追加。私も Versions 表で実見）

`Capital` ページ `Versions > English versions` の**3行目**：

| Text | Changes | Announced | Printed |
|---|---|---|---|
| `[$6]` `+1 Buy` **`When you discard this from play, +[6D].`** | **`Debt can be paid off at any time.`** | **February 2025** | **Not printed yet** |

（旧＝`When you discard this from play, take [6D], and then you may pay off [D].`）
`Capital` ページ "Other rules clarifications" 逐語＝
`Rising Sun updated the rules for Debt, allowing you to pay off debt at any time during your turn, making
the text about paying off debt during Clean-up redundant.`

**⚠ 要約ページ `Errata` の Empires 節には Capital が載っていない**（Basilica/Chariot Race/Charm/Colonnade/
Defiled Shrine/Donate/Encampment/Farmers' Market/Forum/Gladiator/Groundskeeper/Mountain Pass/
Overlord/Ritual/Rocks/Tax のみ）＝**要約ページだけ見ると必ず取りこぼす。個別カードの Versions 表が要る。**

**本アプリへの実害＝無い**（私の判断）。`js/engine.js` 10432行に
「元手＝場から捨てるとき、それ1枚につき負債6を負い、そのターンの残コインで可能な限り即返済」が実装されているが、
**2024エラッタで「ターン中いつでも返済できる」ようになった今、この専用処理は公式どおり冗長になっただけ**で、
結果は変わらない（クリンナップは自分のターンの一部＝いつでも返せる／コインはターン終了で消えるので
返済を見送る動機が無い）。
⚠ ただし **`Not printed yet` ＝ §0-29 A4 の `Royal Galley`（未印刷なので採らない）と同じクラス**である点は記録しておく。
**この件は機能差がゼロなので版の選択の議論にはならない。**

### 7-5. 参考：他の2025/2026エラッタ（担当外・出荷済み拡張に影響）

- **2025**: `Chariot Race`（**§0-26 で対応済**）／`Gamble`／`Reap`（**§0-26 で対応済**）／`Ritual`（**§0-26 で対応済**）／**`Capital`（上記）**。
- **2026**: **`Royal Galley` — Don't set the played card aside**（2025年の持続ルール変更に対応するため）。
  → ⚠ **本アプリは §0-29 A4 で「未印刷なので採らない」と決めて印刷版（脇に置く）を採用している。
  `2026 Errata` に正式に載ったので、この決定は再考の対象。**
  `Treasury`（宝物庫・海辺）— 条件が「**購入フェイズに獲得した勝利点**」だけになった。
  → ✅ **本アプリは対応済み**＝`d6cf76d fix(seaside): 宝物庫＝条件は「購入フェイズに獲得した勝利点」だけ（2026エラッタの文面へ更新）`
  （**この章の初稿を書いた後に別セッションが入れたコミット**＝§8-2 ⑧）。

---

## 8. 本アプリへの申し送り（第1章の結論）

### 8-1. 新規に必要なもの

| # | 内容 | 前例／同型 |
|---|---|---|
| 1 | **新種別 `omen`**（縦型6種）＋ **新種別 `shadow`**（縦型5種）＝表示ラベルを4箇所に | 同盟の `liaison` ／ 略奪の `loot` |
| 2 | **新 kind `prophecy`**（横型15種・**コスト欄なし**・**iris blue＝菖蒲色**） | 同盟の `ally`（濃い藍）／略奪の `trait`（深い臙脂） |
| 3 | **`state.prophecy`（1つ）＋ `state.sunTokens`（残数）＝どちらも非カード・公開** | `state.ally` ／ `state.pileVP` |
| 4 | **`+1 Sun` の共通入口**（Omen の効果の**先頭**で呼ぶ／0 になったら**その場で**予言を有効化） | — |
| 5 | **影札を山札から使う経路**（`PLAY_ACTION` に `from:'deck'`／玉座等の「手札から」窓にも並べる／資本主義なら財宝としても） | — |
| 6 | **`reshuffleDeck` に「影札を底へ」を追加**（**「運命の」の直後・`concat` の直前**・非対話・相対順は自動＝許容簡略化） | 運命の(Fated)／星図 |
| 7 | **`maskStateFor` の `'stash'` の例外を影札idにも広げる**（自席の位置保存＋相手席の deck/hand/setAside で晒す） | **へそくり(Stash)＝そのまま流用できる** |
| 8 | **`Daimyo` を `types:['action','command']` に**＋**予約はカウンタ**＋**持続を再演したら大名も場に残す** | 旗艦の `flagship_linger` |
| 9 | **`Continue` の「購入フェイズ→アクションフェイズへ戻る」**（`ONCE_PER_TURN_EVENTS` に入れる） | ヴィラ(Villa)＋`gainWasBuyPhase` |
| 10 | **`Approaching Army` の11山目**（普通のサプライ山＝3山終了に数える） | 若き魔女の災いカード(Bane) |
| 11 | **`Riverboat` の setup**（非サプライ不可・分割山可・騎士は9種から無作為・**その札の setup も走らせる**）＋`playAsCommand` ＋ `daimyo_linger` 型の場残り | 若き魔女の Bane の再帰 setup ／ はみだし者 |
| 12 | **`Divine Wind` の準備やり直し**（王国10＋11山目を撤去→新10種＋各 setup／Ally は必要なら配る／**予言は配らない**／特性・オベリスク・Bane は撤去した山にも効き続ける／略奪の `Search` は誘発しない）＝**§6-5b が正本。保存則ハーネス・`delete supply`・`returnToPile`・王国由来の派生物 の4つを同時に壊す** | — |
| 13 | **`+1 Sun` は予言が無ければ空振り**（川船の脇札・闇市場デッキから Omen が出る＝§1-8） | 同盟の `gainFavors` |
| 14 | **`Practice`（稽古・$3イベント）＝手札のアクション1枚を2回使用してもよい**（＝玉座の間をイベントにしたもの。**§2-9 群A の18個目**） | 玉座の間 `THRONE_CHOOSE` |
| 15 | **`Flourishing Trade` の後半＝アクション権を購入権として使える**（`t.actions`→`t.buys` の変換 action。**影札が使えなくなる方向に干渉する**） | `SPEND_VILLAGER` |
| 16 | **`Harsh Winter` ＝山の上の負債**（`state.pileDebt`・READ/WRITE とも `pileKeyOf` 必須・条件は「**自分のターンの獲得**」で徴税とは違う） | 帝国の徴税(Tax) |

### 8-2. 既存の出荷済み挙動

| # | 件 | 状態 |
|---|---|---|
| ① | 負債が購入フェイズでしか返済できない（2024エラッタ） | **✅ 修正済み（`7cc4534`）** |
| ② | 効果による獲得でも負債を負う | **✅ 修正済み（`7cc4534`）** |
| ③ | Scepter に Command 種別（2024エラッタ） | **✅ 元から対応済み** |
| ④ | 大君主/はみだし者が持続を使えない（2025エラッタ） | **✅ 結果的に公式どおり**（PROGRESS の E9 の記述だけ更新） |
| ⑤ | 持続が場を離れたら以後働かない／再演した側も止まる（2025エラッタ） | ⚠ **未調査** |
| ⑥ | `Royal Galley` の版の選択（2026エラッタに正式掲載） | ⚠ **§0-29 A4 の決定を再考** |
| ⑦ | `Capital` の2025エラッタ | **実害なし**（機能差ゼロ・§7-4） |
| ⑧ | `Treasury`（宝物庫・海辺）の2026エラッタ | **✅ 修正済み**（`d6cf76d fix(seaside): 宝物庫＝条件は「購入フェイズに獲得した勝利点」だけ（2026エラッタの文面へ更新）`＝**この章の初稿を書いた後に別セッションが入れた**） |

---

## 8-3. ⚠ **出荷済みの実バグ候補**（この章の調査中に実コードで見つけたもの）

**どちらも旭日そのものとは独立だが、旭日の実装で必ず触る場所**なので記録する。
**私が `js/engine.js` を実際に読んで確認した**（推測は [推定] と明記）。

### ① [低・確認済み] **アクションフェイズへ戻るとき「購入フェイズ終了時」の効果が誘発しない**（ヴィラ／騎兵隊／発進）

- **公式**（`Action phase` ページ "Return to your Action phase" 第2段落・`g6_returnphase.txt`）：
  > When returning to your Action phase, **At the end of your Buy phase effects are triggered, such as Exploration.
  > These effects trigger again during your next Buy phase.**
  > You can also use Villa's effect to perform end of Buy phase triggers such as getting Coffers from
  > Merchant Guild and then take [VP] from Basilica.
- **実コード**：購入フェイズ終了時の効果は3つ＝**ワイン商(`wine_merchant`・冒険)／野外劇(`pageant`)／探査(`exploration`)**
  （ルネサンスのプロジェクト）。誘発点は**`case 'END_TURN'` の中だけ**：
  ```js
  case 'END_TURN': {
    if (t.phase === 'night') { endBuyTailBaths(state, pi); return state; }
    if (t.phase !== 'buy') return state;
    if (t.coins >= 2 && (me.tavern || []).includes('wine_merchant')) { … }   // 12847行
    endBuyTail(state);                                                        // → pageant → exploration
  ```
  一方、アクションフェイズへ戻る3経路（**ヴィラ 9231行／騎兵隊 9295行／発進 10909行**）は
  `t.phase = 'action'` を代入するだけで `endBuyTail(state)` を呼ばない。
- **再現条件**：ルネサンスの「探査」を採用し、**その購入フェイズにカードを1枚も獲得していない状態でヴィラを獲得**
  （＝獲得しているので探査は不発……のように見えるが、公式は「戻る瞬間に1回」＋「次の購入フェイズの終わりに1回」の
  **計2回の誘発機会**がある）。より分かりやすいのは**ワイン商**＝
  「$2以上残したまま騎兵隊/発進でアクションフェイズへ戻り、2度目の購入フェイズで使い切る」と
  **公式なら1回目の戻りで酒場マットから回収できたのに、本アプリでは回収機会が消える**。
- **状態**：`launch`（略奪）の case コメントには
  `⚠ ワイン商/ページェントの「購入フェイズ終了」窓はこの経路では開かない＝許容簡略化` と**明記されている**が、
  **ヴィラ（帝国・2026-07 出荷）と騎兵隊（移動動物園）には注記が無く、PROGRESS にも記録が無い。**
- **到達性**：mix-all 限定（ヴィラ＝帝国／ワイン商＝冒険／探査・野外劇＝ルネサンス）。
- **推奨**：`Continue`（旭日）も**同じ簡略化を継承**し、**PROGRESS に3経路まとめて「許容簡略化」として明記する**
  （直すなら `endBuyTail` を「アクションフェイズへ戻る」3＋1経路から呼ぶ横断修正＝回帰リスクは中程度）。

### ② [中・確認済み] **冠(Crown)／首謀者(Mastermind)／門下生(Disciple) が `canPlayHandCard` を通らない**

- **症状**＝この3つの「手札からアクションを使わせる」窓は、**将軍(Warlord) に止められず、
  航海(Voyage) の「手札から3枚まで」にも数えられない**。
- **実コード**（`grep -n "canPlayHandCard(state, pd.player" js/engine.js` を 2026-08-16 に実行）：
  受理側でガードしているのは **GONDOLA_PLAY / INVASION_ATTACK / FIRST_MATE_PLAY / THRONE_CHOOSE /
  PROCESSION_CHOOSE / KINGS_COURT_CHOOSE / ALLY_MARKET_TOWNS / ROYAL_GALLEY_PLAY / SPECIALIST_PLAY / ELDER_PLAY** の10個。
  `STAFF_PLAY` / `TOIL_PLAY` / `CONCLAVE_PLAY` / `IMP_PLAY` は **`playCardNoAction`（654行）経由**で
  `if (fromHand && !canPlayFromHand(...)) return false; if (fromHand && warlordBlocks(...)) return false;`
  に守られている。
  🛑 **残る3つは `removeOne(hand); inPlay.push(card);` を直接やっている**：
  - `CROWN_CHOOSE` … 17703〜17704行（`if (card != null && p2.hand.indexOf(card) >= 0 && DOM.isType(card, 'action'))`）
  - `MASTERMIND_PLAY` … 18908〜18913行
  - `DISCIPLE_PLAY` … 15586行
  ＝`notePlayFromHand` も呼ばれないので**航海のカウンタも進まない**。
- **公式**：`Warlord` の Official FAQ は**玉座の間を名指しで禁止**しており（§0-29 A4 の [medium] 5 で
  本アプリが `canPlayHandCard` を新設した根拠そのもの）、**首謀者は玉座型**。
  `Voyage` は「そのターン、手札から3枚までしか使えない」＝**手札から使わせる経路は全部数えるのが公式**。
- **到達性＝出荷済みセットで到達可能**：**首謀者・将軍・航海はすべて同盟(Allies) の非分割25種**なので、
  **`random-allies`（出荷 CARD_SET）で同居しうる**。冠＝帝国／門下生＝冒険は mix-all 限定。
- **既存の記録との関係**：PROGRESS §0-29 A4 の「既知の許容簡略化」に
  **「航海の3枚制限は『手札から使用する』主要経路にだけ通してある」**という包括的な1行があるので、
  **意図的な据え置きの可能性はある**。ただし**カード名が列挙されておらず、将軍側については
  「リアクション窓では止めない」としか書かれていない**ので、**首謀者（玉座型・同一拡張・出荷セット）は
  想定外だった可能性が高い**＝[推定]。
- **旭日との関係**：**§2-9 群A に山札の影札を並べる改修で、まさにこの3つを触る。**
  **そのとき `canPlayHandCard` も同時に入れれば1回で片付く**（4面＝窓の条件・受理・CPU・UI）。
  ⚠ **受理側だけ締めると `crown` / `mastermind_play` / `disciple_play` の窓が候補ゼロで開いて詰む**
  ＝§0-29 A4 の [high] 12 とまったく同じ事故になるので、**窓を開く条件（1123 / 8953 / 6875行）も同時に直すこと。**

---

## 9. 検算

| 項目 | 数 | 一致確認 |
|---|---|---|
| 総枚数 | **300** | rulebook `300 cards` ＝ wiki Info `Cards 300` ✅ |
| 王国カード | 250（**25種**×10） | rulebook の25種名の列挙を数えて 25 ✅ |
| ランダマイザー | 25 | ✅ |
| イベント | **10** | rulebook の列挙／`g0_jp_pairs.md` の10件 ✅ |
| 予言 | **15** | `Prophecy` ページの一覧を数えて15 ＋ Donald X. `15 Prophecies` ＋ `g0_jp_pairs.md` の15件 ✅ |
| **前兆(Omen)** | **6** | `Omen` ページ一覧を数えて6 ＋ Donald X. `There are 6 Omens` ✅ |
| **影(Shadow)** | **5** | `Shadow` ページ一覧を数えて5 ＋ rulebook `five Shadow cards` ＋ **裏面画像5枚を実見** ✅ |
| Sunトークン | 13 | rulebook `13 Sun tokens` ＝ wiki Info ＝ `Materials` ✅ |
| 負債トークン | 40 | rulebook `40 Debt tokens` ＝ wiki Info ✅ |
| 250+25+10+15 | **300** | ✅ 合致 |
| 実装対象（縦型25＋横型25） | **50種** | 王国25＋イベント10＋予言15 ✅ |
| 発売日 | 2024年8月10日 | wiki Info `Release 10 August 2024`（rulebook 組版は 2024-06-13） ✅ |
| 刷り | **初版のみ** | Versions 表が1行 ✅ |
| 旭日のカード機能エラッタ | **0件** | `Errata` の Rising Sun 節が空 ✅ |
| 一般ルールのエラッタ（2024以降） | **2件**（Debt 2024／Durations 2025） | `Errata` "Rules" ✅ |

---

## 10. ⚠ 未確定（推測で埋めていないもの）

1. **相手の手札／脇に置かれた影札が全員に見えるか**の直接の公式記述は**無い**
   （`Shadow` ページは wiki 上で stub）。最も近い官製の手がかりは**へそくり(Stash) の Official FAQ**：
   > **Because Stash has a different back, you'll be able to tell when it's in other players' hands, or set
   > aside for a Haven (from Dominion: Seaside), and so on.**

   ＝**類推としては強い**（旭日の影札も裏が違う＝物理的に同じ状況）が、影札についての明文ではない。
   **本アプリは既にへそくりで「相手の手札・脇でも晒す」を実装しているので、同じにするのが一貫している。**
2. **影札を「シャッフルした束の底」に置くのか「山札全体の底」に置くのか**の明文（§2-7）。
   `Fated` には `the bottom of the shuffled cards, not on the bottom of your deck` という明文があるが、
   **影札についての同等の明文は取れなかった**。本アプリの `reshuffleDeck` では**結果が同一**なので実害なし。
3. **2025年の持続エラッタ（場を離れた持続は以後働かない／再演した側も止まる）に本アプリが対応しているか**は
   **調査していない**（第1章の担当外だが、大名の実装がこれに乗るので着手前に確認すること）。
4. **`Approaching Army` が追加した山が、特性(Trait)の候補／若き魔女の災いカード(Bane) になれるか**。
   `Approaching Army` / `Trait` / `Young Witch` の3ページを全文取得したが**本当に明文が無い**
   （検証担当も同じ結論）。逆に **Bane の山が `Approaching Army` の「既にアタックがある」判定に数えられるか**も未確定
   （そもそも「既にあっても追加する」ので実害は無い）。
5. **山札から使う影札が、同盟の航海(Voyage)の「手札から3枚まで」と将軍(Warlord)の制限に数えられるか**（私の追加）。
   カード文は `as if in your hand` だがルールブックは `this does not mean the Shadow card is in your hand` と言う。
   **公式の明文は取れなかった。** mix-all 限定。
   → **安全側＝数える（`notePlayFromHand` / `canPlayHandCard` を通す）** を推す
   （数えないと航海の制限を影札で洗える＝engine拒否とCPU提案がずれる余地も無い）。**PROGRESS に許容簡略化として明記すること。**
6. **`Practice`（稽古）／`Continue`（継続）のカード個別の裁定**はイベント群の担当。
   第1章は「山札の影札を対象にできる」「アクションフェイズへ戻る」という**一般則との接続だけ**を確定させた。
7. **「準備で予言を配るか」を王国10種だけで判定してよいか**（§1-8・批評 M4 由来）。
   公式は `In games using an Omen` としか言わず、**川船の脇札・闇市場デッキを含むかの明文が無い**。
   → **推す方針＝「王国10種 ＋ 川船の脇札」で判定し、闇市場デッキは含めない**
   （本アプリの `HORSE_GIVERS` がハツカネズミの脇札を見ている前例＋日本語wiki の川船ページの記述／
   闇市場デッキの中身は秘密なので準備の判定に使うと情報が漏れる）。**PROGRESS に明記すること。**
8. **`Riverboat` が命令(Command)カードを脇に置けるか**（§6-3・§6 の実装メモ）。
   公式FAQ は「非サプライ不可／分割山可／騎士は9種から無作為」までしか言わず、**Command について明文が無い**。
   本アプリのハツカネズミ（`pickMouseCard`）は Command を弾いているが、あれは
   「命令が命令をプレイする無限ループ」を防ぐため（習性のハツカネズミは Command 経由で使う）。
   **川船自身は Command ではない**（FAQ逐語）ので**理屈の上ではループしない**が、
   `playAsCommand` を通す実装にする以上、**大君主/はみだし者を脇に置いたときの挙動は要検証**。
   → **安全側＝弾く（許容簡略化として明記）**を推す。
9. **`Approaching Army` が追加した11山目が `Riverboat` の「使っていない $5」判定に影響するか**（自明ではある＝
   サプライに入るので候補から外れる）。準備手順の**順序**（11山目の追加 → 川船の脇置き）を固定すること。

---

## 11. 反映した訂正（確定版の段階）：**14件**（うち採用しなかった **0件**）

### v_mechanics.md の訂正 8件＝**8件すべて採用**

| # | 深刻度 | 内容 | 私の再検証 |
|---|---|---|---|
| ① | [medium] | 影札の裏面は**カードごとに別の絵**（`unique backs` は「5枚それぞれ別々」の意）＝裏を見れば "どの" 影札かまで分かる | **裏面画像5枚を自分で実見して確認**（§2-3）。マスク設計が「位置だけ」→「位置＋正体」に変わる |
| ② | [low] | Ronin/Tanuki の種別は wiki の `Info > Type(s)` で確定できる（g1 の値は5枚とも正しい） | `vm_7/8.txt` の Info 欄で確認 |
| ③ | [low] | Poet の「〜以下」は **`[$3]`** で確定 | `Poet` ページ Card text ＋ **日本語wiki「コスト3以下」** ＋ `Debt` の例文＝**3ソース独立一致** |
| ④ | [low] | A（ルールブック）と B（拡張ページ）は Debt/Events 節で文が一致していない＝「推測ゼロ」は方法論として不正確 | `_expansion.txt` 243〜274行を自分で開いて確認。**引用文の内容自体は正しい** |
| ⑤ | [low] | 庭園(Gardens) は「手札」ではなく**所有カード総数**＝底の影札も数える | 自明（`Worth 1 [VP] per 10 cards you have.`）。§2-8-7 に反映 |
| ⑥ | [low] | `Riverboat` の Info 欄は `[$3]`（自身のコスト）＝`[$5]` は Card text と FAQ の2箇所 | `g0_jp_pairs.md` の `Riverboat \| 3` でも独立に確認 |
| ⑦ | [low] | `Capital`（帝国）に2025年エラッタがある（要約ページには載っていない） | **`Capital` ページの Versions 表3行目を自分で実見**。ただし**本アプリへの実害は無い**と判断（§7-4） |
| ⑧ | [low] | `2024/2026 Errata` の見出しは `Function card changes`（`al` 無し） | 表記のみ。引用本文は正しい |

### 私がさらに追加した訂正 6件

| # | 深刻度 | 内容 |
|---|---|---|
| **A** | **[high]** | **g1 §8-2 の「実バグ①②」は既に修正・コミット済み**（`7cc4534`）。g1 も検証docも「そのまま着手してよい」と書いているが、`js/engine.js` の実コードを見ると `REPAY_DEBT` からフェイズ判定が消え、`takeDebt` は `BUY` と `BLACK_MARKET_BUY` の2箇所だけになっている。**二重に着手しないこと**（§3-5） |
| **B** | [medium] | **影札のマスクは「要判断」ではない**＝`maskStateFor` の**へそくり(Stash) の既存実装がそのまま答え**（自席は位置保存・相手席は deck/hand/setAside で晒す）。訂正①で裏が個別と確定したので、影札idをそのまま晒すのが公式に合う（§2-8） |
| **C** | [medium] | **影札の「山札から使える」はアクションのプレイに限らない**＝`Fishmonger` の "Other rules clarifications" 逐語「資本主義があれば、財宝を使えるときにも山札から使える」。g1 §2-7 の項目7/8 は書き方が狭すぎる（§2-5） |
| **D** | [low] | **`Riverboat` の setup に g1 が落とした細目が5件**（非サプライ$5は選べない／分割山の$5は選べる／騎士のランダマイザーなら$5の騎士9種から無作為／選んだ札は山を持たないので野生の狩りはVPを溜められない／**Riverboat は Command ではない**）（§6-3） |
| **E** | [low] | **「最後の Sun を取り除いたその瞬間に発火する予言」は Kind Emperor と Divine Wind の2つ**。g1 §1-5 の限定（「その人が特別扱いされる」）自体は正しいが、実装の観点では2つとも同じ穴に落ちる（§1-6） |
| **F** | [low] | **拡張の日本語名は「旭日（きょくじつ）」**。本タスクの指示文と PROGRESS の旧記述の「日の出づる国」は誤り（英語wiki Trivia ＋ 日本語wiki のページ名が独立に一致）（§0-0） |

**棄却＝0件。** 検証docの8件はいずれも一次資料に当たって裏が取れた。
g1 の記述で**内容として誤っていた逐語引用・コスト・種別・枚数は1件も見つからなかった**
（誤りは「保留にしなくてよいものを保留にした」「出典の付け方」「実装状況が古い」に集中している）。
⚠ **[批評 N1 で指摘・訂正] 上の1文は不正確だった**＝**日本語名の誤りが1件あり、私が黙って直していた**：
g1 §1-4 は `Mountain Shrine（山の祠）` と書いていたが、正しくは **山の社**（`g0_jp_pairs.md` ＝日本語wiki のカードページ）。
**検証doc(v_mechanics) もこれを見落としていた。** 訂正一覧に追記する（下記 G〜M と併せて）。

---

## 12. 【最終仕上げ】批評 `c_mechanics.md` の反映

### 反映した [must]：**8件／8件**　不採用：**0件**

| # | 深刻度 | 内容 | 私の再検証（実コード／一次資料） | 反映先 |
|---|---|---|---|---|
| **M1** | 最優先 | **神風(Divine Wind) は保存則テストを必ず赤にする**（初期 tally と毎ステップ突き合わせるハーネスに、10山消えて10山湧く）。`emptyPileCount` は `Object.keys(state.supply)` を走査するので **0 のまま残すと即3山終了** | ✅ **正しい**。`test/invariants.test.js` の `runGame` が `const init = tally(s)` を1度だけ取り、`diffTally(init, tally(s))` で比較していることを実見（30〜75行）。`emptyPileCount` は 7742行 | **§6-5b (1)(2) を新設** |
| **M2** | must | **「撤去した山にカードを戻せない」を守るのは `returnToPile` / `canReturnToPile`**。濡女(Snake Witch)・狼狽(Panic) は**旭日のカード**なので mix-all を待たずに踏む | ✅ **正しい**。2106／2128行で実見。カード文も `g0_jp_pairs.md` 14〜16行・198〜200行で確認。**＋私の精密化＝`canReturnToPile` は `hasOwnProperty(state.supply, cardId)` を見ているので、(2) の `delete` を守れば自動的に false になる**（追加のガードは要らない。ただし混合山は実カード配列も始末する） | **§6-5b (3)** |
| **M3** | must | **神風の「新しい10種の setup」は公式の列挙より広い**（戦利品／馬／廃墟／賞品／精霊／祝福・呪詛／アーティファクト／若き魔女／トークン類の孤児化／`state.kingdom` の差し替え） | ✅ **正しい**。`createInitialState` の該当行を全部実見（`LOOT_GIVERS` 1669〜1672／`HORSE_GIVERS` 1606／`necromancer` 1676／`pickBane` 1506）。CPU の `evaluateKingdom` が王国内容キーのキャッシュ（`js/cpu.js` 871〜882行）なのも実見＝**壊れないという安心材料も正しい** | **§6-5b (4) を表で新設** |
| **M4** | must | **サプライに Omen が無いのに `+1 Sun` が走る経路が2つ**（川船の脇札＝茶屋/狐が $5 非持続アクション／闇市場デッキ＝全 POOLS の平坦化） | ✅ **正しい**。闇市場の母集団は `js/engine.js` 1579行 `Object.values(DOM.POOLS)` の平坦化＋`STAGE1_POOLS` 除外を実見。**＋私の追加＝「準備で予言を配るか」の判定に本アプリの強い前例がある**（`supply.horse` の判定が `id === mouseCard` を見る＝1606行） | **§1-8 を新設・§10-7** |
| **M5** | must | **`that turn` を字義どおり実装するとヴィラが退行する**。ロックは購入フェイズ単位。決着はルールブック自身の Sea Trade 解説 `it's too late to play more Treasures in **this Buy phase**.` | ✅ **正しい**。`rulebook.txt` **824行**で逐語を実見（批評は825行としていたが1行差・内容は完全一致）。`END_ACTION_PHASE` が `t.treasuresLocked = false` を実行することも 12792行付近で実見 | **§4-0 を新設** |
| **M6** | must | **`Action phase` ページ "Return to your Action phase" の4段落目を落としている**（戻った後に連鎖した獲得はアクションフェイズの獲得） | ✅ **段落の存在は正しい**（`g6_returnphase.txt` 105〜113行で実見）。**⚠ ただし実装上の含意は精密化した**＝`gainWasBuyPhase` は `triggerOnGain` の**先頭で毎回取り直すローカル const**（8967行）なので、**連鎖した獲得は自動的に `'action'` を見る＝本アプリは④を既に満たしている**。批評の「購入フェイズ扱いにしてはいけない」は構造上すでに達成済み。**代わりに②（購入フェイズ終了時の効果）は満たしていない**ことを発見 → 出荷済みバグ候補① | **§4-1 を4段落に拡張・§8-3 ①** |
| **M7** | must | **影札を受け入れる窓の列挙が不完全**（`p.hand.some(isType 'action')` は30箇所近い）。**「使用する窓」と「捨てる/廃棄する/脇に置く窓」を分けないと公式違反** | ✅ **正しい**。実測 **24箇所**（批評の「30箇所近く」はやや多め）。**＋私が全部を実際に開いて群A 17窓／群B 12窓＋αに分類し、`canPlayHandCard` の有無まで表にした**。批評が挙げた6つ（一等航海士・杖・コンクラーベ・門下生・苦労・冠/首謀者）はすべて実在 | **§2-9 を新設（表2つ）** |
| **M8** | must | **狐(Kitsune)の選択肢の並びが公式と逆**（公式＝`+2 Actions` が先）。`ELDER_CHOICE_ORDER` は記載順で登録するので、直さないと webp の焼き直しになる | ✅ **正しい**。英語wiki の `Card text`（`vm_7.txt` 393〜399行）と `Versions` 表（507〜513行）の**2箇所とも `+2 Actions` が先**。日本語wiki のキャッシュ（`jp/retry2.txt` 15〜38行）も**同一ページ内で EN 列と JP 列が矛盾**していることを実見 | **§1-4 の表を修正＋訂正G** |

### 拾った [nice]：**10件／10件**

| # | 内容 | 反映先 |
|---|---|---|
| N1 | 「g1 に内容の誤りは1件も無い」は不正確＝**山の祠 → 山の社**の日本語名訂正を黙って入れていた | §11 末尾に追記 |
| N2 | **「進歩／盛大な取引の HJ版テキストが違う」は出典が無い**（`jp/*.txt` の全文検索で HJ版併記があるのは**川船だけ**）／「印刷版の名前も好機到来」も出典なし | §1-5 の⚠を書き直し（訂正H） |
| N3 | **`Flourishing Trade` は2文**＝後半 `You may use Action plays as Buys.` が**影札のアクション権消費と干渉する** | §1-5 に追記・§8-1 に項目15 |
| N4 | `Riverboat` の候補に **小さい城(Small Castle・$5 のアクションだがランダマイザーは勝利点)** が入る／**再帰 setup の具体例**（幸運→祝福デッキ／不運→呪詛デッキ／Ferryman） | §6-3 に追記 |
| N5 | `Materials` 逐語＝**Sun は13個で「代用品を」の記述が無い＝上限クランプ不要** | §1 の実装メモ |
| N6 | **Omen は Bane になれない**（最安 $4）／**魚屋($2)・川船($3) は Bane になれる**＝川船が Bane だと**再帰 setup が走る** | §6 の実装メモ |
| N7 | `Stash` の Official FAQ `You can't look at the fronts of the cards you're shuffling` ＝**影札の非対話自動整列の正当化にそのまま使える** | §2 の実装メモ |
| N8 | **CPU が山札から影札を使えないと、影札5種の経路がソークで一度も通らない**（`chooseAction` は手札しか走査しない） | §2 の実装メモ |
| N9 | `Approaching Army` の11山目が触る周辺（整合性テストの「王国10種」検査／盤面が11山を描く／`createInitialState` で足す） | §6 の実装メモ |
| N10 | **大名×習性は §0-25 の既存の許容簡略化をそのまま継承**（新たな判断は不要＝「大名だけ直そう」と手を出さない） | §5 の実装メモ |

### 追加の訂正（この仕上げで私が実コードから見つけたもの）

| # | 深刻度 | 内容 |
|---|---|---|
| **G** | [medium] | **狐の選択肢の並び**（＝M8。出所の `g0_jp_pairs.md` に内部矛盾があった） |
| **H** | [low] | **HJ版テキストの差異が確認できているのは川船だけ**（＝N2。初稿は進歩・盛大な取引についても断定していた） |
| **I** | [medium] | **`+1 Sun` は「予言が無ければ空振り」が要る**（＝M4）。あわせて**準備の判定に脇札を含める前例**（`HORSE_GIVERS` × `mouseCard`）を発見 |
| **J** | [medium] | **影札の窓を群A/群Bに分類**（＝M7）。`canPlayHandCard` の有無まで実測した |
| **K** | [high] | **`treasuresLocked` を「ターン単位」に直すとヴィラが退行する**（＝M5）。§0-21 で [high] として一度潰した事故の再発防止 |
| **L** | [low] | **`gainWasBuyPhase` はローカル const なので、戻った後の連鎖獲得は自動的に正しい**（＝M6 の精密化） |
| **M** | [medium] | **神風の実装メモを新設**（＝M1/M2/M3）。**`delete state.supply[id]` にすれば `emptyPileCount` と `canReturnToPile` が同時に正しくなる**という具体解を実コードから導いた |
| **N** | [中] | **出荷済みバグ候補②＝冠/首謀者/門下生が `canPlayHandCard` を通らない**（§8-3。首謀者・将軍・航海はすべて同盟＝`random-allies` で同居しうる） |
| **O** | [低] | **出荷済みバグ候補①＝アクションフェイズへ戻るとき「購入フェイズ終了時」の効果が誘発しない**（§8-3。`launch` にだけ注記があり、ヴィラ・騎兵隊には無い） |
| **P** | [参考] | **`Treasury`（宝物庫）の2026エラッタは `d6cf76d` で対応済み**＝初稿の §7-5 は「未対応」の口ぶりだったが、**この章を書いた後に別セッションが直した**。§8-2 に⑧として追記 |

### 枚数の検算（仕上げ後も不変）

| 項目 | 数 | 確認 |
|---|---|---|
| 総枚数 | **300** = 250 + 25 + 10 + 15 | ✅ |
| 王国カード | **250**（25種 × 10枚） | ✅ |
| ランダマイザー | **25** | ✅ |
| イベント | **10** | ✅（`Continue` / `Practice` を含む） |
| 予言(Prophecy) | **15** | ✅（§1-5 の一覧を数えて15・日本語名も15/15） |
| 前兆(Omen) | **6** | ✅（§1-4 の表を数えて6・**アタックは狐1枚**） |
| 影(Shadow) | **5** | ✅（§2-1 の表を数えて5・**アタックは忍者1枚**・裏面画像5枚を実見） |
| Sunトークン | **13**（2人5/3人8/4人10/5人12/6人13） | ✅ |
| 負債トークン | **40** | ✅ |
| **実装対象** | **50種**（縦型25＝王国／横型25＝イベント10＋予言15） | ✅ |
| 影札の窓（§2-9） | 群A **17**＋新設 `practice` **1** ／ 群B **12＋α** | ✅ 実コードを1つずつ開いて分類 |
| 反映した [must] | **8／8**（不採用 0・うち2件を精密化） | ✅ |
| 拾った [nice] | **10／10** | ✅ |
| 出荷済みバグ候補 | **2件**（①低・②中） | ✅ 実コードで確認 |


<!-- ===== m2_kingdom_2_3.md ===== -->

# 【確定版・第2稿】Rising Sun（旭日）第2章 王国 $2〜$3（6枚）

- 確定日: 2026-08-16（第1稿）／**最終仕上げ: 2026-08-16（批評 `c_k23.md` を反映した第2稿）**
- 入力＝収集doc `g2_kingdom_2_3.md` ／ 敵対検証doc `v_k23.md` ／ 日本語対応表 `g0_jp_pairs.md` ／
  完全性の批評 `c_k23.md`
- **この確定版で自分で取り直した一次資料**（＝検証doc・批評docを鵜呑みにしていない箇所）：
  - 英語wiki ライブ直読み（`node tools/wikidirect.js`）＝`Aristocrat` / `Snake Witch` / `Riverboat` /
    `Fishmonger` / `Craftsman` / **`Root Cellar`（第2稿で追加取得）**。生HTML＝`C:/tmp/risingsun_research/raw_m_k23/`
  - RGG 公式ルールブック 2024年版 `rulebook.txt`（Debt 節 L72-107／Shadows 節 L128-152／Daimyo 項 L248-253）
  - **Shadow のカード裏面画像を実見**（`_alley.jpg` / `_ninja.jpg`）＝第2稿の重要な確定材料（後述）
  - **コードベースの断定は第2稿で全部 grep し直した**（`js/engine.js` / `js/cpu.js` / `js/ui.js` /
    `js/carddata.js` / `js/cards.js` / `test/*.js`）。**行番号は HEAD = `d6cf76d` 時点**。
- **日本語名・カード文は Dominion Online 訳**（日本語wiki の個別カードページのヘッダ表。§4 決定3の方針）。

---

## 章の前提（6枚に共通して確定した事実）

- **6枚とも `English versions` のデータ行は1行だけ**＝`Changes = First edition` / `Announced = Printed = August 2024`。
  → **6枚とも機能エラッタ無し・刷りは初版のみ**。旧文面は存在しない。
  ※ Aristocrat／Craftsman の Secret history にある「$4 → $3 にした」は**開発中の話**＝エラッタではない。
  **列の根拠（生HTMLで確認）**＝Versions 表のヘッダは `Print | Digital | Text | Changes | Announced | Printed`。
  Fishmonger の唯一のデータ行は **Print＝カード画像あり／Digital＝空セル**／Text＝カード文／
  `First edition` ／ `August 2024`（Announced と Printed は colspan で1セル＝同月）。
  ＝**「デジタル専用のエラッタが無い」ことの根拠列そのもの**（PROGRESS §0-30 の
  「strip 済みテキストでは表の『列』が消える＝生HTMLで判定する」に従って確認した）。
- **id 衝突ゼロ**（既存 `DOM.CARDS` 560／`DOM.LANDSCAPES` 201 と照合済み）＝
  `fishmonger` / `snake_witch` / `aristocrat` / `craftsman` / `riverboat` / `root_cellar`。
  ⚠ `root_cellar` は**既存 `cellar`（地下貯蔵庫・基本）と紛らわしいので必ず `root_` を付ける**。
  近い既存id＝`cellar` / `artisan` / `fishing_village` / `fisherman` / witch 系6種 / `nobles` /
  `the_rivers_gift` / `crafters_guild`。どれも別id。

### ★0 行番号は必ず自分で `grep` する（第2稿で最初に書く教訓）

第1稿はコードの行番号を書いたが、**`js/engine.js` は commit のたびに数十行ずれる**。
実際に第1稿→批評→第2稿の間に HEAD が `7cc4534`→`d6cf76d` に進み、
**第1稿の行番号も、批評 `c_k23.md` が「一律 +13 ずれている」と書いた補正値も、どちらも既に外れている**
（例＝`REPAY_DEBT` は第1稿 17344／批評 17357／**実際 17379**）。
→ **この文書の行番号は HEAD `d6cf76d` 時点の実測値**だが、**孫引きせず必ず関数名で grep し直すこと**。
   ```
   grep -n "function costExact\|function playAsCommand\|function pickMouseCard" js/engine.js
   ```
   **関数名・定数名だけが安定したアンカー**で、行番号は参考値。

### ★1 負債(Debt)の2024エラッタは **もうコードに入っている**

収集docは「本アプリの `REPAY_DEBT` は購入フェイズ限定＝要判断」と書いているが、**これは既に解決済み**。
**コミット `7cc4534`「fix(empires): 負債の2024エラッタ＝出荷済みの実バグ2件を修正（旭日の段階0で発覚）」**で
2点が公式へ寄せられている（`git show 7cc4534` で確認済み）：

1. **負債はターン中いつでも返済できる**（購入フェイズ限定を撤廃）＝`js/engine.js:17379` の `case 'REPAY_DEBT'`。
   **財宝を出せるようになるわけではない**（`PLAY_TREASURE` は購入フェイズ判定のまま）＝公式の
   `This does not let players play Treasures at any time.` を満たしている。
   ⚠ 許容簡略化＝`state.pending` がある間は返せない（reducer 冒頭 `if (state.pending) return state;`）。
   ⚠ **`js/engine.js:17378` の1行コメントだけが旧文言「購入フェイズに $1=1個」のまま取り残されている**
      （直下の詳細コメントブロックは正しい）。次に触るとき直すこと（挙動には影響しない）。
2. **負債を負うのは「購入」したときだけ**（効果での獲得では負わない）＝`takeDebt` を `gain()` から外し
   `BUY` / `BLACK_MARKET_BUY` へ移した（`js/engine.js:1908` の関数コメントに逐語あり）。

→ **したがって Craftsman / Root Cellar で新しく要るのは「+D（プレイ時に負債を得る）」の入口だけ**。
  **`takeDebt(state, pi, cardId)` を流用してはいけない**（`js/engine.js:1908`＝**カードの負債"コスト"を読む**関数。
  Craftsman のコストは $3 で `debt` フィールドを持たないので、呼んでも 0 で素通りする）。
  **`addDebt(state, pi, n)` 相当を新設**し、`addActions`（`:1845`）/ `addCoins`（`:1854`）と同じ
  「唯一の入口」にすること。
  なお **コスト由来でない負債付与の既存サイトは4つ**（第2稿で全部 grep）＝
  | 場所 | 何 | 支配(Possession)の振り分け |
  |---|---|---|
  | `js/engine.js:1914`（`takeDebt`） | 購入した札の負債コスト | ✅ ある |
  | `js/engine.js:9033` | 帝国・徴税(Tax)の山上負債 | ✅ ある |
  | `js/engine.js:12440` | `BUY_EVENT` の負債コスト | ✅ ある |
  | `js/engine.js:10473` | 帝国・元手(capital) の「場から捨てるとき負債6」 | ❌ **無い（＝出荷済みの実バグ候補・章末参照）** |
  | `js/engine.js:12886` | 帝国・峠(Mountain Pass) の落札 | ❌ 無い（[推定]・章末参照） |
  ＝**`addDebt` は必ず `takeDebt:1912` と同じ振り分け
  `(t.possessedBy != null && pIndex === t.active) ? t.possessedBy : pIndex` を持たせること。**
  即返済の作法（コインが余っていればその場で返す）は `capital`（`js/engine.js:10470-10477`）が良いコピー元。

### ★2 新種別 `shadow`（影）の**表示ラベル登録は4箇所**（忘れると既存テストが2本 即赤）

`shadow` は本アプリに存在しない新 type。**PROGRESS §0-30b が `loot` で明文化した「4箇所」とまったく同じ**：

| # | ファイル:行 | 追加するもの |
|---|---|---|
| 1 | `js/carddata.js:115` `ALLIES_TYPE_JP` | `shadow: '影'` |
| 2 | `js/carddata.js:116` `ALLIES_TYPE_EN` | `shadow: 'Shadow'` |
| 3 | `js/ui.js:124-129` `TYPE_JP` | `shadow: '影'` |
| 4 | `test/integrity.test.js:120` `JP` ／ `:121` `EN` | 同上（**engine とは別のハードコード表が2つある**） |

- 落ちると赤になるテスト＝`test/integrity.test.js:116-129`（5b。`d.typeLabel.includes(undefined)` で落ちる）／
  `test/ui.test.js:448-467`（`UI.TYPE_JP` の網羅検査＝§A2 [low] 10 の再発防止で入れた恒久検査）。
- 値の根拠＝`g0_jp_pairs.md` の `アクション-影`（Fishmonger / Alley / Ninja / Ronin / Tanuki の5枚とも）。
- **`omen`（前兆）も同じ4箇所**（別群の担当だが、ここは同時に触るので調整すること）。
- **枠スキン(`tools/build-cards.js`)の新設は不要**＝`js/carddata.js:100-110` の `frameType` は未知の type を
  素通りして `action` を返す（特別扱いは `night`/`duration`/`attack`/`reaction` のみ）。
  **Shadow が特別なのは「裏面」であって表面の枠ではない**。
  ⚠ 逆に決めが要るのは **「山札の裏面（`'back'`）を Shadow だけ描き分けるか」**＝UI の判断（下の Fishmonger ⚠1）。

### ★3 **`state.mouseCard`（ハツカネズミの習性）が Riverboat と Shadow の最良の前例**（第2稿の最大の発見）

第1稿は Riverboat の前例に「若き魔女の災いカード(Bane)」を挙げたが、**構造がもっと近いものが既にある**＝
**移動動物園の「ハツカネズミの習性(Way of the Mouse)」**（§0-25）。Riverboat が必要とする性質を**全部**持つ：

| Riverboat に必要な性質 | `mouseCard` の既存実装 |
|---|---|
| 準備で**王国外**の札を1枚決める | `js/engine.js:1603` `pickMouseCard(kingdom)` |
| **サプライに載せない**・公開・対局中不変 | `js/engine.js:1705` `mouseCard,  // サプライではない・公開・対局中不変` |
| **動かさずに使用する** | `js/engine.js:3661` `playAsCommand(state, pi, card, state.mouseCard)` |
| **セットアップ走査に混ぜる** | `js/engine.js:1606` `... || id === mouseCard`（馬の山を立てるか） |
| 盤面に脇札の名前を出す | `js/ui.js:1426-1427`（`（脇：〇〇）`） |
| **保存則に数えない**（`allCards`/ZONES に無い） | 既にそうなっている（テスト `test/menagerie.test.js:556-560`） |

→ **`state.riverboatCard` は `state.mouseCard` の完全な同型として作る**。候補述語も
`pickMouseCard`（`js/engine.js:260-278`）をコピー元にする。**ただし1行だけコピーしてはいけない**（下の Riverboat ⚠2）。

---

## 第2章 王国 $2〜$3（6枚）

---

### Fishmonger ／ 魚屋  （$2・Action - Shadow ／ アクション-影）

- **英語カード文（逐語）**：

```
+1 Buy
+$1
————
You can play this from your deck as if in your hand.
```

- **日本語カード文（DO訳）**：

```
+1 購入
+1 コイン
————
これは手札からと同様に山札からも使用できる。
```

- **区切り線**：**1本**（`+$1` の直後、Shadow のリマインダ行の直前）。
  ※ 生HTML の `<hr>` 総数は 5 だが、**カード文（infobox）の中は 1本**（残りは Versions 表と
  Other language versions 表の同じ行）。
- **版**：`First edition` / `August 2024` の1行のみ＝**機能エラッタ無し**。
- **公式FAQ・裁定**（wiki `Official FAQ` **2項目** ＋ `Other rules clarifications` **1項目**＝計3。
  ライブ確認済み。ルールブック p.4 の `Fishmonger:` 項も一字一句同一）：
  > See the Shadows section.
  > When you play Fishmonger, you get +1 Buy and +$1.

  **Other rules clarifications**：
  > If you have bought Capitalism, you can also play Fishmonger from your deck whenever you could normally play Treasures from your hand.

  **Shadows 節（ルールブック p.4・逐語・全7項目）**＝この1枚のためだけでなく Shadow 5枚（Fishmonger /
  Alley / Ninja / Ronin / Tanuki）に共通する正本：
  > Rising Sun has five Shadow cards. These cards all have unique backs, and can be played from your deck.
  > - When shuffling Shadow cards, put them on the bottom. If you have multiple Shadow cards, they can go in any order at the bottom. They can also be mixed with any other cards you specifically put on the bottom, such as Fated cards from Plunder.
  > - You may wish to turn your Shadow cards sideways at the bottom of your deck, so that it is easy to remember that they are there.
  > - Shadow cards will not necessarily stay on the bottom of your deck; they are just put there when shuffling them.
  > - Shadow cards are not put on the bottom when gained, or at any time other than when shuffling them.
  > - You can look through your deck at the card backs at any time, and see where your Shadow cards are.
  > - Whenever you can normally play an Action card, you can play a Shadow card from your deck. It can be anywhere in your deck. **You play it exactly as if playing it from your hand; it goes into play and you follow its instructions.**
  > - When a card like Throne Room tells you to play a card from your hand, you can use that opportunity to play a Shadow card from your deck.
  > - You can play Shadow cards from your deck as if in your hand, but this does not mean the Shadow card is in your hand; for example you cannot discard it to an ability like Alley's (unless it is actually in your hand).

  （太字＝収集docが落としていた一文。検証doc [low] 5 の指摘どおり。**「山札から出しても場(inPlay)に入る」**を確定させる）

  **Preview（Donald X.・逐語）**：
  > Fishmonger is like +1 Card +1 Buy +$1, but the card it draws is itself.
  > They can still be played from your hand too; it's just not usually what you prefer.

  ＝**「山札からしか使えない」実装にしてはいけない**。
  **Secret history**＝初手 $2 で買って $5 を保証できるゲーム性（要約）。
- **⚠ 実装で危ないところ**
  1. **マスク（`maskStateFor`・`js/engine.js:21138`）は分岐が2つあり、両方直す必要がある。**
     第1稿は**相手席の三項だけを直せばよい**と書いたが**誤り**（批評 [must] 3 が正しい）。実コードは：
     ```js
     js/engine.js:21142  if (i === seat) {                                  // ← 自席
     js/engine.js:21143    const rest = p.deck.filter((c) => c !== 'stash').sort();
     js/engine.js:21144    let ri = 0;
     js/engine.js:21145    return Object.assign({}, p, { deck: p.deck.map((c) => (c === 'stash' ? 'stash' : rest[ri++])) });
     js/engine.js:21146  }
     js/engine.js:21158  deck: p.deck.map((c) => (c === 'stash' ? 'stash' : 'back')),   // ← 相手席
     ```
     **自席の山札は「中身は見せるが順序を消す」ためソートして配信している**（§0-24 の監査②で入れた透視対策）。
     ここを直さないと **自分の Shadow が山札のどこにあるか自分にも見えない**＝
     公式が明示的に与えている情報（`You can look through your deck at the card backs at any time,
     and see where your Shadow cards are`）が消え、**Shadow を山札から使う機構そのものが成立しない**。
     → **自席＝Shadow の位置を保存して残りをソート**（`filter` と三項の両方に Shadow を足す）／
       **相手席＝Shadow と `stash` 以外を `'back'`**。`hand` / `setAside`（`:21159` `:21161`）も同じ扱い。
  2. **相手にどこまで見せるか＝「そのカードの id をそのまま晒す」で正しい**（へそくりと同じ）。
     **根拠＝Shadow のカード裏面は5枚それぞれ違う絵**（`rulebook` 逐語 `These cards all have unique backs.` ＋
     英語wiki が `AlleyBack.jpg` / `NinjaBack.jpg` と**カードごとに別の裏面画像**を持つ。
     `_alley.jpg`（街並み）と `_ninja.jpg`（屋根の忍者）を**実見して別絵であることを確認した**。
     どちらの裏面にも `When shuffling this, put it on the bottom of your deck.` のリマインダが刷ってある）。
     ＝**裏面を見れば「どの Shadow か」まで分かる**ので、`'shadow'` のような総称マーカーに丸めず
     `stash` と同じく id を晒すのが物理挙動に忠実。
     ⚠ ただし**「相手の山札の裏面を見てよいか」の逐語は無い**（ルールブックは `your deck` としか書いていない）
     ＝⚠未確定（章末）。物理では場に伏せてあるので見えるはず、という推論。
  3. **シャッフル時に一番下へ**＝共通入口 **`reshuffleDeck(p, state)`（`js/engine.js:1183`）** に足す
     （37箇所から呼ばれるのでここ1箇所で足りる）。**足す位置がきわめて重要**：
     - この関数は **`shuffled`（＝今シャッフルした捨て札）だけ**を操作し、最後に
       `p.deck = p.deck.concat(shuffled); placeStash(p);`（`js/engine.js:1265-1266`）で
       **`p.deck` の末尾＝一番下**に付ける（このエンジンは `deck[0]` が一番上）。
     - **Shadow を下へ送る処理は `shuffled` に対してだけ行う**。`p.deck` 全体を走査してはいけない＝
       公式逐語 `Shadow cards will not necessarily stay on the bottom of your deck; they are just put there
       when shuffling them.`／`not put on the bottom ... at any time other than when shuffling them.`
       ＝**シャッフルされなかった残り山札の中の Shadow は動かさない**。
     - **前例がすぐ隣にある**＝略奪の「運命の(Fated)」が `js/engine.js:1255-1263` で
       `top` / `bottom` に振り分けて `shuffled.unshift(...top)` / `shuffled.push(...bottom)` している。
       **Shadow は `bottom` と同じスロットに `push` すればよい**（ルールブックが
       `They can also be mixed with any other cards you specifically put on the bottom, such as Fated cards
       from Plunder.` と Fated を名指しで許可している＝順序は任意）。
     ⚠ **獲得したときは下に置かない**（`Shadow cards are not put on the bottom when gained`）＝
     `gain()` には**絶対にフックを足さない**。
  4. **へそくり(Stash) との同居を決めておく**（mix-all 限定）。`placeStash(p)`（`js/engine.js:1141`）は
     `reshuffleDeck` の**最後**（`:1266`）に走り、常設方針 `p.stashPlacement`（`'top'`既定/`'mix'`/`'bottom'`）で
     `p.deck` に入れ直す。**`'bottom'` を選んでいると、へそくりが Shadow より下に入る**。
     公式は「へそくりは山札の好きな位置に入れてよい」＝本来はプレイヤーが上下を選べるので、
     **自動で決める（既存の `stashPlacement` の許容簡略化にそのまま乗せる）**のが素直。
     ＝§0-7 の「へそくりはシャッフル中に対話を挟めないので常設方針で自動配置」の延長として PROGRESS に明記すること。
  5. **`PLAY_ACTION` は手札必須**＝`js/engine.js:12220` の `if (me.hand.indexOf(card) < 0) return state;`
     を通れない（`case 'PLAY_ACTION'` は `:12205`）。
     **`action.from = 'deck'` のような source を足し、engine拒否・CPU候補・UIフィルタの3面を同時に開く**
     （片側だけだと本番 livelock＝§0-23／§0-29 A4 の教訓）。**場(`me.inPlay`)には普通に載る**ので
     片付け・`removeOne(p.inPlay, ...)`・「場にある間」系はそのまま働く。
  6. **【最重要・人間が詰む】UI に「山札の Shadow を出す」導線が現状ゼロ。**
     `js/ui.js:1660 handGroups(hand, kingdom)` は **`hand` しか受け取らない**＝
     山札のカードは**どのグループにも入らず1枚も描画されない**。
     これは **PROGRESS §0-28 N0b の実バグとまったく同じクラス**：
     > **[実バグ] 純粋な夜行カードは手札のどの群にも入らず1枚も描画されなかった**（`handGroups` が
     > アクション/財宝/勝利点しか見ていない＝人間が操作不能）→ **「夜行」群を新設**。

     → **新しい表示群（例＝「山札の影カード」）を `handGroups` に足す**（`nights:` 群の隣。
       `js/ui.js:1676-1678` のコメントがまさにこの再発防止のために書かれている）＋
       **`handCardPlayable(state, id, interactive)`（`js/ui.js:1690`）相当の述語**を Shadow 用に用意する。
     ⚠ **CPU だけがソークで通れて人間が詰む**典型（§0-29 A4 [high] の追いはぎ／§0-30 の盾と同じ構図）＝
       **CPUソークを何戦回しても検出できない**。UIテスト（`test/*-ui.test.js`）で明示的に守ること。
  7. **玉座の間/王の宮廷/行進/長老/専門家など「手札からカードを使用させる」効果の対象になる**
     （ルールブックが Throne Room を名指し）＝それらのモーダルの候補に**山札の Shadow を混ぜる**必要がある。
     ⚠ **`canPlayHandCard`（`js/engine.js:8297`）／`canPlayFromHand`（航海の3枚制限・`js/engine.js:8286`）／
     `warlordBlocks`（将軍・`js/engine.js:8541`）が「山札からの使用」をどう数えるかは
     公式の逐語が無い＝⚠未確定**（いずれも mix-all 限定。実装時に方針を決めて明記すること）。
  8. **「手札にある」ことにはならない**＝捨てる・廃棄する・手札枚数に数える の対象にしてはいけない
     （ルールブックが Alley の捨て札を名指しで否定）。**忍者(Ninja)の "discard down to 3 in hand" にも数えない。**
  9. **資本主義(Capitalism・ルネサンスのプロジェクト)を買っていると、財宝を出せるタイミングでも山札から出せる**
     ＝`isTreasureFor`（`js/engine.js:529`。§0-22 で69箇所を集約済み）の経路にも Shadow の入口が要る（mix-all 限定）。

---

### Snake Witch ／ 濡女  （$2・Action - Attack ／ アクション-アタック）

- **英語カード文（逐語）**：

```
+1 Card
+1 Action

If your hand has no duplicate cards, you may reveal it and return this to its pile, to have each other player gain a Curse.
```

- **日本語カード文（DO訳）**：

```
+1 カードを引く
+1 アクション

手札のカードがすべて異なる場合、手札を公開しこれをこのカードの山に戻してもよい。そうした場合、他のプレイヤーは全員、呪い1枚を獲得する。
```

- **区切り線**：**無し**（`<hr>` = 0。`+1 Action` と本文の間は段落の切れ目だけ）
- **版**：`First edition` / `August 2024` の1行のみ＝**機能エラッタ無し**。
- **公式FAQ・裁定**（wiki `Official FAQ` **全5項目**。**`Other rules clarifications` 節は存在しない**。
  ルールブック p.6 の `Snake Witch:` 項も一字一句同一）：
  > Revealing your hand, if all of the cards in it have different names, is optional.
  > If you do, you return Snake Witch to its pile, and if you did, each other player gains a Curse.
  > If you can't return Snake Witch to its pile for some reason, the other players do not gain a Curse.
  > Note that you reveal your hand after getting the +1 Card from Snake Witch.
  > If you have no cards in hand, you have no duplicates.

  **Secret history**：`What about a cantrip Witch for $2?`
- **⚠ 実装で危ないところ**
  1. **判定は「名前(id)の重複がゼロか」**。**+1カードを引いた *後* の手札で判定する**（FAQ 明記）。
     ドロー前で判定すると壊れる。
  2. **手札0枚は「重複なし」＝条件を満たす**（FAQ 明記）。
     ＝**「候補ゼロなら窓を開かない」という本アプリの定石をここに適用してはいけない**（0枚でも窓が要る）。
  3. **窓は任意（`you may`）＝新 pending の4点セット＋「しない（辞退）」ボタンが必須。**
     - **engine reducer**（`SNAKE_WITCH_RESOLVE` 等）
     - **`PLAYER_ACTIONS`**（`js/engine.js:21309` 付近の Set。整合性テスト `test/integrity.test.js` が検査）
     - **CPU `decidePending`**（`js/cpu.js`。**`null` を返さない**＝オンラインで `reduce(state, null)` が
       TypeError になり部屋が固まる＝§0-26 の教訓）
     - **UI `viewPendingModal`**（`js/ui.js`）
     ⚠ **手札0枚でも窓が開く**（上の 2）＝**「候補ゼロなら開かない」で逃げられない**ので、
       **辞退ボタンが無いと確実に人間が詰む**（§0-30 の [high] 拡大(Enlarge)＝手札0枚で窓が閉じない、と同じ形）。
  4. **「山に戻す(return to its pile)」は 廃棄でも獲得でもない第3の移動**＝
     **`returnToPile(state, cardId)`（`js/engine.js:2106`）／ゲートは `canReturnToPile`（`js/engine.js:2128`）**
     を通す（§0-29 A4 の交換(Exchange)・取り替え子と同じ入口）。**`supply[id] += 1` される**＝
     **3山終了が巻き戻る**／**略奪の 調査(Search) が再武装しうる**。
     後者は推測ではなく**コードのコメントが同じ事象を明記している**＝`js/engine.js:2185`
     > 無謀な(Reckless)や交換(Swap)が山へ戻すと山が復活する＝また空になれば**もう一度誘発する**（公式）。

     `pileEmptied`（`:2186`）は `gain()`（`:2020`）から呼ばれるので、**0→1 に戻した山が再び空になると
     `fireNextTime(state,'pile_empty')` がもう一度走る**。`emptyPileCount`（`:7742`）と
     CPU の終局読み `buyEndsGame`（`js/cpu.js:783`）/ `winsIfEnds`（`:807`）が揺れることも意識すること。
  5. **戻せなければ呪いは1枚も配られない**（FAQ 明記）。「some reason」の実例は2つ：
     - **命令(Command)経由＝大君主/はみだし者/船長/王子**＝サプライに残したまま使う＝**場に無いので戻せない**。
       §0-17 の **`takeSelf(state, pi, cardId)`（`js/engine.js:4606`）／
       `playedByCommand`（`js/engine.js:4582`）／`playAsCommand`（`js/engine.js:4611`）** をそのまま使い、
       **`removeOne(p.inPlay, ...)` の成否を必ず見る**
       （見ないと**幻のカードが山に湧いて保存則違反**＝§0-7 の王子×島で実際に踏んだ形）。
     - **闇市場デッキ由来で山が無い**場合＝**既存コードが既に正しい**。
       `canReturnToPile`（`:2128`）は `Object.prototype.hasOwnProperty.call(state.supply, cardId)` を返し、
       `returnToPile`（`:2106`）も `supply` にキーが無ければ `false` を返して**新しい山を生やさない**
       ＝公式どおり呪いが出ない。**新しい山キーを作る実装に書き換えないこと。**
     ※ **検証doc [low] 4 のとおり、収集docが挙げていた「Riverboat の脇からの使用」は原理的に起こらない**
       （Riverboat は**ちょうど $5** の札しか脇に置けない／Snake Witch は $2）。
  6. **公開(reveal)は任意**＝**`reveal(state, seat, cards, note, opts)`（`js/engine.js:1814`）を通す**
     （§0-22 でパトロン(Patron)が誘発する共通フックに集約済み）。
  7. **アタックなので `ATTACKS` 登録表（`js/engine.js:2805`）への登録が必須**（第1稿に無かった＝批評 [must] 4）。
     `test/integrity.test.js:51-67` が**「`stage:'react'` を作るアタックは全て `ATTACKS` に載っている」**を
     恒久検査しており、`MOAT_REVEAL` は `ATTACKS[pd.type].onMoat` を引く（同 `:66` が固定）。
     **登録を忘れると堀を公開しても窓が閉じない／テストが赤。**
     コピー元＝`js/engine.js:2808`
     ```js
     witch: { onMoat: (s, pd) => witchEnterVictim(s, pd.source, pd.queue) },
     ```
     ＝`snakeWitchEnterVictim(state, source, queue)` を作って同じ形で登録する。
     免疫は `attackImmune`（`:9821`）／リアクション所持は `hasReaction`（`:2788`）。
     ⚠ **全員が免疫のときに山への返却が起きるかは公式の逐語が無い＝⚠未確定**（章末）。
  8. **一発屋(one-shot)**＝使うと自分のデッキから消えてサプライが1枚増える。
     CPU の `GAIN_ORDER` / 強度評価がこの非対称性を前提にしていないと変な買い方をする。

---

### Aristocrat ／ 公家  （$3・Action ／ アクション）

- **英語カード文（逐語）**：

```
If the number of Aristocrats you have in play is:
  1 or 5: +3 Actions;
  2 or 6: +3 Cards;
  3 or 7: +$3;
  4 or 8: +3 Buys.
```

  （字下げは Versions 表側に `&#8195;&#8194;`＝em space + en space で実在。infobox 側には無い）
- **日本語カード文（DO訳）**：

```
場に出している公家の枚数が
　1枚か5枚の場合、+3 アクション
　2枚か6枚の場合、+3 カードを引く
　3枚か7枚の場合、+3 コイン
　4枚か8枚の場合、+3 購入
```

  ⚠ 日本語wiki のヘッダ表からの機械抽出のため、**「：」「；」などの区切り記号は落ちている可能性がある**
  （英語は `is:` と `;` で区切る）。カタログに焼くときは既存カタログの言い回しに正規化すること。
- **区切り線**：**無し**（`<hr>` = 0）
- **版**：`First edition` / `August 2024` の1行のみ＝**機能エラッタ無し**。
  Secret history の `Dropped from $4 to $3.` は**開発中の話**＝エラッタと取り違えないこと。
- **種別**：**`Action` のみ。Shadow ではない**（wiki Info・カテゴリともに Shadow 無し。ライブで再確認済み）。
  ⚠ ルールブックPDFのレイアウトが崩れており、Aristocrat の解説の隣に Alley の
  `You can play this from your deck as if in your hand. / Action - Shadow` が写り込んでいる＝**誤読注意**。
- **公式FAQ・裁定**（`Official FAQ` **2項目** ＋ `Other rules clarifications` **1項目**＝計3。ライブ確認済み）：
  > What matters is how many Aristocrats you have in play, not how many you played that turn. For example if you play Daimyo and then Aristocrat, you'll get +3 Actions for each play.
  > If you have zero or 9 or 10 Aristocrats in play, it doesn't do anything.

  **Other rules clarifications**：
  > Command variants leave the card where it is, so an Aristocrat played that way will not be considered in play. If that's the first time Aristocrat has been played, there will be zero in play, so it won't do anything.
- **⚠ 実装で危ないところ**
  1. **「場にある Aristocrat の枚数」であって「このターン使用した回数」ではない**（FAQ 明記）。
     ＝§0-29 A4 の「駐屯地のトークン」「共謀者の数え」と同じクラスの取り違えポイント。
  2. **再演系は「場に出す側」と「場に出さない側」で結果が正反対**（検証doc [medium] 2＝**収集docの ⚠1 は誤り**）：
     - **玉座の間/王の宮廷/行進**＝手札から**場へ出してから**2回使う → 2回とも「場に1枚」＝**両方 +3アクション**。
     - **大名(Daimyo)**＝**場に出ている Aristocrat をもう一度使う** → 同じく**両方 +3アクション**（FAQ の例そのもの）。
     - **命令(Command)＝大君主/はみだし者/船長/王子**＝**サプライ／脇に残したまま使う＝場に0枚**
       → **1回目は何も起きない**。**収集docの ⚠1 が大君主をここに混ぜていたのは公式と逆**。
     ＝**`playAsCommand`（`js/engine.js:4611`）が立てる `state._cmd` が生きている間は「場のカウント0」で解決する**
       のが正（§0-17 の「命令がプレイした札は動かない」の直接の帰結）。
  3. **数え方は `me.inPlay` の枚数**だが、**チャンピオンの数え方（`PLAY_ACTION` 内＝
     `me.inPlay.filter(...) + (me.durationCards||[]).filter(...)`）と同じ形にしておくのが安全**
     （持続として場に残る経路が将来増えても壊れない）。**自分自身も含めて数える**（1枚目で「1枚」）。
  4. **0枚・9枚・10枚は何も起きない**（FAQ 明記）＝`n>=1 && n<=8` のときだけ `n % 4` で分岐
     （1→+3アクション／2→+3カード／3→+$3／0(=4,8)→+3購入）。
     **11枚以上になっても何も起きない側に倒す**のが安全。
  5. **4つのボーナスは入口が全部違う**（第2稿で `addBuys` の不在を実測確認）：
     | 効果 | 書き方 | 理由 |
     |---|---|---|
     | +3 アクション | **`addActions(t, 3)`**（`js/engine.js:1845`） | §0-25 雪深い村（このターン以降の +アクションを全部無視） |
     | +3 カード | **`draw(state, pi, 3)`**（`js/engine.js:1866`） | -1カードトークン／シャッフル介入（メイソン団・星図・運命の）が効く |
     | +$3 | **`addCoins(state, 3)`**（`js/engine.js:1854`） | §0-25 カメレオンの習性（+カード ↔ +コイン の入れ替え） |
     | +3 購入 | **`t.buys += 3`** | **`addBuys` は存在しない**（grep 済み）＝既存流儀は直接加算（例 `js/engine.js:744` `762` `778`） |
  6. ⚠ **Riverboat の脇から使った Aristocrat を数えるかは公式の逐語が無い＝⚠未確定**
     （Riverboat は「脇に置いたまま使う」＝場に出ないので **0枚扱いが自然**だが、Riverboat は Command ではないため
     上の Other rules clarifications の文言は直接は当たらない）。**Riverboat の候補はちょうど $5 なので
     Aristocrat($3) は選べない**＝**実際には到達しない**（実害はゼロ）。

---

### Craftsman ／ 名匠  （$3・Action ／ アクション）

- **英語カード文（逐語）**：

```
+2D

Gain a card costing up to $5.
```

  （`2D`＝負債トークン2個の記号。生HTML＝`+[2D]` の後に `<p>`）
- **日本語カード文（DO訳）**：

```
+負債2

コスト5以下のカード1枚を獲得する。
```

  ※ 日本語wiki の表記は「`+` ＋ 負債記号 `<2>`」。**既存カタログは 元手(capital) を「負債6を得て」と書いている**
  （`js/cards.js:708`）ので、**表記は実装時に統一を決めること**（例＝`+負債2`）。
- **区切り線**：**無し**（`<hr>` = 0）
- **版**：`First edition` / `August 2024` の1行のみ＝**機能エラッタ無し**。
  Secret history の `Initially cost $4; one day Matt said, can't it cost $3?` は**開発中の話**＝エラッタではない。
- **公式FAQ・裁定**（`Official FAQ` **1項目のみ**。**`Other rules clarifications` 節は存在しない**）：
  > You gain a card even if you already had D; see the Debt section.

  **ルールブック p.3 Debt 節（逐語・記号は PyMuPDF レンダリングで目視確認済み）**：
  > - Having Debt tokens prevents a player from buying cards or Events or Projects (from Renaissance); Debt tokens do nothing else (for example they have no effect at the end of the game).
  > - Buying a card or Event with [D] in its cost gives the player that many Debt tokens.
  > - **An ability with +[D] causes you to take that many Debt tokens. For example +[2D] means you take 2 Debt tokens.**
  > - A player can remove Debt tokens at any point in their turn by paying [$1] per Debt token to remove it. This does not use up a Buy or an Action, and can be done multiple times in a turn. **This does not let players play Treasures at any time.**
  > - [D] amounts are not [$] amounts. Math involving [$] amounts does not affect [D] amounts.
  > - Some cards look for a cost in a range. **"Up to [$4]" means "[$0], [$1], [$2], [$3], or [$4]"**; it does not include costs with [D] in them.
  > - Players cannot take [D] for no reason.
  > - Players cannot overpay with [D] (for Guilds cards).
  > - [D] is not counter-limited; players should use a replacement if they run out.

  **ルールブック p.3 の例（Craftsman を名指し・逐語）**：
  > Craftsman can't gain a Mountain Shrine, because [5D] is not "up to [$5]." Poet cannot draw a Mountain Shrine, because [5D] is not "up to [$3]." Change can't gain a Mountain Shrine, no matter what you trash, because Mountain Shrine doesn't cost any [$].

  **ルールブック p.5 Daimyo 項（Craftsman を名指し・逐語）**：
  > Daimyo: This isn't optional; whatever that next non-Command Action card is, Daimyo replays it. It replays it even if the card trashed itself. Command cards, such as Daimyo itself, are not replayed; Daimyo waits for a non-Command Action card (or fails to do anything more if the turn ends before you play one). **If you play two Daimyos and then e.g. a Craftsman, you'll play the Craftsman three times total - once normally and once for each Daimyo.**

  **英語wiki `Debt` の Official rules（支配＝この章で `addDebt` を書くときに必ず要る）**：
  > Possession (from Dominion: Alchemy) now has errata that causes it to also give the Possessing player **all** Debt tokens the Possessed player would get.
- **⚠ 実装で危ないところ**
  1. **`+2D` は「効果で負債を得る」新しい入口**＝**`takeDebt`（`js/engine.js:1908`）を流用してはいけない**
     （あれは**カードの負債"コスト"を読む**関数で、Craftsman は `debt` フィールドを持たないので 0 で素通りする）。
     **`addDebt(state, pi, n)` を新設**（`addActions` / `addCoins` と同じ「唯一の入口」思想）。
     **支配(Possession)の振り分け**＝`js/engine.js:1912` の
     `(t.possessedBy != null && pIndex === t.active) ? t.possessedBy : pIndex` を必ず引き継ぐこと
     （**公式逐語は「支配された側が得る負債は *すべて* 支配者が得る」**＝上の `Debt` ページ）。
  2. **`+2D` は強制**（`"you may"` が無い／`Players cannot take D for no reason.`）＝**選択の窓を開かない**。
  3. **獲得は強制＝新 pending の4点セット＋終端保証が要る**（批評 [must] 7）：
     - **engine reducer**＝**候補ゼロ（$5以下のサプライ山が全部空）なら窓を開かず/開いたら即閉じる**
       （§0-29 A5 の [high] リッチ＝候補ゼロで窓が閉じず**人間が詰む／CPU が livelock**、と同型）。
     - **`PLAYER_ACTIONS` に登録**（整合性テストが検査）。
     - **CPU `decidePending`**＝**候補があれば必ず非 null を返す**（`card:null` を返し続けると engine が拒否して
       状態不変 → 無限ループ＝§0-4／§0-26 の教訓）。
     - **UI `viewPendingModal`**＝候補がある間は強制のまま、**候補ゼロのときだけ閉じる導線**を出す
       （§0-29 A5 の「獲得できるカードがない（閉じる）」と同じ扱い）。
  4. **必ず `costUpTo(state, id, 5)`（`js/engine.js:4467`＝コイン/ポーション/負債の3成分）を通す**。
     素の `cardCost(state,id) <= 5` を書くと **Mountain Shrine(5D)・Daimyo(6D)** を取れてしまう（§0-23 の必読事項）。
     ※ `costUpTo` は `gainableBase`（`:4463`）を通るので**非サプライ・ロック中の分割山下段・在庫切れも自動で弾く**
       ＝ここでは**それが正しい**（獲得先はサプライだから）。
       ⚠ **逆に Riverboat では同じ性質が致命傷になる**（下の Riverboat ⚠2）。
  5. **順序＝`+2D` が先、獲得が後**（カード文の順）。**負債は獲得の可否に影響しない**（FAQ 明記）。
  6. **アクションフェイズに負債を負う**＝そのターンは `p.debt > 0` で購入が全部止まる
     （`js/engine.js:12349` の `if ((me.debt || 0) > 0) return state;`）。
     **返済は既に「ターン中いつでも」に直っている**（章の前提★1。`case 'REPAY_DEBT'`＝`js/engine.js:17379`）＝
     **収集docの「要判断」は解決済み**。ただし公式どおり**財宝は購入フェイズでしか出せない**ので、
     アクションフェイズに返せるのは**すでに得ているコイン**（+$ を出すアクション・財源など）だけ。
     ＝**`PLAY_TREASURE` をアクションフェイズに開いてはいけない**（検証doc [medium] 1 が拾った一文）。
  7. **Daimyo で3回使うと `+2D` も3回（負債6）・獲得も3回**（ルールブックが Craftsman を名指し）。
     **再演のたびに「+D」と「獲得」の両方が走る**ことを保証すること（片方だけ落ちる書き方をしない）。
  8. **獲得で負債を負うのは購入だけ**（コミット `7cc4534` ②）＝
     Craftsman で負債コストの札を獲得しても負債は付かない…が、そもそも `costUpTo` が弾くので到達しない。
     関連する公式例は **Tanuki（$5・trash して +$2 まで獲得）が Artist(8D) を廃棄して Daimyo(6D) を獲得できる**
     の方（別群の担当）。

---

### Riverboat ／ 川船  （$3・Action - Duration ／ アクション-持続）

- **英語カード文（逐語）**：

```
At the start of your next turn, play the set aside card, leaving it there.
————
Setup: Set aside an unused non-Duration Action card costing $5.
```

- **日本語カード文（DO訳）**：

```
あなたの次のターンの開始時に、脇に準備したカードを動かさずに使用する。
————
準備：このゲームで使わない、持続ではなくアクションであるコスト5の王国カード1枚を脇に置く。
```

  ⚠ **ホビージャパン版（日本語印刷版）はテキストが異なる**（日本語wiki の「余談」が明示）。
  本プロジェクトの方針（§4 決定3＝**Dominion Online 訳で統一**）どおり上記を採用する。
  ⚠ **DO訳は「王国カード」と限定している**（英語原文は `an unused non-Duration Action card costing $5`）。
  結果は公式裁定（非サプライは選べない）と一致するので実害は無いが、**英語原文には無い語**である点は意識すること。
- **区切り線**：**1本**（本文と `Setup:` 行の間）。
  ※ 生HTML の `<hr>` 総数は 4 だが、**カード文の中は 1本**。
- **版**：`First edition` / `August 2024` の1行のみ＝**機能エラッタ無し**。
- **種別**：`Action - Duration`。**Command ではない**（wiki が明示）。
- **公式FAQ・裁定**（`Official FAQ` **5項目** ＋ `Other rules clarifications` **5項目**。ライブ確認済み）：
  > In setup, choose a non-Duration Action card costing exactly $5 that isn't being used this game, and set a copy of it aside.
  > You can use the randomizers to find such a card.
  > If that card also requires setup, do that setup too.
  > When you play Riverboat, it plays the set aside card at the start of your next turn. This doesn't move the set aside card; it stays set aside, even if it has instructions on it that would move it.
  > Riverboat is normally discarded in your next turn's Clean-up, but it stays in play as long as the card it plays would have, which sometimes is longer (such as a Crown, from Empires, used on a Duration card).

  **Other rules clarifications**：
  > This can't choose non-Supply cards that cost $5 (like Disciple).
  > This can choose $5's in a split pile (like Bustling Village).
  > If you get the Knights randomizer, you randomly pick one of the 9 Knights that cost $5.
  > The chosen card does not have a pile, which means that if it's Wild Hunt, it can't gather VP.
  > Unlike Band of Misfits, Riverboat is not a Command card.

  **ルールブック p.2「準備」節（独立に同内容が書かれている）**：
  > In games using Riverboat, choose a non-Duration Action card costing exactly [$5] that is not being used, and set a copy of it aside.

  **Preview（Donald X.・逐語。第1稿から落ちていた）**：
  > Riverboat does something good, next turn. I could have made all of those cards individually, and instead here's Riverboat.

  **Secret history**：
  > Then Billy suggested that it didn't have to be a Command card, and well, it did seem like it didn't have to be, so it isn't. The loops aren't a problem when you have to wait a turn for each iteration.

  ＝**Command にしなかった理由が「1ターン待つのでループにならないから」**＝
  **「命令は命令をプレイできない」ガードを Riverboat に適用してはいけない**（適用すると公式より弱くなる）。
  逆に **Daimyo（Action - Command）は「次に使う非Command のアクション」を再演する**ので、
  **Riverboat は Daimyo の再演対象になる**。
- **⚠ 実装で危ないところ**
  1. **`state.riverboatCard` を新設し、`supply` には絶対に載せない。**
     **前例＝`state.mouseCard`（ハツカネズミの習性）が構造まで完全に同型**（章の前提★3の表）。
     第1稿が挙げた若き魔女の災いカード(Bane)は**構造が違う**＝Bane は**サプライの11山目になる**のに対し、
     Riverboat の選択札は**「山を持たない脇の1枚」**（`The chosen card does not have a pile`）。
     ゲーム中不変・**公開情報**（全員が見る）＝トップレベルのスカラーなので `maskStateFor` の
     `Object.assign` でそのまま残る（`mouseCard` と同じく伏せる処理は不要）。
  2. **【最重要】候補述語に `costExact` を使ってはいけない＝必ず false を返す。**
     第1稿は `costExact(state, id, 5, 0, 0)` を指定していたが**誤り**（批評 [must] 2 が正しい）。実コード：
     ```js
     js/engine.js:4463  function gainableBase(state, id) {
                          return !!C()[id] && !NON_SUPPLY.has(id) && !splitLocked(state, id) && (state.supply[id] || 0) > 0; }
     js/engine.js:4477  function costExact(state, id, coin, pot, debt) {
                          const c = costOf(state, id);
                          return gainableBase(state, id) && c.coin === coin && ... }
     ```
     ＝**`costExact` は `(state.supply[id]||0) > 0` を要求する**。Riverboat が選ぶのは定義上
     **「このゲームで使われていない＝サプライに山が無い」札**なので、**候補が常にゼロになる**。
     これは §0-28 の「悪魔祓いの精霊で本番 livelock」（**非サプライ札に `costUpTo`/`costUnder` を使った**）と
     **まったく同じ罠の裏返し**。
     → **正しい形＝静的コストで判定する専用述語を新設する。**
       コピー元は **`pickMouseCard`（`js/engine.js:260-278`）**＝まさに同型の「王国外から1枚選ぶ」述語：
       ```js
       js/engine.js:260  function pickMouseCard(kingdom) {
                           const inK = new Set(kingdom);
                           const eligible = (id) => {
                             const c = C()[id];
                             if (!c || inK.has(id) || NON_SUPPLY.has(id)) return false;
                             if (c.potion || c.debt) return false;              // 成分一致＝ちょうど$2/$3 のみ
                             if (!(c.cost === 2 || c.cost === 3)) return false; // ★静的コスト
                             if (!c.types.includes('action')) return false;
                             if (c.types.includes('duration')) return false;
                             if (c.types.includes('command')) return false;     // ← Riverboat はコピーしない（下の 3）
                             if (SPLIT_TOP[id] || DOM.POOLS.castles.indexOf(id) >= 0
                                 || (DOM.POOLS.knights || []).indexOf(id) >= 0) return false; // ← ★コピーしてはいけない
                             return true; };
       ```
       Riverboat 版＝`c.cost === 5 && !c.potion && !c.debt && types.includes('action') &&
       !types.includes('duration') && !NON_SUPPLY.has(id) && !inK.has(id)`（＋災いカード等の使用中判定）。
     ⚠ **`splitLocked`（`js/engine.js:39`）も候補判定に使ってはいけない**＝
        Riverboat の脇札は山を持たないので山のロック状態は無関係。
     ⚠ **`MIXED_PILE_CONTENTS`（`js/engine.js:65-67`）で弾いてもいけない**＝
        中身は **騎士10／廃墟5／城8／同盟の分割山24 だけ**なので、これで弾くと落ちるのは
        **同盟の分割山にある $5（女魔導士/将軍/魔術師 など）**であって Bustling Village ではない
        （帝国/プロモの2段分割山は `DOM.SPLIT_PILES`＝`js/cards.js:1746` ＋ `splitLocked` が別に管理）。
  3. **`pickMouseCard` の最後の2行は Riverboat では公式と正反対**（第2稿で発見した最大の落とし穴）：
     - **分割山**＝`pickMouseCard` は `SPLIT_TOP[id]`（＝2段分割山の**下段**）を除外するが、
       **Riverboat の FAQ は Bustling Village（＝`settlers` の下段・$5）を名指しで許可している**。
       `SPLIT_TOP` は下段id→上段id の写像（正本＝`js/cards.js:1746` `DOM.SPLIT_PILES`）なので、
       **この除外をコピーすると FAQ が名指しした唯一の例が落ちる**。
     - **騎士**＝`pickMouseCard` は `DOM.POOLS.knights` を丸ごと除外するが、
       **Riverboat の FAQ は「騎士のランダマイザーを引いたら $5 の騎士9種から無作為に1枚」と明示**している。
       実データで検算済み＝**騎士10種のうち `sir_martin` だけ $4、残り9種が $5**（FAQ の「9」と完全一致）。
     - ※ `pickMouseCard` の除外自体は Way of the Mouse では**実害ゼロ**（$2/$3 に該当する分割山下段も騎士も
       存在しないため事実上デッドコード）＝**Way of the Mouse 側のバグではない**。
       **Riverboat がそのままコピーすると初めて壊れる**、という関係。
  4. **その札にも Setup があるなら実行する**（例＝パン屋 Baker＝全員が開始時に財源1）。
     本アプリの `createInitialState` は「王国にあるか」でセットアップを分岐しているので、
     **`state.riverboatCard` もセットアップ判定の走査対象に含める**こと。
     **既にそうしている前例が1行ある**＝`js/engine.js:1606`
     ```js
     if ((DOM.HORSE_GIVERS || []).some((id) => kingdom.includes(id) || events.includes(id) || id === mouseCard)) supply.horse = 30;
     ```
     同種の走査＝`DOM.HEIRLOOM_OF`（`:1412`）／`DOM.LOOT_GIVERS`（`:1669`）／`DOM.HORSE_GIVERS`（`:1606`）／
     `DOM.artifactsForKingdom`（`:1645`）／`DOM.ALLIES_LIAISONS`（`:173`）＝**走査漏れが起きやすい5系統**。
  5. **【保存則】`state.riverboatCard` は「カードとして数えない」**（批評 [must] 6。取り違えると即赤）：
     - 公式は `set a **copy** of it aside`＝**サプライから抜いた札ではなく余分な1枚**で、**誰も所有していない**。
     - → **`allCards`（`js/engine.js:7768-7786`）に入れない**（入れると庭園/品評会/絹の道/VPが水増しされる）。
     - → **`test/invariants.test.js:22-34` の `ZONES` に足さない**（足すと保存則が +1 でずれる）。
       tally（`:39-55`）は `supply` ＋ 混合山 ＋ `trash` ＋ `blackMarket` ＋ `loot` ＋ プレイヤーの ZONES を数える
       ので、**どこにも載せなければ init と現在で常に 0 対 0 ＝整合する**。
     - **`state.mouseCard` が既にこの扱い**＝迷ったらそちらを見ること。
     - ⚠ **相続 `inherited`（＝サプライから抜くので数える）や操舵手の脇（＝所有カード）とは扱いが逆**。
     - ⚠ **同じ id が闇市場デッキに入り得る**（`blackMarket` の母集団は全 POOLS＝`js/engine.js:1592`）。
       そちらは普通に数える（脇の1枚だけを数えない）。
       ※ **「闇市場デッキに入っている札は "unused" か」は公式の逐語が無い＝⚠未確定**（章末）。
  6. **「動かさずに使用する」**（`leaving it there` / `This doesn't move the set aside card`）＝
     **§0-17 の命令(Command)の挙動とまったく同じ**＝**`playAsCommand(state, pi, commandId, card)`
     （`js/engine.js:4611`）の経路をそのまま使う**（`state.mouseCard` が `js/engine.js:3661` で
     まさにこれをやっている）。**`takeSelf`（`:4606`）が失敗する**＝祝宴の自己廃棄・島のマット移動・宝の地図・
     鉱山の村の自己廃棄+$2 は**不発**、残りの効果は普通に解決する。
     ⚠ **ただし種別は Command ではない**ので、「命令は命令をプレイできない」の除外リスト
     （`notePlunderPlay`＝`js/engine.js:2318` の `DOM.isType(card,'command')` 等）に
     **Riverboat を入れてはいけない**。
     ⚠ **`state._cmd` を立てると Command 専用の副作用が巻き添えで効く**点に注意
        （Aristocrat の「場のカウント0」など）。**`_cmd` を「Command 種別かどうか」の判定に使っている箇所が
        無いか grep してから決めること**。
  7. **選ばれた札に山が無い**＝**山を参照する効果が空振りする**（FAQ が 野生の狩り Wild Hunt を名指し：
     山上VPを集められない）。同型で危ないもの＝**山に戻す系**（陣地 Encampment＝`returnToPile`）・
     **山トークン系**（冒険の教師）・**混合山/分割山の一番上判定**・**`pileKeyOf`（`js/engine.js:341`）を通す READ 全部**・
     **`availableInSupply`（`:2417`）**。
     → **これらは `state.riverboatCard` を知らない**ことを前提に、**失敗しても壊れない**（例外にならない）ようにする。
  8. **持続なので「次のターン開始時」に脇の札を使う**＝`resolveDurationStartEffects`（`js/engine.js:7968`）から
     **`t.startQueue` に積む**（`popStartQueue`＝`:7963`。**`state.pending` 直代入は禁止**＝§0-29 A3）。
     使う札がアタックなら**そこでリアクション窓が開く**（ターン開始時にアタックが走る＝§0-7 の王子/船長と同型）。
  9. **Riverboat 自身の場残り**＝`it stays in play as long as the card it plays would have`。
     冠(Crown)で持続を2回使った場合など**さらに長く場に残る**＝
     §0-29 A4「専門家(Specialist)で持続を2回使うと専門家自身も場に残る」／
     §0-30 決定D4「旗艦(Flagship)は持続を再演したら場に残る」と**同じクラス**の実装
     （`armDuration`＝`js/engine.js:7957` の予約数で場残りを表す）。
  10. ⚠ **脇の札は「場に出ていない」ので `while this is in play` 系（街道のコスト軽減など）は働かない**はず＝
     **Dark Ages ルールブックの Command の一般則からの推論であって、Riverboat 固有の逐語は取れていない＝⚠未確定**。
     ただし `leaving it there` / `it stays set aside` から見て**場に入らないのはほぼ確実**。

---

### Root Cellar ／ 室  （$3・Action ／ アクション）

- **英語カード文（逐語）**：

```
+3 Cards
+1 Action
+3D
```

- **日本語カード文（DO訳）**：

```
+3 カードを引く
+1 アクション
+負債3
```

  ※ 表記の注意は Craftsman と同じ（日本語wiki は「`+` ＋ 負債記号 `<3>`」）。
- **区切り線**：**無し**（`<hr>` = 0）
- **版**：`First edition` / `August 2024` の1行のみ＝**機能エラッタ無し**。
- **公式FAQ・裁定**（`Official FAQ` **1項目のみ**。**`Other rules clarifications` 節は存在しない**。
  第2稿で `node tools/wikidirect.js "Root Cellar"` によりライブ再取得して確認）：
  > This works even if you already had D; see the Debt section.

  （Debt 節の逐語は Craftsman の項に全文を載せた。同じものが正本）

  **Preview（Donald X.・逐語。出典＝`Rising Sun Previews 4: On-play Debt`）**：
  > Root Cellar looks a lot like Warehouse. Instead of discarding 3 cards, you get 3 debt.

  **Secret history（逐語・第1稿は後半が落ちていた）**：
  > The second card in the file. Unchanged. For me the poster child for on-play debt.

  ＝**開発中も印刷後もテキストが一度も動いていない／設計者にとって on-play Debt の代表カード**。
- **⚠ 実装で危ないところ**
  1. **`+3D` は強制**（`"you may"` が無い／`Players cannot take D for no reason.`）＝**選択の窓を開かない**。
     Craftsman と同じ **`addDebt(state, pi, n)`** を通す（`takeDebt` ではない＝章の前提★1）。
  2. **順序＝ドロー → +1アクション → 負債3**（カード文の順）。負債はドローに影響しない。
  3. **`+3 Cards` は `draw(state, pi, 3)`（`js/engine.js:1866`）を通す**
     （-1カードトークン／シャッフル介入＝メイソン団・星図・運命の・**Shadow の底送り** が正しく効く）。
     **`+1 Action` は `addActions(t, 1)`（`:1845`）**。
  4. **非ターミナル（+1アクション）なので何枚でも連打でき、負債が累積する**。
     `p.debt` に上限は無い（`[D] is not counter-limited`）。
  5. **アクションフェイズに負債3を負う**＝返せなければそのターンは購入不可
     （`js/engine.js:12349` の `if ((me.debt || 0) > 0) return state;`）。
     **返済は「ターン中いつでも」に修正済み**（章の前提★1）。
  6. **CPU の非ループを必ず確認する**＝`js/cpu.js:3979-3981` が
     ```js
     if ((subj.debt || 0) > 0) {
       if ((t.coins || 0) > 0) return { type: 'REPAY_DEBT', amount: Math.min(subj.debt, t.coins) };
       return { type: 'END_TURN' };
     }
     ```
     で終端している（**engine が拒否しない手だけを返す＝非ループは担保**）。
     ただし **$3 のカードで毎ターン負債3**＝返済が追いつかないターンが普通に出るので、
     **「返済 → 何も買えない → END_TURN」を延々繰り返して手番だけ進む**形になりうる
     （`isGameOver` の150手番安全網はあるが、**CPUソークで平均総手番が跳ねないか**を必ず測ること）。
  7. **UI の返済ボタン**は既にある（`js/ui.js:1795`）が、**アクションフェイズにも出す**必要がある
     （engine は既にいつでも受理する＝§0-23 の「engine・CPU・UI の3面を揃える」）。
     現状のボタンの表示条件を実装時に確認すること。

---

## 反映した [must]／拾った [nice]

### 反映した [must]：**7件／7件**（不採用 0件）

| # | 批評の指摘 | 判定 | **自分で確かめた根拠**（第2稿で全部 grep／Read し直した） |
|---|---|---|---|
| 1 | 新種別 `shadow` の表示ラベル登録が無い（4箇所） | **採用** | `js/carddata.js:115-116` / `js/ui.js:124-129` / `test/integrity.test.js:120-121` を実読＝**`shadow` は4箇所とも不在**。落ちるテストも実読（`integrity.test.js:116-129` の `d.typeLabel.includes(JP[t])` ／ `ui.test.js:448-467` の `UI.TYPE_JP` 網羅）。→ 章の前提★2 に表で新設 |
| 2 | Riverboat の候補に `costExact` を使うと必ず false | **採用（＋前例を差し替え）** | `js/engine.js:4463/4477` を実読＝`costExact` は `gainableBase` 経由で `(state.supply[id]||0) > 0` を要求。Riverboat の候補は定義上サプライに無い＝**批評が正しい**。**さらに批評の提案（`pickBane`）より良い前例 `pickMouseCard`（`:260-278`）を発見**して差し替え、**その中の分割山/騎士の除外行だけは公式FAQと正反対なのでコピー禁止**という新しい注意（Riverboat ⚠3）を追加した |
| 3 | `maskStateFor` の自席分岐を見落とし（引用が相手席のもの） | **採用（＋根拠を強化）** | `js/engine.js:21142-21146`（自席＝`filter`+`sort`）と `:21158`（相手席）を実読＝**批評が正しい**。**加えて Shadow の裏面画像2枚（`_alley.jpg` / `_ninja.jpg`）を実見して「裏面はカードごとに別の絵」を確認**し、「相手には id をそのまま晒す（＝へそくりと同じ）でよい」という masking の設計判断まで根拠づけた |
| 4 | Snake Witch の `ATTACKS` 登録指示が無い | **採用** | `test/integrity.test.js:51-67` を実読＝`stage:'react'` を作る type が `ATTACKS` に無いと赤／`:66` が `ATTACKS[pd.type].onMoat` を固定。コピー元 `js/engine.js:2808` の `witch:` 行も実読して明記 |
| 5 | 山札の Shadow を使う UI が存在しない | **採用** | `js/ui.js:1660 handGroups(hand, kingdom)` を実読＝**引数が `hand` だけ**＝山札の札は描画されない。同関数 `:1676-1678` のコメントが「夜行で同じ事故を起こした」と自白している。`handCardPlayable`（`:1690`）も実読 |
| 6 | `state.riverboatCard` の保存則／所有カードの扱いが無い | **採用（＋前例を追加）** | `allCards`（`js/engine.js:7768-7786`）と `test/invariants.test.js:22-34`（ZONES）／`:39-55`（tally）を実読。**`state.mouseCard` が既に「supply にも allCards にも ZONES にも入れない」運用**（`js/engine.js:1705` のコメントと `test/menagerie.test.js:556-560`）＝**答えが既にコードにある**ことを示した |
| 7 | 新 pending の4点セット・辞退ボタンの明記が無い | **採用** | CLAUDE.md／PROGRESS の不変条件どおり。**Snake Witch は「任意 × 手札0枚でも窓が開く」＝辞退ボタンが無いと確実に詰む**（⚠3 に独立項目として新設）／Craftsman は「engine の終端保証／CPU が null を返さない／UI の閉じる導線」を3点に分けて記述（⚠3） |

### 拾った [nice]：**10件／10件**（＋自前の追加5件）

| # | 内容 | 反映先 |
|---|---|---|
| 1 | 行番号のずれ | **章の前提★0 を新設**。⚠ **批評の補正値（一律 +13）も既に外れていた**（`REPAY_DEBT` は批評 17357／実際 **17379**）＝HEAD が `7cc4534`→`d6cf76d` に進んだため。**第2稿は全行番号を実測し直した**うえで「孫引きせず関数名で grep せよ」を教訓として明記 |
| 2 | `frameType` は `shadow` を `action` に落とす＝枠スキン新設不要 | 章の前提★2 の末尾（`js/carddata.js:100-110` を実読して確認） |
| 3 | Versions 表の Print／Digital 列 | 章の前提（生HTMLからセルを抽出して確認＝Print にカード画像・**Digital は空セル**・Announced と Printed は colspan で1セル） |
| 4 | Fishmonger / Aristocrat の FAQ 項目数 | 両カードに「`Official FAQ` 2項目＋`Other rules clarifications` 1項目＝計3」と明記（6枚とも件数が揃った） |
| 5 | Trivia の逐語欠落3件 | Riverboat の Preview を**全文追加**／Root Cellar の Secret history を**全文に復元**（`For me the poster child for on-play debt.`）／Fishmonger の Preview を**逐語に戻した** |
| 6 | Snake Witch × 闇市場＝`canReturnToPile` が既に正しい | Snake Witch ⚠5 に「some reason」の2例目として追加（`js/engine.js:2106/2128` を実読＝`supply` にキーが無ければ false・**新しい山を生やさない**） |
| 7 | Aristocrat の `+3 Cards` / `+3 Buys` の入口 | Aristocrat ⚠5 を**4行の表に作り直した**。**`addBuys` が存在しないことを grep で確認**し、既存流儀 `t.buys += n`（`js/engine.js:744` `762` `778`）を明記 |
| 8 | Riverboat が $5 の Action-Command（はみだし者）を選べる | 実データで確認（`js/cards.js:539`＝`band_of_misfits` は cost 5 / `['action','command']` / 非持続）＝候補述語 (a)〜(e) を**全部通る**。公式の候補条件に Command 除外は無い → **⚠未確定 3 に追加** |
| 9 | Riverboat が同じ拡張の Shadow（浪人 $5／狸 $5）を選べる | `g0_jp_pairs.md` L74-80 で確認（どちらも `Action-Shadow`・非持続・$5）→ **⚠未確定 4 に追加** |
| 10 | Shadow × へそくり(Stash) の同居 | Fishmonger ⚠4 を新設。`reshuffleDeck`（`:1183`）の末尾 `p.deck = p.deck.concat(shuffled); placeStash(p);`（`:1265-1266`）を実読し、**へそくりが `'bottom'` 方針だと Shadow の下に入る**ことまで具体化 |

**自前で追加した5件**（批評にも検証docにも無い）：

1. **`state.mouseCard`（ハツカネズミの習性）が Riverboat／Shadow の最良の前例**＝章の前提★3（表6行）。
   準備・非サプライ・公開・不変・`playAsCommand`・セットアップ走査・保存則の扱いが**7項目すべて一致**。
2. **`pickMouseCard` の分割山／騎士の除外行は Riverboat では公式と正反対**＝Riverboat ⚠3。
   **騎士10種のうち $5 が9種・`sir_martin` だけ $4** を実データで検算し、FAQ の「9」と一致することを確認。
3. **Shadow の裏面はカードごとに別の絵**（画像を実見）＝マスクで id をそのまま晒してよい根拠（Fishmonger ⚠2）。
4. **`reshuffleDeck` のフックは `shuffled` にだけ当てる**（`p.deck` 全体を走査すると
   「シャッフルされなかった山札の中の Shadow」まで底に落ちて公式違反）＝Fishmonger ⚠3。
   **運命の(Fated)が同じ関数の `:1255-1263` で `bottom` を作っている**＝そこに相乗りするのが正解。
5. **章末の「出荷済みの実バグ候補」2件**（下記）。

---

## 検算

- **担当＝$2 の2枚（Fishmonger / Snake Witch）＋ $3 の4枚（Aristocrat / Craftsman / Riverboat / Root Cellar）＝6枚**
- **書いた＝6枚**（Fishmonger / Snake Witch / Aristocrat / Craftsman / Riverboat / Root Cellar）
- **6/6 一致。過不足なし・重複0・捏造0。**
  （$5D の Mountain Shrine・$6D の Daimyo・$8D の Artist は**負債コスト＝別レンジ**なのでこの章の担当外）
- 内訳：新機構に触れる枚数＝**Shadow 1枚**（Fishmonger）／**on-play Debt 2枚**（Craftsman・Root Cellar）／
  **セットアップで王国外の札を決める 1枚**（Riverboat）／**Omen(前兆) は0枚**（この章に Omen は無い）。
- **一次資料の逐語＝全部そのまま**：FAQ 23項目（Fishmonger 2+1／Aristocrat 2+1／Craftsman 1+0／
  Riverboat 5+5／Root Cellar 1+0／Snake Witch 5+0）／Versions 6行／区切り線 6枚（1/0/0/0/1/0）／
  日本語（名前・カード文・種別）6×3＝18項目。
- **反映した [must]＝7／7（不採用0）／拾った [nice]＝10／10／自前の追加＝5。**
- **第2稿で書き換えたコード参照＝27箇所**（全部 HEAD `d6cf76d` で再実測。第1稿から**誤りだったもの 4件**＝
  `costExact` の意味／`maskStateFor` の分岐／`REPAY_DEBT` ほか10000行以降の行番号／`takeSelf` 系の ±1）。

---

## ⚠ 未確定（推測で埋めていないもの）

1. **Snake Witch**：**全員がリアクションで免疫のとき、山への返却が起きるか**。
   カード文の語順（reveal → return → `to have each other player gain a Curse`）からは
   **返却は起きて呪いだけ配られない**と読めるが、**公式の逐語は無い**。
2. **Riverboat**：**脇から使った札が「場に出ていない」扱いか**（`while this is in play` 系が働かないか）。
   Command の一般則からの推論であって、**Riverboat 固有の逐語は無い**。
   これに伴い **Riverboat で使った Aristocrat を「場の Aristocrat」に数えるか**も逐語なし
   （ただし Riverboat は**ちょうど $5** しか選べないので **Aristocrat($3) では実際には到達しない**）。
3. **Riverboat が $5 の Command カード（はみだし者 Band of Misfits）を選べるか**。
   公式の候補条件は `non-Duration Action card costing $5` だけで **Command を除外していない**
   （`Unlike Band of Misfits, Riverboat is not a Command card` は Riverboat 自身の種別の話）。
   実データ上 `band_of_misfits`（cost 5 / `['action','command']` / 非持続）は候補述語を全部通る。
   **本アプリの「命令は命令をプレイできない」ガードとどう噛むか**は要判断（`pickMouseCard` は Command を
   除外しているが、それは Way of the Mouse 側の無限ループ対策）。
4. **Riverboat が同じ拡張の Shadow（浪人 $5／狸 $5）を選べる**（どちらも `Action-Shadow`・非持続・$5）。
   脇に置かれた Shadow は「山札の中」ではないので Shadow のルール（シャッフル時に底へ／山札から使える）が
   空振りするだけだが、**新機構どうしの初手の交差**なので実装時に方針を明記すること。
   ⚠ **同型で `small_castle`（帝国・$5・`['action','victory','castle']`・非持続）も候補述語を通る**
   （第2稿で実データ確認）。城は混合山でランダマイザーが勝利点なので**公式にどう扱うかは逐語なし**。
   なお Small Castle の自己廃棄は `takeSelf` が失敗して不発になる＝Wild Hunt と同じクラス。
5. **Riverboat の「unused」に闇市場デッキの札を含めるか**。
   闇市場デッキの母集団は全 POOLS（`js/engine.js:1592`）なので、王国10種に無い $5 のアクションは
   **闇市場で買える＝「使われている」とも読める**。公式の逐語なし（mix-all／promo 限定）。
6. **Shadow × 既存の「手札から使用する枚数を制限する」機構**＝
   航海(Voyage)の3枚制限（`canPlayFromHand`＝`js/engine.js:8286`）／将軍(Warlord)（`warlordBlocks`＝`:8541`）が
   **山札から使った Shadow を数える・止めるか**。公式の逐語なし（いずれも mix-all 限定）。
7. **Shadow の裏面を「相手が見てよいか」**。ルールブックは `You can look through **your** deck at the card backs
   at any time` としか書いていない。物理では山札は伏せて場にあるので見えるはず（＝へそくりと同じ扱い）だが推論。
8. **日本語表記の細部**：Aristocrat の JP は日本語wiki のヘッダ表からの機械抽出のため
   **「：」「；」等の区切り記号が落ちている可能性がある**。負債記号（`+2D` / `+3D`）の日本語表記も
   **既存カタログ（元手＝「負債6を得て」・`js/cards.js:708`）と統一する方針を実装時に決める**必要がある。
9. **Riverboat のホビージャパン版テキストは DO訳と異なる**（日本語wiki の「余談」）。
   §4 決定3（DO訳で統一）に従い DO訳を採用したが、**差異の中身自体は確認していない**。

---

## ⚠ 出荷済みの実バグ候補

### 1. 【medium・確度高】元手(Capital) の「場から捨てるとき負債6」が支配(Possession)の振り分けを通っていない

- **場所**：`js/engine.js:10470-10477`（`cleanupAndAdvance` の中）
  ```js
  js/engine.js:10470  if (!state.turn.journeyKeep) {
  js/engine.js:10471    const caps = restInPlay.filter((c) => c === 'capital').length;
  js/engine.js:10472    if (caps > 0) {
  js/engine.js:10473      p.debt = (p.debt || 0) + 6 * caps;        // ← 被支配者に直接足している
  js/engine.js:10474      const r = Math.min(p.debt, state.turn.coins || 0);
  ```
- **公式の根拠**（英語wiki `Debt` の Official rules・逐語。`_v_debt.txt` L596-599 に保存済み）：
  > Possession (from Dominion: Alchemy) now has errata that causes it to also give the Possessing player **all** Debt tokens the Possessed player would get.

  ＝**「購入で得た負債」に限らず、被支配者が得るはずの負債は *すべて* 支配者が得る**。
- **なぜバグと言えるか**＝**同じリポジトリ内の他の負債付与サイトは全部この振り分けを持っている**：
  | 場所 | 振り分け |
  |---|---|
  | `js/engine.js:1912`（`takeDebt`） | `(t.possessedBy != null && pIndex === t.active) ? t.possessedBy : pIndex` ✅ |
  | `js/engine.js:9029`（徴税 Tax） | `... || (state.turn.possessedBy != null && pIndex === state.turn.possessedBy)` ✅ |
  | `js/engine.js:12441`（`BUY_EVENT`） | `const dwho = (t.possessedBy != null && pi === t.active) ? t.possessedBy : pi;` ✅ |
  | **`js/engine.js:10473`（元手）** | **無し ❌** |
- **到達可能性**＝**あり**。`state.turn.possessedBy` は**片付けの最中も生きている**
  （同じ関数の `js/engine.js:10510-10511` が `if (state.turn.possessedBy != null) { const possIdx = state.turn.possessedBy; …`
  と、**この元手の処理より後で**参照している）。
  ＝**mix-all で 錬金術(possession) ＋ 帝国(capital) を同居させ、支配ターンに元手を使って片付けに入れば再現する。**
- **影響**：支配された側が本来負わないはずの**負債6**を負う（＝次の自分のターンに何も買えない）／
  支配者は負債を免れる。**得点には効かないが実プレイ上は重い**。
- ⚠ **CPU は支配を自動購入しない**（PROGRESS §「CPUは支配を自動購入しない（`bestPotionBuy` で除外）」）＝
  **人間だけが通る道**・mix-all 限定＝**CPUソークでは永久に検出されない**（§0-29 A5 の「闇市場×同盟」と同じ構図）。
- **修正の注意**：`js/engine.js:10474` の即返済は `state.turn.coins`（＝**手番のコイン**）から引いている。
  負債の受取人を支配者に変えるなら、**「誰の負債を、誰のコインで返すか」を同時に決める**こと
  （公式は「その場で可能な限り返す」だけで、支配時の逐語は無い＝ここは⚠未確定）。
  最小の修正は **`addDebt(state, pi, n)` を新設し（この章で必要になる）、元手もそれを通す**こと。

### 2. 【low・[推定]】峠(Mountain Pass) の落札負債も支配の振り分けを通っていない

- **場所**：`js/engine.js:12886` `w.debt = (w.debt || 0) + pd.highest;`
- 上の1と**同じクラス**（`t.possessedBy` を見ていない5サイト目）。公式の根拠は同じ `Debt` ページの逐語。
- ただし峠は**手番プレイヤー以外も入札する**うえ、勝者は `+8勝利点` も同時に得る
  （**勝利点トークンは支配の errata の対象外**＝支配者に移らない）ため、
  **「負債だけ支配者・VPは被支配者」という分割が公式に正しいかの逐語が取れていない**。
  → **[推定]**。1を直すときに一緒に検討すること。

### 3. 【nit・挙動に影響なし】`REPAY_DEBT` の1行コメントだけが旧ルールのまま

- `js/engine.js:17378` が `// 帝国：負債（Debt）を返済する。購入フェイズに $1=1個。…` のままで、
  **直下の詳細コメント（`:17381-17392`）と実装（どのフェイズでも返せる）に矛盾している**。
  コミット `7cc4534` の直し漏れ。次にこの周辺を触るとき直すこと。


<!-- ===== m3_kingdom_4.md ===== -->

## 第3章 王国 $4（6枚）

**確定版（批評反映済み・第2版）**。担当＝Alley / Change / Ninja / Poet / River Shrine / Rustic Village。

### この章の作り方（追跡可能性）
- 起草＝`g3_kingdom_4.md`（英語wiki ライブページ＋RGG 2024 ルールブック）。
- 敵対検証＝`v_k4.md`（別エージェントが一次資料を取り直し。oldid が6枚とも一致＝同じ版を見ている）。
- 完全性の批評＝`c_k4.md`（[must] 2件・[nice] 16件）。**本版はその全件を自分で `grep`／`Read` して照合した上で反映**。
- **私（統合担当）が自分で取り直した一次資料**＝
  `RAW_DIR=C:/tmp/risingsun_research/raw_m_k4 node tools/wikidirect.js "Debt" "Shadow" "Cost"`
  （テキスト＝`C:/tmp/risingsun_research/m_k4_shadow_cost.txt`、生HTML＝`raw_m_k4/`）。
- **【N1 反映】取得時の oldid（6枚とも起草・検証・確定で一致）**＝
  `Alley 96774／Change 97556／Ninja 97557／Poet 97628／River Shrine 97626／Rustic Village 97624`。
  ⚠ **版を数字で固定する理由**＝PROGRESS §0-30 に「2025年9月ごろ、英語wikiで脚注付きの裁定がまとめて削除された
  形跡がある（現場監督×増築・旗艦×はみだし者が同時に消失）」という前例がある。**現行版だけを見て起草すると
  裁定を取りこぼす**ので、後で再検証できるよう oldid を残す。
- 日本語名・日本語カード文＝`g0_jp_pairs.md`（日本語wiki の個別カードページ＝**Dominion Online 訳**）。
  ⚠ **`g0_jp_pairs.md` の抽出はカードのアイコンを文字に置換している**
  （負債アイコン→`<X>`／コインアイコン→「コインコスト」「コイン」／日の出トークン→`Sun`）。
  下では**記号の位置を復元した読み**を併記し、置換前の生の抽出値も残す。
- ⚠ **ホビージャパン版の印刷テキストが違うと分かっているカード**（川船／好機到来／米／絵師／進歩／盛大な取引）に
  **この6枚は1枚も含まれない**（本プロジェクトの方針＝略奪の決定3「Dominion Online 訳で統一」どおり）。
  **【N8 反映＝この主張の裏取りが弱いことを明記する】** `g0_jp_pairs.md` で「HJ版が違う」マーカーが
  付いているのは**川船の1枚だけ**なのに、同ファイルの見出しは「川船／好機到来 ほか」と書いている
  ＝**抽出がマーカーを取りこぼしている**。したがって「マーカーが無いから同じ」とは**言えない**。
  **closable**＝英語wiki の Other language versions の Japanese 行に、**6枚とも印刷版のスキャン画像がある**
  （`AlleyJapanese.jpg` / `ChangeJapanese.jpg` / `NinjaJapanese.jpg` / `PoetJapanese.jpg` /
  `River_ShrineJapanese.jpg` / `Rustic_VillageJapanese.jpg` ＝私も `raw_g3/raw_*.html` で6/6 実在を確認）。
  **DL して実見すれば HJ版の逐語で 6/6 を確定できる**（方針は DO訳採用のままでよいが、「違わない」ことを
  言い切りたいならこの1手が要る）。

### ⚠ 行番号の扱い（【N9 反映】）
**本版の行番号は `7cc4534`（`sw.js` v76）適用後の作業ツリーで取り直した実測値**。
初版は `triggerOnDiscard` 9620／`endBuyTailSchemeOrCleanup` 11509 のように **1〜15行ずれていた**。
⚠ **実装時は行番号を信じず、必ず関数名で `grep` すること**（関数はすべて実在するので実害は小さいが、
今後もコミットのたびにずれる）。

### この章に効く一般ルール（rulebook / 英語wiki 逐語）

**Shadow（影）**＝英語wiki `Shadow` > Official rules ＝ rulebook と逐語一致（節は Official rules のみ。
"Other rules clarifications" は**存在しない**）：

> Rising Sun has five Shadow cards. These cards all have unique backs, and can be played from your deck.
> - When shuffling Shadow cards, put them on the bottom. If you have multiple Shadow cards, they can go in any order at the bottom. They can also be mixed with any other cards you specifically put on the bottom, such as Fated cards from Plunder.
> - You may wish to turn your Shadow cards sideways at the bottom of your deck, so that it is easy to remember that they are there.
> - Shadow cards will not necessarily stay on the bottom of your deck; they are just put there when shuffling them.
> - Shadow cards are not put on the bottom when gained, or at any time other than when shuffling them.
> - You can look through your deck at the card backs at any time, and see where your Shadow cards are.
> - Whenever you can normally play an Action card, you can play a Shadow card from your deck. It can be anywhere in your deck. You play it exactly as if playing it from your hand; it goes into play and you follow its instructions.
> - When a card like Throne Room tells you to play a card from your hand, you can use that opportunity to play a Shadow card from your deck.
> - **You can play Shadow cards from your deck as if in your hand, but this does not mean the Shadow card is in your hand; for example you cannot discard it to an ability like Alley's (unless it is actually in your hand).**

**【N6 反映】Shadow の裏面テキスト（＝カード表面には無い一文。私が `_alley.jpg` / `_ninja.jpg` を
画像として実見した逐語。2枚とも完全に同一文）**：

> When shuffling this, put it on the bottom of your deck.

→ **この1文が「`DOM.CARDS` の `text` に入れてはいけない当のテキスト」**（下の Alley ⚠7）。
Ninja の Secret history `And then I moved the shuffling text to the card back` が裏付け。

Donald X. の Preview（*Rising Sun Previews 2: Shadow*, August 2024）に**実装に効く2文**がある（収集docに無かった）：

> You play it only whenever you could otherwise play an Action from your hand; **you have to be allowed to play an Action, it doesn't get around that.**
> … And they don't have to be on the bottom for their ability to let them be played; they just have to be in your deck. **They can still be played from your hand too**; it's just not usually what you prefer.

さらに同 Preview の冒頭（`m_k4_shadow_cost.txt` 94行）：

> **I bet you never thought I'd revisit Stash.**

→ **作者自身が Shadow を「へそくり(Stash)の再訪」と位置づけている**＝本アプリでも
**Stash の既存実装に相乗りするのが設計上も正しい**（下の Alley ⚠8＝M2）。

**Omen（前兆）／Sun トークン**（rulebook 逐語）：

> - "+1 [Sun]" always appears first on Omens, before anything else the card does.
> - "+1 [Sun]" does nothing else once all the tokens are removed.
> - Prophecy text does nothing until the last Sun token is removed.
> - "+1 [Sun]" means, remove a token from the Prophecy. Then if it was the last token, the rules text on the Prophecy becomes active, right then and for the rest of the game.

**コスト比較 / 負債**（英語wiki `Cost` ＋ `Debt`。私が再取得して逐語確認した）：

> **Any card with [P] or [D] in its cost does not cost up to [$4].**
> Any card with [P] or [D] in its cost does not cost from [$3] to [$6].

**【N4 反映】rulebook の「コスト比較」ブレット2本**（初版で落ちていた。Change ⚠1 の位置づけに効く）：

> - Some cards compare costs. A card costing [$5] costs more than one costing [$4], just like one costing [$4] costs more than one costing [$3]. **However Debt and [$] are not comparable.** With a card costing [$4] and a card costing [4D], neither costs more than the other. [$4] does however cost more than [$3]; **there is an implicit [0D] in all pure [$] costs**, so [$4] costs the same amount of Debt as [$3], and more [$].
> - **Players cannot take Debt for no reason.**

→ 1本目が **Change の「コイン成分だけで厳密比較する」を公式一般則の上に位置づける**（＝Change は
「コスト全体の比較」ではなく **`+[$]`（コイン成分）だけの比較**だと FAQ 4 が上書きしている、という構図）。
2本目は **Change の「獲得できなければ負債を取らない」（clarification 3）の一般則側の根拠**。

> **A player can remove Debt tokens at any point in their turn** by paying [$1] per Debt token to remove it.
> This does not use up a Buy or an Action, and can be done multiple times in a turn.
> This does not let players play Treasures at any time.
> — RGG *Rising Sun* rulebook 2024, "Debt" 節。英語wiki `Debt` は旧文（購入フェイズ限定）を
>   **`Prior official rules (amended by the release of the Rising Sun expansion)` の見出し下に隔離**している。

> Although **buying** a card with [D] in its cost gives you Debt tokens, **gaining such a card in other ways does not.**
> — 英語wiki `Debt` > Other rules clarifications

rulebook の Examples（Change / Poet を名指し。コスト記号は pdftotext で欠落）：

> - Craftsman can't gain a Mountain Shrine, because [5D] is not "up to [$5]." **Poet cannot draw a Mountain Shrine, because [5D] is not "up to [$3]."** **Change can't gain a Mountain Shrine, no matter what you trash, because Mountain Shrine doesn't cost any [$].**
> - Tanuki trashing an Artist can gain a Daimyo, because Daimyo does cost "up to [$8] and [8D]."

### ⚠【N2 反映】"Other rules clarifications" は rulebook に無い＝**wiki 独自の節**
本章で引く `Other rules clarifications`（Change 3件・River Shrine 3件）は **RGG ルールブックには存在しない**。
英語wiki が編集者裁定としてまとめている節で、**一次資料としては wiki 1本足**。
とくに **Change ⚠2（＝最重要「コストを測り直す」）の根拠は ORC 1・2 だけ**なので、
**上の oldid（Change 97556）と併せて残さないと後で再検証できない**。
※ Official FAQ 側は rulebook 由来なので出所が違う（こちらは2本足）。

### 🟢 上の2つの負債ルールは **本日すでに実装済み**（commit `7cc4534`）
検証docの訂正2・3は「本アプリの engine と食い違う」と指摘していたが、**指摘は正しく、かつ既に修正されている**
（`fix(empires): 負債の2024エラッタ＝出荷済みの実バグ2件を修正（旭日の段階0で発覚）`・`sw.js` v76）。
- `REPAY_DEBT` の `if (t.phase !== 'buy') return state;` を撤去（engine.js:17357／UI も全フェイズ共通に）。
- `takeDebt` を `gain()` / `gainFromOutside` / `gainLoot` から外し、`BUY` / `BLACK_MARKET_BUY` へ移した
  （`BUY_EVENT` は元から個別付与）。engine.js:1908 の関数コメントに公式逐語が入っている。
**→ 旭日の実装時にやることは「新規対応」ではなく「回帰させないこと」**。

### ⚠【N12 反映】この6枚すべてに効く横断規約（1箇所にまとめる）
**vanilla ボーナスを直接書いてはいけない**（PROGRESS §0-25 の横断リファクタ）。6枚のどこでも守ること：

| 書きたいもの | 使う関数 | 直接書くと静かに壊れるもの |
|---|---|---|
| `+N Cards`（Alley/Ninja/Poet/Rustic Village） | **`draw(state, pi, n)`**（engine.js:1866） | カメレオンの習性（+カード↔+コイン）／-1カードトークン（遺物・借入） |
| `+N Actions`（Alley/Poet/Rustic Village） | **`addActions(t, n)`**（engine.js:1845） | **雪深い村**（このターン以降の +アクション をすべて無視） |
| `+$N`（Change の `+[$3]`） | **`addCoins(state, n)`**（engine.js:1854） | カメレオンの習性／-$1トークン（橋の下のトロル）の食い込み |

**`t.actions += n` / `t.coins += n` を直接書かない**（engine 内で140／133箇所を一括置換した経緯がある）。

---

### Alley ／ 小路　（$4・Action - Shadow）

- **英語カード文（逐語）**：
  ```
  +1 Card
  +1 Action
  Discard a card.
  ————
  You can play this from your deck as if in your hand.
  ```
  （生HTML＝`<b>+1&#160;Card</b><br /><b>+1 Action</b><p>Discard a card.</p><hr … />You can play this from your deck as if in your hand.`
  ＝**2つ目の `+1 Action` だけ `&#160;` が無い**）
- **日本語カード文（DO訳）**：
  ```
  +1 カードを引く
  +1 アクション
  手札1枚を捨て札にする。
  ————
  これは手札からと同様に山札からも使用できる。
  ```
  （種別の日本語＝`アクション-影`。`Shadow` の日本語は英語wiki の "In other languages" でも **影**）
- **区切り線**：**1本**（Card text セル内）。※ページ全体の `<hr>` は4本だが、内訳は Card text 1／English versions 表 1／French 行 1／German 行 1。
- **版**：English versions 表は**データ行1本のみ**（Changes＝`First edition`／Announced・Printed＝`August 2024`）。
  ページ内の `Errata` 出現数 **0**。→ **機能エラッタ無し**。oldid 96774。
- **公式FAQ・裁定**：
  - Official FAQ（全2件）：
    1. `See the Shadows section.`
    2. `When you play Alley, you draw a card, get +1 Action, and discard a card.`
  - Other rules clarifications：**節そのものが存在しない**（推測ではなく、見出しを機械抽出して確認済み）。
  - Trivia（Secret history）：`I didn't know how many Shadow cards I'd end up doing, but this was a nice one to try, and I was instantly happy with it.`
  - Info ボックスに専用の **Card back 画像**（`File:AlleyBack.jpg`）＝Shadow は裏面が違う。
  - Illustrator＝Yusuke Mamada。
- **⚠ 実装で危ないところ**：
  1. **【訂正1を反映】「山札にある Shadow カードは Alley の捨て札対象にできない」**。
     Shadows 節の最終ブレット `you cannot discard **it** to an ability like Alley's (unless it is actually in your hand)` の
     `it` ＝ **山札にある Shadow カード**であって「プレイした Alley 自身」ではない（起草docは誤読していた）。
     カッコ書き `unless it is actually in your hand` が「手札に実在すれば捨てられる」と言っている以上、
     主語は場のカードではあり得ない。**DO訳が `手札1枚を捨て札にする。` と「手札」を明示しているのも裏付け**。
     → **実装＝捨て札の候補は `p.hand` だけ**。Shadow は「**プレイだけが山札から可能／それ以外の "手札" 参照は
     すべて実際の手札のみ**」という線引きで書くこと（この一文がその線引きの根拠）。
  2. **`Discard a card.` は強制**（`you may` ではない）。**手札0枚なら捨てられないだけ**＝
     **候補ゼロで窓を開かない／開いたら閉じる終端保証**を書く（§0-30 で拡大(Enlarge)が手札0枚で詰んだのと同型）。
     +1 Card が先なので通常は1枚ある（山札も捨て札も空なら0枚あり得る）。
     **新 pending が要る＝4点セット必須**（engine reducer／`PLAYER_ACTIONS`（engine.js:21249）／
     CPU `decidePending`／UI `viewPendingModal`）。**強制なので「やめる」ボタンは出さない**
     （候補があるときに辞退ボタンを出すと公式より弱くなる＝§0-29 A5 のリッチと同じ扱い）。
  3. **順序＝ +1 Card → +1 Action → 捨てる**（FAQ 2 逐語）。**引いたばかりの札を捨ててよい**。
  4. **捨て札トリガーを必ず通す**＝`triggerOnDiscard`（engine.js:**9628**）。坑道／村有緑地／忠犬／疲れ知らずの が誘発する。
  5. **Shadow ＝本アプリに前例ゼロの新機構**（「山札のどこからでもアクションとしてプレイできる」）。
     配線が要る場所（全部同じコミットで揃えること＝片側だけ締めると本番 livelock）：
     - `PLAY_ACTION`（engine）は手札しか見ない → 山札からの経路を足す。**アクション権を消費する**
       （Preview 逐語 `you have to be allowed to play an Action, it doesn't get around that.`）。
     - **【N16 反映】`PLAY_ACTION` に `from:'deck'` を足すのか、新しい action 名を作るのかを先に決める**。
       新 action を作るなら **`PLAYER_ACTIONS`（engine.js:21249〜）に登録が必須**
       （＝サーバの許可リストがここから導出される。登録漏れは整合性テストが赤にする）。
       `from:'deck'` を足すほうが `PLAYER_ACTIONS` を触らずに済むが、**reducer の受理側で
       「その card が本当に `p.deck` にあるか」を必ず検証する**こと（クライアント入力なので信用しない）。
     - **【N16 反映】CPU の候補生成にも足す**＝`js/cpu.js` の `chooseAction` は**手札しか見ない**ので、
       配線しないと **CPU は Shadow が手札に来たときしか使わない**。engine拒否×CPU提案の livelock には
       ならないので事故ではないが、**Ninja の「毎ターン民兵」というカードの本体が CPU 戦で再現されず、
       CPUソークでも Shadow 経路が1度も踏まれない**（＝A5 の「闇市場×同盟＝人間だけが通る道」と同じ構図）。
     - **【N15 反映】航海(Voyage)／将軍(Warlord) をどう扱うか**（下の「未確定」4件目）。
       `PLAY_ACTION` は `notePlayFromHand(state, pi)`（engine.js:**8291**）で**手札からの使用回数**を数え、
       `canPlayHandCard`（engine.js:**8297**）＝`canPlayFromHand`（8286）＋`warlordBlocks` で止める。
     - **玉座の間／王の宮廷／行進／稽古(Practice)などの「手札のアクションを使用する」対象に山札の Shadow が出る**
       （Shadows 節が Throne Room を名指し）。engine の窓・受理・CPU 候補・UI フィルタの**4面**に足す。
     - 習性(Way)／女魔術師／追いはぎ など「使用を書き換える」経路。
     - `maskStateFor`（engine.js:**21133**）→ 下の 8. 参照。
     - **【N10 反映】新種別 `shadow`（影）と `omen`（前兆）を4箇所に足す**（§0-30b で `loot` を足したときと同じ4箇所）：
       `js/carddata.js:115-116` の **`ALLIES_TYPE_JP` / `ALLIES_TYPE_EN`**（＝「types 配列の順に連ねる」汎用表。
       `typeLabel` は `if (types.some((t) => ALLIES_TYPE_JP[t]))` で汎用経路に入るので、**ここに足さないと
       汎用規則が発動しない**）／`js/ui.js:124-129` の **`TYPE_JP`**／`test/integrity.test.js:120-121` の JP・EN。
       ⚠ **枠スキンの新設は不要**＝`js/carddata.js:100-110` の `frameType` は shadow/omen を素通りして
       **Ninja → `attack`／他4枚 → `action`** に落ちる（`tools/build-cards.js` を触りに行かなくてよい）。
       ※足し忘れは `test/ui.test.js` の TYPE_JP 網羅検査が赤にするので事故にはならない。
  6. **シャッフル時に「一番下へ」**＝`reshuffleDeck`（engine.js:**1183**）に介入する。
     **【N14 反映】挿入点は `p.fatedIds` 分岐（engine.js:1254-1263）とまったく同じ形**＝
     ```js
     if ((p.fatedIds || []).length && shuffled.length > 1) {
       … shuffled.splice(i, 1) で抜く …
       if (top.length) shuffled.unshift(...top);
       if (bottom.length) shuffled.push(...bottom);   // ← Shadow はこの bottom 側と完全に同じ
     }
     p.deck = p.deck.concat(shuffled);   // engine.js:1265
     placeStash(p);                      // engine.js:1266
     ```
     ⚠ **必ず 1265行の `concat` の前に `shuffled` へ押し込むこと**（`p.deck.push` ではない）。
     **山札に未シャッフルの残りがあるときに意味が変わる**（公式＝「シャッフルした束の一番下」）。
     ⚠ `placeStash(p)` は **concat の後**に走り、**山札全体から `stash` を抜き直して端に置く**ので、
     へそくりと Shadow を同時に持つと最下段の取り合いになる（公式は「任意の順で混ぜてよい」＝
     **自動選択で可**＝`p.stashPlacement` と同じ許容簡略化枠）。
     既存の同型＝へそくり `placeStash`（engine.js:**1141**）／**略奪の「運命の(Fated)」**
     （rulebook が `such as Fated cards from Plunder` と名指しで併存を認めている＝mix-all で必ず同居し得る）。
     **獲得したときには一番下に置かない**（`Shadow cards are not put on the bottom when gained`）。
     **一番下に固定されるわけでもない**（引けば上から消えるだけ＝`will not necessarily stay on the bottom`）。
  7. **「シャッフル時に一番下へ」はカード表面に無い＝裏面に印刷されている**
     （Ninja の Secret history 逐語 `And then I moved the shuffling text to the card back`）。
     **入れてはいけない当の1文＝`When shuffling this, put it on the bottom of your deck.`**
     （私が `_alley.jpg` / `_ninja.jpg` を実見。2枚とも同一文）。
     → **`DOM.CARDS` の `text` に書いてはいけない**（区切り線の下は `You can play this from your deck as if in your hand.` だけ）。
  8. **【M2 反映＝「未確定」を撤回】Shadow の位置は公開情報として実装する＝へそくり(Stash)の前例が
     `maskStateFor` に既にある**。初版は「機構担当群で決めること」と保留し、⚠7 で
     「本アプリは裏面を `'back'` の一括トークンで扱うので固有裏面は再現しない（コスメのみ）」と書いていたが、
     **それは事実と違った**（私も engine.js を読んで確認）：
     - `js/engine.js:1141` 直前のコメント＝**「へそくりは裏面が異なる＝山札内の位置は公開情報」**。
     - **他席**＝`js/engine.js:21156-21161`
       `deck: p.deck.map((c) => (c === 'stash' ? 'stash' : 'back'))`（`hand` / `setAside` も同じ扱い）。
     - **自席が本題**＝`js/engine.js:21142-21146`。**自分の山札は順序情報を消すために `sort()` している**：
       ```js
       if (i === seat) {
         const rest = p.deck.filter((c) => c !== 'stash').sort();
         let ri = 0;
         return Object.assign({}, p, { deck: p.deck.map((c) => (c === 'stash' ? 'stash' : rest[ri++])) });
       }
       ```
       ＝**`stash` だけが位置を保ったまま配信される**。
     → **Shadow をこの分岐に相乗りさせないと、rulebook が保証する
     `You can look through your deck at the card backs at any time, and see where your Shadow cards are.` が
     オンラインでだけ壊れる**（ローカルは完全な state を見ているので気づかない＝PROGRESS が何度も踏んでいる
     「オンラインだけが通る道」の型）。**修正は2箇所とも1行**（`c === 'stash'` を
     `c === 'stash' || DOM.isType(c, 'shadow')` にする）。
     ※ Preview 冒頭が `I bet you never thought I'd revisit Stash.` と Stash を名指ししており、**設計上も同一系統**。
     ⚠ 逆に「相手には隠す」と決めるなら、**`'back'` 一括では位置を表現できない**ので専用トークンが要る
     ＝そのときは ⚠7 の「コスメのみ＝影響なし」は成り立たない。
  9. `alley` の **id 衝突なし**（既存761枚と機械照合済み）。日本語名 `小路` も既存 `DOM.CARDS`/`DOM.LANDSCAPES` に無し。

---

### Change ／ 交替　（$4・Action）

- **英語カード文（逐語）**：
  ```
  If you have any [D], +[$3]. Otherwise, trash a card from your hand, and gain a card costing more [$] than it. +[D] equal to the difference in [$].
  ```
  （**1ブロック＝`<br>` も `<p>` も無い**。`[D]`＝負債アイコン、`[$3]`＝コイン3、`[$]`＝コイン記号）
- **日本語カード文（DO訳）**：記号を復元した読み＝
  ```
  〈負債〉を持っている場合、+3 コイン。
  それ以外の場合、手札1枚を廃棄し、それよりコストの〈コイン〉が高いカード1枚を獲得する。
  〈コイン〉の差に等しい数だけ、+〈負債〉。
  ```
  ⚠ **抽出の生値**（`g0_jp_pairs.md`）＝
  `<X> を持っている場合、 +3 コイン 。 | それ以外の場合、手札1枚を廃棄し、それよりコストのコインコストが高いカード1枚を獲得する。 | コインコストの差に等しい数だけ、 + <X>`
  ＝ `<X>` が負債アイコン、**「コインコスト」がコインアイコンの置換**。
  **【N7 反映】置換語は3行とも同じ扱いにした**（初版は2行目だけ `〈コイン〉` に直し、3行目を
  `コインコストの差に等しい数だけ` と置換語のまま残していた＝復元が不統一だった）。
  **日本語wiki のページを直接見て記号位置を最終確認すること**（文言そのものは DO 訳で確定・改行位置だけ私の復元）。
- **区切り線**：**0本**（ページ全体の `<hr>` が0）。
- **版**：データ行1本のみ（`First edition`／`August 2024`）。`Errata` 出現数 0 → **機能エラッタ無し**。oldid 97556。
- **公式FAQ・裁定**：
  - Official FAQ（全4件）：
    1. `Remember you can repay [D] at any point during your turn, which can sometimes let you choose which thing Change will do.`
    2. `If you have any [D], Change gives you +[$3]; otherwise you trash a card from your hand, gain any card costing more [$], and take equal [D] to the difference. For example you could trash a Copper, gain a Province, and take [8D].`
    3. `You can't gain a card costing the same amount of [$] or less [$].`
    4. `This ignores other special aspects of cost; for example you could trash an Estate and gain an Alchemist, from Alchemy, which costs [$3] and [P]`
       （※末尾のピリオド欠落は **wiki の原文どおり**。rulebook 側にはピリオドがある＝wiki の転記脱字）
  - Other rules clarifications（全3件・**⚠ wiki 独自の節**＝上の N2 の但し書きを参照）：
    1. `You re-check the costs of the trashed card and the gained card right before calculating how much [D] to take. For example, if you haven't gained any cards and trash a Wayfarer and gain a Province, you take no [D] because both cards now cost [$8].`
    2. `If the gained card now costs less than the trashed card, you still take [D] for the difference. For example, if your discard pile is empty and you trash Fisherman (which costs [$2]) and gain a Silver, you take [2D] because Fisherman now costs [$5].`
    3. `You don't take any [D] if you don't gain a card, such as when there are no cards that cost more [$] or when someone else gains the card instead due to Possession.`
  - Trivia（Secret history）：`The initial card didn't have the "no [D]" clause. So you'd just go nuts with Changes, piling up debt you were never going to pay off. …`
  - Trivia（Preview・*Rising Sun Previews 4: On-play Debt*）：`Change lets you turn something into something better. Curse can go straight to Province. … **Yes Change can gain [P]-costing cards. And in rare situations, [D]-costing cards that also cost [$].**`
  - Illustrator＝Julien Delval。
- **⚠ 実装で危ないところ**：
  1. **【最重要・既存述語を使ってはいけない】`costUnder`/`costUpTo`/`costExact` は使えない**。
     Change の "more [$]" は**コイン成分だけの厳密比較**で、**ポーション費用も負債コストも一切見ない**
     （FAQ 4 逐語 `This ignores other special aspects of cost`＝屋敷 $2 を廃棄して**錬金術師 $3+P** を獲得できる）。
     本アプリの `costLE`/`costLT`（engine.js:**4459-4460**）は**3成分すべて**を見るので**逆の結果になる**。
     → **専用述語を1つ作る**＝`gainableBase(state, id) && cardCost(state, id) > cardCost(state, trashedId)`
       （`gainableBase`＝engine.js:**4463**。非サプライ／ロック中の分割山下段／在庫切れ／カタログ非在を弾く
        ＝ここは通常どおり）。
     ⚠ PROGRESS §0-23 の「素の `cardCost <= N` を書くな」に**真っ向から見える例外**なので、
       **コメントにこの FAQ を逐語で残す**こと（後の敵対レビューが「バグ」と誤検出する）。
     ⚠ **一般則との位置づけ**（N4 の rulebook ブレット）＝公式の既定は
       「Debt と [$] は比較できない／純コイン費用には暗黙の `[0D]` がある」だが、
       **Change は "more [$]" と書いてコイン成分だけを見ると FAQ 4 が明示的に上書きしている**。
       ＝「一般則に反する」のではなく「カードが一般則より狭い比較を指定している」。
     - **山の社(Mountain Shrine・`5D`)はコイン成分0なので何を廃棄しても取れない**（rulebook が名指し）＝
       `>` の厳密比較だけで自動的に正しくなる（コイン成分の最小値は0）。
     - **大金(Fortune・$8+8D)は取れる**（コイン成分8）。**既存761枚で「$と負債を両方持つ」のは大金の1枚だけ**
       （`js/cards.js` の `debt:` は engineer / city_quarter / overlord / royal_blacksmith ＝いずれも `cost:0`、
       ＋ fortune ＝ $8+8D。**旭日の負債札（山の社 5D／大名 6D／絵師 8D）も全部コイン成分0**）。
       ＝**Change で負債コスト札を取れるのは mix-all ×大金 のときだけ**（Preview の `in rare situations` がこれ）。
  2. **【最重要】負債の差は「もう一度測り直して」から計算する**（Other rules clarifications 1・2）。
     **本アプリはこの2つの例を実際に踏む**＝
     - **行人(wayfarer)**＝`cardCost` が `state.turn.lastGainedAny` を見る動的コスト（engine.js:**377-381**）。
       `lastGainedAny` は `gain()` の中（engine.js:**2007**）で更新されるので、**獲得した瞬間に廃棄済みの
       行人のコストが変わる**。→ 公式例（行人を廃棄→属州を獲得→**負債0**）がそのまま再現できる。
       ⚠ **ただし `gainFromOutside` は `lastGainedAny` を更新しない**＝下の「出荷済みの実バグ候補」参照。
     - **漁師(fisherman)**＝`cardCost` が手番プレイヤーの捨て札が空かを見る（engine.js:**384**）。
       銀貨が捨て札に入った瞬間に $2→$5 に戻る → 公式例（**負債2**）。
     - **【N5 反映】デストリエ(destrier)＝3つ目の自己参照例**（engine.js:**383**）＝
       `base -= (t.gainedThisTurn || []).length` ＝**「獲得するたびに自分が安くなる」**。
       ＝**Change 自身の獲得で、廃棄済みのデストリエが1段安くなる**（公式例2つと同じ罠を国産カードで踏む）。
       例＝デストリエ（素$6・このターン獲得0なので$6）を廃棄→$7の何かを獲得→
       **獲得後にデストリエは$5になる**ので、差は1ではなく**2**。
     - **差は絶対値**（clarification 2＝獲得札のほうが安くなっても差のぶん負債を取る）。
     → **「廃棄した時点で差を確定する」素朴実装は必ず壊れる**。**獲得の完全解決後に両方を `cardCost` で測り直す**。
  3. **獲得できなければ負債は取らない**（clarification 3・一般則 `Players cannot take Debt for no reason.`）。
     **支配(Possession)で獲得者が別人になった場合も負債0**＝§0-23 の「負債は支配者が負う」（`takeDebt` の振り分け）とは
     **別の分岐**（そもそも負債を付ける処理を呼ばない）。
  4. **【N13 反映】`takeDebt` をそのまま使ってはいけない**。
     `js/engine.js:1908` の実装は **`function takeDebt(state, pIndex, cardId)`＝カードidから
     `C()[cardId].debt` を読む**形（＝「そのカードの負債コスト」専用）。
     Change の `+[D] equal to the difference` は**任意の数**なので、`takeDebt(state, pi, 'change')` と書くと
     **`change` に `debt` 欄が無いので黙って 0**（＝静かなバグ・テストも赤くならない）。
     → **個数を受ける汎用版が要る**（例＝`takeDebtAmount(state, pi, n, reason)`）。
       **支配の振り分けは既存実装に倣う**＝engine.js:1912
       `const who = (t && t.possessedBy != null && pIndex === t.active) ? t.possessedBy : pIndex;`。
       **ログ文言も既存と揃える**（`… は「◯◯」で 負債N を負った。`）。
     ※ 旭日には他にも「使用時に負債を得る」札（名匠 +2／室 +3）があるので、**どうせ共通化が要る**。
  5. **🟢 獲得したカード自身の負債コストは付かない**（`gaining such a card in other ways does not`）。
     **`7cc4534` で `gain()` から `takeDebt` を外して修正済み**＝**回帰させないこと**。
     もし戻すと、mix-all で $7以下を廃棄して**大金**を獲得したとき「差の負債」＋「8負債」の二重取りになる。
  6. **🟢 分岐は「負債を1つでも持っているか」／負債はターン中いつでも返済できる**（FAQ 1）
     ＝**使う直前に返済してモードを選べる**。**`7cc4534` で `REPAY_DEBT` の購入フェイズ制限を撤去済み**
     （reducer＝engine.js:**17357**／`PLAYER_ACTIONS` 登録＝engine.js:**21304**）＝
     Change はアクションフェイズのカードなので、この修正が無いと**カードの中核の駆け引きが engine で不可能**になる。
     - CPU＝`js/cpu.js:**3980**` の返済分岐は**購入フェイズの財宝を出し切った後**にしか無い。
       Change を実装するなら「アクションフェイズで Change を使う前に返すか」の判断が要る（無いと常に `+$3` モードになる）。
     - UI＝`js/ui.js:**1795**` の返済ボタンは全フェイズ共通になっている（`t.active === viewer && debt>0 && t.coins>0`）。
       **アクションフェイズにコインを持っているのは稀**（`+$` を出すアクションを使った後）なので、
       Change の pending を開く前に「今なら返済してモードを変えられる」導線があるか確認すること。
  7. **廃棄は強制**（手札があれば1枚）。**獲得は候補ゼロなら何も起きない**（clarification 3 が明示）＝
     **候補ゼロで窓を開かない**。廃棄→獲得の2段 pending＋**4点セット**
     （engine reducer／`PLAYER_ACTIONS`／CPU `decidePending`／UI `viewPendingModal`）。
     **廃棄側は強制なので辞退ボタン不要／獲得側は「候補があれば強制」＝辞退ボタンを出さない**が、
     **候補ゼロなら窓自体を開かない**（開いてしまった旧スナップショット互換のために**受理側の終端保証**も書く
     ＝§0-29 A5 のリッチと同型）。
  8. `change` の **id 衝突なし**（既存 `changeling`＝夜想曲・取り替え子 とは別id）。日本語名 `交替` も衝突なし。

---

### Ninja ／ 忍者　（$4・Action - Attack - Shadow）

- **英語カード文（逐語）**：
  ```
  +1 Card
  Each other player discards down to 3 cards in hand.
  ————
  You can play this from your deck as if in your hand.
  ```
- **日本語カード文（DO訳）**：
  ```
  +1 カードを引く
  他のプレイヤーは全員、手札が3枚になるように捨て札にする。
  ————
  これは手札からと同様に山札からも使用できる。
  ```
  （種別＝`アクション-アタック-影`）
- **区切り線**：**1本**（Card text セル内。ページ全体4本＝Card text 1／versions 表 1／French 1／German 1）。
- **版**：データ行1本のみ（`First edition`／`August 2024`）。`Errata` 出現数 0 → **機能エラッタ無し**。oldid 97557。
- **公式FAQ・裁定**：
  - Official FAQ（全2件）：
    1. `See the Shadows section.`
    2. `When you play Ninja, you draw a card, and each other player discards down to 3 cards in hand.`
  - Other rules clarifications：**節そのものが存在しない**。
  - Trivia（Preview・**実装に効く1文**）：`It's +1 Card and a Militia attack. Only it's not really just +1 Card, because **it draws itself**, if you see what I mean. …`
    → **山札からプレイする場合、自分自身が山札から場へ出たぶん「実質2枚ぶん」の圧縮になる**という意味。
      実装上の含意は下の ⚠4（**抜いてから引く**）。
  - Trivia（Secret history・実装に効く部分）：`… Which changed to let you play the card from anywhere in your deck, so you weren't worrying too much about the order when you had multiple Shadow cards. **And then I moved the shuffling text to the card back**, because Ninja in particular was cramped for space.`
  - Info ボックスに専用の Card back 画像（`File:NinjaBack.jpg`）。
  - Illustrator＝Elisa Cella。
- **⚠ 実装で危ないところ**：
  1. **アタック部分は民兵(Militia)と完全に同型**＝既存の
     **`discardDownEnter(state, source, down, victims, next, drawAfter)`（engine.js:**3306**）** を
     そのまま流用できる（`down=3`・`next=null`・`drawAfter=0`）。
     **`ATTACKS` への登録＋`*EnterVictim`＋リアクション窓（堀／盾／灯台／守護者／チャンピオン）は必須**。
     ⚠ **略奪の剣(Sword)は `down=4`／忍者は `down=3`** ＝定数を取り違えないこと。
  2. **§0-30 P1b で踏んだ穴に注意**＝`modalMilitia` / `modalDiscardDown` / `modalTorturer` の3モーダルは
     **`reactOptions` を通らず独自のボタン列を持つ**ので、免疫札のボタンを個別に足さないと
     **engine と CPU は受理するのに人間だけが免疫を使えない**。忍者を足すときも同じ3モーダルを見ること。
  3. **山札からプレイできる＝実質毎ターン撃てる**（Preview で作者自身が民兵より当たりやすいと認めている）。
     ＝CPU ソークで `discard_down` が常時開く局面になるので、**リアクション窓の終端保証を厚めに**。
  4. **順序＝ 山札から場へ出す → +1 Card**。山札からプレイする場合、**先に `p.deck` から抜いてから
     `draw()`（engine.js:1866）を呼ぶ**（抜く前に引くと自分自身を引く）。
     ⚠ **抜いた結果 `p.deck` が空になったら `draw()` の中で `reshuffleDeck` が走る**＝
     そこで **Shadow の「一番下へ」** が発動しうる（自分は既に場に出ているので対象外だが、
     **他の Shadow／略奪の運命の／へそくり が同時に動く**）。
  5. Shadow 一般の危険は **Alley の ⚠5〜8 と同じ**（アクション権を消費する／玉座の対象になる／
     シャッフル時に一番下／獲得時は一番下に置かない／裏面テキストはカタログ文に入れない／
     **位置は公開情報＝`maskStateFor` の stash 分岐に相乗り**）。
  6. `ninja` の **id 衝突なし**。日本語名 `忍者` も衝突なし。

---

### Poet ／ 歌人　（$4・Action - Omen）

- **英語カード文（逐語）**：
  ```
  +1 [Sun]
  +1 Card
  +1 Action
  Reveal the top card of your deck. If it costs [$3] or less, put it into your hand.
  ```
- **日本語カード文（DO訳）**：
  ```
  +1 Sun
  +1 カードを引く
  +1 アクション
  山札の一番上のカードを公開する。それがコスト3以下の場合、手札に加える。
  ```
  （種別＝`アクション-前兆`。**日本語wiki も日の出トークンを `Sun` と英字のまま書いている**＝
  カタログ文をどう表記するかは横型/機構担当群の決定に合わせること）
- **区切り線**：**0本**。
- **版**：データ行1本のみ（`First edition`／`August 2024`）。`Errata` 出現数 0 → **機能エラッタ無し**。oldid 97628。
- **公式FAQ・裁定**：
  - Official FAQ（全2件）：
    1. `Cards with [D] in their costs do not cost "[$3] or less."`
    2. `The card goes back on top of your deck if it doesn't get put into your hand.`
  - Other rules clarifications：**節そのものが存在しない**。
  - rulebook の Examples が名指し：`Poet cannot draw a Mountain Shrine, because [5D] is not "up to [$3]."`
  - Trivia（Preview）：`Poet is one of those sometimes-Labs, this time drawing cards costing [$3] or less.`
  - Trivia（Secret history）：`Just another Omen set up to be useful in lots of games. I tried getting cards costing [$2] or less (costing [$3]), why do I always forget that that's Will-o'-Wisp? I tried [$3] or less and well, this story is short.`
  - Illustrator＝Yusuke Mamada。
- **⚠ 実装で危ないところ**：
  1. **【私が追加した訂正・[medium]】起草docの「既存述語 `costUpTo` を使えばよい」は誤り**。
     `costUpTo`（engine.js:**4467**）は **`gainableBase`（engine.js:4463）を内包**＝「非サプライでない・
     分割山がロックされていない・**サプライに在庫がある**」を要求する。
     **Poet が見るのは山札の一番上のカードでサプライとは無関係**なので、`costUpTo` を使うと
     **銅貨の山が尽きた後の銅貨／略奪品・馬・賞品・戦利品などの非サプライ札が
     「$3以下ではない」ことになり、手札に入らなくなる**（＝静かな忠実性バグ）。
     → **正しい書き方は `costLE(costOf(state, top), { coin: 3, pot: 0, debt: 0 })`**
       （`costOf`＝engine.js:**4455**／`costLE`＝engine.js:**4459**）。
     **完全な同型の前例が既にある**＝**ウィル・オ・ウィスプ(`will_o_wisp`・engine.js:**7308-7321**)**
     （`Reveal the top card of your deck. If it costs $2 or less, put it into your hand.` ＝文面まで同型）。
     そこのコメントが逐語で
     「**`costUpTo` は非サプライ除外＋在庫>0 を含むのでここでは使わない（山札の上のカードはサプライと無関係）**」
     と書いている。**Poet はこの case をコピーして `2`→`3` にするのが最短かつ最も安全**：
     ```js
     case 'will_o_wisp': {
       draw(state, pi, 1); addActions(t, 1);
       if (p.deck.length === 0 && p.discard.length) reshuffleDeck(p);
       if (p.deck.length) {
         const top = p.deck[0];
         reveal(state, pi, [top], 'ウィル・オ・ウィスプ');
         if (costLE(costOf(state, top), { coin: 2, pot: 0, debt: 0 })) {
           p.deck.shift(); p.hand.push(top);
           …
     ```
     ※作者の Secret history も「$2以下＝ウィル・オ・ウィスプだった」と書いており、同型であることを裏付けている。
  2. **`[$3] or less` は負債もポーション費用も除外する**（＝上の `{coin:3, pot:0, debt:0}` で正しい）。
     起草docは「ポーション側は未確定」と保留していたが、**英語wiki `Cost` に逐語で決着している**
     （私も取り直して確認）＝`Any card with [P] or [D] in its cost does not cost up to [$4].`
     → **保留を残す必要はない**。
  3. **順序が固定＝ `+1 [Sun]` が最初**（Omen 一般則）。**その場で最後の Sun トークンが外れたら、
     +1 Card を引く前に Prophecy が有効化される**（`right then and for the rest of the game`）。
     ＝Prophecy の内容によっては**同じプレイの残りの解決が変わる**。
     `applyEffect` の先頭で `+1 Sun` を処理し、**Prophecy の有効化を同期的に完了させてから**残りを実行すること。
     ⚠ **前兆/予言の共通機構（Sun トークンの器＋Prophecy の有効化）が先に要る**＝
     **この3枚（Poet / River Shrine / Rustic Village）は機構バッチの後でしか実装できない**。
  4. **`+1 Card` が先・公開は後**＝**引いた後の新しい山札の一番上**を見る。
     山札が空ならシャッフルが起きる（`reshuffleDeck` の戻り値＝メイソン団の「同じアクセスで2度シャッフルしない」／
     **Shadow の「一番下へ」**／略奪の「運命の」が絡む）。ウィル・オ・ウィスプの case が
     `if (p.deck.length === 0 && p.discard.length) reshuffleDeck(p);` を先に書いているので同じ形にする。
  5. **「公開(reveal)」であって「見る(look at)」ではない**＝**`reveal()`（engine.js:**1814**）を必ず通す**
     （ルネサンスのパトロンが誘発する＝§0-22 の横断規約）。
     **全員に見えるので `maskStateFor` の私的看破リストには入れない**（入れると逆に公式違反）。
  6. **手札に入れなかったカードは山札の上に残る**（FAQ 2）＝**捨て札置き場を経由しない・捨て札トリガーを1つも通さない**。
     ウィル・オ・ウィスプ実装のように「取るときだけ `p.deck.shift()`」と書けば自然に満たされる。
     ＝**pending は不要**（自動判定）。
  7. **公開した1枚が Shadow だった場合**＝素直に読めば普通に手札へ入る（Shadow は山札に居るだけの普通のカード）。
     入った後は「実際に手札にある」ので **Alley の捨て札対象になる**（上の Alley ⚠1 のカッコ書き）。
     一次資料に明示は無いが、Shadows 節の書きぶりと矛盾しない＝**特別扱いを書かないのが正しい**と判断した。
  8. `poet` の **id 衝突なし**。日本語名 `歌人` も衝突なし。

---

### River Shrine ／ 川の社　（$4・Action - Omen）

- **英語カード文（逐語）**：
  ```
  +1 [Sun]
  Trash up to 2 cards from your hand. At the start of Clean-up, if you didn't gain any cards in your Buy phase this turn, gain a card costing up to [$4].
  ```
  （生HTML上、`Trash up to 2 cards…` と `At the start of Clean-up…` は**同一 `<p>`＝改行なし**）
- **日本語カード文（DO訳）**：
  ```
  +1 Sun
  手札を最大2枚廃棄してもよい。
  クリーンアップフェイズの開始時、このターン購入フェイズにカードを獲得しなかった場合、コスト4以下のカード1枚を獲得する。
  ```
  （種別＝`アクション-前兆`。**英語は1段落だが日本語wiki の表示は2行**＝カタログ文の改行位置は既存の言い回しに合わせる）
- **区切り線**：**0本**。
- **版**：データ行1本のみ（`First edition`／`August 2024`）。`Errata` 出現数 0 → **機能エラッタ無し**。oldid 97626。
- **公式FAQ・裁定**：
  - Official FAQ（全4件）：
    1. `It doesn't matter if you gained cards in your Action phase, only if you did in your Buy phase.`
    2. `If you play multiple River Shrines, they can all gain a card, provided you don't gain a card in your Buy phase.`
    3. `Trashing cards with this is optional; you can gain a card even if you didn't trash any cards.`
    4. `If you have multiple Buy phases, such as via Continue, River Shrine only gains you a card if you didn't gain a card in any of those Buy phases.`
  - Other rules clarifications（全3件・**⚠ wiki 独自の節**）：
    1. `Normally, buying Continue will make you gain a card, which means River Shrine can't gain a card. However, you can still have multiple Buy phases that don't ever gain a card (by buying Launch, buying Continue while Possessed, or buying Continue when there are no non-Attack Actions costing up to [$4] remaining in the Supply).`
    2. `If this gains a 2nd River Shrine and you play it with Rush, that River Shrine will also gain a card.`
    3. `If you play River Shrine on another player's turn, you don't gain anything from it in Clean-up.`
  - Trivia（Preview）：`River Shrine is a trasher, and also can gain you a card if you don't gain anything in the Buy phase. … **It's cumulative, two River Shrines will gain you two cards.**`
  - Trivia（Secret history）：`Initially it gave you +2 Cards if you trashed differently named cards. … At first you had to not gain any cards that turn, but I went with the friendlier, no cards gained in that Buy phase.`
  - Illustrator＝Claus Stephan。
- **⚠ 実装で危ないところ**：
  0. **【N11 反映】`+1 [Sun]` が最初＝廃棄を選ぶ前に Prophecy が有効化されうる**（Omen 一般則。
     Poet ⚠3・Rustic Village ⚠1 と同じ注意がこの札にも要る）。
     **Prophecy の内容次第で「何を廃棄すべきか」の判断が変わる**ので、
     `applyEffect` の先頭で `+1 Sun` を**同期的に完了させてから** `river_shrine_trash` の pending を開くこと。
     ⚠ **前兆/予言の共通機構が先に要る**（Poet ⚠3 と同じバッチ依存）。
  1. **「クリンナップ開始時」の窓＝本アプリで最も事故る場所**。**既存の同型＝ルネサンスの増築(Improve)**。
     `endBuyTailSchemeOrCleanup`（engine.js:**11522**）の**先頭付近**に挟み、
     **誘発した対話が残っている間は `t.cleanupWaiting` で片付けを保留する**
     （宣言＝engine.js:**1346**／保留＝**11571-11574**／reduce 末尾の再入＝**11977-11980**）。
     これを怠ると **「相手の手番中に獲得の窓が開く」「先引きした次の手札を巻き込む」**
     （§0-22 の [high] 1 とまったく同型）。
  2. **累積する**（FAQ 2・Preview 逐語 `two River Shrines will gain you two cards`）＝
     **場の物理枚数ではなく「このターン何回プレイしたか」で数える**。
     **既存の同型＝`t.improvePlays`**（宣言＝engine.js:**1344**／インクリメント＝**5206**／
     消化用の残数 `t.improveLeft`＝**11530**）。**同じ形の `t.riverShrinePlays` / `t.riverShrineLeft` を作る**こと
     （策謀の `t.schemes` と同型）。
     ⚠ **未確定＝再演（玉座の間／無謀な(Reckless)／旗艦／大名(Daimyo)）で回数が増えるか**は
       wiki / rulebook のどのページにも明言が無い（検証者も同じ結論）。
       **推奨＝増築と同じく「プレイ回数で数える」**（増築が同じテンプレートで公式どおりそう動く、という類推。
       ただし**類推であって一次資料ではない**）。
  3. **【M1 反映＝新しい旗を作ってはいけない】判定は「購入フェイズに1枚でも獲得したか」（FAQ 1）＝
     本アプリには既に `t.buyPhaseGained` がある**。初版は「新しい旗が要る／`gainWasBuyPhase` を
     ターン単位で立て直す」と書いていたが、**その旗は既に実装されている**（私も engine.js を読んで確認）：
     - **3経路すべて**で立つ＝`gain`（engine.js:**2013-2016**）／`gainFromOutside`（**1941**）／
       `gainLoot`（**2162**）：
       ```js
       if (t.phase === 'buy') { t.buyPhaseGained = true; t.bpGained = (t.bpGained || 0) + 1; }
       ```
       ＝**闇市場・購入フェイズ中の on-gain 連鎖・獲得系イベントも自動で数える**
       （3経路とも `pIndex === t.active` のガードの中にあることも確認済み）。
     - **`t.buyPhaseGained` は「ターン単位」**（どこでもリセットされない）＝
       **FAQ 4／clarification 1（購入フェイズが複数回あっても "そのすべて" で獲得0）を自動で満たす**。
     - **⚠ 隣に紛らわしい `t.bpGained` がある**＝`END_ACTION_PHASE`（engine.js:**12795**）で **0 にリセットされる**
       （ルネサンスの探査＝「**その**購入フェイズ」用＝engine.js:**11424**）。
       **こちらを掴むと FAQ 4 に違反する**（ヴィラ／発進(Launch)／継続(Continue) で購入フェイズに
       入り直すと River Shrine が不当に獲得する）。
       engine.js:**2011-2012** のコメントが「隠遁者＝ターン単位／探査＝購入フェイズ単位」と両者を書き分けている。
     - **同じ窓に先例がある**＝暗黒時代の隠遁者 engine.js:**11456**
       `if (me.inPlay.includes('hermit') && !state.turn.buyPhaseGained)` ＝
       **「購入フェイズ中に1枚も獲得していなければ」という条件文が、片付け開始の直前で既に動いている**。
     - **おまけに FAQ 2（River Shrine 2枚＝2枚獲得）が自動で守られる理由**＝
       `maybeEnterNight`（engine.js:**11440**）が**必ず `t.phase = 'night'` にしてから**片付けへ進むので、
       **クリンナップ中の River Shrine 自身の獲得では `buyPhaseGained` が立たない**
       （このエンジンに `'cleanup'` フェイズは無く、phase は action / buy / night の3つだけ）。
     ※ 参考＝`gainWasBuyPhase`（engine.js:**8967**）は `triggerOnGain` のローカル変数で、
       「**獲得時点の**フェイズを捕まえてヴィラの phase 書き換えに負けない」ための仕組み。
       **River Shrine では使わない**（`t.buyPhaseGained` が既にその値で立っているため）。
  4. **購入フェイズが複数回あるときは「そのすべて」で獲得0であること**（FAQ 4・clarification 1）＝
     **旗を `END_ACTION_PHASE` でリセットしてはいけない**（`END_ACTION_PHASE` は1ターンに複数回走る＝
     ヴィラ／略奪の発進(Launch)／旭日の継続(Continue)。§0-28 の錯乱/嫉妬で踏んだ罠と同型）。
     ＝**`t.buyPhaseGained` をそのまま使えば満たされる／`t.bpGained` を使うと破れる**（上の 3.）。
  5. **クリンナップ中に獲得した River Shrine をその場でプレイすると、それも獲得する**
     （clarification 2＝**略奪の突貫(Rush)** との組み合わせ）。
     ＝**「クリンナップ開始時に一度だけ集計して終わり」は公式違反**。**再入型**にすること
     （突貫は1ターン1回なので無限ループにはならない）。上の 1.（`t.cleanupWaiting` の再入）と同じ網に乗る。
  6. **相手のターンにプレイした River Shrine は何も獲得しない**（clarification 3）＝**自分のクリンナップに紐づく**。
     ⚠ **略奪の "next time" 型持続（`armNextTime`／`fireNextTime`＝engine.js:**2181**/**2213**）と混ぜてはいけない**。
     あちらは「相手のターンに誘発し、相手の片付けで自分の場から捨てられる」まったく別の機構。
     River Shrine は**持続ですらない**（種別＝Action - Omen）＝普通に自分の片付けで捨てられる。
  7. **廃棄は0〜2枚の任意**（FAQ 3）＝**「やめる」ボタン必須**、**廃棄0枚でも獲得の窓は開く**
     （§0-30 で繁栄(Prosper)の獲得モーダルに「やめる」が無くて詰んだのと同型）。
     複数枚の同時廃棄なので `trashCardsTogether` を使うか1枚ずつかは要検討（公式の明示は無い。
     §0-29 A4 の [medium] 7＝歩哨だけが `trashCardsTogether` を使っている＝既存の横断挙動は「1枚ずつ」）。
     **新 pending 2種（廃棄／獲得）＝どちらも4点セット必須**
     （engine reducer／`PLAYER_ACTIONS`／CPU `decidePending`／UI `viewPendingModal`）。
     **廃棄側は任意＝辞退ボタン必須／獲得側は候補ゼロなら窓を開かない**（＝辞退ボタンは不要だが終端保証は書く）。
  8. **獲得は `costing up to [$4]` ＝ここは既存の `costUpTo(state, id, 4)` が正しい**
     （**サプライからの獲得**なので `gainableBase` を通してよい＝Poet と逆）。
     負債・ポーション費用・非サプライ・ロック中の分割山下段を弾く。**候補ゼロなら窓を開かない**。
  9. `river_shrine` の **id 衝突なし**（既存の略奪 `secluded_shrine`＝秘境の社 とは別id）。
     日本語名 `川の社` も衝突なし（「社」を含む既存名は `秘境の社` の1件のみ）。

---

### Rustic Village ／ 田舎の村　（$4・Action - Omen）

- **英語カード文（逐語）**：
  ```
  +1 [Sun]
  +1 Card
  +2 Actions
  You may discard 2 cards for +1 Card.
  ```
  （生HTML＝`<p>You may discard 2&#160;cards for <b>+1&#160;Card</b>.</p>` ＝**最終行の `+1 Card` も太字**）
- **日本語カード文（DO訳）**：
  ```
  +1 Sun
  +1 カードを引く
  +2 アクション
  +1 カードを引くために手札2枚を捨て札にしてもよい。
  ```
  （種別＝`アクション-前兆`。抽出の生値は `+1 カードを引く | ために手札2枚を捨て札にしてもよい。` ＝
  太字の `+1 カードを引く` が文中に埋まっている形。語順は日本語wiki のとおり）
- **区切り線**：**0本**。
- **版**：データ行1本のみ（`First edition`／`August 2024`）。`Errata` 出現数 0 → **機能エラッタ無し**。oldid 97624。
- **公式FAQ・裁定**：
  - Official FAQ（全1件）：
    1. `First the +1 [Sun] happens, which may trigger a Prophecy; then you get +1 Card, +2 Actions, and may discard 2 cards (including the one just drawn) for another +1 Card.`
  - Other rules clarifications：**節そのものが存在しない**。
  - Trivia（Preview）：`Rustic Village is simply a village that lets you do a little filtering. It's a poor exchange rate but you'll do it plenty.`
  - Trivia（Secret history）：`Unchanged; great from when it entered the file. Let's make that Prophecy happen.`
  - Illustrator＝Tetsu Kayama。
- **⚠ 実装で危ないところ**：
  1. **順序が FAQ で明示されている**＝`+1 [Sun]`（**Prophecy が有効化されうる**）→ +1 Card → +2 Actions →
     任意の「2枚捨てて +1 Card」。**Prophecy が先に有効化される**ので、Prophecy の内容次第で残りの解決が変わる。
     ＝`applyEffect` の先頭で `+1 Sun` を処理し、**同期的に完了させてから**残りを実行する（Poet ⚠3 と同じ）。
     ⚠ **前兆/予言の共通機構が先に要る**（バッチ依存）。
  2. **「ちょうど2枚」捨てる**（1枚では不可）＝**手札が1枚以下なら選択肢を出さない**
     （出すと「押しても何も起きない死に選択肢」または engine拒否×CPU提案の livelock）。
     **engine の窓を開く条件・受理・CPU の候補・UI のフィルタの4面**を同じ述語に揃えること
     （§0-29 A4 の [high] 12 の教訓＝受理側だけ締めるのが本プロジェクト最頻の事故）。
     ⚠ **民兵型の `discardDownEnter`（engine.js:3306）を流用してはいけない**＝あちらは
     「手札がN枚**になるまで**捨てる」。Rustic Village は**手札の枚数と無関係にちょうど2枚**。
     ⚠ 略奪の切り裂き魔・剣（`down` 指定）とも別物。**汎用の「手札からちょうどN枚を選ぶ」pending**として書く。
  3. **引いたばかりの1枚も捨ててよい**（FAQ 逐語 `including the one just drawn`）。
  4. **任意（`You may`）＝「やめる」ボタン必須**。**新 pending は4点セット必須**
     （engine reducer／`PLAYER_ACTIONS`／CPU `decidePending`／UI `viewPendingModal`）。
  5. **捨て札トリガーを必ず通す**（`triggerOnDiscard`・engine.js:**9628**＝坑道／村有緑地／忠犬／疲れ知らずの）。
     **順序＝捨てる → 捨て札トリガーを解決 → その後に +1 Card を引く**
     （§0-28 の羊飼い／§0-29 の砂漠の案内人／§0-30 の内気な・岩屋 で**4回踏んだ**同型の罠。
     逆順にすると坑道の金貨がリシャッフルに入らない）。
  6. **vanilla ボーナスは必ずヘルパを通す**（上の「この6枚すべてに効く横断規約」＝
     `+2 Actions` は `addActions(t, 2)`（engine.js:1845）／ドローは `draw()`（1866）。
     **`t.actions += n` を直接書かない**）。
  7. **`+1 [Sun]` は「山にトークンが残っていれば1個外す／尽きていたら何もしない」**
     （一般則 `"+1 [Sun]" does nothing else once all the tokens are removed.`）。
  8. `rustic_village` の **id 衝突なし**（既存の「〜村」19種＝`village`/`border_village`/`snowy_village` … とすべて別id）。
     日本語名 `田舎の村` も既存19種の「〜村」と衝突なし。

---

## ⚠ 出荷済みの実バグ候補

### [low・忠実性] `gainFromOutside` が `t.lastGainedAny` を更新しない＝行人(Wayfarer)のコストが動かない

- **場所**＝`js/engine.js:1921-1946`（`gainFromOutside`）。**`t.lastGainedAny` への代入が無い**。
  - 対して `gain()` は engine.js:**2007** で `if (state.turn && realId !== 'wayfarer') state.turn.lastGainedAny = realId;`、
    `gainLoot()` は engine.js:**2159** で `if (t) t.lastGainedAny = id;` と**両方とも更新している**。
  - **`lastGainedAny` への代入はファイル全体で この2箇所だけ**（`grep -n "lastGainedAny" js/*.js` で確認。
    読み出しは engine.js:380 の `cardCost` の行人分岐 1箇所）。
- **公式の根拠**＝移動動物園 `Wayfarer`＝`This costs the same as **the last other card gained this turn** (if any).`
  **廃棄置き場や闇市場デッキから取るのも「獲得」**（本アプリ自身、`gainFromOutside` の関数コメント
  engine.js:1917-1920 で「**供給の減算が無いだけで「獲得」なので、支配の振り分けと獲得トリガーは
  gain() と同じに揃える（片方だけ素通りさせない）**」と宣言している＝**`lastGainedAny` の欠落は
  その宣言に対する取りこぼし**であって意図的な除外ではないと読める）。
- **再現条件**（mix-all 限定）＝王国に **行人(wayfarer・移動動物園)** と、
  **`gainFromOutside` を呼ぶカード**のどちらかが同居していること。呼び出し元は engine.js の
  13071（略奪・**シャーマン**＝`DOM.KINGDOM_PLUNDER` の固定10種）／13440／14214／14645／14891／
  15276／15672／17345／20751（＝闇市場の購入・廃棄置き場からの獲得＝墓暴き／待ち伏せ／盗賊／リッチ／物色 ほか）。
  - 手順＝そのターンにまだ何も獲得していない状態で、**廃棄置き場から銅貨を獲得**する
    → **行人のコストは $6 のまま**（公式なら $0 になる）。
  - `gain()` 経由（＝普通のサプライからの獲得）では正しく動くので、**テストも通り続ける**。
- **影響**＝行人のコストが実際より高いまま／低いまま固定される。
  コストは**購入・獲得・廃棄・コスト参照のすべて**に効くので、
  「買えるはずの行人が買えない」「行人を廃棄したときの改築系の基準がずれる」等が起きうる。
  **`destrier`（デストリエ）は `t.gainedThisTurn` を見ており、そちらは `gainFromOutside` でも
  engine.js:1939-1942 で正しく更新される**ので無影響＝**行人だけが取りこぼされている**（＝非対称）。
- **修正案**＝`gainFromOutside` の 1938行（`else p.discard.push(cardId);`）の直後に、
  `gain()` と同じ1行を足す：
  ```js
  if (t && cardId !== 'wayfarer') t.lastGainedAny = cardId;
  ```
  ⚠ **`pIndex === t.active` のガードの外側に置くこと**（公式は "the last other card gained this turn"＝
  **誰の獲得でも記録する**。`gain()` も `gainLoot()` もガードの外に置いている）。
- **[推定]** 深刻度は **low**（mix-all でしか到達しない／保存則違反にもループにもならない忠実性のみ）。
  **旭日の Change は「コストを測り直す」カードで公式例が行人そのもの**なので、
  **Change を実装するなら同じコミットで直すのが自然**（直さないと、廃棄置き場から獲得する札と
  同居したときに Change の負債計算だけ静かにずれる）。

---

## 反映した [must]：2件／不採用：0件

| # | 内容 | 私の照合結果と反映先 |
|---|---|---|
| **M1** | River Shrine の「購入フェイズに獲得したか」は**新しい旗を作ってはいけない**＝既存の `t.buyPhaseGained` がある。`t.bpGained` を掴むと FAQ 4 に違反する | **正しい＝反映**。`grep -n "buyPhaseGained\|bpGained" js/engine.js` で 1941／2014-2015／2162（3経路とも `pIndex === t.active` ガードの中）／11424（探査＝`bpGained`）／11456（隠遁者＝`buyPhaseGained`）／12795（`END_ACTION_PHASE` で `bpGained = 0`）を実見。`maybeEnterNight`（11440）が phase を `'night'` にしてから片付けへ進むことも確認（＝FAQ 2 が自動で守られる理由）。→ **River Shrine ⚠3・⚠4 を全面書き換え** |
| **M2** | Shadow の可視性は「未確定」ではない＝へそくり(Stash)の前例が `maskStateFor` に実装済み。**自席の山札は `sort()` される**ので相乗りしないとオンラインだけ壊れる | **正しい＝反映**。engine.js:21142-21146（自席＝`rest = p.deck.filter(c => c !== 'stash').sort()`）／21156-21161（他席＝`stash` だけ晒す）／1141 直前のコメント「へそくりは裏面が異なる＝山札内の位置は公開情報」を実見。**初版の「本アプリは裏面を `'back'` の一括トークンで扱う」は事実と違った**。Preview 冒頭の `I bet you never thought I'd revisit Stash.`（`m_k4_shadow_cost.txt` 94行）も設計上の裏付け。→ **Alley ⚠8 を「未確定」から「Stash に相乗りする」へ書き換え、未確定リストから削除** |

**不採用＝0件**（2件とも自分でコードを読んで裏が取れた）。

## 拾った [nice]：15件（16件中）

| # | 内容 | 反映先 |
|---|---|---|
| N1 | oldid 6件を数字で固定 | 「この章の作り方」＋各カードの「版」行 |
| N2 | `Other rules clarifications` は rulebook に無い＝wiki 独自（Change ⚠2 の根拠が1本足） | 一般ルール節に専用の但し書き＋Change/River Shrine の ORC 見出しに注記 |
| N4 | rulebook のコスト比較ブレット2本（`Debt と [$] は比較できない`／`implicit [0D]`／`cannot take Debt for no reason`） | 一般ルール節に追加＋Change ⚠1（位置づけ）・⚠3（負債0の根拠）に接続 |
| N5 | 動的コスト札の3つ目＝`destrier`（engine.js:383＝獲得するたびに安くなる） | Change ⚠2 に具体例つきで追加 |
| N6 | Shadow の裏面テキスト逐語 | 一般ルール節に追加（**私も `_alley.jpg`／`_ninja.jpg` を実見して2枚同一文を確認**）＋Alley ⚠7 |
| N7 | Change の記号復元が3行目だけ置換語のまま | 日本語カード文を統一（`〈コイン〉の差に等しい数だけ`） |
| N8 | 「HJ版が違う6枚に含まれない」の裏取りが弱い（マーカー取りこぼし）／Japanese スキャン画像6枚が実在 | 「この章の作り方」に but 書き＋closable な手順を明記（`raw_g3/raw_*.html` で6/6 実在を確認） |
| N9 | engine.js の行番号が1〜15行ずれ | **全行番号を実測で打ち直し**＋冒頭に「関数名で grep せよ」の注記 |
| N10 | 新種別の登録メモに `Omen` が無い／枠スキンは不要 | Alley ⚠5 に4箇所（carddata.js:115-116／ui.js:124-129／integrity.test.js:120-121）＋`frameType`（carddata.js:100-110）を素通りする旨 |
| N11 | River Shrine の ⚠ に `+1 [Sun]` の項目が無い／3枚のバッチ依存 | **River Shrine ⚠0 を新設**＋Poet ⚠3・Rustic Village ⚠1 にも「機構が先に要る」を追記 |
| N12 | `addCoins`/`addActions`/`draw` の横断規約が Rustic Village にしか無い | **6枚共通の表として一般ルール節に新設**＋Rustic Village ⚠6 から参照 |
| N13 | `takeDebt(state, pIndex, cardId)` はカードidから読む＝任意個数を渡せない | **Change ⚠4 を新設**（`change` に `debt` 欄が無いので黙って0＝静かなバグ／支配の振り分けは 1912行に倣う） |
| N14 | Shadow の「一番下へ」の挿入点＝`p.fatedIds` 分岐（1254-1263）の bottom 側／**concat（1265）の前**／`placeStash` は後 | Alley ⚠6 にコード断片つきで具体化 |
| N15 | 航海(Voyage)／将軍(Warlord) を未確定リストに載せる | Alley ⚠5 に `notePlayFromHand`(8291)／`canPlayHandCard`(8297) を明記＋**未確定リストの4件目**に追加 |
| N16 | CPU が Shadow を山札から使わない／`PLAY_ACTION` に `from:'deck'` か新 action かを決める | Alley ⚠5 に2項目として追加（`PLAYER_ACTIONS`＝engine.js:21249） |

**拾わなかった＝N3（Preview 引用が3枚ぶん落ちている）を部分的に不採用**。
Alley `Alley is a little filtering that waits until you need it.` と
Poet `Poet is one of those sometimes-Labs, …` は**実装に一切効かない紹介文**なので、
分量を増やすだけと判断して見送った（Poet 側は Trivia 欄に1行だけ入れた）。
**ただし Ninja の `it draws itself` は採用**＝⚠4（山札から抜いてから引く）の理由づけになるため、
Preview 逐語ごと Ninja の Trivia に追加した。
Change / River Shrine の Secret history の前半（`The initial card didn't have the "no [D]" clause…`／
`Initially it gave you +2 Cards if you trashed differently named cards.`）も**採用**（設計意図が読めるため）。

## 未確定のまま残したもの（断定しない）：3件

1. **River Shrine が再演（玉座/無謀な/旗艦/大名）で獲得回数を増やすか**（一次資料に明言なし）→
   増築 `t.improvePlays` と同じ「プレイ回数で数える」を**推奨**するが、これは類推。
2. **Change / River Shrine / Poet / Rustic Village の日本語カタログ文の改行位置と記号表記**
   （`Sun`／負債／コインのアイコンをどう書くか）→ 抽出器がアイコンを文字置換しているため、
   **日本語wiki のページを直接見て最終確認**すること。日の出トークンは**日本語wiki も `Sun` と英字のまま**。
3. **【N15 で追加】Shadow を山札からプレイしたとき、航海(Voyage)の「手札から3枚まで」に数えるか／
   将軍(Warlord)が止めるか**。`PLAY_ACTION` は `notePlayFromHand`（engine.js:8291）で**手札からの使用**を数え、
   `canPlayHandCard`（8297）が止める。Shadow は「手札にはない」（Shadows 節の最終ブレット＝Alley ⚠1 で確定）
   ので、**航海の3枚に数えない／将軍が止めない**と読むのが一貫するが、**一次資料に明言は無い**。
   実装者が最初に踏む分岐なので、機構担当群で先に決めること。

※ **初版で未確定だった「Shadow の位置が相手からも見えるか」は M2 により解消**
（＝Stash の既存実装に相乗りする＝**公開情報として扱う**）。

---

## 枚数の検算

- **担当＝6枚**（Alley / Change / Ninja / Poet / River Shrine / Rustic Village）／**書いた＝6枚**＝**6/6 一致**。
- **コスト**：全6枚とも `$4`（負債コスト・ポーション費用は1枚も無い）＝**6**。
  ※$4 の**イベント** `Sea Trade`（海上交易）は王国カードではないので**この章に含めない**（正しく除外）。
- **種別**：`Action - Shadow` 1（Alley）＋`Action - Attack - Shadow` 1（Ninja）＋`Action` 1（Change）
  ＋`Action - Omen` 3（Poet / River Shrine / Rustic Village）＝**6**。
  → **新種別2つが登場**＝`Shadow`（影）2枚・`Omen`（前兆）3枚。
  → **登録は4箇所×2種別＝8箇所**（carddata.js の JP/EN・ui.js の TYPE_JP・integrity.test.js の JP/EN）。
    **枠スキンの新設は0件**（`frameType` が Ninja→`attack`／他4枚→`action` に落とす）。
- **区切り線**：1本＝2枚（Alley / Ninja＝どちらも Shadow の一文の前）／0本＝4枚 ＝ 2+4＝**6**。
- **版**：6枚すべて **English versions のデータ行1本のみ**（`First edition`・`August 2024`）／
  6ページとも `Errata` 出現数0 ＝ **機能エラッタ 0/6**。
  oldid＝96774／97556／97557／97628／97626／97624 ＝**6件**（起草・検証・確定の3docで一致）。
- **FAQ 件数**：Alley 2／Change 4／Ninja 2／Poet 2／River Shrine 4／Rustic Village 1 ＝ Official FAQ 計**15件**。
  Other rules clarifications ＝ Change 3／River Shrine 3、他4枚は**節そのものが存在しない** ＝ 計**6件**。
- **新 pending の見積り**：Alley 1（捨て・強制）／Change 2（廃棄・獲得）／Ninja 0（既存 `discard_down` を流用）／
  Poet 0（自動判定）／River Shrine 2（廃棄・獲得）／Rustic Village 1（2枚捨て・任意）＝**6種**。
  **全部に4点セットが要る**（engine reducer／`PLAYER_ACTIONS`／CPU `decidePending`／UI `viewPendingModal`）。
  **「やめる」ボタンが要るのは2種**（River Shrine の廃棄・Rustic Village の2枚捨て＝どちらも `You may`）。
- **id 衝突**：`alley` / `change` / `ninja` / `poet` / `river_shrine` / `rustic_village` ＝
  既存761枚（`DOM.CARDS` 560＋`DOM.LANDSCAPES` 201）と機械照合して**0件**。
- **日本語名衝突**：小路／交替／忍者／歌人／川の社／田舎の村 ＝ **0件**。
- **本章で挙げた出荷済みの実バグ候補**＝**1件**（`gainFromOutside` が `t.lastGainedAny` を更新しない）。


<!-- ===== m4_kingdom_5.md ===== -->

## 第4章 王国 $5（8枚）

**確定版 rev.2**（`g4_kingdom_5.md`＋敵対検証 `v_k5.md`＋日本語 `g0_jp_pairs.md` を統合し、
さらに完全性批評 `c_k5.md` の指摘を**1件ずつ一次資料とコードで取り直して**反映した）。
作成日: 2026-08-16 / 出力: `C:/tmp/risingsun_research/m4_kingdom_5.md`

### この章で使った一次資料
- 英語wiki（カード文・FAQ・Versions の正本）＝`node tools/wikidirect.js`。
  **本担当が独立に取り直したのは Gold Mine / Ronin の2ページ**（生HTML＝`C:/tmp/risingsun_research/raw_m_k5/`）＝
  収集doc・検証doc の記述と**逐語・`<hr>` 本数とも一致**。
  残り6枚は収集・検証の2エージェントが独立に取得して逐語一致しているので再取得せず、
  **`<hr>` の機械検算だけ本担当が8ファイル全部について実行し直した**（下表）。
- RGG 公式ルールブック（2024年8月）＝`rulebook.txt`。
  **本 rev.2 では推奨セット（p.11〜12）と全15予言の Card Clarification を本担当が直読みした。**
  ⚠ pdftotext 版は `[$2]` `[8D]` 等の**記号が画像なので消える**。記号入りの Debt 例文は `_expansion.txt`（英語wiki 総論ページ）で補う。
- **日本語wiki（`wikiwiki.jp/dominiondeck`）＝日本語名・日本語カード文の正本、かつ「詳細なルール」節に英語wikiに無い裁定がある**。
  本担当が `python tools/jpwiki.py 狐` をライブで叩き直し（`m_k5_jp_kitsune.txt`・最終更新 2026-07-20）、
  残り7枚は `jp/*.txt`（別群が取得済み）の該当ページを読んだ。
- **本アプリのコード実測**＝`js/engine.js` / `js/cards.js` / `server/gameServer.js`（作業ツリー＝HEAD `d6cf76d` ＋未コミット差分）。

> ⚠ **本章はコードの位置を原則「シンボル名」で書く**（`takeDebt` / `normalizeChoices` …）。
> 行番号は**作業ツリーで日々ずれる**（`d6cf76d` と未コミット差分だけで `REMODEL_TRASH` は 13870→**13888** に動いた）。
> 参考値として現時点の実測行を括弧で添えるが、**必ず `grep -n "<シンボル名>" js/engine.js` で引き直すこと**。

---

### 共通事項（8枚に共通。各カードでは繰り返さない）

- **版＝8枚とも `First edition / August 2024` の1刷のみ＝機能エラッタ 0件**。`Not printed yet` 0件・`errata` の語 0件
  （＝略奪の Journey のような「未印刷エラッタでどちらの版を採るか」問題は**この8枚には存在しない**）。
  Versions 表の列構成は `Print | Digital | Text | Changes | Announced | Printed`（`Announced`＋`Printed` は
  `colspan="2"` で `August 2024` の1セル）＝8枚とも同一。
- **英語wiki の `Other rules clarifications` 節は8ページとも存在しない**（取れなかったのではなく節が無い）。
  ＝**カード個別の追加裁定は「日本語wiki の詳細なルール」にしか無い**。本章はそれを拾ってある。
- **日本語カード文＝Dominion Online 訳**（日本語wiki が各ページに `(※日本語訳はDominion Onlineより)` と明記）。
  本プロジェクトの方針（略奪の決定3＝DO訳で統一）どおり。
  **ホビージャパン印刷版と差異が判明しているのは 川船／好機到来／米／絵師／進歩／盛大な取引 の6枚で、この8枚には1枚も含まれない**。
- **id 衝突ゼロ／日本語名の衝突ゼロ**（実測＝`DOM.CARDS` 560＋`DOM.LANDSCAPES` 201＝**761枚**と機械照合）。
  `gold_mine` `imperial_envoy` `kitsune` `litter` `rice_broker` `ronin` `tanuki` `tea_house` ／
  金山・勅使・狐・駕籠・札差・浪人・狸・茶屋。

#### `<hr>`（区切り線）の機械検算＝8ファイル全部を実測（`raw_g4/*.html`）

| ファイル | ページ全体の `<hr` | うちカード文セル内 | 判定 |
|---|---|---|---|
| Gold Mine | 0 | 0 | 区切り線 **無し** |
| Imperial Envoy | 0 | 0 | **無し** |
| Kitsune | 0 | 0 | **無し** |
| Litter | 0 | 0 | **無し** |
| Rice Broker | 0 | 0 | **無し** |
| Tea House | 0 | 0 | **無し** |
| Ronin | 4 | **1** | **1本**（残り3＝Versions表／French行／German行） |
| Tanuki | 4 | **1** | **1本**（同上） |

カード文セル内の判定は `<hr style="width:66%;margin-left:17%;text-align:center;" />` の出現数で数えた
（wiki のカード文用区切り線はこのスタイル固定）。**webp を焼くときはこの表を根拠にできる**。

#### 近似 id・近似名（機能影響なし。§0-24 の全文検索でのUX上の既知点）
- `gold_mine`（金山）↔ `mine`（**鉱山**）／`silver_mine`（**銀山**・略奪）／`abandoned_mine`（**廃坑**・暗黒時代）
- `imperial_envoy`（勅使）↔ `envoy`（**使者**・プロモ）　※g4 の「特使」は誤り（`js/cards.js` 実測）
- `rice_broker`（札差）↔ `broker`（**仲買人**・同盟）
- `tea_house`（茶屋）↔ `poor_house`（**救貧院**・暗黒時代）／`warehouse`（**倉庫**）
  ※g4 の「貧民街」は誤り（`poor_house` の名は「救貧院」・`js/cards.js` 実測）

#### 公式推奨セット（rulebook p.11〜12・本担当が直読み）＝**全32本**

**内訳＝`Rising Sun alone` 2本 ＋ 他拡張との組み合わせ 30本**（15拡張 × 2本ずつ）。
⚠ **収集doc／旧 rev.1 の「推奨セットは2本／Tanuki だけどちらにも入らない」は誤り**（rev.1 の「新たに確定させた事項 #9」は撤回する）。
`Tanuki` は **7本**に入っており、この8枚はいずれも6〜7本に登場する。

| カード | 登場する公式推奨セット | 本数 |
|---|---|---|
| Gold Mine | Dawn of an Era／Spring Forward／Solving the Puzzle／Winter Solstice／Dark Corners／Mountain of Money／Buried in Booty | 7 |
| Imperial Envoy | Dawn of an Era／Island People／Fast Track／Autumn Harvest／Paperwork／Wanderers | 6 |
| Kitsune | Dawn of an Era／Invasion Fleet／Lazy Mischief／Hero's Journey／Swept Clean／Mountain of Money | 6 |
| Litter | Heading East／Lazy Mischief／River Trade／Pandemic／Wanderers／Dark Corners／Shiny Things | 7 |
| Rice Broker | Dawn of an Era／Invasion Fleet／Pandemic／Swept Clean／Mountain of Money／Expert Traders／Buried in Booty | 7 |
| Ronin | Dawn of an Era／Money to Burn／Solving the Puzzle／Swift Hands／Distant Hordes／Wanderers／Alternatives | 7 |
| Tanuki | Spring Forward／Cold Calculation／From the Shadows／Paperwork／Wanderers／Dark Corners／Buried in Booty | 7 |
| Tea House | Heading East／Cold Calculation／Winter Solstice／Priceless Rice／Fresh Start／Feverish Crafting | 6 |

**⚠ ここが最重要**＝rev.1 は危険な相互作用を「mix-all で到達しうる」と書いていたが、**実際は公式推奨セットで必ず同居する**。
回帰テストの狙い所は「mix-all で運が良ければ」ではなく「**公式セット `<名前>` を出したら毎回通る**」に格上げできる。

| 同居 | 公式推奨セット | この章のどこに効くか |
|---|---|---|
| **Kitsune × Kind Emperor**（予言＝最後の Sun を除いた瞬間に「アクション1枚を手札に獲得」） | `Dawn of an Era`（Rising Sun 単独） | Kitsune ⚠1／Tea House ⚠1（**+1 Sun の途中で獲得＝pending が立ちうる**） |
| **Kitsune / Rice Broker × Divine Wind**（予言＝王国10山を総入れ替え） | `Swept Clean` | Kitsune ⚠1／Tea House ⚠1（**Fresh Start では Tea House × Divine Wind**） |
| **Rice Broker × Crown**（アクションかつ財宝＝2+5＝7枚引く） | `Swept Clean` | Rice Broker ⚠1 |
| **Rice Broker × Enlightenment**（財宝はすべてアクション） | `Expert Traders` | Rice Broker ⚠2（`isActionFor` の必要性） |
| **Gold Mine × Change**（負債を持っていれば +$3） | `Dawn of an Era` | Gold Mine ⚠3（**負債だけ取る**選択に実戦的意味がある） |
| **Gold Mine × Growth**（財宝を獲得したら安いカードを獲得・**強制・連鎖する**） | `Buried in Booty` | Gold Mine ⚠4（金貨の獲得トリガー＝入れ子の獲得） |
| **Gold Mine × Bureaucracy**（$0でないカードを獲得したら銅貨を獲得） | `Mountain of Money` | 同上 |
| **Tanuki × Throne Room**（**山札の Shadow を玉座で使う**） | `Spring Forward` | Shadow 共通ルール（`canPlayHandCard` の3面修正） |
| **Tanuki × Flourishing Trade**（全カードのコストが $1 下がる） | `Wanderers` | Tanuki ⚠4（コスト参照は廃棄の**後**） |
| **Tea House / Tanuki × Harsh Winter**（自分のターンの獲得で山のコイントークンを取る／置く） | `Cold Calculation` | 獲得トリガーの列に足す |
| **Litter × Possession**（負債を負うのは支配者） | ― （公式セットには無い＝mix-all 限定） | Litter ⚠3 |

---

### Gold Mine ／ 金山  （$5・アクション）

- **英語カード文（逐語）**：
  ```
  +1 Card
  +1 Action
  +1 Buy
  You may gain a Gold and get +4D.
  ```
  （生HTML＝`<b>+1&#160;Card</b><br /><b>+1&#160;Action</b><br /><b>+1&#160;Buy</b><p>You may gain a Gold and get <b>+[4D]</b>.</p>`
  ＝上3行は `<br>` 改行、4行目は `<p>` の段落。`[4D]` は負債4の六角トークン記号）
- **日本語カード文（DO訳）**：
  ```
  +1 カードを引く
  +1 アクション
  +1 購入
  金貨1枚と +<4> を獲得してもよい。
  ```
  （`<4>` ＝負債4の記号。⚠ **DO訳は「金貨1枚と +4負債 を*獲得*してもよい」と書く**＝日本語だけ読むと
   「負債も獲得＝良いもの」に読めるが、原文は `gain a Gold and **get** +4D`＝負債は負う側。カタログ文はDO訳のままでよいが、
   **実装者が日本語だけを読んで方向を取り違えないこと**）
- **区切り線**：**無し**（実測＝生HTMLの `<hr` は0）
- **版**：`First edition / August 2024` の1行のみ＝機能エラッタ無し
- **公式FAQ・裁定**：
  - 英語wiki Official FAQ ／ RGG Card Clarifications（逐語同一・2文）：
    > You can gain a Gold even if you already have D; see the Debt section.
    > You can't gain a Gold without taking 4D.
  - **日本語wiki「詳細なルール」（英語wikiに無い裁定・3件）**：
    > 先にカードを1枚引いてから、金貨を獲得するかどうかを決める。
    > **サプライに金貨がない場合でも、金貨1枚と4負債を得る選択をしてもよい。その場合、金貨は得られないが4負債を得る。**
    > 金山の効果は、厳密には①(キャントリップ効果+1購入を得たあとに)金貨を獲得する→②4負債を得る、という処理である。
    > (負債を処理していない際に)①の処理で金貨を獲得したことに誘発し、交替を使用した場合は、まだ②の処理発生前なので負債は得ていないことに注意。
  - RGG ルールブック Debt 節（この判断に直接効く一般則）：
    > Players cannot take [D] for no reason.
- **⚠ 実装で危ないところ**：
  1. **「+4D」は on-play の負債＝カードの *コスト* ではない**。既存 `takeDebt(state, pIndex, cardId)`（実測 `js/engine.js:1908`）は
     **`C()[cardId].debt`（コスト欄の負債）を読む**ので、Gold Mine（`cost:5, debt:0`）に渡すと **0 で何も起きない**。
     → **金額を引数で受ける on-play 版を新設する**（Imperial Envoy / Litter も同じ）。
     既存 `takeDebt` の**支配(Possession)の振り分け**（`const who = (t && t.possessedBy != null && pIndex === t.active) ? t.possessedBy : pIndex;`）は
     **そのまま流用すること**（Litter の項の公式記述と一致する）。
  2. **「You may」は「金貨獲得」と「+4D」の *セット* に掛かる**（FAQ＝`You can't gain a Gold without taking 4D`）＝
     **「金貨だけもらって負債は断る」を選ばせてはいけない**。二択（やる／やらない）の**1つの窓**にする。
  3. **⚠ 収集docの推奨（「金貨の山が空なら窓を開かない」）は採らないこと**。
     日本語wiki の裁定＝**サプライに金貨が無くても「やる」を選べ、金貨は得られず4負債だけ負う**。
     一見すると rulebook の `Players cannot take [D] for no reason.` に反するように見えるが、**反しない**＝
     この一文は「理由もなく勝手に負債を取る」ことの禁止であって、**カードの指示に従った結果その一部が実行できなかった**場合は
     ドミニオンの一般則（できるところまでやる）どおり残りが実行される。
     **そして「負債だけ取る」には実際に強い動機がある**＝同じ拡張の **交替(Change)＝「負債を持っている場合、+$3」**。
     **公式推奨セット `Dawn of an Era` は Gold Mine と Change を同居させている**＝この選択は出荷セットで到達する正当な戦術。
     → **金貨の山が空でも窓を開く**（＝本アプリの「候補ゼロなら窓を開かない」定石をここに適用しない。
     この窓の「候補」は金貨ではなく**やる／やらないの2択**なので、そもそもゼロにならない）。
  4. **処理順は ①（+1カード+1アクション+1購入の後に）金貨を獲得 → ②+4負債**。
     ＝**金貨の獲得トリガーが走る時点では、まだ負債を負っていない**。
     **この順序が実際に観測できる経路は公式推奨セットにある**：
     - **`Buried in Booty` の Growth**＝`When you gain a Treasure, gain a cheaper card.`（rulebook：**強制・連鎖する**）
       ＝金貨の獲得が**入れ子の獲得**を起こす。
     - **`Mountain of Money` の Bureaucracy**＝`When you gain a card that doesn't cost $0, gain a Copper.`
       ＝同じく入れ子の獲得。
     - 既存カードの獲得トリガー＝望楼／交易商人／ティアラ／庭師／`Cold Calculation` の Harsh Winter（山のコイントークン）。
     ＝**`gain()` が獲得トリガーで `state.pending` を立てうる**ので、**②の +4負債は「pending を立てたら後で」ではなく、
     `gain()` の戻りで**その場で**負わせる**（負債は非対話なのでキューに積む必要はない）。
     ⚠ 日本語wiki が挙げる例（「金貨を獲得したことに誘発し、交替を使用した場合」）は、
     **金貨の獲得が交替の使用を誘発する経路をこちらで再構成できなかった**（該当しそうな既存カードが見当たらない）。
     **確定として採るのは処理順（①→②）だけにすること**＝例示そのものは根拠に使わない。
  5. **「先に1枚引いてから、金貨を獲得するか決める」**＝**ドロー（＝リシャッフルが起きうる）を先に済ませてから窓を開く**。
     `applyEffect` の case で `draw` → `addActions` → `t.buys += 1` → その後に pending を立てる、という順を守る。
  6. **負債を持っていても実行できる**（FAQ 明記）。負債は「購入」だけを止める（獲得は止めない）＝
     **この獲得を購入扱いのゲート（`canBuyCard` / `p.debt > 0` の拒否）に掛けないこと**。
  7. **`+1 Buy` を持つ**＝旭日のイベント10種の購入と噛み合う。既存の `t.treasuresLocked`（購入したらそのターンは財宝を出せない）の
     挙動には影響しない。
  8. 新 pending なので **4点セット必須**＝engine reducer ＋ `PLAYER_ACTIONS` ＋ CPU `decidePending` ＋ UI `viewPendingModal`。
     **窓は「やる／やらない」の2択なので候補ゼロにならない＝辞退ボタンは「やらない」がそのまま兼ねる**（詰みの心配はない）。
     CPU は「金貨を取ると負債4」を評価する必要がある（無条件に取ると終盤に購入が止まる）。

---

### Imperial Envoy ／ 勅使  （$5・アクション）

- **英語カード文（逐語）**：
  ```
  +5 Cards
  +1 Buy
  +2D
  ```
  （生HTML＝`+5 Cards<br />+1 Buy<br />+[2D]`＝3行とも `<br>` 改行）
- **日本語カード文（DO訳）**：
  ```
  +5 カードを引く
  +1 購入
  +<2>
  ```
- **区切り線**：**無し**（実測 `<hr` 0）
- **版**：`First edition / August 2024` の1行のみ＝機能エラッタ無し
- **公式FAQ・裁定**：
  - 英語wiki Official FAQ ／ RGG Card Clarifications（逐語同一）：
    > This works even if you already had D; see the Debt section.
  - 日本語wiki「詳細なルール」＝**カード固有の裁定は無い**（「負債全般のルールは専用ページを参照」のみ）。
  - Secret history：**名前以外は開発中から一切変更なし**（当初 "Chinese Envoy"）＝版違いを疑う必要がない裏付け。
- **⚠ 実装で危ないところ**：
  1. Gold Mine と同じ **on-play の負債**＝`takeDebt` のコスト参照版では 0 になる。**金額引数版を通すこと**。
  2. **強制**（"may" が無い）＝窓を開かず自動で負う。
     ＝**新しい pending は要らない＝4点セットは不要**（`applyEffect` の case を足すだけ）。
     `PLAYER_ACTIONS` にも CPU `decidePending` にも UI `viewPendingModal` にも触らない。
  3. **記載順（+5 Cards → +1 Buy → +2D）を守る**。+5カードで**リシャッフルが起きうる**ので、負債を先に加算すると
     「シャッフル時に何かする札」（同盟の占星術師団／メイソン団、略奪の運命の(Fated)、旭日の Shadow）と混ざったときに差が出る。
  4. `Royal Blacksmith`（帝国・王室の鍛冶屋・+5カード）と並ぶ最大級のターミナルドロー＝CPU の `GAIN_ORDER` はその近辺へ。

---

### Kitsune ／ 狐  （$5・アクション－アタック－前兆(Omen)）

- **英語カード文（逐語）**：
  ```
  +1 Sun
  Choose two different options: +2 Actions; +$2; each other player gains a Curse; gain a Silver.
  ```
  （生HTML＝`<b>+1[Sun]</b><p>Choose two different options: <b>+2&#160;Actions</b>; <b>+[$2]</b>; each other player gains a Curse; gain a Silver.</p>`
  ＝1行目が `+1 Sun`、そこから `<p>` の段落。選択肢の区切りはセミコロン。改行は入らない）
- **日本語カード文（DO訳）**：
  ```
  +1 Sun
  次のうち異なる2つを選ぶ：
  「+2 コイン」：「+2 アクション」：「他のプレイヤーは全員、呪い1枚を獲得する」：「銀貨1枚を獲得する」
  ```
  - ⚠ **日本語wiki の訳文は選択肢の並びが英語原文と入れ替わっている**（訳は `+2 コイン` が先、原文は `+2 Actions` が先）。
    **同じページの英語列は `+2 Actions; +2 Coins; …` で正しい**＝**JP側だけが入れ替わっている**（ライブで再取得して確認・最終更新 2026-07-20）。
    実物のDO日本語カードがどちらの並びかは**⚠未確定**。
    **ただし実装上は迷う余地がない**＝FAQ が「**カード記載順**に解決する」と定めており、その「記載順」は英語原文の順。
    → **カタログの日本語文は英語原文の順（+2 アクション → +2 コイン → 呪い → 銀貨）に並べ替えて焼くこと**
    （区切りも `：` ではなく他カードに合わせた表記に正規化する）。
- **区切り線**：**無し**（実測 `<hr` 0）
- **版**：`First edition / August 2024` の1行のみ＝機能エラッタ無し
- **公式FAQ・裁定**：
  - 英語wiki Official FAQ ／ RGG Card Clarifications（逐語同一）：
    > First the +1 Sun happens, which may trigger a Prophecy; then you choose two different options, and do them in the order listed.
  - **日本語wiki「詳細なルール」（英語wikiに無い裁定・4件）**：
    > 他プレイヤーが、【アタック誘発リアクション】でリアクションするのは、狐使用者が使用する効果を選択する**前**である。
    > そのため狐使用者は、他のプレイヤーのリアクションの有無＆その処理結果を確認した後に、使用する効果を選択することになる。
    > 狐の+1Sunより後の効果は「選択効果」なので、長老の対象となる。
    > 選んだ能力は上から順に解決する。
    > 【カメレオン化狐】で「+2 コイン」「銀貨1枚の獲得」を選択した場合、先にカードを2枚引いてから銀貨1枚を獲得する、という処理になる。
  - Preview（Donald X. Vaccarino, *Rising Sun Previews 5*, August 2024）：
    > Kitsune is another Omen. It's the fabled Witch that can do something else when the Curses run out.
    ＝**呪いの山が尽きても他の選択肢で機能する**（＝呪いの残量で選択肢を消してはいけない）。
- **⚠ 実装で危ないところ**：
  1. **「+1 Sun が最初」＝この解決の途中で Prophecy が有効になりうる**（FAQ 明記）。
     `applyEffect` の case **冒頭**で Sun を1個減らし、**最後の1個なら Prophecy をその場で有効化してから**、
     choose-two の pending を開く。Sun が尽きた後の「+1 Sun」は**完全な空振り**（何も起きない・窓も開かない）。
     **⚠ 素直に「Sun → Prophecy 有効化 → 残りを解決」と1つの関数で書くと壊れるケースが2つある。どちらも公式推奨セットで到達する。**
     - **(a) Kind Emperor（`Dawn of an Era`＝Kitsune と同居する Rising Sun 単独セット）**
       ＝`At the start of your turn, and when you remove the last Sun: Gain an Action to your hand.`
       rulebook 逐語＝`When the last Sun is removed, this applies immediately, **in the middle of resolving the Omen**,
       and only the player who removed the Sun gains an Action then.`
       ＝**Sun を除いた瞬間に「獲得」が起き、その獲得トリガー（望楼／交易châ商人／Growth／Harsh Winter 等）が
       `state.pending` を立てうる**。
       → **Omen の残りの効果（Kitsune の choose-two ／ Tea House の +1カード+1アクション+$2）は、
       その pending が閉じてから続ける「再開網」が要る**。既存の同型＝`t.storytellerResume`（語り部）／
       `t.galleySetAside`（王家のガレー船）／`t.fhResume`（一等航海士）＝いずれも `reduce()` 末尾で
       `!state.pending` を見て再開する形。**Omen 用に `t.omenResume` を1つ作って両カードで共有するのが素直**。
       ⚠ これは**Omen 全体（旭日の Omen 全種）に効く設計判断**なので、機構の群と必ず突き合わせること。
     - **(b) Divine Wind（`Swept Clean`＝Kitsune・Rice Broker と同居／`Fresh Start`＝Tea House と同居）**
       ＝`When you remove the last Sun, remove all Kingdom card piles from the Supply, and set up 10 new random piles.`
       rulebook 逐語（抜粋）＝
       > The 10 Kingdom card Supply piles used this game are removed, as well as an 11th pile if something added one
       > (such as Young Witch's Bane pile). Ruins, Potions, and Platinum and Colony are not removed. …
       > **The removed piles are gone; they no longer count as empty piles if empty, and cards can't be returned to those piles.**
       > Tokens on the removed piles are no longer on them … **Search (from Plunder) does not trigger when piles are removed.**
       ＝**Kitsune の解決の途中で王国10山が丸ごと入れ替わる**。
       ＝choose-two の窓は**入れ替わった後のサプライ**を見て開く／**Kitsune 自身の山が消えた状態で場に残る**。
       **救い＝呪いと銀貨は基本カードなので消えない**（Kitsune の4択はどれも生き残る＝選択肢が消えて詰むことはない）。
       山の消滅そのものの扱い（`emptyPileCount` / `returnToPile` / 山トークン / 保存則 tally / 略奪の Search）は
       **機構の群（予言）の担当**＝ここでは「Omen の解決中に起きる」ことだけ記録する。
  2. **⚠ アタックのリアクション窓は「選択より前」に開く**（日本語wiki の裁定・上記）。
     ＝**呪いを選ばなかった場合でも窓は開く**（＝収集docが「未確定」としていた点はこれで決着）。
     一般則（アタックカードを使用した時点で堀を公開できる）とも整合する。
     → 実装形は **`attackWindowEnter(state, source, queue, after)`（実測 `js/engine.js:10214`）と同じ形**
     （人狼のドロー側／迫害者のインプ側で使っている「アタックを使用したことだけに反応する窓」）。
     ⚠ **ただしそのままでは足りない**＝`attackWindowEnter` は
     `queue = (queue || []).filter((v) => !attackImmune(state, v));` で免疫者を落とすだけで**誰が免疫かを記録しない**。
     狐は**呪いの配布が選択の後**なので、**免疫者を記録する器が要る**＝
     **`markLingerImmune(state, source, card, victim, rid)` と予約の `immune[]`（呪いの森・沼の妖婆と同型・実測 `js/engine.js:3777`）を真似て、
     choose-two の pending に `immune: []` を持たせる**こと。
  3. **`ATTACKS` への登録が要る**（`const ATTACKS = {` の表・実測 `js/engine.js:2805`／`attack_window` の行は 2873）
     ＝`onMoat` で「この被害者を飛ばして次へ＋`immune` に記録」。
     **`MOAT_REVEAL` だけでなく略奪の `SHIELD_REVEAL`（盾）も同じ窓を通る**
     （`isAttackReactPending(pd)` ＝ `return !!a.embedded || pd.stage === 'react';` を実測で確認）。
     ⚠ **UI 側は `reactOptions` に加えて embedded 型モーダルにも分岐が要る**（略奪 P1b で「engine と CPU は受理するのに
     人間だけが盾を使えない」実バグを踏んだ形）。CPU は `immuneReveal(p)`（`js/cpu.js:142`）を通すこと
     （素の `p.hand.includes('moat')` を書かない）。
  4. **choose-two（4択から異なる2つ）の解決は必ず「カード記載順」**（FAQ＋日本語wiki の両方が明記）＝プレイヤーが選んだ順ではない。
     順＝`+2 Actions → +$2 → 各相手が呪い → 銀貨獲得`。
     **⚠ 既存の choice 機構は「異なる2つ」をそのままでは受理しない（実測）**：
     ```js
     function normalizeChoices(pd, action, kind) {
       const order = ELDER_CHOICE_ORDER[kind] || [];
       let picks = …;
       picks = picks.filter((c, i) => picks.indexOf(c) === i);
       if (!picks.length || picks.length > (pd.elder ? 2 : 1)) return null;   // ← ここ
     ```
     ＝**選択数の上限が `pd.elder ? 2 : 1` にハードコードされている**（同盟の choose-**one** 専用）。
     Kitsune は**基本で2つ**（長老つきなら3つ）なので、**このまま載せると `normalizeChoices` が `null` を返して
     action が engine に拒否され、pending が閉じない＝人間が詰む／CPU が livelock**（本プロジェクトが何度も踏んでいる形）。
     → **`pd.pick`（既定1）を導入して上限を `pd.pick + (pd.elder ? 1 : 0)` に一般化する**。
     **⚠ 既存前例 `pawn`（陰謀・従者）は流用できない**＝`PAWN_RESOLVE`（実測 `js/engine.js:13936`）は
     `valid` で絞り `a.indexOf(c) === i` で重複を弾き `if (ch.length !== 2) return state;` と検査するところまでは同型だが、
     **`ch.forEach(...)` で「送られてきた順」に解決している**（従者は4択すべてが +1 なので順序が観測できず問題にならない）。
     Kitsune は**記載順が観測できる**（呪いの獲得が相手の窓を開く／銀貨獲得が Growth を誘発する）ので、
     **「重複排除と枚数検査は `pawn` の形／記載順への並べ替えと解決は `normalizeChoices` + `runChoiceOptions`」**の組み合わせが正解。
     ⚠ **選択肢の効果は `applyChoiceOption` に1箇所だけ書く**（2箇所に書くと必ずズレる＝§0-29 A4 の注意）。
     ⚠ **`runChoiceOptions` は長老が無くても必要**＝`applyChoiceOption` の途中で `state.pending` が立ったら
     残りを `t.elderRest` に積んで再開する仕組みで、**呪いの獲得は被害者の望楼／交易商人／Growth の窓を開きうる**ため。
  5. **`ELDER_CHOICE_ORDER`（同盟の長老＝追加でもう1つ異なるものを選ぶ）に登録するか決める**。
     日本語wiki は**「狐は長老の対象になる」と明言**している（＝忠実にするなら登録して4択のうち3つを選べるようにする）。
     ただし本アプリの現状は **`ELDER_CHOICE_ORDER` に同盟の9種しか入っていない**
     （実測＝`town / blacksmith / town_crier / innkeeper / broker / stronghold / hill_fort / modify / specialist`。
     `js/engine.js:8319`・§0-29 A4 の許容簡略化）。
     **据え置くなら「許容簡略化」として PROGRESS に明記する**（略奪の宝珠(Orb)を据え置いたのと同じ判断枠。mix-all 限定の差）。
  6. **呪いの山が空でも他の3択は普通に働く**（Preview が明言）＝**呪いの残量で選択肢を消さない／窓を閉じない**。
     呪いを選んで山が空なら「誰も獲得しない」だけ。
  7. **「+2 Actions」と「+$2」を同時に選ぶと非ターミナルの payload になる**＝
     **`addActions(t, n)` / `addCoins(state, n)` を必ず経由する**（`t.actions += n` / `t.coins += n` を直接書かない＝§0-25 の横断ルール。
     雪深い村・カメレオンの習性が静かに壊れる）。
     日本語wiki の【カメレオン化狐】の例（「+2 コイン」＋「銀貨獲得」を選ぶと**先にカードを2枚引いてから**銀貨を獲得）は、
     **`addCoins` を通していれば自動的にそうなる**（`addCoins` の冒頭に `if (t.chameleon && !t._chamSwap)` の変換がある＝実測）
     ＝**この例がそのまま回帰テストになる**。
  8. **銀貨の獲得は `gainableBase(state, id)` を通す**（山が空なら獲得できないだけ＝選択肢は消さない）。

---

### Litter ／ 駕籠  （$5・アクション）

- **英語カード文（逐語）**：
  ```
  +2 Cards
  +2 Actions
  +1D
  ```
  （生HTML＝`+2 Cards<br />+2 Actions<br />+[1D]`）
- **日本語カード文（DO訳）**：
  ```
  +2 カードを引く
  +2 アクション
  +<1>
  ```
- **区切り線**：**無し**（実測 `<hr` 0）
- **版**：`First edition / August 2024` の1行のみ＝機能エラッタ無し
- **公式FAQ・裁定**：
  - 英語wiki Official FAQ ／ RGG Card Clarifications（逐語同一）：
    > This works even if you already had D; see the Debt section.
  - 日本語wiki「詳細なルール」＝**カード固有の裁定は無い**（負債の専用ページ参照のみ）。
  - 英語wiki Strategy 節（※Official FAQ ではないが、**英語wiki `Debt` ページに独立した裏付けがある**）：
    > Litter will counter Possession, as the possessing player takes the debt rather than the possessed player.

    `Debt` ページ側の逐語＝
    > Possession (from Dominion: Alchemy) now has errata that causes it to also give the Possessing player all Debt tokens the Possessed player would get.
  - Secret history：初期からある on-play 負債カードで**一度も変わっていない**。
- **⚠ 実装で危ないところ**：
  1. Gold Mine / Imperial Envoy と同じ **on-play 負債**＝**金額引数版の `takeDebt` を通すこと**。
  2. **強制**（"may" が無い）＝**新しい pending は要らない＝4点セットは不要**（Imperial Envoy と同じ）。
  3. **支配(Possession)＝負債を負うのは支配者**。既存 `takeDebt` の
     `t.possessedBy != null && pIndex === t.active → t.possessedBy` の振り分けが**この公式記述と一致している**＝
     **金額引数版を新設するときにこの分岐を落とさないこと**。**回帰テストを書ける唯一の明文**なので必ず書く
     （※支配は公式推奨セットには現れない＝mix-all 限定の到達）。
  4. **`Lost City`（冒険・失われし都市）と同型の「村＋ドロー」**＝CPU の `GAIN_ORDER` は `lost_city` の近辺に置くのが素直
     （負債1のぶん少しだけ下げる）。

---

### Rice Broker ／ 札差  （$5・アクション）

- **英語カード文（逐語）**：
  ```
  +1 Action
  Trash a card from your hand. If it's a Treasure, +2 Cards. If it's an Action, +5 Cards.
  ```
  （生HTML＝`<b>+1&#160;Action</b><p>Trash a card from your hand. If it's a Treasure, <b>+2&#160;Cards</b>. If it's an Action, <b>+5&#160;Cards</b>.</p>`）
  ※日本語wiki の英語列は `+1 Acition` と誤字があるが、英語wiki の生HTMLは `+1 Action`（正）。
- **日本語カード文（DO訳）**：
  ```
  +1 アクション
  手札1枚を廃棄する。
  それが財宝カードの場合、+2 カードを引く、それがアクションカードの場合、+5 カードを引く。
  ```
- **区切り線**：**無し**（実測 `<hr` 0）
- **版**：`First edition / August 2024` の1行のみ＝機能エラッタ無し
- **公式FAQ・裁定**：
  - 英語wiki Official FAQ ／ RGG Card Clarifications（逐語同一）：
    > If you trash a card that's both a Treasure and an Action, you get +2 Cards and then +5 Cards. If you trash a card with neither type, such as Province, you don't draw any cards.
  - RGG ルールブック・予言 Enlightenment 項（**このカードを名指しした横断裁定**）：
    > Enlightenment: Treasures are Actions for all purposes. For example if you use Rice Broker to trash a Copper, it's an Action and still a Treasure, so you draw 7 cards total.
  - **日本語wiki「詳細なルール」（英語wikiに無い裁定＝解決順の確定）**：
    > 札差の効果は①(+1アクションを得て)手札のカードを廃棄し、廃棄置き場に置く→②廃棄カードの種類を参照し、それが財宝であれば+2ドロー
    > →③廃棄カードの種類を参照し、それがアクションであれば+5ドロー、という処理である。
    > **①でのカード廃棄に対して廃棄時効果が誘発するタイミングは①の直後であり、②や③の処理以降ではないので注意。**
    > 例えば、札差の効果で手札の村を廃棄した際、手札の青空市場でリアクションできるのは①の直後である。
    > +5ドロー(=③の処理)を行った後に「手札に青空市場があるのでリアクションする」という動きはできない。
  - Synergies（英語wiki）：`Lurker`（待ち伏せ）は Rice Broker を獲得でき、**Rice Broker が廃棄したアクションを廃棄置き場から取り戻せる**。
- **⚠ 実装で危ないところ**：
  1. **「Treasure かつ Action」なら +2 と +5 の *両方*（合計7枚）**（FAQ 明記）＝**排他の if/else で書くと壊れる**。
     ⚠ **収集docの該当例リストは誤り**（検証docの訂正1・本担当も機械検算で確認）。**正しくは**：
     - **静的に Action かつ Treasure を持つ既存カードは全761枚中ちょうど2枚**＝
       **`crown`（帝国・冠／`types:['action','treasure']`）** と **`spell_scroll`（略奪・呪符の巻物／`['action','treasure','loot']`）**
       （`js/cards.js` を全走査して実測）。
     - **夜想曲には Action+Treasure のカードは1枚も無い**（夜想曲系プールの財宝はいずれも action を持たない）。
     - ＋ **資本主義(ルネサンス)で財宝になったアクション** ＋ **予言 Enlightenment 下の全財宝**。
     - **回帰テストは `crown` で書く**＝**公式推奨セット `Swept Clean`（Rising Sun & Empires）に
       Rice Broker と Crown が同居している**（`Swept Clean: Divine Wind, Sea Trade — Artist, Kitsune, Mountain Shrine,
       **Rice Broker**, Root Cellar — Chariot Race, Charm, **Crown**, Overlord, Temple`）
       ＝**mix-all 頼みではなく、出荷する公式セットを1本出せば毎回到達する**。
  2. **種別判定は静的に書かない**。
     - 財宝側＝**必ず `isTreasureFor(state, id)` を通す**（`DOM.isType(id,'treasure')` を直に書かない＝§0-22 の横断ルール。
       資本主義で「+$ を持つアクション」が財宝になるため、静的判定だと本番で食い違う）。
     - ⚠ **アクション側も動的になる**＝**予言 Enlightenment は「Treasures are Actions for all purposes」**。
       **これは「要検討」ではなく確定で必要**＝**公式推奨セット `Expert Traders`（Rising Sun & Allies）が
       Enlightenment と Rice Broker を同居させている**（rulebook が Clarification で挙げている例が
       そのまま出荷セットになる）。ほかに Enlightenment は `Solving the Puzzle` / `Become the Ox` にも入る。
       → **`isActionFor(state, id)` 相当の動的述語を新設する**。
       **規模の実測**＝`js/engine.js` 内の `isType(…, 'action')` は **156箇所**（`isActionFor` は現在**0件**＝未存在）。
       比較＝`isTreasureFor` は導入時69箇所を置換し、現在の参照数は121。
       ＝**`isTreasureFor` と同規模以上の横断改修**になる。**旭日の実装計画で最初に決めるべき設計判断のひとつ**
       （※`isActionFor` を作るなら「サプライの山の一番上を見る」`isTypeSupply` との棲み分けも同時に決める）。
  3. **廃棄は強制**（"may" が無い）。**手札0枚なら pending を開かない**（既存 `REMODEL_TRASH` と同じ終端保証）。
     新 pending なので **4点セット必須**（engine reducer ＋ `PLAYER_ACTIONS` ＋ CPU `decidePending` ＋ UI `viewPendingModal`）。
     **候補は必ず1枚以上ある（手札があるときしか開かないため）＝辞退ボタンは不要**。
     ⚠ **Shadow カード（Ronin/Tanuki）は「手札にあるかのように *使える* だけで手札にはいない」**＝
     **札差が廃棄できるのは本当に手札にあるカードだけ**（山札の Shadow を候補に出してはいけない）。
  4. **⚠ 解決順＝廃棄 →（廃棄時効果を全部解決）→ ドロー**（日本語wiki が明示）。
     - **reducer は廃棄の前に `state.pending = null` にする**（廃棄が別の窓を開くため＝略奪の「賞品のヤギ」で踏んだ形）。
     - **廃棄は `trashCard(state, owner, card)` を通す**（`state.trash.push` を直に書かない＝on-trash が全滅する）。
     - 廃棄で開く窓＝城塞／ネズミ／狂信者／リッチ／**青空市場**／下水道／墓所 等。
       対話つきのものは `trashCard` が **`state.onTrashQueue`** に積み、**`reduce()` 末尾**で
       「`!state.pending` なら1件ずつ pending 化」される（暗黒時代 Group A の機構）。
     - ＝**ドローを `applyEffect` の中で即実行すると `onTrashQueue` の消化より先に走る**（青空市場のリアクションが
       ドロー後になり、坑道・リシャッフルの結果まで変わる）。
       → **`t.riceBrokerResume` のような再開網を1つ作り、`reduce()` 末尾で引く**。
       **⚠ 条件は `!state.pending` だけでは足りない**＝キューの1件目を pending 化した直後の reduce で先にドローが走る。
       **既存の `t.cleanupWaiting`（増築）とまったく同じガードを書く**：
       ```js
       if (!state.pending && !state.gameOver && state.turn && state.turn.riceBrokerResume &&
           !(state.onGainQueue && state.onGainQueue.length) && !(state.onTrashQueue && state.onTrashQueue.length)) { … }
       ```
       （`t.cleanupWaiting` の再開網が `reduce()` 末尾で実際にこの2つのキューを見ている＝実測）。
     - 同型の再開網の先例＝`t.storytellerResume`（語り部）／`t.galleySetAside`（王家のガレー船）／
       `t.fhResume`（一等航海士＝**配列にすること**）／`t.elderRest`（長老）。
  5. **廃棄したカードの種別は「廃棄した後」に参照する**（②③とも廃棄済みのカードを見る）。
     資本主義・Enlightenment のような**動的種別は廃棄後の状態で評価する**こと。

---

### Ronin ／ 浪人  （$5・アクション－影(Shadow)）

- **英語カード文（逐語）**：
  ```
  Draw until you have 7 cards in hand.
  ————
  You can play this from your deck as if in your hand.
  ```
  （生HTML＝`Draw until you have 7&#160;cards in hand.<hr style="width:66%;margin-left:17%;text-align:center;" />You can play this from your deck as if in your hand.`
  ＝**本担当が独立に再取得して確認済み**）
- **日本語カード文（DO訳）**：
  ```
  手札が7枚になるようにカードを引く。
  ————
  これは手札からと同様に山札からも使用できる。
  ```
- **区切り線**：**1本**（本文と Shadow の但し書きの間。カード文セル内の `<hr>` を実測。
  ページ全体の `<hr` は4本だが、残り3本は Versions表／French行／German行）
- **版**：`First edition / August 2024` の1行のみ＝機能エラッタ無し。**Info に `Card back` 行あり＝専用の裏面を持つ**
- **公式FAQ・裁定**：
  - 英語wiki Official FAQ ／ RGG Card Clarifications（逐語同一・2文）：
    > See the Shadows section.
    > When you play this, you draw cards one at a time until you have 7 cards in hand, or can't draw any more; if you already had 7 or more cards in hand, you don't draw any.
  - **日本語wiki「詳細なルール」（英語wikiに無い裁定＝-1カードトークンとの相互作用）**：
    > 浪人使用時は手札のカードが7枚になるまでドローし続けるので、**即座に－1カードトークンは取り除かれ、実質的に影響を受けない。**
    > **手札が7枚以上ある場合、カードのドローを行えない。この場合、－1カードトークンは残ったままとなる。**
  - Secret history：**元はアタック枠として作られたが Shadow に差し替えられ、`+2 Cards` 案と `Draw to 7` 案のうち後者を採用**
    ＝**現行にアタック要素は一切残っていない**（＝`ATTACKS` に登録しない根拠。この8枚で Attack は Kitsune だけ）。
- **⚠ 実装で危ないところ**：
  1. **既存の書庫(Library)＝`libraryStep`（実測 `js/engine.js:2904`）が「手札が7枚になるまで引く」の唯一の前例**。形は流用できるが、
     **`libraryStep` は `p.deck.shift()` で直接引いていて `draw()` を通らない**＝
     **-1カードトークン（冒険の遺物／借入）もカメレオンの習性もメイソン団も効かない**（PROGRESS §0-26 に既知として記載）。
     **浪人は日本語wiki が -1カードトークンの挙動を明示している以上、`draw(state, pi, 1)` を1枚ずつ通すべき**。
  2. **⚠ ループの終端条件を `draw()` の戻り値で判定してはいけない（最大の罠）**。
     `draw()` は **-1カードトークンを持っていると `n -= 1` して 0枚になり `[]` を返す**
     （実測＝`if (p.minusCard && n > 0) { n -= 1; p.minusCard = false; … }` の後に `for (let i = 0; i < n; i++)`）。
     `while (hand.length < 7) { if (draw(state,pi,1).length === 0) break; }` と書くと
     **トークンを消費した瞬間に break して1枚も引かない**＝日本語wiki の裁定（「実質的に影響を受けない」）と正反対になる。
     → **終端条件は「山札と捨て札が両方空」で判定する**（`libraryStep` と同じ形＝`p.deck.length === 0 && p.discard.length === 0` なら break）。
  3. **⚠ カメレオンの習性（移動動物園）で無限ループの危険**。
     `way_of_the_chameleon` は `t.chameleon = true; try { applyEffect(state, card, pi); } finally { t.chameleon = false; }`
     ＝**浪人自身の効果が走る**（実測）。そして `draw()` は
     ```js
     if (tt && tt.chameleon && !tt._chamSwap && n > 0 && pIndex === tt.active) {
       tt._chamSwap = true; tt.coins += n; tt._chamSwap = false; … return [];
     }
     ```
     ＝**あらゆるドローを +$ に変換して `[]` を返す**ので、「手札が7枚になるまで」ループは
     **手札が永久に増えず engine がハングする**（mix-all で到達＝`mix:menagerie,risingsun`）。
     ⚠ **公式にはカメレオンの習性は「+N Cards」と「+N $」の文字列だけを入れ替えるので、
     「Draw until you have 7 cards in hand」は一切変換されない**（＝書庫が `draw()` を通らないため偶然正しく動いているのと同じ理屈）。
     → **最小の実装＝`draw()` が自分自身の再入防止に使っている `t._chamSwap` フラグでループ全体を挟む**
     （`const sw = t._chamSwap; t._chamSwap = true; try { …ループ… } finally { t._chamSwap = sw; }`）
     ＝**新しい仕組みは要らない**。**加えてハードな反復上限（安全網）も必ず入れる**。
  4. **「1枚ずつ引く」**（FAQ 明記）＝まとめて `draw(state,pi,7-hand.length)` にしない。
     途中のリシャッフル・メイソン団（同盟）のフックが1枚ごとに正しく効く。
  5. **「or can't draw any more」＝山札＋捨て札が尽きたら7枚未満で止まる**（無限ループにしない終端）。
     **「既に7枚以上あるなら1枚も引かない」**（＝差分がマイナスでも0にクランプ。このとき -1カードトークンは**残る**）。
  6. **Shadow ＝ 山札から使える**（下の「Shadow 共通ルール」）。
     ⚠ **山札から使ったときは浪人自身が手札に無い**が、手札から使ったときは「場に出す＝手札から抜ける」＝
     **どちらの経路でも『場に出した後の手札』を数える**のが正しい（rulebook の
     `You play it exactly as if playing it from your hand; it goes into play` から直接導ける）。
  7. **新種別 `shadow`（影）の登録が要る**（Tanuki と共通。下記「新種別の登録先」）。
  8. **`maskStateFor` の設計に影響**＝Shadow は裏面が違うので「山札のどこに Shadow があるか」を隠しきれない（下記）。
  9. **新 pending は無い＝4点セット不要**（ドローだけ）。ただし**「山札から使う」経路そのもの**は
     engine の受理・CPU の候補・UI のフィルタの3面に手が要る（Shadow 共通ルール）。

---

### Tanuki ／ 狸  （$5・アクション－影(Shadow)）

- **英語カード文（逐語）**：
  ```
  Trash a card from your hand. Gain a card costing up to $2 more than it.
  ————
  You can play this from your deck as if in your hand.
  ```
  （生HTML＝`Trash a card from your hand. Gain a card costing up to [$2] more than it.<hr style="width:66%;..." />You can play this from your deck as if in your hand.`）
- **日本語カード文（DO訳）**：
  ```
  手札1枚を廃棄する。それよりコストが最大2コイン高いカード1枚を獲得する。
  ————
  これは手札からと同様に山札からも使用できる。
  ```
- **区切り線**：**1本**（本文と Shadow の但し書きの間。カード文セル内の `<hr>` を実測。ページ全体は4本）
- **版**：`First edition / August 2024` の1行のみ＝機能エラッタ無し。**Info に `Card back` 行あり＝専用の裏面**
- **公式FAQ・裁定**：
  - 英語wiki Official FAQ ／ RGG Card Clarifications（逐語同一・2文）：
    > See the Shadows section.
    > When you play this, you trash a card from your hand, and gain a card costing up to $2 more than it, like when playing Remodel.
  - **RGG ルールブック Debt 節の Examples（このカードを名指しした横断裁定）**
    （記号入りは `_expansion.txt`。pdftotext 版では記号が消えて読めない）：
    > **Tanuki trashing an Artist can gain a Daimyo, because Daimyo does cost "up to $2 and 8D."**

    同じ節の関連例（他カードだが同じ原理）：
    > Craftsman can't gain a Mountain Shrine, because 5D is not "up to $5."
    > Change can't gain a Mountain Shrine, no matter what you trash, because Mountain Shrine doesn't cost any $.

    ＋ Debt 節の一般則2つ：
    > Some cards look for a cost in a range. "Up to $X" means "$0, $1, …, or $X"; it does not include costs with D in them.
    > Some cards compare costs. … However debt and $ are not comparable.
  - 日本語wiki「詳細なルール」：
    > 効果そのものは改築と全く変わらないため、改築を参照。
  - Secret history：
    > I tried a Shadow Remodel and it immediately worked. It's a terror in the hands of the TGG bot.
  - 余談（絵の生成に効く）：**他の Shadow は裏面が表面イラストの一部の拡大だが、狸だけ裏面に縦長のイラストがあり、表面はその上半分**。
- **⚠ 実装で危ないところ**：
  1. **既存の `REMODEL_TRASH` / `REMODEL_GAIN`（実測 `js/engine.js:13888`）をそのまま流用できる。新しいコスト述語を書き起こさないこと**。
     既存は
     ```js
     const ref = costOf(state, card);          // 廃棄した後に測る
     const rMax = ref.coin + 2;
     state.pending = anyGainable(state, (id) => costUpTo(state, id, rMax, ref))
       ? { type:'remodel', stage:'gain', player: pd.player, maxCost: rMax, pot: ref.pot, debt: ref.debt } : null;
     ```
     ＝`costUpTo(state, id, coin, spec)` は
     `gainableBase(state,id) && costLE(costOf(state,id), { coin, pot: spec.pot||0, debt: spec.debt||0 })`（実測）なので、
     **Artist(`$0 + 負債8`) を廃棄 → 上限 `($2, 負債8)` → Daimyo(`$0 + 負債6`) が成分ごとに ≤** で獲得できる
     ＝**上の公式例と完全に一致する**（本担当も既存コードを読んで確認）。
     ⚠ **「Up to $X は負債コストを含まない」という一般則と矛盾しない**＝
     狸は「**それより** $2 高いまで」という**相対比較**なので、基準カードの負債成分がそのまま上限に引き継がれる。
     一方 Craftsman の「up to $5」は**絶対値**なので `spec` が既定（`pot:0, debt:0`）になり Mountain Shrine(`5D`) を弾く。
     **この2つを1つの関数で正しく表現できているのが既存 `costUpTo` の `spec` 引数**＝**絶対に自作しないこと**。
  2. **廃棄は強制／獲得も強制**（"may" が無い＝Remodel と同じ）。**手札0枚なら pending を開かない**。
     ⚠ **Shadow なので「手札が空でも山札から狸を使える」**＝
     **手札0枚で使うと廃棄も獲得も起きずアクション権だけ失う**、という**到達可能な**経路がある
     （※通常の Remodel は手札から使う以上「自分自身」が手札にいたので手札0にはならない＝**この終端は Shadow で初めて必要になる**）。
     **窓を開かない終端保証を必ず入れる**（開くと人間が詰む／CPU が livelock）。
     また **`REMODEL_TRASH` 側は既に「獲得候補ゼロなら pending を立てず終了」の終端保証を持っている**ので、
     流用すれば獲得側の詰みは自動で防げる（＝辞退ボタンは不要）。
     新 pending（trash / gain の2段）＝**4点セット必須**。
  3. **獲得先はサプライのみ**＝`gainableBase` を通す（非サプライ・ロック中の分割山下段・在庫切れを弾く）。
  4. **コスト参照は「廃棄の後」**（既存 remodel が正しくそうなっている）。
     廃棄した瞬間にコストが変わり得る＝漁師／行人／デストリエ の動的コスト、`state.pileFavor`（同盟）、渡し船トークン、
     旭日の予言 **盛大な取引（Flourishing Trade＝全カード $1 安い）**＝**公式推奨セット `Wanderers` で Tanuki と同居する**、
     **厳冬（Harsh Winter）**＝`Cold Calculation` で同居。
  5. **獲得トリガーが入れ子で走る**＝`Buried in Booty` は **Tanuki と Growth（財宝を獲得したら安いカードを獲得・強制・連鎖）** が同居。
     `finishGain` の後に `state.onGainQueue` が積まれる前提で書くこと（`state.pending` を直代入しない）。
  6. **Shadow ＝ 山札から使える**（下記）。**山札から使った狸は場に出る**ので、
     `p.deck` から抜いて `p.inPlay` に入れる**新しい経路**が要る。保存則 tally／`allCards` は自動追従するが、
     **`maskStateFor` と サーバの「同意なしの1手もどす」（`isNoConsentUndoableBuy`・`server/gameServer.js:191`）は
     山札が動くので要確認**。
  7. **新種別 `shadow`（影）の登録が要る**（Ronin と共通。下記「新種別の登録先」）。

---

### Tea House ／ 茶屋  （$5・アクション－前兆(Omen)）

- **英語カード文（逐語）**：
  ```
  +1 Sun
  +1 Card
  +1 Action
  +$2
  ```
  （生HTML＝`+1[Sun]<br />+1 Card<br />+1 Action<br />+[$2]`＝4行すべて `<br>` 改行）
- **日本語カード文（DO訳）**：
  ```
  +1 Sun
  +1 カードを引く
  +1 アクション
  +2 コイン
  ```
- **区切り線**：**無し**（実測 `<hr` 0）
- **版**：`First edition / August 2024` の1行のみ＝機能エラッタ無し
- **公式FAQ・裁定**：
  - 英語wiki Official FAQ ／ RGG Card Clarifications（逐語同一）：
    > First the +1 Sun happens, which may trigger a Prophecy; then you get the +1 Card, +1 Action, and +$2.
  - 日本語wiki「詳細なルール」＝**カード固有の裁定は無い**（「+1Sun の処理については Sunトークンのページを参照」のみ）。
  - Trivia（Donald X., Dominion Discord, August 2024）：
    > With Tea House vs. Mystic I can at least point at the Sun and how you can imagine not wanting it.
    ＝**Sun を進めたくない局面があり得る**＝**+1 Sun は強制で選べない**という読みを補強する。
  - Secret history：当初は「Prophecy が起きていれば +$2、まだなら +$1」という *変化する Omen* だったが、常に cantrip +$2 にした。
- **⚠ 実装で危ないところ**：
  1. **「+1 Sun が最初」＝この解決の途中で Prophecy が有効になりうる**（FAQ 明記）。Kitsune と同じく
     **Sun の処理を case の冒頭に置き、Prophecy の発動を反映してから残り（+1カード／+1アクション／+$2）を解決する**。
     **⚠ Kitsune ⚠1 の (a)(b) がそのまま当てはまる**＝
     - **Kind Emperor**＝`Winter Solstice` などでは同居しないが、**Omen 一般の問題**なので
       **`t.omenResume` の再開網は Kitsune と共有して作ること**（Sun の解決が獲得を起こし pending が立ったら、
       +1カード／+1アクション／+$2 は**その後**）。
     - **Divine Wind**＝**公式推奨セット `Fresh Start`（Rising Sun & Renaissance）で Tea House と同居する**
       ＝Sun を除いた瞬間に王国10山が総入れ替えになり、その後に +1カードを引く。
     ＝Prophecy によっては後続の結果が変わる（例＝**進歩(Progress)＝獲得したカードを山札の上に置く**／
     **盛大な取引＝コストが $1 下がる**／**豊作＝財宝の初回使用で +1購入+$1**）。
  2. **+1 Sun は「may」ではない＝強制**（カード文に may が無い。Donald X. の発言も「Sun が欲しくない局面がある」＝避けられない前提）。
  3. **`+$2` は `addCoins(state, n)`／`+1 Action` は `addActions(t, n)` を通す**
     （`t.coins += 2` / `t.actions += 1` を直接書かない＝§0-25 の横断ルール。カメレオンの習性・雪深い村が静かに壊れる）。
  4. **新 pending は無い＝4点セット不要**（Sun の減算と cantrip だけ）。
     ただし ⚠1 の再開網が入るなら、**再開網は pending ではないので `PLAYER_ACTIONS` には足さない**（`reduce()` 末尾の網）。

---

### 新種別の登録先（この章で新設が要るのは **`omen` と `shadow` の2つだけ**）

- ⚠ **`command`（大名 Daimyo が持つ）は既存種別**（`js/engine.js` の `DOM.isType(card,'command')` が既に使われている）＝**新設不要**。
- 新種別を足すときは **3ファイル・5つのマップ**すべてに足す（1つでも漏れるとラベルが欠ける／同盟A2で入れた恒久検査が赤くなる）：
  1. `js/carddata.js` の `ALLIES_TYPE_JP`
  2. `js/carddata.js` の `ALLIES_TYPE_EN`
  3. `js/ui.js` の `TYPE_JP`
  4. `test/integrity.test.js` の `JP`
  5. `test/integrity.test.js` の `EN`
- **日本語の種別名は「前兆」（Omen）と「影」（Shadow）**（日本語wiki＝`アクション-前兆` / `アクション-影`）。
  ＝略奪の `loot`（戦利品）で踏んだのと同じ手順。**Ronin / Tanuki の章だけを読む実装者が `shadow` を落とさないよう、
  各カードの ⚠ にも1行入れてある**。

---

## 横断ルール（この8枚に直接効くぶんだけ再掲。**正本は第1章**）

### Shadow（影）＝Ronin / Tanuki
RGG ルールブック（2024年8月・p.4）逐語：
> Rising Sun has five Shadow cards. These cards all have unique backs, and can be played from your deck.
> - When shuffling Shadow cards, put them on the bottom. If you have multiple Shadow cards, they can go in any order at the bottom. They can also be mixed with any other cards you specifically put on the bottom, such as Fated cards from Plunder.
> - You may wish to turn your Shadow cards sideways at the bottom of your deck, so that it is easy to remember that they are there.
> - Shadow cards will not necessarily stay on the bottom of your deck; they are just put there when shuffling them.
> - Shadow cards are not put on the bottom when gained, or at any time other than when shuffling them.
> - You can look through your deck at the card backs at any time, and see where your Shadow cards are.
> - Whenever you can normally play an Action card, you can play a Shadow card from your deck. It can be anywhere in your deck. You play it exactly as if playing it from your hand; it goes into play and you follow its instructions.
> - When a card like Throne Room tells you to play a card from your hand, you can use that opportunity to play a Shadow card from your deck.
> - You can play Shadow cards from your deck as if in your hand, but this does not mean the Shadow card is in your hand; for example you cannot discard it to an ability like Alley's (unless it is actually in your hand).

**実装上の見立て**：
- **「シャッフルのとき山札の一番下に置く」は `reshuffleDeck(p, state)` に1箇所で入れられる**（略奪の「運命の(Fated)」と同じ位置）。
  ルールブックが**Fated と混ぜられる**と明記しているので、**両方あるときの順序は任意＝自動選択でよい**
  （＝運命のと同じ「許容簡略化」の枠に収まる）。
  ⚠ **Fated のブロックは `state` が無くても動くように書かれている**（`state` はログにしか使っていない）。
  **Shadow の底入れも同じく `state` 非依存で書くこと**（下の「出荷済みの実バグ候補」を参照＝
  `reshuffleDeck` の85呼び出しのうち `state` を渡しているのは12箇所しかない）。
- **「獲得したときは一番下に置かない」**＝**獲得経路には一切フックを入れない**。
- **「玉座の間などが『手札からカードを使う』と言ったら、その機会に山札から Shadow を使える」**＝
  **`canPlayHandCard(state, pi, card)`（実測 `js/engine.js:8297`＝航海の3枚制限＋将軍）を通す経路すべてに、
  山札の Shadow を候補として足す**必要がある。
  ＝**engine の受理・CPU の候補・UI のフィルタの3面を同時に直す**（§0-23／A4 の「片側だけ締めると本番 livelock」）。
  ⚠ **これは mix-all 限定ではない**＝**公式推奨セット `Spring Forward`（Rising Sun & Dominion）が
  Tanuki と Throne Room を同居させている**。
- **「手札にあるわけではない」**＝Alley（同拡張）や地下貯蔵庫など**「手札から捨てる／廃棄する」の候補には入れない**
  （＝上の Rice Broker の注意 3.）。
- **⚠未確定**：**山札のどこに Shadow があるかを *相手も* 見てよいか**。rulebook は `You can look through **your** deck` としか
  書いておらず断定できない。**`maskStateFor` の設計判断が要る**ので、Shadow 概念ページ担当（機構の群）の結論に従うこと。

### Omen / Prophecy（前兆・予言）＝Kitsune / Tea House
RGG ルールブック（2024年8月・p.3〜4）逐語：
> - In every game with one or more Omen cards, deal out one Prophecy for it. Only use one Prophecy no matter how many Omens you have.
> - Put 5 Sun tokens on the Prophecy for 2 players, 8 for 3 players, 10 for 4 players, 12 for 5 players, and 13 for 6 players.
> - "+1 Sun" means, remove a token from the Prophecy. Then if it was the last token, the rules text on the Prophecy becomes active, right then and for the rest of the game.
> - "+1 Sun" always appears first on Omens, before anything else the card does.
> - "+1 Sun" does nothing else once all the tokens are removed.
> - Prophecy text does nothing until the last Sun token is removed.

＝**Kitsune / Tea House の FAQ「まず +1 Sun」はこの一般則の個別適用**。
Sun トークンの同梱総数は13個だが、**卓に置くのは人数別**（2人5／3人8／4人10／5人12／6人13）。

**「途中で有効になる」の具体的な怖さ（rulebook の Card Clarifications より・本担当が直読み）**：
- **Kind Emperor**＝`When the last Sun is removed, this applies immediately, in the middle of resolving the Omen,
  and only the player who removed the Sun gains an Action then.`
  ＝**Omen の解決の途中で「アクション1枚を手札に獲得」が起き、その獲得トリガーが pending を立てうる**。
- **Divine Wind**＝**その場で王国10山が総入れ替え**（詳細は Kitsune ⚠1(b)）。
→ **Omen の残り効果を続ける再開網（`t.omenResume` 等）は、Kitsune / Tea House の両方に必要**。

### Debt（負債）＝Gold Mine / Imperial Envoy / Litter
RGG ルールブック（2024年8月・p.3）逐語のうち、この3枚に効くもの：
> - Having Debt tokens prevents a player from buying cards or Events or Projects (from Renaissance); Debt tokens do nothing else (for example they have no effect at the end of the game).
> - Buying a card or Event with D in its cost gives the player that many Debt tokens.
> - An ability with +D causes you to take that many Debt tokens.
> - A player can remove Debt tokens at any point in their turn by paying $1 per Debt token to remove it. This does not use up a Buy or an Action, and can be done multiple times in a turn. This does not let players play Treasures at any time.
> - $ amounts are not D amounts. Math involving $ amounts does not affect D amounts.
> - Players cannot take D for no reason.
> - Players cannot overpay with D (for Guilds cards).
> - D is not counter-limited; players should use a replacement if they run out.

**✅ 本アプリ側は 2026-08-16 のコミット `7cc4534` で 2024年版の負債ルールに追随済み**（＝検証docが「担当外の発見 [medium]」として
上げていた既存バグは**もう存在しない**。検証docはこの修正の14分前に書かれていた）。内容＝
1. **負債はターン中いつでも返済できる**（旧実装は購入フェイズ限定）。→ `REPAY_DEBT` のフェイズ判定を撤去（engine/UI の2面）。
   ＝**on-play 負債（この3枚）をアクションフェイズで負っても、その場でコインがあれば返せる**のが正しい挙動。
   ⚠ **既存の許容簡略化＝`REPAY_DEBT` の冒頭に `if (state.pending) return state;` があり、選択待ちがある間は返せない**
   （コミットメッセージにも明記）。公式は「いつでも」なので、闇市場の解決中に返す手だけは再現できない。
   **on-play 負債はアクションフェイズで発生するので、この制約に触れうるのはこの3枚が初めて**
   （※Gold Mine は自分の窓が閉じてから負債を負うので、実際に困るのは「他の選択待ちの最中」だけ）。
2. **負債を負うのは「購入」したときだけ**（効果での獲得では負わない）。→ `takeDebt` を `gain()` / `gainFromOutside` / `gainLoot` から外し、
   **`BUY` と `BLACK_MARKET_BUY` だけ**に移した（`BUY_EVENT` は元から個別付与）。
   ＝**上の Tanuki の公式例（Artist を廃棄して Daimyo を獲得）は「獲得」なので負債0**、が正しく再現される。
⚠ **on-play 負債（Gold Mine +4D / Imperial Envoy +2D / Litter +1D）を実装するときに、
この `takeDebt` を「コスト参照のまま」流用してはいけない**（`C()[cardId].debt` を読むので0になる）。
**金額を引数で受ける版を新設し、支配(Possession)の振り分けだけ既存から引き継ぐ**こと。

---

### ⚠ 出荷済みの実バグ候補

**[推定・fidelity] 略奪のイベント「回避(Avoid)」が、`draw()` 以外の経路で起きたシャッフルに一切効かない**

- **場所**：`js/engine.js` の `reshuffleDeck(p, state)`（実測 L1183〜）内の Avoid ブロック（実測 L1235）。
  ```js
  if (state && state.turn && (state.turn.avoidPicks || 0) > 0 &&
      state.players[state.turn.active] === p && shuffled.length > 1) {
  ```
  ＝**`state` が渡されなければブロック全体がスキップされ、`t.avoidPicks` も消費されない**。
- **実測**：`reshuffleDeck(` の呼び出しは **85箇所**あるが、**`state` を渡しているのは 12箇所だけ**
  （`draw()` 本体＋財産目当て／地図作り／その他の一部）。**残り73箇所は `reshuffleDeck(p)` の1引数呼び出し**。
  同じ関数内の **運命の(Fated)** ブロックは `state` を**ログにしか使っていない**ので `state` 無しでも正しく働く
  （＝Avoid だけが `state` 依存）。コメントには `どの経路のシャッフルでも誘発する（この関数が唯一の入口）` と
  書かれており、**Avoid の `state &&` ガードは意図ではなく取りこぼしと見られる**。
- **再現条件（出荷 CARD_SET `plunder-events` で到達可能）**：
  1. 2枚抽選されるイベントに **回避(Avoid)** が入る（15種から2枚＝約13%）。
  2. `DOM.KINGDOM_PLUNDER`（固定10種）は **宝飾卵／戦利品の袋**など戦利品を配る4種を含むので、
     戦利品 **六分儀(Sextant)** を手に入れられる。
  3. 回避を購入した同じターンに、**そのターン最初に山札を空にするアクセスが六分儀**になるようにする。
     六分儀の実装（`applyTreasureEffect` 内）は
     `if (p.deck.length === 0) { if (p.discard.length === 0) break; reshuffleDeck(p); }`
     ＝**`state` を渡していない**。
  → **回避の「最大3枚をシャッフルに混ぜず捨て札に残す」が起きず、しかも `t.avoidPicks` が消費されないので、
     そのターンの後続のドロー由来シャッフルで遅れて発動する**（＝公式の「次にシャッフルするとき」1回とズレる）。
- **同じクラスの取りこぼし**：`libraryStep`（書庫）も `reshuffleDeck(p)` の1引数呼び出し
  ＋ **`p.deck.shift()` で直接引いていて `draw()` を通らない**ので、
  **-1カードトークン（冒険の遺物／借入）が効かない**（PROGRESS §0-26 に既知として記載済み）。
  **旭日の Ronin の日本語wiki 裁定「浪人使用時は -1カードトークンが即座に取り除かれる」は
  書庫にもそのまま当てはまる**ので、**公式には書庫の現挙動も誤り**。
  ＝**Ronin を `draw()` 経由で実装するなら、ついでに `libraryStep` も `draw(state, pi, 1)` に寄せるのが自然**
  （ただし `draw()` はカメレオン変換を含むので、⚠3 の `t._chamSwap` ガードを書庫にも同時に入れること）。
- **重大度**：どちらも**保存則・非ループには影響しない忠実性のみの差**。
  ただし Avoid のほうは**出荷セット `plunder-events` で到達する**ので、修正するなら
  `reshuffleDeck` の全呼び出しに `state` を渡す一括置換（73箇所）が根治。
  ⚠ **本担当は node で実際に再現させていない**（コード読解と呼び出し数の実測まで）＝**[推定]**。
  **旭日の実装に入る前に、この一括置換を先に済ませておくと Shadow の底入れが安全に書ける**（上の Shadow 節）。

---

## 反映した [must]：4件／不採用：0件

| # | 批評の指摘 | 扱い |
|---|---|---|
| must 1 | 公式推奨セットが2本しか拾われておらず「Tanuki のみ推奨セットに入らない」が誤り | **採用（ただし数値を1点訂正）**。`rulebook.txt` p.11〜12 を本担当が直読みして数え直した結果、推奨セットは批評の言う **34本ではなく 32本**（`Rising Sun alone` **2本** ＋ 他拡張との組み合わせ **30本**＝15拡張×2）。Tanuki が7本に入るのは批評のとおり。8枚それぞれの登場セット表と、実装に効く同居ペア表（Kind Emperor / Divine Wind / Crown / Enlightenment / Change / Growth / Bureaucracy / Throne Room / Flourishing Trade / Harsh Winter）を新設し、rev.1 の「新たに確定させた事項 #9」は撤回した |
| must 2 | Kitsune の choose-two は既存 `normalizeChoices` では受理されない／`pawn` の前例が未言及 | **採用**。`js/engine.js` を実読し `if (!picks.length || picks.length > (pd.elder ? 2 : 1)) return null;` を確認。`pd.pick` による一般化の提案と、`runChoiceOptions` が長老抜きでも必要な理由を明記。**＋本担当の追加**＝`PAWN_RESOLVE` は `ch.forEach` で**送られてきた順**に解決しており（従者は4択すべて +1 なので観測できない）、**記載順が観測できる Kitsune にはそのまま流用できない**ことを追記した |
| must 3 | 「+1 Sun で Prophecy が途中発動」の最悪ケース（Divine Wind）が危険箇所に無い | **採用**。`rulebook.txt` の Divine Wind Clarification を直読みして逐語を引用し、`Swept Clean`（Kitsune/Rice Broker）と `Fresh Start`（Tea House）で同居することを確認。**＋本担当の追加**＝**Kind Emperor のほうがより直接的に危ない**（`applies immediately, in the middle of resolving the Omen` ＝**獲得が入れ子で起き pending が立ちうる**）ことを発見し、`Dawn of an Era` で Kitsune と同居することを確認。**Omen 用の再開網 `t.omenResume` が要る**という結論を両カードに書いた |
| must 4 | Enlightenment × Rice Broker は公式セットで同居＝`isActionFor` は確定で必要 | **採用**。`Expert Traders`（Rising Sun & Allies）を確認し、「必要性が高い／要検討」→「**確定で必要**」に格上げ。規模の実測も追記（`isType(…, 'action')` は **156箇所**／`isActionFor` は0件／比較用に `isTreasureFor` は現在121参照）。※批評の「155箇所」は作業ツリー差ぶんのズレ |

**不採用は0件**（批評の断定は、数値1点＝推奨セット総数を除いてすべて一次資料／コードで再現できた）。

## 拾った [nice]：8件（8件中8件）

| # | 内容 | 扱い |
|---|---|---|
| nice 5 | engine.js の行番号が HEAD で既にずれている | **採用**。冒頭に「原則シンボル名で引く／行番号は参考値」の注意を新設し、本文の参照を全部シンボル名＋実測行の併記に書き換えた（作業ツリーには未コミット差分があり、`REMODEL_TRASH` は 13870→**13888** まで動いていた） |
| nice 6 | `<hr>` の機械検算表と Versions 表の列構成が落ちた | **採用**。`raw_g4/*.html` 8ファイルの `<hr` を本担当が数え直して表を復元（6枚は総数0／Ronin・Tanuki は総数4・カード文セル内1）。Versions 列構成 `Print / Digital / Text / Changes / Announced / Printed` も復元 |
| nice 7 | 近似 id の注意が落ちた（＋g4 の和名が2つ誤り） | **採用**。`js/cards.js` を実測して **`envoy`＝使者**（g4 の「特使」は誤り）／**`poor_house`＝救貧院**（同「貧民街」は誤り）を確認して復元 |
| nice 8 | Trivia / Secret history の一部が落ちた | **部分採用**＝実装に効く **Ronin の Secret history（アタック枠から Shadow に差し替え＝現行にアタック要素なし＝`ATTACKS` に登録しない根拠）だけ**を拾った。Gold Mine の Preview 引用等は実装に効かないので拾わない |
| nice 9 | カメレオン無限ループの抑止フック名が無い | **採用**。`draw()` / `addCoins` が再入防止に使っている **`t._chamSwap`** を実読で確認し、「ループを `_chamSwap` で挟むのが最小の実装＝新しい仕組みは要らない」と明記 |
| nice 10 | `shadow` 種別の登録先が Ronin / Tanuki の項に無い | **採用**。「新種別の登録先」節を独立させ、**3ファイル・5マップ**（`carddata` JP/EN・`ui` TYPE_JP・`integrity` JP/EN）と明記。**`command` は既存＝新設は `omen` と `shadow` の2つだけ**も明記。各カードの ⚠ にも1行入れた |
| nice 11 | 相互作用が「mix-all 限定」に見えるが公式推奨セットで同居する | **採用**。同居ペア表を新設し、Rice Broker×Crown の回帰テストの狙いを「mix-all で到達しうる」→「**公式セット `Swept Clean` で毎回到達する**」に格上げ。Gold Mine ⚠4 に **Growth / Bureaucracy の入れ子獲得**（rulebook の逐語つき）を追加 |
| nice 12 | Imperial Envoy / Litter の「4点セット不要」が明示されていない／Debt の許容簡略化が落ちた | **採用**。両カードに「新 pending 無し＝4点セット不要」を明記し、Tea House / Ronin にも同じ注記を追加。Debt 節に `REPAY_DEBT` の `if (state.pending) return state;`（選択待ち中は返せない）を許容簡略化として復元 |

## 枚数の検算
- 担当＝**8枚**（Gold Mine, Imperial Envoy, Kitsune, Litter, Rice Broker, Ronin, Tanuki, Tea House）／書いた＝**8枚** ＝ **8/8 ✅**
  （英語wiki navbox の `[$5]` 行・rulebook の25山リストとも一致。捏造・重複・欠落 0）
- 種別の内訳＝Action 単独 **4**（Gold Mine / Imperial Envoy / Litter / Rice Broker）
  ＋ Action-Attack-Omen **1**（Kitsune）＋ Action-Omen **1**（Tea House）＋ Action-Shadow **2**（Ronin / Tanuki）
  ＝ **4+1+1+2 = 8 ✅**
- 区切り線あり **2**（Ronin / Tanuki＝Shadow の但し書き）／無し **6** ＝ **2+6 = 8 ✅**
  （8ファイルの `<hr` 実測＝0,0,0,0,0,0,4,4 ／カード文セル内＝0,0,0,0,0,0,1,1）
- 機能エラッタあり **0枚**（8枚とも `First edition / August 2024` の1刷のみ）✅
- on-play 負債 **3**（Gold Mine +4D／Imperial Envoy +2D／Litter +1D）／Omen **2**／Shadow **2**／Attack **1**
- **新 pending が要るカード＝3枚**（Gold Mine 1種／Rice Broker 1種／Tanuki 2種＝trash・gain）＝**4点セットは合計4pending**。
  **4点セット不要＝5枚**（Imperial Envoy / Litter / Ronin / Tea House ＋ Kitsune は既存 choice 機構の一般化で対応）。
  ※Kitsune は新 pending（choose-two）を1つ持つので厳密には4点セット必要＝**pending 総数5**、
  ただし UI/CPU は既存の choice モーダルを拡張する形になる。
- 新種別 **2**（`omen`＝前兆／`shadow`＝影）。`command` は既存＝新設不要 ✅
- 公式推奨セット総数 **32**（alone 2＋組み合わせ30）／この8枚の登場延べ **53回**（7,6,6,7,7,7,7,6）✅
- 日本語名・id の衝突 **0/8**（既存761枚と機械照合）✅
- HJ印刷版との差異が判明しているカード＝**この8枚には 0枚**（差異があるのは 川船／好機到来／米／絵師／進歩／盛大な取引 の6枚）✅

## まだ確定できていないこと（推測で埋めていない）
1. **Shadow の位置を *相手も* 見てよいか**＝rulebook は `your deck` としか書かず断定不能。`maskStateFor` の設計に直結するので機構担当の結論に従う。
2. **Kitsune の日本語カードの選択肢の並び**＝日本語wiki の訳文が英語原文と入れ替わっている理由（wiki の転記ミスか、DOカード自体がその並びか）。
   **実装は英語原文の順で確定**なので機能影響は無く、カタログ表示の並びだけの問題。
3. **Gold Mine の日本語wiki の例示「金貨を獲得したことに誘発し、交替を使用した場合」がどの経路を指すか**＝再構成できず。処理順の結論だけを採用した。
4. **上の「出荷済みの実バグ候補」（回避 × `state` 無しの `reshuffleDeck`）は node で再現させていない**＝[推定]。
   実装前に1本スクリプトを書いて確認すること。


<!-- ===== m5_kingdom_debt.md ===== -->

# 【確定版】第5章 王国 負債3枚＋$6＋$7（5枚）

> 収集doc `g5_kingdom_debt.md` ＋ 敵対検証doc `v_kdebt.md` ＋ 日本語対応表 `g0_jp_pairs.md` を突き合わせ、
> **疑わしい訂正は自分で一次資料を取り直して確かめたうえで**確定させたもの。
> 一次資料の再取得＝`RAW_DIR=C:/tmp/risingsun_research/raw_m_kdebt node tools/wikidirect.js "Mountain Shrine" "Daimyo" "Artist" "Samurai" "Rice" "Command"`
> （出力＝`m_kdebt_fetch1.txt` / `m_kdebt_fetch2.txt`）／`python tools/jpwiki.py "米" "絵師"`（→ `m_jp_rice_artist.txt`）／
> RGG 公式ルールブック 2024＝`rulebook.txt`／英語wiki `Debt` ページ＝`v_kdebt_debtpage.txt`／
> **Samurai の実物カード画像**＝`m_samurai.jpg`（wiki の `File:Samurai.jpg` 300px）。
> 日本語カード文は **Dominion Online 訳**（本プロジェクトの方針＝略奪の決定3と同じ）。
>
> **⚠ この文書の `js/engine.js` の行番号は 2026-08-16 の作業ツリー時点のもの＝当てにしないこと。**
> 同じ日に**別セッションが `js/engine.js` を並行編集していた**（作業中に `M js/engine.js` → コミット `ac8cf02`
> 「fix: 出荷済みの実バグ2件（旗艦×永続持続／高原の羊飼い×安価な）＝旭日の段階0の批評で発覚」に変わった＝**未push**）。
> **必ず関数名で `grep` してから読むこと**（PROGRESS §0-30 の並行セッション事故と同じ構図）。

---

## 第5章 王国 負債3枚＋$6＋$7（5枚）

### §5-0. この5枚に共通する一般ルール（負債・日の出トークン）＝実装前に必読

#### (a) 負債(Debt)＝**2024年版（旭日）で2点が変わっている**（帝国にも遡及）

RGG 旭日ルールブック `rulebook.txt` L73-88 の逐語（アイコンは pdftotext で落ちるので、
**アイコン値は英語wiki `Debt` ページから復元した**＝下記 (c) 参照）：

> - Having Debt tokens prevents a player from **buying** cards or Events or Projects (from Renaissance);
>   Debt tokens do nothing else (for example they have no effect at the end of the game).
> - **Buying** a card or Event with [D] in its cost gives the player that many Debt tokens.
> - An ability with +[D] causes you to take that many Debt tokens.
> - A player can remove Debt tokens **at any point in their turn** by paying [$1] per Debt token to remove it.
>   This does not use up a Buy or an Action, and can be done multiple times in a turn.
>   **This does not let players play Treasures at any time.**
> - Players cannot take [D] for no reason.
> - Players cannot overpay with [D] (for Guilds cards).
> - [D] is not counter-limited; players should use a replacement if they run out.

**変更点①＝負債を負うのは「購入」したときだけ**（効果での**獲得**では負わない）。
英語wiki `Debt` → `Other rules clarifications` の逐語（`v_kdebt_debtpage.txt` L600-604・自分で再取得して確認）：

> Although **buying** a card with [D] in its cost gives you Debt tokens, **gaining such a card in other ways does not**.

**変更点②＝返済は「そのターン中ならいつでも」**（旧＝購入フェイズ限定）。
英語wiki が旧ルールを**明示的に過去扱い**にしている（同 L605-611）：

> **Prior official rules (amended by the release of the Rising Sun expansion)**:
> A player removes Debt tokens **in the player's Buy phase** by paying [$1] per Debt token to remove it;
> this is done after playing Treasures, but can be done both before and after buying cards.

ルールブックのカード別注記でも念押し（`rulebook.txt` L216）：
> **Change: Remember you can repay [D] at any point during your turn**, which can sometimes let you choose which thing Change will do.

> **⚠ 本アプリの実装状況＝この2点は 2026-08-16 のコミット `7cc4534`
> 「fix(empires): 負債の2024エラッタ＝出荷済みの実バグ2件を修正（旭日の段階0で発覚）」で既に修正済み**（HEAD に入っている）。
> - `takeDebt` は `gain()` / `gainFromOutside` / `gainLoot` から外され、**`BUY` と `BLACK_MARKET_BUY` だけ**が呼ぶ
>   （`js/engine.js` の `takeDebt` は現在2箇所からしか呼ばれない。`BUY_EVENT` は元から個別付与）。
> - `REPAY_DEBT` の購入フェイズ判定は外れ、UI の返済ボタンも全フェイズ共通になった。
>   **許容簡略化＝選択待ち（`state.pending`）がある間は返せない**（闇市場の解決中だけ再現できない）。
> ＝**検証doc の [high]① と [medium]④ は「裁定としては正しい」が、「本アプリは今、公式と逆に実装されている」という
>   状況記述はすでに古い**（検証者が読んだのは `7cc4534` より前のコード）。**実装時に直す必要はない。**

#### (b) コスト比較（"up to" と「より高い」）＝**この3枚が絡む一番危ない規則**

> "Up to [$4]" means "[$0], [$1], [$2], [$3], or [$4]"; it does not include costs with [D] in them.

> **A card costing [8D] costs more than one costing [6D]**, just like one costing [$8] costs more than one costing [$6].
> However debt and [$] are not comparable. With a card costing [$4] and a card costing [6D], neither costs more than the other.
> **[6D] does however cost more than [$0]; there is an implicit [$0] in all pure [D] costs, so [6D] costs the same amount of
> [$] as [$0], and more [D].**

（出典＝英語wiki `Debt` → `Official rules` → `Some cards compare costs.` の **`Rising Sun:`** 段落。
`rulebook.txt` L89-93 は同文だがアイコンが落ちている。**同ページには `Empires:` 版の別例も併記されている**ので、
どちらを引用しているか取り違えないこと＝収集doc の引用は `Empires:` 側に近い誤った値だった＝訂正②。）

一般化した判定規則（同ページ `Empires:` 段落の逐語）：
> An amount of [$] and [D] is only larger than another if **both** the [$] and [D] amounts are larger, or one is larger and one the same.
> Amounts that do not specify [$] have [$0], and amounts that do not specify [D] have [0D] (including all previous Dominion card costs).

**その根拠になる一般則**（`rulebook.txt` L86 の逐語。アイコンは pdftotext で落ちるので英語wiki `Debt` から復元）：
> [D] amounts are not [$] amounts. **Math involving [$] amounts does not affect [D] amounts.**

＝**コスト軽減（橋／街道／王女／運河／石切場／盛大な取引 Flourishing Trade）は coin 成分にしか効かない**の一般則。
本アプリの `costOf(state, id)`（`js/engine.js` L4455-4458）は `coin: cardCost(state,id)`（軽減あり）＋
`pot: potionCost(id)` ＋ `debt: c.debt || 0`（軽減なし）＝**既にこの一般則どおり**。

ルールブックが**この5枚を名指しした公式例**（`rulebook.txt` L103-107・英語wiki `Debt` と逐語一致）：
> - Kate has [$6] and buys Daimyo, which costs [6D]. She takes [6D], then immediately pays off [4D] with her [$4].
>   She still has [2D]. On her next turn, in her Buy phase, she has [$5]. She pays off the remaining [2D] and has [$3] left,
>   with which she buys a Silver.
> - **Craftsman can't gain a Mountain Shrine, because [5D] is not "up to [$5]."**
>   **Poet cannot draw a Mountain Shrine, because [5D] is not "up to [$3]."**
>   **Change can't gain a Mountain Shrine, no matter what you trash, because Mountain Shrine doesn't cost any [$].**
> - **Flourishing Trade lowers costs, but has no effect on the cost of Daimyo.**
> - **Tanuki trashing an Artist can gain a Daimyo, because Daimyo does cost "up to [$2] and [8D]."**

> **⚠ 実装＝本アプリの `costUpTo(state, id, coin, spec)` / `costUnder` / `costExact`（`js/engine.js` L4466-4479）が
> この規則をそのまま実装している**（`costLE` が coin/pot/debt を**成分別**に比べ、`spec` 省略時は `pot:0, debt:0`）。
> - 既定のまま使えば **Craftsman / Poet / Change の3裁定は自動的に正しくなる**（負債コストは候補に出ない）。
> - ⚠ **狸(Tanuki)・金継ぎ(Kintsugi) の「$2高いカードまで」だけは `spec.debt` を渡さないと公式に反する**＝
>   `costUpTo(state, id, base.coin + 2, { pot: base.pot, debt: base.debt })`。
>   渡し忘れると **Artist(8D) を廃棄しても Daimyo(6D) が候補から消える**（公式例が名指しする経路）。
>   `costUpTo` の `spec` を使っている前例＝略奪の「これより安い」系（`underRef`）。

> **⚠【追記】`spec` が要るのは `costUpTo` だけではない＝`costUnder` / `costExact` も同じ**（この群で一番静かに詰む所）。
> 上で自分が引用した `**[6D] does however cost more than [$0]**; there is an implicit [$0] in all pure [D] costs` は、
> **「これより安いカードを獲得」で純負債コスト札を参照したとき、$0 の札（銅貨／呪い／避難所…）が候補になる**という規則そのもの。
> - `costUnder(state, id, coin, spec)`（L4472-4475）は **`spec` 省略時 `{pot:0, debt:0}`** ＝
>   純負債札を基準にすると `costLT(x, {0,0,0})` になり**候補が必ずゼロ**になる。**node で実測**：
>   ```
>   costUnder(st,'copper', 0, {pot:0, debt:8})  → true    // 公式どおり（8D は $0 より高い）
>   costUnder(st,'copper', 0)                   → false   // spec 省略＝候補ゼロ
>   ```
>   ＝**石工／墓暴き／リッチ／地下墓所／取り壊し のような「これより安い」札で Daimyo(6D)・Artist(8D) を
>   参照すると、候補ゼロの pending が開いて人間が詰む／CPU が livelock**（PROGRESS が繰り返し踏んでいる形）。
> - **既存の呼び出し18箇所のうち、参照カードのコストを持つものは既に `ref`（3成分）を渡している**
>   （L8238／L8390／L9782／L10118／L14846／L14857／L15252／L17830／L17840／L18303／L19513）。
>   素の `coin` だけを渡している側（L4600／falconer L6950・L18826／border_village L9417／L9751／
>   呪符の巻物 L13824）は**参照が自分自身の素のコイン費用**なので今は無害。**新規実装は必ず `ref` 形にすること。**
> - `costExact(state, id, coin, pot, debt)`（L4477-4479）は **pot/debt が独立引数**＝
>   行進が `costExact(state, id, mx, tref.pot, tref.debt)` と渡しているのが正しい形。
>   「ちょうど$1高い」で 6D を参照したら答えは `$1 + 6D` ＝該当なし（＝$1 の札が誤ヒットしない）。

#### (c) 日の出トークン（`+1 [Sun]`）＝Mountain Shrine だけが持つ

`rulebook.txt` L118-126 の逐語：
> - "+1 [Sun]" means, remove a token from the Prophecy. Then if it was the last token, the rules text on the Prophecy becomes active, **right then and for the rest of the game**.
> - **"+1 [Sun]" always appears first on Omens, before anything else the card does.**
> - "+1 [Sun]" does nothing else once all the tokens are removed.
> - Prophecy text does nothing until the last Sun token is removed.

---

### Mountain Shrine ／ 山の社  （$0＋負債5＝`[5D]`・アクション-前兆(Omen)）

- **英語カード文（逐語）**：
```
+1 [Sun]
+$2
You may trash a card from your hand. Then if there are any Action cards in the trash, +2 Cards.
```
  （生HTML＝`<b>+1{Sun}</b><br /><b>+{$2}</b><p>You may trash a card from your hand. Then if there are any Action cards in the trash, <b>+2&#160;Cards</b>.</p>`。`+2 Cards` のみ太字。）
- **日本語カード文（DO訳）**：
```
+1 Sun
+2 コイン
手札1枚を廃棄してもよい。
その後、廃棄置き場にアクションカードがある場合、+2 カードを引く。
```
  （日本語種別＝**アクション-前兆**。`Omen` の公式和名は「前兆」）
- **区切り線**：**0本**（`raw_MountainShrine.html` の `<hr` は 0 件。**対照実験で方法の妥当性を確認済み**＝
  同拡張の Fishmonger 5／Riverboat 4／Alley 4／Ninja 4／Ronin 4／Tanuki 4 は検出できる）
- **版**：English versions 表は**データ行1行**（`Changes = First edition`／`Announced + Printed`（colspan=2）`= August 2024`／`Digital` 空欄）＝**機能エラッタ無し**。
- **公式FAQ・裁定**（全文）：
  > This costs [5D]; see the Debt section.
  >
  > **It doesn't matter who trashed an Action or when, just that there is one in the trash.**
  > **The Action in the trash can be one you just trashed with the same play of Mountain Shrine.**

  **Other rules clarifications**（担当5枚のうちこの節があるのは Mountain Shrine だけ・全文）：
  > **If you trash a Fortress or Lich with Mountain Shrine, it will leave the trash *before* Mountain Shrine checks
  > if there are any Actions in the trash.**

  **Trivia / Preview**（逐語）：
  > Mountain Shrine, another Omen, is a trasher that powers up as soon as **anyone's** put an Action card into the trash.
  > — Donald X. Vaccarino, *Rising Sun Previews 3: Debt and Events*, August 2024

  **Trivia / Secret history**（設計意図の裏取り＝「自分が廃棄したか」ではなく「今あるか」が最終形）：
  > At first it cared if you'd personally trashed an Action this game. Also it had no +1 [Sun] and cost [$4].
  > Then it cost [$5], then gained the +1 [Sun]. It was like that for a while. Caring about Actions in the trash
  > very mildly upped the player interaction in the set, while getting rid of the no-tracking situation.

  ルールブックのカード別注記（`rulebook.txt` L314）は Official FAQ と**逐語一致**（追加情報なし）。

#### ⚠ 実装で危ないところ（Mountain Shrine）

1. **`+1 Sun` → `+$2` → 廃棄 → 判定 → `+2カード` の順を必ず守る**（`"+1 [Sun]" always appears first on Omens`）。
   **最後の日の出トークンを取り除くと予言(Prophecy)がその場で有効化される**ので、
   予言の効果（例＝来寇 Approaching Army の「アタックを使用したとき +$1」）が
   **この Mountain Shrine の残りの効果に間に合う**。順序を入れ替えると静かにズレる。
2. **【検証doc ③で訂正】リッチ(Lich)の心配は要らない＝素直に書けば公式どおりになる。**
   `js/engine.js` の `triggerOnTrash` は **`removeOne(state.trash, 'lich')` を同期的に実行して `return false`** し、
   `state.onTrashQueue` に積むのは**「廃棄置き場からこれより安いカードを獲得する」段だけ**。城塞(Fortress)も
   同じく同期的に手札へ戻って `return false`。
   ＝**`trashCard(...)` から戻った直後に `state.trash` を走査すれば
   `it will leave the trash before Mountain Shrine checks` に自動的に一致する。**
   ⚠ 逆に「`onTrashQueue` の消化後まで判定を遅らせる」と**かえって公式から外れる**
   （リッチが廃棄置き場から獲得した後の中身を数えてしまう）。
   ＝収集doc の「リッチがまだ trash に残るので公式と逆になる」という警告は**事実と逆なので採用しない**。
3. **廃棄は任意だが、判定は廃棄しなくても必ず走る**。
   ＝「手札0枚だから窓を開かない」で終わらせてはいけない（**廃棄0枚でも trash にアクションがあれば +2カード**）。
   逆に**手札0枚で廃棄 pending を開いて閉じられなくすると人間が詰む**（PROGRESS の農地 `FARMLAND_TRASH`／
   拡大(Enlarge) と同型の [high] 事故）。**手札があるときだけ pending を開き、無ければその場で判定して終える**。
4. **廃棄が別の窓を開く**（青空市場／納骨堂／地下墓所／狩場／従者／ごますり／リッチ…）＝
   **reducer は廃棄の前に `state.pending = null` にする**（PROGRESS §P1b「賞品のヤギ」と同型）。
5. **廃棄置き場に最初からアクションが入っている王国がある**＝夜想曲の**ネクロマンサー**は準備で
   **ゾンビ3種（`types: ['action','zombie']`＝`js/cards.js` L1000-1004）を `state.trash` に置く**。
   ＝ネクロマンサーがある王国では **ターン1から常に +2カード**。これは公式どおりだが、
   「自分の廃棄結果だけを見る」実装を書くと静かに公式と食い違う。**必ず `state.trash` 全体を見ること。**
6. **「アクションカードか」は動的種別に注意**＝相続(Inheritance)の屋敷・資本主義(Capitalism)。
   本アプリの `DOM.isType`（`js/cards.js` L2508）は**完全に静的**。
   略奪で作った **`typeCountFor(state, pi, id)`（`js/engine.js` L450-457）が動的種別を扱う唯一の前例**で、
   公式逐語 `Inheritance, Capitalism, and Charlatan will add types to cards.` を根拠にしている。
   ただし**廃棄置き場のカードは誰のものでもない**ので「相続した屋敷」を trash で判定するのは筋が悪い＝
   **静的 `DOM.isType(c,'action')` のままにして許容簡略化として PROGRESS に書く**のが現実的（mix-all 限定の差）。
7. **コストは `$0 + 負債5`＝コイン成分ゼロ**。`costUpTo` 既定（負債0）で自動的に候補から外れる＝
   Craftsman/Poet/Change の3裁定は無対応で正しくなる。**素の `cardCost(state,id) <= N` を書くと壊れる。**
8. **【新 pending が必須＝4点セット】**「廃棄してもよい **→ その後** 廃棄置き場を見て +2カード」＝
   **後続処理を持つ任意廃棄**なので、既存の任意廃棄 pending をそのまま流用できない。
   - 形がいちばん近いのは **`prize_goat`（賞品のヤギ・略奪）**＝
     engine `applyTreasureEffect` L876-878 で pending を立てる／reducer `PRIZE_GOAT_TRASH` L12947／
     `PLAYER_ACTIONS`（L21271 の Set に `'PRIZE_GOAT_TRASH'` が入っている）／CPU `decidePending` L1483／
     UI `viewPendingModal` L1923-1925（**「廃棄しない」ボタン付き**）。
     家宝のヤギ `goat_trash`（engine L1071／reducer L19655／CPU L2692／UI L2725）も同型。
   - ⚠ **どちらも「廃棄したら終わり」で後続が無い**＝`next` を取る汎用の任意廃棄 pending は本アプリに存在しない
     （`grep` で確認）。**山の社は自前の pending を1つ足し、その reducer の末尾で `state.trash` を判定して
     `+2カード` まで進めること。**
   - **必須の4点セット＝engine reducer ＋ `PLAYER_ACTIONS` への登録 ＋ CPU `decidePending` ＋
     UI `viewPendingModal`**（CLAUDE.md の必須条件。欠けると **CPU 無限ループ／人間が詰む**）。
   - **廃棄は任意なので「廃棄しない」ボタン（辞退）が必ず要る**（`prize_goat` の UI がそのまま雛形）。
     さらに上の 3 のとおり**手札0枚では窓を開かない**こと（候補ゼロで開くと辞退ボタンがあっても事故りやすい）。
9. **id 候補 `mountain_shrine`**＝既存761枚と衝突なし。紛らわしい既存id＝`mountain_village`（山村・ルネサンス・`js/cards.js` L788）。
   **同拡張の `river_shrine`（川の社・$4）と対の名前**なので取り違えに注意。
   ⚠ **表示名で一番紛らわしいのは夜想曲の祝福 `the_mountains_gift`＝「山の恵み」**（`js/cards.js` L2221）＝
   「山の社」と1文字違い＝**カード一覧の全文検索で必ず混ざる**（機能影響は無い／id 衝突も無い）。

---

### Daimyo ／ 大名  （$0＋負債6＝`[6D]`・アクション-命令(Command)）

- **英語カード文（逐語）**：
```
+1 Card
+1 Action
The next time you play a non-Command Action card this turn, replay it afterwards.
```
  （生HTML＝`<b>+1&#160;Card</b><br /><b>+1&#160;Action</b><p>The next time you play a non-Command Action card this turn, replay it afterwards.</p>`）
- **日本語カード文（DO訳）**：
```
+1 カードを引く
+1 アクション
このターン、次に命令でないアクションカードを使用したとき、それを再使用する。
```
  （日本語種別＝**アクション-命令**）
- **区切り線**：**0本**
- **版**：English versions 表はデータ行1行・`First edition`・`August 2024` ＝**機能エラッタ無し**。
- **公式FAQ・裁定**（全文・4段落。この順序）：
  > **This isn't optional**; whatever that next non-Command Action card is, Daimyo replays it.
  > **It replays it even if the card trashed itself.**
  >
  > **Command cards, such as Daimyo itself, are not replayed**; Daimyo waits for a non-Command Action card
  > **(or fails to do anything more if the turn ends before you play one)**.
  >
  > **If you play two Daimyos and then e.g. a Craftsman, you'll play the Craftsman three times total**
  > - once normally and once for each Daimyo.
  >
  > Daimyo costs [6D]; see the Debt section.

  （`rulebook.txt` L248 のカード別注記と逐語一致。`Other rules clarifications` の節は**存在しない**。）

- **【最重要】持続を再演したときの一般ルール**
  `rulebook.txt` L170-179（**ルールブックは "such as Daimyo" と1枚しか挙げていない**）：
  > Duration cards are not discarded in Clean-up if they have something left to do on a future turn;
  > they stay in play until the Clean-up of the last turn that they do something.
  >
  > Additionally, **if a Duration card is played extra times by a card such as Daimyo, that card also stays in play
  > until the Duration card is discarded**, to track the fact that the Duration card was played extra times.
  > Keep track of whether or not a Duration card was played on the current turn, such as by putting your cards into two lines.

  **英語wiki 拡張ページ（`_expansion.txt` L737-761）だけが持つ追記2文＋列挙**（＝拡張ページのほうが新しい）：
  > If a Duration card leaves play somehow, it stops doing things on future turns.
  >
  > …by a card such as **[Throne Room, Scepter, Mastermind, Specialist, Flagship, or Daimyo]**, …
  > **and that effect also ends if that card somehow leaves play.**

  ＝どちらも "such as"（例示）なので**機能差はゼロ**。ただし
  **「Daimyo 自身が場を離れたら再演ぶんの持続効果も止まる」は拡張ページにしか無い**（訂正⑦）。

- **`Throne Room variant` ページ（Double-playing a card）＝Daimyo はここに `Daimyo — An Action` として分類されている**：
  > **Duration cards**: … **If Throne Room is used on Hireling, which stays in play permanently, then the Throne Room
  > will also stay in play permanently, and the player will receive +2 cards at the start of each turn.**
  > If a Throne Room variant is used to play another Throne Room variant twice and then play a Duration card each time,
  > only the Throne Room variant that played the Duration card directly stays out; the first Throne Room variant does not.
  >
  > If a Throne Room variant is used to replay a Duration card, and then the Throne Room variant is somehow removed from play
  > **before** the Duration card is, **only one instance of the Duration card's future-turn effects will take place.**
  >
  > **Cards that leave play**: Throne Room variants are a special exception to the rule that a card can't be played if the
  > stop-moving rule prevents it from entering the play area. … However, **abilities that are contingent on the card moving
  > itself somewhere else, such as those of Mining Village or Madman, can only activate once**.

- **`Command` ページ（種別の一般ルール・逐語）**：
  > Command is a card type introduced by the 2019 Errata. Command cards are cards that can play other cards without altering
  > the physical state of the game. Most of them are Command variants.
  > **Giving those cards a type allows their abilities to restrict playing each other in infinite loops.**

  **`List of Commands`（自分で再取得＝計8種。Daimyo は8つ目）**：
  > - Band of Misfits, Captain, Overlord — Play a card from the Supply.
  > - Prince — Plays a set-aside card at the start of each turn.
  > - Estate under the influence of Inheritance — Plays a set-aside card.
  > - Scepter — Plays a card that is already in play.
  > - **Daimyo, Flagship — Replays the next played card.**

  **`Corner cases`（＝Command ではないので Daimyo の対象になるカード）**：
  > Some cards nearly qualify as Commands, but not totally and so do not need the Command type.
  > **Necromancer** may become a Command card, as it plays cards without properly moving them. But it still turns them around
  > to change the physical state of the game and mostly inhibits loops this way.
  > **Royal Carriage** plays cards without moving them, but moves itself.

- **Trivia / Preview**：
  > Daimyo is the cantrip version of Flagship you didn't know you needed. Unlike Flagship it lets you play the card you're
  > going to repeat, with no other tricks needed; **you can go Daimyo, Daimyo, Mountain Shrine, and you're playing that
  > Mountain Shrine three total times.**

- **Trivia / Secret history**（＝下の ⚠6「Command を除外するのは無限ループ防止」の設計意図の裏取り。自分で再取得＝`m_kdebt_fetch2.txt` L819-829）：
  > The initial idea was a cantrip Throne Room for [8D]. **It's too confusing when used on itself, and also too powerful
  > when used on itself.** We know how to Throne Thrones, we'd get that part right; but I personally had endless trouble
  > remembering all of the draws you get in the middle of other things happening. The fix was to make it a Flagship.
  > **It can't play itself**, and it's just overall simpler and fairer, while also being nicely different from Flagship.

#### ⚠ 実装で危ないところ（Daimyo）

1. **下敷きは 略奪の旗艦(Flagship)**（`js/engine.js`）。同じ部品をそのまま使う：
   `armNextTime(state, pi, cardId, trigger)` L2181 ／ `ntMatches` L2191 ／ `fireNextTime` L2213 ／
   `applyNextTime` L2245（`flagship` 分岐＝L2298-2311）／
   `notePlunderPlay(state, pi, card)` L2318（**全プレイ経路から呼ばれる通知点**）。
   再演は `state.replay.push({ player, card, label, viaCommand })` ＝**1回目の解決後に `runReplays` が適用**する。
   ⚠ `ntMatches` の `play_action` 分岐は現在 **`return e.card === 'flagship' && ctx.player === seat;`**（L2207）＝
   **カードidを名指しで書いてある**ので、Daimyo を足すには**ここも直す**（`(e.card === 'flagship' || e.card === 'daimyo')`）。
1b. **【M4・押す側だけでは1行も走らない】`state.replay` は `runReplays` が「ラベルで分岐して」消費する。**
   `runReplays`（L12050-）の中に **`if (r.label === 'flagship') { … }`（L12136-12148）** があり、そこで
   - `state.turn.actionsPlayed++`（＝再演も「アクションの使用」に数える）
   - ログ出力
   - `r.viaCommand` があれば **`playAsCommand(state, r.player, r.viaCommand, r.card)`**（サプライに残したままの再演）
   - そうでなければ `noteAllyPlay` → **`state._replaying = true`** → `applyEffect` → `delete state._replaying`
   を行っている。**`daimyo` 用のラベル分岐（または `r.label === 'flagship' || r.label === 'daimyo'`）を足さないと
   予約は積まれても再演は起きない。**
   ⚠ `state._replaying` は「**命令カードが再演では何として使うかを選び直さない**」ための旗（`replayCommandAs`）と、
   操舵手が「再演では新インスタンスを作らない」ための旗（L4871）を兼ねている。
   **Daimyo は Command を再演しないので前者の用途では不要だが、旗艦の分岐をコピーすると付いてくる**＝
   **後者（操舵手・玉座と同じ「再演では脇を増やさない」）には必要**なので**消さないこと**。
2. **【最大の差】旗艦は "even in a later turn"、Daimyo は "this turn"。**
   旗艦は `armNextTime` で `p.delayedEffects` に積み、**条件が起きるまで何ターンでも持ち越す**
   （`resolveDurationStartEffects` が `nextTime` 付きの予約を消費しない＝L7985-7986）。
   Daimyo をそのまま同じ器に載せると**予約が翌ターンへ漏れて、存在しない再演が湧く**。
   公式FAQ逐語＝`(or fails to do anything more if the turn ends before you play one)` ＝
   **使い切れなかった Daimyo の予約は、そのターンの片付けで必ず捨てる**
   （PROGRESS §0-21「航海の予約を持ち越すな」／§0-26 と同型）。
3. **【最も踏みやすい罠】Daimyo は `duration` 種別を持たない（`Action - Command`）。**
   本アプリの `cleanupAndAdvance` の持続仕分け（`js/engine.js` **L10462-10466**・関数名で grep すること）は
   ```js
   for (const c of p.inPlay) {
     if (DOM.isType(c, 'duration') && (used[c]||0) < (cnt[c]||0)) { newDur.push(c); ... }
     else restInPlay.push(c);   // ← 捨てられる
   }
   ```
   ＝**`inPlay` から `durationCards` へ移すには「印刷された `duration` 種別」が要る**。
   旗艦は `types: ['action','duration','command']`（`js/cards.js` L1198）なので `flagship_linger` が機能しているが、
   **Daimyo に `daimyo_linger` を積んでもこの `DOM.isType(c,'duration')` ゲートで弾かれて捨てられる**。
   → 条件を `(DOM.isType(c,'duration') || (cnt[c]||0) > 0)` に緩める等の**共通修正が要る**
   （**旗艦・玉座の既存挙動を壊さないこと**を回帰テストで固定する）。
   ※ 旭日には**同じ形の札がもう1枚ある**＝川船(Riverboat) も持続だが、Daimyo は種別に `Duration` を持たない点が特殊。
4. **【linger の解除条件】永続持続を再演したときに linger を落としてはいけない。**
   `flagship_linger` の解除判定（**L10431-10437**）は
   「`withCard` と同じ card の**非linger予約が `p.delayedEffects` に残っているか**」で linger を残すか決めている。
   ところが**永続持続は `delayedEffects` を使わない**（`p.princes` / `p.hirelings` / `p.endlessChalices` /
   `p.champions` / `p.archives` / `p.quartermasters` の**稼働数カウンタ**）。
   ＝素朴に書くと **Daimyo で Samurai（永続持続）を再演したとき `withCard='samurai'` の予約が見つからず
   linger が即座に落ちて Daimyo が1ターンで捨てられる**。公式は逆で**Daimyo もゲーム終了まで場に残る**
   （`Throne Room variant` ページの Hireling の例がそのまま当てはまる）。
   > **⚠【2026-08-16・状況更新】この共通機構は「これから作る物」ではなく、`js/engine.js` の作業ツリーに
   > **別セッションが既に入れている**（コミット `ac8cf02`・**未push**）。`cleanupAndAdvance` の中に
   > **`const perm = {}`（L10420-10426）**＝永続持続の稼働数を**先に**集計するブロックが新設され、
   > linger の解除判定が `|| (perm[e.withCard] || 0) > 0` を見るようになった（L10435）。
   > 持続の仕分け側も `Object.keys(perm).forEach((k) => { cnt[k] = (cnt[k]||0) + perm[k]; });`（L10456）に集約済み。
   > ＝**Daimyo 側でやることは「`p.samurais` を `perm` に足す」＋「`daimyo_linger` を同じ filter の対象にする」だけ**。
   > **`perm` を無視して自前で書き直さないこと。** これは同時に**出荷済みバグの修正**でもある（下記「実バグ候補②」）。**
   **Daimyo と Samurai は同じ拡張＝必ず同居しうる**＝mix-all 限定の話ではない。
5. **強制（`This isn't optional`）**＝次に使った非命令アクションを**必ず**再演する。選ばせてはいけない。
6. **Command の除外は「無限ループ防止の必須条件」**（公式が種別を作った理由そのもの）。
   本アプリには旗艦の `DOM.isType(card,'command')` 除外が既にある（`notePlunderPlay`）。
   **公式の Command は Daimyo を含めて8種**（PROGRESS §0-30 の「8つ」は旭日**以前**の数え方＝訂正⑥）。
   ⚠ **`scepter`（王笏）は本アプリで既に `types: ['treasure','command']`**（`js/cards.js` L802・2024年版エラッタ対応済み）。
   ⚠ **「相続した屋敷」だけは動的**＝`inheritedEstate(p, cardId)`（`js/engine.js` L450 付近）を併用しないと漏れる。
   ⚠ 逆に **ネクロマンサー／御料車は Command ではない＝Daimyo の対象になる**（`Corner cases` 逐語）。
   ⚠ **同拡張の川船(Riverboat) も Command ではない**＝`List of Commands` は上の**8種で全部**（生HTMLで確認）。
   「`leaving it there`（サプライに残したまま使用）」という文面から命令型に見えるが**種別は付いていない**＝
   **Daimyo の再演対象になる**（川船の種別と本文は別群 `m3`/`m4` の担当。着手時に必ずそちらを見ること）。
7. **累積する**（`two Daimyos → Craftsman を計3回`）＝**予約は累積カウンタで持つ**。
   PROGRESS §0-29 A4 の「突貫は累積しない旗／鏡映は累積カウンタ＝**別実装**」の罠と同型。
   旗艦の `applyNextTime` は既に `k`（同時発火した予約数）ぶんループしているのでそのまま流用できる。
8. **「自身を廃棄したカードでも再演する」**（`It replays it even if the card trashed itself.`）。
   ただし**移動そのものは2回目に起きない**＝本アプリの `takeSelf` / `removeOne` ガード（PROGRESS §0-17）で自然にそうなる
   （鉱山の村の +$2・狂人のドローは2回目に出ない＝公式の `Mining Village or Madman` の例と一致）。
9. **cantrip なので `+1 Card` が先＝シャッフルが起きうる**。運命の(Fated)／回避(Avoid)／占星術師団・メイソン団と噛む（mix-all）。
   `reshuffleDeck` の戻り値（メイソン団が捨て札に残したか）を見る既存の作法を壊さないこと。
10. **コストは `$0 + 負債6`**。`Flourishing Trade lowers costs, but has no effect on the cost of Daimyo.`
    ＝**コスト軽減は coin 成分にしか効かない**（本アプリの `costOf` は `coin: cardCost(state,id)`（軽減あり）＋
    `debt: c.debt`（軽減なし）で既に正しい）。
11. **場に残った Daimyo は Artist にも Rice にも数えられる**（Rice の公式FAQ例に Daimyo が出てくる＝
    `Action` と `Command` の**2種別**を供給する）。
12. **id 候補 `daimyo`**＝既存761枚と衝突なし。

---

### Artist ／ 絵師  （$0＋負債8＝`[8D]`・アクション）

- **英語カード文（逐語）**：
```
+1 Action
+1 Card per card you have exactly one copy of in play.
```
  （生HTML＝`<b>+1&#160;Action</b><p><b>+1&#160;Card</b> per card you have exactly one copy of in play.</p>`
  ＝**`+1 Card` だけが太字**で `per card …` は同じ行の平文。2行構成。）
- **日本語カード文（DO訳）**：
```
+1 アクション
1枚だけ場に出しているカード1枚につき +1 カードを引く。
```
  （日本語種別＝**アクション**のみ＝新種別は増えない）
  ⚠ **ホビージャパン印刷版と文面が違うと記録されているカードの1枚**（commit `87bc323`）。
  日本語wiki の「絵師」ページを取り直したが、HJ版テキストを載せた「余談」節は無い
  （節構成＝`利用法` / `詳細なルール` / `コメント`。`m_jp_rice_artist.txt` で確認）。
- **⚠【差異の中身が判明】英語wiki の `Language versions` 表に、担当5枚のうち Artist だけ日本語カード文が転記されている**
  （他4枚は日本語名と日本語カード画像だけ＝生HTMLで機械確認。5枚とも `<name>Japanese.jpg` の画像はある）。
  **その転記元は実物の日本語カード画像 `ArtistJapanese.jpg`＝＝つまりこれが HJ 印刷版のテキスト**（`v_kdebt_out1.txt` L797-801 逐語）：
```
+1 アクション
あなたの場に1枚だけ出ているカード1種類につき、＋1 カードを引く。
```
  ＝DO訳「**1枚だけ場に出しているカード1枚につき**」との差は **「カード1種類につき」／「カード1枚につき」**の1語だけ。
  **どちらも意味は同じ**（数えるのは「ちょうど1枚だけ場にあるカードの**種類数**」）＝**機能差ゼロ**。
  むしろ HJ版の「1種類につき」のほうが誤読しにくいが、**本プロジェクトの方針どおり DO訳を採用**する
  （方針を変えるなら5枚一括で変えること。1枚だけ HJ版にすると表記が割れる）。
  ⚠ ただし PROGRESS §0-28 に「**英語wiki の Japanese 行は夜想曲で17枚が実物と食い違った**」という前科があるので、
  「英語wiki の Japanese 行＝必ず HJ 印刷版」と断定はしない（この1枚は**カード画像が同じページに載っている**ぶん信頼度は高い）。
- **区切り線**：**0本**
- **版**：English versions 表はデータ行1行・`First edition`・`August 2024` ＝**機能エラッタ無し**。
- **公式FAQ・裁定**（全文）：
  > This costs [8D]; see the Debt section.
  >
  > **This counts itself, if you have exactly one Artist in play.**
  >
  > **This counts cards played on other turns that are still in play, such as a Samurai from a previous turn.**

  （`rulebook.txt` L210 と逐語一致。`Other rules clarifications` の節は**存在しない**。）

  **拡張ページ（Debt 節）が名指しする裁定**：
  > **Tanuki trashing an Artist can gain a Daimyo, because Daimyo does cost "up to [$2] and [8D]."**

  **Trivia / Secret history**（設計意図の裏取り）：
  > The first version cost [$5]. … **I flipped it to wanting the actions already in play** in order to improve gameplay,
  > and charged [8D] for that version, and that worked out. **A late change was counting all cards rather than just actions**,
  > since that seemed simpler.
  > ＝**種別を問わず「すべてのカード」を数えるのが最終形**（銅貨も数える）。

  **英語wiki の解説文（＝テストの期待値に効く）**：
  > It provides a variable amount of non-terminal draw, depending on what cards you have in play: it draws one card per
  > unique card in play, making it strong if you have a large variety of cards; on the other hand,
  > **if you have no unique cards in play it draws nothing at all!**

  ＝**0枚ドローは異常系ではなく正常系**（銅貨3枚だけの場なら +0カード）。
  「候補ゼロだから窓を開かない」といった補正を入れてはいけないし、テストでも 0 を期待値として固定すること。

  **日本語wiki の「詳細なルール」**（`m_jp_rice_artist.txt`・実装に効くもの）：
  > 分割された山札や騎士のように**同じ山札に由来するカードでも、カードに印刷された名前が異なれば
  > 「異なるカード名のカード」として数える**。
  >
  > はみだし者／大君主は、使用されると場を離れるまでカード名を含めて「はみだし者／大君主で選んだカード」として
  > **扱われなくなった**ので注意が必要（2019年エラッタ）。
  >
  > 「相続した屋敷」は、相続後も**カード名は『屋敷』のまま**。

#### ⚠ 実装で危ないところ（Artist）

1. **【最良の前例あり】`magic_lamp`（魔法のランプ・夜想曲の家宝）が同じ数え方を既に実装している**
   （`js/engine.js` L1074-1078）：
   ```js
   const cnt = {};
   p.inPlay.concat(p.durationCards || []).forEach((c) => { cnt[c] = (cnt[c] || 0) + 1; });
   const singles = Object.keys(cnt).filter((k) => cnt[k] === 1).length;
   ```
   魔法のランプの公式文も `cards that you have exactly one copy of in play` ＝**完全に同型**。
   **この形をコピーするのが正解**（できれば共通ヘルパに切り出して両方から呼ぶ）。
2. **`new Set(場).size` と書いてはいけない**＝それは「**異なる名前の数**」で**別物**。
   本アプリには `horn_of_plenty`（豊穣の角・`js/engine.js` L844）が
   `new Set(p.inPlay.concat(p.durationCards || [])).size` を使っている＝**これを流用すると銅貨3枚が「1」に数えられて過大**になる。
   （Artist は銅貨3枚なら**0**、銅貨1枚なら**1**。）
3. **「場」＝`p.inPlay` ＋ `p.durationCards` の両方**。公式FAQ が `such as a Samurai from a previous turn` と
   前ターンの持続を名指ししている。**片方だけ数えると静かにズレる**
   （PROGRESS §0-29 A4「soldier が `durationCards` を無視していた [low]」と完全に同型）。
   本アプリの定型は `const inPlay = p.inPlay.concat(p.durationCards || []);`（L461）。
   ⚠ **永続持続（雇人／尽きぬ杯／チャンピオン／王子／操舵手／資料庫／Samurai）は片付けで `durationCards` に
   物理カードが残る**（L10424-10434）ので、この式で正しく拾える。
4. **脇に置いたカードは「場」ではない**（貨物船／王子の脇／研究／操舵手の脇／準備／島マット／酒場マット上の未使用リザーブ）。
   本アプリにも既存コメントがある（L458 付近「脇置き（貨物船/王子など）は場ではない」）。
   ⚠ ただし**酒場マットから「呼び出した」リザーブカードは場にある**（日本語wiki の詳細ルール）。
5. **自分自身を数える**＝**Artist を場に出した後に数える**。
   玉座／Daimyo で2回目を使っても**場の Artist は依然1枚**なので2回目も自分を数える。
   逆に**Artist を2枚場に出すとどちらも自分を数えない**（枚数2＝「ちょうど1枚」でない）。
6. **種別を問わない**＝財宝も勝利点も避難所も数える。
   アクションフェイズに財宝を出す経路（闇市場／語り部／王笏／悟り Enlightenment／継続 Continue）があると場の財宝が入る。
7. **`+1 Action` が先、ドローが後**。ドローでシャッフルが起きうる。
8. **コストは `$0 + 負債8`＝本アプリで最大級の負債**（既存＝帝国の大君主 8D／王室の鍛冶屋 8D）。
9. **id 候補 `artist`**＝既存761枚と衝突なし。
   ⚠ **一番紛らわしい既存idは `artisan`（職人・基本第二版・`js/cards.js` L159）＝1文字違い**（訂正⑨）。
   `artificer`（工匠・冒険・L642）よりはるかに取り違えやすい。

---

### Samurai ／ 侍  （$6・アクション-持続-アタック）

- **英語カード文（逐語）**：
```
Each other player discards down to 3 cards in hand (once).
At the start of each of your turns this game, +$1.
(This stays in play.)
```
  （生HTML＝`Each other player discards down to 3&#160;cards in hand (once).<p>At the start of each of your turns this game, <b>+{$1}</b>.</p><p><i>(This stays in play.)</i></p>`
  ＝`(This stays in play.)` は `<i>`＝**イタリック（リマインダー文）**。）
  ⚠ **`Card text` 節は `(This stays in play.)`（ピリオドあり）／`Versions` 表の Text 欄は `(This stays in play)`（無し）**
  という食い違いがあるが、**RGG ルールブック `rulebook.txt` L485 と実物カード画像（`m_samurai.jpg`）はピリオドあり**
  ＝**ピリオドありが正**（Versions 表側が wiki の写し落ち）。機能差はゼロ。
- **日本語カード文（DO訳）**：
```
他のプレイヤーは全員、手札が3枚になるように捨て札にする(1度のみ)。
ゲーム終了まで、あなたのターンの開始時に、+1 コイン。
(このカードは場に残り続ける。)
```
  ⚠ **日本語wiki のヘッダ表は種別を「アクション-アタック」と書き、カード文の途中に「持続」を挟んでいる**が、
  **実物カードの種別行は `Action - Duration - Attack`**（`m_samurai.jpg` で目視確認済み・英語wiki の `Type(s)` も同じ）。
  ＝日本語wiki の表の作りの都合であって、**種別は アクション-持続-アタック の3つ**。
  Rice の種別数え上げに直結するので取り違えないこと。
- **区切り線**：**0本**（実物カード画像でも**横線は入っていない**＝3つの段落が並ぶだけ。
  持続カードなので入っていそうに見えるが実際は無い）。
- **版**：English versions 表はデータ行1行・`First edition`・`August 2024` ＝**機能エラッタ無し**。
- **公式FAQ・裁定**（全文）：
  > When you play a Samurai, each other player discards down to 3 cards in hand.
  >
  > After that the Samurai stays in play, and produces +[$1] at the start of each of your turns for the rest of the game.
  >
  > **It doesn't make players discard again.**

  （`rulebook.txt` L468-469 と逐語一致。`Other rules clarifications` の節は**存在しない**。`Preview` 節も**存在しない**。）

  **Trivia / Wording**：
  > It's always great to include text that helps players actually understand the card. I thought we could do without
  > "this stays in play"; we could not. — Donald X. Vaccarino, Dominion Discord, August 2024

  **Trivia / Secret history**：
  > And easily my favorite was the final card. **It only attacks once ever; that's different.** And well +[$1] Hireling
  > has been waiting patiently to finally be a card. … It cost [$5] for a while before I bumped it up to [$6],
  > after losing to Samurai stacks too many times.

  **持続の一般ルール（場を離れたら止まる）**＝英語wiki 拡張ページ（`_expansion.txt`）：
  > If a Duration card leaves play somehow, it stops doing things on future turns.

#### ⚠ 実装で危ないところ（Samurai）

1. **永続持続（ゲーム終了まで場に残る）＝`armDuration` で書いてはいけない。**
   本アプリの同型は **王子 `p.princes`／雇人 `p.hirelings`（冒険）／チャンピオン `p.champions`（冒険）／
   資料庫 `p.archives`（帝国）／尽きぬ杯 `p.endlessChalices`（略奪）／操舵手 `p.quartermasters`（略奪）**。実装は
   ```js
   p.samurais = (p.samurais || 0) + 1;                          // プレイ時（js/engine.js L6684 の雇人と同じ形）
   if (p.samurais) perm.samurai = p.samurais;                   // cleanupAndAdvance の `perm`（L10420-10426）に足す
   ```
   ＋ `resolveDurationStartEffects`（L7968-）で `if (p.samurais) addCoins(state, p.samurais);`
   （L7996 の尽きぬ杯と同じ位置＝**開始時に日の出／予言より後**にならないよう既存の並びに合わせる）。
   ⚠ **`t.coins += n` を直接書かない＝必ず `addCoins(state, n)`**（PROGRESS §0-25 の雪深い村／カメレオンの習性）。
1b. **【M1・見落とし必至】永続持続の列挙は engine に「2箇所」ある。片方だけ足すと増築(Improve)が壊れる。**
   - ①`cleanupAndAdvance` の **`perm`（L10420-10426）**＝持続の仕分けと旗艦 linger の解除判定が見る。
   - ②**`stayingCounts(state, pi)`（L11525-11536）**＝**ルネサンスの増築(Improve)** の廃棄候補
     `improveTargets`（L11537-11543）が見る。増築は公式で
     `you may trash an Action card **you would discard from play this turn**` ＝
     **ゲーム終了まで場に残るカードは廃棄対象にならない**。
   - ⚠ **この2つは今なお別々のリテラルで、`stayingCounts` の側だけ `p.quartermasters` を取りこぼしている＝
     出荷済みの実バグ**（下記「実バグ候補①」・node で再現済み）。
     **`p.samurais` は必ず両方に足す**（できれば `perm` を関数に切り出して `stayingCounts` から呼び、
     **リストを1本化するついでに操舵手のバグも直す**）。
2. **【最重要】Daimyo／玉座／王笏／専門家／Mastermind で再演すると、その再演カードも永続的に場に残る。**
   ＝**Samurai 側を単なる稼働数カウンタにすると、再演カードの linger が「相手の予約が尽きた」と誤判定して落ちる**
   （Daimyo の危ないところ 4 と同じ話・**同じ拡張なので必ず同居しうる**）。
   > **⚠【2026-08-16・状況更新】この判定は作業ツリーで既に一般化されている**＝
   > `flagship_linger` の解除が `|| (perm[e.withCard] || 0) > 0` を見る（L10435）。
   > ＝**`p.samurais` を `perm` に足しさえすれば、旗艦・Daimyo の linger は自動的に正しくなる。**
   ⚠ ただし **`+$1` の枚数（＝Samurai の稼働数）と、ぶら下がっている再演カードの枚数は別物**。
   Samurai を再演すると **+$1 の稼働数も増える**（下記 5）が、再演カード（旗艦/Daimyo）は
   `perm` を見て残るだけで稼働数には数えない。インスタンス単位の前例＝略奪の操舵手 `p.quartermasters = [{id, cards, plays}]`。
3. **アタックは「使用したときだけ」（`(once)`）。**
   ＝呪いの森／沼の妖婆／門番／フリゲート船が使う **`lingerAttackEnter`（相手のターンをフックする持続アタック）とは別物**。
   ここを取り違えると相手が毎ターン捨てさせられる。
   ⚠ ただし **`ATTACKS` への登録と、堀／灯台／チャンピオン／盾／番犬の免疫窓は必要**（使用した瞬間の1回だけ）。
4. **既存の `discardDownEnter(state, source, down, victims, next, drawAfter)`（`js/engine.js` L3306）を `down = 3` で流用できる**
   ＝民兵型。同拡張の忍者(Ninja) も「手札3枚まで」なので**同じ関数を共有する**
   （略奪の剣＝`down = 4`／フリゲート船＝`down = 4` が既存の前例）。
   ✅ **流用すれば新 pending は要らない＝4点セットは既に揃っている**（`discard_down` の reducer／`PLAYER_ACTIONS`／
   CPU `decidePending`／UI `modalDiscardDown`）。
   ⚠ **`modalDiscardDown` は `reactOptions` を通らず独自のボタン列を持つ**が、
   **堀・盾の免疫ボタンは PROGRESS §P1b（略奪 P1b）で3モーダルに塞ぎ済み**なので流用すれば自動で満たされる。
   **自前で捨てさせるモーダルを新設すると、その穴（engine と CPU は受理するのに人間だけ免疫を使えない）を再発させる。**
5. **再演すると攻撃も2回解決する**（通常は相手が既に手札3枚なので空振り）。
   **空振りでも +$1 の稼働数は2つ立つ**（＝カードの他の能力は普通に働く）。
6. **場を離れたら止まる**（公式＝`If a Duration card leaves play somehow, it stops doing things on future turns.`）。
   **⚠【M5・方針を先に決めること】本アプリの既存の永続持続は「場を離れても止まらない」で統一されている。**
   `grep` で確認＝**`p.hirelings` / `p.champions` はどこでも減算されていない**（代入は `+= 1` の1箇所ずつだけ＝
   engine L6684 / L6854）。＝**Samurai だけ減算を入れると雇人・チャンピオンと挙動が割れる。**
   選択肢は2つ。**着手時にどちらか決めて PROGRESS に書くこと**（決めずに書くと実装者が迷う）：
   - **(A) 既存に揃えて減算しない**＝許容簡略化として明記（PROGRESS §0-29 A4 の駐屯地トークンと同じ近似）。**推奨**。
   - **(B) 横断修正**＝`discardFromPlayRouted` / `trashCard` / `returnToPile` の「場から出る」共通経路で
     `p.hirelings` / `p.champions` / `p.samurais` … を一括で減らす。**回帰リスクは冒険・略奪の全域に及ぶ**。
   ⚠ **操舵手だけは既に (B) 相当**＝窓を開く条件が「場に操舵手が1枚以上あるか」を毎ターン見ている
   （L8016-8017）＝**カウンタは減らないが機能は止まる**。この形（カウンタは残し、使う側で場の枚数を見る）が
   最も安全＝**Samurai も `resolveDurationStartEffects` 側で
   `Math.min(p.samurais, 場の samurai 枚数)` を使う**のが (A) と (B) の中間として現実的。
   到達経路＝増築 Improve（ルネサンス）／玉座の再演／無謀な Reckless の山戻し（略奪）＝**いずれも mix-all**。
7. **場に残り続けるので Artist / Rice に恒久的に効く**（Artist の公式FAQ が Samurai を名指し）。
   **Rice には `Action` `Duration` `Attack` の3種別を供給する**＝日本語wiki の逐語
   「侍は永久に場に残り続け、置いてあるだけで米の4金（アクション、アタック、持続、財宝）が確定する」。
8. **id 候補 `samurai`**＝既存761枚と衝突なし。
   ⚠ 既存の `acolyte`＝**侍祭**（同盟）があるので、**カード一覧の全文検索で「侍」が両方にヒットする**（表示のみの話）。

---

### Rice ／ 米  （$7・財宝）

- **英語カード文（逐語）**：
```
+1 Buy
+$1 per different type among cards you have in play.
```
  （生HTML＝`<b>+1&#160;Buy</b><p><b>+{$1}</b> per different type among cards you have in play.</p>`
  ＝**`+$1` だけが太字**で `per different type …` は同じ行の平文。2行構成。）
- **日本語カード文（DO訳）**：
```
+1 購入
場に出しているカードの異なる種別1つにつき、+1 コイン。
```
  （日本語種別＝**財宝**のみ＝新種別は増えない）
  ⚠ **ホビージャパン印刷版と文面が違うと記録されているカードの1枚**（commit `87bc323`）。
  ただし**今回 日本語wiki の「米」ページを取り直したが、HJ版テキストを載せた「余談」節は無かった**
  （余談節の中身は「理論上の最大出力」の話だった）＝**差異の具体的内容は⚠未確定**。方針どおり **DO訳を採用**する。
  ⚠ **英語wiki の `Language versions` 表にも Rice の日本語カード文は無い**（日本語名「米」と
  カード画像 `RiceJapanese.jpg` だけ＝生HTMLで機械確認）＝**Artist と違って第2証言が取れない**。
  埋めるなら `File:RiceJapanese.jpg` を実見するしかない（段階1で日本語文を確定する必要は無い＝DO訳で進める）。
- **区切り線**：**0本**
- **版**：English versions 表はデータ行1行・`First edition`・`August 2024` ＝**機能エラッタ無し**。
- **公式FAQ・裁定**（全文＝1段落のみ）：
  > **For example, if you had a Daimyo, a Litter, a Fishmonger, three Coppers, and Rice in play, the types would be
  > Action, Command, Shadow, and Treasure, so Rice would make +[$4].**

  （`rulebook.txt` L359 と逐語一致。`Other rules clarifications` の節は**存在しない**。）
  **検算**＝Daimyo(`Action`,`Command`) ／ Litter(`Action`) ／ Fishmonger(`Action`,`Shadow`) ／ Copper×3(`Treasure`) ／
  Rice(`Treasure`) → 集合 `{Action, Command, Shadow, Treasure}` ＝ **4種別 → +$4**。
  ＝**Rice 自身の `Treasure` も数える**／**同じ種別は何枚あっても1回**。

  **Trivia / Preview**：
  > Rice can make you oodles of money, but would like you to field a variety of card types.
  > Let's see: **Action, Treasure, Omen, Shadow, Duration…**

  **日本語wiki の「詳細なルール」**（`m_jp_rice_artist.txt`・実装に直接効く。逐語）：
  > 米使用時には、あなたの場に出ているカード全てのカード種別をカウントする。このターン中に使用したカード以外でも、
  > 以下のカードは場に出ているカードである。
  > **・酒場マットから呼び出したリザーブカード ・前ターンから持続or旅行の効果で場に出続けているカード**
  >
  > **濡女など、使用はされたが場から移動したカードは、場に出ていないのでカウントされない。**
  > **各種マット上や、貨物船の効果などで脇に置かれたカードは、場に出ていないのでカウントされない。**
  >
  > **カード種別のカウントは米使用時に行われ、その時点で米の産出コイン量は確定する。**
  > 米使用後に場に出ているカード状況が変わった(あるいは場に出ているカードに種別が追加された)場合でも、
  > 米の産出コイン量が変化することは無い。
  >
  > （種別エラッタ）はみだし者／大君主／王子／Captain には[命令]が追加されている。
  > **※似たような効果をもつ、ネクロマンサーには命令が追加されていないので注意。**
  > **相続した屋敷の種類は必ず[アクション-勝利点-命令]の3種類になる**（2022年版エラッタ）。
  > **王笏のカード種別には[命令]が追加されており、(財宝-命令)となっている**（旭日発表に伴う2024年版エラッタ）。
  >
  > （見落としやすい種別）**家宝**（牧草地は勝利点も）／**避難所**（共同墓地＝アクション-避難所）／
  > **呪い**（山師場）／夜想曲の**夜行・幸運・不運・精霊**／各種**分割された山札**関係（廃墟・城・騎士を含む）。

#### ⚠ 実装で危ないところ（Rice）

1. **財宝の効果は `applyTreasureEffect(state, pIndex, card)`（`js/engine.js` L722）に書く。**
   `applyEffect` に書くと**財宝では呼ばれず空振りする**（PROGRESS §0-25 で実際に踏んだ）。
   金額が動的なので **`coin:` フィールド（静的コイン）では表現できない**。
   ⚠ `applyTreasureEffect` に書けば **ティアラ／冠／偽造通貨／王の隠し財産の「財宝を2回（3回）使う」でも
   自動的に正しくなる**（PROGRESS §0-15 で根治済みの `treasure_replay` 機構）。
2. **`playTreasureCard` は「移動 → `applyTreasureEffect`」の順**なので、**Rice 自身が自然に場に入ってから数えられる**
   ＝FAQ の「Rice 自身の Treasure も数える」は無対応で満たせる。
3. **数えるのは「種別」であってカードではない**。1枚が複数種別を供給する
   （Daimyo＝Action+Command／Fishmonger＝Action+Shadow／Samurai＝Action+Duration+Attack）。
   ＝**各カードの `types` を全部 `Set` に足して `size` を取る**のが正しい。
   ⚠ Artist の「ちょうど1枚」とは**まったく別の数え方**なので、ヘルパを共用しないこと。
4. **【最大の設計判断】種別は動的に増える。本アプリの `DOM.isType` は完全に静的。**
   略奪で作った **`typeCountFor(state, pi, id)`（`js/engine.js` L450-456）が唯一の前例**で、置き去り(Maroon)用に
   公式逐語 `Inheritance, Capitalism, and Charlatan will add types to cards.` を根拠として
   資本主義（財宝化）と相続した屋敷（アクション化）を足している（**特性(Trait)と災いカード(Bane)は種別を増やさない**）。
   → **Rice には「種別の集合」が要る**ので、`typeCountFor` を **`typesFor(state, pi, id) → string[]`** に一般化して
   `typeCountFor = typesFor(...).length` と定義し直すのが正解（**2つに分けて書くと必ずズレる**）。
   ⚠ **`typeCountFor` は相続した屋敷に `'action'` しか足していない**が、公式は
   **相続した屋敷＝`[アクション-勝利点-命令]` の3種別**（2022年版エラッタ。英語wiki の `List of Commands` にも
   `Estate under the influence of Inheritance` が載っている）＝**`'command'` が1つ足りない**。
   これは**置き去り(Maroon) の既存の取りこぼしでもある**（mix-all 限定）。
5. **【同じ拡張の中の罠】予言「悟り(Enlightenment)」＝`Treasures are also Actions.`**
   ＝有効化されると**場の財宝がすべて `Action` 種別も供給する**ので Rice の額が変わる。
   資本主義（ルネサンス）と違って**mix-all 限定ではなく旭日単独で到達する**。
   `typesFor` に**予言の効果も反映する**か、明示的に許容簡略化として PROGRESS に書くか、着手時に決めること。
   （同じ予言は `Scepter` の無限ループにも絡む＝英語wiki `Command` の `Examples of inhibited loops` 逐語。）
6. **「場」＝`p.inPlay` ＋ `p.durationCards`**（Artist と同じ）。
   **脇置き（貨物船／王子／研究／操舵手／準備／各種マット）は場ではない**が、
   **酒場マットから呼び出したリザーブは場にある**。
   **場を離れたカード（濡女 Snake Witch は山に戻る）は数えない**＝`removeOne(p.inPlay, ...)` の後は消えるので自然に正しい。
7. **`+1 Buy` が先、コインが後**（カード文の行順）。
8. **`playAllOrder`（「財宝を全部出す」の並び順・`js/engine.js` L583-589）に必ず入れる。**
   Rice は**出した瞬間の場の種別数**で額が決まるので**遅めに出す**のが最善。
   現状は
   ```js
   const rank = (c) => (PLAY_TWICE_TREASURES[c] ? -2 : c === 'figurine' ? -2 : c === 'silver' ? -1 :
     c === 'pendant' ? 1 : c === 'fortune' ? 2 : 0);
   ```
   ⚠ **【M6・訂正】ペンダントと同じ `rank = 1` にしてはいけない**（`Array.prototype.sort` は同順位を入れ替えないので
   **手札の並び順で前後が決まる＝取りこぼす**）。**正しい順は「Rice → ペンダント → 大金」**：
   - ペンダント（`js/cards.js` L1289-1290）＝「あなたが場に出している**異なる財宝カード1種類**につき +1 コイン」＝
     数えるのは**財宝の名前**。→ **Rice が先に場にあるとペンダントが +$1 増える**（Rice は新しい財宝の名前）。
   - 逆に**ペンダントが先でも Rice は1コインも得をしない**（ペンダントは単一種別＝`Treasure` は Rice 自身が既に数えている）。
   → **Rice を `0` と `1` の間**（例＝`c === 'rice' ? 0.5 : …`）にするか、
     **ペンダントを `2`／大金を `3` に繰り上げて Rice を `1`** にする。後者のほうが整数のままで読みやすい。
   ⚠ 単一種別の財宝（銅貨/銀貨/金貨）は Rice の後に出しても差が出ない（`Treasure` は数え済み）が、
   **複数種別の財宝は差が出る**（下記 8b）。
8b. **複数種別の財宝は Rice より前に出さないと損をする**
   ＝ハーレム(`Treasure-Victory`)／愚者の黄金(`Treasure-Reaction`)／
   呪われた金貨(`Treasure-Heirloom`)／戦利品15種(`Treasure-Loot` ほか)／呪符の巻物(`Action-Treasure-Loot`)／
   剣(`Treasure-Attack-Loot`)／盾(`Treasure-Reaction-Loot`)／アンフォラ等(`Treasure-Duration-Loot`)。
9. **アクションではない**＝アクション権を消費しない／玉座の間の対象にならない。
   ただし**財宝を2回使う系（ティアラ/冠/偽造通貨/王の隠し財産）の対象にはなる**（上記1のとおり自動で正しくなる）。
10. **$7 のコイン費用**＝負債もポーションも無い＝`costUpTo` 等の既存述語に素直に乗る
    （Mountain Shrine / Daimyo / Artist と違い、コスト関係の特別扱いは不要）。
11. **id 候補 `rice`**＝既存761枚と衝突なし。
    ⚠ 同拡張の **`rice_broker`（札差・$5・別群担当）** と id は衝突しないが、前方一致検索では紛らわしい。

---

## 反映した訂正：9件（うち採用しなかった 0件）

| # | 重大度 | 内容 | 判定 |
|---|---|---|---|
| ① | high | 負債を負うのは**購入**のときだけ（獲得では負わない） | **採用（裁定）／ただし状況記述を訂正** |
| ② | medium | 「コスト比較」の逐語のアイコン値が捏造だった | **採用**（wiki `Debt` の `Rising Sun:` 段落で確認） |
| ③ | medium | Mountain Shrine のリッチ警告が事実と逆 | **採用**（コード実見で確認） |
| ④ | medium | 負債の返済は**ターン中いつでも**に変更された | **採用（裁定）／ただし状況記述を訂正** |
| ⑤ | low | `Daimyo, Flagship — Replays the next played card.` | **採用**（自分で再取得して確認） |
| ⑥ | low | Daimyo は **8つ目**の Command（9つ目ではない） | **採用**（一覧8種・ギャラリー8枚を機械カウント） |
| ⑦ | low | 持続再演の逐語＝**ルールブックは "such as Daimyo" のみ**、6枚の列挙は拡張ページ限定 | **採用**（`rulebook.txt` L176 で確認） |
| ⑧ | low | Mountain Shrine の `Preview` 節が引用漏れ | **採用**（逐語を追加） |
| ⑨ | low | Artist の id 類似は `artificer` より **`artisan`**（1文字違い） | **採用** |

### ⚠ ①④について＝**検証docの「本アプリは今、公式と逆」という状況記述は、私の再確認では古い**
- 検証者は `js/engine.js` L1899-1900 が「負債は**購入でも効果での獲得でも**負う」と書いてあると報告したが、
  **現在の HEAD の同じ行は「負債コスト（debt）を負うのは **「購入」したときだけ**」**になっている。
- 原因＝**同じ日（2026-08-16）のコミット `7cc4534`
  「fix(empires): 負債の2024エラッタ＝出荷済みの実バグ2件を修正（旭日の段階0で発覚）」が既に両方を修正している**
  （コミットメッセージに「研究WFの3つの群（mechanics / k4 / kdebt）が独立に同じ指摘を出した」とある＝
  この検証docの指摘がまさに採用された結果）。
- ＝**裁定としては①④とも正しいので本文に反映したが、実装タスクとしては既に完了している**。
  **①④を「これから直す作業」として段階2の計画に積まないこと**（PROGRESS §0-30 の並行セッション事故と同じ構図）。

### この確定版で新たに足した実装上の指摘（収集doc・検証docのどちらにも無いもの）
1. **Daimyo は `duration` 種別を持たないので、`cleanupAndAdvance` の
   `if (DOM.isType(c,'duration') && …)`（L10462-10466）に弾かれて場に残れない**＝旗艦の `flagship_linger` を
   そのままコピーしても動かない（旗艦は `types` に `duration` を持つから動いている）。
2. **linger の解除判定が永続持続を見落とすと、再演カードが1ターンで捨てられる**
   （＝**出荷済みの実バグだった**。下記「実バグ候補②」。`ac8cf02` の `perm` 集約により修正済み・**未push**）。
3. **Artist の数え方は `magic_lamp`（魔法のランプ）が既に実装している**（`cnt[c]` → `filter(k => cnt[k]===1)`）＝
   公式文も `cards that you have exactly one copy of in play` で完全に同じ。**流用元はこれ**。
4. **Rice の「遅めに出す」は略奪のペンダント(`pendant`)が `playAllOrder` で既に答えを出している**（大金より前）。
   **ただし Rice はペンダントより前**（下記「反映した [must]／[nice]」の M6）。
5. **`typeCountFor` は相続した屋敷に `'command'` を足していない**（公式＝`[アクション-勝利点-命令]`）＝
   **置き去り(Maroon) の既存の取りこぼしでもある**（下記「実バグ候補③」）。
6. **予言「悟り(Enlightenment)」（`Treasures are also Actions.`）が Rice の種別数を旭日単独で動かす**＝
   資本主義と違い mix-all 限定ではない。
7. **Samurai の実物カード画像で「種別＝Action - Duration - Attack」「区切り線なし」「`(This stays in play.)` はピリオドあり」を目視確定**
   （日本語wiki のヘッダ表は種別を「アクション-アタック」と書いていて**不正確**）。

---

## 反映した [must]：4件（不採用 0件・うち1件は状況記述を訂正して反映）／拾った [nice]：9件

### [must]（完全性レビュー `c_kdebt.md` の観点5）

| # | 内容 | 反映先 | 自分での裏取り |
|---|---|---|---|
| **M1** | 永続持続の列挙は engine に**2箇所**（`cleanupAndAdvance` の `perm` と `stayingCounts`）ある。確定版は1箇所しか挙げていなかった | Samurai ⚠1b ／ 実バグ候補① | ✅ `stayingCounts`（L11525-11536）に `p.quartermasters` が**無い**ことを実見。**node で増築が操舵手を廃棄できることを再現**（対照＝雇人は正しく拒否） |
| **M2** | linger × 永続持続は「Daimyo で初めて起きる」ではなく**今日の出荷版で既に壊れている**（旗艦×操舵手・`random-plunder` で到達） | Daimyo ⚠4 ／ Samurai ⚠2 ／ 実バグ候補② | ✅ `flagship`/`quartermaster` が両方 `POOLS.plunderexp`(40種) にあることを機械確認。**ただし状況を訂正**＝下記 |
| **M3** | 新 pending の「4点セット」への言及がゼロ | Mountain Shrine ⚠8（新設）／ Samurai ⚠4（流用で満たされる旨） | ✅ `next` を取る汎用の任意廃棄 pending は存在しない（`goat_trash` L19655・`prize_goat` L12947 とも後続無し）ことを grep で確認 |
| **M4** | 押す側（`applyNextTime`）だけで受け口（`runReplays` のラベル分岐）に触れていない | Daimyo ⚠1b（新設） | ✅ `runReplays` の `if (r.label === 'flagship')` は **L12136-12148**（レビューの L12111-12126 は少しずれている）。`ntMatches` L2207 が `e.card === 'flagship'` を名指ししていることも追加で発見 |

> **⚠ M2 は「裁定・発見としては正しいが、状況記述はもう古い」**（①④とまったく同じ形）。
> **2026-08-16 に別セッションが既に修正している**（コミット `ac8cf02`・**未push**）＝
> `cleanupAndAdvance` に `const perm = {}`（L10420-10426）が新設され、linger の解除が `|| (perm[e.withCard]||0) > 0`
> を見るようになった。**node で再現を試みたところ、旗艦は操舵手と一緒に `durationCards` に残った＝既に直っている。**
> ＝**「先に直すべき出荷済みバグ」として段階2の計画に積まないこと**（ただし**まだ push されていない**ので、
> 本番 `origin/main` は今も壊れている＝push 前に消さないよう注意）。
> **`stayingCounts` の側（M1）は直っていない＝そちらは今も生きている。**

### [nice]（実装に効くものだけ採用＝9/10）

| # | 内容 | 反映先 |
|---|---|---|
| N1 | 英語wiki が載せる Artist の日本語カード文＝**HJ印刷版の文面**（「未確定」の証拠が取れた） | Artist の日本語カード文の節 |
| N2 | 取材メタ（取得日・ページ最終更新・`<hr>` を5枚とも機械カウント） | 下記「取材メタ」節 |
| N3a | Daimyo の `Secret history`（`It can't play itself` ＝ ⚠6 の設計意図の裏取り） | Daimyo Trivia |
| N3b | Artist の wiki 解説 `it draws nothing at all!`（**0ドローは正常系**＝テストの期待値） | Artist FAQ の後 |
| N4 | `rulebook.txt` L86 の一般則 `Math involving [$] amounts does not affect [D] amounts.` | §5-0(b) |
| N5 | 紛らわしい既存id `the_mountains_gift`（山の恵み・`js/cards.js` L2221） | Mountain Shrine ⚠9 |
| N6 | 「取れなかったもの／未確定」の独立節 | 下記「未確定・存在しないもの」節 |
| N7 | Artist・Rice の日本語種別の明記（カタログ投入の4箇所作業に直結） | 各カードの日本語カード文の直後 |
| M5 | 永続持続を「場を離れたら減らす」前例がゼロ＝**方針を決めないと既存と非対称になる** | Samurai ⚠6（A/B/中間案を提示） |
| M6 | `playAllOrder` の Rice は**ペンダントと同じ rank にすると順序が不定**（正しくは Rice → ペンダント → 大金） | Rice ⚠8 |
| M7 | `spec` が要るのは `costUpTo` だけでなく `costUnder`/`costExact` も | §5-0(b)（node で実測値つき） |

**不採用の [nice]：1件**
- **N3c＝Rice の `Secret history`**（`+$1 per different cost` → types へ／7D→8D→9D→$7+1Buy の変遷）。
  **実装にも裁定にも一切効かない**ので採らない（レビュー自身も「実装影響は無い」と書いている）。分量を増やさない方針。

---

## 取材メタ（再現性・N2）

- **取得日＝2026-08-16**。取得コマンド＝
  `RAW_DIR=C:/tmp/risingsun_research/raw_m_kdebt node tools/wikidirect.js "Mountain Shrine" "Daimyo" "Artist" "Samurai" "Rice" "Command"`
- **ページ最終更新**（生HTML の `This page was last edited on` を機械抽出）：

  | ページ | 最終更新 | `<hr>` 総数（ページ全体） | 日本語カード文の転記 |
  |---|---|---|---|
  | Mountain Shrine | 2026-07-30 20:39 | **0** | 無し（名前＋画像のみ） |
  | Daimyo | 2026-07-31 18:13 | **0** | 無し（名前＋画像のみ） |
  | Artist | 2026-08-09 14:40 | **0** | **有り**（＝HJ版） |
  | Samurai | 2026-08-13 19:23 | **0** | 無し（名前＋画像のみ） |
  | Rice | 2026-08-13 19:27 | **0** | 無し（名前＋画像のみ） |

- **区切り線の根拠＝5枚とも生HTML の `<hr` を機械カウントして 0 件**（＝カード文中の区切り線は無い）。
  **方法の妥当性＝同拡張の Fishmonger 5／Riverboat 4／Alley 4／Ninja 4／Ronin 4／Tanuki 4 は同じ方法で検出できる**
  （＝「いつも0が出る壊れた計測」ではない）。
- **5枚とも日本語カード画像（`ShrineJapanese.jpg` / `DaimyoJapanese.jpg` / `ArtistJapanese.jpg` /
  `SamuraiJapanese.jpg` / `RiceJapanese.jpg`）は存在する**＝日本語文が要るなら画像を実見すれば取れる。
- **Official FAQ の段落数**＝Mountain Shrine 2／Daimyo 4／Artist 3／Samurai 3／Rice 1（収集doc・検証docと一致）。
- **Versions 表**＝5枚ともデータ行1行・`Changes = First edition`・`Announced + Printed = August 2024`
  （`Digital` 欄は空）。

## 未確定・存在しないもの（探し直さないための一覧・N6）

| 項目 | 状況 |
|---|---|
| `Other rules clarifications` の節 | **Mountain Shrine にだけ存在**（リッチ／城塞の裁定）。Daimyo／Artist／Samurai／Rice には**無い** |
| `Preview` の節 | Samurai にだけ**無い**（他4枚はある） |
| Rice の HJ印刷版テキスト | **未確定**。日本語wiki の「余談」は最大出力の話／英語wiki にも日本語文の転記が無い。`File:RiceJapanese.jpg` を実見するしかない |
| Artist の HJ印刷版テキスト | **判明**（N1）。DO訳との差は「1種類につき／1枚につき」の1語で**機能差ゼロ** |
| 日本語wiki の Samurai 種別 | ヘッダ表が「アクション-アタック」で**不正確**。実物カード画像で `Action - Duration - Attack` を確定済み |
| `[5D]`/`[6D]`/`[8D]`/`[$6]`/`[$7]` の他の該当カード | ナビボックスで**旭日にそれぞれ1枚だけ**と確認済み |

---

## ⚠ 出荷済みの実バグ候補

> **①は今も生きている**／**②は `ac8cf02` で修正済み（ただし未push＝本番はまだ壊れている）**／**③は今も生きている**。
> ①③は**旭日とは独立**なので、メモリ `push-bugfixes-early` の慣行どおり**先に直して push してよい**。

### ① 【確定・未修正】増築(Improve) が「ゲーム終了まで場に残る操舵手(Quartermaster)」を廃棄できる

- **場所**＝`js/engine.js` **`stayingCounts(state, pi)`（L11525-11536）**。
  永続持続を列挙しているが **`p.quartermasters` だけが抜けている**
  （`p.princes` / `p.hirelings` / `p.endlessChalices` / `p.champions` / `p.archives` は入っている）。
  同じ列挙の**もう一方**（`cleanupAndAdvance` の `perm`・L10420-10426）には**操舵手が入っている**＝
  **2箇所を手で二重管理していて、片方だけ更新された**のが原因。
- **公式の根拠**＝増築（ルネサンス）は
  `At the start of Clean-up, you may trash an Action card **you would discard from play this turn**, to gain a card
  costing exactly [$1] more than it.`
  操舵手は**ゲーム終了まで場に残る**（`This stays in play.`）＝「このターン場から捨てるカード」ではない＝**対象外**。
- **再現条件**＝**mix-all（ルネサンス＋略奪）で増築と操舵手が同居**。node で再現：
  ```
  [quartermaster] IMPROVE_TRASH 受理された？ true   trash=['quartermaster']  → 次段 improve/gain(exact:$6) が開く
  [hireling]      IMPROVE_TRASH 受理された？ false  （＝正しく拒否＝対照）
  ```
  ＝**場に残り続けるはずの操舵手を廃棄して $6 のカードを獲得できる**（＝ルール違反かつ得）。
- **影響の限定**＝廃棄後も `p.quartermasters` のカウンタは残るが、
  開始時の窓は **「場に操舵手が1枚以上あるか」を毎ターン見ている**（L8016-8017）ので**能力自体は正しく止まる**
  ＝カード枚数の保存則は壊れない。**忠実性のバグ**（＋わずかに得をする）。
- **修正案**＝`perm` の集計をヘルパに切り出し、`stayingCounts` がそれを呼ぶ（**リストを1本化する**）。
  **旭日で `p.samurais` を足すときに必ずここも通ること。**

### ② 【確定・`ac8cf02` で修正済み／未push】旗艦(Flagship)が永続持続を再演したのに旗艦だけ捨てられる

- **場所**＝`js/engine.js` `cleanupAndAdvance` の `flagship_linger` 解除判定。
  `origin/main`（＝本番）の実装は `p.delayedEffects` の中に「`withCard` と同じ card の非linger予約」があるかだけを見る。
  **永続持続は `delayedEffects` を使わない**（専用カウンタ）ので予約が見つからず、**linger が即座に落ちる**。
- **公式の根拠**＝`if a Duration card is played extra times by a card such as Daimyo, that card also stays in play
  **until the Duration card is discarded**`（`rulebook.txt` L170-179）。
  操舵手は決して捨てられない＝**旗艦もゲーム終了まで場に残るのが正**。
- **再現条件**＝**旗艦と操舵手が同居**。両方 `POOLS.plunderexp`(40種) にあるので
  **`random-plunder` で到達＝mix-all は不要**（機械確認済み）。同型で `flagship × hireling / champion / archive`
  も mix-all で該当（いずれも `['action','duration']`＝旗艦の再演対象）。
  ※ 固定セット `DOM.KINGDOM_PLUNDER` には旗艦も操舵手も入っていないので、固定セットでは踏まない。
- **現状**＝**コミット `ac8cf02` の `perm` 集約により修正済み**（この批評作業の最中に別セッションが入れた）。
  node で「旗艦が操舵手と一緒に場に残る」ことを確認した。**`stayingCounts` の側（①）は同じコミットでも直っていない。**
  **`origin/main` はまだ壊れている**＝**この修正を消さずに push すること。**

### ③ 【確定・未修正】置き去り(Maroon) が「相続した屋敷」の種別を1つ少なく数える

- **場所**＝`js/engine.js` **`typeCountFor(state, pi, id)`（L450-456）**。
  相続した屋敷に **`'action'` しか足していない**。
- **公式の根拠**＝2022年版エラッタで
  **相続した屋敷の種別は必ず `[アクション-勝利点-命令]` の3種類**（日本語wiki 逐語）。
  英語wiki `Command` → `List of Commands` にも `Estate under the influence of Inheritance` が載っている。
  ＝置き去り（`+1 Card per type it has`）は **3枚引くべきところ2枚しか引かない**。
- **再現条件**＝mix-all（冒険の相続 Inheritance ＋ 略奪の置き去り Maroon）。
- **旭日での再発防止**＝Rice がまさに同じ関数を使うので、
  **`typeCountFor` を `typesFor(state, pi, id) → string[]` に一般化するときに `'command'` も足すこと**
  （そうしないと **Rice でも同じ1種別ぶん取りこぼす**）。

---

## 枚数の検算

**担当5枚／書いた5枚＝一致**

| # | 英語名 | 日本語名 | コスト | 種別 | 区切り線 | エラッタ |
|---|---|---|---|---|---|---|
| 1 | Mountain Shrine | 山の社 | `$0 + 負債5`（`[5D]`） | Action - Omen | 0本 | 無し |
| 2 | Daimyo | 大名 | `$0 + 負債6`（`[6D]`） | Action - Command | 0本 | 無し |
| 3 | Artist | 絵師 | `$0 + 負債8`（`[8D]`） | Action | 0本 | 無し |
| 4 | Samurai | 侍 | `$6` | Action - Duration - Attack | 0本 | 無し |
| 5 | Rice | 米 | `$7` | Treasure | 0本 | 無し |

内訳＝**負債コスト3枚**（`[5D]` / `[6D]` / `[8D]`）＋ **$6 が1枚**（Samurai）＋ **$7 が1枚**（Rice）＝**合計5枚**。
ナビボックスで **`[5D]` / `[6D]` / `[8D]` / `[$6]` / `[$7]` は旭日にそれぞれ1枚しか存在しない**ことも確認済み。
**id 衝突＝0**（`mountain_shrine` / `daimyo` / `artist` / `samurai` / `rice` はいずれも `js/cards.js` に0件）。
**5枚とも English versions 表がデータ行1行＝2024年8月の初版のみ＝版の選択で悩む余地は無い**
（略奪の Journey のような問題はこの群には無い）。

### この更新での検算

- **担当5枚／記載5枚＝一致**（追加・削除ゼロ。カード本体のデータは1文字も変えていない）。
- **`<hr>` ＝ 5/5 のページで機械カウントし全部 0**（対照実験で計測の妥当性を確認済み）。
- **日本語名 5/5・日本語カード文 5/5・日本語種別 5/5**（今回 Artist・Rice の種別を明記して 3/5 → 5/5 にした）。
- **反映した [must]＝4/4**（不採用0。うち **M2 は状況記述を訂正して反映**）。
- **拾った [nice]＝9件／見送り 1件**（Rice の `Secret history`＝実装影響ゼロ）。
- **出荷済みの実バグ候補＝3件**（①`stayingCounts` の操舵手漏れ＝**未修正**／②旗艦 linger × 永続持続＝
  **`ac8cf02` で修正済み・未push**／③`typeCountFor` の相続した屋敷に `'command'` 不足＝**未修正**）。
  ①②は **node で再現／再現不能（＝修正済み）を実測して確定**。③はコードと公式逐語の突き合わせで確定。
- **Command の総数＝8**（Band of Misfits / Captain / Overlord / Prince / Estate(Inheritance) / Scepter / Daimyo / Flagship）
  ＝生HTML から再確認。**川船(Riverboat) は含まれない。**


<!-- ===== m6_events.md ===== -->

# 【正本】Rising Sun（旭日）第6章 イベント10種

- 確定日：2026-08-16
- 素材＝`g6_events.md`（収集）／`v_events.md`（敵対検証）／`g0_jp_pairs.md`（日本語wiki の EN/JP 対応表）
- **確定者が自分で取り直した一次資料**（`RAW_DIR=C:/tmp/risingsun_research/raw_m_events`）：
  英語wiki 全10ページ＋`Rapid Expansion`＋`Action phase`＋`Coffers`（全て `status=200`）。
  strip 済み＝`m_ev1.txt` / `m_ev2.txt` / `m_rapidexp.txt` / `m_actionphase.txt` / `m_coffers.txt`。
- **日本語名・日本語カード文＝Dominion Online 訳**（日本語wiki）。本プロジェクトの方針＝略奪の決定3と同じ
  「**DO訳で統一**」（PROGRESS §4 の決定3。ユーザーは日本語版の現物を持っていない＝印刷版と照合する手段が無い）。
- ⚠ **「ホビージャパン印刷版とDO訳で文面が違う6枚（川船／好機到来／米／絵師／進歩／盛大な取引）」は
  依頼文由来の未検証リスト＝確定事実として引き継がないこと**（`m8_prophecies_b.md` L.600 が「進歩の日本語wiki に
  『余談』節が無く HJ 差異の記載は見つからない＝未確定」と記録している）。
  **本章の結論だけは確定している**＝`g0_jp_pairs.md` 本文の「余談」参照は**川船の1件のみ**で、
  **イベント10種には1枚も該当しない**（＝この章の日本語文面は DO訳で確定してよい）。

---

## 第6章 イベント10種

### 0. 章のまとめ（実装前に先に読む）

> ⚠ **本章に書いた `js/*.js` の `L.NNNN` は 2026-08-16 時点の目安**（確定作業中にも実際に数行ずれた＝
> **同じリポジトリを別セッションが触っている**可能性がある＝PROGRESS §0-30 の並行セッション事故）。
> **必ず関数名・マーカー文字列で `grep` して現在地を取り直すこと。**
>
> **【最終仕上げで行番号を取り直した（2026-08-16）】実際に 5行ずれていた**
> （`ONCE_PER_TURN_EVENTS` 10793→**10798**／`canBuyEvent` 10795→**10800**／`case 'launch'` 10912→**10917**／
> `BUY_EVENT` 12398→**12403**／`case 'STAFF_PLAY'` は **13841**（本体は 13849）／`COFFERS_SPEND` **16851**は不変）。
> 以下は**この時点で実読して確認した値**。ずれても関数名は変わらないので `grep` で引き直すこと。
>
> **確定者が実読で確認した engine の主要アンカー（2026-08-16）**：
> `isTypeSupply` **90** ／ `playCardNoAction` **654** ／ `takeDebt` **1908** ／ `gainFromOutside` **1921** ／
> `gain()` の獲得記録 **2007-2017** ／ `trashCardsTogether` **2078** ／ `gainLoot` の獲得記録 **2160** ／
> `anyGainable` **2522** ／ `revealFromDeck` **4291** ／ `gainableBase` **4463** ／ `costUpTo` **4467** ／
> `costUnder` **4472** ／ `costExact` **4477** ／ `costIsPlainCoin` **4499** ／ `farming_village` **6360-6368** ／
> `allCards` の脇ゾーン列 **7780-7782** ／ `canPlayFromHand` **8286** ／ `notePlayFromHand` **8291** ／
> `canPlayHandCard` **8297** ／ `triggerOnGain` の `hasty_aside` **9076** ／ `triggerOnDiscard` **9628** ／
> `cleanupAndAdvance` の `puzzleBox` **10551** ／ `deliverAside` **10601** ／ `applyEventEffect` **10873** ／
> `onTrashQueue` 消化 **11839**（`buried_treasure_play` 11865／`invasion_play_loot` 11918／`hasty_aside` 11929）／
> `prosperResume` 再開網 **11766** ／ `populateQueue` 再開網 **11966** ／ `cleanupWaiting` 再開網 **11982** ／
> `END_ACTION_PHASE` の `t.bpGained = 0; t.pageantDone = false;` **12817-12818** ／
> ワイン商の窓 **12847** ／ `PROSPER_GAIN` **13536** ／ `PLAYER_ACTIONS` **21271**。
> `js/ui.js`＝`modalMultiHand` **4380** ／ `modalSingleHand` **4445** ／ `modalGainSupply` **4673** ／ `modalAmount` **4698**。
> `js/cpu.js`＝`bestEventBuy` **1085**（`buyable()` が `E().canBuyEvent` を見るのは **1119**）。

#### 0-1. イベントの一般ルール＝**新しいものは1つも無い**（RGG ルールブック 2024・L.154-167 逐語）
> Rising Sun has Events, which first appeared in Adventures. In your Buy phase, when you can buy a card,
> you can buy an Event instead. You pay the cost indicated on the Event and then do its effect.
> - Events are not Kingdom cards; they sit on the table and provide an effect you can buy. There is no way
>   for you to gain one or end up with one in your deck.
> - Buying an Event uses up a Buy; normally you can either buy a card, or buy an Event. …
> - **The same Event can be bought multiple times in a turn if you have the Buys and $ available to do it.**
> - **You cannot play further Treasures that turn after buying an Event.**
> - Buying an Event is not buying a card, for things that care about that, like Haggler (from Hinterlands).
> - **Costs of Events are not affected by cards like Flourishing Trade.**

＝本アプリの既存 `BUY_EVENT`（`js/engine.js` L.12398）が**すべて既に実装済み**
（`t.coins -= cost` ／ `t.buys -= 1` ／ `t.treasuresLocked = true` ／ `t.buysMade++` ／
`t.eventsBought.push(id)` ／ 負債コストは支配の振り分けつきで加算 ／ `applyEventEffect`）。
**BUY_EVENT に手を入れる必要は無い**（Continue の負債8もこの経路でそのまま正しい）。

⚠ **盛大な取引(Flourishing Trade・予言＝全カードのコスト -$1) はイベントのコストを下げない**。
本アプリの `BUY_EVENT` は `if (cost > t.coins)` と `ev.cost` を直に見ており **`cardCost` を通さない**＝
**既に正しい**。予言を実装するときにここを「共通のコスト軽減」へ寄せてはいけない。

**横型の枚数**（同 L.52-60 逐語）＝
> For normal play we recommend using at most 2 such cards; with other expansions that includes Events,
> Traits, Landmarks, Projects, and Ways.

＝既存の「横型は合計2枚まで」と同じ。**予言(Prophecy) はこの2枚に数えない**
（L.62 `In games using an Omen, shuffle the Prophecies, and deal out one to be used this game.`
＝Omen があるときに自動で1枚決まる＝災いカード／同盟カードと同型。※予言の詳細は他群の担当）。

#### 0-2. 1ターン1回（`ONCE_PER_TURN_EVENTS`）＝**Continue の1枚だけ**
生HTML 10枚を `Once per turn` で機械検索＝**Continue のみ 2ヒット（カード文＋Official FAQ）／他9枚は 0**
（収集・検証・確定者の3者が独立に同じ結果）。
＝**`ONCE_PER_TURN_EVENTS` に足すのは `continue` だけ**。残り9種は購入権と $ がある限り**同じターンに何度でも買える**。
現状＝`js/engine.js` L.10793 `new Set(['alms','borrow','save','pilgrimage','desperation','launch'])`。

#### 0-3. 区切り線（`<hr>`）＝**10枚とも 0本**
生HTML 10ファイルすべてで `<hr` が 0。**手法の感度は対照実験で証明済み**＝同じ `wikidirect.js` で取った
旭日の**王国カード**は `<hr` を 4〜5個返す（Alley=4／Ninja=4／Ronin=4／Tanuki=4／Fishmonger=5／Riverboat=4）。
＝「0＝本当に区切り線が無い」であって取りこぼしではない。
（`Foresight` の "at end of turn"、`Kintsugi` の "If you've gained a Gold this game" も**区切り線では分かれていない**。）

#### 0-4. 版（English versions）＝**10枚とも1刷のみ・機能エラッタ ゼロ**
10ページとも データ行が1行だけで `Changes = First edition` / `Printed = August 2024` / `Announced` 欄は空。
＝**旧文面は存在せず、未印刷エラッタも無い**。略奪の Journey のような「版の選択」問題は**この10枚には無い**。

#### 0-5. id ＝ 既存761枚との衝突ゼロ（確定者が `js/cards.js` を機械検索して再確認）
`continue` / `amass` / `asceticism` / `credit` / `foresight` / `kintsugi` / `practice` / `sea_trade` /
`receive_tribute` / `gather` ＝**全て 0ヒット**。
- ⚠ **`continue` は JavaScript の予約語**。`DOM.LANDSCAPES` は**キーを引用符なしで書く形式**
  （`js/cards.js` L.1947〜＝`aqueduct: { … }`）なので、**`'continue': { … }` とキーを引用符で囲むこと**
  （`case 'continue':` と `DOM.LANDSCAPES['continue']` は完全に安全。`DOM.LANDSCAPES.continue` も
  ES5+ なら合法だが、本プロジェクトはビルド無しの素のJSなので**ブラケット記法で統一するのが最も安全**）。
- ⚠ `sea_trade` は冒険のイベント **`trade`（交易・$5／`js/cards.js` L.2051）** と別物。id は衝突しないが、
  **カード一覧の全文検索で「交易」が2件出る**（`海上交易` と `交易`）。
- ⚠ `gather`（参集・イベント）と `DOM.GATHERING_CARDS = ['temple','farmers_market','wild_hunt']`（帝国の
  「集合」＝山の上にVPトークンを貯める機構／`js/cards.js` L.2505）は**まったくの別物**。取り違えないこと。
  英語wiki も Gather ページ冒頭でわざわざ注記している。
- **日本語名も既存761枚と衝突ゼロ**（`js/cards.js` の `name: '…'` を機械検索＝10/10 で0ヒット）。
  紛らわしい既存名＝`交易`（冒険・L.2051）／`交易場`／`交易商人`／`収集`／`薬草集め`／`魔女の集会`＝**完全一致は無い**。

#### 0-6. **新 pending の一覧と「4点セット」**（CLAUDE.md の最重要規則）

CLAUDE.md 逐語＝「**新しい pending には CPU `decidePending` と UI `viewPendingModal` の分岐が必須**
（無いとCPU無限ループ／人間が詰む）。**新 `*_RESOLVE` は `PLAYER_ACTIONS` にも追加**（整合性テストが検査）」。
＝**この10種のうち8種が新 pending を要求する**。**4点セット＝engine reducer ＋ `PLAYER_ACTIONS`（L.21271）
＋ CPU `decidePending` ＋ UI `viewPendingModal`**。

| イベント | 要る pending（案） | 強制/任意 | 辞退ボタン | 備考 |
|---|---|---|---|---|
| Amass | `amass_gain` | **強制** | 不要 | **候補ゼロなら窓を開かない**（開くと詰む） |
| Asceticism | `asceticism_pay`（額）→ `asceticism_trash`（枚数） | 任意 | **両段に必要** | 額は `modalAmount`（ui.js L.4698）。**額0 で確定できる導線が必須** |
| Credit | `credit_gain` | **強制** | 不要 | 解決後に `p.debt` へ加算（`takeDebt` は使わない＝下記 Credit 節 2.） |
| Foresight | **不要**（即時解決） | — | — | 新しい脇ゾーンだけ要る |
| Kintsugi | `kintsugi_trash` →（`onTrashQueue` 消化後）→ `kintsugi_gain` | 両方**強制** | 不要 | **再開網が要る**（§0-8） |
| Practice | `practice_play` | 任意 | **必要**（「使わない」） | 候補ゼロなら窓を開かない |
| Sea Trade | `sea_trade_trash`（上限つき・0枚可） | 任意 | **必要**（「廃棄しない」） | 上限を pending に焼き込む |
| Receive Tribute | `receive_tribute_gain`（`gained[]` を持って再オファー） | 任意（up to 3） | **必要**（`alwaysSkip`） | **再開網が要る**（§0-8） |
| Gather | `gather_gain`（stage＝3/4/5） | **3段とも強制** | 不要 | **各段で候補ゼロなら窓を開かず次の段へ**（§0-8） |
| Continue | `continue_gain` ＋ `onGainQueue` の `continue_play` | 獲得は強制／使用は自動 | 不要 | 候補ゼロでもフェイズ復帰と +1ア +1購入 は起きる |

＋ **`applyEventEffect`（L.10873）に `case` を10個**足す。
⚠ **辞退（`action.card == null`）を受けたときに `state.pending = null` にする分岐を必ず書く**
（略奪P5 の拡大 Enlarge で「**手札0枚で窓を開いて閉じない [high] バグ**」を実際に踏んでいる）。

#### 0-7. **カタログ配線＝`expansion: 'risingsun'` を書き忘れると10種が対局に1枚も出ない**

本アプリの `DOM.EVENTS_*` は**カタログの `expansion` フィールドから派生する**（`js/cards.js` L.2476-2494 を実読）：
```js
DOM.EVENTS_PLUNDER = Object.keys(DOM.LANDSCAPES).filter((id) =>
  DOM.LANDSCAPES[id].kind === 'event' && DOM.LANDSCAPES[id].expansion === 'plunderexp');
```
⇒ **`expansion` を書き忘れると `DOM.EVENTS_RISINGSUN` が空配列になり、効果を全部実装しても1枚も出ない。
しかもテストは赤にならない（＝静かに死ぬ）。**

必要な配線は4箇所：
1. **カタログ**＝`DOM.LANDSCAPES` に
   `{ name, nameEn, kind: 'event', expansion: 'risingsun', cost, debt, text }`（既存の書式＝`js/cards.js` L.2352 の `bury` が雛形）。
2. **`DOM.EVENTS_RISINGSUN`**（L.2493 の隣に1行・派生）＋ **`DOM.eventPoolFor`（L.1843）に
   `if (expansion === 'risingsun') return DOM.EVENTS_RISINGSUN || [];` を1行**
   （`DOM.eventsForSet`（L.1850）はセットの `eventsFrom` からこの関数を呼ぶので、ここに足すだけでよい）。
3. **`DOM.MIX_LANDSCAPE_POOLS`（L.1781）に `'ev-risingsun'` を1行**＝mix-all で選べるようにする。
4. **横型 kind `event` のスキンは既存**（茶褐色・コスト円あり）＝**`tools/build-landscape.js` の新設は不要**。
   ⚠ **予言(Prophecy) は新 kind＝新スキンが要る**（他群の担当）。ここを混同しないこと。

⚠ **カタログ文の体裁は既存761枚に正規化する**（PROGRESS §0-30b＝「『+1 カードを引く』→『+1 カード』等、
既存カタログの言い回しに正規化した（DO訳そのままではない）」）。
実際 `launch` のカタログ文は `'1ターンに1回：アクションフェイズに戻る。\n+1 カード、+1 アクション、+1 購入'`（L.2375）。
⇒ **本章の DO訳のうち Sea Trade「+1 カードを**引く**」と Continue「+1 アクション、+1 購入」は
そのまま貼ると表記が揺れる**。**文面は DO訳・体裁は既存カタログに正規化**すること。

#### 0-8. **「複数枚を順に処理する」再開網＝`onGainQueue` ではない（Gather / Receive Tribute / Kintsugi）**

⚠ **`state.onGainQueue` は「獲得が開いた *対話*」を積む器であって、「次の段をオファーする」器ではない。**
ここを取り違えると、1枚目の獲得で望楼の窓が開いた瞬間に2段目が消えるか、`state.pending` 直代入で窓を握りつぶす。
**本アプリには そのまま使える前例が2つある**（確定者が実読・行番号も確認）：

| 用途 | 既存の前例 | 器 | 再開網 |
|---|---|---|---|
| **Receive Tribute**＝1枚ずつ・名前重複不可・やめられる | **略奪の 繁栄(Prosper)** | `t.prosperResume = { player, gained }` | **L.11766-11772**＝`if (!state.pending && … t.prosperResume)` → 候補が残っていれば同じ pending を立て直す |
| **Gather**＝残りの段を順に進める | **移動動物園の 植民(Populate)** | `t.populateQueue`（+ `t.populatePlayer`／L.1371 で初期化） | **L.11966-11974**＝pending が空いたら残りを進め、進める先が無ければキューを落とす |
| **Kintsugi**＝廃棄の on-trash を全部解決してから獲得の窓 | 増築の `t.cleanupWaiting` と同型だが、**より近いのは上の2つ** | `t.kintsugiResume = { player, cost }` など | `!state.pending && !(state.onTrashQueue && state.onTrashQueue.length)` を条件にする（L.11982 の書き方が雛形） |

具体形（`PROSPER_GAIN`＝L.13536-13554 の逐語構造。**Receive Tribute はこれをほぼそのまま写せる**）：
```js
case 'PROSPER_GAIN': {
  const pd = state.pending;
  if (!pd || pd.type !== 'prosper_gain') return state;
  if (action.card == null) { state.pending = null; return state; }   // やめる（任意）
  const gained = pd.gained || [];
  if (gained.indexOf(action.card) >= 0) return state;                // 名前の重複は不可
  if (!gainableBase(state, action.card) || !isTreasureFor(state, action.card)) return state;
  state.pending = null;                                              // ← 先に閉じてから獲得
  if (gain(state, pd.player, action.card, 'discard')) {
    const ng = gained.concat([action.card]);
    const more = (cid) => gainableBase(state, cid) && … && ng.indexOf(cid) < 0;
    if (anyGainable(state, more)) {
      if (!state.pending) state.pending = { type:'prosper_gain', player: pd.player, gained: ng };
      else t.prosperResume = { player: pd.player, gained: ng };      // ← 獲得が窓を開いたら再開網へ
    }
  }
  return state;
}
```
⚠ **`if (!state.pending) … else t.<X>Resume = …` の2分岐が肝**（獲得時対話が開いたかどうかで分ける）。
⚠ **再開網は `reduce` 末尾に置き、最後に `state = runReplays(state);` を呼ぶ**（既存3箇所と同じ形）。
⚠ **Receive Tribute は `gained[]` に加えて「場のカード名」も除外する**（下の節 2.(b)）。

#### 0-9. **相続した屋敷(Inheritance) の扱い＝この章では5枚に同じ問いが立つ**（まとめて1つの方針にする）

立つ場所＝**Amass / Sea Trade**（場のアクション枚数）／**Foresight**（アクションが出るまで公開）／
**Practice**（手札のアクションを2回）／**Credit・Receive Tribute・Continue**（サプライからアクションを獲得）。

本アプリの現状（実読）：
- **手札から使う系は明示的に足してある**＝`playCardNoAction`（L.666）と `STAFF_PLAY`（L.13847）が
  `DOM.isType(card,'action') || inheritedEstate(p, card)`。⇒ **Practice はこの形に揃えるのが一貫**。
- **サプライを見る `isTypeSupply`（L.90）は静的**＝**サプライの屋敷はアクションにならない**
  ⇒ **Credit / Receive Tribute / Continue は自動的に「屋敷を取れない」**（＝何もしなくてよい）。
- **場・山札を見る判定（Amass / Sea Trade / Foresight）は未決**。

⇒ **公式の個別裁定は無く mix-all 限定**なので、**5枚まとめて1つの方針**にして
「手札から使う系だけ `inheritedEstate` を通す／場・山札の判定は通さない」という**非対称を許容簡略化として
PROGRESS に明記する**（＝§0-29 A4 の相続の既存簡略化と同じ扱い）のが最小コスト。

---

### Amass ／ 蓄積  （$2・イベント）

- **英語カード文（逐語）**：
  ```
  If you have no Action cards in play, gain an Action card costing up to $5.
  ```
- **日本語カード文（DO訳）**：
  ```
  アクションカードを1枚も場に出していない場合、コスト5以下のアクションカード1枚を獲得する。
  ```
- **区切り線**：0本
- **版**：First edition（August 2024）の1行のみ＝**機能エラッタ無し**
- **公式FAQ・裁定**：
  - Official FAQ（全文・2段落）：
    > Duration cards in play that were played on previous turns will stop Amass from gaining an Action card.
    >
    > Cards you played this turn but which are no longer in play, such as Horse from Menagerie, will not.
  - `Other rules clarifications` 節は**存在しない**。
  - Trivia / Preview（Donald X.）：`Amass means the early turns can be spent taking exactly what you want. And sometimes a later turn.`
  - Trivia / Secret history：`At first it cost $0, now it costs $2; there's your playtesting dollars in action.`
    （＝発売前のコスト調整の話。機能変更ではない。）
- **⚠ 実装で危ないところ**：
  1. **「場にアクションカードが1枚も無い」の判定に `p.durationCards` を必ず含める**。
     Official FAQ が「**前のターンに使った持続カードが場にあると Amass は獲得できない**」と名指ししている。
     本アプリは `p.inPlay` と `p.durationCards` を**別配列**で持つ＝§0-13 の soldier（兵士）で
     「`durationCards` を無視して +$1 を数え落とす」[low] バグを実際に踏んでいる。**まったく同じ穴**。
  2. **「このターン使ったが今は場に無いカード」は数えない**（馬＝使ったら山へ戻る）。
     ＝**場の実物だけを見る**。`t.actionsPlayed` のようなプレイ履歴カウンタを見てはいけない。
  3. **⚠ `p.durationCards` には「永続持続」が居座る**＝**雇人(Hireling)／チャンピオン(Champion)／
     尽きぬ杯(Endless Chalice)／操舵手(Quartermaster)／王子(Prince)** は**ゲーム終了まで場に残る**
     （`cleanupAndAdvance` が `p.hirelings` / `p.champions` / `p.endlessChalices` / `p.quartermasters` /
     `p.princes` の数を `cnt` に足して durationCards に残す）。
     ⇒ **これらを1枚でも場に出したら、Amass はそれ以降ほぼ永久に空振り**する
     （逆に **Sea Trade は永久に強くなる**）。**テストの期待値と CPU の購入判断はこれを前提に書くこと。**
  4. **相続した屋敷（Inheritance）**＝**§0-9 の一括方針に従う**（Amass 個別の公式裁定は無い・mix-all 限定）。
  5. 獲得の述語＝**`costUpTo(state, id, 5)`**（`js/engine.js` L.4467。素の `cardCost <= 5` は禁止）
     ＋ **`isTypeSupply(state, id, 'action')`**（L.90＝山の一番上の種別。§A2b。randomizer を見ると分割山で壊れる）。
     **候補ゼロなら窓を開かない**（本アプリの定石）。
  6. **条件を満たしていなくても買える**（＝場にアクションがあるときは何も起きない）。
     engine は拒否しない（「遂行できない選択肢も選べる」）。
     ⚠ ただし **CPU の `bestEventBuy`（`js/cpu.js` L.1085）は条件を見てから買うこと**＝
     さもないと「場にアクションがある状態で $2 をドブに捨て続ける」。
     **CPU の判断案**＝`inPlay + durationCards にアクションが0枚 && $5以下に欲しい山がある` ときだけ買う。
  7. **獲得は強制**（"gain an Action card"＝"may" ではない）。
  8. **4点セット必須**（`amass_gain`）＝engine reducer ＋ `PLAYER_ACTIONS` ＋ CPU `decidePending` ＋
     UI `viewPendingModal`。**強制なので辞退ボタンは不要**だが、**窓を開く条件と受理の条件を必ず同じ述語に寄せる**
     （§0-29 A4 の教訓＝「engine の受理側だけを締める」のが本プロジェクトで最も再発する事故）。

---

### Asceticism ／ 苦行  （$2・イベント）

- **英語カード文（逐語）**：
  ```
  Pay any amount of $ to trash that many cards from your hand.
  ```
- **日本語カード文（DO訳）**：
  ```
  コインを好きなだけ支払い、それと同じ枚数の手札を廃棄する。
  ```
- **区切り線**：0本
- **版**：First edition（August 2024）の1行のみ＝**機能エラッタ無し**
- **公式FAQ・裁定**：
  - Official FAQ（全文・1段落）：
    > For example you could pay an additional $3 — so $5 total — and trash 3 cards from your hand.
  - `Other rules clarifications` 節は**存在しない**。`Strategy` 節も空。
  - wiki 本文の定義（実装に効く）：
    > It allows you to trash from your hand by paying $2 plus an amount of $ equal to the number of cards
    > you want to trash. **Its method of use is similar to the Overpay mechanic from Guilds, though its text
    > doesn't use that term.**
  - Trivia / Secret history：
    > I thought I might pursue "overpay for Events" as a thing. There was one that gained Golds, one that gave
    > you +Cards at end of turn, one that handed out Curses. Those didn't seem worth doing, and the mechanic is
    > left at just this and, if you count Credit, Credit. I like it fine here. **The card itself didn't change.**
- **⚠ 実装で危ないところ**：
  1. **「過払い(Overpay)」機構に乗せてはいけない**。wiki が `though its text doesn't use that term` と明示。
     本アプリの `OVERPAY_CARDS` / `maybeStartOverpay`（§0-4）は**「カードを購入したとき」**に紐づいており、
     イベント購入では走らない。**Asceticism 専用の pending（支払額を選ぶ → その枚数を廃棄）を新設する**のが正しい。
     既存の額入力モーダル＝`modalAmount`（帝国の峠 `MOUNTAIN_PASS_BID`／財源の `COFFERS_SPEND` が先例）。
  2. **支払額 0 が合法**（"any amount"）＝**0枚廃棄で終わってよい**。
     ⇒ 終端保証は自明だが、**UI に「0（払わない）」の導線が必ず要る**。
     ⚠ **2段の pending になる（`asceticism_pay` → `asceticism_trash`）ので、どちらの段でも辞退できること**：
     - 1段目＝`modalAmount(title, desc, max, min=0, …)`（ui.js L.4698）で **0 を選んで確定できる**
       （`min = 0` にする。`UI.amount` は確定時に `null` に戻すこと＝§0-24 の「連続購入で前回値を持ち越す」回帰）。
     - 2段目＝`modalMultiHand(p, title, desc, confirmLabel, allowZero=true, onConfirm, maxN, filter)`（ui.js L.4380）
       で **`allowZero = true`／`maxN = 支払額`**。⚠ **上限は pending に焼き込む**
       （UI 表示と旧スナップショット互換＝本アプリの慣行）。
     - ⚠ 額 0 を選んだら **2段目の窓を開かない**（開くと「0枚廃棄で確定」しか押せない無意味な窓になる）。
  3. **$2 を先に払い、その後に「追加で N」を払う**（Official FAQ の `so $5 total` がこの読み方を確定させる）。
     本アプリでは `BUY_EVENT` が `t.coins -= 2` を済ませてから `applyEventEffect` を呼ぶので、
     **支払える上限は「その時点の `t.coins`」**＝自然にこの順になる。
  4. **【確定者の追加所見・要判断】財源(Coffers) を「その場で」使えるか**
     ＝日本語wiki の Asceticism ページは、この論点のためにわざわざ**財源のルール変更の注記**を貼っている。
     一次資料（英語wiki `Coffers` ページ・確定者が取得＝`m_coffers.txt`）の逐語：
     > A token there can be removed **at any time during your turn**, for +$.
     > … This was **changed in 2021** to the current rule of allowing them to be spent at any time during your turn.
     > （旧ルール＝`can be removed in your Buy phase, **before buying anything**`）

     ＝**現行ルールでは、苦行の追加支払いの瞬間に財源を崩して払える**。
     ⚠ **本アプリの `COFFERS_SPEND` は `if (state.pending) return state;` で始まる**（機械確認）＝
     **苦行の pending が開いている間は財源を使えない**（＝苦行を買う前に先に崩しておく必要がある）。
     さらに本アプリは `if (t.phase !== 'buy') return state;` も持つ＝**現行の「ターン中いつでも」より狭い**
     （これは苦行以前からの既存の割り切り）。
     → **(a) 苦行の pending 中だけ `COFFERS_SPEND` を通す** か **(b) 許容簡略化として PROGRESS に明記する**
     かを**決めること**。放置すると「画面に財源があるのに払えない」＝人間が理不尽に感じる経路になる。
  5. **手札枚数を超えて払えるか＝⚠未確定**（公式の裁定文が英語wiki・ルールブックとも**見つからなかった**）。
     一般則「できるだけ行う」からは「払いすぎても手札の枚数までしか廃棄しない」になるはずだが、
     **これは推論であって引用できる裁定ではない**。
     → 実装は **`min(残りコイン, 手札枚数)` に丸める**のが安全（払い損を出させない）。PROGRESS に「裁定未確認」と書くこと。
  6. **廃棄が別の窓を開く**（青空市場／城塞／ネズミ／リッチ／墓所／司祭／下水道 …）＝
     **reducer は廃棄の前に `state.pending = null` にする**（本アプリの定石＝略奪P1b の「賞品のヤギ」）。
  7. **複数枚の廃棄が「同時」か「1枚ずつ」か＝⚠未確定**（公式の裁定文なし）。
     本アプリは `trashCardsTogether`（`js/engine.js` L.2078＝全部を廃棄置き場に入れてから on-trash）を
     **歩哨(Sentinel)だけ**に使っている（§0-29 A4 の許容簡略化）。
     **既存の複数枚廃棄（礼拝堂／神殿／平和的教団）と同じ「1枚ずつ」に揃えるのが一貫性の上では素直**。
     **Sea Trade と必ず同じ実装にすること**（同じ拡張に同型が2枚ある）。
  8. **-$1トークン（橋の下のトロル）は関与しない**＝`applyCoinPenalty` は「**得る**コイン」に食い込む機構で、
     ここは**支払い**。混ぜないこと。
  9. **4点セット必須（2段ぶん）**＝`ASCETICISM_PAY` / `ASCETICISM_TRASH` を `PLAYER_ACTIONS`（L.21271）に登録し、
     CPU `decidePending` と UI `viewPendingModal` に分岐を書く。
     ⚠ **CPU は「いくら払うか」を自分で決める必要がある**（`decidePending` が額を返す）＝
     案＝`min(残りコイン, 手札のジャンク枚数)`（銅貨・屋敷・呪い）。**必ず非 null を返すこと**
     （§0-26 の教訓＝「CPU の `decidePending` で `null` を返さない。オンラインでは `reduce(state, null)` が
     TypeError → 部屋が固まる」）。
     ⚠ **CPU の `bestEventBuy` 側**＝手札にジャンクが2枚以上あり、コインが余っているときだけ買う。
     さもないと $2 を払って0枚廃棄する空振りを繰り返す。

---

### Credit ／ 信用  （$2・イベント）

- **英語カード文（逐語）**：
  ```
  Gain an Action or Treasure costing up to $8. +D equal to its cost.
  ```
  （`+D` は負債トークンの記号。wiki 表記は `+` の直後に負債アイコン）
- **日本語カード文（DO訳）**：
  ```
  コスト8以下のアクションカードまたは財宝カードを獲得する。そのコストに等しい数だけ、+〈負債〉。
  ```
- **区切り線**：0本
- **版**：First edition（August 2024）の1行のみ＝**機能エラッタ無し**
- **公式FAQ・裁定**：
  - Official FAQ（全文・1段落）：
    > This can't gain cards with D in the cost.
  - **`Additional rules clarifications`**（⚠ このページだけ節名が `Other rules clarifications` ではない。全文・4段落）：
    > It also can't gain cards with P in the cost.
    >
    > **If you play Possession and have them buy Credit, they don't gain the card (you do), which means there's
    > no D given to any player.**
    >
    > If the gained card's cost changes when you gain it (e.g., the card is Destrier), **take D based on the new
    > cost, not the old cost.**
    >
    > If its cost somehow changes to include D or P (e.g. Credit gains a $6 Wayfarer, use Architects' Guild to
    > gain Gondola and play Lurker to gain either Transmute or Artist), **only the $ of the new cost matters;
    > the D and P are ignored.**
  - RGG ルールブック L.752 逐語：`Credit: This can't gain cards with D in the cost.`
  - Trivia / Preview：`Credit lets you buy something using debt. Turn one Prince.`
  - Trivia / Secret history：`Didn't change.`
  - Trivia / `Why it gains Actions and Treasures instead of non-Victories`（Interview with Donald X., 2024年11月・**全文**）：
    > It can go either way; mainly, I like letting you get e.g. Nobles when there isn't a reason to not let you,
    > and that looms larger than letting you get Night cards. **This didn't get tested another way; there was that
    > moment when I was typing up the first version to test, and apparently I thought, let's try letting you get
    > the Nobles, and it was fine so that was that.**

    ＝**貴族(Nobles＝アクション+勝利点)を取れるようにしたかった**という設計意図の確認。
    ⚠ **この引用を「夜行カードは獲得できない」と読んではいけない**（＝下の 1. の注意を必ず読むこと）。
- **⚠ 実装で危ないところ**：
  1. **獲得候補の述語＝`costUpTo(state, id, 8)` ＋ `costIsPlainCoin(id)`（`js/engine.js` L.4499＝負債もポーション
     費用も持たない）＋「アクションまたは財宝」（`isTypeSupply`）**。
     `costIsPlainCoin` は §0-16 で大君主のために新設済み＝**そのまま使える**。
     ⚠ **複合種別でよい**＝貴族（アクション+勝利点）は「アクション」なので取れる。
     ⚠⚠ **【最終仕上げで訂正】「夜行カードは獲得できない」と書いてはいけない＝
     `!isTypeSupply(state, id, 'night')` のようなフィルタを絶対に足さないこと。**
     - 反証（確定者が実読）＝`js/cards.js` L.969
       **`werewolf: { id:'werewolf', name:'人狼', cost:5, types:['action','night','attack','doom'] }`**
       ＝**アクションを兼ねる夜行カード**で `costIsPlainCoin` も真。
       公式カード文 `Gain an Action or Treasure costing up to $8` に**完全に合致する＝取れるのが正しい**。
       夜想曲は実装済みなので **mix-all で今日到達可能**。
     - Donald X. の `letting you get Night cards` が指すのは **純粋な夜行**（アクションも財宝も兼ねないもの）。
     - ⇒ **正しい述語は「アクション**または**財宝か」だけ**（`isTypeSupply(state,id,'action') ||
       isTypeSupply(state,id,'treasure')`）。**除外リストを書かない**＝それだけで
       「純粋な夜行は取れない／人狼は取れる」が自動的に正しくなる。
  2. **【確定者の追加所見・g6 の記述の訂正】`takeDebt(state, pi, cost)` とは書けない**。
     本アプリの **`takeDebt(state, pIndex, cardId)`（L.1908）は第3引数に *カードid* を取り、
     `C()[cardId].debt`（＝そのカードの負債コスト）を読む**関数であって、数値を受け取らない（機械確認）。
     Credit の `+D equal to its cost` は「**獲得したカードのコイン費用**と同じ数の負債」なので、
     **`takeDebt` を呼んではいけない**（呼ぶと「そのカードの負債コスト＝0」で何も起きない）。
     ＝**`p.debt = (p.debt || 0) + coin成分` を直に加算する**専用の処理を書くこと。
     ※ なお `takeDebt` が `gain()` から呼ばれていないのは公式どおり（`Debt` の逐語
     `gaining such a card in other ways does not [give you Debt tokens]`）＝この設計に触らないこと。
  3. **負債は「獲得した後のコスト」で取る**（Destrier の例）。
     ⚠ **本アプリの既存慣行と逆**＝§0-30 P6 の現場監督は「獲得**後**のコストで判定していた」のを [low] バグとして
     「獲得**前**」に直している。**Credit はここだけ公式が「後」と明言**しているので、**共通ヘルパに寄せてはいけない**。
     - 例：デストリエ（移動動物園）＝`js/engine.js` L.383 で `base -= (t.gainedThisTurn || []).length`
       ＝**自分自身を獲得した時点で獲得枚数が1増えてコストが $1 下がる** → **下がった後の額**だけ負債を負う。
  4. **獲得後のコストに負債やポーションが混ざっても、$ の成分だけ見る**（Wayfarer / Gondola / Transmute の例）
     ＝`costOf(state,id).coin` だけを負債に換算する。
  5. **支配(Possession) の例外＝「どのプレイヤーも負債を負わない」**（公式の逐語）。
     ⚠ **本アプリの §0-23 の方針「負債は支配者が負う」と正面から食い違う**。
     実際 `takeDebt` の中も `BUY_EVENT` の負債加算も
     `(t.possessedBy != null && pi === t.active) ? t.possessedBy : pi` で**支配者に振り分ける**。
     **Credit だけは `t.possessedBy != null` のとき負債を一切与えない**分岐が要る。
     mix-all 限定（錬金術＋旭日）だが、**書かないと公式と真逆になる**。
  6. **獲得は強制**（"Gain an Action or Treasure"）。**候補ゼロなら窓を開かない＋負債も0**。
  7. **イベント自体のコストは `$2`（コイン）**＝負債は**効果**で発生する。
     `BUY_EVENT` の `ev.debt` 経路（＝Continue の 8D）ではなく、**`applyEventEffect` の中**で処理する。
  8. **負債>0 の間はカードもイベントも買えない**（`BUY_EVENT` L.12406 の
     `if ((me.debt || 0) > 0) return state;` ＝既存ガード）＝
     Credit で高額カードを取るとそのターンはもう何も買えない。**仕様どおり**。
  9. **4点セット必須**（`credit_gain`）。**獲得は強制なので辞退ボタンは不要**、
     **候補ゼロなら窓を開かない（＋負債も0）**。
  10. **CPU の `bestEventBuy`**＝`js/cpu.js` L.1088 の `if (t.buys <= 0 || (p.debt || 0) > 0) return null;` により
     **負債を抱えている間はイベントを一切買わない**（＝Credit を買った次のターンから返済が終わるまで買い控える）。
     ⇒ **序盤に $8 のカード（例：属州以外の強い財宝/アクション）を先取りしたいときだけ買う**のが妥当で、
     **終盤に買うと明確に弱くなる**（`buyEndsGame` 前後で購入が丸ごと止まる）。
     案＝`p.turns <= 6 && 欲しい $6〜$8 のアクション/財宝がサプライにある` ときだけ。

---

### Foresight ／ 洞察  （$2・イベント）

- **英語カード文（逐語）**：
  ```
  Reveal cards from your deck until revealing an Action. Set it aside and discard the rest. Put it into your hand at end of turn.
  ```
- **日本語カード文（DO訳）**：
  ```
  アクションカード1枚が公開されるまで山札を上から公開する。その1枚を脇に置き、残りを捨て札にする。ターン終了時、そのカードを手札に加える。
  ```
- **区切り線**：0本（"at end of turn" は区切り線で分かれていない＝1つの文の連なり）
- **版**：First edition（August 2024）の1行のみ＝**機能エラッタ無し**
- **公式FAQ・裁定**：
  - Official FAQ（全文・1段落）：
    > The card is added to your hand after drawing your next hand.
  - `Other rules clarifications` 節は**存在しない**。
  - Trivia / Secret history（**タイミングの正本**）：
    > I took a while to come around on this one. Also the timing got messed with. **At one point you had a pile
    > of cards sitting there waiting to discard, because I wanted it to all happen after discarding stuff from
    > play, in case you'd drawn your deck. But just immediately resolving was way simpler.**

    ＝**公開と捨てはイベント購入時に即時に完結する**（片付けまで持ち越さない）。脇に置いた1枚だけが持ち越される。
- **⚠ 実装で危ないところ**：
  1. **「次の手札を引いた**後**」に手札へ入る**（Official FAQ 逐語）。
     ⚠ 本アプリのクリンナップは「**自分の手番終了時に次の手札を先引きする**」（§0-22 の最重要事項）＝
     **先引きの後**に手札へ加える＝**手札6枚になる**。
     **既存の同型が4つある**＝配達 Deliver（`p.deliverAside`／L.1488・L.10598）／
     パズルボックス（`p.puzzleBox`／L.1485・L.10533）／トリックスター（略奪P6）／疲れ知らずの Tireless（略奪P4）。
     **`p.deliverAside` のコードをそのままコピーするのが最短で最も安全**（`cleanupAndAdvance` の
     L.10598-10601 が `forEach((c) => p.hand.push(c))` → 空配列化 の3行）。
  2. **新しい脇ゾーンが要る**（例 `p.foresightAside`）＝**物理カード**なので
     **`allCards`（L.7779-7781 の並びに足す）／ invariants の `ZONES` ／ `maskStateFor` ／ 盤面表示**の4点に配線する。
     ⚠ **このカードは公開されている**（"Reveal … Set it aside"）＝**相手にも見える（マスクしない）**。
     ＝配達 `p.deliverAside`（**公開**）と同じ扱いで、パズルボックス `p.puzzleBox`（**裏向き＝所有者のみ**）とは**逆**。
     ここを取り違えるとオンラインの情報量が公式と変わる。
  3. **同じターンに何度でも買える**（once-per-turn ではない）＝**脇札が複数枚になり得る＝配列で持つ**。
  4. **「アクションが出るまで公開」のループは既存ヘルパ `revealFromDeck(state, pi, pred)`（L.4291）を使う**
     ＝**この関数がまさに Foresight のためにあるような形**（山札が尽きたら `reshuffleDeck` して続け、
     めくった非該当札は `skipped[]` に**山札から抜いた状態で保持**し、`{matched, skipped}` を返す）。
     ⚠ **公開して捨てた札をその場で捨て札に入れると、直後のリシャッフルでそれを引き直す**（無限ループ）＝
     `revealFromDeck` を使えばこの穴は構造的に塞がる。**自前でループを書かないこと**。
     - **完全な先例＝農村(farming_village)**（L.6362-6368）：
       `revealFromDeck` → `reveal(state, pi, shown, '…で公開')` → `skipped.forEach(c => p.discard.push(c))`
       → `matched` を手札へ。**Foresight は最後の1行だけ「脇へ」に差し替える**。
     - **デッキ全体にアクションが1枚も無ければ、全部公開して全部捨て、脇に何も置かない**（＝空振り。`matched` が null）。
  5. **`reveal()`（L.1814）を必ず通す**＝パトロン（ルネサンス）が誘発する（§0-22 の横断機構）。
  6. **【確定者の追加所見】捨てた札は本物の「捨てる」＝`triggerOnDiscard`（L.9628）を通すこと**。
     ⚠ **農村(farming_village) の既存実装は `triggerOnDiscard` を呼んでいない**（機械確認）＝
     **農村をそのままコピーすると坑道(Tunnel)／村有緑地／忠犬／織工 が誘発しない**。
     Foresight について**個別の公式裁定文は無い**が、カード文が `discard the rest` である以上、
     一般則としては誘発する（§0-28 で「山札から捨てたカードでも捨て札トリガーを誘発」を横断修正済み）。
     ⚠ 順序＝**公開を全部終えてから（＝`revealFromDeck` が返ってから）捨てる**なら、
     「坑道で金貨を獲得してリシャッフルの母集団が変わる」順序問題（§0-28 の羊飼いで踏んだ穴）は自然に消える。
  7. **⚠ 相手の手番には起きない**（イベント＝自分の購入フェイズ）。脇札は**自分の**片付けで手札へ入る。
  8. **相続した屋敷（Inheritance）**＝「アクションが出るまで公開」の判定に数えるか＝**§0-9 の一括方針に従う**
     （公式の個別裁定は無い・mix-all 限定。`revealFromDeck` に渡す述語をどう書くかの問題）。
  9. **pending は不要**（即時に完結する）＝**この10種で pending が要らないのは Foresight だけ**。
     ただし**新ゾーンの4点配線**（`allCards` / invariants の `ZONES` / `maskStateFor` / 盤面表示）は必須。
  10. **CPU の `bestEventBuy`**＝$2 で「次のターンの手札にアクション1枚を確約する」＝
     **デッキが薄い序盤ほど強く、山札を掘り切ったターンは空振り**（デッキにアクションが無ければ全部捨てるだけ）。
     案＝`所有カードにアクションが2枚以上あり、他に買うものが無い余りコイン $2` のときだけ。
     ⚠ **買う前に「捨て札置き場が大きく育つ」副作用**（＝次のリシャッフルが早まる）を CPU は評価しない＝許容。

---

### Kintsugi ／ 金継ぎ  （$3・イベント）

- **英語カード文（逐語）**：
  ```
  Trash a card from your hand. If you've gained a Gold this game, gain a card costing up to $2 more than the trashed card.
  ```
- **日本語カード文（DO訳）**：
  ```
  手札1枚を廃棄する。このゲーム中に金貨1枚を獲得していた場合、廃棄したカードよりコストが最大2コイン高いカード1枚を獲得する。
  ```
- **区切り線**：0本
- **版**：First edition（August 2024）の1行のみ＝**機能エラッタ無し**
- **公式FAQ・裁定**：
  - Official FAQ（全文・1段落）：
    > You have to remember if you gained a Gold this game. If you have, buying Kintsugi will both trash and gain
    > a card, **even if you no longer have the Gold.**
  - Other rules clarifications（全文・1段落）：
    > **If trashing a card causes you to gain a Gold (e.g. you discard a Market Square), that will let you gain
    > a card costing up to $2 more.**
  - Trivia / Preview：`Kintsugi is a trashing Event that turns into a Remodel once you can fill in the cracks with Gold.`
  - Trivia / Secret history：
    > No changes. **Kintsugi has an unprecedented lack of tracking**, which it got from Ninja, which no longer
    > has it. You know, we always remembered, seemed okay.

    ＝**「このゲームで金貨を獲得したか」を盤面のトークンで追跡しない**（＝紙では記憶に頼る）
    ＝**デジタル実装では自前でフラグを持つ必要がある**。
- **⚠ 実装で危ないところ**：
  1. **新しい永続フラグが要る**＝`p.gainedGoldThisGame`（プレイヤーごと・**ゲーム全体で持ち越す**・非カード）。
     - **`createInitialState` で `false` に初期化する**（player の初期化ブロック）。
       読み取りは **`!!(p.gainedGoldThisGame)`**（オンライン永続化の**旧スナップショット互換**＝
       フィールドが無い state を復元しても落ちない。§0-17 で `pending.self` の欠落で livelock を踏んでいる）。
     - **`freshTurn` で消してはいけない**（ターンをまたぐ）。**`p.debt` / `p.coffers` と同じ層**（プレイヤー直下）。
     - **公開情報**（相手も「あの人は金貨を取った」と分かる）＝`maskStateFor` で伏せない・**盤面に出す**。
     - **獲得のあらゆる経路**で立てる。**⚠ 立てる場所は最低2箇所**（確定者が実読）：
       - **`gain()`（L.2007-2017 の `if (state.turn && pIndex === state.turn.active)` 付近＝ただし
         「手番プレイヤーのときだけ」のガードの**外**に置くこと。下の「相手のターンの獲得も数える」参照）**
       - **`gainFromOutside()`（L.1921・push は L.1939-1942）**
       ⚠⚠ **「金貨はサプライからしか来ないので `gain()` の底に1行入れれば十分」は誤り**（確定者が反証）＝
       **`ROGUE_GAIN_FROM_TRASH`（L.15661-15672）は廃棄置き場から $3〜$6 のカードを獲得する＝金貨($6)が入る**。
       墓暴き(graverobber)・物色(Scrounge) も廃棄置き場から獲得する。これらは全部 `gainFromOutside` 経由。
       ⇒ **`gainFromOutside` にも必ず1行入れる**。
       ※ `gainLoot()`（L.2160）は戦利品専用＝金貨は来ないので不要。
       ※ `exchangeCard`（吸血鬼↔コウモリ／取り替え子）は**獲得ではない**ので不要（公式どおり）。
     - ⚠ **「所持している」ではなく「獲得したことがある」**（`even if you no longer have the Gold`）。
       廃棄・追放・圧縮しても消えない。
     - ⚠ **相手のターンに獲得した金貨も数える**（"this game" に制限が無い＝海賊／盗賊／密輸人／
       獲得時リアクション経由も全部数える）。
     - ⚠ **金貨(Gold) だけ**。**白金貨(Platinum) は数えない**（＝id が `gold` かどうかだけを見る）。
     - ⚠ **支配(Possession) 中は「獲得するのは支配者」**（`gain()` の `t.possessedBy` 分岐）＝
       フラグも支配者に立つのが本アプリの一貫した扱い。**その1行を書き忘れると被支配者に立つ**。
  2. **判定は「廃棄の後」**（Other rules clarifications の逐語）。
     青空市場(Market Square)＝「あなたのカードが廃棄されたとき、これを捨てて金貨を獲得してよい」＝
     **Kintsugi の廃棄で初めて金貨を獲得し、そのおかげで獲得部分が有効になる**。
     ⇒ **`廃棄 → on-trash トリガーを全部解決 → フラグを読む → 獲得の窓を開く`** の順を厳守。
     ⚠ 本アプリは on-trash が対話を開くことがある（`state.onTrashQueue`＝青空市場／下水道／呪いの鏡／リッチ／
     従者／地下墓所）＝**キューが空になってから判定する再開網**が要る＝**§0-8 の器**。
     具体形＝`t.kintsugiResume = { player, cost }` を積み、**reduce 末尾**に
     ```js
     if (!state.pending && !state.gameOver && state.turn && state.turn.kintsugiResume &&
         !(state.onTrashQueue && state.onTrashQueue.length) && !(state.onGainQueue && state.onGainQueue.length)) {
       const kr = state.turn.kintsugiResume; state.turn.kintsugiResume = null;
       if (!!state.players[kr.player].gainedGoldThisGame &&
           anyGainable(state, (cid) => costUpTo(state, cid, kr.cost + 2)))
         state.pending = { type:'kintsugi_gain', player: kr.player, cost: kr.cost };
       state = runReplays(state);
     }
     ```
     （`cleanupWaiting` の再開網＝L.11982 が**まったく同じ条件式の書き方**をしている＝そこを写す）。
     ⚠ **`kr.cost` は「廃棄した時点で評価したコイン費用」を焼き込む**（`costUpTo` は 3成分で比較するので、
     ポーション/負債の成分も pending に載せること＝§0-23 の「『ちょうど/以下』の pending には pot/debt を焼き込む」）。
  3. **廃棄は強制**（"Trash a card from your hand."）＝手札があれば必ず1枚。
     **手札0枚なら何も起きない＝窓を開かない**。
     ⚠ 略奪P5 の拡大(Enlarge)で「**手札0枚で窓を開いて閉じない [high] バグ**」を実際に踏んでいる＝**同じ穴**。
  4. **獲得も強制**（フラグが立っていて候補があれば）。候補ゼロなら窓を開かない。
  5. **「$2 高い」の比較は3成分**＝**`costUpTo(state, id, cardCost(state, 廃棄したカード) + 2)`**
     （素の数値比較は禁止。`costUpTo` は `gainableBase` を内包＝非サプライ／ロック中の分割山下段／在庫切れを弾く）。
     ⚠ **廃棄したカードのコストは「今」引く**（渡し船・発明家の家族・安価な(Cheap)・盛大な取引でコストが動くと
     取れる集合が実際に変わる＝略奪P1b の呪符の巻物と同じ注意）。
     ⚠ **既存の同型＝狸(Tanuki・旭日の王国カード $5)** が「手札1枚を廃棄し、それよりコストが最大2コイン高いカード
     1枚を獲得」＝**まったく同じ述語**。**共通ヘルパに寄せてよい**（改築 remodel 系の既存 pending も参考）。
  6. **獲得は「カード」（種別制限なし）**＝勝利点も夜行も取れる。`costUpTo` に種別フィルタを掛けないこと。
  7. **CPU**：フラグが立っていない間の Kintsugi は「$3 で手札1枚を廃棄するだけ」＝
     `bestEventBuy` は**フラグと圧縮したいカードの有無を見てから買う**こと。
  8. **4点セット必須（2段ぶん）**＝`KINTSUGI_TRASH` / `KINTSUGI_GAIN` を `PLAYER_ACTIONS` に登録。
     - `kintsugi_trash`＝**強制1枚**（辞退ボタン不要）。**手札0枚なら窓を開かない**。
     - `kintsugi_gain`＝**強制**（候補ゼロなら開かない）。
     ⚠ **CPU `decidePending` は必ず非 null を返す**（`|| p.hand[0]` のフォールバックを置く＝§0-11 の生贄で
     「除外し続けて `card:null` を返し livelock」を実際に踏んでいる）。

---

### Practice ／ 稽古  （$3・イベント）

- **英語カード文（逐語）**：
  ```
  You may play an Action card from your hand twice.
  ```
- **日本語カード文（DO訳）**：
  ```
  手札のアクションカード1枚を2回使用してもよい。
  ```
- **区切り線**：0本
- **版**：First edition（August 2024）の1行のみ＝**機能エラッタ無し**
- **公式FAQ・裁定**：
  - Official FAQ（全文・1段落）：
    > If you use this on a Duration card, you may wish to tilt the card to remind you that you played it twice.
  - Other rules clarifications（全文・1段落）：
    > You can't play Treasure cards in your Buy phase after buying something, so if you draw any Treasure cards
    > as a result of the Action you play with Practice, you will ordinarily not be able to play them;
    > **if you draw any Action cards, you can play them by buying Practice again.**
  - Strategy 節（実装に効く）：
    > Note that you can buy another Practice from the +1 Buy gained in this way, e.g., if you have 2 Souks on hand
    > and manage to buy a first Practice, you could get … +$12 from the first Souk, then buy Practice again to get
    > another +$14.
  - Trivia / Preview：`Practice simply plays a card twice. Handy with plenty of things.`
  - Trivia / Secret history：`Didn't change. I guess sometimes I've had enough practice making these.`
  - wiki 本文の定義：`It allows you to throne an Action during the Buy phase.`
- **⚠ 実装で危ないところ**：
  1. **購入フェイズで手札のアクションを使う**＝本アプリの既存の同型は**杖(Staff・略奪の戦利品)**
     （`js/engine.js` L.1007-1009 の窓 ＋ L.13843 の `STAFF_PLAY`）。**そのコードが最も近い**。
  2. **「使用は1回・効果を2回」＝玉座の間と同じ**＝**`state.replay` に2回目を積む**（既存機構）。
     ⚠ **`playCardNoAction`（L.654）の戻り値を見てから replay を積むこと**
     （§0-29 A4 の [high] 12＝「成功したときだけ」に直した3箇所＝王家のガレー船／専門家／長老 と同じ罠）。
  3. **アクション権を消費しない**（イベントの効果として使う）＝`playCardNoAction`（L.654）を通す。
     ⚠ **`t.actionsPlayed`（L.667）／`applyPileTokens`（L.671＝冒険の山トークン）／`noteAllyPlay`（L.672）／
     習性(Way)／炉(kiln)** は**すべて `playCardNoAction` の中で自動的に処理される**（確定者が実読）＝
     **呼び出し側で余計な配線を書かないこと**（二重に数える事故のもと）。
     略奪の 無謀な(Reckless) の「プレイは1回」とは**別の話**なので混同しないこと。
  4. **`t.phase === 'buy'` のまま使う**＝**冠(Crown) が財宝モードになる**（購入フェイズで使ったから）。
     ⚠ §0-27 の「`turn.phase === 'buy'` の誤爆が最大のリスク」と同じ注意。
     **フェイズを絶対に触らないこと**（Continue と真逆＝同じ拡張に両方あるので共通化してはいけない）。
  5. **手札から使う＝`playCardNoAction` に `zone` として `p.hand` を渡すだけでよい**（engine のゲートは自動）。
     ⚠⚠ **【最終仕上げで訂正】旧稿の「`STAFF_PLAY` は `canPlayHandCard` を呼んでいない＝杖にバグの疑い」は誤り。**
     - 反証（確定者が実読）＝`STAFF_PLAY`（L.13849）は `playCardNoAction(state, pd.player, action.card, pl.hand, '杖で')`
       を呼び、**`playCardNoAction`（L.654-664）が**
       ```js
       const fromHand = zone === p.hand;
       if (fromHand && !canPlayFromHand(state, pi)) return false;   // 航海：手札から3枚まで
       if (fromHand && warlordBlocks(state, pi, card)) return false; // 将軍：同名2枚ブロック
       if (!removeOne(zone, card)) return false;
       p.inPlay.push(card);
       if (fromHand) notePlayFromHand(state, pi);                    // 航海の残り回数カウンタ
       ```
       **を必ず通る**。`canPlayHandCard(state, pi, card)`（L.8297）の定義は
       `canPlayFromHand(state, pi) && !warlordBlocks(state, pi, card)` ＝**同一の2条件**。
       ⇒ **杖に取りこぼしは無い／`notePlayFromHand` も自動で呼ばれる**。
     - ⇒ **Practice で自前に `canPlayHandCard` を二重に呼ぶ必要は無い**（呼んでも害は無いが冗長）。
       ⚠ **`playCardNoAction` に `p.hand` 以外の zone を渡す設計にしてはいけない**（ゲートが丸ごと外れる）。
     - **本当に必要なのは3面のうち残り2面**＝**①窓を開く候補（＝`canPlayHandCard` で絞る）
       ②CPU の候補 ③UI のフィルタ**。engine の拒否だけ効いていて UI が絞っていないと、
       **押しても何も起きない死に選択肢**になる（§0-29 A4 の [low]「航海の3枚制限／将軍で手札が dim にならず
       『押しても何も起きない』ように見えた」＝`handCardPlayable`）。
     - ⚠ **`playCardNoAction` の戻り値 `false` のときに `state.replay` を積まないこと**（下の 2.）。
  6. **任意（"You may"）＝辞退できる**。**手札にアクションが1枚も無くても買える**（何も起きない）＝
     **候補ゼロなら窓を開かない**（開いて閉じないと人間が詰む／CPU が livelock）。
     窓を開くときも**「使わない」ボタンが必須**。
  7. **1ターンに何度でも買える**（once-per-turn ではない）。
     Other rules clarifications と Strategy が「**もう一度 Practice を買って、引いたアクションを使える**」と
     明言している＝**制限を掛けてはいけない**。
  8. **持続カードを2回使うと持続効果も2回**（Official FAQ の "tilt the card"）。
     ⚠ 本アプリの既存の許容簡略化「**玉座×持続では玉座が場に残らない**」（§0-25／§0-28）は、
     **Practice にはそもそも「場に残るカード」が無い（イベントだから）**ので**影響しない**＝むしろ素直。
     `armDuration` の回数（`cnt`）が2になるだけ。
  9. **習性(Way) を選べる**（一般則「カードを使用するときはいつでも選べる」）。
     `playCardNoAction` は §0-26 で既に習性・炉(kiln) に対応済み。
  10. **財宝は引いても出せない**＝`t.treasuresLocked` が既に立っている（`BUY_EVENT` L.12417）＝既存機構で正しい。
  11. **1ターンに2つイベントを買う経路がこの拡張単独で日常的に起きる**（＝7. の「もう一度 Practice を買う」の前提）。
      一般則の逐語（RGG ルールブック）＝
      > If you have two Buys, such as after playing **Fishmonger**, you can buy two cards, or buy two Events,
      > or buy a card and an Event (in either order).

      **魚屋(Fishmonger)＝旭日の $2（+1購入）**＝**同じ拡張の中に「+1購入」が安価にある**。
      ⇒ **Practice を2回買うテストは mix-all を持ち出さずに書ける**（旭日単独の王国で再現する）。
  12. **4点セット必須**（`practice_play`）。**任意なので「使わない」ボタンが必須**。
      ⚠ **候補ゼロなら窓を開かない**（`canPlayHandCard` で絞った結果が0枚のとき）。
      CPU `decidePending` は `null` を返さず `{ type:'PRACTICE_PLAY', card: null }`（＝辞退）を返す。
  13. **CPU の `bestEventBuy`**＝手札に「2回使う価値のあるターミナル」（研究所級のドロー／+$／アタック）があり、
      アクション権を使い切っているときだけ買う。**`t.phase === 'buy'` の時点の手札**を見ること
      （購入フェイズに入った後に引いた札も対象）。

---

### Sea Trade ／ 海上交易  （$4・イベント）

- **英語カード文（逐語）**：
  ```
  +1 Card per Action card you have in play. Trash up to that many cards from your hand.
  ```
- **日本語カード文（DO訳）**：
  ```
  場に出しているアクション1枚につき、+1 カードを引く。その枚数以下の手札を廃棄してもよい。
  ```
- **区切り線**：0本
- **版**：First edition（August 2024）の1行のみ＝**機能エラッタ無し**
- **公式FAQ・裁定**：
  - Official FAQ（全文・4段落）：
    > **First count how many Action cards you have in play. Draw that many cards, then trash up to that many
    > cards from your hand.**
    >
    > **Drawing cards is not optional, but trashing cards is.**
    >
    > If you have no Action cards in play, you won't draw any cards, and then won't be able to trash.
    >
    > While this draws cards, it's too late to play more Treasures in this Buy phase.
  - `Other rules clarifications` 節は**存在しない**。
  - Trivia / Secret history（没案の履歴＝現行実装には不要だが設計意図の確認）：
    > The first version was an Improve that exchanged a card for one for up to $2 more. … For a while it returned
    > the card to its pile, then it trashed. And well it was in the file until late, when one day DZ said, hey
    > **didn't you make people sad about Bonfire to avoid problems with trashing stuff from play?** Yes. Yes I did.
    > So I replaced the Improve. We quickly tried a few things and I liked this trasher that needs you to have
    > Actions in play. **It's a little redundant to have both this and Asceticism in one set** but well I could
    > live with that.
- **⚠ 実装で危ないところ**：
  1. **枚数は「先に数える」**（Official FAQ の `First count`）。ドローで場のアクション枚数は変わらないが、
     順序が明文化されている以上その順で書くこと。
  2. **「場のアクションカード」に `p.durationCards` を含める**＝**Amass とまったく同じ穴**。
     Sea Trade の FAQ には持続の明示が無いが、**Amass の FAQ が "in play" の意味を確定させている**
     （前のターンに使った持続カードは場にある）ので同じ扱い。**Amass と同じ述語を共有すること**。
  3. **「そのぶんだけ」の基準は2回とも「最初に数えた場のアクション枚数」**
     （Official FAQ 逐語 `Draw that many cards, then trash up to that many cards`＝どちらも `that many`）。
     ⚠ **「実際に引けた枚数」ではない**＝山札＋捨て札が尽きて3枚のうち1枚しか引けなくても、**廃棄は最大3枚まで**。
     ここを「引いた枚数」で実装すると**静かに弱くなる**（テストでも気づきにくい）。
  4. **ドローは強制／廃棄は任意（0枚可）**。
  5. **場にアクションが0枚なら、引きも廃棄も起きない＝窓を開かない**（開くと閉じられずに人間が詰む）。
  6. **複数枚の廃棄の「同時／1枚ずつ」は Asceticism と同じ論点**（公式の裁定文なし）＝**同じ実装に揃えること**。
  7. **廃棄が別の窓を開く**（青空市場／城塞／ネズミ／リッチ …）＝廃棄の前に `state.pending = null`。
  8. **「財宝はもう出せない」は既存の `t.treasuresLocked` で自動的に正しい**（`BUY_EVENT` L.12417 が立てている）。
  9. **UI**：`modalMultiHand(p, title, desc, confirmLabel, allowZero=true, onConfirm, maxN, filter)`（ui.js L.4380）に
     **`maxN = 最初に数えた場のアクション枚数`** を渡す。**上限は pending に焼き込む**（本アプリの慣行＝
     UI 表示と旧スナップショット互換）。0枚で確定できる導線（「廃棄しない」）が必須。
  10. **⚠ ドローは副作用を持つ＝item 3 の不変条件が壊れやすい**（回帰テストをここに紐づけること）：
      - **`draw()` はシャッフルを起こす**＝占星術師団／メイソン団（同盟）の自動選択・
        **運命の(Fated)／回避(Avoid)**（略奪）の自動選択がその場で走る。
      - **-1カードトークン**（遺物 Relic／借入 Borrow）は **`draw()` 冒頭で1枚食う**（§0-13）。
      - **山札＋捨て札が尽きれば引けない**。
      ⇒ **どの場合でも「廃棄の上限」は最初に数えた場のアクション枚数のまま**（item 3）。
      **「実際に引けた枚数」で上限を作ると静かに弱くなり、テストでも気づきにくい**＝
      **-1カードトークンを持たせた状態の回帰テストを1本必ず書く**（3枚のうち2枚しか引けなくても上限は3）。
  11. **4点セット必須**（`sea_trade_trash`）。**任意なので辞退ボタンが必須**。
      **場にアクションが0枚なら窓を開かない**（item 5）。
  12. **CPU**＝`decidePending` は「手札のジャンク（銅貨・屋敷・呪い）を上限まで」。必ず非 null を返す。
      `bestEventBuy` は **`inPlay + durationCards のアクション枚数 >= 2` かつ 手札にジャンクがある**ときだけ買う
      （0枚なら完全に空振り＝$4 をドブに捨てる）。
      ⚠ **永続持続（雇人／チャンピオン／尽きぬ杯／操舵手／王子）が場にあると恒久的に強くなる**（Amass の 3. の裏返し）。

---

### Receive Tribute ／ 賛辞  （$5・イベント）

- **英語カード文（逐語）**：
  ```
  If you've gained at least 3 cards this turn, gain up to 3 differently named Action cards you don't have copies of in play.
  ```
- **日本語カード文（DO訳）**：
  ```
  このターン3枚以上カードを獲得していた場合、場に出していないアクションカードを1枚ずつ3種類まで獲得してもよい。
  ```
- **区切り線**：0本
- **版**：First edition（August 2024）の1行のみ＝**機能エラッタ無し**
- **公式FAQ・裁定**：
  - Official FAQ（全文・3段落）：
    > The Action cards you gain need to all have different names **from each other and from cards you have in play.**
    >
    > **You gain them one at a time, in any order.**
    >
    > **You don't have to gain the full three.**
  - Other rules clarifications（全文・1段落）：
    > **Actions with D or P in their cost can be gained. You do not take any D for this or need to have any
    > Potion in play.**
  - Strategy 節：`Beggar can be used to gain three cards very early in a game.`
  - Trivia / Secret history：
    > Several things had this name, but none were really variants of the final card. I wanted a Windfall-like
    > Event, some mini-game with a big pay-off. **At first it didn't say "differently named," but you'd use it to
    > empty piles and it felt less-fun-than-it-could-be.** I briefly tried it with a debt cost. In the end it's
    > hard to make this pay off, but still something when it does.
- **⚠ 実装で危ないところ**：
  1. **★最大の罠＝コスト制限がまったく無い**。「アクションカード」でありさえすればいくらでも高くてよく、
     **負債コスト（大君主 $0+8D／技術者／旭日の 山の社・大名・絵師）も
     ポーション費用（ファミリアー／支配／変成）も獲得できる**。しかも**負債を負わない／場にポーションが要らない**。
     ⇒ **`costUpTo` / `costUnder` / `gainableBase` を掛けてはいけない**。
     本アプリはこれで**繰り返し本番 livelock を出している**（§0-28 悪魔祓いの精霊＝`exorcistSpirits`／
     略奪P5 の物色 Scrounge／§0-29 A4 のリッチ `lichTrashTargets`／略奪P3 のシャーマン `shamanTargets`）。
     **専用の候補述語（例 `receiveTributeTargets(state, pi, taken)`）を engine に新設し、
     engine拒否・CPU候補・UIフィルタの3面が同じ関数を見ること**。
     ⚠ ただし **`availableInSupply` / `splitLocked` は通す**（在庫切れ・ロック中の分割山下段は取れない。
     `gainableBase` の中身のうち「`NON_SUPPLY` 除外」も残してよい＝非サプライは "Supply" に無い）。
     ＝**`gainableBase` から「コスト比較」だけを外した形**にするのが素直。
  2. **候補の条件は3つ**：
     - (a) サプライから獲得できる**アクション**（**`isTypeSupply(state, id, 'action')`**＝山の一番上の種別。§A2b）
     - (b) **場にある自分のカードと同名でない**（`p.inPlay` ＋ **`p.durationCards`**）
     - (c) **この解決の中で既に獲得した名前と重複しない**
     ⚠ (b) の "in play" は **自分の場だけ**（`cards **you** have in play`）。相手の場は関係ない。
     ⚠ (b) は**名前の比較**（種別ではない）。
  3. **「up to 3」＝途中でやめられる**＝**モーダルに必ず「やめる」ボタンが要る**。
     ⚠ 略奪P6 の敵対レビュー [high] 3＝「**繁栄(Prosper) の獲得モーダルに『やめる』が無く、候補ゼロで閉じられない**」
     と**完全に同型**。`modalGainSupply(…)` の**第7引数 `alwaysSkip = true`** を渡すこと
     （`js/ui.js` L.4673 のシグネチャ／L.2100 のコメントが「無いと候補が尽きたときだけ辞退ボタンが出る」と警告）。
  4. **1枚ずつ・順番は任意**＝1枚獲得するごとに再オファー（獲得時トリガーを挟む）。
     ⚠⚠ **これは `state.onGainQueue` ではない**（`onGainQueue` は「獲得が**開いた対話**」を積む器）。
     **正しい器＝略奪の 繁栄(Prosper) と完全に同型**＝**`t.prosperResume` 相当の
     `t.receiveTributeResume = { player, gained }` ＋ reduce 末尾の再開網**（**§0-8 にコード形を書いた**）。
     - 既存の逐語＝`PROSPER_GAIN`（L.13536-13554）と 再開網（L.11766-11772）。
       「**1枚ずつ／名前の重複を避ける／やめられる／獲得が窓を開いたら再開網へ**」が**4点とも同じ**。
     - ⚠ `state.pending` を直接代入して上書きしないこと
       （§0-26 の要求 Demand で踏んだ穴＝「馬の獲得が開いた望楼の窓を握りつぶす」）。
     - ⚠ **Prosper との唯一の違い**＝候補述語に **「場（`inPlay` ＋ `durationCards`）にある名前」の除外**が加わる
       （下の 2.(b)）。`gained[]` の除外だけ写すと**公式より緩くなる**。
  5. **「このターンに3枚以上獲得したか」の判定＝`t.gainedThisTurn`**（`js/engine.js` L.1381 初期化／`if (t && pIndex === t.active)` ブロックで push）。
     ⚠ **フェイズを問わない**（アクションフェイズの獲得も数える）。
     ⚠ **イベント／プロジェクトの購入は「獲得」ではない**（カードを獲得しないので push されない）＝正しい。
     ⚠ **`t.gainedThisTurn` は手番プレイヤーの獲得だけ**（`if (t && pIndex === t.active)` のガード）＝仕様どおり。
     ⚠ **支配(Possession) 中は `gain()` が `t.possessedBy` 分岐で早期 return し `gainedThisTurn` に積まれない**
     （機械確認）＝支配中に Receive Tribute を買っても条件を満たしにくい。
     **⚠ この点の公式裁定は確認できていない**（mix-all 限定の極端な経路）＝**未確定として記録**。
     ⚠ 物乞い(Beggar・暗黒時代＝銅貨3枚を獲得) で序盤に条件を満たせる（wiki が名指し）＝mix-all で実際に起きる。
  6. **条件を満たしていなくても買える**（何も起きない）＝engine は拒否しない。
     ただし **CPU の `bestEventBuy` は `t.gainedThisTurn.length >= 3` を見てから買うこと**
     （さもないと $5 をドブに捨て続ける）。
  7. **獲得は「してもよい」（up to）＝完全に任意**＝0枚でも合法。
  8. **4点セット必須**（`receive_tribute_gain`）。**辞退ボタン必須**（3. の `alwaysSkip`）。
     CPU `decidePending` は候補が無ければ `{ card: null }`（＝やめる）を返す＝**`null` を返さない**。
  9. **CPU の `bestEventBuy`**＝`(t.gainedThisTurn || []).length >= 3` を見てから買う（6.）。
     ⇒ **CPU が自然にこの条件を満たすのは稀**（同一ターンに3枚獲得＝工房系の連打・物乞い・馬を配る札）。
     **買わない選択でも実害は無い**ので、まず `false` 固定で出荷し、ソークで到達しないことを許容してもよい
     （＝`ritual`/`banquet`/`windfall`/`tax` を CPU が買わないのと同じ扱い＝`js/cpu.js` L.1115 の先例）。

---

### Gather ／ 参集  （$7・イベント）

- **英語カード文（逐語）**：
  ```
  Gain a card costing exactly $3, a card costing exactly $4, and a card costing exactly $5.
  ```
- **日本語カード文（DO訳）**：
  ```
  コスト3、コスト4、コスト5のカードを1枚ずつ獲得する。
  ```
  ※ DO訳には "exactly" に当たる語が無いが、日本語ドミニオンでは「コスト3のカード」＝ちょうど$3（「コスト3以下」と
    書き分ける）ので**訳の欠落ではない**。実装は英語原文どおり**ちょうど**で書くこと。
- **区切り線**：0本
- **版**：First edition（August 2024）の1行のみ＝**機能エラッタ無し**
- **公式FAQ・裁定**：
  - Official FAQ（全文・2段落）：
    > **You gain the three cards in the order listed; none are optional.**
    >
    > **If you can't gain one - for example if nothing in the Supply costs exactly $4 - you still gain the others.**
  - `Other rules clarifications` 節は**存在しない**。
  - Trivia / Preview：`Gather gets you three cards at once.`
  - Trivia / Secret history：
    > The first version didn't say "exactly" though it was implicit; **implicit is not good enough for the kids
    > these days.**

    ＝発売前の文面調整であって機能変更ではない。**"exactly" は現行文面で明示されている**。
- **⚠ 実装で危ないところ**：
  1. **順序が固定＝$3 → $4 → $5**（"in the order listed"）＝**プレイヤーが順番を選べない**。
     ⚠ **Receive Tribute は "in any order"＝逆**。**同じ拡張の中に両方あるので共通化してはいけない**
     （略奪の「回避 vs 襲撃」「突貫 vs 鏡映」と同じクラスの罠）。
  2. **3枚とも強制**（"none are optional"）。**取れないものがあっても残りは取る**
     （＝各段で**候補ゼロなら窓を開かず次の段へ進む**。3段それぞれに終端保証が要る）。
  3. **「ちょうど $N」は3成分**＝**`costExact(state, id, N)`**（`js/engine.js` L.4477）。
     ⚠ **$4+ポーション費用 は「ちょうど $4」ではない**／**$3+負債 も「ちょうど $3」ではない**
     （`costExact` は `c.pot === 0 && c.debt === 0` まで見る＝そのまま正しい）。
     素の `cardCost(state,id) === 3` で書くと mix-all（錬金術・帝国・旭日）で**本番 livelock** になる。
  4. **コストは各段の直前に評価し直す**。
     - 1枚目を獲得したことで **橋／街道／発明家の家族／安価な(Cheap)／盛大な取引／デストリエ／行人(Wayfarer)** の
       コストが動く。とくに**デストリエ（このターンの獲得枚数でコストが下がる＝L.383）は Gather の3連続獲得で
       毎回コストが変わる**。
     - ⇒ 「最初にまとめて候補3組を確定してから獲得する」実装は**必ず壊れる**。
  5. **獲得のたびに獲得時トリガーが走る**（望楼／遊牧民の野営地／国境の村／ヴィラ／そり／鷹匠 …）＝
     **対話が全部解決してから次の段へ進む**
     （§0-26「1つの効果で複数枚を続けて獲得するときに `state.pending` を直接代入しない」）。
     ⚠⚠ **その器は `onGainQueue` ではなく「残りの段のキュー＋reduce 末尾の再開網」**＝
     **移動動物園の 植民(Populate) と同型**（**§0-8**）。
     - 既存の逐語＝`t.populateQueue` / `t.populatePlayer`（L.1371 で初期化・L.11316 で積む）＋
       **再開網 L.11966-11974**（pending が空いたら残りを進め、進める先が無ければキューを落とす）＋
       reducer `case 'POPULATE'`（L.19319-19336＝`state.pending = null;` してから `gain`、
       残りは「reduce 末尾の再開網が（獲得時対話を解決してから）次の選択待ちを開く」とコメント済み）。
     - **Gather の違いは1点だけ＝キューが `[3, 4, 5]` の固定順**（Populate は山キーの集合で順不同）。
       ⇒ `t.gatherQueue = [3,4,5]` / `t.gatherPlayer = pi` を持ち、
       **再開網で先頭を取り出し、`anyGainable(state, (cid) => costExact(state, cid, n))` が偽なら
       窓を開かずに次へ進む**（＝2. の「取れないものがあっても残りは取る」がここで自動的に満たされる）。
     ⚠ **ヴィラを Gather の1枚目で獲得すると、残り2枚は「アクションフェイズでの獲得」になる**
     （`Action phase` ページ逐語＝下の Continue の節に全文）＝**公会堂／列柱／川の社 の判定が変わる**。
  6. **種別制限なし**＝勝利点も夜行も財宝も取れる。`costExact` に種別フィルタを掛けないこと。
  7. **非サプライ（戦利品／賞品／馬／精霊）は取れない**（`nothing in the Supply` の逐語）＝
     `costExact` が `gainableBase` を内包しているので**そのままで正しい**。
  8. **CPU**：$7 は属州($8)の手前の価格帯＝`bestEventBuy` は「$3/$4/$5 に欲しい山が2つ以上あるか」で判断すること。
  9. **4点セット必須**（`gather_gain`・stage で $3/$4/$5 を区別）。
     **3段とも強制なので辞退ボタンは不要**だが、**各段で候補ゼロなら窓を開かない**（＝終端保証が3つ要る）。
     ⚠ **受理側にも終端保証を書く**（`action.card == null` かつ `anyGainable` が真なら拒否／偽なら閉じる＝
     `SCROUNGE_GAIN`（L.13464-13470）の書き方が雛形）。**旧スナップショット互換のためにも受理側に必ず置く**。

---

### Continue ／ 継続  （負債8（コインは0）・イベント）

- **英語カード文（逐語）**：
  ```
  Once per turn: Gain a non-Attack Action card costing up to $4. Return to your Action phase and play it. +1 Action and +1 Buy.
  ```
  （`+1 Action` と `+1 Buy` は太字リンク。改行は入っていない＝1段落）
- **日本語カード文（DO訳）**：
  ```
  1ターンに1度のみ：アタックでないコスト4以下のアクションカード1枚を獲得する。アクションフェイズに戻り、それを使用する。+1 アクション、+1 購入。
  ```
- **区切り線**：0本
- **版**：First edition（August 2024）の1行のみ＝**機能エラッタ無し**
- **公式FAQ・裁定**：
  - Official FAQ（全文・4段落）：
    > You can only buy this once per turn. When you do, you gain an Action card costing up to $4, that isn't an
    > Attack card; you return to your Action phase; and you play the Action card you gained.
    >
    > **This doesn't use up any of your Action plays for the turn.**
    >
    > You also get +1 Action and +1 Buy.
    >
    > **Returning to your Action phase doesn't cause "start of turn" abilities to repeat; however when your Buy
    > phase happens again after that, "start of Buy phase" abilities can repeat.**
  - Other rules clarifications（全文・3段落）：
    > **If the gained card gets moved elsewhere (e.g. Rapid Expansion), Continue can't play it, but you still
    > return to your Action phase and get +1 Action and +1 Buy.**
    >
    > **The card is gained in your Buy phase, but played in your Action phase.** This matters for cards like
    > River Shrine (which cares if you gained cards in your Buy phase) and Crown (which cares which phase it was
    > played in).
    >
    > See also general clarifications for returning to your Action phase.
  - **参照先＝`Action phase` ページの「Return to your Action phase」節（全文7段落・確定者が再取得して逐語一致を確認）**：
    > If you return to your Action phase, for example by buying Continue, **no start-of-turn effects are performed
    > when returning.**
    >
    > When returning to your Action phase, **At the end of your Buy phase effects are triggered, such as
    > Exploration. These effects trigger again during your next Buy phase.**
    >
    > If gaining a card that returns to your Action phase and there are other when-gain effects which care about
    > which phase a card is gained in (such as Colonnade or Footpad), **they will still see when the card was
    > gained, regardless of whether they are resolved before or after returning to your Action phase.**
    >
    > For example, you must still take D from Cavalry's pile even if you resolve Cavalry's when-gain effect before
    > Tax's when-gain effect.
    >
    > In games with Footpad, you do not get draw a card from gaining Villa even if you try to resolve it after Villa.
    >
    > You can also use Villa's effect to perform end of Buy phase triggers such as getting Coffers from Merchant
    > Guild and then take VP from Basilica.
    >
    > However, **if a when-gain effect triggers new effects (such as gaining additional cards) after Villa's effect
    > has been resolved, these gains happened in your Action phase.**
    >
    > For example, if resolving Villa and then reacting to gaining Villa by playing Sheepdog as Way of the Butterfly
    > and gaining Rocks, Rocks is gained in your Action phase and is therefore gained to your hand.
  - **RGG ルールブック L.394-401（River Shrine 項・逐語）**：
    > **If you have multiple Buy phases, such as via Continue, River Shrine only gains you a card if you didn't
    > gain a card in any of those Buy phases.**
  - Trivia / Preview：`Continue is a Villa family Event, that also gains a cheap Action and plays it. Maybe that
    will save your turn.`
  - **Trivia / Secret history（＝実装に直結）**：
    > Initially it didn't say "once per turn" and could gain Attacks. **The former loops**, the latter is super
    > no-fun when they Militia you turn one.

    ＝**"once per turn" を落とすと公式設計者が明言するとおり無限ループする**。
- **⚠ 実装で危ないところ**：
  1. **`ONCE_PER_TURN_EVENTS`（L.10798）に必ず入れる**（10枚で唯一）。上の Secret history が「無いとループする」と名指し。
     本アプリは `canBuyEvent`（L.10800）で**購入自体を拒否**する側の実装＝購入権を無駄にしない（§0-21 の方針どおり）。
     ⚠ **CPU 側も `canBuyEvent` を見る**＝`js/cpu.js` L.1119 の
     `const buyable = (id) => has(id) && afford(id) && E().canBuyEvent(state, p.id, id);` を**必ず通すこと**
     （コメント逐語＝「提案すると拒否され無限ループになるので必ず見る」）。
     ⚠ 帝国イベントのブロック（cpu.js L.1100-1114）は `buyable()` を通さず `afford()` だけを見ている＝
     **そちらに Continue を書き足してはいけない**。
  2. **最も近い既存実装＝略奪の 発進(Launch)**（L.10917 `case 'launch':`）＝**実物の4行を逐語で写す**：
     ```js
     case 'launch': {
       t.phase = 'action';
       t.treasuresLocked = false;
       t.arenaFired = false;                 // 闘技場の再武装（購入フェイズに入り直すと「最初から」＝公式）
       draw(state, pi, 1); addActions(t, 1); t.buys += 1;
       …
     }
     ```
     ⚠⚠ **`addActions(t, 1)` を必ず使う（`t.actions += 1` と直接書かない）**＝PROGRESS §0-25 の鉄則。
     直接加算すると**雪深い村(Snowy Village＝このターン以降の +アクション をすべて無視) が静かに壊れる**
     （mix-all で到達）。**`t.buys += 1` はそのままでよい**（`addBuys` ヘルパは存在しない＝実読で確認）。
     ⚠ **`addCoins(state, n)`（カメレオンの習性）も同じ鉄則**。Continue にコイン増は無いが、
     他のイベントで +$ を書くときは必ず `addCoins` を通すこと。
     **Continue は Launch に加えて「獲得 → その獲得した1枚を使用」が乗る**（**+1カードは無い**＝Launch と違う）。
  3. **★順序が3成分で違う＝獲得は購入フェイズ／使用はアクションフェイズ**（Other rules clarifications 逐語）。
     - **獲得は購入フェイズ扱い**＝川の社(River Shrine)／公会堂(Basilica)／列柱(Colonnade)／
       追いはぎ(Footpad)／徴税(Tax) が**購入フェイズの獲得として見る**。
       本アプリは §0-19 で **`gainWasBuyPhase`（L.8967＝獲得時点のフェイズを捕まえる）** を既に持っている
       ＝**それをそのまま使えば正しい**（フェイズを戻す前に獲得すれば自動的に正しい）。
     - **使用はアクションフェイズ扱い**＝**冠(Crown) がアクションモードになる**（＝手札のアクションを2回）。
     - ⇒ **`t.phase` を戻すのは「獲得を完全に解決した後・使用の前」**。ここを1行ずらすと両方壊れる。
  4. **獲得した1枚が動かされていたら使用できない（stop-moving）**＝
     **【v_events.md の訂正1 を採用。確定者が一次資料で再確認済み】
     `Rapid Expansion`（旭日の予言）は「山札の上に置く」のではなく
     「**脇に置き、次の自分のターンの開始時に使用する**」**：
     > When you gain an Action or Treasure, **set it aside, and play it at the start of your next turn.**
     > This even applies to cards that would ordinarily be gained directly to your hand for immediate use.
     > For instance, if you use Mine while Rapid Expansion is in effect, the gained Treasure will be set aside
     > and **can't be played on the current turn**.

     ＝**本アプリの 略奪の特性「せっかちな(Hasty)」とまったく同じ形**
     （`js/engine.js` L.9076 `hasty_aside` を `onGainQueue` に積む → L.11924 で `p.eventSetAside` へ移す →
     次ターン開始時に `event_play` が強制使用）。**Rapid Expansion はこの機構をそのまま使えばよい**（他群の担当）。
     ⚠ **「山札の上に置く」と信じて Continue × Rapid Expansion の回帰テストを書くと必ず誤った期待値になる。**
     - 他に動かす例＝望楼／王の印章／移動遊園地／追跡者／勲章／進歩(Progress・旭日の予言＝獲得を山札の上へ)。
     - **それでも「アクションフェイズに戻る＋1アクション＋1購入」は起きる**（公式の逐語）。
  5. **実装テンプレ＝`buried_treasure_play`（L.11860）／`invasion_play_loot`（L.11913）**
     ＝「獲得したカードを、**獲得時対話が全部片付いてから**、まだ獲得先ゾーンにあれば使用する。
     動かされていたら失敗してログを出すだけ」という形が**既に2つある**。
     ```
     if (bz && bz.indexOf('buried_treasure') >= 0) playCardNoAction(state, q.player, 'buried_treasure', bz, '獲得時効果で');
     else log(state, `… は使用に失敗した（獲得先から動かされていた）。`);
     ```
     ⇒ **Continue も `state.onGainQueue` に `{type:'continue_play', player, card, dest}` を積む**のが正しい。
     **獲得の直後に同期で使用してはいけない**（Rapid Expansion の `hasty_aside` も onGainQueue に積まれるので、
     同期で使うと**公式と逆に「動かされる前に使えてしまう」**）。
  6. **候補ゼロで窓を開かない**＝「$4以下・非アタックのアクション」がサプライに1枚も無くても、
     **フェイズ復帰と +1アクション +1購入は実行する**。獲得の窓だけ開かない。
  7. **獲得の述語＝`costUpTo(state, id, 4)`（素の `cardCost <= 4` 禁止）＋ `isTypeSupply(state,id,'action')`
     ＋ `!isTypeSupply(state,id,'attack')`**。
     ⚠ **種別判定は `isTypeSupply`（山の一番上の種別）**（§A2b）＝分割山／混合山で randomizer を見ると壊れる。
  8. **使用はアクション権を消費しない**（Official FAQ 逐語）＝**`playCardNoAction`（L.654）を通す**
     （§0-26 で新設済み。習性(Way) も選べる／炉(kiln) も通る）。
     ⚠ `canPlayHandCard`（航海の3枚制限・将軍）は**手札からの使用**の話＝
     Continue は「**獲得した1枚を（捨て札から）使う**」ので手札ではない＝**通さないのが素直**
     （`notePlayFromHand` も呼ばない）。**engine/CPU/UI の3面でこの判断を揃えること**。
  9. **「ターン開始時」効果は繰り返さない**（Official FAQ）＝`t.startQueue` を再実行しない。
  10. **【要判断】「購入フェイズ終了時」窓**＝公式（`Action phase` ページ逐語）は
      「**アクションフェイズに戻るときに発動する。そして次の購入フェイズでもう一度発動する**」。
      本アプリの該当窓＝**ワイン商(wine_merchant・L.12847 付近)／野外劇(pageant)／探査(exploration)／
      浴場(baths)** で、すべて **`END_TURN` → `endBuyTail` の連鎖**にしか無い。
      ⚠ **`launch` は「この経路では開かない＝許容簡略化」と engine のコメントに明記済み**（L.10916 逐語＝
      「⚠ ワイン商/ページェントの『購入フェイズ終了』窓はこの経路では開かない＝許容簡略化」）。
      ⇒ **Continue も同じ簡略化に揃えるか、この機会に両方直すかを決めて PROGRESS に書くこと。**
      ※ なお**後半（「次の購入フェイズでもう一度発動する」）は既に正しい**＝
      `END_ACTION_PHASE`（**L.12817-12818**）が **`t.bpGained = 0` と `t.pageantDone = false` をリセット**している
      （ヴィラ対応として §0-22 で入れたもの＝逐語コメント「探査／野外劇は『その購入フェイズ』単位＝
      購入フェイズに入り直すたびにリセット（ヴィラ対応）」）。
  11. **【確定者の追加所見】川の社(River Shrine) 用の器は既にある**＝
      **`t.buyPhaseGained`（`if (t.phase === 'buy') { t.buyPhaseGained = true; … }` で立つ・ターン中一度も落ちない）**が
      「**そのターンのどの購入フェイズでも1枚も獲得していない**」という RGG ルールブック逐語そのもの
      （現在は冒険の隠遁者 L.11456 が使っている）。**`t.bpGained`（購入フェイズ単位でリセット）と取り違えないこと。**
  12. **カード文の順序どおりに書く**＝`獲得 → （獲得時対話を全部解決）→ フェイズを戻す → 使用 → +1アクション +1購入`。
  13. **コスト＝`{ cost: 0, debt: 8 }`**。`BUY_EVENT`（L.12421-12424）が負債の加算と支配の振り分けを既にやる
      ＝**効果側で負債に触らないこと**。
  14. **id は `'continue'` を引用符付きキーで書く**（§0-5）。
  15. **4点セット必須**（`continue_gain` ＋ `onGainQueue` の `continue_play`）。
      **獲得は強制なので辞退ボタンは不要**、**候補ゼロなら獲得の窓だけ開かない**（6.）。
      `continue_play` は**非対話**なので `onGainQueue` の消化ループの中で**その場で適用して次へ進む分岐**に足す
      （§0-26 逐語＝「`onGainQueue` には非対話項目も入る。キュー消化は**その場で適用して次へ進む**ループに
      なっている＝新しい非対話項目を足すときはこの分岐に足す（pending にすると無意味な確認が出る）」）。
      **既存の同型3つ＝`buried_treasure_play`（L.11865）／`invasion_play_loot`（L.11918）／`hasty_aside`（L.11929）**。
  16. **CPU の `bestEventBuy`**＝**`js/cpu.js` L.1088 の `if ((p.debt||0) > 0) return null;` と
      L.1092 の `afford = (id) => (L(id).cost || 0) <= coins` に注意**＝
      **Continue は `cost: 0` なので「$0 でも afford が真」**＝**何も条件を書かないと毎ターン買ってしまう**。
      しかも `BUY_EVENT`（L.12406）の負債ガードにより、**買った瞬間そのターンはもう何も買えず、
      負債8を返し終わるまで次ターン以降も購入が止まる**（CPU は返済分岐で1ターン1回ずつ返す）。
      ⇒ **序盤（`p.turns <= 5`）に、$4以下の非アタックのアクションで欲しいものがあり、
      かつそのターンにカードを買う予定が無いときだけ**買う。**終盤に買うと明確に弱くなる**。

---

## 検算

### 反映した訂正：**3件**（うち採用しなかった **0件**）
| # | 重大度 | 内容 | 確定者の再検証 | 採否 |
|---|---|---|---|---|
| 1 | [medium] | Continue 節の例示＝**Rapid Expansion は「山札の上に置く」ではなく「脇に置いて次のターンの開始時に使用」** | ✅ 一次資料を自分で再取得（`m_rapidexp.txt`）＝`Prophecy text` 逐語で確認。さらに**本アプリの せっかちな(Hasty) と同じ機構**であることをコードで裏取り（`hasty_aside` → `p.eventSetAside` → `event_play`） | **採用**（Continue 節 4. を全面差し替え） |
| 2 | [low] | **Foresight にも Japanese 行がある（＝洞察）**。「Amass / Foresight / Gather は Japanese 行が無い」は誤り | ✅ 自分で `Foresight` を再取得＝`Japanese / 洞察` を確認。**日本語wiki（正本）も 洞察**で一致。無いのは Amass / Gather の2枚だけ | **採用**（日本語名は日本語wiki を正本として全10枚を記載） |
| 3 | [low] | Credit の Trivia 引用が省略記号なしで途中打ち切り | ✅ 自分で `Credit` を再取得＝続きの1文を確認 | **採用**（全文を記載） |

**採用しなかった訂正：0件**（3件とも一次資料で裏が取れた）。
※ v_events.md 自身が「棄却した候補」としていた2件（`continue` の予約語の表現／Practice の Strategy 引用の表記ゆれ）も、
確定者の判断として**訂正不要**に同意する。ただし**引用符付きキーの推奨は本文に残した**（無害かつ安全なため）。

### 確定者が独自に追加した所見：**6件**（収集docにも検証docにも無かったもの）
| # | 対象 | 内容 | 裏取り |
|---|---|---|---|
| A | Credit | **`takeDebt(state, pi, cost)` とは書けない**＝`takeDebt` の第3引数は**カードid**で `C()[cardId].debt` を読む。Credit は `p.debt` に**コイン成分を直に加算**する必要がある | `js/engine.js` L.1908-1916 を実読 |
| B | Asceticism | **財源(Coffers) は 2021年ルール変更で「自分のターン中いつでも」使える**＝苦行の追加支払いに使えるのが公式。しかし本アプリの `COFFERS_SPEND` は `if (state.pending) return state;` を持つ＝**pending 中は使えない**。要判断 | 英語wiki `Coffers`（`m_coffers.txt`）＋ `js/engine.js` の `COFFERS_SPEND` を実読 |
| C | Foresight | **既存ヘルパ `revealFromDeck(state, pi, pred)`（L.4291）が Foresight にそのまま使える**。完全な先例＝**農村(farming_village)** L.6362-6368 | コード実読 |
| D | Foresight | ⚠ **農村の既存実装は `triggerOnDiscard` を呼んでいない**＝そのままコピーすると坑道などが誘発しない | コード実読（機械確認） |
| E | Practice | ~~**`STAFF_PLAY`（杖）は `canPlayHandCard` を呼んでいない**＝取りこぼしの疑い~~ | ❌ **撤回（最終仕上げで反証）**＝下記 |
| F | Continue | **川の社(River Shrine) の「どの購入フェイズでも獲得していない」用の器は `t.buyPhaseGained`（ターン中リセットされない）で既にある**。`t.bpGained`（購入フェイズ単位でリセット）と取り違えないこと | ✅ コード実読で再確認（`gain()` L.2013-2016 で立つ ／ 隠遁者 L.11470 が読む ／ `t.bpGained = 0` は L.12817） |

**所見 A〜D・F は最終仕上げでも再検証して妥当（すべてコードを実読）。誤りは E のみ＝撤回した。**
- **撤回の根拠**＝`STAFF_PLAY`（L.13849）は `playCardNoAction(state, pd.player, action.card, pl.hand, '杖で')` を呼び、
  **`playCardNoAction`（L.657-661）が `zone === p.hand` のとき `canPlayFromHand` と `warlordBlocks` を必ず通す**。
  `canPlayHandCard`（L.8297）＝`canPlayFromHand && !warlordBlocks` ＝**同一の2条件**。
  ⇒ **杖に engine 側の取りこぼしは無い**（`notePlayFromHand` も同関数の中で呼ばれる）。
  ※ 残るのは **UI が候補を絞っていない可能性**（＝押しても何も起きない死に選択肢）だけで、
  これは Practice 節 5. に「3面のうち②CPU候補・③UIフィルタが本題」として書き直した。

### 枚数の検算
| 項目 | 値 | 取り方 |
|---|---|---|
| RGG ルールブック L.32-33 の列挙 | **10枚**（Amass, Asceticism, Continue, Credit, Foresight, Gather, Kintsugi, Practice, Receive Tribute, Sea Trade） | 逐語 |
| 本章に書いたカード | **10枚**（見出し10個・重複0） | Amass / Asceticism / Credit / Foresight / Kintsugi / Practice / Sea Trade / Receive Tribute / Gather / Continue |
| **一致（10 = 10）** | ✅ | 集合として完全一致・過不足0 |
| 日本語名の記載 | **10 / 10** | 蓄積・苦行・信用・洞察・金継ぎ・稽古・海上交易・賛辞・参集・継続（すべて日本語wiki＝DO訳） |
| 日本語カード文の記載 | **10 / 10** | 同上 |
| 区切り線 `<hr>` | **0 / 10** | 生HTML を `grep -o '<hr' \| wc -l`（対照＝旭日の王国カードは 4〜5） |
| 版が1行（＝1刷・機能エラッタ無し） | **10 / 10** | `Versions > English versions` |
| `Once per turn` | **1 / 10**（Continue のみ） | 生HTML の機械検索 |
| 既存761枚との id 衝突 | **0 / 10** | `js/cards.js` を機械検索 |
| 既存761枚との **日本語名**衝突 | **0 / 10** | `js/cards.js` の `name: '…'` を機械検索。紛らわしい既存名＝`交易`／`交易場`／`交易商人`／`収集`／`薬草集め`／`魔女の集会`＝**完全一致なし** |
| コスト | $2×4（Amass/Asceticism/Credit/Foresight）／$3×2（Kintsugi/Practice）／$4×1（Sea Trade）／$5×1（Receive Tribute）／$7×1（Gather）／**負債8×1（Continue）** | wiki `Info > Cost` |
| **新 pending を要する枚数** | **9 / 10**（不要なのは Foresight のみ） | §0-6 の表 |
| **新 action（`PLAYER_ACTIONS` に足す数）** | **11**＝`AMASS_GAIN` / `ASCETICISM_PAY` / `ASCETICISM_TRASH` / `CREDIT_GAIN` / `KINTSUGI_TRASH` / `KINTSUGI_GAIN` / `PRACTICE_PLAY` / `SEA_TRADE_TRASH` / `RECEIVE_TRIBUTE_GAIN` / `GATHER_GAIN` / `CONTINUE_GAIN` | §0-6 の表から算出（Foresight は pending 不要／`continue_play` は `onGainQueue` の非対話項目＝action 不要） |
| **新しい reduce 末尾の再開網** | **3**（Gather＝`t.gatherQueue`／Receive Tribute＝`t.receiveTributeResume`／Kintsugi＝`t.kintsugiResume`） | §0-8 |
| **新しい脇ゾーン（物理カード）** | **1**（Foresight＝`p.foresightAside`・**公開**） | §Foresight 2. |
| **新しい永続フラグ（非カード）** | **1**（Kintsugi＝`p.gainedGoldThisGame`・**公開**） | §Kintsugi 1. |

### RGG ルールブックからの取りこぼし＝**ゼロ**（再調査は不要）
`v_events.md` (d) の検証結果＝**RGG ルールブック L.715-829 の各イベントFAQ は英語wiki の Official FAQ と
逐語同一で、ルールブック側にだけある追加裁定は1件も無い**。
＝本章が引いた Credit L.752 と River Shrine L.394-401 以外に、**ルールブックを読み直して拾えるものは無い**。
※ ただし **pdftotext では `$` と負債アイコンが落ちる**＝**金額の正本は常に wiki 側**（PDF から金額を読まないこと）。

### ⚠ 未確定として残したもの（推測で埋めていない）
1. **Asceticism：手札枚数を超えて $ を払えるか**＝公式の裁定文が**見つからない**（英語wiki・ルールブックとも）。
   → 実装は `min(残りコイン, 手札枚数)` に丸める案を推奨だが、**裁定未確認**として PROGRESS に書くこと。
2. **Asceticism / Sea Trade：複数枚の廃棄が「同時」か「1枚ずつ」か**＝公式の裁定文が**見つからない**。
   → 既存の礼拝堂などに揃えて「1枚ずつ」を推奨。**2枚は必ず同じ実装にすること**。
3. **Foresight：捨てた札が捨て札トリガー（坑道など）を誘発するか**＝**個別の裁定文は無い**
   （カード文が `discard` なので一般則としては誘発する）。
4. **Receive Tribute：支配(Possession) 中の「このターン3枚以上獲得」の数え方**＝公式の裁定文を確認できていない。
   本アプリでは `t.gainedThisTurn` に積まれないので条件を満たしにくい（mix-all 限定の極端な経路）。
5. **相続した屋敷(Inheritance) を「場/山札のアクション」に数えるか**（Amass / Sea Trade / Foresight）＝
   一般則からは数えるはずだが**個別の裁定文は無い**。**§0-9 に5枚まとめた方針案を書いた**（未決）。
6. **Continue：「購入フェイズ終了時」窓を発動させるか**＝**公式は発動する**が、本アプリは `launch` で
   「発動させない＝許容簡略化」と決めている。**どちらに揃えるかはプロジェクトの判断**（未決）。
7. **Asceticism：財源(Coffers) を苦行の pending 中に崩せるか**＝**公式（2021ルール変更）は崩せる**が、
   本アプリの `COFFERS_SPEND`（L.16852-16853）は `if (state.pending) return state;` と `if (t.phase !== 'buy')` の
   二重ガードを持つ。**(a) 苦行の pending 中だけ通す／(b) 許容簡略化として明記**の**どちらかを決めること**（未決）。

---

## ⚠ 出荷済みの実バグ候補

### 1. `js/cards.js` L.2386-2389 の 旅行(Journey) のコメントが**カード文および engine と正反対**（＝ドキュメント欠陥・確定）

- **場所**＝`js/cards.js`（確定者が実読）
  ```
  L.2386  // Once per turn: If the previous turn wasn't yours, you don't discard cards from play in Clean-up
  L.2386     this turn, and take an extra turn after this one.          ← ★2022印刷版（旧）の英文
  L.2388  //    本文は研究doc §4-F の「旧テキスト（＝日本語の印刷版）」と逐語一致（＝2022版）。
  L.2389  //    **「3ターン連続」の文言が入っていたらそれは 2023エラッタ＝誤り**（ここには無い＝正しい）。
  L.2391    text: '…このターンの後に追加の1ターンを得る（ただし、連続3ターンとなる場合は得られない）。'  ← ★2023エラッタ（新）
  ```
  ＝**コメントが「3ターン連続の文言が入っていたら誤り」と書いているすぐ下の行に、その文言が入っている。**
- **実際の engine は 2023エラッタ側で正しい**（＝**カード文と挙動は一致している＝実行時バグではない**）：
  - `ONCE_PER_TURN_EVENTS`（L.10798）＝`['alms','borrow','save','pilgrimage','desperation','launch']`
    ＝**`journey` は入っていない**（＝2022版の "Once per turn:" を実装していない）。
  - `cleanupAndAdvance`（L.10540-10544）＝
    `journeyExtra = !extra && !missionExtra && !seizeExtra && (state.turn.chain || 1) < 2;`
    ＋ ログ `「旅行による追加ターンは発生しない（3ターン連続にはできない）。」`
    ＝**「but not a 3rd turn in a row」＝2023エラッタそのもの**。2022版の
    「If the previous turn wasn't yours」判定は**実装されていない**。
  - **PROGRESS §4 の決定D1＝「旅行＝2023年9月 Extra turn errata 側を採用。`ONCE_PER_TURN_EVENTS` に入れるのは
    `launch` だけ」**＝**コードは決定どおりで正しい。誤っているのはコメントだけ。**
- **原因（推定）**＝PROGRESS §0-30 に記録された **2026-08-15 の並行セッション事故**
  （「**`journey` の版が正反対に決定された**（2022印刷版 ⇔ 2023エラッタ）」）の**取り残し**。
  片方のセッションが書いたコメントの上に、もう片方の決定に沿ったカード文が乗った状態。
- **再現条件**＝実行時には現れない。**次に旭日のイベントを実装する人がこのコメントを読み、
  「カタログ文が誤っている」と判断して L.2391 を 2022版へ「修正」すると、
  カード画像とカード一覧が engine の挙動（2023エラッタ）と食い違う**
  （＝カードが「1ターンに1度」「直前が自分の手番なら不可」と表示するのに、engine はどちらも見ない）。
  **本章は同じ `applyEventEffect` / `ONCE_PER_TURN_EVENTS` / `DOM.LANDSCAPES` を触るので、
  作業中にこのコメントを必ず目にする。**
- **公式の根拠**＝英語wiki `Journey` の `Versions` 表に **2023年9月 Announced の Extra turn errata 行**があり、
  現行文面は `You don't discard cards from play in Clean-up this turn. Take an extra turn after this one
  (but not a 3rd turn in a row).`＝**L.2391 のカード文はこちら**。
- **修正案（1行の書き換え・挙動は不変）**＝L.2386 の英文を 2023エラッタ版に差し替え、
  L.2388-2389 を「**本文は 2023年9月 Extra turn errata（PROGRESS §4 決定D1）＝『3ターン連続にはできない』が
  入っているのが正しい。`ONCE_PER_TURN_EVENTS` に journey を足さないこと**」に反転させる。
  **`webp` の再生成は不要**（`text` フィールドは変えない）。

### 2. ~~`STAFF_PLAY` が `canPlayHandCard` を通っていない~~ ＝**バグではない（撤回）**
旧稿の所見Eは誤り。根拠は上の「確定者が独自に追加した所見」表の脚注を参照。
ただし **UI 側（`viewPendingModal` の `staff_play` の候補フィルタ）が `canPlayHandCard` で絞っているかは未確認**
＝絞っていなければ「押しても何も起きない死に選択肢」が出る **[推定]低優先の UI 欠陥**。
Practice を実装するときに同じモーダルを書くので、**そのついでに確認するのが最も安い**。

---

## 最終仕上げの反映結果

### 反映した [must]：**6件／6件（不採用 0件）**
（＝[must] は6件とも自分で `grep`／`Read` して裏が取れたので全件反映した。
**[nice] のうち1件＝N9 の「根拠」だけは反証したので採らなかった**＝下の「不採用」節。）
| # | 内容 | 確定者の再検証（自分で `grep`／`Read`） | 採否 |
|---|---|---|---|
| M1 | 新 pending の一覧と「4点セット」の明記が丸ごと無い | ✅ `PLAYER_ACTIONS`（L.21271）／CLAUDE.md の規則を確認 | **採用**＝**§0-6 に表を新設**＋各カード節の末尾に4点セット項を追加 |
| M2 | Credit「夜行カードは獲得できない」は誤り＝人狼は取れる | ✅ `js/cards.js` L.969 `werewolf: types:['action','night','attack','doom'] cost:5` を実読 | **採用**＝Credit 節 1. を全面書き換え（「除外フィルタを足すな」と明記） |
| M3 | 所見E（`STAFF_PLAY` が `canPlayHandCard` を呼んでいない）は誤り | ✅ `STAFF_PLAY` L.13849 → `playCardNoAction` L.657-664 の2ガードを実読。`canPlayHandCard` L.8297 と同一条件 | **採用**＝Practice 節 5. を全面書き換え＋所見表で**撤回**を明記 |
| M4 | カタログ配線（`expansion` / `EVENTS_*` / mix プール）が無い | ✅ `js/cards.js` L.2476-2494 の派生式・L.1843 `eventPoolFor`・L.1781 `MIX_LANDSCAPE_POOLS` を実読 | **採用**＝**§0-7 を新設**（4箇所の配線＋「書き忘れると静かに死ぬ」を明記） |
| M5 | Continue の +1アクションを `addActions` で書くこと | ✅ `case 'launch'` L.10917-10921 の実物4行（`draw / addActions(t,1) / t.buys += 1`）を実読 | **採用**＝Continue 節 2. にコードのまま引用＋`addCoins` も注記 |
| M6 | 「複数枚を順に処理する」再開網の具体名が無い | ✅ `t.prosperResume`（L.11766／`PROSPER_GAIN` L.13536）・`t.populateQueue`（L.1371／L.11966／L.19319）を実読 | **採用**＝**§0-8 を新設**（コード形つき）＋ Gather / Receive Tribute / Kintsugi の各節から参照 |

**不採用：1件（[nice] N9 の根拠部分のみ。[must] の不採用は0件）**
- **N9 の根拠部分＝「金貨はサプライからしか来ないので `gain()` の底に1行入れれば
  `gainFromOutside` を追いかけなくてよい」は誤りなので採らなかった**（提案自体は [nice] だが根拠が実装を壊す）。
  反証＝**`ROGUE_GAIN_FROM_TRASH`（L.15661-15672）は廃棄置き場から $3〜$6 のカードを獲得する＝金貨($6)が入る**
  （墓暴き・物色も同様）。これらは全部 `gainFromOutside`（L.1921）経由。
  ⇒ **Kintsugi 節 1. は「`gain()` と `gainFromOutside` の両方に入れる」を維持し、反証を明記した**。
  N9 の**有用な部分（`createInitialState` での初期化・読み取りを `!!` にする）だけ採用**した。

### 拾った [nice]：**10件／10件**（うち N1・N9 は**部分採用**）
| # | 内容 | どこに入れたか |
|---|---|---|
| N1 | RGG ルールブックに追加裁定は1件も無い（＝再調査不要）／pdftotext は金額が落ちる | 検算「RGG ルールブックからの取りこぼし＝ゼロ」節（**最終編集日の一覧は実装に無関係なので割愛**） |
| N2 | 一般則の Fishmonger の1文（1ターンに2つイベントを買う根拠） | Practice 節 11.（＝「もう一度 Practice を買う」戦略が旭日単独で再現できる） |
| N3 | カタログ文の言い回し正規化（「+1 カードを引く」→「+1 カード」） | §0-7 の末尾（`launch` の実カタログ文を根拠に引用） |
| N4 | 相続(Inheritance) の扱いが5枚に立つ | **§0-9 を新設**（Amass / Foresight から参照。`isTypeSupply` は静的なので獲得系3枚は自動的に対象外、も明記） |
| N5 | 永続持続（雇人/チャンピオン/尽きぬ杯/操舵手/王子）が `durationCards` に居座る帰結 | Amass 3.（＝以後ほぼ永久に空振り）／Sea Trade 12.（＝永久に強い） |
| N6 | CPU の購入判断が4枚ぶんしか無い | Amass 6.／Asceticism 9.／Credit 10.／Foresight 10.／Practice 13.／Sea Trade 12.／Receive Tribute 9.／Gather 8.／**Continue 16.（`cost:0` で afford が常に真＝最重要）** |
| N7 | Sea Trade のドローの副作用（シャッフル／-1カードトークン） | Sea Trade 10.（**回帰テストを1本必ず書く**と明記） |
| N8 | 廃棄モーダルの上限の持たせ方・どちらの段で辞退できるか | Asceticism 2.（2段の辞退導線）／Sea Trade 9.／Kintsugi 8. |
| N9 | `p.gainedGoldThisGame` の初期化と `!!` 読み | Kintsugi 1.（**ただし根拠は訂正して採用**＝上記「不採用」参照） |
| N10 | 「HJ 印刷版と文面が違う6枚」は未検証 | 冒頭の注記を「依頼文由来の未検証リスト＝確定事実として引き継がない」に書き換え |

**拾わなかった [nice]：0件**（N1 の一部＝10ページの最終編集日の一覧のみ、実装に効かないので省略）。
＋**批評の「参考」欄の日本語名衝突チェック（0/10）も検算表に取り込んだ**。


<!-- ===== m7_prophecies_a.md ===== -->

## 第7章 予言 前半8種

対象＝Approaching Army / Biding Time / Bureaucracy / Divine Wind / Enlightenment /
Flourishing Trade / Good Harvest / Great Leader（英語wiki `Prophecy` の List of Prophecies 15種の**先頭8つ**）

### この確定版の作り方
- 起草＝`g7_prophecies_a.md`（別エージェント）／敵対検証＝`v_proph_a.md`（さらに別エージェント）／
  **完全性の批評＝`c_proph_a.md`（4人目のエージェント）**。
- **私は検証docの訂正6件すべてを一次資料で取り直して確かめ、6件とも採用した**（採用しなかったものは無し）。
  再取得＝`RAW_DIR=C:/tmp/risingsun_research/raw_m_proph_a node tools/wikidirect.js "Biding Time" "Clean-up phase" "Coastal Haven"`
  （本文 `m_v1.txt`）／既存の生HTML `raw_v_proph_a/*.html` 9本／`rulebook.txt`（RGG 公式ルールブック 2024）。
- **さらに、起草・検証の両方が取りこぼしていた裁定を2件見つけた**（下記「私が追加した確定事項」）。
- **日本語名・日本語カード文は `g0_jp_pairs.md`（日本語wiki＝Dominion Online 訳）を正本にした**。
  ＝英語wiki の Japanese 行は8枚中5枚しか無かった（来寇／盛大な取引／偉大な指導者が欠落）ので、
  **起草docの「日本語名（参考）」は日本語wiki の値で全面的に置き換えてある**。

### 【2026-08-16 更新】批評（`c_proph_a.md`）を反映した
- **[must] 14件を全件反映**（うち1件＝Flourishing Trade の得点計算は**批評の提案した直し方が公式違反**なので
  結論だけ採り、修正方法を書き換えた＝下記「批評が間違っていた点」）。**[nice] は 18件を採用**。
- 批評の主張は**すべて自分で裏取りした**：本アプリのコードは `grep` / `Read` で実物を確認、
  公式ルールは日本語wiki の実ページ（`jp/retry4.txt` / `jp/retry5.txt` / `jp/batch3.txt`）と
  `rulebook.txt` / 英語wiki（`node tools/wikidirect.js "Cheap"`）で確認した。
- **⚠ `js/engine.js` の行番号は「参考」**。作業ツリーは**並行セッションが今まさに編集中**で、
  この文書を書いている最中にも `allyScoreForCards` 周辺が 8674 → 8691 へ動いた。
  **参照は必ず関数名で行うこと**（本文の行番号は 2026-08-16 時点の作業ツリーの実測値）。
- **私が新たに見つけた設計上の誤り2件**（起草・検証・批評のいずれも指摘していない）＝
  ①「`t.allyPlayed` に無条件で積む」は**この engine では成立しない**（§E に書き直した）／
  ②予言の +$ を reduce 末尾で出すと**港の村(Harbor Village)の精算より前**に走って誤爆する（§1 注に追記）。

### 版（wiki のページ版数）＝取得の再現性メモ
| ページ | oldid | 最終更新 |
|---|---|---|
| Prophecy | 96704 | 2026-07-29 |
| Approaching Army | 96703 | 2026-07-29 |
| Biding Time | 96709 | 2026-07-29 |
| Flourishing Trade | 96707 | 2026-07-29 |
| Enlightenment | 96735 | 2026-07-30 |
| Great Leader | 95991 | 2026-03-29 |
| Bureaucracy | 95282 | 2026-02-20 |
| Divine Wind | 95287 | 2026-02-20 |
| Good Harvest | 95289 | 2026-02-20 |

（起草docの「全ページ2026-07-29」は誤り＝検証doc 訂正4。私の再取得でも上表と一字一句一致。
PROGRESS の「2025年9月ごろ英語wikiで脚注付きの裁定がまとめて削除された」注意があるので版は残す。）

---

## 共通前提＝予言(Prophecy)の一般ルール（8枚すべてに効く）

### A. 予言は「カード」ではない（英語wiki `Prophecy` 導入文 逐語）

> **Prophecy is a landscape type introduced in Rising Sun.** Prophecies are special rules that take effect
> only once Omen cards have been played a certain number of times; at that point the Prophecy effects apply
> equally to all players. Prophecies are not Kingdom cards; including a Prophecy in a game does not count
> toward the 10 Kingdom card piles the Supply includes. **In fact, Prophecies are not considered "cards" at all;
> any text referring to a "card" (such as instructions to "name a card") does not apply to Prophecies.**
> However, for reference, the Prophecy effects are printed on cards in a landscape orientation with
> **iris blue frames**.

→ **`DOM.LANDSCAPES` に新 `kind:'prophecy'`（アイリスブルー＝青紫の枠・コスト欄なし）**。
`DOM.CARDS` に入れてはいけない（保存則 tally・`allCards`・庭園/品評会・建て直し/秘術師の「名前を宣言」から除外）。
＝**同盟の `ally` ／略奪の `trait` と同じ扱い**。
`tools/build-landscape.js` の `SKIN` に1行足す（前例＝`trait: { base: [104, 38, 46] }`）。
`WITH_COIN` は **false**、`KIND_LABEL` は `'予言 / Prophecy'`。

### B. 1ゲームに使う予言は**必ず1枚だけ**（＝予言どうしは絶対に同居しない）

> **There are 15 Prophecies, and only one is used in a game with Omens, regardless of the number of Omen cards.**
> — 英語wiki `Prophecy` 導入文

> **In every game with one or more Omen cards, deal out one Prophecy for it. Only use one Prophecy
> no matter how many Omens you have.**
> — 英語wiki `Prophecy` §Omens & Prophecies ／ `rulebook.txt` L112-113（同文）

⚠ **起草docは §A で自らこの逐語を引きながら、4箇所で「予言どうしの同居」を前提に実装指示を書いていた**
（Bureaucracy×Flourishing Trade／Flourishing Trade×Enlightenment／Good Harvest×Enlightenment／
Great Leader×Enlightenment）。**すべて存在し得ない組み合わせなので、本確定版では削除・書き換え済み**（検証doc 訂正2）。
＝**予言どうしの相互作用は実装もテストも不要**。

### C. 準備（`rulebook.txt` L62-64／L109-126・英語wiki `Prophecy` と同文）

> In games using an Omen, shuffle the Prophecies, and deal out one to be used this game. Put a number of
> Sun tokens on it based on the player count; see the Omens and Prophecies section.
> **If the Prophecy is Approaching Army, add an Attack card pile to the game (even if there already is one).**

> - Put **5** Sun tokens on the Prophecy for 2 players, **8** for 3, **10** for 4, **12** for 5, and **13** for 6.
> - "+1 [Sun]" means, **remove a token from the Prophecy. Then if it was the last token, the rules text on
>   the Prophecy becomes active, right then and for the rest of the game.**
> - "+1 [Sun]" **always appears first on Omens**, before anything else the card does.
> - "+1 [Sun]" **does nothing else once all the tokens are removed.**
> - **Prophecy text does nothing until the last Sun token is removed.**

### D. 「横型は合計2枚まで」に予言は数えるか＝**列挙から外れている**（が否定形の明文は無い）

`rulebook.txt` L54-56（＝2枚制限の対象を名指しで列挙している段落）：

> For normal play we recommend using at most 2 such cards; with other expansions that includes
> **Events, Traits, Landmarks, Projects, and Ways.** Skip any further landscape-oriented cards turned over.

そのうえで**別段落**（L62-63）で「In games using an Omen, shuffle the Prophecies, and deal out one…」。
＝**列挙に無く、ランダマイザーからめくる手順にも乗らない**（「オーメンがあれば配る」）。
**同盟の Ally が2枚制限に数えないのと同じ構造**。
⚠ **ただし「Prophecies は数えない」という否定形の明文は取れていない＝未確定**。
実装は Ally と同じ扱い（数えない）にしてよいが、**PROGRESS に「明文なし・Ally と同型と判断」と明記すること**。

### E. ⚠ 最重要の一般則＝**予言はその瞬間に有効になる。ただし「自身が恩恵を受けるか」は誘発点で決まる**

> **As Prophecies activate immediately upon removing the last Sun token, the Omen that removed the last
> token will receive +1 Action.**
> — 英語wiki `Great Leader` §Other rules clarifications

補強（担当外の Kind Emperor だが同じ一般則の別の逐語・`rulebook.txt` L677-680）：

> When the last [Sun] is removed, this applies **immediately, in the middle of resolving the Omen**,
> and only the player who removed the [Sun] gains an Action then.

→ **略奪の "next time" 型持続（＝その事象で場に出た1枚自身は誘発しない）とは正反対**。
`fireNextTime` の定石（「呼び出し時点の予約だけを発火」）を流用すると**必ず壊れる**。
`+1 Sun` は Omen のカード文の**先頭**にあるので、Omen の残りの効果を解決している最中に予言が有効になる。
→ **「予言が有効か」の判定は発火の瞬間に評価し、使用開始時にスナップショットしない。**

#### ⚠ ただし「最後のトークンを取り除いた Omen 自身も恩恵を受ける」は**一般則ではない**（批評 [must] G-1）

**誘発点が「後（After / たび）」なら自身も受け、「前（first, ／使用前誘発）」なら自身は受けない。**

| 予言 | カード文の誘発点 | 起動した Omen 自身は？ |
|---|---|---|
| Great Leader | `After each Action card you play` | **受ける**（英語wiki Other rules clarifications 逐語） |
| Approaching Army | `After you play an Attack card`（＝解決の最後） | **受ける**（同型。日本語wiki `来寇`「狐を使用して来寇を起動した場合、この狐の使用後に+1コインは発生する」） |
| **Good Harvest** | `..., **first**, +1 Buy and +$1`（＝使用前誘発） | **受けない** |

> **資本主義**の影響下で「【財宝化**茶屋**】を使用し、+1Sunを得たことで豊作が発動した」と言う場合では、
> **『使用前誘発効果』が誘発するタイミングを過ぎているので、豊作の効果は誘発しない。**
> — 日本語wiki `豊作` §詳細なルール（逐語）

#### ⚠⚠ 本アプリでの配線＝**`t.allyPlayed` に相乗りしてはいけない**（doc の前版の誤り。私が訂正）

前版は「`noteAllyPlay` が `t.allyPlayed` へ**無条件で**積むので、有効判定を `runAllyPlayed` 側でやればよい」と
書いていたが、**実物はそうなっていない**：

```js
// js/engine.js  function noteAllyPlay(state, pi, card)   （2026-08-16 の作業ツリーで L8179）
notePlunderPlay(state, pi, card);          // ← 略奪はここ（ally ガードの“前”）に相乗りしている
const a = state.ally;
if (!a || !card) return;                   // ← ★ Ally が無い対局・対象外の Ally では即 return
...
(t.allyPlayed = t.allyPlayed || []).push({ player: pi, card });   // ← 3種の Ally のときしか積まない
```

＝`t.allyPlayed` は **`state.ally` が 魔女の輪／小売店主連盟／写本士の仲間たち のときだけ**積まれる。
予言をここに載せると**同盟拡張が混ざっていない対局では1度も発火しない**。

**正しい形＝`notePlunderPlay` と同じ位置（`noteAllyPlay` の先頭・ally ガードの前）に相乗りし、専用キューを持つ。**
既存の完全な前例が2つある（どちらも `notePlunderPlay` が積み、reduce 末尾の再開網が消化する）：

| 既存機構 | 積む場所 | 消化する場所（reduce 末尾） |
|---|---|---|
| 略奪：フリゲート船 `t.frigateQueue` | `notePlunderPlay`（L2339） | L11743 付近 |
| 略奪：特性「鼓舞する」`t.inspiringQueue` | `notePlunderPlay`（L2327） | L11804 付近 |

＝**`t.prophecyPlayed`（仮）を新設し、`notePlunderPlay` の隣で無条件に積む**。
**有効判定（＝最後の日の出トークンが取り除かれたか）は必ず消化側で行う。**
`noteAllyPlay` は **`PLAY_ACTION` / `PLAY_NIGHT` / `playCardNoAction` / `playAsCommand` / `runReplays` など
32箇所**（`grep -o "noteAllyPlay(" js/engine.js | wc -l` ＝ 33 − 定義1）から呼ばれるので、全経路を自動で拾える。
※engine 内のコメントは「28箇所」のままだが**実測は32**（批評 [nice] 4-4。コメントが古い）。

---

## 1. Approaching Army ／ 来寇  （コスト無し・Prophecy）

- **英語カード文（逐語）**：

```
After you play an Attack card, +$1.
————
Setup: Add an Attack kingdom card pile to the Supply.
```

  （"Setup:" は太字 `<b>`。`+$1` は `+` ＋コイン画像。）
- **日本語カード文（DO訳）**：

```
アタックカード1枚を使用したとき、+1 コイン。
————
準備:ゲームにアタックである王国カードの山1つを追加する。
```

  （日本語wiki＝Dominion Online 訳。日本語名＝**来寇**。英語wiki には Japanese 行が無い。）
- **区切り線**：**1本**（生HTML の infobox セル内 `<hr style="width:50%;margin-left:25%;text-align:center;" />` が1個。
  ページ全体の `<hr` 4個の内訳＝infobox 1／English versions 1／French 1／German 1＝**カード文1枚あたり1本**。
  ⚠ 起草docは style を `height:2px;width:66%;…` と書いていたが、それは English versions 側のセルの style＝検証doc 訂正5。
  **本数の結論は正しい。本群8枚のうち区切り線があるのはこの1枚だけ。**）
- **版**：English versions は**データ行1行のみ**＝`Changes=First edition` / `Announced+Printed(colspan=2)=August 2024`
  → **刷りは1回だけ＝機能エラッタ無し**。
- **公式FAQ・裁定**（Official FAQ 全文・逐語。`rulebook.txt` L537-556 も同文）：

> The Attack card added in setup is in addition to the usual 10 Kingdom cards, even if those already included
> an Attack card. For split piles (from Allies and Empires), a pile is an Attack pile if the randomizer card
> for it is an Attack.
>
> The added pile is a regular Kingdom card pile, and can be gained from like other piles. This setup occurs
> at the start of the game, and so affects the game even if the Prophecy never happens.
>
> Once the Prophecy has happened, you get +$1 from each Attack card you play; for Duration Attacks,
> this applies only on the turn the Duration Attack was played.
>
> The +$1 is the last thing the Attack card does when it's played. You get the +$1 even if you didn't follow
> the instructions on the Attack card; for example if you used a Way (from Menagerie)

  **Other rules clarifications 節は存在しない**（目次で確認）。

  wiki 導入文：
> Alongside Young Witch, Approaching Army is therefore one of two things that causes the Supply to consist
> of more than 10 Kingdom card piles.

  Secret history（Donald X. Vaccarino, *The Secret History of the Rising Sun Cards*, August 2024）：
> At first you got +1 Card in Clean-up, and the included Attack wasn't an 11th kingdom card. We also tried
> +1 Card immediately. I liked +$1 best, and it was simpler to add an Attack than to insist that one should be there.

- **⚠ 実装で危ないところ**
  1. **8枚で唯一 Setup を持つ＝予言が発動しなくてもゲーム開始時から効く**（FAQ 逐語）。
     `createInitialState` で**11個目の王国の山**を足す。**すでにアタックが居ても足す**。
     ⚠ **若き魔女(Young Witch)の災い(Bane)と同時なら12山**になる。抽選の形（`inK` に既存王国を入れて除外／
     `NON_SUPPLY` 除外／プール走査）は **`pickBane` が良いコピー元**。
     ⚠⚠ **ただし「`pickBane` と同じ場所に書けばよい」ではない**（批評 [must] A-1）。
     追加した山が**準備を要するカード**なら、その準備も走らせなければならない：
     > 【追加アタック】が特別な準備が必要orルールが書き換わるカードだった場合、それも準備or適用する。
     > 幸運カードや不運カードの場合、**祝福**や**呪詛**カードの山札を用意する。前者は**偶像**、
     > 後者は**暗躍者・迫害者・人狼**が該当。なお、**迫害者の場合は加えてインプの山札も用意する**。
     > — 日本語wiki `来寇` §詳細なルール（逐語）

     本アプリの `createInitialState` の実際の順序（2026-08-16 実測）＝
     **家宝 L1412 → `pickBane` L1506 → Ally 選定 L1516 → `initSupply` L1542 → 山上VP L1622 →
     祝福/呪詛デッキ L1651-1658 → 特性の割り当て L1729**。
     ＝**`pickBane` の位置に足せば `initSupply`・Ally・祝福/呪詛・山上VP・特性 はすべて後から走るので正しい**。
     唯一 **家宝(Heirloom)の算出（L1412）だけは前**にある。現行の `DOM.HEIRLOOM_OF`（墓地/愚者/ピクシー/
     プーカ/秘密の洞窟/羊飼い/追跡者）に**アタックは1枚も無い**ので実害は無いが、
     **原則は「王国10種を確定した直後・内容依存の各種セットアップより前」に足すこと**。
     ＋ **オベリスク／特性の選出母集団にも11個目の山を入れる**
     （> 【追加アタック】の山札をオベリスクや特性のために選んでよい。ゲームの準備は好きな順番で行なってよい。）。
     本アプリは特性の割り当て（L1729）が後なので自動的に正しい。
  2. **山がアタックかの判定は「randomizer（山キー）の種別」**（FAQ 逐語＝分割山は randomizer で判定）。
     ＝**§0-29 A2b で確立した線引きの「山側」**を使う。**`isTypeSupply`（＝一番上の実カード）を
     使ってはいけない**（叙事詩/衝突/城砦などで誤判定する）。素の `DOM.isType(山キー,'attack')` が正しい。
     **本アプリのカタログは既にこの判定と一致している**（実測）＝そのまま回帰テストの表になる：

     | 山 | `DOM.CARDS[山].types` | 【追加アタック】候補か |
     |---|---|---|
     | `catapult`（投石機／石） | `action, attack` | **なる** |
     | `knights`（騎士） | `action, attack, knight` | **なる** |
     | `augurs` / `clashes` / `wizards` | `action, augur` 等（attack 無し） | **ならない**（中身に女魔導士/射手/魔導士が居ても） |
     | `page` / `peasant` | attack 無し | **ならない**（成長先に戦士/兵士が居ても） |
  3. **足した山は「普通の王国の山」**＝購入も獲得も可・**3山終了に数える**（`emptyPileCount` が自然に数える）。
     **災いカードのような特別扱いは一切しない**（日本語wiki 逐語）。
  4. **候補の除外条件は「非サプライだけ」＝コストに制限は無い**（批評 [nice] A-4。日本語wiki 逐語）：
     > 【追加アタック】のコストに制限はない。**ポーションや負債をコストに含んでいてもよい**。
     > ただし、サプライに置かないカード(**傭兵**など)は【追加アタック】とならない。

     ＝**`costIsPlainCoin` を掛けてはいけない**（掛けるとファミリアー等のポーション費用アタックが落ちる）。
     除外は `NON_SUPPLY` と「既に王国にある」だけ。
  5. **`+$1` は「アタックカードを使用した後」＝そのカードの解決の最後**。**習性(Way)で記載効果を差し替えても出る**
     （FAQ 逐語）＝**`applyEffect` の中に書いてはいけない**。
     配線は **§E の「`notePlunderPlay` の隣に無条件で積み、reduce 末尾で消化する」**（`t.frigateQueue` 方式）。
     ⚠ **`t.allyPlayed` に積むのは不可**（`state.ally` ガードで落ちる）＝§E を読むこと。
     日本語wiki の裁定もこの配線と一致する（批評 [nice] A-7）：
     > 「**狂戦士**を使用して**闇市場**を獲得→獲得した闇市場を**技術革新**の効果で即座に使用」とした場合…
     > まだ狂戦士の使用後のタイミングは来ていないので、+1コインの効果は発揮されていない。
     > **つまり闇市場による購入時の支払いに充てることはできない。**

     （対比＝**山トークンの +$1（冒険・渡し船/訓練）は「使用前誘発」なので闇市場の支払いに使える**。
     本アプリの `applyPileTokens` は `PLAY_ACTION` の中で `applyEffect` より前に呼ばれる＝既に正しい。）
     ほか：**ハツカネズミの習性でアタックを指定し、脇のアタックを使うと +2コイン**（習性の指定と脇の使用で2回）／
     **女魔術師・追いはぎで記載効果を書き換えられても +$1 は出る**。
  6. **夜行のアタック（人狼 Werewolf・夜襲 Raider＝夜想曲）も「アタックカードを使用」**＝
     `PLAY_ACTION` だけでなく **`PLAY_NIGHT` / `playCardNoAction` / `playAsCommand`** も `noteAllyPlay` を
     呼んでいるので、そこに乗れば自動で正しくなる（日本語wiki が吸血鬼・人狼を名指しで確認）。
  7. **持続アタックは「使用したターンだけ」**（FAQ 逐語）＝次ターンの開始時効果（`resolveDurationStartEffects`）では出さない。
  8. **アタックが誰にも影響しなかった／全員が免疫でも +$1 は出る**（FAQ の「指示に従わなくても出る」から導かれる）。
  9. **⚠未確定＝玉座の間/王の宮廷で2回使ったら +$2 か**。明示の一次資料は無い。
     「The +$1 is the last thing the Attack card does **when it's played**」＋
     同盟の「カードを使用した後」系 Ally が公式で**再演ごとに誘発**する（PROGRESS §0-29 A3 [medium] 2＝
     玉座×下役は公式 +$2）ことから **+$2 と読めるが推測**。本アプリの `runReplays` も
     `noteAllyPlay` を呼ぶので、**同じ配線に乗せれば自動的に +$2 側になる**。
  10. **⚠ `+$1` は `addCoins(state, n)` を通すが、「カメレオンの習性のため」ではない＝理由が逆**
      （批評 [must] 4-3。前版の記述は公式違反を招く）。公式は**カメレオンで +1ドローに変換されない**：
      > 【カメレオン化アタック】は、来寇で得た「アタック使用時+1コイン」を+1ドローに変換しない。
      > つまり、来寇発動時中に【カメレオン化魔女】使用時に得られるのは「2コイン、他プレイヤーは呪いを得る」で、
      > 【カメレオン化魔女】使用後に来寇の効果で+1コインを得る。 — 日本語wiki `来寇`（逐語）

      本アプリの `addCoins` は **`t.chameleon` が立っている間は無条件に +カードへ振り替える**：
      ```js
      function addCoins(state, n) {                       // js/engine.js（実測 L1854）
        if (t.chameleon && !t._chamSwap) { ... draw(state, t.active, n); return; }
        t.coins += n;
      }
      ```
      `t.chameleon` の寿命は `applyWay` の `try { applyEffect(...) } finally { t.chameleon = false; }`
      ＝**そのプレイの `applyEffect` の中だけ**（実測 L3629-3631）。
      → **§E の配線（reduce 末尾で消化）なら窓の外なので結果的に正しい**。
      ⚠ **`applyEffect` の中に書くとカメレオンで +1ドローに化けて公式違反になる**＝位置で担保すること。
  11. **⚠⚠ 非手番プレイヤーがアタックを使ったとき、手番プレイヤーにコインを与えてはいけない**
      （批評 [must] A-2）。`noteAllyPlay` の32箇所には
      **黒猫 / 番犬 / 隊商の護衛 / 牧羊犬 / 村有緑地 / 鷹匠 / 密航者**（＝相手のターンの使用）が含まれる。
      本アプリの `addCoins` は **`state.turn.coins`＝手番プレイヤーの財布**に足すので、
      そのまま発火させると**アタックされた側が使った黒猫で、アタックした側が +$1 する実バグ**になる。
      公式は「非手番でも誘発するが基本的に意味はない」：
      > 「**黒猫**を他プレイヤーのターンに使用した」という場合でも、アタック使用時+1コインは発生するが、
      > 基本的に意味はない（*1 自ターン中ではないので負債の返済はできない／
      > *2 **−1コイントークンを受けていた場合、取り除くことには寄与する**）。 — 日本語wiki `来寇`

      → **`e.player === state.turn.active` のときだけ加算する**のが正しい実装。
      公式との差は「非手番で −$1トークンが1つ消えるか」だけ（本アプリの `applyCoinPenalty` も
      `state.players[t.active]` しか見ないので、どのみち再現できない）＝**許容簡略化として PROGRESS に明記**。
      **⚠ Good Harvest / Great Leader もまったく同じ罠**（§7 注・§8 注に同文を置いた）。
  12. **⚠ 港の村(Harbor Village・略奪)の測定窓を汚さないこと**（批評 [must] A-3）。
      > 港の村の使用後にアタックカードを使用して来寇で1金を得たとしても、
      > **港の村のボーナス判定に影響することは無い。** — 日本語wiki `来寇`

      本アプリの港の村は **`applyEffect` をラップして「コイン差」で判定する**（`hvWatchers` → `settleHarborVillage`）。
      +$1 を `applyEffect` の内側で足すと**誤って港の村の +$1 が出る**。
      ⚠⚠ **それだけでは足りない**（私の追加発見）：選択待ちを挟むアクションでは判定が
      **reduce 末尾の `t.hvPending` 精算**に持ち越される。実測した reduce 末尾の並びは
      **`drainAllyPlayed`（L11641）→ フリゲート（L11743）→ 鼓舞する（L11804）→ `hvPending` 精算（L11815）**
      ＝**予言の drain をこの並びの前に置くと、港の村が +$1 を拾ってしまう**。
      → **予言の消化は `hvPending` 精算より「後」に置くこと**（回帰テスト＝港の村→執事(+$2 の選択)→アタック）。
      同じ理由で **資本主義の財宝集合にも影響しない**（`test/integrity.test.js` が枚数を固定している）＝
      > 来寇の「アタック使用時+1コイン」が発動しても、アタックカードのテキストに『+1コイン』という記載が
      > 増えるわけではない。**資本主義**購入後も…アタックカードが財宝として扱われることはない。
  13. **⚠ 「アタックの使用」であって「アタックの山のカードの使用」ではない**＝
      > 例えば、**投石機**使用時は+1コインを得るが、同じ山札にある**石**使用時は+1コインを得ない。

      （＝上の 2. の「山の種別で候補を選ぶ」とは**逆向きの判定**。混同しないこと。）
  14. **抽選プールにアタックが1枚も残っていない場合＝山を足さない**（批評 [nice] A-6 で**推測→根拠つきに格上げ**）：
      > 遊んでいる環境の都合上アタックである王国カードが全てサプライに並んでいる場合、
      > 【追加アタック】の山札は追加されない。これは**指示にできる限りまで従うというドミニオンの基本法則**に基づいている。

      ＝実装は「候補ゼロなら足さない」で終端させること（例外を投げない）。**未確定だったが解決済み。**

---

## 2. Biding Time ／ 好機到来  （コスト無し・Prophecy）

- **英語カード文（逐語）**：

```
At the start of your Clean-up, set aside your hand face down. At the start of your next turn, put those cards into your hand.
```

- **日本語カード文（DO訳）**：

```
クリーンアップフェイズの開始時に、手札をすべて伏せて脇に置く。
あなたの次のターンの開始時に、それらのカードを手札に加える。
```

  ⚠ **【訂正・批評 [must] 4-1】前版は「ホビージャパン印刷版の文面がこれと異なる」と書いていたが、これは誤り。**
  日本語wiki `好機到来` の「余談」は**訳語（Biding Time＝「好機を待つ」なのに「好機到来」は逆の意味）の話**で、
  HJ 印刷版のテキスト差には**一切触れていない**（「ちなみに、HJ版の未発売時の Dominion Online では
  『待機』と訳されていた」＝むしろ逆方向の話）。**取得済みの日本語wiki 19ページ中、
  `※ホビージャパンから発売されている「ドミニオン：旭日」版のテキストについては余談を参照のこと` の注記が
  付いているのは 川船(Riverboat) の1枚だけ**で、本群には1枚も無い（`jp/batch0.txt` L1727・L1959 で実測）。
  ＝**本群8枚は「HJ 印刷版との文面差は確認されていない」**。DO訳を採る方針（略奪の決定3）は変わらない。
- **区切り線**：**無し**（`<hr` = 0）
- **版**：English versions データ行1行＝`First edition` / `August 2024`（Digital 欄は**空**＝
  デジタル版専用テキストは存在しない＝DO訳を採っても英語原文とズレない傍証）→ **機能エラッタ無し**。
- **公式FAQ・裁定**（Official FAQ 全文・逐語。`rulebook.txt` L561-562 も同文）：

> **Instead of discarding unplayed cards in Clean-up**, you set them aside, and put them back into your hand
> at the start of your next turn.

  **Other rules clarifications 節は存在しない。**

  wiki 導入文（＝FAQ ではないが同じ結論）：
> Once it is activated, players no longer **discard** their hands during the Clean-up phase, but instead save
> their remaining cards and put them in their hand for the next turn. ... it means that dead cards such as
> Victory and Curse cards no longer slow your cycling, since after you draw them the first time they can just
> in effect remain in your hand indefinitely.

  **クリンナップの一般則**（英語wiki `Clean-up phase`。この2つが下記 [訂正1] の決定的な根拠）：
> **Official rules**: Take all of the cards you have in play (both Actions and Treasures), and any remaining cards
> in your hand, and put them all into your discard pile. … **Draw a new hand of 5 cards.**

> **Other rules clarifications**: If any card or effect lets you draw or **keep cards in hand during Clean-up,
> you still draw 5 cards**, resulting in a hand of more than 5 cards in total when you end your turn.

> **§Cards with additional Clean-up effects → At the start of your Clean-up**（＝このバケツの所属は
> **Biding Time / Friendly / Patient / River Shrine** の4つ）：
> **These effects are resolved before any cards from in play or hand are discarded.**

  Secret history（Donald X. Vaccarino, August 2024）：
> The first phrasing had it be optional, but man, let's not, you always want to set aside the cards.
> **It was always timed to avoid Militias.**

- **⚠ 実装で危ないところ**

  **【[high] 起草docの重大な誤りを訂正済み】相手のターン中も手札は空にならない＝普通に5枚引く。**
  起草docは「相手のターン中、手札が空になる／リアクションが一切できない／手札を捨てさせるアタックは空振り」と
  書いていたが、**Biding Time が置き換えるのはクリンナップの「手札を捨てる」ステップだけで、5枚のドローはそのまま行う**
  （上記 `Clean-up phase` の Official rules と Other rules clarifications、`Coastal Haven` のカード文
  `(you still draw 5)` の3系統で確認）。脇の伏せ札は別ゾーンにあるだけ。
  ＝**リアクション機構もアタック機構も一切変更不要**。守られるのは**脇に置いた札だけ**（＝Secret history の
  "timed to avoid Militias" の意味は「手札に残す方式では民兵に剥がされるので、手札から抜く方式にした」）。
  ⚠ **起草docのとおりに設計すると、存在しない前提で engine・CPU・UI を書くことになる。**

  1. **⚠ 本アプリ最大の罠＝「先引き」との順序**。このエンジンは `cleanupAndAdvance` が
     **自分の手番終了時に次の手札を先引き**する。正しい配置は：
     - **脇へ置く＝`endBuyTailSchemeOrCleanup`（engine.js L11509）の中**（＝増築 Improve・友好的な・忍耐強いと同じ窓）。
     - **手札へ戻す＝`resolveDurationStartEffects`（L7967）＝先引きの後**。
     ＝結果として次の自分のターンの手札は **5枚＋脇に置いた枚数**。
     **戻すのを先引きより前に置くと引き直しで壊れる。**
  2. **強制**（Secret history 逐語＝任意をやめた）。**0枚でも成立**（＝終端保証は自明）。
  3. **新ゾーンが要る＝`p.bidingAside`（伏せ札＝所有者のみ可視）**。**4点に配線**＝
     `allCards`（L7767）／`test/invariants.test.js` の `ZONES`（L22-）／
     `maskStateFor`（L21120。相手には `'back'` を枚数ぶん＝L21157-21158 の `puzzleBox`/`cage` が完全な前例）／盤面表示。
  4. **⚠ 「捨てる」ではない**＝坑道(Tunnel)・村有緑地・忠犬・織工・疲れ知らずの(Tireless) などの
     **捨て札トリガーを1つも通さない**＝`triggerOnDiscard`（L9620）を呼ばないこと。
  5. **⚠⚠ 同じ「クリンナップ開始時」バケツの他3枚との順序が結果を変える**（＝本アプリで実際に事故る点）。
     公式の分類（英語wiki `Clean-up phase` §Cards with additional Clean-up effects）は**3バケツある**＝
     - **`At the start of your Clean-up`**（＝**自分の**クリンナップ開始時）
       ＝ **Biding Time / Friendly（友好的な）／Patient（忍耐強い）／River Shrine（川の社）**。
       > **These effects are resolved before any cards from in play or hand are discarded.**
     - **`At the start of Clean-up`**（＝**誰の**クリンナップでも起きる）
       ＝ Alchemist / Encampment（陣地）/ **Improve（増築）** / Walled Village（城壁のある村）。
     - **`When discarding`**（＝捨てる処理そのものの置換）＝ **Coastal Haven（沿岸の避難港）** ほか。
       （批評 [nice] §1＝前版はこの3分類を1つに潰していた。次に「クリンナップ開始時」のカードを足すときに迷わないよう復活させた。）

     **Friendly と Patient は「手札から」札を取る**ので、**Biding Time を先に解決すると手札が空になり
     この2つが完全に死ぬ**。公式は同時誘発なので手番プレイヤーが順序を選べるが、
     本アプリの `endBuyTailSchemeOrCleanup` は**固定順**（先入れ順の既存簡略化）。実測した現在の順序は
     **increase 増築 → 策謀 `scheme_cleanup` → `friendly_discard` → `patient_set` → トリックスター `trickster_aside`**。
     → **`biding_time` の窓は `friendly_discard` / `patient_set` より必ず「後」に置くこと**。
     増築 Improve・策謀・トリックスターは**「場から」しか取らない**ので Biding Time との順序は無影響。
  5b. **⚠ 4枚目＝川の社(River Shrine) は「Biding Time より前」でないと死ぬ**（批評 [must] B-1）。
     川の社は**旭日の王国カード＝Biding Time と同じ拡張なので頻繁に同居する**（この2枚だけは
     「同じ拡張どうしの同居」が起きる＝予言どうしは同居しないのと違う）。
     川の社のクリンナップ効果は**カードを手札に獲得する**ので、Biding Time が先だと脇に入らずそのまま捨てられる：
     > クリーンアップフェイズの開始時に、①好機到来で手札を脇に置く→②**川の社**の効果で**守護者を手札に獲得**、
     > とした際は…守護者は捨て札にするんですかね。多分。 — 日本語wiki `好機到来` コメント欄

     ＝**Friendly / Patient / River Shrine を全部 Biding Time より前に置く**のが、
     4枚とも死なない唯一の固定順（公式は選択制なので、この固定順は「常に得な側」＝許容簡略化として明記）。
     **旭日の王国カード（川の社）を実装するバッチと Biding Time のバッチで、4枚まとめて順序を決めること。**
  5c. **⚠ 「手札に残る」効果は守られない＝アタック耐性の話と混同しない**（批評 [nice] B-2）。
     > 逆に、**堀や黒猫などの「他プレイヤーのターンに手札に残しておきたいカード」は好機到来の恩恵を受けられない**ので注意。
     > — 日本語wiki `好機到来`

     ＝訂正1（手札は普通に5枚引く＝リアクションは普通にできる）と両立する。**脇に置いた札は使えない**だけ。
     → **`hasReaction`（engine）／`immuneReveal`（cpu）／`reactOptions`（ui）が `p.bidingAside` を
     絶対に走査しない**ことを回帰テストで固定すること（走査すると「脇の堀で免疫」という公式違反になる）。
     実挙動のテストケース（同ページ・コメント欄）＝
     **フリゲート船は貫通する**（アクションフェイズ終了時に捨てさせる＝クリンナップより前）／
     **忍者などの手札破壊アタックは効かない**／**航海(Voyage)と組むと追加ターンが「+1アクション+5ドロー」相当になる**
     （＝脇の枚数が丸ごと乗る＝注8 の追加ターン挙動の確認用）。
  6. **沿岸の避難港(Coastal Haven・同盟 Ally)は同じバケツではない**（検証doc 訂正3＝正しい）。
     `Clean-up phase` の分類では **Coastal Haven は "When discarding" バケツ**（カード文逐語＝
     `When discarding your hand in Clean-up, you may spend any number of Favors to keep that many cards
     in hand for next turn (you still draw 5).`）。
     ＝**Biding Time（捨てる前）が必ず先に解決して手札を全部脇へ持っていくので、Coastal Haven は残す札が無く無意味**。
     **順序は規則で一意に決まっており、設計判断の余地は無い。**
     本アプリの実装位置もこれと一致している（`t.coastalKeep` を **`cleanupAndAdvance` の「手札を捨てる」直前**
     L10454-10456 で適用）＝**Biding Time を `endBuyTailSchemeOrCleanup` に置けば自動的に正しい順序になる**。
  7. **⚠ 旅行(Journey・略奪)とは別物**＝旅行は「**場の**カードを捨てない」（`t.journeyKeep`）、
     Biding Time は「**手札**を脇へ」。**共通化しないこと**（両方が立つと `p.hand = coastalKeep` の分岐と絡む）。
  8. **追加ターン（前哨地/航海/島民/旅行/使節団/今を生きる）**では「次のターンの開始時」＝その追加ターンの開始時に戻る。
  9. 脇の札は**所有カード**＝得点・庭園・品評会・保存則 tally に数える（`allCards` に入れる）。
  10. **オンラインの永続化スナップショット**に新ゾーンが増える＝旧スナップショットに `p.bidingAside` が無い場合は
      `(p.bidingAside || [])` で読むこと（§0-17 の `pending.self` と同型の後方互換）。

---

## 3. Bureaucracy ／ 官僚制  （コスト無し・Prophecy）

⚠ **既存の `bureaucrat`（役人・基本）と id も日本語名も紛らわしい**（カード一覧の全文検索で並ぶ）。

- **英語カード文（逐語）**：

```
When you gain a card that doesn't cost $0, gain a Copper.
```

  （`$0` はコイン画像。infobox・English versions 表とも同文。）
- **日本語カード文（DO訳）**：

```
コスト0でないカードを1枚獲得したとき、銅貨1枚を獲得する。
```

- **区切り線**：**無し**（`<hr` = 0）
- **版**：English versions データ行1行＝`First edition` / `August 2024` → **機能エラッタ無し**。
- **公式FAQ・裁定**（Official FAQ 全文・逐語）：

> This includes cards gained from outside the Supply (such as Loot, from Plunder).
>
> Cards with [D] costs don't cost exactly $0, and so come with a Copper.

  （`rulebook.txt` L571-573 が同文。⚠ PDF のテキスト層では負債記号 `[D]` とコイン記号が画像なので落ちている
  ＝`Cards with costs don't cost exactly , and so come with a Copper.` になる。**記号は wiki 側が正**。）

  **Other rules clarifications 節は存在しない。**

  Secret history（Donald X. Vaccarino, August 2024）：
> A late one. Initially phrased as "when you gain a card costing $1 or more," wait this set has debt,
> the idea wasn't to make you buy debt cards turn after turn, which was already a problem. So, "not costing $0."

- **⚠ 実装で危ないところ**
  1. **判定は「ちょうど $0 か」＝3成分すべて0か**。負債コスト（旭日の `$0+6D` Daimyo／`$0+5D` Mountain Shrine／
     `$0+8D` Artist、大君主 Overlord、技術者 Engineer など）は**「ちょうど$0」ではない＝銅貨が付く**（FAQ 逐語）。
     ＝本アプリの **`costExact(state, id, 0, 0, 0)`（engine.js L4476）の否定**で判定する。
     ⚠ **`costExact` は `gainableBase` を含む**（非サプライ・ロック中の分割山下段・在庫0を弾く）ので、
     **獲得したカードのコスト判定にそのまま使ってはいけない**。**`costOf(state, id)` を直接見て
     `c.coin === 0 && c.pot === 0 && c.debt === 0` を判定する**のが正しい。
     素の `cardCost(state,id) === 0`（L365＝コイン成分だけ）は**必ず負債札を取りこぼす**。
     `costIsPlainCoin`（L4498）も別物（＝ポーション/負債を持たないか）なので使わない。
  2. **ポーション費用（`$0+P`＝変成 Transmute／ブドウ園 Vineyard）にも銅貨が付く**
     （批評 [nice] C-1 で**未確定→解決**）。日本語wiki `官僚制` §詳細なルール（逐語）：
     > コストが**ポーションだけのカード(ブドウ園など)** や**負債だけのカード(絵師など)** は、コスト0でないカードなので注意。
     > 全てのカードのコストは、正確には「Xコイン Yポーション Z負債」とみなされるため。
     > **コイン以外のコスト表記がある時点で0コストのカードではない。**

     ＝**3成分判定でそのまま正しい**。
  3. **コストは獲得した瞬間の現在値＝コスト軽減で $0 になったカードには銅貨が付かない**
     （批評 [nice] C-1 で**未確定→解決**）。日本語wiki `官僚制` §利用法（逐語）：
     > **コストが0になっていれば、元のコストが0でなくても、銅貨がついてくることが無い。**
     > 但し、コストが1以上だと銅貨がついてくる。無計画な買い物はしないように。

     ＝街道／橋／安価な(Cheap)／発明家の家族／運河 と同居すると挙動が変わる（＝`costOf` を通せば自動で正しい）。
     ⚠ 起草docはここに **Flourishing Trade** も挙げていたが、**予言は1ゲーム1枚なので同居しない**（削除済み）。
  4. **サプライ外の獲得も対象**（FAQ 逐語＝略奪の戦利品 Loot）。
     ＝**`gain()` 一元入口だけでは足りない**。`gainFromOutside` ／ `gainLoot` ／賞品／馬／精霊／
     狂人・傭兵／闇市場 も全部通る位置＝**`triggerOnGain` の末尾**に置くのが正しい。
     ⚠ **最も忘れやすいのは「馬」**（批評 [nice] C-2）：
     > 官僚制の効果は、廃棄置き場のカードを獲得した際や、サプライ外のカードを獲得した際でも誘発する。
     > **特に、馬の獲得時は忘れやすいので注意。** また、迫害者や悪魔の工房でインプを獲得した場合、
     > 呪いの鏡で幽霊を獲得した場合も同様。 — 日本語wiki `官僚制`

     本アプリの `DOM.HORSE_GIVERS`（騎兵/馬屋/旅籠/仕着せ/牧場/くず鉄/そり/備品…）は
     **1ターンに何枚も馬を配る**＝**銅貨の山が一気に溶け、`onGainQueue` に大量に積まれる**。
     → **CPU ソークの重点ケース**（下の 7.「3山終了が速くなる」の最悪ケース）。
     ⚠ 逆に **賞品(Prizes) と略奪品(Spoils) は $0 なので銅貨が付かない**（＝良い境界テスト）。
  5. **入れ子の獲得になるので `state.onGainQueue` に積む**（`state.pending` を直代入しない）。
     ＝略奪のダブロン金貨（獲得時に金貨）と同型。**望楼／そり／交易商人の獲得置換リアクションの窓を握りつぶさないこと。**
  6. **無限ループにはならない**＝銅貨は `$0` なので銅貨の獲得は再誘発しない。**銅貨の山が空なら何も起きない**。
  7. **⚠ 3山終了が速くなる**＝銅貨の山（人数により 60/60/60/60…）が猛烈に減る。`emptyPileCount`（L7741）に効く。
  8. **全プレイヤーに効く**（予言は共通）＝相手のターンの獲得でも、**その獲得した人が**銅貨を得る。
  9. **獲得先は捨て札**（カード文に指定が無い＝通常の獲得）。

---

## 4. Divine Wind ／ 神風  （コスト無し・Prophecy）

- **英語カード文（逐語）**：

```
When you remove the last [Sun], remove all Kingdom card piles from the Supply, and set up 10 new random piles.
```

  （`[Sun]` は日の出トークンの画像。生HTML では `10&#160;new`＝ノーブレークスペース。）
- **日本語カード文（DO訳）**：

```
最後のSunトークンを取り除いたとき、サプライにある王国カードの山をすべて取り除き、新しくランダムに王国カードの山10個を追加する。
```

- **区切り線**：**無し**（`<hr` = 0）
- **版**：English versions データ行1行＝`First edition` / `August 2024` → **機能エラッタ無し**。
- **公式FAQ・裁定**（Official FAQ 全文・逐語。`rulebook.txt` L583-598 も同文）：

> The 10 Kingdom card Supply piles used this game are removed, as well as an 11th pile if something added one
> (such as Young Witch's Bane pile, from Cornucopia).
>
> Ruins (from Dark Ages), Potions (from Alchemy), and Platinum and Colony (from Prosperity) are not removed.
>
> Deal out 10 new Kingdom cards.
>
> Do any Setup for them that they require, including things like putting out the Potions if necessary.
>
> Do not give out Heirlooms (from Nocturne).
>
> Do not re-determine whether or not to use Shelters (from Dark Ages) or Platinum and Colony.
>
> Deal out an Ally (from Allies) if you get a Liaison and didn't already have one.
>
> The removed piles are gone; they no longer count as empty piles if empty, and cards can't be returned to
> those piles. Players can continue playing with cards they got from those piles though.
>
> Tokens on the removed piles are no longer on them (such as tokens from Teacher, from Adventures).
>
> Traits (from Plunder) and Obelisk (from Empires) still affect their removed piles, and the Bane
> (for Young Witch) is still the Bane.
>
> Search (from Plunder) does not trigger when piles are removed.
>
> "In games using this" abilities, like Shaman's (from Plunder), continue to function for removed piles.

  **Other rules clarifications**（全文・逐語）：

> Any cards that were involved in the original kingdom but not in the Supply (like Ferryman's pile, Riverboat's
> card, Page's upgrades, etc.) are not removed after Divine Wind.
>
> If a singular card has already been used in the original kingdom (e.g. it was used by Riverboat, or it was in
> the Black Market deck), the pile cannot be one of the 10 new piles.
>
> Removed Adventures tokens return to their player (and they can place the token again). Any other tokens
> (e.g. [VP] for Farmers' Market, or tokens for Family of Inventors) are removed forever.
>
> Players only get an initial Favor token the first time a Liaison is added to the game. If the original kingdom
> had a Liaison, and Divine Wind adds another one, you don't do that setup again.
>
> You can't exchange cards with a removed pile. That means, for example, if you have a Peasant still in your deck
> when the Divine Wind blows through, you won't be able to be able to replace it with a Soldier, and if you have
> a Vampire it will no longer be able to turn into a Bat (or vice versa).
>
> Cards not in the Supply are not removed, so you can still exchange your Soldier for a Fugitive.
>
> Cost reduction does not apply to cards that aren't yet in the game. This means if you play Highway and then
> activate Divine Wind, the cost reduction does not apply when Young Witch chooses its Bane.
>
> A Druid in the original kingdom will keep its 3 Boons after Divine Wind happens. A Druid added in the new
> kingdom will set aside whatever 3 Boons are on top of the deck.
>
> If there aren't enough Boons left (e.g. too many are set aside due to Blessed Village), Druid sets aside
> as many as possible.

  Preview / Secret history / Playing IRL：
> Divine Wind sweeps the board clean and refills it with who knows what. Try to get everything you need from
> the first set of 10 before it blows through. — *Rising Sun Previews 5: More Cards*, August 2024

> I really wanted something with this name, as it's this historical thing, a tsunami wiping out invading Mongols.
> The first one was a Moat, which is awful gameplay. … Then I had this sweet thing that wipes the board clean.
> So fun. — *The Secret History of the Rising Sun Cards*, August 2024

> **Divine Wind was not designed with online play in mind.** And I've played it IRL.
> **Now normally I only play with two expansions at a time; if say Horses might appear, well odds are they're
> already on the table.** …
> — Donald X. Vaccarino, *Dominion Reddit*, August 2024
> （批評 [nice] §2-2＝前版は太字部分を `…` で落としていた。**未確定「10 new random piles の抽選元プール」に
> 触れている唯一の作者発言**なので復活させた＝「その卓に出している拡張から引く」前提。下の 12. で参照する。）

- **⚠ 実装で危ないところ＝本群で断トツに危険。単独で1バッチ取るべき**
  1. **ゲームの途中でサプライ10山を丸ごと入れ替える＝本アプリに前例がまったく無い**。
     `createInitialState` の準備処理を**再入可能な関数に切り出す**必要がある
     （`initSupply` ／`pickBane` ／家宝／Ally 選定／ポーション／祝福デッキ／特性／山トークン…）。
     ⚠⚠ **「全部を再入する」は間違い**。**やること／やらないこと の2列で決めること**（批評 [must] D-1）：

     | 新しい10山に対して **やる** | **やらない** |
     |---|---|
     | 各カード固有の Setup（ポーションを出す等） | **家宝(Heirloom)を配る**（FAQ 逐語） |
     | 若き魔女なら**新しい災い(Bane)を選ぶ** | **避難所／プラチナ・植民地の再判定**（FAQ 逐語） |
     | 連携が出て Ally 未設定なら **Ally を配る** | **好意の初期配布の2回目**（元の王国に連携が居たならやらない） |
     | ドルイド＝新しく入ったぶんは山の上から祝福3枚（足りなければあるだけ） | **横型トークンの再配置**（下記） |
     | 川船(Riverboat)のような「さらに札を準備する」カード | **予言の追加**（【追加山】に前兆カードがあっても2枚目の予言は出ない） |

     **⚠ 横型トークンを新しい山に置き直してはいけない**（前版に無かった。批評 [must] D-1）：
     > 神風の効果で【追加山】が追加された時に、**各種ランドマークや徴税などが新たに【追加山】に
     > 各種トークンを置くことはない。** — 日本語wiki `神風` §詳細なルール（逐語）

     ＝本アプリの `createInitialState` が準備で配る **`state.pileDebt`（徴税）／`state.pileVP`（水道橋・
     汚された神殿）／`state.obeliskPile`／`state.traits`（特性の割り当て）／教師の山トークン** は
     **再入させない**。＝「準備処理を切り出す」ときに、この境界で関数を割ること。
  2. **残すもの**＝廃墟(Ruins)・ポーション・プラチナ/植民地。**避難所とプラチナ/植民地の判定はやり直さない**。
     **家宝(Heirloom)は配らない**。
     ⚠ **山が「無くなる」ことはない**（日本語wiki 逐語）＝
     ポーション費用のカードが【除去山】にしか無くても**ポーションの山は残る**／
     廃墟を使うカードが【除去山】にしか無くても**廃墟の山は残る**／`Ferryman` が除去されても【Ferrymanカード】は除外しない。
     **逆に「若き魔女の災いカードの山」はサプライの山なので【除去山】になる**（違いに注意）。
  3. **除去した山は「消滅」**＝
     - **3山終了に数えない**（`emptyPileCount`（L7741）が消えた山を見てはいけない＝`supply` からキーごと消す）。
     - **カードを戻せない**（`returnToPile` ／`canReturnToPile` が失敗する）。
     - **交換(exchange)できない**（`exchangeCard`）＝**騎士見習い→トレジャーハンター**も**吸血鬼↔コウモリ**も不可。
       ⚠ ただし**サプライ外の山**（トラベラーの成長先＝兵士→亡命者）は消えないので**交換できる**（FAQ 逐語）。
     - **プレイヤーが既に持っているカードはそのまま使える**。
     - **⚠ 「由来する山を参照する」効果は静かに失敗する。それでも保存則には数える**（批評 [nice] D-3）：
       > 【除去山】に由来する**陣地**を使用して金貨か鹵獲品を公開しなかった場合、陣地は**脇に置かれたまま
       > そのゲームが終了するまでどこにも移動しない**。ただし、この陣地は**あなたのカードと見なされる**ので、
       > ゲーム終了時に庭園やブドウ園などの得点計算においてあなたのカードとして数えられる。
       > … **実験**は戻す山札が存在しないため、プレイの度に2ドロー1アクションの恩恵だけを受けることになる。
       > … 【除去山】に由来する**農家の市場**など、「由来する山札を参照する効果」を持つカードは、
       > その発揮に失敗する。 — 日本語wiki `神風` §詳細なルール

       ＝**`p.setAside` に取り残された陣地は `allCards` に残る＝保存則 tally も得点も従来どおり**
       （＝`returnToPile` が失敗しても捨てたり消したりしないこと）。本アプリの陣地は既に
       「戻せなければ脇に残る」形なので、`returnToPile` が false を返したときに黙って残せば正しい。
  4. **⚠ 調査(Search・略奪)の `pile_empty` は誘発しない**（FAQ 逐語）＝
     `fireNextTime(state,'pile_empty')` を**呼ばないこと**。
     ⚠ **ただし「除去の直前に実際に枯れた山」の誘発は生きている**（批評 [nice] D-2＝順序で決まる）：
     > 【除去山】をゲームから取り除くことは山枯れではない。**調査**が持続していても、持続効果を誘発しない。
     > 「サプライの山の最後の1枚の**歌人**を獲得し(**=一度実際に山が枯れ**)、即座に**技術革新**により使用し、
     > 神風が発動した」という場合には、**調査の持続効果は誘発する**。 — 日本語wiki `神風`

     ＝抑止は「神風による除去」だけに掛けること（`fireNextTime` を一時的に無効化する等の乱暴な実装は不可）。
  5. **トークンの扱いが4種類に割れる**（Other rules clarifications 逐語＋批評 [nice] D-4）：
     - **冒険の山トークン（`p.pileTokens`）＝プレイヤーに戻る＝置き直せる**。
     - **それ以外の「山に載っている」トークンは永久に消える**＝農家の市場の山上VP（`state.pileVP`）／
       発明家の家族の好意（`state.pileFavor`）。
       ⚠ **徴税(Tax)の山上負債 `state.pileDebt` は明示が無い**が「Any other tokens」に含まれると読める＝**[推定]**。
     - **特性(Trait)とオベリスクは「消えた山」に効き続ける／災い(Bane)は災いのまま**＝
       `state.traits`（特性id→山キー）と `state.obeliskPile` は**消えた山キーを指したまま残す**。
       本アプリの `hasTrait` は `pileKeyOf` 正規化で「山が空でも効く」設計なので**そのままで正しい**。
     - **⚠ 4種類目＝「そもそも山に載っていないトークン」は無関係**（前版に無かった）：
       > **交易路**は交易路の山の上にトークンを追加するのではなく、**交易路マットの上にトークンを置く**。
       > よって、【除去山】に交易路が含まれていた場合も、その後の交易路の金量出力が落ちることは無い。
       > **封鎖**は特定の山の上にトークンを追加するのではなく、封鎖自身が脇に置いたカードの獲得に対して
       > 脇に置いている間効力を及ぼす。よって、【除去山】に対象カードが含まれていた場合も、
       > (廃棄置き場等から)対象カードを獲得した時には問題なく**呪い**を獲得させる。 — 日本語wiki `神風` §余談2

       ＝本アプリの `state.tradeRoute`（交易路マット）と封鎖の `delayedEffects.gained` は**触らない**。
  6. **「in games using this」系は消えた山にも効き続ける**＝シャーマン(Shaman)。
  7. **新しい10山の Setup は全部やる**＝ポーションを出す／若き魔女なら**新しい災いを選ぶ**／
     **連携(Liaison)が出て Ally が未設定なら Ally を配る**。
     ⚠ **好意トークンの初期配布は「連携が初めて入ったときだけ」＝2回目はやらない**（FAQ 逐語）。
  8. **⚠ コスト軽減は「まだゲームに入っていないカード」には効かない**（FAQ 逐語）
     ＝街道を出した後に神風→**新しい災いの選定は素のコストで行う**。
  9. **一意カード（singular card）の重複禁止**＝川船(Riverboat)が脇に置いた1枚・闇市場デッキに入っている札は
     新しい10山に選べない。⚠ 本アプリの闇市場デッキは**全プールを平坦化した母集団**を持つので、
     **神風の抽選母集団から闇市場デッキの中身を除外する**配線が要る。
  10. **ドルイド(Druid)の祝福**＝元からの Druid は3枚を保持／新しく入った Druid は山の上から3枚（足りなければあるだけ）。
  11. **⚠ 本アプリ横断の影響**：
      - `maskStateFor`（L21120）＝山が総取っ替え。
      - **オンラインの永続化スナップショット**＝復元時に旧サプライが残らないこと。
      - **サーバの「同意なしの1手もどす」`isNoConsentUndoableBuy`（server/gameServer.js L191）**＝
        サプライが全部変わる＝**必ず承認制へ落とす**（サプライの比較を持っているので自動的にそうなるはずだが要確認）。
      - **CPU の `evaluateKingdom`（cpu.js L871）は「王国の内容キーで1回だけ評価してキャッシュ」している**
        （`__engCache`）＝**神風で王国が変わったら必ず再評価させること**（キー自体が変わるので実は自動追従するが、
        `state.kingdom` を書き換え忘れると古い評価のままになる）。`GAIN_ORDER` は全カード網羅なので追従する。
      - `DOM.STAGE1_POOLS` / mix-all の抽選元。
  12. **⚠未確定＝「10 new random piles」の抽選元プール**が公式の逐語では定義されていない。
      ただし作者発言（Playing IRL）
      `Now normally I only play with two expansions at a time; if say Horses might appear, well odds are
      they're already on the table.` が **「その卓に出している拡張から引く」前提**を示している
      （＝馬のような非サプライ山が新たに要る可能性まで想定している）。
      → 本アプリなら **その対局の抽選母集団（`kingdomForSet` / mix-all のプール）と同じ集合**を使うのが自然。
      **明示の逐語は無いので PROGRESS に「作者発言からの推定」と明記すること。**
  13. **既に空だった山も含めて全部消える**＝**3山終了が巻き戻る**（略奪の「無謀な」が山へ戻すのと同型の危険）。
  14. **作者自身が「オンライン向けに設計していない」と明言**（Playing IRL）＝
      **本アプリで実装しないという判断もあり得る**。その場合は**許容簡略化として PROGRESS に明記すること**
      （＝予言15種のうち1種だけ抽選から外す、という形になる）。

---

## 5. Enlightenment ／ 悟り  （コスト無し・Prophecy）

- **英語カード文（逐語）**：

```
Treasures are also Actions. When you play a Treasure in an Action phase, instead of following its instructions, +1 Card and +1 Action.
```

  （生HTML では `+1&#160;Card` / `+1&#160;Action`＝ノーブレークスペース。）
- **日本語カード文（DO訳）**：

```
財宝カードはアクションカードでもある。
アクションフェイズに財宝カードを使用するとき、その指示に従う代わりに、+1 カードを引く、+1 アクション。
```

- **区切り線**：**無し**（`<hr` = 0）
- **版**：English versions データ行1行＝`First edition` / `August 2024` → **機能エラッタ無し**。
- **公式FAQ・裁定**（Official FAQ 全文・逐語。`rulebook.txt` L600-620 も同文）：

> Treasures are Actions for all purposes.
>
> For example if you use Rice Broker to trash a Copper, it's an Action and still a Treasure, so you draw 7 cards total.
>
> Treasures can still be played in the Buy phase to do what they normally do, but if played in the Action phase,
> they produce +1 Card and +1 Action rather than everything they normally do.
>
> You can turn these Treasures sideways to remind yourself that they didn't make $.
>
> Since Treasures are Actions, they can be used with Ways (from Menagerie) to get something other than
> +1 Card and +1 Action.
>
> Highwayman (from Allies) can't stop your first Treasure from being used in an Action phase for
> +1 Card and +1 Action.

  **Other rules clarifications**（全文・逐語）：

> If you use a card like Black Market, Storyteller, or Herb Gatherer to play a Treasure in the Action phase,
> it will still give you +1 Card and +1 Action instead of its usual effect.
>
> Enlightenment even applies to Treasure cards that are already Actions; if you play Crown, Coronet, or an
> Action affected by Capitalism in the Action phase, you still get +1 Card and +1 Action instead of the card's
> usual effect.
>
> However, a Treasure that is already an Action does not have its types changed by Enlightenment; an
> Action–Treasure doesn't become an "Action–Action–Treasure". A card either has a type or it doesn't.
>
> Enlightenment only affects cards and not piles. This means that the Copper pile is not an Action pile for
> e.g. Training or Populate.
>
> Treasures still remain as Actions when scoring (for e.g. Vineyard).
>
> Enlightenment prevents you from following the Treasure's instructions. If you play a Treasure as
> Way of the Chameleon, it makes you follow its instructions (unlike the other Ways), which means
> Enlightenment will stop that and make you get +1 Card and +1 Action instead.
>
> This only applies for your Action phase. If you play a Gold as Way of the Chameleon in your Buy phase,
> you get +3 Cards.
>
> If you've been attacked by Highwayman and you want the first Treasure played in your Action phase to have
> no effect instead of giving you +1 Card and +1 Action, for some reason, you are permitted to allow the
> Highwayman to take precedence over Enlightenment.

  wiki 導入文：
> Be careful, this overrules any other effects that might otherwise enable you to play a Treasure in your
> Action phase for its normal ability!

  Preview / Secret history：
> Enlightenment is a funny one, letting all Treasures just draw your next card in a pinch. It has lots of other
> gameplay too though, making your Vineyards bigger and letting you Lurker Platinums and on and on.
> — *Rising Sun Previews 2: Shadow*, August 2024

> … At first they were only Actions in Action phases, but that tripped people up, so now they're
> **Actions all the time**, but only Pig-able in Action phases. …
> — *The Secret History of the Rising Sun Cards*, August 2024

- **⚠ 実装で危ないところ＝横断リファクタが要る。本群で2番目に重い**
  1. **本アプリの `isTreasureFor(state, id)`（＝資本主義でアクションが財宝になる）の完全な鏡像**。
     **`isActionFor(state, id)` を新設して `DOM.isType(x,'action')` を一斉置換する**必要がある。
     ⚠ **規模は資本主義の比ではない**＝実測で **engine.js 156箇所／cpu.js 95箇所／ui.js 40箇所＝計291箇所**
     （`grep -o "isType([^)]*'action'" <file> | wc -l`。資本主義のときは engine 69箇所＝PROGRESS §0-22）。
     **engine・CPU・UI を同一コミットで直すこと**（片側だけ締めると本番 livelock＝§0-29 A2b の [high] と同型）。
  1b. **⚠ `isActionFor` は静的 `types` ではなく `isTreasureFor` の上に作る**（批評 [nice] E-4）：
     ```js
     isActionFor(state, id) = DOM.isType(id, 'action') || (Enlightenment有効 && isTreasureFor(state, id))
     ```
     ＝**資本主義で財宝になったアクション**も、**山師(Charlatan)で財宝になった呪い**もアクションになる：
     > **山師**を使用しているゲームにおいて、悟り発動後の**呪い**は「アクション-財宝-呪い」の種別を持つようになる。
     > 無論、アクションフェイズ中に呪いを使用して +1ドロー&+1アクション を得る動きが可能。 — 日本語wiki `悟り`
  2. **「for all purposes」＝得点計算にも効く**（FAQ 逐語 `Treasures still remain as Actions when scoring
     (for e.g. Vineyard).`）。
     ⚠ **資本主義は逆に「得点計算だけは静的判定に戻す」**（砦 keep）ので、**同じ関数の中で真逆の分岐**になる。
     ⚠⚠ **配線先は `vineyard` だけではない＝3箇所ある**（批評 [must] E-2）。
     `DOM.isType(c, 'action')` を得点に使っている場所を実測（2026-08-16 の作業ツリー）：

     | 関数 | 行（参考） | カード |
     |---|---|---|
     | `vpOf` | L7799 | **ブドウ園 vineyard** |
     | `landmarkScoreForCards` | L7864 | **果樹園 orchard** |
     | `landmarkScoreForCards` | L7869 | **凱旋門 triumphal_arch** |

     日本語wiki も同じ3枚を名指ししている：
     > 悟り発動後の効果は、**ゲーム終了後の得点集計時まで有効である**。**ブドウ園、果樹園、凱旋門**によって
     > 得られる勝利点に影響する。**プレイヤーターン中にのみ影響を及ぼす資本主義との違いに注意。**

     （批評 [nice] §2-3＝Flourishing Trade 側では `landmarkScoreForCards` は**不要**
     ＝現行21ランドマークにコスト参照は1つも無いことを実コードで確認済み。**FT では不要／EN では必須**。）
  3. **⚠ 「カード」には効くが「山」には効かない**（FAQ 逐語＝銅貨の山は Training / Populate の「アクションの山」ではない）。
     ＝**§0-29 A2b の線引きにそのまま乗る**（「山の種別＝randomizer 固定」／「サプライから獲得・廃棄する
     カードの種別＝一番上の実カード＝`isTypeSupply`」）。
     **待ち伏せ(Lurker) はカード判定＝プラチナを廃棄できる**（Preview 逐語）が、
     **山トークンの置き先や植民(Populate) は山判定＝銅貨の山は対象外**。
  4. **⚠ 消えるのは「使用時の指示」だけ＝「記載効果が丸ごと消える」ではない**（批評 [must] E-1。前版は言い過ぎ）。
     置換される経路は手札からの使用だけでなく **闇市場・語り部(Storyteller)・薬草集め(Herb Gatherer)** 経由も含む
     （FAQ 逐語）＝本アプリなら **`applyTreasureEffect` を呼ばない**形にする（`playTreasureCard` ／
     `playCardNoAction` の財宝分岐で「今アクションフェイズか」を見て分岐）。
     ⚠ **カードは普通に場に出る／区切り線の下の能力は生きる**：
     > 【Enlightened財宝】は、使用時効果がキャントリップ効果に上書きされるが、**場には出ること＆
     > 仕切り線の下に書いてある能力は発揮されること**に注意。【Enlightened**護符**】や【Enlightened**玉璽**】などは
     > 場に出ている時の効果を発揮する。【Enlightened**元手**】は**場から捨て札にされた時に負債トークンを
     > 受け取る効果**を発揮する。【Enlightened財宝】は**薬草商**などの「場に出ている財宝カード」を
     > 参照する効果の対象となる。 — 日本語wiki `悟り` §詳細なルール（逐語）

     ＝**玉璽 royal_seal / 護符 talisman の「場にある間」／元手 capital の捨て札時の負債
     （`cleanupAndAdvance` の `caps` ブロック）／「場の財宝」参照（薬草商・レプラコーン等）は今までどおり**。
  4b. **⚠⚠ 「使用したことで誘発する効果」も全部生きる**（批評 [must] E-3。ここが最大の事故点）：
     > 【Enlightened財宝】は使用時効果がキャントリップ効果に上書きされるが、
     > **「その財宝カードを使用したことにより誘発される効果」は誘発する**。
     > 【Enlightenedアタック財宝】(**遺物**など)の使用に対し、『アタックカードを使用された際に誘発する効果
     > （堀、秘密の部屋、馬商人、物乞い、浮浪児、隊商の護衛、外交官、番犬、**盾**、**来寇**）』を誘発できる。
     > 【Enlightened連携財宝】(**道化棒**など)使用後、**魔女の輪や小売店主連盟**の効果を誘発することができる。
     > 【Enlightened**銀貨**】使用後、「**商人**の『初めて銀貨を使用した時、+1コイン』」や
     > 「**サウナ**の…効果」などは誘発する。
     > **炉**の使用後に【Enlightened財宝】を使用すると、同名の財宝カードを獲得して良い。
     > 【Enlightened財宝】に由来する山札に**教師**などで置く各種プレイヤートークンがあれば、
     > そのトークンの効果を得られる。 — 日本語wiki `悟り` §詳細なルール（逐語）

     ＝**`applyTreasureEffect` を飛ばすだけでは足りない**。以下は**今までどおり通すこと**：
     `noteAllyPlay`（＝魔女の輪／小売店主連盟／略奪の旗艦・上陸部隊）／
     アタックのリアクション窓（`attack_window`・`ATTACKS`・`hasReaction`）／
     炉 `kiln`（`maybeKilnTrap` 相当）／商人の「最初の銀貨」／サウナの `t.saunaPlays`／
     山トークン `applyPileTokens`。
     ⚠ **素直に「入口でフェイズを見て早期 return」すると、これらを全部殺す。**
  4c. **どの action で出すか＝`PLAY_TREASURE` は使えない**（批評 [nice] E-6）。
     `PLAY_TREASURE` は **`if (t.phase !== 'buy') return state;`（実測 L12312）で即拒否**する。
     ＝アクションフェイズの財宝は **`PLAY_ACTION` 経由（＝アクション権を1消費して +1アクションが返る）**にするしかない。
     ⚠ **`PLAY_TREASURE` のフェイズ判定を緩める方向に走らないこと**＝`t.treasuresLocked`（購入後は財宝を出せない）／
     `playAllOrder`／航海の `canPlayFromHand` と噛み合わなくなる。
  5. **アクション-財宝（冠 Crown／Coronet／資本主義で財宝になったアクション）にも効く**（FAQ 逐語）。
     ⚠ **冠(crown)は `turn.phase` でモードを決めるカード**（PROGRESS §0-15 の `crownOpenPending`）なので**正面衝突する**
     ＝アクションフェイズの冠は「手札のアクション1枚を2回」ではなく **+1カード+1アクション**になる。
  6. **種別の重複はしない**＝アクション-財宝が「アクション-アクション-財宝」にはならない（FAQ 逐語）。
     ＝**`types` 配列を書き換えるのではなく述語で判定する**こと（`js/carddata.js` の表示ラベルも変えない）。
  7. **⚠ 命令(Command)の対象が激増する**＝大君主/はみだし者/船長/王子は「$N以下のアクション」を対象にするので
     **財宝が全部候補に入る**。`overlordTargets`（L4518）／`captainTargets`（L4507）／
     `bandOfMisfitsTargets`（L4529）／`princeEligible`（L4501）の4述語を `isActionFor` に寄せる
     （**engine拒否と CPU 非提案はセット**）。
  8. **習性(Way)が財宝に使える**（FAQ 逐語）＝`isUsableWay`（L3700）／`applyWay`（L3609）を財宝でも通す。
     ⚠ **カメレオンの習性だけ例外**＝カメレオンは「記載効果に従わせる」ので、**アクションフェイズでは
     Enlightenment が勝って +1カード+1アクション**／**購入フェイズなら金貨をカメレオンで +3カード にできる**（FAQ 逐語）。
  9. **追いはぎ(Highwayman・同盟)との競合＝原則 Enlightenment が勝つ**が、
     **プレイヤーが望めば追いはぎを優先させてもよい**（FAQ 逐語）＝**任意の選択窓が要る**。
     日本語wiki も同じ（`悟り` コメント欄）：
     > 追いはぎのアタック効果と悟りの効果はどちらも【上書処理】なので、アクション化銅貨の使用者が好きな方を選べます。

     ⚠ 本アプリの `highwaymanBlocks(state, pi)` は**呼ばれた時点で `t.highwaymanDone[pi]` を立てて無条件に止める**
     （＝副作用つきの述語）ので、そのままだと公式より弱くなる。
     選択窓を作るなら**4点セット必須**（engine reducer＋`PLAYER_ACTIONS`＋CPU `decidePending`＋UI `viewPendingModal`）。
     **候補は常に2つ（無効化／キャントリップ）なので辞退ボタンは不要**だが、
     **`highwaymanBlocks` が「判定と消費を同時にやる」形なので、窓を開く前に消費してしまわないよう分離すること。**
     ⚠ **窓を足さず「常に Enlightenment 優先」にするなら許容簡略化として PROGRESS に明記**（損は極小）。
  10. **アクション権を1消費するが +1アクション が返る＝実質キャントリップ**（「Treasures are Actions for all
      purposes」＋ 4c から導かれる。逐語の明示は無い）。
  11. **`PLAY_ALL_TREASURES`（財宝を全部出す）は購入フェイズの機能**＝アクションフェイズに漏らさないこと
      （`playAllOrder` ／`t.playAllResume`）。
  12. **`+1カード` は `draw`、`+1アクション` は `addActions(t,1)`** を必ず通す（雪深い村・カメレオン）。
  13. **⚠ 「指示が消える」ことの帰結＝テスト項目になる副作用**（批評 [nice] E-5。日本語wiki 逐語）：
      > 【Enlightened**略奪品**】や【Enlightened**備蓄品**】や【Enlightened**呪符の巻物**】は使用時に山札に戻ったり
      > 追放マットに移動したり廃棄されたりする効果も無くなるので、**場に残る**。
      > 【Enlightened**持続財宝**】は使用時効果で次ターン以降に行う処理がなくなるので、
      > **使用したターンのクリーンアップに捨て札にされる**。（王笏で再使用するなどして次ターン以降の処理が
      > 復活した場合は持続する。）
      > 【**無謀な**Enlightened財宝】…2回化は上書きされて発生しないが、
      > **「場から捨て札にしたとき由来する山に戻す」処理は残る**。
      > **銅細工師**を使用していても、【Enlightened銅貨】から +1コイン は得られない。
      > **羨望**により得た嫉妬を返したターンでも、【Enlightened銀貨】【Enlightened金貨】から +1コインは得られない。
      > ターン中最初に【Enlightened**愚者の黄金**】を使用しても**それはターン中最初の使用**なので、
      > 以降は +4コイン になる。

      ＝**持続財宝**（略奪の アンフォラ／尽きぬ杯／船首像／宝石、同盟の 契約書、ゴンドラ 等）は
      **`armDuration` を呼ばなければ自動的に正しい**（＝そのターンの片付けで捨て札へ）。
      **略奪品/備蓄品/呪符の巻物の自己移動も `applyTreasureEffect` を飛ばせば自動的に起きない**。
      **無謀な(Reckless)の「捨てるとき山へ戻す」は捨て札時効果なので残す**（`returnToPile` の経路は触らない）。
      **愚者の黄金の「このターン最初か」のカウンタは Enlightened でも普通に消費する**
      （＝カウンタの更新を `applyTreasureEffect` の中に置いてはいけない）。
  14. **⚠ 「悟りが発動した瞬間」の判定は §E の一般則に乗るが、既に始まっている処理には遡らない**
      （日本語wiki §「何らかの処理途中に悟りが発動した場合の詳細な処理」）＝
      **「財宝カードAの使用時効果処理途中／使用後効果処理により悟りが発動した」なら A は財宝として処理**
      （＝写本士の仲間たち・共謀者・港の村は A を「アクションの使用」と数えない）／
      **「使用前効果処理により発動した」なら A は悟りの効果を受ける**。
      ＝本アプリなら**「有効か」の判定を発火の瞬間に評価する」という §E の原則と一致する**が、
      **`applyEffect` を開始した後に種別が変わっても、そのプレイの種別判定はやり直さない**こと。

---

## 6. Flourishing Trade ／ 盛大な取引  （コスト無し・Prophecy）

⚠ 既存の **`trade`（交易・冒険イベント）**／**`trader`（交易商人・異郷）** と id が紛らわしい。

- **英語カード文（逐語）**：

```
Cards cost $1 less. You may use Action plays as Buys.
```

- **日本語カード文（DO訳）**：

```
すべてのカードのコストは1コイン下がる。アクション権を購入権として使ってよい。
```

  ⚠ **【訂正・批評 [must] 4-1】前版は「ホビージャパン印刷版の文面がこれと異なる」と書いていたが、これは誤り。**
  日本語wiki `盛大な取引` の「余談」は**英語ルールブックの Note の解釈の話**（下の注5b）で、
  HJ 印刷版への言及は一切ない。**本群8枚に HJ 印刷版との文面差は確認されていない。**
- **区切り線**：**無し**（`<hr` = 0）
- **版**：English versions データ行1行＝`First edition` / `August 2024`（Digital 欄は**空**）→ **機能エラッタ無し**。
- **公式FAQ・裁定**（Official FAQ 全文・逐語。`rulebook.txt` L621-629 も同文）：

> The cost lowering applies to all cards everywhere, including cards in the Supply, in hands, and in Decks.
>
> It's cumulative with other things that lower costs, like Bridge from Intrigue.
>
> If you have Action plays left in your Buy phase, you can use them as Buys instead.
>
> For example if you play no Actions at all, you have one Action play you didn't use, and so can use that as
> an extra Buy.
>
> What's relevant here is Action plays, not Action cards; you get one Action play per turn normally, and can
> increase that with cards like Rustic Village.

  **Other rules clarifications**（全文・逐語）：

> Cards still cost $1 less when scoring (which matters for Plateau Shepherds).

  **ルールブックの追加逐語2件（実装に直結。うち1件は起草・検証の両方が取りこぼしていた）**：

> **Flourishing Trade lowers costs, but has no effect on the cost of Daimyo.**
> — `rulebook.txt` L106

> **Costs of Events are not affected by cards like Flourishing Trade.**
> — `rulebook.txt` L167（Events の一般ルールの箇条書き。**起草doc・検証doc とも未収録＝私が追加**）

  Preview / Secret history / Wording：
> Flourishing Trade makes cards cheaper, and also lets you use Action plays as Buys, which could be handy.
> So you know, if you play a Village and then go to your Buy phase, those 2 Action plays you had left can both
> be Buys. — *Rising Sun Previews 2: Shadow*, August 2024

> Started out as "Action plays can be used as Buys," taken from a Ninja. Then it got the Bridge effect, then lost
> the Actions-as-Buys part, then got it back as a once-per-turn that could also turn a Buy into an Action, but
> that's tricky, so then back to just Actions into Buys. — *The Secret History of the Rising Sun Cards*, August 2024

> The root problem is that the game overloads the word "Action." If Dominion had Action cards but Villages gave
> you "+2 Plays," then it would be easy to refer to Plays. … — Donald X. Vaccarino, *Dominion Forum*, August 2024

- **⚠ 実装で危ないところ**
  1. **コスト軽減はコイン成分だけ＝負債のみのカード（Daimyo `6D`）には効かない**（ルールブック L106 逐語）。
     ＝**略奪の特性「安価な(Cheap)」と完全に同型**＝`cardCost` に -$1 を1本足すだけで
     **全員・常時・累積**になる（**$0 未満にしない**＝`cardCost` 末尾の `Math.max(0, …)` が既にある）。
  2. **⚠ イベントのコストには効かない**（ルールブック L167 逐語）。
     本アプリは既に「イベントはカードでないのでコスト軽減を受けない」（PROGRESS §0-20）なので**現状のままで正しい**が、
     `cardCost` に軽減を足すときに `BUY_EVENT` 側へ漏らさないことを回帰テストで固定すること。
     ⚠ **プロジェクト／特性の購入コストも同様**（＝横型は全部「カードではない」）。日本語wiki も同文：
     > **イベントやプロジェクトはカードではないため、コストは下がらない。** — 日本語wiki `盛大な取引` §詳細なルール
  3. **⚠⚠ 得点計算にも効く。ただし配線先は `cardCost` ではなく `scoringCost`**（批評 [must] F-1 の**結論だけ採用し、
     提案された修正方法は不採用**）。Other rules clarifications 逐語＝
     `Cards still cost $1 less when scoring (which matters for Plateau Shepherds).`
     **批評は「`allyScoreForCards` が静的コストを見ているので `cardCost` を通すよう直せ」と書いているが、
     `cardCost` を通すのは公式違反になる**。高原の羊飼い側の公式 Other rules clarifications が逐語で否定している：
     > `Cards must cost exactly [$2] to count, … **Most forms of cost reduction (e.g. Bridge) have no effect
     > when scoring. However, Cheap cards still cost [$1] less when scoring**, which may matter for
     > Plateau Shepherds, and **Flourishing Trade remains in effect**, which definitely matters.`

     ＝**橋／街道／王女／運河／石切場のような「場にある間」型の軽減は得点計算では効かない**（`cardCost` は
     最終ターンの `t.costReduction` や場の街道を拾ってしまう）。**効くのは 安価な(Cheap) と 盛大な取引 だけ**。
     → **本アプリには 2026-08-16 時点の作業ツリーに `scoringCost(state, id)` が既に在る**（並行セッションが
     この批評と同じ日に「安価な×高原の羊飼い」を修正して新設した＝下の「⚠ 出荷済みの実バグ候補」参照）。
     **Flourishing Trade は `scoringCost` に1行足す**（`cardCost` ではない）。関数のコメントにも
     `⚠ **旭日の予言「盛大な取引(Flourishing Trade)」も得点計算で効き続ける**＝実装したらここに足すこと。`
     と既に書いてある。
  4. **累積する**（橋・街道・発明家の家族・安価な と足し算）。
  5. **⚠ 新機構＝「アクション権を購入権として使う」**。`t.actions` → `t.buys` を**購入フェイズ**で使う。
     ＝**`COFFERS_SPEND` と同型の新 action**（engine reducer＋`PLAYER_ACTIONS`＋CPU＋UI の**4点セット必須**）。
     `COFFERS_SPEND` が良いコピー元（`if (state.pending) return state;` ＋ **`t.phase !== 'buy'` 拒否** ＋
     `amount <= 0` 拒否 ＋ 残量チェック ＋ ログ）。**候補ゼロ（アクション権0）でも窓は開かないので辞退ボタンは不要。**
     ⚠ **`SPEND_VILLAGER` をコピー元に併記してはいけない**（批評 [nice] F-3）＝
     `SPEND_VILLAGER` は **`if (t.phase !== 'action') return state;`（実測 L16874）でアクションフェイズ限定**
     ＝**フェイズ判定が逆**。日本語wiki も村人との違いを名指ししている：
     > 盛大な取引の効果を**村人**と組み合わせると…と考えるかもしれないが、**2024年8月現在のルールでは
     > 村人を支払えるのは『自ターンのアクションフェイズ中のみ』である。**
  5b. **⚠⚠ 未確定＝「変換型」か「置換型」か**（批評 [must] 4-2。前版は変換型と断定していたが、明示的な反対解釈がある）。
     日本語wiki `盛大な取引` §余談（逐語）：
     > 英語版Rule Booklet内の盛大な取引に関するNoteには、"If you have Action plays left in your Buy phase,
     > you can use them as Buys instead." とある。つまり、盛大な取引の効果は
     > **「ターン中いつでも宣言をすることでアクション権を購入権に変換できる」処理ではなく、
     > 「購入フェイズ中に購入権の代わりにアクション権を消費することでカードを購入できる」処理**のようである。
     > 「**王冠**での発生コイン量調節のためにあえてアクション権を購入権に変えておく」という動きはできない。

     ⚠ **ただし決着していない**＝同ページのコメント欄で2人が「『購入権が0となった際に』は、デジタル版での
     仕様を言語化して原文を大きく補った訳」と異議を出している。
     → **実装前に (a) 置換型／(b) 変換型 を決めて PROGRESS に書くこと**：
     - **(a) 置換型**＝`BUY` / `BUY_EVENT` 側で「購入権が無ければ `t.actions` を1消費して代用」。
       新 action は要らない（＝4点セット不要）。**先行変換ができない**ので王冠のコイン量調節はできない。
     - **(b) 変換型**＝`COFFERS_SPEND` 同型の新 action で任意回変換。**4点セット必須**。
     **観測差**＝①王冠(crown)のコイン量調節ができるか ②ヴィラ／騎兵で購入フェイズ↔アクションフェイズを
     出入りしたときの残アクション権（`END_ACTION_PHASE` は1ターンに複数回走る）。
     **私の推奨＝(a) 置換型**（Note の逐語に最も近く、本アプリでは新 action も UI も要らず、
     注8 の未確定も消える）。
  6. **⚠ 「アクションカード」ではなく「アクション権(Action plays)」**（FAQ 逐語）＝
     **1枚もアクションを使わなくても、素の +1アクション権が余っているので購入1つに変えられる**。
     本アプリは `t.actions` が毎ターン1で始まるので**そのまま使える**。
  7. **`t.actions -= n` は消費側なので `addActions` を通さなくてよい**（PROGRESS §0-25 の規約どおり）。
     **`t.buys += n` 側**が正しく増えること（`t.buys` に共通ヘルパは無い＝直書きでよい）。
  8. **⚠ 5b が未確定なので、この項も未確定**（批評 [must] F-2）。
     前版は「ヴィラ(Villa)/騎兵で購入フェイズ→アクションフェイズに戻っても、**変換済みの**アクション権は戻らない
     （資源変換の一般則）」と断定していたが、**(a) 置換型ならそもそも先行変換が存在しない**＝前提ごと成立しない。
     **`END_ACTION_PHASE` が1ターンに複数回走る**ことだけは、どちらの設計でも要注意。
  9. **CPU** が「余ったアクション権を購入に変える」判断をしないと**明確に弱くなる**
     （終端保証＝候補ゼロでも詰まらないこと）。`coffersToSpend`（ギルド）が良いコピー元。
  10. ⚠ 起草docは「Enlightenment と同居すると…」と書いていたが、**予言は1ゲーム1枚なので同居しない**（削除済み）。

---

## 7. Good Harvest ／ 豊作  （コスト無し・Prophecy）

⚠ 既存の **`harvest`（収穫・収穫祭）** と id が紛らわしい。

- **英語カード文（逐語）**：

```
The first time you play each differently named Treasure each turn, first, +1 Buy and +$1.
```

  （生HTML では `+1&#160;Buy`。⚠ `rulebook.txt` L631-632 は "fi" 合字が落ちて `The rst time` / `rst,` に
  なっているので**PDF テキスト層をそのまま写さないこと**。**wiki が正**。）
- **日本語カード文（DO訳）**：

```
各ターン中、名前の異なる財宝カードを初めて使用するたび、先に、+1 購入、+1 コイン。
```

- **区切り線**：**無し**（`<hr` = 0）
- **版**：English versions データ行1行＝`First edition` / `August 2024` → **機能エラッタ無し**。
- **公式FAQ・裁定**（Official FAQ 全文・逐語）：

> For example if you play 4 Coppers and a Silver, you'd get +2 Buys and +$2 total from Good Harvest.
>
> If you played a Treasure in the same turn before removing the last Sun token from Good Harvest,
> it doesn't retroactively give you +1 Buy and +$1.

  **Other rules clarifications 節は存在しない。**

  Secret history（Donald X. Vaccarino, August 2024）：
> The first version gave +$1 and +1 Buy for every Silver played. Those things are never enough fun. Then Golds
> instead. Then I sidetracked to giving +$1 per unused Action play, a concept I really shouldn't revisit,
> **let's not be forced to track Actions on Champion / Great Leader turns.** Then the different Treasures thing, hooray.

- **⚠ 実装で危ないところ**
  1. **「名前ごと・ターンごとに1回」**＝`t.goodHarvestNames`（そのターンに使用した財宝の**名前**の集合）を持ち、
     **`freshTurn` でリセット**。**同名の2枚目では出ない**。
  2. **⚠ "first," ＝ボーナスがそのカードの効果より先**。順序が結果を変える代表例＝**大金(Fortune・帝国)**
     （そのターン最初の大金でコインを2倍にする）＝先に +$1 が入っていれば倍加の対象になる。
     ＝**`playTreasureCard` の移動直後・`applyTreasureEffect` を呼ぶ前**に置く。
     日本語wiki も同じ結論（`豊作` §詳細なルール 逐語）：
     > 豊作の効果は、「各ターン中、初めて使用した名前の異なる財宝カードの使用時効果に『+1購入、+1コイン』を
     > 追加する」効果ではない。「財宝カードの使用時、それが『このターン初めて使用する名前の財宝カード』であれば、
     > **使用時効果発揮前に**1金1購入を得る」という効果である。
     > … **大金**、【財宝化**救貧院**】などは、使用時効果発揮前に1金1購入を得ることが問題になる場合があるので注意。
     > … **嫉妬**を返したターンに銀貨or金貨を使用した場合、使用時効果発揮前に1金1購入を得て、その後使用時効果で1金を得る。
  2b. **⚠ 同時に誘発する他の「使用前誘発効果」とは順序を選べる**（批評 [nice] G-4）：
     > Good Harvest の効果は「先に」の指示がある、いわば『**使用前誘発効果**』である。
     > **他に『使用前誘発効果』があれば、同時に誘発し、処理順は自由に選べる。**
     > （例＝**炉**の使用前誘発効果を先に処理し、財宝カードAを獲得後、豊作の効果で1金1購入を得る）

     ＝本アプリは「同時に誘発した効果の解決順を選べない」既存の横断簡略化があるので**固定順でよい**が、
     **炉(kiln)の窓（`KILN_GAIN`）と豊作の +$1 が同じ瞬間に立つ**ことは意識して配線すること。
  3. **遡及しない**（FAQ 逐語）＝予言が有効になる前に出した財宝を数え直さない。
     **⚠ さらに「有効化前にそのターン既に出した名前」も出ない**（批評 [nice] G-3 で**未確定→解決**）：
     > 豊作で追加1金1購入が得られるのは、あくまで『**このターン**初めて使用する名前の財宝カード』であり、
     > 『**豊作発動後に**初めて使用する名前の財宝カード』ではないので注意。
     > 例えば、「**語り部**の効果で銅貨を使用した後に、前兆カードを使用し豊作が発動し、その後銅貨を使用した」
     > という場合は、追加のコインは発生しない。 — 日本語wiki `豊作` §詳細なルール

     ＝実装は **`t.goodHarvestNames` を予言の有効/無効に関係なく毎ターン記録しておく**（＝「出ない」側）。**確定。**
  3b. **⚠⚠ §E の一般則の例外＝最後の日の出トークンを取り除いた Omen 自身は恩恵を受けない**（批評 [must] G-1）。
     Great Leader（`After …`）／Approaching Army（解決の最後）と**結論が逆になる**：
     > **資本主義**の影響下で「【財宝化**茶屋**】を使用し、+1Sunを得たことで豊作が発動した」と言う場合では、
     > **『使用前誘発効果』が誘発するタイミングを過ぎているので、豊作の効果は誘発しない。** — 日本語wiki `豊作`

     ＝**「予言は起動した Omen 自身にも効く」を予言全体の一般則として実装してはいけない**（§E の表を見ること）。
     豊作は誘発点が「前」なので、**その財宝の `playTreasureCard` の入口を既に過ぎていれば出さない**
     ＝素直に「使用の直前に判定する」実装にすれば自動的に正しくなる（＝特別な抑止コードは要らない）。
  4. **フェイズを問わない**（"each turn" であって "each Buy phase" ではない）＝
     **闇市場・語り部(Storyteller)・薬草集め(Herb Gatherer)** 経由でアクションフェイズに出した財宝でも誘発する。
     **アクションフェイズの冠(Crown)も「財宝の使用」**（日本語wiki 逐語＝ターン最初の冠なら1金1購入）。
     ⚠ 起草docはここに「Enlightenment 下のアクションフェイズの財宝」も挙げていたが、
     **予言は1ゲーム1枚なので同居しない**（削除済み）。
  5. **⚠ 再演では出ない**＝ティアラ／冠／偽造通貨／王の隠し財産で**同じ財宝を2回使っても名前は同じなので1回だけ**。
     本アプリは**2回目が `applyTreasureEffect` を通る**ので、
     **フックを `applyTreasureEffect` に置くと二重発火する**。**必ず「使用」側（`playTreasureCard`／
     `playCardNoAction` の財宝分岐）に置くこと。**
     ※そもそも名前集合で弾くので二重発火はしないが、**1枚目が別名なら誤って出る**形になり得る＝位置で担保する。
     **この位置決めは公式の裏づけがある**（批評 [nice] G-4）：
     > **持続していた契約書の効果発揮や、酒場マットからの法貨の呼び出しは財宝カードの使用にあたらない。**
     > — 日本語wiki `豊作`（コメント欄で**尽きぬ杯**も同様＝持続の毎ターンぶんでは誘発しない、と確認されている）

     ＝**`DURATION_RESOLVERS`（次ターン開始時の持続効果）からは絶対に呼ばないこと**。
  6. **`PLAY_ALL_TREASURES` の並び順（`playAllOrder`）に影響する**＝
     +$1 が先に入るので「大金(fortune)を最後に出す」既存の最適化と噛み合う（＝現状のままでよいが要確認）。
  7. **⚠ `+1購入` は `t.buys += 1`、`+$1` は `addCoins(state,1)` を通すが、「カメレオンの習性のため」ではない**
     （批評 [must] 4-3・G-2＝§1 注10 と同文の罠）。公式は**カメレオンで変換されない**：
     > **豊作の効果はカメレオンの習性の適用範囲外なので注意。** — 日本語wiki `豊作`

     `addCoins` は `t.chameleon` が立っている間は無条件に +カードへ振り替えるが、
     `t.chameleon` の寿命は `applyWay` の `try { applyEffect(...) } finally {...}` ＝
     **`applyEffect` の中だけ**。豊作は `playTreasureCard` の入口（＝`applyTreasureEffect` の前）で出すので
     **窓の外＝結果的に正しい**。⚠ **位置で担保すること**（`applyTreasureEffect` の中に書くと化ける）。
     なお **習性として使用しても／追いはぎで無効化されても／女魔術師でキャントリップ化されても
     1金1購入は得られる**（日本語wiki 逐語）＝**カードの使用そのものに誘発する**。
  8. **⚠ 「財宝か」の判定は `isTreasureFor(state, id)`**＝資本主義で財宝になったアクションも対象。
  9. **⚠ 全プレイヤーに効く。ただし非手番の使用者に資源を与えないこと**（批評 [must] G-2＝§1 注11 と同型）：
     > **自分のターン以外でも豊作の効果は誘発する。** よって、他プレイヤーのターン中に(アタックへのリアクションとして)
     > 【財宝化隊商の護衛】を使用すると、1金1購入を得る。ただ、**この1金1購入は次ターンに持ち越されることもないので、
     > 基本的に意味はない。** — 日本語wiki `豊作`

     本アプリの `addCoins` / `t.buys` は**手番プレイヤーの `state.turn`** に足すので、
     非手番で発火させると**相手の財布が増える実バグ**になる。→ **使用者＝`state.turn.active` のときだけ加算**
     （公式との差は「意味のない1金1購入」だけ＝**許容簡略化として PROGRESS に明記**）。
  10. **⚠ 港の村(Harbor Village)のボーナス判定に影響させないこと**（批評 [must] G-2＝§1 注12 と同型）：
     > **港の村**の【追加効果】を得るかどうかについて、豊作の効果は影響しない。
     > 具体的には…【財宝化教師】使用時に豊作の効果で1金1購入を得るが、これは「『【財宝化教師】の効果で
     > +コインを得た』のではなく、『豊作の効果で+コインを得た』」という処理なので、港の村の追加効果は発生しない。

     ＝本アプリの港の村は **`applyEffect` のコイン差**で判定する（`hvWatchers`／`t.hvPending`）。
     豊作は財宝なので通常は `applyEffect` を通らないが、**資本主義で財宝になったアクション**を
     アクションフェイズに使う経路では両方が同時に立ち得る＝
     **豊作の +$1 は `applyEffect` の外（`playTreasureCard` / `playCardNoAction` の財宝分岐）で出すこと**。

---

## 8. Great Leader ／ 偉大な指導者  （コスト無し・Prophecy）

⚠ 既存の **`great_hall`（大広間・陰謀）** と id が紛らわしい。

- **英語カード文（逐語）**：

```
After each Action card you play, +1 Action.
```

  （生HTML では `+1&#160;Action`。English versions 表の Text 欄も同文。）
- **日本語カード文（DO訳）**：

```
アクションカード1枚を使用するたび、その後に、+1 アクション。
```

  （日本語wiki＝Dominion Online 訳。日本語名＝**偉大な指導者**。英語wiki には Japanese 行が無い。）
- **区切り線**：**無し**（`<hr` = 0）
- **版**：English versions データ行1行＝
  `Text="After each Action card you play, +1 Action." / Changes=First edition / Announced+Printed=August 2024`
  → **機能エラッタ無し**。
- **公式FAQ・裁定**（Official FAQ 全文・逐語）：

> Since every Action card you play gives you at least +1 Action, you'll always be able to play all of your
> Action cards, barring explicit exceptions like Snowy Village (from Menagerie).

  **Other rules clarifications**（全文・逐語。**8枚の中で最も重要な一般則**）：

> **As Prophecies activate immediately upon removing the last Sun token, the Omen that removed the last token
> will receive +1 Action.**

  wiki 導入文：
> Once activated, it gives everyone unlimited terminal space for the rest of the game.

  Preview / Secret history：
> Great Leader just means you'll have all the Actions you need. — *Rising Sun Previews 4: On-play Debt*, August 2024

> At first it gave +3 Actions when it triggered and on each turn. I upped it to a full Champion, just uh, man,
> it let me get rid of the condition for the triggering player and just felt better.
> — *The Secret History of the Rising Sun Cards*, August 2024

- **⚠ 実装で危ないところ**
  1. **チャンピオン(Champion・冒険)と実質同型＝既存コードが最良のコピー元**。
     本アプリは `p.champions` を持ち、
     **`PLAY_ACTION`（実測 L12224-12229）と `PLAY_NIGHT` でアクション使用のたびに `addActions`** している。
     **Great Leader はその「全員版・自身も含む」**。
     ⚠ ただし**champion の実装は「効果解決の前」に加算している**（`applyEffect` の前）。
     **Great Leader は "After each Action card you play"＝効果解決の後**なので、
     **同じ場所に書くと下記 3. の公式裁定が再現できない**（＝Omen が自分自身に +1アクションを出せない）。
     日本語wiki も違いを明記している：
     > 偉大な指導者の効果は、『アクションカードを使用した際、そのアクションカードの**使用時効果発揮後に**
     > +1アクション得る』という意味である。厳密には**チャンピオン**の無限アクション効果（アクションカード1枚を
     > 使用する時、**その解決前に**、+1 アクション）とは厳密には異なる。 — 日本語wiki `偉大な指導者`
  2. **⚠ `+1アクション` は必ず `addActions(t, n)` を通す**＝**雪深い村(Snowy Village)が明示の例外**
     （FAQ 逐語）＝「このターン以降の +アクション をすべて無視」が効かなければならない。
     `t.actions += 1` を直接書いたら公式違反になる（`addActions` は `t.ignoreActionBonus` を見る＝実在を確認済み）。
     **回帰テストの期待値が日本語wiki にそのまま書いてある**（批評 [nice] H-2）：
     > 偉大な指導者発動後に、**1アクション権所持の状態から雪深い村を使用した場合、残りアクション権は4**となる。

     （＝1 − 1（使用）+ 4（雪深い村の +4アクション。これは自身の記載効果なので入る）＋
     0（偉大な指導者の +1 は `ignoreActionBonus` で無効）＝**4**。）
  3. **⚠⚠ 最後の日の出トークンを取り除いた Omen 自身も +1アクション を得る**（Other rules clarifications 逐語）。
     ＝**略奪の "next time" 型（その1枚自身は誘発しない）とは正反対**。
     `+1 Sun` は Omen のカード文の**先頭**にあるので、**Omen の解決の途中で予言が有効になり、
     その Omen の使用に対する「After each Action card you play」が発火する**。
     **実装＝§E の「`notePlunderPlay` の隣に無条件で積み、reduce 末尾の再開網で消化し、
     有効判定は消化側で行う」**（`t.frigateQueue` / `t.inspiringQueue` 方式）。
     ⚠⚠ **前版が書いていた「`t.allyPlayed` に積む」は成立しない**＝`noteAllyPlay` は
     `state.ally` が3種の Ally のときしか積まないので、**同盟拡張が混ざっていない対局では1度も発火しない**。
     詳細と実コードは **§E の「本アプリでの配線」**を読むこと。
  4. **「After each Action card you play」＝アクションカードの使用ごと**。
     `noteAllyPlay` は **`PLAY_ACTION` / `PLAY_NIGHT`（人狼＝アクションでもある夜行）/ `playCardNoAction`（＝
     苦労/進軍/博打/王子/船長/遅延・刈り入れ）/ `playAsCommand` / `runReplays`** など
     **32箇所すべてから呼ばれる**ので、そこに乗れば全経路を自動で拾う（実測＝`grep -o` で33、うち定義1）。
     **購入フェイズの冠(Crown)／夜フェイズの人狼でも +1アクションが増える**（批評 [nice] H-1）：
     > **購入フェイズに冠などを使用した時や、夜フェイズに人狼を使用した時にも +1アクションされるのを
     > 数えそびれないよう注意。** — 日本語wiki `偉大な指導者`

     → **「購入フェイズなのにアクション権が増える」表示**（盤面バッジ・ログ）が破綻しないか確認する項目。
     ⚠ **未確定＝再演（玉座/王の宮廷/行進/御料車/無謀な/大名）で何回誘発するか**。明示の一次資料は取れなかった。
     同盟の「カードを使用した後」系 Ally は公式が**再演ごとに誘発**する（PROGRESS §0-29 A3 [medium] 2）ので
     **同型なら再演ごと**と読めるが**推測**。`noteAllyPlay` に乗せれば自動的に「再演ごと」側になる。
     ※ただし**王冠(kings_court)を使うときはアクション権を厳密に数える必要がある**と日本語wiki が名指ししている
     （＝再演ごとに増えるかどうかで結果が変わる盤面が実在する）。
  5. **相続の屋敷(Inheritance)** も `noteAllyPlay` が `inheritedEstate` を見て「アクション」と扱っている
     （実測 L8186）＝そのまま正しく拾える。
  6. **⚠ 全プレイヤーに効く（予言は共通）が、非手番の使用者には加算しないこと**（§1 注11・§7 注9 と同型）。
     **`addActions(t, n)` は `state.turn` のアクション権を増やす**＝
     **相手のターンにリアクションでアクションを使った場合（黒猫/そり/牧羊犬/隊商の護衛/村有緑地）に
     手番プレイヤーのアクション権が増える実バグ**になる。
     → **発火は「使用者＝`state.turn.active`」のときに限る**。
     ⚠ 一次資料の明示は無いが、**姉妹カード（来寇・豊作）の日本語wiki はどちらも「非手番でも誘発するが
     基本的に意味はない」**と書いている（批評 [nice] H-3）＝**公式に最も近いのは「誘発はするが
     手番プレイヤーの資源を増やさない」**。本アプリでは差が観測できないので**加算しない**でよい。
     ＝**予言3枚（来寇／豊作／偉大な指導者）まとめて「非手番の使用者には資源が入らない」を
     許容簡略化として PROGRESS に1行で明記すること**（片方にだけ書くと必ずどちらかが落ちる）。
     ※唯一の観測差＝**来寇だけは非手番の +$1 が −$1トークンの除去に寄与しうる**が、
     本アプリの `applyCoinPenalty` も `state.players[t.active]` しか見ないので、どのみち再現できない。
  7. **CPU の終端保証**＝アクション権が実質無限になるので、
     「アクションを使い続ける」ループが手札の枯渇で必ず止まることを確認する（`chooseAction` が
     `null` を返せば `END_ACTION_PHASE` へ進む既存の形なら安全）。
  8. **Good Harvest の Secret history が名指ししている**（"let's not be forced to track Actions on
     Champion / **Great Leader** turns"）＝**アクション権の残数を数える設計にしてはいけない**という作者の意図。
  9. ⚠ 起草docは「Enlightenment と同居すると財宝もアクション＝合計 +2 になる」と書いていたが、
     **予言は1ゲーム1枚なので同居しない**（丸ごと削除済み）。

---

## 反映した訂正：6件（うち採用しなかった 0件）

| # | 深刻度 | 内容 | 私の一次資料での再確認 | 判定 |
|---|---|---|---|---|
| 1 | **[high]** | **Biding Time は「捨てる」の置き換えであって「引く」の置き換えではない＝相手のターン中も手札は5枚ある。リアクション機構・アタック機構は変更不要** | `Biding Time` の Official FAQ と導入文／`Clean-up phase` の Official rules・Other rules clarifications（"you still draw 5 cards"）・§Cards with additional Clean-up effects の3バケツ分類／`Coastal Haven` のカード文 `(you still draw 5)` を**自分で再取得して確認**（`m_v1.txt`） | **採用**（起草docの注5・注6を全面書き換え） |
| 2 | [medium] | **予言は1ゲーム1枚＝予言どうしは同居しない**。起草docの4箇所（Bureaucracy注3／Flourishing Trade注7／Good Harvest注4／Great Leader注5）は成立しない | `Prophecy` 導入文＋§Omens & Prophecies／`rulebook.txt` **L112-113** を実読して確認 | **採用**（2箇所は例の削除、2箇所は丸ごと削除） |
| 3 | [medium] | **沿岸の避難港(Coastal Haven)は「クリンナップ開始時」バケツではない**（"When discarding"）＝順序は規則で一意 | `Clean-up phase` の3バケツ見出しと所属カードを再取得して確認。**本アプリの実装位置（`t.coastalKeep` を `cleanupAndAdvance` の手札捨て直前 L10454 で適用）とも一致** | **採用＋補強**（下記「私が追加した確定事項2」） |
| 4 | [low] | ページ最終更新日は8枚中4枚が2026-07-29ではない | 生HTML 9本の `oldid` と "This page was last edited on" を機械抽出＝**検証docの表と完全一致** | **採用**（上の版の表に反映） |
| 5 | [low] | Approaching Army の `<hr>` の style 引用が別セルのもの（本数の結論は正しい） | `grep -o '<hr[^>]*>'` で4個を実測＝infobox は `width:50%;margin-left:25%`、残り3個が `height:2px;width:66%` | **採用**（表記のみ訂正・実装影響なし） |
| 6 | [low] | 横型2枚制限は**列挙**（Events, Traits, Landmarks, Projects, Ways）から予言が外れている＝根拠を差し替えられる | `rulebook.txt` **L54-56** と **L62-63** を実読して確認 | **採用**（ただし「数えない」の否定形明文は無いので**断定しないという結論は維持**） |

**採用しなかった訂正＝0件。** 検証docの6件はすべて一次資料で裏が取れた。

## 私が追加した確定事項（起草doc・検証doc の**どちらにも無かった**もの）

1. **【新規の公式裁定】`rulebook.txt` L167＝「Costs of Events are not affected by cards like Flourishing Trade.」**
   ＝**Flourishing Trade の -$1 はイベント（および横型全般）のコストには効かない**。
   起草docの Flourishing Trade 注には無く、検証docも取りこぼしていた。
   本アプリは既にイベントをコスト軽減の対象外にしている（PROGRESS §0-20）ので**現状で正しい**が、
   `cardCost` に軽減を1本足すときの回帰テスト対象として明記すべき。
2. **【本アプリ固有の事故点】Biding Time は `friendly_discard` / `patient_set` より「後」に置かないと
   友好的な(Friendly)・忍耐強い(Patient) が完全に死ぬ**。
   公式では同じ「クリンナップ開始時」バケツの4枚（Biding Time / Friendly / Patient / River Shrine）の
   解決順を手番プレイヤーが選べるが、本アプリの `endBuyTailSchemeOrCleanup`（L11509）は**固定順**。
   **Friendly と Patient は「手札から」札を取る**ので、Biding Time が先に手札を空にすると両方が空振りする。
   検証doc は Coastal Haven を外した際に「Improve との順序は要検討」までは書いたが、
   **手札を奪うことで他の2枚が死ぬという具体的な破壊**は指摘していない。
3. **【規模の実測】Enlightenment の `isActionFor` 置換は engine 156／cpu 95／ui 40 ＝計291箇所**
   （起草docは「資本主義の69箇所の前例あり」としか書いていなかった）。
   ＝**資本主義リファクタの4倍以上。単独で1バッチ取るべき**という判断材料になる。
4. **【Great Leader の実装位置】既存の champion は「効果解決の前」に +1アクションしている**ので、
   **同じ場所に書くと「最後の日の出トークンを取り除いた Omen 自身も +1アクション」という公式裁定が再現できない**。
   reduce 末尾の再開網に乗せ、**有効判定を消化側で行う**必要がある。

## 私が追加した確定事項（2026-08-16 の批評反映パスで新たに見つけたもの）

**批評（`c_proph_a.md`）も指摘していない、本アプリ固有の設計上の誤り2件＋公式解釈の訂正1件。**

5. **【前版の誤り・私が訂正】「`t.allyPlayed` に無条件で積む」は本アプリでは成立しない。**
   `noteAllyPlay` は `notePlunderPlay(state, pi, card)` を呼んだ**直後に `const a = state.ally; if (!a || !card) return;`**
   があり、**`t.allyPlayed` に積むのは `state.ally` が 魔女の輪／小売店主連盟／写本士の仲間たち のときだけ**。
   ＝予言（来寇／偉大な指導者／豊作の一部）をここに載せると、**同盟拡張が混ざっていない対局では1度も発火しない**。
   → 正しくは **`notePlunderPlay` と同じ位置（ally ガードの前）に相乗りし、専用キューを持つ**。
   完全な前例が2つある＝**`t.frigateQueue`（フリゲート船）／`t.inspiringQueue`（特性「鼓舞する」）**。
   （§E に実コード付きで書き直した。）

6. **【本アプリ固有の事故点】予言の +$ を reduce 末尾で出すと、港の村(Harbor Village)の精算より前に走って誤爆する。**
   実測した reduce 末尾の並び＝
   **`drainAllyPlayed`（L11641）→ フリゲート（L11743）→ 鼓舞する（L11804）→ `t.hvPending` 精算（L11815）**。
   港の村は **`applyEffect` の前後のコイン差**で「次に使ったアクションが +$ を出したか」を判定し、
   **選択待ちを挟んだ場合はこの `hvPending` 精算まで判定を持ち越す**。
   ＝**来寇の +$1 をこの並びの前で出すと、港の村が誤って +$1 を出す**（公式は明示的に否定＝
   「港の村のボーナス判定に影響することは無い」）。
   → **予言の消化は `hvPending` 精算より「後」に置くこと。** 回帰テスト＝港の村 → 執事（+$2 を選ぶ＝選択待ち）→ アタック。

7. **【批評の訂正】Flourishing Trade の得点計算は `cardCost` ではなく `scoringCost` に足す。**
   批評 [must] F-1 は「`allyScoreForCards` が静的コストを見ているので `cardCost` を通すよう直せ」と書いているが、
   **`cardCost` を通すのは公式違反**＝高原の羊飼いの Other rules clarifications 逐語
   `Most forms of cost reduction (e.g. Bridge) have no effect when scoring. However, Cheap cards still cost
   [$1] less when scoring …, and Flourishing Trade remains in effect.`
   ＝**得点計算で効くのは 安価な(Cheap) と 盛大な取引 だけ**で、橋／街道／王女／運河／石切場は効かない。
   `cardCost` はそれらも `t.costReduction` も拾ってしまう。（§6 注3 に書き直した。）

## 枚数の検算

- **担当＝8枚**（Approaching Army / Biding Time / Bureaucracy / Divine Wind / Enlightenment /
  Flourishing Trade / Good Harvest / Great Leader）
- **書いた＝8枚**（上記 1.〜8.）＝**8 / 8 で一致。過不足・重複・捏造なし。**
- **批評の反映で枚数は1枚も動いていない**（[must]/[nice] はすべて既存8枚の内容の訂正・追記であり、
  カードの追加・削除・統合は無い）＝**反映前 8枚 → 反映後 8枚**。
- 8枚それぞれの ⚠ 節の項目数（反映後）＝AA 14／BT 10（＋5b・5c）／BU 9／DW 14／EN 14（＋1b・4b・4c）／
  FT 10（＋5b）／GH 10（＋2b・3b）／GL 9 ＝**薄いカードは無い**。
- 英語wiki `Prophecy` の List of Prophecies 15種の**先頭8つ**と完全一致
  （残り7種＝Growth / Harsh Winter / Kind Emperor / Panic / Progress / Rapid Expansion / Sickness ＝**第7章 後半の担当**）。

### 機械検算した項目

| 検算 | 結果 |
|---|---|
| 英語カード文の逐語 | **8/8 一致**（英語wiki infobox／English versions 表／`rulebook.txt` の3系統。検証docの独立照合とも一致） |
| **日本語カード文（DO訳）** | **8/8 を `g0_jp_pairs.md` から収録**（日本語名＝来寇／好機到来／官僚制／神風／悟り／盛大な取引／豊作／偉大な指導者） |
| 日本語名の出所 | 英語wiki の Japanese 行があるのは**5枚のみ**（好機到来／官僚制／神風／悟り／豊作）＝残り3枚（来寇／盛大な取引／偉大な指導者）は**日本語wiki でしか取れない**。起草docが日本語名を書かなかった3枚を補完した |
| **ホビージャパン印刷版と文面が異なるカード** | **本群には1枚も無い**（前版の「Biding Time／Flourishing Trade の2枚」は**誤り**＝批評 [must] 4-1 で訂正）。日本語wiki の「余談」はそれぞれ**訳語の話**（好機到来＝Biding Time の誤訳）と**英語ルールブック Note の解釈の話**（盛大な取引）で、HJ 印刷版に一切触れていない。`※ホビージャパンから発売されている「ドミニオン：旭日」版のテキストについては余談を参照のこと` の注記が付いているのは**取得済み19ページ中 川船(Riverboat) の1枚だけ**（`jp/batch0.txt` L1727・L1959 で実測）。DO訳を採用する方針（略奪の決定3）は不変 |
| **Versions 表の Digital 欄** | **8/8 とも空**（＝デジタル版専用テキストは存在しない）＝DO訳を採っても英語原文とズレない傍証（批評 [nice] §2-1 で復活） |
| コスト | **8/8 とも Info に Cost 行が存在しない**（Info は Type / Set / Illustrator(s) の3行のみ）＝予言にコストは無い |
| 種別 | 8/8 とも `Prophecy` |
| `<hr>`（区切り線） | Approaching Army のみ**1本**（`grep -o '<hr[^>]*>'` で実測＝ページ全体4個＝infobox 1／English versions 1／French 1／German 1）／他7枚は**0本** |
| 版（English versions） | **8/8 ともデータ行1行**・`Changes=First edition`・`Announced+Printed(colspan=2)=August 2024`＝**機能エラッタ0件** |
| Official FAQ の収録 | AA 4項／BT 1項／BU 2項／DW 12項／EN 6項／FT 5項／GH 2項／GL 1項＝**33項すべて収録・取りこぼし0** |
| Other rules clarifications | DW 9項／EN 8項／FT 1項／GL 1項＝**19項すべて収録**。「節が無い」4枚（AA/BT/BU/GH）も目次で確認 |
| 英語id候補 × 既存761枚（CARDS 560＋LANDSCAPES 201） | `approaching_army` / `biding_time` / `bureaucracy` / `divine_wind` / `enlightenment` / `flourishing_trade` / `good_harvest` / `great_leader` ＝**衝突0件**。紛らわしい既存 id（`bureaucrat` / `great_hall` / `harvest` / `trade` / `trader`）は**全部実在**するので日本語名・全文検索での混同に注意 |

### ⚠ 未確定（推測で埋めていない。実装前に要確認）＝**9件のうち4件を日本語wiki で解決し、新たに1件を立てた＝残り6件**

1. **予言は「横型の合計2枚制限」に数えるか**＝**列挙から外れている**ことは確認したが、
   「数えない」という否定形の明文は無い（訂正6で根拠は強化済み。Ally と同型と判断して PROGRESS に明記する運用）。
2. ~~Bureaucracy とポーション費用~~ → **✅ 解決**（日本語wiki `官僚制` §詳細なルール逐語
   「コストがポーションだけのカード(ブドウ園など)や負債だけのカード(絵師など)は、コスト0でないカードなので注意」
   ＝**銅貨が付く**。3成分判定でそのまま正しい）。
3. ~~Bureaucracy とコスト軽減で $0 になったカード~~ → **✅ 解決**（日本語wiki `官僚制` §利用法逐語
   「コストが0になっていれば、元のコストが0でなくても、銅貨がついてくることが無い」＝**付かない**）。
4. **Approaching Army / Great Leader が再演（玉座など）で何回誘発するか**＝同盟の同型裁定からの類推のみ。
   （`noteAllyPlay` に乗せれば自動的に「再演ごと」側になる。日本語wiki は「王冠を使うときはアクション権を
   厳密に数える必要がある」と書いており、再演ごとに増える前提と読めるが**逐語の断定は無い**。）
5. ~~Approaching Army の Setup で抽選プールにアタックが残っていない場合~~ → **✅ 解決**（日本語wiki `来寇` 逐語
   「アタックである王国カードが全てサプライに並んでいる場合、【追加アタック】の山札は追加されない。
   これは指示にできる限りまで従うというドミニオンの基本法則に基づいている」＝**足さない**）。
6. **Divine Wind の「10 new random piles」の抽選元プール**＝逐語の定義は無いが、
   作者発言 `Now normally I only play with two expansions at a time; if say Horses might appear, well odds are
   they're already on the table.` が「その卓に出している拡張から引く」前提を示す＝**推定として PROGRESS に明記**。
7. **Divine Wind と徴税(Tax)の山上負債 `state.pileDebt`**（「Any other tokens」に含まれると読めるが明示なし）＝**[推定]**。
8. ~~Good Harvest で、予言が有効になる前にそのターン既に出した名前の財宝~~ → **✅ 解決**（日本語wiki `豊作` 逐語
   「『豊作発動後に初めて使用する名前の財宝カード』ではないので注意」＋語り部の例＝**出ない**）。
9. **予言3枚（来寇／豊作／偉大な指導者）を「非手番の使用者」でどう扱うか**＝
   公式は「誘発するが基本的に意味はない」（来寇・豊作の日本語wiki が明記／偉大な指導者は明示なし）。
   本アプリは資源が `state.turn` に入るので**加算しない**のが安全。
   唯一の観測差＝**来寇の +$1 が −$1トークンの除去に寄与する**点だが、`applyCoinPenalty` も
   `state.players[t.active]` しか見ないので再現不能＝**3枚まとめて許容簡略化として PROGRESS に明記する**。
10. **【新規】Flourishing Trade の「アクション権を購入権として使う」＝置換型か変換型か**（批評 [must] 4-2）。
    日本語wiki の余談は**置換型**（購入フェイズで購入権の代わりにアクション権を消費）と読み、
    「王冠のコイン量調節のために先行変換する動きはできない」と書いているが、
    **同ページのコメント欄で2人が訳に異議**を出しており決着していない。
    観測差＝①王冠のコイン量調節 ②ヴィラ／騎兵で購入フェイズを出入りしたときの残アクション権。
    **私の推奨＝置換型**（Note の逐語に最も近く、本アプリでは新 action も UI も不要）。

---

## 反映した [must]：14件／不採用：0件

| # | 批評の項 | 反映先 | 私の裏取り | 判定 |
|---|---|---|---|---|
| 1 | **4-1** HJ 印刷版の文面差は裏づけが無い（BT・FT の2枚） | §2・§6 の日本語カード文の注／検算表の該当行 | `jp/retry4.txt`（好機到来の余談＝**訳語の話**）／`jp/retry5.txt`（盛大な取引の余談＝**Note の解釈の話**）／`jp/batch0.txt` L1727・L1959（HJ 注記は**川船だけ**）を実読 | **全面採用**＝「本群に HJ 差は無い」に書き換え |
| 2 | **4-2** FT の「アクション権→購入権」は置換型という明示的な読みがある | §6 注5b（新設）＋未確定 #10（新設） | `jp/retry5.txt` の余談とコメント欄2件を実読＝**批評の引用は正確**（決着していないことも含めて） | **採用**＝断定をやめて2案を並べ、推奨だけ書いた |
| 3 | **4-3** 「`addCoins` を通す理由＝カメレオン」は逆 | §1 注10／§7 注7 | `js/engine.js` の `addCoins`（`t.chameleon` で無条件に +カードへ振替）と `applyWay` の `try/finally`（＝`applyEffect` の中だけ）を実読／日本語wiki `来寇`「カメレオン化アタックは +1ドローに変換しない」・`豊作`「カメレオンの習性の適用範囲外」 | **採用**＝「通すが**カメレオンの窓の外で**呼ぶ。位置で担保する」に書き換え |
| 4 | **5-A1** 追加アタックの連鎖セットアップが無い（`pickBane` を真似ると壊れる） | §1 注1（表つきで全面書き換え） | `createInitialState` の実順序を実測＝家宝 L1412 → `pickBane` L1506 → Ally L1516 → `initSupply` L1542 → 山上VP L1622 → 祝福/呪詛 L1651 → 特性 L1729 | **採用＋補正**＝本アプリでは `pickBane` の位置で祝福/呪詛/Ally/特性は間に合う（家宝だけ前だが該当アタック0枚）ことまで実測して書いた |
| 5 | **5-A2** 非手番のアタック使用で手番プレイヤーにコインが入る | §1 注11（新設）＋§7 注9・§8 注6 に同型を明記 | `addCoins` が `state.turn.coins` に足すこと／`noteAllyPlay` の32箇所に黒猫・番犬・隊商の護衛・牧羊犬・村有緑地・鷹匠・密航者が含まれることを実測 | **採用**＝3枚まとめて許容簡略化にする方針まで書いた |
| 6 | **5-A3** 資本主義／港の村との切り分けが無い | §1 注12（新設）＋§7 注10 | 港の村が `applyEffect` のコイン差で判定すること（`hvWatchers` → `settleHarborVillage` / `t.hvPending`）を実読 | **採用＋私の追加発見**＝reduce 末尾の並び（drain が `hvPending` 精算より前）まで実測して「予言の drain は精算の後」と書いた |
| 7 | **5-B1** 川の社(River Shrine) が実装警告から抜けている | §2 注5b（新設） | 日本語wiki `好機到来` コメント欄の実例を実読／`endBuyTailSchemeOrCleanup` の固定順（増築→策謀→friendly→patient→トリックスター）を実測 | **採用**＝「4枚まとめて固定順を決める」に書き換え |
| 8 | **5-D1** 新しい10山にトークンを置き直さない | §4 注1（やること／やらないこと の表を新設） | 日本語wiki `神風`「各種ランドマークや徴税などが新たに【追加山】に各種トークンを置くことはない」を実読 | **採用** |
| 9 | **5-E1** 「記載効果が丸ごと消える」は言い過ぎ | §5 注4（書き換え） | 日本語wiki `悟り`「場には出ること＆仕切り線の下に書いてある能力は発揮される」（護符/玉璽/元手/薬草商）を実読 | **採用** |
| 10 | **5-E2** 得点計算の配線先が `vineyard` しか書かれていない | §5 注2（表を新設） | `vpOf` L7799（ブドウ園）／`landmarkScoreForCards` L7864（果樹園）・L7869（凱旋門）を実測。日本語wiki も同じ3枚を名指し | **採用** |
| 11 | **5-E3** 「使用したことで誘発する効果」は生きる | §5 注4b（新設） | 日本語wiki `悟り` の長い列挙（堀/盾/来寇/魔女の輪/小売店主連盟/商人/サウナ/炉/教師トークン）を実読 | **採用**＝通し続ける機構を engine の関数名で列挙した |
| 12 | **5-F1** `allyScoreForCards` が静的コストを見ている | §6 注3（書き換え）＋「⚠ 出荷済みの実バグ候補」 | **実バグであることは確認**。ただし **`cardCost` を通す**という提案は公式違反（下記） | **結論は採用／修正方法は不採用**（`scoringCost` に書き換え） |
| 13 | **5-F2** 注8 の前提が未確定 | §6 注8（書き換え） | → #2 と同じ | **採用** |
| 14 | **5-G1** §E の一般則には例外がある（豊作は自身が恩恵を受けない） | §E（表を新設）＋§7 注3b（新設） | 日本語wiki `豊作`「『使用前誘発効果』が誘発するタイミングを過ぎているので、豊作の効果は誘発しない」を実読 | **採用**＝§E を「誘発点が前か後かで決まる」に書き直した |
| 15 | **5-G2** 豊作にも AA と同じ3点セット（カメレオン／非手番／港の村）が要る | §7 注7・注9・注10（新設） | 日本語wiki `豊作` の3項を実読 | **採用** |

※ 批評は「[must] 14件」と数えているが、表は 5-F2 を独立行にしたので15行ある（5-F2 は 4-2 への参照＝実質14件）。

### 批評が間違っていた点（採用しなかった／書き換えた）

- **[5-F1 の修正方法]** 「`allyScoreForCards` を `cardCost` に通せ」は**公式違反**。
  高原の羊飼いの Other rules clarifications 逐語＝
  `Most forms of cost reduction (e.g. Bridge) have no effect when scoring. However, **Cheap** cards still cost
  [$1] less when scoring …, and **Flourishing Trade** remains in effect.`
  ＝得点計算で効くのは **安価な(Cheap) と 盛大な取引 だけ**。`cardCost` は橋／街道／王女／運河／石切場／
  最終ターンの `t.costReduction` まで拾ってしまう。**正しくは `scoringCost(state, id)`**（下記）。
- 他は**すべて正しかった**。とくに **`isActionFor` の置換規模 291箇所（engine 156／cpu 95／ui 40）**、
  **`noteAllyPlay` は 28ではなく32箇所**、**`costExact` が `gainableBase` を含む**、
  **`PLAY_TREASURE` の `t.phase !== 'buy'` 拒否**、**`addActions` の `ignoreActionBonus`**、
  **`build-landscape.js` の `SKIN`/`WITH_COIN`/`KIND_LABEL`** は全部実コードで一致を確認した。
- **行番号のズレ**（批評 [nice] 4-5）も正しいが、**批評の値もすでにズレている**
  （例＝`endBuyTailSchemeOrCleanup` は批評 11522・実測 **11527**／`maskStateFor` は批評 21133・実測 **21138**）。
  **並行セッションが作業ツリーを編集中**で、この文書を書いている最中にも `allyScoreForCards` が
  8674 → 8691 へ動いた。→ **行番号は「参考」と断り、参照は関数名で行う**方針にした。

## 拾った [nice]：27件（＝批評が付けた [nice] ラベルの全件）

批評の集計表は「[nice] 24件」と数えているが、**ラベルを1つずつ数えると27ある**。全部反映した：

| 出所 | 件数 | 反映先 |
|---|---|---|
| §1 反映漏れ | 1 | クリンナップの**3バケツ分類**を復活（§2 注5）＝次に「クリンナップ開始時」の札を足すとき迷わない |
| §2 取りこぼし | 3 | Versions の **Digital 欄が空**（検算表）／**作者発言 Playing IRL の後半**（§4 引用＋注12）／**`landmarkScoreForCards` は FT では不要・EN では必須**（§5 注2 末尾） |
| §4 推測 | 2 | **`noteAllyPlay` は 28 ではなく 32箇所**（§E・§8 注4）／**行番号は「参考」・参照は関数名で**（冒頭・「批評が間違っていた点」） |
| §5-A | 4 | A-4 コスト無制限（`costIsPlainCoin` 禁止）／A-5 randomizer 判定の**実測表**（catapult・knights は候補／augurs・clashes・wizards・page・peasant は非候補）／A-6 候補ゼロなら足さない／A-7 タイミング例（狂戦士×闇市場×技術革新・山トークンとの違い・ハツカネズミ・女魔術師/追いはぎ） |
| §5-B | 2 | B-2 堀/黒猫は脇なので使えない（`hasReaction`/`immuneReveal`/`reactOptions` が `p.bidingAside` を走査しないこと）／B-3 フリゲート船は貫通・忍者は無効・航海との組み合わせ |
| §5-C | 2 | C-1 ポーション/負債だけのコストにも銅貨（未確定#2#3 を解決）／C-2 **馬**が最も忘れやすい＋賞品/略奪品は $0 で付かない |
| §5-D | 4 | D-2 調査の例外（直前に実際に枯れた山は誘発する）／D-3 陣地の孤児化でも `allCards` に残る／D-4 **交易路・封鎖はマット側なので無関係**（トークン4種類目）／D-5 抽選元プールの根拠 |
| §5-E | 3 | E-4 `isActionFor` は `isTreasureFor` の上に作る（山師の呪い）／E-5 副作用の一覧（略奪品/備蓄品/呪符の巻物が場に残る・持続財宝は持続しない・無謀なの捨て札時効果は残る・銅細工師/嫉妬・愚者の黄金）／E-6 `PLAY_TREASURE` は `t.phase !== 'buy'` で拒否＝`PLAY_ACTION` 経由にする |
| §5-F | 1 | F-3 **`SPEND_VILLAGER` をコピー元に併記しない**（村人はアクションフェイズ限定＝フェイズ判定が逆） |
| §5-G | 2 | G-3 遡及しない（未確定#8 を解決）／G-4 使用前誘発は順序を選べる＋**契約書/法貨/尽きぬ杯の持続ぶんでは誘発しない** |
| §5-H | 3 | H-1 購入/夜フェイズでも +1アクション／H-2 **雪深い村の期待値＝残り4**（そのまま回帰テスト）／H-3 非手番の扱いは3枚まとめて許容簡略化 |
| **計** | **27** | |

**本文に入れなかったもの**＝日本語wiki の運用論（神風の「テーブル面積」「ボードゲームカフェへの配慮」等）と
各カードの戦術論。**批評が [nice] としてラベルを付けたものは1件も落としていない。**

---

## ⚠ 出荷済みの実バグ候補

### 1. 【確定】安価な(Cheap) × 高原の羊飼い(Plateau Shepherds) が公式と食い違う → **並行セッションが修正済み（未コミット）**

- **ファイル**＝`js/engine.js` `allyScoreForCards`（2026-08-16 の作業ツリーで L8691）。
- **修正前のコード**（同日 21:20 頃までの HEAD 相当）：
  ```js
  const two = (cards || []).filter((c) => {
    const cd = C()[c];
    return cd && cd.cost === 2 && !cd.potion && !cd.debt;   // ← 静的カタログ値
  }).length;
  ```
- **公式**＝英語wiki `Cheap`（`node tools/wikidirect.js "Cheap"` で確認）
  `This lowers the cost of a pile for the entire game (**including when scoring**).`
  ＋ 高原の羊飼いの Other rules clarifications
  `However, **Cheap** cards still cost [$1] less when scoring, which may matter for Plateau Shepherds.`
- **再現条件**＝`mix-all` で **同盟（高原の羊飼いが Ally に選ばれる）× 略奪（特性「安価な」が $3 の山に付く）**が同居し、
  その $3 の山のカードを持って終局する。旧実装ではそのカードが「$2 ちょうど」に数えられず **+2VP/枚 を取り逃す**。
  PROGRESS §0-30 P4 は「安価な＝`cardCost` に -$1（全員・常時・**得点計算も**）」と書いており、
  **PROGRESS の記述と実装が食い違っていた**。
- **状態**＝**私がこの文書を書いている最中に、並行セッションが `scoringCost(state, id)` を新設して修正した**
  （`git status` で `js/engine.js` / `test/allies.test.js` / `test/plunder.test.js` が M・**未コミット**）。
  新実装は `cardCost` ではなく専用の `scoringCost` を使い、**橋/街道のような「場にある間」型の軽減を拾わない**
  ＝公式どおり。**盛大な取引(Flourishing Trade) はこの `scoringCost` に足すこと**（関数のコメントにも
  そう書いてある）。
- **⚠ 次にやること＝この修正がコミット／push されたかを確認する**（未コミットのまま別の作業で上書きされると消える）。

### 2. 【[推定]・現時点では到達不能】`runAllyPlayed` が「使用者」ではなく「手番プレイヤー」の資源を増やす

- **ファイル**＝`js/engine.js` `runAllyPlayed`（実測 L8202-）。小売店主連盟(League of Shopkeepers)の分岐が
  `const pi = e.player` を取りながら、**`addCoins(state, 1)` / `addActions(t, 1)` / `t.buys += 1` は
  すべて `state.turn`（＝手番プレイヤー）に効く**。
- **現時点では実害なし**＝連携(Liaison)9種（道化棒/ごますり/輸入者/契約書/使節/ギルドマスター/下役/
  商人の野営地/生徒）に**相手のターンに使えるものが1枚も無い**ので `e.player !== t.active` にならない。
  支配(Possession)でも `t.active` は被支配者なので一致する。＝**[推定]の地雷であって現行バグではない。**
- **⚠ 旭日で必ず踏む**＝予言（来寇／豊作／偉大な指導者）は**相手のターンの使用でも誘発する**ので、
  この同じ形をコピーすると**アタックされた側が使った黒猫で、アタックした側の資源が増える実バグ**になる。
  → 予言のキューを消化するときは **必ず `e.player === state.turn.active` を確認すること**（§1 注11・§7 注9・§8 注6）。


<!-- ===== m8_prophecies_b.md ===== -->

## 第8章 予言 後半7種

担当＝**Growth / Harsh Winter / Kind Emperor / Panic / Progress / Rapid Expansion / Sickness**
（Rising Sun の予言15種のうち、アルファベット順で後半の7種）

### 私が使った一次資料（この確定版で私自身が実行・照合したもの）
1. 収集doc `g8_prophecies_b.md` ／ 敵対検証doc `v_proph_b.md`
2. **英語wiki ライブ再取得（私自身が実行）**
   `RAW_DIR=C:/tmp/risingsun_research/raw_m_proph_b node tools/wikidirect.js "Good Harvest" "Crown"`
   ＋ 既存の生HTML `raw_v_proph_b/raw_*.html`（Growth / HarshWinter / KindEmperor / Panic / Progress /
   RapidExpansion / Sickness / Prophecy / **DivineWind** / **Hasty**）を**私自身がパースし直して**
   Prophecy text セル・FAQ 節・`<hr>` 本数を機械抽出した（下の各カードの逐語はこの再抽出の結果）。
3. **日本語wiki（wikiwiki.jp/dominiondeck）のキャッシュ済み全文** `jp/batch4.txt` / `jp/retry5.txt`
   ＝**7枚とも個別ページが取得できている**（成長／厳冬／神器／狼狽／進歩／急速拡大／病）。
   日本語カード文だけでなく **「詳細なルール」節**が非常に濃く、英語wiki に無い裁定を多数含む。
   → 本書では出典を **［英語wiki 公式FAQ］／［英語wiki その他の裁定］／［日本語wiki 詳細なルール］** と明示して分ける。
   ⚠ 日本語wiki の「詳細なルール」は**公式FAQ そのものではない**（コミュニティが公式裁定・ルールブックから
   導いた解説）。ただし本プロジェクトが既に採用してきた stop-moving／訪問モデルと完全に整合しており、
   英語wiki の記述とも矛盾しない。
4. 作業ツリー `js/cards.js` / `js/engine.js` / `js/ui.js` / `server/gameServer.js` / `test/invariants.test.js`
   （既存機構名・id 衝突の確認）。**この確定版で本アプリについて書いた主張は、私自身が `grep` / `Read` / node 実行で
   再現している**（末尾の「⚠ 出荷済みの実バグ候補」は実際に node で再現した）。
   ⚠ **本文からは行番号を全部外し、`grep` できる関数名・文字列だけで参照する**ようにした。
   理由＝作業ツリーは未コミット変更ありで行番号が常にずれる（レビューで**14箇所すべてが 1〜13 行ずれている**
   ことが実測された。主張の中身は全部正しかったが、行番号を信じて開くと違う場所に着く）。

---

## この群に共通する事実（カードごとに再掲しない）

### 種別・コスト
- **7枚とも Info の Type は `Prophecy` の1語のみ**（Attack も Duration も付かない）。
- **予言にコストは無い**（Info に Cost 行が存在しない＝買わない・獲得しない）。
- ⚠ **どれも「アタックカード」ではない**＝堀／灯台／チャンピオン／盾／守護者／馬商人 のどれでも防げない。
  **`ATTACKS` に登録してはいけない**（§0-29 の魔女の輪・すり師団、§0-30 の大渦巻(Maelstrom) と同型の罠）。
  とくに **Sickness** はこれを誤ると公式より大幅に弱くなる（日本語wiki が明示的に「灯台・チャンピオン・
  守護者を使用していても影響を受ける」と書いている＝下記 Sickness 節）。

### 「有効になる」の定義 ＝ 公式ルール **5項目**（英語wiki `Prophecy` → Official rules → Omens & Prophecies）
> Put 5 Sun tokens on the Prophecy for 2 players, 8 for 3 players, 10 for 4 players, 12 for 5 players, and 13 for 6 players.
>
> "+1 [Sun]" means, remove a token from the Prophecy. Then if it was the last token, the rules text on the
> Prophecy becomes active, right then and for the rest of the game.
>
> **"+1 [Sun]" always appears first on Omens, before anything else the card does.**
>
> "+1 [Sun]" does nothing else once all the tokens are removed.
>
> Prophecy text does nothing until the last Sun token is removed.

★の1行（3項目め）は**収集docが落としていた**（検証docの訂正3）。私も `v_pb_2.txt:1019` と
`g8b_fetch3.txt:92` の両方に実在することを確認した。
**これは解決順序の規則で、担当7種すべてに効く**＝**Sun の除去（＝予言の有効化）は、その前兆(Omen)カードの
残りの効果より必ず先に起きる**。したがって **Omen が獲得・使用する類なら、その獲得/使用には既に予言が効いている**
（Growth / Harsh Winter / Progress / Rapid Expansion の全部が影響を受ける）。
Kind Emperor の FAQ `this applies immediately, in the middle of resolving the Omen` もこの規則が前提。

- 予言は**「カード」ではない**（wiki 逐語）＝
  `Prophecies are not considered "cards" at all; any text referring to a "card" (such as instructions to
  "name a card") does not apply to Prophecies.`
  → **`DOM.CARDS` ではなく `DOM.LANDSCAPES`（横型・iris blue の枠）**。
  保存則 tally に数えない／`allCards` に入れない／庭園・品評会・壁 に数えない／
  建て直し・秘術師・医者・熟練工 の「カード名を宣言する」対象にしない。
- **1ゲームに使う予言は1枚だけ**（Omen が何枚あっても1枚）＝**予言どうしの相互作用は考えなくてよい**。
  （※ Divine Wind の「除去山」が絡むと非公式に2種同時状態が生まれ得る、と日本語wiki が注記しているが
    公式には起きない。）
- 有効化はゲーム中の1点なので、**有効化前に起きたことは遡って効かない**
  （Good Harvest の FAQ 逐語＝`If you played a Treasure in the same turn before removing the last Sun token
  from Good Harvest, it doesn't retroactively give you +1 Buy and +$1.` を私自身が再取得して確認）。
  ⚠ **ただし Panic は例外的に見える**＝有効化前に使った財宝でも「場から捨てる」のは有効化後なので戻る（後述）。

### ⚠ 有効化の瞬間に何かが起きる予言は **2枚ある**（収集docの「Kind Emperor が唯一」は誤り＝検証docの訂正2）
- **Kind Emperor**＝`At the start of your turn, and when you remove the last [Sun]: Gain an Action to your hand.`
- **Divine Wind（神風・群A担当）**＝`When you remove the last [Sun], remove all Kingdom card piles from the
  Supply, and set up 10 new random piles.`（生HTML `raw_DivineWind.html` から私が再抽出して確認）

→ **設計上の結論＝「最後の Sun トークンを取り除いた瞬間」に走る汎用フックを1つ作る**こと。
Kind Emperor 専用の一回きりフックを書くと Divine Wind で作り直しになる。

### 区切り線（`<hr>`）
**7枚とも 0本**。生HTMLの `Prophecy text` セルを私自身がパースして `<hr` を数えた（全枚 0）。
Prophecy text は infobox の1セル（`<td colspan="2">`）に1文が入っているだけ。

### 版（English versions）＝**7枚とも機能エラッタ無し**
English versions 表は7枚すべて **1行のみ**／`Changes = First edition`／`Announced/Printed = August 2024`。
`Not printed yet` の行は1つも無い。
＝**版の選択の論点は存在しない**（略奪の Journey のような「未印刷エラッタ」問題は無い）。

### 日本語名・日本語カード文（**Dominion Online 訳**）
**日本語wiki の各カードページのヘッダ表**（`(※日本語訳はDominion Onlineより)` と明記）から取得。
7枚とも個別ページが実在し、英語原文と日本語訳が並記されている。

| 英語 | 日本語名 | 出典の一致 |
|---|---|---|
| Growth | **成長** | 英語wiki Japanese 行・日本語wiki とも一致 |
| Harsh Winter | **厳冬** | 同上 |
| Kind Emperor | **神器** | **同上（2ソース一致）** ⇒ 下記参照 |
| Panic | **狼狽** | 同上 |
| Progress | **進歩** | 同上 |
| Rapid Expansion | **急速拡大** | 同上 |
| Sickness | **病** | 同上 |

- **Kind Emperor＝「神器」は正しい**（収集docが「意味が合わないので要確認」と保留した件）。
  **英語wiki の Japanese 行と日本語wiki の個別ページの2ソースが一致**しており、
  日本語wiki の予言ナビゲーション（来寇／好機到来／官僚制／神風／悟り／盛大な取引／豊作／偉大な指導者／
  成長／厳冬／**神器**／狼狽／進歩／急速拡大／病）にも「神器」で載っている。
  ＝**逐語訳ではなく日本の三種の神器に寄せたテーマ訳**と解するのが自然。**採用する。**
- **ホビージャパン印刷版との差異**：
  **私の7枚は、日本語wiki のどのページにも「余談」節（＝HJ版のテキスト差異の記載）が無い**
  （7ページとも `余談` 文字列 0件・`ホビージャパン` 0件を機械検算）。
  旭日で HJ 版差異が明記されているのは私が確認した範囲では **川船(Riverboat)** のみ。
  ⚠ **依頼文は「進歩」も差異ありとして挙げているが、日本語wiki の 進歩 ページには該当記載が無かった**
  ＝**⚠未確定**（存在するとしても本書では確認できていない）。方針どおり **DO訳で統一**するので実害は無い。

### id の衝突（機械検算・検証docも同数で再現）
`DOM.CARDS` 560 ＋ `DOM.LANDSCAPES` 201 ＝ **761 id** と突き合わせ、
`growth` / `harsh_winter` / `kind_emperor` / `panic` / `progress` / `rapid_expansion` / `sickness`
の7つとも **衝突0**。部分一致（growth|winter|emperor|panic|progress|expansion|sick）も **0件**。
※ ただし `growth` / `progress` / `panic` / `sickness` は英語として汎用的な語＝
engine の内部フラグ名（`t.progress` 等）とぶつからないよう命名に注意。

### 横型の新 kind
既存の `kind` は `ally / artifact / boon / event / hex / landmark / project / state / trait / way`（機械検算）。
**`prophecy` は新設**＝`tools/build-landscape.js` に **iris blue（青紫）・コスト欄なし**のスキンを足す
（直近の前例＝略奪の `trait`＝深い臙脂・コスト欄なし）。
**スキンに焼くラベル文字列＝「予言 / Prophecy」**（同盟＝「同盟 / Ally」、略奪＝「特性 / Trait」に対応）。
種別 `Prophecy` の日本語は**「予言」**＝英語wiki の Trivia に `Japanese: 予言` とある（第1章 §1 でも確定済み）。
**Sun トークンの残数を横型カードの上に表示する**必要がある（＝盤面表示も要る）。

- **予言は横型の「合計2枚まで」制限に数えない**＝**同盟の Ally カードとまったく同じ扱い**（**第1章 §1-7 で確定済み**）。
  イベント／ランドマーク／プロジェクト／習性／特性 とは別グループ。
- **`state.prophecy`（1枚・公開・対局中不変）＋ `state.sunTokens`（残数）＝`state.ally` と同型**、
  **`+1 Sun` の共通入口で 0 になったらその場で有効化**（＝Kind Emperor / Divine Wind をそこで発火）
  ＝いずれも**第1章 §1 が正本**。本章では繰り返さない。

---

## 1. Growth ／ 成長  （コスト無し・予言(Prophecy)）

- **Illustrator**：Matthias Catrein
- **英語id候補**：`growth`

- **英語カード文（逐語）**：
```
When you gain a Treasure, gain a cheaper card.
```
- **日本語カード文（DO訳）**：
```
財宝カード1枚を獲得したとき、それより安いカード1枚を獲得する。
```
- **区切り線**：**0本**（生HTMLの Prophecy text セルで `<hr` を機械計数）
- **版**：English versions **1行のみ**／`First edition`／`August 2024`＝**機能エラッタ無し**

### 公式FAQ・裁定

［英語wiki 公式FAQ（全文）］
> This can chain; you could gain a Rice, gain a Gold due to Growth happening for Rice, gain a Silver due
> to Growth happening for Gold, then gain an Estate due to Growth happening for Silver.
>
> This is not optional; if you gain a Treasure, you have to gain a cheaper card if you can.

［英語wiki その他の裁定］**節そのものが存在しない**（TOC は `1.1 Official FAQ` のみ＝私も再確認）。

［英語wiki 記事冒頭の定義文］
> Once it is activated, **whenever anyone gains a Treasure** they also gain an additional card cheaper than the Treasure.

＝**「on your turn」の限定が無い＝相手のターンに自分が財宝を獲得しても誘発する**。
（対になる Harsh Winter は明示的に "on your turn" と書いてある＝**この2枚は誘発条件が違う。共通化してはいけない**。）

［日本語wiki 詳細なルール（全文・要点）］
> 成長の効果は強制である。
>
> 成長の効果は**自ターン以外でも誘発する**。詐欺師で3コストカードを銀貨に変えられ、銅貨までついてくる、
> という事態もありうる。
>
> 財宝カードAのコストに**ポーションや負債**が含まれている場合、成長の効果で獲得できる
> 「財宝カードAよりコストが安いカード」の範囲に注意。
> - **賢者の石(3+P)** を獲得した場合、コスト3+P より安いカード1枚を獲得する。
>   例えば、コスト3コインの**銀貨**でもよいし、コストP の**変成**でもよい。
> - **大金(8+負債8)** を獲得した場合、コスト8+負債8 より安いカード1枚を獲得する。
>   例えば、コスト8コインの**王子**でもよいし、コスト負債8 の**絵師**などでもよい。
>
> 獲得カードのコストは、**成長の効果が誘発した際に参照する**。カード獲得時と、コストが変動している場合の
> 処理に注意。例えば、**資本主義**影響下＆捨て札置き場が空の状態で2金支払って【財宝化**漁師**】を購入、
> 獲得すると、【財宝化漁師】が捨て札に置かれるので、【財宝化漁師】のコストは5となる。
> その後、成長の効果が誘発するので、**4コスト以下**のカードを獲得する。

［Trivia：Preview（Donald X.）］
> Growth means you buy Platinum and it comes with King's Cache which comes with Gold which comes with...

＝**作者が示す具体的な連鎖列**（プラチナ$9 → 王の隠し財産$7 → 金貨$6 → …）。
**そのまま回帰テストのシナリオに使える**うえ、下の ⚠2（既存の `_gainDepth > 6` 上限）を踏むかどうかの
判定にも直接効く（プラチナから始めると何段で止まるかを数えられる）。

［Trivia：Secret history（Donald X.）］
> Tried triggering on all gains but requiring you to not have a copy of the card in hand; ... So: it
> only triggers on gained **Treasures**. You can still chain if you somehow have a bunch of those,
> and **there are a couple loops**, but normally it's more like, your [$5] comes with a Gold.

### ⚠ 実装で危ないところ

1. **「cheaper」＝component-wise strictly less の3成分比較**＝本アプリの **`costUnder(state, id, coin, spec)`** を使う。
   ⚠⚠ **`costUnder` の既定 spec は `{pot:0, debt:0}` なので、獲得した財宝の実際の pot/debt を必ず渡すこと**
   （`costUnder(state, id, ref.coin, { pot: ref.pot, debt: ref.debt })`）。
   渡さないと日本語wiki の公式例（賢者の石 3+P → 変成 P が取れる／大金 8+負債8 → 絵師 負債8 が取れる）が
   再現できない。**`costUpTo` を使うのは論外**（$0 の銅貨獲得で銅貨がもう1枚出る）。
2. **参照するコストは「成長が誘発した時点」＝獲得の後**（日本語wiki の資本主義×漁師の例）。
   `triggerOnGain` は `costAtGain` を受け取れるが、**成長では `costAtGain` を使わず、その場で
   `costOf(state, cardId)` を取り直す**こと。
   ※ §0-30 P6 の現場監督は逆（「これより後に」＝獲得**前**のコストで判定するのが正）＝**混同しない**。
3. **強制（not optional）だが `if you can`＝候補ゼロなら何も起きない**。
   銅貨($0)・呪い($0) を獲得したときは「$0未満」が存在しないので**窓を開かない**。
   **候補ゼロで pending を開くと人間が詰み CPU が livelock**（§0-29 A5 の蛮族×リッチ、§0-30 の拡大 と同型）。
4. **どのカードを獲得するかは選択＝新 pending が要る＝4点セット必須**
   （engine reducer＋`PLAYER_ACTIONS`＋CPU `decidePending`＋UI `viewPendingModal`）。
   **強制なので「やめる」ボタンは出さない**が、**候補ゼロなら窓自体を開かない**終端保証を入れる。
5. **入れ子の獲得＝`state.onGainQueue` に積む**（`triggerOnGain` の中で直接 `gain()` を呼んで
   `state.pending` に直代入しない）。望楼／そり／取り替え子／密航者 の窓を握りつぶす
   （§0-26 の 要求(Demand) で実際に踏んだ）。
   ⚠⚠ **`onGainQueue` にすべき理由はもう1つあり、そちらの方が致命的**＝下の ⚠5b（`_gainDepth > 6`）。
5b. **⚠⚠ 既存のフェイルセーフ `_gainDepth > 6` に当たると、成長の連鎖が公式より早く打ち切られる**。
   `triggerOnGain` の冒頭に**私が実コードで確認した**次のガードがある（`grep -n "_gainDepth" js/engine.js`）：
   ```js
   function triggerOnGain(state, pIndex, cardId, dest, costAtGain) {
     state._gainDepth = (state._gainDepth || 0) + 1;
     if (state._gainDepth > 6) { state._gainDepth--; return; } // 連鎖の暴走防止
   ```
   ＝**7段目以降の獲得では `triggerOnGain` が丸ごと空振りする**（＝成長も厳冬も進歩も急速拡大も発火しない）。
   - **これは公式ルールではなく本アプリのフェイルセーフ**。**外してはいけない**（外すと本当に暴走し得る）。
   - **成長を「`triggerOnGain` の中で直接 `gain()` を呼ぶ」形で書くと、連鎖1段ごとに深さが+1される**＝
     作者の Preview の例（プラチナ→王の隠し財産→金貨→…）が **6段で静かに切れる**。
   - **`state.onGainQueue` に積めば、キュー消化は `_gainDepth` が 0 に戻ってから再入する**ので上限に当たらない。
     ＝**⚠5 と ⚠5b は同じ結論（onGainQueue 必須）だが、理由が2つある**。
   - それでも **`_gainDepth > 6` に当たる王国が作れないかソークで確認する**こと
     （成長は `triggerOnGain` の**中**から発火する側でもあるので、他の獲得時効果と組むと深さは積む）。
6. **「Treasure か」の判定は動的**＝**`isTreasureFor(state, id)` を通す**（資本主義で財宝になったアクションを
   獲得しても誘発する＝日本語wiki の漁師の例がまさにそれ）。静的 `DOM.isType(id,'treasure')` は不可。
7. **非サプライの財宝（戦利品 Loot／略奪品 Spoils／賞品／褒賞）を獲得しても誘発する**（財宝だから）。
   一方**獲得する側**は `costUnder` が内部で `gainableBase` を通すので非サプライは候補に出ない（＝正しい）。
   ✅ **戦利品は追加配線が不要**＝唯一の入口 `gainLoot` の末尾が既に `triggerOnGain(state, pIndex, id, dest || 'discard')`
   を呼んでいる（**私が実コードで確認**）。支配中は `triggerOnGain(state, t.possessedBy, ...)` に振り替える分岐も既にある。
8. **相手のターンでも誘発する**＝`triggerOnGain` の `active` 限定ゲートを通してはいけない。
   相手のターンに自分の pending を立てるので、**手番でないプレイヤーの pending をUIが描けるか**を確認する
   （既存の射手／仮面舞踏会と同型＝`pending.player` が非 active）。
9. **連鎖の終端について（⚠ 収集docの記述を私が補正）**：
   **成長単独では必ず終端する**。誘発するのは財宝を獲得したときだけで、獲得するのは**厳密に安い**カード＝
   コストが単調減少するため（公式FAQ の連鎖例 Rice$7→Gold$6→Silver$3→Estate$2 自体が単調減少）。
   作者が言う "a couple loops" は**他カードとの組み合わせ**で生じる。
   ⚠ **私の推論（一次資料の裁定ではない）**＝**交易商人(Trader)** との組み合わせが危ない：
   銀貨獲得→成長で銅貨獲得→**交易商人が銅貨の獲得を銀貨に置換**→成長で銅貨…と、**銀貨の山が尽きるまで続く**。
   （日本語wiki の **官僚制(Bureaucracy)** ページのコメントが**まったく同型のループ**を指摘している＝
   `旧版の交易人のリアクションを発動すると、銀貨獲得からの銅貨獲得、獲得した銅貨への交易人リアクションして
   銀貨獲得のループが銀貨枯れるまで止まらなくなるのか` 2025-09-11。**官僚制の話であって成長の話ではない**が、
   成長でも同じ構図が成立する。）交易商人のリアクションは任意なので強制無限ループにはならないが、
   **CPU が延々と選び続けると fuzz が 20000step 未終局で赤くなる**。ソークで要確認。
10. **CPU** は「安いカードを1枚もらえる」ので `GAIN_ORDER` の順で取れば足りるが、
    **呪いや廃墟を取らない**こと（`bestGain(noVictory)` 系のフォールバックを兄弟と揃える＝
    §0-5 の値切り屋 [medium] と同型の書き漏れに注意）。
11. **⚠⚠ 許容簡略化として先に記録しておく＝成長がもらったカードには、既存の獲得時「対話」がほぼ全部開かない**。
    `triggerOnGain` の中の **else-if 連鎖組は全部 `state._gainDepth === 1 && !state.pending` を要求している**
    （私が実コードで確認＝大釜／**ヴィラ・遊牧民の野営地・物見やぐら・ティアラ・貨物船・技術革新・交易商人・
    国境の村 の連鎖の入口**／狂戦士／幽霊城（峠）／海賊／納屋／複製／御守り の8箇所すべて）。
    **成長の獲得は定義上つねに「入れ子の獲得」**（深さ2以上、または pending 保持中）なので、
    **成長でもらったカードには 望楼／交易商人／国境の村／ヴィラ／納屋／複製／御守り／海賊 の窓が1つも開かない**。
    - これは PROGRESS §6 に既にある**「1回の獲得につき else-if 連鎖組の対話は1つだけ」という横断簡略化**の
      **最も見えやすい経路**になる（§0-26 が同盟／商売／暴走／植民で同じことを書いている）。
    - 一方 **`onGainQueue` 組（そり／牧羊犬／鷹匠／移動遊園地／勲章／追放の払い戻し／アザラシ／密航者／
      せっかちな／配達）は普通に開く**（キュー消化は深さ0・pending なしで再入するため）。
    - **⚠ 実装後に「望楼が反応しない＝バグだ」と誤診して else-if 連鎖を触る横断改修に走らないこと**
      （PROGRESS が「根治するには横断リファクタが要る」と明記している領域）。**PROGRESS に許容簡略化として書く。**

---

## 2. Harsh Winter ／ 厳冬  （コスト無し・予言(Prophecy)）

- **Illustrator**：Julien Delval
- **英語id候補**：`harsh_winter`

- **英語カード文（逐語）**：
```
When you gain a card on your turn, if there's [D] on its pile, take it; otherwise put [2D] on its pile.
```
※ `[D]`＝負債トークン1個のアイコン（`<img alt="D">`＝Debt.png）、`[2D]`＝負債2のアイコン（Debt2.png）。
- **日本語カード文（DO訳）**：
```
あなたのターンにカード1枚を獲得したとき、その山に〈負債〉がある場合、それを得る。
それ以外の場合、その山に〈負債2〉を置く。
```
- **区切り線**：**0本**
- **版**：English versions **1行のみ**／`First edition`／`August 2024`＝**機能エラッタ無し**
  （※ Harsh Winter ページ内の `errata` 2件は Secret history 本文中の語＝**徴税(Tax)のエラッタ検討の話**であって
   刷りの行ではない。検証docが機械確認済み・私も再確認した。）

### 公式FAQ・裁定

［英語wiki 公式FAQ（全文）］
> This applies to both Supply piles and non-Supply piles.
>
> Cards gained from the trash affect the pile the card is from, if any.
>
> Coppers and Estates are "from" their piles, even if they're cards the players started with in their decks.
>
> When it's not your turn, gaining a card neither puts [D] on the pile nor removes [D] from the pile.

［英語wiki その他の裁定（全文）］
> Gaining a card with no pile (e.g. using Treasurer to gain an Heirloom) won't add [D] anywhere.
>
> Reward and Loot are piles and can have [D]; the Black Market deck is not a pile.
>
> You may put the Traveller upgrades into one pile or separate piles. What you choose determines how
> Harsh Winter adds [D] to them, though it is rare to gain one of them.
>
> In games that also have Tax, when you gain a card in your Buy phase, you can resolve Harsh Winter and
> Tax **in either order**. Usually you want to resolve Tax first:
> - If the pile has [D], your choices are: take the [D] with Tax and add [2D] with Harsh Winter; or
>   take the [D] with Harsh Winter and take [0D] with Tax.
> - If the pile has no [D], your choices are: take [0D] with Tax and then add [2D] with Harsh Winter;
>   or add [2D] with Harsh Winter and then take the [2D] with Tax.
>
> **On a Possession turn, no player gains cards on their own turn, so Harsh Winter does not apply.**

［日本語wiki 詳細なルール（要点・逐語）］
> 厳冬の効果は、**あなたのターン中にのみ**適用される。あなたのターン中であれば、**購入による獲得以外にも**
> 適用されるので注意。
>
> 厳冬の効果は、**サプライ外の山にも適用される**ことに注意。**廃棄置き場からカードを獲得した際も**、
> 効果が適用されることに注意。
>
> **以下のカードは由来する山札を持たないので、厳冬の処理は失敗する。**
> 各種**避難所**、**家宝**／**ゾンビの弟子**などのゾンビカード／**闇市場デッキ**のカード
>
> **馬**などサプライに置かないカードも由来する山札があることに注意。
> 褒賞/Reward は「褒賞/Reward の山」がある。また、**戦利品**は「戦利品の山」がある。
>
> 厳冬の効果で負債を受け取る処理は、**他のカードの獲得時効果と同時に誘発し、その処理順はカード獲得者が
> 自由に選択できる**。よって、例えば①(ターンプレイヤーが)サプライの山に2負債乗っている闇市場を獲得する→
> ②**技術革新**の効果を先に処理し、闇市場を使用して、闇市場デッキのカードを購入する→③厳冬の効果を処理し、
> 2負債を受け取る、という動きができる。
>
> **空になったサプライの山札の上にも**(廃棄置き場からの獲得などにより由来する山のカードの獲得が発生すれば)
> **負債は置かれる**。
>
> （＋徴税との解決順 4パターン A-1/A-2/B-1/B-2＝英語wiki の FAQ と同内容）

［Trivia：Secret history（Donald X.）］
> It was problematic in multiples or Throned, piles could get giant amounts of debt.
> **As a Prophecy, it's never duplicated; a pile has [2D] or no [D].**
> At first I thought the wording would try to line up perfectly with Tax ... This didn't quite work out,
> and well if you have it in a game with Tax, you will want to pay attention to what order you resolve them.

### ⚠ 実装で危ないところ

1. **既存の `state.pileDebt`（帝国の徴税 Tax・§0-20）をそのまま再利用できる**
   （`{[pileId]: 個数}`・**非カード・公開**・`maskStateFor` は clone で素通し＝保存則 tally に数えない）。
   ただし徴税は **`createInitialState` でサプライ山にだけ**負債を撒く実装
   （`grep -n "pileDebt\[id\] = 1" js/engine.js`＝
   `Object.keys(supply).forEach((id) => { if (!NON_SUPPLY.has(id) && !SPLIT_TOP[id]) pileDebt[id] = 1; })`）なので、
   **非サプライ山（戦利品/馬/賞品/褒賞）にも乗せられるよう拡張が要る**（FAQ 逐語＝
   `Reward and Loot are piles and can have [D]`）。
   ⚠ **戦利品の山は `state.loot`（supply キーを持たない）**なので、`pileDebt['loot']` のような
   **専用の山キーを決める**必要がある（`pileKeyOf` の写像も足す）。
   ✅ **`state.pileDebt` は徴税が無いゲームでも `{}` として必ず存在する**（`const pileDebt = {}` を無条件に作り、
   `if (events.indexOf('tax') >= 0)` のときだけ撒く）＝**厳冬だけのゲームでもそのまま使える**（私が実コードで確認）。
2. **⚠⚠ 山キーは READ / WRITE の両方で必ず `pileKeyOf(state, cardId)` を通す**（分割山下段→上段／
   混合山→集約キー）。**§0-20 の徴税で実際に踏んだ罠＝片方だけ通すと分割山で負債が永久に孤児化する**。
   既存の READ は `triggerOnGain` 内の徴税ブロック（`grep -n "は徴税：" js/engine.js`）、
   WRITE は `case 'TAX_PILE'` の reducer。**どちらも `const pk = pileKeyOf(state, cardId)` / `pileKeyOf(state, raw)` を通している。**
3. **「自分のターンの獲得」だけ**（"on your turn"）＝相手のターンの獲得は**置きも取りもしない**。
   Growth（"on your turn" 無し）と**誘発条件が違うので共通ヘルパにまとめてはいけない**。
   ⚠ ただし**購入に限らない**（工房・国境の村の獲得時効果・廃棄置き場からの獲得 も対象）＝
   既存の徴税は `gainWasBuyPhase`（購入フェイズ限定）を見ているが、**厳冬は購入フェイズ限定ではない**。
   **同じ `if` に混ぜないこと。**
4. **支配(Possession)のターンでは一切発動しない**（FAQ 逐語）。
   既存の徴税は逆に `state.turn.possessedBy` を見て支配者に負債を渡す実装になっている
   （`(pIndex === state.turn.active || (state.turn.possessedBy != null && pIndex === state.turn.possessedBy))`）＝
   **厳冬は `possessedBy != null` なら丸ごとスキップ**。**ここを徴税からコピーすると必ず間違える。**
5. **山が無いカードには何も置かない**＝避難所／家宝／ゾンビ／闇市場デッキのカード。
   本アプリには既に **`canReturnToPile(state, cardId)`** という「そのカードに戻せる山があるか」の述語があり、
   **判定条件がほぼ同じ**（戦利品なら `Array.isArray(state.loot)`／混合山なら `Array.isArray(state[pile])`／
   それ以外は `Object.prototype.hasOwnProperty.call(state.supply, cardId)`）。
   ⚠ ただし `canReturnToPile` は **在庫の有無を見ない**（`hasOwnProperty` だけ）＝
   **空の山にも負債を置く**（日本語wiki 逐語）という厳冬の要件と**むしろ一致する**。流用を検討する価値がある。
   ⚠ **`TAX_PILE` の方は逆に `(state.supply[raw] || 0) <= 0` で空の山を弾いている**＝
   **厳冬をここからコピーすると「空の山には置かない」になって公式と食い違う**。
6. **廃棄置き場からの獲得も対象**（物色 Scrounge／墓暴き／リッチ／祭壇 など）＝
   **獲得元がサプライでなくても、そのカードidの由来する山を引き当てる**。
7. **銅貨・屋敷は「その山のカード」**＝開始デッキ由来でも山に乗る（＝id で引くので自然にそうなる）。
8. **"take it"＝山にある負債を「全部」取る**。厳冬単独なら常に 2 だが、**徴税と同居すると別の量になり得る**
   ので、**必ず「山の負債を全部取る」実装にする**（既存の徴税 READ と同じ形＝`state.pileDebt[pk] = 0`）。
9. **徴税と同時に誘発したら解決順を選べる（公式）**＝
   **本アプリは「同時に誘発した効果の解決順を選べない」既存の横断簡略化がある**（§0-29 A3）
   ＝**許容簡略化として記録する**。ただし**順序で実際に負債額が変わる**（FAQ が4通り挙げている）ので、
   自動で選ぶなら**プレイヤーに得な方（通常は徴税が先）**に倒すこと。mix-all 限定の到達。
10. **技術革新との解決順**（日本語wiki の例）も同じ簡略化に落ちる＝記録する。
11. **負債を負う側は `p.debt`**（帝国の既存機構）＝**負債>0 の間はカードもイベントも購入できない**が、
    **獲得はできる**。厳冬は「毎回2負債」なので、**購入のたびに負債が積む＝ゲームが極端に長くなる**。
    fuzz の未終局（20000step）に注意。CPU の `REPAY_DEBT` 分岐が効くことを確認すること。
12. **オンライン**＝`state.pileDebt` は公開。**山の負債バッジ `.pile-debt`（🟠）は §0-20 で既に実装済み**
    なので表示はそのまま使える（**非サプライ山の表示だけ足りない**＝§0-28 の非サプライ5山と同じ扱いにする）。

---

## 3. Kind Emperor ／ 神器  （コスト無し・予言(Prophecy)）

- **Illustrator**：Sai Beppu
- **英語id候補**：`kind_emperor`

- **英語カード文（逐語）**：
```
At the start of your turn, and when you remove the last [Sun]: Gain an Action to your hand.
```
※ `[Sun]`＝日の出トークンのアイコン（`<img alt="Sun">`＝Sun.png）。
- **日本語カード文（DO訳）**：
```
あなたのターンの開始時とあなたが最後のSunトークンを取り除いたとき、アクションカード1枚を手札に獲得する。
```
※ 日本語名「神器」は**英語wiki の Japanese 行と日本語wiki の2ソースが一致**＝採用（上の共通節を参照）。
- **区切り線**：**0本**
- **版**：English versions **1行のみ**／`First edition`／`August 2024`＝**機能エラッタ無し**

### 公式FAQ・裁定

［英語wiki 公式FAQ（全文）］
> You gain **any Action** to your hand, **regardless of cost**. This is not optional.
>
> When the last [Sun] is removed, this applies **immediately, in the middle of resolving the Omen**, and
> **only the player who removed the [Sun]** gains an Action then.

［英語wiki その他の裁定（全文）］
> If you remove the last [Sun] at the start of your turn (e.g. you play a Poet with Delay), you'll gain
> **2 Actions** to your hand.

［日本語wiki 詳細なルール（全文）］
> **川船**の効果などでターンの開始時中に神器が効果を発揮すると、(「最後のSunトークンを取り除いたとき、
> アクションを手札に獲得」の効果のほかに)「ターンの開始時に、アクションを手札に獲得」の効果が誘発される。
>
> 神器の効果で獲得されるアクションカードは**捨て札置き場を経由せず、直接手札に獲得される**。

［Trivia：Preview（Donald X.）］
> Kind Emperor simply hands over an Action at the start of each turn, and when you first trigger it.
> Take an expensive one, or the one that your hand needs.

［英語wiki 記事冒頭の定義文］
> Once it is activated, for the rest of the game, you gain a free Action of your choice directly into your
> hand at the beginning of **each** turn.

### ⚠ 実装で危ないところ

1. **⚠⚠ コスト制限が一切無い**（`regardless of cost`）＝**`costUpTo` を掛けてはいけない**。
   §0-28 の悪魔祓いの精霊・§0-29 のリッチ(`lichTrashTargets`)・§0-30 の侵略(Invasion) と**4回目の同型の罠**。
   ✅ **述語を自作する必要は無い＝本アプリに完全に同じものが既にある**（私が実コードで確認）：
   ```js
   /* 木工ギルド＝廃棄したら「アクションカード1枚を獲得」＝**コストの上限が無い**（負債コスト[D]でも
      ポーション費用[P]でもよい＝公式FAQ逐語）。`costUpTo`/`costIsPlainCoin` を掛けてはいけない。
      昇進(Advance・帝国イベント)には $6以下の上限があるので「同型」と書き写すと静かに壊れる。 */
   function woodworkersCanGain(state) {
     return (id) => gainableBase(state, id) && isTypeSupply(state, id, 'action');
   }
   ```
   - **`DOM.engine` に公開済み**で、**`js/ui.js` のフィルタも同じ述語を見ている**
     （`DOM.engine.woodworkersCanGain(state)(id)`）。
   - **同盟の木工ギルド（`ALLY_WOODWORKERS`）は 4点セットが完全に揃っている**＝
     窓を開く条件（`anyGainable(state, woodworkersCanGain(state))`）／**終端保証**
     （`if (!anyGainable(...)) { state.pending = null; return state; }`）／強制獲得の受理
     （`if (g == null || !woodworkersCanGain(state)(g)) return state;`）／UI フィルタ。
   → **神器はこの4点セットの丸写しでよい**。「コスト上限なしのアクション獲得」の前例が repo にあるので、
     `costUpTo` を掛ける4回目の罠を**構造的に**避けられる。
   ⚠ 種別判定が `isTypeSupply`（＝**サプライの山の一番上**）になっているのが要点（§0-29 A2b）。
   同盟の分割山（卜占官／魔法使い…）は randomizer がアクションでも一番上が財宝/勝利点のことがある。
2. **手札に直接獲得**＝**`gain(state, pi, card, 'hand')`**（`p.hand.push` される＝捨て札置き場を経由しない）。
   日本語wiki が明示的に「捨て札置き場を経由せず」と書いている＝
   **捨て札トリガー（坑道／村有緑地／織工）を1つも通さない**こと。
3. **強制（not optional）**。ただし**サプライのアクション山が全部空なら候補ゼロ**
   → **窓を開かない終端保証**を入れる（人間が詰む／CPU livelock を防ぐ）。
4. **有効化の瞬間の1回は「Omen の解決の途中」**＝
   共通節の公式ルール ★（`"+1 [Sun]" always appears first on Omens`）どおり、
   **`+1 [Sun]` の処理の直後・その Omen カードの残りの効果を解決する**前**に割り込む**。
   本アプリでは `applyEffect` の途中で pending を立てる形＝**再開網（`t.*Resume`）が要る**
   （§0-30 の準備 Prepare、§0-22 の語り部 `t.storytellerResume` と同型）。
   **`state.pending` に直代入せず既存の再開機構に乗せること。**
   ⚠ **「最後の Sun を取り除いた瞬間」フックは Divine Wind と共用の汎用フックにする**（共通節の結論）。
   **取り除いた本人だけ**が獲得する（他のプレイヤーは獲得しない）。
5. **ターン開始時に最後の Sun を取り除くと同じターンに2枚獲得する**（公式の明示例＝歌人 Poet ×遅延 Delay。
   日本語wiki は川船 Riverboat の例を挙げる）＝**「1ターンに1回」のガードを入れてはいけない**。
   ⚠ 本アプリで「ターン開始時にアクションを使わせる」既存経路＝**遅延/刈り入れ/せっかちな の `event_play`**、
   **王子 `prince_play`**、**川船（旭日・未実装）**。**これらから前兆(Omen)が使われうる**ことを想定する。
6. **ターン開始時の窓は `t.startQueue` に積む**（`state.pending` を直代入しない＝§0-29 A3 の方針）。
   本アプリは**「ターン開始時効果の解決順を選べない」既存簡略化**があるので、
   Kind Emperor をどの位置に入れるかは決め打ちになる（**許容簡略化**）。
7. **獲得するので獲得時トリガーが全部走る**（望楼／そり／取り替え子／密航者）。**`gain()` の一元入口を通すこと。**
   ⚠ ただし**予言は1ゲーム1枚**なので、Kind Emperor と Progress / Rapid Expansion / Harsh Winter が
   同居することは無い（＝この4枚の相互作用は考えなくてよい）。
   ⚠⚠ **有効化の瞬間の1回は `state.pending` が立っている最中（Omen の解決の途中）に走る**＝
   `triggerOnGain` の **else-if 連鎖組が要求する `state._gainDepth === 1 && !state.pending` ゲートに引っかかる**
   （実コードで確認＝大釜／ヴィラ・遊牧民の野営地・物見やぐら・ティアラ・貨物船・技術革新・交易商人・国境の村／
   狂戦士／幽霊城／海賊／納屋／複製／御守り の8箇所すべて）。
   ＝**そのとき獲得したアクションには望楼などの対話が開かない**。
   **成長 ⚠11 とまったく同型の既存の横断簡略化＝PROGRESS に許容簡略化として書く**（else-if 連鎖を触らない）。
   ※ **ターン開始時の1回**は `t.startQueue` 経由で pending なし・深さ0から入るので、対話は普通に開く。
8. **4点セット必須**（新 pending＋`PLAYER_ACTIONS`＋CPU `decidePending`＋UI `viewPendingModal`）。
   **CPU は `null` を返さない**（候補ゼロなら engine 側が窓を開かない設計にする）。
   CPU の選択は**コスト無制限**なので `GAIN_ORDER` の先頭のアクションを取るのが素直。
   ＝**`ALLY_WOODWORKERS` の CPU 分岐がそのまま流用できる**（⚠1 参照）。
9. **⚠未確定＝支配(Possession)のターンの扱い**。厳冬だけは公式FAQ が
   `On a Possession turn, no player gains cards on their own turn, so Harsh Winter does not apply.` と明示するが、
   **Kind Emperor と Sickness の「あなたのターンの開始時」については英語wiki に記載が無い**
   （`raw_KindEmperor.html` / `raw_Sickness.html` とも `Possession` の語が **0件**＝私が機械検算した）。
   **一次資料に無いので断定しない。** 実装上の素直な読みは：
   - 支配ターンも「被支配者のターン」なので**開始時効果は被支配者に対して起きる**（＝窓は被支配者に開く）。
   - ただし本アプリは**支配中の獲得を支配者へ振り替える**（`t.possessionGains` ＋
     `triggerOnGain(state, t.possessedBy, ...)`＝§0-23 で「獲得者は支配者」に確定済み）ので、
     **神器で獲得したアクションは支配者の手札に入る**（公式 `any cards they would gain, you gain instead` と整合）。
   - **予言は1ゲーム1枚**なので厳冬との衝突は起きない。**mix-all 限定の到達**＝実装時に決めて PROGRESS に書く。

---

## 4. Panic ／ 狼狽  （コスト無し・予言(Prophecy)）

- **Illustrator**：Claus Stephan
- **英語id候補**：`panic`

- **英語カード文（逐語）**：
```
When you play a Treasure, +2 Buys, and when you discard one from play, return it to its pile.
```
※ 生HTMLで `+2&#160;Buys` が `<b>` 太字＝カード上でも太字。
- **日本語カード文（DO訳）**：
```
財宝カード1枚を使用したとき、+2 購入。そのカードを場から捨て札にしたとき、それをそのカードの山に戻す。
```
⚠ **この DO 訳は誤解を招く**。日本語wiki が明記＝
> Dominion Onlineの日本語訳では【狼狽戻り処理】の対象が「そのカード」と書かれていて分かりづらいが、
> **【狼狽+2購入】が適用されていないカードでも【狼狽戻り処理】が行われる**。

＝**「使用した財宝」に限らず、場から捨てられる財宝すべてが戻る**（有効化前に使ったものも含む）。
**カタログの日本語文は DO 訳で統一する方針だが、実装はこの注記どおりにすること。**
- **区切り線**：**0本**
- **版**：English versions **1行のみ**／`First edition`／`August 2024`＝**機能エラッタ無し**

### 公式FAQ・裁定

［英語wiki 公式FAQ（全文）］
> This makes Treasures into one-use cards.
>
> This can return Treasures to non-Supply piles, but can't return cards with no piles, e.g. Heirlooms
> (from Nocturne).
>
> **Loot (from Plunder) is returned to the top of the pile.**

［英語wiki その他の裁定（全文）］
> This applies even to Action-Treasures that are played during the Action phase, such as **Crown** or
> Actions under the influence of **Capitalism**.
>
> **Jewels** is never discarded from play, so it does not get returned to its pile.
>
> If you play a Treasure and then activate Panic while the Treasure is in play, **you don't get the +2 Buys
> but do return the Treasure to its pile.**

［日本語wiki 詳細なルール（要点・逐語）］
> 元から財宝カードの持っている効果が差し替わるわけではなく、狼狭の効果により【狼狽+2購入】を得る＆
> 【狼狽戻り処理】が行われる。原文の英語では前後の2文が繋がっていて若干分かりづらいが、
> **2つの効果は独立した処理である。**
>
> 元の財宝カードの効果と無関係に適用されるため、**財宝カードの使用時効果が発揮されない状況でも**
> 【狼狽+2購入】＆【狼狽戻り処理】が発生する。
> 財宝を使用したが、**追いはぎ**で使用時効果を無効化された or 財宝-アクションカードを**女魔術師**のアタックで
> キャントリップ化された or 財宝-アクションカードを**習性**として使用した際も発生する。
>
> 【狼狽戻り処理】は「**場からの**捨て札時に由来する山に戻る『捨て札時効果』」である。
> **場以外から捨て札になった際は誘発しない。** 具体的には、**追放マット**から財宝を捨て札にした際や、
> 資本主義影響下で【財宝化**ワイン商**】を**酒場マット**から捨て札にした際は誘発しない。
>
> 【狼狽戻り処理】は、他の捨て札時効果と同時に誘発する。**その処理順は自由に選んでよい。**
> **トリックスター**使用ターンに銀貨を場から捨て札にする際、【狼狽戻り処理】を先に処理してもよいし、
> トリックスターの捨て札時効果を先に処理して脇に置いてもよい。
> なお、どちらも移動処理なので、**一方を処理すると移動阻止ルールによりもう一方の処理に失敗する**。
>
> 【狼狽戻り処理】の処理の際、**財宝カードは実際に一度捨て札になる**ことに注意。
> **元手**を由来する山に戻す場合も、元手の「場から捨て札にする時〈負債6〉を受け取る」の処理は発生する。
>
> **由来する山札が無い財宝カードは処理に失敗する**：**家宝**カード／**川船**の効果で脇に準備したカード／
> 神風の効果で発生した【除去山】に由来するカード／**闇市場デッキ**のカード。
> **略奪品**などサプライに置かないカードも由来する山札があれば戻せる。
> **褒賞/Reward** カードは「褒賞/Reward の山札」へ。**戦利品**は「戦利品の山札」へ戻す。
> **この時、戦利品は裏向きにして戦利品の山札の一番上に戻される。**
>
> 【狼狽戻り処理】はあくまで捨て札時に処理される独立した効果である。**狼狽発動後、場から捨て札になる財宝
> 全てに適用される。** 財宝を使用したのが狼狽発動の前か後かは問わない。
> **持続していた契約書や、酒場マットから呼び出した法貨も、場から捨て札になる際に発生する。**
>
> **冠**は、使用時に【狼狽+2購入】を得て、捨て札時に【狼狽戻り処理】が発生する。
> **使用するフェイズがアクションフェイズだろうと、適用の有無には無関係**である。
>
> **資本主義**適用下では…特に、購入フェイズに突入した段階では【狼狽+2購入】を得ていないカードが、
> 購入フェイズで資本主義を購入したことで、**【狼狽戻り処理】だけ適用されてしまう**状況も起こり得る。
>
> **ターン中に一時的にサプライの山が3つ空になっても、【狼狽戻り処理】で山にカードが戻り、ターン終了時に
> サプライの山が3つ空になっていなければ、終了条件を満たさないのでそのままゲームを続行する。**

［Trivia：Preview（Donald X.）**全文**］（収集docは前半で切れていた＝検証docの訂正4）
> Panic means all of your Treasures will go away, but give +2 Buys while they vanish. **You will have to
> somehow make progress without Treasures, or else buy a lot of Coppers back. Which you'll have the buys
> to do; we think of everything.**
> — Donald X. Vaccarino, *Rising Sun Previews 1: Omens and Prophecies*, August 2024

＝**CPU が銅貨を買い戻せないと膠着する**という懸念に対する**作者本人の回答**（＋2購入は買い戻しのためにある）。

［Trivia：Secret history（Donald X.）］
> At first it gave +1 Buy, and **returned the Treasure immediately (oops some are Durations)**; it needed
> to be +2 Buys and wait.

＝**「即座に戻す」だと持続の財宝（アンフォラ/尽きぬ杯/船首像/宝石・魔除け 等）が壊れるので、
わざと『場から捨てるとき』に遅らせた**という設計意図。**この設計意図を壊さないこと。**

### ⚠ 実装で危ないところ

1. **(a) +2購入 と (b) 山へ戻す は完全に独立した2つのトリガー**（日本語wiki が明言）。
   **「使用時に旗を立てておいて片付けで見る」実装にすると公式と食い違う**
   （有効化前に使った財宝は +2購入は無いが戻しは起きる＝英語wiki FAQ 逐語）。
   ＝**配線は2箇所**：**(a) `playTreasureCard` / `applyTreasureEffect` の入口**、
   **(b) `cleanupAndAdvance` の「場から捨てる」サイト**。
2. **「山へ戻す」は獲得でも廃棄でもない第3の移動**＝本アプリの **`returnToPile(state, cardId)` /
   `canReturnToPile(state, cardId)`**（`grep -n "function returnToPile\|function canReturnToPile" js/engine.js`）を通す
   （同盟の交換 Exchange・略奪の 無謀な(Reckless)・取り替え子・交易商人 と同じ入口）。
   ✅ **既存の `returnToPile` は戦利品を `state.loot.unshift(cardId)`＝一番上へ裏向きに戻す実装が既にある**
   （略奪 P1a。コメントに `If you exchange a gained Loot (e.g. with Changeling), the Loot goes back on top of
   the pile, face down.` を引用済み）＝**公式FAQ `Loot is returned to the top of the pile` とそのまま一致する。
   追加実装不要**（私が実コードで確認）。
   混合山（廃墟/騎士/城/同盟の分割山）も `state[pile].unshift(cardId)` ＋ `supply[pile] = state[pile].length`
   で一番上に戻る。通常の山は `state.supply[cardId] += 1`。
3. **`supply` が増える＝3山終了が巻き戻る**。
   ⚠ **略奪の 調査(Search)「サプライの山が空になった瞬間」が再誘発しうる**（§0-30 の無謀な×Search と同型）
   ＝`returnToPile` の後に山が復活し、また空になると再び誘発する。
   ⚠ **終了条件はターン終了時（`cleanupAndAdvance` の中で `isGameOver`）に見る**ので、
   日本語wiki の「一時的に3山空でも戻れば続行」は**本アプリの既存実装で自然に満たされる**（確認済み）。
4. **山が無いカードは戻せない＝普通に捨て札へ**：家宝／川船の脇札／闇市場デッキのカード。
   `canReturnToPile` が false を返す（最後に `Object.prototype.hasOwnProperty.call(state.supply, cardId)` を見る）
   ＝そのまま使える。
   ⚠ **`canReturnToPile` は在庫を見ない（`hasOwnProperty` だけ）**ので、**空になった山にも戻せる**
   ＝日本語wiki の「一時的に3山空でも戻れば続行」と整合する（⚠3 参照）。
5. **アクション-財宝がアクションフェイズに使われた場合も対象**（冠 Crown／資本主義下のアクション）
   ＝**`isTreasureFor(state, id)` を通す**（静的 `DOM.isType` は不可）。
   ⚠ **判定タイミングが (a) と (b) で違う**＝資本主義を購入フェイズ中に買うと
   **「使用時は財宝でなかったが捨て札時は財宝」**が起きる（日本語wiki が名指し）。
   ＝**(b) は片付け時点で `isTreasureFor` を評価する**こと。
6. **効果が無効化されても +2購入と戻しは起きる**＝**追いはぎ(Highwayman)** で効果を消された財宝、
   **女魔術師** でキャントリップ化された財宝-アクション、**習性(Way)** として使った財宝-アクション。
   ⚠ 本アプリの追いはぎは「使用時の記載効果を丸ごとスキップ」（§0-16 A4）なので、
   **狼狽の +2購入をカード効果の中に書くと一緒に飛ぶ**。**`playTreasureCard` の入口（効果適用の外）に書くこと。**
7. **場以外からの捨て札では戻さない**＝追放マットからの捨て札（移動動物園）、
   酒場マットからの捨て札（資本主義下の財宝化ワイン商）。
   ＝**`triggerOnDiscard` 全体にフックしてはいけない**（`triggerOnDiscard` は 113箇所の捨て札経路が呼びうる）。
   **`cleanupAndAdvance` の「場（inPlay/durationCards）から捨てる」1箇所だけ**に配線する。
8. **場から捨てられないカードは戻らない**＝
   **宝石(Jewels・略奪)**（次のターン開始時に山札の**一番下**へ＝捨て札置き場を経由しない）、
   **乗組員(Crew)／勲章の topdeck／トリックスター の脇取り／疲れ知らずの(Tireless)**。
   ⚠ **これらは1枚ずつ「場から捨てる経路を通るか」を確認する必要がある**（本アプリはどれも
   「捨て札置き場を経由しない」実装＝自然に整合するはずだが、明示的にテストを書くこと）。
9. **他の捨て札時効果と同時＝解決順を選べる**（トリックスター／疲れ知らずの／カエルの習性／城壁のある村／
   宝物庫／元手）。**本アプリは順序を選べない既存簡略化**＝**許容簡略化として記録**。
   ⚠ ただし**元手(Capital)の「場から捨てるとき負債6」は必ず起きる**（戻す前に一度捨て札になるため）
   ＝**戻す処理を「捨て札トリガーの後」に置く**こと。
10. **持続の財宝は場に残っている間は捨てられない**＝予約が尽きた片付けで戻る（＝作者の設計意図どおり）。
    **契約書(Contract)** や**酒場マットから呼び出した法貨(Coin of the Realm)** も、場から捨てられる時に戻る。
11. **`treasure_replay`（冠/ティアラ/偽造通貨/王の隠し財産の2回目・3回目）で +2購入 が出るか＝⚠未確定**。
    Panic 側にも Crown 側にも明示裁定は無い（検証者も私も再取得して確認）。
    ⚠ **私の読み（断定ではない）**＝出ると読むのが自然。根拠＝**Crown の公式FAQ 逐語**
    `If you play this in your Buy phase, you play a Treasure from your hand, then **play it again**;`
    ＝2回目も「play」である。本アプリの2回目は `applyTreasureEffect`（カードを動かさず効果だけ）を通るので、
    **`playTreasureCard` ではなく `applyTreasureEffect` 側に +2購入 を置けば2回出る**。
    **どちらにするかを決めて PROGRESS に明記すること**（後から反転できる1行にしておく）。
    ※ 戻しは場のカード1枚に対して1回だけなので再演の影響を受けない。
12. **CPU が壊れやすい**＝財宝が毎ターン消える。
    **`chooseBuy` が「銅貨を買い戻す」を理解しないとデッキが空になって膠着する**（＝作者の Preview 全文が
    まさにこれを言っている）。**+2購入をどう使うかも要る**。ソークで未終局が出ないか必ず確認する。
13. **CPU の終局読み**＝戻した財宝ぶんデッキが減るので `winsIfEnds` の見積りが変わる。
    `DOM.engine.allCards` を通していれば自動追従する（§0-26 の教訓）。

---

## 5. Progress ／ 進歩  （コスト無し・予言(Prophecy)）

- **Illustrator**：Claus Stephan
- **英語id候補**：`progress`（⚠ engine の内部フラグ名 `t.progress` と紛れやすいので命名に注意）

- **英語カード文（逐語）**：
```
When you gain a card, put it onto your deck.
```
- **日本語カード文（DO訳）**：
```
カード1枚を獲得したとき、それを山札の上に置く。
```
- **区切り線**：**0本**
- **版**：English versions **1行のみ**／`First edition`／`August 2024`＝**機能エラッタ無し**
  ⚠ 依頼文は「進歩」を**ホビージャパン印刷版と文面が違うカード**として挙げているが、
  **日本語wiki の 進歩 ページには「余談」節が無く、HJ 版差異の記載は見つからなかった**＝**⚠未確定**。

### 公式FAQ・裁定

［英語wiki 公式FAQ（全文）］
> This is not optional; all gained cards go onto your deck.
>
> This includes cards gained **when it's not your turn**.

［英語wiki その他の裁定（全文）］
> This also applies to cards that would normally be gained to unusual locations, such as a **Den of Sin**
> or anything gained with **Blockade**.
>
> However, the **stop-moving rule** can in some cases prevent a card from being placed on your deck. For
> instance, you may use a **Sleigh** to move a gained card into your hand; if you do, Progress will no longer
> be able to move it onto your deck.
>
> You may have to read card texts carefully to determine whether something is gained **directly to** an
> unusual location (in which case Progress overrules it) or is **moved after being gained** (so the
> stop-moving rule can apply). For instance, although **Ghost Town** and **Villa** may appear similar in their
> gaining behavior, Ghost Town is gained **to** the hand (and must be moved to the deck by Progress),
> whereas Villa moves itself to the hand **after** being gained (which can overrule Progress).

［日本語wiki 詳細なルール（全文・要点）］
> 進歩の「獲得カードをデッキトップに移動する効果」は**強制効果**である。
>
> 進歩の「獲得カードをデッキトップに移動する効果」は、**獲得時効果**である。
> 誘発させる獲得の手段は購入に限られず、**豊穣の角笛**で獲得したカードや、**国境の村**の獲得時効果で
> 獲得したカードなどもデッキの一番上に置く。
>
> 進歩の効果は、**既定獲得先に獲得したカードをデッキトップに移動する**効果である。
> **守護者**のような**手札が既定獲得先**のカードは、デッキトップに移動してしまうので注意。
> **職人**や**彫刻家**などの使用時効果で手札に獲得したカードも、デッキトップに移動してしまうので注意。
>
> 進歩の処理は、「獲得カードAを直接デッキトップに獲得する」のではなく、
> **「まず獲得先を『訪問』した獲得カードAを、進歩の効果でデッキトップに移動する」**というモノである。
> これは**移動阻止ルール**に抵触する場合があるので注意が必要。
> - 獲得カードAが(**職人**などの効果で)手札に獲得された場合や、(**封鎖**などの効果で)脇に獲得された場合は、
>   進歩の効果でデッキトップに移動する。
> - **他の獲得時効果も進歩の効果と同時に誘発する。獲得カードAを獲得したプレイヤーが解決の順番を選ぶ。**
> - 他の獲得時効果を先に処理したことで獲得カードAが獲得先から移動すると、
>   **進歩の効果でのデッキトップへの移動に失敗する。**
> - 逆に、進歩の処理により獲得カードAがデッキトップに移動すると、
>   **他の獲得時効果によるカード移動に失敗する。**
> - 一方で、進歩の効果でAがデッキトップに移動しても、**「獲得先から移動させる効果」以外の獲得時効果は
>   妨げられない**（例＝**鏡映**の効果で同じカードAを獲得することはできる）。
>
> **⚠ 進歩発動後、身代わり／呪符の巻物／継続／召喚 の効果でカードBを獲得した際の処理に注意。**
> これらの処理では獲得したカードBは一旦捨て札置き場に置かれるが、この時進歩の効果により必ずデッキトップに
> 移動する。これによりカードBは予期される獲得先から移動したとみなされ、移動阻止ルールに抵触するため、
> **「身代わりによるデッキトップへの移動」「呪符の巻物or継続による場への移動」「召喚による脇への移動」に
> 必ず失敗する。**
>
> 同様に、**「侵略購入時の『戦利品1枚を獲得し、即座に使用する』の処理」**の際も、
> ①獲得カードを獲得先に置く→②ここで進歩の効果が誘発され、獲得カードをデッキトップに置く→
> **③獲得カードを場に出し使用しようとするが、移動阻止ルールにより失敗する**、という処理になるので注意。
>
> （＋国境の村×銀貨の解決順の詳細例＝結論は「デッキトップの順番は 国境の村→銀貨 でも 銀貨→国境の村 でもよい」）

［Trivia：Secret history（Donald X.）］
> No changes. It doesn't look like much but played great.

### ⚠ 実装で危ないところ

1. **⚠⚠ この群で最大の実装リスク＝「獲得先が hand/setAside なのか、獲得**後**に移動しているのか」の区別**。
   公式は **Ghost Town（＝手札に *獲得する*）は Progress が勝つ**、
   **Villa（＝獲得した *後で* 自分を手札へ動かす）は Villa が勝つ（stop-moving）** と明確に分けている。
   **本アプリはこの区別を「たまたま」持っている**：
   - **`gain(state, pi, card, dest)` の `dest` 側**（`grep -n "else if (dest === 'eventSetAside')" js/engine.js`
     の周辺＝`hand` / `deck` / `setAside` / `eventSetAside` / それ以外は `discard`）
     ＝**ゴーストタウン／悪人のアジト／守護者／夜警／職人／彫刻家／封鎖／刈り入れ ほか**。
     → **Progress が勝つ**（獲得の後で山札の上へ動かす）。
   - **`triggerOnGain` の中で獲得**後**に動かす側**＝**ヴィラ／遊牧民の野営地／物見やぐら／ティアラ／
     貨物船／技術革新／交易商人**（`zoneOf(p, dest)` を使って動かしている＝`function zoneOf` のコメントが正本）、
     および **`onGainQueue` 組**（そり／牧羊犬／鷹匠／移動遊園地／追跡者／勲章／追放の払い戻し／アザラシ／
     密航者／**せっかちな `hasty_aside`**／**配達 `deliver_aside`**）。
     → **stop-moving で Progress が負けうる**（順序を選べるのが公式）。
   ⚠ **配達(Deliver・略奪イベント)を落とさないこと**＝`p.deliverAside` は `allCards` と
   `test/invariants.test.js` の `ZONES` に入っている実ゾーンで、
   `onGainQueue` の `deliver_aside` が **`zoneOf(dp, q.dest)` から `removeOne` に成功したときだけ**脇へ移す
   ＝**既に stop-moving を自然に実装している**（私が実コードで確認）。
   Progress と真正面から競合する（脇へ→ターン終了時に手札／Progress は山札の上へ）。
   ⚠ **1枚ずつ「dest 側か triggerOnGain 側か」を洗い出して分類する作業が必要**。
   **ここを雑にやると「Progress があるだけで既存の十数枚が静かに壊れる」**。
2. **⚠⚠ 日本語wiki が名指しする「必ず失敗する」4＋1経路を必ずテストする**：
   - **身代わり(Replace・陰謀)**＝獲得したアクション/財宝を山札の上に置く → 失敗（結果の位置は同じ）
   - **呪符の巻物(Spell Scroll・略奪)**＝廃棄→安いカードを獲得→**使用してよい** → **使用に失敗**
   - **継続(Continue・旭日イベント)**＝獲得して**アクションフェイズに戻って使用** → **使用に失敗**
   - **召喚(Summon・プロモイベント)**＝獲得して脇へ → 失敗
   - **侵略(Invasion・略奪イベント)** ④＝戦利品を獲得して**使用** → **使用に失敗**
   本アプリは §0-30 P5 で侵略を「望楼で動かされたら使用に失敗＝stop-moving」として実装済み＝
   **同じ判定に Progress が乗るはず**だが、**実際に乗るか回帰テストで確認する**こと。
3. **`gain()` の全経路に効く**＝`gainFromOutside`／`gainLoot`／`BLACK_MARKET_BUY`／
   廃棄置き場からの獲得 も含めて**唯一の入口に配線する**。
   ※ **「交換(exchange)」は獲得ではない**（吸血鬼↔コウモリ／取り替え子／トラベラー／濡女）＝**対象外**。
4. **相手のターンの獲得にも効く**（FAQ 逐語）＝`triggerOnGain` の active 限定ゲートを通してはいけない。
   相手のアタックで押し付けられた呪い・廃墟も山札の上に乗る（＝**アタックが凶悪化する**）。
5. **既存の topdeck 機構と競合する**＝勲章(Insignia)／移動遊園地(Travelling Fair)／追跡者(Tracker)／
   ボーブル(Bauble)／**配達(Deliver)**／**役人(Bureaucrat)**／**遊牧民の野営地**／**貨物船**。
   本アプリは `t.insignia`（勲章）と `t.trackerTurn`（追跡者）が**同じ `travelling_fair` pending を共有**（§0-30 P1b）。
   Progress は**強制**なので、これらの「任意で山札の上へ置いてよい」窓は**開く意味が無くなる**。
   ⚠ **両方の窓が既に `dest !== 'deck'` で自分をスキップする条件を持っている**
   （`grep -n "dest !== 'deck'" js/engine.js` で2箇所＝追跡者と勲章）ので、
   **Progress が先に deck へ移した後なら自然に窓が開かない**――が、
   **順序が逆（窓が先）なら空振りの選択肢が出る**。**どちらにするか決めて終端保証を書くこと**
   （§0-29 A5 の「候補ゼロで閉じない窓」で人間が詰む形）。
6. **オンラインのマスク**＝自分の山札の上に置いたカードは相手には見えない（既存どおり）。
   獲得自体は公開情報なので推測はできる（既存の挙動と同じ＝問題なし）。
6b. **⚠⚠ オンラインの「買い物だけは相手の同意なしで戻せる」（§0-24）が Progress のゲームでは完全に死ぬ**。
   `server/gameServer.js` の `isNoConsentUndoableBuy` は同意不要の証明として
   **「自分の山札と手札が1枚も動いていないこと」**を要求する（私が実コードで確認）：
   ```js
   if (JSON.stringify(cur.players[i].deck) !== JSON.stringify(prev.players[i].deck)) return false;
   if (JSON.stringify(cur.players[i].hand) !== JSON.stringify(prev.players[i].hand)) return false;
   ```
   **Progress が有効な間は購入したカードが必ず山札の上に乗る**＝この比較が毎回不一致になり、
   **全ての購入が従来どおりの「相手に確認」経路へ落ちる**。
   - **バグではない（安全側に落ちるだけ）**が、**オンラインの UX が明確に変わる**。
   - **Progress だけが特異**＝急速拡大（`p.eventSetAside` へ移る）・厳冬（`p.debt` と `state.pileDebt` が動く）は
     どちらも**この比較の対象外**なので同意不要のまま通り、巻き戻しも正しく戻る（私が実コードで確認）。
   → **「許容として記録する」か「`isNoConsentUndoableBuy` に Progress 用の例外を書く」かを決めて PROGRESS に書く**。
     ※ 例外を書くなら**「山札の一番上に獲得札1枚だけが増えている」ことを証明する**形にすること
       （＝乱数も情報も増えていない）。素朴に比較を外すと §0-24 の覗き見穴が開く。
7. **CPU の終局読み**＝デッキの中身は変わらないので得点計算に影響しない（安全）。
   ただし**勝利点カードが山札の上に来る**＝終盤に露骨に弱くなる（日本語wiki の「利用法」節が
   「勝利点を買う段階になると足枷」と明記）。CPU がそれを理解しなくても膠着はしない。
8. **`state.onGainQueue` に積むか、`triggerOnGain` 内で直接動かすか**＝
   **直接動かす**のが素直（対話が無い＝非対話）。ただし**順序を選ばせる**なら pending が要る＝
   本アプリの**「同時に誘発した効果の解決順を選べない」既存簡略化**に落とす（**許容簡略化として記録**）。

---

## 6. Rapid Expansion ／ 急速拡大  （コスト無し・予言(Prophecy)）

- **Illustrator**：Donald Crank
- **英語id候補**：`rapid_expansion`

- **英語カード文（逐語）**：
```
When you gain an Action or Treasure, set it aside, and play it at the start of your next turn.
```
- **日本語カード文（DO訳）**：
```
アクションカードか財宝カード1枚を獲得したとき、それを脇に置き、あなたの次のターンの開始時に使用する。
```
- **区切り線**：**0本**
- **版**：English versions **1行のみ**／`First edition`／`August 2024`＝**機能エラッタ無し**

### 公式FAQ・裁定

［英語wiki 記事冒頭の定義文（★これが実装の下敷き）］
> Rapid Expansion is a Prophecy from Rising Sun. Once activated, it essentially **makes all Actions and
> Treasures Hasty** for the rest of the game, playing themselves automatically the turn immediately
> after you gain them.

［英語wiki 公式FAQ（全文）］
> This is not optional.
>
> **You can order playing each card at the start of your next turn, relative to other such cards and also
> anything else that happens at the start of that turn.**

［英語wiki その他の裁定（全文）］
> This even applies to cards that would ordinarily be gained **directly to your hand** for immediate use. For
> instance, if you use **Mine** while Rapid Expansion is in effect, the gained Treasure will be set aside and
> can't be played on the current turn.
>
> The **stop-moving rule** can in some cases allow you to interrupt Rapid Expansion's effect. For instance, if
> you gain a **Villa** while Rapid Expansion is in effect, you get two competing "when you gain this" movement
> instructions: Villa telling you to put it in your hand, and Rapid Expansion telling you to set it aside.
> Since these two instructions activate at the same time, **you can choose which one to follow first** (and
> then the other will be blocked by the stop-moving rule). However, this doesn't apply in the case of
> cards such as Mine (see above) because of the **No Visiting rule**: in the case of Mine, the Treasure is
> gained directly to your hand, rather than moved to your hand at a time that conflicts with Rapid Expansion.

［日本語wiki 詳細なルール（要点・逐語）］
> 急速拡大の「獲得カードを脇に移動する効果」は**強制効果**である。（※原文は「デッキトップに移動しない選択は
> できない」と書かれているが、これは進歩ページからの写し誤り＝正しくは「脇に移動しない選択はできない」。）
>
> 急速拡大の「獲得カードを脇に移動する効果」は、**獲得時効果**である。
> 誘発させる獲得の手段は購入に限られず、豊穣の角笛や国境の村の獲得時効果で獲得したカードも対象。
>
> 急速拡大の効果は、**既定獲得先に獲得したカードを脇に移動する**効果である。
> **守護者**のような**手札が既定獲得先**のカードも、脇に移動してしまうので注意。
>
> 急速拡大の処理は、「獲得カードAを直接脇に獲得する」のではなく、
> **「まず獲得先を『訪問』した獲得カードAを、急速拡大の効果で脇に移動する」**というモノである。
> **武器庫**などで獲得カードAが**デッキトップに獲得された場合**も、デッキトップに置かれた後、
> 急速拡大の効果で脇に移動する。
>
> **他の獲得時効果も同時に誘発する。獲得カードAを獲得したプレイヤーが解決の順番を選ぶ。**
> 先に他方を処理してAが獲得先から移動すると、もう一方の移動は**失敗する**（移動阻止ルール）。
> 一方で、脇に移動しても「獲得先から移動させる効果」以外の獲得時効果は妨げられない
> （例＝**鏡映**の効果で同じカードAを獲得することはできる）。
>
> **⚠ 急速拡大発動後、身代わり／呪符の巻物／継続／召喚 の効果でカードBを獲得した際**、
> Bは一旦捨て札置き場に置かれ、急速拡大の効果で必ず脇に移動する＝
> **「身代わりによるデッキトップへの移動」「呪符の巻物or継続による場への移動」「召喚による脇への移動」に
> 必ず失敗する。**
> 同様に **「侵略購入時の『戦利品1枚を獲得し、即座に使用する』」も、③使用しようとするが移動阻止ルールにより
> 失敗する。**

［Hasty（略奪の特性・カード文がほぼ逐語同一）の裁定＝類推適用できる］
Hasty の Info（生HTMLで確認）＝`Type: Trait` / `Set: Plunder` / `Illustrator: Donald Crank` /
`Trait text: When you gain a Hasty card, set it aside, and play it at the start of your next turn.`
- Official FAQ：
  > If this plays a card that can't normally be played, like **Territory** (from Allies), that card goes
  > into play but doesn't do anything else then.
- Other rules clarifications：
  > Playing a card that has no effect (like Territory) will still trigger e.g. **Pathfinding**, and it can
  > count for e.g. **Landing Party**.

［Trivia：Preview（Donald X.）］
> Rapid Expansion makes gained Actions and Treasures leap into play next turn. **Gain 8 cards and you will
> have 8 things waiting.** Gain a Copper and well that will be waiting. Most things are happy to be set
> aside like this, but some can be sad; **consider Sculptor**.

［Trivia：Secret history（Donald X. / playtester DZ）**全文**］
> DZ suggested this one. Unchanged, and one of my favorite Prophecies.
>
> My thought process was to turn **Hasty** on its head: instead of one pile being Hasty for the whole
> game, it's instead **all piles being Hasty for the second half**. **JNails complained about how this
> messed up gain and play but I think it's funny.**

⚠ **最後の1文は収集doc にはあったが確定版が省略記号なしで落としていた**（＝Panic の Preview で
[low] として訂正したのと**まったく同じクラスの欠落**＝レビューの指摘で私が復元した）。
落ちた 1文の "**messed up gain and play**" は、**「獲得して即使用する」系（侵略／呪符の巻物／継続／召喚）が
壊れる**というプレイテスタの指摘そのもので、**下の ⚠7（必ず失敗する5経路）の一次資料側の裏付けになる**。

### ⚠ 実装で危ないところ

1. **⚠⚠ 実装の下敷きは「略奪の特性(Trait) せっかちな(Hasty)」＝本プロジェクトに既にある**
   （収集docは「Hasty（同盟のトークン）ではなく」と誤って否定していた＝検証docの訂正1。私も再確認した）。
   （行番号ではなく `grep` できる文字列で示す。すべて私が実コードで確認した）
   - カタログ＝`grep -n "hasty:" js/cards.js`
     ＝`hasty: { name: 'せっかちな', nameEn: 'Hasty', kind: 'trait', expansion: 'plunderexp', ... }`
   - 獲得時＝`grep -n "hasTrait(state, cardId, 'hasty')" js/engine.js`
     ＝`(state.onGainQueue = state.onGainQueue || []).push({ type: 'hasty_aside', player: pIndex, card: cardId, dest });`
   - キュー消化＝`grep -n "hasty_aside" js/engine.js`＝**非対話**。`zoneOf(hp, q.dest)` から `removeOne` に
     成功したときだけ **`p.eventSetAside`** へ移す（＝**stop-moving を自然に実装している**）。
   - 次ターン開始時＝`grep -n "type: 'event_play'" js/engine.js`
     ＝`(p.eventSetAside || []).forEach(() => { state.turn.startQueue.push({ type: 'event_play', player: pi }); });`
     → `case 'EVENT_PLAY'` の reducer が **`playCardNoAction`** で強制使用する。
   → **`hasTrait(state, cardId, 'hasty')` を
   `hasTrait(...) || (hasProphecy(state,'rapid_expansion') && (isTypeSupply/isTreasureFor で action か treasure))`
   に広げるだけで大枠が動く**（`hasProphecy` は `hasTrait` と同型で新設する）。
   **新ゾーンを作る必要は無い**（`p.eventSetAside` を使う）。
   ⚠ 王子(Prince)／準備(Prepare)／配達(Deliver) は形が違う（王子は毎ターン繰り返す・準備は専用再開網・
   配達は先引きの後に手札へ）＝**Hasty が唯一の正しい前例**。
2. **`p.eventSetAside` は既に4箇所に配線済み**（`grep -n "eventSetAside" js/engine.js test/invariants.test.js`）＝
   `allCards`（`p.eventSetAside || []` を所有カードに含める）／
   `test/invariants.test.js` の `ZONES` 配列（`'eventSetAside', // 移動動物園：遅延/刈り入れの脇置き …公開ゾーン`）／
   `zoneOf`（`if (dest === 'eventSetAside') return (p.eventSetAside = p.eventSetAside || []);`）／
   `gain()` の dest 分岐。
   **`maskStateFor` は `eventSetAside` に一切触れていない＝伏せない＝公開ゾーン**
   （※ 確定版の初稿は「`maskStateFor` の 1463 行のコメント逐語」と書いていたが、その行は
   **`createInitialState` のプレイヤー初期化のコメント**だった＝**結論「公開」は正しいが参照先が別物**。
   レビューの指摘で私が実コードを見て直した。）
   ⚠ **公開か伏せかは一次資料に明示が無い**（`Rapid Expansion` にも `Hasty` にも `face down` の語が無い）
   ＝**既存の Hasty 実装（公開）に合わせれば整合が取れる**。**⚠未確定だが実害なしとして記録する。**
3. **強制（not optional）**。
4. **⚠ 順番をプレイヤーが選べる**（公式FAQ 逐語＝`relative to other such cards **and also anything else
   that happens at the start of that turn**`）。
   **本アプリの `t.startQueue` は先入れ順で選べない**（§0-28／§0-29 A3 の既存の横断簡略化）
   ＝**許容簡略化になる**。ただし **8枚獲得したら8枚が待つ**（Preview 逐語）＝
   **順番が結果を大きく変える局面が普通に起きる**ので、他の簡略化より痛い。
   `EVENT_PLAY` は `const card = (pl.eventSetAside || [])[0];` と**無条件に先頭を取る**実装なので、
   **最低限「同じ脇の札どうしの順番」を選ばせる**（`action.card` を受け取る）ことを検討する価値がある。
   ⚠ その場合は **`event_play` が対話 pending になる**＝**4点セット（engine reducer＋`PLAYER_ACTIONS`＋
   CPU `decidePending`＋UI `viewPendingModal`）が要る**。**強制なので「やめる」ボタンは出さない**が、
   **脇が空なら窓を開かない**終端保証を入れる（現行の `EVENT_PLAY` は `if (card == null) { popStartQueue(state); return state; }`
   で既にこの形になっている＝そのまま踏襲する）。
5. **「手札に直接獲得する」カードも脇に置く**（鉱山 Mine で獲得した財宝は**その場で使えない**＝No Visiting rule）
   ＝**Progress と同じく `dest` 側は脇が勝つ**。**武器庫でデッキトップに獲得した札も脇へ移る**。
6. **stop-moving 則で打ち消せる**＝**ヴィラ Villa** のように「獲得したとき自分を手札へ動かす」札とは
   **同時誘発なので順番を選べ**、先に選んだ方が勝つ。
   ⚠ **現在の `hasty_aside` は `onGainQueue` の順序（＝ヴィラの else-if 連鎖が先）で決め打ち**
   ＝**ヴィラが常に勝つ**。**許容簡略化として記録**（順序を選ばせるなら pending＝4点セットが要る）。
7. **⚠⚠ 日本語wiki が名指しする「必ず失敗する」経路は Progress とまったく同じ**
   （身代わり／呪符の巻物／継続／召喚／侵略）＝**Progress の ⚠2 と同じテストを書く**。
8. **対象はアクションと財宝だけ**（勝利点・呪い・夜行・家宝は対象外）。
   **種別は動的**＝`isTreasureFor(state, id)` ／ アクション側は
   `DOM.isType(card,'action') || inheritedEstate(p, card)`（相続の屋敷）を通すか要検討。
   ⚠ **サプライ由来なら `isTypeSupply(state, id, 'action')`**（同盟の分割山＝§0-29 A2b）。
9. **「使用する」＝アクション権を消費しない**＝**`playCardNoAction`**（既存の `EVENT_PLAY` がそう呼んでいる）。
   **持続なら普通に持続する**。**習性(Way)も選べる**（`EVENT_PLAY` は `action.way` を受け取る＝既存）。
   ⚠ **使用できないカードでも「場には出る」**（Hasty の公式FAQ＝Territory の例）＝
   `playCardNoAction` が false を返す形にしてはいけない場合がある。要確認。
   ✅ 実コードを見たかぎり `playCardNoAction` が false を返すのは
   **(a) `fromHand && !canPlayFromHand`（航海の3枚制限）／(b) `fromHand && warlordBlocks`（将軍）／
   (c) `removeOne(zone, card)` 失敗** の3つだけ。脇からの使用は `fromHand === false`、
   カードは脇に実在する＝**実質つねに成功する**。Territory のような「何もしないアクション」は
   `applyEffect` に case が無いだけで**場には出る**＝公式と自然に一致する。
9b. **⚠ 夜行(Night)カードとの複合＝人狼(Werewolf) を確認しておくこと**。
   人狼は **アクション-夜行-アタック-不運**＝「アクション」なので急速拡大の対象になり、
   **ターン開始時に `playCardNoAction` で使わされる**。本アプリのターン開始時は **`turn.phase === 'action'`**
   （§0-22 で「ドミニオンに開始フェイズは無い＝'action' にする」と確定済み）。
   ✅ **実コードを確認したところ、人狼は `if (t.phase === 'night') startHexAttack(...) else attackWindowEnter(..., 'werewolf_draw')`
   と自分でフェイズ分岐している**＝ターン開始時に使わせると**公式どおり「+3カード」側**になる（呪詛は配らない）。
   ＝**新しい対処は不要**。
   ⚠ **純粋な夜行カード（カブラー／悪人のアジト／修道院 等）は「アクション」でも「財宝」でもない＝対象外**
   （`playCardNoAction` の `isAct` が false になると財宝側の分岐に落ちるので、対象に含めると壊れる）。
   ⚠ **この問題は既存の せっかちな(Hasty) でも同じく起きうる**（人狼の山に特性が付く）＝
   **先例が既にあるので、そちらの挙動に合わせれば整合が取れる**。
10. **相手のターンに獲得した札も脇に行き、自分の次のターン開始時に使う**（カード文に "on your turn" が無い）。
11. **`p.eventSetAside` の札は所有カード**＝得点計算・庭園・品評会・保存則に数える（既存で配線済み）。
12. **CPU が壊れやすい**＝獲得した銅貨・呪い（※呪いは対象外）・勝利点（※対象外）はともかく、
    **獲得したアクション/財宝が毎ターン勝手に場に出る**。`chooseBuy` が荒れないかソークで確認する。
    ⚠ **アクション権を消費しないので村不足で詰まることは無い**が、
    **アタックが毎ターン自動発動する**（相手のターンに獲得したアタックも含む）＝ソークで未終局に注意。
13. **彫刻家(Sculptor)のように「手札に獲得」が売りのカードが機能を失う**（作者が名指し）＝**バグではない**。

---

## 7. Sickness ／ 病  （コスト無し・予言(Prophecy)）

- **Illustrator**：Donald Crank
- **英語id候補**：`sickness`

- **英語カード文（逐語）**：
```
At the start of your turn, choose one: Gain a Curse onto your deck; or discard 3 cards.
```
※ 生HTMLで `discard 3&#160;cards`（ノーブレークスペース）＝表示上は「3 cards」で改行しない。
- **日本語カード文（DO訳）**：
```
あなたのターンの開始時に、次のうち1つを選ぶ：
「呪い1枚を山札の上に獲得する」「手札3枚を捨て札にする」
```
- **区切り線**：**0本**
- **版**：English versions **1行のみ**／`First edition`／`August 2024`＝**機能エラッタ無し**

### 公式FAQ・裁定

［英語wiki 公式FAQ（全文）］
> You can choose to gain a Curse **even if the Curse pile is empty**, or to discard cards **even if you have
> fewer than 3 cards in hand** (in which case, discard as many as you can).

［英語wiki その他の裁定］**節そのものが存在しない**（TOC は `1.1 Official FAQ` のみ＝私も再確認）。

［英語wiki 記事冒頭の定義文］
> Once it's activated, it inflicts harsh discard or cursing attacks every turn **until the Curses are depleted**.

［日本語wiki 詳細なルール（全文）］
> 手札が2枚以下の状態でカード3枚を捨てることを選択した場合、残った手札を捨てる。（**手札0枚であれば
> 何も起こらない**）
>
> なお、**手札からカードを複数枚捨てる際は、同時に捨て札にする**ことに注意。
> 例えば手札が**坑道**と**望楼**の2枚だけである場合、坑道をリアクションして金貨を獲得することはできるが、
> **その金貨に対して望楼でリアクションすることはできない。**
>
> サプライに呪いが無い状態で「呪いを山札の上に獲得する」ことを選択した場合、**何も獲得しない**。
>
> **川船**の効果などでターンの開始時中に病が効果を発揮した場合は、**そのターンの開始時にも病の効果を処理する。**
>
> 病の効果で獲得される呪いは、**捨て札置き場を経由せずに直接デッキトップに獲得される。**
>
> 病の効果を受けることは、「他プレイヤーからのアタックの使用」「自身のアタックカードの使用」には**該当しない**。
> - **灯台、チャンピオン、守護者を使用していても影響を受ける。**
> - 【アタック誘発リアクション】でリアクションすることが**できない**。
> - **浮浪児**が場に出ていても、「他のアタックカードを使用したとき」の効果を誘発することが**できない**。
> - ただし、**呪いの獲得に対して【獲得誘発リアクションカード】などでリアクションすることはできる。**
> - また、**手札を捨て札にすることに対して、【捨て札誘発リアクションカード】でリアクションすることはできる。**

［日本語wiki 利用法（★実装に直結するので引用する）］
> ハンデス効果は、**民兵**のような「3枚になるまで捨てる」ではなく「**3枚捨てる**」なので、
> 手札5枚であれば残るのは2枚になってしまい、ろくな行動がとれなくなる。
> **民兵を受けているなどして3枚の状態から捨て札にしようものなら手札は0枚となる。**

＝**民兵型（N枚に「なるまで」捨てる）ではない**という、最も踏みやすい実装の罠への明示的な警告。
（確定版の初稿は「詳細なルール」節だけを引いてこの対比を落としていた＝レビューの指摘で私が追加した。）

［Trivia：Preview（Donald X.）］
> Sickness attacks you every turn, your choice of a Curse on top or a heinous discard 3 cards.

［Trivia：Secret history（Donald X.）］
> The wording is tricky if you want to make sure that it doesn't suck to trigger it yourself (e.g.
> there's one Curse left and hey you get it). ... It was still a contender for a while, with an
> "if there are enough left" wording that playtesters complained about. ...
> Aha, it could give you an option. You gain a Curse onto your deck, or discard 3 cards; something you
> will rarely be willing to do, but you do it some, and hey **you'll do it if they Blockade Curse**.

＝**「遂行できない選択肢も選べる」＝呪いが尽きたあとも詰まないための設計**であることが作者の言葉で裏取りできる。

### ⚠ 実装で危ないところ

1. **⚠⚠ アタックとして実装してはいけない**（Type は `Prophecy` の1語のみ・日本語wiki が明示）。
   `ATTACKS` に登録すると堀で無効化され、**公式より弱くなる**
   （§0-29 の「Ally が起こす攻撃は堀で防げない」・§0-30 の大渦巻 Maelstrom と**まったく同型**）。
   - **`attackImmune(state, seat)` を通してはいけない**（灯台／チャンピオン／守護者が効いてしまう）。
   - **リアクション窓（`attack_window` / `reactOptions` / `MOAT_REVEAL` / `SHIELD_REVEAL`）を開かない**。
   - **浮浪児(urchin) の `maybeUrchinTrap` を呼ばない**（日本語wiki が明示）。
   - ⚠ **一方で「呪いの獲得」に対する獲得誘発リアクション（望楼／そり／牧羊犬／取り替え子／密航者）と、
     「捨て札」に対する捨て札誘発リアクション（坑道／村有緑地／織工／忠犬）は普通に働く**
     ＝`gain()` と `triggerOnDiscard` の一元入口を通すこと。
2. **強制の二択（choose one）＝「やらない」ボタンは出さない**。
   **ただし両方の選択肢を常に出す**：
   - **呪いの山が空でも「呪いを獲得」を選べる**（何も起きない）
   - **手札が3枚未満でも「3枚捨てる」を選べる**（あるだけ捨てる／**手札0枚でも選べて何も起きない**）
   ＝**これが候補ゼロで詰まないための逃げ道**。
   **「候補ゼロなら窓を開かない」という本アプリの定石をここに適用してはいけない**
   （§0-30 の "next time" 型持続、§0-21 の探索(Quest) と同じ注意）。
2b. **⚠⚠ 民兵型の `discardDownEnter` を流用してはいけない**（この群でいちばん踏みやすい罠）。
   本アプリには **`discardDownEnter(state, source, down, victims, next, drawAfter)`**
   （`grep -n "function discardDownEnter" js/engine.js`＝コメント逐語「**手札N枚まで捨てる**汎用アタック
   （民兵型・embedded。浮浪児=4/傭兵=3/サー・マイケル=3）」）があり、
   **PROGRESS §0-30 は略奪の 剣(Sword) を「既存 `discard_down` を n=4 で流用」と書いている**ので、
   Sickness も同じ流用で書くのが最短経路に見える。**それをやると公式より弱くなる**：
   | 手札 | 公式（3枚**捨てる**） | 民兵型で書いた場合（3枚に**なるまで**） |
   |---|---|---|
   | 5枚 | 残り **2枚** | 残り3枚＝**1枚ぶん甘い** |
   | 3枚 | 残り **0枚**（日本語wiki が名指し） | 0枚捨て＝**完全な空振り** |
   | 0枚 | 何も起きない | 何も起きない（ここだけ一致） |
   ✅ **正しい前例は `case 'FORUM_DISCARD'`（公共広場＝手札をちょうど2枚、手札が2枚未満なら全部）**：
   ```js
   const need = Math.min(2, owner.hand.length);
   if (cards.length !== need) return state;   // ちょうど need 枚でなければ拒否
   ```
   **Sickness は `Math.min(3, hand.length)` にするだけ**。⚠2 の「手札0枚でも選べて何も起きない」とも整合する
   （`need` が 0 になり `cards.length === 0` で通る）。
3. **呪いは「山札の上へ」獲得**＝**`gain(state, pi, 'curse', 'deck')`**（`p.deck.unshift`）。
   日本語wiki が「捨て札置き場を経由せず」と明記＝**捨て札トリガーを1つも通さない**。**次のドローで引く。**
4. **⚠ 3枚は「同時に」捨てる**（日本語wiki の坑道×望楼の例）＝
   **`triggerOnDiscard(state, pi, [c1,c2,c3])` に配列でまとめて渡す**こと。
   1枚ずつ呼ぶと**坑道で得た金貨に望楼が反応できてしまう**（§0-29 の「ごますり(Sycophant)の3枚は同時に捨てる」
   と**まったく同型**＝そこで既に踏んでいる）。
   ⚠⚠ **ただし ⚠2b で挙げた `FORUM_DISCARD` を丸写しすると `triggerOnDiscard` が抜ける**＝
   **公共広場も民兵も、実際には `p.discard.push(c)` を直接呼ぶだけで `triggerOnDiscard` を呼んでいない**
   （私が node で再現して確認＝末尾の「⚠ 出荷済みの実バグ候補」参照）。
   日本語wiki は Sickness について **「手札を捨て札にすることに対して、【捨て札誘発リアクションカード】で
   リアクションすることはできる」**と明記しているので、**Sickness では必ず `triggerOnDiscard` を呼ぶこと**。
   **形は `FORUM_DISCARD`／中身は 辺境伯(`MARGRAVE_DISCARD`＝`triggerOnDiscard(state, pd.player, cards)` を呼ぶ)**
   を合わせるのが正解。
5. **ターン開始時の窓＝`t.startQueue` に積む**（`state.pending` 直代入をしない）。
   **ゲームのターン1（先頭手番）で開く必要は無い**＝予言は Sun が尽きて初めて有効になるので、
   §0-29 A3 の「先頭手番が素通りする」穴には該当しない。
   ⚠ ただし**川船・遅延・せっかちな 等でターン開始時に前兆が使われて有効化した場合、そのターンの開始時にも
   処理する**（日本語wiki 逐語）＝**有効化フックの直後に `t.startQueue` へ積めば自然にそうなる**が、
   **既に開始時キューを消化し終えた後**なら取りこぼす。**再開網（`popStartQueue` の安全網）を確認すること。**
6. **本アプリは「自分の手番終了時に次の手札を先引きする」**設計なので、
   ターン開始時には既に手札5枚がある＝**そこから3枚捨てる**（＝公式どおり）。
7. **捨て札トリガーはドローより先に解決する**（§0-28 の羊飼い・§0-30 の内気な で3回踏んだ順序）。
   Sickness 自体はドローしないが、**捨て札トリガーが引く/獲得することがある**。
8. **4点セット必須**＝新 pending（二択）＋`PLAYER_ACTIONS`＋CPU `decidePending`＋UI `viewPendingModal`。
   **CPU が `null` を返さないこと**（オンラインで `reduce(state, null)` が TypeError → 部屋が固まる）。
9. **CPU の判断**＝**呪いの山が空なら必ず「呪いを獲得」を選ぶ**（何も起きない＝常に最善）。
   **この分岐を入れないと CPU が毎ターン3枚捨てて自壊する**。
   呪いが残っているときは「呪いを取る」か「3枚捨てる」かの評価が要る（終盤は捨てる方が得なことが多い）。
10. **`ELDER_CHOICE_ORDER`（長老の追加選択）に登録しない**（予言はカードではない）。
11. **呪いの山が尽きると実質「無害な予言」になる**＝ゲームが長引く要因。fuzz の未終局に注意。
    ⚠ **全プレイヤーが毎ターン被害を受ける**ので、**呪い10〜30枚が一気に配られてゲームが伸びる**。
    invariants の 20000step 上限に当たらないか確認すること。
12. **⚠未確定＝支配(Possession)のターンの扱い**（Kind Emperor ⚠9 と同じ論点）。
    **英語wiki の `Sickness` ページに `Possession` の語は 0件**（私が機械検算した）＝**一次資料に無いので断定しない**。
    素直な読みは「支配ターンも被支配者のターン＝被支配者に窓が開く／捨てるのは被支配者の手札／
    呪いの獲得は §0-23 の方針どおり**支配者へ振り替わる**（`triggerOnGain(state, t.possessedBy, ...)`）」。
    ⚠ ただし**呪いを「支配者の山札の上へ」置くのは公式の `you gain instead` の帰結として自然**な一方、
    **本アプリの `gain(..., 'deck')` は被支配者の deck を触る**ので、支配の振り替えと dest の組み合わせを
    実装時に必ず確認すること。**mix-all 限定の到達**。

---

## 反映した訂正：4件（うち採用しなかった 0件）

| # | 重大度 | 内容 | 私の再検証 | 反映先 |
|---|---|---|---|---|
| 1 | [medium] | **Hasty は「同盟のトークン」ではなく「略奪(Plunder)の特性(Trait)」**。しかも本プロジェクトに**「せっかちな」として実装済み**で、カード文がほぼ逐語同一＝**Rapid Expansion の最良の前例**。英語wiki も RE を `makes all Actions and Treasures Hasty` と定義している | **確定**。`raw_Hasty.html` を私自身がパースし `Type: Trait / Set: Plunder` と Trait text を確認。`js/cards.js` の `hasty:{ name:'せっかちな', kind:'trait', expansion:'plunderexp' }`、`js/engine.js` の `hasty_aside`（獲得時＋キュー消化）を確認 | Rapid Expansion ⚠1・⚠2・⚠6（＋Hasty の FAQ 2件を追記） |
| 2 | [medium] | **「有効化の瞬間に何かが起きる予言は Kind Emperor だけ」は誤り**。**Divine Wind** も同型＝**汎用フックが要る** | **確定**。`raw_DivineWind.html` の Prophecy text を私自身が抽出＝`When you remove the last [Sun], remove all Kingdom card piles from the Supply, and set up 10 new random piles.` | 共通節「有効化の瞬間に何かが起きる予言は2枚ある」・Kind Emperor ⚠4 |
| 3 | [medium] | **公式ルール「Omens & Prophecies」5項目のうち `"+1 [Sun]" always appears first on Omens, before anything else the card does.` が落ちている**＝解決順序の規則で担当7種すべてに効く | **確定**。`v_pb_2.txt:1019` と `g8b_fetch3.txt:92` の**両方**に実在（＝収集者自身の fetch にも入っていた＝転記漏れ） | 共通節「有効になる」の定義（5項目に修正・★印） |
| 4 | [low] | **Panic の Preview 引用が省略記号なしで途中で切れている**。落ちた後半は「銅貨を買い戻せ／そのための購入権だ」＝収集doc自身の CPU 懸念に対する作者の回答 | **確定**。`raw_Panic.html:145` の生HTMLで全文を確認 | Panic の Trivia（全文に差し替え）・⚠12 |

**採用しなかった訂正＝0件**（4件とも一次資料で再現できた）。

### 検証docに無かったが、私が日本語wiki と repo で追加確認して足したもの（12件）
1. **Kind Emperor＝「神器」を採用確定**（収集docが「意味が合わない」と保留）＝**英語wiki の Japanese 行と
   日本語wiki 個別ページ・予言ナビの2ソースが一致**。テーマ訳と解する。
2. **ホビージャパン版差異**＝**私の7枚の日本語wiki ページには「余談」節が無い**（`余談`/`ホビージャパン` とも
   0件を機械検算）。依頼文が挙げた「進歩」も記載が見つからず＝**⚠未確定**として明記。
3. **Growth の "cheaper" は3成分**＝`costUnder` に**実際の pot/debt を渡さないと**公式例（賢者の石3+P→変成P／
   大金8+負債8→絵師 負債8）が再現できない。**既定 spec は `{pot:0,debt:0}`** なので明示指定が必須。
4. **Growth が参照するコストは「誘発した時点」＝獲得の後**（資本主義×漁師の例）。§0-30 の現場監督（獲得前）と逆。
5. **Growth の連鎖は単独では必ず終端する**（コスト単調減少）。作者の言う "a couple loops" は他カードとの
   組み合わせ＝**交易商人の置換ループ**を⚠推論として明記（日本語wiki の官僚制ページに同型ループの指摘あり）。
6. **Kind Emperor / Sickness の獲得は捨て札置き場を経由しない**（直接手札／直接デッキトップ）。
7. **Sickness の3枚は「同時に」捨てる**（坑道→金貨に望楼が反応できない）＝§0-29 ごますりと同型。
8. **Sickness は非アタックゆえ 灯台/チャンピオン/守護者/浮浪児 が効かない**が、
   **獲得誘発・捨て札誘発リアクションは働く**（日本語wiki が明示的に区別）。
9. **Panic の大量の追加裁定**＝追いはぎ/女魔術師/習性で効果が消えても発動／追放マット・酒場マットからの
   捨て札では戻さない／元手の負債は先に起きる／持続の契約書・法貨も戻る／
   **3山終了はターン終了時判定なので一時的な空は無視される**（本アプリの `isGameOver` 位置と整合）。
10. **Panic × `treasure_replay`** ＝ Panic 側に明示裁定は無いが、**Crown の公式FAQ `then play it again`** を
    根拠に「2回目も使用＝+2購入が2回」と読むのが自然、と**推論であることを明示**して記録。
11. **Progress / Rapid Expansion の「必ず失敗する」5経路**（身代わり／呪符の巻物／継続／召喚／侵略）
    ＝日本語wiki が名指し。本アプリの侵略実装（stop-moving）と同じ判定に乗るか要回帰テスト。
12. **Progress の dest 側 / triggerOnGain 側の実際の分類**を特定
    （`gain()` の `dest` 分岐 ／ `zoneOf` のコメントが挙げる7枚 ／ `onGainQueue` 組）。

---

## 完全性レビュー（`c_proph_b.md`）の反映

### 反映した [must]：3件／不採用：0件

| # | 指摘 | 私の再検証（`grep`／`Read`／node 実行） | 反映先 |
|---|---|---|---|
| 1 | **Sickness は「ちょうど3枚捨てる」＝民兵型の `discardDownEnter` を流用してはいけない**（日本語wiki 利用法が民兵と対比している） | **確定**。`jp/batch4.txt` の 病 ページ 利用法に該当文を確認（「民兵のような『3枚になるまで捨てる』ではなく『3枚捨てる』」）。`js/engine.js` の `function discardDownEnter(state, source, down, victims, next, drawAfter)` はコメント逐語で「手札N枚**まで**捨てる汎用アタック（民兵型）」＝流用すると公式より弱い。正しい前例 `case 'FORUM_DISCARD'`（`Math.min(2, hand.length)` にちょうど一致することを要求）も実コードで確認 | Sickness の日本語wiki 引用に「利用法」を追加＋**⚠2b を新設**（比較表つき） |
| 2 | **既存の連鎖上限 `_gainDepth > 6` に触れていない** | **確定**。`triggerOnGain` の冒頭に `state._gainDepth = (state._gainDepth \|\| 0) + 1; if (state._gainDepth > 6) { state._gainDepth--; return; } // 連鎖の暴走防止` を実コードで確認。**成長を `triggerOnGain` 内で直接 `gain()` する形で書くと作者の Preview の連鎖例が6段で切れる** | Growth **⚠5b を新設**（`onGainQueue` 必須の**2つ目の理由**として明記） |
| 3 | **`_gainDepth === 1 && !state.pending` ゲートの帰結が書かれていない**＝Growth／Kind Emperor の獲得では else-if 連鎖組の獲得時対話が1つも開かない | **確定**。`grep -n "_gainDepth === 1 && !state.pending" js/engine.js` ＝ **8箇所**（大釜／ヴィラ以下の連鎖の入口／狂戦士／幽霊城／海賊／納屋／複製／御守り）がすべてこのゲートを要求 | Growth **⚠11 を新設**／Kind Emperor **⚠7 に追記**（**許容簡略化として PROGRESS に書く**・else-if 連鎖を触らない） |

**不採用＝0件。**3件とも実コードで再現でき、**どれも「一次資料の不足」ではなく「本アプリの既存機構との
噛み合わせの不足」**＝放置すると実装が静かに公式とずれる種類のものだった。

### 拾った [nice]：9件（＝提示された9件すべて。ただし内容は私が実コードで裏取りして書き直した）

| # | 指摘 | 反映のしかた |
|---|---|---|
| 4 | Growth の Preview 引用（プラチナ→王の隠し財産→金貨…）が落ちている | Trivia に追加。**⚠5b（`_gainDepth > 6`）の判定シナリオとして使える**と紐づけた |
| 5 | Rapid Expansion の DZ 引用が省略記号なしで切れている（`JNails complained about how this messed up gain and play`） | Trivia を**全文**に差し替え。**⚠7（必ず失敗する5経路）の一次資料側の裏付け**として紐づけた |
| 6 | `js/engine.js`／`js/cards.js` の**行番号が14箇所すべてずれている**（＋`maskStateFor` の参照が別物） | **本文から行番号を全部外し、`grep` できる関数名・文字列だけにした**。`maskStateFor` の誤参照は「結論『公開』は正しいが参照先が違った」と明記して訂正 |
| 7 | Kind Emperor の候補述語は自作不要＝**`woodworkersCanGain` がそのまま使える** | ⚠1 を全面差し替え。`ALLY_WOODWORKERS` の**4点セット（窓の条件／終端保証／受理／UI フィルタ）の丸写しでよい**ことまで書いた。CPU 分岐も流用できると ⚠8 に追記 |
| 8 | Progress × オンラインの「同意なしの1手もどす」が死ぬ | Progress **⚠6b を新設**。`isNoConsentUndoableBuy` の該当比較を実コードで確認し、**急速拡大・厳冬は比較対象外で通る＝Progress だけが特異**であることも確認して書いた |
| 9 | Progress の topdeck 競合リストから **配達(Deliver)** ほかが落ちた | ⚠1 の `onGainQueue` 組に **`deliver_aside` と `hasty_aside`** を追加（どちらも `zoneOf` → `removeOne` 成功時のみ移す＝**既に stop-moving を実装している**ことを実コードで確認）。⚠5 の競合リストにも配達／役人／遊牧民の野営地／貨物船 を追加 |
| 10 | Rapid Expansion × **夜行(Night)カード**の扱いが落ちた | **⚠9b を新設**。実コードで人狼が `if (t.phase === 'night') … else attackWindowEnter(…, 'werewolf_draw')` と**自分でフェイズ分岐している**ことを確認＝ターン開始時（`phase==='action'`）に使わせても公式どおり「+3カード」になる＝**新たな対処は不要**。純粋な夜行カードは対象外であることも明記 |
| 11 | **支配(Possession)** での Kind Emperor / Sickness の扱いが無い | 両カードに **⚠未確定**として追加。`raw_KindEmperor.html` / `raw_Sickness.html` とも **`Possession` の語が 0件**であることを機械検算したうえで、**断定せず**に engine 側の論点（`t.possessedBy` の振り替えと `gain(...,'deck')` の組み合わせ）を書いた |
| 12 | 章をまたぐ相互参照2つ（種別の日本語「予言」／横型2枚制限に数えない） | 共通節「横型の新 kind」に**スキンのラベル文字列「予言 / Prophecy」**と**「合計2枚制限に数えない（第1章 §1-7）」**を追加。`state.prophecy` / `state.sunTokens` / `+1 Sun` の共通入口も**第1章が正本**と明記して重複を避けた |

---

## ⚠ 出荷済みの実バグ候補

### 1. **[確認済み・node で再現]** 民兵(Militia) と 公共広場(Forum) の捨て札が `triggerOnDiscard` を呼ばない
＝**坑道／村有緑地／忠犬／織工 の捨て札リアクションが発動しない**（忠実性バグ）。

- **場所**（行番号ではなく `grep` で開く）：
  - `js/engine.js` `case 'MILITIA_RESOLVE':` ＝ `discardCards.forEach((c) => { removeOne(p.hand, c); p.discard.push(c); });`
    のあと **`triggerOnDiscard` を呼ばずに** `advanceMilitia(state, pd);` へ進む。
  - `js/engine.js` `case 'FORUM_DISCARD':` ＝ `cards.forEach((c) => { removeOne(owner.hand, c); owner.discard.push(c); });`
    のあと同じく**呼んでいない**。
  - `js/engine.js` `case 'DISCARD_DOWN_RESOLVE':`（民兵型の汎用＝浮浪児/傭兵/サー・マイケル/軍団兵/剣/切り裂き魔）
    も同じ形で**呼んでいない**（コード読みで確認）。
- **対照＝同型の 辺境伯 は呼んでいる**：`case 'MARGRAVE_DISCARD':` は末尾で `triggerOnDiscard(state, pd.player, cards);`
  ＝**engine の中で非対称**（`grep -c "triggerOnDiscard(" js/engine.js` ＝ **60箇所**あり、大半の捨て札経路は呼んでいる）。
  ＝PROGRESS §0-25 の「捨て札トリガーは移動動物園内の経路にしか配線していない」という記述は**もう古く**、
  実態は「**ほとんど配線済みで、民兵系と公共広場だけ取り残されている**」。
- **出荷済み固定セットで到達する**（＝mix-all 限定ではない）：
  **`promo-pack`（プロモ全部入り）の王国は `militia` と `black_market` を両方含む**
  （`js/cards.js` の `kingdom: ['cellar','walled_village','envoy','dismantle','militia','hoard','governor','market','black_market','witch']`）。
  闇市場デッキは全 `POOLS` から作られる（`DOM.STAGE1_POOLS = []`）ので、**坑道・村有緑地・忠犬・織工が全部入る**。
  `random-promo`（basic＋intrigue＋promo）でも同じ組み合わせが出る。
- **再現（私が node で実行）**：
  ```
  promo-pack BMdeck size= 438 | tunnel= true village_green= true faithful_hound= true weaver= true
  kingdom militia= true black_market= true
  MILITIA  -> victim discard= ["tunnel","estate"] | gold? false     ← 金貨が来ない（公式は来る）
  MARGRAVE -> victim discard= ["tunnel","estate","copper","gold"]   ← 同型の辺境伯は正しい
  FORUM    -> own discard=    ["tunnel","estate"] | gold? false     ← 公共広場も来ない
  ```
- **公式の根拠**：坑道(Tunnel)＝`When you discard this other than during Clean-up, you may reveal it to gain a Gold.`
  ＝**片付け以外のどの捨て札でも誘発する**（民兵に捨てさせられた場合を含む）。
  村有緑地／忠犬も同じ `other than during Clean-up` 型。
- **修正**＝`MILITIA_RESOLVE` / `FORUM_DISCARD` / `DISCARD_DOWN_RESOLVE` の `forEach` の直後に
  **`triggerOnDiscard(state, pd.player, cards)` を1行**（**配列でまとめて渡す**＝同時に捨てる）。
  ⚠ **アタックによる強制捨て札なので、既存の同型（`MARGRAVE_DISCARD` や `TORTURER` 系）に合わせて
  `noPrompt` を付けるかどうかを揃えること**（`triggerOnDiscard(state, pi, cards, true)` の第4引数）。
  ⚠ **`p.discard.push` の直後に呼ぶと `advanceDiscardDown` / `advanceMilitia` の前に対話 pending が立ちうる**
  ＝アタックのキュー（残りの被害者）を握りつぶさないか要確認（§0-5 で神託／公爵夫人が**まったく同じ形で
  攻撃キューを潰した**前科がある＝そこで入れた「`triggerOnDiscard` 中は pending を保持する」ガードを見ること）。
- **本章との関係**＝**Sickness は日本語wiki が「捨て札誘発リアクションでリアクションできる」と明記している**ので、
  **`FORUM_DISCARD` を丸写しすると同じ穴を1つ増やすことになる**（Sickness ⚠4 に警告を入れた）。

### 2. **[推定・未確定]** `TAX_PILE` が「残り0枚の山」への負債配置を拒否している
- `js/engine.js` `case 'TAX_PILE':` の `if (!raw || NON_SUPPLY.has(raw) || (state.supply[raw] || 0) <= 0) return state;`
  ＝**空になったサプライの山を選べない**。
- 公式（徴税の英語wiki を私自身が `node tools/wikidirect.js "Tax"` で再取得）は
  `The Event itself, when bought, adds [2D] to a single pile, whether or not that pile has any [D] on it already.`
  としか書いておらず、**「空の山に置けるか」の明示裁定は無い**。
  一方 **冒険の教師(Teacher)は「空のアクション山にも置ける」が公式**（§0-9 の敵対レビューで確定し
  `validTeacherPiles` から残枚数条件を外した前例がある）＝**同型なら Tax も置けるはず**。
- **⚠ 一次資料で確定できないので「バグ」とは断定しない**。ただし**厳冬(Harsh Winter)は日本語wiki が
  「空になったサプライの山札の上にも負債は置かれる」と明記している**ので、
  **厳冬をこの `TAX_PILE` のガードごとコピーすると確実に公式と食い違う**（Harsh Winter ⚠5 に警告済み）。

---

## 枚数の検算

- **担当7枚／書いた7枚**＝Growth・Harsh Winter・Kind Emperor・Panic・Progress・Rapid Expansion・Sickness
  ＝**一致**（重複0・捏造0）。
- **英語カード文**＝7/7 を生HTMLの `Prophecy text` セルから**私自身が再抽出**して一致を確認。
- **日本語カード文（DO訳）**＝7/7 を `g0_jp_pairs.md`（出典＝日本語wiki 個別ページの
  `(※日本語訳はDominion Onlineより)` 表）から取得＝**欠落0**。
- **区切り線**＝7/7 とも **0本**（`<hr` を機械計数）。
- **版**＝7/7 とも English versions は**1行のみ**／`First edition`／`August 2024`＝**機能エラッタ 0件**。
- **種別**＝7/7 とも `Prophecy` の1語のみ＝**Attack 0枚**（堀で防げるものは1枚も無い）。
- **公式FAQ**＝7/7 を生HTMLから再抽出（Other rules clarifications は**有り5枚**＝Harsh Winter／
  Kind Emperor／Panic／Progress／Rapid Expansion、**無し2枚**＝Growth／Sickness）。
- **日本語wiki 詳細なルール**＝**7/7 とも取得済み**（成長／厳冬／神器／狼狽／進歩／急速拡大／病）。
- **id 衝突**＝7/7 とも既存 761 id（`DOM.CARDS` 560＋`DOM.LANDSCAPES` 201）と衝突 **0件**。
- **⚠ 実装で危ないところ**＝7/7 とも記載あり（**空・薄いものは 0枚**）。今回の反映で
  Growth 10→**12**／Harsh Winter 12／Kind Emperor 8→**9**／Panic 13／Progress 8→**9**／
  Rapid Expansion 13→**14**／Sickness 11→**13**（＝**合計 75→82 項目**・機械計数）。
- **本アプリの機構名の実在確認**＝本文で名指しした
  `costUnder` / `costLT` / `gainableBase` / `costOf` / `isTreasureFor` / `isTypeSupply` / `pileKeyOf` /
  `returnToPile` / `canReturnToPile` / `zoneOf` / `allCards` / `triggerOnGain` / `triggerOnDiscard` /
  `discardDownEnter` / `woodworkersCanGain` / `hasTrait` / `playCardNoAction` / `maskStateFor` /
  `isNoConsentUndoableBuy` / `_gainDepth` / `p.eventSetAside` / `p.deliverAside` / `state.pileDebt` /
  `hasty_aside` / `EVENT_PLAY` / `FORUM_DISCARD` / `MILITIA_RESOLVE` / `MARGRAVE_DISCARD` / `TAX_PILE` /
  `ALLY_WOODWORKERS`＝**30個すべて `grep` で実在を確認**（**存在しない関数名・フラグ名は書いていない**）。
  ⚠ ただし **`hasProphecy` だけは「これから新設するもの」**（`hasTrait` と同型）＝**現時点では存在しない**と明記した。
- **レビュー反映**＝**[must] 3/3 反映・不採用0／[nice] 9/9 反映**（内容はすべて私が実コードで裏取りし直した）。

## ⚠ 未確定として残したもの（推測で埋めていない）
1. **Panic の +2購入が `treasure_replay`（冠/ティアラ/偽造通貨/王の隠し財産の2回目以降）でも出るか**
   ＝Panic 側に明示裁定なし。Crown の公式FAQ からの**推論**として書いた（断定していない）。
2. **Rapid Expansion の脇札が公開か伏せか**＝`Rapid Expansion` にも同文の `Hasty` にも明示なし。
   **既存の `p.eventSetAside`（公開）に合わせる**という実務判断で回避できる。
3. **「進歩」のホビージャパン印刷版テキストの差異**＝依頼文の指摘に対応する記載を日本語wiki で発見できず。
4. **Rapid Expansion で「使用できないカード」（Territory 等）を場に出すか**＝Hasty の公式FAQ からの類推
   （Hasty は「場には出るが何もしない」）。Rapid Expansion 自身のページには記載が無い。
   ※ 本アプリの `playCardNoAction` は脇からの使用では実質つねに成功する＝**自然に「場には出る」側になる**
     （実コードで確認）＝実装上の争点にはならない見込み。
5. **【レビュー反映で追加】支配(Possession)のターンでの Kind Emperor / Sickness の扱い**
   ＝英語wiki の両ページに `Possession` の語が **0件**（機械検算）。厳冬だけ公式FAQ が明示している。
   **mix-all 限定の到達**＝実装時に決めて PROGRESS に書く。
6. **【レビュー反映で追加】`TAX_PILE` が空の山を拒否しているのが公式どおりか**
   ＝英語wiki の Tax ページを再取得したが明示裁定なし（上の「出荷済みの実バグ候補 2」参照）。
   **厳冬側は日本語wiki が「空の山にも置く」と明記しているので、厳冬の実装はそちらに従う。**
