import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../look/look.js', import.meta.url), 'utf8');
// 브라우저 전역 스크립트를 노드에서 평가한다 — 파일 끝의 `window.Look = Look` 만 우회
const Look = new Function(`${src.replace(/if \(typeof window[^\n]*\n/, '')}; return Look;`)();

test('팔레트 7색이 채널 정본과 같다', () => {
  assert.deepEqual(Look.colors, {
    cream: '#F0E7D8', ink: '#0E0A08', amber: '#E6B422', walnut: '#241811',
    brass: '#8C7D5C', night: '#1A162E', rust: '#C6563A',
  });
});

test('pixelCanvas 는 정수배만 고른다', () => {
  const fake = { width: 0, height: 0, style: {}, getContext: () => ({ imageSmoothingEnabled: true, scale() {} }) };
  const { scale } = Look.pixelCanvas(fake, 180, 120, { maxWidth: 1000, maxHeight: 700 });
  assert.equal(scale, 5);                 // min(floor(1000/180)=5, floor(700/120)=5)
  assert.equal(fake.width, 900); assert.equal(fake.height, 600);
});

test('CSS 가 픽셀 폰트를 픽셀 격자 배수로만 쓴다', () => {
  const css = readFileSync(new URL('../look/look.css', import.meta.url), 'utf8');
  assert.match(css, /--px:\s*12px/);
  assert.match(css, /font-family:\s*'Galmuri11'/);
  assert.match(css, /image-rendering:\s*pixelated/);
});
