import os
import shutil

src_dir = r'd:\Abel paginas\Aquatech\crm mayo\aquatech-render-main\android\app'
items = os.listdir(src_dir)
print('Items in app folder:')
for item in items:
    print(repr(item))
    
# Find the corrupted src folder
for item in items:
    if 'src' in item.lower() and 'data' in item.lower():
        old_path = os.path.join(src_dir, item)
        new_path = os.path.join(src_dir, 'src')
        print(f'Found: {repr(item)}')
        print(f'Renaming to {new_path}')
        os.rename(old_path, new_path)
        print('Done!')
        break
else:
    print('No corrupted src folder found')
    # Check if normal src exists
    if os.path.exists(os.path.join(src_dir, 'src')):
        print('src folder exists normally')
    else:
        print('src folder does NOT exist')