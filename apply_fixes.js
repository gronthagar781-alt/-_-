// Patch script v4: fix data loss (immediate cloud save, no debounce) + confetti on markRead
// ROOT CAUSE: debouncedCloudSync had a 2-second delay. If user logged out before
// the timer fired, data was lost. flushPendingSync was unreliable.
// FIX: save to cloud IMMEDIATELY in saveProgress/saveHistory (no debounce).
const fs = require('fs');
const path = require('path');

const indexPath = path.join(process.cwd(), 'index.html');
let src = fs.readFileSync(indexPath, 'utf-8');
let changed = false;

// ===== FIX 1: saveProgress — immediate cloud save, no debounce =====
const oldSaveProgress = "function saveProgress(d){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(d));debouncedCloudSync('progress',d)}catch(e){console.error(e)}}";
const newSaveProgress = `function saveProgress(d){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(d))}catch(e){console.error(e)}
  if(sb&&currentUser){
    saveCloudDataForUser(currentUser.id,'progress',d).then(function(){
      showSyncBadge('\u2713 \u09b8\u09c7\u09ad \u09b9\u09af\u09bc\u09c7\u099b\u09c7',false);
      setTimeout(function(){var b=document.getElementById('auth-sync-badge');if(b)b.classList.remove('show')},2000);
    }).catch(function(e){console.error('Cloud save error:',e)});
  }
}`;

if (src.includes(oldSaveProgress)) {
  src = src.replace(oldSaveProgress, newSaveProgress);
  changed = true;
  console.log('OK Fix 1: saveProgress now saves to cloud immediately');
} else {
  console.log('SKIP Fix 1: saveProgress pattern not found (may already be patched)');
}

// ===== FIX 2: saveHistory — immediate cloud save, no debounce =====
const oldSaveHistory = "function saveHistory(d){try{localStorage.setItem(HISTORY_KEY,JSON.stringify(d));debouncedCloudSync('history',d)}catch(e){}}";
const newSaveHistory = `function saveHistory(d){
  try{localStorage.setItem(HISTORY_KEY,JSON.stringify(d))}catch(e){}
  if(sb&&currentUser){
    saveCloudDataForUser(currentUser.id,'history',d).catch(function(e){console.error('Cloud save error:',e)});
  }
}`;

if (src.includes(oldSaveHistory)) {
  src = src.replace(oldSaveHistory, newSaveHistory);
  changed = true;
  console.log('OK Fix 2: saveHistory now saves to cloud immediately');
} else {
  console.log('SKIP Fix 2: saveHistory pattern not found (may already be patched)');
}

// ===== FIX 3: markRead — add showConfetti() when marking as read =====
const oldMarkRead = "function markRead(vi,ci){const v=STUDY_DATA[vi],c=v.chapters[ci],k=v.volume+'|'+c.title;progress.chapters_read[k]=!progress.chapters_read[k];saveProgress(progress);if(progress.chapters_read[k])addHistory('study',`${v.subject} - ${c.title}`,'\u09b8\u09ae\u09cd\u09aa\u09a8\u09cd\u09a8');renderStudySubjects()}";
const newMarkRead = "function markRead(vi,ci){const v=STUDY_DATA[vi],c=v.chapters[ci],k=v.volume+'|'+c.title;progress.chapters_read[k]=!progress.chapters_read[k];saveProgress(progress);if(progress.chapters_read[k]){addHistory('study',`${v.subject} - ${c.title}`,'\u09b8\u09ae\u09cd\u09aa\u09a8\u09cd\u09a8');showConfetti()}renderStudySubjects()}";

if (src.includes(oldMarkRead)) {
  src = src.replace(oldMarkRead, newMarkRead);
  changed = true;
  console.log('OK Fix 3: markRead now shows confetti on completion');
} else {
  console.log('SKIP Fix 3: markRead pattern not found');
}

// ===== FIX 4: Add beforeunload handler =====
if (!src.includes("addEventListener('beforeunload'") && !src.includes('addEventListener("beforeunload"')) {
  const oldCheckAuthCall = "checkAuthState();\n</script>";
  const beforeUnloadCode = `window.addEventListener('beforeunload',function(){
  if(syncTimer){clearTimeout(syncTimer);syncTimer=null}
});
checkAuthState();
</script>`;
  if (src.includes(oldCheckAuthCall)) {
    src = src.replace(oldCheckAuthCall, beforeUnloadCode);
    changed = true;
    console.log('OK Fix 4: beforeunload handler added');
  } else {
    console.log('SKIP Fix 4: checkAuthState() call pattern not found');
  }
} else {
  console.log('SKIP Fix 4: beforeunload handler already exists');
}

if (changed) {
  fs.writeFileSync(indexPath, src, 'utf-8');
  console.log('\nSUCCESS: All fixes applied. index.html updated.');
} else {
  console.log('\nNO CHANGES: All patterns already patched or not found.');
}
