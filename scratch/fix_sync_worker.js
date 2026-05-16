const fs = require('fs');
const path = 'd:\\Abel paginas\\Aquatech\\Crm Aquatech - cloudfare 4\\src\components\\GlobalSyncWorker.tsx';
let content = fs.readFileSync(path, 'utf8');

// Revert the bad patch
content = content.replace(
  "else let galleryUploadDone = false;\n          if (item.type === 'GALLERY_UPLOAD') { endpoint = `/api/projects/${item.projectId}/gallery` }",
  "else if (item.type === 'GALLERY_UPLOAD') { endpoint = `/api/projects/${item.projectId}/gallery` }"
);

// Fix 2: Declare it correctly at a higher scope
// Find the start of the loop
const loopStart = "for (const item of items) {";
content = content.replace(loopStart, loopStart + "\n        let galleryUploadDone = false;");

fs.writeFileSync(path, content);
console.log('Fixed GlobalSyncWorker.tsx properly');
