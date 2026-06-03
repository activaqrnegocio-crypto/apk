# Diagnóstico de Corrupción de Copilot Chat

## Prompt para siguiente sesión de chat

Ejecuta estos comandos en la terminal y reporta si aparece texto raro:

```
1. echo "test"
2. node --version
3. python --version
```

**Si aparece** `[data:cache_control;base64,` o `ZXBoZW1lcmFs` o `ephemeral` al final del output → **BUG activo**, necesitas parchear o deshabilitar Copilot Chat.

**Si todo sale limpio** → No hay corrupcion, puedes trabajar normal.

---

## Fix rápido si tienes el bug

1. Descargar el script `patch_copilot.py` de este proyecto
2. Ejecutar fuera de VS Code (CMD o PowerShell nuevo):
   ```
   python "d:\Abel paginas\Aquatech\crm mayo\aquatech-render-main\patch_copilot.py"
   ```
3. Reiniciar VS Code → Developer: Reload Window

## Alternativa sin script

1. Deshabilitar extensión `github.copilot-chat` temporalmente
2. Reiniciar VS Code
3. Abrir nueva terminal → ejecutar `node --version` para confirmar limpieza