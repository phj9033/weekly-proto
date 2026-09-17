// 「꼬리」 — 규칙만. DOM 없음. 일반 스크립트(전역 TailRules) — file:// 로 열어도 돌아야 해서 ES 모듈을 쓰지 않는다. 기획 정본: work/hwi.gamelab/planlab/2026-09-17-01/report.json (id: tail)
// 붙잡은 적이 내 뒤에 마디로 붙어 옆으로 쏘고 대신 맞는다. 몸집이 늘어 통로가 좁아진다. 몇 마디까지 키울지가 판이다.

const W = 320, H = 180;                 // 논리 해상도(16:9)
const ROUND_S = 90;
const HEAD_R = 4, SEG_R = 3.5, SEG_GAP = 8;
const HEAD_SPEED = 70;                  // px/s · Z 누르는 동안 절반
const SEG_SPEED = 110;                  // 마디가 앞을 따라붙는 최고 속도 — 머리보다 빠르지만 순간이동은 아니다
const BEAM_RANGE = 60, BEAM_HALF_ANGLE = Math.PI / 5;   // 부채꼴 ±36°
const CAPTURE_S = { fast: 0.8, big: 1.5, neutral: 0.4 };
const SEG_HP = { fast: 1, big: 2, neutral: 1 };
const FIRE_CD = 0.25, BULLET_SPEED = 160, ENEMY_BULLET_SPEED = 70;
const TEAR_DIST = SEG_GAP * 3, TEAR_S = 0.5;   // 마디가 벽에 걸려 이만큼 떨어져 이만큼 버티면 떨어진다
const OBSTACLES = [                     // 통로 폭: 가운데 세로 둘 사이 = 40px(꼬리 4~5 마디부터 걸린다)
  { x: 60, y: 30, w: 24, h: 52 },
  { x: 236, y: 98, w: 24, h: 52 },
  { x: 140, y: 78, w: 40, h: 12 },
];

// 시드 난수 — 같은 시드 = 같은 등장. mulberry32
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function createState(seed = 1) {
  return {
    seed, rand: rng(seed), t: 0, over: false, ended: false, score: 0, kills: 0,
    head: { x: W / 2, y: H / 2 + 50, ang: -Math.PI / 2 },   // 가운데 막대(y 78~90) 아래 열린 곳
    tail: [],              // {x,y,hp,kind}
    enemies: [],           // {id,x,y,kind,hp,fireCd,vx,vy}
    bullets: [], ebullets: [],
    beam: { target: null, gauge: 0, active: false },
    fireCd: 0, nextSpawn: 1.0, nextId: 1,
    log: [],               // {t,ev,...} 판 로그
  };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function hitsObstacle(x, y, r) {
  return OBSTACLES.some(o => x + r > o.x && x - r < o.x + o.w && y + r > o.y && y - r < o.y + o.h);
}
function moveBlocked(p, dx, dy, r) {           // 축별로 미끄러진다
  const nx = clamp(p.x + dx, r, W - r), ny = clamp(p.y + dy, r, H - r);
  if (!hitsObstacle(nx, p.y, r)) p.x = nx;
  if (!hitsObstacle(p.x, ny, r)) p.y = ny;
}
function inCone(head, e) {
  const d = dist(head, e); if (d > BEAM_RANGE || d < 1) return false;
  let a = Math.atan2(e.y - head.y, e.x - head.x) - head.ang;
  a = Math.atan2(Math.sin(a), Math.cos(a));
  return Math.abs(a) <= BEAM_HALF_ANGLE;
}

function spawnEnemy(s, kind) {
  const side = Math.floor(s.rand() * 4), u = s.rand();
  const pos = [{ x: u * W, y: -6 }, { x: W + 6, y: u * H }, { x: u * W, y: H + 6 }, { x: -6, y: u * H }][side];
  const e = { id: s.nextId++, kind, hp: kind === 'big' ? 3 : 1, fireCd: 1.2 + s.rand(), vx: 0, vy: 0, ...pos };
  s.enemies.push(e); return e;
}
/** 파도: 30초마다 등장 간격이 줄고 빠른 적 비율이 오른다. 60초부터 큰 적. */
function waveParams(t) {
  const stage = Math.min(2, Math.floor(t / 30));
  return { interval: [2.2, 1.6, 1.1][stage], bigChance: t >= 60 ? 0.35 : 0 };
}

function fire(s) {
  if (s.fireCd > 0 || s.over) return 0;
  s.fireCd = FIRE_CD;
  const h = s.head;
  s.bullets.push({ x: h.x, y: h.y, vx: Math.cos(h.ang) * BULLET_SPEED, vy: Math.sin(h.ang) * BULLET_SPEED });
  s.tail.forEach((seg, i) => {                 // n번째 마디는 왼·오른쪽을 번갈아
    const side = i % 2 === 0 ? -1 : 1, a = h.ang + side * Math.PI / 2;
    s.bullets.push({ x: seg.x, y: seg.y, vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED });
  });
  s.log.push({ t: s.t, ev: 'fire', n: 1 + s.tail.length });
  return 1 + s.tail.length;
}

function detach(s) {                    // C: 끝 마디를 떼어 중립 표류체로
  if (!s.tail.length || s.over) return null;
  const seg = s.tail.pop();
  const e = { id: s.nextId++, kind: 'neutral', hp: 1, fireCd: Infinity, vx: (s.rand() - .5) * 10, vy: (s.rand() - .5) * 10, x: seg.x, y: seg.y };
  s.enemies.push(e); s.log.push({ t: s.t, ev: 'detach', len: s.tail.length }); return e;
}

function capture(s, e) {
  s.enemies = s.enemies.filter(o => o !== e);
  const last = s.tail.length ? s.tail[s.tail.length - 1] : s.head;
  s.tail.push({ x: last.x, y: last.y, hp: SEG_HP[e.kind], kind: e.kind, stuck: 0 });
  s.beam.target = null; s.beam.gauge = 0;
  s.log.push({ t: s.t, ev: 'capture', kind: e.kind, len: s.tail.length, x: Math.round(e.x), y: Math.round(e.y) });
}
function killEnemy(s, e) {
  s.enemies = s.enemies.filter(o => o !== e);
  if (e.kind !== 'neutral') s.kills++;
  s.log.push({ t: s.t, ev: 'kill', kind: e.kind });
}
function hurtSegment(s, i, why) {
  const seg = s.tail[i]; seg.hp--;
  if (seg.hp <= 0) { s.tail.splice(i, 1); s.log.push({ t: s.t, ev: 'seglost', why, len: s.tail.length }); }
}
function endRound(s, why) {
  s.over = true; s.score = s.kills + s.tail.length * 5;
  s.log.push({ t: s.t, ev: 'end', why, score: s.score, len: s.tail.length });
}

/** input: {up,down,left,right,beam,fire,detach}. dt 초. */
function step(s, input, dt) {
  if (s.over) return s;
  s.t += dt; s.fireCd = Math.max(0, s.fireCd - dt);
  const h = s.head;

  // 이동 · 방향 = 마지막 이동 방향
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0), dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (dx || dy) {
    const len = Math.hypot(dx, dy), sp = HEAD_SPEED * (input.beam ? 0.5 : 1) * dt;
    h.ang = Math.atan2(dy, dx);
    moveBlocked(h, dx / len * sp, dy / len * sp, HEAD_R);
  }
  if (input.fire) fire(s);
  if (input.detach && !s._detachHeld) detach(s);
  s._detachHeld = !!input.detach;

  // 빔: 부채꼴 안 가장 가까운 적 하나에 게이지. 손을 떼면 0.
  s.beam.active = !!input.beam;
  if (input.beam) {
    const cands = s.enemies.filter(e => inCone(h, e)).sort((a, b) => dist(h, a) - dist(h, b));
    const tgt = cands[0] || null;
    if (tgt !== s.beam.target) { s.beam.target = tgt; s.beam.gauge = 0; }
    if (tgt) { s.beam.gauge += dt; if (s.beam.gauge >= CAPTURE_S[tgt.kind]) capture(s, tgt); }
  } else { s.beam.target = null; s.beam.gauge = 0; }

  // 꼬리 추종: 앞 마디를 향해 간격만큼 다가간다. 벽에 막혀 멀어지면 떨어진다(몸집의 대가).
  for (let i = 0; i < s.tail.length; i++) {
    const seg = s.tail[i], lead = i === 0 ? h : s.tail[i - 1];
    const d = dist(seg, lead);
    if (d > SEG_GAP) {
      const mv = Math.min(d - SEG_GAP, SEG_SPEED * dt), mx = (lead.x - seg.x) / d * mv, my = (lead.y - seg.y) / d * mv;
      moveBlocked(seg, mx, my, SEG_R);
      // 마디는 머리보다 빠르므로 열린 곳에선 간격을 금방 되찾는다. 간격이 3배 넘게 벌어진 채 버티면 벽에 걸린 것이다
      seg.stuck = dist(seg, lead) > TEAR_DIST ? seg.stuck + dt : 0;
      if (seg.stuck >= TEAR_S) {
        const torn = s.tail.splice(i); // 걸린 마디부터 뒤 전부 떨어진다
        torn.forEach(t => s.enemies.push({ id: s.nextId++, kind: 'neutral', hp: 1, fireCd: Infinity, vx: 0, vy: 0, x: t.x, y: t.y }));
        s.log.push({ t: s.t, ev: 'torn', n: torn.length, len: s.tail.length }); break;
      }
    } else seg.stuck = 0;
  }

  // 등장
  const wp = waveParams(s.t);
  if (s.t >= s.nextSpawn) { spawnEnemy(s, s.rand() < wp.bigChance ? 'big' : 'fast'); s.nextSpawn = s.t + wp.interval; }

  // 적: 나를 향해 표류. 빠른 적은 쏜다. 중립은 그냥 흐른다.
  for (const e of s.enemies) {
    if (e.kind === 'neutral') { e.x += e.vx * dt; e.y += e.vy * dt; continue; }
    const d = dist(e, h) || 1, sp = e.kind === 'big' ? 14 : 26;
    e.x += (h.x - e.x) / d * sp * dt; e.y += (h.y - e.y) / d * sp * dt;
    if (e.kind === 'fast') { e.fireCd -= dt; if (e.fireCd <= 0) { e.fireCd = 2.0 + s.rand(); s.ebullets.push({ x: e.x, y: e.y, vx: (h.x - e.x) / d * ENEMY_BULLET_SPEED, vy: (h.y - e.y) / d * ENEMY_BULLET_SPEED }); } }
  }

  // 내 탄
  s.bullets = s.bullets.filter(b => {
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x < 0 || b.x > W || b.y < 0 || b.y > H || hitsObstacle(b.x, b.y, 1)) return false;
    const e = s.enemies.find(o => dist(o, b) < (o.kind === 'big' ? 6 : 4));
    if (e) { e.hp--; if (e.hp <= 0) killEnemy(s, e); return false; }
    return true;
  });
  // 적 탄: 마디에 맞으면 그 마디만. 머리에 맞으면 끝.
  s.ebullets = s.ebullets.filter(b => {
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x < 0 || b.x > W || b.y < 0 || b.y > H || hitsObstacle(b.x, b.y, 1)) return false;
    const si = s.tail.findIndex(seg => dist(seg, b) < SEG_R + 1);
    if (si >= 0) { hurtSegment(s, si, 'bullet'); return false; }
    if (dist(h, b) < HEAD_R + 1) { endRound(s, 'bullet'); return false; }
    return true;
  });
  // 적 몸: 마디에 닿으면 마디 하나(적도 사라진다). 머리에 닿으면 끝.
  for (const e of [...s.enemies]) {
    if (e.kind === 'neutral') continue;
    const r = e.kind === 'big' ? 6 : 4;
    const si = s.tail.findIndex(seg => dist(seg, e) < SEG_R + r);
    if (si >= 0) { hurtSegment(s, si, 'body'); s.enemies = s.enemies.filter(o => o !== e); continue; }
    if (dist(h, e) < HEAD_R + r) { endRound(s, 'body'); break; }
  }

  if (!s.over && s.t >= ROUND_S) { s.ended = true; endRound(s, 'time'); }
  return s;
}

const TailRules = { W, ROUND_S, HEAD_R, HEAD_SPEED, SEG_SPEED, BEAM_RANGE, CAPTURE_S, SEG_HP, FIRE_CD, TEAR_DIST, OBSTACLES, rng, createState, hitsObstacle, spawnEnemy, waveParams, fire, detach, step, H, SEG_R, SEG_GAP, BEAM_HALF_ANGLE, BULLET_SPEED, ENEMY_BULLET_SPEED, TEAR_S };
if (typeof globalThis !== 'undefined') globalThis.TailRules = TailRules;
