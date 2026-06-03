// src/lib/native-storage.ts
// SQLite nativo para Android - NO toca db.ts (Dexie sigue para iOS/browser)
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite } from '@capacitor-community/sqlite';

let db: any = null;
let useNative = false;

// ─── v380: SW BRIDGE FOR APK SYNC ────────────────────────
// El Service Worker necesita un puente para acceder a SQLite nativo
// ya que el SW no puede importar módulos directamente en el contexto Android.
// ============================================
// INIT - Llamar al arrancar la app
// ============================================
export async function init(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    useNative = false;
    return;
  }

  try {
    // Open or create database
    const ret = await CapacitorSQLite.open({
      database: 'aquatech-offline',
    } as any) as any;
    
    db = ret.db;
    useNative = true;

    // Crear las 6 tablas críticas
    await db.execute(`
      CREATE TABLE IF NOT EXISTS outbox (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        processed INTEGER DEFAULT 0,
        attempts INTEGER DEFAULT 0
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS syncLogs (
        id TEXT PRIMARY KEY,
        syncId TEXT UNIQUE NOT NULL,
        resultId TEXT,
        createdAt TEXT NOT NULL
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS projectsCache (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        lastAccessedAt TEXT NOT NULL
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS chatCache (
        id TEXT PRIMARY KEY,
        projectId INTEGER NOT NULL,
        data TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS materialsCache (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        lastAccessedAt TEXT NOT NULL
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS appointmentsCache (
        id TEXT PRIMARY KEY,
        userId INTEGER NOT NULL,
        data TEXT NOT NULL,
        date TEXT NOT NULL,
        lastAccessedAt TEXT NOT NULL
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS authCache (
        id TEXT PRIMARY KEY,
        token TEXT NOT NULL,
        userId TEXT NOT NULL,
        expires TEXT
      )
    `);

    console.log('[NativeStorage] SQLite initialized with 7 tables');

    // ─── v380: Register SW message handler ───────────────────
    // El SW envía mensajes al contexto nativo para triggerear sync
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('message', async (event: MessageEvent) => {
        if (event.data?.type === 'SW_NATIVE_SYNC_REQUEST') {
          console.log('[NativeStorage] SW sync request received');
          // Procesar items pendientes de SQLite
          const pending = await getOutboxPending();
          if (pending.length > 0) {
            // Enviar mensaje de vuelta al SW con los items
            // El SW procesará estos items (no puede aquí porque no tiene el contexto de red)
            window.postMessage({
              type: 'SW_NATIVE_SYNC_RESPONSE',
              items: pending,
              timestamp: Date.now()
            }, '*');
          }
        }
        
        // v380: Handler para marcar items como procesados en SQLite
        if (event.data?.type === 'SW_NATIVE_MARK_PROCESSED') {
          const id = event.data.id;
          if (id) {
            console.log('[NativeStorage] Marking item as processed:', id);
            await markOutboxProcessed(String(id));
          }
        }
      });
    }
  } catch (err) {
    console.warn('[NativeStorage] SQLite not available, using Dexie fallback:', err);
    useNative = false;
    db = null;
  }
}

// ============================================
// HELPERS
// ============================================
export function isNative(): boolean {
  return useNative && db !== null;
}

// ============================================
// OUTBOX - Operaciones pendientes de sync
// ============================================
export async function addToOutbox(item: {
  id: string;
  type: string;
  payload: any;
  createdAt: string;
}): Promise<void> {
  if (!isNative()) throw new Error('SQLite not initialized');
  
  await db.execute(
    'INSERT INTO outbox (id, type, payload, createdAt) VALUES (?, ?, ?, ?)',
    [item.id, item.type, JSON.stringify(item.payload), item.createdAt]
  );
}

export async function getOutboxPending(): Promise<any[]> {
  if (!isNative()) return [];
  
  const result = await db.execute(
    'SELECT * FROM outbox WHERE processed = 0 ORDER BY createdAt ASC'
  );
  
  return result.values?.map((row: any) => ({
    id: row.id,
    type: row.type,
    payload: JSON.parse(row.payload),
    createdAt: row.createdAt
  })) || [];
}

export async function markOutboxProcessed(id: string): Promise<void> {
  if (!isNative()) return;
  await db.execute('UPDATE outbox SET processed = 1 WHERE id = ?', [id]);
}

export async function removeFromOutbox(id: string): Promise<void> {
  if (!isNative()) return;
  await db.execute('DELETE FROM outbox WHERE id = ?', [id]);
}

export async function incrementRetries(id: string): Promise<void> {
  if (!isNative()) return;
  // Add retry count column if not exists
  try {
    await db.execute('ALTER TABLE outbox ADD COLUMN retries INTEGER DEFAULT 0');
  } catch (e) {
    // Column may already exist
  }
  await db.execute('UPDATE outbox SET retries = retries + 1 WHERE id = ?', [id]);
}

export async function clearProcessedOutbox(): Promise<void> {
  if (!isNative()) return;
  await db.execute('DELETE FROM outbox WHERE processed = 1');
}

// ============================================
// SYNC LOGS - Idempotencia (evita duplicados)
// ============================================
export async function addSyncLog(syncId: string, resultId: string): Promise<void> {
  if (!isNative()) return;
  
  await db.execute(
    'INSERT OR IGNORE INTO syncLogs (id, syncId, resultId, createdAt) VALUES (?, ?, ?, ?)',
    [`log_${syncId}`, syncId, resultId, new Date().toISOString()]
  );
}

export async function getSyncLog(syncId: string): Promise<string | null> {
  if (!isNative()) return null;
  
  const result = await db.execute(
    'SELECT resultId FROM syncLogs WHERE syncId = ?',
    [syncId]
  );
  
  return result.values?.[0]?.resultId || null;
}

export async function hasSyncLog(syncId: string): Promise<boolean> {
  if (!isNative()) return false;
  
  const result = await db.execute(
    'SELECT 1 FROM syncLogs WHERE syncId = ?',
    [syncId]
  );
  
  return (result.values?.length || 0) > 0;
}

// ============================================
// PROJECTS CACHE
// ============================================
export async function cacheProject(project: any): Promise<void> {
  if (!isNative()) return;
  
  await db.execute(
    'INSERT OR REPLACE INTO projectsCache (id, data, lastAccessedAt) VALUES (?, ?, ?)',
    [String(project.id), JSON.stringify(project), new Date().toISOString()]
  );
}

export async function getCachedProjects(): Promise<any[]> {
  if (!isNative()) return [];
  
  const result = await db.execute(
    'SELECT data FROM projectsCache ORDER BY lastAccessedAt DESC'
  );
  
  return result.values?.map((row: any) => JSON.parse(row.data)) || [];
}

export async function getCachedProject(id: string | number): Promise<any | null> {
  if (!isNative()) return null;
  
  const result = await db.execute(
    'SELECT data FROM projectsCache WHERE id = ?',
    [String(id)]
  );
  
  return result.values?.[0] ? JSON.parse(result.values[0].data) : null;
}

export async function clearProjectsCache(): Promise<void> {
  if (!isNative()) return;
  await db.execute('DELETE FROM projectsCache');
}

// ============================================
// CHAT CACHE
// ============================================
export async function cacheChatMessages(projectId: number, messages: any[]): Promise<void> {
  if (!isNative()) return;
  
  await db.execute(
    'INSERT OR REPLACE INTO chatCache (id, projectId, data, updatedAt) VALUES (?, ?, ?, ?)',
    [`chat_${projectId}`, projectId, JSON.stringify(messages), new Date().toISOString()]
  );
}

export async function getCachedChat(projectId: number): Promise<any[]> {
  if (!isNative()) return [];
  
  const result = await db.execute(
    'SELECT data FROM chatCache WHERE projectId = ?',
    [projectId]
  );
  
  return result.values?.[0] ? JSON.parse(result.values[0].data) : [];
}

export async function clearChatCache(): Promise<void> {
  if (!isNative()) return;
  await db.execute('DELETE FROM chatCache');
}

// ============================================
// MATERIALS CACHE
// ============================================
export async function cacheMaterials(materials: any[]): Promise<void> {
  if (!isNative()) return;
  
  await db.execute('DELETE FROM materialsCache');
  
  for (const mat of materials) {
    await db.execute(
      'INSERT INTO materialsCache (id, data, lastAccessedAt) VALUES (?, ?, ?)',
      [String(mat.id), JSON.stringify(mat), new Date().toISOString()]
    );
  }
}

export async function getCachedMaterials(): Promise<any[]> {
  if (!isNative()) return [];
  
  const result = await db.execute(
    'SELECT data FROM materialsCache ORDER BY lastAccessedAt DESC'
  );
  
  return result.values?.map((row: any) => JSON.parse(row.data)) || [];
}

export async function searchCachedMaterials(query: string): Promise<any[]> {
  if (!isNative()) return [];
  
  const result = await db.execute(
    "SELECT data FROM materialsCache WHERE data LIKE ? ORDER BY lastAccessedAt DESC",
    [`%${query}%`]
  );
  
  return result.values?.map((row: any) => JSON.parse(row.data)) || [];
}

// ============================================
// APPOINTMENTS CACHE
// ============================================
export async function cacheAppointments(userId: number, appointments: any[]): Promise<void> {
  if (!isNative()) return;
  
  // Clear old appointments for this user
  await db.execute('DELETE FROM appointmentsCache WHERE userId = ?', [userId]);
  
  for (const appt of appointments) {
    await db.execute(
      'INSERT INTO appointmentsCache (id, userId, data, date, lastAccessedAt) VALUES (?, ?, ?, ?, ?)',
      [String(appt.id), userId, JSON.stringify(appt), appt.startTime?.split('T')[0] || '', new Date().toISOString()]
    );
  }
}

export async function getCachedAppointments(userId: number, date?: string): Promise<any[]> {
  if (!isNative()) return [];
  
  let result;
  if (date) {
    result = await db.execute(
      'SELECT data FROM appointmentsCache WHERE userId = ? AND date = ? ORDER BY data ASC',
      [userId, date]
    );
  } else {
    result = await db.execute(
      'SELECT data FROM appointmentsCache WHERE userId = ? ORDER BY data ASC',
      [userId]
    );
  }
  
  return result.values?.map((row: any) => JSON.parse(row.data)) || [];
}

export async function getCachedTodayAppointments(userId: number): Promise<any[]> {
  if (!isNative()) return [];
  
  const today = new Date().toISOString().split('T')[0];
  return getCachedAppointments(userId, today);
}

// ============================================
// UTILITY
// ============================================
export async function clearAllCache(): Promise<void> {
  if (!isNative()) return;
  
  await db.execute('DELETE FROM outbox');
  await db.execute('DELETE FROM syncLogs');
  await db.execute('DELETE FROM projectsCache');
  await db.execute('DELETE FROM chatCache');
  await db.execute('DELETE FROM materialsCache');
  await db.execute('DELETE FROM appointmentsCache');
  
  console.log('[NativeStorage] All cache cleared');
}

export async function getStorageInfo(): Promise<{ used: number; tables: string[] }> {
  if (!isNative()) {
    return { used: 0, tables: [] };
  }
  
  const outboxCount = (await db.execute('SELECT COUNT(*) as c FROM outbox')).values?.[0]?.c || 0;
  const syncLogsCount = (await db.execute('SELECT COUNT(*) as c FROM syncLogs')).values?.[0]?.c || 0;
  
  return {
    used: outboxCount + syncLogsCount,
    tables: ['outbox', 'syncLogs', 'projectsCache', 'chatCache', 'materialsCache', 'appointmentsCache']
  };
}

// ============================================
// AUTH CACHE - Sesión para background sync
// ============================================
export async function saveAuthCache(session: { token: string; userId: string; expires?: string }): Promise<void> {
  if (!isNative()) return;
  
  await db.execute('DELETE FROM authCache');
  await db.execute(
    'INSERT INTO authCache (id, token, userId, expires) VALUES (?, ?, ?, ?)',
    ['session', session.token, session.userId, session.expires || '']
  );
}

export async function getAuthCache(): Promise<{ token: string; userId: string } | null> {
  if (!isNative()) return null;
  
  const result = await db.execute('SELECT token, userId FROM authCache WHERE id = ?', ['session']);
  if (!result.values?.length) return null;
  
  return {
    token: result.values[0].token,
    userId: result.values[0].userId
  };
}

export async function clearAuthCache(): Promise<void> {
  if (!isNative()) return;
  await db.execute('DELETE FROM authCache');
}