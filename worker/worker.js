/**
 * 디저트 타이밍 실시간 분석용 Cloudflare Worker
 * 홈페이지가 이 Worker를 거쳐 네이버 검색량과 인허가 데이터를 받아온다. (인증키는 Worker 비밀 변수에만 저장)
 *
 * 필요한 비밀 변수 (Settings → Variables and Secrets)
 *   NAVER_ID      NAVER API HUB Client ID
 *   NAVER_SECRET  NAVER API HUB Client Secret
 *   DATA_GO_KEY   공공데이터포털 인증키 (Decoding)
 *   GEMINI_KEY    Google AI Studio Gemini API 키 (신메뉴 제안용)
 *   KAMIS_KEY, KAMIS_ID   KAMIS(농산물유통정보) Open API 인증키·아이디 (재료 시세용)
 *   NAVER_AD_KEY, NAVER_AD_SECRET, NAVER_AD_CUSTOMER   네이버 검색광고 API 액세스라이선스·비밀키·CUSTOMER_ID (월간 검색 수용)
 *   NAVER_SEARCH_ID, NAVER_SEARCH_SECRET   네이버 개발자센터(developers.naver.com) 애플리케이션 Client ID·Secret, 사용 API '검색' (다른 카페 가격용)
 *
 * GET /trend?q=과일모찌                  → 2016년부터 주간 검색량 (최고점 = 100)
 * GET /shops?q=과일모찌&src=cafe&page=1  → 상호에 단어가 들어간 휴게음식점(cafe)·제과점(bakery) 100곳씩
 * GET /volume?q=소금빵                  → 네이버 검색광고: 최근 한 달 검색 수(PC·모바일) + 연관 키워드
 * GET /price?q=소금빵&area=강남       → 네이버 블로그 후기에서 뽑은 다른 카페 판매가 (최근 1년, 보통 가격·범위)
 * POST /menu  {keyword, type, kind, price, targetRate, profile}  → AI 신메뉴 제안 + 원가 검증(목표 원가율을 넘으면 최대 3번 다시)
 */
import { DurableObject } from 'cloudflare:workers';

// Gemini는 홍콩 등에서 막혀 있다. Worker는 접속한 사람과 가까운 곳(가끔 홍콩)에서 돌기 때문에,
// 미국 서부에 고정한 Durable Object를 거쳐서 Gemini를 부른다.
export class GeminiProxy extends DurableObject {
  async fetch(request) { return fetch(request); }
}
function geminiFetch(url, init, env) {
  if (!env.GEMINI_PROXY) return fetch(url, init);
  const stub = env.GEMINI_PROXY.get(env.GEMINI_PROXY.idFromName('us-west-v1'), { locationHint: 'wnam' });
  return stub.fetch(new Request(url, init));
}

const ALLOWED_ORIGINS = ['https://hyeran712.github.io'];
const SHOP_API = {
  cafe: 'https://apis.data.go.kr/1741000/rest_cafes/info',
  bakery: 'https://apis.data.go.kr/1741000/bakeries/info',
};
const TREND_API = 'https://naverapihub.apigw.ntruss.com/search-trend/v1/search';

function cors(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
  return {
    'Access-Control-Allow-Origin': ok ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}
const json = (data, status, origin, maxAge = 0) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(origin), ...(maxAge ? { 'Cache-Control': `public, max-age=${maxAge}` } : {}) },
});

function cleanQuery(q) {
  q = (q || '').trim().replace(/\s+/g, ' ');
  if (!q || q.length > 20 || /[<>"'`{}\\]/.test(q)) return null;
  return q;
}

async function trend(q, env) {
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const variants = [...new Set([q, q.replace(/ /g, '')])];
  const res = await fetch(TREND_API, {
    method: 'POST',
    headers: { 'X-NCP-APIGW-API-KEY-ID': env.NAVER_ID, 'X-NCP-APIGW-API-KEY': env.NAVER_SECRET, 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: '2016-01-01', endDate: today, timeUnit: 'week', keywordGroups: [{ groupName: q, keywords: variants }] }),
  });
  if (!res.ok) throw new Error(`검색량 API 오류 ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const r = (data.results || [])[0] || { data: [] };
  return { q, dates: r.data.map(d => d.period), ratio: r.data.map(d => d.ratio) };
}

// ---------- 재료 시세 (KAMIS 농산물유통정보, 최근일자 도·소매 가격) ----------
// 디저트에 쓰는 재료만 골라서 보여 준다. ?all=1 이면 전체 품목 (처음 확인용)
const KAMIS_WANT = ['딸기', '찹쌀', '쌀', '팥', '계란', '달걀', '사과', '배', '감귤', '귤', '포도', '샤인머스캣', '바나나', '키위', '토마토', '방울토마토', '복숭아', '참깨', '들깨', '땅콩', '호두', '밤', '쑥', '우유', '고구마', '단호박', '호박', '레몬', '블루베리', '파인애플', '망고', '체리', '감'];
const num0 = v => { const n = Number(String(v || '').replace(/,/g, '')); return Number.isFinite(n) && n > 0 ? n : null; };
async function kamis(env, all) {
  if (!env.KAMIS_KEY || !env.KAMIS_ID) return { ok: false, error: 'KAMIS 키(KAMIS_KEY · KAMIS_ID)가 아직 Worker에 없어요.' };
  const u = new URL('https://www.kamis.or.kr/service/price/xml.do');
  u.searchParams.set('action', 'dailySalesList');
  u.searchParams.set('p_cert_key', env.KAMIS_KEY);
  u.searchParams.set('p_cert_id', env.KAMIS_ID);
  u.searchParams.set('p_returntype', 'json');
  const res = await fetch(u.toString(), { headers: { 'User-Agent': 'dessert-timing' } });
  const text = await res.text();
  let d; try { d = JSON.parse(text); } catch { throw new Error(`KAMIS 응답 오류 ${res.status}: ${text.slice(0, 200)}`); }
  let items = d.price || (d.data && d.data.item) || [];
  if (!Array.isArray(items)) items = [items];
  const rows = items.map(x => ({
    name: x.item_name || x.itemname || '', kind: x.kind_name || x.kindname || '', rank: x.rank || '', unit: x.unit || '',
    type: x.product_cls_name || x.product_cls_code || '', category: x.category_name || '', date: x.lastest_day || x.lastest_date || x.regday || '',
    now: num0(x.dpr1), dayAgo: num0(x.dpr2), monthAgo: num0(x.dpr3), yearAgo: num0(x.dpr4),
  })).filter(r => r.now && (all || KAMIS_WANT.some(w => w.length === 1 ? r.name === w : r.name.includes(w))));
  rows.forEach(r => { r.vsMonth = r.monthAgo ? Math.round((r.now / r.monthAgo - 1) * 100) : null; r.vsYear = r.yearAgo ? Math.round((r.now / r.yearAgo - 1) * 100) : null; });
  return { ok: true, n: rows.length, source: 'KAMIS 농산물유통정보 (최근일자 도·소매 가격)', rows, ...(rows.length ? {} : { sample: Object.keys(d).slice(0, 10), raw: text.slice(0, 300) }) };
}

// ---------- 월간 검색 수 (네이버 검색광고 API) ----------
const num = v => typeof v === 'number' ? v : 5;   // '< 10'으로 오면 5로 본다
async function volume(q, env) {
  if (!env.NAVER_AD_KEY || !env.NAVER_AD_SECRET || !env.NAVER_AD_CUSTOMER)
    return { ok: false, error: '검색광고 키(NAVER_AD_KEY · NAVER_AD_SECRET · NAVER_AD_CUSTOMER)가 아직 Worker에 없어요.' };
  const path = '/keywordstool', ts = String(Date.now());
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.NAVER_AD_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${ts}.GET.${path}`)))));
  const hint = q.replace(/\s+/g, '');
  const res = await fetch(`https://api.searchad.naver.com${path}?hintKeywords=${encodeURIComponent(hint)}&showDetail=1`, {
    headers: { 'X-Timestamp': ts, 'X-API-KEY': env.NAVER_AD_KEY, 'X-Customer': String(env.NAVER_AD_CUSTOMER), 'X-Signature': sig } });
  if (!res.ok) throw new Error(`검색광고 API 오류 ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const list = ((await res.json()).keywordList || []).map(x => ({ keyword: x.relKeyword, pc: num(x.monthlyPcQcCnt), mobile: num(x.monthlyMobileQcCnt),
    total: num(x.monthlyPcQcCnt) + num(x.monthlyMobileQcCnt), comp: x.compIdx }));
  const me = list.find(x => x.keyword === hint) || null;
  const related = list.filter(x => x !== me).sort((a, b) => b.total - a.total).slice(0, 20);
  return { ok: true, q: hint, month: me, related };
}

async function shops(q, src, page, env) {
  const base = SHOP_API[src];
  if (!base) throw new Error('src는 cafe 또는 bakery');
  const u = new URL(base);
  u.searchParams.set('serviceKey', env.DATA_GO_KEY);
  u.searchParams.set('pageNo', String(page));
  u.searchParams.set('numOfRows', '100');
  u.searchParams.set('returnType', 'json');
  u.searchParams.set('cond[BPLC_NM::LIKE]', q);
  const res = await fetch(u.toString());
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`인허가 API 응답 오류: ${text.slice(0, 200)}`); }
  const body = (data.response || {}).body || {};
  let items = (body.items || {}).item || [];
  if (!Array.isArray(items)) items = [items];
  // 필요한 칸만: [상호, 인허가일자, 폐업일자, 시도]
  const rows = items.map(i => [i.BPLC_NM || '', i.LCPMT_YMD || '', i.CLSBIZ_YMD || '', ((i.ROAD_NM_ADDR || i.LOTNO_ADDR || '').split(' ')[0]) || '']);
  return { total: Number(body.totalCount || 0), page, rows };
}


// ---------- 신메뉴 제안 ----------
// 카페 메뉴 레시피 원가표 [재료단가] 시트 (2026-11-02 온라인 식자재몰·마트 판매가 기준)
// 디저트 재료는 2026-11-04 식봄(foodspring.co.kr) 판매가(쿠폰 전)로 추가
const PRICE = {
  '원두': { unit: 'g', price: 28.5 }, '우유': { unit: 'ml', price: 3.27 }, '바닐라시럽': { unit: 'ml', price: 15.5 },
  '초코소스': { unit: 'g', price: 8.92 }, '연유': { unit: 'g', price: 8.6 }, '아이스컵세트': { unit: '개', price: 96.9 },
  '얼음': { unit: 'g', price: 1.0, note: '예시값' }, '빨대': { unit: '개', price: 15.0, note: '예시값' },
  '찹쌀가루': { unit: 'g', price: 6.63 }, '설탕': { unit: 'g', price: 1.43 }, '팥앙금': { unit: 'g', price: 4.61 },
  '전분': { unit: 'g', price: 4.93 }, '박력분': { unit: 'g', price: 1.30 }, '버터': { unit: 'g', price: 15.75 },
  '생크림': { unit: 'ml', price: 9.3 }, '계란': { unit: '개', price: 216.7 }, '말차가루': { unit: 'g', price: 18.01 },
  '물': { unit: 'ml', price: 0 },
  '생딸기': { unit: 'g', price: 18.0, note: '예시값' }, '포장용기': { unit: '개', price: 150, note: '예시값' },
};
// AI가 다른 이름으로 쓸 때 원가표 이름으로 맞춤
const ALIAS = { '백설탕': '설탕', '통팥앙금': '팥앙금', '앙금': '팥앙금', '감자전분': '전분', '옥수수전분': '전분',
  '무염버터': '버터', '휘핑크림': '생크림', '동물성생크림': '생크림', '달걀': '계란', '녹차가루': '말차가루',
  '녹차파우더': '말차가루', '말차파우더': '말차가루', '말차': '말차가루', '딸기': '생딸기', '포장용기': '포장용기',
  '디저트용기': '포장용기', '포장케이스': '포장용기', '정수': '물', '박력밀가루': '박력분' };
const findPrice = name => {
  const n = String(name || '').replace(/\s/g, '');
  return PRICE[n] ? n : (ALIAS[n] || null);
};
const GEMINI_MODEL = 'gemini-3.8-flash';  // 바뀌면 Worker 변수 GEMINI_MODEL로 덮어쓰기

// KAMIS 시세를 재료 단가(g·ml·개당)로 바꿈. 소매 가격 기준, 같은 이름이면 앞의 것(30구 계란은 30구 우선)
async function marketPrices(env) {
  try {
    const ck = new Request(`https://cache.local/kamis?all=0&d=${new Date().toISOString().slice(0, 10)}`);
    const hit = await caches.default.match(ck);
    const d = hit ? await hit.json() : await kamis(env, false);
    if (!hit && d.ok && d.n) await caches.default.put(ck, json(d, 200, '', 43200));
    if (!d.ok) return {};
    const out = {};
    d.rows.filter(r => /소매/.test(r.type)).forEach(r => {
      const m = String(r.unit).replace(/\s/g, '').match(/^([\d.]+)(kg|g|L|ml|개|구)$/i); if (!m) return;
      const n = Number(m[1]), u = m[2].toLowerCase();
      const [unit, per] = u === 'kg' ? ['g', n * 1000] : u === 'g' ? ['g', n] : u === 'l' ? ['ml', n * 1000] : u === 'ml' ? ['ml', n] : ['개', n];
      const [base, variety] = r.name.split('/'), names = [base, variety && variety.replace(/\(.*\)/, '')].filter(x => x && x.length >= 2 && !/국산|수입|노지|시설|일반란|흰우유|일반계|백색|XL|\d+구/.test(x));
      const p = { unit, price: +(r.now / per).toFixed(2), vsMonth: r.vsMonth, date: r.date, src: r.name };
      names.forEach(k => { if (!out[k] || (k === '계란' && per >= 30)) out[k] = p; });
    });
    return out;
  } catch { return {}; }
}
const findMarket = (name, MKT) => { const n = String(name || '').replace(/\s/g, ''); return MKT[n] ? n : Object.keys(MKT).find(k => n.includes(k)) || null; };
// 단가 우선순위: 내 원가표 → KAMIS 오늘 시세 → 원가표 예시값 → AI 추정
function costOf(recipe, MKT = {}) {
  let total = 0;
  const rows = recipe.map(r => {
    const key = findPrice(r.ing), own = key ? PRICE[key] : null;
    const mk = findMarket(r.ing, MKT), mkt = mk ? MKT[mk] : null;
    let unit = r.unit, up = Number(r.est_unit_price) || 0, source = 'AI 추정', ing = r.ing, vs = null;
    if (own && !own.note) { unit = own.unit; up = own.price; source = '원가표'; ing = key; }
    else if (mkt && mkt.unit === r.unit) { up = mkt.price; source = `KAMIS 시세 (${String(mkt.date).slice(5).replace('-', '/')})`; vs = mkt.vsMonth; }
    else if (own) { unit = own.unit; up = own.price; source = '원가표 (예시값)'; ing = key; }
    const cost = (Number(r.qty) || 0) * up;
    total += cost;
    return { ing, qty: Number(r.qty) || 0, unit, unit_price: +up.toFixed(2), cost: Math.round(cost), source, ...(vs !== null ? { vsMonth: vs } : {}) };
  });
  return { rows, total: Math.round(total) };
}

// 기본 모델이 붐비거나 없으면 다음 모델로 넘어감 (latest 별칭은 구글이 최신 모델로 자동 연결)
const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];

async function askGemini(prompt, env) {
  const models = [...new Set([env.GEMINI_MODEL || GEMINI_MODEL, ...FALLBACK_MODELS])];
  let res, text, last = '';
  for (const model of models) {
    // 붐빌 때(503·429)는 잠깐 쉬고 같은 모델로 한 번 더, 그래도 안 되면 다음 모델
    for (let i = 0; i < 2; i++) {
      res = await geminiFetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.8 } }),
      }, env);
      text = await res.text();
      if (res.ok || (res.status !== 503 && res.status !== 429)) break;
      await new Promise(r => setTimeout(r, 2000));
    }
    if (res.ok) break;
    last = `${model} ${res.status}`;
    if (/location is not supported/i.test(text)) throw new Error('Gemini 지역 제한: Worker가 Gemini를 쓸 수 없는 지역에서 실행됐어요.');
    if (![404, 429, 503, 500].includes(res.status)) break;   // 키 오류 등은 다른 모델로 넘겨도 소용없음
  }
  if (!res.ok) throw new Error(`Gemini 오류 ${res.status} (마지막 시도: ${last}): ${text.slice(0, 200)}`);
  const data = JSON.parse(text);
  const out = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return JSON.parse(out.replace(/^```json\s*|```$/g, ''));
}

// 메뉴 목적별로 AI에게 주는 구체적인 지시
const GOAL_GUIDE = {
  '기간 한정': '4~8주만 파는 한정 메뉴. 준비가 빠르고 남는 재료가 적게, 지금 사야 할 이유가 느껴지는 "한정" 느낌의 이름으로.',
  '정규 메뉴': '1년 내내 파는 정규 메뉴. 재료를 늘 구하기 쉽고, 직원 누구나 같은 맛을 낼 만큼 만들기 쉽고, 원가가 흔들리지 않게.',
  'SNS 인증용': '사진 찍고 싶은 비주얼 메뉴. 단면·색감·높이·토핑 중 사진 포인트를 하나 이상 확실히 넣고, 그 포인트가 잘 보이는 담음새로.',
  '시즌 메뉴': '계절 메뉴. 지금 계절이나 대목에 맞는 제철 재료를 쓰고, 계절이 느껴지는 이름으로, 매년 다시 낼 수 있게.',
};
async function menu(body, env) {
  const kw = cleanQuery(body.keyword);
  if (!kw) throw new Error('디저트 이름이 필요해요.');
  const kind = body.kind === '음료' ? '카페 음료 (ICE 16oz)' : '디저트·베이커리 (1인분)';
  const price = Math.max(2000, Math.min(30000, Number(body.price) || 5500));
  const target = Math.max(15, Math.min(50, Number(body.targetRate) || 30));
  const p = body.profile || {};
  const MKT = await marketPrices(env);
  const known = Object.entries(PRICE).map(([k, v]) => `${k}(${v.unit}당 ${v.price}원)`).concat(Object.entries(MKT).filter(([k]) => !PRICE[k]).map(([k, v]) => `${k}(${v.unit}당 ${v.price}원, 오늘 시세)`)).join(', ');
  const base = `당신은 한국 카페·디저트 프랜차이즈의 메뉴개발자입니다. 트렌드 키워드로 실제 매장에서 팔 신메뉴 1개를 만드세요.
- 트렌드 키워드: ${kw} (유행 단계: ${body.type || '알 수 없음'})
- 메뉴 분야: ${kind}
- 메뉴 목적: ${GOAL_GUIDE[body.goal] ? `${body.goal} → ${GOAL_GUIDE[body.goal]}` : '알아서 판단'}
- 사장님 요청사항: ${String(body.note || '없음').replace(/[<>`]/g, '').slice(0, 120)} (원가율 목표보다 낮은 숫자를 말하면 그 숫자를 지킬 것)
- 목표 판매가: ${price}원, 목표 원가율: ${target}% 이하
- 가게 주력 분야: ${p.cat || '정보 없음'} / 보유 장비: ${(p.eq || []).join(', ') || '정보 없음'} (없는 장비가 필요한 공정은 쓰지 말 것)
- 쓰지 않는 재료: ${(p.ban || []).join(', ') || '없음'} (절대 넣지 말 것)
- 단가를 아는 재료: ${known}. 이 재료는 이름을 똑같이 쓰고 단위도 맞출 것.
- 그 밖의 재료는 2026년 한국 업소용 식자재 기준 단위당 단가(원)를 est_unit_price로 추정. 단위는 g, ml, 개 중 하나.
- 음료면 아이스컵세트 1개와 빨대 1개를 넣고, 디저트면 포장용기 1개를 재료로 넣을 것. 생딸기처럼 과일은 개수 말고 g으로 쓸 것.
JSON 하나만 답하세요: {"name":"메뉴명","concept":"한 문장","target":"타깃 고객 한 문장","point":"판매 포인트 한 문장","pairing":"함께 팔 메뉴 한 문장","goal_fit":"메뉴 목적에 맞춘 점 한 문장","photo":"SNS 인증용일 때만: 사진이 잘 나오게 담고 찍는 법 한 문장, 아니면 빈 문자열","recipe":[{"ing":"재료","qty":숫자,"unit":"g|ml|개","est_unit_price":숫자}],"steps":["만드는 순서 3~5단계"]}`;
  const log = [];
  let prompt = base, result, cost;
  for (let i = 1; i <= 3; i++) {
    result = await askGemini(prompt, env);
    if (!Array.isArray(result.recipe) || !result.recipe.length) throw new Error('AI가 레시피를 만들지 못했어요. 다시 시도해 주세요.');
    cost = costOf(result.recipe, MKT);
    const rate = cost.total / price * 100;
    log.push({ try: i, rate: +rate.toFixed(1), cost: cost.total });
    if (rate <= target) break;
    if (i < 3) prompt = base + `\n\n직전 제안: ${JSON.stringify(result.recipe)}\n재료 원가 ${cost.total}원, 원가율 ${rate.toFixed(1)}%로 목표 ${target}%를 넘었습니다. 맛의 핵심은 지키면서 양을 줄이거나 더 싼 재료로 바꿔 다시 제안하세요.`;
  }
  const rate = cost.total / price * 100;
  const banned = (p.ban || []).filter(b => cost.rows.some(r => r.ing.includes(b)));
  return { banned, keyword: kw, kind, price, target, name: result.name, concept: result.concept, targetCustomer: result.target,
    point: result.point, pairing: result.pairing, goal: GOAL_GUIDE[body.goal] ? body.goal : '', goalFit: result.goal_fit || '', photo: result.photo || '', steps: result.steps || [], recipe: cost.rows, cost: cost.total,
    rate: +rate.toFixed(1), margin: price - cost.total, pass: rate <= target, tries: log, priceDate: '2026-11-04' };
}

// ---------- 다른 카페 판매가: 네이버 블로그 후기에서 '소금빵 3,500원' 같은 글을 모아 보통 가격을 낸다 ----------
const stripTag = s => String(s || '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;|&gt;|&#\d+;|&[a-z]+;/g, ' ');
// 후기 한 개에서 키워드 바로 뒤에 붙은 1개 가격만 뽑는다 (2개·세트·묶음 가격은 뺀다)
function pickPrice(text, kw) {
  const t = stripTag(text), k = kw.replace(/\s+/g, '').split('').map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s?');
  const re = new RegExp(k + '([^0-9\\n]{0,7}?)(\\d{1,2}(?:,\\d{3}|\\d{3})|\\d\\.\\d)\\s?(천\\s?)?원', 'g');
  let m;
  while ((m = re.exec(t))) {
    if (/\d|개|세트|박스|묶음|입|set|종|\+|와|과|랑|,|및|할인|쿠폰|배송/i.test(m[1])) continue;
    const v = m[3] ? Math.round(parseFloat(m[2]) * 1000) : Number(m[2].replace(',', ''));
    if (v >= 1000 && v <= 20000) return v;
  }
  return 0;
}
function priceStats(items, kw, sinceYmd) {
  const seen = new Set(), rows = [];
  for (const it of items) {
    if (!it || seen.has(it.link) || (it.postdate && it.postdate < sinceYmd)) continue;
    seen.add(it.link);
    const v = pickPrice(`${it.title} ${it.description}`, kw);
    if (v) rows.push([v, stripTag(it.title).slice(0, 40), it.link, it.postdate || '']);
  }
  if (!rows.length) return { n: 0 };
  const q = (xs, f) => { const i = (xs.length - 1) * f, a = Math.floor(i); return xs[a] + (xs[Math.ceil(i)] - xs[a]) * (i - a); };
  let vs = rows.map(r => r[0]).sort((a, b) => a - b);
  const lo = q(vs, .25), hi = q(vs, .75), w = Math.max(500, (hi - lo) * 1.5);
  const keep = rows.filter(r => r[0] >= lo - w && r[0] <= hi + w);   // 너무 싸거나 비싼 건 빼기
  vs = keep.map(r => r[0]).sort((a, b) => a - b);
  const r100 = x => Math.round(x / 100) * 100;
  const mid = keep.slice().sort((a, b) => Math.abs(a[0] - q(vs, .5)) - Math.abs(b[0] - q(vs, .5)));
  return { n: vs.length, median: r100(q(vs, .5)), p25: r100(q(vs, .25)), p75: r100(q(vs, .75)), low: vs[0], high: vs[vs.length - 1],
    samples: mid.slice(0, 5).sort((a, b) => b[3].localeCompare(a[3])) };
}
async function cafePrice(q, area, env) {
  if (!env.NAVER_SEARCH_ID || !env.NAVER_SEARCH_SECRET) return { ok: false, need: 'search', error: '네이버 검색 API(NAVER_SEARCH_ID·NAVER_SEARCH_SECRET)가 아직 설정되지 않았어요.' };
  const word = (area ? area + ' ' : '') + q;
  const calls = [['가격', 'sim', 1], ['가격', 'sim', 101], ['가격', 'date', 1], ['가격', 'date', 101], ['카페', 'date', 1]].map(([w, sort, start]) =>
    fetch(`https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(word + ' ' + w)}&display=100&start=${start}&sort=${sort}`,
      { headers: { 'X-Naver-Client-Id': env.NAVER_SEARCH_ID, 'X-Naver-Client-Secret': env.NAVER_SEARCH_SECRET } })
      .then(r => r.ok ? r.json() : r.text().then(t => { throw new Error(`네이버 검색 ${r.status}: ${t.slice(0, 120)}`); })));
  const res = await Promise.allSettled(calls), items = res.flatMap(r => r.status === 'fulfilled' ? r.value.items || [] : []);
  if (!items.length) { const e = res.find(r => r.status === 'rejected'); return { ok: false, error: e ? String(e.reason.message || e.reason) : '검색 결과가 없어요.' }; }
  const d = new Date(Date.now() - 365 * 864e5), since = d.toISOString().slice(0, 10).replace(/-/g, '');
  return { ok: true, q, area: area || '', posts: items.length, since, ...priceStats(items, q, since) };
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });
    const url = new URL(request.url);
    if (url.pathname === '/where') {   // Gemini를 부르는 곳이 어느 데이터센터인지 확인용
      const t = await (await geminiFetch('https://www.cloudflare.com/cdn-cgi/trace', {}, env)).text();
      return json({ worker: request.cf && request.cf.colo, gemini: (t.match(/colo=(\w+)/) || [])[1], loc: (t.match(/loc=(\w+)/) || [])[1] }, 200, origin);
    }
    if (url.pathname === '/menu') {
      if (request.method !== 'POST') return json({ error: 'POST로 요청해 주세요.' }, 405, origin);
      if (!env.GEMINI_KEY) return json({ error: 'GEMINI_KEY가 설정되지 않았어요.' }, 500, origin);
      try { return json(await menu(await request.json(), env), 200, origin); }
      catch (e) { return json({ error: String(e.message || e) }, 502, origin); }
    }
    if (url.pathname === '/kamis') {   // 재료 시세: 하루 동안 캐시
      const all = url.searchParams.get('all') === '1';
      const ck = new Request(`https://cache.local/kamis?all=${all ? 1 : 0}&d=${new Date().toISOString().slice(0, 10)}`);
      const hit0 = await caches.default.match(ck);
      if (hit0) { const r = new Response(hit0.body, hit0); Object.entries(cors(origin)).forEach(([k, v]) => r.headers.set(k, v)); return r; }
      try {
        const data = await kamis(env, all);
        const resp = json(data, 200, origin, data.ok ? 43200 : 0);
        if (data.ok && data.n) ctx.waitUntil(caches.default.put(ck, resp.clone()));
        return resp;
      } catch (e) { return json({ error: String(e.message || e) }, 502, origin); }
    }
    const q = cleanQuery(url.searchParams.get('q'));
    if (url.pathname !== '/' && !q) return json({ error: '검색어를 1~20자로 입력해 주세요.' }, 400, origin);

    // 같은 요청은 하루 동안 캐시해서 API 사용량을 아낀다
    const cache = caches.default;
    const key = new Request(url.toString(), { method: 'GET' });
    const hit = await cache.match(key);
    if (hit) { const r = new Response(hit.body, hit); Object.entries(cors(origin)).forEach(([k, v]) => r.headers.set(k, v)); return r; }

    try {
      let data;
      if (url.pathname === '/trend') data = await trend(q, env);
      else if (url.pathname === '/volume') { data = await volume(q, env); if (!data.ok) return json(data, 200, origin); }
      else if (url.pathname === '/price') { data = await cafePrice(q, cleanQuery(url.searchParams.get('area')) || '', env); if (!data.ok) return json(data, 200, origin); }
      else if (url.pathname === '/shops') data = await shops(q, url.searchParams.get('src'), Math.max(1, Math.min(50, Number(url.searchParams.get('page')) || 1)), env);
      else return json({ ok: true, usage: ['/trend?q=', '/shops?q=&src=cafe|bakery&page=', '/volume?q=', '/price?q=&area=', '/kamis'] }, 200, origin);
      const resp = json(data, 200, origin, 86400);
      ctx.waitUntil(cache.put(key, resp.clone()));
      return resp;
    } catch (e) {
      return json({ error: String(e.message || e) }, 502, origin);
    }
  },
};
