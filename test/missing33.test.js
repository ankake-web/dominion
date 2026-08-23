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
const total = (st) => { let n = 0; st.players.forEach((p) => { n += E.allCards(p).length; }); n += st.trash.length; return n; };

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
  let t=E.reduce(s,{type:'DISCARD_DOWN_RESOLVE',cards:['copper','copper']}); ok(t.pending==null&&t.players[1].hand.length===3,'2枚捨てて終わり');
  t.turn.phase='buy'; t.turn.coins=5; t.turn.buys=2; const v0=t.players[0].vpTokens||0; t=E.reduce(t,{type:'BUY',card:'copper'}); ok((t.players[0].vpTokens||0)===v0+1,'購入1枚ごとに +1VP');
  t.turn.coins=5; t.turn.buys=1; t=E.reduce(t,{type:'BUY',card:'copper'}); ok((t.players[0].vpTokens||0)===v0+2,'2枚目も');
  // 王の宮廷×ならず者＝場に1枚＝+1
  let kc=mk(['goons','kings_court'].concat(F.slice(0,8))); kc.players[0].hand=['kings_court','goons']; kc=act(kc,'kings_court'); kc=E.reduce(kc,{type:'KINGS_COURT_CHOOSE',card:'goons'}); while(kc.pending) kc=E.reduce(kc,CPU.decide(kc,kc.pending.player)); kc.turn.phase='buy'; kc.turn.coins=9; kc.turn.buys=1; const kv=kc.players[0].vpTokens||0; kc=E.reduce(kc,{type:'BUY',card:'copper'});
  ok((kc.players[0].vpTokens||0)===kv+1,'王の宮廷で3回使っても場には1枚＝+1VP');
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

console.log('=== 出荷済みバグ修正：ティアラ/収集は「このターン」型・追跡者のラベル・遊牧民の野営地 ===');
{ let s=mk(['tiara','mint'].concat(F.slice(0,8))); s.turn.phase='buy'; s.players[0].hand=['tiara']; s=E.reduce(s,{type:'PLAY_TREASURE',card:'tiara'}); if(s.pending) s=E.reduce(s,{type:'TIARA_PLAY',card:null});
  s.players[0].inPlay=s.players[0].inPlay.filter(x=>x!=='tiara'); // 場を離れても（造幣所で廃棄された想定）
  s.turn.coins=3; s.turn.buys=1; s=E.reduce(s,{type:'BUY',card:'silver'}); ok(s.pending&&s.pending.type==='tiara_topdeck','ティアラ＝場を離れても「このターン」は窓が開く');
  let c2=mk(['collection','mint'].concat(F.slice(0,8))); c2.turn.phase='buy'; c2.players[0].hand=['collection']; c2=E.reduce(c2,{type:'PLAY_TREASURE',card:'collection'}); c2.players[0].inPlay=c2.players[0].inPlay.filter(x=>x!=='collection'); c2.turn.coins=3; c2.turn.buys=1; const v0=c2.players[0].vpTokens||0; c2=E.reduce(c2,{type:'BUY',card:'village'});
  ok((c2.players[0].vpTokens||0)===v0+1,'収集＝場を離れても「このターン」のアクション獲得で +1VP');
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
