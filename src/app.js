const D = JSON.parse(document.getElementById('data').textContent);
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = {ink:css('--ink'), ink2:css('--ink-2'), ink3:css('--ink-3'), grid:css('--grid'), teal:css('--teal'), main:css('--chart-main') || css('--teal'),
  s:[css('--s1'),css('--s2'),css('--s3'),css('--s4')]};
const TYPE_COLOR = {'진행중':css('--t-hot'),'유행형':css('--t-fad'),'정착형':css('--t-stay'),'시즌형':css('--t-season'),'관망형':css('--t-watch')};
Chart.defaults.font.family = '"Noto Sans KR", system-ui, sans-serif';
Chart.defaults.color = C.ink2;
Chart.defaults.plugins.legend.display = false;
Chart.defaults.plugins.tooltip.backgroundColor = '#2b3034';
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.maintainAspectRatio = false;
Chart.defaults.devicePixelRatio = Math.max(2, window.devicePixelRatio || 1);  // 확대·고해상도 화면에서도 선명하게
Chart.defaults.layout = { padding: { top: 8 } };

// 날짜 → 연도 소수 (가로축용)
const X = D.dates.map(d => { const t = new Date(d); return t.getFullYear() + (t - new Date(t.getFullYear(),0,1)) / 31536000000; });
const fmtDate = d => { const t = new Date(d); return `${t.getFullYear()}년 ${t.getMonth()+1}월 ${t.getDate()}일 주`; };
const NARROW = window.innerWidth < 560;
const sign = v => (v > 0 ? '+' : '') + Math.round(v) + '%';

/* ---------- 매장 데이터 ---------- */
const SHOPMAP = {'탕후루':'탕후루','흑당':'흑당','크로플':'크로플','마카롱':'마카롱','요거트 아이스크림':'요거트 아이스크림','베이글':'베이글',
  '과일모찌':'모찌','찹쌀모찌':'모찌','모찌떡':'모찌','딸기모찌':'모찌','소금빵':'소금빵'};
const shopPts = key => { const a = D.shops[key].alive, mx = Math.max(...a);
  return a.map((v, i) => ({ x: 2016 + i / 12 + 1 / 24, y: v / mx * 100, n: v, m: `${2016 + Math.floor(i / 12)}년 ${i % 12 + 1}월` })); };
const fmtYM = s => s.replace('-', '.');

/* ---------- 진단: 칩 ---------- */
const GROUPS = [
  ['한때 유행한 디저트', ['흑당','크로플','탕후루','두바이 초콜릿','달고나','마카롱','뚱카롱','요거트 아이스크림']],
  ['떡 · 모찌', ['과일모찌','찹쌀모찌','모찌떡','딸기모찌','찹쌀떡','약과']],
  ['빵 · 길거리 간식', ['소금빵','베이글','붕어빵','땅콩빵']],
  ['맛 · 소재', ['피스타치오','말차','흑임자','쑥']],
  ['비교용 (디저트 외 음식 유행)', ['마라탕']],
];
// 붕어빵·땅콩빵은 고정 데이터(21종)에 없어서 누르면 실시간으로 분석한다 (검색창과 같은 방식)
const chipsEl = document.getElementById('chips');
GROUPS.forEach(([name, ks]) => {
  const g = document.createElement('div'); g.className = 'chip-group';
  g.innerHTML = `<span>${name}</span><div class="chips"></div>`;
  ks.forEach(k => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.k = k;
    b.setAttribute('aria-pressed', 'false');
    if (!D.kw[k]) {
      b.classList.add('live'); b.innerHTML = k + '<span class="lv">실시간</span>'; b.title = '누르면 네이버 검색량·전국 매장을 실시간으로 불러와요 (10초쯤)';
      b.onclick = async () => { if (LIVE[k]) { select(k); goStep(2); return; }
        b.disabled = true; b.classList.add('loading');
        const ok = await analyzeLive(k); b.disabled = false; b.classList.remove('loading');
        if (!ok) qMsg.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
    } else {
      b.innerHTML = k + (D.kw[k].type === '진행중' ? '<span class="hot">HOT</span>' : '');
      b.onclick = () => select(k);
    }
    g.querySelector('.chips').appendChild(b);
  });
  chipsEl.appendChild(g);
});

// ---------- 디저트 대목 달력 (자동) ----------
// 매년 같은 날은 코드가 올해·내년 날짜를 만들고, 수능은 '11월 셋째 목요일'로 계산,
// 설·추석(음력)은 주간 레이더가 공공데이터 특일 정보에서 받아 둔 live/holidays.json을 쓴다
const ANNUAL = [
  ['02-14', '발렌타인데이', ['발렌타인 초콜릿', '두바이 초콜릿', '마카롱', '뚱카롱', '피스타치오']],
  ['03-14', '화이트데이', ['마카롱', '뚱카롱', '탕후루', '딸기모찌', '딸기 케이크']],
  ['05-05', '어린이날', ['탕후루', '요거트 아이스크림', '크로플', '마카롱']],
  ['05-08', '어버이날', ['카네이션 케이크', '약과', '찹쌀떡', '모찌떡', '흑임자']],
  ['05-15', '스승의날', ['카네이션 케이크', '마카롱', '약과', '과일모찌']],
  ['10-31', '할로윈', ['고구마 디저트', '밤 디저트']],
  ['11-11', '빼빼로데이', ['발렌타인 초콜릿', '두바이 초콜릿', '마카롱', '뚱카롱', '피스타치오']],
  ['12-22', '동지', ['찹쌀떡', '붕어빵', '찹쌀모찌']],
  ['12-25', '크리스마스', ['크리스마스 케이크', '딸기 케이크', '과일모찌', '딸기모찌', '마카롱', '두바이 초콜릿', '크로플']],
];
const BOK_KS = ['빙수', '요거트 아이스크림'];
// 복날: 초복=하지(6/21) 뒤 셋째 경일, 중복=넷째 경일, 말복=입추(8/7) 뒤 첫 경일 (경일 = 날짜의 천간이 庚). 2023~2026년 실제 날짜와 맞춰 봄
function bokdays(y) {
  const gy = d => ((Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5) + 2440588 + 9) % 10) === 6, out = [];
  let d = new Date(y, 5, 21), c = 0;
  for (; c < 4; d = new Date(y, d.getMonth(), d.getDate() + 1)) if (gy(d)) { c++; if (c === 3) out.push([ymd(d), '초복']); if (c === 4) out.push([ymd(d), '중복']); }
  for (d = new Date(y, 7, 7); !gy(d); d = new Date(y, d.getMonth(), d.getDate() + 1));
  out.push([ymd(d), '말복']); return out;
}
const LUNAR_KS = { '설날': ['약과', '찹쌀떡', '모찌떡', '흑임자', '쑥'], '추석': ['약과', '찹쌀떡', '모찌떡', '쑥', '흑임자'] };
const SUNEUNG_KS = ['찹쌀떡', '찹쌀모찌', '모찌떡', '약과'];
let LUNAR = [['2027-02-07', '설날'], ['2027-09-15', '추석'], ['2028-01-27', '설날'], ['2028-10-03', '추석']];   // holidays.json을 못 받았을 때 쓰는 값
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function suneung(y) { const d = new Date(y, 10, 1); d.setDate(1 + (4 - d.getDay() + 7) % 7 + 14); return ymd(d); }   // 11월 셋째 목요일
let EVENTS = [];
function buildEvents() {
  const y = new Date().getFullYear();
  EVENTS = [y, y + 1].flatMap(yy => [...ANNUAL.map(([md, n, ks]) => [`${yy}-${md}`, n, ks]), [suneung(yy), '수능', SUNEUNG_KS], ...bokdays(yy).map(([d, n]) => [d, n, BOK_KS])])
    .concat(LUNAR.filter(([, n]) => LUNAR_KS[n]).map(([d, n]) => [d, n, LUNAR_KS[n]]));
}
buildEvents();
fetch('live/holidays.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(h => {
  if (!h || !Array.isArray(h.items) || !h.items.length) return;
  LUNAR = h.items; buildEvents(); if (current) select(current); if (typeof renderClock === 'function') renderClock();
}).catch(() => {});
// days일 안에 오는 대목 (그 디저트와 관련된 것만, 가까운 순)
function upcoming(k, days = 70) {
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  return EVENTS.map(([d, n, ks]) => ({ d: new Date(d + 'T00:00:00'), n, ks })).map(e => ({ ...e, left: Math.round((e.d - t0) / 864e5) }))
    .filter(e => e.left >= 0 && e.left <= days && e.ks.includes(k)).sort((a, b) => a.left - b.left);
}
const leftTxt = n => n === 0 ? '오늘' : n < 14 ? `${n}일` : `${Math.round(n / 7)}주`;
const evTxt = e => { const md = `${e.d.getMonth() + 1}/${e.d.getDate()}`; return e.left === 0 ? `오늘이 ${e.n}(${md})` : `${e.n}(${md})까지 ${leftTxt(e.left)}`; };
// 2단계 맨 위 결론 카드: 신호등 + 언제·어떻게·주의 (사장님이 바로 결정할 수 있게)
function renderDecision(k, v, E) {
  const m = v.smonth, now = new Date().getMonth() + 1, before = ((m + 9) % 12) + 1, before2 = ((m + 10) % 12) + 1;
  const r = REQ[k] || guessReq(k) || {}, alt = r.alt, st = E.shop, p = loadProfile() || {};
  let sig, title, rows;
  if (v.type === '진행중') { sig = 'go'; title = '지금 내세요. 기간 한정으로 빠르게';
    rows = [['언제', '이번 달 안에. 지금이 찾는 사람이 가장 많을 때예요'], ['어떻게', '4~8주만 파는 기간 한정 메뉴로'], ['주의', '4주마다 검색량을 다시 보고, 작년보다 덜 찾기 시작하면 바로 정리하세요']]; }
  else if (v.type === '정착형') { sig = 'go'; title = '정규 메뉴로 내도 좋아요';
    rows = [['언제', '서두를 필요 없어요. 준비되면 언제든'], ['어떻게', '정규 메뉴로 두고 맛·구성을 2~3가지로 넓히기'], ['주의', '이미 파는 가게가 많을 수 있어요. 동네 리포트로 주변 가게 수를 확인하세요']]; }
  else if (v.type === '시즌형') { const d = (m - now + 12) % 12;
    if (d >= 1 && d <= 3) { sig = 'go'; title = `지금 준비하세요. ${m}월 대목용 시즌 메뉴로`; }
    else if (d === 0) { sig = 'mid'; title = `대목(${m}월)이 이미 왔어요. 낸다면 짧게만`; }
    else { sig = 'mid'; title = `아직 일러요. ${before}월에 준비를 시작하세요`; }
    rows = [['언제', d === 0 ? `지금 바로, 짧게. 대목(${m}월)이 이미 시작됐어요` : `${before}~${before2}월에 출시 (대목 ${m}월의 1~2달 전)`], ['어떻게', '대목 앞뒤 2~3달만 파는 시즌 메뉴로, 매년 같은 때 다시'], ['주의', '대목이 지나면 찾는 사람이 확 줄어요. 재고를 넉넉히 잡지 마세요']]; }
  else if (v.type === '유행형') { sig = 'stop'; title = '단독 신메뉴로는 내지 마세요';
    rows = [['언제', '새로 내기엔 늦었어요. 유행이 이미 지나갔어요'], ['어떻게', alt ? `꼭 쓰고 싶다면 '${alt}'처럼 다른 메뉴의 맛·토핑으로만` : '다른 메뉴의 맛이나 토핑 소재로만 가볍게'], ['주의', '탕후루는 유행 정점 뒤에 연 가게의 29%가 1년 안에 닫았어요']]; }
  else { sig = 'mid'; title = '크게 말고, 작게 시험해 보세요';
    rows = [['언제', '급할 것 없어요. 반응을 보며 천천히'], ['어떻게', '새 메뉴보다는 기존 메뉴 리뉴얼이나 한정 수량으로'], ['주의', v.yoy !== null && v.yoy < 0 ? `작년 이맘때보다 ${Math.abs(Math.round(v.yoy))}% 덜 찾고 있어요` : '찾는 사람이 다시 늘지 지켜보세요']]; }
  const ev = upcoming(k).slice(0, 2);
  if (ev.length) {
    const lead = ev.map(evTxt).join(', ') + (ev[ev.length - 1].left === 0 ? '예요' : ' 남았어요');
    if (sig === 'stop') rows.push(['대목', `${lead}. 그때 선물·세트 상품에 살짝 넣는 정도로만 쓰세요`]);
    else rows[0][1] += `. ${lead}${ev[0].left <= 10 ? ', 준비가 빠듯해요' : ''}`;
  }
  const miss = (r.eq || []).filter(e => !(p.eq || []).includes(e));
  if ((p.eq || []).length && miss.length) rows.push(['우리 가게', alt ? `${miss.join('·')}${iga(miss[miss.length - 1])} 없으면 '${alt}'${ro(alt)} 대신할 수 있어요` : `${miss.join('·')}${iga(miss[miss.length - 1])} 필요해요`]);
  const S = document.getElementById('dc-sig'); S.className = 'dc-sig ' + sig; S.textContent = { go: '✓', mid: '!', stop: '✕' }[sig];
  document.getElementById('dc-title').textContent = title;
  document.getElementById('dc-do').innerHTML = rows.map(([a, b]) => `<dt>${a}</dt><dd>${esc(b)}</dd>`).join('');
  const ctx = [`${k}: ${v.type}`, v.yoy !== null ? `작년 이맘때보다 ${sign(v.yoy)}` : '', st && st.open_now ? `전국 전문점 ${st.open_now.toLocaleString()}곳 영업 중` : ''].filter(Boolean);
  document.getElementById('dc-ctx').textContent = ctx.join(' · ');
  document.getElementById('dc-btn').textContent = sig === 'stop' ? '그래도 메뉴 만들어 보기 →' : '이 디저트로 메뉴 만들기 →';
}
function verdict(k, v) {
  const m = v.smonth, before = ((m + 9) % 12) + 1, before2 = ((m + 10) % 12) + 1;
  const sIdx = Math.max(...v.season).toFixed(1);
  switch (v.type) {
    case '진행중': return ['지금 뜨는 중이에요. 시즌 한정으로 바로 출시하세요',
      `최근 3개월 검색량이 작년 이맘때보다 ${sign(v.yoy)} 늘어 역대 최고 수준이에요. 피크 1년 전 검색량이 피크의 ${Math.round(v.pre52)}%로, 바닥에서 갑자기 튄 유행형(1%)보다는 기반이 있고 정착형(48%)보다는 낮아요. 기간 한정으로 먼저 내고 4주마다 검색량을 다시 확인하세요.`];
    case '유행형': return ['유행이 지나갔어요. 신규 출시는 권하지 않아요',
      `${v.peak}에 피크를 찍고 ${v.half}주 만에 절반으로 줄었고, 지금은 피크의 ${v.now}%만 남았어요.` +
      (v.rise <= 20 ? ` 피크까지 ${v.rise}주 만에 급상승한 전형적인 반짝 유행이었어요.` : '') +
      ` 단독 메뉴보다는 다른 메뉴의 토핑이나 맛 소재로 활용하는 정도가 적당해요.`];
    case '정착형': return ['정규 메뉴로 갈 만해요',
      (v.rise ? `${v.rise}주에 걸쳐 천천히 올랐고, ` : '오랫동안 꾸준히 검색됐고, ') +
      `피크(${v.peak}) 이후에도 피크의 ${v.now}%를 유지하고 있어요.` +
      (v.yoy > 20 ? ` 최근엔 전년 대비 ${sign(v.yoy)}로 다시 오르는 중이에요.` : '') +
      ` 정규 메뉴로 두고 맛과 구성을 넓혀 보세요.`];
    case '시즌형': return [`${m}월이 대목이에요. ${before}~${before2}월에 출시하세요`,
      `매년 ${m}월 검색량이 연평균의 ${sIdx}배까지 올라요. 피크 1~2개월 전으로 출시 일정을 고정하는 게 유리해요.` +
      (v.yoy > 20 ? ` 올해는 전년 같은 시기보다 ${sign(v.yoy)} 많이 찾고 있어요.` : '')];
    default: return ['남은 수요를 확인하며 작게 가세요',
      `피크(${v.peak}) 대비 ${v.now}% 수준이 남아 있어 완전히 꺼지진 않았어요. 다만 전년 대비 ${sign(v.yoy)}로 ` +
      (v.yoy < 0 ? '줄고 있어서, 새로 크게 내기보다는 기존 메뉴 리뉴얼에 어울려요.' : '움직이고 있어 지켜볼 만해요.')];
  }
}

let range = 'all', current = null;
const main = new Chart(document.getElementById('c-main'), {
  type: 'line',
  data: { datasets: [{ data: [], borderColor: C.main, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5,
    pointHoverBackgroundColor: C.main, pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2,
    fill: true, backgroundColor: 'rgba(28,28,28,.06)', tension: .25, spanGaps: true, label: '검색량' },
    { data: [], borderColor: C.s[1], borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: C.s[1],
      pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2, tension: .25, label: '영업 중 매장 수' }] },
  options: {
    parsing: false, animation: { duration: 400 },
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
    scales: {
      x: { type: 'linear', grid: { color: C.grid }, ticks: { stepSize: NARROW ? 2 : 1, maxRotation: 0, callback: v => Number.isInteger(v) ? v : '' } }
    },
    plugins: { tooltip: { callbacks: {
      title: it => it[0].raw.m || fmtDate(it[0].raw.d || D.dates[it[0].raw.i]),
      label: it => it.datasetIndex === 1 ? ` 영업 중 매장 ${it.raw.n.toLocaleString()}곳` : ` 검색량: 최고 때의 ${it.raw.y.toFixed(1)}%` } } }
  },
  plugins: [{ id: 'peakLine', afterDatasetsDraw(ch) {
    const pts = ch.data.datasets[0].data; if (!pts.length) return;
    const pk = pts.reduce((a, b) => (b.y > a.y ? b : a));
    const { ctx, scales: { x, y } } = ch; const px = x.getPixelForValue(pk.x);
    if (px < x.left || px > x.right) return;
    ctx.save(); ctx.strokeStyle = C.ink3; ctx.setLineDash([3, 3]); ctx.beginPath();
    ctx.moveTo(px, y.top); ctx.lineTo(px, y.bottom); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = C.ink2; ctx.font = '12px "Noto Sans KR"'; ctx.textAlign = px > x.right - 60 ? 'right' : 'left';
    ctx.fillText('피크 ' + entry(current).v.peak, px + (ctx.textAlign === 'right' ? -6 : 6), y.top + 12); ctx.restore();
  } }]
});

const LIVE = {};          // 실시간으로 분석한 디저트
const LIVE_API = 'https://dessert-timing.yhr9232.workers.dev';     // Cloudflare Worker 주소 (예: https://dessert-timing.xxx.workers.dev)
// ---------- 익명 사용 기록 (Worker /event → Stats). 이름·이메일 없이 무작위 번호(UID)만 ----------
const UID = (() => { try { let u = localStorage.getItem('dessert-timing-uid'); if (!u) { u = Math.random().toString(36).slice(2, 10) + Date.now().toString(36); localStorage.setItem('dessert-timing-uid', u); } return u; } catch { return ''; } })();
const OWNER = (() => { try { return localStorage.getItem('dessert-timing-owner') || ''; } catch { return ''; } })();   // stats.html에서 열쇠를 넣으면 생김 → 주인은 횟수 제한 없음·기록 안 함
function track(type, k, goal, v) {
  if (OWNER || !UID) return;
  try { navigator.sendBeacon(LIVE_API + '/event', JSON.stringify({ type, uid: authUid() || UID, k: k || '', goal: goal || '', v: v || null })); } catch { }
}
{ const d = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); try { if (localStorage.getItem('dessert-timing-visit') !== d) { localStorage.setItem('dessert-timing-visit', d); track('visit', '', '', { ref: document.referrer ? new URL(document.referrer).hostname : '', mobile: innerWidth <= 640 }); } } catch { } }
function entry(k) {
  if (LIVE[k]) return LIVE[k];
  const sk = SHOPMAP[k] && D.shops[SHOPMAP[k]] ? SHOPMAP[k] : null;   // 소금빵은 주간 레이더(live.json)를 불러온 뒤에 생김
  return { v: D.kw[k], X, dates: D.dates, shop: sk ? D.shops[sk].stats : null, shopPts: sk ? shopPts(sk) : [],
           shopNote: sk === '모찌' ? "· 상호에 '모찌'가 들어간 매장" : '· 인허가 기준 상설 매장', shopLegend: sk === '모찌' ? " (상호에 '모찌')" : '' };
}
function drawMain() {
  const E = entry(current), v = E.v, XX = E.X;
  const startX = range === '3y' ? XX[XX.length - 1] - 3 : -Infinity;
  main.data.datasets[0].data = v.s.map((y, i) => ({ x: XX[i], y, i, d: E.dates[i] })).filter(p => p.y !== null && p.x >= startX);
  main.data.datasets[1].data = (E.shopPts || []).filter(p => p.x >= startX && p.x <= XX[XX.length - 1]);
  document.getElementById('lg-main').innerHTML = `<span><i style="background:${C.main}"></i>검색량</span>` +
    (E.shopPts && E.shopPts.length ? `<span><i style="background:${C.s[1]}"></i>영업 중 매장 수${E.shopLegend || ''}</span>` : '');
  main.options.scales.x.min = range === '3y' ? Math.floor(startX * 4) / 4 : 2016;
  main.options.scales.x.max = XX[XX.length - 1];
  main.update();
}

function select(k) {
  current = k;
  document.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === k));
  const E = entry(k), v = E.v, [t, body] = verdict(k, v);
  const badge = document.getElementById('v-badge');
  badge.textContent = v.type; badge.style.background = TYPE_COLOR[v.type];
  document.getElementById('v-title').textContent = t;
  renderDecision(k, v, E);
  document.getElementById('v-body').textContent = body;
  document.getElementById('st-peak').textContent = v.peak;
  document.getElementById('st-rise').innerHTML = v.rise ? `${v.rise}<small>주</small>` : '<small>꾸준히 검색</small>';
  document.getElementById('st-now').innerHTML = `${v.now}<small>%</small>`;
  { const y = document.getElementById('st-yoy'); y.textContent = v.yoy === null ? '–' : sign(v.yoy); y.className = v.yoy === null ? '' : v.yoy < 0 ? 'neg' : 'pos'; }
  document.getElementById('c-title').textContent = `${k} 검색량 추이`;
  const st = E.shop, box = document.getElementById('shopbox');
  box.hidden = !st;
  if (st) {
    document.getElementById('shop-note').textContent = E.shopNote;
    document.getElementById('shop-v').textContent = st.alive_max ? `최고 ${st.alive_max.toLocaleString()}곳 (${fmtYM(st.alive_peak)}) → 현재 ${st.open_now.toLocaleString()}곳` : '상호에 이 단어가 들어간 매장이 거의 없어요';
    const parts = [];
    if (st.close1y_after !== null && st.close1y_before !== null) parts.push(`1년 내 폐업률: 검색 피크 전 개업 ${st.close1y_before}% · 피크 후 개업 ${st.close1y_after}%`);
    if (st.total) parts.push(`팝업 매장 비율 ${Math.round(st.popup / st.total * 100)}%`);
    if (st.capped) parts.push(`매장이 많아 ${st.total.toLocaleString()}곳까지만 분석`);
    document.getElementById('shop-s').textContent = parts.join(' · ');
  }
  warnings(k, v, E.shop);
  drawMain();
  if (typeof renderFindings === 'function' && document.getElementById('shop-table').rows.length) renderFindings(k);
}
document.querySelectorAll('[data-range]').forEach(b => b.onclick = () => {
  range = b.dataset.range;
  document.querySelectorAll('[data-range]').forEach(x => x.setAttribute('aria-pressed', x === b));
  drawMain();
});

/* ---------- 발견 ①~③: 고른 디저트 기준으로 다시 그리기 ---------- */
const med = a => { const b = a.filter(x => x !== null && x !== undefined).sort((x, y) => x - y); if (!b.length) return null; const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const BASE = Object.entries(D.kw).filter(([k, v]) => k !== '모찌류(합산)' && !v.cal && v.type !== '진행중' && v.rise);   // cal = 대목 달력용으로 나중에 넣은 디저트(비교 통계에서는 뺌)
const FAST = BASE.filter(([, v]) => v.rise <= 20).map(([, v]) => v), SLOW = BASE.filter(([, v]) => v.rise >= 40).map(([, v]) => v);
const AVG = { fast: { rise: med(FAST.map(v => v.rise)), half: med(FAST.map(v => v.half)), n: FAST.length },
              slow: { rise: med(SLOW.map(v => v.rise)), half: med(SLOW.map(v => v.half)), n: SLOW.length } };
const reul = w => { const c = w.charCodeAt(w.length - 1); return (c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28) ? '을' : '를'; };
const iga = w => { const c = w.charCodeAt(w.length - 1); return (c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28) ? '이' : '가'; };
const eul = w => { const c = w.charCodeAt(w.length - 1); return (c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28) ? '은' : '는'; };
function lifeRow(name, sub, rise, half, me, maxW) {
  const W = x => Math.max(12, x / maxW * 88);
  const up = rise ? `<div class="seg-up" style="flex:0 0 ${W(rise)}%">🚀 ${rise}주</div>` : `<div class="seg-up" style="flex:0 0 ${W(22)}%">🚀 꾸준히</div>`;
  const dn = half ? `<div class="seg-dn" style="flex:0 0 ${W(half)}%">📉 ${half}주</div>` : `<div class="seg-dn seg-na" style="flex:1 1 auto">아직 안 떨어짐</div>`;
  return `<div class="life-row${me ? ' me' : ''}"><div class="life-name">${name}<small>${sub}</small></div><div class="life-track">${up}${dn}</div></div>`;
}
function renderFindings(k) {
  const v = entry(k).v, J = eul(k);
  const others = Object.keys(D.kw).filter(n => n !== '모찌류(합산)' && !D.kw[n].cal && n !== k).length;
  document.getElementById('f-sub').textContent = `'${k}'을(를) 다른 디저트 ${others}종과 비교했어요. 위에서 디저트를 바꾸면 아래도 같이 바뀌어요.`;
  // ① 유행의 수명
  const tot = (r, h) => (r || 22) + (h || 30);
  const maxW = Math.max(60, tot(v.rise, v.half), tot(AVG.fast.rise, AVG.fast.half), tot(AVG.slow.rise, AVG.slow.half)) * 1.02;
  document.getElementById('f1-title').textContent = `${k}의 유행 수명`;
  document.getElementById('f1-bars').innerHTML =
    lifeRow(k, '지금 보는 디저트', v.rise, v.half, true, maxW) +
    lifeRow('급하게 뜬 디저트', `${AVG.fast.n}종 중앙값 · 흑당·탕후루 등`, AVG.fast.rise, AVG.fast.half, false, maxW) +
    lifeRow('천천히 뜬 디저트', `${AVG.slow.n}종 중앙값 · 소금빵·베이글 등`, AVG.slow.rise, AVG.slow.half, false, maxW);
  let l1;
  if (v.type === '진행중') l1 = `${k}${J} 아직 피크가 진행 중이에요. ` + (v.rise ? `지금까지 ${v.rise}주 동안 올랐어요. ` : '') + `급하게 뜬 디저트는 보통 ${AVG.fast.half}주 만에 반토막이 났으니, 기간 한정으로 빠르게 내는 게 안전해요.`;
  else if (!v.rise) l1 = `${k}${J} 처음부터 꾸준히 검색된 디저트예요. 갑자기 뜬 유행이 아니라 오래 찾는 기본 메뉴에 가까워요.`;
  else if (v.rise <= 20) l1 = `${k}${J} ${v.rise}주 만에 급하게 떴어요. 이런 디저트는 보통 ${AVG.fast.half}주 만에 반토막이 났고, ${k}${J} ${v.half ? v.half + '주' : '아직'} 만에 절반으로 줄었어요.`;
  else if (v.rise >= 40) l1 = `${k}${J} ${v.rise}주에 걸쳐 천천히 떴어요. 천천히 뜬 디저트는 반토막까지 보통 ${AVG.slow.half}주가 걸려서, 오래 가는 편이에요.`;
  else l1 = `${k}${J} ${v.rise}주 동안 올라서 급하게 뜬 디저트와 천천히 뜬 디저트의 중간이에요.`;
  document.getElementById('f1-lead').textContent = l1;
  // ② 지금도 찾는 순위
  const list = Object.entries(D.kw).filter(([n, x]) => n !== '모찌류(합산)' && !x.cal).map(([n, x]) => ({ n, now: x.now, rise: x.rise, type: x.type }));
  if (LIVE[k]) list.push({ n: k, now: v.now, rise: v.rise, type: v.type });
  list.sort((a, b) => b.now - a.now);
  const col = x => x.type === '진행중' || !x.rise ? '#c9c3b0' : x.rise <= 20 ? css('--teal') : x.rise < 40 ? css('--pop-y') : css('--pop-b');
  const mx = Math.max(...list.map(x => x.now));
  document.getElementById('f2-rank').innerHTML = list.map((x, i) => `<div class="rk${x.n === k ? ' me' : ''}"><span class="no">${i + 1}</span><span class="nm">${x.n}</span><span class="bar" style="width:${Math.max(2, x.now / mx * 100)}%;background:${col(x)}"></span><span class="pc">${x.n === k ? '👉 ' : ''}${x.now}%</span></div>`).join('');
  const rank = list.findIndex(x => x.n === k) + 1;
  document.getElementById('f2-title').textContent = `지금도 찾는 디저트 순위: ${k} ${rank}위`;
  document.getElementById('f2-lead').textContent = `${k}${J} 지금 검색량이 최고점의 ${v.now}%로, ${list.length}종 중 ${rank}위예요.` + (v.type === '진행중' ? ' 지금이 최고점 근처라 위쪽에 있어요.' : '');
  // ③ 디저트 달력
  const sv = v.season, smin = Math.min(...sv), smax = Math.max(...sv), pm = sv.indexOf(smax), amp = smin > 0 ? smax / smin : 1;
  const seasonal = amp >= 1.6, go = [(pm + 10) % 12, (pm + 11) % 12];
  const shade = x => { const t = Math.max(0, Math.min(1, (x - 0.6) / 1.6)); const c = (a, b) => Math.round(a + (b - a) * t); return [`rgb(${c(255, 255)},${c(243, 90)},${c(224, 31)})`, t > .55 ? '#fff' : css('--ink')]; };
  document.getElementById('f3-cal').innerHTML = sv.map((x, i) => { const [bg, fg] = shade(x);
    const stk = i === pm ? '<i class="stk">🔥 대목</i>' : (seasonal && go.includes(i) ? '<i class="stk go">출시!</i>' : '');
    return `<div class="mo" style="background:${bg};color:${fg}">${stk}<b>${i + 1}월</b><span>${x.toFixed(1)}배</span></div>`; }).join('');
  document.getElementById('f3-title').textContent = `${k} 달력`;
  document.getElementById('f3-lead').textContent = seasonal
    ? `${k}${J} ${pm + 1}월에 가장 많이 찾아요 (연평균의 ${smax.toFixed(1)}배). ${go[0] + 1}~${go[1] + 1}월에 출시하면 대목을 잡을 수 있어요.`
    : `${k}${J} 계절을 크게 타지 않아요. 가장 많이 찾는 ${pm + 1}월도 연평균의 ${smax.toFixed(1)}배 정도라, 출시 달보다 유행 단계가 더 중요해요.`;
  // '그래서?' 한 줄: 근거를 사장님 결정으로 바꿔 말하기
  document.getElementById('f1-so').textContent = v.type === '진행중' ? '아직 오르는 중이라 언제 꺾일지 몰라요. 오래 팔 메뉴보다 짧게 파는 한정 메뉴가 안전해요.'
    : !v.rise ? '갑자기 뜬 유행이 아니라 오래 찾는 맛이에요. 정규 메뉴로 두기 좋아요.'
    : v.rise <= 20 ? '급하게 뜬 만큼 빨리 식는 편이에요. 큰 투자보다는 짧게 파는 메뉴로 생각하세요.'
    : v.rise >= 40 ? '천천히 오른 만큼 오래 가는 편이에요. 길게 팔 메뉴로 생각해도 돼요.'
    : '빠르지도 느리지도 않은 편이에요. 반응을 보면서 판매 기간을 정하세요.';
  document.getElementById('f2-so').textContent = v.now >= 25 ? `지금도 최고 때의 ${v.now}%만큼 찾아서, 찾는 사람은 충분해요.`
    : v.now >= 10 ? `최고 때의 ${v.now}%만 남았어요. 찾는 사람이 줄고 있으니 크게 걸지 마세요.`
    : `최고 때의 ${v.now}%로 거의 안 찾아요. 새로 내기엔 손님이 적어요.`;
  document.getElementById('f3-so').textContent = v.type === '유행형' ? '대목 달이 있긴 하지만, 유행이 식은 영향이 더 커요. 달력만 보고 새로 내지 마세요.' : seasonal ? `${go[0] + 1}~${go[1] + 1}월에 내고, ${pm + 1}월 대목이 지나면 내리세요.` : '언제 내도 큰 차이가 없어요. 출시 달보다 지금 유행 단계를 보고 정하세요.';
  document.getElementById('f4-so').textContent = v.type === '진행중' ? '아직 가게가 몰리기 전이에요. 남들보다 먼저 들어가야 유리해요.'
    : v.type === '시즌형' ? '계절을 타는 디저트라 전문점을 새로 차리기보다, 지금 가게의 시즌 메뉴로 내는 게 안전해요.'
    : v.type === '정착형' ? '검색이 정점을 지나도 가게가 계속 늘어요. 오래 팔 메뉴로 괜찮아요.'
    : '검색이 꺾인 뒤에 연 가게는 1년 안에 많이 닫았어요. 지금 새 가게나 단독 메뉴로 들어가는 건 피하세요.';
  renderPlan(k, v, entry(k).shop);
  // 과일모찌 사례는 과일모찌를 볼 때만
  document.getElementById('case-mochi').hidden = k !== '과일모찌';
  // ④ 표에서 지금 디저트 강조
  document.querySelectorAll('#shop-table tbody tr').forEach(tr => tr.classList.toggle('me', tr.dataset.k === SHOPMAP[k]));
}



/* ---------- 데이터 품질 경고 ---------- */
function warnings(k, v, st) {
  const w = [], name = k.replace(/\s/g, '');
  const zs = v.zeroShare ?? (v.s.filter(x => x !== null && x < 0.5).length / v.s.length);
  if (zs > 0.3) w.push(`검색량이 0에 가까운 주가 ${Math.round(zs * 100)}%예요. 검색이 적은 단어라 유형 판단이 흔들릴 수 있어요.`);
  if (v.type === '진행중' && (v.pre52 ?? 0) < 5) w.push('최근에 갑자기 생긴 단어라 유행형인지 정착형인지 판단하기엔 아직 일러요.');
  if (name.length === 1) w.push(`'${k}'처럼 한 글자 단어는 다른 뜻의 검색과 가게 이름이 섞일 수 있어요.`);
  if (st && st.total > 0 && st.total < 20) w.push(`상호에 '${name}'이 들어간 가게가 ${st.total}곳뿐이라 매장 수는 참고만 해 주세요.`);
  if (st && st.total === 0) w.push(`상호에 '${name}'이 들어간 가게가 없어요. 메뉴로만 파는 경우는 셀 수 없어요.`);
  if (st && st.capped) w.push('가게가 너무 많아 일부만 분석했어요.');
  if (k === '과일모찌' || k === '모찌떡' || k === '찹쌀모찌') w.push("'모찌' 한 단어는 네이버에서 집계되지 않아 연관 검색어로 대신 봤어요.");
  const box = document.getElementById('warnbox');
  box.hidden = !w.length;
  document.getElementById('warn-list').innerHTML = w.map(x => `<li>${x}</li>`).join('');
}

/* ---------- 내 가게 프로필 ---------- */
const REQ = {
  '흑당': { eq: ['에스프레소 머신'], cat: '음료', ing: ['흑당', '우유', '타피오카'], price: 5500, alt: '흑당 라떼' },
  '크로플': { eq: ['와플 기계'], cat: '디저트', ing: ['크루아상 생지', '버터', '생크림'], price: 6000 },
  '마라탕': { eq: ['화구'], cat: '식사', ing: ['마라 소스'], price: 10000 },
  '탕후루': { eq: ['화구'], cat: '디저트', ing: ['과일', '설탕'], price: 4000, alt: '탕후루 토핑 에이드' },
  '약과': { eq: ['튀김기'], cat: '디저트', ing: ['밀가루', '조청', '참기름'], price: 3500, alt: '약과 완제품 + 음료 세트' },
  '요거트 아이스크림': { eq: ['아이스크림 기계'], cat: '디저트', ing: ['요거트', '과일', '그래놀라'], price: 7000, alt: '요거트 스무디' },
  '두바이 초콜릿': { eq: [], cat: '디저트', ing: ['피스타치오', '카다이프', '초콜릿'], price: 8000 },
  '마카롱': { eq: ['오븐'], cat: '디저트', ing: ['아몬드가루', '달걀흰자', '버터크림'], price: 3000, alt: '마카롱 완제품 납품' },
  '뚱카롱': { eq: ['오븐'], cat: '디저트', ing: ['아몬드가루', '버터크림'], price: 4000, alt: '마카롱 완제품 납품' },
  '소금빵': { eq: ['오븐'], cat: '베이커리', ing: ['버터', '밀가루'], price: 3500, alt: '냉동 생지 구매 후 굽기' },
  '베이글': { eq: ['오븐'], cat: '베이커리', ing: ['밀가루', '크림치즈'], price: 4500, alt: '베이글 납품 + 크림치즈 직접' },
  '달고나': { eq: ['화구'], cat: '음료', ing: ['설탕', '베이킹소다', '우유'], price: 5500, alt: '달고나 라떼' },
  '피스타치오': { eq: ['에스프레소 머신'], cat: '음료', ing: ['피스타치오', '우유'], price: 6500, alt: '피스타치오 라떼' },
  '말차': { eq: ['에스프레소 머신'], cat: '음료', ing: ['말차', '우유'], price: 6000, alt: '말차 라떼' },
  '흑임자': { eq: ['블렌더'], cat: '음료', ing: ['흑임자', '우유'], price: 6000, alt: '흑임자 라떼' },
  '쑥': { eq: ['블렌더'], cat: '음료', ing: ['쑥', '우유'], price: 6000, alt: '쑥 라떼' },
  '딸기모찌': { eq: ['찜기'], cat: '디저트', ing: ['찹쌀가루', '딸기', '팥'], price: 4500 },
  '찹쌀떡': { eq: ['찜기'], cat: '디저트', ing: ['찹쌀가루', '팥'], price: 2500, alt: '찹쌀떡 완제품 + 음료 세트' },
  '모찌떡': { eq: ['찜기'], cat: '디저트', ing: ['찹쌀가루', '생크림'], price: 4500 },
  '찹쌀모찌': { eq: ['찜기'], cat: '디저트', ing: ['찹쌀가루', '팥'], price: 4000 },
  '과일모찌': { eq: ['찜기'], cat: '디저트', ing: ['찹쌀가루', '과일', '생크림'], price: 5500, alt: '과일모찌 완제품 납품' },
};
function guessReq(k) {
  const n = k.replace(/\s/g, ''), has = (...a) => a.some(x => n.includes(x));
  if (has('라떼', '티', '에이드', '스무디', '커피', '주스', '쉐이크')) return { eq: has('스무디', '쉐이크', '주스') ? ['블렌더'] : ['에스프레소 머신'], cat: '음료', ing: [], price: 6000 };
  if (has('빵', '베이글', '스콘', '쿠키', '케이크', '타르트', '휘낭시에', '까눌레', '마들렌', '파이', '머핀', '브라우니')) return { eq: ['오븐'], cat: '베이커리', ing: [], price: 4000, alt: `${k} 납품받기` };
  if (has('빙수', '아이스크림', '젤라또', '소르베')) return { eq: ['아이스크림 기계'], cat: '디저트', ing: [], price: 8000 };
  if (has('모찌', '떡', '찹쌀')) return { eq: ['찜기'], cat: '디저트', ing: ['찹쌀가루'], price: 4000 };
  if (has('와플', '크로플')) return { eq: ['와플 기계'], cat: '디저트', ing: [], price: 6000 };
  if (has('도넛', '츄러스', '튀김', '꽈배기')) return { eq: ['튀김기'], cat: '디저트', ing: [], price: 3500 };
  return null;
}
const PF_KEY = 'dessert-timing-profile';
function loadProfile() { try { return JSON.parse(localStorage.getItem(PF_KEY)) || null; } catch { return null; } }
function saveProfile(p) { try { localStorage.setItem(PF_KEY, JSON.stringify(p)); } catch {} cloudSoon('profile'); refreshClock(); }
function readForm() {
  const f = document.getElementById('profile');
  return { cat: f.querySelector('[name=pf-cat]:checked')?.value || '', price: f.querySelector('[name=pf-price]:checked')?.value || '',
    eq: [...f.querySelectorAll('[name=pf-eq]:checked')].map(x => x.value),
    ban: document.getElementById('pf-ban').value.split(',').map(x => x.trim()).filter(Boolean),
    name: (document.getElementById('pf-name').value || '').trim() };
}
function fillName(p) { document.getElementById('pf-name').value = (p && p.name) || ''; }
function fillForm(p) {
  if (!p) return; const f = document.getElementById('profile');
  f.querySelectorAll('[name=pf-cat]').forEach(x => x.checked = x.value === p.cat);
  f.querySelectorAll('[name=pf-price]').forEach(x => x.checked = x.value === p.price);
  f.querySelectorAll('[name=pf-eq]').forEach(x => x.checked = (p.eq || []).includes(x.value));
  document.getElementById('pf-ban').value = (p.ban || []).join(', ');
}
const hasProfile = p => p && (p.cat || p.price || (p.eq || []).length || (p.ban || []).length);
function fitCard(k) {
  const p = loadProfile();
  if (!hasProfile(p)) return ['내 가게', '가게 프로필을 넣어 보세요', '위의 🏪 내 가게 프로필에 장비와 가격대를 넣으면 우리 가게에서 만들 수 있는지 알려드려요.'];
  const r = REQ[k] || guessReq(k);
  if (!r) return ['내 가게', '이 디저트는 장비 정보가 아직 없어요', '목록에 없는 디저트라 필요한 장비를 판단하지 못했어요.'];
  const lines = [], missing = r.eq.filter(e => !(p.eq || []).includes(e));
  if (!r.eq.length || !missing.length) lines.push(`<span class="ok">✔ 지금 장비로 만들 수 있어요</span>`);
  else { const m = missing.join(', '); lines.push(`<span class="no">✖ ${m}${iga(m)} 필요해요</span>${r.alt ? ` → 대안: ${r.alt}` : ''}`); }
  if (p.cat && r.cat !== p.cat && r.cat !== '식사') lines.push(p.cat === '음료' ? `음료 중심 가게라면 ${k} 맛 음료나 음료 + ${k} 세트로 응용해 보세요.` : `주력 분야(${p.cat})와 달라 사이드 메뉴로 두는 게 좋아요.`);
  if (p.price) { const [lo, hi] = p.price.split('-').map(Number);
    if (r.price > hi * 1.3) lines.push(`보통 ${r.price.toLocaleString()}원대라 가격대보다 비싸요. 미니 사이즈로 내 보세요.`);
    else if (r.price < lo * 0.7) lines.push(`보통 ${r.price.toLocaleString()}원대라 음료와 세트로 묶으면 객단가가 맞아요.`);
    else lines.push(`보통 ${r.price.toLocaleString()}원대라 가격대와 잘 맞아요.`); }
  const bad = (p.ban || []).filter(b => r.ing.some(i => i.includes(b) || b.includes(i)));
  if (bad.length) lines.push(`<span class="no">쓰지 않는 재료(${bad.join(', ')})가 들어가요.</span> 빼거나 바꿔야 해요.`);
  return ['내 가게', `우리 가게에서 ${k}`, lines.join('<br>')];
}
function profileSummary() {
  const p = loadProfile(), el = document.getElementById('pf-sum');
  el.textContent = hasProfile(p) ? [p.cat, p.price && p.price.replace('-', '~') + '원', (p.eq || []).length ? `장비 ${p.eq.length}개` : '', (p.ban || []).length ? `금기 ${p.ban.length}개` : ''].filter(Boolean).join(' · ') : '넣으면 우리 가게에서 만들 수 있는지 알려드려요';
}
fillForm(loadProfile()); fillName(loadProfile()); profileSummary();
document.getElementById('profile').addEventListener('change', () => { saveProfile(readForm()); profileSummary(); if (current) renderPlan(current, entry(current).v, entry(current).shop); });
['pf-ban', 'pf-name'].forEach(id => document.getElementById(id).addEventListener('input', () => { saveProfile(readForm()); profileSummary(); if (current) renderPlan(current, entry(current).v, entry(current).shop); }));

/* ---------- 기획 제안: 고른 디저트에 맞춰 ---------- */
// 단계·메뉴 목적 상태 (renderPlan이 처음 그려질 때도 쓰므로 위쪽에 둔다)
let STEP = 1, REACHED = 1, MADE = false, GOAL = null, GOAL_K = null;
const GOAL_OF = { '진행중': '기간 한정', '정착형': '정규 메뉴', '시즌형': '시즌 메뉴', '유행형': 'SNS 인증용', '관망형': 'SNS 인증용' };
const GOAL_TIP = {
  '기간 한정': ['4~8주만 팔고 끝내기', '"○○ 한정"이라는 이름과 끝나는 날을 미리 알리면 지금 사야 할 이유가 생겨요. 재료는 한정 기간만큼만 들이세요.'],
  '정규 메뉴': ['1년 내내 팔 기본기 만들기', '재료를 늘 구하기 쉽고 직원 누구나 같은 맛을 낼 수 있게 레시피를 단순하게 정하세요. 원가가 계절 따라 흔들리지 않는지도 보세요.'],
  'SNS 인증용': ['사진 찍고 싶은 한 장면 정하기', '단면·색감·높이 중 하나를 확실히 살리고, 자연광 자리와 포장까지 같이 준비하세요. 해시태그 이벤트와 함께하면 좋아요.'],
  '시즌 메뉴': ['매년 같은 때 다시 내기', '제철 재료와 계절 이름을 쓰고, 대목 1~2달 전에 미리 알리세요. 올해 반응을 기록해 두면 내년에 그대로 다시 쓸 수 있어요.'],
};
function renderPlan(k, v, st) {
  const sv = v.season, smax = Math.max(...sv), smin = Math.min(...sv), pm = sv.indexOf(smax) + 1;
  const seasonal = smin > 0 && smax / smin >= 1.6, b1 = ((pm + 9) % 12) + 1, b2 = ((pm + 10) % 12) + 1;
  const J = eul(k), shopTxt = st && st.alive_max ? `전국 가게 ${st.open_now.toLocaleString()}곳 (최고 ${st.alive_max.toLocaleString()}곳)` : '';
  const late = st && st.close1y_after !== null ? `피크 뒤에 연 가게 ${st.close1y_after}%가 1년 안에 문을 닫았어요.` : '';
  let cards;
  switch (v.type) {
    case '진행중': cards = [
      ['지금', `${k} 기간 한정 메뉴 바로 출시`, `검색량이 전년보다 ${sign(v.yoy)}. 지금이 가장 뜨거울 때예요.`],
      ['확인', '4주마다 검색량 다시 보기', `급하게 뜬 디저트는 보통 ${AVG.fast.half}주 만에 반토막이 났어요. 꺾이면 바로 정리해요.`],
      ['확장', seasonal ? `${pm}월 대목에 맞춘 시즌 패키지` : '반응 좋으면 정규 메뉴 후보로', shopTxt ? `${shopTxt}. 경쟁 가게가 늘어나는 속도도 같이 봐요.` : '경쟁 가게 수도 같이 지켜봐요.']];
      break;
    case '유행형': cards = [
      ['피하기', `${k} 단독 신메뉴는 비추천`, `${v.peak}에 피크를 지났고 지금은 피크의 ${v.now}%예요.`],
      ['활용', `${k} 맛을 토핑·소재로`, `음료나 다른 디저트에 ${k} 맛을 살짝 얹는 정도로 가볍게 써요.`],
      ['교훈', '다음 유행은 더 일찍', late || `급하게 뜬 디저트는 보통 ${AVG.fast.half}주 만에 반토막이 났어요.`]];
      break;
    case '정착형': cards = [
      ['정규', `${k}${J} 정규 메뉴로`, `피크가 지나도 ${v.now}%를 유지하는 오래 가는 디저트예요.`],
      ['확장', `${k} 맛·구성 라인업`, `기본 + 시즌 맛 + 세트처럼 2~3종으로 넓혀 객단가를 올려요.`],
      ['타이밍', v.yoy > 20 ? '다시 오르는 지금이 확장 적기' : '신메뉴보다 품질·차별화', v.yoy > 20 ? `전년보다 ${sign(v.yoy)} 다시 찾고 있어요.` : (shopTxt ? `${shopTxt}. 이미 경쟁이 있으니 맛으로 차별화해요.` : '이미 익숙한 메뉴라 맛으로 차별화해요.')]];
      break;
    case '시즌형': cards = [
      ['일정', `${b1}~${b2}월 출시 고정`, `매년 ${pm}월에 연평균의 ${smax.toFixed(1)}배까지 찾아요.`],
      ['대목', `${pm}월 한정 패키지`, '선물 세트나 시즌 한정 맛으로 대목 매출을 키워요.'],
      ['비수기', '비수기엔 줄이거나 쉬기', `검색이 연평균보다 낮은 달엔 재고를 줄여요.${shopTxt ? ' ' + shopTxt + '.' : ''}`]];
      break;
    default: cards = [
      ['주의', `${k} 신규 진입은 신중하게`, `피크(${v.peak}) 대비 ${v.now}%가 남았고 전년보다 ${v.yoy === null ? '–' : sign(v.yoy)}예요.`],
      ['리뉴얼', '기존 메뉴를 새롭게', `이미 ${k}${reul(k)} 판다면 맛이나 모양을 바꿔 다시 알리는 편이 나아요.`],
      ['근거', '늦게 들어가면 위험', late || '피크가 지난 뒤 들어간 가게일수록 오래 버티기 어려웠어요.']];
  }
  document.getElementById('p-h2').textContent = `${k} 기획 제안`;
  const lb = document.getElementById('mk-label'); if (lb && lb.dataset.k !== k) { lb.dataset.k = k; lb.textContent = `${k}로 신메뉴 만들기`; const o = document.getElementById('mk-out'); if (o) o.innerHTML = ''; }
  document.getElementById('p-sub').textContent = `${k}${J} '${v.type}'이라 이렇게 해보면 좋아요.`;
  const fit = fitCard(k);
  // 고른 메뉴 목적에 따라 실행 팁 상자 하나 (유행 단계와 안 맞으면 한마디 덧붙임)
  const g = (GOAL_K === k && GOAL) || GOAL_OF[v.type] || '기간 한정', gt = GOAL_TIP[g];
  let gw = '';
  if (g === '정규 메뉴' && (v.type === '유행형' || v.type === '진행중')) gw = ` 다만 ${k}${J} 지금 '${v.type}'이라 오래 갈지 아직 몰라요. 한정으로 먼저 시험해 보세요.`;
  if (g === '시즌 메뉴' && !seasonal) gw = ` 다만 ${k}${J} 계절을 크게 타지 않아서 시즌 효과는 작을 수 있어요.`;
  if (g === '시즌 메뉴' && seasonal) gw = ` ${k}${J} ${b1}~${b2}월에 내면 ${pm}월 대목을 잡을 수 있어요.`;
  if (g === '기간 한정' && v.type === '유행형') gw = ` ${k}${J} 유행이 지나서, 한정이라도 2~4주로 짧게 잡으세요.`;
  document.getElementById('p-plan').innerHTML = `<div class="pl gtip"><span class="k">${g}</span><b>${gt[0]}</b><p>${gt[1]}${gw}</p></div>` +
    cards.map(([t, h, p]) => `<div class="pl"><span class="k">${t}</span><b>${h}</b><p>${p}</p></div>`).join('') +
    `<div class="pl fit"><span class="k">${fit[0]}</span><b>${fit[1]}</b><p>${fit[2]}</p></div>` +
    `<div class="pl mkc" id="pl-mkt"><span class="k">시장가</span><b>다른 카페 가격을 찾는 중…</b><p>네이버 블로그 후기에서 가격을 모으고 있어요.</p></div>`;
  setTimeout(() => fillPlanMarket(k));   // 아래쪽 MKT_CACHE 선언 뒤에 돌도록 (처음 그릴 때 TDZ 방지)
  document.querySelectorAll('#p-table tbody tr').forEach(tr => tr.classList.toggle('me', tr.dataset.t === v.type));
}


/* ---------- 이 디저트로 신메뉴 만들기 (AI + 원가 검증) ---------- */
const mkBtn = document.getElementById('mk-btn'), mkMsg = document.getElementById('mk-msg'), mkOut = document.getElementById('mk-out');
const won = n => Math.round(n).toLocaleString() + '원';
/* ---------- 1단계: 우리 가게에 맞는 디저트 추천 ---------- */
const EMO = { '과일모찌': '🍡', '딸기모찌': '🍓', '찹쌀모찌': '🍡', '모찌떡': '🍡', '찹쌀떡': '🍙', '약과': '🍪', '두바이 초콜릿': '🍫', '소금빵': '🥐', '베이글': '🥯',
  '크로플': '🧇', '탕후루': '🍢', '마카롱': '🍬', '뚱카롱': '🍬', '흑당': '🧋', '달고나': '🍯', '요거트 아이스크림': '🍦', '피스타치오': '🥜', '말차': '🍵', '흑임자': '⚫', '쑥': '🌿' };
function recommend(p) {
  const now = new Date().getMonth() + 1, have = p.eq || [];
  const [lo, hi] = p.price ? p.price.split('-').map(Number) : [0, 1e9];
  return Object.entries(REQ).filter(([k, r]) => r.cat !== '식사' && D.kw[k]).map(([k, r]) => {
    const v = D.kw[k], why = []; let s = 0;
    if (v.type === '진행중') { s += 3; why.push(`지금 검색이 역대 최고 수준 (전년 대비 ${sign(v.yoy)})`); }
    else if (v.type === '정착형') { s += 2; why.push('몇 년째 꾸준히 찾는 정착형이라 정규 메뉴로 좋아요'); }
    else if (v.type === '시즌형') { const d = (v.smonth - now + 12) % 12;
      if (d >= 1 && d <= 3) { s += 2.5; why.push(`대목(${v.smonth}월)까지 ${d}개월, 지금 준비하기 딱 좋아요`); }
      else if (d === 0) { s += 1; why.push(`지금이 대목(${v.smonth}월)이에요`); }
      else { s -= 0.5; why.push({ w: `대목은 ${v.smonth}월이라 지금은 조금 일러요` }); } }
    else if (v.type === '유행형') { s -= 3; why.push({ w: '유행이 이미 식어서 단독 메뉴는 위험해요' }); }
    else { s -= 0.5; why.push({ w: '검색 피크가 지나 신중하게 보세요' }); }
    const miss = r.eq.filter(e => !have.includes(e));
    if (!miss.length) { s += 2; why.push(r.eq.length ? `가진 장비(${r.eq.join('·')})로 바로 만들 수 있어요` : '특별한 장비 없이 만들 수 있어요'); }
    else if (r.alt) { s -= 1; why.push({ w: `${miss.join('·')}${iga(miss[miss.length - 1])} 없으면 '${r.alt}'${ro(r.alt)} 대신해요` }); }
    else s -= 4;
    if (p.cat && r.cat === p.cat) s += 1.5; else if (p.cat === '디저트' && r.cat === '베이커리') s += 0.5;
    if (p.price && r.price >= lo && r.price <= hi) { s += 1; why.push(`고른 가격대에 맞아요 (보통 ${won(r.price)})`); }
    const ev = upcoming(k, 56)[0];
    if (ev && v.type !== '유행형') { s += 1; why.push(`${evTxt(ev)}${ev.left ? ' 남아' : '라'} 선물 수요가 있어요`); }
    return { k, s, why };
  }).sort((a, b) => b.s - a.s).slice(0, 3);
}
const REC = { cat: '', eq: [], price: '' };
function renderRecForm() {
  const f = document.getElementById('profile'), lab = x => x.closest('label').textContent.trim();
  [['cat', 'pf-cat'], ['eq', 'pf-eq'], ['price', 'pf-price']].forEach(([q, nm]) => {
    const box = document.querySelector(`.rq-o[data-q="${q}"]`);
    box.innerHTML = [...f.querySelectorAll(`[name=${nm}]`)].map(x => `<button type="button" data-v="${x.value}" aria-pressed="${q === 'eq' ? REC.eq.includes(x.value) : REC[q] === x.value}">${lab(x)}</button>`).join('');
    box.querySelectorAll('button').forEach(b => b.onclick = () => {
      const v = b.dataset.v;
      if (q === 'eq') REC.eq = REC.eq.includes(v) ? REC.eq.filter(x => x !== v) : [...REC.eq, v]; else REC[q] = REC[q] === v ? '' : v;
      renderRecForm();
    });
  });
}
function runRec() {
  const msg = document.getElementById('rec-msg');
  if (!REC.cat) { msg.textContent = '① 가게 종류를 먼저 골라 주세요.'; return; }
  const p = Object.assign(loadProfile() || {}, { cat: REC.cat, eq: REC.eq, price: REC.price });
  saveProfile(p); fillForm(p); if (typeof profileSummary === 'function') profileSummary();
  const xs = recommend(p); track('rec', '', '', { cat: p.cat, eq: (p.eq || []).length, price: p.price || '', top: xs.map(x => x.k) });
  document.getElementById('rec-out').innerHTML = xs.map((x, i) => `<button type="button" class="rc" data-k="${x.k}"><span class="rc-no">추천 ${i + 1}</span>
    ${IMG[x.k] ? `<span class="rc-ph">${photo(x.k)}</span>` : `<span class="rc-em">${EMO[x.k] || "🍰"}</span>`}<span class="rc-nm">${esc(x.k)}</span>
    <ul>${x.why.map(w => typeof w === 'string' ? `<li>${esc(w)}</li>` : `<li class="warn">${esc(w.w)}</li>`).join('')}</ul>
    <span class="go">타이밍 진단 보기 →</span></button>`).join('');
  document.querySelectorAll('#rec-out .rc').forEach(b => b.onclick = () => { select(b.dataset.k); goStep(2); });
  msg.textContent = REC.eq.length ? '카드를 누르면 바로 타이밍 진단으로 넘어가요.' : '장비를 고르지 않아서 장비 없이 만들 수 있는 걸 앞에 뒀어요. 카드를 누르면 진단으로 넘어가요.';
}
document.getElementById('rec-btn').addEventListener('click', runRec);
{ const p0 = loadProfile(); if (p0) { REC.cat = p0.cat || ''; REC.eq = p0.eq || []; REC.price = p0.price || ''; } }
const PICK_PRICE = {};   // 시장가 카드에서 고른 판매가 (디저트별)
function menuPrice(k, p) {
  if (PICK_PRICE[k]) return PICK_PRICE[k];
  const r = REQ[k] || guessReq(k);
  if (p && p.price) { const [lo, hi] = p.price.split('-').map(Number); return Math.round((lo + hi) / 2 / 100) * 100; }
  return r ? r.price : 5500;
}
// AI가 만든 메뉴 카드 (결과 화면과 보관함에서 같이 씀)
// ---------- 가격 비교: 원가 기준 최소가 · 다른 카페 보통 가격(네이버 블로그 후기) · 내 목표가 ----------
const MKT_CACHE = {};
const areaWord = () => { let s = ''; try { s = localStorage.getItem(LC_KEY) || ''; } catch {}
  const w = s.split(' ').slice(1).join(' ').split(' ').pop() || ''; return w.length > 2 ? w.replace(/[시군구]$/, '') : w; };
function mktHTML(m) {
  const mk = m.market, minP = Math.ceil(m.cost / ((m.target || 30) / 100) / 100) * 100;
  const ok = x => x && x.ok && x.n >= 5, base = mk && (ok(mk.area) ? mk.area : ok(mk.all) ? mk.all : null);
  const row = (x, label) => ok(x) ? `<div><span>${label} <small>후기 ${x.n}개</small></span><b>${won(x.median)}</b><small>대부분 ${won(x.p25)}~${won(x.p75)}</small></div>` : '';
  let say = '';
  if (m.price < minP) say = `원가율 ${m.target}%를 맞추려면 <b>최소 ${won(minP)}</b>은 받아야 해요.`;
  if (base) { const d = m.price - base.median, where = base === mk.area ? `${esc(mk.area.area)} 카페` : '다른 카페';
    say += (say ? ' ' : '') + (d >= 500 ? `${where}보다 <b>${won(d)} 비싸요.</b> 크기·토핑·포장으로 차이를 보여 주세요.`
      : d <= -500 ? `${where}보다 <b>${won(-d)} 싸요.</b> 값을 조금 올려도 될 여지가 있어요.` : `${where}와 <b>비슷한 가격</b>이에요 ✅`); }
  const st = !mk ? '<p class="note">다른 카페 가격을 찾는 중…</p>'
    : base ? '' : `<p class="note">${mk.need === 'search' ? '다른 카페 가격은 준비 중이에요. (네이버 검색 연결 전)' : '가격이 적힌 후기가 적어서 다른 카페 보통 가격을 내기 어려워요.'}</p>`;
  const smp = base && base.samples && base.samples.length ? `<details class="mkt-s"><summary>가격이 나온 후기 보기</summary><ul>${base.samples.map(x =>
    `<li><b>${won(x[0])}</b> <a href="${esc(x[2])}" target="_blank" rel="noopener">${esc(x[1])}</a> <small>${x[3] ? x[3].slice(0, 4) + '.' + x[3].slice(4, 6) : ''}</small></li>`).join('')}</ul></details>` : '';
  return `<p class="mkt-h"><b>💰 가격 비교</b> <small>다른 카페 가격은 최근 1년 네이버 블로그 후기에서 '${esc(m.keyword || '')} ○,○○○원'을 모은 값이에요</small></p>
    <div class="mkt-g"><div><span>원가 기준 최소가 <small>원가율 ${m.target}%</small></span><b>${won(minP)}</b></div>
      ${mk ? row(mk.all, '다른 카페 보통') + row(mk.area, `${esc((mk.area && mk.area.area) || '')} 카페 보통`) : ''}
      <div class="me"><span>내 목표가</span><b>${won(m.price)}</b></div></div>
    ${say ? `<p class="mkt-say">${say}</p>` : ''}${st}${smp}`;
}
const marketGet = (q, a) => { const key = q + '|' + a;
  return MKT_CACHE[key] = MKT_CACHE[key] || fetch(`${LIVE_API}/price?q=${encodeURIComponent(q)}${a ? '&area=' + encodeURIComponent(a) : ''}`).then(r => r.json()).catch(() => ({ ok: false })); };
// 3단계 기획 카드 '시장가': 메뉴를 만들기 전에 다른 카페 가격을 먼저 보고, 그 가격으로 메뉴를 짠다
async function fillPlanMarket(k) {
  const box = document.getElementById('pl-mkt'); if (!box) return;
  const area = areaWord(), [all, ar] = await Promise.all([marketGet(k, ''), area ? marketGet(k, area) : null]);
  if (current !== k || !box.isConnected) return;
  const ok = x => x && x.ok && x.n >= 5, base = ok(all) ? all : ok(ar) ? ar : null;
  const p = loadProfile() || {}, def = PICK_PRICE[k] || (base ? base.median : menuPrice(k, p));
  const head = base ? `${esc(k)} 다른 카페 보통 ${won(base.median)}` : `${esc(k)} 시장가를 내기 어려워요`;
  const lines = base ? [`대부분 <b>${won(base.p25)}~${won(base.p75)}</b> <small>(후기 ${base.n}개)</small>`] : [all && all.need === 'search' ? '다른 카페 가격은 준비 중이에요.' : '가격이 적힌 후기가 적어요. 판매가를 직접 넣어 주세요.'];
  if (ok(ar) && base !== ar) lines.push(`${esc(ar.area)} 카페 보통 <b>${won(ar.median)}</b> <small>(후기 ${ar.n}개)</small>`);
  box.innerHTML = `<span class="k">시장가</span><b>${head}</b><p>${lines.join('<br>')}</p>
    <div class="mkc-f"><label>판매가 <input type="number" id="pl-price" min="1000" max="30000" step="100" value="${def}"> 원</label>
      <span class="mkc-c" id="pl-cost"></span></div>
    <button type="button" class="btn primary mkc-go" id="pl-go">이 가격으로 메뉴 짜기 →</button>`;
  const inp = box.querySelector('#pl-price'), cost = box.querySelector('#pl-cost');
  const upd = () => { const v = +inp.value || 0; cost.innerHTML = v ? `원가율 30%면 재료비 <b>${won(v * 0.3)}</b> 안에서` : ''; };
  inp.oninput = upd; upd();
  box.querySelector('#pl-go').onclick = () => { track('price_pick', k, '', { price: Math.round((+inp.value || 0) / 100) * 100, market: base ? base.median : null });
    const v = Math.round((+inp.value || 0) / 100) * 100; if (v < 1000) { inp.focus(); return; }
    PICK_PRICE[k] = v; inp.value = v;
    mkBtn.scrollIntoView({ behavior: 'smooth', block: 'center' }); makeMenu();
  };
}
async function fillMarket(m, box) {
  const q = m.keyword, area = areaWord(), get = a => marketGet(q, a);
  const [all, ar] = await Promise.all([get(''), area ? get(area) : null]);
  m.market = { all, area: ar, need: all && all.need };
  if (box && box.isConnected) box.innerHTML = mktHTML(m);
}
function menuCard(m, edit) {
  const ai = m.recipe.filter(x => x.source === 'AI 추정').length;
  return `<div class="mk-card">
      <span class="tag" style="background:var(--teal)">${m.kind}</span>${m.goal ? ` <span class="tag goal-tag">${esc(m.goal)}</span>` : ''}
      <h4>${esc(m.name)}</h4>
      <p>${esc(m.concept || '')}</p>
      ${m.goalFit ? `<p class="gfit"><b>🎯 ${esc(m.goal || '목적')}에 맞춘 점</b> ${esc(m.goalFit)}</p>` : ''}
      ${m.photo ? `<p class="gfit"><b>📸 사진 포인트</b> ${esc(m.photo)}</p>` : ''}
      <div class="meta">
        <div><span>판매가 (목표)</span><b>${won(m.price)}</b></div>
        <div><span>재료 원가</span><b>${won(m.cost)}</b></div>
        <div><span>원가율 (목표 ${m.target}%)</span><b class="${m.pass ? 'pass' : 'fail'}">${m.rate}% ${m.pass ? '✔' : '✖'}</b></div>
      </div>
      <div class="mkt">${mktHTML(m)}</div>
      <p><b>타깃</b> ${esc(m.targetCustomer || '')}</p>
      <p><b>판매 포인트</b> ${esc(m.point || '')}</p>
      <div style="overflow-x:auto"><table><thead><tr><th>재료</th><th class="num-r">사용량</th><th class="num-r">단가</th><th class="num-r">원가</th><th>단가 출처</th></tr></thead><tbody>
        ${m.recipe.map((x, i) => `<tr><td>${esc(x.ing)}</td><td class="num-r">${x.qty}${x.unit}</td><td class="num-r">${edit ? `<button type="button" class="up-edit" data-i="${i}" title="눌러서 우리 가게 단가로 고치기">${x.unit_price}원 ✎</button>` : `${x.unit_price}원`}</td><td class="num-r">${won(x.cost)}</td><td><span class="src${x.source === 'AI 추정' ? ' ai' : x.source === '내 원가표' ? ' my' : /KAMIS/.test(x.source) ? ' mk' : ''}">${x.source}</span>${x.vsMonth >= 10 ? ` <b class="up-mk">한 달 새 +${x.vsMonth}%</b>` : x.vsMonth <= -10 ? ` <b class="dn-mk">한 달 새 ${x.vsMonth}%</b>` : ''}</td></tr>`).join('')}
      </tbody></table></div>
      ${m.steps && m.steps.length ? `<p style="margin-top:10px"><b>만드는 순서</b></p><ol>${m.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
      <p style="margin-top:10px"><b>함께 팔기</b> ${esc(m.pairing || '')}</p>
      ${m.recipe.some(x => x.vsMonth >= 15) ? `<p class="gfit"><b>⚠️ 오른 재료</b> ${m.recipe.filter(x => x.vsMonth >= 15).map(x => `${esc(x.ing)} 한 달 새 +${x.vsMonth}%`).join(', ')}. 원가율을 다시 확인하거나 양을 조절해 보세요.</p>` : ''}
      <p class="note">AI 조정 ${m.tries.map(t => `${t.try}차 ${t.rate}%`).join(' → ')} · 마진 ${won(m.margin)} · 원가표 단가 기준일 ${m.priceDate}${ai ? ` · <b>AI 추정 단가 ${ai}개</b>는 실제 구매가로 확인이 필요해요${edit ? ' (단가를 눌러 고칠 수 있어요)' : ''}` : ''}${m.banned && m.banned.length ? ` · <b style="color:var(--teal-d)">쓰지 않는 재료(${m.banned.join(', ')})가 들어갔어요</b>` : ''}</p>
      <p class="note mk-disc">${esc(SITE_COPY.menuNote)}</p>
    </div>`;
}
// ---------- 내 메뉴 보관함 (이 브라우저에만 저장) ----------
const SAVE_KEY = 'dessert-timing-saved';
let LAST_MENU = null; const MADE_NAMES = {};
const loadSaved = () => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || []; } catch { return []; } };
const storeSaved = xs => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(xs)); } catch { } };
function saveMenu(x) {
  if (!x) return; const xs = loadSaved();
  const it = { id: Date.now(), at: new Date().toISOString().slice(0, 10), k: x.k, goal: x.goal, m: x.m };
  xs.unshift(it); storeSaved(xs.slice(0, 30)); renderSaved(); renderProg(); cloudAddMenu(it);
}
function renderSaved() {
  const xs = loadSaved(), box = document.getElementById('saved-list');
  document.getElementById('saved-n').textContent = xs.length ? `${xs.length}개` : '';
  const sc = document.getElementById('side-saved'); if (sc) { sc.textContent = xs.length ? `♡ 보관함에 메뉴 ${xs.length}개` : '';
    sc.onclick = e => { e.preventDefault(); if (current) goStep(3); setTimeout(() => document.getElementById('saved').scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); }; }
  if (!xs.length) { box.innerHTML = '<p class="note">마음에 드는 메뉴를 만들면 ♡ 보관함에 저장을 눌러 보세요. 이 브라우저에 저장돼요.</p>'; return; }
  box.innerHTML = xs.map(x => `<details class="sv" data-id="${x.id}"><summary><span class="sv-n">${esc(x.m.name)}</span>
      <span class="sv-m">${esc(x.k)}${x.goal ? ' · ' + esc(x.goal) : ''} · ${won(x.m.price)} · 원가율 ${x.m.rate}% · ${x.at}</span>
      <button type="button" class="sv-x" title="보관함에서 지우기" aria-label="지우기">×</button></summary>${menuCard(x.m)}</details>`).join('');
  box.querySelectorAll('.sv-x').forEach(b => b.onclick = e => { e.preventDefault(); const id = +b.closest('.sv').dataset.id;
    if (confirm('이 메뉴를 보관함에서 지울까요?')) { storeSaved(loadSaved().filter(x => x.id !== id)); renderSaved(); renderProg(); cloudDelMenu(id); } });
}
// 신메뉴 만드는 동안 보여 주는 진행 표시: 빙글 도는 표시 + 지난 시간 + 단계(대략) + 움직이는 막대. 끝나면 stop()으로 치움
function mkProgress() {
  const lab = document.getElementById('mk-label'), orig = lab.textContent, t0 = Date.now();
  const steps = [['재료 단가를 불러오는 중', 0], ['AI가 레시피를 짜는 중', 3], ['원가율을 계산하고 목표에 맞추는 중', 11]];
  mkOut.innerHTML = `<div class="mk-prog" role="status" aria-live="polite">
    <div class="mk-prog-top"><i class="mk-spin" aria-hidden="true"></i><b>신메뉴를 만들고 있어요</b><span id="mkp-s">0초</span></div>
    <div class="mk-bar" aria-hidden="true"><i></i></div>
    <ol>${steps.map(([t]) => `<li>${t}</li>`).join('')}</ol>
    <p class="note" id="mkp-n">보통 10~20초 걸려요. 이 화면을 닫지 말고 기다려 주세요. (단계는 대략적인 진행이에요)</p></div>`;
  const tick = () => {
    const sec = Math.floor((Date.now() - t0) / 1000);
    const cur = steps.reduce((c, [, at], i) => sec >= at ? i : c, 0);
    const sEl = document.getElementById('mkp-s'); if (sEl) sEl.textContent = `${sec}초`;
    document.querySelectorAll('.mk-prog li').forEach((li, i) => { li.className = i < cur ? 'done' : i === cur ? 'now' : ''; });
    const nEl = document.getElementById('mkp-n'); if (nEl && sec >= 30) nEl.textContent = '평소보다 조금 오래 걸리고 있어요. 계속 만드는 중이니 잠시만 더 기다려 주세요.';
    lab.textContent = `만드는 중… ${sec}초`;
  };
  tick(); const id = setInterval(tick, 500);
  return () => { clearInterval(id); lab.textContent = orig; if (mkOut.querySelector('.mk-prog')) mkOut.innerHTML = ''; };
}
// 메뉴 종류(디저트/음료): 기본은 고른 디저트 자신의 분야(흑당·달고나처럼 음료면 음료, 나머지는 디저트). 사장님이 3단계에서 바꿀 수 있음
const KIND_PICK = {};
function defaultKind(k) { const r = REQ[k] || guessReq(k); return r && r.cat === '음료' ? '음료' : '디저트'; }
const kindOf = k => KIND_PICK[k] || defaultKind(k);
function renderKind() {
  const box = document.getElementById('mk-kind'); if (!box || !current) return;
  box.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kind === kindOf(current))));
}
document.getElementById('mk-kind').addEventListener('click', e => { const b = e.target.closest('button[data-kind]'); if (!b || !current) return; KIND_PICK[current] = b.dataset.kind; renderKind(); });
async function makeMenu(again) {
  if (!current) return;
  const k = current, v = entry(k).v, p = loadProfile() || {}, r = REQ[k] || guessReq(k);
  const kind = kindOf(k);   // 가게 프로필의 분야(음료 중심 등)가 아니라, 고른 디저트 자체와 사장님이 고른 메뉴 종류를 따름 (2026-11-11)
  const price = menuPrice(k, p);
  mkBtn.disabled = true;
  if (loadSheet()) { mkMsg.textContent = '연결한 원가표 시트를 확인하는 중…'; await Promise.race([syncSheet(), new Promise(r => setTimeout(r, 6000))]); }
  mkMsg.textContent = `AI가 판매가 ${won(price)}${PICK_PRICE[k] ? '(시장가 카드에서 고른 값)' : ''}에 맞춰 '${k}' 신메뉴를 만들고 원가를 계산하는 중… (10초쯤 걸려요)`; const stopProg = mkProgress();
  try {
    const tok = await authToken();   // 로그인했으면 사람별 한도 (Worker가 Supabase로 확인)
    const res = await fetch(LIVE_API + '/menu', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Uid': OWNER ? '' : (authUid() || UID), ...(OWNER ? { 'X-Owner-Key': OWNER } : {}), ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
      body: JSON.stringify({ keyword: k, type: v.type, kind, price, targetRate: 30, profile: p, goal: GOAL, myPrice: myPriceMap(), note: [(document.getElementById('mk-note').value || '').trim(), again === true && MADE_NAMES[k] ? `앞에서 제안한 ${MADE_NAMES[k].slice(-3).map(n => `'${n}'`).join(', ')}와는 다른 형태·맛의 메뉴로` : ''].filter(Boolean).join(' / ') }) });
    const m = await res.json();
    if (m.limit) { mkMsg.textContent = '⏳ ' + m.error; return; }   // 하루 사용 횟수 제한 (Worker LIMITS)
    if (!res.ok || m.error) throw new Error(m.error || res.status);
    if (current !== k) return;
    LAST_MENU = { m, k, goal: GOAL }; (MADE_NAMES[k] = MADE_NAMES[k] || []).push(m.name);
    showMenu(m);
    mkMsg.textContent = '다시 누르면 다른 메뉴를 만들어요.'; MADE = true; renderProg();
  } catch (e) {
    const msg = String(e.message || e);
    mkMsg.textContent = /429|RESOURCE_EXHAUSTED|quota/i.test(msg)
      ? 'AI 무료 사용량을 다 썼어요. 잠시 뒤(하루 한도면 내일) 다시 눌러 주세요. (Gemini 사용량 한도)'
      : /503|UNAVAILABLE|high demand/.test(msg)
      ? 'AI 서버가 지금 붐벼요. 1~2분 뒤에 다시 눌러 주세요. (Gemini 일시적 과부하)'
      : `만들지 못했어요: ${msg}`;
    mkMsg.title = msg;   // 마우스를 올리면 원래 오류 문구가 보임
  }
  finally { stopProg(); mkBtn.disabled = false; }
}
mkBtn.addEventListener('click', () => makeMenu(false));
// 신메뉴 결과 그리기 (단가를 고치면 다시 그림)
function showMenu(m) {
  mkOut.innerHTML = menuCard(m, true) + `<div class="mk-act"><button type="button" class="btn primary" id="mk-save">♡ 보관함에 저장</button>
    <button type="button" class="btn line" id="mk-again">↻ <span class="mk-long">마음에 안 들어요, </span>다른 메뉴</button></div>
    <div class="mk-fb" id="mk-fb">${m._fb ? `<span>${m._fb === 'like' ? '👍' : '👎'} 알려 주셔서 고마워요!</span>` : `<span>이 메뉴, 쓸 만한가요?</span> <button type="button" data-fb="like">👍 쓸 만해요</button> <button type="button" data-fb="dislike">👎 별로예요</button>`}</div>`;
  const info = () => ({ name: m.name, rate: m.rate, price: m.price });
  document.getElementById('mk-save').onclick = e => { saveMenu(LAST_MENU); e.target.textContent = '✓ 보관함에 저장했어요'; e.target.disabled = true; track('menu_save', m.keyword, m.goal, info()); };
  document.getElementById('mk-again').onclick = () => { track('menu_again', m.keyword, m.goal, info()); makeMenu(true); };
  document.querySelectorAll('#mk-fb [data-fb]').forEach(b => b.onclick = () => { m._fb = b.dataset.fb; track(m._fb, m.keyword, m.goal, info());
    document.getElementById('mk-fb').innerHTML = `<span>${m._fb === 'like' ? '👍' : '👎'} 알려 주셔서 고마워요!</span>`; });
  if (!m.market) fillMarket(m, mkOut.querySelector('.mkt'));   // 다른 카페 가격은 따로 불러와 채움 (보관함에 저장하면 같이 저장)
}

/* ---------- 내 원가표 (이 브라우저에만, localStorage) ----------
   { 재료: { unit:'g'|'ml'|'개', price: 단위당 원, buy?: '450g 8,900원' } } → 신메뉴 요청에 myPrice로 보내면 Worker가 가장 먼저 씀 */
const MY_KEY = 'dessert-timing-costs';
const loadMy = () => { try { return JSON.parse(localStorage.getItem(MY_KEY)) || {}; } catch { return {}; } };
const storeMy = x => { try { localStorage.setItem(MY_KEY, JSON.stringify(x)); } catch { } cloudSoon('costs'); };
const myPriceMap = () => { const o = {}; for (const [k, v] of Object.entries(loadMy())) o[k] = { unit: v.unit, price: v.price }; return o; };
// 산 양·단위·가격 → 단위당 단가 (kg→g, L→ml)
function unitPrice(qty, unit, price) {
  qty = +qty; price = +price; if (!(qty > 0) || !(price >= 0)) return null;
  const u = String(unit).toLowerCase(), mul = u === 'kg' ? 1000 : u === 'l' ? 1000 : 1, base = u === 'kg' || u === 'g' ? 'g' : u === 'l' || u === 'ml' ? 'ml' : '개';
  return { unit: base, price: +(price / (qty * mul)).toFixed(3), buy: `${qty}${unit} ${Number(price).toLocaleString()}원` };
}
function setMy(ing, v) { const n = String(ing).replace(/\s/g, '').slice(0, 20); if (!n || !v) return; const x = loadMy(); x[n] = v; storeMy(x); renderMyCost(); }
function renderMyCost() {
  const x = loadMy(), ks = Object.keys(x), box = document.getElementById('mc-list'); if (!box) return;
  document.getElementById('mc-sum').textContent = ks.length ? `재료 ${ks.length}개 · 신메뉴 원가를 이 값으로 먼저 계산해요` : '우리 가게 구매가를 넣으면 신메뉴 원가를 그 값으로 계산해요';
  box.innerHTML = ks.length ? `<table><thead><tr><th>재료</th><th class="num-r">단가</th><th>산 양·가격</th><th></th></tr></thead><tbody>${ks.map(k =>
    `<tr><td>${esc(k)}${x[k].src ? `<span class="mc-src">${x[k].src === 'sheet' ? '시트' : '파일'}</span>` : ''}${x[k].note ? ` <small>(${esc(x[k].note)})</small>` : ''}</td><td class="num-r">${x[k].price}원/${x[k].unit}</td><td><small>${esc(x[k].buy || '결과 표에서 고침')}</small></td><td><button type="button" class="mc-x" data-k="${esc(k)}" aria-label="지우기">×</button></td></tr>`).join('')}</tbody></table>`
    : '<p class="note">아직 넣은 재료가 없어요.</p>';
  box.querySelectorAll('.mc-x').forEach(b => b.onclick = () => { const y = loadMy(); delete y[b.dataset.k]; storeMy(y); renderMyCost(); });
}
document.getElementById('mc-form').addEventListener('submit', e => {
  e.preventDefault();
  const v = unitPrice(document.getElementById('mc-qty').value, document.getElementById('mc-unit').value, document.getElementById('mc-price').value);
  const ing = document.getElementById('mc-ing').value.trim(); if (!ing || !v) return;
  setMy(ing, v); e.target.reset(); document.getElementById('mc-ing').focus();
});
// 엑셀에서 붙여넣기: '버터	450g	8900' · '우유, 1L, 2800' · '버터 450 g 8,900원'
function parseCostLine(line) {
  // 사장님 원가표 [재료단가] 탭 모양: 재료 ⇥ 구매 상품 ⇥ 구매가 ⇥ 구매용량 ⇥ 단위 ⇥ 단위당 단가 … (2026-11-09 사용자 시트)
  const c = line.split('\t').map(x => x.trim()), num = x => +String(x).replace(/[,원\s]/g, '');
  if (c.length >= 5 && c[0] && /^[\d,.]+원?$/.test(c[2]) && /^[\d,.]+$/.test(c[3]) && /^(g|kg|ml|l|L|개|ea|EA)$/.test(c[4])) {
    const v = unitPrice(num(c[3]), /ea/i.test(c[4]) ? '개' : c[4], num(c[2]));
    if (v) { if (c[1]) v.buy = `${c[1]} ${num(c[2]).toLocaleString()}원`; if (/AI 추정|예시/.test(c.slice(6).join(' '))) v.note = c.slice(6).join(' ').match(/AI 추정|예시값?/)[0]; return [c[0], v]; }
  }
  const t = line.replace(/원/g, '').trim(); if (!t) return null;
  const m = t.match(/^(.+?)[\t,]+\s*([\d.,]+)\s*(kg|g|ml|l|L|개|ea|EA)?[\t,\s]+([\d.,]+)\s*$/) || t.match(/^(\S+)\s+([\d.,]+)\s*(kg|g|ml|l|L|개|ea|EA)\s+([\d.,]+)$/);
  if (!m) return null;
  const n = s => +String(s).replace(/,/g, ''), u = !m[3] ? 'g' : /ea/i.test(m[3]) ? '개' : m[3];
  const v = unitPrice(n(m[2]), u, n(m[4])); return v ? [m[1].trim(), v] : null;
}
document.getElementById('mc-paste-btn').addEventListener('click', () => {
  const lines = document.getElementById('mc-text').value.split(/\n/), x = loadMy(); let ok = 0, bad = [];
  lines.forEach(l => { if (!l.trim() || /^재료\t/.test(l)) return; const r = parseCostLine(l); if (r && /[가-힣a-zA-Z]/.test(r[0])) { x[r[0].replace(/\s/g, '').slice(0, 20)] = r[1]; ok++; } else bad.push(l.trim().slice(0, 20)); });
  storeMy(x); renderMyCost();
  document.getElementById('mc-paste-msg').textContent = `${ok}개 넣었어요.` + (bad.length ? ` 못 읽은 줄 ${bad.length}개: ${bad.slice(0, 3).join(' / ')}` : '');
  if (ok && !bad.length) document.getElementById('mc-text').value = '';
});
// ---------- 원가표 시트·엑셀 파일: 머리줄에서 재료·구매가·구매용량·단위(또는 단가) 열을 찾아 읽는다 ----------
function rowsToCosts(rows) {
  const out = [], cell = (r, i) => i >= 0 ? String(r[i] == null ? '' : r[i]).trim() : '', num = x => +String(x).replace(/[,원\s]/g, '');
  const hi = rows.slice(0, 6).findIndex(r => r.some(c => /^(재료|재료명|품목|품목명)$/.test(String(c).trim())));
  if (hi < 0) { rows.forEach(r => { const v = parseCostLine(r.join('\t')); if (v) out.push(v); }); return out; }
  const h = rows[hi].map(c => String(c).replace(/\s/g, '')), find = re => h.findIndex(c => re.test(c));
  const iN = find(/^(재료|재료명|품목|품목명)$/), iP = find(/^(구매가|가격|구입가|매입가|금액)/), iQ = find(/^(구매용량|용량|구매량|수량|양|중량)/),
    iU = find(/^단위$/), iUP = find(/단위당단가|^단가/), iBuy = find(/^(구매상품|상품명|상품)/);
  for (const r of rows.slice(hi + 1)) {
    const name = cell(r, iN); if (!name || /^[※*#]/.test(name)) continue;
    const unit = cell(r, iU) || 'g', u = /ea/i.test(unit) ? '개' : unit;
    let v = null;
    if (iP >= 0 && iQ >= 0 && num(cell(r, iQ)) > 0 && cell(r, iP) !== '') v = unitPrice(num(cell(r, iQ)), u, num(cell(r, iP)));
    else if (iUP >= 0 && cell(r, iUP) !== '' && /^(g|kg|ml|l|L|개)$/.test(u)) v = unitPrice(1, u, num(cell(r, iUP)));
    if (!v || !isFinite(v.price)) continue;
    if (iBuy >= 0 && cell(r, iBuy)) v.buy = `${cell(r, iBuy)}${iP >= 0 ? ' ' + num(cell(r, iP)).toLocaleString() + '원' : ''}`;
    const nt = r.join(' ').match(/AI 추정|예시값|예시/); if (nt) v.note = nt[0];
    out.push([name, v]);
  }
  return out;
}
// src('sheet'|'file')에서 온 재료를 새로 바꿔 넣는다 (같은 이름이면 시트·파일 값이 이김)
function applyCosts(list, src) {
  const x = loadMy(); Object.keys(x).forEach(k => { if (x[k].src === src) delete x[k]; });
  list.forEach(([k, v]) => { const n = String(k).replace(/\s/g, '').slice(0, 20); if (n) x[n] = { ...v, src }; });
  storeMy(x); renderMyCost(); return list.length;
}
function parseCSVText(t) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < t.length; i++) { const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch; }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
const SHEET_KEY = 'dessert-timing-sheet';
const loadSheet = () => { try { return JSON.parse(localStorage.getItem(SHEET_KEY)) || null; } catch { return null; } };
const parseSheetUrl = u => { const m = String(u).match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,80})/), g = String(u).match(/[#&?]gid=(\d+)/); return m ? { id: m[1], gid: g ? g[1] : '' } : null; };
function sheetUI(msg) {
  const sh = loadSheet(), off = document.getElementById('mc-sheet-off'), inp = document.getElementById('mc-sheet');
  off.hidden = !sh; if (sh && !inp.value) inp.value = sh.url;
  if (msg) document.getElementById('mc-sheet-msg').innerHTML = msg;
}
async function syncSheet(fresh) {
  const sh = loadSheet(); if (!sh) return;
  try {
    const d = await fetch(`${LIVE_API}/sheet?id=${encodeURIComponent(sh.id)}&gid=${encodeURIComponent(sh.gid || '')}${fresh ? '&fresh=1' : ''}`).then(r => r.json());
    if (!d.ok) { sheetUI(`⚠️ ${esc(d.error || '시트를 읽지 못했어요.')}`); return; }
    const n = applyCosts(rowsToCosts(d.rows), 'sheet');
    sheetUI(n ? `✅ 시트에서 재료 <b>${n}개</b>를 불러왔어요 (${esc(d.at || '')}). 시트를 고치면 신메뉴를 만들 때 다시 읽어요(5분 안에 반영).`
      : '⚠️ 시트에서 재료를 찾지 못했어요. 첫 줄에 재료 · 구매가 · 구매용량 · 단위 제목이 있는지 확인해 주세요.');
  } catch { sheetUI('⚠️ 시트를 읽는 중 연결이 끊겼어요. 잠시 뒤 다시 눌러 주세요.'); }
}
document.getElementById('mc-sheet-form').addEventListener('submit', e => {
  e.preventDefault(); const url = document.getElementById('mc-sheet').value.trim(), p = parseSheetUrl(url);
  if (!p) { sheetUI('⚠️ 구글 시트 주소(https://docs.google.com/spreadsheets/d/…)를 넣어 주세요.'); return; }
  try { localStorage.setItem(SHEET_KEY, JSON.stringify({ url, ...p })); } catch { } cloudSoon('sheet');
  sheetUI('시트를 읽는 중…'); syncSheet(true);
});
document.getElementById('mc-sheet-off').addEventListener('click', () => {
  try { localStorage.removeItem(SHEET_KEY); } catch { } cloudSoon('sheet'); applyCosts([], 'sheet'); document.getElementById('mc-sheet').value = '';
  sheetUI('연결을 끊고 시트에서 불러온 재료를 지웠어요.');
});
document.getElementById('mc-file').addEventListener('change', async e => {
  const f = e.target.files[0], msg = document.getElementById('mc-file-msg'); if (!f) return;
  msg.textContent = '파일을 읽는 중…';
  try {
    let rows;
    if (/\.csv$/i.test(f.name)) rows = parseCSVText(await f.text());
    else {
      if (!window.XLSX) await new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; sc.onload = ok; sc.onerror = no; document.head.appendChild(sc); });
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }), nm = wb.SheetNames.find(n => /재료\s*단가|원가표|단가/.test(n)) || wb.SheetNames[0];
      rows = XLSX.utils.sheet_to_json(wb.Sheets[nm], { header: 1, raw: false, defval: '' });
    }
    const n = applyCosts(rowsToCosts(rows), 'file'); track('file', '', '', { n, ext: (f.name.split('.').pop() || '').toLowerCase() });
    msg.textContent = n ? `${f.name}에서 재료 ${n}개를 넣었어요.` : '재료를 찾지 못했어요. 첫 줄에 재료 · 구매가 · 구매용량 · 단위 제목이 있는지 확인해 주세요.';
  } catch { msg.textContent = '파일을 읽지 못했어요. .xlsx 또는 .csv 파일인지 확인해 주세요.'; }
  e.target.value = '';
});
renderMyCost(); sheetUI(); syncSheet();
// 결과 표의 단가 눌러 고치기 → 내 원가표에 저장하고 원가·원가율 다시 계산
mkOut.addEventListener('click', e => {
  const b = e.target.closest('.up-edit'); if (!b || !LAST_MENU) return;
  const m = LAST_MENU.m, row = m.recipe[+b.dataset.i]; if (!row) return;
  const inp = document.createElement('input'); inp.type = 'number'; inp.min = '0'; inp.step = 'any'; inp.className = 'up-in'; inp.value = row.unit_price;
  b.replaceWith(inp); inp.after(document.createTextNode(` 원/${row.unit}`)); inp.focus(); inp.select();
  let done = false;
  const fin = save => { if (done) return; done = true; const v = +inp.value;
    if (save && v >= 0 && inp.value !== '') {
      setMy(row.ing, { unit: row.unit, price: v, buy: '' }); track('cost_edit', m.keyword, '', { ing: row.ing });
      row.unit_price = v; row.cost = Math.round(row.qty * v); row.source = '내 원가표';
      m.cost = m.recipe.reduce((a, r) => a + r.cost, 0); m.rate = +(m.cost / m.price * 100).toFixed(1); m.pass = m.rate <= m.target; m.margin = m.price - m.cost;
    }
    showMenu(m); };
  inp.onkeydown = ev => { if (ev.key === 'Enter') fin(true); if (ev.key === 'Escape') fin(false); };
  inp.onblur = () => fin(true);
});

/* ---------- 사례: 과일모찌 ---------- */
const fm = D.kw['과일모찌'];
new Chart(document.getElementById('c-mochi'), {
  type: 'line',
  data: { datasets: [{ data: fm.s.map((y, i) => ({ x: X[i], y, i })).filter(p => p.y !== null && p.x >= 2022),
    borderColor: C.s[1], borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, fill: true, backgroundColor: 'rgba(235,104,52,.08)', tension: .25 }] },
  options: { parsing: false, interaction: { mode: 'nearest', axis: 'x', intersect: false },
    scales: { x: { type: 'linear', min: 2022, max: X[X.length - 1], grid: { color: C.grid }, ticks: { stepSize: NARROW ? 2 : 1, maxRotation: 0, callback: v => Number.isInteger(v) ? v : '' } } },
    plugins: { tooltip: { callbacks: { title: it => fmtDate(D.dates[it[0].raw.i]), label: it => ` 최고 때의 ${it.raw.y.toFixed(1)}%` } } } }
});
const gp = D.groupPre;
new Chart(document.getElementById('c-pre'), {
  type: 'bar',
  data: { labels: ['유행형 (중앙값)', '과일모찌', '정착형 (중앙값)'],
    datasets: [{ data: [gp['유행형'][0], gp['과일모찌'][0], gp['정착형'][0]],
      backgroundColor: [TYPE_COLOR['유행형'], C.s[1], TYPE_COLOR['정착형']], borderRadius: 4, maxBarThickness: 64 }] },
  options: { scales: { x: { grid: { display: false } }, y: { min: 0, max: 60, grid: { color: C.grid }, title: { display: true, text: '피크 52주 전 검색량 (피크 대비 %)' } } },
    plugins: { tooltip: { callbacks: { label: it => ` 피크의 ${it.raw.toFixed(1)}%` } } } },
  plugins: [{ id: 'vals', afterDatasetsDraw(ch) { const { ctx } = ch; ctx.save(); ctx.font = '700 13px "Noto Sans KR"'; ctx.fillStyle = C.ink; ctx.textAlign = 'center';
    ch.getDatasetMeta(0).data.forEach((el, i) => ctx.fillText(Math.round(ch.data.datasets[0].data[i]) + '%', el.x, el.y - 6)); ctx.restore(); } }]
});

/* ---------- 발견 ④: 검색량 vs 매장 ---------- */
const grid = document.getElementById('shop-grid');
['탕후루', '크로플', '마카롱', '베이글'].forEach(k => {
  const st = D.shops[k].stats, box = document.createElement('div'); box.className = 'mini';
  box.innerHTML = `<h4>${k} <span style="font-weight:500;color:var(--ink-2);font-size:13px">${st.alive_max.toLocaleString()} → ${st.open_now.toLocaleString()}곳</span></h4><div class="chart-box"><canvas></canvas></div>`;
  grid.appendChild(box);
  new Chart(box.querySelector('canvas'), {
    type: 'line',
    data: { datasets: [
      { label: '검색량', data: D.kw[k].s.map((y, i) => ({ x: X[i], y, i })).filter(p => p.y !== null), borderColor: C.s[0], borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: .25 },
      { label: '영업 중 매장 수', data: shopPts(k), borderColor: C.s[1], borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: .25 }] },
    options: { parsing: false, interaction: { mode: 'nearest', axis: 'x', intersect: false },
      scales: { x: { type: 'linear', min: 2016, max: X[X.length - 1], grid: { color: C.grid }, ticks: { stepSize: 2, maxRotation: 0, callback: v => Number.isInteger(v) ? v : '' } },
        y: { min: 0, max: 100, grid: { color: C.grid }, ticks: { stepSize: 50 } } },
      plugins: { tooltip: { callbacks: { title: it => it[0].raw.m || fmtDate(D.dates[it[0].raw.i]),
        label: it => it.datasetIndex === 1 ? ` 영업 중 ${it.raw.n.toLocaleString()}곳` : ` 검색량 ${it.raw.y.toFixed(0)}%` } } } }
  });
});
const ORDER = ['탕후루', '흑당', '크로플', '마카롱', '요거트 아이스크림', '베이글', '모찌', '소금빵'];
const pct = v => v === null || v === undefined ? '–' : v + '%';
document.getElementById('shop-table').innerHTML = `<thead><tr><th>디저트</th><th>검색 최고</th><th>가게 최고</th><th class="num-r">가게 수</th><th class="num-r">늦게 연 가게<br>1년 내 폐업</th></tr></thead><tbody>` +
  ORDER.map(k => { const s = D.shops[k].stats;
    return `<tr data-k="${k}"><td>${k}</td><td>${fmtYM(s.search_peak)}</td><td>${k === '모찌' ? '지금' : fmtYM(s.alive_peak) + ` <small style="color:var(--ink-3)">(+${s.lag_alive}개월)</small>`}</td>
      <td class="num-r">${s.alive_max.toLocaleString()} → ${s.open_now.toLocaleString()}곳</td><td class="num-r">${pct(s.close1y_after)}</td></tr>`; }).join('') + '</tbody>';

/* ---------- About data ---------- */
const dlg = document.getElementById('about');
document.querySelectorAll('[data-open-about]').forEach(b => b.onclick = () => dlg.showModal());
document.querySelector('[data-close-about]').onclick = () => dlg.close();
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

/* 첫 화면 */
renderFindings('과일모찌');


/* ---------- 실시간 분석: 목록에 없는 디저트 ---------- */
const mean = a => { const b = a.filter(x => x !== null && !isNaN(x)); return b.length ? b.reduce((p, c) => p + c, 0) / b.length : null; };
function rolling(a, w, minp) { const h = Math.floor(w / 2); return a.map((_, i) => { const seg = a.slice(Math.max(0, i - h), i + h + 1).filter(x => x !== null); return seg.length >= minp ? seg.reduce((p, c) => p + c, 0) / seg.length : null; }); }
function lifecycle(dates, raw) {
  const n = raw.length; if (n < 60 || raw.filter(x => x > 0).length < 10) return null;
  const S = rolling(raw, 13, 7); let pk = 0; S.forEach((x, i) => { if (x !== null && x > (S[pk] ?? -1)) pk = i; });
  const pv = S[pk]; if (!pv) return null;
  let st = null; for (let i = pk - 1; i >= 0; i--) if (S[i] !== null && S[i] < 0.25 * pv) { st = i; break; }
  let hf = null; for (let i = pk + 1; i < n; i++) if (S[i] !== null && S[i] < 0.5 * pv) { hf = i; break; }
  const cur = mean(raw.slice(-13)), yago = mean(raw.slice(-65, -52));
  const tr = rolling(raw, 52, 26), byM = [...Array(12)].map(() => []);
  raw.forEach((x, i) => { if (tr[i]) byM[new Date(dates[i]).getMonth()].push(x / tr[i]); });
  const season = byM.map(a => mean(a) ?? 1), smin = Math.min(...season), smax = Math.max(...season);
  const amp = smin > 0 ? smax / smin : 1, now = +(cur / pv * 100).toFixed(1);
  const recent = pk >= n - 13;
  const type = recent ? '진행중' : (amp >= 2.5 && now >= 10) ? '시즌형' : now < 10 ? '유행형' : now >= 25 ? '정착형' : '관망형';
  const pd = new Date(dates[pk]);
  return { type, peak: `${pd.getFullYear()}.${String(pd.getMonth() + 1).padStart(2, '0')}`, peakDate: dates[pk],
    rise: st === null ? null : pk - st, half: hf === null ? null : hf - pk, now, yoy: yago > 0 ? +((cur / yago - 1) * 100).toFixed(1) : null,
    smonth: season.indexOf(smax) + 1, amp, season, pre52: pk >= 52 ? S[pk - 52] / pv * 100 : 0,
    zeroShare: raw.filter(x => !x).length / n, s: S.map(x => x === null ? null : +(x / pv * 100).toFixed(2)) };
}
function shopAnalysis(rows, peakDate, capped) {
  const day = 864e5, today = new Date();
  const recs = rows.map(r => ({ o: new Date(r[1]), c: r[2] ? new Date(r[2]) : null })).filter(r => !isNaN(r.o));
  recs.forEach(r => r.popup = r.c && (r.c - r.o) / day <= 90);
  const perm = recs.filter(r => !r.popup);
  const alive = [], pts = [];
  for (let y = 2016, m = 0; new Date(y, m, 1) <= today; m++, (m === 12 && (m = 0, y++))) {
    const end = new Date(y, m + 1, 0, 23, 59);
    alive.push(perm.filter(r => r.o <= end && (!r.c || r.c > end)).length);
  }
  const mx = Math.max(0, ...alive), ip = alive.indexOf(mx);
  alive.forEach((v, i) => pts.push({ x: 2016 + i / 12 + 1 / 24, y: mx ? v / mx * 100 : 0, n: v, m: `${2016 + Math.floor(i / 12)}년 ${i % 12 + 1}월` }));
  const pk = new Date(peakDate), cut = new Date(today - 365 * day);
  const c1 = xs => { xs = xs.filter(r => r.o <= cut); return xs.length >= 30 ? +(xs.filter(r => r.c && (r.c - r.o) / day <= 365).length / xs.length * 100).toFixed(1) : null; };
  return { stats: { total: recs.length, popup: recs.filter(r => r.popup).length, open_now: perm.filter(r => !r.c).length, alive_max: mx,
      alive_peak: `${2016 + Math.floor(ip / 12)}-${String(ip % 12 + 1).padStart(2, '0')}`,
      close1y_before: c1(perm.filter(r => r.o < pk)), close1y_after: c1(perm.filter(r => r.o >= pk)), capped }, pts: mx ? pts : [] };
}
async function getJSON(path) { const r = await fetch(LIVE_API + path); const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || r.status); return j; }
async function fetchShops(q, src, maxPages = 20) {
  const first = await getJSON(`/shops?q=${encodeURIComponent(q)}&src=${src}&page=1`);
  const pages = Math.min(Math.ceil(first.total / 100), maxPages), rows = [...first.rows];
  for (let p = 2; p <= pages; p += 4) {
    const batch = await Promise.all([p, p + 1, p + 2, p + 3].filter(x => x <= pages).map(x => getJSON(`/shops?q=${encodeURIComponent(q)}&src=${src}&page=${x}`)));
    batch.forEach(b => rows.push(...b.rows));
  }
  return { rows, capped: first.total > maxPages * 100 };
}
const qMsg = document.getElementById('q-msg');
async function analyzeLive(q) {
  if (!LIVE_API) { qMsg.textContent = '실시간 검색은 준비 중이에요. 위 목록에서 골라 주세요.'; return false; }
  qMsg.textContent = `'${q}' 검색량과 전국 매장을 불러오는 중… (10초쯤 걸려요)`;
  try {
    const nq = q.replace(/\s+/g, '');
    const [t, a, b] = await Promise.all([getJSON(`/trend?q=${encodeURIComponent(q)}`), fetchShops(nq, 'cafe'), fetchShops(nq, 'bakery')]);
    const v = lifecycle(t.dates, t.ratio);
    if (!v) { qMsg.textContent = `'${q}'은(는) 네이버 검색량이 너무 적어서 분석하기 어려워요. 다른 이름으로 검색해 보세요.`; return false; }
    const XX = t.dates.map(d => { const x = new Date(d); return x.getFullYear() + (x - new Date(x.getFullYear(), 0, 1)) / 31536000000; });
    const sh = shopAnalysis([...a.rows, ...b.rows], v.peakDate, a.capped || b.capped);
    LIVE[q] = { v, X: XX, dates: t.dates, shop: sh.stats.total ? sh.stats : { total: 0, popup: 0, open_now: 0, alive_max: 0, close1y_before: null, close1y_after: null },
      shopPts: sh.pts, shopNote: `· 상호에 '${nq}'가 들어간 매장`, shopLegend: ` (상호에 '${nq}')` };
    qMsg.textContent = `'${q}' 실시간 분석 결과예요. (네이버 데이터랩 · 행정안전부 인허가 데이터)`;
    select(q);
    goStep(2);
    return true;
  } catch (e) { qMsg.textContent = `불러오지 못했어요: ${e.message}`; return false; }
}
document.getElementById('q-form').addEventListener('submit', e => {
  e.preventDefault();
  const q = document.getElementById('q').value.trim();
  if (!q) return;
  const known = Object.keys(D.kw).find(k => k.replace(/\s/g, '') === q.replace(/\s/g, ''));
  // 검색은 진단을 보려는 것 → 고른 뒤 바로 2단계로 (예전엔 1단계에 머물러 '분석하기'를 눌러도 아무 일 없어 보였음, 2026-11-09)
  if (known) { qMsg.textContent = ''; select(known); goStep(2); return; }
  if (LIVE[q]) { select(q); goStep(2); return; }
  analyzeLive(q);
});


/* ---------- 시도별 지도 (디저트 타일을 누르면 바뀜, 지역을 누르면 개업·폐업) ---------- */
const KOREA = {"paths":{"서울":"M200.0,95.0L206.0,96.1L205.7,100.1L207.2,100.8L207.8,104.5L206.7,109.4L212.5,106.9L213.1,110.5L210.0,112.8L209.6,114.5L211.3,115.0L210.1,117.3L202.5,122.1L200.8,118.4L190.7,121.6L187.7,115.6L183.2,117.5L183.8,110.9L179.2,109.5L182.0,104.7L186.4,107.8L188.2,107.2L190.1,106.0L190.5,100.1L194.0,99.1L194.8,102.1L196.2,101.8L197.6,97.0L200.0,95.0Z","부산":"M357.2,361.8L356.5,354.4L354.5,357.6L354.6,354.0L351.5,357.1L351.7,353.0L350.6,357.1L347.0,356.8L346.7,356.2L345.5,355.3L347.2,354.4L346.9,352.6L343.4,349.1L349.3,348.2L349.1,349.2L350.0,349.8L350.2,344.0L359.2,341.8L361.1,337.6L368.8,334.5L370.9,329.9L369.6,328.1L374.3,329.9L376.1,326.1L381.5,326.3L382.6,330.9L384.3,331.4L384.7,332.0L384.7,332.5L381.2,333.5L378.1,346.4L374.7,349.5L369.6,349.7L368.8,351.7L370.4,353.9L368.9,355.8L369.0,354.9L368.5,355.8L368.1,355.9L367.7,355.6L367.5,354.1L367.3,354.6L366.1,354.6L365.3,354.1L365.3,352.1L364.3,352.4L361.3,359.7L360.2,356.4L360.6,360.1L357.8,359.3L357.2,361.8ZM346.2,356.0L348.0,360.8L346.1,366.1L343.1,359.6L346.5,357.9L344.8,357.2L346.2,356.0Z","대구":"M335.4,263.4L339.5,267.7L338.7,272.0L340.7,276.2L339.8,279.2L337.5,279.3L337.2,284.3L334.3,286.0L335.0,291.9L329.6,294.8L328.7,291.1L324.8,291.3L321.8,293.7L322.1,296.7L320.2,297.7L320.1,301.0L309.2,304.1L311.6,301.1L307.6,294.6L314.1,294.5L314.0,292.4L310.1,289.0L313.2,284.1L318.2,283.4L315.5,280.3L310.1,279.7L311.4,275.0L315.9,270.7L317.7,271.6L317.0,275.1L319.7,276.3L322.3,271.5L321.9,267.0L323.9,268.9L329.2,264.4L335.4,263.4Z","인천":"M170.3,101.2L178.2,107.0L181.5,106.8L177.3,114.1L177.4,116.3L180.4,119.5L175.7,126.7L172.7,126.3L171.1,130.0L170.3,130.3L169.2,130.3L170.2,130.6L164.3,131.3L165.5,130.3L164.5,129.5L170.3,129.4L166.6,126.3L166.2,122.6L168.5,122.3L168.6,123.2L168.9,122.9L168.6,121.9L166.7,122.0L166.8,119.6L165.4,121.2L165.1,118.8L167.8,119.2L165.5,117.7L167.9,115.8L168.9,116.8L169.0,114.6L166.2,115.4L166.4,109.6L163.8,106.2L167.9,104.7L170.3,101.2ZM158.0,111.9L163.0,113.6L164.4,116.1L158.3,118.4L153.1,122.9L146.8,120.8L146.4,117.7L155.8,115.0L158.0,111.9ZM152.8,82.5L158.2,86.7L159.9,90.2L159.1,97.5L161.3,103.2L159.4,103.9L159.2,107.0L158.8,105.1L150.1,105.6L147.2,103.7L146.9,101.5L150.6,99.8L149.0,95.4L145.7,93.5L145.6,86.0L149.1,82.7L152.8,82.5ZM156.3,140.6L154.4,142.6L152.3,141.8L152.4,137.6L156.8,136.7L157.9,139.2L156.3,140.6ZM144.0,90.4L143.1,93.7L148.0,96.8L144.9,100.6L143.1,96.8L139.1,93.9L140.6,93.6L141.0,90.5L144.0,90.4ZM135.4,84.5L143.5,84.2L144.1,86.0L136.1,89.9L133.9,88.1L135.4,84.5ZM126.0,137.8L126.8,140.2L130.7,141.9L126.8,144.1L125.6,142.0L124.2,142.8L126.0,137.8Z","대전":"M230.5,216.1L231.2,219.5L234.7,220.1L237.4,217.3L236.9,219.3L239.0,219.8L237.8,221.6L238.8,224.1L240.6,222.7L243.5,225.2L240.7,226.2L240.5,229.6L238.7,231.1L237.8,241.7L233.9,245.5L229.5,241.6L229.7,238.7L227.6,238.1L227.7,243.0L225.2,246.7L223.7,242.9L221.0,241.4L221.8,238.5L218.2,235.9L220.8,230.5L221.0,223.5L225.8,221.9L227.3,216.1L230.5,216.1Z","울산":"M371.5,292.6L376.8,292.9L380.8,294.9L380.7,299.0L384.0,300.6L388.6,297.1L396.4,299.9L395.7,301.8L397.6,306.4L396.7,312.2L395.5,312.1L396.2,314.1L395.0,313.9L396.0,315.8L392.9,317.8L390.5,311.2L391.4,314.8L389.4,314.6L390.7,315.0L391.6,316.4L391.7,317.2L389.8,319.6L388.7,319.1L388.4,318.2L387.3,316.8L386.8,316.4L390.2,321.9L388.6,322.3L389.3,324.3L387.9,327.2L389.2,329.3L385.2,332.0L382.6,330.9L381.5,326.3L376.3,326.2L377.7,324.2L375.9,321.1L373.4,321.8L368.5,315.4L364.3,313.6L364.5,311.8L359.6,312.2L357.8,309.3L361.9,305.9L360.5,302.7L363.8,299.9L366.6,300.7L365.4,297.9L366.5,295.4L371.5,292.6Z","세종":"M212.1,191.9L222.8,196.5L220.5,201.0L221.8,201.4L222.4,206.4L225.6,208.8L228.8,208.2L229.3,210.8L231.0,211.3L231.4,215.4L227.3,216.1L227.2,219.4L224.8,222.7L218.5,224.3L214.3,221.0L214.0,216.0L212.0,214.1L212.3,210.8L215.0,207.2L210.8,204.4L211.3,196.0L208.5,194.1L212.1,191.9Z","경기":"M181.6,162.4L177.6,161.2L178.5,159.5L171.8,153.3L172.3,150.7L170.7,151.2L173.6,149.9L169.9,149.5L171.5,146.1L169.9,146.6L170.8,142.9L170.2,138.1L168.5,136.3L170.8,135.9L169.7,135.7L168.5,136.1L168.2,136.5L168.5,136.1L169.7,135.7L170.8,135.7L170.8,137.2L172.7,136.9L172.3,139.3L178.5,139.6L180.7,142.0L181.3,138.3L182.9,138.2L182.4,135.6L185.5,138.3L185.1,137.4L183.4,135.2L179.4,135.7L171.6,132.1L167.2,133.6L164.1,135.7L167.8,138.6L169.2,138.7L168.4,136.9L169.2,137.7L170.1,145.0L168.2,143.2L168.0,144.8L167.6,141.4L164.9,141.7L167.1,144.1L165.5,145.2L166.0,142.9L163.9,142.9L162.8,145.7L161.1,142.1L163.4,141.3L160.4,136.1L162.7,137.3L163.6,135.2L164.1,135.7L166.4,133.7L173.2,131.5L177.5,125.2L180.2,125.8L180.4,125.5L180.8,125.8L181.3,125.7L181.0,124.2L180.8,125.8L180.4,125.5L179.3,125.5L177.9,124.6L180.4,119.5L177.4,116.3L179.3,109.6L183.8,110.9L183.2,117.5L187.7,115.6L190.4,121.6L192.4,120.0L195.2,121.0L198.5,118.2L201.0,118.6L201.1,121.1L203.5,122.1L210.9,116.1L209.5,114.1L211.4,110.5L213.1,110.5L212.5,106.9L206.7,109.4L207.8,104.5L207.2,100.8L205.7,100.1L206.0,96.1L200.4,94.9L197.6,97.0L197.1,100.9L196.2,101.8L194.8,102.1L194.0,99.1L190.5,100.1L190.1,106.0L186.4,107.8L182.2,104.5L181.5,106.8L178.2,107.0L170.5,101.2L167.9,104.7L162.6,104.9L159.9,97.6L159.2,87.3L159.6,86.0L165.3,88.9L170.9,86.9L170.6,81.0L173.3,78.1L171.7,78.0L171.6,69.5L183.4,64.7L186.5,61.8L187.1,54.2L190.5,51.2L195.5,51.3L194.1,48.8L196.7,42.3L198.6,42.8L201.6,39.1L206.6,36.9L207.3,41.2L211.4,41.2L213.5,48.8L215.9,51.1L221.1,46.7L222.3,47.5L220.5,52.6L223.3,53.2L224.2,55.5L228.8,53.2L231.7,54.8L233.1,53.5L235.5,63.7L241.9,64.9L242.3,68.2L246.9,69.5L248.1,72.2L247.2,77.4L240.7,82.0L241.7,83.9L240.3,85.7L242.3,89.0L239.2,92.9L243.7,93.0L241.7,100.9L243.5,102.2L247.3,99.9L255.5,106.4L262.5,106.5L266.8,110.0L259.7,114.7L263.0,117.9L263.3,122.1L261.2,127.9L259.7,128.3L260.4,134.3L258.9,135.3L258.8,143.2L254.5,151.0L249.0,149.5L249.5,155.0L246.4,156.2L247.1,158.1L245.0,157.5L243.3,160.9L236.1,159.7L234.4,163.9L230.0,165.3L230.7,168.2L228.6,170.1L222.1,171.9L221.7,175.6L209.9,167.9L207.2,167.9L206.0,170.8L197.8,171.5L190.9,174.8L190.1,172.0L186.0,170.4L183.9,165.9L181.1,165.5L180.3,164.3L181.6,162.4Z","강원":"M328.5,50.4L343.0,71.6L346.4,74.6L350.2,82.1L364.5,97.5L363.7,101.5L369.3,107.1L369.9,109.2L369.3,111.4L372.1,115.2L371.0,114.6L370.1,115.9L371.7,115.3L375.2,119.4L376.0,123.4L380.8,127.0L381.9,132.8L386.6,137.0L388.9,141.4L387.6,142.4L387.8,147.5L389.5,150.4L382.0,153.4L378.2,157.6L379.3,161.1L375.0,160.8L373.5,158.1L367.8,155.0L364.7,158.5L353.8,155.8L351.6,160.5L347.6,159.8L346.2,157.2L342.2,155.8L339.9,162.2L329.5,156.3L322.6,156.0L319.3,152.4L313.5,154.8L310.2,149.2L306.4,149.2L303.1,151.6L300.5,149.0L303.2,147.8L306.0,143.6L300.8,144.2L295.9,140.1L292.4,143.7L289.2,141.5L287.9,144.4L282.4,146.1L280.6,140.4L276.8,139.4L272.8,142.5L273.2,148.4L261.9,150.6L258.4,144.0L259.7,138.2L258.9,135.3L260.4,134.3L259.7,128.3L261.2,127.9L263.3,122.1L263.0,117.9L259.7,114.7L266.8,109.8L262.5,106.5L255.5,106.4L247.3,99.9L242.6,101.7L241.5,99.9L242.9,98.8L243.5,92.1L239.2,92.6L242.3,89.0L240.3,85.7L241.7,83.9L240.9,81.4L247.2,77.4L247.7,70.9L242.3,68.2L241.9,64.9L235.5,63.7L233.1,53.5L231.7,54.8L228.8,53.2L224.2,55.5L223.3,53.2L220.5,52.6L222.3,47.5L221.1,46.7L215.9,51.1L213.5,48.8L211.4,41.2L207.4,41.3L205.9,36.9L208.9,33.6L210.8,34.6L217.8,31.7L222.4,33.7L229.1,31.3L235.3,32.3L238.4,35.0L245.0,31.4L253.5,32.6L261.5,30.1L264.7,34.6L273.2,34.1L279.3,37.4L280.6,33.6L284.7,34.0L291.9,30.7L302.0,21.4L304.4,13.8L304.1,5.7L308.0,3.6L312.3,9.4L313.2,14.4L316.9,20.0L316.1,21.8L320.4,27.7L324.4,39.2L327.8,43.5L326.2,45.7L327.1,45.8L327.1,44.9L327.7,44.8L328.8,46.9L328.5,50.4Z","충북":"M223.3,192.6L225.7,192.0L225.3,189.8L227.2,188.9L230.9,190.4L232.2,188.9L230.2,186.8L230.6,185.1L225.3,181.9L225.3,179.4L223.1,179.0L223.1,176.5L221.5,175.6L222.1,171.9L228.6,170.1L230.7,168.2L230.0,165.3L234.4,163.9L236.1,159.7L243.3,160.9L245.0,157.5L247.1,158.1L246.4,156.2L249.5,155.0L249.0,149.5L253.9,151.4L258.4,143.5L259.4,147.9L262.1,150.7L268.8,148.6L270.9,150.0L273.7,147.4L272.8,142.5L276.7,139.4L280.6,140.4L282.4,146.1L287.9,144.4L289.2,141.5L292.4,143.7L295.9,140.1L300.8,144.2L306.0,143.6L303.2,147.8L300.5,149.0L303.1,151.6L306.4,149.2L310.2,149.2L313.5,154.8L319.3,152.4L322.6,156.0L329.5,156.3L331.9,158.5L330.3,160.9L328.3,159.7L325.1,161.6L324.0,165.2L314.8,172.3L313.4,177.3L315.4,180.2L313.2,183.8L308.6,184.8L304.7,183.3L298.7,177.8L298.3,180.5L296.2,180.3L296.5,183.8L289.9,181.7L286.4,185.3L283.9,183.3L281.7,190.2L284.8,194.2L275.7,191.3L273.4,195.9L268.9,196.8L273.4,198.1L273.1,204.7L269.4,199.3L266.7,201.6L267.6,203.6L262.8,204.8L263.3,206.9L267.8,208.2L271.5,214.3L269.1,216.2L269.6,222.8L268.0,225.7L270.3,229.0L266.3,234.0L267.1,237.6L269.6,237.6L271.4,234.9L275.9,239.8L281.2,238.2L282.9,239.3L281.5,241.0L283.8,244.9L277.3,245.2L278.9,249.5L276.4,253.2L275.9,258.0L269.1,262.7L266.9,261.0L260.0,263.8L255.0,261.5L253.9,258.7L251.6,261.1L245.9,251.6L246.6,243.2L245.1,241.7L242.3,242.4L241.6,239.9L238.1,241.2L238.7,231.1L240.5,229.6L240.7,226.2L243.5,225.2L240.6,222.7L238.8,224.1L237.8,221.6L239.0,219.8L236.9,219.3L237.4,217.3L234.7,220.1L230.7,219.4L231.0,211.3L229.3,210.8L228.8,208.2L225.6,208.8L222.5,206.4L221.8,201.4L220.5,201.0L222.9,198.2L221.3,195.9L223.3,192.6Z","충남":"M130.2,189.4L128.7,189.6L129.5,191.9L127.0,194.2L128.2,190.2L126.3,187.7L129.1,185.9L130.3,182.4L129.4,180.4L132.2,183.7L131.5,181.8L133.4,179.4L131.7,176.4L137.4,173.6L139.7,175.2L141.0,174.9L140.3,168.7L141.7,167.2L141.6,173.1L144.1,175.9L141.2,179.7L143.0,181.3L140.2,182.5L140.6,185.0L144.6,183.4L143.0,180.7L144.2,178.7L146.8,182.0L146.8,177.3L152.3,174.7L150.0,173.1L151.1,172.7L151.2,171.3L148.8,172.3L144.3,168.9L148.8,168.0L144.1,166.5L143.8,165.0L151.4,163.0L154.1,165.1L157.6,158.5L168.5,164.8L180.5,167.4L183.4,175.4L187.0,177.0L197.8,171.5L206.0,170.8L207.2,167.9L214.6,169.8L215.2,171.9L223.1,176.5L223.1,179.0L225.3,179.4L225.3,181.9L230.6,185.1L230.2,186.8L232.2,188.9L230.9,190.4L225.4,189.7L225.9,191.6L221.3,195.9L211.5,191.6L208.5,194.1L211.3,196.0L210.8,204.4L215.0,207.2L212.3,210.8L212.0,214.1L214.0,216.0L214.3,221.0L218.5,224.3L221.0,223.5L220.8,230.5L218.2,235.9L221.8,238.5L221.0,241.4L223.7,242.9L225.2,246.7L227.7,243.1L228.3,237.8L229.8,238.8L229.5,241.6L233.9,245.5L241.3,239.9L242.3,242.4L245.4,241.9L246.7,244.5L245.9,251.6L249.4,256.9L248.2,260.8L250.0,261.8L247.6,262.5L247.8,265.0L245.9,262.4L241.2,260.9L241.4,265.8L235.2,266.7L233.4,262.1L230.7,264.1L228.7,262.7L225.6,252.0L218.6,253.7L218.3,256.7L214.9,254.9L214.2,256.4L209.5,256.2L208.1,258.6L203.2,256.1L201.8,250.4L194.7,249.3L189.1,251.2L187.3,258.9L177.8,262.4L176.9,265.0L171.2,264.5L171.4,261.9L167.4,257.2L169.6,256.2L169.5,255.6L166.8,255.4L163.4,251.0L162.3,252.2L159.3,249.8L157.8,250.9L158.5,252.1L157.2,251.3L157.2,249.1L159.9,248.1L160.1,241.2L161.7,238.5L159.1,235.1L158.1,232.0L162.6,229.9L158.4,226.4L156.1,226.5L157.4,222.4L160.3,220.9L157.5,221.6L154.8,206.5L146.9,202.3L140.9,206.5L140.2,202.8L141.7,201.2L138.4,195.6L139.9,192.0L136.3,193.2L136.6,194.7L133.2,197.6L129.9,197.2L129.2,194.7L130.7,193.3L134.1,194.5L135.4,193.1L133.4,192.8L134.4,190.9L130.2,189.4ZM147.6,205.3L146.3,207.8L147.7,208.5L147.9,213.1L150.5,215.8L150.2,219.7L152.2,221.3L151.9,225.1L148.9,222.8L146.6,223.4L146.8,220.9L144.0,220.9L144.7,214.5L142.5,206.5L146.4,203.8L147.6,205.3Z","전북":"M194.7,249.3L201.8,250.4L203.2,256.1L208.1,258.6L209.5,256.2L214.2,256.4L214.9,254.9L218.3,256.7L218.6,253.7L225.6,252.0L228.7,262.7L230.7,264.1L233.4,262.1L235.1,266.6L237.7,267.2L241.6,265.5L241.2,260.9L245.9,262.4L247.9,264.9L247.6,262.5L250.0,261.8L248.3,261.1L248.7,258.3L252.0,261.2L254.0,258.7L255.0,261.5L260.0,263.8L266.9,261.0L269.1,262.7L271.9,270.1L269.6,272.1L270.0,273.8L267.7,274.4L266.3,278.4L258.4,280.6L256.4,285.3L251.9,288.6L251.7,294.0L248.4,300.4L249.6,303.2L245.5,309.6L249.1,311.4L251.0,316.3L249.7,319.1L252.7,320.4L247.6,328.3L248.6,330.8L247.1,333.2L244.9,334.1L236.3,328.5L233.1,329.2L229.3,334.8L226.9,332.8L223.3,334.5L219.0,333.8L216.2,331.5L214.7,333.4L213.3,331.3L206.7,335.1L201.7,332.8L203.9,331.0L203.9,328.5L200.4,325.5L202.4,322.3L201.0,318.3L198.2,318.7L195.9,322.2L196.3,325.0L193.0,325.5L189.9,320.2L185.2,318.8L183.9,316.3L183.2,318.1L177.0,320.1L178.3,323.3L175.8,325.0L175.8,328.3L172.8,330.6L171.2,329.9L169.5,333.0L164.6,332.0L164.6,334.9L160.2,334.2L158.8,328.8L157.2,330.0L157.5,327.7L155.9,326.4L157.2,324.1L156.1,322.3L152.1,321.7L156.5,312.8L157.5,314.0L162.6,310.7L165.5,312.0L168.5,307.5L172.0,310.2L170.5,306.3L158.5,307.1L154.5,304.0L154.4,301.2L162.3,295.2L159.4,291.8L156.3,283.5L159.3,291.2L163.4,296.4L168.2,290.1L168.4,285.1L174.5,285.3L171.9,276.1L166.8,276.4L167.3,271.0L165.3,270.2L164.9,274.7L164.3,274.7L163.9,274.7L164.9,272.9L163.0,274.5L163.0,271.4L160.5,271.6L157.6,281.5L153.7,284.3L153.1,282.1L155.8,282.8L157.0,281.2L160.3,271.8L158.8,267.5L176.9,266.4L177.8,262.4L187.5,258.8L189.3,251.0L194.7,249.3Z","경북":"M391.2,262.2L392.5,261.1L394.9,262.0L395.0,262.3L392.0,263.2L394.3,262.8L393.5,264.5L396.5,265.9L400.7,262.4L404.3,256.5L407.2,260.4L407.3,263.3L402.0,272.1L403.2,275.0L402.0,277.6L403.2,278.2L396.4,299.9L388.6,297.1L384.0,300.6L380.7,299.0L380.8,294.9L371.7,292.5L366.3,295.7L365.5,298.8L366.6,300.7L363.8,299.9L358.9,304.1L353.1,300.9L350.1,301.6L347.5,306.0L344.0,306.1L342.7,308.3L336.0,307.2L334.7,305.5L326.4,306.4L322.5,302.6L321.8,293.7L326.1,291.1L328.7,291.1L329.3,294.7L334.4,292.9L335.4,289.4L334.3,286.0L337.2,284.3L337.5,279.3L340.6,278.4L340.6,274.3L338.7,272.0L339.5,267.7L335.4,263.4L329.2,264.4L323.9,268.9L321.9,267.0L322.3,271.5L319.7,276.3L317.0,275.1L317.7,271.6L315.9,270.7L311.4,275.0L310.1,279.7L315.5,280.3L318.2,282.9L317.2,284.4L313.2,284.1L310.1,289.0L314.0,292.4L314.1,294.5L307.6,294.6L311.5,300.4L310.5,303.2L308.6,303.7L307.6,300.5L303.9,299.5L300.3,300.7L298.7,299.5L297.7,301.1L292.2,299.6L292.4,297.7L295.7,296.6L295.5,293.1L292.0,286.6L289.5,286.1L289.1,282.8L284.8,280.9L280.0,282.1L277.6,279.1L273.1,279.4L272.7,275.7L269.8,275.7L269.6,272.1L271.9,270.1L269.0,265.3L269.1,262.7L275.9,258.0L276.4,253.2L278.9,249.5L277.3,245.2L283.8,244.9L281.5,241.0L282.9,239.3L281.2,238.2L275.9,239.8L271.4,234.9L269.6,237.6L267.1,237.6L266.3,234.0L270.3,229.0L268.0,225.7L269.6,222.8L269.1,216.2L271.5,214.3L267.8,208.2L264.9,207.9L262.7,205.0L267.6,203.6L266.7,201.6L269.4,199.3L273.1,204.7L273.4,198.1L268.9,196.8L273.4,195.9L275.7,191.3L284.8,194.2L281.7,190.2L283.9,183.3L286.4,185.3L289.9,181.7L296.5,183.8L296.2,180.3L298.3,180.5L298.7,177.8L304.7,183.3L308.6,184.8L313.2,183.8L315.4,180.2L313.4,177.3L314.8,172.3L328.3,159.7L330.3,160.9L332.0,158.4L340.1,162.2L340.3,158.1L342.2,155.8L346.2,157.2L347.6,159.8L351.6,160.5L353.8,155.8L364.7,158.5L367.8,155.0L373.5,158.1L375.0,160.8L379.3,161.1L378.2,157.6L382.0,153.4L389.5,150.4L390.7,155.1L394.8,159.2L393.1,162.2L393.6,176.0L398.7,188.2L398.4,195.2L393.4,202.8L393.4,206.4L396.7,214.2L390.3,236.2L391.3,243.3L390.2,245.4L391.8,246.9L392.2,251.6L395.6,253.8L393.8,257.6L393.1,257.7L392.5,258.0L392.1,258.7L391.0,258.7L391.0,260.2L390.8,259.9L390.2,259.9L391.2,262.2Z","경남":"M280.9,361.9L279.6,361.7L280.7,360.9L279.9,360.0L280.3,361.0L278.1,360.3L277.2,361.7L278.8,361.2L280.6,364.0L279.8,366.8L278.9,365.4L277.7,367.4L276.2,365.5L274.4,367.1L272.9,363.6L270.8,369.3L266.8,370.3L266.2,368.7L264.2,370.1L264.5,370.8L263.2,371.5L263.4,372.6L263.4,372.6L262.9,372.7L259.6,368.3L261.9,363.9L260.3,360.0L248.6,346.5L248.0,340.0L244.9,335.3L248.4,331.7L247.6,328.4L252.7,320.4L249.7,319.1L251.0,316.3L249.1,311.4L245.5,309.6L249.6,303.2L248.4,300.4L251.7,294.0L251.9,288.6L256.4,285.3L258.4,280.6L266.3,278.4L267.8,274.3L269.8,274.0L270.5,276.3L272.7,275.7L273.1,279.4L277.6,279.1L280.0,282.1L284.8,280.9L289.1,282.8L289.5,286.1L292.0,286.6L295.5,293.1L295.7,296.6L292.4,297.7L292.2,299.6L307.4,300.4L310.0,304.3L315.2,301.2L320.0,301.1L320.2,297.7L322.0,296.7L322.5,302.6L326.4,306.4L334.7,305.5L340.4,308.3L347.5,306.0L350.4,301.5L355.3,301.5L358.6,304.1L361.9,303.7L361.5,306.6L357.7,309.0L359.6,312.2L364.5,311.8L364.3,313.6L368.5,315.4L371.4,320.2L375.9,321.1L377.7,324.1L374.4,329.8L369.6,328.1L370.9,329.9L369.0,334.3L361.1,337.6L359.6,341.6L350.2,344.0L350.0,349.8L349.3,348.2L343.4,349.1L347.3,354.1L344.8,357.2L342.6,357.2L344.0,355.2L343.0,353.7L340.8,354.5L342.6,355.2L340.9,359.0L340.9,357.2L338.6,356.1L339.3,355.0L334.8,354.7L335.0,350.2L333.4,350.8L333.0,353.1L331.5,349.9L328.2,351.2L326.8,345.1L330.3,343.1L326.6,343.9L324.8,346.5L327.4,350.8L325.4,351.7L327.7,351.8L326.5,353.0L329.9,356.7L327.9,357.5L330.5,358.1L325.5,359.6L327.4,358.0L324.6,358.3L326.3,355.9L323.3,355.7L322.6,352.9L321.0,355.2L315.6,354.6L315.4,355.4L317.9,357.2L314.7,357.8L313.7,359.5L308.6,360.3L310.0,361.4L308.9,363.3L310.6,363.3L310.1,361.4L314.6,360.4L317.0,357.4L318.1,359.8L316.3,360.3L319.6,362.9L316.9,366.2L312.1,365.6L315.0,367.2L313.2,377.7L315.2,376.2L314.7,373.7L317.6,376.0L314.3,381.2L313.5,380.6L310.9,382.1L309.0,380.0L313.0,378.5L310.3,378.2L310.7,377.6L309.6,375.9L309.4,378.1L307.4,376.3L307.3,377.7L305.7,377.4L303.2,375.0L307.8,374.2L305.0,368.7L303.4,373.7L301.2,375.0L300.8,371.1L297.1,370.4L295.0,371.3L295.5,375.6L291.8,374.1L289.9,376.2L287.4,375.0L288.9,372.7L285.8,373.3L281.5,369.3L283.2,368.0L283.2,363.4L282.0,362.6L284.1,357.1L281.9,357.3L280.9,361.9ZM333.6,386.3L330.7,388.6L334.2,391.0L333.8,392.1L329.9,391.3L330.7,394.2L325.8,394.7L328.3,391.8L325.7,391.1L327.5,387.3L324.0,388.3L325.1,386.4L323.0,387.5L322.7,386.3L326.4,385.2L326.7,380.3L321.5,381.8L320.4,384.1L317.3,377.8L321.8,372.6L325.1,375.2L325.8,373.2L327.6,373.6L329.6,375.8L326.7,369.7L328.2,368.0L331.6,369.3L332.5,365.2L334.2,366.0L333.1,364.2L334.0,360.9L337.4,363.1L335.2,365.4L337.9,370.4L335.3,377.1L336.5,378.1L337.3,375.5L340.0,375.6L339.3,378.2L337.7,378.5L338.6,380.7L335.9,381.1L337.4,381.2L339.0,386.3L336.5,385.5L336.5,383.8L335.0,385.3L333.6,383.6L333.6,386.3ZM281.8,373.0L279.9,378.3L281.1,378.4L280.9,376.8L282.0,375.3L283.0,375.3L284.5,377.6L283.4,379.7L286.1,382.2L276.6,380.7L276.2,377.9L279.3,373.5L281.8,373.0ZM271.3,378.9L275.4,384.5L278.3,381.8L284.5,383.2L283.2,385.4L283.7,390.4L281.9,392.6L284.0,394.1L280.7,394.8L280.3,392.6L275.6,394.1L275.0,387.2L271.3,388.5L271.5,392.2L267.6,392.2L265.8,389.4L267.6,387.4L263.6,379.7L265.0,374.7L268.0,374.9L267.1,373.4L268.7,370.8L273.1,370.9L273.1,375.8L271.1,376.6L271.3,378.9Z","제주":"M171.3,510.7L184.3,509.1L185.3,511.6L190.6,512.9L190.2,513.2L190.1,514.0L191.2,514.8L190.3,516.8L192.0,519.4L193.0,517.2L193.8,519.0L192.0,520.0L193.1,522.1L191.4,521.6L190.6,525.9L187.8,527.8L184.9,534.1L180.2,534.3L177.4,537.2L170.6,537.6L165.8,541.6L159.5,540.9L155.6,542.7L154.3,540.9L143.8,540.9L141.4,542.7L141.1,545.3L139.3,545.6L130.4,536.3L131.0,530.5L142.6,518.0L157.3,512.9L168.6,511.4L169.5,509.4L171.3,510.7Z","전남광주":"M124.5,423.1L132.7,413.6L132.6,415.4L133.9,415.4L133.3,414.1L135.4,413.3L134.4,412.3L137.6,408.9L136.8,406.3L141.9,407.9L142.8,410.6L144.7,409.8L148.3,414.6L148.4,417.0L146.3,416.9L146.9,420.7L144.5,424.9L143.7,425.5L143.3,423.1L142.7,425.0L141.0,424.2L142.4,426.8L140.6,428.6L140.9,425.8L138.8,425.3L138.9,427.2L131.9,430.1L127.9,429.1L128.7,426.6L126.6,426.9L124.5,423.1ZM142.1,407.6L142.6,406.2L138.3,403.8L141.1,402.0L138.4,400.9L138.0,398.6L140.4,389.3L144.2,391.0L146.3,395.6L148.8,392.0L145.7,389.9L146.0,386.5L147.7,387.9L146.6,390.4L148.2,388.1L153.6,386.7L152.9,385.1L148.2,387.1L145.6,385.4L150.7,380.6L149.7,377.0L148.6,377.2L150.1,373.9L147.5,365.3L147.0,373.0L142.1,372.2L143.2,370.6L141.2,368.4L142.7,366.2L143.8,368.3L145.2,367.7L146.3,365.8L144.2,365.6L148.9,361.7L148.1,360.1L145.8,361.1L143.3,356.1L142.0,360.5L140.4,358.8L138.4,359.7L139.5,361.6L137.5,363.8L135.7,363.0L136.1,359.7L130.4,358.3L130.0,355.9L132.7,353.7L137.6,355.3L138.5,350.5L143.2,352.2L145.3,349.0L144.2,355.6L145.9,355.0L145.2,357.3L146.9,357.2L147.2,358.8L149.0,356.4L148.4,358.3L150.4,358.8L149.0,360.7L151.8,362.1L151.3,360.6L154.2,357.6L152.6,356.4L154.9,354.9L151.4,354.3L146.4,348.1L147.8,343.9L144.7,345.9L141.3,342.7L142.5,339.7L143.9,340.6L144.0,337.0L147.3,335.6L149.4,328.1L151.3,328.4L149.8,325.5L150.5,321.7L155.8,322.1L157.2,324.1L156.2,326.3L157.1,329.8L158.8,328.8L159.7,333.6L164.6,334.8L164.6,332.0L169.4,332.9L171.2,329.9L175.8,328.3L175.8,325.0L178.3,323.2L177.0,320.1L183.1,318.1L183.9,316.3L189.9,320.2L193.0,325.5L196.2,325.0L195.9,322.2L198.2,318.7L201.0,318.3L202.4,322.3L200.4,325.5L203.9,328.5L203.9,331.0L201.7,332.9L206.7,335.1L213.3,331.3L214.7,333.4L216.2,331.5L219.0,333.8L223.3,334.5L226.9,332.8L229.3,334.7L233.6,328.7L238.7,329.1L244.9,334.1L248.0,340.0L248.6,346.5L253.9,351.5L254.6,354.8L261.8,363.2L259.1,369.0L261.7,373.4L261.7,376.3L255.2,373.7L255.0,371.8L254.5,373.1L252.6,371.9L252.5,374.7L249.9,376.6L247.8,373.1L245.3,372.9L247.8,375.5L245.9,377.6L249.7,380.3L249.6,382.1L254.4,378.5L260.9,379.0L260.4,384.7L258.5,387.3L258.8,391.6L261.9,393.4L261.0,396.9L263.5,398.9L262.0,404.3L263.2,406.3L258.8,405.7L255.8,402.9L256.8,401.3L255.8,400.7L259.9,396.4L258.1,391.3L254.7,392.9L251.6,389.4L250.2,394.4L248.8,393.2L247.9,394.4L249.9,396.7L248.9,397.2L250.5,402.1L245.8,399.8L244.9,401.7L242.8,398.7L243.8,397.4L242.6,393.7L246.3,390.1L243.5,387.3L243.3,384.3L240.5,384.0L242.0,381.0L239.9,377.6L237.9,377.5L237.5,380.8L227.7,381.6L232.7,383.5L230.1,385.4L229.4,387.4L230.8,388.3L228.4,390.9L234.4,398.7L237.8,400.1L235.3,400.4L238.4,401.8L239.3,405.7L237.6,407.6L235.4,405.9L234.2,407.3L230.6,406.0L230.3,409.0L233.6,410.0L232.8,413.0L236.7,410.8L235.3,412.3L236.7,413.6L235.3,413.7L239.2,415.8L235.3,417.4L237.8,419.1L239.0,417.7L241.7,420.3L241.1,422.8L237.9,423.8L238.1,421.8L235.7,420.6L237.4,420.2L234.7,420.3L234.4,413.3L231.2,413.1L229.0,414.7L229.5,416.7L225.2,417.1L224.1,418.3L225.7,420.2L224.2,420.8L219.9,416.7L221.1,415.1L218.8,412.9L208.0,412.0L207.4,409.0L210.3,405.0L212.1,405.6L214.1,399.9L216.6,399.5L218.5,393.8L220.9,393.2L220.7,397.6L223.7,398.5L226.0,394.0L224.5,389.8L219.6,391.8L216.8,389.2L213.1,395.5L208.3,394.9L202.0,401.4L197.0,402.3L198.9,404.2L196.6,407.6L198.8,408.0L195.3,415.4L196.5,417.9L193.5,416.8L193.3,420.3L187.9,419.4L188.9,422.8L182.5,418.2L181.1,418.9L181.6,408.3L180.1,404.2L179.3,415.1L177.1,416.4L178.4,417.8L172.1,423.4L171.0,422.3L167.3,424.7L166.3,433.5L162.5,432.8L159.8,435.8L159.4,428.9L155.8,430.2L154.9,428.8L156.2,429.2L155.5,426.5L157.5,426.4L156.7,424.2L159.1,423.5L158.4,421.0L156.3,422.4L154.2,420.2L155.9,420.0L154.2,417.3L155.4,414.2L153.1,412.8L154.4,411.7L152.4,411.5L152.0,409.5L148.6,411.8L148.3,408.8L142.1,407.6ZM205.7,418.0L208.0,416.0L209.7,417.7L215.7,415.4L217.2,417.4L215.1,422.1L209.7,423.0L206.2,420.7L205.7,418.0ZM178.0,427.0L181.0,421.8L184.8,420.6L185.6,422.9L184.0,423.1L186.1,423.2L187.5,426.0L187.4,423.9L191.3,425.9L194.3,424.6L194.0,428.2L190.8,429.7L186.5,425.8L181.5,426.8L180.4,429.8L179.3,429.0L180.2,426.9L178.0,427.0ZM169.0,426.8L172.7,424.8L175.6,426.3L180.2,436.2L173.0,435.3L169.5,432.1L169.0,426.8ZM158.0,450.3L161.0,446.8L164.8,447.9L161.6,445.9L163.2,442.7L162.1,441.6L167.9,444.5L166.2,445.1L166.9,446.9L164.5,446.6L167.6,448.6L167.2,450.1L165.1,448.8L159.9,452.8L158.0,450.3ZM135.6,380.1L141.8,376.3L140.0,374.0L141.5,372.8L145.7,375.1L142.7,377.0L142.9,378.5L146.2,378.6L147.5,381.7L145.6,383.6L143.8,382.8L145.3,381.4L144.0,379.9L135.6,380.1ZM122.5,388.1L131.4,389.7L131.7,394.4L129.1,394.9L128.4,392.1L123.4,394.1L123.9,389.9L122.5,388.1ZM122.4,359.5L120.4,357.9L121.9,358.0L120.7,356.5L121.5,354.6L123.8,354.2L126.5,350.7L130.6,350.4L127.4,351.5L127.2,357.3L125.5,360.2L123.3,358.1L122.4,359.5ZM118.1,402.2L120.5,402.0L120.0,403.9L122.5,406.7L120.9,408.4L122.4,409.0L123.9,406.8L121.1,404.0L121.4,402.1L125.4,404.2L125.5,409.7L119.8,411.9L122.0,409.6L119.5,409.7L120.5,407.8L118.9,408.6L118.1,402.2ZM114.6,377.6L116.5,377.3L118.4,373.8L121.7,373.8L121.9,371.1L125.3,374.0L124.1,375.4L125.0,377.3L121.1,380.5L119.1,378.1L114.6,377.6ZM110.4,395.3L114.2,391.3L118.4,394.9L114.5,399.4L110.9,397.9L110.4,395.3ZM108.1,391.0L109.2,387.0L112.3,387.3L117.1,384.5L117.2,388.8L112.4,389.5L112.4,392.8L110.3,393.2L108.1,391.0Z"},"cent":{"서울":[193.3,108.6],"부산":[366.8,342.9],"대구":[326.4,283.7],"인천":[155.8,116.9],"대전":[228.9,233.5],"울산":[377.6,312.9],"세종":[219.4,207.7],"경기":[231.3,106.2],"강원":[296.2,83.0],"충북":[244.3,201.5],"충남":[187.3,212.6],"전북":[208.9,292.9],"경북":[330.0,231.5],"경남":[312.8,326.1],"제주":[161.8,526.8],"전남광주":[198.3,375.9]}};
// 작은 섬은 빼서 지도를 단순하게: 지역마다 가장 큰 땅만 남김 (해안선은 아래 'goo' 필터로 둥글게)
KOREA.paths = Object.fromEntries(Object.entries(KOREA.paths).map(([n, d]) => {
  const subs = d.match(/M[^M]*/g) || [d], area = sp => { const v = sp.match(/-?\d+\.?\d*/g).map(Number), xs = v.filter((_, i) => i % 2 === 0), ys = v.filter((_, i) => i % 2);
    return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)); };
  return [n, subs.sort((A, B) => area(B) - area(A))[0]];
}));
const RNAME = { '서울': '서울특별시', '부산': '부산광역시', '대구': '대구광역시', '인천': '인천광역시', '대전': '대전광역시', '울산': '울산광역시', '세종': '세종시', '경기': '경기도',
  '강원': '강원도', '충북': '충청북도', '충남': '충청남도', '전북': '전라북도', '전남광주': '전남·광주', '경북': '경상북도', '경남': '경상남도', '제주': '제주도' };
const SHORT = { '전남광주': '전남·광주' };
// 이름표를 숨긴 좁은 지역도 TOP 3 핀이나 선택 이름표는 보여야 해서 따로 자리를 둔다 (dx: 이름표를 옆으로 비킴)
const PIN_AT = { '인천': [181, 114, -50], '세종': [214, 222, 0] };
const LBL = { '인천': null, '서울': [195, 108], '경기': [228, 78], '세종': null, '대전': [229, 238], '부산': [366, 345], '울산': [381, 312], '대구': [326, 286] };
const NAME_ONLY = ['서울', '대전', '대구', '울산', '부산'];   // 좁은 지역은 이름만 (숫자는 눌렀을 때)
let RADAR = null, mapK = '모찌', mapR = null, VB = [0, 0, 412, 470];
const SY = 0.72, OY = 28, P2 = (x, y) => [x, OY + y * SY];   // 비스듬히 본 좌표
// 하얀 반투명 판 위에 매장 수만큼 살구색을 옅게 (누른 지역만 주황으로 솟아오름)
const RAMP = ['#fdebcd', '#fcdcaf', '#fbc88f', '#fab271', '#f99c58', '#f78744'];   // 연한 살구 → 부드러운 주황 (점토 지도)   // 크림 베이지 → 코랄 오렌지(#FF9B54)   // 유리 판 느낌: 크림 → 주황
const SEL_TOP = '#f78744', SEL_SIDE = '#d9733a';
const step = (v, mx) => v <= 0 ? 0 : Math.min(5, 1 + Math.floor(v / mx * 4.999));
function setVB(v) { VB = v; document.getElementById('kmap').setAttribute('viewBox', v.map(x => x.toFixed(1)).join(' ')); }
function zoom(f, cx, cy) {
  const [x, y, w, h] = VB, nw = Math.min(412, Math.max(80, w * f)), nh = nw * 470 / 412;
  cx = cx ?? x + w / 2; cy = cy ?? y + h / 2;
  setVB([Math.max(-40, Math.min(452 - nw, cx - nw / 2)), Math.max(-40, Math.min(510 - nh, cy - nh / 2)), nw, nh]);
}
function mapSelect(k, r) {
  if (!RADAR || !RADAR.shops[k]) return;
  mapK = k; mapR = r;
  document.querySelectorAll('#rd-tiles .tile').forEach(t => t.classList.toggle('on', t.dataset.k === k));
  const regs = RADAR.shops[k].regions || {}, mx = Math.max(1, ...Object.values(regs).map(x => x.alive));
  const rank = Object.entries(regs).sort((a, b) => b[1].alive - a[1].alive);
  const svg = document.getElementById('kmap'), tip = document.getElementById('map-tip');
  document.getElementById('ms-title').textContent = `전국 · ${k}`;
  const ent = Object.entries(KOREA.paths), T = `translate(0,${OY}) scale(1,${SY})`;
  const DEPTH = 9;   // 두께(층 수): 얇은 점토 판
  const land = ent.map(([n, d]) => `<path d="${d}"></path>`).join('');
  const layers = Array.from({ length: DEPTH }, (_, i) => `<use href="#land" transform="translate(0,${DEPTH - i})" fill="${i < 2 ? '#e7ac62' : '#f6cf98'}"${i === 0 ? ' stroke="#d99a50" stroke-width="1.2"' : ''}></use>`).join('');
  const LIFT = 15;   // 누른 지역이 떠오르는 높이
  const selD = r && KOREA.paths[r];
  const pinSet = new Set(rank.filter(e => e[1].alive > 0).slice(0, 3).map(e => e[0]));
  svg.innerHTML = `<defs><g id="land">${land}</g><clipPath id="landclip">${land}</clipPath><filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"></feGaussianBlur></filter>
      <filter id="bevel" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur in="SourceAlpha" stdDeviation="2.4" result="b"></feGaussianBlur>
        <feSpecularLighting in="b" surfaceScale="3.2" specularConstant="1.05" specularExponent="26" lighting-color="#fffaf0" result="s"><fePointLight x="-120" y="-260" z="320"></fePointLight></feSpecularLighting>
        <feComposite in="s" in2="SourceAlpha" operator="in" result="sp"></feComposite><feComposite in="SourceGraphic" in2="sp" operator="arithmetic" k1="0" k2="1" k3=".35" k4="0"></feComposite></filter>
      <filter id="goo" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur in="SourceGraphic" stdDeviation="2.8" result="b"></feGaussianBlur><feComponentTransfer in="b" result="g"><feFuncA type="table" tableValues="0 0 0 0 1 1 1 1"></feFuncA></feComponentTransfer><feComposite in="SourceGraphic" in2="g" operator="in" result="s"></feComposite><feMerge><feMergeNode in="g"></feMergeNode><feMergeNode in="s"></feMergeNode></feMerge></filter>
      <filter id="ao" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="3.5"></feGaussianBlur></filter>
      <linearGradient id="gloss" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"></stop><stop offset=".35" stop-color="#fff" stop-opacity=".04"></stop><stop offset=".55" stop-color="#fff" stop-opacity=".16"></stop><stop offset="1" stop-color="#fff" stop-opacity="0"></stop></linearGradient>
      <filter id="glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.2" result="b"></feGaussianBlur><feMerge><feMergeNode in="b"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter></defs>
    <g class="ground"><use href="#land" transform="translate(6,${OY + 30}) scale(1,${SY})" fill="#b07a4a" opacity=".18" filter="url(#soft)"></use>
      <use href="#land" transform="translate(2,${OY + 14}) scale(1,${SY})" fill="#8a5a34" opacity=".14" filter="url(#ao)"></use></g>
    <g class="float"><g transform="${T}" filter="url(#goo)">${layers}
      <use class="coast" href="#land"></use>
      <g class="tops">${ent.map(([n, d]) => `<path d="${d}" data-r="${n}" fill="${RAMP[step((regs[n] || {}).alive || 0, mx)]}" class="top ${n === r ? 'sel' : ''}" filter="url(#bevel)"></path>`).join('')}</g>
      <g class="groove" clip-path="url(#landclip)"><use href="#land" stroke="#fffaf2"></use><use href="#land" stroke="#d9a066"></use><use href="#land" transform="translate(-.4,-.5)" stroke="#fff"></use></g>
      ${selD ? `<g class="selside">${Array.from({ length: LIFT }, (_, i) => `<path d="${selD}" transform="translate(0,${-i})" fill="${SEL_SIDE}" fill-opacity="${i < 2 ? .9 : .75}"></path>`).join('')}
        <path d="${selD}" data-r="${r}" class="top sel" transform="translate(0,${-LIFT})" fill="${SEL_TOP}" filter="url(#bevel)"></path></g>` : ''}
    </g><g class="lbls">` +
    Object.entries(KOREA.cent).map(([n, xy]) => {
      const need = pinSet.has(n) || n === r, alt = need && LBL[n] === null && PIN_AT[n];
      const p0 = alt ? alt : n in LBL ? LBL[n] : xy; if (!p0) return '';
      const dx = alt ? alt[2] : 0;
      const [x, y] = P2(p0[0], p0[1] - (n === r ? LIFT : 0));
      const v = (regs[n] || {}).alive || 0, i = rank.findIndex(e => e[0] === n) + 1, nm = SHORT[n] || n;
      if (n === r) { const t = `${nm} · ${v}곳`, w = t.length * 9.5 + 22, ty = Math.max(24, y - 58);
        return `<g class="sel-pin"><line x1="${x}" y1="${y}" x2="${x + dx}" y2="${ty + 10}"></line><circle cx="${x}" cy="${y}" r="3.4"></circle>
        <rect x="${x + dx - w / 2}" y="${ty - 12}" width="${w}" height="24" rx="3"></rect><text x="${x + dx}" y="${ty + 4}">${t}</text></g>`; }
      if (pinSet.has(n)) return `<g class="pin ${n === r ? 'sel-t' : ''}"><line x1="${x}" y1="${y}" x2="${x + dx}" y2="${y - 26}"></line><circle cx="${x}" cy="${y}" r="2.6"></circle>
        <rect x="${x + dx - 30}" y="${y - 44}" width="60" height="19" rx="9.5"></rect><text class="pt" x="${x + dx}" y="${y - 31}">${nm} ${v}곳</text></g>`;
      return `<g class="${n === r ? 'sel-t' : ''}"><text class="nm" x="${x}" y="${y + 3}">${nm}</text></g>`; }).join('') + '</g></g>';
  svg.querySelectorAll('path.top').forEach(p => {
    p.addEventListener('click', e => { e.stopPropagation(); if (!dragged) mapSelect(mapK, p.dataset.r === mapR ? null : p.dataset.r); });
    p.addEventListener('mousemove', e => { const b = svg.parentNode.getBoundingClientRect(), x = regs[p.dataset.r] || { alive: 0, o30: 0, c30: 0 };
      tip.hidden = false; tip.style.left = (e.clientX - b.left) + 'px'; tip.style.top = (e.clientY - b.top) + 'px';
      tip.textContent = `${RNAME[p.dataset.r]} · ${x.alive}곳 (30일 +${x.o30} / −${x.c30})`; });
    p.addEventListener('mouseleave', () => { tip.hidden = true; });
  });
  const top3 = rank.filter(e => e[1].alive > 0).slice(0, 3).map(e => SHORT[e[0]] || e[0]);
  document.getElementById('ms-foot').innerHTML = `<span><b>TOP 3</b>${top3.join(' · ')}에 ${esc(k)} 매장이 가장 많아요.</span><span>${RADAR.data_date} 인허가 데이터 기준</span>`;
  document.getElementById('ms-list').innerHTML = `<ol>${rank.map(([n, x], i) => `<li data-r="${n}">${i + 1}. ${RNAME[n]}<span>${x.alive}곳 · +${x.o30}/−${x.c30}</span></li>`).join('')}</ol>`;
  document.querySelectorAll('#ms-list li').forEach(li => li.addEventListener('click', () => mapSelect(mapK, li.dataset.r)));
  const P = document.getElementById('map-panel');
  document.getElementById('mapstage').classList.toggle('has-panel', !!r);
  if (!r) { P.hidden = true; return; }
  const x = regs[r] || { alive: 0, o30: 0, c30: 0, o90: 0, c90: 0, open: [], close: [] }, i = rank.findIndex(e => e[0] === r) + 1;
  const share = RADAR.shops[k].open_now ? Math.round(x.alive / RADAR.shops[k].open_now * 100) : 0;
  const net = x.o90 - x.c90;
  const pp = n => n ? `<small class="popn">팝업 ${n}곳 포함</small>` : '';
  const list = (xs, isClose) => xs.length ? `<ul>${xs.map(x => { const [n, d, pd] = x, od = isClose ? x[3] : '', ar = isClose ? x[4] : x[3];
    return `<li><b class="ln">${esc(n)}${pd ? ` <em class="popt" title="${pd}일 만에 닫은 팝업·행사 매장">팝업 ${pd}일${od ? ` · ${od} 개업` : ''}</em>` : ''}${ar ? `<small class="ar">${esc(ar)}</small>` : ''}</b><span>${d}</span></li>`; }).join('')}</ul>` : '<p class="note" style="margin:4px 0">없어요.</p>';
  P.innerHTML = `<button class="x" type="button" aria-label="닫기">×</button>
    <p class="mp-rank">영업 중 매장 ${x.alive ? i + '위' : '없음'}</p><h6>${RNAME[r]}</h6><p class="lbl">${esc(k)} 영업 중 매장</p>
    <div class="big">${x.alive}<small>곳</small></div>
    <ul class="pts"><li>전국 ${esc(k)} 매장의 ${share}%가 이 지역에 있어요.</li>
      <li>최근 90일 ${net > 0 ? `연 곳이 ${net}곳 더 많아 늘고 있어요.` : net < 0 ? `닫은 곳이 ${-net}곳 더 많아 줄고 있어요.` : '연 곳과 닫은 곳이 같아요.'}</li></ul>
    <div class="grid"><div><b class="up">+${x.o30}</b>30일 개업${pp(x.po30)}</div><div><b class="dn">−${x.c30}</b>30일 폐업${pp(x.pc30)}</div>
      <div><b class="up">+${x.o90}</b>90일 개업${pp(x.po90)}</div><div><b class="dn">−${x.c90}</b>90일 폐업${pp(x.pc90)}</div></div>
    <details open><summary>최근 개업 가게</summary>${list(x.open)}</details>
    <details><summary>최근 폐업 가게</summary>${list(x.close, true)}</details>${(x.changed || []).length ? `<details><summary>신고 변경 <small class="chgn">문 닫지 않고 신고만 다시 한 곳</small></summary><ul>${x.changed.map(([n, d, ar]) => `<li><b class="ln">${esc(n)} <em class="chgt" title="같은 이름·주소로 폐업 후 7일 안에 다시 신고 (업종 변경 등)">신고 변경</em>${ar ? `<small class="ar">${esc(ar)}</small>` : ''}</b><span>${d}</span></li>`).join('')}</ul></details>` : ''}`;
  P.hidden = false;
  P.querySelector('.x').addEventListener('click', () => mapSelect(mapK, null));
  if (innerWidth <= 760) P.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
// 확대·축소·끌기
let dragged = false;
(() => {
  const svg = document.getElementById('kmap');
  document.querySelectorAll('.ms-ctrl button').forEach(b => b.addEventListener('click', () => {
    const z = b.dataset.z;
    if (z === 'in') { const c = mapR && KOREA.cent[mapR] && P2(...KOREA.cent[mapR]); zoom(0.7, c ? c[0] : undefined, c ? c[1] : undefined); }
    else if (z === 'out') zoom(1 / 0.7);
    else if (z === 'fit') setVB([0, 0, 412, 470]);
    else { const L = document.getElementById('ms-list'); L.hidden = !L.hidden; b.classList.toggle('on', !L.hidden); }
  }));
  svg.addEventListener('wheel', e => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault();
    const b = svg.getBoundingClientRect(), s = VB[2] / b.width; zoom(e.deltaY < 0 ? 0.85 : 1 / 0.85, VB[0] + (e.clientX - b.left) * s, VB[1] + (e.clientY - b.top) * s); }, { passive: false });
  let st = null;
  svg.addEventListener('pointerdown', e => { st = { x: e.clientX, y: e.clientY, vb: VB.slice() }; dragged = false; });
  addEventListener('pointermove', e => { if (!st || VB[2] >= 412) return; const s = VB[2] / svg.getBoundingClientRect().width, dx = (e.clientX - st.x) * s, dy = (e.clientY - st.y) * s;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragged = true;
    if (dragged) setVB([st.vb[0] - dx, st.vb[1] - dy, VB[2], VB[3]]); });
  addEventListener('pointerup', () => { st = null; setTimeout(() => { dragged = false; }, 0); });
  svg.addEventListener('click', () => { if (!dragged) mapSelect(mapK, null); });
})();


/* ---------- 앱 구조: 3단계 흐름 · 화면 전환 · 사이드바 ---------- */
const PICKS = [
  ['과일모찌', '🍡', '#ffe3ea', '요즘 역대 최고로 찾는 떡 디저트'],
  ['두바이 초콜릿', '🍫', '#f1e2d2', '한 번에 터졌다 식은 유행'],
  ['흑임자', '⚫', '#ecebe6', '몇 년째 천천히 오르는 맛'],
  ['소금빵', '🥐', '#fff0c4', '정규 메뉴로 자리 잡은 빵'],
];
const GOALS = [
  ['기간 한정', '⏳', '#ffe6d6', '유행이 뜨거울 때 4~8주만 팔기'],
  ['정규 메뉴', '⭐', '#fff0b8', '오래 팔 대표 메뉴로 키우기'],
  ['SNS 인증용', '📸', '#e7eefc', '사진 찍고 싶은 비주얼 메뉴'],
  ['시즌 메뉴', '🍂', '#f3e6d4', '대목 달에 맞춰 매년 내기'],
];
const ro = w => { const c = w.charCodeAt(w.length - 1); if (c < 0xAC00 || c > 0xD7A3) return '로'; const t = (c - 0xAC00) % 28; return t && t !== 8 ? '으로' : '로'; };
const storeName = () => ((loadProfile() || {}).name || '').trim();
// 디저트 사진 (AI로 만든 이미지, 크림 배경 480px webp · img/menu/)
const IMG = {'망고빙수': 'img/menu/mango-bingsu.webp?v=2', '크리스마스 케이크': 'img/menu/christmas-cake.webp?v=2', '딸기 케이크': 'img/menu/strawberry-cake.webp?v=2', '발렌타인 초콜릿': 'img/menu/valentine-chocolate.webp?v=2', '빙수': 'img/menu/bingsu.webp?v=2', '고구마 디저트': 'img/menu/sweet-potato-latte.webp?v=2', '밤 디저트': 'img/menu/mont-blanc.webp?v=2', '카네이션 케이크': 'img/menu/carnation-rice-cake.webp?v=2', '과일모찌': 'img/menu/strawberry-mochi-cut.webp?v=3', '딸기모찌': 'img/menu/strawberry-mochi-cut.webp?v=3', '찹쌀모찌': 'img/menu/red-bean-mochi.webp', '모찌떡': 'img/menu/cream-mochi.webp', '찹쌀떡': 'img/menu/red-bean-rice-cakes.webp', '약과': 'img/menu/yakgwa.webp', '두바이 초콜릿': 'img/menu/pistachio-kataifi-chocolate.webp', '소금빵': 'img/menu/salt-bread.webp', '베이글': 'img/menu/cream-cheese-bagels.webp', '크로플': 'img/menu/croffle-no-cream.webp', '탕후루': 'img/menu/tanghulu.webp', '마카롱': 'img/menu/pastel-macarons.webp', '뚱카롱': 'img/menu/fat-macarons.webp', '흑당': 'img/menu/brown-sugar-bubble-tea.webp', '달고나': 'img/menu/dalgona-latte.webp', '요거트 아이스크림': 'img/menu/yogurt-ice-cream.webp', '피스타치오': 'img/menu/pistachio-latte.webp', '말차': 'img/menu/matcha-latte.webp', '흑임자': 'img/menu/black-sesame-latte-2.webp', '쑥': 'img/menu/mugwort-latte.webp', '붕어빵': 'img/menu/bungeoppang.webp', '땅콩빵': 'img/menu/peanut-shaped-buns.webp'};
const photo = (k, cls = '') => IMG[k] ? `<img src="${IMG[k]}" alt="${k}" loading="lazy"${cls ? ` class="${cls}"` : ''}>` : '';
const card = (cls, key, emo, bg, title, sub, on, badge) => `<button type="button" class="${cls}${on ? ' on' : ''}" data-k="${key}" aria-pressed="${on}">
  ${IMG[key] ? `<span class="art ph">${photo(key)}</span>` : `<span class="art" style="background:${bg}">${emo}</span>`}<span class="pk-t">${title}${badge ? `<em>${badge}</em>` : ''}</span><span class="pk-s">${sub}</span><span class="pk-c">${on ? '✓' : '↗'}</span></button>`;
function renderPicks() {
  document.getElementById('picks').innerHTML = PICKS.map(([k, e, bg, s]) => card('pick', k, e, bg, k, s, k === current, D.kw[k] && D.kw[k].type)).join('');
  document.querySelectorAll('#picks .pick').forEach(b => b.onclick = () => select(b.dataset.k));
  document.getElementById('pick-note').textContent = current ? `'${current}' 선택됨` : '하나를 고르면 다음으로 갈 수 있어요.';
  document.querySelector('[data-panel="1"] [data-go="2"]').disabled = !current;
}
function renderGoals() {
  if (!current) return;
  const rec = GOAL_OF[entry(current).v.type] || '기간 한정';
  if (GOAL_K !== current) { GOAL = rec; GOAL_K = current; }
  document.getElementById('goals').innerHTML = GOALS.map(([g, e, bg, s]) => card('pick goal', g, e, bg, g, s, g === GOAL, g === rec ? '추천' : '')).join('');
  document.querySelectorAll('#goals .goal').forEach(b => b.onclick = () => { GOAL = b.dataset.k; renderGoals(); renderPlan(current, entry(current).v, entry(current).shop); });
}
function renderSide() {
  const el = document.getElementById('sel-sum');
  if (!current) el.innerHTML = '<p class="note">아직 고른 디저트가 없어요.</p>';
  else {
    const E = entry(current), v = E.v;
    el.innerHTML = `<p class="ss-k">고른 디저트</p><p class="ss-n">${photo(current, 'ss-ph')}${esc(current)} <span class="tag" style="background:${TYPE_COLOR[v.type]}">${v.type}</span></p>
    <div class="ss-g"><div><b>${v.now}%</b>최고 때 대비</div><div><b>${v.yoy === null ? '–' : sign(v.yoy)}</b>작년 이맘때보다</div><div><b>${E.shop ? E.shop.open_now.toLocaleString() + '곳' : '–'}</b>영업 중 매장</div></div>`;
  }
  // 반영되는 가게 정보: 있으면 요약 + [수정], 없으면 넣으라는 안내(누르면 프로필로)
  const p = loadProfile(), has = hasProfile(p), body = document.getElementById('side-store-body');
  document.getElementById('side-edit').hidden = !has;
  if (has) body.textContent = document.getElementById('pf-sum').textContent;
  else body.innerHTML = `<button type="button" class="ss-add">${esc(SITE_COPY.noProfile)}</button>`;
  renderSideTip();
}
// 사이드바 '지금 할 일' (단계마다 바뀜)
function renderSideTip() { const el = document.getElementById('side-tip-body'); if (el) el.textContent = SITE_COPY.tip[STEP] || ''; }
// [수정]·'넣으면 …' 를 누르면 내 가게 프로필로: 디저트를 골랐으면 3단계의 프로필, 아직이면 1단계의 가게 질문(같은 프로필에 저장됨)
function goProfile() {
  const el = document.getElementById(current ? 'profile' : 'rec');
  if (current) { goStep(3); el.open = true; }
  setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
}
document.getElementById('side-store').addEventListener('click', e => { if (e.target.closest('#side-edit, .ss-add')) goProfile(); });
const madeNow = () => !!(current && MADE_NAMES[current] && MADE_NAMES[current].length);   // 지금 고른 디저트로 메뉴를 만들었는지
function renderProg() {
  const done = { 1: !!current, 2: REACHED >= 3, 3: madeNow(), 4: madeNow() };   // 3·4단계는 지금 고른 디저트로 메뉴를 만들었을 때만 체크 (보관함에 예전 메뉴가 있어도 X)
  const act = madeNow() ? 4 : STEP;
  document.querySelectorAll('#prog li').forEach(li => { const p = +li.dataset.p;
    li.className = done[p] ? 'done' : (p === act ? 'act' : ''); li.querySelector('i').textContent = done[p] ? '✓' : p; });
  renderSideTip();
  document.querySelectorAll('#stepper button').forEach(b => { const s = +b.dataset.step;
    b.className = s === STEP ? 'act' : (s < REACHED || (s === 1 && current) ? 'done' : ''); b.querySelector('i').textContent = (s !== STEP && (s < REACHED)) ? '✓' : s;
    b.disabled = s > REACHED + (current ? 1 : 0) || (s > 1 && !current); });
}
function head() {
  const k = current || '', n = storeName();
  const H = { 1: ['1단계 · 디저트 고르기', `${n || '우리 가게'}, 다음엔 뭘 팔까요?`, '가게 정보를 고르면 지금 팔기 좋은 디저트를 추천해요. 네이버 10년치 검색량과 전국 매장 72만 곳 데이터로 판단해요.'],
              2: ['2단계 · 타이밍 진단', `${k}, 지금 출시해도 될까요?`, '검색량 흐름과 전국 매장 수로 유행 단계를 판단했어요.'],
              3: ['3단계 · 메뉴 만들기', `${n || '우리 가게'}, ${k}${ro(k)} 메뉴를 만들어볼까요?`, '목적만 골라 주세요. 등록한 가게 정보와 원가표 단가는 그대로 활용해요.'] }[STEP];
  document.getElementById('ph-tag').textContent = H[0]; document.getElementById('ph-title').textContent = H[1]; document.getElementById('ph-sub').textContent = H[2];
}
function goStep(n) {
  if (n > 1 && !current) return;
  if (n > STEP) track('step', current, '', { n });   // 몇 단계까지 가는지 (앞으로 갈 때만)
  STEP = n; REACHED = Math.max(REACHED, n);
  document.querySelectorAll('.step').forEach(s => s.hidden = +s.dataset.panel !== n);
  if (n === 3) renderGoals();
  head(); renderProg();
  requestAnimationFrame(() => Object.values(Chart.instances).forEach(c => c.resize()));
  document.getElementById('ph-tag').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function setView(v) {
  document.getElementById('view-flow').hidden = v !== 'flow';
  document.getElementById('radar').hidden = v !== 'radar';
  document.getElementById('local').hidden = v !== 'local';
  if (v === 'local') loadLocal();
  document.querySelectorAll('nav [data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === v));
  scrollTo({ top: 0, behavior: 'smooth' });
}
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); setView('flow'); goStep(+b.dataset.go); }));
document.querySelectorAll('#stepper [data-step]').forEach(b => b.addEventListener('click', () => goStep(+b.dataset.step)));
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
document.getElementById('profile').addEventListener('input', () => { renderSide(); head(); });
// ---------- 브랜드 찾기: 이 디저트로 많이 찾는 가게 TOP 5 (Worker /brands) ----------
const BR = {};
async function renderBrands(k) {
  const box = document.getElementById('brands'); if (!box || !k) return;
  const $ = id => document.getElementById(id);
  box.hidden = false; $('br-k').textContent = k; $('br-list').innerHTML = ''; $('br-tip').innerHTML = '';
  $('br-sub').textContent = '네이버 지역 검색에서 가게를 찾는 중…';
  const d = await (BR[k] = BR[k] || fetch(`${LIVE_API}/brands?q=${encodeURIComponent(k)}`).then(r => r.json()).catch(() => ({ ok: false })));
  if (current !== k) return;
  const bs = d.brands || [];
  if (!d.ok || (!d.verified && !bs.length)) { box.hidden = true; return; }   // 지역 검색이 막혔으면 '가게 없음'이라고 잘못 말하지 않게 숨김
  $('br-sub').textContent = `네이버 지역 검색에서 '${k}'(으)로 나오는 카페·디저트 가게 중 이름 검색이 많은 곳이에요 (가게 이름 최근 한 달 검색 수${d.verified ? '' : ' · 지역 검색 확인 못 함'} · 인허가 매장 수)`;
  if (!bs.length) { $('br-tip').innerHTML = `아직 <b>'${esc(k)}' 하면 떠오르는 대표 가게가 없어요.</b> 먼저 자리 잡으면 '우리 가게 이름 + ${esc(k)}'(으)로 검색되는 가게가 될 수 있어요.`; return; }
  $('br-list').innerHTML = bs.map(b => {
    const lead = b.lead == null ? '' : b.lead >= 2 ? `<span class="br-t first">유행보다 ${b.lead}주 먼저 뜸</span>` : b.lead <= -2 ? `<span class="br-t">${-b.lead}주 늦게 따라옴</span>` : '<span class="br-t">유행과 같이 뜸</span>';
    return `<li><div class="br-n"><b>${esc(b.shop || b.name)}</b>${b.cat ? ` <small>${esc(b.cat)}${b.addr ? ' · ' + esc(b.addr) : ''}</small>` : ''}</div>
      <div class="br-m"><span>월 <b>${b.total.toLocaleString()}</b>회 검색</span>${lead}${b.now >= 70 ? '<span class="br-t hot">🔺 지금도 인기</span>' : ''}${b.open || b.more ? `<span>영업 중 매장 ${b.more ? '100곳 이상' : b.open + '곳'}</span>` : ''}</div></li>`;
  }).join('');
  const top = bs[0], first = bs.filter(b => b.lead >= 2).sort((a, b) => b.lead - a.lead)[0];
  $('br-tip').innerHTML = `→ 1등 <b>${esc(top.shop || top.name)}</b>의 대표 메뉴 모양·가격·포장을 먼저 확인해 보세요.`
    + (first ? ` <b>${esc(first.shop || first.name)}</b>는 유행을 먼저 시작한 곳이에요. 이 가게 SNS에 다음 유행 힌트가 있을 수 있어요.` : '')
    + (top.open > 3 || top.more ? ' 매장이 여러 곳인 체인이라면, 맛보다 <b>우리 가게만의 한 가지</b>(크기·토핑·동네 재료)로 차별점을 두세요.' : '');
}
const __select = select;
select = k => { track('select', k); __select(k); renderBrands(k); renderPicks(); renderSide(); renderProg(); renderKind(); if (STEP === 3) renderGoals(); head(); };
renderPicks(); renderSide(); renderProg(); head();


/* ---------- 우리 동네 리포트 (live/district.json) ---------- */
const LC_KEY = 'dessert-timing-district';
const SIDO_ORDER = ['서울', '경기', '인천', '강원', '충북', '충남', '대전', '세종', '전북', '전남광주', '경북', '대구', '경남', '부산', '울산', '제주'];
const KW_TYPE = { '모찌': '모찌류(합산)' };   // 동네 키워드 → 검색량 분석 키워드
let DIST = null;
function loadLocal() {
  if (DIST) return;
  fetch('live/district.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : Promise.reject(r.status)).then(d => {
    DIST = d;
    const sel = document.getElementById('lc-sido'), gu = document.getElementById('lc-gu');
    const keys = Object.keys(d.d), by = s => keys.filter(k => k.split(' ')[0] === s);
    sel.innerHTML = SIDO_ORDER.filter(s => by(s).length).map(s => `<option value="${s}">${SIDO_NAME[s] || s}</option>`).join('');
    const fillGu = () => { gu.innerHTML = by(sel.value).map(k => `<option value="${k}">${k.split(' ').slice(1).join(' ')}</option>`).join(''); };
    let saved = null; try { saved = localStorage.getItem(LC_KEY); } catch {}
    const remembered = !!(saved && d.d[saved]), DEF = '서울 강남구' in d.d ? '서울 강남구' : keys[0];   // 처음 오는 사람은 서울 강남구
    if (!remembered) saved = DEF;
    sel.value = saved.split(' ')[0]; fillGu(); gu.value = saved;
    sel.onchange = fillGu;
    document.getElementById('lc-go').onclick = () => { renderLocal(gu.value); document.getElementById('lc-sheet').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    const msg = document.getElementById('lc-msg'), base = `전국 ${d.n}개 시군구 · 인허가 데이터 기준일 ${d.date}`;
    const nm = k => k === '세종 세종시' ? '세종시' : `${SIDO_NAME[k.split(' ')[0]] || ''} ${k.split(' ').slice(1).join(' ')}`;
    if (remembered && saved !== DEF) {
      msg.innerHTML = `📍 지난번에 본 <b>${esc(nm(saved))}</b>를 불러왔어요. <button type="button" class="lc-reset" id="lc-reset">처음 화면으로</button><br>${base}`;
      document.getElementById('lc-reset').onclick = () => { try { localStorage.removeItem(LC_KEY); } catch {}
        sel.value = DEF.split(' ')[0]; fillGu(); gu.value = DEF; renderLocal(DEF); try { localStorage.removeItem(LC_KEY); } catch {} msg.textContent = base; };
    } else msg.textContent = base;
    renderLocal(saved);
  }).catch(() => { document.getElementById('lc-msg').textContent = '동네 데이터를 불러오지 못했어요.'; });
}
const SIDO_NAME = { '서울': '서울특별시', '경기': '경기도', '인천': '인천광역시', '강원': '강원특별자치도', '충북': '충청북도', '충남': '충청남도', '대전': '대전광역시',
  '세종': '세종특별자치시', '전북': '전북특별자치도', '전남광주': '전남광주통합특별시', '경북': '경상북도', '대구': '대구광역시', '경남': '경상남도', '부산': '부산광역시', '울산': '울산광역시', '제주': '제주특별자치도' };
function renderLocal(key) {
  document.getElementById('lc-out').hidden = false;
  const d = DIST, x = d.d[key], N = d.nat; if (!x) return;
  try { localStorage.setItem(LC_KEY, key); } catch {}
  track('local', key);
  const place = key === '세종 세종시' ? '세종시' : key.split(' ').slice(1).join(' ');
  const full = key === '세종 세종시' ? '세종특별자치시' : `${SIDO_NAME[key.split(' ')[0]]} ${place}`;
  const net = x.o12 - x.c12;
  // 디저트별 빈자리: 전국 비율대로라면 몇 곳이 있을지 vs 실제
  const rows = d.kw.map(k => {
    const exp = N.kw[k] * x.alive / N.alive, have = x.kw[k] || 0, r = exp ? have / exp : 0;
    const tk = KW_TYPE[k] || k, ty = D.kw[tk] && D.kw[tk].type;
    let j = exp < 0.8 ? (have ? 'same' : null) : r < 0.5 ? 'empty' : r > 1.6 ? 'many' : 'same';
    if (j === 'empty' && ['유행형', '관망형'].includes(ty)) j = 'over';   // 비어 있지만 유행이 지난 것
    return { k, have, exp, r, ty, j };
  }).filter(o => o.j);
  const ord = { empty: 0, many: 1, same: 2, over: 3 };
  const GENERIC = ['디저트 카페', '케이크'];
  rows.sort((a, b) => ord[a.j] - ord[b.j] || (GENERIC.includes(a.k) - GENERIC.includes(b.k)) || b.exp - a.exp);
  const J = { empty: '빈자리', many: '많음', same: '비슷', over: '유행 지남' };
  const tbl = rows.slice(0, 10).map(o => `<tr><td><b>${o.k}</b>${o.ty ? ` <span class="tag" style="background:${TYPE_COLOR[o.ty]}">${o.ty}</span>` : ''}</td>
    <td class="n">${o.have}곳</td><td class="n">${o.exp < 1 ? o.exp.toFixed(1) : Math.round(o.exp)}곳</td><td style="text-align:center"><span class="jd ${o.j}">${J[o.j]}</span></td></tr>`).join('');
  // 사장님 체크 문장
  const acts = [];
  const good = rows.filter(o => o.j === 'empty' && ['정착형', '진행중', '시즌형'].includes(o.ty));
  const over = rows.filter(o => o.j === 'over');
  const empty = rows.filter(o => o.j === 'empty' && !GENERIC.includes(o.k));
  if (good.length) acts.push(`<b>${good.slice(0, 2).map(o => o.k).join(', ')}</b>${iga(good[Math.min(1, good.length - 1)].k)} 전국에서는 ${good[0].ty === '진행중' ? '지금 뜨는' : '오래 찾는'} 디저트인데 우리 동네엔 적어요. ${good[0].ty === '진행중' ? '기간 한정' : '정규 메뉴'} 후보로 먼저 검토해 보세요.`);
  else if (empty.length) acts.push(`<b>${empty.slice(0, 2).map(o => o.k).join(', ')}</b>${iga(empty[Math.min(1, empty.length - 1)].k)} 전국 평균보다 우리 동네에 적어요. 찾는 사람이 있는지 단골 반응부터 확인해 보세요.`);
  const sat = rows.filter(o => o.j === 'many' && ['유행형', '관망형'].includes(o.ty));
  if (over.length) acts.push(`<b>${over.slice(0, 2).map(o => o.k).join(', ')}</b>${iga(over[Math.min(1, over.length - 1)].k)} 우리 동네에 적지만 전국 유행이 이미 지났어요. 빈자리라고 바로 들이기보다 토핑이나 맛으로만 활용해 보세요.`);
  if (sat.length) acts.push(`<b>${sat.map(o => o.k).join(', ')}</b>${iga(sat[sat.length - 1].k)} 우리 동네에 이미 많고 전국 유행도 꺾였어요. 새로 들이기보다 기존 메뉴 리뉴얼이 안전해요.`);
  acts.push(net >= 0 ? `최근 1년 동안 연 곳(${x.o12})이 닫은 곳(${x.c12})보다 ${net}곳 많아요. 경쟁 가게가 늘고 있으니 <b>우리 가게만의 대표 메뉴</b>를 분명히 하세요.`
                     : `최근 1년 동안 닫은 곳(${x.c12})이 연 곳(${x.o12})보다 ${-net}곳 많아요. 동네 카페 수가 줄고 있어 <b>가격 경쟁보다 단골 관리</b>가 중요한 시기예요.`);
  if (x.surv3 !== null && N.surv3) acts.push(x.surv3 < N.surv3 - 5 ? `3~4년 전에 연 가게 중 3년을 버틴 곳이 ${x.surv3}%로 전국(${N.surv3}%)보다 낮아요. 신메뉴는 <b>장비 투자 없이 작게 시험</b>하는 걸 권해요.`
                     : x.surv3 > N.surv3 + 5 ? `3년을 버틴 가게 비율이 ${x.surv3}%로 전국(${N.surv3}%)보다 높아요. 자리 잡은 가게가 많은 동네라 <b>품질과 차별화</b>로 승부해야 해요.`
                     : `3년을 버틴 가게 비율이 ${x.surv3}%로 전국(${N.surv3}%)과 비슷해요.`);
  if (x.pop12 >= 30) acts.push(`최근 1년 팝업·행사 매장이 ${x.pop12}곳이나 열렸어요. 행사가 잦은 동네라 <b>축제·시즌에 맞춘 한정 메뉴</b>가 잘 맞을 수 있어요.`);
  const words = x.words.length ? `<div class="wchips">${x.words.map(([w, c, g]) => `<b>${esc(w)} ${c}곳${g >= 1.5 ? ` · ${g}배↑` : ''}</b>`).join('')}</div>` : '<p class="note">눈에 띄게 늘어난 단어는 아직 없어요.</p>';
  const el = document.getElementById('lc-sheet');
  el.innerHTML = `
    <div class="sh-top"><span class="sh-tag">우리 동네 카페·디저트 리포트 · ${d.date.slice(0, 7).replace('-', '.')}</span>
      <h2>${place}, 지금 어떤 디저트가<br>비어 있을까?</h2><p>${full} · 카페·디저트 가게 인허가 데이터로 정리했어요.</p></div>
    <div class="sh-kpi">
      <div><b>${x.alive.toLocaleString()}곳</b><span class="l">영업 중인 카페·디저트 가게 (전국 ${d.n}곳 중 ${x.rank}위)</span></div>
      <div><b><span style="color:#1a7f3c">+${x.o12}</span> / <span style="color:var(--teal-d)">−${x.c12}</span></b><span class="l">최근 1년 개업 / 폐업 (팝업 제외)</span></div>
      <div><b>${x.surv3 === null ? '–' : x.surv3 + '%'}</b><span class="l">3~4년 전 연 가게 중 3년 버틴 비율 (전국 ${N.surv3}%)</span></div>
      <div><b>${x.life === null ? '–' : x.life + '개월'}</b><span class="l">최근 1년 문 닫은 가게의 영업 기간 (중앙값, 전국 ${N.life}개월)</span></div>
    </div>
    <div class="sh-grid">
      <div class="sh-box"><h3><span>우리 동네 디저트 빈자리</span></h3>
        <p class="note">*전국 비율대로라면 우리 동네에 있을 매장 수예요. 실제 매장 수와 비교했어요. (상호에 디저트 이름이 들어간 가게 기준)</p>
        <table class="gap-t"><thead><tr><th>디저트 (전국 유행 단계)</th><th style="text-align:right">우리 동네</th><th style="text-align:right">전국 평균*</th><th style="text-align:center">판단</th></tr></thead><tbody>${tbl}</tbody></table></div>
      <div class="sh-box"><h3><span>요즘 새로 생긴 가게</span></h3>
        <p class="note">최근 6개월 새 가게 이름에 많이 나온 단어 (앞선 1년보다 늘어난 정도)</p>${words}
        <p class="note" style="margin-top:6px">최근 3개월 개업 ${x.o3}곳 중 최근</p>
        <ul>${x.recent.map(([n, dt, dg]) => `<li><b style="font-weight:inherit">${esc(n)}${dg ? `<small class="lc-dong">${esc(dg)}</small>` : ''}</b><span>${dt}</span></li>`).join('') || '<li>최근 3개월 새 가게가 없어요.</li>'}</ul></div>
    </div>
    <div class="sh-act"><h3>사장님 체크</h3><ol>${acts.map(a => `<li>${a}</li>`).join('')}</ol></div>
    <div class="sh-foot"><p style="margin:0">데이터: 행정안전부 지방행정 인허가(휴게음식점 중 커피숍·과자점·아이스크림·전통찻집·떡카페·기타 + 제과점, PC방·편의점 등 제외), 기준일 ${d.date}<br>90일 안에 닫은 곳은 팝업·행사 매장으로 따로 셌어요. 유행 단계는 네이버 데이터랩 검색량(2016~2026) 분석 결과예요. 실제 매출과는 다를 수 있어요.</p></div>`;
  el.hidden = false;
}
document.getElementById('lc-print').onclick = () => { if (DIST) { track('pdf', (document.getElementById('lc-gu') || {}).value || ''); print(); } };

/* ---------- 이번 주 레이더 (live/live.json, 매주 자동 갱신) ---------- */
// function으로 선언해 파일 어디서나(위쪽에서 처음 그릴 때도) 쓸 수 있게 (const면 선언 전 사용 시 TDZ 오류로 화면이 멈춤, 2026-11-09)
function esc(t) { return String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function renderRadar(L) {
  document.getElementById('rd-sub').textContent = `기준일 ${L.data_date} · ${L.updated} 자동 업데이트 · 전국 휴게음식점·제과점 인허가 데이터`;
  document.getElementById('rd-tiles').innerHTML = ['탕후루', '흑당', '크로플', '마카롱', '요거트 아이스크림', '베이글', '모찌', '소금빵', '붕어빵', '땅콩빵'].map(k => {
    const s = L.shops[k]; if (!s) return '';
    return `<button type="button" class="tile" data-k="${k}"><span>${k}</span><b>${s.open_now.toLocaleString()}곳</b><small><span class="up">+${s.week_open_n}</span> / <span class="dn">−${s.week_close_n}</span></small></button>`;
  }).join('');
  RADAR = L;
  document.querySelectorAll('#rd-tiles .tile').forEach(t => t.addEventListener('click', () => mapSelect(t.dataset.k, null)));
  mapSelect(mapK, mapR);
  const group = (lv, title) => {
    const xs = L.radar.filter(i => i.level === lv); if (!xs.length) return '';
    return `<p class="rd-group">${title}</p>` + xs.map(i => `<div class="rd-item"><span class="w">${esc(i.word)}</span>
      <span class="kb ${i.kind === 'menu' ? 'km' : 'kbr'}">${i.kind === 'menu' ? '메뉴' : '브랜드'}</span>
      <span class="m">최근 3개월 ${i.recent}곳 개업 · 이전 대비 ${i.growth}배 · ${i.spread}개 시군구</span>
      <div class="ex">예: ${i.examples.map(esc).join(', ')}</div></div>`).join('');
  };
  const html = group('alert', '🔔 크게 늘어난 단어 (기준을 모두 넘음)') + group('watch', '👀 늘어나기 시작한 단어 (기준에 가까움)');
  document.getElementById('rd-list').innerHTML = html || '<p class="note">이번 주에는 새로 늘어나는 단어가 없어요.</p>';
  // 진단 카드의 매장 숫자를 최신값으로
  Object.entries(L.shops).forEach(([k, v]) => {
    // 분석 노트북에 없던 디저트(소금빵·붕어빵·땅콩빵)는 레이더 숫자로 매장 정보를 만든다
    if (!D.shops[k] && v.alive_max) D.shops[k] = { alive: v.alive, stats: { total: v.total, popup: v.popup, open_now: v.open_now, alive_max: v.alive_max, alive_peak: v.alive_peak, close1y_before: null, close1y_after: null } };
    if (D.shops[k]) { D.shops[k].alive = v.alive; Object.assign(D.shops[k].stats, { open_now: v.open_now, alive_max: v.alive_max, alive_peak: v.alive_peak }); } });
  if (current) select(current);
}
/* ---------- 검색은 많은데 가게는 적은 디저트 (네이버 검색광고 월간 검색 수 ÷ 영업 중 매장) ---------- */
const VOL_TERMS = { '탕후루': ['탕후루'], '흑당': ['흑당'], '크로플': ['크로플'], '마카롱': ['마카롱'], '요거트 아이스크림': ['요거트아이스크림'],
  '베이글': ['베이글'], '모찌': ['모찌'], '소금빵': ['소금빵'], '붕어빵': ['붕어빵', '잉어빵'], '땅콩빵': ['땅콩빵'] };
async function renderOpportunity(L) {
  const box = document.getElementById('opp-list');
  try {
    const rows = await Promise.all(Object.entries(VOL_TERMS).filter(([k]) => L.shops[k]).map(async ([k, ts]) => {
      const vs = await Promise.all(ts.map(t => getJSON(`/volume?q=${encodeURIComponent(t)}`)));
      const vol = vs.reduce((a, v) => a + (v.month ? v.month.total : 0), 0), shops = L.shops[k].open_now;
      return { k, vol, shops, per: shops ? vol / shops : 0 };
    }));
    const xs = rows.filter(r => r.vol && r.shops).sort((a, b) => b.per - a.per), mx = xs.length ? xs[0].per : 1;
    if (!xs.length) throw new Error('empty');
    OPP = Object.fromEntries(xs.map((r, i) => [r.k, i + 1])); refreshClock();   // 시계 점수에 '가게당 검색' 반영
    box.innerHTML = xs.map((r, i) => `<div class="opp-row${i < 3 ? ' top' : ''}"><span class="rk">${i + 1}</span><span class="nm">${esc(r.k)}${r.shops < 30 ? '<small title="가게 수가 적어 숫자가 크게 흔들릴 수 있어요">가게 30곳 미만</small>' : ''}</span>
      <span class="bar"><i style="width:${(r.per / mx * 100).toFixed(1)}%"></i></span>
      <span class="v"><b>가게당 ${Math.round(r.per).toLocaleString()}회</b>월 ${r.vol.toLocaleString()}회 · ${r.shops.toLocaleString()}곳</span></div>`).join('');
  } catch (e) {
    box.innerHTML = '<p class="note">지금은 검색 수를 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.</p>';
  }
}
fetch('live/live.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : Promise.reject(r.status)).then(L => { renderRadar(L); renderOpportunity(L); })
  .catch(() => { document.getElementById('rd-list').innerHTML = '<p class="note">레이더 데이터를 불러오지 못했어요.</p>'; });
renderSaved();   // 보관함 (esc 정의 뒤에 그려야 해서 맨 끝)
/* ---------- 레이더 검증표: 이 레이더, 예전 유행도 미리 잡았을까? (2017~2026 가게 데이터에 같은 방법을 매달 적용한 결과) ---------- */
// [단어, 종류, 레이더가 처음 알아챈 달, 검색이 가장 많았던 달(검색 자료 없으면 null)]
const BACKTEST = [
  ['왕가탕후루', '브랜드', '2022.11', '2023.08'], ['탕후루', '메뉴', '2023.04', '2023.08'], ['요거트아이스크림의정석', '브랜드', '2024.03', '2024.08'],
  ['크로플', '메뉴', '2021.01', '2020.09'], ['쌀핫도그', '메뉴', '2017.03', null], ['티라미수', '메뉴', '2020.08', null], ['잉어빵', '메뉴', '2024.12', null], ['땅콩빵', '메뉴', '2025.07', null],
];
function renderBacktest() {
  const body = document.getElementById('bt-body'); if (!body) return;
  const ym = x => { const [y, m] = x.split('.').map(Number); return y * 12 + m; };
  const scored = BACKTEST.filter(r => r[3]).map(([w, k, a, pk]) => ({ w, k, a, pk, d: ym(pk) - ym(a) })), skipped = BACKTEST.filter(r => !r[3]).map(r => r[0]);
  const early = scored.filter(r => r.d > 0), ds = early.map(r => r.d);
  document.getElementById('bt-sum').innerHTML = early.length
    ? `채점한 <b>${scored.length}개</b> 중 <b>${early.length}개</b>를 유행 꼭대기보다 <b>${Math.min(...ds)}${Math.max(...ds) !== Math.min(...ds) ? '~' + Math.max(...ds) : ''}개월 먼저</b> 알아챘어요`
    : `채점한 ${scored.length}개 중 유행 꼭대기보다 먼저 알아챈 단어는 없어요`;
  body.innerHTML = scored.map(r => `<tr><td>${esc(r.w)} <span class="kb ${r.k === '브랜드' ? 'kbr' : 'km'}">${r.k}</span></td><td>${r.a}</td><td>${r.pk}</td><td>${r.d > 0
    ? `<b class="bt-ok">✅ ${r.d}개월 전에 알아챘어요</b>` : r.d < 0 ? `<span class="bt-late">❌ ${-r.d}개월 늦었어요</span>` : '<b class="bt-ok">✅ 같은 달에 알아챘어요</b>'}</td></tr>`).join('');
  document.getElementById('bt-skip').textContent = skipped.length ? `채점 못 한 단어: ${skipped.join('·')} (비교할 검색 자료 없음)` : '';
}
renderBacktest();

renderRecForm();   // 1단계 추천 질문 (프로필 폼을 읽어서 그림)
document.getElementById('ev4').addEventListener('toggle', () => Object.values(Chart.instances).forEach(c => c.resize()));

/* ---------- 1단계 디저트 시계: 12달 자리마다 그 달에 가장 많이 늘어나는 디저트 ---------- */
// ---- 달마다 점수로 TOP 3 (2026-11-10) ----
// 점수 = ① 그 달 검색 증가(season) + ② 유행 단계 + ③ 전년 대비 + ④ 그 달 대목 + ⑤ 재료값(KAMIS) + ⑥ 가게당 검색(레이더) + ⑦ 내 가게 프로필 + ⑧ 월별 판매 표(사용자가 정함)
// 검색 데이터가 없는 붕어빵은 겨울 간식 기본값(경험 기준)
// ⑧ 월별 판매 표 (사용자가 정한 표, 2026-11-10): 달마다 대표 메뉴 +3점, 같이 팔기 좋은 메뉴 +0.5점
const MD_TOP = ['딸기모찌', '발렌타인 초콜릿', '마카롱', '쑥', '카네이션 케이크', '요거트 아이스크림', '빙수', '망고빙수', '약과', '고구마 디저트', '찹쌀떡', '크리스마스 케이크'];
const MD_ALSO = [['붕어빵', '약과'], ['딸기모찌'], ['딸기 케이크'], ['베이글'], ['약과', '쑥', '마카롱'], [], ['요거트 아이스크림'], ['요거트 아이스크림'], ['밤 디저트'], ['밤 디저트', '붕어빵'], ['붕어빵', '크리스마스 케이크'], ['딸기모찌', '붕어빵']];
const SEASON_PRIOR = { '붕어빵': [1.5, 1.2, 0.5, 0.3, 0.3, 0.3, 0.3, 0.3, 0.5, 1.0, 1.6, 1.8] };
// 비슷한 디저트는 TOP 3에 하나만
const FAMILY = { '과일모찌': '모찌', '딸기모찌': '모찌', '찹쌀모찌': '찹쌀', '찹쌀떡': '찹쌀', '모찌떡': '모찌', '마카롱': '마카롱', '뚱카롱': '마카롱', '크리스마스 케이크': '딸기케이크', '딸기 케이크': '딸기케이크', '빙수': '빙수', '망고빙수': '빙수' };
// 디저트에 쓰는 제철 재료 (KAMIS 이름)
const DESSERT_ING = { '딸기모찌': ['딸기'], '과일모찌': ['딸기'], '딸기 케이크': ['딸기'], '크리스마스 케이크': ['딸기'], '탕후루': ['딸기'], '고구마 디저트': ['고구마'], '밤 디저트': ['밤'],
  '찹쌀떡': ['찹쌀', '팥'], '찹쌀모찌': ['찹쌀', '팥'], '모찌떡': ['찹쌀'], '쑥': ['쑥'], '흑임자': ['참깨'], '빙수': ['팥'] };
const TYPE_PTS = { '진행중': [1, '지금 뜨는 중'], '정착형': [0.7, '정착형'], '유행형': [-1, '식어 가는 유행'], '관망형': [-0.2, ''], '시즌형': [0, ''] };
const DK_EMO = { '크리스마스 케이크': '🎄', '딸기 케이크': '🍓', '발렌타인 초콜릿': '🍫', '빙수': '🍧', '고구마 디저트': '🍠', '밤 디저트': '🌰', '카네이션 케이크': '🌸' };
let KAMIS_VS = {};   // 재료 → 한 달 새 소매가 변화(%), /kamis 에서 받음
let OPP = {};        // 디저트 → 가게당 검색 순위(1이 가장 많음), renderOpportunity 가 채움
const dkPhoto = k => photo(k) || `<span class="dk-emo">${DK_EMO[k] || '🍰'}</span>`;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const CLICK_AS = { '망고빙수': '빙수' };   // 누르면 진단은 빙수 데이터로
function dkCands() {
  const c = {};
  Object.entries(D.kw).filter(([k, v]) => IMG[k] && k !== '마라탕' && k !== '모찌류(합산)').forEach(([k, v]) => { c[k] = { s: v.season, type: v.type, yoy: v.cal ? null : v.yoy }; });
  if (c['빙수'] && IMG['망고빙수']) c['망고빙수'] = { ...c['빙수'] };   // 망고빙수는 빙수 검색 흐름을 그대로 씀(따로 받은 데이터 없음)
  Object.entries(SEASON_PRIOR).forEach(([k, s]) => { if (IMG[k] && !c[k]) c[k] = { s, type: '겨울 간식', yoy: null }; });
  return c;
}
// i월(0~11)의 후보 점수표 (높은 순)
function monthScores(i, C, evs) {
  const cm = new Date().getMonth(), near = i === cm || i === (cm + 1) % 12;
  const p = loadProfile(), have = (p && p.eq) || [], hasP = !!(p && ((p.eq && p.eq.length) || p.price));
  const [lo, hi] = p && p.price ? p.price.split('-').map(Number) : [0, 1e9];
  return Object.entries(C).map(([k, o]) => {
    const parts = [], add = (pts, txt) => parts.push({ pts, txt });
    const s = o.s[i]; add(clamp(Math.log2(Math.max(s, 0.05)) * 2, -1.5, 2.5), s >= 1.2 ? `검색 평소의 ${s.toFixed(1)}배` : '');
    const t = TYPE_PTS[o.type]; if (t) add(t[0], t[1]);
    if (o.yoy !== null && o.yoy !== undefined && Math.abs(o.yoy) >= 20) add(clamp(o.yoy / 200, -0.5, 0.5), `작년보다 ${o.yoy > 0 ? '+' : ''}${Math.round(o.yoy)}%`);
    const es = evs.filter(e => e.d.getMonth() === i && e.ks.includes(k));
    es.slice(0, 2).forEach(e => add(0.8, `${e.n}(${e.d.getMonth() + 1}/${e.d.getDate()}) 대목`));
    if (near) (DESSERT_ING[k] || []).forEach(g => { const v = KAMIS_VS[g]; if (v === undefined || v === null) return;
      if (v <= -10) add(0.8, `${g}값 한 달 새 −${Math.abs(v)}%`); else if (v <= -5) add(0.4, `${g}값 한 달 새 −${Math.abs(v)}%`); else if (v >= 15) add(-0.5, `${g}값 한 달 새 +${v}%`); });
    if (MD_TOP[i] === k) add(3, '이 달 대표 메뉴'); else if (MD_ALSO[i].includes(k)) add(0.5, '같이 팔기 좋음');
    const rk = OPP[k]; if (rk) { if (rk <= 3) add(0.8, '가게당 검색 많음'); else if (rk <= 6) add(0.4, '가게당 검색 많은 편'); }
    if (hasP) { const r = REQ[k] || guessReq(k);
      if (r) { const miss = r.eq.filter(e => !have.includes(e)); if (!miss.length && r.eq.length) add(0.8, '내 장비로 바로 가능'); else if (miss.length && !r.alt) add(-0.5, '');
        if (p.price && r.price >= lo && r.price <= hi) add(0.4, '내 가격대에 맞음'); } }
    return { k, i, sc: parts.reduce((a, x) => a + x.pts, 0), parts, e: es[0] || null };
  }).sort((a, b) => b.sc - a.sc);
}
// 한 줄 이유: 점수를 많이 준 이유 3개까지
const DK_TAG = ['이 달 대표 메뉴', '같이 팔기 좋음'];   // 표 가점 꼬리표는 이유 글에서 뺌(자리가 좁고 정보가 적음)
// 이유 글 후보(긴 것 → 짧은 것). 칸 폭에 한 줄로 들어가는 가장 긴 것을 fitWhy()가 골라 보여 줌
const dkWhy = m => { const p = m.parts.filter(x => x.txt && x.pts > 0 && !DK_TAG.includes(x.txt)).sort((a, b) => (b.pts + (/대목$/.test(b.txt) ? 10 : 0)) - (a.pts + (/대목$/.test(a.txt) ? 10 : 0))).slice(0, 2).map(x => x.txt);   // 대목(날짜가 있는 행동거리)을 맨 앞에
  return p.length ? (p.length > 1 ? [p.join(' · '), p[0]] : [p[0]]) : ['꾸준히 찾는 디저트']; };
const whyAttr = list => encodeURIComponent(JSON.stringify(list));
function fitWhy() {
  document.querySelectorAll('#dk-now .dk-why').forEach(el => {
    let list; try { list = JSON.parse(decodeURIComponent(el.dataset.w)); } catch { return; }
    for (const t of list) { el.textContent = t; if (el.scrollWidth <= el.clientWidth + 1) break; }
  });
}
function top3(list) { const out = [], fam = new Set();
  for (const m of list) { const f = FAMILY[m.k] || m.k; if (fam.has(f)) continue; fam.add(f); out.push(m); if (out.length === 3) break; } return out; }
function clockPlan() {
  const now = new Date(), t0 = new Date(now.getFullYear(), now.getMonth(), 1), t1 = new Date(now.getFullYear(), now.getMonth() + 12, 1);
  const evs = EVENTS.map(([d, n, ks]) => ({ d: new Date(d + 'T00:00:00'), n, ks })).filter(e => e.d >= t0 && e.d < t1), C = dkCands();
  return [...Array(12)].map((_, i) => { const list = monthScores(i, C, evs); return { i, list, top: top3(list) }; });
}
function renderClock() {
  const face = document.getElementById('dk-face'); if (!face) return;
  const plan = clockPlan(), now = new Date().getMonth(), nx = (now + 1) % 12, today = new Date(); today.setHours(0, 0, 0, 0);
  face.innerHTML = plan.map(({ top }, i) => { const k = top[0].k, a = (i + 1) * 30 * Math.PI / 180, x = 50 + 39 * Math.sin(a), y = 50 - 39 * Math.cos(a);
    return `<button type="button" class="dk-it${i === now ? ' now' : i === nx ? ' next' : ''}" data-k="${k}" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%" title="${i + 1}월 1등 · ${k}">${dkPhoto(k)}<b>${i + 1}월</b></button>`; }).join('') +
    `<i class="dk-hand" id="dk-hand"></i><i class="dk-c"></i><span class="dk-mo">${now + 1}월</span>`;
  requestAnimationFrame(() => setTimeout(() => { document.getElementById('dk-hand').style.rotate = `${(now + 1) * 30}deg`; }, 80));
  const medal = ['🥇', '🥈', '🥉'];
  const topRows = plan[now].top.map((m, r) => `<button type="button" class="dk-top" data-k="${m.k}">${dkPhoto(m.k)}<span><small>${medal[r]} ${r + 1}등</small><b>${esc(m.k)}</b><em class="dk-why" data-w="${whyAttr(dkWhy(m))}"></em></span></button>`).join('');
  const nm = plan[nx].top[0], daysToNext = Math.round((new Date(today.getFullYear(), now + 1, 1) - today) / 864e5);
  const evLeft = nm.e ? Math.round((nm.e.d - today) / 864e5) : null;
  const nextBase = evLeft !== null && evLeft >= 0 ? `${nm.e.n}까지 ${evLeft}일` : `${nx + 1}월까지 ${daysToNext}일`, nextDays = `${evLeft !== null && evLeft >= 0 ? evLeft : daysToNext}일`;
  const nextAct = [`→ ${nextBase} 남았어요 · 재료·사진 미리 준비`, `→ ${nextBase} · 미리 준비`, `→ ${nextDays} 남았어요 · 미리 준비`, `→ ${nextDays} 남았어요`];
  const nextRow = `<button type="button" class="dk-next" data-k="${nm.k}">${dkPhoto(nm.k)}<span><small>다음 달 준비 (${nx + 1}월 1등)</small><b>${esc(nm.k)}</b><em class="dk-why dk-act" data-w="${whyAttr(nextAct)}"></em></span></button>`;
  document.getElementById('dk-title').textContent = `${now + 1}월은 ${plan[now].top[0].k}의 시간`;
  document.getElementById('dk-sub').textContent = `${now + 1}월에 팔기 좋은 TOP 3예요.`;
  document.getElementById('dk-now').innerHTML = topRows + nextRow;
  fitWhy();   // 한 줄에 들어가게 글 길이를 맞춤
  document.querySelectorAll('#dk-face .dk-it, #dk-now button').forEach(b => b.onclick = async () => { const k = CLICK_AS[b.dataset.k] || b.dataset.k;
    if (D.kw[k]) { select(k); goStep(2); } else if (await analyzeLive(k)) goStep(2); });
}
function refreshClock() { try { renderClock(); } catch (e) { console.error(e); } }
// 칸 폭이 바뀌거나(창 크기·화면 전환) 글꼴이 늦게 불러와지면 다시 맞춤
if (window.ResizeObserver) new ResizeObserver(() => fitWhy()).observe(document.getElementById('dk-now'));
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitWhy());
// 재료값(KAMIS): 한 달 새 소매가 변화를 재료 이름별 중앙값으로
fetch(LIVE_API + '/kamis').then(r => r.ok ? r.json() : null).then(j => {
  if (!j || !j.ok || !j.rows) return;
  const by = {}; j.rows.forEach(r => { if (r.vsMonth !== null && r.vsMonth !== undefined) (by[r.name] = by[r.name] || []).push(r.vsMonth); });
  KAMIS_VS = Object.fromEntries(Object.entries(by).map(([n, a]) => [n, Math.round(med(a))])); refreshClock();
}).catch(() => { });
renderClock();


/* ---------- 로그인 (Supabase Auth: 구글 · 카카오) · 보관함/원가표/가게 프로필 서버 저장 (2026-11-09) ----------
   표·권한은 supabase/schema.sql. publishable 키는 원래 공개용(보안은 RLS가 맡음). service_role 키는 절대 여기 넣지 않는다 */
var SB_URL = 'https://wnntvvvnglpqtahsbasj.supabase.co', SB_KEY = 'sb_publishable_NZ6FnSd-Y4ASkDwVKP6LiA_YSzXo7dR';
var SB = null, USER = null, SYNCING = false, CLOUD_PEND = new Set(), CLOUD_T = 0;
try { if (window.supabase) SB = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } }); } catch (e) { console.warn('로그인 준비 실패', e); }
function authUid() { return USER ? 'u' + USER.id.replace(/-/g, '').slice(0, 20) : ''; }
async function authToken() { if (!SB || !USER) return ''; try { const { data } = await SB.auth.getSession(); return (data.session && data.session.access_token) || ''; } catch { return ''; } }
function cloudSoon(kind) { if (!USER || SYNCING) return; CLOUD_PEND.add(kind); clearTimeout(CLOUD_T); CLOUD_T = setTimeout(cloudPush, 800); }
async function cloudPush() {
  if (!USER || !CLOUD_PEND.size) return;
  const row = { user_id: USER.id, updated_at: new Date().toISOString() };
  if (CLOUD_PEND.has('profile')) row.profile = loadProfile();
  if (CLOUD_PEND.has('costs')) row.costs = loadMy();
  if (CLOUD_PEND.has('sheet')) row.sheet = loadSheet();
  CLOUD_PEND.clear();
  const { error } = await SB.from('user_data').upsert(row);
  if (error) console.warn('서버 저장 실패', error.message);
}
async function cloudAddMenu(it) { if (!USER) return; const { error } = await SB.from('saved_menus').insert({ local_id: it.id, k: it.k, goal: it.goal || '', m: it.m }); if (error) console.warn('보관함 서버 저장 실패', error.message); }
async function cloudDelMenu(id) { if (!USER) return; await SB.from('saved_menus').delete().eq('local_id', id); }
// 로그인하면: 서버에 있는 것 + 이 브라우저에 있던 것을 합쳐 양쪽을 같게
async function cloudSync() {
  if (!USER) return; SYNCING = true; const msg = document.getElementById('acct-sync');
  try {
    const [ud, ms] = await Promise.all([SB.from('user_data').select('profile,costs,sheet').maybeSingle(),
      SB.from('saved_menus').select('local_id,k,goal,m,created_at').order('local_id', { ascending: false }).limit(200)]);
    if (ud.error || ms.error) throw new Error((ud.error || ms.error).message);
    const sv = ud.data || {}, prof = sv.profile || loadProfile(), costs = { ...loadMy(), ...(sv.costs || {}) }, sheet = sv.sheet || loadSheet();
    if (prof) { saveProfile(prof); fillForm(prof); fillName(prof); profileSummary(); }
    storeMy(costs); renderMyCost();
    if (sheet) { try { localStorage.setItem(SHEET_KEY, JSON.stringify(sheet)); } catch { } sheetUI(); } else { sheetUI(); }
    await SB.from('user_data').upsert({ user_id: USER.id, profile: prof || null, costs, sheet: sheet || null, updated_at: new Date().toISOString() });
    const server = ms.data || [], have = new Set(server.map(r => +r.local_id)), local = loadSaved(), up = local.filter(x => !have.has(+x.id));
    if (up.length) { const { error } = await SB.from('saved_menus').insert(up.map(x => ({ local_id: x.id, k: x.k, goal: x.goal || '', m: x.m }))); if (error) console.warn(error.message); }
    const merged = [...server.map(r => ({ id: +r.local_id, at: String(r.created_at).slice(0, 10), k: r.k, goal: r.goal, m: r.m })), ...up].sort((a, b) => b.id - a.id);
    storeSaved(merged.slice(0, 30)); renderSaved(); renderProg();
    if (msg) msg.textContent = `✅ 서버와 맞췄어요: 보관함 ${merged.length}개 · 내 원가표 재료 ${Object.keys(costs).length}개${up.length ? ` (이 브라우저에 있던 메뉴 ${up.length}개를 올렸어요)` : ''}`;
  } catch (e) { console.warn('동기화 실패', e); if (msg) msg.textContent = '⚠️ 서버와 맞추지 못했어요. 잠시 뒤 다시 열어 주세요. (' + e.message + ')'; }
  finally { SYNCING = false; }
}
function authUI() {
  const b = document.getElementById('auth-btn'); if (!b) return;
  if (!SB) { b.hidden = true; return; }
  b.hidden = false;
  const md = USER ? USER.user_metadata || {} : {}, nm = USER ? (md.name || md.full_name || md.nickname || md.preferred_username || (USER.email || '').split('@')[0] || '내 계정') : '';
  b.innerHTML = USER ? `${md.avatar_url ? `<img src="${esc(md.avatar_url)}" alt="" referrerpolicy="no-referrer">` : '👤'}<span>${esc(nm)}</span>` : '<span>로그인</span>';
  b.setAttribute('aria-label', USER ? `내 계정: ${nm}` : '로그인');
  document.getElementById('acct-h').textContent = USER ? '내 계정' : '로그인';
  document.getElementById('acct-in').hidden = !!USER; document.getElementById('acct-me').hidden = !USER;
  if (USER) {
    document.getElementById('acct-pic').innerHTML = md.avatar_url ? `<img src="${esc(md.avatar_url)}" alt="" referrerpolicy="no-referrer">` : '';
    document.getElementById('acct-name').textContent = nm;
    const pv = (USER.app_metadata && USER.app_metadata.provider) || '';
    document.getElementById('acct-mail').textContent = [USER.email, pv === 'google' ? '구글 로그인' : pv === 'kakao' ? '카카오 로그인' : pv].filter(Boolean).join(' · ');
  }
}
if (SB) {
  const acct = document.getElementById('acct');
  document.getElementById('auth-btn').onclick = () => { authUI(); acct.showModal(); };
  document.querySelector('[data-close-acct]').onclick = () => acct.close();
  document.getElementById('acct-later').onclick = () => acct.close();   // [나중에 할게요]
  acct.addEventListener('click', e => { if (e.target === acct) acct.close(); });
  document.querySelectorAll('[data-sso]').forEach(btn => btn.onclick = async () => {
    const provider = btn.dataset.sso, m = document.getElementById('acct-msg');
    btn.disabled = true; m.textContent = `${provider === 'google' ? '구글' : '카카오'} 로그인 화면으로 가는 중…`;
    // 켜지지 않은 로그인(예: 카카오 설정 전)은 누르면 영어 오류 화면으로 가 버려서, 먼저 Supabase 설정을 물어본다
    try { const st = await fetch(`${SB_URL}/auth/v1/settings`, { headers: { apikey: SB_KEY } }).then(r => r.json());
      if (st && st.external && !st.external[provider]) { btn.disabled = false; m.textContent = `⚠️ ${provider === 'kakao' ? '카카오' : '구글'} 로그인은 아직 준비 중이에요. 다른 방법으로 로그인해 주세요.`; return; } } catch { }
    try { sessionStorage.setItem('dt-login', provider); } catch { }
    const { error } = await SB.auth.signInWithOAuth({ provider, options: { redirectTo: location.origin + location.pathname } });
    if (error) { btn.disabled = false; m.textContent = '⚠️ ' + (/provider is not enabled|Unsupported provider/i.test(error.message) ? `${provider === 'kakao' ? '카카오' : '구글'} 로그인이 아직 준비 중이에요.` : error.message); }
  });
  document.getElementById('acct-out').onclick = async () => { await SB.auth.signOut(); acct.close(); };
  document.getElementById('acct-del').onclick = async () => {
    if (!confirm('정말 탈퇴할까요? 서버에 저장된 보관함·원가표·가게 프로필이 모두 지워지고 되돌릴 수 없어요. (이 브라우저에 있는 것은 남아요)')) return;
    const { error } = await SB.rpc('delete_my_account');
    if (error) { alert('탈퇴하지 못했어요: ' + error.message); return; }
    track('account_delete'); await SB.auth.signOut(); acct.close(); alert('탈퇴했어요. 그동안 써 주셔서 고마워요.');
  };
  // 로그인 실패하고 돌아왔을 때 (주소에 error가 붙어 옴)
  { const q = new URLSearchParams(location.search + '&' + location.hash.slice(1)), err = q.get('error_description') || q.get('error');
    if (err) { authUI(); acct.showModal(); document.getElementById('acct-msg').textContent = '⚠️ 로그인하지 못했어요: ' + err.replace(/\+/g, ' ');
      history.replaceState(null, '', location.pathname); } }
  SB.auth.onAuthStateChange((ev, session) => {
    const was = USER && USER.id; USER = session ? session.user : null; authUI();
    if (USER && USER.id !== was) {
      setTimeout(cloudSync, 0);   // onAuthStateChange 안에서 바로 await 하면 supabase-js가 멈출 수 있어 한 박자 뒤에
      let p = ''; try { p = sessionStorage.getItem('dt-login') || ''; sessionStorage.removeItem('dt-login'); } catch { }
      if (p) { const isNew = Date.now() - new Date(USER.created_at).getTime() < 5 * 60e3; track('login', p, '', { new: isNew }); }
      if (/[?&]code=/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash);
    }
  });
}
authUI();
