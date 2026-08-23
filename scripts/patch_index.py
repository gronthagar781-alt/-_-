#!/usr/bin/env python3
"""Patch index.html with current-affairs date sorting fix."""
import sys

INDEX = "index.html"

with open(INDEX, "r", encoding="utf-8") as f:
    content = f.read()

original = content

# Patch 1: Insert caDateToISO() function before loadCurrentAffairs()
ca_func = (
    "function caDateToISO(s){const m=s.match(/(\\d{1,2})\\s+([A-Za-z]+)\\s+(\\d{4})/);"
    "if(!m)return '';const months={January:'01',February:'02',March:'03',April:'04',"
    "May:'05',June:'06',July:'07',August:'08',September:'09',October:'10',"
    "November:'11',December:'12'};const mo=months[m[2]];if(!mo)return '';"
    "return m[3]+'-'+mo+String(m[1]).padStart(2,'0');}"
)

anchor = "// PYQ\n\nfunction loadCurrentAffairs"
if anchor not in content:
    print("ERROR: anchor for caDateToISO insertion not found", file=sys.stderr)
    sys.exit(1)
content = content.replace(anchor, "// PYQ\n\n" + ca_func + "\n" + "function loadCurrentAffairs", 1)

# Patch 2 & 3: Replace .sort().reverse() with date-aware sort (2 occurrences)
old_sort = ".sort().reverse()"
new_sort = ".sort((a,b)=>(caDateToISO(b)||'').localeCompare(caDateToISO(a)||''))"
count = content.count(old_sort)
if count != 2:
    print(f"WARNING: expected 2 occurrences of '.sort().reverse()', found {count}", file=sys.stderr)
content = content.replace(old_sort, new_sort)

if content == original:
    print("No changes made - file already patched or patches don't match", file=sys.stderr)
    sys.exit(1)

with open(INDEX, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Patched index.html: {len(original)} -> {len(content)} chars ({len(content.encode('utf-8'))} bytes)")
