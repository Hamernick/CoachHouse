\set ON_ERROR_STOP on
\ir workspace-sharing-documents-fixture.sql
\ir ../migrations/20261101140000_organization_form_intake.sql
alter table public.organization_workspace_boards add column updated_by uuid;
create function public.fixture_form_id(n integer) returns uuid language sql immutable as $$
 select ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
$$;
create function public.fixture_form_publish(rev integer, intent text default 'publish', version_number integer default 80, actor integer default 1, tamper boolean default false) returns jsonb language plpgsql as $$
declare definition jsonb; graph jsonb; snap jsonb; v jsonb;
begin
 definition:=jsonb_build_object('questions',jsonb_build_array(jsonb_build_object('id',public.fixture_form_id(90),'type','text','label','Name','required',true)));
 graph:=jsonb_build_object('workspaceId',public.fixture_form_id(1),'particles',jsonb_build_array(jsonb_build_object(
   'id',public.fixture_form_id(20),'type','activity','title','Sign up','data',jsonb_build_object('widget',jsonb_build_object('kind','form','definition',definition)))));
 update public.organization_workspace_boards set state=jsonb_build_object('particleGraph',graph),updated_by=public.fixture_form_id(actor);
 snap:=jsonb_build_object('version',1,'brand',jsonb_build_object('name','Community table','organizationSlug','community-table'),
   'title','Forms','description','','items',jsonb_build_array(jsonb_build_object('id',public.fixture_form_id(20),'title','Sign up','description','',
   'content',jsonb_build_object('kind','form','intakeVersionId',public.fixture_form_id(version_number),'definition',definition))));
 v:=jsonb_build_object('schemaVersion',1,'id',public.fixture_form_id(version_number),'formId',public.fixture_form_id(20),'revision',rev+1,
   'title','Sign up','description','','definition',definition);
 if tamper then v:=jsonb_set(v,'{definition,questions,0,label}','"Different"'); end if;
 return public.commit_workspace_page(public.fixture_form_id(actor),public.fixture_form_id(1),public.fixture_form_id(10),
   public.fixture_form_id(100+rev),repeat('a',64),rev,intent,
   jsonb_build_object('title','Forms','description','','particleIds',jsonb_build_array(public.fixture_form_id(20))),snap,graph,
   '2026-10-16T18:30:00Z','[]',null,null,'[]','[]',case when intent='make_private' then '[]'::jsonb else jsonb_build_array(v) end);
end; $$;
create function public.fixture_form_command(action text,actor integer default null,patch jsonb default '{}') returns jsonb language sql as $$
 select public.organization_form_intake(case when actor is null then null else public.fixture_form_id(actor) end,
   jsonb_build_object('action',action,'versionId',public.fixture_form_id(80),'audience','public',
     'id',public.fixture_form_id(91),'hash',repeat('a',64),'operationId',public.fixture_form_id(92),'expectedRevision',1,
     'questionId',public.fixture_form_id(90),'answers',jsonb_build_array(jsonb_build_object('questionId',public.fixture_form_id(90),'value','Joan')),
     'version',(select version from public.organization_form_versions where id=public.fixture_form_id(80)))||patch);
$$;
