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
const mk = (K, n) => E.createInitialState(Array.from({ length: n || 2 }, (_, i) => ({ name: 'P' + i, isCpu: i > 0 })), K.slice(), { startActive: 0 });
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
