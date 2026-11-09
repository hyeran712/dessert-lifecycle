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
 *   (다른 카페 가격) NAVER API Hub의 '검색' 상품을 이용 신청하면 NAVER_ID·SECRET 그대로 씀. 예전 developers.naver.com 키는 NAVER_SEARCH_ID·SECRET
 *
 * GET /trend?q=과일모찌                  → 2016년부터 주간 검색량 (최고점 = 100)
 * GET /shops?q=과일모찌&src=cafe&page=1  → 상호에 단어가 들어간 휴게음식점(cafe)·제과점(bakery) 100곳씩
 * GET /volume?q=소금빵                  → 네이버 검색광고: 최근 한 달 검색 수(PC·모바일) + 연관 키워드
 * GET /brands?q=두바이쫀득쿠키         → 그 디저트로 많이 찾는 가게 TOP 5 (연관 키워드 + 지역 검색 확인 + 뜬 시기 + 영업 중 매장)
 * GET /price?q=소금빵&area=강남       → 네이버 블로그 후기에서 뽑은 다른 카페 판매가 (최근 1년, 보통 가격·범위)
 * POST /menu  {keyword, type, kind, price, targetRate, profile}  → AI 신메뉴 제안 + 원가 검증(목표 원가율을 넘으면 최대 3번 다시)
 */
import { DurableObject } from 'cloudflare:workers';

// Gemini는 홍콩 등에서 막혀 있다. Worker는 접속한 사람과 가까운 곳(가끔 홍콩)에서 돌기 때문에,
// 미국 서부에 고정한 Durable Object를 거쳐서 Gemini를 부른다.
export class GeminiProxy extends DurableObject {
  // x-timeout(ms) 안에 답이 없으면 끊고 504로 돌려준다 (예전엔 제한이 없어 100초 넘으면 524로 실패, 2026-11-09)
  async fetch(request) {
    const ms = Number(request.headers.get('x-timeout')) || 40000;
    try { return await fetch(request, { signal: AbortSignal.timeout(ms) }); }
    catch (e) { return new Response(JSON.stringify({ error: { message: 'timeout ' + ms + 'ms' } }), { status: 504 }); }
  }
}
async function geminiFetch(url, init, env, ms = 40000) {
  if (!env.GEMINI_PROXY) {
    try { return await fetch(url, { ...init, signal: AbortSignal.timeout(ms) }); }
    catch { return new Response('{"error":{"message":"timeout"}}', { status: 504 }); }
  }
  init = { ...init, headers: { ...(init.headers || {}), 'x-timeout': String(ms) } };
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
  return { ok: true, q: hint, month: me, related, _all: list };
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
// 사장님이 화면에서 넣은 '내 원가표' {재료: {unit, price}} → 깨끗하게 (최대 150개)
function cleanMy(x) {
  const out = {};
  if (!x || typeof x !== 'object') return out;
  for (const [k, v] of Object.entries(x).slice(0, 150)) {
    const n = String(k).replace(/[<>`"\\]/g, '').replace(/\s/g, '').slice(0, 20), price = Number(v && v.price);
    if (n && v && ['g', 'ml', '개'].includes(v.unit) && price >= 0 && price < 100000) out[n] = { unit: v.unit, price };
  }
  return out;
}
// 내 원가표에서 재료 찾기: 이름 그대로 → 원가표 별칭 → 서로 포함 (예: '무염버터' ↔ '버터')
const findMy = (name, MY) => {
  const n = String(name || '').replace(/\s/g, ''); if (!n) return null;
  if (MY[n]) return n;
  const a = ALIAS[n]; if (a && MY[a]) return a;
  return Object.keys(MY).find(k => k.length >= 2 && (n.includes(k) || k.includes(n))) || null;
};
function costOf(recipe, MKT = {}, MY = {}) {
  let total = 0;
  const rows = recipe.map(r => {
    const myk = findMy(r.ing, MY), my = myk ? MY[myk] : null;
    if (my && (my.unit === r.unit || !r.unit)) {   // 단위가 같을 때만 (g ↔ 개 같은 건 섞지 않음)
      const cost = (Number(r.qty) || 0) * my.price; total += cost;
      return { ing: r.ing, qty: Number(r.qty) || 0, unit: my.unit, unit_price: +my.price.toFixed(2), cost: Math.round(cost), source: '내 원가표' };
    }
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
const FAST_MODEL = 'gemini-flash-lite-latest';

// deadline: 이 시각(ms)까지는 끝내야 한다. 한 번 부를 때 최대 40초, 늦거나 붐비면 다음 모델로
// thinkingLevel 'low': 3.x 모델이 오래 '생각'하느라 느린 것을 줄인다. 모델이 이 설정을 모르면(400) 빼고 다시
async function askGemini(prompt, env, deadline = Date.now() + 90000, only) {
  // 2026-11-09 측정: flash-lite 2~4초, flash-latest 37초~실패, 3.8-flash 40초 넘게 → 가벼운 모델을 먼저, 실패할 때만 큰 모델
  const models = only ? [only] : [...new Set([FAST_MODEL, env.GEMINI_MODEL || GEMINI_MODEL, ...FALLBACK_MODELS])];
  let res, text = '', last = '', think = true, used = '';
  const tried = [];
  for (const model of models) {
    used = model;
    for (let i = 0; i < 2; i++) {
      const left = deadline - Date.now();
      if (left < 8000) { last = last || `${model} 시간 부족`; break; }
      const gen = { responseMimeType: 'application/json', temperature: 0.8, ...(think ? { thinkingConfig: { thinkingLevel: 'low' } } : {}) };
      const t0 = Date.now();
      res = await geminiFetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: gen }),
      }, env, Math.min(40000, left - 3000));
      text = await res.text(); tried.push(`${model} ${res.status} ${((Date.now() - t0) / 1000).toFixed(0)}초`);
      if (res.status === 400 && think && /thinking/i.test(text)) { think = false; i--; continue; }   // 이 모델은 thinkingLevel 모름
      if (res.ok || (res.status !== 503 && res.status !== 429)) break;
      await new Promise(r => setTimeout(r, 1500));
    }
    if (res && res.ok) break;
    if (res) last = `${model} ${res.status}`;
    if (/location is not supported/i.test(text)) throw new Error('Gemini 지역 제한: Worker가 Gemini를 쓸 수 없는 지역에서 실행됐어요.');
    if (res && ![404, 429, 503, 500, 504, 524].includes(res.status)) break;   // 키 오류 등은 다른 모델로 넘겨도 소용없음
    if (deadline - Date.now() < 8000) break;
  }
  if (!res || !res.ok) throw new Error(res && (res.status === 504 || res.status === 524) ? 'AI 답이 너무 늦어요. 잠시 뒤 다시 눌러 주세요.' : `Gemini 오류 ${res ? res.status : ''} (마지막 시도: ${last}): ${text.slice(0, 200)}`);
  const data = JSON.parse(text);
  const out = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const obj = JSON.parse(out.replace(/^```json\s*|```$/g, ''));
  Object.defineProperty(obj, '_ai', { value: { model: used, tried }, enumerable: false });
  return obj;
}

// 메뉴 목적별로 AI에게 주는 구체적인 지시
const GOAL_GUIDE = {
  '기간 한정': '4~8주만 파는 한정 메뉴. 준비가 빠르고 남는 재료가 적게. 한정 느낌은 이름 문장이 아니라 판매 포인트에 담을 것.',
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
  const MKT = await marketPrices(env), MY = cleanMy(body.myPrice);
  const known = [
    ...Object.entries(MY).map(([k, v]) => `${k}(${v.unit}당 ${v.price}원, 우리 가게)`),
    ...Object.entries(PRICE).filter(([k]) => !MY[k]).map(([k, v]) => `${k}(${v.unit}당 ${v.price}원)`),
    ...Object.entries(MKT).filter(([k]) => !PRICE[k] && !MY[k]).map(([k, v]) => `${k}(${v.unit}당 ${v.price}원, 오늘 시세)`)].join(', ');
  const base = `당신은 한국 카페·디저트 프랜차이즈의 메뉴개발자입니다. 트렌드 키워드로 실제 매장에서 팔 신메뉴 1개를 만드세요.
- 오늘: ${new Date(Date.now() + 9 * 3600e3).getUTCMonth() + 1}월 (계절이 들어간 이름·재료는 지금 계절에 맞게. 다른 계절 낱말 금지)
- 트렌드 키워드: ${kw} (유행 단계: ${body.type || '알 수 없음'})
- 메뉴명 규칙: 실제 메뉴판에 쓰는 짧은 이름(공백 빼고 4~14자). 문장·감탄·말장난("지금 아니면" 등)·다른 음식 이름·없는 낱말 금지. 예: "생딸기 찹쌀모찌", "겨울 유자 크림모찌".
- 메뉴 분야: ${kind}
- 메뉴 목적: ${GOAL_GUIDE[body.goal] ? `${body.goal} → ${GOAL_GUIDE[body.goal]}` : '알아서 판단'}
- 사장님 요청사항: ${String(body.note || '없음').replace(/[<>`]/g, '').slice(0, 120)} (원가율 목표보다 낮은 숫자를 말하면 그 숫자를 지킬 것)
- 목표 판매가: ${price}원, 목표 원가율: ${target}% 이하
- 가게 주력 분야: ${p.cat || '정보 없음'} / 보유 장비: ${(p.eq || []).join(', ') || '정보 없음'} (없는 장비가 필요한 공정은 쓰지 말 것)
- 쓰지 않는 재료: ${(p.ban || []).join(', ') || '없음'} (절대 넣지 말 것)
- 단가를 아는 재료: ${known}. 이 재료는 이름을 똑같이 쓰고 단위도 맞출 것.
- 그 밖의 재료는 2026년 한국 업소용 식자재 기준 단위당 단가(원)를 est_unit_price로 추정. 단위는 g, ml, 개 중 하나.
- 레시피는 실제 매장 배합처럼 빠짐없이: 이름에 들어간 재료는 반드시 넣고(소금빵이면 소금), 빵·발효 반죽이면 강력분·이스트·소금, 과자·케이크면 박력분처럼 용도에 맞는 재료를 쓸 것. 단가를 아는 재료 목록에 없어도(예: 강력분, 이스트) 맞는 재료를 쓰고 단가는 추정할 것 — 목록에 있다는 이유로 다른 재료로 바꾸지 말 것. 만드는 순서도 발효·굽는 온도와 시간까지 구체적으로.
- 음료면 아이스컵세트 1개와 빨대 1개를 넣고, 디저트면 포장용기 1개를 재료로 넣을 것. 생딸기처럼 과일은 개수 말고 g으로 쓸 것.
JSON 하나만 답하세요: {"name":"메뉴명","concept":"한 문장","target":"타깃 고객 한 문장","point":"판매 포인트 한 문장","pairing":"함께 팔 메뉴 한 문장","goal_fit":"메뉴 목적에 맞춘 점 한 문장","photo":"SNS 인증용일 때만: 사진이 잘 나오게 담고 찍는 법 한 문장, 아니면 빈 문자열","recipe":[{"ing":"재료","qty":숫자,"unit":"g|ml|개","est_unit_price":숫자}],"steps":["만드는 순서 3~5단계"]}`;
  const log = [];
  let prompt = base, result, cost;
  const deadline = Date.now() + 90000;   // 전체 90초 안에 (Cloudflare는 100초가 넘으면 524로 끊는다)
  // body.model: 속도 비교용 (정해 둔 모델만)
  const pick = [GEMINI_MODEL, env.GEMINI_MODEL, ...FALLBACK_MODELS].includes(body.model) ? body.model : undefined;
  // 빠른 모델이 가끔 빈 레시피를 주거나 실패한다(2026-11-09, 4번 중 2번) → 바로 포기하지 않고 빠른 모델로 두 번까지 다시, 그래도 안 되면 큰 모델까지
  const askOnce = async () => {
    let err;
    for (let a = 0; a < 3; a++) {
      if (deadline - Date.now() < 10000) break;
      try {
        const r = await askGemini(prompt, env, a < 2 ? Math.min(deadline, Date.now() + 25000) : deadline, pick || (a < 2 ? FAST_MODEL : undefined));
        if (Array.isArray(r.recipe) && r.recipe.length) return r;
        err = new Error('AI가 레시피를 만들지 못했어요. 다시 시도해 주세요.'); err.got = Array.isArray(r) ? 'array:' + JSON.stringify(r).slice(0, 300) : 'keys:' + Object.keys(r || {}).join(',') + ' ' + JSON.stringify(r).slice(0, 300);
      } catch (e) { err = e; }
    }
    throw err || new Error('AI 답이 너무 늦어요. 잠시 뒤 다시 눌러 주세요.');
  };
  for (let i = 1; i <= 3; i++) {
    if (i > 1 && deadline - Date.now() < 25000) break;   // 원가율 다시 맞출 시간이 없으면 지금 결과로
    let r;
    try { r = await askOnce(); } catch (e) { if (result) break; throw e; }   // 원가율 재조정 중 실패하면 앞의 결과를 쓴다
    result = r;
    cost = costOf(result.recipe, MKT, MY);
    const rate = cost.total / price * 100;
    log.push({ try: i, rate: +rate.toFixed(1), cost: cost.total, ai: result._ai ? result._ai.tried : [] });
    if (rate <= target) break;
    if (i < 3) prompt = base + `\n\n직전 제안: ${JSON.stringify(result.recipe)}\n재료 원가 ${cost.total}원, 원가율 ${rate.toFixed(1)}%로 목표 ${target}%를 넘었습니다. 맛의 핵심은 지키면서 양을 줄이거나 더 싼 재료로 바꿔 다시 제안하세요.`;
  }
  // 이름 안전장치: AI가 문장형·너무 긴 이름을 주면(예: '지금아니면이거치킨 아니 생딸기찹쌀모찌', 2026-11-09) 다시 짓게 할 시간은 없으니 마지막 구절만 쓴다
  let nm = String(result.name || kw).replace(/["'“”‘’!?~]/g, '').trim();
  if (nm.replace(/\s/g, '').length > 16 || /아니/.test(nm)) {
    const w = nm.split(/\s+/).filter(x => !/아니|지금|이거|치킨/.test(x));
    nm = w.slice(-2).join(' '); if (nm.replace(/\s/g, '').length > 16) nm = w[w.length - 1] || '';
  }
  result.name = nm || kw;
  const rate = cost.total / price * 100;
  const banned = (p.ban || []).filter(b => cost.rows.some(r => r.ing.includes(b)));
  return { banned, keyword: kw, kind, price, target, name: result.name, concept: result.concept, targetCustomer: result.target,
    point: result.point, pairing: result.pairing, goal: GOAL_GUIDE[body.goal] ? body.goal : '', goalFit: result.goal_fit || '', photo: result.photo || '', steps: result.steps || [], recipe: cost.rows, cost: cost.total,
    rate: +rate.toFixed(1), margin: price - cost.total, pass: rate <= target, tries: log, ai: result._ai || null, priceDate: '2026-11-04' };
}

// ---------- 브랜드 찾기: '두바이쫀득쿠키'로 많이 찾는 가게 ----------
// 검색광고 연관 키워드는 새로 뜬 디저트(두쫀쿠 등)엔 하나도 안 나오고, 나와도 가게 이름이 거의 없다 (2026-11-09 확인).
// 그래서 1) 네이버 지역 검색으로 그 디저트를 파는 카페·디저트 가게를 먼저 모으고 (+ 연관 키워드 '○○ + 디저트 이름' 꼴)
// 2) 가게 이름의 월간 검색 수(검색광고)로 순위 3) 검색어 트렌드로 언제 떴는지 4) 인허가로 영업 중 매장 수
const GENERIC = /^(맛집|만들기|레시피|가격|칼로리|파는곳|파는 곳|판매|택배|배달|배송|후기|추천|근처|주문|예약|원조|유명한|유명|인기|맛|만드는법|만드는 법|재료|키트|밀키트|쿠팡|편의점|cu|gs25|gs|세븐일레븐|이마트|홈플러스|코스트코|다이소|스타벅스|대용량|선물|세트|박스|선물세트|도매|창업|전문점|카페|디저트|빵|빵집|베이커리|신상|신메뉴|오픈런|웨이팅|줄서는|품절|재고|가격비교|최저가|할인|이벤트|당일|오늘|내돈내산|먹방|칼로리표|유통기한|보관|보관법|냉동|해동|모양|종류|뜻|영어|일본|두바이|한국|서울|부산|대구|인천|광주|대전|울산|세종|제주|경기|강원|충북|충남|전북|전남|경북|경남|홍대|성수|연남|망원|합정|이태원|한남|익선동|을지로|강남역|신사|가로수길|압구정|청담|잠실|여의도|명동|종로|건대|해운대|서면|전포|광안리|동성로|송리단길|판교|분당|일산|수원|동탄|송도)$/i;
const REGIONISH = /(역|동|구|시|군|읍|면|점|길|로)$/;
// 이름 검색 수가 디저트와 상관없이 큰 대형 체인·편의점은 순위에서 뺀다
const BIG_CHAIN = /^(스타벅스|투썸|투썸플레이스|이디야|이디야커피|메가커피|메가mgc커피|메가엠지씨커피|컴포즈|컴포즈커피|빽다방|파리바게뜨|파리바게트|뚜레쥬르|배스킨라빈스|던킨|던킨도너츠|폴바셋|할리스|할리스커피|커피빈|파스쿠찌|엔제리너스|탐앤탐스|요거프레소|더벤티|매머드커피|cu|gs25|세븐일레븐|이마트24|이마트|홈플러스|코스트코|노브랜드|다이소|올리브영|쿠팡)$/i;
const BRANDS_VER = 6;   // 브랜드 찾기 방식을 바꾸면 올린다 (하루 캐시에 남은 예전 결과를 안 쓰게)
const BR_AREAS = ['', '서울', '성수', '홍대', '강남', '부산', '대구', '대전', '광주', '인천', '수원', '제주'];
const SHOP_CAT = /카페|디저트|제과|베이커리|떡|아이스크림|도넛|와플|빵|초콜릿|케이크|쿠키|마카롱|베이글/;
// 지역 검색 가게 이름 → 브랜드 이름 ('○○ 성수점' → '○○')
const brandOf = t => t.replace(/\(.*?\)|\[.*?\]/g, ' ').trim().split(/\s+/).filter((w, i) => i === 0 || !/(점|호점|지점|본점|매장)$/.test(w)).join(' ').trim();
const adKey = s => s.replace(/[^가-힣a-zA-Z0-9]/g, '');
// 검색광고 키워드 도구로 여러 이름의 월간 검색 수 (한 번에 5개까지) → {공백 없는 대문자 키워드: 검색 수}
async function adVolumes(words, env) {
  const out = {};
  for (let i = 0; i < words.length; i += 5) {
    const part = words.slice(i, i + 5), path = '/keywordstool', ts = String(Date.now());
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.NAVER_AD_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${ts}.GET.${path}`)))));
    try {
      const r = await fetch(`https://api.searchad.naver.com${path}?hintKeywords=${encodeURIComponent(part.join(','))}&showDetail=1`, {
        headers: { 'X-Timestamp': ts, 'X-API-KEY': env.NAVER_AD_KEY, 'X-Customer': String(env.NAVER_AD_CUSTOMER), 'X-Signature': sig } });
      if (!r.ok) continue;
      for (const x of (await r.json()).keywordList || []) out[String(x.relKeyword).toUpperCase()] = num(x.monthlyPcQcCnt) + num(x.monthlyMobileQcCnt);
    } catch { }
  }
  return out;
}
async function brands(q, env, debug) {
  const vol = await volume(q, env);
  if (!vol.ok) return vol;
  const hint = vol.q, all = vol._all || [];
  const H = { 'X-NCP-APIGW-API-KEY-ID': env.NAVER_ID, 'X-NCP-APIGW-API-KEY': env.NAVER_SECRET };
  const dbg = debug ? { related: all.length, withHint: all.filter(x => x.keyword.replace(/\s+/g, '').includes(hint)).slice(0, 40).map(x => [x.keyword, x.total]), local: {}, cand: [] } : null;
  const cand = new Map();   // 공백 없는 이름 → 후보
  const add = (name, info) => {
    const key = adKey(name); if (key.length < 3 || key.length > 20 || key === hint || GENERIC.test(key) || BIG_CHAIN.test(key)) return;
    const c = cand.get(key) || { name, key, hits: 0 }; c.hits++;
    if (info && !c.shop) Object.assign(c, info);
    cand.set(key, c);
  };
  // 1) 지역 검색(리뷰 많은 순): 전국 + 큰 동네별로 그 디저트를 파는 카페·디저트 가게. 키는 블로그 검색(cafePrice)과 같은 것
  const S = naverSearch(env);
  let localOk = true;
  await Promise.all(BR_AREAS.map(async area => {
    const query = (area ? area + ' ' : '') + q.trim();
    try {
      const r = await fetch(`${S.base}/local${S.ext}?query=${encodeURIComponent(query)}&display=5&sort=comment`, { headers: S.headers });
      if (!r.ok) { localOk = false; if (dbg) dbg.local[query] = 'HTTP ' + r.status + ' ' + (await r.text()).slice(0, 150); return; }
      const items = (await r.json()).items || [];
      if (dbg) dbg.local[query] = items.map(i => [stripTag(i.title), i.category]);
      for (const i of items) {
        if (!SHOP_CAT.test(i.category || '')) continue;
        const title = stripTag(i.title).trim();
        const info = { shop: title, cat: (i.category || '').split('>').pop(), addr: (i.roadAddress || i.address || '').split(' ').slice(0, 2).join(' ') };
        // '노티드 청담'처럼 끝에 동네 이름이 붙은 가게는 그걸 뗀 이름도 같이 잰다 (가게마다 검색 수가 가장 큰 이름을 쓴다)
        // 앞 단어만 떼면 '클래식'처럼 흔한 낱말 검색 수가 잡혀서(2026-11-09) 끝의 동네 이름·앞의 '카페'만 뗀다
        const b = brandOf(title); let w = b.split(' ');
        while (w.length > 1 && (GENERIC.test(w[w.length - 1]) || REGIONISH.test(w[w.length - 1]) || /^[가-힣]{2}$/.test(w[w.length - 1]))) w = w.slice(0, -1);
        if (w.length > 1 && /^(카페|cafe)$/i.test(w[0])) w = w.slice(1);
        [...new Set([b, w.join(' ')])].forEach(n => add(n, info));
      }
    } catch { localOk = false; }
  }));
  // 연관 키워드 중 '○○ + 디저트 이름' 꼴도 후보로 (나올 때만)
  for (const x of all) {
    const kw = x.keyword.replace(/\s+/g, ''); if (kw === hint || !kw.includes(hint)) continue;
    const rest = kw.replace(hint, '').trim();
    if (rest.length < 2 || rest.length > 12 || REGIONISH.test(rest) || /\d/.test(rest)) continue;
    add(rest, null);
  }
  // 2) 가게 이름의 월간 검색 수로 순위
  let list = [...cand.values()].sort((a, b) => b.hits - a.hits).slice(0, 40);
  const v = await adVolumes(list.map(c => c.key), env);
  list.forEach(c => { c.total = v[c.key.toUpperCase()] || 0; c.keyword = c.name; });
  if (dbg) dbg.cand = list.map(c => [c.name, c.total, c.shop || '(연관 키워드)']);
  const seen = new Set();
  // 이름 검색 수가 말이 안 되게 크면(디저트 검색 수의 20배와 30만 회를 둘 다 넘음) 같은 이름의 다른 것(사람·작품 등) 검색이 섞인 것 → 뺀다
  // 예: 두바이 초콜릿 '한정선' 월 110만 회 (2026-11-09). 성심당(28만 회)은 남는다
  const cap = Math.max(20 * ((vol.month && vol.month.total) || 0), 300000);
  list = list.filter(c => c.total >= 10 && c.total <= cap && (c.shop || !localOk)).sort((a, b) => b.total - a.total)
    .filter(c => { const id = c.shop || c.key; if (seen.has(id)) return false; seen.add(id); return true; }).slice(0, 5);
  // 검색어 트렌드: 디저트 + 가게 4곳을 한 번에 (최근 2년, 주간). 각자 최고점의 25%를 처음 넘은 주 = 뜬 때
  const start = new Date(Date.now() - 730 * 864e5).toISOString().slice(0, 10), end = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  let rise = {};
  try {
    const groups = [{ groupName: '_', keywords: [hint] }, ...list.slice(0, 4).map(c => ({ groupName: c.name, keywords: [...new Set([c.keyword, c.keyword.replace(/\s+/g, ''), c.name + ' ' + hint])] }))];
    const r = await fetch(TREND_API, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: start, endDate: end, timeUnit: 'week', keywordGroups: groups }) });
    if (r.ok) for (const g of (await r.json()).results || []) {
      const v = g.data.map(d => d.ratio), pk = Math.max(...v, 0); if (!pk) continue;
      const i = v.findIndex(x => x >= pk * .25), last = v.slice(-4).reduce((a, b) => a + b, 0) / Math.max(1, v.slice(-4).length);
      // 첫 주부터 25%를 넘었으면 조회 기간(2년) 전부터 이미 유명했던 것 → '뜬 때'를 모른다 (예전엔 '57주 먼저 뜸'으로 잘못 나옴)
      rise[g.title] = { week: i > 0 && g.data[i] ? g.data[i].period : '', now: Math.round(last / pk * 100) };
    }
  } catch { }
  const base = rise['_'];
  // 인허가: 상호에 가게 이름이 들어간 카페·제과점 중 영업 중
  await Promise.all(list.map(async c => {
    try {
      const [a, b] = await Promise.all([shops(c.name, 'cafe', 1, env), shops(c.name, 'bakery', 1, env)]);
      const rows = [...a.rows, ...b.rows]; c.open = rows.filter(r => !r[2]).length; c.more = a.total > 100 || b.total > 100;
    } catch { }
    const t = rise[c.name]; if (t) c.now = t.now;
    if (t && t.week) { c.rise = t.week;
      if (base && base.week) c.lead = Math.round((new Date(base.week) - new Date(t.week)) / 6048e5); }   // +면 디저트 유행보다 먼저
  }));
  return { ok: true, q: hint, month: vol.month, verified: localOk, base: base || null, brands: list, ...(dbg ? { debug: dbg } : {}) };
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
// 네이버 검색 API(블로그·지역): 예전 developers.naver.com 키(NAVER_SEARCH_ID·SECRET)가 있으면 그걸, 없으면 API Hub 키
function naverSearch(env) {
  const old = env.NAVER_SEARCH_ID && env.NAVER_SEARCH_SECRET;
  return old ? { base: 'https://openapi.naver.com/v1/search', ext: '.json', headers: { 'X-Naver-Client-Id': env.NAVER_SEARCH_ID, 'X-Naver-Client-Secret': env.NAVER_SEARCH_SECRET } }
    : { base: 'https://naverapihub.apigw.ntruss.com/search/v1', ext: '', headers: { 'X-NCP-APIGW-API-KEY-ID': env.NAVER_ID, 'X-NCP-APIGW-API-KEY': env.NAVER_SECRET } };
}
async function cafePrice(q, area, env) {
  // 네이버 블로그 검색: NAVER API Hub(검색어 트렌드와 같은 키, 콘솔에서 '검색' 상품 이용 신청 필요)를 먼저 쓰고,
  // 예전 developers.naver.com 키(NAVER_SEARCH_ID·SECRET)가 있으면 그걸 쓴다
  const old = env.NAVER_SEARCH_ID && env.NAVER_SEARCH_SECRET;
  if (!old && !(env.NAVER_ID && env.NAVER_SECRET)) return { ok: false, need: 'search', error: '네이버 검색 API 키가 없어요.' };
  const base = old ? 'https://openapi.naver.com/v1/search/blog.json' : 'https://naverapihub.apigw.ntruss.com/search/v1/blog';
  const headers = old ? { 'X-Naver-Client-Id': env.NAVER_SEARCH_ID, 'X-Naver-Client-Secret': env.NAVER_SEARCH_SECRET }
    : { 'X-NCP-APIGW-API-KEY-ID': env.NAVER_ID, 'X-NCP-APIGW-API-KEY': env.NAVER_SECRET };
  const word = (area ? area + ' ' : '') + q;
  const calls = [['가격', 'sim', 1], ['가격', 'sim', 101], ['가격', 'date', 1], ['가격', 'date', 101], ['카페', 'date', 1]].map(([w, sort, start]) =>
    fetch(`${base}?query=${encodeURIComponent(word + ' ' + w)}&display=100&start=${start}&sort=${sort}`, { headers })
      .then(r => r.ok ? r.json() : r.text().then(t => { throw new Error(`네이버 검색 ${r.status}: ${t.slice(0, 120)}`); })));
  const res = await Promise.allSettled(calls), items = res.flatMap(r => r.status === 'fulfilled' ? r.value.items || [] : []);
  if (!items.length) { const e = res.find(r => r.status === 'rejected'), msg = e ? String(e.reason.message || e.reason) : '검색 결과가 없어요.';
    return { ok: false, need: / (401|403|404):/.test(msg) ? 'search' : '', error: msg }; }   // 401·403 = '검색' 이용 신청 전
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
      catch (e) { return json({ error: String(e.message || e), ...(e.got ? { got: e.got } : {}) }, 502, origin); }
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
    const key = new Request(url.toString() + (url.pathname === '/brands' ? '&_v=' + BRANDS_VER : ''), { method: 'GET' });
    const hit = await cache.match(key);
    if (hit) { const r = new Response(hit.body, hit); Object.entries(cors(origin)).forEach(([k, v]) => r.headers.set(k, v)); return r; }

    try {
      let data;
      if (url.pathname === '/trend') data = await trend(q, env);
      else if (url.pathname === '/volume') { data = await volume(q, env); if (!data.ok) return json(data, 200, origin); delete data._all; }
      else if (url.pathname === '/brands') { data = await brands(q, env, url.searchParams.get('debug') === '1'); if (!data.ok) return json(data, 200, origin); }
      else if (url.pathname === '/price') { data = await cafePrice(q, cleanQuery(url.searchParams.get('area')) || '', env); if (!data.ok) return json(data, 200, origin); }
      else if (url.pathname === '/shops') data = await shops(q, url.searchParams.get('src'), Math.max(1, Math.min(50, Number(url.searchParams.get('page')) || 1)), env);
      else return json({ ok: true, usage: ['/trend?q=', '/shops?q=&src=cafe|bakery&page=', '/volume?q=', '/price?q=&area=', '/brands?q=', '/kamis'] }, 200, origin);
      const noCache = url.pathname === '/brands' && !data.verified;   // 지역 검색이 막혔던 결과는 저장하지 않는다
      const resp = json(data, 200, origin, noCache ? 0 : 86400);
      if (!noCache) ctx.waitUntil(cache.put(key, resp.clone()));
      return resp;
    } catch (e) {
      return json({ error: String(e.message || e) }, 502, origin);
    }
  },
};
