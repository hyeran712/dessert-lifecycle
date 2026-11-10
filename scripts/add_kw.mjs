// 새 디저트의 네이버 검색량(주간, 2016~)을 Worker /trend로 받아 src/data.json 의 kw 에 넣는다.
// 사용: node scripts/add_kw.mjs            (아래 NEW 전부)
//       node scripts/add_kw.mjs 빙수 밤디저트  (일부만; NEW 의 키 이름으로)
// - 분석 방식은 화면의 lifecycle() 과 같은 함수를 src/app.js 에서 그대로 꺼내 쓴다 (13주 이동평균, 피크, 유형, 월별 계절 배수)
// - 검색 한도(하루 30번)를 쓴다. 한도가 차면 멈추고 알려 준다. 키는 필요 없다 (Worker 가 들고 있음)
// - 새 디저트는 각자 자기 피크=100 기준이다 (노트북의 '디저트' 기준 맞춤과 다름). 계절 배수·유형·현재 수준에는 영향 없음
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = process.env.TREND_API || 'https://dessert-timing.yhr9232.workers.dev';
const NEW = {   // data.json 키 : 네이버에서 찾을 검색어
  '크리스마스 케이크': '크리스마스 케이크',
  '딸기 케이크': '딸기 케이크',
  '발렌타인 초콜릿': '발렌타인 초콜릿',
  '빙수': '빙수',
  '고구마 디저트': '고구마 디저트',
  '밤 디저트': '밤 디저트',
  '카네이션 케이크': '카네이션 케이크',
};

const src = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
const grab = re => { const m = src.match(re); if (!m) throw new Error('app.js 에서 함수를 못 찾았어요: ' + re); return m[0]; };
const code = [grab(/const mean = [^\n]*\n/), grab(/function rolling\([^\n]*\n/), grab(/function lifecycle\(dates, raw\) \{[\s\S]*?\n\}\n/)].join('\n');
const lifecycle = new Function(code + '\nreturn lifecycle;')();

const dataPath = path.join(root, 'src/data.json');
const D = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const pick = process.argv.slice(2).map(a => a.replace(/\s/g, ''));
const todo = Object.entries(NEW).filter(([k]) => !pick.length || pick.includes(k.replace(/\s/g, '')));
const round = (x, n) => x === null || x === undefined ? x : +x.toFixed(n);

let done = 0;
for (const [key, q] of todo) {
  const res = await fetch(`${API}/trend?q=${encodeURIComponent(q)}`);
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) { console.log(`✗ ${key}: ${j.error || res.status}`); if (res.status === 429) { console.log('하루 한도를 다 썼어요. 내일(한국 시간 0시 이후) 다시 실행하세요. 이미 받은 건 저장돼 있어요.'); break; } continue; }
  // 기존 주간 날짜(D.dates)에 맞춘다. 없는 주는 0
  const by = new Map(j.dates.map((d, i) => [d, j.ratio[i]]));
  const raw = D.dates.map(d => by.get(d) ?? 0);
  const v = lifecycle(D.dates, raw);
  if (!v) { console.log(`✗ ${key}: 검색량이 너무 적어서 분석 불가`); continue; }
  D.kw[key] = { cal: true, type: v.type, peak: v.peak, rise: v.rise, half: v.half, now: v.now, yoy: v.yoy, smonth: v.smonth, amp: round(v.amp, 2), pre52: v.pre52, s: v.s, season: v.season.map(x => round(x, 3)) };
  done++;
  console.log(`✓ ${key}: ${v.type} · 피크 ${v.peak} · 대목 ${v.smonth}월 · 계절 배수 최대 ${round(v.amp, 1)}배 · 월별 ${v.season.map(x => x.toFixed(1)).join(' ')}`);
  fs.writeFileSync(dataPath, JSON.stringify(D));   // 하나 받을 때마다 저장
  await new Promise(r => setTimeout(r, 800));
}
console.log(`끝: ${done}개 추가 (src/data.json). 이어서 ./build.sh`);
