\set ON_ERROR_STOP on
\ir organization-closure-external-documents-fixture.sql
-- Restore the actual timestamp trigger omitted from the sharing prerequisite
-- (20250926140000). The existing fixture supplies handle_updated_at().
create trigger set_updated_at_organizations before update on public.organizations
 for each row execute procedure public.handle_updated_at();
\ir ../migrations/20261014160000_core_document_collaboration.sql
\ir ../migrations/20261102130000_organization_closure_core_documents.sql
-- The inherited publication helper assumed a fixed organization timestamp. Read
-- its current revision now that the actual timestamp trigger participates.
create or replace function public.fixture_form_publish(rev integer, intent text default 'publish', version_number integer default 80, actor integer default 1, tamper boolean default false) returns jsonb language plpgsql as $$
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
   (select updated_at from public.organizations where user_id=public.fixture_form_id(1)),'[]',null,null,'[]','[]',case when intent='make_private' then '[]'::jsonb else jsonb_build_array(v) end);
end; $$;
create function public.fixture_closure_core_documents() returns void language plpgsql as $$
begin
 -- Parent fixture clears closure before touching its profile/board state.
 perform public.fixture_closure_external_documents();
 truncate public.organization_core_document_versions,public.organization_core_document_sessions,public.organization_core_document_presence;
 update public.organizations set profile=jsonb_set(coalesce(profile,'{}'),'{roadmap}',
 jsonb_build_object('sections',jsonb_build_array(jsonb_build_object('id','mission','title','Mission','content','Original'))))
 where user_id in(public.fixture_form_id(1),public.fixture_form_id(2));
 -- Baseline history represents an independent author's saved revision.
 truncate public.organization_core_document_versions;
 insert into public.organization_core_document_versions(id,org_id,section_id,content,actor_id)
 select public.fixture_form_id(1200+n),public.fixture_form_id(n),'mission','{"id":"mission","title":"Mission","content":"Original"}',public.fixture_form_id(13)
 from generate_series(1,2) n;
 insert into public.organization_core_document_sessions(org_id,section_id,generation,document,section_content)
 select public.fixture_form_id(n),'mission',public.fixture_form_id(1210+n),'{"type":"doc"}','Original' from generate_series(1,2) n;
 insert into public.organization_core_document_presence(org_id,section_id,session_id,actor_id,display_name,role)
 select public.fixture_form_id(n),'mission','synthetic-presence-'||n,public.fixture_form_id(13),'Fixture author','staff' from generate_series(1,2) n;
end; $$;
create function public.fixture_core_commit(with_profile boolean default false,expected_version integer default 0) returns boolean language sql as $$
 select public.commit_core_document_session(user_id,'mission',updated_at,public.fixture_form_id(1211),expected_version,
 jsonb_build_object('generation',public.fixture_form_id(1211),'version',expected_version+1,'document',jsonb_build_object('type','doc'),
 'steps','[]'::jsonb,'section_content','Edited'),
 case when with_profile then jsonb_set(profile,'{roadmap,sections,0,content}','"Edited"') else null end)
 from public.organizations where user_id=public.fixture_form_id(1);
$$;
create function public.fixture_core_initialize() returns boolean language sql as $$
 select public.commit_core_document_session(user_id,'new-section',updated_at,null,null,
 jsonb_build_object('generation',public.fixture_form_id(1221),'version',0,'document',jsonb_build_object('type','doc'),'steps','[]'::jsonb,'section_content','New'),null)
 from public.organizations where user_id=public.fixture_form_id(1);
$$;
