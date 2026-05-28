# 📋 PLAN COMPLETO: Reorganización de Almacenamiento en BunnyCDN

> **Fecha:** 26 de Mayo 2026
> **Objetivo:** Reorganizar la estructura de carpetas en BunnyCDN sin romper funcionalidad existente.
> **Regla de Oro:** Los archivos antiguos (ya subidos) NO se tocan. Solo los nuevos uploads usarán la nueva estructura.

---

## 🎯 Estructura Deseada en BunnyCDN

```
📁 recursos/                          ← Sin cambios ✅ (ya funciona así)
📁 Proyectos/
  📁 {projectId}/                     ← Ej: 1050
    📁 Chat/                          ← Archivos del chat del proyecto
    📁 Finales/                       ← Galería con categoría "FINALES"
    📁 Planos/                        ← Galería con categoría "MASTER" (principal)
📁 avatars/                           ← Sin cambios ✅ (no se toca)
📁 appointments/                      ← Sin cambios ✅ (no se toca)
📁 aquatech-crm/                      ← Solo fallback, no se toca
📁 projects/                          ← ARCHIVOS ANTIGUOS — Se quedan aquí, no se borran
```

---

## 📊 DIAGNÓSTICO: Estado Actual de Rutas

| # | Uso | Ruta Actual en BunnyCDN | Archivo(s) que la usan | ¿OK? |
|---|-----|------------------------|------------------------|------|
| 1 | Recursos | `recursos/{ts}-{suffix}-{file}` | `ResourceGrid.tsx:135` | ✅ |
| 2 | Proyecto nuevo (online) | `projects/{ts}-{suffix}-{file}` | `ProjectCreationWizard.tsx:512,1126,1256,1292` | ❌ |
| 3 | Proyecto nuevo (offline→online SW) | `projects/{ts}-{suffix}-{file}` | `custom-sw.js:1958` | ❌ |
| 4 | Chat del proyecto | `projects/{id}/chat/{ts}-{suffix}-{file}` | `ProjectExecutionClient.tsx:1065` | ⚠️ |
| 5 | Galería del proyecto | `projects/{id}/gallery/{ts}-{suffix}-{file}` | `ProjectExecutionClient.tsx:1459`, `custom-sw.js:1960` | ❌ |
| 6 | Uploader en proyecto | `projects/{ts}-{suffix}-{file}` | `ProjectUploader.tsx:170` | ❌ |
| 7 | Servidor (base64 fallback) | `projects/{ts}-{suffix}-{file}` | `bunny.ts:6`, `route.ts:~200` | ❌ |
| 8 | Avatares | `avatars/{ts}-{suffix}-{file}` | `team/page.tsx:163` | ✅ No se toca |
| 9 | Appointments | `appointments/{ts}-{suffix}-{file}` | `AppointmentModal.tsx:332` | ✅ No se toca |

---

## ⚠️ ANÁLISIS DE RIESGOS COMPLETO

### 🔴 Riesgo 1 — Archivos Huérfanos (BAJO impacto)
**Descripción:** Los archivos viejos en `projects/...` quedan sin referencias en BD después del cambio, pero siguen ocupando espacio en BunnyCDN.

**Impacto real:** Ninguno funcional. Las URLs viejas en BD (`ProjectGalleryItem.url`, `MediaFile.url`) siguen apuntando a rutas viejas que FUNCIONAN. BunnyCDN no borra archivos automáticamente.

**Mitigación:** 
- No se hace nada en esta fase. Convivencia pacífica entre rutas viejas y nuevas.
- Limpieza futura: script que compare URLs en BD vs archivos en storage (opcional, fuera de alcance).

---

### 🔴 Riesgo 2 — URLs Existentes en Base de Datos (CRÍTICO - Mitigado)
**Descripción:** Si al mover archivos cambiamos URLs en la BD sin hacer el movimiento físico, los archivos se "pierden".

**Impacto real:** NINGUNO. Porque:
- Las URLs viejas en BD NO se modifican.
- Los archivos físicos viejos NO se mueven ni se borran.
- Solo los NUEVOS uploads usarán las NUEVAS rutas.
- Un proyecto creado mañana: sus archivos van a `Proyectos/1051/Planos/...`
- Un proyecto creado ayer: sus archivos siguen en `projects/1049/gallery/...` y su BD apunta ahí.

**Mitigación:** No migrar datos viejos. Cero riesgo.

---

### 🔴 Riesgo 3 — Carpeta `/nuevo` o `/temp` mal nombrada (ALTO)
**Descripción:** En el flujo offline→online, si se usa una palabra fija como `"nuevo"` en vez de un UUID único, se crea la carpeta `Proyectos/temp/nuevo/...` con archivos mezclados de múltiples proyectos.

**Impacto:** Caos — archivos de distintos proyectos en una misma carpeta. Imposible ordenar después.

**Mitigación:** Usar `crypto.randomUUID()` para generar un `tempId` ÚNICO por proyecto. Ejemplo: `Proyectos/temp/a1b2c3d4-e5f6-7890-abcd-ef1234567890/...`. Este UUID se genera UNA SOLA VEZ:
- En modo online: al iniciar el wizard
- En modo offline: al guardar en outbox (IndexedDB)

---

### 🔴 Riesgo 4 — Doble Upload desde el Cliente (MEDIO - Mitigado)
**Descripción:** El usuario expresó preocupación por subir archivos 2 veces (a temp y luego a ubicación final).

**Realidad:** El cliente (navegador) SOLO sube UNA vez: a la carpeta `Proyectos/temp/{tempId}/`. Luego, el **SERVIDOR** (VPS) hace la copia de temp → ubicación final usando GET/PUT a BunnyCDN. Esto NO es un re-upload desde el navegador del usuario.

**Impacto en rendimiento:**
- Cliente: Sin cambios perceptibles (misma cantidad de datos subidos).
- Servidor: Descarga + re-subida a BunnyCDN. En VPS con 1Gbps, un archivo de 10MB se copia en ~2-3 segundos.
- Proyectos con 20+ archivos: ~10-15 segundos extra en el POST /api/projects.
- **Mitigación:** Procesar archivos en paralelo (Promise.all con límite de 3 concurrentes).

---

### 🔴 Riesgo 5 — Timeout en API al Mover Archivos (MEDIO)
**Descripción:** Si el proyecto tiene muchos archivos pesados, el server-side copy (GET+PUT+DELETE por cada archivo) puede exceder el timeout del request HTTP (60s en Vercel, ilimitado en VPS).

**Impacto:** Error 504 Gateway Timeout. El proyecto se crea pero algunos archivos quedan en temp.

**Mitigación:**
- Límite de 3 copias concurrentes.
- Timeout individual por archivo: 30 segundos.
- Si un archivo falla al moverse, queda en temp pero su URL en BD apunta a temp (sigue funcionando).
- Se puede implementar un endpoint separado `POST /api/projects/{id}/finalize-storage` que el frontend llama después de crear el proyecto.
- En VPS (producción real) no hay timeout estricto como en Vercel.

---

### 🔴 Riesgo 6 — Duplicados por Competencia SW vs GlobalSyncWorker (BAJO)
**Descripción:** El Service Worker y GlobalSyncWorker pueden intentar procesar el mismo outbox item simultáneamente.

**Estado actual:** Ya mitigado en v372 con `isSyncingGlobal` flag. El SW detecta si la página está visible y se abstiene.

**Riesgo adicional con tempId:** Si ambos generan diferente tempId, habría duplicados.

**Mitigación:** El `tempId` se genera UNA SOLA VEZ al crear el proyecto (en el wizard, online u offline). Se guarda como parte del `payload` en el outbox. El SW y GlobalSyncWorker leen el MISMO `tempId` del outbox item.

---

### 🔴 Riesgo 7 — Pérdida de Archivos Offline si TempId no Persiste (ALTO)
**Descripción:** Si el `tempId` no se guarda correctamente en IndexedDB con el outbox item, al recargar la página o al sincronizar después, el SW no sabrá qué carpeta temp usar.

**Impacto:** Los archivos se subirían a una ruta incorrecta o el sync fallaría.

**Mitigación:** El `tempId` DEBE ser parte del `payload` del outbox item en IndexedDB. Se genera en el wizard ANTES de guardar en outbox. Estructura:
```json
{
  "type": "PROJECT",
  "projectId": 0,
  "payload": {
    "title": "Piscina Los Olivos",
    "tempId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "files": [...],
    ...
  }
}
```

---

### 🔴 Riesgo 8 — Cambios en .env de Producción (MEDIO)
**Descripción:** Las nuevas credenciales de BunnyCDN deben configurarse en el .env del VPS.

**Impacto:** Si se cambia el .env sin tener el código actualizado, o viceversa, los uploads fallarán.

**Mitigación (Plan de despliegue):**
1. Primero: Merge del código a main
2. Segundo: Pull en VPS
3. Tercero: Cambiar .env en VPS con las nuevas credenciales
4. Cuarto: `docker-compose down && docker-compose up -d --build`
5. Verificar: Subir un archivo de prueba

---

## 🛠️ PLAN DE IMPLEMENTACIÓN PASO A PASO

---

### ── PASO 0: PREPARACIÓN ──

#### 0.1 Crear Rama Git
```bash
git checkout -b feature/reorganizar-bunnycdn
```

#### 0.2 Verificar Estado Actual
```bash
git status
git log --oneline -5
```

#### 0.3 Entender que NO se toca
- ❌ `recursos/` → carpeta y código actual
- ❌ `avatars/` → carpeta y código actual
- ❌ `appointments/` → carpeta y código actual
- ❌ `aquatech-crm/` → fallback default
- ❌ Archivos ya existentes en BunnyCDN → NUNCA se borran ni mueven
- ❌ URLs en base de datos → NUNCA se modifican para registros existentes

---

### ── PASO 1: Cambiar Rutas con ProjectId Existente (Chat + Galería) ──

Estos son los casos MÁS SEGUROS porque YA existe un `projectId` al momento de subir. No requieren `tempId`.

#### 1.1 Chat del Proyecto
**Archivo:** `src/components/ProjectExecutionClient.tsx`

**Ubicación:** Línea ~1065

**Código ACTUAL:**
```typescript
const uploadResult = await uploadToBunnyClientSide(processedMedia!, finalFilename, `projects/${project.id}/chat`)
```

**Código NUEVO:**
```typescript
const uploadResult = await uploadToBunnyClientSide(processedMedia!, finalFilename, `Proyectos/${project.id}/Chat`)
```

---

#### 1.2 Galería del Proyecto (Subida normal)
**Archivo:** `src/components/ProjectExecutionClient.tsx`

**Ubicación:** Línea ~1457-1459

**Código ACTUAL:**
```typescript
const { uploadToBunnyClientSide } = await import('@/lib/storage-client');
const folder = `projects/${project.id}/gallery`;
const uploadResult = await uploadToBunnyClientSide(uploadFile, file.filename || 'upload', folder);
```

**Código NUEVO:**
```typescript
const { uploadToBunnyClientSide } = await import('@/lib/storage-client');
// Determinar subcarpeta según categoría
const galleryCategory = galleryPayload?.category || 'MASTER';
const categoryFolder = galleryCategory === 'FINALES' ? 'Finales' : 'Planos';
const folder = `Proyectos/${project.id}/${categoryFolder}`;
const uploadResult = await uploadToBunnyClientSide(uploadFile, file.filename || 'upload', folder);
```

---

#### 1.3 ProjectUploader (Uploader dentro de un proyecto existente)
**Archivo:** `src/components/ProjectUploader.tsx`

**Ubicación:** Línea ~170

**Código ACTUAL:**
```typescript
const data = await uploadToBunnyClientSide(uploadFile, finalFilename, 'projects')
```

**Código NUEVO:**
```typescript
// Si hay projectId y category, usar ruta estructurada
const uploadFolder = projectId 
  ? `Proyectos/${projectId}/${category === 'FINALES' ? 'Finales' : 'Planos'}`
  : 'Proyectos/temp/default';
const data = await uploadToBunnyClientSide(uploadFile, finalFilename, uploadFolder)
```

⚠️ **Nota:** Este componente necesita recibir `projectId` y `category` como props. Revisar dónde se usa `<ProjectUploader>` y pasarle estas props.

---

#### 1.4 Service Worker — uploadMediaSW (para items CON projectId)
**Archivo:** `public/custom-sw.js`

**Ubicación:** Línea ~1958

**Código ACTUAL:**
```javascript
let folderPath = item.projectId ? `projects/${item.projectId}` : subfolder;
if (subfolder === 'gallery' && item.projectId) {
  folderPath = `projects/${item.projectId}/gallery`;
}
```

**Código NUEVO:**
```javascript
let folderPath;
if (item.projectId) {
  // Determinar subcarpeta según tipo y categoría
  if (subfolder === 'messages') {
    folderPath = `Proyectos/${item.projectId}/Chat`;
  } else if (subfolder === 'gallery') {
    const cat = (item.payload?.category || 'MASTER');
    const catFolder = cat === 'FINALES' ? 'Finales' : 'Planos';
    folderPath = `Proyectos/${item.projectId}/${catFolder}`;
  } else if (subfolder === 'expenses') {
    folderPath = `Proyectos/${item.projectId}/Gastos`;
  } else {
    folderPath = `Proyectos/${item.projectId}`;
  }
} else {
  // Sin projectId → usar tempId del payload o fallback a subfolder
  folderPath = item.payload?.tempId 
    ? `Proyectos/temp/${item.payload.tempId}` 
    : subfolder;
}
```

---

#### 1.5 Service Worker — uploadInChunksSW (misma lógica)
**Archivo:** `public/custom-sw.js`

**Ubicación:** Línea ~2020

**Código ACTUAL:**
```javascript
let finalSubfolder = subfolder;
if (subfolder === 'gallery' && item.projectId) {
  finalSubfolder = `projects/${item.projectId}/gallery`;
}
```

**Código NUEVO:**
```javascript
let finalSubfolder = subfolder;
if (item.projectId) {
  if (subfolder === 'gallery') {
    const cat = (item.payload?.category || 'MASTER');
    const catFolder = cat === 'FINALES' ? 'Finales' : 'Planos';
    finalSubfolder = `Proyectos/${item.projectId}/${catFolder}`;
  } else if (subfolder === 'messages') {
    finalSubfolder = `Proyectos/${item.projectId}/Chat`;
  } else {
    finalSubfolder = `Proyectos/${item.projectId}`;
  }
} else if (item.payload?.tempId) {
  finalSubfolder = `Proyectos/temp/${item.payload.tempId}`;
}
```

---

### ── PASO 2: Resolver Creación de Proyecto ONLINE ──

**Estrategia:** Generar `tempId` al iniciar el wizard → subir a `Proyectos/temp/{tempId}/` → API crea proyecto → API mueve archivos a ubicación final.

#### 2.1 ProjectCreationWizard — Generar tempId y usarlo
**Archivo:** `src/components/ProjectCreationWizard.tsx`

**Paso 2.1a:** Al inicio del wizard (en el estado del componente), generar un `tempId`:
```typescript
// Añadir al inicio del componente, junto con los otros useState:
const [uploadTempId] = useState<string>(() => crypto.randomUUID())
```

**Paso 2.1b:** En TODOS los lugares donde se sube con folder `'projects'`, cambiar por la ruta temp:

**Ubicación:** Líneas ~512, ~1126, ~1256, ~1292

**Código ACTUAL (en las 4 ubicaciones):**
```typescript
const uploadResult = await uploadToBunnyClientSide(blob, filename, 'projects');
```

**Código NUEVO (en las 4 ubicaciones):**
```typescript
const uploadResult = await uploadToBunnyClientSide(blob, filename, `Proyectos/temp/${uploadTempId}`);
```

**Paso 2.1c:** Incluir `tempId` en el payload enviado a la API:
```typescript
// En el objeto payload que se envía al POST /api/projects:
const payload = {
  title, type, client, phases, team, budgetItems,
  tempId: uploadTempId,  // ← AÑADIR ESTO
  files: uploadedFiles.map(f => ({...}))
};
```

**Paso 2.1d:** Para el modo OFFLINE, guardar el `tempId` en el outbox:
```typescript
// Al guardar en outbox para modo offline:
await db.outbox.add({
  type: 'PROJECT',
  projectId: 0,
  payload: {
    ...payload,
    tempId: uploadTempId,  // ← Ya incluido en payload
    files: [...]
  },
  timestamp: Date.now(),
  status: 'pending'
});
```

---

#### 2.2 API de Proyectos — Recibir tempId y mover archivos
**Archivo:** `src/app/api/projects/route.ts`

**Paso 2.2a:** Extraer `tempId` del body:
```typescript
const { title, type, ..., tempId } = data;  // ← Añadir tempId
```

**Paso 2.2b:** Después de crear el proyecto (dentro de la transacción o justo después), mover archivos:

```typescript
// DESPUÉS de crear el proyecto y obtener newProject.id:

if (tempId && processedFiles.length > 0) {
  const projectId = newProject.id;
  
  // Mover archivos de temp a ubicación final (máx 3 concurrentes)
  const moveFile = async (file: any) => {
    if (!file.url || !file.url.includes(`/temp/${tempId}/`)) {
      return file; // No necesita moverse
    }
    
    try {
      const urlObj = new URL(file.url);
      const pathParts = urlObj.pathname.split('/');
      const filename = pathParts[pathParts.length - 1]; // Último segmento
      
      const category = file.category || 'MASTER';
      const catFolder = category === 'FINALES' ? 'Finales' : 'Planos';
      const newFolder = `Proyectos/${projectId}/${catFolder}`;
      
      // 1. Descargar de temp
      const tempResponse = await fetch(file.url);
      if (!tempResponse.ok) throw new Error(`Failed to fetch temp file: ${tempResponse.status}`);
      const fileBuffer = Buffer.from(await tempResponse.arrayBuffer());
      
      // 2. Subir a ubicación final
      const newUrl = await uploadToBunny(fileBuffer, filename, newFolder, file.mimeType);
      
      // 3. Borrar de temp
      await deleteFromBunny(file.url);
      
      return { ...file, url: newUrl };
    } catch (err) {
      console.error(`[FinalizeStorage] Error moving file: ${file.filename}`, err);
      return file; // Si falla, mantener URL temp (sigue funcionando)
    }
  };
  
  // Procesar en batches de 3 para no saturar
  const BATCH_SIZE = 3;
  const movedFiles = [];
  for (let i = 0; i < processedFiles.length; i += BATCH_SIZE) {
    const batch = processedFiles.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(moveFile));
    movedFiles.push(...results);
  }
  
  // Actualizar processedFiles con las nuevas URLs
  // y actualizar los gallery items en BD
  for (let i = 0; i < movedFiles.length; i++) {
    processedFiles[i] = movedFiles[i];
  }
}
```

**Paso 2.2c:** Actualizar la creación de gallery items con las URLs ya corregidas:
```typescript
// En el gallery.create, usar processedFiles (ya actualizados):
gallery: {
  create: (processedFiles).map((file: any) => ({
    url: file.url,  // ← Ya apunta a ubicación final
    filename: file.filename || 'upload',
    mimeType: file.mimeType || 'application/octet-stream',
    sizeBytes: file.size || file.sizeBytes || null,
    category: file.category || 'MASTER'
  }))
}
```

---

#### 2.3 Servidor — Actualizar uploadToBunny default
**Archivo:** `src/lib/bunny.ts`

**Código ACTUAL:**
```typescript
export async function uploadToBunny(
  file: Buffer,
  filename: string,
  folder: string = 'aquatech-crm',
  ...
```

**Código NUEVO:**
```typescript
export async function uploadToBunny(
  file: Buffer,
  filename: string,
  folder: string = 'Proyectos/temp',
  ...
```

---

### ── PASO 3: Service Worker — Manejar tempId en Offline→Online ──

**Archivo:** `public/custom-sw.js`

#### 3.1 Al procesar PROJECT, leer tempId del payload
**Ubicación:** Línea ~2110 (bloque `if (item.type === 'PROJECT')`)

Asegurarse de que cuando se suben archivos, se use `payload.tempId`:

```javascript
if (item.type === 'PROJECT') {
  const tempId = payload.tempId; // Leer del payload
  
  // 1. Main project image
  if (payload.image || payload.fileData) {
    const source = payload.fileData || payload.image;
    if (source && ...) {
      const uploadFolder = tempId 
        ? `Proyectos/temp/${tempId}` 
        : 'projects'; // Fallback seguro
      payload.image = await uploadMediaSW(source, ..., uploadFolder);
    }
  }
  
  // 2. All attached files
  if (payload.files && Array.isArray(payload.files)) {
    for (let fi = 0; fi < payload.files.length; fi++) {
      const f = payload.files[fi];
      const uploadFolder = tempId 
        ? `Proyectos/temp/${tempId}` 
        : 'projects';
      f.url = await uploadMediaSW(source, f.filename, ..., uploadFolder);
    }
  }
}
```

#### 3.2 Enviar tempId en el POST a la API
Asegurarse de que el payload final enviado al endpoint incluya `tempId`:
```javascript
// El payload final que se envía:
const finalPayload = {
  ...payload,
  tempId: payload.tempId,  // Reenviar el tempId a la API
  files: payload.files.map(f => ({ url: f.url, filename: f.filename, ... }))
};
```

---

### ── PASO 4: Cambios en el Servidor (bunny.ts + API) ──

#### 4.1 Añadir función copyInBunny (opcional pero recomendado)
**Archivo:** `src/lib/bunny.ts`

```typescript
/**
 * Mueve un archivo de una ubicación a otra dentro de BunnyCDN.
 * Como BunnyCDN no tiene API de move, se hace GET + PUT + DELETE.
 */
export async function moveInBunny(
  sourceUrl: string,
  destFolder: string,
  destFilename: string
): Promise<string> {
  // 1. Descargar de origen
  const sourceResponse = await fetch(sourceUrl);
  if (!sourceResponse.ok) {
    throw new Error(`Failed to download source: ${sourceResponse.status}`);
  }
  const buffer = Buffer.from(await sourceResponse.arrayBuffer());
  const contentType = sourceResponse.headers.get('content-type') || 'application/octet-stream';
  
  // 2. Subir a destino
  const newUrl = await uploadToBunny(buffer, destFilename, destFolder, contentType);
  
  // 3. Borrar origen
  await deleteFromBunny(sourceUrl);
  
  return newUrl;
}
```

---

### ── PASO 5: Archivos que NO se Modifican (Confirmación) ──

| Archivo | Razón |
|---------|-------|
| `src/components/resources/ResourceGrid.tsx` | Ya usa `'recursos'` correctamente ✅ |
| `src/app/admin/team/page.tsx` | Ya usa `'avatars'` correctamente ✅ |
| `src/components/Calendar/AppointmentModal.tsx` | Ya usa `'appointments'` correctamente ✅ |
| `src/lib/storage-client.ts` | Solo recibe el `folder` como parámetro, no necesita cambios ✅ |
| `src/lib/image-optimization.ts` | No tiene lógica de rutas ✅ |
| `src/app/api/storage/config/route.ts` | Solo devuelve credenciales ✅ |
| `src/app/api/upload/chunk/route.ts` | Solo recibe `subfolder` como parámetro ✅ |

---

### ── PASO 6: Pruebas Locales ──

#### 6.1 Probar Creación de Proyecto Online
1. Iniciar servidor local: `npm run dev`
2. Iniciar sesión como admin
3. Crear un proyecto NUEVO con archivos adjuntos
4. Verificar en BunnyCDN que los archivos están en:
   - `Proyectos/temp/{tempId}/` (temporal durante creación)
   - `Proyectos/{newProjectId}/Planos/` (después de creación)

#### 6.2 Probar Chat en Proyecto Existente
1. Abrir un proyecto existente
2. Enviar un mensaje con imagen/video
3. Verificar en BunnyCDN: `Proyectos/{projectId}/Chat/...`

#### 6.3 Probar Galería en Proyecto Existente
1. Abrir un proyecto existente
2. Subir una imagen a la galería (MASTER/Planos)
3. Subir una imagen a Finales (si existe esa categoría)
4. Verificar en BunnyCDN:
   - `Proyectos/{projectId}/Planos/...`
   - `Proyectos/{projectId}/Finales/...`

#### 6.4 Probar Flujo Offline → Online
1. Desconectar internet (DevTools → Network → Offline)
2. Crear un proyecto (se guarda en outbox)
3. Reconectar internet
4. Esperar a que el SW o GlobalSyncWorker sincronice
5. Verificar en BunnyCDN: `Proyectos/{newProjectId}/Planos/...`

#### 6.5 Probar que Archivos Antiguos Siguen Funcionando
1. Abrir un proyecto creado ANTES de estos cambios
2. Ver imágenes de galería, chat, etc.
3. Deben cargar sin problemas (las URLs viejas en BD no cambiaron)

---

### ── PASO 7: Despliegue en Producción ──

#### 7.1 Secuencia de Despliegue

```bash
# 1. En local: commit y push
git add .
git commit -m "feat: reorganizar estructura BunnyCDN - Proyectos/{id}/{Chat|Finales|Planos}"
git push origin feature/reorganizar-bunnycdn

# 2. Merge a main (en GitHub o local)
git checkout main
git merge feature/reorganizar-bunnycdn
git push origin main

# 3. En VPS:
ssh root@vps
cd /ruta/a/aquatech-render
git pull origin main

# 4. Verificar .env en VPS (debe tener las NUEVAS credenciales BunnyCDN):
cat .env | grep BUNNY
# BUNNY_STORAGE_ZONE=aquatechdata
# BUNNY_STORAGE_API_KEY=aeffdae8-9d85-4dad-9974a95dff70-27c1-4a8c
# BUNNY_STORAGE_HOST=storage.bunnycdn.com
# BUNNY_PULLZONE_URL=https://aquatechdata.b-cdn.net

# 5. Reconstruir y reiniciar
docker-compose down
docker-compose up -d --build

# 6. Verificar logs
docker-compose logs -f --tail=50
```

#### 7.2 Verificaciones Post-Deploy
1. Subir un archivo de prueba en un proyecto nuevo
2. Verificar en BunnyCDN Dashboard que aparece en `Proyectos/{id}/Planos/`
3. Probar chat con imagen
4. Probar galería
5. Verificar que proyectos antiguos siguen mostrando sus archivos

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

### Paso 1: Rutas con ProjectId Existente
- [ ] `ProjectExecutionClient.tsx:1065` — Chat folder path
- [ ] `ProjectExecutionClient.tsx:1459` — Gallery folder path con categoría
- [ ] `ProjectUploader.tsx:170` — Recibir y usar projectId + category
- [ ] `custom-sw.js:1958` — uploadMediaSW folderPath lógica
- [ ] `custom-sw.js:2020` — uploadInChunksSW finalSubfolder lógica

### Paso 2: Creación de Proyecto Online
- [ ] `ProjectCreationWizard.tsx` — Generar `uploadTempId` (useState)
- [ ] `ProjectCreationWizard.tsx:512` — Cambiar `'projects'` → `Proyectos/temp/{tempId}`
- [ ] `ProjectCreationWizard.tsx:1126` — Cambiar `'projects'` → `Proyectos/temp/{tempId}`
- [ ] `ProjectCreationWizard.tsx:1256` — Cambiar `'projects'` → `Proyectos/temp/{tempId}`
- [ ] `ProjectCreationWizard.tsx:1292` — Cambiar `'projects'` → `Proyectos/temp/{tempId}`
- [ ] `ProjectCreationWizard.tsx` — Incluir `tempId` en payload a API
- [ ] `ProjectCreationWizard.tsx` — Guardar `tempId` en outbox (modo offline)
- [ ] `route.ts` — Extraer `tempId` del body
- [ ] `route.ts` — Mover archivos después de crear proyecto
- [ ] `route.ts` — Actualizar gallery.create con URLs finales
- [ ] `bunny.ts` — Cambiar default folder

### Paso 3: Service Worker Offline→Online
- [ ] `custom-sw.js:~2110` — Leer `tempId` del payload
- [ ] `custom-sw.js:~2110` — Usar `tempId` en carpeta de upload
- [ ] `custom-sw.js` — Enviar `tempId` en POST a API

### Paso 4: Pruebas
- [ ] Probar creación de proyecto online
- [ ] Probar chat en proyecto existente
- [ ] Probar galería en proyecto existente
- [ ] Probar flujo offline→online
- [ ] Probar que archivos antiguos cargan correctamente
- [ ] Verificar en BunnyCDN Dashboard que no hay archivos huérfanos nuevos

### Paso 5: Despliegue
- [ ] Commit y push a GitHub
- [ ] Merge a main
- [ ] Pull en VPS
- [ ] Verificar .env en VPS
- [ ] docker-compose down && up -d --build
- [ ] Verificar logs sin errores
- [ ] Prueba de humo en producción

---

## 🔄 RESUMEN DEL FLUJO COMPLETO

### Flujo Online (Creación de Proyecto)
```
Usuario abre wizard
  ↓
Wizard genera tempId = crypto.randomUUID()
  ↓
Usuario arrastra archivos
  ↓
Cliente sube a: Proyectos/temp/{tempId}/{ts}-{file}
  ↓
Cliente envía POST /api/projects { ..., tempId, files: [{url: tempUrl}] }
  ↓
Servidor crea proyecto → obtiene projectId = 1051
  ↓
Servidor mueve cada archivo:
  GET  Proyectos/temp/{tempId}/file.jpg
  PUT  Proyectos/1051/Planos/file.jpg
  DELETE Proyectos/temp/{tempId}/file.jpg
  ↓
Servidor guarda gallery items con URLs finales
  ↓
Respuesta al cliente con proyecto creado
```

### Flujo Offline → Online
```
Usuario sin internet crea proyecto
  ↓
Wizard genera tempId, guarda TODO en IndexedDB outbox:
  { type: 'PROJECT', payload: { tempId, files: [{file: File, ...}] } }
  ↓
... tiempo después, hay internet ...
  ↓
SW / GlobalSyncWorker lee outbox
  ↓
SW sube archivos a: Proyectos/temp/{tempId}/{ts}-{file}
  ↓
SW envía POST /api/projects { ..., tempId, files: [{url: tempUrl}] }
  ↓
Servidor crea proyecto → obtiene projectId
  ↓
Servidor mueve archivos a ubicación final
  ↓
SW recibe respuesta 201 → borra item de outbox
```

---

## 📝 NOTAS FINALES

1. **Los archivos antiguos en `projects/...` se quedan ahí para siempre.** No afectan en nada.
2. **Las URLs en BD no se migran.** Los registros viejos apuntan a rutas viejas (que funcionan).
3. **El `tempId` es la clave** para evitar el problema de "no saber el ID del proyecto".
4. **El cliente NUNCA sube dos veces.** El move es server-side.
5. **Si falla el move, el archivo queda en temp.** Sigue siendo accesible por su URL.
6. **No se necesita cambiar `storage-client.ts`** — solo recibe el folder como string.
7. **BunnyCDN Dashboard** se puede usar para verificar visualmente la nueva estructura.
