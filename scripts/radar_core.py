"""신규 디저트 조기 경보: 가게 이름에서 갑자기 늘어나는 단어 찾기"""
import pandas as pd, numpy as np, re
EVENT = r'PC|피씨|노래|코인|게임|만화|보드|축제|페스티벌|예술제|박람회|행사|부스|체험|엑스포|팝업|임시|한시적|주식회사|\(주\)|농업회사|협동조합|조합|백화점|휴게소|아울렛|면세'
STOP = set('영업 커피 카페 점 본점 지점 직영 직영점 스토어 매장 마트 편의점 휴게 식당 분식 푸드 하우스 코리아 신세계 롯데 현대 이마트 홈플러스 '
           '터미널 공항 학교 대학 대학교 병원 교회 센터 빌딩 타워 상회 상사 마을 테이크아웃 디저트 베이커리 제과 제과점 빵집 카페테리아 '
           '스튜디오 라운지 키친 다방 찻집 유통 수산 상사 에프앤비 에프 앤비 기프트 씨네 시네마 영화관 극장 카페마 테크 산업 클라우드 크라우드 써브웨이 서브웨이 coffee cafe'.split())
def tokens(name):
    toks = re.findall(r'[가-힣]{2,}', name or '')
    return [t for t in toks if t not in STOP and not t.endswith('점') and len(t) <= 12]
def grams(tok):
    return {tok[i:i+n] for n in (2, 3, 4) for i in range(len(tok) - n + 1)}

def prepare(df):
    """df: 사업장명, 인허가일자, 폐업일자, 주소(시군구용) 컬럼"""
    d = df.copy()
    d['o'] = pd.to_datetime(d['인허가일자'], errors='coerce'); d['c'] = pd.to_datetime(d['폐업일자'], errors='coerce')
    d = d[d.o.notna()]
    d = d[~d['사업장명'].fillna('').str.contains(EVENT)]
    d = d[~(d.c.notna() & ((d.c - d.o).dt.days <= 90))]           # 팝업·행사 매장 제외
    d['sgg'] = d['주소'].fillna('').str.split().str[:2].str.join(' ')
    d['toks'] = d['사업장명'].map(tokens)
    return d

def scan(d, end, min_recent=12, ratio=4, min_spread=6, min_brands=4, window_m=3, base_m=12):
    """end 시점 기준 최근 window_m개월 개업과 그 이전 base_m개월 평균을 비교"""
    end = pd.Timestamp(end); w0 = end - pd.DateOffset(months=window_m); b0 = w0 - pd.DateOffset(months=base_m)
    rec = d[(d.o > w0) & (d.o <= end)]; base = d[(d.o > b0) & (d.o <= w0)]
    def explode(x, kind):
        rows = []
        for sgg, toks in zip(x.sgg, x.toks):
            for t in toks:
                keys = {t} if kind == 'brand' else grams(t)
                for g in keys: rows.append((g, t, sgg))
        return pd.DataFrame(rows, columns=['g', 'tok', 'sgg'])
    out = []
    for kind in ('menu', 'brand'):
        R = explode(rec, kind)
        if R.empty: continue
        agg = R.groupby('g').agg(recent=('sgg', 'size'), spread=('sgg', 'nunique'), brands=('tok', 'nunique'))
        agg = agg[(agg.recent >= min_recent) & (agg.spread >= min_spread)]
        if agg.empty: continue
        Bx = explode(base[base.toks.map(lambda ts: any(g in t for t in ts for g in agg.index))], kind) if kind == 'menu' else explode(base, kind)
        bcnt = Bx.groupby('g').size().reindex(agg.index, fill_value=0) / base_m * window_m
        agg['base'] = bcnt.round(1)
        agg = agg[agg.recent >= ratio * agg.base.clip(lower=1)]
        if kind == 'menu': agg = agg[agg.brands >= min_brands]
        else: agg = agg[agg.index.str.len() >= 2]
        agg['kind'] = kind
        out.append(agg)
    if not out: return pd.DataFrame()
    A = pd.concat(out)
    # 지역 이름(익산, 광주 등) 제거
    regions = set()
    for a in d['주소'].fillna('').str.split().str[:2]:
        for t in a: regions.add(re.sub(r'(특별자치시|특별자치도|특별시|광역시|시|군|구|도)$', '', t))
    A = A[~A.index.isin(regions)]
    A = A.loc[np.array([not any(w in sw for sw in STOP) for w in A.index], dtype=bool)]   # 불용어의 일부 조각(에프, 프트 등) 제거
    # 메뉴: 부분 문자열 정리 (긴 단어가 비슷한 수를 가지면 긴 단어만)
    m = A[A.kind == 'menu']
    drop = {a for a in m.index for b in m.index if a != b and a in b and m.loc[b, 'recent'] >= 0.8 * m.loc[a, 'recent']}
    # 메뉴와 같은 브랜드면 브랜드 쪽 제거
    A = A[~((A.kind == 'menu') & A.index.isin(drop))]
    A['growth'] = (A.recent / A.base.clip(lower=1)).round(1)
    return A.sort_values(['kind', 'recent'], ascending=[False, False])
