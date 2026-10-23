#!/usr/bin/env python3
"""SHIP operator runner. Run from any worktree of the same repository."""
import argparse
import copy
import json
import os
from pathlib import Path
import sys

from gates import effective_stage, gate, require, validate_queue
from plans import bind_plan, catalog, print_prompt, validate_refs
from recovery import load_receipts, read_snapshot, snapshot_name
from providers import reconcile
from store import atomic, canonical, dead, digest, identity, receipt_path, run, utc

HERE = Path(__file__).resolve().parent


def local():
    return dict(worktree=run('git', 'rev-parse', '--show-toplevel'),
                branch=run('git', 'branch', '--show-current'), head=run('git', 'rev-parse', 'HEAD'))


def snapshot(state, directory):
    directory.mkdir(parents=True, exist_ok=True)
    name = snapshot_name(state)
    path = directory / name
    if path.exists():
        require(read_snapshot(path) == state, 'Existing snapshot differs from current state')
    else:
        atomic(path, state)
    return str(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['init', 'inspect', 'status', 'claim', 'resume', 'checkpoint',
                                            'validate', 'reconcile', 'closeout', 'export', 'enqueue',
                                            'plans', 'prompt', 'bind-plan'])
    parser.add_argument('--slice')
    parser.add_argument('--owner')
    parser.add_argument('--pid', type=int, default=os.getppid())
    parser.add_argument('--revision', type=int)
    parser.add_argument('--head', help='Expected previously recorded head, not the new head')
    parser.add_argument('--receipt', type=Path, help='Reviewed sanitized JSON operator evidence')
    parser.add_argument('--to', choices=['in_progress', 'locally_validated', 'awaiting_review', 'approved',
                                       'pr_ready', 'merged', 'deployed', 'production_verified', 'blocked'])
    parser.add_argument('--pr', type=int)
    parser.add_argument('--workstream', help='Original packet ID for a read-only prompt preview')
    parser.add_argument('--stage', type=int, nargs='+', help='Original numbered stages for prompt preview')
    parser.add_argument('--plans-root', type=Path, help='Private original packet directory (never a state override)')
    args = parser.parse_args()
    if args.operation == 'plans':
        print(json.dumps(catalog(), indent=2))
        return
    if args.operation == 'prompt' and args.workstream:
        require(not args.slice and args.stage, 'Select either --slice or --workstream with --stage')
        print_prompt(dict(plan_refs=[dict(workstream=args.workstream, stages=args.stage)]), args.plans_root)
        return
    store = canonical()
    if args.operation == 'prompt':
        require(args.slice and not args.stage, 'Supply --slice or --workstream with --stage')
        row = next(r for r in store.read()['queue'] if r['id'] == args.slice)
        print_prompt(row, args.plans_root)
        return
    if args.operation == 'init':
        seed = read_snapshot(args.receipt) if args.receipt else json.loads((HERE / 'queue.json').read_text())
        validate_queue(seed)
        receipts = load_receipts(seed, args.receipt.parent) if args.receipt else []
        store.initialize(seed, receipts)
    elif args.operation in ('inspect', 'status'):
        state = store.read()
        print(json.dumps(dict(canonical=str(store.path), **state), indent=2))
        return
    elif args.operation == 'export':
        state = store.read()
        payloads = load_receipts(state, store.directory)
        directory = HERE / 'receipts'
        directory.mkdir(parents=True, exist_ok=True)
        destinations = [(receipt_path(directory, name), data) for name, data in payloads]
        for path, data in destinations:
            atomic(path, data)
        print(snapshot(state, HERE / 'receipts'))
        return
    elif args.operation == 'validate':
        state = store.read()
        validate_queue(state)
        load_receipts(state, store.directory)
        print('Valid queue, ownership and receipt hashes; not release approval')
        return
    else:
        require(args.revision is not None and args.head and args.owner, 'Supply --revision --head --owner')
        current = local()
        receipt = json.loads(args.receipt.read_text()) if args.receipt else {}
        require(args.operation != 'reconcile' or args.pr, 'Reconcile requires --pr')
        protected = args.to in ('pr_ready', 'merged', 'deployed', 'production_verified') or args.operation == 'closeout'
        require(not protected or args.pr, 'Protected transitions require fresh --pr reconciliation')
        remote = reconcile(args.pr) if args.pr else None
        def change(state):
            active = state.get('active')
            if args.operation == 'enqueue':
                require(not active, 'Finish or preserve the active slice before intake changes')
                row = receipt.get('slice', {})
                require(row.get('status') == 'queued' and row.get('workstream') and row.get('exclusions')
                        and row.get('kind') in ('application', 'tooling'), 'Supply a reviewed, sanitized queued slice')
                require(current['head'] == args.head, 'Working head changed')
                validate_refs(row)
                state['queue'].append(row)
            elif args.operation == 'bind-plan':
                require(not args.to and not args.pr and set(receipt) == {'plan_refs'},
                        'bind-plan only accepts plan_refs and no transition or PR')
                require(current['head'] == args.head, 'Working head changed')
                if active:
                    require(current['worktree'] == active['worktree'] and current['branch'] == active['branch'],
                            'Use the recorded worktree/branch')
                    require(active['claim']['owner'] == args.owner, 'Not the active owner')
                    require(not dead(active['claim']), 'Owner stopped; use resume with process evidence')
                queued = next(r for r in state['queue'] if r['id'] == args.slice)
                require(queued['status'] == 'queued', 'Only queued slices can be rebound')
                queued['plan_refs'] = receipt['plan_refs']
                bind_plan(queued, args.plans_root)
            elif args.operation == 'claim':
                require(not active, 'An unfinished slice already owns SHIP; resume it')
                row = next(r for r in state['queue'] if r['id'] == args.slice)
                require(row['status'] == 'queued', 'Slice is not queued')
                require(all(next(r for r in state['queue'] if r['id'] == dep)['status'] == 'closed'
                            for dep in row['dependencies']), 'Dependencies not closed')
                require(current['head'] == args.head, 'Working head changed')
                require(not run('git', 'status', '--porcelain'), 'Claim requires clean worktree')
                run('git', 'fetch', 'origin')
                require(run('git', 'merge-base', 'HEAD', 'origin/main') == run('git', 'rev-parse', 'origin/main'), 'Reconcile current origin/main before claiming')
                require(current['branch'].startswith(('chore/', 'fix/', 'feat/')), 'Use an isolated task branch')
                binding = bind_plan(row, args.plans_root)
                state['active'] = dict(slice=row['id'], claim=identity(args.owner, args.pid),
                                       base=run('git', 'rev-parse', 'origin/main'), **current, evidence={'plan_binding': binding})
                row['status'] = 'in_progress'
            else:
                require(active is not None, 'No active slice')
                row = next(r for r in state['queue'] if r['id'] == active['slice'])
                require(current['worktree'] == active['worktree'] and current['branch'] == active['branch'],
                        'Use the recorded worktree/branch')
                if args.operation == 'resume':
                    require(receipt.get('owner_evidence') and receipt.get('next_action'), 'Resume needs old-owner evidence and next action')
                    require(dead(active['claim']), 'Previous owner is still running')
                    active['claim'] = identity(args.owner, args.pid)
                else:
                    require(active['claim']['owner'] == args.owner, 'Not the active owner')
                    require(not dead(active['claim']), 'Owner stopped; use resume with process evidence')
                if current['head'] != active['head']:
                    require(args.operation in ('checkpoint', 'resume'), 'Checkpoint changed head before proceeding')
                    require(effective_stage(row) not in ('merged', 'deployed', 'production_verified', 'closed'), 'Do not change released revision')
                    require(not active['evidence'].get('merge'), 'Do not change an externally merged revision')
                    active['head'] = current['head']
                    active['evidence'] = {}
                    row['status'] = 'in_progress'
                    row.pop('resume_state', None)
                if remote is not None:
                    require(remote is not None and remote['github']['head'] == active['head'], 'PR head differs from active head')
                    # Retain pre-merge CLEAN evidence only for the same reviewed head.
                    prior = active['evidence'].get('github', {})
                    if remote.get('merge') and prior.get('protection_satisfied') and prior.get('head') == active['head']:
                        remote['github']['protection_satisfied'] = True
                        remote['github']['premerge_observation'] = prior
                    active['evidence'].update(remote)
                require(not any(k in receipt for k in ('github', 'merge', 'plan_binding')), 'GitHub and plan bindings must come from the runner')
                active['evidence'].update(receipt)
                if row.get('plan_refs') and args.operation in ('checkpoint', 'resume'):
                    binding = bind_plan(row, args.plans_root)
                    prior = active['evidence'].get('plan_binding')
                    require(prior is None or prior == binding, 'Original plans changed; reconcile scope before continuing')
                    active['evidence']['plan_binding'] = binding
                target = 'closed' if args.operation == 'closeout' else args.to
                if remote is not None and row['status'] in ('pr_ready', 'merged', 'deployed', 'production_verified'):
                    try:
                        gate(row, active, row['status'], active['evidence'])
                    except ValueError as error:
                        active['evidence']['blocker'] = f'Fresh evidence invalidated release gate: {error}'
                        active['evidence']['next_action'] = 'Resolve the failed gate and reconcile before advancing'
                        row['next_action'] = active['evidence']['next_action']
                        target = 'blocked'
                if target:
                    gate(row, active, target, active['evidence'])
                    if target == 'blocked' and row['status'] != 'blocked':
                        row['resume_state'] = row['status']
                    row['status'] = target
                row['next_action'] = receipt.get('next_action', row['next_action'])
                active['checkpoint_at'] = utc()
                if target == 'closed':
                    row['release'] = copy.deepcopy(active)
                    state['active'] = None
            validate_queue(state)
            entry = dict(at=utc(), operation=args.operation, owner=args.owner,
                         previous_revision=state['revision'], head=current['head'], evidence=receipt,
                         remote=remote)
            file = f'receipt-{state["revision"] + 1:06d}-{digest(entry)[:16]}.json'
            atomic(receipt_path(store.directory, file), entry)
            state['receipts'].append(dict(file=file, sha256=digest(entry)))
        result = store.update(args.revision, args.head, change)
        print(json.dumps(dict(revision=result['revision'], active=result.get('active')), indent=2))
        return
    print(str(store.path))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, StopIteration, OSError) as error:
        sys.exit(f'SHIP blocked: {error}')
