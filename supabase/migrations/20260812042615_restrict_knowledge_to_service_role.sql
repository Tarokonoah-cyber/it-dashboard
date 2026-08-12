-- Knowledge is internal-only. Browser roles must not be able to reach these
-- tables through the Supabase Data API; access is mediated by the authenticated
-- Next.js server API using the service_role credential.
revoke all privileges on table public.knowledge_articles from anon, authenticated;
revoke all privileges on table public.knowledge_steps from anon, authenticated;
revoke all privileges on table public.knowledge_assets from anon, authenticated;

drop policy if exists "Allow public read published knowledge articles"
  on public.knowledge_articles;
drop policy if exists "Allow public read published knowledge steps"
  on public.knowledge_steps;
drop policy if exists "Allow public read published knowledge assets"
  on public.knowledge_assets;

notify pgrst, 'reload schema';
