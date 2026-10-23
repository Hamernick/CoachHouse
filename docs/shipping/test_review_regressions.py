"""Regression cases for PR 291's release and recovery boundary findings."""
import copy
import json
import os
from pathlib import Path
import unittest
from unittest.mock import patch

from store import Store, atomic, digest
import test_ship as fixtures
from test_ship import evidence, seed


class ReviewRegressionTests(unittest.TestCase):
    setUp = fixtures.CommandTests.setUp
    call = fixtures.CommandTests.call
    claim = fixtures.CommandTests.claim

    def write_snapshot(self, state):
        path = self.here / 'receipts' / f'{state["revision"]:06d}-{digest(state)[:16]}.json'
        path.write_text(json.dumps(state))
        return path

    def test_blocked_released_heads_cannot_change(self):
        self.claim()
        for stage in ('merged', 'deployed', 'production_verified'):
            for operation in ('checkpoint', 'resume'):
                with self.subTest(stage=stage, operation=operation):
                    state = self.store.read()
                    state['queue'][0].update(status='blocked', resume_state=stage)
                    state['active']['evidence'] = evidence()
                    atomic(self.store.path, state)
                    original = self.store.path.read_bytes()
                    receipt = self.directory / 'resume.json'
                    receipt.write_text(json.dumps({'owner_evidence': 'Old process stopped', 'next_action': 'Resume released record'}))
                    with patch('ship.dead', return_value=operation == 'resume'), patch('ship.local', return_value=dict(worktree='/fixture', branch='chore/fixture', head='new')):
                        with self.assertRaisesRegex(ValueError, 'released revision'):
                            self.call(operation, '--owner', 'chat', '--pid', str(os.getpid()), '--revision', str(state['revision']), '--head', state['active']['head'], '--receipt', str(receipt))
                    self.assertEqual(self.store.path.read_bytes(), original)

    def test_blocked_prerelease_can_change_head(self):
        self.claim()
        state = self.store.read(); state['queue'][0].update(status='blocked', resume_state='approved')
        state['active']['evidence'] = evidence()
        del state['active']['evidence']['merge']  # This fixture has not actually merged.
        atomic(self.store.path, state)
        with patch('ship.local', return_value=dict(worktree='/fixture', branch='chore/fixture', head='new')):
            self.call('checkpoint', '--owner', 'chat', '--revision', '1', '--head', 'head')
        updated = self.store.read()
        self.assertEqual(updated['active']['head'], 'new')
        self.assertEqual(updated['active']['evidence'], {})

    def test_restore_rejects_unsafe_names_without_writing(self):
        for name in ('../config', '/tmp/ship-absolute-fixture', 'nested/receipt.json', './state.json', '..\\config', 'state.json', 'write.lock'):
            with self.subTest(name=name):
                target = Store(self.directory / 'target' / 'shipping')
                sentinel = target.directory.parent / 'config'; sentinel.write_text('preserve config')
                state = seed(); state['receipts'] = [dict(file=name, sha256=digest({'payload': True}))]
                # A valid snapshot checksum must not make an unsafe child path acceptable.
                snapshot = self.write_snapshot(state)
                with patch('ship.canonical', return_value=target):
                    with self.assertRaises(ValueError): self.call('init', '--receipt', str(snapshot))
                self.assertEqual(sentinel.read_text(), 'preserve config')
                self.assertFalse(target.path.exists())

    def test_parent_path_exploit_cannot_overwrite_config(self):
        target = Store(self.directory / 'git' / 'shipping')
        victim = target.directory.parent / 'config'; victim.write_text('original Git configuration')
        payload = {'replace': 'configuration'}
        (self.here / 'config').write_text(json.dumps(payload))
        state = seed(); state['receipts'] = [dict(file='../config', sha256=digest(payload))]
        with patch('ship.canonical', return_value=target):
            with self.assertRaises(ValueError): self.call('init', '--receipt', str(self.write_snapshot(state)))
        self.assertEqual(victim.read_text(), 'original Git configuration')
        self.assertFalse(target.path.exists())

    def test_snapshot_edits_are_rejected_with_unchanged_receipts(self):
        state = seed()
        path = self.write_snapshot(state)
        for change in ('scope', 'revision'):
            modified = copy.deepcopy(state)
            if change == 'scope': modified['queue'][0]['scope'] = 'silently changed scope'
            else: modified['revision'] = 7
            path.write_text(json.dumps(modified))
            target = Store(self.directory / ('restore-' + change))
            with patch('ship.canonical', return_value=target):
                with self.assertRaisesRegex(ValueError, 'snapshot'):
                    self.call('init', '--receipt', str(path))
            self.assertFalse(target.path.exists())

    def test_restore_rejects_source_and_destination_symlinks(self):
        name = 'receipt-000001-0123456789abcdef.json'
        payload = {'payload': True}
        external = self.directory / 'external.json'; external.write_text(json.dumps(payload))
        for side in ('source', 'destination'):
            target = Store(self.directory / ('restore-' + side))
            source = self.here / 'receipts' / name
            if source.exists() or source.is_symlink(): source.unlink()
            if side == 'source': source.symlink_to(external)
            else:
                source.write_text(json.dumps(payload))
                (target.directory / name).symlink_to(external)
            state = seed(); state['receipts'] = [dict(file=name, sha256=digest(payload))]
            with patch('ship.canonical', return_value=target):
                with self.assertRaises(ValueError): self.call('init', '--receipt', str(self.write_snapshot(state)))
            self.assertEqual(json.loads(external.read_text()), payload)
            self.assertFalse(target.path.exists())

    def test_validate_and_export_reject_unsafe_receipt_paths(self):
        payload = {'replace': 'configuration'}
        victim = self.store.directory.parent / 'config'; victim.write_text(json.dumps(payload))
        output = self.here / 'config'; output.write_text('preserve tracked config')
        state = seed(); state['receipts'] = [dict(file='../config', sha256=digest(payload))]
        atomic(self.store.path, state)
        for operation in ('validate', 'export'):
            with self.subTest(operation=operation), self.assertRaises(ValueError): self.call(operation)
        self.assertEqual(output.read_text(), 'preserve tracked config')
        self.assertEqual(json.loads(victim.read_text()), payload)

    def test_bad_later_receipt_leaves_no_partial_restore(self):
        target = Store(self.directory / 'restore-partial')
        state = seed()
        for number in (1, 2):
            name = f'receipt-{number:06d}-0123456789abcdef.json'
            payload = {'number': number}
            (self.here / 'receipts' / name).write_text(json.dumps(payload))
            state['receipts'].append(dict(file=name, sha256=digest(payload) if number == 1 else 'invalid'))
        with patch('ship.canonical', return_value=target):
            with self.assertRaises(ValueError): self.call('init', '--receipt', str(self.write_snapshot(state)))
        self.assertFalse(target.path.exists())
        self.assertEqual(list(target.directory.glob('receipt-*')), [])


if __name__ == '__main__': unittest.main()
