const fs = require('fs');
const p = 'd:/Abel paginas/Aquatech/crm mayo/aquatech-render-main/android/app/build.gradle';
let c = fs.readFileSync(p, 'utf8');
const mark = '[data:cache_control;base64,ZXBoZW1lcmFs]';
const idx = c.indexOf(mark);
if (idx >= 0) {
  c = c.substring(0, idx) + '\n';
  fs.writeFileSync(p, c);
  console.log('Fixed');
} else {
  console.log('No corruption found');
}