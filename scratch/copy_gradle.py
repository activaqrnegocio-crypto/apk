import os

build_gradle = r'd:\Abel paginas\Aquatech\crm mayo\aquatech-render-main\android\app\build.gradle'
scratch_gradle = r'd:\Abel paginas\Aquatech\crm mayo\aquatech-render-main\scratch\clean.gradle'

# Read clean gradle from scratch
clean_content = open(scratch_gradle, 'rb').read()
print('clean.gradle size:', len(clean_content))

# Write to build.gradle
with open(build_gradle, 'wb') as f:
    f.write(clean_content)
print('written')

# Verify
verify = open(build_gradle, 'rb').read()
print('verify size:', len(verify))