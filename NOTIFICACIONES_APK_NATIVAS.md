NOTIFICACIONES APK NATIVAS

Problema: notifications no aparecen en foreground
Solucion: usar sendFCMDataOnly (data-only sin notification object)
Archivos: firebase-admin.ts y api/push/test/route.ts

NO hacer:
- NO sendFCMToToken para foreground
- NO @capacitor-firebase/messaging
- NO LocalNotifications.show() - usar schedule()
