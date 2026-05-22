-- Script para unificar tareas duplicadas en producción
-- Se ejecuta: mysql -u aquatech -p aquatech < unify_production.sql

-- 1. "Jjnbbbb" - 2026-05-18 - 10 copias
-- Conservar la de menor ID (primera creada), unificar operadores
SET @target_title_1 = 'Jjnbbbb';
SET @target_date_1 = '2026-05-18 00:00:00';

-- Obtener todos los user_id únicos de estas tareas
SELECT GROUP_CONCAT(DISTINCT user_id) INTO @user_ids_1 FROM appointments 
WHERE title = @target_title_1 AND DATE(start_time) = DATE(@target_date_1);

-- Armar JSON de assignedUsers
SET @assigned_1 = (SELECT CONCAT('[', GROUP_CONCAT(
  JSON_OBJECT('id', u.id, 'name', COALESCE(u.name, 'Operador'))
), ']') FROM (SELECT DISTINCT user_id AS id FROM appointments 
WHERE title = @target_title_1 AND DATE(start_time) = DATE(@target_date_1)) au
JOIN users u ON u.id = au.id);

-- Actualizar la que se conserva (la de menor ID)
UPDATE appointments SET assigned_users = @assigned_1
WHERE id = (SELECT MIN(id) FROM appointments 
WHERE title = @target_title_1 AND DATE(start_time) = DATE(@target_date_1));

-- Eliminar las duplicadas
DELETE FROM appointments WHERE title = @target_title_1 
AND DATE(start_time) = DATE(@target_date_1)
AND id != (SELECT MIN(id) FROM appointments 
WHERE title = @target_title_1 AND DATE(start_time) = DATE(@target_date_1));

SELECT '1. Jjnbbbb - OK' as resultado;

-- 2. "Colocar bomba" - 2026-05-18 - 2 copias
SET @target_title_2 = 'Colocar bomba';
SET @target_date_2 = '2026-05-18 00:00:00';

SET @assigned_2 = (SELECT CONCAT('[', GROUP_CONCAT(
  JSON_OBJECT('id', u.id, 'name', COALESCE(u.name, 'Operador'))
), ']') FROM (SELECT DISTINCT user_id AS id FROM appointments 
WHERE title = @target_title_2 AND DATE(start_time) = DATE(@target_date_2)) au
JOIN users u ON u.id = au.id);

UPDATE appointments SET assigned_users = @assigned_2
WHERE id = (SELECT MIN(id) FROM appointments 
WHERE title = @target_title_2 AND DATE(start_time) = DATE(@target_date_2));

DELETE FROM appointments WHERE title = @target_title_2 
AND DATE(start_time) = DATE(@target_date_2)
AND id != (SELECT MIN(id) FROM appointments 
WHERE title = @target_title_2 AND DATE(start_time) = DATE(@target_date_2));

SELECT '2. Colocar bomba - OK' as resultado;

-- 3. "Revisión hidroneumatico" - 2026-05-22 - 22 copias
SET @target_title_3 = 'Revisión hidroneumatico';
SET @target_date_3 = '2026-05-22 00:00:00';

SET @assigned_3 = (SELECT CONCAT('[', GROUP_CONCAT(
  JSON_OBJECT('id', u.id, 'name', COALESCE(u.name, 'Operador'))
), ']') FROM (SELECT DISTINCT user_id AS id FROM appointments 
WHERE title = @target_title_3 AND DATE(start_time) = DATE(@target_date_3)) au
JOIN users u ON u.id = au.id);

UPDATE appointments SET assigned_users = @assigned_3
WHERE id = (SELECT MIN(id) FROM appointments 
WHERE title = @target_title_3 AND DATE(start_time) = DATE(@target_date_3));

DELETE FROM appointments WHERE title = @target_title_3 
AND DATE(start_time) = DATE(@target_date_3)
AND id != (SELECT MIN(id) FROM appointments 
WHERE title = @target_title_3 AND DATE(start_time) = DATE(@target_date_3));

SELECT '3. Revision hidroneumatico - OK' as resultado;

-- Verificar resultado final
SELECT title, DATE(start_time) as fecha, COUNT(*) as cant 
FROM appointments 
GROUP BY title, DATE(start_time) 
HAVING cant > 1;

SELECT COUNT(*) as total_final FROM appointments;
