"""Deterministic isolated tests: never call a provider or change a real checkout."""
import copy
import json
import multiprocessing
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from gates import gate, validate_queue
from store import Store, atomic, dead, identity


def seed():
    return dict(revision=0, active=None, receipts=[], queue=[dict(id='A', status='queued',
        scope='test', acceptance=['test'], source_ids=['fixture'], next_action='test',
        dependencies=[], kind='application')])


def race(directory, results):
    try:
        Store(directory).update(0, 'head', lambda s: s.update(active={'head': 'head'}))
        results.put('won')
    except (ValueError, BlockingIOError):
        results.put('rejected')


def evidence():
    return dict(tests=dict(status='passed', head='head', reference='test report'),
        ui=dict(status='passed', head='head', reference='review'), review_packet='diff',
        approval=dict(head='head', scope='test', response='approved', actor='human', at='now', reference='message'),
        github=dict(head='head', quality='success', review='APPROVED', protection_satisfied=True,
                    reference='github', observed_at='now'),
        merge=dict(sha='merge', at='now', default_branch_contains=True),
        deployment=dict(id='deployment', project='intended', domain='test.invalid', status='success',
                        source_sha='merge', provider_verified=True, reference='provider', observed_at='now'),
        production=dict(status='passed', source_sha='merge', reference='smoke', at='now'),
        rollback='known previous deployment', providers='No migrations or provider changes',
        cleanup=dict(status='preserved', reference='clean checkout, no server'), mirrors='synced, checkboxes preserved',
        recovery=dict(verified_sha='head', reference='remote ref'))


class StoreTests(unittest.TestCase):
    def test_two_concurrent_claims_and_restart(self):
        with tempfile.TemporaryDirectory() as directory:
            Store(directory).initialize(seed())
            context = multiprocessing.get_context('fork')
            results = context.Queue()
            workers = [context.Process(target=race, args=(directory, results)) for _ in range(2)]
            for worker in workers: worker.start()
            for worker in workers: worker.join(5)
            self.assertEqual(sorted(results.get(timeout=2) for _ in workers), ['rejected', 'won'])
            self.assertEqual(Store(directory).read()['revision'], 1)

    def test_stale_revision_and_head(self):
        with tempfile.TemporaryDirectory() as directory:
            store = Store(directory)
            state = seed(); state['active'] = {'head': 'head'}
            store.initialize(state)
            for revision, head in [(1, 'head'), (0, 'stale')]:
                with self.assertRaises(ValueError): store.update(revision, head, lambda s: None)
            self.assertEqual(store.read(), state)

    def test_interrupted_write_preserves_previous_state(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'state.json'
            atomic(path, seed())
            with patch('store.os.replace', side_effect=OSError('interrupted')):
                with self.assertRaises(OSError): atomic(path, {'invalid': True})
            self.assertEqual(json.loads(path.read_text()), seed())
            self.assertEqual(list(Path(directory).glob('.pending-*')), [])

    def test_live_owner_cannot_be_taken_over(self):
        self.assertFalse(dead(identity('operator', os.getpid())))
        with self.assertRaises(ValueError): dead(dict(host='another-host', pid=1, started='unknown'))

    def test_dead_owner_can_resume(self):
        claim = identity('operator', os.getpid())
        with patch('store.process', return_value=''): self.assertTrue(dead(claim))
        with patch('store.process', return_value='reused pid'): self.assertTrue(dead(claim))

    def test_dependency_cycle_and_duplicate_claims(self):
        state = seed()
        second = copy.deepcopy(state['queue'][0]); second['id'] = 'B'
        state['queue'].append(second)
        state['queue'][0]['dependencies'] = ['B']; second['dependencies'] = ['A']
        with self.assertRaisesRegex(ValueError, 'cycle'): validate_queue(state)
        state['queue'][0]['dependencies'] = []; second['dependencies'] = []
        for row in state['queue']: row['status'] = 'in_progress'
        with self.assertRaisesRegex(ValueError, 'Multiple'): validate_queue(state)


class GateTests(unittest.TestCase):
    def check(self, previous, target, data):
        row = seed()['queue'][0]; row['status'] = previous
        gate(row, {'head': 'head'}, target, data)

    def test_full_valid_release(self):
        from gates import STATES
        for previous, target in zip(STATES[1:], STATES[2:]): self.check(previous, target, evidence())

    def test_no_skipping(self):
        with self.assertRaises(ValueError): self.check('in_progress', 'closed', evidence())

    def test_blocked_approval(self):
        for change in [dict(response='pending'), dict(head='stale'), dict(conditions=['unresolved'])]:
            data = evidence(); data['approval'].update(change)
            with self.assertRaises(ValueError): self.check('awaiting_review', 'approved', data)

    def test_failed_or_stale_ci_and_missing_review(self):
        for change in [dict(quality='failure'), dict(head='stale'), dict(review='REVIEW_REQUIRED'), dict(protection_satisfied=False)]:
            data = evidence(); data['github'].update(change)
            with self.assertRaises(ValueError): self.check('approved', 'pr_ready', data)

    def test_merge_without_deployment_and_wrong_sha(self):
        for deployment in [{}, dict(evidence()['deployment'], source_sha='wrong'), dict(evidence()['deployment'], provider_verified=False)]:
            data = evidence(); data['deployment'] = deployment
            with self.assertRaises(ValueError): self.check('merged', 'deployed', data)

    def test_missing_closeout_or_backup(self):
        for key in ['cleanup', 'mirrors', 'recovery', 'rollback']:
            data = evidence(); del data[key]
            with self.assertRaises(ValueError): self.check('production_verified', 'closed', data)

    def test_na_only_for_tooling_with_reason(self):
        data = evidence(); data['deployment'] = dict(na_reason='No deployed app artifact')
        with self.assertRaises(ValueError): self.check('merged', 'deployed', data)
        row = seed()['queue'][0]; row.update(kind='tooling', status='merged')
        gate(row, {'head': 'head'}, 'deployed', data)



class CommandTests(unittest.TestCase):
    def setUp(self):
        import ship
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.store = Store(self.directory / 'shared')
        self.store.initialize(seed())
        self.here = self.directory / 'tracked'; self.here.mkdir()
        (self.here / 'receipts').mkdir()
        self.owner = identity('chat', os.getpid())
        self.patches = [patch('ship.canonical', return_value=self.store), patch('ship.HERE', self.here), patch('ship.bind_plan', return_value={'fixture': True}),
            patch('ship.local', return_value=dict(worktree='/fixture', branch='chore/fixture', head='head')),
            patch('ship.run', side_effect=lambda *args: '' if args[1] == 'status' else 'head')]
        for item in self.patches: item.start(); self.addCleanup(item.stop)

    def call(self, *args):
        import ship
        import contextlib, io
        with patch('sys.argv', ['ship.py', *args]), contextlib.redirect_stdout(io.StringIO()): ship.main()

    def claim(self):
        self.call('claim', '--slice', 'A', '--owner', 'chat', '--pid', str(os.getpid()), '--revision', '0', '--head', 'head')

    def test_claim_checkpoint_export_restore(self):
        self.claim()
        with self.assertRaises(ValueError):
            self.call('claim', '--slice', 'A', '--owner', 'duplicate', '--revision', '1', '--head', 'head')
        receipt = self.directory / 'reviewed.json'; receipt.write_text(json.dumps(evidence() | {'github': None}))
        # Caller cannot inject provider-owned GitHub/merge fields.
        with self.assertRaises(ValueError):
            self.call('checkpoint', '--owner', 'chat', '--revision', '1', '--head', 'head', '--receipt', str(receipt))
        data = evidence(); del data['github']; del data['merge']
        receipt.write_text(json.dumps(data))
        self.call('checkpoint', '--owner', 'chat', '--revision', '1', '--head', 'head', '--receipt', str(receipt), '--to', 'locally_validated')
        self.call('export'); self.call('validate')
        exported = next((self.here / 'receipts').glob('000002-*.json'))
        restored = Store(self.directory / 'restored')
        with patch('ship.canonical', return_value=restored):
            self.call('init', '--receipt', str(exported)); self.call('validate')
        self.assertEqual(restored.read(), self.store.read())

    def test_changed_head_invalidates_approval(self):
        self.claim()
        with patch('ship.local', return_value=dict(worktree='/fixture', branch='chore/fixture', head='new')):
            self.call('checkpoint', '--owner', 'chat', '--revision', '1', '--head', 'head')
        state = self.store.read()
        self.assertEqual(state['active']['head'], 'new')
        self.assertEqual(state['active']['evidence'], {})

    def test_wrong_worktree_and_unknown_owner(self):
        self.claim()
        with self.assertRaises(ValueError): self.call('checkpoint', '--owner', 'other', '--revision', '1', '--head', 'head')
        with patch('ship.local', return_value=dict(worktree='/other', branch='chore/fixture', head='head')):
            with self.assertRaises(ValueError): self.call('checkpoint', '--owner', 'chat', '--revision', '1', '--head', 'head')

    def test_resume_after_commit_before_checkpoint(self):
        self.claim()
        receipt = self.directory / 'resume.json'
        receipt.write_text(json.dumps({'owner_evidence': 'Old process stopped after commit', 'next_action': 'Revalidate new head'}))
        with patch('ship.dead', return_value=True), patch('ship.local', return_value=dict(worktree='/fixture', branch='chore/fixture', head='new')):
            self.call('resume', '--owner', 'new-chat', '--pid', str(os.getpid()), '--revision', '1', '--head', 'head', '--receipt', str(receipt))
        state = self.store.read()
        self.assertEqual(state['active']['claim']['owner'], 'new-chat')
        self.assertEqual(state['active']['head'], 'new')
        self.assertEqual(state['queue'][0]['status'], 'in_progress')
        self.assertNotIn('approval', state['active']['evidence'])

    def test_reconcile_persists_new_failure_as_blocked(self):
        self.claim()
        state = self.store.read()
        state['queue'][0]['status'] = 'pr_ready'
        state['active']['evidence'] = evidence()
        atomic(self.store.path, state)
        fresh = {'github': dict(evidence()['github'], quality='failure')}
        with patch('ship.reconcile', return_value=fresh):
            self.call('reconcile', '--owner', 'chat', '--revision', '1', '--head', 'head', '--pr', '1')
        updated = self.store.read()
        self.assertEqual(updated['queue'][0]['status'], 'blocked')
        self.assertEqual(updated['queue'][0]['resume_state'], 'pr_ready')
        self.assertEqual(updated['active']['evidence']['github']['quality'], 'failure')
        self.call('validate')

    def test_protected_transition_requires_live_reconciliation(self):
        self.claim()
        with self.assertRaisesRegex(ValueError, 'fresh'):
            self.call('checkpoint', '--owner', 'chat', '--revision', '1', '--head', 'head', '--to', 'pr_ready')


if __name__ == "__main__": unittest.main()
