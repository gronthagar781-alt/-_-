// Patch script: applies 3 fixes to index.html
// 1. Fix alternate-login data clearing (flush pending sync + guard against user switch)
// 2. Remove alert on day-target complete, show confetti instead
// 3. Add confetti animation on target complete and test score >= 80%
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'index.html');
let src = fs.readFileSync(indexPath, 'utf-8');
let changed = false;

// ---- FIX 1: Replace saveCloudData + debouncedCloudSync with user-safe versions ----
const oldSync = `async function saveCloudData(key, value) {
  if (!sb || !currentUser) return;
  try {
    const { error } = await sb.from('user_data').upsert({
      user_id: currentUser.id,
      data_key: key,
      data_value: JSON.stringify(value),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,data_key' });
    if (error) throw error;
  } catch (e) {
    console.error('Cloud save error:', e);
  }
}

// Debounced cloud sync
function debouncedCloudSync(key, value) {
  if (!sb || !currentUser) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    saveCloudData(key, value);
    showSyncBadge('✓ সেভ হয়েছে', false);
    setTimeout(() => {
      const b = document.getElementById('auth-sync-badge');
      if (b) b.classList.remove('show');
    }, 3000);
  }, 2000);
}`;

const newSync = `let pendingSave = null; // {key, value, userId} - captured at schedule time

async function saveCloudDataForUser(userId, key, value) {
  if (!sb || !userId) return;
  try {
    const { error } = await sb.from('user_data').upsert({
      user_id: userId,
      data_key: key,
      data_value: JSON.stringify(value),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,data_key' });
    if (error) throw error;
  } catch (e) {
    console.error('Cloud save error:', e);
  }
}

async function saveCloudData(key, value) {
  if (!sb || !currentUser) return;
  await saveCloudDataForUser(currentUser.id, key, value);
}

// Flush any pending sync to the ORIGINAL user's cloud record (even if user switched)
async function flushPendingSync() {
  if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
  if (pendingSave) {
    const ps = pendingSave;
    pendingSave = null;
    await saveCloudDataForUser(ps.userId, ps.key, ps.value);
  }
}

// Debounced cloud sync
function debouncedCloudSync(key, value) {
  if (!sb || !currentUser) return;
  const userId = currentUser.id;
  pendingSave = { key, value, userId };
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    const ps = pendingSave;
    pendingSave = null;
    // Abort if user switched since the sync was scheduled
    if (!currentUser || currentUser.id !== userId) return;
    saveCloudData(ps.key, ps.value);
    showSyncBadge('✓ সেভ হয়েছে', false);
    setTimeout(() => {
      const b = document.getElementById('auth-sync-badge');
      if (b) b.classList.remove('show');
    }, 3000);
  }, 2000);
}`;

if (src.includes(oldSync)) {
  src = src.replace(oldSync, newSync);
  changed = true;
  console.log('✓ Fix 1: Cloud sync hardened against user switch');
} else if (src.includes('flushPendingSync')) {
  console.log('✓ Fix 1: Already applied (flushPendingSync found)');
} else {
  console.error('✗ Fix 1: Could not find sync block to patch');
  process.exit(1);
}

// ---- FIX 1b: Add flushPendingSync() calls in onAuthSuccess and doLogout ----
const oldAuthSuccess = `async function onAuthSuccess(user) {
  currentUser = user;
  // Clear local data from previous user`;
const newAuthSuccess = `async function onAuthSuccess(user) {
  currentUser = user;
  // Flush any pending sync from the PREVIOUS user to their own cloud record
  await flushPendingSync();
  // Clear local data from previous user`;
if (src.includes(oldAuthSuccess) && !src.includes('await flushPendingSync();\n  // Clear local data from previous user')) {
  src = src.replace(oldAuthSuccess, newAuthSuccess);
  changed = true;
  console.log('✓ Fix 1b: flushPendingSync added to onAuthSuccess');
} else if (src.includes(newAuthSuccess)) {
  console.log('✓ Fix 1b: Already applied (onAuthSuccess)');
} else {
  console.error('✗ Fix 1b: Could not patch onAuthSuccess');
  process.exit(1);
}

const oldLogout = `async function doLogout() {
  if (sb) {
    try { await sb.auth.signOut(); } catch(e) {}
  }
  currentUser = null;`;
const newLogout = `async function doLogout() {
  if (sb) {
    try { await sb.auth.signOut(); } catch(e) {}
  }
  // Flush any pending sync to the current user's cloud record BEFORE clearing
  await flushPendingSync();
  currentUser = null;`;
if (src.includes(oldLogout) && !src.includes('await flushPendingSync();\n  currentUser = null;')) {
  src = src.replace(oldLogout, newLogout);
  changed = true;
  console.log('✓ Fix 1c: flushPendingSync added to doLogout');
} else if (src.includes(newLogout)) {
  console.log('✓ Fix 1c: Already applied (doLogout)');
} else {
  console.error('✗ Fix 1c: Could not patch doLogout');
  process.exit(1);
}

// ---- FIX 2: Remove alert on day-target complete ----
const oldAlert = `addHistory('plan','দিন '+dayNum+' সম্পন্ন: '+c.title,'✅');
alert('দিন '+dayNum+' সম্পন্ন! পরের দিন আনলক হয়েছে।');
showPage('plan');`;
const newAlert = `addHistory('plan','দিন '+dayNum+' সম্পন্ন: '+c.title,'✅');
showConfetti();
showPage('plan');`;
if (src.includes(oldAlert)) {
  src = src.replace(oldAlert, newAlert);
  changed = true;
  console.log('✓ Fix 2: Alert replaced with confetti on day-target complete');
} else if (src.includes(newAlert)) {
  console.log('✓ Fix 2: Already applied (confetti on complete)');
} else {
  console.error('✗ Fix 2: Could not find alert to remove');
  process.exit(1);
}

// ---- FIX 3: Add showConfetti() call on test score >= 80% ----
const oldQuizSave = "saveProgress(progress);addHistory(quiz.isMock?'mocktest':(quiz.type||'practice'),`${tn}: ${c}/${t} (${p}%)`,`✅${c} সঠিক, ❌${w} ভুল, ➖${sk} বাদ`);";
const newQuizSave = oldQuizSave + "\nif(p>=80)showConfetti();";
if (src.includes(oldQuizSave) && !src.includes("if(p>=80)showConfetti();")) {
  src = src.replace(oldQuizSave, newQuizSave);
  changed = true;
  console.log('✓ Fix 3a: Confetti trigger added on score >= 80%');
} else if (src.includes("if(p>=80)showConfetti();")) {
  console.log('✓ Fix 3a: Already applied (confetti on 80%)');
} else {
  console.error('✗ Fix 3a: Could not find quiz save block');
  process.exit(1);
}

// ---- FIX 3b: Add confetti animation code before submitQuiz ----
const confettiCode = `function prevQ(){if(quiz.currentQ>0){quiz.currentQ--;renderQuiz(quiz.pageId)}}
function nextQ(){if(quiz.currentQ<quiz.set.questions.length-1){quiz.currentQ++;renderQuiz(quiz.pageId)}}

// ===== CONFETTI / VICTORY ANIMATION =====
let confettiCanvas=null,confettiCtx=null,confettiParticles=[],confettiRAF=null,confettiStart=0;
const CONFETTI_COLORS=['#667eea','#764ba2','#f093fb','#4facfe','#00f2fe','#00b09b','#96c93d','#fa709a','#fee140','#ffd700','#ff6b6b'];
function showConfetti(){
  if(confettiRAF){cancelAnimationFrame(confettiRAF);confettiRAF=null}
  if(!confettiCanvas){
    confettiCanvas=document.createElement('canvas');
    confettiCanvas.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999';
    document.body.appendChild(confettiCanvas);
    confettiCtx=confettiCanvas.getContext('2d');
  }
  const dpr=window.devicePixelRatio||1;
  confettiCanvas.width=window.innerWidth*dpr;
  confettiCanvas.height=window.innerHeight*dpr;
  confettiCtx.setTransform(1,0,0,1,0,0);
  confettiCtx.scale(dpr,dpr);
  confettiCanvas.style.display='block';
  confettiParticles=[];
  const W=window.innerWidth,H=window.innerHeight;
  const count=Math.min(180,Math.floor(W/4));
  for(let i=0;i<count;i++){
    confettiParticles.push({
      x:Math.random()*W,
      y:-20-Math.random()*H*0.3,
      vx:(Math.random()-0.5)*6,
      vy:2+Math.random()*4,
      size:6+Math.random()*8,
      color:CONFETTI_COLORS[Math.floor(Math.random()*CONFETTI_COLORS.length)],
      rot:Math.random()*Math.PI*2,
      vr:(Math.random()-0.5)*0.3,
      shape:Math.random()<0.5?'rect':'circle',
      life:1
    });
  }
  confettiStart=Date.now();
  animateConfetti();
}
function animateConfetti(){
  if(!confettiCtx)return;
  const W=window.innerWidth,H=window.innerHeight;
  confettiCtx.clearRect(0,0,W,H);
  const elapsed=Date.now()-confettiStart;
  let alive=0;
  confettiParticles.forEach(p=>{
    if(elapsed>3500)p.life-=0.012;
    p.x+=p.vx;
    p.y+=p.vy;
    p.vy+=0.08;
    p.rot+=p.vr;
    if(p.y>H+30)p.y=-20;
    if(p.life>0){
      alive++;
      confettiCtx.save();
      confettiCtx.translate(p.x,p.y);
      confettiCtx.rotate(p.rot);
      confettiCtx.globalAlpha=Math.max(0,p.life);
      confettiCtx.fillStyle=p.color;
      if(p.shape==='rect'){
        confettiCtx.fillRect(-p.size/2,-p.size/2,p.size,p.size*0.6);
      }else{
        confettiCtx.beginPath();
        confettiCtx.arc(0,0,p.size/2,0,Math.PI*2);
        confettiCtx.fill();
      }
      confettiCtx.restore();
    }
  });
  if(alive>0){
    confettiRAF=requestAnimationFrame(animateConfetti);
  }else{
    confettiCanvas.style.display='none';
    confettiRAF=null;
  }
}
window.addEventListener('resize',function(){
  if(confettiCanvas&&confettiCanvas.style.display!=='none'){
    const dpr=window.devicePixelRatio||1;
    confettiCanvas.width=window.innerWidth*dpr;
    confettiCanvas.height=window.innerHeight*dpr;
    confettiCtx.setTransform(1,0,0,1,0,0);
    confettiCtx.scale(dpr,dpr);
  }
});

function submitQuiz(){`;

const oldPrevNext = `function prevQ(){if(quiz.currentQ>0){quiz.currentQ--;renderQuiz(quiz.pageId)}}
function nextQ(){if(quiz.currentQ<quiz.set.questions.length-1){quiz.currentQ++;renderQuiz(quiz.pageId)}}
function submitQuiz(){`;

if (src.includes(oldPrevNext) && !src.includes('showConfetti')) {
  src = src.replace(oldPrevNext, confettiCode);
  changed = true;
  console.log('✓ Fix 3b: Confetti animation code added');
} else if (src.includes('showConfetti')) {
  console.log('✓ Fix 3b: Already applied (confetti code present)');
} else {
  console.error('✗ Fix 3b: Could not find insertion point');
  process.exit(1);
}

if (changed) {
  fs.writeFileSync(indexPath, src, 'utf-8');
  console.log('\n✅ All fixes applied successfully. index.html updated.');
} else {
  console.log('\nℹ️  No changes needed — all fixes already present.');
}
