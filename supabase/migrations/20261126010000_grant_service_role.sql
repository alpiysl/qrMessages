-- New hosted projects no longer auto-grant table access to Data API roles.
-- The server uses service_role only; anon/authenticated stay without access.
grant usage on schema public to service_role;
grant select, insert, update, delete on public.keychains, public.messages, public.message_views, public.feedback
  to service_role;
grant usage, select on all sequences in schema public to service_role;
