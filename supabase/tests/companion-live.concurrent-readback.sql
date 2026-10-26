do $$ begin
 if (select revision from public.companion_assignment_drafts) <> 2 then raise exception 'simultaneous retry reapplied draft'; end if;
 if (select count(*) from public.companion_mutation_receipts where action='save_draft') <> 2 then raise exception 'draft receipt count wrong'; end if;
 if (select count(*) from public.companion_mutation_receipts where action='save_document') <> 1 then raise exception 'document receipt count wrong'; end if;
 if (select profile->>'name' from public.organizations) <> 'Native edit' then raise exception 'native name overwritten'; end if;
 if (select profile#>>'{roadmap,sections,0,content}' from public.organizations) <> '<p>Reviewed</p>' then raise exception 'reviewed content lost'; end if;
end $$;
