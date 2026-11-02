\set ON_ERROR_STOP on
\ir organization-closure-fiscal-applications-fixture.sql
\ir ../migrations/20260806002000_atomic_form_b_signature_packet_sends.sql
set check_function_bodies=on;
\ir ../migrations/20261102180000_organization_closure_fiscal_signing.sql
grant select,insert,update,delete on public.fiscal_sponsorship_signature_packets,public.fiscal_sponsorship_signing_drafts,
 public.fiscal_sponsorship_signatures,public.fiscal_sponsorship_events to service_role;
create function public.fixture_closure_fiscal_signing() returns void language plpgsql as $$
begin
 perform public.fixture_closure_fiscal_applications();
 insert into public.platform_staff_members(user_id,access_level) values(public.fixture_form_id(1),'developer')
 on conflict(user_id) do update set access_level='developer';
 insert into public.organization_memberships(org_id,member_id,role)
 select public.fixture_form_id(n),public.fixture_form_id(13),'member' from generate_series(1,2) n
 on conflict(org_id,member_id) do update set role='member';
 update public.fiscal_sponsorship_documents set kind='agreement',status='sent_for_signature',storage_bucket='fiscal-signing',
 storage_path='synthetic/agreement.pdf',file_sha256=repeat('a',64),template_key='form-b',template_version=1,template_sha256=repeat('b',64);
 insert into public.fiscal_sponsorship_signature_packets(id,application_id,document_id,org_id,project_id,provider,status,sent_by,applicant_signer_id,coach_signer_id)
 select public.fixture_form_id(1700+n),public.fixture_form_id(1500+n),public.fixture_form_id(1520+n),public.fixture_form_id(n),public.fixture_form_id(1400+n),
 'native','sent',public.fixture_form_id(13),public.fixture_form_id(13),public.fixture_form_id(13) from generate_series(1,2) n;
 insert into public.fiscal_sponsorship_signing_drafts(id,packet_id,application_id,org_id,project_id,signer_id,signer_role,field_values)
 select public.fixture_form_id(1710+n),public.fixture_form_id(1700+n),public.fixture_form_id(1500+n),public.fixture_form_id(n),public.fixture_form_id(1400+n),
 public.fixture_form_id(13),'applicant','{"original":true}' from generate_series(1,2) n;
 -- A third application/document has no packet, for the actual atomic send RPC.
 update public.fiscal_sponsorship_applications set status='agreement_ready' where id=public.fixture_form_id(1601);
 insert into public.fiscal_sponsorship_documents(id,application_id,org_id,project_id,kind,title,status,storage_bucket,storage_path,file_sha256,template_key,template_version,template_sha256)
 values(public.fixture_form_id(1720),public.fixture_form_id(1601),public.fixture_form_id(1),public.fixture_form_id(1403),'agreement','Send target','generated',
 'fiscal-signing','synthetic/send.pdf',repeat('a',64),'form-b',1,repeat('b',64));
end; $$;
create function public.fixture_fiscal_send() returns jsonb language sql as $$
 select public.send_fiscal_sponsorship_form_b_transition(a.id,d.id,public.fixture_form_id(1),a.updated_at,d.updated_at,
 public.fixture_form_id(13),'Synthetic signer','synthetic@example.org','{}','form-b',1,repeat('b',64))
 from public.fiscal_sponsorship_applications a join public.fiscal_sponsorship_documents d on d.application_id=a.id where d.id=public.fixture_form_id(1720); $$;
create function public.fixture_fiscal_sign_payload(actor integer default 13) returns jsonb language sql as $$
 select jsonb_build_object('signerId',public.fixture_form_id(actor),'expectedRevision',0,'fields','{}'::jsonb,
 'fieldValuesSha256',repeat('a',64),'partialDocumentSha256',repeat('a',64),'partialSizeBytes',100,'partialStoragePath','synthetic/partial.pdf',
 'executedDocumentSha256',repeat('a',64),'executedSizeBytes',100,'executedStoragePath','synthetic/executed.pdf',
 'auditDocumentSha256',repeat('a',64),'auditSizeBytes',100,'auditStoragePath','synthetic/audit.pdf',
 'templateKey','form-b','templateSha256',repeat('b',64),'templateVersion',1,'consentSha256',repeat('c',64),'consentText','Synthetic consent',
 'consentVersion','test','signedAt',now(),'signatureMethod','typed','signatureSha256',repeat('d',64),'signatureValue','Synthetic signer',
 'signedDocumentSha256',repeat('a',64),'signerEmail','synthetic@example.org','signerName','Synthetic signer','signerTitle','Director'); $$;
create function public.fixture_fiscal_sign() returns jsonb language sql as $$
 select public.finalize_fiscal_sponsorship_applicant_signature(public.fixture_form_id(1701),public.fixture_fiscal_sign_payload()); $$;
create function public.fixture_fiscal_countersign() returns jsonb language sql as $$
 select public.finalize_fiscal_sponsorship_coach_signature(public.fixture_form_id(1701),public.fixture_fiscal_sign_payload(1)); $$;
