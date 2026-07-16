-- Real activity tracking: separate "minutes actually spent in the app" from
-- "messages sent". A client heartbeat adds minutes while the app is open and the
-- learner is active; chat/talk turns add messages. Both feed today's goal + streak.
--
-- record_activity(p_messages, p_minutes) atomically upserts today's row for the
-- current user (SECURITY DEFINER, scoped to auth.uid()). Run after 0002.

create or replace function public.record_activity(
  p_messages int default 0,
  p_minutes int default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_goal int;
  v_msg int := greatest(0, coalesce(p_messages, 0));
  v_min int := greatest(0, coalesce(p_minutes, 0));
begin
  select daily_goal_minutes into v_goal from public.settings where user_id = auth.uid();
  v_goal := coalesce(v_goal, 10);

  insert into public.daily_progress (user_id, day, messages_count, minutes_practiced, goal_minutes, goal_met)
  values (auth.uid(), current_date, v_msg, v_min, v_goal, v_min >= v_goal)
  on conflict (user_id, day) do update
    set messages_count    = public.daily_progress.messages_count + v_msg,
        minutes_practiced = public.daily_progress.minutes_practiced + v_min,
        goal_met          = (public.daily_progress.minutes_practiced + v_min)
                            >= public.daily_progress.goal_minutes;
end;
$$;

grant execute on function public.record_activity(int, int) to authenticated;
