import os

src = r'd:\Abel paginas\Aquatech\crm mayo\aquatech-render-main\scratch\clean.gradle'
dst = r'd:\Abel paginas\Aquatech\crm mayo\aquatech-render-main\android\app\build.gradle'
backup = r'd:\Abel paginas\Aquatech\crm mayo\aquatech-render-main\scratch\build.gradle.bak'

# Read clean content from scratch
clean = open(src, 'rb').read()
print('clean size:', len(clean))

# Write directly to build.gradle
with open(dst, 'wb') as f:
    f.write(clean)
print('written to build.gradle')

# Verify
verify = open(dst, 'rb').read()
print('verify size:', len(verify))