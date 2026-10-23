"""Untrusted recovery input: validate the full snapshot and every receipt before writes."""
import json
from pathlib import Path

from gates import require
from store import digest, receipt_path


def snapshot_name(state):
    revision = state['revision']
    require(type(revision) is int and revision >= 0, 'Invalid snapshot revision')
    return f'{revision:06d}-{digest(state)[:16]}.json'


def read_snapshot(path):
    path = Path(path)
    require(not path.is_symlink(), 'Recovery snapshot cannot be a symlink')
    state = json.loads(path.read_text())
    require(path.name == snapshot_name(state), 'Recovery snapshot revision/content hash mismatch')
    return state


def load_receipts(state, directory):
    payloads = []
    seen = set()
    for item in state['receipts']:
        name = item['file']
        path = receipt_path(directory, name)
        require(name not in seen, 'Duplicate receipt filename')
        seen.add(name)
        data = json.loads(path.read_text())
        require(digest(data) == item['sha256'], 'Restore receipt hash mismatch')
        payloads.append((name, data))
    return payloads
