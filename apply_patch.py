#!/usr/bin/env python3
"""Patch index.html to fix Current Affairs date sorting.

Replaces the buggy string sort().reverse() with ISO-based chronological sort.
This script is designed to be run by GitHub Actions on the repo checkout.
"""
import re, sys

with open('index.html','r',encoding='utf-8') as f:
    c = f.read()

helper = "function caDateToISO(s){const m=s.match(/(\\d{1,2})\\s+([A-Za-z]+)\\s+(\\d{4})/);if(!m)return '';const months={January:'01',February:'02',March:'03',April:'04',May:'05',June:'06',July:'07',August:'08',September:'09',October:'10',November:'11',December:'12'};const mo=months[m[2]];if(!mo)return '';return m[3]+'-'+mo+String(m[1]).padStart(2,'0');}\n"

old1 = "function loadCurrentAffairs(){\nconst dates=[...new Set(CURRENT_AFFAIRS.map(m=>m.date))].sort().reverse();"
new1 = helper + "function loadCurrentAffairs(){\nconst dates=[...new Set(CURRENT_AFFAIRS.map(m=>m.date))].sort((a,b)=>(caDateToISO(b)||'').localeCompare(caDateToISO(a)||''));"

old2 = "if(!q){const dates=[...new Set(CURRENT_AFFAIRS.map(m=>m.date))].sort().reverse();if(dates.length>0)showCADate(dates[0]);return}"
new2 = "if(!q){const dates=[...new Set(CURRENT_AFFAIRS.map(m=>m.date))].sort((a,b)=>(caDateToISO(b)||'').localeCompare(caDateToISO(a)||''));if(dates.length>0)showCADate(dates[0]);return}"

changed = False
if old1 in c:
    c = c.replace(old1, new1)
    changed = True
    print("Fix 1 applied: loadCurrentAffairs")

if old2 in c:
    c = c.replace(old2, new2)
    changed = True
    print("Fix 2 applied: searchCA")

if not changed:
    if 'function caDateToISO' in c:
        print("Patch already applied. No changes needed.")
        sys.exit(0)
    else:
        print("ERROR: Patterns not found and patch not already applied!")
        sys.exit(1)

with open('index.html','w',encoding='utf-8') as f:
    f.write(c)
print("Patch applied successfully!")
