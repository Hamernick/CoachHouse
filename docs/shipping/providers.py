"""Read-only GitHub reconciliation; no merge/deploy APIs are called."""
import json
from store import run, utc

REPO = 'Hamernick/CoachHouse'


def api(path):
    return json.loads(run('gh', 'api', f'repos/{REPO}/{path}'))


def reconcile(number):
    pr = json.loads(run('gh', 'pr', 'view', str(number), '--repo', REPO, '--json',
                        'number,url,headRefOid,baseRefName,reviewDecision,mergeStateStatus,mergedAt,mergeCommit,state'))
    head = pr['headRefOid']
    protection = api('branches/main/protection')
    checks = api(f'commits/{head}/check-runs?per_page=100')['check_runs']
    required = protection['required_status_checks']['checks']
    def result(context, app_id=None):
        matches = [c for c in checks if c['name'] == context
                   and (app_id is None or c['app']['id'] == app_id)]
        latest = max(matches, key=lambda c: c['id']) if matches else {}
        return latest.get('conclusion') if latest.get('status') == 'completed' else 'pending'
    reviews = protection['required_pull_request_reviews']
    satisfied = (pr['baseRefName'] == 'main' and pr['reviewDecision'] == 'APPROVED'
                 and reviews['required_approving_review_count'] >= 1
                 and reviews['require_code_owner_reviews']
                 and protection['required_status_checks']['strict']
                 and bool(required) and all(result(c['context'], c.get('app_id')) == 'success' for c in required)
                 and any(c['context'] == 'quality' for c in required)
                 and pr['mergeStateStatus'] == 'CLEAN')
    observed = utc()
    data = dict(github=dict(head=head, quality=result('quality', 15368), review=pr['reviewDecision'],
                           protection_satisfied=satisfied, reference=pr['url'], observed_at=observed,
                           merge_state=pr['mergeStateStatus'], required_checks=required))
    if pr['mergedAt']:
        sha = pr['mergeCommit']['oid']
        comparison = api(f'compare/{sha}...main')
        data['merge'] = dict(sha=sha, at=pr['mergedAt'],
                             default_branch_contains=comparison['status'] in ('ahead', 'identical'))
    deployments = api(f'deployments?sha={data.get("merge", {}).get("sha", head)}&per_page=100')
    data['deployment_observations'] = [dict(id=d['id'], environment=d['environment'], sha=d['sha'],
        statuses=[{k: s.get(k) for k in ('state', 'environment_url', 'log_url', 'created_at')}
                  for s in api(f'deployments/{d["id"]}/statuses?per_page=3')]) for d in deployments]
    # Integration labels alone do not prove the actual production target/provider state.
    data['provider_status'] = 'unknown until intended project/domain/source SHA is checked at provider'
    return data
