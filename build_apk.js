const { execSync } = require('child_process');
const path = require('path');

const androidDir = 'd:\\Abel paginas\\Aquatech\\crm mayo\\aquatech-render-main\\android';
const gradlewBat = path.join(androidDir, 'gradlew.bat');

console.log('Starting APK build...');
console.log('Working directory:', androidDir);

try {
    const result = execSync(`"${gradlewBat}" -p "${androidDir}" assembleDebug`, {
        cwd: androidDir,
        encoding: 'utf8',
        stdio: 'inherit'
    });
    console.log('Build completed!');
} catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
}