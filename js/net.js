/* ============================================================
   js/net.js — オンライン対戦クライアント（WebSocket / サーバ権威）
   ============================================================ */
(function () {
  const DOM = (window.DOM = window.DOM || {});

  // ============================================================
  // ★ 本番サーバURL（Render デプロイ後にここだけ貼り替える）★
  //   Render で払い出される https://xxxx.onrender.com を wss:// に変えて入れる。
  //   例: 'wss://dominion-abcd.onrender.com'
  // ============================================================
  const PROD_SERVER_URL = 'wss://dominion-server-1hc9.onrender.com';

  // ローカル/LAN で WebSocket サーバを動かすポート（静的配信ポートとは別）
  const LOCAL_WS_PORT = 8787;
  const WS_PATH = '/ws';

  // 接続先 URL を自動判定:
  //   - GitHub Pages 等（*.github.io / https の外部ホスト）→ 本番 wss サーバ
  //   - localhost / LAN IP（http で開いている）→ 同じホストの WS ポート
  function resolveServerUrl() {
    const host = location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1' ||
      /^192\.168\./.test(host) || /^10\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host === '';
    if (!isLocal) {
      // 外部ホスティング（GitHub Pages 等）。本番サーバ（別オリジン）へ wss で。
      return PROD_SERVER_URL.replace(/\/+$/, '') + WS_PATH;
    }
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${host || 'localhost'}:${LOCAL_WS_PORT}${WS_PATH}`;
  }
  DOM.resolveServerUrl = resolveServerUrl;
  DOM.PROD_SERVER_URL = PROD_SERVER_URL;

  /* ---------- WebSocket クライアント（キープアライブ付き） ---------- */
  const PING_MS = 22000;   // 定期pingでアイドル切断を防ぎ、Render無料枠を眠らせない
  const DEAD_MS = 35000;   // この時間 何も受信しなければ「死んでいる」とみなして閉じる→再接続

  DOM.NetClient = function (handler) {
    let ws = null;
    let closedByUs = false;
    let onCloseCb = null;
    let pingTimer = null;
    let monitorTimer = null;
    let lastRecv = 0;

    function stopHeartbeat() {
      if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
      if (monitorTimer) { clearInterval(monitorTimer); monitorTimer = null; }
    }
    function startHeartbeat() {
      stopHeartbeat();
      lastRecv = Date.now();
      pingTimer = setInterval(() => {
        try { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'ping' })); } catch (e) { /* noop */ }
      }, PING_MS);
      monitorTimer = setInterval(() => {
        // pongも含め一定時間 何も来なければ半開き＝実質切断。閉じて onclose→再接続に委ねる。
        if (Date.now() - lastRecv > DEAD_MS) { stopHeartbeat(); try { if (ws) ws.close(); } catch (e) { /* noop */ } }
      }, 5000);
    }

    const api = {
      connect() {
        return new Promise((resolve, reject) => {
          let url;
          try { url = (DOM.resolveServerUrl || resolveServerUrl)(); ws = new WebSocket(url); }
          catch (e) { reject(e); return; }
          ws.onopen = () => { startHeartbeat(); resolve(); };
          ws.onerror = () => { reject(new Error('サーバに接続できませんでした')); };
          ws.onmessage = (ev) => {
            lastRecv = Date.now();
            let m; try { m = JSON.parse(String(ev.data)); } catch (e) { return; }
            if (m.t === 'pong') return; // キープアライブ応答はUIに渡さない
            handler(m);
          };
          ws.onclose = () => { stopHeartbeat(); if (closedByUs) return; if (onCloseCb) onCloseCb(); };
        });
      },
      send(msg) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); },
      setOnClose(cb) { onCloseCb = cb; },
      close() { closedByUs = true; stopHeartbeat(); if (ws) { try { ws.close(); } catch (e) { /* noop */ } } ws = null; },
      isOpen() { return !!ws && ws.readyState === WebSocket.OPEN; },
    };
    return api;
  };

  /* ---------- オンライン用ストア（サーバ権威） ----------
     dispatch は操作をサーバへ送るだけ。状態は必ずサーバから返ってくる
     マスク済み state で更新される（クライアントでは reduce しない）。 */
  DOM.NetStore = function (client) {
    const subs = [];
    function emit() { subs.forEach((f) => f(api.state)); }
    const api = {
      mode: 'online',
      mySeat: null,
      state: null,
      client,
      // 再接続時に ui.js が api.client を新しい接続へ差し替えるため、
      // クロージャの client ではなく必ず api.client を経由する（旧ソケット握りバグ防止）。
      dispatch(action) { api.client.send({ t: 'action', action }); },
      setState(s) { api.state = s; if (s && s.you != null) api.mySeat = s.you; emit(); },
      subscribe(fn) { subs.push(fn); return () => subs.splice(subs.indexOf(fn), 1); },
    };
    return api;
  };
})();
