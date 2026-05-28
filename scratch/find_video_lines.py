filepath = 'src/components/project/ProjectDetailBase.tsx'
with open(filepath, 'r', encoding='utf8') as f:
    lines = f.readlines()

# Find lines with the video marker
marker = 'src={`${item.url}#t=0.001`}'
for i, line in enumerate(lines):
    if marker in line:
        print(f'Line {i+1}: {line.rstrip()}')
        # Print surrounding lines
        for j in range(max(0,i-4), min(len(lines), i+6)):
            print(f'  {j+1}: {lines[j].rstrip()}')
        print('---')
