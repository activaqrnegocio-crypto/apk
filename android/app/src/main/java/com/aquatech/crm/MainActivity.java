package com.aquatech.crm;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    private static final String TAG = "AquatechFCM";

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
     * v429: Enviar directamente al WebView via evaluateJavascript
     */
    private void handleNotificationIntent(Intent intent) {
        Log.d(TAG, "handleNotificationIntent llamado");
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
            Log.d(TAG, "Notificación tocada - Enviando al WebView: " + pushUrl);
            
            // v429: Enviar directamente al WebView via evaluateJavascript
            sendRouteToWebView(pushUrl);
        }
    }
    
    /**
     * Envía la ruta al WebView usando evaluateJavascript
     * Este método inyecta un evento CustomEvent que el frontend escucha
     */
    private void sendRouteToWebView(String route) {
        if (route == null || route.isEmpty()) {
            Log.w(TAG, "route es null o vacío");
            return;
        }
        
        // Escapar comillas simples para JS
        String safeRoute = route.replace("'", "\\'");
        String js = "window.dispatchEvent(new CustomEvent('pushRoute',{detail:'" + safeRoute + "'}))";
        
        Log.d(TAG, "Ejecutando JS: " + js);
        
        try {
            bridge.getWebView().post(() -> {
                bridge.getWebView().evaluateJavascript(js, null);
            });
            Log.d(TAG, "Evento pushRoute enviado al WebView");
        } catch (Exception e) {
            Log.e(TAG, "Error: " + e.getMessage());
        }
    }
}