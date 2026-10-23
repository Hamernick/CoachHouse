-- Fiscal projects must satisfy the existing project option-settings constraint.
-- Preserve the installed function bodies, owners, grants and security settings;
-- change only the one invalid options literal in each intake function.
-- Rollback: restore the saved pre-migration function definitions. This restores
-- the intake failure; never remove or weaken the project constraint instead.
do $patch$
declare
  v_signature text;
  v_function regprocedure;
  v_definition text;
  v_seen boolean := false;
  v_old text := $old$'{"fiscalSponsorshipEnabled":true}'$old$;
  v_new text := $new$'{"tags":[],"sprintTypes":[],"fiscalSponsorshipEnabled":true}'$new$;
begin
  foreach v_signature in array array[
    'public.submit_guest_fiscal_application(text,jsonb)',
    'public.start_public_fiscal_intake(text)'
  ] loop
    v_function := to_regprocedure(v_signature);
    -- Isolated test/recovery schemas can contain only one intake variant.
    if v_function is null then continue; end if;
    v_seen := true;
    v_definition := pg_get_functiondef(v_function);
    if strpos(v_definition, v_old) = 0 then
      if strpos(v_definition, v_new) > 0 then continue; end if;
      raise exception 'Fiscal project options require manual review: %', v_signature;
    end if;
    if length(v_definition) - length(replace(v_definition, v_old, '')) <> length(v_old) then
      raise exception 'Ambiguous fiscal project options: %', v_signature;
    end if;
    execute replace(v_definition, v_old, v_new);
  end loop;
  if not v_seen then raise exception 'No fiscal intake functions installed'; end if;
end
$patch$;
