"""매주 실행: 인허가 API에서 바뀐 가게를 받아와 매장 현황과 신규 디저트 조기 경보를 갱신한다.

환경변수
  SERVICE_KEY    공공데이터포털 인증키 (Decoding 키, GitHub Secrets에 저장)
  API_ENDPOINTS  {"휴게음식점": "...", "제과점": "..."} 형태의 요청 주소 (GitHub Variables, 없으면 기본값)
실행: python scripts/update.py            (API 호출 + 갱신)
      python scripts/update.py --offline  (API 없이 저장된 데이터로 다시 계산만)
"""
import json, os, sys, time, datetime as dt
from pathlib import Path
import pandas as pd, numpy as np, requests
sys.path.insert(0, str(Path(__file__).parent))
from radar_core import prepare, scan

ROOT = Path(__file__).resolve().parent.parent
LIVE = ROOT / 'live'
BASE_CSV = LIVE / 'radar_base.csv.gz'
SHOPS_CSV = ROOT / 'dessert_lifecycle' / 'data' / 'shops_filtered.csv'
STATE = LIVE / 'state.json'
OUT = LIVE / 'live.json'
KST = dt.timezone(dt.timedelta(hours=9))
DEFAULT_ENDPOINTS = {'휴게음식점': 'https://apis.data.go.kr/1741000/rest_cafes/info',
                     '제과점': 'https://apis.data.go.kr/1741000/bakeries/info'}
KW = {'탕후루': ['탕후루'], '흑당': ['흑당', '타이거슈가', '쩐주단', '흑화당'], '크로플': ['크로플'], '마카롱': ['마카롱'],
      '요거트 아이스크림': ['요아정', '요거트아이스크림', '요거트퍼플'], '베이글': ['베이글'], '모찌': ['모찌'],
      '소금빵': ['소금빵'], '붕어빵': ['붕어빵', '잉어빵'], '땅콩빵': ['땅콩빵']}

def log(*a): print('[update]', *a, flush=True)

# ---------- API ----------
def fetch_updates(url, key, since):
    """since(YYYYMMDDHHMMSS) 이후 갱신된 인허가 정보를 모두 받아온다."""
    rows, page, total = [], 1, None
    while True:
        params = {'serviceKey': key, 'pageNo': page, 'numOfRows': 100, 'returnType': 'json', 'cond[DAT_UPDT_PNT::GTE]': since}
        for attempt in range(4):
            try:
                r = requests.get(url, params=params, timeout=30); r.raise_for_status(); data = r.json(); break
            except Exception as e:
                if attempt == 3: raise RuntimeError(f'API 호출 실패 ({url}, page {page}): {e}; 응답 앞부분: {getattr(r, "text", "")[:300]}')
                time.sleep(2 * (attempt + 1))
        res = data.get('response', {})
        head = res.get('header', {})
        if str(head.get('resultCode', '0')) not in ('0', '00'):
            raise RuntimeError(f"API 오류 {head.get('resultCode')}: {head.get('resultMsg')}")
        body = res.get('body', {})
        total = int(body.get('totalCount', 0))
        items = (body.get('items') or {}).get('item') or []
        if isinstance(items, dict): items = [items]
        rows += items
        log(f'{url.split("/")[-2]} page {page}: {len(rows)}/{total}')
        if not items or len(rows) >= total: break
        page += 1; time.sleep(0.2)
    return rows

def fetch_by_name(url, key, word):
    """상호에 word가 들어간 가게를 기간 상관없이 모두 받아온다 (새 디저트를 처음 넣을 때 한 번만)."""
    rows, page, total = [], 1, None
    while True:
        params = {'serviceKey': key, 'pageNo': page, 'numOfRows': 100, 'returnType': 'json', 'cond[BPLC_NM::LIKE]': word}
        for attempt in range(4):
            try:
                r = requests.get(url, params=params, timeout=30); r.raise_for_status(); data = r.json(); break
            except Exception as e:
                if attempt == 3: raise RuntimeError(f'API 호출 실패 ({url}, {word}, page {page}): {e}')
                time.sleep(2 * (attempt + 1))
        body = data.get('response', {}).get('body', {})
        total = int(body.get('totalCount', 0))
        items = (body.get('items') or {}).get('item') or []
        if isinstance(items, dict): items = [items]
        rows += items
        log(f'{url.split("/")[-2]} "{word}" page {page}: {len(rows)}/{total}')
        if not items or len(rows) >= total: break
        page += 1; time.sleep(0.2)
    return rows

# ---------- 설·추석 날짜 (한국천문연구원 특일 정보) ----------
HOLI_URL = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo'
HOLI = LIVE / 'holidays.json'

def update_holidays(key, now):
    """올해~2년 뒤 설날·추석 당일을 받아 live/holidays.json에 저장. 실패하면 기존 파일을 그대로 둔다."""
    out = []
    try:
        for y in range(now.year, now.year + 3):
            r = requests.get(HOLI_URL, params={'ServiceKey': key, 'solYear': y, 'numOfRows': 100, '_type': 'json'}, timeout=30)
            r.raise_for_status()
            items = ((r.json().get('response', {}).get('body', {}).get('items') or {}).get('item')) or []
            if isinstance(items, dict): items = [items]
            for name in ('설날', '추석'):
                days = sorted(str(i['locdate']) for i in items if str(i.get('dateName', '')).strip() == name)
                if days:   # 연휴 3일 중 가운데가 당일
                    d = days[len(days) // 2]
                    out.append([f'{d[:4]}-{d[4:6]}-{d[6:8]}', name])
        if out:
            HOLI.write_text(json.dumps({'updated': now.strftime('%Y-%m-%d'), 'items': out}, ensure_ascii=False))
            log(f'설·추석 날짜 {len(out)}개 저장')
    except Exception as e:
        log(f'설·추석 날짜를 받지 못했어요 (기존 값 유지): {e}')

def to_frame(items, src):
    if not items: return pd.DataFrame(columns=['관리번호', '사업장명', '인허가일자', '폐업일자', '영업상태명', '주소', 'src'])
    d = pd.DataFrame(items)
    g = lambda c: d[c] if c in d else pd.Series([None] * len(d))
    out = pd.DataFrame({'관리번호': g('MNG_NO'), '사업장명': g('BPLC_NM'), '인허가일자': g('LCPMT_YMD'), '폐업일자': g('CLSBIZ_YMD'),
                        '영업상태명': g('SALS_STTS_NM'), '주소': g('ROAD_NM_ADDR').where(g('ROAD_NM_ADDR').fillna('') != '', g('LOTNO_ADDR')),
                        '업태구분명': g('BZSTAT_SE_NM'), 'src': src})
    out['폐업일자'] = out['폐업일자'].replace('', None)
    return out

def keyword_of(name):
    n = (name or '').replace(' ', '')
    for k, ws in KW.items():
        if any(w in n for w in ws): return k
    return None

# ---------- 갱신 ----------
def apply_updates(new):
    base = pd.read_csv(BASE_CSV, dtype=str)
    shops = pd.read_csv(SHOPS_CSV, dtype=str)
    if len(new):
        new = new.drop_duplicates('관리번호', keep='last')
        recent = new[pd.to_datetime(new['인허가일자'], errors='coerce') >= '2025-01-01']
        known = base['관리번호'].isin(new['관리번호'])
        base = pd.concat([base[~known], recent.reindex(columns=base.columns)], ignore_index=True)
        new['키워드'] = new['사업장명'].map(keyword_of)
        kn = new[new['키워드'].notna()].copy()
        if len(kn):
            kn['인허가업종'] = kn['src']; kn['시도'] = kn['주소'].fillna('').str.split().str[0]
            kn = kn.reindex(columns=shops.columns)
            shops = pd.concat([shops[~shops['관리번호'].isin(kn['관리번호'])], kn], ignore_index=True)
        base.to_csv(BASE_CSV, index=False, compression='gzip')
        shops.to_csv(SHOPS_CSV, index=False, encoding='utf-8-sig')
    return base, shops, new

# ---------- 계산 ----------
SIDO = {'서울': '서울', '부산': '부산', '대구': '대구', '인천': '인천', '대전': '대전', '울산': '울산', '세종': '세종', '경기': '경기',
        '강원': '강원', '충청북': '충북', '충북': '충북', '충청남': '충남', '충남': '충남', '전라북': '전북', '전북': '전북',
        '전남광주': '전남광주', '전라남': '전남광주', '전남': '전남광주', '광주': '전남광주', '경상북': '경북', '경북': '경북',
        '경상남': '경남', '경남': '경남', '제주': '제주'}

def short_sido(x):
    x = str(x or '')
    for k in sorted(SIDO, key=len, reverse=True):
        if x.startswith(k): return SIDO[k]
    return None

def pop_days(o, c):
    """90일 안에 닫은 팝업 매장이면 영업 일수(최소 1), 아니면 0"""
    if pd.isna(c) or pd.isna(o): return 0
    n = (c - o).days
    return max(1, int(n)) if n <= 90 else 0

def ispop(x):
    return x.c.notna() & ((x.c - x.o).dt.days <= 90)

def region_stats(d, perm, today):
    """시도별: 영업 중 매장, 최근 30·90일 개업/폐업 수, 최근 90일 개업·폐업 가게 이름"""
    out = {}
    d = d.assign(r=d['시도'].map(short_sido)); perm = perm.assign(r=perm['시도'].map(short_sido))
    t30, t90 = today - pd.Timedelta(days=30), today - pd.Timedelta(days=90)
    for r in sorted(set(d.r.dropna())):
        x, px = d[d.r == r], perm[perm.r == r]
        o90 = x[(x.o > t90) & (x.o <= today)].sort_values('o', ascending=False)
        c90 = x[(x.c > t90) & (x.c <= today)].sort_values('c', ascending=False)
        out[r] = {'alive': int(px.c.isna().sum()),
                  'o30': int((o90.o > t30).sum()), 'c30': int((c90.c > t30).sum()), 'o90': len(o90), 'c90': len(c90),
                  # 위 개업·폐업 숫자 중 팝업(90일 안에 닫은 곳)이 몇 곳인지
                  'po30': int(((o90.o > t30) & ispop(o90)).sum()), 'pc30': int(((c90.c > t30) & ispop(c90)).sum()),
                  'po90': int(ispop(o90).sum()), 'pc90': int(ispop(c90).sum()),
                  # 세 번째 값: 90일 안에 닫은 팝업이면 영업 일수, 아니면 0
                  'open': [[n, o.strftime('%m.%d'), pop_days(o, c)] for n, o, c in o90[['사업장명', 'o', 'c']].head(6).values],
                  # 폐업 목록 네 번째 값: 문 연 날 (90일보다 전에 열어서 개업 목록에 없는 가게도 언제 열었는지 보이게)
                  'close': [[n, c.strftime('%m.%d'), pop_days(o, c), o.strftime('%m.%d') if pd.notna(o) else ''] for n, o, c in c90[['사업장명', 'o', 'c']].head(6).values]}
    return out

def shop_stats(shops, today, new):
    s = shops.copy()
    s['o'] = pd.to_datetime(s['인허가일자'], errors='coerce'); s['c'] = pd.to_datetime(s['폐업일자'], errors='coerce')
    s = s[s.o.notna()]; s['days'] = (s.c - s.o).dt.days
    s['popup'] = s.days.notna() & (s.days <= 90)
    months = pd.date_range('2016-01-01', today.replace(day=1), freq='MS')
    out = {}
    week0 = today - pd.Timedelta(days=7)
    for k in KW:
        d = s[s['키워드'] == k]; perm = d[~d.popup]
        ends = months + pd.offsets.MonthEnd(0)
        alive = [int(((perm.o <= t) & (perm.c.isna() | (perm.c > t))).sum()) for t in ends]
        opened = d[d.o > week0]; closed = d[d.c > week0]
        out[k] = {'alive': alive, 'open_now': int(perm.c.isna().sum()), 'alive_max': max(alive),
                  'alive_peak': months[int(np.argmax(alive))].strftime('%Y-%m'), 'popup': int(d.popup.sum()), 'total': len(d),
                  'week_open': opened[['사업장명', '시도']].head(8).values.tolist(), 'week_open_n': len(opened),
                  'week_close': closed[['사업장명', '시도']].head(8).values.tolist(), 'week_close_n': len(closed),
                  'regions': region_stats(d, perm, today)}
    return out, months[0].strftime('%Y-%m')

def radar(base, today):
    d = prepare(base)
    strict = scan(d, today, min_brands=5)
    watch = scan(d, today, min_recent=8, ratio=2.5, min_spread=4, min_brands=3)
    watch = watch[~watch.index.isin(strict.index)]
    if len(watch):  # 두 글자 단어는 여러 브랜드가 함께 쓸 때만 (이프, 이안 같은 조각 제거)
        watch = watch[(watch.index.str.len() >= 3) | ((watch.kind == 'menu') & (watch.brands >= 6))]
    items = []
    for level, A in (('alert', strict), ('watch', watch.head(12))):
      for g, r in A.iterrows():
        ex = d[(d.o > today - pd.DateOffset(months=3)) & (d.o <= today) & d['사업장명'].fillna('').str.replace(' ', '').str.contains(g, regex=False)]
        items.append({'level': level, 'word': g, 'kind': r['kind'], 'recent': int(r['recent']), 'base': float(r['base']), 'growth': float(r['growth']),
                      'spread': int(r['spread']), 'examples': ex['사업장명'].drop_duplicates().head(4).tolist()})
    # 최근 3개월 인기 단어(경보 기준 미달 포함) 참고용
    return items

def main():
    offline = '--offline' in sys.argv
    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    now = dt.datetime.now(KST)
    new = pd.DataFrame()
    if not offline:
        key = os.environ.get('SERVICE_KEY', '').strip()
        if not key: sys.exit('SERVICE_KEY가 없습니다. GitHub Secrets에 등록해 주세요.')
        eps = json.loads(os.environ['API_ENDPOINTS']) if os.environ.get('API_ENDPOINTS') else DEFAULT_ENDPOINTS
        frames = []
        for src, url in eps.items():
            since = state.get('since', {}).get(src, '20261102000000')
            items = fetch_updates(url, key, since)
            log(f'{src}: {len(items)}건 갱신')
            frames.append(to_frame(items, src))
            state.setdefault('since', {})[src] = (now - dt.timedelta(days=3)).strftime('%Y%m%d%H%M%S')  # 2일 지연 + 여유
        new = pd.concat(frames, ignore_index=True) if frames else new
        update_holidays(key, now)
        # KW에 새로 넣은 디저트는 과거 가게까지 한 번 받아 둔다 (state.json의 backfilled에 기록)
        done = set(state.get('backfilled', ['탕후루', '흑당', '크로플', '마카롱', '요거트 아이스크림', '베이글', '모찌']))   # 노트북에서 이미 받아 둔 7종
        for k in [k for k in KW if k not in done]:
            for w in KW[k]:
                for src, url in eps.items():
                    items = fetch_by_name(url, key, w)
                    log(f'{k} 과거 가게 받기 · {src} "{w}": {len(items)}건')
                    new = pd.concat([new, to_frame(items, src)], ignore_index=True)
            done.add(k)
        state['backfilled'] = sorted(done)
    base, shops, new = apply_updates(new)
    # 데이터는 2일 전 기준이라 오늘-2일을 기준일로 본다
    today = pd.Timestamp(now.date()) - pd.Timedelta(days=2)
    st, m0 = shop_stats(shops, today, new)
    items = radar(base, today)
    prev = json.loads(OUT.read_text()) if OUT.exists() else {}
    hist = [h for h in prev.get('history', []) if h['date'] != today.strftime('%Y-%m-%d')]
    hist.append({'date': today.strftime('%Y-%m-%d'), 'alerts': [i['word'] for i in items if i['level'] == 'alert'],
                 'watch': [i['word'] for i in items if i['level'] == 'watch']})
    out = {'updated': now.strftime('%Y-%m-%d %H:%M'), 'data_date': today.strftime('%Y-%m-%d'), 'months0': m0,
           'fetched': int(len(new)), 'shops': st, 'radar': items, 'history': hist[-26:]}
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
    state['last_run'] = now.strftime('%Y-%m-%d %H:%M')
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=1))
    log(f'완료: 갱신 {len(new)}건, 경보·관찰 {len(items)}개, 기준일 {today.date()}')

if __name__ == '__main__':
    main()
