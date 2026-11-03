#!/usr/bin/env python3
"""One private document cleanup on the explicitly isolated local C3 stack.

No application RPC grant or hosted runner authority. Supply the owned database
password via PGPASSWORD and its Storage service key via
COACH_HOUSE_CLOSURE_STORAGE_SERVICE_KEY. Never put either in command arguments.
A partial/unknown Storage result retains the exact reservation for explicit retry.

Local qualification requires the existing supabase_admin login: the owned-stack
postgres login is not a superuser and is correctly refused. This does NOT prove
that a managed host exposes supabase_admin or any role satisfying the guard.
Actual target-role authority must be qualified before any production worker or
owner controls; this local-only runner does not relax or create that authority.
"""
import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid


class CleanupError(Exception):
    pass


def identifier(value):
    parsed = str(uuid.UUID(value))
    if parsed != value:
        raise argparse.ArgumentTypeError("Use canonical lowercase UUIDs")
    return value


def local_endpoint(value, port, database=False):
    parsed = urllib.parse.urlsplit(value)
    schemes = ("postgres", "postgresql") if database else ("http",)
    if (parsed.scheme not in schemes or parsed.hostname != "127.0.0.1"
            or parsed.port != port or parsed.password or parsed.query or parsed.fragment
            or (not database and (parsed.username or parsed.path not in ("", "/")))
            or (database and parsed.path != "/postgres")):
        raise CleanupError("Only the owned local C3 endpoint is supported")
    return value.rstrip("/")


def operator(database, function, args):
    # UUID/integer arguments are validated before SQL construction. Database
    # credentials stay in the inherited private environment, never argv/output.
    source_id = getattr(args, "storage_object", None) or args.file
    values = ",".join([f"'{args.organization}'::uuid", f"'{source_id}'::uuid",
                       f"'{args.closure_request}'::uuid", str(args.closure_revision),
                       f"'{args.operation}'::uuid"])
    if getattr(args, "storage_object", None):
        # The origin is the already-validated fixed owned local endpoint, not a
        # caller-supplied SQL fragment or authority inferred from a public URL.
        values += ", 'http://127.0.0.1:55321'::text"
    # libpq PGHOSTADDR/PGSERVICE can otherwise override a validated URL host.
    # Pin the resolved address and carry only the explicitly supplied password.
    process_env = {key: value for key, value in os.environ.items() if not key.startswith("PG")}
    process_env.pop("COACH_HOUSE_CLOSURE_STORAGE_SERVICE_KEY", None)
    if "PGPASSWORD" in os.environ:
        process_env["PGPASSWORD"] = os.environ["PGPASSWORD"]
    process_env["PGOPTIONS"] = "-c statement_timeout=15000 -c timezone=UTC"
    result = subprocess.run(["psql", "-XqAt", "-v", "ON_ERROR_STOP=1", "-d", database + "?hostaddr=127.0.0.1"],
                            input=f"select to_jsonb(public.{function}({values}));\n",
                            text=True, capture_output=True, timeout=30, check=False,
                            env=process_env)
    if result.returncode:
        # Raw PostgreSQL context can contain private paths; keep public errors
        # bounded and leave exact canonical state for the operator to inspect.
        raise CleanupError("Private database admission or completion failed; retain the exact request and retry only after inspection")
    try:
        return json.loads(result.stdout.strip())
    except ValueError as error:
        raise CleanupError("Unrecognized private database receipt") from error


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise CleanupError("Storage redirects are not allowed")


def storage_request(opener, base, key, method, path, body=None):
    data = None if body is None else json.dumps(body).encode("utf-8")
    request = urllib.request.Request(base + path, data=data, method=method,
                                     headers={"Authorization": "Bearer " + key,
                                              "apikey": key, "Content-Type": "application/json"})
    try:
        with opener.open(request, timeout=30) as response:
            payload = response.read(1024 * 1024 + 1)
            if len(payload) > 1024 * 1024:
                raise CleanupError("Storage response exceeded the bounded receipt")
            return response.status, payload
    except urllib.error.HTTPError as error:
        return error.code, error.read(4096)


def run(args):
    database = local_endpoint(args.database_url, 55322, database=True)
    storage = local_endpoint(args.storage_url, 55321)
    if args.closure_revision < 1:
        raise CleanupError("Closure revision must be positive")
    key = os.environ.get("COACH_HOUSE_CLOSURE_STORAGE_SERVICE_KEY")
    if not key:
        raise CleanupError("Private owned-stack Storage key is required in the environment")
    object_mode = bool(getattr(args, "storage_object", None))
    source_id = args.storage_object if object_mode else args.file
    identity_key = "objectId" if object_mode else "fileId"
    receipt_keys = {identity_key, "paths", "complete"} | ({"bucket"} if object_mode else set())
    owner = "asset" if object_mode else "document"
    scope = "organization_storage_asset" if object_mode else "organization_document_file"
    receipt = operator(database, f"reserve_expired_closure_{owner}_purge", args)
    if (not isinstance(receipt, dict) or set(receipt) != receipt_keys
            or receipt[identity_key] != source_id or not isinstance(receipt["complete"], bool)
            or not isinstance(receipt["paths"], list) or not 1 <= len(receipt["paths"]) <= 151
            or any(not isinstance(path, str) or not path.startswith(args.organization + ("/" if object_mode else "/library/"))
                   or ".." in path.split("/") for path in receipt["paths"])
            or len(set(receipt["paths"])) != len(receipt["paths"])):
        raise CleanupError("Unrecognized frozen path receipt; no Storage deletion attempted")
    bucket = receipt["bucket"] if object_mode else "org-documents"
    if bucket not in {"org-documents", "org-media", "program-media", "roadmap-media"} or (object_mode and len(receipt["paths"]) != 1):
        raise CleanupError("Unrecognized exact asset bucket; no Storage deletion attempted")
    if receipt["complete"]:
        return {"scope": scope, "complete": True,
                "replayed": True, "storageRequested": False, "releaseQualified": False}
    # Disable ambient proxies and redirects: even a bad local response must not
    # forward the service credential to an unapproved remote endpoint.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    status, _ = storage_request(opener, storage, key, "DELETE", "/storage/v1/object/" + bucket,
                                {"prefixes": receipt["paths"]})
    if status != 200:
        raise CleanupError("Storage removal was not confirmed; frozen reservation retained")
    # Metadata cannot be finalized merely because a delete call returned. The
    # canonical SQL owner separately verifies every storage.objects row absent.
    # HTTP absence is access evidence, not a claim about retained provider backups.
    for path in receipt["paths"]:
        status, payload = storage_request(opener, storage, key, "GET",
                                           "/storage/v1/object/authenticated/" + bucket + "/" + urllib.parse.quote(path, safe="/"))
        if status == 404:
            continue
        if status == 400:
            try:
                error = json.loads(payload)
            except ValueError:
                error = {}
            if str(error.get("statusCode")) == "404" and error.get("error") in ("not_found", "Not found"):
                continue
        raise CleanupError("Storage absence was not confirmed; frozen reservation retained")
    if operator(database, f"finish_expired_closure_{owner}_purge", args) is not True:
        raise CleanupError("Canonical cleanup completion was not confirmed")
    return {"scope": scope, "complete": True, "replayed": False,
            "storageRequested": True, "storageApiAbsenceConfirmed": True,
            "pathCount": len(receipt["paths"]), "releaseQualified": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url", required=True)
    parser.add_argument("--storage-url", required=True)
    parser.add_argument("--organization", type=identifier, required=True)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--file", type=identifier)
    source.add_argument("--storage-object", type=identifier,
                        help="Exact400 modern media/tracked-document/policy object mode")
    parser.add_argument("--closure-request", type=identifier, required=True)
    parser.add_argument("--closure-revision", type=int, required=True)
    parser.add_argument("--operation", type=identifier, required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(run(args), sort_keys=True))
        return 0
    except (CleanupError, subprocess.TimeoutExpired, urllib.error.URLError, OSError, ValueError) as error:
        message = str(error) if isinstance(error, CleanupError) else "Operator transport failed; retain the exact request for inspection"
        print(json.dumps({"complete": False, "error": message, "releaseQualified": False}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
