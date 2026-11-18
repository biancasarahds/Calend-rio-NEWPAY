-- Calendário NewPayBank: execute este arquivo no SQL Editor do Supabase.
-- A tabela de perfis é criada automaticamente quando um usuário é criado no Auth.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'viewer' check (role in ('admin','viewer')),
  created_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null default 'interno',
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  location text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_event_range check (end_at is null or end_at >= start_at)
);

create index if not exists calendar_events_start_at_idx on public.calendar_events(start_at);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'viewer')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_calendar_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.calendar_events enable row level security;

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles
for select to authenticated
using (id = (select auth.uid()));

drop policy if exists "authenticated read events" on public.calendar_events;
create policy "authenticated read events" on public.calendar_events
for select to authenticated
using (true);

drop policy if exists "admins insert events" on public.calendar_events;
create policy "admins insert events" on public.calendar_events
for insert to authenticated
with check (public.is_calendar_admin());

drop policy if exists "admins update events" on public.calendar_events;
create policy "admins update events" on public.calendar_events
for update to authenticated
using (public.is_calendar_admin())
with check (public.is_calendar_admin());

drop policy if exists "admins delete events" on public.calendar_events;
create policy "admins delete events" on public.calendar_events
for delete to authenticated
using (public.is_calendar_admin());

-- IMPORTANTE:
-- 1) Crie os usuários no Authentication > Users do Supabase.
-- 2) Depois de criados, execute o bloco abaixo para promover somente os dois e-mails autorizados.
update public.profiles
set role = 'admin'
where lower(email) in ('bs@newpay.com', 'braz@newpay.com');

-- Para adicionar qualquer outro colaborador, crie o usuário no Auth.
-- O trigger o cadastra automaticamente como viewer (somente leitura).
