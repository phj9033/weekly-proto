// 규칙만. DOM 없음 — node --test 로 자기시험한다.
export function createState() { return { x: 87, y: 100, t: 0, over: false }; }
export function step(s, input, dt) {
  if (s.over) return s;
  const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const x = Math.min(174, Math.max(0, s.x + dx * 60 * dt));
  return { ...s, x, t: s.t + dt };
}
