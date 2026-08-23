// Patch script v6: clean up header/nav — remove duplicate code, merge header into nav, simplify
const fs = require('fs');
const path = require('path');

const indexPath = path.join(process.cwd(), 'index.html');
let src = fs.readFileSync(indexPath, 'utf-8');
let changed = false;

// ===== FIX 1: Remove the subtitle line from header =====
const oldHeader = `<div class="header">
<h1><span class="icon">\u{1F3DB}\uFE0F</span> \u0997\u09cd\u09b0\u09be\u09ae \u09aa\u099e\u09cd\u099a\u09be\u09af\u09bc\u09c7\u09a4 \u09aa\u09b0\u09c0\u0995\u09cd\u09b7\u09be - \u09b8\u09ae\u09cd\u09aa\u09c2\u09b0\u09cd\u09a3 \u09aa\u09cd\u09b0\u09b8\u09cd\u09a4\u09c1\u09a4\u09bf</h1>
<p>\u09aa\u099e\u09cd\u099a\u09be\u09af\u09bc\u09c7\u09a4 \u09ac\u09cd\u09af\u09ac\u09b8\u09cd\u09a5\u09be \u2022 \u09ac\u09be\u0982\u09b2\u09be \u2022 English \u2022 \u0997\u09a3\u09bf\u09a4 \u2022 \u09b8\u09be\u09a7\u09be\u09b0\u09a3 \u099c\u09cd\u099e\u09be\u09a8 \u2022 \u09ae\u0995 \u099f\u09c7\u09b8\u09cd\u099f</p>
</div>`;

const newHeader = `<div class="header">
<h1><span class="icon">\u{1F3DB}\uFE0F</span> \u0997\u09cd\u09b0\u09be\u09ae \u09aa\u099e\u09cd\u099a\u09be\u09af\u09bc\u09c7\u09a4 \u09aa\u09b0\u09c0\u0995\u09cd\u09b7\u09be</h1>
</div>`;

if (src.includes(oldHeader)) {
  src = src.replace(oldHeader, newHeader);
  changed = true;
  console.log('OK: Header simplified');
} else { console.log('SKIP: header not found'); }

// ===== FIX 2: Make header more compact =====
const oldHeaderCSS = ".header{background:linear-gradient(135deg,var(--p1),var(--p2));color:#fff;padding:20px;text-align:center;position:sticky;top:0;z-index:1000;box-shadow:0 4px 30px rgba(0,0,0,0.3);backdrop-filter:blur(10px)}";
const newHeaderCSS = ".header{background:linear-gradient(135deg,var(--p1),var(--p2));color:#fff;padding:10px 16px;text-align:center;position:sticky;top:0;z-index:1000;box-shadow:0 4px 20px rgba(0,0,0,0.25);backdrop-filter:blur(10px)}";
if (src.includes(oldHeaderCSS)) { src = src.replace(oldHeaderCSS, newHeaderCSS); changed = true; console.log('OK: Header compact'); }
else { console.log('SKIP: header CSS not found'); }

// ===== FIX 3: Nav — horizontally scrollable, no wrap =====
const oldNavCSS = ".nav{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;padding:12px;background:rgba(15,12,41,0.8);backdrop-filter:blur(10px);position:sticky;top:60px;z-index:999;border-bottom:1px solid var(--border)}";
const newNavCSS = ".nav{display:flex;flex-wrap:nowrap;overflow-x:auto;gap:6px;padding:8px 12px;background:rgba(15,12,41,0.9);backdrop-filter:blur(10px);position:sticky;top:46px;z-index:999;border-bottom:1px solid var(--border);-webkit-overflow-scrolling:touch;scrollbar-width:none}.nav::-webkit-scrollbar{display:none}";
if (src.includes(oldNavCSS)) { src = src.replace(oldNavCSS, newNavCSS); changed = true; console.log('OK: Nav scrollable'); }
else { console.log('SKIP: nav CSS not found'); }

// ===== FIX 4: Mobile nav offset =====
const oldMediaNav = ".nav{top:55px}";
const newMediaNav = ".nav{top:42px}";
if (src.includes(oldMediaNav)) { src = src.replace(oldMediaNav, newMediaNav); changed = true; console.log('OK: Nav mobile offset'); }
else { console.log('SKIP: media nav not found'); }

// ===== FIX 5: Header h1 compact =====
const oldH1CSS = ".header h1{font-size:1.4rem;}";
const newH1CSS = ".header h1{font-size:1.05rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}";
if (src.includes(oldH1CSS)) { src = src.replace(oldH1CSS, newH1CSS); changed = true; console.log('OK: h1 compact'); }
else { console.log('SKIP: h1 CSS not found'); }

// ===== FIX 6: Hide header p =====
const oldHeaderPCSS = ".header p{font-size:0.8rem;opacity:0.85;margin-top:4px}";
if (src.includes(oldHeaderPCSS)) { src = src.replace(oldHeaderPCSS, ".header p{display:none}"); changed = true; console.log('OK: header p hidden'); }
else { console.log('SKIP: header p CSS not found'); }

// ===== FIX 7: Mobile header h1 =====
const oldMediaH1 = ".header h1{font-size:1.05rem}";
const newMediaH1 = ".header h1{font-size:0.95rem}";
if (src.includes(oldMediaH1)) { src = src.replace(oldMediaH1, newMediaH1); changed = true; console.log('OK: mobile h1'); }
else { console.log('SKIP: media h1 not found'); }

// ===== FIX 8: Nav buttons compact =====
const oldNavBtnCSS = ".nav-btn{background:rgba(255,255,255,0.08);color:#ddd;border:1px solid rgba(255,255,255,0.15);padding:8px 14px;border-radius:12px;cursor:pointer;font-size:0.8rem;transition:all 0.3s;font-family:inherit;white-space:nowrap;-webkit-tap-highlight-color:transparent;touch-action:manipulation}";
const newNavBtnCSS = ".nav-btn{background:rgba(255,255,255,0.08);color:#ddd;border:1px solid rgba(255,255,255,0.15);padding:7px 12px;border-radius:10px;cursor:pointer;font-size:0.78rem;transition:all 0.3s;font-family:inherit;white-space:nowrap;flex-shrink:0;-webkit-tap-highlight-color:transparent;touch-action:manipulation}";
if (src.includes(oldNavBtnCSS)) { src = src.replace(oldNavBtnCSS, newNavBtnCSS); changed = true; console.log('OK: nav-btn compact'); }
else { console.log('SKIP: nav-btn CSS not found'); }

// ===== FIX 9: User bar compact =====
const oldUserBarPos = ".auth-user-bar{position:fixed;top:0;right:0;z-index:1001;display:flex;align-items:center;gap:10px;padding:10px 14px;background:linear-gradient(135deg,rgba(102,126,234,0.9),rgba(118,75,162,0.9));backdrop-filter:blur(10px);border-bottom-left-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.2)}";
const newUserBarPos = ".auth-user-bar{position:fixed;top:0;right:0;z-index:1001;display:flex;align-items:center;gap:8px;padding:6px 10px;background:linear-gradient(135deg,rgba(102,126,234,0.9),rgba(118,75,162,0.9));backdrop-filter:blur(10px);border-bottom-left-radius:14px;box-shadow:0 4px 20px rgba(0,0,0,0.2)}";
if (src.includes(oldUserBarPos)) { src = src.replace(oldUserBarPos, newUserBarPos); changed = true; console.log('OK: user bar compact'); }
else { console.log('SKIP: user bar not found'); }

// ===== FIX 10: Sync badge position =====
const oldSyncBadge = ".auth-sync-badge{position:fixed;top:52px;right:8px;z-index:1001;background:rgba(0,176,155,0.15);color:#00b09b;padding:4px 10px;border-radius:8px;font-size:.7rem;border:1px solid rgba(0,176,155,0.2);display:none}";
const newSyncBadge = ".auth-sync-badge{position:fixed;top:48px;right:8px;z-index:1001;background:rgba(0,176,155,0.15);color:#00b09b;padding:3px 8px;border-radius:8px;font-size:.68rem;border:1px solid rgba(0,176,155,0.2);display:none}";
if (src.includes(oldSyncBadge)) { src = src.replace(oldSyncBadge, newSyncBadge); changed = true; console.log('OK: sync badge'); }
else { console.log('SKIP: sync badge not found'); }

if (changed) {
  fs.writeFileSync(indexPath, src, 'utf-8');
  console.log('\nSUCCESS: Header/nav cleanup applied.');
} else {
  console.log('\nNO CHANGES needed.');
}
