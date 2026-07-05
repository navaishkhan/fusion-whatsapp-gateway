const fs = require('fs');

const content = fs.readFileSync('index.js', 'utf8');

// Replace all corrupted characters
const replacements = {
  'âœŒ': '❌',
  'â"€â"€â"€': '───',
  'â€”': '—',
  'âœ…': '✅',
  'â‹®': '⋮',
  'ðŸš€': '🚀',
  'ðŸ': '👉'
};

let cleanContent = content;
for (const [corrupted, correct] of Object.entries(replacements)) {
  cleanContent = cleanContent.split(corrupted).join(correct);
}

fs.writeFileSync('index.js', cleanContent, 'utf8');
console.log('File cleaned');
