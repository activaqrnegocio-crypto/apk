import sys

fname = sys.argv[1] if len(sys.argv) > 1 else 'android/build.gradle'
data = open(fname, 'rb').read()
print(f'File size: {len(data)} bytes')

# Look for garbage marker
garbage = b'[data:cache_control'
idx = data.find(garbage)

if idx > 0:
    # Find last valid closing brace before garbage
    last_brace = data.rfind(b'}', 0, idx)
    if last_brace > 0:
        clean = data[:last_brace+1]
        open(fname, 'wb').write(clean)
        print(f'CLEANED: {len(data)} -> {len(clean)} bytes')
        print(f'Content ends with: {clean[-50:]}')
    else:
        print('ERROR: Could not find closing brace')
else:
    # Check if last bytes are garbage anyway
    last50 = data[-50:]
    if b'[data:cache_control' in last50 or b'base64' in last50:
        print(f'Garbage in last 50 bytes: {last50}')
        # Find the last newline
        nl = data.rfind(b'\n')
        if nl > 0:
            clean = data[:nl+1]
            open(fname, 'wb').write(clean)
            print(f'CLEANED via newline: {len(data)} -> {len(clean)}')
    else:
        print(f'Last 50 bytes: {last50}')
        print('No garbage found')