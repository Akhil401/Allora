-- Profile: first & last name fields (display_name is derived from them). Run after 0005.
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
