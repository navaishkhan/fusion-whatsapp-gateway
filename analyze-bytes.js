const fs = require('fs');

const content = fs.readFileSync('index.js', 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    const code = char.charCodeAt(0);
    if (code > 127) {
      console.log(`Line ${i + 1}, char ${j + 1}: '${char}' (${code})`);
    }
  }
}
