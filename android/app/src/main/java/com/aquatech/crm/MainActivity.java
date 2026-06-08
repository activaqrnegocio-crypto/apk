package com.aquatech.crm;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    private static final String TAG = "AquatechFCM";
    // v418: Usar SharedPreferences que Capacitor Preferences puede leer
    private static final String PREFS_NAME = "AquatechPush";

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
     * v418: Guardar en SharedPreferences para que el frontend lo lea.
     */
    private void handleNotificationIntent(Intent intent) {
        if (intent == null) return;
        
        // Support both "push_url" (our custom) and "url" (from server)
        String pushUrl = intent.getStringExtra("push_url");
        if (pushUrl == null) {
            pushUrl = intent.getStringExtra("url");
        }
        String pushTag = intent.getStringExtra("push_tag");
        if (pushTag == null) {
            pushTag = intent.getStringExtra("tag");
        }
        
        if (pushUrl != null && !pushUrl.isEmpty()) {
            Log.d(TAG, "Notificación tocada - URL: " + pushUrl + ", Tag: " + pushTag);
            
            // Guardar en SharedPreferences (compatible con Capacitor Preferences)
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            prefs.edit()
                .putString("pending_url", pushUrl)
                .putString("pending_tag", pushTag)
                .putBoolean("has_pending", true)
                .apply();
            
            Log.d(TAG, "Pending nav guardado en SharedPreferences");
        }
    }
}
