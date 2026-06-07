// ============================================================
// server/index.js — ドミニオン オンライン対戦サーバ 起動エントリ
// ============================================================
//
// Render などの Node ホスティングで単体起動する:
//   npm start    (= node server/index.js)
//
// 環境変数:
//   PORT             … listen ポート。ホスティングが注入する。未設定ならローカル用 8787。
//   ALLOWED_ORIGINS  … 接続を許可する Origin（カンマ区切り）。本番は GitHub Pages の
//                      オリジン（例 https://<user>.github.io）を設定する。未設定=全許可。

const http = require('node:http');
const { attachGameServer } = require('./gameServer');

const PORT = Number(process.env.PORT) || 8787;
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
  : [];

// ヘルスチェック（Render の healthCheckPath）と、無料枠スリープからの復帰アクセス用。
const httpServer = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('ok');
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('not found');
});

attachGameServer(httpServer, { allowedOrigins });

httpServer.listen(PORT, () => {
  console.log(`[dominion] WebSocket server listening on :${PORT} (path /ws)`);
  console.log(`[dominion] allowed origins: ${allowedOrigins.length ? allowedOrigins.join(', ') : '(all — dev)'}`);
});
