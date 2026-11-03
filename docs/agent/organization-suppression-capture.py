#!/usr/bin/env python3
"""Local operator capture rehearsal. Never authorizes closure, replay or reopening."""

import argparse
from datetime import datetime, timedelta
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import stat
import subprocess
import sys
import tempfile
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
        payload_fields = {"closure_request": {"request"}, "closure_cancel": set(),
                          "response_deleted": {"response"}, "form_invitation_revoked": {"invitation"},
                          "form_reviewer_revoked": {"reviewer"},
                          "form_primary_manager_revoked": {"primaryManager"},
                          "workspace_page_invitation_revoked": {"pageInvitation"},
                          "workspace_page_note_scope_revoked": {"pageNoteScope"},
                          "workspace_page_access_revoked": {"pageAccess"},
                          "closure_early_delete_confirmed": {"earlyDeletion"}}
        require(isinstance(kind, str) and kind in payload_fields, "Unsupported event kind")
        require(set(event) == fields | payload_fields[kind], "Unexpected event fields")
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
        elif kind == "closure_early_delete_confirmed":
            confirmation = event["earlyDeletion"]
            require(isinstance(confirmation, dict) and set(confirmation) == {
                "closureRequestId", "ownerId", "consequencesVersion", "confirmedAt",
            }, "Invalid early deletion confirmation")
            uuid(confirmation["closureRequestId"])
            uuid(confirmation["ownerId"])
            require(confirmation["ownerId"] == event["organizationId"], "Early deletion owner mismatch")
            require(confirmation["consequencesVersion"] == "organization-early-deletion-v1", "Unknown early deletion consequences")
            require(timestamp(confirmation["confirmedAt"]) == occurred, "Early deletion capture time mismatch")
        elif kind == "response_deleted":
            response = event["response"]
            require(isinstance(response, dict) and set(response) == {"formId", "versionId", "responseId", "submittedAt"}, "Invalid deletion event")
            for field in ("formId", "versionId", "responseId"):
                uuid(response[field])
            require(timestamp(response["submittedAt"]) <= occurred, "Invalid deletion timing")
        elif kind == "form_invitation_revoked":
            invitation = event["invitation"]
            require(isinstance(invitation, dict) and set(invitation) == {
                "formId", "invitationId", "parentInvitationId", "permission", "createdAt",
            }, "Invalid invitation suppression event")
            for field in ("formId", "invitationId"):
                uuid(invitation[field])
            require(invitation["invitationId"] == event["operationId"], "Invitation suppression identity mismatch")
            if invitation["parentInvitationId"] is not None:
                uuid(invitation["parentInvitationId"])
                require(invitation["parentInvitationId"] != invitation["invitationId"], "Invalid invitation parent")
            require(invitation["permission"] in ("view", "correct", "edit", "manage"), "Invalid invitation permission")
            require(timestamp(invitation["createdAt"]) <= occurred, "Invalid invitation suppression timing")
        elif kind == "form_reviewer_revoked":
            reviewer = event["reviewer"]
            require(isinstance(reviewer, dict) and set(reviewer) == {
                "formId", "grantId", "generationId", "permission", "createdAt",
            }, "Invalid reviewer suppression event")
            for field in ("formId", "grantId", "generationId"):
                uuid(reviewer[field])
            require(reviewer["grantId"] == event["operationId"], "Reviewer suppression identity mismatch")
            require(reviewer["permission"] in ("view", "edit", "manage"), "Invalid reviewer permission")
            require(timestamp(reviewer["createdAt"]) <= occurred, "Invalid reviewer suppression timing")
        elif kind == "workspace_page_invitation_revoked":
            invitation = event["pageInvitation"]
            require(isinstance(invitation, dict) and set(invitation) == {
                "pageId", "invitationId", "parentInvitationId", "permission", "createdAt",
            }, "Invalid page invitation suppression event")
            require(event["revision"] == 1, "Invalid page invitation suppression revision")
            for field in ("pageId", "invitationId"):
                uuid(invitation[field])
            require(invitation["invitationId"] == event["operationId"], "Page invitation suppression identity mismatch")
            if invitation["parentInvitationId"] is not None:
                uuid(invitation["parentInvitationId"])
                require(invitation["parentInvitationId"] != invitation["invitationId"], "Invalid page invitation parent")
            require(invitation["permission"] in ("view", "edit", "manage"), "Invalid page invitation permission")
            require(timestamp(invitation["createdAt"]) <= occurred, "Invalid page invitation suppression timing")
        elif kind == "workspace_page_note_scope_revoked":
            scope = event["pageNoteScope"]
            require(isinstance(scope, dict) and set(scope) == {
                "pageId", "particleId", "canvasId", "sourceCreatedAt", "generationId", "grantId", "createdAt",
            }, "Invalid page note scope suppression event")
            require(event["revision"] == 1, "Invalid page note scope suppression revision")
            for field in ("pageId", "particleId", "generationId", "grantId"):
                uuid(scope[field])
            if scope["canvasId"] is not None:
                uuid(scope["canvasId"])
            require(scope["grantId"] == event["operationId"], "Page note scope suppression identity mismatch")
            timestamp(scope["sourceCreatedAt"])
            require(timestamp(scope["createdAt"]) <= occurred, "Invalid page note scope suppression timing")
        elif kind == "workspace_page_access_revoked":
            access = event["pageAccess"]
            require(isinstance(access, dict) and set(access) == {
                "domain", "pageId", "grantId", "generationId", "createdAt",
            }, "Invalid page access suppression event")
            require(access["domain"] in ("public", "guest", "image", "document"), "Invalid page access domain")
            for field in ("pageId", "grantId", "generationId"):
                uuid(access[field])
            require(access["grantId"] == event["operationId"], "Page access suppression identity mismatch")
            if access["domain"] in ("public", "guest"):
                require(event["revision"] == 1, "Invalid publication suppression revision")
            require(timestamp(access["createdAt"]) <= occurred, "Invalid page access suppression timing")
        elif kind == "form_primary_manager_revoked":
            primary = event["primaryManager"]
            require(isinstance(primary, dict) and set(primary) == {
                "formId", "grantId", "generationId", "createdAt",
            }, "Invalid primary manager suppression event")
            for field in ("formId", "grantId", "generationId"):
                uuid(primary[field])
            require(primary["grantId"] == event["operationId"], "Primary manager suppression identity mismatch")
            require(timestamp(primary["createdAt"]) <= occurred, "Invalid primary manager suppression timing")
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


def private_path(path, existing=False):
    require(path.is_absolute(), "Evidence path must be absolute")
    parent = path.parent.stat()
    require(stat.S_ISDIR(parent.st_mode) and parent.st_uid == os.getuid()
            and not parent.st_mode & 0o077, "Evidence requires an operator-owned private directory (0700)")
    if existing:
        info = path.lstat()
        require(stat.S_ISREG(info.st_mode) and info.st_uid == os.getuid()
                and not info.st_mode & 0o077, "Evidence must be an operator-owned private regular file")


def export_journal(journal, output, expected_source_id, expected_sha256):
    require(isinstance(expected_sha256, str) and re.fullmatch(r"[0-9a-f]{64}", expected_sha256),
            "Export requires the independently pinned successful capture digest")
    private_path(journal, existing=True)
    private_path(output)
    # A read transaction keeps metadata and events from one committed snapshot.
    connection = sqlite3.connect(journal.as_uri() + "?mode=ro", uri=True, isolation_level=None)
    try:
        connection.execute("begin")
        identities = connection.execute("select singleton,metadata from capture_identity").fetchall()
        require(len(identities) == 1 and identities[0][0] == 1, "Journal identity missing")
        metadata = json.loads(identities[0][1])
        require(isinstance(metadata, dict) and set(metadata) == {
            "format", "sourceId", "capturedSince", "historyRequiresReconciliation",
        } and canonical(metadata) == identities[0][1], "Invalid journal identity")
        rows = connection.execute("select sequence,event_id,payload,sha256 from suppression_events order by sequence limit 1001").fetchall()
        require(len(rows) <= 1000, "Capture limit exceeded")
        events = []
        for sequence, event_id, payload, sha in rows:
            require(isinstance(payload, str) and len(payload.encode()) <= 1048576, "Invalid journal event")
            event = json.loads(payload)
            require(isinstance(event, dict) and event.get("sequence") == sequence and event.get("eventId") == event_id
                    and canonical(event) == payload and hashlib.sha256(payload.encode()).hexdigest() == sha,
                    "Journal event integrity mismatch")
            events.append(event)
        snapshot = {**metadata, "highWater": len(events), "events": events}
        validate(snapshot, expected_source_id)
        data = canonical(snapshot).encode()
        require(len(data) <= 1048576, "Capture limit exceeded")
        require(hashlib.sha256(data).hexdigest() == expected_sha256,
                "Journal differs from the pinned capture receipt")
        connection.execute("commit")
    finally:
        connection.close()
    # Link a complete, fsynced private file into place without replacing evidence.
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=output.parent, prefix=".suppression-export-", delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.link(temporary, output)
        parent_fd = os.open(output.parent, os.O_RDONLY)
        try:
            os.fsync(parent_fd)
        finally:
            os.close(parent_fd)
    finally:
        if temporary is not None:
            temporary.unlink()
    require(output.read_bytes() == data, "Export readback mismatch")
    return {"exported": len(events), "sha256": hashlib.sha256(data).hexdigest(),
            "captureComplete": False, "releaseQualified": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--source")
    mode.add_argument("--export", type=Path, metavar="PRIVATE_MANIFEST_PATH")
    parser.add_argument("--journal", type=Path, required=True)
    parser.add_argument("--expected-source-id", required=True)
    parser.add_argument("--expected-sha256", help="Successful capture receipt digest; required for export")
    args = parser.parse_args()
    uuid(args.expected_source_id)
    if args.export:
        result = export_journal(args.journal, args.export, args.expected_source_id, args.expected_sha256)
    else:
        snapshot = read_source(args.source, args.expected_source_id)
        result = capture(snapshot, args.journal)
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except (CaptureError, OSError, ValueError, sqlite3.Error, subprocess.SubprocessError) as error:
        # Only controlled validation messages; provider/process/file errors can carry secrets.
        print(str(error) if isinstance(error, CaptureError) else "Capture failed; inspect private operator environment", file=sys.stderr)
        sys.exit(1)
