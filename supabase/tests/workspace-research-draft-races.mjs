import { spawn } from "node:child_process"
import { join } from "node:path"

export async function testResearchDraftRace({ run, args, postgresDirectory }) {
  run("psql", args, { input: `insert into public.workspace_ai_runs(id,org_id,actor_id,request_hash,task,target,prompt,tariff,max_credits,max_provider_microdollars,status,proposal,charged_credits,provider_microdollars,settled_at)
    values('83000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',repeat('f',64),'plan','{"kind":"particle_research"}','fixture','{}',10,100,'succeeded','{}',0,0,now());` })
  const save = suffix => new Promise(resolve => {
    const child = spawn(join(postgresDirectory, "psql"), args, { stdio: ["pipe", "pipe", "pipe"] })
    let error = ""
    child.stderr.on("data", chunk => { error += chunk }); child.stdout.resume()
    child.on("error", error => resolve({ code: -1, error: error.message }))
    child.on("close", code => resolve({ code, error }))
    child.stdin.end(`begin; set local role service_role;
      select public.access_workspace_research_draft('83000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',repeat('a',64),'83000000-0000-4000-8000-00000000000${suffix}',0,'{"title":"Tab ${suffix}"}',false);
      select pg_sleep(0.15); commit;`)
  })
  const results = await Promise.all([save(2), save(3)])
  if (results.filter(result => result.code === 0).length !== 1 || !results.some(result => result.error.includes("Draft revision changed")))
    throw new Error(`Draft race failed: ${JSON.stringify(results)}`)
  run("psql", args, { input: `select public.assert_ai((select count(*)=1 and min(revision)=1 from public.workspace_research_drafts where run_id='83000000-0000-4000-8000-000000000001'),'only one competing draft saved');` })
}
