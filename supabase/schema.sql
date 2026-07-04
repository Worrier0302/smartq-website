-- =====================================================================
--  Smart Q — 数据库 Schema + 编号生成 + RLS + Staff 安全视图
--  一次性贴进 Supabase → SQL Editor → Run。可重复运行（幂等）。
--  Postgres 15 (Supabase)。所有金额 numeric(12,2)。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. 扩展
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- 1. 表结构
-- ---------------------------------------------------------------------

-- 用户与角色
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  role text not null default 'staff' check (role in ('owner','staff')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 客户
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address_line1 text,
  address_line2 text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 判包商（成本来源 —— staff 完全不可读）
create table if not exists subcontractors (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_person text,
  phone text,
  email text,
  trade text,                 -- 专长，如 木工/石材/电工
  address text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 工程
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  code text unique,           -- P-YYMM-XX 自动生成
  name text not null,
  client_id uuid references clients(id) on delete restrict,
  site_address text,
  status text default 'quoting'
    check (status in ('quoting','confirmed','in_progress','completed','cancelled')),
  completion_date date,       -- 用于 DLP 计算
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 单据（统一管所有类型，用 type 区分）
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  doc_no text unique,         -- Q-YYMM-XX / INV-... / RCPT-... / DO-... / PO-...
  type text not null check (type in
    ('quotation','invoice','receipt','delivery_order','purchase_order','subcon_quote')),
  project_id uuid references projects(id) on delete cascade,
  subcontractor_id uuid references subcontractors(id),  -- 仅 PO 用
  status text default 'draft',
  issue_date date default current_date,
  valid_until date,           -- quotation 14 天
  due_date date,              -- invoice
  discount numeric(12,2) default 0,
  markup_mode text default 'global' check (markup_mode in ('global','line','manual')),
  global_markup_pct numeric(5,2) default 35,   -- staff 不可读
  notes text,
  -- 条款快照（开单时从模板复制进来，之后可单独改）
  terms_included text,
  terms_excluded text,
  terms_dlp text,
  terms_conditions text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 明细行（系统核心）
create table if not exists line_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  section_name text not null,          -- 工种名，任意，如「木工 Carpentry」
  section_order int default 0,         -- section 排序 -> 生成 A/B/C
  line_order int default 0,
  description text,
  dimension text,
  qty numeric(10,2) default 1,
  cost numeric(12,2) default 0,        -- 判包成本（机密，staff 不可见）
  markup_pct numeric(5,2),             -- 逐行加成，null 则用整单
  manual_price numeric(12,2),          -- 手动定价覆盖，null 则计算
  subcontractor_id uuid references subcontractors(id),  -- 这行来自哪个判包商
  created_at timestamptz default now()
);

-- 付款时程
create table if not exists payment_schedules (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  stage_name text not null,       -- 订金/进度1/进度2/保留金
  pct numeric(5,2) not null,
  condition_text text,            -- 「材料送达」等
  stage_order int default 0
);

-- 实际收款记录（用于自动算已付/结余）
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  document_id uuid references documents(id),
  amount numeric(12,2) not null,
  method text,                    -- 转账/现金
  bank_ref text,
  paid_at date default current_date,
  stage_name text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- 条款默认模板（开新报价时自动带出）
create table if not exists term_templates (
  id uuid primary key default gen_random_uuid(),
  name text default 'Default',
  included text,
  excluded text,
  dlp text,
  conditions text,
  payment_stages jsonb,           -- 默认付款阶段
  is_default boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 单据编号计数器（供 next_doc_no 使用，按 前缀+年月 递增）
create table if not exists doc_counters (
  prefix text not null,
  yymm text not null,
  last_no int not null default 0,
  primary key (prefix, yymm)
);

-- ---------------------------------------------------------------------
-- 2. Helper 函数
-- ---------------------------------------------------------------------

-- 读当前用户角色（供所有 policy 使用）
create or replace function auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

-- 生成单据编号：{PREFIX}-{YYMM}-{两位流水号}，同前缀同月递增
create or replace function next_doc_no(p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yymm text := to_char(now() at time zone 'Asia/Kuala_Lumpur', 'YYMM');
  v_no int;
begin
  insert into doc_counters(prefix, yymm, last_no)
  values (p_prefix, v_yymm, 1)
  on conflict (prefix, yymm)
    do update set last_no = doc_counters.last_no + 1
  returning last_no into v_no;
  return p_prefix || '-' || v_yymm || '-' || lpad(v_no::text, 2, '0');
end;
$$;

-- 新 auth 用户 -> 自动建 profile（默认 staff，稍后手动升 owner）
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'staff'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 强制成本隐私：staff 写 line_items 时，成本相关列一律被忽略/保留
create or replace function enforce_line_item_cost_privacy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 机密列：cost / markup_pct / subcontractor_id
  -- manual_price（客户价）不是机密，staff 报价时要能填，故不剥离
  if coalesce(auth_role(), 'staff') <> 'owner' then
    if TG_OP = 'INSERT' then
      new.cost := 0;
      new.markup_pct := null;
      new.subcontractor_id := null;
    elsif TG_OP = 'UPDATE' then
      new.cost := old.cost;
      new.markup_pct := old.markup_pct;
      new.subcontractor_id := old.subcontractor_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_line_item_cost_privacy on line_items;
create trigger trg_line_item_cost_privacy
  before insert or update on line_items
  for each row execute function enforce_line_item_cost_privacy();

grant execute on function auth_role() to authenticated;
grant execute on function next_doc_no(text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. 启用 RLS
-- ---------------------------------------------------------------------
alter table profiles          enable row level security;
alter table clients           enable row level security;
alter table subcontractors    enable row level security;
alter table projects          enable row level security;
alter table documents         enable row level security;
alter table line_items        enable row level security;
alter table payment_schedules enable row level security;
alter table payments          enable row level security;
alter table term_templates    enable row level security;
alter table doc_counters      enable row level security;  -- 无 policy = 全拒（仅 definer 函数可访问）

-- ---------------------------------------------------------------------
-- 4. Policies
-- ---------------------------------------------------------------------

-- ---- profiles：本人可读改自己；owner 可读改全部 ----
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or auth_role() = 'owner');
drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update to authenticated
  using (id = auth.uid() or auth_role() = 'owner')
  with check (id = auth.uid() or auth_role() = 'owner');
drop policy if exists profiles_insert on profiles;
create policy profiles_insert on profiles for insert to authenticated
  with check (auth_role() = 'owner' or id = auth.uid());

-- ---- clients：owner + staff 全读写 ----
drop policy if exists clients_all on clients;
create policy clients_all on clients for all to authenticated
  using (true) with check (true);

-- ---- subcontractors：owner ONLY（staff 完全不可读写）----
drop policy if exists subs_all on subcontractors;
create policy subs_all on subcontractors for all to authenticated
  using (auth_role() = 'owner') with check (auth_role() = 'owner');

-- ---- projects：owner + staff 全读写 ----
drop policy if exists projects_all on projects;
create policy projects_all on projects for all to authenticated
  using (true) with check (true);

-- ---- documents：owner 全部；staff 看不到 PO / subcon_quote ----
drop policy if exists documents_select on documents;
create policy documents_select on documents for select to authenticated
  using (auth_role() = 'owner' or type not in ('purchase_order','subcon_quote'));
drop policy if exists documents_insert on documents;
create policy documents_insert on documents for insert to authenticated
  with check (auth_role() = 'owner' or type not in ('purchase_order','subcon_quote'));
drop policy if exists documents_update on documents;
create policy documents_update on documents for update to authenticated
  using (auth_role() = 'owner' or type not in ('purchase_order','subcon_quote'))
  with check (auth_role() = 'owner' or type not in ('purchase_order','subcon_quote'));
drop policy if exists documents_delete on documents;
create policy documents_delete on documents for delete to authenticated
  using (auth_role() = 'owner' or type not in ('purchase_order','subcon_quote'));

-- ---- line_items：SELECT 仅 owner（成本机密）；staff 通过 line_items_staff 视图读 ----
-- 写入允许（staff 由 trigger 剥离成本列）
drop policy if exists line_items_select on line_items;
create policy line_items_select on line_items for select to authenticated
  using (auth_role() = 'owner');
drop policy if exists line_items_insert on line_items;
create policy line_items_insert on line_items for insert to authenticated
  with check (true);
drop policy if exists line_items_update on line_items;
create policy line_items_update on line_items for update to authenticated
  using (true) with check (true);
drop policy if exists line_items_delete on line_items;
create policy line_items_delete on line_items for delete to authenticated
  using (true);

-- ---- payment_schedules：owner + staff 全读写 ----
drop policy if exists pay_sched_all on payment_schedules;
create policy pay_sched_all on payment_schedules for all to authenticated
  using (true) with check (true);

-- ---- payments：owner + staff 全读写 ----
drop policy if exists payments_all on payments;
create policy payments_all on payments for all to authenticated
  using (true) with check (true);

-- ---- term_templates：staff 可读（开单要带出条款）；仅 owner 可写 ----
drop policy if exists terms_select on term_templates;
create policy terms_select on term_templates for select to authenticated
  using (true);
drop policy if exists terms_write on term_templates;
create policy terms_write on term_templates for all to authenticated
  using (auth_role() = 'owner') with check (auth_role() = 'owner');

-- ---------------------------------------------------------------------
-- 5. Staff 安全视图（SECURITY DEFINER —— 只暴露安全列 + 算好的客户价）
-- ---------------------------------------------------------------------

-- 明细行的 staff 视图：无 cost / markup / manual_price / subcontractor_id
create or replace view line_items_staff
with (security_invoker = off) as
  select
    li.id,
    li.document_id,
    li.section_name,
    li.section_order,
    li.line_order,
    li.description,
    li.dimension,
    li.qty,
    coalesce(
      li.manual_price,
      round(li.cost * (1 + coalesce(li.markup_pct, d.global_markup_pct) / 100.0), 2)
    ) as client_price
  from line_items li
  join documents d on d.id = li.document_id
  where d.type not in ('purchase_order','subcon_quote');

-- 单据的 staff 视图：不含 global_markup_pct，且过滤掉 PO / subcon_quote
create or replace view documents_staff
with (security_invoker = off) as
  select
    d.id, d.doc_no, d.type, d.project_id, d.status,
    d.issue_date, d.valid_until, d.due_date, d.discount,
    d.notes, d.terms_included, d.terms_excluded, d.terms_dlp,
    d.terms_conditions, d.created_by, d.created_at, d.updated_at
  from documents d
  where d.type not in ('purchase_order','subcon_quote');

grant select on line_items_staff to authenticated;
grant select on documents_staff to authenticated;

-- ---------------------------------------------------------------------
-- 6. 默认条款模板（种子数据，仅当空表时插入）
-- ---------------------------------------------------------------------
insert into term_templates (name, included, excluded, dlp, conditions, payment_stages, is_default)
select
  'Default',
  '免费送货到工地（Taman Pelangi Indah / Ulu Tiram 一带）
现场专业安装
工艺享 6 个月 DLP 保固（自完工日起）',
  '石英石 / 烧结石台面（如需另行报价）
水电、泥水、瓷砖工程（其他工种）
家电（烤箱、炉具、冰箱、抽油烟机等）
拉篮、升降架或配件（除非特别注明）',
  '木工 / 电工 / 石材 / 铝工：完工起 6 个月
油漆：完工起 3 个月
仅限工艺瑕疵，不含自然损耗、误用或第三方改动',
  '1. 有效期 — 因全球市场价格波动，本报价自发出日起 14 天内有效。
2. 范围 — 依所提供之设计报价，确认后如有变更，须另立变更单 (VO) 追加费用。
3. 付款 — 转账至 Hong Leong Bank (37800097539)，Smart HQME Solution Enterprise。逾期超过 7 天，每月加收 1.5% 利息。
4. 材料 — 视库存供应而定，同等级替代品须经客户事先同意。
5. 保固 — 工艺瑕疵责任期见上（DLP）。
6. 终止 — 任一方可提前 7 天书面通知终止，客户须支付已完成工作及已订材料费用。
7. 接受 — 收到订金或签署确认书即视为接受本报价。',
  '[
    {"stage_name":"订金 Deposit","pct":30,"condition_text":"确认报价后"},
    {"stage_name":"进度 1 Progress","pct":40,"condition_text":"材料送达工地"},
    {"stage_name":"进度 2 Progress","pct":25,"condition_text":"完成 80% 工程"},
    {"stage_name":"保留金 Retention","pct":5,"condition_text":"交付后 7 天"}
  ]'::jsonb,
  true
where not exists (select 1 from term_templates);

-- =====================================================================
--  完成。运行后，请手动把你自己的账号升级为 owner：
--
--    update profiles set role = 'owner'
--    where id = (select id from auth.users where email = 'YOUR_EMAIL');
--
--  （先在 Supabase → Authentication → Users 用邮箱+密码创建你的账号，
--    on_auth_user_created 触发器会自动建 profile，然后跑上面这句升 owner。）
-- =====================================================================
