// Patch script v3: complete fix for data isolation + confetti
// Handles both fresh and previously-patched files
const fs = require('fs');
const path = require('path');

const indexPath = path.join(process.cwd(), 'index.html');
let src = fs.readFileSync(indexPath, 'utf-8');
let changed = false;

// ===== CONFETTI FUNCTION DEFINITION =====
// Insert confetti code between nextQ and submitQuiz if not already present
const confettiBlock = `
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
  const count=Math.min(100,Math.floor(W/6));
  for(let i=0;i<count;i++){
    confettiParticles.push({
      x:Math.random()*W,
      y:-20-Math.random()*H*0.2,
      vx:(Math.random()-0.5)*5,
      vy:3+Math.random()*5,
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
    if(elapsed>500)p.life-=0.04;
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
`;

// Check if confetti function definition exists
if (!src.includes('function showConfetti()')) {
  // Insert before submitQuiz function
  const submitIdx = src.indexOf('function submitQuiz(){');
  if (submitIdx === -1) {
    console.error('Cannot find submitQuiz function to insert confetti');
    process.exit(1);
  }
  // Find the line before submitQuiz
  const beforeSubmit = src.lastIndexOf('\n', submitIdx);
  src = src.slice(0, beforeSubmit + 1) + confettiBlock + '\n' + src.slice(beforeSubmit + 1);
  changed = true;
  console.log('Confetti function definition inserted before submitQuiz');
} else {
  // Already has confetti function
  console.log('Confetti function already exists');
  // Update particle count
  src = src.replace(
    /const count=Math\.min\(\d+,Math\.floor\(W\/\d+\)\)/,
    'const count=Math.min(100,Math.floor(W/6))'
  );
  // Update decay timing
  src = src.replace(
    /if\(elapsed>\d+\)p\.life-=0\.\d+/,
    'if(elapsed>500)p.life-=0.04'
  );
  changed = true;
  console.log('Confetti timing updated to ~1s');
}

// ===== DOLOGOUT: flush BEFORE signOut =====
if (src.includes('await flushPendingSync();\n  if (sb) {')) {
  console.log('doLogout: flush already before signOut');
} else if (src.includes("try { await sb.auth.signOut(); } catch(e) {}\n  }\n  // Flush any pending sync")) {
  const oldPattern = `  if (sb) {
    try { await sb.auth.signOut(); } catch(e) {}
  }
  // Flush any pending sync to the current user's cloud record BEFORE clearing
  await flushPendingSync();
  currentUser = null;`;
  const newPattern = `  await flushPendingSync();
  if (sb) {
    try { await sb.auth.signOut(); } catch(e) {}
  }
  currentUser = null;`;
  src = src.replace(oldPattern, newPattern);
  changed = true;
  console.log('doLogout: flush moved BEFORE signOut');
} else if (src.includes('await flushPendingSync();\n  if (sb) {\n    try { await sb.auth.signOut()')) {
  console.log('doLogout: already fixed (flush before signOut)');
} else {
  console.error('doLogout: unexpected pattern');
  process.exit(1);
}

// ===== ONAUTHSUCCESS: don't flush with wrong session =====
if (src.includes('pendingSave = null;\n  // Clear local data from previous user')) {
  console.log('onAuthSuccess: already discards stray pendingSave');
} else if (src.includes('await flushPendingSync();\n  // Clear local data from previous user')) {
  const oldPattern = `  currentUser = user;
  // Flush any pending sync from the PREVIOUS user to their own cloud record
  await flushPendingSync();
  // Clear local data from previous user`;
  const newPattern = `  currentUser = user;
  // Discard any stray pendingSave from previous session (session is gone, can't write)
  if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
  pendingSave = null;
  // Clear local data from previous user`;
  src = src.replace(oldPattern, newPattern);
  changed = true;
  console.log('onAuthSuccess: now discards stray pendingSave instead of flushing');
} else {
  console.error('onAuthSuccess: unexpected pattern');
  process.exit(1);
}

// ===== ENSURE showConfetti() calls exist =====
// Day target complete
if (src.includes("addHistory('plan','\u09a6\u09bf\u09a8 '+dayNum+' \u09b8\u09ae\u09cd\u09aa\u09a8\u09cd\u09a8: '+c.title,'\u2705');\nshowConfetti();\nshowPage('plan');")) {
  console.log('Day-target confetti call already present');
} else if (src.includes("addHistory('plan','\u09a6\u09bf\u09a8 '+dayNum+' \u09b8\u09ae\u09cd\u09aa\u09a8\u09cd\u09a8: '+c.title,'\u2705');\nalert('\u09a6\u09bf\u09a8 '+dayNum+' \u09b8\u09ae\u09cd\u09aa\u09a8\u09cd\u09a8! \u09aa\u09b0\u09c7\u09b0 \u09a6\u09bf\u09a8 \u0986\u09a8\u09b2\u0995 \u09b9\u09af\u09bc\u09c7\u099b\u09c7\u0964');\nshowPage('plan');")) {
  src = src.replace(
    "addHistory('plan','\u09a6\u09bf\u09a8 '+dayNum+' \u09b8\u09ae\u09cd\u09aa\u09a8\u09cd\u09a8: '+c.title,'\u2705');\nalert('\u09a6\u09bf\u09a8 '+dayNum+' \u09b8\u09ae\u09cd\u09aa\u09a8\u09cd\u09a8! \u09aa\u09b0\u09c7\u09b0 \u09a6\u09bf\u09a8 \u0986\u09a8\u09b2\u0995 \u09b9\u09af\u09bc\u09c7\u099b\u09c7\u0967');\nshowPage('plan');",
    "addHistory('plan','\u09a6\u09bf\u09a8 '+dayNum+' \u09b8\u09ae\u09cd\u09aa\u09a8\u09cd\u09a8: '+c.title,'\u2705');\nshowConfetti();\nshowPage('plan');"
  );
  changed = true;
  console.log('Day-target: alert replaced with showConfetti()');
} else {
  console.log('Day-target: confetti call pattern already present or alert already removed');
}

// Quiz score >= 80%
if (src.includes('if(p>=80)showConfetti();')) {
  console.log('Quiz 80% confetti call already present');
} else {
  const quizSaveLine = "saveProgress(progress);addHistory(quiz.isMock?'mocktest':(quiz.type||'practice'),`${tn}: ${c}/${t} (${p}%)`,`\u2705${c} \u09b8\u09a0\u09bf\u0995, \u274c${w} \u09ad\u09c1\u09b2, \u2796${sk} \u09ac\u09be\u09a6`);";
  if (src.includes(quizSaveLine)) {
    src = src.replace(quizSaveLine, quizSaveLine + '\nif(p>=80)showConfetti();');
    changed = true;
    console.log('Quiz: confetti on 80% added');
  } else {
    console.log('Quiz: save line pattern not found (may already be patched)');
  }
}

if (changed) {
  fs.writeFileSync(indexPath, src, 'utf-8');
  console.log('\nAll fixes applied. index.html updated.');
} else {
  console.log('\nNo changes needed.');
}
