import { createState, step } from './rules.mjs';
const W = 180, H = 120;                       // 논리 해상도. 정수배로 키운다
const { ctx, scale } = Look.pixelCanvas(document.getElementById('game'), W, H);
const hud = document.getElementById('hud');
let state = createState();
const keys = new Set();
// 물리 키 코드(e.code)로 읽는다 — 한글 입력 상태면 e.key 가 한글 자모로 들어온다
addEventListener('keydown', e => { keys.add(e.code); if (e.code === 'KeyR') state = createState(); });
addEventListener('keyup', e => keys.delete(e.code));
function frame() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.imageSmoothingEnabled = false;   // 컨텍스트 유실·복구 대비 — 매 프레임 배율을 다시 건다
  state = step(state, { left: keys.has('ArrowLeft'), right: keys.has('ArrowRight'), act: keys.has('Space') }, 1 / 60);
  Look.trail(ctx, W, H, 0.4);
  ctx.fillStyle = Look.colors.amber; ctx.fillRect(Math.round(state.x), Math.round(state.y), 6, 6);
  hud.textContent = state.over ? 'OVER' : `T ${state.t.toFixed(1)}`;
  hud.classList.toggle('fail', state.over);
  requestAnimationFrame(frame);
}
frame();
