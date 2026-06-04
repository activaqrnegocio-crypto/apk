// src/lib/storage.ts
// Capa unificada: Android usa SQLite nativo, iOS/browser usa Dexie
import { Capacitor } from '@capacitor/core'
import { db } from './db'
import * as nativeStorage from './native-storage'

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform()
}

export async function isSqliteReady(): Promise<boolean> {
  return nativeStorage.isNative()
}

export async function initStorage(): Promise<void> {
  if (isNativePlatform()) {
    await nativeStorage.init()
    console.log('[Storage] Using SQLite (Android)')
  } else {
    console.log('[Storage] Using Dexie (iOS/Browser)')
  }
}

export async function addToOutbox(item: any): Promise<void> {
  if (isNativePlatform() && await isSqliteReady()) {
    await nativeStorage.addToOutbox(item)
  } else {
    await db.outbox.add({
      type: item.type || 'UNKNOWN',
      projectId: item.projectId || 0,
      payload: item.payload || item,
      timestamp: Date.now(),
      status: 'pending'
    } as any)
  }
}

export async function getOutboxPending(): Promise<any[]> {
  if (isNativePlatform() && await isSqliteReady()) {
    return nativeStorage.getOutboxPending()
  } else {
    return db.outbox.where('status').equals('pending').toArray() as any
  }
}

export async function markOutboxProcessed(id: string): Promise<void> {
  if (isNativePlatform() && await isSqliteReady()) {
    await nativeStorage.markOutboxProcessed(id)
  } else {
    await db.outbox.update(Number(id), { status: 'synced' } as any)
  }
}

export async function removeFromOutbox(id: string): Promise<void> {
  if (isNativePlatform() && await isSqliteReady()) {
    await nativeStorage.removeFromOutbox(id)
  } else {
    await db.outbox.delete(Number(id))
  }
}

export async function incrementOutboxRetries(id: string): Promise<void> {
  if (isNativePlatform() && await isSqliteReady()) {
    await nativeStorage.incrementRetries(id)
  } else {
    const item = await db.outbox.get(Number(id))
    if (item) {
      await db.outbox.update(Number(id), { attempts: (item.attempts || 0) + 1 } as any)
    }
  }
}

export async function clearProcessedOutbox(): Promise<void> {
  if (isNativePlatform() && await isSqliteReady()) {
    await nativeStorage.clearProcessedOutbox()
  } else {
    await db.outbox.where('status').equals('synced').delete()
  }
}

export async function addSyncLog(syncId: string, resultId: string): Promise<void> {
  if (isNativePlatform() && await isSqliteReady()) {
    await nativeStorage.addSyncLog(syncId, resultId)
  }
}

export async function getSyncLog(syncId: string): Promise<string | null> {
  if (isNativePlatform() && await isSqliteReady()) {
    return nativeStorage.getSyncLog(syncId)
  }
  return null
}

export async function hasSyncLog(syncId: string): Promise<boolean> {
  if (isNativePlatform() && await isSqliteReady()) {
    return nativeStorage.hasSyncLog(syncId)
  }
  return false
}

export async function getAuthCache(): Promise<{ token: string; userId: string } | null> {
  if (isNativePlatform() && await isSqliteReady()) {
    return nativeStorage.getAuthCache()
  }
  return null
}

export async function saveAuthCache(session: { token: string; userId: string; expires?: string }): Promise<void> {
  if (isNativePlatform() && await isSqliteReady()) {
    await nativeStorage.saveAuthCache(session)
  }
}

export async function cacheProject(project: any): Promise<void> {
  if (isNativePlatform() && await isSqliteReady()) {
    await nativeStorage.cacheProject(project)
  } else {
    await db.projectsCache.put({ id: project.id, data: JSON.stringify(project), lastAccessedAt: new Date().toISOString() } as any)
  }
}

export async function getCachedProjects(): Promise<any[]> {
  if (isNativePlatform() && await isSqliteReady()) {
    return nativeStorage.getCachedProjects()
  } else {
    return db.projectsCache.toArray() as any
  }
}

export async function getCachedProject(id: string | number): Promise<any | null> {
  if (isNativePlatform() && await isSqliteReady()) {
    return nativeStorage.getCachedProject(id)
  } else {
    const result = await db.projectsCache.get(id)
    return result ? JSON.parse(result.data) : null
  }
}

export async function cacheChatMessages(projectId: number, messages: any[]): Promise<void> {
  if (isNativePlatform() && await isSqliteReady()) {
    await nativeStorage.cacheChatMessages(projectId, messages)
  } else {
    await db.chatCache.put({ id: 'chat-' + projectId, projectId, data: JSON.stringify(messages), updatedAt: new Date().toISOString() } as any)
  }
}

export async function getCachedChat(projectId: number): Promise<any[]> {
  if (isNativePlatform() && await isSqliteReady()) {
    return nativeStorage.getCachedChat(projectId)
  } else {
    const result = await db.chatCache.get('chat-' + projectId)
    return result ? JSON.parse(result.data) : []
  }
}

export async function cacheMaterials(materials: any[]): Promise<void> {
  if (isNativePlatform() && await isSqliteReady()) {
    await nativeStorage.cacheMaterials(materials)
  } else {
    await db.materialsCache.clear()
    const items = materials.map(m => ({ id: m.id, code: m.code || '', name: m.name || '', description: m.description, unit: m.unit, unitPrice: m.unitPrice || 0, category: m.category, stock: m.stock || 0, lastAccessedAt: new Date().toISOString() } as any))
    await db.materialsCache.bulkAdd(items)
  }
}

export async function getCachedMaterials(): Promise<any[]> {
  if (isNativePlatform() && await isSqliteReady()) {
    return nativeStorage.getCachedMaterials()
  } else {
    return db.materialsCache.toArray() as any
  }
}

export async function searchCachedMaterials(query: string): Promise<any[]> {
  if (isNativePlatform() && await isSqliteReady()) {
    return nativeStorage.searchCachedMaterials(query)
  } else {
    const all = await getCachedMaterials()
    const q = query.toLowerCase()
    return all.filter((m: any) => m.name?.toLowerCase().includes(q) || m.code?.toLowerCase().includes(q))
  }
}

export async function cacheAppointments(userId: number, appointments: any[]): Promise<void> {
  if (isNativePlatform() && await isSqliteReady()) {
    await nativeStorage.cacheAppointments(userId, appointments)
  } else {
    for (const apt of appointments) {
      await db.appointmentsCache.put({ id: apt.id, userId, data: JSON.stringify(apt), date: apt.date || '', lastAccessedAt: new Date().toISOString() } as any)
    }
  }
}

export async function getCachedAppointments(userId: number): Promise<any[]> {
  if (isNativePlatform() && await isSqliteReady()) {
    const all = await nativeStorage.getCachedAppointments ? await nativeStorage.getCachedAppointments(userId) : []
    return all
  } else {
    const results = await db.appointmentsCache.where('userId').equals(userId).toArray()
    return results.map(r => JSON.parse(r.data))
  }
}

export async function getStorageInfo(): Promise<{ mode: string; dbSize: number; outboxCount: number }> {
  const mode = isNativePlatform() ? 'SQLite' : 'Dexie'
  let outboxCount = 0
  try {
    if (isNativePlatform() && await isSqliteReady()) {
      outboxCount = (await nativeStorage.getOutboxPending()).length
    } else {
      outboxCount = await db.outbox.where('status').equals('pending').count()
    }
  } catch (e) { /* ignore */ }
  return { mode, dbSize: 0, outboxCount }
}