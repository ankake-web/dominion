/* ============================================================
   ストア層: ローカル(1台)とオンライン(2台)で同じUIを使うための抽象
   ============================================================ */
(function () {
  const DOM = (window.DOM = window.DOM || {});

  /* ---------- ローカル(同じ画面で2人) ---------- */
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

  /* ---------- オンライン(Firebase Realtime Database) ---------- */
  // db: firebase database, code: 部屋コード, mySeat: 自分の座席(0 or 1)
  // 【設計メモ】盤面(相手の手札・山札順を含む)を両端末で丸ごと同期する
  // 信頼ベースの方式です。画面上は相手の手札を伏せますが、開発者ツールで
  // 覗けば見えてしまいます。夫婦・友人など信頼できる相手との対戦を想定。
  // 完全な秘匿にはサーバ権威化が必要ですが、無料・簡単構成を優先しています。
  DOM.OnlineStore = function (db, code, mySeat) {
    const ref = db.ref('rooms/' + code + '/state');
    const subs = [];
    function emit() {
      subs.forEach((f) => f(api.state));
    }
    const api = {
      mode: 'online',
      mySeat: mySeat,
      code: code,
      state: null,
      dispatch(action) {
        if (!api.state) return;
        // 自分の番(または自分が選択待ち)のときだけ操作可能
        const actor = DOM.engine.actor(api.state);
        if (actor !== mySeat && action.type !== 'NEW_GAME') return;
        const next = DOM.engine.reduce(api.state, action);
        next.version = (api.state.version || 0) + 1;
        api.state = next;
        emit();
        ref.set(next);
      },
      subscribe(fn) {
        subs.push(fn);
        return () => subs.splice(subs.indexOf(fn), 1);
      },
      // ホストが盤面を丸ごと書き込む（ゲーム開始時など）
      pushFull(s) {
        api.state = s;
        emit();
        ref.set(s);
      },
      detach() {
        ref.off();
      },
    };
    ref.on('value', (snap) => {
      const v = snap.val();
      if (!v) return;
      if (api.state == null || (v.version || 0) >= (api.state.version || 0)) {
        api.state = v;
        emit();
      }
    });
    return api;
  };

  /* ---------- 部屋コード生成（紛らわしい文字を除外） ---------- */
  DOM.makeRoomCode = function () {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  };
})();
