# Astra Pro 웹 검토 요청용 프롬프트 (UI 최대 개선 집중형)

아래 프롬프트를 복사하여 Astra Pro 웹 채팅창에 입력하시면 됩니다:

```markdown
당신은 최고의 웹 프론트엔드 아키텍트이자 글로벌 최정상급 DAW(Logic Pro, Premiere Pro, Dorico, Ableton Live) 전문 수석 UI/UX 디자이너 겸 엔지니어입니다.
아래 GitHub 저장소는 160 BPM 4/4 박자(총 121마디, 181.50초)의 4-파트(보컬, 드럼, 베이스, 기타) 총보/파트보 악보 뷰어와 Premiere Pro/DAW 스타일의 악보 및 타임라인 드래그 스크러빙, 그리고 마우스 우클릭 즉각 피드백 시스템을 구현한 웹 워크벤치 프로젝트입니다.

- GitHub Repository: https://github.com/Kyuha927/stardust-score-workbench
- Review Guide: https://github.com/Kyuha927/stardust-score-workbench/blob/main/ASTRA_PRO_REVIEW_GUIDE.md
- Core Code:
  - index.html: https://github.com/Kyuha927/stardust-score-workbench/blob/main/index.html
  - styles.css: https://github.com/Kyuha927/stardust-score-workbench/blob/main/styles.css
  - app.mjs: https://github.com/Kyuha927/stardust-score-workbench/blob/main/app.mjs
  - state.mjs: https://github.com/Kyuha927/stardust-score-workbench/blob/main/state.mjs
  - test_state.mjs: https://github.com/Kyuha927/stardust-score-workbench/blob/main/test_state.mjs

저장소의 코드와 UI 구조를 직접 확인하고, **[UI/UX 최대 개선 및 시각적 완성도 극대화]**를 최우선 순위로 삼아 다음 5대 영역을 엄격히 감사하고 **즉시 적용 가능한 구체적 개선 코드(HTML/CSS/JS)**를 제시해 주십시오:

1. [UI/UX 비주얼 디자인 및 레이아웃 최대 개선 (최우선)]
   - 현재 UI의 심미적 수준을 Logic Pro / Premiere / Dorico 수준의 프리미엄 프로페셔널 다크 인터페이스로 끌어올리기 위한 레이아웃, 여백, 계층 구조 전면 개선안.
   - 상단 트랜스포트 바, 악보 뷰포트(Score Paper), 우측 인스펙터(가사/피드백 탭), 하단 타임라인 간의 시각적 밸런스 및 공간 효율화.
   - 글래스모피즘(Backdrop-filter blur), 미려한 보더/섀도우, 마이크로 인터랙션, 부드러운 트랜지션 및 시각적 피드백 효과.
   - 악보 종이(Score Paper) 텍스처, 대비감, 고해상도 렌더링 및 플레이헤드 핀/마커의 세련된 비주얼 디테일.

2. [우클릭 즉각 피드백 & 모달 다이얼로그 UX 고도화]
   - 악보 SVG 및 타임라인 우클릭 시 컨텍스트 메뉴의 시각 디자인 및 위치 계산 매끄러움.
   - 피드백 모달 다이얼로그의 입력 편의성: 단축키 안내, 파트/카테고리 선택 칩의 시각적 명확성, 가사 컨텍스트 표시 시인성.
   - 악보 SVG 상 인터랙티브 핀(score-feedback-pin)과 타임라인 마커(timeline-feedback-marker)의 시인성, 호버 툴팁, 클릭 피드백.
   - 우측 인스펙터 피드백 카드 디자인: 상태 뱃지, 카테고리 컬러 코딩, 해결/미해결 토글 시각 효과, 삭제/수정 액션 배치.

3. [DAW급 타임라인 및 스크러빙 인터랙션 고도화]
   - 하단 타임라인 트랙의 시각화 강화: 마디 룰러(Ruler), 섹션 밴드, 보컬 프레이즈 블록의 그래픽 완성도.
   - 마우스 드래그 및 호버 가이드(시간/마디/박자 툴팁)의 즉각적 반응성과 심미성.
   - Zero-reflow 성능을 유지하면서도 시각적으로 가장 부드러운 60fps 플레이헤드 이동 구현.

4. [성능 및 기술적 안정성 감사]
   - getTimeFromScorePointer() 좌표 역변환 및 사전 캐싱 기하 구조의 최적성.
   - 4개 오디오 스템 동기화, 오디오 EOF(167.4s) 이후 181.5s까지의 마스터 타임베이스 경계 처리 안정성.
   - state.mjs의 불변 데이터 관리 및 보컬 캐논 데이터 무결성 검증.

5. [즉시 적용 가능한 최대 개선 코드 패치 제안]
   - styles.css 및 index.html, app.mjs에 바로 반영할 수 있는 구체적인 CSS/JS 개선 패치 코드 제시.
```
