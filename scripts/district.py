"""시군구별 '우리 동네 카페·디저트 리포트' 데이터 만들기 → live/district.json

입력: 행정안전부 인허가 전체 데이터(휴게음식점 + 제과점)를 합친 표
      (열: 사업장명, 인허가일자, 폐업일자, 영업상태명, 업태구분명, 도로명주소, 지번주소, src)
실행: python scripts/district.py all.pkl            (pickle)
      python scripts/district.py 휴게음식점.csv 제과점.csv   (원본 CSV, cp949)
"""
import sys, json, re
from pathlib import Path
import pandas as pd, numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'live' / 'district.json'
CAFE_TYPES = {'커피숍', '과자점', '아이스크림', '전통찻집', '떡카페', '기타 휴게음식점', '제과점영업'}
SIDO = {'서울': '서울', '부산': '부산', '대구': '대구', '인천': '인천', '대전': '대전', '울산': '울산', '세종': '세종', '경기': '경기',
        '강원': '강원', '충청북': '충북', '충북': '충북', '충청남': '충남', '충남': '충남', '전라북': '전북', '전북': '전북',
        '전남광주': '전남광주', '전라남': '전남광주', '광주': '전남광주', '경상북': '경북', '경북': '경북', '경상남': '경남', '경남': '경남', '제주': '제주'}
# 우리 동네 디저트 매장 수를 셀 키워드 (상호에 들어간 단어)
DK = {'탕후루': ['탕후루'], '크로플': ['크로플'], '마카롱': ['마카롱'], '요거트 아이스크림': ['요아정', '요거트아이스크림', '요거트퍼플'],
      '베이글': ['베이글'], '소금빵': ['소금빵'], '모찌': ['모찌'], '약과': ['약과'], '흑당': ['흑당', '타이거슈가', '쩐주단', '흑화당'],
      '휘낭시에': ['휘낭시에'], '붕어빵': ['붕어빵', '잉어빵'], '젤라또': ['젤라또', '젤라토'], '도넛': ['도넛', '도너츠', '도나스'],
      '와플': ['와플'], '빙수': ['빙수', '설빙'], '케이크': ['케이크', '케익'], '쿠키': ['쿠키'], '디저트 카페': ['디저트']}
# 새 가게 이름에서 늘어나는 단어를 찾을 후보
WORDS = sorted({w for ws in DK.values() for w in ws} | {'베이크', '베이커리', '브레드', '빵', '로스터', '로스터리', '티하우스', '말차', '에스프레소바',
        '스콘', '타르트', '푸딩', '크레페', '츄러스', '떡', '당고', '버블티', '공차', '샐러드', '키즈', '무인', '테이크아웃', '컴포즈', '메가', '빽다방',
        '저가', '계란빵', '호떡', '찹쌀', '파이', '소금', '휘낭', '치즈', '크림'}, key=len, reverse=True)

def load(paths):
    if paths[0].endswith('.pkl'): return pd.read_pickle(paths[0])
    fr = []
    for p in paths:
        d = pd.read_csv(p, encoding='cp949', dtype=str, low_memory=False)
        d['src'] = '제과점' if '제과' in p else '휴게음식점'; fr.append(d)
    return pd.concat(fr, ignore_index=True)

def district(addr):
    t = str(addr or '').split()
    if not t: return None
    sd = next((v for k, v in sorted(SIDO.items(), key=lambda x: -len(x[0])) if t[0].startswith(k)), None)
    if not sd: return None
    if sd == '세종': return '세종 세종시'
    if len(t) < 2: return None
    g = t[1]
    if g.endswith('시') and len(t) > 2 and re.fullmatch(r'\S+구', t[2]): g = g + ' ' + t[2]   # 수원시 장안구
    if not re.search(r'(시|군|구)$', g.split()[-1]): return None
    return f'{sd} {g}'

def main():
    a = load(sys.argv[1:] or [str(Path.home() / 'localdata' / 'all.pkl')])
    a = a[a['업태구분명'].isin(CAFE_TYPES)].copy()
    # '기타 휴게음식점'에 섞인 카페가 아닌 가게(PC방, 편의점, 운동·놀이 시설 등) 빼기
    NOT_CAFE = r'PC|피씨|피시방|노래|코인|게임|만화|보드|당구|볼링|골프|스크린|오락|세븐일레븐|GS25|지에스25|CU|씨유|이마트24|미니스톱|편의점|마트|피트니스|헬스|짐박스|요가|필라테스|스터디|독서실|키즈|PLAY|플레이|방탈출|사우나|찜질|영화|CGV|메가박스|롯데시네마'
    a = a[~a['사업장명'].fillna('').str.contains(NOT_CAFE, case=False)]
    ad = a['도로명주소'].fillna('').where(a['도로명주소'].fillna('') != '', a['지번주소'].fillna(''))
    a['d'] = ad.map(district); a = a[a.d.notna()]
    a['o'] = pd.to_datetime(a['인허가일자'], errors='coerce'); a['c'] = pd.to_datetime(a['폐업일자'], errors='coerce')
    a = a[a.o.notna()].reset_index(drop=True)
    today = min(pd.Timestamp(a['인허가일자'].max()), pd.Timestamp.now().normalize())
    a.loc[a.c > today, 'c'] = pd.NaT
    # 90일 안에 닫은 곳 = 축제 부스·팝업·행사 매장 (개업·폐업·생존율 계산에서 따로 셈)
    a['popup'] = a.c.notna() & ((a.c - a.o).dt.days <= 90)
    a['alive'] = a['영업상태명'].fillna('').str.contains('영업') & a.c.isna()
    n = a['사업장명'].fillna('').str.replace(' ', '')
    for k, ws in DK.items(): a['k_' + k] = n.str.contains('|'.join(map(re.escape, ws)))
    y1, m3, m6, m18 = [today - pd.DateOffset(months=x) for x in (12, 3, 6, 18)]
    a['coh'] = (a.o > today - pd.DateOffset(months=24)) & (a.o <= today - pd.DateOffset(months=12))   # 1~2년 전에 연 가게
    a['coh3'] = (a.o > today - pd.DateOffset(months=48)) & (a.o <= today - pd.DateOffset(months=36))   # 3~4년 전에 연 가게
    surv3 = lambda d: d[d.coh3 & ~d.popup].pipe(lambda x: None if len(x) < 15 else round(float(((x.c.isna()) | ((x.c - x.o).dt.days > 1095)).mean() * 100), 1))
    surv1 = lambda d: d[d.coh & ~d.popup].pipe(lambda x: None if len(x) < 15 else round(float(((x.c.isna()) | ((x.c - x.o).dt.days > 365)).mean() * 100), 1))
    def life(d):
        x = d[(d.c > y1) & (d.c <= today) & ~d.popup]
        return None if len(x) < 10 else int(np.median((x.c - x.o).dt.days) / 30.4)
    def words(d):
        d = d[~d.popup]
        r, b = d[(d.o > m6) & (d.o <= today)], d[(d.o > m18) & (d.o <= m6)]
        rn, bn = r['사업장명'].fillna('').str.replace(' ', ''), b['사업장명'].fillna('').str.replace(' ', '')
        out = []
        for w in WORDS:
            c1, c0 = int(rn.str.contains(w, regex=False).sum()), int(bn.str.contains(w, regex=False).sum())
            if c1 >= 3: out.append([w, c1, round(c1 / max(c0 / 2, 0.5), 1)])   # 6개월 vs 앞선 12개월(6개월 환산)
        out.sort(key=lambda x: (-x[2] * min(x[1], 10), -x[1]))
        seen, res = [], []
        for w, c1, g in out:       # '휘낭' '휘낭시에'처럼 겹치는 단어는 하나만
            if any(w in s or s in w for s in seen): continue
            seen.append(w); res.append([w, c1, g])
        return res[:6]
    al = a[a.alive]
    nat = {'alive': int(len(al)), 'surv1': surv1(a), 'surv3': surv3(a), 'life': life(a), 'kw': {k: int(al['k_' + k].sum()) for k in DK}}
    rows = {}
    for d, g in a.groupby('d'):
        ga = g[g.alive]
        if len(ga) < 30: continue
        gp = g[~g.popup]
        rec = gp[(gp.o > m3) & (gp.o <= today)].sort_values('o', ascending=False)
        rows[d] = {'alive': int(len(ga)), 'o12': int(((gp.o > y1) & (gp.o <= today)).sum()), 'c12': int(((gp.c > y1) & (gp.c <= today)).sum()),
                   'pop12': int((g.popup & (g.o > y1)).sum()),
                   'o3': int(len(rec)), 'surv1': surv1(g), 'surv3': surv3(g), 'life': life(g),
                   'kw': {k: int(ga['k_' + k].sum()) for k in DK},
                   'words': words(g), 'recent': [[r['사업장명'], r.o.strftime('%m.%d')] for _, r in rec.head(8).iterrows()]}
    rk = sorted(rows, key=lambda d: -rows[d]['alive'])
    for i, d in enumerate(rk): rows[d]['rank'] = i + 1
    out = {'date': today.strftime('%Y-%m-%d'), 'n': len(rows), 'nat': nat, 'kw': list(DK), 'd': rows}
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
    print(f'{len(rows)}개 시군구, 기준일 {out["date"]}, 전국 영업 중 {nat["alive"]:,}곳 → {OUT} ({OUT.stat().st_size // 1024}KB)')

if __name__ == '__main__':
    main()
