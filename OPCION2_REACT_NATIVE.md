# OPCIÓN 2: React Native App (APP NUEVA) - GUÍA COMPLETA

> **REGLA PRINCIPAL**: La PWA actual NO se toca. Funciona exactamente como está ahora.
> **NOTA**: Esta es una APP NUEVA, diferente a la PWA. Se construye desde cero.

---

## 📋 Resumen del Proyecto

| Aspecto | Detalle |
|---------|---------|
| **Objetivo** | Crear app nativa REAL (no es wrapper) |
| **Tecnología** | React Native + TypeScript |
| **Resultado** | APK compilado con código RN |
| **server.url** | NO usa server.url (código bunduleado) |
| **Offline** | SQLite nativo (robusto) |
| **Background Sync** | WorkManager nativo |
| **Deploy código React** | GitHub → VPS (NO afecta a la app) |
| **Deploy app nativa** | Build → Play Console (manual) |
| **Esfuerzo** | Significativo (2-4 semanas) |

---

## 🎯 Cómo funciona esta opción

```
┌─────────────────────────────────────────────────────────────────┐
│  APP NATIVA (Código React Native compilado)                      │
│                                                                 │
│  El APK contiene:                                               │
│  ├── Todo el código JavaScript/TypeScript                       │
│  ├── Recursos (imágenes, íconos)                               │
│  └── Plugins nativos (SQLite, WorkManager)                      │
│                                                                 │
│  NO carga de tu servidor como la PWA                            │
│  Es una app completamente独立的                                 │
│                                                                 │
│  Cambios en código React:                                       │
│  ├── Deploy a GitHub → VPS (NO afecta a la app)                │
│  ├── Tienes que hacer BUILD nuevo                               │
│  └── Subir a Play Console → Users actualizan                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## ⚠️ Diferencia con Opción 3 (Capacitor)

| Aspecto | Opción 3 (Capacitor) | Opción 2 (React Native) |
|--------|---------------------|------------------------|
| Código | Carga tu PWA | App nueva |
| Cambios de código | Se ven inmediato | Necesitas rebuild |
| Deploy | GitHub → VPS | GitHub → VPS + Play Console |
| Users descargan | Nunca para código | Sí para cada update |
| Offline | Mejorado | Mejor (SQLite) |
| Background sync | Mejorado | Mejor (WorkManager) |
| Trabajo | 1-2 semanas | 2-4 semanas |

---

## 📁 Estructura del Proyecto

```
d:\Abel paginas\Aquatech\
├── crm mayo\
│   └── aquatech-render-main\         ← TU PWA (NO SE TOCA) ❌
│
├── aquatech-app-native\              ← NUEVO PROYECTO ✅
│   ├── src/                          # Código React Native
│   │   ├── screens/                  # Pantallas
│   │   ├── components/                # Componentes
│   │   ├── services/                  # API, DB, Sync
│   │   ├── hooks/                    # useAuth, useProjects, etc.
│   │   └── App.tsx                   # Entry point
│   ├── android/                      # Generado por RN CLI
│   ├── ios/                          # Generado por RN CLI (futuro)
│   ├── package.json
│   └── README.md
```

---

## 🔧 Stack Tecnológico

| Componente | Librería | Propósito |
|------------|----------|-----------|
| Framework | React Native 0.76+ | Código que compila a nativo |
| Lenguaje | TypeScript | Compatible con tu código actual |
| DB Offline | react-native-sqlite-storage | SQLite nativo |
| Background Sync | react-native-background-fetch | WorkManager |
| Navigation | @react-navigation/native | Navegación |
| State | Zustand | Estado global |
| HTTP | fetch (nativo) | Conexión API |

---

## 📦 Instalación - Paso a Paso

### Paso 1: Requisitos

- Node.js 18+
- Android Studio (con SDK Android 14+)
- Java JDK 17
- Un dispositivo Android o emulador

### Paso 2: Crear proyecto

```bash
cd "d:\Abel paginas\Aquatech"

# Crear proyecto React Native (NO usar Expo para control nativo)
npx react-native@latest init aquatech-app-native
```

**⚠️ IMPORTANTE**: Este comando crea un proyecto COMPLETAMENTE NUEVO. No hereda código de tu PWA. Hay que reescribir las pantallas.

### Paso 3: Instalar dependencias

```bash
cd aquatech-app-native

# Navegación
npm install @react-navigation/native @react-navigation/native-stack
npm install react-native-screens react-native-safe-area-context

# Base de datos (SQLite offline)
npm install react-native-sqlite-storage

# Background sync
npm install react-native-background-fetch

# State management
npm install zustand

# Notificaciones (si quieres)
npm install react-native-push-notification
```

### Paso 4: Configurar proyecto

```typescript
// src/config/api.ts
export const API_URL = 'https://tu-vps.com/api';

// src/config/constants.ts
export const DB_NAME = 'aquatech_crm.db';
```

### Paso 5: Crear servicios

```typescript
// src/services/database.ts
import SQLite from 'react-native-sqlite-storage';

SQLite.DEBUG(true);
SQLite.enablePromise(true);

const DATABASE_NAME = 'aquatech_crm.db';

export async function openDatabase() {
  return SQLite.openDatabase({
    name: DATABASE_NAME,
    location: 'default',
  });
}

// Crear tablas
export async function createTables(db: any) {
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      phone TEXT,
      company TEXT,
      updatedAt TEXT
    )
  `);
  
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation TEXT,
      tableName TEXT,
      recordId TEXT,
      data TEXT,
      createdAt TEXT,
      status TEXT DEFAULT 'pending'
    )
  `);
}
```

### Paso 6: Crear servicios de sync

```typescript
// src/services/sync.ts
import { openDatabase } from './database';

export async function syncPendingChanges() {
  const db = await openDatabase();
  
  // Obtener pendientes
  const [results] = await db.executeSql(
    'SELECT * FROM sync_queue WHERE status = "pending"'
  );
  
  for (let i = 0; i < results.rows.length; i++) {
    const item = results.rows.item(i);
    try {
      // Enviar al servidor
      const response = await fetch(`${API_URL}/${item.tableName}`, {
        method: item.operation === 'delete' ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: item.data,
      });
      
      if (response.ok) {
        // Marcar como synced
        await db.executeSql(
          'UPDATE sync_queue SET status = "synced" WHERE id = ?',
          [item.id]
        );
      }
    } catch (error) {
      console.error('Sync error:', error);
    }
  }
}
```

### Paso 7: Configurar Background Fetch

```typescript
// src/services/backgroundSync.ts
import BackgroundFetch from 'react-native-background-fetch';

export async function configureBackgroundFetch() {
  const status = await BackgroundFetch.configure({
    minimumFetchInterval: 15, // 15 minutos
    stopOnTerminate: false,
    startOnBoot: true,
    enableHeadless: true,
  }, async (taskId) => {
    console.log('[BackgroundFetch] Task:', taskId);
    
    // Sincronizar datos
    await syncPendingChanges();
    
    BackgroundFetch.finish(taskId);
  }, async (taskId) => {
    console.log('[BackgroundFetch] Timeout:', taskId);
    BackgroundFetch.finish(taskId);
  });
}
```

### Paso 8: Crear pantallas

```
src/screens/
├── LoginScreen.tsx          # Login (usa tu API de auth)
├── DashboardScreen.tsx      # Dashboard principal
├── ProjectsScreen.tsx       # Lista de proyectos
├── ProjectDetailScreen.tsx  # Detalle de proyecto
├── ClientsScreen.tsx        # Lista de clientes
└── CalendarScreen.tsx       # Calendario
```

### Paso 9: Navigation

```typescript
// src/App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator();

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Projects" component={ProjectsScreen} />
        <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

---

## 📱 Build y Publicación

### Build de prueba:

```bash
cd aquatech-app-native

# Bundlar JavaScript
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res

# Build debug APK
cd android
./gradlew assembleDebug
```

### Build de producción:

```bash
cd android
./gradlew assembleRelease
# O en Android Studio: Build → Generate Signed Bundle / APK
```

### Publicar en Play Store:

1. Crear app en [Google Play Console](https://play.google.com/console)
2. Subir `.aab` o `.apk` firmado
3. Llenar información de store
4. Enviar a revisión

---

## 🔄 Flujo de Actualizaciones

### Cambios de código (React):

```
1. Haces cambios en código RN
2. Build nueva APK/AAB
3. Subes a Play Console
4. Google revisa (horas a días)
5. Users reciben actualización automática
```

---

## 📋 Checklist de Implementación

```
□ 1. Crear proyecto con npx react-native init
□ 2. Instalar dependencias (navigation, sqlite, etc.)
□ 3. Configurar SQLite (tablas, DB)
□ 4. Crear servicios (API, sync)
□ 5. Configurar Background Fetch
□ 6. Crear navegación
□ 7. Implementar LoginScreen
□ 8. Implementar DashboardScreen
□ 9. Implementar ProjectsScreen
□ 10. Implementar ProjectDetailScreen
□ 11. Implementar ClientsScreen
□ 12. Implementar CalendarScreen
□ 13. Implementar ChatScreen (polling)
□ 14. Testing offline completo
□ 15. Testing background sync
□ 16. Build release APK/AAB
□ 17. Publicar en Play Store
```

---

## 🎯 Diferencia en EXPERIENCIA DE USUARIO

| Pantalla | En PWA | En React Native |
|----------|--------|-----------------|
| Login | Exactamente igual | Adaptado a nativo |
| Dashboard | Exactamente igual | Similar, diseñado para app |
| Lista proyectos | Exactamente igual | Similar, más rápido |
| Detalle proyecto | Exactamente igual | Similar, mejor offline |
| Chat | Exactamente igual | Polling igual, notificaciones |

La experiencia será CASI IDENTICA pero con mejor offline y sync.

---

## ⏱️ Tiempo de desarrollo estimado

| Fase | Días | Descripción |
|------|------|-------------|
| Setup | 1-2 | Proyecto, dependencias, config |
| Database | 2-3 | SQLite, tablas, servicios |
| Auth | 1-2 | Login, sesión |
| Screens | 5-7 | Dashboard, proyectos, detalle, clientes, calendario |
| Chat | 1-2 | Chat con polling |
| Sync | 2-3 | Background sync, workmanager |
| Testing | 2-3 | Offline, sync, edge cases |
| Build | 1 | APK, Play Store |

**Total: ~2-3 semanas** (con 15h/día 가능합니다)

---

## ❓ Preguntas para antes de proceder

1. **¿Estás de acuerdo con reescribir las pantallas?** (UI similar pero código nuevo)
2. **¿Quieres que la app se vea EXACTAMENTE igual a la PWA o puedes aceptar diferencias menores?**
3. **¿Cuál es tu prioridad: tiempo rápido (Opción 3) o app más robusta (esta opción)?**

---

*Documento creado: 28 Mayo 2026*
*Opción 2: React Native App Nueva*