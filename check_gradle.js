const fs = require('fs');
const path = 'd:\\Abel paginas\\Aquatech\\crm mayo\\aquatech-render-main\\android\\app\\build.gradle';

const data = fs.readFileSync(path, 'utf8');
console.log('File length:', data.length);
console.log('Line 14:', JSON.stringify(data.split('\n')[13]));

const lines = data.split('\n');
lines.forEach((line, i) => {
    if (line.includes("ignoreAssetsPattern")) {
        console.log(`Line ${i+1}: ${JSON.stringify(line)}`);
    }
});

// Check for corruption marker
const marker = '[data:cache_control;base64,ZXBoZW1lcmFs]';
if (data.includes(marker)) {
    console.log('CORRUPTION MARKER FOUND at position:', data.indexOf(marker));
} else {
    console.log('No corruption marker found');
}