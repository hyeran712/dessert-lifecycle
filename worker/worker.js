/**
 * 디저트 타이밍 실시간 분석용 Cloudflare Worker
 * 홈페이지가 이 Worker를 거쳐 네이버 검색량과 인허가 데이터를 받아온다. (인증키는 Worker 비밀 변수에만 저장)
 *
 * 필요한 비밀 변수 (Settings → Variables and Secrets)
 *   NAVER_ID      NAVER API HUB Client ID
 *   NAVER_SECRET  NAVER API HUB Client Secret
 *   DATA_GO_KEY   공공데이터포털 인증키 (Decoding)
 *
 * GET /trend?q=과일모찌                  → 2016년부터 주간 검색량 (최고점 = 100)
 * GET /shops?q=과일모찌&src=cafe&page=1  → 상호에 단어가 들어간 휴게음식점(cafe)·제과점(bakery) 100곳씩
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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });
    const url = new URL(request.url);
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
