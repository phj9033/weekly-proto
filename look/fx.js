// 이번 주 프로토타입 — 룩 공유 케이스(효과). 브라우저 전역 Fx. 규칙에는 손대지 않는다 — 그리기만 돕는다.
//   스프라이트: 아트 2px = 논리 1px (도트 · 정수배 캔버스에서 아트 1px = 화면 3px). 회전은 미리 32방향으로 최근접 재표본해 도트가 흐려지지 않는다.
//   파티클·링·흔들림·등불 빛: 게임 상태 밖의 순수 장식. 결정론이 필요한 자기시험은 rules.js 만 본다.
const Fx = (() => {
  const ART = 2;                                   // 논리 1px 당 아트 px

  /** {이름: 경로} → Promise<{이름: Image}>. 하나라도 실패하면 그 이름은 null (도형 대체로 그린다). */
  function load(map) {
    const names = Object.keys(map);
    return Promise.all(names.map(n => new Promise(res => {
      const im = new Image();
      im.onload = () => res(im); im.onerror = () => res(null);
      im.src = map[n];
    }))).then(list => Object.fromEntries(names.map((n, i) => [n, list[i]])));
  }

  /** 이미지를 n 방향으로 미리 돌려 둔다(최근접 · 아트 해상도). frames[k] 는 각도 k·2π/n. */
  function rotations(img, n = 32) {
    if (!img) return null;
    const s = Math.max(img.width, img.height), D = Math.ceil(s * 1.42 / 2) * 2;
    const src = document.createElement('canvas'); src.width = D; src.height = D;
    const sc = src.getContext('2d'); sc.imageSmoothingEnabled = false;
    sc.drawImage(img, (D - img.width) / 2, (D - img.height) / 2);
    let sd;
    try { sd = sc.getImageData(0, 0, D, D).data; }
    catch { return { img, live: true, n, D, w: D / ART }; }   // file:// 로 열면 그림이 다른 출처라 픽셀을 못 읽는다 → 매 프레임 회전으로(Pages 에서는 미리 돌린 프레임)
    const frames = [];
    for (let k = 0; k < n; k++) {
      const a = k * 2 * Math.PI / n, ca = Math.cos(-a), sa = Math.sin(-a);
      const c = document.createElement('canvas'); c.width = D; c.height = D;
      const cx = c.getContext('2d'), out = cx.createImageData(D, D), od = out.data, h = (D - 1) / 2;
      for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
        const dx = x - h, dy = y - h;
        const sx = Math.round(dx * ca - dy * sa + h), sy = Math.round(dx * sa + dy * ca + h);
        if (sx < 0 || sy < 0 || sx >= D || sy >= D) continue;
        const si = (sy * D + sx) * 4, oi = (y * D + x) * 4;
        od[oi] = sd[si]; od[oi + 1] = sd[si + 1]; od[oi + 2] = sd[si + 2]; od[oi + 3] = sd[si + 3];
      }
      cx.putImageData(out, 0, 0); frames.push(c);
    }
    return { frames, n, D, w: D / ART };
  }

  /** 회전 프레임을 논리 좌표 (x,y) 가운데에, 각도 ang 으로. 크기는 아트/2 — 정수 좌표에 맞춰 도트가 떨린다 싶으면 round. */
  function sprite(ctx, rot, x, y, ang = 0, scale = 1) {
    if (!rot) return false;
    let k = Math.round(ang / (2 * Math.PI) * rot.n) % rot.n; if (k < 0) k += rot.n;
    const w = rot.w * scale;
    if (rot.live) {
      const iw = rot.img.width / ART * scale, ih = rot.img.height / ART * scale;
      ctx.save(); ctx.translate(Math.round(x * ART) / ART, Math.round(y * ART) / ART); ctx.rotate(k * 2 * Math.PI / rot.n);
      ctx.drawImage(rot.img, -iw / 2, -ih / 2, iw, ih); ctx.restore(); return true;
    }
    ctx.drawImage(rot.frames[k], Math.round((x - w / 2) * ART) / ART, Math.round((y - w / 2) * ART) / ART, w, w);
    return true;
  }

  /** 회전 없는 스프라이트(바닥·타일). */
  function image(ctx, img, x, y, w, h) { if (!img) return false; ctx.drawImage(img, x, y, w, h); return true; }

  // ── 파티클 ──────────────────────────────────────────────────────
  const parts = [], rings = [], flashes = [];
  /** 터짐: n 개가 (x,y) 에서 사방으로. */
  function burst(x, y, color, n = 10, speed = 60, life = 0.45, size = 1.5, ang = null, spread = Math.PI * 2) {
    for (let i = 0; i < n; i++) {
      const a = ang == null ? Math.random() * Math.PI * 2 : ang + (Math.random() - 0.5) * spread;
      const v = speed * (0.4 + Math.random() * 0.8);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, t: life * (0.6 + Math.random() * 0.4), color, size, drag: 3 });
    }
  }
  /** 한 알: 방향·속도 지정(끌림·엔진 불꽃). */
  function mote(x, y, vx, vy, color, life = 0.3, size = 1, drag = 0) { parts.push({ x, y, vx, vy, life, t: life, color, size, drag }); }
  function ring(x, y, r0, r1, color, life = 0.35, width = 1.5) { rings.push({ x, y, r0, r1, color, life, t: life, width }); }
  function flash(color, alpha = 0.5, life = 0.18) { flashes.push({ color, alpha, life, t: life }); }

  function update(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.t -= dt; if (p.t <= 0) { parts.splice(i, 1); continue; }
      const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = rings.length - 1; i >= 0; i--) { rings[i].t -= dt; if (rings[i].t <= 0) rings.splice(i, 1); }
    for (let i = flashes.length - 1; i >= 0; i--) { flashes[i].t -= dt; if (flashes[i].t <= 0) flashes.splice(i, 1); }
    shake.t = Math.max(0, shake.t - dt);
  }
  function draw(ctx) {
    for (const p of parts) {
      const u = p.t / p.life; ctx.globalAlpha = Math.min(1, u * 1.5); ctx.fillStyle = p.color;
      const s = Math.max(0.5, p.size * (0.5 + u * 0.5));
      ctx.fillRect(Math.round(p.x * ART) / ART - s / 2, Math.round(p.y * ART) / ART - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    for (const r of rings) {
      const u = 1 - r.t / r.life; ctx.globalAlpha = 1 - u; ctx.strokeStyle = r.color; ctx.lineWidth = r.width;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * u, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function drawFlash(ctx, w, h) {
    for (const f of flashes) { ctx.globalAlpha = f.alpha * (f.t / f.life); ctx.fillStyle = f.color; ctx.fillRect(0, 0, w, h); }
    ctx.globalAlpha = 1;
  }

  // ── 흔들림 · 빛 ─────────────────────────────────────────────────
  const shake = { t: 0, life: 0, amp: 0 };
  function kick(amp = 2, life = 0.25) { shake.amp = Math.max(shake.amp * (shake.t / (shake.life || 1)), amp); shake.life = life; shake.t = life; }
  function offset() {
    if (shake.t <= 0) return [0, 0];
    const a = shake.amp * (shake.t / shake.life);
    return [Math.round((Math.random() - 0.5) * 2 * a * ART) / ART, Math.round((Math.random() - 0.5) * 2 * a * ART) / ART];
  }
  /** 등불 빛 — 가운데가 밝은 원. rgb 는 [r,g,b]. */
  function glow(ctx, x, y, r, rgb, alpha = 0.25) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`); g.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

  return { ART, load, rotations, sprite, image, burst, mote, ring, flash, update, draw, drawFlash, kick, offset, glow, hex, parts };
})();
if (typeof window !== 'undefined') window.Fx = Fx;
