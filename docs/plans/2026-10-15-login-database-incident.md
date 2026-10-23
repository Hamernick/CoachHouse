# Login failures and database saturation — October 15, 2026

## Scope and conclusion

Investigate reported login failures for Joel and Kim Peterson. Preserve the
underlying evidence, distinguish the failure mechanism from the trigger, and
reduce demonstrated support/document background load. Do not broaden into a
platform redesign or claim that a code change alone resolves provider saturation.

Confirmed: PostgreSQL queries became slow, Auth requests failed, and PostgreSQL
later rejected Auth connections with SQLSTATE53300. Connection exhaustion is a
confirmed failure mechanism, not proof of the initial cause. The affected users'
individual attempts have not been correlated to account IDs; their initial
account lookup also timed out.

## Observed timeline

Times below are October15 EDT; provider timestamps are UTC, four hours ahead.
The inspected historical interval began at14:00UTC. Counts are log events, not
unique people, and repeated timeout events can share a request ID.

| Time | Raw evidence | Interpretation |
| --- | --- | --- |
| 11:35:51 | Postgres `57014`, organizations query canceled by statement timeout | Earliest observed database timeout in this inspected interval |
| 11:38:06 | `search_workspace_support_organizations_v2` statement timeout | Support search also affected |
| 11:38:47 | Auth `/user`, `504 request_timeout` | Authentication degradation precedes connection exhaustion |
| 11:50–12:05 | Gateway logs:2021 successful `/auth/v1/user` calls;597 successful and55failed support-heartbeat RPC requests | Auth count covers all app activity; it is not wholly attributed to support |
| 12:05–12:09 | System queries took11.96–14.58seconds, including a `pg_settings` lookup | Broad database slowdown; not isolated to one customer query |
| 12:13:11–12:16:26 |28 Postgres53300events; `supabase_auth_admin` denied remaining connection slots, then “too many clients” | Auth could not obtain database connections |
| 12:53–12:57 | Password token requests failed500/504; could not start transactions/connect to local Postgres | Login failure mechanism confirmed |
| 13:27–13:34 | Vercel `AuthRetryableFetchError`, status504 on login/workspace/admin | Application-facing impact persisted |
| Approximately13:39 | Bounded activity query failed after15.3seconds with Management API544; metrics scrape also timed out | Pre-restart live session/lock/compute inventory unavailable |
| 13:43:59 | Management API `RESIZING`; Caleb confirmed accepting the dashboard upgrade | User initiated Nano-to-Micro resize/restart |
| 13:54:00 | Management API `ACTIVE_HEALTHY`; diagnostic query returned in211ms | Backend responsiveness recovered; not a user-login verification |
| 13:54:38 | Live session inventory returned; max_connections60; most client sessions idle, no lock waits in this snapshot | Post-restart observation cannot reconstruct pre-restart connection owners |

Infrastructure UI before the resize showed Nano/t4g.nano, up to0.5GB RAM,
database2.5GB, disk36%, memory72%. Its compute card displayed CPU91% while the
infrastructure diagram displayed64%; these summaries are not an incident-aligned
CPU time series. The detailed historical charts were unavailable. Treat resource
pressure as a hypothesis, not a measured peak or an out-of-memory finding.
Micro was offered at the same displayed hourly/monthly cost with1GB RAM. [Supabase compute documentation](https://supabase.com/docs/guides/platform/compute-and-disk) confirms paid-plan Nano and Micro have the same compute price and resizing incurs downtime. Caleb
performed the production change. No agent-issued restart, resize, query
cancellation, grant edit, credential change, or schema change occurred.

## Competing explanations

| Explanation | Evidence for it | Missing discriminator |
| --- | --- | --- |
| Compute pressure followed by connection accumulation | Nano; broad simple-query slowdown; failed diagnostics; recovery after resize/restart | Incident-aligned CPU/memory/IO and wait-state history |
| Excessive polling amplified load | Deployed workspace controller polls every1s; each handler authenticates and invokes RPCs; Proxy also authenticates | Per-request trace tying each Auth call to its originating page/heartbeat; actual pre-incident concurrency |
| Expensive queries or blocking | Organizations/search timeouts precede53300; accelerator table reads had multi-second gateway origin times | Pre-restart blocking graph and normalized query execution deltas; origin time is not SQL execution time |
| Connection leak/pool misconfiguration | Connection slots were exhausted | Live pre-restart role/application/session-age inventory; no direct `pg`/`postgres` pool was found in inspected app runtime code |

Restarting clears sessions while resizing changes resources. Recovery after both
cannot isolate which intervention mattered. Do not label the heartbeat the sole
cause, infer an Auth-provider-wide outage, or conclude that the upgrade is the
permanent fix. No out-of-memory/disk-full/deadlock event was returned by the
bounded log query, which is not proof those conditions never occurred.

## Evidence and methods

- Supabase Management API logs endpoint:
  `/v1/projects/{ref}/analytics/endpoints/logs`, bounded UTC start/end, ClickHouse
  queries over `logs` with source `auth_logs`, `postgres_logs`, or `edge_logs`.
- Selected Auth fields:timestamp,path,status,error_code,error,grant_type,request_id.
  Selected Postgres fields:timestamp,event_message,parsed.user_name,
  parsed.application_name,parsed.query_id,parsed.sql_state_code,parsed.query.
- Gateway aggregation groups request.path/client/status with counts and origin
  durations. No request bodies, cookies, tokens, or customer document contents
  are needed. The2021Auth checks and652heartbeat calls cover11:50–12:05EDT.
- Read-only bounded `pg_stat_activity` inventory grouped by role, application,
  backend type, state and wait event; compare client backends with configured
  connection capacity, not all background processes as if each were a client.
- Postgres query counters are cumulative, not incident-window measurements.
  Use two snapshots/deltas with stats-reset timestamps after recovery, as described in [Supabase database inspection](https://supabase.com/docs/guides/observability/inspect). Do not run
  `EXPLAIN ANALYZE` or load tests against the saturated production database.
- Provider control-plane health is insufficient: before the resize the project
  said `ACTIVE_HEALTHY` while Auth and SQL calls timed out. Validate the data plane.
- Local sanitized query evidence was saved to
  `/tmp/coachhouse-login-incident-evidence-20261015.json`; it is an ephemeral
  diagnostic artifact, not a committed production-log export.

## Targeted code follow-up to PR319

1. Workspace support heartbeat5s instead of the deployed1s. Keep its existing15s
   authorization lease and5s transport deadline; retain heartbeats for hidden
   support tabs, stop hidden ordinary-member roster reads.
2. Document reads2s with pending work/known collaborators,15s idle solo. Hidden
   clean documents stop reading; pending work retains retries. Typing and budget
   edits retain400ms save debounce; explicit Retry can bypass network backoff.
3. Document presence5s with collaborators/10s solo. Pause hidden decorative
   presence; preserve the existing20s presence expiration.
4. Shared single-flight scheduling, capped30s failure backoff, jitter,
   visibility/reconnect wake, and cleanup that cannot rearm after unmount.
5. Only the exact three collaboration/presence POST routes bypass duplicate
   Proxy authentication. Their handlers still authenticate, refresh cookies,
   reject cross-origin input and enforce current access before data operations.
   No cached grant, trusted client role, or RLS relaxation. Temporary Auth429/5xx/transport errors stay retryable; invalid or missing authentication still denies data access.
6. Deterministic15-minute scheduler budget:330 periodic requests plus2initial
   requests for a solo editor/workspace, versus1350periodic requests from PR319's
   earlier three2s channels. This measures scheduling, not production throughput.
   Active collaborators retain2s reads and a54periodic-request/minute ceiling.

The separate55 failed workspace-heartbeat requests included missing-organization
foreign-key errors. Backoff reduces repeated errors; organization-target validity
still needs its own evidence-based correction. Do not suppress integrity checks
or claim this scheduling change fixes that separate target issue.

## Independent acceptance and remaining work

- Local tests must exercise request counts over simulated15minutes, slow requests,
  overlap prevention, hidden tabs, failure/recovery, disposal, and explicit
  handler denial for anonymous/cross-origin/revoked access.
- Caleb owns hosted checks, merge, deployment, and production verification.
- After deployment: compare equal windows and comparable active-tab counts;
  record release ID, user traffic, Auth/RPC request rates, client backend counts,
  error rates and request latency. Distinguish initial/focus/save traffic from
  periodic polling. Capture service/role owners if connections rise again.
- Joel and Kim must complete login and session refresh; coach and member must
  edit/save the same document with persistence and revocation behavior preserved.
- Sustained recovery means no recurring53300 or Auth500/504 under representative
  meetings, not merely one healthy status or successful login. If it recurs,
  capture sessions/blockers and provider resource history before intervention.
- Missing incident host metrics/session history requires a Supabase support
  investigation. No support message was sent. Provide project, UTC timeline,
 53300events, Auth request IDs, timeout evidence, and resize time; ask for
  pre-resize connection owners and CPU/memory/IO history.

## Expert framing and rewritten prompt

1. A professional adds falsifiable causal attribution, evidence preservation
   before intervention, and a separation between recovery and recurrence prevention.
2. Start from raw PostgreSQL sessions/waits/locks/settings, query-counter deltas,
   provider host metrics, and individual timestamped Auth/Postgres/gateway events.
3. Use bounded read-only SQL, Supabase Management/Metrics APIs and dashboard,
   Vercel request traces, normalized query analysis, code call-path tracing,
   deterministic polling tests, and representative post-change measurements.
4. Independent truth comes from matching provider/app timestamps and identifiers,
   observable resource/request changes, preserved security/persistence tests, and
   successful actual user journeys with no recurring saturation. A restart alone
   does not prove causality; missing data remains an explicit limitation.

> Investigate the reported Coach House login incident at database-incident-response
> depth, without expanding its scope. Preserve raw timestamped Auth, Postgres and
> gateway evidence; obtain bounded session/lock/wait/connection-limit snapshots
> and CPU/memory/IO history. Build a causal timeline distinguishing initial
> slowdown, connection exhaustion and user-visible failure. Test compute pressure,
> blocking/slow queries, excessive polling and pool leaks as competing hypotheses;
> label what each observation proves and what would falsify it. Trace demonstrated
> request amplification to exact deployed code, then implement only the supported
> correction with measured request budgets and unchanged authorization/save
> guarantees. Do not infer all Auth calls originate from support. Separate
> restart/resize recovery from root-cause proof. Provide the evidence ledger,
> remaining uncertainty, concrete mitigation/rollback, and independent acceptance
> criteria. Obtain approval for disruptive production actions. Deliver code at an
> open PR; Caleb owns hosted checks, merge, deployment and real-user production
> verification. If diagnostic access is blocked, report the exact failure and
> prepare a provider escalation packet rather than repeatedly probing the outage.
