const fs = require('fs');

const content = fs.readFileSync('index.js', 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (/[^\x20-\x7E\r\n\t]/.test(lines[i])) {
    console.log(`Line ${i + 1}: ${lines[i]}`);
  }
}
