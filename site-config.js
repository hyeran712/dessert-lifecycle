/* 사이트 공통 설정 — 문의 연락처는 여기 한 곳만 고치면 됩니다.
   메일 주소(예: 'help@example.com')나 오픈채팅·카카오채널 주소(https://...)를 넣으면
   메인 페이지 푸터와 privacy.html 문의란에 같이 나타납니다. 비워 두면 '준비 중'으로 보입니다. */
var SITE_CONTACT = '';

document.addEventListener('DOMContentLoaded', function () {
  var c = (SITE_CONTACT || '').trim();
  document.querySelectorAll('[data-contact]').forEach(function (el) {
    if (!c) { el.textContent = '준비 중'; return; }
    if (/^https?:\/\//.test(c)) { var a = document.createElement('a'); a.href = c; a.target = '_blank'; a.rel = 'noopener'; a.textContent = c.replace(/^https?:\/\//, ''); el.replaceChildren(a); }
    else if (/^[^@\s]+@[^@\s]+$/.test(c)) { var m = document.createElement('a'); m.href = 'mailto:' + c; m.textContent = c; el.replaceChildren(m); }
    else el.textContent = c;
  });
});
