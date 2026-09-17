import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { createState, step } = new Function(`${readFileSync(new URL('../rules.js', import.meta.url), 'utf8')}; return Rules;`)();

test('시작 상태', () => { const s = createState(); assert.equal(s.over, false); assert.equal(s.t, 0); });
test('오른쪽 입력이면 x 가 는다', () => { assert.ok(step(createState(), { right: true }, 0.1).x > 87); });
test('왼쪽 입력이면 x 가 준다', () => { assert.ok(step(createState(), { left: true }, 0.1).x < 87); });
test('벽을 넘지 않는다', () => { let s = createState(); for (let i = 0; i < 100; i++) s = step(s, { right: true }, 0.1); assert.equal(s.x, 174); });
test('over 면 상태가 멈춘다', () => { const s = { ...createState(), over: true }; assert.deepEqual(step(s, { right: true }, 0.1), s); });
