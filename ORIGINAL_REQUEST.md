# Original User Request

## Initial Request — 2026-09-13T02:16:23+09:00

Stardust 곡의 4-파트 총보/파트보(Grand & Stems) 악보 뷰어, 타임라인 및 악보 직접 드래그 스크러빙, 그리고 마우스 우클릭 즉각 피드백(타깃 파트, 카테고리 태그, 인스펙터 탭, 악보 핀/타임라인 마커) 시스템의 다각도 품질 검증 및 인터랙션 고도화.

Working directory: `/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912`
Integrity mode: development

## Requirements

### R1. Right-Click Instant Feedback System
- 악보 스태프 프레임(`score-svg-frame`) 및 하단 타임라인 트랙(`timeline-track`) 어디서나 마우스 우클릭 시 DAW/Premiere 스타일의 커스텀 컨텍스트 메뉴가 즉시 표시되어야 함.
- 컨텍스트 메뉴에서 "이 지점에 피드백 남기기" 선택 시 모달 다이얼로그가 열리고, 해당 지점의 마디(Bar), 박자(Beat), 타임코드, 그리고 해당 구간에 연주 중인 가사 라인이 자동 반영되어야 함.
- 대상 파트(전체/보컬/드럼/베이스/기타) 및 피드백 카테고리(보컬/타이밍/음정/믹스/가사/메모) 태그를 간편하게 지정할 수 있어야 함.
- 저장된 피드백은 브라우저 `localStorage`에 영구 저장되며, 악보 SVG 상에 전용 인터랙티브 핀(`score-feedback-pin`)과 타임라인 상에 마커(`timeline-feedback-marker`)로 즉시 시각화되어야 함.

### R2. Inspector Feedback Pane & Two-Way Interactive Navigation
- 우측 인스펙터 패널에 `💬 피드백` 전용 탭이 제공되어야 하며, 등록된 피드백 목록을 파트별(보컬/드럼/베이스/기타/전체)로 필터링할 수 있어야 함.
- 피드백 카드에는 타임코드, 마디/박자, 파트 뱃지, 카테고리 뱃지, 작성자/작성시각, 피드백 본문이 표시되어야 하며, 해결/미해결 토글, 수정, 삭제 기능이 동작해야 함.
- 악보 상의 핀, 타임라인 상의 마커, 인스펙터 상의 타임코드 뱃지를 클릭하면 해당 위치로 4개 오디오 스템이 원자적으로 즉시 탐색(Seek)되고, 필요 시 해당 악보 페이지로 자동 전환되어야 함.
- 등록된 모든 피드백을 단일 클릭으로 구조화된 Markdown 보고서로 클립보드 복사하거나, 표준 JSON 파일로 다운로드할 수 있어야 함.

### R3. High-Performance Zero-Reflow Playhead & Scrubbing Stability
- 전체 121마디(181.50초)에 걸쳐 타임라인 및 악보 플레이헤드가 일치하여 동작해야 하며, 오디오 재생 종료 시점(167.39초) 이후 181.5초까지의 탐색 시 역방향 점프가 발생하지 않아야 함.
- 악보 및 타임라인 드래그 스크러빙 시 레이아웃 리플로우(forced reflow)를 0으로 억제하기 위해 사전 캐싱된 기하 데이터와 SVG 매트릭스 변환을 사용해야 함.
- 키보드 프레임 탐색(좌우 화살표, Shift, Alt, Ctrl), 재생(Space, S, Loop) 및 피드백 단축키(F/M, Cmd+Enter, Esc)가 입력 폼과 충돌 없이 완벽히 동작해야 함.

### R4. Verification & Canon Invariant Preservation
- 보컬 캐논 데이터셋(`stardust-score-data.json`, 478개 노트, 279개 가사, SHA-256 `d5f7959789994462c0e666bfa62035814c4138403aaa22bcf9d6bae8c05a957b`)의 무결성이 영구 보존되어야 함.
- 모든 상태 전이 순수 함수 단위 테스트(`node test_state.mjs`) 17개 항목이 100% 통과(Pass)되어야 함.
- 코드 구문 검증(`node --check app.mjs`, `node --check state.mjs`) 및 로컬 HTTP 서버(`http://127.0.0.1:8791`) 정상 응답(200 OK)이 보장되어야 함.

## Verification Resources
- 단위 테스트 스위트: `test_state.mjs` (Feedback CRUD, Range, Loop, Invariants 등 17개 테스트)
- 신원 검증 manifest: `assets/source-manifest.json` 및 `assets/stardust-score-data.json`
- 로컬 개발 서버: `server.py` (포트 8791)

## Acceptance Criteria

### Unit & Syntax Verification
- [ ] `node --check app.mjs` 및 `node --check state.mjs` 실행 시 오류 없이 exit code 0 반환
- [ ] `node test_state.mjs` 실행 시 17개 전 항목 통과 (Exit code 0)
- [ ] `assets/stardust-score-data.json` SHA-256 해시가 `d5f7959789994462c0e666bfa62035814c4138403aaa22bcf9d6bae8c05a957b`와 정확히 일치

### Interactive Feedback System
- [ ] 악보 SVG 프레임 및 타임라인에서 우클릭 시 커스텀 컨텍스트 메뉴가 정확한 마디/박자/타임코드와 함께 표시됨
- [ ] 피드백 모달에서 타깃 파트 및 카테고리 태그 선택, 해당 위치 가사 표시, 피드백 저장이 정상 동작함
- [ ] 저장된 피드백이 `localStorage`에 보존되어 브라우저 새로고침 후에도 복원됨
- [ ] 악보 상에 해당 마디/박자 위치에 핀(`score-feedback-pin`)이 렌더링되고, 툴팁 표시 및 클릭 시 탐색 연동됨
- [ ] 타임라인 상에 마커(`timeline-feedback-marker`)가 렌더링되고 클릭 시 해당 위치로 즉시 이동함
- [ ] 우측 인스펙터 `💬 피드백` 탭에서 목록 표시, 파트별 필터링, 해결 상태 토글, 수정, 삭제가 오류 없이 동작함
- [ ] 피드백 Markdown 복사 및 JSON 다운로드 기능이 규격에 맞게 작동함

### Scrubbing & Performance
- [ ] 181.5초(121마디) 전 범위에 걸쳐 악보 및 타임라인 드래그 스크러빙이 60fps로 매끄럽게 동작함
- [ ] 오디오 파일 길이(167.39초) 이후 구간에서도 키보드 방향키 탐색 시 뒤로 튀는 현상 없음
- [ ] 포인터 이동 이벤트 루프 내 `getBoundingClientRect` 또는 `querySelectorAll` 등 강제 리플로우 유발 호출 없음
