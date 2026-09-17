# Weekly Prototype · 이번 주 프로토타입

매주 기획 도구가 1등으로 뽑은 게임 기획을 그대로 웹 프로토로 만들고, 직접 플레이한 판정을 영상으로 남깁니다.
채널: [퇴근 후 게임 실험실](https://www.youtube.com/@hwi.gamelab)

- 회별 폴더 `YYYY-MM-DD-<이름>/` — `index.html` 을 열면 바로 실행됩니다. 빌드 없음.
- `look/` — 모든 회가 같이 쓰는 룩(팔레트 · 픽셀 폰트 · 잔상 · 비네트).
- `template/` — 새 회의 출발점. 복사해서 시작합니다.
- 그리기 루프 첫 줄에서 `ctx.setTransform(scale,0,0,scale,0,0)` 을 매 프레임 다시 건다 — 캔버스 컨텍스트가 유실·복구되면 변환이 초기화된다(2026-09-17 헤드리스에서 실측).
- 규칙은 `rules.mjs` 에만 두고 `node --test <회>/tests/` 로 자기시험합니다.

로컬 실행: `python3 -m http.server 8000` 뒤 `http://localhost:8000/<회>/`.
폰트는 SIL OFL 1.1 — `look/fonts/LICENSES/`.
모든 프로토는 무료입니다.
