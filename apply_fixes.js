// Patch script v5: UI improvements
// 1. Show first name from email instead of full email
// 2. Add show/hide password toggle on all password fields
// 3. Add welcome message on dashboard
// 4. Clean up auth screens
const fs = require('fs');
const path = require('path');

const indexPath = path.join(process.cwd(), 'index.html');
let src = fs.readFileSync(indexPath, 'utf-8');
let changed = false;

// ===== FIX 1: Helper function to extract first name from email =====
const helperFunc = `
// Extract first name from email (e.g. "champakdak@gmail.com" -> "Champakdak")
function getFirstNameFromEmail(email) {
  if (!email) return '';
  var name = email.split('@')[0];
  name = name.split('.')[0].split('_')[0].split('-')[0].split('+')[0];
  if (name.length > 0) {
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }
  return name;
}
`;

if (!src.includes('function getFirstNameFromEmail')) {
  const renderLoginIdx = src.indexOf('function renderLogin()');
  if (renderLoginIdx === -1) { console.error('Cannot find renderLogin'); process.exit(1); }
  src = src.slice(0, renderLoginIdx) + helperFunc + '\n' + src.slice(renderLoginIdx);
  changed = true;
  console.log('OK: getFirstNameFromEmail helper added');
} else { console.log('SKIP: getFirstNameFromEmail already exists'); }

// ===== FIX 2: Replace email display with first name in user bar =====
const oldEmailDisplay = "document.getElementById('auth-user-email').textContent = user.email;";
const newEmailDisplay = "document.getElementById('auth-user-email').textContent = '\u09b8\u09cd\u09ac\u09be\u0997\u09a4\u09ae\u09cd, ' + getFirstNameFromEmail(user.email);";
if (src.includes(oldEmailDisplay)) {
  src = src.replace(oldEmailDisplay, newEmailDisplay);
  changed = true; console.log('OK: User bar now shows first name');
} else { console.log('SKIP: email display pattern not found'); }

// ===== FIX 3: Add show/hide password toggle CSS =====
const pwdToggleCSS = `
.pwd-wrap{position:relative}
.pwd-wrap input{padding-right:44px !important}
.pwd-toggle{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1.1rem;color:var(--gray);padding:4px 6px;border-radius:6px;transition:all .2s;line-height:1}
.pwd-toggle:hover{color:var(--p1);background:rgba(102,126,234,0.1)}
`;
if (!src.includes('pwd-toggle')) {
  const styleEnd = src.indexOf('</style>');
  if (styleEnd !== -1) { src = src.slice(0, styleEnd) + pwdToggleCSS + '\n' + src.slice(styleEnd); changed = true; console.log('OK: Password toggle CSS added'); }
} else { console.log('SKIP: pwd-toggle CSS already exists'); }

// Add toggle JS function
const toggleJS = `
function togglePwd(id) {
  var inp = document.getElementById(id);
  if (!inp) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    event.target.textContent = '\u{1F648}';
  } else {
    inp.type = 'password';
    event.target.textContent = '\u{1F441}';
  }
}
`;
if (!src.includes('function togglePwd')) {
  const helperEnd = src.indexOf("return name;\n}\n");
  if (helperEnd !== -1) {
    const insertPos = helperEnd + "return name;\n}\n".length;
    src = src.slice(0, insertPos) + '\n' + toggleJS + src.slice(insertPos);
    changed = true; console.log('OK: togglePwd function added');
  }
} else { console.log('SKIP: togglePwd already exists'); }

// ===== FIX 4: Add password toggle to login screen =====
const oldLoginPwd = `      <input type="password" id="auth-password" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" autocomplete="current-password">
    </div>
    <button class="auth-btn auth-btn-primary" onclick="doLogin()"`;
const newLoginPwd = `      <div class="pwd-wrap">
        <input type="password" id="auth-password" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" autocomplete="current-password">
        <button type="button" class="pwd-toggle" onclick="togglePwd('auth-password')">\u{1F441}</button>
      </div>
    </div>
    <button class="auth-btn auth-btn-primary" onclick="doLogin()"`;
if (src.includes(oldLoginPwd)) {
  src = src.replace(oldLoginPwd, newLoginPwd); changed = true; console.log('OK: Login password toggle added');
} else { console.log('SKIP: login password pattern not found'); }

// ===== FIX 5: Add password toggle to set-password screen =====
const oldSetPwd1 = `      <input type="password" id="auth-new-password" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" autocomplete="new-password">
    </div>
    <div class="auth-field">
      <label>\u09aa\u09be\u09b8\u0993\u09af\u09bc\u09be\u09b0\u09cd\u09a1 \u0986\u09ac\u09be\u09b0 \u09a6\u09bf\u09a8</label>
      <input type="password" id="auth-confirm-password" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" autocomplete="new-password">
    </div>
    <button class="auth-btn auth-btn-primary" onclick="doSetPassword()"`;
const newSetPwd1 = `      <div class="pwd-wrap">
        <input type="password" id="auth-new-password" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" autocomplete="new-password">
        <button type="button" class="pwd-toggle" onclick="togglePwd('auth-new-password')">\u{1F441}</button>
      </div>
    </div>
    <div class="auth-field">
      <label>\u09aa\u09be\u09b8\u0993\u09af\u09bc\u09be\u09b0\u09cd\u09a1 \u0986\u09ac\u09be\u09b0 \u09a6\u09bf\u09a8</label>
      <div class="pwd-wrap">
        <input type="password" id="auth-confirm-password" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" autocomplete="new-password">
        <button type="button" class="pwd-toggle" onclick="togglePwd('auth-confirm-password')">\u{1F441}</button>
      </div>
    </div>
    <button class="auth-btn auth-btn-primary" onclick="doSetPassword()"`;
if (src.includes(oldSetPwd1)) {
  src = src.replace(oldSetPwd1, newSetPwd1); changed = true; console.log('OK: Set-password toggles added');
} else { console.log('SKIP: set-password pattern not found'); }

// ===== FIX 6: Add password toggle to forgot-verify screen =====
const oldForgotPwd = `      <input type="password" id="auth-new-password" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" autocomplete="new-password">
    </div>
    <button class="auth-btn auth-btn-primary" onclick="doForgotVerifyAndReset`;
const newForgotPwd = `      <div class="pwd-wrap">
        <input type="password" id="auth-new-password" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" autocomplete="new-password">
        <button type="button" class="pwd-toggle" onclick="togglePwd('auth-new-password')">\u{1F441}</button>
      </div>
    </div>
    <button class="auth-btn auth-btn-primary" onclick="doForgotVerifyAndReset`;
if (src.includes(oldForgotPwd)) {
  src = src.replace(oldForgotPwd, newForgotPwd); changed = true; console.log('OK: Forgot-verify password toggle added');
} else { console.log('SKIP: forgot-verify password pattern not found'); }

// ===== FIX 7: Add welcome to dashboard =====
const oldDashboardStart = "html+=`<div class=\"card\"><h2>\ud83c\udfaf \u0986\u099c\u0995\u09c7\u09b0 \u099f\u09be\u09b0\u09cd\u0997\u09c7\u099f</h2>`;";
const newDashboardStart = "if(currentUser){html+=`<div class=\"card\" style=\"text-align:center;background:linear-gradient(135deg,rgba(102,126,234,0.08),rgba(118,75,162,0.08));border:1px solid var(--border)\"><h2 style=\"margin:0;color:var(--p2)\">\u{1F44B} \u09b8\u09cd\u09ac\u09be\u0997\u09a4\u09ae\u09cd, ${esc(getFirstNameFromEmail(currentUser.email))}!</h2></div>`}html+=`<div class=\"card\"><h2>\ud83c\udfaf \u0986\u099c\u0995\u09c7\u09b0 \u099f\u09be\u09b0\u09cd\u0997\u09c7\u099f</h2>`;";
if (src.includes(oldDashboardStart)) {
  src = src.replace(oldDashboardStart, newDashboardStart); changed = true; console.log('OK: Welcome message added to dashboard');
} else { console.log('SKIP: dashboard start pattern not found'); }

// ===== FIX 8: Improve user bar styling =====
const oldUserBarCSS = ".auth-user-bar .user-email{color:#ddd;font-size:.75rem;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}";
const newUserBarCSS = ".auth-user-bar .user-email{color:#fff;font-size:.8rem;font-weight:600;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}";
if (src.includes(oldUserBarCSS)) { src = src.replace(oldUserBarCSS, newUserBarCSS); changed = true; console.log('OK: User bar text styling improved'); }
else { console.log('SKIP: user bar CSS pattern not found'); }

const oldBarBg = ".auth-user-bar{position:fixed;top:0;right:0;z-index:1001;display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(15,12,41,0.8);backdrop-filter:blur(10px);border-bottom-left-radius:12px;border:1px solid var(--border);border-top:none;border-right:none}";
const newBarBg = ".auth-user-bar{position:fixed;top:0;right:0;z-index:1001;display:flex;align-items:center;gap:10px;padding:10px 14px;background:linear-gradient(135deg,rgba(102,126,234,0.9),rgba(118,75,162,0.9));backdrop-filter:blur(10px);border-bottom-left-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.2)}";
if (src.includes(oldBarBg)) { src = src.replace(oldBarBg, newBarBg); changed = true; console.log('OK: User bar background improved'); }
else { console.log('SKIP: user bar bg pattern not found'); }

const oldLogoutBtn = ".auth-user-bar .logout-btn{background:rgba(250,112,154,0.2);color:#fa709a;border:1px solid rgba(250,112,154,0.3);padding:4px 10px;border-radius:8px;font-size:.75rem;cursor:pointer;font-family:inherit}";
const newLogoutBtn = ".auth-user-bar .logout-btn{background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.3);padding:5px 12px;border-radius:8px;font-size:.75rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s}";
if (src.includes(oldLogoutBtn)) { src = src.replace(oldLogoutBtn, newLogoutBtn); changed = true; console.log('OK: Logout button styling improved'); }
else { console.log('SKIP: logout button CSS pattern not found'); }

// ===== FIX 9: Improve auth field input styling =====
const oldInputCSS = ".auth-field input{width:100%;padding:12px 16px;border:2px solid var(--border);border-radius:12px;font-size:1rem;font-family:inherit;background:rgba(255,255,255,0.9);color:var(--text);box-sizing:border-box}";
const newInputCSS = ".auth-field input{width:100%;padding:12px 16px;border:2px solid var(--border);border-radius:12px;font-size:1rem;font-family:inherit;background:#fff;color:var(--text);box-sizing:border-box;transition:border-color .2s}";
if (src.includes(oldInputCSS)) { src = src.replace(oldInputCSS, newInputCSS); changed = true; console.log('OK: Input field styling improved'); }
else { console.log('SKIP: input CSS pattern not found'); }

if (changed) {
  fs.writeFileSync(indexPath, src, 'utf-8');
  console.log('\nSUCCESS: All UI fixes applied.');
} else {
  console.log('\nNO CHANGES needed.');
}
