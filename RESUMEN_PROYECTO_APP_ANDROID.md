# RESUMEN EJECUTIVO: Proyecto App Android Nativa - Aquatech CRM

> **Fecha**: 28 Mayo 2026
> **Estado**: Listo para implementar

---

## 🎯 ACUERDO FINAL

Implementaremos la **OPCIÓN 3: Capacitor + Plugins (HíBRIDO)**

La app será un WRAPPER que carga tu PWA existente, añadiendo:
- SQLite para offline más robusto
- WorkManager para background sync nativo

---

## 📋 REGLAS DEL PROYECTO

```
REGLA 1: La PWA actual NO se modifica. Funciona exactamente como está.
REGLA 2: El código de la PWA vive en: crm-aquatech (VPS)
REGLA 3: La app nativa carga desde el MISMO servidor (server.url)
REGLA 4: Ambas se actualizan con el MISMO deploy (GitHub → VPS)
REGLA 5: Solo una excepción requiere Play Store: cambios nativos nuevos
```

---

## 📁 ESTRUCTURA DE CARPETAS

```
d:\Abel paginas\Aquatech\
│
├── crm mayo\
│   └── aquatech-render-main\        ← PWA ACTUAL (NO TOCAR) ✅
│       └── (todo tu código Next.js)
│
└── aquatech-app-capacitor\           ← NUEVO PROYECTO ✅
    ├── capacitor.config.ts           # Config con server.url
    ├── android/                      # Proyecto Android (generado)
    ├── src/                          # Mínimo (solo entry point)
    └── package.json
```

---

## 🔄 FLUJO DE FUNCIONAMIENTO

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   USUARIO INSTALA APP DESDE PLAY STORE                         │
│                                                                 │
│   APP AL ABRIRSE:                                              │
│   └── server.url = https://tu-vps.com                         │
│   └── Carga TODA tu PWA en WebView                            │
│                                                                 │
│   OFFLINE:                                                      │
│   └── Plugin SQLite guarda datos localmente                    │
│   └── Funciona sin internet (datos guardados)                 │
│                                                                 │
│   BACKGROUNDSYNC:                                               │
│   └── Plugin WorkManager sincroniza cada 15 min                │
│   └── Aunque la app esté cerrada                              │
│   └── Survive a reinicios                                      │
│                                                                 │
│   ACTUALIZACIONES:                                             │
│   └── Tú haces deploy: GitHub → VPS                           │
│   └── PWA se actualiza ✅                                      │
│   └── App nativa se actualiza (carga del mismo lugar) ✅       │
│   └── Users NO descargan nada                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 COMPARATIVA PWA vs APP NATIVA

| Aspecto | PWA Actual | App Nativa (Opción 3) |
|---------|------------|----------------------|
| **Offline** | IndexedDB ⚠️ | SQLite ✅ |
| **Background Sync** | SW polling ❌ | WorkManager ✅ |
| **Persistencia** | Puede limpiarse | Robusta |
| **Se actualiza** | GitHub → VPS ✅ | GitHub → VPS ✅ |
| **Users descargan** | No | No (para código) |
| **Código** | Original | Carga el mismo |
| **Play Store** | No | Sí (distribución) |

---

## 📦 PLUGINS A INSTALAR

| Plugin | Propósito |
|--------|-----------|
| @capacitor/core | Bridge nativo |
| @capacitor/cli | Comandos |
| @capacitor/splash-screen | Pantalla inicio |
| @capacitor/status-bar | Barra estado |
| @capacitor/push-notifications | Notificaciones |
| @capacitor/network | Estado red |
| @capacitor-community/sqlite | DB offline robusta |
| @capacitor-community/background-fetch | Background sync nativo |

---

## 🔧 CONFIGURACIÓN CLAVE

### capacitor.config.ts

```typescript
server: {
  url: 'https://tu-vps-url.com',  // ← URL de tu servidor
  cleartext: false,               // HTTPS obligatorio
}

plugins: {
  BackgroundFetch: {
    minimumFetchInterval: 900,  // 15 minutos
    stopOnTerminate: false,     // Seguir después de cerrar
    startOnBoot: true,           // Iniciar con el celular
    enableHeadless: true,        // Ejecutar en background
  }
}

android: {
  allowMixedContent: true,        // Para cargar de tu servidor
}
```

---

## 🚀 PLAN DE ACCIÓN

### Semana 1: Setup + Configuración

| Día | Tarea | Entregable |
|-----|-------|------------|
| 1 | Crear carpeta proyecto | `aquatech-app-capacitor/` |
| 2 | Instalar Capacitor core + CLI | Dependencias |
| 3 | npx cap init + configuración | capacitor.config.ts |
| 4 | Instalar plugins | package.json |
| 5 | npx cap add android | Proyecto Android |
| 6 | Configurar server.url | Apuntar a tu VPS |
| 7 | npx cap sync android | Sincronizar |

### Semana 2: Testing + Build

| Día | Tarea | Entregable |
|-----|-------|------------|
| 8 | npx cap open android | Android Studio |
| 9 | Probar en dispositivo real | App carga PWA ✅ |
| 10 | Configurar Splash Screen | Color + ícono |
| 11 | Probar offline | Funciona sin red |
| 12 | Probar background sync | WorkManager |
| 13 | Build release APK | .apk listo |
| 14 | Publicar en Play Store | App disponible |

---

## ⚠️ RIESGOS IDENTIFICADOS

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Service Worker conflict | Media | Disable SW si necesario |
| Plugin no funciona | Baja | Usar versiones estables |
| Android mata proceso | Baja | WorkManager retry automático |

---

## 📋 ENTREGABLES

1. ✅ Proyecto Capacitor configurado
2. ✅ APK debug funcional
3. ✅ App que carga PWA
4. ✅ Offline funcionando
5. ✅ Background sync configurado
6. ✅ AAB para Play Store
7. ✅ App publicada en Play Store

---

## 💰 COSTOS

| Ítem | Costo |
|------|-------|
| Cuenta Google Play | $25 (una vez) - Ya pagada ✅ |
| VPS | Ya tienes ✅ |
| Desarrollo | Tu tiempo (2 semanas) |

---

## ❓ PREGUNTAS RESUELTAS

**P: ¿La app es la misma que la PWA?**
R: Técnicamente SÍ - carga el mismo código. Funcionalmente SÍ - pero con mejoras nativas.

**P: ¿Necesito hacer deploy por separado?**
R: NO - GitHub → VPS actualiza ambos.

**P: ¿Los usuarios necesitan descargar updates?**
R: Para código: NO. Para cambios nativos: SÍ (subir a Play Console manualmente).

**P: ¿El chat en tiempo real funciona?**
R: SÍ - carga el mismo polling que la PWA actual.

**P: ¿Push notifications?**
R: Funcionan igual que la PWA (Web Push) si usas server.url.

---

## 📞 PRÓXIMOS PASOS

1. Confirmar URL del VPS
2. Crear carpeta `aquatech-app-capacitor`
3. Seguir guide en `OPCION3_CAPACITOR.md`
4. Testing en dispositivo real
5. Publicar en Play Store

---

## 📚 DOCUMENTACIÓN RELACIONADA

| Documento | Descripción |
|-----------|-------------|
| `OPCION3_CAPACITOR.md` | Guía completa de implementación |
| `PLAN_APP_NATIVA_ANDROID.md` | Plan general (referencia) |
| `GUIA_PWA_A_ANDROID.md` | Documentación previa |

---

*Documento creado: 28 Mayo 2026*
*Proyecto: Aquatech CRM - App Android Nativa*