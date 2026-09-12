# Astra Pro 웹 검토 요청용 프롬프트 (클릭하여 복사)

아래 박스 안의 내용을 그대로 복사하여 Astra Pro 웹 채팅창에 입력하시면 됩니다:

```markdown
당신은 최고의 웹 프론트엔드 아키텍트이자 오디오/DAW 인터랙션 전문 시니어 엔지니어입니다.
아래 GitHub 저장소는 160 BPM 4/4 박자(총 121마디, 181.5초)의 4-파트(보컬, 드럼, 베이스, 기타) 총보/파트보 악보 뷰어와 Premiere Pro/DAW 스타일의 악보 및 타임라인 드래그 스크러빙, 그리고 마우스 우클릭 즉각 피드백 시스템을 구현한 웹 워크벤치 프로젝트입니다.

- GitHub Repository: https://github.com/Kyuha927/stardust-score-workbench
- Review Guide: https://github.com/Kyuha927/stardust-score-workbench/blob/main/ASTRA_PRO_REVIEW_GUIDE.md
- Core Code:
  - app.mjs: https://github.com/Kyuha927/stardust-score-workbench/blob/main/app.mjs
  - state.mjs: https://github.com/Kyuha927/stardust-score-workbench/blob/main/state.mjs
  - index.html: https://github.com/Kyuha927/stardust-score-workbench/blob/main/index.html
  - styles.css: https://github.com/Kyuha927/stardust-score-workbench/blob/main/styles.css
  - test_state.mjs: https://github.com/Kyuha927/stardust-score-workbench/blob/main/test_state.mjs

위 저장소의 코드 및 구조를 직접 읽고 다음 5가지 핵심 영역을 엄격하고 비판적인 시각으로 종합 감사(Audit)해 주십시오:

1. [우클릭 즉각 피드백 및 모달 인터랙션 UX]
   - 악보 SVG 프레임 및 타임라인 트랙 우클릭 시 컨텍스트 메뉴 표시 및 좌표 계산의 정확도
   - 모달 다이얼로그의 마디/박자/타임코드/가사 자동 매핑 및 파트/카테고리 태깅 구조
   - 악보 SVG 인터랙티브 핀(score-feedback-pin)과 타임라인 마커(timeline-feedback-marker)의 렌더링, 툴팁, 클릭 시 원자적 탐색 연동성
   - 인스펙터 우측 피드백 탭(필터링, 해결 상태 토글, 수정/삭제, Markdown/JSON 내보내기)의 실용성과 완성도

2. [DAW급 스크러빙 및 제로 리플로우 성능]
   - getTimeFromScorePointer()의 화면 좌표 -> SVG 뷰박스 역변환 및 사전 캐싱된 시스템(_cachedSystems) 활용의 적절성
   - 마우스 드래그 중 getBoundingClientRect() 배제 등 60fps 보장형 레이아웃 리플로우(forced reflow) 억제 수준
   - 드래그 중 오디오 4개 스템 원자적 일시정지 및 75ms 프리뷰 스로틀링, 드래그 종료 후 원자적 재생 복구 안정성

3. [마스터 타임베이스(181.5s) 및 오디오 EOF(167.4s) 경계 처리]
   - 오디오 파일이 끝난 후(167.39초)부터 악보 끝(181.50초, 121마디)까지의 단조 시계(monotonic clock) 및 키보드 화살표 탐색 시 역방향 튐 방지 로직의 견고함

4. [상태 관리 순수성 및 캐논 불변성]
   - state.mjs 내 불변 상태 전이(Feedback CRUD, Range, Loop, Navigation)의 순수 함수 설계
   - 478개 음표, 279개 가사 원본 데이터(stardust-score-data.json)의 SHA-256 불변성 보존 및 드래프트 오버레이 분리 방식

5. [종합 평가 및 개선 권고]
   - 발견된 잠재적 버그, 브라우저 호환성(Safari, Firefox, Chrome) 위험 요소, 추가 최적화 포인트
   - 총평 및 실무 도입 적합도 판정
```
