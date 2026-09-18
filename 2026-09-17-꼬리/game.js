// 「꼬리」 — 그리기·입력만. 규칙은 rules.js(손대지 않았다 · 기획 1등 그대로). 룩은 ../look/look.js(Look) · 효과는 ../look/fx.js(Fx).
// 2판(2026-09-18): 도형 → 도트 스프라이트(assets/ · Unity AI 로 뽑은 시트를 잘라 채널 팔레트로 양자화) + 등불 빛·파티클·흔들림.
//   아트 밀도는 어디서나 논리 1px = 아트 2px. 캔버스는 정수배(6배 = 1920×1080)라 아트 1px 가 화면 3px 로 깨끗히 선다.
(() => {   // 일반 스크립트끼리 전역 이름이 겹치지 않게 함수 스코프로 감싼다
const { createState, step, W, H, HEAD_R, SEG_R, BEAM_RANGE, BEAM_HALF_ANGLE, CAPTURE_S, OBSTACLES, ROUND_S } = TailRules;   // rules.js 가 먼저 로드된다(일반 스크립트)

const SEEDS = [20260917, 7, 42, 303, 1981, 555];   // R 은 다음 시드 · Enter 는 같은 시드
let seedIdx = 0;
const canvas = document.getElementById('game');
const { ctx, scale } = Look.pixelCanvas(canvas, W, H, { maxWidth: innerWidth - 32, maxHeight: innerHeight - 96 });
const hud = document.getElementById('hud'), label = document.getElementById('label');
const C = Look.colors;
const RGB = { amber: Fx.hex(C.amber), rust: Fx.hex(C.rust), cream: Fx.hex(C.cream), brass: Fx.hex(C.brass) };
const VIS = { player: 1.25, pod: 1.2, pod_big: 1.15, pod_dim: 1.1, enemy_fast: 1.3, enemy_big: 1.2, bolt: 1.0, pellet: 1.1 };   // 시각 배율 — 판정(rules.js)은 그대로다. 관대한 쪽(그림 > 판정)
const BEST_KEY = 'weekly-proto-tail-best';
const best = () => { try { return Number(localStorage.getItem(BEST_KEY) || 0); } catch { return 0; } };
const saveBest = v => { try { if (v > best()) localStorage.setItem(BEST_KEY, String(v)); } catch { } };

let state = createState(SEEDS[seedIdx]);
let paused = false, lastTs = 0, clock = 0;
const keys = new Set();
// 물리 키 코드로 읽는다 — 한글 입력 상태면 e.key 가 ㅋ·ㅌ·ㅊ 로 들어와 Z·X·C 가 죽는다 [실측 2026-09-17]
const KEYMAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right', KeyZ: 'beam', KeyX: 'fire', KeyC: 'detach' };
let started = false;                                   // 첫 키 전엔 판이 돌지 않는다(READY)

addEventListener('keydown', e => {
  if (e.code in KEYMAP) { keys.add(KEYMAP[e.code]); e.preventDefault(); started = true; }
  if (e.code === 'Escape') paused = !paused;
  if (e.code === 'Enter' && state.over) { reset(state.seed); }
  if (e.code === 'KeyR') { seedIdx = (seedIdx + 1) % SEEDS.length; reset(SEEDS[seedIdx]); }
  if (e.code === 'KeyL') downloadLog();
});
addEventListener('keyup', e => { if (e.code in KEYMAP) keys.delete(KEYMAP[e.code]); });
canvas.addEventListener('pointerdown', () => { canvas.focus(); });
addEventListener('blur', () => keys.clear());

function reset(seed) { state = createState(seed); started = false; snap = snapshot(state); Fx.parts.length = 0; }

function downloadLog() {
  const blob = new Blob([JSON.stringify({ seed: state.seed, log: state.log }, null, 0)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `tail-${state.seed}-${Date.now()}.json` });
  a.click();
}

function input() { const o = {}; for (const k of keys) o[k] = true; return o; }

// ── 스프라이트 ────────────────────────────────────────────────────
// 시트 → assets/ (channels/…/롱폼05/proto/cut_sheets.py). 없으면 도형으로 그린다(처음 로드 몇 ms · 파일이 빠진 경우).
const SPR = {};   // 이름 → 회전 프레임 묶음
let arena = null; // 바닥 + 벽을 미리 그린 층(아트 해상도 640×360)
Fx.load({ player: 'assets/player.png', pod: 'assets/pod.png', pod_big: 'assets/pod_big.png', pod_dim: 'assets/pod_dim.png',
          enemy_fast: 'assets/enemy_fast.png', enemy_big: 'assets/enemy_big.png', bolt: 'assets/bolt.png', pellet: 'assets/pellet.png', floor: 'assets/floor.png' })
  .then(im => { for (const k of ['player', 'pod', 'pod_big', 'pod_dim', 'enemy_fast', 'enemy_big', 'bolt', 'pellet']) SPR[k] = Fx.rotations(im[k], 32); arena = buildArena(im.floor); });

/** 바닥 그림 + 벽(호두나무 블록 · 황동 모서리 · 잉크 외곽 · 그림자)을 아트 해상도로 한 번 그린다. */
function buildArena(floor) {
  const A = Fx.ART, c = document.createElement('canvas'); c.width = W * A; c.height = H * A;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = C.night; g.fillRect(0, 0, c.width, c.height);
  if (floor) g.drawImage(floor, 0, 0, c.width, c.height);
  // 아레나 테두리 — 잉크 한 겹 + 안쪽 황동 실선
  g.fillStyle = C.ink; g.fillRect(0, 0, c.width, A); g.fillRect(0, c.height - A, c.width, A); g.fillRect(0, 0, A, c.height); g.fillRect(c.width - A, 0, A, c.height);
  for (const o of OBSTACLES) {
    const x = o.x * A, y = o.y * A, w = o.w * A, h = o.h * A;
    g.globalAlpha = .45; g.fillStyle = C.ink; g.fillRect(x + 4, y + 4, w, h); g.globalAlpha = 1;           // 그림자(오른쪽 아래)
    g.fillStyle = C.ink; g.fillRect(x, y, w, h);                                                              // 잉크 외곽
    g.fillStyle = C.walnut; g.fillRect(x + 2, y + 2, w - 4, h - 4);                                           // 몸
    g.fillStyle = '#3A2A1E'; g.fillRect(x + 4, y + 4, w - 8, h - 8);                                          // 밝은 면
    g.fillStyle = C.brass; g.fillRect(x + 2, y + 2, w - 4, 2); g.fillRect(x + 2, y + 2, 2, h - 4);            // 등불 쪽(좌상단) 하이라이트
    g.fillStyle = '#100C1E'; g.fillRect(x + 2, y + h - 4, w - 4, 2); g.fillRect(x + w - 4, y + 2, 2, h - 4);  // 그늘 쪽
    g.fillStyle = C.brass;                                                                                     // 리벳 넷
    for (const [rx, ry] of [[x + 6, y + 6], [x + w - 8, y + 6], [x + 6, y + h - 8], [x + w - 8, y + h - 8]]) g.fillRect(rx, ry, 2, 2);
    // 판 무늬 — 가로 이음선
    g.fillStyle = C.ink; g.globalAlpha = .35;
    for (let yy = y + 14; yy < y + h - 8; yy += 14) g.fillRect(x + 6, yy, w - 12, 1);
    g.globalAlpha = 1;
  }
  return c;
}

// ── 사건 감지(상태 차이) → 효과. 규칙은 로그를 남기고, 여기서는 그 차이만 읽는다 ────────────────
let snap = snapshot(state);
function snapshot(s) {
  return { enemies: new Map(s.enemies.map(e => [e, { x: e.x, y: e.y, kind: e.kind }])), tail: s.tail.map(t => ({ ref: t, x: t.x, y: t.y, kind: t.kind })),
           bullets: new Map(s.bullets.map(b => [b, { x: b.x, y: b.y }])), ebullets: new Map(s.ebullets.map(b => [b, { x: b.x, y: b.y }])), over: s.over, logN: s.log.length };
}
const inside = (p, m = 2) => p.x > m && p.x < W - m && p.y > m && p.y < H - m;
function effects(s, prev) {
  const captured = new Set(s.log.slice(prev.logN).filter(l => l.ev === 'capture').map(l => `${l.x},${l.y}`));
  for (const [e, p] of prev.enemies) {                       // 사라진 적: 붙잡혔거나 부서졌거나 마디에 닿았다
    if (s.enemies.includes(e)) continue;
    if (captured.has(`${Math.round(p.x)},${Math.round(p.y)}`)) {
      Fx.ring(p.x, p.y, 4, 16, C.amber, 0.35, 1.5); Fx.burst(p.x, p.y, C.amber, 10, 50, 0.4, 1.5); Fx.kick(0.8, 0.15);
    } else if (p.kind !== 'neutral' || inside(p, -4)) {
      const big = p.kind === 'big';
      Fx.burst(p.x, p.y, C.rust, big ? 22 : 10, big ? 80 : 60, 0.45, big ? 2 : 1.5);
      Fx.burst(p.x, p.y, C.cream, big ? 6 : 3, 40, 0.3, 1);
      Fx.ring(p.x, p.y, 3, big ? 20 : 12, C.rust, 0.3, 1.5);
      if (big) Fx.kick(1.2, 0.2);
    }
  }
  for (const t of prev.tail) {                                // 사라진 마디: 대신 맞았거나(적탄·적 몸) 벽에 걸려 떨어졋거나(C 도 여기)
    if (s.tail.includes(t.ref)) continue;
    const torn = s.enemies.some(e => e.kind === 'neutral' && Math.abs(e.x - t.x) < 1 && Math.abs(e.y - t.y) < 1);
    Fx.burst(t.x, t.y, torn ? C.brass : C.amber, torn ? 6 : 12, torn ? 25 : 70, 0.4, 1.5);
    Fx.ring(t.x, t.y, 3, torn ? 10 : 14, torn ? C.brass : C.cream, 0.3, 1.5);
    if (!torn) Fx.kick(1.0, 0.18);
  }
  for (const b of s.bullets) if (!prev.bullets.has(b)) Fx.burst(b.x, b.y, C.cream, 3, 30, 0.12, 1, Math.atan2(b.vy, b.vx), 0.8);   // 총구 불꽃
  for (const [b, p] of prev.bullets) if (!s.bullets.includes(b) && inside(p)) Fx.burst(p.x, p.y, C.cream, 4, 40, 0.2, 1);
  for (const [b, p] of prev.ebullets) if (!s.ebullets.includes(b) && inside(p)) Fx.burst(p.x, p.y, C.rust, 4, 35, 0.2, 1);
  if (s.over && !prev.over) {
    const h = s.head, why = s.log.at(-1)?.why;
    if (why === 'time') { Fx.ring(h.x, h.y, 6, 60, C.amber, 0.8, 2); Fx.burst(h.x, h.y, C.amber, 30, 60, 0.9, 1.5); Fx.flash(C.amber, 0.25, 0.4); }
    else { Fx.burst(h.x, h.y, C.cream, 30, 110, 0.7, 2); Fx.burst(h.x, h.y, C.rust, 20, 70, 0.6, 1.5); Fx.ring(h.x, h.y, 4, 40, C.cream, 0.5, 2); Fx.kick(4, 0.5); Fx.flash(C.rust, 0.35, 0.3); }
  }
}

// ── 그리기 ────────────────────────────────────────────────────────
function drawTri(x, y, ang, r, color) {                      // 스프라이트가 없을 때의 대체 도형
  ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(x + Math.cos(ang) * r * 1.4, y + Math.sin(ang) * r * 1.4);
  ctx.lineTo(x + Math.cos(ang + 2.4) * r, y + Math.sin(ang + 2.4) * r);
  ctx.lineTo(x + Math.cos(ang - 2.4) * r, y + Math.sin(ang - 2.4) * r);
  ctx.closePath(); ctx.fill();
}
function draw() {
  const s = state, h = s.head, [ox, oy] = Fx.offset();
  ctx.setTransform(scale, 0, 0, scale, ox * scale, oy * scale); ctx.imageSmoothingEnabled = false;   // 컨텍스트가 유실·복구되면 변환이 초기화된다 — 매 프레임 다시 건다
  // 바닥 + 벽
  if (arena) ctx.drawImage(arena, 0, 0, W, H);
  else { ctx.fillStyle = C.night; ctx.fillRect(0, 0, W, H); for (const o of OBSTACLES) { ctx.fillStyle = C.walnut; ctx.fillRect(o.x, o.y, o.w, o.h); } }
  // 등불 빛 — 머리(붙잡는 동안 더 밝다) · 마디 · 적은 붉게 희미하게
  const beaming = s.beam.active && !s.over;
  if (!s.over) Fx.glow(ctx, h.x, h.y, beaming ? 46 : 36, RGB.amber, beaming ? 0.30 : 0.20);
  for (const seg of s.tail) Fx.glow(ctx, seg.x, seg.y, 14, RGB.amber, 0.16);
  for (const e of s.enemies) if (e.kind !== 'neutral') Fx.glow(ctx, e.x, e.y, e.kind === 'big' ? 18 : 12, RGB.rust, 0.14);
  // 빔 — 부채꼴 안쪽이 밝고 바깥으로 사라진다 · 안쪽으로 흐르는 호 셋(끌어당김)
  if (beaming) {
    ctx.save(); ctx.beginPath(); ctx.moveTo(h.x, h.y);
    ctx.arc(h.x, h.y, BEAM_RANGE, h.ang - BEAM_HALF_ANGLE, h.ang + BEAM_HALF_ANGLE); ctx.closePath(); ctx.clip();
    const g = ctx.createRadialGradient(h.x, h.y, 2, h.x, h.y, BEAM_RANGE);
    g.addColorStop(0, 'rgba(230,180,34,.38)'); g.addColorStop(1, 'rgba(230,180,34,.04)');
    ctx.fillStyle = g; ctx.fillRect(h.x - BEAM_RANGE, h.y - BEAM_RANGE, BEAM_RANGE * 2, BEAM_RANGE * 2);
    ctx.strokeStyle = C.amber; ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const r = BEAM_RANGE - ((clock * 45 + i * BEAM_RANGE / 3) % BEAM_RANGE);
      ctx.globalAlpha = 0.15 + 0.35 * (r / BEAM_RANGE);
      ctx.beginPath(); ctx.arc(h.x, h.y, r, h.ang - BEAM_HALF_ANGLE, h.ang + BEAM_HALF_ANGLE); ctx.stroke();
    }
    ctx.restore();
    const t = s.beam.target;
    if (t) {                                                  // 목표에서 머리로 빨려 오는 알갱이
      const d = Math.hypot(h.x - t.x, h.y - t.y) || 1;
      for (let i = 0; i < 2; i++) { const j = (Math.random() - .5) * 8; Fx.mote(t.x + j, t.y + (Math.random() - .5) * 8, (h.x - t.x) / d * 90, (h.y - t.y) / d * 90, C.amber, d / 90, 1); }
    }
  }
  // 꼬리 — 마디 사이 사슬(황동 실선) → 마디 → 머리 (머리가 위에)
  if (s.tail.length && !s.over) {
    ctx.strokeStyle = C.brass; ctx.lineWidth = 1.5; ctx.globalAlpha = .7; ctx.beginPath(); ctx.moveTo(h.x, h.y);
    for (const seg of s.tail) ctx.lineTo(seg.x, seg.y);
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  s.tail.forEach((seg, i) => {
    const bob = Math.sin(clock * 6 + i * 0.9) * 0.35;
    const ok = Fx.sprite(ctx, SPR[seg.kind === 'big' ? 'pod_big' : 'pod'], seg.x, seg.y + bob, clock * 0.8 + i, seg.kind === 'big' ? VIS.pod_big : VIS.pod);
    if (!ok) { ctx.fillStyle = seg.kind === 'big' ? C.brass : C.amber; const r = seg.kind === 'big' ? SEG_R + 1 : SEG_R; ctx.fillRect(Math.round(seg.x - r), Math.round(seg.y - r), r * 2, r * 2); }
    if (seg.hp > 1) { ctx.fillStyle = C.cream; ctx.fillRect(Math.round(seg.x) - 2, Math.round(seg.y) + 6, 1.5, 1.5); ctx.fillRect(Math.round(seg.x) + 1, Math.round(seg.y) + 6, 1.5, 1.5); }
  });
  if (!s.over) {
    const moving = ['up', 'down', 'left', 'right'].some(k => keys.has(k));
    if (moving && started && !paused) Fx.mote(h.x - Math.cos(h.ang) * 5, h.y - Math.sin(h.ang) * 5, -Math.cos(h.ang) * 30 + (Math.random() - .5) * 10, -Math.sin(h.ang) * 30 + (Math.random() - .5) * 10, C.amber, 0.25, 1, 2);
    if (!Fx.sprite(ctx, SPR.player, h.x, h.y, h.ang, VIS.player)) drawTri(h.x, h.y, h.ang, HEAD_R + 1, C.cream);
  }
  // 적
  for (const e of s.enemies) {
    if (e.kind === 'neutral') {
      if (!Fx.sprite(ctx, SPR.pod_dim, e.x, e.y, clock * 0.6 + e.id, VIS.pod_dim)) { ctx.fillStyle = C.brass; ctx.globalAlpha = .7; ctx.fillRect(Math.round(e.x - 3), Math.round(e.y - 3), 6, 6); ctx.globalAlpha = 1; }
    } else {
      const face = Math.atan2(h.y - e.y, h.x - e.x);
      if (e.kind === 'big') {
        if (!Fx.sprite(ctx, SPR.enemy_big, e.x, e.y + Math.sin(clock * 3 + e.id) * 0.4, face, VIS.enemy_big)) { ctx.fillStyle = C.rust; ctx.fillRect(Math.round(e.x - 6), Math.round(e.y - 6), 12, 12); }
        ctx.fillStyle = C.rust; for (let i = 0; i < e.hp; i++) ctx.fillRect(Math.round(e.x) - 4 + i * 3, Math.round(e.y) + 9, 2, 1.5);   // 남은 체력 눈금
      } else if (!Fx.sprite(ctx, SPR.enemy_fast, e.x, e.y, face, VIS.enemy_fast)) drawTri(e.x, e.y, face, 4, C.rust);
    }
    if (s.beam.target === e) {                              // 게이지 링 — 안쪽 희미한 원 + 차오르는 호박 호
      const p = Math.min(1, s.beam.gauge / CAPTURE_S[e.kind]), r = e.kind === 'big' ? 11 : 9;
      ctx.strokeStyle = 'rgba(240,231,216,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = C.amber; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); ctx.stroke();
      if (p > 0.85) Fx.glow(ctx, e.x, e.y, 16, RGB.amber, 0.25 * (p - 0.85) / 0.15);
    }
  }
  // 탄 — 내 것은 빛줄기(진행 방향), 적 것은 붉은 알
  for (const b of s.bullets) { const a = Math.atan2(b.vy, b.vx); if (!Fx.sprite(ctx, SPR.bolt, b.x, b.y, a)) { ctx.fillStyle = C.cream; ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 2, 2); } }
  for (const b of s.ebullets) { Fx.glow(ctx, b.x, b.y, 5, RGB.rust, 0.35); if (!Fx.sprite(ctx, SPR.pellet, b.x, b.y, clock * 4, VIS.pellet)) { ctx.fillStyle = C.rust; ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 3, 3); } }
  Fx.draw(ctx);
  Look.vignette(ctx, W, H);
  Fx.drawFlash(ctx, W, H);
  // 끝 화면 — 잉크 판 · 황동 테
  if (s.over) {
    ctx.save(); ctx.globalAlpha = .82; ctx.fillStyle = C.ink; ctx.fillRect(58, 54, 204, 72); ctx.restore();
    ctx.strokeStyle = C.brass; ctx.lineWidth = 1; ctx.strokeRect(60.5, 56.5, 199, 67);
    ctx.fillStyle = C.cream; ctx.font = '8px Galmuri11'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const why = s.log.at(-1)?.why;
    ctx.fillText(why === 'time' ? 'SURVIVED 90s' : (why === 'bullet' ? 'HEAD HIT · BULLET' : 'HEAD HIT · BODY'), W / 2, 64);
    ctx.fillStyle = C.amber; ctx.fillText(`SCORE ${s.score}  = ${s.kills} + ${s.log.at(-1)?.len ?? 0}x5`, W / 2, 80);
    ctx.fillStyle = C.brass; ctx.fillText(`BEST ${best()}   ENTER same seed   R next seed`, W / 2, 100);
    ctx.textAlign = 'left';
  }
  if (!started && !s.over) { ctx.fillStyle = C.cream; ctx.font = '8px Galmuri11'; ctx.textAlign = 'center'; ctx.fillText('READY · PRESS ANY KEY', W / 2, H / 2 - 4); ctx.textAlign = 'left'; }
  if (paused && !s.over) { ctx.fillStyle = C.cream; ctx.font = '8px Galmuri11'; ctx.textAlign = 'center'; ctx.fillText('PAUSED · ESC', W / 2, H / 2 - 4); ctx.textAlign = 'left'; }
  const left = Math.max(0, ROUND_S - s.t);
  hud.textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}  TAIL ${s.tail.length}  KILL ${s.kills}  SEED ${seedIdx + 1}/${SEEDS.length}`;
  hud.classList.toggle('fail', s.over && s.log.at(-1)?.why !== 'time');
}

function frame(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0); lastTs = ts; clock += dt;
  if (!paused && started) {
    const wasOver = state.over; step(state, input(), dt); if (!wasOver && state.over) saveBest(state.score);
    effects(state, snap); snap = snapshot(state);
  }
  Fx.update(dt);
  draw(); requestAnimationFrame(frame);
}
// 캡처·자기시험용 읽기 전용 훅 — 게임 규칙에는 영향이 없다
window.__tail = { state: () => state, seedIdx: () => seedIdx, started: () => started, W, H };
label.textContent = '←→↑↓ 이동 · Z 누르고 있기 = 붙잡기(이동 절반) · X 부수기 · C 꼬리 끝 떼기 · ESC 멈춤 · L 판 로그 저장';
requestAnimationFrame(frame);
})();
