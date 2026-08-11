FIND [high] 錯乱(Deluded)中に CPU がアクションカードの購入を提案し続けて無限ループ（ポーション経路が canBuyCard ガードを飛び越える）
- file: js/cpu.js:854
- rule: docs/research/nocturne_rules.md 冒頭「実装前に必読」§4 逐語：「錯乱の『アクションを購入できない』は **engine 拒否・CPU 非提案・UI ボタン無効化を同一コミットで**」。さらに §9「CPU の終端保証」＝engine が拒否する手を CPU が出し続けてはならない。
- actual: engine は canBuyCard（js/engine.js:1389）で錯乱中のアクション購入を拒否し、UI も同じ述語でボタンを無効化しているが、**js/cpu.js には `cantBuyActions` の参照が1つも無い**（grep 0 件）。chooseBuy の最終ガード（cpu.js:880 `const canBuy = ... canBuyCard(...)`）は効くが、その手前 cpu.js:854 `if (potions >= 1) { const pc = bestPotionBuy(state, real, potions); if (pc) return pc; }` が**ガードを飛び越えて early return** する。bestPotionBuy（cpu.js:839）は supply>0・コスト・ポーション数しか見ておらず canBuyCard/NON_SUPPLY/splitBlocked を見ていない。ポーション費用の王国カードはブドウ園以外すべてアクションなので、錯乱を返したターンにポーションを1つでも持っていると engine が必ず拒否 → state 不変 → CPU が同じ BUY を無限に返す（ローカルはタブが固まり、オンラインは部屋が固まる）。加えて cpu.js:1624 の闇市場ハンドラも `cantBuyActions` を見ていないため、ヴィラ等で購入フェイズ→アクションフェイズに戻ってから闇市場を使うと engine.js:10142 が拒否して同型のループになる。
- repro: （1）自然発生：全プール混成 fuzz（夜想曲5枚＋他5枚をランダム抽選）120戦のうち1戦が 20000 step で未終局。王国＝skulk,tracker,ghost_town,cursed_village,bard,masterpiece,crypt,alchemist,tragic_hero,acting_troupe。直近14手すべて {"type":"BUY","card":"alchemist"}、直前ログ「C1 は錯乱を返した（このターンはアクションカードを購入できない）。」

（2）最小再現（test/invariants.test.js と同じ vm ローダで cards/engine/cpu を読み込む）:
const K=['alchemist','skulk','bard','tracker','ghost_town','cursed_village','crypt','village','market','smithy'];
let s=E.createInitialState([{name:'C0',isCpu:true,level:'normal'},{name:'C1',isCpu:true,level:'normal'}],K,{startActive:0});
s.players[0].deluded=true;                       // 呪詛「幻惑」を受けた状態
s.players[0].hand=['copper','copper','copper','potion'];
s.players[0].deck=Array(5).fill('copper');
s=E.reduce(s,{type:'END_ACTION_PHASE'});          // ここで錯乱を返す → t.cantBuyActions=true
s=E.reduce(s,{type:'PLAY_ALL_TREASURES'});        // coins=3 / potions=1
console.log(E.canBuyCard(s,0,'alchemist'));       // → false
for(let i=0;i<5;i++){const a=CPU.decide(s);const b=JSON.stringify(s);s=E.reduce(s,a);console.log(a,JSON.stringify(s)!==b);}

実測出力（HEAD）:
canBuyCard(alchemist)= false
0 {"type":"BUY","card":"alchemist"} 変化= false
1 {"type":"BUY","card":"alchemist"} 変化= false
2 {"type":"BUY","card":"alchemist"} 変化= false  …（以下無限）

到達セット＝mix-all（例 `mix:alchemy,nocturne`。ポーション費用カードと不運カードが同居すれば成立）。固定 `nocturne` / `random-nocturne` にはポーション費用カードが無いので到達しない。

