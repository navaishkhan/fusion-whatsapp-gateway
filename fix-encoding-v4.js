const fs = require('fs');

// Read the file as UTF-8
const content = fs.readFileSync('index.js', 'utf8');

// The sequence â€" is the misinterpreted UTF-8 for em dash (—)
// This is a classic UTF-8 double-encoding issue
let cleanContent = content;

// Replace the corrupted em dash sequence (â€")
cleanContent = cleanContent.replace(/â€"/g, '—');

// Replace corrupted emojis
cleanContent = cleanContent.replace(/âœŒ/g, '❌');
cleanContent = cleanContent.replace(/âœ…/g, '✅');
cleanContent = cleanContent.replace(/â‹®/g, '⋮');

// Replace corrupted rocket and finger emojis
cleanContent = cleanContent.replace(/ðŸš€/g, '🚀');
cleanContent = cleanContent.replace(/ðŸ/g, '👉');

// Replace corrupted arrow
cleanContent = cleanContent.replace(/â†'/g, '→');

// Write back
fs.writeFileSync('index.js', cleanContent, 'utf8');

console.log('Fixed encoding');
