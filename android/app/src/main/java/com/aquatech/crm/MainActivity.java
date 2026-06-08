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
        handleNotificationIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationIntent(intent);
    }

    private void handleNotificationIntent(Intent intent) {
        if (intent == null) return;
        
        String pushUrl = intent.getStringExtra("push_url");
        String pushTag = intent.getStringExtra("push_tag");
        
        if (pushUrl != null && !pushUrl.isEmpty()) {
            Log.d(TAG, "Notificación tocada - URL: " + pushUrl + ", Tag: " + pushTag);
            
            getSharedPreferences("AquatechPush", MODE_PRIVATE)
                .edit()
                .putString("pending_url", pushUrl)
                .putString("pending_tag", pushTag)
                .apply();
            
            navigateToUrl(pushUrl);
        }
    }

    private void navigateToUrl(String url) {
        try {
            String jsCode = "";
            
            if (url.startsWith("URL_PROJECT_CHAT:")) {
                // Formato: URL_PROJECT_CHAT:projectId:messageId
                // o solo: URL_PROJECT_CHAT:projectId
                String data = url.replace("URL_PROJECT_CHAT:", "");
                String[] parts = data.split(":");
                String projectId = parts[0];
                String messageId = parts.length > 1 ? parts[1] : null;
                
                if (messageId != null && !messageId.isEmpty()) {
                    // Ir al chat con scroll al mensaje específico
                    jsCode = "window.location.href = '/admin/proyectos/" + projectId + "?view=chat&message=" + messageId + "'";
                } else {
                    // Ir al chat sin mensaje específico
                    jsCode = "window.location.href = '/admin/proyectos/" + projectId + "?view=chat'";
                }
            } else if (url.startsWith("URL_TASK:")) {
                // Formato: URL_TASK:projectId:appointmentId
                String data = url.replace("URL_TASK:", "");
                String[] ids = data.split(":");
                if (ids.length >= 2) {
                    jsCode = "window.location.href = '/admin/calendario?task=" + ids[1] + "&project=" + ids[0] + "'";
                } else {
                    jsCode = "window.location.href = '/admin/calendario'";
                }
            } else if (url.startsWith("/")) {
                jsCode = "window.location.href = '" + url + "'";
            } else {
                jsCode = "window.location.href = '/admin'";
            }
            
            if (!jsCode.isEmpty()) {
                Log.d(TAG, "Ejecutando JS: " + jsCode);
                this.runOnUiThread(() -> {
                    try {
                        bridge.eval(jsCode);
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
