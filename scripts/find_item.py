import pathlib, re
pattern = re.compile(r"\bitem\b")
root = pathlib.Path('src')
for path in root.rglob('*.ts*'):
    try:
        text = path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        text = path.read_text(encoding='latin-1')
    for i, line in enumerate(text.splitlines(), 1):
        if 'item' not in line:
            continue
        if not pattern.search(line):
            continue
        if 'item.' in line:
            continue
        if 'items' in line:
            continue
        if 'item =>' in line or '=> item' in line:
            continue
        if 'const item' in line or 'let item' in line or 'function item' in line:
            continue
        print(f"{path}:{i}:{line.strip()}")
