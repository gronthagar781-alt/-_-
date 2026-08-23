#!/usr/bin/env python3
"""Fix date button highlighting + remove source text."""
import os, re, sys

with open("index.html", "r", encoding="utf-8") as f:
    c = f.read()
changed = False

# 1. Fix date button: add ca-date-btn class, data-date attr, and inline dark/light blue styling
old_btn = """html+='<button class="btn '+(i===0?'btn-primary':'btn-back')+'" style="padding:8px 14px;font-size:.85rem" onclick="showCADate(\\''+d+'\\')">'+esc(d)+'</button>'"""
new_btn = """html+='<button class="btn ca-date-btn" data-date="'+esc(d)+'" style="padding:8px 14px;font-size:.85rem;background:'+(i===0?'#1a3a5c':'#d0e8ff')+';color:'+(i===0?'#fff':'#1a3a5c')+';border-color:'+(i===0?'#1a3a5c':'#91caff')+'" onclick="showCADate(\\''+d+'\\')">'+esc(d)+'</button>'"""

if old_btn in c:
    c = c.replace(old_btn, new_btn)
    changed = True
    print("Fix 1 applied: date button styling")
else:
    print("WARN: date button pattern not found")

# 2. Fix showCADate: add active button highlighting
old_show = """function showCADate(date){
const items=CURRENT_AFFAIRS.filter(m=>m.date===date);"""
new_show = """function showCADate(date){
document.querySelectorAll('.ca-date-btn').forEach(function(b){b.style.background='#d0e8ff';b.style.color='#1a3a5c';b.style.borderColor='#91caff'});
var ab=document.querySelector('.ca-date-btn[data-date="'+date+'"]');
if(ab){ab.style.background='#1a3a5c';ab.style.color='#fff';ab.style.borderColor='#1a3a5c'}
const items=CURRENT_AFFAIRS.filter(m=>m.date===date);"""

if old_show in c:
    c = c.replace(old_show, new_show)
    changed = True
    print("Fix 2 applied: active date highlighting")
else:
    print("WARN: showCADate pattern not found")

# 3. Remove source text
old_src = """<p>সাম্প্রতিক ঘটনাবলি থেকে গুরুত্বপূর্ণ তথ্য। উৎস: kolom.in</p>"""
new_src = """<p>সাম্প্রতিক ঘটনাবলি থেকে গুরুত্বপূর্ণ তথ্য।</p>"""
if old_src in c:
    c = c.replace(old_src, new_src)
    changed = True
    print("Fix 3 applied: source text removed")
else:
    print("WARN: source text pattern not found")

if changed:
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(c)
    print("index.html patched successfully!")
else:
    print("No changes needed")
