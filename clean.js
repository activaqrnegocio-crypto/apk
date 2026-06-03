const fs = require('fs');
const data = fs.readFileSync('src/lib/push.ts');
const gar = Buffer.from('data:cache_control');
const idx = data.indexOf(gar);
if (idx > 0) {
  fs.writeFileSync('src/lib/push.ts', data.subarray(0, idx));
}