# Fix Push Notifications PWA - 4 Junio 2026

## Problema
Error 500 al activar push notifications en PWA:
```
The column `type` does not exist in the current database.
code: 'P2022'
Invalid `prisma.pushSubscription.upsert()`
```

## Causa
- El código usaba `upsert` con el campo `type` en la tabla `push_subscriptions`
- La columna `type` no existía en la base de datos MySQL en stackcp

## Solución

### 1. Código: `src/app/api/push/subscribe/route.ts`

**ANTES (fallaba):**
```typescript
const pushSub = await prisma.pushSubscription.upsert({
  where: { userId_endpoint: { userId, endpoint: subscription.endpoint } },
  update: { p256dh, auth, deviceName },
  create: { userId, type: 'vapid', endpoint, p256dh, auth, deviceName }
})
```

**AHORA (funciona):**
```typescript
// Buscar si ya existe
const existing = await prisma.pushSubscription.findFirst({
  where: { userId, endpoint: subscription.endpoint }
})

if (existing) {
  // Actualizar registro existente
  await prisma.pushSubscription.update({
    where: { id: existing.id },
    data: { p256dh, auth, deviceName }
  })
} else {
  // Crear nuevo registro (sin campo 'type')
  await prisma.pushSubscription.create({
    data: { userId, endpoint, p256dh, auth, deviceName }
  })
}
```

Este patrón **findFirst + create/update** funciona tanto si la columna `type` existe como si no.

### 2. Base de Datos

Se ejecutó SQL via `prisma db execute` para agregar la columna:

```sql
ALTER TABLE push_subscriptions ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'vapid' AFTER user_id;
```

## Resultado
- ✅ Push notifications PWA ahora funcionan sin error 500
- ✅ El campo `type` distingue entre 'vapid' (PWA/iOS) y 'fcm' (Android nativo)
- ✅ Compatibilidad hacia atrás: código funciona con o sin columna `type`

## Archivos Modificados
- `src/app/api/push/subscribe/route.ts` - Patrón findFirst + create/update

## Base de Datos Afectada
- Tabla: `push_subscriptions`
- Columna agregada: `type` (VARCHAR 20, DEFAULT 'vapid')

## Próximos Pasos (opcional)
Sincronizar todas las tablas faltantes del schema.prisma:
```bash
npx prisma db push
```

Tablas que faltan en BD actual:
- blog_categories
- blog_tags  
- blog_posts
- blog_post_tags
- content_pipelines
- headline_options
- pipeline_articles
- social_posts