-- 디저트 타이밍 로그인 사용자 저장 공간 (2026-11-09)
-- Supabase 대시보드 → SQL Editor → New query 에 통째로 붙여 넣고 [Run]. 여러 번 실행해도 안전하게 썼다.
-- 모든 표에 RLS(행 단위 보안)를 켜서, 로그인한 사람은 '자기 줄'만 읽고 쓸 수 있다.

-- 1) 사람마다 한 줄: 가게 프로필 · 내 원가표 · 연결한 원가표 시트
create table if not exists public.user_data (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  profile    jsonb,            -- 가게 이름·분야·장비·가격대·금기 재료 (localStorage dessert-timing-profile)
  costs      jsonb,            -- 내 원가표 {재료: {unit, price, buy, src, note}} (dessert-timing-costs)
  sheet      jsonb,            -- 연결한 구글 시트 {url, id, gid} (dessert-timing-sheet)
  updated_at timestamptz not null default now()
);

-- 2) 보관함에 저장한 신메뉴 (한 사람 여러 줄)
create table if not exists public.saved_menus (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  local_id   bigint not null,  -- 화면 보관함의 id (Date.now()). 같은 메뉴를 두 번 올리지 않게
  k          text,             -- 디저트
  goal       text,             -- 메뉴 목적
  m          jsonb not null,   -- 메뉴 카드 내용 전체
  created_at timestamptz not null default now(),
  unique (user_id, local_id)
);
create index if not exists saved_menus_user on public.saved_menus (user_id, created_at desc);

alter table public.user_data   enable row level security;
alter table public.saved_menus enable row level security;

drop policy if exists "own user_data" on public.user_data;
create policy "own user_data" on public.user_data for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "own saved_menus" on public.saved_menus;
create policy "own saved_menus" on public.saved_menus for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 프로젝트를 만들 때 'Automatically expose new tables'를 껐기 때문에 직접 열어 준다 (로그인한 사람만, 익명은 안 됨)
grant select, insert, update, delete on public.user_data, public.saved_menus to authenticated;
revoke all on public.user_data, public.saved_menus from anon;

-- 3) 회원 탈퇴: 로그인한 본인 계정과 저장한 것 모두 지우기 (위 표는 on delete cascade로 같이 지워짐)
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
