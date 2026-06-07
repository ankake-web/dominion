/* ============================================================
   ストア層: ローカル(1台/CPU)用。オンラインは js/net.js の NetStore。
   ============================================================ */
(function () {
  const DOM = (window.DOM = window.DOM || {});

  /* ---------- ローカル(同じ画面で2人 / CPU対戦) ----------
     クライアント側エンジンで状態遷移する（オフラインで完結）。 */
  DOM.LocalStore = function (state) {
    const subs = [];
    const api = {
      mode: 'local',
      mySeat: null, // ローカルは「今アクションすべき人」が操作者
      state: state,
      dispatch(action) {
        api.state = DOM.engine.reduce(api.state, action);
        emit();
      },
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
