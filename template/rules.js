// 규칙만. DOM 없음. 일반 스크립트(전역 Rules) — file:// 로 열어도 돌아야 해서 ES 모듈을 쓰지 않는다. node --test 는 파일을 읽어 평가한다.
function createState() { return { x: 87, y: 100, t: 0, over: false }; }
function step(s, input, dt) {
  if (s.over) return s;
  const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const x = Math.min(174, Math.max(0, s.x + dx * 60 * dt));
  return { ...s, x, t: s.t + dt };
}
const Rules = { createState, step };
if (typeof globalThis !== 'undefined') globalThis.Rules = Rules;
