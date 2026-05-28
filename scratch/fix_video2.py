import re

filepath = 'D:/Abel paginas/Aquatech/crm mayo/aquatech-render-main/src/components/project/ProjectDetailBase.tsx'

with open(filepath, 'r', encoding='utf8') as f:
    content = f.read()

old_block = """                      if (realMime.startsWith('video/')) {
                        return (
                          <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'black' }}>
                            <video 
                              src={${item.url}#t=0.001} 
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
                        );"""

new_block = """                      if (realMime.startsWith('video/')) {
                        return <VideoThumbnail url={item.url} mime={realMime} filename={fileName} />;"""

count = content.count(old_block)
print(f'Found: {count}')

if count > 0:
    content = content.replace(old_block, new_block)
    with open(filepath, 'w', encoding='utf8') as f:
        f.write(content)
    print('Replaced successfully')
else:
    print('No matches found - trying alternative approach')
    # Try to find with backtick template literal
    alt1 = """                      if (realMime.startsWith('video/')) {
                        return (
                          <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'black' }}>
                            <video 
                              src={`${item.url}#t=0.001`}"""
    c2 = content.count(alt1)
    print(f'Alt1 matches: {c2}')
    
    # Try to find just the key unique parts
    marker = 'src={`${item.url}#t=0.001`}'
    c3 = content.count(marker)
    print(f'Marker matches: {c3}')
    
    # Find positions
    pos = 0
    idx = 0
    while True:
        pos = content.find(marker, pos)
        if pos == -1: break
        idx += 1
        print(f'  Position {idx}: offset {pos}')
        print(f'  Context: ...{content[pos-50:pos+50]}...')
        pos += 1
