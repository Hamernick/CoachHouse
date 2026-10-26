insert into public.profiles values('11111111-1111-4111-8111-111111111111');
insert into public.organizations(user_id,profile,updated_at) values('11111111-1111-4111-8111-111111111111','{"name":"Keep","roadmap":{"sections":[{"id":"mission_vision_values","content":"Original"}]}}','2026-10-26T00:00:00Z');
insert into public.subscriptions(user_id,status,metadata,stripe_subscription_id) values('11111111-1111-4111-8111-111111111111','active','{"plan_tier":"organization"}','sub_paid');
insert into public.classes values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
insert into public.modules values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
insert into public.module_assignments values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{"fields":[{"name":"mission","type":"long_text"}]}',true,'2026-10-26T00:00:00Z');
