const fs = require('fs');
const path = 'd:\\Abel paginas\\Aquatech\\crm mayo\\aquatech-render-main\\android\\app\\build.gradle';

const data = fs.readFileSync(path, 'utf8');
const marker = '[data:cache_control;base64,ZXBoZW1lcmFs]';
const clean = data.replace(marker, '');
fs.writeFileSync(path, clean);
console.log('File cleaned. Original length:', data.length, 'New length:', clean.length);