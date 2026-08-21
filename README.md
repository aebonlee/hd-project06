# 지게차 엔진 사양 관리·비교 웹페이지

> 🌐 **배포 페이지: [https://aebonlee.github.io/hd-project06/](https://aebonlee.github.io/hd-project06/)** · 저장소: https://github.com/aebonlee/hd-project06

기획: 홍근영 (지게차 엔진 설계) — 생성형 AI 업무자동화 전문가과정 프로젝트

엔진사별로 제각각인 엔진 사양서에서 필요한 제원을 **표준 엑셀 양식**으로 정리해
관리하고, 엔진 모델명 또는 적용 지게차 모델명으로 조회하면 제원 표와
**RPM별 출력·토크 곡선**을 보여주며, **최대 4개 엔진을 나란히 비교**할 수 있는
정적 HTML 페이지입니다.

> **대외비 전제**: 이 페이지는 서버·외부 네트워크·외부 AI API를 일절 사용하지
> 않습니다. 모든 라이브러리(SheetJS, Chart.js, annotation 플러그인)는 `lib/` 에
> 로컬 동봉되어 있어 사내망/오프라인에서도 그대로 동작합니다.

## 사용 흐름

1. **사양서 → 엑셀 (사내 Copilot)**: 엔진 업체 사양서(PDF/PPT/엑셀)를 사내
   Copilot에 첨부하고 `docs/copilot_프롬프트.md` 의 프롬프트를 붙여넣어
   표준 양식 표를 얻는다 → `templates/엔진사양_표준양식.xlsx` 에 붙여넣는다.
2. **Import**: `index.html` 을 브라우저로 열고 **엑셀 Import** 로 그 파일을 불러온다.
   (처음 써 본다면 **샘플 데이터 불러오기** 버튼으로 화면을 먼저 확인)
3. **조회**: 엔진 모델명 또는 지게차 모델명으로 검색 → 4그룹 제원 표 +
   출력·토크 곡선(점 클릭 값 표시, 정격/최대 상시 라벨, Y축 범위 조정).
4. **비교**: "비교" 탭에서 엔진을 최대 4개 선택 → 엔진당 1컬럼 비교 표
   (왼쪽과 동일하면 `<-`) + 곡선 겹쳐 보기(엔진별 색상 구분).
5. **Export**: **엑셀 Export** 로 저장. Export 양식은 Import 양식과 완전히 동일하므로
   그 파일을 다른 PC에서 다시 Import 하면 그대로 이어서 조회·관리할 수 있다.
   (브라우저 localStorage에도 자동 보관되지만, 영구 저장·공유는 Export 파일 기준)

## 표준 엑셀 양식 (시트 3개)

| 시트 | 내용 |
|---|---|
| `engines` | 엔진 1개당 1행. 첫 행은 항목 키(예: `manufacturer`, `rated_power_kw`) |
| `curves` | RPM 포인트 1개당 1행: `엔진 모델명, RPM, 출력(kW), 토크(Nm)` |
| `schema` | 항목 정의: `항목 키, 표시명, 그룹, 단위, 순서` — 화면 표시를 이 시트가 결정 |

- `templates/엔진사양_표준양식.xlsx` — 빈 양식 (헤더 + schema)
- `templates/엔진사양_샘플.xlsx` — 샘플 (제조사 3곳, 엔진 6개, 엔진당 곡선 8~12점)
- 샘플 재생성: `python3 make_samples.py` (openpyxl 필요)

## 항목 추가 방법 (요구사항 3.1.2 — 코드 수정 불필요)

예: "엔진 보증 수명" 항목을 추가하려면 엑셀 파일에서

1. `engines` 시트 맨 오른쪽에 열을 추가하고 첫 행에 항목 키를 적는다: `warranty_hours`
2. 각 엔진 행에 값을 입력한다.
3. `schema` 시트에 행 1개를 추가한다:
   `warranty_hours | 엔진 보증 수명 | 주요 제원 | 시간 | 165`
   (순서 165 → "연비(160)"와 "알터네이터(170)" 사이에 표시됨)
4. 웹페이지에서 다시 Import 하면 제원 표·비교 표에 즉시 나타난다.

schema 행을 깜빡하고 열만 추가해도 데이터는 버려지지 않고 **"기타" 그룹**에
항목 키 그대로 표시되며, Export 시에도 보존됩니다.

## 요구사항 ID 매핑

| 요구사항 ID | 내용 | 구현 위치 |
|---|---|---|
| 3.1.1 | 사내 Copilot 추출 프롬프트 + 표준 양식 (외부 AI 금지) | `docs/copilot_프롬프트.md`, `templates/` |
| 3.1.2 | 항목 추가를 데이터(schema 시트)로 처리 | `js/data.js` `groupSpecs()`, schema 시트 |
| 3.1.3 | 엑셀 Import | `js/data.js` `workbookToData()`, 툴바 버튼 |
| 3.1.4 | 엑셀 Export (Import 양식과 완전 동일) | `js/data.js` `dataToWorkbook()` |
| 3.2 | 모델명/지게차명 검색 + 4그룹 제원 표 | `js/app.js` 조회 화면 |
| 3.2.1 | RPM별 출력·토크 그래프 | `js/charts.js` |
| 3.2.1.1 | 꺾은선 + 데이터 지점 점 표시 | `pointRadius: 4` |
| 3.2.1.2 | 점 클릭 시 값 표시 (`70kW @ 2300 rpm`) | 차트 `onClick` + 판독 영역 |
| 3.2.1.3 | 정격 출력·최대 토크 상시 라벨 | annotation 플러그인 label |
| 3.2.1.4 | 출력/토크 Y축 범위 각각 조정 | 축 min/max 입력 UI |
| 3.3 | 최대 4개 엔진 비교 | 비교 탭 (체크박스, 4개 제한) |
| 3.2.2.1 | 엔진당 1컬럼, 왼쪽과 동일하면 `<-` | `js/data.js` `buildComparisonRows()` |
| 3.2.2.2 | 곡선 겹쳐 보기, 엔진별 색상 구분 | 비교 차트 (색약 안전 4색 팔레트) |
| 제약 5 | Import→Export→재Import 동일성 자동 테스트 | `test/roundtrip.test.js` |

## 사내 배포 방법

서버가 필요 없습니다. **이 폴더를 통째로 사내 공유 폴더에 복사**하고, 각 담당자가
`index.html` 을 브라우저(Edge/Chrome)로 열면 끝입니다. 네트워크 연결이 없어도
동작합니다. 데이터 공유는 Export 한 엑셀 파일을 공유 폴더에 두는 방식을 권장합니다
(예: `엔진사양_DB_20260821.xlsx` — 최신 파일을 Import 해서 사용).

## 테스트 실행법

Node.js만 있으면 됩니다 (별도 설치 패키지 없음 — 동봉된 lib/ 를 그대로 사용).

```bash
node test/roundtrip.test.js   # Import→Export→재Import 완전 동일성 (제약 5) 등 11건
node test/logic.test.js       # "<-" 비교, 스키마 그룹핑, 검색 로직 13건
```

## 파일 구성

```
index.html               # 웹페이지 (브라우저로 열기만 하면 됨)
css/style.css
js/data.js               # Import/Export/검색/그룹핑/비교 로직 (브라우저·Node 공용)
js/charts.js             # 출력·토크 곡선 차트
js/app.js                # 화면 로직
js/sample-data.js        # 내장 샘플 (make_samples.py 가 생성)
lib/                     # 로컬 동봉 라이브러리 (SheetJS, Chart.js, annotation)
templates/               # 표준 양식·샘플 엑셀
docs/copilot_프롬프트.md  # 사내 Copilot 추출 프롬프트 (3.1.1)
make_samples.py          # 양식/샘플 생성 스크립트
test/                    # 자동 테스트
```
