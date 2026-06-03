#!/usr/bin/env python3
import sys

f = '.gitignore'
data = open(f, 'rb').read()

# Remove trailing garbage
garbage_strings = [
    b'[data:cache_control',
    b'base64',
    b'ZXBoZW1lcmFs',
    b'\n[data:',
]

for g in garbage_strings:
    idx = data.find(g)
    if idx > 0:
        nl = data.rfind(b'\n', 0, idx)
        data = data[:nl+1]
        print(f'Removed {g} at {idx}, new size: {len(data)}')

open(f, 'wb').write(data)
print(f'Final size: {len(data)}')

# Check if .env and google-services.json are covered
content = data.decode('utf-8', errors='replace')
has_env = '.env' in content or '.env*' in content
has_gs = 'google-services.json' in content

print(f'.env protected: {has_env}')
print(f'google-services.json protected: {has_gs}')

if not has_env:
    print('WARNING: .env NOT in .gitignore!')
if not has_gs:
    print('WARNING: google-services.json NOT in .gitignore!')