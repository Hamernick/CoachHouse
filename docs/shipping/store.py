"""One canonical, crash-safe store per Git common directory. No daemon."""
import contextlib
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import tempfile
from datetime import datetime, timezone


def run(*args, cwd=None):
    return subprocess.check_output(args, cwd=cwd, text=True, stderr=subprocess.PIPE).strip()


def utc():
    return datetime.now(timezone.utc).isoformat()


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def receipt_path(directory, name):
    # Accept only generated receipt basenames, never config/lock/state paths.
    if not isinstance(name, str) or not re.fullmatch(r'receipt-[0-9]{6,}-[0-9a-f]{16}\.json', name):
        raise ValueError('Unsafe receipt filename')
    root = Path(directory).resolve()
    path = root / name
    if path.is_symlink() or path.resolve().parent != root:
        raise ValueError('Receipt must remain directly inside its directory without symlinks')
    return path


def atomic(path, value):
    path = Path(path)
    fd, name = tempfile.mkstemp(prefix='.pending-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as stream:
            json.dump(value, stream, indent=2)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
        directory = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def process(pid):
    try:
        return run('ps', '-p', str(pid), '-o', 'lstart=').strip()
    except subprocess.CalledProcessError:
        return ''


def identity(owner, pid):
    started = process(pid)
    if not started:
        raise ValueError('Owner process is not running')
    return dict(owner=owner, pid=pid, started=started, host=socket.gethostname(), at=utc())


def dead(claim):
    if claim['host'] != socket.gethostname():
        raise ValueError('Cannot prove a remote-host owner stopped; reconcile on that host')
    current = process(claim['pid'])
    return not current or current != claim['started']


class Store:
    def __init__(self, directory):
        self.directory = Path(directory).resolve()
        self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.path = self.directory / 'state.json'

    @contextlib.contextmanager
    def lock(self):
        # Kernel lock is released on process death; never unlink this inode.
        with (self.directory / 'write.lock').open('a') as stream:
            fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
            yield

    def read(self):
        return json.loads(self.path.read_text())

    def initialize(self, seed, receipts=()):
        with self.lock():
            if self.path.exists():
                raise ValueError('Already initialized; use status/resume')
            destinations = [(receipt_path(self.directory, name), data) for name, data in receipts]
            for path, data in destinations:
                atomic(path, data)
            atomic(self.path, seed)

    def update(self, revision, head, change):
        with self.lock():
            state = self.read()
            if state['revision'] != revision:
                raise ValueError('Stale state revision')
            active = state.get('active')
            if active and active['head'] != head:
                raise ValueError('Stale recorded head')
            change(state)
            state['revision'] += 1
            state['updated_at'] = utc()
            atomic(self.path, state)
            return state


def canonical():
    common = run('git', 'rev-parse', '--path-format=absolute', '--git-common-dir')
    return Store(Path(common) / 'shipping')
