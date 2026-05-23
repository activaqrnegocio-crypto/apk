# 🔒 BACKUP — Modal "Agendar Tarea" del Calendario Maestro
**Fecha del Backup:** 2026-05-22 19:45 (Ecuador Time)  
**Estado:** ✅ Funcionando correctamente al momento del backup  
**Ruta en producción:** `/admin/calendario`

---

## 📁 Archivos Incluidos en este Backup

### Componentes Frontend (React/Next.js)

| Archivo | Ruta Original | Tamaño | Descripción |
|---------|--------------|--------|-------------|
| `AppointmentModal.tsx` | `src/components/Calendar/AppointmentModal.tsx` | 60KB (1518 líneas) | **Componente principal del modal** — Contiene todo el formulario, lógica de guardado, subida de archivos, GPS, dictado por voz, y estilos JSX |
| `CalendarView.tsx` | `src/components/Calendar/CalendarView.tsx` | 17KB (507 líneas) | Vista del calendario (mes/semana) que dispara la apertura del modal |
| `CalendarAssistant.tsx` | `src/components/Calendar/CalendarAssistant.tsx` | 22KB | Asistente IA del calendario |
| `AdminCalendarClient.tsx` | `src/app/admin/calendario/AdminCalendarClient.tsx` | 18KB (555 líneas) | **Orquestador cliente** — Maneja estado, cache (Dexie/IndexedDB), offline support, y conecta CalendarView ↔ AppointmentModal |
| `page.tsx` | `src/app/admin/calendario/page.tsx` | 1.4KB (51 líneas) | Server component — Autenticación, permisos (RBAC), carga de operadores/proyectos desde Prisma |

### APIs Backend (Next.js Route Handlers)

| Archivo | Ruta Original | Descripción |
|---------|--------------|-------------|
| `route.ts` | `src/app/api/appointments/route.ts` | **GET** (listar tareas) + **POST** (crear tarea) con notificaciones WhatsApp y Push |
| `[id]/route.ts` | `src/app/api/appointments/[id]/route.ts` | **PATCH** (actualizar tarea) + **DELETE** (eliminar tarea) con notificaciones |
| `projects-by-operators/route.ts` | `src/app/api/admin/calendar/projects-by-operators/route.ts` | Filtra proyectos por operadores asignados (para el dropdown del modal) |

---

## 🏗️ Arquitectura del Modal

```
┌─────────────────────────────────────────────────────┐
│  page.tsx (Server)                                  │
│  → Auth, RBAC, Prisma queries                       │
│  → Pasa operators, projects, isAdmin, userId        │
└─────────────┬───────────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────────┐
│  AdminCalendarClient.tsx (Client)                    │
│  → useState para appointments, modal, editing       │
│  → Cache: localStorage (operators) + Dexie (tasks)  │
│  → Offline: BroadcastChannel, Background Sync       │
│  → handleSaveAppointment() → POST/PATCH api         │
│  → handleDeleteAppointment() → DELETE api           │
└──────┬──────────────────────┬───────────────────────┘
       │                      │
┌──────▼──────┐    ┌──────────▼─────────────────────┐
│ CalendarView│    │ AppointmentModal                │
│ (Grilla)    │    │ → Formulario completo            │
│ → onAddEvent│    │ → Subida archivos (Bunny CDN)    │
│ → onEditEvt │    │ → GPS capture                    │
│             │    │ → Speech-to-text                  │
│             │    │ → Multi-operator assignment       │
│             │    │ → createPortal (document.body)    │
└─────────────┘    └──────────────────────────────────┘
```

---

## 🔧 Funcionalidades del Modal (AppointmentModal.tsx)

### Columna Izquierda
1. **Título de la Actividad** — Input text, required
2. **Estado Semáforo** — Select con colores dinámicos:
   - 🟡 PENDIENTE (Amarillo)
   - 🟢 REALIZADA (Verde)
   - 🔴 NO REALIZADA / ATRASADA (Rojo)
3. **Asignar Operadores** — Dropdown multi-select (solo admin)
   - Checkbox individual por operador
   - Opción "TODOS"
4. **Proyecto Relacionado** — Select filtrado por operadores seleccionados (API `/api/admin/calendar/projects-by-operators`)
5. **Bloque de Ubicación:**
   - 👤 Cliente (nombre) + botón WhatsApp si tiene teléfono
   - 📞 Contacto
   - 📍 Ubicación Cliente (link Google Maps) + botón "Abrir GPS"
   - 📡 Ubicación Operario (GPS) + botón "Capturar mi GPS"
6. **Botón "Ver Detalles del Proyecto"** — Si hay proyecto vinculado

### Columna Derecha
1. **Horario Inicio / Fin** — datetime-local inputs, required
2. **Adjuntos (Max 5MB):**
   - 📷 Foto (capture=environment)
   - 🎬 Video (capture=environment)
   - 📁 Archivos (multiple, acepta image/video/audio/pdf)
   - Preview gallery con thumbnails 90x90px
   - Lightbox para previsualización grande
3. **Notas / Instrucciones** — Textarea + 🎤 Dictar (Speech-to-text, es-ES)

### Footer
- Botón "Eliminar" (solo en edición, con confirm)
- Botón "Cancelar"
- Botón "Agendar" / "Actualizar"

---

## 🌐 Flujo de Datos al Guardar

1. Validación de fechas (end > start)
2. Obtener IDs de operadores seleccionados
3. **Online:**
   - Comprimir imágenes (WebP via `image-optimization`)
   - Subir a Bunny CDN (`uploadToBunnyClientSide`)
   - Videos → links, Imágenes/Audio/Docs → realFiles
4. **Offline:**
   - Comprimir → Base64 → Guardar en outbox (Dexie)
   - Background Sync via Service Worker
5. Combinar archivos existentes + nuevos
6. `forceEcuadorTZ()` en las fechas
7. POST/PATCH a `/api/appointments`
8. API:
   - Idempotency check (x-sync-id header + 15s duplicate window)
   - Crear/Actualizar en Prisma
   - Notificaciones Push + WhatsApp a TODOS los operadores asignados

---

## 📱 Responsive (Mobile)
- Modal ocupa 100vw × 100dvh (fullscreen)
- Layout cambia de 2 columnas → 1 columna
- Footer con botones apilados (column-reverse)
- Scroll interno para el contenido

---

## ⚙️ Dependencias Clave

| Módulo | Uso |
|--------|-----|
| `@/lib/date-utils` | `getLocalNow`, `formatForDateTimeInput`, `forceEcuadorTZ`, `formatTimeEcuador`, `formatDateEcuador`, `toEcuadorISODate` |
| `@/lib/storage-client` | `uploadToBunnyClientSide` — Subida directa a Bunny CDN |
| `@/lib/image-optimization` | `compressImage` — Compresión a WebP |
| `@/lib/db` | Dexie (IndexedDB) — `appointmentsCache`, `projectsCache`, `outbox` |
| `@/lib/rbac` | `isAdmin`, `hasModuleAccess` |
| `@/lib/whatsapp` | `sendWhatsAppMessage` |
| `@/lib/push` | `notifyUser` |
| `@/lib/prisma` | ORM para DB |
| `@/lib/auth` | `authOptions` (next-auth) |
| `dexie-react-hooks` | `useLiveQuery` para observar outbox en tiempo real |

---

## 🔄 Cómo Restaurar

Si necesitas volver a esta versión exacta:

```powershell
# Desde la raíz del proyecto
Copy-Item "backup_calendario_modal\components\Calendar\*" "src\components\Calendar\" -Force
Copy-Item "backup_calendario_modal\app\admin\calendario\*" "src\app\admin\calendario\" -Force
Copy-Item "backup_calendario_modal\app\api\appointments\route.ts" "src\app\api\appointments\route.ts" -Force
Copy-Item "backup_calendario_modal\app\api\appointments\[id]\route.ts" "src\app\api\appointments\[id]\route.ts" -Force
Copy-Item "backup_calendario_modal\app\api\admin\calendar\projects-by-operators\route.ts" "src\app\api\admin\calendar\projects-by-operators\route.ts" -Force
```

> ⚠️ **IMPORTANTE:** Este backup NO incluye las dependencias (`@/lib/*`). Si esas utilidades cambian, la restauración podría requerir ajustes.
