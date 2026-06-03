# Skill: PWA to APK Phase 5 - Hardware Nativo + Play Store

## Estado: ⏳ PENDIENTE

## Objetivo
Acceso a GPS/camara/filesystem nativo y publicacion en Play Store.

## Plugins a Usar
- **GPS alta precision:** `@capacitor/geolocation`
- **Camara en background:** `@capacitor/camera`
- **Filesystem:** `@capacitor/filesystem` (reemplaza base64/Cache API)

## Pasos a Seguir

### 1. Instalar Plugins
```bash
npm install @capacitor/geolocation @capacitor/camera @capacitor/filesystem
npx cap sync android
```

### 2. Configurar Permisos en AndroidManifest.xml
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

### 3. Implementar Camera Nativa
El proyecto ya tiene componentes en `src/components/`:
- `NativeCameraCapture.tsx` - Selector nativo (foto/video/audio)

### 4. Implementar GPS
```typescript
import { Geolocation } from '@capacitor/geolocation';

const position = await Geolocation.getCurrentPosition();
```

### 5. Keystore para Play Store
- Generar keystore privado
- **GUARDAR EN LUGAR SEGURO** (no en repo)
- Configurar en `android/app/build.gradle`

### 6. Publicar APK
- Build release APK
- Firmar con keystore
- Subir a Google Play Console
- Tiempo revision: 1-3 dias primera version, 1 dia actualizaciones

## Validacion Requerida
- [ ] GPS devuelve ubicacion precisa
- [ ] Camara captura foto/video/audio
- [ ] Filesystem permite guardar archivos grandes
- [ ] APK release firma correctamente
- [ ] APK visible en Play Store

## Checklist de Implementacion
- [ ] Plugins instalados
- [ ] Permisos en AndroidManifest.xml
- [ ] Logica de GPS implementada
- [ ] Logica de camara implementada
- [ ] Logica de filesystem implementada
- [ ] Keystore generado y guardado seguro
- [ ] APK release construido
- [ ] Publicacion en Play Store

## Nota Final
Esta es la fase final. Una vez completada, la APK esta lista para distribucion en Play Store.