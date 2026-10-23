"""Original-packet linkage tests with private text represented only by fixtures."""
import contextlib
import copy
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import plans
import ship
import test_ship as fixtures
from store import atomic


class PlanTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.manifest = dict(workstreams=[dict(id='06', file='packet.md',
            section='### Sequential implementation plan', stages=[1, 2])], context_files=['index.md'])
        self.original = '# Original request\nPrivate fixture wording\n### Sequential implementation plan\n1. First task\n2. Second task\n### Decisions\nKeep this decision\n### Continuation checkpoint\nAlready completed work stays closed\n'
        (self.root / 'packet.md').write_text(self.original)
        (self.root / 'index.md').write_text('Original index and scope boundaries')
        self.row = dict(plan_refs=[dict(workstream='06', stages=[2])], source_ids=['O001-01'])
        item = patch('plans.catalog', return_value=self.manifest)
        item.start(); self.addCleanup(item.stop)

    def test_full_original_prompt_and_metadata_only_binding(self):
        documents, binding = plans.read_plan(self.row, self.root)
        self.assertEqual(documents[1]['text'], self.original)
        self.assertEqual(binding['plan_refs'][0]['lines'], [5])
        self.assertNotIn('Private fixture', json.dumps(binding))
        self.assertNotIn(str(self.root), json.dumps(binding))
        output = io.StringIO()
        with contextlib.redirect_stdout(output): plans.print_prompt(self.row, self.root)
        self.assertIn(self.original, output.getvalue())
        self.assertIn('scope boundaries', output.getvalue())

    def test_missing_invalid_and_wrong_requirement_references(self):
        for refs in [[], [None], [dict(workstream='01', stages=[1])],
                     [dict(workstream='06', stages=[3])], [dict(workstream='06', stages=[True])],
                     [dict(workstream='06', stages=[1, 1])]]:
            with self.subTest(refs=refs), self.assertRaises(ValueError):
                plans.validate_refs(dict(self.row, plan_refs=refs))
        with self.assertRaisesRegex(ValueError, 'primary packet'):
            plans.validate_refs(dict(self.row, source_ids=['O003-01']))

    def test_missing_changed_and_unsafe_originals_fail(self):
        for text in [self.original.replace('2. Second', '3. Second'),
                     self.original.replace('2. Second', '1. Second'), '# Missing section']:
            (self.root / 'packet.md').write_text(text)
            with self.assertRaises(ValueError): plans.bind_plan(self.row, self.root)
        (self.root / 'packet.md').unlink()
        with self.assertRaisesRegex(ValueError, 'Missing original'): plans.bind_plan(self.row, self.root)
        for name in ['../outside.md', '/outside.md']:
            with self.assertRaises(ValueError): plans.private_file(self.root, name)
        (self.root / 'link.md').symlink_to(self.root / 'index.md')
        with self.assertRaises(ValueError): plans.private_file(self.root, 'link.md')

    def test_changed_original_changes_binding(self):
        before = plans.bind_plan(self.row, self.root)
        (self.root / 'packet.md').write_text(self.original + '\nNew decision\n')
        self.assertNotEqual(before, plans.bind_plan(self.row, self.root))

    def test_restored_root_overrides_current_user_default(self):
        with patch('plans.catalog', return_value={'private_root': 'Desktop/Coach House Codex Workstreams'}), patch('plans.Path.home', return_value=Path('/home/operator')):
            self.assertEqual(plans.packet_root(), Path('/home/operator/Desktop/Coach House Codex Workstreams'))
            self.assertEqual(plans.packet_root(self.root), self.root)

    def test_preview_does_not_access_shared_state(self):
        with patch('ship.canonical', side_effect=AssertionError('State accessed')):
            with patch('sys.argv', ['ship.py', 'prompt', '--workstream', '06', '--stage', '2', '--plans-root', str(self.root)]), contextlib.redirect_stdout(io.StringIO()):
                ship.main()


class PlanCommandTests(unittest.TestCase):
    setUp = fixtures.CommandTests.setUp
    call = fixtures.CommandTests.call
    claim = fixtures.CommandTests.claim

    def test_claim_missing_originals_preserves_queue(self):
        before = self.store.read()
        with patch('ship.bind_plan', side_effect=ValueError('Missing original plan')):
            with self.assertRaises(ValueError): self.claim()
        self.assertEqual(before, self.store.read())

    def test_claim_records_binding_and_rejects_injected_binding(self):
        self.claim()
        self.assertEqual(self.store.read()['active']['evidence']['plan_binding'], {'fixture': True})
        receipt = self.directory / 'injected.json'
        receipt.write_text(json.dumps({'plan_binding': {'forged': True}}))
        with self.assertRaises(ValueError):
            self.call('checkpoint', '--owner', 'chat', '--revision', '1', '--head', 'head', '--receipt', str(receipt))

    def test_bind_queued_slice_preserves_active_and_refuses_released(self):
        self.claim()
        state = self.store.read()
        queued = copy.deepcopy(state['queue'][0]); queued.update(id='B', status='queued')
        state['queue'].append(queued)
        atomic(self.store.path, state)
        receipt = self.directory / 'refs.json'
        receipt.write_text(json.dumps({'plan_refs': [dict(workstream='06', stages=[1])]}))
        self.call('bind-plan', '--slice', 'B', '--owner', 'chat', '--revision', '1', '--head', 'head', '--receipt', str(receipt))
        result = self.store.read()
        self.assertEqual(result['queue'][1]['status'], 'queued')
        self.assertEqual(result['active'], state['active'])
        self.assertEqual(result['queue'][0], state['queue'][0])
        for stage in ['in_progress', 'merged', 'blocked', 'closed']:
            state = self.store.read(); state['queue'][0]['status'] = stage
            if stage == 'blocked': state['queue'][0]['resume_state'] = 'merged'
            atomic(self.store.path, state)
            with self.assertRaisesRegex(ValueError, 'Only queued'):
                self.call('bind-plan', '--slice', 'A', '--owner', 'chat', '--revision', '2', '--head', 'head', '--receipt', str(receipt))

    def test_restored_unclaimed_legacy_queue_can_bind_then_claim(self):
        self.call('export')
        exported = next((self.here / 'receipts').glob('000000-*.json'))
        restored = fixtures.Store(self.directory / 'restored')
        refs = [dict(workstream='06', stages=[1])]
        receipt = self.directory / 'refs.json'
        receipt.write_text(json.dumps({'plan_refs': refs}))
        with patch('ship.canonical', return_value=restored):
            self.call('init', '--receipt', str(exported))
            before = restored.read()
            with patch('ship.bind_plan', side_effect=lambda row, root: plans.validate_refs(row) or {'fixture': True}):
                with self.assertRaises(ValueError): self.claim()
                self.assertEqual(restored.read(), before)
                self.call('bind-plan', '--slice', 'A', '--owner', 'chat', '--revision', '0', '--head', 'head', '--receipt', str(receipt))
                bound = restored.read()
                self.assertIsNone(bound['active'])
                self.assertEqual(bound['queue'][0]['status'], 'queued')
                self.assertEqual(bound['queue'][0]['plan_refs'], refs)
                self.call('claim', '--slice', 'A', '--owner', 'chat', '--pid', str(os.getpid()), '--revision', '1', '--head', 'head')
                self.assertEqual(restored.read()['active']['slice'], 'A')

    def test_unclaimed_bind_rejects_invalid_refs_and_stale_head_or_revision(self):
        before = self.store.read()
        receipt = self.directory / 'refs.json'
        for refs, revision, head in [([], '0', 'head'), ([dict(workstream='06', stages=[1])], '1', 'head'),
                                     ([dict(workstream='06', stages=[1])], '0', 'stale')]:
            receipt.write_text(json.dumps({'plan_refs': refs}))
            with patch('ship.bind_plan', side_effect=lambda row, root: plans.validate_refs(row)):
                with self.assertRaises(ValueError):
                    self.call('bind-plan', '--slice', 'A', '--owner', 'chat', '--revision', revision, '--head', head, '--receipt', str(receipt))
            self.assertEqual(self.store.read(), before)

    def test_bind_preserves_active_owner_and_worktree_guards(self):
        self.claim()
        before = self.store.read()
        receipt = self.directory / 'refs.json'
        receipt.write_text(json.dumps({'plan_refs': [dict(workstream='06', stages=[1])]}))
        for owner, worktree, stopped in [('other', '/fixture', False), ('chat', '/other', False), ('chat', '/fixture', True)]:
            with patch('ship.local', return_value=dict(worktree=worktree, branch='chore/fixture', head='head')), patch('ship.dead', return_value=stopped):
                with self.assertRaises(ValueError):
                    self.call('bind-plan', '--slice', 'A', '--owner', owner, '--revision', '1', '--head', 'head', '--receipt', str(receipt))
            self.assertEqual(self.store.read(), before)

    def test_external_merge_is_immutable_before_release_gates_pass(self):
        self.claim()
        state = self.store.read()
        state['active']['evidence']['merge'] = dict(sha='external-merge')
        atomic(self.store.path, state)
        with patch('ship.local', return_value=dict(worktree='/fixture', branch='chore/fixture', head='new')):
            with self.assertRaisesRegex(ValueError, 'externally merged'):
                self.call('checkpoint', '--owner', 'chat', '--revision', '1', '--head', 'head')
        self.assertEqual(state, self.store.read())

    def test_plan_drift_blocks_checkpoint(self):
        self.claim()
        state = self.store.read(); state['queue'][0]['plan_refs'] = [dict(workstream='06', stages=[1])]
        atomic(self.store.path, state)
        with patch('ship.bind_plan', return_value={'changed': True}), self.assertRaisesRegex(ValueError, 'plans changed'):
            self.call('checkpoint', '--owner', 'chat', '--revision', '1', '--head', 'head')
        self.assertEqual(state, self.store.read())


class CatalogTests(unittest.TestCase):
    def test_all_requirement_packets_and_stages_are_registered(self):
        manifest = plans.catalog()
        packets = {item['id']: item for item in manifest['workstreams'] if item['id'] != '00'}
        self.assertEqual(len(packets), 10)
        self.assertEqual(sum(len(p['stages']) for p in packets.values()), 59)
        intake = json.loads((plans.HERE / 'intake.json').read_text())
        self.assertEqual(len(intake), 176)
        for item in intake:
            self.assertEqual(item['packet_file'], packets[item['workstream']]['file'])
        seed = json.loads((plans.HERE / 'queue.json').read_text())
        for row in seed['queue']: plans.validate_refs(row)


if __name__ == '__main__': unittest.main()
