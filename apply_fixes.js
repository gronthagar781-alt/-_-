const fs=require('fs');
let html=fs.readFileSync('index.html','utf8');
let changes=[];

// Decode helper
function d(s){return Buffer.from(s,'base64').toString('utf8')}

// === PATCH 1: Add new MCQs to SUBJECT_MCQS ===
try {
  const mcqsStart=html.indexOf('const SUBJECT_MCQS=');
  const mcqsEnd=html.indexOf('];',mcqsStart);
  if(mcqsStart===-1||mcqsEnd===-1)throw new Error('SUBJECT_MCQS not found');
  
  // Read TSV files and convert to MCQ objects
  const tsvParts=[];
  for(let i=1;i<=4;i++){
    try{tsvParts.push(fs.readFileSync('mcqs_tsv_part'+i+'.txt','utf8'))}catch(e){}
  }
  const tsv=tsvParts.join('\n');
  const lines=tsv.split('\n').filter(l=>l.trim());
  const newMcqs=lines.map(line=>{
    const [category,subsubject,question,optA,optB,optC,optD,answer]=line.split('\t');
    return {category,subsubject,question,options:{A:optA,B:optB,C:optC,D:optD},answer};
  });
  
  const newMcqsJs=newMcqs.map(m=>JSON.stringify(m)).join(',');
  html=html.substring(0,mcqsEnd)+','+newMcqsJs+html.substring(mcqsEnd);
  changes.push('Added '+newMcqs.length+' new MCQs to SUBJECT_MCQS');
} catch(e) { console.error('PATCH 1 failed:',e.message); }

// === PATCH 2: Remove duplicate startSubjectQuiz ===
try {
  const oldSq1=d('ZnVuY3Rpb24gc3RhcnRTdWJqZWN0UXVpeihjYXQpewpjb25zdCBxcz1TVUJKRUNUX01DUVMuZmlsdGVyKG09Pm0uY2F0ZWdvcnk9PT1jYXQpOwpjb25zdCBxc2k9cXMubWFwKChtLGkpPT4oe251bWJlcjppKzEscXVlc3Rpb246bS5xdWVzdGlvbixvcHRpb25zOm0ub3B0aW9uc30pKTsKY29uc3QgYW5zd2Vycz17fTtxcy5mb3JFYWNoKChtLGkpPT57YW5zd2Vyc1tpKzFdPW0uYW5zd2VyfSk7CnN0YXJ0UXVpekVuZ2luZSh7dGl0bGU6Y2F0Kycg4KaV4KeB4KaH4KacJyxxdWVzdGlvbnM6cXNpLGFuc3dlcnM6YW5zd2VycyxleHBsYW5hdGlvbnM6e319LCdzdWJqZWN0LXF1aXonLHRydWUpCn0=');
  if(html.includes(oldSq1)) {
    const sq2Check=html.substring(html.indexOf(oldSq1)+oldSq1.length);
    if(sq2Check.includes('function startSubjectQuiz(cat){')) {
      html=html.replace(oldSq1+'\n','');
      changes.push('Removed duplicate startSubjectQuiz function');
    }
  }
} catch(e) { console.error('PATCH 2 failed:',e.message); }

// === PATCH 3: Replace openChapter with quiz link ===
try {
  const oldOc=d('ZnVuY3Rpb24gb3BlbkNoYXB0ZXIodmksY2kpewpjb25zdCB2PVNUVURZX0RBVEFbdmldLGM9di5jaGFwdGVyc1tjaV07Y29uc3Qgaz12LnZvbHVtZSsnfCcrYy50aXRsZTtjb25zdCBkb25lPXByb2dyZXNzLmNoYXB0ZXJzX3JlYWRba107CmxldCBodG1sPWAKPGJ1dHRvbiBjbGFzcz0iYnRuIGJ0bi1iYWNrIiBvbmNsaWNrPSJyZW5kZXJTdHVkeVN1YmplY3RzKCkiPsK7IOKYo+KSuCDgpqbgp4bgp6/gpqTgpr4KPC9idXR0b24+PGJ1dHRvbiBjbGFzcz0iYnRuIGJ0bi1yZWFkIiBvbmNsaWNrPSJtYXJrUmVhZCgke3ZpfSwke2NpfSkiIHN0eWxlPSJtYXJnaW4tbGVmdDo4cHgiPiR7ZG9uZT8n4pCBIODgp4bgppLgpprgj4bnJzonCgnKtY2F0Jzon4pyO4KaeIOCnnOCmv+CnnOCmvuCnnOCn9OCniOCnjSd9PC9idXR0b24+PGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+PGgyPiR7ZXNjKGMudGl0bGUpfTwvaDI+PHAgc3R5bGU9ImNvbG9yOnZhcigtZ3JheSk7bWFyZ2luLWJvdHRvbToxMnB4Ij4ke2VzYyh2LnN1YmplY3QpfTwvcD48ZGl2IGNsYXNzPSJzdHVkeS1jb250ZW50Ij4ke2VzYyhjLmNvbnRlbnQpfTwvZGl2PjwvZGl2PmAKOwpkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3R1ZHknKS5pbm5lckhUTUw9aHRtbDsKfQ==');
  const newOc=d('ZnVuY3Rpb24gb3BlbkNoYXB0ZXIodmksY2kpewpjb25zdCB2PVNUVURZX0RBVEFbdmldLGM9di5jaGFwdGVyc1tjaV07Y29uc3Qgaz12LnZvbHVtZSsnfCcrYy50aXRsZTtjb25zdCBkb25lPXByb2dyZXNzLmNoYXB0ZXJzX3JlYWRba107CmNvbnN0IF9xYz1TVUJKRUNUX01DUy5maWx0ZXIobT0+bS5jYXRlZ29yeT09PXYuc3ViamVjdCYmKG0uc3Vic3ViamVjdHx8JycpPT09Yy50aXRsZSkubGVuZ3RoOwpsZXQgaHRtbD1gCjxidXR0b24gY2xhc3M9ImJ0biBidG4tYmFjayIgb25jbGljaz0icmVuZGVyU3R1ZHlTdWJqZWN0cygpIj7CuyDigqTigqrgp6DgpoLgpr4g4Kam4KeG4Kev4Kak4Ka+PC9idXR0b24+PGJ1dHRvbiBjbGFzcz0iYnRuIGJ0bi1yZWFkIiBvbmNsaWNrPSJtYXJrUmVhZCgke3ZpfSwke2NpfSkiIHN0eWxlPSJtYXJnaW4tbGVmdDo4cHgiPiR7ZG9uZT8n4pCBIODgp4bgppLgpprgj4bnJzonCgnKtY2F0Jzon4pyO4KaeIOCnnOCmvuCnnOCmvuCnnOCn9OCniOCnjSd9PC9idXR0b24+JHtfcWM+MD9gPGJ1dHRvbiBjbGFzcz0iYnRuIGJ0bi1wcmltYXJ5IiBvbmNsaWNrPSJzdGFydFN1YlN1YmplY3RRdWl6KCcke3Yuc3ViamVjdC5yZXBsYWNlKC8nL2csIlxcJyIpfScsJyR7Yy50aXRsZS5yZXBsYWNlKC8nL2csIlxcJyIpfScpIiIHN0eWxlPSJtYXJnaW4tbGVmdDo4cHgiPuKJqSDgpoLgpprgj4bgponCgnKtY2F0ICgke19xY30pPC9idXR0b24+YDonJ308ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij48aDI+JHtlc2MoYy50aXRsZSl9PC9oMj48cCBzdHlsZT0iY29sb3I6dmFyKC1ncmF5KTttYXJnaW4tYm90dG9tOjEycHgiPiR7ZXNjKHYuc3ViamVjdCl9PC9wPjxkaXYgY2xhc3M9InN0dWR5LWNvbnRlbnQiPiR7ZXNjKGMuY29udGVudCl9PC9kaXY+PC9kaXY+YAo7CmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdHVkeScpLmlubmVySFRNTD1odG1sOwp9');
  if(html.includes(oldOc)) {
    html=html.replace(oldOc,newOc);
    changes.push('Added quiz link to openChapter');
  } else {
    console.log('openChapter pattern not found');
  }
} catch(e) { console.error('PATCH 3 failed:',e.message); }

// === PATCH 4: Replace goToDayTask with quiz link ===
try {
  const oldGtd=d('ZnVuY3Rpb24gZ29Ub0RheVRhc2sodmksY2ksZGF5TnVtKXsKc2hvd1BhZ2UoJ3N0dWR5Jyk7CnNldFRpbWVvdXQoZnVuY3Rpb24oKXsKdmFyIHY9U1RVRFlfREFUQVt2aV0sYz12LmNoYXB0ZXJzW2NpXTsKdmFyIGh0bWw9IjxidXR0b24gY2xhc3M9XFxcImJ0biBidG4tcHJpbWFyeVxcXCIgb25jbGljaz1cXFwic2hvd1BhZ2UoJ3BsYW4nKVxcXCI+wrsg4KSm4Kaq4Kav4Ka+4Kam4KeG4KevPC9idXR0b24+IDxidXR0b24gY2xhc3M9XFxcImJ0biBidG4tc3VjY2Vzc1xcXCIgb25jbGljaz1cXFwiY29tcGxldGVEYXlUYXNrKFwiK3ZpK1wiLFwiK2NpK1wiLFwiK2RheU51bStcIilcXFwiPuKchODgp4bgppLgpprgj4bnJzonCgnKtY2F0PC9idXR0b24+IjsKaHRtbCs9IjxkaXYgY2xhc3M9XFxcImNhcmRcXFwiIHN0eWxlPVxcXCJtYXJnaW4tdG9wOjEycHhcXFwiPjxoMj5cIitlc2MoYy50aXRsZSkrIjwvaDI+PHAgc3R5bGU9XFxcImNvbG9yOnZhcigtZ3JheSk7bWFyZ2luLWJvdHRvbToxMnB4XFxcIj5cIitlc2Modi5zdWJqZWN0KysiIjwvcD48ZGl2IGNsYXNzPVxcXCJzdHVkeS1jb250ZW50XFxcIj5cIitlc2MoYy5jb250ZW50KysiPC9kaXY+PC9kaXY+IjsKZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N0dWR5JykuaW5uZXJIVE1MPWh0bWw7Cn0KfQ==');
  const newGtd=d('ZnVuY3Rpb24gZ29Ub0RheVRhc2sodmksY2ksZGF5TnVtKXsKc2hvd1BhZ2UoJ3N0dWR5Jyk7CnNldFRpbWVvdXQoZnVuY3Rpb24oKXsKdmFyIHY9U1RVRFlfREFUQVt2aV0sYz12LmNoYXB0ZXJzW2NpXTsKdmFyIGh0bWw9IjxidXR0b24gY2xhc3M9XFxcImJ0biBidG4tcHJpbWFyeVxcXCIgb25jbGljaz1cXFwic2hvd1BhZ2UoJ3BsYW4nKVxcXCI+wrsg4KSm4Kaq4Kav4Ka+4Kam4KeG4KevPC9idXR0b24+IDxidXR0b24gY2xhc3M9XFxcImJ0biBidG4tc3VjY2Vzc1xcXCIgb25jbGljaz1cXFwiY29tcGxldGVEYXlUYXNrKFwiK3ZpK1wiLFwiK2NpK1wiLFwiK2RheU51bStcIilcXFwiPuKchODgp4bgppLgpprgj4bnJzonCgnKtY2F0PC9idXR0b24+IjsKaHRtbCs9IjxkaXYgY2xhc3M9XFxcImNhcmRcXFwiIHN0eWxlPVxcXCJtYXJnaW4tdG9wOjEycHhcXFwiPjxoMj5cIitlc2MoYy50aXRsZSkrIjwvaDI+PHAgc3R5bGU9XFxcImNvbG9yOnZhcigtZ3JheSk7bWFyZ2luLWJvdHRvbToxMnB4XFxcIj5cIitlc2Modi5zdWJqZWN0KysiIjwvcD48ZGl2IGNsYXNzPVxcXCJzdHVkeS1jb250ZW50XFxcIj5cIitlc2MoYy5jb250ZW50KysiPC9kaXY+PC9kaXY+IjsKdmFyIF9xYz1TVUJKRUNUX01DUy5maWx0ZXIoZnVuY3Rpb24obSl7cmV0dXJuIG0uY2F0ZWdvcnk9PT12LnN1YmplY3QmJihtLnN1YnN1YmplY3R8fCcnKT09PWMudGl0bGV9KS5sZW5ndGg7CmlmKF9xYz4wKXtodG1sKz0iPGJ1dHRvbiBjbGFzcz1cXFwiYnRuIGJ0bi1wcmltYXJ5XFxcIiBzdHlsZT1cXFwibWFyZ2luLXRvcDoxMnB4XFxcIiBvbmNsaWNrPVxcXCJzdGFydFN1YlN1YmplY3RRdWl6KCciK3Yuc3ViamVjdC5yZXBsYWNlKC8nL2csIlxcJyIpKyInLCciK2MudGl0bGUucmVwbGFjZSgvJy9nLCJcXCciKSsiJylcXFwiPuKJqSDgpoLgpprgj4bgponCgnKtY2F0ICIrX3FjKyLgprPgp4bgpqrCgnKtY2F0PC9idXR0b24+In0KZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N0dWR5JykuaW5uZXJIVE1MPWh0bWw7Cn0KfQ==');
  if(html.includes(oldGtd)) {
    html=html.replace(oldGtd,newGtd);
    changes.push('Added quiz link to goToDayTask');
  } else {
    console.log('goToDayTask pattern not found');
  }
} catch(e) { console.error('PATCH 4 failed:',e.message); }

// Write back
fs.writeFileSync('index.html',html);
console.log('Applied changes:',changes.join(', '));
console.log('Final file size:',html.length,'bytes');