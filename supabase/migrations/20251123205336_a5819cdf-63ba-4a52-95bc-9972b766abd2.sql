-- Dodaj nową politykę SELECT dla transactions - ekonomowie widzą transakcje swojej lokalizacji
create policy "Ekonomowie widzą transakcje swojej lokalizacji dla prognoz"
  on public.transactions
  for select
  using (
    (get_user_role() = 'ekonom' and location_id = get_user_location_id())
    or (get_user_role() = any (array['admin'::text, 'prowincjal'::text]))
  );

-- Popraw politykę UPDATE dla budget_plans - ekonom może zmienić status z draft na submitted
drop policy if exists "Ekonomowie mogą edytować budżety draft swojej lokalizacji" on public.budget_plans;

create policy "Ekonomowie mogą edytować budżety draft swojej lokalizacji"
  on public.budget_plans
  for update
  using (
    (
      get_user_role() = 'ekonom'
      and location_id = get_user_location_id()
      and status = 'draft'
    )
    or get_user_role() = any (array['admin'::text, 'prowincjal'::text])
  )
  with check (
    (
      get_user_role() = 'ekonom'
      and location_id = get_user_location_id()
      and status in ('draft', 'submitted')
    )
    or get_user_role() = any (array['admin'::text, 'prowincjal'::text])
  );