-- ============================================================================
-- hd-project06 — 지게차 엔진 사양 관리·비교
-- Supabase(Postgres) 운영 스키마 + RLS · 재실행 안전
--
--  이 스키마는 **수강생 본인의 Supabase 프로젝트**에 올리는 것을 전제로 합니다.
--  프로젝트가 본인 것이라 테이블 이름에 접두사를 붙이지 않았습니다.
--  (여러 앱을 한 프로젝트에 몰아 쓸 계획이면 이름 충돌을 먼저 확인하세요.)
--
--  이 도구를 DB 로 옮기는 이유: 엔진 사양은 **설계자 여럿이 함께 보는 마스터**입니다.
--  각자 브라우저에만 있으면 누가 최신본을 갖고 있는지 알 수 없습니다.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. 테이블
-- ----------------------------------------------------------------------------

create table if not exists public.engine (
  id              text primary key,              -- 'ENG-D4DB'
  maker           text not null,                 -- 엔진 제조사
  model           text not null,
  fuel            text check (fuel in ('디젤', 'LPG', '가솔린', '전기', '하이브리드')),
  displacement_cc numeric check (displacement_cc > 0),
  cylinders       int check (cylinders > 0),
  aspiration      text,                          -- 자연흡기 / 터보 …
  emission_std    text,                          -- Stage V, Tier 4F …
  rated_power_kw  numeric check (rated_power_kw > 0),
  rated_power_rpm numeric check (rated_power_rpm > 0),
  max_torque_nm   numeric check (max_torque_nm > 0),
  max_torque_rpm  numeric check (max_torque_rpm > 0),
  idle_rpm        numeric,
  max_rpm         numeric,
  dry_weight_kg   numeric,
  note            text,
  source_doc      text,                          -- 어느 사양서에서 왔는가
  updated_at      timestamptz not null default now(),
  updated_by      uuid default auth.uid(),
  constraint engine_maker_model_key unique (maker, model)
);
create index if not exists engine_maker_idx on public.engine (maker);

-- RPM 별 출력·토크 곡선
create table if not exists public.curve (
  id         bigint generated always as identity primary key,
  engine_id  text not null references public.engine(id) on delete cascade,
  rpm        numeric not null check (rpm > 0),
  power_kw   numeric check (power_kw >= 0),
  torque_nm  numeric check (torque_nm >= 0),
  -- 같은 엔진에 같은 RPM 이 두 번 들어오면 그래프가 지그재그로 꺾인다.
  -- ⚠ 프런트 upsert 는 onConflict 를 이 조합으로 지정할 것.
  constraint curve_uniq unique (engine_id, rpm)
);
create index if not exists curve_engine_idx on public.curve (engine_id, rpm);

-- 적용 지게차 모델 — 지게차 모델명으로도 조회할 수 있어야 한다
create table if not exists public.application (
  id             bigint generated always as identity primary key,
  engine_id      text not null references public.engine(id) on delete cascade,
  forklift_model text not null,
  capacity_ton   numeric,
  note           text,
  constraint application_uniq unique (engine_id, forklift_model)
);
create index if not exists app_model_idx on public.application (forklift_model);

-- 저장된 비교 (최대 4개)
create table if not exists public.comparison (
  id         bigint generated always as identity primary key,
  title      text not null,
  engine_ids text[] not null,
  memo       text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  -- 화면이 최대 4개까지만 나란히 그린다. 5개가 들어오면 그래프가 뭉개진다.
  -- coalesce 가 없으면 빈 배열에서 array_length 가 null 을 돌려주고,
  -- null 인 check 는 **통과**한다. 빈 비교가 그대로 저장된다.
  constraint comparison_max4
    check (coalesce(array_length(engine_ids, 1), 0) between 1 and 4)
);

create table if not exists public.log (
  id        bigint generated always as identity primary key,
  ran_at    timestamptz not null default now(),
  kind      text not null,
  detail    text,
  processed int not null default 0,
  failed    int not null default 0,
  actor     uuid default auth.uid()
);
create index if not exists log_ran_at_idx on public.log (ran_at desc);

create table if not exists public.admin (
  user_id uuid primary key, email text, created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. 함수
-- ----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from public.admin a where a.user_id = auth.uid());
$fn$;

-- kW ↔ PS 환산. 사양서마다 단위가 갈려서 화면에서 둘 다 보여 준다.
create or replace function public.kw_to_ps(p_kw numeric)
returns numeric language sql immutable set search_path = public as $fn$
  select case when p_kw is null then null else round(p_kw * 1.35962, 1) end;
$fn$;

create or replace function public.touch()
returns trigger language plpgsql set search_path = public as $fn$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$fn$;

drop trigger if exists engine_touch on public.engine;
create trigger engine_touch before update on public.engine
  for each row execute function public.touch();

-- ----------------------------------------------------------------------------
-- 3. 뷰
-- ----------------------------------------------------------------------------


-- ⚠ 뷰에는 `with (security_invoker = true)` 를 붙인다.
--   붙이지 않으면 뷰는 **만든 사람(postgres)의 권한**으로 돌아, 뷰를 읽을 수 있는
--   사람이 밑에 깔린 표의 RLS 를 통째로 지나친다. 표만 잠그고 뷰를 안 잠그면 헛일이다.
--   (hd-project03 에서 실제로 남의 업체 실사 결과가 뷰로 그대로 보였다.
--    tests/server.test.js 의 "업체는 보고서 뷰로도 남의 자료를 볼 수 없다" 가 잡는다)
--   security_invoker 는 PostgreSQL 15 부터. Supabase 는 15 이상이다.
create or replace view public.engine_view with (security_invoker = true) as
select e.*,
       public.kw_to_ps(e.rated_power_kw) as rated_power_ps,
       (select count(*) from public.curve c where c.engine_id = e.id) as curve_points,
       (select string_agg(a.forklift_model, ', ' order by a.forklift_model)
          from public.application a where a.engine_id = e.id)          as forklift_models
from public.engine e;

-- 곡선 점이 너무 적으면 그래프가 직선으로 보인다. 조용히 넘어가지 않게 드러낸다.
create or replace view public.thin_curves with (security_invoker = true) as
select id, maker, model, curve_points
from public.engine_view
where curve_points < 5;

-- 지게차 모델로 찾기
create or replace view public.by_forklift with (security_invoker = true) as
select a.forklift_model, a.capacity_ton, e.id as engine_id, e.maker, e.model,
       e.rated_power_kw, e.max_torque_nm
from public.application a
join public.engine e on e.id = a.engine_id;

-- ----------------------------------------------------------------------------
-- 4. RLS — 읽기는 로그인 사용자, 쓰기는 관리자
-- ----------------------------------------------------------------------------

alter table public.engine      enable row level security;
alter table public.curve       enable row level security;
alter table public.application enable row level security;
alter table public.comparison  enable row level security;
alter table public.log         enable row level security;
alter table public.admin       enable row level security;

do $rls$
declare t text;
begin
  foreach t in array array['engine','curve','application']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_read',   t);
    execute format('drop policy if exists %I on public.%I', t || '_write',  t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_admin())', t || '_write', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_admin())', t || '_delete', t);
  end loop;
end;
$rls$;

-- 비교 저장은 본인이 만들고 본인이 고친다
drop policy if exists comparison_read   on public.comparison;
drop policy if exists comparison_write  on public.comparison;
drop policy if exists comparison_update on public.comparison;
drop policy if exists comparison_delete on public.comparison;
create policy comparison_read   on public.comparison for select to authenticated using (true);
create policy comparison_write  on public.comparison for insert to authenticated with check (true);
create policy comparison_update on public.comparison for update to authenticated
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());
create policy comparison_delete on public.comparison for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

drop policy if exists log_read  on public.log;
drop policy if exists log_write on public.log;
create policy log_read  on public.log for select to authenticated using (true);
create policy log_write on public.log for insert to authenticated with check (true);

drop policy if exists admin_read on public.admin;
create policy admin_read on public.admin for select to authenticated using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. 함수 실행 권한 (§3.7)
-- ----------------------------------------------------------------------------

revoke all on function public.is_admin()           from public, anon;
revoke all on function public.kw_to_ps(numeric)    from public, anon;
revoke all on function public.touch()              from public, anon;

grant execute on function public.is_admin()        to authenticated;
grant execute on function public.kw_to_ps(numeric) to authenticated;
grant execute on function public.touch()           to authenticated;

-- ----------------------------------------------------------------------------
-- 끝. 관리자 등록:
--   insert into public.admin (user_id, email)
--   select id, email from auth.users where email = '<관리자 이메일>'
--   on conflict (user_id) do nothing;
-- ----------------------------------------------------------------------------
