for f in ['android/app/build.gradle', 'android/build.gradle']:
    data = open(f, 'rb').read()
    gar = b'data:cache_control'
    idx = data.find(gar)
    if idx > 0:
        bracket = data.rfind(b'[', 0, idx)
        clean = data[:bracket]
        open(f, 'wb').write(clean)
        print(f'{f} cleaned: {len(data)} -> {len(clean)}')
    else:
        print(f'{f}: clean, {len(data)} bytes')