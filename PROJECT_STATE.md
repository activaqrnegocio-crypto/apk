# Aquatech CRM - Estado Actual del Proyecto (Cloudflare 4)

**Última actualización:** 2024-05-04  
**Propósito:** Este documento es el "Single Source of Truth" (SSoT). Su objetivo es evitar errores de sincronización y regresiones en bugs ya resueltos.

---

## 1. Arquitectura y Tecnologías Core

| Componente | Tecnología | Rol |
| :--- | :--- | :--- |
| **Framework** | Next.js (App Router) | Estructura principal y renderizado. |
| **Hosting** | Cloudflare Pages | Despliegue de la aplicación y manejo de edge. |
| **Edge Logic** | Cloudflare Workers | Endpoints API y lógica de servidor en el borde. |
| **PWA** | Service Workers (v250+) | Soporte offline, precaching de rutas RSC y manejo de notificaciones. |
| **Media/CDN** | Bunny.net (BunnyCDN) | Almacenamiento y distribución de imágenes/videos. |
| **Offline DB** | IndexedDB + Dexie.js | Base de datos local para persistencia total sin conexión. |

---

## 2. Estado de la Sincronización Offline

### 2.1 Estrategia de Datos
- **Prioridad Local**: Carga datos desde Dexie inmediatamente para evitar "Proyectos (0)".
- **Outbox Pattern**: Acciones offline se guardan en `outbox` y el SW las procesa al detectar conexión.

### 2.2 Sincronización de Medios
- **Chunked Upload**: Implementado en el Service Worker para archivos grandes.
- **Credenciales**: Sincronizadas con BunnyCDN (API Key `9019...`).

---

## 3. Configuración de BunnyCDN
- **Storage Zone**: `aquatech-render`
- **Lógica de Purga**: Se emite orden de purga vía API tras cada actualización para limpiar la caché del CDN.

---

## 4. Sistema de Notificaciones Push
- **Hook**: `usePushNotifications.ts`
- **Vibración**: Patrón intensivo `[200, 100, 200, 100, 400]` para operadores.
- **Fix TypeScript**: Corregido el tipado del objeto `vibrate` en el registro del SW.

---

## 5. Problemas Críticos Resueltos (Log de Batallas)

| Problema | Solución Aplicada |
| :--- | :--- |
| **Mensajes Perdidos** | Eliminado bloqueo de `sendLockRef` en el chat. |
| **Error de Roles** | Ajustada redirección en `AdminDashboard` para sesiones offline. |
| **Navegación Móvil** | Optimizado precaching de rutas RSC para evitar pantallas blancas. |
| **Sync de Medios** | Corregida la autenticación de BunnyCDN en el entorno de producción. |

---

## 6. Próximos Pasos
- [ ] Indicador visual de "Sincronizando..." en tiempo real.
- [ ] Reintentos automáticos (Backoff) en fallos de subida de imágenes.
- [ ] Auditoría de seguridad en las llaves VAPID.

---
*Mantener este documento actualizado es obligatorio tras cada cambio arquitectónico.*
