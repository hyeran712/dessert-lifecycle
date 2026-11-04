# 실시간 분석용 Cloudflare Worker

홈페이지 검색창에 목록에 없는 디저트를 입력하면, 이 Worker가 네이버 검색량과 전국 인허가 데이터를 받아 전달합니다.
인증키는 Worker의 비밀 변수에만 저장되고 홈페이지 코드에는 드러나지 않습니다.

## 배포
1. Cloudflare 대시보드 → Workers & Pages → Create → Worker → 이름 `dessert-timing` → Deploy
2. Edit code → `worker.js` 내용을 붙여넣고 Deploy
3. Settings → Variables and Secrets에 비밀 변수 3개 추가 (Type: Secret)
   - `NAVER_ID`: NAVER API HUB Client ID
   - `NAVER_SECRET`: NAVER API HUB Client Secret
   - `DATA_GO_KEY`: 공공데이터포털 인증키 (Decoding)
   - `GEMINI_KEY`: Google AI Studio Gemini API 키 (신메뉴 제안)
4. Worker 주소(`https://dessert-timing.<계정>.workers.dev`)를 `index.html`의 `LIVE_API`에 넣기

## 주소
- `/trend?q=과일모찌` 2016년부터 주간 검색량
- `/shops?q=과일모찌&src=cafe&page=1` 상호에 단어가 들어간 휴게음식점(cafe)·제과점(bakery), 100곳씩
- `POST /menu` 디저트 이름·가게 프로필로 AI 신메뉴 제안, 카페 원가표 단가로 원가를 계산하고 목표 원가율을 넘으면 최대 3번 다시 제안

같은 요청은 하루 동안 캐시하고, hyeran712.github.io에서 온 요청만 허용합니다.
