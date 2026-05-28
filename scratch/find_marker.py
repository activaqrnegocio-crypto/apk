filepath = 'src/components/project/ProjectDetailBase.tsx'
with open(filepath, 'r', encoding='utf8') as f:
    content = f.read()

marker = 'src={`${item.url}#t=0.001`}'
idx = content.find(marker)
print(f'First occurrence at position: {idx}')
if idx > 0:
    # Print 200 chars before the marker
    print('---BEFORE---')
    print(repr(content[idx-200:idx]))
    print('---AFTER---')
    print(repr(content[idx:idx+300]))
