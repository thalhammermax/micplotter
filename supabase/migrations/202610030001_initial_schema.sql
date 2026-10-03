-- MicPlotter initial collaborative schema
-- Multi-tenant workspaces + production-level collaboration + MicPlot domain model.

create extension if not exists pgcrypto;

create type public.workspace_role as enum ('owner', 'admin', 'member');
create type public.production_role as enum ('designer', 'editor', 'viewer');
create type public.workspace_kind as enum ('sound_design', 'education', 'theatre', 'personal');
create type public.production_access_scope as enum ('private', 'workspace');
create type public.template_visibility as enum ('private', 'workspace', 'public');
create type public.mic_priority as enum (
  'must',
  'nice',
  'dont',
  'variable_must',
  'variable_nice',
  'variable_dont'
);
create type public.when_miked as enum (
  'normal',
  'never',
  'always',
  'first_to_last',
  'start_to_last',
  'first_to_end'
);
create type public.mic_style as enum ('lapel', 'boom', 'handheld', 'other');
create type public.bodypack_mic_mode as enum ('one_mic_per_cast', 'one_mic_per_pack');
create type public.allocation_type as enum ('new', 'finish', 'update');
create type public.allocation_effort as enum ('rough', 'normal', 'thorough');
create type public.transmitter_count_mode as enum ('auto', 'manual');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  kind public.workspace_kind not null default 'sound_design',
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.productions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  production_company text,
  production_date date,
  micplot_version text,
  notes text,
  access_scope public.production_access_scope not null default 'workspace',
  is_template boolean not null default false,
  template_visibility public.template_visibility not null default 'private',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.production_members (
  production_id uuid not null references public.productions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.production_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (production_id, user_id)
);

create table public.cast_members (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  sort_order integer not null default 0,
  name text not null,
  abbreviation text,
  ensemble boolean not null default false,
  ensemble_priority public.mic_priority not null default 'must',
  mic_quality integer,
  when_miked public.when_miked not null default 'normal',
  mic_style public.mic_style,
  mic_colour text,
  belt_size text,
  projection text,
  vocal_range text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  sort_order integer not null default 0,
  name text not null,
  abbreviation text,
  mic_priority public.mic_priority not null default 'must',
  mic_quality integer,
  played_by_cast_id uuid references public.cast_members(id) on delete set null,
  also_plays text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.show_pages (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  sort_order integer not null default 0,
  act text,
  scene text,
  page_label text,
  is_interval boolean not null default false,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.understudies (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  sort_order integer not null default 0,
  name text not null,
  character_id uuid not null references public.characters(id) on delete cascade,
  original_cast_member_id uuid references public.cast_members(id) on delete set null,
  new_cast_member_id uuid not null references public.cast_members(id) on delete cascade,
  new_mic_cast_member_id uuid references public.cast_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.understudy_changes (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  understudy_id uuid not null references public.understudies(id) on delete cascade,
  sort_order integer not null default 0,
  character_id uuid not null references public.characters(id) on delete cascade,
  original_cast_member_id uuid references public.cast_members(id) on delete set null,
  new_cast_member_id uuid not null references public.cast_members(id) on delete cascade,
  new_mic_cast_member_id uuid references public.cast_members(id) on delete set null
);

create table public.movements (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  sort_order integer not null default 0,
  cue_id text,
  title text,
  page_id uuid references public.show_pages(id) on delete set null,
  cue text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.movement_notes (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  movement_id uuid not null references public.movements(id) on delete cascade,
  note_page smallint not null check (note_page between 1 and 3),
  heading text,
  body text,
  unique (movement_id, note_page)
);

create table public.movement_characters (
  production_id uuid not null references public.productions(id) on delete cascade,
  movement_id uuid not null references public.movements(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  priority_override public.mic_priority,
  primary key (movement_id, character_id)
);

create table public.transmitter_groups (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  sort_order integer not null default 0,
  tx_name text not null,
  mic_ids text[] not null default '{}',
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.group_members (
  production_id uuid not null references public.productions(id) on delete cascade,
  group_id uuid not null references public.transmitter_groups(id) on delete cascade,
  cast_member_id uuid not null references public.cast_members(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (group_id, cast_member_id)
);

create table public.swap_settings (
  production_id uuid primary key references public.productions(id) on delete cascade,
  handheld_swap_pages integer not null default 1 check (handheld_swap_pages >= 0),
  bodypack_mode public.bodypack_mic_mode not null default 'one_mic_per_cast',
  bodypack_swap_pages integer not null default 1 check (bodypack_swap_pages >= 0),
  lapel_boom_compatible boolean not null default true,
  lapel_mic_swap_pages integer not null default 1 check (lapel_mic_swap_pages >= 0),
  boom_mic_swap_pages integer not null default 1 check (boom_mic_swap_pages >= 0),
  updated_at timestamptz not null default now()
);

create table public.allocation_rule_sets (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  name text not null default 'Default',
  ordered_rules jsonb not null default '[]'::jsonb,
  allocation_type public.allocation_type not null default 'new',
  effort public.allocation_effort not null default 'normal',
  transmitter_count_mode public.transmitter_count_mode not null default 'auto',
  manual_transmitter_count integer check (manual_transmitter_count is null or manual_transmitter_count >= 0),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.micplots (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  name text not null default 'MicPlot',
  allocation_type public.allocation_type not null default 'new',
  is_current boolean not null default false,
  is_reference boolean not null default false,
  metrics jsonb not null default '{}'::jsonb,
  solver_metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index micplots_one_current_per_production
  on public.micplots(production_id)
  where is_current;

create table public.micplot_assignments (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  micplot_id uuid not null references public.micplots(id) on delete cascade,
  group_id uuid not null references public.transmitter_groups(id) on delete cascade,
  cast_member_id uuid not null references public.cast_members(id) on delete cascade,
  start_movement_id uuid references public.movements(id) on delete set null,
  end_movement_id uuid references public.movements(id) on delete set null,
  start_sort integer not null,
  end_sort integer not null,
  mic_id text,
  has_major_conflict boolean not null default false,
  has_minor_conflict boolean not null default false,
  check (end_sort >= start_sort)
);

create index productions_workspace_idx on public.productions(workspace_id);
create index cast_members_production_idx on public.cast_members(production_id, sort_order);
create index characters_production_idx on public.characters(production_id, sort_order);
create index show_pages_production_idx on public.show_pages(production_id, sort_order);
create index movements_production_idx on public.movements(production_id, sort_order);
create index transmitter_groups_production_idx on public.transmitter_groups(production_id, sort_order);
create index micplot_assignments_plot_idx on public.micplot_assignments(micplot_id, group_id, start_sort);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger workspaces_set_updated_at before update on public.workspaces
for each row execute function public.set_updated_at();
create trigger productions_set_updated_at before update on public.productions
for each row execute function public.set_updated_at();
create trigger cast_members_set_updated_at before update on public.cast_members
for each row execute function public.set_updated_at();
create trigger characters_set_updated_at before update on public.characters
for each row execute function public.set_updated_at();
create trigger show_pages_set_updated_at before update on public.show_pages
for each row execute function public.set_updated_at();
create trigger understudies_set_updated_at before update on public.understudies
for each row execute function public.set_updated_at();
create trigger movements_set_updated_at before update on public.movements
for each row execute function public.set_updated_at();
create trigger transmitter_groups_set_updated_at before update on public.transmitter_groups
for each row execute function public.set_updated_at();
create trigger allocation_rule_sets_set_updated_at before update on public.allocation_rule_sets
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.add_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (workspace_id, user_id) do update set role = 'owner';
  return new;
end;
$$;

create trigger on_workspace_created
after insert on public.workspaces
for each row execute function public.add_workspace_owner();

create or replace function public.add_production_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.production_members (production_id, user_id, role)
  values (new.id, new.created_by, 'designer')
  on conflict (production_id, user_id) do update set role = 'designer';

  insert into public.swap_settings (production_id)
  values (new.id)
  on conflict (production_id) do nothing;

  return new;
end;
$$;

create trigger on_production_created
after insert on public.productions
for each row execute function public.add_production_creator();

-- Permission helpers are SECURITY DEFINER so RLS policies do not recursively query themselves.
create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace
      and user_id = auth.uid()
  );
$$;

create or replace function public.can_manage_workspace(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.can_view_production(target_production uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.productions p
    where p.id = target_production
      and (
        (auth.uid() is not null and p.is_template and p.template_visibility = 'public')
        or (p.access_scope = 'workspace' and public.is_workspace_member(p.workspace_id))
        or exists (
          select 1
          from public.production_members pm
          where pm.production_id = p.id
            and pm.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.can_edit_production(target_production uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.productions p
    where p.id = target_production
      and (
        public.can_manage_workspace(p.workspace_id)
        or exists (
          select 1
          from public.production_members pm
          where pm.production_id = p.id
            and pm.user_id = auth.uid()
            and pm.role in ('designer', 'editor')
        )
      )
  );
$$;

create or replace function public.can_manage_production_access(target_production uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.productions p
    where p.id = target_production
      and (
        public.can_manage_workspace(p.workspace_id)
        or exists (
          select 1
          from public.production_members pm
          where pm.production_id = p.id
            and pm.user_id = auth.uid()
            and pm.role = 'designer'
        )
      )
  );
$$;

create or replace function public.shares_workspace(other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = other_user or exists (
    select 1
    from public.workspace_members mine
    join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = auth.uid()
      and theirs.user_id = other_user
  );
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.productions enable row level security;
alter table public.production_members enable row level security;
alter table public.cast_members enable row level security;
alter table public.characters enable row level security;
alter table public.show_pages enable row level security;
alter table public.understudies enable row level security;
alter table public.understudy_changes enable row level security;
alter table public.movements enable row level security;
alter table public.movement_notes enable row level security;
alter table public.movement_characters enable row level security;
alter table public.transmitter_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.swap_settings enable row level security;
alter table public.allocation_rule_sets enable row level security;
alter table public.micplots enable row level security;
alter table public.micplot_assignments enable row level security;

create policy profiles_select on public.profiles
for select using (public.shares_workspace(id));
create policy profiles_update on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

create policy workspaces_select on public.workspaces
for select using (public.is_workspace_member(id));
create policy workspaces_insert on public.workspaces
for insert with check (owner_id = auth.uid());
create policy workspaces_update on public.workspaces
for update using (public.can_manage_workspace(id)) with check (public.can_manage_workspace(id));
create policy workspaces_delete on public.workspaces
for delete using (owner_id = auth.uid());

create policy workspace_members_select on public.workspace_members
for select using (public.is_workspace_member(workspace_id));
create policy workspace_members_insert on public.workspace_members
for insert with check (public.can_manage_workspace(workspace_id));
create policy workspace_members_update on public.workspace_members
for update using (public.can_manage_workspace(workspace_id)) with check (public.can_manage_workspace(workspace_id));
create policy workspace_members_delete on public.workspace_members
for delete using (public.can_manage_workspace(workspace_id));

create policy productions_select on public.productions
for select using (public.can_view_production(id));
create policy productions_insert on public.productions
for insert with check (created_by = auth.uid() and public.is_workspace_member(workspace_id));
create policy productions_update on public.productions
for update using (public.can_edit_production(id)) with check (public.can_edit_production(id));
create policy productions_delete on public.productions
for delete using (public.can_manage_production_access(id));

create policy production_members_select on public.production_members
for select using (public.can_view_production(production_id));
create policy production_members_insert on public.production_members
for insert with check (public.can_manage_production_access(production_id));
create policy production_members_update on public.production_members
for update using (public.can_manage_production_access(production_id)) with check (public.can_manage_production_access(production_id));
create policy production_members_delete on public.production_members
for delete using (public.can_manage_production_access(production_id));

-- Production child tables all inherit the same read/edit boundary.
create policy cast_members_select on public.cast_members for select using (public.can_view_production(production_id));
create policy cast_members_insert on public.cast_members for insert with check (public.can_edit_production(production_id));
create policy cast_members_update on public.cast_members for update using (public.can_edit_production(production_id)) with check (public.can_edit_production(production_id));
create policy cast_members_delete on public.cast_members for delete using (public.can_edit_production(production_id));

create policy characters_select on public.characters for select using (public.can_view_production(production_id));
create policy characters_insert on public.characters for insert with check (public.can_edit_production(production_id));
create policy characters_update on public.characters for update using (public.can_edit_production(production_id)) with check (public.can_edit_production(production_id));
create policy characters_delete on public.characters for delete using (public.can_edit_production(production_id));

create policy show_pages_select on public.show_pages for select using (public.can_view_production(production_id));
create policy show_pages_insert on public.show_pages for insert with check (public.can_edit_production(production_id));
create policy show_pages_update on public.show_pages for update using (public.can_edit_production(production_id)) with check (public.can_edit_production(production_id));
create policy show_pages_delete on public.show_pages for delete using (public.can_edit_production(production_id));

create policy understudies_select on public.understudies for select using (public.can_view_production(production_id));
create policy understudies_insert on public.understudies for insert with check (public.can_edit_production(production_id));
create policy understudies_update on public.understudies for update using (public.can_edit_production(production_id)) with check (public.can_edit_production(production_id));
create policy understudies_delete on public.understudies for delete using (public.can_edit_production(production_id));

create policy understudy_changes_select on public.understudy_changes for select using (public.can_view_production(production_id));
create policy understudy_changes_insert on public.understudy_changes for insert with check (public.can_edit_production(production_id));
create policy understudy_changes_update on public.understudy_changes for update using (public.can_edit_production(production_id)) with check (public.can_edit_production(production_id));
create policy understudy_changes_delete on public.understudy_changes for delete using (public.can_edit_production(production_id));

create policy movements_select on public.movements for select using (public.can_view_production(production_id));
create policy movements_insert on public.movements for insert with check (public.can_edit_production(production_id));
create policy movements_update on public.movements for update using (public.can_edit_production(production_id)) with check (public.can_edit_production(production_id));
create policy movements_delete on public.movements for delete using (public.can_edit_production(production_id));

create policy movement_notes_select on public.movement_notes for select using (public.can_view_production(production_id));
create policy movement_notes_insert on public.movement_notes for insert with check (public.can_edit_production(production_id));
create policy movement_notes_update on public.movement_notes for update using (public.can_edit_production(production_id)) with check (public.can_edit_production(production_id));
create policy movement_notes_delete on public.movement_notes for delete using (public.can_edit_production(production_id));

create policy movement_characters_select on public.movement_characters for select using (public.can_view_production(production_id));
create policy movement_characters_insert on public.movement_characters for insert with check (public.can_edit_production(production_id));
create policy movement_characters_update on public.movement_characters for update using (public.can_edit_production(production_id)) with check (public.can_edit_production(production_id));
create policy movement_characters_delete on public.movement_characters for delete using (public.can_edit_production(production_id));

create policy transmitter_groups_select on public.transmitter_groups for select using (public.can_view_production(production_id));
create policy transmitter_groups_insert on public.transmitter_groups for insert with check (public.can_edit_production(production_id));
create policy transmitter_groups_update on public.transmitter_groups for update using (public.can_edit_production(production_id)) with check (public.can_edit_production(production_id));
create policy transmitter_groups_delete on public.transmitter_groups for delete using (public.can_edit_production(production_id));

create policy group_members_select on public.group_members for select using (public.can_view_production(production_id));
create policy group_members_insert on public.group_members for insert with check (public.can_edit_production(production_id));
create policy group_members_update on public.group_members for update using (public.can_edit_production(production_id)) with check (public.can_edit_production(production_id));
create policy group_members_delete on public.group_members for delete using (public.can_edit_production(production_id));

create policy swap_settings_select on public.swap_settings for select using (public.can_view_production(production_id));
create policy swap_settings_insert on public.swap_settings for insert with check (public.can_edit_production(production_id));
create policy swap_settings_update on public.swap_settings for update using (public.can_edit_production(production_id)) with check (public.can_edit_production(production_id));
create policy swap_settings_delete on public.swap_settings for delete using (public.can_edit_production(production_id));

create policy allocation_rule_sets_select on public.allocation_rule_sets for select using (public.can_view_production(production_id));
create policy allocation_rule_sets_insert on public.allocation_rule_sets for insert with check (public.can_edit_production(production_id));
create policy allocation_rule_sets_update on public.allocation_rule_sets for update using (public.can_edit_production(production_id)) with check (public.can_edit_production(production_id));
create policy allocation_rule_sets_delete on public.allocation_rule_sets for delete using (public.can_edit_production(production_id));

create policy micplots_select on public.micplots for select using (public.can_view_production(production_id));
create policy micplots_insert on public.micplots for insert with check (public.can_edit_production(production_id));
create policy micplots_update on public.micplots for update using (public.can_edit_production(production_id)) with check (public.can_edit_production(production_id));
create policy micplots_delete on public.micplots for delete using (public.can_edit_production(production_id));

create policy micplot_assignments_select on public.micplot_assignments for select using (public.can_view_production(production_id));
create policy micplot_assignments_insert on public.micplot_assignments for insert with check (public.can_edit_production(production_id));
create policy micplot_assignments_update on public.micplot_assignments for update using (public.can_edit_production(production_id)) with check (public.can_edit_production(production_id));
create policy micplot_assignments_delete on public.micplot_assignments for delete using (public.can_edit_production(production_id));

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
