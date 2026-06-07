/* ============================================================
   js/audio.js — 効果音(SE)＋BGM（Web Audio API・手続き生成）
   音源ファイル不要・著作権フリー・オフライン/GitHub Pages対応。
   AudioContext が無い環境（jsdom等）では全て無音で安全に no-op。
   ============================================================ */
(function () {
  const DOM = (window.DOM = window.DOM || {});

  let ctx = null;
  function getCtx() {
    if (ctx && ctx.state !== 'closed') return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; }
    return ctx;
  }
  function resume() { const c = getCtx(); if (c && c.state === 'suspended') { try { c.resume(); } catch (e) { /* noop */ } } }

  /* ---------- 設定（localStorage 永続化） ---------- */
  const K = { se: 'dom_se', bgm: 'dom_bgm', track: 'dom_bgm_track' };
  function loadBool(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : v === '1'; } catch (e) { return def; } }
  function saveBool(k, b) { try { localStorage.setItem(k, b ? '1' : '0'); } catch (e) { /* noop */ } }
  function loadInt(k, def) { try { const v = parseInt(localStorage.getItem(k), 10); return isNaN(v) ? def : v; } catch (e) { return def; } }
  let seOn = loadBool(K.se, true);
  let bgmOn = loadBool(K.bgm, false);
  let trackIdx = loadInt(K.track, 0);

  /* ---------- 効果音（合成） ---------- */
  function blip(freq, start, dur, vol, type, slideTo) {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime + start;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function chord(freqs, start, dur, vol, type) { freqs.forEach((f) => blip(f, start, dur, vol, type)); }

  // 紙・布・木などの「質感」音はノイズをフィルタして作る（カードをめくる音など）
  let noiseBuf = null;
  function getNoise() {
    const c = getCtx(); if (!c) return null;
    if (noiseBuf) return noiseBuf;
    const len = Math.floor(c.sampleRate * 0.5);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseBuf = buf; return buf;
  }
  function noise(start, dur, vol, filterType, freq, q) {
    const c = getCtx(); if (!c) return;
    const buf = getNoise(); if (!buf) return;
    const t = c.currentTime + start;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = filterType || 'bandpass'; f.frequency.value = freq || 2000; if (q) f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t); src.stop(t + dur + 0.02);
  }

  // 中世ファンタジー寄りの有機的な効果音（紙・木・ハープ・ベル・金貨・ファンファーレ）
  const SE = {
    tap: () => { noise(0, 0.07, 0.09, 'bandpass', 2600, 1.1); blip(190, 0, 0.06, 0.05, 'triangle', 120); }, // カードをめくる/木の軽いタップ
    action: () => { noise(0, 0.10, 0.09, 'bandpass', 1700, 0.8); blip(523.3, 0.04, 0.13, 0.10, 'triangle'); blip(784.0, 0.10, 0.13, 0.08, 'triangle'); }, // カードを置く＋ハープ
    coin: () => { blip(1175, 0, 0.07, 0.10, 'sine'); blip(1568, 0.05, 0.08, 0.09, 'sine'); blip(2093, 0.10, 0.10, 0.06, 'sine'); blip(1318, 0.15, 0.07, 0.05, 'sine'); }, // 金貨の音
    buy: () => { [392, 523.3, 659.3, 880].forEach((f, i) => blip(f, i * 0.07, 0.16, 0.13, 'triangle')); noise(0.02, 0.18, 0.05, 'highpass', 4000, 0.4); blip(196, 0, 0.3, 0.06, 'triangle'); }, // ハープのアルペジオ＋きらめき
    gain: () => { blip(523.3, 0, 0.11, 0.10, 'triangle'); blip(659.3, 0.08, 0.16, 0.09, 'triangle'); noise(0, 0.06, 0.04, 'highpass', 5000); },
    trash: () => { noise(0, 0.22, 0.10, 'lowpass', 900, 0.7); blip(200, 0, 0.20, 0.10, 'sawtooth', 80); }, // 燃やす/崩す
    discard: () => noise(0, 0.12, 0.08, 'lowpass', 1500, 0.6), // 紙を捨てる
    shield: () => { noise(0, 0.08, 0.06, 'highpass', 3200, 0.5); blip(660, 0, 0.18, 0.08, 'square'); blip(988, 0.02, 0.18, 0.05, 'square'); }, // 金属の盾
    turn: () => { blip(659.3, 0, 0.20, 0.09, 'sine'); blip(987.8, 0.10, 0.26, 0.06, 'sine'); }, // 鐘
    victory: () => { [523.3, 659.3, 784, 1046.5].forEach((f, i) => { blip(f, i * 0.12, 0.32, 0.14, 'triangle'); blip(f / 2, i * 0.12, 0.32, 0.05, 'triangle'); }); chord([523.3, 659.3, 784, 1046.5], 0.50, 0.7, 0.10, 'triangle'); }, // 勝利ファンファーレ
    error: () => blip(196, 0, 0.16, 0.10, 'triangle', 150),
  };
  function play(name) {
    if (!seOn) return;
    const c = getCtx(); if (!c) return;
    resume();
    const fn = SE[name]; if (fn) try { fn(); } catch (e) { /* noop */ }
  }

  /* ---------- ログから効果音を鳴らす（人間/CPU/相手すべて共通） ---------- */
  let lastEntry; // 直近に鳴らしたログ行
  function reactToLog(log) {
    if (!Array.isArray(log) || !log.length) return;
    const latest = log[log.length - 1];
    if (lastEntry === undefined) { lastEntry = latest; return; } // 初回はベースライン（鳴らさない）
    if (latest === lastEntry) return;
    lastEntry = latest;
    if (latest.includes('ゲーム終了')) return; // 勝敗演出は別途
    if (latest.includes('を使った')) play('action');
    else if (latest.includes('購入した')) play('buy');
    else if (latest.includes('獲得した')) play('gain');
    else if (latest.includes('廃棄した')) play('trash');
    else if (latest.includes('全て出した')) play('coin');
    else if (latest.includes('堀')) play('shield');
    else if (latest.includes('捨て')) play('discard');
    else if (latest.includes('の番です')) play('turn');
  }
  function resetLog() { lastEntry = undefined; }

  /* ---------- BGM（手続き生成・低音量ループ） ---------- */
  const TRACKS = [
    {
      name: '王城の広間', beat: 0.34, mel: 'triangle', bass: 'triangle', vol: 0.07,
      seq: [
        [440, 1, 0.7], [523.3, 1, 0.6], [493.9, 1, 0.65], [440, 1, 0.6], [392, 1, 0.55], [440, 2, 0.6],
        [493.9, 1, 0.65], [587.3, 1, 0.6], [523.3, 1, 0.6], [493.9, 1, 0.55], [440, 1, 0.6], [493.9, 2, 0.6],
        [523.3, 1, 0.65], [659.3, 1, 0.7], [587.3, 1, 0.6], [523.3, 1, 0.6], [493.9, 1, 0.55], [523.3, 2, 0.6],
        [440, 1, 0.6], [392, 1, 0.55], [349.2, 1, 0.6], [392, 1, 0.6], [440, 1, 0.6], [440, 3, 0.55],
      ],
    },
    {
      name: '宝物庫の夜', beat: 0.6, mel: 'sine', bass: 'triangle', vol: 0.07,
      seq: [
        [440, 2, 0.5], [523.3, 2, 0.45], [659.3, 2, 0.5], [587.3, 2, 0.4],
        [523.3, 2, 0.45], [493.9, 2, 0.4], [440, 3, 0.5], [392, 1, 0.35],
        [349.2, 2, 0.45], [392, 2, 0.4], [440, 2, 0.5], [523.3, 2, 0.45],
        [493.9, 2, 0.4], [440, 2, 0.45], [392, 3, 0.5], [329.6, 1, 0.35],
      ],
    },
  ];
  let bgmTimer = null, bgmGain = null, bgmId = 0, bgmStep = 0;
  function bgmNote(freq, dur, vol, tr) {
    const c = getCtx(); if (!c || !bgmGain) return;
    const t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = tr.mel; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * 0.5), t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.95);
    o.connect(g); g.connect(bgmGain); o.start(t); o.stop(t + dur);
    const b = c.createOscillator(), bg = c.createGain();
    b.type = tr.bass; b.frequency.value = freq / 2;
    bg.gain.setValueAtTime(0.0001, t);
    bg.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * 0.3), t + 0.05);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.9);
    b.connect(bg); bg.connect(bgmGain); b.start(t); b.stop(t + dur);
  }
  function bgmStart() {
    if (!bgmOn) return;
    bgmStop();
    const c = getCtx(); if (!c) return;
    resume();
    bgmGain = c.createGain(); bgmGain.gain.value = 1; bgmGain.connect(c.destination);
    const id = ++bgmId; bgmStep = 0;
    const tr = TRACKS[trackIdx] || TRACKS[0];
    const tick = () => {
      if (id !== bgmId || !bgmOn) return;
      const step = tr.seq[bgmStep % tr.seq.length];
      bgmNote(step[0], step[1] * tr.beat, step[2] * tr.vol, tr);
      bgmStep++;
      bgmTimer = setTimeout(tick, step[1] * tr.beat * 1000);
    };
    tick();
  }
  function bgmStop() {
    bgmId++;
    if (bgmTimer) { clearTimeout(bgmTimer); bgmTimer = null; }
    if (bgmGain) { try { bgmGain.disconnect(); } catch (e) { /* noop */ } bgmGain = null; }
  }

  /* ---------- 公開API ---------- */
  DOM.audio = {
    unlock() { resume(); },
    sfx: play,
    reactToLog,
    resetLog,
    victory() { if (seOn) { resume(); try { SE.victory(); } catch (e) { /* noop */ } } },
    // 設定
    isSe() { return seOn; },
    isBgm() { return bgmOn; },
    toggleSe() { seOn = !seOn; saveBool(K.se, seOn); if (seOn) play('tap'); return seOn; },
    toggleBgm() { bgmOn = !bgmOn; saveBool(K.bgm, bgmOn); if (bgmOn) bgmStart(); else bgmStop(); return bgmOn; },
    startBgm: bgmStart,
    stopBgm: bgmStop,
    tracks: () => TRACKS.map((t) => t.name),
    track: () => trackIdx,
    setTrack(i) { trackIdx = ((i % TRACKS.length) + TRACKS.length) % TRACKS.length; saveBool; try { localStorage.setItem(K.track, String(trackIdx)); } catch (e) { /* noop */ } if (bgmOn) bgmStart(); return trackIdx; },
  };
})();
