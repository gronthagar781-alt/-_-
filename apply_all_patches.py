#!/usr/bin/env python3
"""Apply all UI fixes: app icon, date button styling, copyright."""
import base64, os, re, sys

ICONS = {
    "mipmap-mdpi": "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",
}

def create_icons():
    """Create all icon PNG files from base64 data."""
    for folder, b64 in ICONS.items():
        path = f"app/src/main/res/{folder}/ic_launcher.png"
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(base64.b64decode(b64))
        print(f"Created {path}")

def patch_index_html():
    """Patch index.html: date button styling + copyright."""
    with open("index.html", "r", encoding="utf-8") as f:
        c = f.read()
    changed = False

    old_btn = "html+='<button class=\\\"btn '+(i===0?'btn-primary':'btn-back')+'\\\" style=\\\"padding:8px 14px;font-size:.85rem\\\" onclick=\\\"showCADate(\\\\''+d+'\\\\')\\\">'+esc(d)+'</button>'"
    new_btn = "html+='<button class=\\\"btn ca-date-btn '+(i===0?'ca-date-active':'')+'\\\" data-date=\\\"'+esc(d)+'\\\" style=\\\"padding:8px 14px;font-size:.85rem;'+(i===0?'background:#1a3a5c;color:#fff;border-color:#1a3a5c':'background:#d0e8ff;color:#1a3a5c;border-color:#91caff')+'\\\" onclick=\\\"showCADate(\\\\''+d+'\\\\')\\\">'+esc(d)+'</button>'"

    if old_btn in c:
        c = c.replace(old_btn, new_btn)
        changed = True
        print("Fix 1 applied: date button styling")
    else:
        print("Note: date button pattern not found (may already be patched)")

    old_show = "function showCADate(date){\\nconst items=CURRENT_AFFAIRS.filter(m=>m.date===date);"
    new_show = "function showCADate(date){\\ndocument.querySelectorAll('.ca-date-btn').forEach(b=>{b.style.background='#d0e8ff';b.style.color='#1a3a5c';b.style.borderColor='#91caff'});\\nconst ab=document.querySelector('.ca-date-btn[data-date=\\\"'+date+'\\\"]');if(ab){ab.style.background='#1a3a5c';ab.style.color='#fff';ab.style.borderColor='#1a3a5c'}\\nconst items=CURRENT_AFFAIRS.filter(m=>m.date===date);"

    if old_show in c:
        c = c.replace(old_show, new_show)
        changed = True
        print("Fix 2 applied: active date highlighting")
    else:
        print("Note: showCADate pattern not found (may already be patched)")

    if "@Champ" not in c:
        copyright_html = "<div style='text-align:center;padding:12px;color:rgba(255,255,255,0.5);font-size:.8rem'>\\n&copy; 2026 পঞ্চায়েত প্রস্তুতি | সর্বস্বত্ব সংরক্ষিত<br>\\nDeveloped by @Champ\\n</div>\\n</body>"
        c = c.replace("</body>", copyright_html, 1)
        changed = True
        print("Fix 3 applied: copyright @Champ added")
    else:
        print("Note: copyright already present")

    if changed:
        with open("index.html", "w", encoding="utf-8") as f:
            f.write(c)
        print("index.html patched successfully!")
    else:
        print("No changes needed to index.html")

def patch_manifest():
    """Update AndroidManifest.xml to use custom icon."""
    with open("app/src/main/AndroidManifest.xml", "r", encoding="utf-8") as f:
        c = f.read()
    old_icon = 'android:icon="@android:drawable/ic_menu_info_details"'
    new_icon = 'android:icon="@mipmap/ic_launcher"'
    if old_icon in c:
        c = c.replace(old_icon, new_icon)
        with open("app/src/main/AndroidManifest.xml", "w", encoding="utf-8") as f:
            f.write(c)
        print("AndroidManifest.xml patched: custom icon set")
    else:
        print("Note: manifest icon pattern not found (may already be patched)")

if __name__ == "__main__":
    create_icons()
    patch_index_html()
    patch_manifest()
    print("\\nAll patches applied!")
