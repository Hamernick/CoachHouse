"""Read the existing private workstream packets; never copy prompt text into receipts."""
import hashlib
import json
from pathlib import Path
import re

from gates import require

HERE = Path(__file__).resolve().parent


def catalog():
    return json.loads((HERE / 'plans.json').read_text())


def packet_root(root=None):
    return Path(root) if root else Path.home() / catalog()['private_root']


def private_file(root, name):
    base = Path(root).resolve()
    relative = Path(name)
    require(not relative.is_absolute() and '..' not in relative.parts, 'Unsafe plan path')
    path = base / relative
    require(not path.is_symlink() and path.resolve().is_relative_to(base), 'Plan file escapes private root')
    require(path.is_file(), f'Missing original plan: {path}; restore the private planning backup')
    return path


def stage_lines(text, section):
    lines = text.splitlines()
    require(section in lines, f'Original plan section missing: {section}')
    start = lines.index(section) + 1
    level = len(section) - len(section.lstrip('#'))
    end = next((i for i in range(start, len(lines)) if re.match(r'^#{1,' + str(level) + r'} ', lines[i])), len(lines))
    stages = {}
    for index in range(start, end):
        match = re.match(r'^(\d+)\. ', lines[index])
        if match:
            number = int(match[1])
            require(number not in stages, 'Ambiguous duplicate plan stage')
            stages[number] = index + 1
    return stages


def validate_refs(row):
    refs = row.get('plan_refs')
    require(isinstance(refs, list) and bool(refs), 'Slice requires exact original plan_refs')
    registered = {item['id']: item for item in catalog()['workstreams']}
    seen = set()
    for ref in refs:
        require(isinstance(ref, dict), 'Invalid plan reference')
        key = ref.get('workstream')
        require(key in registered and key not in seen, 'Unknown or duplicate plan workstream')
        seen.add(key)
        stages = ref.get('stages')
        require(isinstance(stages, list) and bool(stages)
                and all(type(n) is int and n in registered[key]['stages'] for n in stages)
                and len(stages) == len(set(stages)), 'Select existing numbered plan stages')
    intake = json.loads((HERE / 'intake.json').read_text())
    known = {item['id']: item for item in intake}
    for source_id in row.get('source_ids', []):
        if source_id.startswith('O'):
            require(source_id in known, 'Unknown original requirement ID')
            require(known[source_id]['workstream'] in seen, 'Include the requirement primary packet in plan_refs')
    return refs


def read_plan(row, root=None):
    manifest = catalog()
    root = packet_root(root)
    refs = validate_refs(row)
    registered = {item['id']: item for item in manifest['workstreams']}
    names = list(manifest['context_files'])
    selected = []
    contents = {}
    for ref in refs:
        item = registered[ref['workstream']]
        path = private_file(root, item['file'])
        contents[item['file']] = path.read_bytes()
        text = contents[item['file']].decode()
        locations = stage_lines(text, item['section'])
        require(list(locations) == item['stages'], 'Original plan stages changed; reconcile the manifest')
        selected.append(dict(workstream=ref['workstream'], file=item['file'], section=item['section'],
                             stages=ref['stages'], lines=[locations[n] for n in ref['stages']]))
        names.append(item['file'])
    documents = []
    for name in dict.fromkeys(names):
        path = private_file(root, name)
        data = contents[name] if name in contents else path.read_bytes()
        documents.append(dict(file=name, path=str(path), sha256=hashlib.sha256(data).hexdigest(), text=data.decode()))
    binding = dict(plan_refs=selected, files=[dict(file=d['file'], sha256=d['sha256']) for d in documents])
    return documents, binding


def bind_plan(row, root=None):
    return read_plan(row, root)[1]


def print_prompt(row, root=None):
    documents, binding = read_plan(row, root)
    print('Read these original files in full, including original requests, decisions and checkpoints.')
    print('Selected stages narrow the task; they do not override source boundaries or reopen completed work.')
    print(json.dumps({key: row[key] for key in ('id', 'scope', 'exclusions', 'acceptance') if key in row}, indent=2))
    print(json.dumps(binding['plan_refs'], indent=2))
    for document in documents:
        print(f'\n--- ORIGINAL PRIVATE FILE: {document["path"]} ---\n{document["text"]}')
    print('\nSanitized source binding (no prompt text):')
    print(json.dumps(binding, indent=2))
