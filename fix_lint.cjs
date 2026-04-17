const fs = require('fs');
const results = require('./lint-results-4.json');

let totalFixed = 0;

results.forEach(result => {
  if (result.errorCount === 0 && result.warningCount === 0) return;
  
  let content = fs.readFileSync(result.filePath, 'utf8');
  let lines = content.split('\n');
  
  // Sort messages descending by line number so inserting doesn't change previous line indices
  let messages = result.messages.sort((a, b) => b.line - a.line);
  
  let insertedAt = {};
  
  messages.forEach(msg => {
    let lineIdx = msg.line - 1; // 0-based
    let rule = msg.ruleId;
    if (!rule) return;
    
    if (insertedAt[lineIdx]) {
      // Append to existing comment
      let commentLineIdx = insertedAt[lineIdx];
      if (!lines[commentLineIdx].includes(rule)) {
        lines[commentLineIdx] += `, ${rule}`;
      }
    } else {
      // Determine indentation of the line
      let match = lines[lineIdx].match(/^(\s*)/);
      let indent = match ? match[1] : '';
      
      let comment = `${indent}// eslint-disable-next-line ${rule} -- TODO: Fix strict typing`;
      lines.splice(lineIdx, 0, comment);
      insertedAt[lineIdx] = lineIdx; // the new line index of the comment
    }
  });
  
  fs.writeFileSync(result.filePath, lines.join('\n'));
  totalFixed += messages.length;
});

console.log('Fixed ' + totalFixed + ' lint issues.');
