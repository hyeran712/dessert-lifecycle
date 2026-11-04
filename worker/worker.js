/**
 * 디저트 타이밍 실시간 분석용 Cloudflare Worker
 * 홈페이지가 이 Worker를 거쳐 네이버 검색량과 인허가 데이터를 받아온다. (인증키는 Worker 비밀 변수에만 저장)
 *
 * 필요한 비밀 변수 (Settings → Variables and Secrets)
 *   NAVER_ID      NAVER API HUB Client ID
 *   NAVER_SECRET  NAVER API HUB Client Secret
 *   DATA_GO_KEY   공공데이터포털 인증키 (Decoding)
 *   GEMINI_KEY    Google AI Studio Gemini API 키 (신메뉴 제안용)
 *
 * GET /trend?q=과일모찌                  → 2016년부터 주간 검색량 (최고점 = 100)
 * GET /shops?q=과일모찌&src=cafe&page=1  → 상호에 단어가 들어간 휴게음식점(cafe)·제과점(bakery) 100곳씩
 * POST /menu  {keyword, type, kind, price, targetRate, profile}  → AI 신메뉴 제안 + 원가 검증(목표 원가율을 넘으면 최대 3번 다시)
 */
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
const PRICE = {
  '원두': { unit: 'g', price: 28.5 }, '우유': { unit: 'ml', price: 3.27 }, '바닐라시럽': { unit: 'ml', price: 15.5 },
  '초코소스': { unit: 'g', price: 8.92 }, '연유': { unit: 'g', price: 8.6 }, '아이스컵세트': { unit: '개', price: 96.9 },
  '얼음': { unit: 'g', price: 1.0, note: '예시값' }, '빨대': { unit: '개', price: 15.0, note: '예시값' },
};
const GEMINI_MODEL = 'gemini-3.8-flash';  // 바뀌면 Worker 변수 GEMINI_MODEL로 덮어쓰기

function costOf(recipe) {
  let total = 0;
  const rows = recipe.map(r => {
    const known = PRICE[r.ing];
    const unit = known ? known.unit : r.unit;
    const up = known ? known.price : Number(r.est_unit_price) || 0;
    const cost = (Number(r.qty) || 0) * up;
    total += cost;
    return { ing: r.ing, qty: Number(r.qty) || 0, unit, unit_price: +up.toFixed(2), cost: Math.round(cost),
             source: known ? (known.note ? '원가표 (예시값)' : '원가표') : 'AI 추정' };
  });
  return { rows, total: Math.round(total) };
}

async function askGemini(prompt, env) {
  const model = env.GEMINI_MODEL || GEMINI_MODEL;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.8 } }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Gemini 오류 ${res.status}: ${text.slice(0, 200)}`);
  const data = JSON.parse(text);
  const out = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return JSON.parse(out.replace(/^```json\s*|```$/g, ''));
}

async function menu(body, env) {
  const kw = cleanQuery(body.keyword);
  if (!kw) throw new Error('디저트 이름이 필요해요.');
  const kind = body.kind === '음료' ? '카페 음료 (ICE 16oz)' : '디저트·베이커리 (1인분)';
  const price = Math.max(2000, Math.min(30000, Number(body.price) || 5500));
  const target = Math.max(15, Math.min(50, Number(body.targetRate) || 30));
  const p = body.profile || {};
  const known = Object.entries(PRICE).map(([k, v]) => `${k}(${v.unit}당 ${v.price}원)`).join(', ');
  const base = `당신은 한국 카페·디저트 프랜차이즈의 메뉴개발자입니다. 트렌드 키워드로 실제 매장에서 팔 신메뉴 1개를 만드세요.
- 트렌드 키워드: ${kw} (유행 단계: ${body.type || '알 수 없음'})
- 메뉴 분야: ${kind}
- 목표 판매가: ${price}원, 목표 원가율: ${target}% 이하
- 가게 주력 분야: ${p.cat || '정보 없음'} / 보유 장비: ${(p.eq || []).join(', ') || '정보 없음'} (없는 장비가 필요한 공정은 쓰지 말 것)
- 쓰지 않는 재료: ${(p.ban || []).join(', ') || '없음'} (절대 넣지 말 것)
- 단가를 아는 재료: ${known}. 이 재료는 이름을 똑같이 쓰고 단위도 맞출 것.
- 그 밖의 재료는 2026년 한국 업소용 식자재 기준 단위당 단가(원)를 est_unit_price로 추정. 단위는 g, ml, 개 중 하나.
- 음료면 아이스컵세트 1개와 빨대 1개를 넣고, 디저트면 포장 용기를 재료로 넣을 것.
JSON 하나만 답하세요: {"name":"메뉴명","concept":"한 문장","target":"타깃 고객 한 문장","point":"판매 포인트 한 문장","pairing":"함께 팔 메뉴 한 문장","recipe":[{"ing":"재료","qty":숫자,"unit":"g|ml|개","est_unit_price":숫자}],"steps":["만드는 순서 3~5단계"]}`;
  const log = [];
  let prompt = base, result, cost;
  for (let i = 1; i <= 3; i++) {
    result = await askGemini(prompt, env);
    if (!Array.isArray(result.recipe) || !result.recipe.length) throw new Error('AI가 레시피를 만들지 못했어요. 다시 시도해 주세요.');
    cost = costOf(result.recipe);
    const rate = cost.total / price * 100;
    log.push({ try: i, rate: +rate.toFixed(1), cost: cost.total });
    if (rate <= target) break;
    if (i < 3) prompt = base + `\n\n직전 제안: ${JSON.stringify(result.recipe)}\n재료 원가 ${cost.total}원, 원가율 ${rate.toFixed(1)}%로 목표 ${target}%를 넘었습니다. 맛의 핵심은 지키면서 양을 줄이거나 더 싼 재료로 바꿔 다시 제안하세요.`;
  }
  const rate = cost.total / price * 100;
  const banned = (p.ban || []).filter(b => cost.rows.some(r => r.ing.includes(b)));
  return { banned, keyword: kw, kind, price, target, name: result.name, concept: result.concept, targetCustomer: result.target,
    point: result.point, pairing: result.pairing, steps: result.steps || [], recipe: cost.rows, cost: cost.total,
    rate: +rate.toFixed(1), margin: price - cost.total, pass: rate <= target, tries: log, priceDate: '2026-11-02' };
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });
    const url = new URL(request.url);
    if (url.pathname === '/menu') {
      if (request.method !== 'POST') return json({ error: 'POST로 요청해 주세요.' }, 405, origin);
      if (!env.GEMINI_KEY) return json({ error: 'GEMINI_KEY가 설정되지 않았어요.' }, 500, origin);
      try { return json(await menu(await request.json(), env), 200, origin); }
      catch (e) { return json({ error: String(e.message || e) }, 502, origin); }
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
      else if (url.pathname === '/shops') data = await shops(q, url.searchParams.get('src'), Math.max(1, Math.min(50, Number(url.searchParams.get('page')) || 1)), env);
      else return json({ ok: true, usage: ['/trend?q=', '/shops?q=&src=cafe|bakery&page='] }, 200, origin);
      const resp = json(data, 200, origin, 86400);
      ctx.waitUntil(cache.put(key, resp.clone()));
      return resp;
    } catch (e) {
      return json({ error: String(e.message || e) }, 502, origin);
    }
  },
};
