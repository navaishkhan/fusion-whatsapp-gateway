const fs = require('fs');

// Read the file as UTF-8
const content = fs.readFileSync('index.js', 'utf8');

// Replace the specific corrupted sequences
let cleanContent = content;

// Replace the corrupted dash sequences
cleanContent = cleanContent.replace(/â"€â"€â"€/g, '───');
cleanContent = cleanContent.replace(/â€”/g, '—');

// Replace corrupted emojis
cleanContent = cleanContent.replace(/âœŒ/g, '❌');
cleanContent = cleanContent.replace(/âœ…/g, '✅');
cleanContent = cleanContent.replace(/â‹®/g, '⋮');

// Replace corrupted rocket and finger emojis (these are surrogate pairs)
cleanContent = cleanContent.replace(/ðŸš€/g, '🚀');
cleanContent = cleanContent.replace(/ðŸ/g, '👉');

// Replace corrupted arrow
cleanContent = cleanContent.replace(/â†'/g, '→');

// Write back
fs.writeFileSync('index.js', cleanContent, 'utf8');

console.log('Fixed encoding');
