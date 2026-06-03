# 📸 Chat & Camera Handlers - Comprehensive Report

## ✅ Main Chat Component
**File:** [src/components/chat/ProjectChatUnified.tsx](src/components/chat/ProjectChatUnified.tsx)
- **Export:** `export default function ProjectChatUnified`
- **Type:** React Client Component (`'use client'`)
- **Location:** `/src/components/chat/`
- **Used in:** APK main page via ProjectExecutionClient

### Related Files:
- [src/components/ProjectExecutionClient.tsx](src/components/ProjectExecutionClient.tsx) - Main client wrapper
- [src/app/admin/operador/proyecto/[id]/page.tsx](src/app/admin/operador/proyecto/[id]/page.tsx) - APK entry point (operador view)

---

## 🎥 Camera Button Handlers in ProjectChatUnified.tsx

### 1️⃣ ATTACHMENT MENU Camera Button (Line 703)
**Status:** ❌ **BROKEN** - Does nothing on click

**File:** [src/components/chat/ProjectChatUnified.tsx#L703](src/components/chat/ProjectChatUnified.tsx#L703)

```tsx
<AttachmentItem 
  icon={<Camera size={28} />} 
  label="CÁMARA" 
  color="#d946ef" 
  onClick={() => {
    // APK: Use native camera only, never show PWA modal
    console.log('[APK] Camera button pressed');
  }} 
/>
```

**Issue:** 
- Only logs a message
- Should call `setShowCamera(true)` to open the camera modal
- Comment says "Use native camera only" but doesn't implement it

---

### 2️⃣ INPUT BAR Camera Button (Line 1076-1090)
**Status:** ✅ **WORKING** - Actually captures photos

**File:** [src/components/chat/ProjectChatUnified.tsx#L1076](src/components/chat/ProjectChatUnified.tsx#L1076)

```tsx
<button 
  onClick={async () => {
    alert('[APK] Botón de cámara presionado - CÓDIGO NUEVO');
    console.log('[APK] Botón presionado - Abriendo cámara nativa');
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      console.log('[APK] Llamando Camera.getPhoto()...');
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
      });
      console.log('[APK] Foto tomada:', photo);
      if (photo.base64String) {
        const blob = await fetch(`data:image/jpeg;base64,${photo.base64String}`).then(r => r.blob());
        setCapturedMedia({ type: 'photo', blob, url: URL.createObjectURL(blob) });
      }
    } catch (err) {
      console.error('[APK] Error cámara:', err);
      alert('[APK] Error: ' + err);
    }
  }} 
  className="btn-icon" 
  title="Cámara (Foto/Video)"
>
  <Camera />
</button>
```

**Implementation:**
- Uses Capacitor's `@capacitor/camera` plugin
- Calls `Camera.getPhoto()` with Base64 result type
- Stores result in `setCapturedMedia` state
- Works with APK (native platform)
- Shows alert messages for debugging

---

### 3️⃣ Camera Modal (Line 1274-1300)
**Status:** ✅ **AVAILABLE** - Modal UI exists but not triggered properly

**File:** [src/components/chat/ProjectChatUnified.tsx#L1274](src/components/chat/ProjectChatUnified.tsx#L1274)

```tsx
{/* --- CAMERA MODAL --- */}
{showCamera && (
  <div className="media-modal-overlay" style={{ zIndex: 1100 }}>
    <div className="media-modal-content" style={{ maxWidth: '500px', padding: '10px' }}>
      <button className="close-btn" onClick={() => setShowCamera(false)} style={{ top: '10px', right: '10px' }}>✕</button>
      <div style={{ marginTop: '20px' }}>
        <CameraCapture 
          onPhotoCapture={(blob) => {
            const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
            onSendMessage('', 'IMAGE', { file, phaseId: selectedPhaseId });
            setShowCamera(false);
          }}
          onVideoCapture={(blob) => {
            const file = new File([blob], `video_${Date.now()}.mp4`, { type: 'video/mp4' });
            onSendMessage('', 'VIDEO', { file, phaseId: selectedPhaseId });
            setShowCamera(false);
          }}
          onClose={() => setShowCamera(false)}
        />
      </div>
    </div>
  </div>
)}
```

**Features:**
- Modal overlay with close button
- Uses `CameraCapture` component ([src/components/camera/CameraCapture.tsx](src/components/camera/CameraCapture.tsx))
- Calls `onPhotoCapture` / `onVideoCapture` callbacks
- Sends media via `onSendMessage` action

---

### State Variables (Line 90)
```tsx
const [showCamera, setShowCamera] = useState(false)
```

---

## 🎬 Related Components

### CameraCapture Component
**File:** [src/components/camera/CameraCapture.tsx](src/components/camera/CameraCapture.tsx)

**Features:**
- Uses custom `useCamera` hook
- Live video preview via `<video ref={videoRef}>`
- Photo capture: `takePhotoAsync()`
- Video recording: `startRecording()` / `stopRecording()`
- Native camera fallback: `triggerNative('photo' | 'video')`
- Preview confirmation UI

**Props:**
```tsx
interface CameraCaptureProps {
  onPhotoCapture?: (blob: Blob, url: string) => void
  onVideoCapture?: (blob: Blob, url: string) => void
  onClose?: () => void
}
```

---

## 📱 Other Camera Components

### ProjectCreationWizard.tsx
**File:** [src/components/ProjectCreationWizard.tsx](src/components/ProjectCreationWizard.tsx)

**Camera Handler:** Line 1165
```tsx
onClick={() => setShowCameraCapture(true)}
```

**State:** Line 186
```tsx
const [showCameraCapture, setShowCameraCapture] = useState(false)
```

**Related:**
- Similar modal pattern to ProjectChatUnified
- Used in project creation flow (not APK main page)

---

## 🔗 APK Entry Points (Main Page)

### Primary Entry Point for APK
**File:** [src/app/admin/operador/proyecto/[id]/page.tsx](src/app/admin/operador/proyecto/[id]/page.tsx)

**Renders:**
```tsx
<ProjectExecutionClient 
  {...deepSerialize({
    project: safeProject,
    initialChat: safeChat, 
    activeRecord: safeRecord,
    expenses: safeExpenses,
    userId: userId,
    clientName: project.client?.name,
    projectAddress: project.address,
    projectCity: project.client?.city,
    availableOperators,
    panelBase: "/admin/operador"
  })}
/>
```

### Alternative Entry Points
- **Subcontratista view:** [src/app/admin/subcontratista/proyecto/[id]/page.tsx](src/app/admin/subcontratista/proyecto/[id]/page.tsx)
- **Offline shell:** [src/app/admin/operador/proyecto/offline-shell/page.tsx](src/app/admin/operador/proyecto/offline-shell/page.tsx)

---

## 📊 Component Usage Hierarchy

```
APP PAGES (Entry Points)
├── /admin/operador/proyecto/[id]
│   ├── /admin/subcontratista/proyecto/[id]
│   └── /admin/operador/proyecto/offline-shell/[id]
│
↓
ProjectExecutionClient (Main Client Component)
├── @/components/ProjectExecutionClient.tsx
│
↓
ProjectChatUnified (Chat UI)
├── @/components/chat/ProjectChatUnified.tsx
│   │
│   ├── 🎥 Attachment Menu Camera Button [Line 703] ❌ BROKEN
│   ├── 🎥 Input Bar Camera Button [Line 1076] ✅ WORKS
│   ├── 📱 Camera Modal [Line 1274] ✅ AVAILABLE
│   │   └── CameraCapture [Line 1280]
│   │       └── @/components/camera/CameraCapture.tsx
│   │
│   └── Other UI Components
│       ├── Gallery/Media Preview
│       ├── Message Input
│       ├── Expense Modal
│       └── Search/Filter UI
```

---

## 🐛 Issues Summary

| Component | Issue | Line | Status |
|-----------|-------|------|--------|
| Attachment Menu Camera | Empty onClick handler | 703 | ❌ BUG |
| Input Bar Camera | Works but uses Capacitor directly | 1076 | ✅ OK |
| Camera Modal | Not triggered by attachment button | 1274 | ⚠️ UNUSED |
| CameraCapture | Functional but not called | 1280 | ⚠️ UNUSED |

---

## 💡 Recommendations

### 1. Fix Attachment Menu Camera Button
Replace line 703 onClick:
```tsx
onClick={() => setShowCamera(true)}  // Open the modal
```

### 2. Use Consistent Pattern
Either:
- **Option A:** Use the CameraCapture modal (line 1274) for all buttons
- **Option B:** Use Capacitor directly for all (simpler, native-only)

### 3. Test on APK
The input bar button (line 1076) works, so test this flow on the actual APK build before modifying.

