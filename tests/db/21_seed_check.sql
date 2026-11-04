do $$ begin
  assert (select count(*) from public.affiliate_link_stats where code = 'BLC-TEST') = 1, 'seed link visible in stats';
  assert (select status from public.events where slug = 'test-night-tramshed') = 'on_sale', 'seed event on sale';
end $$;
