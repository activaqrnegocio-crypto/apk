#!/usr/bin/env python3
# Read current file
with open('android/app/build.gradle', 'rb') as f:
    data = f.read()

# Remove garbage from end
garbage = b'[data:cache_control'
idx = data.find(garbage)
if idx > 0:
    # Find last valid newline before garbage
    nl = data.rfind(b'\n', 0, idx)
    data = data[:nl+1]
    print(f'Removed garbage, new size: {len(data)}')
else:
    print('No garbage found, size:', len(data))

# Write cleaned file
with open('android/app/build.gradle', 'wb') as f:
    f.write(data)

# Verify
with open('android/app/build.gradle', 'rb') as f:
    content = f.read()
print(f'Final size: {len(content)}')
print(f'Last 30 bytes: {content[-30:]}')