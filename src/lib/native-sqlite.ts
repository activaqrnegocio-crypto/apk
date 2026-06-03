/**
 * v380: Native SQLite bridge for APK
 * 
 * This module provides functions to interact with SQLite native storage
 * for the outbox queue in APK. In PWA, we use IndexedDB (Dexie).
 * 
 * Usage:
 *   if (Capacitor.isNativePlatform()) {
 *     // Use nativeAddToOutbox, nativeGetPending, etc.
 *   } else {
 *     // Use Dexie (db.outbox) as usual
 *   }
 */

// Check if we're in native platform
function isNativePlatform(): boolean {
  try {
    return typeof window !== 'undefined' && 
           !!(window as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/**
 * Add an item to the native SQLite outbox
 */
export async function nativeAddToOutbox(item: {
  id?: number;
  type: string;
  payload: any;
  status?: string;
  createdAt?: string;
  attempts?: number;
}): Promise<boolean> {
  if (!isNativePlatform()) {
    console.log('[NativeSQLite] Not native platform, skipping');
    return false;
  }

  try {
    const { CapacitorSQLite } = await import('@capacitor-community/sqlite');
    
    const id = item.id || Date.now();
    const type = item.type;
    const payload = JSON.stringify(item.payload);
    const status = item.status || 'pending';
    const createdAt = item.createdAt || new Date().toISOString();
    const attempts = item.attempts || 0;

    await CapacitorSQLite.execute({
      statements: `INSERT OR REPLACE INTO outbox (id, type, payload, status, createdAt, attempts) VALUES ('${id}', '${type}', '${payload}', '${status}', '${createdAt}', ${attempts})`
    });

    console.log('[NativeSQLite] Added to outbox:', id, type);
    return true;
  } catch (e) {
    console.error('[NativeSQLite] Error adding to outbox:', e);
    return false;
  }
}

/**
 * Get all pending items from the native SQLite outbox
 */
export async function nativeGetPending(): Promise<Array<{
  id: number;
  type: string;
  payload: any;
  status: string;
  createdAt: string;
  attempts: number;
}>> {
  if (!isNativePlatform()) {
    return [];
  }

  try {
    const { CapacitorSQLite } = await import('@capacitor-community/sqlite');
    
    const result = await CapacitorSQLite.query({
      statement: 'SELECT * FROM outbox WHERE status = ? ORDER BY createdAt ASC',
      values: ['pending']
    });

    if (result.values && result.values.length > 0) {
      return result.values.map((row: any) => ({
        id: row.id,
        type: row.type,
        payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
        status: row.status,
        createdAt: row.createdAt,
        attempts: row.attempts || 0
      }));
    }
    return [];
  } catch (e) {
    console.error('[NativeSQLite] Error getting pending:', e);
    return [];
  }
}

/**
 * Mark an item as processed (synced) in native SQLite
 */
export async function nativeMarkProcessed(id: number): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    const { CapacitorSQLite } = await import('@capacitor-community/sqlite');
    
    await CapacitorSQLite.execute({
      statements: `UPDATE outbox SET status = 'synced' WHERE id = ${id}`
    });

    console.log('[NativeSQLite] Marked as processed:', id);
  } catch (e) {
    console.error('[NativeSQLite] Error marking processed:', e);
  }
}

/**
 * Delete an item from native SQLite outbox
 */
export async function nativeDeleteFromOutbox(id: number): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    const { CapacitorSQLite } = await import('@capacitor-community/sqlite');
    
    await CapacitorSQLite.execute({
      statements: `DELETE FROM outbox WHERE id = ${id}`
    });

    console.log('[NativeSQLite] Deleted from outbox:', id);
  } catch (e) {
    console.error('[NativeSQLite] Error deleting:', e);
  }
}

/**
 * Get count of pending items in native SQLite outbox
 */
export async function nativeGetPendingCount(): Promise<number> {
  if (!isNativePlatform()) return 0;

  try {
    const { CapacitorSQLite } = await import('@capacitor-community/sqlite');
    
    const result = await CapacitorSQLite.query({
      statement: 'SELECT COUNT(*) as count FROM outbox WHERE status = ?',
      values: ['pending']
    });

    if (result.values && result.values.length > 0) {
      return result.values[0].count || 0;
    }
    return 0;
  } catch (e) {
    console.error('[NativeSQLite] Error getting count:', e);
    return 0;
  }
}

/**
 * Update attempts count for an item
 */
export async function nativeUpdateAttempts(id: number, attempts: number): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    const { CapacitorSQLite } = await import('@capacitor-community/sqlite');
    
    await CapacitorSQLite.execute({
      statements: `UPDATE outbox SET attempts = ${attempts} WHERE id = ${id}`
    });
  } catch (e) {
    console.error('[NativeSQLite] Error updating attempts:', e);
  }
}

/**
 * Create the outbox table if it doesn't exist
 * Call this on app startup to ensure table exists
 */
export async function nativeInitOutbox(): Promise<boolean> {
  if (!isNativePlatform()) return false;

  try {
    const { CapacitorSQLite } = await import('@capacitor-community/sqlite');
    
    // Create table if not exists
    await CapacitorSQLite.execute({
      statements: `CREATE TABLE IF NOT EXISTS outbox (
        id INTEGER PRIMARY KEY,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        createdAt TEXT NOT NULL,
        attempts INTEGER DEFAULT 0
      )`
    });

    console.log('[NativeSQLite] Outbox table initialized');
    return true;
  } catch (e) {
    console.error('[NativeSQLite] Error initializing outbox:', e);
    return false;
  }
}