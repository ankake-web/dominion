# 進捗（PROGRESS） — ドミニオン Webアプリ

最終更新: 2026-07-01 / branch `main`。**監査⑥＝プロパティベース不変条件テスト（カード保存則）を新設し、闇市場のカード消失バグ1件を発見・修正＝コミット&push待ち**。
**テストは18スイート・2409件緑**（`test/invariants.test.js` を新設）。

### 監査⑥：プロパティベース不変条件テスト（カード保存則）で闇市場のカード消失を発見・修正（2026-07-01）
- **手法**：CPU対CPUを大量(敵対的キングダム＋全プール混成960戦)に走らせ、安定点(pending null)ごとに **カード保存則**（各カードidの総数＝supply＋trash＋全ゾーン＋blackMarket＋支配一時 が開始時から不変）・supply非負・'back'非混入・vpTokens非負 を検証。→ **保存則違反2件（同一原因）を検出**。
- **発見バグ：闇市場の財宝プレイで公開カードが消失**：`BLACK_MARKET_PLAY_TREASURES` が財宝を `forEach` で無条件に全出しし、途中で「使ったとき」に pending を立てる財宝（投資/金床/水晶玉/ティアラ/ペテン師）が **闇市場 pending を上書き**→公開中の3枚が取りこぼされ消失していた（`PLAY_ALL_TREASURES` は `if(pending)break` で防いでいたが闇市場側は未対応）。→ **1枚ずつ出し、闇市場 pending が上書きされたら公開カードを闇市場デッキへ戻してから、その財宝 pending の解決に譲る**（今回の闇市場購入は中断）よう修正。
- **到達性**：`black_market` は promo、pending財宝は prosperity で出荷セットでは共存しない＝**現状は到達不能**だが、修正は shipping では no-op（`state.pending !== pd` 分岐は踏まない）で低リスク。混成モード追加時の堅牢性を確保。
- **大規模tail-hunt(3000戦)で2つ目のバグを発見：宝の地図(treasure_map)の複製**：`treasure_map` の効果が `removeOne(inPlay,'treasure_map'); state.trash.push('treasure_map')` と**無条件にtrashへpush**していたため、玉座の間/王の宮廷の2回目プレイ（1回目で既に廃棄済みで場に無い）で**存在しない宝の地図を1枚生成**していた（保存則違反 10→11）。→ **「これ」が場に無ければ何もしない**（`if(!removeOne(inPlay))break`）よう修正。これはルール的にも正（玉座2回目は「これ」を廃棄できないので効果なし）。到達性＝宝の地図(海辺)と玉座/王の宮廷(基本/繁栄)は出荷セットで共存せず現状到達不能だが、低リスクな複製修正。
- **支配(Possession)の保存則も検証**：CPUは支配を買わないため通常フェーズでは踏まれない最複雑機構（actorルーティング/gain・trash精算/追加ターン/cleanup）を、手で支配を発動させて120戦検証→**保存則違反0**（gain/trash精算・cleanupが保存則を守ることを確認）。恒久テストにも支配強制12戦を追加。
- **恒久ガード新設 `test/invariants.test.js`**：敵対的キングダム(玉座/王の宮廷×宝の地図/闇市場×pending財宝 等)＋全プール混成＋出荷セット各種＋支配強制で保存則等を毎回検証（決定論シード）。今後あらゆる状態破壊（カード複製/消失）を即検知する。`npm test` は17→**18スイート・2410件緑**。`sw.js` v22→**v24**（engine.js のキャッシュ更新）。


公開: GitHub Pages https://ankake-web.github.io/dominion/ （クライアント）＋ Render（オンライン対戦サーバ）。
**新セッションは まず `npm test` を実行し 2406件オールグリーンを確認**してから着手すること（17スイート）。

### 多エージェント監査④：UI/UXの詰み・クラッシュ・誤誘導を修正（2026-07-01）
- **監査手法**：Workflow で4次元（モーダル詰み/手番フロー/初心者モード/描画・モバイルa11y）を並行監査→敵対的検証（17エージェント）。13件検証→**確定8件（重複除き6種）**。共通テーマ＝**支配(Possession)UIが一部で「支配者の手札/pending」を見て被支配者を見ていなかった**（viewActionBar等は修正済みだったが maskStateForの看破秘匿・maybeAutoSkipAction・coachHint が漏れていた）。
- **#U1（high・crash）オンライン支配中に被支配者が衛兵/見張り/水晶玉を出すと支配者の画面がrender例外で固まる**：`maskStateFor` が看破札(sentry/lookout の cards・crystal_ball の card)を `pending.player` 以外に 'back' 化するが、支配中の決定者は支配者(possessedBy)なので支配者に 'back' が届き、UIが未知id 'back' を描画して TypeError→画面フリーズ。→ `maskStateFor` を**決定者(支配中は支配者)にも看破を開示**するよう修正（`secretSeer`）＋**cardEl に未知idの伏せカード・プレースホルダ防御**を追加（将来の類似欠落でも巻き込みクラッシュしない）。
- **#U2（med）支配中のアクション自動スキップが支配者の手札で判定**：`maybeAutoSkipAction` が `actor`(=支配者)の手札を見て、被支配者にアクションがあっても勝手に購入フェーズへ飛ばし操作権を奪っていた。→ 被支配者(t.active)の手札で判定（viewActionBar と同じルーティング）。
- **#U3（med）初心者コーチ案内が支配中に支配者の手札を見て誤誘導**：`coachHint` を被支配者の手札に揃えた。
- **#U4（med・playability）闇市場で得たサプライ外カードが手札に描画されず操作不能**：`handGroups` が `SUPPLY_ORDER` に無いidを全グループから落としていた（ポーションと同じ穴）。→ 手札の全idを網羅（順序外idは後ろに追加）。
- **#U5（low）秘密の小部屋の戻し説明が手札1枚時に「2枚」と誤表示**：動的化。
- **#U6（low）おすすめ買いが植民地/プラチナ(繁栄)を提案しない**：`recommendedBuys` に colony/platinum＋ポーション費用判定を追加。
- **検証**：回帰テスト7件追加（engine +5＝支配中の看破開示マスク、ui +2＝サプライ外カードの手札描画）。**全2406件緑（exit 0）**。`sw.js` v21→**v22**（engine.js/ui.js のキャッシュ更新）。

### 多エージェント監査③：カード表示（種別ラベル/ポーション表示）を修正（2026-07-01）
- **監査手法**：Workflow で3次元（データ導出/実行時描画/画像生成）を並行監査→敵対的検証（14エージェント）。11件検証→**確定3種**（重複除く）。
- **#C1（誤表示）ペテン師(charlatan)の種別が「アクション・アタック」**：types=`['treasure','attack']` だが `carddata.js` の `typeLabel`/`typeLabelEn` が先頭一致 return で財宝を考慮せず attack 分岐に落ちていた。→ `財宝・アタック / Treasure - Attack` に修正。
- **#C2（誤表示）会計士(clerk)の種別からアタック脱落**：types=`['action','attack','reaction']` だが reaction 分岐が先に一致し「アクション・リアクション」＝attack欠落。→ `アクション・アタック・リアクション / Action - Attack - Reaction` に修正（3種type分岐を追加）。
- **#C3（プレビューのみ）実行時SVG描画(cardview)にポーション費用表示が無い**：`cardview.js` のコストバッジがポーション費用を出さず、錬金術のポーション費用カードが無料に見えた。**ただし盤面/拡大は webp（フラスコ焼込済＝正しい）を使うので影響は cards.html プレビューのみ**。→ `buildDisplay` に `potion` を透過＋`cardview` のコストに紫フラスコ🧪を重畳。
- **重要な構造の把握**：**盤面/拡大表示は `asset/cards/<id>.webp`（焼込画像）を `<img>` 表示**（ui.js:185/1492/1511）。`cardView` の SVG は cards.html プレビュー専用。よって #C1/#C2 の**盤面表示を直すには webp 再生成が必要**だった。
- **webp再生成（このPCで実施）**：puppeteer＋ローカルアート（`asset/art/charlatan.png`/`clerk.png`）＋マスター枠が揃っていたので `CARDS_OUT=<temp>` で全117枚を temp に生成し、**charlatan.webp と clerk.webp の2枚だけを本番へコピー**（差分を最小化）。目視で正しいラベルを確認済み。
- **回帰テスト**：`integrity.test.js` に**種別ラベルが全 type を落とさない網羅チェック**（＝charlatan/clerk 型のバグを構造的に検知）＋ポーション費用の単一ソース透過チェックを追加。**全2399件緑（exit 0）**。`sw.js` v20→**v21**（carddata.js/cardview.js/webp2枚のキャッシュ更新）。
- **棄却された所見**：pirate/blockade 等の枠色・ラベル長オーバーフローは問題無し（既存の縮小ループで収まる）。charlatan の枠色（attack=赤）は「攻撃財宝は攻撃扱い」の設計意図として維持（ラベルのみ修正）。

### 多エージェント監査②：オンライン対戦層の情報漏洩/DoSを修正（2026-07-01）
- **監査手法**：Workflow で5次元（マスク漏洩/不正対策/権限/再接続トークン/クライアントdesync）を並行監査→各所見を「悪意ある改造クライアント」脅威モデルで敵対的検証（12エージェント）。7件検証→**4件確定**。**不正対策(anti-cheat)は exploit 無し**＝reducer が client 由来ペイロードを実状態に照らして検証しており、細工した action で勝敗を歪める穴は無いことを確認（棄却：resumeレート制限/dc席5分停止/獲得系のポーション費用＝いずれも問題無し）。確定4件はいずれも severity=low（カジュアル対戦アプリ）だが実在するため修正。
- **#O1（info-leak）水晶玉の看破カードが相手席にも配信**：`state.pending={type:'crystal_ball',card:deck[0]}` は使用者だけの私的看破（reveal していない）なのに `maskStateFor` に伏せる分岐が無く、配信JSONを覗くと使用者の山札トップ（keep 時は次に引く札）が判明。→ sentry/lookout と同型の分岐を追加し所有者以外には `card:'back'`。
- **#O2（info-leak）自分の山札が順序込みで配信され「次に引く札」が透視できる**：`maskStateFor` の自席分岐 `return p` が deck を順序込みで返していた。公式でも自山札の順序は不可視。→ **自席 deck を id ソートして配信**（中身・枚数は保持＝自分の得点 `vpOf` 表示は不変、順序だけ消す）。権威stateはサーバが完全順序で保持し reduce もサーバ側＝クライアントは reduce しないので実害なし。（当初 'back' 全伏せにしたら自分の得点計算 `vpOf(handP)` が壊れたため、順序のみ隠すソート方式に修正。）
- **#O3+O4（DoS）ルームコード枯渇/部屋リーク**：4桁コード(1万)＋ロビー猶予60sで、create→即切断を大量反復するとコード空間を占有し得た。→ (a) `scheduleRelease` で**未開始かつ無人になるロビーは猶予を待たず即破棄**（create→即切断の占有を封じる）＋(b) `MAX_ROOMS=2000` の同時部屋上限（メモリ/コード空間の有界化）。開始後や複数人ロビーは従来どおり猶予で復帰可。
  - **追補（監査⑦・自己修正）**：上記(a)の即破棄が `restoreRoom`（サーバ再起動時の復元）でも発火し、**復元直後の未開始ロビー**（全員未接続で始まる）を即破棄してしまう回帰を発見。→ `scheduleRelease(room, member, allowImmediate)` に引数追加し、**restoreRoom からは `false`** を渡して即破棄を抑止（復元は従来どおり猶予で resume を待つ）。ライブ切断（DoS対象）は既定 true のまま。server テストに復元ロビー非破棄の回帰テストを追加（47→49件）。
- **検証**：回帰テスト9件追加（engine +7＝自席山札のソートマスク/水晶玉の看破秘匿、server +2＝ロビー空室の即破棄）。**全1876件緑（exit 0）**。`sw.js` v19→**v20**（engine.js のキャッシュ更新。server/gameServer.js は Render 自動デプロイ）。
- **未対応（意図的）**：自席 deck の「中身(構成)」は公式でも既知なので配信する（順序のみ秘匿）。より厳密にするなら山札上公開系を全て pending 経由に寄せて deck 完全秘匿も可能だが、得点表示との両立コストに見合わないため見送り。

### 多エージェント監査（ultracode）で発見した確定バグ5件を修正（2026-07-01）
- **監査手法**：Workflow で8次元（拡張別＋CPU＋UI/online＋コア）を並行監査→各所見を独立スケプティックが実コードで敵対的に反証（18エージェント）。10件検証→**real&確信度≥medを5件確定**。反証で棄却＝支配の非Alchemy self-trash永久廃棄／改築系のポーション費用無視（いずれも出荷構成で到達不能）／ペテン師=銅貨（テキスト通りで正しい）／徒弟×石切場（石切場は継続割引で正しい）／玉座で持続複製（実害なし）。
- **#B1（high・修正）泥棒(thief)王国のCPU戦が永久に終わらない**：泥棒が財宝を単調に廃棄→全員コイン0・購入0・パイル不変で `isGameOver` が永久false（オンラインCPU部屋も無限ループ）。対策＝(a)**CPU経済底上げフォールバック**（`chooseBuy`：財宝密度が低く何も買えない局面では最安財宝＝銅貨を必ず買い経済再建＋パイル消化。健全なデッキでは非発動）＋(b)`pickChapelTrash` を財宝が乏しければ銅貨を削らない＋(c)**エンジンの安全網**（`isGameOver`：どのプレイヤーも150手番に達したら現状スコアで打ち切り＝`scoreGame` reason「膠着のため打ち切り」）。泥棒は1E仕様で「公開財宝を必ず1枚廃棄」＝ルール正なので廃棄自体は変えない。検証：泥棒王国 全構成(2-4人×3難易度)終局・最長150手番。全プール混成500戦0詰み0no-op・最長71手番・安全網発動0（＝通常対戦には一切影響しない真のバックストップ）。
- **#B2（med）会計士を手番開始時に2枚以上使うと2枚目以降が消える**：1枚目のアタックが山札上置きの pending を立てると `clerk_start` が startQueue に取り残された。対策＝`clerkEnterVictim` のアタック終端を `popStartQueue` に（通常/玉座プレイは startQueue=null で pending=null と等価＝無害）。
- **#B3（med）ティアラでペテン師を2回使うと2回目のアタックが出ない**：`treasureReplayCoins` がコインしか再適用しなかった。対策＝2回目に 収集の+1購入・ペテン師のアタック（1回目が反応待ちでない時だけ再発火＝pending衝突回避）・銀行/賢者の石の動的コイン・ポーションのトークンも再適用。
- **#B4（med）水晶玉で山札上の財宝を「使う」と特殊効果/動的コインが失われる**：`t.coins += treasureCoins` だけで銀行/賢者の石の動的コイン・ポーショントークン・ペテン師のアタックが発動しなかった。対策＝財宝は `playTreasureCard` に委譲（手札を一旦経由）して「使ったとき」効果を完全再現。
- **#B5（low）同一プレイヤーが同名に複数の封鎖を伏せると呪いが1枚しか出ない**：`find`→`filter` にして封鎖1枚につき呪い1枚（免疫はエントリ個別判定）。
- **検証**：回帰テスト11件追加（繁栄+8＝ティアラ×ペテン師2回/会計士2枚/水晶玉ペテン師、海辺+1＝封鎖×2、CPU+2＝泥棒終局・安全網）。**全1867件緑（exit 0）**。`sw.js` v18→**v19**（engine.js/cpu.js はクライアント配信＝キャッシュ更新のため）。UI(ui.js)は不変。

### 海辺の簡略化2点を本格実装＋混成王国CPU購入バランス調整（2026-07-01）

### 海辺の簡略化2点を本格実装＋混成王国CPU購入バランス調整（2026-07-01）
- **コミット&push済（`8235b32`）**。Pages/Render は自動デプロイ。`sw.js` v17→**v18**（ui.js にリアクションモーダル2種を追加したため）。テスト **1856件緑**（海辺 85→100・海辺UI 22→24 に増、他は不変）。
- **#2a 封鎖（Blockade）の「堀で免疫」窓を本格実装**：封鎖はアタックカードなので、プレイ時（脇置き後）に各相手へ反応窓を出す（`blockadeEnterVictim`＋`ATTACKS.blockade` 登録）。堀/秘密の小部屋/外交官の反応窓を共用（`hasReaction`）。**堀を公開した相手／灯台で免疫の相手**は、その封鎖の予約 `delayedEffects` の `immune:[]` に席番号を登録（`markBlockadeImmune`）。呪い窓（他人が同名獲得→呪い）は `!(bl.immune||[]).includes(pIndex)` で免疫者をスキップ。新reducer `BLOCKADE_REACT`（堀を出さず受ける＝免疫なしで次へ）。`BLOCKADE_GAIN` はarm時に `immune:[]` を持たせ、獲得後に窓を起動。
- **#2b 海賊（Pirate）の財宝獲得リアクションを本格実装**：`triggerOnGain` の末尾で「財宝を獲得したとき・`_gainDepth===1 && !pending`（＝トップレベルの安全な獲得）」に `pirateReactWindow` を起動。手番順（獲得者を含む）に、手札に海賊を持つ各プレイヤーへ「使う/使わない」窓（`pirate_react` pending）。使うと海賊を手札→場に出し `armDuration(pirate)`＝相手の手番中でも本人の次手番開始で発火（`cleanupAndAdvance` は手番主のみ処理するので、リアクションで出た海賊は本人の次クリーンアップで正しく捨て札化）。新reducer `PIRATE_REACT`。複数人連鎖・使わない選択も可（詰まらない）。
- **設計上の安全側**：海賊窓は `!pending && _gainDepth===1` のときだけ発火（船乗り/物見やぐら/ティアラ等の既存on-gainフックと同じゲート）。深い入れ子（他アタックのgain中・pirate_gainの獲得中・隠し財産の金貨獲得＝depth2）では発火しない簡略化。ごく稀な取りこぼしのみで、pending衝突/CPU無限ループ/人間の詰みを回避。
- **CPU/UI**：`decidePending` に `blockade`(react=堀/受ける)・`pirate_react`(常に使う＝タダのテンポ)を追加。`viewPendingModal` に封鎖リアクション（`reactOptions`）・海賊リアクション（使う/使わない）を追加。`PLAYER_ACTIONS` に `BLOCKADE_REACT`/`PIRATE_REACT` 追加（整合性テスト一致）。オンラインは actor()＝pending.player で自然に反応者へルーティング（サーバ無改修）。
- **#1 混成王国のCPU購入バランス**：`chooseBuyNormal`/`chooseBuyStrong` はビッグマネー偏重（属州/金貨/銀貨/公領/市場/鍛冶屋のみ）で、繁栄×海辺などの強王国で**王国カードをほぼ買わない**（実測：繁栄+海辺で王国カード比率0-5%）ことを計測で確認。→ **`bestEngineBuy`** を追加：カードtextから「+Nアクション」を読み非ターミナル判定、村/研究所型は積み増し（≤4）・ターミナルは村数+1まで（衝突回避）・王国財宝≤2、GAIN_ORDERの強さ順で最良1枚。緑化前（属州>3〜4）に金貨の次点として購入。**支配(possession)はCPUが扱えないので除外**。
- **#1 検証**：混成3種×難易度総当りを計測→王国カード比率が **0-5%→15-24%** に上昇、難易度序列(hard>normal>easy)を維持・全戦終局。**新hard vs 旧hard のA/B（同engine・decideのみ差替え）で 64%/93%/64% と新CPUが勝ち越し**（＝購入変更で絶対的に強化）。default王国の真の勝率も hard vs normal≈58%・hard vs easy≈93%・normal vs easy≈86%（各300戦）で健全。全プール混成ランダム王国 **400戦0詰み0no-op**。
- **`test/cpu.test.js` を決定論化（重要な副次修正）**：このファイルだけ RNG 未シードで、勝率テストが40戦・少サンプルのため真の勝率(hard vs normal≈58%)でも稀に45%を割って**偽陰性で赤**になっていた（今回のエンジン買いで normal も強くなり hard-normal 差が 68%→58% に縮まり顕在化）。→ 他の全テストと同じく**固定シード(20260701)を導入＋勝率サンプルを40→100戦**に。閾値は不変。結果は決定論的に 強vs弱93%・強vs普通58%・普通vs弱94% で安定緑（2回連続で同値確認）。
- **未実装/残**：#3 新拡張の画像化はアート入力（`asset/art/<id>.png`＝ローカルgitignore）が新規に必要で、コード側スキャフォールドは可能だがアートはこのPCでの別途生成が要る（未着手）。

### 繁栄（Prosperity 第二版）27種を実プレイ可能に（2026-07-01）
- **25王国＋プラチナ貨＋植民地**を実装。新セット「**繁栄セット**」(`DOM.KINGDOM_PROSPERITY` 固定10種)＋「**繁栄から**」(ランダム)。`POOLS.prosperity`(25種)。
- **新基盤**：(1)**VPトークン** `player.vpTokens`（司教・記念碑・収集・投資。`vpOf` で加算・`maskStateFor` は素通し=公開）。(2)**プラチナ貨/植民地**＝`initSupply` が王国に繁栄カードがあるとき自動供給（platinum 12 / colony v）。盤面の財宝/勝利点列に条件表示。(3)**コスト軽減** `cardCost`（石切場＝場にある間アクション$2安／行商人＝購入時 場のアクション数×$2安）。(4)**動的財宝** 銀行＝`playTreasureCard` で場の財宝枚数ぶん。(5)**`canBuyCard`**（高級市場＝場に銅貨で不可。engine/CPU/UI 共用で空振り防止）。
- **獲得時フック**（`triggerOnGain`）：隠し財産＝勝利点獲得→金貨（**購入時→獲得時に faithful 化**。`applyHoardOnBuy` は no-op 化）／収集＝アクション獲得→+VP／物見やぐら・ティアラ＝獲得物の廃棄/山札上（`_gainDepth===1 && !pending` の安全ガード＝自分の手番の主獲得時のみ）。
- **アタック**：群衆／会計士／ペテン師を `ATTACKS` 登録（堀で無効化可）。**王の宮廷**＝`replay` に2回積んで3回プレイ（runReplays 上限 30→200）。**会計士の手番開始時プレイ**も実装（`clerk_start` を `resolveDurationStartEffects` で startQueue へ）。
- 24+1 の新 reducer（`BISHOP_*`/`VAULT_*`/`MINT_REVEAL`/`EXPAND_*`/`FORGE_*`/`KINGS_COURT_CHOOSE`/`WAR_CHEST_*`/`WATCHTOWER`/`TIARA_*`/`ANVIL_*`/`INVESTMENT*`/`CRYSTAL_BALL`/`CLERK_*` 等）＋ `PLAYER_ACTIONS`＋CPU `decidePending` 全分岐＋`chooseAction`/`chooseBuy`(植民地/プラチナ優先)＋UI `viewPendingModal` 全モーダル。
- **敵対的レビュー（サブエージェント）で発見→修正**：①司教を空手札で使うとデッドロック→`hand>0` ガード。②ティアラの2回目コインが相手の堀で取りこぼし→pending 無関係に常時加算。③会計士の手番開始プレイ未実装→実装。④runReplays 上限30→200。
- **検証**：`test/prosperity.test.js`(56)・`test/prosperity-ui.test.js`(29) 追加。CPU対CPU **157戦(2-4人)0デッドロック**、実ブラウザで盤面描画＋webp読込(broken 0)、27枚モンタージュ目視OK。**全テスト約1737件緑**。
- **カード画像**：`asset/cards/<id>.webp` 26枚新規＋hoard更新（繁栄調の新絵＋テキストを「獲得時」に修正）。`carddata.js` の hoard DISPLAY も修正。差分は新規26＋hoardのみ（既存はgrainのみ→`git checkout`で戻し）。
- **デプロイ**：`sw.js` v15→**v16**（クライアント更新）。繁栄webpは deploy.yml の glob でコピー、実行時プリキャッシュ（precache不要）。

### 錬金術（Alchemy 第二版）13種を実プレイ可能に（2026-07-01）
- **12種＋支配**を実装。新セット「**錬金術セット**」(`DOM.KINGDOM_ALCHEMY` 固定10種)＋「**錬金術から**」(ランダム, `POOLS.alchemy`=王国12種)を**有効化**（上記で一時無効化していた2エントリを実装完了に伴い復活）。
- **ポーション経済（新基盤）**：`initSupply` が王国にポーション費用カードがあると**ポーション山(16)**を自動供給／`freshTurn` に `turn.potions`／`playTreasureCard` で potion 財宝→`t.potions+=1`／**BUY にポーション費用判定を追加**（コスト0でもポーション無しはタダ取り不可＝重要）。`potionCost(id)`（コイン軽減では下がらない）。UI＝**POTIONバッジ(紫)＋ポーション山を財宝列に＋購入可否 `affordable()`**（コイン・ポーション・繁栄制約を1関数に集約）。
- **各カード**：変成(種類ごと獲得・多重タイプは各ぶん)／ブドウ園(所持アクション3枚=1VP＝`vpOf` に加算)／薬草商(片付けで場の財宝を山上=cleanup自動)／薬剤師(上4枚の銅貨/ポーションを手札・残りを並べ替え)／念視の泉(密偵型アタック＋自分はアクション以外まで公開ドロー)／大学(アクション獲得)／錬金術師(場にポーションで山上=cleanup自動)／使い魔(魔女型アタック)／賢者の石(山札+捨て札÷5コイン)／ゴーレム(アクション2枚を replay で使う。runReplays に `label:'golem'` 分岐)／徒弟(廃棄コインぶんドロー・ポーション費用は+2)。使い魔・念視の泉を `ATTACKS` 登録。
- **支配（Possession）＝最難**：`turn.possessedBy`(操作者)/`turn.rotationSeat`(回り順を崩さない)/`state.extraTurns`(追加ターン待ち行列)。**`actor()` を支配ルーティング化**（被支配者=activeの決定を支配者に委譲。他人のリアクションは本人）。**`gain()` リダイレクト**（被支配者の獲得→脇→精算で支配者の捨て札へ）。**`trashOwn()`**（被支配者の廃棄→脇→精算で本人の捨て札へ戻す＝永久廃棄しない。錬金術の廃棄は変成/徒弟が使用。§注意参照）。`cleanupAndAdvance` で精算＋次手番決定（前哨地→支配追加ターン→通常rotationSeat+1）。UI＝**maskStateForで支配者に被支配者の手札を開示／「🎭 支配中」バナー／被支配者の手札を操作対象として描画**（`handP`）／pendingモーダルの表示判定を `pending.player===viewer` から `interactive`(=actor===viewer)へ（支配で詰まないため）。オンラインは `actor()` 経由で**サーバ無改修**（送信可否・CPU判定とも actor で正しく分岐）。
- **CPU**：`decidePending` 全8分岐＋`chooseAction`(非ターミナル/ターミナル分類)＋`chooseBuy`(ポーション所持で錬金カード優先・未所持なら potion 仕込み。支配はCPU自動購入から除外)＋`decide` を支配対応(被支配者の手札を操作・操作者levelで判断)。`vpOf` にブドウ園。
- **敵対的レビュー（多エージェントWorkflow＋CPUストレス）で発見→全修正（7件）**：
  ①**CPU無限ループ**：ポーション0でも「ポーション費用カード」を勝ち筋/廉価札として選び続け reduce が no-op（`chooseBuy` 最終ガード・`kingdomAffordable`・hard の勝ち筋スキャンがコイン費用のみ判定）→3箇所にポーション費用充足チェック追加。②**大学がポーション費用アクションを獲得できた**（ルール違反・純錬金術で踏む）→ engine 2箇所(anyGainable/UNIVERSITY_GAIN)＋cpu＋ui の述語に `potionCost===0` 追加。③**連鎖支配**（被支配ターン中に支配をプレイ）で操作権/獲得先が中間の被支配者に向く（オンライン悪用）→ `possessedBy` を「元の支配者」`t.possessedBy` から継承。④**手札のポーションが盤面に描画されない**（`handGroups` の `SUPPLY_ORDER` に potion が無く全グループから脱落・毎ゲーム発生）→ 並びに `potion` を追加。⑤支配中『財宝を全部出す』ボタン活性が支配者手札を見る→被支配者(`t.active`)で判定（`viewActionBar`/`endTurnTap`/`endActionPhase`）。⑥ゴーレム/連鎖で使ったアクションが `actionsPlayed` に計上されず（混成王国の共謀者）→加算。⑦（対応不要）CPUは支配を自動購入しないため CPU-支配者の買い最適化が被支配者向きなのはデッドコード。
- **検証**：`test/alchemy.test.js`(80＝12種＋ポーション経済＋支配＋回帰)・`test/alchemy-ui.test.js`(20)。CPU対CPU **120戦(固定/ランダム×2-4人×全難易度)0詰み**、大学のポーション費用不変条件を確認。**全テスト1839件緑（17スイート・`npm test` exit 0）**。`sw.js` v16→**v17**。
- **カード画像**：13枚は既存(前セッションで生成済み)。ロジック追加のみで画像/`carddata.js` は不変。

過去の広い文脈（第二版化・単一ソース化・整合性テスト・オンライン再接続・枠画像方式の経緯など）は `docs/handover.md` を参照。

---

## 1. ゴール
- スマホ向けドミニオン対戦Webアプリ（CPU戦・2〜4人ローカル・オンライン対戦）。回答/UIは日本語。
- カードは「**金属枠＋AI生成の絵＋コード描画の文字** を合成した完成画像」(`asset/cards/<id>.webp`)。見栄えは基準カード `asset/<id>.jpg` と同等の高級感を目指す（達成済み＝金トリム方式）。
- 拡張を「壊さず」増やせる単一ソース設計を維持する。

## 2. アーキテクチャ（カードを増やす/触るとき必読）
- **表示データの正本＝`js/cards.js` の `DOM.CARDS`**（id/name/cost/types/text、+ 海辺の持続や `potion`=ポーション費用など）。`js/carddata.js` がそこから名前/コスト/種別ラベル/枠色/画像パスを自動導出。`cards.html`(一覧プレビュー) も `tools/build-cards.js`(画像生成) も `DOM.CARDS` を見る。
- **完成画像の生成**：`node tools/build-cards.js`（プロジェクト直下を cwd に）。masterフレーム1枚（`images/assets/…20_21_29.png`、recursiveに探索）を種別8スキンに recolor → 各カードで 枠＋絵(`asset/art/<id>.png`)＋文字(コスト/名前/種別/効果) を canvas 合成 → 768×1152 WebP を `asset/cards/<id>.webp` に出力（全117枚）。`CARDS_OUT` 環境変数で出力先を変えてプレビュー可。入力の `images/`・`asset/art/` は `.gitignore`（このPCのみ。webpだけ追跡）。
- **エンジン**：`js/engine.js`。`reduce(state, action)` の純関数。`applyEffect` の per-card switch、選択は `state.pending` ＋ `*_RESOLVE` reducer。攻撃は `const ATTACKS={}` 登録表＋`*EnterVictim`。`DOM.engine.PLAYER_ACTIONS`(Set) が「プレイヤーが送れる action」の唯一の許可リスト（サーバも参照）。効果プリミティブ `discardFromHand/trashFromHand/finishGain`。
- **CPU**：`js/cpu.js`。`chooseAction`(出すカード)・`decidePending`(各pendingへの応答＝**新pendingには必ず分岐を足す。無いとCPUが無限ループ**)・`GAIN_ORDER`(購入優先＝**全カード網羅必須**)。
- **UI**：`js/ui.js`。`viewBoard`(盤面)・`viewPendingModal`(選択モーダル)・`modal*`ヘルパ。オンラインも同じ `ui.js`（NetStore.dispatch）。
- **整合性テスト** `test/integrity.test.js`：reduce case↔PLAYER_ACTIONS一致／GAIN_ORDER=全カード／全カードがいずれかのPOOL所属／固定セットは10種／react攻撃はATTACKS登録／表示データ一致 を自動検証。**抜けはCIで即赤**。
- **デプロイ**：main に push → `.github/workflows/deploy.yml` が `_site` を組んで Pages 公開、サーバ変更は Render が自動再デプロイ。**新しい配信フォルダを足したら deploy.yml のコピー対象に追加**（忘れると本番404）。**`sw.js` を変えたら VERSION を上げる**（現在 v15。client UI 変更時は上げる）。コミット者はローカル設定済み（Naoki Inoue）。

## 3. 完了したこと（このセッション 2026-06-30・すべてコミット＆デプロイ済み）
- **カード完成画像（全117枚）**：基本/陰謀/プロモ77＋**海辺27**＋**錬金術13**。枠は「**金トリム方式**」＝色地カード(victory/curse/action/attack/reaction/duration)は地色＋**金レール**、財宝は銅/銀/金の専用メタル。コイン中央は暗いメダル＋白数字。持続=オレンジ枠。**錬金術のポーション費用は紫のフラスコ記号**（ポーションのみ=フラスコだけ／コイン+ポーション=数字+小フラスコ／支配=6+×2）。生成は `tools/build-cards.js`。
- **海辺（Seaside 第二版）27種を実プレイ可能に**（commit `33876f5`）。新セット「海辺セット(固定10種)」「海辺から(ランダム)」。**持続(Duration)機構**＝`durationCards`/`delayedEffects`/`setAside`/`islandMat`/`nativeVillageMat`、`cleanupAndAdvance` で持ち越し仕分け、`resolveDurationStartEffects`+`turn.startQueue`+`popStartQueue`、`DURATION_RESOLVERS`、`armDuration`。マット(島/原住民)、追加ターン(前哨地)、灯台免疫(`attackImmune`を全攻撃に配線)、on-gain/on-playフック(`triggerOnGain`=サル/封鎖、`corsairOnPlayTreasure`=私掠船、再帰ガード付)、巾着切り/海の魔女をATTACKS登録、宝物庫/密輸人。**船乗りの「獲得した持続を即プレイ」も実装済み**(`sailor_play_gain`)。`test/seaside.test.js`(85)・`test/seaside-ui.test.js`(22)。
- **オンライン/UI改善（commit `325e31d`/`18fb4d6`）**：盤面アクション列をコスト順／獲得アニメのカード上数字を削除／ゲストのロビーをホストと同項目(読取専用)＋初心者モードON/OFFをロビーに／名前を`localStorage`記憶／**手番順(上から順/ランダム)を選択可**(`server/gameServer.js` `randomOrder`)／カード拡大を閉じてもスクロール位置保持／カード一覧に海辺・錬金術追加／選択モーダルのカードを大きく表示。`sw.js` v15。

## 4. 決定事項とその理由
- **枠は画像（金属枠）方式**。コード描画SVGの金は基準カードの絵画的な金に構造的に届かなかったため（過去に5回差し戻し。詳細 `docs/handover.md`）。
- **画像だけ先・ゲームロジックは別タスク**。新拡張はまず `DOM.CARDS` にカタログ追加＋**孤立プール**＋`GAIN_ORDER`追加で「画像は出るがゲームには入らない＝壊れない」状態にし、整合性テストを緑に保つ→後で実ゲーム化して `POOLS`→`CARD_SET` 昇格。海辺・錬金術・繁栄はすべて実プレイ可能化済み（この方式で段階実装した）。
- **海辺の簡略化2点は本格実装済み（2026-07-01）**：封鎖の「呪い窓に堀で免疫」・海賊の「財宝獲得時リアクションで手札から出す」を実装（詳細は最上部の節）。on-gainの対話pendingは `!pending && _gainDepth===1` ゲートで安全側を維持しつつ実装。（船乗りの即プレイも実装済み。）

## 5. 未完了タスク（次セッションはここから・優先順）
1. **（完了・2026-07-01）混成王国のCPU購入バランス調整**：`bestEngineBuy` で王国カードを買うように（詳細は最上部の節）。さらに強くしたい場合は、grand_market/king's court 等の高コストエンジンを金貨より優先するアンカー買い（`province>4` の早期）を追加検討（今回は金貨の次点に留め、難易度序列を保った）。
2. **（完了・2026-07-01）海辺の簡略化2点の本格実装**：封鎖の堀免疫窓・海賊の財宝獲得リアクション（詳細は最上部の節）。
3. **新拡張の画像化（要アート）**：暗黒時代など次の拡張を段階実装する場合、コード側（`DOM.CARDS` カタログ＋孤立プール＋`GAIN_ORDER`）は追加できるが、**完成画像には `asset/art/<id>.png`（AI生成・ローカルgitignore）が新規に必要**。build-cards.js はアートが無いと枠＋文字のみ（絵が空白）で出力する（クラッシュはしない）。→ **どの拡張にするか＋アートをどう用意するかを決めてから着手**。
4. **錬金術アートの△3枚最終確認（任意）**：変成=金の変成光／薬草商=女性が薬草調合／薬剤師=天秤の男。入替えたい場合は `asset/art/<id>.png` を差し替え→`node tools/build-cards.js`→該当webp再デプロイ。
5. （任意・過去メモ）絵文字→game-icons.net SVG 化、vanilla効果DSL 等。

## 6. 詰まり・注意点・保留中の判断
- **新カードを `DOM.CARDS` に足すと整合性テストが赤くなる**（GAIN_ORDER網羅＋POOL所属を要求）。→ 孤立プール＋GAIN_ORDER追加で回避（§4）。実ゲーム化するときは ATTACKS/PLAYER_ACTIONS/CPU decidePending/UI viewPendingModal も忘れず（抜けはCIで赤 or CPU無限ループ）。
- **デプロイ**：サーバ(`server/gameServer.js`)変更時は client(Pages)とserver(Render)が同時反映されるまで一時的に機能が空振りし得る（手番順トグル等）。push一発で両方走るが反映タイミング差に注意。`sw.js` VERSION更新を忘れない。
- **一時スクリプト規約**：puppeteer/contact等の使い捨ては**プロジェクト直下に `_*.tmp.js`** で作り `node` 実行後に**必ず削除**（直下を汚さない）。スクショ/montageは scratchpad へ。**シェルのcwdが `images/` 等にずれることがある**ので、tmpスクリプトは絶対パス推奨、build/test実行前に `Set-Location 'C:\Users\b1242\claude\game\dominion'`。
- 入力アセット（`images/`・`asset/art/`）は `.gitignore` で**このPCローカルのみ**。画像の再生成はこのPCでしかできない。
- **支配（Possession）の廃棄カード返却の簡略化＝到達不能を証明済み（2026-07-01・監査⑤）＝意図的に未修正**：被支配者の廃棄を本人へ戻すのは `trashOwn` 経由（変成・徒弟）のみ。基本/陰謀/海辺/繁栄の self-trash（礼拝堂・鉱山等）は `state.trash.push` のままで、**理論上は混成王国で支配下に使うと実廃棄**になる。しかし **`possession` は `alchemy` プール専用で、複数プールを混ぜる出荷セットは `random`(basic+intrigue)・`random-promo`(basic+intrigue+promo)・`random-1e` の3つだけ＝いずれも alchemy を含まない**（node で全プール/全セットを走査し証明）。よって支配と「外部拡張の self-trash」は**どの出荷キングダムでも共存しない＝到達不能・実害ゼロ**。全 self-trash を `trashOwn` 化する“完全対応”は可能だが、約20箇所の中に**アタック廃棄（詐欺師/山賊/破壊工作員が相手の札を廃棄）や供給廃棄（伏魔殿）を誤って混ぜると到達可能な実バグを生む**リスクがあり、死んだ経路のために可到達コードを危険にさらす割に合わない。→ **混成alchemyモードを正式に追加する時に、そのモードを forcing function として一緒に対応する**方針（それまでは現状維持が正しい）。
  - 関連：ポーション費用カードをコイン費用だけで獲得できる問題も同様に、コイン予算獲得札（改築/工房等）は basic/intrigue 側で alchemy と共存せず到達不能。alchemy 内で唯一該当した **大学(university) は監査①で `potionCost===0` ガード済み**＝可到達分は修正完了。
- **支配のCPU簡略化**：CPUは支配を自動購入しない（`bestPotionBuy` で除外）。人間が買って使うぶんには支配者がCPUでも被支配ターンを操作できる（`decide` 対応済み）。
