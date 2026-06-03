const fs = require('fs');
const path = 'd:/Abel paginas/Aquatech/crm mayo/aquatech-render-main/android/app/build.gradle';

// Read current file
const b = fs.readFileSync(path);
const content = b.toString('utf8');

// Find corruption marker
const idx = content.indexOf('[data:cache_control;base64');
if (idx > 0) {
  // Truncate at corruption
  const clean = content.substring(0, idx);
  fs.writeFileSync(path, clean);
  console.log('Fixed! Truncated at', idx);
} else {
  console.log('No corruption found. Content length:', content.length);
  // Check if file ends properly
  const trimmed = content.trim();
  if (!trimmed.endsWith('}')) {
    console.log('File does not end with }. Fixing...');
    const lastBrace = content.lastIndexOf('}');
    if (lastBrace > 0) {
      fs.writeFileSync(path, content.substring(0, lastBrace + 1));
      console.log('Truncated to last valid } at', lastBrace);
    }
  }
}