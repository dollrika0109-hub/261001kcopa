-- =========================================================================
-- 한국저작권보호원 모의신고 훈련 · Supabase 스키마
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.
-- =========================================================================

create extension if not exists pgcrypto;

-- 접수번호 일련번호
create sequence if not exists public.mock_receipt_seq;

-- 제출 결과 테이블 (자주 쓰는 값은 컬럼으로, 전체 원본은 payload(jsonb)로 보관)
create table if not exists public.mock_reports (
  id                    uuid primary key default gen_random_uuid(),
  receipt_no            text unique not null,
  participant_name      text,
  participant_dept      text,
  category              text,          -- violation | self
  case_id               text,          -- case01 ~ case06
  form_id               text,          -- conduct | gapjil | gift | privateInterest | retiree
  first_try_correct     boolean,
  wrong_count           int default 0,
  example_viewed_count  int default 0,
  validation_fail_count int default 0,
  duration_sec          int,
  payload               jsonb not null, -- 앱이 보낸 제출 데이터 전체
  started_at            timestamptz,
  submitted_at          timestamptz default now()
);
create index if not exists mock_reports_case_idx on public.mock_reports (case_id);
create index if not exists mock_reports_submitted_idx on public.mock_reports (submitted_at desc);

-- 관리자 계정 목록 (Supabase Auth에 가입된 이메일을 여기에 추가)
create table if not exists public.admin_users (
  email text primary key
);

alter table public.mock_reports enable row level security;
alter table public.admin_users  enable row level security;

-- 관리자 여부 확인 함수
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

-- 관리자만 조회·삭제 가능 (참가자는 직접 insert/select 불가)
drop policy if exists "admin select" on public.mock_reports;
create policy "admin select" on public.mock_reports for select to authenticated using (public.is_admin());
drop policy if exists "admin delete" on public.mock_reports;
create policy "admin delete" on public.mock_reports for delete to authenticated using (public.is_admin());

-- 참가자 제출 함수: 저장 + 접수번호(YYYY-MOCK-001) 발급
create or replace function public.submit_mock_report(p jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  r text;
begin
  if p is null or p ->> 'caseId' is null or p -> 'answers' is null then
    raise exception 'invalid payload';
  end if;
  if octet_length(p::text) > 200000 then
    raise exception 'payload too large';
  end if;

  r := to_char(now() at time zone 'Asia/Seoul', 'YYYY') || '-MOCK-' || lpad(nextval('public.mock_receipt_seq')::text, 3, '0');

  insert into public.mock_reports (
    receipt_no, participant_name, participant_dept, category, case_id, form_id,
    first_try_correct, wrong_count, example_viewed_count, validation_fail_count,
    duration_sec, payload, started_at
  ) values (
    r,
    p #>> '{participant,name}',
    p #>> '{participant,dept}',
    p ->> 'category',
    p ->> 'caseId',
    p ->> 'formId',
    (p #>> '{typeSelection,firstTryCorrect}')::boolean,
    coalesce((p #>> '{typeSelection,wrongCount}')::int, 0),
    coalesce((p #>> '{behavior,exampleViewedCount}')::int, 0),
    coalesce((p #>> '{behavior,validationFailCount}')::int, 0),
    (p ->> 'durationSec')::int,
    p,
    (p ->> 'startedAt')::timestamptz
  );
  return r;
end;
$$;

revoke all on function public.submit_mock_report(jsonb) from public;
grant execute on function public.submit_mock_report(jsonb) to anon, authenticated;

-- 관리자 등록 예시 (Authentication → Users 에서 계정을 먼저 만든 뒤 실행)
-- insert into public.admin_users (email) values ('admin@example.com');
