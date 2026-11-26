// ================================================================
//  UMBRELLA CAT — PewPlay
//  @bg #141a33
//  @accent #ffb347
//  Un gatto con l'ombrello vola tra camini e insegne sotto la pioggia.
//  Mondo alto 640 unità, largo quanto serve allo schermo.
// ================================================================
(function () {
  'use strict';
  const { clamp, rand, sfx, store } = PP;

  const GAME_ID = 'umbrella-cat';
  const WH = 640;               // altezza logica del mondo
  const GRAV = 1500, FLAP = -470, SPEED0 = 170;
  const GAP0 = 190, GAP_MIN = 138, SPACING = 250;

  let s = 1, ww = 400;          // scala e larghezza logica visibile
  let cat, pipes, fish, rain, cityFar, cityNear;
  let score = 0, dist = 0, speed = SPEED0, started = false, dead = false, deadT = 0;
  let nextPipe = 0;
  let frozen = false;           // solo per gli screenshot

  const best = () => store.get('best', 0);

  function layout() { s = PP.H / WH; ww = PP.W / s; }

  function makeCity(n, hMin, hMax, w0, w1) {
    const arr = []; let x = 0;
    while (x < 3000) { const w = rand(w0, w1); arr.push({ x, w, h: rand(hMin, hMax), win: Math.random() }); x += w + rand(4, 20); }
    return arr;
  }

  function init() {
    rain = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), l: rand(10, 22), v: rand(500, 800) }));
    cityFar = makeCity(0, 120, 260, 50, 120);
    cityNear = makeCity(0, 60, 160, 40, 90);
    resetWorld();
  }

  function resetWorld() {
    layout();
    cat = { x: Math.min(ww * 0.3, 160), y: WH * 0.45, vy: 0, rot: 0, open: 0 };
    pipes = []; fish = [];
    score = 0; dist = 0; speed = SPEED0; started = false; dead = false; deadT = 0;
    nextPipe = ww + 60;
  }

  function gapFor(n) { return Math.max(GAP_MIN, GAP0 - n * 2.2); }

  function addPipe() {
    const gap = gapFor(score);
    const margin = 90;
    const cy = rand(margin + gap / 2, WH - 70 - margin - gap / 2 + 40);
    pipes.push({ x: nextPipe, w: 70, top: cy - gap / 2, bot: cy + gap / 2, passed: false, sign: PP.pick(['#ff6b8b', '#4fd1ff', '#ffd25a', '#9b7bff']) });
    if (Math.random() < 0.55) fish.push({ x: nextPipe + 35 + SPACING / 2, y: rand(140, WH - 160), got: false });
    nextPipe += SPACING - Math.min(score, 30);
  }

  function flap() {
    if (dead) return;
    if (!started) started = true;
    cat.vy = FLAP;
    cat.open = 1;
    sfx.tone(520, 0.09, 'triangle', 0.12, 780);
  }

  function crash() {
    if (dead) return;
    dead = true; deadT = 0;
    PP.shake = 12;
    PP.burst(cat.x * s, cat.y * s, ['#ffb347', '#fff', '#ff6b8b'], 26, 260 * s, 4 * s, 0.8, 600 * s);
    sfx.noise(0.25, 0.3, 700); sfx.tone(300, 0.4, 'sawtooth', 0.12, 80);
    const b = best(); const rec = score > b;
    if (rec) store.set('best', score);
    PP.over(rec && score > 0 ? 'New record!' : 'Splash!', `Score: ${score}\nBest: ${Math.max(score, b)}`);
  }

  function update(dt) {
    layout();
    if (frozen) return;
    for (const r of rain) { r.y += r.v * dt / WH; r.x -= dt * 0.15; if (r.y > 1) { r.y = 0; r.x = Math.random() * 1.2; } }
    cat.open = Math.max(0, cat.open - dt * 3);
    if (!started) { cat.y = WH * 0.45 + Math.sin(PP.time * 3) * 10; return; }
    if (dead) {
      deadT += dt;
      cat.vy += GRAV * dt; cat.y = Math.min(WH - 60, cat.y + cat.vy * dt); cat.rot = Math.min(cat.rot + dt * 6, 2.5);
      return;
    }
    speed = SPEED0 + Math.min(score, 40) * 3;
    dist += speed * dt;
    cat.vy = Math.min(cat.vy + GRAV * dt, 700);
    cat.y += cat.vy * dt;
    cat.rot = clamp(cat.vy / 900, -0.45, 0.9);

    nextPipe -= speed * dt;
    while (nextPipe < ww + 100) addPipe();
    for (const p of pipes) p.x -= speed * dt;
    for (const f of fish) f.x -= speed * dt;
    pipes = pipes.filter(p => p.x + p.w > -20);
    fish = fish.filter(f => f.x > -30 && !f.got);

    const r = 19;
    if (cat.y + r > WH - 58 || cat.y - r < 0) return crash();
    for (const p of pipes) {
      if (cat.x + r > p.x + 6 && cat.x - r < p.x + p.w - 6 && (cat.y - r + 4 < p.top || cat.y + r - 4 > p.bot)) return crash();
      if (!p.passed && p.x + p.w < cat.x) {
        p.passed = true; score++;
        sfx.tone(880, 0.07, 'square', 0.08); sfx.tone(1320, 0.08, 'square', 0.06, null, 0.06);
      }
    }
    for (const f of fish) {
      if (!f.got && Math.hypot(f.x - cat.x, f.y - cat.y) < 32) {
        f.got = true; score += 2;
        PP.floatText('+2', f.x * s, f.y * s, '#7ee8ff', 22 * s);
        PP.burst(f.x * s, f.y * s, ['#7ee8ff', '#fff'], 12, 150 * s, 3 * s, 0.5, 0);
        sfx.chord([990, 1320], 0.1, 'triangle', 0.1, 0.04);
      }
    }
  }

  // ── DISEGNO ──────────────────────────────────────
  function drawSky(ctx, W, H) {
    ctx.fillStyle = PP.vgrad(0, H, '#232a5c', '#0e1230');
    ctx.fillRect(0, 0, W, H);
    // luna
    const mx = W * 0.8, my = H * 0.17;
    ctx.save(); ctx.shadowColor = 'rgba(255,240,200,.6)'; ctx.shadowBlur = 40 * s;
    PP.circle(mx, my, 34 * s, '#fff3d1'); ctx.restore();
    PP.circle(mx + 12 * s, my - 6 * s, 30 * s, '#262d61');
  }

  function drawCity(ctx, list, par, base, color, winColor) {
    const off = (dist * par) % 3000;
    ctx.fillStyle = color;
    for (let pass = 0; pass < 2; pass++) for (const b of list) {
      const x = (b.x - off + pass * 3000) * s;
      if (x > PP.W || x + b.w * s < 0) continue;
      ctx.fillRect(x, (base - b.h) * s, b.w * s, b.h * s + 2);
      if (winColor) {
        ctx.fillStyle = winColor;
        for (let wy = base - b.h + 12; wy < base - 10; wy += 22) for (let wx = 8; wx < b.w - 10; wx += 18) {
          if (((wx * 13 + wy * 7 + b.win * 100) | 0) % 3 === 0) ctx.fillRect(x + wx * s, wy * s, 7 * s, 9 * s);
        }
        ctx.fillStyle = color;
      }
    }
  }

  function drawPipe(ctx, p) {
    const x = p.x * s, w = p.w * s;
    // camino dal basso (mattoni)
    const by = p.bot * s, bh = (WH - 58) * s - by;
    ctx.fillStyle = '#7a3b2e'; ctx.fillRect(x, by, w, bh);
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    for (let yy = by + 14 * s; yy < by + bh; yy += 14 * s) ctx.fillRect(x, yy, w, 2 * s);
    ctx.fillStyle = '#8f4a3a'; ctx.fillRect(x - 6 * s, by, w + 12 * s, 16 * s);
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x - 6 * s, by, w + 12 * s, 4 * s);
    // insegna appesa dall'alto
    const th = p.top * s;
    ctx.fillStyle = '#2b2f4a'; ctx.fillRect(x + w * 0.2, 0, 5 * s, th - 30 * s); ctx.fillRect(x + w * 0.8 - 5 * s, 0, 5 * s, th - 30 * s);
    ctx.save(); ctx.shadowColor = p.sign; ctx.shadowBlur = 18 * s;
    PP.rr(x - 4 * s, th - 34 * s, w + 8 * s, 34 * s, 8 * s); ctx.fillStyle = '#1a1d33'; ctx.fill();
    ctx.lineWidth = 3 * s; ctx.strokeStyle = p.sign; ctx.stroke(); ctx.restore();
    ctx.fillStyle = p.sign; ctx.globalAlpha = 0.85;
    for (let i = 0; i < 3; i++) PP.circle(x + w * (0.25 + i * 0.25), th - 17 * s, 4 * s, p.sign);
    ctx.globalAlpha = 1;
  }

  function drawFish(ctx, f) {
    const x = f.x * s, y = (f.y + Math.sin(PP.time * 4 + f.x) * 6) * s;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.shadowColor = '#7ee8ff'; ctx.shadowBlur = 14;
    ctx.fillStyle = '#7ee8ff';
    ctx.beginPath(); ctx.ellipse(0, 0, 14, 8, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-22, -8); ctx.lineTo(-22, 8); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; PP.circle(7, -2, 2, '#14203a');
    ctx.restore();
  }

  const circ = (c, x, y, r, col) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = col; c.fill(); };

  function drawCat(ctx, x, y, rot, open, scale = 1) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot * 0.6); ctx.scale(scale, scale);
    // ombrello
    const ow = 34 + open * 8;
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(4, -34); ctx.lineTo(4, 2); ctx.stroke();
    ctx.fillStyle = '#ffb347';
    ctx.beginPath(); ctx.moveTo(4 - ow, -30); ctx.quadraticCurveTo(4, -64 - open * 6, 4 + ow, -30);
    for (let i = 3; i >= 0; i--) ctx.quadraticCurveTo(4 - ow + (i + 0.5) * ow / 2, -24, 4 - ow + i * ow / 2, -30);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.beginPath(); ctx.moveTo(4 - ow * 0.6, -36); ctx.quadraticCurveTo(4, -58, 4 + ow * 0.1, -50); ctx.lineTo(4 - ow * 0.4, -34); ctx.fill();
    // coda
    ctx.strokeStyle = '#3d3d52'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-14, 10); ctx.quadraticCurveTo(-30, 4 + Math.sin(PP.time * 8) * 6, -26, -10); ctx.stroke();
    // corpo
    ctx.fillStyle = '#3d3d52';
    ctx.beginPath(); ctx.ellipse(-2, 10, 16, 12, 0, 0, 7); ctx.fill();
    // testa
    ctx.beginPath(); ctx.arc(10, -2, 13, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(1, -10); ctx.lineTo(3, -22); ctx.lineTo(10, -13); ctx.fill();
    ctx.beginPath(); ctx.moveTo(12, -13); ctx.lineTo(20, -21); ctx.lineTo(21, -8); ctx.fill();
    // zampa sull'ombrello
    ctx.beginPath(); ctx.ellipse(5, 0, 4, 6, 0, 0, 7); ctx.fill();
    // occhi
    circ(ctx, 9, -3, 3.4, '#d8ff6b'); circ(ctx, 17, -3, 3.4, '#d8ff6b');
    ctx.fillStyle = '#111'; ctx.fillRect(8.4, -6, 1.4, 6); ctx.fillRect(16.4, -6, 1.4, 6);
    circ(ctx, 14, 3, 1.6, '#ff9fb0');
    ctx.restore();
  }

  function draw(ctx, W, H) {
    layout();
    drawSky(ctx, W, H);
    drawCity(ctx, cityFar, 0.2, WH - 40, '#1b2148', 'rgba(255,214,120,.25)');
    drawCity(ctx, cityNear, 0.5, WH - 40, '#141836', 'rgba(255,214,120,.45)');
    if (PP.state !== 'menu') {
      for (const p of pipes) drawPipe(ctx, p);
      for (const f of fish) if (!f.got) drawFish(ctx, f);
    }
    // tetti in primo piano
    const roofOff = (dist % 80) * s;
    ctx.fillStyle = '#0b0d22'; ctx.fillRect(0, (WH - 58) * s, W, 58 * s + 2);
    ctx.fillStyle = '#2a2f5a';
    for (let x = -roofOff; x < W; x += 80 * s) { ctx.beginPath(); ctx.moveTo(x, (WH - 58) * s); ctx.lineTo(x + 40 * s, (WH - 70) * s); ctx.lineTo(x + 80 * s, (WH - 58) * s); ctx.fill(); }
    // pioggia
    ctx.strokeStyle = 'rgba(170,190,255,.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const r of rain) { const x = r.x * W, y = r.y * H; ctx.moveTo(x, y); ctx.lineTo(x - r.l * 0.3, y + r.l); }
    ctx.stroke();

    if (PP.state === 'menu') {
      drawCat(ctx, W * 0.5, H * 0.24 + Math.sin(PP.time * 3) * 8, 0, 0.5, s * 1.4);
      return;
    }
    drawCat(ctx, cat.x * s, cat.y * s, cat.rot, cat.open, s);
    PP.drawFx();
    // punteggio
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 8;
    PP.text(`${score}`, W / 2, Math.max(54, 70 * s), Math.max(34, 54 * s), '#fff', 'center', 900);
    ctx.restore();
    if (!started && !dead) PP.text('Tap, click or press Space to fly', W / 2, H * 0.68, Math.max(15, 18 * s), 'rgba(255,255,255,.85)', 'center', 700);
  }

  function demo(n) {
    resetWorld(); started = true;
    score = [0, 7, 23, 14][n];
    dist = score * 260;
    const gapY = [0, 300, 260, 340][n];
    pipes = [];
    const xs = [cat.x - 150, cat.x + 120, cat.x + 370, cat.x + 620];
    xs.forEach((x, i) => { const g = gapFor(score); const cy = gapY + (i % 2 ? -50 : 40) * (n === 2 ? 1.3 : 1); pipes.push({ x, w: 70, top: cy - g / 2, bot: cy + g / 2, passed: i === 0, sign: ['#ff6b8b', '#4fd1ff', '#ffd25a', '#9b7bff'][i] }); });
    fish = [{ x: cat.x + 250, y: gapY - 30, got: false }];
    cat.y = gapY + (n === 2 ? -10 : 20); cat.vy = n === 3 ? -300 : 80; cat.rot = cat.vy / 900; cat.open = n === 3 ? 0.9 : 0.2;
    speed = 0;
    if (n === 3) PP.burst(cat.x * s + 60 * s, cat.y * s, ['#7ee8ff', '#fff'], 14, 120 * s, 3 * s, 1, 0);
    pipes.forEach(p => { p.x += 0; });
    frozen = true;
  }

  function icon(c, S) {
    c.fillStyle = '#232a5c'; c.fillRect(0, 0, S, S);
    const g = c.createLinearGradient(0, 0, 0, S); g.addColorStop(0, '#2c3470'); g.addColorStop(1, '#141836');
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    c.strokeStyle = 'rgba(170,190,255,.35)'; c.lineWidth = 3;
    for (let i = 0; i < 26; i++) { const x = (i * 97) % S, y = (i * 61) % S; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 6, y + 22); c.stroke(); }
    drawCat(c, S * 0.5, S * 0.6, -0.15, 0.6, S / 170);
  }

  PP.run({
    id: GAME_ID,
    title: 'Umbrella Cat',
    intro: 'Help the cat float through the rainy rooftops.\nTap, click or press Space to lift the umbrella.',
    bestText: () => `Best: ${best()}`,
    pauseText: () => `Score: ${score}`,
    init,
    start: () => { frozen = false; resetWorld(); },
    update, draw, demo, icon,
    pointerDown: flap,
    keyDown: code => { if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') flap(); },
    resize: layout,
  });
})();
