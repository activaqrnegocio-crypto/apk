#!/usr/bin/env python3
import os

src = 'node_modules/@capacitor/background-runner/android/src/main/libs/android-js-engine-release.aar'
dst_dir = 'android/capacitor-cordova-android-plugins/src/main/libs'
dst = os.path.join(dst_dir, 'android-js-engine-release.aar')

os.makedirs(dst_dir, exist_ok=True)

with open(src, 'rb') as f:
    data = f.read()

print('Source size:', len(data))

with open(dst, 'wb') as f:
    f.write(data)

print('Destination written')

dst_size = os.path.getsize(dst)
print('Destination size:', dst_size)

with open(dst, 'rb') as f:
    header = f.read(4)
    print('Header:', header)
    print('Valid ZIP:', header == b'PK\x03\x04')