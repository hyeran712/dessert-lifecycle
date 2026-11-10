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
- 예전 버전(한 페이지형, 비교용): https://hyeran712.github.io/dessert-lifecycle/v1.html — 새 버전으로 결정(2026-11-05). 맨 아래 v1·GitHub 링크는 2026-11-09 사용자 요청으로 뺌(푸터 = 짧은 데이터 출처 · 개인정보 처리방침 · 데이터 자세히). v1.html 파일은 남아 있음. **푸터 정리(2026-11-10)**: `© 2026 디저트 타이밍 · 개인정보처리방침 · 데이터 출처(눌러서 About data 창) · 문의`. 문의 연락처는 저장소 루트 **`site-config.js`의 `SITE_CONTACT` 한 곳**만 고치면 푸터와 privacy.html 문의란에 같이 채워짐(메일 주소면 mailto 링크, https 주소면 링크, 비어 있으면 '준비 중')
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
img/menu/        디저트 사진 30장(망고빙수 `mango-bingsu.webp`는 8월용, 검색 흐름은 빙수 데이터를 그대로 쓰고 누르면 빙수 진단) — 아래 29장 설명은 대목용 7장 기준(2026-11-10 대목용 7장 추가: 빙수·크리스마스 케이크·딸기 케이크·발렌타인 초콜릿·고구마 라떼·몽블랑·카네이션 떡케이크, 피사체를 가운데로 모으고 가장자리 색을 늘려 여백을 둬서 시계 동그란 틀에서 안 잘림) (사용자가 AI로 만든 크림 배경 이미지 → 480px webp). app.js `IMG`·`photo(k)`로 대표 카드·추천 카드·사이드바에 씀
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
- 위쪽 바: 로고(사용자가 AI로 만든 바늘 없는 디저트 나무 시계 이미지 `img/brand/logo-clock.webp` 위에 SVG 나무 바늘(끝 주황, 11시 고정, 처음 열 때 째깍 들어오는 `.lm-tick` 애니메이션) + '디저트 타이밍', 파비콘 `img/brand/favicon.png`·apple-touch-icon도 같은 그림) · [메뉴 개발] [이번 주 레이더] [동네 리포트] · 오른쪽 [로그인] `#auth-btn`. About data는 2026-11-09 위쪽에서 빼고 푸터 '데이터 자세히'로. '내 가게' 칸은 2026-11-05 뺐음. 휴대폰(640px 이하)에서는 메뉴가 화면 아래 고정 바
- 알림 띠 `#notice`(이번 주 레이더 요약)는 2026-11-10 사용자 요청으로 통째로 뺌
- `#view-flow`: 3단계 흐름. 단계 꼬리표 `#ph-tag`, 제목 `#ph-title`, 표시줄 `#stepper`
  - 1단계 `[data-panel="1"]#diagnose`: 대표 디저트 카드 `#picks`, 검색 `#q-form`, 전체 목록 `#chips`
  - 2단계 `[data-panel="2"]#findings`: 판정 `.result`, 그래프 `#c-main`, 핵심 발견 ①~④, 과일모찌 사례 `#case-mochi`
  - 3단계 `[data-panel="3"]#proposal`: 목적 카드 `#goals`, 기획 카드 `#p-plan`(맨 끝 '내 가게' 옆에 **시장가 카드 `#pl-mkt`**(2026-11-09): `fillPlanMarket(k)`가 /price로 다른 카페 보통·대부분 범위·동네 카페 가격 + 판매가 칸 `#pl-price`(시장가로 채움)·'원가율 30%면 재료비 ○원' → [이 가격으로 메뉴 짜기] `#pl-go`가 `PICK_PRICE[k]`에 넣고 바로 makeMenu. `menuPrice()`는 PICK_PRICE 우선. renderPlan 안에서는 `esc`·MKT_CACHE가 TDZ라 setTimeout으로 부름), 내 가게 프로필 `#profile`, 요청사항 `#mk-note`, 신메뉴 버튼 `#mk-btn`, 결과 `#mk-out`, 전략표 `#p-table`
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
- 대목 달력(app.js): `ANNUAL`(매년 같은 날)은 올해·내년 날짜를 자동 생성, 수능은 `suneung(y)`=11월 셋째 목요일, 설·추석은 `live/holidays.json`(주간 레이더가 공공데이터 '한국천문연구원 특일 정보'에서 올해~2년 뒤를 받아 저장, 실패 시 기존 값 유지, 파일이 없으면 코드의 `LUNAR` 기본값). `upcoming(k)`로 70일 안 대목을 결론 카드 '언제' 줄(유행형은 '대목' 줄)과 추천 점수(+1)에 씀. 손으로 날짜 고칠 필요 없음 **2026-11-10**: ANNUAL에 할로윈(10/31)·발렌타인 초콜릿·카네이션 케이크·크리스마스 케이크·딸기 케이크 등 새 디저트를 걸었고, 복날(초복·중복·말복)은 `bokdays(y)`가 경일(庚日)로 계산(2023~2026 실제 날짜와 일치 확인, 빙수·요거트 아이스크림). (밤 디저트는 추석에 안 걸고 `MD_ALSO`로만 9월에 반영)
- **내 원가표**(2026-11-09): 3단계 프로필 아래 `#mycost`. localStorage `dessert-timing-costs` = {재료: {unit g|ml|개, price 단위당 원, buy '450g 8,900원'}}. 재료·산 양(g/kg/ml/L/개)·산 가격 → `unitPrice()`가 단가 계산, 엑셀 붙여넣기 `parseCostLine()`('버터⇥450g⇥8900', '우유, 1L, 2800'), 결과 표 단가 `.up-edit` 눌러 고치면 저장+즉시 재계산(`showMenu(m)`로 다시 그림). makeMenu가 `myPrice`로 보내면 Worker `cleanMy()`·`findMy()`(이름·별칭·포함)로 **단위가 같을 때** 가장 먼저 씀 → 출처 '내 원가표'(노란 꼬리표), AI 프롬프트에도 '우리 가게' 단가로 앞에 넣음. 아직 브라우저마다 따로(로그인 붙이면 서버 저장)
  - **구글 시트 연결·엑셀 올리기**(2026-11-09): `.mc-link`. 시트 주소 → localStorage `dessert-timing-sheet` {url,id,gid} → Worker `GET /sheet?id=&gid=&fresh=`(export CSV, 5분 캐시, 링크 공유 안 되면 `need:'share'`; 열린 탭에 '재료' 머리줄 없으면 gviz로 [재료단가]·원가표·단가 탭을 이름으로 찾음) → `rowsToCosts()`(머리줄에서 재료·구매가·구매용량·단위·단위당 단가·구매 상품 열 찾기) → `applyCosts(list,'sheet')`. 페이지 열 때와 makeMenu 직전(최대 6초)에 `syncSheet()` — 시트를 고치면 자동 반영, 같은 이름이면 시트 값이 이김. 엑셀(.xlsx는 SheetJS 0.18.5 cdnjs를 그때 불러옴, [재료단가] 탭 우선)·.csv는 올릴 때 한 번 `applyCosts(list,'file')`. 목록에 '시트'·'파일' 꼬리표
  - **예시 시트**: 사용자가 만든 '카페 운영 시트 …-포트폴리오 공유용'(원가·레시피·재고·발주·AI 재고 조언, 링크 공개)을 사용자 결정(2026-11-09)으로 '사본 만들기'(`/copy`)·'예시 보기' 링크에 씀. 주소는 body.html `.mc-link`. 이 시트 [재료단가]는 12개(디저트 재료 없음). 처음 만든 '디저트 타이밍 예시 원가표'(24개)는 링크에서 뺐고 드라이브에 남아 있음
- `esc`는 function 선언(2026-11-09): const였을 때 renderPlan·renderMyCost가 선언 전에 불러 TDZ 오류로 화면 코드가 멈췄음
- 내 가게 프로필은 localStorage `dessert-timing-profile` (이름 name, 분야 cat, 장비 eq, 가격대 price, 금기 재료 ban)
- 1단계 맨 위 `#dclock` 디저트 시계(2026-11-10 점수제로 바꿈): `clockPlan()`이 12달마다 후보 전부(D.kw 중 사진 있는 것 + 붕어빵 `SEASON_PRIOR`)를 `monthScores(i)`로 점수 매겨 **TOP 3**를 뽑고(한 디저트가 여러 달에 나올 수 있음, `FAMILY` 같은 종류는 TOP 3에 하나만), 시계 칸 사진 = 달마다 1등, 오른쪽 카드 = 이번 달 TOP 3 + 한 줄 이유(`dkWhy`: 점수를 많이 준 이유 3개) + '다음 달 준비'(다음 달 1등, 그 대목까지 또는 다음 달까지 ○일 남았어요 · 재료·사진 미리 준비). 점수 = ① 그 달 `season` 배수(2×log2, 상한 2.5) ② 유행 단계(`TYPE_PTS`: 진행중 +1·정착형 +0.7·유행형 −1) ③ 전년 대비(yoy÷200, ±0.5, `cal` 디저트는 제외) ④ 그 달 대목 `EVENTS`(건당 +0.8, 최대 2건) ⑤ 재료값 KAMIS(`/kamis`로 한 달 새 변화, `DESSERT_ING` 매핑, 이번·다음 달만, −10% 이하 +0.8·−5% 이하 +0.4·+15% 이상 −0.5) ⑥ 레이더 '가게당 검색'(`renderOpportunity`가 `OPP`에 순위를 넣고 시계 다시 그림, 1~3위 +0.8·4~6위 +0.4) ⑦ 내 가게 프로필(장비 맞으면 +0.8, 가격대 맞으면 +0.4, `saveProfile`이 시계 다시 그림) ⑧ 사용자가 정한 월별 표(`MD_TOP` 대표 +3·`MD_ALSO` 같이 팔기 +0.5 — 대표가 사실상 1등을 정하고 2·3등과 이유는 데이터가 정함. 6월 요거트 아이스크림·7월 빙수·8월 망고빙수는 사용자 요청 2026-11-10). 점수 설명은 카드 아래 `.dk-how` 작은 글씨. 새로 불러온 데이터(KAMIS·OPP·설추석 날짜)가 오면 `refreshClock()`. 사진 없으면 `DK_EMO` 이모지. 누르면 D.kw에 있으면 select+2단계, 없으면 analyzeLive. 결과 예(2026-11-10): 11월 찹쌀떡·크리스마스 케이크·붕어빵, 12월 크리스마스 케이크. 그 아래
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
- **모델 순서(2026-11-09 바꿈)**: `FAST_MODEL`(gemini-flash-lite-latest) 먼저 → 실패할 때만 `GEMINI_MODEL`(3.8-flash) → `gemini-flash-latest`. 측정: lite 2~4초, flash-latest 37초~실패, 3.8-flash 40초 넘음(사용자 화면에 'Gemini 오류 524' = Cloudflare 100초 초과). 한 번 부를 때 40초 제한(`GeminiProxy`가 `x-timeout`으로 끊고 504), 신메뉴 전체 90초 안(시간 모자라면 원가율 재조정 생략), `thinkingConfig.thinkingLevel:'low'`(모르는 모델이면 400 → 빼고 재시도). 결과의 `ai`·`tries[].ai`에 모델·걸린 초가 남음. 속도 비교는 /menu body에 `model`(정해 둔 모델만). lite는 배합을 빠뜨리기 쉬워 프롬프트에 '이름 속 재료·빵은 강력분·이스트·소금, 원가표에 없어도 맞는 재료' 규칙을 넣음. 강력분·이스트·소금은 원가표에 없어 'AI 추정' 단가
- `PRICE`: 사용자의 카페 원가표 [재료단가] 시트 단가 + 디저트 재료(2026-11-04 식봄 판매가). 생딸기·포장용기·얼음·빨대는 예시값. `ALIAS`로 재료 이름을 맞춤
- 엔드포인트: `GET /trend?q=`, `GET /shops?q=&src=cafe|bakery&page=`, `GET /volume?q=`, `POST /menu`, `GET /where`
- `/volume`: 네이버 검색광고 API `keywordstool`(최근 한 달 PC·모바일 검색 수 + 연관 키워드 20개). 비밀 변수 `NAVER_AD_KEY`(액세스라이선스), `NAVER_AD_SECRET`(비밀키), `NAVER_AD_CUSTOMER`(CUSTOMER_ID)가 필요 — 2026-11-05 등록 완료(소금빵 월 26,640회 확인). 레이더 화면 `#opp`(renderOpportunity)가 디저트별 /volume 합계 ÷ 영업 중 매장으로 "가게당 검색 수" 순위를 보여 준다 (VOL_TERMS: 붕어빵=붕어빵+잉어빵)
- `/kamis`: KAMIS 농산물유통정보 Open API `dailySalesList`(최근일자 도·소매 가격, dpr1 당일·dpr3 1개월 전·dpr4 1년 전)에서 디저트 재료(`KAMIS_WANT`)만 골라 반환, 12시간 캐시. `?all=1`은 전체 품목. 비밀 변수 `KAMIS_KEY`(인증키)·`KAMIS_ID`(신청 아이디). 2026-11-06 추가. 신메뉴 원가는 `marketPrices()`로 소매 시세를 g·ml·개당 단가로 바꿔 씀: 단가 우선순위 내 원가표 → KAMIS 시세(단위 같을 때) → 원가표 예시값 → AI 추정. 결과 카드에 'KAMIS 시세 (날짜)' 초록 꼬리표, 한 달 새 ±10% 이상 표시, +15% 이상은 '오른 재료' 경고
- `/price?q=&area=`: 다른 카페 판매가. 네이버 **블로그 검색 API**(2026-11-09 확인: 검색 API도 NAVER API Hub로 옮겨 감 → `https://naverapihub.apigw.ntruss.com/search/v1/blog`, 트렌드와 같은 `NAVER_ID`·`NAVER_SECRET`, 콘솔에서 '검색' 상품 이용 신청만 하면 됨. 예전 developers 키 `NAVER_SEARCH_ID`·`SECRET`가 있으면 그걸 먼저 씀)로 '소금빵 가격' 후기 최대 500개를 받아, 키워드 바로 뒤 '○,○○○원'만 뽑음(2개·세트·배송 등은 뺌, 1천~2만 원, 사분위 밖 이상값 제거) → 최근 1년 보통 가격(중앙값)·대부분 범위·후기 5개. 2026-11-09 작동 확인(소금빵: 후기 500개 중 가격 44개, 보통 3,500원·대부분 3,000~3,900원). 키 권한이 없으면 401/403 → 화면에 '준비 중'. 화면: 신메뉴 결과 카드 `.mkt` 가격 비교(`mktHTML`·`fillMarket`) = 원가 기준 최소가(원가÷목표 원가율) · 다른 카페 보통 · 동네 카페 보통(동네 리포트에서 마지막으로 본 시군구, '강남') · 내 목표가 + 한마디
- `/brands?q=`: 브랜드 찾기(2026-11-09). 검색광고 연관 키워드는 새 디저트(두쫀쿠 등)엔 0개라 방식을 바꿈 → ① 지역 검색(`naverSearch()`, 블로그 검색과 같은 키, `sort=comment`)으로 전국+`BR_AREAS` 11곳에서 그 디저트를 파는 카페·디저트 가게 수집(+연관 키워드 '○○+디저트' 꼴) ② 가게 이름(`brandOf`로 '○○점' 뗌, 앞 1·2단어도) 월간 검색 수를 `adVolumes()`(키워드 도구 5개씩)로 재서 TOP 5, 대형 체인·편의점(`BIG_CHAIN`) 제외 ③ 검색어 트렌드로 `lead`·`now` ④ 인허가 영업 중 매장 수. 하루 캐시 키에 `BRANDS_VER`, 지역 검색 실패(`verified:false`) 결과는 캐시 안 함, 화면은 그때 상자를 숨김. 처음엔 지역 검색이 401('이 Application에서 활성화되어 있지 않습니다')이라 사용자가 네이버 콘솔에서 '지역'을 켬 → 2026-11-09 작동 확인(소금빵: 성심당·안스베이커리·궁전제과…, 두쫀쿠: ETF베이커리·하얀풍차제과점…). 오판 막는 규칙: 이름은 끝의 동네 이름·앞의 '카페'만 떼서도 재고(앞 단어만 떼면 '클래식' 같은 흔한 낱말이 1등), 두 글자 이름 제외, 이름 검색 수가 디저트 검색 수 20배와 30만 회를 둘 다 넘으면 제외(동명이인 '한정선' 110만 회), 2년 조회 첫 주부터 25% 넘은 가게는 '○주 먼저 뜸' 안 씀. 원인 볼 때는 `&debug=1`
- 이 작업 환경(클라우드)에서는 workers.dev와 data.go.kr에 직접 접속이 안 될 수 있다 → 사용자가 브라우저로 확인하거나, 테스트용 복사본에서 Playwright로 응답을 흉내 낸다

## 사용량 제한·사용 기록·통계 (2026-11-09)
- Worker `Stats` Durable Object(SQLite, wrangler.toml migration v2, 바인딩 `STATS`, 인스턴스 하나 'stats-v1'): `hits`(날짜·사람·종류별 횟수), `events`(익명 사용 기록)
- **하루 한도** `LIMITS` = 신메뉴 10 · 검색류(/trend·/volume·/brands·/price·/shops, 캐시에서 나간 건 안 셈) 60(2026-11-10에 30에서 올림) · 시트 읽기(/sheet 캐시 밖) 10 (사용자 결정 2026-11-09). 사람 = `CF-Connecting-IP`를 `STATS_SALT`(없으면 기본값)와 해시한 앞 16자리. 넘으면 429 `{limit:true}` → 화면 '⏳ 오늘 … 다 썼어요'
- **익명 기록**: 화면 `track(type,k,goal,v)`가 `navigator.sendBeacon(POST /event)`. UID = localStorage `dessert-timing-uid` 무작위. 종류 `EVENT_TYPES`: visit(하루 1번)·select·step(앞으로 갈 때)·menu_save·menu_again·like·dislike(결과 카드 `#mk-fb`)·file·pdf·price_pick·rec·local·cost_edit. Worker가 직접 남기는 것: menu(이름·원가율·초·모델·내 원가표 수)·menu_fail·sheet(fresh 연결)·limit
- **주인**: Worker 비밀 변수 **`STATS_KEY`**(대시보드에서 사용자가 넣음). `stats.html`(저장소 루트, noindex, build.sh와 상관없음)에서 열쇠를 넣으면 `GET /stats`(헤더 X-Stats-Key)로 요약을 보고, localStorage `dessert-timing-owner`에 저장 → 그 브라우저는 X-Owner-Key로 한도 없음·기록 안 함
- **로그인(2026-11-09)**: Supabase 프로젝트 `dessert-timing`(조직 '젠지표류기', 서울, automatic RLS 켬, 새 표 자동 공개 끔). URL·publishable 키는 app.js 끝 `SB_URL`/`SB_KEY`와 worker `SB_URL`/`SB_PUBLISHABLE`(공개용). **service_role 키·DB 비밀번호는 코드·채팅에 절대 X**
  - 구글: Google Cloud 프로젝트 `dessert-timing` OAuth 웹 클라이언트(원본 hyeran712.github.io·localhost:8765, 리디렉션 `…supabase.co/auth/v1/callback`) → Supabase Google provider에 넣음. Supabase URL Configuration: Site URL·Redirect URLs(`…/dessert-lifecycle/**`, `http://localhost:8765/**`)
  - 카카오(2026-11-09 작동 확인): developers.kakao.com 앱 '디저트 타이밍' — 카카오 로그인 ON, 앱→플랫폼 키→REST API 키에 리다이렉트 URI·클라이언트 시크릿, 개인 개발자 비즈 앱 전환(목적 '이메일 필수 동의') 후 동의항목 닉네임 필수·프로필 사진 선택·이메일 선택 → Supabase Kakao provider(이메일 없는 사용자 허용). Supabase 기본 scope에 account_email이 있어 이메일 항목을 안 켜면 KOE205. 첫 구글 로그인 때 'Database error saving new user'(users_email_partial_key 중복, /callback이 동시에 여러 번)가 한 번 났고 다시 하니 됨
  - 구글 OAuth 앱이 '테스트' 상태면 테스트 사용자만 로그인됨 → Google 인증 플랫폼 → 대상 → [앱 게시] 필요
  - 표: `supabase/schema.sql`(user_data 한 줄: profile·costs·sheet / saved_menus: local_id 기준 / RLS 본인만 / `delete_my_account()` 탈퇴) — 사용자가 SQL Editor에서 실행
  - 화면: 위쪽 `#auth-btn`·`#acct` 창. 로그인하면 `cloudSync()`가 서버+브라우저를 합침(원가표는 같은 재료면 서버 값), 이후 saveMenu·삭제·storeMy·saveProfile·시트 연결이 `cloudSoon`/`cloudAddMenu`/`cloudDelMenu`로 서버에도 저장. 로그인 상태면 `/menu`에 Bearer 토큰 → Worker `userOf()`가 Supabase `/auth/v1/user`로 확인해 **사람별 한도**, 기록 uid는 'u'+사용자 id 앞부분. `privacy.html` 개인정보 처리방침(문의 연락처는 `site-config.js`의 `SITE_CONTACT`, 아직 비어 있음)

## 우리 동네 리포트 데이터
- `live/district.json`: `scripts/district.py`가 행정안전부 인허가 **전체 데이터**(휴게음식점+제과점 원본 CSV)로 만든 시군구 255곳 통계 (기준일 2026-11-02)
- 카페·디저트 = 커피숍·과자점·아이스크림·전통찻집·떡카페·기타 휴게음식점·제과점 (PC방·편의점·운동시설 등 이름으로 제외), 90일 안에 닫은 곳은 팝업으로 따로
- 지표: 영업 중 수·순위, 최근 1년 개업/폐업(팝업 제외), 3년 생존율, 폐업 가게 영업 기간 중앙값, 디저트 키워드별 매장 수(전국 비율 대비 빈자리/많음), 최근 6개월 새 가게 이름 단어
- `recent`는 [가게 이름, 날짜, 동 이름] (district.py `dong_of`; 2026-11-06 기존 파일은 radar_base 주소로 채움)
- 아직 주간 자동 갱신 안 됨 (원본 전체 파일이 저장소에 없음). 갱신하려면 원본 CSV를 받아 `python scripts/district.py 휴게음식점.csv 제과점.csv`

## 주간 레이더 (GitHub Actions)
- `.github/workflows/weekly-radar.yml`: 매주 월요일 08:23(한국 시간) `scripts/update.py` 실행 → `live/` 커밋
- 행정안전부 인허가 API(휴게음식점 `rest_cafes`, 제과점 `bakeries`)에서 `DAT_UPDT_PNT` 이후 바뀐 가게를 받아 매장 수·시도별 통계(`regions`)·가게 이름 경보를 다시 계산
- 디저트 10종: 노트북 7종 + 소금빵·붕어빵(잉어빵 포함)·땅콩빵(2026-11-05 추가). 붕어빵·땅콩빵은 검색량 분석(data.json)에 없어서 레이더에만 나온다. `KW`에 새 디저트를 넣으면 다음 실행 때 상호 LIKE 검색으로 과거 가게까지 한 번 받고 `state.json`의 `backfilled`에 기록
- 소금빵 매장 통계는 2026-11-05 과거 가게를 받은 뒤 노트북과 같은 방식(검색 피크 주 기준 전/후, 1년 내 폐업은 30곳 이상일 때만)으로 계산해 `src/data.json`의 `shops`에 넣었다 (노트북 자체는 7종 그대로). 붕어빵·땅콩빵처럼 data.json에 없는 디저트는 화면이 live.json으로 `D.shops[k]`를 만든다
- 시도별 `regions`의 open/close 목록은 [가게 이름, 날짜, 팝업 일수(90일 안에 닫았으면 영업 일수, 아니면 0)] → 지도 팝업창에 '팝업 N일' 꼬리표 (close 목록은 네 번째 값으로 개업일도 넣어 '팝업 24일 · 07.16 개업'). po30·pc30·po90·pc90 = 30·90일 개업·폐업 중 팝업 수 → '팝업 N곳 포함'. 신고 변경(mark_change): 같은 시도·같은 이름(주소를 알면 건물 주소까지)으로 폐업일 앞뒤 7일 안에 다시 연 곳 → 개업·폐업 숫자와 목록에서 빼고 `changed` 목록에 '신고 변경'으로 한 줄. 목록마다 마지막 값은 동네 이름(`area_of`: radar_base 주소에서 '광명시 소하동'), 2025년 이전 개업은 주소가 없어 관리번호 앞 7자리(시군구 코드)로 시군구 이름만
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
- **판매 시작 시 (2026-11-10 사용자 요청, 지금은 일부러 안 넣음)**: 이용약관 페이지 + 푸터에 사업자 정보(상호·대표자·사업자등록번호·주소·연락처·통신판매업 신고번호). 문의 연락처(`site-config.js`)도 이때 같이 정하기
- **판매·배포 전에 할 일 (2026-11-06 사용자가 미리 말해 둠, 아직 시작 안 함)**
  - API 사용량 제한: 2026-11-09 IP별 하루 한도로 1차 완료(위 '사용량 제한' 참고). 로그인 뒤 사람별로 바꾸기
  - 로그인 페이지 만들기: 구글 로그인 + 카카오 로그인. 로그인하면 사용량 제한·보관함 동기화·사장님별 원가표와도 연결
  - 응답이 너무 느림 → AI(API)를 더 빠른 것으로 바꾸거나 속도 개선 검토 (특히 신메뉴 만들기)
- **유동인구 데이터 (2026-11-06 이야기, 아직 시작 안 함)**: 전국 무료로 동 단위 진짜 유동인구는 거의 없음(통신사·카드사는 유료). 그래서 무료 전국 데이터 3개를 합쳐 시군구 255곳을 **방문자형/직장인형/주거형**으로 나눠 동네 리포트에 한 줄 실행 팁으로 넣기로 제안함
  - 한국관광공사 관광 데이터랩 지역 방문자 수(시군구·월별), 통계청 SGIS 사업체·종사자 수, 통계청 주민등록 인구
  - 예: "강남구는 직장인형 → 평일 점심 테이크아웃 디저트", "마포구는 방문자형 → SNS 인증용 메뉴"
  - 서울은 나중에 서울 열린데이터광장 생활인구(행정동·시간대별, 무료 API)로 보강. 전국 정밀 데이터는 판매 단계에서 통신사 유료 데이터 검토
  - **먼저 할 일**: 각 데이터가 API로 받아지는지·신청 방법 확인 (아직 확인 못 함)
- 결과 저장·공유: 신메뉴 결과·동네 리포트를 이미지로 저장하거나 카톡으로 보내기
- 사장님마다 자기 원가표: 2026-11-09 브라우저 저장 '내 원가표'로 1차 완료. 남은 것: 로그인 후 서버 저장·여러 기기, 원가표 파일(엑셀) 통째로 올리기
- (나중에) v1.html 파일 정리 — 링크는 2026-11-09에 뺌, 파일 삭제는 사용자가 말할 때
- 포트폴리오 카드 사진 교체본은 `hyeran712.github.io`의 `claude/confident-davinci-cb9r7f` 브랜치에 올려 둠 (main 반영은 사용자 확인 후)
- 동네 리포트를 주간 자동 갱신으로 (radar_base처럼 바뀐 가게만 반영)
- 포트폴리오 메인(`hyeran712.github.io`)의 디저트 타이밍 카드 이미지를 새 디자인으로 교체
- **포트폴리오 카드 글은 사이트가 완성된 뒤 맨 마지막에 바꾼다 (사용자 결정 2026-11-05).** 합의한 초안:
  - 한 줄: "신메뉴, 언제 내고 언제 접을까? 데이터로 답하는 F&B 기획 도구"
  - 소개: 21종 10년 검색량 + 인허가 72만 건 분석 → 사장님이 **판단 → 확인 → 실행**까지 한 화면에서
  - 주요 구현 대신 세 단계 상자: 1 판단(5가지 유행 단계 진단·출시 전략) / 2 확인(주간 매장 레이더 + 시군구 255곳 동네 리포트) / 3 실행(AI 신메뉴·레시피 + 식자재 단가 원가율 검증)
  - 기능을 하나하나 나열하지 않기 (보관함·3D 지도·실시간 검색 등은 카드에 안 씀). 숫자 3개(10주 vs 48주, 2.6배, +187%)는 유지
- **새 디저트 7종 검색량(2026-11-10 완료)**: 크리스마스 케이크·딸기 케이크·발렌타인 초콜릿·빙수·고구마 디저트·밤 디저트·카네이션 케이크를 `node scripts/add_kw.mjs`(Worker `/trend` 사용, 주인 열쇠는 터미널 환경변수 `OWNER_KEY`로만)로 받아 `src/data.json` kw에 `cal:true`로 넣음. 화면의 lifecycle() 그대로, 각자 피크=100 기준이라 기존 21종과 크기 비교는 안 됨(기존 순위·평균 비교에서는 `cal`이라 뺌). 계절 차이 2.5배 이상이면 비수기에 낮아 보여도 '시즌형'. 월별 최대: 크리스마스 케이크 12월 9.0배·딸기 케이크 12월 3.2배·발렌타인 초콜릿 2월 8.7배·빙수 7월 2.8배·고구마 10월 2.4배·밤 10월 3.4배·카네이션 케이크 4월 5.7배/5월 5.4배. Worker 검색류 하루 한도는 2026-11-10 개발·테스트 중 걸려서 30→60으로 올림(판매 전에 다시 정할 것)
- 네이버 검색광고 API(월간 검색 수)를 붙여 "검색 수 대비 매장이 부족한 디저트", 연관 키워드로 신메뉴 형태 찾기
- 원가표에 디저트 재료 단가 계속 추가 (생딸기·포장용기 실제 가격으로)
- (마무리 작업) 저장된 메뉴를 모아 보기: Supabase 또는 기존 Worker + Cloudflare D1로. 연결 전 localStorage 보관함은 각 브라우저에만 있어 모이지 않음 → 연결 시점부터 집계. 로그인 없이 익명 집계면 개인정보 안내 최소화
