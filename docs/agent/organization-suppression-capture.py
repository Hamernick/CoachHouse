#!/usr/bin/env python3
"""Local operator capture rehearsal. Never authorizes closure, replay or reopening."""

import argparse
from datetime import datetime, timedelta
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import stat
import subprocess
import sys
from urllib.parse import urlsplit
from uuid import UUID


class CaptureError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise CaptureError(message)


def canonical(value):
    return json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(",", ":"))


def uuid(value):
    require(isinstance(value, str), "Invalid opaque identifier")
    try:
        require(str(UUID(value)) == value, "Noncanonical opaque identifier")
    except (ValueError, AttributeError):
        raise CaptureError("Invalid opaque identifier") from None


def timestamp(value):
    require(isinstance(value, str) and value.endswith(("Z", "+00:00")), "Invalid UTC timestamp")
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
        require(result.utcoffset() == timedelta(0), "Invalid UTC timestamp")
        return result
    except ValueError:
        raise CaptureError("Invalid UTC timestamp") from None


def integer(value, minimum=1):
    require(type(value) is int and minimum <= value <= 2147483647, "Invalid counter")


def validate(snapshot, expected_source_id):
    require(isinstance(snapshot, dict) and set(snapshot) == {
        "format", "sourceId", "capturedSince", "historyRequiresReconciliation", "highWater", "events",
    }, "Invalid capture envelope")
    require(snapshot["format"] == "coach-house-suppression-capture-v1", "Unsupported capture format")
    uuid(snapshot["sourceId"])
    require(snapshot["sourceId"] == expected_source_id, "Source identity mismatch")
    timestamp(snapshot["capturedSince"])
    require(snapshot["historyRequiresReconciliation"] is True, "History qualification cannot be cleared")
    integer(snapshot["highWater"], 0)
    events = snapshot["events"]
    require(isinstance(events, list) and len(events) <= 1000, "Capture limit exceeded")
    require(len(events) == snapshot["highWater"], "Incomplete capture history")
    seen = set()
    for sequence, event in enumerate(events, 1):
        require(isinstance(event, dict), "Invalid event")
        fields = {"sequence", "eventId", "kind", "organizationId", "operationId", "revision", "occurredAt"}
        kind = event.get("kind")
        require(kind in ("closure_request", "closure_cancel", "response_deleted"), "Unsupported event kind")
        require(set(event) == fields | ({"request"} if kind == "closure_request" else
                                      {"response"} if kind == "response_deleted" else set()), "Unexpected event fields")
        integer(event["sequence"])
        require(event["sequence"] == sequence, "Noncontiguous capture history")
        for field in ("eventId", "organizationId", "operationId"):
            uuid(event[field])
        require(event["eventId"] not in seen, "Duplicate event identity")
        seen.add(event["eventId"])
        integer(event["revision"])
        occurred = timestamp(event["occurredAt"])
        if kind == "closure_request":
            request = event["request"]
            require(isinstance(request, dict) and set(request) == {"requestId", "requestedAt", "exportUntil"}, "Invalid closure event")
            uuid(request["requestId"])
            require(request["requestId"] == event["operationId"], "Closure operation mismatch")
            require(timestamp(request["exportUntil"]) - timestamp(request["requestedAt"]) == timedelta(hours=720), "Invalid original deadline")
        elif kind == "response_deleted":
            response = event["response"]
            require(isinstance(response, dict) and set(response) == {"formId", "versionId", "responseId", "submittedAt"}, "Invalid deletion event")
            for field in ("formId", "versionId", "responseId"):
                uuid(response[field])
            require(timestamp(response["submittedAt"]) <= occurred, "Invalid deletion timing")
    return events


def read_source(source, expected_source_id):
    parsed = urlsplit(source)
    require(parsed.scheme in ("postgres", "postgresql") and parsed.hostname in ("localhost", "127.0.0.1", "::1")
            and parsed.path not in ("", "/") and not parsed.password and not parsed.query and not parsed.fragment,
            "Only an explicit password-free local PostgreSQL source is supported")
    # No shell, pg startup file, source writes, source URL or database errors in logs.
    result = subprocess.run(["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", source, "-c",
                             "select public.read_organization_suppression_events();"],
                            capture_output=True, text=True, timeout=30, check=False)
    require(result.returncode == 0, "Source capture unavailable; journal unchanged")
    require(len(result.stdout.encode("utf-8")) <= 1048576, "Capture limit exceeded")
    try:
        snapshot = json.loads(result.stdout)
    except (ValueError, TypeError):
        raise CaptureError("Invalid source capture") from None
    validate(snapshot, expected_source_id)
    return snapshot


def open_journal(path):
    require(path.is_absolute(), "Journal path must be absolute")
    parent = path.parent.stat()
    require(stat.S_ISDIR(parent.st_mode) and parent.st_uid == os.getuid()
            and not parent.st_mode & 0o077, "Journal requires an operator-owned private directory (0700)")
    try:
        fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW, 0o600)
        os.fsync(fd)
        os.close(fd)
        parent_fd = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(parent_fd)
        finally:
            os.close(parent_fd)
    except FileExistsError:
        existing = path.lstat()
        require(stat.S_ISREG(existing.st_mode) and existing.st_uid == os.getuid()
                and not existing.st_mode & 0o077, "Journal must be an operator-owned private regular file")
    connection = sqlite3.connect(path, timeout=30, isolation_level=None)
    connection.execute("pragma journal_mode=DELETE")
    connection.execute("pragma synchronous=FULL")
    # macOS requests F_FULLFSYNC rather than relying on drive write-cache flushing.
    connection.execute("pragma fullfsync=ON")
    return connection


def capture(snapshot, journal):
    events = snapshot["events"]
    metadata = {key: value for key, value in snapshot.items() if key not in ("events", "highWater")}
    connection = open_journal(journal)
    try:
        connection.execute("begin immediate")
        connection.execute("create table if not exists capture_identity (singleton integer primary key check(singleton=1), metadata text not null)")
        connection.execute("create table if not exists suppression_events (sequence integer primary key, event_id text not null unique, payload text not null, sha256 text not null)")
        saved = connection.execute("select metadata from capture_identity where singleton=1").fetchone()
        require(saved is None or saved[0] == canonical(metadata), "Capture lineage or history boundary changed")
        if saved is None:
            require(connection.execute("select count(*) from suppression_events").fetchone()[0] == 0, "Journal identity missing")
            connection.execute("insert into capture_identity values (1,?)", (canonical(metadata),))
        prior = connection.execute("select sequence,event_id,payload,sha256 from suppression_events order by sequence").fetchall()
        require(len(prior) <= len(events), "Source history regressed; retained journal unchanged")
        for sequence, event_id, payload, sha in prior:
            require(1 <= sequence <= len(events), "Journal history is inconsistent")
            expected = canonical(events[sequence - 1])
            require(event_id == events[sequence - 1]["eventId"] and payload == expected
                    and sha == hashlib.sha256(expected.encode()).hexdigest(), "Suppression history conflict; retained journal unchanged")
        require([row[0] for row in prior] == list(range(1, len(prior) + 1)), "Journal history has gaps")
        for event in events[len(prior):]:
            payload = canonical(event)
            connection.execute("insert into suppression_events values (?,?,?,?)",
                               (event["sequence"], event["eventId"], payload, hashlib.sha256(payload.encode()).hexdigest()))
        connection.execute("commit")
    except BaseException:
        if connection.in_transaction:
            connection.execute("rollback")
        raise
    finally:
        connection.close()
    # Reopen and read the durable result; a lost reply is safe to retry exactly.
    with sqlite3.connect(journal) as readback:
        rows = readback.execute("select payload from suppression_events order by sequence").fetchall()
        require([row[0] for row in rows] == [canonical(event) for event in events], "Journal readback mismatch")
    return {"captured": len(events) - len(prior), "retained": len(events),
            "sha256": hashlib.sha256(canonical(snapshot).encode()).hexdigest(),
            "captureComplete": False, "releaseQualified": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True)
    parser.add_argument("--journal", type=Path, required=True)
    parser.add_argument("--expected-source-id", required=True)
    args = parser.parse_args()
    uuid(args.expected_source_id)
    snapshot = read_source(args.source, args.expected_source_id)
    print(json.dumps(capture(snapshot, args.journal), sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except (CaptureError, OSError, sqlite3.Error, subprocess.SubprocessError) as error:
        # Only controlled validation messages; provider/process/file errors can carry secrets.
        print(str(error) if isinstance(error, CaptureError) else "Capture failed; inspect private operator environment", file=sys.stderr)
        sys.exit(1)
