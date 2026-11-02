import { spawn } from "node:child_process"
import { join } from "node:path"

/** Competing PostgreSQL transactions, not mocked reservations. */
export async function testProviderExposureRaces({ run, args, postgresDirectory }) {
  const reserve = (id, org, actor) => new Promise(resolve => {
    const child = spawn(join(postgresDirectory, "psql"), args, { stdio: ["pipe", "pipe", "pipe"] })
    let error = ""
    child.stderr.on("data", chunk => { error += chunk }); child.stdout.resume()
    child.on("error", error => resolve({ code: -1, error: error.message }))
    child.on("close", code => resolve({ code, error }))
    child.stdin.end(`begin; set local role service_role;
      select public.fixture_provider_reserve(${id},${org},${actor},80000);
      select pg_sleep(0.15); commit;`)
  })
  run("psql", args, { input: `update public.ai_credit_policy set enabled=true,
    daily_provider_microdollars=1000000000,org_daily_provider_microdollars=100000,
    user_daily_credits=100000,user_hourly_runs=100000;` })
  const organization = await Promise.all([reserve(21, 1, 1), reserve(22, 1, 3)])
  if (organization.filter(result => result.code === 0).length !== 1 ||
    !organization.some(result => result.error.includes("Organization daily AI service limit reached")))
    throw new Error(`Organization exposure race failed: ${JSON.stringify(organization)}`)
  run("psql", args, { input: `
    select public.assert_ai(public.workspace_ai_provider_exposure('e1000000-0000-4000-8000-000000000001')=80000,'concurrent members reserve only one maximum');
    select public.settle_workspace_ai_run(id,'failed',40000,0,null,'{}',null) from public.workspace_ai_runs where org_id='e1000000-0000-4000-8000-000000000001';
    update public.ai_credit_policy set org_daily_provider_microdollars=1000000,
      daily_provider_microdollars=public.workspace_ai_provider_exposure(null)::bigint+100000;
  ` })
  const platform = await Promise.all([reserve(23, 1, 1), reserve(24, 2, 2)])
  if (platform.filter(result => result.code === 0).length !== 1 ||
    !platform.some(result => result.error.includes("AI daily service limit reached")))
    throw new Error(`Platform exposure race failed: ${JSON.stringify(platform)}`)
  run("psql", args, { input: `
    select public.assert_ai((select count(*)=1 from public.workspace_ai_runs where id in ('e2000000-0000-4000-8000-000000000023','e2000000-0000-4000-8000-000000000024')),'concurrent organizations cannot overspend platform cap');
    select public.assert_ai(public.workspace_ai_provider_exposure(null)<=(select daily_provider_microdollars from public.ai_credit_policy where id),'total exposure remains bounded');
    select public.assert_ai((select sum(charged_credits)=0 from public.workspace_ai_runs where org_id::text like 'e1000000-%'),'race does not create customer charges');
  ` })
}
