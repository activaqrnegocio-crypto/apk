#!/usr/bin/env python3
# Read current file
with open('android/app/build.gradle', 'rb') as f:
    data = f.read()

print(f'File size: {len(data)}')

# Remove ALL garbage from end
garbage_strings = [
    b'[data:cache_control',
    b'base64',
    b'ZXBoZW1lcmFs',
]

for g in garbage_strings:
    idx = data.find(g)
    if idx > 0:
        # Find newline BEFORE the garbage and cut there
        nl = data.rfind(b'\n', 0, idx)
        if nl > 0:
            data = data[:nl+1]
            print(f'Removed {g} at {idx}, new size: {len(data)}')
        else:
            # No newline before, cut at the start of garbage
            data = data[:idx]
            print(f'Removed {g} at {idx}, new size: {len(data)}')

# Write cleaned file
with open('android/app/build.gradle', 'wb') as f:
    f.write(data)

# Verify
with open('android/app/build.gradle', 'rb') as f:
    content = f.read()
print(f'Final size: {len(content)}')
print(f'Last 50 bytes: {content[-50:]}')