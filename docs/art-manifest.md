# 絵（アート）生成マニフェスト — `asset/art/<id>.png`（全77種）

カード中央の窓にはめ込む**「絵だけ」**の画像を、ユーザーが生成AIで作るための一覧。
正本は `js/cards.js` の `DOM.CARDS`（このファイルは node で全カードを書き出して生成＝**網羅漏れなし**）。
枠は別途 `asset/frames/<type>.png`（→ `docs/frame-art-guide.md`）。

---

## 絵の共通仕様（必読）
- **「絵だけ」**。枠・文字・数字・縁取りは**一切描かない**（枠と文字はコードが載せる）。
- **正方形 1:1**（中央の窓が正方形のため）。**768×768 px 程度**、**PNG**。
- ファイル名は**カードID**：`asset/art/<id>.png`（例：鍛冶屋 → `asset/art/smithy.png`）。
- 画面の端まで主題を満たす（余白・額縁を作らない）。窓は角丸で少しトリミングされる前提で**中央に主役**を置く。
- 未配置なら自動で「絵文字＋カード名」にフォールバック（置いた分から1枚ずつ完成形になる）。

### 共通画風プロンプト（英語・各カードの主題の前に連結）
```
fantasy oil painting, painterly, rich warm golden lighting, medieval European fantasy,
highly detailed, dramatic atmosphere, centered composition, square 1:1, no border
```
→ 例（鍛冶屋）：`fantasy oil painting, …, no border, a blacksmith hammering glowing iron on an anvil at a forge`

### ネガティブプロンプト（英語・共通）
```
text, letters, words, numbers, digits, border, frame, watermark, signature, ui, card layout
```

> 種別（枠色）は `frameType()` の優先順 **attack > reaction > treasure > action > victory > curse** で1つに決まる。
> 下表は枠種別ごとにまとめてある（その種別の枠 `asset/frames/<type>.png` の窓に入る絵）。

---

## 財宝（`treasure`） — 5種

| ID | 名前 | $ | 種別 | 効果（要約） | おすすめ主題（英語プロンプト ／ 和訳） |
|---|---|---|---|---|---|
| `copper` | 銅貨 | 0 | 財宝 | +1 コイン | a stack of gleaming copper coins, one large copper coin in focus ／ 輝く銅貨の山 |
| `silver` | 銀貨 | 3 | 財宝 | +2 コイン | a pile of polished shining silver coins ／ 磨かれた銀貨の山 |
| `gold` | 金貨 | 6 | 財宝 | +3 コイン | a glittering sparkling heap of gold coins ／ 輝く金貨の山 |
| `harem` | 後宮 | 6 | 財宝・勝利点 | コイン +2 / 勝利点 2 | an opulent harem chamber with silk cushions, jewels and golden ornaments ／ 絹のクッションと宝飾の豪奢な後宮 |
| `hoard` | 隠し財産 | 5 | 財宝 | コイン +2 / 勝利点を購入したとき金貨を獲得 | an overflowing treasure chest of gold in a dim cave, a dragon's hoard ／ 洞窟に溢れる財宝の山 |

## 勝利点（`victory`） — 5種

| ID | 名前 | $ | 種別 | 効果（要約） | おすすめ主題（英語プロンプト ／ 和訳） |
|---|---|---|---|---|---|
| `estate` | 屋敷 | 2 | 勝利点 | 勝利点 1 | a modest stone country manor house with a small garden ／ 慎ましい石造りの屋敷 |
| `duchy` | 公領 | 5 | 勝利点 | 勝利点 3 | a grand ducal palace with towers and manicured grounds ／ 塔のある壮麗な公爵邸 |
| `province` | 属州 | 8 | 勝利点 | 勝利点 6 | a vast kingdom landscape, a great castle overlooking sprawling provinces ／ 広大な属州を見下ろす城 |
| `gardens` | 庭園 | 4 | 勝利点 | デッキ10枚につき1勝利点 | a lush ornamental formal garden with hedges, fountains and flowers ／ 噴水と花の整形式庭園 |
| `duke` | 公爵 | 5 | 勝利点 | 公領1枚につき1勝利点 | a noble duke in regal robes, dignified portrait ／ 威厳ある公爵の肖像 |

## 呪い（`curse`） — 1種

| ID | 名前 | $ | 種別 | 効果（要約） | おすすめ主題（英語プロンプト ／ 和訳） |
|---|---|---|---|---|---|
| `curse` | 呪い | 0 | 呪い | 勝利点 −1 | a cursed glowing skull wrapped in dark purple magic, ominous occult sigils ／ 紫の魔力に包まれた呪いの髑髏 |

## アクション（`action`） — 52種

| ID | 名前 | $ | 種別 | 効果（要約） | おすすめ主題（英語プロンプト ／ 和訳） |
|---|---|---|---|---|---|
| `cellar` | 地下貯蔵庫 | 2 | アクション | +1 アクション / 手札を捨て、同じ数引く | a stone wine cellar lined with wooden barrels, dim torchlight ／ 樽の並ぶ地下貯蔵庫 |
| `market` | 市場 | 5 | アクション | +1 カード / +1 アクション / +1 購入 / +1 コイン | a bustling medieval marketplace with stalls and goods ／ 賑わう中世の市場 |
| `mine` | 鉱山 | 5 | アクション | 財宝1枚を廃棄してよい / 廃棄した財宝のコスト+3以下を獲得 | a mine shaft entrance with glinting ore veins and a pickaxe ／ 鉱石の輝く坑道とツルハシ |
| `remodel` | 改築 | 4 | アクション | 手札1枚を廃棄 / 廃棄したカードのコスト+2以下を獲得 | a half-rebuilt house with wooden scaffolding, renovation in progress ／ 足場の組まれた改築中の家 |
| `smithy` | 鍛冶屋 | 4 | アクション | +3 カード | a blacksmith hammering glowing iron on an anvil at a forge ／ 炉と金床で鉄を打つ鍛冶屋 |
| `village` | 村 | 3 | アクション | +1 カード / +2 アクション | a quaint medieval village of timber cottages, chimney smoke ／ 木造家屋が並ぶ村 |
| `woodcutter` | 木こり | 3 | アクション | +1 購入 / +2 コイン | a woodcutter swinging an axe at a tree in a forest ／ 森で木を切る木こり |
| `workshop` | 工房 | 3 | アクション | コスト4以下を1枚獲得 | a craftsman's workshop full of tools and half-finished work ／ 道具の並ぶ工房 |
| `laboratory` | 研究所 | 5 | アクション | +2 カード / +1 アクション | an alchemist's laboratory with bubbling flasks and apparatus ／ 泡立つフラスコの研究所 |
| `festival` | 祝祭 | 5 | アクション | +2 アクション / +1 購入 / +2 コイン | a joyful village festival with colorful banners and lanterns ／ 旗と提灯で賑わう祝祭 |
| `moneylender` | 金貸し | 4 | アクション | 銅貨1枚を廃棄してよい / → +3 コイン | a moneylender counting coins at a wooden table with a ledger ／ 帳簿と硬貨を数える金貸し |
| `chancellor` | 宰相 | 3 | アクション | +2 コイン / 山札を捨て札にしてもよい | a royal chancellor holding scrolls and a seal in official robes ／ 巻物と印を持つ宰相 |
| `chapel` | 礼拝堂 | 2 | アクション | 手札を最大4枚廃棄 | a small quiet stone chapel with stained glass windows ／ ステンドグラスの小さな礼拝堂 |
| `council_room` | 議会 | 5 | アクション | +4 カード / +1 購入 / 他は各1枚引く | a grand council chamber with nobles seated around a round table ／ 円卓を囲む議会 |
| `feast` | 祝宴 | 4 | アクション | 自身を廃棄 / コスト5以下を1枚獲得 | a lavish banquet table laden with food and goblets ／ 料理と杯が並ぶ祝宴の卓 |
| `adventurer` | 冒険者 | 6 | アクション | 財宝が2枚出るまで公開 / 残りは捨てる | an adventurer holding a torch exploring a dark cavern ／ 松明を掲げ洞窟を進む冒険者 |
| `library` | 書庫 | 5 | アクション | 手札7枚まで引く / アクションは脇に置ける | a grand library with towering bookshelves and candlelight ／ 高い書棚と燭台の書庫 |
| `throne_room` | 玉座の間 | 4 | アクション | アクション1枚を2回使う | an opulent royal throne room with a golden throne ／ 黄金の玉座の間 |
| `courtyard` | 中庭 | 2 | アクション | +3 カード / 手札1枚を山札の上に置く | a sunny castle courtyard with stone arches and a fountain ／ アーチと噴水のある城の中庭 |
| `pawn` | 従者 | 2 | アクション | 異なる2つを選ぶ / +1カード/+1アクション/+1購入/+1コイン | a humble servant page in livery, bowing politely ／ お仕着せ姿で礼をする従者 |
| `shanty_town` | 寂れた村 | 3 | アクション | +2 アクション / アクションが無ければ+2カード | a ramshackle shanty town of crooked wooden huts ／ 傾いた小屋が並ぶ寂れた村 |
| `steward` | 執事 | 3 | アクション | +2カード / +2コイン / 2枚廃棄 | a dignified butler steward holding a silver tray, formal ／ 銀の盆を持つ執事 |
| `wishing_well` | 願いの井戸 | 3 | アクション | +1 カード / +1 アクション / 宣言が当たれば手札に | an old stone wishing well with a wooden roof, coins glinting in the water ／ 硬貨の沈む石造りの願いの井戸 |
| `baron` | 男爵 | 4 | アクション | +1 購入 / 屋敷を捨てれば+4コイン / 捨てなければ屋敷を獲得 | a proud baron nobleman in fine clothes ／ 上等な身なりの男爵 |
| `bridge` | 橋 | 4 | アクション | +1 購入 / +1 コイン / 全カードのコスト-1 | an arched stone bridge spanning a river at dusk ／ 夕暮れの川に架かる石橋 |
| `conspirator` | 共謀者 | 4 | アクション | +2 コイン / アクション3回以上で+1カード+1アクション | cloaked conspirators plotting by candlelight in the shadows ／ 燭台の下で密談する共謀者 |
| `ironworks` | 鉄工所 | 4 | アクション | コスト4以下を獲得 / 種別ボーナス | an ironworks foundry with molten metal pouring from a glowing furnace ／ 溶けた鉄が流れる鉄工所 |
| `mining_village` | 鉱山の村 | 4 | アクション | +1 カード / +2 アクション / 廃棄した場合+2コイン | a mining village at a mountain foot with mine carts and lifts ／ トロッコのある山裾の鉱山の村 |
| `nobles` | 貴族 | 6 | 勝利点・アクション | 勝利点 2 / +3カード または +2アクション | elegant noble lords and ladies in lavish court attire ／ 着飾った貴族の男女 |
| `great_hall` | 大広間 | 3 | 勝利点・アクション | +1 カード / +1 アクション / 勝利点 1 | a vast grand hall with high vaulted ceilings and hanging banners ／ 高い天井と旗の大広間 |
| `coppersmith` | 銅細工師 | 4 | アクション | このターン 銅貨の価値が+1コイン | a coppersmith hammering a copper pot, gleaming copperware around ／ 銅器を打つ銅細工師 |
| `trading_post` | 交易場 | 5 | アクション | 手札2枚を廃棄 / → 銀貨を手札に獲得 | a busy trading post with merchants exchanging goods ／ 物々交換で賑わう交易場 |
| `upgrade` | 改良 | 5 | アクション | +1 カード / +1 アクション / 1枚廃棄→ちょうど+1コストを獲得 | a magical glowing transformation, an object upgrading in golden light ／ 金色の光で変化する改良 |
| `scout` | 斥候 | 4 | アクション | +1 アクション / 上4枚公開→勝利点を手札に / 残りは好きな順で山札の上 | a scout surveying the landscape from a hilltop with a spyglass ／ 丘から望遠する斥候 |
| `tribute` | 貢物 | 5 | アクション | 左隣が上2枚公開→捨てる / 異なる名前ごとに種別ボーナス | tribute offerings of gifts and treasure presented on a dais ／ 壇上に献じられる貢物 |
| `masquerade` | 仮面舞踏会 | 3 | アクション | +2 カード / 全員が左隣へ1枚渡す / その後1枚廃棄してよい | a masquerade ball, masked dancers in elegant costumes ／ 仮面の踊り手が舞う仮面舞踏会 |
| `harbinger` | 前駆者 | 3 | アクション | +1 カード / +1 アクション / 捨て札1枚を山札の上に置いてよい | a herald harbinger blowing a horn, making an announcement ／ 角笛を吹き告げる前駆者 |
| `merchant` | 商人 | 3 | アクション | +1 カード / +1 アクション / 最初の銀貨で +1 コイン | a traveling merchant with a cart laden with wares ／ 荷車に商品を積む商人 |
| `vassal` | 家臣 | 3 | アクション | +2 コイン / 山札の上を捨て、アクションなら使ってよい | a loyal vassal knight kneeling before his lord ／ 主君に跪く家臣 |
| `poacher` | 密猟者 | 4 | アクション | +1 カード / +1 アクション / +1 コイン / 空の山1つにつき手札1枚捨てる | a poacher in a moonlit forest setting a snare, a game bag at his side ／ 月夜の森で罠を仕掛ける密猟者 |
| `sentry` | 衛兵 | 5 | アクション | +1 カード / +1 アクション / 上2枚を廃棄/捨て/戻す | a castle sentry guard on watch atop a wall at night with a lantern ／ ランタンで城壁を見張る衛兵 |
| `artisan` | 職人 | 6 | アクション | コスト5以下を手札に獲得 / 手札1枚を山札の上に置く | a skilled artisan crafting intricate fine work at a bench ／ 緻密な細工をする職人 |
| `courtier` | 廷臣 | 5 | アクション | 手札1枚を公開 / 種類数だけ：+1アクション/+1購入/+3コイン/金貨 | an elegant courtier bowing gracefully at a royal court ／ 宮廷で優雅に礼をする廷臣 |
| `lurker` | 待ち伏せ | 2 | アクション | +1 アクション / サプライのアクションを廃棄 / or 廃棄置場からアクションを獲得 | a shadowy figure lurking hidden in a dark alley ／ 暗い路地に潜む待ち伏せ |
| `mill` | 風車 | 4 | 勝利点・アクション | +1 カード / +1 アクション / 手札2枚を捨てれば +2コイン / 勝利点 1 | a rustic windmill on a grassy hill with turning sails ／ 丘の上で羽根が回る風車 |
| `patrol` | パトロール | 5 | アクション | +3 カード / 上4枚公開→勝利点と呪いを手札に / 残りは好きな順で山札の上 | a night patrol of guards walking the walls with lanterns ／ ランタンを手に夜回りするパトロール |
| `secret_passage` | 隠し通路 | 4 | アクション | +2 カード / +1 アクション / 手札1枚を山札の好きな位置に入れる | a hidden passage revealed behind a swinging bookshelf, a secret door ／ 本棚の裏に現れる隠し通路 |
| `walled_village` | 城壁のある村 | 4 | アクション | +1 カード / +2 アクション / 場のアクションが2枚以下なら山札の上に戻せる | a fortified village surrounded by stone walls with a gate ／ 石壁と門に囲まれた村 |
| `envoy` | 使者 | 4 | アクション | 上5枚公開→左隣が1枚捨てさせる / 残りを手札に | a royal envoy messenger delivering a sealed letter on horseback ／ 馬上で書状を届ける使者 |
| `governor` | 総督 | 5 | アクション | +1 アクション / 全員に効果（自分は強い方） / +3カード/金貨/改築 を選ぶ | a provincial governor in office robes overseeing the realm ／ 領地を統べる総督 |
| `dismantle` | 取り壊し | 4 | アクション | 手札1枚を廃棄 / それより安いカードと金貨を獲得 | workers demolishing a stone structure, dismantling amid dust ／ 砂塵の中で取り壊される建物 |
| `black_market` | 闇市場 | 3 | アクション | +2 コイン / 闇市場デッキ上3枚から1枚を購入してよい | a shady black market in a dark alley, hooded dealers and contraband ／ フードの商人が並ぶ路地裏の闇市場 |

## リアクション（`reaction`） — 3種

| ID | 名前 | $ | 種別 | 効果（要約） | おすすめ主題（英語プロンプト ／ 和訳） |
|---|---|---|---|---|---|
| `moat` | 堀 | 2 | アクション・リアクション | +2 カード / アタックを無効化できる | a castle moat of dark water surrounding stone fortress walls ／ 城壁を囲む堀の水 |
| `secret_chamber` | 秘密の小部屋 | 2 | アクション・リアクション | 捨てた1枚につき +1コイン / (リアクション)アタック時に+2引き2枚戻す | a hidden secret chamber behind a wall, treasure and candles inside ／ 壁の奥に隠された秘密の小部屋 |
| `diplomat` | 外交官 | 4 | アクション・リアクション | +2 カード / 手札5枚以下なら +2 アクション / (リアクション)アタック時に+2引き3枚捨てる | a diplomat at a negotiation table with documents and a wax seal ／ 文書を交わす外交官 |

## アタック（`attack`） — 11種

| ID | 名前 | $ | 種別 | 効果（要約） | おすすめ主題（英語プロンプト ／ 和訳） |
|---|---|---|---|---|---|
| `militia` | 民兵 | 4 | アクション・アタック | +2 コイン / 他は手札3枚まで捨てる | armed peasant militia soldiers with spears and shields advancing ／ 槍と盾で進む民兵 |
| `witch` | 魔女 | 5 | アクション・アタック | +2 カード / 他は呪いを獲得 | a witch casting a hex over a bubbling cauldron with green smoke ／ 釜の前で呪いをかける魔女 |
| `bureaucrat` | 役人 | 4 | アクション・アタック | 銀貨を山札の上に獲得 / 他は勝利点を山札の上に | a stern bureaucrat official stamping documents with a seal and ledger ／ 書類に判を押す役人 |
| `spy` | 密偵 | 4 | アクション・アタック | +1カード +1アクション / 全員の山札の上を捨/戻し選択 | a cloaked spy peering from the shadows, secretly watching ／ 物陰から覗き見る密偵 |
| `thief` | 泥棒 | 4 | アクション・アタック | 他は上2枚公開 / 財宝1枚を廃棄→獲得してよい | a thief sneaking away at night with a stolen sack of coins ／ 夜に盗品を持ち逃げる泥棒 |
| `torturer` | 拷問人 | 5 | アクション・アタック | +3 カード / 他は2枚捨てるか呪い獲得 | a menacing dungeon torturer with instruments in a dark cell ／ 地下牢の不気味な拷問人 |
| `swindler` | 詐欺師 | 3 | アクション・アタック | +2 コイン / 他は山札の上を廃棄 / → 廃棄と同コストをあなたが選んで与える | a sly con artist swindler with cards and a cunning grin ／ カードを手に企む詐欺師 |
| `saboteur` | 破壊工作員 | 5 | アクション・アタック | 他はコスト3以上を廃棄 / → 2安いカードを獲得してよい | a saboteur planting explosives in the shadows, sabotage ／ 影で破壊工作を仕掛ける工作員 |
| `minion` | 手先 | 5 | アクション・アタック | +1 アクション / +2コイン か 全員引き直し を選ぶ | a sinister masked henchman minion lurking, a loyal thug ／ 不気味な仮面の手先 |
| `bandit` | 山賊 | 5 | アクション・アタック | 金貨を獲得 / 他は上2枚公開→銅貨以外の財宝1枚を廃棄 | a masked bandit highwayman ambushing on a road, weapon drawn ／ 街道で待ち伏せる山賊 |
| `replace` | 身代わり | 5 | アクション・アタック | 手札1枚を廃棄→$2高いまでを獲得 / アクション/財宝は山札の上 / 勝利点なら他全員が呪い獲得 | a cloaked impostor body double stepping into another's place ／ 誰かに成り代わる身代わり |

---

**合計 77 種**（財宝・勝利点・呪い・アクション・リアクション・アタックの順）。
この一覧は正本 `DOM.CARDS` を node で全件書き出して生成した（id・名前・コスト・種別・効果は正本由来＝**網羅漏れなし**、主題のみ人手）。
カードを増やしたときは、同じ要領で `DOM.CARDS` を全件書き出し、新カードの**主題だけ**を追記すれば最新化できる。
