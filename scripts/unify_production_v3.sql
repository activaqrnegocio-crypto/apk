-- UNIFICAR DUPLICADOS - PRODUCCIÓN
-- 1. Asignar todos los userIds a la tarea principal vía assigned_users
-- 2. Eliminar duplicados

-- GRUPO 1: Jjnbbbb (2026-05-18)
SET @keep1 = (SELECT MIN(id) FROM appointments WHERE title = 'Jjnbbbb' AND DATE(start_time) = '2026-05-18');
UPDATE appointments SET assigned_users = (
    SELECT JSON_ARRAYAGG(JSON_OBJECT('id', u.id, 'name', u.name))
    FROM (SELECT DISTINCT user_id FROM appointments WHERE title = 'Jjnbbbb' AND DATE(start_time) = '2026-05-18') du
    JOIN users u ON u.id = du.user_id
) WHERE id = @keep1;

-- GRUPO 2: Colocar bomba (2026-05-18)
SET @keep2 = (SELECT MIN(id) FROM appointments WHERE title = 'Colocar bomba' AND DATE(start_time) = '2026-05-18');
UPDATE appointments SET assigned_users = (
    SELECT JSON_ARRAYAGG(JSON_OBJECT('id', u.id, 'name', u.name))
    FROM (SELECT DISTINCT user_id FROM appointments WHERE title = 'Colocar bomba' AND DATE(start_time) = '2026-05-18') du
    JOIN users u ON u.id = du.user_id
) WHERE id = @keep2;

-- GRUPO 3: Revisión hidroneumatico (2026-05-22)
SET @keep3 = (SELECT MIN(id) FROM appointments WHERE title = 'Revisión hidroneumatico' AND DATE(start_time) = '2026-05-22');
UPDATE appointments SET assigned_users = (
    SELECT JSON_ARRAYAGG(JSON_OBJECT('id', u.id, 'name', u.name))
    FROM (SELECT DISTINCT user_id FROM appointments WHERE title = 'Revisión hidroneumatico' AND DATE(start_time) = '2026-05-22') du
    JOIN users u ON u.id = du.user_id
) WHERE id = @keep3;

-- ELIMINAR DUPLICADOS
DELETE FROM appointments WHERE id != @keep1 AND title = 'Jjnbbbb' AND DATE(start_time) = '2026-05-18';
DELETE FROM appointments WHERE id != @keep2 AND title = 'Colocar bomba' AND DATE(start_time) = '2026-05-18';
DELETE FROM appointments WHERE id != @keep3 AND title = 'Revisión hidroneumatico' AND DATE(start_time) = '2026-05-22';
