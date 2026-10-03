drop policy if exists productions_select on public.productions;

create policy productions_select on public.productions
for select
to authenticated
using (
  (
    access_scope = 'workspace'
    and public.is_workspace_member(workspace_id)
  )
  or (
    is_template
    and template_visibility = 'public'
  )
  or exists (
    select 1
    from public.production_members pm
    where pm.production_id = productions.id
      and pm.user_id = (select auth.uid())
  )
);
