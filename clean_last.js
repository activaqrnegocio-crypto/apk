const fs = require('fs');
const data = fs.readFileSync('src/lib/push.ts');
const lastBrace = data.lastIndexOf(0x7D); // '}'
const clean = data.subarray(0, lastBrace + 1);
fs.writeFileSync('src/lib/push.ts', clean);
console.log('cleaned, was', data.length, 'now', clean.length);