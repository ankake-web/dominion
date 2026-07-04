# カードを実プレイ実装するための設計図（段階2ガイド）

新拡張カードを「画像だけ（段階1）」から「実際に遊べる（段階2）」にするための、機構ごとの実装手順・コピー元・落とし穴。**すべて実コード確認済み**（2026-07-04 多エージェント調査）。行番号は目安（編集でずれるのでシンボル名で探す）。

## 新カード1枚の 6 点セット
1. `js/cards.js` `DOM.CARDS` にカタログ定義（段階1で完了済みの分は既にある）
2. `js/cpu.js` `GAIN_ORDER` に id（整合性テストが「DOM.CARDS と同一集合」を要求）
3. `js/engine.js` `applyEffect` に per-card 効果
4. 選択が要るなら: `state.pending` 生成 ＋ `*_RESOLVE` reducer（reduce の switch）＋ `PLAYER_ACTIONS` Set に登録
5. 選択が要るなら: `js/cpu.js` `decidePending` 分岐 ＋ `chooseAction` に使用判断
6. 選択が要るなら: `js/ui.js` `viewPendingModal` 分岐
（アタックなら追加で `ATTACKS` 登録表 ＋ `*EnterVictim`。持続なら `armDuration`＋`DURATION_RESOLVERS`。command系は `state.replay`。）

---

## A. 効果と選択 pending

**applyEffect（`js/engine.js` `function applyEffect(state, cardId, pi)`）** = per-card `switch(cardId)`。`PLAY_ACTION` reducer が手札→inPlay移動・`t.actions-=1`・log 済ませてから呼ぶので、ここでは固有効果だけ書く。冒頭 `const t=state.turn; const p=state.players[pi];`。

**単純カード**（選択不要=これだけで完成）:
```js
case 'market': draw(state,pi,1); t.actions+=1; t.buys+=1; t.coins+=1; break;   // 手本
// smithy: draw(state,pi,3); village: draw(state,pi,1); t.actions+=2;
```
**共通ヘルパ**（engine.js内）: `draw(state,pi,n)`（山切れ自動シャッフル）／`gain(state,pi,id,dest)` dest='discard'|'hand'|'deck'（**獲得は必ずこれ経由**＝on-gainフック/支配/記録を内包）／`cardCost(state,id)`（橋の軽減込み・生cost禁止）／`anyGainable(state,pred)`（獲得先が有るか＝pending立てる前のデッドロック回避）／`removeOne(arr,id)`／`log(state,msg)`／`trashOwn(state,owner,card)`（自分の廃棄の共通入口）／`finishGain(state,pd,card,pred,dest,note)`（獲得pendingのクローザ）。

**単段 pending**（cellar手本）: `if(p.hand.length>0) state.pending={type:'cellar',player:pi};` → `CELLAR_RESOLVE` で `action.cards` を捨てて同数draw、**最後に必ず `state.pending=null`**（閉じ忘れ＝全操作ロックで無限ロック）。

**多段 pending**（mine手本 trash→gain）: `state.pending={type:'mine',stage:'trash',player:pi}` → `MINE_TRASH` で廃棄後、`anyGainable(...)` が真なら `{...stage:'gain',maxCost}` に遷移・偽なら null → `MINE_GAIN` は `finishGain(...)` 一行。**stage名は engine/cpu/ui で一致**させる（進行フィンガープリントが stage を落とすと誤stuck）。

**pending 必須フィールド**: `type`（全分岐キー）／`player`（**選択する人の席**＝攻撃なら相手席）／`stage`（多段）／任意（maxCost 等）。reducer は先頭で `if(!pd||pd.type!=='x') return state;`、`action.card/cards` を**必ず検証**（手札に実在・型OK）してから処理、不正は `return state`。

**PLAYER_ACTIONS**（`js/engine.js` `const PLAYER_ACTIONS = new Set([...])`）: 足した `*_RESOLVE`（大文字）を必ず登録。オンラインの唯一の許可リスト。整合性テストが「reduce の `case 'XXX'`（正規表現 `/case '([A-Z][A-Z0-9_]+)'/`）↔ PLAYER_ACTIONS 完全一致」を検査＝**action.type は大文字/数字/_のみ**、片方漏れで即赤。

**CPU**: `chooseAction`（`js/cpu.js`）に `if(has('x')) return 'x';`（無駄打ち回避の条件付きが定石）。`decidePending` の switch に `case 'x': return {type:'X_RESOLVE', ...}`（dispatchせず**返す**。多段は同 stage で分岐）。獲得選択は `bestGain(state,max,opts)`/`bestGainExact`。
**UI**: `viewPendingModal`（`js/ui.js`）に `if(pd.type==='x') return modalXxx(...)`。既製ヘルパ: `modalMultiHand`（複数選択）/`modalSingleHand`（1枚＋skip）/`modalGainSupply`（サプライ獲得）/`modalOptions`（選択肢ボタン）/`modalShell`（自前）。確定は `dispatch({type:'X_RESOLVE',...})`。

---

## B. トリガーとリアクション

**on-gain**: 全獲得は `gain()` 末尾で `triggerOnGain(state,pi,cardId,dest)` を呼ぶ（購入も BUY→gain 経由）。内部: `_gainDepth` 連鎖ガード（++/>6 return/--）。**獲得時に対話を出す新カードは対話ゲート `if(state.turn && pi===state.turn.active && state._gainDepth===1 && !state.pending)` の中で pending を立てる**（watchtower/tiara/sailor/pirate が同ゲート）。
**on-buy 限定**（購入時のみ）は on-gain でなく BUY case にインライン（造幣所 mint が手本）。
**物見やぐら型**（獲得時pending→解決）手本 watchtower: triggerOnGain 内で `pending={type:'watchtower',player,card,dest}` → `WATCHTOWER` reducer が `pd.dest` のゾーン(deck/hand/discard)から removeOne して trash/topdeck/keep。**dest を持たせ正しいゾーンから取り出すのが肝**。
**獲得リアクション**（他人の獲得で反応）手本 blockade（delayedEffects走査で呪い配布）/pirate（他人の財宝獲得で手札から反応）。持続予約は `armDuration(state,pi,type,extra)` → `p.delayedEffects.push({card,type,...extra})`。

**アタック**（witch手本＝コピー元）:
- applyEffect: draw等の後 `for(k=1..n-1) vics.push((pi+k)%n); witchEnterVictim(state,pi,vics);`
- `xxxEnterVictim(state,source,queue)`: `queue.filter(v=>!attackImmune(state,v))`（灯台免疫除外）→ 先頭が `hasReaction`（moat/secret_chamber/diplomat）なら `pending={type:'xxx',stage:'react',player:victim,source,victim,queue:rest}`、無ければ `xxxApply` で即適用し**残りキューで再帰**。
- `ATTACKS` 登録表（`js/engine.js` `const ATTACKS = {...}`）に1行 `xxx:{ onMoat:(s,pd)=>xxxEnterVictim(s,pd.source,pd.queue) }`（民兵/拷問人型は `embedded:true`＋onMoat=advanceXxx）。
- `XXX_REACT` reducer（そのまま受ける＝EnterVictim(残り)）＋ PLAYER_ACTIONS ＋ CPU（`p.hand.includes('moat')?{type:'MOAT_REVEAL'}:{type:'XXX_REACT'}`。charlatan が最短雛形）＋ UI（`modalOptions(..., reactOptions(p,pd,{type:'XXX_REACT'}))` ＝堀/秘密の小部屋/外交官ボタン自動生成）。
- 堀無効化は共通 `MOAT_REVEAL` が `ATTACKS[pd.type].onMoat` を引く＝**個別分岐を書かない**。登録漏れは整合性テスト（react型は ATTACKS 登録済み）が即赤。

**on-trash / on-discard は現状フック未実装**（要塞/市場の広場/回廊が未実装のため）。`trashOwn` は共通ルータだがトリガー未呼び出し、かつアタックの他人廃棄（詐欺師/破壊工作員/山賊）は別経路。→ **本人の任意廃棄だけに限定**して新フック `triggerOnTrash` を呼ぶのが安全（PROGRESS §6 警告）。triggerOnGain の構造（depthガード＋全席ループ＋自手番ゲート＋対話ゲート）を流用。

---

## C. 供給の山・セットアップ・トークン・CARD_SET

**initSupply(num,kingdom)**: `supply`＝id→残数の辞書。勝利点山 v=(2人8/多12)。王国は勝利点なら v・他10。条件付き: potionカードあれば `supply.potion=16`／繁栄カードあれば `platinum=12,colony=v`（**「その拡張が王国にあるか」で基本サプライに足す一箇所パターン**）。
**減少**: `gain()` が唯一の入口（`supply[id]<=0`ガード→-1→push→triggerOnGain）。BUYはコスト/buys/potion/canBuyCard検証後 gain。
**終了判定**: `emptyPileCount` は **supply全キー**を数える／`isGameOver`（province<=0 or 空山>=3 or 150手番安全網）。

**特殊山の足し方**:
- **均質な非サプライ山**（戦利品/狂人/傭兵/賞品Prizes各1）＝ `supply` に数値キーで足す（保存則tallyは自動計上＝テスト改変不要）。ただし **(a) `emptyPileCount` から `NON_SUPPLY` set で除外**（3山終了に混ぜない）、**(b) `canBuyCard` で購入不可**。
- **混合山**（廃墟Ruins/騎士Knights＝中身と順序が違う）＝ `state.ruins`/`state.knights` を**top-level id配列**（blackMarket型）。生成は createInitialState で shuffle、獲得は `state.ruins.shift()`。**`test/invariants.test.js` の tally に `(s.ruins||[]).forEach(add)` を追加必須**（漏れると保存則が誤検知で赤）。maskStateFor で伏せる、`emptyPileCount` に `+(ruins.length===0?1:0)` を明示加算。
- **避難所Shelters**＝供給山でなく**開始デッキ置換**（createInitialState の `for(...) start.push('estate')` を条件で `hovel/necropolis/overgrown_estate` に）。deck開始なので保存則自動。DOM.CARDS定義・GAIN_ORDER・POOL所属・マスクは別途。
- 非サプライ・非プールの新カードを足すなら integrity の base 除外リスト（copper/silver/gold/estate/duchy/province/curse/potion/platinum/colony）に追記が要る場合あり。

**per-playerトークン**（VP/Coffers/Villagers）: createInitialState の player に `vpTokens:0` の隣へ `coffers:0` 等。付与は `p.coffers=(p.coffers||0)+n`（記念碑が手本）。**消費するトークン（Coffers購入時/Villagersアクション時）は新 action（例 `COFFERS_SPEND`）＋PLAYER_ACTIONS＋CPU消費＋UIボタンの4点セット**。vpTokensは vpOf に加算・Coffersは加算しない。マスク不要（公開）。

**1拡張を playable に**（海辺/繁栄と同じ）: (1)全カード定義 (2)固定推奨10種 `DOM.KINGDOM_X`（integrityがちょうど10種要求）(3)`DOM.POOLS.x`（孤立から昇格＝実体同じ）(4)`DOM.CARD_SETS` に2行（固定 `{id:'x',kind:'standard',kingdom:DOM.KINGDOM_X}` ＋ランダム `{id:'random-x',kind:'random',randomFrom:['x']}`）(5)基本サプライ追加が要るなら initSupply に条件節 (6)GAIN_ORDER を実強度順の正しい位置へ (7)各カード効果実装。

---

## D. 持続・command・可変VP・テスト

**持続**（captain/church）: `armDuration(state,pi,type,extra)` で `delayedEffects` に予約 → 次の自手番開始で `DURATION_RESOLVERS[type](s,pi,e)` 発火。物理カードの持ち越し（durationCards）と捨て札は `cleanupAndAdvance` が残予約数で**自動処理**（カード側で書かない）。
- 非対話（商船 merchant_ship）: applyEffect `t.coins+=2; armDuration(state,pi,'merchant_ship');` ＋ RESOLVER `merchant_ship:(s,pi)=>{s.turn.coins+=2;}`。
- 対話（潮だまり tide_pools）: RESOLVER 内で `state.pending` を直接立てず **`s.turn.startQueue.push({type:'xxx',player:pi})`**（複数持続の対話競合を popStartQueue が順に pending 化）。extra に脇置きid（haven の e.stashed / blockade の e.gained が手本）。

**command系**（玉座/王の宮廷/procession/band_of_misfits/captain）: `state.replay` キュー＋`runReplays`（pendingが無いとき replay を1件ずつ shift して applyEffect 再実行）。**「applyEffectをforで複数回」ではなく「1回applyEffect＋残りを state.replay.push」**（1回目が pending を立てても解消後に自動で次回＝玉座×アタックも正しく連鎖）。
- 玉座 THRONE_CHOOSE: 手札→場移動→1回目 applyEffect→`state.replay.push({player,card})`。王の宮廷は push×2。
- 「他カードをプレイ」（procession/band_of_misfits/captain）: golemPlay / VASSAL_PLAY（別位置のカードを inPlay に移して applyEffect）が雛形。procession の trash→+1コスト獲得は玉座＋後処理（remodelの2段pending型）。
- **`t.actionsPlayed+=1`（共謀者判定）を忘れない**。アクション権 t.actions は玉座/ゴーレム/家臣とも消費しない。self-trash系は removeOne 戻り値チェック（treasure_map の教訓＝2回目に場に無い→保存則違反）。

**可変VP**: 全得点は `vpOf(p)` 一箇所（`allCards(p)`＝deck/hand/discard/inPlay/durationCards/setAside/マット全部が対象）。固定VPは定義の `vp:`。可変は1ブロック追加（duke/gardens/vineyard が手本）:
- fairgrounds: `異なる名前数(new Set(cards).size)/5 の切り捨て ×2 ×枚数`
- silk_road: `勝利点カード数/4 切り捨て ×枚数`
- feodum: `銀貨数/3 切り捨て ×枚数`

**テスト**: `test/<拡張>.test.js` を `test/seaside.test.js` に倣う（vm sandbox に cards→engine→cpu load＋`Math.random`を固定シード＋`ok(cond,msg)`＋末尾 `if(fail>0) process.exit(1)`）。持続は `playDurationAndAdvance` 型、可変VPは状態直組みで `E.vpOf(p)` 検証（alchemy.test.js:131 が手本）。**`package.json` の test スクリプト（スイート列挙）に追加**。UIは `test/<拡張>-ui.test.js`（jsdom）を alchemy-ui.test.js に倣う。

---

## 落とし穴（CI赤 / CPU無限ループ / 人間詰みの元）
- pending を立てたら `*_RESOLVE` で必ず `state.pending=null`。閉じ忘れ＝無限ロック。
- 新 pending は **engine reducer＋PLAYER_ACTIONS登録＋CPU decidePending分岐＋UI viewPendingModal分岐 の4点必須**（CPU漏れ=無限ループ、UI漏れ=人間詰み、PLAYER_ACTIONS漏れ=サーバ拒否＆integrity赤）。
- `action.type` は大文字/数字/_のみ（integrityの正規表現）。reduce case と PLAYER_ACTIONS はセットで足す。
- DOM.CARDS に足したら GAIN_ORDER にも（同一集合でないと赤）。
- 獲得pendingを立てる前に `anyGainable()`。獲得は必ず `gain()`/`finishGain()`。
- 獲得時対話は on-gain 対話ゲート `_gainDepth===1 && !pending && pi===turn.active` の中で。
- アタックの stage:'react' は ATTACKS に onMoat 登録（漏れ=堀無効＆integrity赤）。
- 混合山（Ruins/Knights）は invariants.test.js の tally に forEach(add) 追加（漏れ=保存則誤検知赤）。均質山は supply数値キーなら自動。supply数値キーの非サプライは emptyPileCount と canBuyCard から除外。
- 特殊山は maskStateFor で伏せる。
- reducer は action入力を検証してから処理（不正は return state で状態不変）。
- 対話持続は DURATION_RESOLVERS 内で pending を直接立てず startQueue に push。
- command系は replay キュー（同期forは玉座×アタックで pending 上書き）。t.actionsPlayed 加算・self-trashは removeOne 戻り値チェック。
- client資産（js等）を変えたら `sw.js` VERSION を上げる。
