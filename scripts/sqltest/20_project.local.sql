-- 로컬 검증 전용 — hd-project06 (운영 실행 금지)
do $guard$
begin
  if exists (select 1 from pg_roles where rolname in ('supabase_admin','authenticator'))
     or exists (select 1 from pg_namespace where nspname='graphql') then
    raise exception '이 파일은 로컬 검증 전용입니다.';
  end if;
end;
$guard$;

do $t$ begin raise notice '[프로젝트] 단위 환산 · 곡선 중복 · 비교 4개 제한'; end $t$;

do $t$
declare v_r boolean;
begin
  perform public._assert_eq(public.kw_to_ps(100), 136.0::numeric, '100kW = 136.0PS');
  perform public._assert(public.kw_to_ps(null) is null, 'null 은 null');

  insert into public.engine (id, maker, model, fuel, rated_power_kw, rated_power_rpm,
                                   max_torque_nm, max_torque_rpm)
  values ('E-1','테스트엔진사','TM-100','디젤', 55, 2200, 280, 1600)
  on conflict (id) do nothing;

  perform public._assert_eq(
    (select rated_power_ps from public.engine_view where id='E-1'), 74.8::numeric,
    '뷰에서 PS 가 함께 나온다');

  -- 곡선
  insert into public.curve (engine_id, rpm, power_kw, torque_nm) values
    ('E-1', 800, 12, 150), ('E-1', 1200, 26, 210), ('E-1', 1600, 42, 280),
    ('E-1', 2000, 52, 250), ('E-1', 2200, 55, 240)
  on conflict (engine_id, rpm) do nothing;

  perform public._assert_eq(
    (select curve_points from public.engine_view where id='E-1'), 5::bigint,
    '곡선 점 5개');

  -- 같은 RPM 이 두 번 들어가면 그래프가 지그재그로 꺾인다
  v_r := false;
  begin
    insert into public.curve (engine_id, rpm, power_kw) values ('E-1', 1600, 99);
  exception when unique_violation then v_r := true;
  end;
  perform public._assert(v_r, '같은 엔진·같은 RPM 중복은 UNIQUE 가 막는다');

  -- 곡선 점이 적으면 그래프가 직선으로 보인다 — 드러나야 한다
  insert into public.engine (id, maker, model, rated_power_kw, rated_power_rpm,
                                   max_torque_nm, max_torque_rpm)
  values ('E-2','테스트엔진사','TM-200', 40, 2200, 200, 1600) on conflict (id) do nothing;
  insert into public.curve (engine_id, rpm, power_kw) values ('E-2', 1000, 20)
  on conflict (engine_id, rpm) do nothing;
  perform public._assert_eq(
    (select count(*) from public.thin_curves where id='E-2'), 1::bigint,
    '곡선 점이 5개 미만이면 별도 뷰로 드러난다');
  perform public._assert_eq(
    (select count(*) from public.thin_curves where id='E-1'), 0::bigint,
    '점이 충분한 엔진은 걸리지 않는다');

  -- 지게차 모델로 찾기
  insert into public.application (engine_id, forklift_model, capacity_ton)
  values ('E-1','30D-9','3'), ('E-1','35D-9','3.5') on conflict (engine_id, forklift_model) do nothing;
  perform public._assert_eq(
    (select engine_id from public.by_forklift where forklift_model='30D-9'), 'E-1',
    '지게차 모델명으로 엔진을 찾을 수 있다');
  perform public._assert_eq(
    (select forklift_models from public.engine_view where id='E-1'), '30D-9, 35D-9',
    '엔진 뷰에 적용 지게차 모델이 모여 나온다');

  -- 비교는 최대 4개
  v_r := false;
  begin
    insert into public.comparison (title, engine_ids)
    values ('5개 비교', array['a','b','c','d','e']);
  exception when check_violation then v_r := true;
  end;
  perform public._assert(v_r, '비교 대상 5개는 check 제약이 막는다 (화면이 4개까지)');

  v_r := false;
  begin
    insert into public.comparison (title, engine_ids) values ('빈 비교', array[]::text[]);
  exception when check_violation then v_r := true;
  end;
  perform public._assert(v_r, '빈 비교도 막는다');

  insert into public.comparison (title, engine_ids) values ('정상 비교', array['E-1','E-2']);
  perform public._assert_eq(
    (select count(*) from public.comparison where title='정상 비교'), 1::bigint,
    '1~4개 비교는 저장된다');

  -- 잘못된 값
  v_r := false;
  begin
    insert into public.engine (id, maker, model, fuel) values ('E-BAD','X','Y','수소');
  exception when check_violation then v_r := true;
  end;
  perform public._assert(v_r, '정의되지 않은 연료 표기는 check 제약이 막는다');

  v_r := false;
  begin
    insert into public.engine (id, maker, model, rated_power_kw) values ('E-BAD2','X','Y', -5);
  exception when check_violation then v_r := true;
  end;
  perform public._assert(v_r, '음수 출력은 check 제약이 막는다');

  -- 엔진을 지우면 곡선·적용모델도 함께 사라진다
  delete from public.engine where id='E-2';
  perform public._assert_eq(
    (select count(*) from public.curve where engine_id='E-2'), 0::bigint,
    '엔진을 지우면 곡선도 함께 지워진다 (고아 행이 남지 않는다)');
end $t$;

delete from public.comparison where title='정상 비교';
delete from public.engine where id in ('E-1','E-2');

do $t$ begin raise notice ''; raise notice '전부 통과했습니다.'; end $t$;
