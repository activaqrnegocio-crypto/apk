filepath = 'src/components/project/ProjectDetailBase.tsx'
with open(filepath, 'r', encoding='utf8') as f:
    content = f.read()

# Exact block from position 127024 - 300 chars before to end of block
start = content.find("                      if (realMime.startsWith('video/')) {")
# Find the second occurrence (the admin view has 2, one for Planos, one for Finales)
first = content.find("                      if (realMime.startsWith('video/')) {")
second = content.find("                      if (realMime.startsWith('video/')) {", first + 50)

print(f'First: {first}')
print(f'Second: {second}')

# Extract the full block for each occurrence
for pos in [first, second]:
    # Find the end of this block by looking for ");" followed by "else if"
    end = content.find("                      } else if (realMime.startsWith('audio/')) {", pos)
    block = content[pos:end]
    print(f'\nBlock length: {len(block)}')
    print(f'Block starts with: {repr(block[:50])}')
    print(f'Block ends with: {repr(block[-50:])}')
    
    new_block = "                      if (realMime.startsWith('video/')) {\n                        return <VideoThumbnail url={item.url} mime={realMime} filename={fileName} />;"
    
    if block in content:
        content = content.replace(block, new_block, 1)
        print('  -> Replaced!')
    else:
        print('  -> NOT FOUND in content!')

with open(filepath, 'w', encoding='utf8') as f:
    f.write(content)
print('\nDone!')
