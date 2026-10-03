create or replace function public.micplotter_alpha_id(position_number integer)
returns text
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  n integer := position_number;
  result text := '';
begin
  if n <= 0 then
    return '';
  end if;

  while n > 0 loop
    n := n - 1;
    result := chr(65 + (n % 26)) || result;
    n := n / 26;
  end loop;

  return result;
end;
$$;

create or replace function public.sync_transmitter_group_mic_ids(target_group uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.transmitter_groups
  set mic_ids = coalesce(
    (
      select array_agg(public.micplotter_alpha_id(member_position) order by member_position)
      from (
        select row_number() over (
          order by gm.sort_order, gm.cast_member_id
        )::integer as member_position
        from public.group_members gm
        where gm.group_id = target_group
      ) ordered_members
    ),
    '{}'::text[]
  )
  where id = target_group;
end;
$$;

create or replace function public.sync_mic_ids_after_group_member_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_transmitter_group_mic_ids(old.group_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.group_id is distinct from new.group_id then
    perform public.sync_transmitter_group_mic_ids(old.group_id);
  end if;

  perform public.sync_transmitter_group_mic_ids(new.group_id);
  return new;
end;
$$;

drop trigger if exists group_members_sync_mic_ids on public.group_members;

create trigger group_members_sync_mic_ids
after insert or update or delete on public.group_members
for each row
execute function public.sync_mic_ids_after_group_member_change();

do $$
declare
  group_record record;
begin
  for group_record in select id from public.transmitter_groups loop
    perform public.sync_transmitter_group_mic_ids(group_record.id);
  end loop;
end;
$$;

revoke all on function public.sync_transmitter_group_mic_ids(uuid) from public;
revoke all on function public.sync_mic_ids_after_group_member_change() from public;
