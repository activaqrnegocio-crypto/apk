# AQUATECH CRM - PROJECT DOCUMENTATION
## Deep Source Code Analysis (May 30, 2026)

> **NOTE:** This document was rewritten after reading the actual source code, not guessed from documentation. All facts come directly from the codebase.

---

## TABLE OF CONTENTS

1. Authentication System
2. RBAC (Role-Based Access Control)
3. Complete Database Schema
4. API Endpoints Reference
5. Frontend Components
6. Pages Structure
7. Hooks & Business Logic
8. Offline/Sync System
9. Push Notifications
10. WhatsApp Integration
11. Storage (BunnyCDN)
12. Server Actions

---

## 1. AUTHENTICATION SYSTEM

**File:** `src/lib/auth.ts`

### Overview
- **Provider:** NextAuth with `CredentialsProvider` (username + password)
- **Session Strategy:** JWT (not database sessions)
- **Sign-in Page:** `/admin/login`

### JWT Payload
```typescript
{
  id: string          // User ID
  role: string       // SUPERADMIN | ADMIN | ADMINISTRADORA | OPERATOR | SUBCONTRATISTA
  username: string
  sessionVersion: number  // For force logout
  permissions: string | null
}
```

### Per-Request Session Validation (Force Logout)
**Critical security feature in `authOptions.callbacks.jwt`:**

```typescript
// Check DB every 60 seconds for sessionVersion mismatch or deactivation
if (token.userId && shouldCheck) {
  const dbUser = await prisma.user.findUnique({
    where: { id: Number(token.userId) },
    select: { sessionVersion: true, isActive: true, permissions: true, role: true }
  })
  
  if (!dbUser.isActive || dbUser.sessionVersion !== token.sessionVersion) {
    return { ...token, error: 'SessionRevoked' }
  }
}
```

**Force Logout Mechanism:**
- `User.sessionVersion` increments when user is deactivated or password changed
- Every 60 seconds, JWT callback checks if `sessionVersion` in DB matches the token
- If mismatch → returns `SessionRevoked` → client receives null session → redirects to login

---

## 2. RBAC (Role-Based Access Control)

**File:** `src/lib/rbac.ts`

### Roles & Default Permissions

| Role | Permissions (Default) |
|------|----------------------|
| `SUPERADMIN` | dashboard, marketing, blog, calendario, proyectos, proyectos_admin, equipo, reportes, cotizaciones, inventario, recursos |
| `ADMIN` | All same as SUPERADMIN |
| `ADMINISTRADORA` | All same as SUPERADMIN |
| `OPERATOR` / `OPERADOR` | proyectos, cotizaciones, inventario, recursos, calendario |
| `SUBCONTRATISTA` | proyectos (only) |

### Permission Format
The `User.permissions` field can be:
- **JSON array:** `'["proyectos","cotizaciones"]'`
- **Comma-separated:** `'proyectos,cotizaciones'`
- **`null`:** Falls back to role defaults
- **`'all'`:** Superadmin shortcut, grants everything

### Helper Functions

```typescript
isAdmin(role?: string | null): boolean
// Returns true for ADMIN, ADMINISTRADORA, SUPERADMIN

isOperator(role?: string | null): boolean
// Returns true for OPERATOR, OPERADOR

isSubcontractor(role?: string | null): boolean
// Returns true for SUBCONTRATISTA

canAccessProject(user, projectTeam[], creatorId?): boolean
// Admins: true (all projects)
// Operators: true only if team includes user OR user is creator

getPermissionsArray(permissions, role): string[]
// Parses permissions string/JSON to array, falls back to role defaults

hasModuleAccess(user, moduleSlug, userRole?): boolean
// Checks if user has access to a specific module
```

### Module Access by Role

| Module | SUPERADMIN | ADMIN | ADMINISTRADORA | OPERATOR | SUBCONTRATISTA |
|--------|-----------|-------|----------------|----------|----------------|
| dashboard | ✅ | ✅ | ✅ | ❌ | ❌ |
| proyectos | ✅ | ✅ | ✅ | ✅ | ✅ |
| proyectos_admin | ✅ | ✅ | ✅ | ❌ | ❌ |
| cotizaciones | ✅ | ✅ | ✅ | ✅ | ❌ |
| inventario | ✅ | ✅ | ✅ | ✅ | ❌ |
| recursos | ✅ | ✅ | ✅ | ✅ | ❌ |
| calendario | ✅ | ✅ | ✅ | ✅ | ❌ |
| equipo | ✅ | ✅ | ✅ | ❌ | ❌ |
| reportes | ✅ | ✅ | ✅ | ❌ | ❌ |
| marketing | ✅ | ✅ | ✅ | ❌ | ❌ |
| blog | ✅ | ✅ | ✅ | ❌ | ❌ |

---

## 3. COMPLETE DATABASE SCHEMA

**File:** `prisma/schema.prisma`

### Entity Relationship Overview

```
User ─────< ProjectTeam ─────< Project
  │                               │
  ├────< Appointment              ├────< ProjectPhase ─────< PhaseCompletion
  ├────< Quote ─────< QuoteItem   ├────< ChatMessage ─────< MediaFile
  ├────< BlogPost                ├────< DayRecord
  ├────< ContentPipeline         ├────< Expense
  │   ├────< HeadlineOption      ├────< BudgetItem
  │   ├────< PipelineArticle     ├────< ProjectGalleryItem
  │   └────< SocialPost          └────< ProjectView
  ├────< PushSubscription
  └────< ChatMessage ─────< MediaFile

Client ─────< Project
         └────< Quote

Material ─────< BudgetItem
            └────< QuoteItem
```

### Complete Model List (32 tables)

| # | Table | Purpose |
|---|-------|---------|
| 1 | users | User accounts with roles and permissions |
| 2 | clients | Customer records |
| 3 | projects | Project master with status, budget, client |
| 4 | project_phases | Project phases/tasks with ordering |
| 5 | phase_completions | Tracks who completed which phase |
| 6 | project_team | User-project assignment (many-to-many) |
| 7 | expenses | Project expenses with GPS location |
| 8 | materials | Inventory catalog with pricing |
| 9 | budget_items | Project budget lines (linked to materials) |
| 10 | quotes | Sales quotes with financial breakdown |
| 11 | quote_items | Quote line items |
| 12 | day_records | Work day tracking with GPS start/end |
| 13 | chat_messages | Project messaging with media |
| 14 | media_files | Chat attachments (images, videos, docs) |
| 15 | project_views | Tracks last seen per user per project |
| 16 | project_gallery_items | Project photos organized by category |
| 17 | push_subscriptions | Web push notification subscriptions |
| 18 | blog_categories | Blog post categories |
| 19 | blog_tags | Blog post tags |
| 20 | blog_posts | Blog articles with SEO fields |
| 21 | blog_post_tags | Blog post to tag mapping |
| 22 | appointments | Calendar appointments (v500: multi-operator) |
| 23 | brand_configs | AI brand configuration for content generation |
| 24 | content_pipelines | Marketing AI content pipeline |
| 25 | headline_options | AI-generated headline options |
| 26 | pipeline_articles | AI-generated articles within pipeline |
| 27 | article_images | AI-generated images for articles |
| 28 | article_interlinks | Internal linking between articles |
| 29 | social_posts | Social media post drafts |
| 30 | social_post_variants | Platform-specific variants |
| 31 | social_post_images | Social post images |
| 32 | resources | Resource library |
| 33 | sync_logs | Idempotency tracking for offline sync |

### Key Model Definitions

#### User
```prisma
model User {
  id               Int       @id @default(autoincrement())
  name             String
  email            String?   @unique
  phone            String?
  role             UserRole  @default(OPERATOR)
  username         String    @unique
  passwordHash     String
  isActive         Boolean   @default(true)
  image            String?
  sessionVersion   Int       @default(1)  // Force logout mechanism
  displayPassword  String?
  branch           String?
  permissions      String?   // JSON or comma-separated
  lastSummarySent  DateTime?
}
```

#### Appointment (v500 Multi-Operator)
```prisma
model Appointment {
  id          Int      @id @default(autoincrement())
  title       String
  description String?
  startTime   DateTime
  endTime     DateTime
  status      String   @default("PENDIENTE")
  userId      Int      // Primary assignee (backward compat)
  projectId   Int?
  clientName  String?
  clientPhone String?
  clientLocation String?
  operatorLocation String?
  files       String?  // JSON array of attachments
  
  // v500: Multiple assigned operators
  assignedUsers String? @db.Text  // JSON: [{id, name}, ...]
  
  // Reminder flags (prevent duplicate notifications)
  reminded60  Boolean  @default(false)
  reminded30  Boolean  @default(false)
  reminded10  Boolean  @default(false)
}
```

#### ChatMessage (Message Types)
```prisma
model ChatMessage {
  id        Int           @id @default(autoincrement())
  projectId Int
  phaseId   Int?
  userId    Int
  content   String?
  type      MessageType   @default(TEXT)
  // TEXT, IMAGE, VIDEO, AUDIO, NOTE, EXPENSE_LOG
  // DAY_START, DAY_END, PHASE_COMPLETE, DOCUMENT, LOCATION
  lat       Decimal?
  lng       Decimal?
  extraData String?  // JSON for expense data, etc.
}
```

#### SyncLog (Idempotency)
```prisma
model SyncLog {
  id        Int      @id @default(autoincrement())
  syncId    String   @unique  // Idempotency key
  resultId  String  // Created entity ID
  createdAt DateTime @default(now())
}
```

### Enums

```prisma
enum UserRole { SUPERADMIN, ADMIN, ADMINISTRADORA, OPERATOR, SUBCONTRATISTA }
enum ProjectType { PISCINA, JACUZZI, BOMBAS, TRATAMIENTO, RIEGO, CALENTAMIENTO, CONTRA_INCENDIOS, MANTENIMIENTO, INSTALLATION, REPAIR, OTRO }
enum ProjectStatus { LEAD, NEGOCIANDO, ACTIVO, PENDIENTE, COMPLETADO, CANCELADO, ARCHIVADO }
enum PhaseStatus { PENDIENTE, EN_PROGRESO, COMPLETADA }
enum ExpenseCategory { MATERIAL, TRANSPORTE, MANO_OBRA, EQUIPO, ALIMENTACION, OTRO }
enum QuoteStatus { BORRADOR, ENVIADA, ACEPTADA, RECHAZADA }
enum MessageType { TEXT, IMAGE, VIDEO, AUDIO, NOTE, EXPENSE_LOG, DAY_START, DAY_END, PHASE_COMPLETE, DOCUMENT, LOCATION }
enum PipelineStatus { IDEA, HEADLINES, WRITING, REVIEWING_ARTICLES, GENERATING_IMAGES, INTERLINKING, SOCIAL_DRAFTING, SOCIAL_IMAGES, SCHEDULING, READY, PUBLISHED }
```

---

## 4. API ENDPOINTS REFERENCE

### Projects

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects` | List projects. Operators see only their team's projects. Includes unread counts via raw SQL. |
| POST | `/api/projects` | Create project with client, phases, team, budget items. Idempotency via `x-sync-id` header. |
| GET | `/api/projects/[id]` | Get single project with all relations |
| PATCH | `/api/projects/[id]` | Update project. Auto-accepts quotes when status→ACTIVO. |
| DELETE | `/api/projects/[id]` | Delete project, unlink quotes, cleanup orphaned clients. |
| PUT | `/api/projects/[id]/team` | Replace team. Notifies newly added via push+WA. |
| POST | `/api/projects/[id]/phases` | Create phase (admin only). |
| GET/POST | `/api/projects/[id]/messages` | Get/send chat messages. Handles media upload to Bunny. |

### Users

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users` | List users. Hides SUPERADMIN from non-superadmins. |
| POST | `/api/users` | Create user (SUPERADMIN only). |
| GET/PUT | `/api/users/[id]` | Get/update user. |
| PUT | `/api/users/[id]/avatar` | Update avatar. |

### Clients

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/clients?q=` | Search by name/email/phone. Cached 30s. |

### Quotes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/quotes` | List quotes. Operators see only their own. |
| POST | `/api/quotes` | Create quote with items. Optional PDF to project chat. |

### Materials

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/materials?q=` | Search by name/code/category. Cached 60s. |
| POST | `/api/materials` | Create material. |
| GET/PUT/DELETE | `/api/materials/[id]` | CRUD operations. |

### Appointments

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/appointments?userId=&start=&end=` | List with date range. v500 supports `assignedUsers` JSON. |
| POST | `/api/appointments` | Create with multiple operators. WA notifications. Idempotency via in-memory Map. |

### Day Records

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/day-records` | Start day. Creates record + DAY_START chat message + push. |
| PUT | `/api/day-records` | End day. Updates record + DAY_END chat message + push. |

### Push Notifications

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/push/subscribe` | Subscribe to push. |
| POST | `/api/push/wake-up` | Send silent push to wake SW. |

### Notifications

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications/summary` | Get unread counts per project. Efficient raw SQL. |
| POST | `/api/notifications/summary` | Mark project as seen. |

### WhatsApp

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/whatsapp/send` | Send WA message via Evolution API. |
| GET | `/api/whatsapp/status` | Get instance status. |

### Cron

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cron/notifications` | Send appointment reminders (60/30/10 min). |
| GET | `/api/cron/cleanup-temp` | Cleanup temp files. |

### Blog

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/blog` | Get categories. |
| POST | `/api/blog` | Create post with tags. |

### Resources

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/resources` | List resources. |
| POST | `/api/resources` | Create (SUPERADMIN only). |

### Upload

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload` | Upload to BunnyCDN. |
| POST | `/api/upload/chunk` | Chunked upload for large files. |

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check. |
| GET | `/api/serve-sw` | Serve service worker. |

---

## 5. FRONTEND COMPONENTS

### ProjectCreationWizard (`src/components/ProjectCreationWizard.tsx`)
Multi-step wizard for creating projects with offline support.

**Steps:**
1. Project Data - Title, type, address, dates, categories, specs
2. Client - Search existing or create new
3. Phases - Project phases with estimated days
4. Team - Assign operators (auto-adds current operator)
5. Budget - Materials from catalog or custom items
6. Files - Upload with progress

**Features:**
- Auto-saves drafts to localStorage + Dexie
- GPS location capture
- Material search from inventory
- Offline-capable with outbox queue
- Base64 for small files, Cache API for large files

### BudgetBuilder (`src/components/BudgetBuilder.tsx`)
Material quoting with tax calculations.

**Features:**
- Material search from catalog
- Custom description/price items (GLOBAL)
- Tax: subtotal0, subtotal15, IVA 15%, grand total
- Per-line discounts
- Real-time calculations

### useProjectActions (`src/hooks/useProjectActions.ts`)
Centralizes mutation logic with optimistic UI.

```typescript
// handleSaveProject - Updates project metadata (online/offline aware)
// handleSaveTeam - Updates team with optimistic UI + background sync
```

---

## 6. PAGES STRUCTURE

### Admin Pages

| Path | Description |
|------|-------------|
| `/admin` | Admin dashboard |
| `/admin/proyectos` | Project list (ADMIN/ADMINISTRADORA/SUPERADMIN) |
| `/admin/proyectos/nuevo` | Create project wizard |
| `/admin/proyectos/[id]` | Project detail |
| `/admin/operador` | Operator dashboard |
| `/admin/operador/proyecto/[id]` | Operator project view |
| `/admin/calendario` | Calendar (all roles with permission) |
| `/admin/cotizaciones` | Quote list |
| `/admin/inventario` | Materials inventory |
| `/admin/team` | Team management |
| `/admin/blog` | Blog management |
| `/admin/subcontratista` | Subcontractor dashboard |
| `/admin/login` | Login |

---

## 7. OFFLINE/SYNC SYSTEM

### Dexie Database (`src/lib/db.ts`)

**Tables:**
- `outbox` - Pending operations queue
- `auth` - Auth cache for offline login
- `authShadow` - SW fallback auth
- `materialsCache` - Materials catalog
- `clientsCache` - Clients
- `quotesCache` - Quotes
- `projectsCache` - Projects with `lastAccessedAt`
- `appointmentsCache` - Appointments (indexed by `userId`)
- `chatCache` - Chat by `projectId`
- `dashboardCache` - Dashboard data
- `cacheMetadata` - Sync metadata
- `usersCache` - User list
- `syncLogs` - Sync operation logs
- `drafts` - File drafts (IndexedDB structured clone)

### Service Worker (`public/custom-sw.js`)

**Version:** `v377-bunny-storage-reorg`

**Caches:**
- Static: `aquatech-static-{version}`
- Pages: `aquatech-pages-{version}`
- Assets: `aquatech-assets-{version}`
- Fonts: `aquatech-fonts-{version}`
- RSC: `aquatech-rsc-{version}`

**Key Features:**
- **15-second aggressive poller** for outbox processing
- Poller defers to GlobalSyncWorker when page is visible (prevents race condition)
- Pre-caches critical shells: `/admin/proyectos/offline-shell`, `/admin/operador/proyecto/offline-shell`
- **Online event triggers immediate outbox processing**
- File upload timeouts: <1MB:60s, <10MB:120s, <50MB:300s, <100MB:600s, 200MB+:1200s

### File Storage Strategy (`src/lib/offline-utils.ts`)

```typescript
// Files <10MB: base64 in IndexedDB (fast, uses RAM)
// Files 10MB-600MB: Cache API (streams to disk, zero RAM)
// Files >600MB: REJECTED with error
```

### Outbox Item Types
```
MESSAGE, EXPENSE, EXPENSE_DELETE, DAY_START, DAY_END
PHASE_COMPLETE, PHASE_UPDATE, PHASE_CREATE
TEAM_UPDATE, MEDIA_UPLOAD, GALLERY_UPLOAD, GALLERY_DELETE, GALLERY_RENAME
QUOTE, MATERIAL, PROJECT, PROJECT_UPDATE, PROJECT_DELETE
TASK, TASK_STATUS_TOGGLE, LOCATION
```

---

## 8. PUSH NOTIFICATIONS

**File:** `src/lib/push.ts`

### Functions
- `sendPushToUser(userId, payload)` - Send to all user devices. Auto-cleanup expired subscriptions (410 Gone).
- `sendPushToProjectTeam(projectId, excludeUserId, payload)` - Send to team + admins.
- `notifyUser()` / `notifyProjectTeam()` / `notifyAdmins()` - Fire-and-forget convenience wrappers.
- `sendSilentPush(userId)` - Silent push to wake SW without showing notification.

### VAPID Configuration
```typescript
// Requires: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
webpush.setVapidDetails(subject, publicKey, privateKey)
```

---

## 9. WHATSAPP INTEGRATION

**File:** `src/lib/whatsapp.ts`

**API:** Evolution API

### Functions
- `sendWhatsAppMessage(phone, message, attachments?)` - Send text + media

### Features
- Text via `/message/sendText/{instance}`
- Media via `/message/sendMedia/{instance}`
- All audios sent as `document` type (for PTT compatibility)
- Auto-clean phone number (digits only)
- 500ms delay between multiple attachments

---

## 10. STORAGE (BunnyCDN)

**File:** `src/lib/bunny.ts`

### Functions
- `uploadToBunny(file, filename, folder)` - Upload via PUT
- `deleteFromBunny(fileUrl)` - Delete by URL
- `deleteBunnyFileByPath(storagePath)` - Delete by path
- `listBunnyDirectory(storagePath)` - List directory contents
- `deleteBunnyDirectory(storagePath)` - Recursive delete

### MIME Type Inference
Automatic from file extension for proper video streaming.

---

## 11. SERVER ACTIONS

**File:** `src/actions/marketing.ts`

### Functions
- `createContentPipelineAction(idea, ideaContext)` - Creates pipeline, calls GROQ for headlines
- `selectHeadlineAction(pipelineId, headlineId)` - Selects H1, generates pillar article via GROQ

### GROQ Integration
- Model: `llama-3.3-70b-versatile`
- Used for generating SEO headlines and article content
- Fallback content if no API key configured

---

## 12. KEY BUSINESS LOGIC

### Force Logout
1. User deactivated or password changed → `sessionVersion` increments
2. Next JWT validation (within 60s) detects mismatch
3. Returns `SessionRevoked` → client redirects to login

### Idempotency Pattern
1. Client generates `syncId` (e.g., `sync_{timestamp}_{random}`)
2. Sends in `x-sync-id` header
3. Server uses `SyncLog` table for atomic claim
4. If syncId exists → return existing result
5. Stalled claims (>2min) can be hijacked

### Project Access Control
- **Admins:** All projects
- **Operators:** Only `team.userId = self OR createdBy = self`
- **Subcontratistas:** Only `proyectos` module

### Appointment v500
- `assignedUsers` JSON field stores `[{id, name}, ...]`
- Legacy `userId` stores first assignee (backward compat)
- Calendar query checks both `userId` AND `assignedUsers` JSON

### Quote Financial Breakdown
```
subtotal0 = sum of non-taxed items
subtotal15 = sum of taxed items
ivaAmount = subtotal15 * 0.15
discountTotal = sum of all discounts
totalAmount = subtotal0 + subtotal15 + ivaAmount - discountTotal
```

---

## Quick Reference

### Environment Variables (Key)
```
DATABASE_URL=mysql://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
BUNNY_STORAGE_ZONE=...
BUNNY_STORAGE_API_KEY=...
BUNNY_PULLZONE_URL=...
GROQ_API_KEY=...
EVOLUTION_API_URL=...
EVOLUTION_API_KEY=...
EVOLUTION_INSTANCE_NAME=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

### Tech Stack
- **Framework:** Next.js (App Router)
- **Auth:** NextAuth with JWT
- **Database:** MySQL via Prisma
- **Offline:** Dexie (IndexedDB) + Service Worker
- **Storage:** BunnyCDN
- **Push:** Web Push (VAPID)
- **WhatsApp:** Evolution API
- **AI:** GROQ (Llama 3.3)
