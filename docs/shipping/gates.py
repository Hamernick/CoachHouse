"""Fail-closed release gates. Receipts are operator attestations, not approval generators."""
STATES = ['queued', 'in_progress', 'locally_validated', 'awaiting_review',
          'approved', 'pr_ready', 'merged', 'deployed', 'production_verified', 'closed']


def require(condition, message):
    if not condition:
        raise ValueError(message)


def passed(item, head):
    return (isinstance(item, dict) and item.get('status') == 'passed'
            and item.get('head') == head and bool(item.get('reference')))


def effective_stage(row):
    stage = row.get('resume_state') if row['status'] == 'blocked' else row['status']
    require(stage in STATES, 'Blocked state requires a valid prior release stage')
    return stage


def validate_queue(state):
    rows = state['queue']
    ids = [row['id'] for row in rows]
    require(len(ids) == len(set(ids)), 'Duplicate slice IDs')
    for row in rows:
        require(row['status'] in STATES + ['blocked'], 'Unknown state')
        effective_stage(row)
        require(all(row.get(k) for k in ('scope', 'acceptance', 'source_ids', 'next_action')),
                'Missing scope/acceptance/source/next action')
        require(all(dep in ids and dep != row['id'] for dep in row['dependencies']), 'Invalid dependency')
    def visit(key, path):
        require(key not in path, 'Dependency cycle')
        for dep in next(row for row in rows if row['id'] == key)['dependencies']:
            visit(dep, path + [key])
    for key in ids:
        visit(key, [])
    active_rows = [row for row in rows if row['status'] not in ('queued', 'closed')]
    require(len(active_rows) <= 1, 'Multiple active slices')
    active = state.get('active')
    require(bool(active) == bool(active_rows), 'Claim/status mismatch')
    if active:
        require(active['slice'] == active_rows[0]['id'], 'Claim belongs to another slice')
        if active_rows[0]['status'] != 'blocked':
            gate(active_rows[0], active, active_rows[0]['status'], active['evidence'])
    for row in rows:
        if row['status'] == 'closed':
            require(row.get('release'), 'Closed slice needs release evidence')
            gate(row, row['release'], 'closed', row['release']['evidence'])


def gate(row, active, target, evidence):
    previous = row['status']
    require(target in STATES + ['blocked'], 'Unknown transition')
    if target == 'blocked':
        require(evidence.get('blocker') and evidence.get('next_action'), 'Explain blocker and next action')
        return
    previous = effective_stage(row)
    require(target == previous or (previous in STATES and STATES.index(target) == STATES.index(previous) + 1),
            'Cannot skip release stages')
    rank = STATES.index(target)
    head = active['head']
    if rank >= 2:
        require(passed(evidence.get('tests'), head), 'Focused tests must pass at current head')
        ui = evidence.get('ui', {})
        require(passed(ui, head) or (row['kind'] == 'tooling' and ui.get('na_reason')), 'Missing UI review')
    if rank >= 3:
        require(evidence.get('review_packet'), 'Concrete review packet required')
    if rank >= 4:
        approval = evidence.get('approval', {})
        require(approval.get('head') == head and approval.get('scope') == row['scope']
                and approval.get('response') == 'approved' and approval.get('actor')
                and approval.get('at') and approval.get('reference') and not approval.get('conditions'),
                'Missing exact-head human approval or unresolved conditions')
    if rank >= 5:
        gh = evidence.get('github', {})
        require(gh.get('head') == head and gh.get('quality') == 'success'
                and gh.get('review') == 'APPROVED' and gh.get('protection_satisfied') is True
                and gh.get('reference') and gh.get('observed_at'), 'Current-head GitHub quality/review/protection required')
    if rank >= 6:
        merge = evidence.get('merge', {})
        require(merge.get('sha') and merge.get('at') and merge.get('default_branch_contains') is True,
                'Verified default-branch merge required')
    if rank >= 7:
        deployment = evidence.get('deployment', {})
        tooling_na = row['kind'] == 'tooling' and bool(deployment.get('na_reason'))
        require(tooling_na or (deployment.get('status') == 'success'
                and deployment.get('source_sha') == evidence['merge']['sha']
                and all(deployment.get(k) for k in ('id', 'project', 'domain', 'reference', 'observed_at'))
                and deployment.get('provider_verified') is True), 'Matching provider-verified production deployment required')
    if rank >= 8:
        smoke = evidence.get('production', {})
        require((row['kind'] == 'tooling' and smoke.get('na_reason')) or
                (smoke.get('status') == 'passed' and smoke.get('source_sha') == evidence['merge']['sha']
                 and smoke.get('reference') and smoke.get('at')), 'Scoped production verification required')
        require(evidence.get('rollback') and evidence.get('providers'), 'Rollback/provider evidence required (or explained N/A)')
    if rank >= 9:
        require(all(evidence.get(k) for k in ('cleanup', 'mirrors', 'recovery')), 'Closeout/recovery/mirror evidence required')
        require(evidence['cleanup'].get('status') in ('retired', 'preserved')
                and evidence['cleanup'].get('reference'), 'Explicit safe cleanup or preservation required')
        require(evidence['recovery'].get('verified_sha') == head and evidence['recovery'].get('reference'),
                'Current head must be remotely recoverable')
