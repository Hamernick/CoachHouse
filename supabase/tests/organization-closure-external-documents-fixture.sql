\set ON_ERROR_STOP on
\ir organization-closure-documents-fixture.sql
-- Replace the sharing fixture's minimal reference stub only in this disposable DB.
drop table public.organization_external_documents;
\ir ../migrations/20260831203000_add_google_drive_documents.sql
-- Minimal project dependencies and activity sink with the actual retained FK /
-- constraint shape (20260716203000, amended by 20260806009000). The document
-- activity functions/triggers below are the production migrations, not mocks.
create table public.organization_projects(id uuid primary key);
create table public.organization_project_assets(id uuid primary key,org_id uuid,project_id uuid);
create table public.organization_project_activity_events(
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null references public.organizations(user_id) on delete cascade,
 project_id uuid references public.organization_projects(id) on delete set null,
 entity_type text not null,entity_id uuid not null,event_type text not null,title text not null,
 from_status text,to_status text,actor_id uuid references public.profiles(id) on delete set null,
 metadata jsonb not null default '{}',occurred_at timestamptz not null default timezone('utc',now()),
 constraint organization_project_activity_events_entity_type_check check(entity_type in ('project','task','program','fiscal_application')),
 constraint organization_project_activity_events_event_type_check check(event_type in ('created','status_changed','scheduled','published','completed','updated','deleted')),
 constraint organization_project_activity_events_title_check check(char_length(trim(title)) between 1 and 240),
 constraint organization_project_activity_events_metadata_check check(jsonb_typeof(metadata)='object')
);
create function auth.role() returns text language sql stable as $$ select current_setting('role',true); $$;
\ir ../migrations/20260919194000_record_organization_document_activity.sql
\ir ../migrations/20260921002000_preserve_document_activity_actor.sql
set check_function_bodies=on;
\ir ../migrations/20261102120000_organization_closure_external_documents.sql
create function public.fixture_closure_external_documents() returns void language plpgsql as $$
begin
 truncate public.organization_external_documents,public.google_drive_connections,public.google_drive_oauth_intents,public.organization_project_activity_events;
 perform public.fixture_closure_documents();
 insert into auth.users values(public.fixture_form_id(13),'person13@example.org',now()) on conflict do nothing;
 insert into public.profiles(id,role) values(public.fixture_form_id(13),'member') on conflict do nothing;
 insert into public.google_drive_connections(id,user_id,google_subject,google_email,refresh_token_ciphertext,refresh_token_iv,refresh_token_auth_tag,key_version)
 values(public.fixture_form_id(1110),public.fixture_form_id(12),'synthetic-subject','synthetic@example.org',
 'synthetic-ciphertext','synthetic-iv','synthetic-tag','synthetic-version');
 insert into public.organization_external_documents(id,org_id,provider_file_id,connection_id,name,mime_type,web_view_link,attached_by)
 select public.fixture_form_id(1100+n),public.fixture_form_id(n),'syntheticDriveFile'||n,public.fixture_form_id(1110),
 'External file','application/vnd.google-apps.document','https://docs.google.com/document/d/syntheticDriveFile'||n||'/edit',public.fixture_form_id(13)
 from generate_series(1,2) n;
end; $$;
create function public.fixture_drive_disconnect() returns void language sql as $$
 update public.google_drive_connections set status='disconnected',refresh_token_ciphertext=null,refresh_token_iv=null,refresh_token_auth_tag=null,key_version=null,disconnected_at=now()
 where id=public.fixture_form_id(1110);
$$;
create function public.fixture_drive_reconnect() returns void language sql as $$
 update public.google_drive_connections set status='connected',refresh_token_ciphertext='synthetic-ciphertext',refresh_token_iv='synthetic-iv',refresh_token_auth_tag='synthetic-tag',key_version='synthetic-version'
 where id=public.fixture_form_id(1110);
$$;
create function public.fixture_external_reattach() returns void language sql as $$
 insert into public.organization_external_documents(org_id,provider_file_id,connection_id,name,mime_type,web_view_link,attached_by)
 values(public.fixture_form_id(1),'syntheticDriveFile1',public.fixture_form_id(1110),'Reattached','application/vnd.google-apps.document','https://docs.google.com/document/d/syntheticDriveFile1/edit',public.fixture_form_id(13))
 on conflict(org_id,provider,provider_file_id) do update set connection_id=excluded.connection_id,name=excluded.name,status='available',last_verified_at=now();
$$;
