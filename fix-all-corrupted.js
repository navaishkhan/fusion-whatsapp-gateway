const fs = require('fs');

// Read the file
const content = fs.readFileSync('index.js', 'utf8');

// Define replacements for corrupted Unicode sequences
const replacements = [
  { pattern: /â"€â"€â"€/g, replacement: '───' },
  { pattern: /â€”/g, replacement: '—' },
  { pattern: /âœŒ/g, replacement: '❌' },
  { pattern: /âœ…/g, replacement: '✅' },
  { pattern: /â‹®/g, replacement: '⋮' },
  { pattern: /ðŸš€/g, replacement: '🚀' },
  { pattern: /ðŸ/g, replacement: '👉' },
  { pattern: /â†'/g, replacement: '→' },
];

let cleanContent = content;

// Apply all replacements
for (const { pattern, replacement } of replacements) {
  cleanContent = cleanContent.replace(pattern, replacement);
}

// Write back to file
fs.writeFileSync('index.js', cleanContent, 'utf8');

console.log('Fixed all corrupted Unicode characters in index.js');
