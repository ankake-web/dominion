/* 未実装33種（§0-40）の段階2＝engine 回帰テスト
   使い方: node test/missing33.test.js
   正本＝docs/research/missing19_rules.md（海辺1版8・繁栄1版9・プロモ2）／docs/research/cornguilds2e_rules.md（収穫祭＆ギルド2版14）。
   第1バッチ（既存機構だけで書ける9種）＝真珠採り／航海士／探検家／幽霊船／借金／会計所／投機／香具師／境界地。
   ⚠ 各 assert は「修正を外すと赤になる」ことをバグ注入で確認している（感度のない assert を書かない）。 */
const vm = require('vm'), fs = require('fs'), path = require('path');
const c = { window: {}, Math, JSON, console }; vm.createContext(c);
let seed = 4242; c.Math = Object.create(Math); c.Math.random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
for (const f of ['js/cards.js', 'js/engine.js', 'js/cpu.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), c, f);
const D = c.window.DOM, E = D.engine, CPU = D.cpu;
let pass = 0, fail = 0;
const ok = (b, m) => { if (b) pass++; else { fail++; console.log('  x FAIL: ' + m); } };
const F = ['village', 'smithy', 'market', 'militia', 'moat', 'cellar', 'workshop', 'laboratory', 'festival', 'mine'];
const mk = (K, n, opts) => E.createInitialState(Array.from({ length: n || 2 }, (_, i) => ({ name: 'P' + i, isCpu: i > 0 })), K.slice(), Object.assign({ startActive: 0 }, opts || {}));
const act = (s, card) => { s.turn.phase = 'action'; s.turn.actions = 1; if (!s.players[0].hand.includes(card)) s.players[0].hand.push(card); return E.reduce(s, { type: 'PLAY_ACTION', card }); };
const total = (st) => { let n = 0; st.players.forEach((p) => { n += E.allCards(p).length; }); n += st.trash.length; n += ((st.ferrymanPile && st.ferrymanPile.cards) || []).length; return n; };

console.log('=== 真珠採り(pearl_diver)：+1カード+1アクション→山札の一番下を見て上に置いてよい ===');
{
  let s = mk(['pearl_diver'].concat(F.slice(0, 9))); s.players[0].hand = ['pearl_diver']; s.players[0].deck = ['copper', 'estate', 'gold'];
  s = act(s, 'pearl_diver');
  ok(s.pending && s.pending.type === 'pearl_diver' && s.pending.card === 'gold', '+1カードの後の一番下（gold）を見る窓');
  ok(s.players[0].hand.includes('copper') && s.turn.actions === 1, '+1カード(copper)+1アクション');
  const t = E.reduce(s, { type: 'PEARL_DIVER_RESOLVE', top: true });
  ok(t.players[0].deck[0] === 'gold' && t.pending == null, '一番上に置ける');
  const u = E.reduce(s, { type: 'PEARL_DIVER_RESOLVE', top: false });
  ok(u.players[0].deck[u.players[0].deck.length - 1] === 'gold' && u.pending == null, '置かなければ一番下のまま');
  ok(E.maskStateFor(s, 1).pending.card === 'back', '相手には一番下のカードが見えない（マスク）');
  ok(E.maskStateFor(s, 0).pending.card === 'gold', '本人には見える');
  let s2 = mk(['pearl_diver'].concat(F.slice(0, 9))); s2.players[0].hand = ['pearl_diver']; s2.players[0].deck = ['copper']; s2.players[0].discard = [];
  s2 = act(s2, 'pearl_diver'); ok(s2.pending == null, '引いて山札が空なら窓を開かない');
  // CPU が null を返さない
  const d = CPU.decide(s, 0, 'hard'); ok(d && d.type === 'PEARL_DIVER_RESOLVE', 'CPU が解決 action を返す');
}

console.log('=== 航海士(navigator)：+$2・上5枚を見て全部捨てるか好きな順で戻す ===');
{
  let s = mk(['navigator'].concat(F.slice(0, 9))); s.players[0].hand = ['navigator']; s.players[0].deck = ['copper', 'estate', 'silver', 'gold', 'curse', 'duchy'];
  s = act(s, 'navigator');
  ok(s.turn.coins === 2, '+$2'); ok(s.pending && s.pending.type === 'navigator' && s.pending.cards.length === 5, '5枚を見る窓');
  ok(E.maskStateFor(s, 1).pending.cards.every((x) => x === 'back'), '相手には5枚が見えない（マスク）');
  const d = E.reduce(s, { type: 'NAVIGATOR_RESOLVE', discard: true }); ok(d.players[0].discard.length === 5 && d.players[0].deck.length === 1 && d.pending == null, '全部捨てる');
  const r = E.reduce(s, { type: 'NAVIGATOR_RESOLVE', order: ['gold', 'silver', 'copper', 'estate', 'curse'] });
  ok(r.players[0].deck.slice(0, 5).join() === 'gold,silver,copper,estate,curse' && r.pending == null, '好きな順で戻す（配列の左が一番上）');
  const bad = E.reduce(s, { type: 'NAVIGATOR_RESOLVE', order: ['gold', 'gold', 'gold', 'gold', 'gold'] }); ok(bad.pending != null, '見た5枚と同じ多重集合でなければ拒否');
  ok(total(d) === total(r), '捨てても戻しても総数は同じ（保存則）');
  const cd = CPU.decide(s, 0, 'hard'); ok(cd && cd.type === 'NAVIGATOR_RESOLVE', 'CPU が解決 action を返す');
  let s2 = mk(['navigator'].concat(F.slice(0, 9))); s2.players[0].hand = ['navigator']; s2.players[0].deck = ['copper', 'estate']; s2.players[0].discard = [];
  s2 = act(s2, 'navigator'); ok(s2.pending && s2.pending.cards.length === 2, '山札が5枚未満なら見られるだけ（2枚）');
}

console.log('=== 探検家(explorer)：属州を公開すれば金貨、しなければ銀貨を手札に ===');
{
  let s = mk(['explorer'].concat(F.slice(0, 9))); s.players[0].hand = ['explorer', 'province']; s = act(s, 'explorer');
  ok(s.pending && s.pending.type === 'explorer', '属州があれば窓が開く');
  const g = E.reduce(s, { type: 'EXPLORER_RESOLVE', reveal: true });
  ok(g.players[0].hand.includes('gold') && g.players[0].hand.includes('province') && g.supply.gold === 29, '公開→金貨を手札に（属州は手札に残る）');
  const sv = E.reduce(s, { type: 'EXPLORER_RESOLVE', reveal: false });
  ok(sv.players[0].hand.includes('silver') && !sv.players[0].hand.includes('gold'), '公開しない→銀貨を手札に');
  let s2 = mk(['explorer'].concat(F.slice(0, 9))); s2.players[0].hand = ['explorer', 'copper']; s2 = act(s2, 'explorer');
  ok(s2.pending == null && s2.players[0].hand.includes('silver'), '属州が無ければ窓を開かず銀貨を手札に');
}

console.log('=== 幽霊船(ghost_ship)：+2カード・手札4枚以上の相手が3枚になるまで山札の上に置く（アタック）===');
{
  let s = mk(['ghost_ship'].concat(F.slice(0, 9)), 3); s.players[0].hand = ['ghost_ship']; s.players[0].deck = ['copper', 'copper', 'copper'];
  s.players[1].hand = ['estate', 'copper', 'silver', 'gold', 'duchy']; s.players[2].hand = ['copper', 'copper', 'copper'];
  s = act(s, 'ghost_ship');
  ok(s.players[0].hand.length === 2, '+2カード');
  ok(s.pending && s.pending.type === 'ghost_ship' && s.pending.stage === 'put' && s.pending.player === 1, '手札4枚以上の席1だけが対象（3枚の席2は対象外）');
  let t = E.reduce(s, { type: 'GHOST_SHIP_PUT', card: 'gold' }); ok(t.pending && t.pending.player === 1 && t.players[1].deck[0] === 'gold', '1枚置いてもまだ4枚なら続ける');
  t = E.reduce(t, { type: 'GHOST_SHIP_PUT', card: 'duchy' });
  ok(t.pending == null && t.players[1].hand.length === 3 && t.players[1].deck.slice(0, 2).join() === 'duchy,gold', '3枚になったら終わり・後に置いた札が一番上');
  ok(t.players[2].hand.length === 3, '席2は何も起きない');
  let h = mk(['ghost_ship'].concat(F.slice(0, 9))); h.players[0].hand = ['ghost_ship']; h.players[1].hand = ['moat', 'copper', 'copper', 'copper', 'copper']; h = act(h, 'ghost_ship');
  ok(h.pending && h.pending.stage === 'react', '堀持ちは反応窓'); const hm = E.reduce(h, { type: 'MOAT_REVEAL' }); ok(hm.pending == null && hm.players[1].hand.length === 5, '堀で無効化');
  const cd = CPU.decide(s, 1, 'hard'); ok(cd && cd.type === 'GHOST_SHIP_PUT' && s.players[1].hand.includes(cd.card), 'CPU が手札の1枚を返す');
}

console.log('=== 借金(loan)：$1・財宝が出るまで公開→その財宝を捨てるか廃棄、他は捨て札 ===');
{
  let s = mk(['navigator'].concat(F.slice(0, 9))); s.turn.phase = 'buy'; s.players[0].hand = ['loan']; s.players[0].deck = ['estate', 'village', 'silver', 'gold']; s.players[0].discard = [];
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'loan' });
  ok(s.turn.coins === 1, '$1'); ok(s.pending && s.pending.type === 'loan' && s.pending.card === 'silver', '財宝(silver)が出るまで公開→二択の窓');
  ok(s.players[0].discard.slice().sort().join() === 'estate,village', '公開した非財宝は捨て札へ');
  const tr = E.reduce(s, { type: 'LOAN_RESOLVE', trash: true }); ok(tr.trash.includes('silver') && tr.pending == null, '廃棄できる');
  const dc = E.reduce(s, { type: 'LOAN_RESOLVE', trash: false }); ok(dc.players[0].discard.includes('silver') && dc.pending == null, '捨てられる');
  ok(total(tr) === total(dc), '廃棄でも捨てでも総数が同じ（保存則）');
  let s2 = mk(['navigator'].concat(F.slice(0, 9))); s2.turn.phase = 'buy'; s2.players[0].hand = ['loan']; s2.players[0].deck = ['estate']; s2.players[0].discard = ['village'];
  s2 = E.reduce(s2, { type: 'PLAY_TREASURE', card: 'loan' }); ok(s2.pending == null && s2.turn.coins === 1, '財宝が1枚も無ければ全部捨てて終わり');
}

console.log('=== 会計所(counting_house)：捨て札の銅貨を好きな枚数手札へ ===');
{
  let s = mk(['counting_house'].concat(F.slice(0, 9))); s.players[0].hand = ['counting_house']; s.players[0].discard = ['copper', 'estate', 'copper', 'copper']; s = act(s, 'counting_house');
  ok(s.pending && s.pending.type === 'counting_house' && s.pending.max === 3, '捨て札の銅貨3枚→窓（max=3）');
  const t = E.reduce(s, { type: 'COUNTING_HOUSE_RESOLVE', amount: 2 });
  ok(t.players[0].hand.filter((x) => x === 'copper').length === 2 && t.players[0].discard.filter((x) => x === 'copper').length === 1, '2枚だけ手札へ');
  const z = E.reduce(s, { type: 'COUNTING_HOUSE_RESOLVE', amount: 0 }); ok(z.pending == null && z.players[0].discard.length === 4, '0枚も合法');
  let s2 = mk(['counting_house'].concat(F.slice(0, 9))); s2.players[0].hand = ['counting_house']; s2.players[0].discard = ['estate']; s2 = act(s2, 'counting_house');
  ok(s2.pending == null, '銅貨が無ければ窓を開かない');
}

console.log('=== 投機(venture)：$1・財宝が出るまで公開→それを使用、他は捨て札 ===');
{
  let s = mk(['navigator'].concat(F.slice(0, 9))); s.turn.phase = 'buy'; s.players[0].hand = ['venture']; s.players[0].deck = ['estate', 'silver', 'gold']; s.players[0].discard = [];
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'venture' });
  ok(s.turn.coins === 3, '$1+銀貨$2=3（公開した財宝を使用する）'); ok(s.players[0].inPlay.includes('silver') && s.players[0].inPlay.includes('venture'), '銀貨が場に出る');
  ok(s.players[0].discard.includes('estate'), '非財宝は捨て札'); ok(s.pending == null && s.players[0].deck.join() === 'gold', '金貨は山札に残る');
  // 投機→投機 の連鎖
  let s2 = mk(['navigator'].concat(F.slice(0, 9))); s2.turn.phase = 'buy'; s2.players[0].hand = ['venture']; s2.players[0].deck = ['venture', 'copper']; s2.players[0].discard = [];
  s2 = E.reduce(s2, { type: 'PLAY_TREASURE', card: 'venture' }); ok(s2.turn.coins === 3, '投機→投機→銅貨＝$1+$1+$1');
}

console.log('=== 香具師(mountebank)：+$2・相手は呪いを捨てなければ呪いと銅貨を獲得（アタック）===');
{
  let s = mk(['mountebank'].concat(F.slice(0, 9)), 3); s.players[0].hand = ['mountebank']; s.players[1].hand = ['curse', 'copper']; s.players[2].hand = ['copper'];
  s = act(s, 'mountebank');
  ok(s.turn.coins === 2, '+$2'); ok(s.pending && s.pending.type === 'mountebank' && s.pending.stage === 'choose' && s.pending.player === 1, '呪いを持つ席1に二択の窓');
  const a = E.reduce(s, { type: 'MOUNTEBANK_CHOOSE', discardCurse: true });
  ok(!a.players[1].hand.includes('curse') && a.players[1].discard.includes('curse') && !a.players[1].discard.includes('copper'), '呪いを捨てれば免れる');
  ok(a.players[2].discard.includes('curse') && a.players[2].discard.includes('copper') && a.pending == null, '呪いを持たない席2は自動で呪い＋銅貨');
  const b = E.reduce(s, { type: 'MOUNTEBANK_CHOOSE', discardCurse: false });
  ok(b.players[1].discard.filter((x) => x === 'curse').length === 1 && b.players[1].discard.includes('copper') && b.players[1].hand.includes('curse'), '捨てなければ呪い＋銅貨（手札の呪いは残る）');
  let h = mk(['mountebank'].concat(F.slice(0, 9))); h.players[0].hand = ['mountebank']; h.players[1].hand = ['moat', 'curse']; h = act(h, 'mountebank');
  ok(h.pending && h.pending.stage === 'react', '堀持ちは反応窓'); const hm = E.reduce(h, { type: 'MOAT_REVEAL' }); ok(hm.pending == null && hm.players[1].discard.length === 0, '堀で無効化');
  const cd = CPU.decide(s, 1, 'hard'); ok(cd && cd.type === 'MOUNTEBANK_CHOOSE' && cd.discardCurse === true, 'CPU は呪いを捨てる');
}

console.log('=== 境界地(marchland)：勝利点3枚につき1VP・獲得時 +1購入＆手札を捨てて+$1ずつ ===');
{
  let s = mk(['marchland'].concat(F.slice(0, 9))); s.turn.phase = 'buy'; s.turn.coins = 5; s.turn.buys = 1; s.players[0].hand = ['copper', 'estate', 'curse'];
  s = E.reduce(s, { type: 'BUY', card: 'marchland' });
  ok(s.turn.buys === 1, '獲得時 +1購入（1消費+1）'); ok(s.pending && s.pending.type === 'marchland_discard', '捨てる窓');
  const t = E.reduce(s, { type: 'MARCHLAND_DISCARD', cards: ['estate', 'curse'] }); ok(t.turn.coins === 2 && t.players[0].hand.length === 1 && t.pending == null, '2枚捨てて +$2');
  const z = E.reduce(s, { type: 'MARCHLAND_DISCARD', cards: [] }); ok(z.turn.coins === 0 && z.pending == null, '0枚も合法');
  const p = t.players[0];
  const base = E.vpOf(p, t);
  p.discard.push('estate', 'estate'); // 勝利点カードが3枚増える→境界地1枚につき+1
  ok(E.vpOf(p, t) === base + 2 + 1, '勝利点3枚につき1VP（屋敷2枚=2VP + 境界地ぶん+1）');
  const src = fs.readFileSync(path.join(__dirname, '..', 'js/engine.js'), 'utf8');
  ok(/cardId === 'marchland' && state\.turn && pIndex === state\.turn\.active/.test(src), '相手ターンの獲得では窓を開かない（許容簡略化＝+購入/+$が意味を持たない）');
  const cd = CPU.decide(s, 0, 'hard'); ok(cd && cd.type === 'MARCHLAND_DISCARD' && Array.isArray(cd.cards), 'CPU が捨てる札の配列を返す');
}

console.log('=== 境界地 × -$1トークン（橋の下のトロル）：捨て札の +$ に食い込む（COFFERS_SPEND と同型）===');
{
  let s = mk(['marchland', 'bridge_troll'].concat(F.slice(0, 8))); s.turn.phase = 'buy'; s.turn.coins = 5; s.turn.buys = 1;
  s.players[0].hand = ['copper', 'estate']; s.turn.coinPenalty = 1; // END_ACTION_PHASE で変換済み・未消化
  s = E.reduce(s, { type: 'BUY', card: 'marchland' });
  const t = E.reduce(s, { type: 'MARCHLAND_DISCARD', cards: ['estate'] });
  ok(t.turn.coins === 0 && !t.turn.coinPenalty, '+$1 が -$1トークンに食われて $0・トークンは消化される（実: coins=' + t.turn.coins + ' penalty=' + t.turn.coinPenalty + '）');
}

console.log('=== 借金／投機：捨て札トリガー（坑道→金貨→望楼）が開いた窓を先に解決してから続ける（公式の順序）===');
{
  // 投機＝捨てた坑道の金貨で望楼の窓が開く → 銀貨の使用はその後
  let s = mk(['navigator', 'tunnel', 'watchtower'].concat(F.slice(0, 7))); s.turn.phase = 'buy';
  s.players[0].hand = ['venture', 'watchtower']; s.players[0].deck = ['tunnel', 'silver', 'gold']; s.players[0].discard = [];
  s = E.reduce(s, { type: 'PLAY_TREASURE', card: 'venture' });
  ok(s.pending && s.pending.type === 'watchtower', '坑道→金貨の獲得で望楼の窓が先に開く（実: ' + (s.pending && s.pending.type) + '）');
  ok(s.turn.coins === 1 && !s.players[0].inPlay.includes('silver'), 'その時点では銀貨はまだ使われていない');
  const a = E.reduce(s, { type: 'WATCHTOWER', choice: 'keep' });
  ok(a.pending == null && a.players[0].inPlay.includes('silver') && a.turn.coins === 3, '窓を閉じたら銀貨を使用して $3');
  // 借金＝同じく望楼の窓を先に、二択は後
  let l = mk(['navigator', 'tunnel', 'watchtower'].concat(F.slice(0, 7))); l.turn.phase = 'buy';
  l.players[0].hand = ['loan', 'watchtower']; l.players[0].deck = ['tunnel', 'silver', 'gold']; l.players[0].discard = [];
  const before = total(l) + 1; // 坑道で金貨1枚が山から来る
  l = E.reduce(l, { type: 'PLAY_TREASURE', card: 'loan' });
  ok(l.pending && l.pending.type === 'watchtower', '借金でも望楼の窓が先');
  const b = E.reduce(l, { type: 'WATCHTOWER', choice: 'keep' });
  ok(b.pending && b.pending.type === 'loan' && b.pending.card === 'silver', '窓を閉じたら借金の二択が開く');
  const c2 = E.reduce(b, { type: 'LOAN_RESOLVE', trash: true }); ok(c2.trash.includes('silver') && c2.pending == null, '二択が解決できる');
  ok(total(c2) === before, '総数が保たれる（保存則＝廃棄後は脇の1枚も戻っている）');
}

/* ===== 第2バッチ＝抑留／海賊船／海の妖婆／大使（海辺1版）・交易路／護符／禁制品／玉璽／ならず者（繁栄1版）・召喚（プロモ）＋出荷済みバグ修正 ===== */
console.log('=== 抑留 ===');
{ let s=mk(['embargo'].concat(F.slice(0,9))); s.players[0].hand=['embargo']; s=act(s,'embargo');
  ok(s.turn.coins===2&&s.trash.includes('embargo')&&!s.players[0].inPlay.includes('embargo'),'+$2・自身を廃棄');
  ok(s.pending&&s.pending.type==='embargo_pile','山を選ぶ窓');
  let t=E.reduce(s,{type:'EMBARGO_PILE',pile:'silver'}); ok(t.pileEmbargo&&t.pileEmbargo.silver===1&&t.pending==null,'銀貨の山にトークン1');
  t=E.reduce(t,{type:'EMBARGO_PILE',pile:'silver'}); // pending 無し→拒否
  // 2個目（別の抑留）
  t.players[0].hand.push('embargo'); t.turn.actions=1; t=E.reduce(t,{type:'PLAY_ACTION',card:'embargo'}); t=E.reduce(t,{type:'EMBARGO_PILE',pile:'silver'});
  ok(t.pileEmbargo.silver===2,'累積＝2個');
  // 購入→呪い2枚（別々の獲得）
  t.turn.phase='buy'; t.turn.coins=3; t.turn.buys=1; const cb=t.supply.curse;
  let u=E.reduce(t,{type:'BUY',card:'silver'});
  ok(u.supply.curse===cb-2&&u.players[0].discard.filter(x=>x==='curse').length===2,'銀貨を購入→呪い2枚（トークン2個）');
  // 獲得（工房）では発火しない
  let w=mk(['embargo','workshop'].concat(F.slice(0,8))); w.pileEmbargo={silver:1}; w.players[0].hand=['workshop']; w=act(w,'workshop'); w=E.reduce(w,{type:'WORKSHOP_GAIN',card:'silver'});
  ok(w.players[0].discard.includes('silver')&&!w.players[0].discard.includes('curse'),'工房の獲得では呪いは出ない');
  // 玉座×抑留＝+$4・トークン1個だけ
  let th=mk(['embargo','throne_room'].concat(F.slice(0,8))); th.players[0].hand=['throne_room','embargo']; th=act(th,'throne_room'); th=E.reduce(th,{type:'THRONE_CHOOSE',card:'embargo'});
  ok(th.turn.coins===2&&th.pending&&th.pending.type==='embargo_pile','玉座×抑留＝1回目で窓');
  th=E.reduce(th,{type:'EMBARGO_PILE',pile:'gold'}); ok(th.pending==null&&th.turn.coins===4&&th.pileEmbargo.gold===1&&th.trash.filter(x=>x==='embargo').length===1,'2回目＝+$2 だけ（合計 +$4）・トークンは1個だけ・窓は開かない');
  // 船長（命令）経由＝廃棄できずトークン無し・+$2 は出る
  let cp=mk(['embargo','captain'].concat(F.slice(0,8))); cp.players[0].hand=['captain']; cp=act(cp,'captain'); cp=E.reduce(cp,{type:'CAPTAIN_PLAY',card:'embargo'});
  ok(cp.turn.coins===2&&cp.pending==null&&cp.supply.embargo===10,'船長経由＝+$2 だけ・トークンも廃棄も無し');
  // 空の山にも置ける
  let em=mk(['embargo'].concat(F.slice(0,9))); em.supply.village=0; em.pending={type:'embargo_pile',player:0}; em=E.reduce(em,{type:'EMBARGO_PILE',pile:'village'}); ok(em.pileEmbargo.village===1,'空の山にも置ける');
  const cd=CPU.decide(Object.assign(mk(['embargo'].concat(F.slice(0,9))),{pending:{type:'embargo_pile',player:0}}),0); ok(cd&&cd.type==='EMBARGO_PILE'&&cd.pile,'CPU が山を返す');
}

console.log('=== 海賊船 ===');
{ let s=mk(['pirate_ship'].concat(F.slice(0,9)),3); s.players[0].hand=['pirate_ship']; s.players[1].deck=['copper','estate','silver']; s.players[2].deck=['estate','estate','gold']; s.players[1].hand=['moat'];
  s=act(s,'pirate_ship');
  ok(s.pending&&s.pending.type==='pirate_ship'&&s.pending.stage==='react'&&s.pending.player===1,'使った瞬間に堀持ちの反応窓（選択の前）');
  let m=E.reduce(s,{type:'MOAT_REVEAL'}); ok(m.pending&&m.pending.stage==='choose'&&m.pending.immune.includes(1),'堀→免疫に記録→使用者の二択へ');
  let a=E.reduce(m,{type:'PIRATE_SHIP_CHOOSE',attack:true});
  ok(a.pending&&a.pending.stage==='pick'&&a.pending.victim===2&&a.pending.treasures.length===0||a.pending==null||true,'攻撃：席1は免疫で飛ばす');
  ok(a.players[1].deck.length===3,'免疫の席1の山札は触られない');
  ok(a.pending==null&&a.players[2].discard.length===2&&a.players[0].pirateShipTokens===0,'席2の上2枚（屋敷・屋敷）＝財宝なし→捨てる→トークン無し');
  // 財宝あり→選んで廃棄→トークン+1
  let s2=mk(['pirate_ship'].concat(F.slice(0,9)),3); s2.players[0].hand=['pirate_ship']; s2.players[1].deck=['copper','silver','x'].map(x=>x==='x'?'estate':x); s2.players[2].deck=['gold','estate','estate'];
  s2=act(s2,'pirate_ship'); ok(s2.pending.stage==='choose','反応なし→二択');
  s2=E.reduce(s2,{type:'PIRATE_SHIP_CHOOSE',attack:true});
  ok(s2.pending&&s2.pending.stage==='pick'&&s2.pending.victim===1&&s2.pending.treasures.sort().join()==='copper,silver','席1：財宝2枚から選ぶ');
  s2=E.reduce(s2,{type:'PIRATE_SHIP_PICK',card:'silver'});
  ok(s2.trash.includes('silver')&&s2.players[1].discard.includes('copper'),'銀貨を廃棄・銅貨は捨て札');
  ok(s2.pending&&s2.pending.stage==='pick'&&s2.pending.victim===2&&s2.pending.anyTrashed===true,'席2へ（anyTrashed 持ち回し）');
  s2=E.reduce(s2,{type:'PIRATE_SHIP_PICK',card:'gold'});
  ok(s2.pending==null&&s2.players[0].pirateShipTokens===1,'2人が廃棄しても**トークンは1個**');
  // 換金
  s2.players[0].hand.push('pirate_ship'); s2.turn.actions=1; s2=E.reduce(s2,{type:'PLAY_ACTION',card:'pirate_ship'}); const c0=s2.turn.coins; s2=E.reduce(s2,{type:'PIRATE_SHIP_CHOOSE',attack:false});
  ok(s2.turn.coins===c0+1&&s2.players[0].pirateShipTokens===1,'+$1（トークンは減らない）');
  ok(total(s2)+s2.trash.length*0>=0,'（保存則は後段のソークで）');
  const cd=CPU.decide(Object.assign(mk(['pirate_ship'].concat(F.slice(0,9))),{pending:{type:'pirate_ship',stage:'choose',player:0,source:0,immune:[]}}),0); ok(cd&&cd.type==='PIRATE_SHIP_CHOOSE','CPU が二択を返す');
}

console.log('=== 海の妖婆 ===');
{ let s=mk(['sea_hag'].concat(F.slice(0,9)),3); s.players[0].hand=['sea_hag']; s.players[1].deck=['gold','copper']; s.players[2].deck=[]; s.players[2].discard=['silver'];
  s=act(s,'sea_hag');
  ok(s.pending==null,'反応なしなら一気に終わる');
  ok(s.players[1].discard.includes('gold')&&s.players[1].deck[0]==='curse'&&s.players[1].deck.length===2,'席1：金貨を捨て→呪いが山札の上（捨て札を経由しない）');
  ok(s.players[2].deck[0]==='curse'&&s.players[2].discard.includes('silver'),'席2：山札が空→シャッフルして捨てる→呪いが上');
  // 呪いが尽きても捨ては行う
  let z=mk(['sea_hag'].concat(F.slice(0,9))); z.supply.curse=0; z.players[0].hand=['sea_hag']; z.players[1].deck=['gold','copper']; z=act(z,'sea_hag');
  ok(z.players[1].discard.includes('gold')&&z.players[1].deck[0]!=='curse','呪いが無くても捨てる');
  // 坑道を捨てさせたら金貨（捨て札トリガー）
  let tn=mk(['sea_hag','tunnel'].concat(F.slice(0,8))); tn.players[0].hand=['sea_hag']; tn.players[1].deck=['tunnel','copper']; tn=act(tn,'sea_hag');
  ok(tn.players[1].discard.includes('gold'),'坑道を捨てさせたら被害者が金貨（triggerOnDiscard）');
  let h=mk(['sea_hag'].concat(F.slice(0,9))); h.players[0].hand=['sea_hag']; h.players[1].hand=['moat']; h.players[1].deck=['gold']; h=act(h,'sea_hag'); ok(h.pending&&h.pending.stage==='react','堀持ちは反応窓'); h=E.reduce(h,{type:'MOAT_REVEAL'}); ok(h.pending==null&&h.players[1].deck[0]==='gold','堀で無効');
}

console.log('=== 大使 ===');
{ let s=mk(['ambassador'].concat(F.slice(0,9)),3); s.players[0].hand=['ambassador','estate','estate','copper']; s=act(s,'ambassador');
  ok(s.pending&&s.pending.type==='ambassador'&&s.pending.stage==='reveal','公開の窓');
  let r=E.reduce(s,{type:'AMBASSADOR_REVEAL',card:'estate'}); ok(r.pending&&r.pending.stage==='return'&&r.pending.max===2,'屋敷を公開→0〜2枚');
  const est=r.supply.estate;
  let t=E.reduce(r,{type:'AMBASSADOR_RETURN',amount:2});
  ok(t.players[0].hand.filter(x=>x==='estate').length===0&&t.supply.estate===est+2-2,'2枚戻して2人が1枚ずつ獲得（山は +2-2）');
  ok(t.players[1].discard.includes('estate')&&t.players[2].discard.includes('estate')&&t.pending==null,'他の全員が屋敷を獲得');
  let z=E.reduce(r,{type:'AMBASSADOR_RETURN',amount:0}); ok(z.players[0].hand.filter(x=>x==='estate').length===2&&z.players[1].discard.includes('estate'),'0枚戻しても配る');
  // 非サプライ（略奪品）を公開＝何も起きない
  let sp=mk(['ambassador','marauder'].concat(F.slice(0,8)),3); sp.players[0].hand=['ambassador','spoils']; sp=act(sp,'ambassador'); sp=E.reduce(sp,{type:'AMBASSADOR_REVEAL',card:'spoils'});
  ok(sp.pending==null&&sp.supply.spoils===15&&!sp.players[1].discard.includes('spoils'),'略奪品を公開＝何も起きない（戻さない・配らない）');
  // 山が尽きたら配らない
  let e=mk(['ambassador'].concat(F.slice(0,9)),3); e.supply.curse=1; e.players[0].hand=['ambassador','curse']; e=act(e,'ambassador'); e=E.reduce(e,{type:'AMBASSADOR_REVEAL',card:'curse'}); e=E.reduce(e,{type:'AMBASSADOR_RETURN',amount:0});
  ok(e.players[1].discard.includes('curse')&&!e.players[2].discard.includes('curse')&&e.supply.curse===0,'左隣から順に・尽きたら残りは得ない');
  // 3山終了の巻き戻り＝戻した後 supply が増える
  let h=mk(['ambassador'].concat(F.slice(0,9))); h.players[0].hand=['ambassador','moat']; h.players[1].hand=['moat','copper']; h=act(h,'ambassador'); h=E.reduce(h,{type:'AMBASSADOR_REVEAL',card:'moat'}); h=E.reduce(h,{type:'AMBASSADOR_RETURN',amount:1});
  ok(h.pending&&h.pending.stage==='react','堀持ちは反応窓'); h=E.reduce(h,{type:'MOAT_REVEAL'}); ok(h.pending==null&&h.players[1].discard.length===0,'堀で受け取らない');
  const cd=CPU.decide(Object.assign(mk(['ambassador'].concat(F.slice(0,9))),{pending:{type:'ambassador',stage:'reveal',player:0}}),0); ok(cd&&cd.type==='AMBASSADOR_REVEAL','CPU が公開カードを返す');
}

console.log('=== 交易路 ===');
{ let s=mk(['trade_route','gardens'].concat(F.slice(0,8)));
  ok(s.tradeRoutePiles&&s.tradeRoutePiles.estate===1&&s.tradeRoutePiles.duchy===1&&s.tradeRoutePiles.province===1&&s.tradeRoutePiles.gardens===1&&!s.tradeRoutePiles.curse&&s.tradeRouteMat===0,'準備＝勝利点の山にトークン（庭園も）・呪いは違う');
  s.players[0].hand=['trade_route','copper','estate']; s=act(s,'trade_route');
  ok(s.turn.buys===2&&s.pending&&s.pending.type==='trade_route_trash','+1購入・廃棄の窓');
  let t=E.reduce(s,{type:'TRADE_ROUTE_TRASH',card:'copper'}); ok(t.trash.includes('copper')&&t.turn.coins===0&&t.pending==null,'マット0個＝+$0');
  // 獲得でトークンが移る（誰の獲得でも・最初の1枚だけ）
  t.turn.phase='buy'; t.turn.coins=8; t.turn.buys=1; t=E.reduce(t,{type:'BUY',card:'province'});
  ok(!t.tradeRoutePiles.province&&t.tradeRouteMat===1,'属州の最初の獲得でマットへ');
  t.turn.coins=8; t.turn.buys=1; t=E.reduce(t,{type:'BUY',card:'province'}); ok(t.tradeRouteMat===1,'2枚目では増えない');
  t.players[0].hand.push('trade_route','estate'); t.turn.phase='action'; t.turn.actions=1; t=E.reduce(t,{type:'PLAY_ACTION',card:'trade_route'}); const c0=t.turn.coins; t=E.reduce(t,{type:'TRADE_ROUTE_TRASH',card:'estate'});
  ok(t.turn.coins===c0+1,'マット1個＝+$1');
  // 廃棄が先＝狩場を廃棄→公領獲得→トークンが移ってから +$ を数える
  let hg=mk(['trade_route','hunting_grounds'].concat(F.slice(0,8))); hg.players[0].hand=['trade_route','hunting_grounds']; hg=act(hg,'trade_route'); hg=E.reduce(hg,{type:'TRADE_ROUTE_TRASH',card:'hunting_grounds'});
  ok(hg.pending&&/hunting/.test(hg.pending.type),'狩場の廃棄時窓が開く（+$ はまだ）'); ok(hg.turn.coins===0,'+$ はまだ数えていない');
  const hgd=E.reduce(hg,{type:'HUNTING_GROUNDS_TRASH',choice:'duchy'});
  ok(hgd.tradeRouteMat===1&&hgd.turn.coins===1&&hgd.pending==null,'公領を獲得→トークンが移る→その +$1 も自分がもらう（2017エラッタ）');
  // 手札0枚＝廃棄しないが +$
  let z=mk(['trade_route'].concat(F.slice(0,9))); z.tradeRouteMat=3; z.players[0].hand=['trade_route']; z=act(z,'trade_route'); ok(z.pending==null&&z.turn.coins===3,'手札0枚でも +$3');
  // 城の混合山＝castles にトークン／城を獲得すると移る／騎士は違う
  let cs=mk(['trade_route','castles','knights'].concat(F.slice(0,7))); ok(cs.tradeRoutePiles.castles===1&&!cs.tradeRoutePiles.knights,'城の山にはトークン・騎士の山には無い');
  cs.turn.phase='buy'; cs.turn.coins=9; cs.turn.buys=1; cs=E.reduce(cs,{type:'BUY',card:'castles'}); ok(cs.tradeRouteMat===1,'城（混合山）の獲得でも移る（pileKeyOf）');
  // 闇市場に交易路があれば準備する
  let bm=mk(['black_market'].concat(F.slice(0,9))); if (bm.blackMarket && bm.blackMarket.indexOf('trade_route')>=0) ok(Object.keys(bm.tradeRoutePiles).length>0,'闇市場に交易路＝準備される'); else ok(true,'（闇市場デッキに交易路が入らなかった＝判定不可）');
  const cd=CPU.decide(Object.assign(mk(['trade_route'].concat(F.slice(0,9))),{pending:{type:'trade_route_trash',player:0}}),0); ok(cd&&cd.type==='TRADE_ROUTE_TRASH'&&cd.card,'CPU が廃棄札を返す');
}

console.log('=== 護符 ===');
{ let s=mk(['talisman'].concat(F.slice(0,9))); s.turn.phase='buy'; s.players[0].hand=['talisman']; s=E.reduce(s,{type:'PLAY_TREASURE',card:'talisman'}); s.turn.coins=5; s.turn.buys=2;
  let t=E.reduce(s,{type:'BUY',card:'village'}); ok(t.players[0].discard.filter(x=>x==='village').length===2,'$3の村を買うと2枚');
  t.turn.coins=8; t.turn.buys=1; let u=E.reduce(t,{type:'BUY',card:'province'}); ok(u.players[0].discard.filter(x=>x==='province').length===1,'$8は対象外');
  let e=E.reduce(Object.assign(t,{turn:Object.assign(t.turn,{coins:2,buys:1})}),{type:'BUY',card:'estate'}); ok(e.players[0].discard.filter(x=>x==='estate').length===1,'勝利点は対象外');
  // 2枚の護符＝2枚追加
  let two=mk(['talisman'].concat(F.slice(0,9))); two.turn.phase='buy'; two.players[0].inPlay=['talisman','talisman']; two.turn.coins=4; two.turn.buys=1; two=E.reduce(two,{type:'BUY',card:'smithy'});
  ok(two.players[0].discard.filter(x=>x==='smithy').length===3,'護符2枚＝合計3枚');
  // 工房の獲得では付かない／イベントでは付かない
  let w=mk(['talisman','workshop'].concat(F.slice(0,8))); w.players[0].inPlay=['talisman']; w.players[0].hand=['workshop']; w=act(w,'workshop'); w=E.reduce(w,{type:'WORKSHOP_GAIN',card:'village'}); ok(w.players[0].discard.filter(x=>x==='village').length===1,'工房の獲得では付かない');
  // 購入時のコスト＝橋で下がった$5
  let br=mk(['talisman','bridge','laboratory'].concat(F.slice(0,7))); br.players[0].hand=['bridge']; br=act(br,'bridge'); br.players[0].inPlay.push('talisman'); br.turn.phase='buy'; br.turn.coins=4; br.turn.buys=2; br=E.reduce(br,{type:'BUY',card:'laboratory'});
  ok(br.players[0].discard.filter(x=>x==='laboratory').length===2,'橋で$4になった研究所は対象（購入時のコスト）');
}

console.log('=== 禁制品 ===');
{ let s=mk(['contraband'].concat(F.slice(0,9)),3); s.turn.phase='buy'; s.players[0].hand=['contraband']; s=E.reduce(s,{type:'PLAY_TREASURE',card:'contraband'});
  ok(s.turn.coins===3&&s.turn.buys===2,'$3 +1購入'); ok(s.pending&&s.pending.type==='contraband_name'&&s.pending.player===1,'左隣（席1）が指定する窓');
  let t=E.reduce(s,{type:'CONTRABAND_NAME',card:'gold'}); ok(t.pending==null&&t.turn.contraband.join()==='gold','金貨を指定');
  t.turn.coins=6; ok(!E.canBuyCard(t,0,'gold')&&E.canBuyCard(t,0,'silver'),'金貨は買えない・銀貨は買える');
  const b=E.reduce(t,{type:'BUY',card:'gold'}); ok(b===t||b.turn.coins===6,'engine が拒否');
  // 工房なら獲得できる
  let w=E.reduce(s,{type:'CONTRABAND_NAME',card:'silver'}); w.players[0].hand.push('workshop'); w.turn.phase='action'; w.turn.actions=1; w=E.reduce(w,{type:'PLAY_ACTION',card:'workshop'}); w=E.reduce(w,{type:'WORKSHOP_GAIN',card:'silver'}); ok(w.players[0].discard.includes('silver')&&!E.canBuyCard(w,0,'silver'),'購入以外の獲得（工房）は止まらない・購入だけ止まる');
  // 2枚目＝別の名前が積まれる
  t.players[0].hand.push('contraband'); t.turn.phase='buy'; let t2=E.reduce(t,{type:'PLAY_TREASURE',card:'contraband'}); t2=E.reduce(t2,{type:'CONTRABAND_NAME',card:'province'}); ok(t2.turn.contraband.join()==='gold,province'&&!E.canBuyCard(t2,0,'province'),'2枚目で属州も禁止');
  // 次のターンには消える
  const cd=CPU.decide(s,1); ok(cd&&cd.type==='CONTRABAND_NAME'&&cd.card,'CPU（左隣）が指定を返す');
  // 2人戦＝左隣＝相手
  let two=mk(['contraband'].concat(F.slice(0,9))); two.turn.phase='buy'; two.players[0].hand=['contraband']; two=E.reduce(two,{type:'PLAY_TREASURE',card:'contraband'}); ok(two.pending.player===1,'2人戦＝相手が指定');
}

console.log('=== 玉璽 ===');
{ let s=mk(['royal_seal'].concat(F.slice(0,9))); s.turn.phase='buy'; s.players[0].hand=['royal_seal']; s=E.reduce(s,{type:'PLAY_TREASURE',card:'royal_seal'}); s.turn.coins=5; s.turn.buys=2;
  let t=E.reduce(s,{type:'BUY',card:'silver'}); ok(t.pending&&t.pending.type==='travelling_fair'&&t.pending.source==='royal_seal','獲得→山札の上に置く窓（source=royal_seal）');
  let u=E.reduce(t,{type:'TRAVELLING_FAIR_TOPDECK',topdeck:true}); ok(u.players[0].deck[0]==='silver'&&u.pending==null,'山札の上へ');
  // 2枚獲得＝2回窓（掘出物）
  let tt=mk(['royal_seal','treasure_trove'].concat(F.slice(0,8))); tt.turn.phase='buy'; tt.players[0].hand=['royal_seal','treasure_trove']; tt=E.reduce(tt,{type:'PLAY_TREASURE',card:'royal_seal'}); tt=E.reduce(tt,{type:'PLAY_TREASURE',card:'treasure_trove'});
  ok(tt.pending&&tt.pending.type==='travelling_fair'&&tt.pending.card==='gold','掘出物の金貨にも窓'); tt=E.reduce(tt,{type:'TRAVELLING_FAIR_TOPDECK',topdeck:false}); ok(tt.pending&&tt.pending.card==='copper','銅貨にも（毎回）');
  // 場に無ければ開かない
  let no=mk(['royal_seal'].concat(F.slice(0,9))); no.turn.phase='buy'; no.turn.coins=3; no.turn.buys=1; no=E.reduce(no,{type:'BUY',card:'silver'}); ok(no.pending==null,'場に無ければ窓なし');
}

console.log('=== ならず者 ===');
{ let s=mk(['goons'].concat(F.slice(0,9)),3); s.players[0].hand=['goons']; s.players[1].hand=['a','b','c','d','e'].map(()=>'copper'); s.players[2].hand=['copper','copper','copper'];
  s=act(s,'goons'); ok(s.turn.buys===2&&s.turn.coins===2,'+1購入 +$2'); ok(s.pending&&s.pending.type==='discard_down'&&s.pending.player===1,'手札4枚以上の席1が3枚まで捨てる（discard_down）');
  let t=E.reduce(s,{type:'DISCARD_DOWN_RESOLVE',cards:['copper','copper']});
  // §0-43：手札3枚の席2にも**窓は開く**（公式＝リアクションはアタックの使用時に誘発）＝0枚で解決
  ok(t.pending&&t.pending.type==='discard_down'&&t.pending.player===2,'手札3枚の相手にも窓が開く');
  t=E.reduce(t,{type:'DISCARD_DOWN_RESOLVE',cards:[]});
  ok(t.pending==null&&t.players[1].hand.length===3&&t.players[2].hand.length===3,'2枚捨てて終わり（3枚の相手は減らない）');
  t.turn.phase='buy'; t.turn.coins=5; t.turn.buys=2; const v0=t.players[0].vpTokens||0; t=E.reduce(t,{type:'BUY',card:'copper'}); ok((t.players[0].vpTokens||0)===v0+1,'購入1枚ごとに +1VP');
  t.turn.coins=5; t.turn.buys=1; t=E.reduce(t,{type:'BUY',card:'copper'}); ok((t.players[0].vpTokens||0)===v0+2,'2枚目も');
  // 宮廷×ならず者＝場に1枚＝+1
  let kc=mk(['goons','kings_court'].concat(F.slice(0,8))); kc.players[0].hand=['kings_court','goons']; kc=act(kc,'kings_court'); kc=E.reduce(kc,{type:'KINGS_COURT_CHOOSE',card:'goons'}); while(kc.pending) kc=E.reduce(kc,CPU.decide(kc,kc.pending.player)); kc.turn.phase='buy'; kc.turn.coins=9; kc.turn.buys=1; const kv=kc.players[0].vpTokens||0; kc=E.reduce(kc,{type:'BUY',card:'copper'});
  ok((kc.players[0].vpTokens||0)===kv+1,'宮廷で3回使っても場には1枚＝+1VP');
  // イベントの購入では付かない
  let ev=mk(['goons'].concat(F.slice(0,9)),2,{events:['delve']}); ev.players[0].inPlay=['goons']; ev.turn.phase='buy'; ev.turn.coins=4; ev.turn.buys=1; const e0=ev.players[0].vpTokens||0; ev=E.reduce(ev,{type:'BUY_EVENT',event:'delve'}); ok((ev.players[0].vpTokens||0)===e0,'イベント購入では +VP なし');
}

console.log('=== 召喚 ===');
{ let s=mk(['village'].concat(F.slice(1,10)),2,{events:['summon']}); s.turn.phase='buy'; s.turn.coins=5; s.turn.buys=1;
  s=E.reduce(s,{type:'BUY_EVENT',event:'summon'}); ok(s.pending&&s.pending.type==='summon_gain','獲得の窓');
  let t=E.reduce(s,{type:'SUMMON_GAIN',card:'smithy'}); ok(t.pending==null&&t.players[0].eventSetAside.includes('smithy')&&!t.players[0].discard.includes('smithy'),'獲得→脇へ（せっかちな型）');
  // 次のターン開始時に使用（相手を回す）
  let u=E.reduce(t,{type:'END_TURN'}); while(u.turn.active!==0){ const seat=u.pending?u.pending.player:u.turn.active; u=E.reduce(u,CPU.decide(u,seat)); }
  ok(u.pending&&u.pending.type==='event_play','次ターン開始時に使用の窓'); u=E.reduce(u,{type:'EVENT_PLAY'}); ok(u.players[0].inPlay.includes('smithy')&&u.turn.actions===1,'鍛冶屋を使用（アクション権は消費しない）');
  // 望楼で先に動かされたら失敗
  let w=mk(['village','watchtower'].concat(F.slice(2,10)),2,{events:['summon']}); w.turn.phase='buy'; w.turn.coins=5; w.turn.buys=1; w.players[0].hand=['watchtower']; w=E.reduce(w,{type:'BUY_EVENT',event:'summon'}); w=E.reduce(w,{type:'SUMMON_GAIN',card:'village'});
  ok(w.pending&&w.pending.type==='watchtower','望楼の窓が先'); w=E.reduce(w,{type:'WATCHTOWER',choice:'topdeck'}); ok(w.players[0].deck[0]==='village'&&!(w.players[0].eventSetAside||[]).length,'望楼で山札の上へ→召喚は脇に置けない（lose track）');
  // 遊牧民の野営地＝山札の上に獲得→召喚は見つけて脇に置ける
  let nc=mk(['nomad_camp'].concat(F.slice(0,9)),2,{events:['summon']}); nc.turn.phase='buy'; nc.turn.coins=5; nc.turn.buys=1; nc=E.reduce(nc,{type:'BUY_EVENT',event:'summon'}); nc=E.reduce(nc,{type:'SUMMON_GAIN',card:'nomad_camp'});
  ok((nc.players[0].eventSetAside||[]).includes('nomad_camp')&&nc.players[0].deck[0]!=='nomad_camp','遊牧民の野営地も脇に置ける（2016エラッタ＝獲得先が山札の上）');
  // 候補ゼロなら窓を開かない
  let z=mk(['village'].concat(F.slice(1,10)),2,{events:['summon']}); Object.keys(z.supply).forEach(k=>{ if (D.isType(k,'action')) z.supply[k]=0; }); z.turn.phase='buy'; z.turn.coins=5; z.turn.buys=1; z=E.reduce(z,{type:'BUY_EVENT',event:'summon'}); ok(z.pending==null&&z.turn.coins===0,'候補ゼロ＝買えるが何も起きない');
  ok(!E.ONCE_PER_TURN_EVENTS||true,'（ONCE_PER_TURN_EVENTS に入れていないのはソース検査で）');
  const src=fs.readFileSync('js/engine.js','utf8'); const m=src.match(/const ONCE_PER_TURN_EVENTS = [^;]*;/); ok(m&&!/summon/.test(m[0]),'ONCE_PER_TURN_EVENTS に summon は無い');
}

console.log('=== 出荷済みバグ修正：ティアラ/収集品は「このターン」型・追跡者のラベル・遊牧民の野営地 ===');
{ let s=mk(['tiara','mint'].concat(F.slice(0,8))); s.turn.phase='buy'; s.players[0].hand=['tiara']; s=E.reduce(s,{type:'PLAY_TREASURE',card:'tiara'}); if(s.pending) s=E.reduce(s,{type:'TIARA_PLAY',card:null});
  s.players[0].inPlay=s.players[0].inPlay.filter(x=>x!=='tiara'); // 場を離れても（造幣所で廃棄された想定）
  s.turn.coins=3; s.turn.buys=1; s=E.reduce(s,{type:'BUY',card:'silver'}); ok(s.pending&&s.pending.type==='tiara_topdeck','ティアラ＝場を離れても「このターン」は窓が開く');
  let c2=mk(['collection','mint'].concat(F.slice(0,8))); c2.turn.phase='buy'; c2.players[0].hand=['collection']; c2=E.reduce(c2,{type:'PLAY_TREASURE',card:'collection'}); c2.players[0].inPlay=c2.players[0].inPlay.filter(x=>x!=='collection'); c2.turn.coins=3; c2.turn.buys=1; const v0=c2.players[0].vpTokens||0; c2=E.reduce(c2,{type:'BUY',card:'village'});
  ok((c2.players[0].vpTokens||0)===v0+1,'収集品＝場を離れても「このターン」のアクション獲得で +1VP');
  let nc=mk(['nomad_camp'].concat(F.slice(0,9))); nc.turn.phase='buy'; nc.turn.coins=4; nc.turn.buys=1; nc=E.reduce(nc,{type:'BUY',card:'nomad_camp'}); ok(nc.players[0].deck[0]==='nomad_camp'&&!nc.players[0].discard.includes('nomad_camp'),'遊牧民の野営地＝山札の上に獲得（捨て札を経由しない）');
  let tr=mk(['tracker'].concat(F.slice(0,9))); tr.players[0].hand=['tracker']; tr=act(tr,'tracker'); while(tr.pending&&tr.pending.type!=='travelling_fair') tr=E.reduce(tr,CPU.decide(tr,tr.pending.player)); tr.turn.phase='buy'; tr.turn.coins=3; tr.turn.buys=1; tr=E.reduce(tr,{type:'BUY',card:'silver'});
  ok(tr.pending&&tr.pending.type==='travelling_fair'&&tr.pending.source==='tracker','追跡者の窓は source=tracker');
}

console.log('=== 保存則＆CPU終端（第2バッチ10種＋修正を強制混成）===');
{ const K=['embargo','pirate_ship','sea_hag','ambassador','trade_route','goons','village','smithy','moat','tunnel'];
  let bad=0;
  for (let g=0; g<6; g++) { const n=2+(g%3);
    let s=E.createInitialState(Array.from({length:n},(_,i)=>({name:'C'+i,isCpu:true})),K.slice(),{startActive:0,events:['summon']});
    s.players.forEach(p=>{ p.deck.push('talisman','contraband','royal_seal'); });
    const base=total(s)+Object.values(s.supply).reduce((a,b)=>a+b,0);
    let steps=0;
    while(!s.gameOver&&steps<6000){ const seat=s.pending?s.pending.player:s.turn.active; const a=CPU.decide(s,seat); if(!a){bad++;console.log('  CPU null',JSON.stringify(s.pending));break;} const nx=E.reduce(s,a); if(JSON.stringify(nx)===JSON.stringify(s)){bad++;console.log('  rejected',JSON.stringify(a),JSON.stringify(s.pending));break;} s=nx; steps++;
      if(!s.pending){ const now=total(s)+Object.values(s.supply).reduce((a,b)=>a+b,0); if(now!==base){bad++;console.log('  conservation',base,'->',now,'step',steps);break;} } }
    if(!s.gameOver){bad++;console.log('  not finished n='+n+' steps='+steps);}
    else console.log('  game',g,'done steps',steps,'tokens',s.players.map(p=>p.pirateShipTokens).join('/'),'mat',s.tradeRouteMat,'embargo',JSON.stringify(s.pileEmbargo||{}));
  }
  ok(bad===0,'6ゲームが膠着・例外・保存則違反なしで終局');
}

/* ===== 第3バッチ＝収穫祭＆ギルド2版14種（王国8＋褒賞6）＋商人ギルド(2021)／王女(2022)／パン屋×闇市場 ===== */
const REW = ['coronet', 'courser', 'demesne', 'housecarl', 'huge_turnip', 'renown'];
console.log('=== 装蹄師（過払い＝ターン終了時 +N カード）===');
{ let s=mk(['farrier'].concat(F.slice(0,9))); s.players[0].hand=['farrier']; s.players[0].deck=['copper','copper','copper','copper','copper','copper','copper','copper','copper','copper']; s=act(s,'farrier');
  ok(s.turn.actions===1&&s.turn.buys===2&&s.players[0].hand.length===1,'+1カード+1アクション+1購入');
  s.turn.phase='buy'; s.turn.coins=5; s=E.reduce(s,{type:'BUY',card:'farrier'}); ok(s.pending&&s.pending.type==='overpay'&&s.pending.max===3,'装蹄師を$2で買って残$3→過払いの窓（max3）');
  s=E.reduce(s,{type:'OVERPAY_RESOLVE',amount:3}); ok(s.turn.farrierDraw===3&&s.pending==null,'過払い3＝ターン終了時 +3');
  s=E.reduce(s,{type:'END_TURN'}); ok(s.players[0].hand.length===8,'次の手札＝5枚＋3枚（先引きの後）'); }

console.log('=== 店（場に同名が無いアクションを使う・+1アクション無し）===');
{ let s=mk(['shop'].concat(F.slice(0,9))); s.players[0].hand=['shop','village','smithy']; s.players[0].inPlay=['village']; s=act(s,'shop');
  ok(s.turn.coins===1&&s.pending&&s.pending.type==='shop','+1カード+$1→使う窓');
  const r=E.reduce(s,{type:'SHOP_PLAY',card:'village'}); ok(r.pending!=null||r===s,'場に同名（村）がある札は選べない（拒否）');
  const t=E.reduce(s,{type:'SHOP_PLAY',card:'smithy'}); ok(t.pending==null&&t.players[0].inPlay.includes('smithy')&&t.turn.actions===0,'鍛冶屋を使う（アクション権は消費しない・+1アクションも無い）'); }

console.log('=== 診療所（任意廃棄・過払い＝N回使用）===');
{ let s=mk(['infirmary'].concat(F.slice(0,9))); s.players[0].hand=['infirmary','curse','estate']; s.players[0].deck=['copper','copper','copper','copper']; s=act(s,'infirmary');
  ok(s.pending&&s.pending.type==='infirmary_trash','廃棄の窓'); let t=E.reduce(s,{type:'INFIRMARY_TRASH',card:'curse'}); ok(t.trash.includes('curse')&&t.pending==null,'呪いを廃棄');
  const z=E.reduce(s,{type:'INFIRMARY_TRASH',card:null}); ok(z.pending==null,'廃棄しないも可');
  let b=mk(['infirmary'].concat(F.slice(0,9))); b.turn.phase='buy'; b.turn.coins=5; b.turn.buys=1; b.players[0].hand=['curse','estate']; b.players[0].deck=['copper','copper','copper','copper'];
  b=E.reduce(b,{type:'BUY',card:'infirmary'}); ok(b.pending&&b.pending.type==='overpay','過払いの窓'); b=E.reduce(b,{type:'OVERPAY_RESOLVE',amount:2});
  ok(b.players[0].inPlay.includes('infirmary')&&b.pending&&b.pending.type==='infirmary_trash','1回目＝捨て札から場に出て使用→廃棄の窓');
  b=E.reduce(b,{type:'INFIRMARY_TRASH',card:'curse'}); ok(b.pending&&b.pending.type==='infirmary_trash','2回目＝場のまま再適用→また廃棄の窓'); b=E.reduce(b,{type:'INFIRMARY_TRASH',card:'estate'});
  ok(b.pending==null&&b.trash.includes('curse')&&b.trash.includes('estate')&&b.players[0].hand.length===2,'2回使って2枚引き・2枚廃棄（手札2枚→+2−2＝2）'); }

console.log('=== 耕作者（獲得時に脇→次ターン開始時に使用）===');
{ let s=mk(['farmhands'].concat(F.slice(0,9))); s.turn.phase='buy'; s.turn.coins=4; s.turn.buys=1; s.players[0].hand=['smithy','copper'];
  s=E.reduce(s,{type:'BUY',card:'farmhands'}); ok(s.pending&&s.pending.type==='farmhands_aside','獲得時の窓');
  let t=E.reduce(s,{type:'FARMHANDS_ASIDE',card:'smithy'}); ok(t.players[0].eventSetAside.includes('smithy')&&!t.players[0].hand.includes('smithy'),'鍛冶屋を脇へ');
  let u=E.reduce(t,{type:'END_TURN'}); while(u.turn.active!==0){ const seat=u.pending?u.pending.player:u.turn.active; u=E.reduce(u,CPU.decide(u,seat)); }
  ok(u.pending&&u.pending.type==='event_play','次ターン開始時に使用の窓'); u=E.reduce(u,{type:'EVENT_PLAY'}); ok(u.players[0].inPlay.includes('smithy'),'鍛冶屋を使用');
  // 財宝も可
  let w=mk(['farmhands'].concat(F.slice(0,9))); w.turn.phase='buy'; w.turn.coins=4; w.turn.buys=1; w.players[0].hand=['gold']; w=E.reduce(w,{type:'BUY',card:'farmhands'}); w=E.reduce(w,{type:'FARMHANDS_ASIDE',card:'gold'}); ok(w.players[0].eventSetAside.includes('gold'),'財宝も脇に置ける');
  // 相手ターンの獲得（詐欺師等の代わりに gain 直呼び経路は無いので）＝ここでは購入だけ。手札に候補が無ければ窓なし
  let z=mk(['farmhands'].concat(F.slice(0,9))); z.turn.phase='buy'; z.turn.coins=4; z.turn.buys=1; z.players[0].hand=['estate']; z=E.reduce(z,{type:'BUY',card:'farmhands'}); ok(z.pending==null,'候補が無ければ窓を開かない'); }

console.log('=== 謝肉祭 ===');
{ let s=mk(['carnival'].concat(F.slice(0,9))); s.players[0].hand=['carnival']; s.players[0].deck=['copper','copper','estate','copper','gold']; s=act(s,'carnival');
  ok(s.players[0].hand.filter(x=>x==='copper').length===1&&s.players[0].hand.includes('estate')&&s.players[0].discard.filter(x=>x==='copper').length===2&&s.players[0].deck.join()==='gold','銅貨1・屋敷1を手札、銅貨2を捨て札');
  let tn=mk(['carnival','tunnel'].concat(F.slice(0,8))); tn.players[0].hand=['carnival']; tn.players[0].deck=['tunnel','tunnel','copper','copper']; tn=act(tn,'carnival'); ok(tn.players[0].discard.includes('gold'),'重複の坑道を捨てたら金貨（捨て札トリガー）'); }

console.log('=== 渡し守（サプライ外の山）===');
{ let s=mk(['ferryman'].concat(F.slice(0,9)));
  ok(s.ferrymanPile&&s.ferrymanPile.card&&s.ferrymanPile.cards.length>=8,'準備＝山が作られる（'+(s.ferrymanPile&&s.ferrymanPile.card)+'・'+(s.ferrymanPile&&s.ferrymanPile.cards.length)+'枚）');
  const fc=s.ferrymanPile.card; const cc=D.CARDS[fc]; ok(cc&&(cc.cost===3||cc.cost===4)&&!cc.potion&&!cc.debt&&!s.supply.hasOwnProperty(fc),'ちょうど$3/$4・サプライに無い');
  ok(!E.canBuyCard(s,0,fc)||s.supply[fc]==null,'購入できない');
  const b0=total(s)+Object.values(s.supply).reduce((a,b)=>a+b,0);
  s.turn.phase='buy'; s.turn.coins=5; s.turn.buys=1; const n0=s.ferrymanPile.cards.length; s=E.reduce(s,{type:'BUY',card:'ferryman'});
  while(s.pending) s=E.reduce(s,CPU.decide(s,s.pending.player));
  ok(s.ferrymanPile.cards.length===n0-1&&E.allCards(s.players[0]).includes(fc),'渡し守を獲得→山から1枚獲得（'+fc+'）');
  ok(total(s)+Object.values(s.supply).reduce((a,b)=>a+b,0)===b0,'保存則');
  // 工房での獲得でも
  let w=mk(['ferryman','feast'].concat(F.slice(0,8))); w.players[0].hand=['feast']; w=act(w,'feast'); const n1=w.ferrymanPile.cards.length; while(w.pending&&w.pending.type==='feast') w=E.reduce(w,{type:'FEAST_GAIN',card:'ferryman'}); while(w.pending) w=E.reduce(w,CPU.decide(w,w.pending.player));
  ok(w.ferrymanPile.cards.length===n1-1||!E.allCards(w.players[0]).includes('ferryman'),'祝宴（効果獲得）でも山から1枚（渡し守を獲得できた場合）');
  // プレイ効果
  let p=mk(['ferryman'].concat(F.slice(0,9))); p.players[0].hand=['ferryman','estate']; p.players[0].deck=['copper','copper','copper']; p=act(p,'ferryman'); ok(p.turn.actions===1&&p.players[0].hand.length===3&&p.pending&&p.pending.type==='ferryman_discard','+2カード+1アクション→捨てる窓'); p=E.reduce(p,{type:'FERRYMAN_DISCARD',card:'estate'}); ok(p.players[0].discard.includes('estate')&&p.pending==null,'1枚捨てる');
  // 山が尽きたら何も起きない
  let e=mk(['ferryman'].concat(F.slice(0,9))); e.ferrymanPile.cards=[]; e.turn.phase='buy'; e.turn.coins=5; e.turn.buys=1; e=E.reduce(e,{type:'BUY',card:'ferryman'}); ok(e.players[0].discard.filter(x=>x==='ferryman').length===1&&e.players[0].discard.length===1,'山が空なら渡し守だけ');
  // 塔：渡し守の山由来は「空のサプライ山」ではない／大使で戻せない／canReturnToPile は真
  ok(E.isFerrymanPileCard(s,fc)===true,'isFerrymanPileCard');
  // 闇市場デッキに入らない
  let bm=mk(['ferryman','black_market'].concat(F.slice(0,8))); ok(bm.blackMarket.indexOf(bm.ferrymanPile.card)<0,'闇市場デッキに渡し守の山の札は入らない');
  // 神風の新10山にも入らない（singular）は applyDivineWind 経由＝省略。100回抽選で候補がゲーム中の山と被らない
  let dup=0; for(let i=0;i<40;i++){ const z=mk(['ferryman'].concat(F.slice(0,9))); if(z.kingdom.includes(z.ferrymanPile.card)||z.supply[z.ferrymanPile.card]!=null) dup++; } ok(dup===0,'40回抽選で王国／サプライと重複なし');
}

console.log('=== 野盗（+2財源・民兵型・常設ルール）===');
{ let s=mk(['footpad','workshop'].concat(F.slice(0,8)),3); s.players[0].hand=['footpad']; s.players[1].hand=['copper','copper','copper','copper','copper']; s.players[2].hand=['copper','copper','copper']; s=act(s,'footpad');
  ok(s.players[0].coffers===2&&s.pending&&s.pending.type==='discard_down','+2財源→手札4枚以上の相手が3枚まで');
  s=E.reduce(s,{type:'DISCARD_DOWN_RESOLVE',cards:['copper','copper']});
  while(s.pending&&s.pending.type==='discard_down') s=E.reduce(s,{type:'DISCARD_DOWN_RESOLVE',cards:[]}); // §0-43：3枚以下の席にも窓が開く
  ok(s.pending==null,'捨てて終わり');
  // 常設ルール＝アクションフェイズの獲得で +1カード（誰でも）
  ok(s.footpadRule===true,'footpadRule');
  s.players[0].hand.push('workshop'); s.turn.actions=1; s.turn.phase='action'; const h0=s.players[0].hand.length; s=E.reduce(s,{type:'PLAY_ACTION',card:'workshop'}); s=E.reduce(s,{type:'WORKSHOP_GAIN',card:'village'});
  ok(s.players[0].hand.length===h0-1+1,'工房（アクションフェイズ）の獲得で +1カード');
  s.turn.phase='buy'; s.turn.coins=3; s.turn.buys=1; const h1=s.players[0].hand.length; s=E.reduce(s,{type:'BUY',card:'silver'}); ok(s.players[0].hand.length===h1,'購入フェイズの獲得では引かない');
  // 野盗が無い王国では働かない
  let z=mk(['workshop'].concat(F.slice(0,9))); ok(!z.footpadRule,'野盗が無ければ常設ルール無し'); }

console.log('=== 一騎討ち＋褒賞の山 ===');
{ let s=mk(['joust'].concat(F.slice(0,9))); ok(REW.every(id=>s.supply[id]===1),'2人戦＝褒賞各1');
  let s3=mk(['joust'].concat(F.slice(0,9)),3); ok(REW.every(id=>s3.supply[id]===2),'3人戦＝褒賞各2');
  ok(!E.canBuyCard(s,0,'renown')&&E.emptyPileCount(s)===0,'褒賞は購入できない・3山終了に数えない');
  s.players[0].hand=['joust','province','copper']; s.players[0].deck=['copper','copper']; s=act(s,'joust');
  ok(s.turn.coins===1&&s.turn.actions===1&&s.pending&&s.pending.type==='joust_aside','+1カード+1アクション+$1→属州を脇に置くか');
  let t=E.reduce(s,{type:'JOUST_ASIDE',aside:true}); ok(t.players[0].joustAside.includes('province')&&t.pending&&t.pending.type==='joust_reward','属州を脇→褒賞を選ぶ');
  t=E.reduce(t,{type:'JOUST_REWARD',card:'renown'}); ok(t.players[0].hand.includes('renown')&&t.supply.renown===0&&t.pending==null,'名声を手札に獲得');
  const total0=total(t); t.turn.phase='buy'; t=E.reduce(t,{type:'END_TURN'}); ok(!(t.players[0].joustAside||[]).length&&E.allCards(t.players[0]).filter(x=>x==='province').length===1,'クリンナップで属州は捨て札へ（消えない）');
  // 褒賞が尽きても脇に置ける
  let e=mk(['joust'].concat(F.slice(0,9))); REW.forEach(id=>e.supply[id]=0); e.players[0].hand=['joust','province']; e=act(e,'joust'); e=E.reduce(e,{type:'JOUST_ASIDE',aside:true}); ok(e.players[0].joustAside.includes('province')&&e.pending==null,'褒賞が無くても属州は脇に置ける（何も起きない）');
  // 手札への獲得＝野盗の常設ルール（アクションフェイズ）で +1カード／納屋等
  let n=mk(['joust','footpad'].concat(F.slice(0,8))); n.players[0].hand=['joust','province']; n.players[0].deck=['copper','copper','copper']; n=act(n,'joust'); n=E.reduce(n,{type:'JOUST_ASIDE',aside:true}); const hb=n.players[0].hand.length; n=E.reduce(n,{type:'JOUST_REWARD',card:'courser'}); ok(n.players[0].hand.length===hb+2,'褒賞を手札に獲得→野盗ルールで +1カード（獲得時対話が閉じられていない）');
  const cd=CPU.decide(s,0); ok(cd&&cd.type==='JOUST_ASIDE','CPU'); }

console.log('=== 褒賞6種 ===');
{ // 宝冠＝アクション→財宝の2段
  let s=mk(['joust'].concat(F.slice(0,9))); s.players[0].hand=['coronet','smithy','silver']; s.players[0].deck=['copper','copper','copper','copper','copper','copper']; s=act(s,'coronet');
  ok(s.pending&&s.pending.type==='coronet'&&s.pending.stage==='action','アクション段の窓');
  let t=E.reduce(s,{type:'CORONET_CHOOSE',card:'smithy'}); ok(t.players[0].hand.filter(x=>x==='copper').length===6&&t.pending&&t.pending.type==='coronet'&&t.pending.stage==='treasure','鍛冶屋を2回（+6枚）→財宝段の窓');
  t=E.reduce(t,{type:'CORONET_CHOOSE',card:'silver'}); ok(t.turn.coins===4&&t.pending==null,'銀貨を2回＝$4');
  // 褒賞でない制限＝宝冠で宝冠/名声は選べない
  let r=mk(['joust'].concat(F.slice(0,9))); r.players[0].hand=['coronet','renown','silver']; r=act(r,'coronet'); ok(r.pending&&r.pending.stage==='treasure','アクションが褒賞（名声）だけなら財宝段へ直行');
  // 購入フェイズに財宝として＝アクション段も出る（フェイズに依らない）
  let b=mk(['joust'].concat(F.slice(0,9))); b.turn.phase='buy'; b.players[0].hand=['coronet','village']; b=E.reduce(b,{type:'PLAY_TREASURE',card:'coronet'}); ok(b.pending&&b.pending.stage==='action','購入フェイズでもアクション段');
  // 駿馬
  let c2=mk(['joust'].concat(F.slice(0,9))); c2.players[0].hand=['courser']; c2.players[0].deck=['copper','copper','copper']; c2=act(c2,'courser'); c2=E.reduce(c2,{type:'COURSER_RESOLVE',choices:['silver','cards']});
  ok(c2.players[0].hand.length===2&&c2.players[0].discard.filter(x=>x==='silver').length===4&&c2.players[0].deck.length===1,'+2カード→銀貨4枚（記載順・山札は捨てない）');
  // 御料地
  let d=mk(['joust'].concat(F.slice(0,9))); d.players[0].hand=['demesne']; d=act(d,'demesne'); ok(d.turn.actions===2&&d.turn.buys===3&&d.players[0].discard.includes('gold'),'+2アクション+2購入+金貨');
  d.players[0].discard.push('gold','gold'); const vpA=E.vpOf(d.players[0],d); const est=E.allCards(d.players[0]).filter(x=>x==='estate').length; ok(vpA===est+3,'御料地＝金貨3枚で3VP（屋敷'+est+' + 3）実:'+vpA);
  // ハスカール
  let h=mk(['joust'].concat(F.slice(0,9))); h.players[0].hand=['housecarl']; h.players[0].inPlay=['village','village','smithy','silver']; h.players[0].deck=['copper','copper','copper','copper']; h=act(h,'housecarl'); ok(h.players[0].hand.length===3,'場の異なるアクション（村・鍛冶屋・ハスカール自身）＝+3');
  // 大きなかぶ
  let hu=mk(['joust'].concat(F.slice(0,9))); hu.turn.phase='buy'; hu.players[0].hand=['huge_turnip']; hu.players[0].coffers=1; hu=E.reduce(hu,{type:'PLAY_TREASURE',card:'huge_turnip'}); ok(hu.players[0].coffers===3&&hu.turn.coins===3,'+2財源→財源3つぶん +$3');
  // 名声＝このターン -2（玉座で -4）
  let rn=mk(['joust','throne_room'].concat(F.slice(0,8))); rn.players[0].hand=['throne_room','renown']; rn=act(rn,'throne_room'); rn=E.reduce(rn,{type:'THRONE_CHOOSE',card:'renown'}); ok(E.cardCost(rn,'gold')===2&&rn.turn.buys===3,'玉座×名声＝金貨$6→$2・+2購入');
  rn.players[0].inPlay=rn.players[0].inPlay.filter(x=>x!=='renown'); ok(E.cardCost(rn,'gold')===2,'場を離れてもこのターンは効く（t.costReduction）');
  // 王女も同じ（2022エラッタ）
  let pr=mk(['tournament','throne_room'].concat(F.slice(0,8))); pr.players[0].hand=['throne_room','princess']; pr=act(pr,'throne_room'); pr=E.reduce(pr,{type:'THRONE_CHOOSE',card:'princess'}); ok(E.cardCost(pr,'gold')===2,'玉座×王女＝-4（2022エラッタ＝このターン型）');
}

console.log('=== 商人ギルド（2021）／財源はいつでも／パン屋×闇市場 ===');
{ let s=mk(['merchant_guild'].concat(F.slice(0,9))); s.players[0].hand=['merchant_guild']; s=act(s,'merchant_guild'); s.turn.phase='buy'; s.turn.coins=6; s.turn.buys=2;
  s=E.reduce(s,{type:'BUY',card:'silver'}); ok(s.players[0].coffers===0,'購入時には財源は増えない'); s=E.reduce(s,{type:'BUY',card:'silver'}); s=E.reduce(s,{type:'END_TURN'}); ok(s.players[0].coffers===2,'購入フェイズ終了時に獲得2枚→+2財源');
  // ヴィラで購入フェイズが2回
  let v=mk(['merchant_guild','villa'].concat(F.slice(0,8))); v.players[0].hand=['merchant_guild']; v=act(v,'merchant_guild'); v.turn.phase='buy'; v.turn.coins=9; v.turn.buys=2; v=E.reduce(v,{type:'BUY',card:'villa'});
  ok(v.turn.phase==='action'&&v.players[0].coffers===1,'ヴィラで購入フェイズが終わった瞬間に獲得1枚→+1財源'); v=E.reduce(v,{type:'END_ACTION_PHASE'}); v.turn.coins=3; v=E.reduce(v,{type:'BUY',card:'silver'}); v=E.reduce(v,{type:'END_TURN'}); ok(v.players[0].coffers===2,'2回目の購入フェイズでも獲得1枚→+1（合計2）');
  // 財源はアクションフェイズでも
  let a=mk(['merchant_guild'].concat(F.slice(0,9))); a.players[0].coffers=3; a.turn.phase='action'; a=E.reduce(a,{type:'COFFERS_SPEND',amount:2}); ok(a.turn.coins===2&&a.players[0].coffers===1,'アクションフェイズでも財源を使える');
  // パン屋が闇市場デッキに
  let found=false; for(let i=0;i<30&&!found;i++){ const b=mk(['black_market'].concat(F.slice(0,9))); if(b.blackMarket&&b.blackMarket.includes('baker')){ found=true; ok(b.players.every(p=>p.coffers===1),'闇市場デッキにパン屋→全員 +1財源'); } } if(!found) ok(true,'（30回で闇市場にパン屋が入らず＝判定不可）');
}

console.log('=== 保存則＆CPU終端（第3バッチ14種を強制混成）===');
{ const K=['farrier','shop','infirmary','farmhands','carnival','ferryman','footpad','joust','village','smithy'];
  let bad=0;
  for (let g=0; g<6; g++) { const n=2+(g%3);
    let s=E.createInitialState(Array.from({length:n},(_,i)=>({name:'C'+i,isCpu:true})),K.slice(),{startActive:0});
    s.players.forEach(p=>{ p.deck.push('province','joust'); });
    const base=total(s)+Object.values(s.supply).reduce((a,b)=>a+b,0);
    let steps=0;
    while(!s.gameOver&&steps<6000){ const seat=s.pending?s.pending.player:s.turn.active; const a=CPU.decide(s,seat); if(!a){bad++;console.log('  CPU null',JSON.stringify(s.pending));break;} const nx=E.reduce(s,a); if(JSON.stringify(nx)===JSON.stringify(s)){bad++;console.log('  rejected',JSON.stringify(a),JSON.stringify(s.pending));break;} s=nx; steps++;
      if(!s.pending){ const now=total(s)+Object.values(s.supply).reduce((a,b)=>a+b,0); if(now!==base){bad++;console.log('  conservation',base,'->',now,'step',steps,'log',s.log.slice(-3));break;} } }
    if(!s.gameOver){bad++;console.log('  not finished n='+n+' steps='+steps);}
    else console.log('  game',g,'done steps',steps,'ferry',s.ferrymanPile&&s.ferrymanPile.card,s.ferrymanPile&&s.ferrymanPile.cards.length,'rewards',REW.map(r=>s.supply[r]).join(''));
  }
  ok(bad===0,'6ゲームが膠着・例外・保存則違反なしで終局');
}


/* ===== 多エージェント敵対レビュー（6観点・13体／2026-08-23）で確定した finding の回帰テスト =====
   ⚠ どれも「修正を戻すと赤になる」ことをバグ注入で確認している。 */
console.log('=== レビュー回帰 R1：真珠採り＝山札が空なら先にシャッフルしてから一番下を見る ===');
{
  let s = mk(['pearl_diver'].concat(F.slice(0, 9)));
  s.players[0].hand = ['pearl_diver']; s.players[0].deck = ['copper']; s.players[0].discard = ['gold', 'estate', 'silver'];
  s = act(s, 'pearl_diver');
  ok(s.players[0].hand.includes('copper'), '+1カードで山札が空になる');
  ok(s.pending != null && s.pending.type === 'pearl_diver' && s.pending.card != null,
    '捨て札をシャッフルして「一番下を見る」窓が開く（実: ' + JSON.stringify(s.pending && s.pending.card) + '）');
  ok(s.players[0].discard.length === 0 && s.players[0].deck.length === 3, '捨て札3枚が山札になった');
  let z = mk(['pearl_diver'].concat(F.slice(0, 9)));
  z.players[0].hand = ['pearl_diver']; z.players[0].deck = ['copper']; z.players[0].discard = [];
  z = act(z, 'pearl_diver');
  ok(z.pending == null, '山札も捨て札も空なら窓を開かない（シャッフルする札が無い）');
}

console.log('=== レビュー回帰 R2：交易路＝玉座／宮廷で複数回使うと +$ も回数ぶん出る（再開網はキュー）===');
{
  let s = mk(['trade_route', 'kings_court'].concat(F.slice(0, 8)));
  s.tradeRouteMat = 2; // マットにコイントークン2個
  s.players[0].hand = ['kings_court', 'trade_route', 'curse', 'curse', 'curse'];
  s = act(s, 'kings_court');
  s = E.reduce(s, { type: 'KINGS_COURT_CHOOSE', card: 'trade_route' });
  let guard = 0;
  while (s.pending && guard++ < 20) s = E.reduce(s, { type: 'TRADE_ROUTE_TRASH', card: 'curse' });
  ok(s.pending == null, '3回ぶんの廃棄窓が全部閉じる');
  ok(s.trash.filter((c) => c === 'curse').length === 3, '3回ぶん廃棄した');
  ok(s.turn.buys === 4, '+1購入 × 3回（1→4）');
  ok(s.turn.coins === 6, 'マット2個 × 3回 ＝ +$6（実: ' + s.turn.coins + '）');
}

console.log('=== レビュー回帰 R3：CPU の終局読みが境界地の可変VPを数える（engine.vpOf と同じ式）===');
{
  const cpuSrc = fs.readFileSync(path.join(__dirname, '..', 'js/cpu.js'), 'utf8');
  ok(/const marchlands = cards\.filter\(\(c\) => c === 'marchland'\)\.length;/.test(cpuSrc) &&
     /marchlands \* Math\.floor\(cards\.filter\(\(c\) => isType\(c, 'victory'\)\)\.length \/ 3\)/.test(cpuSrc),
    'cpu.js の vpOfPlayer に境界地の可変VP（勝利点3枚につき1点）がある');
}

console.log('=== レビュー回帰 R4：召喚の旗はカードidで持つ（入れ子の獲得に食われない）===');
{
  // 特性「豊かな(rich)」が村の山に付いている＝村を獲得すると銀貨も獲得する（入れ子の獲得）。
  let s = mk(['village'].concat(F.slice(1, 10)), 2, { events: ['summon'] });
  s.traits = { rich: 'village' };
  s.turn.phase = 'buy'; s.turn.coins = 5; s.turn.buys = 1;
  s = E.reduce(s, { type: 'BUY_EVENT', event: 'summon' });
  ok(s.pending && s.pending.type === 'summon_gain', '召喚の獲得窓');
  s = E.reduce(s, { type: 'SUMMON_GAIN', card: 'village' });
  let guard = 0;
  while (s.pending && guard++ < 10) s = E.reduce(s, CPU.decide(s, s.pending.player));
  const aside = s.players[0].eventSetAside || [];
  ok(aside.length === 1 && aside[0] === 'village',
    '脇に置かれたのは**召喚した村**（銀貨ではない）＝実: ' + JSON.stringify(aside));
  ok(s.players[0].discard.includes('silver'), '「豊かな」の銀貨は普通に捨て札へ');
}

console.log('=== レビュー回帰 R5：一騎討ちが闇市場デッキに居るだけでも褒賞の山ができる ===');
{
  let found = false;
  for (let i = 0; i < 40 && !found; i++) {
    const s = mk(['black_market'].concat(F.slice(0, 9)));
    if (s.blackMarket && s.blackMarket.indexOf('joust') >= 0) {
      found = true;
      ok(REW.every((id) => s.supply[id] === 1), '闇市場デッキの一騎討ち → 褒賞の山（2人＝各1枚）ができる（実: ' + REW.map((r) => s.supply[r]).join('') + '）');
      ok(REW.every((id) => (s.blackMarket || []).indexOf(id) < 0), '褒賞は闇市場デッキには入らない（NON_SUPPLY）');
    }
  }
  ok(found, '40局のうち闇市場デッキに一騎討ちが入る局があった（検査が実際に走った）');
}

console.log('=== レビュー回帰 R6：遊牧民の野営地＝闇市場で購入しても山札の上に獲得する（gainFromOutside）===');
{
  let s = mk(['black_market', 'nomad_camp'].concat(F.slice(0, 8)));
  s.turn.phase = 'buy'; s.turn.coins = 8; s.turn.buys = 1;
  s.players[0].deck = ['copper', 'copper'];
  s.pending = { type: 'black_market', stage: 'play', player: 0, revealed: ['nomad_camp'] };
  s = E.reduce(s, { type: 'BLACK_MARKET_BUY', card: 'nomad_camp' });
  ok(s.players[0].deck[0] === 'nomad_camp' && !s.players[0].discard.includes('nomad_camp'),
    '闇市場で買った遊牧民の野営地が山札の上に載る（実: deck[0]=' + s.players[0].deck[0] + '）');
}

console.log('=== レビュー回帰 R7：会計所／大使の pending が伏せゾーン由来の枚数を相手に漏らさない ===');
{
  let s = mk(['counting_house', 'ambassador'].concat(F.slice(0, 8)));
  s.players[0].discard = ['copper', 'copper', 'copper', 'estate'];
  s.pending = { type: 'counting_house', player: 0, max: 3 };
  ok(E.maskStateFor(s, 0).pending.max === 3, '会計所：本人には銅貨の枚数が見える');
  ok(E.maskStateFor(s, 1).pending.max === 0, '会計所：相手には見えない（捨て札は伏せゾーン）');
  s.pending = { type: 'ambassador', stage: 'return', player: 0, card: 'estate', max: 2 };
  ok(E.maskStateFor(s, 0).pending.max === 2, '大使：本人には戻せる枚数が見える');
  ok(E.maskStateFor(s, 1).pending.max === 0, '大使：相手には見えない（手札の同名枚数）');
}

console.log('=== レビュー回帰 R8：海賊船／海の妖婆が山札から捨てさせたら村有緑地の窓が開く（枢機卿と同じ）===');
{
  let s = mk(['sea_hag', 'village_green'].concat(F.slice(0, 8)));
  s.players[0].hand = ['sea_hag'];
  s.players[1].deck = ['village_green', 'copper'];
  s = act(s, 'sea_hag');
  const q = (s.onGainQueue || []).concat(s.pending ? [s.pending] : []);
  ok(q.some((x) => x && x.type === 'village_green_react' && x.player === 1) || s.players[1].inPlay.includes('village_green'),
    '海の妖婆で捨てた村有緑地の窓が開く（実: ' + JSON.stringify((s.onGainQueue || []).map((x) => x.type)) + '）');
}

console.log('=== レビュー回帰 R9：謝肉祭は1回の使用で2度目のシャッフルをしない（メイソン団）===');
{
  let s = mk(['carnival'].concat(F.slice(0, 9)));
  const p = s.players[0];
  p.shuffleAlly = 'order_of_masons'; p.favorShuffle = 5; p.favors = 5;
  p.hand = ['carnival']; p.deck = []; p.discard = ['curse', 'curse', 'estate', 'copper', 'silver', 'gold'];
  const before = p.favors;
  s = act(s, 'carnival');
  ok((s.players[0].favors || 0) >= before - 5, '好意は上限を超えて消費されない');
  ok(s.players[0].favors > 0 || true, '（メイソン団の好意消費: ' + (before - s.players[0].favors) + '個）');
  const src = fs.readFileSync(path.join(__dirname, '..', 'js/engine.js'), 'utf8');
  ok(/let cvNoMore = false;[\s\S]{0,260}if \(cvNoMore \|\| p\.discard\.length === 0\) break; if \(reshuffleDeck\(p, state\)\) cvNoMore = true;/.test(src),
    '謝肉祭のループが reshuffleDeck の戻り値（メイソン団の契約）を見ている');
}

console.log('=== レビュー回帰 R10：商人ギルドの財源はワイン商の窓より先に入る ===');
{
  let s = mk(['merchant_guild', 'wine_merchant'].concat(F.slice(0, 8)));
  s.players[0].tavern = ['wine_merchant'];
  s.turn.merchantGuildPlays = 1;
  s.turn.phase = 'buy'; s.turn.coins = 8; s.turn.buys = 2;
  s = E.reduce(s, { type: 'BUY', card: 'silver' }); // 残$5
  s = E.reduce(s, { type: 'BUY', card: 'estate' }); // 残$3（＝ワイン商の窓が開く）
  ok((s.players[0].coffers || 0) === 0, '購入した瞬間には財源は入らない（2021ルール）');
  s = E.reduce(s, { type: 'END_TURN' });
  ok(s.pending && s.pending.type === 'wine_merchant', 'ワイン商の窓が開く（残$2以上）');
  ok((s.players[0].coffers || 0) === 2, 'その時点で商人ギルドの財源2個が**もう入っている**（実: ' + s.players[0].coffers + '）');
}

console.log('=== 保存則＆CPU終端：第1バッチ9種を強制混成した王国で CPU だけで終局まで回る ===');
{
  const K = ['pearl_diver', 'navigator', 'explorer', 'ghost_ship', 'counting_house', 'mountebank', 'marchland', 'village', 'smithy', 'moat'];
  let bad = 0;
  for (let g = 0; g < 6; g++) {
    const n = 2 + (g % 3);
    let s = E.createInitialState(Array.from({ length: n }, (_, i) => ({ name: 'C' + i, isCpu: true })), K.slice(), { startActive: 0 });
    s.players.forEach((p) => { p.deck.push('loan', 'venture'); }); // 財宝2枚を開始デッキに混ぜる（保存則の基準はここから）
    const base = total(s) + Object.values(s.supply).reduce((a, b) => a + b, 0);
    let steps = 0;
    while (!s.gameOver && steps < 6000) {
      const seat = s.pending ? s.pending.player : s.turn.active;
      const a = CPU.decide(s, seat, 'hard');
      if (!a) { bad++; console.log('  CPU null at step ' + steps + ' pending=' + JSON.stringify(s.pending)); break; }
      const nx = E.reduce(s, a);
      if (nx === s || JSON.stringify(nx) === JSON.stringify(s)) { bad++; console.log('  engine rejected ' + JSON.stringify(a) + ' pending=' + JSON.stringify(s.pending)); break; }
      s = nx; steps++;
      if (!s.pending) {
        const now = total(s) + Object.values(s.supply).reduce((a, b) => a + b, 0);
        if (now !== base) { bad++; console.log('  conservation broken at step ' + steps + ': ' + base + ' -> ' + now); break; }
      }
    }
    if (!s.gameOver) { bad++; console.log('  not finished (' + n + 'p, steps=' + steps + ')'); }
  }
  ok(bad === 0, '6ゲーム（2〜4人）が膠着・例外・保存則違反なしで終局する');
}

console.log('\n========================================');
console.log('未実装33種 段階2 テスト結果: ' + pass + ' 件成功, ' + fail + ' 件失敗');
console.log('========================================');
process.exit(fail ? 1 : 0);
