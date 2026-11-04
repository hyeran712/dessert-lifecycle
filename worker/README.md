# 실시간 분석용 Cloudflare Worker

홈페이지 검색창에 목록에 없는 디저트를 입력하면, 이 Worker가 네이버 검색량과 전국 인허가 데이터를 받아 전달합니다.
인증키는 Worker의 비밀 변수에만 저장되고 홈페이지 코드에는 드러나지 않습니다.

## 배포
`worker/` 아래 파일을 main 브랜치에 올리면 GitHub Actions(`.github/workflows/deploy-worker.yml`)가 wrangler로 자동 배포합니다. 대시보드에 코드를 붙여넣지 않아도 됩니다.

- GitHub Secrets: `CLOUDFLARE_API_TOKEN`(Workers 스크립트 편집 + 계정 설정 읽기 권한), `CLOUDFLARE_ACCOUNT_ID`
- Worker 비밀 변수(Cloudflare 대시보드 → Settings → Variables and Secrets): `NAVER_ID`, `NAVER_SECRET`(NAVER API HUB 검색어 트렌드), `DATA_GO_KEY`(공공데이터포털 Decoding 키), `GEMINI_KEY`, `GEMINI_MODEL`
- Gemini는 일부 지역(홍콩 등)에서 막혀 있어서, 미국 서부에 고정한 Durable Object(`GeminiProxy`)를 거쳐 호출합니다. `/where`로 확인할 수 있습니다.

## 주소
- `/trend?q=과일모찌` 2016년부터 주간 검색량
- `/shops?q=과일모찌&src=cafe&page=1` 상호에 단어가 들어간 휴게음식점(cafe)·제과점(bakery), 100곳씩
- `GET /where` Gemini를 부르는 데이터센터 확인
- `POST /menu` 디저트 이름·가게 프로필로 AI 신메뉴 제안, 카페 원가표 단가로 원가를 계산하고 목표 원가율을 넘으면 최대 3번 다시 제안

같은 요청은 하루 동안 캐시하고, hyeran712.github.io에서 온 요청만 허용합니다.
