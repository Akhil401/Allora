-- Progress tracking helper: atomically upsert today's practice row for the
-- current user. SECURITY DEFINER so it can write regardless of RLS, but it
-- always scopes to auth.uid(). Run after 0001_init.sql.

create or replace function public.bump_daily_progress(p_minutes int default 1)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_goal int;
begin
  select daily_goal_minutes into v_goal from public.settings where user_id = auth.uid();
  v_goal := coalesce(v_goal, 10);

  insert into public.daily_progress (user_id, day, messages_count, minutes_practiced, goal_minutes, goal_met)
  values (auth.uid(), current_date, 1, p_minutes, v_goal, p_minutes >= v_goal)
  on conflict (user_id, day) do update
    set messages_count = public.daily_progress.messages_count + 1,
        minutes_practiced = public.daily_progress.minutes_practiced + p_minutes,
        goal_met = (public.daily_progress.minutes_practiced + p_minutes)
                   >= public.daily_progress.goal_minutes;
end;
$$;

grant execute on function public.bump_daily_progress(int) to authenticated;
