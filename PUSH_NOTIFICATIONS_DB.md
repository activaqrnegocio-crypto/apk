# Push Notifications - Database Schema Documentation

**Fecha:** 2026-06-04

## Resumen

Se agregaron columnas a la tabla `push_subscriptions` para soportar tanto notificaciones PWA (VAPID) como nativas Android (FCM).

## Cambios en la Base de Datos

### Tabla: `push_subscriptions`

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `type` | VARCHAR(20) | 'vapid' | Tipo de suscripción: 'vapid' (PWA/Web) o 'fcm' (Android) |
| `fcm_token` | VARCHAR(500) | NULL | Token de Firebase Cloud Messaging (solo para Android) |

### Índices Creados
- `push_subscriptions_type_idx` en columna `type`

### Unique Constraints
- `[userId, endpoint]` - Para suscripciones VAPID (PWA)
- `[userId, fcmToken]` - Para suscripciones FCM (Android)

## Scripts SQL Ejecutados

```sql
-- Migration: 20260604_add_type_to_push_subscription
ALTER TABLE `push_subscriptions` 
ADD COLUMN `type` VARCHAR(20) NOT NULL DEFAULT 'vapid' AFTER `user_id`;

CREATE INDEX `push_subscriptions_type_idx` ON `push_subscriptions`(`type`);
```

```sql
-- fix_push_columns.sql (ejecutado manualmente)
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'vapid' AFTER user_id;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS fcm_token VARCHAR(500) AFTER auth;
```

## Schema Prisma

```prisma
model PushSubscription {
  id         Int      @id @default(autoincrement())
  userId     Int      @map("user_id")
  type       String   @default("vapid") // "vapid" or "fcm"
  endpoint   String?  @db.VarChar(500)  // Only for VAPID
  p256dh     String?  @db.VarChar(200)  // Only for VAPID
  auth       String?  @db.VarChar(100)  // Only for VAPID
  fcmToken   String?  @map("fcm_token") @db.VarChar(500) // Only for FCM
  deviceName String?  @map("device_name") @db.VarChar(100)
  createdAt  DateTime @default(now()) @map("created_at")
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, endpoint])
  @@unique([userId, fcmToken])
  @@index([userId])
  @@index([type])
  @@map("push_subscriptions")
}
```

## Lógica de Negocio

### PWA (VAPID)
- Endpoint, p256dh, auth son requeridos
- type = 'vapid'

### Android (FCM)
- Solo fcm_token es requerido
- type = 'fcm'

## API Route

`POST /api/push/subscribe` maneja ambos tipos:
- Si `type === 'fcm'` y `subscription.token` existe → usa FCM
- De lo contrario → usa VAPID