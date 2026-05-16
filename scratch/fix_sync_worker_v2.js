const fs = require('fs');
const path = 'd:\\Abel paginas\\Aquatech\\Crm Aquatech - cloudfare 4\\src\\components\\GlobalSyncWorker.tsx';
let content = fs.readFileSync(path, 'utf8');

// Revert the bad patch - being very careful with the string match
const badString = "else let galleryUploadDone = false;\n          if (item.type === 'GALLERY_UPLOAD') { endpoint = `/api/projects/${item.projectId}/gallery` }";
const goodString = "else if (item.type === 'GALLERY_UPLOAD') { endpoint = `/api/projects/${item.projectId}/gallery` }";

if (content.includes(badString)) {
    content = content.replace(badString, goodString);
} else {
    // Try without the leading newline if it didn't match exactly
    const badString2 = "else let galleryUploadDone = false; if (item.type === 'GALLERY_UPLOAD')";
    content = content.replace(/else let galleryUploadDone = false;\s+if \(item\.type === 'GALLERY_UPLOAD'\)/, "else if (item.type === 'GALLERY_UPLOAD')");
}

// Fix 2: Declare it correctly at a higher scope
const loopStart = "for (const item of items) {";
if (content.includes(loopStart) && !content.includes("let galleryUploadDone = false;")) {
    content = content.replace(loopStart, loopStart + "\n        let galleryUploadDone = false;");
}

fs.writeFileSync(path, content);
console.log('Fixed GlobalSyncWorker.tsx properly');
