// 「꼬리」 — 그리기·입력만. 규칙은 rules.mjs. 룩은 ../look/look.js (전역 Look).
import { createState, step, W, H, HEAD_R, SEG_R, BEAM_RANGE, BEAM_HALF_ANGLE, CAPTURE_S, OBSTACLES, ROUND_S } from './rules.mjs';

const SEEDS = [20260917, 7, 42, 303, 1981, 555];   // R 은 다음 시드 · Enter 는 같은 시드
let seedIdx = 0;
const canvas = document.getElementById('game');
const { ctx } = Look.pixelCanvas(canvas, W, H, { maxWidth: innerWidth - 32, maxHeight: innerHeight - 96 });
const hud = document.getElementById('hud'), label = document.getElementById('label');
const C = Look.colors;
const BEST_KEY = 'weekly-proto-tail-best';
const best = () => { try { return Number(localStorage.getItem(BEST_KEY) || 0); } catch { return 0; } };
const saveBest = v => { try { if (v > best()) localStorage.setItem(BEST_KEY, String(v)); } catch { } };

let state = createState(SEEDS[seedIdx]);
let paused = false, lastTs = 0;
const keys = new Set();
const KEYMAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right', z: 'beam', Z: 'beam', x: 'fire', X: 'fire', c: 'detach', C: 'detach' };

addEventListener('keydown', e => {
  if (e.key in KEYMAP) { keys.add(KEYMAP[e.key]); e.preventDefault(); }
  if (e.key === 'Escape') paused = !paused;
  if (e.key === 'Enter' && state.over) { state = createState(state.seed); }
  if (e.key === 'r' || e.key === 'R') { seedIdx = (seedIdx + 1) % SEEDS.length; state = createState(SEEDS[seedIdx]); }
  if (e.key === 'l' || e.key === 'L') downloadLog();
});
addEventListener('keyup', e => { if (e.key in KEYMAP) keys.delete(KEYMAP[e.key]); });
addEventListener('blur', () => keys.clear());

function downloadLog() {
  const blob = new Blob([JSON.stringify({ seed: state.seed, log: state.log }, null, 0)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `tail-${state.seed}-${Date.now()}.json` });
  a.click();
}

function input() { const o = {}; for (const k of keys) o[k] = true; return o; }

function drawTri(x, y, ang, r, color) {
  ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(x + Math.cos(ang) * r * 1.4, y + Math.sin(ang) * r * 1.4);
  ctx.lineTo(x + Math.cos(ang + 2.4) * r, y + Math.sin(ang + 2.4) * r);
  ctx.lineTo(x + Math.cos(ang - 2.4) * r, y + Math.sin(ang - 2.4) * r);
  ctx.closePath(); ctx.fill();
}
function draw() {
  const s = state, h = s.head;
  Look.trail(ctx, W, H, 0.45, C.walnut);                    // 잔상
  // 장애물
  for (const o of OBSTACLES) { ctx.fillStyle = C.night; ctx.fillRect(o.x, o.y, o.w, o.h); ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.strokeRect(o.x + .5, o.y + .5, o.w - 1, o.h - 1); }
  // 빔
  if (s.beam.active && !s.over) {
    ctx.save(); ctx.globalAlpha = 0.22; ctx.fillStyle = C.amber; ctx.beginPath(); ctx.moveTo(h.x, h.y);
    ctx.arc(h.x, h.y, BEAM_RANGE, h.ang - BEAM_HALF_ANGLE, h.ang + BEAM_HALF_ANGLE); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // 꼬리 → 머리 (머리가 위에)
  s.tail.forEach((seg, i) => {
    ctx.fillStyle = seg.kind === 'big' ? C.brass : C.amber;
    const r = seg.kind === 'big' ? SEG_R + 1 : SEG_R;
    ctx.fillRect(Math.round(seg.x - r), Math.round(seg.y - r), r * 2, r * 2);
    if (seg.hp > 1) { ctx.fillStyle = C.cream; ctx.fillRect(Math.round(seg.x) - 1, Math.round(seg.y) - 1, 2, 2); }
  });
  drawTri(h.x, h.y, h.ang, HEAD_R + 1, C.cream);
  // 적
  for (const e of s.enemies) {
    if (e.kind === 'neutral') { ctx.fillStyle = C.brass; ctx.globalAlpha = .7; ctx.fillRect(Math.round(e.x - 3), Math.round(e.y - 3), 6, 6); ctx.globalAlpha = 1; }
    else if (e.kind === 'big') { ctx.fillStyle = C.rust; ctx.fillRect(Math.round(e.x - 6), Math.round(e.y - 6), 12, 12); ctx.fillStyle = C.ink; for (let i = 0; i < e.hp; i++) ctx.fillRect(Math.round(e.x) - 4 + i * 3, Math.round(e.y) - 1, 2, 2); }
    else drawTri(e.x, e.y, Math.atan2(h.y - e.y, h.x - e.x), 4, C.rust);
    if (s.beam.target === e) {                              // 게이지 링
      const p = Math.min(1, s.beam.gauge / CAPTURE_S[e.kind]);
      ctx.strokeStyle = C.amber; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, 9, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); ctx.stroke();
    }
  }
  // 탄
  ctx.fillStyle = C.cream; for (const b of s.bullets) ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 2, 2);
  ctx.fillStyle = C.rust; for (const b of s.ebullets) ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 3, 3);
  Look.vignette(ctx, W, H);
  // 끝 화면
  if (s.over) {
    ctx.save(); ctx.globalAlpha = .75; ctx.fillStyle = C.ink; ctx.fillRect(60, 56, 200, 68); ctx.restore();
    ctx.fillStyle = C.cream; ctx.font = '8px Galmuri11'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const why = s.log.at(-1)?.why;
    ctx.fillText(why === 'time' ? 'SURVIVED 90s' : (why === 'bullet' ? 'HEAD HIT · BULLET' : 'HEAD HIT · BODY'), W / 2, 64);
    ctx.fillStyle = C.amber; ctx.fillText(`SCORE ${s.score}  = ${s.kills} + ${s.log.at(-1)?.len ?? 0}x5`, W / 2, 80);
    ctx.fillStyle = C.brass; ctx.fillText(`BEST ${best()}   ENTER same seed   R next seed`, W / 2, 100);
    ctx.textAlign = 'left';
  }
  if (paused && !s.over) { ctx.fillStyle = C.cream; ctx.font = '8px Galmuri11'; ctx.textAlign = 'center'; ctx.fillText('PAUSED · ESC', W / 2, H / 2 - 4); ctx.textAlign = 'left'; }
  const left = Math.max(0, ROUND_S - s.t);
  hud.textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}  TAIL ${s.tail.length}  KILL ${s.kills}  SEED ${seedIdx + 1}/${SEEDS.length}`;
  hud.classList.toggle('fail', s.over && s.log.at(-1)?.why !== 'time');
}

function frame(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0); lastTs = ts;
  if (!paused) { const wasOver = state.over; step(state, input(), dt); if (!wasOver && state.over) saveBest(state.score); }
  draw(); requestAnimationFrame(frame);
}
label.textContent = '←→↑↓ 이동 · Z 누르고 있기 = 붙잡기(이동 절반) · X 부수기 · C 꼬리 끝 떼기 · ESC 멈춤 · L 판 로그 저장';
requestAnimationFrame(frame);
