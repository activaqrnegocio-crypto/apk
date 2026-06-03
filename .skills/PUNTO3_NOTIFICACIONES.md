# Punto 3: Notificaciones Push en APK

## Estado Actual

### PWA - VAPID (ya funciona)
- Las notificaciones push en PWA ya funcionan via **VAPID** (Web Push)
- Usa el Service Worker existente (`custom-sw.js`)
- Funciona bien en Chrome/Firefox de escritorio

### APK - Mix de tecnologías
- Push Notifications plugin instalado: `@capacitor/push-notifications@8.1.1`
- **NO está configurado ni integrado todavía**

## Objetivo: Minimizar Trabajo

**NO necesitamos crear un sistema nuevo de notificaciones.** 
El sistema de notificaciones de la PWA ya existe y funciona.

Lo que haremos:

### Para APK, solo cambiar el TRANSPORTE

| Componente | PWA | APK |
|------------|-----|-----|
| Lógica de notificación | ✅ Existe | ✅ Igual |
| Mostrar notificación | ✅ `new Notification()` | ✅ `PushNotifications.display()` |
| Manejar click | ✅ `notificationclick` event | ✅ `addListener('notificationTap')` |
| **Transporte** | VAPID (Web Push) | **FCM (Firebase)** |
| Permisos | Browser prompt | Native prompt |

## Lo que YA está instalado

```json
"@capacitor/push-notifications": "^8.1.1"
```

## Lo que NO está instalado (y quizás no necesitamos)

Firebase tiene muchas partes:
- `firebase-admin` (servidor) - ✅ Ya tenemos servidor
- `firebase-config` - ⚠️ Podríamos necesitar
- `google-services.json` - ✅ Ya existe en el proyecto

## Lo que haremos (minimal)

### Paso 1: Configurar FCM en Android
- Ya tenemos `google-services.json` en el proyecto
- Necesitamos verificar que está bien configurado en `android/app/`

### Paso 2: Integrar plugin con lógica existente
- El plugin de Capacitor se conecta a la misma lógica que VAPID
- Cuando llega push → mostrar notificación (misma función que ya existe)

### Paso 3: NO cambiar Server Actions
- El servidor ya envía pushes
- Solo cambia cómo el dispositivo los recibe (VAPID → FCM)

## Lo que NO haremos

❌ No reescribiremos la lógica de notificaciones
❌ No cambiaremos `src/lib/notifications.ts` (si existe)
❌ No cambiaremos Server Actions de push
❌ No cambiaremos la base de datos

## Resultado Esperado

| Esccenario | PWA | APK |
|------------|-----|-----|
| Login recibe push | ✅ VAPID | ✅ FCM |
| Nuevo mensaje chat | ✅ VAPID | ✅ FCM |
| Proyecto actualizado | ✅ VAPID | ✅ FCM |
| Click en notificación | ✅ Funciona | ✅ Funciona |

**La experiencia del usuario es idéntica**, solo cambia el protocolo de transporte.

## Hitos de Implementación

### Hito 3.1: Verificar google-services.json
- Verificar que existe en `android/app/google-services.json`
- Verificar que el `package_name` coincide con `capacitor.config.ts`

### Hito 3.2: Configurar Android para FCM
- Agregar permisos necesarios al `AndroidManifest.xml`
- Configurar `capacitor.config.ts` con Firebase

### Hito 3.3: Integrar plugin en la app
- En `src/App.tsx` o componente principal, registrar `PushNotifications`
- Agregar listeners para `registration` (obtener token)
- Conectar con la lógica existente

### Hito 3.4: Testear en dispositivo
- Enviar notification desde el servidor
- Verificar que llega al dispositivo

## Checklist de Validación

- [ ] PWA notificaciones siguen funcionando
- [ ] APK recibe notificaciones FCM
- [ ] Click en notificación abre la app correcta
- [ ] Token se envía al servidor correctamente

## Referencia

- Skill: `.skills/pwa-to-apk-phase4.md`