# 🗄️ Base de Datos Producción - VPS Contabo

## 🔐 Conexión

| Campo | Valor |
|-------|-------|
| Host | `localhost` (solo accesible desde el VPS) |
| Puerto | `3306` |
| Usuario | `aquatech` |
| BD | `aquatech` |

> La BD **NO** es accesible desde fuera del VPS. Solo se conecta la app dentro del contenedor Docker.

## 🐳 Acceso a la BD

### Desde el VPS (no dentro del contenedor):
```bash
mysql -u aquatech -p aquatech
```

### Desde el contenedor Docker:
```bash
docker exec -it aquatech-crm-v2 sh
# Dentro del contenedor NO hay mysql CLI.
# Usar Prisma o conectar desde el host del VPS.
```

## ⚠️ Problema Conocido: Columna `assigned_users`

### Síntoma
Al crear/editar una tarea con múltiples operadores, el backend lanza error 500.

### Causa
El campo `assigned_users` está definido en `prisma/schema.prisma` pero **no existía en la BD real** (producción ni desarrollo local).

### Solución
```sql
ALTER TABLE appointments ADD COLUMN assigned_users TEXT NULL;
```

### Verificar si existe
```sql
SHOW COLUMNS FROM appointments LIKE 'assigned_users';
-- Si no devuelve nada, hay que agregarla.
```

## 🧹 Problema Conocido: Tareas Duplicadas

### Síntoma
En el calendario aparecen muchas tareas con el mismo título y hora.

### Causa
Antes de que existiera `assigned_users`, al crear una tarea para N operadores se creaban N tareas separadas (una por cada operador).

### Solución (ejecutar 1 vez)
```sql
-- Para cada grupo de duplicados, unificar en 1 tarea con assigned_users:
SET @keep = (SELECT MIN(id) FROM appointments WHERE title = 'TITULO' AND DATE(start_time) = 'YYYY-MM-DD');
UPDATE appointments SET assigned_users = (
    SELECT JSON_ARRAYAGG(JSON_OBJECT('id', u.id, 'name', u.name))
    FROM (SELECT DISTINCT user_id FROM appointments WHERE title = 'TITULO' AND DATE(start_time) = 'YYYY-MM-DD') du
    JOIN users u ON u.id = du.user_id
) WHERE id = @keep;
DELETE FROM appointments WHERE id != @keep AND title = 'TITULO' AND DATE(start_time) = 'YYYY-MM-DD';
```

## 🔄 Notificaciones WhatsApp y Push

No se ven afectadas por estos cambios. El código ya envía notificaciones a **todos** los operadores en `assignedUsers` en un bucle.

## 📝 Nota

Siempre que se agregue un campo nuevo en `prisma/schema.prisma` con `@map()`, verificar que la columna exista en **ambas** BD (local y producción) antes de hacer deploy.
