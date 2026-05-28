const fs = require('fs');
let content = fs.readFileSync('src/components/project/ProjectDetailBase.tsx', 'utf8');

const oldBlock = `                      if (realMime.startsWith('video/')) {
                        return (
                          <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'black' }}>
                            <video 
                              src={\`\${item.url}#t=0.001\`} 
                              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} 
                              preload="metadata" 
                              muted 
                              playsInline 
                            />
                            <div style={{ position: 'relative', zIndex: 2, background: 'rgba(0,0,0,0.5)', borderRadius: '50%', padding: '6px', display: 'flex', boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="white" style={{ marginLeft: '2px' }}><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            </div>
                            <div style={{ position: 'absolute', bottom: '8px', left: '8px', zIndex: 2, background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6rem', color: 'white' }}>
                              {fileName}
                            </div>
                          </div>
                        );`;

const newBlock = `                      if (realMime.startsWith('video/')) {
                        return <VideoThumbnail url={item.url} mime={realMime} filename={fileName} />;`;

const count = content.split(oldBlock).length - 1;
console.log('Found', count, 'occurrences');

content = content.split(oldBlock).join(newBlock);
fs.writeFileSync('src/components/project/ProjectDetailBase.tsx', content);
console.log('Replaced successfully');
