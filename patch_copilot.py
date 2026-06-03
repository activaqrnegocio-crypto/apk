#!/usr/bin/env python3
import os, shutil, sys
from pathlib import Path

def find_extension():
    # All possible VS Code extension paths for Windows
    search_paths = [
        Path.home() / ".vscode" / "extensions",
        Path.home() / ".cursor" / "extensions",
        Path("c:/Users/Smart/AppData/Local/Programs/Microsoft VS Code/extensions"),
        Path("c:/Users/Smart/AppData/Local/Programs/Microsoft VS Code/resources/app/extensions"),
        Path("c:/Program Files/Microsoft VS Code/resources/app/extensions"),
        Path(os.getenv("LOCALAPPDATA", "")) / "Programs" / "Microsoft VS Code" / "resources" / "app" / "extensions",
    ]
    
    for base in search_paths:
        print(f"Buscando en: {base}", file=sys.stderr)
        if base.exists():
            for entry in sorted(base.glob("github.copilot-chat-*"), reverse=True):
                js = entry / "dist" / "extension.js"
                if js.exists():
                    print(f"Encontrado: {js}", file=sys.stderr)
                    return js
    return None

PATCH_MARKER = "/*[copilot-patch-v4]*/"
ORIGINAL_D3E = (
    'r&&Nvn(r)?r.cache_control={type:"ephemeral"}'
    ':e.push({type:"text",text:" ",cache_control:{type:"ephemeral"}});break'
)
PATCHED_D3E = (
    'r&&Nvn(r)?r.cache_control={type:"ephemeral"}'
    ':e.push({type:"text",text:".",cache_control:{type:"ephemeral"}});break'
)

js_path = find_extension()
if not js_path:
    print("No se encontro la extension"); sys.exit(1)

data = js_path.read_text(encoding="utf-8", errors="replace")
if PATCH_MARKER in data:
    print("Ya esta parcheado"); sys.exit(0)
if ORIGINAL_D3E not in data:
    print("No se encontro el string - puede que la extension ya se actualizo")
    sys.exit(2)

backup = js_path.with_suffix(".js.orig")
if not backup.exists():
    shutil.copy2(js_path, backup)

data = data.replace(ORIGINAL_D3E, PATCH_MARKER + PATCHED_D3E, 1)
js_path.write_text(data, encoding="utf-8")
print(f"Parcheado: {js_path}")
print("Reinicia VS Code (Developer: Reload Window)")