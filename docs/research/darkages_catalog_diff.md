# 暗黒時代カタログ差分レポート（js/cards.js vs 公式現行テキスト）

対象: `c:\Users\b1242\claude\game\dominion\js\cards.js` 455〜606行あたり（暗黒時代56枚＝王国34種+騎士擬似1+騎士10+廃墟5+避難所3+非サプライ3）。
比較基準: 研究データ `darkages_rules.json`（RGG公式ルールブック2020版PDF＋wiki/miraheze＋Donald X 2019/2022エラッタ記事で裏取り済み・verdicts 14件全confirmed）。
結論: **コスト違いは0件**。**エラッタ未反映4枚＋効果文欠落1枚＋種別不足4枚**が確定差分。

---

## A. 確定差分（重要度順・段階2着手前に必ず修正）

### 【高1】hermit（隠遁者・L465）— 2022年エラッタ未反映
- 現カタログ: 「これを場から捨てるとき、このターンにカードを**購入**していなければ、これを**廃棄して**狂人1枚を**獲得**する。」＝旧2012版。
- 公式現行: 「**このターンの購入フェイズ終了時、その中でカードを1枚も獲得していなければ**、これを狂人と**交換**する。」
- 3点変更: (1)トリガー=場から捨てる時→購入フェイズ終了時 (2)条件=buy基準→**gain基準**（購入以外の獲得でも交換不可） (3)trash+gain→**exchange**（隠遁者は隠遁者の山へ戻る・獲得時効果は誘発しない・Madman山が空なら交換ごと不発）。
- 前半のテキストは現行どおりでOK（捨て札置き場から非財宝廃棄・$3以下獲得）。

### 【高2】procession（行進・L481）— 2019年エラッタ未反映
- 現カタログ: 「手札の**アクションカード**1枚を2回プレイしてよい。…」
- 公式現行: 「手札の**持続でない(non-Duration)アクションカード**1枚を…」。持続カードを対象にできない（獲得するカードは持続でも可）。
- 混成王国（random系）で海辺の持続と同居し得るため実プレイに直結。

### 【高3】pillage（略奪・L545）— 2019年エラッタ未反映
- 現カタログ: 「これを廃棄する。\n戦利品2枚を獲得する。\n…捨て札にする。」＝無条件列挙（旧版）。
- 公式現行: 「これを廃棄する。**そうしたら（If you did）**、戦利品2枚を獲得し、手札5枚以上の他プレイヤーは…」＝**廃棄できなかったら Spoils もアタックも一切起きない**（玉座2回目・命令経由プレイ等）。

### 【高4】death_cart（死の荷車・L491）— 2019年エラッタ未反映＋Looter種別欠落
- 現カタログ: 「手札のアクションカードか死の荷車1枚を廃棄して +5 コイン**（廃棄しないならこれを廃棄する）**。」→括弧部分は旧2012版の強制自己廃棄の名残＝**現行に存在しない**。
- 公式現行: 「これか手札のアクションカード1枚を廃棄してもよい。**廃棄した場合のみ +$5**。」＝廃棄は完全任意・しなくてもペナルティ無し（+$5も無し）。
- types: `['action']` → **`['action','looter']`**（公式 Action–Looter）。

### 【高5】rats（ネズミ・L487）— on-trash効果文が欠落
- 現カタログの text に **「これを廃棄したとき、+1 カード。」が無い**（廃棄時に持ち主が1枚引く。誰のターン・誰の廃棄でも発動）。
- 段階2の実装ノート: 山は**常に20枚**（人数不問・通常の10枚ではない）。

### 【高6】counterfeit（偽造通貨・L549）— 2022年エラッタ未反映
- 現カタログ: 「手札の**財宝カード**1枚を2回使用してよい。」
- 公式現行: 「手札の**持続でない(non-Duration)財宝**1枚を…」（Counterfeit/Mint/Crypt 一括変更）。
- 本アプリは海辺2版のアストロラーベ（財宝-持続）を実装済み＝random混成で可到達。「これを使用したとき、」の前置きも現行では削除（軽微）。

### 【高7】cultist / marauder — Looter種別欠落
- cultist（L547）: `['action','attack']` → **`['action','attack','looter']`**。
- marauder（L493）: `['action','attack']` → **`['action','attack','looter']`**。
- Looter持ちは公式に **cultist / death_cart / marauder の3枚で全部**。Looter=「廃墟の山を使う」トリガー種別なので段階2で機能的に必須。carddata の typeLabel/typeLabelEn に looter 複合ラベル（例: アクション・アタック・略奪者 / Action-Attack-Looter）＋integrity の JP/EN マップ登録も必要（種別ラベル網羅テストが赤になる）。

### 【中8】band_of_misfits（はみだし者・L539）— Command種別欠落
- `['action']` → **`['action','command']`**（2019エラッタで Action–Command 化）。テキスト自体は現行どおり（「サプライに置いたまま使用」）でOK。
- carddata に「アクション・命令」複合ラベルが必要（既存は王子/船長の「アクション・持続・命令」のみ）。engine 的にも Command同士の相互プレイ禁止・王子/船長の対象除外（非Command条件）に効くので種別付与は必須。

---

## B. 軽微（表示・文言ニュアンスのみ／機能差なし）

1. **dame_josephine（L561）の種別順**: カタログ `action, attack, knight, victory` ／ 公式表記順 `Action – Attack – Victory – Knight`。表示ラベルの並びだけの問題。
2. **騎士共通文（10枚）**: 現行英文は「trashes one of them **that they choose** costing from $3 to $6」＝**廃棄する1枚は公開した本人（被害者）が選ぶ**が明文。カタログ和文は選択者が曖昧（「その中からコスト3～6のカード1枚を廃棄し」）。文言に「（本人が選ぶ）」を足すか、少なくとも実装で被害者選択にすること（両方$3-6の時のみ選択権）。
3. **非サプライ3枚（spoils/madman/mercenary）**: 公式の「(This is not in the Supply.)」注記なし。プール管理で表現されるなら省略可。
4. **knights 擬似カード（L555）の cost:5 固定**: 実際の山の購入コストは「一番上の騎士のコスト」（Sir Martin時は$4）。段階1表示用としては可だが、段階2で動的コスト必須。
5. **和名の要再確認（低・研究データは参考表記と明記＝未裏取り）**: forager=探索者（公式訳は「採集者」の可能性）／market_square=青空市場（「市場の広場」）／scavenger=拾い屋（「ゴミあさり」）／vagrant=放浪者 vs urchin=浮浪児 の訳し分け。既存webp画像の文字と連動するため、直すなら画像再生成とセットで判断。

## C. 差分なしを確認したカード（現行テキスト一致）
poor_house / squire / vagrant / beggar / sage / forager / storeroom / urchin / market_square / ironmonger / wandering_minstrel / scavenger / fortress / armory / feodum / junk_dealer / bandit_camp / rebuild / catacombs / graverobber / count / mystic / rogue / hunting_grounds / altar / 騎士10種の個別上段効果 / 廃墟5種 / 避難所3種（hovel は2022エラッタ「獲得時」を**反映済み**で正しい）/ spoils / madman / mercenary。コストも全カード公式一致（sir_martin=4含む）。

## D. カタログ外だが段階2で効く setup 事項（研究データより）
- 廃墟山: 5種50枚シャッフル→**10×(人数-1)枚**・一番上のみ表/獲得可・サプライ扱い（3山終了に数える）・$0で購入可。
- 騎士山: 10種各1シャッフル・一番上のみ購入/獲得・**サプライの1山**（3山終了に数える）。
- 避難所: 王国の暗黒時代比率でランダム採用（全暗黒時代なら必ず）・開始デッキ=銅貨7+避難所3（屋敷置換・屋敷サプライは不変8/12）。
- 非サプライ: Spoils **15枚**・Madman 10・Mercenary 10（購入不可・汎用獲得不可・空でも山切れ判定に数えない）→§6「4系統除外チェックリスト」必須。
- feodum / overgrown_estate は vp フィールド無し＝可変VP(銀貨/3)と0VPを vpOf/vpOfPlayer 側で扱うこと（overgrown_estate は0VPでも「勝利点カード」参照に数える）。

## E. verdicts で corrected になった主張
- **なし（14件全て confirmed）**。よって darkages_rules.json は text_en/rulings 無修正で整形保存（唯一、source内の Windowsパス `scratchpad\darkages_rules.txt` が JSON不正エスケープだったため `scratchpad/darkages_rules.txt` に修正）。

## F. 残る unresolved
1. **複数Urchin同時トリガー**（interactions #9・confidence: medium）: 場にUrchin2枚+別アタック1枚プレイで両方廃棄→傭兵2枚が可能かの個別明文は未発見。一般則からは可＝「各Urchinごとに任意廃棄」で実装するのが安全。
2. **Pillageの解決順の公式内不整合**: カード文言=Spoils獲得→アタック／ルールブックFAQ=アタック→Spoils獲得。被害者への影響は皆無。**現行テキスト順（廃棄→Spoils2枚→アタック）を推奨**。
3. **公式和訳（和名・推奨セット名）は本調査スコープ外**（研究データが参考表記と明記）。上記B-5の和名4-5件は必要なら別途裏取り。
4. Marauderのrulingsに「Spoils総数15はページ上で未確認」との注記が残るが、setup #6/ Bandit Camp項でルールブック内容物リスト「15 Spoils」を確認済み＝**15枚で確定**（実質解決済み・データ内注記のみ残存）。
