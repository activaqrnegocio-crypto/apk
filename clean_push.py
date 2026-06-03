data = open('src/lib/push.ts', 'rb').read()
gar = b'data:cache_control'
idx = data.find(gar)
if idx > 0:
    bracket = data.rfind(b'[', 0, idx)
    clean = data[:bracket]
    open('src/lib/push.ts', 'wb').write(clean)
    print('Cleaned to', len(clean))
else:
    print('No garbage, file is clean:', len(data))