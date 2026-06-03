filepath = r'd:\Abel paginas\Aquatech\crm mayo\aquatech-render-main\android\app\build.gradle'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()
# Fix the corrupted line 14 - replace mismatched quotes
content = content.replace(
    "ignoreAssetsPattern = '!.svn:!.git:!.ds_store:!*.scc:.*:!CVS:!thumbs.db:!picasa.ini:!*~\"\n",
    "ignoreAssetsPattern = '!.svn:!.git:!.ds_store:!*.scc:.*:!CVS:!thumbs.db:!picasa.ini:!*~'\n"
)
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print('Fixed build.gradle quote issue')