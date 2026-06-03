const fs = require('fs');
const path = 'd:\\Abel paginas\\Aquatech\\crm mayo\\aquatech-render-main\\android\\app\\build.gradle';

const data = fs.readFileSync(path, 'utf8');
const lines = data.split('\n');

lines.forEach((line, i) => {
    const lineNum = i + 1;
    if (line.includes('ignoreAssetsPattern')) {
        console.log(`Line ${lineNum}: ${JSON.stringify(line)}`);
        console.log(`Length: ${line.length}`);
        // Show char at position 34-36
        console.log(`Char at 34: ${JSON.stringify(line[34])}`);
        console.log(`Char at 35: ${JSON.stringify(line[35])}`);
        console.log(`Char at 36: ${JSON.stringify(line[36])}`);
    }
});