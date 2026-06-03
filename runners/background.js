// runners/background.js
// Este archivo corre en un entorno JavaScript headless (SIN WebView)
// background-runner plugin lo ejecuta automáticamente según la config en capacitor.config.ts

// ============================================
// SYNC EVENT - Procesa el outbox en background
// ============================================
addEventListener('outboxSync', async (resolve, reject) => {
  console.log('[BackgroundRunner] outboxSync event fired');
  
  try {
    // Obtener sesión desde CapacitorKV
    const sessionData = await CapacitorKV.get({ key: 'authToken' });
    if (!sessionData?.value) {
      console.log('[BackgroundRunner] No hay sesión, omitiendo sync');
      resolve();
      return;
    }
    
    const session = JSON.parse(sessionData.value);
    
    // Obtener outbox pendiente desde CapacitorKV
    const outboxData = await CapacitorKV.get({ key: 'pendingOutbox' });
    if (!outboxData?.value) {
      console.log('[BackgroundRunner] No hay items pendientes');
      resolve();
      return;
    }
    
    const outboxItems = JSON.parse(outboxData.value);
    if (!Array.isArray(outboxItems) || outboxItems.length === 0) {
      console.log('[BackgroundRunner] Outbox vacío');
      resolve();
      return;
    }
    
    console.log(`[BackgroundRunner] Procesando ${outboxItems.length} items...`);
    
    // Obtener API URL - solo funciona si se configura en capacitor.config.ts
    // (process.env no está disponible en background runner)
    const apiUrl = 'https://178.238.238.158.sslip.io'; // Hardcoded por ahora
    let processedCount = 0;
    let failedCount = 0;
    const failedItems = [];
    
    for (const item of outboxItems) {
      try {
        const result = await processItem(item, apiUrl, session.token);
        if (result.success) {
          processedCount++;
        } else {
          failedCount++;
          // No es un error crítico, dejar para siguiente ciclo
          failedItems.push(item);
        }
      } catch (err) {
        console.error(`[BackgroundRunner] Error procesando item ${item.id}:`, err);
        failedCount++;
        failedItems.push(item);
      }
    }
    
    // Guardar items fallidos de vuelta en KV (con límite de reintentos)
    const maxRetries = 3;
    const remainingItems = failedItems.filter(item => (item.retries || 0) < maxRetries);
    const deadItems = failedItems.filter(item => (item.retries || 0) >= maxRetries);
    
    if (remainingItems.length > 0) {
      // Incrementar retries
      const retriedItems = remainingItems.map(item => ({
        ...item,
        retries: (item.retries || 0) + 1
      }));
      await CapacitorKV.set({
        key: 'pendingOutbox',
        value: JSON.stringify(retriedItems)
      });
    } else {
      await CapacitorKV.remove({ key: 'pendingOutbox' });
    }
    
    if (deadItems.length > 0) {
      console.warn(`[BackgroundRunner] ${deadItems.length} items descartados tras ${maxRetries} intentos`);
    }
    
    console.log(`[BackgroundRunner] Sync completado: ${processedCount} ok, ${failedCount} fallidos, ${remainingItems.length} pendientes`);
    
    // Notificar al usuario si hubo cambios
    if (processedCount > 0) {
      await CapacitorNotifications.schedule({
        notifications: [{
          id: Date.now(),
          title: 'Aquatech CRM',
          body: `${processedCount} cambio${processedCount > 1 ? 's' : ''} sincronizado${processedCount > 1 ? 's' : ''}`,
          autoCancel: true,
        }]
      });
    }
    
    resolve();
  } catch (err) {
    console.error('[BackgroundRunner] Error en outboxSync:', err);
    reject(err);
  }
});

// ============================================
// HELPER: Procesar un item individual
// ============================================
async function processItem(item, apiUrl, token) {
  const headers = {
    'Content-Type': 'application/json',
    'x-sync-id': item.syncId || item.id,
    'Cookie': `next-auth.session-token=${token}`,
  };
  
  const { type, payload, id } = item;
  
  switch (type) {
    case 'MESSAGE': {
      const { projectId, ...msgPayload } = payload;
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(msgPayload),
      });
      if (!res.ok) throw new Error(`MESSAGE: ${res.status}`);
      return { success: true };
    }
    
    case 'EXPENSE': {
      const res = await fetch(`${apiUrl}/api/expenses`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`EXPENSE: ${res.status}`);
      return { success: true };
    }
    
    case 'DAY_START': {
      const res = await fetch(`${apiUrl}/api/day-records`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`DAY_START: ${res.status}`);
      return { success: true };
    }
    
    case 'DAY_END': {
      const res = await fetch(`${apiUrl}/api/day-records`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`DAY_END: ${res.status}`);
      return { success: true };
    }
    
    case 'PHASE_COMPLETE': {
      const { projectId, phaseId, ...phasePayload } = payload;
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/phases/${phaseId}/complete`, {
        method: 'POST',
        headers,
        body: JSON.stringify(phasePayload),
      });
      if (!res.ok) throw new Error(`PHASE_COMPLETE: ${res.status}`);
      return { success: true };
    }
    
    case 'TEAM_UPDATE': {
      const { projectId, ...teamPayload } = payload;
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/team`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(teamPayload),
      });
      if (!res.ok) throw new Error(`TEAM_UPDATE: ${res.status}`);
      return { success: true };
    }
    
    default:
      throw new Error(`Tipo no soportado en background: ${type}`);
  }
}
