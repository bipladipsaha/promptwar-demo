const fs = require('fs');
const js = fs.readFileSync('src/main.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const ids = [...js.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);
const missing = ids.filter(id => !html.includes('id="' + id + '"'));
console.log('Missing IDs:', missing);
