-- Collaboration invitations for shared sound-design and education workspaces.

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role public.workspace_role not null default 'member',
  production_id uuid references public.productions(id) on delete cascade,
  production_role public.production_role,
  token uuid not null unique default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (production_id is null and production_role is null)
    or
    (production_id is not null and production_role is not null)
  )
);

create index workspace_invitations_workspace_idx
  on public.workspace_invitations(workspace_id, created_at desc);

alter table public.workspace_invitations enable row level security;

create policy workspace_invitations_select on public.workspace_invitations
for select using (public.can_manage_workspace(workspace_id));

create policy workspace_invitations_insert on public.workspace_invitations
for insert with check (
  public.can_manage_workspace(workspace_id)
  and created_by = auth.uid()
  and (
    production_id is null
    or public.can_manage_production_access(production_id)
  )
);

create policy workspace_invitations_update on public.workspace_invitations
for update using (public.can_manage_workspace(workspace_id))
with check (public.can_manage_workspace(workspace_id));

create policy workspace_invitations_delete on public.workspace_invitations
for delete using (public.can_manage_workspace(workspace_id));

create or replace function public.accept_workspace_invitation(invite_token uuid)
returns table (workspace_id uuid, production_id uuid)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  invitation public.workspace_invitations%rowtype;
  signed_in_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into invitation
  from public.workspace_invitations
  where token = invite_token
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  if invitation.accepted_at is not null then
    raise exception 'Invitation has already been accepted';
  end if;

  if invitation.expires_at <= now() then
    raise exception 'Invitation has expired';
  end if;

  select lower(email)
  into signed_in_email
  from auth.users
  where id = auth.uid();

  if signed_in_email is null or signed_in_email <> lower(invitation.email) then
    raise exception 'This invitation belongs to a different email address';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (invitation.workspace_id, auth.uid(), invitation.role)
  on conflict (workspace_id, user_id)
  do update set role = excluded.role;

  if invitation.production_id is not null then
    insert into public.production_members (production_id, user_id, role)
    values (invitation.production_id, auth.uid(), invitation.production_role)
    on conflict (production_id, user_id)
    do update set role = excluded.role;
  end if;

  update public.workspace_invitations
  set accepted_at = now(),
      accepted_by = auth.uid()
  where id = invitation.id;

  return query
  select invitation.workspace_id, invitation.production_id;
end;
$$;

grant execute on function public.accept_workspace_invitation(uuid) to authenticated;
