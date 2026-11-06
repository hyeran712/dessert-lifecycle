# 디저트 타이밍 — 프로젝트 안내 (Claude Code용)

## 가장 중요한 규칙
- **사용자에게는 항상 한국어로만 답한다.** (영어로 답하면 사용자가 매우 불편해함. 도구를 많이 쓴 뒤에도 한국어 유지)
- 설명은 쉬운 말로. 사용자는 개발자가 아니라 식품 상품기획·프랜차이즈 메뉴개발 직무를 준비하는 사람이다. 이 사이트는 취업 포트폴리오다.
- **인증키·토큰은 절대 코드나 채팅에 넣지 않는다.** GitHub Secrets / Cloudflare Worker 비밀 변수에만 둔다.
- 레퍼런스 사이트(시그니처 팩토리 signaturefactory.kr)는 **구조·흐름만 참고**한다. 로고, 문구, 사진, 브랜드는 쓰지 않는다.
- 색은 지금 사이트의 POP 팔레트를 유지한다: 노랑 `#ffd400`, 주황 `#ff5a1f`, 잉크 `#1c1c1c`, 크림 배경 `#fff8dc`, 제목 글꼴 Black Han Sans.

## 목표 (2026-11-05 사용자)
- 지금은 취업 포트폴리오지만, **개인 카페 사장님·F&B 실무자가 실제로 쓰는 도구**로 키워 나중에 판매하는 것이 목표
- 그래서 화면·문구는 "분석 결과 보여 주기"보다 "사장님이 바로 결정하고 행동하기" 쪽으로, 사용자 편의를 우선해서 만든다

## 사이트 주소
- 새 버전(단계형): https://hyeran712.github.io/dessert-lifecycle/
- 예전 버전(한 페이지형, 비교용): https://hyeran712.github.io/dessert-lifecycle/v1.html — 새 버전으로 결정(2026-11-05). v1과 맨 아래 링크는 당분간 그대로 둔다
- 포트폴리오 메인: https://hyeran712.github.io (다른 저장소 `hyeran712/hyeran712.github.io`, `#dessert` 카드)

## 파일 구조
```
src/head.html    <head>와 CSS 전부
src/body.html    화면 구조(HTML)
src/app.js       동작(JS) 전부
src/data.json    분석 결과 데이터(디저트 21종 수명주기, 매장 통계)
build.sh         src/ 네 파일을 합쳐 index.html 생성  ← 수정 후 반드시 실행
index.html       배포되는 파일 (직접 고치지 말 것, build.sh가 만듦)
v1.html          예전 버전 스냅샷 (따로 손대지 않음)
img/menu/        디저트 사진 22장 (사용자가 AI로 만든 크림 배경 이미지 → 480px webp). app.js `IMG`·`photo(k)`로 대표 카드·추천 카드·사이드바에 씀
live/live.json   주간 레이더 결과 (GitHub Actions가 매주 갱신, 손으로 고치지 말 것)
live/radar_base.csv.gz, live/state.json   레이더 원본·진행 상태
scripts/update.py, scripts/radar_core.py  주간 레이더 계산
worker/worker.js, worker/wrangler.toml    Cloudflare Worker (실시간 검색·AI 신메뉴)
dessert_lifecycle.ipynb, dessert_lifecycle/   분석 노트북·그림·원본 데이터 (README에서 사용)
```

## 작업 순서
1. `src/` 파일을 고친다.
2. `./build.sh` 실행 → `index.html` 갱신
3. 확인: `python3 -m http.server 8765` 후 http://localhost:8765 에서 1→2→3단계를 눌러 보고, 콘솔 오류가 없는지 본다. (`node --check src/app.js`로 문법 확인)
4. 커밋·푸시하면 GitHub Pages가 1~2분 안에 자동 배포된다.

## 화면 구조 (src/body.html)
- 위쪽 바: 로고(사용자가 AI로 만든 바늘 없는 디저트 나무 시계 이미지 `img/brand/logo-clock.webp` 위에 SVG 나무 바늘(끝 주황, 11시 고정, 처음 열 때 째깍 들어오는 `.lm-tick` 애니메이션) + '디저트 타이밍', 파비콘 `img/brand/favicon.png`·apple-touch-icon도 같은 그림) · [메뉴 개발] [이번 주 레이더] [동네 리포트] [About data]. '내 가게' 칸은 2026-11-05 뺐음. 휴대폰(640px 이하)에서는 메뉴가 화면 아래 고정 바
- 알림 띠 `#notice`: 이번 주 레이더 요약 (renderRadar에서 채움)
- `#view-flow`: 3단계 흐름. 단계 꼬리표 `#ph-tag`, 제목 `#ph-title`, 표시줄 `#stepper`
  - 1단계 `[data-panel="1"]#diagnose`: 대표 디저트 카드 `#picks`, 검색 `#q-form`, 전체 목록 `#chips`
  - 2단계 `[data-panel="2"]#findings`: 판정 `.result`, 그래프 `#c-main`, 핵심 발견 ①~④, 과일모찌 사례 `#case-mochi`
  - 3단계 `[data-panel="3"]#proposal`: 목적 카드 `#goals`, 기획 카드 `#p-plan`, 내 가게 프로필 `#profile`, 요청사항 `#mk-note`, 신메뉴 버튼 `#mk-btn`, 결과 `#mk-out`, 전략표 `#p-table`
  - 오른쪽 사이드바 `#side`: 진행 단계 `#prog`, 고른 디저트 요약 `#sel-sum`
- `#local`: 우리 동네 리포트(사장님용). 시도 `#lc-sido`·시군구 `#lc-gu` 고르면 `#lc-sheet`에 한 장 리포트, `#lc-print`로 A4 PDF 저장(인쇄용 CSS는 head.html 끝)
- `#radar`: 별도 화면. 디저트 타일 `#rd-tiles`, 3D 지도 `#mapstage`(`#kmap` SVG, 팝업 `#map-panel`, 확대 버튼 `.ms-ctrl`), 새 가게 이름 `#rd-list`

## 동작 핵심 (src/app.js)
- `select(k)`: 디저트 선택 → 판정·그래프·발견·기획 갱신. 아래쪽에서 한 번 감싸서 카드/사이드바도 갱신함
- `goStep(n)`, `setView('flow'|'radar')`: 단계·화면 전환 (숨긴 차트는 전환 후 `Chart.instances` resize)
- `analyzeLive(q)`: 목록에 없는 디저트를 Worker로 실시간 분석 (`LIVE_API`) — 성공 시 true. 1단계 칩 중 `D.kw`에 없는 것(붕어빵·땅콩빵)은 점선 '실시간' 칩으로, 누르면 analyzeLive. 마라탕은 '비교용' 줄
- `makeMenu()`: Worker `POST /menu`에 {keyword, type, kind, price, targetRate:30, profile, goal, note}
- 신메뉴 결과 아래 [♡ 보관함에 저장] [↻ 다른 메뉴]: 보관함은 localStorage `dessert-timing-saved`(최대 30개, `#saved` 카드·사이드바 `#side-saved`), 다른 메뉴는 앞서 나온 이름 3개를 note에 붙여 다시 요청(`makeMenu(true)`). 카드 HTML은 `menuCard(m)` 하나로 결과·보관함 공용. 로그인·여러 기기 동기화가 필요해지면 Supabase 검토
- 메뉴 목적(GOAL): Worker `GOAL_GUIDE`가 목적별 구체 지시를 AI에 주고 `goal`·`goalFit`·`photo`(SNS용)를 돌려줌 → 결과 카드에 목적 꼬리표·'목적에 맞춘 점'·'사진 포인트'. 3단계 기획 상자 맨 앞 노란 `.gtip`은 `GOAL_TIP` + 유행 단계와 안 맞을 때 한마디. `GOAL`·`GOAL_OF`는 renderPlan보다 위에 선언(처음 그릴 때 TDZ 오류 방지)
- 대목 달력(app.js): `ANNUAL`(매년 같은 날)은 올해·내년 날짜를 자동 생성, 수능은 `suneung(y)`=11월 셋째 목요일, 설·추석은 `live/holidays.json`(주간 레이더가 공공데이터 '한국천문연구원 특일 정보'에서 올해~2년 뒤를 받아 저장, 실패 시 기존 값 유지, 파일이 없으면 코드의 `LUNAR` 기본값). `upcoming(k)`로 70일 안 대목을 결론 카드 '언제' 줄(유행형은 '대목' 줄)과 추천 점수(+1)에 씀. 손으로 날짜 고칠 필요 없음
- 내 가게 프로필은 localStorage `dessert-timing-profile` (이름 name, 분야 cat, 장비 eq, 가격대 price, 금기 재료 ban)
- 1단계 맨 위 `#dclock` 디저트 시계: `clockPlan()`이 D.kw의 `season`(달별 연평균 대비 배수)으로 12달에 디저트를 하나씩 배정(큰 값부터, 한 디저트 한 달, 유행형 0.85배 가중), 바늘이 이번 달. 누르면 select+2단계. 그 아래
- 1단계 맨 위 `#rec`: 가게 종류·장비·가격대 → `recommend(p)`가 REQ·유형·대목 월로 점수 매겨 3개 추천(카드 누르면 2단계). 고른 값은 프로필에도 저장
- 지도 모양(2026-11-06 최종): 사용자가 보낸 점토(클레이) 느낌 지도 시안대로. 흰 배경, 연한 살구→부드러운 주황 `RAMP`, 얇은 두께(DEPTH 9)·살구색 옆면, 지역 사이 굵은 흰 경계선, 은은한 광택(`#bevel` k3 .35), 진한 브라운 지역명. 이미지를 통째로 붙이면 누르기·디저트별 색이 안 돼서 SVG로 재현
- 지도: `KOREA`(시도 SVG 경로, 광주+전남은 '전남광주'로 합침. 불러온 뒤 지역마다 가장 큰 땅만 남김(제주 포함, 섬 모두 뺌). 해안선은 `#goo` 필터(흐림→투명도 문턱으로 둥근 바탕 + 원래 그림을 그 안에만 겹침)로 둥글게, 안쪽 경계는 그대로 선명), `mapSelect(k, r)`, 색 `RAMP`/`SIDE`
- Chart.js 4.4.1 (cdnjs). 차트 선명도용 `Chart.defaults.devicePixelRatio = 2`

## Cloudflare Worker (worker/)
- 주소: https://dessert-timing.yhr9232.workers.dev (CORS는 hyeran712.github.io와 localhost만 허용)
- **배포: `worker/` 아래를 main에 푸시하면 `.github/workflows/deploy-worker.yml`이 wrangler 4로 자동 배포** (대시보드에 붙여넣지 않음)
- GitHub Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SERVICE_KEY`(공공데이터포털, 주간 레이더용)
- Worker 비밀 변수(대시보드에서 관리, `keep_vars = true`라 배포해도 유지): `NAVER_ID`, `NAVER_SECRET`(NAVER API HUB 검색어 트렌드 — 검색광고 API 아님), `DATA_GO_KEY`, `GEMINI_KEY`, `GEMINI_MODEL`(gemini-3.8-flash)
- Gemini는 홍콩(HKG)에서 막혀서 `GeminiProxy` Durable Object(locationHint 'wnam')를 거쳐 호출한다. 확인: `/where` → `gemini`가 미국 공항 코드면 정상
- 503/429면 재시도 후 `gemini-flash-latest` → `gemini-flash-lite-latest`로 넘어감
- `PRICE`: 사용자의 카페 원가표 [재료단가] 시트 단가 + 디저트 재료(2026-11-04 식봄 판매가). 생딸기·포장용기·얼음·빨대는 예시값. `ALIAS`로 재료 이름을 맞춤
- 엔드포인트: `GET /trend?q=`, `GET /shops?q=&src=cafe|bakery&page=`, `GET /volume?q=`, `POST /menu`, `GET /where`
- `/volume`: 네이버 검색광고 API `keywordstool`(최근 한 달 PC·모바일 검색 수 + 연관 키워드 20개). 비밀 변수 `NAVER_AD_KEY`(액세스라이선스), `NAVER_AD_SECRET`(비밀키), `NAVER_AD_CUSTOMER`(CUSTOMER_ID)가 필요 — 2026-11-05 등록 완료(소금빵 월 26,640회 확인). 레이더 화면 `#opp`(renderOpportunity)가 디저트별 /volume 합계 ÷ 영업 중 매장으로 "가게당 검색 수" 순위를 보여 준다 (VOL_TERMS: 붕어빵=붕어빵+잉어빵)
- `/kamis`: KAMIS 농산물유통정보 Open API `dailySalesList`(최근일자 도·소매 가격, dpr1 당일·dpr3 1개월 전·dpr4 1년 전)에서 디저트 재료(`KAMIS_WANT`)만 골라 반환, 12시간 캐시. `?all=1`은 전체 품목. 비밀 변수 `KAMIS_KEY`(인증키)·`KAMIS_ID`(신청 아이디). 2026-11-06 추가. 신메뉴 원가는 `marketPrices()`로 소매 시세를 g·ml·개당 단가로 바꿔 씀: 단가 우선순위 내 원가표 → KAMIS 시세(단위 같을 때) → 원가표 예시값 → AI 추정. 결과 카드에 'KAMIS 시세 (날짜)' 초록 꼬리표, 한 달 새 ±10% 이상 표시, +15% 이상은 '오른 재료' 경고
- 이 작업 환경(클라우드)에서는 workers.dev와 data.go.kr에 직접 접속이 안 될 수 있다 → 사용자가 브라우저로 확인하거나, 테스트용 복사본에서 Playwright로 응답을 흉내 낸다

## 우리 동네 리포트 데이터
- `live/district.json`: `scripts/district.py`가 행정안전부 인허가 **전체 데이터**(휴게음식점+제과점 원본 CSV)로 만든 시군구 255곳 통계 (기준일 2026-11-02)
- 카페·디저트 = 커피숍·과자점·아이스크림·전통찻집·떡카페·기타 휴게음식점·제과점 (PC방·편의점·운동시설 등 이름으로 제외), 90일 안에 닫은 곳은 팝업으로 따로
- 지표: 영업 중 수·순위, 최근 1년 개업/폐업(팝업 제외), 3년 생존율, 폐업 가게 영업 기간 중앙값, 디저트 키워드별 매장 수(전국 비율 대비 빈자리/많음), 최근 6개월 새 가게 이름 단어
- 아직 주간 자동 갱신 안 됨 (원본 전체 파일이 저장소에 없음). 갱신하려면 원본 CSV를 받아 `python scripts/district.py 휴게음식점.csv 제과점.csv`

## 주간 레이더 (GitHub Actions)
- `.github/workflows/weekly-radar.yml`: 매주 월요일 08:23(한국 시간) `scripts/update.py` 실행 → `live/` 커밋
- 행정안전부 인허가 API(휴게음식점 `rest_cafes`, 제과점 `bakeries`)에서 `DAT_UPDT_PNT` 이후 바뀐 가게를 받아 매장 수·시도별 통계(`regions`)·가게 이름 경보를 다시 계산
- 디저트 10종: 노트북 7종 + 소금빵·붕어빵(잉어빵 포함)·땅콩빵(2026-11-05 추가). 붕어빵·땅콩빵은 검색량 분석(data.json)에 없어서 레이더에만 나온다. `KW`에 새 디저트를 넣으면 다음 실행 때 상호 LIKE 검색으로 과거 가게까지 한 번 받고 `state.json`의 `backfilled`에 기록
- 소금빵 매장 통계는 2026-11-05 과거 가게를 받은 뒤 노트북과 같은 방식(검색 피크 주 기준 전/후, 1년 내 폐업은 30곳 이상일 때만)으로 계산해 `src/data.json`의 `shops`에 넣었다 (노트북 자체는 7종 그대로). 붕어빵·땅콩빵처럼 data.json에 없는 디저트는 화면이 live.json으로 `D.shops[k]`를 만든다
- 시도별 `regions`의 open/close 목록은 [가게 이름, 날짜, 팝업 일수(90일 안에 닫았으면 영업 일수, 아니면 0)] → 지도 팝업창에 '팝업 N일' 꼬리표. po30·pc30·po90·pc90 = 30·90일 개업·폐업 중 팝업 수 → '팝업 N곳 포함'
- 손으로 다시 계산만: `python scripts/update.py --offline` (이때 `live/state.json` 변경은 커밋하지 않기)

## 분석 방법 요약 (README·About data와 일치시킬 것)
- 네이버 데이터랩 주간 검색량 2016.01~2026.10, 기준 키워드 '디저트'로 6개 조회를 하나로 맞춤
- 13주 이동평균, 상승 기간(피크 25%→피크), 반감기(피크→50%), 현재 수준(최근 13주÷피크), 전년 대비(최근 13주 vs 작년 같은 13주)
- 유형: 진행중(최근 13주 안 피크) / 시즌형(월별 차이 2.5배 이상) / 유행형(<10%) / 정착형(≥25%) / 관망형
- '모찌'는 데이터랩에서 0으로 나와 모찌떡·찹쌀모찌·과일모찌를 합산
- 매장: 상호에 키워드가 들어간 인허가 가게, 90일 안에 닫은 곳은 팝업으로 분류

## 커밋
- 커밋 작성자는 `Claude <noreply@anthropic.com>`
- 커밋 메시지는 한국어로, 무엇을 바꿨는지 한 줄

## 다음에 할 수 있는 일 (사용자와 이야기한 것)
- (나중에) v1 파일·링크 정리 — 사용자가 말할 때까지 그대로
- 포트폴리오 카드 사진 교체본은 `hyeran712.github.io`의 `claude/confident-davinci-cb9r7f` 브랜치에 올려 둠 (main 반영은 사용자 확인 후)
- 동네 리포트를 주간 자동 갱신으로 (radar_base처럼 바뀐 가게만 반영)
- 포트폴리오 메인(`hyeran712.github.io`)의 디저트 타이밍 카드 이미지를 새 디자인으로 교체
- **포트폴리오 카드 글은 사이트가 완성된 뒤 맨 마지막에 바꾼다 (사용자 결정 2026-11-05).** 합의한 초안:
  - 한 줄: "신메뉴, 언제 내고 언제 접을까? 데이터로 답하는 F&B 기획 도구"
  - 소개: 21종 10년 검색량 + 인허가 72만 건 분석 → 사장님이 **판단 → 확인 → 실행**까지 한 화면에서
  - 주요 구현 대신 세 단계 상자: 1 판단(5가지 유행 단계 진단·출시 전략) / 2 확인(주간 매장 레이더 + 시군구 255곳 동네 리포트) / 3 실행(AI 신메뉴·레시피 + 식자재 단가 원가율 검증)
  - 기능을 하나하나 나열하지 않기 (보관함·3D 지도·실시간 검색 등은 카드에 안 씀). 숫자 3개(10주 vs 48주, 2.6배, +187%)는 유지
- 네이버 검색광고 API(월간 검색 수)를 붙여 "검색 수 대비 매장이 부족한 디저트", 연관 키워드로 신메뉴 형태 찾기
- 원가표에 디저트 재료 단가 계속 추가 (생딸기·포장용기 실제 가격으로)
- (마무리 작업) 저장된 메뉴를 모아 보기: Supabase 또는 기존 Worker + Cloudflare D1로. 연결 전 localStorage 보관함은 각 브라우저에만 있어 모이지 않음 → 연결 시점부터 집계. 로그인 없이 익명 집계면 개인정보 안내 최소화
