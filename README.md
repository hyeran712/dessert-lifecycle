<p align="center">
  <img src="./img/brand/logo-wordmark.png" alt="디저트 타이밍" width="420" />
</p>

<h3 align="center">신메뉴, 언제 내고 언제 접을까? 데이터로 답하는 F&amp;B 기획 도구</h3>

<p align="center">
카페 사장님이 신메뉴를 <b>언제 내고, 얼마에 팔지</b>를 공공데이터 · 농산물 시세 · 네이버 검색 · AI로 판단하도록<br />
<b>판단 → 확인 → 실행</b>을 한 화면에서 할 수 있게 직접 기획하고 만든 개인 프로젝트
</p>

<p align="center">
  <a href="https://hyeran712.github.io/dessert-lifecycle/"><img src="https://img.shields.io/badge/사이트_바로가기-FFD400?style=for-the-badge&logoColor=1c1c1c" alt="사이트 바로가기" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/행정안전부_인허가-공공데이터-1F6FEB?style=flat-square" />
  <img src="https://img.shields.io/badge/aT_KAMIS-농산물_시세-2E7D32?style=flat-square" />
  <img src="https://img.shields.io/badge/NAVER-데이터랩·검색광고·검색-03C75A?style=flat-square&logo=naver&logoColor=white" />
  <img src="https://img.shields.io/badge/Gemini_API-신메뉴_AI-8E75B2?style=flat-square&logo=googlegemini&logoColor=white" />
  <img src="https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white" />
  <img src="https://img.shields.io/badge/Supabase-로그인-3FCF8E?style=flat-square&logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/GitHub_Actions-매주_자동_갱신-2088FF?style=flat-square&logo=githubactions&logoColor=white" />
  <img src="https://img.shields.io/badge/Python-pandas-3776AB?style=flat-square&logo=python&logoColor=white" />
</p>

### 🎬 시연 영상

그림을 누르면 영상이 열려요. (소금빵 기준, 무음·자막 · 시계 → 디저트 고르기 → 타이밍 진단 → AI 신메뉴·원가율 → 레이더 → 동네 리포트)

<div align="center">

| 💻 PC (1분 30초) | 📱 휴대폰 (1분 30초) |
|:---:|:---:|
| [<img src="docs/readme/demo/poster-pc.jpg" width="520" alt="PC 시연 영상">](docs/readme/demo/demo-pc.mp4) | [<img src="docs/readme/demo/poster-mobile.jpg" width="200" alt="휴대폰 시연 영상">](docs/readme/demo/demo-mobile.mp4) |

</div>

>
> 📑 **발표 슬라이드 24장**은 맨 아래 [슬라이드 펼쳐보기](#-슬라이드-펼쳐보기)에 있습니다.

<div align="center">

| 인허가 | 검색량 | 동네&nbsp;리포트 | 데이터 | 레이더 | 원가율 | 인증키 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **72만&nbsp;건** | **10년&nbsp;·&nbsp;21종** | **255곳** | **7가지** | **9개월&nbsp;먼저** | **30%&nbsp;목표** | **코드에&nbsp;0건** |

</div>

<p align="center">
  <img src="./docs/readme/shots/home2.webp" alt="디저트 타이밍 첫 화면" width="88%" />
</p>

---

## 📌 목차

<div align="center">

| 01 프로젝트 소개 | 02 주요 기능 | 03 기술과 문제 해결 |
|:---|:---|:---|
| [개요](#-개요)<br>[기능 지도](#-기능-지도)<br>[믿을 수 있는 데이터](#-믿을-수-있는-데이터) | 1. [판단](#1-판단--결론부터-보여-주는-유행-진단)<br>2. [디저트 시계](#2-디저트-시계--이번-달-팔기-좋은-top-3)<br>3. [레이더](#3-이번-주-레이더--매주-전국-가게를-다시-센다)<br>4. [동네 리포트](#4-우리-동네-리포트--시군구-255곳)<br>5. [AI 신메뉴](#5-ai-신메뉴--원가율이-맞을-때까지-다시-짠다)<br>6. [원가표](#6-직접-만든-원가표-시트)<br>7. [로그인](#7-로그인--구글카카오)<br>8. [관리자](#8-관리자-통계--주인만-보는-페이지)<br>9. [모바일](#9-모바일--홈-화면에-앱처럼-설치) | [사용한 도구](#-이-프로그램은-이런-도구로-만들었습니다)<br>[구조](#-프로그램-구조)<br>[서버 기능](#-서버가-하는-일)<br>[문제 해결](#-실제로-겪은-문제-고치기-전과-후)<br>[검증](#-검증)<br>[분석 결과](#-분석으로-찾은-것)<br>[실행 방법](#-실행-방법) |

</div>

---

# 01 프로젝트 소개

## 🗂 개요

<div align="center">

| 항목 | 내용 |
|:---:|:---:|
| **누구에게** | 개인 카페 사장님 · F&B 메뉴 기획자 |
| **문제** | 신메뉴를 감과 SNS 분위기로 정해 유행 끝물에 들어가거나, 원가가 안 맞음 |
| **해결** | **판단**(지금 내도 될까) → **확인**(경쟁 가게는) → **실행**(레시피·원가·가격)을 한 화면에서 |
| **원칙** | 분석표보다 **한 줄 결론과 다음 행동**. AI 결과는 실제 단가로 검증하고, 결과는 참고 자료로 안내 |
| **범위** | 개인 프로젝트 — 기획 · 데이터 분석 · 화면 · 서버 · AI 연결 · 배포 전체 |

</div>

## 🧭 기능 지도

<div align="center">

| 단계 | 기능 | 핵심 |
|:---:|:---:|:---:|
| **판단** | 유행 단계 진단 | 10년 검색량 → 5가지 유형(진행중·시즌형·유행형·정착형·관망형) · 결론 세 줄 · 많이 찾는 가게 TOP 5 |
| | 디저트 시계 | 8가지 점수 → 달마다 팔기 좋은 TOP 3 · 수능·설·추석·복날 자동 계산 |
| **확인** | 이번 주 레이더 | 매주 월요일 인허가 자동 갱신 · 전국 3D 지도 · 팝업 구분 · 새 가게 이름 알림 |
| | 우리 동네 리포트 | 시군구 255곳 · 3년 생존율 · 빈자리 디저트 · A4 PDF |
| **실행** | AI 신메뉴 | Gemini 레시피 → 실제 단가로 원가율 → 30% 넘으면 최대 3번 다시 |
| | 원가율 · 판매가 | 내 원가표 → KAMIS 시세 순서로 단가 · 다른 카페 판매가 비교 |
| **운영** | 로그인 · 관리자 · 모바일 | 구글·카카오 로그인 · 익명 사용 통계 · 하루 사용 한도 · 홈 화면 설치 |

</div>

## 🔎 믿을 수 있는 데이터

<div align="center">

| 데이터 | 출처 | 쓰는 곳 |
|:---:|:---:|:---:|
| 전국 휴게음식점·제과점 인허가 **72만 건** | **행정안전부** 지방행정 인허가 (공공데이터포털 API) | 매장 수 · 폐업률 · 주간 레이더 · 동네 리포트 |
| 농산물 도·소매 시세 | **한국농수산식품유통공사(aT) KAMIS** Open API | 재료 원가 · 한 달 새 오른 재료 경고 · 디저트 시계 |
| 주간 검색량 (2016.01~2026.10) | 네이버 데이터랩 검색어 트렌드 | 유행 단계 진단 · 디저트 시계 |
| 월간 검색 수 · 연관 키워드 | **네이버 검색광고 API** | 가게당 검색 수 · 많이 찾는 가게 |
| 블로그 후기 · 지역 검색 | 네이버 검색 API | 다른 카페 판매가 · 브랜드 확인 |
| 설·추석 날짜 | 한국천문연구원 특일 정보 (공공데이터) | 대목 달력 자동 계산 |
| 카페 원가표 (재료 단가) | **직접 만든 구글 시트** | 신메뉴 원가율 검증의 기준 단가 |

</div>

---

# 02 주요 기능

## 1. 판단 — 결론부터 보여 주는 유행 진단

디저트를 고르면 10년 검색량으로 유행 단계를 진단하고 **언제 · 어떻게 · 주의** 세 줄로 답합니다. 탕후루처럼 정점이 지난 디저트는 "정점 뒤에 연 가게의 29%가 1년 안에 닫았다"는 근거와 함께 단독 신메뉴를 말립니다.

<p align="center">
  <img src="./docs/readme/shots/decide.webp" alt="결론 카드" width="70%" />
</p>

## 2. 디저트 시계 — 이번 달 팔기 좋은 TOP 3

달마다 **① 그 달 검색 증가 ② 유행 단계 ③ 전년 대비 ④ 대목 ⑤ KAMIS 재료값 ⑥ 가게당 검색 수 ⑦ 내 가게 장비·가격대 ⑧ 월별 대표 메뉴** 점수를 더해 1~3등을 고르고, 다음 달 준비 메뉴와 남은 날짜까지 알려 줍니다. 수능은 11월 셋째 목요일, 복날은 경일(庚日) 규칙, 설·추석은 특일 정보로 자동 계산해 손으로 날짜를 고칠 필요가 없습니다.

<p align="center">
  <img src="./docs/readme/shots/clock.webp" alt="디저트 시계" width="80%" />
</p>

## 3. 이번 주 레이더 — 매주 전국 가게를 다시 센다

매주 월요일 GitHub Actions가 행정안전부 인허가 API에서 **지난주 이후 바뀐 가게만** 받아 디저트 10종 매장 수 · 개업 · 폐업을 지도에 그립니다. 90일 안에 닫은 곳은 '팝업', 같은 이름으로 7일 안에 다시 연 곳은 '신고 변경'으로 따로 표시합니다.

<p align="center">
  <img src="./docs/readme/shots/map.webp" alt="레이더 지도" width="70%" />
</p>

<div align="center">

| 레이더가 잡은 단어 | 레이더가 알아챈 때 | 유행 꼭대기(검색 최고) | 결과 |
|:---:|:---:|:---:|:---:|
| 왕가탕후루 (브랜드) | 2022.11 | 2023.08 | ✅ **9개월 먼저** |
| 요거트아이스크림의정석 (브랜드) | 2024.03 | 2024.08 | ✅ **5개월 먼저** |
| 탕후루 (메뉴) | 2023.04 | 2023.08 | ✅ **4개월 먼저** |
| 크로플 (메뉴) | 2021.01 | 2020.09 | ❌ 4개월 늦음 |

</div>

<sub>규칙: 최근 3개월 새 가게 이름에 그 단어가 1년 전보다 4배 넘게 늘고, 6개 넘는 시군구에서 동시에 보일 때. 2017~2026년 매달 같은 규칙을 다시 적용해 검증.</sub>

## 4. 우리 동네 리포트 — 시군구 255곳

인허가 전체 데이터로 동네마다 영업 중 가게 수 · 최근 1년 개업/폐업 · 3년 생존율을 보여 주고, 디저트별 매장 수가 전국 평균보다 적으면 **'빈자리'**로 표시합니다. A4 PDF로 저장해 바로 공유할 수 있습니다.

<p align="center">
  <img src="./docs/readme/shots/local-top.webp" alt="동네 리포트" width="70%" />
</p>

## 5. AI 신메뉴 — 원가율이 맞을 때까지 다시 짠다

<div align="center">

| 단계 | 하는 일 |
|:---:|:---:|
| ① 입력 | 디저트 · 메뉴 목적(SNS용·대목용·정규 등) · 가게 장비 · 가격대 · 쓰지 않는 재료 |
| ② AI 레시피 | **Gemini API**가 메뉴 이름 · 재료 g · 만드는 순서 · 사진 포인트 |
| ③ 원가 계산 | 재료마다 실제 단가를 붙여 원가율 계산 (단가 출처 꼬리표) |
| ④ 다시 조정 | 목표 30%를 넘으면 "맛의 핵심은 지키고 양·재료를 바꿔" 최대 3번 다시 요청 |

</div>

<p align="center">
  <img src="./docs/readme/shots/airesult.webp" alt="AI 신메뉴 결과" width="32%" />
  <img src="./docs/readme/shots/plan.webp" alt="기획 카드와 시장가" width="56%" />
</p>

```js
// worker/worker.js — 원가율이 목표를 넘으면 AI에게 이유를 붙여 다시 시킨다
for (let i = 1; i <= 3; i++) {
  if (i > 1 && deadline - Date.now() < 25000) break;   // 시간이 모자라면 지금 결과로
  result = await askOnce();
  cost = costOf(result.recipe, MKT, MY);                // 내 원가표 → 원가표 → KAMIS 시세 → AI 추정
  const rate = cost.total / price * 100;
  if (rate <= target) break;
  prompt = base + `재료 원가 ${cost.total}원, 원가율 ${rate.toFixed(1)}%로 목표 ${target}%를 넘었습니다. …`;
}
```

## 6. 직접 만든 원가표 시트

카페 운영을 가정해 **원가 · 레시피 · 재고 · 발주 · AI 재고 조언**까지 담은 구글 시트를 직접 설계했습니다. [재료단가] 탭에 식자재몰 실제 판매가와 구매 용량을 넣으면 단위당 단가가 계산되고, 예시값·AI 추정은 '확인 필요'로 구분합니다.

- 사이트에 시트 주소만 넣으면 자동으로 읽고, 시트를 고치면 다음 계산부터 반영
- 엑셀 파일 올리기 · 직접 입력 · 예시 시트 **사본 만들기** 제공
- 단가는 믿을 수 있는 순서로: **내 원가표 → KAMIS 시세 → 원가표 기본 단가 → (없을 때만) AI 추정**

<p align="center">
  <img src="./docs/readme/shots/sheet.webp" alt="직접 만든 원가표 시트" width="88%" />
</p>

## 7. 로그인 — 구글·카카오

로그인하면 **보관함 · 내 원가표 · 가게 프로필**이 서버에 저장돼 휴대폰과 컴퓨터 어디서나 이어집니다. 로그인 없이도 모든 기능을 쓸 수 있고, 처음 로그인하면 이 브라우저에 있던 것도 옮겨 줍니다.

<div align="center">

| 항목 | 구현 |
|:---:|:---:|
| 로그인 | Supabase Auth · 구글 OAuth · 카카오 로그인 |
| 보안 | 표마다 RLS(본인 데이터만) · 받는 정보는 닉네임·이메일·프로필 사진 · 개인정보 처리방침 · 탈퇴 |
| 사용 한도 | 로그인하면 사람별로, 아니면 접속 주소별로 하루 신메뉴 10회 · 검색 60회 |

</div>

<p align="center">
  <img src="./docs/readme/shots/login-modal.webp" alt="로그인 창" width="44%" />
</p>

## 8. 관리자 통계 — 주인만 보는 페이지

사장님들이 사이트를 어떻게 쓰는지 **이름·이메일 없이 익명**으로 모읍니다. 서버 비밀 열쇠가 있어야 열리고, 주인 브라우저는 한도 없음 · 통계에서도 빠집니다. 메뉴마다 원가율과 걸린 초를 남겨 AI 결과 품질도 점검합니다. 다시 온 사람, 👍 만족도, 로그인한 사람, 원가표 연결 수도 함께 봐서 사장님들이 실제로 계속 쓰는지 확인합니다.

<p align="center">
  <img src="./docs/readme/shots/stats-dash.webp" alt="관리자 통계 한눈에 보기" width="46%" />
  <img src="./docs/readme/shots/stats-recent.webp" alt="관리자 통계 최근 기록" width="46%" />
</p>

## 9. 모바일 — 홈 화면에 앱처럼 설치

사장님들은 매장에서 휴대폰을 더 많이 씁니다. 휴대폰 화면에 맞추고(아래 고정 메뉴), 웹 앱 설정(manifest)과 홈 화면 아이콘을 넣어 **앱스토어 없이 홈 화면에 추가**해 주소창 없는 전체 화면으로 쓸 수 있게 했습니다. 아이폰·안드로이드별 설치 방법도 화면에서 알려 줍니다.

<p align="center">
  <img src="./docs/readme/shots/m-home-s.webp" alt="휴대폰 첫 화면" width="28%" />
  <img src="./docs/readme/shots/m-a2hs-s.webp" alt="홈 화면 설치 안내" width="28%" />
  <img src="./docs/readme/shots/m-step2-s.webp" alt="휴대폰 결론 카드" width="28%" />
</p>

---

# 03 기술과 문제 해결

## 🧰 이 프로그램은 이런 도구로 만들었습니다

<div align="center">

| 화면 | 서버 · API | 데이터 · AI | 분석 · 자동화 |
|:---:|:---:|:---:|:---:|
| HTML · CSS · JavaScript (한 페이지 · 휴대폰 대응) | Cloudflare Worker (API 대신 호출 · 인증키 보관) | 행정안전부 인허가 (공공데이터포털) | Python · pandas · Jupyter |
| Chart.js (검색량 그래프) | Durable Object (사용 한도 · 통계 · 미국 서부 경유) | 한국농수산식품유통공사 KAMIS | GitHub Actions (매주 레이더 · 명절 날짜) |
| SVG 3D 지도 (시도별 색칠) | Supabase (로그인 · 보관함 · 원가표 저장) | 네이버 데이터랩 · 검색광고 · 검색 | Playwright (화면 점검) |
| GitHub Pages (배포) · 웹 앱 설치 | | Gemini API (신메뉴 · 레시피) | Claude Code (AI 코딩 도구 · 결과는 직접 확인) |

</div>

## 🏗 프로그램 구조

```mermaid
flowchart LR
  U["사용자 화면<br/>GitHub Pages · 휴대폰·PC"] <-->|요청| W["Cloudflare Worker<br/>인증키 보관 · 하루 한도 · 원가 계산"]
  W --> N["네이버<br/>데이터랩 · 검색광고 · 검색"]
  W --> K["KAMIS<br/>농산물 시세"]
  W --> P["공공데이터포털<br/>인허가 · 특일 정보"]
  W --> G["Gemini API<br/>미국 서부 경유"]
  U <--> S["Supabase<br/>로그인 · 보관함 · 원가표"]
  A["GitHub Actions<br/>매주 월요일"] -->|live/*.json| U
```

<div align="center">

| 영역 | 파일 |
|:---:|:---:|
| 화면 | `src/head.html` · `src/body.html` · `src/app.js` · `src/data.json` → `build.sh`가 `index.html`로 합침 · `guide.html` · `privacy.html` · `stats.html` |
| 서버 | `worker/worker.js` (검색 · 시세 · 신메뉴 · 원가 · 사용 한도 · 통계) |
| 자동 갱신 | `scripts/update.py` · `scripts/radar_core.py` · `.github/workflows/weekly-radar.yml` → `live/` |
| 동네 리포트 | `scripts/district.py` → `live/district.json` |
| 로그인 DB | `supabase/schema.sql` (`user_data` · `saved_menus` · RLS · 탈퇴 함수) |
| 분석 | `dessert_lifecycle.ipynb` · `dessert_lifecycle/` (그래프 · 원본 데이터) |

</div>

## 🔌 서버가 하는 일

<div align="center">

| 구분 | 주소 | 하는 일 |
|:---:|:---:|:---:|
| 검색량 | `GET /trend` | 2016년부터 주간 검색량 (네이버 데이터랩) |
| 검색 수 | `GET /volume` | 최근 한 달 검색 수 · 연관 키워드 (검색광고 API) |
| 매장 | `GET /shops` | 상호로 인허가 가게 찾기 (행정안전부) |
| 판매가 | `GET /price` | 블로그 후기 500개에서 다른 카페 가격 뽑기 |
| 브랜드 | `GET /brands` | 이 디저트로 많이 찾는 가게 TOP 5 |
| 시세 | `GET /kamis` | 농산물 소매 시세 (12시간 저장) |
| **신메뉴** | `POST /menu` | **AI 레시피 + 실제 단가로 원가율 검증, 최대 3번 재조정** |
| 원가표 | `GET /sheet` | 사장님 구글 시트 원가표 읽기 (5분 저장) |
| 기록 · 통계 | `POST /event` · `GET /stats` | 익명 사용 기록 · 주인용 요약 (열쇠 필요) |
| 점검 | `GET /where` | AI를 어느 지역에서 부르는지 확인 |

</div>

## 🧯 실제로 겪은 문제, 고치기 전과 후

<div align="center">

| # | 증상 | 원인 | 해결 |
|:---:|:---:|:---:|:---:|
| 01 | 신메뉴가 100초를 넘겨 오류(524) | 큰 AI 모델이 한 번에 40초 이상 | 빠른 모델 먼저 · 한 번 40초 제한 · 전체 90초 → **2~4초** |
| 02 | AI 호출이 거부됨 | 서버가 홍콩 데이터센터에서 실행되면 Gemini가 막음 | 미국 서부에 고정한 Durable Object를 거쳐 호출 |
| 03 | 주간 레이더 저장 실패 | 계산하는 5분 사이 다른 저장이 끼어들어 push 거부 | 최신 내용을 받아 합친 뒤 3번까지 다시 저장 |
| 04 | 브랜드 찾기 1등이 '클래식'·동명이인 | 흔한 낱말·사람 이름의 검색 수가 큼 | 두 글자 이름 제외 · 검색 수가 너무 크면 제외 |
| 05 | 다른 카페 가격이 '준비 중' | 네이버 검색 API가 API Hub로 옮겨 감 | 기존 키로 API Hub 주소 호출 · 지역 검색 권한 켜기 |
| 06 | 화면 코드가 통째로 멈춤 | 함수를 선언 전에 불러 초기화 순서 오류(TDZ) | `const` → `function` 선언으로 바꿈 |

</div>

```js
// 02 · worker/worker.js — Gemini는 미국 서부에 고정한 Durable Object를 거쳐 부른다
export class GeminiProxy extends DurableObject {
  async fetch(request) { return fetch(request); }
}
function geminiFetch(url, init, env) {
  const stub = env.GEMINI_PROXY.get(env.GEMINI_PROXY.idFromName('us-west-v1'), { locationHint: 'wnam' });
  return stub.fetch(new Request(url, init));
}
```

## ✅ 검증

<div align="center">

| 확인한 것 | 방법 | 결과 |
|:---:|:---:|:---:|
| 레이더 정확도 | 2017~2026년 매달 같은 규칙을 다시 적용 | 4개 중 3개를 **4~9개월 먼저** |
| 다른 카페 판매가 | 소금빵 블로그 후기 500개에서 가격 추출 | 가격 44개 → 보통 **3,500원** (대부분 3,000~3,900원) |
| 복날 자동 계산 | 경일 규칙으로 계산해 실제 달력과 비교 | 2023~2026 일치 |
| 검색량 ≠ 실제 가게 | 인허가 데이터로 개업·폐업 시점 대조 | 정점 뒤 늦은 공급 · 높은 폐업률 확인 |
| 화면 | PC·휴대폰 크기에서 1→2→3단계 · 콘솔 오류 · 가로 넘침 | 오류 0 · 넘침 0 |
| 보안 | 네이버 · KAMIS · Gemini · 공공데이터 키 | 공개 코드 0건 (서버 비밀 변수에만) |

</div>

---

## 📈 분석으로 찾은 것

네이버 데이터랩 주간 검색량(2016.01~2026.10)과 인허가 데이터로 디저트 21종의 수명주기를 분석했습니다.<br>
자세한 과정은 [분석 노트북](dessert_lifecycle.ipynb)에 있습니다.

<div align="center">

| 숫자 | 뜻 |
|:---:|:---:|
| **10주 vs 48주** | 20주 안에 정점에 닿은 디저트 9개는 반감기 중앙값 10주, 40주 넘게 걸린 6개는 48주 |
| **2.6배** | 탕후루 검색 정점 **뒤에** 연 가게의 1년 내 폐업률 (정점 전 개업 대비) |
| **+187%** | 지금 뜨는 과일모찌, 최근 13주 검색량 전년 대비 |

</div>

<details>
<summary><b>📊 분석 그래프 · 매장 데이터 자세히 보기</b></summary>
<br />

![피크 기준 수명주기 비교](dessert_lifecycle/fig1_lifecycle.png)

![상승 기간과 생존율](dessert_lifecycle/fig2_rise_vs_survival.png)

![시즌형 디저트 월별 패턴](dessert_lifecycle/fig3_season.png)

![검색량과 영업 매장 수](dessert_lifecycle/fig5_search_vs_shops.png)

<div align="center">

| 디저트 | 검색 피크 | 매장 수 최고점 | 최고 → 현재 | 1년 내 폐업 (피크 전 / 후 개업) | 팝업 비율 |
|:---:|:---:|:---:|:---:|:---:|:---:|
| 탕후루 | 2023.08 | 2024.01 | 1,123 → 139곳 | 10.8% / **28.6%** | 7% |
| 크로플 | 2020.09 | 2023.02 | 312 → 76곳 | 0% / 20.7% | 25% |
| 마카롱 | 2018.05 | 2020.07 | 519 → 144곳 | 6.4% / 8.8% | 19% |
| 베이글 | 2023.03 | 2026.08 | 366 → 365곳 | 12.6% / 11.9% | 26% |
| 모찌 | 2026.10 | 진행 중 | 152곳 | – | **57%** |
| 소금빵 | 2022.07 | 2026.10 | 72 → 73곳 | – / 8.6% | 14% |

</div>

**분석 방법** — 데이터랩은 한 번에 5개까지만 조회되고 조회마다 최댓값을 100으로 주기 때문에, 모든 조회에 기준 키워드 '디저트'를 넣어 6개 파일을 하나의 기준으로 합쳤습니다. 13주 이동평균으로 추세를 보고, 상승 기간(피크 25%→피크) · 반감기(피크→50%) · 현재 수준(최근 13주÷피크) · 전년 대비로 유형을 나눴습니다. '모찌'는 데이터랩에서 0으로 나와 모찌떡·찹쌀모찌·과일모찌를 합산했습니다.

</details>

## ⚠️ 한계

- 검색량과 가게 수는 **관심도와 공급**이지 실제 판매량이 아닙니다. 그래서 화면 곳곳에 "참고 자료이고 최종 결정은 사장님 몫"이라는 안내를 넣었습니다.
- 인허가 데이터는 가게 이름으로만 셀 수 있어, 일반 카페에서 메뉴로 파는 디저트는 빠집니다.
- AI 레시피와 원가는 예상값이라 직접 만들어 보고 맛·양·가격을 확인해야 합니다.

## 🚀 실행 방법

```bash
git clone https://github.com/hyeran712/dessert-lifecycle.git
cd dessert-lifecycle
./build.sh                      # src/ 네 파일을 합쳐 index.html 생성
python3 -m http.server 8765     # http://localhost:8765 에서 확인
```

- 서버(`worker/`)는 `main`에 올리면 GitHub Actions가 Cloudflare에 자동 배포합니다. 인증키는 Cloudflare Worker 비밀 변수와 GitHub Secrets에만 둡니다.
- 레이더는 매주 월요일 자동으로 갱신됩니다. 손으로 다시 계산하려면 `python scripts/update.py --offline`.

---

## 📊 슬라이드 펼쳐보기

<details open>
<summary><b>📂 슬라이드 24장</b> — 01 프로젝트 소개 · 02 주요 기능 · 03 기술과 문제 해결</summary>
<br />

<p align="center">
  <img src="./docs/readme/slides/01.webp" alt="01" width="95%" /><br /><sub>01 · 표지</sub><br /><br />
  <img src="./docs/readme/slides/02.webp" alt="02" width="95%" /><br /><sub>02 · 오늘 이야기할 세 가지</sub><br /><br />
  <img src="./docs/readme/slides/03.webp" alt="03" width="95%" /><br /><sub>03 · 프로젝트 소개</sub><br /><br />
  <img src="./docs/readme/slides/04.webp" alt="04" width="95%" /><br /><sub>04 · 기능 지도</sub><br /><br />
  <img src="./docs/readme/slides/05.webp" alt="05" width="95%" /><br /><sub>05 · 숫자로 보는 디저트 타이밍</sub><br /><br />
  <img src="./docs/readme/slides/06.webp" alt="06" width="95%" /><br /><sub>06 · 판단 — 결론부터</sub><br /><br />
  <img src="./docs/readme/slides/07.webp" alt="07" width="95%" /><br /><sub>07 · 판단 — 디저트 시계</sub><br /><br />
  <img src="./docs/readme/slides/08.webp" alt="08" width="95%" /><br /><sub>08 · 확인 — 이번 주 레이더</sub><br /><br />
  <img src="./docs/readme/slides/09.webp" alt="09" width="95%" /><br /><sub>09 · 확인 — 우리 동네 리포트</sub><br /><br />
  <img src="./docs/readme/slides/10.webp" alt="10" width="95%" /><br /><sub>10 · 실행 — AI 신메뉴 흐름</sub><br /><br />
  <img src="./docs/readme/slides/11.webp" alt="11" width="95%" /><br /><sub>11 · 실행 — 실제 결과</sub><br /><br />
  <img src="./docs/readme/slides/12.webp" alt="12" width="95%" /><br /><sub>12 · 실행 — 원가율과 판매가</sub><br /><br />
  <img src="./docs/readme/slides/13.webp" alt="13" width="95%" /><br /><sub>13 · 실행 — 직접 만든 원가표</sub><br /><br />
  <img src="./docs/readme/slides/14.webp" alt="14" width="95%" /><br /><sub>14 · 회원 — 구글·카카오 로그인</sub><br /><br />
  <img src="./docs/readme/slides/15.webp" alt="15" width="95%" /><br /><sub>15 · 관리자 통계</sub><br /><br />
  <img src="./docs/readme/slides/16.webp" alt="16" width="95%" /><br /><sub>16 · 모바일 — 홈 화면 설치</sub><br /><br />
  <img src="./docs/readme/slides/17.webp" alt="17" width="95%" /><br /><sub>17 · 이 프로그램은 이런 도구로 만들었습니다</sub><br /><br />
  <img src="./docs/readme/slides/18.webp" alt="18" width="95%" /><br /><sub>18 · 프로그램 구조</sub><br /><br />
  <img src="./docs/readme/slides/19.webp" alt="19" width="95%" /><br /><sub>19 · 서버가 하는 일</sub><br /><br />
  <img src="./docs/readme/slides/20.webp" alt="20" width="95%" /><br /><sub>20 · 고치기 전과 후</sub><br /><br />
  <img src="./docs/readme/slides/21.webp" alt="21" width="95%" /><br /><sub>21 · 검증</sub><br /><br />
  <img src="./docs/readme/slides/22.webp" alt="22" width="95%" /><br /><sub>22 · 한계와 다음 단계</sub><br /><br />
  <img src="./docs/readme/slides/23.webp" alt="23" width="95%" /><br /><sub>23 · 이 프로젝트에서 배운 것</sub><br /><br />
  <img src="./docs/readme/slides/24.webp" alt="24" width="95%" /><br /><sub>24 · 마무리</sub><br /><br />
</p>

</details>

---

<sub>디저트 타이밍 · 윤혜란 · 결과는 판단을 돕는 참고 자료이며, 최종 결정은 사장님의 몫입니다.</sub>
