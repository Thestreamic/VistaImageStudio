/** Launch screen. Progress is driven by the main process and must not lock below 100%. */
export const splashHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Vista Image Studio</title>
  <style>
    html, body {
      margin: 0; height: 100%;
      background: #0e0f14;
      color: #ece8f5;
      font-family: "Segoe UI", "Helvetica Neue", sans-serif;
      overflow: hidden;
      user-select: none;
    }
    .wrap {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 36px 56px 40px;
      box-sizing: border-box;
      background:
        radial-gradient(ellipse at 50% 0%, #2a1848 0%, transparent 55%),
        linear-gradient(180deg, #14151c 0%, #0e0f14 100%);
    }
    .mark {
      width: 72px; height: 72px; border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 12px 40px rgba(0,0,0,0.45);
      margin-bottom: 18px;
      background: #1a1c22;
    }
    .mark svg { display: block; width: 72px; height: 72px; }
    h1 { margin: 0; font-size: 22px; font-weight: 650; letter-spacing: 0.04em; }
    .ver { margin-top: 6px; font-size: 11px; color: #9b96ab; letter-spacing: 0.16em; text-transform: uppercase; }
    .status {
      margin-top: 42px;
      width: min(520px, 100%);
      font-size: 13px;
      color: #c8c2d6;
      min-height: 1.3em;
    }
    .track {
      margin-top: 10px;
      width: min(520px, 100%);
      height: 8px;
      border-radius: 999px;
      background: #23242e;
      overflow: hidden;
      box-shadow: inset 0 1px 2px rgba(0,0,0,0.45);
    }
    .fill {
      height: 100%;
      width: 0%;
      border-radius: inherit;
      background: linear-gradient(90deg, #22d3ee, #6366f1 45%, #c084fc);
    }
    .pct { margin-top: 8px; width: min(520px, 100%); font-size: 11px; color: #8b8699; text-align: right; font-variant-numeric: tabular-nums; }
    .foot { position: absolute; bottom: 18px; font-size: 10px; color: #6b6678; letter-spacing: 0.12em; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="mark">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="72" height="72">
        <rect x="64" y="64" width="896" height="896" rx="208" fill="#2A2D33"/>
        <circle cx="512" cy="512" r="318" fill="none" stroke="#E0B13A" stroke-width="42"/>
        <circle cx="512" cy="512" r="252" fill="none" stroke="#C9A227" stroke-width="22"/>
        <circle cx="512" cy="512" r="198" fill="#14161B"/>
        <path d="M338 548 L448 412 L512 478 L590 392 L686 548 Z" fill="#1C1F26"/>
        <circle cx="512" cy="404" r="28" fill="#F3D277"/>
      </svg>
    </div>
    <h1>Vista Image Studio</h1>
    <div class="ver">Local photo editor · v0.1.0</div>
    <div class="status" id="status">Starting Vista Image Studio…</div>
    <div class="track"><div class="fill" id="fill"></div></div>
    <div class="pct" id="pct">0%</div>
    <div class="foot">Privacy-first · nothing leaves this device</div>
  </div>
  <script>
    const fill = document.getElementById('fill');
    const status = document.getElementById('status');
    const pctEl = document.getElementById('pct');
    let floor = 0;
    let cap = 22;
    let capAt = Date.now();
    let shown = 0;
    let done = false;
    const tau = 700;

    function setPhase(nextFloor, nextCap, text) {
      if (done) return;
      const f = Math.max(floor, Math.min(96, nextFloor));
      // Never shrink the cap: a second Next.js load locked floor=cap=84 with a fake label.
      const c = Math.max(cap, f + 6, Math.min(96, nextCap));
      floor = f;
      cap = Math.min(96, c);
      capAt = Date.now();
      if (text) status.textContent = text;
    }

    function complete() {
      done = true;
      floor = 100;
      cap = 100;
      shown = 100;
      status.textContent = 'Ready';
      fill.style.width = '100%';
      pctEl.textContent = '100%';
    }

    window.__setPhase = setPhase;
    window.__complete = complete;

    function tick() {
      if (done) return;
      const t = (Date.now() - capAt) / tau;
      const eased = 1 - Math.exp(-Math.max(0, t));
      const target = floor + (cap - floor) * eased;
      shown += (target - shown) * 0.35;
      const p = Math.max(0, Math.min(96, Math.round(shown)));
      fill.style.width = p + '%';
      pctEl.textContent = p + '%';
      requestAnimationFrame(tick);
    }
    setPhase(4, 22, 'Starting Vista Image Studio…');
    requestAnimationFrame(tick);
  </script>
</body>
</html>
`
