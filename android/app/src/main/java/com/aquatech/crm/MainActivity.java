package com.aquatech.crm;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    private static final String TAG = "AquatechFCM";
    private boolean notificationHandled = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Manejar el intent de notificación
        handleNotificationIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationIntent(intent);
    }

    /**
     * Maneja el Intent cuando la notificación es tocada.
     * v432: Guardar en localStorage para que React lo lea al inicio
     */
    private void handleNotificationIntent(Intent intent) {
        Log.d(TAG, "handleNotificationIntent llamado");
        
        // Evitar procesar dos veces la misma notificación
        if (notificationHandled) {
            Log.d(TAG, "Ya procesado, ignorando");
            return;
        }
        
        if (intent == null) {
            Log.w(TAG, "Intent es null");
            return;
        }
        
        // Log todos los extras
        Bundle extras = intent.getExtras();
        if (extras != null) {
            Log.d(TAG, "Extras size: " + extras.size());
            for (String key : extras.keySet()) {
                Log.d(TAG, "Extra: " + key + " = " + extras.get(key));
            }
        }
        
        // Support both "push_url" (our custom) and "url" (from server)
        String pushUrl = intent.getStringExtra("push_url");
        if (pushUrl == null) {
            pushUrl = intent.getStringExtra("url");
        }
        
        Log.d(TAG, "pushUrl: " + (pushUrl != null ? pushUrl : "NULL"));
        
        if (pushUrl != null && !pushUrl.isEmpty()) {
            notificationHandled = true;
            Log.d(TAG, "Notificación tocada - Guardando en localStorage: " + pushUrl);
            
            // v432: GUARDAR EN LOCALSTORAGE - esto es lo que React leerá
            saveToLocalStorage(pushUrl);
        }
    }
    
    /**
     * Guarda la ruta en localStorage para que React la lea al inicio.
     * localStorage es la forma más confiable porque:
     * 1. Es síncrono - disponible inmediatamente
     * 2. Persiste aunque la app se reinicie
     * 3. both Android WebView y Capacitor pueden acceder
     */
    private void saveToLocalStorage(String route) {
        if (route == null || route.isEmpty()) {
            Log.w(TAG, "route es null o vacío");
            return;
        }
        
        // Escapar comillas simples para JS
        String safeRoute = route.replace("'", "\\'");
        
        // Guardar en localStorage y también dispatch evento
        String js = "try { " +
            "localStorage.setItem('pending_push_route', '" + safeRoute + "'); " +
            "console.log('[Native] Guardado en localStorage:', '" + safeRoute + "'); " +
            "window.dispatchEvent(new CustomEvent('pushRoute',{detail:'" + safeRoute + "'})); " +
            "} catch(e) { console.error('[Native] Error:', e); }";
        
        Log.d(TAG, "Ejecutando JS para guardar: " + js);
        
        try {
            bridge.getWebView().post(() -> {
                bridge.getWebView().evaluateJavascript(js, null);
            });
            Log.d(TAG, "✅ Guardado en localStorage y evento enviado");
        } catch (Exception e) {
            Log.e(TAG, "Error: " + e.getMessage());
        }
    }
}