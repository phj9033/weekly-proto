import { createState, step } from './rules.mjs';
const W = 180, H = 120;                       // 논리 해상도. 정수배로 키운다
const { ctx, scale } = Look.pixelCanvas(document.getElementById('game'), W, H);
const hud = document.getElementById('hud');
let state = createState();
const keys = new Set();
addEventListener('keydown', e => { keys.add(e.key); if (e.key === 'r' || e.key === 'R') state = createState(); });
addEventListener('keyup', e => keys.delete(e.key));
function frame() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.imageSmoothingEnabled = false;   // 컨텍스트 유실·복구 대비 — 매 프레임 배율을 다시 건다
  state = step(state, { left: keys.has('ArrowLeft'), right: keys.has('ArrowRight'), act: keys.has(' ') }, 1 / 60);
  Look.trail(ctx, W, H, 0.4);
  ctx.fillStyle = Look.colors.amber; ctx.fillRect(Math.round(state.x), Math.round(state.y), 6, 6);
  hud.textContent = state.over ? 'OVER' : `T ${state.t.toFixed(1)}`;
  hud.classList.toggle('fail', state.over);
  requestAnimationFrame(frame);
}
frame();
