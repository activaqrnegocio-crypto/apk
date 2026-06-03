// src/lib/background-service.ts
// Background Runner Service para Android - procesa outbox cuando app está cerrada

import { registerPlugin } from '@capacitor/core';

const BackgroundRunner = registerPlugin('BackgroundRunner') as any;

// Track if we're currently processing to avoid duplicate runs
let isProcessing = false;

// Configuration for background runner
export function configureBackgroundRunner(): void {
  try {
    BackgroundRunner.register({
      title: 'Aquatech Sync',
      desc: 'Sincronizando datos offline',
      script: backgroundSyncScript,
      runOnBoot: true,
      runOnLogin: true,
      interval: 15 * 60, // 15 minutes minimum
      autoStart: true,
    });
    console.log('[BackgroundRunner] Configured successfully');
  } catch (err) {
    console.warn('[BackgroundRunner] Configuration failed:', err);
  }
}

// v380: The actual background script that runs when Android wakes the app
// This runs in a WebView context with limited capabilities.
// It triggers a sync event that the SW will handle when the app is opened.
const backgroundSyncScript = `
var isSyncing = false;
var lastSyncTime = 0;

async function doSync() {
  if (isSyncing) {
    console.log('[Background] Sync already in progress, skipping');
    return;
  }
  
  isSyncing = true;
  try {
    console.log('[Background] Starting outbox sync check...');
    
    // v380: When background runner fires, set a flag in sessionStorage
    // The SW will detect this when the app opens and trigger sync
    try {
      sessionStorage.setItem('bg_sync_pending', Date.now().toString());
    } catch (e) {
      console.warn('[Background] Could not set sessionStorage flag');
    }
    
    // v380: Also dispatch a custom event that the main app context can listen to
    try {
      window.dispatchEvent(new CustomEvent('background-sync-trigger'));
    } catch (e) {
      console.warn('[Background] Could not dispatch event');
    }
    
    // v380: For Android 7+, we can also use navigator.serviceWorker.message
    // but it requires the SW to be active
    console.log('[Background] Sync check complete - app will process when opened');
  } catch (err) {
    console.error('[Background] Sync error:', err);
  } finally {
    isSyncing = false;
  }
}

// v380: Listen for the event from the main app context
document.addEventListener('resume', function() {
  console.log('[Background] App resumed, checking pending syncs...');
  doSync();
});

// v380: Initial sync check when script loads (app just opened from background)
setTimeout(doSync, 2000);
`;