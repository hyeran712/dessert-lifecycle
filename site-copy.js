/* 안내 문구 모음 — 사이트에 나오는 "참고 자료예요 / 최종 결정은 사장님 몫" 같은 안내 문구는 여기 한 곳에서 고치세요.
   index.html(메인)·guide.html(사용법)이 이 파일을 불러와서 [data-copy="이름"] 칸에 자동으로 채웁니다. */
var SITE_COPY = {
  // 2단계 결론 카드 아래
  verdictNote: '📌 10년 치 검색량과 72만 개 가게 데이터로 낸 결과예요. 판단을 돕는 참고 자료이니, 최종 결정은 우리 가게 상황과 함께 판단해 주세요.',
  // 3단계 AI 신메뉴 결과 카드 아래
  menuNote: 'AI가 만든 레시피와 원가는 예상값이에요. 실제로 만들어 보고 맛·양·가격을 꼭 확인해 주세요.',
  // 오른쪽 사이드바 맨 아래
  sideNote: '데이터로 낸 참고 결과예요. 최종 결정은 사장님 몫이에요.',
  // 푸터 한 줄 (2026-11-11 두 줄 → 한 줄로 줄임)
  footNote: '검색량·가게 수는 실제 판매량이 아니에요. 참고 자료로 보시고 최종 결정은 직접 확인해 주세요.',
  // 사용법 페이지의 자세한 버전
  detail: '디저트 타이밍은 공공데이터(행정안전부 인허가)와 네이버 검색 데이터를 분석해 출시 시기를 판단하도록 돕는 도구예요. 검색량과 가게 수는 실제 판매량이 아니고, 동네 상권·가격·맛·운영 방식에 따라 결과가 달라질 수 있어요. 참고 자료로 활용하시고, 최종 결정은 직접 확인한 뒤 내려 주세요.',
  // 사이드바 '💡 지금 할 일' (단계마다 바뀜)
  tip: {
    1: '디저트를 하나 고르면 지금 내도 될지 판단해 드려요',
    2: '결론 카드만 봐도 돼요. 아래는 그 이유예요',
    3: '목적 → 가격 → [신메뉴 만들기] 순서로 눌러 보세요',
  },
  // 가게 프로필이 없을 때 사이드바 문구
  noProfile: '내 가게 정보를 넣으면 추천이 더 정확해져요 →',
};

function fillSiteCopy() {
  document.querySelectorAll('[data-copy]').forEach(function (el) {
    var v = SITE_COPY[el.getAttribute('data-copy')];
    if (typeof v === 'string') el.textContent = v;
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fillSiteCopy); else fillSiteCopy();
