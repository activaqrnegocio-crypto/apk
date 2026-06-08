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
        
        // Verificar si se abrió desde una notificación
        handleNotificationIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Cuando la app ya está abierta y llega una nueva notificación
        setIntent(intent);
        handleNotificationIntent(intent);
    }

    /**
     * Maneja los datos de la notificación y los pasa al WebView
     */
    private void handleNotificationIntent(Intent intent) {
        if (intent == null) return;
        
        String pushUrl = intent.getStringExtra("push_url");
        String pushTag = intent.getStringExtra("push_tag");
        
        if (pushUrl != null && !pushUrl.isEmpty()) {
            Log.d(TAG, "Notificación tocada - URL: " + pushUrl + ", Tag: " + pushTag);
            
            // Guardar en SharedPreferences para que el WebView lo lea al cargar
            getSharedPreferences("AquatechPush", MODE_PRIVATE)
                .edit()
                .putString("pending_url", pushUrl)
                .putString("pending_tag", pushTag)
                .apply();
            
            // Navegar inmediatamente si la app ya está cargada
            navigateToUrl(pushUrl);
        }
    }

    /**
     * Pasa la URL al WebView usando JavaScript
     */
    private void navigateToUrl(String url) {
        try {
            // Parsear URLs especiales
            String jsCode = "";
            
            if (url.startsWith("URL_PROJECT_CHAT:")) {
                // Chat de proyecto: URL_PROJECT_CHAT:123 → /admin/proyectos/123?view=chat
                String projectId = url.replace("URL_PROJECT_CHAT:", "");
                jsCode = "window.location.href = '/admin/proyectos/" + projectId + "?view=chat'";
            } else if (url.startsWith("URL_TASK:")) {
                // Tarea: URL_TASK:projectId:appointmentId → /admin/calendario?task=X&project=Y
                String parts = url.replace("URL_TASK:", "");
                String[] ids = parts.split(":");
                if (ids.length >= 2) {
                    jsCode = "window.location.href = '/admin/calendario?task=" + ids[1] + "&project=" + ids[0] + "'";
                }
            } else if (url.startsWith("/")) {
                // URL relativa
                jsCode = "window.location.href = '" + url + "'";
            } else {
                // Default
                jsCode = "window.location.href = '/admin'";
            }
            
            // Ejecutar JavaScript en el WebView
            if (!jsCode.isEmpty()) {
                Log.d(TAG, "Ejecutando JS: " + jsCode);
                this.runOnUiThread(() -> {
                    try {
                        bridge.evaluateJavascript(jsCode, null);
                    } catch (Exception e) {
                        Log.e(TAG, "Error evaluando JS: " + e.getMessage());
                    }
                });
            }
        } catch (Exception e) {
            Log.e(TAG, "Error en navigateToUrl: " + e.getMessage());
        }
    }
}
