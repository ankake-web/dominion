// ============================================================
// server/persist.js — 対戦状態の永続化（任意・依存ライブラリ不要）
// ------------------------------------------------------------
// 目的: サーバ(Render無料枠など)が再起動してもメモリ上の対戦が消えないようにする。
// 仕組み: Upstash Redis の REST API を Node 標準 fetch で叩くだけ（npm依存ゼロ）。
//   環境変数 UPSTASH_REDIS_REST_URL と UPSTASH_REDIS_REST_TOKEN を設定すると有効。
//   未設定なら全メソッドが no-op（=従来どおりメモリのみ。挙動・テストに一切影響しない）。
// 保存単位: 部屋1つ = 1キー(dom:room:<code>)。索引(dom:rooms)に code を持つ。
//   各キーは TTL で自動失効し、放置部屋のゴミが残らない。
// ============================================================
'use strict';

const PREFIX = 'dom:room:';
const INDEX = 'dom:rooms';
const TTL_SEC = 6 * 60 * 60; // 6時間で失効（長時間放置の対戦は復元対象から外す）

function createStore() {
  const base = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const hasFetch = typeof fetch === 'function';
  if (!base || !token || !hasFetch) {
    if ((base || token) && !hasFetch) {
      try { console.error('[dominion] 永続化: この Node には fetch が無いため無効（Node 18+ が必要）'); } catch (e) { /* noop */ }
    }
    return { enabled: false, save() {}, del() {}, loadAll: async () => [] };
  }
  const url = base.replace(/\/+$/, '');
  // Upstash REST: 単一コマンドは POST {url} に JSON 配列、複数は POST {url}/pipeline。
  async function cmd(args) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error('redis http ' + res.status);
    const j = await res.json();
    return j.result;
  }
  async function pipeline(cmds) {
    const res = await fetch(url + '/pipeline', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmds),
    });
    if (!res.ok) throw new Error('redis http ' + res.status);
    return res.json();
  }

  try { console.log('[dominion] 永続化: Upstash Redis 有効'); } catch (e) { /* noop */ }
  return {
    enabled: true,
    // 部屋スナップショットを保存（fire-and-forget。失敗してもゲーム進行は止めない）
    save(code, snapshot) {
      let json;
      try { json = JSON.stringify(snapshot); } catch (e) { return; }
      pipeline([
        ['SET', PREFIX + code, json, 'EX', String(TTL_SEC)],
        ['SADD', INDEX, code],
      ]).catch((e) => { try { console.error('[dominion] persist save 失敗:', (e && e.message) || e); } catch (e2) { /* noop */ } });
    },
    // 部屋を削除（対戦終了/破棄時）
    del(code) {
      pipeline([
        ['DEL', PREFIX + code],
        ['SREM', INDEX, code],
      ]).catch(() => { /* noop */ });
    },
    // 起動時: 保存済みの全部屋スナップショットを読み込む
    async loadAll() {
      try {
        const codes = await cmd(['SMEMBERS', INDEX]);
        if (!Array.isArray(codes) || !codes.length) return [];
        const got = await pipeline(codes.map((c) => ['GET', PREFIX + c]));
        const out = [];
        const stale = [];
        codes.forEach((c, i) => {
          const v = got && got[i] && got[i].result;
          if (v) { try { out.push(JSON.parse(v)); } catch (e) { stale.push(c); } }
          else stale.push(c); // 失効/欠損は索引から掃除
        });
        if (stale.length) pipeline(stale.map((c) => ['SREM', INDEX, c])).catch(() => {});
        return out;
      } catch (e) {
        try { console.error('[dominion] persist loadAll 失敗:', (e && e.message) || e); } catch (e2) { /* noop */ }
        return [];
      }
    },
  };
}

module.exports = { createStore };
