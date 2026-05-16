const fs = require('fs');
const path = 'd:\\Abel paginas\\Aquatech\\Crm Aquatech - cloudfare 4\\src\\components\\GlobalSyncWorker.tsx';
let content = fs.readFileSync(path, 'utf8');

// Fix 1: Declare galleryUploadDone
content = content.replace(
  "if (item.type === 'GALLERY_UPLOAD') {",
  "let galleryUploadDone = false;\n          if (item.type === 'GALLERY_UPLOAD') {"
);

fs.writeFileSync(path, content);
console.log('Fixed GlobalSyncWorker.tsx');
