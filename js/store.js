/* ============================================================
   ストア層: ローカル(1台/CPU)用。オンラインは js/net.js の NetStore。
   ============================================================ */
(function () {
  const DOM = (window.DOM = window.DOM || {});

  /* ---------- ローカル(同じ画面で2人 / CPU対戦) ----------
     クライアント側エンジンで状態遷移する（オフラインで完結）。 */
  DOM.LocalStore = function (state) {
    const subs = [];

    /* ---------- 「1手もどす」の履歴（初心者モード） ----------
       積むのは **人間が自分で行った操作の直前の状態だけ**（CPUの手番・アクションフェイズの自動スキップは積まない）。
       ＝押すと「自分が最後にした操作の直前」まで戻る。間に挟まったCPUの手番はまとめて巻き戻る
         （＝「うっかりターンを終了した」も救える）。
       state は reduce が毎回 clone を返す純関数なので、過去の state をそのまま持っておけば復元できる
         （エンジンは受け取った state を書き換えない＝参照を持つだけでコピーは不要）。
       owner を持つのは「他人のターンを覗き見しながら巻き戻す」のを防ぐため
         （1台で人間同士のときは、自分が打った手より前には戻せない）。 */
    const history = [];
    const MAX_HISTORY = 40;

    const api = {
      mode: 'local',
      mySeat: null, // ローカルは「今アクションすべき人」が操作者
      state: state,
      // opts.undoSeat != null ＝「その席の人間が自分の意思で行った操作」＝戻れる地点として直前の状態を積む。
      dispatch(action, opts) {
        // 新しいゲーム（再戦）に入ったら前のゲームへ戻れないよう履歴を捨てる。
        if (action && action.type === 'NEW_GAME') history.length = 0;
        else if (opts && opts.undoSeat != null) {
          history.push({ state: api.state, seat: opts.undoSeat });
          if (history.length > MAX_HISTORY) history.shift();
        }
        api.state = DOM.engine.reduce(api.state, action);
        emit();
      },
      // seat が「自分の直前の操作」まで戻せるか（履歴の一番上が自分の手のときだけ true）
      canUndo(seat) {
        const top = history[history.length - 1];
        return !!top && top.seat === seat;
      },
      undo(seat) {
        if (!api.canUndo(seat)) return false;
        api.state = history.pop().state;
        emit();
        return true;
      },
      undoDepth() { return history.length; },
      clearUndo() { history.length = 0; },
      subscribe(fn) {
        subs.push(fn);
        return () => subs.splice(subs.indexOf(fn), 1);
      },
    };
    function emit() {
      subs.forEach((f) => f(api.state));
    }
    return api;
  };
})();
