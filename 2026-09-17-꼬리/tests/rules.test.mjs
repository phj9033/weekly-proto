import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// 일반 스크립트를 노드에서 평가한다(file:// 지원을 위해 모듈이 아니다)
const TailRules = new Function(`${readFileSync(new URL('../rules.js', import.meta.url), 'utf8')}; return TailRules;`)();
const { createState, step, fire, detach, spawnEnemy, waveParams, hitsObstacle, CAPTURE_S, ROUND_S, HEAD_SPEED, W, H } = TailRules;

const NONE = {};
const run = (s, input, secs, dt = 1 / 60) => { for (let i = 0; i < Math.round(secs / dt); i++) step(s, input, dt); return s; };
/** 머리 바로 앞(위쪽)에 적 하나를 둔 판. 등장은 멀리 미룬다. */
function arena(kind = 'fast') {
  const s = createState(7); s.nextSpawn = 1e9;
  const e = { id: 99, kind, hp: kind === 'big' ? 3 : 1, fireCd: 1e9, vx: 0, vy: 0, x: s.head.x, y: s.head.y - 45 };   // 빔 사거리 60 안 · 다가와도 0.8~1.5초 안엔 머리에 닿지 않는다
  s.enemies.push(e); return { s, e };
}

test('같은 시드는 같은 등장 순서를 만든다', () => {
  const a = createState(3), b = createState(3);
  for (let i = 0; i < 5; i++) { spawnEnemy(a, 'fast'); spawnEnemy(b, 'fast'); }
  assert.deepEqual(a.enemies.map(e => [e.x, e.y]), b.enemies.map(e => [e.x, e.y]));
});

test('Z 를 0.8초 누르면 빠른 적이 마디가 된다 · 적은 사라진다', () => {
  const { s, e } = arena('fast');
  run(s, { beam: true }, CAPTURE_S.fast + 0.05);
  assert.equal(s.tail.length, 1); assert.ok(!s.enemies.includes(e));
  assert.equal(s.log.filter(l => l.ev === 'capture').length, 1);
});

test('큰 적은 1.5초 · 마디 체력 2', () => {
  const { s } = arena('big');
  run(s, { beam: true }, 1.0); assert.equal(s.tail.length, 0, '1초는 부족');
  run(s, { beam: true }, 0.6); assert.equal(s.tail.length, 1); assert.equal(s.tail[0].hp, 2);
});

test('손을 떼면 게이지가 0 으로 돌아간다', () => {
  const { s } = arena('fast');
  run(s, { beam: true }, 0.5); assert.ok(s.beam.gauge > 0.4);
  step(s, NONE, 1 / 60); assert.equal(s.beam.gauge, 0); assert.equal(s.tail.length, 0);
});

test('Z 를 누르는 동안 이동이 절반', () => {
  const a = createState(1), b = createState(1); a.nextSpawn = b.nextSpawn = 1e9;
  run(a, { right: true }, 0.5); run(b, { right: true, beam: true }, 0.5);
  const da = a.head.x - W / 2, db = b.head.x - W / 2;
  assert.ok(Math.abs(da - HEAD_SPEED * 0.5) < 2); assert.ok(Math.abs(db - HEAD_SPEED * 0.25) < 2);
});

test('X 한 번 = 머리 1발 + 마디 수만큼 옆 1발', () => {
  const { s } = arena('fast'); run(s, { beam: true }, 0.9);
  const { s: s2 } = arena('fast'); run(s2, { beam: true }, 0.9);
  s.enemies.length = 0; s.fireCd = 0; assert.equal(fire(s), 2);
  s2.tail.push({ x: 0, y: 0, hp: 1, kind: 'fast', stuck: 0 }); s2.fireCd = 0; assert.equal(fire(s2), 3);
  assert.equal(s2.bullets.length, 3);
});

test('적탄이 마디에 맞으면 마디만 사라지고 머리는 산다', () => {
  const s = createState(1); s.nextSpawn = 1e9;
  s.tail.push({ x: s.head.x, y: s.head.y + 8, hp: 1, kind: 'fast', stuck: 0 });
  s.ebullets.push({ x: s.head.x, y: s.head.y + 8, vx: 0, vy: 0 });
  step(s, NONE, 1 / 60);
  assert.equal(s.tail.length, 0); assert.equal(s.over, false);
});

test('적탄이 머리에 맞으면 끝 · 점수 = 처치 + 꼬리×5', () => {
  const s = createState(1); s.nextSpawn = 1e9; s.kills = 3;
  s.tail.push({ x: s.head.x - 30, y: s.head.y, hp: 1, kind: 'fast', stuck: 0 });
  s.ebullets.push({ x: s.head.x, y: s.head.y, vx: 0, vy: 0 });
  step(s, NONE, 1 / 60);
  assert.equal(s.over, true); assert.equal(s.score, 3 + 5);
});

test('C 는 끝 마디를 중립 표류체로 돌린다 · 중립은 다시 붙잡을 수 있다', () => {
  const s = createState(1); s.nextSpawn = 1e9;
  s.tail.push({ x: s.head.x, y: s.head.y + 8, hp: 1, kind: 'fast', stuck: 0 });
  s.tail.push({ x: s.head.x, y: s.head.y + 16, hp: 1, kind: 'fast', stuck: 0 });
  const n = detach(s);
  assert.equal(s.tail.length, 1); assert.equal(n.kind, 'neutral'); assert.ok(s.enemies.includes(n));
  // 중립은 나를 쏘지 않고 머리에 닿아도 끝나지 않는다
  n.x = s.head.x; n.y = s.head.y; step(s, NONE, 1 / 60); assert.equal(s.over, false);
});

test('90초가 지나면 판이 끝난다(생존)', () => {
  const s = createState(5); s.nextSpawn = 1e9;
  run(s, NONE, ROUND_S + 0.1, 0.1);
  assert.equal(s.over, true); assert.equal(s.ended, true); assert.equal(s.log.at(-1).why, 'time');
});

test('파도: 30초마다 등장 간격이 줄고 60초부터 큰 적', () => {
  assert.ok(waveParams(0).interval > waveParams(35).interval && waveParams(35).interval > waveParams(65).interval);
  assert.equal(waveParams(59).bigChance, 0); assert.ok(waveParams(60).bigChance > 0);
});

test('장애물은 머리를 막는다', () => {
  const s = createState(1); s.nextSpawn = 1e9;
  s.head.x = 72; s.head.y = 100;          // 첫 장애물(60~84 × 30~82) 바로 아래
  run(s, { up: true }, 2);
  assert.ok(s.head.y >= 82, `y=${s.head.y}`); assert.ok(hitsObstacle(72, 60, 1));
});

test('벽에 걸린 마디는 떨어져 중립이 된다 (몸집의 대가)', () => {
  const s = createState(1); s.nextSpawn = 1e9;
  // 가로 막대 장애물(140~180 × 78~90) 을 사이에 두고 머리는 위, 마디는 아래. 머리가 위로 달아난다
  s.head.x = 160; s.head.y = 70; s.head.ang = -Math.PI / 2;
  s.tail.push({ x: 160, y: 96, hp: 1, kind: 'fast', stuck: 0 });
  run(s, { up: true }, 1.0);
  assert.equal(s.tail.length, 0); assert.ok(s.enemies.some(e => e.kind === 'neutral'));
  assert.ok(s.log.some(l => l.ev === 'torn'));
});

test('열린 곳에서는 마디가 간격을 되찾고 떨어지지 않는다', () => {
  const s = createState(1); s.nextSpawn = 1e9;
  s.head.x = 200; s.head.y = 150;
  s.tail.push({ x: 200, y: 158, hp: 1, kind: 'fast', stuck: 0 });
  run(s, { left: true }, 1.2);            // 왼쪽으로 84px 달린다
  assert.equal(s.tail.length, 1); assert.ok(Math.hypot(s.tail[0].x - s.head.x, s.tail[0].y - s.head.y) < 12);
});
