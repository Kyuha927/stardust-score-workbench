# Stardust Flow Source Readback Audit & Multi-Staff Completion Report

## 1. 정본 입력 검증 (Authoritative Source Ingestion)

이 작업의 정본 입력은 Flow에서 분리된 4개 오디오 스템 및 기존 검증된 보컬/가사 정본 데이터입니다.

| Stem | Flow 파일 | 로컬 보존 경로 | 바이트 | SHA-256 | 추출 이벤트 | 악보 상태 |
|---|---|---|---:|---|---:|---|
| **Vocals** | `vocals.m4a` | `assets/flow-stems/vocals.m4a` | 6,270,229 | `2dfb28c0ce7bce8b211b92ed2364ac0a20b722109ba6c97791bd4141ceb5c8f6` | 478 음표 (279 가사) | 정본 보존 (Frozen Canon) |
| **Drums** | `drums.m4a` | `assets/flow-stems/drums.m4a` | 2,854,592 | `9eb14cb41a9e40acac2827ad1bbe20afc5345d74e861febeef5fe084c1202871` | 263 타격 (Kick/Snare/Hat) | 오디오 기반 전사 완료 |
| **Bass** | `bass.m4a` | `assets/flow-stems/bass.m4a` | 4,160,021 | `86749d91c93df1ab57d975fee99b4bdf1979553eebee93a04192d67198a60365` | 86 음표 (F2~G2) | 오디오 기반 전사 완료 |
| **Other** | `other.m4a` | `assets/flow-stems/other.m4a` | 7,098,772 | `b752ef38b6a371ef6734a20005c2df272f393b790cffce220072366bddc780a8` | 206 음표 (C3~E6) | 오디오 기반 전사 완료 |

기준 영수증:
- 경로: `/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/song-reference-analysis-20260909/composition-reference-receipt.local-work-verified.json`
- SHA-256: `4763209fc25f67ff50170a80dbd42e2d02d7b0d1487f1a3ac6e66433f1603716` (상태: `PASS`)

---

## 2. R01에서 R02로의 전이 (Transition from R01 to R02)

### R01 상태 (Baseline)
- 악보 데이터: 1개 트랙(보컬 478개 음표)만 제공되며 `stems`/`tracks` 배열 부재.
- Manifest 상태: Vocals만 `available`, Drums/Bass/Other는 `pending_transcription` (`1 NOTATED STAFF · 3 PENDING`).
- UI: 악기 단은 플레이스홀더 진행률 바만 렌더링.

### R02 완료 상태 (Target Achieved)
- 악보 데이터: `canonflow.multistaff-score-bundle.v1` 스키마 채택. 4개 스템(`vocals`, `drums`, `bass`, `other`)에 대해 시간 정렬 및 소스 입증 가능한 실제 음악 이벤트 완비.
- Manifest 상태: 4개 스템 모두 `score_status: "available"` (`4 NOTATED STAVES · COMPLETE`).
- 악보 산출물:
  - `stardust-multistaff.musicxml`: 4부 악보 (Vocals: Treble + 가사, Drums: Percussion Clef, Bass: Bass Clef, Other: Treble Clef; 121 마디).
  - `stardust-multistaff.mid`: 4-트랙 Type 1 표준 MIDI (375 ticks/beat, 1ms 해상도).
  - `pages/stardust-multistaff-page-XX.svg`: 12페이지 전체 총보 SVG 및 고해상도 PNG.
  - `pages/stardust-{stem}-page-XX.svg`: 개별 스템별 3페이지 악보 SVG (UI 레이어 렌더링용).
  - `score-contact-sheet.png`: 12페이지 전체 총보를 조망하는 콘택트 시트.
- UI: 다중 단 선택자(1 단 보컬, 2 단 +드럼, 3 단 +베이스, All 4단 동시 표시) 및 각 단별 독립 커서/노트 하이라이트 동기화 지원.

---

## 3. 로컬 DSP 음원 분석 및 이벤트 추출 근거 (Extraction Methodology)

임의의 가짜 음표나 반복 플레이스홀더 마디를 일절 생성하지 않고, 로컬의 `librosa`, `scipy.signal`, `ffmpeg`를 사용한 신호처리를 통해 실제 오디오에서 이벤트를 추출했습니다:

1. **Drums (`drums.m4a`)**:
   - 3개 주파수 대역 분할 필터링:
     - Low band (<140 Hz): Kick 탐지 (MIDI 36, F4 percussion placement)
     - Mid band (250~2500 Hz): Snare 탐지 (MIDI 38, C5 percussion placement)
     - High band (>4500 Hz): Hi-Hat 탐지 (MIDI 42, G5 percussion placement)
   - 스펙트럼 플럭스 기반 온셋 검출 및 RMS 에너지 기반 벨로시티(40~127) 산출.
   - 총 263개 타격 이벤트 추출. 인트로/1절(m.1~42)은 드럼 묵음이며, m.43(63.74s) 필인 진입, m.47(69.8s)부터 풀 그루브 전개되는 원곡 구조와 정확히 일치.

2. **Bass (`bass.m4a`)**:
   - 350 Hz 4차 버터워스 저역통과 필터 적용 후 온셋 검출.
   - 각 온셋 구간에서 YIN 알고리즘(fmin=40 Hz, fmax=350 Hz)을 통해 기본 주파수(f0) 추적.
   - 베이스 음역대(MIDI 28~60) 필터링 및 RMS 벨로시티 계산.
   - 총 86개 음표 이벤트 추출. m.6(7.7s)부터 베이스 라인이 진입하여 m.108까지 주요 화성 베이스 음(F2, A#1, C2, D#2, G2 등) 연주.

3. **Other (`other.m4a`)**:
   - 300~3500 Hz 대역통과 필터 및 조화성분 분리.
   - 온셋 검출 및 YIN 기본 주파수 추적으로 신디사이저/기타 멜로디 음역대(MIDI 48~88) 추출.
   - 총 206개 음표 이벤트 추출. m.2(1.5s)부터 악곡 전반에 걸쳐 지속 연주.

4. **Vocals (`vocals.m4a`)**:
   - 기존 정본인 478개 음표 및 279개 일본어 가사 음절 100% 불변 보존.
   - 단 하나의 음표 오차나 가사 불일치 없이 121 마디 전체 정렬 유지.

---

## 4. 검증 결과 (Deterministic Verification Summary)

1. **스키마 및 불변식 검증**:
   - `test_state.mjs`: 15개 단위 테스트 전체 통과 (`node test_state.mjs` -> exit 0).
   - 보컬 478개 음표 수, 가사 라인 29개, 마디 121개, 템포 160 BPM, G minor 조표 불변 확인.
   - 4개 스템 ID (`vocals`, `drums`, `bass`, `other`) 정렬 및 다중 단 표시 선택자 동작 검증.

2. **서버 및 정적 자산 라우팅 검증**:
   - `test_server.py`: 에페머럴 포트 구동 및 15개 종단점 검증 전체 통과 (`python3 test_server.py` -> exit 0).
   - 다중 단 MusicXML, 다중 단 MIDI, 4개 스템 SVG 악보 페이지, 4개 스템 오디오 바이트 레인지 요청, 콘택트 시트 및 디렉터리 순회 방어(403/404) 통과.

3. **시각 및 렌더링 검증**:
   - Leipzig SMuFL 폰트 결함(tofu 박스) 없는 텍스트 템포 마크(`<words font-weight="bold">Tempo 160 BPM</words>`) 확인.
   - 1페이지 좌측 여백 잘림 없는 중앙 정렬 타이틀(`Stardust — Lead Vocal`, 여백 309px) 유지.
   - Verovio 렌더링 12페이지 총보 SVG 및 PNG, 3페이지 파트보 SVG 및 PNG의 유효성 검증 완료.

4. **격리 및 제약 준수**:
   - 네트워크 연결 없음, 브라우저 제어 도구 미사용, 외부 패키지 설치 없음.
   - 작업 디렉터리(`stardust-r02-multistaff-score-20260912`) 외 파일 변경 일절 없음.
