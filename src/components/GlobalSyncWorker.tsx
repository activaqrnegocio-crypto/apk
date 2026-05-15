'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/db'

// ─── v333: Centralized logging to IndexedDB (visible in /admin/debug/sync) ───
async function logSync(level: 'info' | 'warn' | 'error' | 'success', message: string, type = 'system', details?: string) {
  try {
    const count = await db.syncLogs.count();
    if (count > 250) {
      const oldest = await db.syncLogs.orderBy('timestamp').first();
      if (oldest?.id) await db.syncLogs.delete(oldest.id);
    }
    await db.syncLogs.add({
      timestamp: Date.now(),
      level,
      message,
      type,
      details: details || ''
    });
  } catch (e) {
    // Silent — don't break sync if logging fails
  }
}

// v261: Global throttle to prevent sync loops on component remounts (caused by router.refresh)
let lastSyncExecution = 0;
// v291: Separate throttle for heavy bulk sync to prevent constant re-triggering
let lastBulkSyncAttempt = 0;

/**
 * v400: Exported helper to trigger outbox sync from anywhere
 */
export function triggerBackgroundSync() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('trigger-outbox-sync'));
  }
}

export default function GlobalSyncWorker() {
  const { data: session } = useSession()
  const router = useRouter()
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<any>(null);
  const syncLock = useRef(false)
  const outboxLock = useRef(false) // v272: Separate lock — outbox sync must NEVER be blocked by bulk sync
  
  // v261: PWA Visibility Fallback (Critical for iOS/Safari)
  // When app returns to foreground, proactively wake up the Service Worker sync
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        // console.log('[Sync] App returned to focus. Triggering background sync fallback...');
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(reg => {
            if ('sync' in reg) {
              // Consolidate to one registration to avoid duplicate SW wakeups
              // v273: Register specific tags as well for better reliability
              const sync = (reg as any).sync;
              sync.register('sync-outbox').catch(() => {});
              sync.register('sync-MESSAGE').catch(() => {});
              sync.register('sync-EXPENSE').catch(() => {});
              sync.register('sync-TASK').catch(() => {});
              sync.register('sync-PROJECT').catch(() => {});
            }
          });
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // v300: Listen for REAL upload progress from Service Worker
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'UPLOAD_PROGRESS') {
        setUploadProgress(event.data);
      } else if (event.data?.type === 'OUTBOX_SYNC_FINISHED') {
        setTimeout(() => setUploadProgress(null), 3000); // 3s extra visibility
      }
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, []);
  
  // States for bulk cache sync (background)
  const [isBulkSyncing, setIsBulkSyncing] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 })

  // Automatic Trigger: Start sync when session is available and we are online
  useEffect(() => {
    if (session?.user?.id && navigator.onLine && !isBulkSyncing) {
      // v373: Reduced to 1s for dev mode — Fast Refresh resets longer timers
      const timer = setTimeout(() => {
        startBulkSync();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [session?.user?.id, isOnline]);

  const startBulkSync = async (initialProjects: any[] = [], passedUserRole?: string, force = false) => {
    if (syncLock.current) return;
    
    // v291: Global throttle check (30s) to prevent loop on component remounts/refreshes
    const now_ts = Date.now();
    if (!force && (now_ts - lastBulkSyncAttempt < 30000)) {
      // console.log('[Sync] Bulk sync throttled (30s window)');
      return;
    }
    lastBulkSyncAttempt = now_ts;

    let projectsToProcess = [...initialProjects];
    
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    const u = session?.user as any;
    const userRole = (passedUserRole || u?.role || 'OPERATOR').toUpperCase();
    const isAdmin = ['ADMIN', 'ADMINISTRADOR', 'ADMINISTRADORA', 'SUPERADMIN', 'BOSS'].includes(userRole);
    
    const cacheKey = `projects_bulk_${u?.id || 'default'}`;
    
    if (!force) {
      const meta = await db.cacheMetadata.get(cacheKey);
      // v279: Restored a reasonable 15-minute window for everyone, tied to the USER, not global.
      const FRESHNESS_WINDOW = 15 * 60 * 1000;
      
      if (meta && (now_ts - meta.lastSync) < FRESHNESS_WINDOW) {
        // const minsLeft = Math.round((FRESHNESS_WINDOW - (now_ts - meta.lastSync)) / 60000);
        // console.log(`[Sync] Datos frescos para usuario ${u?.id}. Siguiente sync automático en ${minsLeft} min.`);
        return;
      }
    }

    // v291: We are actually starting a heavy sync now. Mark state.
    setIsBulkSyncing(true)
    await logSync('info', `Iniciando sincronización masiva (${userRole})...`, 'bulk-sync');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bulk-cache-sync-started'));
    }

    setBulkProgress({ current: 0, total: 0 })
    syncLock.current = true;
    
    try {
      const u = session?.user as any;
      const userRole = (u?.role || 'OPERATOR').toUpperCase();
      const isAdmin = ['ADMIN', 'ADMINISTRADOR', 'ADMINISTRADORA', 'SUPERADMIN', 'BOSS'].includes(userRole);
      
      // v287: Preserve existing count to avoid UI flicker ("0 projects")
      const existingMeta = await db.cacheMetadata.get(cacheKey);
      await db.cacheMetadata.put({
        id: cacheKey,
        lastSync: existingMeta?.lastSync || Date.now(),
        count: existingMeta?.count || 0,
        status: 'syncing'
      });

      window.dispatchEvent(new CustomEvent('bulk-cache-sync-log', {
        detail: { message: `Iniciando sincronización optimizada (${userRole})...` }
      }))

      // 1. SYNC PROJECTS & CHATS (v288: Increased to 500 for ALL to ensure full offline parity)
      const limit = 2000;
      const res = await fetch(`/api/projects/bulk-cache?limit=${limit}`, { priority: 'low' })
      if (res.ok) {
        const fetchedProjects = await res.json()
        
        // v317: Even if backend filters, we apply local filter for UI consistency (fixes 30/30 vs 12 issue)
        if (!isAdmin) {
          const userId = Number(u?.id);
          projectsToProcess = fetchedProjects.filter((p: any) => {
            const isInTeam = p.team?.some((m: any) => Number(m.userId) === userId);
            const isCreator = Number(p.createdBy || p.createdById) === userId;
            return isInTeam || isCreator;
          });
        } else {
          projectsToProcess = fetchedProjects;
        }

        
        const totalToSync = projectsToProcess.length
        const syncChannel = new BroadcastChannel('aquatech-sync');
        
        syncChannel.postMessage({ 
          type: 'DATA_SYNC_START', 
          total: totalToSync,
          isManual: force 
        });


        setBulkProgress({ current: 0, total: totalToSync })
        
        for (let i = 0; i < projectsToProcess.length; i++) {
          const p = projectsToProcess[i];
          const existing = await db.projectsCache.get(p.id);
          
          // v410: Intelligent merge — Preserve local optimistic changes if they are pending sync
          const mergedProject = {
            ...(existing || {}),
            ...p,
            // If the local project has a pending team sync, don't let the server's bulk data (which might be stale) overwrite our local team
            team: (existing?._pendingTeamSync && existing.team) ? existing.team : p.team,
            // Also preserve local gallery if a gallery upload is pending sync (though handled elsewhere, extra safety)
            gallery: (existing?._pendingGallerySync && existing.gallery) ? existing.gallery : p.gallery,
            isSkeleton: false,
            lastAccessedAt: Date.now()
          };
          
          await db.projectsCache.put(mergedProject);

          if (p.chatMessages && p.chatMessages.length > 0) {
            const existingChat = await db.chatCache.get(p.id);
            const existingMessages = existingChat?.messages || [];
            
            const messageMap = new Map();
            existingMessages.forEach((m: any) => messageMap.set(m.id, m));
            p.chatMessages.forEach((m: any) => messageMap.set(m.id, m));
            
            const finalMessages = Array.from(messageMap.values()).sort((a, b) => 
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );

            await db.chatCache.put({ projectId: p.id, messages: finalMessages });
          }
          
          setBulkProgress(prev => ({ ...prev, current: i + 1 }));
          
          const syncChannel = new BroadcastChannel('aquatech-sync');
          syncChannel.postMessage({ 
            type: 'DATA_SYNC_PROGRESS', 
            current: i + 1, 
            total: totalToSync,
            projectName: p.title || p.id
          });
          syncChannel.close();

          window.dispatchEvent(new CustomEvent('bulk-cache-sync-progress', { 
            detail: { current: i + 1, total: totalToSync } 
          }));
        }

        // v287: Sync Appointments (Agenda/Tareas)
        window.dispatchEvent(new CustomEvent('bulk-cache-sync-log', {
          detail: { message: `Sincronizando agenda y tareas...` }
        }))
        
        try {
          const apptsRes = await fetch(`/api/appointments?userId=${u?.id}`)
          if (apptsRes.ok) {
            const appointments = await apptsRes.ok ? await apptsRes.json() : []
            if (Array.isArray(appointments)) {
              // v287: Clear and replace with fresh data for the user
              await db.appointmentsCache.clear()
              await db.appointmentsCache.bulkPut(appointments)
              // console.log(`[Sync] Cached ${appointments.length} appointments for user ${u?.id}`)
            }
          }
        } catch (e) {
          console.error('[Sync] Appointments sync failed:', e)
        }

        // v257: SAVE METADATA HERE (After data, before expensive pre-fetches)
        // This ensures that if the user closes the app during pre-fetching, 
        // we don't restart the whole process immediately next time.
        // v274: Removed premature metadata update. Now we only save at the very end.
        // v267: INTELLIGENT PRE-FETCHING — Sequential chunk-by-chunk, SW-aware
        // v267: Helper — waits up to 10s for the SW controller to be available
        const getController = async (): Promise<ServiceWorker | null> => {
          if (!('serviceWorker' in navigator)) return null;
          if (navigator.serviceWorker.controller) return navigator.serviceWorker.controller;
          await navigator.serviceWorker.ready;
          for (let attempt = 0; attempt < 20; attempt++) {
            if (navigator.serviceWorker.controller) return navigator.serviceWorker.controller;
            await new Promise(r => setTimeout(r, 500));
          }
          return navigator.serviceWorker.controller;
        };

        // v267: Sends a PRECACHE_URLS message and awaits SW confirmation via MessageChannel
        const precacheAndWait = async (urlOrUrls: string | string[], projectNameOrOptions: string | any = ''): Promise<void> => {
          const controller = await getController();
          const urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
          const projectName = typeof projectNameOrOptions === 'string' ? projectNameOrOptions : '';
          const options = typeof projectNameOrOptions === 'object' ? projectNameOrOptions : {};
          
          if (!controller) {
            await Promise.all(urls.map(url => 
              fetch(url, { 
                credentials: 'same-origin', 
                headers: { 'Accept': 'text/html', ...options.headers } 
              }).catch(() => {})
            ));
            return;
          }
          await new Promise<void>((resolve) => {
            const { port1, port2 } = new MessageChannel();
            const timeout = setTimeout(() => resolve(), 30000);
            port1.onmessage = () => { clearTimeout(timeout); resolve(); };
            controller.postMessage({ type: 'PRECACHE_URLS', urls, projectName, options, replyPort: port2 }, [port2]);
          });
        };

        // v289: Shell-First Strategy — Only precache the 2 universal shells.
          // Individual project URLs are NOT needed because findCachedPage() in the SW
          // automatically serves the correct shell when the specific URL is missing.
          // This reduces sync from 3 minutes to ~15 seconds.
          window.dispatchEvent(new CustomEvent('bulk-cache-sync-log', {
            detail: { message: `Preparando entorno offline inteligente (Shell-First)...` }
          }))

          await Promise.all([
            precacheAndWait('/admin/proyectos/offline-shell', { headers: { 'Accept': 'text/html' } }),
            precacheAndWait('/admin/operador/proyecto/offline-shell', { headers: { 'Accept': 'text/html' } }),
            precacheAndWait('/admin/proyectos/offline-shell?_rsc=1'),
            precacheAndWait('/admin/operador/proyecto/offline-shell?_rsc=1'),
          ]);

          // 2. Main Sections (Role-Aware) — v280: All parallel, no delays
          const sections = isAdmin 
            ? ['/admin', '/admin/proyectos', '/admin/calendario', '/admin/inventario', '/admin/cotizaciones']
            : ['/admin/operador', '/admin/inventario', '/admin/cotizaciones'];

          await Promise.all(sections.map(async (section) => {
            await precacheAndWait(section);
            const rscUrl = section.includes('?') ? `${section}&_rsc=prefetch` : `${section}?_rsc=prefetch`;
            fetch(rscUrl, { priority: 'low', headers: { 'RSC': '1', 'Next-Router-Prefetch': '1' } }).catch(() => {});
          }));

          // 3. v user: Project-Specific Chunks — Pre-cache individual project details
          // For Admin: First 15 projects (same as list page)
          // For Operator: ALL projects (usually fewer, and they need them all offline)
          const projectsForChunks = isAdmin ? projectsToProcess.slice(0, 15) : projectsToProcess;
          
          if (projectsForChunks.length > 0) {
            window.dispatchEvent(new CustomEvent('bulk-cache-sync-log', {
              detail: { message: `Sincronizando activos de ${projectsForChunks.length} proyectos...` }
            }))

            const chunkSyncChannel = new BroadcastChannel('aquatech-sync');
            chunkSyncChannel.postMessage({ 
              type: 'ASSET_PRECACHE_PROGRESS', 
              current: 0, 
              total: projectsForChunks.length,
              active: true 
            });

            // Process in batches of 5 to avoid saturating the SW and network
            const BATCH_SIZE = 5;
            for (let i = 0; i < projectsForChunks.length; i += BATCH_SIZE) {
              const batch = projectsForChunks.slice(i, i + BATCH_SIZE);
              await Promise.all(batch.map(async (p, idx) => {
                const projectUrl = isAdmin ? `/admin/proyectos/${p.id}` : `/admin/operador/proyecto/${p.id}`;
                await precacheAndWait(projectUrl, p.title);
                
                // Update progress after each batch member finishes
                chunkSyncChannel.postMessage({ 
                  type: 'ASSET_PRECACHE_PROGRESS', 
                  current: Math.min(i + idx + 1, projectsForChunks.length), 
                  total: projectsForChunks.length,
                  active: true
                });
              }));
              // Tiny cooldown between batches
              await new Promise(r => setTimeout(r, 500));
            }
            
            chunkSyncChannel.postMessage({ type: 'ASSET_PRECACHE_FINISHED' });
            chunkSyncChannel.close();
          }
        }


      // 3. SYNC USERS — v281: Removed artificial 500ms delay
      window.dispatchEvent(new CustomEvent('bulk-cache-sync-log', {
        detail: { message: `Sincronizando equipo de trabajo...` }
      }))
      // v264: Fetch all relevant roles for offline selection
      // v274: Fetch ALL users (no role filter) so they are all available offline for assignments
      const userRes = await fetch('/api/users', { priority: 'low' })
      if (userRes.ok) {
        const users = await userRes.json()
        if (Array.isArray(users)) {
           await db.usersCache.clear();
           await db.usersCache.bulkPut(users.map(u => ({
             id: u.id,
             name: u.name,
             role: u.role
           })));
        }
      }

      // 4. SYNC QUOTES
      if (isAdmin) {
        await new Promise(resolve => setTimeout(resolve, 500));
        window.dispatchEvent(new CustomEvent('bulk-cache-sync-log', {
          detail: { message: `Sincronizando cotizaciones...` }
        }))
        const quoteRes = await fetch('/api/quotes?limit=100', { priority: 'low' })
        if (quoteRes.ok) {
          const quotes = await quoteRes.json()
          await db.quotesCache.bulkPut(quotes);
        }
      }

      const now = Date.now()
      const finalCount = projectsToProcess.length;
      
      // v316: Ensure SW is aware of the exact projects to precache BEFORE we tell the UI we are done.
      // This solves the race condition where UI turns green prematurely.
      if (navigator.serviceWorker?.controller) {
        const urls = projectsToProcess.slice(0, 15).map(p => 
          isAdmin ? `/admin/proyectos/${p.id}` : `/admin/operador/proyecto/${p.id}`
        );
        navigator.serviceWorker.controller.postMessage({
          type: 'PRECACHE_URLS',
          urls
        });
      }

      const cacheKeyFinal = `projects_bulk_${u?.id || 'default'}`;
      await db.cacheMetadata.put({
        id: cacheKeyFinal,
        lastSync: now,
        count: finalCount,
        status: 'idle'
      })
      
      await logSync('success', `Sincronización masiva completada: ${finalCount} proyectos`, 'bulk-sync');

      const syncChannelFinal = new BroadcastChannel('aquatech-sync');
      syncChannelFinal.postMessage({ type: 'DATA_SYNC_FINISHED', count: finalCount });
      syncChannelFinal.close();

      window.dispatchEvent(new CustomEvent('bulk-cache-sync-finished', { 
        detail: { count: finalCount } 
      }))

      // 5. SILENT GARBAGE COLLECTION (v278)
      // Keeps the local database small by removing stale projects if we exceed 60
      try {
        // v288: Increased from 60 to 500 to allow full offline operation
        const MAX_KEPT_PROJECTS = 500;
        const allCachedProjects = await db.projectsCache.orderBy('lastAccessedAt').reverse().toArray();
        if (allCachedProjects.length > MAX_KEPT_PROJECTS) {
          const toDelete = allCachedProjects.slice(MAX_KEPT_PROJECTS).map(p => p.id);
          if (toDelete.length > 0) {
            await db.projectsCache.bulkDelete(toDelete);
            await db.chatCache.bulkDelete(toDelete);
            // console.log(`[GarbageCollector] Limpiados ${toDelete.length} proyectos antiguos de la caché local.`);
          }
        }
      } catch (gcErr) {
        console.warn('Error en la barredora de caché:', gcErr);
      }

      // 6. ORPHAN CLEANUP — Remove from local cache any project that no longer
      // exists on the server (e.g. deleted by an admin).
      // Only runs when the server returned a valid, non-empty list so we never
      // accidentally wipe the cache due to a failed fetch.
      if (projectsToProcess.length > 0) {
        try {
          const serverIds = new Set(projectsToProcess.map((p: any) => p.id));
          const allCached = await db.projectsCache.toArray();
          const orphanIds = allCached
            .filter(p => !serverIds.has(p.id))
            .map(p => p.id);
          if (orphanIds.length > 0) {
            await db.projectsCache.bulkDelete(orphanIds);
            await db.chatCache.bulkDelete(orphanIds);
            await logSync(
              'info',
              `Orphan cleanup: ${orphanIds.length} proyectos borrados de caché local (ya no existen en servidor)`,
              'bulk-sync'
            );
          }
        } catch (orphanErr) {
          console.warn('[Sync] Orphan cleanup falló (no crítico):', orphanErr);
        }
      }
    } catch (err) {
      console.error('Skeleton sync error:', err)
      await logSync('error', `Fallo sincronización masiva: ${err instanceof Error ? err.message : 'Desconocido'}`, 'bulk-sync');
      window.dispatchEvent(new CustomEvent('bulk-cache-sync-log', {
        detail: { message: `Error en sincronización: ${err instanceof Error ? err.message : 'Desconocido'}` }
      }))
      
      // v291: Reset status to idle on failure so we don't get stuck in "syncing" state
      try {
        const u = session?.user as any;
        const cacheKey = `projects_bulk_${u?.id || 'default'}`;
        const existing = await db.cacheMetadata.get(cacheKey);
        if (existing) {
          await db.cacheMetadata.update(cacheKey, { status: 'idle' });
        }
      } catch (metaErr) {}
    } finally {
      syncLock.current = false;
      setIsBulkSyncing(false)
    }
  }

  useEffect(() => {
    if (session?.user?.id && navigator.onLine) {
      const u = session.user
      const authData = {
        userId: u.id,
        name: u.name || '',
        role: (u.role as any) || 'OPERATOR',
        username: (u as any).username || '',
        permissions: (u as any).permissions || null,
        lastLogin: Date.now()
      }
      
      db.auth.put({ ...authData, id: 'last_session' }).catch(console.error)
      db.authShadow.put({ ...authData, id: 'current' }).catch(console.error)
    }
  }, [session])
  
  const syncOutbox = async () => {
    if (typeof window === 'undefined' || !navigator.onLine || outboxLock.current) return
    
    // v365: Reset stuck 'syncing' items
    try {
      const stuckItems = await db.outbox.where('status').equals('syncing').toArray();
      const now = Date.now();
      for (const item of stuckItems) {
        if (!item.lastAttemptAt) {
          await db.outbox.update(item.id!, { status: 'pending' });
          continue;
        }
        if (now - item.lastAttemptAt > 180000) { // Increased to 3min for turbo
          await db.outbox.update(item.id!, { status: 'pending' });
        }
      }
    } catch (e) { /* ignore */ }

    const now = Date.now()
    if (now - lastSyncExecution < 1000) return // v500: Snappier 1s throttle
    
    const lastSyncStart = localStorage.getItem('global_sync_lock')
    if (lastSyncStart && (now - Number(lastSyncStart)) < 5000) return // v500: Lower lock for higher throughput
    
    localStorage.setItem('global_sync_lock', String(now))
    lastSyncExecution = now;
    outboxLock.current = true

    try {
      const items = await db.outbox.toArray();
      const eligible = items.filter(i => i.status === 'pending' || i.status === 'failed');
      if (eligible.length === 0) {
        localStorage.removeItem('global_sync_lock')
        return
      }

      // Sort chronologically
      eligible.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      // v500: TURBO GROUPING — Group by projectId for parallel execution
      const groups: Record<string, typeof eligible> = {};
      eligible.forEach(item => {
        const key = item.projectId ? String(item.projectId) : 'global';
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      });

      const groupIds = Object.keys(groups);
      let hasSyncedAnything = false;
      const failedProjects = new Set<string>();

      // v500: Parallel pool — Process 3 projects at once
      const CONCURRENCY = 3;
      for (let i = 0; i < groupIds.length; i += CONCURRENCY) {
        const batch = groupIds.slice(i, i + CONCURRENCY);
        
        await Promise.all(batch.map(async (projectId) => {
          const projectItems = groups[projectId];
          
          // Inside a project group, we MUST process sequentially to maintain order
          for (const item of projectItems) {
            if (failedProjects.has(projectId)) break;

            try {
              // Mark as syncing
              await db.outbox.update(item.id!, { status: 'syncing', lastAttemptAt: Date.now() });

              let endpoint = '';
              let method = 'POST';
              
              // Endpoints selection
              if (item.type === 'QUOTE') { endpoint = '/api/quotes' }
              else if (item.type === 'MATERIAL') { endpoint = '/api/materials' }
              else if (item.type === 'MESSAGE' || item.type === 'MEDIA_UPLOAD' || item.type === 'LOCATION') { endpoint = `/api/projects/${item.projectId}/messages` }
              else if (item.type === 'EXPENSE') { 
                if (item.payload.id) { endpoint = `/api/projects/${item.projectId}/expenses/${item.payload.id}`; method = 'PATCH'; }
                else { endpoint = `/api/projects/${item.projectId}/expenses`; method = 'POST'; }
              }
              else if (item.type === 'EXPENSE_DELETE') { endpoint = `/api/projects/${item.projectId}/expenses/${item.payload.expenseId}`; method = 'DELETE'; }
              else if (item.type === 'DAY_START') { endpoint = `/api/day-records` }
              else if (item.type === 'DAY_END') { endpoint = `/api/day-records`; method = 'PUT' }
              else if (item.type === 'PHASE_COMPLETE' || item.type === 'PHASE_UPDATE') { endpoint = `/api/projects/${item.projectId}/phases/${item.payload.phaseId}`; method = 'PATCH'; }
              else if (item.type === 'PHASE_CREATE') { endpoint = `/api/projects/${item.projectId}/phases`; method = 'POST'; }
              else if (item.type === 'PROJECT') { endpoint = '/api/projects' }
              else if (item.type === 'PROJECT_UPDATE') { endpoint = `/api/projects/${item.projectId}`; method = 'PATCH' }
              else if (item.type === 'TEAM_UPDATE') { endpoint = `/api/projects/${item.projectId}/team`; method = 'PUT' }
              else if (item.type === 'TASK') {
                if (!item.payload.isNew && (item.payload.id || item.payload._id)) { endpoint = `/api/appointments/${item.payload.id || item.payload._id}`; method = 'PATCH'; }
                else { endpoint = '/api/appointments'; }
              }
              else if (item.type === 'TASK_STATUS_TOGGLE') { endpoint = `/api/appointments/${item.payload.appointmentId}`; method = 'PATCH' }
              else if (item.type === 'GALLERY_UPLOAD') { endpoint = `/api/projects/${item.projectId}/gallery` }
              else if (item.type === 'GALLERY_DELETE') { endpoint = `/api/projects/${item.projectId}/gallery/${item.payload.galleryId}`; method = 'DELETE' }
              else if (item.type === 'GALLERY_RENAME') { endpoint = `/api/projects/${item.projectId}/gallery/${item.payload.galleryId}`; method = 'PATCH'; }

              let finalPayload = { ...item.payload };

              // v500: Binary & Multi-File Skip — If we have binaryFile or a PROJECT with multiple files
              if (!item.binaryFile || item.type === 'PROJECT') {
                const { uploadToBunnyClientSide } = await import('@/lib/storage-client');
                
                // --- MULTI-FILE PROJECT SYNC (NEW TURBO PATH) ---
                if (item.type === 'PROJECT' && finalPayload.files && Array.isArray(finalPayload.files)) {
                  for (let fi = 0; fi < finalPayload.files.length; fi++) {
                    const f = finalPayload.files[fi];
                    // If it has a binary file reference, upload it now
                    if (f.binaryFile || f.file) {
                      try {
                        const fileToUpload = f.binaryFile || f.file;
                        const filename = f.filename || (fileToUpload instanceof File ? fileToUpload.name : `file_${fi}_${Date.now()}.jpg`);
                        const folder = `projects/temp_${item.id}`;
                        const uploadResult = await uploadToBunnyClientSide(fileToUpload, filename, folder);
                        
                        // Replace binary reference with the real URL
                        finalPayload.files[fi].url = uploadResult.url;
                        finalPayload.files[fi].mimeType = uploadResult.mimeType || f.mimeType;
                        finalPayload.files[fi].binaryFile = undefined;
                        finalPayload.files[fi].file = undefined;
                      } catch (uploadErr) {
                        console.error(`[SyncProject] File ${fi} failed:`, uploadErr);
                        // Skip this file for now, or throw to retry the whole project later
                      }
                    }
                  }
                }

                // Unified Media Sync (Legacy Path / Single File)
                const hasMedia = !!(finalPayload.media?.base64 || finalPayload.media?.url?.startsWith('blob:') || finalPayload.media?.fileData || finalPayload.file || finalPayload.receiptFileData || finalPayload.fileData);
                
                if (hasMedia && item.type !== 'PROJECT') {
                  try {
                    let uploadFile: File | Blob;
                    let finalFilename: string = '';
                    const source = finalPayload.media?.fileData || finalPayload.fileData || finalPayload.receiptFileData || finalPayload.media?.base64 || finalPayload.media?.url || finalPayload.url || finalPayload.receiptPhoto;
                    
                    if (source && (source instanceof ArrayBuffer || source instanceof Uint8Array || (typeof source === 'object' && (source as any).buffer))) {
                      const s = (source as any).buffer ? source as any : { buffer: source, type: 'application/octet-stream', name: '' };
                      uploadFile = new Blob([s.buffer], { type: s.type || 'application/octet-stream' });
                      finalFilename = s.name || `sync_${Date.now()}.jpg`;
                    } else if (finalPayload.file) {
                      uploadFile = finalPayload.file;
                      finalFilename = finalPayload.file.name;
                    } else {
                      const resB64 = await fetch(source as string);
                      uploadFile = await resB64.blob();
                      finalFilename = finalPayload.media?.filename || `sync_${Date.now()}.jpg`;
                    }

                    const folder = item.projectId ? `projects/${item.projectId}` : 'general';
                    const uploadResult = await uploadToBunnyClientSide(uploadFile, finalFilename, folder);
                    
                    if (item.type === 'EXPENSE') { finalPayload.receiptPhoto = uploadResult.url; }
                    else if (item.type === 'GALLERY_UPLOAD') { finalPayload.url = uploadResult.url; }
                    else {
                      finalPayload.media = { ...finalPayload.media, url: uploadResult.url, filename: finalFilename, mimeType: uploadResult.mimeType, type: uploadResult.type, base64: undefined, fileData: null };
                    }
                  } catch (err) {
                    throw new Error(`Media upload failed: ${err instanceof Error ? err.message : 'Unknown'}`);
                  }
                }
              }

              // Final Transmission
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), item.binaryFile ? 120000 : 30000);
              
              let res;
              if (item.binaryFile) {
                const formData = new FormData();
                const fullPayload = {
                  ...finalPayload,
                  lat: (item.lat !== null && item.lat !== undefined) ? item.lat : finalPayload.lat, 
                  lng: (item.lng !== null && item.lng !== undefined) ? item.lng : finalPayload.lng, 
                  createdAt: item.timestamp ? new Date(item.timestamp).toISOString() : undefined,
                  isOfflineSync: true 
                };
                Object.keys(fullPayload).forEach(key => {
                  if (key === 'files') return;
                  const val = (fullPayload as any)[key];
                  formData.append(key, typeof val === 'object' ? JSON.stringify(val) : String(val));
                });
                formData.append('file', item.binaryFile);
                res = await fetch(endpoint, { method, headers: { 'x-sync-id': item.syncId || `sync-${item.id}-${item.timestamp}` }, body: formData, signal: controller.signal });
              } else {
                res = await fetch(endpoint, {
                  method,
                  headers: { 'Content-Type': 'application/json', 'x-sync-id': item.syncId || `sync-${item.id}-${item.timestamp}` },
                  body: JSON.stringify({ ...finalPayload, lat: item.lat, lng: item.lng, isOfflineSync: true }),
                  signal: controller.signal
                });
              }
              clearTimeout(timeoutId);

              if (res.ok) {
                const resData = await res.json().catch(() => ({}));
                await db.outbox.delete(item.id!);
                hasSyncedAnything = true;
                
                // Trigger success event for UI
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('sync-success', { detail: { type: item.type, projectId: item.projectId, result: resData } }));
                }

                // Project ID mapping (if created offline)
                if (item.type === 'PROJECT' && resData.id) {
                  const tempId = `pending-${item.id}`;
                  await db.outbox.filter(oi => String(oi.projectId) === tempId).modify({ projectId: resData.id });
                }
              } else {
                const status = res.status;
                if (status >= 400 && status < 500 && status !== 429) {
                  await db.outbox.delete(item.id!); // Permanent failure
                } else {
                  throw new Error(`HTTP ${status}`);
                }
              }
            } catch (e) {
              console.error(`[TurboSync] Item ${item.id} failed:`, e);
              failedProjects.add(projectId);
              await db.outbox.update(item.id!, { status: 'failed', attempts: (item.attempts || 0) + 1, lastAttemptAt: Date.now() });
            }
          }
        }));
      }

      if (hasSyncedAnything && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('outbox-items-synced', { detail: { timestamp: Date.now() } }));
      }

      // Re-schedule if there's more work
      const remaining = await db.outbox.where('status').anyOf(['pending', 'failed']).count();
      if (remaining > 0) setTimeout(() => syncOutbox(), 5000);

    } finally {
      outboxLock.current = false;
      localStorage.removeItem('global_sync_lock');
    }
  }

  const refreshCaches = async () => {
    if (typeof window === 'undefined' || !navigator.onLine) return
    try {
      // 1. Refresh Materials
      const matRes = await fetch('/api/materials')
      if (matRes.ok) {
        const materials = await matRes.json()
        await db.materialsCache.clear()
        await db.materialsCache.bulkPut(materials.map((m: any) => ({
          ...m,
          unitPrice: Number(m.unitPrice)
        })))
      }

      // 2. Refresh Clients
      const cliRes = await fetch('/api/clients')
      if (cliRes.ok) {
        const clients = await cliRes.json()
        await db.clientsCache.clear()
        await db.clientsCache.bulkPut(clients.map((c: any) => ({
          id: c.id,
          name: c.name,
          ruc: c.ruc || '',
          address: c.address || '',
          phone: c.phone || ''
        })))
      }
      // console.log('[Offline] Caches refreshed successfully')
    } catch (e) {
      console.error('[Offline] Error refreshing caches:', e)
    }
  }

  // v261: Helper to delegate sync to Service Worker (works when app is minimized)
  const registerSwSync = async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      // 1. Register one-shot background sync (fires when connectivity resumes)
      if ('sync' in reg) {
        await (reg as any).sync.register('sync-outbox');
        // console.log('[Sync] Registered SW background sync: sync-outbox');
      }
      // 2. Also trigger immediately via postMessage (SW stays alive to process)
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'TRIGGER_SYNC' });
        // v273: Trigger specific sync types
        navigator.serviceWorker.controller.postMessage({ type: 'TRIGGER_SYNC', specificType: 'MESSAGE' });
        navigator.serviceWorker.controller.postMessage({ type: 'TRIGGER_SYNC', specificType: 'EXPENSE' });
        // console.log('[Sync] Sent TRIGGER_SYNC types to SW via postMessage');
      }
    } catch (e) {
      console.warn('[Sync] SW sync registration failed:', e);
    }
  };

  // v261: Register periodic sync once on mount (Android/Chrome 80+)
  useEffect(() => {
    const registerPeriodicSync = async () => {
      if (!('serviceWorker' in navigator)) return;
      try {
        const reg = await navigator.serviceWorker.ready;
        if ('periodicSync' in reg) {
          try {
            await (reg as any).periodicSync.register('global-sync', {
              minInterval: 15 * 60 * 1000 // 15 minutes
            });
            console.log('[Sync] Periodic background sync registered (15 min interval)');
          } catch (e) {
            // Ignore registration errors
          }
        }
      } catch (e) {
        // console.warn('[Sync] Periodic sync not available:', e);
      }
    };
    registerPeriodicSync();
  }, []);

  useEffect(() => {
    const handleStatusChange = () => {
      setIsOnline(navigator.onLine)
      if (navigator.onLine) {
        logSync('info', '🟢 Conexión restaurada — iniciando sincronización...', 'network');
        syncOutbox()
        refreshCaches()
        // Also wake SW to sync anything it has
        registerSwSync()
      } else {
        logSync('warn', '🔴 Sin conexión a internet', 'network');
      }
    }
    
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && typeof navigator !== 'undefined' && navigator.onLine) {
        // console.log('[Sync] App visible and online, checking for fresh data...');
        syncOutbox()
        // v291: startBulkSync is already throttled (30s) and has freshness check (15m).
        // It's safe to call, but we avoid calling it too aggressively.
        if (!syncLock.current && (Date.now() - lastBulkSyncAttempt > 60000)) {
          startBulkSync()
        }
      } else if (document.visibilityState === 'hidden') {
        // v261: CRITICAL — App going to background!
        // Android suspends JS timers when the app is minimized.
        // We must delegate ALL pending sync work to the Service Worker NOW,
        // because our setInterval-based syncOutbox() will stop firing.
        // console.log('[Sync] App going to BACKGROUND — delegating sync to SW');
        
        // Check if there are pending items
        try {
          const pendingCount = await db.outbox.where('status').anyOf(['pending', 'failed']).count();
          if (pendingCount > 0) {
            // console.log(`[Sync] ${pendingCount} pending items — waking SW for background sync`);
            await registerSwSync();
          }
        } catch (e) {
          // Even if the check fails, still try to register
          await registerSwSync();
        }
      }
    }
    
    const handleManualSync = (e: any) => {
      // console.log('[Sync] Manual sync triggered via event. Force:', e.detail?.force);
      startBulkSync([], undefined, e.detail?.force || false);
    };

    const handleOutboxSyncEvent = () => {
      syncOutbox();
    };

    window.addEventListener('online', handleStatusChange)
    window.addEventListener('offline', handleStatusChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('trigger-bulk-sync', handleManualSync)
    window.addEventListener('trigger-outbox-sync', handleOutboxSyncEvent)
    
    // Initial sync and cache refresh
    if (navigator.onLine) {
      // Fire outbox sync after hydration finishes to ensure fast UI paint
      setTimeout(() => {
        syncOutbox()
      }, 2000); 

      // v281: Delay heavy global caches (materials, clients) by 20 SECONDS. 
      // Downloading and parsing megabytes of JSON freezes mobile devices and blocks the main thread.
      setTimeout(() => {
        refreshCaches()
      }, 20000);

      // v374: Reduced to 2s for dev mode — 25s was too long for Fast Refresh
      setTimeout(() => {
        if (!syncLock.current) startBulkSync()
      }, 2000)
    }
    
    // Fase 8: MASTER SYNC LOOP
    // Consolidates all background timers into one coordinated cycle to reduce CPU contention on mobile.
    // Base cycle: 15 seconds.
    let tickCount = 0;
    const masterInterval = setInterval(() => {
        if (!navigator.onLine) return;
        
        tickCount++;
        
        // 1. Every 15s: Primary Outbox Sync
        syncOutbox();

        // 2. Every 120s (8 ticks): Heartbeat
        if (tickCount % 8 === 0) {
            logSync('info', '🤖 Robot vivo — latido coordinado', 'heartbeat').catch(() => {});
        }

        // 3. Every 240s (16 ticks): DB Keep-Alive Ping
        if (tickCount % 16 === 0) {
            fetch('/api/health/ping').catch(() => {});
        }

        // 4. Every 30 mins (120 ticks): Full Bulk Sync
        if (tickCount % 120 === 0) {
            startBulkSync();
            tickCount = 0; // Reset counter
        }
    }, 15000);
    
    // Primer latido inmediato
    logSync('success', '🤖 Robot v333 (Consolidated) iniciado', 'heartbeat');

    return () => {
      window.removeEventListener('online', handleStatusChange)
      window.removeEventListener('offline', handleStatusChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('trigger-bulk-sync', handleManualSync)
      window.removeEventListener('trigger-outbox-sync', handleOutboxSyncEvent)
      clearInterval(masterInterval)
    }
  }, [])

  if (!uploadProgress) return null;

  return (
    <div className="sync-progress-container fixed bottom-20 right-4 z-[9999] w-72 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <style>{`
        @media (max-width: 768px) {
          .sync-progress-container {
            left: 50% !important;
            right: auto !important;
            transform: translateX(-50%);
            width: calc(100% - 32px) !important;
            max-width: 350px;
          }
        }
      `}</style>
      <div className="bg-black/80 backdrop-blur-xl border border-white/10 p-5 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-0.5">Sincronizando Multimedia</span>
            <span className="text-sm font-semibold text-white truncate max-w-[180px]">
              {uploadProgress.filename}
            </span>
          </div>
          <div className="bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/20">
            <span className="text-xs text-blue-400 font-black font-mono">
              {uploadProgress.percent}%
            </span>
          </div>
        </div>
        
        <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden">
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(37,99,235,0.5)]"
            style={{ width: `${uploadProgress.percent}%` }}
          />
        </div>
        
        <div className="flex justify-between items-center mt-3">
          <p className="text-[10px] text-zinc-500 font-medium">
            Parte <span className="text-zinc-300 font-bold">{uploadProgress.chunk}</span> de <span className="text-zinc-300 font-bold">{uploadProgress.totalChunks}</span>
          </p>
          <div className="flex gap-1">
            <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
            <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse delay-75" />
            <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse delay-150" />
          </div>
        </div>
      </div>
    </div>
  );
}
