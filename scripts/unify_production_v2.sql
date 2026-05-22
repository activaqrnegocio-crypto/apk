-- Unificar tareas duplicadas en appointments
-- 1. Para cada grupo duplicado, actualizar la primer cita con los user_ids
-- 2. Eliminar las duplicadas

SET @sql_text = '';

-- Obtener los keep_id de cada grupo
SELECT GROUP_CONCAT(
    CONCAT(
        'UPDATE appointments SET assigned_users = ''',
        (SELECT GROUP_CONCAT(DISTINCT u.name ORDER BY u.id SEPARATOR '","')
         FROM appointments a2
         JOIN users u ON u.id = a2.user_id
         WHERE a2.title = a.title 
           AND DATE(a2.start_time) = DATE(a.start_time) 
           AND IFNULL(a2.project_id,0) = IFNULL(a.project_id,0)),
        ''' WHERE id = ',
        (SELECT MIN(a3.id) FROM appointments a3 
         WHERE a3.title = a.title 
           AND DATE(a3.start_time) = DATE(a.start_time) 
           AND IFNULL(a3.project_id,0) = IFNULL(a.project_id,0)),
        ';'
    )
    SEPARATOR ' '
)
INTO @sql_text
FROM appointments a
GROUP BY a.title, DATE(a.start_time), a.project_id
HAVING COUNT(*) > 1;

-- No podemos hacerlo fácil con SQL puro porque assigned_users es JSON.
-- Mejor: actualizar la cita #304 con todos los usuarios de ese grupo
-- y eliminar las demás del mismo grupo.

-- === GRUPO 1: "Jjnbbbb" 2026-05-18 ===
-- Conservar la más antigua (id menor), poner todos los userIds
UPDATE appointments SET assigned_users = (
    SELECT JSON_ARRAYAGG(JSON_OBJECT('id', u.id, 'name', u.name))
    FROM (SELECT DISTINCT a2.user_id FROM appointments a2 WHERE a2.title = 'Jjnbbbb' AND DATE(a2.start_time) = '2026-05-18') du
    JOIN users u ON u.id = du.user_id
)
WHERE id = (SELECT MIN(id) FROM appointments WHERE title = 'Jjnbbbb' AND DATE(start_time) = '2026-05-18');

-- === GRUPO 2: "Colocar bomba" 2026-05-18 ===
UPDATE appointments SET assigned_users = (
    SELECT JSON_ARRAYAGG(JSON_OBJECT('id', u.id, 'name', u.name))
    FROM (SELECT DISTINCT a2.user_id FROM appointments a2 WHERE a2.title = 'Colocar bomba' AND DATE(a2.start_time) = '2026-05-18') du
    JOIN users u ON u.id = du.user_id
)
WHERE id = (SELECT MIN(id) FROM appointments WHERE title = 'Colocar bomba' AND DATE(start_time) = '2026-05-18');

-- === GRUPO 3: "Revisión hidroneumatico" 2026-05-22 ===
UPDATE appointments SET assigned_users = (
    SELECT JSON_ARRAYAGG(JSON_OBJECT('id', u.id, 'name', u.name))
    FROM (SELECT DISTINCT a2.user_id FROM appointments a2 WHERE a2.title = 'Revisión hidroneumatico' AND DATE(a2.start_time) = '2026-05-22') du
    JOIN users u ON u.id = du.user_id
)
WHERE id = (SELECT MIN(id) FROM appointments WHERE title = 'Revisión hidroneumatico' AND DATE(start_time) = '2026-05-22');

-- Eliminar duplicados (conservar solo el id menor de cada grupo)
DELETE FROM appointments 
WHERE (title, DATE(start_time)) IN (
    SELECT title, fecha FROM (
        SELECT title, DATE(start_time) as fecha, COUNT(*) as cant
        FROM appointments
        GROUP BY title, DATE(start_time)
        HAVING cant > 1
    ) sub
)
AND id NOT IN (
    SELECT keep_id FROM (
        SELECT MIN(id) as keep_id FROM appointments
        GROUP BY title, DATE(start_time)
        HAVING COUNT(*) > 1
    ) sub2
);
